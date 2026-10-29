// Procedural Dungeon Generator for Aetheria Online
// Generates randomized rooms, corridors, chests, and dungeon monsters
import { ITEMS, generateRandomizedGear, pickGearForLevel } from './items';
import { mobExp, mobHpMult, DUNGEON_EXP_MULT, DUNGEON_TRASH_FACTOR } from './progression';

const DUNGEON_WIDTH = 38;
const DUNGEON_HEIGHT = 38;

// Tile types for dungeon
const DUNGEON_TILES = {
  VOID: 8,         // Dark empty abyss (outside dungeon, unrendered)
  WALL: 7,         // Solid 3D stone masonry wall (impassable perimeter)
  FLOOR: 4,        // Dungeon stone brick floor
  CORRIDOR: 1,     // Cobblestone passage
  PORTAL_EXIT: 6   // Return portal back to town
};

// Themed features laid inside rooms (ids shared with the client's FIELD_TILE_PALETTE)
const FEATURE_TILES = {
  WATER: 41, SHALLOWS: 42, LAVA: 43, EMBERS: 44, ACID: 45, FROST: 46,
  STARS: 47, SHADOW: 48, RIFT: 49, SCORCH: 50, RUBBLE: 51
};
// Deep liquids and star pits block movement
const BLOCKING_FEATURES = new Set([FEATURE_TILES.WATER, FEATURE_TILES.LAVA, FEATURE_TILES.STARS]);
// Walkable hazards: standing on one inflicts a status (dot = share of max HP per tick)
const DUNGEON_HAZARDS = {
  [FEATURE_TILES.SHALLOWS]: { status: 'chill', duration: 1.2, dot: 0 },
  [FEATURE_TILES.EMBERS]: { status: 'burn', duration: 2.0, dot: 0.02 },
  [FEATURE_TILES.ACID]: { status: 'poison', duration: 3.0, dot: 0.015 },
  [FEATURE_TILES.FROST]: { status: 'chill', duration: 1.2, dot: 0 },
  [FEATURE_TILES.SHADOW]: { status: 'chill', duration: 1.5, dot: 0 },
  [FEATURE_TILES.RIFT]: { status: 'burn', duration: 2.0, dot: 0.025 }
};
const OPEN_TILES = new Set([DUNGEON_TILES.FLOOR, DUNGEON_TILES.CORRIDOR, DUNGEON_TILES.PORTAL_EXIT, ...Object.values(FEATURE_TILES)]);

// Room grid: each cell holds a 9x9 room; neighbouring rooms are 2 tiles
// apart and joined by a 3-wide doorway that stays sealed until unlocked.
const ROOM_CELL = 11;
const ROOM_INNER = 9;
const DOOR_WIDTH = 3;

// Rooms per floor (entrance and boss included) grows with depth/difficulty
const ROOM_COUNT_MULT = 3;
function roomCountFor(floorLevel, difficulty) {
  const bonus = difficulty === 'nightmare' ? 2 : difficulty === 'hard' ? 1 : 0;
  return Math.min(16, 4 + floorLevel + bonus) * ROOM_COUNT_MULT;
}

// Global HP scale for every dungeon monster (boss, guards, room mobs)
const DUNGEON_MOB_HP_SCALE = 0.75;

// Difficulty Configurations & Modifiers
const DIFFICULTIES = {
  normal: {
    id: 'normal',
    name: 'Normal',
    label: '🟢 Normal',
    densityMult: 1.0,
    hpMult: 1.0,
    dmgMult: 1.0,
    expMult: DUNGEON_EXP_MULT.normal,
    goldMult: 1.0,
    affixMin: 0,
    affixMax: 0,
    commanderChance: 0
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    label: '🟡 Hard',
    densityMult: 1.6,
    hpMult: 1.7,
    dmgMult: 1.4,
    expMult: DUNGEON_EXP_MULT.hard,
    goldMult: 1.6,
    affixMin: 1,
    affixMax: 2,
    commanderChance: 0.35
  },
  nightmare: {
    id: 'nightmare',
    name: 'Nightmare / Hell',
    label: '🔴 Nightmare',
    densityMult: 2.3,
    hpMult: 2.6,
    dmgMult: 1.9,
    expMult: DUNGEON_EXP_MULT.nightmare,
    goldMult: 2.5,
    affixMin: 2,
    affixMax: 3,
    commanderChance: 0.65
  }
};

const AFFIX_POOL = [
  { id: 'fortified', name: 'Fortified', icon: '🛡️', tag: '🛡️ Fortified', desc: '+80% HP, +12 Def' },
  { id: 'frostbite', name: 'Frostbite', icon: '❄️', tag: '❄️ Frostbite', desc: 'Attacks slow player 40%' },
  { id: 'venomous', name: 'Venomous', icon: '☠️', tag: '☠️ Venomous', desc: 'Attacks inflict Poison DoT' },
  { id: 'ignited', name: 'Ignited', icon: '🔥', tag: '🔥 Ignited', desc: 'Attacks inflict Burn DoT' }
];

