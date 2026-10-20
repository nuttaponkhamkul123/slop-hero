const { MAP_WIDTH, MAP_HEIGHT, TILES, generateMap } = require('./mapData');
const { generateProceduralDungeon, rollDungeonLoot, DIFFICULTIES, AFFIX_POOL } = require('./dungeonGenerator');
const { ITEMS } = require('./items');

class GameServer {
  constructor(io) {
    this.io = io;
    this.townMap = generateMap();
    this.dungeonFloor = 1;
    this.dungeonDifficulty = 'normal';
    this.dungeon = generateProceduralDungeon(this.dungeonFloor, this.dungeonDifficulty);

    this.players = new Map();
    this.townMobs = new Map();
    this.dungeonMobs = new Map();

    this.townGroundItems = new Map();
    this.dungeonGroundItems = new Map();

    this.projectiles = new Map();
    this.nextEntityId = 1000;

    this.TICK_RATE = 25;
    this.tickInterval = null;

    this.initTownMonsters();
    this.initDungeonMonsters();
    this.startGameLoop();
  }

  initTownMonsters() {
    this.townMobs.clear();
    const mobDefinitions = [
      { type: 'slime', name: 'Meadow Slime', level: 1, maxHp: 120, def: 5, dmg: 14, speed: 2.3, exp: 35, gold: 15, count: 6, zone: { minX: 4, maxX: 14, minY: 4, maxY: 14 } },
      { type: 'goblin', name: 'Goblin Scout', level: 3, maxHp: 260, def: 10, dmg: 22, speed: 3.2, exp: 75, gold: 35, count: 6, zone: { minX: 27, maxX: 38, minY: 18, maxY: 35 } },
      { type: 'skeleton', name: 'Ancient Skeleton', level: 5, maxHp: 440, def: 16, dmg: 32, speed: 2.8, exp: 140, gold: 75, count: 5, zone: { minX: 5, maxX: 14, minY: 27, maxY: 37 } },
      { type: 'golem', name: 'Titan Stone Golem', level: 8, maxHp: 1400, def: 26, dmg: 52, speed: 2.0, exp: 450, gold: 300, count: 1, zone: { minX: 8, maxX: 10, minY: 31, maxY: 33 }, isBoss: true }
    ];

    mobDefinitions.forEach(def => {
      for (let i = 0; i < def.count; i++) {
        const id = `mob_${this.nextEntityId++}`;
        const spawnX = def.zone.minX + Math.random() * (def.zone.maxX - def.zone.minX);
        const spawnY = def.zone.minY + Math.random() * (def.zone.maxY - def.zone.minY);

        this.townMobs.set(id, {
          id,
          type: def.type,
          name: def.name,
          level: def.level,
          x: spawnX,
          y: spawnY,
          spawnX,
          spawnY,
          zone: def.zone,
          isBoss: !!def.isBoss,
          hp: def.maxHp,
          maxHp: def.maxHp,
          dmg: def.dmg,
          def: def.def,
          speed: def.speed,
          exp: def.exp,
          gold: def.gold,
          buffs: [],
          isCommander: false,
          auraRadius: 0,
          targetPlayerId: null,
          state: 'idle',
          nextWanderTime: Date.now() + Math.random() * 3000,
          wanderTarget: null,
          attackCooldown: 0,
          respawnTimer: 0,
          facing: 'SE'
        });
      }
    });
  }

  initDungeonMonsters() {
    this.dungeonMobs.clear();
    if (this.dungeon && this.dungeon.mobs) {
      this.dungeon.mobs.forEach(mob => {
        this.dungeonMobs.set(mob.id, {
          ...mob,
          def: mob.def || 12,
          buffs: mob.buffs || [],
          isCommander: !!mob.isCommander,
          auraRadius: mob.auraRadius || 0,
          hasCommanderBuff: false
        });
      });
    }
  }

  regenerateDungeon(floor = 1, difficulty = 'normal') {
    this.dungeonFloor = floor;
    this.dungeonDifficulty = difficulty;
    this.dungeon = generateProceduralDungeon(floor, difficulty);
    this.dungeonGroundItems.clear();
    this.initDungeonMonsters();
    const diffLabel = (DIFFICULTIES[difficulty] && DIFFICULTIES[difficulty].name) || difficulty;
    this.broadcastSystemMessage(`🌀 Abyssal Portal re-aligned to Floor ${floor} [${diffLabel.toUpperCase()}]!`);
  }

  isColliding(x, y, zone = 'town', radius = 0.4) {
    if (zone === 'town') {
      if (x < 1 || x > MAP_WIDTH - 2 || y < 1 || y > MAP_HEIGHT - 2) return true;
      const tileX = Math.floor(x);
      const tileY = Math.floor(y);
      if (tileX >= 0 && tileX < MAP_WIDTH && tileY >= 0 && tileY < MAP_HEIGHT) {
        const tile = this.townMap.tiles[tileY][tileX];
        if (tile === TILES.WATER || tile === TILES.CLIFF) return true;
      }
      for (const obs of this.townMap.obstacles) {
        if (!obs.collidable) continue;
        const obsRadius = obs.radius || 0.6;
        if (Math.hypot(obs.x - x, obs.y - y) < (radius + obsRadius)) return true;
      }
    } else {
      // Dungeon collision
      const dungeon = this.dungeon;
      if (x < 1 || x > dungeon.width - 2 || y < 1 || y > dungeon.height - 2) return true;

      // Check perimeter circle points with radius (prevents wall clipping)
      const r = Math.max(0.2, radius);
      const points = [
        { dx: 0, dy: 0 },
        { dx: -r, dy: 0 },
        { dx: r, dy: 0 },
        { dx: 0, dy: -r },
        { dx: 0, dy: r },
        { dx: -r * 0.7, dy: -r * 0.7 },
        { dx: r * 0.7, dy: -r * 0.7 },
        { dx: -r * 0.7, dy: r * 0.7 },
        { dx: r * 0.7, dy: r * 0.7 }
      ];

      for (const pt of points) {
        const tx = Math.floor(x + pt.dx);
        const ty = Math.floor(y + pt.dy);
        if (tx < 0 || tx >= dungeon.width || ty < 0 || ty >= dungeon.height) return true;
        const tile = dungeon.tiles[ty][tx];
        // 7 = WALL, 8 = VOID
        if (tile === 7 || tile === 8) return true;
      }

      for (const obs of dungeon.obstacles) {
        if (!obs.collidable) continue;
        if (Math.hypot(obs.x - x, obs.y - y) < (radius + 0.6)) return true;
      }
    }
    return false;
  }

