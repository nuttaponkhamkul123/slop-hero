// SP card passives and hero state: bloodlust, signature charge, on-hit/kill/hurt procs, leech, rebirth, shield absorption, banners and the HUD buff list.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import * as SP from '../spCards';
import { SKILL_DAMAGE_SCALE, FROST_TO_FREEZE, FROST_SECONDS, FREEZE_SECONDS, BOSS_FREEZE_SECONDS, VOID_SOUL_MAX, VOID_SOUL_SECONDS, ULT_CHARGE_MAX, ULT_GAIN_KILL, ULT_GAIN_HURT, ULT_MAX_GAIN_PER_SEC } from '../config/constants';
import type { Player, Mob } from '../entities/types';

export class PassiveSystem {
  constructor(private readonly gs: GameServer) {}

  // Damage multiplier from Bloodlust (Berserker buff)
  bloodRage(player: Player) {
    return player.bloodlust ? 1 + (player.bloodlust.rage || 0) : 1;
  }

  // The card a transformed hero is wearing, else null
  spCard(player: Player) {
    return (player && player.spTransformed && player.equipment && player.equipment.sp && (SP.CARD_BY_ID as any)[player.equipment.sp.cardId]) || null;
  }

  // Signature charge (0..100). Gains are capped per second so a big pack hit
  // by one wide skill can't fill it in a single cast.
  gainUltCharge(player: Player, amount: any) {
    const card = this.gs.spCard(player);
    if (!card || !card.signature || !(amount > 0) || player.isDead) return;
    const now = Date.now();
    if (player.ultLockUntil > now) return;
    if (!player.ultWindow || now - player.ultWindow.t >= 1000) player.ultWindow = { t: now, g: 0 };
    const gain = Math.min(amount * (1 + ((card.passive && card.passive.ultGain) || 0)), ULT_MAX_GAIN_PER_SEC - player.ultWindow.g);
    if (gain <= 0) return;
    player.ultWindow.g += gain;
    const before = player.ultCharge || 0;
    player.ultCharge = Math.min(ULT_CHARGE_MAX, before + gain);
    if (before < ULT_CHARGE_MAX && player.ultCharge >= ULT_CHARGE_MAX) {
      const socket = this.gs.io.sockets.sockets.get(player.id);
      if (socket) socket.emit('floating_text', { x: player.x, y: player.y - 1.1, text: `✦ ${card.signature.name.toUpperCase()} READY [G]`, color: card.color || '#facc15', size: 17 });
    }
  }

  // Passive damage bonus for a hit on `mob` (status, execute, opener, low HP)
  passiveDamageMult(player: Player, mob: Mob) {
    const pv = this.gs.spCard(player) && this.gs.spCard(player).passive;
    if (!pv) return 1;
    let k = 1;
    if (pv.vs) {
      if (pv.vs.burn && mob.burnTimer > 0) k += pv.vs.burn;
      if (pv.vs.poison && mob.poisonTimer > 0) k += pv.vs.poison;
      if (pv.vs.chill && mob.chillTimer > 0) k += pv.vs.chill;
      if (pv.vs.frozen && mob.frozenTimer > 0) k += pv.vs.frozen;
    }
    if (pv.execute && mob.maxHp && mob.hp <= mob.maxHp * pv.execute.below) k += pv.execute.dmg;
    if (pv.opener && mob.maxHp && mob.hp >= mob.maxHp) k += pv.opener;
    if (pv.lowHp && player.hp <= player.maxHp * pv.lowHp.below) k += pv.lowHp.dmg || 0;
    return k;
  }

