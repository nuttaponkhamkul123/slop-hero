// Open-world field zones, chained by level from Frostfell (Lv 6) to Lv 100.
// Each zone is a 42x42 map entered from the south (portal back to the previous
// zone) with a portal to the next zone on its far north side.
const { MAP_WIDTH, MAP_HEIGHT, generateFrostfellMap } = require('./mapData');
const { mobExp } = require('./progression');

// Themed ground tiles (13+). The renderer has a matching palette.
const FIELD_TILES = {
  WILD_GRASS: 13, WILD_PATH: 14, WILD_WATER: 15, WILD_CLIFF: 16,
  SAND: 17, SANDSTONE: 18, OASIS: 19, MESA: 20,
  BOG: 21, MUD: 22, SWAMP_WATER: 23, MIRE_CLIFF: 24,
  ASH: 25, BASALT: 26, LAVA: 27, OBSIDIAN: 28,
  CRYSTAL_GROUND: 29, CRYSTAL_PATH: 30, CRYSTAL_POOL: 31, AMETHYST: 32,
  DEAD_EARTH: 33, RUIN_FLAG: 34, VOID_POOL: 35, SHADOW_CLIFF: 36,
  CLOUD: 37, GOLD_PATH: 38, STAR_VOID: 39, MARBLE_CLIFF: 40
};

// Mob stats scale with level so every zone feels the same at its own level.
// EXP comes from progression.js (kills-per-level curve).
function mobStats(level, isBoss) {
  const base = {
    maxHp: Math.round(140 + level * 55 + Math.pow(level, 1.35) * 6),
    dmg: Math.round(14 + level * 3.0),
    def: Math.round(10 + level * 1.7),
    exp: mobExp(level),
    gold: Math.round(10 + level * 8)
  };
  if (!isBoss) return base;
  return {
    maxHp: base.maxHp * 6,
    dmg: Math.round(base.dmg * 1.6),
    def: Math.round(base.def * 1.5),
    exp: mobExp(level, 'boss'),
    gold: base.gold * 10
  };
}

