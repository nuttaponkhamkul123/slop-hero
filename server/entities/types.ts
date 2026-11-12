// Entity shapes of the game server, written down from what the code really builds.
//
// - They describe plain JSON objects (they are saved to disk and sent to the client as they are).
// - Fields that are only added later during play are optional.
// - `[extra: string]: any` keeps the codebase compiling while it still reads/writes ad-hoc fields;
//   it has been removed from Mob and DungeonInstance; Item, Player and the small shapes still have it (Phase E).
// - The older types in ../types.ts (CharacterData, MonsterDef, Party, ...) describe aspirational
//   shapes the game never used: do not mix them up with these.

import type { UserRole } from '../types';

/** 'town', 'dungeon', or a field zone id such as 'frostfell' */
export type ZoneId = string;
export type Facing = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

// ---------------------------------------------------------------- items

/** An item instance as held in a bag, slot, chest or on the ground (ITEMS definition + per-instance rolls). */
export interface Item {
  id: string;
  name?: string;
  type?: string;
  slot?: string;
  icon?: string;
  rarity?: string;
  desc?: string;
  count?: number;
  /** only for rolled gear */
  uniqueId?: string;
  custom?: boolean;
  quality?: number;
  itemLevel?: number;
  upgradeLevel?: number;
  sellPrice?: number;
  bonusDmg?: number;
  bonusSwipe?: number;
  element?: string;
  /** class that may use it (weapons, SP cards) */
  cls?: string;
  abilityId?: string;
  maxSockets?: number;
  sockets?: (string | null)[];
  brokenSockets?: number;
  attrSlots?: number;
  attrs?: any;
  /** SP card items */
  cardId?: string;
  /** reforge name (also in `name`) and the stats it adds */
  reforge?: string;
  baseName?: string;
  reforgeStats?: any;
  /** share of the card's stats kept by a scaled SP item */
  spScale?: number;
  /** stats before upgrade/reforge, kept so applyItemUpgradeStats can recompute the bonuses */
  baseBonusDmg?: number;
  baseBonusDef?: number;
  baseBonusHp?: number;
  baseBonusMp?: number;
  baseBonusSpeed?: number;
  baseBonusAttackSpeed?: number;
  baseBonusSwipe?: number;
  bonusDef?: number;
  bonusHp?: number;
  bonusMp?: number;
  bonusSpeed?: number;
  bonusAttackSpeed?: number;
  favorite?: boolean;
  color?: string;
}

export interface EquipmentSlots {
  weapon: Item | null;
  armor: Item | null;
  helmet: Item | null;
  boots: Item | null;
  gloves: Item | null;
  cape: Item | null;
  ring: Item | null;
  /** the equipped SP card; absent until one is equipped */
  sp?: Item | null;
  /** slots are also addressed by name from the client (data.slot) */
  [slot: string]: Item | null | undefined;
}

export interface Inventory {
  healthPotions: number;
  manaPotions: number;
  kills?: number;
  maxSlots: number;
  items: Item[];
  /** which potion each quick slot drinks */
  potionSlots?: { health: string; mana: string };
}

export interface Storage {
  maxSlots: number;
  items: Item[];
}

// ---------------------------------------------------------------- players

export interface BaseStats {
  maxHp: number;
  maxMp: number;
  dmg: number;
  def: number;
  speed: number;
  attackRange: number;
  attackSpeed?: number;
  swipe?: number;
}

export interface EquippedSkills {
  slot1: string;
  slot2: string;
  slot3: string;
  dash: string;
  runes: Record<string, string>;
  /** slots are also addressed by name from the client (data.slot) */
  [slot: string]: any;
}

export interface SkillCooldowns {
  slot1: number;
  slot2: number;
  slot3: number;
  dash: number;
  skill1: number;
  skill2: number;
  [extra: string]: number;
}

export interface StatusEffect {
  type: string;
  duration: number;
  value?: number;
  tickTimer?: number;
}

export interface DungeonRun {
  clearedAt?: number;
  floor: number;
  difficulty: string;
  cleared: boolean;
  gold: number;
  items: any[];
  startedAt: number;
  deaths: number;
  kills: number;
  exp: number;
  revivalsUsed: number;
  maxRevivals: number;
}

/** What is written to accounts.json for one character (see AccountManager.saveCharacter). */
export interface SavedCharacter {
  name: string;
  /** 'warrior' | 'mage' | 'rogue' */
  characterClass: string;
  level: number;
  exp: number;
  expNext?: number;
  skillPoints: number;
  skills: Record<string, number>;
  equippedSkills: EquippedSkills | null;
  jobLevel?: number;
  spLoadouts?: Record<string, any>;
  jobExp?: number;
  equipment: EquipmentSlots;
  gold: number;
  inventory: Inventory;
  storage: Storage;
  zone: ZoneId;
  x?: number;
  y?: number;
  savedAt?: number;
}

