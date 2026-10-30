// Map Generator and Collision Data for Isometric World
export const MAP_WIDTH = 42;
export const MAP_HEIGHT = 42;

// Tile types
export const TILES = {
  GRASS: 0,
  COBBLESTONE: 1,
  DIRT: 2,
  WATER: 3,
  STONE_RUIN: 4,
  WOOD_BRIDGE: 5,
  SPAWN_ZONE: 6,
  CLIFF: 7,
  SNOW: 9,
  ICE: 10,
  FROST_STONE: 11,
  FROST_CLIFF: 12
};

export interface MapObstacle {
  id: string;
  x: number;
  y: number;
  type: string;
  name?: string;
  collidable: boolean;
  radius?: number;
  variant?: number;
  axis?: string;
  back?: boolean;
  target?: string;
  arrive?: string;
  label?: string;
  color?: string;
  [key: string]: any;
}

export interface MapData {
  width: number;
  height: number;
  theme: string;
  tiles: number[][];
  obstacles: MapObstacle[];
  arrivals?: Record<string, { x: number; y: number }>;
  spawnPoint?: { x: number; y: number };
  zoneId?: string;
  zoneName?: string;
  blockingTiles?: number[];
  [key: string]: any;
}

// The starting map is one walled city: a grand plaza at the crossing of two
// boulevards, a grid of side streets, housing blocks, a market street, a
// lakeside park in the north-east and a garden in the south-west. Monsters
// live outside, past the north gate (first field zone).
export const CITY = {
  WALL_MIN: 2,
  WALL_MAX: 39,
  BOULEVARD: [18, 22] as [number, number],          // main roads (x and y), tiles inclusive
  LANES: [[9, 10], [31, 32]] as [number, number][], // side streets (x and y), tiles inclusive
  PLAZA: [16, 24] as [number, number],              // polished plaza around the fountain
  NORTH_GATE: { x: 20.5, y: 3.6 }
};

const inRange = (v: number, [a, b]: [number, number]) => v >= a && v <= b;
const isRoadTile = (v: number) => inRange(v, CITY.BOULEVARD) || CITY.LANES.some(l => inRange(v, l));
const inPond = (x: number, y: number) => Math.hypot((x + 0.5 - 30.5) * 0.55, y + 0.5 - 5.8) < 2.5;
const inGarden = (x: number, y: number) => x >= 3 && x <= 17 && y >= 25 && y <= 38;

