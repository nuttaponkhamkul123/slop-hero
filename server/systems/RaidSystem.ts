// Field raids (world bosses): spawn schedule, damage standings, leaderboard and the payout by rank.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import { rollSkyblockReforge, applySkyblockReforge, pickGearForLevel } from '../items';
import * as SP from '../spCards';
import { ItemFactory } from '../entities/item';
import { MobFactory } from '../entities/mob';
import type { Mob, Player } from '../entities/types';
const RAID = require('../raidBosses');

export class RaidSystem {
  constructor(private readonly gs: GameServer) {}

  // =================================================================
  // FIELD RAID / WORLD BOSS EVENTS
  // =================================================================
  updateRaidEvents() {
    const now = Date.now();
    for (const zoneId of Object.keys(RAID.RAID_BOSSES)) {
      const st = this.gs.raidStates.get(zoneId);
      if (!st) {
        if (now >= (this.gs.raidNextSpawn.get(zoneId) || 0)) this.gs.spawnRaidBoss(zoneId);
        continue;
      }
      // the boss window expired without a kill: it retreats and the clock resets
      if (now >= st.despawnAt) {
        this.gs.despawnRaidBoss(zoneId, 'timeup');
        continue;
      }
      if (now - st.lastBroadcast >= 4000) {
        st.lastBroadcast = now;
        this.gs.broadcastRaidLeaderboard(zoneId, st);
      }
    }
  }

  spawnRaidBoss(zoneId: any) {
    const conf = RAID.RAID_BOSSES[zoneId];
    const field = this.gs.fields.get(zoneId);
    if (!conf || !field || this.gs.raidStates.has(zoneId)) return;
    const def = RAID.buildRaidMobDef(zoneId);
    if (!def) return;
    const id = `${zoneId}_raid_${this.gs.nextEntityId++}`;
    const mob: any = MobFactory.raidBoss(def, zoneId, id);
    field.mobs.set(id, mob);
    const now = Date.now();
    this.gs.raidStates.set(zoneId, {
      conf,
      def,
      mobId: id,
      damage: new Map(),
      despawnAt: now + (conf.windowMinutes || 15) * RAID.MINUTE,
      lastBroadcast: 0
    });
    this.gs.broadcastSystemMessage(`☠️ RAID EVENT! [${def.name}] (Lv.${def.level}) has awakened in [${field.zone.name}]! It won't fall alone.`);
    this.gs.emitZone(zoneId, 'raid_spawn', {
      zoneId,
      name: def.name,
      level: def.level,
      hp: mob.maxHp,
      maxHp: mob.maxHp,
      endsIn: (conf.windowMinutes || 15) * 60
    });
  }

  despawnRaidBoss(zoneId: any, why = 'timeup') {
    const st = this.gs.raidStates.get(zoneId);
    if (!st) return;
    const field = this.gs.fields.get(zoneId);
    if (field) field.mobs.delete(st.mobId);
    this.gs.raidStates.delete(zoneId);
    const conf = RAID.RAID_BOSSES[zoneId];
    this.gs.raidNextSpawn.set(zoneId, Date.now() + (conf ? conf.respawnMinutes : 25) * RAID.MINUTE);
    if (why === 'timeup') {
      this.gs.broadcastSystemMessage(`💨 [${st.def.name}] senses the odds and retreats into the deep. It returns in ${conf ? conf.respawnMinutes : 25} minutes.`);
      this.gs.emitZone(zoneId, 'raid_gone', { zoneId, reason: 'timeup' });
    }
  }

  recordRaidDamage(zoneId: any, playerId: any, amount: any) {
    const st = this.gs.raidStates.get(zoneId);
    if (!st || !playerId || !(amount > 0)) return;
    st.damage.set(playerId, (st.damage.get(playerId) || 0) + amount);
  }

  // Live standings for the boss: online players sorted by damage dealt
  raidStandings(st: any) {
    const rows = [];
    for (const [pid, dmg] of st.damage) {
      const p = this.gs.players.get(pid);
      if (!p || p.isDead) continue;
      rows.push({ id: pid, name: p.name, dmg: Math.round(dmg) });
    }
    rows.sort((a, b) => b.dmg - a.dmg);
    return rows;
  }

  broadcastRaidLeaderboard(zoneId: any, st: any) {
    const mob = this.gs.fields.get(zoneId) && this.gs.fields.get(zoneId).mobs.get(st.mobId);
    if (!mob || mob.state === 'dead') return;
    const standings = this.gs.raidStandings(st);   // full board: clients resolve their own rank
    this.gs.emitZone(zoneId, 'raid_leaderboard', {
      zoneId,
      name: st.def.name,
      level: st.def.level,
      hp: Math.max(0, Math.round(mob.hp)),
      maxHp: st.def.maxHp,
      endsIn: Math.max(0, Math.round((st.despawnAt - Date.now()) / 1000)),
      top: standings,
      count: standings.length
    });
  }

