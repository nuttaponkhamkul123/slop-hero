import { calculateElementalMultiplier, ELEMENTS, ELEMENT_INFO } from './elements';
import { MAP_WIDTH, MAP_HEIGHT, TILES, generateMap, generateFrostfellMap } from './mapData';
import { generateProceduralDungeon, rollDungeonLoot, DIFFICULTIES, AFFIX_POOL, DUNGEON_FLOORS, DUNGEON_TILES, BLOCKING_FEATURES, DUNGEON_HAZARDS } from './dungeonGenerator';
import {
  ITEMS,
  SKYBLOCK_REFORGES,
  REFORGE_COSTS,
  getReforgeCategory,
  rollSkyblockReforge,
  applySkyblockReforge,
  generateRandomizedGear,
  pickGear,
  pickGearForLevel,
  ENHANCE_MAX,
  ENHANCE_SAFE_LEVEL,
  ENHANCE_BASE_COST,
  ENHANCE_COST_GROWTH,
  ENHANCE_CHANCE,
  enhanceCost,
  enhanceChance,
  requiredClass,
  WEAPON_ABILITIES,
  weaponAbility,
  weaponPower,
  RUNE_DROP_CHANCE,
  SOCKET_EXPANDER_DROP_CHANCE,
  RUNES_DEF,
  ensureWeaponSockets,
  ensureSockets,
  socketKind,
  runeFits,
  SOCKET_MAX,
  ARMOR_SOCKET_SLOTS,
  ARMOR_SETS,
  equippedSetCounts
} from './items';
import accountManager from './accountManager';
import { FIELD_ZONES, FIELD_ZONE_BY_ID, generateFieldMap, buildFieldMobs, fieldObstacleGrid, nearObstacles } from './fieldZones';
import { expToNext, baseExpCurve, mobExp, levelGapMult, lootGapMult, masteryMult, MOB_DEF_K } from './progression';
import * as SP from './spCards';
import * as adminCommands from './adminCommands';
import * as RIFT from './eternalRift';
import * as CRAFT from './crafting';
import * as DMODS from './dungeonMods';
import * as ATTR from './itemAttributes';
import {
  SP_TRANSFORM_COOLDOWN,
  SKILL_DAMAGE_SCALE,
  TRAIL_IDS,
  PROP_RESPAWN_S,
  PROP_HITS,
  BLOOD_AURA_START_HP,
  BLOOD_AURA_MIN_HP,
  MANA_COST_SCALE,
  MANA_COST_PER_LEVEL,
  MANA_REGEN_PCT,
  MANA_REGEN_FLAT,
  DEFAULT_BAG_SLOTS,
  MAX_BAG_SLOTS,
  DUNGEON_PORTAL_SHARE,
  DUNGEON_MINIBOSS_WEIGHT,
  dungeonProgressWeight,
  HP_REGEN_PCT,
  SWEEP_EXTRA_REACH,
  ATTACK_GRACE_S,
  SWEEP_ARC_DEG,
  SCORCH_MAX,
  SCORCH_SECONDS,
  FROST_TO_FREEZE,
  FROST_SECONDS,
  FREEZE_SECONDS,
  BOSS_FREEZE_SECONDS,
  CONDUCT_MAX,
  CONDUCT_SECONDS,
  CONDUCT_FORK_RANGE,
  CONDUCT_FORK_MAX,
  CONDUCT_FORK_SHARE,
  VOID_SOUL_MAX,
  VOID_SOUL_SECONDS,
  VOID_SOUL_BONUS,
  ULT_COOLDOWN,
  ULT_CHARGE_MAX,
  ULT_GAIN_HIT,
  ULT_GAIN_KILL,
  ULT_GAIN_HURT,
  ULT_MAX_GAIN_PER_SEC,
  ULT_LOCK_SECONDS,
  ECHO_DAMAGE,
  HEAVY_CHECK_TICKS,
  FRACTURE_MAX,
  FRACTURE_SECONDS,
  FRACTURE_STUN,
  HEAT_MAX,
  HEAT_HOLD_MS,
  HEAT_DECAY,
  OVERHEAT_SECONDS,
  OVERHEAT_BONUS,
  OVERHEAT_BURN,
  RUNE_MAX,
  RUNE_POLL,
  RUNE_ARM_MS,
  RUNE_TRIGGER_R,
  COMBO_MAX,
  COMBO_SECONDS,
  COMBO_BONUS,
  DG_ROD_MAX,
  DG_ROD_SECONDS,
  DG_ROD_EVERY,
  DG_ROD_R,
  DG_ROD_MULT,
  DG_FENCE_RANGE,
  DG_FENCE_W,
  DG_FENCE_MULT,
  DG_OVERLOAD_R,
  DG_ARC_RANGE,
  GRAVE_CORPSE_MS,
  GRAVE_CORPSE_MAX,
  MINION_MAX,
  MINION_SPEED,
  MINION_REACH,
  MINION_ATTACK_EVERY,
  MINION_AGGRO,
  MINION_LEASH,
  SHADOW_SKIPS_SHAPES,
  REWIND_SAMPLE_S,
  REWIND_KEEP_S,
  MOB_VIEW_ISO_X,
  MOB_VIEW_ISO_Y,
  MOB_FULL_REFRESH_S,
  DUNGEON_SPAWN_MS,
  FLOATING_TEXT_BATCH_MAX,
  mobInView,
  FAILED_RUN_LOOT_KEEP,
  PORTAL_USE_RANGE,
  RIFT_TOWN_ARRIVAL,
  PARTY_EXP_RANGE,
  PARTY_EXP_BONUS,
  PASSIVE_REFUND_COST,
  MAX_PLAYER_ELEMENT_RESIST,
  ENERGY_SHIELD,
  ARMOR_RUNE_DROP,
  PARTY_SUMMON_TTL_MS,
  ITEM_DESPAWN_MS,
  ITEM_SWEEP_INTERVAL_MS,
  FACINGS,
  AIM_FACE_LOCK_SEC,
  MAGE_SPLASH_SHARE,
  MAGE_SPLASH_RADIUS,
  RUN_PAR_BASE_SEC,
  RUN_PAR_PER_ROOM_SEC,
  RUN_RANK_MULT,
  MOB_GEAR_DROP_CHANCE,
  BOSS_GEAR_DROP_CHANCE,
  BOSS_BONUS_GEAR_DROP_CHANCE,
  BOSS_REVIVAL_STONE_CHANCE
} from './config/constants';
import { ALL_CLASS_SKILLS, CLASS_SKILLS_CATALOG, SKILL_RUNES, DEFAULT_EQUIPPED_SKILLS, CLIENT_SKILL_SLOTS, DEFAULT_SKILL_FOR_SLOT, CLASS_SKILLS } from './data/skills';
import { POTIONS, POTION_COOLDOWN_MS } from './data/potions';
import { HERO_CLASSES, isHeroClass, starterEquipment } from './data/heroClasses';
import { createStarterCharacter, createLivePlayer } from './entities/player';
import { ItemFactory } from './entities/item';
import { MobFactory } from './entities/mob';
import { createProjectile, createGroundItem, createDungeonInstance, createRiftInstance, createParty } from './entities/world';
import { StatusEffectSystem } from './systems/StatusEffectSystem';
import { PotionSystem } from './systems/PotionSystem';
import { MinionSystem } from './systems/MinionSystem';
import { PartySystem } from './systems/PartySystem';
import { RaidSystem } from './systems/RaidSystem';
import { SpCardSystem } from './systems/SpCardSystem';
import { InventorySystem } from './systems/InventorySystem';
import { ItemUpgradeSystem } from './systems/ItemUpgradeSystem';
import { LevelSystem } from './systems/LevelSystem';
import { LootSystem } from './systems/LootSystem';
import { DungeonRunSystem } from './systems/DungeonRunSystem';
import { ZoneSystem } from './systems/ZoneSystem';
import { PassiveSystem } from './systems/PassiveSystem';
import { StatsSystem } from './systems/StatsSystem';
let spObjSeq = 0; // ids for placed card objects (glyphs, banners, lances) so the client can clear them

const PASSIVES = require('./talents');
const { createBossMechanics } = require('./bossMechanics');
const RAID = require('./raidBosses');
const TALENT_PROCS = PASSIVES.TALENT_PROCS;

class GameServer {
  [key: string]: any;
  io: any;
  townMap: any;
  fields: Map<string, any>;
  frostfellMap: any;
  dungeonFloor: number;
  dungeonDifficulty: string;
  dungeon: any;
  players: Map<string, any>;
  townMobs: Map<string, any>;
  frostfellMobs: Map<string, any>;
  dungeonMobs: Map<string, any>;
  townGroundItems: Map<string, any>;
  frostfellGroundItems: Map<string, any>;
  dungeonGroundItems: Map<string, any>;
  parties: Map<string, any>;
  nextPartyId: number;
  dungeonInstances: Map<string, any>;
  ctxInstanceId: any;
  projectiles: Map<string, any>;
  smokeClouds: any[];
  nextEntityId: number;
  TICK_RATE: number;
  tickInterval: any;
  _ftQueue: Map<string, any>;
  constructor(io) {
    this.io = io;
    this.initSystems();
    this.townMap = generateMap();

    // Level-chained open-world field zones (Greenmeadow Lv 1 ... Celestial Reach Lv 100).
    // The town itself is monster-free; townMobs stays empty.
    this.fields = new Map<any, any>();
    FIELD_ZONES.forEach(zone => {
      this.fields.set(zone.id, { zone, map: generateFieldMap(zone), mobs: new Map<any, any>(), groundItems: new Map<any, any>() });
    });
    const frostfell = this.fields.get('frostfell');
    this.frostfellMap = frostfell.map;
    this.dungeonFloor = 1;
    this.dungeonDifficulty = 'normal';
    this.dungeon = generateProceduralDungeon(this.dungeonFloor, this.dungeonDifficulty);

    this.players = new Map<any, any>();
    this.townMobs = new Map<any, any>();
    this.frostfellMobs = frostfell.mobs;
    this.dungeonMobs = new Map<any, any>();

    this.townGroundItems = new Map<any, any>();
    this.frostfellGroundItems = frostfell.groundItems;
    this.dungeonGroundItems = new Map<any, any>();
    this.parties = new Map<any, any>(); // partyId -> { id, leaderId, memberIds: Set }
    this.nextPartyId = 1;
    this.dungeonInstances = new Map<any, any>(); // instanceId -> { id, partyId, floor, difficulty, dungeon, mobs, groundItems, chests, cleared }
    // Dungeon instance the current handler / tick step is acting in. Lookups and
    // emits that only know the zone name 'dungeon' resolve against it.
    this.ctxInstanceId = null;

    this.projectiles = new Map<any, any>();
    this.smokeClouds = []; // Nightblade Smoke Bomb: { zone, instanceId, x, y, r, miss, until }
    this.nextEntityId = 1000;

    this.TICK_RATE = 25;
    // Telegraphed boss attacks, phases and enrage (server/bossMechanics.ts)
    this.bossMech = createBossMechanics(this);
    this.tickInterval = null;
    this._ftQueue = new Map<any, any>(); // socket room -> floating texts waiting for this tick's batch

    // Field raid / world boss events: per-zone live state and spawn schedule.
    this.raidStates = new Map<any, any>();   // zoneId -> { conf, def, mobId, damage: Map(id->amt), despawnAt, lastBroadcast }
    this.raidNextSpawn = new Map<string, number>();
    for (const zid of Object.keys(RAID.RAID_BOSSES)) {
      const conf = RAID.RAID_BOSSES[zid];
      this.raidNextSpawn.set(zid, Date.now() + (conf.firstDelayMinutes || 5) * RAID.MINUTE);
    }

    this.initFieldMonsters();
    this.initDungeonMonsters();
    this.startGameLoop();

    // Auto-save all online players with an active account every 30 seconds
    setInterval(() => {
      this.saveAllOnlinePlayers();
    }, 30000);
  }

  // Game systems: classes that own one area of the rules (see server/systems). Each reaches the server through `gs`.
  initSystems() {
    this.stats = new StatsSystem(this);
    this.passives = new PassiveSystem(this);
    this.zones = new ZoneSystem(this);
    this.dungeonRun = new DungeonRunSystem(this);
    this.loot = new LootSystem(this);
    this.level = new LevelSystem(this);
    this.itemUpgrade = new ItemUpgradeSystem(this);
    this.inventory = new InventorySystem(this);
    this.spCards = new SpCardSystem(this);
    this.raid = new RaidSystem(this);
    this.party = new PartySystem(this);
    this.minions = new MinionSystem(this);
    this.potions = new PotionSystem(this);
    this.statusFx = new StatusEffectSystem(this);
  }

  savePlayerAccount(socketId) {
    const player = this.players.get(socketId);
    if (!player || !player.accountUsername) return;
    accountManager.saveCharacter(player.accountUsername, player, player.accountSlot || 0);
  }

  saveAllOnlinePlayers() {
    // update every character in memory, then write the accounts file once
    let any = false;
    for (const player of this.players.values()) {
      if (player.accountUsername) {
        accountManager.saveCharacter(player.accountUsername, player, player.accountSlot || 0, false);
        any = true;
      }
    }
    if (any) accountManager.saveAccounts();
  }

  handleAccountRegister(socket, data) {
    if (!data) return;
    const { username, password, heroName, characterClass } = data;
    const name = (heroName || username || 'Hero').substring(0, 15).trim() || 'Hero';
    if (accountManager.isNameTaken(name)) {
      socket.emit('account_register_response', { success: false, message: 'ชื่อตัวละครนี้ถูกใช้แล้ว' });
      return;
    }
    const res = accountManager.register(username, password, this.makeStarterCharacter(name, characterClass));
    if (res.success) socket.data.username = res.username;
    socket.emit('account_register_response', res);
  }

  // Create another character on a logged-in account
  handleCreateCharacter(socket, data) {
    const username = accountManager.usernameForToken(data && data.token);
    if (!username) return socket.emit('character_list_response', { success: false, message: 'Session expired - please log in again.' });
    const name = String(data.name || '').substring(0, 15).trim();
    if (name.length < 2) return socket.emit('character_list_response', { success: false, message: 'ชื่อตัวละครต้องมีอย่างน้อย 2 ตัวอักษร' });
    const res = accountManager.createCharacter(username, this.makeStarterCharacter(name, data.characterClass));
    socket.emit('character_list_response', res);
  }

  handleDeleteCharacter(socket, data) {
    const username = accountManager.usernameForToken(data && data.token);
    if (!username) return socket.emit('character_list_response', { success: false, message: 'Session expired - please log in again.' });
    const slot = Number(data.slot);
    const online = Array.from(this.players.values()).some(p => p.accountUsername === username);
    if (online) return socket.emit('character_list_response', { success: false, message: 'Leave the game before deleting a character.' });
    socket.emit('character_list_response', accountManager.deleteCharacter(username, slot));
  }

  makeStarterCharacter(heroName, characterClass) {
    return createStarterCharacter(heroName, characterClass);
  }

  handleAccountLogin(socket, data) {
    if (!data) return;
    const res = accountManager.login(data.username, data.password);
    socket.emit('account_login_response', res);
  }

  // --- zone rooms: every socket sits in the room of the zone / dungeon instance it is in ---
  emitZone(zone, event, data, instanceId = null) {
    if (!zone) return this.io.emit(event, data);
    if (zone === 'dungeon' && !instanceId) instanceId = this.ctxInstanceId;
    const room = (zone === 'dungeon' && instanceId) ? `dungeon:${instanceId}` : `zone:${zone}`;
    // Damage numbers come by the hundred in big fights: queue them and send
    // one batch per room per tick (flushFloatingTexts) instead of a message each
    if (event === 'floating_text') {
      let q = this._ftQueue.get(room);
      if (!q) this._ftQueue.set(room, q = []);
      if (q.length < FLOATING_TEXT_BATCH_MAX) q.push(data);
      return;
    }
    this.io.to(room).emit(event, data);
  }

  flushFloatingTexts() {
    for (const [room, list] of this._ftQueue) {
      this.io.to(room).emit('floating_texts', list.map(t => ({
        ...t, x: Math.round(t.x * 100) / 100, y: Math.round(t.y * 100) / 100
      })));
    }
    this._ftQueue.clear();
  }

  // Run fn with the given player's dungeon instance as the active context.
  runAs(socketId, fn) {
    const prev = this.ctxInstanceId;
    const player = this.players.get(socketId);
    this.ctxInstanceId = player ? (player.dungeonInstanceId || null) : null;
    try {
      return fn();
    } finally {
      this.ctxInstanceId = prev;
    }
  }

  syncZoneRooms() {
    for (const player of this.players.values()) {
      const roomKey = (player.zone === 'dungeon' && player.dungeonInstanceId)
        ? `dungeon:${player.dungeonInstanceId}`
        : `zone:${player.zone}`;
      if (player._room === roomKey) continue;
      const socket = this.io.sockets.sockets.get(player.id);
      if (!socket) continue;
      if (player._room) socket.leave(player._room);
      socket.join(roomKey);
      player._room = roomKey;
    }
  }

  // --- dungeon instance helpers ---
  // Lava cracks, acid, frost and rifts afflict whoever stands on them
  applyDungeonHazard(player) {
    if (player.isDead || player.godMode) return;
    const inst = this.getPlayerDungeonInstance(player);
    const row = inst && inst.dungeon.tiles[Math.floor(player.y)];
    const hazard = row && DUNGEON_HAZARDS[row[Math.floor(player.x)]];
    if (!hazard) return;
    const value = hazard.dot ? Math.max(1, Math.round(player.maxHp * hazard.dot)) : 0.4;
    this.applyStatusEffect(player, hazard.status, hazard.duration, value);
  }

  getPlayerDungeonInstance(player) {
    return this.dungeonRun.getPlayerDungeonInstance(player);
  }

  getOrCreateDungeonInstance(player, floor = 1, difficulty = 'normal', forceRegen = false, mode = 'classic', mods: string[] = []) {
    const instanceId = player.partyId ? `party_${player.partyId}` : `solo_${player.id}`;
    const existing = this.dungeonInstances.get(instanceId);
    // an unfinished run is resumed, unless the player now asks for the other mode or other modifiers (a fresh dungeon then)
    const sameMods = (existing && existing.mods || []).join() === mods.join();
    if (!forceRegen && existing && (existing.mode || 'classic') === mode && sameMods) return existing;

    const dungeonMap = generateProceduralDungeon(floor, difficulty, mode);
    // Monsters wait per room and only appear once a door into their room
    // opens (see updateDungeonRooms / spawnDungeonRoom)
    const pendingMobs = new Map<any, any>(); // roomIdx -> mobs
    if (dungeonMap && dungeonMap.mobs) {
      dungeonMap.mobs.forEach(mob => {
        if (!pendingMobs.has(mob.roomIdx)) pendingMobs.set(mob.roomIdx, []);
        pendingMobs.get(mob.roomIdx).push(DMODS.applyModsToMob(MobFactory.dungeonMob(mob, 10), mods));
      });
    }

    const bossRoomIdx = dungeonMap && dungeonMap.rooms ? dungeonMap.rooms.length - 1 : -1;
    const trashMobs = (dungeonMap && dungeonMap.mobs) ? dungeonMap.mobs.filter(m => m.roomIdx !== bossRoomIdx) : [];
    const totalTrashMobs = trashMobs.length;
    // the boss portal opens at DUNGEON_PORTAL_SHARE of the dungeon's monsters (by progress weight)
    const totalWeight = trashMobs.reduce((t, m) => t + dungeonProgressWeight(m), 0);
    const requiredKills = Math.max(1, Math.round(totalWeight * DUNGEON_PORTAL_SHARE));

    const inst: any = createDungeonInstance({
      id: instanceId,
      partyId: player.partyId || null,
      floor,
      difficulty,
      mode,
      mods,                       // dungeon modifiers (dungeonMods.ts)
      modReward: DMODS.modReward(mods),
      dungeon: dungeonMap,
      pendingMobs,
      chests: dungeonMap.chests || [],
      bossRoomIdx,
      totalTrashMobs,
      requiredKills
    });

    this.dungeonInstances.set(instanceId, inst);
    // The entrance (no monsters) clears at once, opening its doors and
    // spawning the rooms behind them
    this.updateDungeonRooms(inst);
    inst.announce = true;
    return inst;
  }

  equipSpCard(player, itemIndex) {
    return this.spCards.equipSpCard(player, itemIndex);
  }

  handleSpTransform(socketId) {
    return this.spCards.handleSpTransform(socketId);
  }

  spLoadout(player, card) {
    return this.spCards.spLoadout(player, card);
  }

  customizeSpSkill(player, data) {
    return this.spCards.customizeSpSkill(player, data);
  }

  setTransformed(player, on) {
    return this.spCards.setTransformed(player, on);
  }

  fragmentCount(player) {
    return this.spCards.fragmentCount(player);
  }

  spendFragments(player, n) {
    return this.spCards.spendFragments(player, n);
  }

  handleSpCardEnhance(socketId, data) {
    return this.spCards.handleSpCardEnhance(socketId, data);
  }

  handleSpCardExchange(socketId, data) {
    return this.spCards.handleSpCardExchange(socketId, data);
  }

  awardJobExp(player, amount) {
    return this.spCards.awardJobExp(player, amount);
  }

  rollBossSpLoot(inst, bossLevel) {
    return this.spCards.rollBossSpLoot(inst, bossLevel);
  }

  newDungeonRun(inst, cleared = false) {
    return this.dungeonRun.newDungeonRun(inst, cleared);
  }

  updateDungeonRooms(inst) {
    return this.dungeonRun.updateDungeonRooms(inst);
  }

  spawnDungeonRoom(inst, roomIdx) {
    return this.dungeonRun.spawnDungeonRoom(inst, roomIdx);
  }

  cleanupDungeonInstanceIfEmpty(instanceId) {
    return this.dungeonRun.cleanupDungeonInstanceIfEmpty(instanceId);
  }

  // --- zone lookups (town / field zones / per-instance dungeon) ---
  getMobsMap(zone, playerOrInstId = null) {
    if (zone === 'town') return this.townMobs;
    if (this.fields && this.fields.has(zone)) return this.fields.get(zone).mobs;
    if (zone === 'dungeon') {
      let instId = null;
      if (typeof playerOrInstId === 'string') instId = playerOrInstId;
      else if (playerOrInstId && playerOrInstId.dungeonInstanceId) instId = playerOrInstId.dungeonInstanceId;
      if (!instId) instId = this.ctxInstanceId;
      if (instId && this.dungeonInstances.has(instId)) {
        return this.dungeonInstances.get(instId).mobs;
      }
    }
    return this.dungeonMobs;
  }

  getGroundItemsMap(zone, playerOrInstId = null) {
    return this.loot.getGroundItemsMap(zone, playerOrInstId);
  }

  getPartyData(partyId) {
    return this.party.getPartyData(partyId);
  }

  broadcastPartyUpdate(partyId) {
    return this.party.broadcastPartyUpdate(partyId);
  }

  handlePartyInvite(socketId, data) {
    return this.party.handlePartyInvite(socketId, data);
  }

  handlePartyAccept(socketId, data) {
    return this.party.handlePartyAccept(socketId, data);
  }

  handlePartyDecline(socketId, data) {
    return this.party.handlePartyDecline(socketId, data);
  }

  handlePartySummon(socketId) {
    return this.party.handlePartySummon(socketId);
  }

  handlePartySummonAccept(socketId, data) {
    return this.party.handlePartySummonAccept(socketId, data);
  }

  handlePartyListCandidates(socketId) {
    return this.party.handlePartyListCandidates(socketId);
  }

  handlePartyLeave(socketId) {
    return this.party.handlePartyLeave(socketId);
  }

  handlePartyKick(socketId, data) {
    return this.party.handlePartyKick(socketId, data);
  }

  removePlayerFromParty(socketId) {
    return this.party.removePlayerFromParty(socketId);
  }

  initFieldMonsters() {
    return this.zones.initFieldMonsters();
  }

  initDungeonMonsters() {
    return this.zones.initDungeonMonsters();
  }

  regenerateDungeon(floor = 1, difficulty = 'normal') {
    return this.zones.regenerateDungeon(floor, difficulty);
  }

  handleSetEffects(socketId: string, data: any) {
    return this.stats.handleSetEffects(socketId, data);
  }

  // ---- destructible field props: every solid prop in a field zone breaks after a few hits (swings and
  // skills near it) and grows back PROP_RESPAWN_S seconds later. A broken prop is flagged `destroyed`
  // on the map obstacle itself, so it stops blocking movement and rides zone_change to late joiners.
  damageFieldProps(player, cx, cy, radius, cone: { dx: number; dy: number; cos: number } | null = null) {
    const field = this.fields.get(player.zone);
    if (!field) return;
    const grid = fieldObstacleGrid(field.map);
    const st: Map<string, any> = field.propState || (field.propState = new Map());
    const now = Date.now();
    const span = Math.ceil(radius + 1), tx = Math.floor(cx), ty = Math.floor(cy);
    for (let gy = ty - span; gy <= ty + span; gy++) {
      for (let gx = tx - span; gx <= tx + span; gx++) {
        const list = grid.get(gy * 4096 + gx);
        if (!list) continue;
        for (const o of list) {
          if (o.destroyed || /portal/.test(o.type)) continue;
          const orad = o.radius || 0.5;
          if (Math.hypot(o.x - cx, o.y - cy) > radius + orad) continue;
          if (cone) {
            const px = o.x - player.x, py = o.y - player.y, pl = Math.hypot(px, py) || 1;
            if (pl > orad + 0.7 && (px * cone.dx + py * cone.dy) / pl < cone.cos) continue;
          }
          let s = st.get(o.id);
          if (!s) { const max = PROP_HITS[o.type] || 3; s = { hp: max, max, hitAt: 0 }; st.set(o.id, s); }
          if (now - s.hitAt < 220) continue;                    // one blow at a time, whatever hits it
          s.hitAt = now;
          s.hp -= 1;
          if (s.hp > 0) {
            this.emitZone(player.zone, 'prop_hit', { id: o.id, x: o.x, y: o.y, type: o.type, hp: s.hp, max: s.max });
            continue;
          }
          o.destroyed = true;
          st.delete(o.id);
          (field.destroyedProps || (field.destroyedProps = [])).push({ o, at: now + PROP_RESPAWN_S * 1000 });
          this.emitZone(player.zone, 'prop_state', { id: o.id, destroyed: true, x: o.x, y: o.y, type: o.type });
        }
      }
    }
  }

