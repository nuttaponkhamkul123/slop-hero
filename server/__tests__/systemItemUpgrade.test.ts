// Item upgrade system (reforge, craft, attribute smith, sockets, enhance, upgrade stats): locked to a fixture
// captured BEFORE the methods moved out of GameServer. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemItemUpgrade.json');
const NOW = 1700000000000;
const plain = (v: any) => JSON.parse(JSON.stringify(v));
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hashName = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // the server module imports the accountManager singleton
  const mod: any = await import('../gameServer');
  return { dir, GS: mod.default || mod.GameServer, CRAFT: await import('../crafting') };
}

const gear = (extra: any = {}) => ({ id: 'iron_blade', name: 'Knight Broadsword', type: 'equipment', slot: 'weapon', rarity: 'rare', count: 1, bonusDmg: 10, bonusSwipe: 30, ...extra });
const armor = (extra: any = {}) => ({ id: 'plate_x', name: 'Plate', type: 'equipment', slot: 'armor', rarity: 'epic', count: 1, bonusDef: 12, bonusHp: 100, ...extra });
const rune = (id = 'rune_flame', n = 2) => ({ id, name: id, type: 'rune', count: n, color: '#f00' });
const mat = (id: string, n: number) => ({ id, name: id, type: 'material', count: n });
const sockGear = (extra: any = {}) => gear({ maxSockets: 2, sockets: [null, null], ...extra });

