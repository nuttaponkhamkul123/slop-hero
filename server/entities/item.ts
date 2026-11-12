// Item factory: every way the server builds an item instance goes through here.
// The shapes live in ./types.ts. Each function returns exactly what the literal it replaced did.
import { ITEMS, generateRandomizedGear } from '../items';
import * as SP from '../spCards';
import type { Item } from './types';

/** Display name of a loot entry ("1,500 Gold", "Health Potion x3", ...). */
function lootEntryName(entry: any): string {
  if (entry.type === 'gold') return `${entry.amount.toLocaleString('en-US')} Gold`;
  const def = entry.customItemData || (ITEMS as any)[entry.itemId];
  const name = def ? def.name : entry.itemId;
  return (entry.amount || 1) > 1 ? `${name} x${entry.amount}` : name;
}

export const ItemFactory = {
  /** A stack of `count` copies of an item definition or instance (the source is not modified). */
  stack(source: any, count: number = 1): Item {
    return { ...source, count };
  },

  /** An SP card as an inventory item: the card, flagged custom, one of them. */
  card(cardId: string, upgradeLevel: number = 0): Item {
    return { ...SP.makeCardItem(cardId, upgradeLevel), custom: true, count: 1 };
  },

  /** An SP card as the `customItemData` of a loot entry (flagged custom, no count: the entry carries the amount). */
  cardLootData(cardId: string): Item {
    return { ...SP.makeCardItem(cardId), custom: true };
  },

  /** Gear with rolled stats (see generateRandomizedGear). */
  gear(baseId: string, itemLevel: number = 1, isBoss: boolean = false): any {
    return generateRandomizedGear(baseId, itemLevel, isBoss);
  },

  /** A piece forged by James: the definition plus a unique id in the forge's own format. */
  forged(def: any): Item {
    return { ...def, count: 1, uniqueId: `${def.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
  },

  lootEntryName,

  /** The item (or gold / potion stack) a loot entry stands for; null for no entry. */
  fromLootEntry(entry: any): Item | null {
    if (!entry) return null;
    if (entry.type === 'gold') {
      return { id: 'gold', name: `${entry.amount.toLocaleString('en-US')} Gold`, count: entry.amount, type: 'gold', rarity: 'common' };
    }
    if (entry.itemId === 'health_potion') {
      return { id: 'health_potion', name: 'Health Potion', count: entry.amount || 1, type: 'consumable', rarity: 'common', desc: 'Restores 60 Health instantly.' };
    }
    if (entry.itemId === 'mana_potion') {
      return { id: 'mana_potion', name: 'Mana Potion', count: entry.amount || 1, type: 'consumable', rarity: 'common', desc: 'Restores 50 Mana instantly.' };
    }
    const def = entry.customItemData || (ITEMS as any)[entry.itemId];
    if (def) {
      return { ...def, count: entry.amount || 1 };
    }
    return { id: entry.itemId || 'unknown', name: lootEntryName(entry), count: entry.amount || 1, rarity: 'common' };
  }
};
