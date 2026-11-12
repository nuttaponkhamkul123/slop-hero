// Player factories: the shapes live in ./types.ts.
import { expToNext } from '../progression';
import { ITEMS } from '../items';
import { DEFAULT_BAG_SLOTS } from '../config/constants';
import { DEFAULT_EQUIPPED_SKILLS } from '../data/skills';
import { HERO_CLASSES, isHeroClass, starterEquipment } from '../data/heroClasses';
import * as SP from '../spCards';
import { ItemFactory } from './item';
import type { Player, SavedCharacter } from './types';

/** A brand-new character as it is saved on the account (level 1, starter gear, starter bag). */
export function createStarterCharacter(heroName: any, characterClass: any): SavedCharacter {
  const chosenClass = isHeroClass(characterClass) ? characterClass : 'warrior';
  const cleanHeroName = (heroName || 'Hero').substring(0, 15).trim() || 'Hero';

  const starterChar = {
    name: cleanHeroName,
    characterClass: chosenClass,
    level: 1,
    exp: 0,
    expNext: expToNext(1),
    skillPoints: 1,
    skills: {},
    equippedSkills: JSON.parse(JSON.stringify(DEFAULT_EQUIPPED_SKILLS[chosenClass] || DEFAULT_EQUIPPED_SKILLS.warrior)),
    equipment: {
      ...starterEquipment(chosenClass), // weapon, armor, helmet
      boots: null,
      gloves: null,
      cape: null,
      ring: null
    },
    gold: 50,
    inventory: {
      healthPotions: 3,
      manaPotions: 2,
      kills: 0,
      maxSlots: DEFAULT_BAG_SLOTS,
      items: [
        ItemFactory.stack(ITEMS.ancient_ruby),
        ItemFactory.stack(ITEMS.revival_stone)
      ]
    },
    storage: {
      maxSlots: 50,
      items: []
    },
    zone: 'town',
    x: 20,
    y: 23
  };

  return starterChar;
}

/** Everything addPlayer decides before the live player object is built. */
export interface LivePlayerArgs {
  /** socket id */
  id: string;
  /** account name, or null/undefined for a guest */
  accountUsername?: string | null;
  accountSlot: number;
  role: string;
  /** the character stored on the account; null for a guest */
  saved: any | null;
  /** already validated: a real class name */
  chosenClass: string;
  /** the name a guest typed (ignored when `saved` is set) */
  guestName?: string;
  spawnX: number;
  spawnY: number;
}

/**
 * The live in-world player: the saved character (or class defaults for a guest) plus all runtime state.
 * A guest also receives the class starter gear. Derived stats are filled in later by recalculatePlayerStats.
 */
export function createLivePlayer(a: LivePlayerArgs): Player {
  const savedChar: any = a.saved;
  const accountUsername = a.accountUsername;
  const accountSlot = a.accountSlot;
  const chosenClass = a.chosenClass;
  const classStats = HERO_CLASSES[chosenClass].baseStats;
  const spawnX = a.spawnX;
  const spawnY = a.spawnY;

  const player: Player = {
    id: a.id,
    accountUsername: accountUsername || null,
    accountSlot,
    role: a.role,
    name: savedChar ? savedChar.name : ((a.guestName || 'Hero').substring(0, 15).trim() || 'Hero'),
    characterClass: chosenClass,
    zone: 'town', // 'town', 'frostfell', or 'dungeon'
    x: spawnX,
    y: spawnY,
    targetX: null,
    targetY: null,
    moveDir: { dx: 0, dy: 0 },
    facing: 'SE',
    isMoving: false,
    level: savedChar ? (savedChar.level || 1) : 1,
    exp: savedChar ? (savedChar.exp || 0) : 0,
    expNext: expToNext(savedChar ? (savedChar.level || 1) : 1),
    skillPoints: savedChar ? (savedChar.skillPoints !== undefined ? savedChar.skillPoints : 1) : 1,
    jobLevel: savedChar ? (savedChar.jobLevel || 1) : 1,
    spLoadouts: (savedChar && savedChar.spLoadouts) || {},
    jobExp: savedChar ? (savedChar.jobExp || 0) : 0,
    jobExpNext: SP.jobExpToNext(savedChar ? (savedChar.jobLevel || 1) : 1),
    spTransformed: false,
    spCooldown: 0,
    skills: savedChar ? (savedChar.skills || {}) : {}, // { [skillId]: rank }
    baseStats: {
      maxHp: classStats.maxHp,
      maxMp: classStats.maxMp,
      dmg: classStats.dmg,
      def: classStats.def,
      speed: classStats.speed,
      attackRange: classStats.attackRange,
      attackSpeed: classStats.attackSpeed,
      swipe: classStats.swipe
    },
    attackSpeed: classStats.attackSpeed,
    swipe: classStats.swipe,
    equipment: savedChar && savedChar.equipment ? savedChar.equipment : {
      weapon: null,
      armor: null,
      helmet: null,
      boots: null,
      gloves: null,
      cape: null,
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
    gold: savedChar && savedChar.gold !== undefined ? savedChar.gold : 50,
    inventory: savedChar && savedChar.inventory ? {
      ...savedChar.inventory,
      maxSlots: savedChar.inventory.maxSlots || DEFAULT_BAG_SLOTS,
      items: Array.isArray(savedChar.inventory.items) ? savedChar.inventory.items : []
    } : {
      healthPotions: 3,
      manaPotions: 2,
      kills: 0,
      maxSlots: DEFAULT_BAG_SLOTS,
      items: [
        ItemFactory.stack(ITEMS.ancient_ruby),
        ItemFactory.stack(ITEMS.revival_stone)
      ]
    },
    storage: (savedChar && savedChar.storage) ? {
      maxSlots: savedChar.storage.maxSlots || 50,
      items: Array.isArray(savedChar.storage.items) ? savedChar.storage.items : []
    } : {
      maxSlots: 50,
      items: []
    },
    attackCooldown: 0,
    skillCooldown: 0,
    equippedSkills: savedChar && savedChar.equippedSkills ? savedChar.equippedSkills : JSON.parse(JSON.stringify(DEFAULT_EQUIPPED_SKILLS[chosenClass] || DEFAULT_EQUIPPED_SKILLS.warrior)),
    skillCooldowns: {
      slot1: 0,
      slot2: 0,
      slot3: 0,
      dash: 0,
      skill1: 0,
      skill2: 0
    },
    sprintTimer: 0,
    portalCooldown: 0,
    isAttacking: false,
    speechBubble: null,
    speechTimer: 0,
    isDead: false,
    respawnTimer: 0,
    statusEffects: [],
    speedFactor: 1.0,
    shieldHp: 0,
    berserkTimer: 0,
    ironFortressTimer: 0,
    smokeScreenTimer: 0
  };

  if (!savedChar) {
    // Equip starter gear tailored to chosen class (only the slots the class has gear for)
    for (const [slot, item] of Object.entries(starterEquipment(chosenClass))) {
      if (item) player.equipment[slot] = item;
    }
  }

  return player;
}
