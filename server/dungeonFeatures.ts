// Slop Hero - Dungeon features
//
// What makes a run more than "open door, kill everything, next door":
//   * Room events   ambush, hold-the-ward, elite gauntlet, lights out, collapsing floor,
//                   cursed shrine, healing spring, mimic chests
//   * Boons         after each room a hero picks 1 of 3 run-only powers (lost when the run ends)
//   * Forked paths  the main path splits in two; walking up to one door seals the other
//   * Affixes       behaviour affixes (splitter, blinker, warden, reflector, summoner) and
//                   monster roles (caster, mender)
//   * Minibosses    one signature trait per floor, plus a floor-specific attack
//   * Secrets       cracked walls that open onto hidden treasure rooms
//   * Weekly seed   one fixed layout per week (per floor and difficulty) with a leaderboard
//   * Depth         +1..+10 on top of the difficulty: tougher monsters, bigger rewards,
//                   unlocked one step at a time per floor
//
// The generator calls planPath / decorateDungeon (they run under the weekly seed when there is
// one); everything else is called by the server: tick, filterRoomSpawn, onRoomCleared,
// onMobDeath, onMobHit, mobAI, applyRunBoons and the socket handlers.

import fs from 'fs';
import path from 'path';
import { dungeonProgressWeight, DUNGEON_PORTAL_SHARE } from './config/constants';

// ------------------------------------------------------------------ tiles (mirrors dungeonGenerator)
const T = { VOID: 8, WALL: 7, FLOOR: 4, CORRIDOR: 1 };
const OPEN = new Set([4, 1, 6, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51]);
const BLOCKING = new Set([41, 43, 47]);
// the hazard a collapsing floor turns into, by floor theme
const COLLAPSE_TILE: Record<string, number> = {
  dungeon_crypt: 48, dungeon_catacombs: 45, dungeon_obsidian: 44, dungeon_glacial: 46, dungeon_void: 49
};
const EMBERS = 44;

// ------------------------------------------------------------------ catalogs
export const ROOM_EVENTS: Record<string, { id: string; name: string; icon: string; desc: string }> = {
  ambush: { id: 'ambush', name: 'Ambush', icon: '⚠️', desc: 'The room looks quiet. It is not.' },
  ward: { id: 'ward', name: 'Hold the Ward', icon: '🔮', desc: 'Stand by the ward until it charges while waves pour in. A gold chest waits at the end.' },
  gauntlet: { id: 'gauntlet', name: 'Elite Gauntlet', icon: '⏱️', desc: 'Three elites. Beat them before the timer runs out for a gold chest.' },
  darkness: { id: 'darkness', name: 'Lights Out', icon: '🌑', desc: 'The room is pitch dark beyond your own light. An extra chest hides in it.' },
  collapse: { id: 'collapse', name: 'Collapsing Floor', icon: '🌋', desc: 'The floor breaks into hazards while the fight lasts.' }
};

// stat boons stack up to 3 times; each stack adds `per`
export const BOONS: Record<string, { id: string; name: string; icon: string; desc: string; per: number; max: number; tier: number }> = {
  might: { id: 'might', name: 'Might', icon: '⚔️', desc: '+{v}% damage', per: 10, max: 3, tier: 1 },
  vigor: { id: 'vigor', name: 'Vigor', icon: '❤️', desc: '+{v}% max HP', per: 12, max: 3, tier: 1 },
  bulwark: { id: 'bulwark', name: 'Bulwark', icon: '🛡️', desc: '+{v}% defense', per: 15, max: 3, tier: 1 },
  swiftness: { id: 'swiftness', name: 'Swiftness', icon: '💨', desc: '+{v}% move speed', per: 8, max: 3, tier: 1 },
  precision: { id: 'precision', name: 'Precision', icon: '🎯', desc: '+{v}% crit chance', per: 6, max: 3, tier: 1 },
  ruthless: { id: 'ruthless', name: 'Ruthless', icon: '🗡️', desc: '+{v}% crit damage', per: 25, max: 3, tier: 1 },
  frenzy: { id: 'frenzy', name: 'Frenzy', icon: '⚡', desc: '+{v}% attack speed', per: 12, max: 3, tier: 1 },
  focus: { id: 'focus', name: 'Focus', icon: '⏳', desc: '-{v}% skill cooldowns', per: 6, max: 3, tier: 1 },
  leech: { id: 'leech', name: 'Leech', icon: '🩸', desc: '+{v}% life steal', per: 1.5, max: 3, tier: 2 },
  bloodthirst: { id: 'bloodthirst', name: 'Bloodthirst', icon: '🍷', desc: 'Kills heal {v}% max HP', per: 2, max: 3, tier: 2 },
  siphon: { id: 'siphon', name: 'Soul Siphon', icon: '💧', desc: 'Kills restore {v}% max MP', per: 3, max: 3, tier: 2 },
  renewal: { id: 'renewal', name: 'Renewal', icon: '🌿', desc: 'Regenerate {v}% max HP per second', per: 0.6, max: 3, tier: 2 },
  detonate: { id: 'detonate', name: 'Corpse Blast', icon: '💥', desc: 'Kills explode for {v}% of your damage around them', per: 40, max: 3, tier: 3 },
  static: { id: 'static', name: 'Static Arc', icon: '🌩️', desc: 'Critical hits arc to a nearby enemy for {v}% of the hit', per: 30, max: 3, tier: 3 }
};

export const CURSES: Record<string, { id: string; name: string; icon: string; desc: string }> = {
  frail: { id: 'frail', name: 'Frail', icon: '🦴', desc: '-15% max HP' },
  sluggish: { id: 'sluggish', name: 'Sluggish', icon: '🐌', desc: '-10% move speed' },
  brittle: { id: 'brittle', name: 'Brittle', icon: '🧊', desc: '-20% defense' },
  drained: { id: 'drained', name: 'Drained', icon: '🥀', desc: '-40% HP and MP regeneration' }
};

// Behaviour affixes join the stat affixes of the generator's AFFIX_POOL
export const BEHAVIOUR_AFFIXES = [
  { id: 'splitter', name: 'Splitter', icon: '🧬', tag: '🧬 Splitter', desc: 'Splits in two when it dies' },
  { id: 'blinker', name: 'Blinker', icon: '🌀', tag: '🌀 Blinker', desc: 'Teleports behind its target' },
  { id: 'warden', name: 'Warden', icon: '🔰', tag: '🔰 Warden', desc: 'Shields nearby monsters' },
  { id: 'reflector', name: 'Reflector', icon: '🪞', tag: '🪞 Reflector', desc: 'Reflects part of the damage it takes' },
  { id: 'summoner', name: 'Summoner', icon: '📯', tag: '📯 Summoner', desc: 'Calls small adds' }
];
const BEHAVIOUR_IDS = new Set(BEHAVIOUR_AFFIXES.map(a => a.id));

// Miniboss signature per floor: a trait plus one attack from the boss kit
const MINIBOSS_TRAITS: Record<number, { trait: string; title: string; extra: string }> = {
  1: { trait: 'illusions', title: 'the Many-Faced', extra: 'nova' },
  2: { trait: 'frost', title: 'the Drowned Chill', extra: 'nova' },
  3: { trait: 'lava', title: 'the Molten', extra: 'meteors' },
  4: { trait: 'frost', title: 'the Winterheart', extra: 'meteors' },
  5: { trait: 'summoner', title: 'the Broodcaller', extra: 'meteors' },
  6: { trait: 'illusions', title: 'the Mirrored', extra: 'beams' },
  7: { trait: 'lava', title: 'the Cinderborn', extra: 'beams' },
  8: { trait: 'summoner', title: 'the Legion', extra: 'beams' },
  9: { trait: 'frost', title: 'the Hoarfrost', extra: 'barrage' },
  10: { trait: 'illusions', title: 'the Thousand Masks', extra: 'barrage' }
};
const TRAIT_DESC: Record<string, string> = {
  illusions: 'Hides among illusions at 70% and 35% HP',
  frost: 'Chills heroes who stand close',
  lava: 'Leaves burning embers where it walks',
  summoner: 'Calls adds every few seconds'
};

export const MAX_DEPTH = 10;
export const depthScaling = (d: number) => ({ hp: 1 + 0.12 * d, dmg: 1 + 0.08 * d, reward: 1 + 0.15 * d, affixChance: Math.min(1, 0.12 * d) });

