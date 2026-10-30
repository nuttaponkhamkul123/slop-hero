// Eternal Rift: a wave-defence instance. One large arena, the Holy Fountain in
// the middle, four rift gates on the walls. Monsters pour out of the gates and
// converge on the fountain; heroes hold them off and spend Rift Points (earned
// per kill, lost on leaving) on turrets, barriers and blessings. Every
// RIFT_CHECKPOINT_EVERY waves the party may leave with what they banked;
// clearing wave RIFT_MAX_WAVES wins outright. If the fountain falls, the banked
// reward is lost. Rift Essence from here buys James the Gatekeeper's gear.
import { mobStats } from './fieldZones';

export const RIFT_MAX_WAVES = 30;
export const RIFT_CHECKPOINT_EVERY = 5;
export const RIFT_PREP_S = 20;          // before wave 1
export const RIFT_BREAK_S = 12;         // between waves
export const RIFT_CHOICE_S = 10;        // continue-or-leave prompt at a checkpoint
export const RIFT_RESPAWN_S = 8;        // fallen heroes rise at the fountain
export const RIFT_PLAYER_AGGRO = 3.0;   // a hero this close pulls a monster off the fountain
export const RIFT_PLAYER_LEASH = 6.5;   // ...and it lets go past this
export const RIFT_STRUCT_REACH = 7;     // how far from the hero a structure may be placed
export const RIFT_MAX_MOBS_ALIVE = 70;

// Arena geometry (dungeon tile codes: 4 floor, 7 wall, 8 void, 50/51 decor)
const SIZE = 40;
const MID = 20;
export const RIFT_FOUNTAIN = { x: MID, y: MID, radius: 1.4 };
export const RIFT_GATES = [
  { id: 'north', x: MID, y: 5.5 },
  { id: 'east', x: SIZE - 5.5, y: MID },
  { id: 'south', x: MID, y: SIZE - 5.5 },
  { id: 'west', x: 5.5, y: MID }
];
export const RIFT_SPAWN = { x: MID + 0.5, y: MID + 3.2 };

export function generateRiftArena() {
  const tiles: number[][] = [];
  // a rounded square: the corners are cut off into the void
  const inside = (x: number, y: number) => {
    const dx = Math.max(0, Math.abs(x + 0.5 - MID) - 11), dy = Math.max(0, Math.abs(y + 0.5 - MID) - 11);
    return Math.hypot(dx, dy) < 6.5;
  };
  for (let y = 0; y < SIZE; y++) {
    tiles[y] = [];
    for (let x = 0; x < SIZE; x++) tiles[y][x] = inside(x, y) ? 4 : 8;
  }
  // walls on the rim of the floor
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (tiles[y][x] !== 4) continue;
      const rim = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
        .some(([dx, dy]) => (tiles[y + dy] && tiles[y + dy][x + dx]) === 8 || !tiles[y + dy] || tiles[y + dy][x + dx] === undefined);
      if (rim) tiles[y][x] = 7;
    }
  }
  // scorched rings around the fountain and cracked rubble near the gates (no hazards)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (tiles[y][x] !== 4) continue;
      const r = Math.hypot(x + 0.5 - MID, y + 0.5 - MID);
      if (Math.abs(r - 4.5) < 0.5) tiles[y][x] = 50;
      if (RIFT_GATES.some(g => Math.hypot(x + 0.5 - g.x, y + 0.5 - g.y) < 2.2) && (x * 7 + y * 3) % 4 === 0) tiles[y][x] = 51;
    }
  }

  const obstacles: any[] = [
    { id: 'rift_fountain', type: 'holy_fountain', x: RIFT_FOUNTAIN.x, y: RIFT_FOUNTAIN.y, collidable: true, radius: RIFT_FOUNTAIN.radius },
    ...RIFT_GATES.map(g => ({ id: `rift_gate_${g.id}`, type: 'rift_gate', x: g.x, y: g.y, collidable: false })),
    // braziers light the floor, kept off the four straight gate-to-fountain lanes
    ...[[-8, -8], [8, -8], [-8, 8], [8, 8], [-12, -5], [12, -5], [-12, 5], [12, 5], [-5, -12], [5, -12], [-5, 12], [5, 12]]
      .map(([dx, dy], i) => ({ id: `rift_brazier_${i}`, type: 'brazier', x: MID + dx, y: MID + dy, collidable: true, radius: 0.4 }))
  ];

  return {
    width: SIZE,
    height: SIZE,
    tiles,
    obstacles,
    rooms: [],
    doors: [],
    chests: [],
    spawnPoint: RIFT_SPAWN,
    theme: 'dungeon_oblivion',
    name: 'The Eternal Rift',
    subtitle: 'Hold the Holy Fountain',
    color: '#c084fc',
    icon: 'whirl',
    bg: '#07030f',
    isDungeon: true,
    isRift: true
  };
}

