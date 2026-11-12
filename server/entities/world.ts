// World object factories: projectiles, ground items, dungeon / rift instances and parties.
// The shapes live in ./types.ts. Each function returns exactly the fields (and key order) of the literal it
// replaced; ids come from the caller (each scope has its own counter).
import { ITEMS } from '../items';
import { ITEM_DESPAWN_MS } from '../config/constants';
import { RIFT_PREP_S } from '../eternalRift';
import type { DungeonInstance, GroundItem, PartyState, Projectile, RiftInstance } from './types';

/**
 * A projectile in flight. The player's ranged attack and the rift turret bolt both use this; they differ only
 * in the values they pass (speed, life, color, element).
 */
export function createProjectile(p: Projectile): Projectile {
  return {
    cardId: p.cardId,
    instanceId: p.instanceId,
    id: p.id,
    zone: p.zone,
    casterId: p.casterId,
    x: p.x,
    y: p.y,
    targetX: p.targetX,
    targetY: p.targetY,
    targetId: p.targetId,
    targetType: p.targetType,
    vx: p.vx,
    vy: p.vy,
    damage: p.damage,
    splash: p.splash,
    crit: p.crit,
    element: p.element,
    life: p.life,
    color: p.color
  };
}

/** Loot lying on the ground: an item (by ITEMS id or custom data) or gold. It despawns after ITEM_DESPAWN_MS. */
export function createGroundItem(o: { id: string; zone: string; type: string; itemIdOrName: string; x: number; y: number; amount: number; customItemData: any }): GroundItem {
  const baseDef: any = (ITEMS as any)[o.itemIdOrName];
  return {
    id: o.id,
    zone: o.zone,
    type: o.type,
    itemId: o.type === 'item' ? o.itemIdOrName : null,
    name: o.type === 'gold' ? `${Number(o.amount).toLocaleString('en-US')} Gold` : (o.customItemData && o.customItemData.name ? o.customItemData.name : (baseDef ? baseDef.name : o.itemIdOrName)),
    x: o.x,
    y: o.y,
    amount: o.amount,
    customItemData: o.customItemData,
    createdAt: Date.now(),
    expiresAt: Date.now() + ITEM_DESPAWN_MS
  };
}

/** A fresh dungeon run: the generated map plus empty live state (monsters wait in `pendingMobs`, per room). */
export function createDungeonInstance(a: {
  id: string; partyId: string | null; floor: number; difficulty: string; mode: string; mods: string[]; modReward: any;
  dungeon: any; pendingMobs: Map<number, any[]>; chests: any[]; bossRoomIdx: number; totalTrashMobs: number; requiredKills: number;
}): DungeonInstance {
  return {
    id: a.id,
    partyId: a.partyId,
    floor: a.floor,
    difficulty: a.difficulty,
    mode: a.mode,
    mods: a.mods,                       // dungeon modifiers (dungeonMods.ts)
    modReward: a.modReward,
    dungeon: a.dungeon,
    mobs: new Map<any, any>(),
    pendingMobs: a.pendingMobs,
    groundItems: new Map<any, any>(),
    chests: a.chests,
    cleared: false,
    startedAt: Date.now(),
    bossRoomIdx: a.bossRoomIdx,
    totalTrashMobs: a.totalTrashMobs,
    requiredKills: a.requiredKills,
    killedTrashCount: 0,
    killPercent: 0,
    bossPortalReady: false,
    bossPortalSpawned: false,
    bossPortalPos: null
  };
}

/** A fresh Eternal Rift run in its preparation phase. */
export function createRiftInstance(a: {
  id: string; partyId: string | null; dungeon: any; baseLevel: number; mode: string; perWave: number; spawnMult: number; fountainHp: number;
}): RiftInstance {
  return {
    id: a.id,
    partyId: a.partyId,
    floor: 0,
    difficulty: 'rift',
    dungeon: a.dungeon,
    mobs: new Map<any, any>(),
    pendingMobs: new Map<any, any>(),
    groundItems: new Map<any, any>(),
    chests: [],
    cleared: false,
    startedAt: Date.now(),
    rift: {
      phase: 'prep', wave: 0, timer: RIFT_PREP_S, baseLevel: a.baseLevel, mode: a.mode, perWave: a.perWave, spawnMult: a.spawnMult,
      fountain: { hp: a.fountainHp, maxHp: a.fountainHp },
      queue: [], spawnEvery: 0.5, spawnClock: 0, gateTurn: 0,
      structures: [], structSeq: 0,
      points: new Map<string, number>(),   // heroId -> Rift Points (gone when they leave)
      banked: new Map<string, any>(),      // heroId -> { gold, essence } paid out at a checkpoint
      choices: new Map<string, string>(),  // heroId -> 'continue' during a checkpoint prompt
      stateClock: 0
    }
  };
}

/** A new party with its leader as the only member. */
export function createParty(id: string, leaderId: string): PartyState {
  return {
    id,
    leaderId,
    memberIds: new Set([leaderId])
  };
}
