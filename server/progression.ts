// Central EXP rules for Slop Hero. Every monster's EXP comes from here so
// levelling speed is tuned in one place.

// Reference EXP curve. Monster EXP values and the job-level curve are built on
// it; the hero's base-level bar (expToNext) is stretched on top of it.
export function baseExpCurve(level: number): number {
  return Math.round(70 + level * 45 + Math.pow(level, 1.82) * 11);
}

// How many same-level normal monsters (field zones) one reference level is
// worth: it sets each monster's EXP value (and so the job-level pace).
// Interpolated between these anchor points.
export const KILLS_PER_LEVEL: [number, number][] = [
  [1, 12],
  [10, 14],
  [30, 30],
  [60, 50],
  [100, 70],
  [150, 90]
];

function interpolate(pts: [number, number][], level: number): number {
  if (level <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [l1, k1] = pts[i];
    const [l0, k0] = pts[i - 1];
    if (level <= l1) return k0 + (k1 - k0) * ((level - l0) / (l1 - l0));
  }
  return pts[pts.length - 1][1];
}

export function killsPerLevel(level: number): number {
  return interpolate(KILLS_PER_LEVEL, level);
}

// Hard-grind pace: how many same-level field kills one BASE level really
// takes. At ~10 kills/min that is Lv 10 in ~0.5 h, Lv 30 ~5 h, Lv 50 ~19 h,
// Lv 75 ~60 h, Lv 100 ~150 h and the Lv 150 cap ~500 h.
export const LEVEL_KILLS: [number, number][] = [
  [1, 15],
  [10, 55],
  [30, 210],
  [50, 650],
  [75, 1300],
  [100, 3000],
  [150, 5600]
];

// EXP needed to go from `level` to `level + 1`
export function expToNext(level: number): number {
  return Math.round(baseExpCurve(level) * interpolate(LEVEL_KILLS, level) / killsPerLevel(level));
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
  if (kind === 'boss') return Math.max(1, Math.round(baseExpCurve(level) * BOSS_LEVEL_SHARE));
  const base = baseExpCurve(level) / killsPerLevel(level);
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
function baseHpCurve(level?: number): number {
  const lv = Math.min(level || 1, HIGH_LEVEL_HP_FULL);
  if (lv <= HIGH_LEVEL_HP_FROM) return 1;
  return Math.pow(HIGH_LEVEL_HP_MULT, (lv - HIGH_LEVEL_HP_FROM) / (HIGH_LEVEL_HP_FULL - HIGH_LEVEL_HP_FROM));
}

// End-game monsters are extra tanky: on top of the curve above, their HP and
// defense ramp linearly from x1 at ENDGAME_FROM to their full multiplier at
// ENDGAME_FULL. Hero mastery does not follow this, so end-game fights
// genuinely take longer.
export const ENDGAME_FROM = 70;
export const ENDGAME_FULL = 90;
export const ENDGAME_HP_MULT = 5;
export const ENDGAME_DEF_MULT = 2;
function endgameRamp(level: number | undefined, mult: number): number {
  const lv = level || 1;
  if (lv <= ENDGAME_FROM) return 1;
  const t = Math.min(1, (lv - ENDGAME_FROM) / (ENDGAME_FULL - ENDGAME_FROM));
  return 1 + (mult - 1) * t;
}
function endgameHpMult(level?: number): number {
  return endgameRamp(level, ENDGAME_HP_MULT);
}
// Applied to a field or dungeon monster's def where it is created
export function mobDefMult(level?: number): number {
  return endgameRamp(level, ENDGAME_DEF_MULT);
}

export function mobHpMult(level?: number): number {
  return baseHpCurve(level) * endgameHpMult(level);
}

// Combat Mastery: a hero's damage is multiplied along the base curve, a little
// slower (x7.6 at level 100 against x10 monster HP), so high-level fights take
// only gently longer than low-level ones
export const MASTERY_EXP = 0.88;
export function masteryMult(level: number): number {
  return Math.pow(baseHpCurve(level), MASTERY_EXP);
}

// Monster defense cuts every hit by the share def / (def + MOB_DEF_K): about
// 5% at level 20, 18% at level 100, the same for a big hit and a small tick
export const MOB_DEF_K = 800;

module.exports = {
  expToNext,
  baseExpCurve,
  LEVEL_KILLS,
  mobHpMult,
  mobDefMult,
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

