// Specialist card skills and signatures: every spShape (strikes, novas, dashes, auras, summons, ...) in one dispatcher.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import { SP_SHAPE_HANDLERS, nextSpObjId } from '../skills/spShapeHandlers';
import * as SP from '../spCards';
import { SCORCH_MAX, SCORCH_SECONDS, FROST_TO_FREEZE, FROST_SECONDS, FREEZE_SECONDS, BOSS_FREEZE_SECONDS, CONDUCT_MAX, CONDUCT_SECONDS, CONDUCT_FORK_RANGE, CONDUCT_FORK_MAX, CONDUCT_FORK_SHARE, VOID_SOUL_MAX, VOID_SOUL_SECONDS, VOID_SOUL_BONUS, ECHO_DAMAGE, FRACTURE_MAX, FRACTURE_SECONDS, FRACTURE_STUN, HEAT_MAX, OVERHEAT_SECONDS, OVERHEAT_BONUS, RUNE_MAX, RUNE_POLL, RUNE_ARM_MS, RUNE_TRIGGER_R, COMBO_MAX, COMBO_SECONDS, COMBO_BONUS, DG_ROD_MAX, DG_ROD_SECONDS, DG_ROD_EVERY, DG_ROD_R, DG_ROD_MULT, DG_FENCE_RANGE, DG_FENCE_W, DG_FENCE_MULT, DG_OVERLOAD_R, DG_ARC_RANGE } from '../config/constants';

export class SpSkillSystem {
  constructor(private readonly gs: GameServer) {}

