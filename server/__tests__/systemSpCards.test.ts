// SP card system (equip, transform, loadouts, spellbook, enhance, exchange, fragments, job EXP, boss card loot,
// toggled auras): locked to a fixture captured BEFORE the methods moved out of GameServer. Real card data (the
// Crusader), stubbed helpers that are logged, seeded randomness, frozen clock. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemSpCards.json');
const NOW = 1700000000000;
const plain = (v: any): any => (v === undefined ? null : JSON.parse(JSON.stringify(v, (_k, x) => (x instanceof Map ? { __map: Array.from(x.entries()) } : x === Infinity ? '__Infinity__' : x))));

function seeded<T>(seed: number, fn: () => T): T {
  const realRandom = Math.random;
  let a = (seed * 2654435761) | 0; // mulberry32: neighbouring seeds give unrelated sequences
  Math.random = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try { return fn(); } finally { Math.random = realRandom; }
}

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // the server module imports the accountManager singleton
  const mod: any = await import('../gameServer');
  const GS = mod.default || mod.GameServer;
  const SP: any = await import('../spCards');
  const make = (props: any = {}) => {
    const fake: any = Object.create(GS.prototype);
    Object.assign(fake, props);
    if (typeof fake.initSystems === 'function') fake.initSystems();
    return fake;
  };
  return { dir, make, SP };
}

