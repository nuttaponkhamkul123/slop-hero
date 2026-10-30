export type ElementId = 'neutral' | 'fire' | 'ice' | 'lightning' | 'earth' | 'holy' | 'dark';

export interface ElementInfo {
  name: string;
  nameTh: string;
  icon: string;
  color: string;
}

export type CharacterClass = 'warrior' | 'mage' | 'rogue';
export type UserRole = 'player' | 'admin';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type ItemType = 'weapon' | 'armor' | 'potion' | 'material' | 'card' | 'chest' | 'currency' | 'consumable';
export type EquipSlot = 'weapon' | 'armor' | 'helmet' | 'boots' | 'ring' | 'amulet' | 'spCard';

export interface Stats {
  hp?: number;
  maxHp?: number;
  mp?: number;
  maxMp?: number;
  attack?: number;
  defense?: number;
  critRate?: number;
  critDamage?: number;
  speed?: number;
  attackRange?: number;
  cooldownReduction?: number;
  [key: string]: any;
}

export interface ItemDef {
  id: string;
  name: string;
  nameTh?: string;
  type: ItemType | string;
  slot?: EquipSlot | string;
  rarity?: ItemRarity | string;
  stats?: Stats;
  element?: ElementId;
  levelReq?: number;
  jobLevelReq?: number;
  classReq?: CharacterClass | 'all' | string;
  value?: number;
  price?: number;
  sellPrice?: number;
  description?: string;
  descriptionTh?: string;
  icon?: string;
  stackable?: boolean;
  maxStack?: number;
  effect?: any;
  [key: string]: any;
}

export interface InventoryItem {
  id?: string;
  itemId: string;
  count: number;
  enhancement?: number;
  reforgeBonus?: Record<string, number>;
  equipped?: boolean;
  slot?: string;
  maxSockets?: number;
  sockets?: (string | null)[];
  brokenSockets?: number;
  [key: string]: any;
}

export interface CharacterData {
  id: string;
  name: string;
  classType: CharacterClass | string;
  level: number;
  exp: number;
  jobLevel: number;
  jobExp: number;
  hp?: number;
  mp?: number;
  stats?: Stats;
  gold: number;
  inventory: (InventoryItem | null)[];
  storage?: { maxSlots: number; items: (InventoryItem | any)[] };
  equipment: Record<string, InventoryItem | null>;
  skills?: Record<string, any>;
  skillPoints?: number;
  activeSpCard?: any;
  allocatedTalents?: Record<string, number>;
  [key: string]: any;
}

export interface AccountData {
  username: string;
  passwordHash: string;
  role: UserRole;
  characters: CharacterData[];
  createdAt?: number;
  [key: string]: any;
}

export interface MonsterDef {
  id: string;
  name: string;
  nameTh?: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  element?: ElementId;
  exp: number;
  kind?: 'normal' | 'commander' | 'boss';
  speed?: number;
  attackRange?: number;
  attackSpeed?: number;
  skills?: any[];
  drops?: Array<{ itemId: string; chance: number; min?: number; max?: number }>;
  [key: string]: any;
}

export interface FieldZoneDef {
  id: string;
  name: string;
  nameTh: string;
  minLevel: number;
  maxLevel: number;
  music?: string;
  ambience?: string;
  theme?: string;
  portals?: any[];
  spawns?: any[];
  [key: string]: any;
}

export interface PartyMember {
  socketId: string;
  characterId: string;
  name: string;
  level: number;
  classType: string;
  hp: number;
  maxHp: number;
  zone: string;
}

export interface Party {
  id: string;
  leaderId: string;
  members: Map<string, PartyMember>;
  invites: Set<string>;
}

