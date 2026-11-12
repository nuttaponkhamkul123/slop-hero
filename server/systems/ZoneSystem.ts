// Moving between zones: portals, teleports to town, fields and dungeons, entering and leaving a dungeon, the boss portal, and the monster set-up of fields and the legacy dungeon.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import { generateProceduralDungeon, DIFFICULTIES, DUNGEON_FLOORS } from '../dungeonGenerator';
import { buildFieldMobs } from '../fieldZones';
import * as DMODS from '../dungeonMods';
import { mobInView, PORTAL_USE_RANGE } from '../config/constants';
import { MobFactory } from '../entities/mob';
import type { Mob, Player, DungeonInstance } from '../entities/types';

export class ZoneSystem {
  constructor(private readonly gs: GameServer) {}

  initFieldMonsters() {
    for (const field of this.gs.fields.values()) {
      const defs = buildFieldMobs(field.zone, field.map);
      if (!defs) continue;
      field.mobs.clear();
      defs.forEach(def => {
        const id = `${field.zone.id}_mob_${this.gs.nextEntityId++}`;
        field.mobs.set(id, MobFactory.field(def, field.zone.id, id));
      });
    }
  }

  initDungeonMonsters() {
    this.gs.dungeonMobs.clear();
    if (this.gs.dungeon && this.gs.dungeon.mobs) {
      this.gs.dungeon.mobs.forEach((mob: Mob) => {
        this.gs.dungeonMobs.set(mob.id, MobFactory.dungeonMob(mob, 12));
      });
    }
  }

  regenerateDungeon(floor = 1, difficulty = 'normal') {
    this.gs.dungeonFloor = floor;
    this.gs.dungeonDifficulty = difficulty;
    this.gs.dungeon = generateProceduralDungeon(floor, difficulty);
    this.gs.dungeonGroundItems.clear();
    this.gs.initDungeonMonsters();
    const floorConfig = DUNGEON_FLOORS[floor - 1] || { name: `Floor ${floor}` };
    const diffLabel = ((DIFFICULTIES as any)[difficulty] && (DIFFICULTIES as any)[difficulty].name) || difficulty;
    this.gs.broadcastSystemMessage(`🌀 Abyssal Portal re-aligned to ${floorConfig.name} (B${floor}) [${diffLabel.toUpperCase()}]!`);
  }

  // Portals no longer fire by walking onto them: the client shows a button
  // near one and sends 'use_portal' (handleUsePortal)
  handleUsePortal(socketId: any) {
    const player = this.gs.players.get(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead) return;
    this.gs.checkPortalAndInteractions(player, socket);
  }

  checkPortalAndInteractions(player: Player, socket: any) {
    if (player.portalCooldown > 0) return;

    if (player.zone === 'town') {
      for (const obs of this.gs.townMap.obstacles) {
        if (Math.hypot(player.x - obs.x, player.y - obs.y) >= PORTAL_USE_RANGE) continue;
        // Abyssal Dungeon Portal on the plaza
        if (obs.id === 'portal_dungeon') {
          player.portalCooldown = 2.0;
          socket.emit('open_dungeon_portal_modal');
          return;
        }
        // Eternal Rift gate at the end of the east boulevard
        if (obs.id === 'portal_rift') {
          player.portalCooldown = 2.0;
          socket.emit('open_rift_portal_modal', this.gs.riftPortalInfo(player));
          return;
        }
        // North city gate out to the first field zone
        if (obs.type === 'field_portal') {
          this.gs.teleportPlayerToField(player, socket, obs.target, obs.arrive);
          return;
        }
      }
    } else if (this.gs.fields.has(player.zone)) {
      // Field zone portals: back to the previous zone / on to the next one
      const map = this.gs.fields.get(player.zone).map;
      for (const obs of map.obstacles) {
        if (obs.type !== 'field_portal') continue;
        if (Math.hypot(player.x - obs.x, player.y - obs.y) >= PORTAL_USE_RANGE) continue;
        if (obs.target === 'town') this.gs.teleportPlayerToTown(player, socket, this.gs.townMap.arrivals && this.gs.townMap.arrivals[obs.arrive]);
        else this.gs.teleportPlayerToField(player, socket, obs.target, obs.arrive);
        return;
      }
    } else if (player.zone === 'dungeon') {
      const inst = this.gs.getPlayerDungeonInstance(player);
      if (inst && inst.dungeon && inst.dungeon.obstacles) {
        for (const obs of inst.dungeon.obstacles) {
          if (obs.type !== 'dungeon_boss_portal') continue;
          if (Math.hypot(player.x - obs.x, player.y - obs.y) >= PORTAL_USE_RANGE) continue;
          if (obs.isReturn) {
            this.gs.teleportPlayerFromBossRoom(player, socket, inst);
          } else {
            this.gs.teleportPlayerToBossRoom(player, socket, inst);
          }
          return;
        }
      }
    }
  }

