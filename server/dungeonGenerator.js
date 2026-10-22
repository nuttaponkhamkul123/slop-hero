// Procedural Dungeon Generator for Aetheria Online
// Generates randomized rooms, corridors, chests, and dungeon monsters
const { ITEMS, generateRandomizedGear } = require('./items');
const { mobExp, DUNGEON_EXP_MULT, DUNGEON_TRASH_FACTOR } = require('./progression');

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

// 10 Progressive Dungeon Floors (Every 15 levels up to Level 150)
const DUNGEON_FLOORS = [
  { floor: 1, name: 'Crypt of Whispers', minLevel: 1, maxLevel: 15, bossName: 'Grave Overlord Malok', subtitle: 'Lv. 1 - 15 • Skeleton & Slime Hordes' },
  { floor: 2, name: 'Sunken Catacombs', minLevel: 16, maxLevel: 30, bossName: 'Ancient Crypt Warden', subtitle: 'Lv. 16 - 30 • Tomb Ghouls & Sentinels' },
  { floor: 3, name: 'Obsidian Caverns', minLevel: 31, maxLevel: 45, bossName: 'Magma Behemoth', subtitle: 'Lv. 31 - 45 • Dark Spiders & Magma Golems' },
  { floor: 4, name: 'Glacial Abyss', minLevel: 46, maxLevel: 60, bossName: 'Frostbite Colossus', subtitle: 'Lv. 46 - 60 • Frost Elementals & Ice Horrors' },
  { floor: 5, name: 'Toxic Necropolis', minLevel: 61, maxLevel: 75, bossName: 'Plaguebringer Thok', subtitle: 'Lv. 61 - 75 • Plague Reapers & Wraiths' },
  { floor: 6, name: 'Infernal Sanctum', minLevel: 76, maxLevel: 90, bossName: 'Arch-Demon Balor', subtitle: 'Lv. 76 - 90 • Hellfire Fiends & Demons' },
  { floor: 7, name: 'Celestial Void', minLevel: 91, maxLevel: 105, bossName: 'Astral Singularity', subtitle: 'Lv. 91 - 105 • Astral Phantoms & Watchers' },
  { floor: 8, name: 'Dread Citadel', minLevel: 106, maxLevel: 120, bossName: 'Deathlord Nazgrak', subtitle: 'Lv. 106 - 120 • Death Knights & Shadow Lords' },
  { floor: 9, name: "Dragon's Maw", minLevel: 121, maxLevel: 135, bossName: 'Ancient Drake Imperator', subtitle: 'Lv. 121 - 135 • Ancient Drakes & Wyrm Berserkers' },
  { floor: 10, name: 'Throne of Oblivion', minLevel: 136, maxLevel: 150, bossName: 'Primordial Titan of Chaos', subtitle: 'Lv. 136 - 150 • Titan of Chaos & Cataclysm' }
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

  // 3. Carve Corridors connecting rooms in sequence. The boss chamber (last
  // room) is sealed off and reached through the boss teleport point instead.
  // L-shaped, 2-wide corridor from r1's centre to r2's centre
  const corridorPath = (r1, r2) => {
    const path = [];
    let cx = r1.cx;
    let cy = r1.cy;
    // Horizontal corridor (width 2)
    while (cx !== r2.cx) {
      path.push([cx, cy], [cx, cy + 1]);
      cx += cx < r2.cx ? 1 : -1;
    }
    // Turn Corner 2x2
    path.push([cx, cy], [cx, cy + 1], [cx + 1, cy], [cx + 1, cy + 1]);
    // Vertical corridor (width 2)
    while (cy !== r2.cy) {
      path.push([cx, cy], [cx + 1, cy]);
      cy += cy < r2.cy ? 1 : -1;
    }
    return path;
  };
  // A corridor must stay 2 tiles clear of the sealed room so a wall separates them
  const pathTouchesRoom = (path, r) =>
    path.some(([x, y]) => x >= r.x - 2 && x <= r.x + r.w + 1 && y >= r.y - 2 && y <= r.y + r.h + 1);

  // Pick a boss chamber that none of the remaining corridors pass by, and
  // move it to the end of the list (the last room is the boss room).
  let hasSealedBossRoom = false;
  let corridorPaths = [];
  if (rooms.length >= 3) {
    for (let k = rooms.length - 1; k >= 1 && !hasSealedBossRoom; k--) {
      const order = rooms.filter((_, i) => i !== k);
      const paths = [];
      for (let i = 0; i < order.length - 1; i++) paths.push(corridorPath(order[i], order[i + 1]));
      if (!paths.some(p => pathTouchesRoom(p, rooms[k]))) {
        const boss = rooms[k];
        rooms.splice(0, rooms.length, ...order, boss);
        corridorPaths = paths;
        hasSealedBossRoom = true;
      }
    }
  }
  if (!hasSealedBossRoom) {
    // Fallback: no room can be isolated, keep the classic fully-connected layout
    for (let i = 0; i < rooms.length - 1; i++) corridorPaths.push(corridorPath(rooms[i], rooms[i + 1]));
  }
  corridorPaths.forEach(path => path.forEach(([x, y]) => { tiles[y][x] = DUNGEON_TILES.CORRIDOR; }));

  // Room 0 is Spawn Room; Last Room is Boss Chamber
  const spawnRoom = rooms[0];
  const bossRoom = rooms[rooms.length - 1];

  const spawnPoint = { x: spawnRoom.cx, y: spawnRoom.cy };
  // Place return portal on opposite side of the room
  const exitPortal = { x: spawnRoom.x + 1, y: spawnRoom.y + 1 };
  tiles[exitPortal.y][exitPortal.x] = DUNGEON_TILES.PORTAL_EXIT;

  // Boss teleport point at the far end of the last regular room, an arrival
  // spot inside the sealed boss chamber, and a way back out of the chamber.
  let bossPortal = null;
  let bossArrival = null;
  let bossExitPortal = null;
  if (hasSealedBossRoom) {
    const gateRoom = rooms[rooms.length - 2];
    bossPortal = { x: gateRoom.x + gateRoom.w - 2, y: gateRoom.y + gateRoom.h - 2 };
    tiles[bossPortal.y][bossPortal.x] = DUNGEON_TILES.PORTAL_EXIT;
    bossArrival = { x: bossRoom.x + 1.5, y: bossRoom.y + bossRoom.h - 1.5 };
    bossExitPortal = { x: bossRoom.x + bossRoom.w - 2, y: bossRoom.y + 1 };
    tiles[bossExitPortal.y][bossExitPortal.x] = DUNGEON_TILES.PORTAL_EXIT;
  }

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

  if (bossPortal) {
    obstacles.push({
      id: 'portal_boss_chamber',
      x: bossPortal.x,
      y: bossPortal.y,
      type: 'portal',
      name: 'Boss Chamber Portal',
      label: 'Boss Chamber',
      color: '#ef4444',
      collidable: false,
      radius: 1.0
    });
    obstacles.push({
      id: 'portal_boss_exit',
      x: bossExitPortal.x,
      y: bossExitPortal.y,
      type: 'portal',
      name: 'Return to Town Portal',
      label: 'Return to Town',
      color: '#38bdf8',
      collidable: false,
      radius: 1.0
    });
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
      if (tiles[sc.y] && tiles[sc.y][sc.x] === DUNGEON_TILES.WALL) {
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
      const floorConfig = DUNGEON_FLOORS[floorLevel - 1] || DUNGEON_FLOORS[0];
      const bossAffixes = diff.id === 'normal' ? [] :
                          diff.id === 'hard' ? rollAffixes(2, true) :
                          rollAffixes(3, true);
      const isCommander = diff.id !== 'normal'; // Boss is always commander on Hard & Nightmare

      const bossLevel = floorConfig.maxLevel + (diff.id === 'nightmare' ? 5 : diff.id === 'hard' ? 2 : 0);
      let bossHp = Math.round((700 + bossLevel * 160 + Math.pow(bossLevel, 1.25) * 15) * diff.hpMult);
      let bossDef = Math.round(15 + bossLevel * 2.2);
      if (bossAffixes.includes('fortified')) {
        bossHp = Math.round(bossHp * 1.6);
        bossDef += 15;
      }

      mobs.push({
        id: `mob_${nextEntityId++}`,
        type: 'golem',
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
        dmg: Math.round((30 + bossLevel * 4.5) * diff.dmgMult),
        def: bossDef,
        speed: 2.3,
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

      // Spawn Royal Guard minions alongside the Boss (10 minions)
      for (let g = 0; g < 10; g++) {
        const minionLvl = Math.max(1, bossLevel - 2);
        const gx = r.x + 2 + Math.random() * (r.w - 4);
        const gy = r.y + 2 + Math.random() * (r.h - 4);
        mobs.push({
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
          hp: Math.round((280 + minionLvl * 65) * diff.hpMult),
          maxHp: Math.round((280 + minionLvl * 65) * diff.hpMult),
          dmg: Math.round((25 + minionLvl * 3.5) * diff.dmgMult),
          def: Math.round(12 + minionLvl * 1.8),
          speed: 2.2,
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
    } else {
      // Normal Dungeon Mobs: 10x Swarm density (20 - 25 mobs per room!)
      const floorConfig = DUNGEON_FLOORS[floorLevel - 1] || DUNGEON_FLOORS[0];
      const baseCount = Math.floor(Math.random() * 6) + 20; // 10x multiplier from original 2-3
      const mobCount = Math.round(baseCount * diff.densityMult);

      // Check if this room has a pack Commander
      const roomHasCommander = diff.commanderChance > 0 && Math.random() < diff.commanderChance;
      let commanderAssigned = false;

      for (let m = 0; m < mobCount; m++) {
        const mobType = Math.random() > 0.5 ? 'skeleton' : 'goblin';
        const mx = r.x + 1 + Math.random() * (r.w - 2);
        const my = r.y + 1 + Math.random() * (r.h - 2);

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

        const baseHp = mobType === 'skeleton' ? 220 : 160;
        let hp = Math.round((baseHp + mobLvl * 50 + Math.pow(mobLvl, 1.2) * 8) * diff.hpMult);
        let def = Math.round(8 + mobLvl * 1.6);
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

        const mobBaseName = mobType === 'skeleton' ? 'Dungeon Skeleton' : 'Abyssal Stalker';

        mobs.push({
          id: `mob_${nextEntityId++}`,
          type: mobType,
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
          dmg: Math.round((18 + mobLvl * 2.8) * diff.dmgMult),
          def,
          speed: isCommander ? 3.1 : 2.8,
          exp: Math.max(1, Math.round(mobExp(mobLvl, isCommander ? 'commander' : 'normal') * diff.expMult * DUNGEON_TRASH_FACTOR)),
          gold: Math.round((35 + mobLvl * 10) * diff.goldMult),
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

  return {
    width,
    height,
    tiles,
    rooms,
    spawnPoint,
    exitPortal,
    bossPortal,
    bossArrival,
    bossExitPortal,
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
  if (Math.random() < 0.15) {
    const rareConsumables = ['greater_health_potion', 'greater_mana_potion', 'elixir_of_fury', 'elixir_of_iron', 'town_scroll'];
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
    const gearPool = isBoss ?
      ['excalibur', 'wind_rapier', 'sweeping_claymore', 'ring_of_power', 'mystic_robe', 'plate_cuirass', 'archmage_cowl', 'winged_boots'] :
      ['iron_blade', 'shadow_daggers', 'sweeping_claymore', 'leather_tunic', 'iron_helm', 'iron_greaves', 'shadow_hood'];
    const gearId = gearPool[Math.floor(Math.random() * gearPool.length)];
    const customGear = generateRandomizedGear(gearId, floorLevel, isBoss);
    drops.push({ type: 'item', itemId: gearId, customItemData: customGear, amount: 1 });
  }

  return drops;
}

module.exports = {
  DUNGEON_WIDTH,
  DUNGEON_HEIGHT,
  DUNGEON_TILES,
  DIFFICULTIES,
  AFFIX_POOL,
  DUNGEON_FLOORS,
  generateProceduralDungeon,
  rollDungeonLoot
};
