// Passive system (SP card passives, signature charge, bloodlust, rebirth, damage absorption, HUD buffs): locked to a
// fixture captured BEFORE the methods moved out of GameServer. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemPassive.json');
const NOW = 1700000000000;
const plain = (v: any): any => v === undefined ? null : JSON.parse(JSON.stringify(v, (_k, x) => (x instanceof Map ? { __map: Array.from(x.entries()) } : x instanceof Set ? { __set: Array.from(x.values()) } : x === Infinity ? '__Infinity__' : x)));

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // the server module imports the accountManager singleton
  const mod: any = await import('../gameServer');
  return { dir, GS: mod.default || mod.GameServer, SP: await import('../spCards') };
}

test('passive methods match the pre-refactor fixture', async () => {
  const { dir, GS, SP } = await load();
  const realNow = Date.now, realRandom = Math.random, realSetTimeout = global.setTimeout;
  let now = NOW;
  Date.now = () => now;
  try {
    const got: any = {};
    const timers: any[] = [];
    (global as any).setTimeout = (fn: any, ms: number) => { timers.push({ fn, ms }); return 0 as any; };
    const cards: any[] = (Object.values(SP.CARD_BY_ID) as any[]).filter(c => c.passive);

    const mob = (extra: any = {}) => ({ id: 'm1', x: 6, y: 6, hp: 100, maxHp: 100, state: 'idle', ...extra });
    const hero = (cardId: string | null, extra: any = {}) => ({
      id: 'h1', name: 'Hero', zone: 'frostfell', x: 5, y: 5, dmg: 50, hp: 80, maxHp: 200, mp: 10, maxMp: 100, level: 40, isDead: false,
      spTransformed: !!cardId, equipment: cardId ? { sp: { cardId } } : {}, skillCooldowns: { slot1: 5, slot2: 0, dash: 2 }, ...extra,
    });
    function world(mobs: any[] = [], opts: any = {}) {
      const log: any[] = [];
      const mobsMap = new Map(mobs.map(m => [m.id, m]));
      const socket = { emit: (ev: string, data: any) => log.push(['socket', ev, plain(data)]) };
      const fake: any = Object.create(GS.prototype);
      Object.assign(fake, {
        io: { sockets: { sockets: opts.noSocket ? new Map() : new Map([['h1', socket]]) } },
        emitZone: (...a: any[]) => log.push(['zone', ...plain(a)]),
        applyDamageToMob: (p: any, m: any, dmg: number, ...rest: any[]) => log.push(['call', 'applyDamageToMob', p.id, m.id, dmg, ...rest]),
        getMobsMap: (z: string, p: any) => { return mobsMap; },
      });
      if (typeof fake.initSystems === 'function') fake.initSystems();
      return { fake, log, mobsMap };
    }
    const snap = (o: any) => plain(o);
    const rnd = (v: number) => { Math.random = () => v; };

    // ---- every real passive card, through every passive entry point
    got.cards = {};
    for (const c of cards) {
      const out: any = {};
      for (const [label, r] of [['fires', 0], ['misses', 0.9999]] as any[]) {
        rnd(r);
        // hit
        { timers.length = 0; const p = hero(c.id); const m = mob({ burnTimer: 2, poisonTimer: 2, chillTimer: 2, frozenTimer: 0, poisonStacks: 1 }); const near = mob({ id: 'm2', x: 7, y: 6 }); const w = world([m, near]);
          w.fake.passiveOnHit(p, m, 40);
          const ran = timers.map(t => t.ms); const firstLog = w.log.length;
          for (const t of timers.splice(0)) t.fn();
          out[`hit ${label}`] = { p: snap(p), m: snap(m), near: snap(near), log: snap(w.log), timers: ran, afterTimers: w.log.length - firstLog }; }
        // hit on a frozen / dead mob
        { const p = hero(c.id); const m = mob({ frozenTimer: 1 }); const w = world([m]); w.fake.passiveOnHit(p, m, 40); out[`hit frozen ${label}`] = { m: snap(m), log: snap(w.log) }; }
        { const p = hero(c.id); const m = mob({ state: 'dead', hp: 0 }); const w = world([m]); w.fake.passiveOnHit(p, m, 40); out[`hit dead ${label}`] = { m: snap(m), log: snap(w.log) }; }
        // kill
        { const p = hero(c.id, { voidSouls: 3, ultCharge: 10 }); const m = mob({ poisonTimer: 3, poisonStacks: 2, poisonDmg: 9, burnTimer: 2, burnDmg: 4 }); const n1 = mob({ id: 'm2', x: 7, y: 6 }); const n2 = mob({ id: 'm3', x: 30, y: 6 }); const n3 = mob({ id: 'm4', x: 6, y: 7, state: 'dead', hp: 0 }); const w = world([m, n1, n2, n3]);
          w.fake.passiveOnKill(p, m); out[`kill ${label}`] = { p: snap(p), n1: snap(n1), n2: snap(n2), n3: snap(n3), log: snap(w.log) }; }
        // hurt
        { const p = hero(c.id, { hp: 30 }); const m = mob(); const w = world([m]); const ret = w.fake.passiveOnHurt(p, m, 40, 'frostfell'); out[`hurt low ${label}`] = { ret, p: snap(p), log: snap(w.log) }; }
        { const p = hero(c.id, { hp: 190 }); const m = mob({ state: 'dead' }); const w = world([m]); const ret = w.fake.passiveOnHurt(p, m, 40, 'frostfell'); out[`hurt healthy dead-attacker ${label}`] = { ret, p: snap(p), log: snap(w.log) }; }
      }
      // damage multiplier against different mob states
      const states: any = { plain: mob(), burning: mob({ burnTimer: 1 }), poisoned: mob({ poisonTimer: 1 }), chilled: mob({ chillTimer: 1 }), frozen: mob({ frozenTimer: 1 }), all: mob({ burnTimer: 1, poisonTimer: 1, chillTimer: 1, frozenTimer: 1 }), weak: mob({ hp: 10 }), noMax: mob({ maxHp: 0, hp: 0 }), hurt: mob({ hp: 99 }) };
      const w = world(); out.damageMult = {};
      for (const [k, m] of Object.entries<any>(states)) for (const hp of [200, 50]) out.damageMult[`${k}/hp${hp}`] = w.fake.passiveDamageMult(hero(c.id, { hp }), m);
      // leech, with and without bloodlust
      out.leech = {};
      for (const [k, extra] of [['plain', {}], ['bloodlust', { bloodlust: { thirst: 2, rage: 0.5 } }], ['bloodlust no thirst', { bloodlust: {} }]] as any[]) for (const dealt of [0, 1, 500]) {
        const p = hero(c.id, extra); const w2 = world(); w2.fake.cardPassiveLeech(p, dealt); out.leech[`${k}/${dealt}`] = { hp: p.hp, log: snap(w2.log) };
      }
      // rebirth
      { rnd(0.5); const p = hero(c.id, { hp: 0, isDead: true }); const m1 = mob(); const m2 = mob({ id: 'm2', x: 40, y: 40 }); const m3 = mob({ id: 'm3', state: 'dead' }); const w2 = world([m1, m2, m3]);
        const r1 = w2.fake.phoenixRebirth(p); const r2 = w2.fake.phoenixRebirth(p); now += 1000 * 1000; const r3 = w2.fake.phoenixRebirth(p); now = NOW;
        out.rebirth = { r1, r2, r3, p: snap(p), m1: snap(m1), m2: snap(m2), log: snap(w2.log) }; }
      got.cards[c.id] = out;
    }

    // ---- no card / not transformed / unknown card
    got.noCard = {};
    for (const [label, p] of [['plain hero', hero(null)], ['card equipped but not transformed', hero('sp_frost_templar', { spTransformed: false })], ['unknown card', hero('sp_nope')], ['no equipment', hero(null, { equipment: undefined })]] as any[]) {
      const w = world([mob()]); rnd(0);
      const m = mob(); const out: any = {};
      out.dmgMult = w.fake.passiveDamageMult(p, m);
      w.fake.passiveOnHit(p, m, 10); w.fake.passiveOnKill(p, m);
      out.hurt = w.fake.passiveOnHurt(p, m, 12, 'frostfell');
      w.fake.cardPassiveLeech(p, 50);
      out.rebirth = w.fake.phoenixRebirth(p);
      out.spCard = w.fake.spCard(p) && w.fake.spCard(p).id;
      out.p = snap(p); out.log = snap(w.log); got.noCard[label] = out;
    }
    got.spCardNull = world().fake.spCard(null);

    // ---- bloodRage
    { const w = world(); got.bloodRage = [w.fake.bloodRage({}), w.fake.bloodRage({ bloodlust: {} }), w.fake.bloodRage({ bloodlust: { rage: 0.35 } })]; }

    // ---- gainUltCharge
    const ultCard = (cards.find(c => c.signature) || { id: 'sp_storm_herald' }).id;
    got.ult = {};
    const ult = (label: string, extra: any, amounts: number[], opts: any = {}) => {
      const p = hero(ultCard, { ultCharge: 0, ...extra }); const w = world([], opts); const steps: any[] = [];
      for (const a of amounts) { w.fake.gainUltCharge(p, a); steps.push({ charge: p.ultCharge, win: snap(p.ultWindow) }); }
      got.ult[label] = { steps, log: snap(w.log) };
    };
    ult('small gains', {}, [1, 2, 3]);
    ult('capped per second', {}, [5, 5, 5, 5]);
    ult('window resets after a second', {}, [10, 10]);
    { const p = hero(ultCard, { ultCharge: 0 }); const w = world(); w.fake.gainUltCharge(p, 10); now += 1000; w.fake.gainUltCharge(p, 10); now += 1000; w.fake.gainUltCharge(p, 4); now = NOW; got.ult.windowReset = { charge: p.ultCharge, win: snap(p.ultWindow) }; }
    ult('fills up and announces', { ultCharge: 95 }, [10]);
    ult('already full does not re-announce', { ultCharge: 100 }, [10]);
    ult('announce without socket', { ultCharge: 95 }, [10], { noSocket: true });
    ult('locked', { ultLockUntil: NOW + 5000 }, [10]);
    ult('lock expired', { ultLockUntil: NOW - 1 }, [10]);
    ult('zero and negative amounts', {}, [0, -4, NaN as any]);
    ult('dead hero', { isDead: true }, [10]);
    { const w = world(); const p = hero(null); w.fake.gainUltCharge(p, 10); got.ult.noCard = snap(p); }
    { const w = world(); const p = hero('sp_berserker', { ultCharge: 0 }); w.fake.gainUltCharge(p, 5); got.ult.noSignatureCard = snap(p); }

    // ---- ownBanner
    { const w = world(); const b = (extra: any = {}) => ({ until: NOW + 1000, zone: 'frostfell', instanceId: null, ...extra });
      got.banner = [hero(null), hero(null, { banner: b() }), hero(null, { banner: b({ until: NOW }) }), hero(null, { banner: b({ zone: 'town' }) }), hero(null, { banner: b({ instanceId: 'i1' }), dungeonInstanceId: 'i1', zone: 'frostfell' }), hero(null, { banner: b({ instanceId: 'i1' }) })]
        .map(p => w.fake.ownBanner(p)); got.banner = plain(got.banner); }

    // ---- absorbIncomingDamage
    got.absorb = {};
    const ab = (label: string, extra: any, dmg: number) => { const p = hero(null, extra); const w = world(); const ret = w.fake.absorbIncomingDamage(p, dmg, 'frostfell'); got.absorb[label] = { ret, p: snap(p), log: snap(w.log) }; };
    ab('no shields', {}, 30);
    ab('shield partly absorbs', { shieldHp: 10 }, 30);
    ab('shield absorbs all', { shieldHp: 100 }, 30);
    ab('energy shield partly', { es: 10 }, 30);
    ab('energy shield breaks', { es: 30 }, 30);
    ab('both shields', { shieldHp: 10, es: 15 }, 30);
    ab('shields and zero damage', { shieldHp: 10, es: 15 }, 0);
    ab('shield and negative damage', { shieldHp: 10 }, -5);
    ab('fractional energy shield', { es: 12.6 }, 50);

    // ---- heroBuffs
    got.buffs = {};
    const hb = (label: string, extra: any) => { const w = world(); got.buffs[label] = plain(w.fake.heroBuffs(hero(null, extra))); };
    hb('nothing', {});
    hb('timers', { bloodlust: { timer: 3.2 }, berserkTimer: 1.1, ironFortressTimer: 2, smokeScreenTimer: 0.5, undyingTimer: 4, sprintTimer: 9 });
    hb('expired timers', { berserkTimer: 0, ironFortressTimer: -1 });
    hb('shields', { shieldHp: 33.4, esMax: 200, es: 77 });
    hb('es empty', { esMax: 200 });
    hb('toggles', { spToggles: { a: { skill: { id: 'aura1', name: 'Aura', icon: '🔥' } }, b: { skill: { id: 'aura2', name: 'Plain' } } } });
    hb('wayfarer cooling', { set4: { wayfarer: {} }, secondWindReadyAt: NOW + 5500 });
    hb('wayfarer ready', { set4: { wayfarer: {} }, secondWindReadyAt: NOW - 1 });
    hb('stormcaller', { set4: { stormcaller: {} }, staticStacks: 4 });
    hb('eclipse dusk', { set4: { eclipse: {} }, eclipsePhase: 'dusk', eclipseTimer: 6.5 });
    hb('eclipse dawn', { set4: { eclipse: {} }, eclipsePhase: 'dawn', eclipseTimer: 2 });
    hb('eclipse without phase', { set4: { eclipse: {} } });
    hb('flow, souls, heat, overheat', { flowStacks: 3, flowTimer: 2.2, voidSouls: 5, voidSoulTimer: 7.1, heat: 42.6, overheatUntil: NOW + 3500 });
    hb('combo live', { combo: { n: 3, until: NOW + 2500 } });
    hb('combo stale', { combo: { n: 3, until: NOW - 1 } });
    hb('combo empty', { combo: { n: 0, until: NOW + 1000 } });
    hb('riposte', { parry: { until: NOW + 1500 } });
    hb('banner', { banner: { until: NOW + 4000, zone: 'frostfell', instanceId: null } });
    hb('banner in another zone', { banner: { until: NOW + 4000, zone: 'town', instanceId: null } });
    hb('phoenix recharging', { spTransformed: true, equipment: { sp: { cardId: 'sp_phoenix_oath' } }, rebirthReadyAt: NOW + 20000 });
    hb('phoenix ready', { spTransformed: true, equipment: { sp: { cardId: 'sp_phoenix_oath' } } });
    hb('phoenix card but not transformed', { spTransformed: false, equipment: { sp: { cardId: 'sp_phoenix_oath' } } });
    hb('debuffs', { statusEffects: [{ type: 'poison', duration: 3.4 }, { type: 'burn', duration: 1 }, { type: 'chill', duration: 0.2 }, { type: 'stun', duration: 2 }] });

    (global as any).setTimeout = realSetTimeout;
    if (process.env.UPDATE_FIXTURES === '1') {
      fs.writeFileSync(FIXTURE, JSON.stringify(got, null, 2) + '\n', 'utf8');
      return;
    }
    assert.deepEqual(plain(got), JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
  } finally {
    (global as any).setTimeout = realSetTimeout;
    Date.now = realNow; Math.random = realRandom;
    await (await import('../accountManager')).default.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
