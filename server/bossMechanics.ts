// Slop Hero - Boss mechanics
//
// Bosses no longer just walk up and swing. Each one runs a moveset of telegraphed attacks: the
// server sends a `boss_telegraph` (a shape on the floor plus how long until it lands), the client
// paints a red danger zone that fills up, and when the timer runs out everyone still standing in
// the shape takes a heavy hit. Random dodge, smoke and riposte do not help against a telegraph:
// you dodge it by moving.
//
// Dungeon bosses fight in three phases:
//   Phase 1 (100-66% HP)  Slam, Cleave, Trample
//   Phase 2 (66-33%)      + Shockwave (a ring: get CLOSE), Meteor Rain; calls its guard
//   Phase 3 (<33%)        ENRAGED: hits harder, moves faster, casts more often;
//                         + Cross Beams, Cataclysm (three waves of meteors that follow you);
//                         calls its guard again
// Minibosses use the phase-1 kit only. Field raid bosses use all three phases but have no guard.
//
// The boss stands still while it winds up an attack, which is the melee window.
// Mob flags read here (set by the dungeon generator / raid spawner):
//   mechanics: 'boss' | 'miniboss'
//   mechWindup: windup multiplier (Hard / Nightmare telegraphs are shorter)
//   addTemplate: a mob definition to clone when the boss calls its guard

type Pt = { x: number; y: number };
type Shape =
  | { shape: 'circle'; x: number; y: number; r: number }
  | { shape: 'ring'; x: number; y: number; r0: number; r1: number }
  | { shape: 'cone'; x: number; y: number; angle: number; arc: number; range: number }
  | { shape: 'line'; x: number; y: number; x2: number; y2: number; width: number };

const BODY = 0.35; // a hero's radius for hit tests

// windup in seconds, mult = share of the boss's melee damage
const ATTACKS: Record<string, { windup: number; mult: number }> = {
  slam: { windup: 1.15, mult: 1.8 },
  cleave: { windup: 0.95, mult: 1.5 },
  charge: { windup: 1.05, mult: 1.6 },
  nova: { windup: 1.7, mult: 1.7 },
  meteors: { windup: 1.5, mult: 1.4 },
  beams: { windup: 1.45, mult: 1.6 },
  barrage: { windup: 1.15, mult: 1.3 }
};
const PHASE_KITS = [
  ['slam', 'cleave', 'charge'],
  ['slam', 'cleave', 'charge', 'nova', 'meteors'],
  ['cleave', 'charge', 'nova', 'meteors', 'beams', 'barrage']
];
const MINIBOSS_KIT = ['slam', 'cleave', 'charge'];
// seconds between casts, [min, max] per phase
const CAST_GAP = [[4, 6], [3.4, 5], [2.6, 3.8]];

// Attack names by the boss's element, shown over its head as it winds up
const NAMES: Record<string, Record<string, string>> = {
  fire: { slam: 'Magma Slam', cleave: 'Searing Cleave', charge: 'Blazing Trample', nova: 'Ring of Fire', meteors: 'Meteor Rain', beams: 'Flame Pillars', barrage: 'Inferno' },
  ice: { slam: 'Glacial Slam', cleave: 'Frost Cleave', charge: 'Avalanche', nova: 'Frost Ring', meteors: 'Hailstorm', beams: 'Ice Lances', barrage: 'Blizzard' },
  dark: { slam: 'Grave Slam', cleave: 'Reaping Cleave', charge: 'Death Charge', nova: 'Soul Shockwave', meteors: 'Shadow Rain', beams: 'Void Beams', barrage: 'Night Falls' },
  lightning: { slam: 'Thunder Slam', cleave: 'Arc Cleave', charge: 'Storm Rush', nova: 'Static Ring', meteors: 'Lightning Strikes', beams: 'Chain Beams', barrage: 'Tempest' },
  holy: { slam: 'Judgement', cleave: 'Radiant Cleave', charge: 'Zealous Charge', nova: 'Halo', meteors: 'Falling Stars', beams: 'Sun Beams', barrage: 'Divine Wrath' },
  earth: { slam: 'Earthquake', cleave: 'Boulder Swing', charge: 'Stampede', nova: 'Tremor Ring', meteors: 'Rockfall', beams: 'Fault Lines', barrage: 'Landslide' }
};
const COLORS: Record<string, string> = { fire: '#f97316', ice: '#38bdf8', dark: '#a855f7', lightning: '#facc15', holy: '#fde68a', earth: '#a3e635', neutral: '#ef4444' };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const angleDiff = (a: number, b: number) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return Math.abs(d); };

