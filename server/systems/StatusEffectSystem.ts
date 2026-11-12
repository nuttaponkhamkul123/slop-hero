// Status effects: afflictions on heroes, smoke clouds, talent procs on hit.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
const { TALENT_PROCS } = require('../talents');

export class StatusEffectSystem {
  constructor(private readonly gs: GameServer) {}

  // Chance a monster's attack on this hero misses because they stand in a Smoke Bomb cloud
  smokeMissChance(player) {
    const now = Date.now();
    if (this.gs.smokeClouds.length) this.gs.smokeClouds = this.gs.smokeClouds.filter(c => c.until > now);
    const instanceId = player.dungeonInstanceId || null;
    let miss = 0;
    for (const c of this.gs.smokeClouds) {
      if (c.zone === player.zone && c.instanceId === instanceId && Math.hypot(player.x - c.x, player.y - c.y) <= c.r) miss = Math.max(miss, c.miss);
    }
    return miss;
  }

  applyStatusEffect(player, type, duration, value) {
    if (!player || player.isDead) return;
    if (!player.statusEffects) player.statusEffects = [];

    const existing = player.statusEffects.find(e => e.type === type);
    if (existing) {
      existing.duration = Math.max(existing.duration, duration);
      existing.value = Math.max(existing.value, value);
    } else {
      player.statusEffects.push({
        type,
        duration,
        value,
        tickTimer: 0.8
      });

      const icon = type === 'poison' ? '☠️' : type === 'burn' ? '🔥' : '❄️';
      const color = type === 'poison' ? '#22c55e' : type === 'burn' ? '#f97316' : '#38bdf8';
      this.gs.emitZone(player.zone, 'floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: `${icon} ${type.toUpperCase()}!`,
        color,
        size: 15
      });
    }
  }

  // Talent branch mechanics (talents.js BRANCH_SIGNATURES), run on every hit
  // that lands and leaves the enemy alive
  applyTalentProcs(player, mob, baseDamage, damage) {
    const tp = player.talentProcs;
    if (!tp) return;
    if (tp.manaLeech) {
      player.mp = Math.min(player.maxMp, player.mp + Math.max(1, Math.round(damage * tp.manaLeech)));
    }
    if (tp.burnPower) {
      mob.burnTimer = Math.max(mob.burnTimer || 0, TALENT_PROCS.burnSeconds);
      mob.burnDmg = Math.max(mob.burnDmg || 0, Math.round(player.dmg * tp.burnPower));
    }
    if (tp.poisonPower) {
      const stacks = Math.min(TALENT_PROCS.poisonMaxStacks, (mob.poisonTimer > 0 ? mob.poisonStacks || 0 : 0) + 1);
      mob.poisonStacks = stacks;
      mob.poisonTimer = Math.max(mob.poisonTimer || 0, TALENT_PROCS.poisonSeconds);
      mob.poisonDmg = Math.max(mob.poisonDmg || 0, Math.round(player.dmg * tp.poisonPower * stacks));
    }
    if (tp.chillChance && Math.random() < tp.chillChance) {
      mob.chillTimer = Math.max(mob.chillTimer || 0, TALENT_PROCS.chillSeconds);
    }
    if (tp.echoChance && Math.random() < tp.echoChance) {
      this.gs.applyDamageToMob(player, mob, Math.max(1, Math.round(baseDamage * TALENT_PROCS.echoShare)), false, true);
    }
  }
}