test('item upgrade methods match the pre-refactor fixture', async () => {
  const { dir, GS, CRAFT } = await load();
  const realNow = Date.now, realRandom = Math.random;
  Date.now = () => NOW;
  try {
    const got: any = {};

    function run(name: string, method: string, args: any[], heroProps: any = {}, opts: any = {}) {
      Math.random = mulberry32(hashName(name));
      const log: any[] = [];
      const socket = { emit: (ev: string, data: any) => log.push(['socket', ev, plain(data)]) };
      const hero: any = {
        id: 'h1', name: 'Hero', zone: 'town', x: 10, y: 10, level: 40, characterClass: 'warrior', isDead: false, gold: 100000,
        inventory: { maxSlots: 30, items: [] }, equipment: {},
        ...heroProps,
      };
      const fake: any = Object.create(GS.prototype);
      Object.assign(fake, {
        players: new Map([['h1', hero]]),
        io: { sockets: { sockets: opts.noSocket ? new Map() : new Map([['h1', socket]]) } },
        townMap: { obstacles: opts.noJerry ? [] : [{ id: 'npc_jerry', x: opts.jerryX ?? 11, y: 10 }] },
        emitZone: (...a: any[]) => log.push(['zone', ...plain(a)]),
        savePlayerAccount: (id: string) => log.push(['call', 'savePlayerAccount', id]),
        broadcastSystemMessage: (m: string) => log.push(['call', 'broadcastSystemMessage', m]),
        recalculatePlayerStats: (p: any) => log.push(['call', 'recalculatePlayerStats', p.id]),
        giveLootToPlayer: (p: any, it: any, show: any) => { log.push(['call', 'giveLootToPlayer', plain(it), show]); },
      });
      if (typeof fake.initSystems === 'function') fake.initSystems();
      let threw: any = null;
      try { fake[method](...args); } catch (e: any) { threw = String(e && e.message); }
      got[name] = { log, hero: plain(hero), threw };
    }

    // ---- applyItemUpgradeStats (pure on the item)
    got.upgradeStats = {};
    const bare = () => { const f: any = Object.create(GS.prototype); if (typeof f.initSystems === 'function') f.initSystems(); return f; };
    for (const slot of ['weapon', 'armor', 'helmet', 'boots', 'gloves', 'cape', 'ring', 'amulet']) {
      for (const lvl of [0, 1, 7, 15]) {
        const it: any = { id: 'x', name: `Thing +${lvl}`, slot, upgradeLevel: lvl, bonusDmg: 10, bonusDef: 8, bonusHp: 50, bonusMp: 20, bonusSpeed: 0.1, bonusAttackSpeed: 0.05, bonusSwipe: 12 };
        bare().applyItemUpgradeStats(it);
        got.upgradeStats[`${slot}+${lvl}`] = plain(it);
      }
    }
    const reforged: any = { id: 'r', name: 'Sharp Blade +3', baseName: 'Blade', reforge: 'Sharp', slot: 'weapon', upgradeLevel: 3, bonusDmg: 5 };
    bare().applyItemUpgradeStats(reforged); got.upgradeStats.reforged = plain(reforged);
    bare().applyItemUpgradeStats(null); bare().applyItemUpgradeStats(undefined);

    // ---- handleReforgeItem
    const rf = (name: string, data: any, hero: any = {}, opts: any = {}) => run(name, 'handleReforgeItem', ['h1', data], hero, opts);
    rf('reforge dead', { target: 'inventory', itemIndex: 0 }, { isDead: true, inventory: { items: [gear()] } });
    rf('reforge not in town', { target: 'inventory', itemIndex: 0 }, { zone: 'dungeon', inventory: { items: [gear()] } });
    run('reforge no player', 'handleReforgeItem', ['zz', { target: 'inventory', itemIndex: 0 }]);
    rf('reforge bad target', { target: 'nope' }, { inventory: { items: [gear()] } });
    rf('reforge bad index', { target: 'inventory', itemIndex: 5 }, { inventory: { items: [gear()] } });
    rf('reforge not equipment', { target: 'inventory', itemIndex: 0 }, { inventory: { items: [mat('ore', 1)] } });
    rf('reforge nothing equipped', { target: 'equipped', slot: 'weapon' });
    rf('reforge poor', { target: 'inventory', itemIndex: 0 }, { gold: 1, inventory: { items: [gear()] } });
    rf('reforge poor no socket', { target: 'inventory', itemIndex: 0 }, { gold: 1, inventory: { items: [gear()] } }, { noSocket: true });
    for (const rarity of ['common', 'uncommon', 'rare', 'epic', 'legendary', 'divine', undefined, 'mythic']) {
      rf(`reforge bag ${rarity}`, { target: 'inventory', itemIndex: 0 }, { inventory: { items: [gear({ rarity })] } });
    }
    for (const slot of ['weapon', 'armor', 'helmet']) {
      rf(`reforge equipped ${slot}`, { target: 'equipped', slot }, { equipment: { [slot]: gear({ slot, rarity: 'legendary' }) } });
    }
    rf('reforge again on reforged', { target: 'inventory', itemIndex: 0 }, { inventory: { items: [gear({ rarity: 'epic', reforge: 'Sharp', baseName: 'Knight Broadsword' })] } });
    rf('reforge no socket', { target: 'inventory', itemIndex: 0 }, { inventory: { items: [gear()] } }, { noSocket: true });

    // ---- handleCraft
    const recipeIds = Object.keys(CRAFT.RECIPES);
    const rid = recipeIds.find(id => CRAFT.RECIPES[id].setId === 'wayfarer')!;
    const legendaryRid = recipeIds.find(id => CRAFT.RECIPES[id].setId === 'emberheart')!;
    const cr = (name: string, data: any, hero: any = {}, opts: any = {}) => run(name, 'handleCraft', ['h1', data], hero, opts);
    cr('craft no data', null);
    cr('craft dead', { recipeId: rid }, { isDead: true });
    cr('craft no socket', { recipeId: rid }, {}, { noSocket: true });
    cr('craft unknown recipe', { recipeId: 'nope' });
    cr('craft no recipe id', {});
    cr('craft level too low', { recipeId: legendaryRid }, { level: 10, inventory: { items: [mat('fragment_emberheart', 8)] } });
    cr('craft wrong zone', { recipeId: rid }, { zone: 'frostfell', inventory: { items: [mat('fragment_wayfarer', 8)] } });
    cr('craft missing materials', { recipeId: rid }, { inventory: { items: [mat('fragment_wayfarer', 3)] } });
    cr('craft too poor', { recipeId: rid }, { gold: 10, inventory: { items: [mat('fragment_wayfarer', 8)] } });
    cr('craft bag full', { recipeId: rid }, { inventory: { maxSlots: 2, items: [mat('fragment_wayfarer', 9), { id: 'junk' }] } });
    cr('craft ok', { recipeId: rid }, { inventory: { items: [mat('fragment_wayfarer', 8)] } });
    cr('craft ok with leftovers', { recipeId: rid, times: 5 }, { inventory: { items: [mat('fragment_wayfarer', 20)] } });
    cr('craft legendary set piece broadcasts', { recipeId: legendaryRid }, { inventory: { items: [mat('fragment_emberheart', 8)] } });
    cr('craft on plot', { recipeId: rid }, { zone: 'plot', inventory: { items: [mat('fragment_wayfarer', 8)] } });

    // ---- handleAttributes
    const rareGear = (extra: any = {}) => gear({ rarity: 'rare', attrSlots: 1, attrs: [null], ...extra });
    const at = (name: string, data: any, hero: any = {}, opts: any = {}) => run(name, 'handleAttributes', ['h1', data], hero, opts);
    const sk = { action: 'socket', target: 'inventory', itemIndex: 0 };
    at('attr no data', null);
    at('attr dead', sk, { isDead: true, inventory: { items: [rareGear()] } });
    at('attr no socket', sk, { inventory: { items: [rareGear()] } }, { noSocket: true });
    at('attr no jerry', sk, { inventory: { items: [rareGear()] } }, { noJerry: true });
    at('attr too far from jerry', sk, { inventory: { items: [rareGear()] } }, { jerryX: 30 });
    at('attr not in town', sk, { zone: 'frostfell', inventory: { items: [rareGear()] } });
    at('attr not gear', sk, { inventory: { items: [mat('ore', 1)] } });
    at('attr bad index', { action: 'socket', target: 'inventory', itemIndex: 'x' }, { inventory: { items: [rareGear()] } });
    at('attr common gear', sk, { inventory: { items: [gear({ rarity: 'common' })] } });
    at('attr socket no socketer', sk, { inventory: { items: [rareGear()] } });
    at('attr socket opens a slot', sk, { inventory: { items: [rareGear(), mat('attr_socketer', 2)] } });
    at('attr socket last socketer', { ...sk, itemIndex: 1 }, { inventory: { items: [mat('attr_socketer', 1), rareGear()] } });
    at('attr socket at cap', sk, { inventory: { items: [rareGear({ attrSlots: 9, attrs: new Array(9).fill(null) }), mat('attr_socketer', 1)] } });
    at('attr roll no open slots', { action: 'roll', target: 'inventory', itemIndex: 0 }, { inventory: { items: [rareGear({ attrSlots: 0, attrs: [] }), mat('attr_roller', 1)] } });
    at('attr roll everything locked', { action: 'roll', target: 'inventory', itemIndex: 0, locks: [0] }, { inventory: { items: [rareGear({ attrs: [{ k: 'dmg', v: 3 }] }), mat('attr_roller', 3)] } });
    at('attr roll no roller', { action: 'roll', target: 'inventory', itemIndex: 0 }, { inventory: { items: [rareGear()] } });
    at('attr roll one slot', { action: 'roll', target: 'inventory', itemIndex: 0 }, { inventory: { items: [rareGear(), mat('attr_roller', 2)] } });
    at('attr roll with a lock costs more', { action: 'roll', target: 'inventory', itemIndex: 1, locks: [0] }, {
      inventory: { items: [mat('attr_roller', 1), rareGear({ attrSlots: 3, attrs: [{ k: 'dmg', v: 3 }, null, null] })] },
    });
    at('attr roll with a lock, enough rollers', { action: 'roll', target: 'inventory', itemIndex: 1, locks: [0, 7, 'z'] }, {
      inventory: { items: [mat('attr_roller', 4), rareGear({ attrSlots: 3, attrs: [{ k: 'dmg', v: 3 }, null, null] })] },
    });
    at('attr roll equipped', { action: 'roll', target: 'equipped', slot: 'weapon' }, { equipment: { weapon: rareGear({ attrSlots: 2, attrs: [null, null] }) }, inventory: { items: [mat('attr_roller', 5)] } });
    at('attr reset nothing to reset', { action: 'reset', target: 'inventory', itemIndex: 0 }, { inventory: { items: [rareGear(), mat('attr_reseter', 1)] } });
    at('attr reset no reseter', { action: 'reset', target: 'inventory', itemIndex: 0 }, { inventory: { items: [rareGear({ attrs: [{ k: 'dmg', v: 3 }] })] } });
    at('attr reset ok', { action: 'reset', target: 'inventory', itemIndex: 1 }, { inventory: { items: [mat('attr_reseter', 1), rareGear({ attrSlots: 2, attrs: [{ k: 'dmg', v: 3 }, { k: 'hp', v: 5 }] })] } });
    at('attr reset with lock', { action: 'reset', target: 'inventory', itemIndex: 1, locks: [1] }, { inventory: { items: [mat('attr_reseter', 2), rareGear({ attrSlots: 2, attrs: [{ k: 'dmg', v: 3 }, { k: 'hp', v: 5 }] })] } });
    at('attr unknown action', { action: 'zzz', target: 'inventory', itemIndex: 0 }, { inventory: { items: [rareGear()] } });
    at('attr old item without fields', { ...sk, itemIndex: 1 }, { inventory: { items: [mat('attr_socketer', 1), gear({ rarity: 'legendary' })] } });

    // ---- handleSocketRune
    const so = (name: string, data: any, hero: any = {}, opts: any = {}) => run(name, 'handleSocketRune', ['h1', data], hero, opts);
    so('socket no data', null);
    so('socket dead', { target: 'inventory', itemIndex: 0, runeIndex: 1 }, { isDead: true, inventory: { items: [sockGear(), rune()] } });
    so('socket no socket', { target: 'inventory', itemIndex: 0, runeIndex: 1 }, { inventory: { items: [sockGear(), rune()] } }, { noSocket: true });
    so('socket no target', { target: 'nope' }, { inventory: { items: [sockGear(), rune()] } });
    so('socket not socketable', { target: 'inventory', itemIndex: 0, runeIndex: 1 }, { inventory: { items: [gear({ slot: 'ring' }), rune()] } });
    so('socket bad rune', { target: 'inventory', itemIndex: 0, runeIndex: 5 }, { inventory: { items: [sockGear(), rune()] } });
    so('socket rune is not a rune', { target: 'inventory', itemIndex: 0, runeIndex: 1 }, { inventory: { items: [sockGear(), mat('ore', 2)] } });
    so('socket armor rune on weapon', { target: 'inventory', itemIndex: 0, runeIndex: 1 }, { inventory: { items: [sockGear(), rune('rune_bulwark')] } });
    so('socket weapon rune on armor', { target: 'inventory', itemIndex: 0, runeIndex: 1 }, { inventory: { items: [armor({ maxSockets: 1, sockets: [null] }), rune('rune_flame')] } });
    so('socket first free slot', { target: 'inventory', itemIndex: 0, runeIndex: 1 }, { inventory: { items: [sockGear(), rune('rune_flame', 2)] } });
    so('socket last rune', { target: 'inventory', itemIndex: 1, runeIndex: 0 }, { inventory: { items: [rune('rune_frost', 1), sockGear()] } });
    so('socket chosen slot', { target: 'inventory', itemIndex: 0, runeIndex: 1, socketSlotIndex: 1 }, { inventory: { items: [sockGear(), rune()] } });
    so('socket slot out of range', { target: 'inventory', itemIndex: 0, runeIndex: 1, socketSlotIndex: 5 }, { inventory: { items: [sockGear(), rune()] } });
    so('socket broken sockets', { target: 'inventory', itemIndex: 0, runeIndex: 1, socketSlotIndex: 1 }, { inventory: { items: [sockGear({ brokenSockets: 1 }), rune()] } });
    so('socket all full, none free', { target: 'inventory', itemIndex: 0, runeIndex: 1 }, { inventory: { items: [sockGear({ sockets: ['rune_flame', 'rune_frost'] }), rune()] } });
    so('socket replaces and returns old (new stack)', { target: 'inventory', itemIndex: 0, runeIndex: 1, socketSlotIndex: 0 }, { inventory: { items: [sockGear({ sockets: ['rune_frost', null] }), rune('rune_flame', 1)] } });
    so('socket replaces and returns old (existing stack)', { target: 'inventory', itemIndex: 0, runeIndex: 1, socketSlotIndex: 0 }, { inventory: { items: [sockGear({ sockets: ['rune_frost', null] }), rune('rune_flame', 1), rune('rune_frost', 4)] } });
    so('socket old rune unknown def', { target: 'inventory', itemIndex: 0, runeIndex: 1, socketSlotIndex: 0 }, { inventory: { items: [sockGear({ sockets: ['mystery', null] }), rune('rune_flame', 2)] } });
    so('socket equipped default slot', { target: 'equipped', runeIndex: 0 }, { equipment: { weapon: sockGear() }, inventory: { items: [rune()] } });
    so('socket equipped armor', { target: 'equipped', slot: 'armor', runeIndex: 0 }, { equipment: { armor: armor({ maxSockets: 2, sockets: [null, null] }) }, inventory: { items: [rune('rune_aegis', 3)] } });
    so('socket item without socket fields rolls them', { target: 'inventory', itemIndex: 0, runeIndex: 1 }, { inventory: { items: [gear(), rune()] } });

    // ---- handleUnsocketRune
    const un = (name: string, data: any, hero: any = {}, opts: any = {}) => run(name, 'handleUnsocketRune', ['h1', data], hero, opts);
    const u0 = { target: 'inventory', itemIndex: 0, socketSlotIndex: 0 };
    un('unsocket no data', null);
    un('unsocket dead', u0, { isDead: true, inventory: { items: [sockGear({ sockets: ['rune_flame', null] })] } });
    un('unsocket no socket', u0, { inventory: { items: [sockGear({ sockets: ['rune_flame', null] })] } }, { noSocket: true });
    un('unsocket not socketable', u0, { inventory: { items: [gear({ slot: 'ring' })] } });
    un('unsocket empty slot', { ...u0, socketSlotIndex: 1 }, { inventory: { items: [sockGear({ sockets: ['rune_flame', null] })] } });
    un('unsocket slot out of range', { ...u0, socketSlotIndex: 9 }, { inventory: { items: [sockGear({ sockets: ['rune_flame', null] })] } });
    un('unsocket negative slot', { ...u0, socketSlotIndex: -1 }, { inventory: { items: [sockGear({ sockets: ['rune_flame', null] })] } });
    un('unsocket unknown rune', u0, { inventory: { items: [sockGear({ sockets: ['mystery', null] })] } });
    un('unsocket new stack', u0, { inventory: { items: [sockGear({ sockets: ['rune_flame', null] })] } });
    un('unsocket short id form', u0, { inventory: { items: [sockGear({ sockets: ['flame', null] })] } });
    un('unsocket onto existing stack', u0, { inventory: { items: [sockGear({ sockets: ['rune_flame', null] }), rune('rune_flame', 3)] } });
    un('unsocket bag full', u0, { inventory: { maxSlots: 2, items: [sockGear({ sockets: ['rune_flame', null] }), mat('ore', 1)] } });
    un('unsocket bag full but stacks', u0, { inventory: { maxSlots: 2, items: [sockGear({ sockets: ['rune_flame', null] }), rune('rune_flame', 1)] } });
    un('unsocket equipped', { target: 'equipped', socketSlotIndex: 1 }, { equipment: { weapon: sockGear({ sockets: [null, 'rune_tempest'] }) } });
    un('unsocket equipped armor', { target: 'equipped', slot: 'armor', socketSlotIndex: 0 }, { equipment: { armor: armor({ maxSockets: 1, sockets: ['rune_bulwark'] }) } });

    // ---- handleExpandSocket
    const ex = (name: string, data: any, hero: any = {}, opts: any = {}) => run(name, 'handleExpandSocket', ['h1', data], hero, opts);
    const expander = (n = 3) => ({ id: 'socket_expander', name: 'Socket Expander', count: n });
    ex('expand no data', null);
    ex('expand dead', { target: 'inventory', itemIndex: 0 }, { isDead: true, inventory: { items: [sockGear(), expander()] } });
    ex('expand no socket', { target: 'inventory', itemIndex: 0 }, { inventory: { items: [sockGear(), expander()] } }, { noSocket: true });
    ex('expand not socketable', { target: 'inventory', itemIndex: 0 }, { inventory: { items: [gear({ slot: 'ring' }), expander()] } });
    ex('expand weapon at max', { target: 'inventory', itemIndex: 0 }, { inventory: { items: [sockGear({ maxSockets: 4, sockets: [null, null, null, null] }), expander()] } });
    ex('expand armor at max', { target: 'inventory', itemIndex: 0 }, { inventory: { items: [armor({ maxSockets: 2, sockets: [null, null] }), expander()] } });
    ex('expand no expander', { target: 'inventory', itemIndex: 0 }, { inventory: { items: [sockGear()] } });
    for (const cur of [0, 1, 2, 3]) {
      for (let k = 0; k < 6; k++) {
        ex(`expand weapon ${cur} sockets try ${k}`, { target: 'inventory', itemIndex: 0, expanderIndex: 1 }, {
          inventory: { items: [sockGear({ maxSockets: cur, sockets: new Array(cur).fill(null), name: `Blade ${k}` }), expander(k === 0 ? 1 : 3)] },
        });
      }
    }
    ex('expand finds the expander when the index is wrong', { target: 'inventory', itemIndex: 0, expanderIndex: 9 }, { inventory: { items: [sockGear(), mat('ore', 1), expander()] } });
    ex('expand wrong item at expander index', { target: 'inventory', itemIndex: 0, expanderIndex: 1 }, { inventory: { items: [sockGear(), mat('ore', 1), expander()] } });
    ex('expand equipped', { target: 'equipped', slot: 'weapon' }, { equipment: { weapon: sockGear({ maxSockets: 2, sockets: [null, null] }) }, inventory: { items: [expander()] } });
    ex('expand armor', { target: 'equipped', slot: 'armor' }, { equipment: { armor: armor({ maxSockets: 0, sockets: [] }) }, inventory: { items: [expander(5)] } });

    // ---- handleEnhanceItem
    const en = (name: string, data: any, hero: any = {}, opts: any = {}) => run(name, 'handleEnhanceItem', ['h1', data], hero, opts);
    en('enhance no data', null);
    en('enhance dead', { target: 'inventory', itemIndex: 0 }, { isDead: true, inventory: { items: [gear()] } });
    en('enhance not in town', { target: 'inventory', itemIndex: 0 }, { zone: 'dungeon', inventory: { items: [gear()] } });
    en('enhance no socket', { target: 'inventory', itemIndex: 0 }, { inventory: { items: [gear()] } }, { noSocket: true });
    en('enhance bad target', { target: 'x' }, { inventory: { items: [gear()] } });
    en('enhance nothing equipped', { target: 'equipped', slot: 'weapon' });
    en('enhance bad index', { target: 'inventory', itemIndex: 4 }, { inventory: { items: [gear()] } });
    en('enhance not equipment', { target: 'inventory', itemIndex: 0 }, { inventory: { items: [mat('ore', 1)] } });
    en('enhance at max', { target: 'inventory', itemIndex: 0 }, { inventory: { items: [gear({ upgradeLevel: 15 })] } });
    en('enhance too poor', { target: 'inventory', itemIndex: 0 }, { gold: 5, inventory: { items: [gear()] } });
    for (const lvl of [0, 2, 3, 6, 7, 8, 10, 14]) {
      for (const k of [0, 1, 2, 3]) {
        en(`enhance +${lvl} try ${k}`, { target: 'inventory', itemIndex: 0 }, { gold: 1e9, inventory: { items: [gear({ upgradeLevel: lvl, rarity: ['common', 'rare', 'epic', 'legendary'][k], name: `Blade +${lvl}`, baseName: 'Blade' })] } });
      }
    }
    en('enhance equipped', { target: 'equipped', slot: 'armor' }, { gold: 1e9, equipment: { armor: armor({ upgradeLevel: 4 }) } });
    for (let k = 0; k < 8; k++) en(`enhance +9 retry ${k}`, { target: 'inventory', itemIndex: 0 }, { gold: 1e12, inventory: { items: [gear({ upgradeLevel: 9, rarity: 'common', name: `Edge ${k}` })] } });

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