// 10 Progressive Dungeon Floors (Every 15 levels up to Level 150) with Unique Themes
const DUNGEON_FLOORS = [
  {
    floor: 1,
    name: 'Crypt of Whispers',
    theme: 'dungeon_crypt',
    color: '#38bdf8',
    icon: 'skull',
    bg: '#080c14',
    minLevel: 1,
    maxLevel: 15,
    bossName: 'Grave Overlord Malok',
    subtitle: 'Lv. 1 - 15 • Ancient Tomb & Whispering Souls',
    element: 'dark',
    mobs: [
      { name: 'Crypt Skeleton', type: 'skeleton', element: 'dark' },
      { name: 'Tomb Sentry', type: 'skeleton', scale: 1.15, element: 'dark' },
      { name: 'Graveyard Scavenger', type: 'goblin', element: 'earth' },
      { name: 'Crypt Ghoul', type: 'goblin', hue: 60, element: 'dark' }
    ]
  },
  {
    floor: 2,
    name: 'Sunken Catacombs',
    theme: 'dungeon_sunken',
    color: '#2dd4bf',
    icon: 'droplet',
    bg: '#051412',
    minLevel: 16,
    maxLevel: 30,
    bossName: 'Ancient Crypt Warden',
    subtitle: 'Lv. 16 - 30 • Flooded Ruins & Deepmire Horrors',
    element: 'ice',
    mobs: [
      { name: 'Drowned Mariner', type: 'skeleton', element: 'ice' },
      { name: 'Coralbone Sentry', type: 'skeleton', scale: 1.15, element: 'dark' },
      { name: 'Mire Creeper', type: 'slime', hue: 35, element: 'earth' },
      { name: 'Sunken Stalker', type: 'frost_wolf', element: 'ice' }
    ]
  },
  {
    floor: 3,
    name: 'Obsidian Caverns',
    theme: 'dungeon_obsidian',
    color: '#f97316',
    icon: 'fire',
    bg: '#14080a',
    minLevel: 31,
    maxLevel: 45,
    bossName: 'Magma Behemoth',
    subtitle: 'Lv. 31 - 45 • Molten Basalt & Magma Golems',
    element: 'fire',
    mobs: [
      { name: 'Obsidian Golem', type: 'golem', hue: 195, scale: 0.55, element: 'fire' },
      { name: 'Ashbone Berserker', type: 'skeleton', element: 'earth' },
      { name: 'Magma Crawler', type: 'slime', hue: 220, element: 'fire' },
      { name: 'Fire Imp', type: 'goblin', hue: 218, element: 'fire' }
    ]
  },
  {
    floor: 4,
    name: 'Glacial Abyss',
    theme: 'dungeon_glacial',
    color: '#67e8f9',
    icon: 'snow',
    bg: '#04101c',
    minLevel: 46,
    maxLevel: 60,
    bossName: 'Frostbite Colossus',
    subtitle: 'Lv. 46 - 60 • Frozen Permafrost & Cryo Revenants',
    element: 'ice',
    mobs: [
      { name: 'Frostbite Skeleton', type: 'skeleton', element: 'ice' },
      { name: 'Icebound Horror', type: 'ice_elemental', element: 'ice' },
      { name: 'Glacial Stalker', type: 'frost_wolf', element: 'ice' },
      { name: 'Cryo Fiend', type: 'goblin', hue: 60, element: 'ice' }
    ]
  },
  {
    floor: 5,
    name: 'Toxic Necropolis',
    theme: 'dungeon_toxic',
    color: '#84cc16',
    icon: 'poison',
    bg: '#081406',
    minLevel: 61,
    maxLevel: 75,
    bossName: 'Plaguebringer Thok',
    subtitle: 'Lv. 61 - 75 • Corrosive Slime & Plague Hosts',
    element: 'earth',
    mobs: [
      { name: 'Blighted Bone-Lord', type: 'skeleton', scale: 1.15, element: 'earth' },
      { name: 'Noxious Ghoul', type: 'skeleton', element: 'dark' },
      { name: 'Venomous Skitterer', type: 'slime', element: 'earth' },
      { name: 'Acid Prowler', type: 'frost_wolf', hue: 260, element: 'earth' }
    ]
  },
  {
    floor: 6,
    name: 'Infernal Sanctum',
    theme: 'dungeon_infernal',
    color: '#ef4444',
    icon: 'fire',
    bg: '#170508',
    minLevel: 76,
    maxLevel: 90,
    bossName: 'Arch-Demon Balor',
    subtitle: 'Lv. 76 - 90 • Demonic Citadel & Hellfire Fiends',
    element: 'fire',
    mobs: [
      { name: 'Hellfire Demon', type: 'golem', hue: 170, scale: 0.6, element: 'fire' },
      { name: 'Sanguine Tormentor', type: 'skeleton', element: 'dark' },
      { name: 'Brimstone Fiend', type: 'goblin', hue: 218, element: 'fire' },
      { name: 'Hellhound Familiar', type: 'frost_wolf', hue: 170, element: 'fire' }
    ]
  },
  {
    floor: 7,
    name: 'Celestial Void',
    theme: 'dungeon_celestial',
    color: '#facc15',
    icon: 'star',
    bg: '#08071c',
    minLevel: 91,
    maxLevel: 105,
    bossName: 'Astral Singularity',
    subtitle: 'Lv. 91 - 105 • Astral Temple & Cosmic Watchers',
    element: 'holy',
    mobs: [
      { name: 'Astral Phantom', type: 'ice_elemental', hue: 220, element: 'holy' },
      { name: 'Cosmic Sentinel', type: 'golem', hue: 220, scale: 0.6, element: 'holy' },
      { name: 'Star-Woven Watcher', type: 'ice_elemental', hue: 60, element: 'lightning' },
      { name: 'Nebula Sprite', type: 'slime', hue: 130, element: 'holy' }
    ]
  },
  {
    floor: 8,
    name: 'Dread Citadel',
    theme: 'dungeon_dread',
    color: '#a855f7',
    icon: 'skull',
    bg: '#10061c',
    minLevel: 106,
    maxLevel: 120,
    bossName: 'Deathlord Nazgrak',
    subtitle: 'Lv. 106 - 120 • Dark Basalt & Cursed Death Knights',
    element: 'dark',
    mobs: [
      { name: 'Death Knight', type: 'skeleton', scale: 1.25, element: 'dark' },
      { name: 'Soul-Reaper', type: 'skeleton', element: 'dark' },
      { name: 'Nether Stalker', type: 'frost_wolf', hue: 70, element: 'dark' },
      { name: 'Shadow Assassin', type: 'goblin', hue: 128, element: 'dark' }
    ]
  },
  {
    floor: 9,
    name: "Dragon's Maw",
    theme: 'dungeon_dragon',
    color: '#f59e0b',
    icon: 'flame',
    bg: '#140c04',
    minLevel: 121,
    maxLevel: 135,
    bossName: 'Ancient Drake Imperator',
    subtitle: 'Lv. 121 - 135 • Scorched Wyrm Sanctum & Drake Berserkers',
    element: 'fire',
    mobs: [
      { name: 'Wyrm Berserker', type: 'skeleton', scale: 1.2, element: 'fire' },
      { name: 'Dragonbone Champion', type: 'golem', hue: 195, scale: 0.65, element: 'earth' },
      { name: 'Fire-Scale Stalker', type: 'frost_wolf', hue: 180, element: 'fire' },
      { name: 'Drake Wyrmling', type: 'frost_wolf', hue: 190, scale: 0.8, element: 'fire' }
    ]
  },
  {
    floor: 10,
    name: 'Throne of Oblivion',
    theme: 'dungeon_oblivion',
    color: '#ec4899',
    icon: 'whirl',
    bg: '#16041a',
    minLevel: 136,
    maxLevel: 150,
    bossName: 'Primordial Titan of Chaos',
    subtitle: 'Lv. 136 - 150 • Cataclysmic Chaos & Reality Tears',
    element: 'dark',
    mobs: [
      { name: 'Chaos Templar', type: 'skeleton', scale: 1.25, element: 'dark' },
      { name: 'Cataclysm Harvester', type: 'golem', hue: 130, scale: 0.65, element: 'dark' },
      { name: 'Oblivion Fiend', type: 'ice_elemental', hue: 130, element: 'fire' },
      { name: 'Rift Aberration', type: 'slime', hue: 180, element: 'dark' }
    ]
  }
];

