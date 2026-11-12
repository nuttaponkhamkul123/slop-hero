// Parties: invites, joining, leaving, kicking, summons and sharing kill EXP.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import { DUNGEON_FLOORS } from '../dungeonGenerator';
import { PARTY_EXP_RANGE, PARTY_SUMMON_TTL_MS } from '../config/constants';
import { createParty } from '../entities/world';

export class PartySystem {
  constructor(private readonly gs: GameServer) {}

  // ==========================================
  // PARTY SYSTEM (Invites, Members, Sharing)
  // ==========================================
  getPartyData(partyId) {
    if (!partyId || !this.gs.parties.has(partyId)) return null;
    const party = this.gs.parties.get(partyId);
    const members = [];
    for (const memberId of party.memberIds) {
      const p = this.gs.players.get(memberId);
      if (p) {
        members.push({
          id: p.id,
          name: p.name,
          level: p.level,
          characterClass: p.characterClass,
          hp: p.hp,
          maxHp: p.maxHp,
          mp: p.mp,
          maxMp: p.maxMp,
          zone: p.zone,
          isLeader: p.id === party.leaderId
        });
      }
    }
    return {
      id: party.id,
      leaderId: party.leaderId,
      members
    };
  }

  broadcastPartyUpdate(partyId) {
    const data = this.gs.getPartyData(partyId);
    if (!data) return;
    const party = this.gs.parties.get(partyId);
    if (!party) return;
    for (const memberId of party.memberIds) {
      const socket = this.gs.io.sockets.sockets.get(memberId);
      if (socket) {
        socket.emit('party_updated', data);
      }
    }
  }

