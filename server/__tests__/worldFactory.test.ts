import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectile, createGroundItem, createDungeonInstance, createRiftInstance, createParty } from '../entities/world';
import { ITEM_DESPAWN_MS } from '../config/constants';
import { RIFT_PREP_S } from '../eternalRift';

test('createProjectile: keeps every field, in the established key order', () => {
  const input: any = { cardId: 'c', instanceId: 'i', id: 'proj_1', zone: 'dungeon', casterId: 'p', x: 1, y: 2, targetX: 3, targetY: 4, targetId: 't', targetType: 'mob', vx: 5, vy: 6, damage: 7, splash: 0.3, crit: true, element: 'fire', life: 2, color: '#fff' };
  const p = createProjectile(input);
  assert.deepEqual(p, input);
  assert.notEqual(p, input);
  assert.deepEqual(Object.keys(p), ['cardId', 'instanceId', 'id', 'zone', 'casterId', 'x', 'y', 'targetX', 'targetY', 'targetId', 'targetType', 'vx', 'vy', 'damage', 'splash', 'crit', 'element', 'life', 'color']);
  const noTarget = createProjectile({ ...input, targetX: undefined, targetId: undefined });
  assert.ok('targetX' in noTarget && noTarget.targetX === undefined); // an absent target stays an explicit undefined, as before
});

test('createGroundItem: names, item ids and the despawn time', () => {
  const now = Date.now();
  const gold: any = createGroundItem({ id: 'item_1', zone: 'town', type: 'gold', itemIdOrName: 'gold', x: 1, y: 2, amount: 1500, customItemData: null });
  assert.equal(gold.name, '1,500 Gold');
  assert.equal(gold.itemId, null);
  const ruby: any = createGroundItem({ id: 'item_2', zone: 'town', type: 'item', itemIdOrName: 'ancient_ruby', x: 1, y: 2, amount: 2, customItemData: null });
  assert.equal(ruby.name, 'Ancient Ruby');
  assert.equal(ruby.itemId, 'ancient_ruby');
  const custom: any = createGroundItem({ id: 'item_3', zone: 'town', type: 'item', itemIdOrName: 'sp_card', x: 0, y: 0, amount: 1, customItemData: { name: 'Fancy' } });
  assert.equal(custom.name, 'Fancy');
  assert.equal(createGroundItem({ id: 'i', zone: 'town', type: 'item', itemIdOrName: 'not_in_items', x: 0, y: 0, amount: 1, customItemData: null }).name, 'not_in_items');
  assert.ok(ruby.createdAt >= now && ruby.expiresAt - ruby.createdAt >= ITEM_DESPAWN_MS - 5 && ruby.expiresAt - ruby.createdAt <= ITEM_DESPAWN_MS + 5);
});

test('createDungeonInstance: fresh empty live state, given pieces kept', () => {
  const pending = new Map([[1, [{ id: 'm1' }]]]);
  const chests = [{ id: 'chest_1' }];
  const args: any = { id: 'solo_x', partyId: null, floor: 2, difficulty: 'hard', mode: 'classic', mods: ['swift'], modReward: 0.15, dungeon: { w: 1 }, pendingMobs: pending, chests, bossRoomIdx: 4, totalTrashMobs: 30, requiredKills: 15 };
  const a: any = createDungeonInstance(args), b: any = createDungeonInstance(args);
  assert.equal(a.pendingMobs, pending);
  assert.equal(a.chests, chests);
  assert.equal(a.mods, args.mods);
  assert.equal(a.mobs.size, 0);
  assert.equal(a.groundItems.size, 0);
  assert.deepEqual([a.cleared, a.killedTrashCount, a.killPercent, a.bossPortalReady, a.bossPortalSpawned, a.bossPortalPos], [false, 0, 0, false, false, null]);
  assert.notEqual(a.mobs, b.mobs); // every instance owns its maps
  assert.notEqual(a.groundItems, b.groundItems);
});

test('createRiftInstance: preparation phase, fountain, and independent state per run', () => {
  const args: any = { id: 'rift_solo_x', partyId: 'party_2', dungeon: { arena: true }, baseLevel: 38, mode: 'nightmare', perWave: 3, spawnMult: 2, fountainHp: 15160 };
  const a: any = createRiftInstance(args), b: any = createRiftInstance(args);
  assert.deepEqual([a.floor, a.difficulty, a.partyId, a.cleared], [0, 'rift', 'party_2', false]);
  assert.equal(a.rift.phase, 'prep');
  assert.equal(a.rift.timer, RIFT_PREP_S);
  assert.deepEqual(a.rift.fountain, { hp: 15160, maxHp: 15160 });
  assert.deepEqual([a.rift.baseLevel, a.rift.mode, a.rift.perWave, a.rift.spawnMult], [38, 'nightmare', 3, 2]);
  assert.ok(a.rift.points instanceof Map && a.rift.banked instanceof Map && a.rift.choices instanceof Map);
  assert.notEqual(a.rift.points, b.rift.points);
  assert.notEqual(a.rift.fountain, b.rift.fountain);
  assert.notEqual(a.rift.queue, b.rift.queue);
  assert.notEqual(a.mobs, b.mobs);
});

test('createParty: the leader is the only member, and each party owns its member set', () => {
  const p1 = createParty('party_1', 'a'), p2 = createParty('party_2', 'b');
  assert.deepEqual([p1.id, p1.leaderId, Array.from(p1.memberIds)], ['party_1', 'a', ['a']]);
  p1.memberIds.add('c');
  assert.equal(p2.memberIds.size, 1);
});
