// Map Generator and Collision Data for Isometric World
const MAP_WIDTH = 42;
const MAP_HEIGHT = 42;

// Tile types
const TILES = {
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

function generateMap() {
  const tiles = [];
  const obstacles = []; // { x, y, type: 'tree' | 'rock' | 'ruin' | 'torch' | 'fountain' | 'chest', collidable: true }

  for (let y = 0; y < MAP_HEIGHT; y++) {
    tiles[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      // Default to grass
      let tile = TILES.GRASS;

      // Central Town Area (x: 14-26, y: 14-26)
      if (x >= 15 && x <= 25 && y >= 15 && y <= 25) {
        tile = TILES.COBBLESTONE;
      }

      // Grand polished plaza around the fountain (x: 18-22, y: 18-22)
      if (x >= 18 && x <= 22 && y >= 18 && y <= 22) {
        tile = TILES.SPAWN_ZONE;
      }

      // Crossroads / Paths extending out
      if ((x >= 18 && x <= 22) || (y >= 18 && y <= 22)) {
        if (tile === TILES.GRASS) tile = TILES.DIRT;
      }

      // River flowing diagonally from top-left to bottom-right around outer ring
      const distFromPond = Math.hypot(x - 32, y - 9);
      if (distFromPond < 5.5) {
        tile = TILES.WATER;
      }

      // Wooden bridge across pond
      if (x >= 28 && x <= 36 && y === 9) {
        tile = TILES.WOOD_BRIDGE;
      }

      // Ancient ruins zone in South-West (x: 5-13, y: 27-37)
      if (x >= 5 && x <= 13 && y >= 27 && y <= 37) {
        if ((x + y) % 2 === 0) {
          tile = TILES.STONE_RUIN;
        } else {
          tile = TILES.DIRT;
        }
      }

      // Map boundary cliffs
      if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) {
        tile = TILES.CLIFF;
      }

      tiles[y][x] = tile;
    }
  }

  // Town Fountain
  obstacles.push({ id: 'fountain_center', x: 20, y: 20, type: 'fountain', collidable: false });

  // Braziers at the corners of the fountain plaza
  obstacles.push({ id: 'torch_1', x: 17.5, y: 17.5, type: 'torch', collidable: false });
  obstacles.push({ id: 'torch_2', x: 22.5, y: 17.5, type: 'torch', collidable: false });
  obstacles.push({ id: 'torch_3', x: 17.5, y: 22.5, type: 'torch', collidable: false });
  obstacles.push({ id: 'torch_4', x: 22.5, y: 22.5, type: 'torch', collidable: false });

  // Market row on the west side of the plaza. Both booths open toward +x so
  // their fronts face the camera. (Rendered as 3D booths with NPCs inside.)
  obstacles.push({
    id: 'npc_merchant',
    x: 16.2,
    y: 19.6,
    type: 'merchant',
    name: 'Olaf the Trader',
    collidable: true,
    radius: 1.0
  });

  obstacles.push({
    id: 'npc_blacksmith',
    x: 16.2,
    y: 23.4,
    type: 'blacksmith',
    name: 'Brom the Master Smith',
    collidable: true,
    radius: 1.0
  });

  // --- Town walls: a stone curtain wall around the plaza (x/y 14..26) with
  // a gate on each road (18..22) flanked by towers, and round corner keeps.
  const WALL_MIN = 14;
  const WALL_MAX = 26;
  const isGateGap = (v) => v >= 18 && v <= 22;
  const isGateTower = (v) => v === 17 || v === 23;
  for (let v = WALL_MIN + 1; v < WALL_MAX; v++) {
    if (isGateGap(v)) continue;
    const segments = [
      { x: v, y: WALL_MIN, axis: 'x', back: true },
      { x: v, y: WALL_MAX, axis: 'x', back: false },
      { x: WALL_MIN, y: v, axis: 'y', back: true },
      { x: WALL_MAX, y: v, axis: 'y', back: false }
    ];
    segments.forEach(sg => {
      if (isGateTower(v)) {
        obstacles.push({ id: `gate_tower_${sg.x}_${sg.y}`, x: sg.x, y: sg.y, type: 'gate_tower', collidable: true, radius: 0.7 });
      } else {
        obstacles.push({ id: `town_wall_${sg.x}_${sg.y}`, x: sg.x, y: sg.y, type: 'town_wall', axis: sg.axis, back: sg.back, collidable: true, radius: 0.55 });
      }
    });
  }
  [[WALL_MIN, WALL_MIN], [WALL_MAX, WALL_MIN], [WALL_MIN, WALL_MAX], [WALL_MAX, WALL_MAX]].forEach(([cx, cy]) => {
    obstacles.push({ id: `corner_keep_${cx}_${cy}`, x: cx, y: cy, type: 'corner_keep', collidable: true, radius: 0.9 });
  });

  // Houses lining the roads outside the walls
  [
    { x: 15.5, y: 10.5, variant: 0 },
    { x: 24.5, y: 10.5, variant: 1 },
    { x: 10.5, y: 16, variant: 2 },
    { x: 30, y: 15.5, variant: 0 },
    { x: 15.5, y: 29.5, variant: 1 },
    { x: 24.5, y: 29.5, variant: 2 }
  ].forEach((h, i) => {
    obstacles.push({ id: `house_${i}`, x: h.x, y: h.y, type: 'house', variant: h.variant, collidable: true, radius: 1.3 });
  });

  // Ancient Dungeon Portal (Vortex into Procedural Dungeon)
  obstacles.push({
    id: 'portal_dungeon',
    x: 23.5,
    y: 16.5,
    type: 'portal',
    name: 'Abyssal Dungeon Portal',
    collidable: false,
    radius: 1.2
  });

  // Frostfell Peaks Portal (North-West Town Gateway)
  obstacles.push({
    id: 'portal_frostfell',
    x: 16.5,
    y: 16.5,
    type: 'frost_portal',
    name: 'Frostfell Peaks Portal',
    collidable: false,
    radius: 1.2
  });

  // Forest Trees
  const pseudoRandom = (seed) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  let seed = 42;
  for (let i = 0; i < 90; i++) {
    const tx = Math.floor(pseudoRandom(seed++) * (MAP_WIDTH - 4)) + 2;
    const ty = Math.floor(pseudoRandom(seed++) * (MAP_HEIGHT - 4)) + 2;
    const tile = tiles[ty][tx];

    const inTown = tx >= 14 && tx <= 26 && ty >= 14 && ty <= 26;
    if (!inTown && tile !== TILES.WATER && tile !== TILES.WOOD_BRIDGE && tile !== TILES.CLIFF) {
      const collides = obstacles.some(o => Math.hypot(o.x - tx, o.y - ty) < 1.8);
      if (!collides) {
        const treeType = pseudoRandom(seed++) > 0.4 ? 'oak_tree' : 'pine_tree';
        obstacles.push({
          id: `tree_${tx}_${ty}`,
          x: tx,
          y: ty,
          type: treeType,
          collidable: true,
          radius: 0.6
        });
      }
    }
  }

  // Ancient Pillars in Ruins (SW)
  const pillarCoords = [
    [6, 28], [12, 28], [6, 36], [12, 36],
    [9, 30], [9, 34]
  ];
  pillarCoords.forEach(([px, py], idx) => {
    obstacles.push({
      id: `pillar_${idx}`,
      x: px,
      y: py,
      type: 'stone_pillar',
      collidable: true,
      radius: 0.8
    });
  });

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    theme: 'town',
    tiles,
    obstacles
  };
}

// Generate New Map: Frostfell Peaks (Winter Realm)
function generateFrostfellMap() {
  const width = MAP_WIDTH;
  const height = MAP_HEIGHT;
  const tiles = [];
  const obstacles = [];

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
  const obelisks = [
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
      radius: 0.8
    });
  });

  // Snow Pine Trees & Glacial Ice Crystals
  const pseudoRandom = (seed) => {
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
          radius: isCrystal ? 0.7 : 0.65
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
  generateMap,
  generateFrostfellMap
};
