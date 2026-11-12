import test from 'node:test';
import assert from 'node:assert/strict';
import { MobFactory } from '../entities/mob';

const fieldDef = () => ({ type: 'wolf', name: 'Wolf', level: 5, maxHp: 100, dmg: 9, def: 2, speed: 3, gold: 7, spawn: { x: 4, y: 6 }, zone: { minX: 0, maxX: 9, minY: 0, maxY: 9 }, buffs: ['frostbite'] });

test('MobFactory.field: defaults and independence from the definition', () => {
  const def: any = fieldDef();
  const m: any = MobFactory.field(def, 'meadow', 'meadow_mob_1');
  assert.equal(m.id, 'meadow_mob_1');
  assert.equal(m.fieldZone, 'meadow');
  assert.deepEqual([m.x, m.y, m.spawnX, m.spawnY], [4, 6, 4, 6]);
  assert.equal(m.hue, 0);
  assert.equal(m.scale, 1);
  assert.equal(m.element, 'ice');
  assert.deepEqual(m.elementResist, { fire: -0.5, ice: 0.5 });
  assert.equal(m.hp, 100);
  assert.equal(m.isBoss, false);
  assert.equal(m.state, 'idle');
  assert.equal(m.respawnTimer, 0);
  assert.notEqual(m.buffs, def.buffs); // a copy: changing the mob's buffs never changes the shared definition
  assert.notEqual(MobFactory.field(def, 'meadow', 'x').elementResist, MobFactory.field(def, 'meadow', 'y').elementResist);
  assert.ok(MobFactory.field({ ...def, isBoss: true }, 'meadow', 'b').exp > m.exp); // boss exp curve
});

test('MobFactory.raidBoss: boss flags, no automatic respawn, rise-in delay', () => {
  const def: any = { ...fieldDef(), hue: 200, scale: 2.5, exp: 5000, element: 'dark', elementResist: { dark: 0.5 } };
  const m: any = MobFactory.raidBoss(def, 'frostfell', 'frostfell_raid_1');
  assert.equal(m.isBoss && m.isRaidBoss && m.isCommander, true);
  assert.equal(m.mechanics, 'boss');
  assert.equal(m.respawnTimer, Infinity);
  assert.equal(m.exp, 5000);
  assert.ok(m.spawnUntil > Date.now() && m.nextWanderTime > Date.now());
});

test('MobFactory.riftMob: keeps the wave definition and marks the rift fields', () => {
  const def: any = { type: 'ghoul', name: 'Ghoul', level: 9, maxHp: 80, dmg: 5, def: 1, speed: 2, riftPoints: 12, zone: 'ignored' };
  const m: any = MobFactory.riftMob(def, 'rift_1', 'rift_mob_7', 3, 4);
  assert.equal(m.riftPoints, 12); // extra definition fields survive
  assert.equal(m.zone, 'dungeon'); // overrides the definition
  assert.equal(m.riftMob, true);
  assert.equal(m.riftInstanceId, 'rift_1');
  assert.equal(m.hp, 80);
  assert.equal(m.state, 'chase');
  assert.ok(m.attackCooldown >= 0.8 && m.attackCooldown <= 1.4);
});

test('MobFactory.bossAdd: deep copy of the template, never touches it', () => {
  const template: any = { type: 'skeleton', name: 'Add', hp: 50, buffs: ['a'] };
  const boss: any = { id: 'boss9', roomIdx: 4, addTemplate: template };
  const a: any = MobFactory.bossAdd(boss, { x: 1, y: 2 }, 'hero1', 'boss9_add_1');
  const b: any = MobFactory.bossAdd(boss, { x: 5, y: 6 }, 'hero2', 'boss9_add_2');
  assert.deepEqual([a.id, a.x, a.spawnY, a.roomIdx, a.summonedBy, a.targetPlayerId, a.state], ['boss9_add_1', 1, 2, 4, 'boss9', 'hero1', 'chase']);
  assert.notEqual(a.buffs, template.buffs);
  assert.notEqual(a.buffs, b.buffs);
  assert.deepEqual(Object.keys(template), ['type', 'name', 'hp', 'buffs']); // untouched
});

test('MobFactory.dungeonMob: fills defaults, differs only in the default defense, never mutates its input', () => {
  const raw: any = { id: 'd1', hp: 10, maxHp: 10 };
  const inst: any = MobFactory.dungeonMob(raw, 10);
  const legacy: any = MobFactory.dungeonMob(raw, 12);
  assert.equal(inst.def, 10);
  assert.equal(legacy.def, 12);
  assert.deepEqual([inst.buffs, inst.isCommander, inst.auraRadius, inst.hasCommanderBuff], [[], false, 0, false]);
  assert.deepEqual(Object.keys(raw), ['id', 'hp', 'maxHp']);
  assert.equal(MobFactory.dungeonMob({ ...raw, def: 30, isCommander: 1, auraRadius: 4 }, 10).def, 30); // a real def wins
});

test('MobFactory.adminSpawn: boss naming, speed and position', () => {
  const stats = { maxHp: 500, dmg: 20, def: 4, exp: 90, gold: 30 };
  const boss: any = MobFactory.adminSpawn({ id: 'admin_mob_1', mobType: 'dragon', isBoss: true, level: 20, stats, x: 1.5, y: 2.5, zone: 'town' });
  const grunt: any = MobFactory.adminSpawn({ id: 'admin_mob_2', mobType: 'wolf', isBoss: false, level: 20, stats, x: 1, y: 2, zone: 'town' });
  assert.equal(boss.name, '👑 Boss Dragon');
  assert.equal(grunt.name, 'Wolf');
  assert.equal(boss.speed, 2.8);
  assert.equal(grunt.speed, 2.5);
  assert.deepEqual([boss.spawnX, boss.spawnY, boss.zone, boss.fieldZone], [1.5, 2.5, 'town', 'town']);
  assert.equal(boss.hp, 500);
});
