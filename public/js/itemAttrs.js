// Slop Hero - item attributes on the client: labels, formatting and rarity colours
// (the rolls themselves live on the server, server/itemAttributes.ts).
(function () {
  'use strict';

  const ATTRS = {
    dmg: { label: 'Attack', icon: 'sword' },
    def: { label: 'Defense', icon: 'shield' },
    hp: { label: 'Max HP', icon: 'heart' },
    mp: { label: 'Max MP', icon: 'mp_potion' },
    hpRegen: { label: 'HP Regen', icon: 'heart', unit: '/s' },
    mpRegen: { label: 'MP Regen', icon: 'mp_potion', unit: '/s' },
    cdr: { label: 'Cooldown Reduction', icon: 'refresh', pct: true },
    critChance: { label: 'Crit Chance', icon: 'target', pct: true },
    critDmg: { label: 'Crit Damage', icon: 'burst', pct: true },
    atkSpeed: { label: 'Attack Speed', icon: 'bolt', pct: true },
    moveSpeed: { label: 'Move Speed', icon: 'boots' }
  };
  const SLOT_CAP = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, divine: 5 };
  const RARITY_COLOR = { common: '#e2e8f0', uncommon: '#4ade80', rare: '#38bdf8', epic: '#c084fc', legendary: '#f59e0b', divine: '#fff1a6', mythic: '#f43f5e' };

  const isGear = (item) => !!item && item.type === 'equipment' && !!item.slot && item.slot !== 'sp';
  const cap = (item) => (isGear(item) ? SLOT_CAP[item.rarity || 'common'] || 0 : 0);
  // open slots as an array of attribute-or-null
  const slots = (item) => {
    const n = Math.max(0, Math.min(cap(item), Number(item && item.attrSlots) || 0));
    const list = Array.isArray(item && item.attrs) ? item.attrs.slice(0, n) : [];
    while (list.length < n) list.push(null);
    return list;
  };
  const value = (a) => {
    const d = ATTRS[a.k] || {};
    return `+${a.v}${d.pct ? '%' : ''}${d.unit || ''}`;
  };
  const label = (a) => (ATTRS[a.k] ? ATTRS[a.k].label : a.k);
  // roll quality 0..1 -> a tier name for colouring the value
  const tier = (a) => (a.q >= 0.9 ? 'top' : a.q >= 0.6 ? 'high' : a.q >= 0.3 ? 'mid' : 'low');

  window.ItemAttrs = { ATTRS, SLOT_CAP, RARITY_COLOR, isGear, cap, slots, value, label, tier };
})();
