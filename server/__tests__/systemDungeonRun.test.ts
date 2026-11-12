// Dungeon run system (run state, room opening, progress, run payout, dungeon chests): locked to a fixture captured
// BEFORE the methods moved out of GameServer. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemDungeonRun.json');
const NOW = 1700000000000;
const plain = (v: any) => v === undefined ? null : JSON.parse(JSON.stringify(v, (_k, x) => (x instanceof Map ? { __map: Array.from(x.entries()) } : x instanceof Set ? { __set: Array.from(x.values()) } : x === Infinity ? '__Infinity__' : x)));
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hashName = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // the server module imports the accountManager singleton
  const mod: any = await import('../gameServer');
  return { dir, GS: mod.default || mod.GameServer };
}

// a small dungeon: room 0 (start) -> room 1 (trash) -> room 2 (treasure, empty) -> room 3 (boss); rooms 4 and 5 are a rush hall behind room 1
function makeInst(extra: any = {}) {
  const tiles = Array.from({ length: 12 }, () => new Array(12).fill(1));
  const mob = (id: string, roomIdx: number, extraMob: any = {}) => ({ id, roomIdx, x: roomIdx + 0.5, y: 2, state: 'idle', hp: 10, element: 'fire', isBoss: false, ...extraMob });
  const inst: any = {
    id: 'inst1', floor: 3, difficulty: 'hard', mode: 'classic', startedAt: NOW - 90000, announce: true,
    mobs: new Map(), pendingMobs: new Map([
      [0, [mob('m0a', 0), mob('m0b', 0)]], [1, [mob('m1a', 1), mob('m1b', 1, { isMiniboss: true })]], [3, [mob('boss', 3, { isBoss: true, element: undefined })]],
      [4, [mob('rush4', 4)]], [5, [mob('rush5', 5)]],
    ]),
    roomsCleared: undefined, roomsSpawned: undefined,
    dungeon: {
      tiles, obstacles: [{ id: 'door_a' }, { id: 'door_b' }, { id: 'door_c' }, { id: 'door_d' }, { id: 'keep' }],
      rooms: [{ cx: 2, cy: 2 }, { cx: 4, cy: 2 }, { cx: 6, cy: 2 }, { cx: 8, cy: 2 }, { cx: 4, cy: 6, rush: true }, { cx: 5, cy: 6, rush: true }],
      doors: [
        { id: 'door_a', from: 0, to: 1, tiles: [[3, 2]], x: 3, y: 2 }, { id: 'door_b', from: 1, to: 2, tiles: [[5, 2]], x: 5, y: 2 },
        { id: 'door_c', from: 2, to: 3, tiles: [[7, 2], [7, 3]], boss: true, x: 7, y: 2 }, { id: 'door_d', from: 1, to: 4, tiles: [[4, 4]], x: 4, y: 4 },
      ],
      chests: [{ id: 'c1', x: 5, y: 5, isGold: false }, { id: 'c2', x: 9, y: 9, isGold: true }],
    },
    chests: [{ id: 'c1', x: 5, y: 5, isGold: false }, { id: 'c2', x: 9, y: 9, isGold: true }],
    bossRoomIdx: 3, requiredKills: 4, killedTrashCount: 0, killPercent: 0,
    ...extra,
  };
  return inst;
}