test('SP card system matches the pre-refactor fixture', async () => {
  const { dir, make, SP } = await load();
  const realNow = Date.now;
  Date.now = () => NOW;
  try {
    const card = SP.SP_CARDS.warrior[0]; // Crusader: unlocks sp_radiant_lance@5, sp_consecration@10, sp_halo_burst@15, sp_angel_step@20
    assert.equal(card.id, 'sp_crusader');
    const cardItem = (lvl = 0, extra: any = {}) => ({ id: 'sp_card_sp_crusader', cardId: 'sp_crusader', type: 'sp_card', slot: 'sp', cls: 'warrior', name: 'SP Card: Crusader', upgradeLevel: lvl, ...extra });
    const baseSkills = () => ({ slot1: 'whirlwind', slot2: 'earthshaker', slot3: 'colossus_strike', dash: 'blade_charge', runes: { slot1: 'none', slot2: 'none', slot3: 'none', dash: 'none' } });
    const hero = (over: any = {}) => ({
      id: 'h1', name: 'Hero', zone: 'town', x: 5, y: 5, characterClass: 'warrior', jobLevel: 10, level: 50, gold: 1e6, hp: 100, maxHp: 100, mp: 50, maxMp: 50, dmg: 100,
      spCooldown: 0, spTransformed: false, isDead: false, equippedSkills: baseSkills(),
      equipment: { weapon: null, sp: cardItem(0) }, inventory: { maxSlots: 150, items: [] }, ...over,
    });

    const got: any = { scenarios: {} };
    const run = (name: string, heroProps: any, seed: number, fn: (w: any) => any, o: any = {}) => {
      const log: any[] = [];
      const h = hero(heroProps);
      const others: any[] = (o.others || []).map((p: any) => ({ ...hero(), ...p }));
      const players = new Map<string, any>([[h.id, h], ...others.map((p: any) => [p.id, p] as [string, any])]);
      const sockets = new Map<string, any>([...players.keys()].filter(id => o.noSocket !== id).map(id => [id, { emit: (ev: string, d: any) => log.push([id, ev, plain(d)]) }]));
      const gs = make({
        players, io: { sockets: { sockets } },
        emitZone: (...a: any[]) => log.push(['zone', ...plain(a)]),
        broadcastSystemMessage: (t: string) => log.push(['system', t]),
        sendDirectMessage: (id: string, t: string) => log.push(['dm', id, t]),
        recalculatePlayerStats: (p: any) => log.push(['recalc', p.id]),
        savePlayerAccount: (id: string) => log.push(['save', id]),
        giveLootToPlayer: (p: any, entry: any, flag: any) => log.push(['loot', p.id, plain(entry), flag]),
        getMobsMap: () => new Map((o.mobs || []).map((m: any) => [m.id, m])),
        applyDamageToMob: (p: any, m: any, dmg: number, crit: boolean) => { log.push(['hit', m.id, dmg, crit]); m.hp -= o.hitDamage ?? 10; },
        cardPassiveLeech: (p: any, dealt: number) => log.push(['leech', dealt]),
        bloodRage: () => o.rage ?? 1,
        ...(o.props || {}),
      });
      const result = seeded(seed, () => fn({ gs, h, players, log }));
      got.scenarios[name] = { result: plain(result), hero: plain(h), others: plain(others), log };
    };

    // ---- fragments
    const frag = (count: any) => ({ id: 'spirit_fragment', ...(count === undefined ? {} : { count }) });
    run('fragments', { inventory: { maxSlots: 150, items: [frag(5)] } }, 1, ({ gs, h }) => {
      const r: any = { count: gs.fragmentCount(h) };
      gs.spendFragments(h, 2); r.afterSpend2 = gs.fragmentCount(h);
      gs.spendFragments(h, 3); r.afterSpendAll = gs.fragmentCount(h); r.bag = plain(h.inventory.items);
      gs.spendFragments(h, 1); r.noStack = gs.fragmentCount(h);
      return r;
    });
    run('fragmentsNoCountField', { inventory: { maxSlots: 150, items: [frag(undefined)] } }, 2, ({ gs, h }) => { const c = gs.fragmentCount(h); gs.spendFragments(h, 1); return { c, left: plain(h.inventory.items) }; });
    run('fragmentsOverspend', { inventory: { maxSlots: 150, items: [frag(2)] } }, 3, ({ gs, h }) => { gs.spendFragments(h, 9); return { left: plain(h.inventory.items) }; });

    // ---- job EXP
    run('jobExpNothing', {}, 4, ({ gs, h }) => { gs.awardJobExp(h, 0); gs.awardJobExp(h, undefined); });
    run('jobExpNoLevelUp', { jobExp: 0 }, 5, ({ gs, h }) => gs.awardJobExp(h, 5));
    run('jobExpLevelsUpOnce', { jobExp: 0 }, 6, ({ gs, h }) => gs.awardJobExp(h, SP.jobExpToNext(10) + 3));
    run('jobExpLevelsUpManyTimes', { jobExp: 0, jobLevel: 1 }, 7, ({ gs, h }) => gs.awardJobExp(h, 1e7));
    run('jobExpAtMax', { jobLevel: SP.JOB_MAX_LEVEL, jobExp: 7 }, 8, ({ gs, h }) => gs.awardJobExp(h, 500));
    run('jobExpJustReachesMax', { jobLevel: SP.JOB_MAX_LEVEL - 1, jobExp: 0 }, 9, ({ gs, h }) => gs.awardJobExp(h, 1e9));
    run('jobExpNoJobLevelField', { jobLevel: undefined, jobExp: undefined }, 10, ({ gs, h }) => gs.awardJobExp(h, 40));

    // ---- equipping
    const bagWith = (...items: any[]) => ({ inventory: { maxSlots: 150, items } });
    run('equipSuccess', { equipment: { weapon: null, sp: null }, ...bagWith({ id: 'x' }, cardItem(3), { id: 'y' }) }, 11, ({ gs, h }) => gs.equipSpCard(h, 1));
    run('equipSwapsOldCardToBag', { equipment: { weapon: null, sp: cardItem(7, { id: 'old' }) }, ...bagWith(cardItem(3)) }, 12, ({ gs, h }) => gs.equipSpCard(h, 0));
    run('equipWhileTransformedUntransforms', { spTransformed: true, baseEquippedSkills: baseSkills(), ...bagWith(cardItem(3)) }, 13, ({ gs, h }) => gs.equipSpCard(h, 0));
    run('equipNotACard', bagWith({ id: 'rock', cardId: 'nope' }), 14, ({ gs, h }) => { gs.equipSpCard(h, 0); gs.equipSpCard(h, 5); });
    run('equipWrongClass', { characterClass: 'mage', ...bagWith(cardItem(0)) }, 15, ({ gs, h }) => gs.equipSpCard(h, 0));
    run('equipJobLevelTooLow', { jobLevel: 3, ...bagWith(cardItem(0)) }, 16, ({ gs, h }) => gs.equipSpCard(h, 0));
    run('equipNoSocket', { equipment: { weapon: null, sp: null }, ...bagWith(cardItem(0)) }, 17, ({ gs, h }) => gs.equipSpCard(h, 0), { noSocket: 'h1' });

    // ---- transform button
    run('transformOn', {}, 18, ({ gs }) => gs.handleSpTransform('h1'));
    run('transformOff', {}, 19, ({ gs, h }) => { gs.handleSpTransform('h1'); h.spCooldown = 0; gs.handleSpTransform('h1'); });
    run('transformOnCooldown', { spCooldown: 1.2 }, 20, ({ gs }) => gs.handleSpTransform('h1'));
    run('transformNoCard', { equipment: { weapon: null, sp: null } }, 21, ({ gs }) => gs.handleSpTransform('h1'));
    run('transformJobTooLow', { jobLevel: 2 }, 22, ({ gs }) => gs.handleSpTransform('h1'));
    run('transformDeadOrUnknown', { isDead: true }, 23, ({ gs }) => { gs.handleSpTransform('h1'); gs.handleSpTransform('nobody'); });
    run('transformOffWorksBelowJobLevel', { jobLevel: 2, spTransformed: true, baseEquippedSkills: baseSkills() }, 24, ({ gs }) => gs.handleSpTransform('h1'));
    run('transformNoSocket', {}, 25, ({ gs }) => gs.handleSpTransform('h1'), { noSocket: 'h1' });

    // ---- setTransformed
    run('setTransformedOnKeepsRunes', { equippedSkills: { ...baseSkills(), runes: { slot1: 'flame', slot2: 'none', slot3: 'frost', dash: 'none' } } }, 26, ({ gs, h }) => { gs.setTransformed(h, true); return { base: plain(h.baseEquippedSkills) }; });
    run('setTransformedNoopCases', { equipment: { weapon: null, sp: null } }, 27, ({ gs, h }) => { gs.setTransformed(h, true); gs.setTransformed(h, false); });
    run('setTransformedOffRestores', { spTransformed: true, baseEquippedSkills: { ...baseSkills(), slot1: 'base_pick' }, equippedSkills: { slot1: 'sp_holy_cleave' } }, 28, ({ gs, h }) => gs.setTransformed(h, false));
    run('setTransformedOffWithoutBase', { spTransformed: true, baseEquippedSkills: null }, 29, ({ gs, h }) => gs.setTransformed(h, false));
    run('setTransformedOnNoEquippedSkills', { equippedSkills: undefined }, 30, ({ gs, h }) => { gs.setTransformed(h, true); return { base: plain(h.baseEquippedSkills) }; });
    run('setTransformedEnhancedCard', { equipment: { weapon: null, sp: cardItem(25) } }, 31, ({ gs }) => gs.setTransformed({ ...hero({ equipment: { weapon: null, sp: cardItem(25) } }) }, true));

    // ---- loadout
    const lo = (name: string, heroProps: any, seed = 40) => run(name, heroProps, seed, ({ gs, h }) => ({ out: gs.spLoadout(h, card), stored: plain(h.spLoadouts) }));
    lo('loadoutDefaults', {});
    lo('loadoutKeepsValidPicks', { equipment: { weapon: null, sp: cardItem(25) }, spLoadouts: { sp_crusader: { slot1: 'sp_consecration', slot2: 'sp_radiant_lance', slot3: 'sp_halo_burst', dash: 'sp_angel_step', kit: 0 } } });
    lo('loadoutLockedFallsBack', { equipment: { weapon: null, sp: cardItem(6) }, spLoadouts: { sp_crusader: { slot1: 'sp_consecration', slot2: 'sp_radiant_lance', slot3: 'sp_halo_burst', dash: 'sp_angel_step', kit: 0 } } });
    lo('loadoutOldKitStartsOver', { equipment: { weapon: null, sp: cardItem(25) }, spLoadouts: { sp_crusader: { slot1: 'sp_consecration', kit: 4 } } });
    lo('loadoutWrongSlotType', { equipment: { weapon: null, sp: cardItem(25) }, spLoadouts: { sp_crusader: { slot1: 'sp_angel_step', dash: 'sp_judgement', kit: 0 } } });
    lo('loadoutUnknownSkillIds', { equipment: { weapon: null, sp: cardItem(25) }, spLoadouts: { sp_crusader: { slot1: 'not_in_arsenal', slot2: 'whirlwind', kit: 0 } } });
    lo('loadoutNoEquippedCard', { equipment: { weapon: null } });

    // ---- spellbook (customize)
    const cu = (name: string, data: any, heroProps: any = {}, seed = 50) => run(name, { equipment: { weapon: null, sp: cardItem(25) }, ...heroProps }, seed, ({ gs, h }) => { gs.customizeSpSkill(h, data); return { loadouts: plain(h.spLoadouts) }; });
    cu('customSetSkill', { slot: 'slot1', skillId: 'sp_consecration' });
    cu('customSwapsWithOtherSlot', { slot: 'slot1', skillId: 'sp_judgement' });
    cu('customSetDash', { slot: 'dash', skillId: 'sp_angel_step' });
    cu('customLocked', { slot: 'slot2', skillId: 'sp_halo_burst' }, { equipment: { weapon: null, sp: cardItem(2) } });
    cu('customDashInNormalSlot', { slot: 'slot1', skillId: 'sp_angel_step' });
    cu('customNormalInDashSlot', { slot: 'dash', skillId: 'sp_consecration' });
    cu('customUnknownSkill', { slot: 'slot1', skillId: 'nope' });
    cu('customNotInArsenal', { slot: 'slot1', skillId: 'sp_storm_bolt' });
    cu('customRuneOnly', { slot: 'slot2', rune: 'flame' }, { baseEquippedSkills: baseSkills() });
    cu('customRuneUnknown', { slot: 'slot2', rune: 'not_a_rune' });
    cu('customSkillAndRune', { slot: 'slot3', skillId: 'sp_consecration', rune: 'frost' });
    cu('customBadSlot', { slot: 'slot9', skillId: 'sp_consecration' });
    cu('customNoData', null);
    cu('customNoCard', { slot: 'slot1', skillId: 'sp_consecration' }, { equipment: { weapon: null, sp: null } });

    // ---- enhance
    const en = (name: string, data: any, heroProps: any = {}, seed = 60, o: any = {}) => run(name, { gold: 1e6, equipment: { weapon: null, sp: cardItem(0) }, inventory: { maxSlots: 150, items: [frag(500), cardItem(10, { id: 'bagcard' })] }, ...heroProps }, seed, ({ gs, h }) => gs.handleSpCardEnhance('h1', data), o);
    en('enhanceEquippedSuccess', { target: 'equipped' }, {}, 61);
    en('enhanceBagCard', { target: 'bag', itemIndex: 1 }, {}, 62);
    en('enhanceNotInTown', { target: 'equipped' }, { zone: 'wildwood' });
    en('enhanceDead', { target: 'equipped' }, { isDead: true });
    en('enhanceNoData', null);
    en('enhanceNoItem', { target: 'bag', itemIndex: 9 });
    en('enhanceNotACard', { target: 'bag', itemIndex: 0 });
    en('enhanceMaxLevel', { target: 'equipped' }, { equipment: { weapon: null, sp: cardItem(SP.SP_MAX_LEVEL) } });
    en('enhanceNoGold', { target: 'equipped' }, { gold: 10 });
    en('enhanceNoFragments', { target: 'equipped' }, { inventory: { maxSlots: 150, items: [] } });
    en('enhanceTransformedRefresh', { target: 'equipped' }, { spTransformed: true }, 63);
    // many tries at +55 (past the safe level): successes and downgrades
    for (let i = 0; i < 12; i++) en('enhanceRisky_' + i, { target: 'equipped' }, { equipment: { weapon: null, sp: cardItem(55) } }, 70 + i);
    for (let i = 0; i < 4; i++) en('enhanceSafeLevel_' + i, { target: 'equipped' }, { equipment: { weapon: null, sp: cardItem(30) } }, 90 + i);
    for (let i = 0; i < 6; i++) en('enhanceTo70_' + i, { target: 'equipped' }, { equipment: { weapon: null, sp: cardItem(69) } }, 100 + i);
    en('enhanceNoSocket', { target: 'equipped' }, {}, 61, { noSocket: 'h1' });

    // ---- exchange
    const ex = (name: string, data: any, heroProps: any = {}, seed = 120, o: any = {}) => run(name, { gold: 1e6, inventory: { maxSlots: 150, items: [frag(1000)] }, ...heroProps }, seed, ({ gs, h }) => gs.handleSpCardExchange('h1', data), o);
    ex('exchangeSuccess', { cardId: 'sp_crusader' });
    ex('exchangeHighTier', { cardId: 'sp_dread_lord' });
    ex('exchangeWrongClass', { cardId: 'sp_crusader' }, { characterClass: 'mage' });
    ex('exchangeUnknownCard', { cardId: 'nope' });
    ex('exchangeNoFragments', { cardId: 'sp_berserker' }, { inventory: { maxSlots: 150, items: [frag(3)] } });
    ex('exchangeNoGold', { cardId: 'sp_berserker' }, { gold: 5 });
    ex('exchangeBagFull', { cardId: 'sp_crusader' }, { inventory: { maxSlots: 2, items: [frag(1000), { id: 'x' }] } });
    ex('exchangeNotInTown', { cardId: 'sp_crusader' }, { zone: 'wildwood' });
    ex('exchangeNoData', null);

    // ---- boss card loot
    const roster = [
      { id: 'a', name: 'Ann', zone: 'dungeon', dungeonInstanceId: 'inst1', level: 30, characterClass: 'warrior' },
      { id: 'b', name: 'Ben', zone: 'dungeon', dungeonInstanceId: 'inst1', level: 30, characterClass: 'mage' },
      { id: 'c', name: 'Cy', zone: 'dungeon', dungeonInstanceId: 'other', level: 30, characterClass: 'rogue' },
      { id: 'd', name: 'Di', zone: 'town', level: 30, characterClass: 'warrior' },
      { id: 'e', name: 'Ed', zone: 'dungeon', dungeonInstanceId: 'inst1', level: 99, characterClass: 'warrior' },
    ];
    for (let i = 0; i < 10; i++) run('bossLoot_' + i, { zone: 'dungeon', dungeonInstanceId: 'inst1', level: 30 }, 200 + i, ({ gs }) => gs.rollBossSpLoot({ id: 'inst1', floor: 1 + (i % 6), difficulty: i % 2 ? 'hard' : 'nightmare' }, 25), { others: roster });
    run('bossLootNobodyThere', { zone: 'town' }, 230, ({ gs }) => gs.rollBossSpLoot({ id: 'inst1', floor: 3, difficulty: 'normal' }, 25));

    // ---- toggled auras
    const toggle = (id: string, over: any = {}) => ({ skill: { id, name: id + ' aura', r: 4, dmgMult: 2, every: 1, element: 'dark', color: '#f00', cardId: 'sp_x', ...over }, clock: 0 });
    const mobsAround = () => [{ id: 'm1', x: 6, y: 5, hp: 100, state: 'idle' }, { id: 'm2', x: 5, y: 7, hp: 100, state: 'idle' }, { id: 'm3', x: 30, y: 5, hp: 100, state: 'idle' }, { id: 'm4', x: 5.5, y: 5, hp: 100, state: 'dead' }, { id: 'm5', x: 8, y: 5, hp: 100, state: 'idle' }];
    const tg = (name: string, heroProps: any, toggles: Record<string, any>, ticks: number, o: any = {}, dt = 0.5) => run(name, { spTransformed: true, equippedSkills: { slot1: 'tgl_a', slot2: 'tgl_b', slot3: 'tgl_c', dash: 'tgl_d' }, spToggles: toggles, ...heroProps }, 300, ({ gs, h }) => {
      const r: number[] = []; for (let i = 0; i < ticks; i++) r.push(Number(gs.tickSpToggles(h, dt))); return { ret: r, toggles: Object.keys(h.spToggles) };
    }, { mobs: mobsAround(), ...o });
    tg('toggleNoToggles', {}, {}, 1);
    tg('toggleNotTransformedEnds', { spTransformed: false }, { tgl_a: toggle('tgl_a') }, 1);
    tg('toggleNotInLoadoutEnds', {}, { not_equipped: toggle('not_equipped') }, 1);
    tg('toggleStrikesOnInterval', {}, { tgl_a: toggle('tgl_a') }, 4);
    tg('toggleStrikesWithRage', {}, { tgl_a: toggle('tgl_a') }, 2, { rage: 1.5 });
    tg('toggleBurnAndChill', {}, { tgl_a: toggle('tgl_a', { burn: 3, chill: 2 }) }, 2);
    tg('toggleSkyStrike', {}, { tgl_a: toggle('tgl_a', { skyStrike: 2 }) }, 2);
    tg('toggleSpinLeech', {}, { tgl_a: toggle('tgl_a', { spin: true }) }, 2, { hitDamage: 7 });
    tg('toggleHpDrain', { hp: 100, maxHp: 100 }, { tgl_a: toggle('tgl_a', { drain: 0.1, dmgMult: 0 }) }, 3);
    tg('toggleHpDrainFadesAtLow', { hp: 12, maxHp: 100 }, { tgl_a: toggle('tgl_a', { drain: 0.05, dmgMult: 0 }), tgl_b: toggle('tgl_b') }, 2);
    tg('toggleMpDrain', {}, { tgl_a: toggle('tgl_a', { mpDrain: 0.1, dmgMult: 0 }) }, 3);
    tg('toggleMpDrainRunsOut', { mp: 4, maxMp: 50 }, { tgl_a: toggle('tgl_a', { mpDrain: 0.2, dmgMult: 0 }), tgl_b: toggle('tgl_b', { drain: 0.01, dmgMult: 0 }) }, 2);
    tg('toggleGodModeNoUpkeep', { godMode: true, hp: 100, maxHp: 100 }, { tgl_a: toggle('tgl_a', { drain: 0.5, mpDrain: 0.5 }) }, 2);
    tg('toggleCritBonus', { critChanceBonus: 0.85 }, { tgl_a: toggle('tgl_a') }, 2);
    tg('toggleNoRadiusNoStrike', {}, { tgl_a: toggle('tgl_a', { r: 0 }), tgl_b: toggle('tgl_b', { dmgMult: 0 }) }, 3);
    tg('toggleTwoAuras', {}, { tgl_a: toggle('tgl_a', { every: 0.5 }), tgl_b: toggle('tgl_b', { every: 1.5, burn: 2 }) }, 4);
    run('endToggle', { spToggles: { tgl_a: toggle('tgl_a'), tgl_b: toggle('tgl_b') } }, 400, ({ gs, h }) => { gs.endSpToggle(h, 'tgl_a'); gs.endSpToggle(h, 'tgl_b', true); gs.endSpToggle(h, 'tgl_zzz'); return { left: Object.keys(h.spToggles) }; });
    run('endToggleNoToggles', {}, 401, ({ gs, h }) => gs.endSpToggle(h, 'tgl_a'));

    if (process.env.UPDATE_FIXTURES === '1') { fs.writeFileSync(FIXTURE, JSON.stringify(got, null, 2) + '\n', 'utf8'); return; }
    assert.deepEqual(plain(got), JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
  } finally {
    Date.now = realNow;
    await (await import('../accountManager')).default.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
