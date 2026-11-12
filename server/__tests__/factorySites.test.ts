// The places that now build items through ItemFactory (crafting, dungeon chest loot) still behave the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import { craft, RECIPES } from '../crafting';
import { rollDungeonLoot } from '../dungeonGenerator';
import { ITEMS } from '../items';

function playerFor(recipe: any) {
  const items = recipe.inputs.map((i: any) => ({ ...(ITEMS as any)[i.id], id: i.id, count: i.n * 50 }));
  return { zone: 'town', level: 99, gold: 1e9, inventory: { maxSlots: 150, items, healthPotions: 0, manaPotions: 0 } };
}
const gsRecorder = () => { const given: any[] = []; return { given, giveLootToPlayer: (_p: any, entry: any) => { given.push(entry); } }; };

test('craft: a stack recipe returns the output stack with the crafted count (synthetic recipe: all real ones are gear)', () => {
  const id = 'test_stack_recipe';
  RECIPES[id] = { id, output: { id: 'ancient_ruby', n: 3 }, inputs: [{ id: 'revival_stone', n: 1 }], gold: 10, levelReq: 1 };
  try {
    const gs = gsRecorder();
    const res: any = craft(gs, playerFor(RECIPES[id]), id, 2);
    assert.equal(res.ok, true, res.message);
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].id, 'ancient_ruby');
    assert.equal(res.items[0].count, 6);
    assert.deepEqual(gs.given[0], { type: 'item', itemId: 'ancient_ruby', amount: 6 });
  } finally {
    delete RECIPES[id];
  }
});

test('craft: a gear recipe rolls gear at the player level and hands it over as custom data', () => {
  const [id, r]: any = Object.entries(RECIPES).find(([, r]: any) => r.output.gear)!;
  const gs = gsRecorder();
  const res: any = craft(gs, playerFor(r), id, 1);
  assert.equal(res.ok, true, res.message);
  assert.equal(res.items[0].itemLevel, 99);
  assert.equal(gs.given[0].customItemData, res.items[0]);
  assert.equal(gs.given[0].itemId, res.items[0].id);
});

test('rollDungeonLoot: gear drops carry rolled custom data (boss gear is rolled at the band top)', () => {
  const real = Math.random;
  try {
    Math.random = () => 0; // always rolls the gear drop
    const drops: any[] = rollDungeonLoot(true, 2, null);
    const gear = drops.find(d => d.customItemData);
    assert.ok(gear, 'a gear drop');
    assert.equal(gear.type, 'item');
    assert.equal(gear.amount, 1);
    assert.equal(gear.customItemData.id, gear.itemId);
    assert.equal(typeof gear.customItemData.itemLevel, 'number');
    Math.random = () => 0.99; // never
    assert.equal(rollDungeonLoot(false, 1, null).some((d: any) => d.customItemData), false);
  } finally {
    Math.random = real;
  }
});
