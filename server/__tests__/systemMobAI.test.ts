// Mob AI system (updateMobsList: respawn, status ticks, aggro, wandering, chasing, returning; mobStrikePlayer and
// landMobDamage: how a monster blow reaches a hero): locked to a fixture captured BEFORE the methods moved out of
// GameServer. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemMobAI.json');
const NOW = 1700000000000;
const plain = (v: any): any => v === undefined ? null : JSON.parse(JSON.stringify(v, (_k, x) => (x instanceof Map ? { __map: Array.from(x.entries()) } : x instanceof Set ? { __set: Array.from(x.values()) } : x === Infinity ? '__Infinity__' : typeof x === 'number' && Number.isNaN(x) ? '__NaN__' : x)));
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

test('mob AI methods match the pre-refactor fixture', async () => {
  const { dir, GS } = await load();
  const realNow = Date.now, realRandom = Math.random;
  let now = NOW;
  Date.now = () => now;
  try {
    const got: any = {};
    const hero = (extra: any = {}) => ({
      id: 'h1', name: 'Hero', zone: 'frostfell', x: 10, y: 10, level: 40, isDead: false, hp: 300, maxHp: 300, def: 40, dmg: 80, characterClass: 'warrior',
      inventory: { items: [] }, equipment: {}, statusEffects: [], ...extra,
    });
    const mob = (id: string, x: number, y: number, extra: any = {}) => ({
      id, name: 'Ghoul ' + id, x, y, spawnX: x, spawnY: y, hp: 400, maxHp: 400, level: 40, def: 10, dmg: 60, speed: 3, state: 'idle', attackCooldown: 0, element: 'neutral',
      nextWanderTime: 0, targetPlayerId: null, ...extra,
    });

    function world(name: string, opts: any = {}) {
      Math.random = mulberry32(hashName(name)); now = NOW;
      const log: any[] = [];
      const players = new Map<string, any>(); for (const p of opts.players || []) if (p) players.set(p.id, p);
      const mobsMap = new Map<string, any>(); for (const m of opts.mobs || []) mobsMap.set(m.id, m);
      const fake: any = Object.create(GS.prototype);
      Object.assign(fake, {
        players, io: { sockets: { sockets: new Map() } }, smokeClouds: opts.smoke || [], dungeonInstances: new Map(opts.instances || []), fields: new Map([['frostfell', {}]]),
        emitZone: (...a: any[]) => log.push(['zone', ...plain(a)]),
        broadcastSystemMessage: (m: string) => log.push(['call', 'broadcastSystemMessage', m]),
        handleMobDeath: (m: any, k: any) => { log.push(['call', 'handleMobDeath', m.id, k && k.id]); m.state = 'dead'; m.hp = 0; },
        applyDamageToMob: (p: any, m: any, d: number, ...r: any[]) => { log.push(['call', 'applyDamageToMob', p.id, m.id, d, ...r]); },
        bossMech: { update: (m: any, z: string, dt: number, i: any) => { log.push(['call', 'bossMech.update', m.id, z, dt, i]); return !!opts.bossBusy; }, reset: (m: any) => log.push(['call', 'bossMech.reset', m.id]) },
        updateRiftMob: (m: any, inst: any, dt: number) => log.push(['call', 'updateRiftMob', m.id, inst.id, dt]),
        isColliding: opts.colliding || ((x: number, y: number) => x > 30 || y > 30 || x < 0 || y < 0),
        recalculatePlayerStats: (): void => undefined, getMobsMap: () => mobsMap,
        ...(opts.props || {}),
      });
      if (typeof fake.initSystems === 'function') fake.initSystems();
      return { fake, log, players, mobsMap };
    }
    const rec = (name: string, w: any, extra: any = {}) => { got[name] = { log: plain(w.log), players: plain(Object.fromEntries(w.players)), mobs: plain(Object.fromEntries(w.mobsMap)), ...extra }; };

    // ---- updateMobsList
    const tick = (name: string, mobs: any[], players: any[], opts: any = {}) => {
      const w = world(name, { mobs, players, ...opts }); const ticks = opts.ticks || 1; const dt = opts.dt ?? 0.1; let threw: any = null;
      try { for (let i = 0; i < ticks; i++) { w.fake.updateMobsList(w.mobsMap, opts.zone || 'frostfell', dt, opts.instanceId ?? null); now += Math.round(dt * 1000); } } catch (e: any) { threw = String(e && e.message); }
      rec(name, w, { threw });
    };
    // respawn
    tick('dead field mob waiting', [mob('a', 5, 5, { state: 'dead', hp: 0, respawnTimer: 5 })], []);
    tick('dead field mob respawns', [mob('a', 8, 8, { state: 'dead', hp: 0, respawnTimer: 0.05, x: 1, y: 1, spawnX: 8, spawnY: 8, targetPlayerId: 'zz' })], []);
    tick('dead dungeon mob never respawns', [mob('a', 5, 5, { state: 'dead', hp: 0, respawnTimer: 0 })], [], { zone: 'dungeon' });
    tick('dead dungeon-id mob never respawns', [mob('dungeon_a', 5, 5, { state: 'dead', hp: 0, respawnTimer: 0 })], []);
    // rising
    tick('rising mob', [mob('a', 5, 5, { spawnUntil: NOW + 500, state: 'chase' })], [hero()]);
    tick('risen mob', [mob('a', 5, 5, { spawnUntil: NOW - 1 })], [hero({ x: 5.5, y: 5 })]);
    // status ticks
    tick('chill decays', [mob('a', 5, 5, { chillTimer: 1 })], []);
    tick('burn ticks', [mob('a', 5, 5, { burnTimer: 2, burnDmg: 20 })], [], { ticks: 15 });
    tick('burn default damage', [mob('a', 5, 5, { burnTimer: 2 })], [], { ticks: 8 });
    tick('burn ends', [mob('a', 5, 5, { burnTimer: 0.05, burnDmg: 20, burnTickTimer: 5 })], []);
    tick('burn kills, owner credited', [mob('a', 5, 5, { burnTimer: 2, burnDmg: 20, hp: 5, lastHitBy: 'h1' })], [hero()]);
    tick('burn kills, owner dead', [mob('a', 5, 5, { burnTimer: 2, burnDmg: 20, hp: 5, lastHitBy: 'h1' })], [hero({ isDead: true })]);
    tick('burn kills, owner elsewhere', [mob('a', 5, 5, { burnTimer: 2, burnDmg: 20, hp: 5, lastHitBy: 'h1' })], [hero({ zone: 'town' })]);
    tick('burn kills, nobody', [mob('a', 5, 5, { burnTimer: 2, burnDmg: 20, hp: 5 })], []);
    tick('burn kills in an instance, owner in it', [mob('a', 5, 5, { burnTimer: 2, burnDmg: 20, hp: 5, lastHitBy: 'h1' })], [hero({ zone: 'dungeon', dungeonInstanceId: 'i1' })], { zone: 'dungeon', instanceId: 'i1' });
    tick('burn kills in an instance, owner in another', [mob('a', 5, 5, { burnTimer: 2, burnDmg: 20, hp: 5, lastHitBy: 'h1' })], [hero({ zone: 'dungeon', dungeonInstanceId: 'i2' })], { zone: 'dungeon', instanceId: 'i1' });
    tick('poison ticks with stacks', [mob('a', 5, 5, { poisonTimer: 3, poisonDmg: 12, poisonStacks: 4 })], [], { ticks: 20 });
    tick('poison single stack', [mob('a', 5, 5, { poisonTimer: 3, poisonStacks: 1 })], [], { ticks: 10 });
    tick('poison ends and clears', [mob('a', 5, 5, { poisonTimer: 0.05, poisonDmg: 12, poisonStacks: 4, poisonTickTimer: 9 })], []);
    tick('poison kills', [mob('a', 5, 5, { poisonTimer: 3, poisonDmg: 12, hp: 4, lastHitBy: 'h1' })], [hero()]);
    tick('misc timers decay', [mob('a', 5, 5, { shadowMarkTimer: 1, staticCharge: 1, conductTimer: 0.05, conduct: 3, scorchTimer: 0.05, scorchStacks: 2, frostTimer: 0.05, frostStacks: 2 })], []);
    tick('misc timers still running', [mob('a', 5, 5, { conductTimer: 2, conduct: 3, scorchTimer: 2, scorchStacks: 2, frostTimer: 2, frostStacks: 2 })], []);
    tick('attack cooldown decays', [mob('a', 5, 5, { attackCooldown: 0.5 })], []);
    // bosses and freezing
    tick('boss mechanic is busy', [mob('a', 5, 5, { mechanics: 'boss', state: 'chase', targetPlayerId: 'h1' })], [hero({ x: 5.5, y: 5 })], { bossBusy: true });
    tick('boss mechanic idle falls through', [mob('a', 5, 5, { mechanics: 'boss' })], [hero({ x: 15, y: 5 })]);
    tick('frozen mob', [mob('a', 5, 5, { frozenTimer: 1, state: 'chase', targetPlayerId: 'h1' })], [hero({ x: 5.5, y: 5 })]);
    tick('freeze ends', [mob('a', 5, 5, { frozenTimer: 0.05 })], []);
    tick('rift mob in a rift', [mob('a', 5, 5, { riftMob: true })], [], { zone: 'dungeon', instanceId: 'r1', instances: [['r1', { id: 'r1', rift: { gateTurn: 0 } }]] });
    tick('rift mob without a rift', [mob('a', 5, 5, { riftMob: true })], [], { zone: 'dungeon', instanceId: 'r1', instances: [['r1', { id: 'r1' }]] });
    tick('rift mob without an instance', [mob('a', 5, 5, { riftMob: true })], []);
    // idle: aggro and wander
    tick('idle notices a hero', [mob('a', 5, 5)], [hero({ x: 8, y: 5 })]);
    tick('idle does not notice far hero', [mob('a', 5, 5)], [hero({ x: 11, y: 5 })]);
    tick('idle picks the closest hero', [mob('a', 5, 5)], [hero({ x: 8, y: 5 }), hero({ id: 'h2', x: 6.5, y: 5 })]);
    tick('idle ignores dead and other-zone heroes', [mob('a', 5, 5)], [hero({ x: 6, y: 5, isDead: true }), hero({ id: 'h2', x: 6, y: 5, zone: 'town' })]);
    tick('idle boss sees farther', [mob('a', 5, 5, { mechanics: 'boss' })], [hero({ x: 18, y: 5 })]);
    tick('idle in an instance ignores other instances', [mob('a', 5, 5)], [hero({ x: 6, y: 5, zone: 'dungeon', dungeonInstanceId: 'i2' })], { zone: 'dungeon', instanceId: 'i1' });
    tick('idle in an instance notices its own', [mob('a', 5, 5)], [hero({ x: 6, y: 5, zone: 'dungeon', dungeonInstanceId: 'i1' })], { zone: 'dungeon', instanceId: 'i1' });
    for (let s = 0; s < 4; s++) tick(`idle wanders ${s}`, [mob('a', 5, 5, { nextWanderTime: NOW - 1 })], [], { ticks: 25 });
    tick('idle wander blocked by a wall', [mob('a', 5, 5, { wanderTarget: { x: 7, y: 5 } })], [], { ticks: 5, colliding: () => true });
    tick('idle wander arrives', [mob('a', 5, 5, { wanderTarget: { x: 5.1, y: 5 }, nextWanderTime: NOW + 99999 })], []);
    tick('idle keeps wandering to its target', [mob('a', 5, 5, { wanderTarget: { x: 8, y: 5 }, nextWanderTime: NOW + 99999 })], [], { ticks: 10 });
    // chase
    tick('chase target gone', [mob('a', 5, 5, { state: 'chase', targetPlayerId: 'zz' })], []);
    tick('chase target dead', [mob('a', 5, 5, { state: 'chase', targetPlayerId: 'h1' })], [hero({ isDead: true })]);
    tick('chase target left the zone', [mob('a', 5, 5, { state: 'chase', targetPlayerId: 'h1' })], [hero({ zone: 'town' })]);
    tick('chase gives up: too far from target', [mob('a', 5, 5, { state: 'chase', targetPlayerId: 'h1' })], [hero({ x: 20, y: 5 })]);
    tick('chase gives up: too far from home', [mob('a', 25, 5, { state: 'chase', targetPlayerId: 'h1', spawnX: 5, spawnY: 5 })], [hero({ x: 26, y: 5 })]);
    tick('boss chases much farther', [mob('a', 25, 5, { state: 'chase', targetPlayerId: 'h1', spawnX: 5, spawnY: 5, mechanics: 'boss' })], [hero({ x: 40, y: 5 })]);
    tick('chase closes in', [mob('a', 5, 5, { state: 'chase', targetPlayerId: 'h1' })], [hero({ x: 9, y: 5 })], { ticks: 20 });
    tick('chase commander is faster', [mob('a', 5, 5, { state: 'chase', targetPlayerId: 'h1', hasCommanderBuff: true })], [hero({ x: 9, y: 5 })], { ticks: 10 });
    tick('chase chilled is slower', [mob('a', 5, 5, { state: 'chase', targetPlayerId: 'h1', chillTimer: 5 })], [hero({ x: 9, y: 5 })], { ticks: 10 });
    tick('chase slides along a wall in x', [mob('a', 5, 5, { state: 'chase', targetPlayerId: 'h1' })], [hero({ x: 9, y: 8 })], { ticks: 5, colliding: (x: number, y: number) => y > 5.2 && y < 20 && x > 5.2 });
    tick('chase slides along a wall in y', [mob('a', 5, 5, { state: 'chase', targetPlayerId: 'h1' })], [hero({ x: 9, y: 8 })], { ticks: 5, colliding: (x: number, y: number) => x > 5.2 && y < 5.2 });
    tick('chase fully blocked', [mob('a', 5, 5, { state: 'chase', targetPlayerId: 'h1' })], [hero({ x: 9, y: 8 })], { ticks: 3, colliding: () => true });
    for (let s = 0; s < 4; s++) tick(`chase strikes ${s}`, [mob('a', 9.5, 10, { state: 'chase', targetPlayerId: 'h1', attackCooldown: 0 })], [hero()], { ticks: 30 });
    tick('chase waiting on cooldown', [mob('a', 9.5, 10, { state: 'chase', targetPlayerId: 'h1', attackCooldown: 5 })], [hero()]);
    tick('chase hit lockout delays the strike', [mob('a', 9.5, 10, { state: 'chase', targetPlayerId: 'h1' })], [hero({ nextMobHitAt: NOW + 5000 })]);
    tick('chase boss shorter lockout', [mob('a', 9.5, 10, { state: 'chase', targetPlayerId: 'h1', isBoss: true })], [hero()]);
    tick('pack of three on one hero', [mob('a', 9.5, 10, { state: 'chase', targetPlayerId: 'h1' }), mob('b', 10.5, 10, { state: 'chase', targetPlayerId: 'h1' }), mob('c', 10, 9.5, { state: 'chase', targetPlayerId: 'h1' })], [hero()], { ticks: 30 });
    // return
    tick('return walks home and heals', [mob('a', 10, 5, { state: 'return', spawnX: 5, spawnY: 5, hp: 100 })], [], { ticks: 15 });
    tick('return arrives', [mob('a', 5.1, 5, { state: 'return', spawnX: 5, spawnY: 5, hp: 100 })], []);
    tick('return arrives, boss resets', [mob('a', 5.1, 5, { state: 'return', spawnX: 5, spawnY: 5, hp: 100, mechanics: 'boss' })], []);

    // ---- mobStrikePlayer
    const strike = (name: string, m: any, p: any, opts: any = {}, extra: any[] = []) => {
      const w = world(name, { mobs: [m], players: [p, ...extra], ...opts }); let threw: any = null;
      try { w.fake.mobStrikePlayer(m, p, 'frostfell', opts.strikeOpts); } catch (e: any) { threw = String(e && e.message); }
      rec(name, w, { threw });
    };
    strike('strike god mode', mob('a', 10, 10), hero({ godMode: true }));
    strike('strike mechanic on an airborne hero', mob('a', 10, 10), hero({ airborneUntil: NOW + 1000 }), { strikeOpts: { mechanic: true } });
    strike('strike mechanic lands', mob('a', 10, 10), hero(), { strikeOpts: { mechanic: true, mult: 2 } });
    strike('strike mechanic default mult', mob('a', 10, 10), hero(), { strikeOpts: { mechanic: true } });
    strike('strike mechanic mob without dmg', mob('a', 10, 10, { dmg: undefined }), hero(), { strikeOpts: { mechanic: true } });
    strike('strike stealth', mob('a', 10, 10), hero({ smokeScreenTimer: 2 }));
    strike('strike airborne', mob('a', 10, 10), hero({ airborneUntil: NOW + 1000 }));
    strike('strike riposte', mob('a', 10, 10), hero({ parry: { until: NOW + 1000, riposte: 1.5 } }));
    strike('strike riposte expired', mob('a', 10, 10), hero({ parry: { until: NOW - 1, riposte: 1.5 } }));
    for (let s = 0; s < 10; s++) strike(`strike dodge roll ${s}`, mob('a', 10, 10), hero({ dodgeChance: 0.5 }));
    for (let s = 0; s < 6; s++) strike(`strike in smoke ${s}`, mob('a', 10, 10), hero(), { smoke: [{ zone: 'frostfell', instanceId: null, x: 10, y: 10, r: 4, miss: 0.5, until: NOW + 5000 }] });
    strike('strike commander', mob('a', 10, 10, { hasCommanderBuff: true }), hero());
    strike('strike plain', mob('a', 10, 10), hero());

    // ---- landMobDamage
    const land = (name: string, m: any, p: any, dmg: number, share: number, mech: boolean, extra: any[] = [], opts: any = {}) => {
      const w = world(name, { mobs: [m], players: [p, ...extra], ...opts }); let threw: any = null;
      try { w.fake.landMobDamage(m, p, 'frostfell', dmg, share, mech); } catch (e: any) { threw = String(e && e.message); }
      rec(name, w, { threw });
    };
    land('land plain', mob('a', 10, 10), hero(), 100, 0.5, false);
    land('land armor share', mob('a', 10, 10), hero({ def: 100 }), 100, 0.25, true);
    land('land armor beats damage', mob('a', 10, 10), hero({ def: 9999 }), 100, 0.5, false);
    land('land element resisted', mob('a', 10, 10, { element: 'fire' }), hero({ elementResist: { fire: 0.5 } }), 100, 0.5, false);
    land('land element weak', mob('a', 10, 10, { element: 'fire' }), hero({ elementResist: { fire: -0.5 } }), 100, 0.5, false);
    for (const gap of [4, 5, 10, 40]) land(`land crushing gap ${gap}`, mob('a', 10, 10, { level: 40 + gap }), hero(), 100, 0.5, false);
    land('land crushing ignored (noLevelGap)', mob('a', 10, 10, { level: 99, noLevelGap: true }), hero(), 100, 0.5, false);
    land('land iron fortress', mob('a', 10, 10), hero({ ironFortressTimer: 3 }), 100, 0.5, false);
    land('land thorns', mob('a', 10, 10), hero({ thorns: 17 }), 100, 0.5, false);
    land('land rune thorns', mob('a', 10, 10), hero({ armorRunes: { thorns: 2 } }), 100, 0.5, false);
    land('land thorns skipped by mechanics', mob('a', 10, 10), hero({ thorns: 17, ironFortressTimer: 3 }), 100, 0.5, true);
    land('land shield absorbs', mob('a', 10, 10), hero({ shieldHp: 60 }), 100, 0.5, false);
    land('land energy shield absorbs', mob('a', 10, 10), hero({ es: 30, esMax: 100 }), 100, 0.5, false);
    land('land passive card transformed', mob('a', 10, 10), hero({ spTransformed: true, equipment: { sp: { cardId: 'sp_sentinel' } } }), 100, 0.5, false);
    land('land passive card transformed (reflect)', mob('a', 10, 10), hero({ spTransformed: true, equipment: { sp: { cardId: 'sp_frost_templar' } } }), 100, 0.5, false);
    land('land second wind', mob('a', 10, 10), hero({ hp: 130, set4: { wayfarer: { hpThreshold: 0.5, cooldown: 30, shieldPct: 0.2, hasteSec: 3 } } }), 100, 0.5, false);
    land('land undying rage', mob('a', 10, 10), hero({ hp: 10, undyingTimer: 3 }), 5000, 0.5, false);
    land('land phoenix rebirth', mob('a', 10, 10), hero({ hp: 10, spTransformed: true, equipment: { sp: { cardId: 'sp_phoenix_oath' } } }), 5000, 0.5, false);
    land('land venomous', mob('a', 10, 10, { buffs: ['venomous'] }), hero(), 100, 0.5, false);
    land('land frostbite and ignited', mob('a', 10, 10, { buffs: ['frostbite', 'ignited'] }), hero(), 100, 0.5, false);
    land('land unknown buff', mob('a', 10, 10, { buffs: ['fortified'] }), hero(), 100, 0.5, false);
    land('land kills hero, mob returns', mob('a', 10, 10), hero({ hp: 5, dungeonRun: { deaths: 1 } }), 500, 0.5, false);
    land('land kills hero, no run', mob('a', 10, 10), hero({ hp: 5 }), 500, 0.5, false);
    land('land boss turns on the next hero', mob('a', 10, 10, { isBoss: true }), hero({ hp: 5, dungeonInstanceId: 'i1' }), 500, 0.5, false, [hero({ id: 'h2', x: 12, y: 10, dungeonInstanceId: 'i1' }), hero({ id: 'h3', x: 12, y: 10, dungeonInstanceId: 'i2' }), hero({ id: 'h4', x: 90, y: 90, dungeonInstanceId: 'i1' })]);
    land('land boss with nobody left', mob('a', 10, 10, { isBoss: true }), hero({ hp: 5 }), 500, 0.5, false);
    land('land mechanic kill has no attack fx', mob('a', 10, 10), hero({ hp: 5 }), 500, 0.5, true);

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
