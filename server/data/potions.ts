// Potion tuning (moved verbatim from gameServer.ts; values unchanged).

// Potions usable from the quick slots: share of max HP / MP restored
export const POTIONS = {
  health_potion: { kind: 'health', pct: 0.45 },
  greater_health_potion: { kind: 'health', pct: 0.75 },
  mana_potion: { kind: 'mana', pct: 0.5 },
  greater_mana_potion: { kind: 'mana', pct: 0.8 }
};
// Cooldown after drinking, shared by every potion of the same kind
export const POTION_COOLDOWN_MS = { health: 10000, mana: 5000 };
