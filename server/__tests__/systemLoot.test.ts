// Loot system (giveLootToPlayer, lootEntryName/ToItem, getGroundItemsMap, spawnGroundItem, sweepGroundItems):
// locked to a fixture captured BEFORE the methods moved out of GameServer. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemLoot.json');
const plain = (v: any) => JSON.parse(JSON.stringify(v, (_k, x) => (x instanceof Map ? { __map: Array.from(x.entries()) } : x === Infinity ? '__Infinity__' : x)));

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // the server module imports the accountManager singleton
  const mod: any = await import('../gameServer');
  return { dir, GS: mod.default || mod.GameServer };
}

test('loot methods match the pre-refactor fixture', async () => {
  const { dir, GS } = await load();
  const realNow = Date.now;
  let now = 1700000000000;
  Date.now = () => now;
  try {
    const got: any = {};
    const server = (props: any = {}, log: any[] = []) => {
      const fake: any = Object.create(GS.prototype);
      Object.assign(fake, {
        emitZone: (...a: any[]) => log.push(['zone', ...plain(a)]),
        townGroundItems: new Map(), dungeonGroundItems: new Map(), dungeonInstances: new Map(), fields: new Map(), nextEntityId: 100,
        ...props,
      });
      if (typeof fake.initSystems === 'function') fake.initSystems();
      return fake;
    };
    const hero = (extra: any = {}) => ({ id: 'h1', zone: 'town', x: 5, y: 6, gold: 100, inventory: { maxSlots: 3, healthPotions: 1, manaPotions: 1, items: [] }, ...extra });

    // ---- giveLootToPlayer
    const give = (name: string, entry: any, heroProps: any = {}, showText?: boolean) => {
      const log: any[] = []; const p: any = hero(structuredClone(heroProps)); const gs = server({}, log);
      let threw: any = null;
      try { showText === undefined ? gs.giveLootToPlayer(p, entry) : gs.giveLootToPlayer(p, entry, showText); } catch (e: any) { threw = String(e && e.message); }
      got[name] = { log, hero: plain(p), threw };
    };
    give('gold', { type: 'gold', amount: 1500 });
    give('gold silent', { type: 'gold', amount: 20 }, {}, false);
    give('health potion', { itemId: 'health_potion', amount: 3 });
    give('health potion default amount', { itemId: 'health_potion' });
    give('mana potion', { itemId: 'mana_potion', amount: 2 });
    give('mana potion silent', { itemId: 'mana_potion' }, {}, false);
    give('new stack common', { itemId: 'town_scroll', amount: 2 });
    give('existing stack', { itemId: 'town_scroll', amount: 2 }, { inventory: { maxSlots: 3, items: [{ id: 'town_scroll', type: 'consumable', count: 4 }] } });
    give('existing stack no count', { itemId: 'town_scroll' }, { inventory: { maxSlots: 3, items: [{ id: 'town_scroll', type: 'consumable' }] } });
    give('bag full new item', { itemId: 'town_scroll' }, { inventory: { maxSlots: 1, items: [{ id: 'x', type: 'material', count: 1 }] } });
    give('bag full silent', { itemId: 'town_scroll' }, { inventory: { maxSlots: 1, items: [{ id: 'x' }] } }, false);
    give('bag full but stacks', { itemId: 'town_scroll', amount: 2 }, { inventory: { maxSlots: 1, items: [{ id: 'town_scroll', count: 1 }] } });
    give('default bag cap', { itemId: 'town_scroll' }, { inventory: { items: [{ id: 'x' }] } });
    give('equipment ignores amount', { itemId: 'iron_blade', amount: 5 });
    give('equipment never stacks', { itemId: 'iron_blade' }, { inventory: { maxSlots: 3, items: [{ id: 'iron_blade', type: 'equipment', count: 1 }] } });
    give('custom item rare', { itemId: 'zz', customItemData: { id: 'zz', name: 'Odd Thing', type: 'equipment', slot: 'ring', rarity: 'rare' } });
    give('custom item epic', { itemId: 'zz', customItemData: { id: 'zz', name: 'Epic Thing', type: 'equipment', slot: 'ring', rarity: 'epic' } });
    give('custom item legendary', { itemId: 'zz', customItemData: { id: 'zz', name: 'Leg Thing', type: 'equipment', slot: 'ring', rarity: 'legendary' } });
    give('custom stackable never merges', { itemId: 'sp_card_x', amount: 2, customItemData: { id: 'sp_card_x', name: 'Card', type: 'sp_card', custom: true } }, { inventory: { maxSlots: 3, items: [{ id: 'sp_card_x', type: 'sp_card', count: 1 }] } });
    give('unknown item is ignored', { itemId: 'not_real' });
    give('relic or material', { itemId: 'ancient_ruby', amount: 3 });

    // ---- lootEntryName / lootEntryToItem
    got.entryNames = {}; got.entryItems = {};
    const entries: any = {
      gold: { type: 'gold', amount: 1234567 }, hp: { itemId: 'health_potion', amount: 3 }, hp1: { itemId: 'health_potion' }, mp: { itemId: 'mana_potion', amount: 2 },
      stack: { itemId: 'town_scroll', amount: 4 }, single: { itemId: 'town_scroll' }, custom: { itemId: 'zz', amount: 2, customItemData: { id: 'zz', name: 'Odd', type: 'equipment', rarity: 'rare' } },
      unknown: { itemId: 'nope', amount: 2 }, unknownSingle: { itemId: 'nope' },
    };
    for (const [k, e] of Object.entries<any>(entries)) {
      const gs = server();
      got.entryNames[k] = gs.lootEntryName(e);
      got.entryItems[k] = plain(gs.lootEntryToItem(e));
    }
    got.entryItems.none = plain(server().lootEntryToItem(null));

    // ---- getGroundItemsMap
    const fieldMap = new Map([['f', 1]]); const instMap = new Map([['i', 1]]);
    const gm = server({ fields: new Map([['frostfell', { groundItems: fieldMap }]]), dungeonInstances: new Map([['inst1', { groundItems: instMap }]]), ctxInstanceId: 'inst1' });
    const which = (m: any) => (m === gm.townGroundItems ? 'town' : m === gm.dungeonGroundItems ? 'legacy dungeon' : m === fieldMap ? 'field' : m === instMap ? 'instance' : 'other');
    got.maps = {
      town: which(gm.getGroundItemsMap('town')),
      field: which(gm.getGroundItemsMap('frostfell')),
      dungeonByCtx: which(gm.getGroundItemsMap('dungeon')),
      dungeonByString: which(gm.getGroundItemsMap('dungeon', 'inst1')),
      dungeonByPlayer: which(gm.getGroundItemsMap('dungeon', { dungeonInstanceId: 'inst1' })),
      dungeonUnknownInst: which(gm.getGroundItemsMap('dungeon', 'gone')),
      dungeonPlayerNoInst: which(gm.getGroundItemsMap('dungeon', { id: 'p' })),
      unknownZone: which(gm.getGroundItemsMap('mystery')),
    };
    gm.ctxInstanceId = null;
    got.maps.dungeonNoCtx = which(gm.getGroundItemsMap('dungeon'));

    // ---- spawnGroundItem
    const spawn = (name: string, args: any[], props: any = {}) => {
      const log: any[] = []; const gs = server(props, log);
      gs.spawnGroundItem(...args);
      const stores = { town: gs.townGroundItems, legacy: gs.dungeonGroundItems };
      got[name] = { log, nextEntityId: gs.nextEntityId, stored: plain(stores) };
    };
    spawn('spawn town gold', ['town', 'gold', 'gold', 1, 2, 500]);
    spawn('spawn town item', ['town', 'item', 'ancient_ruby', 3, 4, 2]);
    spawn('spawn legacy dungeon item', ['dungeon', 'item', 'iron_blade', 5, 6, 1]);
    spawn('spawn custom', ['town', 'item', 'sp_card', 7, 8, 1, { id: 'sp_card_x', name: 'Card', custom: true }]);
    spawn('spawn into instance', ['dungeon', 'item', 'iron_blade', 9, 9, 1, null, 'inst1'], { dungeonInstances: new Map([['inst1', { groundItems: new Map(), id: 'inst1' }]]) });
    {
      const inst: any = { groundItems: new Map(), id: 'inst1' };
      const log: any[] = []; const gs = server({ dungeonInstances: new Map([['inst1', inst]]) }, log);
      gs.spawnGroundItem('dungeon', 'item', 'iron_blade', 9, 9, 1, null, 'inst1');
      got['spawn instance stored'] = { log, stored: plain(inst.groundItems) };
    }

    // ---- sweepGroundItems
    {
      const log: any[] = [];
      const mk = (id: string, expiresAt: any) => [id, { id, x: 1, y: 2, expiresAt }] as any;
      const town = new Map([mk('t_old', 1699999999999), mk('t_new', now + 5000), mk('t_never', undefined)]);
      const field = { groundItems: new Map([mk('f_old', now - 1), mk('f_exact', now)]) };
      const inst = { id: 'inst9', groundItems: new Map([mk('i_old', 5), mk('i_new', now + 1)]) };
      const gs = server({ townGroundItems: town, fields: new Map([['frostfell', field]]), dungeonInstances: new Map([['inst9', inst]]) }, log);
      const snap = () => plain({ town: Array.from(town.keys()), field: Array.from(field.groundItems.keys()), inst: Array.from(inst.groundItems.keys()) });
      gs.sweepGroundItems();
      got.sweep1 = { log: plain(log.splice(0)), left: snap() };
      // inside the sweep interval: nothing happens even though more items have expired
      now += 10; town.set('t_late', { id: 't_late', x: 0, y: 0, expiresAt: now - 1 });
      gs.sweepGroundItems();
      got.sweepTooSoon = { log: plain(log.splice(0)), left: snap() };
      // after the interval it runs again
      now += 5000;
      gs.sweepGroundItems();
      got.sweepLater = { log: plain(log.splice(0)), left: snap() };
      now += 5000;
      gs.sweepGroundItems();
      got.sweepNothingLeft = { log: plain(log.splice(0)), left: snap() };
    }

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
