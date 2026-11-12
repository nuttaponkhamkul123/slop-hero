// Potion system (getPotionSlots, getPotionCount, consumePotion, handleUsePotion, handleSetPotionSlot): locked to a
// fixture captured BEFORE the methods moved out of GameServer. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemPotions.json');
const NOW = 1700000000000;
const plain = (v: any) => JSON.parse(JSON.stringify(v));

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // the server module imports the accountManager singleton
  const mod: any = await import('../gameServer');
  const GS = mod.default || mod.GameServer;
  const make = (props: any = {}) => {
    const fake: any = Object.create(GS.prototype);
    Object.assign(fake, props);
    if (typeof fake.initSystems === 'function') fake.initSystems();
    return fake;
  };
  return { dir, make };
}

// a server with one connected hero; every emit (zone or socket) is recorded in order
function scene(make: any, heroProps: any = {}) {
  const log: any[] = [];
  const socket = { emit: (ev: string, data: any) => log.push(['socket', ev, plain(data)]) };
  const hero: any = {
    id: 'h1', zone: 'town', x: 3, y: 4, hp: 100, maxHp: 200, mp: 10, maxMp: 100,
    inventory: { healthPotions: 3, manaPotions: 2, items: [{ id: 'greater_health_potion', count: 2 }, { id: 'greater_mana_potion' }] },
    ...heroProps,
  };
  const gs = make({
    players: new Map([['h1', hero]]),
    io: { sockets: { sockets: new Map([['h1', socket]]) } },
    emitZone: (...a: any[]) => log.push(['zone', ...plain(a)]),
  });
  return { gs, hero, log };
}

test('potion system matches the pre-refactor fixture', async () => {
  const { dir, make } = await load();
  const realNow = Date.now;
  Date.now = () => NOW;
  try {
    const got: any = {};

    // slots, counts, consuming
    {
      const { gs, hero } = scene(make);
      const slots1 = plain(gs.getPotionSlots(hero));
      hero.inventory.potionSlots.health = 'greater_health_potion';
      const slots2 = plain(gs.getPotionSlots(hero)); // an existing assignment is kept
      const counts = ['health_potion', 'mana_potion', 'greater_health_potion', 'greater_mana_potion', 'nope'].map(id => gs.getPotionCount(hero, id));
      gs.consumePotion(hero, 'health_potion');
      gs.consumePotion(hero, 'mana_potion');
      gs.consumePotion(hero, 'greater_health_potion');   // 2 -> 1
      gs.consumePotion(hero, 'greater_mana_potion');     // 1 (count missing) -> removed
      gs.consumePotion(hero, 'nope');                    // nothing happens
      got.basics = { slots1, slots2, counts, afterConsume: plain(hero.inventory) };
    }

    // drinking
    const drink = (name: string, potionType: any, heroProps: any = {}, setup?: (s: any) => void) => {
      const s = scene(make, heroProps);
      if (setup) setup(s);
      s.gs.handleUsePotion('h1', potionType);
      got.drink = got.drink || {};
      got.drink[name] = { hero: plain(s.hero), log: s.log };
    };
    drink('healthSlot', 'health');
    drink('manaSlot', 'mana');
    drink('specificGreaterHealth', { itemId: 'greater_health_potion' });
    drink('specificGreaterMana', { itemId: 'greater_mana_potion' });
    drink('hpAlreadyFull', 'health', { hp: 200 });
    drink('mpAlreadyFull', 'mana', { mp: 100 });
    drink('outOfPotions', 'health', { inventory: { healthPotions: 0, manaPotions: 0, items: [] } });
    drink('onCooldown', 'health', { potionCdUntil: { health: NOW + 4000, mana: 0 } });
    drink('cooldownOver', 'health', { potionCdUntil: { health: NOW - 1, mana: 0 } });
    drink('sharedCooldownBlocksOtherSize', { itemId: 'greater_health_potion' }, { potionCdUntil: { health: NOW + 1000, mana: 0 } });
    drink('healsAtMost', 'health', { hp: 195 });
    drink('unknownKind', 'poison');
    drink('unknownItem', { itemId: 'ancient_ruby' });
    drink('badPayload', 42);
    drink('dead', 'health', { isDead: true });
    drink('customSlot', 'health', {}, s => { s.gs.getPotionSlots(s.hero).health = 'greater_health_potion'; });
    {
      const s = scene(make);
      s.gs.handleUsePotion('nobody', 'health'); // unknown socket id
      got.drink.unknownSocket = { log: s.log, hp: s.hero.hp };
    }
    {
      // drinking twice quickly: the second sip is on cooldown
      const s = scene(make);
      s.gs.handleUsePotion('h1', 'health');
      s.gs.handleUsePotion('h1', 'health');
      got.drink.twice = { hero: plain(s.hero), log: s.log };
    }

    // choosing the quick-slot potion
    {
      const s = scene(make);
      const r: any = {};
      s.gs.handleSetPotionSlot('h1', { kind: 'health', itemId: 'greater_health_potion' }); r.valid = plain(s.hero.inventory.potionSlots);
      s.gs.handleSetPotionSlot('h1', { kind: 'mana', itemId: 'greater_health_potion' }); r.kindMismatch = plain(s.hero.inventory.potionSlots);
      s.gs.handleSetPotionSlot('h1', { kind: 'mana', itemId: 'ancient_ruby' }); r.unknownItem = plain(s.hero.inventory.potionSlots);
      s.gs.handleSetPotionSlot('h1', null); r.noData = plain(s.hero.inventory.potionSlots);
      s.gs.handleSetPotionSlot('nobody', { kind: 'mana', itemId: 'mana_potion' }); r.noPlayer = plain(s.hero.inventory.potionSlots);
      r.log = s.log;
      got.setSlot = r;
    }

    if (process.env.UPDATE_FIXTURES === '1') { fs.writeFileSync(FIXTURE, JSON.stringify(got, null, 2) + '\n', 'utf8'); return; }
    assert.deepEqual(plain(got), JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
  } finally {
    Date.now = realNow;
    await (await import('../accountManager')).default.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
