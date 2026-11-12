// Specialist card skills and signatures: every spShape (strikes, novas, dashes, auras, summons, ...) in one dispatcher.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import * as SP from '../spCards';
import { SCORCH_MAX, SCORCH_SECONDS, FROST_TO_FREEZE, FROST_SECONDS, FREEZE_SECONDS, BOSS_FREEZE_SECONDS, CONDUCT_MAX, CONDUCT_SECONDS, CONDUCT_FORK_RANGE, CONDUCT_FORK_MAX, CONDUCT_FORK_SHARE, VOID_SOUL_MAX, VOID_SOUL_SECONDS, VOID_SOUL_BONUS, ECHO_DAMAGE, FRACTURE_MAX, FRACTURE_SECONDS, FRACTURE_STUN, HEAT_MAX, OVERHEAT_SECONDS, OVERHEAT_BONUS, RUNE_MAX, RUNE_POLL, RUNE_ARM_MS, RUNE_TRIGGER_R, COMBO_MAX, COMBO_SECONDS, COMBO_BONUS, DG_ROD_MAX, DG_ROD_SECONDS, DG_ROD_EVERY, DG_ROD_R, DG_ROD_MULT, DG_FENCE_RANGE, DG_FENCE_W, DG_FENCE_MULT, DG_OVERLOAD_R, DG_ARC_RANGE } from '../config/constants';
let spObjSeq = 0; // ids for placed card objects (glyphs, banners, lances) so the client can clear them

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
      const g = { id: 'g' + (++spObjSeq), skill: sk, x, y, until: nowR + sk.dur * 1000, armAt: nowR + RUNE_ARM_MS, spent: false, zone, instanceId };
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
      const rod = { objId: 'r' + (++spObjSeq), x, y, until: Date.now() + DG_ROD_SECONDS * 1000, zone, instanceId };
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
    switch (skill.spShape) {
      case 'aura': {
        // toggled on here; tickSpToggles pays the upkeep and strikes every frame after
        if (!player.spToggles) player.spToggles = {};
        player.spToggles[skill.id] = { skill, clock: 0 };
        emit({ x: px, y: py, radius: skill.r || 1.4, spin: !!skill.spin }, true);
        say(px, py, `${skill.icon || '✨'} ${skill.name.toUpperCase()} ON`, skill.color || '#ef4444', 16);
        break;
      }
      case 'rewind': {
        // back to the oldest sample within 'back' seconds
        const trail = player.timeTrail || [];
        const want = Date.now() - (skill.back || 3) * 1000;
        const past = trail.find(t => t.t >= want) || trail[0];
        if (past && !this.gs.isColliding(past.x, past.y, zone)) {
          player.x = past.x; player.y = past.y;
          player.targetX = null; player.targetY = null;
          if (past.hp > player.hp) player.hp = Math.min(player.maxHp, past.hp);
        }
        emit({ startX: px, startY: py, x: player.x, y: player.y, radius: 1.2 }, true);
        say(player.x, player.y, '⏪ REWIND', '#fde68a', 17);
        player.timeTrail = [];
        break;
      }
      case 'nova':
      case 'buff': {
        emit({ x: px, y: py, radius: skill.r || 1.4 }, true);
        if (skill.provoke) {
          for (const m of within(px, py, skill.r)) {
            const nx = px + (m.x - px) * (1 - skill.provoke), ny = py + (m.y - py) * (1 - skill.provoke);
            if (!m.isBoss && !this.gs.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
            m.targetPlayerId = player.id;
            m.state = 'chase';
          }
          say(px, py, '📯 CHALLENGE!', '#fde68a', 17);
        }
        if (skill.dmg) within(px, py, skill.r).forEach(m => hit(m));
        if (skill.reap) {
          // Devour: every Doom brand of this hero bursts now
          for (const m of alive()) if (m.doom && m.doom.owner === player.id) burstDoom(m, m.doom);
        }
        break;
      }
      case 'fault': {
        // the crack crawls forward a segment at a time; each enemy cracks once
        const n = skill.n || 5, step = skill.step || 1;
        const pts = [];
        for (let i = 1; i <= n; i++) pts.push(ray(px, py, dir.normX, dir.normY, i * step, 0.3));
        emit({ startX: px, startY: py, x: pts[n - 1].x, y: pts[n - 1].y, segs: pts, radius: skill.hit, every: skill.every, duration: n * skill.every + 0.7 }, true);
        const struck = new Set();
        pts.forEach((p, i) => later(i * skill.every, () => {
          for (const m of within(p.x, p.y, skill.hit)) {
            if (struck.has(m)) continue;
            struck.add(m);
            hit(m, 1, p.x, p.y);
          }
        }));
        break;
      }
      case 'spear': {
        if (recall && player.dgSpear) {
          // dive onto the planted lance
          const sp = player.dgSpear;
          player.dgSpear = null;
          player.x = sp.x; player.y = sp.y;
          player.targetX = null; player.targetY = null;
          player.facing = this.gs.calculateFacing(px, py, sp.x, sp.y);
          emit({ dive: true, ownerId: player.id, startX: px, startY: py, x: sp.x, y: sp.y, radius: skill.diveR, clearObj: sp.objId }, false);
          say(sp.x, sp.y, skill.rod ? '⚡ LIGHTNING DIVE!' : '🐉 LANCE DIVE!', '#facc15', 17);
          within(sp.x, sp.y, skill.diveR).forEach(m => hit(m, skill.dive / (skill.dmgMult || 1), sp.x, sp.y));
          if (skill.rod) overloadRods(skill.dive * 0.6, (rd) => Math.hypot(rd.x - sp.x, rd.y - sp.y) < 1);
          const socket = this.gs.io.sockets.sockets.get(player.id);
          if (socket) socket.emit('player_updated', player);
          break;
        }
        const end = ray(px, py, dir.normX, dir.normY, skill.len, 0.25);
        const objId = 's' + (++spObjSeq);
        emit({ startX: px, startY: py, x: end.x, y: end.y, width: skill.width, duration: skill.hold, objId, ownerId: player.id }, true);
        for (const m of alive()) {
          if (this.gs.distToSegment(m.x, m.y, px, py, end.x, end.y) <= skill.width) hit(m);
        }
        if (!isShadow) player.dgSpear = { slot, skillId: skill.id, x: end.x, y: end.y, objId, until: Date.now() + skill.hold * 1000, zone, instanceId };
        if (skill.rod) plantRod(end.x, end.y, true);
        break;
      }
      case 'jump': {
        // up into the clouds (untouchable), down onto the cursor a moment later
        const land = ray(px, py, dir.normX, dir.normY, Math.min(range, Math.max(1, Math.hypot(aimX - px, aimY - py))), 0.35);
        if (!isShadow) player.airborneUntil = Date.now() + skill.air * 1000;
        emit({ startX: px, startY: py, x: land.x, y: land.y, radius: skill.r, air: skill.air, duration: skill.air + 0.5 }, true);
        later(skill.air, () => {
          if (!isShadow) {
            player.x = land.x; player.y = land.y;
            player.targetX = null; player.targetY = null;
            player.airborneUntil = 0;
            const socket = this.gs.io.sockets.sockets.get(player.id);
            if (socket) socket.emit('player_updated', player);
          }
          emit({ landed: true, x: land.x, y: land.y, radius: skill.r }, false);
          within(land.x, land.y, skill.r).forEach(m => hit(m, 1, land.x, land.y));
          if (skill.overload) overloadRods(skill.overload);
          if (skill.rod) plantRod(land.x, land.y);
        });
        break;
      }
      case 'wall': {
        // a wall of fire across the aim point, at right angles to it
        const half = (skill.len || 5) / 2, qx = -dir.normY, qy = dir.normX;
        spot = { x0: aimX - qx * half, y0: aimY - qy * half, x1: aimX + qx * half, y1: aimY + qy * half };
        emit({ startX: spot.x0, startY: spot.y0, x: spot.x1, y: spot.y1, width: 1, duration: skill.field ? skill.field.dur : 0.8 }, true);
        for (const m of alive()) {
          if (this.gs.distToSegment(m.x, m.y, spot.x0, spot.y0, spot.x1, spot.y1) <= 1) hit(m, 1, aimX, aimY);
        }
        break;
      }
      case 'rune': {
        const at = ray(px, py, dir.normX, dir.normY, Math.hypot(aimX - px, aimY - py), 0.3);
        placeRune(skill, at.x, at.y, true);
        break;
      }
      case 'rage': {
        // Grave Frenzy: the minions (and any raised while it lasts) fight in a killing rage
        const R = skill.rage;
        if (!isShadow) player.minionRage = { until: Date.now() + R.dur * 1000, dmg: R.dmg, aspd: R.aspd, crit: R.crit, critMult: R.critMult };
        const mins = (player.minions || []).filter(m => m.until > Date.now());
        emit({ x: px, y: py, radius: skill.r || 3, points: mins.map(m => ({ x: m.x, y: m.y })) }, true);
        say(px, py, mins.length ? `☠️ GRAVE FRENZY x${mins.length}` : '☠️ GRAVE FRENZY', '#a3e635', 17);
        break;
      }
      case 'gravebomb': {
        // Corpse Detonation: every minion goes up in grave fire and is spent
        const nowB = Date.now();
        const mins = (player.minions || []).filter(m => m.until > nowB && m.zone === zone && m.instanceId === instanceId);
        emit({ x: px, y: py, radius: skill.r, points: mins.map(m => ({ x: m.x, y: m.y })) }, true);
        if (!mins.length) { say(px, py, 'No minions to detonate', '#94a3b8', 14); break; }
        say(px, py, `💥 CORPSE DETONATION x${mins.length}`, '#4ade80', 17);
        if (!isShadow) player.minions = player.minions.filter(m => !mins.includes(m));
        mins.forEach((m, i) => {
          const bx = m.x, by = m.y;
          later(0.08 + i * 0.07, () => {
            emit({ shape: 'gravebomb', burst: true, x: bx, y: by, radius: skill.r }, false);
            within(bx, by, skill.r).forEach(o => hit(o, 1, bx, by));
          });
        });
        break;
      }
      case 'raise': {
        // Raise the Fallen: the dead near the cursor climb back up as the Gravelord's minions
        const picks = this.gs.takeCorpses(zone, instanceId, aimX, aimY, skill.r, skill.n);
        const risen = picks.length ? picks : [{ x: aimX, y: aimY, type: 'skeleton', hue: 0, scale: 1, thrall: true }];
        emit({ x: aimX, y: aimY, radius: skill.r, points: risen.map(c => ({ x: c.x, y: c.y })), thrall: !picks.length }, true);
        say(aimX, aimY, picks.length ? `☠️ RISE! x${picks.length}` : '☠️ GRAVE THRALL', '#4ade80', 16);
        if (!isShadow) for (const c of risen) this.gs.raiseMinion(player, c, skill);
        for (const c of risen) within(c.x, c.y, 1.3).forEach(m => hit(m, 1, c.x, c.y));
        break;
      }
      case 'invoke': {
        const nowI = Date.now();
        const glyphs = (player.runeGlyphs || []).filter(g => !g.spent && g.until > nowI && g.zone === zone && g.instanceId === instanceId);
        emit({ x: px, y: py, radius: skill.r, points: glyphs.map(g => ({ x: g.x, y: g.y })) }, true);
        if (!glyphs.length) {
          say(px, py, 'No glyphs carved', '#94a3b8', 14);
          within(px, py, 2).forEach(m => hit(m, 0.6));
          break;
        }
        say(px, py, `✴️ INVOCATION x${glyphs.length}`, '#a3e635', 17);
        glyphs.forEach((g, i) => later(i * 0.08, () => burstRune(g, skill.dmgMult)));
        break;
      }
      case 'ricochet': {
        // the shield bounces from enemy to enemy, then flies home
        const visited = new Set();
        const points = [];
        const atAim = nearest(aimX, aimY, 2.5);
        let cur = atAim && Math.hypot(atAim.x - px, atAim.y - py) <= range ? atAim : nearest(px, py, range);
        while (cur && points.length < skill.n) {
          visited.add(cur);
          const from = points.length ? points[points.length - 1] : { x: px, y: py };
          points.push({ x: cur.x, y: cur.y });
          hit(cur, 1, from.x, from.y);
          cur = nearest(cur.x, cur.y, skill.jump || 4, visited);
        }
        emit({ startX: px, startY: py, x: px, y: py, bounces: points, duration: 0.25 + points.length * 0.14 }, true);
        if (points.length && skill.shieldPerHit && !isShadow) {
          const v = Math.round(player.maxHp * skill.shieldPerHit * points.length);
          player.shieldHp = (player.shieldHp || 0) + v;
          say(px, py, `🛡️ +${v} SHIELD`, '#fde68a', 14);
        }
        break;
      }
      case 'phantom': {
        // a phantom blade leaps from enemy to enemy, a new one each slash
        emit({ x: px, y: py, radius: 1.2, duration: skill.n * skill.every + 0.5 }, true);
        let cx = px, cy = py, last = null;
        for (let i = 0; i < skill.n; i++) {
          later(0.1 + i * skill.every, () => {
            const prey = nearest(cx, cy, skill.range, last ? new Set([last]) : null) || (last && last.state !== 'dead' ? last : null);
            if (!prey) return;
            emit({ slash: true, startX: cx, startY: cy, x: prey.x, y: prey.y, wave: i }, false);
            hit(prey, 1, cx, cy);
            cx = prey.x; cy = prey.y; last = prey;
          });
        }
        break;
      }
      case 'hurl': {
        // grab the nearest enemy and throw it at the cursor; bosses are only slammed in place
        const victim = nearest(px, py, skill.range);
        if (!victim) {
          emit({ startX: px, startY: py, x: px + dir.normX, y: py + dir.normY, radius: 1, miss: true }, true);
          say(px, py, 'Nothing to grab', '#94a3b8', 14);
          break;
        }
        const heavy = !!victim.isBoss;
        // thrown toward the cursor itself (aimX/aimY are clamped to the short grab range)
        const to = ray(victim.x, victim.y, dir.normX, dir.normY, Math.min(skill.throw, Math.max(2, Math.hypot(rawTx - victim.x, rawTy - victim.y))), 0.35);
        const land = heavy ? { x: victim.x, y: victim.y } : to;
        emit({ startX: victim.x, startY: victim.y, x: land.x, y: land.y, radius: skill.land.r, heavy, duration: 0.85 }, true);
        if (!heavy) { victim.x = land.x; victim.y = land.y; }
        victim.attackCooldown = Math.max(victim.attackCooldown || 0, 0.5);
        later(0.35, () => {
          hit(victim, 1, px, py);
          within(land.x, land.y, skill.land.r).filter(m => m !== victim).forEach(m => hit(m, skill.land.mult, land.x, land.y));
        });
        break;
      }
      case 'banner': {
        if (isShadow) break;
        const at = ray(px, py, dir.normX, dir.normY, Math.hypot(aimX - px, aimY - py), 0.3);
        if (player.banner) emit({ shape: 'banner', clearObj: player.banner.id, x: player.banner.x, y: player.banner.y, radius: 0 }, false);
        const b = { id: 'b' + (++spObjSeq), x: at.x, y: at.y, r: skill.r, bonus: skill.bonus, until: Date.now() + skill.dur * 1000, zone, instanceId };
        player.banner = b;
        emit({ x: b.x, y: b.y, radius: b.r, duration: skill.dur, objId: b.id }, true);
        within(b.x, b.y, b.r).forEach(m => hit(m, 1, b.x, b.y));
        const ticks = Math.floor(skill.dur / skill.every);
        for (let i = 1; i <= ticks; i++) {
          later(i * skill.every, () => {
            if (player.banner !== b) return;
            within(b.x, b.y, b.r).forEach(m => hit(m, skill.tick, b.x, b.y));
            if (Math.hypot(player.x - b.x, player.y - b.y) <= b.r) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * skill.regen * skill.every);
          });
        }
        break;
      }
      case 'rally': {
        const b = this.gs.ownBanner(player);
        let cx = px, cy = py;
        if (b && !isShadow) {
          player.x = b.x; player.y = b.y;
          player.targetX = null; player.targetY = null;
          player.facing = this.gs.calculateFacing(px, py, b.x, b.y);
          cx = b.x; cy = b.y;
          const socket = this.gs.io.sockets.sockets.get(player.id);
          if (socket) socket.emit('player_updated', player);
        }
        emit({ startX: px, startY: py, x: cx, y: cy, radius: skill.r, leap: !!b }, true);
        if (b) say(cx, cy, '🚩 RALLY!', '#fbbf24', 17);
        within(cx, cy, skill.r).forEach(m => hit(m, 1, cx, cy));
        break;
      }
      case 'boomerang': {
        // axes fly out, then turn and come back to wherever the hero is now
        const n = skill.n || 2, base = Math.atan2(dir.normY, dir.normX), w = skill.width || 1;
        const axes = [];
        for (let i = 0; i < n; i++) {
          const ang = base + (n > 1 ? (i / (n - 1) * 2 - 1) * skill.spread : 0);
          const end = ray(px, py, Math.cos(ang), Math.sin(ang), skill.len, 0.3);
          axes.push({ ex: end.x, ey: end.y });
        }
        emit({ x: px, y: py, startX: px, startY: py, axes, width: w, duration: skill.dur, followId: player.id }, true);
        const pass = (back) => {
          const hx = player.x, hy = player.y;
          const struck = new Set();
          for (const a of axes) {
            for (const m of alive()) {
              if (struck.has(m)) continue;
              const d = back ? this.gs.distToSegment(m.x, m.y, a.ex, a.ey, hx, hy) : this.gs.distToSegment(m.x, m.y, px, py, a.ex, a.ey);
              if (d <= w) { struck.add(m); hit(m, 1, back ? a.ex : px, back ? a.ey : py); }
            }
          }
        };
        later(skill.dur * 0.2, () => pass(false));
        later(skill.dur * 0.8, () => pass(true));
        break;
      }
      case 'firebird': {
        // a teardrop loop: out toward the cursor, sweeping round, and home
        const L = skill.len, N = 24, path = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N, fwd = Math.sin(t * Math.PI) * L, lat = Math.sin(t * Math.PI * 2) * L * 0.35;
          path.push({ x: px + dir.normX * fwd - dir.normY * lat, y: py + dir.normY * fwd + dir.normX * lat });
        }
        emit({ x: px, y: py, path, radius: skill.r, duration: skill.dur }, true);
        const ticks = Math.round(skill.dur / skill.every);
        for (let i = 1; i <= ticks; i++) {
          later(i * skill.every, () => {
            const p = path[Math.min(N, Math.round((i / ticks) * N))];
            within(p.x, p.y, skill.r).forEach(m => hit(m, 1, p.x, p.y));
          });
        }
        break;
      }
      case 'sacrifice': {
        // burn your own life into the blast; it grows with what you spent, then regrows
        const spent = isShadow ? 0 : Math.round(player.hp * skill.burnHp);
        if (spent) player.hp = Math.max(1, player.hp - spent);
        const boost = 1 + 4 * spent / Math.max(1, player.maxHp);
        emit({ x: px, y: py, radius: skill.r, spent }, true);
        if (spent) say(px, py, `🔥 SACRIFICE -${spent} HP`, '#f97316', 17);
        within(px, py, skill.r).forEach(m => hit(m, boost));
        if (skill.regrow && spent) {
          const per = spent * skill.regrow / 10;
          for (let i = 1; i <= 10; i++) later(i * 0.5, () => { player.hp = Math.min(player.maxHp, player.hp + per); });
        }
        break;
      }
      case 'shuriken': {
        const width = skill.width || 0.8;
        if (recall) {
          // every star out there (the shadow's too) flies back to the hero, cutting what it passes
          const out = player.nbStars;
          player.nbStars = null;
          const hx = player.x, hy = player.y;
          emit({ recall: true, ownerId: player.id, x: hx, y: hy, stars: out.stars }, false);
          for (const s of out.stars) {
            for (const m of alive()) {
              if (this.gs.distToSegment(m.x, m.y, s.x, s.y, hx, hy) <= width) hit(m, skill.back || 1, s.x, s.y);
            }
          }
          say(hx, hy, '🌀 RECALL!', '#c084fc', 15);
          break;
        }
        // a fan of stars toward the cursor; each stops at its spot (or a wall) and hovers there
        const n = skill.n || 5;
        const reach = Math.min(range, Math.max(3, Math.hypot(aimX - px, aimY - py)));
        const base = Math.atan2(dir.normY, dir.normX), step = n > 1 ? (skill.spread * Math.PI / 180) / (n - 1) : 0;
        const stars = [];
        for (let i = 0; i < n; i++) {
          const ang = base + (i - (n - 1) / 2) * step;
          const end = ray(px, py, Math.cos(ang), Math.sin(ang), reach, 0.2);
          stars.push({ x: end.x, y: end.y });
          for (const m of alive()) {
            if (this.gs.distToSegment(m.x, m.y, px, py, end.x, end.y) <= width) hit(m);
          }
        }
        if (isShadow) {
          // the shadow's stars come back with the hero's on recall
          if (player.nbStars) player.nbStars.stars.push(...stars);
        } else {
          player.nbStars = { slot, skillId: skill.id, stars, until: Date.now() + (skill.hold || 5) * 1000, zone, instanceId };
        }
        emit({ startX: px, startY: py, x: aimX, y: aimY, stars, ownerId: player.id, duration: skill.hold || 5 }, true);
        break;
      }
      case 'smoke': {
        // anyone standing in the cloud makes monster attacks miss (see smokeMissChance)
        this.gs.smokeClouds.push({ zone, instanceId, x: px, y: py, r: skill.r, miss: skill.miss, until: Date.now() + skill.dur * 1000 });
        emit({ x: px, y: py, radius: skill.r, duration: skill.dur }, true);
        if (skill.dmg) within(px, py, skill.r).forEach(m => hit(m));
        if (!isShadow) say(px, py, '💨 SMOKE BOMB', '#cbd5e1', 15);
        break;
      }
      case 'shadow': {
        const spotAt = ray(px, py, dir.normX, dir.normY, Math.hypot(aimX - px, aimY - py), 0.3);
        player.nbShadow = { x: spotAt.x, y: spotAt.y, mirror: skill.mirror, until: Date.now() + skill.dur * 1000, zone, instanceId };
        emit({ startX: px, startY: py, x: spotAt.x, y: spotAt.y, radius: skill.r, duration: skill.dur }, true);
        if (skill.dmg) within(spotAt.x, spotAt.y, skill.r).forEach(m => hit(m, 1, spotAt.x, spotAt.y));
        say(spotAt.x, spotAt.y, '👤 SHADOW', '#a855f7', 15);
        break;
      }
      case 'orbit': {
        // stars circle the hero (or stay put around the shadow) and cut on every tick
        const centre = () => (isShadow ? { x: px, y: py } : { x: player.x, y: player.y });
        emit({ x: px, y: py, radius: skill.r, n: skill.n, duration: skill.dur, followId: isShadow ? null : player.id }, true);
        const spin = () => {
          const c = centre();
          within(c.x, c.y, skill.r).forEach(m => hit(m, 1, c.x, c.y));
        };
        spin();
        const ticks = Math.round(skill.dur / skill.every);
        for (let i = 1; i < ticks; i++) later(i * skill.every, spin);
        break;
      }
      case 'orbs': {
        // n storm orbs fan out ahead (±spread rad) and drift len tiles over dur s,
        // stopping at walls, shocking everything within r of each every `every` s
        const n = skill.n || 2, base = Math.atan2(dir.normY, dir.normX);
        const orbs = [];
        for (let i = 0; i < n; i++) {
          const ang = base + (n > 1 ? (i / (n - 1) * 2 - 1) * skill.spread : 0);
          const end = ray(px, py, Math.cos(ang), Math.sin(ang), skill.len, 0.3);
          orbs.push({ sx: px, sy: py, ex: end.x, ey: end.y });
        }
        emit({ x: px, y: py, orbs, radius: skill.r, duration: skill.dur }, true);
        const ticks = Math.round(skill.dur / skill.every);
        const shock = (i) => {
          const k = i / ticks;
          for (const o of orbs) {
            const ox = o.sx + (o.ex - o.sx) * k, oy = o.sy + (o.ey - o.sy) * k;
            within(ox, oy, skill.r).forEach(m => hit(m, 1, ox, oy));
          }
        };
        for (let i = 1; i <= ticks; i++) later(i * skill.every, () => shock(i));
        break;
      }
      case 'detonate': {
        emit({ x: px, y: py, radius: skill.r || 7.0 }, true);
        let detonatedCount = 0;
        for (const m of within(px, py, skill.r || 7.0)) {
          const stacks = m.poisonStacks || (m.poisonTimer > 0 ? 2 : 0);
          if (stacks > 0) {
            const detonateMult = (skill.dmgMult || 2.2) + (stacks * 0.75);
            const detonateDmg = Math.round(player.dmg * detonateMult);
            applySkillDamage(m, detonateDmg, true);
            m.poisonStacks = 0;
            m.poisonTimer = 0;
            m.poisonDmg = 0;
            detonatedCount++;
            this.gs.emitZone(zone, 'floating_text', { x: m.x, y: m.y - 0.8, text: `💥 DETONATE! -${detonateDmg}`, color: '#22c55e', size: 18 });
          }
        }
        if (detonatedCount > 0) {
          this.gs.emitZone(zone, 'floating_text', { x: px, y: py - 0.8, text: `☣️ DETONATED ${detonatedCount} ENEMIES!`, color: '#86efac', size: 16 });
        }
        break;
      }
      case 'blast': {
        spot = { x: aimX, y: aimY };
        emit({ x: aimX, y: aimY, startX: px, startY: py, radius: skill.r }, true);
        within(aimX, aimY, skill.r).forEach(m => hit(m, 1, aimX, aimY));
        if (skill.rod) plantRod(aimX, aimY);
        break;
      }
      case 'pull': {
        spot = { x: aimX, y: aimY };
        const isDreadRoar = skill.id === 'sp_void_grasp';
        const pullCenterX = isDreadRoar ? px : aimX;
        const pullCenterY = isDreadRoar ? py : aimY;
        emit({ x: pullCenterX, y: pullCenterY, radius: skill.r }, true);
        if (isDreadRoar) say(px, py, '💀 MOCKING DREAD ROAR!', '#c084fc', 17);
        for (const m of within(pullCenterX, pullCenterY, skill.r)) {
          const nx = pullCenterX + (m.x - pullCenterX) * (isDreadRoar ? 0.25 : 0.3);
          const ny = pullCenterY + (m.y - pullCenterY) * (isDreadRoar ? 0.25 : 0.3);
          if (!this.gs.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
          if (isDreadRoar) {
            m.attackCooldown = Math.max(m.attackCooldown || 0, 1.2);
            m.targetPlayerId = player.id;
          }
          hit(m, 1, pullCenterX, pullCenterY);
        }
        break;
      }
      case 'cone': {
        emit({ x: px, y: py, dirX: dir.normX, dirY: dir.normY, range: skill.range, arc: skill.arc }, true);
        if (skill.id === 'sp_dread_wave') say(px, py, '🪓 CATACLYSMIC AXE DRAG!', '#f43f5e', 17);
        const half = (skill.arc * Math.PI) / 360;
        for (const m of within(px, py, skill.range)) {
          const d = Math.hypot(m.x - px, m.y - py);
          if (d < 0.5) { hit(m); continue; }
          const cos = ((m.x - px) * dir.normX + (m.y - py) * dir.normY) / d;
          if (Math.acos(Math.max(-1, Math.min(1, cos))) <= half) {
            hit(m);
            if (skill.id === 'sp_dread_wave' && m.state !== 'dead') {
              m.burnTimer = Math.max(m.burnTimer || 0, 3.5);
              m.burnDmg = Math.max(m.burnDmg || 0, Math.round(player.dmg * 0.28));
            }
          }
        }
        break;
      }
      case 'line': {
        const ex = px + dir.normX * skill.len, ey = py + dir.normY * skill.len;
        emit({ startX: px, startY: py, x: ex, y: ey, width: skill.width }, true);
        if (skill.id === 'sp_abyss_cleave') say(px, py, '🪓 ABYSSAL GUILLOTINE!', '#c084fc', 17);
        for (const m of alive()) {
          if (this.gs.distToSegment(m.x, m.y, px, py, ex, ey) <= skill.width) hit(m);
        }
        if (skill.id === 'sp_abyss_cleave') {
          later(0.32, () => {
            emit({ startX: px, startY: py, x: ex, y: ey, width: skill.width * 1.15, wave: 1 }, false);
            for (const m of alive()) {
              if (this.gs.distToSegment(m.x, m.y, px, py, ex, ey) <= skill.width * 1.15) hit(m, 0.45);
            }
          });
        }
        break;
      }
      case 'strike': {
        // Prefer the enemy at the aim point, else the closest one in reach
        const atAim = nearest(aimX, aimY, 2.5);
        const target = atAim && Math.hypot(atAim.x - px, atAim.y - py) <= skill.range + 1 ? atAim : nearest(px, py, skill.range);
        const tx = target ? target.x : aimX, ty = target ? target.y : aimY;
        emit({ startX: px, startY: py, x: tx, y: ty, radius: 0.9 }, true);
        if (target) {
          if (skill.id === 'sp_soul_rend') {
            const isExec = target.maxHp && target.hp <= target.maxHp * 0.45;
            say(target.x, target.y, isExec ? '🪓 GUILLOTINE EXECUTE!' : '🪓 BEHEADING!', '#f43f5e', isExec ? 19 : 17);
            hit(target, isExec ? 1.35 : 1.0);
          } else {
            hit(target);
          }
        }
        break;
      }
      case 'volley': {
        const targets = within(px, py, skill.range)
          .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
          .slice(0, skill.n);
        emit({ x: px, y: py, startX: px, startY: py, points: targets.map(m => ({ x: m.x, y: m.y })) }, true);
        targets.forEach(m => hit(m));
        break;
      }
      case 'chain': {
        const visited = new Set();
        const points = [];
        let cur = nearest(px, py, skill.range);
        let mult = 1;
        while (cur && points.length < skill.n) {
          visited.add(cur);
          points.push({ x: cur.x, y: cur.y });
          hit(cur, mult, points.length > 1 ? points[points.length - 2].x : px, points.length > 1 ? points[points.length - 2].y : py);
          mult *= skill.decay || 0.85;
          cur = nearest(cur.x, cur.y, skill.jump || 4, visited);
        }
        emit({ x: px, y: py, startX: px, startY: py, points }, true);
        break;
      }
      case 'pulse': {
        const onTarget = skill.at === 'target';
        let seekX = aimX, seekY = aimY, lastPrey = null;
        if (skill.id === 'sp_soul_bastion') {
          const missingShare = Math.max(0, 1 - (player.hp / Math.max(1, player.maxHp)));
          const bloodlustHeal = Math.max(1, Math.round(player.maxHp * (0.12 + 0.18 * missingShare)));
          player.hp = Math.min(player.maxHp, player.hp + bloodlustHeal);
          say(px, py, `🔥 UNDYING RAGE! (+${bloodlustHeal} HP)`, '#f43f5e', 18);
        }
        const wave = (i) => {
          let cx = onTarget ? seekX : player.x, cy = onTarget ? seekY : player.y;
          if (skill.seek) {
            // hop to a different enemy each pulse (stay put only if it is the last one)
            const prey = nearest(cx, cy, skill.seek, lastPrey ? new Set([lastPrey]) : null) || (lastPrey && lastPrey.state !== 'dead' ? lastPrey : nearest(cx, cy, skill.seek));
            if (prey) { lastPrey = prey; seekX = cx = prey.x; seekY = cy = prey.y; }
          }
          emit({ x: cx, y: cy, radius: skill.r, wave: i }, i === 0);
          within(cx, cy, skill.r).forEach(m => hit(m, 1, cx, cy));
        };
        wave(0);
        for (let i = 1; i < skill.n; i++) later(i * skill.every, () => wave(i));
        break;
      }
      case 'rain': {
        // Each strike lands on a random enemy in the area, or a random spot if none
        if (skill.id === 'sp_grave_rain') say(aimX, aimY, '🪓 GUILLOTINE SKYFALL!', '#c084fc', 17);
        const strike = (i) => {
          const inArea = within(aimX, aimY, skill.r);
          const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * skill.r;
          const pick = inArea.length ? inArea[Math.floor(Math.random() * inArea.length)] : null;
          const sx = pick ? pick.x : aimX + Math.cos(a) * d, sy = pick ? pick.y : aimY + Math.sin(a) * d;
          emit({ x: sx, y: sy, radius: skill.hit, wave: i, areaX: aimX, areaY: aimY, areaR: skill.r }, i === 0);
          within(sx, sy, skill.hit).forEach(m => hit(m, 1, sx, sy));
          if (skill.id === 'sp_grave_rain' && i === skill.n - 1) {
            within(aimX, aimY, skill.r).forEach(m => hit(m, 0.75, aimX, aimY));
          }
        };
        strike(0);
        for (let i = 1; i < skill.n; i++) later(i * skill.every, () => strike(i));
        break;
      }
      case 'dash': {
        const end = travel(skill.len);
        spot = { x0: px, y0: py, x1: end.x, y1: end.y };
        let resetDash = false;
        let spinHits = 0;
        for (const m of alive()) {
          if (this.gs.distToSegment(m.x, m.y, px, py, end.x, end.y) <= skill.width) {
            if (skill.resetOnStatic && m.staticCharge && m.staticCharge > 0) {
              m.staticCharge = 0;
              resetDash = true;
            }
            spinHits++;
            hit(m);
            if (skill.plow && m.state !== 'dead' && !m.isBoss) {
              const side = ((m.x - px) * -dir.normY + (m.y - py) * dir.normX) >= 0 ? 0.6 : -0.6;
              const nx = end.x + dir.normX * 0.8 - dir.normY * side, ny = end.y + dir.normY * 0.8 + dir.normX * side;
              if (!this.gs.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
            }
          }
        }
        if (resetDash) {
          player.skillCooldowns['dash'] = 0;
          player.skillCooldowns[slot] = 0;
          this.gs.emitZone(zone, 'floating_text', { x: end.x, y: end.y - 0.7, text: '⚡ DASH RESET!', color: '#facc15', size: 16 });
          const socket = this.gs.io.sockets.sockets.get(player.id);
          if (socket) socket.emit('player_updated', player);
        } else if (skill.spinReset && spinHits > 0) {
          const cdReduce = spinHits * skill.spinReset;
          player.skillCooldowns['dash'] = Math.max(0, (player.skillCooldowns['dash'] || 0) - cdReduce);
          if (player.skillCooldowns[slot] !== undefined) {
            player.skillCooldowns[slot] = Math.max(0, (player.skillCooldowns[slot] || 0) - cdReduce);
          }
          this.gs.emitZone(zone, 'floating_text', { x: end.x, y: end.y - 0.7, text: `🪓 SPIN SLAUGHTER -${cdReduce.toFixed(1)}s CD!`, color: '#c084fc', size: 15 });
          const socket = this.gs.io.sockets.sockets.get(player.id);
          if (socket) socket.emit('player_updated', player);
        }
        emit({ startX: px, startY: py, x: end.x, y: end.y, width: skill.width, facing: player.facing }, true);
        break;
      }
      case 'backstep': {
        const target = nearest(aimX, aimY, 3.5) || nearest(px, py, skill.range || 7);
        if (target) {
          const tdir = { normX: dir.normX || 1, normY: dir.normY || 0 };
          let destX = target.x - tdir.normX * 1.0;
          let destY = target.y - tdir.normY * 1.0;
          if (this.gs.isColliding(destX, destY, zone)) {
            destX = target.x + tdir.normX * 1.0;
            destY = target.y + tdir.normY * 1.0;
          }
          emit({ startX: px, startY: py, x: destX, y: destY, radius: 1.5 }, true);
          hit(target, 2.2);
          target.shadowMarkTimer = 6.0;
          if (!isShadow) {
            player.x = destX; player.y = destY;
            player.targetX = null; player.targetY = null;
            player.facing = this.gs.calculateFacing(destX, destY, target.x, target.y);
            this.gs.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '👤 SHADOWSTEP!', color: '#a855f7' });
            const socket = this.gs.io.sockets.sockets.get(player.id);
            if (socket) socket.emit('player_updated', player);
          }
        } else {
          const end = travel(skill.len || 6);
          emit({ startX: px, startY: py, x: end.x, y: end.y, radius: 1.5 }, true);
        }
        break;
      }
      case 'blink': {
        const end = travel(skill.len);
        emit({ startX: px, startY: py, x: end.x, y: end.y, radius: skill.r || 0, origin: !!(skill.origin || skill.originOnly), landing: !skill.originOnly && !!skill.dmg, facing: player.facing }, true);
        if (skill.id === 'sp_void_step') say(end.x, end.y, '🪓 OBLIVION SLAM!', '#c084fc', 17);
        if (skill.leaveRune && !isShadow && SP.SP_SKILLS[skill.leaveRune]) placeRune(SP.SP_SKILLS[skill.leaveRune], px, py, false);
        if (skill.riftPull) {
          within(px, py, skill.riftPull).forEach((m, i) => {
            const a = (i / 6) * Math.PI * 2;
            const nx = end.x + Math.cos(a) * 1.2, ny = end.y + Math.sin(a) * 1.2;
            if (!this.gs.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
          });
        }
        if (skill.taunt) {
          for (const m of within(px, py, 8)) {
            m.targetPlayerId = null;
            m.state = 'idle';
            m.wanderTarget = { x: px, y: py };
            m.nextWanderTime = Date.now() + skill.taunt * 1000;
          }
        }
        if (skill.dmg) {
          const struck = new Set();
          if (skill.origin || skill.originOnly) within(px, py, skill.r).forEach(m => { struck.add(m); hit(m, 1, px, py); });
          if (!skill.originOnly) within(end.x, end.y, skill.r).filter(m => !struck.has(m)).forEach(m => hit(m, 1, end.x, end.y));
        }
        break;
      }
      case 'alpha': {
        // Eternal Alpha (Nightfall Twinblades): blink from enemy to enemy,
        // striking each, landing beside the last one; drawn as a chain of blinks
        const struck = new Set();
        let from = { x: px, y: py };
        const hop = (i: number) => {
          const target = nearest(from.x, from.y, i === 0 ? skill.range : skill.jump, struck);
          if (!target) return false;
          struck.add(target);
          const d = Math.hypot(target.x - from.x, target.y - from.y) || 1;
          let lx = target.x - ((target.x - from.x) / d) * 0.9, ly = target.y - ((target.y - from.y) / d) * 0.9;
          if (this.gs.isColliding(lx, ly, zone)) { lx = target.x; ly = target.y; }
          if (!isShadow) {
            player.x = lx; player.y = ly;
            player.targetX = null; player.targetY = null;
            player.facing = this.gs.calculateFacing(lx, ly, target.x, target.y);
          }
          emit({ shape: 'blink', startX: from.x, startY: from.y, x: lx, y: ly, radius: 1.1, landing: true, facing: player.facing }, i === 0);
          hit(target, 1, lx, ly);
          from = { x: lx, y: ly };
          return true;
        };
        if (!hop(0)) {
          // nobody in reach: a short blink forward instead
          const end = travel(3);
          emit({ shape: 'blink', startX: px, startY: py, x: end.x, y: end.y, radius: 0, facing: player.facing }, true);
          break;
        }
        for (let i = 1; i < skill.n; i++) later(i * skill.every, () => hop(i));
        break;
      }
    }

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
