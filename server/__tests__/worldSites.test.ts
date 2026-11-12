// Every place that creates a world object (projectile, ground item, dungeon instance, rift instance, party),
// driven through its real entry point with seeded randomness and a frozen clock. The expected output
// (server/__tests__/fixtures/world.json) was captured BEFORE the entities/world.ts refactor, so this test proves
// the factories build exactly the same objects. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/world.json');
const NOW = 1700000000000;
const sha = (v: any) => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex');
// Maps/Sets become arrays and Infinity a marker, so everything can be stored as JSON
const plain = (v: any): any => JSON.parse(JSON.stringify(v, (_k, x) => {
  if (x instanceof Map) return { __map: Array.from(x.entries()) };
  if (x instanceof Set) return { __set: Array.from(x.values()) };
  if (x === Infinity) return '__Infinity__';
  return x;
}));

function seeded<T>(seed: number, fn: () => T): T {
  const realRandom = Math.random, realNow = Date.now;
  let s = seed >>> 0;
  Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  Date.now = () => NOW;
  try { return fn(); } finally { Math.random = realRandom; Date.now = realNow; }
}
const noop = (): void => undefined;
const loose = (props: any) => new Proxy(props, { get: (t, k) => (k in t ? t[k] : noop) });

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // the server module imports the accountManager singleton
  const mod: any = await import('../gameServer');
  return { dir, GS: mod.default || mod.GameServer };
}

