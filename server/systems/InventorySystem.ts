// Bag and equipment actions: equip, unequip, shop buy/sell, favorites, town scroll, bag and chest expanders, the personal chest and picking up ground items.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import { ITEMS, requiredClass } from '../items';
import { DEFAULT_BAG_SLOTS, MAX_BAG_SLOTS } from '../config/constants';
import { ItemFactory } from '../entities/item';

export class InventorySystem {
  constructor(private readonly gs: GameServer) {}

  handleEquipItem(socketId: any, itemIndex: any) {
    const player = this.gs.players.get(socketId);
    if (!player || player.isDead) return;

    if (itemIndex < 0 || itemIndex >= player.inventory.items.length) return;
    const item = player.inventory.items[itemIndex];
    if (item && item.type === 'sp_card') return this.gs.equipSpCard(player, itemIndex);
    if (!item || item.type !== 'equipment' || !item.slot) return;

    const cls = requiredClass(item);
    if (cls && cls !== player.characterClass) {
      const socket = this.gs.io.sockets.sockets.get(socketId);
      if (socket) socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `Only a ${cls} can use this weapon!`, color: '#ef4444' });
      return;
    }

    const slot = item.slot;
    const oldEquipped = player.equipment[slot];

    // Remove 1 from inventory
    if (item.count > 1) {
      item.count--;
    } else {
      player.inventory.items.splice(itemIndex, 1);
    }

    // If an item was previously equipped in this slot, return it to inventory
    if (oldEquipped) {
      const existing = player.inventory.items.find((i: any) => i.id === oldEquipped.id);
      if (existing && existing.type !== 'equipment') {
        existing.count = (existing.count || 1) + 1;
      } else {
        player.inventory.items.push(ItemFactory.stack(oldEquipped));
      }
    }

    // Equip the new item
    player.equipment[slot] = ItemFactory.stack(item);
    this.gs.recalculatePlayerStats(player);

    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: `⚔️ Equipped ${item.name}!`,
        color: '#4ade80'
      });
    }

    this.gs.sendDirectMessage(player.id, `🛡️ [${player.name}] equipped [${item.name}]!`);
  }

  handleUnequipItem(socketId: any, slot: any) {
    const player = this.gs.players.get(socketId);
    if (!player || player.isDead) return;
    if (slot === 'sp' && player.spTransformed) this.gs.setTransformed(player, false);

    if (!player.equipment || !player.equipment[slot]) return;
    const item = player.equipment[slot];

    // Check bag capacity
    const maxUnequipCap = player.inventory.maxSlots || DEFAULT_BAG_SLOTS;
    if (player.inventory.items.length >= maxUnequipCap) {
      const socket = this.gs.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: `⚠️ Inventory is full!`,
          color: '#ef4444'
        });
      }
      return;
    }

    player.equipment[slot] = null;
    player.inventory.items.push(ItemFactory.stack(item));
    this.gs.recalculatePlayerStats(player);

    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: `Unequipped ${item.name}`,
        color: '#94a3b8'
      });
    }
  }

  // Merchant Shop Actions: Buy & Sell
  handleBuyItem(socketId: any, itemId: any, count = 1) {
    const player = this.gs.players.get(socketId);
    if (!player || player.isDead) return;

    const qty = Math.max(1, Math.min(999, parseInt(String(count), 10) || 1));
    const itemDef = ITEMS[itemId];
    if (!itemDef || !itemDef.buyPrice || itemDef.type !== 'consumable') return;

    const totalPrice = itemDef.buyPrice * qty;
    const socket = this.gs.io.sockets.sockets.get(socketId);

    if (player.gold < totalPrice) {
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.6,
          text: `⚠️ Need ${totalPrice.toLocaleString('en-US')} Gold! (Have ${(player.gold || 0).toLocaleString('en-US')})`,
          color: '#ef4444'
        });
      }
      return;
    }

    player.gold -= totalPrice;

    if (itemDef.id === 'health_potion') {
      player.inventory.healthPotions = (player.inventory.healthPotions || 0) + qty;
    } else if (itemDef.id === 'mana_potion') {
      player.inventory.manaPotions = (player.inventory.manaPotions || 0) + qty;
    } else {
      const existing = player.inventory.items.find((i: any) => i.id === itemDef.id);
      if (existing) {
        existing.count = (existing.count || 1) + qty;
      } else {
        player.inventory.items.push(ItemFactory.stack(itemDef, qty));
      }
    }

    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.6,
        text: `Bought ${itemDef.name} x${qty}! (-${totalPrice.toLocaleString('en-US')}g)`,
        color: '#facc15'
      });
    }
  }

  // Favorite items: a flag on the item; favorites can never be sold (unfavorite first)
  handleToggleFavorite(socketId: any, data: any) {
    const player = this.gs.players.get(socketId);
    if (!player || !data) return;
    const item = data.target === 'equipped'
      ? player.equipment && player.equipment[data.slot]
      : Number.isInteger(data.itemIndex) ? player.inventory.items[data.itemIndex] : null;
    if (!item || item.type === 'gold') return;
    if (item.favorite) delete item.favorite;
    else item.favorite = true;
    this.gs.savePlayerAccount(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (socket) socket.emit('player_updated', player);
  }

  handleSellItem(socketId: any, itemIndex: any, quantity = 1) {
    const player = this.gs.players.get(socketId);
    if (!player || player.isDead || player.zone !== 'town') return;

    if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= player.inventory.items.length) return;

    const item = player.inventory.items[itemIndex];
    if (item.favorite) {
      const socket = this.gs.io.sockets.sockets.get(socketId);
      if (socket) socket.emit('floating_text', { x: player.x, y: player.y - 0.6, text: 'Favorite items can\'t be sold', color: '#ef4444' });
      return;
    }
    const stackCount = item.count || 1;
    const sellCount = Math.max(1, Math.min(stackCount, parseInt(String(quantity), 10) || 1));
    const sellPrice = (item.sellPrice || 10) * sellCount;

    player.gold += sellPrice;

    if (stackCount > sellCount) {
      item.count = stackCount - sellCount;
    } else {
      player.inventory.items.splice(itemIndex, 1);
    }

    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.6,
        text: `+${sellPrice.toLocaleString('en-US')} Gold (Sold ${sellCount > 1 ? `${sellCount}x ` : ''}${item.name})`,
        color: '#facc15'
      });
    }
  }

  // Sell several bag slots at once: entries = [{ itemIndex, quantity }]
  handleSellItems(socketId: any, entries: any) {
    const player = this.gs.players.get(socketId);
    if (!player || player.isDead || player.zone !== 'town') return;
    if (!Array.isArray(entries) || entries.length === 0) return;

    const items = player.inventory.items;
    const qtyByIndex = new Map<any, any>();
    for (const e of entries.slice(0, items.length)) {
      if (!e || !Number.isInteger(e.itemIndex) || e.itemIndex < 0 || e.itemIndex >= items.length) continue;
      const item = items[e.itemIndex];
      // Special Cards and favorites are protected and will never be sold via Sell All / bulk selling
      if (item && (item.type === 'sp_card' || (item.id && item.id.startsWith('sp_card_')))) continue;
      if (item && item.favorite) continue;
      qtyByIndex.set(e.itemIndex, e.quantity);
    }
    if (qtyByIndex.size === 0) return;

    let total = 0;
    let soldCount = 0;
    // Highest index first so splicing does not shift the slots still to be sold
    for (const index of [...qtyByIndex.keys()].sort((a, b) => b - a)) {
      const item = items[index];
      const stackCount = item.count || 1;
      const sellCount = Math.max(1, Math.min(stackCount, parseInt(qtyByIndex.get(index), 10) || 1));
      total += (item.sellPrice || 10) * sellCount;
      soldCount += sellCount;
      if (stackCount > sellCount) item.count = stackCount - sellCount;
      else items.splice(index, 1);
    }
    player.gold += total;

    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.6,
        text: `+${total.toLocaleString('en-US')} Gold (Sold ${soldCount} item${soldCount > 1 ? 's' : ''})`,
        color: '#facc15'
      });
    }
  }

  // Town Portal Scroll: back to town from a field or a dungeon. A boss room
  // stays sealed, the same as leaving through the menu, and then the scroll
  // is not used up.
  handleUseTownScroll(socketId: string, data: any) {
    const player = this.gs.players.get(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead || !data) return;

    const item = player.inventory.items[Number(data.itemIndex)];
    if (!item || item.id !== 'town_scroll') return;
    if (player.zone === 'town') {
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: 'You are already in town!', color: '#ef4444' });
      return;
    }

    if (player.zone === 'dungeon') this.gs.handleLeaveDungeon(socketId);
    else this.gs.teleportPlayerToTown(player, socket);
    if (player.zone !== 'town') return;

    const idx = player.inventory.items.indexOf(item);
    if (item.count && item.count > 1) item.count--;
    else if (idx >= 0) player.inventory.items.splice(idx, 1);

    this.gs.savePlayerAccount(socketId);
    socket.emit('player_updated', player);
    socket.emit('floating_text', { x: player.x, y: player.y - 0.8, text: '📜 Returned to town!', color: '#facc15', size: 18 });
  }

  handleUseBagExpander(socketId: string, data: any) {
    const player = this.gs.players.get(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead || !data) return;

    const itemIndex = Number(data.itemIndex);
    const item = player.inventory.items[itemIndex];
    if (!item || !['bag_expander_sm', 'bag_expander_md', 'bag_expander_lg'].includes(item.id)) {
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: 'Invalid backpack expander!', color: '#ef4444' });
      return;
    }

    const curSlots = player.inventory.maxSlots || DEFAULT_BAG_SLOTS;
    const MAX_BAG_CAPACITY = MAX_BAG_SLOTS;
    if (curSlots >= MAX_BAG_CAPACITY) {
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `Backpack is already at maximum capacity (${MAX_BAG_SLOTS} slots)!`, color: '#ef4444' });
      return;
    }

    const slotsAdded = item.id === 'bag_expander_sm' ? 6 : item.id === 'bag_expander_md' ? 12 : 30;
    const rowsAdded = item.id === 'bag_expander_sm' ? 1 : item.id === 'bag_expander_md' ? 2 : 5;

    // Deduct 1 expander item
    if (item.count && item.count > 1) {
      item.count--;
    } else {
      player.inventory.items.splice(itemIndex, 1);
    }

    player.inventory.maxSlots = Math.min(MAX_BAG_CAPACITY, curSlots + slotsAdded);
    this.gs.savePlayerAccount(socketId);

    socket.emit('player_updated', player);
    socket.emit('floating_text', {
      x: player.x,
      y: player.y - 0.8,
      text: `🎒 Backpack Expanded! (+${rowsAdded} ${rowsAdded === 1 ? 'Row' : 'Rows'}, ${player.inventory.maxSlots} Slots)`,
      color: '#facc15',
      size: 19
    });
  }

  handleOpenPersonalChest(socketId: string) {
    const player = this.gs.players.get(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead) return;

    if (player.zone !== 'town') {
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: 'The Personal Chest is located in Town!', color: '#ef4444' });
      return;
    }

    const dist = Math.hypot(player.x - 15.6, player.y - 17.1);
    if (dist > 5.0) {
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: 'You are too far from the Personal Chest!', color: '#ef4444' });
      return;
    }

    player.storage = player.storage || { maxSlots: 50, items: [] };
    if (!Array.isArray(player.storage.items)) player.storage.items = [];
    if (!player.storage.maxSlots) player.storage.maxSlots = 50;

    socket.emit('personal_chest_data', {
      storage: player.storage,
      inventory: player.inventory
    });
  }

  handleDepositToChest(socketId: string, data: any) {
    const player = this.gs.players.get(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead || !data) return;

    if (player.zone !== 'town') {
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: 'The Personal Chest is in Town!', color: '#ef4444' });
      return;
    }
    const dist = Math.hypot(player.x - 15.6, player.y - 17.1);
    if (dist > 5.0) {
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: 'Too far from Personal Chest!', color: '#ef4444' });
      return;
    }

    player.storage = player.storage || { maxSlots: 50, items: [] };
    if (!Array.isArray(player.storage.items)) player.storage.items = [];
    const maxStorage = player.storage.maxSlots || 50;

    const canStack = (a: any, b: any) => {
      return a && b && a.id === b.id &&
        a.type !== 'equipment' && b.type !== 'equipment' &&
        !a.upgradeLevel && !b.upgradeLevel &&
        !a.sockets && !b.sockets &&
        !a.maxSockets && !b.maxSockets &&
        !a.brokenSockets && !b.brokenSockets &&
        !a.reforgeBonus && !b.reforgeBonus &&
        !a.custom && !b.custom;
    };

    if (data.all) {
      let movedCount = 0;
      for (let i = player.inventory.items.length - 1; i >= 0; i--) {
        const item = player.inventory.items[i];
        if (!item) continue;
        let deposited = false;
        if (canStack(item, item)) {
          const target = player.storage.items.find((s: any) => canStack(s, item));
          if (target) {
            target.count = (target.count || 1) + (item.count || 1);
            player.inventory.items.splice(i, 1);
            movedCount++;
            deposited = true;
          }
        }
        if (!deposited && player.storage.items.length < maxStorage) {
          player.storage.items.push(item);
          player.inventory.items.splice(i, 1);
          movedCount++;
        }
      }

      if (movedCount > 0) {
        this.gs.savePlayerAccount(socketId);
        socket.emit('player_updated', player);
        socket.emit('personal_chest_data', {
          storage: player.storage,
          inventory: player.inventory
        });
        socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `Deposited ${movedCount} items!`, color: '#6ee7b7' });
      } else {
        socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: 'Personal Chest is full or no items to deposit!', color: '#ef4444' });
      }
      return;
    }

    const itemIndex = Number(data.itemIndex);
    if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= player.inventory.items.length) {
      return;
    }

    const invItem = player.inventory.items[itemIndex];
    if (!invItem) return;

    const depositQty = Math.max(1, Math.min(invItem.count || 1, parseInt(String(data.count), 10) || (invItem.count || 1)));

    let stacked = false;
    if (canStack(invItem, invItem)) {
      const match = player.storage.items.find((s: any) => canStack(s, invItem));
      if (match) {
        match.count = (match.count || 1) + depositQty;
        stacked = true;
      }
    }

    if (!stacked) {
      if (player.storage.items.length >= maxStorage) {
        socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: 'Personal Chest is full!', color: '#ef4444' });
        return;
      }
      player.storage.items.push({
        ...invItem,
        count: depositQty
      });
    }

    if ((invItem.count || 1) > depositQty) {
      invItem.count = (invItem.count || 1) - depositQty;
    } else {
      player.inventory.items.splice(itemIndex, 1);
    }

    this.gs.savePlayerAccount(socketId);
    socket.emit('player_updated', player);
    socket.emit('personal_chest_data', {
      storage: player.storage,
      inventory: player.inventory
    });
  }

  handleWithdrawFromChest(socketId: string, data: any) {
    const player = this.gs.players.get(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead || !data) return;

    if (player.zone !== 'town') {
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: 'The Personal Chest is in Town!', color: '#ef4444' });
      return;
    }
    const dist = Math.hypot(player.x - 15.6, player.y - 17.1);
    if (dist > 5.0) {
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: 'Too far from Personal Chest!', color: '#ef4444' });
      return;
    }

    player.storage = player.storage || { maxSlots: 50, items: [] };
    if (!Array.isArray(player.storage.items)) player.storage.items = [];
    const maxBag = player.inventory.maxSlots || DEFAULT_BAG_SLOTS;

    const itemIndex = Number(data.itemIndex);
    if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= player.storage.items.length) {
      return;
    }

    const storageItem = player.storage.items[itemIndex];
    if (!storageItem) return;

    const withdrawQty = Math.max(1, Math.min(storageItem.count || 1, parseInt(String(data.count), 10) || (storageItem.count || 1)));

    const canStack = (a: any, b: any) => {
      return a && b && a.id === b.id &&
        a.type !== 'equipment' && b.type !== 'equipment' &&
        !a.upgradeLevel && !b.upgradeLevel &&
        !a.sockets && !b.sockets &&
        !a.maxSockets && !b.maxSockets &&
        !a.brokenSockets && !b.brokenSockets &&
        !a.reforgeBonus && !b.reforgeBonus &&
        !a.custom && !b.custom;
    };

    let stacked = false;
    if (canStack(storageItem, storageItem)) {
      const match = player.inventory.items.find((i: any) => canStack(i, storageItem));
      if (match) {
        match.count = (match.count || 1) + withdrawQty;
        stacked = true;
      }
    }

    if (!stacked) {
      if (player.inventory.items.length >= maxBag) {
        socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: 'Backpack is full!', color: '#ef4444' });
        return;
      }
      player.inventory.items.push({
        ...storageItem,
        count: withdrawQty
      });
    }

    if ((storageItem.count || 1) > withdrawQty) {
      storageItem.count = (storageItem.count || 1) - withdrawQty;
    } else {
      player.storage.items.splice(itemIndex, 1);
    }

    this.gs.savePlayerAccount(socketId);
    socket.emit('player_updated', player);
    socket.emit('personal_chest_data', {
      storage: player.storage,
      inventory: player.inventory
    });
  }

  handleUseChestExpander(socketId: string, data: any) {
    const player = this.gs.players.get(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead || !data) return;

    const itemIndex = Number(data.itemIndex);
    const item = player.inventory.items[itemIndex];
    if (!item || !['chest_expander_sm', 'chest_expander_md', 'chest_expander_lg'].includes(item.id)) {
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: 'Invalid chest expander!', color: '#ef4444' });
      return;
    }

    player.storage = player.storage || { maxSlots: 50, items: [] };
    const curSlots = player.storage.maxSlots || 50;
    const MAX_CHEST_CAPACITY = 300;
    if (curSlots >= MAX_CHEST_CAPACITY) {
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `Chest is already at maximum capacity (${MAX_CHEST_CAPACITY} slots)!`, color: '#ef4444' });
      return;
    }

    const slotsAdded = item.id === 'chest_expander_sm' ? 10 : item.id === 'chest_expander_md' ? 20 : 50;
    const newSlots = Math.min(MAX_CHEST_CAPACITY, curSlots + slotsAdded);
    const actualAdded = newSlots - curSlots;

    if (item.count && item.count > 1) {
      item.count--;
    } else {
      player.inventory.items.splice(itemIndex, 1);
    }

    player.storage.maxSlots = newSlots;
    this.gs.savePlayerAccount(socketId);

    socket.emit('player_updated', player);
    socket.emit('personal_chest_data', {
      storage: player.storage,
      inventory: player.inventory
    });
    socket.emit('floating_text', {
      x: player.x,
      y: player.y - 0.8,
      text: `📦 Personal Chest Expanded! (+${actualAdded} Slots, Total ${player.storage.maxSlots})`,
      color: '#facc15',
      size: 19
    });
  }

  handlePickupItem(socketId: any, itemId: any) {
    const player = this.gs.players.get(socketId);
    if (!player || player.isDead) return;

    const itemsMap = this.gs.getGroundItemsMap(player.zone);
    const item = itemsMap.get(itemId);
    if (!item) return;

    const dist = Math.hypot(item.x - player.x, item.y - player.y);
    if (dist <= 2.2) {
      this.gs.giveLootToPlayer(player, item);

      itemsMap.delete(itemId);
      this.gs.emitZone(player.zone, 'item_picked', { itemId, pickerId: player.id });

      const socket = this.gs.io.sockets.sockets.get(socketId);
      if (socket) socket.emit('player_updated', player);
    }
  }
}
