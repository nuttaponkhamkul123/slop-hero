// Monster behaviour each tick (respawn, status damage, aggro, wandering, chasing, returning) and how a monster blow lands on a hero.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import { calculateElementalMultiplier } from '../elements';
import * as SP from '../spCards';
import { SKILL_DAMAGE_SCALE } from '../config/constants';

export class MobAISystem {
  constructor(private readonly gs: GameServer) {}

  updateMobsList(mobsMap, zone, dt, instanceId = null) {
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') {
        if (zone === 'dungeon' || (mob.id && mob.id.startsWith('dungeon_'))) {
          // Dungeon mobs NEVER respawn during an active run! Must leave and re-enter.
          continue;
        }
        mob.respawnTimer -= dt;
        if (mob.respawnTimer <= 0) {
          mob.state = 'idle';
          mob.hp = mob.maxHp;
          mob.x = mob.spawnX;
          mob.y = mob.spawnY;
          mob.targetPlayerId = null;
        }
        continue;
      }

      // Still rising from its room's summon: no AI yet
      if (mob.spawnUntil) {
        if (Date.now() < mob.spawnUntil) continue;
        mob.spawnUntil = 0;
      }

      if (mob.attackCooldown > 0) mob.attackCooldown = Math.max(0, mob.attackCooldown - dt);

