// Minion system (corpses and the Gravelord's undead): locked to a fixture captured BEFORE the methods moved out of
// GameServer. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemMinions.json');
const NOW = 1700000000000;
const plain = (v: any) => JSON.parse(JSON.stringify(v));

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
  const C: any = await import('../config/constants');
  const make = (props: any = {}) => {
    const fake: any = Object.create(GS.prototype);
    Object.assign(fake, props);
    if (typeof fake.initSystems === 'function') fake.initSystems();
    return fake;
  };
  return { dir, make, C };
}

test('minion system matches the pre-refactor fixture', async () => {
  const { dir, make, C } = await load();
  const realNow = Date.now;
  Date.now = () => NOW;
  try {
    const got: any = {};
    const log: any[] = [];
    const rec = (...a: any[]) => log.push(plain(a));
    const gs = make({ emitZone: rec });

    // corpse keys
    got.keys = [gs.corpseKey('town'), gs.corpseKey('frostfell'), gs.corpseKey('dungeon', 'inst1'), gs.corpseKey('dungeon'), gs.corpseKey('dungeon', null)];

    // corpses: defaults, expiry, the cap, nearest-first taking
    {
      const noMap = make({});
      const none = noMap.takeCorpses('town', null, 0, 0, 10, 3); // no map yet
      gs.addCorpse({ x: 1, y: 1, type: 'wolf', name: 'Wolf' }, 'town', null);                          // defaults for hue / scale
      gs.addCorpse({ x: 2, y: 2, type: 'bear', hue: 120, scale: 1.5, name: 'Bear' }, 'town', null);
      gs.addCorpse({ x: 9, y: 9, type: 'boar', name: 'Boar' }, 'dungeon', 'inst1');
      const snap1 = plain(Array.from(gs.corpses.entries()));
      // time passes: the first two expire
      Date.now = () => NOW + C.GRAVE_CORPSE_MS + 1;
      gs.addCorpse({ x: 3, y: 3, type: 'rat', name: 'Rat' }, 'town', null);
      const snap2 = plain(Array.from(gs.corpses.entries()));
      Date.now = () => NOW;
      // the cap: 45 corpses keep the last 40
      const capGs = make({});
      for (let i = 0; i < 45; i++) capGs.addCorpse({ x: i, y: 0, type: 't' + i, name: 'N' + i }, 'town', null);
      const capped = capGs.corpses.get('town');
      // taking: nearest first, up to n, within r, removed from the ground
      const takeGs = make({});
      for (const [x, y, t] of [[1, 0, 'a'], [5, 0, 'b'], [2, 0, 'c'], [20, 0, 'far'], [3, 0, 'd']] as any[]) takeGs.addCorpse({ x, y, type: t, name: t }, 'town', null);
      const took = takeGs.takeCorpses('town', null, 0, 0, 6, 3).map((c: any) => c.type);
      const left = takeGs.corpses.get('town').map((c: any) => c.type);
      const wrongZone = takeGs.takeCorpses('frostfell', null, 0, 0, 6, 3);
      got.corpses = { none, snap1, snap2, capLength: capped.length, capFirst: capped[0].type, capLast: capped[capped.length - 1].type, took, left, wrongZone };
    }

    // raising minions: fields, cap, expiry of old ones, ids count up (one server for all of them)
    {
      const skill = { dmg: 10, dmgMult: 15, dur: 20, minion: 0.5 };
      const hero: any = { id: 'h1', zone: 'dungeon', dungeonInstanceId: 'inst1', x: 5, y: 5 };
      log.length = 0;
      gs.raiseMinion(hero, { x: 1, y: 2, type: 'wolf', hue: 90, scale: 2, name: 'Wolf' }, skill);
      gs.raiseMinion(hero, { x: 3, y: 4, type: 'ghoul', thrall: true }, { dur: 5, minion: 0.3 });         // no dmg: level factor 1; thrall name; scale default
      const first2 = plain(hero.minions);
      for (let i = 0; i < 6; i++) gs.raiseMinion(hero, { x: i, y: i, type: 't' + i, name: 'M' + i }, skill); // exceeds MINION_MAX: the oldest crumble
      const afterCap = hero.minions.map((m: any) => m.id + ':' + m.type);
      const crumbled = plain(log);
      // an expired minion is filtered out when raising
      const hero2: any = { id: 'h2', zone: 'town', x: 0, y: 0, minions: [{ id: 'old', until: NOW - 1, zone: 'town', x: 0, y: 0 }, { id: 'live', until: NOW + 1000, zone: 'town', x: 0, y: 0 }] };
      gs.raiseMinion(hero2, { x: 0, y: 0, type: 'z' }, skill);
      got.raise = { first2, afterCap, crumbled, hero2: hero2.minions.map((m: any) => m.id), max: C.MINION_MAX };
    }

    // crumble / dismiss
    {
      log.length = 0;
      gs.crumbleMinion({}, null);
      const noop = plain(log);
      const m1: any = { id: 'a', zone: 'town', x: 1, y: 2, instanceId: null }, m2: any = { id: 'b', zone: 'dungeon', x: 3, y: 4, instanceId: 'i' };
      const hero: any = { id: 'h', minions: [m1, m2] };
      gs.dismissMinions(hero);
      const after = plain(hero.minions);
      const hero3: any = { id: 'h3' };
      gs.dismissMinions(hero3);
      got.crumble = { noop, log: plain(log), after, hero3Minions: plain(hero3.minions) };
    }

    // the per-tick AI
    {
      const scenario = (name: string, heroProps: any, mobsList: any[], minions: any[], opts: any = {}) => {
        const events: any[] = [], hits: any[] = [];
        const g = make({
          emitZone: (...a: any[]) => events.push(plain(a)),
          getMobsMap: () => new Map(mobsList.map((m: any) => [m.id, m])),
          isColliding: opts.isColliding || (() => false),
          applyDamageToMob: (p: any, m: any, dmg: number, crit: boolean, echo: boolean) => hits.push({ mob: m.id, dmg, crit, echo }),
        });
        const hero: any = { id: 'h', zone: 'town', x: 10, y: 10, dmg: 100, minions, ...heroProps };
        seeded(5, () => { for (let i = 0; i < (opts.ticks || 1); i++) g.tickMinions(hero, opts.dt || 0.04); });
        got.tick = got.tick || {};
        got.tick[name] = { minions: plain(hero.minions), hits: plain(hits), events: plain(events), mobs: plain(mobsList.map((m: any) => ({ id: m.id, x: m.x, y: m.y }))) };
      };
      const minion = (over: any = {}) => ({ id: 'm1', zone: 'town', instanceId: null, x: 10, y: 10, until: NOW + 60000, mult: 0.5, nextAtk: NOW - 1, atkAt: 0, targetId: null, facing: 'S', ...over });
      const mob = (over: any = {}) => ({ id: 'o1', x: 14, y: 10, hp: 50, state: 'idle', ...over });
      scenario('expiredAndWrongPlace', {}, [], [minion({ id: 'e', until: NOW }), minion({ id: 'z', zone: 'dungeon' }), minion({ id: 'i', instanceId: 'x' }), minion({ id: 'ok' })]);
      scenario('walksToPrey', {}, [mob()], [minion()]);
      scenario('strikesInReach', {}, [mob({ x: 10.8 })], [minion()]);
      scenario('picksNearest', {}, [mob({ id: 'far', x: 16 }), mob({ id: 'near', x: 13 })], [minion()]);
      scenario('ignoresOutOfLeash', {}, [mob({ x: 40 })], [minion()]);
      scenario('ignoresDeadAndDummies', {}, [mob({ id: 'd', state: 'dead' }), mob({ id: 'z', hp: 0 }), mob({ id: 'y', isDummy: true })], [minion()]);
      scenario('keepsCurrentTarget', {}, [mob({ id: 'a', x: 12 }), mob({ id: 'b', x: 11 })], [minion({ targetId: 'a' })]);
      scenario('dropsTargetBeyondLeash', {}, [mob({ id: 'a', x: 40 }), mob({ id: 'b', x: 11 })], [minion({ targetId: 'a' })]);
      scenario('followsLord', {}, [], [minion({ x: 14, y: 10 }), minion({ id: 'm2', x: 3, y: 3 }), minion({ id: 'm3' })]);
      scenario('hurriesWhenFarBehind', {}, [], [minion({ x: 2, y: 10 })]);
      scenario('rageBuff', { minionRage: { until: NOW + 5000, aspd: 0.5, dmg: 0.4, crit: 0.5, critMult: 2 } }, [mob({ x: 10.8 })], [minion()], { ticks: 3 });
      scenario('rageExpired', { minionRage: { until: NOW - 1, aspd: 0.5, dmg: 0.4, crit: 1, critMult: 2 } }, [mob({ x: 10.8 })], [minion()]);
      scenario('attackCooldown', {}, [mob({ x: 10.8 })], [minion({ nextAtk: NOW + 500 })]);
      scenario('slidesAlongWalls', {}, [mob()], [minion()], { isColliding: (x: number, y: number) => x > 10.1 && y === 10 });
      scenario('noMinions', {}, [mob()], []);
    }

    if (process.env.UPDATE_FIXTURES === '1') { fs.writeFileSync(FIXTURE, JSON.stringify(got, null, 2) + '\n', 'utf8'); return; }
    assert.deepEqual(plain(got), JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
  } finally {
    Date.now = realNow;
    await (await import('../accountManager')).default.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
