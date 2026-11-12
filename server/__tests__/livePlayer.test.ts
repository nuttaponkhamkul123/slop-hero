import test from 'node:test';
import assert from 'node:assert/strict';
import { createLivePlayer } from '../entities/player';

const base = { id: 'sock1', accountUsername: null, accountSlot: 0, role: 'player', saved: null, chosenClass: 'warrior', spawnX: 20, spawnY: 23 };

const KEYS = [
  'accountSlot', 'accountUsername', 'attackCooldown', 'attackRange', 'attackSpeed', 'baseStats', 'berserkTimer', 'characterClass',
  'def', 'dmg', 'equipment', 'equippedSkills', 'exp', 'expNext', 'facing', 'gold', 'hp', 'id', 'inventory', 'ironFortressTimer',
  'isAttacking', 'isDead', 'isMoving', 'jobExp', 'jobExpNext', 'jobLevel', 'level', 'maxHp', 'maxMp', 'moveDir', 'mp', 'name',
  'portalCooldown', 'respawnTimer', 'role', 'shieldHp', 'skillCooldown', 'skillCooldowns', 'skillPoints', 'skills', 'smokeScreenTimer',
  'speechBubble', 'speechTimer', 'speed', 'speedFactor', 'spCooldown', 'spLoadouts', 'spTransformed', 'sprintTimer', 'statusEffects',
  'storage', 'swipe', 'targetX', 'targetY', 'x', 'y', 'zone',
].sort();

test('createLivePlayer: a fresh player has exactly the expected fields', () => {
  const p = createLivePlayer({ ...base, guestName: 'Hero' });
  assert.deepEqual(Object.keys(p).sort(), KEYS);
  assert.equal(p.x, 20);
  assert.equal(p.y, 23);
  assert.equal(p.zone, 'town');
});

test('createLivePlayer: a guest gets class starter gear and class stats, and a trimmed name', () => {
  const mage = createLivePlayer({ ...base, chosenClass: 'mage', guestName: '   A very long hero name here   ' });
  assert.equal(mage.name, 'A very long'); // cut to 15 characters first, then trimmed (as before the refactor)
  assert.equal(mage.equipment.weapon?.id, 'archmage_staff');
  assert.equal(mage.equipment.armor?.id, 'mystic_robe');
  assert.equal(mage.equipment.helmet, null);
  assert.equal(mage.maxHp, 95);
  assert.equal(mage.hp, 95);
  assert.equal(mage.mp, 130);
  assert.equal(createLivePlayer({ ...base, guestName: '' }).name, 'Hero');
  assert.equal(createLivePlayer({ ...base }).name, 'Hero');
});

test('createLivePlayer: saved values win, zero values are kept, missing ones get defaults', () => {
  const zero = createLivePlayer({ ...base, accountUsername: 'acc', saved: { name: 'Z', characterClass: 'rogue', level: 12, skillPoints: 0, gold: 0 }, chosenClass: 'rogue' });
  assert.equal(zero.name, 'Z');
  assert.equal(zero.level, 12);
  assert.equal(zero.skillPoints, 0); // not replaced by the default 1
  assert.equal(zero.gold, 0); // not replaced by the default 50
  assert.equal(zero.equipment.weapon, null); // a saved character never gets starter gear
  assert.equal(zero.inventory.items.length, 2); // default starter bag
  assert.equal(zero.accountUsername, 'acc');

  const bare = createLivePlayer({ ...base, saved: { name: 'B', characterClass: 'warrior' } });
  assert.equal(bare.skillPoints, 1);
  assert.equal(bare.gold, 50);
  assert.equal(bare.storage.maxSlots, 50);
});

test('createLivePlayer: containers of different players never share objects', () => {
  const a = createLivePlayer({ ...base }), b = createLivePlayer({ ...base });
  assert.notEqual(a.equipment, b.equipment);
  assert.notEqual(a.inventory.items, b.inventory.items);
  assert.notEqual(a.equippedSkills, b.equippedSkills);
  assert.notEqual(a.statusEffects, b.statusEffects);
});