// What makes each floor its own place beyond colour: room architecture,
// liquids and hazards, props, and the boss's body
const FLOOR_STYLES = {
  dungeon_crypt: {
    layout: 'pillars',
    props: [{ type: 'sarcophagus' }, { type: 'bone_pile' }, { type: 'brazier', hue: 180 }],
    boss: { type: 'skeleton', scale: 2.3 }
  },
  dungeon_sunken: {
    layout: 'flooded',
    props: [{ type: 'boulder', hue: 120 }, { type: 'bone_pile' }, { type: 'stone_pillar', hue: 120 }],
    boss: { type: 'slime', scale: 3, hue: 35 }
  },
  dungeon_obsidian: {
    layout: 'cave',
    props: [{ type: 'boulder' }, { type: 'ice_crystal', hue: 165 }, { type: 'brazier' }],
    boss: { type: 'golem', hue: 195, scale: 1.1 }
  },
  dungeon_glacial: {
    layout: 'round',
    props: [{ type: 'ice_crystal' }, { type: 'frost_monolith' }, { type: 'boulder', hue: 190 }],
    boss: { type: 'frost_titan' }
  },
  dungeon_toxic: {
    layout: 'acid',
    props: [{ type: 'giant_mushroom', hue: 100 }, { type: 'dead_tree' }, { type: 'bone_pile' }],
    boss: { type: 'slime', scale: 3.2 }
  },
  dungeon_infernal: {
    layout: 'moat',
    props: [{ type: 'brazier' }, { type: 'ice_crystal', hue: 160 }, { type: 'bone_pile' }],
    boss: { type: 'golem', hue: 170, scale: 1.15 }
  },
  dungeon_celestial: {
    layout: 'islands',
    props: [{ type: 'ice_crystal', hue: 220 }, { type: 'frost_monolith', hue: 60 }, { type: 'stone_pillar', hue: 40 }],
    boss: { type: 'ice_elemental', hue: 220, scale: 3 }
  },
  dungeon_dread: {
    layout: 'colonnade',
    props: [{ type: 'sarcophagus', hue: 250 }, { type: 'brazier', hue: 250 }, { type: 'bone_pile' }],
    boss: { type: 'skeleton', scale: 2.6 }
  },
  dungeon_dragon: {
    layout: 'lair',
    props: [{ type: 'gold_hoard' }, { type: 'bone_pile' }, { type: 'boulder', hue: 20 }],
    boss: { type: 'frost_wolf', hue: 185, scale: 2.8 }
  },
  dungeon_oblivion: {
    layout: 'shattered',
    props: [{ type: 'ice_crystal', hue: 130 }, { type: 'frost_monolith', hue: 130 }, { type: 'boulder', hue: 280 }],
    boss: { type: 'golem', hue: 130, scale: 1.2 }
  }
};

