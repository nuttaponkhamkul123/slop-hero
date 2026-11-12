// Level system (awardExp, passive allocation, refund, respec, stale-build refund): locked to a fixture captured
// BEFORE the methods moved out of GameServer. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemLevel.json');
const NOW = 1700000000000;
const plain = (v: any) => JSON.parse(JSON.stringify(v));

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // the server module imports the accountManager singleton
  const mod: any = await import('../gameServer');
  const T: any = await import('../talents');
  return { dir, GS: mod.default || mod.GameServer, T };
}

test('level methods match the pre-refactor fixture', async () => {
  const { dir, GS, T } = await load();
  const realNow = Date.now;
  Date.now = () => NOW;
  try {
    const got: any = {};
    const nodes: any[] = [...T.BY_ID.values()];

    // a connected path of passive ids for a class, walking out from its start node
    function pathFor(cls: string, n: number): string[] {
      const owned: any = {}; const ids: string[] = [];
      while (ids.length < n) {
        const next = nodes.find(x => !owned[x.id] && T.canAllocate(cls, owned, x.id));
        if (!next) break;
        owned[next.id] = 1; ids.push(next.id);
      }
      return ids;
    }
    // a path that includes a notable or keystone, if one is reachable within `max` steps
    function pathWithBig(cls: string, max = 400): string[] {
      const owned: any = {}; const ids: string[] = [];
      while (ids.length < max) {
        const cand = nodes.filter(x => !owned[x.id] && T.canAllocate(cls, owned, x.id));
        if (!cand.length) break;
        const big = cand.find(x => x.kind === 'notable' || x.kind === 'keystone');
        const next = big || cand[0];
        owned[next.id] = 1; ids.push(next.id);
        if (big) break;
      }
      return ids;
    }

    function run(name: string, method: string, args: any[], heroProps: any = {}, opts: any = {}) {
      const log: any[] = [];
      const socket = { emit: (ev: string, data: any) => log.push(['socket', ev, plain(data)]) };
      const hero: any = {
        id: 'h1', name: 'Hero', zone: 'town', x: 10, y: 10, level: 1, exp: 0, expNext: 100, characterClass: 'mage', isDead: false, gold: 5000,
        hp: 10, mp: 5, maxHp: 120, maxMp: 60, dmg: 8, def: 3, speed: 4, attackRange: 5, skillPoints: 0, skills: {},
        ...structuredClone(heroProps),
      };
      const fake: any = Object.create(GS.prototype);
      Object.assign(fake, {
        players: new Map([['h1', hero]]),
        io: { sockets: { sockets: opts.noSocket ? new Map() : new Map([['h1', socket]]) } },
        emitZone: (...a: any[]) => log.push(['zone', ...plain(a)]),
        sendDirectMessage: (...a: any[]) => log.push(['call', 'sendDirectMessage', ...plain(a)]),
        recalculatePlayerStats: (p: any) => { log.push(['call', 'recalculatePlayerStats', p.id, p.level, p.baseStats ? plain(p.baseStats) : null]); p.maxHp = 100 + p.level * 7; p.maxMp = 50 + p.level * 3; },
      });
      if (typeof fake.initSystems === 'function') fake.initSystems();
      let threw: any = null;
      try { fake[method](...args); } catch (e: any) { threw = String(e && e.message); }
      got[name] = { log, hero: plain(hero), threw };
    }

    // ---- awardExp
    const ax = (name: string, amount: number, hero: any = {}) => run(name, 'awardExp', [hero.__p ?? undefined, amount].slice(1), hero);
    void ax;
    const award = (name: string, amount: number, hero: any = {}) => {
      // awardExp takes the player object itself, so call it through a tiny wrapper method
      const log: any[] = [];
      const p: any = {
        id: 'h1', name: 'Hero', zone: 'town', x: 10, y: 10, level: 1, exp: 0, expNext: 100, hp: 10, mp: 5, maxHp: 120, maxMp: 60, dmg: 8, def: 3, speed: 4, attackRange: 5, skillPoints: 0,
        ...structuredClone(hero),
      };
      const fake: any = Object.create(GS.prototype);
      Object.assign(fake, {
        players: new Map([['h1', p]]), io: { sockets: { sockets: new Map() } },
        emitZone: (...a: any[]) => log.push(['zone', ...plain(a)]),
        sendDirectMessage: (...a: any[]) => log.push(['call', 'sendDirectMessage', ...plain(a)]),
        recalculatePlayerStats: (q: any) => { log.push(['call', 'recalculatePlayerStats', q.level, q.baseStats ? plain(q.baseStats) : null]); q.maxHp = 100 + q.level * 7; q.maxMp = 50 + q.level * 3; },
      });
      if (typeof fake.initSystems === 'function') fake.initSystems();
      let threw: any = null;
      try { fake.awardExp(p, amount); } catch (e: any) { threw = String(e && e.message); }
      got[name] = { log, hero: plain(p), threw };
    };
    award('exp small', 30);
    award('exp exact level', 100);
    award('exp one level with carry', 150);
    award('exp many levels', 5000);
    award('exp huge to cap', 1e12);
    award('exp at cap', 500, { level: 150, exp: 0, expNext: 99999 });
    award('exp just below cap', 1e15, { level: 149, exp: 0, expNext: 10 });
    award('exp in dungeon run (counts)', 20, { dungeonRun: { cleared: false, exp: 5 } });
    award('exp in dungeon run (no exp yet)', 20, { dungeonRun: { cleared: false } });
    award('exp in cleared run (ignored)', 20, { dungeonRun: { cleared: true, exp: 5 } });
    award('exp keeps existing baseStats', 130, { baseStats: { maxHp: 500, maxMp: 300, dmg: 40, def: 20, speed: 4, attackRange: 5 }, skillPoints: 3 });
    award('exp zero', 0);
    award('exp negative', -10);
    award('exp from mid level', 400, { level: 20, exp: 50, expNext: 300 });

    // ---- handleAllocateSkillPoint / handleAllocatePassives
    const mageStart = pathFor('mage', 1)[0];
    const mage5 = pathFor('mage', 5);
    const warrior3 = pathFor('warrior', 3);
    const bigPath = pathWithBig('mage');
    const detached = nodes.find(x => !T.canAllocate('mage', {}, x.id) && x.kind === 'travel')!.id;
    run('allocate one', 'handleAllocateSkillPoint', ['h1', mageStart], { skillPoints: 2 });
    run('allocate one no points', 'handleAllocateSkillPoint', ['h1', mageStart], { skillPoints: 0 });
    run('allocate dead', 'handleAllocatePassives', ['h1', mage5], { skillPoints: 9, isDead: true });
    run('allocate not an array', 'handleAllocatePassives', ['h1', 'p1'], { skillPoints: 9 });
    run('allocate no player', 'handleAllocatePassives', ['zz', mage5]);
    run('allocate path', 'handleAllocatePassives', ['h1', mage5], { skillPoints: 9 });
    run('allocate path, points run out', 'handleAllocatePassives', ['h1', mage5], { skillPoints: 2 });
    run('allocate path with unknown node', 'handleAllocatePassives', ['h1', [mage5[0], 'nope', mage5[1]]], { skillPoints: 9 });
    run('allocate detached node', 'handleAllocatePassives', ['h1', [detached]], { skillPoints: 9 });
    run('allocate wrong class path', 'handleAllocatePassives', ['h1', warrior3], { skillPoints: 9 });
    run('allocate already owned', 'handleAllocatePassives', ['h1', [mage5[0]]], { skillPoints: 9, skills: { [mage5[0]]: 1 } });
    run('allocate continuing from owned', 'handleAllocatePassives', ['h1', [mage5[1], mage5[2]]], { skillPoints: 9, skills: { [mage5[0]]: 1 } });
    run('allocate with a notable', 'handleAllocatePassives', ['h1', bigPath], { skillPoints: 999 });
    run('allocate no skills field', 'handleAllocatePassives', ['h1', mage5], { skillPoints: 9, skills: undefined });
    run('allocate no skillPoints field', 'handleAllocatePassives', ['h1', mage5], { skillPoints: undefined });
    run('allocate no socket', 'handleAllocatePassives', ['h1', mage5], { skillPoints: 9 }, { noSocket: true });
    run('allocate more than 200 ids', 'handleAllocatePassives', ['h1', new Array(300).fill(mageStart)], { skillPoints: 999 });
    run('allocate empty list', 'handleAllocatePassives', ['h1', []], { skillPoints: 9 });

    // ---- handleRefundPassive
    const owned5: any = Object.fromEntries(mage5.map(id => [id, 1]));
    const rf = (name: string, id: any, hero: any = {}, opts: any = {}) => run(name, 'handleRefundPassive', ['h1', id], hero, opts);
    rf('refund dead', mage5[4], { isDead: true, skills: owned5 });
    rf('refund no skills', mage5[4], { skills: undefined });
    rf('refund not owned', 'p999999', { skills: owned5 });
    rf('refund not owned no socket', 'p999999', { skills: owned5 }, { noSocket: true });
    rf('refund a node others depend on', mage5[0], { skills: owned5 });
    rf('refund far end', mage5[4], { skills: owned5, skillPoints: 1 });
    rf('refund far end poor', mage5[4], { skills: owned5, gold: 0 });
    rf('refund far end no gold field', mage5[4], { skills: owned5, gold: undefined });
    rf('refund far end no socket', mage5[4], { skills: owned5, skillPoints: undefined }, { noSocket: true });

    // ---- refundStaleTalents (called directly)
    const stale = (name: string, hero: any) => {
      const p: any = { characterClass: "mage", skillPoints: 1, ...structuredClone(hero) };
      const fake: any = Object.create(GS.prototype);
      if (typeof fake.initSystems === 'function') fake.initSystems();
      let threw: any = null;
      try { fake.refundStaleTalents(p); } catch (e: any) { threw = String(e && e.message); }
      got[name] = { p: plain(p), threw };
    };
    stale('stale null', undefined as any);
    { const fake: any = Object.create(GS.prototype); if (typeof fake.initSystems === 'function') fake.initSystems(); fake.refundStaleTalents(null); fake.refundStaleTalents({}); }
    stale('stale valid build', { skills: owned5 });
    stale('stale broken build', { skills: { [detached]: 1, p999999: 1 } });
    stale('stale broken build twice refunded', { skills: { [detached]: 1 }, talentRefunded: 4, skillPoints: undefined });
    stale('stale no skills', {});
    stale('stale empty skills', { skills: {} });

    // ---- handleResetSkillPoints
    const rs = (name: string, hero: any = {}, opts: any = {}) => run(name, 'handleResetSkillPoints', ['h1'], hero, opts);
    rs('reset dead', { isDead: true, skills: owned5 });
    rs('reset no skills', { skills: undefined });
    rs('reset nothing spent', { skills: {} });
    rs('reset poor', { skills: owned5, gold: 10 });
    rs('reset poor no socket', { skills: owned5, gold: 10 }, { noSocket: true });
    rs('reset ok', { skills: owned5, skillPoints: 1 });
    rs('reset ok no skillPoints field', { skills: owned5, skillPoints: undefined });
    rs('reset cost capped', { skills: Object.fromEntries(pathFor('mage', 40).map(id => [id, 1])), gold: 100000 });
    rs('reset ok no socket', { skills: owned5 }, { noSocket: true });
    rs('reset ranks above one', { skills: { a: 3, b: 2 }, gold: 1000 });

    if (process.env.UPDATE_FIXTURES === '1') {
      fs.writeFileSync(FIXTURE, JSON.stringify(got, null, 2) + '\n', 'utf8');
      return;
    }
    assert.deepEqual(plain(got), JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
  } finally {
    Date.now = realNow;
    await (await import('../accountManager')).default.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