test('world object creation sites match the pre-refactor fixture', async () => {
  const { dir, GS } = await load();
  try {
    const got: any = {};

    // 1. projectiles: the player's ranged attack and the rift turret bolt
    got.projectiles = [];
    const casters: any[] = [
      { id: 'p1', zone: 'town', x: 5, y: 5, facing: 'SE', equipment: { weapon: { element: 'fire' } } },
      { id: 'p2', zone: 'dungeon', dungeonInstanceId: 'party_7', x: 10, y: 12, facing: 'N', spTransformed: true, equipment: { sp: { cardId: 'sp_x' }, weapon: {} } },
      { id: 'p3', zone: 'frostfell', x: 1, y: 1, facing: 'SW', equipment: {} },
      { id: 'p4', zone: 'dungeon', x: 2, y: 2, facing: 'weird', equipment: null },
    ];
    const shots: any[][] = [
      [casters[0], 8, 9, 'm1', 'mob', 40, { splash: 0.3, crit: true }],
      [casters[1], 11, 12, 'm2', 'mob', 15, {}],
      [casters[2], 1, 1, undefined, undefined, 9, undefined],       // zero distance: aimed by facing
      [casters[3], undefined, undefined, 'm3', 'mob', 1, {}],       // no target position, unknown facing
    ];
    for (const args of shots) {
      const emitted: any[] = [];
      // a server without its constructor; its systems are wired when GameServer has initSystems()
      const fake: any = Object.create(GS.prototype);
      Object.assign(fake, { projectiles: new Map(), nextEntityId: 7000, emitZone: (...a: any[]) => emitted.push(a) });
      if (typeof fake.initSystems === 'function') fake.initSystems();
      seeded(1, () => fake.spawnProjectile(...args));
      got.projectiles.push({ stored: plain(Array.from(fake.projectiles.values())), emitted: plain(emitted), nextEntityId: fake.nextEntityId });
    }
    {
      const emitted: any[] = [];
      const fake: any = loose({ projectiles: new Map(), nextEntityId: 7100, emitZone: (...a: any[]) => emitted.push(a) });
      seeded(2, () => GS.prototype.spawnRiftBolt.call(fake, { id: 'rift_t' }, { x: 3, y: 4 }, { id: 'owner1' }, { x: 9, y: 1, id: 'm9' }, 33));
      got.riftBolt = { stored: plain(Array.from(fake.projectiles.values())), emitted: plain(emitted), nextEntityId: fake.nextEntityId };
    }

    // 2. ground items
    got.groundItems = [];
    const drops: any[][] = [
      ['town', 'gold', 'gold', 1, 2, 1500],
      ['town', 'item', 'ancient_ruby', 3, 4, 2],
      ['frostfell', 'item', 'sp_card', 5, 6, 1, { id: 'sp_card_x', name: 'Custom Card', custom: true }],
      ['town', 'item', 'not_in_items', 7, 8, 5],
      ['dungeon', 'item', 'iron_blade', 9, 10, 1, null, 'party_3'],
    ];
    for (const args of drops) {
      const map = new Map(); const emitted: any[] = [];
      // a server without its constructor; its systems are wired when GameServer has initSystems()
      const fake: any = Object.create(GS.prototype);
      Object.assign(fake, { nextEntityId: 8000, getGroundItemsMap: () => map, emitZone: (...a: any[]) => emitted.push(a) });
      if (typeof fake.initSystems === 'function') fake.initSystems();
      seeded(3, () => fake.spawnGroundItem(...args));
      got.groundItems.push({ stored: plain(Array.from(map.values())), emitted: plain(emitted), nextEntityId: fake.nextEntityId });
    }

    // 3. dungeon instances (everything except the generated map, which is hashed)
    got.dungeonInstances = [];
    const runs: any[][] = [
      [{ id: 'sock1', partyId: null }, 1, 'normal', true, 'classic', []],
      [{ id: 'sock2', partyId: 'p9' }, 3, 'hard', true, 'classic', ['fortified']],
      [{ id: 'sock3', partyId: null }, 6, 'nightmare', true, 'classic', ['swift', 'volatile']],
    ];
    for (const args of runs) {
      const fake: any = loose({ dungeonInstances: new Map() });
      const inst: any = seeded(4, () => GS.prototype.getOrCreateDungeonInstance.call(fake, ...args));
      const { dungeon, mobs, pendingMobs, chests, groundItems, ...scalars } = inst;
      got.dungeonInstances.push({
        scalars: plain(scalars), dungeonHash: sha(plain(dungeon)),
        mobsSize: mobs.size, groundItemsSize: groundItems.size, chestsHash: sha(plain(chests)),
        pending: plain(Array.from(pendingMobs.entries()).map(([k, v]: any) => [k, v.length])),
        stored: fake.dungeonInstances.has(inst.id)
      });
    }

    // 4. Eternal Rift instances
    got.riftInstances = [];
    const solo: any = { id: 'rl', level: 40, partyId: null };
    const leaderA: any = { id: 'la', level: 50, partyId: 'party_1' }, memberB: any = { id: 'mb', level: 30, partyId: 'party_1' };
    const riftRuns: any[][] = [
      ['rift_solo_rl', solo, 'normal'], ['rift_solo_rl', solo, 'hard'], ['rift_solo_rl', solo, 'nightmare'], ['rift_solo_rl', solo, 'bogus'], ['rift_solo_rl', solo, undefined],
      ['rift_party_party_1', leaderA, 'nightmare'],
    ];
    for (const args of riftRuns) {
      const fake: any = loose({
        parties: new Map([['party_1', { id: 'party_1', leaderId: 'la', memberIds: new Set(['la', 'mb']) }]]),
        players: new Map([['la', leaderA], ['mb', memberB], ['rl', solo]]),
        dungeonInstances: new Map()
      });
      const inst: any = seeded(5, () => GS.prototype.createRiftInstance.call(fake, ...args));
      const { dungeon, ...rest } = inst;
      got.riftInstances.push({ inst: plain(rest), dungeonHash: sha(plain(dungeon)), stored: fake.dungeonInstances.get(args[0]) === inst });
    }

    // 5. parties (created by the first invite)
    {
      const a: any = { id: 'a', name: 'Alice', x: 0, y: 0 }, b: any = { id: 'b', name: 'Bob', x: 1, y: 1 };
      // a server without its constructor; its systems are wired when GameServer has initSystems()
      const fake: any = Object.create(GS.prototype);
      Object.assign(fake, { players: new Map([['a', a], ['b', b]]), parties: new Map(), nextPartyId: 1, io: { sockets: { sockets: new Map() } } });
      if (typeof fake.initSystems === 'function') fake.initSystems();
      try { fake.handlePartyInvite('a', { targetPlayerId: 'b' }); } catch { /* only the creation matters here */ }
      fake.handlePartyInvite('a', { targetPlayerId: 'zzz' }); // unknown target: no new party
      got.parties = { parties: plain(fake.parties), nextPartyId: fake.nextPartyId, aPartyId: a.partyId, bPartyId: b.partyId ?? null };
    }

    if (process.env.UPDATE_FIXTURES === '1') {
      fs.writeFileSync(FIXTURE, JSON.stringify(got, null, 2) + '\n', 'utf8');
      return;
    }
    assert.deepEqual(plain(got), JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
  } finally {
    await (await import('../accountManager')).default.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
