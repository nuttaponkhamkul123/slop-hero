// Potions: the HP / MP quick slots, drinking, the shared cooldown and the potion stacks.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import { ITEMS } from '../items';
import { POTIONS, POTION_COOLDOWN_MS } from '../data/potions';

export class PotionSystem {
  constructor(private readonly gs: GameServer) {}

  getPotionSlots(player) {
    if (!player.inventory.potionSlots) {
      player.inventory.potionSlots = { health: 'health_potion', mana: 'mana_potion' };
    }
    return player.inventory.potionSlots;
  }

  getPotionCount(player, itemId) {
    if (itemId === 'health_potion') return player.inventory.healthPotions || 0;
    if (itemId === 'mana_potion') return player.inventory.manaPotions || 0;
    const stack = player.inventory.items.find(i => i.id === itemId);
    return stack ? (stack.count || 1) : 0;
  }

  consumePotion(player, itemId) {
    if (itemId === 'health_potion') { player.inventory.healthPotions--; return; }
    if (itemId === 'mana_potion') { player.inventory.manaPotions--; return; }
    const idx = player.inventory.items.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    const stack = player.inventory.items[idx];
    if ((stack.count || 1) > 1) stack.count--;
    else player.inventory.items.splice(idx, 1);
  }

  // potionType: 'health' | 'mana' drinks the potion assigned to that quick slot;
  // { itemId } drinks that specific potion (clicked in the bag).
  handleUsePotion(socketId, potionType) {
    const player = this.gs.players.get(socketId);
    if (!player || player.isDead) return;

    const slots = this.gs.getPotionSlots(player);
    let itemId = null;
    if (potionType === 'health' || potionType === 'mana') itemId = slots[potionType];
    else if (potionType && typeof potionType.itemId === 'string') itemId = potionType.itemId;
    const potion = POTIONS[itemId];
    if (!potion) return;

    const socket = this.gs.io.sockets.sockets.get(socketId);
    const now = Date.now();
    if (!player.potionCdUntil) player.potionCdUntil = { health: 0, mana: 0 };
    const cdLeft = (player.potionCdUntil[potion.kind] || 0) - now;
    if (cdLeft > 0) {
      if (socket) socket.emit('potion_cooldown', { kind: potion.kind, remainingMs: cdLeft, totalMs: POTION_COOLDOWN_MS[potion.kind] });
      return;
    }
    if (this.gs.getPotionCount(player, itemId) <= 0) {
      if (socket) socket.emit('floating_text', { x: player.x, y: player.y - 0.6, text: `⚠️ Out of ${ITEMS[itemId].name}!`, color: '#ef4444' });
      return;
    }

    if (potion.kind === 'health') {
      if (player.hp >= player.maxHp) return;
      this.gs.consumePotion(player, itemId);
      const healAmount = Math.round(player.maxHp * potion.pct);
      player.hp = Math.min(player.maxHp, player.hp + healAmount);

      this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.5, text: `+${healAmount} HP`, color: '#4ade80' });
      this.gs.emitZone(player.zone, 'heal_fx', { targetId: player.id, type: 'health' });
    } else {
      if (player.mp >= player.maxMp) return;
      this.gs.consumePotion(player, itemId);
      const manaAmount = Math.round(player.maxMp * potion.pct);
      player.mp = Math.min(player.maxMp, player.mp + manaAmount);

      this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.5, text: `+${manaAmount} MP`, color: '#38bdf8' });
      this.gs.emitZone(player.zone, 'heal_fx', { targetId: player.id, type: 'mana' });
    }
    // Both sizes of a kind share one cooldown
    const cdMs = POTION_COOLDOWN_MS[potion.kind];
    player.potionCdUntil[potion.kind] = now + cdMs;
    if (socket) socket.emit('potion_cooldown', { kind: potion.kind, remainingMs: cdMs, totalMs: cdMs });
    if (socket) socket.emit('player_updated', player);
  }

  // Choose which potion the HP / MP quick slot drinks
  handleSetPotionSlot(socketId, data) {
    const player = this.gs.players.get(socketId);
    if (!player || !data) return;
    const potion = POTIONS[data.itemId];
    if (!potion || potion.kind !== data.kind) return;
    this.gs.getPotionSlots(player)[data.kind] = data.itemId;
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (socket) socket.emit('player_updated', player);
  }
}
