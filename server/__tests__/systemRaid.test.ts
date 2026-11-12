// Raid system (field world-boss events: schedule, spawn, damage standings, leaderboard, payout): locked to a fixture
// captured BEFORE the methods moved out of GameServer. Randomness is seeded and the clock frozen; loot, EXP and
// message helpers are stubbed and logged. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemRaid.json');
const NOW = 1700000000000;
const plain = (v: any): any => (v === undefined ? null : JSON.parse(JSON.stringify(v, (_k, x) => (x instanceof Map ? { __map: Array.from(x.entries()) } : x instanceof Set ? { __set: Array.from(x) } : x === Infinity ? '__Infinity__' : x))));

function seeded<T>(seed: number, fn: () => T): T {
  const realRandom = Math.random;
  let s = seed >>> 0;
  Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  try { return fn(); } finally { Math.random = realRandom; }
}

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // the server module imports the accountManager singleton
  const mod: any = await import('../gameServer');
  const GS = mod.default || mod.GameServer;
  const RAID: any = await import('../raidBosses');
  const make = (props: any = {}) => {
    const fake: any = Object.create(GS.prototype);
    Object.assign(fake, props);
    if (typeof fake.initSystems === 'function') fake.initSystems();
    return fake;
  };
  return { dir, make, RAID };
}

