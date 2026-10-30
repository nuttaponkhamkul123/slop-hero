// Eternal Rift client: wave HUD, the build bar and placement ghost, the
// checkpoint "continue or leave" prompt, run results, the town gate dialog and
// James the Gatekeeper's forge. game.js wires it up with RiftUI.init(...).
(function () {
  const STRUCT_TYPES = { turret: 'rift_turret', frost: 'rift_frost', barrier: 'rift_barrier', totem: 'rift_totem' };
  const ESSENCE_ID = 'rift_essence';

  let ctx = null;          // { socket, renderer, canvas, getPlayer, getPlayerId, getState }
  let catalog = { structures: {}, recipes: [], maxWaves: 30, checkpointEvery: 5, buildReach: 7 };
  let inRift = false;
  let state = null;        // last rift_state from the server
  let placing = null;      // structure kind being placed
  let mouseWorld = null;
  let choiceTimer = null;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name) => (window.PixelIcons ? window.PixelIcons.html(name) : '');
  const fmt = (n) => Math.round(n || 0).toLocaleString();
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };

  // ---------------------------------------------------------------- HUD
  const hud = el('div', 'rift-hud hud-panel');
  hud.style.display = 'none';
  const buildBar = el('div', 'rift-build hud-panel');
  buildBar.style.display = 'none';
  const banner = el('div', 'rift-banner');
  banner.style.display = 'none';

  function myId() { return ctx && ctx.getPlayerId(); }
  function myPoints() { return (state && state.points && state.points[myId()]) || 0; }
  function myBank() { return (state && state.banked && state.banked[myId()]) || { gold: 0, essence: 0 }; }

  function phaseLine(s) {
    switch (s.phase) {
      case 'prep': return `Prepare your defences - wave 1 in <b>${s.timer}s</b>`;
      case 'break': return `Wave ${s.upcoming} in <b>${s.timer}s</b> - build now!`;
      case 'wave': return `<b>${s.remaining}</b> monster${s.remaining === 1 ? '' : 's'} left`;
      case 'choice': return `Checkpoint! Continue or leave (<b>${s.timer}s</b>)`;
      case 'victory': return '<b class="rift-good">VICTORY</b> - the fountain stands!';
      case 'defeat': return '<b class="rift-bad">THE HOLY FOUNTAIN HAS FALLEN</b>';
      default: return '';
    }
  }

  function renderHud() {
    if (!state) return;
    const s = state;
    const f = s.fountain || { hp: 0, maxHp: 1 };
    const pct = Math.max(0, Math.min(100, (f.hp / (f.maxHp || 1)) * 100));
    const bank = myBank();
    const nextCp = Math.min(s.maxWaves, Math.ceil(Math.max(1, s.upcoming) / s.checkpointEvery) * s.checkpointEvery);
    hud.innerHTML = `
      <div class="rift-hud-top">
        <span class="rift-title">${icon('whirl')} ETERNAL RIFT</span>
        <span class="rift-wave">WAVE ${Math.max(1, s.upcoming)}/${s.maxWaves}</span>
        <span class="rift-lv">Lv. ${s.level}</span>
      </div>
      <div class="rift-phase">${phaseLine(s)}</div>
      <div class="rift-fountain">
        <span class="rift-fountain-label">${icon('star')} HOLY FOUNTAIN</span>
        <div class="rift-bar"><div class="rift-bar-fill ${pct < 30 ? 'is-low' : ''}" style="width:${pct}%"></div>
          <span class="rift-bar-text">${fmt(f.hp)} / ${fmt(f.maxHp)}</span></div>
      </div>
      <div class="rift-bank" title="Paid out only when you leave at a checkpoint or clear wave ${s.maxWaves}. Lost if the fountain falls or you leave mid-wave.">
        ${icon('essence')} Banked: <b>${bank.essence}</b> essence · <b>${fmt(bank.gold)}</b> gold
        <span class="rift-dim">· next checkpoint: wave ${nextCp}</span>
      </div>`;
  }

  function renderBuildBar() {
    if (!state) return;
    const pts = myPoints();
    const counts = {};
    for (const st of state.structures || []) counts[st.kind] = (counts[st.kind] || 0) + 1;
    const over = state.phase === 'victory' || state.phase === 'defeat';
    let html = `<div class="rift-build-head"><span>${icon('hammer')} BUILD</span><span class="rift-points">${fmt(pts)} RP</span></div>`;
    for (const [kind, def] of Object.entries(catalog.structures || {})) {
      const n = counts[kind] || 0;
      const full = def.max && n >= def.max;
      const off = over || pts < def.cost || full;
      html += `<button type="button" class="rift-build-btn ${placing === kind ? 'is-placing' : ''}" data-kind="${kind}" ${off ? 'disabled' : ''} title="${esc(def.desc)}">
        <span class="rift-build-icon">${icon(def.icon)}</span>
        <span class="rift-build-name">${esc(def.name)}${def.max ? ` <span class="rift-dim">${n}/${def.max}</span>` : ''}</span>
        <span class="rift-build-cost">${def.cost}</span>
      </button>`;
    }
    html += `<div class="rift-build-hint">${placing ? 'Click the ground to place · Right click / Esc to cancel' : 'Kill monsters to earn Rift Points (RP). They vanish when you leave.'}</div>
      <button type="button" class="rift-leave-btn">${icon('castle')} LEAVE RIFT</button>`;
    buildBar.innerHTML = html;
  }

  buildBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.rift-build-btn');
    if (btn && !btn.disabled) {
      const kind = btn.dataset.kind;
      const def = catalog.structures[kind];
      if (def && def.instant) {
        ctx.socket.emit('rift_build', { kind });
        placing = null;
      } else {
        placing = placing === kind ? null : kind;
      }
      renderBuildBar();
      return;
    }
    if (e.target.closest('.rift-leave-btn')) confirmLeave();
  });
  // clicks on the panels never reach the canvas underneath
  for (const p of [hud, buildBar]) p.addEventListener('mousedown', (e) => e.stopPropagation());

  // Structures and the fountain's HP ride on the map's obstacle list so the
  // renderer depth-sorts them with everything else
  function syncObstacles() {
    const gs = ctx && ctx.getState();
    const map = gs && gs.map;
    if (!map || !map.isRift || !state) return;
    const kept = (map.obstacles || []).filter(o => !o.riftStructure);
    const fountain = kept.find(o => o.type === 'holy_fountain');
    if (fountain) { fountain.hp = state.fountain.hp; fountain.maxHp = state.fountain.maxHp; }
    for (const s of state.structures || []) {
      kept.push({ id: s.id, type: STRUCT_TYPES[s.kind], x: s.x, y: s.y, hp: s.hp, maxHp: s.maxHp, riftStructure: true, collidable: false });
    }
    map.obstacles = kept;
  }

  function showBanner(title, sub, cls) {
    banner.className = `rift-banner ${cls || ''}`;
    banner.innerHTML = `<div class="rift-banner-title">${title}</div>${sub ? `<div class="rift-banner-sub">${sub}</div>` : ''}`;
    banner.style.display = 'block';
    banner.style.animation = 'none';
    void banner.offsetWidth;
    banner.style.animation = '';
    clearTimeout(showBanner.t);
    showBanner.t = setTimeout(() => { banner.style.display = 'none'; }, 2800);
  }

  // ---------------------------------------------------------------- checkpoint prompt
  let choiceOverlay = null;
  function closeChoice() {
    if (choiceOverlay) choiceOverlay.remove();
    choiceOverlay = null;
    clearInterval(choiceTimer);
  }
  function openChoice(data) {
    closeChoice();
    const ends = performance.now() + (data.seconds || 10) * 1000;
    const bank = myBank();
    choiceOverlay = el('div', 'rift-choice-overlay');
    choiceOverlay.innerHTML = `
      <div class="rift-choice-card modal-card">
        <div class="rift-choice-title">WAVE ${data.wave} CLEARED</div>
        <div class="rift-choice-sub">Checkpoint reached. Leave now to keep what you banked, or push on for more.</div>
        <div class="rift-choice-bank">${icon('essence')} <b>${bank.essence}</b> Rift Essence · ${icon('coin')} <b>${fmt(bank.gold)}</b> gold</div>
        <div class="rift-choice-warn">If you continue and the fountain falls, you lose all of it.</div>
        <div class="rift-choice-timer"><div class="rift-choice-timer-fill"></div><span class="rift-choice-secs"></span></div>
        <div class="rift-choice-actions">
          <button type="button" class="btn-primary rift-choice-go">CONTINUE TO WAVE ${data.wave + 1} <span class="rift-dim">(Lv. ${data.nextLevel})</span></button>
          <button type="button" class="btn-secondary rift-choice-leave">${icon('castle')} LEAVE WITH REWARDS</button>
        </div>
        <div class="rift-choice-note">No answer when the timer runs out = continue.</div>
      </div>`;
    const fill = choiceOverlay.querySelector('.rift-choice-timer-fill');
    const secs = choiceOverlay.querySelector('.rift-choice-secs');
    const tick = () => {
      const left = Math.max(0, ends - performance.now());
      fill.style.width = `${(left / ((data.seconds || 10) * 1000)) * 100}%`;
      secs.textContent = `${Math.ceil(left / 1000)}s`;
      if (left <= 0) closeChoice();
    };
    tick();
    choiceTimer = setInterval(tick, 100);
    choiceOverlay.querySelector('.rift-choice-go').addEventListener('click', (e) => {
      ctx.socket.emit('rift_choice', { choice: 'continue' });
      e.currentTarget.disabled = true;
      e.currentTarget.textContent = 'READY - WAITING FOR PARTY...';
    });
    choiceOverlay.querySelector('.rift-choice-leave').addEventListener('click', () => {
      ctx.socket.emit('rift_choice', { choice: 'leave' });
      closeChoice();
    });
    choiceOverlay.addEventListener('mousedown', (e) => e.stopPropagation());
    document.body.appendChild(choiceOverlay);
  }

  // ---------------------------------------------------------------- leaving
  function confirmLeave() {
    if (!state || state.phase === 'choice' || state.phase === 'victory' || state.phase === 'defeat') {
      ctx.socket.emit(state && state.phase === 'choice' ? 'rift_choice' : 'leave_dungeon', { choice: 'leave' });
      return;
    }
    if (document.querySelector('.leave-confirm-overlay')) return;
    const bank = myBank();
    const overlay = el('div', 'dungeon-result-overlay leave-confirm-overlay is-failed');
    overlay.innerHTML = `
      <div class="dungeon-result-card hud-panel">
        <div class="dungeon-result-title">LEAVE THE RIFT?</div>
        <div class="dungeon-result-sub">Leaving mid-wave forfeits your banked reward${bank.essence || bank.gold ? ` (<b>${bank.essence}</b> essence, <b>${fmt(bank.gold)}</b> gold)` : ''} and all your Rift Points. Leave at a checkpoint prompt to keep it.</div>
        <div class="leave-confirm-actions">
          <button class="btn-secondary leave-confirm-stay">STAY</button>
          <button class="btn-primary leave-confirm-go">LEAVE ANYWAY</button>
        </div>
      </div>`;
    const onKey = (e) => { e.stopPropagation(); if (e.key === 'Escape') close(); };
    const close = () => { overlay.remove(); window.removeEventListener('keydown', onKey, true); };
    overlay.querySelector('.leave-confirm-stay').addEventListener('click', close);
    overlay.querySelector('.leave-confirm-go').addEventListener('click', () => { close(); ctx.socket.emit('leave_dungeon'); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
  }

  function showResult(data) {
    closeChoice();
    const won = !!data.success;
    const title = data.victory ? 'RIFT CONQUERED' : data.left && won ? 'RETURNED SAFELY' : data.left ? 'RIFT ABANDONED' : 'FOUNTAIN FALLEN';
    const sub = data.victory ? `All ${catalog.maxWaves} waves held. The Holy Fountain stands!`
      : won ? `You left after wave ${data.wave} with everything you banked.`
        : data.left ? `You left mid-wave ${data.wave}. The banked reward was forfeited.`
          : `The Holy Fountain fell during wave ${data.wave}. The banked reward is lost.`;
    const overlay = el('div', `dungeon-result-overlay ${won ? 'is-success' : 'is-failed'}`);
    overlay.innerHTML = `
      <div class="dungeon-result-card hud-panel">
        <div class="dungeon-result-title">${title}</div>
        <div class="dungeon-result-sub">${sub}</div>
        <div class="rift-result-loot ${won ? '' : 'is-lost'}">
          <span>${icon('essence')} ${data.essence || 0} Rift Essence</span>
          <span>${icon('coin')} ${fmt(data.gold)} Gold</span>
        </div>
        <div class="leave-confirm-actions"><button class="btn-primary rift-result-ok">OK</button></div>
      </div>`;
    const close = () => overlay.remove();
    overlay.querySelector('.rift-result-ok').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    if (window.soundEngine) (won ? window.soundEngine.playLevelUp : window.soundEngine.playUpgradeFail).call(window.soundEngine);
  }

  // ---------------------------------------------------------------- town gate dialog
  function openPortal(info) {
    info = info || {};
    closeModal('riftPortalModal');
    const party = info.partyRun;
    const overlay = el('div', 'modal-overlay rift-modal');
    overlay.id = 'riftPortalModal';
    overlay.innerHTML = `
      <div class="hud-panel modal-card rift-modal-card">
        <button class="modal-close">✕</button>
        <div class="modal-header">
          <h2 class="modal-title rift-modal-title">THE ETERNAL RIFT</h2>
          <p class="modal-subtitle">Hold the Holy Fountain against endless waves</p>
        </div>
        <ul class="rift-rules">
          <li>${icon('whirl')} Monsters pour out of four rift gates and march on the <b>Holy Fountain</b> in the middle.</li>
          <li>${icon('skull')} Every wave they grow <b>one level stronger</b>. ${catalog.maxWaves} waves in all, with a boss at the end.</li>
          <li>${icon('hammer')} Kills earn <b>Rift Points</b>. Spend them on turrets, barriers and blessings. They vanish when you leave.</li>
          <li>${icon('essence')} Every ${catalog.checkpointEvery} waves you bank <b>Rift Essence</b> and a little gold, then choose: leave with it, or push on.</li>
          <li>${icon('heart')} Fallen heroes rise at the fountain. If the <b>fountain falls</b>, the banked reward is lost.</li>
        </ul>
        ${party ? `<div class="rift-party-note">${icon('crown')} Your party is already inside (wave ${Math.max(1, party.wave)}). Entering joins them.</div>`
          : info.inParty ? `<div class="rift-party-note">${icon('crown')} Your party shares one rift. Summon them to fight together.</div>` : ''}
        <div class="portal-actions">
          <button class="btn-primary btn-enter-portal rift-enter">${icon('whirl')} ${party ? 'JOIN YOUR PARTY' : 'ENTER THE RIFT'}</button>
          ${info.inParty && !party ? `<button class="btn-primary btn-enter-portal btn-enter-with-party rift-enter-party">📣 ENTER &amp; SUMMON PARTY</button>` : ''}
        </div>
      </div>`;
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('.rift-enter').addEventListener('click', () => { ctx.socket.emit('enter_rift', {}); overlay.remove(); });
    const withParty = overlay.querySelector('.rift-enter-party');
    if (withParty) withParty.addEventListener('click', () => { ctx.socket.emit('enter_rift', { inviteParty: true }); overlay.remove(); });
    document.body.appendChild(overlay);
  }

  function closeModal(id) {
    const old = document.getElementById(id);
    if (old) old.remove();
  }

  // ---------------------------------------------------------------- James the Gatekeeper
  function countItem(p, id) {
    const items = (p && p.inventory && p.inventory.items) || [];
    return items.reduce((n, it) => n + (it && it.id === id ? (it.count || 1) : 0), 0);
  }

  function renderForge(overlay) {
    const p = ctx.getPlayer();
    const essence = countItem(p, ESSENCE_ID);
    const fragments = countItem(p, 'spirit_fragment');
    const gold = (p && p.gold) || 0;
    const list = overlay.querySelector('.james-list');
    overlay.querySelector('.james-wallet').innerHTML =
      `${icon('essence')} <b>${essence}</b> Rift Essence · ${icon('coin')} <b>${fmt(gold)}</b> gold · ${icon('fragment')} <b>${fragments}</b> Spirit Fragments`;
    list.innerHTML = '';
    for (const r of catalog.recipes || []) {
      const it = r.item;
      if (!it) continue;
      const cls = it.cls ? it.cls.charAt(0).toUpperCase() + it.cls.slice(1) : 'Any class';
      const ok = essence >= r.essence && gold >= r.gold && fragments >= (r.fragments || 0);
      const cost = (have, need, label, iconName) => `<span class="james-cost ${have >= need ? 'is-met' : 'is-short'}">${icon(iconName)} ${fmt(need)} ${label}</span>`;
      const card = el('div', 'james-card hud-panel', `
        <div class="james-card-icon">${window.PixelIcons ? window.PixelIcons.html(window.PixelIcons.item(it), 'james-pxi') : ''}</div>
        <div class="james-card-body">
          <div class="james-card-name">${esc(it.name)} <span class="james-slot">${esc(it.slot)} · ${esc(cls)}</span></div>
          <div class="james-card-desc">${esc(it.desc)}</div>
          <div class="james-card-costs">
            ${cost(essence, r.essence, 'Essence', 'essence')}
            ${cost(gold, r.gold, 'Gold', 'coin')}
            ${r.fragments ? cost(fragments, r.fragments, 'Fragments', 'fragment') : ''}
          </div>
        </div>
        <button type="button" class="btn-primary james-forge-btn" data-item="${esc(r.itemId)}" ${ok ? '' : 'disabled'}>FORGE</button>`);
      list.appendChild(card);
    }
  }

  function openForge() {
    closeModal('jamesForgeModal');
    const overlay = el('div', 'modal-overlay rift-modal');
    overlay.id = 'jamesForgeModal';
    overlay.innerHTML = `
      <div class="hud-panel modal-card rift-modal-card james-modal-card">
        <button class="modal-close">✕</button>
        <div class="modal-header">
          <h2 class="modal-title rift-modal-title">JAMES THE GATEKEEPER</h2>
          <p class="modal-subtitle">"Bring me the light of the Rift, and I'll forge you something the realm has never seen."</p>
        </div>
        <div class="james-wallet"></div>
        <div class="james-list"></div>
      </div>`;
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) return overlay.remove();
      const btn = e.target.closest('.james-forge-btn');
      if (btn && !btn.disabled) {
        btn.disabled = true;
        ctx.socket.emit('james_forge', { itemId: btn.dataset.item });
      }
    });
    document.body.appendChild(overlay);
    renderForge(overlay);
  }

  // ---------------------------------------------------------------- placement
  function placementValid(kind, x, y) {
    const p = ctx.getPlayer();
    if (!p) return false;
    if (Math.hypot(x - p.x, y - p.y) > (catalog.buildReach || 7)) return false;
    const def = catalog.structures[kind];
    if (Math.hypot(x - 20, y - 20) < 1.4 + def.radius + 0.8) return false;
    for (const s of (state && state.structures) || []) {
      const sd = catalog.structures[s.kind];
      if (Math.hypot(s.x - x, s.y - y) < (sd ? sd.radius : 0.6) + def.radius + 0.1) return false;
    }
    const map = ctx.getState().map;
    const row = map && map.tiles[Math.floor(y)];
    const tile = row && row[Math.floor(x)];
    return tile !== undefined && tile !== 7 && tile !== 8;
  }

  function handleClick(worldPos, button) {
    if (!inRift || !placing) return false;
    if (button === 2) {
      placing = null;
      renderBuildBar();
      return true;
    }
    ctx.socket.emit('rift_build', { kind: placing, x: worldPos.x, y: worldPos.y });
    placing = null;
    renderBuildBar();
    return true;
  }

  function drawOverlay(c2d, R) {
    if (!inRift || !placing || !mouseWorld) return;
    const p = ctx.getPlayer();
    const def = catalog.structures[placing];
    if (!p || !def) return;
    const ok = placementValid(placing, mouseWorld.x, mouseWorld.y);
    c2d.save();
    c2d.setLineDash([6, 6]);
    c2d.lineWidth = 2;
    c2d.strokeStyle = 'rgba(250, 204, 21, 0.45)';
    R.spGroundPath(c2d, p.x, p.y, catalog.buildReach || 7);
    c2d.stroke();
    if (def.range) {
      c2d.strokeStyle = ok ? 'rgba(125, 211, 252, 0.7)' : 'rgba(248, 113, 113, 0.7)';
      R.spGroundPath(c2d, mouseWorld.x, mouseWorld.y, def.range);
      c2d.stroke();
    }
    c2d.setLineDash([]);
    c2d.globalAlpha = 0.6;
    if (!ok) c2d.filter = 'sepia(1) saturate(6) hue-rotate(-50deg)';
    const screen = Isometric.worldToScreen(mouseWorld.x, mouseWorld.y, 0, R.camera, R.viewW, R.viewH);
    R.drawRiftProp(c2d, { type: STRUCT_TYPES[placing], x: mouseWorld.x, y: mouseWorld.y, ghost: true }, screen, R.camera.zoom);
    c2d.restore();
  }

  // ---------------------------------------------------------------- zone changes
  function onZoneChange(data) {
    const nowRift = !!(data && data.rift && data.map && data.map.isRift);
    if (!nowRift) {
      inRift = false;
      state = null;
      placing = null;
      hud.style.display = 'none';
      buildBar.style.display = 'none';
      closeChoice();
      return;
    }
    inRift = true;
    hud.style.display = 'block';
    buildBar.style.display = 'flex';
  }

  function init(c) {
    ctx = c;
    document.body.appendChild(hud);
    document.body.appendChild(buildBar);
    document.body.appendChild(banner);
    const s = c.socket;

    s.on('rift_state', (data) => {
      if (!inRift) return;
      const prevPhase = state && state.phase;
      state = data;
      renderHud();
      renderBuildBar();
      syncObstacles();
      if (prevPhase === 'choice' && data.phase !== 'choice') closeChoice();
    });
    s.on('rift_wave', (d) => {
      const sub = `Lv. ${d.level} · ${d.count} monsters${d.boss ? ' · THE ETERNAL DEVOURER APPROACHES' : d.elite ? ' · a Rift Warden leads them' : ''}`;
      showBanner(d.boss ? `FINAL WAVE ${d.wave}` : `WAVE ${d.wave}`, sub, d.boss ? 'is-boss' : d.elite ? 'is-elite' : '');
      if (window.soundEngine && window.soundEngine.playSkillWhoosh) window.soundEngine.playSkillWhoosh();
    });
    s.on('rift_wave_cleared', (d) => {
      const extra = d.reward ? ` · banked +${d.reward.essence} essence, +${fmt(d.reward.gold)} gold` : '';
      showBanner(`WAVE ${d.wave} CLEARED`, `+${d.bonus} RP to everyone${extra}`, 'is-clear');
      if (window.soundEngine && window.soundEngine.playCoin) window.soundEngine.playCoin();
    });
    s.on('rift_checkpoint', openChoice);
    s.on('rift_result', showResult);
    s.on('open_rift_portal_modal', openPortal);
    s.on('james_forge_result', () => {
      // player_updated arrives first; redraw the forge with the new wallet
      const overlay = document.getElementById('jamesForgeModal');
      if (overlay) setTimeout(() => renderForge(overlay), 0);
      if (window.soundEngine && window.soundEngine.playLevelUp) window.soundEngine.playLevelUp();
    });

    c.canvas.addEventListener('mousemove', (e) => {
      if (!inRift || !placing) return;
      const rect = c.canvas.getBoundingClientRect();
      mouseWorld = Isometric.screenToWorld(e.clientX - rect.left, e.clientY - rect.top, c.renderer.camera, c.renderer.viewW, c.renderer.viewH);
    });
    window.addEventListener('keydown', (e) => {
      if (placing && e.key === 'Escape') {
        e.stopPropagation();
        placing = null;
        renderBuildBar();
      }
    }, true);
  }

  window.RiftUI = {
    init,
    setCatalog: (cat) => { if (cat) catalog = cat; },
    onZoneChange,
    active: () => inRift,
    handleClick,
    drawOverlay,
    openPortal,
    openForge,
    confirmLeave
  };
})();