// Mob "type" picks the body drawn by the renderer; hue tints it per zone.
const FIELD_ZONES = [
  {
    id: 'frostfell', name: 'Frostfell Peaks', minLevel: 6, maxLevel: 15, gateLevel: 1,
    theme: 'frostfell', color: '#38bdf8', custom: true
  },
  {
    id: 'wildwood', name: 'Verdant Wildwood', minLevel: 16, maxLevel: 27,
    theme: 'wildwood', color: '#4ade80',
    tiles: { ground: 13, path: 14, liquid: 15, cliff: 16 },
    decor: [{ type: 'oak_tree', weight: 5 }, { type: 'pine_tree', weight: 3 }, { type: 'giant_mushroom', weight: 2, hue: 0 }, { type: 'boulder', weight: 1 }],
    mobs: [
      { type: 'goblin', name: 'Wildwood Bandit', level: 17, count: 7, hue: 90 },
      { type: 'frost_wolf', name: 'Dire Timberwolf', level: 21, count: 6, hue: 160, buffs: [] },
      { type: 'golem', name: 'Mossback Treant', level: 25, count: 4, hue: 70 }
    ],
    boss: { type: 'golem', name: 'Elder Treant Oakheart', level: 28, hue: 80, scale: 1.25 }
  },
  {
    id: 'dunes', name: 'Scorched Dunes', minLevel: 28, maxLevel: 39,
    theme: 'dunes', color: '#fbbf24',
    tiles: { ground: 17, path: 18, liquid: 19, cliff: 20 },
    decor: [{ type: 'cactus', weight: 4 }, { type: 'boulder', weight: 3, hue: 20 }, { type: 'stone_pillar', weight: 1, hue: 30 }, { type: 'dead_tree', weight: 1 }],
    mobs: [
      { type: 'slime', name: 'Quicksand Ooze', level: 29, count: 7, hue: 35 },
      { type: 'skeleton', name: 'Sun-Bleached Revenant', level: 33, count: 6, hue: 25 },
      { type: 'golem', name: 'Sandstone Sentinel', level: 37, count: 4, hue: 30 }
    ],
    boss: { type: 'frost_titan', name: 'Pharaoh Colossus Sekhmar', level: 40, hue: 200, scale: 1.1 }
  },
  {
    id: 'mirefen', name: 'Mirefen Swamp', minLevel: 40, maxLevel: 51,
    theme: 'mirefen', color: '#84cc16',
    tiles: { ground: 21, path: 22, liquid: 23, cliff: 24 },
    decor: [{ type: 'dead_tree', weight: 4 }, { type: 'giant_mushroom', weight: 3, hue: 220 }, { type: 'oak_tree', weight: 2, hue: 40 }],
    mobs: [
      { type: 'slime', name: 'Bog Slime', level: 41, count: 7, hue: 60, buffs: ['venomous'] },
      { type: 'ice_elemental', name: 'Will-o-Wisp', level: 45, count: 6, hue: 260, buffs: ['venomous'] },
      { type: 'goblin', name: 'Mire Troll', level: 49, count: 4, hue: 120, scale: 1.3 }
    ],
    boss: { type: 'frost_titan', name: 'Bog Behemoth Grulmoss', level: 52, hue: 270, scale: 1.15, buffs: ['venomous'] }
  },
  {
    id: 'ashen', name: 'Ashen Wastes', minLevel: 52, maxLevel: 63,
    theme: 'ashen', color: '#f97316',
    tiles: { ground: 25, path: 26, liquid: 27, cliff: 28 },
    decor: [{ type: 'boulder', weight: 3, hue: 330 }, { type: 'dead_tree', weight: 2 }, { type: 'ice_crystal', weight: 2, hue: 175 }],
    mobs: [
      { type: 'frost_wolf', name: 'Cinder Hellhound', level: 53, count: 7, hue: 175, buffs: ['ignited'] },
      { type: 'ice_elemental', name: 'Magma Elemental', level: 57, count: 6, hue: 170, buffs: ['ignited'] },
      { type: 'golem', name: 'Obsidian Golem', level: 61, count: 4, hue: 250 }
    ],
    boss: { type: 'frost_titan', name: 'Ember Titan Pyrrhus', level: 64, hue: 165, scale: 1.2, buffs: ['ignited', 'fortified'] }
  },
  {
    id: 'crystal', name: 'Crystal Highlands', minLevel: 64, maxLevel: 75,
    theme: 'crystal', color: '#c084fc',
    tiles: { ground: 29, path: 30, liquid: 31, cliff: 32 },
    decor: [{ type: 'ice_crystal', weight: 5, hue: 70 }, { type: 'frost_monolith', weight: 1, hue: 70 }, { type: 'boulder', weight: 2, hue: 240 }],
    mobs: [
      { type: 'ice_elemental', name: 'Prism Sprite', level: 65, count: 7, hue: 75 },
      { type: 'frost_wolf', name: 'Shardfang Stalker', level: 69, count: 6, hue: 80, buffs: ['frostbite'] },
      { type: 'golem', name: 'Amethyst Golem', level: 73, count: 4, hue: 250 }
    ],
    boss: { type: 'frost_titan', name: 'Crystal Colossus Prismara', level: 76, hue: 75, scale: 1.2, buffs: ['frostbite', 'fortified'] }
  },
  {
    id: 'shadowfell', name: 'Shadowfell Ruins', minLevel: 76, maxLevel: 87,
    theme: 'shadowfell', color: '#a855f7',
    tiles: { ground: 33, path: 34, liquid: 35, cliff: 36 },
    decor: [{ type: 'stone_pillar', weight: 3, hue: 240 }, { type: 'dead_tree', weight: 3 }, { type: 'frost_monolith', weight: 1, hue: 90 }],
    mobs: [
      { type: 'skeleton', name: 'Shadow Knight', level: 77, count: 7, hue: 250 },
      { type: 'ice_elemental', name: 'Wailing Wraith', level: 81, count: 6, hue: 90, buffs: ['venomous'] },
      { type: 'goblin', name: 'Shade Stalker', level: 85, count: 4, hue: 230, scale: 1.2 }
    ],
    boss: { type: 'frost_titan', name: 'Lich King Morvath', level: 88, hue: 95, scale: 1.2, buffs: ['venomous', 'fortified'] }
  },
  {
    id: 'celestial', name: 'Celestial Reach', minLevel: 88, maxLevel: 100,
    theme: 'celestial', color: '#fde68a',
    tiles: { ground: 37, path: 38, liquid: 39, cliff: 40 },
    decor: [{ type: 'stone_pillar', weight: 3, hue: 0 }, { type: 'ice_crystal', weight: 3, hue: 230 }, { type: 'frost_monolith', weight: 1, hue: 230 }],
    mobs: [
      { type: 'ice_elemental', name: 'Star Seraph', level: 89, count: 7, hue: 220 },
      { type: 'frost_wolf', name: 'Astral Lion', level: 93, count: 6, hue: 230 },
      { type: 'golem', name: 'Celestial Guardian', level: 97, count: 4, hue: 200 }
    ],
    boss: { type: 'frost_titan', name: 'Aether Sovereign Solaris', level: 100, hue: 220, scale: 1.3, buffs: ['fortified', 'ignited'] }
  }
];