export function generateMap(): MapData {
  const tiles: number[][] = [];
  const obstacles: MapObstacle[] = []; // { x, y, type, collidable, radius? }

  for (let y = 0; y < MAP_HEIGHT; y++) {
    tiles[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      let tile = TILES.GRASS;
      const inside = x > CITY.WALL_MIN && x < CITY.WALL_MAX && y > CITY.WALL_MIN && y < CITY.WALL_MAX;

      if (inside && (isRoadTile(x) || isRoadTile(y))) tile = TILES.COBBLESTONE;
      if (inRange(x, CITY.PLAZA) && inRange(y, CITY.PLAZA)) tile = TILES.SPAWN_ZONE;
      // old paving along the garden walks
      if (inGarden(x, y) && tile === TILES.GRASS && (x === 13 || y === 28)) tile = TILES.STONE_RUIN;
      if (inPond(x, y)) tile = isRoadTile(x) ? TILES.WOOD_BRIDGE : TILES.WATER;
      // the north boulevard runs out through the gate
      if (y >= 1 && y <= CITY.WALL_MIN && inRange(x, CITY.BOULEVARD)) tile = TILES.COBBLESTONE;

      if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) tile = TILES.CLIFF;
      tiles[y][x] = tile;
    }
  }

  const add = (o: MapObstacle) => obstacles.push(o);
  const near = (x: number, y: number, r: number) => obstacles.some(o => Math.hypot(o.x - x, o.y - y) < r);
  const WALL_TYPES = new Set(['town_wall', 'gate_tower', 'corner_keep']);
  const nearProp = (x: number, y: number, r: number) => obstacles.some(o => !WALL_TYPES.has(o.type) && Math.hypot(o.x - x, o.y - y) < r);

  // ---- plaza: fountain, braziers, flower beds ----
  add({ id: 'fountain_center', x: 20, y: 20, type: 'fountain', collidable: false });
  [[16.6, 16.6], [24.4, 16.6], [16.6, 24.4], [24.4, 24.4]].forEach(([x, y], i) => add({ id: `torch_${i + 1}`, x, y, type: 'torch', collidable: false }));
  [[18.3, 18.3], [22.2, 18.3], [18.3, 22.2], [22.2, 22.2]].forEach(([x, y], i) => add({ id: `plaza_flowers_${i}`, x, y, type: 'flower_bed', variant: i % 3, collidable: true, radius: 0.45 }));

  // ---- the three town NPCs & personal storage chest ----
  add({ id: 'npc_merchant', x: 16.2, y: 19.6, type: 'merchant', name: 'Olaf the Trader', collidable: true, radius: 1.0 });
  add({ id: 'town_personal_chest', x: 17.8, y: 19.6, type: 'personal_chest', name: 'Personal Storage Chest', collidable: true, radius: 0.8 });
  add({ id: 'npc_enchanter', x: 23.8, y: 23.4, type: 'enchanter', name: 'Valka the Enchanter', collidable: true, radius: 1.0 });
  add({ id: 'npc_blacksmith', x: 16.2, y: 23.4, type: 'blacksmith', name: 'Brom the Master Smith', collidable: true, radius: 1.0 });

  // ---- portals: dungeon on the plaza, the outside world through the north gate ----
  add({ id: 'portal_dungeon', x: 23.5, y: 16.5, type: 'portal', name: 'Abyssal Dungeon Portal', collidable: false, radius: 1.2 });
  add({
    id: 'portal_outskirts', x: CITY.NORTH_GATE.x, y: CITY.NORTH_GATE.y, type: 'field_portal',
    target: 'meadow', arrive: 'south', label: 'City Gate → Greenmeadow Outskirts [Lv. 1+]', color: '#86efac',
    collidable: false, radius: 1.2
  });

  // ---- city wall around the whole map, gate on the north boulevard ----
  const { WALL_MIN, WALL_MAX } = CITY;
  const isGateTower = (v: number) => v === CITY.BOULEVARD[0] - 1 || v === CITY.BOULEVARD[1] + 1;
  for (let v = WALL_MIN + 1; v < WALL_MAX; v++) {
    [
      { x: v, y: WALL_MIN, axis: 'x', back: true, gate: true },
      { x: v, y: WALL_MAX, axis: 'x', back: false },
      { x: WALL_MIN, y: v, axis: 'y', back: true },
      { x: WALL_MAX, y: v, axis: 'y', back: false }
    ].forEach(sg => {
      if (sg.gate && inRange(v, CITY.BOULEVARD)) return;
      if (sg.gate && isGateTower(v)) {
        add({ id: `gate_tower_${sg.x}_${sg.y}`, x: sg.x, y: sg.y, type: 'gate_tower', collidable: true, radius: 0.7 });
      } else {
        add({ id: `town_wall_${sg.x}_${sg.y}`, x: sg.x, y: sg.y, type: 'town_wall', axis: sg.axis, back: sg.back, collidable: true, radius: 0.55 });
      }
    });
  }
  [[WALL_MIN, WALL_MIN], [WALL_MAX, WALL_MIN], [WALL_MIN, WALL_MAX], [WALL_MAX, WALL_MAX]].forEach(([cx, cy]) => {
    add({ id: `corner_keep_${cx}_${cy}`, x: cx, y: cy, type: 'corner_keep', collidable: true, radius: 0.9 });
  });

  // ---- market street: stalls along the west and east boulevards ----
  let stall = 0;
  for (const x of [11.6, 14.2, 26.6, 29.2]) {
    for (const y of [16.9, 24.1]) {
      add({ id: `stall_${stall}`, x, y, type: 'market_stall', variant: stall % 4, collidable: true, radius: 0.8 });
      stall++;
    }
  }
  [[12.9, 16.4], [27.9, 24.6], [25.4, 16.5], [12.9, 24.6]].forEach(([x, y], i) => add({ id: `crates_${i}`, x, y, type: 'crates', variant: i % 2, collidable: true, radius: 0.45 }));

  // ---- residential blocks: houses between the streets ----
  const spans = [[3, 8], [11, 17], [23, 30], [33, 38]]; // tiles between roads, each axis
  let houseN = 0;
  for (const [bx0, bx1] of spans) {
    for (const [by0, by1] of spans) {
      const cols = Math.max(1, Math.floor((bx1 - bx0 + 1) / 3));
      const rows = Math.max(1, Math.floor((by1 - by0 + 1) / 3));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = bx0 + (bx1 - bx0 + 1) * (c + 0.5) / cols;
          const y = by0 + (by1 - by0 + 1) * (r + 0.5) / rows;
          const tx = Math.floor(x), ty = Math.floor(y);
          if (tiles[ty][tx] !== TILES.GRASS || inGarden(tx, ty)) continue;
          if (inRange(tx, [14, 26] as [number, number]) && inRange(ty, [14, 26] as [number, number])) continue; // plaza, booths & portal
          if (Math.hypot(x - 30.5, (y - 5.8) * 1.6) < 8.5) continue;    // lakeside park
          if (nearProp(x, y, 2.3) || near(x, y, 1.2)) continue;
          add({ id: `house_${houseN}`, x, y, type: 'house', variant: houseN % 3, collidable: true, radius: 1.3 });
          houseN++;
        }
      }
    }
  }

  // ---- street lamps along the boulevards ----
  const lampEdges = [CITY.BOULEVARD[0] - 0.4, CITY.BOULEVARD[1] + 1.4];
  for (let v = 4.5; v <= 37.5; v += 4) {
    for (const edge of lampEdges) {
      for (const [x, y] of [[edge, v], [v, edge]]) {
        if (inRange(Math.floor(x), CITY.PLAZA) && inRange(Math.floor(y), CITY.PLAZA)) continue;
        if (isRoadTile(Math.floor(x)) && isRoadTile(Math.floor(y))) continue;
        if (near(x, y, 1.6)) continue;
        add({ id: `lamp_${x}_${y}`, x, y, type: 'lamp_post', collidable: true, radius: 0.2 });
      }
    }
  }

  // ---- north-east: lakeside park ----
  add({ id: 'park_bench_0', x: 26.4, y: 8.6, type: 'bench', collidable: true, radius: 0.4 });
  add({ id: 'park_bench_1', x: 35.4, y: 8.6, type: 'bench', collidable: true, radius: 0.4 });
  [[24.5, 4.2], [37.3, 4.2], [37.4, 7.8], [24.2, 7.8], [27.5, 3.4], [34.5, 3.4]].forEach(([x, y]) => add({ id: `tree_${x}_${y}`, x, y, type: 'oak_tree', collidable: true, radius: 0.3 }));

  // ---- south-west: Hero's Garden, four lawns split by the side streets ----
  [[4.2, 25.6], [7.8, 25.6], [4.2, 29.6], [7.8, 29.6], [4.6, 35.5], [7.4, 35.5]].forEach(([px, py], idx) => {
    add({ id: `pillar_${idx}`, x: px, y: py, type: 'stone_pillar', collidable: true, radius: 0.45 });
  });
  add({ id: 'garden_well', x: 6, y: 27.6, type: 'well', collidable: true, radius: 0.7 });
  [[3.6, 37.6], [8.4, 37.4], [16.6, 25.8], [16.5, 37.5], [11.6, 34], [16.4, 30.2]].forEach(([x, y]) => add({ id: `tree_${x}_${y}`, x, y, type: 'pine_tree', collidable: true, radius: 0.3 }));
  [[6, 33.8], [14.6, 26.2], [15, 35.6]].forEach(([x, y], i) => add({ id: `garden_bench_${i}`, x, y, type: 'bench', collidable: true, radius: 0.4 }));
  [[11.8, 26.2], [16.2, 28.6], [6, 37.6], [12, 37.6], [14.6, 30.4]].forEach(([x, y], i) => add({ id: `garden_flowers_${i}`, x, y, type: 'flower_bed', variant: (i + 1) % 3, collidable: true, radius: 0.45 }));

  // ---- yard trees, crates and flowers in leftover grass ----
  const pseudoRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  let seed = 42;
  for (let i = 0; i < 160; i++) {
    const tx = 3 + Math.floor(pseudoRandom(seed++) * 36);
    const ty = 3 + Math.floor(pseudoRandom(seed++) * 36);
    if (tiles[ty][tx] !== TILES.GRASS) continue;
    const x = tx + 0.5, y = ty + 0.5;
    if (near(x, y, 1.9)) continue;
    const roll = pseudoRandom(seed++);
    if (roll < 0.55) add({ id: `tree_${tx}_${ty}`, x, y, type: roll < 0.35 ? 'oak_tree' : 'pine_tree', collidable: true, radius: 0.3 });
    else if (roll < 0.8) add({ id: `crates_y_${tx}_${ty}`, x, y, type: 'crates', variant: tx % 2, collidable: true, radius: 0.45 });
    else add({ id: `flowers_y_${tx}_${ty}`, x, y, type: 'flower_bed', variant: ty % 3, collidable: true, radius: 0.45 });
  }

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    theme: 'town',
    tiles,
    obstacles,
    // where you appear when walking back in through the north gate
    arrivals: { north: { x: CITY.NORTH_GATE.x, y: CITY.NORTH_GATE.y + 2.6 } }
  };
}