  handlePartyInvite(socketId, data) {
    const player = this.gs.players.get(socketId);
    if (!player || !data) return;
    const socket = this.gs.io.sockets.sockets.get(socketId);

    let targetPlayer = null;
    if (data.targetPlayerId) {
      targetPlayer = this.gs.players.get(data.targetPlayerId);
    } else if (data.targetName) {
      const nameLower = data.targetName.trim().toLowerCase();
      targetPlayer = Array.from(this.gs.players.values()).find(p => p.name.toLowerCase() === nameLower);
    }

    if (!targetPlayer || targetPlayer.id === socketId) {
      if (socket) {
        socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: '⚠️ Player not found!', color: '#ef4444' });
      }
      return;
    }

    if (targetPlayer.partyId) {
      if (socket) {
        socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `⚠️ [${targetPlayer.name}] is already in a party!`, color: '#ef4444' });
      }
      return;
    }

    // Create party if inviter does not have one
    let partyId = player.partyId;
    if (!partyId) {
      partyId = 'party_' + (this.gs.nextPartyId++);
      this.gs.parties.set(partyId, createParty(partyId, player.id));
      player.partyId = partyId;
      this.gs.broadcastPartyUpdate(partyId);
    }

    const party = this.gs.parties.get(partyId);
    if (!party || party.memberIds.size >= 4) {
      if (socket) {
        socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: '⚠️ Party is full! (Max 4 members)', color: '#ef4444' });
      }
      return;
    }

    const targetSocket = this.gs.io.sockets.sockets.get(targetPlayer.id);
    if (targetSocket) {
      targetSocket.emit('party_invite_received', {
        partyId,
        inviterId: player.id,
        inviterName: player.name
      });
      if (socket) {
        socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `📨 Sent party invite to [${targetPlayer.name}]!`, color: '#38bdf8' });
      }
    }
  }

  handlePartyAccept(socketId, data) {
    const player = this.gs.players.get(socketId);
    if (!player || !data || !data.partyId) return;
    const party = this.gs.parties.get(data.partyId);
    if (!party || party.memberIds.size >= 4) {
      const socket = this.gs.io.sockets.sockets.get(socketId);
      if (socket) socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: '⚠️ Party no longer exists or is full!', color: '#ef4444' });
      return;
    }

    if (player.partyId) {
      this.gs.removePlayerFromParty(socketId);
    }

    party.memberIds.add(player.id);
    player.partyId = party.id;
    this.gs.broadcastPartyUpdate(party.id);

    const leaderPlayer = this.gs.players.get(party.leaderId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `⚔️ Joined party of [${leaderPlayer ? leaderPlayer.name : 'Party'}]!`, color: '#4ade80' });
    }
    this.gs.broadcastSystemMessage(`⚔️ [${player.name}] joined the party!`);
  }

  handlePartyDecline(socketId, data) {
    const player = this.gs.players.get(socketId);
    if (!player || !data || !data.inviterId) return;
    const inviterSocket = this.gs.io.sockets.sockets.get(data.inviterId);
    if (inviterSocket) {
      inviterSocket.emit('floating_text', { x: 0, y: 0, text: `[${player.name}] declined party invitation.`, color: '#94a3b8' });
    }
  }

  // Ask every other party member to teleport to this player's map (or dungeon)
  handlePartySummon(socketId) {
    const player = this.gs.players.get(socketId);
    if (!player || player.isDead || !player.partyId) return;
    const party = this.gs.parties.get(player.partyId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!party || party.memberIds.size <= 1) {
      if (socket) socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: '⚠️ No party members to summon!', color: '#ef4444' });
      return;
    }

    const inst = this.gs.getPlayerDungeonInstance(player);
    const field = this.gs.fields.get(player.zone);
    const where = inst ? (inst.rift ? 'the Eternal Rift' : `Dungeon B${inst.floor}`) : field ? field.zone.name : 'Town';
    const expiresAt = Date.now() + PARTY_SUMMON_TTL_MS;
    let sent = 0;
    for (const memberId of party.memberIds) {
      if (memberId === player.id) continue;
      const member = this.gs.players.get(memberId);
      const memberSocket = this.gs.io.sockets.sockets.get(memberId);
      if (!member || !memberSocket) continue;
      if (member.zone === player.zone && member.dungeonInstanceId === player.dungeonInstanceId) continue;
      member.pendingSummon = { fromId: player.id, expiresAt };
      memberSocket.emit('party_summon_received', { fromId: player.id, fromName: player.name, where, isDungeon: !!inst });
      sent++;
    }
    if (socket) {
      socket.emit('floating_text', {
        x: player.x, y: player.y - 0.7,
        text: sent ? `📣 Summoned ${sent} party member${sent > 1 ? 's' : ''} to ${where}!` : '✅ Your party is already here!',
        color: '#38bdf8'
      });
    }
  }

  handlePartySummonAccept(socketId, data) {
    const player = this.gs.players.get(socketId);
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!player || !socket || !data) return;
    const pending = player.pendingSummon;
    player.pendingSummon = null;
    const fail = (text) => socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text, color: '#ef4444' });
    if (!pending || pending.fromId !== data.fromId || Date.now() > pending.expiresAt) return fail('⚠️ The summon has expired.');
    const summoner = this.gs.players.get(pending.fromId);
    if (!summoner || summoner.isDead || !player.partyId || summoner.partyId !== player.partyId) return fail('⚠️ The summoner is no longer available.');
    if (player.isDead) return;

    const at = { x: summoner.x, y: summoner.y };
    const inst = this.gs.getPlayerDungeonInstance(summoner);
    const field = this.gs.fields.get(summoner.zone);
    if (inst) {
      const floorConfig = DUNGEON_FLOORS[inst.floor - 1] || { minLevel: 1 };
      if ((player.level || 1) < floorConfig.minLevel) return fail(`⛔ Requires Level ${floorConfig.minLevel}+ for B${inst.floor}!`);
    } else if (field && (player.level || 1) < field.zone.gateLevel) {
      return fail(`⛔ ${field.zone.name} requires Level ${field.zone.gateLevel}+!`);
    }

    // Leaving another dungeon run counts the same as walking out of it
    if (player.zone === 'dungeon') {
      const prevInstId = player.dungeonInstanceId;
      this.gs.endDungeonRun(player, socket);
      player.dungeonInstanceId = null;
      if (prevInstId) this.gs.cleanupDungeonInstanceIfEmpty(prevInstId);
    }

    if (inst && inst.rift) {
      if (!this.gs.joinRift(player, socket, inst, at)) return fail('⚠️ That Eternal Rift run has already ended.');
    } else if (inst) {
      player.dungeonRun = this.gs.newDungeonRun(inst, !!(summoner.dungeonRun && summoner.dungeonRun.cleared));
      this.gs.teleportPlayerToDungeon(player, socket, inst, at);
      this.gs.emitDungeonRunUpdate(player, socket);
    } else if (field) {
      this.gs.teleportPlayerToField(player, socket, summoner.zone, 'south', at);
    } else {
      this.gs.teleportPlayerToTown(player, socket, at);
    }
    player.portalCooldown = 4.0;
  }

  // Online players who can be invited (not in a party yet)
  handlePartyListCandidates(socketId) {
    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (!socket) return;
    const candidates = Array.from(this.gs.players.values())
      .filter(p => p.id !== socketId && !p.partyId)
      .map(p => ({ id: p.id, name: p.name, level: p.level, characterClass: p.characterClass, zone: p.zone }));
    socket.emit('party_candidates', candidates);
  }

  handlePartyLeave(socketId) {
    this.gs.removePlayerFromParty(socketId);
  }

  handlePartyKick(socketId, data) {
    const player = this.gs.players.get(socketId);
    if (!player || !player.partyId || !data || !data.targetId) return;
    const party = this.gs.parties.get(player.partyId);
    if (!party || party.leaderId !== player.id) return;
    if (data.targetId === player.id) return;

    const targetSocket = this.gs.io.sockets.sockets.get(data.targetId);
    const targetPlayer = this.gs.players.get(data.targetId);
    if (targetSocket && targetPlayer) {
      targetSocket.emit('floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '⚠️ You were removed from the party.', color: '#ef4444' });
    }
    this.gs.removePlayerFromParty(data.targetId);
  }

  removePlayerFromParty(socketId) {
    const player = this.gs.players.get(socketId);
    if (!player || !player.partyId) return;
    const partyId = player.partyId;
    const party = this.gs.parties.get(partyId);
    player.partyId = null;

    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('party_left');
    }

    if (party) {
      party.memberIds.delete(socketId);
      if (party.memberIds.size === 0) {
        this.gs.parties.delete(partyId);
      } else {
        if (party.leaderId === socketId) {
          party.leaderId = Array.from(party.memberIds)[0];
          const newLeader = this.gs.players.get(party.leaderId);
          if (newLeader) {
            this.gs.broadcastSystemMessage(`👑 [${newLeader.name}] is now the Party Leader!`);
          }
        }
        this.gs.broadcastPartyUpdate(partyId);
      }
    }
  }

  // Who shares the EXP of a kill: the killer plus party members who are alive,
  // on the same map (same field zone, or the same dungeon run) and within
  // PARTY_EXP_RANGE tiles of the killer
  partyExpSharers(killer) {
    const party = killer.partyId && this.gs.parties.get(killer.partyId);
    if (!party) return [killer];
    const out = [killer];
    for (const id of party.memberIds) {
      const m = this.gs.players.get(id);
      if (!m || m === killer || m.isDead || m.zone !== killer.zone) continue;
      if (killer.zone === 'dungeon' && m.dungeonInstanceId !== killer.dungeonInstanceId) continue;
      if (Math.hypot(m.x - killer.x, m.y - killer.y) > PARTY_EXP_RANGE) continue;
      out.push(m);
    }
    return out;
  }
}
