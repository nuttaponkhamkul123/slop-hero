// Monster factory: every place that creates a monster goes through here (shape: ./types.ts, Mob).
//
// Each variant returns exactly the fields and defaults of the literal it replaced; the creation sites
// differ in their key sets and defaults on purpose (see server/__tests__/mobSites.test.ts), so there is
// no shared base object. Ids come from the caller (each scope has its own counter).
import { mobExp } from '../progression';
import type { Mob } from './types';

export const MobFactory = {
  /** An open-world field monster from a buildFieldMobs definition (re-spawns after death). */
  field(def: any, fieldZoneId: string, id: string): Mob {
    return {
      id,
      type: def.type,
      name: def.name,
      level: def.level,
      x: def.spawn.x,
      y: def.spawn.y,
      spawnX: def.spawn.x,
      spawnY: def.spawn.y,
      zone: def.zone,
      fieldZone: fieldZoneId,
      hue: def.hue || 0,
      scale: def.scale || 1,
      isBoss: !!def.isBoss,
      hp: def.maxHp,
      maxHp: def.maxHp,
      dmg: def.dmg,
      def: def.def,
      speed: def.speed,
      exp: mobExp(def.level, def.isBoss ? 'boss' : 'normal'),
      gold: def.gold,
      element: def.element || "ice",
      elementResist: def.elementResist || { fire: -0.5, ice: 0.5 },
      buffs: [...(def.buffs || [])],
      isCommander: false,
      auraRadius: 0,
      targetPlayerId: null,
      state: 'idle',
      nextWanderTime: Date.now() + Math.random() * 3000,
      wanderTarget: null,
      attackCooldown: 0,
      respawnTimer: 0,
      facing: 'SE'
    };
  },

  /** A field raid boss from a buildRaidMobDef definition (never respawns by itself: the raid schedule does that). */
  raidBoss(def: any, zoneId: string, id: string): Mob {
    return {
      id,
      type: def.type,
      name: def.name,
      level: def.level,
      x: def.spawn.x,
      y: def.spawn.y,
      spawnX: def.spawn.x,
      spawnY: def.spawn.y,
      zone: def.zone,
      fieldZone: zoneId,
      hue: def.hue,
      scale: def.scale,
      isBoss: true,
      isRaidBoss: true,
      mechanics: 'boss',
      isCommander: true,
      auraRadius: 0,
      hp: def.maxHp,
      maxHp: def.maxHp,
      dmg: def.dmg,
      def: def.def,
      speed: def.speed,
      exp: def.exp,
      gold: def.gold,
      element: def.element,
      elementResist: def.elementResist,
      buffs: [...def.buffs],
      targetPlayerId: null,
      state: 'idle',
      nextWanderTime: Date.now() + 600,
      wanderTarget: null,
      attackCooldown: 0,
      respawnTimer: Infinity,          // raid respawn is handled by the schedule, not the normal mob timer
      facing: 'SE',
      spawnUntil: Date.now() + 900     // brief rise-in before it can be hit
    };
  },

  /** An Eternal Rift monster entering through a gate at (x, y); it marches on the fountain. */
  riftMob(def: any, instanceId: string, id: string, x: number, y: number): Mob {
    return {
      ...def, id, x, y, spawnX: x, spawnY: y, hp: def.maxHp, state: 'chase', facing: 'S',
      attackCooldown: 0.8 + Math.random() * 0.6, targetPlayerId: null, structTargetId: null,
      isCommander: false, auraRadius: 0, hasCommanderBuff: false,
      riftMob: true, riftInstanceId: instanceId, noLevelGap: true, zone: 'dungeon',
      spawnUntil: Date.now() + 700
    };
  },

  /** An add summoned by a dungeon boss: a copy of the boss' addTemplate placed at `pos`, already chasing a hero. */
  bossAdd(boss: any, pos: { x: number; y: number }, targetPlayerId: string, id: string): Mob {
    const add = JSON.parse(JSON.stringify(boss.addTemplate));
    Object.assign(add, {
      id, x: pos.x, y: pos.y, spawnX: pos.x, spawnY: pos.y, roomIdx: boss.roomIdx,
      summonedBy: boss.id, state: 'chase', targetPlayerId,
      spawnUntil: Date.now() + 900, attackCooldown: 1.2
    });
    return add;
  },

  /**
   * A generated dungeon monster with the fields the server relies on filled in.
   * `defaultDef` is the defense used when the generator gave none (10 in dungeon instances, 12 in the legacy dungeon).
   */
  dungeonMob(mob: any, defaultDef: number): Mob {
    return {
      ...mob,
      def: mob.def || defaultDef,
      buffs: mob.buffs || [],
      isCommander: !!mob.isCommander,
      auraRadius: mob.auraRadius || 0,
      hasCommanderBuff: false
    };
  },

  /** A monster spawned by the admin /spawn command at (x, y) of the admin's zone. */
  adminSpawn(o: { id: string; mobType: string; isBoss: boolean; level: number; stats: any; x: number; y: number; zone: string }): Mob {
    return {
      id: o.id,
      type: o.mobType,
      name: (o.isBoss ? '👑 Boss ' : '') + o.mobType.charAt(0).toUpperCase() + o.mobType.slice(1),
      level: o.level,
      x: o.x,
      y: o.y,
      spawnX: o.x,
      spawnY: o.y,
      zone: o.zone,
      fieldZone: o.zone,
      isBoss: o.isBoss,
      hp: o.stats.maxHp,
      maxHp: o.stats.maxHp,
      dmg: o.stats.dmg,
      def: o.stats.def,
      speed: o.isBoss ? 2.8 : 2.5,
      exp: o.stats.exp,
      gold: o.stats.gold,
      state: 'idle',
      facing: 'S',
      attackCooldown: 1.0,
      buffs: [],
      targetPlayerId: null,
      respawnTimer: 0
    };
  }
};
