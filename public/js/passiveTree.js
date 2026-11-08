// Slop Hero - Passive Tree view.
// Draws the shared passive tree (server/talents.ts, CLIENT_TREE) on a canvas: about 1,000 nodes,
// so no DOM per node. Drag to pan, wheel or pinch to zoom, hover for a tooltip and a preview of
// the shortest path from your build, click to allocate that whole path, right-click (or
// long-press) an allocated node to refund it. A search box rings matching nodes.
//
//   const view = PassiveTreeView.create(container, {
//     tree,                                   // CLIENT_TREE from the server
//     getState: () => ({ cls, skills, points, gold }),
//     onAllocate: (ids) => {},                // ids in allocation order
//     onRefund: (id) => {},
//     refundCost: 25
//   });
//   view.update();                            // state changed: recompute and redraw
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const KIND_R = { travel: 9, minor: 14, notable: 25, keystone: 40, start: 46 };
  const GOLD = '#f6c453', GOLD_SOFT = '#a88a4a', DIM = '#2f3450', PATH = '#fff1c2', SEARCH = '#e879f9';
  const EFFECT_ICON = {
    hpPct: 'heart', defPct: 'shield', mpPct: 'mp_potion', dmgPct: 'sword', thornsPct: 'thorns',
    bonusAttackSpeed: 'bolt', bonusSpeed: 'boots', bonusSwipe: 'whirl', critChanceBonus: 'target',
    critDmgBonus: 'burst', dodgeChance: 'feather', lifeSteal: 'fang', killHealPercent: 'heart',
    killManaPercent: 'mp_potion', burnPower: 'fire', chillChance: 'snow', shatterBonus: 'snow',
    echoChance: 'essence', manaLeech: 'mp_potion', poisonPower: 'poison'
  };
  // Build summary lines: [stat, label, format]
  const SUMMARY = [
    ['dmgPct', 'Damage', 'pct'], ['hpPct', 'Max HP', 'pct'], ['defPct', 'Armor', 'pct'], ['mpPct', 'Max MP', 'pct'],
    ['bonusAttackSpeed', 'Attack Speed', 'pct'], ['bonusSpeed', 'Move Speed', 'num'], ['bonusSwipe', 'Cleave', 'flat'],
    ['critChanceBonus', 'Crit Chance', 'pct'], ['critDmgBonus', 'Crit Damage', 'pct'], ['dodgeChance', 'Dodge', 'pct'],
    ['lifeSteal', 'Lifesteal', 'pct'], ['thornsPct', 'Armor as Thorns', 'pct'], ['killHealPercent', 'HP on kill', 'pct'],
    ['killManaPercent', 'MP on kill', 'pct'], ['burnPower', 'Ignite power', 'pct'], ['chillChance', 'Frostbite chance', 'pct'],
    ['shatterBonus', 'Shatter damage', 'pct'], ['echoChance', 'Void Echo chance', 'pct'], ['manaLeech', 'Mana Leech', 'pct'],
    ['poisonPower', 'Venom power', 'pct']
  ];
  const fmt = (v, f) => {
    const s = v < 0 ? '-' : '+';
    const a = Math.abs(v);
    if (f === 'pct') return s + (+(a * 100).toFixed(2)) + '%';
    if (f === 'flat') return s + (+a.toFixed(1)) + '%';
    return s + (+a.toFixed(2));
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function iconName(n) {
    if (n.icon) return n.icon;
    if (n.kind === 'keystone') return 'crown';
    return EFFECT_ICON[Object.keys(n.effects || {})[0]] || 'star';
  }
  const imgCache = new Map();
  let onIconLoad = null;
  function iconImg(name) {
    if (!window.PixelIcons || !PixelIcons.url) return null;
    const url = PixelIcons.url(name);
    let img = imgCache.get(url);
    if (!img) {
      img = new Image();
      img.onload = () => { if (onIconLoad) onIconLoad(); };
      img.src = url;
      imgCache.set(url, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  function create(container, opts) {
    const tree = opts.tree;
    const nodes = tree.nodes;
    const byId = new Map(nodes.map(n => [n.id, n]));
    const regions = tree.regions || [];
    const RADIUS = tree.radius || 3400;
    const refundCost = opts.refundCost || 0;
    const edges = (tree.edges || []).map(e => ({ a: byId.get(e[0]), b: byId.get(e[1]), cx: e[2], cy: e[3], arc: e.length > 2 }))
      .filter(e => e.a && e.b);

    // spatial hash for hit testing
    const CELL = 160;
    const grid = new Map();
    const cellKey = (cx, cy) => cx + ',' + cy;
    for (const n of nodes) {
      const k = cellKey(Math.floor(n.x / CELL), Math.floor(n.y / CELL));
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(n);
    }
    function nodeAt(wx, wy, slop) {
      const cx = Math.floor(wx / CELL), cy = Math.floor(wy / CELL);
      let best = null, bd = Infinity;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const n of grid.get(cellKey(cx + dx, cy + dy)) || []) {
          const d = Math.hypot(n.x - wx, n.y - wy);
          if (d <= KIND_R[n.kind] + slop && d < bd) { bd = d; best = n; }
        }
      }
      return best;
    }

    // a fixed sprinkle of background stars
    const stars = [];
    let seed = 7331;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 900; i++) {
      const r = Math.sqrt(rnd()) * (RADIUS + 900), a = rnd() * TAU;
      stars.push([Math.cos(a) * r, Math.sin(a) * r, rnd() < 0.07 ? 2 : 1, 0.15 + rnd() * 0.5]);
    }

    // ---- DOM
    const root = document.createElement('div');
    root.className = 'pt-viewport pt-canvas-view';
    const canvas = document.createElement('canvas');
    canvas.className = 'pt-canvas';
    root.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const counter = document.createElement('div');
    counter.className = 'pt-counter';
    root.appendChild(counter);

    const searchBox = document.createElement('div');
    searchBox.className = 'pt-search';
    searchBox.innerHTML = '<input type="search" placeholder="Search passives..." spellcheck="false" autocomplete="off"><span class="pt-search-count"></span>';
    root.appendChild(searchBox);
    const searchInput = searchBox.querySelector('input');
    const searchCount = searchBox.querySelector('.pt-search-count');

    const summary = document.createElement('div');
    summary.className = 'pt-summary is-collapsed';
    summary.innerHTML = '<button type="button" class="pt-summary-head">Build Summary <span>▸</span></button><div class="pt-summary-body"></div>';
    root.appendChild(summary);
    const summaryBody = summary.querySelector('.pt-summary-body');
    summary.querySelector('.pt-summary-head').addEventListener('click', () => {
      summary.classList.toggle('is-collapsed');
      summary.querySelector('.pt-summary-head span').textContent = summary.classList.contains('is-collapsed') ? '▸' : '▾';
    });

    const controls = document.createElement('div');
    controls.className = 'pt-zoom-controls';
    controls.innerHTML = '<button type="button" data-z="in" title="Zoom in">+</button><button type="button" data-z="out" title="Zoom out">−</button>' +
      '<button type="button" data-z="home" title="Center on your build"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="9" r="5"/><path d="M9 0v5M9 13v5M0 9h5M13 9h5"/></svg></button>' +
      '<button type="button" data-z="fit" title="Show the whole tree"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 6V1h5M12 1h5v5M17 12v5h-5M6 17H1v-5"/></svg></button>';
    root.appendChild(controls);

    const legend = document.createElement('div');
    legend.className = 'pt-legend';
    legend.innerHTML = '<span><i class="pt-dot is-learned"></i>Allocated</span><span><i class="pt-dot is-open"></i>Can allocate</span><span><i class="pt-dot is-closed"></i>Locked</span>' +
      '<span class="pt-legend-hint">Click: allocate (whole path) · Right-click: refund' + (refundCost ? ' (' + refundCost.toLocaleString() + 'g)' : '') + ' · Drag: move · Scroll: zoom</span>';
    root.appendChild(legend);

    const tip = document.createElement('div');
    tip.className = 'game-tooltip pt-tip';
    tip.style.display = 'none';
    document.body.appendChild(tip);

    container.appendChild(root);

    // ---- state
    let view = null;           // { x, y, k }: screen = world * k + (x, y)
    let hoverId = null, selectedId = null;
    let preview = [];          // ids of the path to the hovered / selected node
    let previewSet = new Set();
    let query = '', matches = new Set(), matchList = [], matchIdx = -1;
    let owned = new Set(), canSet = new Set(), myStart = null, state = { skills: {}, points: 0, cls: '' };
    let lastPointer = 'mouse';
    let drawQueued = false;
    let dpr = 1, W = 0, H = 0;

    function recompute() {
      state = opts.getState() || state;
      const skills = state.skills || {};
      myStart = (tree.starts || {})[state.cls] || null;
      owned = new Set(Object.keys(skills).filter(id => skills[id] > 0 && byId.has(id)));
      canSet = new Set();
      for (const n of nodes) {
        if (n.kind === 'start' || owned.has(n.id)) continue;
        if (n.links.some(l => owned.has(l) || l === myStart)) canSet.add(n.id);
      }
    }
    const isLit = (id) => owned.has(id) || id === myStart;

    // Shortest run of unallocated nodes from the build (or the class start) to `id`
    function pathTo(id) {
      const target = byId.get(id);
      if (!target || target.kind === 'start' || owned.has(id) || !myStart) return [];
      const prev = new Map();
      const queue = [];
      for (const s of [myStart, ...owned]) { prev.set(s, null); queue.push(s); }
      for (let qi = 0; qi < queue.length; qi++) {
        const cur = queue[qi];
        for (const l of byId.get(cur).links) {
          if (prev.has(l)) continue;
          const ln = byId.get(l);
          if (!ln || ln.kind === 'start') continue;
          prev.set(l, cur);
          if (l === id) {
            const path = [];
            for (let p = l; p && !isLit(p); p = prev.get(p)) path.push(p);
            return path.reverse();
          }
          queue.push(l);
        }
      }
      return [];
    }
    function setPreview(id) {
      preview = id ? pathTo(id) : [];
      previewSet = new Set(preview);
    }

    // ---- view helpers
    function fitView() {
      const k = Math.min(W, H) / (RADIUS * 2 + 560);
      view = { k, x: W / 2, y: H / 2 };
    }
    function homeView() {
      let fx = 0, fy = 0, cnt = 0;
      const pts = owned.size ? [...owned] : (myStart ? [myStart] : []);
      for (const id of pts) { const n = byId.get(id); fx += n.x; fy += n.y; cnt++; }
      if (cnt) { fx /= cnt; fy /= cnt; }
      const k = owned.size ? 0.42 : 0.3;
      view = { k, x: W / 2 - fx * k, y: H / 2 - fy * k };
    }
    function clampView() {
      const m = RADIUS * view.k;
      view.x = Math.max(W / 2 - m, Math.min(W / 2 + m, view.x));
      view.y = Math.max(H / 2 - m, Math.min(H / 2 + m, view.y));
    }
    function zoomAt(sx, sy, factor) {
      const k2 = Math.max(0.07, Math.min(1.6, view.k * factor));
      view.x = sx - (sx - view.x) * (k2 / view.k);
      view.y = sy - (sy - view.y) * (k2 / view.k);
      view.k = k2;
      clampView();
      requestDraw();
    }
    const toWorld = (sx, sy) => ({ x: (sx - view.x) / view.k, y: (sy - view.y) / view.k });
    function centerOn(n, k) {
      if (k) view.k = k;
      view.x = W / 2 - n.x * view.k;
      view.y = H / 2 - n.y * view.k;
      clampView();
      requestDraw();
    }

    function requestDraw() {
      if (drawQueued) return;
      drawQueued = true;
      requestAnimationFrame(() => { drawQueued = false; draw(); });
    }
    onIconLoad = requestDraw;

    // ---- drawing
    function draw() {
      const rw = root.clientWidth, rh = root.clientHeight;
      if (!rw || !rh) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      if (rw !== W || rh !== H || canvas.width !== Math.round(rw * dpr)) {
        W = rw; H = rh;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
      }
      if (!view) homeView();
      clampView();
      const k = view.k;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // visible world rect (+ margin) for culling
      const wl = -view.x / k - 80, wt = -view.y / k - 80, wr = (W - view.x) / k + 80, wb = (H - view.y) / k + 80;
      const visible = (x, y, m) => x + m >= wl && x - m <= wr && y + m >= wt && y - m <= wb;

      ctx.save();
      ctx.translate(view.x, view.y);
      ctx.scale(k, k);

      // sky
      ctx.fillStyle = '#ffffff';
      for (const s of stars) {
        if (!visible(s[0], s[1], 4)) continue;
        ctx.globalAlpha = s[3];
        const sz = s[2] / k;
        ctx.fillRect(s[0], s[1], sz, sz);
      }
      ctx.globalAlpha = 1;

      // a soft glow behind each region, brighter where you have points
      const regionPts = regions.map(() => 0);
      for (const id of owned) regionPts[byId.get(id).region]++;
      regions.forEach((r, i) => {
        const a = r.angle * Math.PI / 180, cx = Math.cos(a) * 1850, cy = Math.sin(a) * 1850;
        if (!visible(cx, cy, 1500)) return;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1450);
        const al = regionPts[i] ? 0.2 : 0.11;
        g.addColorStop(0, hexA(r.color, al));
        g.addColorStop(0.6, hexA(r.color, al * 0.35));
        g.addColorStop(1, hexA(r.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, 1450, 0, TAU); ctx.fill();
      });

      // the hub in the middle
      ctx.beginPath(); ctx.arc(0, 0, 170, 0, TAU);
      const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, 170);
      hg.addColorStop(0, '#2b2150'); hg.addColorStop(0.7, '#120d26'); hg.addColorStop(1, '#07060f');
      ctx.fillStyle = hg; ctx.fill();
      ctx.lineWidth = Math.max(4, 1.5 / k); ctx.strokeStyle = '#c9a85a'; ctx.stroke();

      // edges, batched by state
      const buckets = { dim: [], open: [], lit: [], path: [] };
      for (const e of edges) {
        const a = e.a, b = e.b;
        if (!visible((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(a.x - b.x) / 2 + Math.abs(a.y - b.y) / 2 + 60)) continue;
        const la = isLit(a.id), lb = isLit(b.id);
        let s = 'dim';
        if (la && lb) s = 'lit';
        else if ((previewSet.has(a.id) || la) && (previewSet.has(b.id) || lb) && (previewSet.has(a.id) || previewSet.has(b.id))) s = 'path';
        else if ((la && b.kind !== 'start') || (lb && a.kind !== 'start')) s = 'open';
        buckets[s].push(e);
      }
      const strokeEdges = (list, color, width, glow) => {
        if (!list.length) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(width, 1.2 / k);
        if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
        ctx.beginPath();
        for (const e of list) {
          ctx.moveTo(e.a.x, e.a.y);
          if (e.arc) {
            const r = Math.hypot(e.a.x - e.cx, e.a.y - e.cy);
            const a1 = Math.atan2(e.a.y - e.cy, e.a.x - e.cx), a2 = Math.atan2(e.b.y - e.cy, e.b.x - e.cx);
            let d = a2 - a1;
            while (d > Math.PI) d -= TAU;
            while (d < -Math.PI) d += TAU;
            ctx.arc(e.cx, e.cy, r, a1, a2, d < 0);
          } else ctx.lineTo(e.b.x, e.b.y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      };
      ctx.lineCap = 'round';
      strokeEdges(buckets.dim, DIM, 4);
      strokeEdges(buckets.open, GOLD_SOFT, 5);
      strokeEdges(buckets.lit, GOLD, 8, 12);
      strokeEdges(buckets.path, PATH, 8, 14);

      // nodes
      const iconPx = (n) => KIND_R[n.kind] * k;
      for (const n of nodes) {
        const R = KIND_R[n.kind];
        if (!visible(n.x, n.y, R + 20)) continue;
        const own = isLit(n.id), can = canSet.has(n.id), inPath = previewSet.has(n.id);
        const regionColor = (regions[n.region] || {}).color || '#888';

        if (n.kind === 'start') {
          ctx.beginPath(); ctx.arc(n.x, n.y, R, 0, TAU);
          ctx.fillStyle = n.id === myStart ? '#3b2d12' : '#14162a'; ctx.fill();
          ctx.lineWidth = 6; ctx.strokeStyle = n.id === myStart ? GOLD : '#4a4433'; ctx.stroke();
          ctx.beginPath(); ctx.arc(n.x, n.y, R + 12, 0, TAU);
          ctx.lineWidth = 3; ctx.strokeStyle = n.id === myStart ? 'rgba(246,196,83,0.5)' : 'rgba(90,84,60,0.5)'; ctx.stroke();
          continue;
        }

        // keystone frame: a cut-star ring
        if (n.kind === 'keystone') {
          ctx.save();
          ctx.translate(n.x, n.y);
          ctx.fillStyle = own ? '#b8924a' : '#5c5136';
          for (let i = 0; i < 16; i++) {
            ctx.rotate(TAU / 16);
            ctx.fillRect(-3, -(R + 18), 6, 10);
          }
          ctx.restore();
          ctx.beginPath(); ctx.arc(n.x, n.y, R + 7, 0, TAU);
          ctx.lineWidth = 4; ctx.strokeStyle = own ? GOLD : '#6b5c3a'; ctx.stroke();
        } else if (n.kind === 'notable') {
          ctx.beginPath(); ctx.arc(n.x, n.y, R + 5, 0, TAU);
          ctx.lineWidth = 3; ctx.strokeStyle = own ? GOLD : '#4a4230'; ctx.stroke();
        }

        // body
        ctx.beginPath(); ctx.arc(n.x, n.y, R, 0, TAU);
        if (own) {
          const g = ctx.createRadialGradient(n.x, n.y - R * 0.3, 0, n.x, n.y, R);
          g.addColorStop(0, '#6b5420'); g.addColorStop(1, '#1c1508');
          ctx.fillStyle = g;
        } else ctx.fillStyle = '#10132a';
        ctx.fill();
        if (!own) { ctx.fillStyle = hexA(regionColor, n.kind === 'travel' ? 0.28 : 0.18); ctx.fill(); }
        if (own) { ctx.shadowColor = GOLD; ctx.shadowBlur = n.kind === 'travel' ? 8 : 16; }
        ctx.lineWidth = n.kind === 'travel' ? 3 : n.kind === 'minor' ? 3.5 : 5;
        ctx.strokeStyle = own ? GOLD : inPath ? PATH : can ? '#c9ad6a'
          : n.kind === 'keystone' || n.kind === 'notable' ? '#6b6044' : '#3e4466';
        ctx.stroke();
        ctx.shadowBlur = 0;

        // icon
        if (n.kind !== 'travel' && iconPx(n) >= 7) {
          const img = iconImg(iconName(n));
          if (img) {
            const s = R * (n.kind === 'minor' ? 1.15 : 1.25);
            ctx.globalAlpha = own ? 1 : can || inPath ? 0.8 : 0.4;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, n.x - s / 2, n.y - s / 2, s, s);
            ctx.globalAlpha = 1;
          }
        }

        // search match / hover rings
        if (matches.has(n.id)) {
          ctx.beginPath(); ctx.arc(n.x, n.y, R + 14, 0, TAU);
          ctx.lineWidth = Math.max(5, 2.5 / k); ctx.strokeStyle = SEARCH; ctx.stroke();
        }
        if (n.id === hoverId || n.id === selectedId) {
          ctx.beginPath(); ctx.arc(n.x, n.y, R + 8, 0, TAU);
          ctx.lineWidth = Math.max(3, 1.5 / k); ctx.strokeStyle = '#ffffff'; ctx.stroke();
        }
      }

      // region names out past the keystones (only when zoomed out)
      if (k < 0.6) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        regions.forEach((r, i) => {
          const a = r.angle * Math.PI / 180, rr = RADIUS + 60;
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
          if (!visible(x, y, 400)) return;
          ctx.font = 'bold 120px ' + fontFamily();
          ctx.globalAlpha = regionPts[i] ? 0.95 : 0.6;
          ctx.fillStyle = r.color;
          ctx.fillText(r.name.toUpperCase(), x, y);
          if (r.cls) {
            ctx.font = '64px ' + fontFamily();
            ctx.fillStyle = '#e8dcc0';
            ctx.fillText(r.cls.toUpperCase() + ' START', x, y + 105);
          }
        });
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // screen-space labels: class names on the starts, notable / keystone names when close enough
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const n of nodes) {
        const showName = n.kind === 'start' ? k >= 0.12 : n.kind === 'keystone' ? k >= 0.16 : n.kind === 'notable' ? k >= 0.38 : false;
        if (!showName) continue;
        const R = KIND_R[n.kind];
        if (!visible(n.x, n.y, R + 40)) continue;
        const sx = n.x * k + view.x, sy = n.y * k + view.y;
        if (n.kind === 'start') {
          ctx.font = 'bold 12px ' + fontFamily();
          ctx.textBaseline = 'middle';
          ctx.fillStyle = n.id === myStart ? '#fde68a' : '#8b8574';
          ctx.fillText(n.name, sx, sy);
          ctx.textBaseline = 'top';
          continue;
        }
        const own = isLit(n.id);
        ctx.font = (n.kind === 'keystone' ? 'bold 13px ' : '12px ') + fontFamily();
        const ty = sy + (R + (n.kind === 'keystone' ? 22 : 9)) * k + 2;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(n.name, sx, ty);
        ctx.fillStyle = own ? '#ffe08a' : n.kind === 'keystone' ? '#f6deA0' : '#e8dcc0';
        ctx.fillText(n.name, sx, ty);
      }
    }
    let fontCache = null;
    function fontFamily() {
      if (!fontCache) fontCache = (getComputedStyle(root).fontFamily || 'sans-serif');
      return fontCache;
    }
    function hexA(hex, a) {
      const h = hex.replace('#', '');
      const v = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + a + ')';
    }

    // ---- overlay UI
    function updateOverlay() {
      const points = state.points || 0;
      counter.className = 'pt-counter' + (points > 0 ? ' has-points' : '');
      counter.innerHTML = '<b>' + points + '</b><span>Passive Point' + (points === 1 ? '' : 's') + ' Left</span><small>' + owned.size + ' allocated</small>';

      const tot = {};
      let notables = 0;
      const keystones = [], upgrades = [];
      for (const id of owned) {
        const n = byId.get(id);
        for (const [s, v] of Object.entries(n.effects || {})) tot[s] = (tot[s] || 0) + v;
        if (n.kind === 'notable') notables++;
        if (n.kind === 'keystone') keystones.push(n.name);
        if (n.kind === 'notable' && /^(Mage|Warrior|Rogue):/.test(n.desc.replace(/^NOTABLE:\s*/, ''))) upgrades.push(n.name);
      }
      let html = '<div class="pt-sum-row"><span>Notables</span><b>' + notables + '</b></div>';
      if (keystones.length) html += '<div class="pt-sum-ks">' + keystones.map(esc).join('<br>') + '</div>';
      const lines = SUMMARY.filter(([s]) => Math.abs(tot[s] || 0) > 1e-9);
      if (!lines.length) html += '<div class="pt-sum-empty">Nothing allocated yet.</div>';
      for (const [s, label, f] of lines) {
        html += '<div class="pt-sum-row' + (tot[s] < 0 ? ' is-neg' : '') + '"><span>' + label + '</span><b>' + fmt(tot[s], f) + '</b></div>';
      }
      if (upgrades.length) html += '<div class="pt-sum-sub">Skill upgrades</div>' + upgrades.map(u => '<div class="pt-sum-row"><span>' + esc(u) + '</span></div>').join('');
      summaryBody.innerHTML = html;
    }

    // ---- tooltip
    function tipHtml(n) {
      const kindTag = { keystone: 'Keystone', notable: 'Notable', minor: 'Passive', travel: 'Passive', start: 'Class Start' }[n.kind];
      const region = regions[n.region] ? regions[n.region].name : '';
      let status, ok = false;
      if (n.kind === 'start') {
        status = n.id === myStart ? 'Your starting point' : 'Another class starts here';
        ok = n.id === myStart;
      } else if (owned.has(n.id)) {
        status = 'Allocated · ' + (lastPointer === 'mouse' ? 'Right-click' : 'Long-press') + ' to refund' + (refundCost ? ' (' + refundCost.toLocaleString() + ' Gold)' : '');
        ok = true;
      } else {
        const cost = preview.length;
        const points = state.points || 0;
        if (!cost) status = 'Not reachable';
        else if (cost > points) status = 'Needs ' + cost + ' point' + (cost === 1 ? '' : 's') + ' (you have ' + points + ')';
        else {
          ok = true;
          const verb = lastPointer === 'mouse' ? 'Click' : 'Tap again';
          status = cost === 1 ? verb + ' to allocate (1 point)' : verb + ' to allocate the path (' + cost + ' points)';
        }
      }
      const iconHtml = window.PixelIcons && n.kind !== 'start' ? '<div class="tip-icon-wrap"><img class="pxi skill-svg" src="' + PixelIcons.url(iconName(n)) + '" alt=""></div>' : '';
      const nameColor = n.kind === 'keystone' ? '#f6c453' : n.kind === 'notable' ? '#f6deA0' : '#e2e8f0';
      return '<div class="tip-head">' + iconHtml + '<div>' +
        '<div class="tip-name" style="color:' + nameColor + '">' + esc(n.name) + '</div>' +
        '<div class="tip-type">' + kindTag + (region ? ' · ' + esc(region) : '') + '</div></div></div>' +
        '<div class="tip-flavour">' + esc((n.desc || '').replace(/^(KEYSTONE|NOTABLE):\s*/, '')) + '</div>' +
        '<div class="tip-line" style="color:' + (ok ? '#4ade80' : '#f97316') + ';font-size:11px">' + esc(status) + '</div>';
    }
    function showTip(n, clientX, clientY) {
      if (!n) { tip.style.display = 'none'; return; }
      tip.innerHTML = tipHtml(n);
      tip.style.display = 'block';
      const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gui-scale')) || 1;
      const tw = tip.offsetWidth * scale, th = tip.offsetHeight * scale;
      let x = clientX + 18, y = clientY + 18;
      if (x + tw > window.innerWidth - 6) x = clientX - tw - 12;
      if (y + th > window.innerHeight - 6) y = clientY - th - 12;
      tip.style.left = Math.max(4, x) + 'px';
      tip.style.top = Math.max(4, y) + 'px';
    }
    const hideTip = () => { tip.style.display = 'none'; };

    // ---- input
    const pointers = new Map();
    let drag = null, pinch = null, longPress = null;
    const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const hitAt = (sx, sy, touch) => { const w = toWorld(sx, sy); return nodeAt(w.x, w.y, (touch ? 14 : 5) / view.k); };

    canvas.addEventListener('pointerdown', (e) => {
      if (!view) return;
      lastPointer = e.pointerType || 'mouse';
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
      if (pointers.size === 1) {
        const p = local(e);
        drag = { sx: p.x, sy: p.y, ox: view.x, oy: view.y, moved: false, button: e.button };
        if (lastPointer !== 'mouse') {
          const n = hitAt(p.x, p.y, true);
          if (n && owned.has(n.id)) {
            longPress = setTimeout(() => { longPress = null; if (drag) drag.moved = true; refund(n); }, 600);
          }
        }
      } else if (pointers.size === 2) {
        clearTimeout(longPress); longPress = null;
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k };
        if (drag) drag.moved = true;
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = local(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.k * d / pinch.d) / view.k);
        return;
      }
      if (drag && pointers.size === 1) {
        if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) > 6) {
          drag.moved = true;
          clearTimeout(longPress); longPress = null;
          root.classList.add('is-panning');
          hideTip();
        }
        if (drag.moved) {
          view.x = drag.ox + (p.x - drag.sx);
          view.y = drag.oy + (p.y - drag.sy);
          clampView();
          requestDraw();
        }
        return;
      }
      if ((e.pointerType || 'mouse') !== 'mouse' || !view) return;
      lastPointer = 'mouse';
      const n = hitAt(p.x, p.y, false);
      const id = n ? n.id : null;
      if (id !== hoverId) {
        hoverId = id;
        setPreview(id);
        canvas.style.cursor = n && n.kind !== 'start' ? 'pointer' : '';
        requestDraw();
      }
      if (n) showTip(n, e.clientX, e.clientY); else hideTip();
    });
    const endPointer = (e) => {
      const wasDrag = drag;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size > 0) return;
      clearTimeout(longPress); longPress = null;
      root.classList.remove('is-panning');
      drag = null;
      if (!wasDrag || wasDrag.moved || e.type === 'pointercancel' || wasDrag.button !== 0) return;
      const p = local(e);
      const touch = (e.pointerType || 'mouse') !== 'mouse';
      const n = hitAt(p.x, p.y, touch);
      if (!n) { selectedId = null; if (touch) { setPreview(null); hideTip(); } requestDraw(); return; }
      if (touch) {
        if (selectedId === n.id) allocate(n);
        else {
          selectedId = n.id;
          setPreview(n.id);
          showTip(n, e.clientX, e.clientY);
          requestDraw();
        }
        return;
      }
      allocate(n);
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', (e) => {
      if ((e.pointerType || 'mouse') !== 'mouse' || drag) return;
      hoverId = null; setPreview(null); hideTip(); requestDraw();
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!view) return;
      const p = local(e);
      zoomAt(p.x, p.y, Math.pow(1.0015, -e.deltaY));
      hideTip();
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const p = local(e);
      const n = hitAt(p.x, p.y, false);
      if (n && owned.has(n.id)) refund(n);
    });
    controls.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !view) return;
      if (b.dataset.z === 'home') { homeView(); requestDraw(); return; }
      if (b.dataset.z === 'fit') { fitView(); requestDraw(); return; }
      zoomAt(W / 2, H / 2, b.dataset.z === 'in' ? 1.3 : 1 / 1.3);
    });

    function allocate(n) {
      if (n.kind === 'start' || owned.has(n.id)) return;
      const path = pathTo(n.id);
      if (!path.length || path.length > (state.points || 0)) {
        if (lastPointer === 'mouse') showTip(n, lastClient.x, lastClient.y);
        return;
      }
      selectedId = null;
      opts.onAllocate(path);
    }
    function refund(n) {
      if (!owned.has(n.id)) return;
      hideTip();
      opts.onRefund(n.id);
    }
    let lastClient = { x: 0, y: 0 };
    canvas.addEventListener('pointermove', (e) => { lastClient = { x: e.clientX, y: e.clientY }; }, true);

    // search
    function runSearch() {
      query = searchInput.value.trim().toLowerCase();
      matches = new Set();
      matchList = [];
      matchIdx = -1;
      if (query.length >= 2) {
        for (const n of nodes) {
          if (n.kind === 'start') continue;
          if (n.name.toLowerCase().includes(query) || (n.desc || '').toLowerCase().includes(query)) {
            matches.add(n.id);
            if (n.kind === 'notable' || n.kind === 'keystone') matchList.push(n);
          }
        }
        if (!matchList.length) matchList = nodes.filter(n => matches.has(n.id));
      }
      searchCount.textContent = query.length >= 2 ? matches.size + ' found' : '';
      requestDraw();
    }
    searchInput.addEventListener('input', runSearch);
    searchInput.addEventListener('keydown', (e) => {
      e.stopPropagation();   // typing must not trigger game hotkeys
      if (e.key === 'Enter' && matchList.length) {
        matchIdx = (matchIdx + 1) % matchList.length;
        centerOn(matchList[matchIdx], Math.max(view.k, 0.55));
      }
      if (e.key === 'Escape') { searchInput.value = ''; runSearch(); searchInput.blur(); }
    });
    searchInput.addEventListener('keyup', e => e.stopPropagation());

    if (window.ResizeObserver) new ResizeObserver(() => draw()).observe(root);   // sync, so a resize never shows a stretched frame

    function update() {
      recompute();
      if (hoverId) setPreview(hoverId);
      else if (selectedId) setPreview(selectedId);
      else setPreview(null);
      updateOverlay();
      requestDraw();
    }

    update();
    return {
      el: root,
      update,
      resetView() { view = null; requestDraw(); },
      hideTip,
      destroy() { tip.remove(); root.remove(); }
    };
  }

  window.PassiveTreeView = { create };
})();