  // Passive on-hit procs; `damage` is what landed. Extra hits it deals are
  // flagged as echoes so they never proc again.
  passiveOnHit(player: Player, mob: Mob, damage: any) {
    const card = this.gs.spCard(player);
    const hp = card && card.passive && card.passive.hitProc;
    if (!hp || Math.random() >= hp.chance || mob.state === 'dead' || mob.hp <= 0) return;
    const zone = player.zone;
    const inst = player.zone === 'dungeon' ? player.dungeonInstanceId : null;
    if (hp.poison) {
      mob.poisonStacks = Math.min(10, (mob.poisonStacks || 0) + hp.poison);
      mob.poisonTimer = Math.max(mob.poisonTimer || 0, 6);
      mob.poisonDmg = Math.max(mob.poisonDmg || 0, Math.round(player.dmg * 0.12 * mob.poisonStacks));
    }
    if (hp.burn) { mob.burnTimer = Math.max(mob.burnTimer || 0, hp.burn); mob.burnDmg = Math.max(mob.burnDmg || 0, Math.round(player.dmg * 0.2)); }
    if (hp.chill) mob.chillTimer = Math.max(mob.chillTimer || 0, hp.chill);
    if (hp.frost && !(mob.frozenTimer > 0)) {
      mob.frostStacks = (mob.frostStacks || 0) + hp.frost;
      mob.frostTimer = FROST_SECONDS;
      mob.chillTimer = Math.max(mob.chillTimer || 0, 2);
      if (mob.frostStacks >= FROST_TO_FREEZE) {
        mob.frostStacks = 0;
        mob.frozenTimer = mob.isBoss ? BOSS_FREEZE_SECONDS : FREEZE_SECONDS;
        mob.frozenKind = 'ice';
        this.gs.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.8, text: '❄️ FROZEN', color: '#67e8f9', size: 15 }, inst);
      }
    }
    if (hp.stun) mob.attackCooldown = Math.max(mob.attackCooldown || 0, hp.stun);
    if (hp.haste && player.skillCooldowns) {
      for (const k of Object.keys(player.skillCooldowns)) if (player.skillCooldowns[k] > 0) player.skillCooldowns[k] = Math.max(0, player.skillCooldowns[k] - hp.haste);
    }
    if (hp.zap) {
      const mobs = [...this.gs.getMobsMap(zone).values()];
      let best = null, bestD = 4;
      for (const m of mobs) {
        if (m === mob || m.state === 'dead' || m.hp <= 0) continue;
        const d = Math.hypot(m.x - mob.x, m.y - mob.y);
        if (d < bestD) { best = m; bestD = d; }
      }
      if (best) {
        this.gs.emitZone(zone, 'skill_fx', { type: 'sp_skill', shape: 'chain', element: card.element, color: card.color, cardId: card.id, skillId: 'passive_' + card.id, name: card.passive.name, x: best.x, y: best.y, startX: mob.x, startY: mob.y, points: [{ x: mob.x, y: mob.y }, { x: best.x, y: best.y }] }, inst);
        this.gs.applyDamageToMob(player, best, Math.max(1, Math.round(damage * hp.zap)), false, true);
      }
    }
    // a bolt straight down out of the sky onto the target (Dragoon: Storm Rider)
    if (hp.skyBolt) {
      this.gs.emitZone(zone, 'skill_fx', { type: 'sp_skill', shape: 'rodStrike', sky: true, element: card.element, color: card.color, cardId: card.id, skillId: 'passive_' + card.id, name: card.passive.name, x: mob.x, y: mob.y, radius: 0.8, duration: 0.45 }, inst);
      this.gs.applyDamageToMob(player, mob, Math.max(1, Math.round(damage * hp.skyBolt)), false, true);
    }
    if (hp.echoHit) {
      const dmg = Math.max(1, Math.round(damage * hp.echoHit));
      setTimeout(() => {
        if (player.isDead || player.zone !== zone || mob.state === 'dead' || mob.hp <= 0) return;
        this.gs.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.9, text: '᚛ ECHO', color: card.color, size: 13 }, inst);
        this.gs.emitZone(zone, 'skill_fx', { type: 'sp_skill', shape: 'echo', element: card.element, color: card.color, cardId: card.id, skillId: 'passive_' + card.id, name: card.passive.name, x: mob.x, y: mob.y, duration: 0.6 }, inst);
        this.gs.applyDamageToMob(player, mob, dmg, false, true);
      }, 600);
    }
  }

  // Passive on-kill effects
  passiveOnKill(player: Player, mob: Mob) {
    const card = this.gs.spCard(player);
    const kill = card && card.passive && card.passive.kill;
    this.gs.gainUltCharge(player, ULT_GAIN_KILL);
    if (!kill) return;
    const zone = player.zone;
    const inst = player.zone === 'dungeon' ? player.dungeonInstanceId : null;
    if (kill.heal) player.hp = Math.min(player.maxHp, player.hp + Math.round(player.maxHp * kill.heal));
    if (kill.mana) player.mp = Math.min(player.maxMp, player.mp + Math.round(player.maxMp * kill.mana));
    if (kill.souls) { player.voidSouls = Math.min(VOID_SOUL_MAX, (player.voidSouls || 0) + kill.souls); player.voidSoulTimer = VOID_SOUL_SECONDS; }
    if (kill.cdr && player.skillCooldowns) {
      for (const k of Object.keys(player.skillCooldowns)) if (player.skillCooldowns[k] > 0) player.skillCooldowns[k] = Math.max(0, player.skillCooldowns[k] - kill.cdr);
    }
    const near = (r: any) => [...this.gs.getMobsMap(zone).values()].filter(m => m !== mob && m.state !== 'dead' && m.hp > 0 && Math.hypot(m.x - mob.x, m.y - mob.y) <= r);
    if (kill.spread && (mob.poisonTimer > 0 || mob.burnTimer > 0)) {
      for (const m of near(kill.spread)) {
        if (mob.poisonTimer > 0) {
          m.poisonStacks = Math.min(10, Math.max(m.poisonStacks || 0, mob.poisonStacks || 1));
          m.poisonTimer = Math.max(m.poisonTimer || 0, mob.poisonTimer);
          m.poisonDmg = Math.max(m.poisonDmg || 0, mob.poisonDmg || 0);
        }
        if (mob.burnTimer > 0) { m.burnTimer = Math.max(m.burnTimer || 0, mob.burnTimer); m.burnDmg = Math.max(m.burnDmg || 0, mob.burnDmg || 0); }
        m.lastHitBy = player.id;
      }
      this.gs.emitZone(zone, 'skill_fx', { type: 'sp_skill', shape: 'nova', element: card.element, color: card.color, cardId: card.id, skillId: 'passive_' + card.id, name: card.passive.name, x: mob.x, y: mob.y, radius: kill.spread }, inst);
    }
    // a kill burst never chains into further bursts
    if (kill.nova && !player.inKillNova) {
      player.inKillNova = true;
      try {
        this.gs.emitZone(zone, 'skill_fx', { type: 'sp_skill', shape: 'nova', element: card.element, color: card.color, cardId: card.id, skillId: 'passive_' + card.id, name: card.passive.name, x: mob.x, y: mob.y, radius: kill.nova.r }, inst);
        const dmg = Math.max(1, Math.round(player.dmg * kill.nova.dmg));
        for (const m of near(kill.nova.r)) this.gs.applyDamageToMob(player, m, dmg, false, true);
      } finally {
        player.inKillNova = false;
      }
    }
  }

  // Passive effects on melee damage taken from `mob`; returns the damage after them
  passiveOnHurt(player: Player, mob: Mob, damage: any, zone: any) {
    const pv = this.gs.spCard(player) && this.gs.spCard(player).passive;
    if (damage > 0) this.gs.gainUltCharge(player, (damage / Math.max(1, player.maxHp)) * ULT_GAIN_HURT);
    if (!pv) return damage;
    let k = pv.dmgTaken || 1;
    if (pv.lowHp && pv.lowHp.def && player.hp <= player.maxHp * pv.lowHp.below) k *= 1 - pv.lowHp.def;
    damage = Math.max(1, Math.round(damage * k));
    if (pv.reflect && mob && mob.state !== 'dead') this.gs.applyDamageToMob(player, mob, Math.max(1, Math.round(damage * pv.reflect)), false, true);
    if (pv.hurtShield && Math.random() < pv.hurtShield.chance) {
      const v = Math.round(player.maxHp * pv.hurtShield.share);
      player.shieldHp = (player.shieldHp || 0) + v;
      this.gs.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 1.0, text: `🛡️ ${pv.name} +${v}`, color: '#fde68a', size: 14 });
    }
    return damage;
  }

  // SP card passive leech (Berserker Bloodthirst) on `dealt` damage; Bloodlust multiplies it
  cardPassiveLeech(player: Player, dealt: any) {
    const card = player.spTransformed && player.equipment && player.equipment.sp && (SP.CARD_BY_ID as any)[player.equipment.sp.cardId];
    const passive = card && card.passive;
    if (!passive || !passive.leech || dealt <= 0) return;
    const thirst = player.bloodlust ? player.bloodlust.thirst || 1 : 1;
    const heal = Math.min(Math.round(player.maxHp * passive.cap * thirst), Math.max(1, Math.round(dealt * passive.leech * thirst)));
    player.hp = Math.min(player.maxHp, player.hp + heal);
    this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.6, text: `🩸 +${heal}`, color: '#f87171', size: 13 });
  }

  // Bannerman: the War Standard this hero planted, if it still stands where they are
  ownBanner(player: Player) {
    const b = player.banner;
    if (!b || Date.now() >= b.until || b.zone !== player.zone || b.instanceId !== (player.dungeonInstanceId || null)) return null;
    return b;
  }

  // Phoenix Oath passive: a lethal blow sets the hero alight instead (once per cd)
  phoenixRebirth(player: Player) {
    const card = player.spTransformed && player.equipment && player.equipment.sp && (SP.CARD_BY_ID as any)[player.equipment.sp.cardId];
    const rb = card && card.passive && card.passive.rebirth;
    if (!rb || Date.now() < (player.rebirthReadyAt || 0)) return false;
    player.rebirthReadyAt = Date.now() + rb.cd * 1000;
    player.hp = Math.round(player.maxHp * rb.hp);
    player.isDead = false;
    for (const m of this.gs.getMobsMap(player.zone, player).values()) {
      if (m.state === 'dead' || Math.hypot(m.x - player.x, m.y - player.y) > rb.r) continue;
      m.burnTimer = Math.max(m.burnTimer || 0, 4);
      m.burnDmg = Math.max(m.burnDmg || 0, Math.round(player.dmg * 0.3));
      this.gs.applyDamageToMob(player, m, Math.round(player.dmg * rb.dmg * SKILL_DAMAGE_SCALE), false);
    }
    this.gs.emitZone(player.zone, 'skill_fx', {
      type: 'sp_skill', shape: 'rebirth', x: player.x, y: player.y, radius: rb.r, element: card.element, color: card.color, cardId: card.id, skillId: 'sp_phoenix_rebirth', name: 'Rebirth'
    });
    this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 1.0, text: '🔥 REBIRTH!', color: '#fbbf24', size: 22 });
    return true;
  }

  // Buffs and debuffs on a hero, for the HUD tray: [{ k, n, i, t?, v?, d? }]
  // (k key, n name, i icon, t seconds left, v stacks / amount, d = debuff)
  heroBuffs(p: any) {
    const out = [];
    const timed = (k: any, n: any, i: any, t: any) => { if (t > 0) out.push({ k, n, i, t: Math.ceil(t) }); };
    for (const a of (Object.values(p.spToggles || {}) as any[])) out.push({ k: a.skill.id, n: a.skill.name, i: a.skill.icon || '✨' });
    if (p.bloodlust) timed('bloodlust', 'Bloodlust', '🔥', p.bloodlust.timer);
    timed('rage', 'Rage', '💢', p.berserkTimer);
    timed('fortress', 'Fortress', '🛡️', p.ironFortressTimer);
    timed('vanish', 'Vanish', '👤', p.smokeScreenTimer);
    timed('undying', 'Undying', '💀', p.undyingTimer);
    timed('haste', 'Haste', '💨', p.sprintTimer);
    if (p.shieldHp > 0) out.push({ k: 'shield', n: 'Shield', i: '🔰', v: Math.round(p.shieldHp) });
    // shown in 10% steps: an exact number would change every tick while it recharges
    // and rebuild the buff bar 25 times a second (the HP bar shows the exact value)
    if (p.esMax > 0) out.push({ k: 'es', n: 'Energy Shield', i: '💠', v: `${Math.round((p.es || 0) / p.esMax * 10) * 10}%` });
    // armor set 4-piece states
    if (p.set4) {
      const nowMs = Date.now();
      if (p.set4.wayfarer) {
        const cd = Math.max(0, ((p.secondWindReadyAt || 0) - nowMs) / 1000);
        out.push(cd > 0 ? { k: 'second_wind', n: 'Second Wind (cooldown)', i: '🌿', t: Math.ceil(cd), d: true } : { k: 'second_wind', n: 'Second Wind ready', i: '🌿' });
      }
      if (p.set4.stormcaller) out.push({ k: 'static', n: 'Static', i: '⚡', v: p.staticStacks || 0 });
      if (p.set4.eclipse && p.eclipsePhase) {
        const dusk = p.eclipsePhase === 'dusk';
        out.push({ k: 'eclipse', n: dusk ? 'Dusk (+15% DMG, leech)' : 'Dawn (+20% DEF, party heal)', i: dusk ? '🌑' : '🌕', t: Math.ceil(p.eclipseTimer || 0) });
      }
    }
    if (p.flowStacks > 0) out.push({ k: 'flow', n: 'Flow', i: '🌊', v: p.flowStacks, t: Math.ceil(p.flowTimer || 0) });
    if (p.voidSouls > 0) out.push({ k: 'souls', n: 'Souls', i: '👻', v: p.voidSouls, t: Math.ceil(p.voidSoulTimer || 0) });
    // variant warrior card states
    const now = Date.now();
    const left = (until: any) => (until || 0) > now ? (until - now) / 1000 : 0;
    if (p.heat > 0) out.push({ k: 'heat', n: 'Heat', i: '🌡️', v: Math.round(p.heat) });
    timed('overheat', 'Overheat', '🔥', left(p.overheatUntil));
    if (p.combo && p.combo.n > 0 && p.combo.until > now) out.push({ k: 'combo', n: 'Combo', i: '🪓', v: p.combo.n, t: Math.ceil(left(p.combo.until)) });
    timed('riposte', 'Riposte', '🛡️', left(p.parry && p.parry.until));
    if (this.gs.ownBanner(p)) timed('banner', 'War Standard', '🚩', left(p.banner.until));
    if (p.spTransformed && p.equipment && p.equipment.sp && p.equipment.sp.cardId === 'sp_phoenix_oath') {
      const cd = left(p.rebirthReadyAt);
      out.push(cd > 0 ? { k: 'rebirth', n: 'Rebirth (recharging)', i: '🪶', t: Math.ceil(cd), d: 1 } : { k: 'rebirth', n: 'Rebirth ready', i: '🪶' });
    }
    const DEBUFFS = { poison: ['Poison', '☠️'], burn: ['Burn', '🔥'], chill: ['Chill', '❄️'] };
    for (const e of p.statusEffects || []) {
      const [n, i] = (DEBUFFS as any)[e.type] || [e.type, '⚠️'];
      out.push({ k: 'd_' + e.type, n, i, t: Math.ceil(e.duration), d: 1 });
    }
    return out;
  }

  // Absorption layers on a hero, outermost first: shields (skills, set
  // effects) then the mage's Energy Shield. Returns the damage left for HP.
  absorbIncomingDamage(player: Player, damage: any, zone: any) {
    player.lastHitAt = Date.now();   // pauses the Energy Shield recharge
    if (player.shieldHp > 0 && damage > 0) {
      const absorbed = Math.min(player.shieldHp, damage);
      player.shieldHp -= absorbed;
      damage -= absorbed;
      this.gs.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 0.5, text: `🛡️ Absorbed -${absorbed}`, color: '#e2e8f0' });
    }
    if (player.es > 0 && damage > 0) {
      const soaked = Math.min(player.es, damage);
      player.es -= soaked;
      damage -= soaked;
      this.gs.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 0.5, text: `💠 -${Math.round(soaked)}`, color: '#67e8f9' });
      if (player.es <= 0) {
        this.gs.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 1.0, text: '💠 ENERGY SHIELD BROKEN', color: '#38bdf8', size: 15 });
      }
    }
    return damage;
  }
}
