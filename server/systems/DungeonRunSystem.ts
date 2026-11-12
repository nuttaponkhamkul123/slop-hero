// Dungeon runs: run state, doors and room spawning, kill progress toward the boss portal, the clear and failure payouts, and the dungeon loot chests.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import { rollDungeonLoot, DUNGEON_FLOORS, DUNGEON_TILES } from '../dungeonGenerator';
import { baseExpCurve } from '../progression';
import { dungeonProgressWeight, DUNGEON_SPAWN_MS, FAILED_RUN_LOOT_KEEP, RUN_PAR_BASE_SEC, RUN_PAR_PER_ROOM_SEC, RUN_RANK_MULT } from '../config/constants';
import type { Player, DungeonInstance, Mob } from '../entities/types';

export class DungeonRunSystem {
  constructor(private readonly gs: GameServer) {}

  getPlayerDungeonInstance(player: Player) {
    if (!player || player.zone !== 'dungeon' || !player.dungeonInstanceId) return null;
    return this.gs.dungeonInstances.get(player.dungeonInstanceId) || null;
  }

  newDungeonRun(inst: DungeonInstance, cleared = false) {
    return {
      floor: inst.floor, difficulty: inst.difficulty, cleared, gold: 0, items: [] as any,
      startedAt: inst.startedAt || Date.now(), deaths: 0, kills: 0, exp: 0,
      revivalsUsed: 0, maxRevivals: 10
    };
  }

  // Doors open as rooms are cleared: every door leading on from a cleared room
  // unlocks, the boss door included (side rooms don't have to be cleared).
  // A room's monsters spawn when a door into it opens, so a room is cleared
  // only once it has spawned and all its monsters are dead.
  updateDungeonRooms(inst: DungeonInstance) {
    const dung = inst.dungeon;
    if (!dung || !dung.doors || !dung.rooms) return;
    if (!inst.roomsCleared) inst.roomsCleared = new Set();
    if (!inst.roomsSpawned) inst.roomsSpawned = new Set();
    const newlyCleared = [];
    const opened = [];
    const spawned = [];
    if (!inst.roomsSpawned.has(0)) spawned.push(...this.gs.spawnDungeonRoom(inst, 0));

    // An opened room with no monsters (treasure) is clear straight away and
    // opens its own doors, so repeat until nothing changes
    for (let pass = 0; pass <= dung.rooms.length; pass++) {
      const alive = new Map<any, any>();
      for (const m of inst.mobs.values()) {
        if (m.roomIdx !== undefined && m.state !== 'dead' && m.hp > 0) alive.set(m.roomIdx, (alive.get(m.roomIdx) || 0) + 1);
      }
      let progress = false;
      for (const i of inst.roomsSpawned) {
        if (!inst.roomsCleared.has(i) && !alive.get(i)) {
          inst.roomsCleared.add(i);
          newlyCleared.push(i);
          progress = true;
        }
      }
      for (const d of dung.doors) {
        if (d.open || !inst.roomsCleared.has(d.from)) continue;
        d.open = true;
        for (const [x, y] of d.tiles) dung.tiles[y][x] = DUNGEON_TILES.FLOOR;
        dung.obstacles = dung.obstacles.filter((o: any) => o.id !== d.id);
        opened.push({ id: d.id, tiles: d.tiles, boss: d.boss, x: d.x, y: d.y });
        if (!inst.roomsSpawned.has(d.to)) {
          spawned.push(...this.gs.spawnDungeonRoom(inst, d.to));
          // Rush mode: the door opens onto ONE long hall, so every chamber of it fills at once
          if (dung.rooms[d.to] && dung.rooms[d.to].rush) {
            dung.rooms.forEach((r: any, ri: any) => { if (r.rush && !inst.roomsSpawned.has(ri)) spawned.push(...this.gs.spawnDungeonRoom(inst, ri)); });
          }
        }
        progress = true;
      }
      if (!progress) break;
    }
    if (!newlyCleared.length && !opened.length) return;

    const bossIdx = dung.rooms.length - 1;
    // If all monster rooms are cleared, ensure killPercent is 100% and boss portal is ready
    if (inst.roomsCleared && dung.rooms && inst.roomsCleared.size >= dung.rooms.length - 1) {
      inst.killPercent = 100;
      if (!inst.bossPortalReady) {
        inst.bossPortalReady = true;
        this.gs.emitZone('dungeon', 'floating_text', {
          x: dung.rooms[0].cx + 0.5,
          y: dung.rooms[0].cy - 1.2,
          text: '🌀 BOSS PORTAL READY (100%)!',
          color: '#c084fc',
          size: 24
        }, inst.id);
      }
    }
    if (!inst.announce) return; // first pass at creation: nobody to tell yet
    if (spawned.length) this.gs.emitZone('dungeon', 'dungeon_mobs_spawned', { mobs: spawned }, inst.id);
    for (const i of newlyCleared) {
      if (i === 0 || i === bossIdx || dung.rooms[i].rush) continue;
      const r = dung.rooms[i];
      this.gs.emitZone('dungeon', 'floating_text', { x: r.cx + 0.5, y: r.cy, text: 'ROOM CLEARED', color: '#4ade80', size: 22 }, inst.id);
    }
    if (opened.length) {
      this.gs.emitZone('dungeon', 'dungeon_doors_opened', { doors: opened }, inst.id);
      if (opened.some(d => d.boss)) {
        const bd = opened.find(d => d.boss);
        this.gs.emitZone('dungeon', 'floating_text', { x: bd.x, y: bd.y - 0.5, text: 'THE BOSS ROOM IS OPEN', color: '#ef4444', size: 24 }, inst.id);
      }
    }
    for (const p of this.gs.players.values()) {
      if (p.zone === 'dungeon' && p.dungeonInstanceId === inst.id) this.gs.emitDungeonRunUpdate(p);
    }
  }