/** The live, in-world player (GameServer.players). Built by addPlayer. */
export interface Player {
  // identity
  id: string;
  accountUsername: string | null;
  accountSlot: number;
  role: UserRole | string;
  name: string;
  /** 'warrior' | 'mage' | 'rogue' */
  characterClass: string;

  // position / movement
  zone: ZoneId;
  x: number;
  y: number;
  targetX: number | null;
  targetY: number | null;
  moveDir: { dx: number; dy: number };
  facing: Facing | string;
  isMoving: boolean;

  // progression
  level: number;
  exp: number;
  expNext: number;
  skillPoints: number;
  jobLevel: number;
  jobExp: number;
  jobExpNext: number;
  spLoadouts: Record<string, any>;
  skills: Record<string, number>;

  // SP card
  spTransformed: boolean;
  spCooldown: number;

  // stats
  baseStats: BaseStats;
  attackSpeed: number;
  swipe: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  dmg: number;
  def: number;
  speed: number;
  attackRange: number;

  // gear and items
  equipment: EquipmentSlots;
  gold: number;
  inventory: Inventory;
  storage: Storage;

  // skills and combat timers
  equippedSkills: EquippedSkills;
  skillCooldowns: SkillCooldowns;
  attackCooldown: number;
  skillCooldown: number;
  sprintTimer: number;
  portalCooldown: number;
  isAttacking: boolean;

  // life and buffs
  isDead: boolean;
  respawnTimer: number;
  statusEffects: StatusEffect[];
  speedFactor: number;
  shieldHp: number;
  berserkTimer: number;
  ironFortressTimer: number;
  smokeScreenTimer: number;
  speechBubble: string | null;
  speechTimer: number;

  // ---- added later (by recalculatePlayerStats, parties, dungeons, SP card mechanics, ...) ----
  partyId?: string | null;
  dungeonInstanceId?: string | null;
  dungeonRun?: DungeonRun | null;
  pendingSummon?: any;
  // derived stats
  armorRunes?: Record<string, number>;
  setCounts?: Record<string, number>;
  set2?: any;
  set4?: any;
  eclipsePhase?: any;
  mastery?: number;
  weaponPower?: any;
  manaCostMult?: number;
  critChanceBonus?: number;
  critDmgBonus?: number;
  thorns?: number;
  dodgeChance?: number;
  lifeSteal?: number;
  talentKill?: any;
  talentProcs?: any;
  elementResist?: Record<string, number>;
  hpRegenFlat?: number;
  mpRegenFlat?: number;
  hpRegen?: number;
  mpRegen?: number;
  cdr?: number;
  esMax?: number;
  es?: number;
  // SP card / class mechanics
  baseEquippedSkills?: EquippedSkills | null;
  ultCharge?: number;
  ultLockUntil?: number;
  spToggles?: any;
  heat?: number;
  overheatUntil?: number;
  combo?: any;
  parry?: any;
  rebirthReadyAt?: number;
  voidSouls?: number;
  voidSoulTimer?: number;
  flowStacks?: number;
  nbShadow?: any;
  nbStars?: any;
  dgSpear?: any;
  dgRods?: any[];
  runeGlyphs?: any[];
  banner?: any;
  minions?: any[];
  minionRage?: any;
  timeTrail?: any;
  bloodlust?: any;
  // misc
  potionCdUntil?: Record<string, number>;
  effects?: any;
  talentRefunded?: number;
  riftRespawnSet?: any;
  /** admin /god: takes no damage */
  godMode?: boolean;
  /** socket.io room of the zone the hero is in */
  _room?: string;
  lastHitAt?: number;
  eclipseTimer?: number;
  secondWindReadyAt?: number;
  staticStacks?: number;
  airborneUntil?: number;
  undyingTimer?: number;
  ultWindow?: { t: number; g: number };
  inKillNova?: boolean;
  _inSetProc?: boolean;
  _lastRuneLeechText?: number;
  _lastLeechText?: number;
  heatAt?: number;
  flowTimer?: number;
  faceLockTimer?: number;
  aimFacing?: string;
  timeTrailClock?: number;
  nextMobHitAt?: number;
}

// ---------------------------------------------------------------- monsters

/** The rectangle a field / dungeon monster wanders in (on rift and admin monsters `zone` is the string 'dungeon'). */
export interface LeashBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export type MobState = 'idle' | 'chase' | 'return' | 'dead' | string;

/** A monster. Every creation site fills the core fields it has; the rest is optional. */
export interface Mob {
  id: string;
  type: string;
  name: string;
  level: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dmg: number;
  def: number;
  speed: number;
  state: MobState;

  spawnX?: number;
  spawnY?: number;
  zone?: LeashBox | string;
  fieldZone?: string;
  hue?: number;
  scale?: number;
  isBoss?: boolean;
  exp?: number;
  gold?: number;
  element?: string;
  elementResist?: Record<string, number>;
  buffs?: string[];
  isCommander?: boolean;
  auraRadius?: number;
  hasCommanderBuff?: boolean;
  targetPlayerId?: string | null;
  nextWanderTime?: number;
  wanderTarget?: { x: number; y: number } | null;
  attackCooldown?: number;
  respawnTimer?: number;
  facing?: Facing | string;

