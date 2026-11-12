// Skill system (handlePlayerSkill for every class skill and weapon ability, loadout customizing, set cast hooks):
// locked to a fixture captured BEFORE the methods moved out of GameServer. UPDATE_FIXTURES=1 rewrites the fixture.
// Bulk scenarios are stored as a hash plus a small summary; the first few and all guard cases are stored in full.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemSkill.json');
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
  return { dir, GS: mod.default || mod.GameServer, I: await import('../items'), SP: await import('../spCards'), SK: await import('../data/skills') };
}

test('skill methods match the pre-refactor fixture', async () => {
  const { dir, GS, I, SP, SK } = await load();
  const realNow = Date.now, realRandom = Math.random, realST = global.setTimeout, realSI = global.setInterval, realCI = global.clearInterval;
  let now = NOW;
  Date.now = () => now;
  try {
    const got: any = {};
    const ITEMS: any = I.ITEMS;
    let timeouts: any[] = [], intervals: any[] = [];
    (global as any).setTimeout = (fn: any, ms: number) => { timeouts.push({ fn, ms }); return 0 as any; };
    (global as any).setInterval = (fn: any, ms: number) => { const it = { fn, ms, cleared: false }; intervals.push(it); return it as any; };
    (global as any).clearInterval = (it: any) => { if (it) it.cleared = true; };
    // advance the clock and run what the cast left pending (delayed stages, repeating ticks)
    const pump = (log: any[]) => {
      for (const t of timeouts.splice(0)) { now += t.ms; t.fn(); }
      for (let round = 0; round < 60 && intervals.some(i => !i.cleared); round++) {
        for (const it of intervals) if (!it.cleared) { now += it.ms; it.fn(); }
      }
      log.push(['pumped', intervals.length]);
      intervals = []; now = NOW;
    };

    const hero = (cls = 'warrior', extra: any = {}) => ({
      id: 'h1', name: 'Hero', zone: 'frostfell', x: 10, y: 10, level: 150, characterClass: cls, isDead: false, facing: 'SE', targetX: null, targetY: null,
      hp: 250, maxHp: 400, mp: 500, maxMp: 500, dmg: 100, def: 20, speed: 4, attackRange: 2, attackSpeed: 1, swipe: 35, critChanceBonus: 0, partyId: null,
      skillCooldowns: { slot1: 0, slot2: 0, slot3: 0, dash: 0 }, inventory: { kills: 0, items: [] }, equipment: {}, skills: {}, statusEffects: [],
      equippedSkills: { slot1: 'whirlwind', slot2: 'earthshaker', slot3: 'colossus_strike', dash: 'blade_charge', runes: { slot1: 'none', slot2: 'none', slot3: 'none', dash: 'none' } }, ...extra,
    });
    const mobs = () => [
      { id: 'm1', x: 11, y: 10, hp: 5000, maxHp: 5000, def: 5, level: 40, state: 'idle' }, { id: 'm2', x: 12, y: 11, hp: 5000, maxHp: 5000, def: 5, level: 40, state: 'chase' },
      { id: 'm3', x: 9, y: 9, hp: 5000, maxHp: 5000, def: 5, level: 40, state: 'idle' }, { id: 'm4', x: 10, y: 13, hp: 5000, maxHp: 5000, def: 5, level: 40, state: 'idle' },
      { id: 'm5', x: 14, y: 10, hp: 5000, maxHp: 5000, def: 5, level: 40, state: 'idle' }, { id: 'm6', x: 11.5, y: 10.5, hp: 90000, maxHp: 90000, def: 20, level: 45, isBoss: true, state: 'idle' },
      { id: 'm7', x: 10.5, y: 10.5, hp: 0, maxHp: 100, def: 0, level: 40, state: 'dead' }, { id: 'm8', x: 11, y: 11, hp: 5000, maxHp: 5000, def: 5, level: 40, state: 'idle', spawnUntil: NOW + 1000 },
      { id: 'm9', x: 40, y: 40, hp: 5000, maxHp: 5000, def: 5, level: 40, state: 'idle' }, { id: 'm10', x: 12, y: 9, hp: 3, maxHp: 100, def: 0, level: 40, state: 'idle' },
    ];

    function world(name: string, p: any, opts: any = {}) {
      Math.random = mulberry32(hashName(name)); now = NOW; timeouts = []; intervals = [];
      const log: any[] = [];
      const players = new Map<string, any>([['h1', p]]);
      const ally = { id: 'h2', name: 'Ally', zone: 'frostfell', x: 11, y: 11, hp: 20, maxHp: 300, mp: 5, maxMp: 100, isDead: false, partyId: null, level: 40 };
      const far = { id: 'h3', name: 'Far', zone: 'frostfell', x: 50, y: 50, hp: 20, maxHp: 300, isDead: false, partyId: null };
      if (!opts.alone) { players.set('h2', ally); players.set('h3', far); }
      const mobsMap = new Map<string, any>(); for (const m of opts.mobs || mobs()) mobsMap.set(m.id, m);
      const socket = { emit: (ev: string, data: any) => log.push(['socket', ev, plain(data)]) };
      const fake: any = Object.create(GS.prototype);
      Object.assign(fake, {
        players, io: { sockets: { sockets: opts.noSocket ? new Map() : new Map([['h1', socket]]) } }, fields: new Map([['frostfell', {}]]),
        dungeonInstances: new Map(opts.instances || []), ctxInstanceId: null, nextEntityId: 900, projectiles: new Map(),
        emitZone: (...a: any[]) => log.push(['zone', ...plain(a)]),
        getMobsMap: () => mobsMap,
        isColliding: (x: number, y: number) => x > 16 || y < 3 || x < 2 || (x > 13 && y > 14),
        damageFieldProps: (...a: any[]) => log.push(['call', 'damageFieldProps', ...plain(a.slice(1))]),
        handleMobDeath: (m: any, k: any) => { log.push(['call', 'handleMobDeath', m.id, k && k.id]); m.state = 'dead'; m.hp = 0; },
        applyTalentProcs: (p: any, m: any, b: number, d: number) => log.push(['call', 'applyTalentProcs', m.id, b, d]),
        castSpSkill: (p: any, s: any, ctx: any) => log.push(['call', 'castSpSkill', s && s.id, plain(ctx)]),
        endSpToggle: (p: any, id: string) => log.push(['call', 'endSpToggle', id]),
        recalculatePlayerStats: (p: any) => log.push(['call', 'recalculatePlayerStats', p.id, p.eclipsePhase]),
        sendDirectMessage: (...a: any[]) => log.push(['call', 'sendDirectMessage', ...plain(a)]),
        customizeSpSkill: (p: any, d: any) => log.push(['call', 'customizeSpSkill', plain(d)]),
        ...(opts.props || {}),
      });
      if (typeof fake.initSystems === 'function') fake.initSystems();
      return { fake, log, players, mobsMap };
    }
    const snapshot = (w: any) => ({ log: plain(w.log), players: plain(Object.fromEntries(w.players)), mobs: plain(Object.fromEntries(w.mobsMap)), projectiles: plain(w.fake.projectiles) });
    const rec = (name: string, w: any, extra: any = {}) => { got[name] = { ...snapshot(w), ...extra }; };
    // bulk: hash + a readable summary
    got.bulk = {}; let bulkFull = 0;
    const bulk = (name: string, w: any) => {
      const s = snapshot(w); const hp = Object.values<any>(s.mobs).reduce((t, m) => t + Math.max(0, m.hp), 0);
      const p = s.players.h1;
      const entry: any = { hash: sha(s), events: s.log.length, mobHp: hp, dead: Object.values<any>(s.mobs).filter(m => m.state === 'dead').length, mp: p.mp, hpP: p.hp, x: p.x, y: p.y, cds: p.skillCooldowns };
      if (bulkFull < 8) { entry.full = s; bulkFull++; }
      got.bulk[name] = entry;
    };

    const cast = (name: string, p: any, data: any, opts: any = {}, into: 'rec' | 'bulk' = 'rec') => {
      const w = world(name, p, opts);
      let threw: any = null; try { w.fake.handlePlayerSkill(opts.socketId || 'h1', data); pump(w.log); } catch (e: any) { threw = String(e && e.message); }
      if (into === 'bulk') { bulk(name, w); if (threw) got.bulk[name].threw = threw; } else rec(name, w, { threw });
    };

    // ---- guards
    cast('no player', hero(), { skillSlot: 'slot1' }, { socketId: 'zz' });
    cast('dead', hero('warrior', { isDead: true }), { skillSlot: 'slot1' });
    cast('bad slot', hero(), { skillSlot: 'slot9' });
    cast('default slot', hero(), {});
    cast('skill1 alias', hero(), { skillSlot: 'skill1' });
    cast('skill2 alias', hero(), { skillSlot: 'skill2' });
    cast('no equipped skills yet', hero('mage', { equippedSkills: undefined }), { skillSlot: 'slot1', targetX: 12, targetY: 10 });
    cast('no cooldown table yet', hero('rogue', { skillCooldowns: undefined }), { skillSlot: 'slot1', targetX: 12, targetY: 10 });
    cast('on cooldown', hero('warrior', { skillCooldowns: { slot1: 2 } }), { skillSlot: 'slot1' });
    cast('on cooldown by raw alias', hero('warrior', { skillCooldowns: { skill1: 2 } }), { skillSlot: 'skill1' });
    cast('not enough mana', hero('warrior', { mp: 1 }), { skillSlot: 'slot1' });
    cast('not enough mana no socket', hero('warrior', { mp: 1 }), { skillSlot: 'slot1' }, { noSocket: true });
    cast('mana flow talent lowers cost', hero('warrior', { mp: 8, skills: { mana_flow: 2 } }), { skillSlot: 'slot1' });
    cast('ult without a card', hero(), { skillSlot: 'ult' });
    cast('ult without a card, no socket', hero(), { skillSlot: 'ult' }, { noSocket: true });
    cast('weapon without ability', hero(), { skillSlot: 'weapon' });
    cast('unknown equipped skill falls back', hero('warrior', { equippedSkills: { slot1: 'not_a_skill', runes: {} } }), { skillSlot: 'slot1' });
    cast('empty slot uses class default', hero('mage', { equippedSkills: { runes: {} } }), { skillSlot: 'slot2', targetX: 12, targetY: 10 });

    // ---- every class skill, with and without runes and aimed in different ways
    const aims: any = { none: {}, mob: { targetX: 11, targetY: 10 }, ground: { targetX: 13, targetY: 7 } };
    for (const [id, def] of Object.entries<any>(SK.ALL_CLASS_SKILLS)) {
      const cls = def.class; const slot = def.isDash ? 'dash' : 'slot1';
      for (const rune of ['none', 'flame', 'frost', 'tempest', 'vampiric']) for (const [aimName, aim] of Object.entries<any>(aims)) {
        if (rune !== 'none' && aimName === 'none') continue;
        const p = hero(cls, { equippedSkills: { slot1: id, slot2: id, slot3: id, dash: id, runes: { slot1: rune, slot2: rune, slot3: rune, dash: rune } } });
        cast(`${id} ${slot} ${rune} ${aimName}`, p, { skillSlot: slot, ...aim }, {}, 'bulk');
      }
      // other slots and states
      cast(`${id} slot2 low mana`, hero(cls, { mp: 20, equippedSkills: { slot2: id, runes: {} } }), { skillSlot: 'slot2', targetX: 11, targetY: 10 }, {}, 'bulk');
      cast(`${id} alone, no ally`, hero(cls, { equippedSkills: { slot3: id, runes: {} } }), { skillSlot: 'slot3', targetX: 11, targetY: 10 }, { alone: true }, 'bulk');
      cast(`${id} in a party`, hero(cls, { partyId: 'p1', equippedSkills: { slot1: id, runes: {} } }), { skillSlot: 'slot1', targetX: 11, targetY: 10, dirX: 1, dirY: 0 }, { props: {} }, 'bulk');
      cast(`${id} moving, with talents and gear`, hero(cls, { moveDir: { dx: 1, dy: -1 }, cdr: 0.2, berserkTimer: 3, bloodlust: { rage: 0.3 }, critChanceBonus: 0.5, set2: { stormcaller: { cdr: 0.1 } }, skills: { sundering_dash: 2, arcane_haste: 1, shadow_sprint: 1 }, equippedSkills: { slot1: id, dash: id, runes: {} } }), { skillSlot: def.isDash ? 'dash' : 'slot1', targetX: 12, targetY: 12 }, {}, 'bulk');
      cast(`${id} against a wall`, hero(cls, { x: 15.5, y: 3.5, facing: 'E', equippedSkills: { slot1: id, dash: id, runes: {} } }), { skillSlot: def.isDash ? 'dash' : 'slot1', targetX: 20, targetY: 3 }, {}, 'bulk');
    }

    // ---- dungeon modifiers, tempest rune and cooldown arithmetic
    const dungeonInst = (mods: string[]) => ({ id: 'i1', mods });
    cast('exhausting dungeon', hero('warrior', { zone: 'dungeon', dungeonInstanceId: 'i1' }), { skillSlot: 'slot1' }, { instances: [['i1', dungeonInst(['exhausting'])]] });
    cast('other dungeon mods', hero('warrior', { zone: 'dungeon', dungeonInstanceId: 'i1' }), { skillSlot: 'slot1' }, { instances: [['i1', dungeonInst(['swift'])]] });
    cast('tempest weapon runes', hero('warrior', { equipment: { weapon: { sockets: ['rune_tempest', 'rune_tempest'], maxSockets: 2, type: 'equipment', slot: 'weapon' } } }), { skillSlot: 'slot1' });
    cast('tempest never lengthens a short cooldown', hero('mage', { equipment: { weapon: { sockets: ['rune_tempest'], maxSockets: 1, type: 'equipment', slot: 'weapon' } }, equippedSkills: { dash: 'arcane_blink', runes: {} } }), { skillSlot: 'dash', targetX: 12, targetY: 10 });
    cast('set4 stormcaller counts casts', hero('warrior', { set4: { stormcaller: { stacks: 3 } }, staticStacks: 2 }), { skillSlot: 'slot1' });
    cast('set4 eclipse flips on long cooldowns', hero('warrior', { set4: { eclipse: { flipCooldown: 1, period: 20, dawnRadius: 4 } }, eclipsePhase: 'dusk' }), { skillSlot: 'slot1' });
    cast('set4 eclipse short cooldown', hero('warrior', { set4: { eclipse: { flipCooldown: 99, period: 20, dawnRadius: 4 } }, eclipsePhase: 'dusk' }), { skillSlot: 'slot1' });

    // ---- recasts: Phantom Shuriken and Sky Lance free recall
    for (const [label, extra] of [
      ['nightblade recall', { nbStars: { slot: 'slot1', until: NOW + 5000, skillId: 'phantom_assassins', zone: 'frostfell', instanceId: null }, equippedSkills: { slot1: 'phantom_assassins', runes: {} }, skillCooldowns: { slot1: 4 } }],
      ['nightblade expired', { nbStars: { slot: 'slot1', until: NOW - 1, skillId: 'phantom_assassins', zone: 'frostfell', instanceId: null }, equippedSkills: { slot1: 'phantom_assassins', runes: {} }, skillCooldowns: { slot1: 4 } }],
      ['dragoon recall', { dgSpear: { slot: 'slot1', until: NOW + 5000, skillId: 'sky_lance', zone: 'frostfell', instanceId: null }, equippedSkills: { slot1: 'sky_lance', runes: {} }, skillCooldowns: { slot1: 4 } }],
    ] as any[]) cast(label, hero('rogue', extra), { skillSlot: 'slot1', targetX: 11, targetY: 10 });

    // ---- weapon abilities: every weapon that has one
    for (const it of Object.values(ITEMS).filter((i: any) => i.abilityId) as any[]) {
      for (const up of [0, 5]) {
        const p = hero(it.cls || 'warrior', { equipment: { weapon: { ...structuredClone(it), upgradeLevel: up } } });
        cast(`weapon ${it.id} +${up}`, p, { skillSlot: 'weapon', targetX: 11, targetY: 10 }, {}, 'bulk');
      }
    }

    // ---- SP card skills and signatures: routed to castSpSkill (stubbed here; locked separately)
    for (const c of Object.values(SP.CARD_BY_ID) as any[]) {
      for (const skillId of c.arsenal.slice(0, 3)) {
        const p = hero(c.cls || 'warrior', { spTransformed: true, equipment: { sp: { cardId: c.id, upgradeLevel: 70, type: 'sp_card' } }, equippedSkills: { slot1: skillId, runes: {} } });
        cast(`card ${c.id} ${skillId}`, p, { skillSlot: 'slot1', targetX: 12, targetY: 10 }, {}, 'bulk');
      }
      const ultP = hero(c.cls || 'warrior', { spTransformed: true, ultCharge: 100, equipment: { sp: { cardId: c.id, upgradeLevel: 20, type: 'sp_card' } } });
      cast(`card ${c.id} ult`, ultP, { skillSlot: 'ult', targetX: 12, targetY: 10 }, {}, 'bulk');
      const ultLow = hero(c.cls || 'warrior', { spTransformed: true, ultCharge: 40.7, equipment: { sp: { cardId: c.id, upgradeLevel: 20, type: 'sp_card' } } });
      cast(`card ${c.id} ult charging`, ultLow, { skillSlot: 'ult' }, {}, 'bulk');
    }
    // an aura skill switched off by casting it again
    { const auraCard = (Object.values(SP.CARD_BY_ID) as any[]).find(c => c.arsenal.some((s: string) => (SP.SP_SKILLS as any)[s] && (SP.SP_SKILLS as any)[s].spShape === 'aura'));
      if (auraCard) { const skillId = auraCard.arsenal.find((s: string) => (SP.SP_SKILLS as any)[s] && (SP.SP_SKILLS as any)[s].spShape === 'aura');
        const base = { spTransformed: true, equipment: { sp: { cardId: auraCard.id, upgradeLevel: 70 } }, equippedSkills: { slot1: skillId, runes: {} } };
        cast('aura toggles off', hero(auraCard.cls || 'warrior', { ...base, spToggles: { [skillId]: { skill: { id: skillId } } } }), { skillSlot: 'slot1' });
        cast('aura toggle off, no socket', hero(auraCard.cls || 'warrior', { ...base, spToggles: { [skillId]: { skill: { id: skillId } } } }), { skillSlot: 'slot1' }, { noSocket: true });
        cast('aura too little blood', hero(auraCard.cls || 'warrior', { ...base, hp: 5 }), { skillSlot: 'slot1' });
        cast('aura too little blood, no socket', hero(auraCard.cls || 'warrior', { ...base, hp: 5 }), { skillSlot: 'slot1' }, { noSocket: true });
        cast('aura starts', hero(auraCard.cls || 'warrior', { ...base, hp: 390 }), { skillSlot: 'slot1' }); } }
    cast('reaver overheat is free', hero('warrior', { spTransformed: true, overheatUntil: NOW + 5000, mp: 0, equipment: { sp: { cardId: 'sp_reaver', upgradeLevel: 70 } }, equippedSkills: { slot1: ((Object.values(SP.CARD_BY_ID) as any[]).find(c => c.id === 'sp_reaver') || { arsenal: ['x'] }).arsenal[0], runes: {} } }), { skillSlot: 'slot1' });

    // ---- resolvePlayerSkill directly
    got.resolve = {};
    { const w = world('resolve', hero()); const r = (label: string, p: any, slot: string, id: string) => { got.resolve[label] = plain(w.fake.resolvePlayerSkill(p, slot, id)); };
      const anyCard: any = Object.values(SP.CARD_BY_ID).find((c: any) => c.signature && c.arsenal.length);
      const tp = (lvl: number) => hero(anyCard.cls || 'warrior', { spTransformed: true, equipment: { sp: { cardId: anyCard.id, upgradeLevel: lvl } } });
      r('class skill', hero(), 'slot1', 'whirlwind'); r('unknown id falls back to the slot default', hero(), 'slot2', 'zzz'); r('dash default', hero('mage'), 'dash', 'zzz');
      r('weapon none', hero(), 'weapon', 'weapon'); r('weapon with ability +3', hero('warrior', { equipment: { weapon: { ...structuredClone(ITEMS.iron_blade), upgradeLevel: 3 } } }), 'weapon', 'weapon');
      r('weapon with ability, no upgrade', hero('warrior', { equipment: { weapon: structuredClone(ITEMS.iron_blade) } }), 'weapon', 'weapon');
      r('ult without card', hero(), 'ult', 'ult'); r('ult with card lvl 0', tp(0), 'ult', 'ult'); r('ult with card lvl 30', tp(30), 'ult', 'ult');
      r('card skill unlocked', tp(70), 'slot1', anyCard.arsenal[0]); r('card skill locked', tp(0), 'slot1', anyCard.arsenal[anyCard.arsenal.length - 1]);
      r('card but a class skill id', tp(70), 'slot1', 'whirlwind'); r('not transformed with card', hero('warrior', { equipment: { sp: { cardId: anyCard.id } } }), 'slot1', anyCard.arsenal[0]); }

    // ---- applySetOnSkillCast / flipEclipse
    got.setCast = {};
    const sc = (label: string, p: any, cd: number) => { const w = world('setcast ' + label, p); w.fake.applySetOnSkillCast(p, cd); got.setCast[label] = { p: plain(p), log: plain(w.log) }; };
    sc('no set4', hero(), 5);
    sc('stormcaller stacks', hero('warrior', { set4: { stormcaller: { stacks: 4 } }, staticStacks: 1 }), 5);
    sc('stormcaller capped', hero('warrior', { set4: { stormcaller: { stacks: 4 } }, staticStacks: 4 }), 5);
    sc('eclipse long cooldown flips', hero('warrior', { set4: { eclipse: { flipCooldown: 3, period: 12, dawnRadius: 5 } }, eclipsePhase: 'dusk' }), 5);
    sc('eclipse flips back', hero('warrior', { set4: { eclipse: { flipCooldown: 3, period: 12, dawnRadius: 5 } }, eclipsePhase: 'dawn' }), 5);
    sc('eclipse short cooldown', hero('warrior', { set4: { eclipse: { flipCooldown: 3, period: 12, dawnRadius: 5 } }, eclipsePhase: 'dusk' }), 1);
    sc('eclipse without a phase', hero('warrior', { set4: { eclipse: { flipCooldown: 3, period: 12, dawnRadius: 5 } } }), 9);
    { const p = hero(); const w = world('flip none', p); w.fake.flipEclipse(p); w.fake.flipEclipse({ set4: {} }); got.setCast.flipWithoutSet = { p: plain(p), log: plain(w.log) }; }

    // ---- handleCustomizeSkill
    got.customize = {};
    const cz = (label: string, p: any, data: any, opts: any = {}) => { const w = world('cz ' + label, p, opts); let threw: any = null; try { w.fake.handleCustomizeSkill(opts.socketId || 'h1', data); } catch (e: any) { threw = String(e && e.message); } got.customize[label] = { p: plain(p), log: plain(w.log), threw }; };
    cz('no player', hero(), { slot: 'slot1' }, { socketId: 'zz' });
    cz('dead', hero('warrior', { isDead: true }), { slot: 'slot1', skillId: 'whirlwind' });
    cz('transformed goes to the card', hero('warrior', { spTransformed: true }), { slot: 'slot1', skillId: 'x' });
    cz('no data', hero(), null);
    cz('no slot', hero(), { skillId: 'whirlwind' });
    cz('invalid slot', hero(), { slot: 'slot9', skillId: 'whirlwind' });
    cz('set a skill', hero(), { slot: 'slot2', skillId: 'whirlwind' });
    cz('set a skill, no socket', hero(), { slot: 'slot2', skillId: 'whirlwind' }, { noSocket: true });
    cz('dash slot', hero(), { slot: 'dash', skillId: 'blade_charge' });
    cz('wrong class skill ignored', hero(), { slot: 'slot1', skillId: 'frost_nova' });
    cz('unknown skill ignored', hero(), { slot: 'slot1', skillId: 'nope' });
    cz('level locked', hero('warrior', { level: 1 }), { slot: 'slot1', skillId: 'ragnarok_slash' });
    cz('level locked, no socket', hero('warrior', { level: 1 }), { slot: 'slot1', skillId: 'ragnarok_slash' }, { noSocket: true });
    cz('rune', hero(), { slot: 'slot3', rune: 'flame' });
    cz('unknown rune ignored', hero(), { slot: 'slot3', rune: 'nope' });
    cz('rune none', hero(), { slot: 'slot3', rune: 'none' });
    cz('skill and rune', hero(), { slot: 'slot1', skillId: 'whirlwind', rune: 'frost' });
    cz('fresh player without loadout', hero('mage', { equippedSkills: undefined }), { slot: 'slot1', skillId: 'frost_nova' });
    cz('unknown class loadout falls back', hero('bard', { equippedSkills: undefined }), { slot: 'slot1', skillId: 'whirlwind' });
    cz('loadout without runes', hero('warrior', { equippedSkills: { slot1: 'whirlwind' } }), { slot: 'slot1', rune: 'tempest' });
    cz('slot names Q E R Shift', hero(), { slot: 'slot2', skillId: 'earthshaker' });
    cz('slot name R', hero(), { slot: 'slot3', skillId: 'colossus_strike' });

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