  // Bring a room's waiting monsters into the instance. Once the run is live
  // they rise for DUNGEON_SPAWN_MS (no AI) while clients play the summon effect.
  // Returns what clients need for that effect.
  spawnDungeonRoom(inst: DungeonInstance, roomIdx: any) {
    inst.roomsSpawned.add(roomIdx);
    const list = (inst.pendingMobs && inst.pendingMobs.get(roomIdx)) || [];
    if (inst.pendingMobs) inst.pendingMobs.delete(roomIdx);
    const until = inst.announce ? Date.now() + DUNGEON_SPAWN_MS : 0;
    return list.map((m: any) => {
      m.spawnUntil = until;
      m.dungeonInstanceId = inst.id;   // so a death with no killer (burn, poison) still finds its run
      inst.mobs.set(m.id, m);
      return { id: m.id, x: m.x, y: m.y, isBoss: !!m.isBoss, element: m.element || 'neutral' };
    });
  }

  cleanupDungeonInstanceIfEmpty(instanceId: any) {
    if (!instanceId || !this.gs.dungeonInstances.has(instanceId)) return;
    const hasPlayers = Array.from(this.gs.players.values()).some(p => p.zone === 'dungeon' && p.dungeonInstanceId === instanceId);
    if (!hasPlayers) {
      this.gs.dungeonInstances.delete(instanceId);
    }
  }

  // Handle Opening Treasure Chests in Dungeon
  handleOpenChest(socketId: any, chestId: any) {
    const player = this.gs.players.get(socketId);
    if (!player || player.zone !== 'dungeon' || player.isDead) return;

    const inst = this.gs.getPlayerDungeonInstance(player);
    const chests = inst ? inst.chests : this.gs.dungeon.chests;
    const chestFloor = inst ? inst.floor : this.gs.dungeonFloor;
    const chestDifficulty = inst ? inst.difficulty : this.gs.dungeonDifficulty;
    const chest = chests.find((c: any) => c.id === chestId);
    // Every party member loots each chest once for themselves
    if (!chest) return;
    if (!chest.openedBy) chest.openedBy = [];
    if (chest.openedBy.includes(player.id)) return;

    const dist = Math.hypot(chest.x - player.x, chest.y - player.y);
    if (dist <= 2.5) {
      chest.openedBy.push(player.id);
      const loot = rollDungeonLoot(chest.isGold, chestFloor, player.characterClass);
      const socket = this.gs.io.sockets.sockets.get(socketId);

      // Chest loot is only secured once the dungeon is cleared: until the boss
      // falls it is held in the run's loot bag (see endDungeonRun).
      if (!player.dungeonRun) {
        player.dungeonRun = inst ? this.gs.newDungeonRun(inst) : { floor: chestFloor, difficulty: chestDifficulty, cleared: false, gold: 0, items: [], startedAt: Date.now(), deaths: 0, kills: 0, exp: 0 };
      }
      const run = player.dungeonRun;
      loot.forEach((it) => {
        if (run.cleared) {
          this.gs.giveLootToPlayer(player, it);
        } else if (it.type === 'gold') {
          run.gold += it.amount;
        } else {
          run.items.push(it);
        }
      });
      if (run.cleared && socket) socket.emit('player_updated', player);
      this.gs.emitDungeonRunUpdate(player, socket);

      if (!socket) return;
      socket.emit('chest_opened', { chestId, openedBy: player.name });
      socket.emit('floating_text', {
        x: chest.x,
        y: chest.y - 0.8,
        text: run.cleared ? '💎 Chest Unlocked!' : '💎 Loot bagged - defeat the boss to secure it!',
        color: '#facc15'
      });
    }
  }

