// Procedural Dungeon Generator for Aetheria Online
// Generates randomized rooms, corridors, chests, and dungeon monsters
const { ITEMS } = require('./items');

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

// Difficulty Configurations & Modifiers
const DIFFICULTIES = {
  normal: {
    id: 'normal',
    name: 'Normal',
    label: '🟢 Normal',
    densityMult: 1.0,
    hpMult: 1.0,
    dmgMult: 1.0,
    expMult: 1.0,
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
    expMult: 1.8,
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
    expMult: 3.0,
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

function generateProceduralDungeon(floorLevel = 1, difficulty = 'normal') {
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const width = DUNGEON_WIDTH;
  const height = DUNGEON_HEIGHT;
  const tiles = [];

  // 1. Initialize empty dark abyss grid
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = DUNGEON_TILES.VOID;
    }
  }

  // 2. Generate Non-Overlapping Rooms
  const rooms = [];
  const maxRooms = 7;
  const minRoomSize = 5;
  const maxRoomSize = 9;

  let attempts = 0;
  while (rooms.length < maxRooms && attempts < 100) {
    attempts++;
    const rw = Math.floor(Math.random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
    const rh = Math.floor(Math.random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
    const rx = Math.floor(Math.random() * (width - rw - 4)) + 2;
    const ry = Math.floor(Math.random() * (height - rh - 4)) + 2;

    const newRoom = {
      x: rx,
      y: ry,
      w: rw,
      h: rh,
      cx: Math.floor(rx + rw / 2),
      cy: Math.floor(ry + rh / 2)
    };

    // Check collision with existing rooms (buffer 2 tiles)
    const overlaps = rooms.some(r => {
      return !(newRoom.x + newRoom.w + 2 < r.x ||
               newRoom.x > r.x + r.w + 2 ||
               newRoom.y + newRoom.h + 2 < r.y ||
               newRoom.y > r.y + r.h + 2);
    });

    if (!overlaps) {
      rooms.push(newRoom);
      // Carve room floor
      for (let y = newRoom.y; y < newRoom.y + newRoom.h; y++) {
        for (let x = newRoom.x; x < newRoom.x + newRoom.w; x++) {
          tiles[y][x] = DUNGEON_TILES.FLOOR;
        }
      }
    }
  }

  // 3. Carve Corridors connecting rooms in sequence
  for (let i = 0; i < rooms.length - 1; i++) {
    const r1 = rooms[i];
    const r2 = rooms[i + 1];

    let cx = r1.cx;
    let cy = r1.cy;

    // Horizontal corridor (width 2)
    while (cx !== r2.cx) {
      tiles[cy][cx] = DUNGEON_TILES.CORRIDOR;
      tiles[cy + 1][cx] = DUNGEON_TILES.CORRIDOR;
      cx += cx < r2.cx ? 1 : -1;
    }
    // Turn Corner 2x2
    tiles[cy][cx] = DUNGEON_TILES.CORRIDOR;
    tiles[cy + 1][cx] = DUNGEON_TILES.CORRIDOR;
    tiles[cy][cx + 1] = DUNGEON_TILES.CORRIDOR;
    tiles[cy + 1][cx + 1] = DUNGEON_TILES.CORRIDOR;

    // Vertical corridor (width 2)
    while (cy !== r2.cy) {
      tiles[cy][cx] = DUNGEON_TILES.CORRIDOR;
      tiles[cy][cx + 1] = DUNGEON_TILES.CORRIDOR;
      cy += cy < r2.cy ? 1 : -1;
    }
  }

  // Room 0 is Spawn Room; Last Room is Boss Chamber
  const spawnRoom = rooms[0];
  const bossRoom = rooms[rooms.length - 1];

  const spawnPoint = { x: spawnRoom.cx, y: spawnRoom.cy };
  // Place return portal on opposite side of the room
  const exitPortal = { x: spawnRoom.x + 1, y: spawnRoom.y + 1 };
  tiles[exitPortal.y][exitPortal.x] = DUNGEON_TILES.PORTAL_EXIT;

  // 3.5. Form Wall Perimeter: Any non-floor tile touching a floor becomes a solid 3D WALL
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x] !== DUNGEON_TILES.FLOOR &&
          tiles[y][x] !== DUNGEON_TILES.CORRIDOR &&
          tiles[y][x] !== DUNGEON_TILES.PORTAL_EXIT) {
        let touchesFloor = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const neighbor = tiles[ny][nx];
              if (neighbor === DUNGEON_TILES.FLOOR ||
                  neighbor === DUNGEON_TILES.CORRIDOR ||
                  neighbor === DUNGEON_TILES.PORTAL_EXIT) {
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

  // Add Return Portal Obstacle in Spawn Room
  obstacles.push({
    id: 'portal_town_return',
    x: exitPortal.x,
    y: exitPortal.y,
    type: 'portal',
    name: 'Return to Town Portal',
    collidable: false,
    radius: 1.0
  });

  // Add Wall Torches in rooms
  rooms.forEach((r, idx) => {
    obstacles.push({
      id: `dungeon_torch_${idx}_1`,
      x: r.x + 1,
      y: r.y + 1,
      type: 'torch',
      collidable: false
    });
    obstacles.push({
      id: `dungeon_torch_${idx}_2`,
      x: r.x + r.w - 2,
      y: r.y + r.h - 2,
      type: 'torch',
      collidable: false
    });

    // Place Treasure Chests in rooms (except spawn room)
    if (idx !== 0) {
      const isBossRoom = idx === rooms.length - 1;
      const chestCount = isBossRoom ? (diff.id === 'nightmare' ? 3 : 2) : 1;
      for (let c = 0; c < chestCount; c++) {
        const chestX = r.x + 2 + Math.floor(Math.random() * (r.w - 4));
        const chestY = r.y + 2 + Math.floor(Math.random() * (r.h - 4));
        chests.push({
          id: `chest_${nextEntityId++}`,
          x: chestX,
          y: chestY,
          isGold: isBossRoom || (diff.id === 'nightmare' && Math.random() < 0.4),
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
    if (idx === 0) return; // No mobs in spawn room

    const isBossRoom = idx === rooms.length - 1;

    if (isBossRoom) {
      // Dungeon Boss!
      const bossAffixes = diff.id === 'normal' ? [] :
                          diff.id === 'hard' ? rollAffixes(2, true) :
                          rollAffixes(3, true);
      const isCommander = diff.id !== 'normal'; // Boss is always commander on Hard & Nightmare

      let bossHp = Math.round((700 + floorLevel * 250) * diff.hpMult);
      let bossDef = Math.round(18 + floorLevel * 5);
      if (bossAffixes.includes('fortified')) {
        bossHp = Math.round(bossHp * 1.6);
        bossDef += 14;
      }

      mobs.push({
        id: `mob_${nextEntityId++}`,
        type: 'golem',
        name: `Dungeon Overlord (F${floorLevel} - ${diff.name})`,
        level: 6 + floorLevel * 2 + (diff.id === 'nightmare' ? 3 : diff.id === 'hard' ? 1 : 0),
        x: r.cx,
        y: r.cy,
        spawnX: r.cx,
        spawnY: r.cy,
        zone: { minX: r.x, maxX: r.x + r.w, minY: r.y, maxY: r.y + r.h },
        isBoss: true,
        hp: bossHp,
        maxHp: bossHp,
        dmg: Math.round((34 + floorLevel * 8) * diff.dmgMult),
        def: bossDef,
        speed: 2.2,
        exp: Math.round((300 + floorLevel * 120) * diff.expMult),
        gold: Math.round((180 + floorLevel * 80) * diff.goldMult),
        buffs: bossAffixes,
        isCommander,
        auraRadius: isCommander ? 6.5 : 0,
        targetPlayerId: null,
        state: 'idle',
        nextWanderTime: Date.now() + 2000,
        wanderTarget: null,
        attackCooldown: 0,
        respawnTimer: 0,
        facing: 'SE'
      });
    } else {
      // Normal Dungeon Mobs: Crypt Skeletons & Dark Goblins with Affixes
      const baseCount = Math.floor(Math.random() * 2) + 2;
      const mobCount = Math.round(baseCount * diff.densityMult);

      // Check if this room has a pack Commander
      const roomHasCommander = diff.commanderChance > 0 && Math.random() < diff.commanderChance;
      let commanderAssigned = false;

      for (let m = 0; m < mobCount; m++) {
        const mobType = Math.random() > 0.5 ? 'skeleton' : 'goblin';
        const mx = r.x + 1 + Math.random() * (r.w - 2);
        const my = r.y + 1 + Math.random() * (r.h - 2);

        // Substantial base monster stats (no longer 1-hit pushovers!)
        const baseHp = mobType === 'skeleton' ? 260 : 190;
        const baseDef = mobType === 'skeleton' ? 12 : 8;
        const baseDmg = mobType === 'skeleton' ? 24 : 18;

        // Roll Affixes
        const numAffixes = Math.floor(Math.random() * (diff.affixMax - diff.affixMin + 1)) + diff.affixMin;
        const mobAffixes = rollAffixes(numAffixes);

        const isCommander = roomHasCommander && !commanderAssigned;
        if (isCommander) {
          commanderAssigned = true;
          if (!mobAffixes.includes('commander')) mobAffixes.push('commander');
        }

        let hp = Math.round((baseHp + floorLevel * 30) * diff.hpMult);
        let def = baseDef + floorLevel * 2;
        if (mobAffixes.includes('fortified')) {
          hp = Math.round(hp * 1.7);
          def += 12;
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

        const mobBaseName = mobType === 'skeleton' ? 'Crypt Skeleton' : 'Dungeon Stalker';

        mobs.push({
          id: `mob_${nextEntityId++}`,
          type: mobType,
          name: `${prefix}${mobBaseName} (F${floorLevel})`,
          level: 3 + floorLevel + (diff.id === 'nightmare' ? 2 : diff.id === 'hard' ? 1 : 0),
          x: mx,
          y: my,
          spawnX: mx,
          spawnY: my,
          zone: { minX: r.x, maxX: r.x + r.w, minY: r.y, maxY: r.y + r.h },
          isBoss: false,
          hp,
          maxHp: hp,
          dmg: Math.round((baseDmg + floorLevel * 4) * diff.dmgMult),
          def,
          speed: isCommander ? 3.1 : 2.8,
          exp: Math.round((70 + floorLevel * 25) * diff.expMult),
          gold: Math.round((40 + floorLevel * 18) * diff.goldMult),
          buffs: mobAffixes,
          isCommander,
          auraRadius: isCommander ? 5.5 : 0,
          targetPlayerId: null,
          state: 'idle',
          nextWanderTime: Date.now() + 2000,
          wanderTarget: null,
          attackCooldown: 0,
          respawnTimer: 0,
          facing: 'SE'
        });
      }
    }
  });

  return {
    width,
    height,
    tiles,
    rooms,
    spawnPoint,
    exitPortal,
    obstacles,
    chests,
    mobs,
    floorLevel,
    name: 'Dungeon Catacombs',
    isDungeon: true
  };
}

// Generate Loot Table for Chests or Monsters
function rollDungeonLoot(isBoss = false, floorLevel = 1) {
  const drops = [];

  // Gold drops
  const goldAmount = isBoss ? Math.floor(100 + Math.random() * 150 * floorLevel) :
                              Math.floor(25 + Math.random() * 40 * floorLevel);
  drops.push({ type: 'gold', amount: goldAmount, name: `${goldAmount} Gold Coins` });

  // Potions
  if (Math.random() < 0.7) {
    drops.push({ type: 'item', itemId: 'health_potion', amount: 1 });
  }
  if (Math.random() < 0.5) {
    drops.push({ type: 'item', itemId: 'mana_potion', amount: 1 });
  }

  // Valuable Relics / Treasures to sell in shop
  const relicPool = ['ancient_ruby', 'cursed_chalice', 'shadow_essence'];
  if (isBoss || Math.random() < 0.6) {
    const relicId = isBoss && Math.random() > 0.4 ?
      (Math.random() > 0.5 ? 'golden_idol' : 'dragon_scale') :
      relicPool[Math.floor(Math.random() * relicPool.length)];
    drops.push({ type: 'item', itemId: relicId, amount: 1 });
  }

  // Rare Equipment Drops
  if (isBoss || Math.random() < 0.4) {
    const gearPool = isBoss ?
      ['excalibur', 'ring_of_power', 'mystic_robe', 'plate_cuirass', 'archmage_cowl', 'winged_boots'] :
      ['iron_blade', 'shadow_daggers', 'leather_tunic', 'iron_helm', 'iron_greaves', 'shadow_hood'];
    const gearId = gearPool[Math.floor(Math.random() * gearPool.length)];
    drops.push({ type: 'item', itemId: gearId, amount: 1 });
  }

  return drops;
}

module.exports = {
  DUNGEON_WIDTH,
  DUNGEON_HEIGHT,
  DUNGEON_TILES,
  DIFFICULTIES,
  AFFIX_POOL,
  generateProceduralDungeon,
  rollDungeonLoot
};