// Carve one 9x9 room's architecture (local coords 0..8, centre 4,4). Pillars
// are VOID here and become wall columns in the perimeter pass. If a layout
// would cut a doorway off from the centre, the room falls back to plain floor.
function shapeRoom(tiles, r, style, calm) {
  const F = DUNGEON_TILES.FLOOR, T = FEATURE_TILES;
  const get = (lx, ly) => tiles[r.y + ly][r.x + lx];
  const set = (lx, ly, t) => { tiles[r.y + ly][r.x + lx] = t; };
  const each = (fn) => { for (let ly = 0; ly < 9; ly++) for (let lx = 0; lx < 9; lx++) fn(lx, ly); };
  const spine = (lx, ly) => (lx >= 3 && lx <= 5) || (ly >= 3 && ly <= 5);
  const cheb = (lx, ly) => Math.max(Math.abs(lx - 4), Math.abs(ly - 4));
  const edge = (lx, ly) => Math.min(lx, 8 - lx, ly, 8 - ly);
  const pillar = (lx, ly) => set(lx, ly, DUNGEON_TILES.VOID);
  const scatter = (t: number, chance: number, where: (lx: number, ly: number) => boolean = () => true) => each((lx, ly) => {
    if (get(lx, ly) === F && where(lx, ly) && Math.random() < chance) set(lx, ly, t);
  });
  const blob = (t, n, rad) => {
    for (let i = 0; i < n; i++) {
      const bx = 1 + Math.random() * 6, by = 1 + Math.random() * 6;
      each((lx, ly) => { if (get(lx, ly) === F && Math.hypot(lx - bx, ly - by) <= rad) set(lx, ly, t); });
    }
  };
  const erode = (outer, inner) => each((lx, ly) => {
    if (spine(lx, ly)) return;
    const e = edge(lx, ly);
    if ((e === 0 && Math.random() < outer) || (e === 1 && Math.random() < inner)) pillar(lx, ly);
  });

  switch (style.layout) {
    case 'pillars':
      for (const [lx, ly] of [[2, 2], [6, 2], [2, 6], [6, 6]]) pillar(lx, ly);
      break;
    case 'flooded': // corner pools ringed by chilling shallows
      each((lx, ly) => {
        if (spine(lx, ly)) return;
        set(lx, ly, Math.min(lx, 8 - lx) + Math.min(ly, 8 - ly) <= 1 ? T.WATER : T.SHALLOWS);
      });
      scatter(T.SHALLOWS, 0.1);
      break;
    case 'cave': // ragged rock walls, rubble and smouldering cracks
      erode(0.65, 0.3);
      scatter(T.EMBERS, 0.1, (lx, ly) => !spine(lx, ly));
      scatter(T.RUBBLE, 0.12);
      break;
    case 'round': // rounded chamber with patches of slick frost
      each((lx, ly) => { if (Math.hypot(lx - 4, ly - 4) > 4.6) pillar(lx, ly); });
      blob(T.FROST, 3, 1.3);
      break;
    case 'acid':
      blob(T.ACID, 3, 1.5);
      break;
    case 'moat': // a lava ring around the centre, crossed by four bridges
      each((lx, ly) => {
        const d = cheb(lx, ly);
        if (d === 2 && lx !== 4 && ly !== 4) set(lx, ly, T.LAVA);
        else if (d >= 3 && Math.random() < 0.15) set(lx, ly, T.EMBERS);
      });
      break;
    case 'islands': // a floating platform: the corners fall away into the stars
      each((lx, ly) => { if (Math.abs(lx - 4) + Math.abs(ly - 4) >= 6) set(lx, ly, T.STARS); });
      for (const [lx, ly] of [[2, 2], [6, 2], [2, 6], [6, 6]]) set(lx, ly, T.STARS);
      break;
    case 'colonnade': // two rows of columns and pools of clinging shadow
      for (const lx of [2, 6]) for (const ly of [0, 2, 6, 8]) pillar(lx, ly);
      scatter(T.SHADOW, 0.12, (lx, ly) => !spine(lx, ly));
      break;
    case 'lair': // scorched cavern with a lava pit in one corner
      erode(0.45, 0.15);
      {
        const cx = Math.random() < 0.5 ? 1 : 7, cy = Math.random() < 0.5 ? 1 : 7;
        each((lx, ly) => { if (get(lx, ly) === F && Math.hypot(lx - cx, ly - cy) <= 1.2) set(lx, ly, T.LAVA); });
      }
      scatter(T.SCORCH, 0.18);
      break;
    case 'shattered': // reality torn open: star pits and burning rifts
      scatter(T.STARS, 0.28, (lx, ly) => !spine(lx, ly));
      scatter(T.RIFT, 0.1);
      break;
  }

  // Doorway mouths and the centre stay open; the entrance is free of hazards
  for (let k = 3; k <= 5; k++) for (const [lx, ly] of [[0, k], [8, k], [k, 0], [k, 8]]) set(lx, ly, F);
  set(4, 4, F);
  if (calm) each((lx, ly) => { if (DUNGEON_HAZARDS[get(lx, ly)]) set(lx, ly, F); });

  // Flood from the centre; every doorway mouth must be reachable
  const walk = (t) => OPEN_TILES.has(t) && !BLOCKING_FEATURES.has(t);
  const seen = new Set(['4,4']);
  const queue = [[4, 4]];
  while (queue.length) {
    const [lx, ly] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = lx + dx, ny = ly + dy;
      if (nx < 0 || ny < 0 || nx > 8 || ny > 8 || seen.has(nx + ',' + ny) || !walk(get(nx, ny))) continue;
      seen.add(nx + ',' + ny);
      queue.push([nx, ny]);
    }
  }
  if (![[0, 4], [8, 4], [4, 0], [4, 8]].every(([lx, ly]) => seen.has(lx + ',' + ly))) {
    each((lx, ly) => set(lx, ly, F));
    return;
  }
  // Seal walkable pockets nobody could reach
  each((lx, ly) => { if (walk(get(lx, ly)) && !seen.has(lx + ',' + ly)) pillar(lx, ly); });
}

