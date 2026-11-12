// Tuning constants for the game server (moved verbatim from gameServer.ts; values unchanged).

export const SP_TRANSFORM_COOLDOWN = 3.2; // 8s reduced by 60% (* 0.4)

// Global tuning knob for every skill's damage against monsters
// (multiplies player.dmg * skill.dmgMult before rune/berserk/crit).
export const SKILL_DAMAGE_SCALE = 0.9;
// Cosmetic player effects (Effects dialog): the trail ids a hero may wear (the look is in public/js/trails.js)
export const TRAIL_IDS = new Set(['afterimage', 'ember', 'frost', 'shadow', 'sakura', 'lightning', 'stardust', 'toxic', 'rainbow']);
// Field props break after a few hits and grow back after PROP_RESPAWN_S seconds
export const PROP_RESPAWN_S = 20;
export const PROP_HITS: Record<string, number> = {
  cactus: 2, dead_tree: 3, ice_crystal: 3, giant_mushroom: 3, oak_tree: 4, pine_tree: 4, snow_pine: 4,
  boulder: 5, stone_pillar: 5, frost_monolith: 6
};
// Berserker blood auras (SP 'aura' skills): need this share of max HP to switch
// one on, and all of them fade once HP is drained down to BLOOD_AURA_MIN_HP
export const BLOOD_AURA_START_HP = 0.2;
export const BLOOD_AURA_MIN_HP = 0.1;
// Mana tuning. Skill costs grow with level so they keep pace with max MP
// (+15 per level): cost = base * MANA_COST_SCALE * (1 + MANA_COST_PER_LEVEL * (level - 1)).
// Regen per second = MANA_REGEN_PCT of max MP + MANA_REGEN_FLAT.
export const MANA_COST_SCALE = 0.9;
export const MANA_COST_PER_LEVEL = 0.05;
export const MANA_REGEN_PCT = 0.035;
export const MANA_REGEN_FLAT = 3;
// Bag size of a new hero, and the most backpack expanders can raise it to
export const DEFAULT_BAG_SLOTS = 150;
export const MAX_BAG_SLOTS = 240;
// Dungeon boss portal: opens once this share of the run's monsters (weighted) are dead.
// Minibosses are worth DUNGEON_MINIBOSS_WEIGHT ordinary monsters.
export const DUNGEON_PORTAL_SHARE = 0.5;
export const DUNGEON_MINIBOSS_WEIGHT = 8;
export const dungeonProgressWeight = (m: any) => (m.isMiniboss || m.mechanics === 'miniboss' ? DUNGEON_MINIBOSS_WEIGHT : 1);
// Natural HP regen per second, as a share of max HP (gear and attributes add flat regen on top)
export const HP_REGEN_PCT = 0.015;
// Melee basic-attack cleave: reach past the attack range (tiles) and the default
// arc (degrees, cos 0.35 either side of the facing); sweep weapons add to both
export const SWEEP_EXTRA_REACH = 1.15;
// A swing that arrives this close to the end of the attack cooldown (25 Hz tick steps
// plus network jitter) still lands: the client has already played it. The leftover is
// carried into the next cooldown, so the attack rate itself never goes up.
export const ATTACK_GRACE_S = 0.15;
export const SWEEP_ARC_DEG = Math.round((Math.acos(0.35) * 360) / Math.PI);
// Mage card mechanics (see spCards.js): caps and timers
export const SCORCH_MAX = 5, SCORCH_SECONDS = 6;
export const FROST_TO_FREEZE = 3, FROST_SECONDS = 5, FREEZE_SECONDS = 2, BOSS_FREEZE_SECONDS = 0.8;
// Tempest Caller: Conductor marks on enemies, arcs between marked enemies, delayed Thunderclap
export const CONDUCT_MAX = 3, CONDUCT_SECONDS = 7, CONDUCT_FORK_RANGE = 4.5, CONDUCT_FORK_MAX = 3, CONDUCT_FORK_SHARE = 0.4;
export const VOID_SOUL_MAX = 10, VOID_SOUL_SECONDS = 12, VOID_SOUL_BONUS = 0.04;
// SP signature charge: per landed hit, per kill, per full max HP of damage taken;
// at most ULT_MAX_GAIN_PER_SEC a second, none while a signature is still playing out
export const ULT_COOLDOWN = 1, ULT_CHARGE_MAX = 100, ULT_GAIN_HIT = 1, ULT_GAIN_KILL = 4, ULT_GAIN_HURT = 60, ULT_MAX_GAIN_PER_SEC = 10, ULT_LOCK_SECONDS = 4;
export const ECHO_DAMAGE = 0.6;
// Check a hero's bag / gear / skills for changes this often (in ticks) when building snapshots
export const HEAVY_CHECK_TICKS = Number(process.env.HEAVY_CHECK_TICKS) || 5;