test('raid system matches the pre-refactor fixture', async () => {
  const { dir, make, RAID } = await load();
  const realNow = Date.now;
  Date.now = () => NOW;
  try {
    const zones: string[] = Object.keys(RAID.RAID_BOSSES);
    const got: any = { zones };
    const [Z1, Z2] = zones;

    // a server with raid-capable fields, a few heroes and logged helpers
    const world = (o: any = {}) => {
      const log: any[] = [];
      const fields = new Map<string, any>(zones.map(z => [z, { zone: { id: z, name: 'Zone ' + z }, mobs: new Map() }]));
      const players = new Map<string, any>([
        ['p1', { id: 'p1', name: 'Ann', zone: Z1, characterClass: 'warrior', level: 40, isDead: false }],
        ['p2', { id: 'p2', name: 'Ben', zone: Z1, characterClass: 'mage', level: 40, isDead: false }],
        ['p3', { id: 'p3', name: 'Cy', zone: Z1, characterClass: 'rogue', level: 40, isDead: true }],
        ['p4', { id: 'p4', name: 'Di', zone: Z1, characterClass: 'warrior', level: 40, isDead: false }],
      ]);
      const sockets = new Map<string, any>(['p1', 'p2', 'p4'].map(id => [id, { emit: (ev: string, d: any) => log.push([id, ev, plain(d)]) }]));
      const gs = make({
        fields, players, raidStates: new Map(), raidNextSpawn: new Map(), nextEntityId: 100,
        io: { sockets: { sockets } },
        emitZone: (...a: any[]) => log.push(['zone', ...plain(a)]),
        broadcastSystemMessage: (t: string) => log.push(['system', t]),
        giveLootToPlayer: (p: any, entry: any, flag: any) => log.push(['loot', p.id, plain(entry), flag]),
        awardExp: (p: any, n: number) => log.push(['exp', p.id, n]),
        awardJobExp: (p: any, n: number) => log.push(['jobexp', p.id, n]),
        ...o,
      });
      return { gs, log, fields, players };
    };
    const state = (w: any) => plain({ raidStates: w.gs.raidStates, raidNextSpawn: w.gs.raidNextSpawn, nextEntityId: w.gs.nextEntityId, mobs: Array.from(w.fields.entries()).map(([z, f]: any) => [z, Array.from(f.mobs.values()).map((m: any) => ({ id: m.id, hp: m.hp, state: m.state }))]) });
    got.scenarios = {};
    const run = (name: string, o: any, seed: number, fn: (w: any) => any) => {
      const w = world(o);
      const result = seeded(seed, () => fn(w));
      got.scenarios[name] = { result: plain(result), log: w.log, state: state(w) };
    };

    // schedule
    run('updateSpawnsEveryZone', {}, 1, w => w.gs.updateRaidEvents());
    run('updateWaitsForRespawnClock', { raidNextSpawn: new Map(zones.map(z => [z, NOW + 5000])) }, 2, w => w.gs.updateRaidEvents());
    run('updateRespawnClockElapsed', { raidNextSpawn: new Map(zones.map(z => [z, NOW])) }, 3, w => w.gs.updateRaidEvents());
    run('updateBroadcastsAndExpires', {}, 4, w => {
      w.gs.spawnRaidBoss(Z1);
      if (Z2) w.gs.spawnRaidBoss(Z2);
      w.gs.raidStates.get(Z1).lastBroadcast = NOW - 5000;                       // due: leaderboard goes out
      if (Z2) w.gs.raidStates.get(Z2).despawnAt = NOW;                          // expired: retreats
      w.log.length = 0;
      w.gs.updateRaidEvents();
      return { z1Broadcast: w.gs.raidStates.get(Z1).lastBroadcast };
    });
    run('updateQuietBetweenBroadcasts', {}, 5, w => {
      w.gs.spawnRaidBoss(Z1);
      w.gs.raidStates.get(Z1).lastBroadcast = NOW - 1000;
      w.log.length = 0;
      w.gs.updateRaidEvents();
    });

    // spawn / despawn
    run('spawn', {}, 6, w => { w.gs.spawnRaidBoss(Z1); w.gs.spawnRaidBoss(Z1); });                // the second one is ignored: already up
    run('spawnUnknownZoneOrNoField', {}, 7, w => { w.gs.spawnRaidBoss('nowhere'); w.fields.delete(Z1); w.gs.spawnRaidBoss(Z1); });
    run('despawnTimeup', {}, 8, w => { w.gs.spawnRaidBoss(Z1); w.log.length = 0; w.gs.despawnRaidBoss(Z1); });
    run('despawnKill', {}, 9, w => { w.gs.spawnRaidBoss(Z1); w.log.length = 0; w.gs.despawnRaidBoss(Z1, 'kill'); });
    run('despawnNothingUp', {}, 10, w => { w.gs.despawnRaidBoss(Z1); w.gs.despawnRaidBoss('nowhere', 'kill'); });
    run('despawnUnknownConfig', {}, 11, w => {
      w.gs.spawnRaidBoss(Z1);
      const st = w.gs.raidStates.get(Z1);
      w.gs.raidStates.delete(Z1); w.gs.raidStates.set('ghostzone', st);      // a state whose zone has no raid config: 25 minute fallback
      w.log.length = 0;
      w.gs.despawnRaidBoss('ghostzone');
    });

    // damage, standings, leaderboard, info
    run('damageAndStandings', {}, 12, w => {
      w.gs.spawnRaidBoss(Z1);
      w.gs.recordRaidDamage(Z1, 'p1', 120.4); w.gs.recordRaidDamage(Z1, 'p2', 500.6); w.gs.recordRaidDamage(Z1, 'p1', 400);
      w.gs.recordRaidDamage(Z1, 'p3', 9999);                                   // dead: left out of the board
      w.gs.recordRaidDamage(Z1, 'ghost', 5000);                                // offline: left out
      w.gs.recordRaidDamage(Z1, 'p4', 0); w.gs.recordRaidDamage(Z1, 'p4', -5); w.gs.recordRaidDamage(Z1, 'p4', NaN); w.gs.recordRaidDamage(Z1, null, 10); w.gs.recordRaidDamage('nowhere', 'p1', 10);
      const st = w.gs.raidStates.get(Z1);
      return { standings: w.gs.raidStandings(st), damage: plain(st.damage) };
    });
    run('leaderboard', {}, 13, w => {
      w.gs.spawnRaidBoss(Z1);
      w.gs.recordRaidDamage(Z1, 'p1', 100); w.gs.recordRaidDamage(Z1, 'p2', 300);
      const st = w.gs.raidStates.get(Z1);
      st.despawnAt = NOW + 90500;
      w.fields.get(Z1).mobs.get(st.mobId).hp = 1234.6;
      w.log.length = 0;
      w.gs.broadcastRaidLeaderboard(Z1, st);
      const mob = w.fields.get(Z1).mobs.get(st.mobId);
      mob.state = 'dead';
      w.gs.broadcastRaidLeaderboard(Z1, st);                                   // dead boss: nothing
      w.gs.broadcastRaidLeaderboard('nowhere', st);                            // unknown zone: nothing
    });
    run('raidInfo', {}, 14, w => {
      const none = w.gs.raidInfo(Z1);
      w.gs.spawnRaidBoss(Z1);
      w.gs.recordRaidDamage(Z1, 'p2', 77); w.gs.recordRaidDamage(Z1, 'p1', 80);
      const active = w.gs.raidInfo(Z1);
      const st = w.gs.raidStates.get(Z1);
      w.fields.get(Z1).mobs.get(st.mobId).hp = -50;                            // never shows negative HP
      const negative = w.gs.raidInfo(Z1);
      w.fields.get(Z1).mobs.get(st.mobId).state = 'dead';
      return { none, active, negative, dead: w.gs.raidInfo(Z1) };
    });

    // death: payout by rank
    run('deathPaysByRank', {}, 15, w => {
      w.gs.spawnRaidBoss(Z1);
      w.gs.recordRaidDamage(Z1, 'p1', 100); w.gs.recordRaidDamage(Z1, 'p2', 900); w.gs.recordRaidDamage(Z1, 'p4', 400); w.gs.recordRaidDamage(Z1, 'p3', 5000);
      const st = w.gs.raidStates.get(Z1);
      const mob = w.fields.get(Z1).mobs.get(st.mobId);
      const paid: any[] = [];
      w.gs.payRaidReward = (p: any, def: any, bucket: any, rank: number, total: number) => paid.push({ p: p.id, def: def.name, bucket, rank, total });
      w.log.length = 0;
      w.gs.onRaidBossDeath(mob, w.players.get('p2'));
      return { paid, stillThere: w.fields.get(Z1).mobs.has(st.mobId) };
    });
    run('deathNobodyHitIt', {}, 16, w => {
      w.gs.spawnRaidBoss(Z1);
      const st = w.gs.raidStates.get(Z1);
      const mob = w.fields.get(Z1).mobs.get(st.mobId);
      w.log.length = 0;
      w.gs.onRaidBossDeath(mob, null);
    });
    run('deathIgnored', {}, 17, w => {
      w.gs.spawnRaidBoss(Z1);
      const st = w.gs.raidStates.get(Z1);
      const mob = w.fields.get(Z1).mobs.get(st.mobId);
      w.log.length = 0;
      w.gs.onRaidBossDeath({ ...mob, isRaidBoss: false }, null);               // not a raid boss
      w.gs.onRaidBossDeath({ ...mob, fieldZone: 'nowhere' }, null);            // no state for that zone
      return { states: Array.from(w.gs.raidStates.keys()) };
    });
    run('deathZoneFromKiller', {}, 18, w => {
      w.gs.spawnRaidBoss(Z1);
      const st = w.gs.raidStates.get(Z1);
      const mob = { ...w.fields.get(Z1).mobs.get(st.mobId) }; delete mob.fieldZone;
      w.gs.payRaidReward = () => undefined;
      w.log.length = 0;
      w.gs.onRaidBossDeath(mob, w.players.get('p1'));                          // zone comes from the killer
    });

    // the reward roll per rank (random gold / exp / fragments / gear / reforge / card, seeded)
    const def = RAID.buildRaidMobDef(Z1);
    for (let rank = 1; rank <= 8; rank++) {
      for (const cls of ['warrior', 'mage', 'rogue']) {
        run(`reward_rank${rank}_${cls}`, {}, 100 + rank * 7 + cls.length, w => {
          const p = w.players.get(cls === 'warrior' ? 'p1' : cls === 'mage' ? 'p2' : 'p4'); p.characterClass = cls;
          w.gs.payRaidReward(p, def, RAID.raidBucketFor(rank), rank, 8);
          return { bucket: RAID.raidBucketFor(rank).label };
        });
      }
    }
    run('rewardPlayerWithoutSocket', {}, 200, w => w.gs.payRaidReward(w.players.get('p3'), def, RAID.raidBucketFor(1), 1, 1));

    if (process.env.UPDATE_FIXTURES === '1') { fs.writeFileSync(FIXTURE, JSON.stringify(got, null, 2) + '\n', 'utf8'); return; }
    assert.deepEqual(plain(got), JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
  } finally {
    Date.now = realNow;
    await (await import('../accountManager')).default.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