function generateProceduralDungeon(floorLevel = 1, difficulty = 'normal') {
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;

  // 1. Grid layout: grow a random tree of rooms from the entrance cell
  const roomTarget = roomCountFor(floorLevel, diff.id);
  // square grid with ~2.25 cells per room, so the random tree has room to branch
  const grid = Math.max(4, Math.ceil(Math.sqrt(roomTarget * 2.25)));
  const width = grid * ROOM_CELL + 4;
  const height = grid * ROOM_CELL + 4;
  const tiles = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) tiles[y][x] = DUNGEON_TILES.VOID;
  }

  const key = (cx, cy) => cx + ',' + cy;
  const start = { cx: Math.floor(Math.random() * grid), cy: grid - 1 };
  const cells = new Map([[key(start.cx, start.cy), { ...start, parent: null, depth: 0 }]]);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (cells.size < roomTarget) {
    const frontier = [];
    for (const c of cells.values()) {
      for (const [dx, dy] of DIRS) {
        const nx = c.cx + dx, ny = c.cy + dy;
        if (nx < 0 || ny < 0 || nx >= grid || ny >= grid || cells.has(key(nx, ny))) continue;
        frontier.push({ from: c, cx: nx, cy: ny });
      }
    }
    if (!frontier.length) break;
    const pick = frontier[Math.floor(Math.random() * frontier.length)];
    cells.set(key(pick.cx, pick.cy), { cx: pick.cx, cy: pick.cy, parent: pick.from, depth: pick.from.depth + 1 });
  }

  // Boss room = the dead-end cell physically farthest from the entrance (ties
  // go to the deeper one), so it never sits right beside the spawn room.
  // Entrance first, boss last, the rest by depth
  const cellList = [...cells.values()];
  const isParent = new Set(cellList.map(c => c.parent).filter(Boolean));
  const gridDist = c => Math.abs(c.cx - start.cx) + Math.abs(c.cy - start.cy);
  const bossCell = cellList
    .filter(c => c.parent && !isParent.has(c))
    .reduce((a, b) => (gridDist(b) > gridDist(a) || (gridDist(b) === gridDist(a) && b.depth > a.depth) ? b : a));
  const ordered = [cellList.find(c => c.parent === null),
    ...cellList.filter(c => c.parent && c !== bossCell).sort((a, b) => a.depth - b.depth),
    bossCell];

  const rooms: any[] = ordered.map((c: any, i) => {
    const x = 2 + c.cx * ROOM_CELL + 1, y = 2 + c.cy * ROOM_CELL + 1;
    const room = { x, y, w: ROOM_INNER, h: ROOM_INNER, cx: x + Math.floor(ROOM_INNER / 2), cy: y + Math.floor(ROOM_INNER / 2), cell: c, kind: 'combat' };
    c.room = room;
    c.index = i;
    return room;
  });
  rooms[0].kind = 'entrance';
  rooms[rooms.length - 1].kind = 'boss';
  // A few mob-free treasure rooms along the way, and 1-2 miniboss rooms in the middle depths
  const combatRoomIndices = [];
  rooms.forEach((r, i) => {
    if (i > 0 && i < rooms.length - 1) {
      if (Math.random() < 0.12) r.kind = 'treasure';
      else combatRoomIndices.push(i);
    }
  });

  // Pick 1 to 2 rooms from combat rooms to contain a Miniboss
  const minibossCount = combatRoomIndices.length >= 6 ? 2 : (combatRoomIndices.length >= 3 ? 1 : 0);
  const midIndices = combatRoomIndices.filter(idx => idx > 1);
  for (let m = 0; m < minibossCount && midIndices.length > 0; m++) {
    const pickIdx = midIndices.splice(Math.floor(midIndices.length / 2), 1)[0];
    if (rooms[pickIdx]) rooms[pickIdx].kind = 'miniboss';
  }

  for (const r of rooms) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) tiles[y][x] = DUNGEON_TILES.FLOOR;
  }
  const style = FLOOR_STYLES[(DUNGEON_FLOORS[floorLevel - 1] || DUNGEON_FLOORS[0]).theme] || FLOOR_STYLES.dungeon_crypt;
  for (const r of rooms) shapeRoom(tiles, r, style, r.kind === 'entrance');

  // Doorways between each room and its parent. They stay VOID here and become
  // walls in the perimeter pass; the server carves them open when unlocked.
  const doors = [];
  for (const c of ordered) {
    if (!c.parent) continue;
    const a = (c.parent as any).room, b = (c as any).room;
    const doorTiles = [];
    if (a.cell.cy === b.cell.cy) {
      const left = a.x < b.x ? a : b;
      const midY = left.cy - Math.floor(DOOR_WIDTH / 2);
      for (let gx = left.x + left.w; gx < left.x + left.w + 2; gx++) {
        for (let k = 0; k < DOOR_WIDTH; k++) doorTiles.push([gx, midY + k]);
      }
    } else {
      const top = a.y < b.y ? a : b;
      const midX = top.cx - Math.floor(DOOR_WIDTH / 2);
      for (let gy = top.y + top.h; gy < top.y + top.h + 2; gy++) {
        for (let k = 0; k < DOOR_WIDTH; k++) doorTiles.push([midX + k, gy]);
      }
    }
    const xs = doorTiles.map(t => t[0]), ys = doorTiles.map(t => t[1]);
    doors.push({
      id: 'door_' + doors.length,
      from: (c.parent as any).index,
      to: (c as any).index,
      boss: c === bossCell,
      tiles: doorTiles,
      // tile centres sit on whole numbers, so the doorway's centre is the mean
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
      axis: a.cell.cy === b.cell.cy ? 'x' : 'y',
      open: false
    });
  }

  // Rooms are sent to clients: keep plain grid coordinates, not the cell
  // objects (cells link back to their rooms, which can't be serialised)
  for (const r of rooms) {
    r.grid = { x: r.cell.cx, y: r.cell.cy };
    delete r.cell;
  }

  const spawnRoom = rooms[0];
  const bossRoom = rooms[rooms.length - 1];
  const spawnPoint = { x: spawnRoom.cx + 0.5, y: spawnRoom.cy + 0.5 };

  // No portals inside: heroes leave with the Return to Town button, and the
  // boss is reached through its door

  // Random floor tile inside a room
  const randomFloor = (r, margin = 1) => {
    for (let tries = 0; tries < 40; tries++) {
      const x = r.x + margin + Math.random() * (r.w - margin * 2);
      const y = r.y + margin + Math.random() * (r.h - margin * 2);
      // clear of pillars and pools by a body's radius, so nothing spawns stuck
      const clear = [[0, 0], [0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]]
        .every(([dx, dy]) => tiles[Math.floor(y + dy)][Math.floor(x + dx)] === DUNGEON_TILES.FLOOR);
      if (clear) return { x, y };
    }
    return { x: r.cx + 0.5, y: r.cy + 0.5 };
  };

  // 3.5. Form Wall Perimeter: Any non-floor tile touching a floor becomes a solid 3D WALL
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!OPEN_TILES.has(tiles[y][x])) {
        let touchesFloor = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              if (OPEN_TILES.has(tiles[ny][nx])) {
                touchesFloor = true;
                break;
              }
            }
          }
          if (touchesFloor) break;
        }

        if (touchesFloor) {
          tiles[y][x] = DUNGEON_TILES.WALL; // 7
        } else {
          tiles[y][x] = DUNGEON_TILES.VOID; // 8
        }
      }
    }
  }

  // 4. Place Obstacles, Torches & Treasure Chests
  const obstacles = [];
  const chests = [];
  let nextEntityId = 5000;

  // Sealed doorways (removed by the server as rooms are cleared)
  const doorTileSet = new Set(doors.flatMap(d => d.tiles.map(([x, y]) => x + ',' + y)));
  for (const d of doors) {
    obstacles.push({ id: d.id, x: d.x, y: d.y, type: 'dungeon_door', axis: d.axis, boss: d.boss, tiles: d.tiles, collidable: false });
  }

  // Wall-mounted torches on the room's back walls (the north and west walls
  // are the tall ones facing the camera). side 'left' = sconce on the face
  // toward +y, 'right' = toward +x.
  rooms.forEach((r, idx) => {
    const sconces = [
      { x: r.x + Math.floor(r.w / 3), y: r.y - 1, side: 'left' },
      { x: r.x + Math.floor((r.w * 2) / 3), y: r.y - 1, side: 'left' },
      { x: r.x - 1, y: r.y + Math.floor(r.h / 2), side: 'right' }
    ];
    sconces.forEach((sc, sIdx) => {
      // never on a sealed doorway: it opens into floor and the torch would float
      if (tiles[sc.y] && tiles[sc.y][sc.x] === DUNGEON_TILES.WALL && !doorTileSet.has(sc.x + ',' + sc.y)) {
        obstacles.push({
          id: `dungeon_torch_${idx}_${sIdx}`,
          x: sc.x,
          y: sc.y,
          type: 'wall_torch',
          side: sc.side,
          collidable: false
        });
      }
    });

    // Themed props on plain floor away from the centre cross
    const propCount = 2 + Math.floor(Math.random() * 3);
    for (let p = 0, tries = 0; p < propCount && tries < 30; tries++) {
      const lx = 1 + Math.floor(Math.random() * 7), ly = 1 + Math.floor(Math.random() * 7);
      const t = tiles[r.y + ly][r.x + lx];
      if ((lx >= 3 && lx <= 5) || (ly >= 3 && ly <= 5) || !OPEN_TILES.has(t) || BLOCKING_FEATURES.has(t)) continue;
      const prop = style.props[Math.floor(Math.random() * style.props.length)];
      obstacles.push({ id: `dungeon_prop_${idx}_${p}`, x: r.x + lx + 0.5, y: r.y + ly + 0.5, type: prop.type, hue: prop.hue || 0, collidable: false });
      p++;
    }

    // Place Treasure Chests in rooms (except spawn room)
    if (idx !== 0) {
      const isBossRoom = idx === rooms.length - 1;
      const chestCount = isBossRoom ? (diff.id === 'nightmare' ? 3 : 2) : r.kind === 'treasure' ? 2 : (Math.random() < 0.6 ? 1 : 0);
      for (let c = 0; c < chestCount; c++) {
        const spot = randomFloor(r, 2);
        const chestX = Math.floor(spot.x);
        const chestY = Math.floor(spot.y);
        chests.push({
          id: `chest_${nextEntityId++}`,
          x: chestX,
          y: chestY,
          isGold: isBossRoom || r.kind === 'treasure' || (diff.id === 'nightmare' && Math.random() < 0.4),
          opened: false,
          floorLevel,
          difficulty: diff.id
        });
      }
    }
  });

  // Helper to roll random unique affixes
  function rollAffixes(count, isBoss = false) {
    const pool = [...AFFIX_POOL];
    const chosen = [];
    while (chosen.length < count && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      chosen.push(pool.splice(idx, 1)[0].id);
    }
    return chosen;
  }

  // 5. Populate Dungeon Monsters with Difficulty & Affixes
  const mobs = [];
  rooms.forEach((r, idx) => {
    if (idx === 0 || r.kind === 'treasure') return; // Entrance and treasure rooms are safe

    const isBossRoom = idx === rooms.length - 1;

    if (isBossRoom) {
      // Dungeon Boss!
      const floorConfig = DUNGEON_FLOORS[floorLevel - 1] || DUNGEON_FLOORS[0];
      const bossAffixes = diff.id === 'normal' ? [] :
                          diff.id === 'hard' ? rollAffixes(2, true) :
                          rollAffixes(3, true);
      const isCommander = diff.id !== 'normal'; // Boss is always commander on Hard & Nightmare

      const bossLevel = floorConfig.maxLevel + (diff.id === 'nightmare' ? 5 : diff.id === 'hard' ? 2 : 0);
      // Balanced HP: reduced by ~40% for faster, more engaging combat
      let bossHp = Math.round((380 + bossLevel * 85 + Math.pow(bossLevel, 1.15) * 6) * diff.hpMult * DUNGEON_MOB_HP_SCALE);
      let bossDef = Math.round(12 + bossLevel * 1.6);
      if (bossAffixes.includes('fortified')) {
        bossHp = Math.round(bossHp * 1.4);
        bossDef += 10;
      }

      // Elemental assignment for bosses based on floor theme
      const bossElement = floorConfig.element || 'dark';
      const bossResists: Record<string, number> = {};
      if (bossElement === 'fire') { bossResists.ice = -0.5; bossResists.fire = 0.6; }
      else if (bossElement === 'ice') { bossResists.fire = -0.5; bossResists.ice = 0.6; }
      else if (bossElement === 'lightning') { bossResists.earth = -0.5; bossResists.lightning = 0.6; }
      else if (bossElement === 'holy') { bossResists.dark = -0.5; bossResists.holy = 0.6; }
      else if (bossElement === 'earth') { bossResists.fire = -0.5; bossResists.earth = 0.6; }
      else if (bossElement === 'dark') { bossResists.holy = -0.65; bossResists.dark = 0.6; }

      mobs.push({
          roomIdx: idx,
        id: `mob_${nextEntityId++}`,
        type: style.boss.type,
        hue: style.boss.hue || 0,
        scale: style.boss.scale || 1,
        name: `👑 ${floorConfig.bossName} [Boss Lv. ${bossLevel}]`,
        level: bossLevel,
        x: r.cx,
        y: r.cy,
        spawnX: r.cx,
        spawnY: r.cy,
        zone: { minX: r.x, maxX: r.x + r.w, minY: r.y, maxY: r.y + r.h },
        isBoss: true,
        hp: bossHp,
        maxHp: bossHp,
        dmg: Math.round((26 + bossLevel * 3.8) * diff.dmgMult),
        def: bossDef,
        speed: 2.3,
        element: bossElement,
        elementResist: bossResists,
        exp: Math.round(mobExp(bossLevel, 'boss') * diff.expMult),
        gold: Math.round((180 + bossLevel * 45) * diff.goldMult),
        buffs: bossAffixes,
        isCommander,
        auraRadius: isCommander ? 6.5 : 0,
        targetPlayerId: null,
        state: 'idle',
        nextWanderTime: Date.now() + 2000,
        wanderTarget: null,
        attackCooldown: 0,
        respawnTimer: Infinity,
        facing: 'SE'
      });

      // Spawn Royal Guard minions alongside the Boss (6 minions with balanced HP)
      for (let g = 0; g < 6; g++) {
        const minionLvl = Math.max(1, bossLevel - 2);
        const { x: gx, y: gy } = randomFloor(r, 2);
        const minionHp = Math.round((140 + minionLvl * 32) * diff.hpMult * DUNGEON_MOB_HP_SCALE);
        mobs.push({
          roomIdx: idx,
          id: `mob_${nextEntityId++}`,
          type: 'skeleton',
          name: `💀 Royal Deathguard [Lv. ${minionLvl}]`,
          level: minionLvl,
          x: gx,
          y: gy,
          spawnX: gx,
          spawnY: gy,
          zone: { minX: r.x, maxX: r.x + r.w, minY: r.y, maxY: r.y + r.h },
          isBoss: false,
          hp: minionHp,
          maxHp: minionHp,
          dmg: Math.round((20 + minionLvl * 2.8) * diff.dmgMult),
          def: Math.round(10 + minionLvl * 1.3),
          speed: 2.2,
          element: 'dark',
          elementResist: { holy: -0.6, fire: -0.25, dark: 0.4 },
          exp: Math.max(1, Math.round(mobExp(minionLvl) * diff.expMult * DUNGEON_TRASH_FACTOR)),
          gold: Math.round((40 + minionLvl * 12) * diff.goldMult),
          buffs: ['fortified'],
          isCommander: false,
          auraRadius: 0,
          targetPlayerId: null,
          state: 'idle',
          nextWanderTime: Date.now() + 2000,
          wanderTarget: null,
          attackCooldown: 0,
          respawnTimer: Infinity,
          facing: 'SE'
        });
      }
    } else if (r.kind === 'miniboss') {
      // Dungeon Miniboss Room! Only spawns in designated miniboss rooms
      const floorConfig = DUNGEON_FLOORS[floorLevel - 1] || DUNGEON_FLOORS[0];
      const mbLevel = Math.max(1, floorConfig.maxLevel - 1 + (diff.id === 'nightmare' ? 3 : diff.id === 'hard' ? 1 : 0));
      const mbAffixes = rollAffixes(2, true);
      const isCommander = true;

      const mbTitles = [
        'Dread Revenant', 'Void Executioner', 'Bloodfang Behemoth', 
        'Ancient Doomguard', 'Shadowflame Sovereign', 'Cursed Goliath'
      ];
      const mbTitle = mbTitles[(floorLevel + idx) % mbTitles.length];
      const mbHp = Math.round((260 + mbLevel * 45 + Math.pow(mbLevel, 1.1) * 4) * diff.hpMult * DUNGEON_MOB_HP_SCALE * 1.5);
      const mbDef = Math.round(10 + mbLevel * 1.4);
      const mbElementTable = ['dark', 'fire', 'ice', 'lightning'];
      const mbElement = mbElementTable[(floorLevel + idx) % mbElementTable.length];

      mobs.push({
        roomIdx: idx,
        id: `mob_${nextEntityId++}`,
        type: 'golem',
        name: `⚔️ [Miniboss] ${mbTitle} [Lv. ${mbLevel}]`,
        level: mbLevel,
        x: r.cx,
        y: r.cy,
        spawnX: r.cx,
        spawnY: r.cy,
        zone: { minX: r.x, maxX: r.x + r.w, minY: r.y, maxY: r.y + r.h },
        isBoss: false,
        isMiniboss: true,
        hp: mbHp,
        maxHp: mbHp,
        dmg: Math.round((20 + mbLevel * 2.8) * diff.dmgMult),
        def: mbDef,
        speed: 2.35,
        element: mbElement,
        elementResist: mbElement === 'fire' ? { ice: -0.4, fire: 0.5 } : { holy: -0.5, dark: 0.5 },
        exp: Math.round(mobExp(mbLevel, 'boss') * 0.45 * diff.expMult),
        gold: Math.round((35 + mbLevel * 8) * diff.goldMult),
        buffs: mbAffixes,
        isCommander,
        auraRadius: 5.5,
        targetPlayerId: null,
        state: 'idle',
        nextWanderTime: Date.now() + 2000,
        wanderTarget: null,
        attackCooldown: 0,
        respawnTimer: Infinity,
        facing: 'SE'
      });

      // Miniboss Bodyguards (4 minions)
      for (let g = 0; g < 4; g++) {
        const minionLvl = Math.max(1, mbLevel - 2);
        const { x: gx, y: gy } = randomFloor(r);
        const minionHp = Math.round((110 + minionLvl * 24) * diff.hpMult * DUNGEON_MOB_HP_SCALE);
        mobs.push({
          roomIdx: idx,
          id: `mob_${nextEntityId++}`,
          type: 'skeleton',
          name: `💀 Elite Guardian [Lv. ${minionLvl}]`,
          level: minionLvl,
          x: gx,
          y: gy,
          spawnX: gx,
          spawnY: gy,
          zone: { minX: r.x, maxX: r.x + r.w, minY: r.y, maxY: r.y + r.h },
          isBoss: false,
          hp: minionHp,
          maxHp: minionHp,
          dmg: Math.round((16 + minionLvl * 2.2) * diff.dmgMult),
          def: Math.round(8 + minionLvl * 1.2),
          speed: 2.2,
          element: 'dark',
          elementResist: { holy: -0.5, dark: 0.3 },
          exp: Math.max(1, Math.round(mobExp(minionLvl) * diff.expMult * DUNGEON_TRASH_FACTOR)),
          gold: Math.round((10 + minionLvl * 3) * diff.goldMult),
          buffs: ['fortified'],
          isCommander: false,
          auraRadius: 0,
          targetPlayerId: null,
          state: 'idle',
          nextWanderTime: Date.now() + 2000,
          wanderTarget: null,
          attackCooldown: 0,
          respawnTimer: Infinity,
          facing: 'SE'
        });
      }
    } else {
      // Normal Dungeon Mobs: Balanced density (12 - 16 mobs per room)
      const floorConfig = DUNGEON_FLOORS[floorLevel - 1] || DUNGEON_FLOORS[0];
      const baseCount = Math.floor(Math.random() * 4) + 6;
      const mobCount = Math.round(baseCount * diff.densityMult);

      // Check if this room has a pack Commander
      const roomHasCommander = diff.commanderChance > 0 && Math.random() < diff.commanderChance;
      let commanderAssigned = false;

      for (let m = 0; m < mobCount; m++) {
        // Select mob template from current floor's thematic mob roster
        const mobTemplate = (floorConfig.mobs && floorConfig.mobs.length > 0)
          ? floorConfig.mobs[Math.floor(Math.random() * floorConfig.mobs.length)]
          : { name: 'Dungeon Skeleton', type: 'skeleton', element: 'dark' };
        const mobType = mobTemplate.type;
        const { x: mx, y: my } = randomFloor(r);

        // Roll mob level within floor bracket (e.g. Lv. 1-14 on F1, Lv. 136-149 on F10)
        const mobLvl = Math.floor(floorConfig.minLevel + (Math.random() * (floorConfig.maxLevel - floorConfig.minLevel)));

        // Roll Affixes
        const numAffixes = Math.floor(Math.random() * (diff.affixMax - diff.affixMin + 1)) + diff.affixMin;
        const mobAffixes = rollAffixes(numAffixes);

        const isCommander = roomHasCommander && !commanderAssigned;
        if (isCommander) {
          commanderAssigned = true;
          if (!mobAffixes.includes('commander')) mobAffixes.push('commander');
        }

        const baseHp = mobType === 'skeleton' ? 120 : 90;
        let hp = Math.round((baseHp + mobLvl * 26 + Math.pow(mobLvl, 1.1) * 3) * diff.hpMult * DUNGEON_MOB_HP_SCALE);
        let def = Math.round(6 + mobLvl * 1.2);
        if (mobAffixes.includes('fortified')) {
          hp = Math.round(hp * 1.4);
          def += 8;
        }

        let prefix = '';
        if (isCommander) prefix = '👑 Commander ';
        else if (mobAffixes.length > 0) {
          const affixIcons = mobAffixes.map(a => {
            const af = AFFIX_POOL.find(p => p.id === a);
            return af ? af.icon : '';
          }).join('');
          prefix = `${affixIcons} `;
        }

        const mobBaseName = mobTemplate.name;
        const mobElem = mobTemplate.element || 'dark';
        const mobResists = mobElem === 'fire' ? { ice: -0.4, fire: 0.4 } :
                           mobElem === 'ice' ? { fire: -0.4, ice: 0.4 } :
                           mobElem === 'holy' ? { dark: -0.4, holy: 0.4 } :
                           mobElem === 'earth' ? { fire: -0.4, earth: 0.4 } :
                           { holy: -0.6, fire: -0.2, dark: 0.3 };

        mobs.push({
          roomIdx: idx,
          id: `mob_${nextEntityId++}`,
          type: mobType,
          hue: mobTemplate.hue || 0,
          scale: mobTemplate.scale || 1,
          name: `${prefix}${mobBaseName} (Lv. ${mobLvl})`,
          level: mobLvl,
          x: mx,
          y: my,
          spawnX: mx,
          spawnY: my,
          zone: { minX: r.x, maxX: r.x + r.w, minY: r.y, maxY: r.y + r.h },
          isBoss: false,
          hp,
          maxHp: hp,
          dmg: Math.round((15 + mobLvl * 2.2) * diff.dmgMult),
          def,
          speed: 2.3,
          element: mobElem,
          elementResist: mobResists,
          exp: Math.max(1, Math.round(mobExp(mobLvl) * diff.expMult * DUNGEON_TRASH_FACTOR)),
          gold: Math.round((25 + mobLvl * 8) * diff.goldMult),
          buffs: mobAffixes,
          isCommander,
          auraRadius: isCommander ? 5.5 : 0,
          targetPlayerId: null,
          state: 'idle',
          nextWanderTime: Date.now() + 2000,
          wanderTarget: null,
          attackCooldown: 0,
          respawnTimer: Infinity,
          facing: 'SE'
        });
      }
    }
  });

  for (const m of mobs) {
    m.maxHp = Math.round(m.maxHp * mobHpMult(m.level));
    m.hp = m.maxHp;
  }

  const floorConfig = DUNGEON_FLOORS[floorLevel - 1] || DUNGEON_FLOORS[0];
  return {
    width,
    height,
    tiles,
    rooms,
    bossRoom,
    spawnPoint,
    doors,
    obstacles,
    chests,
    mobs,
    floorLevel,
    theme: floorConfig.theme,
    name: floorConfig.name,
    subtitle: floorConfig.subtitle,
    color: floorConfig.color,
    icon: floorConfig.icon,
    bg: floorConfig.bg,
    isDungeon: true
  };
};

