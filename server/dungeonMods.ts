// Dungeon modifiers: optional handicaps picked at the dungeon portal. Each makes
// the run harder and adds to its reward: more EXP and gold from every monster,
// and extra armor-set fragments from the boss. A party shares its leader's picks.
export const DUNGEON_MODS: Record<string, any> = {
  fortified: { id: 'fortified', name: 'Fortified', icon: '🧱', reward: 0.2, desc: 'Monsters have +40% HP.' },
  bloodlust: { id: 'bloodlust', name: 'Bloodlust', icon: '🩸', reward: 0.2, desc: 'Monsters deal +25% damage.' },
  swift: { id: 'swift', name: 'Swift', icon: '💨', reward: 0.15, desc: 'Monsters move 30% faster.' },
  volatile: { id: 'volatile', name: 'Volatile', icon: '💥', reward: 0.25, desc: 'Monsters burst 1.2s after dying, hitting heroes within 2 tiles for 12% of their Max HP.' },
  shielded: { id: 'shielded', name: 'Shielded Elites', icon: '🛡️', reward: 0.15, desc: 'Elites, minibosses and the boss carry a shield worth 25% of their HP.' },
  exhausting: { id: 'exhausting', name: 'Exhausting', icon: '⏳', reward: 0.15, desc: 'Your skill cooldowns are 25% longer.' }
};
export const MAX_DUNGEON_MODS = 4;
export const VOLATILE = { delayMs: 1200, radius: 2, hpShare: 0.12 };

// Clean a client's pick: known ids, no repeats, at most MAX_DUNGEON_MODS
export function parseMods(list: any): string[] {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map(String).filter(id => DUNGEON_MODS[id]))].slice(0, MAX_DUNGEON_MODS);
}

// Extra reward share of a set of modifiers (0.45 = +45% EXP and gold)
export function modReward(mods: string[]): number {
  return Number((mods || []).reduce((t, id) => t + (DUNGEON_MODS[id] ? DUNGEON_MODS[id].reward : 0), 0).toFixed(2));
}

// Bake the modifiers into one monster as it is set up for the run
export function applyModsToMob(mob: any, mods: string[]) {
  if (!mods || !mods.length) return mob;
  const has = (id: string) => mods.includes(id);
  const reward = 1 + modReward(mods);
  if (has('fortified')) { mob.maxHp = Math.round(mob.maxHp * 1.4); mob.hp = mob.maxHp; }
  if (has('bloodlust')) mob.dmg = Math.round(mob.dmg * 1.25);
  if (has('swift') && mob.speed) mob.speed = Number((mob.speed * 1.3).toFixed(2));
  if (has('shielded') && (mob.isBoss || mob.isMiniboss || mob.isCommander)) mob.shield = Math.round(mob.maxHp * 0.25);
  if (mob.exp) mob.exp = Math.round(mob.exp * reward);
  if (mob.gold) mob.gold = Math.round(mob.gold * reward);
  return mob;
}

// Extra boss fragments for a modded run: one per 0.2 of reward share
export function bonusBossFragments(mods: string[]): number {
  return Math.floor(modReward(mods) / 0.2);
}

export function clientCatalog() {
  return { max: MAX_DUNGEON_MODS, mods: Object.values(DUNGEON_MODS) };
}