  // dungeons / bosses / raids / rifts
  roomIdx?: number;
  mechanics?: 'boss' | 'miniboss' | string;
  mechWindup?: number;
  isMiniboss?: boolean;
  isGuard?: boolean;
  addTemplate?: any;
  summonedBy?: string;
  spawnUntil?: number;
  dungeonInstanceId?: string;
  isRaidBoss?: boolean;
  riftMob?: boolean;
  riftInstanceId?: string;
  noLevelGap?: boolean;
  shield?: number;

  // status effects (see updateMobsList)
  chillTimer?: number;
  burnTimer?: number;
  burnDmg?: number;
  burnTickTimer?: number;
  poisonTimer?: number;
  poisonDmg?: number;
  poisonStacks?: number;
  poisonTickTimer?: number;
  scorchStacks?: number;
  scorchTimer?: number;
  frostStacks?: number;
  frostTimer?: number;
  frozenTimer?: number;
  frozenKind?: 'ice' | 'time' | string;
  conduct?: number;
  conductTimer?: number;
  fracture?: number;
  fractureUntil?: number;
  doom?: { owner: string; stored: number; share: number; until: number } | null;
  shadowMarkTimer?: number;
  staticCharge?: number;
  lastHitBy?: string;
  /** time of death (ms), set when a rift monster dies */
  diedAt?: number;
  /** rift: the structure this monster is attacking */
  structTargetId?: string | null;
  /** rift: points paid to whoever slays it */
  riftPoints?: number;
  /** Emberheart set: stacks per hero id */
  embers?: Record<string, number>;
  /** set once the kill counted toward the dungeon's boss portal */
  progressCounted?: boolean;
}

// ---------------------------------------------------------------- world objects

export interface GroundItem {
  id: string;
  zone: ZoneId;
  /** 'item' | 'gold' | ... */
  type: string;
  itemId: string | null;
  name: string;
  x: number;
  y: number;
  amount: number;
  customItemData: any | null;
  createdAt: number;
  expiresAt: number;
}

export interface Projectile {
  id: string;
  cardId: string | null;
  instanceId: string | null;
  zone: ZoneId;
  casterId: string;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  targetId?: string;
  targetType?: string;
  vx: number;
  vy: number;
  damage: number;
  splash: number;
  crit: boolean;
  element: string;
  life: number;
  color: string;
}

/** A party. `memberIds` are socket ids; `player.partyId` points back. */
export interface PartyState {
  id: string;
  leaderId: string;
  memberIds: Set<string>;
}

/** A dungeon run's world (GameServer.dungeonInstances; Eternal Rift instances live in the same map and add `rift`). */
export interface DungeonInstance {
  id: string;
  partyId: string | null;
  floor: number;
  difficulty: string;
  mode: string;
  mods: string[];
  modReward: any;
  dungeon: any;
  mobs: Map<string, Mob>;
  pendingMobs: Map<number, Mob[]>;
  groundItems: Map<string, GroundItem>;
  chests: any[];
  cleared: boolean;
  startedAt: number;
  bossRoomIdx: number;
  totalTrashMobs: number;
  requiredKills: number;
  killedTrashCount: number;
  killPercent: number;
  bossPortalReady: boolean;
  bossPortalSpawned: boolean;
  bossPortalPos: { x: number; y: number } | null;
  // added later
  announce?: boolean;
  roomsCleared?: any;
  roomsSpawned?: any;
  rift?: any;
  _sentMobs?: Map<string, any>;
  _mobsStreamed?: boolean;
  _chestSig?: string;
}

/** The state of one Eternal Rift run (DungeonInstance.rift / RiftInstance.rift). */
export interface RiftState {
  phase: string;
  wave: number;
  timer: number;
  baseLevel: number;
  mode: string;
  perWave: number;
  spawnMult: number;
  fountain: { hp: number; maxHp: number };
  queue: any[];
  spawnEvery: number;
  spawnClock: number;
  gateTurn: number;
  structures: any[];
  structSeq: number;
  /** heroId -> Rift Points (gone when they leave) */
  points: Map<string, number>;
  /** heroId -> { gold, essence } paid out at a checkpoint */
  banked: Map<string, any>;
  /** heroId -> 'continue' during a checkpoint prompt */
  choices: Map<string, string>;
  stateClock: number;
}

/** An Eternal Rift run: lives in GameServer.dungeonInstances next to the dungeon runs but has fewer fields. */
export interface RiftInstance {
  id: string;
  partyId: string | null;
  floor: number;
  difficulty: string;
  dungeon: any;
  mobs: Map<string, Mob>;
  pendingMobs: Map<number, Mob[]>;
  groundItems: Map<string, GroundItem>;
  chests: any[];
  cleared: boolean;
  startedAt: number;
  rift: RiftState;
}
