// Player factories: the shapes live in ./types.ts.
import { expToNext } from '../progression';
import { ITEMS } from '../items';
import { DEFAULT_BAG_SLOTS } from '../config/constants';
import { DEFAULT_EQUIPPED_SKILLS } from '../data/skills';
import { isHeroClass, starterEquipment } from '../data/heroClasses';
import type { SavedCharacter } from './types';

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
        { ...ITEMS.ancient_ruby, count: 1 },
        { ...ITEMS.revival_stone, count: 1 }
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
