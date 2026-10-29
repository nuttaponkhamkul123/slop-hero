// Central EXP rules for Slop Hero. Every monster's EXP comes from here so
// levelling speed is tuned in one place.

// EXP needed to go from `level` to `level + 1` (unchanged curve)
export function expToNext(level: number): number {
  return Math.round(70 + level * 45 + Math.pow(level, 1.82) * 11);
}

// How many same-level normal monsters (field zones) one level should take.
// Interpolated between these anchor points.
export const KILLS_PER_LEVEL: [number, number][] = [
  [1, 12],
  [10, 14],
  [30, 30],
  [60, 50],
  [100, 70],
  [150, 90]
];

export function killsPerLevel(level: number): number {
  const pts = KILLS_PER_LEVEL;
  if (level <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [l1, k1] = pts[i];
    const [l0, k0] = pts[i - 1];
    if (level <= l1) return k0 + (k1 - k0) * ((level - l0) / (l1 - l0));
  }
  return pts[pts.length - 1][1];
}

// EXP multiplier by monster kind (bosses are a fixed share of a level instead)
export const KIND_MULT: Record<string, number> = { normal: 1, commander: 3 };
export const BOSS_LEVEL_SHARE = 0.4;

// Dungeon difficulty EXP multipliers (better than open fields, but no more
// multi-level jumps from a single run)
export const DUNGEON_EXP_MULT: Record<string, number> = { normal: 1.3, hard: 1.6, nightmare: 2.0 };
// A dungeon run holds 110-250 densely packed monsters, so each trash kill is
// worth a quarter of an open-field kill (bosses are not reduced)
export const DUNGEON_TRASH_FACTOR = 0.25;

export function mobExp(level: number, kind: string = 'normal'): number {
  if (kind === 'boss') return Math.max(1, Math.round(expToNext(level) * BOSS_LEVEL_SHARE));
  const base = expToNext(level) / killsPerLevel(level);
  return Math.max(1, Math.round(base * (KIND_MULT[kind] || 1)));
}

// Killing far weaker monsters is worth little; stronger ones give a small bonus
export function levelGapMult(playerLevel?: number, mobLevel?: number): number {
  const gap = (mobLevel || 1) - (playerLevel || 1);
  if (gap >= 0) return 1 + Math.min(0.2, gap * 0.04);
  const under = -gap - 5;
  if (under <= 0) return 1;
  return Math.max(0.1, 1 - under * 0.15);
}

// Item drop chance by how far the monster is below the hero: full up to
// LOOT_FULL_GAP levels below, fading to nothing at LOOT_NONE_GAP and beyond
export const LOOT_FULL_GAP = 5;
export const LOOT_NONE_GAP = 15;
export function lootGapMult(playerLevel?: number, mobLevel?: number): number {
  const under = (playerLevel || 1) - (mobLevel || 1);
  if (under <= LOOT_FULL_GAP) return 1;
  if (under >= LOOT_NONE_GAP) return 0;
  return 1 - (under - LOOT_FULL_GAP) / (LOOT_NONE_GAP - LOOT_FULL_GAP);
}

// Monsters past level 20 get tougher gradually: their HP multiplier climbs
// exponentially from x1 at HIGH_LEVEL_HP_FROM to x HIGH_LEVEL_HP_MULT at
// HIGH_LEVEL_HP_FULL and stays there (no cliff between two levels)
export const HIGH_LEVEL_HP_FROM = 20;
export const HIGH_LEVEL_HP_FULL = 100;
export const HIGH_LEVEL_HP_MULT = 10;
export function mobHpMult(level?: number): number {
  const lv = Math.min(level || 1, HIGH_LEVEL_HP_FULL);
  if (lv <= HIGH_LEVEL_HP_FROM) return 1;
  return Math.pow(HIGH_LEVEL_HP_MULT, (lv - HIGH_LEVEL_HP_FROM) / (HIGH_LEVEL_HP_FULL - HIGH_LEVEL_HP_FROM));
}

// Combat Mastery: a hero's damage is multiplied along the same curve, a little
// slower (x6.3 at level 100 against x10 monster HP), so high-level fights take
// only gently longer than low-level ones
export const MASTERY_EXP = 0.8;
export function masteryMult(level: number): number {
  return Math.pow(mobHpMult(level), MASTERY_EXP);
}

// Monster defense cuts every hit by the share def / (def + MOB_DEF_K): about
// 5% at level 20, 18% at level 100, the same for a big hit and a small tick
export const MOB_DEF_K = 800;

module.exports = {
  expToNext,
  mobHpMult,
  masteryMult,
  MOB_DEF_K,
  killsPerLevel,
  mobExp,
  levelGapMult,
  lootGapMult,
  KIND_MULT,
  DUNGEON_EXP_MULT,
  DUNGEON_TRASH_FACTOR,
  BOSS_LEVEL_SHARE,
  KILLS_PER_LEVEL
};

