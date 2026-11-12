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
import { HERO_CLASSES, isHeroClass, isRangedClass, starterEquipment } from './data/heroClasses';
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
import { CombatSystem } from './systems/CombatSystem';
import { SkillSystem } from './systems/SkillSystem';
import { SpSkillSystem } from './systems/SpSkillSystem';
import { MobAISystem } from './systems/MobAISystem';

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
    this.mobAI = new MobAISystem(this);
    this.spSkills = new SpSkillSystem(this);
    this.skills = new SkillSystem(this);
    this.combat = new CombatSystem(this);
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
    return this.combat.handlePlayerAttack(socketId, targetInfo);
  }

  meleeSweep(player) {
    return this.combat.meleeSweep(player);
  }

  handleCustomizeSkill(socketId, data) {
    return this.skills.handleCustomizeSkill(socketId, data);
  }

  resolvePlayerSkill(player, slot, skillId) {
    return this.skills.resolvePlayerSkill(player, slot, skillId);
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

  chainBasicAttack(player, first, attackDmg, mobsMap, strike) {
    return this.combat.chainBasicAttack(player, first, attackDmg, mobsMap, strike);
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

  castSpSkill(player, skill, ctx) {
    return this.spSkills.castSpSkill(player, skill, ctx);
  }

  smokeMissChance(player) {
    return this.statusFx.smokeMissChance(player);
  }

  handlePlayerSkill(socketId: any, skillData: any = {}) {
    return this.skills.handlePlayerSkill(socketId, skillData);
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
    return this.combat.spawnProjectile(caster, targetX, targetY, targetId, targetType, damage, opts);
  }

  applyProjectileSplash(caster, proj, primary, mobsMap) {
    return this.combat.applyProjectileSplash(caster, proj, primary, mobsMap);
  }

  applyDamageToMob(player, mob, baseDamage, isCritical = false, isEcho = false) {
    return this.combat.applyDamageToMob(player, mob, baseDamage, isCritical, isEcho);
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
    return this.combat.handleMobDeath(mob, killerPlayer);
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
    return this.mobAI.updateMobsList(mobsMap, zone, dt, instanceId);
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

  checkSecondWind(player, zone) {
    return this.combat.checkSecondWind(player, zone);
  }

  setDamageMult(player, mob) {
    return this.combat.setDamageMult(player, mob);
  }

  applySetOnHit(player, mob, damage) {
    return this.combat.applySetOnHit(player, mob, damage);
  }

  applySetOnSkillCast(player, cooldown) {
    return this.skills.applySetOnSkillCast(player, cooldown);
  }

  flipEclipse(player) {
    return this.skills.flipEclipse(player);
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

  mobStrikePlayer(mob, targetPlayer, zone, opts: any = {}) {
    return this.mobAI.mobStrikePlayer(mob, targetPlayer, zone, opts);
  }

  landMobDamage(mob, targetPlayer, zone, effectiveDmg, armorShare, mech) {
    return this.mobAI.landMobDamage(mob, targetPlayer, zone, effectiveDmg, armorShare, mech);
  }

  broadcastSnapshot() {
    // Heavy per-player fields (bag, gear, talents...) only go out when they
    // change, plus a full refresh once a second for anyone who just arrived
    this._snapTick = (this._snapTick || 0) + 1;
    const fullRefresh = this._snapTick % this.TICK_RATE === 0;
    if (!this._heavySigs) this._heavySigs = new WeakMap();
    const round2 = v => Math.round(v * 100) / 100;
    const playersArr = Array.from(this.players.values()).map(p => {
      const sweep = isRangedClass(p.characterClass) ? { reach: 0, arc: 0 } : this.meleeSweep(p);
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
      sweepReach: isRangedClass(p.characterClass) ? 0 : round2(sweep.reach),
      sweepArc: isRangedClass(p.characterClass) ? 0 : sweep.arc,
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