// Generate Loot Table for Chests or Monsters
function rollDungeonLoot(isBoss = false, floorLevel = 1, cls = null) {
  const drops = [];

  // Gold drops
  const goldAmount = isBoss ? Math.floor(120 + Math.random() * 150 * floorLevel) :
                              Math.floor(20 + Math.random() * 35 * floorLevel);
  drops.push({ type: 'gold', amount: goldAmount, name: `${goldAmount} Gold Coins` });

  // Potions & Consumables
  if (Math.random() < 0.45) {
    drops.push({ type: 'item', itemId: 'health_potion', amount: 1 });
  }
  if (Math.random() < 0.35) {
    drops.push({ type: 'item', itemId: 'mana_potion', amount: 1 });
  }
  if (Math.random() < 0.18) {
    const rareConsumables = ['revival_stone', 'greater_health_potion', 'greater_mana_potion', 'elixir_of_fury', 'elixir_of_iron', 'town_scroll'];
    const chosen = rareConsumables[Math.floor(Math.random() * rareConsumables.length)];
    drops.push({ type: 'item', itemId: chosen, amount: 1 });
  }

  // Valuable Relics / Treasures to sell in shop for Gold
  const relicPool = ['ancient_ruby', 'cursed_chalice', 'shadow_essence'];
  const relicChance = isBoss ? 0.85 : 0.40;
  if (Math.random() < relicChance) {
    const relicId = isBoss && Math.random() > 0.35 ?
      (Math.random() > 0.5 ? 'golden_idol' : 'dragon_scale') :
      relicPool[Math.floor(Math.random() * relicPool.length)];
    drops.push({ type: 'item', itemId: relicId, amount: 1 });
  }

  // Rare Equipment Drops (Significantly reduced drop rates + randomized stats!)
  // Normal chests: ~12% chance (gear is a hard-earned reward!)
  // Boss chests: ~35% chance
  const gearChance = isBoss ? 0.35 : 0.12;
  if (Math.random() < gearChance) {
    // item level from the floor's level band (gold chests roll at its top)
    const band = DUNGEON_FLOORS[floorLevel - 1] || { minLevel: floorLevel * 15 - 14, maxLevel: floorLevel * 15 };
    const itemLevel = isBoss ? band.maxLevel : band.minLevel + Math.floor(Math.random() * (band.maxLevel - band.minLevel + 1));
    const gearId = pickGearForLevel(itemLevel, { boss: isBoss, cls });
    const customGear = generateRandomizedGear(gearId, itemLevel, isBoss);
    drops.push({ type: 'item', itemId: gearId, customItemData: customGear, amount: 1 });
  }

  return drops;
}

export {
  DUNGEON_WIDTH,
  DUNGEON_HEIGHT,
  DUNGEON_TILES,
  DIFFICULTIES,
  AFFIX_POOL,
  DUNGEON_FLOORS,
  BLOCKING_FEATURES,
  DUNGEON_HAZARDS,
  generateProceduralDungeon,
  rollDungeonLoot
};
module.exports = {
  DUNGEON_WIDTH,
  DUNGEON_HEIGHT,
  DUNGEON_TILES,
  DIFFICULTIES,
  AFFIX_POOL,
  DUNGEON_FLOORS,
  BLOCKING_FEATURES,
  DUNGEON_HAZARDS,
  generateProceduralDungeon,
  rollDungeonLoot
};