// ---------------------------------------------------------------- structures
// Bought with Rift Points and placed by the hero. Damage and HP scale with the
// builder's attack and the run's base level so they stay useful all the way up.
export const RIFT_STRUCTURES: Record<string, any> = {
  turret: {
    name: 'Arcane Turret', icon: 'target', cost: 120, max: 6, radius: 0.55,
    hp: 500, hpPerLevel: 45, range: 6.5, every: 0.9, dmgShare: 0.55,
    desc: 'Fires an arcane bolt at the nearest monster every 0.9s (6.5 range).'
  },
  frost: {
    name: 'Frost Spire', icon: 'snow', cost: 180, max: 4, radius: 0.55,
    hp: 450, hpPerLevel: 40, range: 4.2, every: 1.6, dmgShare: 0.3, chill: 1.8,
    desc: 'Pulses frost every 1.6s, hurting and slowing every monster within 4.2.'
  },
  barrier: {
    name: 'Holy Barrier', icon: 'shield', cost: 50, max: 14, radius: 0.85,
    hp: 1400, hpPerLevel: 130,
    desc: 'A sturdy ward that blocks monsters. They must break it to pass.'
  },
  totem: {
    name: 'Healing Totem', icon: 'heart', cost: 160, max: 2, radius: 0.5,
    hp: 600, hpPerLevel: 40, range: 4.5, every: 1, heal: 0.03, fountainHeal: 0.004,
    desc: 'Heals heroes within 4.5 for 3% max HP/s and the fountain for 0.4%/s.'
  },
  blessing: {
    name: 'Fountain Blessing', icon: 'star', cost: 220, instant: true, restore: 0.2,
    desc: 'Instantly restores 20% of the Holy Fountain\'s HP.'
  }
};

export function fountainMaxHp(baseLevel: number, heroes: number) {
  return Math.round((3000 + baseLevel * 320) * (1 + 0.35 * (heroes - 1)));
}

// ---------------------------------------------------------------- waves
// Rift creatures reuse the bodies the renderer already draws, tinted violet.
const RIFT_ROSTER = [
  { type: 'slime', name: 'Rift Ooze', hue: 250, speed: 2.6, hp: 0.8, dmg: 0.8, from: 1 },
  { type: 'goblin', name: 'Void Imp', hue: 230, speed: 3.4, hp: 0.75, dmg: 0.9, from: 1 },
  { type: 'skeleton', name: 'Hollow Revenant', hue: 260, speed: 3.0, hp: 1.0, dmg: 1.0, from: 3 },
  { type: 'frost_wolf', name: 'Riftfang Hound', hue: 280, speed: 4.2, hp: 0.7, dmg: 1.1, from: 6 },
  { type: 'ice_elemental', name: 'Eternal Wisp', hue: 300, speed: 3.2, hp: 0.9, dmg: 1.2, from: 9, element: 'dark' },
  { type: 'golem', name: 'Riftstone Brute', hue: 270, speed: 2.2, hp: 2.4, dmg: 1.4, from: 12, scale: 1.1 }
];
const WARDEN = { type: 'golem', name: 'Rift Warden', hue: 300, speed: 2.4, scale: 1.45 };
const DEVOURER = { type: 'frost_titan', name: 'The Eternal Devourer', hue: 285, speed: 2.1, scale: 2.0 };

export function waveLevel(baseLevel: number, wave: number) {
  return Math.min(150, baseLevel + (wave - 1));
}

export function waveSize(wave: number, heroes: number) {
  return Math.min(60, Math.round((6 + wave * 1.6) * (1 + 0.5 * (heroes - 1))));
}