      // Mob Status Effects (Chill, Burn DoT, Poison DoT). A DoT kill is
      // credited to the last hero who hit the mob, if still in this zone.
      const dotOwner = () => {
        const p = mob.lastHitBy && this.gs.players.get(mob.lastHitBy);
        return p && p.zone === zone && !p.isDead && (!instanceId || p.dungeonInstanceId === instanceId) ? p : null;
      };
      if (mob.chillTimer > 0) {
        mob.chillTimer = Math.max(0, mob.chillTimer - dt);
      }
      if (mob.burnTimer > 0) {
        mob.burnTimer = Math.max(0, mob.burnTimer - dt);
        mob.burnTickTimer = (mob.burnTickTimer || 0) - dt;
        if (mob.burnTickTimer <= 0) {
          mob.burnTickTimer = 0.6;
          const dotDmg = Math.max(1, Math.round(mob.burnDmg || 8));
          mob.hp -= dotDmg;
          this.gs.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.7, text: `🔥 -${dotDmg}`, color: '#f97316', size: 14 }, instanceId);
          if (mob.hp <= 0) {
            this.gs.handleMobDeath(mob, dotOwner());
            continue;
          }
        }
        if (mob.burnTimer <= 0) mob.burnDmg = 0; // next ignite starts fresh
      }
      if (mob.poisonTimer > 0) {
        mob.poisonTimer = Math.max(0, mob.poisonTimer - dt);
        mob.poisonTickTimer = (mob.poisonTickTimer || 0) - dt;
        if (mob.poisonTickTimer <= 0) {
          mob.poisonTickTimer = 0.8;
          const dotDmg = Math.max(1, Math.round(mob.poisonDmg || 6));
          mob.hp -= dotDmg;
          const stackTag = mob.poisonStacks > 1 ? ` x${mob.poisonStacks}` : '';
          this.gs.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.7, text: `☠️ -${dotDmg}${stackTag}`, color: '#22c55e', size: 14 }, instanceId);
          if (mob.hp <= 0) {
            this.gs.handleMobDeath(mob, dotOwner());
            continue;
          }
        }
        if (mob.poisonTimer <= 0) { mob.poisonDmg = 0; mob.poisonStacks = 0; }
      }
      if (mob.shadowMarkTimer > 0) mob.shadowMarkTimer = Math.max(0, mob.shadowMarkTimer - dt);
      if (mob.staticCharge > 0) mob.staticCharge = Math.max(0, mob.staticCharge - dt);
      if (mob.conductTimer > 0) { mob.conductTimer -= dt; if (mob.conductTimer <= 0) mob.conduct = 0; }
      if (mob.scorchTimer > 0) { mob.scorchTimer -= dt; if (mob.scorchTimer <= 0) mob.scorchStacks = 0; }
      if (mob.frostTimer > 0) { mob.frostTimer -= dt; if (mob.frostTimer <= 0) mob.frostStacks = 0; }
      // Bosses run their telegraphed moveset; while one winds up, charges or roars it skips
      // the plain chase / melee below (bossMechanics.ts)
      if (mob.mechanics && this.gs.bossMech.update(mob, zone, dt, instanceId)) continue;

      // Frozen solid (Cryo) or stopped in time (Chrono): no moving, no attacking
      if (mob.frozenTimer > 0) {
        mob.frozenTimer = Math.max(0, mob.frozenTimer - dt);
        mob.attackCooldown = Math.max(mob.attackCooldown, 0.3);
        continue;
      }

      // Eternal Rift monsters march on the Holy Fountain instead of idling
      if (mob.riftMob) {
        const riftInst = instanceId && this.gs.dungeonInstances.get(instanceId);
        if (riftInst && riftInst.rift) this.gs.updateRiftMob(mob, riftInst, dt);
        continue;
      }

      if (mob.state === 'idle') {
        let closestPlayer = null;
        // a boss notices anyone who steps into its arena
        let closestDist = mob.mechanics === 'boss' ? 16.0 : 5.0;

        for (const p of this.gs.players.values()) {
          if (p.isDead || p.zone !== zone || (instanceId && p.dungeonInstanceId !== instanceId)) continue;
          const d = Math.hypot(p.x - mob.x, p.y - mob.y);
          if (d < closestDist) {
            closestDist = d;
            closestPlayer = p;
          }
        }

        if (closestPlayer) {
          mob.state = 'chase';
          mob.targetPlayerId = closestPlayer.id;
          // Wind-up so freshly aggroed mobs don't all land a hit the instant they arrive
          mob.attackCooldown = Math.max(mob.attackCooldown, 0.6 + Math.random() * 0.5);
        } else {
          if (Date.now() > mob.nextWanderTime) {
            mob.nextWanderTime = Date.now() + 2000 + Math.random() * 4000;
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 2.5;
            mob.wanderTarget = {
              x: mob.spawnX + Math.cos(angle) * dist,
              y: mob.spawnY + Math.sin(angle) * dist
            };
          }

          if (mob.wanderTarget) {
            const wd = Math.hypot(mob.wanderTarget.x - mob.x, mob.wanderTarget.y - mob.y);
            if (wd > 0.2) {
              const step = Math.min(wd, (mob.speed * 0.4) * dt);
              const wx = ((mob.wanderTarget.x - mob.x) / wd) * step;
              const wy = ((mob.wanderTarget.y - mob.y) / wd) * step;
              if (!this.gs.isColliding(mob.x + wx, mob.y + wy, zone)) {
                mob.x += wx;
                mob.y += wy;
                mob.facing = this.gs.calculateFacing(0, 0, wx, wy);
              } else {
                mob.wanderTarget = null;
              }
            } else {
              mob.wanderTarget = null;
            }
          }
        }
      } else if (mob.state === 'chase') {
        const targetPlayer = this.gs.players.get(mob.targetPlayerId);
        if (!targetPlayer || targetPlayer.isDead || targetPlayer.zone !== zone) {
          mob.state = 'return';
          mob.targetPlayerId = null;
          continue;
        }

        const distToPlayer = Math.hypot(targetPlayer.x - mob.x, targetPlayer.y - mob.y);
        const distToSpawn = Math.hypot(mob.spawnX - mob.x, mob.spawnY - mob.y);

        // bosses fight across their whole arena; everything else gives up a short way from home
        if (distToPlayer > (mob.mechanics === 'boss' ? 30 : 10.0) || distToSpawn > (mob.mechanics === 'boss' ? 40 : 14.0)) {
          mob.state = 'return';
          mob.targetPlayerId = null;
          continue;
        }

        if (distToPlayer <= 1.2) {
          mob.facing = this.gs.calculateFacing(mob.x, mob.y, targetPlayer.x, targetPlayer.y);
          // Brief global hit lockout per player so a whole pack can't machine-gun one target
          const now = Date.now();
          if (mob.attackCooldown <= 0 && now < (targetPlayer.nextMobHitAt || 0)) {
            mob.attackCooldown = 0.15 + Math.random() * 0.2;
          } else if (mob.attackCooldown <= 0) {
            mob.attackCooldown = 1.2 + Math.random() * 0.5; // jitter desyncs packs
            targetPlayer.nextMobHitAt = now + (mob.isBoss ? 150 : 350);

            this.gs.mobStrikePlayer(mob, targetPlayer, zone);
          }
        } else {
          let effectiveSpeed = mob.hasCommanderBuff ? mob.speed * 1.25 : mob.speed;
          if (mob.chillTimer > 0) effectiveSpeed *= 0.5;
          const step = Math.min(distToPlayer, effectiveSpeed * dt);
          const mx = ((targetPlayer.x - mob.x) / distToPlayer) * step;
          const my = ((targetPlayer.y - mob.y) / distToPlayer) * step;

          // slide along pillars and pools instead of sticking to them
          if (!this.gs.isColliding(mob.x + mx, mob.y + my, zone)) {
            mob.x += mx;
            mob.y += my;
          } else if (Math.abs(mx) > 1e-4 && !this.gs.isColliding(mob.x + Math.sign(mx) * step, mob.y, zone)) {
            mob.x += Math.sign(mx) * step;
          } else if (Math.abs(my) > 1e-4 && !this.gs.isColliding(mob.x, mob.y + Math.sign(my) * step, zone)) {
            mob.y += Math.sign(my) * step;
          }
          mob.facing = this.gs.calculateFacing(mob.x, mob.y, targetPlayer.x, targetPlayer.y);
        }
      } else if (mob.state === 'return') {
        const distToSpawn = Math.hypot(mob.spawnX - mob.x, mob.spawnY - mob.y);
        if (distToSpawn > 0.2) {
          mob.facing = this.gs.calculateFacing(mob.x, mob.y, mob.spawnX, mob.spawnY);
          const step = Math.min(distToSpawn, (mob.speed * 1.2) * dt);
          mob.x += ((mob.spawnX - mob.x) / distToSpawn) * step;
          mob.y += ((mob.spawnY - mob.y) / distToSpawn) * step;
          mob.hp = Math.min(mob.maxHp, mob.hp + (mob.maxHp * 0.2 * dt));
        } else {
          mob.state = 'idle';
          mob.hp = mob.maxHp;
          if (mob.mechanics) this.gs.bossMech.reset(mob);
        }
      }
    }
  }

  // One monster blow landing on a hero: immunities, dodges, shields, thorns,
  // elemental resistance and on-hit affixes. The caller handles reach and cooldown.
  // opts.mechanic: a telegraphed boss attack (bossMechanics.ts). It can't be dodged, smoked or
  // parried (you dodge it by moving), armor counts half, it reflects no thorns, and opts.mult
  // scales the boss's damage.
  mobStrikePlayer(mob, targetPlayer, zone, opts: any = {}) {
    const now = Date.now();
    const mech = !!opts.mechanic;
    if (targetPlayer.godMode) {
      this.gs.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '🛡️ IMMUNE (God Mode)', color: '#facc15' });
      return;
    }
    // Dragoon in the air: nothing on the ground can reach him
    if (mech && targetPlayer.airborneUntil > now) return;
    if (mech) return this.gs.landMobDamage(mob, targetPlayer, zone, Math.round((mob.dmg || 0) * (opts.mult || 1)), 0.25, true);

    if (targetPlayer.smokeScreenTimer > 0) {
      this.gs.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '💨 MISS! (Stealth)', color: '#94a3b8' });
      return;
    }
    // Dragoon in the air: nothing on the ground can reach him
    if (targetPlayer.airborneUntil > now) return;
    // Sentinel Riposte Stance: the blow is blocked and returned
    if (targetPlayer.parry && targetPlayer.parry.until > now) {
      const back = Math.max(1, Math.round(targetPlayer.dmg * targetPlayer.parry.riposte * SKILL_DAMAGE_SCALE));
      this.gs.applyDamageToMob(targetPlayer, mob, back, false);
      mob.attackCooldown = Math.max(mob.attackCooldown, 1.6);
      this.gs.emitZone(zone, 'skill_fx', { type: 'sp_skill', shape: 'riposte', startX: targetPlayer.x, startY: targetPlayer.y, x: mob.x, y: mob.y, element: 'holy', color: '#fde68a', cardId: 'sp_sentinel', skillId: 'sp_sentinel_riposte' });
      this.gs.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '🛡️ RIPOSTE!', color: '#fde68a', size: 16 });
      return;
    }
    if (Math.random() < this.gs.smokeMissChance(targetPlayer)) {
      this.gs.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '💨 MISS! (Smoke)', color: '#94a3b8' });
      return;
    }

    // Dodge chance from talents
    if (targetPlayer.dodgeChance && Math.random() < targetPlayer.dodgeChance) {
      this.gs.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '💨 DODGE!', color: '#38bdf8' });
      return;
    }

    const effectiveDmg = mob.hasCommanderBuff ? Math.round(mob.dmg * 1.35) : mob.dmg;
    this.gs.landMobDamage(mob, targetPlayer, zone, effectiveDmg, 0.5, false);
  }

  // The shared tail of a monster hit: armor (armorShare of Defense is subtracted), element,
  // crushing blows, thorns (not for mechanics), shields, death
  landMobDamage(mob, targetPlayer, zone, effectiveDmg, armorShare, mech) {
    let damageDealt = Math.max(1, Math.round(effectiveDmg - (targetPlayer.def * armorShare)));

    // Monster element vs the player's elemental resistance from gear
    const elemResistMult = calculateElementalMultiplier(mob.element || 'neutral', 'neutral', targetPlayer.elementResist || {});
    damageDealt = Math.max(1, Math.round(damageDealt * elemResistMult));

    // Crushing Blow from high level monsters against underleveled players!
    let isCrushing = false;
    if (!mob.noLevelGap && mob.level && targetPlayer.level && (mob.level - targetPlayer.level >= 5)) {
      const gap = mob.level - targetPlayer.level;
      const crushingMult = 1.0 + Math.min(4.0, (gap - 3) * 0.08);
      damageDealt = Math.round(damageDealt * crushingMult);
      isCrushing = true;
    }

    // Thorns reflection (Iron Fortress + passive Unyielding Spikes/Colossus Avatar)
    const runeThorns = targetPlayer.armorRunes && targetPlayer.armorRunes.thorns ? Math.round(targetPlayer.maxHp * 0.03 * targetPlayer.armorRunes.thorns) : 0;
    const thornsDmg = mech ? 0 : (targetPlayer.ironFortressTimer > 0 ? 25 : 0) + (targetPlayer.thorns || 0) + runeThorns;
    if (thornsDmg > 0) {
      this.gs.applyDamageToMob(targetPlayer, mob, thornsDmg, false);
      this.gs.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.7, text: `🌵 ${thornsDmg} Thorns!`, color: '#e2e8f0' });
    }

    // Iron Fortress: -60% damage
    if (targetPlayer.ironFortressTimer > 0) {
      damageDealt = Math.max(1, Math.round(damageDealt * 0.40));
    }

    // SP card passive (damage reduction, reflect, shields) and signature charge
    if (targetPlayer.spTransformed) damageDealt = this.gs.passiveOnHurt(targetPlayer, mob, damageDealt, zone);

    // Shield Barrier absorption, then the mage's Energy Shield
    damageDealt = this.gs.absorbIncomingDamage(targetPlayer, damageDealt, zone);

    targetPlayer.hp -= damageDealt;
    if (damageDealt > 0) this.gs.checkSecondWind(targetPlayer, zone);
    if (targetPlayer.undyingTimer > 0 && targetPlayer.hp < 1) {
      targetPlayer.hp = 1;
      this.gs.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 1.0, text: '💀 UNDYING RAGE!', color: '#c084fc', size: 18 });
    }
    if (targetPlayer.hp <= 0) this.gs.phoenixRebirth(targetPlayer);

    // Apply Mob Buffs/Affixes to targetPlayer
    if (mob.buffs && mob.buffs.length > 0) {
      if (mob.buffs.includes('venomous')) {
        this.gs.applyStatusEffect(targetPlayer, 'poison', 4.5, 9);
      }
      if (mob.buffs.includes('frostbite')) {
        this.gs.applyStatusEffect(targetPlayer, 'chill', 2.5, 0.45);
      }
      if (mob.buffs.includes('ignited')) {
        this.gs.applyStatusEffect(targetPlayer, 'burn', 3.0, 14);
      }
    }

    if (isCrushing) {
      this.gs.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: `-${damageDealt}`, color: '#dc2626', size: 18 });
    } else if (elemResistMult < 1) {
      this.gs.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: `-${damageDealt}`, color: '#fca5a5' });
    } else {
      this.gs.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: `-${damageDealt}`, color: '#ef4444' });
    }
    if (!mech) this.gs.emitZone(zone, 'entity_attack_fx', { attackerId: mob.id, attackerType: 'mob', targetId: targetPlayer.id, x: mob.x, y: mob.y });

    if (targetPlayer.hp <= 0) {
      targetPlayer.hp = 0;
      targetPlayer.isDead = true;
      if (targetPlayer.dungeonRun) targetPlayer.dungeonRun.deaths = (targetPlayer.dungeonRun.deaths || 0) + 1;
      targetPlayer.respawnTimer = 5.0;
      this.gs.emitZone(zone, 'player_died', { playerId: targetPlayer.id, killerName: mob.name });
      this.gs.broadcastSystemMessage(`☠️ [${targetPlayer.name}] was slain by [${mob.name}]!`);
      // a boss turns on the next hero still fighting it instead of walking home to heal
      const next = mob.isBoss ? (Array.from(this.gs.players.values()) as any[]).find(p => !p.isDead && p.zone === zone
        && p.dungeonInstanceId === targetPlayer.dungeonInstanceId && Math.hypot(p.x - mob.x, p.y - mob.y) < 30) : null;
      if (next) { mob.state = 'chase'; mob.targetPlayerId = next.id; }
      else mob.state = 'return';
    }
  }
}
