// Open-world field zones, chained by level from the city outskirts (Lv 1) to Lv 100.
// Each zone is a 42x42 map entered from the south (portal back to the previous
// zone) with a portal to the next zone on its far north side.
import { generateFrostfellMap } from './mapData';
import { mobExp, mobHpMult } from './progression';

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
    maxHp: Math.round((140 + level * 55 + Math.pow(level, 1.35) * 6) * mobHpMult(level)),
    dmg: Math.round(14 + level * 3.0),
    def: Math.round(10 + level * 1.7),
    exp: mobExp(level),
    gold: Math.round(5 + level * 3)
  };
  if (!isBoss) return base;
  return {
    maxHp: base.maxHp * 6,
    dmg: Math.round(base.dmg * 1.6),
    def: Math.round(base.def * 1.5),
    exp: mobExp(level, 'boss'),
    gold: Math.round(base.gold * 4)
  };
}

// Mob "type" picks the body drawn by the renderer; hue tints it per zone.
const FIELD_ZONES: any[] = [
  {
    // Just outside the city's north gate: the starter monsters that used to roam the town
    id: 'meadow', name: 'Greenmeadow Outskirts', minLevel: 1, maxLevel: 5, gateLevel: 1,
    theme: 'wildwood', color: '#86efac',
    tiles: { ground: 13, path: 14, liquid: 15, cliff: 16 },
    decor: [{ type: 'oak_tree', weight: 5 }, { type: 'pine_tree', weight: 2 }, { type: 'boulder', weight: 1 }, { type: 'stone_pillar', weight: 1 }],
    mobs: [
      { type: 'slime', name: 'Meadow Slime', level: 1, count: 7, speed: 2.3, element: 'earth', elementResist: { fire: -0.4, ice: 0.1, earth: 0.3 }, stats: { maxHp: 120, def: 5, dmg: 14, gold: 15 } },
      { type: 'goblin', name: 'Goblin Scout', level: 3, count: 6, speed: 3.2, element: 'earth', elementResist: { fire: -0.3, ice: 0.1, earth: 0.2 }, stats: { maxHp: 260, def: 10, dmg: 22, gold: 35 } },
      { type: 'skeleton', name: 'Ancient Skeleton', level: 5, count: 5, speed: 2.8, element: 'dark', elementResist: { holy: -0.6, fire: -0.2, dark: 0.4 }, stats: { maxHp: 440, def: 16, dmg: 32, gold: 75 } }
    ],
    boss: { type: 'golem', name: 'Titan Stone Golem', level: 8, element: 'earth', elementResist: { lightning: -0.5, earth: 0.5, holy: 0.2 }, stats: { maxHp: 1400, def: 26, dmg: 52, gold: 300 } }
  },
  {
    id: 'frostfell', name: 'Frostfell Peaks', minLevel: 6, maxLevel: 15, gateLevel: 4,
    theme: 'frostfell', color: '#38bdf8',
    // snow, frost-stone roads, frozen lakes and frost cliffs (mapData TILES 9-12)
    tiles: { ground: 9, path: 11, liquid: 10, cliff: 12 },
    decor: [{ type: 'pine_tree', weight: 4 }, { type: 'ice_crystal', weight: 3 }, { type: 'frost_monolith', weight: 2 }, { type: 'boulder', weight: 1 }],
    mobs: [
      { type: 'frost_wolf', name: 'Frostbite Wolf', level: 6, count: 6, speed: 3.8, buffs: ['frostbite'], element: 'ice', elementResist: { fire: -0.5, ice: 0.5 }, stats: { maxHp: 550, def: 15, dmg: 38, gold: 90 } },
      { type: 'ice_elemental', name: 'Glacial Elemental', level: 8, count: 6, speed: 2.5, buffs: ['frostbite'], element: 'ice', elementResist: { fire: -0.6, ice: 0.6 }, stats: { maxHp: 750, def: 20, dmg: 48, gold: 140 } }
    ],
    boss: { type: 'frost_titan', name: 'Frost Titan Ymir', level: 12, buffs: ['frostbite', 'fortified'], element: 'ice', elementResist: { fire: -0.5, ice: 0.7, holy: -0.2 }, stats: { maxHp: 2800, def: 35, dmg: 75, gold: 750 } }
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
// Collision radius per decoration: trunks and pillars are slim
const DECOR_RADIUS = {
  oak_tree: 0.3,
  pine_tree: 0.3,
  dead_tree: 0.28,
  cactus: 0.3,
  stone_pillar: 0.45,
  frost_monolith: 0.5,
  ice_crystal: 0.4,
  giant_mushroom: 0.45,
  boulder: 0.6
};

// Field zones are larger than the city (about 3x its area) and hold three
// times the monsters, so they are just as busy per tile
const FIELD_SIZE = 72;
const FIELD_MOB_MULT = 3;
const FIELD_MID = Math.floor(FIELD_SIZE / 2);
const SOUTH_PORTAL = { x: FIELD_MID, y: FIELD_SIZE - 6 };   // back to the previous zone
const SOUTH_ARRIVAL = { x: FIELD_MID, y: FIELD_SIZE - 9 };
const NORTH_PORTAL = { x: FIELD_MID, y: 4 };                // on to the next zone
const NORTH_ARRIVAL = { x: FIELD_MID, y: 7 };

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
    // A hand-made zone keeps the old Frostfell layout; only the portals are swapped in
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
  const width = FIELD_SIZE, height = FIELD_SIZE;
  const tiles = [];

  // a winding road from the south portal up to the north portal
  const roadX = y => FIELD_MID + Math.round(Math.sin(y * 0.15 + zone.index) * 8);
  // liquid features (lake / lava / void) off to both sides of the road
  const lakes = [[0.2, 0.28], [0.74, 0.22], [0.24, 0.62], [0.76, 0.58], [0.5, 0.86]].map(([fx, fy]) => ({
    x: width * fx + (rand() - 0.5) * 6, y: height * fy + (rand() - 0.5) * 6, r: 3.5 + rand() * 3.5
  }));

  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      let tile = T.ground;
      // keep the portals and arrival points dry, or players land inside a lake and can't move
      const nearPortal = [SOUTH_PORTAL, SOUTH_ARRIVAL, NORTH_PORTAL, NORTH_ARRIVAL].some(p => Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) < 5);
      if (!nearPortal && lakes.some(l => Math.hypot((x - l.x) * 1.1, y - l.y) < l.r)) tile = T.liquid;
      if (Math.abs(x - roadX(y)) <= 1) tile = T.path;
      // portal plazas
      if (Math.abs(x - FIELD_MID) <= 2 && (Math.abs(y - SOUTH_PORTAL.y) <= 2 || Math.abs(y - NORTH_PORTAL.y) <= 2)) tile = T.path;
      if (x <= 1 || x >= width - 2 || y <= 1 || y >= height - 2) tile = T.cliff;
      tiles[y][x] = tile;
    }
  }
  // make sure the road reaches both plazas
  for (let y = NORTH_PORTAL.y; y <= SOUTH_PORTAL.y; y++) {
    const rx = roadX(y);
    for (let x = Math.min(rx, FIELD_MID); x <= Math.max(rx, FIELD_MID); x++) {
      if (y <= NORTH_PORTAL.y + 2 || y >= SOUTH_PORTAL.y - 2) tiles[y][x] = T.path;
    }
  }

  const obstacles = portalObstacles(zone);
  const totalWeight = zone.decor.reduce((s, d) => s + d.weight, 0);
  const DECOR_TRIES = Math.round(110 * (width * height) / (42 * 42));
  for (let i = 0; i < DECOR_TRIES; i++) {
    const tx = Math.floor(rand() * (width - 6)) + 3;
    const ty = Math.floor(rand() * (height - 6)) + 3;
    if (tiles[ty][tx] !== T.ground) continue;
    if (Math.abs(tx - roadX(ty)) <= 2) continue;
    if (Math.hypot(tx - FIELD_MID, ty - SOUTH_PORTAL.y) < 4.5 || Math.hypot(tx - FIELD_MID, ty - NORTH_PORTAL.y) < 4.5) continue;
    if (obstacles.some(o => Math.hypot(o.x - tx, o.y - ty) < 2.0)) continue;
    let pick = rand() * totalWeight;
    const deco = zone.decor.find(d => (pick -= d.weight) < 0) || zone.decor[0];
    obstacles.push({
      id: `${zone.id}_deco_${tx}_${ty}`, x: tx, y: ty, type: deco.type,
      hue: deco.hue, collidable: true, radius: DECOR_RADIUS[deco.type] || 0.6
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
  if (zone.custom) return null; // a hand-made zone (custom: true) keeps its own roster
  const rand = seededRandom(5000 + zone.index * 131);
  const blocking = new Set(map.blockingTiles);
  const spots = [];
  const yMin = 9, yMax = map.height - 11;
  for (let y = yMin; y <= yMax; y++) {
    for (let x = 4; x <= map.width - 4; x++) {
      // mobs stand at tile centres; keep them clear of liquids, cliffs and props
      if (blocking.has(map.tiles[y][x])) continue;
      if (map.obstacles.some(o => o.collidable && Math.hypot(o.x - (x + 0.5), o.y - (y + 0.5)) < (o.radius || 0.6) + 0.6)) continue;
      spots.push({ x, y });
    }
  }
  const defs = [];
  zone.mobs.forEach((m, mi) => {
    // each species keeps to its own band of the map (south -> north = weaker -> stronger)
    const bandH = (yMax - yMin) / zone.mobs.length;
    const band = spots.filter(s => s.y >= yMax - (mi + 1) * bandH && s.y <= yMax - mi * bandH);
    for (let i = 0; i < m.count * FIELD_MOB_MULT; i++) {
      const s = band[Math.floor(rand() * band.length)] || spots[Math.floor(rand() * spots.length)];
      const level = m.level + Math.floor(rand() * 3);
      defs.push({
        type: m.type, name: m.name, level, hue: m.hue, scale: m.scale, buffs: m.buffs || [],
        element: m.element, elementResist: m.elementResist,
        ...mobStats(level, false), ...(m.stats || {}),
        ...(m.stats && m.stats.maxHp ? { maxHp: Math.round(m.stats.maxHp * mobHpMult(level)) } : {}),
        speed: m.speed || (m.type === 'golem' ? 2.2 : m.type === 'frost_wolf' ? 3.8 : 3.0),
        zone: { minX: s.x - 3, maxX: s.x + 3, minY: s.y - 3, maxY: s.y + 3 },
        spawn: { x: s.x + 0.5, y: s.y + 0.5 }
      });
    }
  });
  const b = zone.boss;
  defs.push({
    type: b.type, name: `${b.name} [Boss]`, level: b.level, hue: b.hue, scale: b.scale, buffs: b.buffs || [],
    element: b.element, elementResist: b.elementResist,
    isBoss: true, ...mobStats(b.level, true), ...(b.stats || {}), speed: 2.2,
    ...(b.stats && b.stats.maxHp ? { maxHp: Math.round(b.stats.maxHp * mobHpMult(b.level)) } : {}),
    zone: { minX: FIELD_MID - 3, maxX: FIELD_MID + 3, minY: 9, maxY: 13 }, spawn: { x: FIELD_MID, y: 11 }
  });
  return defs;
}

export { FIELD_ZONES, FIELD_ZONE_BY_ID, FIELD_TILES, generateFieldMap, buildFieldMobs, mobStats };
export default FIELD_ZONES;
module.exports = { FIELD_ZONES, FIELD_ZONE_BY_ID, FIELD_TILES, generateFieldMap, buildFieldMobs, mobStats };