// Generate New Map: Frostfell Peaks (Winter Realm)
export function generateFrostfellMap(): MapData {
  const width = MAP_WIDTH;
  const height = MAP_HEIGHT;
  const tiles: number[][] = [];
  const obstacles: MapObstacle[] = [];

  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      let tile = TILES.SNOW;

      // Frozen Lake in the center (x: 14-28, y: 12-24)
      const lakeDist = Math.hypot((x - 21) * 1.1, y - 18);
      if (lakeDist < 6.5) {
        tile = TILES.ICE;
      }

      // Ancient Frost Stone Roads & Ritual Altars
      if ((x >= 19 && x <= 23 && y >= 25 && y <= 35) || (Math.hypot(x - 10, y - 12) < 4.5)) {
        tile = TILES.FROST_STONE;
      }

      // Mountain Cliffs around borders
      if (x <= 1 || x >= width - 2 || y <= 1 || y >= height - 2) {
        tile = TILES.FROST_CLIFF;
      }

      tiles[y][x] = tile;
    }
  }

  // Return Portal to Town (at south plateau)
  obstacles.push({
    id: 'portal_town_return',
    x: 21,
    y: 34,
    type: 'town_portal',
    name: 'Return to Town Portal',
    collidable: false,
    radius: 1.2
  });

  // Frost Obelisks & Shards
  const obelisks: [number, number, string][] = [
    [10, 12, 'frost_monolith'],
    [32, 10, 'frost_monolith'],
    [31, 28, 'frost_monolith'],
    [12, 28, 'frost_monolith']
  ];
  obelisks.forEach(([ox, oy, type], idx) => {
    obstacles.push({
      id: `obelisk_${idx}`,
      x: ox,
      y: oy,
      type,
      collidable: true,
      radius: 0.5
    });
  });

  // Snow Pine Trees & Glacial Ice Crystals
  const pseudoRandom = (seed: number) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
  let seed = 108;
  for (let i = 0; i < 75; i++) {
    const tx = Math.floor(pseudoRandom(seed++) * (width - 6)) + 3;
    const ty = Math.floor(pseudoRandom(seed++) * (height - 6)) + 3;
    const tile = tiles[ty][tx];

    // Don't place on ice lake or near spawn portal
    const nearSpawn = Math.hypot(tx - 21, ty - 34) < 4.0;
    if (!nearSpawn && tile !== TILES.ICE && tile !== TILES.FROST_CLIFF) {
      const collides = obstacles.some(o => Math.hypot(o.x - tx, o.y - ty) < 2.0);
      if (!collides) {
        const isCrystal = pseudoRandom(seed++) > 0.65;
        obstacles.push({
          id: `frost_obs_${tx}_${ty}`,
          x: tx,
          y: ty,
          type: isCrystal ? 'ice_crystal' : 'snow_pine',
          collidable: true,
          radius: isCrystal ? 0.4 : 0.3
        });
      }
    }
  }

  return {
    width,
    height,
    theme: 'frostfell',
    tiles,
    obstacles,
    spawnPoint: { x: 21, y: 32 }
  };
}

module.exports = {
  MAP_WIDTH,
  MAP_HEIGHT,
  TILES,
  CITY,
  generateMap,
  generateFrostfellMap
};

