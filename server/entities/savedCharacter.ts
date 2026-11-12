// What is written to the account file for a character (kept free of heavy imports: accountManager uses it).
import type { SavedCharacter } from './types';

/**
 * The serializable part of a live player (or of any character-shaped object), with defaults for
 * everything that may be missing. Only these fields are saved; anything else on the object is dropped.
 */
export function toSavedCharacter(characterData: any, now: number = Date.now()): SavedCharacter {
  return {
    name: characterData.name,
    characterClass: characterData.characterClass,
    level: characterData.level || 1,
    exp: characterData.exp || 0,
    expNext: characterData.expNext,
    skillPoints: characterData.skillPoints || 0,
    skills: characterData.skills || {},
    // a transformed hero is saved with their own skills, not the card's
    equippedSkills: (characterData.spTransformed && characterData.baseEquippedSkills) || characterData.equippedSkills || null,
    jobLevel: characterData.jobLevel || 1,
    spLoadouts: characterData.spLoadouts || {},
    jobExp: characterData.jobExp || 0,
    equipment: characterData.equipment || {},
    gold: characterData.gold || 0,
    inventory: characterData.inventory || { healthPotions: 3, manaPotions: 2, maxSlots: 150, items: [] },
    storage: characterData.storage || { maxSlots: 50, items: [] },
    zone: characterData.zone || 'town',
    x: characterData.x,
    y: characterData.y,
    savedAt: now
  };
}
