// Gear improvement: reforge anvil, crafting window, attribute smith, rune sockets, socket expanding and the enchanter, plus the stat recalculation of upgraded items.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import { ITEMS, REFORGE_COSTS, rollSkyblockReforge, applySkyblockReforge, ENHANCE_MAX, ENHANCE_SAFE_LEVEL, enhanceCost, enhanceChance, ensureSockets, socketKind, runeFits, SOCKET_MAX } from '../items';
import * as CRAFT from '../crafting';
import * as ATTR from '../itemAttributes';
import { DEFAULT_BAG_SLOTS } from '../config/constants';
import { ItemFactory } from '../entities/item';
import type { Item } from '../entities/types';

export class ItemUpgradeSystem {
  constructor(private readonly gs: GameServer) {}

  // Hypixel Skyblock Reforge Anvil Actions (Brom the Master Smith)
  handleReforgeItem(socketId: any, data: any) {
    const player = this.gs.players.get(socketId);
    if (!player || player.isDead || player.zone !== 'town') return;

    let targetItem = null;
    let isEquipped = false;

    if (data.target === 'equipped') {
      if (player.equipment && player.equipment[data.slot]) {
        targetItem = player.equipment[data.slot];
        isEquipped = true;
      }
    } else if (data.target === 'inventory') {
      if (player.inventory && player.inventory.items && player.inventory.items[data.itemIndex]) {
        targetItem = player.inventory.items[data.itemIndex];
      }
    }

    if (!targetItem || targetItem.type !== 'equipment') return;

    const rarity = targetItem.rarity || 'common';
    const reforgeCost = (REFORGE_COSTS as any)[rarity] || 50;
    const socket = this.gs.io.sockets.sockets.get(socketId);

    if (player.gold < reforgeCost) {
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: `⚠️ ต้องการ ${reforgeCost.toLocaleString('en-US')} Gold!`,
          color: '#ef4444'
        });
      }
      return;
    }

    // Deduct reforge fee
    player.gold -= reforgeCost;

    // Roll Hypixel Skyblock Reforge
    const rolledReforge = rollSkyblockReforge(targetItem);
    if (!rolledReforge) return;

    applySkyblockReforge(targetItem, rolledReforge);
    this.gs.applyItemUpgradeStats(targetItem);

    if (isEquipped) {
      this.gs.recalculatePlayerStats(player);
    }

    this.gs.savePlayerAccount(socketId);

    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('reforge_result', {
        success: true,
        item: targetItem,
        reforge: rolledReforge,
        reforgeStats: targetItem.reforgeStats,
        cost: reforgeCost,
        target: data.target,
        slot: data.slot,
        itemIndex: data.itemIndex
      });
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.8,
        text: `🔨 REFORGED: ${rolledReforge}!`,
        color: '#facc15',
        size: 20
      });
    }

    this.gs.emitZone(player.zone, 'skill_fx', {
      type: 'whirlwind',
      x: player.x,
      y: player.y,
      radius: 1.5,
      playerId: player.id
    });

    if (targetItem.rarity === 'legendary' || targetItem.rarity === 'epic' || targetItem.rarity === 'divine') {
      this.gs.broadcastSystemMessage(`🌟 [${player.name}] reforged [${targetItem.name}] with [${rolledReforge}] at Brom's Anvil!`);
    }
  }

  // Crafting window: craft `times` of a recipe (crafting.ts does every check)
  handleCraft(socketId: string, data: any) {
    const player = this.gs.players.get(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead || !data) return;
    const res: any = CRAFT.craft(this.gs, player, String(data.recipeId || ''), Number(data.times) || 1);
    socket.emit('craft_result', { ok: res.ok, message: res.message, recipeId: data.recipeId, items: res.items || [] });
    if (!res.ok) return;
    const top = res.items[0];
    this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.8, text: `🔨 ${res.message}`, color: top && top.rarity === 'legendary' ? '#f59e0b' : '#4ade80', size: 16 });
    if (top && top.setId) this.gs.broadcastSystemMessage(`🔨 [${player.name}] crafted [${top.name}]!`);
    this.gs.savePlayerAccount(socketId);
    socket.emit('player_updated', player);
  }

  // ---- Jerry the Attribute Smith (itemAttributes.ts) ----
  // data: { action: 'socket' | 'roll' | 'reset', target: 'equipped' | 'inventory', slot?, itemIndex?, locks?: number[] }
  handleAttributes(socketId: string, data: any) {
    const player = this.gs.players.get(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead || !data) return;
    const reply = (ok: boolean, message: string, extra: any = {}) => socket.emit('attr_result', { ok, message, action: data.action, ...extra });
    const jerry = player.zone === 'town' && this.gs.townMap.obstacles.find((o: any) => o.id === 'npc_jerry');
    if (!jerry || Math.hypot(jerry.x - player.x, jerry.y - player.y) > 4.5) return reply(false, 'Walk up to Jerry first');

    let item: any = null;
    const isEquipped = data.target === 'equipped';
    if (isEquipped) item = player.equipment && player.equipment[data.slot];
    else if (Number.isInteger(data.itemIndex)) item = player.inventory.items[data.itemIndex];
    if (!ATTR.canHoldAttributes(item)) return reply(false, 'Pick a piece of gear');
    ATTR.ensureAttrs(item);
    const cap = ATTR.attrSlotCap(item);
    if (cap <= 0) return reply(false, 'Common gear has no attribute slots');

    const stackOf = (id: string) => player.inventory.items.find((i: any) => i && i.id === id);
    const have = (id: string) => { const st = stackOf(id); return st ? (st.count || 1) : 0; };
    const spend = (id: string, n: number) => {
      const st = stackOf(id);
      if ((st.count || 1) > n) st.count -= n;
      else player.inventory.items.splice(player.inventory.items.indexOf(st), 1);
    };
    // locked slots: only filled ones count
    const locks = new Set<number>((Array.isArray(data.locks) ? data.locks : [])
      .map(Number).filter((i: number) => Number.isInteger(i) && i >= 0 && i < item.attrSlots && item.attrs[i]));

    let changed: number[] = [];
    let message = '';
    if (data.action === 'socket') {
      if (item.attrSlots >= cap) return reply(false, `All ${cap} slots are open already`);
      if (have('attr_socketer') < 1) return reply(false, 'You need an Attribute Socketer');
      spend('attr_socketer', 1);
      item.attrSlots += 1;
      item.attrs.push(null);
      changed = [item.attrSlots - 1];
      message = `Slot ${item.attrSlots} opened`;
    } else if (data.action === 'roll') {
      if (item.attrSlots <= 0) return reply(false, 'No open slots: open one with a Socketer first');
      if (locks.size >= item.attrSlots) return reply(false, 'Unlock at least one slot to roll');
      const cost = Math.max(1, locks.size);
      if (have('attr_roller') < cost) return reply(false, `This roll needs ${cost} Attribute Roller${cost > 1 ? 's' : ''}`);
      spend('attr_roller', cost);
      changed = ATTR.rerollAttrs(item, locks);
      message = 'Attributes rolled';
    } else if (data.action === 'reset') {
      const open = item.attrs.filter((a: any, i: number) => a && !locks.has(i)).length;
      if (!open) return reply(false, 'No unlocked attributes to reset');
      if (have('attr_reseter') < 1) return reply(false, 'You need an Attribute Reseter');
      spend('attr_reseter', 1);
      changed = ATTR.rerollAttrValues(item, locks);
      message = 'Values rolled again';
    } else {
      return;
    }

    if (isEquipped) this.gs.recalculatePlayerStats(player);
    this.gs.savePlayerAccount(socketId);
    // (a material stack that ran out shifts the bag: send the item's index as it is now)
    reply(true, message, { changed, target: data.target, slot: data.slot, itemIndex: isEquipped ? undefined : player.inventory.items.indexOf(item) });
    socket.emit('player_updated', player);
  }

  handleSocketRune(socketId: string, data: any) {
    const player = this.gs.players.get(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead || !data) return;

    let targetItem: any = null;
    let isEquipped = false;
    if (data.target === 'equipped' && player.equipment && player.equipment[data.slot || 'weapon']) {
      targetItem = player.equipment[data.slot || 'weapon'];
      isEquipped = true;
    } else if (data.target === 'inventory' && Number.isInteger(data.itemIndex)) {
      targetItem = player.inventory.items[data.itemIndex];
    }
    if (!socketKind(targetItem)) {
      socket.emit('socket_result', { ok: false, message: 'Only weapons and armor pieces have sockets!' });
      return;
    }

    ensureSockets(targetItem);

    const runeIndex = Number(data.runeIndex);
    const runeItem = player.inventory.items[runeIndex];
    if (!runeItem || runeItem.type !== 'rune') {
      socket.emit('socket_result', { ok: false, message: 'Select a valid rune item!' });
      return;
    }
    if (!runeFits(runeItem, targetItem)) {
      socket.emit('socket_result', { ok: false, message: socketKind(targetItem) === 'armor' ? 'Armor takes defensive runes only!' : 'Weapons take elemental runes only!' });
      return;
    }

    const maxSockets = targetItem.maxSockets || 0;
    const brokenSockets = targetItem.brokenSockets || 0;
    const usableSockets = Math.max(0, maxSockets - brokenSockets);
    let slotIdx = Number(data.socketSlotIndex !== undefined ? data.socketSlotIndex : targetItem.sockets.findIndex((s: any) => s === null));

    if (slotIdx < 0 || slotIdx >= usableSockets) {
      socket.emit('socket_result', { ok: false, message: 'No available socket slot!' });
      return;
    }

    // If slot has an existing rune, return it to inventory if possible
    const existingRune = targetItem.sockets[slotIdx];
    if (existingRune) {
      const existingDef = ITEMS[existingRune] || ITEMS[`rune_${existingRune}`];
      if (existingDef) {
        const stack = player.inventory.items.find((i: any) => i.id === existingDef.id);
        if (stack) {
          stack.count = (stack.count || 1) + 1;
        } else {
          player.inventory.items.push(ItemFactory.stack(existingDef));
        }
      }
    }

    // Deduct 1 rune item from inventory
    if (runeItem.count && runeItem.count > 1) {
      runeItem.count--;
    } else {
      player.inventory.items.splice(runeIndex, 1);
    }

    targetItem.sockets[slotIdx] = runeItem.id;

    if (isEquipped) {
      this.gs.recalculatePlayerStats(player);
    }
    this.gs.savePlayerAccount(socketId);

    socket.emit('player_updated', player);
    socket.emit('socket_result', {
      ok: true,
      action: 'socket',
      slotIdx,
      runeId: runeItem.id,
      item: targetItem,
      target: data.target,
      slot: data.slot,
      itemIndex: data.itemIndex
    });
    this.gs.emitZone(player.zone, 'floating_text', {
      x: player.x,
      y: player.y - 0.7,
      text: `✨ SOCKETED: ${runeItem.name}!`,
      color: runeItem.color || '#f59e0b',
      size: 18
    });
  }

  handleUnsocketRune(socketId: string, data: any) {
    const player = this.gs.players.get(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead || !data) return;

    let targetItem: any = null;
    let isEquipped = false;
    if (data.target === 'equipped' && player.equipment && player.equipment[data.slot || 'weapon']) {
      targetItem = player.equipment[data.slot || 'weapon'];
      isEquipped = true;
    } else if (data.target === 'inventory' && Number.isInteger(data.itemIndex)) {
      targetItem = player.inventory.items[data.itemIndex];
    }
    if (!socketKind(targetItem)) return;

    ensureSockets(targetItem);

    const slotIdx = Number(data.socketSlotIndex);
    if (slotIdx < 0 || slotIdx >= targetItem.sockets.length || !targetItem.sockets[slotIdx]) {
      socket.emit('socket_result', { ok: false, message: 'No rune socketed in this slot!' });
      return;
    }

    const runeId = targetItem.sockets[slotIdx];
    const runeDef = ITEMS[runeId] || ITEMS[`rune_${runeId}`];
    if (!runeDef) return;

    // Check inventory capacity
    const maxUnsocketCap = player.inventory.maxSlots || DEFAULT_BAG_SLOTS;
    if (player.inventory.items.length >= maxUnsocketCap && !player.inventory.items.some((i: any) => i.id === runeDef.id)) {
      socket.emit('socket_result', { ok: false, message: 'Inventory is full!' });
      return;
    }

    targetItem.sockets[slotIdx] = null;

    const stack = player.inventory.items.find((i: any) => i.id === runeDef.id);
    if (stack) {
      stack.count = (stack.count || 1) + 1;
    } else {
      player.inventory.items.push(ItemFactory.stack(runeDef));
    }

    if (isEquipped) {
      this.gs.recalculatePlayerStats(player);
    }
    this.gs.savePlayerAccount(socketId);

    socket.emit('player_updated', player);
    socket.emit('socket_result', {
      ok: true,
      action: 'unsocket',
      slotIdx,
      runeId,
      item: targetItem,
      target: data.target,
      slot: data.slot,
      itemIndex: data.itemIndex
    });
    this.gs.emitZone(player.zone, 'floating_text', {
      x: player.x,
      y: player.y - 0.7,
      text: `🔄 EXTRACTED: ${runeDef.name}`,
      color: '#94a3b8',
      size: 16
    });
  }

  handleExpandSocket(socketId: string, data: any) {
    const player = this.gs.players.get(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead || !data) return;

    let targetItem: any = null;
    let isEquipped = false;
    if (data.target === 'equipped' && player.equipment && player.equipment[data.slot || 'weapon']) {
      targetItem = player.equipment[data.slot || 'weapon'];
      isEquipped = true;
    } else if (data.target === 'inventory' && Number.isInteger(data.itemIndex)) {
      targetItem = player.inventory.items[data.itemIndex];
    }
    const kind = socketKind(targetItem);
    if (!kind) {
      socket.emit('socket_result', { ok: false, message: 'Can only expand sockets on weapons and armor!' });
      return;
    }

    ensureSockets(targetItem);

    const maxAllowed = SOCKET_MAX[kind];
    if (targetItem.maxSockets >= maxAllowed) {
      socket.emit('socket_result', { ok: false, message: `This ${kind} already has maximum sockets (${maxAllowed})!` });
      return;
    }

    let expanderIndex = Number(data.expanderIndex);
    let expanderItem = player.inventory.items[expanderIndex];
    if (!expanderItem || expanderItem.id !== 'socket_expander') {
      expanderIndex = player.inventory.items.findIndex((i: any) => i && i.id === 'socket_expander');
      expanderItem = player.inventory.items[expanderIndex];
    }
    if (!expanderItem) {
      socket.emit('socket_result', { ok: false, message: 'You need an Ancient Socket Expander!' });
      return;
    }

    // Consume 1 socket expander
    if (expanderItem.count && expanderItem.count > 1) {
      expanderItem.count--;
    } else {
      player.inventory.items.splice(expanderIndex, 1);
    }

    const currentSockets = targetItem.maxSockets || 0;
    const roll = Math.random();
    let success = false;
    let broken = false;

    if (currentSockets === 0) {
      success = roll < 0.70;
    } else if (currentSockets === 1) {
      if (roll < 0.50) success = true;
      else if (roll < 0.70) broken = true;
    } else if (currentSockets === 2) {
      if (roll < 0.35) success = true;
      else if (roll < 0.65) broken = true;
    } else {
      if (roll < 0.20) success = true;
      else if (roll < 0.65) broken = true;
    }

    if (success) {
      targetItem.maxSockets++;
      targetItem.sockets.push(null);
    } else if (broken) {
      targetItem.brokenSockets = (targetItem.brokenSockets || 0) + 1;
    }

    if (isEquipped) {
      this.gs.recalculatePlayerStats(player);
    }
    this.gs.savePlayerAccount(socketId);

    socket.emit('player_updated', player);
    socket.emit('socket_expand_result', {
      ok: true,
      success,
      broken,
      maxSockets: targetItem.maxSockets,
      brokenSockets: targetItem.brokenSockets,
      item: targetItem,
      target: data.target,
      slot: data.slot,
      itemIndex: data.itemIndex
    });

    const msg = success
      ? `💎 SOCKET EXPANDED! (+1 Slot, total ${targetItem.maxSockets})`
      : broken
        ? `💥 DRILL FAILED! A socket broke! (${targetItem.brokenSockets} broken)`
        : `⚠️ EXPANSION FAILED! (Drill shattered harmlessly)`;
    const color = success ? '#22c55e' : broken ? '#ef4444' : '#eab308';

    this.gs.emitZone(player.zone, 'floating_text', {
      x: player.x,
      y: player.y - 0.8,
      text: msg,
      color,
      size: 19
    });

    if (success && targetItem.maxSockets >= 3) {
      this.gs.broadcastSystemMessage(`🔮 [${player.name}] expanded [${targetItem.name}] to ${targetItem.maxSockets} Sockets!`);
    }
  }

  applyItemUpgradeStats(item: Item) {
    if (!item) return;
    const lvl = item.upgradeLevel || 0;
    if (item.baseBonusDmg === undefined) item.baseBonusDmg = item.bonusDmg || 0;
    if (item.baseBonusDef === undefined) item.baseBonusDef = item.bonusDef || 0;
    if (item.baseBonusHp === undefined) item.baseBonusHp = item.bonusHp || 0;
    if (item.baseBonusMp === undefined) item.baseBonusMp = item.bonusMp || 0;
    if (item.baseBonusSpeed === undefined) item.baseBonusSpeed = item.bonusSpeed || 0;
    if (item.baseBonusAttackSpeed === undefined) item.baseBonusAttackSpeed = item.bonusAttackSpeed || 0;
    if (item.baseBonusSwipe === undefined) item.baseBonusSwipe = item.bonusSwipe || 0;
    if (!item.baseName) item.baseName = item.name.replace(/\s\+\d+$/, '');

    let addDmg = 0, addDef = 0, addHp = 0, addMp = 0, addSpeed = 0, addAtkSpd = 0, addSwipe = 0;
    // Each level also adds a share of the item's own base stats
    const pct = lvl * 0.05;
    addDmg += Math.round(item.baseBonusDmg * pct);
    addDef += Math.round(item.baseBonusDef * pct);
    addHp += Math.round(item.baseBonusHp * pct);
    addMp += Math.round(item.baseBonusMp * pct);
    if (item.slot === 'weapon') {
      addDmg += lvl * 4;
      addSwipe = lvl * 3;
      addAtkSpd = lvl * 0.02;
    } else if (item.slot === 'armor') {
      addDef += lvl * 2;
      addHp += lvl * 25;
    } else if (item.slot === 'helmet') {
      addDef += lvl * 2;
      addHp += lvl * 15;
      addMp += lvl * 10;
    } else if (item.slot === 'boots') {
      addDef += lvl * 1;
      addSpeed = lvl * 0.08;
      addHp += lvl * 10;
    } else if (item.slot === 'gloves') {
      addDmg += lvl * 4;
      addAtkSpd = lvl * 0.01;
    } else if (item.slot === 'cape') {
      addDef += lvl * 2;
      addHp += lvl * 12;
    } else if (item.slot === 'ring') {
      addDmg += lvl * 3;
      addHp += lvl * 15;
      addMp += lvl * 15;
      addAtkSpd = lvl * 0.01;
    }

    item.bonusDmg = item.baseBonusDmg + addDmg;
    item.bonusDef = item.baseBonusDef + addDef;
    item.bonusHp = item.baseBonusHp + addHp;
    item.bonusMp = item.baseBonusMp + addMp;
    item.bonusSpeed = Number((item.baseBonusSpeed + addSpeed).toFixed(2));
    item.bonusAttackSpeed = Number((item.baseBonusAttackSpeed + addAtkSpd).toFixed(2));
    item.bonusSwipe = Math.round(item.baseBonusSwipe + addSwipe);
    const named = item.reforge ? `${item.reforge} ${item.baseName}` : item.baseName;
    item.name = lvl > 0 ? `${named} +${lvl}` : named;
  }

  // Enchanter: try to raise an item's +level. Gold is spent either way; from
  // +${ENHANCE_SAFE_LEVEL} upward a failure also drops the item one level.
  handleEnhanceItem(socketId: any, data: any) {
    const player = this.gs.players.get(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead || player.zone !== 'town' || !data) return;

    let item = null;
    let isEquipped = false;
    if (data.target === 'equipped' && player.equipment && player.equipment[data.slot]) {
      item = player.equipment[data.slot];
      isEquipped = true;
    } else if (data.target === 'inventory' && Number.isInteger(data.itemIndex)) {
      item = player.inventory.items[data.itemIndex] || null;
    }
    if (!item || item.type !== 'equipment') return;

    const lvl = item.upgradeLevel || 0;
    const fail = (text: any) => socket.emit('enhance_result', { ok: false, message: text });
    if (lvl >= ENHANCE_MAX) return fail(`Already at the maximum +${ENHANCE_MAX}!`);
    const cost = enhanceCost(item);
    if (player.gold < cost) return fail(`Need ${cost.toLocaleString()} Gold!`);

    player.gold -= cost;
    const chance = enhanceChance(item);
    const success = Math.random() < chance;
    let downgraded = false;
    if (success) {
      item.upgradeLevel = lvl + 1;
    } else if (lvl >= ENHANCE_SAFE_LEVEL) {
      item.upgradeLevel = lvl - 1;
      downgraded = true;
    }
    this.gs.applyItemUpgradeStats(item);
    if (isEquipped) this.gs.recalculatePlayerStats(player);
    this.gs.savePlayerAccount(socketId);

    socket.emit('player_updated', player);
    socket.emit('enhance_result', { ok: true, success, downgraded, level: item.upgradeLevel || 0, cost, item, target: data.target, slot: data.slot, itemIndex: data.itemIndex });
    this.gs.emitZone(player.zone, 'floating_text', {
      x: player.x, y: player.y - 0.8,
      text: success ? `ENHANCED +${item.upgradeLevel}!` : downgraded ? `FAILED - dropped to +${item.upgradeLevel}` : 'ENHANCE FAILED',
      color: success ? '#facc15' : '#ef4444', size: 20
    });
    if (success && item.upgradeLevel >= 10) {
      this.gs.broadcastSystemMessage(`[${player.name}] enhanced [${item.name}] to +${item.upgradeLevel}!`);
    }
  }
}
