// Slop Hero - Crafting window. Recipes come from the server (crafting.ts,
// sent with the join data); this lists them by category, shows what each one
// needs against what the hero carries, and sends 'craft' requests.
(function () {
  'use strict';

  let socket = null, getPlayer = () => null;
  let catalog = { categories: [], recipes: [] };
  let tab = null, selected = null, result = null;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const RARITY = { common: '#e2e8f0', uncommon: '#4ade80', rare: '#38bdf8', epic: '#c084fc', legendary: '#f59e0b' };
  const icon = (item) => (window.PixelIcons ? window.PixelIcons.itemHtml(item) : esc(item.icon || ''));

  // how many of an item id the hero has (stackables; potions live in counters)
  function have(p, id) {
    if (!p || !p.inventory) return 0;
    if (id === 'health_potion') return p.inventory.healthPotions || 0;
    if (id === 'mana_potion') return p.inventory.manaPotions || 0;
    return (p.inventory.items || []).reduce((t, it) => t + (it && it.id === id && it.type !== 'equipment' ? (it.count || 1) : 0), 0);
  }
  // how many times the recipe can be made right now
  function craftable(p, r) {
    if (!p || (p.level || 1) < r.levelReq) return 0;
    let n = r.gold > 0 ? Math.floor((p.gold || 0) / r.gold) : 99;
    for (const i of r.inputs) n = Math.min(n, Math.floor(have(p, i.id) / i.n));
    return Math.max(0, n);
  }
  const canHere = (p) => p && (p.zone === 'town' || p.zone === 'plot');

  function render() {
    const modal = $('craftingModal');
    const p = getPlayer();
    if (!modal || modal.style.display === 'none' || !p) return;
    $('craftGold').textContent = (p.gold || 0).toLocaleString();
    $('craftWhere').innerHTML = canHere(p) ? '<span style="color:#4ade80">✔ You can craft here</span>' : '<span style="color:#fca5a5">✖ Go to town (or your plot) to craft</span>';

    const cats = catalog.categories.filter(c => catalog.recipes.some(r => r.category === c.id));
    if (!cats.some(c => c.id === tab)) tab = cats[0] ? cats[0].id : null;
    $('craftTabs').innerHTML = cats.map(c => `<button class="ench-tab ${c.id === tab ? 'active' : ''}" data-cat="${c.id}">${esc(c.icon)} ${esc(c.name.toUpperCase())}</button>`).join('');
    $('craftTabs').querySelectorAll('.ench-tab').forEach(b => b.addEventListener('click', () => { tab = b.dataset.cat; selected = null; result = null; render(); }));

    const list = $('craftList'), detail = $('craftDetail');
    // ready-to-craft recipes first, then by level
    const recipes = catalog.recipes.filter(r => r.category === tab)
      .sort((a, b) => (craftable(p, b) > 0) - (craftable(p, a) > 0) || a.levelReq - b.levelReq || a.name.localeCompare(b.name));
    if (!recipes.some(r => r.id === selected)) selected = recipes[0] ? recipes[0].id : null;
    list.innerHTML = '';
    if (!recipes.length) { list.innerHTML = '<div class="ench-empty">No recipes here yet.</div>'; detail.innerHTML = ''; return; }
    for (const r of recipes) {
      const n = craftable(p, r);
      const row = document.createElement('div');
      row.className = `ench-row rarity-${r.output.rarity || 'common'} ${r.id === selected ? 'selected' : ''}`;
      row.innerHTML = `${icon(r.output)}<span class="ench-row-name" style="color:${RARITY[r.output.rarity] || '#e2e8f0'}">${esc(r.name)}<small>Lv. ${r.levelReq}${r.output.slot ? ' - ' + esc(r.output.slot) : ''}</small></span>`
        + `<span class="ench-row-lvl" style="color:${n > 0 ? '#a7f070' : '#566c86'}">${n > 0 ? '✔' : '·'}</span>`;
      if (window.GameTooltip) window.GameTooltip.item(row, r.output);
      row.addEventListener('click', () => { selected = r.id; result = null; render(); });
      list.appendChild(row);
    }

    const r = recipes.find(x => x.id === selected);
    if (!r) return;
    const n = craftable(p, r);
    const lvlOk = (p.level || 1) >= r.levelReq;
    const inputs = r.inputs.map(i => {
      const h = have(p, i.id);
      return `<div class="craft-input ${h >= i.n ? '' : 'short'}">${icon(i)}<span>${esc(i.name)}</span><b>${h} / ${i.n}</b></div>`;
    }).join('');
    const stack = !r.output.gear;
    detail.innerHTML = `
      <div class="ench-detail-head">${icon(r.output)}<div>
        <div class="ench-detail-name" style="color:${RARITY[r.output.rarity] || '#e2e8f0'}">${esc(r.name)}${r.output.n > 1 ? ` x${r.output.n}` : ''}</div>
        <div class="tip-type">${esc((r.output.rarity || 'common').toUpperCase())} ${esc((r.output.slot || r.output.type || '').toUpperCase())}${r.output.gear ? ' - stats rolled at your level' : ''}</div>
      </div></div>
      ${r.output.desc ? `<div class="tip-flavour">${esc(r.output.desc)}</div>` : ''}
      <div class="craft-inputs">${inputs}</div>
      <div class="ench-cost">
        ${r.gold ? `<span class="${(p.gold || 0) >= r.gold ? '' : 'short'}">${r.gold.toLocaleString()} Gold</span>` : ''}
        <span class="${lvlOk ? '' : 'short'}">Requires Lv. ${r.levelReq}</span>
      </div>
      <div class="craft-actions">
        <button class="ench-btn" data-times="1" ${n > 0 && canHere(p) ? '' : 'disabled'}>CRAFT</button>
        ${stack ? `<button class="ench-btn" data-times="5" ${n >= 5 && canHere(p) ? '' : 'disabled'}>x5</button>
        <button class="ench-btn" data-times="${Math.max(1, n)}" ${n > 1 && canHere(p) ? '' : 'disabled'}>ALL (${n})</button>` : ''}
      </div>
      <div class="ench-result ${result ? (result.ok ? 'ok' : 'bad') : ''}">${result ? esc(result.message) : ''}</div>`;
    const outIcon = detail.querySelector('.ench-detail-head');
    if (outIcon && window.GameTooltip) window.GameTooltip.item(outIcon, r.output);
    detail.querySelectorAll('.ench-btn[data-times]').forEach(b => b.addEventListener('click', () => {
      if (socket) socket.emit('craft', { recipeId: r.id, times: Number(b.dataset.times) || 1 });
    }));
  }

  function open() { const m = $('craftingModal'); if (!m) return; m.style.display = 'flex'; result = null; render(); }
  function close() { const m = $('craftingModal'); if (m) m.style.display = 'none'; }
  function toggle() { const m = $('craftingModal'); if (m && m.style.display === 'flex') close(); else open(); }

  window.Crafting = {
    init(sock, playerGetter) {
      socket = sock;
      getPlayer = playerGetter;
      const btn = $('btnCloseCrafting');
      if (btn) btn.addEventListener('click', close);
      socket.on('craft_result', (res) => { result = res; render(); });
    },
    setCatalog(c) { if (c && c.recipes) catalog = c; render(); },
    // jump to a tab (e.g. from an NPC) and open
    openTab(cat) { tab = cat; selected = null; open(); },
    open, close, toggle, render
  };
})();
