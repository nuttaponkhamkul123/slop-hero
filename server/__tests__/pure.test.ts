// Characterization tests: lock in CURRENT behavior so refactors can't silently change it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { expToNext, baseExpCurve, mobExp, levelGapMult, lootGapMult, masteryMult } from '../progression';
import { calculateElementalMultiplier, ELEMENTS } from '../elements';
import { enhanceCost, enhanceChance, generateRandomizedGear } from '../items';

const LEVELS = [1, 2, 5, 10, 20, 50, 99];

test('progression: exp curves', () => {
  assert.deepEqual(LEVELS.map(expToNext), [158, 317, 1274, 4899, 21296, 238785, 2179847]);
  assert.deepEqual(LEVELS.map(baseExpCurve), [126, 199, 501, 1247, 3536, 15919, 51671]);
});

test('progression: mob exp', () => {
  assert.deepEqual(LEVELS.map(l => mobExp(l)), [11, 16, 39, 89, 161, 367, 743]);
  assert.deepEqual(LEVELS.map(l => mobExp(l, 'commander')), [32, 49, 117, 267, 482, 1102, 2230]);
});

test('progression: level gap multipliers', () => {
  const pairs: [number, number][] = [[10, 10], [10, 15], [10, 2], [10, 40], [30, 10]];
  assert.deepEqual(pairs.map(([p, m]) => levelGapMult(p, m)), [1, 1.2, 0.55, 1.2, 0.1]);
  const loot: [number, number][] = [[10, 10], [20, 10], [30, 10], [25, 10]];
  assert.deepEqual(loot.map(([p, m]) => lootGapMult(p, m)), [1, 0.5, 0, 0]);
});

test('progression: mastery multiplier', () => {
  assert.deepEqual([1, 2, 5, 10, 20].map(masteryMult), [1, 1, 1, 1, 1]);
  assert.ok(Math.abs(masteryMult(50) - 2.1379620895022318) < 1e-9);
  assert.ok(Math.abs(masteryMult(99) - 7.396052750582379) < 1e-9);
});

test('elements: full matchup matrix', () => {
  const ks = Object.keys(ELEMENTS);
  const matrix = ks.map(a => ks.map(d => calculateElementalMultiplier(a, d)));
  assert.deepEqual(matrix, [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0.6, 1.5, 1, 1.25, 1, 1],
    [1, 1.5, 0.6, 1.25, 1, 1, 1],
    [1, 1, 1.25, 0.6, 1.5, 1, 1],
    [1, 1.25, 1, 1.5, 0.6, 1, 1],
    [1, 1, 1, 1, 1, 0.6, 1.75],
    [1, 1, 1, 1, 1, 1.5, 0.6],
  ]);
});

test('elements: resists and clamping', () => {
  assert.equal(calculateElementalMultiplier(undefined), 1);
  assert.equal(calculateElementalMultiplier('fire', 'nature', { fire: 0.5 }), 0.5);
  assert.equal(calculateElementalMultiplier('fire', 'x', { fire: 2 }), 0.15);
});

test('items: enhance cost and chance', () => {
  const lv = [0, 1, 5, 10, 14];
  assert.deepEqual(lv.map(l => enhanceCost({ rarity: 'common', upgradeLevel: l })), [400, 620, 3579, 32017, 184801]);
  assert.deepEqual(lv.map(l => enhanceCost({ rarity: 'epic', upgradeLevel: l })), [2000, 3100, 17893, 160084, 924004]);
  assert.deepEqual(lv.map(l => enhanceCost({ rarity: 'divine', upgradeLevel: l })), [8000, 12400, 71573, 640335, 3696015]);
  assert.deepEqual([0, 3, 7, 14, 15, 20].map(l => enhanceChance({ upgradeLevel: l })), [1, 0.9, 0.5, 0.1, 0, 0]);
});

test('items: randomized gear has the expected shape (random values not asserted)', () => {
  const g: any = generateRandomizedGear('iron_blade', 10, false);
  for (const k of ['id', 'name', 'slot', 'rarity', 'itemLevel', 'sockets']) assert.ok(k in g, `missing ${k}`);
  assert.equal(g.itemLevel, 10);
});