  addPlayer(socket, data) {
    const defaultClasses = {
      warrior: { maxHp: 180, maxMp: 50, dmg: 22, def: 8, speed: 4.8, attackRange: 1.6, skillName: 'Whirlwind' },
      mage: { maxHp: 95, maxMp: 130, dmg: 32, def: 3, speed: 4.4, attackRange: 5.5, skillName: 'Firestorm' },
      rogue: { maxHp: 125, maxMp: 70, dmg: 26, def: 5, speed: 5.4, attackRange: 1.8, skillName: 'Shadow Strike' }
    };

    const chosenClass = defaultClasses[data.characterClass] ? data.characterClass : 'warrior';
    const classStats = defaultClasses[chosenClass];

    const spawnX = 20 + (Math.random() - 0.5) * 2;
    const spawnY = 23 + (Math.random() - 0.5) * 1.5; // Spawn in open south plaza, away from fountain

    const player = {
      id: socket.id,
      name: (data.name || 'Hero').substring(0, 15).trim() || 'Hero',
      characterClass: chosenClass,
      zone: 'town', // 'town' or 'dungeon'
      x: spawnX,
      y: spawnY,
      targetX: null,
      targetY: null,
      moveDir: { dx: 0, dy: 0 },
      facing: 'SE',
      isMoving: false,
      level: 1,
      exp: 0,
      expNext: 100,
      baseStats: {
        maxHp: classStats.maxHp,
        maxMp: classStats.maxMp,
        dmg: classStats.dmg,
        def: classStats.def,
        speed: classStats.speed,
        attackRange: classStats.attackRange
      },
      equipment: {
        weapon: null,
        armor: null,
        helmet: null,
        boots: null,
        ring: null
      },
      hp: classStats.maxHp,
      maxHp: classStats.maxHp,
      mp: classStats.maxMp,
      maxMp: classStats.maxMp,
      dmg: classStats.dmg,
      def: classStats.def,
      speed: classStats.speed,
      attackRange: classStats.attackRange,
      gold: 50,
      inventory: {
        healthPotions: 3,
        manaPotions: 2,
        kills: 0,
        items: [
          { ...ITEMS.ancient_ruby, count: 1 } // Starter relic to try shop selling!
        ]
      },
      attackCooldown: 0,
      skillCooldown: 0,
      portalCooldown: 0,
      isAttacking: false,
      speechBubble: null,
      speechTimer: 0,
      isDead: false,
      respawnTimer: 0,
      statusEffects: [],
      speedFactor: 1.0
    };

    // Equip starter gear tailored to chosen class
    if (chosenClass === 'warrior') {
      player.equipment.weapon = { ...ITEMS.iron_blade, count: 1 };
      player.equipment.helmet = { ...ITEMS.iron_helm, count: 1 };
    } else if (chosenClass === 'mage') {
      player.equipment.weapon = { ...ITEMS.archmage_staff, count: 1 };
      player.equipment.armor = { ...ITEMS.mystic_robe, count: 1 };
    } else if (chosenClass === 'rogue') {
      player.equipment.weapon = { ...ITEMS.shadow_daggers, count: 1 };
      player.equipment.armor = { ...ITEMS.leather_tunic, count: 1 };
    }
    this.recalculatePlayerStats(player);

    this.players.set(socket.id, player);

    // Initial world state for this client
    socket.emit('init_game', {
      playerId: socket.id,
      zone: 'town',
      map: this.townMap,
      player,
      players: Array.from(this.players.values()).filter(p => p.zone === 'town'),
      mobs: Array.from(this.townMobs.values()),
      groundItems: Array.from(this.townGroundItems.values()),
      shopItems: Object.values(ITEMS).filter(it => it.buyPrice)
    });

    socket.broadcast.emit('player_joined', player);
    this.broadcastSystemMessage(`⚔️ [${player.name} the ${player.characterClass.toUpperCase()}] entered the realm!`);
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      this.players.delete(socketId);
      this.io.emit('player_left', socketId);
      this.broadcastSystemMessage(`🚪 [${player.name}] has departed.`);
    }
  }

  handlePlayerInput(socketId, input) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    if (input.type === 'click_move') {
      const maxX = player.zone === 'town' ? MAP_WIDTH - 2 : this.dungeon.width - 2;
      const maxY = player.zone === 'town' ? MAP_HEIGHT - 2 : this.dungeon.height - 2;
      player.targetX = Math.max(1, Math.min(maxX, input.x));
      player.targetY = Math.max(1, Math.min(maxY, input.y));
      player.moveDir = { dx: 0, dy: 0 };
    } else if (input.type === 'wasd_move') {
      player.moveDir = { dx: input.dx || 0, dy: input.dy || 0 };
      player.targetX = null;
      player.targetY = null;
    } else if (input.type === 'stop_move') {
      player.targetX = null;
      player.targetY = null;
      player.moveDir = { dx: 0, dy: 0 };
      player.isMoving = false;
    }
  }

  // Handle Portals & Chests
  checkPortalAndInteractions(player, socket) {
    if (player.portalCooldown > 0) return;

    if (player.zone === 'town') {
      const distToPortal = Math.hypot(player.x - 23.5, player.y - 16.5);
      if (distToPortal < 1.3) {
        player.portalCooldown = 2.0;
        socket.emit('open_dungeon_portal_modal');
      }
    } else if (player.zone === 'dungeon') {
      const exitP = this.dungeon.exitPortal;
      const distToExit = Math.hypot(player.x - exitP.x, player.y - exitP.y);
      if (distToExit < 1.3) {
        this.teleportPlayerToTown(player, socket);
      }
    }
  }

  handleEnterDungeon(socketId, options = {}) {
    const player = this.players.get(socketId);
    if (!player || player.zone !== 'town' || player.isDead) return;
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return;

    const floor = Math.max(1, Math.min(3, parseInt(options.floor, 10) || 1));
    const difficulty = ['normal', 'hard', 'nightmare'].includes(options.difficulty) ? options.difficulty : 'normal';

    // Regenerate procedural dungeon with chosen floor and difficulty
    this.regenerateDungeon(floor, difficulty);
    this.teleportPlayerToDungeon(player, socket);
  }

  handleLeaveDungeon(socketId) {
    const player = this.players.get(socketId);
    if (!player || player.zone !== 'dungeon' || player.isDead) return;
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) this.teleportPlayerToTown(player, socket);
  }

  teleportPlayerToDungeon(player, socket) {
    player.portalCooldown = 4.0; // 4 second cooldown prevents bounce-back
    player.zone = 'dungeon';
    player.x = this.dungeon.spawnPoint.x;
    player.y = this.dungeon.spawnPoint.y;
    player.targetX = null;
    player.targetY = null;

    socket.emit('zone_change', {
      zone: 'dungeon',
      map: this.dungeon,
      floorLevel: this.dungeonFloor,
      difficulty: this.dungeonDifficulty,
      player,
      players: Array.from(this.players.values()).filter(p => p.zone === 'dungeon'),
      mobs: Array.from(this.dungeonMobs.values()),
      groundItems: Array.from(this.dungeonGroundItems.values()),
      chests: this.dungeon.chests
    });

    const diffName = (DIFFICULTIES[this.dungeonDifficulty] && DIFFICULTIES[this.dungeonDifficulty].name) || this.dungeonDifficulty;
    this.broadcastSystemMessage(`🌀 [${player.name}] entered the Procedural Dungeon (Floor ${this.dungeonFloor} - ${diffName})!`);
  }

  teleportPlayerToTown(player, socket) {
    player.portalCooldown = 4.0; // 4 second cooldown prevents bounce-back
    player.zone = 'town';
    player.x = 21.0;
    player.y = 19.0;
    player.targetX = null;
    player.targetY = null;

    socket.emit('zone_change', {
      zone: 'town',
      map: this.townMap,
      player,
      players: Array.from(this.players.values()).filter(p => p.zone === 'town'),
      mobs: Array.from(this.townMobs.values()),
      groundItems: Array.from(this.townGroundItems.values())
    });

    this.broadcastSystemMessage(`🏰 [${player.name}] returned safely to town.`);
  }

  // Handle Opening Treasure Chests in Dungeon
  handleOpenChest(socketId, chestId) {
    const player = this.players.get(socketId);
    if (!player || player.zone !== 'dungeon' || player.isDead) return;

    const chest = this.dungeon.chests.find(c => c.id === chestId);
    if (!chest || chest.opened) return;

    const dist = Math.hypot(chest.x - player.x, chest.y - player.y);
    if (dist <= 2.5) {
      chest.opened = true;
      const loot = rollDungeonLoot(chest.isGold, this.dungeonFloor);

      loot.forEach((it, idx) => {
        const dropX = chest.x + (Math.random() - 0.5) * 1.5;
        const dropY = chest.y + (Math.random() - 0.5) * 1.5;
        if (it.type === 'gold') {
          this.spawnGroundItem('dungeon', 'gold', 'Gold Coins', dropX, dropY, it.amount);
        } else {
          this.spawnGroundItem('dungeon', 'item', it.itemId, dropX, dropY, it.amount);
        }
      });

      this.io.emit('chest_opened', { chestId, openedBy: player.name });
      this.io.emit('floating_text', {
        x: chest.x,
        y: chest.y - 0.8,
        text: '💎 Chest Unlocked!',
        color: '#facc15'
      });
    }
  }

  handlePlayerAttack(socketId, targetInfo) {
    const player = this.players.get(socketId);
    if (!player || player.isDead || player.attackCooldown > 0) return;

    player.attackCooldown = 0.55;
    player.isAttacking = true;

    const mobsMap = player.zone === 'town' ? this.townMobs : this.dungeonMobs;

    if (targetInfo && targetInfo.targetType === 'mob') {
      const mob = mobsMap.get(targetInfo.targetId);
      if (!mob || mob.state === 'dead') return;

      const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
      if (dist <= player.attackRange + 1.0) {
        player.facing = this.calculateFacing(player.x, player.y, mob.x, mob.y);

        if (player.characterClass === 'mage') {
          this.spawnProjectile(player, mob.x, mob.y, mob.id, 'mob', player.dmg);
        } else {
          this.applyDamageToMob(player, mob, player.dmg, false);
        }
      }
    } else {
      if (targetInfo && targetInfo.worldX !== undefined) {
        player.facing = this.calculateFacing(player.x, player.y, targetInfo.worldX, targetInfo.worldY);
      }
      if (player.characterClass === 'mage' && targetInfo && targetInfo.worldX !== undefined) {
        this.spawnProjectile(player, targetInfo.worldX, targetInfo.worldY, null, 'point', player.dmg);
      }
    }

    this.io.emit('entity_attack_fx', {
      attackerId: player.id,
      attackerType: 'player',
      class: player.characterClass,
      targetId: targetInfo ? targetInfo.targetId : null,
      x: player.x,
      y: player.y,
      facing: player.facing
    });
  }

  handlePlayerSkill(socketId, skillData) {
    const player = this.players.get(socketId);
    if (!player || player.isDead || player.skillCooldown > 0) return;

    const mpCost = player.characterClass === 'warrior' ? 12 : player.characterClass === 'rogue' ? 15 : 20;
    const socket = this.io.sockets.sockets.get(socketId);

    if (player.mp < mpCost) {
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: '⚠️ Not enough Mana!',
          color: '#38bdf8'
        });
      }
      return;
    }

    player.mp -= mpCost;
    if (socket) socket.emit('player_updated', player);

    const mobsMap = player.zone === 'town' ? this.townMobs : this.dungeonMobs;

    if (player.characterClass === 'warrior') {
      player.skillCooldown = 3.5;
      this.io.emit('skill_fx', { type: 'whirlwind', x: player.x, y: player.y, radius: 3.4, playerId: player.id });

      for (const mob of mobsMap.values()) {
        if (mob.state === 'dead') continue;
        if (Math.hypot(mob.x - player.x, mob.y - player.y) <= 3.4) {
          this.applyDamageToMob(player, mob, Math.round(player.dmg * 2.0), true);
        }
      }
    } else if (player.characterClass === 'mage') {
      player.skillCooldown = 4.5;
      const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
      const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;

      this.io.emit('skill_fx', { type: 'firestorm', x: tx, y: ty, radius: 3.8, playerId: player.id });

      for (const mob of mobsMap.values()) {
        if (mob.state === 'dead') continue;
        if (Math.hypot(mob.x - tx, mob.y - ty) <= 3.8) {
          this.applyDamageToMob(player, mob, Math.round(player.dmg * 2.4), true);
        }
      }
    } else if (player.characterClass === 'rogue') {
      player.skillCooldown = 3.0;
      const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
      const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;

      const angle = Math.atan2(ty - player.y, tx - player.x);
      const newX = player.x + Math.cos(angle) * 4.0;
      const newY = player.y + Math.sin(angle) * 4.0;

      if (!this.isColliding(newX, newY, player.zone)) {
        player.x = newX;
        player.y = newY;
      }

      this.io.emit('skill_fx', { type: 'shadow_strike', startX: player.x, startY: player.y, x: newX, y: newY, playerId: player.id });

      for (const mob of mobsMap.values()) {
        if (mob.state === 'dead') continue;
        if (Math.hypot(mob.x - player.x, mob.y - player.y) <= 2.4) {
          this.applyDamageToMob(player, mob, Math.round(player.dmg * 2.6), true);
        }
      }
    }
  }

  recalculatePlayerStats(player) {
    if (!player || !player.baseStats) return;

    let totalBonusDmg = 0;
    let totalBonusDef = 0;
    let totalBonusHp = 0;
    let totalBonusMp = 0;
    let totalBonusSpeed = 0;

    if (player.equipment) {
      for (const eq of Object.values(player.equipment)) {
        if (!eq) continue;
        if (eq.bonusDmg) totalBonusDmg += eq.bonusDmg;
        if (eq.bonusDef) totalBonusDef += eq.bonusDef;
        if (eq.bonusHp) totalBonusHp += eq.bonusHp;
        if (eq.bonusMp) totalBonusMp += eq.bonusMp;
        if (eq.bonusSpeed) totalBonusSpeed += eq.bonusSpeed;
      }
    }

    player.dmg = player.baseStats.dmg + totalBonusDmg;
    player.def = player.baseStats.def + totalBonusDef;
    player.maxHp = player.baseStats.maxHp + totalBonusHp;
    player.maxMp = player.baseStats.maxMp + totalBonusMp;
    player.speed = Number((player.baseStats.speed + totalBonusSpeed).toFixed(2));

    player.hp = Math.min(player.hp, player.maxHp);
    player.mp = Math.min(player.mp, player.maxMp);
  }

  handleEquipItem(socketId, itemIndex) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    if (itemIndex < 0 || itemIndex >= player.inventory.items.length) return;
    const item = player.inventory.items[itemIndex];
    if (!item || item.type !== 'equipment' || !item.slot) return;

    const slot = item.slot;
    const oldEquipped = player.equipment[slot];

    // Remove 1 from inventory
    if (item.count > 1) {
      item.count--;
    } else {
      player.inventory.items.splice(itemIndex, 1);
    }

    // If an item was previously equipped in this slot, return it to inventory
    if (oldEquipped) {
      const existing = player.inventory.items.find(i => i.id === oldEquipped.id);
      if (existing && existing.type !== 'equipment') {
        existing.count = (existing.count || 1) + 1;
      } else {
        player.inventory.items.push({ ...oldEquipped, count: 1 });
      }
    }

    // Equip the new item
    player.equipment[slot] = { ...item, count: 1 };
    this.recalculatePlayerStats(player);

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: `⚔️ Equipped ${item.name}!`,
        color: '#4ade80'
      });
    }

    this.broadcastSystemMessage(`🛡️ [${player.name}] equipped [${item.name}]!`);
  }

  handleUnequipItem(socketId, slot) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    if (!player.equipment || !player.equipment[slot]) return;
    const item = player.equipment[slot];

    // Check bag capacity (limit to 30 items)
    if (player.inventory.items.length >= 30) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: `⚠️ Inventory is full!`,
          color: '#ef4444'
        });
      }
      return;
    }

    player.equipment[slot] = null;
    player.inventory.items.push({ ...item, count: 1 });
    this.recalculatePlayerStats(player);

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: `Unequipped ${item.name}`,
        color: '#94a3b8'
      });
    }
  }

  // Merchant Shop Actions: Buy & Sell
  handleBuyItem(socketId, itemId) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    const itemDef = ITEMS[itemId];
    if (!itemDef || !itemDef.buyPrice) return;

    const socket = this.io.sockets.sockets.get(socketId);

    if (player.gold < itemDef.buyPrice) {
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.6,
          text: `⚠️ Need ${itemDef.buyPrice} Gold!`,
          color: '#ef4444'
        });
      }
      return;
    }

    player.gold -= itemDef.buyPrice;

    if (itemDef.id === 'health_potion') {
      player.inventory.healthPotions++;
    } else if (itemDef.id === 'mana_potion') {
      player.inventory.manaPotions++;
    } else if (itemDef.type === 'equipment') {
      // If slot is empty, auto-equip! Otherwise add to bag
      const slot = itemDef.slot;
      if (player.equipment && !player.equipment[slot]) {
        player.equipment[slot] = { ...itemDef, count: 1 };
        this.recalculatePlayerStats(player);
        this.broadcastSystemMessage(`🛡️ [${player.name}] purchased & equipped [${itemDef.name}]!`);
      } else {
        player.inventory.items.push({ ...itemDef, count: 1 });
      }
    } else {
      const existing = player.inventory.items.find(i => i.id === itemDef.id);
      if (existing) {
        existing.count = (existing.count || 1) + 1;
      } else {
        player.inventory.items.push({ ...itemDef, count: 1 });
      }
    }

    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.6,
        text: `Bought ${itemDef.name}!`,
        color: '#facc15'
      });
    }
  }

  handleSellItem(socketId, itemIndex) {
    const player = this.players.get(socketId);
    if (!player || player.isDead || player.zone !== 'town') return;

    if (itemIndex < 0 || itemIndex >= player.inventory.items.length) return;

    const item = player.inventory.items[itemIndex];
    const sellPrice = item.sellPrice || 10;

    player.gold += sellPrice;

    if (item.count > 1) {
      item.count--;
    } else {
      player.inventory.items.splice(itemIndex, 1);
    }

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.6,
        text: `+${sellPrice} Gold (Sold ${item.name})`,
        color: '#facc15'
      });
    }
  }

  // Reforge / Enhancement NPC Blacksmith Actions (Brom the Master Smith)
  handleReforgeItem(socketId, data) {
    const player = this.players.get(socketId);
    if (!player || player.isDead || player.zone !== 'town') return;

    let targetItem = null;
    let isEquipped = false;

    if (data.target === 'equipped') {
      if (player.equipment && player.equipment[data.slot]) {
        targetItem = player.equipment[data.slot];
        isEquipped = true;
      }
    } else if (data.target === 'inventory') {
      if (player.inventory && player.inventory.items && player.inventory.items[data.itemIndex]) {
        targetItem = player.inventory.items[data.itemIndex];
      }
    }

    if (!targetItem || targetItem.type !== 'equipment') return;

    const curLvl = targetItem.upgradeLevel || 0;
    if (curLvl >= 10) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: '⚠️ Item already at MAX +10!',
          color: '#facc15'
        });
      }
      return;
    }

    // Reforge Success Rates & Costs (MMORPG Reforge Table)
    const reforgeTable = [
      { rate: 1.0, cost: 50, canDowngrade: false },   // +0 -> +1 (100%)
      { rate: 1.0, cost: 80, canDowngrade: false },   // +1 -> +2 (100%)
      { rate: 1.0, cost: 120, canDowngrade: false },  // +2 -> +3 (100% Safe)
      { rate: 0.85, cost: 180, canDowngrade: false }, // +3 -> +4 (85%)
      { rate: 0.75, cost: 260, canDowngrade: false }, // +4 -> +5 (75%)
      { rate: 0.65, cost: 360, canDowngrade: false }, // +5 -> +6 (65%)
      { rate: 0.50, cost: 500, canDowngrade: false }, // +6 -> +7 (50%)
      { rate: 0.40, cost: 700, canDowngrade: true },  // +7 -> +8 (40%, safe or -1)
      { rate: 0.30, cost: 950, canDowngrade: true },  // +8 -> +9 (30%, safe or -1)
      { rate: 0.20, cost: 1300, canDowngrade: true }  // +9 -> +10 (20%, safe or -1)
    ];

    const forgeConfig = reforgeTable[curLvl] || { rate: 0.15, cost: 1800, canDowngrade: true };
    const socket = this.io.sockets.sockets.get(socketId);

    if (player.gold < forgeConfig.cost) {
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: `⚠️ Need ${forgeConfig.cost} Gold!`,
          color: '#ef4444'
        });
      }
      return;
    }

    // Deduct cost
    player.gold -= forgeConfig.cost;

    const roll = Math.random();
    const isSuccess = roll < forgeConfig.rate;

    if (isSuccess) {
      const newLvl = curLvl + 1;
      targetItem.upgradeLevel = newLvl;
      this.applyItemUpgradeStats(targetItem);

      if (isEquipped) {
        this.recalculatePlayerStats(player);
      }

      if (socket) {
        socket.emit('player_updated', player);
        socket.emit('reforge_result', {
          success: true,
          item: targetItem,
          oldLevel: curLvl,
          newLevel: newLvl,
          target: data.target,
          slot: data.slot,
          itemIndex: data.itemIndex
        });
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.8,
          text: `⭐ REFORGE +${newLvl} SUCCESS! ⭐`,
          color: '#facc15'
        });
      }

      this.io.emit('skill_fx', {
        type: 'whirlwind',
        x: player.x,
        y: player.y,
        radius: 1.5,
        playerId: player.id
      });

      if (newLvl >= 7) {
        this.broadcastSystemMessage(`🌟 [${player.name}] successfully forged [${targetItem.name}] at Brom's Anvil!`);
      }
    } else {
      let downgraded = false;
      let newLvl = curLvl;

      if (forgeConfig.canDowngrade && Math.random() < 0.35 && curLvl > 0) {
        downgraded = true;
        newLvl = curLvl - 1;
        targetItem.upgradeLevel = newLvl;
        this.applyItemUpgradeStats(targetItem);

        if (isEquipped) {
          this.recalculatePlayerStats(player);
        }
      }

      if (socket) {
        socket.emit('player_updated', player);
        socket.emit('reforge_result', {
          success: false,
          item: targetItem,
          oldLevel: curLvl,
          newLevel: newLvl,
          downgraded,
          target: data.target,
          slot: data.slot,
          itemIndex: data.itemIndex
        });
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: downgraded ? `🔻 Reforge Failed (-1 Level)` : `💨 Reforge Failed...`,
          color: '#ef4444'
        });
      }
    }
  }

  applyItemUpgradeStats(item) {
    if (!item) return;
    const lvl = item.upgradeLevel || 0;
    if (item.baseBonusDmg === undefined) item.baseBonusDmg = item.bonusDmg || 0;
    if (item.baseBonusDef === undefined) item.baseBonusDef = item.bonusDef || 0;
    if (item.baseBonusHp === undefined) item.baseBonusHp = item.bonusHp || 0;
    if (item.baseBonusMp === undefined) item.baseBonusMp = item.bonusMp || 0;
    if (item.baseBonusSpeed === undefined) item.baseBonusSpeed = item.bonusSpeed || 0;
    if (!item.baseName) item.baseName = item.name.replace(/\s\+\d+$/, '');

    let addDmg = 0, addDef = 0, addHp = 0, addMp = 0, addSpeed = 0;
    if (item.slot === 'weapon') {
      addDmg = lvl * 4;
    } else if (item.slot === 'armor') {
      addDef = lvl * 2;
      addHp = lvl * 25;
    } else if (item.slot === 'helmet') {
      addDef = lvl * 2;
      addHp = lvl * 15;
      addMp = lvl * 10;
    } else if (item.slot === 'boots') {
      addDef = lvl * 1;
      addSpeed = lvl * 0.08;
      addHp = lvl * 10;
    } else if (item.slot === 'ring') {
      addDmg = lvl * 3;
      addHp = lvl * 15;
      addMp = lvl * 15;
    }

    item.bonusDmg = item.baseBonusDmg + addDmg;
    item.bonusDef = item.baseBonusDef + addDef;
    item.bonusHp = item.baseBonusHp + addHp;
    item.bonusMp = item.baseBonusMp + addMp;
    item.bonusSpeed = Number((item.baseBonusSpeed + addSpeed).toFixed(2));
    item.name = lvl > 0 ? `${item.baseName} +${lvl}` : item.baseName;
  }

  handleUsePotion(socketId, potionType) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    if (potionType === 'health' && player.inventory.healthPotions > 0) {
      if (player.hp >= player.maxHp) return;
      player.inventory.healthPotions--;
      const healAmount = Math.round(player.maxHp * 0.45);
      player.hp = Math.min(player.maxHp, player.hp + healAmount);

      this.io.emit('floating_text', { x: player.x, y: player.y - 0.5, text: `+${healAmount} HP`, color: '#4ade80' });
      this.io.emit('heal_fx', { targetId: player.id, type: 'health' });
    } else if (potionType === 'mana' && player.inventory.manaPotions > 0) {
      if (player.mp >= player.maxMp) return;
      player.inventory.manaPotions--;
      const manaAmount = Math.round(player.maxMp * 0.5);
      player.mp = Math.min(player.maxMp, player.mp + manaAmount);

      this.io.emit('floating_text', { x: player.x, y: player.y - 0.5, text: `+${manaAmount} MP`, color: '#38bdf8' });
      this.io.emit('heal_fx', { targetId: player.id, type: 'mana' });
    }
  }

  applyStatusEffect(player, type, duration, value) {
    if (!player || player.isDead) return;
    if (!player.statusEffects) player.statusEffects = [];

    const existing = player.statusEffects.find(e => e.type === type);
    if (existing) {
      existing.duration = Math.max(existing.duration, duration);
      existing.value = Math.max(existing.value, value);
    } else {
      player.statusEffects.push({
        type,
        duration,
        value,
        tickTimer: 0.8
      });

      const icon = type === 'poison' ? '☠️' : type === 'burn' ? '🔥' : '❄️';
      const color = type === 'poison' ? '#22c55e' : type === 'burn' ? '#f97316' : '#38bdf8';
      this.io.emit('floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: `${icon} ${type.toUpperCase()}!`,
        color,
        size: 15
      });
    }
  }

  handlePickupItem(socketId, itemId) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    const itemsMap = player.zone === 'town' ? this.townGroundItems : this.dungeonGroundItems;
    const item = itemsMap.get(itemId);
    if (!item) return;

    const dist = Math.hypot(item.x - player.x, item.y - player.y);
    if (dist <= 2.2) {
      if (item.type === 'gold') {
        player.gold += item.amount;
        this.io.emit('floating_text', { x: player.x, y: player.y - 0.6, text: `+${item.amount} Gold`, color: '#facc15' });
      } else if (item.itemId === 'health_potion') {
        player.inventory.healthPotions += (item.amount || 1);
        this.io.emit('floating_text', { x: player.x, y: player.y - 0.6, text: `+${item.amount || 1} Health Potion`, color: '#f87171' });
      } else if (item.itemId === 'mana_potion') {
        player.inventory.manaPotions += (item.amount || 1);
        this.io.emit('floating_text', { x: player.x, y: player.y - 0.6, text: `+${item.amount || 1} Mana Potion`, color: '#60a5fa' });
      } else {
        // Collectible Relic / Equipment
        const def = ITEMS[item.itemId];
        if (def) {
          const existing = player.inventory.items.find(i => i.id === def.id);
          if (existing && def.type !== 'equipment') {
            existing.count = (existing.count || 1) + 1;
          } else {
            player.inventory.items.push({ ...def, count: 1 });
          }
          this.io.emit('floating_text', {
            x: player.x,
            y: player.y - 0.6,
            text: `+${def.name}`,
            color: def.rarity === 'legendary' ? '#f59e0b' : def.rarity === 'epic' ? '#a855f7' : '#38bdf8'
          });
        }
      }

      itemsMap.delete(itemId);
      this.io.emit('item_picked', { itemId, pickerId: player.id });

      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) socket.emit('player_updated', player);
    }
  }

  handleChatMessage(socketId, message) {
    const player = this.players.get(socketId);
    if (!player) return;

    const text = (message || '').trim().substring(0, 100);
    if (!text) return;

    player.speechBubble = text;
    player.speechTimer = 5.0;

    this.io.emit('chat_broadcast', {
      senderId: player.id,
      senderName: player.name,
      senderClass: player.characterClass,
      text,
      timestamp: Date.now()
    });
  }

  spawnProjectile(caster, targetX, targetY, targetId, targetType, damage) {
    const id = `proj_${this.nextEntityId++}`;
    const angle = Math.atan2(targetY - caster.y, targetX - caster.x);
    const speed = 9.0;

    this.projectiles.set(id, {
      id,
      zone: caster.zone,
      casterId: caster.id,
      x: caster.x,
      y: caster.y,
      targetX,
      targetY,
      targetId,
      targetType,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      life: 2.0,
      color: '#f97316'
    });

    this.io.emit('projectile_spawned', {
      id,
      zone: caster.zone,
      x: caster.x,
      y: caster.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: '#f97316'
    });
  }

  applyDamageToMob(player, mob, baseDamage, isCritical = false) {
    const variation = (Math.random() * 0.4) - 0.2;
    let rawDamage = Math.round(baseDamage * (1 + variation));
    if (isCritical) rawDamage = Math.round(rawDamage * 1.5);

    // Apply mob defense reduction
    const mobDef = (mob.def || 0) + (mob.hasCommanderBuff ? 8 : 0);
    const defReduction = mobDef * 0.45;
    let damage = Math.max(2, Math.round(rawDamage - defReduction));

    // Fortified affix absorbs 30% damage
    if (mob.buffs && mob.buffs.includes('fortified')) {
      damage = Math.max(1, Math.round(damage * 0.7));
    }

    mob.hp -= damage;
    mob.state = 'chase';
    mob.targetPlayerId = player.id;

    this.io.emit('floating_text', {
      x: mob.x,
      y: mob.y - 0.7,
      text: `${damage}${isCritical ? ' CRIT!' : ''}`,
      color: isCritical ? '#f59e0b' : '#ef4444',
      size: isCritical ? 22 : 16
    });

    if (mob.hp <= 0) {
      this.handleMobDeath(mob, player);
    }
  }

  handleMobDeath(mob, killerPlayer) {
    mob.state = 'dead';
    mob.hp = 0;
    mob.respawnTimer = mob.isBoss ? 25.0 : 10.0;

    const zone = killerPlayer ? killerPlayer.zone : 'town';

    if (killerPlayer) {
      killerPlayer.inventory.kills++;
      this.awardExp(killerPlayer, mob.exp);

      if (mob.isBoss) {
        this.broadcastSystemMessage(`👑 Legendary Conquest! [${killerPlayer.name}] vanquished [${mob.name}]!`);
        // If boss of dungeon defeated, allow next depth
        if (killerPlayer.zone === 'dungeon') {
          this.broadcastSystemMessage(`🎉 The Dungeon Boss fell! A portal to deeper dungeon depths has unlocked.`);
        }
      }
    }

    // Drop Gold
    const goldDrop = Math.round(mob.gold * (0.8 + Math.random() * 0.4));
    this.spawnGroundItem(zone, 'gold', 'Gold Coins', mob.x + (Math.random() - 0.5) * 0.5, mob.y + (Math.random() - 0.5) * 0.5, goldDrop);

    // Drop Potions or Relics
    if (Math.random() < 0.6) {
      this.spawnGroundItem(zone, 'item', 'health_potion', mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1);
    }

    // Dungeon mobs have high chance of dropping valuable sellable relics
    if (zone === 'dungeon' && Math.random() < 0.45) {
      const relics = ['ancient_ruby', 'cursed_chalice', 'shadow_essence'];
      const r = relics[Math.floor(Math.random() * relics.length)];
      this.spawnGroundItem(zone, 'item', r, mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1);
    }

    this.io.emit('mob_died', { mobId: mob.id, killerId: killerPlayer ? killerPlayer.id : null });
  }

  awardExp(player, amount) {
    player.exp += amount;
    this.io.emit('floating_text', { x: player.x, y: player.y - 1.0, text: `+${amount} EXP`, color: '#a855f7' });

    while (player.exp >= player.expNext) {
      player.exp -= player.expNext;
      player.level++;
      player.expNext = Math.round(player.expNext * 1.5);

      if (!player.baseStats) {
        player.baseStats = {
          maxHp: player.maxHp,
          maxMp: player.maxMp,
          dmg: player.dmg,
          def: player.def,
          speed: player.speed,
          attackRange: player.attackRange
        };
      }
      player.baseStats.maxHp += 20;
      player.baseStats.maxMp += 15;
      player.baseStats.dmg += 4;
      player.baseStats.def += 2;
      this.recalculatePlayerStats(player);

      player.hp = player.maxHp;
      player.mp = player.maxMp;

      this.io.emit('level_up', { playerId: player.id, level: player.level, x: player.x, y: player.y });
      this.broadcastSystemMessage(`✨ [${player.name}] reached Level ${player.level}!`);
    }
  }

  spawnGroundItem(zone, type, itemIdOrName, x, y, amount) {
    const id = `item_${this.nextEntityId++}`;
    const itemsMap = zone === 'town' ? this.townGroundItems : this.dungeonGroundItems;

    const item = {
      id,
      zone,
      type,
      itemId: type === 'item' ? itemIdOrName : null,
      name: type === 'gold' ? `${amount} Gold` : (ITEMS[itemIdOrName] ? ITEMS[itemIdOrName].name : itemIdOrName),
      x,
      y,
      amount,
      createdAt: Date.now()
    };

    itemsMap.set(id, item);
    this.io.emit('item_dropped', item);
  }

  calculateFacing(fromX, fromY, toX, toY) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return 'S';

    const screenDx = dx - dy; // Horizontal screen direction (+ right, - left)
    const screenDy = (dx + dy) * 0.5; // Vertical screen direction (+ down, - up)

    const angle = Math.atan2(screenDy, screenDx);
    const deg = (angle * 180) / Math.PI; // -180 to 180

    // 8-directional screen orientation
    if (deg >= -22.5 && deg < 22.5) return 'E';
    if (deg >= 22.5 && deg < 67.5) return 'SE';
    if (deg >= 67.5 && deg < 112.5) return 'S';
    if (deg >= 112.5 && deg < 157.5) return 'SW';
    if (deg >= 157.5 || deg < -157.5) return 'W';
    if (deg >= -157.5 && deg < -112.5) return 'NW';
    if (deg >= -112.5 && deg < -67.5) return 'N';
    if (deg >= -67.5 && deg < -22.5) return 'NE';

    return 'S';
  }

  broadcastSystemMessage(text) {
    this.io.emit('chat_broadcast', {
      senderId: 'system',
      senderName: 'SYSTEM',
      senderClass: 'system',
      text,
      timestamp: Date.now()
    });
  }

  sendDirectMessage(socketId, text) {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('chat_broadcast', {
        senderId: 'system',
        senderName: 'SYSTEM',
        senderClass: 'system',
        text,
        timestamp: Date.now()
      });
    }
  }

  // Authoritative Game Loop
  startGameLoop() {
    const dt = 1 / this.TICK_RATE;
    this.tickInterval = setInterval(() => {
      this.update(dt);
      this.broadcastSnapshot();
    }, 1000 / this.TICK_RATE);
  }

  update(dt) {
    // 1. Update Players
    for (const player of this.players.values()) {
      const socket = this.io.sockets.sockets.get(player.id);
      if (player.isDead) {
        player.respawnTimer -= dt;
        if (player.respawnTimer <= 0) {
          player.isDead = false;
          player.hp = player.maxHp;
          player.mp = player.maxMp;
          player.zone = 'town';
          player.x = 20 + (Math.random() - 0.5) * 2;
          player.y = 23 + (Math.random() - 0.5) * 1.5;
          this.io.emit('player_respawned', { playerId: player.id, x: player.x, y: player.y });
          this.broadcastSystemMessage(`❤️ [${player.name}] has revived in town.`);
          if (socket) {
            socket.emit('zone_change', {
              zone: 'town',
              map: this.townMap,
              player,
              players: Array.from(this.players.values()).filter(p => p.zone === 'town'),
              mobs: Array.from(this.townMobs.values()),
              groundItems: Array.from(this.townGroundItems.values())
            });
          }
        }
        continue;
      }

      if (player.attackCooldown > 0) player.attackCooldown = Math.max(0, player.attackCooldown - dt);
      if (player.skillCooldown > 0) player.skillCooldown = Math.max(0, player.skillCooldown - dt);
      if (player.portalCooldown > 0) player.portalCooldown = Math.max(0, player.portalCooldown - dt);
      if (player.speechTimer > 0) {
        player.speechTimer -= dt;
        if (player.speechTimer <= 0) player.speechBubble = null;
      }

      player.hp = Math.min(player.maxHp, player.hp + (player.maxHp * 0.015 * dt));
      player.mp = Math.min(player.maxMp, player.mp + (player.maxMp * 0.08 * dt) + (4 * dt));

      // Status Effects Processing (Poison DoT, Burn DoT, Chill Slow)
      if (player.statusEffects && player.statusEffects.length > 0) {
        let isChilled = false;
        for (let i = player.statusEffects.length - 1; i >= 0; i--) {
          const fx = player.statusEffects[i];
          fx.duration -= dt;
          fx.tickTimer -= dt;

          if (fx.type === 'poison' && fx.tickTimer <= 0) {
            fx.tickTimer = 0.8;
            const dotDmg = Math.max(1, Math.round(fx.value));
            player.hp = Math.max(0, player.hp - dotDmg);
            this.io.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `☠️ -${dotDmg}`, color: '#22c55e', size: 14 });
          } else if (fx.type === 'burn' && fx.tickTimer <= 0) {
            fx.tickTimer = 0.6;
            const dotDmg = Math.max(1, Math.round(fx.value));
            player.hp = Math.max(0, player.hp - dotDmg);
            this.io.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `🔥 -${dotDmg}`, color: '#f97316', size: 14 });
          } else if (fx.type === 'chill') {
            isChilled = true;
          }

          if (player.hp <= 0 && !player.isDead) {
            player.hp = 0;
            player.isDead = true;
            player.respawnTimer = 5.0;
            this.io.emit('player_died', { playerId: player.id, killerName: fx.type.toUpperCase() });
            this.broadcastSystemMessage(`☠️ [${player.name}] succumbed to ${fx.type.toUpperCase()}!`);
          }

          if (fx.duration <= 0) {
            player.statusEffects.splice(i, 1);
          }
        }

        player.speedFactor = isChilled ? 0.6 : 1.0;
      } else {
        player.speedFactor = 1.0;
      }

      // Movement
      let moveX = 0;
      let moveY = 0;

      if (player.moveDir.dx !== 0 || player.moveDir.dy !== 0) {
        const screenLen = Math.hypot(player.moveDir.dx, player.moveDir.dy);
        const normScreenX = player.moveDir.dx / screenLen;
        const normScreenY = player.moveDir.dy / screenLen;

        const worldDx = (normScreenX + normScreenY * 2) * 0.5;
        const worldDy = (normScreenY * 2 - normScreenX) * 0.5;

        const speedFactor = player.speed * (player.speedFactor || 1.0) * 0.65;
        moveX = worldDx * speedFactor * dt;
        moveY = worldDy * speedFactor * dt;

        player.facing = this.calculateFacing(0, 0, moveX, moveY);
        player.isMoving = true;
      } else if (player.targetX !== null && player.targetY !== null) {
        const screenCurX = (player.x - player.y);
        const screenCurY = (player.x + player.y) * 0.5;
        const screenTarX = (player.targetX - player.targetY);
        const screenTarY = (player.targetX + player.targetY) * 0.5;

        const screenDist = Math.hypot(screenTarX - screenCurX, screenTarY - screenCurY);

        if (screenDist > 0.15) {
          const normSx = (screenTarX - screenCurX) / screenDist;
          const normSy = (screenTarY - screenCurY) / screenDist;

          const worldDx = (normSx + normSy * 2) * 0.5;
          const worldDy = (normSy * 2 - normSx) * 0.5;

          const speedFactor = player.speed * (player.speedFactor || 1.0) * 0.65;
          const moveStep = Math.min(screenDist, speedFactor * dt);
          moveX = worldDx * moveStep;
          moveY = worldDy * moveStep;

          player.facing = this.calculateFacing(player.x, player.y, player.targetX, player.targetY);
          player.isMoving = true;
        } else {
          player.targetX = null;
          player.targetY = null;
          player.isMoving = false;
        }
      } else {
        player.isMoving = false;
      }

      if (moveX !== 0 || moveY !== 0) {
        const nextX = player.x + moveX;
        const nextY = player.y + moveY;

        if (!this.isColliding(nextX, nextY, player.zone)) {
          player.x = nextX;
          player.y = nextY;
        } else if (!this.isColliding(nextX, player.y, player.zone)) {
          player.x = nextX;
        } else if (!this.isColliding(player.x, nextY, player.zone)) {
          player.y = nextY;
        }
      }

      // Auto-Loot System: Automatically collect ground loot within 1.8 tiles
      const groundMap = player.zone === 'town' ? this.townGroundItems : this.dungeonGroundItems;
      for (const item of groundMap.values()) {
        const d = Math.hypot(item.x - player.x, item.y - player.y);
        if (d <= 1.8) {
          this.handlePickupItem(player.id, item.id);
        }
      }

      // Check Portal Teleports
      if (socket) {
        this.checkPortalAndInteractions(player, socket);
      }
    }

    // 2. Commander Aura Calculations for Dungeon Mobs
    const commanderMobs = [];
    for (const mob of this.dungeonMobs.values()) {
      if (mob.state !== 'dead' && mob.isCommander && mob.auraRadius > 0) {
        commanderMobs.push(mob);
      }
      mob.hasCommanderBuff = false;
    }

    if (commanderMobs.length > 0) {
      for (const mob of this.dungeonMobs.values()) {
        if (mob.state === 'dead' || mob.isCommander) continue;
        for (const cmdr of commanderMobs) {
          if (Math.hypot(mob.x - cmdr.x, mob.y - cmdr.y) <= cmdr.auraRadius) {
            mob.hasCommanderBuff = true;
            break;
          }
        }
      }
    }

    // Update Both Town and Dungeon Mobs
    this.updateMobsList(this.townMobs, 'town', dt);
    this.updateMobsList(this.dungeonMobs, 'dungeon', dt);

    // 3. Update Projectiles
    for (const [projId, proj] of this.projectiles.entries()) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;

      const mobsMap = proj.zone === 'town' ? this.townMobs : this.dungeonMobs;
      let hit = false;
      for (const mob of mobsMap.values()) {
        if (mob.state === 'dead') continue;
        if (Math.hypot(mob.x - proj.x, mob.y - proj.y) < 0.8) {
          const caster = this.players.get(proj.casterId);
          if (caster) {
            this.applyDamageToMob(caster, mob, proj.damage, false);
          }
          hit = true;
          break;
        }
      }

      if (hit || proj.life <= 0 || this.isColliding(proj.x, proj.y, proj.zone, 0.2)) {
        this.io.emit('projectile_exploded', { id: proj.id, x: proj.x, y: proj.y });
        this.projectiles.delete(projId);
      }
    }
  }

  updateMobsList(mobsMap, zone, dt) {
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') {
        mob.respawnTimer -= dt;
        if (mob.respawnTimer <= 0) {
          mob.state = 'idle';
          mob.hp = mob.maxHp;
          mob.x = mob.spawnX;
          mob.y = mob.spawnY;
          mob.targetPlayerId = null;
        }
        continue;
      }

      if (mob.attackCooldown > 0) mob.attackCooldown = Math.max(0, mob.attackCooldown - dt);

      if (mob.state === 'idle') {
        let closestPlayer = null;
        let closestDist = 5.0;

        for (const p of this.players.values()) {
          if (p.isDead || p.zone !== zone) continue;
          const d = Math.hypot(p.x - mob.x, p.y - mob.y);
          if (d < closestDist) {
            closestDist = d;
            closestPlayer = p;
          }
        }

        if (closestPlayer) {
          mob.state = 'chase';
          mob.targetPlayerId = closestPlayer.id;
        } else {
          if (Date.now() > mob.nextWanderTime) {
            mob.nextWanderTime = Date.now() + 2000 + Math.random() * 4000;
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 2.5;
            mob.wanderTarget = {
              x: mob.spawnX + Math.cos(angle) * dist,
              y: mob.spawnY + Math.sin(angle) * dist
            };
          }

          if (mob.wanderTarget) {
            const wd = Math.hypot(mob.wanderTarget.x - mob.x, mob.wanderTarget.y - mob.y);
            if (wd > 0.2) {
              const step = Math.min(wd, (mob.speed * 0.4) * dt);
              const wx = ((mob.wanderTarget.x - mob.x) / wd) * step;
              const wy = ((mob.wanderTarget.y - mob.y) / wd) * step;
              if (!this.isColliding(mob.x + wx, mob.y + wy, zone)) {
                mob.x += wx;
                mob.y += wy;
                mob.facing = this.calculateFacing(0, 0, wx, wy);
              } else {
                mob.wanderTarget = null;
              }
            } else {
              mob.wanderTarget = null;
            }
          }
        }
      } else if (mob.state === 'chase') {
        const targetPlayer = this.players.get(mob.targetPlayerId);
        if (!targetPlayer || targetPlayer.isDead || targetPlayer.zone !== zone) {
          mob.state = 'return';
          mob.targetPlayerId = null;
          continue;
        }

        const distToPlayer = Math.hypot(targetPlayer.x - mob.x, targetPlayer.y - mob.y);
        const distToSpawn = Math.hypot(mob.spawnX - mob.x, mob.spawnY - mob.y);

        if (distToPlayer > 10.0 || distToSpawn > 14.0) {
          mob.state = 'return';
          mob.targetPlayerId = null;
          continue;
        }

        if (distToPlayer <= 1.2) {
          if (mob.attackCooldown <= 0) {
            mob.attackCooldown = 1.2;
            const effectiveDmg = mob.hasCommanderBuff ? Math.round(mob.dmg * 1.35) : mob.dmg;
            const damageDealt = Math.max(1, Math.round(effectiveDmg - (targetPlayer.def * 0.5)));
            targetPlayer.hp -= damageDealt;

            // Apply Mob Buffs/Affixes to targetPlayer
            if (mob.buffs && mob.buffs.length > 0) {
              if (mob.buffs.includes('venomous')) {
                this.applyStatusEffect(targetPlayer, 'poison', 4.5, 9);
              }
              if (mob.buffs.includes('frostbite')) {
                this.applyStatusEffect(targetPlayer, 'chill', 2.5, 0.45);
              }
              if (mob.buffs.includes('ignited')) {
                this.applyStatusEffect(targetPlayer, 'burn', 3.0, 14);
              }
            }

            this.io.emit('floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: `-${damageDealt}`, color: '#ef4444' });
            this.io.emit('entity_attack_fx', { attackerId: mob.id, attackerType: 'mob', targetId: targetPlayer.id, x: mob.x, y: mob.y });

            if (targetPlayer.hp <= 0) {
              targetPlayer.hp = 0;
              targetPlayer.isDead = true;
              targetPlayer.respawnTimer = 5.0;
              this.io.emit('player_died', { playerId: targetPlayer.id, killerName: mob.name });
              this.broadcastSystemMessage(`☠️ [${targetPlayer.name}] was slain by [${mob.name}]!`);
              mob.state = 'return';
            }
          }
        } else {
          const effectiveSpeed = mob.hasCommanderBuff ? mob.speed * 1.25 : mob.speed;
          const step = Math.min(distToPlayer, effectiveSpeed * dt);
          const mx = ((targetPlayer.x - mob.x) / distToPlayer) * step;
          const my = ((targetPlayer.y - mob.y) / distToPlayer) * step;

          if (!this.isColliding(mob.x + mx, mob.y + my, zone)) {
            mob.x += mx;
            mob.y += my;
          }
          mob.facing = this.calculateFacing(mob.x, mob.y, targetPlayer.x, targetPlayer.y);
        }
      } else if (mob.state === 'return') {
        const distToSpawn = Math.hypot(mob.spawnX - mob.x, mob.spawnY - mob.y);
        if (distToSpawn > 0.2) {
          const step = Math.min(distToSpawn, (mob.speed * 1.2) * dt);
          mob.x += ((mob.spawnX - mob.x) / distToSpawn) * step;
          mob.y += ((mob.spawnY - mob.y) / distToSpawn) * step;
          mob.hp = Math.min(mob.maxHp, mob.hp + (mob.maxHp * 0.2 * dt));
        } else {
          mob.state = 'idle';
          mob.hp = mob.maxHp;
        }
      }
    }
  }

  broadcastSnapshot() {
    const playersArr = Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      characterClass: p.characterClass,
      zone: p.zone,
      x: p.x,
      y: p.y,
      facing: p.facing,
      isMoving: p.isMoving,
      hp: Math.round(p.hp),
      maxHp: p.maxHp,
      mp: Math.round(p.mp),
      maxMp: p.maxMp,
      dmg: p.dmg,
      def: p.def,
      speed: p.speed,
      level: p.level,
      exp: p.exp,
      expNext: p.expNext,
      gold: p.gold,
      speechBubble: p.speechBubble,
      isDead: p.isDead,
      statusEffects: (p.statusEffects || []).map(e => ({ type: e.type, duration: Math.ceil(e.duration) })),
      inventory: p.inventory,
      equipment: p.equipment,
      baseStats: p.baseStats
    }));

    const townMobsArr = Array.from(this.townMobs.values()).map(m => ({
      id: m.id, type: m.type, name: m.name, level: m.level, x: m.x, y: m.y,
      facing: m.facing, hp: Math.round(m.hp), maxHp: m.maxHp, state: m.state, isBoss: m.isBoss,
      buffs: m.buffs || [], isCommander: !!m.isCommander, auraRadius: m.auraRadius || 0, hasCommanderBuff: !!m.hasCommanderBuff
    }));

    const dungeonMobsArr = Array.from(this.dungeonMobs.values()).map(m => ({
      id: m.id, type: m.type, name: m.name, level: m.level, x: m.x, y: m.y,
      facing: m.facing, hp: Math.round(m.hp), maxHp: m.maxHp, state: m.state, isBoss: m.isBoss,
      buffs: m.buffs || [], isCommander: !!m.isCommander, auraRadius: m.auraRadius || 0, hasCommanderBuff: !!m.hasCommanderBuff
    }));

    this.io.emit('game_tick', {
      timestamp: Date.now(),
      players: playersArr,
      townMobs: townMobsArr,
      dungeonMobs: dungeonMobsArr,
      dungeonChests: this.dungeon ? this.dungeon.chests : []
    });
  }
}

module.exports = GameServer;