// Variant warrior card mechanics (see spCards.ts)
export const FRACTURE_MAX = 5, FRACTURE_SECONDS = 6, FRACTURE_STUN = 0.35;         // Gravelord
export const HEAT_MAX = 100, HEAT_HOLD_MS = 3000, HEAT_DECAY = 10;                   // Reaver: Heat fades 10/s after 3s idle
export const OVERHEAT_SECONDS = 6, OVERHEAT_BONUS = 0.4, OVERHEAT_BURN = 0.015;     // Reaver Overheat
export const RUNE_MAX = 4, RUNE_POLL = 0.25, RUNE_ARM_MS = 400, RUNE_TRIGGER_R = 1.1; // Rune Knight glyphs
export const COMBO_MAX = 6, COMBO_SECONDS = 4, COMBO_BONUS = 0.1;                   // Warchief
// Dragoon Lightning Rods (spCards: rod / rodArc / overload): at most DG_ROD_MAX planted at once,
// each lasting DG_ROD_SECONDS; the sky strikes every rod every DG_ROD_EVERY s (DG_ROD_MULT x ATK
// within DG_ROD_R), and a rod links to the next one planted within DG_FENCE_RANGE by an arc fence
// (DG_FENCE_MULT x ATK to enemies within DG_FENCE_W of it, and a short slow)
export const DG_ROD_MAX = 3, DG_ROD_SECONDS = 8, DG_ROD_EVERY = 1.2, DG_ROD_R = 1.6, DG_ROD_MULT = 0.45;
export const DG_FENCE_RANGE = 7, DG_FENCE_W = 0.7, DG_FENCE_MULT = 0.3, DG_OVERLOAD_R = 2.4, DG_ARC_RANGE = 4.5;
// Gravelord undead minions (Raise the Fallen): monsters' corpses stay raisable for
// GRAVE_CORPSE_MS; minions chase the nearest enemy within MINION_AGGRO (staying within
// MINION_LEASH of their lord), hit every MINION_ATTACK_EVERY s for `mult` x the lord's ATK
export const GRAVE_CORPSE_MS = 12000, GRAVE_CORPSE_MAX = 40, MINION_MAX = 5;
export const MINION_SPEED = 4.2, MINION_REACH = 1.1, MINION_ATTACK_EVERY = 0.9, MINION_AGGRO = 8, MINION_LEASH = 11;

// Skills a Nightblade shadow does not copy: tossing the shadow itself, and ones that only move or buff the hero
export const SHADOW_SKIPS_SHAPES = new Set(['shadow', 'aura', 'rewind', 'buff']);
export const REWIND_SAMPLE_S = 0.25, REWIND_KEEP_S = 4;
// Dungeon snapshots carry only mobs a hero in the instance could see: the iso
// screen is a diamond in world space, |dx - dy| and |dx + dy| bounded (sized
// for a 1920x1080 view at the furthest zoom-out, 0.65)
export const MOB_VIEW_ISO_X = 50;
export const MOB_VIEW_ISO_Y = 56;
// Dungeon ticks are diffs; the full mob + chest list goes out this often (s)
export const MOB_FULL_REFRESH_S = 5;
// Dungeon monsters rise this long when their room opens (no AI meanwhile)
export const DUNGEON_SPAWN_MS = 1000;
// Most floating texts (damage numbers...) one room receives per tick; the
// rest of a huge AoE burst is dropped rather than flooding the clients
export const FLOATING_TEXT_BATCH_MAX = 40;
export const mobInView = (m, p) => {
  const dx = m.x - p.x, dy = m.y - p.y;
  return Math.abs(dx - dy) <= MOB_VIEW_ISO_X && Math.abs(dx + dy) <= MOB_VIEW_ISO_Y;
};

// Share of the escrowed chest loot a player keeps when a dungeon run fails
// (leaving, dying or disconnecting before the boss is defeated).
export const FAILED_RUN_LOOT_KEEP = 0.3;

// How close a hero must stand to a portal to use it (client shows the button in range)
export const PORTAL_USE_RANGE = 2.5;
// Where heroes come back out of the Eternal Rift (beside its town gate)
export const RIFT_TOWN_ARRIVAL = { x: 27.0, y: 21.4 };

// Party EXP sharing: members within this many tiles (1 tile = 1 metre) of the
// killer, on the same map, split the kill's EXP; each extra member adds this bonus
export const PARTY_EXP_RANGE = 10;
export const PARTY_EXP_BONUS = 0.1;

// Gold to refund one passive node (right-click in the tree)
export const PASSIVE_REFUND_COST = 25;


export const MAX_PLAYER_ELEMENT_RESIST = 0.6;
// Mage passive Energy Shield: size from Max HP and Max MP; recharges once the
// mage has gone `delay` seconds without being hit
export const ENERGY_SHIELD = { hpShare: 0.12, mpShare: 0.3, delay: 3, rechargePerSec: 0.15 };
// Chance a kill drops a defensive armor rune (crafting makes them too)
export const ARMOR_RUNE_DROP = { normal: 0.0015, boss: 0.08 };
export const PARTY_SUMMON_TTL_MS = 30000;
// Loot left on the ground disappears after this long
export const ITEM_DESPAWN_MS = 5 * 60 * 1000;
export const ITEM_SWEEP_INTERVAL_MS = 1000;
// "Face the cursor" setting: the 8 facings a client may send, and how long a
// swing keeps the hero turned toward its target before it follows the mouse again
export const FACINGS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const AIM_FACE_LOCK_SEC = 0.7;
// Mage basic attacks burst on impact: nearby monsters take this share of the hit
export const MAGE_SPLASH_SHARE = 0.3;
export const MAGE_SPLASH_RADIUS = 1.9;
// Dungeon completion grade: par time grows with the number of rooms
export const RUN_PAR_BASE_SEC = 90;
export const RUN_PAR_PER_ROOM_SEC = 25;
export const RUN_RANK_MULT = { S: 2, A: 1.5, B: 1.2, C: 1 };

// Equipment drop rates (kept low on purpose)
export const MOB_GEAR_DROP_CHANCE = 0.025;
export const BOSS_GEAR_DROP_CHANCE = 0.35;
export const BOSS_BONUS_GEAR_DROP_CHANCE = 0.06;
export const BOSS_REVIVAL_STONE_CHANCE = 0.4;
