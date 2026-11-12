// SP skill system (castSpSkill: every Specialist card skill and signature, driven through handlePlayerSkill): locked
// to a fixture captured BEFORE the method moved out of GameServer. UPDATE_FIXTURES=1 rewrites the fixture.
// Bulk scenarios are stored as a hash plus a small summary; the first few are stored in full.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemSpSkill.json');
const NOW = 1700000000000;
const plain = (v: any): any => v === undefined ? null : JSON.parse(JSON.stringify(v, (_k, x) => (x instanceof Map ? { __map: Array.from(x.entries()) } : x instanceof Set ? { __set: Array.from(x.values()) } : x === Infinity ? '__Infinity__' : typeof x === 'number' && Number.isNaN(x) ? '__NaN__' : x)));
const sha = (v: any) => crypto.createHash('sha1').update(JSON.stringify(plain(v))).digest('hex').slice(0, 14);
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hashName = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // the server module imports the accountManager singleton
  const mod: any = await import('../gameServer');
  return { dir, GS: mod.default || mod.GameServer, SP: await import('../spCards') };
}

test('SP skill casting matches the pre-refactor fixture', async () => {
  const { dir, GS, SP } = await load();
  const realNow = Date.now, realRandom = Math.random, realST = global.setTimeout, realSI = global.setInterval, realCI = global.clearInterval;
  let now = NOW;
  Date.now = () => now;
  try {
    const got: any = {};
    let timeouts: any[] = [], intervals: any[] = [];
    (global as any).setTimeout = (fn: any, ms: number) => { timeouts.push({ fn, ms }); return 0 as any; };
    (global as any).setInterval = (fn: any, ms: number) => { const it = { fn, ms, cleared: false }; intervals.push(it); return it as any; };
    (global as any).clearInterval = (it: any) => { if (it) it.cleared = true; };
    const pump = (log: any[]) => {
      for (let guard = 0; guard < 8 && timeouts.length; guard++) for (const t of timeouts.splice(0)) { now += t.ms; t.fn(); }
      for (let round = 0; round < 60 && intervals.some(i => !i.cleared); round++) for (const it of intervals) if (!it.cleared) { now += it.ms; it.fn(); }
      log.push(['pumped', intervals.length]); intervals = []; now = NOW;
    };

    const cards: any[] = Object.values(SP.CARD_BY_ID);
    const hero = (card: any, extra: any = {}) => ({
      id: 'h1', name: 'Hero', zone: 'frostfell', x: 10, y: 10, level: 150, characterClass: card.cls || 'warrior', isDead: false, facing: 'SE', targetX: null, targetY: null,
      hp: 250, maxHp: 400, mp: 900, maxMp: 900, dmg: 100, def: 20, speed: 4, attackRange: 2, attackSpeed: 1, swipe: 35, critChanceBonus: 0, partyId: null,
      skillCooldowns: { slot1: 0, slot2: 0, slot3: 0, dash: 0 }, inventory: { kills: 0, items: [] }, equipment: { sp: { cardId: card.id, upgradeLevel: 70, type: 'sp_card' } }, skills: {}, statusEffects: [],
      spTransformed: true, ultCharge: 100, equippedSkills: { slot1: card.arsenal[0], runes: {} }, ...extra,
    });
    const mobs = () => [
      { id: 'm1', x: 11, y: 10, hp: 50000, maxHp: 50000, def: 5, level: 40, state: 'idle' }, { id: 'm2', x: 12, y: 11, hp: 50000, maxHp: 50000, def: 5, level: 40, state: 'chase', burnTimer: 3, burnDmg: 9 },
      { id: 'm3', x: 9, y: 9, hp: 50000, maxHp: 50000, def: 5, level: 40, state: 'idle', poisonTimer: 4, poisonStacks: 3, poisonDmg: 5 }, { id: 'm4', x: 10, y: 13, hp: 50000, maxHp: 50000, def: 5, level: 40, state: 'idle', chillTimer: 2 },
      { id: 'm5', x: 14, y: 10, hp: 50000, maxHp: 50000, def: 5, level: 40, state: 'idle', frozenTimer: 2 }, { id: 'm6', x: 11.5, y: 10.5, hp: 900000, maxHp: 900000, def: 20, level: 45, isBoss: true, state: 'idle' },
      { id: 'm7', x: 10.5, y: 10.5, hp: 0, maxHp: 100, def: 0, level: 40, state: 'dead' }, { id: 'm8', x: 11, y: 11, hp: 50000, maxHp: 50000, def: 5, level: 40, state: 'idle', spawnUntil: NOW + 1000 },
      { id: 'm9', x: 40, y: 40, hp: 50000, maxHp: 50000, def: 5, level: 40, state: 'idle' }, { id: 'm10', x: 12, y: 9, hp: 3, maxHp: 100, def: 0, level: 40, state: 'idle' },
      { id: 'm11', x: 8, y: 11, hp: 50000, maxHp: 50000, def: 5, level: 40, state: 'idle' }, { id: 'm12', x: 13, y: 12, hp: 50000, maxHp: 50000, def: 5, level: 40, state: 'idle' },
    ];

    function world(name: string, p: any, opts: any = {}) {
      Math.random = mulberry32(hashName(name)); now = NOW; timeouts = []; intervals = [];
      const log: any[] = [];
      const players = new Map<string, any>([['h1', p]]);
      const ally = { id: 'h2', name: 'Ally', zone: 'frostfell', x: 11, y: 11, hp: 20, maxHp: 300, mp: 5, maxMp: 100, isDead: false, partyId: opts.party ? 'p1' : null, level: 40 };
      const far = { id: 'h3', name: 'Far', zone: 'frostfell', x: 50, y: 50, hp: 20, maxHp: 300, isDead: false, partyId: null as any };
      players.set('h2', ally); players.set('h3', far);
      const mobsMap = new Map<string, any>(); for (const m of mobs()) mobsMap.set(m.id, m);
      const socket = { emit: (ev: string, data: any) => log.push(['socket', ev, plain(data)]) };
      const fake: any = Object.create(GS.prototype);
      Object.assign(fake, {
        players, io: { sockets: { sockets: new Map([['h1', socket]]) } }, fields: new Map([['frostfell', {}]]),
        dungeonInstances: new Map(), ctxInstanceId: null, nextEntityId: 900, projectiles: new Map(), smokeClouds: [],
        emitZone: (...a: any[]) => log.push(['zone', ...plain(a)]),
        getMobsMap: () => mobsMap,
        isColliding: (x: number, y: number) => x > 16 || y < 3 || x < 2 || (x > 13 && y > 14),
        damageFieldProps: (...a: any[]) => log.push(['call', 'damageFieldProps', ...plain(a.slice(1))]),
        handleMobDeath: (m: any, k: any) => { log.push(['call', 'handleMobDeath', m.id, k && k.id]); m.state = 'dead'; m.hp = 0; },
        applyTalentProcs: (p2: any, m: any, b: number, d: number) => log.push(['call', 'applyTalentProcs', m.id, b, d]),
        takeCorpses: (...a: any[]) => { log.push(['call', 'takeCorpses', ...plain(a)]); return [{ id: 'c1', x: a[2], y: a[3], name: 'Corpse', level: 40, hp: 100, maxHp: 100 }, { id: 'c2', x: a[2] + 1, y: a[3], name: 'Corpse2', level: 40, hp: 100, maxHp: 100 }].slice(0, a[5]); },
        raiseMinion: (p2: any, c: any, s: any) => log.push(['call', 'raiseMinion', c.id, s.id]),
        recalculatePlayerStats: (p2: any) => log.push(['call', 'recalculatePlayerStats', p2.id]),
        sendDirectMessage: (...a: any[]) => log.push(['call', 'sendDirectMessage', ...plain(a)]),
        ...(opts.props || {}),
      });
      if (typeof fake.initSystems === 'function') fake.initSystems();
      return { fake, log, players, mobsMap };
    }
    const snapshot = (w: any) => ({ log: plain(w.log), players: plain(Object.fromEntries(w.players)), mobs: plain(Object.fromEntries(w.mobsMap)), smoke: plain(w.fake.smokeClouds), projectiles: plain(w.fake.projectiles) });
    got.bulk = {}; let full = 0;
    const record = (name: string, w: any, threw: any) => {
      const s = snapshot(w); const p = s.players.h1;
      const mobHp = Object.values<any>(s.mobs).reduce((t, m) => t + Math.max(0, m.hp), 0);
      const entry: any = { hash: sha(s), events: s.log.length, fx: s.log.filter((l: any) => l[2] === 'skill_fx').length, mobHp, dead: Object.values<any>(s.mobs).filter(m => m.state === 'dead').length, mp: p.mp, hp: p.hp, x: p.x, y: p.y, cds: p.skillCooldowns };
      if (threw) entry.threw = threw;
      if (full < 6) { entry.full = s; full++; }
      got.bulk[name] = entry;
    };
    const cast = (name: string, p: any, data: any, opts: any = {}) => {
      const w = world(name, p, opts); let threw: any = null;
      try { w.fake.handlePlayerSkill('h1', data); pump(w.log); } catch (e: any) { threw = String(e && e.message); }
      record(name, w, threw);
    };

    const aims: any = { none: {}, mob: { targetX: 11, targetY: 10 }, ground: { targetX: 13, targetY: 7 } };
    for (const c of cards) {
      for (const skillId of c.arsenal) {
        const def: any = (SP.SP_SKILLS as any)[skillId]; if (!def) continue;
        const slot = def.isDash || def.spShape === 'dash' || def.spShape === 'blink' ? 'dash' : 'slot1';
        const base = (extra: any = {}) => hero(c, { equippedSkills: { slot1: skillId, dash: skillId, runes: {} }, ...extra });
        for (const [aimName, aim] of Object.entries<any>(aims)) cast(`${c.id}/${skillId} ${slot} ${aimName}`, base(), { skillSlot: slot, ...aim });
        cast(`${c.id}/${skillId} party`, base({ partyId: 'p1' }), { skillSlot: slot, targetX: 11, targetY: 10 }, { party: true });
        cast(`${c.id}/${skillId} low hp`, base({ hp: 30 }), { skillSlot: slot, targetX: 12, targetY: 10 });
        cast(`${c.id}/${skillId} state and gear`, base({ voidSouls: 6, heat: 60, overheatUntil: NOW + 5000, combo: { n: 3, last: 'other', until: NOW + 4000 }, moveDir: { dx: 1, dy: 1 }, critChanceBonus: 0.4, berserkTimer: 2 }), { skillSlot: slot, targetX: 12, targetY: 12 });
        cast(`${c.id}/${skillId} flame rune`, base({ equippedSkills: { slot1: skillId, dash: skillId, runes: { slot1: 'flame', dash: 'flame' } } }), { skillSlot: slot, targetX: 11, targetY: 10 });
        cast(`${c.id}/${skillId} mirrored by a shadow`, base({ nbShadow: { x: 6, y: 8, until: NOW + 9000, zone: 'frostfell', instanceId: null, mirror: 0.5 } }), { skillSlot: slot, targetX: 11, targetY: 10 });
        cast(`${c.id}/${skillId} at a wall`, base({ x: 15.5, y: 3.5, facing: 'E' }), { skillSlot: slot, targetX: 20, targetY: 3 });
        cast(`${c.id}/${skillId} locked at level 0`, base({ equipment: { sp: { cardId: c.id, upgradeLevel: 0, type: 'sp_card' } } }), { skillSlot: slot, targetX: 11, targetY: 10 });
        cast(`${c.id}/${skillId} low mana`, base({ mp: 3 }), { skillSlot: slot, targetX: 11, targetY: 10 });
        cast(`${c.id}/${skillId} active toggle`, base({ spToggles: { [skillId]: { skill: { id: skillId, name: 'x' }, until: NOW + 5000 } } }), { skillSlot: slot, targetX: 11, targetY: 10 });
      }
      // signatures (their stages land on delays, from where the hero is by then)
      if (c.signature) {
        cast(`${c.id} signature`, hero(c), { skillSlot: 'ult', targetX: 11, targetY: 10 });
        cast(`${c.id} signature facing`, hero(c, { facing: 'NW', hp: 40 }), { skillSlot: 'ult' });
        cast(`${c.id} signature in a party`, hero(c, { partyId: 'p1' }), { skillSlot: 'ult', targetX: 12, targetY: 12 }, { party: true });
      }
    }

    (global as any).setTimeout = realST; (global as any).setInterval = realSI; (global as any).clearInterval = realCI;
    if (process.env.UPDATE_FIXTURES === '1') {
      fs.writeFileSync(FIXTURE, JSON.stringify(got, null, 2) + '\n', 'utf8');
      return;
    }
    assert.deepEqual(plain(got), JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
  } finally {
    (global as any).setTimeout = realST; (global as any).setInterval = realSI; (global as any).clearInterval = realCI;
    Date.now = realNow; Math.random = realRandom;
    await (await import('../accountManager')).default.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