  // Run a card skill from its SP_SKILLS data (see the shape list in spCards.js)
  castSpSkill(player, skill, ctx) {
    const { slot, cooldown, runeId, skillData, mobsMap, applySkillDamage, computeDashVector, isEcho, isShadow, recall } = ctx;
    const zone = player.zone;
    const instanceId = player.dungeonInstanceId || null;
    // a Nightblade shadow casts from where it stands
    const px = ctx.origin ? ctx.origin.x : player.x, py = ctx.origin ? ctx.origin.y : player.y;
    const fxBase = { type: 'sp_skill', shape: skill.spShape, element: skill.element, color: skill.color, cardId: skill.cardId, rune: runeId, skillId: skill.id, name: skill.name };
    const emit = (data, first) => this.gs.emitZone(zone, 'skill_fx', first && !isEcho && !isShadow && !ctx.quiet
      ? { ...fxBase, ...data, skillSlot: slot, cooldown, playerId: player.id }
      : { ...fxBase, ...data });
    const alive = () => [...mobsMap.values()].filter(m => m.state !== 'dead');
    const within = (cx, cy, r) => alive().filter(m => Math.hypot(m.x - cx, m.y - cy) <= r);
    const nearest = (cx: number, cy: number, r: number, exclude: any = null) => {
      let best = null, bestD = r;
      for (const m of alive()) {
        if (exclude && exclude.has(m)) continue;
        const d = Math.hypot(m.x - cx, m.y - cy);
        if (d <= bestD) { best = m; bestD = d; }
      }
      return best;
    };

    let dealt = 0;
    const say = (x, y, text, color, size) => this.gs.emitZone(zone, 'floating_text', { x, y: y - 0.8, text, color, size });
    // Soul harvesters (Void Archon, Duskblade): every Soul empowers its skills; Devour spends them
    const isSoulCard = skill.souls !== undefined || skill.devour !== undefined;
    const souls = isSoulCard ? (player.voidSouls || 0) : 0;
    let soulMult = 1 + VOID_SOUL_BONUS * souls;
    if (skill.devour && souls > 0) {
      soulMult *= 1 + 0.12 * souls;
      const heal = Math.round(player.maxHp * skill.devour * souls);
      player.hp = Math.min(player.maxHp, player.hp + heal);
      say(px, py, `🌑 DEVOUR x${souls} (+${heal} HP)`, '#c084fc', 17);
      player.voidSouls = 0;
    }
    const gainSouls = (n) => {
      player.voidSouls = Math.min(VOID_SOUL_MAX, (player.voidSouls || 0) + n);
      player.voidSoulTimer = VOID_SOUL_SECONDS;
    };
    // Warchief Combo: a skill different from the last one stacks Combo,
    // repeating one drops it; a finisher cashes the whole chain in
    let comboMult = 1;
    if (skill.combo && !isEcho && !isShadow) {
      const nowC = Date.now();
      const c = player.combo && player.combo.until > nowC ? player.combo : { n: 0, last: null };
      let n = c.last === skill.id ? 0 : Math.min(COMBO_MAX, c.n + 1);
      if (skill.comboGain) n = Math.min(COMBO_MAX, n + skill.comboGain);
      comboMult = 1 + COMBO_BONUS * n;
      if (skill.finisher && n > 0) {
        comboMult *= 1 + skill.finisher * n;
        say(px, py, `🪓 FINISHER x${n}`, '#f97316', 18);
        n = 0;
      } else if (c.last === skill.id && c.n > 1) {
        say(px, py, 'COMBO BROKEN', '#94a3b8', 14);
      } else if (n > 1) {
        say(px, py, `🪓 COMBO x${n}`, '#fb923c', 13 + n);
      }
      player.combo = { n, last: skill.id, until: nowC + COMBO_SECONDS * 1000 };
    }
    // Reaver: Overheat powers every skill of the card; Vent spends the Heat
    let heatMult = 1;
    if (skill.cardId === 'sp_reaver' && player.overheatUntil > Date.now()) heatMult = 1 + OVERHEAT_BONUS;
    if (skill.vent && player.heat > 0 && !isEcho && !isShadow) {
      heatMult *= 1 + skill.vent * player.heat / 10;
      say(px, py, `🔥 VENT ${Math.round(player.heat)} HEAT`, '#fb923c', 17);
      player.heat = 0;
    }
    // Duskblade Doom: the brand replays a share of what it soaked up when it ends
    const burstDoom = (mob, brand) => {
      if (!mob || mob.doom !== brand) return;
      mob.doom = null;
      const dmg = Math.round(brand.stored * brand.share);
      if (dmg <= 0) return;
      emit({ shape: 'doom', x: mob.x, y: mob.y, radius: 1.8, burst: true }, false);
      if (mob.state !== 'dead' && mob.hp > 0) {
        this.gs.applyDamageToMob(player, mob, dmg, false);
        say(mob.x, mob.y, `☠️ DOOM -${dmg}`, '#c084fc', 18);
      } else {
        // the brand outlives its bearer and bursts onto whoever stood beside it
        for (const m of within(mob.x, mob.y, 2.5)) this.gs.applyDamageToMob(player, m, Math.round(dmg * 0.5), false);
        say(mob.x, mob.y, '☠️ DOOM SPREADS', '#c084fc', 16);
      }
    };
    const hit = (mob, mult = 1, fromX = px, fromY = py) => {
      if (!mob || mob.state === 'dead') return;
      let m = skill.dmgMult * mult * soulMult * comboMult * heatMult;
      // Tempest Caller: Conductor marks held by the target when this skill lands
      const conductNow = mob.conductTimer > 0 ? (mob.conduct || 0) : 0;
      // Gravelord: shatter the Fracture cracks for bonus damage and a stun
      let shatterStun = 0;
      if (skill.shatterEarth && mob.fracture > 0 && mob.fractureUntil > Date.now()) {
        m *= 1 + skill.shatterEarth * mob.fracture;
        shatterStun = FRACTURE_STUN * mob.fracture;
        say(mob.x, mob.y, `🪨 SHATTER x${mob.fracture}`, '#a3e635', 16);
        mob.fracture = 0;
      }
      // Pyromancer: Combust detonates Scorch, Fire Chain feeds on it
      if (skill.combust && mob.scorchStacks > 0) {
        m *= 1 + skill.combust * mob.scorchStacks;
        say(mob.x, mob.y, `💥 COMBUST x${mob.scorchStacks}`, '#fb923c', 16);
        mob.scorchStacks = 0;
      }
      if (skill.scorchBonus && mob.scorchStacks > 0) m *= 1 + skill.scorchBonus * mob.scorchStacks;
      // Cryo Sage: Shatter a frozen enemy for big damage, which thaws it
      if (skill.shatterFrozen && mob.frozenTimer > 0 && mob.frozenKind === 'ice') {
        m *= skill.shatterFrozen;
        mob.frozenTimer = 0;
        say(mob.x, mob.y, '🧊 SHATTER!', '#a5f3fc', 17);
      }
      if (skill.backstab) {
        const isStealthed = player.smokeScreenTimer > 0;
        let isBack = isStealthed;
        if (!isBack && mob.facing) {
          const dx = mob.x - px, dy = mob.y - py;
          const facingVecs = { 'E': [1, 0], 'SE': [0.7, 0.7], 'S': [0, 1], 'SW': [-0.7, 0.7], 'W': [-1, 0], 'NW': [-0.7, -0.7], 'N': [0, -1], 'NE': [0.7, -0.7] };
          const fv = facingVecs[mob.facing] || [0, 1];
          if (dx * fv[0] + dy * fv[1] > 0.15) isBack = true;
        }
        if (isBack) {
          m *= 2.8;
          mob.shadowMarkTimer = 6.0;
          this.gs.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.8, text: '🗡️ BACKSTAB CRIT!', color: '#c084fc', size: 18 });
        } else {
          mob.shadowMarkTimer = 4.0;
        }
      }
      if (skill.execute && mob.maxHp && mob.hp <= mob.maxHp * skill.execute[0]) m *= skill.execute[1];
      if (skill.furyBonus) {
        const missingHp = Math.max(0, 1 - (player.hp / Math.max(1, player.maxHp)));
        m *= 1 + skill.furyBonus * missingHp;
      }
      if (skill.shatter && mob.chillTimer > 0) m *= skill.shatter;
      const before = mob.hp;
      if (skill.burn) { mob.burnTimer = skill.burn; mob.burnDmg = Math.max(mob.burnDmg || 0, Math.round(player.dmg * 0.2)); }
      if (skill.chill) mob.chillTimer = Math.max(mob.chillTimer || 0, skill.chill);
      if (skill.poisonStacks) {
        mob.poisonStacks = Math.min(10, (mob.poisonStacks || 0) + skill.poisonStacks);
        mob.poisonTimer = Math.max(mob.poisonTimer || 0, skill.poison || 6.0);
        mob.poisonDmg = Math.max(mob.poisonDmg || 0, Math.round(player.dmg * 0.12 * mob.poisonStacks));
        this.gs.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.6, text: `🧪 POISON x${mob.poisonStacks}`, color: '#4ade80' });
      } else if (skill.poison) {
        mob.poisonTimer = skill.poison;
        mob.poisonDmg = Math.max(mob.poisonDmg || 0, Math.round(player.dmg * 0.15));
      }
      if (skill.staticCharge) {
        mob.staticCharge = skill.staticCharge;
        this.gs.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.6, text: '⚡ STATIC', color: '#facc15' });
      }
      applySkillDamage(mob, Math.round(player.dmg * m), true);
      dealt += Math.max(0, before - Math.max(0, mob.hp));
      const stillUp = mob.state !== 'dead' && mob.hp > 0;
      if (stillUp && skill.scorch) {
        mob.scorchStacks = Math.min(SCORCH_MAX, (mob.scorchStacks || 0) + skill.scorch);
        mob.scorchTimer = SCORCH_SECONDS;
      }
      if (stillUp && skill.frost && !(mob.frozenTimer > 0)) {
        mob.frostStacks = (mob.frostStacks || 0) + skill.frost;
        mob.frostTimer = FROST_SECONDS;
        mob.chillTimer = Math.max(mob.chillTimer || 0, 2);
        if (mob.frostStacks >= FROST_TO_FREEZE) {
          mob.frostStacks = 0;
          mob.frozenTimer = mob.isBoss ? BOSS_FREEZE_SECONDS : FREEZE_SECONDS;
          mob.frozenKind = 'ice';
          say(mob.x, mob.y, '❄️ FROZEN', '#67e8f9', 16);
        }
      }
      if (stillUp && skill.stasis) {
        mob.frozenTimer = Math.max(mob.frozenTimer || 0, mob.isBoss ? skill.stasis * 0.4 : skill.stasis);
        mob.frozenKind = 'time';
      }
      if (stillUp && skill.stun) mob.attackCooldown = Math.max(mob.attackCooldown || 0, skill.stun);
      if (stillUp && shatterStun) mob.attackCooldown = Math.max(mob.attackCooldown || 0, shatterStun);
      if (stillUp && skill.fracture) {
        const cracks = mob.fractureUntil > Date.now() ? mob.fracture || 0 : 0;
        mob.fracture = Math.min(FRACTURE_MAX, cracks + skill.fracture);
        mob.fractureUntil = Date.now() + FRACTURE_SECONDS * 1000;
      }
      if (stillUp && skill.doom && !(mob.doom && mob.doom.until > Date.now())) {
        const brand = { owner: player.id, stored: 0, share: skill.doom.share, until: Date.now() + skill.doom.delay * 1000 };
        mob.doom = brand;
        emit({ shape: 'doom', x: mob.x, y: mob.y, radius: 0.9, duration: skill.doom.delay, followMob: mob.id }, false);
        later(skill.doom.delay, () => burstDoom(mob, brand));
      }
      if (skill.souls) gainSouls(skill.souls);
      else if (!stillUp && isSoulCard) gainSouls(1);
      // Conductor: lightning forks from a marked target into the marked enemies around it
      if (skill.fork && conductNow > 0) {
        const forks = alive()
          .filter(o => o !== mob && o.conductTimer > 0 && (o.conduct || 0) > 0 && Math.hypot(o.x - mob.x, o.y - mob.y) <= CONDUCT_FORK_RANGE)
          .sort((a, b) => Math.hypot(a.x - mob.x, a.y - mob.y) - Math.hypot(b.x - mob.x, b.y - mob.y))
          .slice(0, CONDUCT_FORK_MAX);
        if (forks.length) {
          emit({ quiet: true, shape: 'chain', x: mob.x, y: mob.y, startX: mob.x, startY: mob.y, points: forks.map(o => ({ x: o.x, y: o.y })) }, false);
          const forkDmg = Math.round(player.dmg * skill.dmgMult * mult * CONDUCT_FORK_SHARE * conductNow);
          for (const o of forks) {
            this.gs.applyDamageToMob(player, o, forkDmg, false);
            say(o.x, o.y, `⚡ ARC -${forkDmg}`, '#fde047', 14);
          }
        }
      }
      // Thunderclap: the thunder arrives late. The marks are spent and the target booms after a beat
      if (skill.clap && conductNow > 0) {
        mob.conduct = 0;
        const cx = mob.x, cy = mob.y;
        say(cx, cy, `🌩️ THUNDER x${conductNow}`, '#facc15', 15);
        later(skill.clap.delay, () => {
          emit({ shape: 'nova', x: cx, y: cy, radius: skill.clap.r, burst: true }, false);
          const clapDmg = Math.round(player.dmg * skill.clap.mult * conductNow);
          for (const o of within(cx, cy, skill.clap.r)) this.gs.applyDamageToMob(player, o, clapDmg, false);
          say(cx, cy, `🌩️ THUNDERCLAP -${clapDmg}`, '#fef08a', 18);
        });
      }
      // mark the target (after the fork/clap so a fresh mark never feeds its own cast)
      if (stillUp && skill.conduct) {
        const held = mob.conductTimer > 0 ? (mob.conduct || 0) : 0;
        mob.conduct = Math.min(CONDUCT_MAX, held + skill.conduct);
        mob.conductTimer = CONDUCT_SECONDS;
        say(mob.x, mob.y - 0.2, `⚡ CONDUCTOR x${mob.conduct}`, '#facc15', 12 + mob.conduct);
      }
      if (skill.knock && mob.state !== 'dead') {
        const d = Math.hypot(mob.x - fromX, mob.y - fromY) || 1;
        const kx = mob.x + ((mob.x - fromX) / d) * skill.knock;
        const ky = mob.y + ((mob.y - fromY) / d) * skill.knock;
        if (!this.gs.isColliding(kx, ky, zone)) { mob.x = kx; mob.y = ky; }
      }
    };
    const settleLeech = () => {
      if (!skill.leech || dealt <= 0) return;
      const heal = Math.min(Math.round(player.maxHp * 0.1), Math.max(1, Math.round(dealt * skill.leech)));
      player.hp = Math.min(player.maxHp, player.hp + heal);
      this.gs.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 0.6, text: `+${heal} HP`, color: '#4ade80' });
      dealt = 0;
    };
    // Later waves run on a timer; skip them if the hero left, died or changed instance
    const later = (seconds, fn) => setTimeout(() => {
      const p = this.gs.players.get(player.id);
      if (!p || p !== player || p.isDead || p.zone !== zone || (p.dungeonInstanceId || null) !== instanceId) return;
      this.gs.runAs(player.id, () => { fn(); settleLeech(); });
    }, seconds * 1000);

    // Aim: toward the target point (or the dash direction for movement skills)
    const rawTx = Number.isFinite(skillData.targetX) ? skillData.targetX : px;
    const rawTy = Number.isFinite(skillData.targetY) ? skillData.targetY : py;
    const td = Math.hypot(rawTx - px, rawTy - py);
    const dir = td > 0.3 && !skill.isDash
      ? { normX: (rawTx - px) / td, normY: (rawTy - py) / td }
      : computeDashVector();
    const range = skill.range || 7;
    const aimX = td > range ? px + dir.normX * range : (td > 0.3 ? rawTx : px + dir.normX * Math.min(range, 3));
    const aimY = td > range ? py + dir.normY * range : (td > 0.3 ? rawTy : py + dir.normY * Math.min(range, 3));

    // Walk from (x0, y0) along (nx, ny) until a wall, returning the furthest free point
    const ray = (x0: number, y0: number, nx: number, ny: number, len: number, radius: number = 0.35) => {
      let ex = x0, ey = y0;
      for (let d = 0.25; d <= len; d += 0.25) {
        const tx = x0 + nx * d, ty = y0 + ny * d;
        if (this.gs.isColliding(tx, ty, zone, radius)) break;
        ex = tx; ey = ty;
      }
      return { x: ex, y: ey };
    };
    // Move the hero along dir (a shadow's copy only measures the path)
    const travel = (len) => {
      const { x: nx, y: ny } = ray(px, py, dir.normX, dir.normY, len);
      if (isShadow) return { x: nx, y: ny };
      player.x = nx; player.y = ny;
      player.targetX = null; player.targetY = null;
      player.facing = this.gs.calculateFacing(px, py, nx, ny);
      return { x: nx, y: ny };
    };

    // Rune Knight glyphs: carved at a spot, armed after a beat, burst when an
    // enemy steps on them (or all at once on Invocation)
    const burstRune = (g, mult) => {
      if (g.spent) return;
      g.spent = true;
      const sk = g.skill;
      emit({ shape: 'rune', burst: true, kind: sk.kind, skillId: sk.id, x: g.x, y: g.y, radius: sk.r * (mult > 1 ? 1.15 : 1), clearObj: g.id }, false);
      // the ground stays inscribed for a while, burning anything that walks in
      if (sk.dot && sk.dot.linger) {
        const sr = sk.r * 0.85;
        emit({ shape: 'rune', scar: true, kind: sk.kind, skillId: sk.id, x: g.x, y: g.y, radius: sr, duration: sk.dot.linger }, false);
        for (let k = 1; k * sk.dot.every <= sk.dot.linger + 0.01; k++) later(k * sk.dot.every, () => runeDot(sk, g.x, g.y, sr));
      }
      for (const m of within(g.x, g.y, sk.r * (mult > 1 ? 1.15 : 1))) {
        if (sk.stun) m.attackCooldown = Math.max(m.attackCooldown || 0, sk.stun);
        if (sk.stun) m.chillTimer = Math.max(m.chillTimer || 0, sk.stun);
        if (sk.chill) m.chillTimer = Math.max(m.chillTimer || 0, sk.chill);
        const before = m.hp;
        applySkillDamage(m, Math.round(player.dmg * sk.dmgMult * mult), true);
        dealt += Math.max(0, before - Math.max(0, m.hp));
      }
    };
    // Glyph damage over time (sk.dot): a tick of rune damage on everything in the glyph's area.
    // Scales with the card level like the burst does (dmgMult over the base dmg).
    const runeDot = (sk, x, y, r) => {
      const lvl = sk.dmg ? (sk.dmgMult || sk.dmg) / sk.dmg : 1;
      const dmg = Math.max(1, Math.round(player.dmg * sk.dot.mult * lvl));
      for (const m of within(x, y, r)) {
        this.gs.applyDamageToMob(player, m, dmg, false, true);
        if (m.state === 'dead' || m.hp <= 0) continue;
        if (sk.kind === 'frost') m.chillTimer = Math.max(m.chillTimer || 0, 1.0);
        if (sk.kind === 'bind') m.chillTimer = Math.max(m.chillTimer || 0, 0.6);
      }
    };
    const placeRune = (sk, x, y, first) => {
      const nowR = Date.now();
      const live = (player.runeGlyphs || []).filter(g => !g.spent && g.until > nowR && g.zone === zone && g.instanceId === instanceId);
      while (live.length >= RUNE_MAX) {
        const old = live.shift();
        old.spent = true;
        emit({ shape: 'rune', clearObj: old.id, x: old.x, y: old.y, radius: 0 }, false);
      }
      const g = { id: 'g' + nextSpObjId(), skill: sk, x, y, until: nowR + sk.dur * 1000, armAt: nowR + RUNE_ARM_MS, spent: false, zone, instanceId };
      live.push(g);
      player.runeGlyphs = live;
      emit({ shape: 'rune', kind: sk.kind, skillId: sk.id, name: sk.name, x, y, radius: sk.r, duration: sk.dur, objId: g.id }, first);
      const ticks = Math.ceil(sk.dur / RUNE_POLL);
      for (let i = 1; i <= ticks; i++) {
        later(i * RUNE_POLL, () => {
          if (g.spent) return;
          if (Date.now() >= g.until) { g.spent = true; return; }
          // armed: everything walking into the glyph's area takes rune damage over time
          if (sk.dot && Date.now() >= g.armAt && i % Math.max(1, Math.round(sk.dot.every / RUNE_POLL)) === 0) runeDot(sk, g.x, g.y, sk.r);
          if (Date.now() >= g.armAt && within(g.x, g.y, RUNE_TRIGGER_R).length) burstRune(g, 1);
        });
      }
    };

    // ---- Dragoon Lightning Rods: planted lances the sky keeps striking (player.dgRods)
    const liveRods = () => {
      const now = Date.now();
      player.dgRods = (player.dgRods || []).filter(rd => rd.until > now && rd.zone === zone && rd.instanceId === instanceId);
      return player.dgRods;
    };
    const rodDamage = (m, mult, stun = 0) => {
      this.gs.applyDamageToMob(player, m, Math.max(1, Math.round(player.dmg * mult)), false, true);
      if (stun && m.state !== 'dead' && m.hp > 0) m.attackCooldown = Math.max(m.attackCooldown || 0, stun);
    };
    const clearRod = (rod) => emit({ shape: 'rod', clearObj: rod.objId, radius: 0 }, false);
    const strikeRod = (rod) => {
      const rods = liveRods();
      const i = rods.indexOf(rod);
      if (i < 0) return;
      emit({ shape: 'rodStrike', x: rod.x, y: rod.y, radius: DG_ROD_R, duration: 0.5 }, false);
      within(rod.x, rod.y, DG_ROD_R).forEach(m => rodDamage(m, DG_ROD_MULT));
      // the arc fence to the next rod planted after this one
      const next = rods[i + 1];
      if (next && Math.hypot(next.x - rod.x, next.y - rod.y) <= DG_FENCE_RANGE) {
        emit({ shape: 'fence', startX: rod.x, startY: rod.y, x: next.x, y: next.y, duration: 0.55 }, false);
        for (const m of alive()) {
          if (this.gs.distToSegment(m.x, m.y, rod.x, rod.y, next.x, next.y) > DG_FENCE_W) continue;
          rodDamage(m, DG_FENCE_MULT);
          if (m.state !== 'dead') m.chillTimer = Math.max(m.chillTimer || 0, 0.8);
        }
      }
    };
    // thrown: the lance flew there (Storm Lance), so it does not drop out of the sky
    const plantRod = (x, y, thrown = false) => {
      if (isShadow) return;
      const rods = liveRods();
      while (rods.length >= DG_ROD_MAX) clearRod(rods.shift());
      const rod = { objId: 'r' + nextSpObjId(), x, y, until: Date.now() + DG_ROD_SECONDS * 1000, zone, instanceId };
      rods.push(rod);
      emit({ shape: 'rod', x, y, objId: rod.objId, duration: DG_ROD_SECONDS, ownerId: player.id, thrown }, false);
      for (let k = 1; k * DG_ROD_EVERY <= DG_ROD_SECONDS + 0.01; k++) later(k * DG_ROD_EVERY, () => strikeRod(rod));
    };
    // every rod picked is struck by a giant bolt at once and spent
    const overloadRods = (mult, pick = (rd) => true) => {
      const rods = liveRods();
      const spent = rods.filter(pick);
      if (!spent.length) return;
      say(spent[0].x, spent[0].y, `⚡ OVERLOAD x${spent.length}`, '#fde047', 17);
      for (const rod of spent) {
        emit({ shape: 'overload', x: rod.x, y: rod.y, radius: DG_OVERLOAD_R, duration: 0.9 }, false);
        clearRod(rod);
        within(rod.x, rod.y, DG_OVERLOAD_R).forEach(m => rodDamage(m, mult, 0.5));
      }
      player.dgRods = rods.filter(rd => !spent.includes(rd));
    };
    // each rod throws a bolt at the enemy nearest to it
    const rodArcs = (mult) => {
      for (const rod of liveRods()) {
        const m = nearest(rod.x, rod.y, DG_ARC_RANGE);
        if (!m) continue;
        emit({ shape: 'chain', x: m.x, y: m.y, startX: rod.x, startY: rod.y, points: [{ x: rod.x, y: rod.y }, { x: m.x, y: m.y }], fromRod: true, duration: 0.45 }, false);
        hit(m, mult, rod.x, rod.y);
      }
    };

    let spot = null; // where a lingering field (skill.field) settles
    const spCtx = {
      gs: this.gs, player, skill, ctx,
      slot, cooldown, runeId, skillData, mobsMap, applySkillDamage, computeDashVector, isEcho, isShadow, recall, zone, instanceId, px, py, fxBase, emit, alive, within, nearest, say, isSoulCard, souls, gainSouls, burstDoom, hit, settleLeech, later, rawTx, rawTy, td, dir, range, aimX, aimY, ray, travel, burstRune, runeDot, placeRune, liveRods, rodDamage, clearRod, strikeRod, plantRod, overloadRods, rodArcs,
      get dealt() { return dealt; }, set dealt(v) { dealt = v; },
      get soulMult() { return soulMult; }, set soulMult(v) { soulMult = v; },
      get comboMult() { return comboMult; }, set comboMult(v) { comboMult = v; },
      get heatMult() { return heatMult; }, set heatMult(v) { heatMult = v; },
      get spot() { return spot; }, set spot(v) { spot = v; }
    };
    const shapeHandler = Object.prototype.hasOwnProperty.call(SP_SHAPE_HANDLERS, skill.spShape) ? SP_SHAPE_HANDLERS[skill.spShape] : null;
    if (shapeHandler) shapeHandler(spCtx);

    // Dragoon: every Lightning Rod answers the cast with a bolt
    if (skill.rodArc) rodArcs(skill.rodArc);
    // Lingering ground: burning crater / fire trail / gravity well, ticking on its own
    if (skill.field && spot) {
      const F = skill.field;
      const line = spot.x1 !== undefined;
      const cx = line ? (spot.x0 + spot.x1) / 2 : spot.x, cy = line ? (spot.y0 + spot.y1) / 2 : spot.y;
      emit(line
        ? { shape: 'field', startX: spot.x0, startY: spot.y0, x: spot.x1, y: spot.y1, radius: F.r, duration: F.dur, pull: !!F.pull }
        : { shape: 'field', x: cx, y: cy, radius: F.r, duration: F.dur, pull: !!F.pull }, false);
      const ticks = Math.round(F.dur / F.every);
      for (let i = 1; i <= ticks; i++) {
        later(i * F.every, () => {
          const victims = line
            ? alive().filter(m => this.gs.distToSegment(m.x, m.y, spot.x0, spot.y0, spot.x1, spot.y1) <= F.r)
            : within(cx, cy, F.r);
          for (const m of victims) {
            if (F.pull) {
              const nx = cx + (m.x - cx) * (1 - F.pull), ny = cy + (m.y - cy) * (1 - F.pull);
              if (!this.gs.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
            }
            hit(m, F.mult, cx, cy);
          }
        });
      }
    }
    // Singularity: after a beat, everything nearby falls into the point and is crushed
    if (skill.implode) {
      const I = skill.implode;
      later(I.delay, () => {
        emit({ shape: 'pull', x: aimX, y: aimY, radius: I.r, implode: true }, false);
        for (const m of within(aimX, aimY, I.r)) {
          const nx = aimX + (m.x - aimX) * 0.2, ny = aimY + (m.y - aimY) * 0.2;
          if (!this.gs.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
          hit(m, I.mult, aimX, aimY);
        }
      });
    }
    // a shadow's copy only deals damage: no self buffs, cooldown cuts or echoes
    if (isShadow) {
      settleLeech();
      return;
    }
    // Chronomancer Echo: the whole skill replays later at reduced strength
    if (skill.echo && !isEcho) {
      later(skill.echo, () => {
        say(aimX, aimY, '⏳ ECHO', '#fde68a', 15);
        const echoSkill = Object.assign({}, skill, {
          dmgMult: skill.dmgMult * ECHO_DAMAGE, echo: 0, heal: 0, mana: 0, shield: 0, fortress: 0, haste: 0, sprint: 0, smoke: 0
        });
        this.gs.castSpSkill(player, echoSkill, Object.assign({}, ctx, { skillData: Object.assign({}, skillData, { targetX: aimX, targetY: aimY }), isEcho: true }));
      });
    }
    // Reaver Heat: at 100 the hero Overheats
    if (skill.heat && !(player.overheatUntil > Date.now())) {
      player.heat = Math.min(HEAT_MAX, (player.heat || 0) + skill.heat);
      player.heatAt = Date.now();
      if (player.heat >= HEAT_MAX) {
        player.heat = 0;
        player.overheatUntil = Date.now() + OVERHEAT_SECONDS * 1000;
        say(player.x, player.y - 0.3, '🔥 OVERHEAT!', '#f97316', 20);
        emit({ shape: 'aura', x: player.x, y: player.y, radius: 2.4 }, false);
      }
    }
    if (skill.parry) {
      player.parry = { until: Date.now() + skill.parry * 1000, riposte: skill.riposte || 2 };
      say(player.x, player.y - 0.3, '🛡️ RIPOSTE STANCE', '#fde68a', 16);
    }
    if (skill.rekindle) {
      player.rebirthReadyAt = 0;
      say(player.x, player.y - 0.3, '🔥 REBIRTH READY', '#fbbf24', 16);
    }
    if (skill.haste && player.skillCooldowns) {
      for (const k of Object.keys(player.skillCooldowns)) {
        if (k !== slot && player.skillCooldowns[k] > 0) player.skillCooldowns[k] = Math.max(0, player.skillCooldowns[k] - skill.haste);
      }
    }

    // Self effects
    const buffs = [];
    if (skill.haste) buffs.push(`HASTE -${skill.haste}s`);
    if (skill.cleanse) {
      player.statusEffects = [];
      buffs.push('CLEANSED');
    }
    if (skill.flowGain) {
      player.flowStacks = Math.min(5, (player.flowStacks || 0) + skill.flowGain);
      player.flowTimer = 5.0;
      buffs.push(`FLOW x${player.flowStacks}`);
    }
    if (skill.invuln) {
      player.smokeScreenTimer = Math.max(player.smokeScreenTimer || 0, skill.invuln);
    }
    if (skill.hpCost) player.hp = Math.max(1, player.hp - Math.round(player.hp * skill.hpCost));
    if (skill.undying) { player.undyingTimer = Math.max(player.undyingTimer || 0, skill.undying); buffs.push('UNDYING RAGE'); }
    if (skill.berserk) { player.berserkTimer = Math.max(player.berserkTimer || 0, skill.berserk); buffs.push('RAGE'); }
    if (skill.bloodlust) {
      const b = skill.bloodlust;
      player.bloodlust = { timer: b.dur, rage: b.rage, atkSpeed: b.atkSpeed, thirst: b.thirst };
      this.gs.recalculatePlayerStats(player);
      buffs.push('BLOODLUST');
    }
    if (skill.fortress) { player.ironFortressTimer = Math.max(player.ironFortressTimer || 0, skill.fortress); buffs.push('FORTRESS'); }
    if (skill.sprint) player.sprintTimer = Math.max(player.sprintTimer || 0, skill.sprint);
    if (skill.smoke) { player.smokeScreenTimer = Math.max(player.smokeScreenTimer || 0, skill.smoke); buffs.push('VANISH'); }
    if (skill.shield) { const v = Math.round(player.maxHp * skill.shield); player.shieldHp = (player.shieldHp || 0) + v; buffs.push(`+${v} SHIELD`); }
    if (skill.heal) { const v = Math.round(player.maxHp * skill.heal); player.hp = Math.min(player.maxHp, player.hp + v); buffs.push(`+${v} HP`); }
    if (skill.mana) player.mp = Math.min(player.maxMp, player.mp + Math.round(player.maxMp * skill.mana));
    if (buffs.length && !isEcho) {
      this.gs.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 0.8, text: `${skill.name.toUpperCase()} (${buffs.join(' / ')})`, color: skill.color || '#e2e8f0' });
    }
    if (isSoulCard && player.voidSouls > 0 && !isEcho) say(player.x, player.y - 0.3, `👻 SOULS ${player.voidSouls}/${VOID_SOUL_MAX}`, '#c084fc', 13);
    settleLeech();
    if (skill.haste || skill.spShape === 'rewind') {
      const socket = this.gs.io.sockets.sockets.get(player.id);
      if (socket) socket.emit('player_updated', player);
    }
  }
}