  handleSpawnBossPortal(socketId: any) {
    const player = this.gs.players.get(socketId);
    if (!player || player.zone !== 'dungeon' || player.isDead) return;
    const inst = this.gs.getPlayerDungeonInstance(player);
    if (!inst || !inst.bossPortalReady || inst.bossPortalSpawned) return;

    const portalX = Math.round(player.x) + 0.5;
    const portalY = Math.round(player.y) + 0.5;
    const portalObstacle = {
      id: 'portal_boss',
      x: portalX,
      y: portalY,
      type: 'dungeon_boss_portal',
      isReturn: false,
      collidable: false
    };

    inst.bossPortalPos = { x: portalX, y: portalY };
    inst.bossPortalSpawned = true;
    if (!inst.dungeon.obstacles) inst.dungeon.obstacles = [];
    inst.dungeon.obstacles.push(portalObstacle);

    this.gs.emitZone('dungeon', 'boss_portal_spawned', { portal: portalObstacle }, inst.id);
    this.gs.emitZone('dungeon', 'floating_text', {
      x: portalX,
      y: portalY - 1.2,
      text: '🌀 BOSS PORTAL OPENED!',
      color: '#c084fc',
      size: 24
    }, inst.id);
    this.gs.broadcastSystemMessage(`🌀 [${player.name}] summoned the Boss Portal!`);

    for (const p of this.gs.players.values()) {
      if (p.zone === 'dungeon' && p.dungeonInstanceId === inst.id) {
        this.gs.emitDungeonRunUpdate(p);
      }
    }
  }

  teleportPlayerToBossRoom(player: any, socket: any, inst: any) {
    if (!inst || !inst.dungeon || !inst.dungeon.rooms) return;
    const bossRoom = inst.dungeon.rooms[inst.dungeon.rooms.length - 1];
    if (!bossRoom) return;

    const destX = bossRoom.cx + 0.5;
    const destY = bossRoom.y + bossRoom.h - 2.5;

    player.x = destX;
    player.y = destY;
    player.targetX = null;
    player.targetY = null;
    player.portalCooldown = 2.0;

    const bossIdx = inst.dungeon.rooms.length - 1;
    if (!inst.roomsSpawned.has(bossIdx)) {
      const spawned = this.gs.spawnDungeonRoom(inst, bossIdx);
      if (spawned.length) {
        this.gs.emitZone('dungeon', 'dungeon_mobs_spawned', { mobs: spawned }, inst.id);
      }
      this.gs.emitZone('dungeon', 'floating_text', {
        x: bossRoom.cx + 0.5,
        y: bossRoom.cy - 1.5,
        text: '⚔️ BOSS ENCOUNTER!',
        color: '#ef4444',
        size: 28
      }, inst.id);
    }

    if (socket) socket.emit('player_teleport', { id: player.id, x: player.x, y: player.y });
    this.gs.emitZone('dungeon', 'player_teleport', { id: player.id, x: player.x, y: player.y }, inst.id);
    if (socket) socket.emit('floating_text', { x: player.x, y: player.y - 1.0, text: 'ENTERED BOSS LAIR!', color: '#f43f5e' });
  }

  teleportPlayerFromBossRoom(player: any, socket: any, inst: any) {
    if (!inst || !inst.dungeon) return;
    const returnPos = inst.bossPortalPos || inst.dungeon.spawnPoint || { x: player.x, y: player.y };

    player.x = returnPos.x;
    player.y = returnPos.y;
    player.targetX = null;
    player.targetY = null;
    player.portalCooldown = 2.0;

    if (socket) socket.emit('player_teleport', { id: player.id, x: player.x, y: player.y });
    this.gs.emitZone('dungeon', 'player_teleport', { id: player.id, x: player.x, y: player.y }, inst.id);
    if (socket) socket.emit('floating_text', { x: player.x, y: player.y - 1.0, text: 'RETURNED TO DUNGEON', color: '#38bdf8' });
  }

