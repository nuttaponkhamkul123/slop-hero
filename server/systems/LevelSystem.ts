// Experience and levelling, plus the passive tree: allocate, refund, respec and the free refund of broken builds.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import { expToNext } from '../progression';
import { PASSIVE_REFUND_COST } from '../config/constants';
const PASSIVES = require('../talents');

export class LevelSystem {
  constructor(private readonly gs: GameServer) {}

  handleAllocateSkillPoint(socketId, skillId) {
    this.gs.handleAllocatePassives(socketId, [skillId]);
  }

  // Allocate passive nodes in order (a path the client picked). Each node must touch the class
  // start or a node already owned (including ones earlier in this same path); one point each.
  handleAllocatePassives(socketId, ids) {
    const player = this.gs.players.get(socketId);
    if (!player || player.isDead || !Array.isArray(ids)) return;
    if (!player.skills) player.skills = {};
    const socket = this.gs.io.sockets.sockets.get(socketId);
    const learned = [];
    let error = '';
    for (const id of ids.slice(0, 200)) {
      if (!player.skillPoints || player.skillPoints <= 0) { error = '⚠️ Not enough passive points!'; break; }
      const node = PASSIVES.BY_ID.get(String(id));
      if (!node) break;
      if (!PASSIVES.canAllocate(player.characterClass, player.skills, node.id)) {
        error = (player.skills[node.id] || 0) > 0 ? '' : '⚠️ Connect it to a passive you already have!';
        break;
      }
      player.skillPoints--;
      player.skills[node.id] = 1;
      learned.push(node);
    }
    if (learned.length) this.gs.recalculatePlayerStats(player);
    if (!socket) return;
    if (learned.length) socket.emit('player_updated', player);
    // always resync: the client may have optimistically added the points
    socket.emit('skill_tree_updated', { skillPoints: player.skillPoints, skills: player.skills });
    if (error) socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: error, color: '#ef4444' });
    if (!learned.length) return;
    const big = learned.filter(n => n.kind === 'notable' || n.kind === 'keystone');
    const label = big.length ? big.map(n => n.name).join(', ') : learned[learned.length - 1].name;
    socket.emit('floating_text', {
      x: player.x,
      y: player.y - 0.7,
      text: `✨ ${learned.length > 1 ? `+${learned.length} passives: ` : ''}[${label}]`,
      color: '#facc15'
    });
    if (big.length) this.gs.sendDirectMessage(player.id, `🌳 [${player.name}] allocated [${big.map(n => n.name).join('], [')}]!`);
  }

  // Refund one passive node for a little gold, as long as the rest of the build stays connected
  handleRefundPassive(socketId, id) {
    const player = this.gs.players.get(socketId);
    if (!player || player.isDead || !player.skills) return;
    const socket = this.gs.io.sockets.sockets.get(socketId);
    const node = PASSIVES.BY_ID.get(String(id));
    const fail = (text) => {
      if (!socket) return;
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text, color: '#ef4444' });
      socket.emit('skill_tree_updated', { skillPoints: player.skillPoints, skills: player.skills });
    };
    if (!node || !(player.skills[node.id] > 0)) return fail('⚠️ You do not own that passive.');
    if (!PASSIVES.canRefund(player.characterClass, player.skills, node.id)) return fail('⚠️ Other passives depend on it: refund the far end of the path first.');
    if ((player.gold || 0) < PASSIVE_REFUND_COST) return fail(`⚠️ Need ${PASSIVE_REFUND_COST.toLocaleString('en-US')} Gold to refund a passive!`);
    player.gold -= PASSIVE_REFUND_COST;
    delete player.skills[node.id];
    player.skillPoints = (player.skillPoints || 0) + 1;
    this.gs.recalculatePlayerStats(player);
    if (!socket) return;
    socket.emit('player_updated', player);
    socket.emit('skill_tree_updated', { skillPoints: player.skillPoints, skills: player.skills });
    socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `↩ Refunded [${node.name}] (-${PASSIVE_REFUND_COST.toLocaleString('en-US')} Gold)`, color: '#38bdf8' });
  }

  // A saved build that no longer fits the tree (it was redesigned, or the save is broken) is
  // refunded in full, for free: the hero gets every spent point back and re-picks their path.
  refundStaleTalents(player) {
    if (!player || !player.skills) return;
    if (PASSIVES.isValidAllocation(player.characterClass, player.skills)) return;
    const spent = Object.keys(player.skills).reduce((s, id) => s + Number(player.skills[id] || 0), 0);
    player.skillPoints = (player.skillPoints || 0) + spent;
    player.skills = {};
    player.talentRefunded = (player.talentRefunded || 0) + spent;
  }

  handleResetSkillPoints(socketId) {
    const player = this.gs.players.get(socketId);
    if (!player || player.isDead) return;
    if (!player.skills) return;

    let pointsSpent = 0;
    for (const rank of Object.values(player.skills)) {
      pointsSpent += Number(rank || 0);
    }
    if (pointsSpent === 0) return;

    const resetCost = Math.min(500, pointsSpent * 50);
    const socket = this.gs.io.sockets.sockets.get(socketId);

    if (player.gold < resetCost) {
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: `⚠️ Need ${resetCost.toLocaleString('en-US')} Gold to respec talents!`,
          color: '#ef4444'
        });
      }
      return;
    }

    player.gold -= resetCost;
    player.skillPoints = (player.skillPoints || 0) + pointsSpent;
    player.skills = {};
    this.gs.recalculatePlayerStats(player);

    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('skill_tree_updated', {
        skillPoints: player.skillPoints,
        skills: player.skills
      });
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: `🔄 Talents Reset! Restored ${pointsSpent} points (-${resetCost.toLocaleString('en-US')} Gold)`,
        color: '#38bdf8'
      });
    }

    this.gs.sendDirectMessage(player.id, `🔄 [${player.name}] redistributed their talent points.`);
  }

  awardExp(player, amount) {
    if (player.level >= 150) return;
    if (player.dungeonRun && !player.dungeonRun.cleared) player.dungeonRun.exp = (player.dungeonRun.exp || 0) + amount;
    player.exp += amount;
    this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 1.0, text: `+${amount} EXP`, color: '#a855f7' });

    while (player.level < 150 && player.exp >= player.expNext) {
      player.exp -= player.expNext;
      player.level++;
      player.expNext = expToNext(player.level);

      if (!player.baseStats) {
        player.baseStats = {
          maxHp: player.maxHp,
          maxMp: player.maxMp,
          dmg: player.dmg,
          def: player.def,
          speed: player.speed,
          attackRange: player.attackRange
        };
      }
      player.baseStats.maxHp += 20;
      player.baseStats.maxMp += 15;
      player.baseStats.dmg += 4;
      player.baseStats.def += 2;

      // Award Talent Point on level up
      player.skillPoints = (player.skillPoints || 0) + 1;

      this.gs.recalculatePlayerStats(player);

      player.hp = player.maxHp;
      player.mp = player.maxMp;

      this.gs.emitZone(player.zone, 'level_up', { playerId: player.id, level: player.level, x: player.x, y: player.y });
      this.gs.emitZone(player.zone, 'floating_text', {
        x: player.x,
        y: player.y - 1.4,
        text: `🌳 +1 Skill Point! (Total: ${player.skillPoints})`,
        color: '#4ade80',
        size: 18
      });
      this.gs.sendDirectMessage(player.id, `✨ [${player.name}] reached Level ${player.level}! Earned 1 Skill Point.`);
    }

    if (player.level >= 150) {
      player.exp = 0;
    }
  }
}
