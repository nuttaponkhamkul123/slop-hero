// Hero combat: basic attacks and cleave, projectiles, damage to monsters, monster death and drops, and the armor-set combat procs.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import { isRangedClass } from '../data/heroClasses';
import { calculateElementalMultiplier } from '../elements';
import { ITEMS, rollSkyblockReforge, applySkyblockReforge, pickGearForLevel, RUNE_DROP_CHANCE, SOCKET_EXPANDER_DROP_CHANCE } from '../items';
import { levelGapMult, lootGapMult, MOB_DEF_K } from '../progression';
import * as SP from '../spCards';
import * as CRAFT from '../crafting';
import * as DMODS from '../dungeonMods';
import * as ATTR from '../itemAttributes';
import { SKILL_DAMAGE_SCALE, SWEEP_EXTRA_REACH, ATTACK_GRACE_S, SWEEP_ARC_DEG, FREEZE_SECONDS, BOSS_FREEZE_SECONDS, ULT_GAIN_HIT, PARTY_EXP_BONUS, ARMOR_RUNE_DROP, AIM_FACE_LOCK_SEC, MAGE_SPLASH_SHARE, MAGE_SPLASH_RADIUS, MOB_GEAR_DROP_CHANCE, BOSS_GEAR_DROP_CHANCE, BOSS_BONUS_GEAR_DROP_CHANCE, BOSS_REVIVAL_STONE_CHANCE } from '../config/constants';
import { ItemFactory } from '../entities/item';
import { createProjectile } from '../entities/world';
import type { Mob, Player } from '../entities/types';

export class CombatSystem {
  constructor(private readonly gs: GameServer) {}