  // Snapshot for players entering the zone mid-fight (rides zone_change)
  raidInfo(zoneId: any) {
    const st = this.gs.raidStates.get(zoneId);
    if (!st) return { active: false };
    const field = this.gs.fields.get(zoneId);
    const mob = field && field.mobs.get(st.mobId);
    if (!mob || mob.state === 'dead') return { active: false };
    const standings = this.gs.raidStandings(st);   // full board: clients resolve their own rank
    return {
      active: true,
      zoneId,
      name: st.def.name,
      level: st.def.level,
      hp: Math.max(0, Math.round(mob.hp)),
      maxHp: st.def.maxHp,
      endsIn: Math.max(0, Math.round((st.despawnAt - Date.now()) / 1000)),
      top: standings,
      count: standings.length
    };
  }

  onRaidBossDeath(mob: Mob, killerPlayer: Player) {
    const zoneId = mob.fieldZone || (killerPlayer && killerPlayer.zone) || Object.keys(RAID.RAID_BOSSES)[0];
    const st = this.gs.raidStates.get(zoneId);
    if (!st || !mob.isRaidBoss) return;
    const def = st.def;
    const standings = this.gs.raidStandings(st);

    const podium = standings.slice(0, 5).map((r: any, i: any) => `${i + 1}. ${r.name} (${r.dmg.toLocaleString()})`).join('  ');
    this.gs.broadcastSystemMessage(`🏆 RAID SLAYED! [${def.name}] has fallen! Damage: ${podium || 'no one recorded'}`);
    this.gs.emitZone(zoneId, 'raid_gone', { zoneId, reason: 'kill' });
    this.gs.emitZone(zoneId, 'mob_died', { mobId: mob.id, killerId: killerPlayer ? killerPlayer.id : null });

    let rank = 0;
    const total = standings.length;
    for (const row of standings) {
      rank++;
      const p = this.gs.players.get(row.id);
      if (!p) continue;
      this.gs.payRaidReward(p, def, RAID.raidBucketFor(rank), rank, total);
    }
    this.gs.despawnRaidBoss(zoneId, 'kill');
  }

  payRaidReward(player: Player, def: any, bucket: any, rank: any, total: any) {
    const gold = Math.max(1, Math.round(def.gold * bucket.gold * (0.85 + Math.random() * 0.3)));
    this.gs.giveLootToPlayer(player, { type: 'gold', amount: gold }, false);

    const exp = Math.max(1, Math.round(def.exp * bucket.exp * (0.9 + Math.random() * 0.2)));
    this.gs.awardExp(player, exp);
    this.gs.awardJobExp(player, exp);

    const [fmin, fmax] = bucket.frag;
    const frags = fmin + Math.floor(Math.random() * (fmax - fmin + 1));
    if (frags > 0) this.gs.giveLootToPlayer(player, { type: 'item', itemId: 'spirit_fragment', amount: frags }, false);

    // gear roll (top ranks roll guaranteed, boss-quality gear)
    if (Math.random() < bucket.gear) {
      const cls = player.characterClass;
      let gear = ItemFactory.gear(pickGearForLevel(def.level, { boss: bucket.gearBoss, cls }), def.level, bucket.gearBoss);
      const reforge = (bucket.mythic || Math.random() < 0.5) ? rollSkyblockReforge(gear) : null;
      if (reforge) gear = applySkyblockReforge(gear, reforge);
      this.gs.giveLootToPlayer(player, { type: 'item', itemId: gear.id, customItemData: gear, amount: 1 }, false);
    }

    // SP-card roll from the boss's card tier pool
    if (Math.random() < bucket.card) {
      const pool = (SP.SP_CARDS[player.characterClass] || []).filter(c => c.tier === (def.cardTier || 1));
      const chosen = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      if (chosen) {
        const cardItem = SP.makeCardItem(chosen.id);
        if (cardItem) {
          this.gs.giveLootToPlayer(player, { type: 'item', itemId: 'sp_card', customItemData: ItemFactory.cardLootData(chosen.id), amount: 1 }, false);
          this.gs.broadcastSystemMessage(`🃏 [${player.name}] pulled an SP Card [${chosen.name}] from the raid bounty!`);
        }
      }
    }

    const socket = this.gs.io.sockets.sockets.get(player.id);
    if (socket) {
      socket.emit('raid_reward', { rank, total, label: bucket.label, gold, exp, fragments: frags, bossName: def.name });
      socket.emit('player_updated', player);
    }
  }
}