// ------------------------------------------------------------------ small helpers
const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <X>(a: X[]): X => a[rnd(a.length)];
function shuffle<X>(a: X[]): X[] {
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const inRoom = (r: any, x: number, y: number, pad = 0) => x >= r.x - pad && x < r.x + r.w + pad && y >= r.y - pad && y < r.y + r.h + pad;

// seeded Math.random for the weekly dungeon (mulberry32)
export function withSeed<R>(seed: number | null, fn: () => R): R {
  if (seed === null || seed === undefined) return fn();
  let a = seed >>> 0;
  const orig = Math.random;
  Math.random = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try { return fn(); } finally { Math.random = orig; }
}
function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ------------------------------------------------------------------ layout: main path with forks
// Cells on a grid; the path walks from the entrance, and now and then splits into a 2x2 fork:
// A -> B or C -> D. `target` counts the rooms a run walks through (one side of each fork).
export function planPath(grid: number, target: number) {
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let best: any = null;
  for (let attempt = 0; attempt < 300; attempt++) {
    const cells: any[] = [];
    const used = new Set<string>();
    const add = (x: number, y: number) => { cells.push({ cx: x, cy: y }); used.add(x + ',' + y); return cells.length - 1; };
    const free = (x: number, y: number) => x >= 0 && y >= 0 && x < grid && y < grid && !used.has(x + ',' + y);
    add(1 + rnd(Math.max(1, grid - 2)), grid - 1 - rnd(2));
    const edges: number[][] = [], forks: any[] = [];
    let cur = 0, visited = 1, stuck = false;
    while (visited < target) {
      const c = cells[cur];
      let moved = false;
      if (visited >= 2 && target - visited >= 2 && Math.random() < 0.45) {
        for (const [ax, ay, bx, by] of shuffle([[1, 0, 0, 1], [1, 0, 0, -1], [-1, 0, 0, 1], [-1, 0, 0, -1]])) {
          const B = [c.cx + ax, c.cy + ay], C = [c.cx + bx, c.cy + by], D = [c.cx + ax + bx, c.cy + ay + by];
          if (!free(B[0], B[1]) || !free(C[0], C[1]) || !free(D[0], D[1])) continue;
          const b = add(B[0], B[1]), cc = add(C[0], C[1]), d = add(D[0], D[1]);
          edges.push([cur, b], [cur, cc], [b, d], [cc, d]);
          forks.push({ from: cur, options: [b, cc], join: d });
          cur = d; visited += 2; moved = true;
          break;
        }
      }
      if (!moved) {
        const dirs = shuffle(DIRS.slice()).filter(([dx, dy]) => free(c.cx + dx, c.cy + dy));
        if (!dirs.length) { stuck = true; break; }
        // prefer a step that still has somewhere to go afterwards
        dirs.sort((p, q) => {
          const open = (dx: number, dy: number) => DIRS.filter(([ex, ey]) => free(c.cx + dx + ex, c.cy + dy + ey)).length;
          return (open(q[0], q[1]) > 0 ? 1 : 0) - (open(p[0], p[1]) > 0 ? 1 : 0);
        });
        const n = add(c.cx + dirs[0][0], c.cy + dirs[0][1]);
        edges.push([cur, n]);
        cur = n; visited++;
      }
    }
    const plan = { cells, edges, forks, visited, end: cur, used };
    if (!stuck) return plan;
    if (!best || visited > best.visited) best = plan;
  }
  return best;
}

// Room kinds on the planned path: the fork sides get a lure (one usually a reward, the
// other a fight with a twist), the plain path gets 1-2 minibosses mid-way, a rare treasure
// room, and room events on about 40% of its fights.
export function assignRoomKinds(rooms: any[], plan: any) {
  const forkSides = new Set<number>();
  for (const f of plan.forks) {
    const lures = shuffle([
      pick([{ kind: 'treasure' }, { kind: 'shrine' }, { kind: 'spring' }, { kind: 'treasure' }]),
      pick([{ kind: 'combat', event: 'gauntlet' }, { kind: 'combat', event: 'ward' }, { kind: 'combat', event: 'darkness' }, { kind: 'miniboss' }])
    ]);
    f.options.forEach((ri: number, k: number) => { Object.assign(rooms[ri], lures[k]); forkSides.add(ri); });
  }
  const path = rooms.map((_, i) => i).filter(i => i > 0 && !forkSides.has(i));
  const mbCount = path.length >= 7 ? 2 : path.length >= 4 ? 1 : 0;
  const mid = path.slice(1, -1);
  for (let m = 0; m < mbCount && mid.length; m++) {
    const at = mid.splice(Math.floor(mid.length * (m ? 0.75 : 0.45)), 1)[0];
    rooms[at].kind = 'miniboss';
  }
  for (const i of path) {
    if (rooms[i].kind !== 'combat') continue;
    if (Math.random() < 0.08) { rooms[i].kind = 'treasure'; continue; }
    if (!rooms[i].event && Math.random() < 0.42) rooms[i].event = pick(['ambush', 'ambush', 'ward', 'gauntlet', 'darkness', 'collapse']);
  }
}

// Secret rooms: a 7x7 chamber in an empty grid cell next to a room, behind a cracked wall.
// Their tiles stay VOID (and unsent) until a hero finds the crack.
export function planSecrets(rooms: any[], plan: any, grid: number, cellSize: number, count: number) {
  const secrets: any[] = [];
  const cands = shuffle(rooms.map((r, i) => i).filter(i => i > 0 && !rooms[i].arena && rooms[i].kind !== 'shrine' && rooms[i].kind !== 'spring'));
  const taken = new Set<string>();
  for (const ri of cands) {
    if (secrets.length >= count) break;
    const r = rooms[ri];
    for (const [dx, dy] of shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]])) {
      const nx = r.grid.x + dx, ny = r.grid.y + dy;
      if (nx < 0 || ny < 0 || nx >= grid || ny >= grid || plan.used.has(nx + ',' + ny) || taken.has(nx + ',' + ny)) continue;
      // no other room may already have a door on this side (doors sit on the side middles)
      taken.add(nx + ',' + ny);
      const S = 7;
      const sx = 2 + nx * cellSize + (cellSize - S) / 2, sy = 2 + ny * cellSize + (cellSize - S) / 2;
      const room = { x: sx, y: sy, w: S, h: S, cx: sx + (S - 1) / 2, cy: sy + (S - 1) / 2 };
      const tiles: number[][] = [];
      for (let y = sy; y < sy + S; y++) for (let x = sx; x < sx + S; x++) tiles.push([x, y]);
      // a 3-wide tunnel from the room's side middle to the chamber's
      let crack: any, hint: any;
      if (dx) {
        const x0 = dx > 0 ? r.x + r.w : sx + S, x1 = dx > 0 ? sx - 1 : r.x - 1;
        for (let x = x0; x <= x1; x++) for (let k = -1; k <= 1; k++) tiles.push([x, r.cy + k]);
        crack = { x: dx > 0 ? r.x + r.w : r.x - 1, y: r.cy };
        hint = { x: (dx > 0 ? r.x + r.w - 1 : r.x) + 0.5, y: r.cy + 0.5 };
      } else {
        const y0 = dy > 0 ? r.y + r.h : sy + S, y1 = dy > 0 ? sy - 1 : r.y - 1;
        for (let y = y0; y <= y1; y++) for (let k = -1; k <= 1; k++) tiles.push([r.cx + k, y]);
        crack = { x: r.cx, y: dy > 0 ? r.y + r.h : r.y - 1 };
        hint = { x: r.cx + 0.5, y: (dy > 0 ? r.y + r.h - 1 : r.y) + 0.5 };
      }
      secrets.push({ id: 'secret_' + secrets.length, room: ri, chamber: room, tiles, crack, hint, side: dx ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N') });
      break;
    }
  }
  return secrets;
}
export function shiftSecrets(secrets: any[], ox: number, oy: number) {
  for (const s of secrets) {
    s.tiles = s.tiles.map(([x, y]: number[]) => [x - ox, y - oy]);
    for (const p of [s.chamber, s.crack, s.hint]) { p.x -= ox; p.y -= oy; }
    s.chamber.cx -= ox; s.chamber.cy -= oy;
  }
}

