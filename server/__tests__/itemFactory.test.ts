import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { ItemFactory } from '../entities/item';
import { ITEMS } from '../items';
import * as SP from '../spCards';

test('ItemFactory.stack: copies the source, sets the count, never touches the source', () => {
  const src: any = { id: 'x', name: 'X', count: 9, nested: { a: 1 } };
  const s = ItemFactory.stack(src, 3);
  assert.deepEqual(s, { id: 'x', name: 'X', count: 3, nested: { a: 1 } });
  assert.notEqual(s, src);
  assert.equal(src.count, 9);
  assert.equal(ItemFactory.stack(src).count, 1); // default count
  assert.deepEqual(ItemFactory.stack(undefined, 2), { count: 2 }); // same as the old `{ ...undefined, count: 2 }`
  const ruby = ItemFactory.stack(ITEMS.ancient_ruby);
  assert.equal(ruby.id, 'ancient_ruby');
  assert.equal(ruby.count, 1);
  assert.equal((ITEMS as any).ancient_ruby.count, undefined); // the shared definition stays clean
});

test('ItemFactory.card / cardLootData: same objects the old literals built', () => {
  const id = Object.keys(SP.CARD_BY_ID)[0];
  assert.deepEqual(ItemFactory.card(id), { ...SP.makeCardItem(id), custom: true, count: 1 });
  assert.deepEqual(ItemFactory.card(id, 3), { ...SP.makeCardItem(id, 3), custom: true, count: 1 });
  assert.equal(ItemFactory.card(id, 3).upgradeLevel, 3);
  assert.deepEqual(ItemFactory.cardLootData(id), { ...SP.makeCardItem(id), custom: true });
  assert.equal('count' in ItemFactory.cardLootData(id), false);
});

test('ItemFactory.forged: definition + count 1 + forge-style unique id', () => {
  const def: any = (ITEMS as any).iron_blade;
  const f: any = ItemFactory.forged(def);
  assert.equal(f.count, 1);
  assert.match(f.uniqueId, new RegExp('^' + def.id + '_[0-9]+_[a-z0-9]{1,6}$'));
  assert.notEqual(ItemFactory.forged(def).uniqueId, f.uniqueId);
});

test('ItemFactory.gear: rolled gear of the requested level', () => {
  const g: any = ItemFactory.gear('iron_blade', 10, false);
  assert.equal(g.itemLevel, 10);
  assert.equal(ItemFactory.gear('iron_blade').itemLevel, 1); // defaults
});

test('ItemFactory.fromLootEntry / lootEntryName: same fixture as GameServer', () => {
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/lootEntries.json'), 'utf8'));
  assert.equal(ItemFactory.fromLootEntry(null), null);
  assert.deepEqual(ItemFactory.fromLootEntry({ type: 'gold', amount: 1500 }), fx.items.gold);
  assert.deepEqual(ItemFactory.fromLootEntry({ type: 'item', itemId: 'health_potion', amount: 3 }), fx.items.healthPotion);
  assert.deepEqual(ItemFactory.fromLootEntry({ type: 'item', itemId: 'ancient_ruby', amount: 2 }), fx.items.knownItem);
  assert.deepEqual(ItemFactory.fromLootEntry({ type: 'item', itemId: 'does_not_exist', amount: 5 }), fx.items.unknownItem);
  assert.equal(ItemFactory.lootEntryName({ type: 'item', itemId: 'ancient_ruby', amount: 2 }), fx.names.knownItem);
});
