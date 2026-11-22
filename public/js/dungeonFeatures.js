// Slop Hero - dungeon features, client side (server: server/dungeonFeatures.ts)
//
// Draws the event props (ward, shrine, spring, secret cracks), the badges on forked doors and
// the "Lights Out" darkness; shows the boon pick, the shrine bargain, event banners, the
// portal's Depth / Weekly picks with the weekly leaderboard, and the run panel and result extras.
(function () {
  'use strict';

  const DF = {
    catalog: null,
    socket: null,
    deps: null,
    weekly: false,
    depth: 0,
    board: null,
    shrineUsed: new Set(),     // obstacle ids this hero has used (spring / shrine look spent)
    banner: null,
    bannerTimer: null
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* private mode */ } }
  };
  DF.weekly = !!store.get('slop_dungeon_weekly', false);
  DF.depth = store.get('slop_dungeon_depth', 0) | 0;

  DF.setCatalog = (c) => { DF.catalog = c; };

  // Boons and curses wear the game's own pixel icons (an emoji font is not everywhere)
  const ICONS = {
    might: 'sword', vigor: 'heart', bulwark: 'shield', swiftness: 'boots', precision: 'target', ruthless: 'dagger', frenzy: 'bolt',
    focus: 'refresh', leech: 'fang', bloodthirst: 'chalice', siphon: 'mp_potion', renewal: 'tree', detonate: 'burst', static: 'star',
    frail: 'skull', sluggish: 'snow', brittle: 'thorns', drained: 'droplet'
  };
  const icon = (o, cls = 'df-pxi') => (window.PixelIcons && ICONS[o.id]) ? PixelIcons.html(ICONS[o.id], cls) : esc(o.icon || '');

  // ------------------------------------------------------------------ drawing helpers
  const W2S = (R, x, y, z = 0) => Isometric.worldToScreen(x, y, z, R.camera, R.viewW, R.viewH);
  // a circle on the floor, as a screen path (iso ellipse)
  function floorRing(R, ctx, x, y, r, from = 0, to = Math.PI * 2, steps = 40) {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = from + (to - from) * (i / steps);
      const p = W2S(R, x + Math.cos(a) * r, y + Math.sin(a) * r);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
  }
  const px = (z) => Math.max(1, Math.round(z * 1.25));

  function drawWard(R, ctx, obs, s, z) {
    const t = R.animations.time;
    const prog = obs.charged ? 1 : (obs.progress || 0);
    const P = px(z);
    ctx.save();
    // the circle to stand in, and the charge filling it
    ctx.lineWidth = Math.max(1, 1.5 * z);
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.35)';
    floorRing(R, ctx, obs.x, obs.y, 2.4); ctx.stroke();
    if (prog > 0) {
      ctx.lineWidth = Math.max(2, 3 * z);
      ctx.strokeStyle = obs.charged ? '#fde68a' : '#a78bfa';
      ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 8 * z;
      floorRing(R, ctx, obs.x, obs.y, 2.4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // rune marks around the ring
    ctx.fillStyle = 'rgba(196, 181, 253, 0.55)';
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + t * 0.3;
      const p = W2S(R, obs.x + Math.cos(a) * 2.05, obs.y + Math.sin(a) * 2.05);
      ctx.fillRect(Math.round(p.x - P), Math.round(p.y - P), 2 * P, 2 * P);
    }
    // the crystal: a floating diamond over a stone base
    const bob = Math.sin(t * 2.2) * 2 * z;
    const cx = Math.round(s.x), base = Math.round(s.y);
    ctx.fillStyle = '#1b1e27'; ctx.fillRect(cx - 7 * P, base - 3 * P, 14 * P, 4 * P);
    ctx.fillStyle = '#3a3f4d'; ctx.fillRect(cx - 6 * P, base - 3 * P, 12 * P, 1 * P);
    const top = base - 30 * z + bob, mid = base - 18 * z + bob, bot = base - 8 * z + bob;
    const glow = obs.charged ? '#fde68a' : `rgba(167, 139, 250, ${0.5 + 0.4 * prog})`;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, mid, 0, cx, mid, 26 * z);
    g.addColorStop(0, obs.charged ? 'rgba(253, 230, 138, 0.55)' : `rgba(139, 92, 246, ${0.25 + 0.35 * prog})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - 26 * z, mid - 26 * z, 52 * z, 52 * z);
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx + 7 * z, mid); ctx.lineTo(cx, bot); ctx.lineTo(cx - 7 * z, mid); ctx.closePath();
    ctx.fillStyle = obs.charged ? '#fbbf24' : '#5b21b6'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx + 7 * z, mid); ctx.lineTo(cx, mid + 2 * z); ctx.closePath();
    ctx.fillStyle = glow; ctx.fill();
    ctx.fillStyle = '#ede9fe'; ctx.fillRect(cx - P, Math.round(top + 4 * z), P, Math.round(6 * z));
    ctx.restore();
  }

  function drawShrine(R, ctx, obs, s, z, used) {
    const t = R.animations.time, P = px(z);
    const cx = Math.round(s.x), base = Math.round(s.y);
    ctx.save();
    // altar
    ctx.fillStyle = '#0f0a14'; ctx.fillRect(cx - 12 * P, base - 10 * P, 24 * P, 11 * P);
    ctx.fillStyle = '#2a1d33'; ctx.fillRect(cx - 11 * P, base - 10 * P, 22 * P, 3 * P);
    ctx.fillStyle = '#3b2a47'; ctx.fillRect(cx - 11 * P, base - 10 * P, 22 * P, 1 * P);
    ctx.fillStyle = '#1a1022'; ctx.fillRect(cx - 9 * P, base - 6 * P, 18 * P, 6 * P);
    // carved eye
    ctx.fillStyle = used ? '#3b2a47' : '#7e22ce'; ctx.fillRect(cx - 3 * P, base - 4 * P, 6 * P, 2 * P);
    ctx.fillStyle = used ? '#2a1d33' : '#e9d5ff'; ctx.fillRect(cx - P, base - 4 * P, 2 * P, 2 * P);
    // candles
    for (const dx of [-9, 9]) {
      ctx.fillStyle = '#d6d3d1'; ctx.fillRect(cx + dx * P - P, base - 15 * P, 2 * P, 5 * P);
      if (!used) {
        const f = Math.sin(t * 9 + dx) > 0 ? 1 : 0;
        ctx.fillStyle = '#c084fc'; ctx.fillRect(cx + dx * P - P, base - (17 + f) * P, 2 * P, 2 * P);
        ctx.fillStyle = '#f5d0fe'; ctx.fillRect(cx + dx * P - P, base - 16 * P, P, P);
      }
    }
    // a floating skull over the altar, breathing purple
    if (!used) {
      const bob = Math.round(Math.sin(t * 1.8) * 2 * z);
      const sy = base - 30 * z + bob;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, sy, 0, cx, sy, 22 * z);
      g.addColorStop(0, 'rgba(168, 85, 247, 0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - 22 * z, sy - 22 * z, 44 * z, 44 * z);
      ctx.globalCompositeOperation = 'source-over';
      if (window.PixelIcons) {
        const sz = Math.round(12 * Math.max(1, Math.round(z * 1.4)));
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(PixelIcons.image('skull'), Math.round(cx - sz / 2), Math.round(sy - sz / 2), sz, sz);
      }
    }
    ctx.restore();
  }

  function drawSpring(R, ctx, obs, s, z, used) {
    const t = R.animations.time;
    ctx.save();
    ctx.lineWidth = Math.max(2, 3 * z);
    ctx.strokeStyle = '#475569';
    floorRing(R, ctx, obs.x, obs.y, 1.25); ctx.stroke();
    floorRing(R, ctx, obs.x, obs.y, 1.1);
    ctx.fillStyle = used ? 'rgba(30, 64, 90, 0.85)' : 'rgba(34, 211, 238, 0.55)'; ctx.fill();
    if (!used) {
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 6; k++) {
        const a = k * 1.7 + t * 0.6, r = 0.3 + ((k * 0.37 + t * 0.25) % 0.7);
        const p = W2S(R, obs.x + Math.cos(a) * r, obs.y + Math.sin(a) * r);
        ctx.fillStyle = 'rgba(207, 250, 254, 0.7)';
        ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.max(1, Math.round(2 * z)), Math.max(1, Math.round(z)));
      }
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 40 * z);
      g.addColorStop(0, 'rgba(103, 232, 249, 0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(s.x - 40 * z, s.y - 40 * z, 80 * z, 80 * z);
    }
    ctx.restore();
  }

  // Cracks in the floor before a hollow wall: subtle, with dust drifting out now and then
  function drawCrack(R, ctx, obs, s, z) {
    const t = R.animations.time, P = px(z);
    ctx.save();
    ctx.strokeStyle = 'rgba(10, 8, 6, 0.85)';
    ctx.lineWidth = Math.max(1, z);
    const lines = [[[-0.45, -0.1], [-0.1, 0.05], [0.1, -0.15], [0.45, 0.05]], [[-0.1, 0.05], [-0.05, 0.35]], [[0.1, -0.15], [0.25, -0.4]]];
    for (const l of lines) {
      ctx.beginPath();
      l.forEach(([dx, dy], i) => { const p = W2S(R, obs.x + dx, obs.y + dy); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
      ctx.stroke();
    }
    const phase = (t * 0.5 + (obs.x * 7 + obs.y * 3) % 5) % 4;
    if (phase < 1) {
      ctx.fillStyle = `rgba(214, 211, 209, ${0.5 * (1 - phase)})`;
      for (let k = 0; k < 3; k++) ctx.fillRect(Math.round(s.x + (k - 1) * 4 * z), Math.round(s.y - phase * 14 * z - k * 2 * z), P, P);
    }
    ctx.restore();
  }

  DF.drawObstacle = function (R, ctx, obs, screen, z) {
    switch (obs.type) {
      case 'dungeon_ward': drawWard(R, ctx, obs, screen, z); return true;
      case 'dungeon_shrine': drawShrine(R, ctx, obs, screen, z, DF.shrineUsed.has(obs.id)); return true;
      case 'dungeon_spring': drawSpring(R, ctx, obs, screen, z, DF.shrineUsed.has(obs.id)); return true;
      case 'dungeon_crack': drawCrack(R, ctx, obs, screen, z); return true;
    }
    return false;
  };

  const DOOR_ICONS = {
    treasure: ['chest', 'Treasure', '#facc15'], shrine: ['chalice', 'Cursed shrine', '#c084fc'], spring: ['droplet', 'Healing spring', '#67e8f9'],
    miniboss: ['skull', 'Miniboss', '#f87171'], elite: ['crown', 'Elite gauntlet', '#fbbf24'], ward: ['gem', 'Hold the ward', '#a78bfa'],
    dark: ['star', 'Lights out', '#94a3b8'], fight: ['sword', 'Monsters', '#e2e8f0']
  };
  // Forked doors: a sign over the lintel saying what is behind; sealed doors are boarded and dim
  DF.drawDoorBadge = function (R, ctx, obs, p1, p2, h, z) {
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    if (obs.sealed) {
      ctx.save();
      ctx.fillStyle = 'rgba(8, 6, 10, 0.55)';
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p2.x, p2.y - h); ctx.lineTo(p1.x, p1.y - h); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#5b4636'; ctx.lineWidth = Math.max(3, 5 * z);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y - h * 0.85); ctx.lineTo(p2.x, p2.y - h * 0.15); ctx.moveTo(p1.x, p1.y - h * 0.15); ctx.lineTo(p2.x, p2.y - h * 0.85); ctx.stroke();
      ctx.restore();
      return;
    }
    if (!obs.choice || !obs.icon) return;
    const info = DOOR_ICONS[obs.icon] || DOOR_ICONS.fight;
    const t = R.animations.time;
    const bob = Math.round(Math.sin(t * 2.5) * 2 * z);
    const size = Math.round(12 * Math.max(2, Math.round(z * 2)));
    const bx = Math.round(mx), by = Math.round(my - h - 22 * z + bob);
    ctx.save();
    ctx.fillStyle = 'rgba(15, 17, 26, 0.88)';
    ctx.fillRect(bx - size / 2 - 4 * z, by - size / 2 - 4 * z, size + 8 * z, size + 8 * z);
    ctx.fillStyle = info[2];
    ctx.fillRect(bx - size / 2 - 4 * z, by + size / 2 + 2 * z, size + 8 * z, Math.max(2, 2 * z));
    if (window.PixelIcons) { ctx.imageSmoothingEnabled = false; ctx.drawImage(PixelIcons.image(info[0]), bx - size / 2, by - size / 2, size, size); }
    ctx.font = `bold ${Math.max(9, Math.round(7 * z))}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0b0c12';
    ctx.fillText(info[1].toUpperCase(), bx + 1, by - size / 2 - 7 * z + 1);
    ctx.fillStyle = info[2];
    ctx.fillText(info[1].toUpperCase(), bx, by - size / 2 - 7 * z);
    ctx.restore();
  };

  // "Lights Out": inside a dark room that is still being fought over, only pools of light
  // around heroes (and their spells' glow) cut through
  DF.drawOverlay = function (ctx, R, gameState, localPlayerId) {
    const map = gameState && gameState.map;
    if (!map || !map.isDungeon || !map.rooms) return;
    const me = gameState.players && gameState.players.find(p => p.id === localPlayerId);
    if (!me) return;
    const cleared = R.dungeonClearedRooms || new Set();
    const idx = map.rooms.findIndex(r => r.event === 'darkness' && me.x >= r.x && me.x < r.x + r.w && me.y >= r.y && me.y < r.y + r.h);
    if (idx < 0 || cleared.has(idx)) { DF._dark = Math.max(0, (DF._dark || 0) - 0.05); if (!DF._dark) return; }
    else DF._dark = Math.min(1, (DF._dark || 0) + 0.04);
    const W = R.viewW, H = R.viewH, q = 0.25;
    if (!DF._darkCanvas) DF._darkCanvas = document.createElement('canvas');
    const c = DF._darkCanvas, lw = Math.ceil(W * q), lh = Math.ceil(H * q);
    if (c.width !== lw || c.height !== lh) { c.width = lw; c.height = lh; }
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, lw, lh);
    g.fillStyle = `rgba(2, 3, 8, ${0.93 * DF._dark})`;
    g.fillRect(0, 0, lw, lh);
    g.globalCompositeOperation = 'destination-out';
    const z = R.camera.zoom;
    for (const p of gameState.players || []) {
      if (p.isDead) continue;
      const s = W2S(R, p.x, p.y);
      const rad = (p.id === localPlayerId ? 3.4 : 2.2) * 32 * z * q;
      const flick = 1 + Math.sin(R.animations.time * 7 + p.x) * 0.03;
      const gr = g.createRadialGradient(s.x * q, (s.y - 10 * z) * q, 0, s.x * q, (s.y - 10 * z) * q, rad * flick);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, lw, lh);
    }
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(c, 0, 0, W, H);
    ctx.restore();
  };

  // ------------------------------------------------------------------ banners
  function banner(html, cls = '', ms = 0) {
    if (!DF.banner) {
      DF.banner = document.createElement('div');
      DF.banner.className = 'df-banner';
      document.body.appendChild(DF.banner);
    }
    DF.banner.className = 'df-banner show ' + cls;
    DF.banner.innerHTML = html;
    clearTimeout(DF.bannerTimer);
    if (ms) DF.bannerTimer = setTimeout(() => DF.banner && DF.banner.classList.remove('show'), ms);
  }
  function hideBanner() { if (DF.banner) DF.banner.classList.remove('show'); clearInterval(DF._gauntletTick); }

  // ------------------------------------------------------------------ boon pick
  let boonEl = null;
  function showBoonOffer(data) {
    if (!boonEl) {
      boonEl = document.createElement('div');
      boonEl.className = 'df-boon-offer';
      document.body.appendChild(boonEl);
    }
    const tierName = ['', 'Common', 'Rare', 'Epic'];
    boonEl.innerHTML = `
      <div class="df-boon-head"><span>CHOOSE A BOON</span>${data.pending > 1 ? `<em>+${data.pending - 1} more</em>` : ''}<small>Lasts until this run ends</small></div>
      <div class="df-boon-row">${data.choices.map(c => `
        <button type="button" class="df-boon tier-${c.tier}" data-id="${esc(c.id)}">
          <span class="df-boon-icon">${icon(c, 'df-pxi big')}</span>
          <span class="df-boon-name">${esc(c.name)}${c.have ? ` <b>${'I'.repeat(c.have + 1)}</b>` : ''}</span>
          <span class="df-boon-desc">${esc(c.desc)}</span>
          <span class="df-boon-tier">${tierName[c.tier] || ''}${c.have ? ' · upgrade' : ''}</span>
        </button>`).join('')}</div>`;
    boonEl.classList.add('show');
    boonEl.querySelectorAll('.df-boon').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      DF.socket.emit('dungeon_pick_boon', { offerId: data.offerId, boonId: b.dataset.id });
      boonEl.classList.remove('show');
      if (window.soundEngine) window.soundEngine.playUpgradeSuccess ? window.soundEngine.playUpgradeSuccess() : window.soundEngine.playCoin();
    }));
    if (window.soundEngine) window.soundEngine.playLevelUp();
  }
  function hideBoonOffer() { if (boonEl) boonEl.classList.remove('show'); }

  // ------------------------------------------------------------------ cursed shrine
  DF.openShrine = function (obs) {
    if (DF.shrineUsed.has(obs.id)) return;
    const curses = (DF.catalog && DF.catalog.curses) || [];
    const ov = document.createElement('div');
    ov.className = 'modal-overlay df-shrine-modal';
    ov.style.display = 'flex';
    ov.innerHTML = `
      <div class="hud-panel modal-card df-shrine-card">
        <div class="df-shrine-title">🕯️ CURSED SHRINE</div>
        <p>Take a random curse for the rest of this run. In return the shrine hands you a guaranteed piece of gear and a gold chest's worth of loot (held in your bag until the boss falls).</p>
        <div class="df-curse-list">${curses.map(c => `<span title="${esc(c.desc)}">${icon(c)} ${esc(c.name)}<small>${esc(c.desc)}</small></span>`).join('')}</div>
        <div class="df-shrine-actions">
          <button type="button" class="btn-primary df-shrine-yes">ACCEPT THE CURSE</button>
          <button type="button" class="btn-secondary df-shrine-no">WALK AWAY</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('.df-shrine-yes').addEventListener('click', () => { DF.socket.emit('dungeon_shrine_accept', { id: obs.id }); ov.remove(); });
    ov.querySelector('.df-shrine-no').addEventListener('click', () => ov.remove());
  };

  // ------------------------------------------------------------------ socket events
  DF.bind = function (socket, deps) {
    DF.socket = socket;
    DF.deps = deps;
    const map = () => { const gs = deps.gameState(); return gs && gs.map; };

    socket.on('dungeon_boon_offer', showBoonOffer);

    socket.on('dungeon_tiles_changed', (d) => {
      const m = map();
      if (!m || !m.isDungeon || !d || !d.tiles) return;
      // floor <-> hazard swaps (lava trail, collapsing floor) are patched onto the cached
      // ground; anything touching walls or the void (a secret room opening) repaints it all
      const flatOnly = d.tiles.every(([x, y, t]) => m.tiles[y] && ![7, 8].includes(m.tiles[y][x]) && ![7, 8].includes(t));
      for (const [x, y, t] of d.tiles) if (m.tiles[y]) m.tiles[y][x] = t;
      const R = deps.renderer();
      if (!(flatOnly && R && R.patchGroundTiles && R.patchGroundTiles(m, d.tiles))) m._tilesVersion = (m._tilesVersion || 0) + 1;
    });

    socket.on('dungeon_doors_sealed', (d) => {
      const m = map();
      if (!m || !d) return;
      for (const id of d.doors || []) {
        const o = (m.obstacles || []).find(x => x.id === id);
        if (o) { o.sealed = true; o.choice = false; }
        const door = (m.doors || []).find(x => x.id === id);
        if (door) { door.sealed = true; door.choice = false; }
      }
      // the chosen door loses its sign (it opens a moment later)
      for (const o of m.obstacles || []) if (o.type === 'dungeon_door' && o.choice && d.chosen !== undefined) {
        const door = (m.doors || []).find(x => x.id === o.id);
        if (door && door.to === d.chosen) o.choice = false;
      }
      const R = deps.renderer();
      if (R) R.triggerScreenShake(5, 0.3);
      if (window.soundEngine) window.soundEngine.playExplosion();
    });

    socket.on('dungeon_secret_found', (d) => {
      const m = map();
      if (m) m.obstacles = (m.obstacles || []).filter(o => o.id !== d.crack);
      const R = deps.renderer();
      if (R) { R.addParticles(d.x, d.y, 'gold', 30); R.triggerScreenShake(6, 0.35); }
      if (window.soundEngine) window.soundEngine.playLevelUp();
      banner('✨ <b>SECRET ROOM</b> found!', 'is-gold', 3000);
    });

    socket.on('dungeon_event', (d) => {
      if (!d) return;
      const m = map();
      if (d.type === 'ward') {
        const o = m && (m.obstacles || []).find(x => x.id === 'dungeon_ward_' + d.room);
        if (o) { o.progress = d.progress; if (d.progress >= 1) o.charged = true; }
        if (d.progress >= 1) banner('🔮 <b>WARD CHARGED</b> - a gold chest appears', 'is-violet', 3000);
        else banner(`🔮 <b>HOLD THE WARD</b> ${Math.round(d.progress * 100)}%${d.holding ? '' : ' <em>- stand in the circle!</em>'}`, 'is-violet', 2500);
      } else if (d.type === 'gauntlet') {
        clearInterval(DF._gauntletTick);
        if (d.state === 'start') {
          const end = Date.now() + d.seconds * 1000;
          const draw = () => {
            const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
            banner(`⏱️ <b>ELITE GAUNTLET</b> <span class="df-timer ${left <= 10 ? 'is-low' : ''}">${left}s</span>`, 'is-gold');
            if (!left) clearInterval(DF._gauntletTick);
          };
          draw();
          DF._gauntletTick = setInterval(draw, 250);
        } else if (d.state === 'expired') {
          banner('⏱️ <b>TOO SLOW</b> - the prize is lost', 'is-red', 3000);
        } else if (d.state === 'end') {
          banner(d.won ? '⏱️ <b>GAUNTLET BEATEN</b> - gold chest!' : '⏱️ Gauntlet over', d.won ? 'is-gold' : '', 3000);
        }
      } else if (d.type === 'ambush') {
        const R = deps.renderer();
        if (R) R.triggerScreenShake(8, 0.4);
        banner('⚠️ <b>AMBUSH!</b>', 'is-red', 2200);
      }
    });

    socket.on('dungeon_shrine_result', (d) => {
      const gs = deps.gameState();
      const m = gs && gs.map;
      const o = m && (m.obstacles || []).find(x => x.type === 'dungeon_shrine' && (!d.id || x.id === d.id));
      if (o) DF.shrineUsed.add(o.id);
      const c = d && d.curse;
      banner(`${c ? `${esc(c.icon)} <b>CURSED: ${esc(c.name)}</b> (${esc(c.desc)})` : '🕯️ The shrine is sated'} · ${esc((d.loot || []).join(', '))}`, 'is-violet', 5000);
    });

    socket.on('dungeon_weekly', (d) => { DF.board = d; renderBoard(); });

    // the spring marks itself spent locally once we are healed by it
    socket.on('zone_change', (d) => {
      DF.shrineUsed.clear();
      hideBanner();
      hideBoonOffer();
      if (d && d.zone !== 'dungeon') hideBoonOffer();
    });
  };

  // springs look spent once this hero has stood in one (server heals once per hero)
  DF.noteHeroPosition = function (gameState, me) {
    const m = gameState && gameState.map;
    if (!m || !m.isDungeon || !me) return;
    for (const o of m.obstacles || []) {
      if (o.type === 'dungeon_spring' && !DF.shrineUsed.has(o.id) && Math.hypot(o.x - me.x, o.y - me.y) <= 1.8) DF.shrineUsed.add(o.id);
    }
  };

  // ------------------------------------------------------------------ dungeon portal: depth and weekly
  const selectedFloor = () => { const el = document.querySelector('.floor-node.selected'); return el ? parseInt(el.getAttribute('data-floor'), 10) || 1 : 1; };
  const selectedDiff = () => { const el = document.querySelector('.diff-card.selected'); return el ? el.getAttribute('data-diff') || 'normal' : 'normal'; };
  const maxDepth = (player, floor) => {
    const best = player && player.dungeonDepth ? player.dungeonDepth[String(floor)] : undefined;
    return Math.min((DF.catalog && DF.catalog.maxDepth) || 10, (best === undefined ? -1 : best) + 1);
  };

  DF.renderPortal = function (player) {
    const host = document.getElementById('dfPortalExtras');
    if (!host || !DF.catalog) return;
    const floor = selectedFloor();
    const top = maxDepth(player, floor);
    DF.depth = Math.max(0, Math.min(top, DF.depth));
    const step = DF.catalog.depthStep || { hp: 1.12, dmg: 1.08, reward: 1.15 };
    const pct = (v) => Math.round((v - 1) * 100 * DF.depth);
    const mods = (DF.catalog.weeklyMods || []);
    host.innerHTML = `
      <div class="portal-pick-row">
        <div class="portal-pick">
          <div class="portal-section-label">DEPTH <span class="dmod-reward ${DF.depth ? 'active' : ''}">${DF.depth ? `+${pct(step.reward)}% rewards` : 'clear a depth to unlock the next'}</span></div>
          <div class="df-depth">
            <button type="button" class="df-depth-btn" data-d="-1" ${DF.depth <= 0 ? 'disabled' : ''}>−</button>
            <div class="df-depth-val"><b>+${DF.depth}</b><span>${DF.depth ? `HP +${pct(step.hp)}% · DMG +${pct(step.dmg)}%` : 'Base difficulty'}</span></div>
            <button type="button" class="df-depth-btn" data-d="1" ${DF.depth >= top ? 'disabled' : ''} title="${DF.depth >= top ? 'Clear this depth on this floor to unlock the next' : ''}">+</button>
          </div>
          <div class="df-depth-note">Unlocked on B${floor}: up to +${top}</div>
        </div>
        <div class="portal-pick">
          <div class="portal-section-label">WEEKLY CHALLENGE <span class="dmod-reward">${esc(DF.catalog.week || '')}</span></div>
          <button type="button" class="df-weekly-toggle ${DF.weekly ? 'on' : ''}" id="dfWeeklyToggle">
            <b>${DF.weekly ? '✔ WEEKLY SEED ON' : 'WEEKLY SEED OFF'}</b>
            <span>Same layout for everyone · Labyrinth · ${mods.map(id => esc(id)).join(' + ') || 'fixed modifiers'}</span>
          </button>
        </div>
      </div>
      <div class="df-weekly-board" id="dfWeeklyBoard"></div>`;
    host.querySelectorAll('.df-depth-btn').forEach(b => b.addEventListener('click', () => {
      DF.depth = Math.max(0, Math.min(top, DF.depth + parseInt(b.dataset.d, 10)));
      store.set('slop_dungeon_depth', DF.depth);
      DF.renderPortal(player);
      if (window.soundEngine) window.soundEngine.playCoin();
    }));
    host.querySelector('#dfWeeklyToggle').addEventListener('click', () => {
      DF.weekly = !DF.weekly;
      store.set('slop_dungeon_weekly', DF.weekly);
      DF.renderPortal(player);
      if (window.soundEngine) window.soundEngine.playCoin();
    });
    // the weekly run fixes the mode and the modifiers
    document.querySelectorAll('.mode-card, .dmod-chip').forEach(el => el.classList.toggle('df-locked', DF.weekly));
    renderBoard();
    if (DF.weekly && DF.socket) DF.socket.emit('dungeon_weekly_get', { floor, difficulty: selectedDiff() });
  };

  function renderBoard() {
    const el = document.getElementById('dfWeeklyBoard');
    if (!el) return;
    if (!DF.weekly) { el.innerHTML = ''; return; }
    const b = DF.board;
    const floor = selectedFloor(), diff = selectedDiff();
    if (!b || b.floor !== floor || b.difficulty !== diff) { el.innerHTML = '<div class="df-board-empty">Loading this week\'s board…</div>'; return; }
    const fmt = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    el.innerHTML = `<div class="df-board-title">🏆 ${esc(b.week)} · B${floor} ${esc(diff.toUpperCase())}</div>` + (b.entries.length
      ? `<ol>${b.entries.slice(0, 10).map(e => `<li><span class="rank-${esc(e.rank)}">${esc(e.rank)}</span><b>${esc(e.name)}</b><em>${fmt(e.timeMs)}</em><small>${e.party && e.party.length > 1 ? `party of ${e.party.length}` : esc(e.cls || '')}</small></li>`).join('')}</ol>`
      : '<div class="df-board-empty">No clears yet this week. Be the first!</div>');
  }

  DF.portalChoice = () => ({ weekly: DF.weekly, depth: DF.depth });

  // ------------------------------------------------------------------ run panel and result
  DF.runPanelHtml = function (st) {
    const parts = [];
    const tags = [];
    if (st.depth) tags.push(`<span class="df-tag depth">DEPTH +${st.depth}</span>`);
    if (st.weekly) tags.push(`<span class="df-tag weekly">WEEKLY ${esc(st.weekly)}</span>`);
    if (tags.length) parts.push(`<div class="df-tags">${tags.join('')}</div>`);
    const boons = st.boons || [], curses = st.curses || [];
    if (boons.length || curses.length) {
      parts.push(`<div class="df-run-boons">${boons.map(b => `<span class="tier-${b.tier}" title="${esc(b.name)}: ${esc(b.desc)}">${icon(b)}${b.stacks > 1 ? `<b>${b.stacks}</b>` : ''}</span>`).join('')}${curses.map(c => `<span class="is-curse" title="${esc(c.name)}: ${esc(c.desc)}">${icon(c)}</span>`).join('')}</div>`);
    }
    for (const e of st.events || []) {
      if (e.type === 'ward') parts.push(`<div class="df-run-event">🔮 Ward <div class="df-mini-bar"><i style="width:${Math.round(e.progress * 100)}%"></i></div></div>`);
      if (e.type === 'gauntlet') parts.push(`<div class="df-run-event">⏱️ Gauntlet ${e.expired ? '<em>prize lost</em>' : `${e.left}s left`}</div>`);
    }
    return parts.join('');
  };

  DF.resultHtml = function (data) {
    const out = [];
    if (data.depth || data.depthUnlocked) {
      out.push(`<div class="dr-reward-row"><span>Depth</span><b>+${data.depth || 0}${data.depthUnlocked ? ` · <span class="df-unlock">+${data.depthUnlocked} unlocked!</span>` : ''}</b></div>`);
    }
    if (data.weekly) out.push(`<div class="dr-reward-row"><span>Weekly ${esc(data.weekly.week)}</span><b>#${data.weekly.placement} on the board</b></div>`);
    if (data.boons && data.boons.length) {
      out.push(`<div class="df-result-boons"><span>Boons this run</span>${data.boons.map(b => `<i class="tier-${b.tier}" title="${esc(b.name)}: ${esc(b.desc)}">${icon(b)} ${esc(b.name)}${b.stacks > 1 ? ' ' + 'I'.repeat(b.stacks) : ''}</i>`).join('')}</div>`);
    }
    if (data.curses && data.curses.length) out.push(`<div class="df-result-boons is-curse"><span>Curses</span>${data.curses.map(c => `<i>${icon(c)} ${esc(c.name)}</i>`).join('')}</div>`);
    return out.join('');
  };

  // ------------------------------------------------------------------ interaction (shrine)
  DF.nearShrine = function (gameState, me, range = 2.2) {
    const m = gameState && gameState.map;
    if (!m || !m.isDungeon || !me) return null;
    return (m.obstacles || []).find(o => o.type === 'dungeon_shrine' && !DF.shrineUsed.has(o.id) && Math.hypot(o.x - me.x, o.y - me.y) <= range) || null;
  };

  window.DungeonFeatures = DF;
})();
