// Every place that creates monsters, driven through its real entry point with seeded randomness and a frozen
// clock. The expected output (server/__tests__/fixtures/mobs.json) was captured BEFORE the MobFactory refactor,
// so this test proves the factory builds exactly the same monsters. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/mobs.json');
const NOW = 1700000000000;
const sha = (v: any) => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex');
const clean = (v: any) => JSON.parse(JSON.stringify(v, (_k, x) => (x === Infinity ? '__Infinity__' : x)));
const sample = (list: any[], n = 5) => ({ count: list.length, hash: sha(clean(list)), first: clean(list.slice(0, n)), last: clean(list.slice(-1)) });

// deterministic Math.random + Date.now for the duration of fn
function seeded<T>(seed: number, fn: () => T): T {
  const realRandom = Math.random, realNow = Date.now;
  let s = seed >>> 0;
  Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  Date.now = () => NOW;
  try { return fn(); } finally { Math.random = realRandom; Date.now = realNow; }
}
const noop = () => undefined;
const loose = (props: any) => new Proxy(props, { get: (t, k) => (k in t ? t[k] : noop) });

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // the server module imports the accountManager singleton
  const mod: any = await import('../gameServer');
  return {
    dir,
    GS: mod.default || mod.GameServer,
    FZ: await import('../fieldZones'),
    RAID: await import('../raidBosses'),
    RIFT: await import('../eternalRift'),
    BM: await import('../bossMechanics'),
    GEN: await import('../dungeonGenerator'),
    ADMIN: await import('../adminCommands'),
  };
}

test('monster creation sites match the pre-refactor fixture', async () => {
  const { dir, GS, FZ, RAID, RIFT, BM, GEN, ADMIN } = await load();
  try {
    const got: any = {};

    // 1. field zones (initFieldMonsters)
    got.field = {};
    for (const zid of [FZ.FIELD_ZONES[0].id, 'frostfell', FZ.FIELD_ZONES[FZ.FIELD_ZONES.length - 1].id]) {
      const zone = FZ.FIELD_ZONES.find((z: any) => z.id === zid);
      seeded(11, () => {
        const field = { zone, map: FZ.generateFieldMap(zone), mobs: new Map() };
        // a server without its constructor; its systems are wired when GameServer has initSystems()
        const fake: any = Object.create(GS.prototype);
        Object.assign(fake, { fields: new Map([[zid, field]]), nextEntityId: 1000 });
        if (typeof fake.initSystems === 'function') fake.initSystems();
        fake.initFieldMonsters();
        got.field[zid] = { nextEntityId: fake.nextEntityId, ...sample(Array.from(field.mobs.values())) };
      });
    }

    // 2. raid bosses (spawnRaidBoss)
    got.raid = {};
    for (const zid of Object.keys(RAID.RAID_BOSSES).slice(0, 3)) {
      seeded(22, () => {
        const field = { zone: FZ.FIELD_ZONES.find((z: any) => z.id === zid), mobs: new Map() };
        // a server without its constructor; its systems are wired when GameServer has initSystems()
        const fake: any = Object.create(GS.prototype);
        Object.assign(fake, { fields: new Map([[zid, field]]), raidStates: new Map(), nextEntityId: 2000, broadcastSystemMessage: noop, emitZone: noop });
        if (typeof fake.initSystems === 'function') fake.initSystems();
        fake.spawnRaidBoss(zid);
        got.raid[zid] = clean(Array.from(field.mobs.values()));
      });
    }

    // 3. eternal rift monsters (spawnRiftMob)
    got.rift = {};
    for (const wave of [5, RIFT.RIFT_MAX_WAVES]) {
      seeded(33 + wave, () => {
        const defs = RIFT.buildRiftWave(wave, 40, 2);
        const inst: any = { id: 'rift_test', rift: { gateTurn: 0 }, mobs: new Map() };
        const fake: any = loose({ nextEntityId: 3000 });
        for (const def of defs) GS.prototype.spawnRiftMob.call(fake, inst, def);
        got.rift['wave' + wave] = sample(Array.from(inst.mobs.values()), 3);
      });
    }

    // 4. boss adds (bossMechanics.summonAdds, triggered by the boss entering phase 2)
    seeded(44, () => {
      const inst: any = { mobs: new Map() };
      const hero = { id: 'hero1', zone: 'dungeon', dungeonInstanceId: 'inst1', x: 10, y: 10, isDead: false };
      const gs: any = loose({ players: new Map([['hero1', hero]]), dungeonInstances: new Map([['inst1', inst]]), isColliding: () => false });
      const mech = BM.createBossMechanics(gs);
      const boss: any = {
        id: 'boss1', name: 'Test Boss', mechanics: 'boss', state: 'chase', hp: 50, maxHp: 100, x: 10, y: 10, roomIdx: 3,
        element: 'dark', zone: { minX: 0, maxX: 30, minY: 0, maxY: 30 }, attackCooldown: 0,
        addTemplate: { type: 'skeleton', name: 'Bone Add', level: 7, hp: 120, maxHp: 120, dmg: 9, def: 3, speed: 3, element: 'dark', buffs: ['x'], isGuard: true }
      };
      mech.update(boss, 'dungeon', 0.04, 'inst1');
      got.bossAdds = clean(Array.from(inst.mobs.values()));
    });

    // 5. dungeon monsters: instance (pending per room) and the legacy global dungeon
    seeded(55, () => {
      const inst: any = GS.prototype.getOrCreateDungeonInstance.call(
        loose({ dungeonInstances: new Map() }), { id: 'sock1', partyId: null }, 2, 'hard', true, 'classic', ['fortified', 'swift']);
      const rooms: any = {};
      for (const [k, list] of inst.pendingMobs.entries()) rooms[k] = list;
      got.dungeonInstance = { rooms: Object.keys(rooms).length, ...sample(([] as any[]).concat(...Object.values(rooms)), 6), totals: [inst.totalTrashMobs, inst.requiredKills] };
    });
    seeded(66, () => {
      const fake: any = Object.create(GS.prototype);
      Object.assign(fake, { dungeonMobs: new Map(), dungeon: GEN.generateProceduralDungeon(1, 'normal') });
      if (typeof fake.initSystems === 'function') fake.initSystems();
      fake.initDungeonMonsters();
      got.dungeonLegacy = sample(Array.from(fake.dungeonMobs.values()), 4);
    });

    // 6. admin /spawn
    seeded(77, () => {
      const townMobs = new Map();
      const gameServer: any = loose({ townMobs, nextEntityId: 5000, io: { sockets: { sockets: new Map() } } });
      const player = { id: 'adm', zone: 'town', x: 20, y: 23, level: 15 };
      ADMIN.COMMANDS.spawn.run(gameServer, player, ['wolf', '3']);
      ADMIN.COMMANDS.spawn.run(gameServer, player, ['dragon', 'boss']);
      got.admin = clean(Array.from(townMobs.values()));
    });

    if (process.env.UPDATE_FIXTURES === '1') {
      fs.writeFileSync(FIXTURE, JSON.stringify(got, null, 2) + '\n', 'utf8');
      return;
    }
    assert.deepEqual(got, JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
  } finally {
    await (await import('../accountManager')).default.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
