// Item attributes: extra rolled lines on gear, worked by Jerry the Attribute Smith.
//
// Every piece of gear has a rarity, and the rarity caps how many attribute slots it can have
// (common 0 ... divine 5). A drop opens only some of those slots; the rest are opened one at a
// time with an Attribute Socketer. Each open slot holds one attribute (or is empty):
//   Attribute Socketer  opens one more slot (empty), up to the rarity's cap
//   Attribute Roller    fills empty slots and re-rolls every unlocked attribute. Locking
//                       attributes keeps them, but each roll then costs one roller per locked
//                       attribute (lock 3, change 1 = 3 rollers a roll)
//   Attribute Reseter   keeps which attributes the item has and rolls their values again
//                       (locked ones are left alone)
// The three materials drop from any monster (ATTR_MATERIAL_DROP each).
//
// item.attrSlots  number of open slots
// item.attrs      [{ k, v, q } | null] one entry per open slot: attribute key, value, roll quality 0..1

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'divine'];
export const ATTR_SLOT_CAP: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, divine: 5 };
// rarer gear rolls stronger values
const RARITY_POWER: Record<string, number> = { common: 1, uncommon: 1.05, rare: 1.12, epic: 1.22, legendary: 1.35, divine: 1.55 };
// share of a drop's slot cap that comes open, rolled per slot
const DROP_SLOT_OPEN_CHANCE = 0.55;
export const ATTR_MATERIAL_DROP: Record<string, number> = { attr_roller: 0.01, attr_socketer: 0.01, attr_reseter: 0.01 };
export const MAX_CDR = 0.4;

// min / max at item level 1 on common gear. lvl: grows with item level. dec: decimals kept.
// stat: the player stat it adds to (recalculatePlayerStats); pct: shown with a %
export const ATTRS: Record<string, { label: string; min: number; max: number; lvl?: boolean; dec?: number; pct?: boolean; unit?: string }> = {
  dmg: { label: 'Attack', min: 2, max: 6, lvl: true },
  def: { label: 'Defense', min: 2, max: 5, lvl: true },
  hp: { label: 'Max HP', min: 15, max: 40, lvl: true },
  mp: { label: 'Max MP', min: 10, max: 28, lvl: true },
  hpRegen: { label: 'HP Regen', min: 1, max: 3, lvl: true, dec: 1, unit: '/s' },
  mpRegen: { label: 'MP Regen', min: 0.5, max: 1.6, lvl: true, dec: 1, unit: '/s' },
  cdr: { label: 'Cooldown Reduction', min: 2, max: 5, dec: 1, pct: true },
  critChance: { label: 'Crit Chance', min: 1, max: 3.5, dec: 1, pct: true },
  critDmg: { label: 'Crit Damage', min: 5, max: 14, pct: true },
  atkSpeed: { label: 'Attack Speed', min: 3, max: 7, pct: true },
  moveSpeed: { label: 'Move Speed', min: 0.05, max: 0.15, dec: 2 }
};
const ATTR_KEYS = Object.keys(ATTRS);

export function attrSlotCap(item: any): number {
  return (item && ATTR_SLOT_CAP[item.rarity || 'common']) || 0;
}

export function canHoldAttributes(item: any): boolean {
  return !!item && item.type === 'equipment' && !!item.slot && item.slot !== 'sp';
}

// Gives an item its attribute fields (items made before attributes existed have none open)
export function ensureAttrs(item: any) {
  if (!canHoldAttributes(item)) return item;
  const n = Math.max(0, Math.min(attrSlotCap(item), Number(item.attrSlots) || 0));
  item.attrSlots = n;
  const list = Array.isArray(item.attrs) ? item.attrs.slice(0, n) : [];
  while (list.length < n) list.push(null);
  item.attrs = list.map((a: any) => (a && ATTRS[a.k] ? a : null));
  return item;
}

function valueFor(item: any, k: string, q: number) {
  const d = ATTRS[k];
  const lvl = Math.max(1, Number(item.itemLevel) || 1);
  const lvlMult = d.lvl ? 1 + ((lvl - 1) / 10) * 0.25 : 1;
  const raw = (d.min + (d.max - d.min) * q) * lvlMult * (RARITY_POWER[item.rarity] || 1);
  const f = Math.pow(10, d.dec || 0);
  return Math.max(1 / f, Math.round(raw * f) / f);
}

function rollOne(item: any, exclude: Set<string>, k?: string) {
  const pool = ATTR_KEYS.filter(x => !exclude.has(x));
  const key = k || pool[Math.floor(Math.random() * pool.length)] || ATTR_KEYS[0];
  const q = Number(Math.random().toFixed(3));
  return { k: key, v: valueFor(item, key, q), q };
}

// A fresh drop: some of the rarity's slots open, each with an attribute
export function rollDropAttrs(item: any) {
  if (!canHoldAttributes(item)) return item;
  const cap = attrSlotCap(item);
  let n = 0;
  for (let i = 0; i < cap; i++) if (Math.random() < DROP_SLOT_OPEN_CHANCE) n++;
  item.attrSlots = n;
  item.attrs = [];
  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    const a = rollOne(item, used);
    used.add(a.k);
    item.attrs.push(a);
  }
  return item;
}

// Re-roll every slot not in `locked` (empty ones get filled); no attribute twice on one item
export function rerollAttrs(item: any, locked: Set<number>) {
  ensureAttrs(item);
  const used = new Set<string>();
  item.attrs.forEach((a: any, i: number) => { if (a && locked.has(i)) used.add(a.k); });
  const changed: number[] = [];
  item.attrs = item.attrs.map((a: any, i: number) => {
    if (a && locked.has(i)) return a;
    const n = rollOne(item, used);
    used.add(n.k);
    changed.push(i);
    return n;
  });
  return changed;
}

// Same attributes, new values, for every filled slot not in `locked`
export function rerollAttrValues(item: any, locked: Set<number>) {
  ensureAttrs(item);
  const changed: number[] = [];
  item.attrs = item.attrs.map((a: any, i: number) => {
    if (!a || locked.has(i)) return a;
    changed.push(i);
    return rollOne(item, new Set(), a.k);
  });
  return changed;
}

// What a hero's worn gear adds: { dmg, def, hp, mp, hpRegen, mpRegen, cdr, critChance, critDmg, atkSpeed, moveSpeed }
export function sumAttrs(equipment: any) {
  const tot: Record<string, number> = Object.fromEntries(ATTR_KEYS.map(k => [k, 0]));
  for (const eq of Object.values(equipment || {}) as any[]) {
    if (!eq || !Array.isArray(eq.attrs)) continue;
    for (const a of eq.attrs) if (a && tot[a.k] !== undefined) tot[a.k] += Number(a.v) || 0;
  }
  return tot;
}