FIELD_ZONES.forEach((z, i) => {
  z.index = i;
  z.prev = i === 0 ? 'town' : FIELD_ZONES[i - 1].id;
  z.next = i < FIELD_ZONES.length - 1 ? FIELD_ZONES[i + 1].id : null;
  if (z.gateLevel === undefined) z.gateLevel = Math.max(1, z.minLevel - 3);
});
const FIELD_ZONE_BY_ID = Object.fromEntries(FIELD_ZONES.map(z => [z.id, z]));

// Portal placement shared by every field map
const SOUTH_PORTAL = { x: 21, y: 36 };   // back to the previous zone
const SOUTH_ARRIVAL = { x: 21, y: 33 };
const NORTH_PORTAL = { x: 21, y: 4 };    // on to the next zone
const NORTH_ARRIVAL = { x: 21, y: 7 };

function seededRandom(seed) {
  let s = seed;
  return () => {
    const x = Math.sin(s++) * 10000;
    return x - Math.floor(x);
  };
}

function portalObstacles(zone) {
  const obstacles = [];
  const prevName = zone.prev === 'town' ? 'Town of Slop Hero' : FIELD_ZONE_BY_ID[zone.prev].name;
  obstacles.push({
    id: 'portal_prev', x: SOUTH_PORTAL.x, y: SOUTH_PORTAL.y, type: 'field_portal',
    target: zone.prev, arrive: 'north', label: `Back to ${prevName}`, color: '#facc15',
    collidable: false, radius: 1.2
  });
  if (zone.next) {
    const nz = FIELD_ZONE_BY_ID[zone.next];
    obstacles.push({
      id: 'portal_next', x: NORTH_PORTAL.x, y: NORTH_PORTAL.y, type: 'field_portal',
      target: nz.id, arrive: 'south', label: `${nz.name} [Lv. ${nz.gateLevel}+]`, color: nz.color,
      collidable: false, radius: 1.2
    });
  }
  return obstacles;
}

