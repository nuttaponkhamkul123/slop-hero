// Loot and ground items: handing loot to a hero, loot entry names and items, finding a zone's ground-item map, spawning drops and sweeping expired ones.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import { ITEMS } from '../items';
import { DEFAULT_BAG_SLOTS, ITEM_DESPAWN_MS, ITEM_SWEEP_INTERVAL_MS } from '../config/constants';
import { ItemFactory } from '../entities/item';
import { createGroundItem } from '../entities/world';
import type { Player } from '../entities/types';

export class LootSystem {
  private _lastItemSweep = 0; // time of the last expired-drop sweep
  constructor(private readonly gs: GameServer) {}

  getGroundItemsMap(zone: any, playerOrInstId: any = null) {
    if (zone === 'town') return this.gs.townGroundItems;
    if (this.gs.fields && this.gs.fields.has(zone)) return this.gs.fields.get(zone).groundItems;
    if (zone === 'dungeon') {
      let instId = null;
      if (typeof playerOrInstId === 'string') instId = playerOrInstId;
      else if (playerOrInstId && playerOrInstId.dungeonInstanceId) instId = playerOrInstId.dungeonInstanceId;
      if (!instId) instId = this.gs.ctxInstanceId;
      if (instId && this.gs.dungeonInstances.has(instId)) {
        return this.gs.dungeonInstances.get(instId).groundItems;
      }
    }
    return this.gs.dungeonGroundItems;
  }

  // Add one loot entry ({ type: 'gold', amount } or { itemId, amount, customItemData })
  // to the player's purse / inventory, with a floating pickup label.
  giveLootToPlayer(player: Player, entry: any, showText = true) {
    const text = (label: any, color: any) => {
      if (showText) this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.6, text: label, color });
    };
    if (entry.type === 'gold') {
      player.gold += entry.amount;
      text(`+${entry.amount.toLocaleString('en-US')} Gold`, '#facc15');
    } else if (entry.itemId === 'health_potion') {
      player.inventory.healthPotions += (entry.amount || 1);
      text(`+${entry.amount || 1} Health Potion`, '#f87171');
    } else if (entry.itemId === 'mana_potion') {
      player.inventory.manaPotions += (entry.amount || 1);
      text(`+${entry.amount || 1} Mana Potion`, '#60a5fa');
    } else {
      // Collectible Relic / Equipment / Consumables
      const def = entry.customItemData || ITEMS[entry.itemId];
      if (def) {
        const n = entry.amount || 1;
        const existing = player.inventory.items.find((i: any) => i.id === def.id && !def.custom);
        if (existing && def.type !== 'equipment') {
          existing.count = (existing.count || 1) + n;
        } else {
          const maxLootCap = player.inventory.maxSlots || DEFAULT_BAG_SLOTS;
          if (player.inventory.items.length >= maxLootCap) {
            text('⚠️ Inventory full!', '#ef4444');
            return;
          }
          player.inventory.items.push(ItemFactory.stack(def, def.type === 'equipment' ? 1 : n));
        }
        text(`+${def.name}`, def.rarity === 'legendary' ? '#f59e0b' : def.rarity === 'epic' ? '#a855f7' : def.rarity === 'rare' ? '#38bdf8' : '#4ade80');
      }
    }
  }

  lootEntryName(entry: any) {
    return ItemFactory.lootEntryName(entry);
  }

  lootEntryToItem(entry: any) {
    return ItemFactory.fromLootEntry(entry);
  }

  spawnGroundItem(zone: any, type: any, itemIdOrName: any, x: any, y: any, amount: any, customItemData: any = null, instanceId: any = null) {
    const id = `item_${this.gs.nextEntityId++}`;
    const itemsMap = this.gs.getGroundItemsMap(zone, instanceId);

    const item = createGroundItem({ id, zone, type, itemIdOrName, x, y, amount, customItemData });

    itemsMap.set(id, item);
    this.gs.emitZone(zone, 'item_dropped', item, instanceId);
  }

  // Remove ground loot older than ITEM_DESPAWN_MS in every zone and instance
  sweepGroundItems() {
    const now = Date.now();
    if (this.gs._lastItemSweep && now - this.gs._lastItemSweep < ITEM_SWEEP_INTERVAL_MS) return;
    this.gs._lastItemSweep = now;
    const sweep = (map: any, zone: string, instanceId: any = null) => {
      for (const [id, item] of map) {
        if (item.expiresAt && item.expiresAt <= now) {
          map.delete(id);
          this.gs.emitZone(zone, 'item_despawned', { itemId: id, x: item.x, y: item.y }, instanceId);
        }
      }
    };
    sweep(this.gs.townGroundItems, 'town');
    for (const [fieldId, field] of this.gs.fields) sweep(field.groundItems, fieldId);
    for (const inst of this.gs.dungeonInstances.values()) sweep(inst.groundItems, 'dungeon', inst.id);
  }
}
