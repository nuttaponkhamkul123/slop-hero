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
  CLIFF: 7
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

      // Spawn Pad in town center (x: 19-21, y: 19-21)
      if (x >= 19 && x <= 21 && y >= 19 && y <= 21) {
        tile = TILES.SPAWN_ZONE;
      }

      // Crossroads / Paths extending out
      if ((x >= 18 && x <= 22) || (y >= 18 && y <= 22)) {
        if (tile === TILES.GRASS) tile = TILES.DIRT;
      }

      // River flowing diagonally from top-left to bottom-right around outer ring
      // Curve: y = x - 12 (approx) or a winding pond in north-east (x: 27-38, y: 5-15)
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

  // Town Fountain (non-collidable so players can walk freely without getting trapped)
  obstacles.push({ id: 'fountain_center', x: 20, y: 20, type: 'fountain', collidable: false });

  // Town Torches at corners of spawn zone
  obstacles.push({ id: 'torch_1', x: 17, y: 17, type: 'torch', collidable: false });
  obstacles.push({ id: 'torch_2', x: 23, y: 17, type: 'torch', collidable: false });
  obstacles.push({ id: 'torch_3', x: 17, y: 23, type: 'torch', collidable: false });
  obstacles.push({ id: 'torch_4', x: 23, y: 23, type: 'torch', collidable: false });

  // Town Merchant NPC (Olaf the Trader)
  obstacles.push({
    id: 'npc_merchant',
    x: 16.5,
    y: 21,
    type: 'merchant',
    name: 'Olaf the Trader',
    collidable: true,
    radius: 0.8
  });

  // Town Blacksmith NPC (Brom the Master Smith - Reforge / Upgrade)
  obstacles.push({
    id: 'npc_blacksmith',
    x: 24.2,
    y: 23.5,
    type: 'blacksmith',
    name: 'Brom the Master Smith',
    collidable: true,
    radius: 0.7
  });

  // Blacksmith Burning Forge & Anvil
  obstacles.push({
    id: 'blacksmith_anvil',
    x: 24.9,
    y: 22.7,
    type: 'anvil',
    name: 'Burning Forge & Anvil',
    collidable: false
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

  // Forest Trees (deterministic placement so both server and client match)
  const pseudoRandom = (seed) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  let seed = 42;
  for (let i = 0; i < 90; i++) {
    const tx = Math.floor(pseudoRandom(seed++) * (MAP_WIDTH - 4)) + 2;
    const ty = Math.floor(pseudoRandom(seed++) * (MAP_HEIGHT - 4)) + 2;
    const tile = tiles[ty][tx];

    // Don't place on town, water, or bridge
    const inTown = tx >= 14 && tx <= 26 && ty >= 14 && ty <= 26;
    if (!inTown && tile !== TILES.WATER && tile !== TILES.WOOD_BRIDGE && tile !== TILES.CLIFF) {
      // Check collision with existing obstacles
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
    tiles,
    obstacles
  };
}

module.exports = {
  MAP_WIDTH,
  MAP_HEIGHT,
  TILES,
  generateMap
};
