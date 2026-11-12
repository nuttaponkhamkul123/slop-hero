// Single table of per-class starting data. It replaces the stat tables and starter-gear
// blocks that used to be copied inside GameServer.makeStarterCharacter and GameServer.addPlayer.
import { ITEMS } from '../items';
import { ItemFactory } from '../entities/item';

export interface HeroClassDef {
  /** level-1 stats */
  baseStats: {
    maxHp: number; maxMp: number; dmg: number; def: number;
    speed: number; attackRange: number; attackSpeed: number; swipe: number;
  };
  /** ITEMS ids of the starter equipment (null = empty slot) */
  starterGear: { weapon: string; armor: string | null; helmet: string | null };
  /** name of the class' first skill (kept from the old addPlayer table; not read anywhere yet) */
  skillName: string;
  /** attacks from range with projectiles instead of a melee sweep (read through isRangedClass) */
  isRanged: boolean;
}

export const HERO_CLASSES: Record<string, HeroClassDef> = {
  warrior: {
    baseStats: { maxHp: 180, maxMp: 50, dmg: 22, def: 8, speed: 4.8, attackRange: 1.6, attackSpeed: 1.0, swipe: 40 },
    starterGear: { weapon: 'iron_blade', armor: null, helmet: 'iron_helm' },
    skillName: 'Whirlwind',
    isRanged: false
  },
  mage: {
    baseStats: { maxHp: 95, maxMp: 130, dmg: 32, def: 3, speed: 4.4, attackRange: 5.5, attackSpeed: 0.95, swipe: 15 },
    starterGear: { weapon: 'archmage_staff', armor: 'mystic_robe', helmet: null },
    skillName: 'Firestorm',
    isRanged: true
  },
  rogue: {
    baseStats: { maxHp: 125, maxMp: 70, dmg: 26, def: 5, speed: 5.4, attackRange: 1.8, attackSpeed: 1.30, swipe: 25 },
    starterGear: { weapon: 'shadow_daggers', armor: 'leather_tunic', helmet: null },
    skillName: 'Shadow Strike',
    isRanged: false
  }
};

/** True only for real classes. (An own-property check: names like 'constructor' are not classes.) */
export function isHeroClass(cls: unknown): boolean {
  return typeof cls === 'string' && Object.prototype.hasOwnProperty.call(HERO_CLASSES, cls);
}

/** Starter equipment of a class as fresh item stacks, slots in the order weapon, armor, helmet. */
export function starterEquipment(cls: string): { weapon: any; armor: any; helmet: any } {
  const g = HERO_CLASSES[cls].starterGear;
  const stack = (id: string | null) => (id ? ItemFactory.stack((ITEMS as any)[id]) : null);
  return { weapon: stack(g.weapon), armor: stack(g.armor), helmet: stack(g.helmet) };
}

/** True for classes that attack from range with projectiles (only the mage today); unknown classes are melee. */
export function isRangedClass(cls: string | undefined | null): boolean {
  return !!cls && Object.prototype.hasOwnProperty.call(HERO_CLASSES, cls) && HERO_CLASSES[cls].isRanged;
}
