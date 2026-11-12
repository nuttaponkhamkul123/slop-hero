// Combat system (basic attacks, damage to monsters, projectiles, monster death and drops, armor set procs): locked
// to a fixture captured BEFORE the methods moved out of GameServer. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemCombat.json');
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
  return { dir, GS: mod.default || mod.GameServer, I: await import('../items'), SP: await import('../spCards') };
}

test('combat methods match the pre-refactor fixture', async () => {
  const { dir, GS, I, SP } = await load();
  const realNow = Date.now, realRandom = Math.random;
  Date.now = () => NOW;
  try {
    const got: any = {};
    const hero = (extra: any = {}) => ({
      id: 'h1', name: 'Hero', zone: 'frostfell', x: 10, y: 10, level: 40, characterClass: 'warrior', isDead: false, facing: 'SE',
      hp: 150, maxHp: 300, mp: 50, maxMp: 100, dmg: 100, def: 20, attackSpeed: 1, attackRange: 1.6, swipe: 35, attackCooldown: 0, critChanceBonus: 0, critDmgBonus: 0,
      skillCooldowns: { slot1: 4, dash: 2 }, inventory: { kills: 0, items: [] }, equipment: {}, ...extra,
    });
    const mob = (id: string, x: number, y: number, extra: any = {}) => ({ id, name: 'Ghoul ' + id, x, y, hp: 500, maxHp: 500, level: 40, def: 10, state: 'idle', exp: 100, gold: 60, element: 'neutral', ...extra });

    function world(name: string, opts: any = {}) {
      Math.random = mulberry32(hashName(name));
      const log: any[] = [];
      const socket = { emit: (ev: string, data: any) => log.push(['socket', ev, plain(data)]) };
      const players = new Map<string, any>(); for (const p of opts.players || []) if (p) players.set(p.id, p);
      const mobsMap = new Map<string, any>(); for (const m of opts.mobs || []) mobsMap.set(m.id, m);
      const fake: any = Object.create(GS.prototype);
      Object.assign(fake, {
        players, io: { sockets: { sockets: new Map([['h1', socket]]) } }, fields: new Map(opts.field ? [[opts.field, {}]] : []),
        projectiles: new Map(), nextEntityId: 700, dungeonInstances: new Map(opts.instances || []), ctxInstanceId: opts.ctx ?? null,
        emitZone: (...a: any[]) => log.push(['zone', ...plain(a)]),
        getMobsMap: () => mobsMap,
        damageFieldProps: (...a: any[]) => log.push(['call', 'damageFieldProps', ...plain(a.slice(1))]),
        recordRaidDamage: (...a: any[]) => log.push(['call', 'recordRaidDamage', ...a]),
        applyTalentProcs: (p: any, m: any, b: number, d: number) => log.push(['call', 'applyTalentProcs', p.id, m.id, b, d]),
        awardExp: (p: any, n: number) => log.push(['call', 'awardExp', p.id, n]),
        awardJobExp: (p: any, n: number) => log.push(['call', 'awardJobExp', p.id, n]),
        spawnGroundItem: (...a: any[]) => log.push(['call', 'spawnGroundItem', ...plain(a)]),
        broadcastSystemMessage: (m: string) => log.push(['call', 'broadcastSystemMessage', m]),
        countDungeonProgress: (m: any, inst: any, k: any) => log.push(['call', 'countDungeonProgress', m.id, inst, k && k.id]),
        addCorpse: (m: any, z: string, i: any) => log.push(['call', 'addCorpse', m.id, z, i]),
        bossMech: { onDeath: (m: any, z: string, i: any) => log.push(['call', 'bossMech.onDeath', m.id, z, i]) },
        onRaidBossDeath: (m: any, k: any) => log.push(['call', 'onRaidBossDeath', m.id, k && k.id]),
        onRiftMobDeath: (inst: any, m: any, k: any) => log.push(['call', 'onRiftMobDeath', inst.id, m.id, k && k.id]),
        completeDungeonRun: (p: any) => log.push(['call', 'completeDungeonRun', p.id]),
        rollBossSpLoot: (inst: any, lvl: number) => log.push(['call', 'rollBossSpLoot', inst.id, lvl]),
        scheduleVolatileBurst: (inst: any, m: any) => log.push(['call', 'scheduleVolatileBurst', inst.id, m.id]),
        partyExpSharers: (k: any) => (opts.sharers ? opts.sharers(k) : [k]),
        ...(opts.props || {}),
      });
      if (typeof fake.initSystems === 'function') fake.initSystems();
      return { fake, log, players, mobsMap };
    }
    const rec = (name: string, w: any, extra: any = {}) => { got[name] = { log: plain(w.log), players: plain(Object.fromEntries(w.players)), mobs: plain(Object.fromEntries(w.mobsMap)), projectiles: plain(w.fake.projectiles), ...extra }; };
    const setPieces = (setId: string) => { const eq: any = {}; for (const pid of (I.ARMOR_SETS as any)[setId].pieces) eq[(I.ITEMS as any)[pid].slot] = structuredClone((I.ITEMS as any)[pid]); return eq; };

    // ---- meleeSweep
    { const w = world('sweep'); got.sweep = [w.fake.meleeSweep({}), w.fake.meleeSweep({ attackRange: 3 }), w.fake.meleeSweep({ weaponPower: { sweepReach: 2, sweepArc: 200 } }), w.fake.meleeSweep({ weaponPower: {} })]; }

    // ---- setDamageMult / checkSecondWind
    { const w = world('setmult'); got.setMult = [w.fake.setDamageMult({}, mob('a', 0, 0)), w.fake.setDamageMult({ set2: { emberheart: { dmgVsBurning: 0.2 } } }, mob('a', 0, 0, { burnTimer: 2 })), w.fake.setDamageMult({ set2: { emberheart: { dmgVsBurning: 0.2 } } }, mob('a', 0, 0)), w.fake.setDamageMult({ eclipsePhase: 'dusk', set4: { eclipse: { duskDmg: 0.15 } } }, mob('a', 0, 0)), w.fake.setDamageMult({ eclipsePhase: 'dawn', set4: { eclipse: { duskDmg: 0.15 } } }, mob('a', 0, 0))]; }
    got.secondWind = {};
    const sw = (label: string, extra: any) => { const p = hero({ set4: { wayfarer: { hpThreshold: 0.4, cooldown: 30, shieldPct: 0.2, hasteSec: 3 } }, statusEffects: [{ type: 'chill' }, { type: 'burn' }], speedFactor: 0.5, ...extra }); const w = world('sw ' + label, { players: [p] }); w.fake.checkSecondWind(p, 'frostfell'); got.secondWind[label] = { p: plain(p), log: plain(w.log) }; };
    sw('triggers', { hp: 100 }); sw('above threshold', { hp: 290 }); sw('on cooldown', { hp: 50, secondWindReadyAt: NOW + 1000 }); sw('dead', { hp: 50, isDead: true }); sw('zero hp', { hp: 0 }); sw('no statuses', { hp: 50, statusEffects: undefined }); sw('no wayfarer', { hp: 50, set4: {} });

    // ---- spawnProjectile / applyProjectileSplash
    got.projectiles = {};
    const proj = (label: string, caster: any, args: any[]) => { const w = world('proj ' + label, { players: [caster] }); w.fake.spawnProjectile(caster, ...args); got.projectiles[label] = { projectiles: plain(w.fake.projectiles), log: plain(w.log), next: w.fake.nextEntityId }; };
    proj('mob target', hero({ equipment: { weapon: { element: 'fire' } } }), [14, 10, 'm1', 'mob', 80, { splash: 0.3, crit: true }]);
    proj('point', hero(), [10, 14, null, 'point', 60]);
    proj('zero distance uses facing', hero({ facing: 'NW' }), [10, 10, null, 'point', 60]);
    proj('unknown facing', hero({ facing: 'weird' }), [undefined, undefined, null, 'point', 60]);
    proj('transformed', hero({ spTransformed: true, equipment: { sp: { cardId: 'sp_storm_herald' } } }), [12, 12, 'm', 'mob', 5, {}]);
    proj('in a dungeon instance', hero({ zone: 'dungeon', dungeonInstanceId: 'inst7' }), [12, 12, 'm', 'mob', 5, {}]);
    proj('in a dungeon without an instance', hero({ zone: 'dungeon' }), [12, 12, 'm', 'mob', 5, {}]);
    {
      const caster = hero(); const m1 = mob('m1', 20, 20), m2 = mob('m2', 21, 20), m3 = mob('m3', 40, 40), m4 = mob('m4', 21, 21, { state: 'dead' });
      for (const [label, damage, splash] of [['ordinary', 100, 0.3], ['tiny', 1, 0.1]] as any[]) {
        const w = world('splash ' + label, { players: [caster], mobs: [m1, m2, m3, m4] });
        w.fake.applyProjectileSplash(caster, { damage, splash }, structuredClone(m1) && w.mobsMap.get('m1'), w.mobsMap); rec('splash ' + label, w);
      }
    }

    // ---- applyDamageToMob: a grid of attackers and targets
    const dmg = (name: string, p: any, m: any, base = 200, crit = false, echo = false, opts: any = {}) => {
      const w = world('dmg ' + name, { players: [p], mobs: [m, ...(opts.others || [])], ...opts });
      let threw: any = null; try { w.fake.applyDamageToMob(p, m, base, crit, echo); } catch (e: any) { threw = String(e && e.message); }
      rec('dmg ' + name, w, { threw });
    };
    const wRune = (sockets: any[], element?: string) => ({ weapon: { id: 'iron_blade', type: 'equipment', slot: 'weapon', sockets, maxSockets: sockets.length, element } });
    for (let s = 0; s < 6; s++) dmg(`plain ${s}`, hero(), mob('m1', 11, 11));
    dmg('crit', hero({ critDmgBonus: 0.3 }), mob('m1', 11, 11), 200, true);
    dmg('weapon element strong', hero({ equipment: { weapon: { element: 'fire' } } }), mob('m1', 11, 11, { element: 'ice' }));
    dmg('weapon element weak', hero({ equipment: { weapon: { element: 'fire' } } }), mob('m1', 11, 11, { element: 'fire', elementResist: { fire: 0.8 } }));
    dmg('card element', hero({ spTransformed: true, equipment: { sp: { cardId: 'sp_frost_templar' } } }), mob('m1', 11, 11, { element: 'fire' }));
    dmg('flame runes', hero({ equipment: wRune(['rune_flame', 'rune_flame']) }), mob('m1', 11, 11));
    dmg('tempest runes', hero({ equipment: wRune(['rune_tempest']) }), mob('m1', 11, 11));
    for (let s = 0; s < 6; s++) dmg(`frost runes ${s}`, hero({ equipment: wRune(['rune_frost', 'rune_frost']) }), mob('m1', 11, 11));
    dmg('frost rune on boss', hero({ equipment: wRune(['rune_frost', 'rune_frost', 'rune_frost']) }), mob('m1', 11, 11, { isBoss: true }));
    dmg('frost rune on frozen', hero({ equipment: wRune(['rune_frost']) }), mob('m1', 11, 11, { frozenTimer: 1, frozenKind: 'stasis' }));
    dmg('vampiric runes', hero({ equipment: wRune(['rune_vampiric', 'rune_vampiric']) }), mob('m1', 11, 11));
    dmg('vampiric text throttled', hero({ equipment: wRune(['rune_vampiric']), _lastRuneLeechText: NOW - 100 }), mob('m1', 11, 11));
    dmg('banner in range', hero({ banner: { until: NOW + 5000, zone: 'frostfell', instanceId: null, x: 10, y: 10, r: 5, bonus: 0.25 } }), mob('m1', 11, 11));
    dmg('banner out of range', hero({ banner: { until: NOW + 5000, zone: 'frostfell', instanceId: null, x: 90, y: 90, r: 5, bonus: 0.25 } }), mob('m1', 11, 11));
    dmg('shatter on chilled', hero({ talentProcs: { shatterBonus: 0.3 } }), mob('m1', 11, 11, { chillTimer: 2 }));
    dmg('shatter on warm', hero({ talentProcs: { shatterBonus: 0.3 } }), mob('m1', 11, 11));
    dmg('set2 emberheart on burning', hero({ set2: { emberheart: { dmgVsBurning: 0.25 } } }), mob('m1', 11, 11, { burnTimer: 3 }));
    for (const lvl of [30, 40, 43, 44, 47, 48, 59, 60]) dmg(`level gap mob ${lvl}`, hero(), mob('m1', 11, 11, { level: lvl }), 200, true);
    dmg('noLevelGap mob', hero(), mob('m1', 11, 11, { level: 90, noLevelGap: true }), 200, true);
    dmg('fortified', hero(), mob('m1', 11, 11, { buffs: ['fortified'] }));
    dmg('commander buff', hero(), mob('m1', 11, 11, { hasCommanderBuff: true, def: 50 }));
    dmg('mob with big def', hero(), mob('m1', 11, 11, { def: 5000 }));
    dmg('shield partly', hero(), mob('m1', 11, 11, { shield: 30 }));
    dmg('shield breaks', hero(), mob('m1', 11, 11, { shield: 5 }), 200);
    dmg('shield breaks in dungeon', hero({ zone: 'dungeon', dungeonInstanceId: 'i1' }), mob('m1', 11, 11, { shield: 5 }), 200);
    dmg('shield vs deflected', hero(), mob('m1', 11, 11, { shield: 5, level: 70 }));
    dmg('doom brand', hero(), mob('m1', 11, 11, { doom: { owner: 'h1', until: NOW + 1000, stored: 5 } }));
    dmg('doom brand of another', hero(), mob('m1', 11, 11, { doom: { owner: 'zz', until: NOW + 1000, stored: 5 } }));
    dmg('doom brand expired', hero(), mob('m1', 11, 11, { doom: { owner: 'h1', until: NOW - 1, stored: 5 } }));
    dmg('raid boss', hero(), mob('m1', 11, 11, { isRaidBoss: true, fieldZone: 'frostfell' }));
    dmg('life steal', hero({ lifeSteal: 0.05 }), mob('m1', 11, 11));
    dmg('life steal capped', hero({ lifeSteal: 0.08, maxHp: 100 }), mob('m1', 11, 11), 50000);
    dmg('life steal text throttled', hero({ lifeSteal: 0.05, _lastLeechText: NOW - 50 }), mob('m1', 11, 11));
    dmg('echo hit', hero(), mob('m1', 11, 11), 200, false, true);
    dmg('still rising', hero(), mob('m1', 11, 11, { spawnUntil: NOW + 500 }));
    dmg('spawn finished', hero(), mob('m1', 11, 11, { spawnUntil: NOW - 1 }));
    dmg('no attacker (burn kill)', null as any, mob('m1', 11, 11, { fieldZone: 'frostfell' }));
    dmg('no attacker kills', null as any, mob('m1', 11, 11, { fieldZone: 'frostfell', hp: 3 }), 500);
    dmg('weak mob dies', hero(), mob('m1', 11, 11, { hp: 5 }), 500);
    dmg('weak mob dies as echo', hero(), mob('m1', 11, 11, { hp: 5 }), 500, false, true);
    dmg('transformed with passives', hero({ spTransformed: true, equipment: { sp: { cardId: 'sp_dragoon' } } }), mob('m1', 11, 11, { hp: 450, maxHp: 450 }));
    dmg('transformed, passive vs frozen', hero({ spTransformed: true, equipment: { sp: { cardId: 'sp_frost_templar' } } }), mob('m1', 11, 11, { frozenTimer: 2 }));
    dmg('set4 emberheart cascade', hero({ set4: { emberheart: { stacks: 1, dmgMult: 0.5, radius: 4, burnSec: 3, burnMult: 0.2 } }, set2: {} }), mob('m1', 11, 11), 200, false, false, { others: [mob('m2', 12, 11), mob('m3', 50, 50), mob('m4', 12, 12, { state: 'dead', hp: 0 })] });
    dmg('set4 emberheart building stacks', hero({ set4: { emberheart: { stacks: 5, dmgMult: 0.5, radius: 4, burnSec: 3, burnMult: 0.2 } } }), mob('m1', 11, 11));
    dmg('set4 stormcaller overload', hero({ staticStacks: 6, set4: { stormcaller: { stacks: 6, chains: 3, dmgMult: 0.6, range: 5, falloff: 0.2, cdCut: 0.5 } } }), mob('m1', 11, 11), 200, false, false, { others: [mob('m2', 12, 11), mob('m3', 14, 11), mob('m4', 16, 11), mob('m5', 18, 11)] });
    dmg('set4 stormcaller not charged', hero({ staticStacks: 1, set4: { stormcaller: { stacks: 6, chains: 3, dmgMult: 0.6, range: 5, falloff: 0.2, cdCut: 0.5 } } }), mob('m1', 11, 11));
    dmg('set4 eclipse dusk leech', hero({ eclipsePhase: 'dusk', set4: { eclipse: { duskLeech: 0.3, duskDmg: 0.15 } } }), mob('m1', 11, 11));
    dmg('set4 in a proc never chains', hero({ _inSetProc: true, set4: { emberheart: { stacks: 1, dmgMult: 0.5, radius: 4, burnSec: 3, burnMult: 0.2 } } }), mob('m1', 11, 11));
    dmg('set4 vs deflected', hero({ set4: { eclipse: { duskLeech: 0.3, duskDmg: 0.15 } }, eclipsePhase: 'dusk' }), mob('m1', 11, 11, { level: 70 }));

    // ---- applySetOnHit directly (all three bonuses, heal caps)
    got.setOnHit = {};
    const soh = (label: string, p: any, m: any, damage: number, others: any[] = []) => { const w = world('soh ' + label, { players: [p], mobs: [m, ...others] }); w.fake.applySetOnHit(p, m, damage); rec('soh ' + label, w); };
    soh('no set4', hero(), mob('m1', 11, 11), 100);
    soh('dusk heal capped', hero({ eclipsePhase: 'dusk', set4: { eclipse: { duskLeech: 5 } }, hp: 10 }), mob('m1', 11, 11), 500);
    soh('dusk heal minimum', hero({ eclipsePhase: 'dusk', set4: { eclipse: { duskLeech: 0.0001 } }, hp: 10 }), mob('m1', 11, 11), 3);
    soh('dawn no heal', hero({ eclipsePhase: 'dawn', set4: { eclipse: { duskLeech: 0.3 } }, hp: 10 }), mob('m1', 11, 11), 100);
    soh('chain with no neighbours', hero({ staticStacks: 2, set4: { stormcaller: { stacks: 2, chains: 2, dmgMult: 0.5, range: 3, falloff: 0.1, cdCut: 0.25 } } }), mob('m1', 11, 11), 100);
    soh('chain in a cluster', hero({ staticStacks: 2, set4: { stormcaller: { stacks: 2, chains: 2, dmgMult: 0.5, range: 3, falloff: 0.1, cdCut: 0.25 } }, skillCooldowns: { a: 3.33, b: 0 } }), mob('m1', 11, 11), 100, [mob('m2', 12, 11), mob('m3', 13, 11), mob('m4', 20, 20)]);
    soh('chain without cooldown table', hero({ staticStacks: 2, set4: { stormcaller: { stacks: 2, chains: 1, dmgMult: 0.5, range: 3, falloff: 0.1, cdCut: 0.25 } }, skillCooldowns: undefined }), mob('m1', 11, 11), 100, [mob('m2', 12, 11)]);
    soh('real full sets', hero({ set4: { emberheart: { stacks: 2, dmgMult: 1, radius: 3, burnSec: 2, burnMult: 0.1 }, stormcaller: { stacks: 1, chains: 1, dmgMult: 0.5, range: 4, falloff: 0.1, cdCut: 0.2 }, eclipse: { duskLeech: 0.2 } }, staticStacks: 3, eclipsePhase: 'dusk' }), mob('m1', 11, 11, { embers: { h1: 1 } }), 80, [mob('m2', 12, 12)]);

    // ---- chainBasicAttack
    got.chain = {};
    const chain = (label: string, extra: any) => {
      const skill = { id: 'sp_arc', chainAttack: { mp: 10, n: 4, jump: 3, decay: 0.7 }, element: 'lightning', color: '#0ff', cardId: 'sp_storm_herald' };
      const p = hero({ spToggles: { arc: { skill } }, mp: 30, critChanceBonus: 0, ...extra }); const m1 = mob('m1', 11, 11);
      const w = world('chain ' + label, { players: [p], mobs: [m1, mob('m2', 12, 11), mob('m3', 13, 11), mob('m4', 14.5, 11), mob('m5', 40, 40), mob('m6', 12, 12, { state: 'dead' })], props: { endSpToggle: (...a: any[]) => w.log.push(['call', 'endSpToggle', ...a.map((x: any) => (x && x.id) || x)]) } });
      const hits: any[] = []; w.fake.chainBasicAttack(p, m1, 100, w.mobsMap, (m: any, d: number, c: boolean) => hits.push([m.id, d, c]));
      rec('chain ' + label, w, { hits }); };
    chain('arcs', {}); chain('no toggle', { spToggles: {} }); chain('no toggle table', { spToggles: undefined }); chain('out of mana', { mp: 3 }); chain('cost mult', { manaCostMult: 2, mp: 15 }); chain('crit bonus', { critChanceBonus: 0.6 });

    // ---- handlePlayerAttack
    const atk = (name: string, p: any, target: any, opts: any = {}) => {
      const mobs = opts.mobs || [mob('m1', 11, 11), mob('m2', 11.5, 10.5), mob('m3', 9.5, 9.5), mob('m4', 10, 14), mob('m5', 30, 30), mob('m6', 11, 11.5, { state: 'dead', hp: 0 }), mob('m7', 11.2, 11.2, { spawnUntil: NOW + 500 })];
      const w = world('atk ' + name, { players: [p], mobs, ...opts });
      let threw: any = null; try { w.fake.handlePlayerAttack(opts.socketId || 'h1', target); } catch (e: any) { threw = String(e && e.message); }
      rec('atk ' + name, w, { threw });
    };
    const tgt = (id: string) => ({ targetType: 'mob', targetId: id });
    atk('no player', hero(), tgt('m1'), { socketId: 'zz' });
    atk('dead', hero({ isDead: true }), tgt('m1'));
    atk('cooldown active', hero({ attackCooldown: 5 }), tgt('m1'));
    for (let s = 0; s < 4; s++) atk(`warrior hits target ${s}`, hero(), tgt('m1'));
    atk('warrior crit bonus', hero({ critChanceBonus: 0.8 }), tgt('m1'));
    atk('warrior no target, facing cleave', hero({ facing: 'SE' }), null);
    atk('warrior cleave facing each way', hero({ facing: 'NW' }), null);
    atk('warrior swing at world point', hero(), { worldX: 14, worldY: 10 });
    atk('warrior target dead', hero(), tgt('m6'));
    atk('warrior target missing', hero(), tgt('nope'));
    atk('warrior target too far', hero(), tgt('m5'));
    atk('warrior target is a player type', hero(), { targetType: 'player', targetId: 'm1' });
    atk('warrior no swipe field uses 35', hero({ swipe: undefined }), tgt('m1'));
    atk('warrior zero swipe', hero({ swipe: 0 }), tgt('m1'));
    atk('warrior gatekeeper power', hero({ swipe: 0, weaponPower: { minSwipe: 60, sweepReach: 2, sweepArc: 200 } }), tgt('m1'));
    atk('warrior slow attack speed', hero({ attackSpeed: 0.1 }), tgt('m1'));
    atk('warrior fast attack speed', hero({ attackSpeed: 9 }), tgt('m1'));
    atk('warrior no attack speed field', hero({ attackSpeed: undefined, attackCooldown: undefined }), tgt('m1'));
    atk('warrior berserk lifesteal', hero({ berserkTimer: 5 }), tgt('m1'));
    atk('warrior bloodlust', hero({ bloodlust: { rage: 0.4, thirst: 2 } }), tgt('m1'));
    atk('warrior ambush', hero({ smokeScreenTimer: 3 }), tgt('m1'));
    atk('warrior moving by click stops', hero({ targetX: 20, targetY: 20, isMoving: true }), tgt('m1'));
    atk('warrior moving by keys keeps going', hero({ targetX: 20, targetY: 20, isMoving: true, moveDir: { dx: 1, dy: 0 } }), tgt('m1'));
    atk('warrior in a field zone', hero({ zone: 'frostfell' }), tgt('m1'), { field: 'frostfell' });
    atk('warrior in a field, world point', hero({ zone: 'frostfell' }), { worldX: 12, worldY: 12 }, { field: 'frostfell' });
    atk('warrior in a field, no target uses facing', hero({ zone: 'frostfell', facing: 'W' }), null, { field: 'frostfell' });
    atk('warrior in a field, zero distance', hero({ zone: 'frostfell' }), { worldX: 10, worldY: 10 }, { field: 'frostfell' });
    atk('mage in a field reaches farther', hero({ zone: 'frostfell', characterClass: 'mage', attackRange: 5 }), tgt('m1'), { field: 'frostfell' });
    atk('warrior with card leech', hero({ spTransformed: true, equipment: { sp: { cardId: 'sp_berserker' } } }), tgt('m1'));
    atk('warrior with chain conduit', hero({ spToggles: { arc: { skill: { id: 'sp_arc', chainAttack: { mp: 5, n: 3, jump: 3, decay: 0.8 } } } } }), tgt('m1'));
    atk('warrior transformed fx', hero({ spTransformed: true, equipment: { sp: { cardId: 'sp_dragoon' } } }), tgt('m1'));
    atk('mage target in range', hero({ characterClass: 'mage', attackRange: 5 }), tgt('m1'));
    atk('mage target out of range', hero({ characterClass: 'mage', attackRange: 1 }), tgt('m4'));
    atk('mage world point', hero({ characterClass: 'mage', attackRange: 5 }), { worldX: 13, worldY: 12 });
    atk('mage facing only', hero({ characterClass: 'mage', attackRange: 5, facing: 'N' }), null);
    atk('mage unknown facing', hero({ characterClass: 'mage', attackRange: 5, facing: 'weird' }), null);
    atk('mage crit', hero({ characterClass: 'mage', attackRange: 5, critChanceBonus: 1 }), tgt('m1'));
    atk('mage fire channel clicked first', hero({ characterClass: 'mage', attackRange: 5, weaponPower: { fireChannel: 3 } }), tgt('m1'));
    atk('mage fire channel no click', hero({ characterClass: 'mage', attackRange: 5, weaponPower: { fireChannel: 2 } }), null);
    atk('mage fire channel point only, nothing near', hero({ characterClass: 'mage', attackRange: 1, weaponPower: { fireChannel: 2 } }), { worldX: 50, worldY: 50 }, { mobs: [mob('m5', 30, 30)] });
    atk('mage fire channel nothing at all', hero({ characterClass: 'mage', attackRange: 1, weaponPower: { fireChannel: 2 } }), null, { mobs: [mob('m5', 30, 30)] });
    atk('rogue behaves like a melee hero', hero({ characterClass: 'rogue' }), tgt('m1'));

    // ---- handleMobDeath
    const die = (name: string, m: any, killer: any, opts: any = {}) => {
      const w = world('die ' + name, { players: killer ? [killer, ...(opts.extraPlayers || [])] : [], mobs: [m, ...(opts.others || [])], ...opts });
      let threw: any = null; try { w.fake.handleMobDeath(m, killer); } catch (e: any) { threw = String(e && e.message); }
      rec('die ' + name, w, { threw });
    };
    const k = (extra: any = {}) => hero({ zone: 'frostfell', ...extra });
    for (let s = 0; s < 8; s++) die(`normal mob ${s}`, mob('f1', 12, 12, { fieldZone: 'frostfell', level: 40 + s }), k());
    for (let s = 0; s < 6; s++) die(`boss ${s}`, mob('b1', 12, 12, { isBoss: true, level: 40, exp: 5000, gold: 900, fieldZone: 'frostfell' }), k());
    for (let s = 0; s < 6; s++) die(`miniboss ${s}`, mob('mb1', 12, 12, { isMiniboss: true, level: 40, fieldZone: 'frostfell' }), k({ characterClass: ['warrior', 'mage', 'rogue'][s % 3] }));
    for (let s = 0; s < 4; s++) die(`commander in dungeon ${s}`, mob('dungeon_c1', 12, 12, { isCommander: true, zone: 'dungeon' }), k({ zone: 'dungeon', dungeonInstanceId: 'i1' }), { instances: [['i1', { id: 'i1', mods: [] }]] });
    die('killer far above the level', mob('f1', 12, 12, { fieldZone: 'frostfell', level: 5 }), k({ level: 90 }));
    die('no killer, field mob', mob('f1', 12, 12, { fieldZone: 'frostfell' }), null);
    die('no killer, frost id', mob('frost_9', 12, 12), null);
    die('no killer, town', mob('town_9', 12, 12), null);
    die('raid boss', mob('r1', 12, 12, { isRaidBoss: true, isBoss: true }), k());
    die('rift mob', mob('rm1', 12, 12, { riftMob: true, riftInstanceId: 'rift1', level: 40 }), k({ zone: 'dungeon', dungeonInstanceId: 'rift1' }), { instances: [['rift1', { id: 'rift1', rift: { gateTurn: 1 } }]] });
    die('rift mob, instance gone', mob('rm1', 12, 12, { riftMob: true, riftInstanceId: 'gone' }), k());
    die('rift mob, not a rift instance', mob('rm1', 12, 12, { riftMob: true, riftInstanceId: 'i1' }), k(), { instances: [['i1', { id: 'i1' }]] });
    die('rift mob, no killer', mob('rm1', 12, 12, { riftMob: true, riftInstanceId: 'rift1' }), null, { instances: [['rift1', { id: 'rift1', rift: {} }]] });
    die('boss in dungeon completes the run', mob('dungeon_b', 12, 12, { isBoss: true, zone: 'dungeon', mechanics: 'boss', level: 40 }), k({ zone: 'dungeon', dungeonInstanceId: 'i1' }),
      { instances: [['i1', { id: 'i1', mods: ['volatile', 'swift'] }]], extraPlayers: [hero({ id: 'h2', zone: 'dungeon', dungeonInstanceId: 'i1', dungeonRun: { cleared: false } }), hero({ id: 'h3', zone: 'dungeon', dungeonInstanceId: 'i1', dungeonRun: { cleared: true } }), hero({ id: 'h4', zone: 'dungeon', dungeonInstanceId: 'other', dungeonRun: { cleared: false } })] });
    die('modded dungeon trash with volatile', mob('dungeon_v', 12, 12, { zone: 'dungeon' }), k({ zone: 'dungeon', dungeonInstanceId: 'i1' }), { instances: [['i1', { id: 'i1', mods: ['volatile'] }]] });
    die('mechanics boss', mob('f_boss', 12, 12, { isBoss: true, mechanics: 'boss', fieldZone: 'frostfell' }), k());
    die('poisoned mob spreads', mob('f1', 12, 12, { fieldZone: 'frostfell', poisonStacks: 3, poisonTimer: 4 }), k(), { others: [mob('n1', 13, 12), mob('n2', 40, 40), mob('n3', 13, 13, { state: 'dead' })] });
    die('poison timer only', mob('f1', 12, 12, { fieldZone: 'frostfell', poisonTimer: 4 }), k(), { others: [mob('n1', 13, 12)] });
    die('shadow mark resets dash', mob('f1', 12, 12, { fieldZone: 'frostfell', shadowMarkTimer: 3 }), k());
    die('shadow mark, dash ready', mob('f1', 12, 12, { fieldZone: 'frostfell', shadowMarkTimer: 3 }), k({ skillCooldowns: { dash: 0 } }));
    die('shadow mark, no cooldowns', mob('f1', 12, 12, { fieldZone: 'frostfell', shadowMarkTimer: 3 }), k({ skillCooldowns: undefined }));
    die('talent heal and mana', mob('f1', 12, 12, { fieldZone: 'frostfell' }), k({ talentKill: { hp: 0.05, mp: 0.1 }, hp: 10, mp: 5 }));
    die('talent heal at full hp', mob('f1', 12, 12, { fieldZone: 'frostfell' }), k({ talentKill: { hp: 0.05, mp: 0.1 }, hp: 300, mp: 100 }));
    die('party shares exp', mob('f1', 12, 12, { fieldZone: 'frostfell', exp: 300 }), k(), { extraPlayers: [hero({ id: 'h2', level: 20 })], sharers: (kk: any) => [kk, { id: 'h2', level: 20 }] });
    die('transformed killer', mob('f1', 12, 12, { fieldZone: 'frostfell' }), k({ spTransformed: true, equipment: { sp: { cardId: 'sp_dragoon' } } }));
    die('killer with a run', mob('f1', 12, 12, { fieldZone: 'frostfell' }), k({ dungeonRun: { kills: 2 } }));
    die('mob without exp or gold', mob('f1', 12, 12, { fieldZone: 'frostfell', exp: 0, gold: 0 }), k());
    die('mob in a field with relics', mob('f1', 12, 12, { fieldZone: 'frostfell', level: 40 }), k(), { field: 'frostfell' });
    for (let s = 0; s < 8; s++) die(`dungeon trash ${s}`, mob('dungeon_t' + s, 12, 12, { zone: 'dungeon' }), k({ zone: 'dungeon', dungeonInstanceId: 'i1' }), { instances: [['i1', { id: 'i1', mods: [] }]] });

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