  emitDungeonRunUpdate(player: any, socket?: any) {
    socket = socket || this.gs.io.sockets.sockets.get(player.id);
    if (!socket) return;
    const run = player.dungeonRun;
    const inst = this.gs.getPlayerDungeonInstance(player);
    socket.emit('dungeon_run_update', run ? {
      active: true,
      cleared: run.cleared,
      gold: run.gold,
      items: run.items.map((it: any) => this.gs.lootEntryName(it)),
      lootItems: run.items.map((it: any) => this.gs.lootEntryToItem(it)),
      startedAt: run.startedAt,
      serverNow: Date.now(),
      clearedMs: run.clearedAt ? run.clearedAt - run.startedAt : null,
      floor: run.floor,
      difficulty: run.difficulty,
      deaths: run.deaths || 0,
      roomsCleared: inst && inst.roomsCleared ? inst.roomsCleared.size : 0,
      mode: inst && inst.mode ? inst.mode : 'classic',
      mods: inst && inst.mods ? inst.mods : [],
      modReward: inst ? (inst.modReward || 0) : 0,
      roomsTotal: inst && inst.dungeon.rooms ? inst.dungeon.rooms.length : 0,
      clearedRooms: inst && inst.roomsCleared ? [...inst.roomsCleared] : [], // minimap ticks
      killPercent: inst ? (inst.killPercent || 0) : 0,
      killedMobs: inst ? (inst.killedTrashCount || 0) : 0,
      requiredMobs: inst ? (inst.requiredKills || 0) : 0,
      bossPortalReady: !!(inst && inst.bossPortalReady),
      bossPortalSpawned: !!(inst && inst.bossPortalSpawned)
    } : { active: false });
  }

