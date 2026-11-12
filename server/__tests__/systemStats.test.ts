// Stats system (recalculatePlayerStats, regen multiplier, rune counts, cosmetic effects): locked to a fixture captured
// BEFORE the methods moved out of GameServer. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemStats.json');
const NOW = 1700000000000;
const plain = (v: any): any => v === undefined ? null : JSON.parse(JSON.stringify(v, (_k, x) => (x instanceof Map ? { __map: Array.from(x.entries()) } : x instanceof Set ? { __set: Array.from(x.values()) } : x === Infinity ? '__Infinity__' : x)));
const sha = (v: any) => crypto.createHash('sha1').update(JSON.stringify(plain(v))).digest('hex').slice(0, 12);
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hashName = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // the server module imports the accountManager singleton
  const mod: any = await import('../gameServer');
  return { dir, GS: mod.default || mod.GameServer, I: await import('../items'), SP: await import('../spCards'), T: await import('../talents') };
}

test('stats methods match the pre-refactor fixture', async () => {
  const { dir, GS, I, SP, T } = await load();
  const realNow = Date.now, realRandom = Math.random;
  Date.now = () => NOW;
  try {
    const got: any = {};
    const ITEMS: any = I.ITEMS;
    const server = () => { const f: any = Object.create(GS.prototype); Object.assign(f, { emitZone: () => undefined }); if (typeof f.initSystems === 'function') f.initSystems(); return f; };
    const base = (cls = 'warrior', level = 1) => ({
      id: 'h1', characterClass: cls, level, hp: 9999, mp: 9999, equipment: {}, skills: {}, skillPoints: 0,
      baseStats: { maxHp: 200 + level * 20, maxMp: 100 + level * 15, dmg: 20 + level * 4, def: 5 + level * 2, speed: 4, attackSpeed: 1, swipe: 0, attackRange: 5 },
      maxHp: 1, maxMp: 1, dmg: 1, def: 1, speed: 1, attackRange: 5,
    });
    // run recalculatePlayerStats on a player (seeded) and return the whole resulting player
    const recalc = (name: string, p: any) => { Math.random = mulberry32(hashName(name)); const s = server(); s.recalculatePlayerStats(p); return plain(p); };
    const clone = (o: any) => structuredClone(o);

    // ---- guards
    { const s = server(); s.recalculatePlayerStats(null); s.recalculatePlayerStats(undefined); const p: any = { id: 'x', hp: 5 }; s.recalculatePlayerStats(p); got.guards = plain(p); }

    // ---- bare heroes: class x level, with and without a job level
    got.bare = {};
    for (const cls of ['warrior', 'mage', 'rogue']) for (const level of [1, 25, 80, 150]) for (const job of [undefined, 7]) {
      got.bare[`${cls} L${level} job${job}`] = recalc(`bare ${cls}${level}${job}`, { ...base(cls, level), jobLevel: job });
    }
    // hp / mp are clamped down to the new maximums, never raised
    got.clamp = { high: recalc('clamp high', { ...base(), hp: 99999, mp: 99999 }), low: recalc('clamp low', { ...base(), hp: 3, mp: 2 }) };

    // ---- every real equipment item worn alone (so every stat key, weapon power and resist is exercised)
    got.items = {};
    for (const it of Object.values(ITEMS).filter((i: any) => i.type === 'equipment') as any[]) {
      const p: any = { ...base('warrior', 40), equipment: { [it.slot]: clone(it) } };
      got.items[it.id] = sha(recalc('item ' + it.id, p));
    }
    // representative full snapshots of a few
    for (const id of ['iron_blade', 'gatekeeper_greatsword', 'sunfire_conduit']) got.items['full ' + id] = recalc('full ' + id, { ...base('warrior', 40), equipment: { [ITEMS[id].slot]: clone(ITEMS[id]) } });

    // ---- rolled gear in every slot (random affixes, resists, crit, regen and cdr), several seeds
    got.rolled = {};
    for (let seed = 1; seed <= 12; seed++) {
      const name = 'rolled ' + seed; Math.random = mulberry32(seed * 7919);
      const eq: any = {};
      for (const id of ['iron_blade', 'wayfarer_hood', 'wayfarer_longcoat', 'wayfarer_grips', 'wayfarer_treads'].concat(Object.values(ITEMS).filter((i: any) => ['cape', 'ring', 'amulet'].includes(i.slot)).map((i: any) => i.id).slice(0, 3))) {
        const g: any = I.generateRandomizedGear(id, 30 + seed * 10); if (g) eq[g.slot] = g;
      }
      const p: any = { ...base(['warrior', 'mage', 'rogue'][seed % 3], 30 + seed * 10), equipment: eq };
      got.rolled[name] = seed <= 3 ? recalc(name, p) : sha(recalc(name, p));
    }

    // ---- upgrades, reforge stats and attributes written on gear
    got.gearExtras = {};
    const sw = () => clone(ITEMS.iron_blade);
    const extras: any = {
      upgraded: { upgradeLevel: 9, bonusDmg: 60 }, reforged: { reforgeStats: { bonusDmg: 5, bonusDef: 2, bonusHp: 40, bonusMp: 10, bonusSpeed: 0.1, bonusAttackSpeed: 0.05, bonusSwipe: 8, critChance: 4, critDmg: 12 } },
      regenAndCdr: { hpRegen: 3.25, mpRegen: 1.5, cdr: 8 }, crit: { critChance: 10, critDmg: 25 }, resists: { elementResist: { fire: 0.9, ice: 0.1 } },
      attributes: { attrSlots: 3, attrs: [{ k: 'dmg', v: 7 }, { k: 'hp', v: 30 }, { k: 'critChance', v: 3 }] },
    };
    for (const [k, e] of Object.entries<any>(extras)) got.gearExtras[k] = recalc('extras ' + k, { ...base('warrior', 40), equipment: { weapon: { ...sw(), ...clone(e) } } });

    // ---- sockets and runes
    got.runes = {};
    const wRune = (sockets: any[]) => ({ ...sw(), maxSockets: sockets.length, sockets });
    const aRune = (sockets: any[]) => ({ ...clone(ITEMS.wayfarer_longcoat), maxSockets: sockets.length, sockets });
    const runes: any = {
      'weapon vampiric x2': { weapon: wRune(['rune_vampiric', 'rune_vampiric']) }, 'weapon flame frost tempest': { weapon: wRune(['rune_flame', 'rune_frost', 'rune_tempest', null]) },
      'weapon short ids': { weapon: wRune(['vampiric', 'flame']) }, 'weapon unknown rune': { weapon: wRune(['rune_mystery']) },
      'armor all kinds': { armor: aRune(['rune_bulwark', 'rune_aegis']), helmet: { ...clone(ITEMS.wayfarer_hood), maxSockets: 1, sockets: ['rune_swiftness'] } },
      'armor warding and renewal': { armor: aRune(['rune_warding', 'rune_renewal']), helmet: { ...clone(ITEMS.wayfarer_hood), maxSockets: 1, sockets: ['rune_warding'] } },
      'armor thorns': { armor: aRune(['rune_thorns', 'rune_thorns']) }, 'weapon rune in armor': { armor: aRune(['rune_flame']) }, 'armor rune in weapon': { weapon: wRune(['rune_bulwark']) },
      'item without socket fields': { weapon: sw(), armor: clone(ITEMS.wayfarer_longcoat) },
    };
    for (const [k, eq] of Object.entries<any>(runes)) got.runes[k] = recalc('rune ' + k, { ...base('warrior', 60), equipment: clone(eq) });

    // ---- armor sets: 1..4 pieces of each, and two sets mixed
    got.sets = {};
    for (const [setId, set] of Object.entries<any>(I.ARMOR_SETS)) for (let n = 1; n <= set.pieces.length; n++) {
      const eq: any = {}; for (const pid of set.pieces.slice(0, n)) eq[ITEMS[pid].slot] = clone(ITEMS[pid]);
      got.sets[`${setId} x${n}`] = recalc(`set ${setId}${n}`, { ...base('warrior', 60), equipment: eq });
    }
    { const eclipse = I.ARMOR_SETS.eclipse; const eq: any = {}; for (const pid of eclipse.pieces) eq[ITEMS[pid].slot] = clone(ITEMS[pid]);
      got.sets['eclipse x4 existing dusk'] = recalc('eclipse dusk', { ...base('warrior', 60), equipment: clone(eq), eclipsePhase: 'dusk', eclipseTimer: 3 });
      got.sets['eclipse x4 existing dawn'] = recalc('eclipse dawn', { ...base('warrior', 60), equipment: clone(eq), eclipsePhase: 'dawn', eclipseTimer: 3 });
      const half = { ...clone(eq) }; delete half.armor; delete half.helmet; delete half.gloves; delete half.boots;
      got.sets['eclipse broken up clears phase'] = recalc('eclipse broken', { ...base('warrior', 60), equipment: half, eclipsePhase: 'dusk' });
      const mixed: any = {}; for (const pid of [...I.ARMOR_SETS.wayfarer.pieces.slice(0, 2), ...I.ARMOR_SETS.emberheart.pieces.slice(0, 2)]) mixed[ITEMS[pid].slot] = clone(ITEMS[pid]);
      got.sets['two sets mixed'] = recalc('mixed sets', { ...base('warrior', 60), equipment: mixed }); }

    // ---- passive tree: walks of different lengths for each class
    const nodes: any[] = [...T.BY_ID.values()];
    const walk = (cls: string, n: number, preferBig = false) => {
      const owned: any = {};
      for (let i = 0; i < n; i++) {
        const cand = nodes.filter(x => !owned[x.id] && T.canAllocate(cls, owned, x.id)); if (!cand.length) break;
        const pick = (preferBig && cand.find(x => x.kind === 'notable' || x.kind === 'keystone')) || cand[(i * 7) % cand.length];
        owned[pick.id] = 1;
      }
      return owned;
    };
    got.passives = {};
    for (const cls of ['warrior', 'mage', 'rogue']) for (const [n, big] of [[5, false], [40, false], [120, true], [400, true]] as any[]) {
      const skills = walk(cls, n, big); const p = recalc(`passive ${cls}${n}`, { ...base(cls, 80), skills });
      got.passives[`${cls} ${n}${big ? ' big' : ''}`] = n === 40 ? p : sha(p);
    }
    got.passives.unknownNode = recalc('passive unknown', { ...base('mage', 10), skills: { nope: 1, p1: 0 } });
    got.passives.staleBuildRefunded = recalc('passive stale', { ...base('mage', 10), skills: { p999: 1, p1: 1 }, skillPoints: 2 });

    // ---- specialist cards and bloodlust
    got.cards = {};
    for (const c of Object.values(SP.CARD_BY_ID) as any[]) for (const [lvl, transformed] of [[0, true], [20, true], [20, false]] as any[]) {
      const p = recalc(`card ${c.id}${lvl}${transformed}`, { ...base(c.cls || 'warrior', 70), spTransformed: transformed, equipment: { sp: { cardId: c.id, upgradeLevel: lvl, type: 'sp_card' } } });
      got.cards[`${c.id} +${lvl} ${transformed ? 'on' : 'off'}`] = sha(p);
    }
    got.cardsFull = recalc('card full', { ...base('warrior', 70), spTransformed: true, equipment: { sp: { cardId: (Object.values(SP.CARD_BY_ID)[0] as any).id, upgradeLevel: 5 } } });
    got.bloodlust = { on: recalc('bloodlust', { ...base('warrior', 30), bloodlust: { atkSpeed: 0.4 } }), noValue: recalc('bloodlust none', { ...base('warrior', 30), bloodlust: {} }) };

    // ---- caps (crit, dodge, life steal) from a very strong tree
    { const skills = walk('rogue', 600, true); got.caps = recalc('caps', { ...base('rogue', 150), skills, equipment: { weapon: { ...sw(), critChance: 500, critDmg: 300 } } }); }

    // ---- mage energy shield
    got.shield = {
      mageFresh: recalc('es fresh', { ...base('mage', 50), es: undefined }), mageNull: recalc('es null', { ...base('mage', 50), es: null }),
      mageHigh: recalc('es high', { ...base('mage', 50), es: 99999 }), mageLow: recalc('es low', { ...base('mage', 50), es: 5 }),
      warrior: recalc('es warrior', { ...base('warrior', 50), es: 40, esMax: 40 }),
    };

    // ---- hpRegenMult
    { const s = server(); got.regenMult = [s.hpRegenMult({}), s.hpRegenMult({ set2: { wayfarer: { regenMult: 1.5 } } }), s.hpRegenMult({ set2: { wayfarer: {} } }), s.hpRegenMult({ armorRunes: { renewal: 2 } }), s.hpRegenMult({ set2: { wayfarer: { regenMult: 1.5 } }, armorRunes: { renewal: 3 } })]; }

    // ---- rune counts
    { const s = server(); got.runeCounts = {
      armor: plain([s.getArmorRuneCounts(null), s.getArmorRuneCounts({}), s.getArmorRuneCounts({ equipment: runes['armor all kinds'] && clone(runes['armor all kinds']) }), s.getArmorRuneCounts({ equipment: { armor: { sockets: 'bad' }, helmet: { sockets: [null, 'rune_aegis', 'sword'] } } })]),
      weapon: plain([s.getWeaponRuneCounts(null), s.getWeaponRuneCounts({ equipment: {} }), s.getWeaponRuneCounts({ equipment: { weapon: wRune(['rune_flame', 'rune_flame', 'frost', null, 'rune_vampiric']) } }), s.getWeaponRuneCounts({ equipment: { weapon: { sockets: 'bad' } } })]),
    }; }

    // ---- handleSetEffects (cosmetic trail)
    got.effects = {};
    const eff = (label: string, id: string, data: any, p: any = { id: 'h1', effects: { other: 1, trail: 'old' } }) => {
      const s = server(); s.players = new Map([['h1', p]]); s.handleSetEffects(id, data); got.effects[label] = plain(p);
    };
    eff('no player', 'zz', { trail: 'x' });
    eff('no data', 'h1', null);
    eff('not a string', 'h1', { trail: 4 });
    eff('unknown trail', 'h1', { trail: 'definitely_not_a_trail' });
    eff('clear', 'h1', {});
    eff('no effects yet', 'h1', {}, { id: 'h1' });
    { const T2: any = await import('../config/constants'); const real = [...(T2.TRAIL_IDS || [])][0]; eff('valid trail', 'h1', { trail: real }, { id: 'h1' }); got.effects.validTrailName = real; }

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