test('dungeon run methods match the pre-refactor fixture', async () => {
  const { dir, GS } = await load();
  const realNow = Date.now, realRandom = Math.random;
  let now = NOW;
  Date.now = () => now;
  try {
    const got: any = {};
    const hero = (extra: any = {}) => ({
      id: 'h1', name: 'Hero', zone: 'dungeon', x: 5, y: 5, level: 40, characterClass: 'warrior', isDead: false, gold: 100, dungeonInstanceId: 'inst1',
      inventory: { items: [], kills: 0 }, ...extra,
    });
    // a server with a log; players and sockets for every given id
    function world(name: string, opts: any = {}) {
      Math.random = mulberry32(hashName(name));
      now = NOW;
      const log: any[] = [];
      const players = new Map<string, any>();
      const sockets = new Map<string, any>();
      for (const [id, p] of Object.entries<any>(opts.players || { h1: hero() })) {
        players.set(id, p);
        if (!(opts.noSocketFor || []).includes(id)) sockets.set(id, { emit: (ev: string, data: any) => log.push(['socket', id, ev, plain(data)]) });
      }
      const fake: any = Object.create(GS.prototype);
      Object.assign(fake, {
        players, io: { sockets: { sockets } },
        dungeonInstances: new Map(opts.instances || []),
        dungeon: opts.legacyDungeon || { chests: [{ id: 'lc', x: 5, y: 5, isGold: false }] }, dungeonFloor: 2, dungeonDifficulty: 'normal',
        emitZone: (...a: any[]) => log.push(['zone', ...plain(a)]),
        giveLootToPlayer: (p: any, it: any, show: any) => log.push(['call', 'giveLootToPlayer', p.id, plain(it), show]),
        awardExp: (p: any, n: number) => log.push(['call', 'awardExp', p.id, n]),
        broadcastSystemMessage: (m: string) => log.push(['call', 'broadcastSystemMessage', m]),
      });
      if (typeof fake.initSystems === 'function') fake.initSystems();
      return { fake, log, players };
    }
    const record = (name: string, w: any, extra: any = {}) => { got[name] = { log: plain(w.log), players: plain(Object.fromEntries(w.players)), ...extra }; };
    const attempt = (fn: () => any) => { try { return { ret: fn() }; } catch (e: any) { return { threw: String(e && e.message) }; } };

    // ---- newDungeonRun
    { const { fake } = world('newrun');
      got.newRun = {
        plain: plain(fake.newDungeonRun({ floor: 2, difficulty: 'normal' })),
        withStart: plain(fake.newDungeonRun({ floor: 4, difficulty: 'hard', startedAt: 12345 })),
        cleared: plain(fake.newDungeonRun({ floor: 1, difficulty: 'easy', startedAt: 1 }, true)),
      }; }

    // ---- getPlayerDungeonInstance / cleanupDungeonInstanceIfEmpty
    { const inst = makeInst(); const { fake } = world('lookup', { instances: [['inst1', inst]] });
      got.lookup = {
        ok: fake.getPlayerDungeonInstance(hero()) === inst,
        null: fake.getPlayerDungeonInstance(null), notDungeon: fake.getPlayerDungeonInstance(hero({ zone: 'town' })),
        noId: fake.getPlayerDungeonInstance(hero({ dungeonInstanceId: null })), unknownId: fake.getPlayerDungeonInstance(hero({ dungeonInstanceId: 'zzz' })),
      }; }
    { const inst = makeInst(); const w = world('cleanup occupied', { instances: [['inst1', inst]] }); w.fake.cleanupDungeonInstanceIfEmpty('inst1'); record('cleanup occupied', w, { has: w.fake.dungeonInstances.has('inst1') }); }
    { const inst = makeInst(); const w = world('cleanup empty', { instances: [['inst1', inst]], players: { h1: hero({ zone: 'town' }), h2: hero({ id: 'h2', dungeonInstanceId: 'other' }) } }); w.fake.cleanupDungeonInstanceIfEmpty('inst1'); record('cleanup empty', w, { has: w.fake.dungeonInstances.has('inst1') }); }
    { const inst = makeInst(); const w = world('cleanup unknown', { instances: [['inst1', inst]] }); w.fake.cleanupDungeonInstanceIfEmpty('nope'); w.fake.cleanupDungeonInstanceIfEmpty(null); record('cleanup unknown', w, { has: w.fake.dungeonInstances.has('inst1') }); }

    // ---- spawnDungeonRoom
    for (const [label, announce, room] of [['announced', true, 1], ['not announced', false, 1], ['missing room', true, 9], ['boss room', true, 3]] as any[]) {
      const inst = makeInst({ announce }); inst.roomsSpawned = new Set(); const w = world('spawn ' + label, { instances: [['inst1', inst]] });
      const ret = w.fake.spawnDungeonRoom(inst, room);
      record('spawn ' + label, w, { ret: plain(ret), mobs: plain(inst.mobs), pending: plain(inst.pendingMobs), spawned: plain(inst.roomsSpawned) });
    }
    { const inst = makeInst(); inst.roomsSpawned = new Set(); inst.pendingMobs = undefined; const w = world('spawn no pending', { instances: [['inst1', inst]] });
      record('spawn no pending', w, { ret: plain(w.fake.spawnDungeonRoom(inst, 1)), spawned: plain(inst.roomsSpawned) }); }

    // ---- updateDungeonRooms: a full playthrough, step by step
    {
      const inst = makeInst(); const w = world('rooms playthrough', { instances: [['inst1', inst]], players: { h1: hero(), h2: hero({ id: 'h2' }), h3: hero({ id: 'h3', zone: 'town' }) }, noSocketFor: ['h2'] });
      const steps: any[] = [];
      const snap = (label: string) => steps.push({ label, log: plain(w.log.splice(0)), cleared: plain(inst.roomsCleared), spawned: plain(inst.roomsSpawned), mobs: Array.from(inst.mobs.keys()), doorsOpen: inst.dungeon.doors.map((d: any) => !!d.open), killPercent: inst.killPercent, portal: !!inst.bossPortalReady, obstacles: inst.dungeon.obstacles.map((o: any) => o.id), tile: inst.dungeon.tiles[2][3] });
      w.fake.updateDungeonRooms(inst); snap('first pass (room 0 spawns, nothing dead)');
      for (const m of inst.mobs.values()) if (m.roomIdx === 0) { m.state = 'dead'; m.hp = 0; }
      w.fake.updateDungeonRooms(inst); snap('room 0 cleared: door a opens, room 1 spawns');
      w.fake.updateDungeonRooms(inst); snap('nothing changed');
      for (const m of inst.mobs.values()) if (m.roomIdx === 1) { m.state = 'dead'; m.hp = 0; }
      w.fake.updateDungeonRooms(inst); snap('room 1 cleared: treasure room is clear at once, boss door opens');
      for (const m of inst.mobs.values()) if (m.roomIdx !== undefined) { m.state = 'dead'; m.hp = 0; }
      w.fake.updateDungeonRooms(inst); snap('everything dead');
      got.roomsPlaythrough = steps;
    }
    { const inst = makeInst({ announce: false }); const w = world('rooms quiet', { instances: [['inst1', inst]] });
      w.fake.updateDungeonRooms(inst); for (const m of inst.mobs.values()) { m.state = 'dead'; m.hp = 0; } w.fake.updateDungeonRooms(inst);
      record('rooms quiet', w, { cleared: plain(inst.roomsCleared), portal: !!inst.bossPortalReady, killPercent: inst.killPercent }); }
    { const inst = makeInst(); inst.dungeon = null; const w = world('rooms no dungeon', { instances: [['inst1', inst]] }); w.fake.updateDungeonRooms(inst); record('rooms no dungeon', w); }
    { const inst = makeInst(); delete inst.dungeon.doors; const w = world('rooms no doors', { instances: [['inst1', inst]] }); w.fake.updateDungeonRooms(inst); record('rooms no doors', w); }
    { const inst = makeInst(); const w = world('rooms rush', { instances: [['inst1', inst]] });
      w.fake.updateDungeonRooms(inst);
      for (const m of inst.mobs.values()) if (m.roomIdx === 0) { m.state = 'dead'; m.hp = 0; }
      w.fake.updateDungeonRooms(inst);
      for (const m of inst.mobs.values()) if (m.roomIdx === 1) { m.state = 'dead'; m.hp = 0; }
      w.fake.updateDungeonRooms(inst);
      record('rooms rush', w, { spawned: plain(inst.roomsSpawned), cleared: plain(inst.roomsCleared), mobs: Array.from(inst.mobs.keys()) }); }

    // ---- countDungeonProgress
    const prog = (name: string, mob: any, instId: any, killer: any, instProps: any = {}) => {
      const inst = makeInst(instProps); const w = world(name, { instances: [['inst1', inst]], players: { h1: hero(), h2: hero({ id: 'h2', dungeonInstanceId: 'other' }) } });
      w.fake.countDungeonProgress(mob, instId, killer);
      record(name, w, { mob: plain(mob), killed: inst.killedTrashCount, pct: inst.killPercent, portal: !!inst.bossPortalReady });
    };
    prog('progress trash', { id: 'a', roomIdx: 1 }, 'inst1', null);
    prog('progress miniboss counts more', { id: 'a', roomIdx: 1, isMiniboss: true }, 'inst1', null);
    prog('progress mechanics miniboss', { id: 'a', roomIdx: 1, mechanics: 'miniboss' }, 'inst1', null);
    prog('progress reaches 100 by killer', { id: 'a', roomIdx: 1 }, 'inst1', hero({ x: 7, y: 8 }), { killedTrashCount: 3.5, requiredKills: 4 });
    prog('progress reaches 100 no killer', { id: 'a', roomIdx: 1, x: 2, y: 3 }, 'inst1', null, { killedTrashCount: 9, requiredKills: 4 });
    prog('progress portal already ready', { id: 'a', roomIdx: 1 }, 'inst1', null, { killedTrashCount: 9, bossPortalReady: true });
    prog('progress required zero', { id: 'a', roomIdx: 1 }, 'inst1', null, { requiredKills: 0 });
    prog('progress no instance id', { id: 'a', roomIdx: 1 }, null, null);
    prog('progress unknown instance', { id: 'a', roomIdx: 1 }, 'nope', null);
    prog('progress cleared instance', { id: 'a', roomIdx: 1 }, 'inst1', null, { cleared: true });
    prog('progress already counted', { id: 'a', roomIdx: 1, progressCounted: true }, 'inst1', null);
    prog('progress boss ignored', { id: 'a', roomIdx: 3, isBoss: true }, 'inst1', null);
    prog('progress no room', { id: 'a' }, 'inst1', null);
    prog('progress boss room', { id: 'a', roomIdx: 3 }, 'inst1', null);

    // ---- emitDungeonRunUpdate
    const emitUpd = (name: string, p: any, passSocket: boolean, instProps: any = {}, noSocketFor: string[] = []) => {
      const inst = makeInst(instProps); const w = world(name, { instances: [['inst1', inst]], players: { h1: p }, noSocketFor });
      const sock = passSocket ? { emit: (ev: string, data: any) => w.log.push(['passed', ev, plain(data)]) } : undefined;
      w.fake.emitDungeonRunUpdate(p, sock); record(name, w);
    };
    const run = () => ({ cleared: false, gold: 12, items: [{ itemId: 'town_scroll', amount: 2 }, { type: 'gold', amount: 5 }], startedAt: NOW - 5000, floor: 3, difficulty: 'hard', deaths: 1 });
    emitUpd('update active', hero({ dungeonRun: run() }), false);
    emitUpd('update given socket', hero({ dungeonRun: run() }), true);
    emitUpd('update cleared run', hero({ dungeonRun: { ...run(), cleared: true, clearedAt: NOW - 1000 } }), false);
    emitUpd('update inactive', hero(), false);
    emitUpd('update no socket', hero({ dungeonRun: run() }), false, {}, ['h1']);
    emitUpd('update rich instance', hero({ dungeonRun: run() }), false, { roomsCleared: new Set([0, 1]), mods: ['swift'], modReward: 3, bossPortalReady: true, bossPortalSpawned: true, killPercent: 55, killedTrashCount: 2, mode: 'rush' });
    emitUpd('update outside the dungeon', hero({ zone: 'town', dungeonInstanceId: null, dungeonRun: run() }), false);

    // ---- completeDungeonRun
    const done = (name: string, p: any, instProps: any = {}, noSocket = false) => {
      const inst = makeInst(instProps); const w = world(name, { instances: [['inst1', inst]], players: { h1: p }, noSocketFor: noSocket ? ['h1'] : [] });
      w.fake.completeDungeonRun(p); record(name, w, { runAfter: plain(p.dungeonRun) });
    };
    const bag = () => ({ cleared: false, gold: 500, items: [{ itemId: 'town_scroll', amount: 3 }, { itemId: 'health_potion', amount: 2 }], startedAt: NOW - 60000, floor: 3, difficulty: 'hard', deaths: 0, kills: 17, exp: 900 });
    done('complete fast clear (S)', hero({ dungeonRun: bag() }));
    done('complete with deaths (A/B)', hero({ dungeonRun: { ...bag(), deaths: 2 } }));
    done('complete many deaths (C)', hero({ dungeonRun: { ...bag(), deaths: 5 } }));
    done('complete slow clear', hero({ dungeonRun: { ...bag(), startedAt: NOW - 3_600_000 } }));
    done('complete slow with a death', hero({ dungeonRun: { ...bag(), startedAt: NOW - 700_000, deaths: 1 } }));
    done('complete empty bag', hero({ dungeonRun: { ...bag(), gold: 0, items: [] } }));
    done('complete no start time', hero({ dungeonRun: { ...bag(), startedAt: undefined } }));
    done('complete no exp or kills', hero({ dungeonRun: { cleared: false, gold: 5, items: [], floor: 1, difficulty: 'normal' } }));
    done('complete already cleared', hero({ dungeonRun: { ...bag(), cleared: true } }));
    done('complete no run', hero());
    done('complete no instance', hero({ dungeonRun: bag(), dungeonInstanceId: 'gone' }));
    done('complete no socket', hero({ dungeonRun: bag() }), {}, true);
    done('complete last floor', hero({ dungeonRun: { ...bag(), floor: 99 } }));
    done('complete low level', hero({ level: undefined, dungeonRun: bag() }));

    // ---- endDungeonRun
    const end = (name: string, p: any, passSocket = false, noSocket = false) => {
      const inst = makeInst(); const w = world(name, { instances: [['inst1', inst]], players: { h1: p }, noSocketFor: noSocket ? ['h1'] : [] });
      const sock = passSocket ? { emit: (ev: string, data: any) => w.log.push(['passed', ev, plain(data)]) } : undefined;
      w.fake.endDungeonRun(p, sock); record(name, w, { runAfter: p.dungeonRun ?? null });
    };
    const failed = (n = 6) => ({ cleared: false, gold: 1001, items: Array.from({ length: n }, (_v, i) => ({ itemId: i % 2 ? 'town_scroll' : 'health_potion', amount: i + 1 })), floor: 4, difficulty: 'normal' });
    end('end no run', hero());
    end('end cleared run', hero({ dungeonRun: { ...failed(), cleared: true } }));
    end('end failed run', hero({ dungeonRun: failed() }));
    end('end failed run, given socket', hero({ dungeonRun: failed() }), true);
    end('end failed run, no socket', hero({ dungeonRun: failed() }), false, true);
    end('end failed, only gold', hero({ dungeonRun: { ...failed(0), gold: 3 } }));
    end('end failed, tiny gold', hero({ dungeonRun: { ...failed(0), gold: 1 } }));
    end('end failed, only items', hero({ dungeonRun: { ...failed(5), gold: 0 } }));
    end('end failed, one item', hero({ dungeonRun: { ...failed(1), gold: 0 } }));
    end('end failed, empty', hero({ dungeonRun: { ...failed(0), gold: 0 } }));
    end('end failed, many items', hero({ dungeonRun: failed(40) }));

    // ---- handleOpenChest
    const open = (name: string, p: any, chestId: any, instProps: any = {}, withInstance = true, noSocket = false) => {
      const inst = makeInst(instProps); const w = world(name, { instances: withInstance ? [['inst1', inst]] : [], players: { h1: p }, noSocketFor: noSocket ? ['h1'] : [] });
      w.fake.handleOpenChest('h1', chestId); record(name, w, { chests: plain(withInstance ? inst.chests : w.fake.dungeon.chests) });
    };
    open('chest dead', hero({ isDead: true }), 'c1');
    open('chest not in dungeon', hero({ zone: 'town' }), 'c1');
    open('chest unknown id', hero(), 'zzz');
    open('chest too far', hero({ x: 1, y: 1 }), 'c1');
    open('chest at range limit', hero({ x: 5 + 2.5, y: 5 }), 'c1');
    open('chest just out of range', hero({ x: 5 + 2.51, y: 5 }), 'c1');
    open('chest opens (loot bagged)', hero(), 'c1');
    open('chest gold chest', hero({ x: 9, y: 9 }), 'c2');
    open('chest already opened by me', hero(), 'c1', { chests: [{ id: 'c1', x: 5, y: 5, openedBy: ['h1'] }] });
    open('chest opened by others only', hero(), 'c1', { chests: [{ id: 'c1', x: 5, y: 5, openedBy: ['someone'] }] });
    open('chest existing run', hero({ dungeonRun: { cleared: false, gold: 5, items: [{ itemId: 'x', amount: 1 }], floor: 3, difficulty: 'hard' } }), 'c1');
    open('chest after clear gives loot directly', hero({ dungeonRun: { cleared: true, gold: 0, items: [], floor: 3, difficulty: 'hard' } }), 'c1');
    open('chest no socket', hero(), 'c1', {}, true, true);
    open('chest no instance (legacy dungeon)', hero({ dungeonInstanceId: null, x: 5, y: 5 }), 'lc', {}, false);
    open('chest no instance, no run yet, far', hero({ dungeonInstanceId: null, x: 40, y: 40 }), 'lc', {}, false);

    if (process.env.UPDATE_FIXTURES === '1') {
      fs.writeFileSync(FIXTURE, JSON.stringify(got, null, 2) + '\n', 'utf8');
      return;
    }
    assert.deepEqual(plain(got), JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
  } finally {
    Date.now = realNow; Math.random = realRandom;
    await (await import('../accountManager')).default.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