  // Boss defeated: everything in the loot bag is secured immediately.
  completeDungeonRun(player: Player) {
    const run = player.dungeonRun;
    if (!run || run.cleared) return;
    run.cleared = true;
    run.clearedAt = Date.now();
    const secured = [];
    const securedItems = [];
    if (run.gold > 0) {
      this.gs.giveLootToPlayer(player, { type: 'gold', amount: run.gold }, false);
      secured.push(`${run.gold.toLocaleString('en-US')} Gold`);
      securedItems.push({ id: 'gold', name: `${run.gold.toLocaleString('en-US')} Gold`, count: run.gold, type: 'gold', rarity: 'common' });
    }
    run.items.forEach((it: any) => {
      this.gs.giveLootToPlayer(player, it, false);
      secured.push(this.gs.lootEntryName(it));
      securedItems.push(this.gs.lootEntryToItem(it));
    });
    const chestGold = run.gold;
    run.gold = 0;
    run.items = [];

    // Grade the clear: deaths and running over par time cost points
    const inst = this.gs.getPlayerDungeonInstance(player);
    const roomsTotal = inst && inst.dungeon.rooms ? inst.dungeon.rooms.length : 0;
    const timeMs = Date.now() - (run.startedAt || Date.now());
    const parSec = RUN_PAR_BASE_SEC + roomsTotal * RUN_PAR_PER_ROOM_SEC;
    const overPar = Math.max(0, timeMs / 1000 - parSec) / parSec;
    const score = 100 - (run.deaths || 0) * 12 - Math.min(40, overPar * 40);
    const rank = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : 'C';
    const mult = RUN_RANK_MULT[rank];
    const bonusGold = Math.round(run.floor * 120 * mult);
    const bonusExp = Math.round(baseExpCurve(player.level || 1) * 0.06 * mult);
    const runExp = run.exp || 0;
    player.gold += bonusGold;
    this.gs.awardExp(player, bonusExp);

    const floorConfig: any = DUNGEON_FLOORS[run.floor - 1] || {};
    const socket = this.gs.io.sockets.sockets.get(player.id);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('dungeon_result', {
        success: true, kept: secured, keptItems: securedItems, lost: [], lostItems: [],
        rank, timeMs, deaths: run.deaths || 0, kills: run.kills || 0,
        floor: run.floor, difficulty: run.difficulty, floorName: floorConfig.name, bossName: floorConfig.bossName,
        roomsTotal, roomsCleared: inst && inst.roomsCleared ? inst.roomsCleared.size : roomsTotal,
        rewards: { chestGold, bonusGold, runExp, bonusExp }
      });
    }
    this.gs.emitDungeonRunUpdate(player, socket);
  }

  // Leaving the dungeon. Without a boss kill the run counts as failed and only
  // FAILED_RUN_LOOT_KEEP of the escrowed chest loot is kept.
  endDungeonRun(player: Player, socket: any) {
    const run = player.dungeonRun;
    player.dungeonRun = null;
    socket = socket || this.gs.io.sockets.sockets.get(player.id);
    if (!run) return;
    if (run.cleared) {
      this.gs.emitDungeonRunUpdate(player, socket);
      return;
    }

    const kept = [];
    const lost = [];
    const keptItems = [];
    const lostItems = [];
    const keptGold = Math.floor(run.gold * FAILED_RUN_LOOT_KEEP);
    if (keptGold > 0) {
      this.gs.giveLootToPlayer(player, { type: 'gold', amount: keptGold }, false);
      kept.push(`${keptGold.toLocaleString('en-US')} Gold`);
      keptItems.push({ id: 'gold', name: `${keptGold.toLocaleString('en-US')} Gold`, count: keptGold, type: 'gold', rarity: 'common' });
    }
    if (run.gold - keptGold > 0) {
      const lostGold = run.gold - keptGold;
      lost.push(`${lostGold.toLocaleString('en-US')} Gold`);
      lostItems.push({ id: 'gold', name: `${lostGold.toLocaleString('en-US')} Gold`, count: lostGold, type: 'gold', rarity: 'common' });
    }

    const shuffled = [...run.items].sort(() => Math.random() - 0.5);
    const keepCount = Math.floor(shuffled.length * FAILED_RUN_LOOT_KEEP);
    shuffled.forEach((it, i) => {
      const itemObj = this.gs.lootEntryToItem(it);
      if (i < keepCount) {
        this.gs.giveLootToPlayer(player, it, false);
        kept.push(this.gs.lootEntryName(it));
        if (itemObj) keptItems.push(itemObj);
      } else {
        lost.push(this.gs.lootEntryName(it));
        if (itemObj) lostItems.push(itemObj);
      }
    });

    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('dungeon_result', { success: false, kept, lost, keptItems, lostItems });
    }
    this.gs.broadcastSystemMessage(`💀 [${player.name}] failed the dungeon run on B${run.floor}.`);
    this.gs.emitDungeonRunUpdate(player, socket);
  }

  // Dungeon progress toward the boss portal: a weighted kill count (dungeonProgressWeight)
  countDungeonProgress(mob: Mob, instId: any, killerPlayer: Player) {
    const inst = instId ? this.gs.dungeonInstances.get(instId) : null;
    if (!inst || inst.cleared || mob.progressCounted || mob.isBoss || mob.roomIdx === undefined || mob.roomIdx === inst.bossRoomIdx) return;
    mob.progressCounted = true;
    inst.killedTrashCount = (inst.killedTrashCount || 0) + dungeonProgressWeight(mob);
    const req = Math.max(1, inst.requiredKills || 1);
    inst.killPercent = Math.min(100, Math.floor((inst.killedTrashCount / req) * 100));

    if (inst.killPercent >= 100 && !inst.bossPortalReady) {
      inst.bossPortalReady = true;
      this.gs.emitZone('dungeon', 'floating_text', {
        x: killerPlayer ? killerPlayer.x : mob.x,
        y: (killerPlayer ? killerPlayer.y : mob.y) - 1.2,
        text: '🌀 BOSS PORTAL READY (100%)!',
        color: '#c084fc',
        size: 24
      }, instId);
    }
    for (const p of this.gs.players.values()) {
      if (p.zone === 'dungeon' && p.dungeonInstanceId === instId) this.gs.emitDungeonRunUpdate(p);
    }
  }
}