  handlePlayerAttack(socketId: any, targetInfo: any) {
    const player = this.gs.players.get(socketId);
    if (!player || player.isDead || player.attackCooldown > ATTACK_GRACE_S) return;

    const atkSpeed = Math.max(0.4, player.attackSpeed || 1.0);
    player.attackCooldown = Math.max(0, player.attackCooldown || 0) + Math.max(0.12, 0.55 / atkSpeed);
    player.isAttacking = true;

    const mobsMap = this.gs.getMobsMap(player.zone);

    let targetMob = null;
    if (targetInfo && targetInfo.targetType === 'mob') {
      const mob = mobsMap.get(targetInfo.targetId);
      if (mob && mob.state !== 'dead') {
        targetMob = mob;
      }
    }

    // A swing keeps the hero turned toward its target for a moment, even
    // with "face the cursor" on
    player.faceLockTimer = AIM_FACE_LOCK_SEC;
    if (targetMob) {
      player.facing = this.gs.calculateFacing(player.x, player.y, targetMob.x, targetMob.y);
      // In reach of a click-moved hero: plant the feet and swing instead of walking on into the monster
      const reach = (player.attackRange || 1.6) + 0.6;
      const wasd = player.moveDir && (player.moveDir.dx || player.moveDir.dy);
      if (!wasd && Math.hypot(targetMob.x - player.x, targetMob.y - player.y) <= reach) {
        player.targetX = null;
        player.targetY = null;
        player.isMoving = false;
      }
    } else if (targetInfo && targetInfo.worldX !== undefined) {
      player.facing = this.gs.calculateFacing(player.x, player.y, targetInfo.worldX, targetInfo.worldY);
    }

    // a swing also hits the props in front of the hero (field zones): melee in a short cone, mages farther
    if (this.gs.fields.has(player.zone)) {
      let ax = targetMob ? targetMob.x - player.x : targetInfo && targetInfo.worldX !== undefined ? targetInfo.worldX - player.x : NaN;
      let ay = targetMob ? targetMob.y - player.y : targetInfo && targetInfo.worldY !== undefined ? targetInfo.worldY - player.y : NaN;
      if (!Number.isFinite(ax) || !Number.isFinite(ay) || Math.hypot(ax, ay) < 0.01) {
        const fv: any = ({ E: [1, 0], SE: [0.707, 0.707], S: [0, 1], SW: [-0.707, 0.707], W: [-1, 0], NW: [-0.707, -0.707], N: [0, -1], NE: [0.707, -0.707] } as any)[player.facing] || [1, 0];
        ax = fv[0]; ay = fv[1];
      }
      const al = Math.hypot(ax, ay) || 1;
      const propReach = isRangedClass(player.characterClass) ? 4 : (player.attackRange || 1.6) + 1.2;
      this.gs.damageFieldProps(player, player.x, player.y, propReach, { dx: ax / al, dy: ay / al, cos: 0.4 });
    }

    const critChance = 0.15 + (player.critChanceBonus || 0);
    let isCrit = Math.random() < critChance;
    if (player.smokeScreenTimer > 0) {
      isCrit = true;
      player.smokeScreenTimer = 0;
      this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '💥 AMBUSH!', color: '#f59e0b', size: 20 });
    }

    let attackDmg = player.dmg;
    if (player.berserkTimer > 0) {
      attackDmg = Math.round(attackDmg * 1.35);
    }
    // (Dread Lord's low-HP bonus is its card passive: passiveDamageMult)
    if (player.bloodlust) attackDmg = Math.round(attackDmg * this.gs.bloodRage(player));
    // melee hits below add up what they took, for the SP card passive leech
    let meleeDealt = 0;
    // where each blow landed, so the client can burst particles on what was hit
    const hits: any[] = [];
    const strike = (mob: Mob, dmg: any, crit: any) => {
      const before = mob.hp;
      this.gs.applyDamageToMob(player, mob, dmg, crit);
      meleeDealt += Math.max(0, before - Math.max(0, mob.hp));
      if (hits.length < 12) hits.push({ x: Math.round(mob.x * 100) / 100, y: Math.round(mob.y * 100) / 100, crit: !!crit });
    };

    let hasSweepTriggered = false;
    let sweepRangeHit = 0; // how far this swing's cleave reached (tiles), for the client's arc

    const power = player.weaponPower;
    if (isRangedClass(player.characterClass) && power && power.fireChannel) {
      // Sunfire Conduit: one fireball into each of the nearest enemies (the clicked one first), no splash
      const reach = player.attackRange + 1.0;
      const near = (Array.from(mobsMap.values()) as any[])
        .filter(m => m.state !== 'dead' && m !== targetMob && !(m.spawnUntil && Date.now() < m.spawnUntil) && Math.hypot(m.x - player.x, m.y - player.y) <= reach)
        .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
      const targets = (targetMob && Math.hypot(targetMob.x - player.x, targetMob.y - player.y) <= reach ? [targetMob] : []).concat(near).slice(0, power.fireChannel);
      if (targets.length) {
        targets.forEach(m => this.gs.spawnProjectile(player, m.x, m.y, m.id, 'mob', attackDmg, { crit: isCrit }));
      } else if (targetInfo && targetInfo.worldX !== undefined && targetInfo.worldY !== undefined) {
        this.gs.spawnProjectile(player, targetInfo.worldX, targetInfo.worldY, null, 'point', attackDmg, { crit: isCrit });
      }
    } else if (isRangedClass(player.characterClass)) {
      // Mage Ranged Projectiles
      if (targetMob) {
        const dist = Math.hypot(targetMob.x - player.x, targetMob.y - player.y);
        if (dist <= player.attackRange + 1.0) {
          this.gs.spawnProjectile(player, targetMob.x, targetMob.y, targetMob.id, 'mob', attackDmg, { splash: MAGE_SPLASH_SHARE, crit: isCrit });
        }
      } else if (targetInfo && targetInfo.worldX !== undefined && targetInfo.worldY !== undefined) {
        this.gs.spawnProjectile(player, targetInfo.worldX, targetInfo.worldY, null, 'point', attackDmg, { splash: MAGE_SPLASH_SHARE, crit: isCrit });
      } else {
        const facingVectors = {
          E: { x: 1, y: 0 }, SE: { x: 0.707, y: 0.707 }, S: { x: 0, y: 1 }, SW: { x: -0.707, y: 0.707 },
          W: { x: -1, y: 0 }, NW: { x: -0.707, y: -0.707 }, N: { x: 0, y: -1 }, NE: { x: 0.707, y: -0.707 }
        };
        const fv = (facingVectors as any)[player.facing] || { x: 1, y: 0 };
        this.gs.spawnProjectile(player, player.x + fv.x * 6, player.y + fv.y * 6, null, 'point', attackDmg, { splash: MAGE_SPLASH_SHARE, crit: isCrit });
      }
    } else {
      // Melee basic attacks with Minecraft-style Sweeping Edge cleave!
      const hitMobs = new Set();
      let primaryHit = false;

      // 1. Primary target damage
      if (targetMob) {
        const dist = Math.hypot(targetMob.x - player.x, targetMob.y - player.y);
        if (dist <= player.attackRange + 1.1) {
          strike(targetMob, attackDmg, isCrit);
          hitMobs.add(targetMob.id);
          primaryHit = true;
          if (player.berserkTimer > 0) {
            const maxHeal = Math.max(2, Math.round(player.maxHp * 0.04));
            const lifesteal = Math.min(maxHeal, Math.max(1, Math.round(attackDmg * 0.04)));
            player.hp = Math.min(player.maxHp, player.hp + lifesteal);
          }
          this.gs.chainBasicAttack(player, targetMob, attackDmg, mobsMap, strike);
        }
      }

      // 2. Sweeping Edge (Swipe) Cleave to surrounding enemies in front arc
      // (Gatekeeper's Greatsword: a far longer, wider cleave with a damage floor)
      const swipePct = Math.max(player.swipe !== undefined ? player.swipe : 35, (power && power.minSwipe) || 0);
      if (swipePct > 0) {
        hasSweepTriggered = true;
        const facingVectors = {
          E: { x: 0.707, y: -0.707 },
          SE: { x: 1.0, y: 0.0 },
          S: { x: 0.707, y: 0.707 },
          SW: { x: 0.0, y: 1.0 },
          W: { x: -0.707, y: 0.707 },
          NW: { x: -1.0, y: 0.0 },
          N: { x: -0.707, y: -0.707 },
          NE: { x: 0.0, y: -1.0 }
        };
        const fv = (facingVectors as any)[player.facing] || { x: 1.0, y: 0.0 };
        const { reach: sweepRange, arc } = this.gs.meleeSweep(player);
        sweepRangeHit = sweepRange;
        const minDot = Math.cos((arc * Math.PI) / 360);
        const swipeDmg = Math.max(1, Math.round(attackDmg * (swipePct / 100)));

        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead' || hitMobs.has(mob.id)) continue;
          const dx = mob.x - player.x;
          const dy = mob.y - player.y;
          const dist = Math.hypot(dx, dy);
          if (dist > sweepRange) continue;

          // Check angle in cone (±68 degrees, cos >= 0.35; wider for a sweepArc weapon)
          const dot = dist > 0.001 ? (dx * fv.x + dy * fv.y) / dist : 1.0;
          if (dot >= minDot) {
            hitMobs.add(mob.id);
            strike(mob, swipeDmg, Math.random() < critChance);   // its own crit roll, like the main target
          }
        }
      }
      this.gs.cardPassiveLeech(player, meleeDealt);
    }

    this.gs.emitZone(player.zone, 'entity_attack_fx', {
      attackerId: player.id,
      attackerType: 'player',
      class: player.characterClass,
      cardId: player.spTransformed && player.equipment && player.equipment.sp ? player.equipment.sp.cardId : null,
      targetId: targetInfo ? targetInfo.targetId : null,
      x: player.x,
      y: player.y,
      facing: player.facing,
      targetX: targetMob ? targetMob.x : undefined,
      targetY: targetMob ? targetMob.y : undefined,
      hasSweep: hasSweepTriggered,
      attackSpeed: player.attackSpeed || 1.0,
      swipe: player.swipe || 0,
      // the cleave's true reach (tiles) and arc (degrees), so the slash covers what it hits
      sweepRange: sweepRangeHit,
      sweepArc: hasSweepTriggered ? this.gs.meleeSweep(player).arc : 0,
      hits
    });
  }

  // How far (tiles) and how wide (degrees) a melee hero's basic-attack cleave reaches
  meleeSweep(player: Player) {
    const power = player.weaponPower;
    return {
      reach: (player.attackRange || 1.6) + SWEEP_EXTRA_REACH + ((power && power.sweepReach) || 0),
      arc: (power && power.sweepArc) || SWEEP_ARC_DEG
    };
  }

  // Storm Herald Arc Conduit (a toggled chainAttack): a basic attack that lands
  // arcs on to the nearest enemies, each jump weaker; every swing costs MP and
  // the conduit fades when there is not enough
  chainBasicAttack(player: Player, first: any, attackDmg: any, mobsMap: any, strike: any) {
    const toggle = (Object.values(player.spToggles || {}) as any[]).find(a => a.skill.chainAttack);
    if (!toggle) return;
    const sk = toggle.skill, C = sk.chainAttack;
    const cost = Math.round(C.mp * (player.manaCostMult || 1));
    if (player.mp < cost) {
      this.gs.endSpToggle(player, sk.id, true);
      this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.8, text: '💧 OUT OF MANA - conduit fades', color: '#38bdf8', size: 16 });
      return;
    }
    player.mp -= cost;
    const visited = new Set([first]);
    const points = [{ x: first.x, y: first.y }];
    let cur = first, mult = 1;
    while (points.length < C.n) {
      let next = null, best = C.jump;
      for (const m of mobsMap.values()) {
        if (m.state === 'dead' || visited.has(m)) continue;
        const d = Math.hypot(m.x - cur.x, m.y - cur.y);
        if (d <= best) { best = d; next = m; }
      }
      if (!next) break;
      mult *= C.decay;
      visited.add(next);
      points.push({ x: next.x, y: next.y });
      strike(next, Math.max(1, Math.round(attackDmg * mult)), Math.random() < 0.15 + (player.critChanceBonus || 0));
      cur = next;
    }
    if (points.length > 1) {
      this.gs.emitZone(player.zone, 'skill_fx', {
        type: 'sp_skill', shape: 'chain', quiet: true, x: player.x, y: player.y, startX: player.x, startY: player.y, points,
        element: sk.element, color: sk.color, cardId: sk.cardId, skillId: sk.id
      });
    }
  }

  spawnProjectile(caster: Player, targetX: any, targetY: any, targetId: any, targetType: any, damage: any, opts: any = {}) {
    const element = (caster.equipment && caster.equipment.weapon && caster.equipment.weapon.element) || 'neutral';
    const id = `proj_${this.gs.nextEntityId++}`;
    let dx = (targetX !== undefined ? targetX : caster.x) - caster.x;
    let dy = (targetY !== undefined ? targetY : caster.y) - caster.y;
    let angle = Math.atan2(dy, dx);
    if (Math.hypot(dx, dy) < 0.001) {
      const facingAngles = { E: 0, SE: Math.PI / 4, S: Math.PI / 2, SW: 3 * Math.PI / 4, W: Math.PI, NW: -3 * Math.PI / 4, N: -Math.PI / 2, NE: -Math.PI / 4 };
      angle = (facingAngles as any)[caster.facing] !== undefined ? (facingAngles as any)[caster.facing] : 0;
    }
    const speed = 9.0;
    // a transformed mage throws its card's own bolt (drawn per card on the client)
    const cardId = caster.spTransformed && caster.equipment && caster.equipment.sp ? caster.equipment.sp.cardId : null;

    this.gs.projectiles.set(id, createProjectile({
      cardId,
      instanceId: caster.zone === 'dungeon' ? (caster.dungeonInstanceId || null) : null,
      id,
      zone: caster.zone,
      casterId: caster.id,
      x: caster.x,
      y: caster.y,
      targetX,
      targetY,
      targetId,
      targetType,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      splash: opts.splash || 0,
      crit: !!opts.crit,
      element,
      life: 2.0,
      color: '#f97316'
    }));

    this.gs.emitZone(caster.zone, 'projectile_spawned', {
      id,
      zone: caster.zone,
      x: caster.x,
      y: caster.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      casterId: caster.id,
      element,
      cardId,
      splash: opts.splash || 0,
      color: '#f97316'
    });
  }

  // Area burst around a projectile's impact (mage basic attack)
  applyProjectileSplash(caster: Player, proj: any, primary: Mob, mobsMap: any) {
    const splashDmg = Math.max(1, Math.round(proj.damage * proj.splash));
    for (const other of mobsMap.values()) {
      if (other === primary || other.state === 'dead') continue;
      if (Math.hypot(other.x - primary.x, other.y - primary.y) > MAGE_SPLASH_RADIUS) continue;
      this.gs.applyDamageToMob(caster, other, splashDmg, false);
    }
  }

  // isEcho: a Void Echo repeat hit, which must not trigger talent procs again
  applyDamageToMob(player: Player, mob: Mob, baseDamage: any, isCritical = false, isEcho = false) {
    if (mob.spawnUntil && Date.now() < mob.spawnUntil) return; // still rising: untouchable
    const variation = (Math.random() * 0.4) - 0.2;
    let rawDamage = Math.round(baseDamage * (1 + variation));

    // Weapon Element vs Monster Element / Resist
    const spEl = player && player.spTransformed && player.equipment && player.equipment.sp && (SP.CARD_BY_ID as any)[player.equipment.sp.cardId];
    const atkElement = spEl ? spEl.element
      : (player && player.equipment && player.equipment.weapon && player.equipment.weapon.element)
        ? player.equipment.weapon.element
        : 'neutral';
    const mobElement = mob.element || 'neutral';
    const mobResists = mob.elementResist || {};
    const elemMult = calculateElementalMultiplier(atkElement, mobElement, mobResists);
    rawDamage = Math.max(1, Math.round(rawDamage * elemMult));

    // Elemental Rune Weapon Empowerment
    const runeCounts = this.gs.getWeaponRuneCounts(player);
    if (runeCounts.flame > 0) {
      rawDamage = Math.round(rawDamage * (1 + 0.25 * runeCounts.flame));
      mob.burnTimer = Math.max(mob.burnTimer || 0, 4.0);
      mob.burnDmg = Math.max(mob.burnDmg || 0, Math.round(rawDamage * 0.15));
    }
    if (runeCounts.tempest > 0) {
      rawDamage = Math.round(rawDamage * (1 + 0.10 * runeCounts.tempest));
    }

    // Bannerman: fighting inside your own War Standard
    const banner = player && this.gs.ownBanner(player);
    if (banner && Math.hypot(player.x - banner.x, player.y - banner.y) <= banner.r) rawDamage = Math.round(rawDamage * (1 + banner.bonus));

    // Cryomancer Frostbite: chilled enemies take extra damage
    const procs = player && player.talentProcs;
    if (procs && procs.shatterBonus && mob.chillTimer > 0) {
      rawDamage = Math.round(rawDamage * (1 + procs.shatterBonus));
    }
    // Armor sets: Emberheart (vs burning), Eclipse Dusk
    if (player && (player.set2 || player.set4)) rawDamage = Math.round(rawDamage * this.gs.setDamageMult(player, mob));
    // SP card passive: bonus vs statuses, executes, openers, fighting wounded
    if (player && player.spTransformed) rawDamage = Math.round(rawDamage * this.gs.passiveDamageMult(player, mob));

    // Level Gap Mitigation & Deflection
    let isGlancing = false;
    let isDeflected = false;
    // (Eternal Rift monsters outlevel the party on purpose: their stats carry the challenge)
    if (player && mob.level && player.level && !mob.noLevelGap) {
      const levelGap = mob.level - player.level;
      if (levelGap >= 20) {
        // Enormous level gap: attacks deflect completely!
        isDeflected = true;
        isCritical = false;
      } else if (levelGap > 3) {
        // High level gap: glancing blows and steep defense penalty
        isGlancing = true;
        const penaltyMult = Math.pow(0.85, levelGap - 3);
        rawDamage = Math.max(1, Math.round(rawDamage * penaltyMult));
        if (levelGap >= 8) {
          isCritical = false; // Cannot score critical hits on foes 8+ levels higher
        }
      }
    }

    if (isCritical) {
      const critMultiplier = 1.5 + (player && player.critDmgBonus ? player.critDmgBonus : 0);
      rawDamage = Math.round(rawDamage * critMultiplier);
    }

    // Mob defense removes a share of every hit (see MOB_DEF_K)
    const mobDef = (mob.def || 0) + (mob.hasCommanderBuff ? 8 : 0);
    let damage = isDeflected ? 1 : Math.max(1, Math.round(rawDamage * MOB_DEF_K / (MOB_DEF_K + mobDef)));

    // Fortified affix absorbs 30% damage
    if (mob.buffs && mob.buffs.includes('fortified')) {
      damage = Math.max(1, Math.round(damage * 0.7));
    }

    // Shielded Elites (dungeon modifier): the shield soaks hits before HP
    if (mob.shield > 0 && !isDeflected) {
      const soak = Math.min(mob.shield, damage);
      mob.shield -= soak;
      damage -= soak;
      if (mob.shield <= 0) {
        this.gs.emitZone((player && player.zone) || mob.fieldZone, 'floating_text', { x: mob.x, y: mob.y - 1.0, text: '🛡️ SHIELD BROKEN!', color: '#93c5fd', size: 16 },
          player && player.zone === 'dungeon' ? player.dungeonInstanceId : null);
      }
    }
    mob.hp -= damage;
    // Duskblade Doom brand soaks up what its owner deals (replayed when it ends)
    if (player && mob.doom && mob.doom.owner === player.id && mob.doom.until > Date.now()) mob.doom.stored += damage;
    mob.state = 'chase';
    mob.targetPlayerId = player ? player.id : null;
    if (player) mob.lastHitBy = player.id; // burn / poison kills are credited to them

    if (runeCounts.frost > 0) {
      mob.chillTimer = Math.max(mob.chillTimer || 0, 3.5);
      if (Math.random() < Math.min(0.75, 0.25 * runeCounts.frost)) {
        if (!(mob.frozenTimer > 0)) mob.frozenKind = 'ice'; // don't turn a Chrono stasis into ice mid-way
        mob.frozenTimer = Math.max(mob.frozenTimer || 0, mob.isBoss ? BOSS_FREEZE_SECONDS : FREEZE_SECONDS);
        this.gs.emitZone((player && player.zone) || mob.fieldZone, 'floating_text', {
          x: mob.x,
          y: mob.y - 0.7,
          text: '❄️ FROZEN!',
          color: '#38bdf8',
          size: 16
        });
      }
    }
    if (runeCounts.vampiric > 0 && damage > 0 && !isDeflected) {
      const vLeech = Math.round(damage * 0.25 * runeCounts.vampiric);
      player.hp = Math.min(player.maxHp, player.hp + vLeech);
      const now = Date.now();
      if (!player._lastRuneLeechText || now - player._lastRuneLeechText > 250) {
        player._lastRuneLeechText = now;
        this.gs.emitZone((player && player.zone) || mob.fieldZone, 'floating_text', {
          x: player.x,
          y: player.y - 0.5,
          text: `+${vLeech} HP (Vampiric Rune)`,
          color: '#a855f7',
          size: 14
        });
      }
    }

    // Field raid boss: feed the live leaderboard (actual damage dealt)
    if (mob.isRaidBoss && player) {
      this.gs.recordRaidDamage(mob.fieldZone || player.zone, player.id, damage);
    }

    // Apply Talent Life Steal (balanced with per-hit cap and throttled floating text)
    if (player && player.lifeSteal && player.lifeSteal > 0 && damage > 0 && !isDeflected) {
      const maxLeech = Math.max(2, Math.round(player.maxHp * 0.04));
      const leech = Math.min(maxLeech, Math.max(1, Math.round(damage * player.lifeSteal)));
      player.hp = Math.min(player.maxHp, player.hp + leech);
      const now = Date.now();
      if (!player._lastLeechText || now - player._lastLeechText > 250) {
        player._lastLeechText = now;
        this.gs.emitZone((player && player.zone) || mob.fieldZone, 'floating_text', {
          x: player.x,
          y: player.y - 0.5,
          text: `+${leech} HP (Leech)`,
          color: '#c084fc',
          size: 13
        });
      }
    }

    let text = `${damage}`;
    let textColor = '#ffea00'; // Iconic Ragnarok Online yellow damage text
    let textSize = 17;

    // Plain numbers: colour and size show weak / resisted / glancing hits
    if (elemMult >= 1.25) {
      textColor = '#f59e0b';
      textSize = 20;
    } else if (elemMult <= 0.75) {
      textColor = '#94a3b8';
      textSize = 15;
    }

    if (isDeflected) {
      text = 'MISS';
      textColor = '#94a3b8';
      textSize = 15;
    } else if (isCritical) {
      text = `${damage}`;
      textColor = '#ff3366';
      textSize = 24;
    } else if (isGlancing) {
      text = `${damage}`;
      textColor = '#fb923c';
      textSize = 15;
    }
    if (isEcho && !isDeflected) {
      text = `✦ ${damage}`;
      textColor = '#c084fc';
    }

    const instId = player && player.zone === 'dungeon' ? player.dungeonInstanceId : null;
    this.gs.emitZone((player && player.zone) || mob.fieldZone, 'floating_text', {
      x: mob.x,
      y: mob.y - 0.7,
      text,
      color: textColor,
      size: textSize,
      crit: !!isCritical
    }, instId);

    if (player && player.set4 && !isDeflected) this.gs.applySetOnHit(player, mob, damage);

    if (player && player.spTransformed && !isEcho && !isDeflected && damage > 0) this.gs.gainUltCharge(player, ULT_GAIN_HIT);
    if (mob.hp <= 0) {
      this.gs.handleMobDeath(mob, player);
    } else if (player && !isDeflected && !isEcho) {
      this.gs.applyTalentProcs(player, mob, baseDamage, damage);
      if (player.spTransformed) this.gs.passiveOnHit(player, mob, damage);
    }
  }

  handleMobDeath(mob: Mob, killerPlayer: Player) {
    if (killerPlayer && killerPlayer.spTransformed) this.gs.passiveOnKill(killerPlayer, mob);
    // Field raid bosses are paid out by participation rank, not ground loot:
    // give everyone their bounty, broadcast the kill, and let the schedule reset.
    if (mob.isRaidBoss) {
      this.gs.onRaidBossDeath(mob, killerPlayer);
      return;
    }
    mob.state = 'dead';
    mob.hp = 0;
    const isDungeon = (mob.zone === 'dungeon') || (mob.id && mob.id.startsWith('dungeon_')) || (killerPlayer && killerPlayer.zone === 'dungeon');
    mob.respawnTimer = isDungeon ? Infinity : (mob.isBoss ? 25.0 : 10.0);

    const zone = killerPlayer ? killerPlayer.zone : (mob.fieldZone || (mob.id.startsWith('frost_') ? 'frostfell' : 'town'));
    const isBoss = !!mob.isBoss;
    const isMiniboss = !!mob.isMiniboss;
    const instId = (killerPlayer && killerPlayer.zone === 'dungeon' ? killerPlayer.dungeonInstanceId : null) || (mob && (mob as any).dungeonInstanceId) || (this.gs as any).ctxInstanceId || null;
    if (mob.mechanics) this.gs.bossMech.onDeath(mob, mob.fieldZone || (instId ? 'dungeon' : zone), instId);
    // every monster of the run counts toward the boss portal, whatever killed it (burns, poison, blasts...)
    this.gs.countDungeonProgress(mob, instId, killerPlayer);
    // its body lies where it fell for a while: the Gravelord can raise it
    if (!isBoss) this.gs.addCorpse(mob, zone, instId);
    // Item drops fade out when the killer is far above the monster's level
    // (gold still drops); `lucky` scales every item roll below
    const lootMult = killerPlayer ? lootGapMult(killerPlayer.level, mob.level) : 1;
    const lucky = (chance: any) => Math.random() < chance * lootMult;

    if (killerPlayer) {
      // Venom Lord Epidemic Spread on Kill
      if ((mob.poisonStacks && mob.poisonStacks > 0) || (mob.poisonTimer && mob.poisonTimer > 0)) {
        const stacks = mob.poisonStacks || 2;
        const mobsMap = this.gs.getMobsMap(zone);
        let spreadCount = 0;
        for (const nearby of mobsMap.values()) {
          if (nearby === mob || nearby.state === 'dead') continue;
          if (Math.hypot(nearby.x - mob.x, nearby.y - mob.y) <= 4.2) {
            nearby.poisonStacks = Math.min(10, (nearby.poisonStacks || 0) + stacks);
            nearby.poisonTimer = Math.max(nearby.poisonTimer || 0, 7.0);
            nearby.poisonDmg = Math.max(nearby.poisonDmg || 0, Math.round((killerPlayer.dmg || 30) * 0.12 * nearby.poisonStacks));
            spreadCount++;
          }
        }
        if (spreadCount > 0) {
          this.gs.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.7, text: `☣️ EPIDEMIC (${spreadCount})`, color: '#4ade80' });
        }
      }

      // Nightblade Shadow Mark Dash Reset on Kill
      if (mob.shadowMarkTimer > 0) {
        if (killerPlayer.skillCooldowns && killerPlayer.skillCooldowns.dash > 0) {
          killerPlayer.skillCooldowns.dash = 0;
          const kSocket = this.gs.io.sockets.sockets.get(killerPlayer.id);
          if (kSocket) kSocket.emit('player_updated', killerPlayer);
          this.gs.emitZone(zone, 'floating_text', { x: killerPlayer.x, y: killerPlayer.y - 0.7, text: `🗡️ SHADOW RESET!`, color: '#a855f7' });
        }
      }

      killerPlayer.inventory.kills++;
      if (killerPlayer.dungeonRun) killerPlayer.dungeonRun.kills = (killerPlayer.dungeonRun.kills || 0) + 1;

      // full EXP near your level, much less for monsters far below you; party
      // members nearby on the same map split it (see partyExpSharers)
      const sharers = this.gs.partyExpSharers(killerPlayer);
      const share = mob.exp * (1 + PARTY_EXP_BONUS * (sharers.length - 1)) / sharers.length;
      for (const member of sharers) {
        const memberExp = Math.max(1, Math.round(share * levelGapMult(member.level, mob.level)));
        this.gs.awardExp(member, memberExp);
        this.gs.awardJobExp(member, memberExp);
        if (member !== killerPlayer) {
          const mSocket = this.gs.io.sockets.sockets.get(member.id);
          if (mSocket) mSocket.emit('player_updated', member);
        }
      }

      // Passive on-kill effects: restore a share of max HP / MP (summed over the tree in recalc)
      const tk = killerPlayer.talentKill;
      if (tk && tk.hp > 0 && killerPlayer.hp < killerPlayer.maxHp) {
        const heal = Math.round(killerPlayer.maxHp * tk.hp);
        killerPlayer.hp = Math.min(killerPlayer.maxHp, killerPlayer.hp + heal);
        if (heal > 0) this.gs.emitZone(zone, 'floating_text', { x: killerPlayer.x, y: killerPlayer.y - 0.5, text: `+${heal} HP`, color: '#4ade80' });
      }
      if (tk && tk.mp > 0 && killerPlayer.mp < killerPlayer.maxMp) {
        const mana = Math.round(killerPlayer.maxMp * tk.mp);
        killerPlayer.mp = Math.min(killerPlayer.maxMp, killerPlayer.mp + mana);
        if (mana > 0) this.gs.emitZone(zone, 'floating_text', { x: killerPlayer.x, y: killerPlayer.y - 0.5, text: `+${mana} MP`, color: '#38bdf8' });
      }

      if (mob.riftMob) {
        // Rift kills pay Rift Points only; the wave logic handles the rest
      } else if (mob.isBoss) {
        this.gs.broadcastSystemMessage(`👑 Legendary Conquest! [${killerPlayer.name}] vanquished [${mob.name}]!`);
        const bossInst = this.gs.getPlayerDungeonInstance(killerPlayer);
        if (bossInst) this.gs.rollBossSpLoot(bossInst, mob.level);
        if (killerPlayer.zone === 'dungeon') {
          this.gs.broadcastSystemMessage(`🎉 The Dungeon Boss fell! A portal to deeper dungeon depths has unlocked.`);
          for (const p of this.gs.players.values()) {
            if (p.zone === 'dungeon' && p.dungeonInstanceId === killerPlayer.dungeonInstanceId && p.dungeonRun && !p.dungeonRun.cleared) {
              this.gs.completeDungeonRun(p);
            }
          }
        }
      } else if (mob.isMiniboss) {
        this.gs.broadcastSystemMessage(`⚔️ Miniboss Slain! [${killerPlayer.name}] vanquished [${mob.name}]!`);
        this.gs.spawnGroundItem(zone, 'item', 'spirit_fragment', mob.x, mob.y, 1, null, instId);
        if (lucky(0.40)) {
          const cls = killerPlayer && killerPlayer.characterClass;
          let gear = ItemFactory.gear(pickGearForLevel(mob.level || 1, { boss: false, cls }), mob.level || 1, false);
          const reforge = rollSkyblockReforge(gear);
          if (reforge) gear = applySkyblockReforge(gear, reforge);
          this.gs.spawnGroundItem(zone, 'item', gear.id, mob.x + (Math.random() - 0.5) * 1.0, mob.y + (Math.random() - 0.5) * 1.0, 1, gear, instId);
          this.gs.broadcastSystemMessage(`💎 Miniboss Bounty! [${mob.name}] dropped [${gear.name}]!`);
        }
      }
    }

    // Eternal Rift monsters drop nothing: they pay Rift Points to whoever slew them
    if (mob.riftMob) {
      const riftInst = this.gs.dungeonInstances.get(mob.riftInstanceId);
      if (riftInst && riftInst.rift) this.gs.onRiftMobDeath(riftInst, mob, killerPlayer);
      this.gs.emitZone('dungeon', 'mob_died', { mobId: mob.id, killerId: killerPlayer ? killerPlayer.id : null }, mob.riftInstanceId);
      return;
    }

    // Spirit fragments from elite (commander) monsters and, rarely, any dungeon monster
    if (!isBoss && !isMiniboss && zone === 'dungeon' && lucky(mob.isCommander ? SP.FRAGMENT_DROP.commander : SP.FRAGMENT_DROP.mob)) {
      this.gs.spawnGroundItem(zone, 'item', 'spirit_fragment', mob.x, mob.y, 1, null, instId);
    }

    // Drop Gold: Reduced drop rate (45% for trash mobs, 100% for bosses/minibosses/commanders) and rebalanced amount
    const shouldDropGold = isBoss || isMiniboss || mob.isCommander || Math.random() < 0.45;
    if (shouldDropGold && mob.gold > 0) {
      const goldScale = isBoss ? 0.7 : isMiniboss ? 0.6 : 0.45;
      const goldDrop = Math.max(1, Math.round(mob.gold * goldScale * (0.8 + Math.random() * 0.4)));
      this.gs.spawnGroundItem(zone, 'gold', 'Gold Coins', mob.x + (Math.random() - 0.5) * 0.5, mob.y + (Math.random() - 0.5) * 0.5, goldDrop, null, instId);
    }

    if (isBoss) {
      // Boss gear is high quality with a rolled reforge ("ออฟสวยๆ"), but kept rare:
      // 35% for one piece, 6% for a second.
      const equipCount = (lucky(BOSS_GEAR_DROP_CHANCE) ? 1 : 0) + (lucky(BOSS_BONUS_GEAR_DROP_CHANCE) ? 1 : 0);
      const cls = killerPlayer && killerPlayer.characterClass;
      for (let i = 0; i < equipCount; i++) {
        let gear = ItemFactory.gear(pickGearForLevel(mob.level || 1, { boss: true, cls }), mob.level || 1, true);
        const reforge = rollSkyblockReforge(gear);
        if (reforge) {
          gear = applySkyblockReforge(gear, reforge);
        }
        this.gs.spawnGroundItem(zone, 'item', gear.id, mob.x + (Math.random() - 0.5) * 1.2, mob.y + (Math.random() - 0.5) * 1.2, 1, gear, instId);
        if (killerPlayer) {
          this.gs.broadcastSystemMessage(`👑 Boss Loot! [${mob.name}] dropped [${gear.name}] (${gear.rarity ? gear.rarity.toUpperCase() : 'RARE'})!`);
        }
      }

      if (lucky(BOSS_REVIVAL_STONE_CHANCE)) {
        this.gs.spawnGroundItem(zone, 'item', 'revival_stone', mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1, null, instId);
      }

      // High-tier Potions
      if (lucky(1)) {
        this.gs.spawnGroundItem(zone, 'item', 'health_potion', mob.x + 0.4, mob.y, 2, null, instId);
        this.gs.spawnGroundItem(zone, 'item', 'mana_potion', mob.x - 0.4, mob.y, 2, null, instId);
      }
    } else {
      // Normal mobs:
      // "แต่อัตราการดรอปของ ทำให้น้อยๆหน่อย" (Low drop rate: ~3.5% equipment, ~6% potions/stone)
      if (lucky(MOB_GEAR_DROP_CHANCE)) {
        const cls = killerPlayer && killerPlayer.characterClass;
        let gear = ItemFactory.gear(pickGearForLevel(mob.level || 1, { cls }), mob.level || 1, false);
        if (Math.random() < 0.25) {
          const reforge = rollSkyblockReforge(gear);
          if (reforge) gear = applySkyblockReforge(gear, reforge);
        }
        this.gs.spawnGroundItem(zone, 'item', gear.id, mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1, gear, instId);
      }

      if (lucky(0.06)) {
        const cChoice = Math.random();
        if (cChoice < 0.45) {
          this.gs.spawnGroundItem(zone, 'item', 'health_potion', mob.x + (Math.random() - 0.5) * 0.6, mob.y + (Math.random() - 0.5) * 0.6, 1, null, instId);
        } else if (cChoice < 0.90) {
          this.gs.spawnGroundItem(zone, 'item', 'mana_potion', mob.x + (Math.random() - 0.5) * 0.6, mob.y + (Math.random() - 0.5) * 0.6, 1, null, instId);
        } else {
          // Rare revival stone drop from regular mob!
          this.gs.spawnGroundItem(zone, 'item', 'revival_stone', mob.x, mob.y, 1, null, instId);
        }
      }

      // Relic drops in dungeon/field (reduced to 12%)
      if ((zone === 'dungeon' || (this.gs.fields && this.gs.fields.has(zone))) && lucky(0.12)) {
        const relics = ['ancient_ruby', 'cursed_chalice', 'shadow_essence'];
        const r = relics[Math.floor(Math.random() * relics.length)];
        this.gs.spawnGroundItem(zone, 'item', r, mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1, null, instId);
      }
    }

    // Elemental Rune drop: 0.005% chance (0.00005) from any monster kill
    if (Math.random() < RUNE_DROP_CHANCE) {
      const runeKeys = ['rune_flame', 'rune_frost', 'rune_tempest', 'rune_vampiric'];
      const chosenRune = runeKeys[Math.floor(Math.random() * runeKeys.length)];
      this.gs.spawnGroundItem(zone, 'item', chosenRune, mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1, null, instId);
      this.gs.broadcastSystemMessage(`✨ MYTHICAL DROP! [${killerPlayer ? killerPlayer.name : 'A hero'}] uncovered a rare [${ITEMS[chosenRune]?.name || chosenRune}]!`);
    }

    // Attribute materials for Jerry: each has its own small chance on any monster
    for (const [matId, chance] of Object.entries(ATTR.ATTR_MATERIAL_DROP)) {
      if (Math.random() < chance) this.gs.spawnGroundItem(zone, 'item', matId, mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1, null, instId);
    }

    // Armor set fragments (crafting.ts): bosses usually, other monsters rarely
    const frag = CRAFT.rollFragmentDrop(mob);
    if (frag) this.gs.spawnGroundItem(zone, 'item', frag.itemId, mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, frag.n, null, instId);

    // Dungeon modifiers: a modded boss pays out extra fragments; Volatile monsters burst
    const modInst = zone === 'dungeon' && instId ? this.gs.dungeonInstances.get(instId) : null;
    if (modInst && modInst.mods && modInst.mods.length) {
      const extra = isBoss ? DMODS.bonusBossFragments(modInst.mods) : 0;
      if (extra > 0) {
        const pick = CRAFT.rollFragmentDrop({ isBoss: true, level: Math.max(40, mob.level || 1) }) || { itemId: 'fragment_wayfarer' };
        this.gs.spawnGroundItem(zone, 'item', pick.itemId, mob.x, mob.y + 0.4, extra, null, instId);
      }
      if (modInst.mods.includes('volatile')) this.gs.scheduleVolatileBurst(modInst, mob);
    }

    // Defensive armor runes: rarer than gear, far more common than the elemental ones
    if (Math.random() < (isBoss ? ARMOR_RUNE_DROP.boss : ARMOR_RUNE_DROP.normal)) {
      const armorRunes = Object.values(ITEMS).filter((it: any) => it.type === 'rune' && it.socketFor === 'armor') as any[];
      const r = armorRunes[Math.floor(Math.random() * armorRunes.length)];
      if (r) {
        this.gs.spawnGroundItem(zone, 'item', r.id, mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1, null, instId);
        if (isBoss) this.gs.broadcastSystemMessage(`🔷 [${killerPlayer ? killerPlayer.name : 'A hero'}] found a [${r.name}] on [${mob.name}]!`);
      }
    }

    // Ancient Socket Expander drop: 0.00005% chance (0.0000005) from boss monsters
    if (isBoss && Math.random() < SOCKET_EXPANDER_DROP_CHANCE) {
      this.gs.spawnGroundItem(zone, 'item', 'socket_expander', mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1, null, instId);
      this.gs.broadcastSystemMessage(`🌟 TITAN RELIC! [${killerPlayer ? killerPlayer.name : 'A hero'}] found an [Ancient Socket Expander] from [${mob.name}]!`);
    }

    this.gs.emitZone(zone, 'mob_died', { mobId: mob.id, killerId: killerPlayer ? killerPlayer.id : null }, instId);
  }

  // Wayfarer's Resolve: Second Wind when HP falls under the threshold
  checkSecondWind(player: Player, zone: any) {
    const sw = player.set4 && player.set4.wayfarer;
    const now = Date.now();
    if (!sw || player.isDead || player.hp <= 0 || player.hp > player.maxHp * sw.hpThreshold) return;
    if ((player.secondWindReadyAt || 0) > now) return;
    player.secondWindReadyAt = now + sw.cooldown * 1000;
    const shield = Math.round(player.maxHp * sw.shieldPct);
    player.shieldHp = (player.shieldHp || 0) + shield;
    player.sprintTimer = Math.max(player.sprintTimer || 0, sw.hasteSec);
    if (player.statusEffects) player.statusEffects = player.statusEffects.filter((e: any) => e.type !== 'chill');
    player.speedFactor = 1.0;
    this.gs.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 1.0, text: `🌿 SECOND WIND! +${shield} Shield`, color: '#4ade80', size: 18 });
    this.gs.emitZone(zone, 'skill_fx', { type: 'set_proc', set: 'wayfarer', x: player.x, y: player.y, radius: 1.6, color: '#4ade80', playerId: player.id });
  }

  // Damage multiplier from set bonuses for one hit on `mob`
  setDamageMult(player: Player, mob: Mob) {
    let m = 1;
    if (player.set2 && player.set2.emberheart && mob.burnTimer > 0) m += player.set2.emberheart.dmgVsBurning;
    if (player.eclipsePhase === 'dusk' && player.set4 && player.set4.eclipse) m += player.set4.eclipse.duskDmg;
    return m;
  }

  // On-hit set effects after a hit of `damage` landed on a living or dead mob.
  // Hits made by these procs pass player._inSetProc so they never chain again.
  applySetOnHit(player: Player, mob: Mob, damage: any) {
    if (!player.set4 || player._inSetProc) return;
    const zone = player.zone;
    const instId = player.zone === 'dungeon' ? player.dungeonInstanceId : null;
    const mobs = () => this.gs.getMobsMap(player.zone, player);

    // Eclipse, Dusk: heal from damage dealt (capped per hit like other leech)
    const ec = player.set4.eclipse;
    if (ec && player.eclipsePhase === 'dusk' && damage > 0) {
      const heal = Math.min(Math.round(player.maxHp * 0.05), Math.max(1, Math.round(damage * ec.duskLeech)));
      player.hp = Math.min(player.maxHp, player.hp + heal);
    }

    // Emberheart: Ember brands, erupting at full stacks
    const em = player.set4.emberheart;
    if (em) {
      if (!mob.embers) mob.embers = {};
      const n = (mob.embers[player.id] || 0) + 1;
      if (n < em.stacks) {
        mob.embers[player.id] = n;
      } else {
        mob.embers[player.id] = 0;
        player._inSetProc = true;
        try {
          const hit = Math.max(1, Math.round(player.dmg * em.dmgMult * SKILL_DAMAGE_SCALE));
          for (const other of mobs().values()) {
            if (other.state === 'dead' || other.hp <= 0) continue;
            if (Math.hypot(other.x - mob.x, other.y - mob.y) > em.radius) continue;
            other.burnTimer = Math.max(other.burnTimer || 0, em.burnSec);
            other.burnDmg = Math.max(other.burnDmg || 0, Math.round(player.dmg * em.burnMult));
            this.gs.applyDamageToMob(player, other, hit, false);
          }
        } finally { player._inSetProc = false; }
        this.gs.emitZone(zone, 'skill_fx', { type: 'set_proc', set: 'emberheart', x: mob.x, y: mob.y, radius: em.radius, color: '#f97316', playerId: player.id }, instId);
        this.gs.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 1.1, text: '🔥 CINDER CASCADE!', color: '#fb923c', size: 17 }, instId);
      }
    }

    // Stormcaller: a full Static charge discharges into a lightning chain
    const st = player.set4.stormcaller;
    if (st && (player.staticStacks || 0) >= st.stacks) {
      player.staticStacks = 0;
      const points = [{ x: mob.x, y: mob.y }];
      const struck = new Set([mob.id]);
      let from = mob;
      let mult = st.dmgMult;
      player._inSetProc = true;
      try {
        for (let i = 0; i < st.chains; i++) {
          let next = null, best = st.range;
          for (const other of mobs().values()) {
            if (struck.has(other.id) || other.state === 'dead' || other.hp <= 0) continue;
            const d = Math.hypot(other.x - from.x, other.y - from.y);
            if (d <= best) { best = d; next = other; }
          }
          if (!next) break;
          struck.add(next.id);
          points.push({ x: next.x, y: next.y });
          this.gs.applyDamageToMob(player, next, Math.max(1, Math.round(player.dmg * mult * SKILL_DAMAGE_SCALE)), false);
          mult *= (1 - st.falloff);
          from = next;
        }
      } finally { player._inSetProc = false; }
      if (player.skillCooldowns) {
        for (const k of Object.keys(player.skillCooldowns)) {
          if (player.skillCooldowns[k] > 0) player.skillCooldowns[k] = Number((player.skillCooldowns[k] * (1 - st.cdCut)).toFixed(2));
        }
      }
      this.gs.emitZone(zone, 'skill_fx', { type: 'set_proc', set: 'stormcaller', x: mob.x, y: mob.y, points, color: '#facc15', playerId: player.id }, instId);
      this.gs.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 1.0, text: '⚡ STATIC OVERLOAD!', color: '#facc15', size: 17 }, instId);
    }
  }
}
