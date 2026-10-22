// Central EXP rules for Slop Hero. Every monster's EXP comes from here so
// levelling speed is tuned in one place.

// EXP needed to go from `level` to `level + 1` (unchanged curve)
function expToNext(level) {
  return Math.round(70 + level * 45 + Math.pow(level, 1.82) * 11);
}

// How many same-level normal monsters (field zones) one level should take.
// Interpolated between these anchor points.
const KILLS_PER_LEVEL = [
  [1, 12],
  [10, 14],
  [30, 30],
  [60, 50],
  [100, 70],
  [150, 90]
];

function killsPerLevel(level) {
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
const KIND_MULT = { normal: 1, commander: 3 };
const BOSS_LEVEL_SHARE = 0.4;

// Dungeon difficulty EXP multipliers (better than open fields, but no more
// multi-level jumps from a single run)
const DUNGEON_EXP_MULT = { normal: 1.3, hard: 1.6, nightmare: 2.0 };
// A dungeon run holds 110-250 densely packed monsters, so each trash kill is
// worth a quarter of an open-field kill (bosses are not reduced)
const DUNGEON_TRASH_FACTOR = 0.25;

function mobExp(level, kind = 'normal') {
  if (kind === 'boss') return Math.max(1, Math.round(expToNext(level) * BOSS_LEVEL_SHARE));
  const base = expToNext(level) / killsPerLevel(level);
  return Math.max(1, Math.round(base * (KIND_MULT[kind] || 1)));
}

// Killing far weaker monsters is worth little; stronger ones give a small bonus
function levelGapMult(playerLevel, mobLevel) {
  const gap = (mobLevel || 1) - (playerLevel || 1);
  if (gap >= 0) return 1 + Math.min(0.2, gap * 0.04);
  const under = -gap - 5;
  if (under <= 0) return 1;
  return Math.max(0.1, 1 - under * 0.15);
}

module.exports = { expToNext, killsPerLevel, mobExp, levelGapMult, KIND_MULT, DUNGEON_EXP_MULT, DUNGEON_TRASH_FACTOR, BOSS_LEVEL_SHARE, KILLS_PER_LEVEL };
