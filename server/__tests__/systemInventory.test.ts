// Inventory system (equip, unequip, buy, favorite, sell, bag/chest expanders, personal chest, town scroll, pickup):
// locked to a fixture captured BEFORE the methods moved out of GameServer. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemInventory.json');
const NOW = 1700000000000;
const plain = (v: any) => JSON.parse(JSON.stringify(v));

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // the server module imports the accountManager singleton
  const mod: any = await import('../gameServer');
  const GS = mod.default || mod.GameServer;
  return { dir, GS };
}

const sword = (extra: any = {}) => ({ id: 'iron_blade', name: 'Knight Broadsword', type: 'equipment', slot: 'weapon', count: 1, ...extra });
const helm = (extra: any = {}) => ({ id: 'helm_x', name: 'Test Helm', type: 'equipment', slot: 'helmet', count: 1, ...extra });

test('inventory methods match the pre-refactor fixture', async () => {
  const { dir, GS } = await load();
  const realNow = Date.now;
  Date.now = () => NOW;
  try {
    const got: any = {};

    // one scenario: fresh hero + server with recorded stubs; returns the log, the hero and the callee calls
    function run(name: string, method: string, args: any[], heroProps: any = {}, opts: any = {}) {
      const log: any[] = [];
      const socket = { emit: (ev: string, data: any) => log.push(['socket', ev, plain(data)]) };
      const hero: any = {
        id: 'h1', name: 'Hero', zone: 'town', x: 15, y: 17, characterClass: 'warrior', isDead: false, gold: 1000,
        inventory: { maxSlots: 30, items: [], healthPotions: 1, manaPotions: 1 },
        equipment: {},
        storage: undefined,
        ...heroProps,
      };
      const ground = new Map<string, any>(opts.ground || []);
      const fake: any = Object.create(GS.prototype);
      Object.assign(fake, {
        players: new Map([['h1', hero]]),
        io: { sockets: { sockets: opts.noSocket ? new Map() : new Map([['h1', socket]]) } },
        emitZone: (...a: any[]) => log.push(['zone', ...plain(a)]),
        savePlayerAccount: (id: string) => log.push(['call', 'savePlayerAccount', id]),
        sendDirectMessage: (...a: any[]) => log.push(['call', 'sendDirectMessage', ...a]),
        recalculatePlayerStats: (p: any) => log.push(['call', 'recalculatePlayerStats', p.id]),
        equipSpCard: (p: any, i: number) => log.push(['call', 'equipSpCard', p.id, i]),
        setTransformed: (p: any, v: boolean) => { log.push(['call', 'setTransformed', p.id, v]); p.spTransformed = v; },
        handleLeaveDungeon: (id: string) => { log.push(['call', 'handleLeaveDungeon', id]); hero.zone = opts.leaveStaysInDungeon ? 'dungeon' : 'town'; },
        teleportPlayerToTown: (p: any) => { log.push(['call', 'teleportPlayerToTown', p.id]); if (!opts.teleportFails) p.zone = 'town'; },
        giveLootToPlayer: (p: any, it: any) => log.push(['call', 'giveLootToPlayer', p.id, plain(it)]),
        getGroundItemsMap: (z: string) => { log.push(['call', 'getGroundItemsMap', z]); return ground; },
      });
      if (typeof fake.initSystems === 'function') fake.initSystems();
      let threw: any = null;
      try { fake[method](...args.map(a => (typeof a === 'function' ? a() : a))); } catch (e: any) { threw = String(e && e.message); }
      got[name] = { log, hero: plain(hero), ground: Array.from(ground.keys()), threw };
    }

    // ---- handleEquipItem
    run('equip dead', 'handleEquipItem', ['h1', 0], { isDead: true, inventory: { items: [sword()] } });
    run('equip no player', 'handleEquipItem', ['zz', 0]);
    run('equip bad index', 'handleEquipItem', ['h1', 5], { inventory: { items: [sword()] } });
    run('equip negative', 'handleEquipItem', ['h1', -1], { inventory: { items: [sword()] } });
    run('equip sp card', 'handleEquipItem', ['h1', 0], { inventory: { items: [{ id: 'sp_card_x', type: 'sp_card', count: 1 }] } });
    run('equip not equipment', 'handleEquipItem', ['h1', 0], { inventory: { items: [{ id: 'health_potion', type: 'consumable', count: 2 }] } });
    run('equip no slot', 'handleEquipItem', ['h1', 0], { inventory: { items: [{ id: 'q', type: 'equipment', count: 1 }] } });
    run('equip wrong class', 'handleEquipItem', ['h1', 0], { characterClass: 'mage', inventory: { items: [sword()] } });
    run('equip wrong class no socket', 'handleEquipItem', ['h1', 0], { characterClass: 'mage', inventory: { items: [sword()] } }, { noSocket: true });
    run('equip empty slot', 'handleEquipItem', ['h1', 0], { inventory: { items: [sword()] } });
    run('equip swap', 'handleEquipItem', ['h1', 1], { inventory: { items: [helm(), sword({ upgradeLevel: 3 })] }, equipment: { weapon: { id: 'old_blade', name: 'Old', type: 'equipment', slot: 'weapon', count: 1 } } });
    run('equip stack of two', 'handleEquipItem', ['h1', 0], { inventory: { items: [helm({ count: 2 })] }, equipment: { helmet: helm({ id: 'helm_old', name: 'Old Helm' }) } });
    run('equip old matches non-equipment', 'handleEquipItem', ['h1', 1], { inventory: { items: [{ id: 'old_blade', type: 'material', count: 4 }, sword()] }, equipment: { weapon: { id: 'old_blade', name: 'Old', type: 'equipment', slot: 'weapon' } } });
    run('equip old matches equipment', 'handleEquipItem', ['h1', 1], { inventory: { items: [{ id: 'old_blade', type: 'equipment', slot: 'weapon', count: 1 }, sword()] }, equipment: { weapon: { id: 'old_blade', name: 'Old', type: 'equipment', slot: 'weapon' } } });
    run('equip no socket', 'handleEquipItem', ['h1', 0], { inventory: { items: [sword()] } }, { noSocket: true });

    // ---- handleUnequipItem
    run('unequip dead', 'handleUnequipItem', ['h1', 'weapon'], { isDead: true, equipment: { weapon: sword() } });
    run('unequip nothing', 'handleUnequipItem', ['h1', 'weapon'], { equipment: {} });
    run('unequip no equipment', 'handleUnequipItem', ['h1', 'weapon'], { equipment: null });
    run('unequip ok', 'handleUnequipItem', ['h1', 'weapon'], { equipment: { weapon: sword({ upgradeLevel: 2 }) } });
    run('unequip bag full', 'handleUnequipItem', ['h1', 'weapon'], { inventory: { maxSlots: 2, items: [helm(), helm()] }, equipment: { weapon: sword() } });
    run('unequip bag full no socket', 'handleUnequipItem', ['h1', 'weapon'], { inventory: { maxSlots: 1, items: [helm()] }, equipment: { weapon: sword() } }, { noSocket: true });
    run('unequip default cap', 'handleUnequipItem', ['h1', 'weapon'], { inventory: { items: [helm()] }, equipment: { weapon: sword() } });
    run('unequip sp transformed', 'handleUnequipItem', ['h1', 'sp'], { spTransformed: true, equipment: { sp: { id: 'sp_card_x', type: 'sp_card' } } });
    run('unequip sp not transformed', 'handleUnequipItem', ['h1', 'sp'], { equipment: { sp: { id: 'sp_card_x', type: 'sp_card' } } });
    run('unequip no socket', 'handleUnequipItem', ['h1', 'weapon'], { equipment: { weapon: sword() } }, { noSocket: true });

    // ---- handleBuyItem
    run('buy dead', 'handleBuyItem', ['h1', 'health_potion', 1], { isDead: true });
    run('buy unknown item', 'handleBuyItem', ['h1', 'nope', 1]);
    run('buy not consumable', 'handleBuyItem', ['h1', 'iron_blade', 1]);
    run('buy health x1', 'handleBuyItem', ['h1', 'health_potion', 1]);
    run('buy health x10 default count', 'handleBuyItem', ['h1', 'health_potion']);
    run('buy mana x7', 'handleBuyItem', ['h1', 'mana_potion', 7]);
    run('buy poor', 'handleBuyItem', ['h1', 'health_potion', 5], { gold: 3 });
    run('buy poor no gold field', 'handleBuyItem', ['h1', 'health_potion', 5], { gold: undefined });
    run('buy poor no socket', 'handleBuyItem', ['h1', 'health_potion', 5], { gold: 3 }, { noSocket: true });
    run('buy qty clamped high', 'handleBuyItem', ['h1', 'health_potion', 5000], { gold: 99999999 });
    run('buy qty clamped low', 'handleBuyItem', ['h1', 'health_potion', -4]);
    run('buy qty garbage', 'handleBuyItem', ['h1', 'health_potion', 'abc']);
    run('buy qty string', 'handleBuyItem', ['h1', 'health_potion', '3']);
    run('buy no potion counters', 'handleBuyItem', ['h1', 'health_potion', 2], { inventory: { items: [] } });
    run('buy elixir new stack', 'handleBuyItem', ['h1', 'elixir_of_fury', 2]);
    run('buy elixir existing stack', 'handleBuyItem', ['h1', 'elixir_of_fury', 2], { inventory: { items: [{ id: 'elixir_of_fury', count: 3 }] } });
    run('buy elixir existing no count', 'handleBuyItem', ['h1', 'elixir_of_fury', 2], { inventory: { items: [{ id: 'elixir_of_fury' }] } });
    run('buy town scroll', 'handleBuyItem', ['h1', 'town_scroll', 1]);
    run('buy no socket', 'handleBuyItem', ['h1', 'health_potion', 1], {}, { noSocket: true });

    // ---- handleToggleFavorite
    run('fav no data', 'handleToggleFavorite', ['h1', null]);
    run('fav bag on', 'handleToggleFavorite', ['h1', { itemIndex: 0 }], { inventory: { items: [sword()] } });
    run('fav bag off', 'handleToggleFavorite', ['h1', { itemIndex: 0 }], { inventory: { items: [sword({ favorite: true })] } });
    run('fav bag bad index', 'handleToggleFavorite', ['h1', { itemIndex: 9 }], { inventory: { items: [sword()] } });
    run('fav bag non-integer', 'handleToggleFavorite', ['h1', { itemIndex: '0' }], { inventory: { items: [sword()] } });
    run('fav equipped on', 'handleToggleFavorite', ['h1', { target: 'equipped', slot: 'weapon' }], { equipment: { weapon: sword() } });
    run('fav equipped none', 'handleToggleFavorite', ['h1', { target: 'equipped', slot: 'helmet' }], { equipment: { weapon: sword() } });
    run('fav equipped no equipment', 'handleToggleFavorite', ['h1', { target: 'equipped', slot: 'weapon' }], { equipment: null });
    run('fav gold', 'handleToggleFavorite', ['h1', { itemIndex: 0 }], { inventory: { items: [{ type: 'gold', amount: 5 }] } });
    run('fav dead still works', 'handleToggleFavorite', ['h1', { itemIndex: 0 }], { isDead: true, inventory: { items: [sword()] } });
    run('fav no socket', 'handleToggleFavorite', ['h1', { itemIndex: 0 }], { inventory: { items: [sword()] } }, { noSocket: true });

    // ---- handleSellItem
    run('sell dead', 'handleSellItem', ['h1', 0], { isDead: true, inventory: { items: [sword({ sellPrice: 50 })] } });
    run('sell not in town', 'handleSellItem', ['h1', 0], { zone: 'frostfell', inventory: { items: [sword({ sellPrice: 50 })] } });
    run('sell bad index', 'handleSellItem', ['h1', 3], { inventory: { items: [sword()] } });
    run('sell float index', 'handleSellItem', ['h1', 0.5], { inventory: { items: [sword()] } });
    run('sell favorite', 'handleSellItem', ['h1', 0], { inventory: { items: [sword({ favorite: true, sellPrice: 50 })] } });
    run('sell favorite no socket', 'handleSellItem', ['h1', 0], { inventory: { items: [sword({ favorite: true })] } }, { noSocket: true });
    run('sell whole single', 'handleSellItem', ['h1', 0], { inventory: { items: [sword({ sellPrice: 50 })] } });
    run('sell default price', 'handleSellItem', ['h1', 0], { inventory: { items: [sword()] } });
    run('sell part of stack', 'handleSellItem', ['h1', 0, 3], { inventory: { items: [{ id: 'ore', name: 'Ore', count: 10, sellPrice: 7 }] } });
    run('sell stack default qty', 'handleSellItem', ['h1', 0], { inventory: { items: [{ id: 'ore', name: 'Ore', count: 10, sellPrice: 7 }] } });
    run('sell all of stack', 'handleSellItem', ['h1', 0, 99], { inventory: { items: [{ id: 'ore', name: 'Ore', count: 10, sellPrice: 7 }] } });
    run('sell qty garbage', 'handleSellItem', ['h1', 0, 'x'], { inventory: { items: [{ id: 'ore', name: 'Ore', count: 4, sellPrice: 7 }] } });
    run('sell qty zero', 'handleSellItem', ['h1', 0, 0], { inventory: { items: [{ id: 'ore', name: 'Ore', count: 4, sellPrice: 7 }] } });
    run('sell no socket', 'handleSellItem', ['h1', 0, 2], { inventory: { items: [{ id: 'ore', name: 'Ore', count: 4, sellPrice: 7 }] } }, { noSocket: true });

    // ---- handleSellItems
    const bulk = () => [
      { id: 'a', name: 'A', count: 5, sellPrice: 3 }, { id: 'b', name: 'B', count: 1, sellPrice: 40 }, { id: 'sp_card_q', name: 'Card', count: 1, sellPrice: 999 },
      { id: 'c', name: 'C', count: 2, sellPrice: 11, favorite: true }, { id: 'd', name: 'D', count: 3 }, { id: 'e', type: 'sp_card', name: 'E', count: 1, sellPrice: 77 },
    ];
    run('bulk dead', 'handleSellItems', ['h1', [{ itemIndex: 0 }]], { isDead: true, inventory: { items: bulk() } });
    run('bulk not in town', 'handleSellItems', ['h1', [{ itemIndex: 0 }]], { zone: 'dungeon', inventory: { items: bulk() } });
    run('bulk not array', 'handleSellItems', ['h1', { itemIndex: 0 }], { inventory: { items: bulk() } });
    run('bulk empty', 'handleSellItems', ['h1', []], { inventory: { items: bulk() } });
    run('bulk only protected', 'handleSellItems', ['h1', [{ itemIndex: 2 }, { itemIndex: 3 }, { itemIndex: 5 }]], { inventory: { items: bulk() } });
    run('bulk invalid entries', 'handleSellItems', ['h1', [null, { itemIndex: 'x' }, { itemIndex: -1 }, { itemIndex: 99 }]], { inventory: { items: bulk() } });
    run('bulk mixed', 'handleSellItems', ['h1', [{ itemIndex: 0, quantity: 2 }, { itemIndex: 1 }, { itemIndex: 2 }, { itemIndex: 3 }, { itemIndex: 4, quantity: 99 }, { itemIndex: 5 }]], { inventory: { items: bulk() } });
    run('bulk sell everything sellable', 'handleSellItems', ['h1', [0, 1, 4].map(i => ({ itemIndex: i, quantity: 99 }))], { inventory: { items: bulk() } });
    run('bulk duplicate index last wins', 'handleSellItems', ['h1', [{ itemIndex: 0, quantity: 1 }, { itemIndex: 0, quantity: 4 }]], { inventory: { items: bulk() } });
    run('bulk single item word', 'handleSellItems', ['h1', [{ itemIndex: 1 }]], { inventory: { items: bulk() } });
    run('bulk more entries than slots', 'handleSellItems', ['h1', [{ itemIndex: 0 }, { itemIndex: 0 }, { itemIndex: 0 }]], { inventory: { items: [{ id: 'a', count: 2, sellPrice: 2 }] } });
    run('bulk no socket', 'handleSellItems', ['h1', [{ itemIndex: 0 }]], { inventory: { items: bulk() } }, { noSocket: true });

    // ---- handleUseTownScroll
    const scroll = (n = 2) => ({ id: 'town_scroll', name: 'Town Scroll', count: n });
    run('scroll no data', 'handleUseTownScroll', ['h1', null], { zone: 'frostfell', inventory: { items: [scroll()] } });
    run('scroll dead', 'handleUseTownScroll', ['h1', { itemIndex: 0 }], { zone: 'frostfell', isDead: true, inventory: { items: [scroll()] } });
    run('scroll no socket', 'handleUseTownScroll', ['h1', { itemIndex: 0 }], { zone: 'frostfell', inventory: { items: [scroll()] } }, { noSocket: true });
    run('scroll wrong item', 'handleUseTownScroll', ['h1', { itemIndex: 0 }], { zone: 'frostfell', inventory: { items: [sword()] } });
    run('scroll bad index', 'handleUseTownScroll', ['h1', { itemIndex: 4 }], { zone: 'frostfell', inventory: { items: [scroll()] } });
    run('scroll already in town', 'handleUseTownScroll', ['h1', { itemIndex: 0 }], { zone: 'town', inventory: { items: [scroll()] } });
    run('scroll from field stack', 'handleUseTownScroll', ['h1', { itemIndex: 0 }], { zone: 'frostfell', inventory: { items: [scroll(3)] } });
    run('scroll from field last', 'handleUseTownScroll', ['h1', { itemIndex: '0' }], { zone: 'frostfell', inventory: { items: [scroll(1)] } });
    run('scroll from field no count', 'handleUseTownScroll', ['h1', { itemIndex: 0 }], { zone: 'frostfell', inventory: { items: [{ id: 'town_scroll' }] } });
    run('scroll from dungeon', 'handleUseTownScroll', ['h1', { itemIndex: 0 }], { zone: 'dungeon', inventory: { items: [scroll()] } });
    run('scroll from dungeon fails', 'handleUseTownScroll', ['h1', { itemIndex: 0 }], { zone: 'dungeon', inventory: { items: [scroll()] } }, { leaveStaysInDungeon: true });
    run('scroll teleport fails', 'handleUseTownScroll', ['h1', { itemIndex: 0 }], { zone: 'frostfell', inventory: { items: [scroll()] } }, { teleportFails: true });

    // ---- handleUseBagExpander
    const bag = (id: string, n = 1) => ({ id, name: id, count: n });
    run('bag no data', 'handleUseBagExpander', ['h1', null], { inventory: { items: [bag('bag_expander_sm')] } });
    run('bag dead', 'handleUseBagExpander', ['h1', { itemIndex: 0 }], { isDead: true, inventory: { items: [bag('bag_expander_sm')] } });
    run('bag invalid item', 'handleUseBagExpander', ['h1', { itemIndex: 0 }], { inventory: { items: [sword()] } });
    run('bag invalid index', 'handleUseBagExpander', ['h1', { itemIndex: 9 }], { inventory: { items: [bag('bag_expander_sm')] } });
    run('bag at max', 'handleUseBagExpander', ['h1', { itemIndex: 0 }], { inventory: { maxSlots: 9999, items: [bag('bag_expander_sm')] } });
    run('bag small', 'handleUseBagExpander', ['h1', { itemIndex: 0 }], { inventory: { maxSlots: 30, items: [bag('bag_expander_sm')] } });
    run('bag medium stack', 'handleUseBagExpander', ['h1', { itemIndex: 0 }], { inventory: { maxSlots: 30, items: [bag('bag_expander_md', 3)] } });
    run('bag large', 'handleUseBagExpander', ['h1', { itemIndex: 0 }], { inventory: { maxSlots: 30, items: [bag('bag_expander_lg')] } });
    run('bag large near cap', 'handleUseBagExpander', ['h1', { itemIndex: 0 }], { inventory: { maxSlots: 190, items: [bag('bag_expander_lg')] } });
    run('bag no maxSlots', 'handleUseBagExpander', ['h1', { itemIndex: 0 }], { inventory: { items: [bag('bag_expander_md')] } });
    run('bag no count', 'handleUseBagExpander', ['h1', { itemIndex: 0 }], { inventory: { items: [{ id: 'bag_expander_sm' }] } });
    run('bag no socket', 'handleUseBagExpander', ['h1', { itemIndex: 0 }], { inventory: { items: [bag('bag_expander_sm')] } }, { noSocket: true });

    // ---- handleOpenPersonalChest
    run('chest open dead', 'handleOpenPersonalChest', ['h1'], { isDead: true });
    run('chest open no socket', 'handleOpenPersonalChest', ['h1'], {}, { noSocket: true });
    run('chest open not town', 'handleOpenPersonalChest', ['h1'], { zone: 'frostfell' });
    run('chest open too far', 'handleOpenPersonalChest', ['h1'], { x: 40, y: 40 });
    run('chest open creates storage', 'handleOpenPersonalChest', ['h1'], { x: 15.6, y: 17.1 });
    run('chest open at the limit', 'handleOpenPersonalChest', ['h1'], { x: 15.6 + 5, y: 17.1 });
    run('chest open just past the limit', 'handleOpenPersonalChest', ['h1'], { x: 15.6 + 5.01, y: 17.1 });
    run('chest open repairs storage', 'handleOpenPersonalChest', ['h1'], { storage: { items: 'junk' } });
    run('chest open keeps storage', 'handleOpenPersonalChest', ['h1'], { storage: { maxSlots: 80, items: [{ id: 'ore', count: 2 }] } });

    // ---- handleDepositToChest
    const ore = (n = 4, extra: any = {}) => ({ id: 'ore', name: 'Ore', count: n, ...extra });
    run('dep no data', 'handleDepositToChest', ['h1', null]);
    run('dep dead', 'handleDepositToChest', ['h1', { itemIndex: 0 }], { isDead: true });
    run('dep no socket', 'handleDepositToChest', ['h1', { itemIndex: 0 }], {}, { noSocket: true });
    run('dep not town', 'handleDepositToChest', ['h1', { itemIndex: 0 }], { zone: 'dungeon' });
    run('dep too far', 'handleDepositToChest', ['h1', { itemIndex: 0 }], { x: 1, y: 1 });
    run('dep bad index', 'handleDepositToChest', ['h1', { itemIndex: 7 }], { inventory: { items: [ore()] } });
    run('dep non-integer index', 'handleDepositToChest', ['h1', { itemIndex: 'zz' }], { inventory: { items: [ore()] } });
    run('dep negative index', 'handleDepositToChest', ['h1', { itemIndex: -1 }], { inventory: { items: [ore()] } });
    run('dep hole in bag', 'handleDepositToChest', ['h1', { itemIndex: 0 }], { inventory: { items: [null] } });
    run('dep whole stack', 'handleDepositToChest', ['h1', { itemIndex: 0 }], { inventory: { items: [ore()] } });
    run('dep part of stack', 'handleDepositToChest', ['h1', { itemIndex: 0, count: 1 }], { inventory: { items: [ore()] } });
    run('dep count too big', 'handleDepositToChest', ['h1', { itemIndex: 0, count: 50 }], { inventory: { items: [ore()] } });
    run('dep count garbage', 'handleDepositToChest', ['h1', { itemIndex: 0, count: 'x' }], { inventory: { items: [ore()] } });
    run('dep onto matching stack', 'handleDepositToChest', ['h1', { itemIndex: 0, count: 2 }], { inventory: { items: [ore()] }, storage: { maxSlots: 50, items: [ore(5)] } });
    run('dep onto matching stack no count', 'handleDepositToChest', ['h1', { itemIndex: 0, count: 2 }], { inventory: { items: [ore()] }, storage: { maxSlots: 50, items: [{ id: 'ore' }] } });
    run('dep matching stack but gear', 'handleDepositToChest', ['h1', { itemIndex: 0 }], { inventory: { items: [sword()] }, storage: { maxSlots: 50, items: [sword()] } });
    run('dep upgraded item', 'handleDepositToChest', ['h1', { itemIndex: 0 }], { inventory: { items: [ore(1, { upgradeLevel: 2 })] }, storage: { maxSlots: 50, items: [ore(5)] } });
    run('dep socketed item', 'handleDepositToChest', ['h1', { itemIndex: 0 }], { inventory: { items: [ore(1, { sockets: [1] })] }, storage: { maxSlots: 50, items: [ore(5)] } });
    run('dep custom item', 'handleDepositToChest', ['h1', { itemIndex: 0 }], { inventory: { items: [ore(1, { custom: true })] }, storage: { maxSlots: 50, items: [ore(5)] } });
    run('dep chest full', 'handleDepositToChest', ['h1', { itemIndex: 0 }], { inventory: { items: [ore()] }, storage: { maxSlots: 1, items: [{ id: 'other' }] } });
    run('dep chest full but stacks', 'handleDepositToChest', ['h1', { itemIndex: 0 }], { inventory: { items: [ore()] }, storage: { maxSlots: 1, items: [ore(2)] } });
    run('dep repairs storage', 'handleDepositToChest', ['h1', { itemIndex: 0 }], { inventory: { items: [ore()] }, storage: { items: null } });
    run('dep all', 'handleDepositToChest', ['h1', { all: true }], {
      inventory: { items: [ore(2), sword(), helm({ upgradeLevel: 1 }), null, ore(3), { id: 'gem', count: 1 }] }, storage: { maxSlots: 50, items: [ore(10)] },
    });
    run('dep all with a small chest', 'handleDepositToChest', ['h1', { all: true }], {
      inventory: { items: [sword(), helm(), { id: 'gem', count: 1 }, ore(2)] }, storage: { maxSlots: 2, items: [ore(1)] },
    });
    run('dep all nothing moves', 'handleDepositToChest', ['h1', { all: true }], { inventory: { items: [sword()] }, storage: { maxSlots: 1, items: [{ id: 'x' }] } });
    run('dep all empty bag', 'handleDepositToChest', ['h1', { all: true }], { inventory: { items: [] } });

    // ---- handleWithdrawFromChest
    const stored = (items: any[], maxSlots = 50) => ({ maxSlots, items });
    run('wd no data', 'handleWithdrawFromChest', ['h1', null]);
    run('wd dead', 'handleWithdrawFromChest', ['h1', { itemIndex: 0 }], { isDead: true });
    run('wd no socket', 'handleWithdrawFromChest', ['h1', { itemIndex: 0 }], {}, { noSocket: true });
    run('wd not town', 'handleWithdrawFromChest', ['h1', { itemIndex: 0 }], { zone: 'frostfell' });
    run('wd too far', 'handleWithdrawFromChest', ['h1', { itemIndex: 0 }], { x: 0, y: 0 });
    run('wd no storage yet', 'handleWithdrawFromChest', ['h1', { itemIndex: 0 }]);
    run('wd bad index', 'handleWithdrawFromChest', ['h1', { itemIndex: 3 }], { storage: stored([ore()]) });
    run('wd non-integer index', 'handleWithdrawFromChest', ['h1', { itemIndex: 'a' }], { storage: stored([ore()]) });
    run('wd hole in chest', 'handleWithdrawFromChest', ['h1', { itemIndex: 0 }], { storage: stored([null]) });
    run('wd whole stack', 'handleWithdrawFromChest', ['h1', { itemIndex: 0 }], { storage: stored([ore()]) });
    run('wd part of stack', 'handleWithdrawFromChest', ['h1', { itemIndex: 0, count: 3 }], { storage: stored([ore()]) });
    run('wd count too big', 'handleWithdrawFromChest', ['h1', { itemIndex: 0, count: 99 }], { storage: stored([ore()]) });
    run('wd count garbage', 'handleWithdrawFromChest', ['h1', { itemIndex: 0, count: 'q' }], { storage: stored([ore()]) });
    run('wd onto matching stack', 'handleWithdrawFromChest', ['h1', { itemIndex: 0, count: 2 }], { storage: stored([ore()]), inventory: { items: [ore(6)] } });
    run('wd onto matching stack no count', 'handleWithdrawFromChest', ['h1', { itemIndex: 0, count: 2 }], { storage: stored([ore()]), inventory: { items: [{ id: 'ore' }] } });
    run('wd gear is never merged', 'handleWithdrawFromChest', ['h1', { itemIndex: 0 }], { storage: stored([sword()]), inventory: { items: [sword()] } });
    run('wd custom is never merged', 'handleWithdrawFromChest', ['h1', { itemIndex: 0 }], { storage: stored([ore(2, { custom: true })]), inventory: { items: [ore(6)] } });
    run('wd reforged is never merged', 'handleWithdrawFromChest', ['h1', { itemIndex: 0 }], { storage: stored([ore(2, { reforgeBonus: 1 })]), inventory: { items: [ore(6)] } });
    run('wd bag full', 'handleWithdrawFromChest', ['h1', { itemIndex: 0 }], { storage: stored([ore()]), inventory: { maxSlots: 1, items: [{ id: 'x' }] } });
    run('wd bag full but stacks', 'handleWithdrawFromChest', ['h1', { itemIndex: 0 }], { storage: stored([ore()]), inventory: { maxSlots: 1, items: [ore(1)] } });
    run('wd bag default cap', 'handleWithdrawFromChest', ['h1', { itemIndex: 0 }], { storage: stored([ore()]), inventory: { items: [{ id: 'x' }] } });
    run('wd repairs storage', 'handleWithdrawFromChest', ['h1', { itemIndex: 0 }], { storage: { maxSlots: 50, items: undefined } });

    // ---- handleUseChestExpander
    run('cx no data', 'handleUseChestExpander', ['h1', null]);
    run('cx dead', 'handleUseChestExpander', ['h1', { itemIndex: 0 }], { isDead: true, inventory: { items: [bag('chest_expander_sm')] } });
    run('cx no socket', 'handleUseChestExpander', ['h1', { itemIndex: 0 }], { inventory: { items: [bag('chest_expander_sm')] } }, { noSocket: true });
    run('cx invalid item', 'handleUseChestExpander', ['h1', { itemIndex: 0 }], { inventory: { items: [bag('bag_expander_sm')] } });
    run('cx invalid index', 'handleUseChestExpander', ['h1', { itemIndex: 8 }], { inventory: { items: [bag('chest_expander_sm')] } });
    run('cx at max', 'handleUseChestExpander', ['h1', { itemIndex: 0 }], { storage: stored([], 300), inventory: { items: [bag('chest_expander_sm')] } });
    run('cx small, creates storage', 'handleUseChestExpander', ['h1', { itemIndex: 0 }], { inventory: { items: [bag('chest_expander_sm')] } });
    run('cx medium stack', 'handleUseChestExpander', ['h1', { itemIndex: 0 }], { storage: stored([ore()], 100), inventory: { items: [bag('chest_expander_md', 2)] } });
    run('cx large', 'handleUseChestExpander', ['h1', { itemIndex: 0 }], { storage: stored([], 50), inventory: { items: [bag('chest_expander_lg')] } });
    run('cx large near cap', 'handleUseChestExpander', ['h1', { itemIndex: 0 }], { storage: stored([], 280), inventory: { items: [bag('chest_expander_lg')] } });
    run('cx no maxSlots', 'handleUseChestExpander', ['h1', { itemIndex: 0 }], { storage: { items: [] }, inventory: { items: [{ id: 'chest_expander_md' }] } });

    // ---- handlePickupItem
    const drop = (x: number, y: number) => ({ id: 'g1', x, y, type: 'item', itemId: 'ore' });
    run('pickup dead', 'handlePickupItem', ['h1', 'g1'], { isDead: true }, { ground: [['g1', drop(15, 17)]] });
    run('pickup no player', 'handlePickupItem', ['zz', 'g1'], {}, { ground: [['g1', drop(15, 17)]] });
    run('pickup missing', 'handlePickupItem', ['h1', 'nope'], {}, { ground: [['g1', drop(15, 17)]] });
    run('pickup too far', 'handlePickupItem', ['h1', 'g1'], {}, { ground: [['g1', drop(20, 17)]] });
    run('pickup at the limit', 'handlePickupItem', ['h1', 'g1'], {}, { ground: [['g1', drop(17.2, 17)]] });
    run('pickup in range', 'handlePickupItem', ['h1', 'g1'], {}, { ground: [['g1', drop(16, 18)]] });
    run('pickup in range no socket', 'handlePickupItem', ['h1', 'g1'], {}, { ground: [['g1', drop(16, 18)], ['g2', drop(1, 1)]], noSocket: true });
    run('pickup from dungeon zone', 'handlePickupItem', ['h1', 'g1'], { zone: 'dungeon' }, { ground: [['g1', drop(15, 17)]] });

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