  handleEnterDungeon(socketId: any, options: any = {}) {
    const player = this.gs.players.get(socketId);
    if (!player || player.zone !== 'town' || player.isDead) return;
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!socket) return;

    // Party members join the dungeon their party already has open
    const partyInst = player.partyId ? this.gs.dungeonInstances.get(`party_${player.partyId}`) : null;
    const floor = partyInst ? partyInst.floor : Math.max(1, Math.min(10, parseInt(options.floor, 10) || 1));
    const floorConfig = DUNGEON_FLOORS[floor - 1] || { minLevel: 1 };

    // Strict level gate: prevent low level players from skipping to high level floors
    if ((player.level || 1) < floorConfig.minLevel) {
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: `⛔ Requires Level ${floorConfig.minLevel}+!`,
        color: '#ef4444'
      });
      return;
    }

    const difficulty = partyInst ? partyInst.difficulty
      : (['normal', 'hard', 'nightmare'].includes(options.difficulty) ? options.difficulty : 'normal');
    // classic labyrinth, or Rush (one super long hall holding every monster); a party joins the leader's mode
    const mode = partyInst ? (partyInst.mode || 'classic') : (options.mode === 'rush' ? 'rush' : 'classic');

    // modifiers picked at the portal; a party member gets the leader's
    const mods = partyInst ? (partyInst.mods || []) : DMODS.parseMods(options.mods);
    const inst = this.gs.getOrCreateDungeonInstance(player, floor, difficulty, false, mode, mods);
    if (partyInst) {
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `⚔️ Joining your party in B${inst.floor}!`, color: '#4ade80' });
    }
    player.dungeonInstanceId = inst.id;
    player.dungeonRun = this.gs.newDungeonRun(inst);
    this.gs.teleportPlayerToDungeon(player, socket, inst);
    this.gs.emitDungeonRunUpdate(player, socket);
    if (options.inviteParty) this.gs.handlePartySummon(socketId);
  }

  handleLeaveDungeon(socketId: any) {
    const player = this.gs.players.get(socketId);
    if (!player || player.zone !== 'dungeon' || player.isDead) return;
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!socket) return;

    const inst = this.gs.getPlayerDungeonInstance(player);
    if (inst && inst.rift) {
      this.gs.leaveRift(player, socket);
      return;
    }
    const dung = inst ? inst.dungeon : this.gs.dungeon;
    const mobsMap = inst ? inst.mobs : this.gs.dungeonMobs;

    if (dung && dung.bossRoom) {
      const br = dung.bossRoom;
      const inBossRoom = (player.x >= br.x - 1 && player.x <= br.x + br.w + 1 && player.y >= br.y - 1 && player.y <= br.y + br.h + 1);
      if (inBossRoom) {
        const bossMob = (Array.from(mobsMap.values()) as any[]).find(m => m.isBoss && m.state !== 'dead' && m.hp > 0);
        if (bossMob) {
          socket.emit('floating_text', {
            x: player.x,
            y: player.y - 0.8,
            text: `🔒 มิติปิดผนึก! ต้องกำจัดบอสก่อนจึงจะออกจากห้องบอสได้`,
            color: '#ef4444',
            size: 18
          });
          return;
        }
      }
    }

    const prevInstanceId = player.dungeonInstanceId;
    player.dungeonInstanceId = null;
    if (prevInstanceId) {
      this.gs.cleanupDungeonInstanceIfEmpty(prevInstanceId);
    }
    this.gs.teleportPlayerToTown(player, socket);
  }

  teleportPlayerToDungeon(player: Player, socket: any, inst: DungeonInstance = null, at: any = null) {
    if (!inst) {
      inst = this.gs.getPlayerDungeonInstance(player) || this.gs.getOrCreateDungeonInstance(player);
    }
    player.dungeonInstanceId = inst.id;
    player.portalCooldown = 4.0;
    player.zone = 'dungeon';
    player.x = at ? at.x : inst.dungeon.spawnPoint.x;
    player.y = at ? at.y : inst.dungeon.spawnPoint.y;
    player.targetX = null;
    player.targetY = null;

    if (socket) {
      if (player._room) socket.leave(player._room);
      player._room = `dungeon:${inst.id}`;
      socket.join(player._room);

      socket.emit('zone_change', {
        zone: 'dungeon',
        // the generator's raw mob list rides on the map object; clients use the live `mobs` below
        map: { ...inst.dungeon, mobs: undefined },
        floorLevel: inst.floor,
        difficulty: inst.difficulty,
        player,
        players: Array.from(this.gs.players.values()).filter(p => p.zone === 'dungeon' && p.dungeonInstanceId === inst.id),
        // big floors hold thousands of mobs: send the living ones in view (game_tick adds the rest as they come into view)
        mobs: (Array.from(inst.mobs.values()) as any[]).filter(m => m.state !== 'dead' && (m.isBoss || mobInView(m, player))),
        groundItems: Array.from(inst.groundItems.values()),
        chests: inst.chests
      });
    }

    const floorConfig = DUNGEON_FLOORS[inst.floor - 1] || { name: `Floor ${inst.floor}` };
    const diffName = ((DIFFICULTIES as any)[inst.difficulty] && (DIFFICULTIES as any)[inst.difficulty].name) || inst.difficulty;
    this.gs.sendDirectMessage(player.id, `🌀 [${player.name}] entered ${floorConfig.name} (B${inst.floor} - ${diffName})!`);
  }

  // Move a player into a field zone, arriving at its south (from the previous
  // zone) or north (coming back from the next zone) portal.
  teleportPlayerToField(player: Player, socket: any, zoneId: any, arrive = 'south', at: any = null) {
    const field = this.gs.fields.get(zoneId);
    if (!field) return;
    const zone = field.zone;
    if ((player.level || 1) < zone.gateLevel) {
      player.portalCooldown = 2.0;
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `⛔ ${zone.name} requires Level ${zone.gateLevel}+!`, color: '#ef4444' });
      return;
    }

    const spot = at || (field.map.arrivals && field.map.arrivals[arrive]) || field.map.spawnPoint || { x: 21, y: 32 };
    player.portalCooldown = 4.0;
    player.zone = zoneId;
    player.x = spot.x;
    player.y = spot.y;
    player.targetX = null;
    player.targetY = null;

    socket.emit('zone_change', {
      zone: zoneId,
      zoneName: zone.name,
      zoneLevel: `Lv. ${zone.minLevel}-${zone.maxLevel}`,
      map: field.map,
      player,
      players: Array.from(this.gs.players.values()).filter(p => p.zone === zoneId),
      // the living mobs in view; game_tick adds the rest as they come into view
      mobs: (Array.from(field.mobs.values()) as any[]).filter(m => m.state !== 'dead' && (m.isBoss || mobInView(m, player))),
      groundItems: Array.from(field.groundItems.values()),
      raid: this.gs.raidInfo(zoneId)
    });

    this.gs.sendDirectMessage(player.id, `🧭 [${player.name}] ventured into ${zone.name} (Lv. ${zone.minLevel}-${zone.maxLevel})!`);
  }

  teleportPlayerToFrostfell(player: Player, socket: any) {
    this.gs.teleportPlayerToField(player, socket, 'frostfell', 'south');
  }

  teleportPlayerToTown(player: Player, socket: any, at: any = null) {
    if (player.zone === 'dungeon') {
      const prevInstId = player.dungeonInstanceId;
      player.dungeonInstanceId = null;
      if (prevInstId) this.gs.cleanupDungeonInstanceIfEmpty(prevInstId);
      this.gs.endDungeonRun(player, socket);
    }
    player.portalCooldown = 4.0; // 4 second cooldown prevents bounce-back
    player.zone = 'town';
    player.x = at ? at.x : 21.0;
    player.y = at ? at.y : 19.0;
    player.targetX = null;
    player.targetY = null;

    socket.emit('zone_change', {
      zone: 'town',
      map: this.gs.townMap,
      player,
      players: Array.from(this.gs.players.values()).filter(p => p.zone === 'town'),
      mobs: Array.from(this.gs.townMobs.values()),
      groundItems: Array.from(this.gs.townGroundItems.values())
    });

    this.gs.sendDirectMessage(player.id, `🏰 [${player.name}] returned safely to town.`);
  }
}
