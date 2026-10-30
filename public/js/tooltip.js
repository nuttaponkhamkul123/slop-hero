// Slop Hero - in-game tooltips.
// Replaces the browser's native title popups everywhere: any element with a
// title (or data-tip) shows a pixel-styled tooltip instead, and items get a
// rich card (rarity, stats, element, resistances, comparison, price).
(function () {
  'use strict';

  const RARITY_COLOR = { common: '#e2e8f0', rare: '#38bdf8', epic: '#c084fc', legendary: '#f59e0b', mythic: '#f43f5e' };
  const SLOT_LABEL = { weapon: 'Weapon', armor: 'Armor', helmet: 'Helmet', boots: 'Boots', ring: 'Ring' };
  const ELEMENT_LABEL = { fire: 'Fire', ice: 'Ice', lightning: 'Lightning', earth: 'Earth', holy: 'Holy', dark: 'Dark', neutral: 'Neutral' };
  const ELEMENT_COLOR = { fire: '#f97316', ice: '#38bdf8', lightning: '#facc15', earth: '#4ade80', holy: '#fef08a', dark: '#a855f7', neutral: '#94a3b8' };
  // [field, label, formatter]
  const STATS = [
    ['bonusDmg', 'Attack', v => `+${v}`],
    ['bonusDef', 'Defense', v => `+${v}`],
    ['bonusHp', 'Max HP', v => `+${v}`],
    ['bonusMp', 'Max MP', v => `+${v}`],
    ['bonusSpeed', 'Move Speed', v => `+${Number(v).toFixed(2)}`],
    ['bonusAttackSpeed', 'Attack Speed', v => `+${Math.round(v * 100)}%`],
    ['bonusSwipe', 'Swipe', v => `+${v}%`]
  ];
  const REFORGE_STATS = [
    ['bonusDmg', 'Attack', v => `+${v}`], ['bonusDef', 'Defense', v => `+${v}`], ['bonusHp', 'Max HP', v => `+${v}`],
    ['bonusMp', 'Max MP', v => `+${v}`], ['bonusSpeed', 'Move Speed', v => `+${v}`],
    ['bonusAttackSpeed', 'Attack Speed', v => `+${Math.round(v * 100)}%`], ['bonusSwipe', 'Swipe', v => `+${v}%`],
    ['critChance', 'Crit Chance', v => `+${v}%`], ['critDmg', 'Crit Damage', v => `+${v}%`]
  ];

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let tip = null;
  function ensureTip() {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.className = 'game-tooltip';
    tip.style.display = 'none';
    document.body.appendChild(tip);
    return tip;
  }

  function itemHtml(item, opts = {}) {
    if (!item) return '';
    const rarity = item.rarity || 'common';
    const color = RARITY_COLOR[rarity] || RARITY_COLOR.common;
    const icon = window.PixelIcons ? window.PixelIcons.itemHtml(item, 'tip-icon') : '';
    const lvl = item.upgradeLevel || 0;
    const typeLine = item.type === 'equipment'
      ? `${rarity.toUpperCase()} ${SLOT_LABEL[item.slot] || 'Gear'}`
      : item.type === 'rune' ? `${rarity.toUpperCase()} Elemental Rune`
        : item.type === 'consumable' ? `${rarity.toUpperCase()} Consumable`
          : item.type === 'treasure' ? `${rarity.toUpperCase()} Treasure`
            : item.type === 'sp_card' ? `${rarity.toUpperCase()} Specialist Card` : rarity.toUpperCase();

    let body = '';
    if (item.type === 'equipment') {
      if (item.cls) {
        body += `<div class="tip-line"><span>Class</span><b>${esc(item.cls.charAt(0).toUpperCase() + item.cls.slice(1))} only</b></div>`;
      }
      if (item.element && item.element !== 'neutral') {
        body += `<div class="tip-line"><span>Element</span><b style="color:${ELEMENT_COLOR[item.element]}">${ELEMENT_LABEL[item.element] || item.element}</b></div>`;
      }
      const cmp = opts.compare && opts.compare !== item ? opts.compare : null;
      for (const [k, label, fmt] of STATS) {
        const v = item[k];
        if (!v) continue;
        let delta = '';
        if (cmp) {
          const d = (v || 0) - (cmp[k] || 0);
          if (Math.abs(d) > 1e-6) {
            const shown = k === 'bonusAttackSpeed' ? `${Math.round(d * 100)}%` : k === 'bonusSpeed' ? d.toFixed(2) : Math.round(d);
            delta = ` <i class="${d > 0 ? 'up' : 'down'}">(${d > 0 ? '+' : ''}${shown})</i>`;
          }
        }
        body += `<div class="tip-line"><span>${label}</span><b>${fmt(v)}${delta}</b></div>`;
      }
      if (item.reforge && item.reforgeStats) {
        body += `<div class="tip-sub">Reforge: ${esc(item.reforge)}</div>`;
        for (const [k, label, fmt] of REFORGE_STATS) {
          if (item.reforgeStats[k]) body += `<div class="tip-line reforge"><span>${label}</span><b>${fmt(item.reforgeStats[k])}</b></div>`;
        }
      }
      if (item.elementResist && Object.keys(item.elementResist).length) {
        body += `<div class="tip-sub">Resistances</div>`;
        for (const [el, v] of Object.entries(item.elementResist)) {
          body += `<div class="tip-line"><span style="color:${ELEMENT_COLOR[el]}">${ELEMENT_LABEL[el] || el}</span><b>+${Math.round(v * 100)}%</b></div>`;
        }
      }
      const ability = item.slot === 'weapon' && window.WeaponAbilities && window.WeaponAbilities['wpn_' + item.id];
      if (ability) {
        body += `<div class="tip-sub">Right Click: ${esc(ability.name)}</div>`;
        body += `<div class="tip-line"><span>${window.manaCost ? window.manaCost(ability.mpCost) : ability.mpCost} MP</span><b>${ability.cooldown}s cooldown</b></div>`;
        body += `<div class="tip-flavour">${esc(ability.desc)}</div>`;
      }
      if (item.slot === 'weapon') {
        const maxSockets = item.maxSockets || 0;
        const brokenSockets = item.brokenSockets || 0;
        const sockets = Array.isArray(item.sockets) ? item.sockets : [];
        const usableSockets = Math.max(0, maxSockets - brokenSockets);
        body += `<div class="tip-sub">Weapon Sockets (${sockets.filter(s => !!s).length}/${usableSockets})</div>`;
        if (maxSockets === 0) {
          body += `<div class="tip-line" style="color: #94a3b8;"><span>No sockets</span><i>(Expand via Socket Expander)</i></div>`;
        } else {
          const RUNE_INFO = {
            rune_flame: { name: 'Infernal Flame Rune', icon: '🔴', effect: '+25% DMG & Burn DoT', color: '#ef4444' },
            flame: { name: 'Infernal Flame Rune', icon: '🔴', effect: '+25% DMG & Burn DoT', color: '#ef4444' },
            rune_frost: { name: 'Glacial Frost Rune', icon: '🔵', effect: '40% Chill Slow & Freeze', color: '#38bdf8' },
            frost: { name: 'Glacial Frost Rune', icon: '🔵', effect: '40% Chill Slow & Freeze', color: '#38bdf8' },
            rune_tempest: { name: 'Tempest Surge Rune', icon: '⚡', effect: '-20% CD & +10% Shock', color: '#eab308' },
            tempest: { name: 'Tempest Surge Rune', icon: '⚡', effect: '-20% CD & +10% Shock', color: '#eab308' },
            rune_vampiric: { name: 'Vampiric Drain Rune', icon: '🟣', effect: '25% Life Leech', color: '#a855f7' },
            vampiric: { name: 'Vampiric Drain Rune', icon: '🟣', effect: '25% Life Leech', color: '#a855f7' }
          };
          for (let i = 0; i < usableSockets; i++) {
            const rId = sockets[i];
            if (rId && RUNE_INFO[rId]) {
              const r = RUNE_INFO[rId];
              body += `<div class="tip-line"><span style="color:${r.color};">${r.icon} ${esc(r.name)}</span><b style="color:${r.color}; font-size:11px;">${r.effect}</b></div>`;
            } else {
              body += `<div class="tip-line" style="color: #64748b;"><span>⬡ Empty Socket</span><i>(Insert Rune)</i></div>`;
            }
          }
          for (let i = 0; i < brokenSockets; i++) {
            body += `<div class="tip-line" style="color: #ef4444;"><span>✕ Broken Socket</span><i>(Damaged)</i></div>`;
          }
        }
      }
      const flavour = (item.desc || '').split('. ').slice(1).join('. ');
      if (!item.custom && flavour) body += `<div class="tip-flavour">${esc(flavour)}</div>`;
    } else if (item.type === 'rune') {
      const RUNE_BONUS = {
        flame: '+25% Damage & Persistent Burn DoT',
        frost: '40% Chill Slow for 3.5s & 25% Freeze Chance',
        tempest: '-20% Cooldown Reduction & +10% Electric Shock DMG',
        vampiric: '25% Damage Dealt as HP Life Leech'
      };
      const bonus = RUNE_BONUS[item.runeType] || '';
      if (bonus) {
        body += `<div class="tip-line" style="margin-top: 4px;"><span style="color:${item.color || '#f59e0b'};">Weapon Bonus:</span><b style="color:${item.color || '#f59e0b'};">${bonus}</b></div>`;
      }
      body += `<div class="tip-flavour">${esc(item.desc)}</div>`;
      body += `<div class="tip-line" style="color: #94a3b8; font-size: 11px;"><span>Usage</span><i>Socket into weapons at Valka's Rune Forge</i></div>`;
    } else if (item.id === 'socket_expander') {
      body += `<div class="tip-line" style="color: #f59e0b;"><span>Titan Relic</span><b>Drill +1 Socket (Max 4)</b></div>`;
      body += `<div class="tip-flavour">${esc(item.desc)}</div>`;
      body += `<div class="tip-line" style="color: #ef4444; font-size: 11px;"><span>Risk</span><i>Chance to break socket slot on failure!</i></div>`;
    } else if (item.id && item.id.startsWith('bag_expander_')) {
      const rows = item.id === 'bag_expander_sm' ? 1 : item.id === 'bag_expander_md' ? 2 : 5;
      const slots = rows * 6;
      body += `<div class="tip-line" style="color: #facc15;"><span>Backpack Expansion</span><b>+${rows} ${rows === 1 ? 'Row' : 'Rows'} (+${slots} Slots)</b></div>`;
      body += `<div class="tip-flavour">${esc(item.desc)}</div>`;
      body += `<div class="tip-line" style="color: #4ade80; font-size: 11px;"><span>Usage</span><i>Click in bag to permanently expand capacity</i></div>`;
    } else if (item.desc) {
      body += `<div class="tip-flavour">${esc(item.desc)}</div>`;
    }

    const footer = [];
    if (item.count > 1) footer.push(`x${item.count}`);
    if (item.sellPrice) footer.push(`Sell ${item.sellPrice.toLocaleString()}g`);
    if (opts.hint) footer.push(esc(opts.hint));

    return `
      <div class="tip-head">
        <div class="tip-icon-wrap rarity-${rarity}">${icon}</div>
        <div>
          <div class="tip-name" style="color:${color}">${esc(item.name)}${lvl > 0 && !/\+\d+$/.test(item.name) ? ` +${lvl}` : ''}</div>
          <div class="tip-type">${typeLine}${item.quality ? ` - ${esc(item.quality)}` : ''}${item.itemLevel ? ` - Item Lv. ${item.itemLevel}` : ''}</div>
        </div>
      </div>
      ${body ? `<div class="tip-body">${body}</div>` : ''}
      ${footer.length ? `<div class="tip-foot">${footer.join(' &middot; ')}</div>` : ''}`;
  }

  // Registry: element -> () => html
  const sources = new WeakMap();
  let current = null;

  function sourceFor(el) {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (sources.has(n)) return { el: n, html: sources.get(n) };
      if (n.hasAttribute && n.hasAttribute('title')) {
        const text = n.getAttribute('title');
        n.removeAttribute('title');
        if (text) n.dataset.tip = text;
      }
      if (n.dataset && n.dataset.tip) {
        const text = n.dataset.tip;
        return { el: n, html: () => `<div class="tip-text">${esc(text).replace(/\n/g, '<br>')}</div>` };
      }
    }
    return null;
  }

  function place(x, y) {
    const t = ensureTip();
    const pad = 14;
    const w = t.offsetWidth, h = t.offsetHeight;
    let left = x + pad, top = y + pad;
    if (left + w > window.innerWidth - 6) left = x - w - pad;
    if (top + h > window.innerHeight - 6) top = y - h - pad;
    t.style.left = `${Math.max(6, left)}px`;
    t.style.top = `${Math.max(6, top)}px`;
  }

  function show(src, x, y) {
    const t = ensureTip();
    const html = src.html();
    if (!html) return hide();
    current = src.el;
    t.innerHTML = html;
    t.style.display = 'block';
    place(x, y);
  }

  function hide() {
    current = null;
    if (tip) tip.style.display = 'none';
  }

  document.addEventListener('mouseover', (e) => {
    const src = sourceFor(e.target);
    if (!src) { if (current) hide(); return; }
    if (src.el !== current) show(src, e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', (e) => {
    if (current) {
      if (!document.body.contains(current)) return hide();
      place(e.clientX, e.clientY);
    }
  });
  document.addEventListener('mousedown', hide, true);
  window.addEventListener('blur', hide);

  window.GameTooltip = {
    // Rich item card; opts: { compare: equippedItem, hint: 'Click to equip' }
    item(el, item, opts) {
      if (!el) return;
      el.removeAttribute('title');
      sources.set(el, () => itemHtml(item, opts));
    },
    html(el, htmlOrFn) {
      if (!el) return;
      el.removeAttribute('title');
      sources.set(el, typeof htmlOrFn === 'function' ? htmlOrFn : () => htmlOrFn);
    },
    itemHtml,
    hide
  };
})();
