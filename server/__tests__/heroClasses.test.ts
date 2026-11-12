import test from 'node:test';
import assert from 'node:assert/strict';
import { HERO_CLASSES, isHeroClass, starterEquipment } from '../data/heroClasses';

test('heroClasses: only real classes are classes (inherited object keys are not)', () => {
  for (const c of ['warrior', 'mage', 'rogue']) assert.equal(isHeroClass(c), true);
  for (const c of ['banana', '', undefined, null, 42, 'constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    assert.equal(isHeroClass(c), false, String(c));
  }
});

test('heroClasses: starter equipment gives fresh stacks and keeps slot order', () => {
  const a = starterEquipment('warrior'), b = starterEquipment('warrior');
  assert.deepEqual(Object.keys(a), ['weapon', 'armor', 'helmet']);
  assert.notEqual(a.weapon, b.weapon); // new object each call
  assert.equal(a.weapon.count, 1);
  assert.equal(a.armor, null);
  assert.equal(starterEquipment('mage').helmet, null);
});

test('heroClasses: only the mage is ranged', () => {
  assert.deepEqual(Object.entries(HERO_CLASSES).filter(([, c]) => c.isRanged).map(([k]) => k), ['mage']);
});
