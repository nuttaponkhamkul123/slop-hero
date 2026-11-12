// Gravelord: corpses left by dead monsters and the undead minions raised from them.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import { GRAVE_CORPSE_MS, GRAVE_CORPSE_MAX, MINION_MAX, MINION_SPEED, MINION_REACH, MINION_ATTACK_EVERY, MINION_AGGRO, MINION_LEASH } from '../config/constants';

export class MinionSystem {
  private minionSeq = 0; // ids of raised minions
  constructor(private readonly gs: GameServer) {}

  // ---- Gravelord: corpses and undead minions ----
  corpseKey(zone, instId) { return zone === 'dungeon' ? 'dungeon:' + (instId || '') : zone; }

  addCorpse(mob, zone, instId) {
    if (!this.gs.corpses) this.gs.corpses = new Map();
    const key = this.gs.corpseKey(zone, instId);
    const now = Date.now();
    const list = (this.gs.corpses.get(key) || []).filter(c => now - c.at < GRAVE_CORPSE_MS);
    list.push({ x: mob.x, y: mob.y, type: mob.type, hue: mob.hue || 0, scale: mob.scale || 1, name: mob.name, at: now });
    while (list.length > GRAVE_CORPSE_MAX) list.shift();
    this.gs.corpses.set(key, list);
  }

  // corpses within r of (x, y), nearest first (up to n), taken off the ground
  takeCorpses(zone, instId, x, y, r, n) {
    if (!this.gs.corpses) return [];
    const key = this.gs.corpseKey(zone, instId);
    const now = Date.now();
    const list = (this.gs.corpses.get(key) || []).filter(c => now - c.at < GRAVE_CORPSE_MS);
    const picks = list.filter(c => Math.hypot(c.x - x, c.y - y) <= r)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)).slice(0, n);
    this.gs.corpses.set(key, list.filter(c => !picks.includes(c)));
    return picks;
  }

  raiseMinion(player, corpse, skill) {
    const now = Date.now();
    const lvl = skill.dmg ? (skill.dmgMult || skill.dmg) / skill.dmg : 1;
    player.minions = (player.minions || []).filter(m => m.until > now);
    while (player.minions.length >= MINION_MAX) this.gs.crumbleMinion(player, player.minions.shift());
    player.minions.push({
      id: 'minion_' + (++this.minionSeq), type: corpse.type, hue: corpse.hue || 0, scale: Math.min(1.15, (corpse.scale || 1) * 0.95),
      name: corpse.thrall ? 'Grave Thrall' : `Risen ${corpse.name || 'Dead'}`,
      x: corpse.x, y: corpse.y, facing: 'S', born: now, until: now + skill.dur * 1000, dur: skill.dur * 1000,
      mult: skill.minion * lvl, nextAtk: now + 500, atkAt: 0, targetId: null,
      zone: player.zone, instanceId: player.dungeonInstanceId || null
    });
  }

  crumbleMinion(player, m) {
    if (!m) return;
    this.gs.emitZone(m.zone, 'skill_fx', { type: 'sp_skill', shape: 'crumble', element: 'earth', color: '#4ade80', cardId: 'sp_gravelord', skillId: 'sp_gravelord_raise', x: m.x, y: m.y, duration: 0.7 }, m.instanceId);
  }

  dismissMinions(player) {
    for (const m of player.minions || []) this.gs.crumbleMinion(player, m);
    player.minions = [];
  }

  // each tick: walk to the nearest enemy and strike it, or follow the lord
  tickMinions(player, dt) {
    const now = Date.now();
    const zone = player.zone, inst = player.dungeonInstanceId || null;
    const keep = [];
    for (const m of player.minions) {
      if (now >= m.until || m.zone !== zone || m.instanceId !== inst) this.gs.crumbleMinion(player, m);
      else keep.push(m);
    }
    player.minions = keep;
    if (!keep.length) return;
    const mobs = ([...this.gs.getMobsMap(zone).values()] as any[]).filter(o => o.state !== 'dead' && o.hp > 0 && !o.isDummy);
    const rage = player.minionRage && player.minionRage.until > now ? player.minionRage : null;
    const step = (m, tx, ty, speed) => {
      const d = Math.hypot(tx - m.x, ty - m.y);
      if (d < 0.05) return;
      const k = Math.min(1, (speed * dt) / d);
      const nx = m.x + (tx - m.x) * k, ny = m.y + (ty - m.y) * k;
      if (!this.gs.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
      else if (!this.gs.isColliding(nx, m.y, zone)) m.x = nx;
      else if (!this.gs.isColliding(m.x, ny, zone)) m.y = ny;
      m.facing = this.gs.calculateFacing(m.x, m.y, tx, ty);
    };
    keep.forEach((m, i) => {
      let tgt = m.targetId ? mobs.find(o => o.id === m.targetId) : null;
      if (tgt && (Math.hypot(tgt.x - player.x, tgt.y - player.y) > MINION_LEASH)) tgt = null;
      if (!tgt) {
        let best = null, bestD = MINION_AGGRO;
        for (const o of mobs) {
          if (Math.hypot(o.x - player.x, o.y - player.y) > MINION_LEASH) continue;
          const d = Math.hypot(o.x - m.x, o.y - m.y);
          if (d < bestD) { best = o; bestD = d; }
        }
        tgt = best;
        m.targetId = tgt ? tgt.id : null;
      }
      if (tgt) {
        const d = Math.hypot(tgt.x - m.x, tgt.y - m.y);
        if (d > MINION_REACH) step(m, tgt.x, tgt.y, MINION_SPEED * (rage ? 1.25 : 1));
        else {
          m.facing = this.gs.calculateFacing(m.x, m.y, tgt.x, tgt.y);
          if (now >= m.nextAtk) {
            // Grave Frenzy: harder, faster, and now and then a crit
            m.nextAtk = now + (MINION_ATTACK_EVERY / (rage ? 1 + rage.aspd : 1)) * 1000;
            m.atkAt = now;
            let dmg = player.dmg * m.mult * (rage ? 1 + rage.dmg : 1);
            const crit = !!rage && Math.random() < rage.crit;
            if (crit) dmg *= rage.critMult;
            this.gs.applyDamageToMob(player, tgt, Math.max(1, Math.round(dmg)), crit, true);
          }
        }
      } else {
        // no prey: fall in behind the lord, spread round him
        const a = (i / keep.length) * Math.PI * 2 + 0.6;
        const fx = player.x + Math.cos(a) * 1.6, fy = player.y + Math.sin(a) * 1.6;
        if (Math.hypot(fx - m.x, fy - m.y) > 0.6) step(m, fx, fy, MINION_SPEED * (Math.hypot(player.x - m.x, player.y - m.y) > 5 ? 1.6 : 1));
      }
    });
  }
}