// ------------------------------------------------------------------ decorate (inside the generator)
// Called by finishDungeon once walls, chests and monsters exist. Adds the event props, elites,
// roles and behaviour affixes, miniboss traits, mimics and the secret cracks. Server-only
// details go in `hidden`, which the instance keeps and clients never see.
export function decorateDungeon(o: any) {
  const { floorLevel, diff, rooms, mobs, chests, obstacles, style, mode } = o;
  const hidden: any = { events: {}, mimics: [], secrets: o.secrets || [], forks: o.forks || [] };
  const roomMobs = (i: number) => mobs.filter((m: any) => m.roomIdx === i);

  rooms.forEach((r: any, i: number) => {
    if (r.arena || i === 0) return;
    // Rush halls fill all at once: only the event-free twists apply there
    if (mode === 'rush' && r.event && r.event !== 'darkness') r.event = null;
    if (r.kind === 'shrine') {
      obstacles.push({ id: `dungeon_shrine_${i}`, x: r.cx + 0.5, y: r.cy + 0.5, type: 'dungeon_shrine', room: i, collidable: false });
      return;
    }
    if (r.kind === 'spring') {
      obstacles.push({ id: `dungeon_spring_${i}`, x: r.cx + 0.5, y: r.cy + 0.5, type: 'dungeon_spring', room: i, collidable: false });
      return;
    }
    if (r.kind === 'treasure') {
      const mine = chests.filter((c: any) => c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h);
      if (mine.length && Math.random() < 0.4) hidden.mimics.push((pick(mine) as any).id);
      return;
    }
    const ev = r.event;
    if (!ev) return;
    if (ev === 'ward') {
      obstacles.push({ id: `dungeon_ward_${i}`, x: r.cx + 0.5, y: r.cy + 0.5, type: 'dungeon_ward', room: i, progress: 0, collidable: false });
    }
    if (ev === 'gauntlet') {
      // three elites instead of a crowd
      const list = roomMobs(i);
      const keep = list.slice(0, 3);
      for (const m of list.slice(3)) mobs.splice(mobs.indexOf(m), 1);
      keep.forEach((m: any) => {
        m.maxHp = Math.round(m.maxHp * 4); m.hp = m.maxHp;
        m.dmg = Math.round(m.dmg * 1.5);
        m.scale = (m.scale || 1) * 1.3;
        m.exp = Math.round((m.exp || 0) * 4); m.gold = Math.round((m.gold || 0) * 3);
        m.buffs = (m.buffs || []).filter((b: string) => !BEHAVIOUR_IDS.has(b));
        for (const b of shuffle(BEHAVIOUR_AFFIXES.map(a => a.id).filter(id => id !== 'splitter')).slice(0, 2)) m.buffs.push(b);
        m.isElite = true;
        m.name = `★ Elite ${m.name.replace(/^[^A-Za-z]+/, '')}`;
      });
    }
    if (ev === 'darkness') {
      // the dark hides an extra chest
      const spot = o.randomFloor(r, 2);
      chests.push({ id: `chest_dark_${i}`, x: Math.floor(spot.x), y: Math.floor(spot.y), isGold: Math.random() < 0.5, opened: false, floorLevel, difficulty: diff.id });
    }
    hidden.events[i] = { type: ev };
    // the client is told about every event but the ambush
    if (ev === 'ambush') delete r.event;
  });

  // Monster roles and behaviour affixes on ordinary monsters
  const behaviourChance = diff.id === 'nightmare' ? 0.35 : diff.id === 'hard' ? 0.25 : 0.12;
  const byRoom = new Map<number, any[]>();
  for (const m of mobs) {
    if (m.isBoss || m.isMiniboss || m.isGuard || m.isElite) continue;
    if (!byRoom.has(m.roomIdx)) byRoom.set(m.roomIdx, []);
    byRoom.get(m.roomIdx).push(m);
  }
  for (const list of byRoom.values()) {
    shuffle(list);
    const casters = Math.max(list.length >= 5 ? 1 : 0, Math.round(list.length * 0.15));
    const menders = list.length >= 8 && Math.random() < 0.6 ? 1 : 0;
    list.forEach((m, k) => {
      if (k < casters) { m.role = 'caster'; m.name = `✦ ${m.name}`; m.maxHp = Math.round(m.maxHp * 0.7); m.hp = m.maxHp; }
      else if (k < casters + menders) { m.role = 'mender'; m.name = `✚ ${m.name}`; m.maxHp = Math.round(m.maxHp * 0.8); m.hp = m.maxHp; }
      else if (Math.random() < behaviourChance) {
        const b = pick(BEHAVIOUR_AFFIXES);
        if (!m.buffs.includes(b.id)) { m.buffs.push(b.id); m.name = `${b.icon} ${m.name}`; }
      }
    });
  }

  // Miniboss signatures
  const sig = MINIBOSS_TRAITS[floorLevel] || MINIBOSS_TRAITS[1];
  for (const m of mobs) {
    if (!m.isMiniboss) continue;
    m.trait = sig.trait;
    m.minibossKit = ['slam', 'cleave', 'charge', sig.extra];
    m.name = m.name.replace(/\s*\[Lv\./, ` ${sig.title} [Lv.`);
    m.traitDesc = TRAIT_DESC[sig.trait];
  }

  // Secret cracks: a hint on the floor in front of the cracked wall
  for (const s of hidden.secrets) {
    obstacles.push({ id: `dungeon_crack_${s.id}`, x: s.hint.x, y: s.hint.y, type: 'dungeon_crack', side: s.side, collidable: false });
  }

  for (const m of mobs) if (m.role || m.trait || (m.buffs || []).some((b: string) => BEHAVIOUR_IDS.has(b))) m.dfAI = true;
  void style;
  return hidden;
}

// ------------------------------------------------------------------ instance setup
export function setupInstance(inst: any, hidden: any, opts: { depth: number; weekly: string | null }) {
  inst.df = {
    events: hidden ? hidden.events : {},
    mimics: new Set(hidden ? hidden.mimics : []),
    secrets: hidden ? hidden.secrets : [],
    forks: (hidden ? hidden.forks : []).map((f: any) => ({ ...f, chosen: null })),
    sealed: new Set<number>(),
    springUsed: new Set<string>(),
    shrineUsed: new Set<string>(),
    hadMobs: new Set<number>(),
    tileReverts: new Map<number, number[][]>(),   // roomIdx -> [[x, y, original]]
    lavaTiles: [] as number[][],
    seq: 0,
    t: 0,
    depth: opts.depth || 0,
    weekly: opts.weekly || null
  };
}

export function applyDepthToMob(mob: any, depth: number) {
  if (!depth) return mob;
  const s = depthScaling(depth);
  mob.maxHp = Math.round(mob.maxHp * s.hp); mob.hp = mob.maxHp;
  mob.dmg = Math.round((mob.dmg || 0) * s.dmg);
  if (mob.exp) mob.exp = Math.round(mob.exp * s.reward);
  if (mob.gold) mob.gold = Math.round(mob.gold * s.reward);
  if (!mob.isBoss && !mob.isMiniboss && !mob.role && Math.random() < s.affixChance) {
    const b = pick(BEHAVIOUR_AFFIXES);
    if (!mob.buffs.includes(b.id)) { mob.buffs.push(b.id); mob.name = `${b.icon} ${mob.name}`; mob.dfAI = true; }
  }
  return mob;
}

// ------------------------------------------------------------------ weekly dungeon
export function weekId(now = Date.now()) {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7;                 // Monday = 0
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const firstThu = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((thursday.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
export function weeklySeed(week: string, floor: number, difficulty: string) {
  return hashStr(`${week}|${floor}|${difficulty}`);
}
// two fixed modifiers for the week (same for every floor)
export function weeklyMods(week: string, modIds: string[]) {
  return withSeed(hashStr('mods|' + week), () => shuffle(modIds.slice()).slice(0, 2));
}

const DATA_DIR = process.env.DATA_DIR || (
  fs.existsSync(path.join(__dirname, 'data')) ? path.join(__dirname, 'data') : path.join(process.cwd(), 'server', 'data')
);
const BOARD_FILE = () => path.join(DATA_DIR, 'weekly_dungeon.json');
let board: Record<string, any[]> | null = null;
function loadBoard() {
  if (board) return board;
  try { board = JSON.parse(fs.readFileSync(BOARD_FILE(), 'utf8')); } catch (_) { board = {}; }
  return board;
}
function saveBoard() {
  try { fs.writeFile(BOARD_FILE(), JSON.stringify(board), () => {}); } catch (_) { /* best effort */ }
}
const boardKey = (week: string, floor: number, difficulty: string) => `${week}|${floor}|${difficulty}`;
export function weeklyEntries(week: string, floor: number, difficulty: string) {
  const b = loadBoard();
  return (b[boardKey(week, floor, difficulty)] || []).slice(0, 20);
}
// Keep each hero's best (rank first, then time); returns the hero's placement
export function recordWeekly(week: string, floor: number, difficulty: string, entry: any) {
  const b = loadBoard();
  const key = boardKey(week, floor, difficulty);
  const list = b[key] || [];
  const order = (e: any) => ('SABC'.indexOf(e.rank)) * 1e9 + e.timeMs;
  const old = list.find((e: any) => e.name === entry.name);
  if (!old || order(entry) < order(old)) {
    if (old) list.splice(list.indexOf(old), 1);
    list.push(entry);
  }
  list.sort((p: any, q: any) => order(p) - order(q));
  b[key] = list.slice(0, 50);
  // forget weeks older than the last four
  const weeks = [...new Set(Object.keys(b).map(k => k.split('|')[0]))].sort();
  for (const w of weeks.slice(0, Math.max(0, weeks.length - 4))) for (const k of Object.keys(b)) if (k.startsWith(w + '|')) delete b[k];
  saveBoard();
  return 1 + b[key].findIndex((e: any) => e.name === entry.name);
}

// ------------------------------------------------------------------ runtime helpers
function heroesIn(gs: any, inst: any) {
  const out: any[] = [];
  for (const p of gs.players.values()) if (p.zone === 'dungeon' && p.dungeonInstanceId === inst.id) out.push(p);
  return out;
}
function walkable(inst: any, x: number, y: number, r = 0.35) {
  const tiles = inst.dungeon.tiles;
  for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
    const row = tiles[Math.floor(y + dy)];
    const t = row && row[Math.floor(x + dx)];
    if (t === undefined || !OPEN.has(t) || BLOCKING.has(t)) return false;
  }
  return true;
}
function emit(gs: any, inst: any, ev: string, data: any) { gs.emitZone('dungeon', ev, data, inst.id); }
function say(gs: any, inst: any, x: number, y: number, text: string, color = '#facc15', size = 22) {
  emit(gs, inst, 'floating_text', { x, y, text, color, size });
}
function roomFloorSpot(inst: any, r: any, nearWall = false) {
  for (let i = 0; i < 30; i++) {
    let x, y;
    if (nearWall) {
      const side = rnd(4);
      x = side < 2 ? r.x + 1 + Math.random() * (r.w - 2) : (side === 2 ? r.x + 1.2 : r.x + r.w - 1.2);
      y = side >= 2 ? r.y + 1 + Math.random() * (r.h - 2) : (side === 0 ? r.y + 1.2 : r.y + r.h - 1.2);
    } else {
      x = r.x + 1.5 + Math.random() * (r.w - 3); y = r.y + 1.5 + Math.random() * (r.h - 3);
    }
    if (walkable(inst, x, y)) return { x, y };
  }
  return { x: r.cx + 0.5, y: r.cy + 0.5 };
}
function setTiles(gs: any, inst: any, changes: number[][]) {
  if (!changes.length) return;
  for (const [x, y, t] of changes) if (inst.dungeon.tiles[y]) inst.dungeon.tiles[y][x] = t;
  emit(gs, inst, 'dungeon_tiles_changed', { tiles: changes });
}
function nearestHero(gs: any, inst: any, x: number, y: number, max = Infinity) {
  let best: any = null, bd = max;
  for (const p of heroesIn(gs, inst)) {
    if (p.isDead) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
function spawnChest(gs: any, inst: any, x: number, y: number, isGold: boolean, tag: string) {
  const c = { id: `chest_${tag}_${++inst.df.seq}`, x: Math.floor(x), y: Math.floor(y), isGold, opened: false, floorLevel: inst.floor, difficulty: inst.difficulty };
  inst.chests.push(c);
  emit(gs, inst, 'skill_fx', { type: 'set_proc', set: 'radiant', x: c.x + 0.5, y: c.y + 0.5, radius: 1.4, color: '#facc15' });
  return c;
}
// A runtime monster cloned from `base` (splits, summons, illusions, ward waves)
function spawnMobFrom(gs: any, inst: any, base: any, x: number, y: number, o: any = {}) {
  const id = `df_${inst.id}_${++inst.df.seq}`;
  const hp = Math.max(1, Math.round(o.hp !== undefined ? o.hp : base.maxHp));
  const m: any = {
    id, type: base.type, name: o.name || base.name, level: base.level, hue: base.hue || 0, scale: o.scale || base.scale || 1,
    element: base.element, elementResist: base.elementResist || {}, dmg: Math.round((base.dmg || 10) * (o.dmgMult || 1)), def: base.def || 0,
    speed: base.speed || 2.3, exp: Math.round((base.exp || 0) * (o.rewardMult !== undefined ? o.rewardMult : 1)),
    gold: Math.round((base.gold || 0) * (o.rewardMult !== undefined ? o.rewardMult : 1)),
    x, y, spawnX: x, spawnY: y, zone: base.zone, roomIdx: base.roomIdx, dungeonInstanceId: inst.id,
    hp, maxHp: hp, isBoss: false, buffs: o.buffs || [], isCommander: false, auraRadius: 0, hasCommanderBuff: false,
    state: o.targetId ? 'chase' : 'idle', targetPlayerId: o.targetId || null, nextWanderTime: Date.now() + 1500, wanderTarget: null,
    attackCooldown: 1.0, respawnTimer: Infinity, facing: 'SE', spawnUntil: Date.now() + (o.rise !== undefined ? o.rise : 700),
    noProgress: o.noProgress !== false
  };
  if (o.extra) Object.assign(m, o.extra);
  inst.mobs.set(id, m);
  return m;
}
function announceSpawns(gs: any, inst: any, list: any[]) {
  if (list.length) emit(gs, inst, 'dungeon_mobs_spawned', { mobs: list.map(m => ({ id: m.id, x: m.x, y: m.y, isBoss: false, element: m.element || 'neutral' })) });
}

// ------------------------------------------------------------------ rooms: spawning and clearing
// Called with the monsters a room is about to release: ambush and ward rooms hold some back.
export function filterRoomSpawn(gs: any, inst: any, roomIdx: number, list: any[]) {
  const df = inst.df;
  if (!df) return list;
  if (list.length) df.hadMobs.add(roomIdx);
  const ev = df.events[roomIdx];
  if (!ev || ev.started) return list;
  ev.started = true;
  ev.t = 0;
  const r = inst.dungeon.rooms[roomIdx];
  if (ev.type === 'ambush') {
    shuffle(list);
    const now = Math.max(2, Math.round(list.length * 0.3));
    ev.held = list.slice(now);
    return list.slice(0, now);
  }
  if (ev.type === 'ward') {
    ev.held = list.slice();
    ev.progress = 0;
    ev.nextWave = 1.5;
    ev.perWave = Math.max(2, Math.ceil(list.length / 6));
    return [];
  }
  if (ev.type === 'gauntlet') ev.limit = 50;
  if (ev.type === 'collapse') ev.next = 2.5;
  void r;
  return list;
}

// An event starts (timers, waves, announcements) once a hero sets foot in its room
function activate(gs: any, inst: any, i: number, ev: any) {
  const r = inst.dungeon.rooms[i];
  ev.active = true;
  ev.t = 0;
  const at = (text: string, color: string, size = 24) => say(gs, inst, r.cx + 0.5, r.cy - 1, text, color, size);
  if (ev.type === 'ward') at('🔮 HOLD THE WARD!', '#a78bfa');
  if (ev.type === 'gauntlet') {
    at('⏱️ ELITE GAUNTLET: ' + ev.limit + 's', '#fbbf24');
    emit(gs, inst, 'dungeon_event', { room: i, type: 'gauntlet', state: 'start', seconds: ev.limit });
  }
  if (ev.type === 'darkness') at('🌑 THE LIGHTS GO OUT', '#94a3b8', 22);
  if (ev.type === 'collapse') at('🌋 THE FLOOR IS GIVING WAY', '#fb923c', 22);
}

// A room may not count as cleared while it still holds monsters back or its ward is charging
export function roomBusy(inst: any, roomIdx: number) {
  const ev = inst.df && inst.df.events[roomIdx];
  if (!ev) return false;
  if (ev.held && ev.held.length) return true;
  if (ev.type === 'ward' && ev.started && (ev.progress || 0) < 1) return true;
  return false;
}
export function isSealed(inst: any, roomIdx: number) { return !!(inst.df && inst.df.sealed.has(roomIdx)); }
export function sealedCount(inst: any) { return inst.df ? inst.df.sealed.size : 0; }

export function onRoomCleared(gs: any, inst: any, roomIdx: number) {
  const df = inst.df;
  if (!df) return;
  const r = inst.dungeon.rooms[roomIdx];
  const ev = df.events[roomIdx];
  if (ev && ev.type === 'collapse') revertRoomTiles(gs, inst, roomIdx);
  if (ev && ev.type === 'gauntlet' && !ev.done) {
    ev.done = true;
    if (ev.t <= ev.limit) {
      spawnChest(gs, inst, r.cx, r.cy, true, 'gauntlet');
      say(gs, inst, r.cx + 0.5, r.cy - 1, `⏱️ GAUNTLET BEATEN IN ${Math.ceil(ev.t)}s!`, '#fbbf24', 24);
    }
    emit(gs, inst, 'dungeon_event', { room: roomIdx, type: 'gauntlet', state: 'end', won: ev.t <= ev.limit });
  }
  if (roomIdx > 0 && df.hadMobs.has(roomIdx)) {
    for (const p of heroesIn(gs, inst)) offerBoon(gs, p);
  }
}

// ------------------------------------------------------------------ forks
export function isChoiceDoor(d: any) { return !!d.choice; }
function chooseFork(gs: any, inst: any, fork: any, pickIdx: number) {
  const dung = inst.dungeon;
  fork.chosen = pickIdx;
  const other = fork.options.find((o: number) => o !== pickIdx);
  const sealed: string[] = [];
  for (const d of dung.doors) {
    if (d.from === fork.from && d.to === pickIdx) d.choice = false;   // opens on the next room pass
    if ((d.from === fork.from && d.to === other) || d.from === other) {
      d.sealed = true; d.choice = false;
      sealed.push(d.id);
      const ob = dung.obstacles.find((o: any) => o.id === d.id);
      if (ob) { ob.sealed = true; ob.choice = false; }
    }
  }
  inst.df.sealed.add(other);
  // the sealed side's monsters never come: take them out of the purge count
  const left = (inst.pendingMobs && inst.pendingMobs.get(other)) || [];
  if (inst.pendingMobs) inst.pendingMobs.delete(other);
  const SHARE = DUNGEON_PORTAL_SHARE;
  const lost = left.reduce((t: number, m: any) => t + dungeonProgressWeight(m), 0);
  inst.totalWeight = Math.max(1, (inst.totalWeight || 1) - lost);
  inst.requiredKills = Math.max(1, Math.round(inst.totalWeight * SHARE));
  inst.killPercent = Math.min(100, Math.floor(((inst.killedTrashCount || 0) / inst.requiredKills) * 100));
  const pr = dung.rooms[pickIdx];
  emit(gs, inst, 'dungeon_doors_sealed', { doors: sealed, room: other, chosen: pickIdx });
  say(gs, inst, pr.cx + 0.5, pr.cy - 1, '🔀 PATH CHOSEN - THE OTHER WAY COLLAPSES', '#c4b5fd', 20);
}
function tickForks(gs: any, inst: any) {
  const df = inst.df, dung = inst.dungeon;
  if (!df.forks.length) return;
  const heroes = heroesIn(gs, inst).filter(p => !p.isDead);
  for (const f of df.forks) {
    if (f.chosen !== null || !inst.roomsCleared || !inst.roomsCleared.has(f.from)) continue;
    for (const d of dung.doors) {
      if (d.from !== f.from || !f.options.includes(d.to) || d.sealed) continue;
      if (heroes.some(p => Math.hypot(p.x - d.x, p.y - d.y) <= 1.9)) { chooseFork(gs, inst, f, d.to); break; }
    }
  }
}

// ------------------------------------------------------------------ the per-tick update
export function tick(gs: any, inst: any, dt: number) {
  const df = inst.df;
  if (!df || !inst.dungeon || !inst.dungeon.rooms) return;
  df.t += dt;
  tickForks(gs, inst);
  const rooms = inst.dungeon.rooms;
  const heroes = heroesIn(gs, inst).filter(p => !p.isDead);

  for (const key of Object.keys(df.events)) {
    const i = Number(key), ev = df.events[i], r = rooms[i];
    if (!ev.started || (inst.roomsCleared && inst.roomsCleared.has(i))) continue;
    if (!ev.active) {
      if (!heroes.some(p => inRoom(r, p.x, p.y))) continue;
      activate(gs, inst, i, ev);
    }
    ev.t = (ev.t || 0) + dt;
    const alive = () => { let n = 0; for (const m of inst.mobs.values()) if (m.roomIdx === i && m.state !== 'dead' && m.hp > 0) n++; return n; };

    if (ev.type === 'ambush' && ev.held && ev.held.length) {
      const close = heroes.some(p => Math.hypot(p.x - (r.cx + 0.5), p.y - (r.cy + 0.5)) < 3);
      if (close || alive() === 0 || ev.t > 12) {
        const list = ev.held; ev.held = [];
        for (const m of list) {
          const s = roomFloorSpot(inst, r, true);
          Object.assign(m, { x: s.x, y: s.y, spawnX: s.x, spawnY: s.y, spawnUntil: Date.now() + 900, dungeonInstanceId: inst.id });
          const t = nearestHero(gs, inst, s.x, s.y);
          if (t) { m.state = 'chase'; m.targetPlayerId = t.id; }
          inst.mobs.set(m.id, m);
        }
        announceSpawns(gs, inst, list);
        say(gs, inst, r.cx + 0.5, r.cy - 1, '⚠️ AMBUSH!', '#ef4444', 28);
        emit(gs, inst, 'dungeon_event', { room: i, type: 'ambush', state: 'sprung' });
      }
    }

    if (ev.type === 'ward' && ev.progress < 1) {
      const ward = inst.dungeon.obstacles.find((o: any) => o.id === `dungeon_ward_${i}`);
      const wx = r.cx + 0.5, wy = r.cy + 0.5;
      const holding = heroes.some(p => Math.hypot(p.x - wx, p.y - wy) <= 2.4);
      ev.progress = Math.max(0, Math.min(1, ev.progress + (holding ? dt / 25 : -dt / 60)));
      ev.nextWave -= dt;
      if (ev.nextWave <= 0 && ev.held.length) {
        ev.nextWave = 4.5;
        const wave = ev.held.splice(0, ev.perWave);
        for (const m of wave) {
          const s = roomFloorSpot(inst, r, true);
          Object.assign(m, { x: s.x, y: s.y, spawnX: s.x, spawnY: s.y, spawnUntil: Date.now() + 800, dungeonInstanceId: inst.id });
          const t = nearestHero(gs, inst, s.x, s.y);
          if (t) { m.state = 'chase'; m.targetPlayerId = t.id; }
          inst.mobs.set(m.id, m);
        }
        announceSpawns(gs, inst, wave);
        // the waves never run dry while the ward charges: refill from the room's own kind
        if (!ev.held.length && ev.progress < 0.85 && wave.length) {
          for (let k = 0; k < ev.perWave; k++) ev.held.push(spawnTemplate(inst, wave[k % wave.length]));
        }
      }
      if (ward && (Math.abs((ward.progress || 0) - ev.progress) >= 0.02 || ev.progress >= 1)) {
        ward.progress = Number(ev.progress.toFixed(3));
        emit(gs, inst, 'dungeon_event', { room: i, type: 'ward', progress: ward.progress, holding });
      }
      if (ev.progress >= 1) {
        ev.held = [];
        if (ward) ward.charged = true;
        spawnChest(gs, inst, r.cx + 1.5, r.cy + 1.5, true, 'ward');
        say(gs, inst, wx, wy - 1.2, '🔮 WARD CHARGED!', '#a78bfa', 26);
        emit(gs, inst, 'skill_fx', { type: 'set_proc', set: 'radiant', x: wx, y: wy, radius: 3, color: '#a78bfa' });
      }
    }

    if (ev.type === 'gauntlet' && !ev.expired && ev.t > ev.limit) {
      ev.expired = true;
      say(gs, inst, r.cx + 0.5, r.cy - 1, '⏱️ TOO SLOW - THE PRIZE IS LOST', '#f87171', 22);
      emit(gs, inst, 'dungeon_event', { room: i, type: 'gauntlet', state: 'expired' });
    }

    if (ev.type === 'collapse') {
      ev.next -= dt;
      if (ev.next <= 0) {
        ev.next = 1.6;
        const hz = COLLAPSE_TILE[inst.dungeon.theme] || EMBERS;
        const reverts = df.tileReverts.get(i) || [];
        const cap = Math.floor(r.w * r.h * 0.35);
        const changes: number[][] = [];
        for (let k = 0; k < 4 && reverts.length < cap; k++) {
          const x = r.x + 1 + rnd(r.w - 2), y = r.y + 1 + rnd(r.h - 2);
          if (inst.dungeon.tiles[y][x] !== T.FLOOR) continue;
          if (Math.abs(x - r.cx) <= 1 || Math.abs(y - r.cy) <= 1) continue;    // keep the cross walkable
          reverts.push([x, y, T.FLOOR]);
          changes.push([x, y, hz]);
        }
        df.tileReverts.set(i, reverts);
        setTiles(gs, inst, changes);
      }
    }
  }

  // Healing springs: a full heal and a boon, once per hero
  for (const o of inst.dungeon.obstacles) {
    if (o.type === 'dungeon_spring' && !isSealed(inst, o.room)) {
      for (const p of heroes) {
        if (df.springUsed.has(p.id) || Math.hypot(p.x - o.x, p.y - o.y) > 1.8) continue;
        df.springUsed.add(p.id);
        p.hp = p.maxHp; p.mp = p.maxMp;
        say(gs, inst, p.x, p.y - 1, '💧 RESTORED BY THE SPRING', '#67e8f9', 20);
        emit(gs, inst, 'skill_fx', { type: 'set_proc', set: 'radiant', x: o.x, y: o.y, radius: 2, color: '#67e8f9' });
        offerBoon(gs, p);
      }
    }
  }

  // Secret cracks: stand at one for a moment once its room is quiet
  for (const s of df.secrets) {
    if (s.revealed || !inst.roomsCleared || !inst.roomsCleared.has(s.room)) continue;
    const near = heroes.some(p => Math.hypot(p.x - s.hint.x, p.y - s.hint.y) <= 1.3);
    s.stand = near ? (s.stand || 0) + dt : 0;
    if (s.stand >= 0.8) revealSecret(gs, inst, s);
  }
}

// a held copy of a monster for the ward's endless waves
function spawnTemplate(inst: any, base: any) {
  const id = `df_${inst.id}_${++inst.df.seq}`;
  return { ...JSON.parse(JSON.stringify({ ...base, doom: undefined })), id, hp: base.maxHp, state: 'idle', targetPlayerId: null, noProgress: true,
    chillTimer: 0, frozenTimer: 0, exp: Math.round((base.exp || 0) * 0.5), gold: Math.round((base.gold || 0) * 0.3) };
}

function revertRoomTiles(gs: any, inst: any, roomIdx: number) {
  const list = inst.df.tileReverts.get(roomIdx);
  if (!list || !list.length) return;
  inst.df.tileReverts.delete(roomIdx);
  setTiles(gs, inst, list.map(([x, y, t]: number[]) => [x, y, t]));
}

function revealSecret(gs: any, inst: any, s: any) {
  s.revealed = true;
  const tiles = inst.dungeon.tiles;
  const changes: number[][] = [];
  const opened = new Set<string>();
  for (const [x, y] of s.tiles) {
    if (!tiles[y] || tiles[y][x] === undefined) continue;
    opened.add(x + ',' + y);
    changes.push([x, y, T.FLOOR]);
  }
  for (const [x, y] of s.tiles) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (opened.has(nx + ',' + ny) || !tiles[ny] || tiles[ny][nx] !== T.VOID) continue;
      opened.add(nx + ',' + ny);
      changes.push([nx, ny, T.WALL]);
    }
  }
  setTiles(gs, inst, changes);
  inst.dungeon.obstacles = inst.dungeon.obstacles.filter((o: any) => o.id !== `dungeon_crack_${s.id}`);
  emit(gs, inst, 'dungeon_secret_found', { id: s.id, crack: `dungeon_crack_${s.id}`, x: s.hint.x, y: s.hint.y });
  const c = s.chamber;
  spawnChest(gs, inst, c.cx, c.cy, true, 'secret');
  if (Math.random() < 0.5) spawnChest(gs, inst, c.cx + 1.5, c.cy + 1, false, 'secret');
  say(gs, inst, s.hint.x, s.hint.y - 1, '✨ A HIDDEN PASSAGE CRUMBLES OPEN!', '#fde68a', 24);
}

// ------------------------------------------------------------------ monster deaths and hits
export function onMobDeath(gs: any, inst: any, mob: any, killer: any) {
  const df = inst && inst.df;
  if (!df) return;
  // Splitter: two smaller copies
  if ((mob.buffs || []).includes('splitter') && !mob.isSplit) {
    const out: any[] = [];
    for (let k = 0; k < 2; k++) {
      const a = Math.random() * Math.PI * 2;
      let x = mob.x + Math.cos(a) * 0.7, y = mob.y + Math.sin(a) * 0.7;
      if (!walkable(inst, x, y)) { x = mob.x; y = mob.y; }
      out.push(spawnMobFrom(gs, inst, mob, x, y, {
        hp: mob.maxHp * 0.35, scale: (mob.scale || 1) * 0.72, rewardMult: 0.25, rise: 250,
        name: mob.name.replace(/^(\S+\s)+?(?=[A-Z])/, '') + ' Shard', targetId: killer ? killer.id : null, extra: { isSplit: true }
      }));
    }
    announceSpawns(gs, inst, out);
  }
  // Illusions vanish with the real miniboss
  if (mob.trait === 'illusions') {
    for (const m of inst.mobs.values()) if (m.illusionOf === mob.id && m.state !== 'dead') { m.state = 'dead'; m.hp = 0; gs.emitZone('dungeon', 'mob_died', { mobId: m.id }, inst.id); }
  }
  if (mob.trait === 'lava' && df.lavaTiles.length) {
    setTiles(gs, inst, df.lavaTiles.map(([x, y, t]: number[]) => [x, y, t]));
    df.lavaTiles = [];
  }
  // Mimic: its loot is a gold chest
  if (mob.isMimic) spawnChest(gs, inst, mob.x, mob.y, true, 'mimic');
  // Corpse Blast boon
  const stacks = killer && boonStacks(killer, 'detonate');
  if (stacks && !killer._dfBlast) {
    killer._dfBlast = true;
    try {
      const dmg = Math.max(1, Math.round((killer.dmg || 10) * 0.4 * stacks));
      emit(gs, inst, 'skill_fx', { type: 'set_proc', set: 'emberheart', x: mob.x, y: mob.y, radius: 1.6, color: '#fb923c' });
      for (const m of inst.mobs.values()) {
        if (m === mob || m.state === 'dead' || m.hp <= 0 || m.spawnUntil > Date.now()) continue;
        if (Math.hypot(m.x - mob.x, m.y - mob.y) <= 2.2) gs.applyDamageToMob(killer, m, dmg, false, true);
      }
    } finally { killer._dfBlast = false; }
  }
}

// Called after a hit landed on a dungeon monster
export function onMobHit(gs: any, player: any, mob: any, damage: number, isCritical: boolean, isEcho: boolean) {
  if (!player || damage <= 0) return;
  const inst = player.dungeonInstanceId && gs.dungeonInstances.get(player.dungeonInstanceId);
  if (!inst || !inst.df) return;
  if ((mob.buffs || []).includes('reflector') && !player.godMode && !player.isDead) {
    const back = Math.min(Math.round(damage * 0.15), Math.round(player.maxHp * 0.03));
    if (back > 0) {
      player.hp = Math.max(1, player.hp - back);
      const now = Date.now();
      if (!player._dfReflectText || now - player._dfReflectText > 400) {
        player._dfReflectText = now;
        say(gs, inst, player.x, player.y - 0.6, `🪞 -${back}`, '#e2e8f0', 14);
      }
    }
  }
  const st = boonStacks(player, 'static');
  if (st && isCritical && !isEcho && !player._dfArc) {
    let best: any = null, bd = 4.5;
    for (const m of inst.mobs.values()) {
      if (m === mob || m.state === 'dead' || m.hp <= 0 || (m.spawnUntil && m.spawnUntil > Date.now())) continue;
      const d = Math.hypot(m.x - mob.x, m.y - mob.y);
      if (d < bd) { bd = d; best = m; }
    }
    if (best) {
      player._dfArc = true;
      try {
        emit(gs, inst, 'skill_fx', { type: 'chain_lightning', x: best.x, y: best.y, startX: mob.x, startY: mob.y, targets: [{ x: mob.x, y: mob.y }, { x: best.x, y: best.y }] });
        gs.applyDamageToMob(player, best, Math.max(1, Math.round(damage * 0.3 * st)), false, true);
      } finally { player._dfArc = false; }
    }
  }
}

// Mimic chests: opening one wakes it up instead
export function tryMimic(gs: any, inst: any, chest: any, player: any) {
  if (!inst || !inst.df || !inst.df.mimics.has(chest.id)) return false;
  inst.df.mimics.delete(chest.id);
  inst.chests = inst.chests.filter((c: any) => c.id !== chest.id);
  const lvl = (inst.dungeon.mobs && inst.dungeon.mobs[0] && inst.dungeon.mobs[0].level) || player.level || 1;
  const base: any = {
    type: 'slime', name: `🪤 Mimic (Lv. ${lvl})`, level: lvl, hue: 40, scale: 1.25, element: 'earth', elementResist: {},
    dmg: Math.round((18 + lvl * 2.6) * 1.3), def: Math.round(8 + lvl * 1.3), speed: 2.9, exp: Math.round(40 + lvl * 9), gold: Math.round(60 + lvl * 12),
    maxHp: Math.round((300 + lvl * 70) * 1.2), roomIdx: undefined, zone: null
  };
  const m = spawnMobFrom(gs, inst, base, chest.x + 0.5, chest.y + 0.5, { targetId: player.id, rise: 400, extra: { isMimic: true } });
  announceSpawns(gs, inst, [m]);
  say(gs, inst, chest.x + 0.5, chest.y - 0.6, '🪤 IT\'S A MIMIC!', '#f87171', 26);
  return true;
}

// ------------------------------------------------------------------ monster behaviour
// Runs every tick for monsters with roles, behaviour affixes or a miniboss trait.
// Returns true when it moved / acted for the monster this tick (skip the plain chase).
export function mobAI(gs: any, mob: any, dt: number, instId: string | null) {
  if (!instId) return false;
  const inst = gs.dungeonInstances.get(instId);
  if (!inst || !inst.df || mob.frozenTimer > 0) return false;
  const now = Date.now();
  mob._df = mob._df || { next: {} };
  const S = mob._df;
  const ready = (k: string, gap: number) => { if ((S.next[k] || 0) > now) return false; S.next[k] = now + gap * 1000; return true; };
  const target = mob.targetPlayerId && gs.players.get(mob.targetPlayerId);
  const chasing = mob.state === 'chase' && target && !target.isDead && target.dungeonInstanceId === instId;
  const buffs = mob.buffs || [];

  if (buffs.includes('warden') && chasing && ready('warden', 5)) {
    let n = 0;
    for (const m of inst.mobs.values()) {
      if (n >= 3 || m === mob || m.state === 'dead' || m.hp <= 0 || m.isBoss) continue;
      if (Math.hypot(m.x - mob.x, m.y - mob.y) > 4.5) continue;
      m.shield = Math.max(m.shield || 0, Math.round(m.maxHp * 0.2)); n++;
    }
    if (n) emit(gs, inst, 'skill_fx', { type: 'set_proc', set: 'bulwark', x: mob.x, y: mob.y, radius: 4.5, color: '#60a5fa' });
  }
  if (buffs.includes('summoner') && chasing && ready('summon', 9)) {
    const mine = [...inst.mobs.values()].filter(m => m.summonedBy === mob.id && m.state !== 'dead').length;
    if (mine < 4) {
      const out = [];
      for (let k = 0; k < 2; k++) {
        const a = Math.random() * Math.PI * 2;
        const x = mob.x + Math.cos(a) * 1.2, y = mob.y + Math.sin(a) * 1.2;
        if (!walkable(inst, x, y)) continue;
        out.push(spawnMobFrom(gs, inst, mob, x, y, { hp: mob.maxHp * 0.3, scale: (mob.scale || 1) * 0.7, rewardMult: 0.2, targetId: target.id, name: 'Summoned ' + (mob.name.match(/[A-Z][A-Za-z' ]+(?= \(Lv)/) || ['Thrall'])[0], extra: { summonedBy: mob.id } }));
      }
      announceSpawns(gs, inst, out);
    }
  }
  if (buffs.includes('blinker') && chasing) {
    const d = Math.hypot(target.x - mob.x, target.y - mob.y);
    if (d > 2.4 && d < 9 && ready('blink', 6 + Math.random() * 2)) {
      const ux = (target.x - mob.x) / d, uy = (target.y - mob.y) / d;
      const x = target.x + ux * 1.1, y = target.y + uy * 1.1;
      if (walkable(inst, x, y)) {
        emit(gs, inst, 'skill_fx', { type: 'set_proc', set: 'eclipse', x: mob.x, y: mob.y, radius: 0.9, color: '#a855f7' });
        mob.x = x; mob.y = y;
        mob.attackCooldown = Math.max(mob.attackCooldown, 0.7);
        emit(gs, inst, 'skill_fx', { type: 'set_proc', set: 'eclipse', x, y, radius: 0.9, color: '#a855f7' });
      }
    }
  }

  // Miniboss traits
  if (mob.trait) {
    const hpPct = mob.hp / mob.maxHp;
    if (mob.trait === 'illusions') {
      S.illu = S.illu || 0;
      const step = hpPct <= 0.35 ? 2 : hpPct <= 0.7 ? 1 : 0;
      if (step > S.illu) {
        S.illu = step;
        const r = inst.dungeon.rooms[mob.roomIdx];
        const spots = [{ x: mob.x, y: mob.y }];
        for (let k = 0; k < 3 && r; k++) spots.push(roomFloorSpot(inst, r));
        shuffle(spots);
        const out = [];
        mob.x = spots[0].x; mob.y = spots[0].y;
        for (const s of spots.slice(1)) {
          out.push(spawnMobFrom(gs, inst, mob, s.x, s.y, { hp: mob.maxHp * 0.06, dmgMult: 0.4, rewardMult: 0, targetId: mob.targetPlayerId, rise: 200, extra: { illusionOf: mob.id, isMiniboss: false } }));
        }
        announceSpawns(gs, inst, out);
        emit(gs, inst, 'floating_text', { x: mob.x, y: mob.y - 2.2, text: '🎭 WHICH ONE IS REAL?', color: '#c4b5fd', size: 20 });
      }
    } else if (mob.trait === 'frost' && chasing && ready('frost', 1)) {
      for (const p of heroesIn(gs, inst)) {
        if (!p.isDead && Math.hypot(p.x - mob.x, p.y - mob.y) <= 3.2) gs.applyStatusEffect(p, 'chill', 1.4, 0.4);
      }
    } else if (mob.trait === 'lava' && chasing && ready('lava', 0.5)) {
      const x = Math.floor(mob.x), y = Math.floor(mob.y);
      const tiles = inst.dungeon.tiles;
      if (tiles[y] && tiles[y][x] === T.FLOOR && inst.df.lavaTiles.length < 40) {
        inst.df.lavaTiles.push([x, y, T.FLOOR]);
        setTiles(gs, inst, [[x, y, EMBERS]]);
      }
    } else if (mob.trait === 'summoner' && chasing && ready('brood', 10)) {
      const out = [];
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const x = mob.x + Math.cos(a) * 1.8, y = mob.y + Math.sin(a) * 1.8;
        if (!walkable(inst, x, y)) continue;
        out.push(spawnMobFrom(gs, inst, { ...mob, type: 'skeleton', scale: 0.9 }, x, y, { hp: mob.maxHp * 0.05, dmgMult: 0.35, rewardMult: 0.02, targetId: target.id, name: 'Brood Thrall', extra: { summonedBy: mob.id, isMiniboss: false } }));
      }
      announceSpawns(gs, inst, out);
    }
    return false;
  }

  if (!mob.role || !chasing) return false;
  const d = Math.hypot(target.x - mob.x, target.y - mob.y);
  if (d > 12) return false;
  mob.facing = gs.calculateFacing(mob.x, mob.y, target.x, target.y);
  // keep a distance: back off when crowded, close in when far
  const want = mob.role === 'caster' ? 4.5 : 3.2;
  let mv = 0;
  if (d < want - 0.8) mv = -1; else if (d > want + 1.2) mv = 1;
  if (mv) {
    const sp = mob.speed * (mob.chillTimer > 0 ? 0.5 : 1) * (mv < 0 ? 0.8 : 1) * dt;
    const nx = mob.x + ((target.x - mob.x) / d) * sp * mv, ny = mob.y + ((target.y - mob.y) / d) * sp * mv;
    if (walkable(inst, nx, ny)) { mob.x = nx; mob.y = ny; }
  }
  if (mob.role === 'caster' && d <= 7 && ready('cast', 2.4 + Math.random() * 0.8)) {
    const id = `dfc_${mob.id}_${now}`;
    const shape = { shape: 'circle', x: target.x, y: target.y, r: 1.25 };
    emit(gs, inst, 'boss_telegraph', { id, bossId: mob.id, kind: 'bolt', shapes: [shape], delay: 900, color: '#c084fc', element: mob.element || 'dark', quiet: true });
    setTimeout(() => {
      if (!gs.dungeonInstances.has(instId) || mob.state === 'dead' || mob.hp <= 0) return;
      for (const p of heroesIn(gs, inst)) {
        if (!p.isDead && Math.hypot(p.x - shape.x, p.y - shape.y) <= shape.r + 0.35) gs.mobStrikePlayer(mob, p, 'dungeon', { mechanic: true, mult: 0.9 });
      }
    }, 900);
  }
  if (mob.role === 'mender' && ready('mend', 4)) {
    let best: any = null, low = 0.85;
    for (const m of inst.mobs.values()) {
      if (m === mob || m.state === 'dead' || m.hp <= 0 || m.isBoss) continue;
      if (Math.hypot(m.x - mob.x, m.y - mob.y) > 6) continue;
      if (m.hp / m.maxHp < low) { low = m.hp / m.maxHp; best = m; }
    }
    if (best) {
      const heal = Math.round(best.maxHp * 0.12);
      best.hp = Math.min(best.maxHp, best.hp + heal);
      emit(gs, inst, 'skill_fx', { type: 'set_proc', set: 'radiant', x: best.x, y: best.y, radius: 0.9, color: '#4ade80' });
      emit(gs, inst, 'floating_text', { x: best.x, y: best.y - 0.8, text: `+${heal}`, color: '#4ade80', size: 14 });
    }
  }
  return true;
}

// ------------------------------------------------------------------ boons and curses (per hero)
export function boonStacks(p: any, id: string) {
  const run = p && p.dungeonRun;
  return run && run.boons && p.zone === 'dungeon' ? (run.boons[id] || 0) : 0;
}
function rollOffer(p: any) {
  const owned = (p.dungeonRun && p.dungeonRun.boons) || {};
  const pool = Object.values(BOONS).filter(b => (owned[b.id] || 0) < b.max);
  const out: any[] = [];
  const weights = (b: any) => (b.tier === 1 ? 3 : b.tier === 2 ? 2 : 1) * ((owned[b.id] || 0) > 0 ? 1.4 : 1);
  while (out.length < 3 && pool.length) {
    const total = pool.reduce((t, b) => t + weights(b), 0);
    let r = Math.random() * total;
    let k = 0;
    for (; k < pool.length - 1; k++) { r -= weights(pool[k]); if (r <= 0) break; }
    out.push(pool.splice(k, 1)[0].id);
  }
  return out;
}
function describeBoon(id: string, stacks: number) {
  const b = BOONS[id];
  return { id, name: b.name, icon: b.icon, tier: b.tier, stacks, max: b.max, desc: b.desc.replace('{v}', String(Number((b.per * Math.max(1, stacks)).toFixed(1)))) };
}
export function offerBoon(gs: any, p: any) {
  const run = p.dungeonRun;
  if (!run || run.cleared) return;
  run.boons = run.boons || {};
  run.boonQueue = (run.boonQueue || 0) + 1;
  if (!run.boonOffer) nextOffer(gs, p);
  else sendOffer(gs, p);
}
function nextOffer(gs: any, p: any) {
  const run = p.dungeonRun;
  if (!run || !run.boonQueue) { if (run) run.boonOffer = null; return; }
  const choices = rollOffer(p);
  if (!choices.length) { run.boonQueue = 0; run.boonOffer = null; return; }
  run.boonOffer = { id: `bo_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, choices };
  sendOffer(gs, p);
}
function sendOffer(gs: any, p: any) {
  const run = p.dungeonRun;
  const socket = gs.io.sockets.sockets.get(p.id);
  if (!socket || !run || !run.boonOffer) return;
  socket.emit('dungeon_boon_offer', {
    offerId: run.boonOffer.id,
    pending: run.boonQueue || 1,
    choices: run.boonOffer.choices.map((id: string) => {
      const have = (run.boons && run.boons[id]) || 0;
      return { ...describeBoon(id, have + 1), have };
    })
  });
}
export function handlePickBoon(gs: any, socketId: string, data: any) {
  const p = gs.players.get(socketId);
  const run = p && p.dungeonRun;
  if (!run || !run.boonOffer || !data || data.offerId !== run.boonOffer.id) return;
  const id = String(data.boonId);
  if (!run.boonOffer.choices.includes(id)) return;
  run.boons = run.boons || {};
  run.boons[id] = Math.min(BOONS[id].max, (run.boons[id] || 0) + 1);
  run.boonQueue = Math.max(0, (run.boonQueue || 1) - 1);
  run.boonOffer = null;
  gs.recalculatePlayerStats(p);
  const socket = gs.io.sockets.sockets.get(p.id);
  if (socket) {
    socket.emit('player_updated', p);
    socket.emit('floating_text', { x: p.x, y: p.y - 1, text: `${BOONS[id].icon} ${BOONS[id].name.toUpperCase()}!`, color: '#fde68a', size: 20 });
  }
  nextOffer(gs, p);
  gs.emitDungeonRunUpdate(p);
}
// re-send a pending offer (reconnect / zone change)
export function resendOffer(gs: any, p: any) { if (p.dungeonRun && p.dungeonRun.boonOffer) sendOffer(gs, p); }

export function handleShrine(gs: any, socketId: string, data: any) {
  const p = gs.players.get(socketId);
  if (!p || p.isDead || p.zone !== 'dungeon') return;
  const inst = gs.getPlayerDungeonInstance(p);
  if (!inst || !inst.df) return;
  const o = inst.dungeon.obstacles.find((x: any) => x.type === 'dungeon_shrine' && x.id === (data && data.id));
  if (!o || Math.hypot(o.x - p.x, o.y - p.y) > 2.6 || inst.df.shrineUsed.has(p.id)) return;
  const run = p.dungeonRun;
  if (!run || run.cleared) return;
  inst.df.shrineUsed.add(p.id);
  run.curses = run.curses || [];
  const free = Object.keys(CURSES).filter(c => !run.curses.includes(c));
  const curse = free.length ? pick(free) : null;
  if (curse) run.curses.push(curse);
  // the price is paid: a guaranteed piece of gear and a gold chest's worth of loot (escrowed)
  const loot = gs.rollDungeonLootForShrine(inst.floor, p.characterClass);
  for (const it of loot) {
    if (it.type === 'gold') run.gold += it.amount; else run.items.push(it);
  }
  gs.recalculatePlayerStats(p);
  const socket = gs.io.sockets.sockets.get(p.id);
  if (socket) {
    socket.emit('player_updated', p);
    socket.emit('dungeon_shrine_result', { id: o.id, curse: curse ? CURSES[curse] : null, loot: loot.map((it: any) => gs.lootEntryName(it)) });
  }
  say(gs, inst, o.x, o.y - 1.2, curse ? `${CURSES[curse].icon} CURSED: ${CURSES[curse].name.toUpperCase()}` : '🕯️ THE SHRINE IS SATED', '#c084fc', 20);
  emit(gs, inst, 'skill_fx', { type: 'set_proc', set: 'eclipse', x: o.x, y: o.y, radius: 1.8, color: '#a855f7' });
  gs.emitDungeonRunUpdate(p);
}

// End of recalculatePlayerStats: boons and curses of the current run (dungeon only)
export function applyRunBoons(p: any) {
  const run = p.dungeonRun;
  if (!run || p.zone !== 'dungeon') return;
  const b = run.boons || {};
  const c = run.curses || [];
  if (!Object.keys(b).length && !c.length) return;
  const s = (id: string) => (b[id] || 0) * BOONS[id].per;
  if (b.might) p.dmg = Math.round(p.dmg * (1 + s('might') / 100));
  let hpMult = 1 + s('vigor') / 100;
  if (c.includes('frail')) hpMult *= 0.85;
  if (hpMult !== 1) p.maxHp = Math.round(p.maxHp * hpMult);
  let defMult = 1 + s('bulwark') / 100;
  if (c.includes('brittle')) defMult *= 0.8;
  if (defMult !== 1) p.def = Math.round(p.def * defMult);
  let spMult = 1 + s('swiftness') / 100;
  if (c.includes('sluggish')) spMult *= 0.9;
  if (spMult !== 1) p.speed = Number((p.speed * spMult).toFixed(2));
  if (b.precision) p.critChanceBonus = Math.min(0.75, Number((p.critChanceBonus + s('precision') / 100).toFixed(3)));
  if (b.ruthless) p.critDmgBonus = Number((p.critDmgBonus + s('ruthless') / 100).toFixed(3));
  if (b.frenzy) p.attackSpeed = Number((p.attackSpeed * (1 + s('frenzy') / 100)).toFixed(2));
  if (b.focus) p.cdr = Number(Math.min(0.6, p.cdr + s('focus') / 100).toFixed(3));
  if (b.leech) p.lifeSteal = Number(Math.min(0.08 + s('leech') / 100, p.lifeSteal + s('leech') / 100).toFixed(3));
  if (b.bloodthirst || b.siphon) {
    p.talentKill = { hp: Number(((p.talentKill && p.talentKill.hp) || 0) + s('bloodthirst') / 100), mp: Number(((p.talentKill && p.talentKill.mp) || 0) + s('siphon') / 100) };
  }
  if (b.renewal) p.hpRegen = Number((p.hpRegen + p.maxHp * s('renewal') / 100).toFixed(1));
  if (c.includes('drained')) { p.hpRegen = Number((p.hpRegen * 0.6).toFixed(1)); p.mpRegen = Number((p.mpRegen * 0.6).toFixed(1)); }
  p.hp = Math.min(p.hp, p.maxHp);
}

export function runSummary(run: any) {
  if (!run) return { boons: [] as any[], curses: [] as any[], pendingBoons: 0 };
  return {
    boons: Object.entries(run.boons || {}).map(([id, n]) => describeBoon(id, n as number)),
    curses: (run.curses || []).map((id: string) => CURSES[id]).filter(Boolean),
    pendingBoons: run.boonQueue || 0
  };
}

// Live event state for the run panel
export function eventStatus(inst: any) {
  const out: any[] = [];
  if (!inst || !inst.df) return out;
  for (const key of Object.keys(inst.df.events)) {
    const ev = inst.df.events[key];
    if (!ev.active || (inst.roomsCleared && inst.roomsCleared.has(Number(key)))) continue;
    if (ev.type === 'ward' && ev.progress < 1) out.push({ type: 'ward', room: Number(key), progress: Number((ev.progress || 0).toFixed(2)) });
    if (ev.type === 'gauntlet' && !ev.done) out.push({ type: 'gauntlet', room: Number(key), left: Math.max(0, Math.ceil(ev.limit - (ev.t || 0))), expired: !!ev.expired });
  }
  return out;
}

// ------------------------------------------------------------------ run end: depth unlocks and the weekly board
export function onRunComplete(gs: any, player: any, inst: any, result: any) {
  const out: any = {};
  const df = inst && inst.df;
  if (!df) return out;
  const depth = df.depth || 0;
  out.depth = depth;
  player.dungeonDepth = player.dungeonDepth || {};
  const key = String(inst.floor);
  const prev = player.dungeonDepth[key] !== undefined ? player.dungeonDepth[key] : -1;
  if (depth > prev) {
    player.dungeonDepth[key] = depth;
    if (depth < MAX_DEPTH) out.unlocked = depth + 1;
  }
  if (df.weekly) {
    const place = recordWeekly(df.weekly, inst.floor, inst.difficulty, {
      name: player.name, cls: player.characterClass, level: player.level, timeMs: result.timeMs, rank: result.rank, deaths: result.deaths,
      party: heroesIn(gs, inst).map(p => p.name), at: Date.now()
    });
    out.weekly = { week: df.weekly, placement: place };
  }
  return out;
}

export function maxDepthFor(player: any, floor: number) {
  const best = player.dungeonDepth && player.dungeonDepth[String(floor)];
  return Math.min(MAX_DEPTH, (best === undefined ? -1 : best) + 1);
}

export function clientCatalog(modIds: string[]) {
  const week = weekId();
  return {
    boons: Object.values(BOONS), curses: Object.values(CURSES), events: Object.values(ROOM_EVENTS), affixes: BEHAVIOUR_AFFIXES,
    maxDepth: MAX_DEPTH, depthStep: depthScaling(1), week, weeklyMods: weeklyMods(week, modIds)
  };
}