function generateFieldMap(zone) {
  if (zone.custom) {
    // Frostfell keeps its hand-made layout; only the portals are swapped in
    const map = generateFrostfellMap();
    map.obstacles = map.obstacles.filter(o => o.id !== 'portal_town_return' && Math.hypot(o.x - NORTH_PORTAL.x, o.y - NORTH_PORTAL.y) > 2.5);
    map.obstacles.push(...portalObstacles(zone));
    for (let y = 3; y <= 6; y++) for (let x = 19; x <= 23; x++) map.tiles[y][x] = 11; // frost stone pad
    for (let y = 34; y <= 37; y++) for (let x = 19; x <= 23; x++) map.tiles[y][x] = 11;
    map.zoneId = zone.id;
    map.zoneName = zone.name;
    map.blockingTiles = [12];
    map.arrivals = { south: SOUTH_ARRIVAL, north: NORTH_ARRIVAL };
    return map;
  }

  const T = zone.tiles;
  const rand = seededRandom(1000 + zone.index * 97);
  const width = MAP_WIDTH, height = MAP_HEIGHT;
  const tiles = [];

  // a winding road from the south portal up to the north portal
  const roadX = y => 21 + Math.round(Math.sin(y * 0.22 + zone.index) * 5);
  // two liquid features (lake / lava / void) off to the sides of the road
  const lakes = [
    { x: 9 + rand() * 4, y: 12 + rand() * 6, r: 3.5 + rand() * 2.5 },
    { x: 29 + rand() * 4, y: 22 + rand() * 6, r: 3.5 + rand() * 2.5 }
  ];

  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      let tile = T.ground;
      if (lakes.some(l => Math.hypot((x - l.x) * 1.1, y - l.y) < l.r)) tile = T.liquid;
      if (Math.abs(x - roadX(y)) <= 1) tile = T.path;
      // portal plazas
      if (Math.abs(x - 21) <= 2 && (Math.abs(y - SOUTH_PORTAL.y) <= 2 || Math.abs(y - NORTH_PORTAL.y) <= 2)) tile = T.path;
      if (x <= 1 || x >= width - 2 || y <= 1 || y >= height - 2) tile = T.cliff;
      tiles[y][x] = tile;
    }
  }
  // make sure the road reaches both plazas
  for (let y = 4; y <= 36; y++) {
    const rx = roadX(y);
    for (let x = Math.min(rx, 21); x <= Math.max(rx, 21); x++) {
      if (y <= 6 || y >= 34) tiles[y][x] = T.path;
    }
  }

  const obstacles = portalObstacles(zone);
  const totalWeight = zone.decor.reduce((s, d) => s + d.weight, 0);
  for (let i = 0; i < 110; i++) {
    const tx = Math.floor(rand() * (width - 6)) + 3;
    const ty = Math.floor(rand() * (height - 6)) + 3;
    if (tiles[ty][tx] !== T.ground) continue;
    if (Math.abs(tx - roadX(ty)) <= 2) continue;
    if (Math.hypot(tx - 21, ty - SOUTH_PORTAL.y) < 4.5 || Math.hypot(tx - 21, ty - NORTH_PORTAL.y) < 4.5) continue;
    if (obstacles.some(o => Math.hypot(o.x - tx, o.y - ty) < 2.0)) continue;
    let pick = rand() * totalWeight;
    const deco = zone.decor.find(d => (pick -= d.weight) < 0) || zone.decor[0];
    obstacles.push({
      id: `${zone.id}_deco_${tx}_${ty}`, x: tx, y: ty, type: deco.type,
      hue: deco.hue, collidable: true, radius: deco.type === 'giant_mushroom' ? 0.7 : 0.6
    });
  }

  return {
    width, height, tiles, obstacles,
    theme: zone.theme,
    zoneId: zone.id,
    zoneName: zone.name,
    blockingTiles: [T.liquid, T.cliff],
    spawnPoint: SOUTH_ARRIVAL,
    arrivals: { south: SOUTH_ARRIVAL, north: NORTH_ARRIVAL }
  };
}

// Mob roster for a zone, spread over open ground away from the portals
function buildFieldMobs(zone, map) {
  if (zone.custom) return null; // Frostfell keeps its own roster
  const rand = seededRandom(5000 + zone.index * 131);
  const blocking = new Set(map.blockingTiles);
  const spots = [];
  for (let y = 9; y <= 31; y++) {
    for (let x = 4; x <= 38; x++) {
      // mobs stand at tile centres; keep them clear of liquids, cliffs and props
      if (blocking.has(map.tiles[y][x])) continue;
      if (map.obstacles.some(o => o.collidable && Math.hypot(o.x - (x + 0.5), o.y - (y + 0.5)) < (o.radius || 0.6) + 0.6)) continue;
      spots.push({ x, y });
    }
  }
  const defs = [];
  zone.mobs.forEach((m, mi) => {
    // each species keeps to its own band of the map (south -> north = weaker -> stronger)
    const band = spots.filter(s => s.y >= 31 - (mi + 1) * 7 && s.y <= 31 - mi * 7);
    for (let i = 0; i < m.count; i++) {
      const s = band[Math.floor(rand() * band.length)] || spots[Math.floor(rand() * spots.length)];
      const level = m.level + Math.floor(rand() * 3);
      defs.push({
        type: m.type, name: m.name, level, hue: m.hue, scale: m.scale, buffs: m.buffs || [],
        ...mobStats(level, false),
        speed: m.type === 'golem' ? 2.2 : m.type === 'frost_wolf' ? 3.8 : 3.0,
        zone: { minX: s.x - 3, maxX: s.x + 3, minY: s.y - 3, maxY: s.y + 3 },
        spawn: { x: s.x + 0.5, y: s.y + 0.5 }
      });
    }
  });
  const b = zone.boss;
  defs.push({
    type: b.type, name: `${b.name} [Boss]`, level: b.level, hue: b.hue, scale: b.scale, buffs: b.buffs || [],
    isBoss: true, ...mobStats(b.level, true), speed: 2.2,
    zone: { minX: 18, maxX: 24, minY: 9, maxY: 13 }, spawn: { x: 21, y: 11 }
  });
  return defs;
}

module.exports = { FIELD_ZONES, FIELD_ZONE_BY_ID, FIELD_TILES, generateFieldMap, buildFieldMobs, mobStats };
