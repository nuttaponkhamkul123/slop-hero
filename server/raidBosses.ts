// Slop Hero - Field Raid / World Boss events.
// A big shared boss spawns in a field zone on a schedule; everyone in that
// zone (and anyone who rushes in) fights it. Damage contributes to a live
// leaderboard, and when it dies every participant is paid out by rank.
import { mobStats } from './fieldZones';
import { FIELD_MID } from './fieldZones';

const MINUTE = 60000;

// One raid boss per configured field zone. "type" reuses a mob body the
// renderer already draws (frost_titan / golem); scale makes it loom.
export const RAID_BOSSES: Record<string, any> = {
  frostfell: {
    type: 'frost_titan',
    name: 'Glacier-King Ymirheim',
    hue: 200,
    scale: 1.9,
    level: 18,
    speed: 2.0,
    element: 'ice',
    elementResist: { fire: -0.4, ice: 0.6, holy: -0.2, lightning: 0.3 },
    buffs: ['frostbite', 'fortified'],
    // stat multipliers over the normal *field-boss* numbers for that level
    hpMult: 7, dmgMult: 1.25, defMult: 1.5, expMult: 3, goldMult: 8,
    cardTier: 2,
    spawn: { x: FIELD_MID + 9, y: 20 },
    zone: { minX: FIELD_MID + 3, maxX: FIELD_MID + 14, minY: 16, maxY: 30 },
    windowMinutes: 10,
    respawnMinutes: 12,
    firstDelayMinutes: 2
  },
  celestial: {
    type: 'frost_titan',
    name: 'Aurumath, the Gilded Devourer',
    hue: 55,
    scale: 2.2,
    level: 105,
    speed: 1.9,
    element: 'holy',
    elementResist: { dark: -0.4, holy: 0.5, fire: 0.3, ice: 0.3 },
    buffs: ['fortified', 'ignited'],
    hpMult: 9, dmgMult: 1.2, defMult: 1.6, expMult: 4, goldMult: 10,
    cardTier: 5,
    spawn: { x: FIELD_MID - 9, y: 34 },
    zone: { minX: FIELD_MID - 14, maxX: FIELD_MID - 2, minY: 28, maxY: 46 },
    windowMinutes: 15,
    respawnMinutes: 30,
    firstDelayMinutes: 6
  }
};

// Full mob definition for the raid spawn (same stat language the field zone
// builder uses, so the game server can drop it straight into the field mob map).
export function buildRaidMobDef(zoneId) {
  const c = RAID_BOSSES[zoneId];
  if (!c) return null;
  const base = mobStats(c.level, true); // already field-boss scaled
  return {
    type: c.type,
    name: c.name,
    level: c.level,
    hue: c.hue || 0,
    scale: c.scale || 1.6,
    element: c.element || 'neutral',
    elementResist: c.elementResist || {},
    buffs: c.buffs || [],
    maxHp: Math.round(base.maxHp * (c.hpMult || 6)),
    dmg: Math.round(base.dmg * (c.dmgMult || 1.2)),
    def: Math.round(base.def * (c.defMult || 1.4)),
    exp: Math.round(base.exp * (c.expMult || 3)),
    gold: Math.round(base.gold * (c.goldMult || 6)),
    cardTier: c.cardTier || 1,
    speed: c.speed || 2.2,
    spawn: c.spawn || { x: FIELD_MID, y: 30 },
    zone: c.zone || { minX: FIELD_MID - 8, maxX: FIELD_MID + 8, minY: 20, maxY: 40 }
  };
}

// Rank-reward buckets: gold / exp multipliers over the boss's own payout,
// spirit-fragment range, gear chance (+boss-quality roll), SP-card chance.
export const RAID_REWARD_BUCKETS: Record<string, any> = {
  top1:  { label: '#1 MVP', gold: 4, exp: 5, frag: [8, 14], gear: 1.0, gearBoss: true, card: 0.5, mythic: true },
  top3:  { label: 'Top 3', gold: 2, exp: 3, frag: [5, 9], gear: 0.65, gearBoss: true, card: 0.25, mythic: false },
  top10: { label: 'Top 10', gold: 1.2, exp: 1.8, frag: [3, 6], gear: 0.35, gearBoss: false, card: 0.08, mythic: false },
  part:  { label: 'Participant', gold: 0.7, exp: 1, frag: [1, 3], gear: 0.12, gearBoss: false, card: 0.02, mythic: false }
};

export function raidBucketFor(rank) {
  if (rank === 1) return RAID_REWARD_BUCKETS.top1;
  if (rank <= 3) return RAID_REWARD_BUCKETS.top3;
  if (rank <= 10) return RAID_REWARD_BUCKETS.top10;
  return RAID_REWARD_BUCKETS.part;
}

export default { RAID_BOSSES, buildRaidMobDef, RAID_REWARD_BUCKETS, raidBucketFor };
module.exports = { RAID_BOSSES, buildRaidMobDef, RAID_REWARD_BUCKETS, raidBucketFor, MINUTE };