// The monsters of one wave, in spawn order, each tagged with its gate
export function buildRiftWave(wave: number, baseLevel: number, heroes: number) {
  const level = waveLevel(baseLevel, wave);
  const pool = RIFT_ROSTER.filter(r => wave >= r.from);
  const list: any[] = [];
  const make = (r: any, kind: string) => {
    const boss = kind === 'boss', elite = kind === 'elite';
    const s = mobStats(level, boss || elite);
    const hpMult = boss ? 2.2 * (1 + 0.6 * (heroes - 1)) : elite ? 0.6 * (1 + 0.4 * (heroes - 1)) : r.hp;
    const dmgMult = boss ? 1.1 : elite ? 0.9 : r.dmg;
    return {
      type: r.type, name: `${r.name}${boss ? ' [Boss]' : elite ? ' [Elite]' : ''}`, level,
      hue: r.hue, scale: r.scale || 1, speed: r.speed,
      element: r.element || 'dark', elementResist: { holy: -0.3, dark: 0.3 },
      buffs: [],
      maxHp: Math.round(s.maxHp * hpMult),
      dmg: Math.round(s.dmg * dmgMult),
      def: s.def,
      exp: Math.max(1, Math.round(s.exp * (boss ? 0.5 : elite ? 0.4 : 0.3))),
      gold: 0,
      isBoss: boss, isMiniboss: elite,
      riftPoints: boss ? 600 : elite ? 60 + wave * 6 : 8 + Math.floor(wave * 1.5)
    };
  };
  const n = waveSize(wave, heroes);
  for (let i = 0; i < n; i++) list.push(make(pool[Math.floor(Math.random() * pool.length)], 'normal'));
  if (wave === RIFT_MAX_WAVES) list.push(make(DEVOURER, 'boss'));
  else if (wave % RIFT_CHECKPOINT_EVERY === 0) {
    const elites = 1 + Math.floor((heroes - 1) / 2);
    for (let i = 0; i < elites; i++) list.push(make(WARDEN, 'elite'));
  }
  return list;
}

// Seconds between two spawns: a wave pours out over roughly 10-20 seconds
export function spawnInterval(wave: number, count: number) {
  return Math.max(0.18, Math.min(0.9, (10 + wave * 0.35) / Math.max(1, count)));
}

// ---------------------------------------------------------------- rewards
// Banked when a checkpoint wave is cleared; paid out only by leaving at a
// checkpoint prompt or by clearing the final wave.
const ESSENCE_AT_CHECKPOINT = { 5: 1, 10: 2, 15: 3, 20: 5, 25: 7, 30: 12 };
export function checkpointReward(wave: number, baseLevel: number) {
  return {
    essence: ESSENCE_AT_CHECKPOINT[wave] || 0,
    gold: Math.round(wave * (5 + baseLevel) * 0.5)
  };
}

export const RIFT_ESSENCE_ID = 'rift_essence';

// ---------------------------------------------------------------- James the Gatekeeper
export const JAMES_RECIPES = [
  { itemId: 'riftwalker_edge', essence: 40, gold: 15000, fragments: 0 },
  { itemId: 'nightfall_twinblades', essence: 60, gold: 25000, fragments: 10 },
  { itemId: 'gatekeeper_greatsword', essence: 60, gold: 25000, fragments: 10 },
  { itemId: 'sunfire_conduit', essence: 60, gold: 25000, fragments: 10 },
  { itemId: 'rift_warden_plate', essence: 30, gold: 10000, fragments: 0 },
  { itemId: 'band_of_eternity', essence: 25, gold: 8000, fragments: 0 }
];

module.exports = {
  RIFT_MAX_WAVES, RIFT_CHECKPOINT_EVERY, RIFT_PREP_S, RIFT_BREAK_S, RIFT_CHOICE_S, RIFT_RESPAWN_S,
  RIFT_PLAYER_AGGRO, RIFT_PLAYER_LEASH, RIFT_STRUCT_REACH, RIFT_MAX_MOBS_ALIVE,
  RIFT_FOUNTAIN, RIFT_GATES, RIFT_SPAWN, RIFT_STRUCTURES, RIFT_ESSENCE_ID, JAMES_RECIPES,
  generateRiftArena, fountainMaxHp, waveLevel, waveSize, buildRiftWave, spawnInterval, checkpointReward
};