  // Bring broken props back once their time is up (never on top of someone standing there)
  updateFieldProps(field, zoneId) {
    const list = field.destroyedProps;
    if (!list || !list.length) return;
    const now = Date.now();
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (now < e.at) continue;
      const blocked = Array.from(this.players.values()).some((p: any) => p.zone === zoneId && !p.isDead && Math.hypot(p.x - e.o.x, p.y - e.o.y) < (e.o.radius || 0.5) + 0.9);
      if (blocked) { e.at = now + 1000; continue; }
      delete e.o.destroyed;
      list.splice(i, 1);
      this.emitZone(zoneId, 'prop_state', { id: e.o.id, destroyed: false, x: e.o.x, y: e.o.y, type: e.o.type });
    }
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
    } else if (this.fields.has(zone)) {
      const map = this.fields.get(zone).map;
      if (x < 1 || x > map.width - 2 || y < 1 || y > map.height - 2) return true;
      const tileX = Math.floor(x);
      const tileY = Math.floor(y);
      if (tileX >= 0 && tileX < map.width && tileY >= 0 && tileY < map.height) {
        const tile = map.tiles[tileY][tileX];
        if (map.blockingTiles.includes(tile)) return true;
      }
      // big fields hold thousands of props: only test the ones around the point
      for (const obs of nearObstacles(fieldObstacleGrid(map), x, y)) {
        const obsRadius = obs.radius || 0.65;
        if (Math.hypot(obs.x - x, obs.y - y) < (radius + obsRadius)) return true;
      }
    } else {
      // Dungeon collision
      const ctxInst = this.ctxInstanceId && this.dungeonInstances.get(this.ctxInstanceId);
      const dungeon = ctxInst ? ctxInst.dungeon : this.dungeon;
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
        // 7 = WALL, 8 = VOID, plus deep liquids and star pits
        if (tile === 7 || tile === 8 || BLOCKING_FEATURES.has(tile)) return true;
      }

      for (const obs of dungeon.obstacles) {
        if (!obs.collidable) continue;
        if (Math.hypot(obs.x - x, obs.y - y) < (radius + 0.6)) return true;
      }
    }
    return false;
  }

  distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  addPlayer(socket, data) {
    let savedChar = null;
    const accountUsername = accountManager.usernameForToken(data && data.token);
    const accountSlot = Math.max(0, parseInt(data && data.slot, 10) || 0);
    if (accountUsername) {
      savedChar = accountManager.getCharacter(accountUsername, accountSlot);
      if (!savedChar) {
        socket.emit('character_list_response', { success: false, message: 'Character not found.' });
        return;
      }
      // The same character can only be in the world once (reconnects replace the old session)
      for (const other of this.players.values()) {
        if (other.accountUsername === accountUsername && other.accountSlot === accountSlot && other.id !== socket.id) {
          const oldSocket = this.io.sockets.sockets.get(other.id);
          this.removePlayer(other.id);
          if (oldSocket) oldSocket.disconnect(true);
        }
      }
    }

    const chosenClass = savedChar ? (savedChar.characterClass || 'warrior') : (isHeroClass(data.characterClass) ? data.characterClass : 'warrior');
    const classStats = HERO_CLASSES[chosenClass].baseStats;

    const spawnX = 20 + (Math.random() - 0.5) * 2;
    const spawnY = 23 + (Math.random() - 0.5) * 1.5; // Spawn in open south plaza, away from fountain

    // the bag grew from 30 to DEFAULT_BAG_SLOTS: older characters get the difference on top of
    // whatever they added with backpack expanders (runs once: afterwards they are at 150+)
    if (savedChar && savedChar.inventory && (savedChar.inventory.maxSlots || 30) < DEFAULT_BAG_SLOTS) {
      savedChar.inventory.maxSlots = Math.min(MAX_BAG_SLOTS, (savedChar.inventory.maxSlots || 30) + DEFAULT_BAG_SLOTS - 30);
    }
    const player = createLivePlayer({
      id: socket.id,
      accountUsername,
      accountSlot,
      role: accountManager.roleFor(accountUsername),
      saved: savedChar,
      chosenClass,
      guestName: data && data.name,
      spawnX,
      spawnY
    });

    if (!savedChar) {
      if (player.accountUsername) {
        accountManager.saveCharacter(player.accountUsername, player, player.accountSlot || 0);
      }
    }

    // Weapons became class-locked; tag older saved items and move a wrong-class weapon back to the bag
    for (const it of [...player.inventory.items, ...Object.values(player.equipment)]) {
      const c = it && it.type === 'sp_card' ? (SP.CARD_BY_ID[it.cardId] || {}).cls : requiredClass(it);
      if (c) it.cls = c;
    }
    const heldWeapon = player.equipment.weapon;
    const heldCls = requiredClass(heldWeapon);
    if (heldCls && heldCls !== player.characterClass) {
      player.inventory.items.push(ItemFactory.stack(heldWeapon));
      player.equipment.weapon = null;
    }

    // SP cards from before the +100 scale: keep their strength (+N -> +N*10)
    SP.upgradeCardScale(player.equipment.sp);
    for (const it of player.inventory.items || []) SP.upgradeCardScale(it);

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
      shopItems: Object.values(ITEMS).filter(it => it.type === 'consumable' && it.buyPrice),
      passiveTree: PASSIVES.CLIENT_TREE,
      allSkills: ALL_CLASS_SKILLS,
      allSkillsCatalog: CLASS_SKILLS_CATALOG,
      skillRunes: SKILL_RUNES,
      spCatalog: SP.clientCatalog(),
      weaponAbilities: Object.fromEntries(Object.values(WEAPON_ABILITIES).map(a => [a.id, { id: a.id, name: a.name, desc: a.desc, mpCost: a.mpCost, cooldown: a.cooldown, isDash: a.isDash, shape: a.shape, element: a.element, color: a.color }])),
      armorSets: ARMOR_SETS,
      // every rune: what it does and which item kind it goes into (Rune Forge, tooltips)
      runeCatalog: Object.fromEntries((Object.values(ITEMS) as any[]).filter(it => it.type === 'rune').map(r => [r.id, {
        id: r.id, name: r.name, icon: r.icon, iconKey: r.iconKey, color: r.color, socketFor: r.socketFor || 'weapon',
        effect: r.effect || (RUNES_DEF[r.runeType] && RUNES_DEF[r.runeType].desc) || r.desc
      }])),
      socketMax: SOCKET_MAX,
      crafting: CRAFT.craftingCatalog(),
      dungeonMods: DMODS.clientCatalog(),
      itemNames: Object.fromEntries((Object.values(ARMOR_SETS) as any[]).flatMap(s => s.pieces.map(id => [id, ITEMS[id] && ITEMS[id].name]))),
      enhanceRules: { max: ENHANCE_MAX, safeLevel: ENHANCE_SAFE_LEVEL, base: ENHANCE_BASE_COST, growth: ENHANCE_COST_GROWTH, chance: ENHANCE_CHANCE },
      riftCatalog: {
        structures: RIFT.RIFT_STRUCTURES,
        recipes: RIFT.JAMES_RECIPES.map(r => ({ ...r, item: ITEMS[r.itemId] })),
        maxWaves: RIFT.RIFT_MAX_WAVES,
        checkpointEvery: RIFT.RIFT_CHECKPOINT_EVERY,
        buildReach: RIFT.RIFT_STRUCT_REACH,
        modes: RIFT.RIFT_MODES
      }
    });

    socket.broadcast.emit('player_joined', player);
    this.broadcastSystemMessage(`⚔️ [${player.name} the ${player.characterClass.toUpperCase()}] entered the realm!`);
    if ((player as any).talentRefunded) {
      socket.emit('chat_broadcast', { senderId: 'system', senderName: 'SYSTEM', senderClass: 'system', timestamp: Date.now(), text: `🌳 The passive tree was redesigned: all ${(player as any).talentRefunded} of your passive points were refunded for free. Open the Passive Tree (K) to pick your new path!` });
      (player as any).talentRefunded = 0;
    }
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      if (player.accountUsername) {
        accountManager.saveCharacter(player.accountUsername, player, player.accountSlot || 0);
      }
      this.removePlayerFromParty(socketId);
      if (player.spTransformed) this.setTransformed(player, false);
      // Disconnecting mid-run forfeits the escrowed chest loot
      player.dungeonRun = null;
      this.players.delete(socketId);
      if (player.dungeonInstanceId) {
        this.cleanupDungeonInstanceIfEmpty(player.dungeonInstanceId);
      }
      this.io.emit('player_left', socketId);
      this.broadcastSystemMessage(`🚪 [${player.name}] has departed.`);
    }
  }

  // Handle using Revival Stone (หินชุบชีวิต); superStone picks the Super Revival Stone
  handleUseRevivalStone(socketId, superStone = false) {
    const player = this.players.get(socketId);
    if (!player || !player.isDead) return;

    const stoneId = superStone ? 'super_revival_stone' : 'revival_stone';
    const stoneIdx = player.inventory && player.inventory.items ? player.inventory.items.findIndex(it => it.id === stoneId) : -1;
    if (stoneIdx === -1) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: '⚠️ ไม่มีหินชุบชีวิตในกระเป๋า!',
          color: '#ef4444'
        });
      }
      return;
    }

    // Check dungeon run revival quota (limit 10 per run; the Eternal Rift has none)
    const inRift = !!this.getRiftInstance(player);
    if (player.zone === 'dungeon' && !inRift) {
      if (!player.dungeonRun) {
        player.dungeonRun = { revivalsUsed: 0, maxRevivals: 10 };
      }
      const used = player.dungeonRun.revivalsUsed || 0;
      const maxRev = player.dungeonRun.maxRevivals || 10;
      if (used >= maxRev) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('floating_text', {
            x: player.x,
            y: player.y - 0.7,
            text: `⚠️ ใช้หินชุบในดันเจี้ยนครบโควต้าแล้ว (${used}/${maxRev} ก้อน)!`,
            color: '#ef4444',
            size: 18
          });
          socket.emit('chat_message', {
            sender: 'System',
            text: `⚠️ ไม่สามารถชุบชีวิตได้: โควต้าหินชุบชีวิตในดันเจี้ยนจำกัดไม่เกิน ${maxRev} ก้อนต่อรอบ (ใช้ครบ ${used}/${maxRev} แล้ว)`,
            color: '#ef4444'
          });
        }
        return;
      }
      player.dungeonRun.revivalsUsed = used + 1;
      this.emitDungeonRunUpdate(player);
    }

    // Deduct 1 stone
    const stoneItem = player.inventory.items[stoneIdx];
    if (stoneItem.count > 1) {
      stoneItem.count--;
    } else {
      player.inventory.items.splice(stoneIdx, 1);
    }

    // Revive on the spot with the stone's share of HP & MP (30% normal, 100% super)
    const share = (ITEMS[stoneId] && ITEMS[stoneId].reviveShare) || 0.3;
    player.isDead = false;
    player.respawnTimer = 0;
    player.riftRespawnSet = false;
    player.hp = Math.max(1, Math.round(player.maxHp * share));
    player.mp = Math.round(player.maxMp * share);

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_respawned', { playerId: player.id, x: player.x, y: player.y, onSpot: true });
      socket.emit('player_updated', player);
      const revMsg = player.zone === 'dungeon' && !inRift && player.dungeonRun
        ? `✨ ชุบชีวิตสำเร็จ! (หินชุบในดัน: ${player.dungeonRun.revivalsUsed}/${player.dungeonRun.maxRevivals || 10})`
        : `✨ ชุบชีวิตสำเร็จ! (${superStone ? 'Super Revival Stone' : 'Revival Stone'} - ${Math.round(share * 100)}% HP)`;
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.9,
        text: revMsg,
        color: '#facc15',
        size: 20
      });
    }

    this.emitZone(player.zone, 'skill_fx', {
      type: 'holy_resurrection',
      x: player.x,
      y: player.y,
      radius: 2.5,
      playerId: player.id
    });
    this.sendDirectMessage(player.id, `🌟 [${player.name}] ได้ใช้หินชุบชีวิต ฟื้นคืนชีพขึ้นมา ณ จุดเดิม!`);
    this.savePlayerAccount(socketId);
  }

  handlePlayerInput(socketId, input) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    if (input.type === 'click_move') {
      let maxX = MAP_WIDTH - 2;
      let maxY = MAP_HEIGHT - 2;
      const playerInst = this.getPlayerDungeonInstance(player);
      const playerDungeon = playerInst ? playerInst.dungeon : this.dungeon;
      if (player.zone === 'dungeon' && playerDungeon) {
        maxX = playerDungeon.width - 2;
        maxY = playerDungeon.height - 2;
      } else if (this.fields.has(player.zone)) {
        const fieldMap = this.fields.get(player.zone).map;
        maxX = fieldMap.width - 2;
        maxY = fieldMap.height - 2;
      }
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
    } else if (input.type === 'aim_facing') {
      // "Face the cursor" setting: the client sends the 8-way direction
      // toward the mouse (null when the setting is off)
      player.aimFacing = FACINGS.includes(input.facing) ? input.facing : null;
      if (player.aimFacing && !(player.faceLockTimer > 0)) player.facing = player.aimFacing;
    }
  }

  handleUsePortal(socketId) {
    return this.zones.handleUsePortal(socketId);
  }

  checkPortalAndInteractions(player, socket) {
    return this.zones.checkPortalAndInteractions(player, socket);
  }

  handleSpawnBossPortal(socketId: any) {
    return this.zones.handleSpawnBossPortal(socketId);
  }

  teleportPlayerToBossRoom(player: any, socket: any, inst: any) {
    return this.zones.teleportPlayerToBossRoom(player, socket, inst);
  }

  teleportPlayerFromBossRoom(player: any, socket: any, inst: any) {
    return this.zones.teleportPlayerFromBossRoom(player, socket, inst);
  }

  handleEnterDungeon(socketId: any, options: any = {}) {
    return this.zones.handleEnterDungeon(socketId, options);
  }

  handleLeaveDungeon(socketId) {
    return this.zones.handleLeaveDungeon(socketId);
  }

  teleportPlayerToDungeon(player, socket, inst = null, at = null) {
    return this.zones.teleportPlayerToDungeon(player, socket, inst, at);
  }

  teleportPlayerToField(player, socket, zoneId, arrive = 'south', at = null) {
    return this.zones.teleportPlayerToField(player, socket, zoneId, arrive, at);
  }

  teleportPlayerToFrostfell(player, socket) {
    return this.zones.teleportPlayerToFrostfell(player, socket);
  }

  teleportPlayerToTown(player, socket, at = null) {
    return this.zones.teleportPlayerToTown(player, socket, at);
  }

  handleAllocateSkillPoint(socketId, skillId) {
    return this.level.handleAllocateSkillPoint(socketId, skillId);
  }

  handleAllocatePassives(socketId, ids) {
    return this.level.handleAllocatePassives(socketId, ids);
  }

  handleRefundPassive(socketId, id) {
    return this.level.handleRefundPassive(socketId, id);
  }

  refundStaleTalents(player) {
    return this.level.refundStaleTalents(player);
  }

  handleResetSkillPoints(socketId) {
    return this.level.handleResetSkillPoints(socketId);
  }

  handleOpenChest(socketId, chestId) {
    return this.dungeonRun.handleOpenChest(socketId, chestId);
  }

  handlePlayerAttack(socketId, targetInfo) {
    const player = this.players.get(socketId);
    if (!player || player.isDead || player.attackCooldown > ATTACK_GRACE_S) return;

    const atkSpeed = Math.max(0.4, player.attackSpeed || 1.0);
    player.attackCooldown = Math.max(0, player.attackCooldown || 0) + Math.max(0.12, 0.55 / atkSpeed);
    player.isAttacking = true;

    const mobsMap = this.getMobsMap(player.zone);

    let targetMob = null;
    if (targetInfo && targetInfo.targetType === 'mob') {
      const mob = mobsMap.get(targetInfo.targetId);
      if (mob && mob.state !== 'dead') {
        targetMob = mob;
      }
    }

    // A swing keeps the hero turned toward its target for a moment, even
    // with "face the cursor" on
    player.faceLockTimer = AIM_FACE_LOCK_SEC;
    if (targetMob) {
      player.facing = this.calculateFacing(player.x, player.y, targetMob.x, targetMob.y);
      // In reach of a click-moved hero: plant the feet and swing instead of walking on into the monster
      const reach = (player.attackRange || 1.6) + 0.6;
      const wasd = player.moveDir && (player.moveDir.dx || player.moveDir.dy);
      if (!wasd && Math.hypot(targetMob.x - player.x, targetMob.y - player.y) <= reach) {
        player.targetX = null;
        player.targetY = null;
        player.isMoving = false;
      }
    } else if (targetInfo && targetInfo.worldX !== undefined) {
      player.facing = this.calculateFacing(player.x, player.y, targetInfo.worldX, targetInfo.worldY);
    }

    // a swing also hits the props in front of the hero (field zones): melee in a short cone, mages farther
    if (this.fields.has(player.zone)) {
      let ax = targetMob ? targetMob.x - player.x : targetInfo && targetInfo.worldX !== undefined ? targetInfo.worldX - player.x : NaN;
      let ay = targetMob ? targetMob.y - player.y : targetInfo && targetInfo.worldY !== undefined ? targetInfo.worldY - player.y : NaN;
      if (!Number.isFinite(ax) || !Number.isFinite(ay) || Math.hypot(ax, ay) < 0.01) {
        const fv: any = { E: [1, 0], SE: [0.707, 0.707], S: [0, 1], SW: [-0.707, 0.707], W: [-1, 0], NW: [-0.707, -0.707], N: [0, -1], NE: [0.707, -0.707] }[player.facing] || [1, 0];
        ax = fv[0]; ay = fv[1];
      }
      const al = Math.hypot(ax, ay) || 1;
      const propReach = player.characterClass === 'mage' ? 4 : (player.attackRange || 1.6) + 1.2;
      this.damageFieldProps(player, player.x, player.y, propReach, { dx: ax / al, dy: ay / al, cos: 0.4 });
    }

    const critChance = 0.15 + (player.critChanceBonus || 0);
    let isCrit = Math.random() < critChance;
    if (player.smokeScreenTimer > 0) {
      isCrit = true;
      player.smokeScreenTimer = 0;
      this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '💥 AMBUSH!', color: '#f59e0b', size: 20 });
    }

    let attackDmg = player.dmg;
    if (player.berserkTimer > 0) {
      attackDmg = Math.round(attackDmg * 1.35);
    }
    // (Dread Lord's low-HP bonus is its card passive: passiveDamageMult)
    if (player.bloodlust) attackDmg = Math.round(attackDmg * this.bloodRage(player));
    // melee hits below add up what they took, for the SP card passive leech
    let meleeDealt = 0;
    // where each blow landed, so the client can burst particles on what was hit
    const hits: any[] = [];
    const strike = (mob, dmg, crit) => {
      const before = mob.hp;
      this.applyDamageToMob(player, mob, dmg, crit);
      meleeDealt += Math.max(0, before - Math.max(0, mob.hp));
      if (hits.length < 12) hits.push({ x: Math.round(mob.x * 100) / 100, y: Math.round(mob.y * 100) / 100, crit: !!crit });
    };

    let hasSweepTriggered = false;
    let sweepRangeHit = 0; // how far this swing's cleave reached (tiles), for the client's arc

    const power = player.weaponPower;
    if (player.characterClass === 'mage' && power && power.fireChannel) {
      // Sunfire Conduit: one fireball into each of the nearest enemies (the clicked one first), no splash
      const reach = player.attackRange + 1.0;
      const near = (Array.from(mobsMap.values()) as any[])
        .filter(m => m.state !== 'dead' && m !== targetMob && !(m.spawnUntil && Date.now() < m.spawnUntil) && Math.hypot(m.x - player.x, m.y - player.y) <= reach)
        .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
      const targets = (targetMob && Math.hypot(targetMob.x - player.x, targetMob.y - player.y) <= reach ? [targetMob] : []).concat(near).slice(0, power.fireChannel);
      if (targets.length) {
        targets.forEach(m => this.spawnProjectile(player, m.x, m.y, m.id, 'mob', attackDmg, { crit: isCrit }));
      } else if (targetInfo && targetInfo.worldX !== undefined && targetInfo.worldY !== undefined) {
        this.spawnProjectile(player, targetInfo.worldX, targetInfo.worldY, null, 'point', attackDmg, { crit: isCrit });
      }
    } else if (player.characterClass === 'mage') {
      // Mage Ranged Projectiles
      if (targetMob) {
        const dist = Math.hypot(targetMob.x - player.x, targetMob.y - player.y);
        if (dist <= player.attackRange + 1.0) {
          this.spawnProjectile(player, targetMob.x, targetMob.y, targetMob.id, 'mob', attackDmg, { splash: MAGE_SPLASH_SHARE, crit: isCrit });
        }
      } else if (targetInfo && targetInfo.worldX !== undefined && targetInfo.worldY !== undefined) {
        this.spawnProjectile(player, targetInfo.worldX, targetInfo.worldY, null, 'point', attackDmg, { splash: MAGE_SPLASH_SHARE, crit: isCrit });
      } else {
        const facingVectors = {
          E: { x: 1, y: 0 }, SE: { x: 0.707, y: 0.707 }, S: { x: 0, y: 1 }, SW: { x: -0.707, y: 0.707 },
          W: { x: -1, y: 0 }, NW: { x: -0.707, y: -0.707 }, N: { x: 0, y: -1 }, NE: { x: 0.707, y: -0.707 }
        };
        const fv = facingVectors[player.facing] || { x: 1, y: 0 };
        this.spawnProjectile(player, player.x + fv.x * 6, player.y + fv.y * 6, null, 'point', attackDmg, { splash: MAGE_SPLASH_SHARE, crit: isCrit });
      }
    } else {
      // Melee basic attacks with Minecraft-style Sweeping Edge cleave!
      const hitMobs = new Set();
      let primaryHit = false;

      // 1. Primary target damage
      if (targetMob) {
        const dist = Math.hypot(targetMob.x - player.x, targetMob.y - player.y);
        if (dist <= player.attackRange + 1.1) {
          strike(targetMob, attackDmg, isCrit);
          hitMobs.add(targetMob.id);
          primaryHit = true;
          if (player.berserkTimer > 0) {
            const maxHeal = Math.max(2, Math.round(player.maxHp * 0.04));
            const lifesteal = Math.min(maxHeal, Math.max(1, Math.round(attackDmg * 0.04)));
            player.hp = Math.min(player.maxHp, player.hp + lifesteal);
          }
          this.chainBasicAttack(player, targetMob, attackDmg, mobsMap, strike);
        }
      }

      // 2. Sweeping Edge (Swipe) Cleave to surrounding enemies in front arc
      // (Gatekeeper's Greatsword: a far longer, wider cleave with a damage floor)
      const swipePct = Math.max(player.swipe !== undefined ? player.swipe : 35, (power && power.minSwipe) || 0);
      if (swipePct > 0) {
        hasSweepTriggered = true;
        const facingVectors = {
          E: { x: 0.707, y: -0.707 },
          SE: { x: 1.0, y: 0.0 },
          S: { x: 0.707, y: 0.707 },
          SW: { x: 0.0, y: 1.0 },
          W: { x: -0.707, y: 0.707 },
          NW: { x: -1.0, y: 0.0 },
          N: { x: -0.707, y: -0.707 },
          NE: { x: 0.0, y: -1.0 }
        };
        const fv = facingVectors[player.facing] || { x: 1.0, y: 0.0 };
        const { reach: sweepRange, arc } = this.meleeSweep(player);
        sweepRangeHit = sweepRange;
        const minDot = Math.cos((arc * Math.PI) / 360);
        const swipeDmg = Math.max(1, Math.round(attackDmg * (swipePct / 100)));

        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead' || hitMobs.has(mob.id)) continue;
          const dx = mob.x - player.x;
          const dy = mob.y - player.y;
          const dist = Math.hypot(dx, dy);
          if (dist > sweepRange) continue;

          // Check angle in cone (±68 degrees, cos >= 0.35; wider for a sweepArc weapon)
          const dot = dist > 0.001 ? (dx * fv.x + dy * fv.y) / dist : 1.0;
          if (dot >= minDot) {
            hitMobs.add(mob.id);
            strike(mob, swipeDmg, Math.random() < critChance);   // its own crit roll, like the main target
          }
        }
      }
      this.cardPassiveLeech(player, meleeDealt);
    }

    this.emitZone(player.zone, 'entity_attack_fx', {
      attackerId: player.id,
      attackerType: 'player',
      class: player.characterClass,
      cardId: player.spTransformed && player.equipment && player.equipment.sp ? player.equipment.sp.cardId : null,
      targetId: targetInfo ? targetInfo.targetId : null,
      x: player.x,
      y: player.y,
      facing: player.facing,
      targetX: targetMob ? targetMob.x : undefined,
      targetY: targetMob ? targetMob.y : undefined,
      hasSweep: hasSweepTriggered,
      attackSpeed: player.attackSpeed || 1.0,
      swipe: player.swipe || 0,
      // the cleave's true reach (tiles) and arc (degrees), so the slash covers what it hits
      sweepRange: sweepRangeHit,
      sweepArc: hasSweepTriggered ? this.meleeSweep(player).arc : 0,
      hits
    });
  }

  // How far (tiles) and how wide (degrees) a melee hero's basic-attack cleave reaches
  meleeSweep(player) {
    const power = player.weaponPower;
    return {
      reach: (player.attackRange || 1.6) + SWEEP_EXTRA_REACH + ((power && power.sweepReach) || 0),
      arc: (power && power.sweepArc) || SWEEP_ARC_DEG
    };
  }

  handleCustomizeSkill(socketId, data) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;
    if (player.spTransformed) return this.customizeSpSkill(player, data);

    if (!data || !data.slot) return;
    const validSlots = ['slot1', 'slot2', 'slot3', 'dash'];
    if (!validSlots.includes(data.slot)) return;

    if (!player.equippedSkills) {
      player.equippedSkills = JSON.parse(JSON.stringify(DEFAULT_EQUIPPED_SKILLS[player.characterClass] || DEFAULT_EQUIPPED_SKILLS.warrior));
    }
    if (!player.equippedSkills.runes) {
      player.equippedSkills.runes = { slot1: 'none', slot2: 'none', slot3: 'none', dash: 'none' };
    }

    if (data.skillId) {
      const skillDef = ALL_CLASS_SKILLS[data.skillId];
      if (skillDef && skillDef.class === player.characterClass) {
        if (skillDef.reqLevel && player.level < skillDef.reqLevel) {
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket) {
            socket.emit('floating_text', {
              x: player.x,
              y: player.y - 0.7,
              text: `🔒 Requires Level ${skillDef.reqLevel}!`,
              color: '#ef4444'
            });
          }
          return;
        }
        player.equippedSkills[data.slot] = data.skillId;
      }
    }

    if (data.rune !== undefined) {
      if (SKILL_RUNES[data.rune]) {
        player.equippedSkills.runes[data.slot] = data.rune;
      }
    }

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('custom_skills_updated', {
        equippedSkills: player.equippedSkills
      });
      const skillName = ALL_CLASS_SKILLS[player.equippedSkills[data.slot]] ? ALL_CLASS_SKILLS[player.equippedSkills[data.slot]].name : player.equippedSkills[data.slot];
      const slotKey = data.slot === 'slot1' ? 'Q' : data.slot === 'slot2' ? 'E' : data.slot === 'slot3' ? 'R' : 'Shift';
      const runeDef = SKILL_RUNES[player.equippedSkills.runes[data.slot]] || SKILL_RUNES.none;

      let noticeText = `⚡ Set [${skillName}] to [${slotKey}]!`;
      if (data.rune !== undefined) {
        noticeText = `🔮 Inscribed ${runeDef.icon} [${runeDef.name}] into [${slotKey}]!`;
      }

      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: noticeText,
        color: '#facc15'
      });
    }

    this.sendDirectMessage(player.id, `⚡ [${player.name}] customized their active ability loadout.`);
  }

  // The skill definition used for a slot; a transformed hero uses the card's
  // own SP skill, its damage scaled by the card's upgrade level.
  resolvePlayerSkill(player, slot, skillId) {
    // Right-click weapon ability: +5% damage per weapon upgrade level
    if (slot === 'weapon') {
      const weapon = player.equipment && player.equipment.weapon;
      const ability = weaponAbility(weapon);
      if (!ability) return null;
      return Object.assign({}, ability, { dmgMult: ability.dmgMult * (1 + 0.05 * (weapon.upgradeLevel || 0)) });
    }
    const card = this.spCard(player);
    const lvl = (card && player.equipment.sp.upgradeLevel) || 0;
    const k = 1 + SP.SP_SKILL_PER_LEVEL * lvl;
    // Signature: its first stage, carrying every stage (scaled like card skills)
    if (slot === 'ult') {
      if (!card || !card.signature) return null;
      const stages = card.signature.stages.map(st => Object.assign({}, st, { dmgMult: st.dmgMult * k }));
      return Object.assign({}, stages[0], { cooldown: ULT_COOLDOWN, ultStages: stages });
    }
    const base = ALL_CLASS_SKILLS[skillId] || DEFAULT_SKILL_FOR_SLOT(player, slot);
    const spSkill = card && card.arsenal.includes(skillId) && SP.skillUnlocked(card, skillId, lvl) && SP.SP_SKILLS[skillId];
    if (!spSkill) return base;
    return Object.assign({}, spSkill, { dmgMult: spSkill.dmgMult * k });
  }

  bloodRage(player) {
    return this.passives.bloodRage(player);
  }

  // ------------------------------------------------ SP signatures & passives
  // (data and field meanings: spSignatures.ts)

  spCard(player) {
    return this.passives.spCard(player);
  }

  gainUltCharge(player, amount) {
    return this.passives.gainUltCharge(player, amount);
  }

  passiveDamageMult(player, mob) {
    return this.passives.passiveDamageMult(player, mob);
  }

  passiveOnHit(player, mob, damage) {
    return this.passives.passiveOnHit(player, mob, damage);
  }

  passiveOnKill(player, mob) {
    return this.passives.passiveOnKill(player, mob);
  }

  passiveOnHurt(player, mob, damage, zone) {
    return this.passives.passiveOnHurt(player, mob, damage, zone);
  }

  cardPassiveLeech(player, dealt) {
    return this.passives.cardPassiveLeech(player, dealt);
  }

  // Storm Herald Arc Conduit (a toggled chainAttack): a basic attack that lands
  // arcs on to the nearest enemies, each jump weaker; every swing costs MP and
  // the conduit fades when there is not enough
  chainBasicAttack(player, first, attackDmg, mobsMap, strike) {
    const toggle = (Object.values(player.spToggles || {}) as any[]).find(a => a.skill.chainAttack);
    if (!toggle) return;
    const sk = toggle.skill, C = sk.chainAttack;
    const cost = Math.round(C.mp * (player.manaCostMult || 1));
    if (player.mp < cost) {
      this.endSpToggle(player, sk.id, true);
      this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.8, text: '💧 OUT OF MANA - conduit fades', color: '#38bdf8', size: 16 });
      return;
    }
    player.mp -= cost;
    const visited = new Set([first]);
    const points = [{ x: first.x, y: first.y }];
    let cur = first, mult = 1;
    while (points.length < C.n) {
      let next = null, best = C.jump;
      for (const m of mobsMap.values()) {
        if (m.state === 'dead' || visited.has(m)) continue;
        const d = Math.hypot(m.x - cur.x, m.y - cur.y);
        if (d <= best) { best = d; next = m; }
      }
      if (!next) break;
      mult *= C.decay;
      visited.add(next);
      points.push({ x: next.x, y: next.y });
      strike(next, Math.max(1, Math.round(attackDmg * mult)), Math.random() < 0.15 + (player.critChanceBonus || 0));
      cur = next;
    }
    if (points.length > 1) {
      this.emitZone(player.zone, 'skill_fx', {
        type: 'sp_skill', shape: 'chain', quiet: true, x: player.x, y: player.y, startX: player.x, startY: player.y, points,
        element: sk.element, color: sk.color, cardId: sk.cardId, skillId: sk.id
      });
    }
  }

  endSpToggle(player, skillId, quiet = false) {
    return this.spCards.endSpToggle(player, skillId, quiet);
  }

  tickSpToggles(player, dt) {
    return this.spCards.tickSpToggles(player, dt);
  }

  ownBanner(player) {
    return this.passives.ownBanner(player);
  }

  phoenixRebirth(player) {
    return this.passives.phoenixRebirth(player);
  }

  heroBuffs(p) {
    return this.passives.heroBuffs(p);
  }

  updateRaidEvents() {
    return this.raid.updateRaidEvents();
  }

  spawnRaidBoss(zoneId) {
    return this.raid.spawnRaidBoss(zoneId);
  }

  despawnRaidBoss(zoneId, why = 'timeup') {
    return this.raid.despawnRaidBoss(zoneId, why);
  }

  recordRaidDamage(zoneId, playerId, amount) {
    return this.raid.recordRaidDamage(zoneId, playerId, amount);
  }

  raidStandings(st) {
    return this.raid.raidStandings(st);
  }

  broadcastRaidLeaderboard(zoneId, st) {
    return this.raid.broadcastRaidLeaderboard(zoneId, st);
  }

  raidInfo(zoneId) {
    return this.raid.raidInfo(zoneId);
  }

  onRaidBossDeath(mob, killerPlayer) {
    return this.raid.onRaidBossDeath(mob, killerPlayer);
  }

  payRaidReward(player, def, bucket, rank, total) {
    return this.raid.payRaidReward(player, def, bucket, rank, total);
  }

  // Run a card skill from its SP_SKILLS data (see the shape list in spCards.js)
  castSpSkill(player, skill, ctx) {
    const { slot, cooldown, runeId, skillData, mobsMap, applySkillDamage, computeDashVector, isEcho, isShadow, recall } = ctx;
    const zone = player.zone;
    const instanceId = player.dungeonInstanceId || null;
    // a Nightblade shadow casts from where it stands
    const px = ctx.origin ? ctx.origin.x : player.x, py = ctx.origin ? ctx.origin.y : player.y;
    const fxBase = { type: 'sp_skill', shape: skill.spShape, element: skill.element, color: skill.color, cardId: skill.cardId, rune: runeId, skillId: skill.id, name: skill.name };
    const emit = (data, first) => this.emitZone(zone, 'skill_fx', first && !isEcho && !isShadow && !ctx.quiet
      ? { ...fxBase, ...data, skillSlot: slot, cooldown, playerId: player.id }
      : { ...fxBase, ...data });
    const alive = () => [...mobsMap.values()].filter(m => m.state !== 'dead');
    const within = (cx, cy, r) => alive().filter(m => Math.hypot(m.x - cx, m.y - cy) <= r);
    const nearest = (cx: number, cy: number, r: number, exclude: any = null) => {
      let best = null, bestD = r;
      for (const m of alive()) {
        if (exclude && exclude.has(m)) continue;
        const d = Math.hypot(m.x - cx, m.y - cy);
        if (d <= bestD) { best = m; bestD = d; }
      }
      return best;
    };

    let dealt = 0;
    const say = (x, y, text, color, size) => this.emitZone(zone, 'floating_text', { x, y: y - 0.8, text, color, size });
    // Soul harvesters (Void Archon, Duskblade): every Soul empowers its skills; Devour spends them
    const isSoulCard = skill.souls !== undefined || skill.devour !== undefined;
    const souls = isSoulCard ? (player.voidSouls || 0) : 0;
    let soulMult = 1 + VOID_SOUL_BONUS * souls;
    if (skill.devour && souls > 0) {
      soulMult *= 1 + 0.12 * souls;
      const heal = Math.round(player.maxHp * skill.devour * souls);
      player.hp = Math.min(player.maxHp, player.hp + heal);
      say(px, py, `🌑 DEVOUR x${souls} (+${heal} HP)`, '#c084fc', 17);
      player.voidSouls = 0;
    }
    const gainSouls = (n) => {
      player.voidSouls = Math.min(VOID_SOUL_MAX, (player.voidSouls || 0) + n);
      player.voidSoulTimer = VOID_SOUL_SECONDS;
    };
    // Warchief Combo: a skill different from the last one stacks Combo,
    // repeating one drops it; a finisher cashes the whole chain in
    let comboMult = 1;
    if (skill.combo && !isEcho && !isShadow) {
      const nowC = Date.now();
      const c = player.combo && player.combo.until > nowC ? player.combo : { n: 0, last: null };
      let n = c.last === skill.id ? 0 : Math.min(COMBO_MAX, c.n + 1);
      if (skill.comboGain) n = Math.min(COMBO_MAX, n + skill.comboGain);
      comboMult = 1 + COMBO_BONUS * n;
      if (skill.finisher && n > 0) {
        comboMult *= 1 + skill.finisher * n;
        say(px, py, `🪓 FINISHER x${n}`, '#f97316', 18);
        n = 0;
      } else if (c.last === skill.id && c.n > 1) {
        say(px, py, 'COMBO BROKEN', '#94a3b8', 14);
      } else if (n > 1) {
        say(px, py, `🪓 COMBO x${n}`, '#fb923c', 13 + n);
      }
      player.combo = { n, last: skill.id, until: nowC + COMBO_SECONDS * 1000 };
    }
    // Reaver: Overheat powers every skill of the card; Vent spends the Heat
    let heatMult = 1;
    if (skill.cardId === 'sp_reaver' && player.overheatUntil > Date.now()) heatMult = 1 + OVERHEAT_BONUS;
    if (skill.vent && player.heat > 0 && !isEcho && !isShadow) {
      heatMult *= 1 + skill.vent * player.heat / 10;
      say(px, py, `🔥 VENT ${Math.round(player.heat)} HEAT`, '#fb923c', 17);
      player.heat = 0;
    }
    // Duskblade Doom: the brand replays a share of what it soaked up when it ends
    const burstDoom = (mob, brand) => {
      if (!mob || mob.doom !== brand) return;
      mob.doom = null;
      const dmg = Math.round(brand.stored * brand.share);
      if (dmg <= 0) return;
      emit({ shape: 'doom', x: mob.x, y: mob.y, radius: 1.8, burst: true }, false);
      if (mob.state !== 'dead' && mob.hp > 0) {
        this.applyDamageToMob(player, mob, dmg, false);
        say(mob.x, mob.y, `☠️ DOOM -${dmg}`, '#c084fc', 18);
      } else {
        // the brand outlives its bearer and bursts onto whoever stood beside it
        for (const m of within(mob.x, mob.y, 2.5)) this.applyDamageToMob(player, m, Math.round(dmg * 0.5), false);
        say(mob.x, mob.y, '☠️ DOOM SPREADS', '#c084fc', 16);
      }
    };
    const hit = (mob, mult = 1, fromX = px, fromY = py) => {
      if (!mob || mob.state === 'dead') return;
      let m = skill.dmgMult * mult * soulMult * comboMult * heatMult;
      // Tempest Caller: Conductor marks held by the target when this skill lands
      const conductNow = mob.conductTimer > 0 ? (mob.conduct || 0) : 0;
      // Gravelord: shatter the Fracture cracks for bonus damage and a stun
      let shatterStun = 0;
      if (skill.shatterEarth && mob.fracture > 0 && mob.fractureUntil > Date.now()) {
        m *= 1 + skill.shatterEarth * mob.fracture;
        shatterStun = FRACTURE_STUN * mob.fracture;
        say(mob.x, mob.y, `🪨 SHATTER x${mob.fracture}`, '#a3e635', 16);
        mob.fracture = 0;
      }
      // Pyromancer: Combust detonates Scorch, Fire Chain feeds on it
      if (skill.combust && mob.scorchStacks > 0) {
        m *= 1 + skill.combust * mob.scorchStacks;
        say(mob.x, mob.y, `💥 COMBUST x${mob.scorchStacks}`, '#fb923c', 16);
        mob.scorchStacks = 0;
      }
      if (skill.scorchBonus && mob.scorchStacks > 0) m *= 1 + skill.scorchBonus * mob.scorchStacks;
      // Cryo Sage: Shatter a frozen enemy for big damage, which thaws it
      if (skill.shatterFrozen && mob.frozenTimer > 0 && mob.frozenKind === 'ice') {
        m *= skill.shatterFrozen;
        mob.frozenTimer = 0;
        say(mob.x, mob.y, '🧊 SHATTER!', '#a5f3fc', 17);
      }
      if (skill.backstab) {
        const isStealthed = player.smokeScreenTimer > 0;
        let isBack = isStealthed;
        if (!isBack && mob.facing) {
          const dx = mob.x - px, dy = mob.y - py;
          const facingVecs = { 'E': [1, 0], 'SE': [0.7, 0.7], 'S': [0, 1], 'SW': [-0.7, 0.7], 'W': [-1, 0], 'NW': [-0.7, -0.7], 'N': [0, -1], 'NE': [0.7, -0.7] };
          const fv = facingVecs[mob.facing] || [0, 1];
          if (dx * fv[0] + dy * fv[1] > 0.15) isBack = true;
        }
        if (isBack) {
          m *= 2.8;
          mob.shadowMarkTimer = 6.0;
          this.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.8, text: '🗡️ BACKSTAB CRIT!', color: '#c084fc', size: 18 });
        } else {
          mob.shadowMarkTimer = 4.0;
        }
      }
      if (skill.execute && mob.maxHp && mob.hp <= mob.maxHp * skill.execute[0]) m *= skill.execute[1];
      if (skill.furyBonus) {
        const missingHp = Math.max(0, 1 - (player.hp / Math.max(1, player.maxHp)));
        m *= 1 + skill.furyBonus * missingHp;
      }
      if (skill.shatter && mob.chillTimer > 0) m *= skill.shatter;
      const before = mob.hp;
      if (skill.burn) { mob.burnTimer = skill.burn; mob.burnDmg = Math.max(mob.burnDmg || 0, Math.round(player.dmg * 0.2)); }
      if (skill.chill) mob.chillTimer = Math.max(mob.chillTimer || 0, skill.chill);
      if (skill.poisonStacks) {
        mob.poisonStacks = Math.min(10, (mob.poisonStacks || 0) + skill.poisonStacks);
        mob.poisonTimer = Math.max(mob.poisonTimer || 0, skill.poison || 6.0);
        mob.poisonDmg = Math.max(mob.poisonDmg || 0, Math.round(player.dmg * 0.12 * mob.poisonStacks));
        this.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.6, text: `🧪 POISON x${mob.poisonStacks}`, color: '#4ade80' });
      } else if (skill.poison) {
        mob.poisonTimer = skill.poison;
        mob.poisonDmg = Math.max(mob.poisonDmg || 0, Math.round(player.dmg * 0.15));
      }
      if (skill.staticCharge) {
        mob.staticCharge = skill.staticCharge;
        this.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.6, text: '⚡ STATIC', color: '#facc15' });
      }
      applySkillDamage(mob, Math.round(player.dmg * m), true);
      dealt += Math.max(0, before - Math.max(0, mob.hp));
      const stillUp = mob.state !== 'dead' && mob.hp > 0;
      if (stillUp && skill.scorch) {
        mob.scorchStacks = Math.min(SCORCH_MAX, (mob.scorchStacks || 0) + skill.scorch);
        mob.scorchTimer = SCORCH_SECONDS;
      }
      if (stillUp && skill.frost && !(mob.frozenTimer > 0)) {
        mob.frostStacks = (mob.frostStacks || 0) + skill.frost;
        mob.frostTimer = FROST_SECONDS;
        mob.chillTimer = Math.max(mob.chillTimer || 0, 2);
        if (mob.frostStacks >= FROST_TO_FREEZE) {
          mob.frostStacks = 0;
          mob.frozenTimer = mob.isBoss ? BOSS_FREEZE_SECONDS : FREEZE_SECONDS;
          mob.frozenKind = 'ice';
          say(mob.x, mob.y, '❄️ FROZEN', '#67e8f9', 16);
        }
      }
      if (stillUp && skill.stasis) {
        mob.frozenTimer = Math.max(mob.frozenTimer || 0, mob.isBoss ? skill.stasis * 0.4 : skill.stasis);
        mob.frozenKind = 'time';
      }
      if (stillUp && skill.stun) mob.attackCooldown = Math.max(mob.attackCooldown || 0, skill.stun);
      if (stillUp && shatterStun) mob.attackCooldown = Math.max(mob.attackCooldown || 0, shatterStun);
      if (stillUp && skill.fracture) {
        const cracks = mob.fractureUntil > Date.now() ? mob.fracture || 0 : 0;
        mob.fracture = Math.min(FRACTURE_MAX, cracks + skill.fracture);
        mob.fractureUntil = Date.now() + FRACTURE_SECONDS * 1000;
      }
      if (stillUp && skill.doom && !(mob.doom && mob.doom.until > Date.now())) {
        const brand = { owner: player.id, stored: 0, share: skill.doom.share, until: Date.now() + skill.doom.delay * 1000 };
        mob.doom = brand;
        emit({ shape: 'doom', x: mob.x, y: mob.y, radius: 0.9, duration: skill.doom.delay, followMob: mob.id }, false);
        later(skill.doom.delay, () => burstDoom(mob, brand));
      }
      if (skill.souls) gainSouls(skill.souls);
      else if (!stillUp && isSoulCard) gainSouls(1);
      // Conductor: lightning forks from a marked target into the marked enemies around it
      if (skill.fork && conductNow > 0) {
        const forks = alive()
          .filter(o => o !== mob && o.conductTimer > 0 && (o.conduct || 0) > 0 && Math.hypot(o.x - mob.x, o.y - mob.y) <= CONDUCT_FORK_RANGE)
          .sort((a, b) => Math.hypot(a.x - mob.x, a.y - mob.y) - Math.hypot(b.x - mob.x, b.y - mob.y))
          .slice(0, CONDUCT_FORK_MAX);
        if (forks.length) {
          emit({ quiet: true, shape: 'chain', x: mob.x, y: mob.y, startX: mob.x, startY: mob.y, points: forks.map(o => ({ x: o.x, y: o.y })) }, false);
          const forkDmg = Math.round(player.dmg * skill.dmgMult * mult * CONDUCT_FORK_SHARE * conductNow);
          for (const o of forks) {
            this.applyDamageToMob(player, o, forkDmg, false);
            say(o.x, o.y, `⚡ ARC -${forkDmg}`, '#fde047', 14);
          }
        }
      }
      // Thunderclap: the thunder arrives late. The marks are spent and the target booms after a beat
      if (skill.clap && conductNow > 0) {
        mob.conduct = 0;
        const cx = mob.x, cy = mob.y;
        say(cx, cy, `🌩️ THUNDER x${conductNow}`, '#facc15', 15);
        later(skill.clap.delay, () => {
          emit({ shape: 'nova', x: cx, y: cy, radius: skill.clap.r, burst: true }, false);
          const clapDmg = Math.round(player.dmg * skill.clap.mult * conductNow);
          for (const o of within(cx, cy, skill.clap.r)) this.applyDamageToMob(player, o, clapDmg, false);
          say(cx, cy, `🌩️ THUNDERCLAP -${clapDmg}`, '#fef08a', 18);
        });
      }
      // mark the target (after the fork/clap so a fresh mark never feeds its own cast)
      if (stillUp && skill.conduct) {
        const held = mob.conductTimer > 0 ? (mob.conduct || 0) : 0;
        mob.conduct = Math.min(CONDUCT_MAX, held + skill.conduct);
        mob.conductTimer = CONDUCT_SECONDS;
        say(mob.x, mob.y - 0.2, `⚡ CONDUCTOR x${mob.conduct}`, '#facc15', 12 + mob.conduct);
      }
      if (skill.knock && mob.state !== 'dead') {
        const d = Math.hypot(mob.x - fromX, mob.y - fromY) || 1;
        const kx = mob.x + ((mob.x - fromX) / d) * skill.knock;
        const ky = mob.y + ((mob.y - fromY) / d) * skill.knock;
        if (!this.isColliding(kx, ky, zone)) { mob.x = kx; mob.y = ky; }
      }
    };
    const settleLeech = () => {
      if (!skill.leech || dealt <= 0) return;
      const heal = Math.min(Math.round(player.maxHp * 0.1), Math.max(1, Math.round(dealt * skill.leech)));
      player.hp = Math.min(player.maxHp, player.hp + heal);
      this.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 0.6, text: `+${heal} HP`, color: '#4ade80' });
      dealt = 0;
    };
    // Later waves run on a timer; skip them if the hero left, died or changed instance
    const later = (seconds, fn) => setTimeout(() => {
      const p = this.players.get(player.id);
      if (!p || p !== player || p.isDead || p.zone !== zone || (p.dungeonInstanceId || null) !== instanceId) return;
      this.runAs(player.id, () => { fn(); settleLeech(); });
    }, seconds * 1000);

    // Aim: toward the target point (or the dash direction for movement skills)
    const rawTx = Number.isFinite(skillData.targetX) ? skillData.targetX : px;
    const rawTy = Number.isFinite(skillData.targetY) ? skillData.targetY : py;
    const td = Math.hypot(rawTx - px, rawTy - py);
    const dir = td > 0.3 && !skill.isDash
      ? { normX: (rawTx - px) / td, normY: (rawTy - py) / td }
      : computeDashVector();
    const range = skill.range || 7;
    const aimX = td > range ? px + dir.normX * range : (td > 0.3 ? rawTx : px + dir.normX * Math.min(range, 3));
    const aimY = td > range ? py + dir.normY * range : (td > 0.3 ? rawTy : py + dir.normY * Math.min(range, 3));

    // Walk from (x0, y0) along (nx, ny) until a wall, returning the furthest free point
    const ray = (x0: number, y0: number, nx: number, ny: number, len: number, radius: number = 0.35) => {
      let ex = x0, ey = y0;
      for (let d = 0.25; d <= len; d += 0.25) {
        const tx = x0 + nx * d, ty = y0 + ny * d;
        if (this.isColliding(tx, ty, zone, radius)) break;
        ex = tx; ey = ty;
      }
      return { x: ex, y: ey };
    };
    // Move the hero along dir (a shadow's copy only measures the path)
    const travel = (len) => {
      const { x: nx, y: ny } = ray(px, py, dir.normX, dir.normY, len);
      if (isShadow) return { x: nx, y: ny };
      player.x = nx; player.y = ny;
      player.targetX = null; player.targetY = null;
      player.facing = this.calculateFacing(px, py, nx, ny);
      return { x: nx, y: ny };
    };

    // Rune Knight glyphs: carved at a spot, armed after a beat, burst when an
    // enemy steps on them (or all at once on Invocation)
    const burstRune = (g, mult) => {
      if (g.spent) return;
      g.spent = true;
      const sk = g.skill;
      emit({ shape: 'rune', burst: true, kind: sk.kind, skillId: sk.id, x: g.x, y: g.y, radius: sk.r * (mult > 1 ? 1.15 : 1), clearObj: g.id }, false);
      // the ground stays inscribed for a while, burning anything that walks in
      if (sk.dot && sk.dot.linger) {
        const sr = sk.r * 0.85;
        emit({ shape: 'rune', scar: true, kind: sk.kind, skillId: sk.id, x: g.x, y: g.y, radius: sr, duration: sk.dot.linger }, false);
        for (let k = 1; k * sk.dot.every <= sk.dot.linger + 0.01; k++) later(k * sk.dot.every, () => runeDot(sk, g.x, g.y, sr));
      }
      for (const m of within(g.x, g.y, sk.r * (mult > 1 ? 1.15 : 1))) {
        if (sk.stun) m.attackCooldown = Math.max(m.attackCooldown || 0, sk.stun);
        if (sk.stun) m.chillTimer = Math.max(m.chillTimer || 0, sk.stun);
        if (sk.chill) m.chillTimer = Math.max(m.chillTimer || 0, sk.chill);
        const before = m.hp;
        applySkillDamage(m, Math.round(player.dmg * sk.dmgMult * mult), true);
        dealt += Math.max(0, before - Math.max(0, m.hp));
      }
    };
    // Glyph damage over time (sk.dot): a tick of rune damage on everything in the glyph's area.
    // Scales with the card level like the burst does (dmgMult over the base dmg).
    const runeDot = (sk, x, y, r) => {
      const lvl = sk.dmg ? (sk.dmgMult || sk.dmg) / sk.dmg : 1;
      const dmg = Math.max(1, Math.round(player.dmg * sk.dot.mult * lvl));
      for (const m of within(x, y, r)) {
        this.applyDamageToMob(player, m, dmg, false, true);
        if (m.state === 'dead' || m.hp <= 0) continue;
        if (sk.kind === 'frost') m.chillTimer = Math.max(m.chillTimer || 0, 1.0);
        if (sk.kind === 'bind') m.chillTimer = Math.max(m.chillTimer || 0, 0.6);
      }
    };
    const placeRune = (sk, x, y, first) => {
      const nowR = Date.now();
      const live = (player.runeGlyphs || []).filter(g => !g.spent && g.until > nowR && g.zone === zone && g.instanceId === instanceId);
      while (live.length >= RUNE_MAX) {
        const old = live.shift();
        old.spent = true;
        emit({ shape: 'rune', clearObj: old.id, x: old.x, y: old.y, radius: 0 }, false);
      }
      const g = { id: 'g' + (++spObjSeq), skill: sk, x, y, until: nowR + sk.dur * 1000, armAt: nowR + RUNE_ARM_MS, spent: false, zone, instanceId };
      live.push(g);
      player.runeGlyphs = live;
      emit({ shape: 'rune', kind: sk.kind, skillId: sk.id, name: sk.name, x, y, radius: sk.r, duration: sk.dur, objId: g.id }, first);
      const ticks = Math.ceil(sk.dur / RUNE_POLL);
      for (let i = 1; i <= ticks; i++) {
        later(i * RUNE_POLL, () => {
          if (g.spent) return;
          if (Date.now() >= g.until) { g.spent = true; return; }
          // armed: everything walking into the glyph's area takes rune damage over time
          if (sk.dot && Date.now() >= g.armAt && i % Math.max(1, Math.round(sk.dot.every / RUNE_POLL)) === 0) runeDot(sk, g.x, g.y, sk.r);
          if (Date.now() >= g.armAt && within(g.x, g.y, RUNE_TRIGGER_R).length) burstRune(g, 1);
        });
      }
    };

    // ---- Dragoon Lightning Rods: planted lances the sky keeps striking (player.dgRods)
    const liveRods = () => {
      const now = Date.now();
      player.dgRods = (player.dgRods || []).filter(rd => rd.until > now && rd.zone === zone && rd.instanceId === instanceId);
      return player.dgRods;
    };
    const rodDamage = (m, mult, stun = 0) => {
      this.applyDamageToMob(player, m, Math.max(1, Math.round(player.dmg * mult)), false, true);
      if (stun && m.state !== 'dead' && m.hp > 0) m.attackCooldown = Math.max(m.attackCooldown || 0, stun);
    };
    const clearRod = (rod) => emit({ shape: 'rod', clearObj: rod.objId, radius: 0 }, false);
    const strikeRod = (rod) => {
      const rods = liveRods();
      const i = rods.indexOf(rod);
      if (i < 0) return;
      emit({ shape: 'rodStrike', x: rod.x, y: rod.y, radius: DG_ROD_R, duration: 0.5 }, false);
      within(rod.x, rod.y, DG_ROD_R).forEach(m => rodDamage(m, DG_ROD_MULT));
      // the arc fence to the next rod planted after this one
      const next = rods[i + 1];
      if (next && Math.hypot(next.x - rod.x, next.y - rod.y) <= DG_FENCE_RANGE) {
        emit({ shape: 'fence', startX: rod.x, startY: rod.y, x: next.x, y: next.y, duration: 0.55 }, false);
        for (const m of alive()) {
          if (this.distToSegment(m.x, m.y, rod.x, rod.y, next.x, next.y) > DG_FENCE_W) continue;
          rodDamage(m, DG_FENCE_MULT);
          if (m.state !== 'dead') m.chillTimer = Math.max(m.chillTimer || 0, 0.8);
        }
      }
    };
    // thrown: the lance flew there (Storm Lance), so it does not drop out of the sky
    const plantRod = (x, y, thrown = false) => {
      if (isShadow) return;
      const rods = liveRods();
      while (rods.length >= DG_ROD_MAX) clearRod(rods.shift());
      const rod = { objId: 'r' + (++spObjSeq), x, y, until: Date.now() + DG_ROD_SECONDS * 1000, zone, instanceId };
      rods.push(rod);
      emit({ shape: 'rod', x, y, objId: rod.objId, duration: DG_ROD_SECONDS, ownerId: player.id, thrown }, false);
      for (let k = 1; k * DG_ROD_EVERY <= DG_ROD_SECONDS + 0.01; k++) later(k * DG_ROD_EVERY, () => strikeRod(rod));
    };
    // every rod picked is struck by a giant bolt at once and spent
    const overloadRods = (mult, pick = (rd) => true) => {
      const rods = liveRods();
      const spent = rods.filter(pick);
      if (!spent.length) return;
      say(spent[0].x, spent[0].y, `⚡ OVERLOAD x${spent.length}`, '#fde047', 17);
      for (const rod of spent) {
        emit({ shape: 'overload', x: rod.x, y: rod.y, radius: DG_OVERLOAD_R, duration: 0.9 }, false);
        clearRod(rod);
        within(rod.x, rod.y, DG_OVERLOAD_R).forEach(m => rodDamage(m, mult, 0.5));
      }
      player.dgRods = rods.filter(rd => !spent.includes(rd));
    };
    // each rod throws a bolt at the enemy nearest to it
    const rodArcs = (mult) => {
      for (const rod of liveRods()) {
        const m = nearest(rod.x, rod.y, DG_ARC_RANGE);
        if (!m) continue;
        emit({ shape: 'chain', x: m.x, y: m.y, startX: rod.x, startY: rod.y, points: [{ x: rod.x, y: rod.y }, { x: m.x, y: m.y }], fromRod: true, duration: 0.45 }, false);
        hit(m, mult, rod.x, rod.y);
      }
    };

    let spot = null; // where a lingering field (skill.field) settles
    switch (skill.spShape) {
      case 'aura': {
        // toggled on here; tickSpToggles pays the upkeep and strikes every frame after
        if (!player.spToggles) player.spToggles = {};
        player.spToggles[skill.id] = { skill, clock: 0 };
        emit({ x: px, y: py, radius: skill.r || 1.4, spin: !!skill.spin }, true);
        say(px, py, `${skill.icon || '✨'} ${skill.name.toUpperCase()} ON`, skill.color || '#ef4444', 16);
        break;
      }
      case 'rewind': {
        // back to the oldest sample within 'back' seconds
        const trail = player.timeTrail || [];
        const want = Date.now() - (skill.back || 3) * 1000;
        const past = trail.find(t => t.t >= want) || trail[0];
        if (past && !this.isColliding(past.x, past.y, zone)) {
          player.x = past.x; player.y = past.y;
          player.targetX = null; player.targetY = null;
          if (past.hp > player.hp) player.hp = Math.min(player.maxHp, past.hp);
        }
        emit({ startX: px, startY: py, x: player.x, y: player.y, radius: 1.2 }, true);
        say(player.x, player.y, '⏪ REWIND', '#fde68a', 17);
        player.timeTrail = [];
        break;
      }
      case 'nova':
      case 'buff': {
        emit({ x: px, y: py, radius: skill.r || 1.4 }, true);
        if (skill.provoke) {
          for (const m of within(px, py, skill.r)) {
            const nx = px + (m.x - px) * (1 - skill.provoke), ny = py + (m.y - py) * (1 - skill.provoke);
            if (!m.isBoss && !this.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
            m.targetPlayerId = player.id;
            m.state = 'chase';
          }
          say(px, py, '📯 CHALLENGE!', '#fde68a', 17);
        }
        if (skill.dmg) within(px, py, skill.r).forEach(m => hit(m));
        if (skill.reap) {
          // Devour: every Doom brand of this hero bursts now
          for (const m of alive()) if (m.doom && m.doom.owner === player.id) burstDoom(m, m.doom);
        }
        break;
      }
      case 'fault': {
        // the crack crawls forward a segment at a time; each enemy cracks once
        const n = skill.n || 5, step = skill.step || 1;
        const pts = [];
        for (let i = 1; i <= n; i++) pts.push(ray(px, py, dir.normX, dir.normY, i * step, 0.3));
        emit({ startX: px, startY: py, x: pts[n - 1].x, y: pts[n - 1].y, segs: pts, radius: skill.hit, every: skill.every, duration: n * skill.every + 0.7 }, true);
        const struck = new Set();
        pts.forEach((p, i) => later(i * skill.every, () => {
          for (const m of within(p.x, p.y, skill.hit)) {
            if (struck.has(m)) continue;
            struck.add(m);
            hit(m, 1, p.x, p.y);
          }
        }));
        break;
      }
      case 'spear': {
        if (recall && player.dgSpear) {
          // dive onto the planted lance
          const sp = player.dgSpear;
          player.dgSpear = null;
          player.x = sp.x; player.y = sp.y;
          player.targetX = null; player.targetY = null;
          player.facing = this.calculateFacing(px, py, sp.x, sp.y);
          emit({ dive: true, ownerId: player.id, startX: px, startY: py, x: sp.x, y: sp.y, radius: skill.diveR, clearObj: sp.objId }, false);
          say(sp.x, sp.y, skill.rod ? '⚡ LIGHTNING DIVE!' : '🐉 LANCE DIVE!', '#facc15', 17);
          within(sp.x, sp.y, skill.diveR).forEach(m => hit(m, skill.dive / (skill.dmgMult || 1), sp.x, sp.y));
          if (skill.rod) overloadRods(skill.dive * 0.6, (rd) => Math.hypot(rd.x - sp.x, rd.y - sp.y) < 1);
          const socket = this.io.sockets.sockets.get(player.id);
          if (socket) socket.emit('player_updated', player);
          break;
        }
        const end = ray(px, py, dir.normX, dir.normY, skill.len, 0.25);
        const objId = 's' + (++spObjSeq);
        emit({ startX: px, startY: py, x: end.x, y: end.y, width: skill.width, duration: skill.hold, objId, ownerId: player.id }, true);
        for (const m of alive()) {
          if (this.distToSegment(m.x, m.y, px, py, end.x, end.y) <= skill.width) hit(m);
        }
        if (!isShadow) player.dgSpear = { slot, skillId: skill.id, x: end.x, y: end.y, objId, until: Date.now() + skill.hold * 1000, zone, instanceId };
        if (skill.rod) plantRod(end.x, end.y, true);
        break;
      }
      case 'jump': {
        // up into the clouds (untouchable), down onto the cursor a moment later
        const land = ray(px, py, dir.normX, dir.normY, Math.min(range, Math.max(1, Math.hypot(aimX - px, aimY - py))), 0.35);
        if (!isShadow) player.airborneUntil = Date.now() + skill.air * 1000;
        emit({ startX: px, startY: py, x: land.x, y: land.y, radius: skill.r, air: skill.air, duration: skill.air + 0.5 }, true);
        later(skill.air, () => {
          if (!isShadow) {
            player.x = land.x; player.y = land.y;
            player.targetX = null; player.targetY = null;
            player.airborneUntil = 0;
            const socket = this.io.sockets.sockets.get(player.id);
            if (socket) socket.emit('player_updated', player);
          }
          emit({ landed: true, x: land.x, y: land.y, radius: skill.r }, false);
          within(land.x, land.y, skill.r).forEach(m => hit(m, 1, land.x, land.y));
          if (skill.overload) overloadRods(skill.overload);
          if (skill.rod) plantRod(land.x, land.y);
        });
        break;
      }
      case 'wall': {
        // a wall of fire across the aim point, at right angles to it
        const half = (skill.len || 5) / 2, qx = -dir.normY, qy = dir.normX;
        spot = { x0: aimX - qx * half, y0: aimY - qy * half, x1: aimX + qx * half, y1: aimY + qy * half };
        emit({ startX: spot.x0, startY: spot.y0, x: spot.x1, y: spot.y1, width: 1, duration: skill.field ? skill.field.dur : 0.8 }, true);
        for (const m of alive()) {
          if (this.distToSegment(m.x, m.y, spot.x0, spot.y0, spot.x1, spot.y1) <= 1) hit(m, 1, aimX, aimY);
        }
        break;
      }
      case 'rune': {
        const at = ray(px, py, dir.normX, dir.normY, Math.hypot(aimX - px, aimY - py), 0.3);
        placeRune(skill, at.x, at.y, true);
        break;
      }
      case 'rage': {
        // Grave Frenzy: the minions (and any raised while it lasts) fight in a killing rage
        const R = skill.rage;
        if (!isShadow) player.minionRage = { until: Date.now() + R.dur * 1000, dmg: R.dmg, aspd: R.aspd, crit: R.crit, critMult: R.critMult };
        const mins = (player.minions || []).filter(m => m.until > Date.now());
        emit({ x: px, y: py, radius: skill.r || 3, points: mins.map(m => ({ x: m.x, y: m.y })) }, true);
        say(px, py, mins.length ? `☠️ GRAVE FRENZY x${mins.length}` : '☠️ GRAVE FRENZY', '#a3e635', 17);
        break;
      }
      case 'gravebomb': {
        // Corpse Detonation: every minion goes up in grave fire and is spent
        const nowB = Date.now();
        const mins = (player.minions || []).filter(m => m.until > nowB && m.zone === zone && m.instanceId === instanceId);
        emit({ x: px, y: py, radius: skill.r, points: mins.map(m => ({ x: m.x, y: m.y })) }, true);
        if (!mins.length) { say(px, py, 'No minions to detonate', '#94a3b8', 14); break; }
        say(px, py, `💥 CORPSE DETONATION x${mins.length}`, '#4ade80', 17);
        if (!isShadow) player.minions = player.minions.filter(m => !mins.includes(m));
        mins.forEach((m, i) => {
          const bx = m.x, by = m.y;
          later(0.08 + i * 0.07, () => {
            emit({ shape: 'gravebomb', burst: true, x: bx, y: by, radius: skill.r }, false);
            within(bx, by, skill.r).forEach(o => hit(o, 1, bx, by));
          });
        });
        break;
      }
      case 'raise': {
        // Raise the Fallen: the dead near the cursor climb back up as the Gravelord's minions
        const picks = this.takeCorpses(zone, instanceId, aimX, aimY, skill.r, skill.n);
        const risen = picks.length ? picks : [{ x: aimX, y: aimY, type: 'skeleton', hue: 0, scale: 1, thrall: true }];
        emit({ x: aimX, y: aimY, radius: skill.r, points: risen.map(c => ({ x: c.x, y: c.y })), thrall: !picks.length }, true);
        say(aimX, aimY, picks.length ? `☠️ RISE! x${picks.length}` : '☠️ GRAVE THRALL', '#4ade80', 16);
        if (!isShadow) for (const c of risen) this.raiseMinion(player, c, skill);
        for (const c of risen) within(c.x, c.y, 1.3).forEach(m => hit(m, 1, c.x, c.y));
        break;
      }
      case 'invoke': {
        const nowI = Date.now();
        const glyphs = (player.runeGlyphs || []).filter(g => !g.spent && g.until > nowI && g.zone === zone && g.instanceId === instanceId);
        emit({ x: px, y: py, radius: skill.r, points: glyphs.map(g => ({ x: g.x, y: g.y })) }, true);
        if (!glyphs.length) {
          say(px, py, 'No glyphs carved', '#94a3b8', 14);
          within(px, py, 2).forEach(m => hit(m, 0.6));
          break;
        }
        say(px, py, `✴️ INVOCATION x${glyphs.length}`, '#a3e635', 17);
        glyphs.forEach((g, i) => later(i * 0.08, () => burstRune(g, skill.dmgMult)));
        break;
      }
      case 'ricochet': {
        // the shield bounces from enemy to enemy, then flies home
        const visited = new Set();
        const points = [];
        const atAim = nearest(aimX, aimY, 2.5);
        let cur = atAim && Math.hypot(atAim.x - px, atAim.y - py) <= range ? atAim : nearest(px, py, range);
        while (cur && points.length < skill.n) {
          visited.add(cur);
          const from = points.length ? points[points.length - 1] : { x: px, y: py };
          points.push({ x: cur.x, y: cur.y });
          hit(cur, 1, from.x, from.y);
          cur = nearest(cur.x, cur.y, skill.jump || 4, visited);
        }
        emit({ startX: px, startY: py, x: px, y: py, bounces: points, duration: 0.25 + points.length * 0.14 }, true);
        if (points.length && skill.shieldPerHit && !isShadow) {
          const v = Math.round(player.maxHp * skill.shieldPerHit * points.length);
          player.shieldHp = (player.shieldHp || 0) + v;
          say(px, py, `🛡️ +${v} SHIELD`, '#fde68a', 14);
        }
        break;
      }
      case 'phantom': {
        // a phantom blade leaps from enemy to enemy, a new one each slash
        emit({ x: px, y: py, radius: 1.2, duration: skill.n * skill.every + 0.5 }, true);
        let cx = px, cy = py, last = null;
        for (let i = 0; i < skill.n; i++) {
          later(0.1 + i * skill.every, () => {
            const prey = nearest(cx, cy, skill.range, last ? new Set([last]) : null) || (last && last.state !== 'dead' ? last : null);
            if (!prey) return;
            emit({ slash: true, startX: cx, startY: cy, x: prey.x, y: prey.y, wave: i }, false);
            hit(prey, 1, cx, cy);
            cx = prey.x; cy = prey.y; last = prey;
          });
        }
        break;
      }
      case 'hurl': {
        // grab the nearest enemy and throw it at the cursor; bosses are only slammed in place
        const victim = nearest(px, py, skill.range);
        if (!victim) {
          emit({ startX: px, startY: py, x: px + dir.normX, y: py + dir.normY, radius: 1, miss: true }, true);
          say(px, py, 'Nothing to grab', '#94a3b8', 14);
          break;
        }
        const heavy = !!victim.isBoss;
        // thrown toward the cursor itself (aimX/aimY are clamped to the short grab range)
        const to = ray(victim.x, victim.y, dir.normX, dir.normY, Math.min(skill.throw, Math.max(2, Math.hypot(rawTx - victim.x, rawTy - victim.y))), 0.35);
        const land = heavy ? { x: victim.x, y: victim.y } : to;
        emit({ startX: victim.x, startY: victim.y, x: land.x, y: land.y, radius: skill.land.r, heavy, duration: 0.85 }, true);
        if (!heavy) { victim.x = land.x; victim.y = land.y; }
        victim.attackCooldown = Math.max(victim.attackCooldown || 0, 0.5);
        later(0.35, () => {
          hit(victim, 1, px, py);
          within(land.x, land.y, skill.land.r).filter(m => m !== victim).forEach(m => hit(m, skill.land.mult, land.x, land.y));
        });
        break;
      }
      case 'banner': {
        if (isShadow) break;
        const at = ray(px, py, dir.normX, dir.normY, Math.hypot(aimX - px, aimY - py), 0.3);
        if (player.banner) emit({ shape: 'banner', clearObj: player.banner.id, x: player.banner.x, y: player.banner.y, radius: 0 }, false);
        const b = { id: 'b' + (++spObjSeq), x: at.x, y: at.y, r: skill.r, bonus: skill.bonus, until: Date.now() + skill.dur * 1000, zone, instanceId };
        player.banner = b;
        emit({ x: b.x, y: b.y, radius: b.r, duration: skill.dur, objId: b.id }, true);
        within(b.x, b.y, b.r).forEach(m => hit(m, 1, b.x, b.y));
        const ticks = Math.floor(skill.dur / skill.every);
        for (let i = 1; i <= ticks; i++) {
          later(i * skill.every, () => {
            if (player.banner !== b) return;
            within(b.x, b.y, b.r).forEach(m => hit(m, skill.tick, b.x, b.y));
            if (Math.hypot(player.x - b.x, player.y - b.y) <= b.r) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * skill.regen * skill.every);
          });
        }
        break;
      }
      case 'rally': {
        const b = this.ownBanner(player);
        let cx = px, cy = py;
        if (b && !isShadow) {
          player.x = b.x; player.y = b.y;
          player.targetX = null; player.targetY = null;
          player.facing = this.calculateFacing(px, py, b.x, b.y);
          cx = b.x; cy = b.y;
          const socket = this.io.sockets.sockets.get(player.id);
          if (socket) socket.emit('player_updated', player);
        }
        emit({ startX: px, startY: py, x: cx, y: cy, radius: skill.r, leap: !!b }, true);
        if (b) say(cx, cy, '🚩 RALLY!', '#fbbf24', 17);
        within(cx, cy, skill.r).forEach(m => hit(m, 1, cx, cy));
        break;
      }
      case 'boomerang': {
        // axes fly out, then turn and come back to wherever the hero is now
        const n = skill.n || 2, base = Math.atan2(dir.normY, dir.normX), w = skill.width || 1;
        const axes = [];
        for (let i = 0; i < n; i++) {
          const ang = base + (n > 1 ? (i / (n - 1) * 2 - 1) * skill.spread : 0);
          const end = ray(px, py, Math.cos(ang), Math.sin(ang), skill.len, 0.3);
          axes.push({ ex: end.x, ey: end.y });
        }
        emit({ x: px, y: py, startX: px, startY: py, axes, width: w, duration: skill.dur, followId: player.id }, true);
        const pass = (back) => {
          const hx = player.x, hy = player.y;
          const struck = new Set();
          for (const a of axes) {
            for (const m of alive()) {
              if (struck.has(m)) continue;
              const d = back ? this.distToSegment(m.x, m.y, a.ex, a.ey, hx, hy) : this.distToSegment(m.x, m.y, px, py, a.ex, a.ey);
              if (d <= w) { struck.add(m); hit(m, 1, back ? a.ex : px, back ? a.ey : py); }
            }
          }
        };
        later(skill.dur * 0.2, () => pass(false));
        later(skill.dur * 0.8, () => pass(true));
        break;
      }
      case 'firebird': {
        // a teardrop loop: out toward the cursor, sweeping round, and home
        const L = skill.len, N = 24, path = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N, fwd = Math.sin(t * Math.PI) * L, lat = Math.sin(t * Math.PI * 2) * L * 0.35;
          path.push({ x: px + dir.normX * fwd - dir.normY * lat, y: py + dir.normY * fwd + dir.normX * lat });
        }
        emit({ x: px, y: py, path, radius: skill.r, duration: skill.dur }, true);
        const ticks = Math.round(skill.dur / skill.every);
        for (let i = 1; i <= ticks; i++) {
          later(i * skill.every, () => {
            const p = path[Math.min(N, Math.round((i / ticks) * N))];
            within(p.x, p.y, skill.r).forEach(m => hit(m, 1, p.x, p.y));
          });
        }
        break;
      }
      case 'sacrifice': {
        // burn your own life into the blast; it grows with what you spent, then regrows
        const spent = isShadow ? 0 : Math.round(player.hp * skill.burnHp);
        if (spent) player.hp = Math.max(1, player.hp - spent);
        const boost = 1 + 4 * spent / Math.max(1, player.maxHp);
        emit({ x: px, y: py, radius: skill.r, spent }, true);
        if (spent) say(px, py, `🔥 SACRIFICE -${spent} HP`, '#f97316', 17);
        within(px, py, skill.r).forEach(m => hit(m, boost));
        if (skill.regrow && spent) {
          const per = spent * skill.regrow / 10;
          for (let i = 1; i <= 10; i++) later(i * 0.5, () => { player.hp = Math.min(player.maxHp, player.hp + per); });
        }
        break;
      }
      case 'shuriken': {
        const width = skill.width || 0.8;
        if (recall) {
          // every star out there (the shadow's too) flies back to the hero, cutting what it passes
          const out = player.nbStars;
          player.nbStars = null;
          const hx = player.x, hy = player.y;
          emit({ recall: true, ownerId: player.id, x: hx, y: hy, stars: out.stars }, false);
          for (const s of out.stars) {
            for (const m of alive()) {
              if (this.distToSegment(m.x, m.y, s.x, s.y, hx, hy) <= width) hit(m, skill.back || 1, s.x, s.y);
            }
          }
          say(hx, hy, '🌀 RECALL!', '#c084fc', 15);
          break;
        }
        // a fan of stars toward the cursor; each stops at its spot (or a wall) and hovers there
        const n = skill.n || 5;
        const reach = Math.min(range, Math.max(3, Math.hypot(aimX - px, aimY - py)));
        const base = Math.atan2(dir.normY, dir.normX), step = n > 1 ? (skill.spread * Math.PI / 180) / (n - 1) : 0;
        const stars = [];
        for (let i = 0; i < n; i++) {
          const ang = base + (i - (n - 1) / 2) * step;
          const end = ray(px, py, Math.cos(ang), Math.sin(ang), reach, 0.2);
          stars.push({ x: end.x, y: end.y });
          for (const m of alive()) {
            if (this.distToSegment(m.x, m.y, px, py, end.x, end.y) <= width) hit(m);
          }
        }
        if (isShadow) {
          // the shadow's stars come back with the hero's on recall
          if (player.nbStars) player.nbStars.stars.push(...stars);
        } else {
          player.nbStars = { slot, skillId: skill.id, stars, until: Date.now() + (skill.hold || 5) * 1000, zone, instanceId };
        }
        emit({ startX: px, startY: py, x: aimX, y: aimY, stars, ownerId: player.id, duration: skill.hold || 5 }, true);
        break;
      }
      case 'smoke': {
        // anyone standing in the cloud makes monster attacks miss (see smokeMissChance)
        this.smokeClouds.push({ zone, instanceId, x: px, y: py, r: skill.r, miss: skill.miss, until: Date.now() + skill.dur * 1000 });
        emit({ x: px, y: py, radius: skill.r, duration: skill.dur }, true);
        if (skill.dmg) within(px, py, skill.r).forEach(m => hit(m));
        if (!isShadow) say(px, py, '💨 SMOKE BOMB', '#cbd5e1', 15);
        break;
      }
      case 'shadow': {
        const spotAt = ray(px, py, dir.normX, dir.normY, Math.hypot(aimX - px, aimY - py), 0.3);
        player.nbShadow = { x: spotAt.x, y: spotAt.y, mirror: skill.mirror, until: Date.now() + skill.dur * 1000, zone, instanceId };
        emit({ startX: px, startY: py, x: spotAt.x, y: spotAt.y, radius: skill.r, duration: skill.dur }, true);
        if (skill.dmg) within(spotAt.x, spotAt.y, skill.r).forEach(m => hit(m, 1, spotAt.x, spotAt.y));
        say(spotAt.x, spotAt.y, '👤 SHADOW', '#a855f7', 15);
        break;
      }
      case 'orbit': {
        // stars circle the hero (or stay put around the shadow) and cut on every tick
        const centre = () => (isShadow ? { x: px, y: py } : { x: player.x, y: player.y });
        emit({ x: px, y: py, radius: skill.r, n: skill.n, duration: skill.dur, followId: isShadow ? null : player.id }, true);
        const spin = () => {
          const c = centre();
          within(c.x, c.y, skill.r).forEach(m => hit(m, 1, c.x, c.y));
        };
        spin();
        const ticks = Math.round(skill.dur / skill.every);
        for (let i = 1; i < ticks; i++) later(i * skill.every, spin);
        break;
      }
      case 'orbs': {
        // n storm orbs fan out ahead (±spread rad) and drift len tiles over dur s,
        // stopping at walls, shocking everything within r of each every `every` s
        const n = skill.n || 2, base = Math.atan2(dir.normY, dir.normX);
        const orbs = [];
        for (let i = 0; i < n; i++) {
          const ang = base + (n > 1 ? (i / (n - 1) * 2 - 1) * skill.spread : 0);
          const end = ray(px, py, Math.cos(ang), Math.sin(ang), skill.len, 0.3);
          orbs.push({ sx: px, sy: py, ex: end.x, ey: end.y });
        }
        emit({ x: px, y: py, orbs, radius: skill.r, duration: skill.dur }, true);
        const ticks = Math.round(skill.dur / skill.every);
        const shock = (i) => {
          const k = i / ticks;
          for (const o of orbs) {
            const ox = o.sx + (o.ex - o.sx) * k, oy = o.sy + (o.ey - o.sy) * k;
            within(ox, oy, skill.r).forEach(m => hit(m, 1, ox, oy));
          }
        };
        for (let i = 1; i <= ticks; i++) later(i * skill.every, () => shock(i));
        break;
      }
      case 'detonate': {
        emit({ x: px, y: py, radius: skill.r || 7.0 }, true);
        let detonatedCount = 0;
        for (const m of within(px, py, skill.r || 7.0)) {
          const stacks = m.poisonStacks || (m.poisonTimer > 0 ? 2 : 0);
          if (stacks > 0) {
            const detonateMult = (skill.dmgMult || 2.2) + (stacks * 0.75);
            const detonateDmg = Math.round(player.dmg * detonateMult);
            applySkillDamage(m, detonateDmg, true);
            m.poisonStacks = 0;
            m.poisonTimer = 0;
            m.poisonDmg = 0;
            detonatedCount++;
            this.emitZone(zone, 'floating_text', { x: m.x, y: m.y - 0.8, text: `💥 DETONATE! -${detonateDmg}`, color: '#22c55e', size: 18 });
          }
        }
        if (detonatedCount > 0) {
          this.emitZone(zone, 'floating_text', { x: px, y: py - 0.8, text: `☣️ DETONATED ${detonatedCount} ENEMIES!`, color: '#86efac', size: 16 });
        }
        break;
      }
      case 'blast': {
        spot = { x: aimX, y: aimY };
        emit({ x: aimX, y: aimY, startX: px, startY: py, radius: skill.r }, true);
        within(aimX, aimY, skill.r).forEach(m => hit(m, 1, aimX, aimY));
        if (skill.rod) plantRod(aimX, aimY);
        break;
      }
      case 'pull': {
        spot = { x: aimX, y: aimY };
        const isDreadRoar = skill.id === 'sp_void_grasp';
        const pullCenterX = isDreadRoar ? px : aimX;
        const pullCenterY = isDreadRoar ? py : aimY;
        emit({ x: pullCenterX, y: pullCenterY, radius: skill.r }, true);
        if (isDreadRoar) say(px, py, '💀 MOCKING DREAD ROAR!', '#c084fc', 17);
        for (const m of within(pullCenterX, pullCenterY, skill.r)) {
          const nx = pullCenterX + (m.x - pullCenterX) * (isDreadRoar ? 0.25 : 0.3);
          const ny = pullCenterY + (m.y - pullCenterY) * (isDreadRoar ? 0.25 : 0.3);
          if (!this.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
          if (isDreadRoar) {
            m.attackCooldown = Math.max(m.attackCooldown || 0, 1.2);
            m.targetPlayerId = player.id;
          }
          hit(m, 1, pullCenterX, pullCenterY);
        }
        break;
      }
      case 'cone': {
        emit({ x: px, y: py, dirX: dir.normX, dirY: dir.normY, range: skill.range, arc: skill.arc }, true);
        if (skill.id === 'sp_dread_wave') say(px, py, '🪓 CATACLYSMIC AXE DRAG!', '#f43f5e', 17);
        const half = (skill.arc * Math.PI) / 360;
        for (const m of within(px, py, skill.range)) {
          const d = Math.hypot(m.x - px, m.y - py);
          if (d < 0.5) { hit(m); continue; }
          const cos = ((m.x - px) * dir.normX + (m.y - py) * dir.normY) / d;
          if (Math.acos(Math.max(-1, Math.min(1, cos))) <= half) {
            hit(m);
            if (skill.id === 'sp_dread_wave' && m.state !== 'dead') {
              m.burnTimer = Math.max(m.burnTimer || 0, 3.5);
              m.burnDmg = Math.max(m.burnDmg || 0, Math.round(player.dmg * 0.28));
            }
          }
        }
        break;
      }
      case 'line': {
        const ex = px + dir.normX * skill.len, ey = py + dir.normY * skill.len;
        emit({ startX: px, startY: py, x: ex, y: ey, width: skill.width }, true);
        if (skill.id === 'sp_abyss_cleave') say(px, py, '🪓 ABYSSAL GUILLOTINE!', '#c084fc', 17);
        for (const m of alive()) {
          if (this.distToSegment(m.x, m.y, px, py, ex, ey) <= skill.width) hit(m);
        }
        if (skill.id === 'sp_abyss_cleave') {
          later(0.32, () => {
            emit({ startX: px, startY: py, x: ex, y: ey, width: skill.width * 1.15, wave: 1 }, false);
            for (const m of alive()) {
              if (this.distToSegment(m.x, m.y, px, py, ex, ey) <= skill.width * 1.15) hit(m, 0.45);
            }
          });
        }
        break;
      }
      case 'strike': {
        // Prefer the enemy at the aim point, else the closest one in reach
        const atAim = nearest(aimX, aimY, 2.5);
        const target = atAim && Math.hypot(atAim.x - px, atAim.y - py) <= skill.range + 1 ? atAim : nearest(px, py, skill.range);
        const tx = target ? target.x : aimX, ty = target ? target.y : aimY;
        emit({ startX: px, startY: py, x: tx, y: ty, radius: 0.9 }, true);
        if (target) {
          if (skill.id === 'sp_soul_rend') {
            const isExec = target.maxHp && target.hp <= target.maxHp * 0.45;
            say(target.x, target.y, isExec ? '🪓 GUILLOTINE EXECUTE!' : '🪓 BEHEADING!', '#f43f5e', isExec ? 19 : 17);
            hit(target, isExec ? 1.35 : 1.0);
          } else {
            hit(target);
          }
        }
        break;
      }
      case 'volley': {
        const targets = within(px, py, skill.range)
          .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
          .slice(0, skill.n);
        emit({ x: px, y: py, startX: px, startY: py, points: targets.map(m => ({ x: m.x, y: m.y })) }, true);
        targets.forEach(m => hit(m));
        break;
      }
      case 'chain': {
        const visited = new Set();
        const points = [];
        let cur = nearest(px, py, skill.range);
        let mult = 1;
        while (cur && points.length < skill.n) {
          visited.add(cur);
          points.push({ x: cur.x, y: cur.y });
          hit(cur, mult, points.length > 1 ? points[points.length - 2].x : px, points.length > 1 ? points[points.length - 2].y : py);
          mult *= skill.decay || 0.85;
          cur = nearest(cur.x, cur.y, skill.jump || 4, visited);
        }
        emit({ x: px, y: py, startX: px, startY: py, points }, true);
        break;
      }
      case 'pulse': {
        const onTarget = skill.at === 'target';
        let seekX = aimX, seekY = aimY, lastPrey = null;
        if (skill.id === 'sp_soul_bastion') {
          const missingShare = Math.max(0, 1 - (player.hp / Math.max(1, player.maxHp)));
          const bloodlustHeal = Math.max(1, Math.round(player.maxHp * (0.12 + 0.18 * missingShare)));
          player.hp = Math.min(player.maxHp, player.hp + bloodlustHeal);
          say(px, py, `🔥 UNDYING RAGE! (+${bloodlustHeal} HP)`, '#f43f5e', 18);
        }
        const wave = (i) => {
          let cx = onTarget ? seekX : player.x, cy = onTarget ? seekY : player.y;
          if (skill.seek) {
            // hop to a different enemy each pulse (stay put only if it is the last one)
            const prey = nearest(cx, cy, skill.seek, lastPrey ? new Set([lastPrey]) : null) || (lastPrey && lastPrey.state !== 'dead' ? lastPrey : nearest(cx, cy, skill.seek));
            if (prey) { lastPrey = prey; seekX = cx = prey.x; seekY = cy = prey.y; }
          }
          emit({ x: cx, y: cy, radius: skill.r, wave: i }, i === 0);
          within(cx, cy, skill.r).forEach(m => hit(m, 1, cx, cy));
        };
        wave(0);
        for (let i = 1; i < skill.n; i++) later(i * skill.every, () => wave(i));
        break;
      }
      case 'rain': {
        // Each strike lands on a random enemy in the area, or a random spot if none
        if (skill.id === 'sp_grave_rain') say(aimX, aimY, '🪓 GUILLOTINE SKYFALL!', '#c084fc', 17);
        const strike = (i) => {
          const inArea = within(aimX, aimY, skill.r);
          const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * skill.r;
          const pick = inArea.length ? inArea[Math.floor(Math.random() * inArea.length)] : null;
          const sx = pick ? pick.x : aimX + Math.cos(a) * d, sy = pick ? pick.y : aimY + Math.sin(a) * d;
          emit({ x: sx, y: sy, radius: skill.hit, wave: i, areaX: aimX, areaY: aimY, areaR: skill.r }, i === 0);
          within(sx, sy, skill.hit).forEach(m => hit(m, 1, sx, sy));
          if (skill.id === 'sp_grave_rain' && i === skill.n - 1) {
            within(aimX, aimY, skill.r).forEach(m => hit(m, 0.75, aimX, aimY));
          }
        };
        strike(0);
        for (let i = 1; i < skill.n; i++) later(i * skill.every, () => strike(i));
        break;
      }
      case 'dash': {
        const end = travel(skill.len);
        spot = { x0: px, y0: py, x1: end.x, y1: end.y };
        let resetDash = false;
        let spinHits = 0;
        for (const m of alive()) {
          if (this.distToSegment(m.x, m.y, px, py, end.x, end.y) <= skill.width) {
            if (skill.resetOnStatic && m.staticCharge && m.staticCharge > 0) {
              m.staticCharge = 0;
              resetDash = true;
            }
            spinHits++;
            hit(m);
            if (skill.plow && m.state !== 'dead' && !m.isBoss) {
              const side = ((m.x - px) * -dir.normY + (m.y - py) * dir.normX) >= 0 ? 0.6 : -0.6;
              const nx = end.x + dir.normX * 0.8 - dir.normY * side, ny = end.y + dir.normY * 0.8 + dir.normX * side;
              if (!this.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
            }
          }
        }
        if (resetDash) {
          player.skillCooldowns['dash'] = 0;
          player.skillCooldowns[slot] = 0;
          this.emitZone(zone, 'floating_text', { x: end.x, y: end.y - 0.7, text: '⚡ DASH RESET!', color: '#facc15', size: 16 });
          const socket = this.io.sockets.sockets.get(player.id);
          if (socket) socket.emit('player_updated', player);
        } else if (skill.spinReset && spinHits > 0) {
          const cdReduce = spinHits * skill.spinReset;
          player.skillCooldowns['dash'] = Math.max(0, (player.skillCooldowns['dash'] || 0) - cdReduce);
          if (player.skillCooldowns[slot] !== undefined) {
            player.skillCooldowns[slot] = Math.max(0, (player.skillCooldowns[slot] || 0) - cdReduce);
          }
          this.emitZone(zone, 'floating_text', { x: end.x, y: end.y - 0.7, text: `🪓 SPIN SLAUGHTER -${cdReduce.toFixed(1)}s CD!`, color: '#c084fc', size: 15 });
          const socket = this.io.sockets.sockets.get(player.id);
          if (socket) socket.emit('player_updated', player);
        }
        emit({ startX: px, startY: py, x: end.x, y: end.y, width: skill.width, facing: player.facing }, true);
        break;
      }
      case 'backstep': {
        const target = nearest(aimX, aimY, 3.5) || nearest(px, py, skill.range || 7);
        if (target) {
          const tdir = { normX: dir.normX || 1, normY: dir.normY || 0 };
          let destX = target.x - tdir.normX * 1.0;
          let destY = target.y - tdir.normY * 1.0;
          if (this.isColliding(destX, destY, zone)) {
            destX = target.x + tdir.normX * 1.0;
            destY = target.y + tdir.normY * 1.0;
          }
          emit({ startX: px, startY: py, x: destX, y: destY, radius: 1.5 }, true);
          hit(target, 2.2);
          target.shadowMarkTimer = 6.0;
          if (!isShadow) {
            player.x = destX; player.y = destY;
            player.targetX = null; player.targetY = null;
            player.facing = this.calculateFacing(destX, destY, target.x, target.y);
            this.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '👤 SHADOWSTEP!', color: '#a855f7' });
            const socket = this.io.sockets.sockets.get(player.id);
            if (socket) socket.emit('player_updated', player);
          }
        } else {
          const end = travel(skill.len || 6);
          emit({ startX: px, startY: py, x: end.x, y: end.y, radius: 1.5 }, true);
        }
        break;
      }
      case 'blink': {
        const end = travel(skill.len);
        emit({ startX: px, startY: py, x: end.x, y: end.y, radius: skill.r || 0, origin: !!(skill.origin || skill.originOnly), landing: !skill.originOnly && !!skill.dmg, facing: player.facing }, true);
        if (skill.id === 'sp_void_step') say(end.x, end.y, '🪓 OBLIVION SLAM!', '#c084fc', 17);
        if (skill.leaveRune && !isShadow && SP.SP_SKILLS[skill.leaveRune]) placeRune(SP.SP_SKILLS[skill.leaveRune], px, py, false);
        if (skill.riftPull) {
          within(px, py, skill.riftPull).forEach((m, i) => {
            const a = (i / 6) * Math.PI * 2;
            const nx = end.x + Math.cos(a) * 1.2, ny = end.y + Math.sin(a) * 1.2;
            if (!this.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
          });
        }
        if (skill.taunt) {
          for (const m of within(px, py, 8)) {
            m.targetPlayerId = null;
            m.state = 'idle';
            m.wanderTarget = { x: px, y: py };
            m.nextWanderTime = Date.now() + skill.taunt * 1000;
          }
        }
        if (skill.dmg) {
          const struck = new Set();
          if (skill.origin || skill.originOnly) within(px, py, skill.r).forEach(m => { struck.add(m); hit(m, 1, px, py); });
          if (!skill.originOnly) within(end.x, end.y, skill.r).filter(m => !struck.has(m)).forEach(m => hit(m, 1, end.x, end.y));
        }
        break;
      }
      case 'alpha': {
        // Eternal Alpha (Nightfall Twinblades): blink from enemy to enemy,
        // striking each, landing beside the last one; drawn as a chain of blinks
        const struck = new Set();
        let from = { x: px, y: py };
        const hop = (i: number) => {
          const target = nearest(from.x, from.y, i === 0 ? skill.range : skill.jump, struck);
          if (!target) return false;
          struck.add(target);
          const d = Math.hypot(target.x - from.x, target.y - from.y) || 1;
          let lx = target.x - ((target.x - from.x) / d) * 0.9, ly = target.y - ((target.y - from.y) / d) * 0.9;
          if (this.isColliding(lx, ly, zone)) { lx = target.x; ly = target.y; }
          if (!isShadow) {
            player.x = lx; player.y = ly;
            player.targetX = null; player.targetY = null;
            player.facing = this.calculateFacing(lx, ly, target.x, target.y);
          }
          emit({ shape: 'blink', startX: from.x, startY: from.y, x: lx, y: ly, radius: 1.1, landing: true, facing: player.facing }, i === 0);
          hit(target, 1, lx, ly);
          from = { x: lx, y: ly };
          return true;
        };
        if (!hop(0)) {
          // nobody in reach: a short blink forward instead
          const end = travel(3);
          emit({ shape: 'blink', startX: px, startY: py, x: end.x, y: end.y, radius: 0, facing: player.facing }, true);
          break;
        }
        for (let i = 1; i < skill.n; i++) later(i * skill.every, () => hop(i));
        break;
      }
    }

    // Dragoon: every Lightning Rod answers the cast with a bolt
    if (skill.rodArc) rodArcs(skill.rodArc);
    // Lingering ground: burning crater / fire trail / gravity well, ticking on its own
    if (skill.field && spot) {
      const F = skill.field;
      const line = spot.x1 !== undefined;
      const cx = line ? (spot.x0 + spot.x1) / 2 : spot.x, cy = line ? (spot.y0 + spot.y1) / 2 : spot.y;
      emit(line
        ? { shape: 'field', startX: spot.x0, startY: spot.y0, x: spot.x1, y: spot.y1, radius: F.r, duration: F.dur, pull: !!F.pull }
        : { shape: 'field', x: cx, y: cy, radius: F.r, duration: F.dur, pull: !!F.pull }, false);
      const ticks = Math.round(F.dur / F.every);
      for (let i = 1; i <= ticks; i++) {
        later(i * F.every, () => {
          const victims = line
            ? alive().filter(m => this.distToSegment(m.x, m.y, spot.x0, spot.y0, spot.x1, spot.y1) <= F.r)
            : within(cx, cy, F.r);
          for (const m of victims) {
            if (F.pull) {
              const nx = cx + (m.x - cx) * (1 - F.pull), ny = cy + (m.y - cy) * (1 - F.pull);
              if (!this.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
            }
            hit(m, F.mult, cx, cy);
          }
        });
      }
    }
    // Singularity: after a beat, everything nearby falls into the point and is crushed
    if (skill.implode) {
      const I = skill.implode;
      later(I.delay, () => {
        emit({ shape: 'pull', x: aimX, y: aimY, radius: I.r, implode: true }, false);
        for (const m of within(aimX, aimY, I.r)) {
          const nx = aimX + (m.x - aimX) * 0.2, ny = aimY + (m.y - aimY) * 0.2;
          if (!this.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
          hit(m, I.mult, aimX, aimY);
        }
      });
    }
    // a shadow's copy only deals damage: no self buffs, cooldown cuts or echoes
    if (isShadow) {
      settleLeech();
      return;
    }
    // Chronomancer Echo: the whole skill replays later at reduced strength
    if (skill.echo && !isEcho) {
      later(skill.echo, () => {
        say(aimX, aimY, '⏳ ECHO', '#fde68a', 15);
        const echoSkill = Object.assign({}, skill, {
          dmgMult: skill.dmgMult * ECHO_DAMAGE, echo: 0, heal: 0, mana: 0, shield: 0, fortress: 0, haste: 0, sprint: 0, smoke: 0
        });
        this.castSpSkill(player, echoSkill, Object.assign({}, ctx, { skillData: Object.assign({}, skillData, { targetX: aimX, targetY: aimY }), isEcho: true }));
      });
    }
    // Reaver Heat: at 100 the hero Overheats
    if (skill.heat && !(player.overheatUntil > Date.now())) {
      player.heat = Math.min(HEAT_MAX, (player.heat || 0) + skill.heat);
      player.heatAt = Date.now();
      if (player.heat >= HEAT_MAX) {
        player.heat = 0;
        player.overheatUntil = Date.now() + OVERHEAT_SECONDS * 1000;
        say(player.x, player.y - 0.3, '🔥 OVERHEAT!', '#f97316', 20);
        emit({ shape: 'aura', x: player.x, y: player.y, radius: 2.4 }, false);
      }
    }
    if (skill.parry) {
      player.parry = { until: Date.now() + skill.parry * 1000, riposte: skill.riposte || 2 };
      say(player.x, player.y - 0.3, '🛡️ RIPOSTE STANCE', '#fde68a', 16);
    }
    if (skill.rekindle) {
      player.rebirthReadyAt = 0;
      say(player.x, player.y - 0.3, '🔥 REBIRTH READY', '#fbbf24', 16);
    }
    if (skill.haste && player.skillCooldowns) {
      for (const k of Object.keys(player.skillCooldowns)) {
        if (k !== slot && player.skillCooldowns[k] > 0) player.skillCooldowns[k] = Math.max(0, player.skillCooldowns[k] - skill.haste);
      }
    }

    // Self effects
    const buffs = [];
    if (skill.haste) buffs.push(`HASTE -${skill.haste}s`);
    if (skill.cleanse) {
      player.statusEffects = [];
      buffs.push('CLEANSED');
    }
    if (skill.flowGain) {
      player.flowStacks = Math.min(5, (player.flowStacks || 0) + skill.flowGain);
      player.flowTimer = 5.0;
      buffs.push(`FLOW x${player.flowStacks}`);
    }
    if (skill.invuln) {
      player.smokeScreenTimer = Math.max(player.smokeScreenTimer || 0, skill.invuln);
    }
    if (skill.hpCost) player.hp = Math.max(1, player.hp - Math.round(player.hp * skill.hpCost));
    if (skill.undying) { player.undyingTimer = Math.max(player.undyingTimer || 0, skill.undying); buffs.push('UNDYING RAGE'); }
    if (skill.berserk) { player.berserkTimer = Math.max(player.berserkTimer || 0, skill.berserk); buffs.push('RAGE'); }
    if (skill.bloodlust) {
      const b = skill.bloodlust;
      player.bloodlust = { timer: b.dur, rage: b.rage, atkSpeed: b.atkSpeed, thirst: b.thirst };
      this.recalculatePlayerStats(player);
      buffs.push('BLOODLUST');
    }
    if (skill.fortress) { player.ironFortressTimer = Math.max(player.ironFortressTimer || 0, skill.fortress); buffs.push('FORTRESS'); }
    if (skill.sprint) player.sprintTimer = Math.max(player.sprintTimer || 0, skill.sprint);
    if (skill.smoke) { player.smokeScreenTimer = Math.max(player.smokeScreenTimer || 0, skill.smoke); buffs.push('VANISH'); }
    if (skill.shield) { const v = Math.round(player.maxHp * skill.shield); player.shieldHp = (player.shieldHp || 0) + v; buffs.push(`+${v} SHIELD`); }
    if (skill.heal) { const v = Math.round(player.maxHp * skill.heal); player.hp = Math.min(player.maxHp, player.hp + v); buffs.push(`+${v} HP`); }
    if (skill.mana) player.mp = Math.min(player.maxMp, player.mp + Math.round(player.maxMp * skill.mana));
    if (buffs.length && !isEcho) {
      this.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 0.8, text: `${skill.name.toUpperCase()} (${buffs.join(' / ')})`, color: skill.color || '#e2e8f0' });
    }
    if (isSoulCard && player.voidSouls > 0 && !isEcho) say(player.x, player.y - 0.3, `👻 SOULS ${player.voidSouls}/${VOID_SOUL_MAX}`, '#c084fc', 13);
    settleLeech();
    if (skill.haste || skill.spShape === 'rewind') {
      const socket = this.io.sockets.sockets.get(player.id);
      if (socket) socket.emit('player_updated', player);
    }
  }

  smokeMissChance(player) {
    return this.statusFx.smokeMissChance(player);
  }

  handlePlayerSkill(socketId: any, skillData: any = {}) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    const rawSlot = skillData.skillSlot || 'slot1';
    const slot = (rawSlot === 'skill1') ? 'slot1' : (rawSlot === 'skill2') ? 'slot2' : rawSlot;
    if (!CLIENT_SKILL_SLOTS.has(slot)) return;

    if (!player.equippedSkills) {
      player.equippedSkills = JSON.parse(JSON.stringify(DEFAULT_EQUIPPED_SKILLS[player.characterClass] || DEFAULT_EQUIPPED_SKILLS.warrior));
    }
    if (!player.skillCooldowns) {
      player.skillCooldowns = { slot1: 0, slot2: 0, slot3: 0, dash: 0, skill1: 0, skill2: 0 };
    }
    // Nightblade: casting Phantom Shuriken again while its stars are out calls them back (free, ignores cooldown)
    // Dragoon: casting Sky Lance again while it is planted dives onto it (also free)
    const recast = (o) => !!(o && o.slot === slot && Date.now() < o.until && player.equippedSkills && player.equippedSkills[slot] === o.skillId
      && o.zone === player.zone && o.instanceId === (player.dungeonInstanceId || null));
    const recall = recast(player.nbStars) || recast(player.dgSpear);
    if (!recall && (player.skillCooldowns[slot] > 0 || (player.skillCooldowns[rawSlot] > 0))) return;

    const socket0 = this.io.sockets.sockets.get(socketId);
    const skillId = slot === 'weapon' ? 'weapon' : slot === 'ult' ? 'ult'
      : player.equippedSkills[slot] || (DEFAULT_EQUIPPED_SKILLS[player.characterClass] && DEFAULT_EQUIPPED_SKILLS[player.characterClass][slot]) || 'whirlwind';
    const skill = this.resolvePlayerSkill(player, slot, skillId);
    if (!skill) {
      if (socket0) socket0.emit('floating_text', { x: player.x, y: player.y - 0.7, text: slot === 'ult' ? 'Transform with an SP card to use its Signature' : 'This weapon has no ability', color: '#94a3b8' });
      return;
    }
    // Signature: needs a full charge instead of mana
    if (slot === 'ult' && (player.ultCharge || 0) < ULT_CHARGE_MAX) {
      if (socket0) socket0.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `✦ Signature charging ... ${Math.floor(player.ultCharge || 0)}%`, color: '#94a3b8' });
      return;
    }
    const runeId = (player.equippedSkills.runes && player.equippedSkills.runes[slot]) || 'none';

    const socket = this.io.sockets.sockets.get(socketId);
    const playerTalents = player.skills || {};

    if (skill.spShape === 'aura') {
      // casting an active blood aura again switches it off, for free
      if (player.spToggles && player.spToggles[skill.id]) {
        player.skillCooldowns[slot] = player.skillCooldowns[rawSlot] = skill.cooldown;
        this.endSpToggle(player, skill.id);
        this.emitZone(player.zone, 'skill_fx', {
          type: 'sp_skill', shape: 'aura', off: true, x: player.x, y: player.y, radius: skill.r || 1.4, element: skill.element, color: skill.color,
          cardId: skill.cardId, skillId: skill.id, name: skill.name, skillSlot: slot, cooldown: skill.cooldown, playerId: player.id
        });
        if (socket) socket.emit('player_updated', player);
        return;
      }
      if (skill.drain && player.hp <= player.maxHp * BLOOD_AURA_START_HP) {
        if (socket) socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: '🩸 Not enough blood!', color: '#ef4444' });
        return;
      }
    }

    let mpCost = Math.round(skill.mpCost * (player.manaCostMult || 1));
    if (playerTalents.mana_flow) {
      mpCost = Math.max(2, Math.round(mpCost * (1 - playerTalents.mana_flow * 0.30)));
    }

    if (skill.cardId === 'sp_reaver' && player.overheatUntil > Date.now()) mpCost = 0;

    if (!recall && player.mp < mpCost) {
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

    const runeCounts = this.getWeaponRuneCounts(player);
    let cooldown = skill.cooldown;
    if (runeCounts.tempest > 0) {
      // (the 0.4s floor never lengthens a cooldown that is already shorter, e.g. Rift Step's 0.1s)
      cooldown = Math.max(Math.min(0.4, cooldown), Number((cooldown * Math.pow(0.8, runeCounts.tempest)).toFixed(2)));
    }
    // Cooldown reduction from gear and attributes
    if (player.cdr > 0) cooldown = Number((cooldown * (1 - player.cdr)).toFixed(2));
    // Stormcaller 2-piece: shorter cooldowns
    if (player.set2 && player.set2.stormcaller) cooldown = Number((cooldown * (1 - player.set2.stormcaller.cdr)).toFixed(2));
    // Exhausting dungeon modifier: longer cooldowns for the whole run
    if (player.zone === 'dungeon') {
      const dInst = this.getPlayerDungeonInstance(player);
      if (dInst && dInst.mods && dInst.mods.includes('exhausting')) cooldown = Number((cooldown * 1.25).toFixed(2));
    }
    if (slot === 'dash') {
      if (playerTalents.sundering_dash) cooldown = Math.max(0.4, cooldown - playerTalents.sundering_dash * 0.4);
      if (playerTalents.arcane_haste) cooldown = Math.max(0.4, cooldown - playerTalents.arcane_haste * 0.5);
      if (playerTalents.shadow_sprint) cooldown = Math.max(0.4, cooldown - playerTalents.shadow_sprint * 0.4);
    }

    if (!recall) {
      player.mp -= mpCost;
      player.skillCooldowns[slot] = cooldown;
      player.skillCooldowns[rawSlot] = cooldown;
      if (slot === 'slot1') player.skillCooldown = cooldown;
      if (slot === 'ult') {
        player.ultCharge = 0;
        player.ultLockUntil = Date.now() + ULT_LOCK_SECONDS * 1000;
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 1.6, text: `✦ ${skill.name.toUpperCase()} ✦`, color: skill.color || '#facc15', size: 26 });
      }
      this.applySetOnSkillCast(player, skill.cooldown);
      if (socket) socket.emit('player_updated', player);
    }

    const mobsMap = this.getMobsMap(player.zone);
    let totalDmgDealt = 0;

    // `canCrit` only allows a crit; it is rolled like a basic attack, plus the
    // skill's own critBonus (e.g. Fan of Knives, Shadowstep).
    const skillCritChance = 0.15 + (player.critChanceBonus || 0) + (skill.critBonus || 0);
    const applySkillDamage = (mob, baseDmg, canCrit = false) => {
      const isCrit = canCrit && Math.random() < skillCritChance;
      let dmg = Math.max(1, Math.round(baseDmg * SKILL_DAMAGE_SCALE));
      if (runeId === 'flame') {
        dmg = Math.round(dmg * 1.25);
        mob.burnTimer = 3.5;
        mob.burnDmg = 16;
      }
      if (runeId === 'frost') {
        mob.chillTimer = 3.5;
        if (Math.random() < 0.25) mob.chillTimer = 5.0;
      }
      if (runeId === 'tempest') {
        dmg = Math.round(dmg * 1.10);
      }
      if (player.berserkTimer > 0) {
        dmg = Math.round(dmg * 1.35);
      }
      if (player.bloodlust) dmg = Math.round(dmg * this.bloodRage(player));
      this.applyDamageToMob(player, mob, dmg, isCrit);
      totalDmgDealt += dmg;
    };

    // Helper for Dash vector calculations
    const computeDashVector = () => {
      let dirX = 0, dirY = 0;
      if (skillData.dirX !== undefined && skillData.dirY !== undefined && (skillData.dirX !== 0 || skillData.dirY !== 0)) {
        dirX = skillData.dirX;
        dirY = skillData.dirY;
      } else if (player.moveDir && (player.moveDir.dx !== 0 || player.moveDir.dy !== 0)) {
        const sLen = Math.hypot(player.moveDir.dx, player.moveDir.dy);
        const nx = player.moveDir.dx / sLen;
        const ny = player.moveDir.dy / sLen;
        dirX = (nx + ny * 2) * 0.5;
        dirY = (ny * 2 - nx) * 0.5;
      } else if (player.targetX !== null && player.targetY !== null) {
        const td = Math.hypot(player.targetX - player.x, player.targetY - player.y);
        if (td > 0.1) {
          dirX = (player.targetX - player.x) / td;
          dirY = (player.targetY - player.y) / td;
        }
      }
      if (Math.hypot(dirX, dirY) < 0.001) {
        const facingVectors = {
          'E': { dx: 1, dy: -1 }, 'SE': { dx: 1, dy: 0 }, 'S': { dx: 1, dy: 1 },
          'SW': { dx: 0, dy: 1 }, 'W': { dx: -1, dy: 1 }, 'NW': { dx: -1, dy: 0 },
          'N': { dx: -1, dy: -1 }, 'NE': { dx: 0, dy: -1 }
        };
        const vec = facingVectors[player.facing] || { dx: 1, dy: 0 };
        dirX = vec.dx; dirY = vec.dy;
      }
      const dirLen = Math.hypot(dirX, dirY) || 1;
      return { normX: dirX / dirLen, normY: dirY / dirLen };
    };

    // field props near the caster, and near where the skill was aimed, take a hit
    if (this.fields.has(player.zone)) {
      this.damageFieldProps(player, player.x, player.y, 3);
      if (Number.isFinite(skillData && skillData.targetX) && Number.isFinite(skillData && skillData.targetY)) {
        this.damageFieldProps(player, skillData.targetX, skillData.targetY, 1.8);
      }
    }

    // EXECUTE SPECIFIC ABILITY
    switch (skill.spShape ? 'sp_skill' : skill.id) {
      case 'sp_skill': {
        const spCtx = { slot, cooldown, runeId, skillData, mobsMap, applySkillDamage, computeDashVector, recall };
        if (skill.ultStages) {
          // Signature: every stage after the first lands on its delay, from
          // wherever the hero is by then (the first may have moved them)
          const zone0 = player.zone, inst0 = player.dungeonInstanceId || null;
          skill.ultStages.forEach((stage, i) => {
            const run = () => {
              if (player.isDead || player.zone !== zone0 || (player.dungeonInstanceId || null) !== inst0) return;
              this.castSpSkill(player, stage, i === 0 ? spCtx : Object.assign({}, spCtx, { quiet: true }));
            };
            if (i === 0 || !(stage.delay > 0)) run(); else setTimeout(run, stage.delay * 1000);
          });
          if (socket) socket.emit('player_updated', player);
          break;
        }
        this.castSpSkill(player, skill, spCtx);
        // Nightblade's tossed shadow casts the same skill from where it stands
        const shadow = player.nbShadow;
        if (shadow && Date.now() < shadow.until && shadow.zone === player.zone && shadow.instanceId === (player.dungeonInstanceId || null)
          && !recall && !SHADOW_SKIPS_SHAPES.has(skill.spShape)) {
          const echo = Object.assign({}, skill, { dmgMult: skill.dmgMult * shadow.mirror });
          this.castSpSkill(player, echo, Object.assign({}, spCtx, { isShadow: true, origin: { x: shadow.x, y: shadow.y } }));
        }
        break;
      }

      // === WARRIOR SKILLS ===
      case 'whirlwind': {
        const wwRadius = skill.radius + (playerTalents.cyclone_cleave ? playerTalents.cyclone_cleave * 1.2 : 0);
        const wwDmgMult = skill.dmgMult + (playerTalents.cyclone_cleave ? playerTalents.cyclone_cleave * 0.5 : 0);
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'whirlwind', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: wwRadius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= wwRadius) {
            applySkillDamage(mob, Math.round(player.dmg * wwDmgMult), true);
          }
        }
        break;
      }

      case 'earthshaker': {
        const slamDmgMult = skill.dmgMult + (playerTalents.seismic_shatter ? playerTalents.seismic_shatter * 0.60 : 0);
        const slowDur = (skill.slowDuration || 2.5) + (playerTalents.seismic_shatter ? playerTalents.seismic_shatter * 3 : 0);
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'earthshaker', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * slamDmgMult), true);
            mob.chillTimer = slowDur;
          }
        }
        break;
      }

      case 'blade_charge': {
        const { normX, normY } = computeDashVector();
        const startX = player.x, startY = player.y;
        const dashDist = skill.distance || 4.8;
        let newX = startX, newY = startY;
        const steps = Math.floor(dashDist / 0.25);
        for (let s = 1; s <= steps; s++) {
          const tx = startX + normX * (s * 0.25);
          const ty = startY + normY * (s * 0.25);
          if (this.isColliding(tx, ty, player.zone)) break;
          newX = tx; newY = ty;
        }
        player.x = newX; player.y = newY;
        player.targetX = null; player.targetY = null;
        player.facing = this.calculateFacing(startX, startY, newX, newY);
        const chargeDmgMult = skill.dmgMult + (playerTalents.sundering_dash ? playerTalents.sundering_dash * 0.5 : 0);
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = this.distToSegment(mob.x, mob.y, startX, startY, newX, newY);
          if (dist <= 1.4) {
            applySkillDamage(mob, Math.round(player.dmg * chargeDmgMult), true);
            const kx = mob.x + normX * 0.8;
            const ky = mob.y + normY * 0.8;
            if (!this.isColliding(kx, ky, player.zone)) { mob.x = kx; mob.y = ky; }
          }
        }
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'blade_charge', skillSlot: slot, cooldown, startX, startY, x: newX, y: newY, playerId: player.id });
        break;
      }

      case 'shield_slam': {
        let targetMob = null;
        let minDist = 3.2;
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (dist < minDist) { minDist = dist; targetMob = mob; }
        }
        const hitX = targetMob ? targetMob.x : player.x;
        const hitY = targetMob ? targetMob.y : player.y;
        player.shieldHp = (player.shieldHp || 0) + (skill.shieldHp || 80);
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: `🛡️ Shield Barrier +${skill.shieldHp || 80}!`, color: '#38bdf8' });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'shield_slam', skillSlot: slot, cooldown, x: hitX, y: hitY, playerId: player.id });
        if (targetMob) {
          applySkillDamage(targetMob, Math.round(player.dmg * skill.dmgMult), true);
          targetMob.chillTimer = skill.stunDuration || 2.0;
        }
        break;
      }

      case 'blood_rage': {
        const hpLoss = Math.max(10, Math.round(player.hp * 0.10));
        player.hp = Math.max(1, player.hp - hpLoss);
        player.berserkTimer = skill.duration || 6.0;
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '🩸 BERSERK RAGE (+35% DMG & 20% Leech)', color: '#ef4444' });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'blood_rage', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'colossus_strike': {
        const hitX = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const hitY = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'colossus_strike', skillSlot: slot, cooldown, x: hitX, y: hitY, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - hitX, mob.y - hitY) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'iron_fortress': {
        player.ironFortressTimer = skill.duration || 4.5;
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '🏰 IRON FORTRESS (60% Shield & Thorns)', color: '#94a3b8' });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'iron_fortress', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'war_stomp': {
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'war_stomp', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (dist <= skill.radius) {
            mob.x = player.x + (mob.x - player.x) * 0.35;
            mob.y = player.y + (mob.y - player.y) * 0.35;
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.chillTimer = skill.stunDuration || 1.8;
          }
        }
        break;
      }

      case 'dragon_roar': {
        player.berserkTimer = skill.duration || 6.0;
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: "🐲 DRAGON'S ROAR (+40% ATK & FEAR)", color: '#f97316', size: 19 });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'dragon_roar', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.chillTimer = 2.0;
          }
        }
        break;
      }

      case 'meteor_dive': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        if (!this.isColliding(tx, ty, player.zone)) {
          player.x = tx; player.y = ty;
        }
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'meteor_dive', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.burnTimer = 4.0;
            mob.burnDmg = 18;
          }
        }
        break;
      }

      case 'bladestorm_frenzy': {
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'bladestorm_frenzy', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'titan_bastion': {
        player.shieldHp = (player.shieldHp || 0) + (skill.shieldHp || 350);
        player.ironFortressTimer = skill.duration || 5.0;
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: `🏛️ TITAN BASTION (+${skill.shieldHp || 350} Shield & Armor)`, color: '#facc15', size: 19 });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'titan_bastion', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'sundering_cleave': {
        const { normX, normY } = computeDashVector();
        const cleaveDist = skill.distance || 9.0;
        const cleaveX = player.x + normX * cleaveDist;
        const cleaveY = player.y + normY * cleaveDist;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'sundering_cleave', skillSlot: slot, cooldown, startX: player.x, startY: player.y, x: cleaveX, y: cleaveY, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = this.distToSegment(mob.x, mob.y, player.x, player.y, cleaveX, cleaveY);
          if (dist <= 1.8) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.chillTimer = 3.0;
          }
        }
        break;
      }

      case 'ragnarok_slash': {
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.9, text: '👑 RAGNARÖK GODSLAYER!', color: '#eab308', size: 24 });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'ragnarok_slash', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      // === MAGE SKILLS ===
      case 'firestorm': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        const meteorRadius = skill.radius + (playerTalents.infernal_cataclysm ? playerTalents.infernal_cataclysm * 2.0 : 0);
        const meteorDmgMult = skill.dmgMult + (playerTalents.infernal_cataclysm ? playerTalents.infernal_cataclysm * 0.60 : 0);
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'firestorm', skillSlot: slot, cooldown, x: tx, y: ty, radius: meteorRadius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= meteorRadius) {
            applySkillDamage(mob, Math.round(player.dmg * meteorDmgMult), true);
            mob.burnTimer = skill.burnDuration || 3.0;
            mob.burnDmg = (skill.burnDmg || 12) + (playerTalents.infernal_cataclysm ? playerTalents.infernal_cataclysm * 10 : 0);
          }
        }
        break;
      }

      case 'frost_nova': {
        const novaDmgMult = skill.dmgMult + (playerTalents.glacial_tomb ? playerTalents.glacial_tomb * 0.5 : 0);
        const chillDur = (skill.chillDuration || 3.5) + (playerTalents.glacial_tomb ? playerTalents.glacial_tomb * 3 : 0);
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'frost_nova', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * novaDmgMult), false);
            mob.chillTimer = chillDur;
          }
        }
        break;
      }

      case 'arcane_blink': {
        const { normX, normY } = computeDashVector();
        const startX = player.x, startY = player.y;
        let dashDist = skill.distance || 5.2;
        if (playerTalents.arcane_haste) dashDist += playerTalents.arcane_haste * 3;
        let newX = startX, newY = startY;
        const steps = Math.floor(dashDist / 0.25);
        for (let s = steps; s >= 1; s--) {
          const tx = startX + normX * (s * 0.25);
          const ty = startY + normY * (s * 0.25);
          if (!this.isColliding(tx, ty, player.zone)) {
            newX = tx; newY = ty;
            break;
          }
        }
        player.x = newX; player.y = newY;
        player.targetX = null; player.targetY = null;
        player.statusEffects = [];
        player.speedFactor = 1.0;
        player.facing = this.calculateFacing(startX, startY, newX, newY);
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - newX, mob.y - newY) <= (skill.radius || 2.4)) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
            mob.chillTimer = skill.chillDuration || 2.0;
          }
        }
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'arcane_blink', skillSlot: slot, cooldown, startX, startY, x: newX, y: newY, playerId: player.id });
        break;
      }

      case 'chain_lightning': {
        let currentTarget = null;
        let minDist = 7.0;
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (dist < minDist) { minDist = dist; currentTarget = mob; }
        }
        const points = [{ x: player.x, y: player.y }];
        const hitMobIds = new Set();
        let chainTarget = currentTarget;
        for (let b = 0; b < (skill.bounces || 5); b++) {
          if (!chainTarget) break;
          hitMobIds.add(chainTarget.id);
          points.push({ x: chainTarget.x, y: chainTarget.y });
          applySkillDamage(chainTarget, Math.round(player.dmg * skill.dmgMult), true);
          let nextTarget = null;
          let nextDist = 5.0;
          for (const mob of mobsMap.values()) {
            if (mob.state === 'dead' || hitMobIds.has(mob.id)) continue;
            const dist = Math.hypot(mob.x - chainTarget.x, mob.y - chainTarget.y);
            if (dist < nextDist) { nextDist = dist; nextTarget = mob; }
          }
          chainTarget = nextTarget;
        }
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'chain_lightning', skillSlot: slot, cooldown, points, playerId: player.id });
        break;
      }

      case 'mana_shield': {
        player.shieldHp = (player.shieldHp || 0) + (skill.absorbHp || 120);
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: `✨ Mana Barrier +${skill.absorbHp || 120} Shield!`, color: '#67e8f9' });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'mana_shield', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'black_hole': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'black_hole', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - tx, mob.y - ty);
          if (dist <= skill.radius) {
            mob.x = tx + (mob.x - tx) * 0.2;
            mob.y = ty + (mob.y - ty) * 0.2;
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'blizzard': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'blizzard', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
            mob.chillTimer = 4.0;
          }
        }
        break;
      }

      case 'pyroblast': {
        const { normX, normY } = computeDashVector();
        const hitX = player.x + normX * 4.5;
        const hitY = player.y + normY * 4.5;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'pyroblast', skillSlot: slot, cooldown, startX: player.x, startY: player.y, x: hitX, y: hitY, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - hitX, mob.y - hitY) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.burnTimer = skill.burnDuration || 4.0;
            mob.burnDmg = skill.burnDmg || 16;
          }
        }
        break;
      }

      case 'thunder_storm': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'thunder_storm', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.chillTimer = 1.5;
          }
        }
        break;
      }

      case 'glacial_comet': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'glacial_comet', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.chillTimer = 4.0;
          }
        }
        break;
      }

      case 'arcane_hyperbeam': {
        const { normX, normY } = computeDashVector();
        const beamDist = skill.distance || 10.0;
        const beamEndX = player.x + normX * beamDist;
        const beamEndY = player.y + normY * beamDist;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'arcane_hyperbeam', skillSlot: slot, cooldown, startX: player.x, startY: player.y, x: beamEndX, y: beamEndY, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = this.distToSegment(mob.x, mob.y, player.x, player.y, beamEndX, beamEndY);
          if (dist <= 1.6) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'time_dilation': {
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '⏳ CHRONOSPHERE (80% Slow & Haste)', color: '#38bdf8', size: 19 });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'time_dilation', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            mob.chillTimer = skill.duration || 4.5;
          }
        }
        break;
      }

      case 'supernova_blast': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'supernova_blast', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.burnTimer = 5.0;
            mob.burnDmg = 25;
          }
        }
        break;
      }

      case 'genesis_cataclysm': {
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.9, text: '✨ CATACLYSM OF GENESIS!', color: '#a855f7', size: 24 });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'genesis_cataclysm', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      // === ROGUE SKILLS ===
      case 'fan_of_knives': {
        const knifeDmgMult = skill.dmgMult + (playerTalents.venomous_knives ? playerTalents.venomous_knives * 0.60 : 0);
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'fan_of_knives', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * knifeDmgMult), true);
            if (playerTalents.venomous_knives) {
              mob.poisonTimer = 4.0;
              mob.poisonDmg = 16 * playerTalents.venomous_knives;
            }
          }
        }
        break;
      }

      case 'toxic_bomb': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        const smokeRad = skill.radius + (playerTalents.noxious_cloud ? playerTalents.noxious_cloud * 1.6 : 0);
        const smokeDmg = (skill.poisonDmg || 9) + (playerTalents.noxious_cloud ? playerTalents.noxious_cloud * 8 : 0);
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'toxic_bomb', skillSlot: slot, cooldown, x: tx, y: ty, radius: smokeRad, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= smokeRad) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
            mob.poisonTimer = skill.poisonDuration || 4.5;
            mob.poisonDmg = smokeDmg;
          }
        }
        break;
      }

      case 'shadow_dash': {
        const { normX, normY } = computeDashVector();
        const startX = player.x, startY = player.y;
        const dashDist = skill.distance || 4.8;
        let newX = startX, newY = startY;
        const steps = Math.floor(dashDist / 0.25);
        for (let s = 1; s <= steps; s++) {
          const tx = startX + normX * (s * 0.25);
          const ty = startY + normY * (s * 0.25);
          if (this.isColliding(tx, ty, player.zone)) break;
          newX = tx; newY = ty;
        }
        player.x = newX; player.y = newY;
        player.targetX = null; player.targetY = null;
        player.facing = this.calculateFacing(startX, startY, newX, newY);
        player.sprintTimer = (skill.sprintDuration || 2.0) + (playerTalents.shadow_sprint ? playerTalents.shadow_sprint * 2.0 : 0);
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = this.distToSegment(mob.x, mob.y, startX, startY, newX, newY);
          if (dist <= 1.4) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'shadow_dash', skillSlot: slot, cooldown, startX, startY, x: newX, y: newY, playerId: player.id });
        break;
      }

      case 'shadowstep': {
        let targetMob = null;
        let minDist = 7.0;
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (dist < minDist) { minDist = dist; targetMob = mob; }
        }
        if (targetMob) {
          const startX = player.x, startY = player.y;
          const behindX = targetMob.x + 0.6;
          const behindY = targetMob.y + 0.6;
          if (!this.isColliding(behindX, behindY, player.zone)) {
            player.x = behindX; player.y = behindY;
          }
          player.facing = this.calculateFacing(player.x, player.y, targetMob.x, targetMob.y);
          applySkillDamage(targetMob, Math.round(player.dmg * skill.dmgMult), true);
          this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'shadowstep', skillSlot: slot, cooldown, startX, startY, x: targetMob.x, y: targetMob.y, playerId: player.id });
        }
        break;
      }

      case 'smoke_screen': {
        player.smokeScreenTimer = skill.duration || 3.5;
        player.sprintTimer = skill.duration || 3.5;
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '🌫️ VANISH! (Stealth & 100% Crit)', color: '#a855f7' });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'smoke_screen', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'death_blossom': {
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'death_blossom', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'poison_darts': {
        const { normX, normY } = computeDashVector();
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'poison_darts', skillSlot: slot, cooldown, x: player.x, y: player.y, dirX: normX, dirY: normY, playerId: player.id });
        // Eight shurikens fly out in a ring, curve, turn at their reach and come back to the thrower.
        // Whatever one of them passes through is hit (once per shuriken on the way out, once on the
        // way back). The path is the same one the client draws (renderer.js, poison_darts).
        {
          const N = 8, REACH = 5.2, DURATION_MS = 950, HIT_R = 0.95, TICK_MS = 40;
          const zone0 = player.zone, inst0 = player.dungeonInstanceId || null;
          const ox0 = player.x, oy0 = player.y, base = Math.atan2(normY, normX) + Math.PI / N;
          const perHit = Math.round(player.dmg * skill.dmgMult * 0.5);
          const shurikenAt = (i: number, u: number) => {
            const ang = base + (i / N) * Math.PI * 2;
            const tx = ox0 + Math.cos(ang) * REACH, ty = oy0 + Math.sin(ang) * REACH;
            const bow = Math.sin(Math.PI * u) * 1.1 * (i % 2 ? 1 : -1);
            let x: number, y: number;
            if (u < 0.5) {
              const t = 1 - Math.pow(1 - u / 0.5, 2.4);
              x = ox0 + (tx - ox0) * t; y = oy0 + (ty - oy0) * t;
            } else {
              const k = (u - 0.5) / 0.5, t = k * k * (1.6 - 0.6 * k);
              x = tx + (player.x - tx) * t; y = ty + (player.y - ty) * t;   // home to wherever the thrower is now
            }
            return { x: x - Math.sin(ang) * bow, y: y + Math.cos(ang) * bow };
          };
          const hitOnce = new Set<string>();
          const startedAt = Date.now();
          let prevU = 0;
          const tick = setInterval(() => {
            const p = this.players.get(player.id);
            if (!p || p !== player || p.isDead || p.zone !== zone0 || (p.dungeonInstanceId || null) !== inst0) { clearInterval(tick); return; }
            const u = Math.min(1, (Date.now() - startedAt) / DURATION_MS);
            this.runAs(player.id, () => {
              for (let i = 0; i < N; i++) {
                for (let s = 1; s <= 3; s++) {                       // sample the stretch since the last tick so none slip through
                  const pos = shurikenAt(i, prevU + ((u - prevU) * s) / 3);
                  const phase = u < 0.5 ? 0 : 1;
                  for (const mob of mobsMap.values()) {
                    if (mob.state === 'dead' || mob.hp <= 0) continue;
                    const key = `${i}|${phase}|${mob.id}`;
                    if (hitOnce.has(key)) continue;
                    if (Math.hypot(mob.x - pos.x, mob.y - pos.y) > HIT_R + (mob.isBoss ? 0.8 : 0)) continue;
                    hitOnce.add(key);
                    applySkillDamage(mob, perHit, false);
                  }
                }
              }
            });
            prevU = u;
            if (u >= 1) clearInterval(tick);
          }, TICK_MS);
        }
        break;
      }

      case 'caltrops': {
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'caltrops', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
            mob.chillTimer = skill.slowDuration || 4.0;
          }
        }
        break;
      }

      case 'venomous_barrage': {
        const { normX, normY } = computeDashVector();
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'venomous_barrage', skillSlot: slot, cooldown, x: player.x, y: player.y, dirX: normX, dirY: normY, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (dist <= 7.5) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.poisonTimer = 5.0;
            mob.poisonDmg = 18;
          }
        }
        break;
      }

      case 'phantom_assassins': {
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'phantom_assassins', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'assassins_cull': {
        let cullTarget = null;
        let cDist = 4.5;
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const d = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (d < cDist) { cDist = d; cullTarget = mob; }
        }
        if (cullTarget) {
          const isExecute = (cullTarget.hp / cullTarget.maxHp) <= 0.5;
          const executeMult = isExecute ? skill.dmgMult * 2.0 : skill.dmgMult;
          applySkillDamage(cullTarget, Math.round(player.dmg * executeMult), true);
          this.emitZone(player.zone, 'floating_text', { x: cullTarget.x, y: cullTarget.y - 0.8, text: isExecute ? '🩸 EXECUTION CULL (x2 DMG)!' : '🗡️ Cull Strike!', color: '#ef4444', size: isExecute ? 22 : 16 });
          this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'assassins_cull', skillSlot: slot, cooldown, x: cullTarget.x, y: cullTarget.y, playerId: player.id });
        }
        break;
      }

      case 'abyssal_tether': {
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '⛓️ ABYSSAL SHADOW CHAINS (ROOT)', color: '#a855f7', size: 18 });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'abyssal_tether', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            mob.x = player.x + (mob.x - player.x) * 0.25;
            mob.y = player.y + (mob.y - player.y) * 0.25;
            mob.chillTimer = skill.rootDuration || 3.0;
          }
        }
        break;
      }

      case 'blade_dance': {
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'blade_dance', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'eclipse_execution': {
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.9, text: '🌑 VOID ECLIPSE OMNISLASH!', color: '#c084fc', size: 24 });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'eclipse_execution', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }
    }

    // Process Vampiric & Berserk heals (balanced with Max HP caps)
    if (runeId === 'vampiric' && totalDmgDealt > 0) {
      const maxDrain = Math.max(2, Math.round(player.maxHp * 0.08));
      const vHeal = Math.min(maxDrain, Math.max(1, Math.round(totalDmgDealt * 0.05)));
      player.hp = Math.min(player.maxHp, player.hp + vHeal);
      this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.6, text: `+${vHeal} HP (Vampiric Drain)`, color: '#c084fc' });
    }
    if (player.berserkTimer > 0 && totalDmgDealt > 0) {
      const maxBHeal = Math.max(2, Math.round(player.maxHp * 0.06));
      const bHeal = Math.min(maxBHeal, Math.max(1, Math.round(totalDmgDealt * 0.04)));
      player.hp = Math.min(player.maxHp, player.hp + bHeal);
      this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.45, text: `+${bHeal} HP (Lifesteal)`, color: '#ef4444' });
    }

  }

  hpRegenMult(player) {
    return this.stats.hpRegenMult(player);
  }

  recalculatePlayerStats(player) {
    return this.stats.recalculatePlayerStats(player);
  }

  handleEquipItem(socketId, itemIndex) {
    return this.inventory.handleEquipItem(socketId, itemIndex);
  }

  handleUnequipItem(socketId, slot) {
    return this.inventory.handleUnequipItem(socketId, slot);
  }

  handleBuyItem(socketId, itemId, count = 1) {
    return this.inventory.handleBuyItem(socketId, itemId, count);
  }

  handleToggleFavorite(socketId, data) {
    return this.inventory.handleToggleFavorite(socketId, data);
  }

  handleSellItem(socketId, itemIndex, quantity = 1) {
    return this.inventory.handleSellItem(socketId, itemIndex, quantity);
  }

  handleSellItems(socketId, entries) {
    return this.inventory.handleSellItems(socketId, entries);
  }

  handleReforgeItem(socketId, data) {
    return this.itemUpgrade.handleReforgeItem(socketId, data);
  }

  // Volatile dungeon modifier: a dead monster bursts after a short warning,
  // hurting every hero of the run standing close to it
  scheduleVolatileBurst(inst, mob) {
    const V = DMODS.VOLATILE, x = mob.x, y = mob.y;
    this.emitZone('dungeon', 'skill_fx', { type: 'set_proc', set: 'emberheart', x, y, radius: V.radius * 0.6, color: '#f97316' }, inst.id);
    setTimeout(() => {
      if (!this.dungeonInstances.has(inst.id)) return;
      this.emitZone('dungeon', 'skill_fx', { type: 'set_proc', set: 'emberheart', x, y, radius: V.radius, color: '#f97316' }, inst.id);
      for (const p of this.players.values()) {
        if (p.isDead || p.zone !== 'dungeon' || p.dungeonInstanceId !== inst.id || p.godMode) continue;
        if (Math.hypot(p.x - x, p.y - y) > V.radius) continue;
        let dmg = this.absorbIncomingDamage(p, Math.round(p.maxHp * V.hpShare), 'dungeon');
        p.hp = Math.max(p.undyingTimer > 0 ? 1 : 0, p.hp - dmg);
        this.emitZone('dungeon', 'floating_text', { x: p.x, y: p.y - 0.7, text: `💥 -${dmg}`, color: '#fb923c', size: 15 }, inst.id);
        if (p.hp <= 0) this.phoenixRebirth(p);
        if (p.hp <= 0 && !p.isDead) {
          p.hp = 0; p.isDead = true; p.respawnTimer = 5.0;
          if (p.dungeonRun) p.dungeonRun.deaths = (p.dungeonRun.deaths || 0) + 1;
          this.emitZone('dungeon', 'player_died', { playerId: p.id, killerName: 'a Volatile burst' }, inst.id);
        }
      }
    }, V.delayMs);
  }

  handleCraft(socketId: string, data: any) {
    return this.itemUpgrade.handleCraft(socketId, data);
  }

  getArmorRuneCounts(player: any): Record<string, number> {
    return this.stats.getArmorRuneCounts(player);
  }

  getWeaponRuneCounts(player: any): Record<string, number> {
    return this.stats.getWeaponRuneCounts(player);
  }

  handleAttributes(socketId: string, data: any) {
    return this.itemUpgrade.handleAttributes(socketId, data);
  }

  handleSocketRune(socketId: string, data: any) {
    return this.itemUpgrade.handleSocketRune(socketId, data);
  }

  handleUnsocketRune(socketId: string, data: any) {
    return this.itemUpgrade.handleUnsocketRune(socketId, data);
  }

  handleExpandSocket(socketId: string, data: any) {
    return this.itemUpgrade.handleExpandSocket(socketId, data);
  }

  handleUseTownScroll(socketId: string, data: any) {
    return this.inventory.handleUseTownScroll(socketId, data);
  }

  handleUseBagExpander(socketId: string, data: any) {
    return this.inventory.handleUseBagExpander(socketId, data);
  }

  handleOpenPersonalChest(socketId: string) {
    return this.inventory.handleOpenPersonalChest(socketId);
  }

  handleDepositToChest(socketId: string, data: any) {
    return this.inventory.handleDepositToChest(socketId, data);
  }

  handleWithdrawFromChest(socketId: string, data: any) {
    return this.inventory.handleWithdrawFromChest(socketId, data);
  }

  handleUseChestExpander(socketId: string, data: any) {
    return this.inventory.handleUseChestExpander(socketId, data);
  }

  applyItemUpgradeStats(item) {
    return this.itemUpgrade.applyItemUpgradeStats(item);
  }

  handleEnhanceItem(socketId, data) {
    return this.itemUpgrade.handleEnhanceItem(socketId, data);
  }

  getPotionSlots(player) {
    return this.potions.getPotionSlots(player);
  }

  getPotionCount(player, itemId) {
    return this.potions.getPotionCount(player, itemId);
  }

  consumePotion(player, itemId) {
    return this.potions.consumePotion(player, itemId);
  }

  handleUsePotion(socketId, potionType) {
    return this.potions.handleUsePotion(socketId, potionType);
  }

  handleSetPotionSlot(socketId, data) {
    return this.potions.handleSetPotionSlot(socketId, data);
  }

  applyStatusEffect(player, type, duration, value) {
    return this.statusFx.applyStatusEffect(player, type, duration, value);
  }

  giveLootToPlayer(player, entry, showText = true) {
    return this.loot.giveLootToPlayer(player, entry, showText);
  }

  lootEntryName(entry) {
    return this.loot.lootEntryName(entry);
  }

  lootEntryToItem(entry) {
    return this.loot.lootEntryToItem(entry);
  }

  emitDungeonRunUpdate(player: any, socket?: any) {
    return this.dungeonRun.emitDungeonRunUpdate(player, socket);
  }

  completeDungeonRun(player) {
    return this.dungeonRun.completeDungeonRun(player);
  }

  endDungeonRun(player, socket) {
    return this.dungeonRun.endDungeonRun(player, socket);
  }

  handlePickupItem(socketId, itemId) {
    return this.inventory.handlePickupItem(socketId, itemId);
  }

  handleChatMessage(socketId, message) {
    const player = this.players.get(socketId);
    if (!player) return;

    const text = (message || '').trim().substring(0, 100);
    if (!text) return;

    if (text.startsWith('/')) {
      const handled = adminCommands.handleCommand(this, player, text);
      if (handled) return;
    }

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

  spawnProjectile(caster, targetX, targetY, targetId, targetType, damage, opts: any = {}) {
    const element = (caster.equipment && caster.equipment.weapon && caster.equipment.weapon.element) || 'neutral';
    const id = `proj_${this.nextEntityId++}`;
    let dx = (targetX !== undefined ? targetX : caster.x) - caster.x;
    let dy = (targetY !== undefined ? targetY : caster.y) - caster.y;
    let angle = Math.atan2(dy, dx);
    if (Math.hypot(dx, dy) < 0.001) {
      const facingAngles = { E: 0, SE: Math.PI / 4, S: Math.PI / 2, SW: 3 * Math.PI / 4, W: Math.PI, NW: -3 * Math.PI / 4, N: -Math.PI / 2, NE: -Math.PI / 4 };
      angle = facingAngles[caster.facing] !== undefined ? facingAngles[caster.facing] : 0;
    }
    const speed = 9.0;
    // a transformed mage throws its card's own bolt (drawn per card on the client)
    const cardId = caster.spTransformed && caster.equipment && caster.equipment.sp ? caster.equipment.sp.cardId : null;

    this.projectiles.set(id, createProjectile({
      cardId,
      instanceId: caster.zone === 'dungeon' ? (caster.dungeonInstanceId || null) : null,
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
      splash: opts.splash || 0,
      crit: !!opts.crit,
      element,
      life: 2.0,
      color: '#f97316'
    }));

    this.emitZone(caster.zone, 'projectile_spawned', {
      id,
      zone: caster.zone,
      x: caster.x,
      y: caster.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      casterId: caster.id,
      element,
      cardId,
      splash: opts.splash || 0,
      color: '#f97316'
    });
  }

  // Area burst around a projectile's impact (mage basic attack)
  applyProjectileSplash(caster, proj, primary, mobsMap) {
    const splashDmg = Math.max(1, Math.round(proj.damage * proj.splash));
    for (const other of mobsMap.values()) {
      if (other === primary || other.state === 'dead') continue;
      if (Math.hypot(other.x - primary.x, other.y - primary.y) > MAGE_SPLASH_RADIUS) continue;
      this.applyDamageToMob(caster, other, splashDmg, false);
    }
  }

  // isEcho: a Void Echo repeat hit, which must not trigger talent procs again
  applyDamageToMob(player, mob, baseDamage, isCritical = false, isEcho = false) {
    if (mob.spawnUntil && Date.now() < mob.spawnUntil) return; // still rising: untouchable
    const variation = (Math.random() * 0.4) - 0.2;
    let rawDamage = Math.round(baseDamage * (1 + variation));

    // Weapon Element vs Monster Element / Resist
    const spEl = player && player.spTransformed && player.equipment && player.equipment.sp && SP.CARD_BY_ID[player.equipment.sp.cardId];
    const atkElement = spEl ? spEl.element
      : (player && player.equipment && player.equipment.weapon && player.equipment.weapon.element)
        ? player.equipment.weapon.element
        : 'neutral';
    const mobElement = mob.element || 'neutral';
    const mobResists = mob.elementResist || {};
    const elemMult = calculateElementalMultiplier(atkElement, mobElement, mobResists);
    rawDamage = Math.max(1, Math.round(rawDamage * elemMult));

    // Elemental Rune Weapon Empowerment
    const runeCounts = this.getWeaponRuneCounts(player);
    if (runeCounts.flame > 0) {
      rawDamage = Math.round(rawDamage * (1 + 0.25 * runeCounts.flame));
      mob.burnTimer = Math.max(mob.burnTimer || 0, 4.0);
      mob.burnDmg = Math.max(mob.burnDmg || 0, Math.round(rawDamage * 0.15));
    }
    if (runeCounts.tempest > 0) {
      rawDamage = Math.round(rawDamage * (1 + 0.10 * runeCounts.tempest));
    }

    // Bannerman: fighting inside your own War Standard
    const banner = player && this.ownBanner(player);
    if (banner && Math.hypot(player.x - banner.x, player.y - banner.y) <= banner.r) rawDamage = Math.round(rawDamage * (1 + banner.bonus));

    // Cryomancer Frostbite: chilled enemies take extra damage
    const procs = player && player.talentProcs;
    if (procs && procs.shatterBonus && mob.chillTimer > 0) {
      rawDamage = Math.round(rawDamage * (1 + procs.shatterBonus));
    }
    // Armor sets: Emberheart (vs burning), Eclipse Dusk
    if (player && (player.set2 || player.set4)) rawDamage = Math.round(rawDamage * this.setDamageMult(player, mob));
    // SP card passive: bonus vs statuses, executes, openers, fighting wounded
    if (player && player.spTransformed) rawDamage = Math.round(rawDamage * this.passiveDamageMult(player, mob));

    // Level Gap Mitigation & Deflection
    let isGlancing = false;
    let isDeflected = false;
    // (Eternal Rift monsters outlevel the party on purpose: their stats carry the challenge)
    if (player && mob.level && player.level && !mob.noLevelGap) {
      const levelGap = mob.level - player.level;
      if (levelGap >= 20) {
        // Enormous level gap: attacks deflect completely!
        isDeflected = true;
        isCritical = false;
      } else if (levelGap > 3) {
        // High level gap: glancing blows and steep defense penalty
        isGlancing = true;
        const penaltyMult = Math.pow(0.85, levelGap - 3);
        rawDamage = Math.max(1, Math.round(rawDamage * penaltyMult));
        if (levelGap >= 8) {
          isCritical = false; // Cannot score critical hits on foes 8+ levels higher
        }
      }
    }

    if (isCritical) {
      const critMultiplier = 1.5 + (player && player.critDmgBonus ? player.critDmgBonus : 0);
      rawDamage = Math.round(rawDamage * critMultiplier);
    }

    // Mob defense removes a share of every hit (see MOB_DEF_K)
    const mobDef = (mob.def || 0) + (mob.hasCommanderBuff ? 8 : 0);
    let damage = isDeflected ? 1 : Math.max(1, Math.round(rawDamage * MOB_DEF_K / (MOB_DEF_K + mobDef)));

    // Fortified affix absorbs 30% damage
    if (mob.buffs && mob.buffs.includes('fortified')) {
      damage = Math.max(1, Math.round(damage * 0.7));
    }

    // Shielded Elites (dungeon modifier): the shield soaks hits before HP
    if (mob.shield > 0 && !isDeflected) {
      const soak = Math.min(mob.shield, damage);
      mob.shield -= soak;
      damage -= soak;
      if (mob.shield <= 0) {
        this.emitZone((player && player.zone) || mob.fieldZone, 'floating_text', { x: mob.x, y: mob.y - 1.0, text: '🛡️ SHIELD BROKEN!', color: '#93c5fd', size: 16 },
          player && player.zone === 'dungeon' ? player.dungeonInstanceId : null);
      }
    }
    mob.hp -= damage;
    // Duskblade Doom brand soaks up what its owner deals (replayed when it ends)
    if (player && mob.doom && mob.doom.owner === player.id && mob.doom.until > Date.now()) mob.doom.stored += damage;
    mob.state = 'chase';
    mob.targetPlayerId = player ? player.id : null;
    if (player) mob.lastHitBy = player.id; // burn / poison kills are credited to them

    if (runeCounts.frost > 0) {
      mob.chillTimer = Math.max(mob.chillTimer || 0, 3.5);
      if (Math.random() < Math.min(0.75, 0.25 * runeCounts.frost)) {
        if (!(mob.frozenTimer > 0)) mob.frozenKind = 'ice'; // don't turn a Chrono stasis into ice mid-way
        mob.frozenTimer = Math.max(mob.frozenTimer || 0, mob.isBoss ? BOSS_FREEZE_SECONDS : FREEZE_SECONDS);
        this.emitZone((player && player.zone) || mob.fieldZone, 'floating_text', {
          x: mob.x,
          y: mob.y - 0.7,
          text: '❄️ FROZEN!',
          color: '#38bdf8',
          size: 16
        });
      }
    }
    if (runeCounts.vampiric > 0 && damage > 0 && !isDeflected) {
      const vLeech = Math.round(damage * 0.25 * runeCounts.vampiric);
      player.hp = Math.min(player.maxHp, player.hp + vLeech);
      const now = Date.now();
      if (!player._lastRuneLeechText || now - player._lastRuneLeechText > 250) {
        player._lastRuneLeechText = now;
        this.emitZone((player && player.zone) || mob.fieldZone, 'floating_text', {
          x: player.x,
          y: player.y - 0.5,
          text: `+${vLeech} HP (Vampiric Rune)`,
          color: '#a855f7',
          size: 14
        });
      }
    }

    // Field raid boss: feed the live leaderboard (actual damage dealt)
    if (mob.isRaidBoss && player) {
      this.recordRaidDamage(mob.fieldZone || player.zone, player.id, damage);
    }

    // Apply Talent Life Steal (balanced with per-hit cap and throttled floating text)
    if (player && player.lifeSteal && player.lifeSteal > 0 && damage > 0 && !isDeflected) {
      const maxLeech = Math.max(2, Math.round(player.maxHp * 0.04));
      const leech = Math.min(maxLeech, Math.max(1, Math.round(damage * player.lifeSteal)));
      player.hp = Math.min(player.maxHp, player.hp + leech);
      const now = Date.now();
      if (!player._lastLeechText || now - player._lastLeechText > 250) {
        player._lastLeechText = now;
        this.emitZone((player && player.zone) || mob.fieldZone, 'floating_text', {
          x: player.x,
          y: player.y - 0.5,
          text: `+${leech} HP (Leech)`,
          color: '#c084fc',
          size: 13
        });
      }
    }

    let text = `${damage}`;
    let textColor = '#ffea00'; // Iconic Ragnarok Online yellow damage text
    let textSize = 17;

    // Plain numbers: colour and size show weak / resisted / glancing hits
    if (elemMult >= 1.25) {
      textColor = '#f59e0b';
      textSize = 20;
    } else if (elemMult <= 0.75) {
      textColor = '#94a3b8';
      textSize = 15;
    }

    if (isDeflected) {
      text = 'MISS';
      textColor = '#94a3b8';
      textSize = 15;
    } else if (isCritical) {
      text = `${damage}`;
      textColor = '#ff3366';
      textSize = 24;
    } else if (isGlancing) {
      text = `${damage}`;
      textColor = '#fb923c';
      textSize = 15;
    }
    if (isEcho && !isDeflected) {
      text = `✦ ${damage}`;
      textColor = '#c084fc';
    }

    const instId = player && player.zone === 'dungeon' ? player.dungeonInstanceId : null;
    this.emitZone((player && player.zone) || mob.fieldZone, 'floating_text', {
      x: mob.x,
      y: mob.y - 0.7,
      text,
      color: textColor,
      size: textSize,
      crit: !!isCritical
    }, instId);

    if (player && player.set4 && !isDeflected) this.applySetOnHit(player, mob, damage);

    if (player && player.spTransformed && !isEcho && !isDeflected && damage > 0) this.gainUltCharge(player, ULT_GAIN_HIT);
    if (mob.hp <= 0) {
      this.handleMobDeath(mob, player);
    } else if (player && !isDeflected && !isEcho) {
      this.applyTalentProcs(player, mob, baseDamage, damage);
      if (player.spTransformed) this.passiveOnHit(player, mob, damage);
    }
  }

  applyTalentProcs(player, mob, baseDamage, damage) {
    return this.statusFx.applyTalentProcs(player, mob, baseDamage, damage);
  }

  corpseKey(zone, instId) {
    return this.minions.corpseKey(zone, instId);
  }
  addCorpse(mob, zone, instId) {
    return this.minions.addCorpse(mob, zone, instId);
  }
  takeCorpses(zone, instId, x, y, r, n) {
    return this.minions.takeCorpses(zone, instId, x, y, r, n);
  }
  raiseMinion(player, corpse, skill) {
    return this.minions.raiseMinion(player, corpse, skill);
  }
  crumbleMinion(player, m) {
    return this.minions.crumbleMinion(player, m);
  }
  dismissMinions(player) {
    return this.minions.dismissMinions(player);
  }
  tickMinions(player, dt) {
    return this.minions.tickMinions(player, dt);
  }

  countDungeonProgress(mob, instId, killerPlayer) {
    return this.dungeonRun.countDungeonProgress(mob, instId, killerPlayer);
  }

  handleMobDeath(mob, killerPlayer) {
    if (killerPlayer && killerPlayer.spTransformed) this.passiveOnKill(killerPlayer, mob);
    // Field raid bosses are paid out by participation rank, not ground loot:
    // give everyone their bounty, broadcast the kill, and let the schedule reset.
    if (mob.isRaidBoss) {
      this.onRaidBossDeath(mob, killerPlayer);
      return;
    }
    mob.state = 'dead';
    mob.hp = 0;
    const isDungeon = (mob.zone === 'dungeon') || (mob.id && mob.id.startsWith('dungeon_')) || (killerPlayer && killerPlayer.zone === 'dungeon');
    mob.respawnTimer = isDungeon ? Infinity : (mob.isBoss ? 25.0 : 10.0);

    const zone = killerPlayer ? killerPlayer.zone : (mob.fieldZone || (mob.id.startsWith('frost_') ? 'frostfell' : 'town'));
    const isBoss = !!mob.isBoss;
    const isMiniboss = !!mob.isMiniboss;
    const instId = (killerPlayer && killerPlayer.zone === 'dungeon' ? killerPlayer.dungeonInstanceId : null) || (mob && (mob as any).dungeonInstanceId) || (this as any).ctxInstanceId || null;
    if (mob.mechanics) this.bossMech.onDeath(mob, mob.fieldZone || (instId ? 'dungeon' : zone), instId);
    // every monster of the run counts toward the boss portal, whatever killed it (burns, poison, blasts...)
    this.countDungeonProgress(mob, instId, killerPlayer);
    // its body lies where it fell for a while: the Gravelord can raise it
    if (!isBoss) this.addCorpse(mob, zone, instId);
    // Item drops fade out when the killer is far above the monster's level
    // (gold still drops); `lucky` scales every item roll below
    const lootMult = killerPlayer ? lootGapMult(killerPlayer.level, mob.level) : 1;
    const lucky = chance => Math.random() < chance * lootMult;

    if (killerPlayer) {
      // Venom Lord Epidemic Spread on Kill
      if ((mob.poisonStacks && mob.poisonStacks > 0) || (mob.poisonTimer && mob.poisonTimer > 0)) {
        const stacks = mob.poisonStacks || 2;
        const mobsMap = this.getMobsMap(zone);
        let spreadCount = 0;
        for (const nearby of mobsMap.values()) {
          if (nearby === mob || nearby.state === 'dead') continue;
          if (Math.hypot(nearby.x - mob.x, nearby.y - mob.y) <= 4.2) {
            nearby.poisonStacks = Math.min(10, (nearby.poisonStacks || 0) + stacks);
            nearby.poisonTimer = Math.max(nearby.poisonTimer || 0, 7.0);
            nearby.poisonDmg = Math.max(nearby.poisonDmg || 0, Math.round((killerPlayer.dmg || 30) * 0.12 * nearby.poisonStacks));
            spreadCount++;
          }
        }
        if (spreadCount > 0) {
          this.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.7, text: `☣️ EPIDEMIC (${spreadCount})`, color: '#4ade80' });
        }
      }

      // Nightblade Shadow Mark Dash Reset on Kill
      if (mob.shadowMarkTimer > 0) {
        if (killerPlayer.skillCooldowns && killerPlayer.skillCooldowns.dash > 0) {
          killerPlayer.skillCooldowns.dash = 0;
          const kSocket = this.io.sockets.sockets.get(killerPlayer.id);
          if (kSocket) kSocket.emit('player_updated', killerPlayer);
          this.emitZone(zone, 'floating_text', { x: killerPlayer.x, y: killerPlayer.y - 0.7, text: `🗡️ SHADOW RESET!`, color: '#a855f7' });
        }
      }

      killerPlayer.inventory.kills++;
      if (killerPlayer.dungeonRun) killerPlayer.dungeonRun.kills = (killerPlayer.dungeonRun.kills || 0) + 1;

      // full EXP near your level, much less for monsters far below you; party
      // members nearby on the same map split it (see partyExpSharers)
      const sharers = this.partyExpSharers(killerPlayer);
      const share = mob.exp * (1 + PARTY_EXP_BONUS * (sharers.length - 1)) / sharers.length;
      for (const member of sharers) {
        const memberExp = Math.max(1, Math.round(share * levelGapMult(member.level, mob.level)));
        this.awardExp(member, memberExp);
        this.awardJobExp(member, memberExp);
        if (member !== killerPlayer) {
          const mSocket = this.io.sockets.sockets.get(member.id);
          if (mSocket) mSocket.emit('player_updated', member);
        }
      }

      // Passive on-kill effects: restore a share of max HP / MP (summed over the tree in recalc)
      const tk = killerPlayer.talentKill;
      if (tk && tk.hp > 0 && killerPlayer.hp < killerPlayer.maxHp) {
        const heal = Math.round(killerPlayer.maxHp * tk.hp);
        killerPlayer.hp = Math.min(killerPlayer.maxHp, killerPlayer.hp + heal);
        if (heal > 0) this.emitZone(zone, 'floating_text', { x: killerPlayer.x, y: killerPlayer.y - 0.5, text: `+${heal} HP`, color: '#4ade80' });
      }
      if (tk && tk.mp > 0 && killerPlayer.mp < killerPlayer.maxMp) {
        const mana = Math.round(killerPlayer.maxMp * tk.mp);
        killerPlayer.mp = Math.min(killerPlayer.maxMp, killerPlayer.mp + mana);
        if (mana > 0) this.emitZone(zone, 'floating_text', { x: killerPlayer.x, y: killerPlayer.y - 0.5, text: `+${mana} MP`, color: '#38bdf8' });
      }

      if (mob.riftMob) {
        // Rift kills pay Rift Points only; the wave logic handles the rest
      } else if (mob.isBoss) {
        this.broadcastSystemMessage(`👑 Legendary Conquest! [${killerPlayer.name}] vanquished [${mob.name}]!`);
        const bossInst = this.getPlayerDungeonInstance(killerPlayer);
        if (bossInst) this.rollBossSpLoot(bossInst, mob.level);
        if (killerPlayer.zone === 'dungeon') {
          this.broadcastSystemMessage(`🎉 The Dungeon Boss fell! A portal to deeper dungeon depths has unlocked.`);
          for (const p of this.players.values()) {
            if (p.zone === 'dungeon' && p.dungeonInstanceId === killerPlayer.dungeonInstanceId && p.dungeonRun && !p.dungeonRun.cleared) {
              this.completeDungeonRun(p);
            }
          }
        }
      } else if (mob.isMiniboss) {
        this.broadcastSystemMessage(`⚔️ Miniboss Slain! [${killerPlayer.name}] vanquished [${mob.name}]!`);
        this.spawnGroundItem(zone, 'item', 'spirit_fragment', mob.x, mob.y, 1, null, instId);
        if (lucky(0.40)) {
          const cls = killerPlayer && killerPlayer.characterClass;
          let gear = ItemFactory.gear(pickGearForLevel(mob.level || 1, { boss: false, cls }), mob.level || 1, false);
          const reforge = rollSkyblockReforge(gear);
          if (reforge) gear = applySkyblockReforge(gear, reforge);
          this.spawnGroundItem(zone, 'item', gear.id, mob.x + (Math.random() - 0.5) * 1.0, mob.y + (Math.random() - 0.5) * 1.0, 1, gear, instId);
          this.broadcastSystemMessage(`💎 Miniboss Bounty! [${mob.name}] dropped [${gear.name}]!`);
        }
      }
    }

    // Eternal Rift monsters drop nothing: they pay Rift Points to whoever slew them
    if (mob.riftMob) {
      const riftInst = this.dungeonInstances.get(mob.riftInstanceId);
      if (riftInst && riftInst.rift) this.onRiftMobDeath(riftInst, mob, killerPlayer);
      this.emitZone('dungeon', 'mob_died', { mobId: mob.id, killerId: killerPlayer ? killerPlayer.id : null }, mob.riftInstanceId);
      return;
    }

    // Spirit fragments from elite (commander) monsters and, rarely, any dungeon monster
    if (!isBoss && !isMiniboss && zone === 'dungeon' && lucky(mob.isCommander ? SP.FRAGMENT_DROP.commander : SP.FRAGMENT_DROP.mob)) {
      this.spawnGroundItem(zone, 'item', 'spirit_fragment', mob.x, mob.y, 1, null, instId);
    }

    // Drop Gold: Reduced drop rate (45% for trash mobs, 100% for bosses/minibosses/commanders) and rebalanced amount
    const shouldDropGold = isBoss || isMiniboss || mob.isCommander || Math.random() < 0.45;
    if (shouldDropGold && mob.gold > 0) {
      const goldScale = isBoss ? 0.7 : isMiniboss ? 0.6 : 0.45;
      const goldDrop = Math.max(1, Math.round(mob.gold * goldScale * (0.8 + Math.random() * 0.4)));
      this.spawnGroundItem(zone, 'gold', 'Gold Coins', mob.x + (Math.random() - 0.5) * 0.5, mob.y + (Math.random() - 0.5) * 0.5, goldDrop, null, instId);
    }

    if (isBoss) {
      // Boss gear is high quality with a rolled reforge ("ออฟสวยๆ"), but kept rare:
      // 35% for one piece, 6% for a second.
      const equipCount = (lucky(BOSS_GEAR_DROP_CHANCE) ? 1 : 0) + (lucky(BOSS_BONUS_GEAR_DROP_CHANCE) ? 1 : 0);
      const cls = killerPlayer && killerPlayer.characterClass;
      for (let i = 0; i < equipCount; i++) {
        let gear = ItemFactory.gear(pickGearForLevel(mob.level || 1, { boss: true, cls }), mob.level || 1, true);
        const reforge = rollSkyblockReforge(gear);
        if (reforge) {
          gear = applySkyblockReforge(gear, reforge);
        }
        this.spawnGroundItem(zone, 'item', gear.id, mob.x + (Math.random() - 0.5) * 1.2, mob.y + (Math.random() - 0.5) * 1.2, 1, gear, instId);
        if (killerPlayer) {
          this.broadcastSystemMessage(`👑 Boss Loot! [${mob.name}] dropped [${gear.name}] (${gear.rarity ? gear.rarity.toUpperCase() : 'RARE'})!`);
        }
      }

      if (lucky(BOSS_REVIVAL_STONE_CHANCE)) {
        this.spawnGroundItem(zone, 'item', 'revival_stone', mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1, null, instId);
      }

      // High-tier Potions
      if (lucky(1)) {
        this.spawnGroundItem(zone, 'item', 'health_potion', mob.x + 0.4, mob.y, 2, null, instId);
        this.spawnGroundItem(zone, 'item', 'mana_potion', mob.x - 0.4, mob.y, 2, null, instId);
      }
    } else {
      // Normal mobs:
      // "แต่อัตราการดรอปของ ทำให้น้อยๆหน่อย" (Low drop rate: ~3.5% equipment, ~6% potions/stone)
      if (lucky(MOB_GEAR_DROP_CHANCE)) {
        const cls = killerPlayer && killerPlayer.characterClass;
        let gear = ItemFactory.gear(pickGearForLevel(mob.level || 1, { cls }), mob.level || 1, false);
        if (Math.random() < 0.25) {
          const reforge = rollSkyblockReforge(gear);
          if (reforge) gear = applySkyblockReforge(gear, reforge);
        }
        this.spawnGroundItem(zone, 'item', gear.id, mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1, gear, instId);
      }

      if (lucky(0.06)) {
        const cChoice = Math.random();
        if (cChoice < 0.45) {
          this.spawnGroundItem(zone, 'item', 'health_potion', mob.x + (Math.random() - 0.5) * 0.6, mob.y + (Math.random() - 0.5) * 0.6, 1, null, instId);
        } else if (cChoice < 0.90) {
          this.spawnGroundItem(zone, 'item', 'mana_potion', mob.x + (Math.random() - 0.5) * 0.6, mob.y + (Math.random() - 0.5) * 0.6, 1, null, instId);
        } else {
          // Rare revival stone drop from regular mob!
          this.spawnGroundItem(zone, 'item', 'revival_stone', mob.x, mob.y, 1, null, instId);
        }
      }

      // Relic drops in dungeon/field (reduced to 12%)
      if ((zone === 'dungeon' || (this.fields && this.fields.has(zone))) && lucky(0.12)) {
        const relics = ['ancient_ruby', 'cursed_chalice', 'shadow_essence'];
        const r = relics[Math.floor(Math.random() * relics.length)];
        this.spawnGroundItem(zone, 'item', r, mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1, null, instId);
      }
    }

    // Elemental Rune drop: 0.005% chance (0.00005) from any monster kill
    if (Math.random() < RUNE_DROP_CHANCE) {
      const runeKeys = ['rune_flame', 'rune_frost', 'rune_tempest', 'rune_vampiric'];
      const chosenRune = runeKeys[Math.floor(Math.random() * runeKeys.length)];
      this.spawnGroundItem(zone, 'item', chosenRune, mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1, null, instId);
      this.broadcastSystemMessage(`✨ MYTHICAL DROP! [${killerPlayer ? killerPlayer.name : 'A hero'}] uncovered a rare [${ITEMS[chosenRune]?.name || chosenRune}]!`);
    }

    // Attribute materials for Jerry: each has its own small chance on any monster
    for (const [matId, chance] of Object.entries(ATTR.ATTR_MATERIAL_DROP)) {
      if (Math.random() < chance) this.spawnGroundItem(zone, 'item', matId, mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1, null, instId);
    }

    // Armor set fragments (crafting.ts): bosses usually, other monsters rarely
    const frag = CRAFT.rollFragmentDrop(mob);
    if (frag) this.spawnGroundItem(zone, 'item', frag.itemId, mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, frag.n, null, instId);

    // Dungeon modifiers: a modded boss pays out extra fragments; Volatile monsters burst
    const modInst = zone === 'dungeon' && instId ? this.dungeonInstances.get(instId) : null;
    if (modInst && modInst.mods && modInst.mods.length) {
      const extra = isBoss ? DMODS.bonusBossFragments(modInst.mods) : 0;
      if (extra > 0) {
        const pick = CRAFT.rollFragmentDrop({ isBoss: true, level: Math.max(40, mob.level || 1) }) || { itemId: 'fragment_wayfarer' };
        this.spawnGroundItem(zone, 'item', pick.itemId, mob.x, mob.y + 0.4, extra, null, instId);
      }
      if (modInst.mods.includes('volatile')) this.scheduleVolatileBurst(modInst, mob);
    }

    // Defensive armor runes: rarer than gear, far more common than the elemental ones
    if (Math.random() < (isBoss ? ARMOR_RUNE_DROP.boss : ARMOR_RUNE_DROP.normal)) {
      const armorRunes = Object.values(ITEMS).filter((it: any) => it.type === 'rune' && it.socketFor === 'armor') as any[];
      const r = armorRunes[Math.floor(Math.random() * armorRunes.length)];
      if (r) {
        this.spawnGroundItem(zone, 'item', r.id, mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1, null, instId);
        if (isBoss) this.broadcastSystemMessage(`🔷 [${killerPlayer ? killerPlayer.name : 'A hero'}] found a [${r.name}] on [${mob.name}]!`);
      }
    }

    // Ancient Socket Expander drop: 0.00005% chance (0.0000005) from boss monsters
    if (isBoss && Math.random() < SOCKET_EXPANDER_DROP_CHANCE) {
      this.spawnGroundItem(zone, 'item', 'socket_expander', mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1, null, instId);
      this.broadcastSystemMessage(`🌟 TITAN RELIC! [${killerPlayer ? killerPlayer.name : 'A hero'}] found an [Ancient Socket Expander] from [${mob.name}]!`);
    }

    this.emitZone(zone, 'mob_died', { mobId: mob.id, killerId: killerPlayer ? killerPlayer.id : null }, instId);
  }

  partyExpSharers(killer) {
    return this.party.partyExpSharers(killer);
  }

  awardExp(player, amount) {
    return this.level.awardExp(player, amount);
  }

  spawnGroundItem(zone, type, itemIdOrName, x, y, amount, customItemData = null, instanceId = null) {
    return this.loot.spawnGroundItem(zone, type, itemIdOrName, x, y, amount, customItemData, instanceId);
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
    const perfOn = !!process.env.PERF;
    const budgetMs = 1000 / this.TICK_RATE;
    const stats = { n: 0, update: 0, snap: 0, worst: 0, slow: 0 };
    this.tickInterval = setInterval(() => {
      if (!perfOn) {
        this.update(dt);
        this.broadcastSnapshot();
        this.flushFloatingTexts();
        return;
      }
      const t0 = performance.now();
      this.update(dt);
      const t1 = performance.now();
      this.broadcastSnapshot();
      this.flushFloatingTexts();
      const t2 = performance.now();
      stats.n++; stats.update += t1 - t0; stats.snap += t2 - t1;
      stats.worst = Math.max(stats.worst, t2 - t0);
      if (t2 - t0 > budgetMs) stats.slow++;
      if (t2 - t0 > budgetMs * 2) console.warn(`[perf] slow tick ${(t2 - t0).toFixed(1)}ms (update ${(t1 - t0).toFixed(1)}, snapshot ${(t2 - t1).toFixed(1)}) players=${this.players.size}`);
      if (stats.n >= this.TICK_RATE * (Number(process.env.PERF) > 1 ? Number(process.env.PERF) : 60)) {
        console.log(`[perf] 60s: avg update ${(stats.update / stats.n).toFixed(2)}ms, snapshot ${(stats.snap / stats.n).toFixed(2)}ms, worst ${stats.worst.toFixed(1)}ms, over-budget ${stats.slow}/${stats.n}, players=${this.players.size}`);
        stats.n = stats.update = stats.snap = stats.worst = stats.slow = 0;
      }
    }, 1000 / this.TICK_RATE);
  }

  sweepGroundItems() {
    return this.loot.sweepGroundItems();
  }

  update(dt) {
    this.syncZoneRooms();
    this.sweepGroundItems();
    // 1. Update Players
    for (const player of this.players.values()) {
      const socket = this.io.sockets.sockets.get(player.id);
      this.ctxInstanceId = player.dungeonInstanceId || null;
      if (player.isDead) {
        if (player.minions && player.minions.length) this.dismissMinions(player);
        if (player.spToggles) {
          for (const id of Object.keys(player.spToggles)) this.endSpToggle(player, id, true);
        }
        if (player.bloodlust) {
          player.bloodlust = null;
          this.recalculatePlayerStats(player);
        }
        // Eternal Rift: fallen heroes rise again at the Holy Fountain
        const deadRift = this.getRiftInstance(player);
        if (deadRift && !player.riftRespawnSet) {
          player.riftRespawnSet = true;
          player.respawnTimer = RIFT.RIFT_RESPAWN_S;
        }
        player.respawnTimer -= dt;
        if (player.respawnTimer <= 0 && deadRift) {
          this.respawnInRift(player, socket);
          continue;
        }
        if (player.respawnTimer <= 0) {
          if (player.zone === 'dungeon') {
            this.endDungeonRun(player, socket);
            const prevInstId = player.dungeonInstanceId;
            player.dungeonInstanceId = null;
            player.zone = 'town';
            if (prevInstId) this.cleanupDungeonInstanceIfEmpty(prevInstId);
          }
          player.isDead = false;
          player.hp = player.maxHp;
          player.mp = player.maxMp;
          player.zone = 'town';
          player.x = 20 + (Math.random() - 0.5) * 2;
          player.y = 23 + (Math.random() - 0.5) * 1.5;
          this.io.emit('player_respawned', { playerId: player.id, x: player.x, y: player.y });
          this.sendDirectMessage(player.id, `❤️ [${player.name}] has revived in town.`);
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
      if (player.faceLockTimer > 0) player.faceLockTimer = Math.max(0, player.faceLockTimer - dt);
      if (player.skillCooldown > 0) player.skillCooldown = Math.max(0, player.skillCooldown - dt);
      if (player.skillCooldowns) {
        for (const k of Object.keys(player.skillCooldowns)) {
          if (player.skillCooldowns[k] > 0) player.skillCooldowns[k] = Math.max(0, player.skillCooldowns[k] - dt);
        }
        player.skillCooldown = player.skillCooldowns.slot1 || player.skillCooldowns.skill1 || 0;
      }
      if (player.sprintTimer > 0) player.sprintTimer = Math.max(0, player.sprintTimer - dt);
      if (player.portalCooldown > 0) player.portalCooldown = Math.max(0, player.portalCooldown - dt);
      if (player.spCooldown > 0) player.spCooldown = Math.max(0, player.spCooldown - dt);
      if (player.berserkTimer > 0) player.berserkTimer = Math.max(0, player.berserkTimer - dt);
      if (player.undyingTimer > 0) player.undyingTimer = Math.max(0, player.undyingTimer - dt);
      if (player.ironFortressTimer > 0) player.ironFortressTimer = Math.max(0, player.ironFortressTimer - dt);
      if (player.smokeScreenTimer > 0) player.smokeScreenTimer = Math.max(0, player.smokeScreenTimer - dt);
      if (player.voidSoulTimer > 0) {
        player.voidSoulTimer -= dt;
        if (player.voidSoulTimer <= 0) player.voidSouls = 0;
      }
      // Reaver: Heat cools off when he stops; Overheat cooks him (never below 1 HP)
      if (player.heat > 0 && Date.now() - (player.heatAt || 0) > HEAT_HOLD_MS) player.heat = Math.max(0, player.heat - HEAT_DECAY * dt);
      if (player.overheatUntil > Date.now() && !player.godMode) player.hp = Math.max(1, player.hp - player.maxHp * OVERHEAT_BURN * dt);
      // where we were a moment ago (Chronomancer Rewind)
      player.timeTrailClock = (player.timeTrailClock || 0) + dt;
      if (player.timeTrailClock >= REWIND_SAMPLE_S && !player.isDead) {
        player.timeTrailClock = 0;
        const now = Date.now();
        player.timeTrail = (player.timeTrail || []).filter(t => now - t.t <= REWIND_KEEP_S * 1000);
        player.timeTrail.push({ t: now, x: player.x, y: player.y, hp: player.hp });
      }
      if (player.flowTimer > 0) {
        player.flowTimer = Math.max(0, player.flowTimer - dt);
        if (player.flowTimer <= 0) {
          player.flowStacks = 0;
          this.recalculatePlayerStats(player);
        }
      }
      if (player.speechTimer > 0) {
        player.speechTimer -= dt;
        if (player.speechTimer <= 0) player.speechBubble = null;
      }

      // an HP-draining toggle (Crimson Aura) stops natural HP regen
      const bleeding = player.spToggles && Object.keys(player.spToggles).length && this.tickSpToggles(player, dt);
      if (!bleeding) player.hp = Math.min(player.maxHp, player.hp + (player.maxHp * HP_REGEN_PCT * this.hpRegenMult(player) + (player.hpRegenFlat || 0)) * dt);
      this.tickPlayerShields(player, dt);
      if (player.minions && player.minions.length) this.tickMinions(player, dt);
      if (player.bloodlust) {
        player.bloodlust.timer -= dt;
        if (player.bloodlust.timer <= 0) {
          player.bloodlust = null;
          this.recalculatePlayerStats(player);
        }
      }
      player.mp = Math.min(player.maxMp, player.mp + (player.maxMp * MANA_REGEN_PCT * dt) + ((MANA_REGEN_FLAT + (player.mpRegenFlat || 0)) * dt));

      if (player.zone === 'dungeon') this.applyDungeonHazard(player);

      // Status Effects Processing (Poison DoT, Burn DoT, Chill Slow)
      if (player.statusEffects && player.statusEffects.length > 0) {
        let isChilled = false;
        for (let i = player.statusEffects.length - 1; i >= 0; i--) {
          const fx = player.statusEffects[i];
          fx.duration -= dt;
          fx.tickTimer -= dt;

          if (player.godMode) continue;

          if (fx.type === 'poison' && fx.tickTimer <= 0) {
            fx.tickTimer = 0.8;
            const dotDmg = Math.max(1, Math.round(fx.value));
            player.hp = Math.max(player.undyingTimer > 0 ? 1 : 0, player.hp - dotDmg);
            this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: `☠️ -${dotDmg}`, color: '#22c55e', size: 14 });
          } else if (fx.type === 'burn' && fx.tickTimer <= 0) {
            fx.tickTimer = 0.6;
            const dotDmg = Math.max(1, Math.round(fx.value));
            player.hp = Math.max(player.undyingTimer > 0 ? 1 : 0, player.hp - dotDmg);
            this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: `🔥 -${dotDmg}`, color: '#f97316', size: 14 });
          } else if (fx.type === 'chill') {
            isChilled = true;
          }

          if (player.hp <= 0 && !player.isDead) this.phoenixRebirth(player);
          if (player.hp <= 0 && !player.isDead) {
            player.hp = 0;
            player.isDead = true;
            player.respawnTimer = 5.0;
            this.emitZone(player.zone, 'player_died', { playerId: player.id, killerName: fx.type.toUpperCase() });
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

      const sprintBonus = (player.sprintTimer && player.sprintTimer > 0) ? 1.35 : 1.0;

      if (player.moveDir.dx !== 0 || player.moveDir.dy !== 0) {
        const screenLen = Math.hypot(player.moveDir.dx, player.moveDir.dy);
        const normScreenX = player.moveDir.dx / screenLen;
        const normScreenY = player.moveDir.dy / screenLen;

        const worldDx = (normScreenX + normScreenY * 2) * 0.5;
        const worldDy = (normScreenY * 2 - normScreenX) * 0.5;

        const speedFactor = player.speed * (player.speedFactor || 1.0) * sprintBonus * 0.65;
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
      if (player.aimFacing && !(player.faceLockTimer > 0)) player.facing = player.aimFacing;

      if (moveX !== 0 || moveY !== 0) {
        const nextX = player.x + moveX;
        const nextY = player.y + moveY;
        const fromX = player.x, fromY = player.y;

        if (!this.isColliding(nextX, nextY, player.zone)) {
          player.x = nextX;
          player.y = nextY;
        } else if (!this.isColliding(nextX, player.y, player.zone)) {
          player.x = nextX;
        } else if (!this.isColliding(player.x, nextY, player.zone)) {
          player.y = nextY;
        }
        // Walking into a wall: stand still instead of running on the spot
        if (Math.hypot(player.x - fromX, player.y - fromY) < Math.hypot(moveX, moveY) * 0.15) {
          player.isMoving = false;
          player.targetX = null;
          player.targetY = null;
        }
      }

      // Auto-Loot System: Automatically collect ground loot within 1.8 tiles
      const groundMap = this.getGroundItemsMap(player.zone);
      for (const item of groundMap.values()) {
        const d = Math.hypot(item.x - player.x, item.y - player.y);
        if (d <= 1.8) {
          this.handlePickupItem(player.id, item.id);
        }
      }

    }

    this.ctxInstanceId = null;

    // Update Town and Field Mobs
    this.updateMobsList(this.townMobs, 'town', dt);
    for (const [fieldId, field] of this.fields) { this.updateMobsList(field.mobs, fieldId, dt); this.updateFieldProps(field, fieldId); }

    // Field raid / world boss schedule & live leaderboards
    this.updateRaidEvents();

    // Update Dungeon Mobs per Instance
    for (const inst of this.dungeonInstances.values()) {
      const commanderMobs = [];
      for (const mob of inst.mobs.values()) {
        if (mob.state !== 'dead' && mob.isCommander && mob.auraRadius > 0) {
          commanderMobs.push(mob);
        }
        mob.hasCommanderBuff = false;
      }

      if (commanderMobs.length > 0) {
        // Bucket commanders on a grid as coarse as the widest aura, so each mob
        // only checks the commanders in its own and the 8 surrounding cells
        const cell = Math.max(...commanderMobs.map(c => c.auraRadius));
        const buckets = new Map<any, any>();
        for (const cmdr of commanderMobs) {
          const k = Math.floor(cmdr.x / cell) + ',' + Math.floor(cmdr.y / cell);
          if (!buckets.has(k)) buckets.set(k, []);
          buckets.get(k).push(cmdr);
        }
        for (const mob of inst.mobs.values()) {
          if (mob.state === 'dead' || mob.isCommander) continue;
          const cx = Math.floor(mob.x / cell), cy = Math.floor(mob.y / cell);
          search:
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const near = buckets.get((cx + dx) + ',' + (cy + dy));
              if (!near) continue;
              for (const cmdr of near) {
                if (Math.hypot(mob.x - cmdr.x, mob.y - cmdr.y) <= cmdr.auraRadius) {
                  mob.hasCommanderBuff = true;
                  break search;
                }
              }
            }
          }
        }
      }
      this.ctxInstanceId = inst.id;
      this.updateMobsList(inst.mobs, 'dungeon', dt, inst.id);
      if (inst.rift) this.updateRift(inst, dt);
      else this.updateDungeonRooms(inst);
      this.ctxInstanceId = null;
    }

    // 3. Update Projectiles
    for (const [projId, proj] of this.projectiles.entries()) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;

      this.ctxInstanceId = proj.instanceId || null;
      const mobsMap = this.getMobsMap(proj.zone);
      let hit = false;
      for (const mob of mobsMap.values()) {
        if (mob.state === 'dead') continue;
        if (Math.hypot(mob.x - proj.x, mob.y - proj.y) < 0.8) {
          const caster = this.players.get(proj.casterId);
          if (caster) {
            this.applyDamageToMob(caster, mob, proj.damage, proj.crit);
            if (proj.splash > 0) this.applyProjectileSplash(caster, proj, mob, mobsMap);
          }
          hit = true;
          break;
        }
      }

      if (hit || proj.life <= 0 || this.isColliding(proj.x, proj.y, proj.zone, 0.2)) {
        this.emitZone(proj.zone, 'projectile_exploded', { id: proj.id, x: proj.x, y: proj.y, element: proj.element, cardId: proj.cardId, splash: proj.splash > 0, radius: MAGE_SPLASH_RADIUS });
        this.projectiles.delete(projId);
      }
    }
    this.ctxInstanceId = null;
  }

  updateMobsList(mobsMap, zone, dt, instanceId = null) {
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') {
        if (zone === 'dungeon' || (mob.id && mob.id.startsWith('dungeon_'))) {
          // Dungeon mobs NEVER respawn during an active run! Must leave and re-enter.
          continue;
        }
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

      // Still rising from its room's summon: no AI yet
      if (mob.spawnUntil) {
        if (Date.now() < mob.spawnUntil) continue;
        mob.spawnUntil = 0;
      }

      if (mob.attackCooldown > 0) mob.attackCooldown = Math.max(0, mob.attackCooldown - dt);

      // Mob Status Effects (Chill, Burn DoT, Poison DoT). A DoT kill is
      // credited to the last hero who hit the mob, if still in this zone.
      const dotOwner = () => {
        const p = mob.lastHitBy && this.players.get(mob.lastHitBy);
        return p && p.zone === zone && !p.isDead && (!instanceId || p.dungeonInstanceId === instanceId) ? p : null;
      };
      if (mob.chillTimer > 0) {
        mob.chillTimer = Math.max(0, mob.chillTimer - dt);
      }
      if (mob.burnTimer > 0) {
        mob.burnTimer = Math.max(0, mob.burnTimer - dt);
        mob.burnTickTimer = (mob.burnTickTimer || 0) - dt;
        if (mob.burnTickTimer <= 0) {
          mob.burnTickTimer = 0.6;
          const dotDmg = Math.max(1, Math.round(mob.burnDmg || 8));
          mob.hp -= dotDmg;
          this.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.7, text: `🔥 -${dotDmg}`, color: '#f97316', size: 14 }, instanceId);
          if (mob.hp <= 0) {
            this.handleMobDeath(mob, dotOwner());
            continue;
          }
        }
        if (mob.burnTimer <= 0) mob.burnDmg = 0; // next ignite starts fresh
      }
      if (mob.poisonTimer > 0) {
        mob.poisonTimer = Math.max(0, mob.poisonTimer - dt);
        mob.poisonTickTimer = (mob.poisonTickTimer || 0) - dt;
        if (mob.poisonTickTimer <= 0) {
          mob.poisonTickTimer = 0.8;
          const dotDmg = Math.max(1, Math.round(mob.poisonDmg || 6));
          mob.hp -= dotDmg;
          const stackTag = mob.poisonStacks > 1 ? ` x${mob.poisonStacks}` : '';
          this.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.7, text: `☠️ -${dotDmg}${stackTag}`, color: '#22c55e', size: 14 }, instanceId);
          if (mob.hp <= 0) {
            this.handleMobDeath(mob, dotOwner());
            continue;
          }
        }
        if (mob.poisonTimer <= 0) { mob.poisonDmg = 0; mob.poisonStacks = 0; }
      }
      if (mob.shadowMarkTimer > 0) mob.shadowMarkTimer = Math.max(0, mob.shadowMarkTimer - dt);
      if (mob.staticCharge > 0) mob.staticCharge = Math.max(0, mob.staticCharge - dt);
      if (mob.conductTimer > 0) { mob.conductTimer -= dt; if (mob.conductTimer <= 0) mob.conduct = 0; }
      if (mob.scorchTimer > 0) { mob.scorchTimer -= dt; if (mob.scorchTimer <= 0) mob.scorchStacks = 0; }
      if (mob.frostTimer > 0) { mob.frostTimer -= dt; if (mob.frostTimer <= 0) mob.frostStacks = 0; }
      // Bosses run their telegraphed moveset; while one winds up, charges or roars it skips
      // the plain chase / melee below (bossMechanics.ts)
      if (mob.mechanics && this.bossMech.update(mob, zone, dt, instanceId)) continue;

      // Frozen solid (Cryo) or stopped in time (Chrono): no moving, no attacking
      if (mob.frozenTimer > 0) {
        mob.frozenTimer = Math.max(0, mob.frozenTimer - dt);
        mob.attackCooldown = Math.max(mob.attackCooldown, 0.3);
        continue;
      }

      // Eternal Rift monsters march on the Holy Fountain instead of idling
      if (mob.riftMob) {
        const riftInst = instanceId && this.dungeonInstances.get(instanceId);
        if (riftInst && riftInst.rift) this.updateRiftMob(mob, riftInst, dt);
        continue;
      }

      if (mob.state === 'idle') {
        let closestPlayer = null;
        // a boss notices anyone who steps into its arena
        let closestDist = mob.mechanics === 'boss' ? 16.0 : 5.0;

        for (const p of this.players.values()) {
          if (p.isDead || p.zone !== zone || (instanceId && p.dungeonInstanceId !== instanceId)) continue;
          const d = Math.hypot(p.x - mob.x, p.y - mob.y);
          if (d < closestDist) {
            closestDist = d;
            closestPlayer = p;
          }
        }

        if (closestPlayer) {
          mob.state = 'chase';
          mob.targetPlayerId = closestPlayer.id;
          // Wind-up so freshly aggroed mobs don't all land a hit the instant they arrive
          mob.attackCooldown = Math.max(mob.attackCooldown, 0.6 + Math.random() * 0.5);
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

        // bosses fight across their whole arena; everything else gives up a short way from home
        if (distToPlayer > (mob.mechanics === 'boss' ? 30 : 10.0) || distToSpawn > (mob.mechanics === 'boss' ? 40 : 14.0)) {
          mob.state = 'return';
          mob.targetPlayerId = null;
          continue;
        }

        if (distToPlayer <= 1.2) {
          mob.facing = this.calculateFacing(mob.x, mob.y, targetPlayer.x, targetPlayer.y);
          // Brief global hit lockout per player so a whole pack can't machine-gun one target
          const now = Date.now();
          if (mob.attackCooldown <= 0 && now < (targetPlayer.nextMobHitAt || 0)) {
            mob.attackCooldown = 0.15 + Math.random() * 0.2;
          } else if (mob.attackCooldown <= 0) {
            mob.attackCooldown = 1.2 + Math.random() * 0.5; // jitter desyncs packs
            targetPlayer.nextMobHitAt = now + (mob.isBoss ? 150 : 350);

            this.mobStrikePlayer(mob, targetPlayer, zone);
          }
        } else {
          let effectiveSpeed = mob.hasCommanderBuff ? mob.speed * 1.25 : mob.speed;
          if (mob.chillTimer > 0) effectiveSpeed *= 0.5;
          const step = Math.min(distToPlayer, effectiveSpeed * dt);
          const mx = ((targetPlayer.x - mob.x) / distToPlayer) * step;
          const my = ((targetPlayer.y - mob.y) / distToPlayer) * step;

          // slide along pillars and pools instead of sticking to them
          if (!this.isColliding(mob.x + mx, mob.y + my, zone)) {
            mob.x += mx;
            mob.y += my;
          } else if (Math.abs(mx) > 1e-4 && !this.isColliding(mob.x + Math.sign(mx) * step, mob.y, zone)) {
            mob.x += Math.sign(mx) * step;
          } else if (Math.abs(my) > 1e-4 && !this.isColliding(mob.x, mob.y + Math.sign(my) * step, zone)) {
            mob.y += Math.sign(my) * step;
          }
          mob.facing = this.calculateFacing(mob.x, mob.y, targetPlayer.x, targetPlayer.y);
        }
      } else if (mob.state === 'return') {
        const distToSpawn = Math.hypot(mob.spawnX - mob.x, mob.spawnY - mob.y);
        if (distToSpawn > 0.2) {
          mob.facing = this.calculateFacing(mob.x, mob.y, mob.spawnX, mob.spawnY);
          const step = Math.min(distToSpawn, (mob.speed * 1.2) * dt);
          mob.x += ((mob.spawnX - mob.x) / distToSpawn) * step;
          mob.y += ((mob.spawnY - mob.y) / distToSpawn) * step;
          mob.hp = Math.min(mob.maxHp, mob.hp + (mob.maxHp * 0.2 * dt));
        } else {
          mob.state = 'idle';
          mob.hp = mob.maxHp;
          if (mob.mechanics) this.bossMech.reset(mob);
        }
      }
    }
  }

  // ==========================================
  // ETERNAL RIFT (wave defence; tuning in eternalRift.ts)
  // A rift run is a dungeon instance with a `rift` state: the zone stays
  // 'dungeon', so rooms, snapshots, combat and parties all work unchanged.
  // ==========================================
  getRiftInstance(player) {
    const inst = this.getPlayerDungeonInstance(player);
    return inst && inst.rift ? inst : null;
  }

  riftHeroes(inst) {
    return (Array.from(this.players.values()) as any[]).filter(p => p.zone === 'dungeon' && p.dungeonInstanceId === inst.id);
  }

  riftOver(R) {
    return R.phase === 'victory' || R.phase === 'defeat';
  }

  // What the town gate shows before entering: is the party already in there?
  riftPortalInfo(player) {
    const inst = player.partyId ? this.dungeonInstances.get(`rift_party_${player.partyId}`) : null;
    const live = inst && inst.rift && !this.riftOver(inst.rift) ? inst.rift : null;
    return { partyRun: live ? { wave: live.wave, phase: live.phase } : null, inParty: !!player.partyId };
  }

  handleEnterRift(socketId, options: any = {}) {
    const player = this.players.get(socketId);
    if (!player || player.zone !== 'town' || player.isDead) return;
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return;
    const id = player.partyId ? `rift_party_${player.partyId}` : `rift_solo_${player.id}`;
    let inst = this.dungeonInstances.get(id);
    if (inst && this.riftOver(inst.rift)) {
      if (this.riftHeroes(inst).length) {
        socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: '⏳ Your party\'s last rift run is still closing...', color: '#facc15' });
        return;
      }
      this.dungeonInstances.delete(id);
      inst = null;
    }
    if (inst) socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `🌌 Joining your party at wave ${Math.max(1, inst.rift.wave)}!`, color: '#c084fc' });
    else inst = this.createRiftInstance(id, player, options && options.mode);
    this.joinRift(player, socket, inst);
    if (options && options.inviteParty) this.handlePartySummon(socketId);
  }

  createRiftInstance(id, leader, modeId = 'normal') {
    // Normal and Hard start at a fixed level; Nightmare follows the party
    // members online when it opens (and spawns twice the monsters)
    const mode = RIFT.RIFT_MODES[modeId] ? modeId : 'normal';
    const M = RIFT.riftMode(mode);
    const party = leader.partyId && this.parties.get(leader.partyId);
    const members = party ? [...party.memberIds].map(m => this.players.get(m)).filter(Boolean) : [leader];
    const avgLevel = members.reduce((t, p) => t + (p.level || 1), 0) / members.length;
    const baseLevel = M.start !== null ? M.start : Math.max(1, Math.round(avgLevel) - 2);
    const fountainHp = RIFT.fountainMaxHp(baseLevel, members.length);
    const inst: any = createRiftInstance({
      id,
      partyId: leader.partyId || null,
      dungeon: RIFT.generateRiftArena(),
      baseLevel,
      mode,
      perWave: M.perWave,
      spawnMult: M.spawn,
      fountainHp
    });
    this.dungeonInstances.set(id, inst);
    return inst;
  }

  // Put a hero in the arena (from the town gate or a party summon).
  // Returns false if that run has already ended.
  joinRift(player, socket, inst, at = null) {
    const R = inst.rift;
    if (this.riftOver(R)) return false;
    player.dungeonRun = null;
    player.dungeonInstanceId = inst.id;
    player.portalCooldown = 4.0;
    player.zone = 'dungeon';
    player.x = at ? at.x : RIFT.RIFT_SPAWN.x + (Math.random() - 0.5) * 1.2;
    player.y = at ? at.y : RIFT.RIFT_SPAWN.y + (Math.random() - 0.5) * 0.6;
    player.targetX = null;
    player.targetY = null;
    if (!R.points.has(player.id)) R.points.set(player.id, 0);
    if (!R.banked.has(player.id)) R.banked.set(player.id, { gold: 0, essence: 0 });

    if (socket) {
      if (player._room) socket.leave(player._room);
      player._room = `dungeon:${inst.id}`;
      socket.join(player._room);
      socket.emit('zone_change', {
        zone: 'dungeon',
        rift: true,
        map: inst.dungeon,
        floorLevel: 0,
        difficulty: 'rift',
        player,
        players: this.riftHeroes(inst),
        mobs: (Array.from(inst.mobs.values()) as any[]).filter(m => m.state !== 'dead'),
        groundItems: [],
        chests: []
      });
      socket.emit('rift_state', this.riftStatePayload(inst));
    }
    this.broadcastSystemMessage(`🌌 [${player.name}] stepped into the Eternal Rift to defend the Holy Fountain!`);
    return true;
  }

  riftStatePayload(inst) {
    const R = inst.rift;
    let alive = 0;
    for (const m of inst.mobs.values()) if (m.state !== 'dead') alive++;
    const upcoming = Math.min(RIFT.RIFT_MAX_WAVES, R.phase === 'wave' || this.riftOver(R) ? Math.max(1, R.wave) : R.wave + 1);
    return {
      phase: R.phase,
      wave: R.wave,
      upcoming,
      maxWaves: RIFT.RIFT_MAX_WAVES,
      checkpointEvery: RIFT.RIFT_CHECKPOINT_EVERY,
      timer: Math.max(0, Math.ceil(R.timer)),
      level: RIFT.waveLevel(R.baseLevel, upcoming, R.perWave), mode: R.mode,
      fountain: { hp: Math.round(R.fountain.hp), maxHp: R.fountain.maxHp },
      structures: R.structures.map(s => ({ id: s.id, kind: s.kind, x: s.x, y: s.y, hp: Math.round(s.hp), maxHp: s.maxHp, owner: s.ownerName })),
      points: Object.fromEntries(R.points),
      banked: Object.fromEntries(R.banked),
      choices: Object.fromEntries(R.choices),
      remaining: alive + R.queue.length
    };
  }

  emitRiftState(inst) {
    inst.rift.stateClock = 0.25;
    this.emitZone('dungeon', 'rift_state', this.riftStatePayload(inst), inst.id);
  }

  // Every tick, per rift instance (ctxInstanceId is this instance)
  updateRift(inst, dt) {
    const R = inst.rift;
    const heroes = this.riftHeroes(inst);
    // the slain linger a moment for their death animation, then go
    const now = Date.now();
    for (const [id, m] of inst.mobs) {
      if (m.state !== 'dead') continue;
      if (!m.diedAt) m.diedAt = now;
      else if (now - m.diedAt > 3000) inst.mobs.delete(id);
    }

    if (this.riftOver(R)) {
      R.timer -= dt;
      if (R.timer <= 0) {
        for (const p of heroes) this.leaveRift(p, this.io.sockets.sockets.get(p.id));
      }
    } else if (heroes.length) {
      this.updateRiftStructures(inst, dt, heroes);
      R.timer -= dt;
      if (R.phase === 'prep' || R.phase === 'break') {
        if (R.timer <= 0) this.startRiftWave(inst, R.wave + 1, heroes.length);
      } else if (R.phase === 'choice') {
        // no answer when the timer runs out counts as "continue"
        const undecided = heroes.some(p => R.choices.get(p.id) !== 'continue');
        if (R.timer <= 0 || !undecided) {
          R.choices.clear();
          R.phase = 'break';
          R.timer = 4;
          this.emitRiftState(inst);
        }
      } else if (R.phase === 'wave') {
        let alive = 0;
        for (const m of inst.mobs.values()) if (m.state !== 'dead') alive++;
        R.spawnClock -= dt;
        while (R.queue.length && R.spawnClock <= 0 && alive < RIFT.RIFT_MAX_MOBS_ALIVE * (R.spawnMult || 1)) {
          this.spawnRiftMob(inst, R.queue.shift());
          alive++;
          R.spawnClock += R.spawnEvery;
        }
        if (R.spawnClock < 0) R.spawnClock = 0; // held back by the cap: resume at once
        if (!R.queue.length && alive === 0) this.riftWaveCleared(inst, heroes);
      }
    }

    R.stateClock -= dt;
    if (R.stateClock <= 0 && heroes.length) this.emitRiftState(inst);
  }

  startRiftWave(inst, wave, heroCount) {
    const R = inst.rift;
    R.wave = wave;
    R.phase = 'wave';
    R.timer = 0;
    R.queue = RIFT.buildRiftWave(wave, R.baseLevel, heroCount, R.mode);
    R.spawnEvery = RIFT.spawnInterval(wave, R.queue.length);
    R.spawnClock = 0;
    const boss = wave === RIFT.RIFT_MAX_WAVES;
    this.emitZone('dungeon', 'rift_wave', {
      wave, maxWaves: RIFT.RIFT_MAX_WAVES, level: RIFT.waveLevel(R.baseLevel, wave, R.perWave), count: R.queue.length,
      boss, elite: !boss && wave % RIFT.RIFT_CHECKPOINT_EVERY === 0
    }, inst.id);
    this.emitRiftState(inst);
  }

  // A monster steps out of one of the four gates (in turn)
  spawnRiftMob(inst, def) {
    const R = inst.rift;
    const gate = RIFT.RIFT_GATES[R.gateTurn++ % RIFT.RIFT_GATES.length];
    const x = gate.x + (Math.random() - 0.5) * 1.6;
    const y = gate.y + (Math.random() - 0.5) * 1.6;
    const id = `rift_mob_${this.nextEntityId++}`;
    const mob = MobFactory.riftMob(def, inst.id, id, x, y);
    inst.mobs.set(id, mob);
    this.emitZone('dungeon', 'dungeon_mobs_spawned', { mobs: [{ id, x, y, isBoss: !!mob.isBoss, element: mob.element || 'neutral' }] }, inst.id);
  }

  riftWaveCleared(inst, heroes) {
    const R = inst.rift;
    const wave = R.wave;
    // a clear bonus for everyone holding the line, so supports can build too
    const bonus = 10 * wave;
    for (const p of heroes) R.points.set(p.id, (R.points.get(p.id) || 0) + bonus);
    const checkpoint = wave % RIFT.RIFT_CHECKPOINT_EVERY === 0 || wave >= RIFT.RIFT_MAX_WAVES;
    let reward = null;
    if (checkpoint) {
      reward = RIFT.checkpointReward(wave, R.baseLevel);
      for (const p of heroes) {
        const b = R.banked.get(p.id) || { gold: 0, essence: 0 };
        b.gold += reward.gold;
        b.essence += reward.essence;
        R.banked.set(p.id, b);
      }
    }
    this.emitZone('dungeon', 'rift_wave_cleared', { wave, bonus, reward }, inst.id);
    if (wave >= RIFT.RIFT_MAX_WAVES) {
      this.finishRift(inst, true);
      return;
    }
    if (checkpoint) {
      R.phase = 'choice';
      R.timer = RIFT.RIFT_CHOICE_S;
      R.choices.clear();
      this.emitZone('dungeon', 'rift_checkpoint', {
        wave, seconds: RIFT.RIFT_CHOICE_S, nextLevel: RIFT.waveLevel(R.baseLevel, wave + 1, R.perWave)
      }, inst.id);
    } else {
      R.phase = 'break';
      R.timer = RIFT.RIFT_BREAK_S;
    }
    this.emitRiftState(inst);
  }

  // The fountain fell (defeat) or the last wave was cleared (victory).
  // Victory pays every hero's bank now; defeat forfeits it.
  finishRift(inst, victory) {
    const R = inst.rift;
    R.phase = victory ? 'victory' : 'defeat';
    R.timer = victory ? 8 : 5;
    R.queue = [];
    for (const p of this.riftHeroes(inst)) {
      const bank = R.banked.get(p.id) || { gold: 0, essence: 0 };
      const socket = this.io.sockets.sockets.get(p.id);
      if (victory) this.payRiftReward(p, bank);
      if (socket) {
        socket.emit('rift_result', { success: victory, victory, wave: R.wave, gold: bank.gold, essence: bank.essence });
        if (victory) socket.emit('player_updated', p);
      }
      R.banked.set(p.id, { gold: 0, essence: 0 });
    }
    this.broadcastSystemMessage(victory
      ? `🏆 The Holy Fountain stands! A party cleared all ${RIFT.RIFT_MAX_WAVES} waves of the Eternal Rift!`
      : `💔 The Holy Fountain fell at wave ${R.wave} of the Eternal Rift.`);
    this.emitRiftState(inst);
  }

  payRiftReward(player, bank) {
    if (bank.gold > 0) player.gold += bank.gold;
    if (bank.essence > 0) {
      const stack = player.inventory.items.find(i => i && i.id === RIFT.RIFT_ESSENCE_ID);
      if (stack) stack.count = (stack.count || 1) + bank.essence;
      else if (player.inventory.items.length < (player.inventory.maxSlots || DEFAULT_BAG_SLOTS)) player.inventory.items.push(ItemFactory.stack(ITEMS[RIFT.RIFT_ESSENCE_ID], bank.essence));
      else {
        // a full bag never eats essence: it goes to the personal chest instead
        if (!player.storage) player.storage = { maxSlots: 50, items: [] };
        const stored = player.storage.items.find(i => i && i.id === RIFT.RIFT_ESSENCE_ID);
        if (stored) stored.count = (stored.count || 1) + bank.essence;
        else player.storage.items.push(ItemFactory.stack(ITEMS[RIFT.RIFT_ESSENCE_ID], bank.essence));
        const socket = this.io.sockets.sockets.get(player.id);
        if (socket) socket.emit('chat_message', { sender: 'System', text: `📦 Your bag was full: ${bank.essence} Rift Essence went to your Personal Storage Chest.`, color: '#c084fc' });
      }
    }
    this.savePlayerAccount(player.id);
  }

  // Walking out (the Leave button, a checkpoint "leave", or the run ending).
  // Only a checkpoint prompt pays the bank; leaving mid-wave forfeits it.
  leaveRift(player, socket) {
    const inst = this.getRiftInstance(player);
    if (!inst) return;
    const R = inst.rift;
    if (!this.riftOver(R)) {
      const bank = R.banked.get(player.id) || { gold: 0, essence: 0 };
      const cashOut = R.phase === 'choice';
      if (cashOut) this.payRiftReward(player, bank);
      if (socket) socket.emit('rift_result', { success: cashOut, victory: false, left: true, wave: R.wave, gold: bank.gold, essence: bank.essence });
      if (cashOut) this.broadcastSystemMessage(`🌌 [${player.name}] left the Eternal Rift after wave ${R.wave} with ${bank.essence} Rift Essence.`);
    }
    R.points.delete(player.id);
    R.banked.delete(player.id);
    R.choices.delete(player.id);
    if (player.isDead) {
      player.isDead = false;
      player.hp = Math.max(1, Math.round(player.maxHp * 0.5));
    }
    player.riftRespawnSet = false;
    if (socket) this.teleportPlayerToTown(player, socket, RIFT_TOWN_ARRIVAL);
    else {
      player.dungeonInstanceId = null;
      player.zone = 'town';
      this.cleanupDungeonInstanceIfEmpty(inst.id);
    }
  }

  handleRiftChoice(socketId, data) {
    const player = this.players.get(socketId);
    const inst = player && this.getRiftInstance(player);
    if (!inst || inst.rift.phase !== 'choice') return;
    if (data && data.choice === 'leave') {
      this.leaveRift(player, this.io.sockets.sockets.get(socketId));
      return;
    }
    inst.rift.choices.set(player.id, 'continue');
    this.emitRiftState(inst);
  }

  // Buy a structure with Rift Points and place it at (x, y), or a blessing
  handleRiftBuild(socketId, data) {
    const player = this.players.get(socketId);
    const socket = this.io.sockets.sockets.get(socketId);
    const inst = player && this.getRiftInstance(player);
    if (!inst || !socket || player.isDead || !data) return;
    const R = inst.rift;
    const def = RIFT.RIFT_STRUCTURES[data.kind];
    if (!def || this.riftOver(R)) return;
    const say = (text, color = '#ef4444') => socket.emit('floating_text', { x: player.x, y: player.y - 0.8, text, color });
    const points = R.points.get(player.id) || 0;
    if (points < def.cost) return say(`Need ${def.cost} Rift Points (you have ${points})`);
    const F = R.fountain;

    if (def.instant) {
      if (F.hp >= F.maxHp) return say('The fountain is already whole');
      const heal = Math.round(F.maxHp * def.restore);
      F.hp = Math.min(F.maxHp, F.hp + heal);
      R.points.set(player.id, points - def.cost);
      this.emitZone('dungeon', 'skill_fx', { type: 'holy_resurrection', x: RIFT.RIFT_FOUNTAIN.x, y: RIFT.RIFT_FOUNTAIN.y, radius: 3 }, inst.id);
      this.emitZone('dungeon', 'floating_text', { x: RIFT.RIFT_FOUNTAIN.x, y: RIFT.RIFT_FOUNTAIN.y - 1.6, text: `✨ +${heal} Fountain HP`, color: '#fde68a', size: 18 }, inst.id);
      this.emitRiftState(inst);
      return;
    }

    const x = Number(data.x), y = Number(data.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (Math.hypot(x - player.x, y - player.y) > RIFT.RIFT_STRUCT_REACH) return say('Too far away - build closer to you');
    if (R.structures.filter(s => s.kind === data.kind).length >= def.max) return say(`At most ${def.max} ${def.name}s per run`);
    const FT = RIFT.RIFT_FOUNTAIN;
    if (Math.hypot(x - FT.x, y - FT.y) < FT.radius + def.radius + 0.8) return say('Too close to the fountain');
    if (RIFT.RIFT_GATES.some(g => Math.hypot(x - g.x, y - g.y) < 2.5)) return say('Too close to a rift gate');
    if (R.structures.some(s => Math.hypot(s.x - x, s.y - y) < s.radius + def.radius + 0.1)) return say('Something is already built there');
    if (this.isColliding(x, y, 'dungeon', def.radius)) return say("Can't build there");

    const maxHp = Math.round(def.hp + def.hpPerLevel * R.baseLevel);
    R.structures.push({
      id: `rs_${++R.structSeq}`, kind: data.kind, x, y, hp: maxHp, maxHp, radius: def.radius,
      ownerId: player.id, ownerName: player.name, clock: 0.5
    });
    R.points.set(player.id, points - def.cost);
    this.emitZone('dungeon', 'floating_text', { x, y: y - 0.6, text: `🏗️ ${def.name}`, color: '#facc15', size: 15 }, inst.id);
    this.emitRiftState(inst);
  }

  // Turrets fire, frost spires pulse, totems heal; the builder's attack powers them
  updateRiftStructures(inst, dt, heroes) {
    const R = inst.rift;
    if (!R.structures.length) return;
    const now = Date.now();
    const foes = (Array.from(inst.mobs.values()) as any[]).filter(m => m.state !== 'dead' && !(m.spawnUntil && now < m.spawnUntil));
    for (const s of R.structures) {
      const def = RIFT.RIFT_STRUCTURES[s.kind];
      if (!def.every) continue;
      s.clock -= dt;
      if (s.clock > 0) continue;
      s.clock = def.every;
      // a structure keeps working for the party after its builder leaves
      const owner = heroes.find(p => p.id === s.ownerId) || heroes[0];
      if (s.kind === 'turret') {
        let target = null, best = def.range;
        for (const m of foes) {
          const d = Math.hypot(m.x - s.x, m.y - s.y);
          if (d <= best) { best = d; target = m; }
        }
        if (!target) { s.clock = 0.2; continue; }
        this.spawnRiftBolt(inst, s, owner, target, Math.max(1, Math.round(owner.dmg * def.dmgShare)));
      } else if (s.kind === 'frost') {
        const caught = foes.filter(m => Math.hypot(m.x - s.x, m.y - s.y) <= def.range);
        if (!caught.length) { s.clock = 0.3; continue; }
        this.emitZone('dungeon', 'skill_fx', { type: 'rift_frost', x: s.x, y: s.y, radius: def.range }, inst.id);
        for (const m of caught) {
          m.chillTimer = Math.max(m.chillTimer || 0, def.chill);
          this.applyDamageToMob(owner, m, Math.max(1, Math.round(owner.dmg * def.dmgShare)), false);
        }
      } else if (s.kind === 'totem') {
        for (const p of heroes) {
          if (p.isDead || Math.hypot(p.x - s.x, p.y - s.y) > def.range || p.hp >= p.maxHp) continue;
          p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * def.heal));
        }
        const F = R.fountain;
        if (Math.hypot(RIFT.RIFT_FOUNTAIN.x - s.x, RIFT.RIFT_FOUNTAIN.y - s.y) <= def.range + RIFT.RIFT_FOUNTAIN.radius) {
          F.hp = Math.min(F.maxHp, F.hp + F.maxHp * def.fountainHeal);
        }
      }
    }
  }

  // A turret bolt: an ordinary projectile that starts at the turret
  spawnRiftBolt(inst, s, owner, target, damage) {
    const id = `proj_${this.nextEntityId++}`;
    const angle = Math.atan2(target.y - s.y, target.x - s.x);
    const speed = 11;
    const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed;
    this.projectiles.set(id, createProjectile({
      cardId: null, instanceId: inst.id, id, zone: 'dungeon', casterId: owner.id,
      x: s.x, y: s.y, targetX: target.x, targetY: target.y, targetId: target.id, targetType: 'mob',
      vx, vy, damage, splash: 0, crit: false, element: 'holy', life: 1.0, color: '#fde68a'
    }));
    this.emitZone('dungeon', 'projectile_spawned', {
      id, zone: 'dungeon', x: s.x, y: s.y, vx, vy, casterId: null, element: 'holy', cardId: null, splash: 0, color: '#fde68a'
    }, inst.id);
  }

  // Rift monster AI: march on the fountain; turn on a hero who comes close;
  // a structure in the way gets torn down first
  updateRiftMob(mob, inst, dt) {
    const R = inst.rift;
    if (this.riftOver(R)) return;
    const F = RIFT.RIFT_FOUNTAIN;
    mob.state = 'chase';

    let hero = mob.targetPlayerId ? this.players.get(mob.targetPlayerId) : null;
    if (hero && (hero.isDead || hero.zone !== 'dungeon' || hero.dungeonInstanceId !== inst.id
      || Math.hypot(hero.x - mob.x, hero.y - mob.y) > RIFT.RIFT_PLAYER_LEASH)) hero = null;
    if (!hero) {
      let best = RIFT.RIFT_PLAYER_AGGRO * (mob.isBoss ? 1.3 : 1);
      for (const p of this.players.values()) {
        if (p.isDead || p.zone !== 'dungeon' || p.dungeonInstanceId !== inst.id) continue;
        const d = Math.hypot(p.x - mob.x, p.y - mob.y);
        if (d < best) { best = d; hero = p; }
      }
    }
    mob.targetPlayerId = hero ? hero.id : null;
    const struct = !hero && mob.structTargetId ? R.structures.find(s => s.id === mob.structTargetId) : null;
    if (!struct) mob.structTargetId = null;

    const goal = hero ? { x: hero.x, y: hero.y, reach: 1.2 }
      : struct ? { x: struct.x, y: struct.y, reach: struct.radius + 0.8 }
        : { x: F.x, y: F.y, reach: F.radius + 0.9 + (mob.isBoss ? 0.8 : 0) };
    const dist = Math.hypot(goal.x - mob.x, goal.y - mob.y);

    if (dist <= goal.reach) {
      mob.facing = this.calculateFacing(mob.x, mob.y, goal.x, goal.y);
      if (mob.attackCooldown > 0) return;
      if (hero) {
        const now = Date.now();
        if (now < (hero.nextMobHitAt || 0)) { mob.attackCooldown = 0.15 + Math.random() * 0.2; return; }
        mob.attackCooldown = 1.2 + Math.random() * 0.5;
        hero.nextMobHitAt = now + (mob.isBoss ? 150 : 350);
        this.mobStrikePlayer(mob, hero, 'dungeon');
        return;
      }
      mob.attackCooldown = (mob.isBoss ? 1.6 : 1.3) + Math.random() * 0.5;
      this.emitZone('dungeon', 'entity_attack_fx', { attackerId: mob.id, attackerType: 'mob', targetId: null, x: mob.x, y: mob.y }, inst.id);
      if (struct) {
        struct.hp -= mob.dmg;
        if (struct.hp <= 0) this.destroyRiftStructure(inst, struct);
      } else {
        this.damageRiftFountain(inst, mob.dmg);
      }
      return;
    }

    let speed = mob.speed || 3;
    if (mob.chillTimer > 0) speed *= 0.5;
    const step = Math.min(dist, speed * dt);
    const nx = (goal.x - mob.x) / dist, ny = (goal.y - mob.y) / dist;
    // returns what stopped the step (a structure, or true for a wall), or null if it moved
    const tryMove = (dx, dy) => {
      const tx = mob.x + dx, ty = mob.y + dy;
      const blocker = R.structures.find(s => Math.hypot(s.x - tx, s.y - ty) < s.radius + 0.35);
      if (blocker) return blocker;
      if (this.isColliding(tx, ty, 'dungeon')) return true;
      mob.x = tx;
      mob.y = ty;
      return null;
    };
    const first = tryMove(nx * step, ny * step);
    if (first) {
      // slide along whatever is in the way; if every way is shut, break the structure
      const side = (Math.abs(nx) > 1e-4 ? tryMove(Math.sign(nx) * step, 0) : true)
        && (Math.abs(ny) > 1e-4 ? tryMove(0, Math.sign(ny) * step) : true);
      if (side && !hero && typeof first === 'object') mob.structTargetId = first.id;
    }
    mob.facing = this.calculateFacing(mob.x, mob.y, goal.x, goal.y);
  }

  damageRiftFountain(inst, dmg) {
    const R = inst.rift;
    const F = R.fountain;
    if (this.riftOver(R)) return;
    F.hp = Math.max(0, F.hp - dmg);
    this.emitZone('dungeon', 'floating_text', { x: RIFT.RIFT_FOUNTAIN.x + (Math.random() - 0.5), y: RIFT.RIFT_FOUNTAIN.y - 1.4, text: `-${Math.round(dmg)}`, color: '#f0abfc', size: 14 }, inst.id);
    if (F.hp <= 0) this.finishRift(inst, false);
  }

  destroyRiftStructure(inst, s) {
    const R = inst.rift;
    R.structures = R.structures.filter(o => o !== s);
    const def = RIFT.RIFT_STRUCTURES[s.kind];
    this.emitZone('dungeon', 'floating_text', { x: s.x, y: s.y - 0.8, text: `💥 ${def.name} destroyed`, color: '#f87171', size: 15 }, inst.id);
    this.emitRiftState(inst);
  }

  onRiftMobDeath(inst, mob, killer) {
    const R = inst.rift;
    mob.diedAt = Date.now();
    if (killer && killer.zone === 'dungeon' && killer.dungeonInstanceId === inst.id) {
      R.points.set(killer.id, (R.points.get(killer.id) || 0) + (mob.riftPoints || 0));
      this.emitZone('dungeon', 'floating_text', { x: mob.x, y: mob.y - 1.1, text: `+${mob.riftPoints} RP`, color: '#d8b4fe', size: 13 }, inst.id);
    }
    if (mob.isBoss || mob.isMiniboss) {
      this.emitZone('dungeon', 'floating_text', { x: mob.x, y: mob.y - 1.6, text: `☠️ ${mob.name.replace(/\s*\[.*\]$/, '')} SLAIN`, color: '#fde68a', size: 22 }, inst.id);
    }
  }

  // Fallen heroes stand up again beside the fountain
  respawnInRift(player, socket) {
    player.isDead = false;
    player.riftRespawnSet = false;
    player.respawnTimer = 0;
    player.hp = Math.max(1, Math.round(player.maxHp * 0.6));
    player.mp = Math.round(player.maxMp * 0.6);
    player.x = RIFT.RIFT_SPAWN.x + (Math.random() - 0.5) * 1.2;
    player.y = RIFT.RIFT_SPAWN.y + (Math.random() - 0.5) * 0.6;
    player.targetX = null;
    player.targetY = null;
    this.emitZone('dungeon', 'player_respawned', { playerId: player.id, x: player.x, y: player.y, onSpot: true }, player.dungeonInstanceId);
    this.emitZone('dungeon', 'skill_fx', { type: 'holy_resurrection', x: player.x, y: player.y, radius: 2.5, playerId: player.id }, player.dungeonInstanceId);
    if (socket) socket.emit('player_updated', player);
  }

  // James the Gatekeeper forges unique gear from Rift Essence
  handleJamesForge(socketId, data) {
    const player = this.players.get(socketId);
    const socket = this.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead || player.zone !== 'town') return;
    const say = (text, color = '#ef4444') => socket.emit('floating_text', { x: player.x, y: player.y - 0.8, text, color });
    const james = this.townMap.obstacles.find(o => o.id === 'npc_james');
    if (!james || Math.hypot(james.x - player.x, james.y - player.y) > 4.5) return say('Walk up to James first');
    const recipe = RIFT.JAMES_RECIPES.find(r => r.itemId === (data && data.itemId));
    const def = recipe && ITEMS[recipe.itemId];
    if (!def) return;
    const items = player.inventory.items;
    const essenceStack = items.find(i => i && i.id === RIFT.RIFT_ESSENCE_ID);
    const essence = essenceStack ? (essenceStack.count || 1) : 0;
    if (essence < recipe.essence) return say(`Need ${recipe.essence} Rift Essence (you have ${essence})`);
    if ((player.gold || 0) < recipe.gold) return say(`Need ${recipe.gold.toLocaleString()} gold`);
    if (recipe.fragments && this.fragmentCount(player) < recipe.fragments) return say(`Need ${recipe.fragments} Spirit Fragments`);
    // a slot for the new piece (spending the whole essence stack frees one)
    if (items.length >= (player.inventory.maxSlots || DEFAULT_BAG_SLOTS) && essence > recipe.essence) return say('⚠️ Inventory full!');

    essenceStack.count = essence - recipe.essence;
    if (essenceStack.count <= 0) items.splice(items.indexOf(essenceStack), 1);
    player.gold -= recipe.gold;
    if (recipe.fragments) this.spendFragments(player, recipe.fragments);
    const item = ItemFactory.forged(def);
    items.push(item);

    socket.emit('player_updated', player);
    socket.emit('james_forge_result', { success: true, item });
    say(`⚒️ James forged ${def.name}!`, '#c084fc');
    this.broadcastSystemMessage(`🌌 [${player.name}] had James the Gatekeeper forge the legendary [${def.name}]!`);
    this.savePlayerAccount(socketId);
  }

  absorbIncomingDamage(player, damage, zone) {
    return this.passives.absorbIncomingDamage(player, damage, zone);
  }

  // ===== SET EFFECTS (armor set 4-piece bonuses, data/items/sets.json) =====

  // Wayfarer's Resolve: Second Wind when HP falls under the threshold
  checkSecondWind(player, zone) {
    const sw = player.set4 && player.set4.wayfarer;
    const now = Date.now();
    if (!sw || player.isDead || player.hp <= 0 || player.hp > player.maxHp * sw.hpThreshold) return;
    if ((player.secondWindReadyAt || 0) > now) return;
    player.secondWindReadyAt = now + sw.cooldown * 1000;
    const shield = Math.round(player.maxHp * sw.shieldPct);
    player.shieldHp = (player.shieldHp || 0) + shield;
    player.sprintTimer = Math.max(player.sprintTimer || 0, sw.hasteSec);
    if (player.statusEffects) player.statusEffects = player.statusEffects.filter(e => e.type !== 'chill');
    player.speedFactor = 1.0;
    this.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 1.0, text: `🌿 SECOND WIND! +${shield} Shield`, color: '#4ade80', size: 18 });
    this.emitZone(zone, 'skill_fx', { type: 'set_proc', set: 'wayfarer', x: player.x, y: player.y, radius: 1.6, color: '#4ade80', playerId: player.id });
  }

  // Damage multiplier from set bonuses for one hit on `mob`
  setDamageMult(player, mob) {
    let m = 1;
    if (player.set2 && player.set2.emberheart && mob.burnTimer > 0) m += player.set2.emberheart.dmgVsBurning;
    if (player.eclipsePhase === 'dusk' && player.set4 && player.set4.eclipse) m += player.set4.eclipse.duskDmg;
    return m;
  }

  // On-hit set effects after a hit of `damage` landed on a living or dead mob.
  // Hits made by these procs pass player._inSetProc so they never chain again.
  applySetOnHit(player, mob, damage) {
    if (!player.set4 || player._inSetProc) return;
    const zone = player.zone;
    const instId = player.zone === 'dungeon' ? player.dungeonInstanceId : null;
    const mobs = () => this.getMobsMap(player.zone, player);

    // Eclipse, Dusk: heal from damage dealt (capped per hit like other leech)
    const ec = player.set4.eclipse;
    if (ec && player.eclipsePhase === 'dusk' && damage > 0) {
      const heal = Math.min(Math.round(player.maxHp * 0.05), Math.max(1, Math.round(damage * ec.duskLeech)));
      player.hp = Math.min(player.maxHp, player.hp + heal);
    }

    // Emberheart: Ember brands, erupting at full stacks
    const em = player.set4.emberheart;
    if (em) {
      if (!mob.embers) mob.embers = {};
      const n = (mob.embers[player.id] || 0) + 1;
      if (n < em.stacks) {
        mob.embers[player.id] = n;
      } else {
        mob.embers[player.id] = 0;
        player._inSetProc = true;
        try {
          const hit = Math.max(1, Math.round(player.dmg * em.dmgMult * SKILL_DAMAGE_SCALE));
          for (const other of mobs().values()) {
            if (other.state === 'dead' || other.hp <= 0) continue;
            if (Math.hypot(other.x - mob.x, other.y - mob.y) > em.radius) continue;
            other.burnTimer = Math.max(other.burnTimer || 0, em.burnSec);
            other.burnDmg = Math.max(other.burnDmg || 0, Math.round(player.dmg * em.burnMult));
            this.applyDamageToMob(player, other, hit, false);
          }
        } finally { player._inSetProc = false; }
        this.emitZone(zone, 'skill_fx', { type: 'set_proc', set: 'emberheart', x: mob.x, y: mob.y, radius: em.radius, color: '#f97316', playerId: player.id }, instId);
        this.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 1.1, text: '🔥 CINDER CASCADE!', color: '#fb923c', size: 17 }, instId);
      }
    }

    // Stormcaller: a full Static charge discharges into a lightning chain
    const st = player.set4.stormcaller;
    if (st && (player.staticStacks || 0) >= st.stacks) {
      player.staticStacks = 0;
      const points = [{ x: mob.x, y: mob.y }];
      const struck = new Set([mob.id]);
      let from = mob;
      let mult = st.dmgMult;
      player._inSetProc = true;
      try {
        for (let i = 0; i < st.chains; i++) {
          let next = null, best = st.range;
          for (const other of mobs().values()) {
            if (struck.has(other.id) || other.state === 'dead' || other.hp <= 0) continue;
            const d = Math.hypot(other.x - from.x, other.y - from.y);
            if (d <= best) { best = d; next = other; }
          }
          if (!next) break;
          struck.add(next.id);
          points.push({ x: next.x, y: next.y });
          this.applyDamageToMob(player, next, Math.max(1, Math.round(player.dmg * mult * SKILL_DAMAGE_SCALE)), false);
          mult *= (1 - st.falloff);
          from = next;
        }
      } finally { player._inSetProc = false; }
      if (player.skillCooldowns) {
        for (const k of Object.keys(player.skillCooldowns)) {
          if (player.skillCooldowns[k] > 0) player.skillCooldowns[k] = Number((player.skillCooldowns[k] * (1 - st.cdCut)).toFixed(2));
        }
      }
      this.emitZone(zone, 'skill_fx', { type: 'set_proc', set: 'stormcaller', x: mob.x, y: mob.y, points, color: '#facc15', playerId: player.id }, instId);
      this.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 1.0, text: '⚡ STATIC OVERLOAD!', color: '#facc15', size: 17 }, instId);
    }
  }

  // Skill cast hooks: Stormcaller Static stacks, Eclipse phase flip
  applySetOnSkillCast(player, cooldown) {
    if (!player.set4) return;
    const st = player.set4.stormcaller;
    if (st) player.staticStacks = Math.min(st.stacks, (player.staticStacks || 0) + 1);
    const ec = player.set4.eclipse;
    if (ec && cooldown >= ec.flipCooldown) this.flipEclipse(player);
  }

  flipEclipse(player) {
    const ec = player.set4 && player.set4.eclipse;
    if (!ec) return;
    player.eclipsePhase = player.eclipsePhase === 'dusk' ? 'dawn' : 'dusk';
    player.eclipseTimer = ec.period;
    this.recalculatePlayerStats(player);   // Dawn's Defense bonus
    const dusk = player.eclipsePhase === 'dusk';
    this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 1.0, text: dusk ? '🌑 DUSK' : '🌕 DAWN', color: dusk ? '#a855f7' : '#fde68a', size: 16 });
    this.emitZone(player.zone, 'skill_fx', { type: 'set_proc', set: 'eclipse', phase: player.eclipsePhase, x: player.x, y: player.y, radius: dusk ? 1.4 : ec.dawnRadius, color: dusk ? '#a855f7' : '#fde68a', playerId: player.id });
  }

  // Per-tick upkeep: Energy Shield recharge, Eclipse phase clock and Dawn's party heal
  tickPlayerShields(player, dt) {
    if (player.esMax > 0 && player.es < player.esMax && Date.now() - (player.lastHitAt || 0) >= ENERGY_SHIELD.delay * 1000) {
      player.es = Math.min(player.esMax, player.es + player.esMax * ENERGY_SHIELD.rechargePerSec * dt);
    }
    const ec = player.set4 && player.set4.eclipse;
    if (!ec) return;
    player.eclipseTimer = (player.eclipseTimer || ec.period) - dt;
    if (player.eclipseTimer <= 0) this.flipEclipse(player);
    if (player.eclipsePhase === 'dawn') {
      const inst = player.dungeonInstanceId || null;
      for (const ally of this.players.values()) {
        if (ally.isDead || ally.zone !== player.zone || (ally.dungeonInstanceId || null) !== inst) continue;
        if (ally !== player && (!player.partyId || ally.partyId !== player.partyId)) continue;
        if (Math.hypot(ally.x - player.x, ally.y - player.y) > ec.dawnRadius) continue;
        ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * ec.dawnHealPct * dt);
      }
    }
  }

  // One monster blow landing on a hero: immunities, dodges, shields, thorns,
  // elemental resistance and on-hit affixes. The caller handles reach and cooldown.
  // opts.mechanic: a telegraphed boss attack (bossMechanics.ts). It can't be dodged, smoked or
  // parried (you dodge it by moving), armor counts half, it reflects no thorns, and opts.mult
  // scales the boss's damage.
  mobStrikePlayer(mob, targetPlayer, zone, opts: any = {}) {
    const now = Date.now();
    const mech = !!opts.mechanic;
    if (targetPlayer.godMode) {
      this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '🛡️ IMMUNE (God Mode)', color: '#facc15' });
      return;
    }
    // Dragoon in the air: nothing on the ground can reach him
    if (mech && targetPlayer.airborneUntil > now) return;
    if (mech) return this.landMobDamage(mob, targetPlayer, zone, Math.round((mob.dmg || 0) * (opts.mult || 1)), 0.25, true);

    if (targetPlayer.smokeScreenTimer > 0) {
      this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '💨 MISS! (Stealth)', color: '#94a3b8' });
      return;
    }
    // Dragoon in the air: nothing on the ground can reach him
    if (targetPlayer.airborneUntil > now) return;
    // Sentinel Riposte Stance: the blow is blocked and returned
    if (targetPlayer.parry && targetPlayer.parry.until > now) {
      const back = Math.max(1, Math.round(targetPlayer.dmg * targetPlayer.parry.riposte * SKILL_DAMAGE_SCALE));
      this.applyDamageToMob(targetPlayer, mob, back, false);
      mob.attackCooldown = Math.max(mob.attackCooldown, 1.6);
      this.emitZone(zone, 'skill_fx', { type: 'sp_skill', shape: 'riposte', startX: targetPlayer.x, startY: targetPlayer.y, x: mob.x, y: mob.y, element: 'holy', color: '#fde68a', cardId: 'sp_sentinel', skillId: 'sp_sentinel_riposte' });
      this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '🛡️ RIPOSTE!', color: '#fde68a', size: 16 });
      return;
    }
    if (Math.random() < this.smokeMissChance(targetPlayer)) {
      this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '💨 MISS! (Smoke)', color: '#94a3b8' });
      return;
    }

    // Dodge chance from talents
    if (targetPlayer.dodgeChance && Math.random() < targetPlayer.dodgeChance) {
      this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '💨 DODGE!', color: '#38bdf8' });
      return;
    }

    const effectiveDmg = mob.hasCommanderBuff ? Math.round(mob.dmg * 1.35) : mob.dmg;
    this.landMobDamage(mob, targetPlayer, zone, effectiveDmg, 0.5, false);
  }

  // The shared tail of a monster hit: armor (armorShare of Defense is subtracted), element,
  // crushing blows, thorns (not for mechanics), shields, death
  landMobDamage(mob, targetPlayer, zone, effectiveDmg, armorShare, mech) {
    let damageDealt = Math.max(1, Math.round(effectiveDmg - (targetPlayer.def * armorShare)));

    // Monster element vs the player's elemental resistance from gear
    const elemResistMult = calculateElementalMultiplier(mob.element || 'neutral', 'neutral', targetPlayer.elementResist || {});
    damageDealt = Math.max(1, Math.round(damageDealt * elemResistMult));

    // Crushing Blow from high level monsters against underleveled players!
    let isCrushing = false;
    if (!mob.noLevelGap && mob.level && targetPlayer.level && (mob.level - targetPlayer.level >= 5)) {
      const gap = mob.level - targetPlayer.level;
      const crushingMult = 1.0 + Math.min(4.0, (gap - 3) * 0.08);
      damageDealt = Math.round(damageDealt * crushingMult);
      isCrushing = true;
    }

    // Thorns reflection (Iron Fortress + passive Unyielding Spikes/Colossus Avatar)
    const runeThorns = targetPlayer.armorRunes && targetPlayer.armorRunes.thorns ? Math.round(targetPlayer.maxHp * 0.03 * targetPlayer.armorRunes.thorns) : 0;
    const thornsDmg = mech ? 0 : (targetPlayer.ironFortressTimer > 0 ? 25 : 0) + (targetPlayer.thorns || 0) + runeThorns;
    if (thornsDmg > 0) {
      this.applyDamageToMob(targetPlayer, mob, thornsDmg, false);
      this.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.7, text: `🌵 ${thornsDmg} Thorns!`, color: '#e2e8f0' });
    }

    // Iron Fortress: -60% damage
    if (targetPlayer.ironFortressTimer > 0) {
      damageDealt = Math.max(1, Math.round(damageDealt * 0.40));
    }

    // SP card passive (damage reduction, reflect, shields) and signature charge
    if (targetPlayer.spTransformed) damageDealt = this.passiveOnHurt(targetPlayer, mob, damageDealt, zone);

    // Shield Barrier absorption, then the mage's Energy Shield
    damageDealt = this.absorbIncomingDamage(targetPlayer, damageDealt, zone);

    targetPlayer.hp -= damageDealt;
    if (damageDealt > 0) this.checkSecondWind(targetPlayer, zone);
    if (targetPlayer.undyingTimer > 0 && targetPlayer.hp < 1) {
      targetPlayer.hp = 1;
      this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 1.0, text: '💀 UNDYING RAGE!', color: '#c084fc', size: 18 });
    }
    if (targetPlayer.hp <= 0) this.phoenixRebirth(targetPlayer);

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

    if (isCrushing) {
      this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: `-${damageDealt}`, color: '#dc2626', size: 18 });
    } else if (elemResistMult < 1) {
      this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: `-${damageDealt}`, color: '#fca5a5' });
    } else {
      this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: `-${damageDealt}`, color: '#ef4444' });
    }
    if (!mech) this.emitZone(zone, 'entity_attack_fx', { attackerId: mob.id, attackerType: 'mob', targetId: targetPlayer.id, x: mob.x, y: mob.y });

    if (targetPlayer.hp <= 0) {
      targetPlayer.hp = 0;
      targetPlayer.isDead = true;
      if (targetPlayer.dungeonRun) targetPlayer.dungeonRun.deaths = (targetPlayer.dungeonRun.deaths || 0) + 1;
      targetPlayer.respawnTimer = 5.0;
      this.emitZone(zone, 'player_died', { playerId: targetPlayer.id, killerName: mob.name });
      this.broadcastSystemMessage(`☠️ [${targetPlayer.name}] was slain by [${mob.name}]!`);
      // a boss turns on the next hero still fighting it instead of walking home to heal
      const next = mob.isBoss ? (Array.from(this.players.values()) as any[]).find(p => !p.isDead && p.zone === zone
        && p.dungeonInstanceId === targetPlayer.dungeonInstanceId && Math.hypot(p.x - mob.x, p.y - mob.y) < 30) : null;
      if (next) { mob.state = 'chase'; mob.targetPlayerId = next.id; }
      else mob.state = 'return';
    }
  }

  broadcastSnapshot() {
    // Heavy per-player fields (bag, gear, talents...) only go out when they
    // change, plus a full refresh once a second for anyone who just arrived
    this._snapTick = (this._snapTick || 0) + 1;
    const fullRefresh = this._snapTick % this.TICK_RATE === 0;
    if (!this._heavySigs) this._heavySigs = new WeakMap();
    const round2 = v => Math.round(v * 100) / 100;
    const playersArr = Array.from(this.players.values()).map(p => {
      const sweep = p.characterClass === 'mage' ? { reach: 0, arc: 0 } : this.meleeSweep(p);
      const snap = {
      id: p.id,
      name: p.name,
      characterClass: p.characterClass,
      zone: p.zone,
      dungeonInstanceId: p.dungeonInstanceId || null,
      partyId: p.partyId || null,
      x: round2(p.x),
      y: round2(p.y),
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
      skillPoints: p.skillPoints !== undefined ? p.skillPoints : 0,
      gold: p.gold,
      speechBubble: p.speechBubble,
      isDead: p.isDead,
      statusEffects: (p.statusEffects || []).map(e => ({ type: e.type, duration: Math.ceil(e.duration) })),
      skillCooldowns: p.skillCooldowns,
      attackSpeed: p.attackSpeed || 1.0,
      swipe: p.swipe || 0,
      // melee cleave reach / arc, so the client draws the local swing at its true size
      sweepReach: p.characterClass === 'mage' ? 0 : round2(sweep.reach),
      sweepArc: p.characterClass === 'mage' ? 0 : sweep.arc,
      jobLevel: p.jobLevel || 1,
      spTransformed: !!p.spTransformed,
      spCardId: p.spTransformed && p.equipment && p.equipment.sp ? p.equipment.sp.cardId : null,
      spLevel: p.spTransformed && p.equipment && p.equipment.sp ? (p.equipment.sp.upgradeLevel || 0) : 0,
      ultCharge: p.spTransformed ? Math.floor(p.ultCharge || 0) : 0,
      shieldHp: Math.round(p.shieldHp || 0),
      es: Math.round(p.es || 0),
      esMax: p.esMax || 0,
      setCounts: p.setCounts || {},
      berserkTimer: Number((p.berserkTimer || 0).toFixed(1)),
      spToggles: p.spToggles ? Object.values(p.spToggles).map((a: any) => ({ id: a.skill.id, r: a.skill.r || 0, spin: !!a.skill.spin, c: a.skill.color })) : [],
      buffs: this.heroBuffs(p),
      mastery: p.mastery || 1,
      ironFortressTimer: Number((p.ironFortressTimer || 0).toFixed(1)),
      smokeScreenTimer: Number((p.smokeScreenTimer || 0).toFixed(1)),
      trail: (p.effects && p.effects.trail) || null,
      // Gravelord undead minions (drawn by the client like monsters, in grave colours)
      minions: p.minions && p.minions.length ? p.minions.map(m => ({ id: m.id, type: m.type, hue: m.hue, scale: m.scale, x: round2(m.x), y: round2(m.y), facing: m.facing, atk: m.atkAt, life: round2(Math.max(0, (m.until - Date.now()) / m.dur)), name: m.name, rage: !!(p.minionRage && p.minionRage.until > Date.now()) })) : undefined
      };
      const heavy = {
        inventory: p.inventory, equipment: p.equipment, baseStats: p.baseStats,
        skills: p.skills || {}, equippedSkills: p.equippedSkills, elementResist: p.elementResist || {}
      };
      if (fullRefresh || !this._heavySigs.has(p)) {   // (a hero's first snapshot always carries everything)
        this._heavySigs.set(p, JSON.stringify(heavy));
        Object.assign(snap, heavy);
      } else if (this._snapTick % HEAVY_CHECK_TICKS === 0) {
        const sig = JSON.stringify(heavy);
        if (sig !== this._heavySigs.get(p)) {
          this._heavySigs.set(p, sig);
          Object.assign(snap, heavy);
        }
      }
      return snap;
    });

    const snapMob = m => ({
      id: m.id, type: m.type, name: m.name, level: m.level, x: round2(m.x), y: round2(m.y),
      facing: m.facing, hp: Math.round(m.hp), maxHp: m.maxHp, state: m.state, isBoss: m.isBoss, isMiniboss: !!m.isMiniboss,
      buffs: m.buffs || [], isCommander: !!m.isCommander, auraRadius: m.auraRadius || 0, hasCommanderBuff: !!m.hasCommanderBuff,
      element: m.element || 'neutral', elementResist: m.elementResist || {},
      hue: m.hue || 0, scale: m.scale || 1,
      frozen: m.frozenTimer > 0 ? (m.frozenKind === 'time' ? 2 : 1) : 0, scorch: m.scorchStacks || 0, frost: m.frostStacks || 0
    });
    // Moving parts only; defaults (no buffs, not a commander) are left out
    const snapMobDelta = (m: any) => {
      const d: any = { id: m.id, x: round2(m.x), y: round2(m.y), facing: m.facing, hp: Math.round(m.hp), maxHp: m.maxHp, state: m.state,
        frozen: m.frozenTimer > 0 ? (m.frozenKind === 'time' ? 2 : 1) : 0, scorch: m.scorchStacks || 0, frost: m.frostStacks || 0 };
      if (m.buffs && m.buffs.length) d.buffs = m.buffs;
      if (m.isCommander) { d.isCommander = true; d.auraRadius = m.auraRadius || 0; }
      if (m.isMiniboss) d.isMiniboss = true;
      if (m.hasCommanderBuff) d.hasCommanderBuff = true;
      return d;
    };
    const townMobsArr = Array.from(this.townMobs.values()).map(snapMob);

    // Only send field zones somebody is actually standing in, and of those only
    // the monsters near one of its players (a big field holds hundreds)
    const occupied = new Set(playersArr.map(p => p.zone));
    const fieldMobs: Record<string, any[]> = {};
    for (const [fieldId, field] of this.fields) {
      if (!occupied.has(fieldId)) continue;
      const here = playersArr.filter(p => p.zone === fieldId);
      fieldMobs[fieldId] = (Array.from(field.mobs.values()) as any[])
        .filter(m => m.isBoss || here.some(p => mobInView(m, p)))
        .map(snapMob);
    }

    this.syncZoneRooms();
    for (const zone of occupied) {
      if (zone === 'dungeon') continue; // Dungeon instances are broadcast separately below!
      this.io.to(`zone:${zone}`).emit('game_tick', {
        timestamp: Date.now(),
        players: playersArr.filter(p => p.zone === zone),
        townMobs: zone === 'town' ? townMobsArr : [],
        fieldMobs: fieldMobs[zone] ? { [zone]: fieldMobs[zone] } : {},
        frostfellMobs: zone === 'frostfell' ? (fieldMobs.frostfell || []) : [],
        dungeonMobs: [],
        dungeonChests: []
      });
    }

    // Broadcast isolated game_tick for each dungeon instance (Zero ghosting across parties!)
    for (const inst of this.dungeonInstances.values()) {
      const instPlayers = playersArr.filter(p => p.zone === 'dungeon' && p.dungeonInstanceId === inst.id);
      if (instPlayers.length === 0) continue;
      // Only living mobs someone in the instance could see (bosses always);
      // dead dungeon mobs are never drawn. Between full refreshes (once a
      // second) the tick is a diff: new mobs in full, changed ones as deltas,
      // unchanged ones left out, and the ids that left view or died as `gone`.
      const instMobsArr = [];
      const mobRefresh = this._snapTick % (this.TICK_RATE * MOB_FULL_REFRESH_S) === 0;
      const sentBefore = (!mobRefresh && inst._sentMobs) || new Map<any, any>();
      const sentNow = new Map<any, any>();
      for (const m of inst.mobs.values()) {
        if (m.state === 'dead') continue;
        if (!m.isBoss && !instPlayers.some(p => mobInView(m, p))) continue;
        const delta = snapMobDelta(m);
        const sig = JSON.stringify(delta);
        if (!sentBefore.has(m.id)) instMobsArr.push(snapMob(m));
        else if (sentBefore.get(m.id) !== sig) instMobsArr.push(delta);
        sentNow.set(m.id, sig);
      }
      const gone = [];
      if (!mobRefresh && inst._sentMobs) for (const id of inst._sentMobs.keys()) if (!sentNow.has(id)) gone.push(id);
      inst._sentMobs = sentNow;
      // Chests only change when someone opens one
      const chestSig = JSON.stringify(inst.chests || []);
      const chestsChanged = mobRefresh || chestSig !== inst._chestSig;
      inst._chestSig = chestSig;
      this.io.to(`dungeon:${inst.id}`).emit('game_tick', {
        timestamp: Date.now(),
        players: instPlayers,
        townMobs: [],
        fieldMobs: {},
        frostfellMobs: [],
        dungeonMobs: instMobsArr,
        dungeonMobsFull: mobRefresh || !inst._mobsStreamed,
        dungeonMobsGone: gone,
        dungeonChests: chestsChanged ? (inst.chests || []) : undefined
      });
      inst._mobsStreamed = true;
    }
  }
}

export { GameServer, ALL_CLASS_SKILLS };
export default GameServer;
(GameServer as any).ALL_CLASS_SKILLS = ALL_CLASS_SKILLS;
module.exports = GameServer;







