// Zone system (portals, teleports, entering/leaving the dungeon, boss portal, monster set-up): locked to a fixture
// captured BEFORE the methods moved out of GameServer. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemZone.json');
const NOW = 1700000000000;
const plain = (v: any): any => v === undefined ? null : JSON.parse(JSON.stringify(v, (_k, x) => (x instanceof Map ? { __map: Array.from(x.entries()) } : x instanceof Set ? { __set: Array.from(x.values()) } : x === Infinity ? '__Infinity__' : x)));
const sha = (v: any) => crypto.createHash('sha1').update(JSON.stringify(plain(v))).digest('hex');
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hashName = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // the server module imports the accountManager singleton
  const mod: any = await import('../gameServer');
  return { dir, GS: mod.default || mod.GameServer, FZ: await import('../fieldZones') };
}

test('zone methods match the pre-refactor fixture', async () => {
  const { dir, GS, FZ } = await load();
  const realNow = Date.now, realRandom = Math.random;
  Date.now = () => NOW;
  try {
    const got: any = {};
    const hero = (extra: any = {}) => ({
      id: 'h1', name: 'Hero', zone: 'town', x: 21, y: 19, level: 40, isDead: false, portalCooldown: 0, targetX: 3, targetY: 4, partyId: null, ...extra,
    });
    const room = (cx: number, cy: number, extra: any = {}) => ({ cx, cy, x: cx - 2, y: cy - 2, w: 5, h: 5, ...extra });
    const makeInst = (extra: any = {}) => ({
      id: 'inst1', floor: 2, difficulty: 'hard', mode: 'classic', mods: ['swift'], bossPortalReady: true, bossPortalSpawned: false,
      roomsSpawned: new Set([0]), pendingMobs: new Map([[2, [{ id: 'boss', x: 9, y: 9, isBoss: true, element: 'dark' }]]]), announce: true,
      mobs: new Map<string, any>([['m1', { id: 'm1', x: 6, y: 6, state: 'idle', hp: 5 }], ['mfar', { id: 'mfar', x: 400, y: 5, state: 'idle', hp: 5 }], ['mdead', { id: 'mdead', x: 6, y: 6, state: 'dead', hp: 0 }]]),
      groundItems: new Map([['g1', { id: 'g1' }]]), chests: [{ id: 'c1' }],
      dungeon: { spawnPoint: { x: 5, y: 5 }, rooms: [room(5, 5), room(10, 5), room(15, 5)], obstacles: [], tiles: [[1]], bossRoom: room(15, 5) },
      ...extra,
    });
    const field = (id = 'frostfell', gate = 10) => ({
      zone: { id, name: 'Frost Fell', gateLevel: gate, minLevel: 10, maxLevel: 20 },
      map: { obstacles: [{ type: 'field_portal', x: 30, y: 30, target: 'town', arrive: 'south' }, { type: 'field_portal', x: 40, y: 10, target: 'nextzone', arrive: 'north' }, { type: 'rock', x: 21, y: 19 }],
        arrivals: { south: { x: 8, y: 9 }, north: { x: 3, y: 4 } }, spawnPoint: { x: 1, y: 2 } },
      mobs: new Map<string, any>([['a', { id: 'a', x: 8, y: 9, state: 'idle' }], ['b', { id: 'b', x: 500, y: 9, state: 'idle' }], ['c', { id: 'c', x: 500, y: 9, state: 'idle', isBoss: true }], ['d', { id: 'd', x: 8, y: 9, state: 'dead' }]]),
      groundItems: new Map([['gi', { id: 'gi' }]]),
    });
    const townMap = () => ({
      obstacles: [{ id: 'portal_dungeon', x: 10, y: 10 }, { id: 'portal_rift', x: 30, y: 10 }, { type: 'field_portal', x: 21, y: 5, target: 'frostfell', arrive: 'south' }, { id: 'tree', x: 21, y: 19 }],
      arrivals: { south: { x: 7, y: 7 }, north: { x: 8, y: 8 } },
    });

    function world(name: string, opts: any = {}) {
      Math.random = mulberry32(hashName(name));
      const log: any[] = [];
      const mkSocket = (id: string) => ({
        emit: (ev: string, data: any) => log.push(['socket', id, ev, plain(data)]),
        join: (r: string) => log.push(['socket', id, 'join', r]), leave: (r: string) => log.push(['socket', id, 'leave', r]),
      });
      const players = new Map<string, any>(); const sockets = new Map<string, any>();
      for (const [id, p] of Object.entries<any>(opts.players || { h1: hero() })) { players.set(id, p); if (!(opts.noSocketFor || []).includes(id)) sockets.set(id, mkSocket(id)); }
      const fake: any = Object.create(GS.prototype);
      Object.assign(fake, {
        players, io: { sockets: { sockets } }, townMap: townMap(), townMobs: new Map([['t1', { id: 't1' }]]), townGroundItems: new Map([['tg', { id: 'tg' }]]),
        fields: new Map(opts.fields || []), dungeonInstances: new Map(opts.instances || []), dungeonMobs: new Map(), dungeonGroundItems: new Map(), nextEntityId: 500,
        emitZone: (...a: any[]) => log.push(['zone', ...plain(a)]),
        sendDirectMessage: (...a: any[]) => log.push(['call', 'sendDirectMessage', ...plain(a)]),
        broadcastSystemMessage: (m: string) => log.push(['call', 'broadcastSystemMessage', m]),
        raidInfo: (z: string) => { log.push(['call', 'raidInfo', z]); return { raid: z }; },
        riftPortalInfo: (p: any) => { log.push(['call', 'riftPortalInfo', p.id]); return { rift: true }; },
        leaveRift: (p: any) => log.push(['call', 'leaveRift', p.id]),
        handlePartySummon: (id: string) => log.push(['call', 'handlePartySummon', id]),
        emitDungeonRunUpdate: (p: any) => log.push(['call', 'emitDungeonRunUpdate', p.id]),
        endDungeonRun: (p: any) => log.push(['call', 'endDungeonRun', p.id]),
        getOrCreateDungeonInstance: (p: any, ...rest: any[]) => { log.push(['call', 'getOrCreateDungeonInstance', p.id, ...plain(rest)]); return opts.created || makeInst(); },
        ...(opts.props || {}),
      });
      if (typeof fake.initSystems === 'function') fake.initSystems();
      return { fake, log, players };
    }
    const rec = (name: string, w: any, extra: any = {}) => { got[name] = { log: plain(w.log), players: plain(Object.fromEntries(w.players)), ...extra }; };

    // ---- teleportPlayerToTown
    const toTown = (name: string, p: any, at: any = null, opts: any = {}) => {
      const w = world(name, { players: { h1: p }, instances: [['inst1', makeInst()]], ...opts });
      w.fake.teleportPlayerToTown(p, w.fake.io.sockets.sockets.get('h1'), at); rec(name, w, { instances: Array.from(w.fake.dungeonInstances.keys()) });
    };
    toTown('town from field', hero({ zone: 'frostfell', x: 9, y: 9 }));
    toTown('town at a spot', hero({ zone: 'frostfell' }), { x: 7, y: 8 });
    toTown('town from dungeon (last one out)', hero({ zone: 'dungeon', dungeonInstanceId: 'inst1', dungeonRun: { gold: 1 } }));
    toTown('town from dungeon (party mate stays)', hero({ zone: 'dungeon', dungeonInstanceId: 'inst1' }), null, { players: { h1: hero({ zone: 'dungeon', dungeonInstanceId: 'inst1' }), h2: hero({ id: 'h2', zone: 'dungeon', dungeonInstanceId: 'inst1' }) } });
    toTown('town from dungeon, no instance id', hero({ zone: 'dungeon', dungeonInstanceId: null }));

    // ---- teleportPlayerToField / Frostfell
    const toField = (name: string, p: any, zoneId: string, arrive?: any, at?: any, f: any = field()) => {
      const w = world(name, { players: { h1: p, h2: hero({ id: 'h2', zone: zoneId, x: 5, y: 5 }), h3: hero({ id: 'h3', zone: 'town' }) }, fields: [['frostfell', f]] });
      w.fake.teleportPlayerToField(p, w.fake.io.sockets.sockets.get('h1'), zoneId, arrive, at); rec(name, w);
    };
    toField('field arrive south', hero({ x: 21, y: 6 }), 'frostfell');
    toField('field arrive north', hero(), 'frostfell', 'north');
    toField('field arrive unknown name uses spawn point', hero(), 'frostfell', 'east');
    toField('field arrive at a spot', hero(), 'frostfell', 'south', { x: 11, y: 12 });
    toField('field no arrivals no spawn', hero(), 'frostfell', 'south', null, (() => { const f = field(); f.map.arrivals = undefined as any; f.map.spawnPoint = undefined as any; return f; })());
    toField('field level too low', hero({ level: 3 }), 'frostfell');
    toField('field level exactly the gate', hero({ level: 10 }), 'frostfell');
    toField('field level missing counts as 1', hero({ level: undefined }), 'frostfell');
    toField('field unknown zone', hero(), 'nowhere');
    { const p = hero(); const w = world('frostfell shortcut', { players: { h1: p }, fields: [['frostfell', field()]] }); w.fake.teleportPlayerToFrostfell(p, w.fake.io.sockets.sockets.get('h1')); rec('frostfell shortcut', w); }

    // ---- teleportPlayerToDungeon
    const toDung = (name: string, p: any, inst: any, at: any = null, opts: any = {}) => {
      const w = world(name, { players: { h1: p, h2: hero({ id: 'h2', zone: 'dungeon', dungeonInstanceId: 'inst1' }), h3: hero({ id: 'h3', zone: 'dungeon', dungeonInstanceId: 'other' }) }, instances: [['inst1', makeInst()]], ...opts });
      const sock = opts.noSocket ? undefined : w.fake.io.sockets.sockets.get('h1');
      w.fake.teleportPlayerToDungeon(p, sock, inst, at); rec(name, w);
    };
    toDung('dungeon given instance', hero(), makeInst());
    toDung('dungeon at a spot', hero(), makeInst(), { x: 12, y: 13 });
    toDung('dungeon leaves old room', hero({ _room: 'dungeon:old' }), makeInst());
    toDung('dungeon no socket', hero(), makeInst(), null, { noSocket: true });
    toDung('dungeon looks up own instance', hero({ zone: 'dungeon', dungeonInstanceId: 'inst1' }), null);
    toDung('dungeon creates an instance', hero(), null);
    toDung('dungeon unknown floor name', hero(), makeInst({ floor: 77, difficulty: 'mystery' }));

    // ---- handleEnterDungeon
    const enter = (name: string, p: any, options?: any, opts: any = {}) => {
      const w = world(name, { players: { h1: p }, ...opts });
      w.fake.handleEnterDungeon('h1', options); rec(name, w);
    };
    enter('enter default', hero());
    enter('enter floor 5 hard rush with mods', hero(), { floor: '5', difficulty: 'hard', mode: 'rush', mods: ['swift', 'volatile'] }, {});
    enter('enter level gate', hero({ level: 1 }), { floor: 6 });
    enter('enter floor clamped high', hero(), { floor: 999 });
    enter('enter floor clamped low', hero(), { floor: -4 });
    enter('enter junk options', hero(), { floor: 'x', difficulty: 'impossible', mode: 'weird', mods: 'nope' });
    enter('enter and summon party', hero(), { inviteParty: true });
    enter('enter joins the party dungeon', hero({ partyId: 'p9' }), { floor: 1, difficulty: 'normal' }, { instances: [['party_p9', makeInst({ id: 'party_p9', floor: 3, difficulty: 'nightmare', mode: 'rush', mods: ['volatile'] })]] });
    enter('enter party member without a dungeon yet', hero({ partyId: 'p9' }), { floor: 2 });
    enter('enter dead', hero({ isDead: true }));
    enter('enter not in town', hero({ zone: 'frostfell' }));
    { const p = hero(); const w = world('enter no player', { players: { h1: p } }); w.fake.handleEnterDungeon('zz', {}); rec('enter no player', w); }
    { const p = hero(); const w = world('enter no socket', { players: { h1: p }, noSocketFor: ['h1'] }); w.fake.handleEnterDungeon('h1', {}); rec('enter no socket', w); }

    // ---- handleLeaveDungeon
    const leave = (name: string, p: any, inst: any, opts: any = {}) => {
      const w = world(name, { players: { h1: p }, instances: inst ? [['inst1', inst]] : [], ...opts });
      w.fake.handleLeaveDungeon('h1'); rec(name, w, { instances: Array.from(w.fake.dungeonInstances.keys()) });
    };
    const inDungeon = (extra: any = {}) => hero({ zone: 'dungeon', dungeonInstanceId: 'inst1', x: 5, y: 5, ...extra });
    leave('leave ok', inDungeon(), makeInst());
    leave('leave rift', inDungeon(), makeInst({ rift: { gateTurn: 1 } }));
    leave('leave boss room, boss alive', inDungeon({ x: 15, y: 5 }), makeInst({ mobs: new Map([['boss', { id: 'boss', isBoss: true, state: 'chase', hp: 9 }]]) }));
    leave('leave boss room, boss dead', inDungeon({ x: 15, y: 5 }), makeInst({ mobs: new Map([['boss', { id: 'boss', isBoss: true, state: 'dead', hp: 0 }]]) }));
    leave('leave boss room edge', inDungeon({ x: 15 + 3.5, y: 5 }), makeInst({ mobs: new Map([['boss', { id: 'boss', isBoss: true, state: 'idle', hp: 9 }]]) }));
    leave('leave boss alive but far from the room', inDungeon({ x: 2, y: 2 }), makeInst({ mobs: new Map([['boss', { id: 'boss', isBoss: true, state: 'idle', hp: 9 }]]) }));
    leave('leave no instance (legacy dungeon)', inDungeon({ dungeonInstanceId: null }), null, { props: { dungeon: { bossRoom: room(15, 5) }, dungeonMobs: new Map([['b', { id: 'b', isBoss: true, state: 'idle', hp: 3 }]]) } });
    leave('leave legacy dungeon in boss room', inDungeon({ dungeonInstanceId: null, x: 15, y: 5 }), null, { props: { dungeon: { bossRoom: room(15, 5) }, dungeonMobs: new Map([['b', { id: 'b', isBoss: true, state: 'idle', hp: 3 }]]) } });
    leave('leave not in dungeon', hero(), makeInst());
    leave('leave dead', inDungeon({ isDead: true }), makeInst());
    leave('leave no socket', inDungeon(), makeInst(), { noSocketFor: ['h1'] });

    // ---- handleUsePortal / checkPortalAndInteractions
    const portal = (name: string, p: any, opts: any = {}) => {
      const w = world(name, { players: { h1: p }, fields: [['frostfell', field()], ['nextzone', field('nextzone', 15)]], ...opts });
      w.fake.handleUsePortal('h1'); rec(name, w);
    };
    portal('portal dead', hero({ isDead: true, x: 10, y: 10 }));
    portal('portal cooling down', hero({ x: 10, y: 10, portalCooldown: 1 }));
    portal('portal dungeon gate', hero({ x: 10, y: 10 }));
    portal('portal dungeon gate at range limit', hero({ x: 12.5, y: 10 }));
    portal('portal dungeon gate just too far', hero({ x: 12.51, y: 10 }));
    portal('portal rift gate', hero({ x: 30, y: 10 }));
    portal('portal city gate to field', hero({ x: 21, y: 5 }));
    portal('portal city gate level gate', hero({ x: 21, y: 5, level: 2 }));
    portal('portal nowhere in town', hero({ x: 1, y: 1 }));
    portal('portal field back to town', hero({ zone: 'frostfell', x: 30, y: 30 }));
    portal('portal field on to next zone', hero({ zone: 'frostfell', x: 40, y: 10 }));
    portal('portal field next zone gated', hero({ zone: 'frostfell', x: 40, y: 10, level: 12 }));
    portal('portal field nothing near', hero({ zone: 'frostfell', x: 1, y: 1 }));
    portal('portal field town without arrivals', hero({ zone: 'frostfell', x: 30, y: 30 }), { props: { townMap: { obstacles: [] } } });
    const bossObs = (extra: any = {}) => ({ id: 'portal_boss', type: 'dungeon_boss_portal', x: 6, y: 6, isReturn: false, ...extra });
    portal('portal boss gate', hero({ zone: 'dungeon', dungeonInstanceId: 'inst1', x: 6, y: 6 }), { instances: [['inst1', makeInst({ dungeon: { ...makeInst().dungeon, obstacles: [bossObs()] } })]] });
    portal('portal boss return', hero({ zone: 'dungeon', dungeonInstanceId: 'inst1', x: 6, y: 6 }), { instances: [['inst1', makeInst({ bossPortalPos: { x: 2, y: 3 }, dungeon: { ...makeInst().dungeon, obstacles: [bossObs({ isReturn: true })] } })]] });
    portal('portal dungeon nothing near', hero({ zone: 'dungeon', dungeonInstanceId: 'inst1', x: 1, y: 1 }), { instances: [['inst1', makeInst({ dungeon: { ...makeInst().dungeon, obstacles: [bossObs()] } })]] });
    portal('portal dungeon no instance', hero({ zone: 'dungeon', dungeonInstanceId: 'gone' }));
    portal('portal unknown zone', hero({ zone: 'plot' }));
    { const w = world('portal no player', {}); w.fake.handleUsePortal('zz'); rec('portal no player', w); }
    { const p = hero({ x: 10, y: 10 }); const w = world('portal no socket', { players: { h1: p }, noSocketFor: ['h1'] }); w.fake.handleUsePortal('h1'); rec('portal no socket', w); }

    // ---- handleSpawnBossPortal
    const spawnPortal = (name: string, p: any, inst: any) => {
      const w = world(name, { players: { h1: p, h2: hero({ id: 'h2', zone: 'dungeon', dungeonInstanceId: 'inst1' }), h3: hero({ id: 'h3', zone: 'dungeon', dungeonInstanceId: 'x' }) }, instances: inst ? [['inst1', inst]] : [] });
      w.fake.handleSpawnBossPortal('h1'); rec(name, w, { inst: inst ? plain({ pos: inst.bossPortalPos, spawned: inst.bossPortalSpawned, obstacles: inst.dungeon.obstacles }) : null });
    };
    spawnPortal('bossportal ok', inDungeon({ x: 6.3, y: 7.6 }), makeInst());
    spawnPortal('bossportal no obstacle list', inDungeon({ x: 6, y: 7 }), (() => { const i = makeInst(); i.dungeon.obstacles = undefined as any; return i; })());
    spawnPortal('bossportal not ready', inDungeon(), makeInst({ bossPortalReady: false }));
    spawnPortal('bossportal already spawned', inDungeon(), makeInst({ bossPortalSpawned: true }));
    spawnPortal('bossportal no instance', inDungeon({ dungeonInstanceId: 'gone' }), null);
    spawnPortal('bossportal not in dungeon', hero(), makeInst());
    spawnPortal('bossportal dead', inDungeon({ isDead: true }), makeInst());

    // ---- teleportPlayerToBossRoom / FromBossRoom
    const bossRoom = (name: string, p: any, inst: any, noSocket = false) => {
      const w = world(name, { players: { h1: p }, noSocketFor: noSocket ? ['h1'] : [] });
      w.fake.teleportPlayerToBossRoom(p, noSocket ? null : w.fake.io.sockets.sockets.get('h1'), inst); rec(name, w, { spawned: plain(inst && inst.roomsSpawned), mobs: plain(inst && inst.mobs) });
    };
    bossRoom('bossroom first visit', inDungeon(), makeInst());
    bossRoom('bossroom already spawned', inDungeon(), makeInst({ roomsSpawned: new Set([0, 2]) }));
    bossRoom('bossroom spawn is empty', inDungeon(), makeInst({ pendingMobs: new Map() }));
    bossRoom('bossroom no socket', inDungeon(), makeInst(), true);
    bossRoom('bossroom no instance', inDungeon(), null);
    bossRoom('bossroom no rooms', inDungeon(), makeInst({ dungeon: { rooms: undefined } }));
    bossRoom('bossroom empty rooms', inDungeon(), makeInst({ dungeon: { rooms: [] } }));
    const fromBoss = (name: string, p: any, inst: any, noSocket = false) => {
      const w = world(name, { players: { h1: p }, noSocketFor: noSocket ? ['h1'] : [] });
      w.fake.teleportPlayerFromBossRoom(p, noSocket ? null : w.fake.io.sockets.sockets.get('h1'), inst); rec(name, w);
    };
    fromBoss('from boss with portal pos', inDungeon({ x: 15, y: 5 }), makeInst({ bossPortalPos: { x: 2, y: 3 } }));
    fromBoss('from boss with spawn point', inDungeon({ x: 15, y: 5 }), makeInst());
    fromBoss('from boss with nothing', inDungeon({ x: 15, y: 5 }), makeInst({ dungeon: {} }));
    fromBoss('from boss no socket', inDungeon({ x: 15, y: 5 }), makeInst(), true);
    fromBoss('from boss no instance', inDungeon({ x: 15, y: 5 }), null);
    fromBoss('from boss no dungeon', inDungeon({ x: 15, y: 5 }), { id: 'x' });

    // ---- initFieldMonsters / initDungeonMonsters / regenerateDungeon
    {
      const w = world('init field', {}); const zones = [FZ.FIELD_ZONES[0], FZ.FIELD_ZONES[FZ.FIELD_ZONES.length - 1]];
      for (const zone of zones) w.fake.fields.set(zone.id, { zone, map: FZ.generateFieldMap(zone), mobs: new Map([['old', { id: 'old' }]]), groundItems: new Map() });
      w.fake.initFieldMonsters();
      got.initField = Object.fromEntries(zones.map(z => { const f = w.fake.fields.get(z.id); return [z.id, { count: f.mobs.size, hash: sha(Array.from(f.mobs.values())), keys: Array.from(f.mobs.keys()).slice(0, 4), hasOld: f.mobs.has('old') }]; })); got.initField.nextEntityId = w.fake.nextEntityId;
    }
    {
      const w = world('init dungeon', { props: { dungeon: { mobs: [{ id: 'dm1', type: 'skeleton', name: 'Bone', level: 3, hp: 50, maxHp: 50, dmg: 5, x: 3, y: 4 }, { id: 'dm2', type: 'ghoul', name: 'Ghoul', level: 4, hp: 60, maxHp: 60, dmg: 6, def: 9, x: 5, y: 6 }] }, dungeonMobs: new Map([['stale', 1]]) } });
      w.fake.initDungeonMonsters(); got.initDungeon = plain(w.fake.dungeonMobs);
      const w2 = world('init dungeon none', { props: { dungeon: null, dungeonMobs: new Map([['stale', 1]]) } }); w2.fake.initDungeonMonsters(); got.initDungeonNone = plain(w2.fake.dungeonMobs);
    }
    for (const [floor, diff] of [[1, 'normal'], [3, 'hard'], [8, 'nightmare'], [99, 'mystery']] as any[]) {
      const w = world(`regen ${floor} ${diff}`, { props: { dungeonGroundItems: new Map([['old', 1]]), dungeonMobs: new Map([['stale', 1]]) } });
      w.fake.regenerateDungeon(floor, diff);
      rec(`regen ${floor} ${diff}`, w, { floor: w.fake.dungeonFloor, diff: w.fake.dungeonDifficulty, dungeonHash: sha(w.fake.dungeon), mobCount: w.fake.dungeonMobs.size, groundItems: w.fake.dungeonGroundItems.size, mobsHash: sha(Array.from(w.fake.dungeonMobs.values())) });
    }
    { const w = world('regen default', {}); w.fake.regenerateDungeon(); rec('regen default', w, { floor: w.fake.dungeonFloor, diff: w.fake.dungeonDifficulty }); }

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