function inside(s: Shape, p: Pt): boolean {
  const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy);
  switch (s.shape) {
    case 'circle': return d <= s.r + BODY;
    case 'ring': return d >= s.r0 - BODY && d <= s.r1 + BODY;
    case 'cone': return d <= s.range + BODY && (d < 0.8 || angleDiff(Math.atan2(dy, dx), s.angle) <= s.arc / 2);
    case 'line': {
      const lx = s.x2 - s.x, ly = s.y2 - s.y, len2 = lx * lx + ly * ly || 1;
      const t = Math.max(0, Math.min(1, (dx * lx + dy * ly) / len2));
      return Math.hypot(p.x - (s.x + lx * t), p.y - (s.y + ly * t)) <= s.width / 2 + BODY;
    }
  }
  return false;
}

interface BossState {
  t: number;
  phase: number;
  nextAt: number;
  castUntil: number;
  last: string;
  steps: { at: number; run: () => void }[];
  dash: { x0: number; y0: number; x1: number; y1: number; el: number; dur: number } | null;
  enraged: boolean;
}

export function createBossMechanics(gs: any) {
  const states = new Map<string, BossState>();
  let seq = 0;

  function stateOf(mob: any): BossState {
    let st = states.get(mob.id);
    if (!st) {
      st = { t: 0, phase: 0, nextAt: 2.5, castUntil: 0, last: '', steps: [], dash: null, enraged: false };
      states.set(mob.id, st);
    }
    return st;
  }

  // Living heroes in the fight: same zone / instance, inside the boss's arena (with some slack)
  function heroesFor(mob: any, zone: string, instId: string | null) {
    const a = mob.zone || { minX: mob.x - 12, maxX: mob.x + 12, minY: mob.y - 12, maxY: mob.y + 12 };
    const out: any[] = [];
    for (const p of gs.players.values()) {
      if (p.isDead || p.zone !== zone || (instId && p.dungeonInstanceId !== instId)) continue;
      if (p.x < a.minX - 3 || p.x > a.maxX + 3 || p.y < a.minY - 3 || p.y > a.maxY + 3) continue;
      out.push(p);
    }
    return out;
  }

  function emit(zone: string, instId: string | null, ev: string, data: any) {
    gs.emitZone(zone, ev, data, instId);
  }

  // Paint shapes now; at `delay` seconds hit every hero inside any of them once
  function telegraph(mob: any, zone: string, instId: string | null, st: BossState, kind: string, shapes: Shape[], delay: number, onLand?: () => void) {
    const id = `bt_${++seq}`;
    const color = COLORS[mob.element] || COLORS.neutral;
    emit(zone, instId, 'boss_telegraph', { id, bossId: mob.id, kind, shapes, delay: Math.round(delay * 1000), color, element: mob.element || 'neutral' });
    st.steps.push({
      at: st.t + delay,
      run: () => {
        if (mob.state === 'dead' || mob.hp <= 0) return;
        const a = ATTACKS[kind] || { mult: 1.5 };
        for (const p of heroesFor(mob, zone, instId)) {
          if (shapes.some(s => inside(s, p))) gs.mobStrikePlayer(mob, p, zone, { mechanic: true, mult: a.mult * (st.enraged ? 1.2 : 1) });
        }
        if (onLand) onLand();
      }
    });
  }

  function say(mob: any, zone: string, instId: string | null, text: string, color = '#fca5a5', size = 18) {
    emit(zone, instId, 'floating_text', { x: mob.x, y: mob.y - 2.2, text, color, size });
  }

  // Walk from `from` toward `dir` until a wall, up to `len` tiles
  function reach(from: Pt, ang: number, len: number, zone: string) {
    const step = 0.25;
    let x = from.x, y = from.y;
    for (let d = 0; d < len; d += step) {
      const nx = x + Math.cos(ang) * step, ny = y + Math.sin(ang) * step;
      if (gs.isColliding(nx, ny, zone, 0.6)) break;
      x = nx; y = ny;
    }
    return { x, y };
  }

  function randomSpot(mob: any, zone: string): Pt | null {
    const a = mob.zone;
    if (!a) return null;
    for (let i = 0; i < 12; i++) {
      const x = rand(a.minX + 1.5, a.maxX - 1.5), y = rand(a.minY + 1.5, a.maxY - 1.5);
      if (!gs.isColliding(x, y, zone, 0.3)) return { x, y };
    }
    return null;
  }

  function cast(mob: any, zone: string, instId: string | null, st: BossState, heroes: any[]) {
    const kit = mob.mechanics === 'miniboss' ? MINIBOSS_KIT : PHASE_KITS[st.phase];
    const options = kit.filter(k => k !== st.last);
    const kind = options[Math.floor(Math.random() * options.length)];
    st.last = kind;
    const wind = ATTACKS[kind].windup * (mob.mechWindup || 1);
    const target = gs.players.get(mob.targetPlayerId) && heroes.includes(gs.players.get(mob.targetPlayerId))
      ? gs.players.get(mob.targetPlayerId) : heroes[Math.floor(Math.random() * heroes.length)];
    const toTarget = Math.atan2(target.y - mob.y, target.x - mob.x);
    const name = (NAMES[mob.element] || NAMES.dark)[kind];
    say(mob, zone, instId, `⚠ ${name.toUpperCase()}`);
    mob.facing = gs.calculateFacing(mob.x, mob.y, target.x, target.y);
    st.castUntil = st.t + wind + 0.35;

    switch (kind) {
      case 'slam':
        telegraph(mob, zone, instId, st, kind, [{ shape: 'circle', x: mob.x, y: mob.y, r: st.phase ? 4.2 : 3.6 }], wind);
        break;
      case 'cleave':
        telegraph(mob, zone, instId, st, kind, [{ shape: 'cone', x: mob.x, y: mob.y, angle: toTarget, arc: Math.PI * 0.7, range: 6.5 }], wind);
        break;
      case 'charge': {
        const len = Math.min(11, Math.hypot(target.x - mob.x, target.y - mob.y) + 3.5);
        const end = reach(mob, toTarget, len, zone);
        const from = { x: mob.x, y: mob.y };
        telegraph(mob, zone, instId, st, kind, [{ shape: 'line', x: from.x, y: from.y, x2: end.x, y2: end.y, width: 2.4 }], wind, () => {
          st.dash = { x0: mob.x, y0: mob.y, x1: end.x, y1: end.y, el: 0, dur: 0.3 };
        });
        break;
      }
      case 'nova':
        telegraph(mob, zone, instId, st, kind, [{ shape: 'ring', x: mob.x, y: mob.y, r0: 3.2, r1: 12 }], wind);
        break;
      case 'meteors': {
        const shapes: Shape[] = heroes.slice(0, 8).map(h => ({ shape: 'circle' as const, x: h.x, y: h.y, r: 1.9 }));
        for (let i = 0; i < 4; i++) { const s = randomSpot(mob, zone); if (s) shapes.push({ shape: 'circle', x: s.x, y: s.y, r: 1.9 }); }
        telegraph(mob, zone, instId, st, kind, shapes, wind);
        break;
      }
      case 'beams': {
        const base = Math.random() < 0.5 ? 0 : Math.PI / 4;
        const beams = (rot: number): Shape[] => [0, 1, 2, 3].map(k => {
          const e = reach(mob, rot + k * Math.PI / 2, 15, zone);
          return { shape: 'line' as const, x: mob.x, y: mob.y, x2: e.x, y2: e.y, width: 2.2 };
        });
        telegraph(mob, zone, instId, st, kind, beams(base), wind);
        // a second, rotated set right after: step out of the first, then sidestep the second
        st.steps.push({ at: st.t + wind * 0.75, run: () => { if (mob.hp > 0) telegraph(mob, zone, instId, st, kind, beams(base + Math.PI / 4), wind * 0.85); } });
        st.castUntil = st.t + wind * 1.6 + 0.35;
        break;
      }
      case 'barrage':
        // three waves, each aimed at where the heroes stand at that moment: keep moving
        for (let w = 0; w < 3; w++) {
          st.steps.push({
            at: st.t + w * 0.85,
            run: () => {
              if (mob.hp <= 0) return;
              const hs = heroesFor(mob, zone, instId).slice(0, 8);
              const shapes: Shape[] = hs.map(h => ({ shape: 'circle' as const, x: h.x, y: h.y, r: 2.1 }));
              const s = randomSpot(mob, zone);
              if (s) shapes.push({ shape: 'circle', x: s.x, y: s.y, r: 2.1 });
              if (shapes.length) telegraph(mob, zone, instId, st, kind, shapes, wind);
            }
          });
        }
        st.castUntil = st.t + 1.0;   // it keeps chasing while the sky falls
        break;
    }
    const gap = CAST_GAP[mob.mechanics === 'miniboss' ? 0 : st.phase];
    st.nextAt = st.castUntil + rand(gap[0], gap[1]) * (mob.mechanics === 'miniboss' ? 1.15 : 1);
  }

  // The boss calls its guard: clones of addTemplate rise around it
  function summonAdds(mob: any, zone: string, instId: string | null, heroes: any[]) {
    if (!mob.addTemplate || !instId) return;
    const inst = gs.dungeonInstances.get(instId);
    if (!inst) return;
    const n = Math.min(6, 2 + heroes.length);
    const spawned: any[] = [];
    for (let i = 0; i < n; i++) {
      let pos: Pt | null = null;
      for (let k = 0; k < 10 && !pos; k++) {
        const a = Math.random() * Math.PI * 2, r = rand(2.5, 5);
        const x = mob.x + Math.cos(a) * r, y = mob.y + Math.sin(a) * r;
        if (!gs.isColliding(x, y, zone, 0.4)) pos = { x, y };
      }
      if (!pos) continue;
      const add = JSON.parse(JSON.stringify(mob.addTemplate));
      Object.assign(add, {
        id: `${mob.id}_add_${++seq}`, x: pos.x, y: pos.y, spawnX: pos.x, spawnY: pos.y, roomIdx: mob.roomIdx,
        summonedBy: mob.id, state: 'chase', targetPlayerId: heroes[i % heroes.length].id,
        spawnUntil: Date.now() + 900, attackCooldown: 1.2
      });
      inst.mobs.set(add.id, add);
      spawned.push({ id: add.id, x: add.x, y: add.y, isBoss: false, element: add.element || 'dark' });
    }
    if (spawned.length) emit(zone, instId, 'dungeon_mobs_spawned', { mobs: spawned });
  }

  function enterPhase(mob: any, zone: string, instId: string | null, st: BossState, phase: number, heroes: any[]) {
    st.phase = phase;
    const name = String(mob.name || 'The boss').replace(/^\S+\s/, '').replace(/\s*\[.*\]$/, '');
    if (phase === 2) {
      st.enraged = true;
      if (!mob.mechBaseSpeed) mob.mechBaseSpeed = mob.speed;
      mob.speed = Math.round(mob.mechBaseSpeed * 1.2 * 100) / 100;
      say(mob, zone, instId, `🔥 ${name} is ENRAGED!`, '#ef4444', 24);
    } else {
      say(mob, zone, instId, `⚡ ${name} grows stronger!`, '#fbbf24', 22);
    }
    emit(zone, instId, 'skill_fx', { type: 'sp_skill', shape: 'nova', element: mob.element || 'dark', color: COLORS[mob.element] || COLORS.neutral, skillId: 'boss_phase', x: mob.x, y: mob.y, radius: 4 });
    summonAdds(mob, zone, instId, heroes);
    st.castUntil = st.t + 1.4;     // a roar before it starts the new moveset
    st.nextAt = st.castUntil + 0.6;
  }

  return {
    // Run once per tick for a boss with `mechanics`. Returns true while the boss is busy (winding
    // up, roaring or charging): the caller then skips its normal chase / melee for this tick.
    update(mob: any, zone: string, dt: number, instId: string | null): boolean {
      const st = stateOf(mob);
      st.t += dt;
      if (st.steps.length) {
        const due = st.steps.filter(s => s.at <= st.t);
        st.steps = st.steps.filter(s => s.at > st.t);
        for (const s of due) s.run();
      }
      if (st.dash) {
        const d = st.dash;
        d.el += dt;
        const k = Math.min(1, d.el / d.dur);
        mob.x = d.x0 + (d.x1 - d.x0) * k;
        mob.y = d.y0 + (d.y1 - d.y0) * k;
        if (k >= 1) { st.dash = null; mob.attackCooldown = Math.max(mob.attackCooldown || 0, 0.8); }
        return true;
      }
      if (mob.frozenTimer > 0 || mob.state !== 'chase') {
        st.nextAt = Math.max(st.nextAt, st.t + 1.5);
        return false;
      }
      const heroes = heroesFor(mob, zone, instId);
      if (!heroes.length) return false;
      if (mob.mechanics === 'boss') {
        const frac = mob.hp / mob.maxHp;
        const want = frac <= 0.33 ? 2 : frac <= 0.66 ? 1 : 0;
        if (want > st.phase) { enterPhase(mob, zone, instId, st, want, heroes); return true; }
      }
      if (st.castUntil > st.t) return true;
      if (st.t >= st.nextAt) { cast(mob, zone, instId, st, heroes); return true; }
      return false;
    },

    // The boss fell: wipe pending attacks (clients drop their telegraphs) and its guard crumbles
    onDeath(mob: any, zone: string, instId: string | null) {
      if (!mob.mechanics) return;
      states.delete(mob.id);
      emit(zone, instId, 'boss_telegraph_cancel', { bossId: mob.id });
      const inst = instId && gs.dungeonInstances.get(instId);
      if (!inst) return;
      for (const m of inst.mobs.values()) {
        if (m.summonedBy === mob.id && m.state !== 'dead') { m.state = 'dead'; m.hp = 0; }
      }
    },

    // A boss that reset (everyone left or died) starts over from phase 1
    reset(mob: any) {
      states.delete(mob.id);
      if (mob.mechBaseSpeed) mob.speed = mob.mechBaseSpeed;
    }
  };
}
