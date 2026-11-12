// One handler per Specialist skill shape (Phase D3 of docs/REFACTOR_PLAN.md): the cases of the old switch in castSpSkill.
// A handler gets the cast context built by castSpSkill: the caster, the skill, and the helpers (hit, emit, say, ...).
import * as SP from '../spCards';
// ids for placed card objects (glyphs, banners, lances) so the client can clear them; one counter for the whole process
let spObjSeq = 0;
export const nextSpObjId = () => ++spObjSeq;

// The context is a loose bag of what castSpSkill prepared; the names are those of its old local variables.
export interface SpCastContext {
  gs: any; player: any; skill: any; ctx: any;
  [name: string]: any;
}

export type SpShapeHandler = (c: SpCastContext) => void;

export const SP_SHAPE_HANDLERS: Record<string, SpShapeHandler> = {
  aura: (c) => {
    const { player, skill, gs, emit, px, py, say } = c;
    if (!player.spToggles) player.spToggles = {};
    player.spToggles[skill.id] = { skill, clock: 0 };
    emit({ x: px, y: py, radius: skill.r || 1.4, spin: !!skill.spin }, true);
    say(px, py, `${skill.icon || '✨'} ${skill.name.toUpperCase()} ON`, skill.color || '#ef4444', 16);
  },

  rewind: (c) => {
    const { player, skill, gs, emit, px, py, say, zone } = c;
    const trail = player.timeTrail || [];
    const want = Date.now() - (skill.back || 3) * 1000;
    const past = trail.find((t: any) => t.t >= want) || trail[0];
    if (past && !gs.isColliding(past.x, past.y, zone)) {
      player.x = past.x; player.y = past.y;
      player.targetX = null; player.targetY = null;
      if (past.hp > player.hp) player.hp = Math.min(player.maxHp, past.hp);
    }
    emit({ startX: px, startY: py, x: player.x, y: player.y, radius: 1.2 }, true);
    say(player.x, player.y, '⏪ REWIND', '#fde68a', 17);
    player.timeTrail = [];
  },

  nova: (c) => {
    const { player, skill, gs, alive, burstDoom, emit, hit, px, py, say, within, zone } = c;
    emit({ x: px, y: py, radius: skill.r || 1.4 }, true);
    if (skill.provoke) {
      for (const m of within(px, py, skill.r)) {
        const nx = px + (m.x - px) * (1 - skill.provoke), ny = py + (m.y - py) * (1 - skill.provoke);
        if (!m.isBoss && !gs.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
        m.targetPlayerId = player.id;
        m.state = 'chase';
      }
      say(px, py, '📯 CHALLENGE!', '#fde68a', 17);
    }
    if (skill.dmg) within(px, py, skill.r).forEach((m: any) => hit(m));
    if (skill.reap) {
      // Devour: every Doom brand of this hero bursts now
      for (const m of alive()) if (m.doom && m.doom.owner === player.id) burstDoom(m, m.doom);
    }
  },

  buff: (c) => SP_SHAPE_HANDLERS.nova(c),

  fault: (c) => {
    const { player, skill, gs, dir, emit, hit, later, px, py, ray, within } = c;
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
  },

  spear: (c) => {
    const { player, skill, gs, alive, dir, emit, hit, instanceId, isShadow, overloadRods, plantRod, px, py, ray, recall, say, slot, within, zone } = c;
    if (recall && player.dgSpear) {
      // dive onto the planted lance
      const sp = player.dgSpear;
      player.dgSpear = null;
      player.x = sp.x; player.y = sp.y;
      player.targetX = null; player.targetY = null;
      player.facing = gs.calculateFacing(px, py, sp.x, sp.y);
      emit({ dive: true, ownerId: player.id, startX: px, startY: py, x: sp.x, y: sp.y, radius: skill.diveR, clearObj: sp.objId }, false);
      say(sp.x, sp.y, skill.rod ? '⚡ LIGHTNING DIVE!' : '🐉 LANCE DIVE!', '#facc15', 17);
      within(sp.x, sp.y, skill.diveR).forEach((m: any) => hit(m, skill.dive / (skill.dmgMult || 1), sp.x, sp.y));
      if (skill.rod) overloadRods(skill.dive * 0.6, (rd: any) => Math.hypot(rd.x - sp.x, rd.y - sp.y) < 1);
      const socket = gs.io.sockets.sockets.get(player.id);
      if (socket) socket.emit('player_updated', player);
      return;
    }
    const end = ray(px, py, dir.normX, dir.normY, skill.len, 0.25);
    const objId = 's' + nextSpObjId();
    emit({ startX: px, startY: py, x: end.x, y: end.y, width: skill.width, duration: skill.hold, objId, ownerId: player.id }, true);
    for (const m of alive()) {
      if (gs.distToSegment(m.x, m.y, px, py, end.x, end.y) <= skill.width) hit(m);
    }
    if (!isShadow) player.dgSpear = { slot, skillId: skill.id, x: end.x, y: end.y, objId, until: Date.now() + skill.hold * 1000, zone, instanceId };
    if (skill.rod) plantRod(end.x, end.y, true);
  },

  jump: (c) => {
    const { player, skill, gs, aimX, aimY, dir, emit, hit, isShadow, later, overloadRods, plantRod, px, py, range, ray, within } = c;
    const land = ray(px, py, dir.normX, dir.normY, Math.min(range, Math.max(1, Math.hypot(aimX - px, aimY - py))), 0.35);
    if (!isShadow) player.airborneUntil = Date.now() + skill.air * 1000;
    emit({ startX: px, startY: py, x: land.x, y: land.y, radius: skill.r, air: skill.air, duration: skill.air + 0.5 }, true);
    later(skill.air, () => {
      if (!isShadow) {
        player.x = land.x; player.y = land.y;
        player.targetX = null; player.targetY = null;
        player.airborneUntil = 0;
        const socket = gs.io.sockets.sockets.get(player.id);
        if (socket) socket.emit('player_updated', player);
      }
      emit({ landed: true, x: land.x, y: land.y, radius: skill.r }, false);
      within(land.x, land.y, skill.r).forEach((m: any) => hit(m, 1, land.x, land.y));
      if (skill.overload) overloadRods(skill.overload);
      if (skill.rod) plantRod(land.x, land.y);
    });
  },

  wall: (c) => {
    const { player, skill, gs, aimX, aimY, alive, dir, emit, hit } = c;
    const half = (skill.len || 5) / 2, qx = -dir.normY, qy = dir.normX;
    c.spot = { x0: aimX - qx * half, y0: aimY - qy * half, x1: aimX + qx * half, y1: aimY + qy * half };
    emit({ startX: c.spot.x0, startY: c.spot.y0, x: c.spot.x1, y: c.spot.y1, width: 1, duration: skill.field ? skill.field.dur : 0.8 }, true);
    for (const m of alive()) {
      if (gs.distToSegment(m.x, m.y, c.spot.x0, c.spot.y0, c.spot.x1, c.spot.y1) <= 1) hit(m, 1, aimX, aimY);
    }
  },

  rune: (c) => {
    const { player, skill, gs, aimX, aimY, dir, placeRune, px, py, ray } = c;
    const at = ray(px, py, dir.normX, dir.normY, Math.hypot(aimX - px, aimY - py), 0.3);
    placeRune(skill, at.x, at.y, true);
  },

  rage: (c) => {
    const { player, skill, gs, emit, isShadow, px, py, say } = c;
    const R = skill.rage;
    if (!isShadow) player.minionRage = { until: Date.now() + R.dur * 1000, dmg: R.dmg, aspd: R.aspd, crit: R.crit, critMult: R.critMult };
    const mins = (player.minions || []).filter((m: any) => m.until > Date.now());
    emit({ x: px, y: py, radius: skill.r || 3, points: mins.map((m: any) => ({ x: m.x, y: m.y })) }, true);
    say(px, py, mins.length ? `☠️ GRAVE FRENZY x${mins.length}` : '☠️ GRAVE FRENZY', '#a3e635', 17);
  },

  gravebomb: (c) => {
    const { player, skill, gs, emit, hit, instanceId, isShadow, later, px, py, say, within, zone } = c;
    const nowB = Date.now();
    const mins = (player.minions || []).filter((m: any) => m.until > nowB && m.zone === zone && m.instanceId === instanceId);
    emit({ x: px, y: py, radius: skill.r, points: mins.map((m: any) => ({ x: m.x, y: m.y })) }, true);
    if (!mins.length) { say(px, py, 'No minions to detonate', '#94a3b8', 14); return; }
    say(px, py, `💥 CORPSE DETONATION x${mins.length}`, '#4ade80', 17);
    if (!isShadow) player.minions = player.minions.filter((m: any) => !mins.includes(m));
    mins.forEach((m: any, i: any) => {
      const bx = m.x, by = m.y;
      later(0.08 + i * 0.07, () => {
        emit({ shape: 'gravebomb', burst: true, x: bx, y: by, radius: skill.r }, false);
        within(bx, by, skill.r).forEach((o: any) => hit(o, 1, bx, by));
      });
    });
  },

  raise: (c) => {
    const { player, skill, gs, aimX, aimY, emit, hit, instanceId, isShadow, say, within, zone } = c;
    const picks = gs.takeCorpses(zone, instanceId, aimX, aimY, skill.r, skill.n);
    const risen = picks.length ? picks : [{ x: aimX, y: aimY, type: 'skeleton', hue: 0, scale: 1, thrall: true }];
    emit({ x: aimX, y: aimY, radius: skill.r, points: risen.map((c: any) => ({ x: c.x, y: c.y })), thrall: !picks.length }, true);
    say(aimX, aimY, picks.length ? `☠️ RISE! x${picks.length}` : '☠️ GRAVE THRALL', '#4ade80', 16);
    if (!isShadow) for (const c of risen) gs.raiseMinion(player, c, skill);
    for (const c of risen) within(c.x, c.y, 1.3).forEach((m: any) => hit(m, 1, c.x, c.y));
  },

  invoke: (c) => {
    const { player, skill, gs, burstRune, emit, hit, instanceId, later, px, py, say, within, zone } = c;
    const nowI = Date.now();
    const glyphs = (player.runeGlyphs || []).filter((g: any) => !g.spent && g.until > nowI && g.zone === zone && g.instanceId === instanceId);
    emit({ x: px, y: py, radius: skill.r, points: glyphs.map((g: any) => ({ x: g.x, y: g.y })) }, true);
    if (!glyphs.length) {
      say(px, py, 'No glyphs carved', '#94a3b8', 14);
      within(px, py, 2).forEach((m: any) => hit(m, 0.6));
      return;
    }
    say(px, py, `✴️ INVOCATION x${glyphs.length}`, '#a3e635', 17);
    glyphs.forEach((g: any, i: any) => later(i * 0.08, () => burstRune(g, skill.dmgMult)));
  },

  ricochet: (c) => {
    const { player, skill, gs, aimX, aimY, emit, hit, isShadow, nearest, px, py, range, say } = c;
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
  },

  phantom: (c) => {
    const { player, skill, gs, emit, hit, later, nearest, px, py } = c;
    emit({ x: px, y: py, radius: 1.2, duration: skill.n * skill.every + 0.5 }, true);
    let cx = px, cy = py, last: any = null;
    for (let i = 0; i < skill.n; i++) {
      later(0.1 + i * skill.every, () => {
        const prey = nearest(cx, cy, skill.range, last ? new Set([last]) : null) || (last && last.state !== 'dead' ? last : null);
        if (!prey) return;
        emit({ slash: true, startX: cx, startY: cy, x: prey.x, y: prey.y, wave: i }, false);
        hit(prey, 1, cx, cy);
        cx = prey.x; cy = prey.y; last = prey;
      });
    }
  },

  hurl: (c) => {
    const { player, skill, gs, dir, emit, hit, later, nearest, px, py, rawTx, rawTy, ray, say, within } = c;
    const victim = nearest(px, py, skill.range);
    if (!victim) {
      emit({ startX: px, startY: py, x: px + dir.normX, y: py + dir.normY, radius: 1, miss: true }, true);
      say(px, py, 'Nothing to grab', '#94a3b8', 14);
      return;
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
      within(land.x, land.y, skill.land.r).filter((m: any) => m !== victim).forEach((m: any) => hit(m, skill.land.mult, land.x, land.y));
    });
  },

  banner: (c) => {
    const { player, skill, gs, aimX, aimY, dir, emit, hit, instanceId, isShadow, later, px, py, ray, within, zone } = c;
    if (isShadow) return;
    const at = ray(px, py, dir.normX, dir.normY, Math.hypot(aimX - px, aimY - py), 0.3);
    if (player.banner) emit({ shape: 'banner', clearObj: player.banner.id, x: player.banner.x, y: player.banner.y, radius: 0 }, false);
    const b = { id: 'b' + nextSpObjId(), x: at.x, y: at.y, r: skill.r, bonus: skill.bonus, until: Date.now() + skill.dur * 1000, zone, instanceId };
    player.banner = b;
    emit({ x: b.x, y: b.y, radius: b.r, duration: skill.dur, objId: b.id }, true);
    within(b.x, b.y, b.r).forEach((m: any) => hit(m, 1, b.x, b.y));
    const ticks = Math.floor(skill.dur / skill.every);
    for (let i = 1; i <= ticks; i++) {
      later(i * skill.every, () => {
        if (player.banner !== b) return;
        within(b.x, b.y, b.r).forEach((m: any) => hit(m, skill.tick, b.x, b.y));
        if (Math.hypot(player.x - b.x, player.y - b.y) <= b.r) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * skill.regen * skill.every);
      });
    }
  },

  rally: (c) => {
    const { player, skill, gs, emit, hit, isShadow, px, py, say, within } = c;
    const b = gs.ownBanner(player);
    let cx = px, cy = py;
    if (b && !isShadow) {
      player.x = b.x; player.y = b.y;
      player.targetX = null; player.targetY = null;
      player.facing = gs.calculateFacing(px, py, b.x, b.y);
      cx = b.x; cy = b.y;
      const socket = gs.io.sockets.sockets.get(player.id);
      if (socket) socket.emit('player_updated', player);
    }
    emit({ startX: px, startY: py, x: cx, y: cy, radius: skill.r, leap: !!b }, true);
    if (b) say(cx, cy, '🚩 RALLY!', '#fbbf24', 17);
    within(cx, cy, skill.r).forEach((m: any) => hit(m, 1, cx, cy));
  },

  boomerang: (c) => {
    const { player, skill, gs, alive, dir, emit, hit, later, px, py, ray } = c;
    const n = skill.n || 2, base = Math.atan2(dir.normY, dir.normX), w = skill.width || 1;
    const axes: any = [];
    for (let i = 0; i < n; i++) {
      const ang = base + (n > 1 ? (i / (n - 1) * 2 - 1) * skill.spread : 0);
      const end = ray(px, py, Math.cos(ang), Math.sin(ang), skill.len, 0.3);
      axes.push({ ex: end.x, ey: end.y });
    }
    emit({ x: px, y: py, startX: px, startY: py, axes, width: w, duration: skill.dur, followId: player.id }, true);
    const pass = (back: any) => {
      const hx = player.x, hy = player.y;
      const struck = new Set();
      for (const a of axes) {
        for (const m of alive()) {
          if (struck.has(m)) continue;
          const d = back ? gs.distToSegment(m.x, m.y, a.ex, a.ey, hx, hy) : gs.distToSegment(m.x, m.y, px, py, a.ex, a.ey);
          if (d <= w) { struck.add(m); hit(m, 1, back ? a.ex : px, back ? a.ey : py); }
        }
      }
    };
    later(skill.dur * 0.2, () => pass(false));
    later(skill.dur * 0.8, () => pass(true));
  },

  firebird: (c) => {
    const { player, skill, gs, dir, emit, hit, later, px, py, within } = c;
    const L = skill.len, N = 24, path: any = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, fwd = Math.sin(t * Math.PI) * L, lat = Math.sin(t * Math.PI * 2) * L * 0.35;
      path.push({ x: px + dir.normX * fwd - dir.normY * lat, y: py + dir.normY * fwd + dir.normX * lat });
    }
    emit({ x: px, y: py, path, radius: skill.r, duration: skill.dur }, true);
    const ticks = Math.round(skill.dur / skill.every);
    for (let i = 1; i <= ticks; i++) {
      later(i * skill.every, () => {
        const p = path[Math.min(N, Math.round((i / ticks) * N))];
        within(p.x, p.y, skill.r).forEach((m: any) => hit(m, 1, p.x, p.y));
      });
    }
  },

  sacrifice: (c) => {
    const { player, skill, gs, emit, hit, isShadow, later, px, py, say, within } = c;
    const spent = isShadow ? 0 : Math.round(player.hp * skill.burnHp);
    if (spent) player.hp = Math.max(1, player.hp - spent);
    const boost = 1 + 4 * spent / Math.max(1, player.maxHp);
    emit({ x: px, y: py, radius: skill.r, spent }, true);
    if (spent) say(px, py, `🔥 SACRIFICE -${spent} HP`, '#f97316', 17);
    within(px, py, skill.r).forEach((m: any) => hit(m, boost));
    if (skill.regrow && spent) {
      const per = spent * skill.regrow / 10;
      for (let i = 1; i <= 10; i++) later(i * 0.5, () => { player.hp = Math.min(player.maxHp, player.hp + per); });
    }
  },

  shuriken: (c) => {
    const { player, skill, gs, aimX, aimY, alive, dir, emit, hit, instanceId, isShadow, px, py, range, ray, recall, say, slot, zone } = c;
    const width = skill.width || 0.8;
    if (recall) {
      // every star out there (the shadow's too) flies back to the hero, cutting what it passes
      const out = player.nbStars;
      player.nbStars = null;
      const hx = player.x, hy = player.y;
      emit({ recall: true, ownerId: player.id, x: hx, y: hy, stars: out.stars }, false);
      for (const s of out.stars) {
        for (const m of alive()) {
          if (gs.distToSegment(m.x, m.y, s.x, s.y, hx, hy) <= width) hit(m, skill.back || 1, s.x, s.y);
        }
      }
      say(hx, hy, '🌀 RECALL!', '#c084fc', 15);
      return;
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
        if (gs.distToSegment(m.x, m.y, px, py, end.x, end.y) <= width) hit(m);
      }
    }
    if (isShadow) {
      // the shadow's stars come back with the hero's on recall
      if (player.nbStars) player.nbStars.stars.push(...stars);
    } else {
      player.nbStars = { slot, skillId: skill.id, stars, until: Date.now() + (skill.hold || 5) * 1000, zone, instanceId };
    }
    emit({ startX: px, startY: py, x: aimX, y: aimY, stars, ownerId: player.id, duration: skill.hold || 5 }, true);
  },

  smoke: (c) => {
    const { player, skill, gs, emit, hit, instanceId, isShadow, px, py, say, within, zone } = c;
    gs.smokeClouds.push({ zone, instanceId, x: px, y: py, r: skill.r, miss: skill.miss, until: Date.now() + skill.dur * 1000 });
    emit({ x: px, y: py, radius: skill.r, duration: skill.dur }, true);
    if (skill.dmg) within(px, py, skill.r).forEach((m: any) => hit(m));
    if (!isShadow) say(px, py, '💨 SMOKE BOMB', '#cbd5e1', 15);
  },

  shadow: (c) => {
    const { player, skill, gs, aimX, aimY, dir, emit, hit, instanceId, px, py, ray, say, within, zone } = c;
    const spotAt = ray(px, py, dir.normX, dir.normY, Math.hypot(aimX - px, aimY - py), 0.3);
    player.nbShadow = { x: spotAt.x, y: spotAt.y, mirror: skill.mirror, until: Date.now() + skill.dur * 1000, zone, instanceId };
    emit({ startX: px, startY: py, x: spotAt.x, y: spotAt.y, radius: skill.r, duration: skill.dur }, true);
    if (skill.dmg) within(spotAt.x, spotAt.y, skill.r).forEach((m: any) => hit(m, 1, spotAt.x, spotAt.y));
    say(spotAt.x, spotAt.y, '👤 SHADOW', '#a855f7', 15);
  },

  orbit: (c) => {
    const { player, skill, gs, emit, hit, isShadow, later, px, py, within } = c;
    const centre = () => (isShadow ? { x: px, y: py } : { x: player.x, y: player.y });
    emit({ x: px, y: py, radius: skill.r, n: skill.n, duration: skill.dur, followId: isShadow ? null : player.id }, true);
    const spin = () => {
      const c = centre();
      within(c.x, c.y, skill.r).forEach((m: any) => hit(m, 1, c.x, c.y));
    };
    spin();
    const ticks = Math.round(skill.dur / skill.every);
    for (let i = 1; i < ticks; i++) later(i * skill.every, spin);
  },

  orbs: (c) => {
    const { player, skill, gs, dir, emit, hit, later, px, py, ray, within } = c;
    const n = skill.n || 2, base = Math.atan2(dir.normY, dir.normX);
    const orbs: any = [];
    for (let i = 0; i < n; i++) {
      const ang = base + (n > 1 ? (i / (n - 1) * 2 - 1) * skill.spread : 0);
      const end = ray(px, py, Math.cos(ang), Math.sin(ang), skill.len, 0.3);
      orbs.push({ sx: px, sy: py, ex: end.x, ey: end.y });
    }
    emit({ x: px, y: py, orbs, radius: skill.r, duration: skill.dur }, true);
    const ticks = Math.round(skill.dur / skill.every);
    const shock = (i: any) => {
      const k = i / ticks;
      for (const o of orbs) {
        const ox = o.sx + (o.ex - o.sx) * k, oy = o.sy + (o.ey - o.sy) * k;
        within(ox, oy, skill.r).forEach((m: any) => hit(m, 1, ox, oy));
      }
    };
    for (let i = 1; i <= ticks; i++) later(i * skill.every, () => shock(i));
  },

  detonate: (c) => {
    const { player, skill, gs, applySkillDamage, emit, px, py, within, zone } = c;
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
        gs.emitZone(zone, 'floating_text', { x: m.x, y: m.y - 0.8, text: `💥 DETONATE! -${detonateDmg}`, color: '#22c55e', size: 18 });
      }
    }
    if (detonatedCount > 0) {
      gs.emitZone(zone, 'floating_text', { x: px, y: py - 0.8, text: `☣️ DETONATED ${detonatedCount} ENEMIES!`, color: '#86efac', size: 16 });
    }
  },

  blast: (c) => {
    const { player, skill, gs, aimX, aimY, emit, hit, plantRod, px, py, within } = c;
    c.spot = { x: aimX, y: aimY };
    emit({ x: aimX, y: aimY, startX: px, startY: py, radius: skill.r }, true);
    within(aimX, aimY, skill.r).forEach((m: any) => hit(m, 1, aimX, aimY));
    if (skill.rod) plantRod(aimX, aimY);
  },

  pull: (c) => {
    const { player, skill, gs, aimX, aimY, emit, hit, px, py, say, within, zone } = c;
    c.spot = { x: aimX, y: aimY };
    const isDreadRoar = skill.id === 'sp_void_grasp';
    const pullCenterX = isDreadRoar ? px : aimX;
    const pullCenterY = isDreadRoar ? py : aimY;
    emit({ x: pullCenterX, y: pullCenterY, radius: skill.r }, true);
    if (isDreadRoar) say(px, py, '💀 MOCKING DREAD ROAR!', '#c084fc', 17);
    for (const m of within(pullCenterX, pullCenterY, skill.r)) {
      const nx = pullCenterX + (m.x - pullCenterX) * (isDreadRoar ? 0.25 : 0.3);
      const ny = pullCenterY + (m.y - pullCenterY) * (isDreadRoar ? 0.25 : 0.3);
      if (!gs.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
      if (isDreadRoar) {
        m.attackCooldown = Math.max(m.attackCooldown || 0, 1.2);
        m.targetPlayerId = player.id;
      }
      hit(m, 1, pullCenterX, pullCenterY);
    }
  },

  cone: (c) => {
    const { player, skill, gs, dir, emit, hit, px, py, say, within } = c;
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
  },

  line: (c) => {
    const { player, skill, gs, alive, dir, emit, hit, later, px, py, say } = c;
    const ex = px + dir.normX * skill.len, ey = py + dir.normY * skill.len;
    emit({ startX: px, startY: py, x: ex, y: ey, width: skill.width }, true);
    if (skill.id === 'sp_abyss_cleave') say(px, py, '🪓 ABYSSAL GUILLOTINE!', '#c084fc', 17);
    for (const m of alive()) {
      if (gs.distToSegment(m.x, m.y, px, py, ex, ey) <= skill.width) hit(m);
    }
    if (skill.id === 'sp_abyss_cleave') {
      later(0.32, () => {
        emit({ startX: px, startY: py, x: ex, y: ey, width: skill.width * 1.15, wave: 1 }, false);
        for (const m of alive()) {
          if (gs.distToSegment(m.x, m.y, px, py, ex, ey) <= skill.width * 1.15) hit(m, 0.45);
        }
      });
    }
  },

  strike: (c) => {
    const { player, skill, gs, aimX, aimY, emit, hit, nearest, px, py, say } = c;
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
  },

  volley: (c) => {
    const { player, skill, gs, emit, hit, px, py, within } = c;
    const targets = within(px, py, skill.range)
      .sort((a: any, b: any) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
      .slice(0, skill.n);
    emit({ x: px, y: py, startX: px, startY: py, points: targets.map((m: any) => ({ x: m.x, y: m.y })) }, true);
    targets.forEach((m: any) => hit(m));
  },

  chain: (c) => {
    const { player, skill, gs, emit, hit, nearest, px, py } = c;
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
  },

  pulse: (c) => {
    const { player, skill, gs, aimX, aimY, emit, hit, later, nearest, px, py, say, within } = c;
    const onTarget = skill.at === 'target';
    let seekX = aimX, seekY = aimY, lastPrey: any = null;
    if (skill.id === 'sp_soul_bastion') {
      const missingShare = Math.max(0, 1 - (player.hp / Math.max(1, player.maxHp)));
      const bloodlustHeal = Math.max(1, Math.round(player.maxHp * (0.12 + 0.18 * missingShare)));
      player.hp = Math.min(player.maxHp, player.hp + bloodlustHeal);
      say(px, py, `🔥 UNDYING RAGE! (+${bloodlustHeal} HP)`, '#f43f5e', 18);
    }
    const wave = (i: any) => {
      let cx = onTarget ? seekX : player.x, cy = onTarget ? seekY : player.y;
      if (skill.seek) {
        // hop to a different enemy each pulse (stay put only if it is the last one)
        const prey = nearest(cx, cy, skill.seek, lastPrey ? new Set([lastPrey]) : null) || (lastPrey && lastPrey.state !== 'dead' ? lastPrey : nearest(cx, cy, skill.seek));
        if (prey) { lastPrey = prey; seekX = cx = prey.x; seekY = cy = prey.y; }
      }
      emit({ x: cx, y: cy, radius: skill.r, wave: i }, i === 0);
      within(cx, cy, skill.r).forEach((m: any) => hit(m, 1, cx, cy));
    };
    wave(0);
    for (let i = 1; i < skill.n; i++) later(i * skill.every, () => wave(i));
  },

  rain: (c) => {
    const { player, skill, gs, aimX, aimY, emit, hit, later, say, within } = c;
    if (skill.id === 'sp_grave_rain') say(aimX, aimY, '🪓 GUILLOTINE SKYFALL!', '#c084fc', 17);
    const strike = (i: any) => {
      const inArea = within(aimX, aimY, skill.r);
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * skill.r;
      const pick = inArea.length ? inArea[Math.floor(Math.random() * inArea.length)] : null;
      const sx = pick ? pick.x : aimX + Math.cos(a) * d, sy = pick ? pick.y : aimY + Math.sin(a) * d;
      emit({ x: sx, y: sy, radius: skill.hit, wave: i, areaX: aimX, areaY: aimY, areaR: skill.r }, i === 0);
      within(sx, sy, skill.hit).forEach((m: any) => hit(m, 1, sx, sy));
      if (skill.id === 'sp_grave_rain' && i === skill.n - 1) {
        within(aimX, aimY, skill.r).forEach((m: any) => hit(m, 0.75, aimX, aimY));
      }
    };
    strike(0);
    for (let i = 1; i < skill.n; i++) later(i * skill.every, () => strike(i));
  },

  dash: (c) => {
    const { player, skill, gs, alive, dir, emit, hit, px, py, slot, travel, zone } = c;
    const end = travel(skill.len);
    c.spot = { x0: px, y0: py, x1: end.x, y1: end.y };
    let resetDash = false;
    let spinHits = 0;
    for (const m of alive()) {
      if (gs.distToSegment(m.x, m.y, px, py, end.x, end.y) <= skill.width) {
        if (skill.resetOnStatic && m.staticCharge && m.staticCharge > 0) {
          m.staticCharge = 0;
          resetDash = true;
        }
        spinHits++;
        hit(m);
        if (skill.plow && m.state !== 'dead' && !m.isBoss) {
          const side = ((m.x - px) * -dir.normY + (m.y - py) * dir.normX) >= 0 ? 0.6 : -0.6;
          const nx = end.x + dir.normX * 0.8 - dir.normY * side, ny = end.y + dir.normY * 0.8 + dir.normX * side;
          if (!gs.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
        }
      }
    }
    if (resetDash) {
      player.skillCooldowns['dash'] = 0;
      player.skillCooldowns[slot] = 0;
      gs.emitZone(zone, 'floating_text', { x: end.x, y: end.y - 0.7, text: '⚡ DASH RESET!', color: '#facc15', size: 16 });
      const socket = gs.io.sockets.sockets.get(player.id);
      if (socket) socket.emit('player_updated', player);
    } else if (skill.spinReset && spinHits > 0) {
      const cdReduce = spinHits * skill.spinReset;
      player.skillCooldowns['dash'] = Math.max(0, (player.skillCooldowns['dash'] || 0) - cdReduce);
      if (player.skillCooldowns[slot] !== undefined) {
        player.skillCooldowns[slot] = Math.max(0, (player.skillCooldowns[slot] || 0) - cdReduce);
      }
      gs.emitZone(zone, 'floating_text', { x: end.x, y: end.y - 0.7, text: `🪓 SPIN SLAUGHTER -${cdReduce.toFixed(1)}s CD!`, color: '#c084fc', size: 15 });
      const socket = gs.io.sockets.sockets.get(player.id);
      if (socket) socket.emit('player_updated', player);
    }
    emit({ startX: px, startY: py, x: end.x, y: end.y, width: skill.width, facing: player.facing }, true);
  },

  backstep: (c) => {
    const { player, skill, gs, aimX, aimY, dir, emit, hit, isShadow, nearest, px, py, travel, zone } = c;
    const target = nearest(aimX, aimY, 3.5) || nearest(px, py, skill.range || 7);
    if (target) {
      const tdir = { normX: dir.normX || 1, normY: dir.normY || 0 };
      let destX = target.x - tdir.normX * 1.0;
      let destY = target.y - tdir.normY * 1.0;
      if (gs.isColliding(destX, destY, zone)) {
        destX = target.x + tdir.normX * 1.0;
        destY = target.y + tdir.normY * 1.0;
      }
      emit({ startX: px, startY: py, x: destX, y: destY, radius: 1.5 }, true);
      hit(target, 2.2);
      target.shadowMarkTimer = 6.0;
      if (!isShadow) {
        player.x = destX; player.y = destY;
        player.targetX = null; player.targetY = null;
        player.facing = gs.calculateFacing(destX, destY, target.x, target.y);
        gs.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '👤 SHADOWSTEP!', color: '#a855f7' });
        const socket = gs.io.sockets.sockets.get(player.id);
        if (socket) socket.emit('player_updated', player);
      }
    } else {
      const end = travel(skill.len || 6);
      emit({ startX: px, startY: py, x: end.x, y: end.y, radius: 1.5 }, true);
    }
  },

  blink: (c) => {
    const { player, skill, gs, emit, hit, isShadow, placeRune, px, py, say, travel, within, zone } = c;
    const end = travel(skill.len);
    emit({ startX: px, startY: py, x: end.x, y: end.y, radius: skill.r || 0, origin: !!(skill.origin || skill.originOnly), landing: !skill.originOnly && !!skill.dmg, facing: player.facing }, true);
    if (skill.id === 'sp_void_step') say(end.x, end.y, '🪓 OBLIVION SLAM!', '#c084fc', 17);
    if (skill.leaveRune && !isShadow && SP.SP_SKILLS[skill.leaveRune]) placeRune(SP.SP_SKILLS[skill.leaveRune], px, py, false);
    if (skill.riftPull) {
      within(px, py, skill.riftPull).forEach((m: any, i: any) => {
        const a = (i / 6) * Math.PI * 2;
        const nx = end.x + Math.cos(a) * 1.2, ny = end.y + Math.sin(a) * 1.2;
        if (!gs.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
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
      if (skill.origin || skill.originOnly) within(px, py, skill.r).forEach((m: any) => { struck.add(m); hit(m, 1, px, py); });
      if (!skill.originOnly) within(end.x, end.y, skill.r).filter((m: any) => !struck.has(m)).forEach((m: any) => hit(m, 1, end.x, end.y));
    }
  },

  alpha: (c) => {
    const { player, skill, gs, emit, hit, isShadow, later, nearest, px, py, travel, zone } = c;
    const struck = new Set();
    let from = { x: px, y: py };
    const hop = (i: number) => {
      const target = nearest(from.x, from.y, i === 0 ? skill.range : skill.jump, struck);
      if (!target) return false;
      struck.add(target);
      const d = Math.hypot(target.x - from.x, target.y - from.y) || 1;
      let lx = target.x - ((target.x - from.x) / d) * 0.9, ly = target.y - ((target.y - from.y) / d) * 0.9;
      if (gs.isColliding(lx, ly, zone)) { lx = target.x; ly = target.y; }
      if (!isShadow) {
        player.x = lx; player.y = ly;
        player.targetX = null; player.targetY = null;
        player.facing = gs.calculateFacing(lx, ly, target.x, target.y);
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
      return;
    }
    for (let i = 1; i < skill.n; i++) later(i * skill.every, () => hop(i));
  }

};
