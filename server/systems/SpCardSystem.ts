// SP cards: equipping, transforming, skill loadouts and spellbook, enhancing, exchange, fragments, job EXP, boss card loot and the toggled auras.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import { lootGapMult } from '../progression';
import * as SP from '../spCards';
import { SP_TRANSFORM_COOLDOWN, SKILL_DAMAGE_SCALE, BLOOD_AURA_MIN_HP, DEFAULT_BAG_SLOTS } from '../config/constants';
import { SKILL_RUNES, DEFAULT_EQUIPPED_SKILLS } from '../data/skills';
import { ItemFactory } from '../entities/item';
import type { Player, DungeonInstance } from '../entities/types';

export class SpCardSystem {
  constructor(private readonly gs: GameServer) {}

  // ---------------------------------------------------------------- SP cards
  equipSpCard(player: Player, itemIndex: any) {
    const socket = this.gs.io.sockets.sockets.get(player.id);
    const say = (text: any, color = '#ef4444') => socket && socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text, color });
    const item = player.inventory.items[itemIndex];
    const card = item && (SP.CARD_BY_ID as any)[item.cardId];
    if (!card) return;
    if (card.cls !== player.characterClass) return say(`Only a ${card.cls} can wear this card!`);
    if ((player.jobLevel || 1) < card.jobReq) return say(`Requires Job Lv. ${card.jobReq}!`);
    if (player.spTransformed) this.gs.setTransformed(player, false);
    player.inventory.items.splice(itemIndex, 1);
    const old = player.equipment.sp;
    if (old) player.inventory.items.push(old);
    player.equipment.sp = ItemFactory.stack(item);
    this.gs.recalculatePlayerStats(player);
    say(`Equipped SP Card: ${card.name}. Press T to transform!`, '#c084fc');
    if (socket) socket.emit('player_updated', player);
  }

  handleSpTransform(socketId: any) {
    const player = this.gs.players.get(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead) return;
    const say = (text: any, color = '#ef4444') => socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text, color });
    const cardItem = player.equipment && player.equipment.sp;
    const card = cardItem && (SP.CARD_BY_ID as any)[cardItem.cardId];
    if (!card) return say('No SP card equipped!');
    if (player.spCooldown > 0) return say(`Transform ready in ${Math.ceil(player.spCooldown)}s`);
    if (!player.spTransformed && (player.jobLevel || 1) < card.jobReq) return say(`Requires Job Lv. ${card.jobReq}!`);
    this.gs.setTransformed(player, !player.spTransformed);
  }

  // The card's four equipped skills for this hero (their picks from its arsenal)
  spLoadout(player: Player, card: any) {
    if (!player.spLoadouts) player.spLoadouts = {};
    // a reworked kit (card.kit bumped) starts over from the card's new defaults
    const stored = player.spLoadouts[card.id];
    const saved = stored && (stored.kit || 0) === (card.kit || 0) ? stored : {};
    const out = {};
    for (const slot of ['slot1', 'slot2', 'slot3', 'dash']) {
      const id = saved[slot];
      // an extra still locked at this card level falls back to the slot's default
      const lvl = (player.equipment && player.equipment.sp && player.equipment.sp.upgradeLevel) || 0;
      const sk = id && card.arsenal.includes(id) && SP.skillUnlocked(card, id, lvl) && SP.SP_SKILLS[id];
      (out as any)[slot] = sk && sk.isDash === (slot === 'dash') ? id : card.skills[slot];
    }
    player.spLoadouts[card.id] = { ...out, kit: card.kit || 0 };
    return { ...out };
  }

  // Spellbook while transformed: swap skills from the card's arsenal
  customizeSpSkill(player: Player, data: any) {
    const socket = this.gs.io.sockets.sockets.get(player.id);
    const say = (text: any, color = '#ef4444') => socket && socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text, color });
    const card = player.equipment && player.equipment.sp && (SP.CARD_BY_ID as any)[player.equipment.sp.cardId];
    const slots = ['slot1', 'slot2', 'slot3', 'dash'];
    if (!card || !data || !slots.includes(data.slot)) return;
    const loadout = this.gs.spLoadout(player, card);
    let notice = null;

    if (data.skillId) {
      const sk = SP.SP_SKILLS[data.skillId];
      if (!sk || !card.arsenal.includes(data.skillId)) return;
      const need = card.unlocks && card.unlocks[data.skillId];
      if (!SP.skillUnlocked(card, data.skillId, player.equipment.sp.upgradeLevel || 0)) return say(`🔒 Unlocks at card +${need}`);
      if (sk.isDash !== (data.slot === 'dash')) return say(sk.isDash ? 'Movement skills go in the [Shift] slot' : 'Only movement skills fit the [Shift] slot');
      // already in another slot: trade places
      for (const slot of slots) if (slot !== data.slot && loadout[slot] === data.skillId) loadout[slot] = loadout[data.slot];
      loadout[data.slot] = data.skillId;
      player.spLoadouts[card.id] = { ...loadout, kit: card.kit || 0 };
      Object.assign(player.equippedSkills, loadout);
      notice = `Set [${sk.name}]`;
    }
    if (data.rune !== undefined && (SKILL_RUNES as any)[data.rune]) {
      player.equippedSkills.runes[data.slot] = data.rune;
      if (player.baseEquippedSkills && player.baseEquippedSkills.runes) player.baseEquippedSkills.runes[data.slot] = data.rune;
      notice = `Inscribed [${(SKILL_RUNES as any)[data.rune].name}]`;
    }
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('custom_skills_updated', { equippedSkills: player.equippedSkills });
      if (notice) say(notice, '#facc15');
    }
  }

  setTransformed(player: Player, on: any) {
    const socket = this.gs.io.sockets.sockets.get(player.id);
    const cardItem = player.equipment && player.equipment.sp;
    const card = cardItem && (SP.CARD_BY_ID as any)[cardItem.cardId];
    if (on && !card) return;
    if (on === !!player.spTransformed) return;
    if (on) {
      player.baseEquippedSkills = JSON.parse(JSON.stringify(player.equippedSkills || (DEFAULT_EQUIPPED_SKILLS as any)[player.characterClass]));
      player.equippedSkills = {
        ...this.gs.spLoadout(player, card),
        runes: player.baseEquippedSkills.runes || { slot1: 'none', slot2: 'none', slot3: 'none', dash: 'none' }
      };
      player.spTransformed = true;
    } else {
      if (player.baseEquippedSkills) player.equippedSkills = player.baseEquippedSkills;
      player.baseEquippedSkills = null;
      player.spTransformed = false;
    }
    player.spCooldown = SP_TRANSFORM_COOLDOWN;
    this.gs.recalculatePlayerStats(player);
    this.gs.emitZone(player.zone, 'sp_transform', {
      playerId: player.id, on: player.spTransformed, cardId: cardItem ? cardItem.cardId : null,
      level: cardItem ? (cardItem.upgradeLevel || 0) : 0, x: player.x, y: player.y
    });
    if (socket) socket.emit('player_updated', player);
  }

  fragmentCount(player: Player) {
    const stack = player.inventory.items.find((i: any) => i.id === 'spirit_fragment');
    return stack ? (stack.count || 1) : 0;
  }

  spendFragments(player: Player, n: any) {
    const idx = player.inventory.items.findIndex((i: any) => i.id === 'spirit_fragment');
    if (idx < 0) return;
    const stack = player.inventory.items[idx];
    stack.count = (stack.count || 1) - n;
    if (stack.count <= 0) player.inventory.items.splice(idx, 1);
  }

  // Enchanter: +1 an SP card (equipped or in the bag) for gold and fragments
  handleSpCardEnhance(socketId: any, data: any) {
    const player = this.gs.players.get(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead || player.zone !== 'town' || !data) return;
    const item = data.target === 'equipped' ? player.equipment.sp : player.inventory.items[data.itemIndex];
    if (!item || item.type !== 'sp_card') return;
    const fail = (message: any) => socket.emit('sp_enhance_result', { ok: false, message });
    const lvl = item.upgradeLevel || 0;
    if (lvl >= SP.SP_MAX_LEVEL) return fail(`Card is already +${SP.SP_MAX_LEVEL}!`);
    const cost = SP.cardEnhanceCost(item.cardId, lvl);
    if (player.gold < cost.gold) return fail(`Need ${cost.gold.toLocaleString()} Gold!`);
    if (this.gs.fragmentCount(player) < cost.fragments) return fail(`Need ${cost.fragments} Spirit Fragments!`);

    player.gold -= cost.gold;
    this.gs.spendFragments(player, cost.fragments);
    const success = Math.random() < (SP.SP_ENHANCE_CHANCE[lvl] || 0);
    let downgraded = false;
    if (success) item.upgradeLevel = lvl + 1;
    else if (lvl >= SP.SP_SAFE_LEVEL) { item.upgradeLevel = lvl - 1; downgraded = true; }
    const card = (SP.CARD_BY_ID as any)[item.cardId];
    item.name = `SP Card: ${card.name}${item.upgradeLevel ? ' +' + item.upgradeLevel : ''}`;
    if (data.target === 'equipped') this.gs.recalculatePlayerStats(player);
    this.gs.savePlayerAccount(socketId);
    socket.emit('player_updated', player);
    socket.emit('sp_enhance_result', { ok: true, success, downgraded, level: item.upgradeLevel || 0, cost, item });
    if (player.spTransformed && data.target === 'equipped') {
      this.gs.emitZone(player.zone, 'sp_transform', { playerId: player.id, on: true, cardId: item.cardId, level: item.upgradeLevel || 0, x: player.x, y: player.y, refresh: true });
    }
    if (success && item.upgradeLevel >= 70) this.gs.broadcastSystemMessage(`[${player.name}] enhanced [${card.name}] to +${item.upgradeLevel}!`);
  }

  // Enchanter: trade fragments + gold for a card of your class (any tier)
  handleSpCardExchange(socketId: any, data: any) {
    const player = this.gs.players.get(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead || player.zone !== 'town' || !data) return;
    const card = (SP.CARD_BY_ID as any)[data.cardId];
    const fail = (message: any) => socket.emit('sp_exchange_result', { ok: false, message });
    if (!card || card.cls !== player.characterClass) return fail('That card is not for your class.');
    const price = (SP.SP_TIERS as any)[card.tier].exchange;
    if (!price) return fail('This card can only be found on the deepest bosses.');
    if (this.gs.fragmentCount(player) < price.fragments) return fail(`Need ${price.fragments} Spirit Fragments!`);
    if (player.gold < price.gold) return fail(`Need ${price.gold.toLocaleString()} Gold!`);
    const maxCap = player.inventory.maxSlots || DEFAULT_BAG_SLOTS;
    if (player.inventory.items.length >= maxCap) return fail('Inventory is full!');
    player.gold -= price.gold;
    this.gs.spendFragments(player, price.fragments);
    player.inventory.items.push(ItemFactory.card(card.id));
    this.gs.savePlayerAccount(socketId);
    socket.emit('player_updated', player);
    socket.emit('sp_exchange_result', { ok: true, cardId: card.id });
    this.gs.broadcastSystemMessage(`[${player.name}] obtained the SP Card [${card.name}] from Valka!`);
  }

  awardJobExp(player: Player, amount: any) {
    if (!amount || (player.jobLevel || 1) >= SP.JOB_MAX_LEVEL) return;
    player.jobLevel = player.jobLevel || 1;
    player.jobExp = (player.jobExp || 0) + amount;
    player.jobExpNext = SP.jobExpToNext(player.jobLevel);
    let leveled = false;
    while (player.jobLevel < SP.JOB_MAX_LEVEL && player.jobExp >= player.jobExpNext) {
      player.jobExp -= player.jobExpNext;
      player.jobLevel++;
      player.jobExpNext = SP.jobExpToNext(player.jobLevel);
      leveled = true;
    }
    if (player.jobLevel >= SP.JOB_MAX_LEVEL) player.jobExp = 0;
    if (leveled) {
      this.gs.recalculatePlayerStats(player);
      this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 1.7, text: `JOB LEVEL ${player.jobLevel}!`, color: '#c084fc', size: 20 });
      this.gs.emitZone(player.zone, 'job_level_up', { playerId: player.id, jobLevel: player.jobLevel, x: player.x, y: player.y });
      this.gs.sendDirectMessage(player.id, `[${player.name}] reached Job Level ${player.jobLevel}!`);
    }
  }

  // Boss loot for every hero in the instance: a rare card roll and fragments
  rollBossSpLoot(inst: DungeonInstance, bossLevel: any) {
    for (const p of this.gs.players.values()) {
      if (p.zone !== 'dungeon' || p.dungeonInstanceId !== inst.id) continue;
      // heroes far above the boss's level get no card or fragments
      if (Math.random() >= lootGapMult(p.level, bossLevel)) continue;
      const cardId = SP.rollCardDrop(p.characterClass, inst.floor, inst.difficulty);
      if (cardId) {
        this.gs.giveLootToPlayer(p, { type: 'item', itemId: 'sp_card', customItemData: ItemFactory.cardLootData(cardId), amount: 1 });
        this.gs.broadcastSystemMessage(`[${p.name}] found the SP Card [${(SP.CARD_BY_ID as any)[cardId].name}] on B${inst.floor}!`);
      }
      if (Math.random() < SP.FRAGMENT_DROP.boss) {
        this.gs.giveLootToPlayer(p, { type: 'item', itemId: 'spirit_fragment', amount: SP.bossFragments(inst.floor) });
      }
      const socket = this.gs.io.sockets.sockets.get(p.id);
      if (socket) socket.emit('player_updated', p);
    }
  }

  endSpToggle(player: Player, skillId: any, quiet = false) {
    const toggle = player.spToggles && player.spToggles[skillId];
    if (!toggle) return;
    delete player.spToggles[skillId];
    if (!quiet) this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.8, text: `${toggle.skill.name.toUpperCase()} OFF`, color: '#94a3b8' });
  }

  // Every frame: toggled SP skills pay their upkeep (HP `drain` - natural HP
  // regen is off meanwhile - or MP `mpDrain`) and strike everything within r
  // every `every` seconds. Out of blood or mana, the toggles paying it end.
  tickSpToggles(player: Player, dt: any) {
    const loadout = Object.values(player.equippedSkills || {});
    for (const id of Object.keys(player.spToggles)) {
      if (!player.spTransformed || !loadout.includes(id)) this.gs.endSpToggle(player, id);
    }
    const all: any[] = Object.values(player.spToggles);
    if (!all.length) return false;
    const sum = (k: any) => all.reduce((s, a) => s + (a.skill[k] || 0), 0);
    const hpDrain = sum('drain'), mpDrain = sum('mpDrain');
    if (!player.godMode) {
      player.hp = Math.max(1, player.hp - player.maxHp * hpDrain * dt);
      player.mp = Math.max(0, player.mp - player.maxMp * mpDrain * dt);
    }
    const say = (text: any) => this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.8, text, color: '#ef4444', size: 16 });
    if (hpDrain && player.hp <= player.maxHp * BLOOD_AURA_MIN_HP) {
      for (const a of all) if (a.skill.drain) this.gs.endSpToggle(player, a.skill.id, true);
      say('🩸 OUT OF BLOOD - aura fades');
    }
    if (mpDrain && player.mp <= 0) {
      for (const a of all) if (a.skill.mpDrain) this.gs.endSpToggle(player, a.skill.id, true);
      say('💧 OUT OF MANA - blades stop');
    }
    const mobsMap = this.gs.getMobsMap(player.zone, player);
    const rage = this.gs.bloodRage(player);
    const critChance = 0.15 + (player.critChanceBonus || 0);
    for (const a of (Object.values(player.spToggles) as any[])) {
      const sk = a.skill;
      if (!sk.r || !sk.dmgMult) continue;
      a.clock += dt;
      if (a.clock + 1e-6 < sk.every) continue;
      a.clock -= sk.every;
      const dmg = Math.max(1, Math.round(player.dmg * sk.dmgMult * rage * SKILL_DAMAGE_SCALE));
      let struck = 0, dealt = 0;
      let targets = [...mobsMap.values()].filter(m => m.state !== 'dead' && Math.hypot(m.x - player.x, m.y - player.y) <= sk.r);
      // skyStrike: a bolt from the sky on each of the nearest few instead of a ring
      if (sk.skyStrike) {
        targets = targets.sort((p1, p2) => Math.hypot(p1.x - player.x, p1.y - player.y) - Math.hypot(p2.x - player.x, p2.y - player.y)).slice(0, sk.skyStrike);
      }
      const bolts = sk.skyStrike ? targets.map(m => ({ x: m.x, y: m.y })) : null;
      for (const mob of targets) {
        if (sk.burn) { mob.burnTimer = Math.max(mob.burnTimer || 0, sk.burn); mob.burnDmg = Math.max(mob.burnDmg || 0, Math.round(player.dmg * 0.2)); }
        if (sk.chill) mob.chillTimer = Math.max(mob.chillTimer || 0, sk.chill);
        const before = mob.hp;
        this.gs.applyDamageToMob(player, mob, dmg, Math.random() < critChance);
        dealt += Math.max(0, before - Math.max(0, mob.hp));
        struck++;
      }
      if (sk.spin) this.gs.cardPassiveLeech(player, dealt);
      if (struck) {
        this.gs.emitZone(player.zone, 'skill_fx', {
          type: 'sp_skill', shape: 'aura', pulse: true, spin: !!sk.spin, bolts, x: player.x, y: player.y, radius: sk.r,
          element: sk.element, color: sk.color, cardId: sk.cardId, skillId: sk.id
        });
      }
    }
    return hpDrain > 0;
  }
}
