// StatusEffect system (applyStatusEffect, smokeMissChance, applyTalentProcs): locked to a fixture captured BEFORE
// the methods moved out of GameServer. The server is built without its constructor (Object.create), so only
// the code under test runs. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemStatusEffects.json');
const NOW = 1700000000000;
const plain = (v: any) => JSON.parse(JSON.stringify(v));

function seeded<T>(seed: number, fn: () => T): T {
  const realRandom = Math.random, realNow = Date.now;
  let s = seed >>> 0;
  Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  Date.now = () => NOW;
  try { return fn(); } finally { Math.random = realRandom; Date.now = realNow; }
}

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // the server module imports the accountManager singleton
  const mod: any = await import('../gameServer');
  const GS = mod.default || mod.GameServer;
  const talents: any = await import('../talents');
  // a server without running its constructor; systems are wired when GameServer has initSystems()
  const make = (props: any = {}) => {
    const fake: any = Object.create(GS.prototype);
    Object.assign(fake, props);
    if (typeof fake.initSystems === 'function') fake.initSystems();
    return fake;
  };
  return { dir, make, TALENT_PROCS: talents.TALENT_PROCS };
}

test('status effect system matches the pre-refactor fixture', async () => {
  const { dir, make } = await load();
  try {
    const got: any = {};

    // applyStatusEffect
    {
      const emitted: any[] = [];
      const gs = make({ emitZone: (...a: any[]) => emitted.push(a) });
      const hero: any = { id: 'h', zone: 'town', x: 4, y: 5 };
      gs.applyStatusEffect(hero, 'poison', 3, 10);                     // first: creates the list and the effect
      gs.applyStatusEffect(hero, 'poison', 5, 4);                      // again: longer wins, value keeps the max
      gs.applyStatusEffect(hero, 'poison', 1, 20);                     // shorter: duration keeps, value rises
      gs.applyStatusEffect(hero, 'burn', 2, 6);
      gs.applyStatusEffect(hero, 'chill', 2.5, 0.45);
      gs.applyStatusEffect({ id: 'dead', isDead: true, zone: 'town', x: 0, y: 0 }, 'poison', 3, 1);
      gs.applyStatusEffect(null, 'poison', 3, 1);
      got.applyStatusEffect = { hero: plain(hero), emitted: plain(emitted) };
    }

    // smokeMissChance
    {
      const hero: any = { zone: 'dungeon', dungeonInstanceId: 'inst1', x: 10, y: 10 };
      const clouds = () => [
        { zone: 'dungeon', instanceId: 'inst1', x: 10, y: 10, r: 2, miss: 0.4, until: NOW + 5000 },
        { zone: 'dungeon', instanceId: 'inst1', x: 11, y: 10, r: 2, miss: 0.6, until: NOW + 5000 },   // overlaps: the bigger miss wins
        { zone: 'dungeon', instanceId: 'inst1', x: 10, y: 10, r: 2, miss: 0.9, until: NOW - 1 },      // expired: dropped
        { zone: 'dungeon', instanceId: 'other', x: 10, y: 10, r: 2, miss: 0.95, until: NOW + 5000 },  // another instance
        { zone: 'town', instanceId: 'inst1', x: 10, y: 10, r: 2, miss: 0.95, until: NOW + 5000 },     // another zone
        { zone: 'dungeon', instanceId: 'inst1', x: 30, y: 30, r: 2, miss: 0.95, until: NOW + 5000 },  // too far
      ];
      const gs = make({ smokeClouds: clouds() });
      const res: any = {};
      seeded(1, () => {
        res.miss = gs.smokeMissChance(hero);
        res.remaining = gs.smokeClouds.length;
        const gs2 = make({ smokeClouds: [] });
        res.empty = gs2.smokeMissChance(hero);
        const gs3 = make({ smokeClouds: clouds() });
        res.noInstance = gs3.smokeMissChance({ zone: 'dungeon', x: 10, y: 10 }); // hero outside any instance
        const gs4 = make({ smokeClouds: clouds() });
        res.edge = gs4.smokeMissChance({ zone: 'dungeon', dungeonInstanceId: 'inst1', x: 12, y: 10 }); // exactly at the radius of two clouds
      });
      got.smokeMissChance = res;
    }

    // applyTalentProcs
    {
      const cases: Record<string, any> = {
        noProcs: undefined,
        manaLeech: { manaLeech: 0.1 },
        burn: { burnPower: 0.5 },
        poisonFirst: { poisonPower: 0.4 },
        chillSure: { chillChance: 1 },
        echoSure: { echoChance: 1 },
        everything: { manaLeech: 0.05, burnPower: 0.3, poisonPower: 0.2, chillChance: 1, echoChance: 1 },
        neverProcs: { chillChance: 0, echoChance: 0 },
      };
      got.applyTalentProcs = {};
      for (const [k, tp] of Object.entries(cases)) {
        const calls: any[] = [];
        const gs = make({ applyDamageToMob: (...a: any[]) => calls.push(a.slice(2)) });
        const player: any = { dmg: 50, mp: 10, maxMp: 100, talentProcs: tp };
        const mob: any = { poisonTimer: 1, poisonStacks: 2, burnTimer: 0 };
        seeded(7, () => gs.applyTalentProcs(player, mob, 80, 30));
        got.applyTalentProcs[k] = { player: plain(player), mob: plain(mob), echoCalls: plain(calls) };
      }
      // poison stacks: an expired poison restarts at 1, a running one grows up to the cap
      const stack: any = { poisonTimer: 0, poisonStacks: 5 };
      const gsP = make({});
      seeded(8, () => gsP.applyTalentProcs({ dmg: 10, mp: 0, maxMp: 1, talentProcs: { poisonPower: 1 } }, stack, 1, 1));
      const run: any = { poisonTimer: 3, poisonStacks: 99 };
      seeded(9, () => gsP.applyTalentProcs({ dmg: 10, mp: 0, maxMp: 1, talentProcs: { poisonPower: 1 } }, run, 1, 1));
      got.poisonStacks = { expired: plain(stack), cappedRunning: plain(run) };
    }

    if (process.env.UPDATE_FIXTURES === '1') { fs.writeFileSync(FIXTURE, JSON.stringify(got, null, 2) + '\n', 'utf8'); return; }
    assert.deepEqual(plain(got), JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
  } finally {
    await (await import('../accountManager')).default.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
