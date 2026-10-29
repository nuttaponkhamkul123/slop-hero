import { calculateElementalMultiplier, ELEMENTS, ELEMENT_INFO } from './elements';
import { MAP_WIDTH, MAP_HEIGHT, TILES, generateMap, generateFrostfellMap } from './mapData';
import { generateProceduralDungeon, rollDungeonLoot, DIFFICULTIES, AFFIX_POOL, DUNGEON_FLOORS, DUNGEON_TILES, BLOCKING_FEATURES, DUNGEON_HAZARDS } from './dungeonGenerator';
import {
  ITEMS,
  SKYBLOCK_REFORGES,
  REFORGE_COSTS,
  getReforgeCategory,
  rollSkyblockReforge,
  applySkyblockReforge,
  generateRandomizedGear,
  pickGear,
  pickGearForLevel,
  ENHANCE_MAX,
  ENHANCE_SAFE_LEVEL,
  ENHANCE_BASE_COST,
  ENHANCE_COST_GROWTH,
  ENHANCE_CHANCE,
  enhanceCost,
  enhanceChance,
  requiredClass,
  WEAPON_ABILITIES,
  weaponAbility
} from './items';
import accountManager from './accountManager';
import { FIELD_ZONES, FIELD_ZONE_BY_ID, generateFieldMap, buildFieldMobs } from './fieldZones';
import { expToNext, mobExp, levelGapMult, lootGapMult, masteryMult, MOB_DEF_K } from './progression';
import * as SP from './spCards';
import * as adminCommands from './adminCommands';
const SP_TRANSFORM_COOLDOWN = 8;

// Global tuning knob for every skill's damage against monsters
// (multiplies player.dmg * skill.dmgMult before rune/berserk/crit).
const SKILL_DAMAGE_SCALE = 0.9;
// Berserker blood auras (SP 'aura' skills): need this share of max HP to switch
// one on, and all of them fade once HP is drained down to BLOOD_AURA_MIN_HP
const BLOOD_AURA_START_HP = 0.2;
const BLOOD_AURA_MIN_HP = 0.1;
// Mana tuning. Skill costs grow with level so they keep pace with max MP
// (+15 per level): cost = base * MANA_COST_SCALE * (1 + MANA_COST_PER_LEVEL * (level - 1)).
// Regen per second = MANA_REGEN_PCT of max MP + MANA_REGEN_FLAT.
const MANA_COST_SCALE = 1.2;
const MANA_COST_PER_LEVEL = 0.05;
const MANA_REGEN_PCT = 0.03;
const MANA_REGEN_FLAT = 1;
// Mage card mechanics (see spCards.js): caps and timers
const SCORCH_MAX = 5, SCORCH_SECONDS = 6;
const FROST_TO_FREEZE = 3, FROST_SECONDS = 5, FREEZE_SECONDS = 2, BOSS_FREEZE_SECONDS = 0.8;
const STORM_CHARGE_MAX = 5, STORM_CHARGE_SECONDS = 8;
const VOID_SOUL_MAX = 10, VOID_SOUL_SECONDS = 12, VOID_SOUL_BONUS = 0.04;
const ECHO_DAMAGE = 0.6;
// Skills a Nightblade shadow does not copy: tossing the shadow itself, and ones that only move or buff the hero
const SHADOW_SKIPS_SHAPES = new Set(['shadow', 'aura', 'rewind', 'buff']);
const REWIND_SAMPLE_S = 0.25, REWIND_KEEP_S = 4;
// Dungeon snapshots carry only mobs a hero in the instance could see: the iso
// screen is a diamond in world space, |dx - dy| and |dx + dy| bounded (sized
// for a 1920x1080 view at the furthest zoom-out, 0.65)
const MOB_VIEW_ISO_X = 50;
const MOB_VIEW_ISO_Y = 56;
// Dungeon ticks are diffs; the full mob + chest list goes out this often (s)
const MOB_FULL_REFRESH_S = 5;
// Dungeon monsters rise this long when their room opens (no AI meanwhile)
const DUNGEON_SPAWN_MS = 1000;
// Most floating texts (damage numbers...) one room receives per tick; the
// rest of a huge AoE burst is dropped rather than flooding the clients
const FLOATING_TEXT_BATCH_MAX = 40;
const mobInView = (m, p) => {
  const dx = m.x - p.x, dy = m.y - p.y;
  return Math.abs(dx - dy) <= MOB_VIEW_ISO_X && Math.abs(dx + dy) <= MOB_VIEW_ISO_Y;
};

// Share of the escrowed chest loot a player keeps when a dungeon run fails
// (leaving, dying or disconnecting before the boss is defeated).
const FAILED_RUN_LOOT_KEEP = 0.3;

// ================= MASSIVE CLASS SKILL ARSENAL (24 SKILLS) =================
const ALL_CLASS_SKILLS = {
  // === WARRIOR SKILLS (Lv 1 - 60) ===
  whirlwind: {
    id: 'whirlwind', class: 'warrior', reqLevel: 1, name: 'Whirlwind Slash', icon: '🌪️', category: 'AoE Physical', fxType: 'whirlwind',
    mpCost: 14, cooldown: 3.5, radius: 3.4, dmgMult: 2.0, damageMultiplier: 2.0,
    desc: 'Spin continuously dealing 2.0x Physical damage in a 360° cyclone around you.'
  },
  blade_charge: {
    id: 'blade_charge', class: 'warrior', reqLevel: 1, isDash: true, name: 'Blade Charge', icon: '⚔️', category: 'Mobility Rush', fxType: 'blade_charge',
    mpCost: 10, cooldown: 3.0, distance: 4.8, dmgMult: 1.8, damageMultiplier: 1.8,
    desc: 'Rush forward piercing enemies for 1.8x damage and knocking them back.'
  },
  shield_slam: {
    id: 'shield_slam', class: 'warrior', reqLevel: 5, name: 'Aegis Shield Bash', icon: '🛡️', category: 'Stun & Shield', fxType: 'shield_slam',
    mpCost: 15, cooldown: 4.0, radius: 2.4, dmgMult: 2.4, damageMultiplier: 2.4, stunDuration: 2.0, shieldHp: 80,
    desc: 'Slam enemies with an iron aegis, dealing 2.4x damage, stunning for 2s, and granting an 80 HP shield.'
  },
  earthshaker: {
    id: 'earthshaker', class: 'warrior', reqLevel: 10, name: 'Earthshaker Slam', icon: '💥', category: 'AoE Stun / Slow', fxType: 'earthshaker',
    mpCost: 16, cooldown: 4.5, radius: 3.4, dmgMult: 2.2, damageMultiplier: 2.2, slowDuration: 2.5,
    desc: 'Strike the ground with colossal force, dealing 2.2x damage and slowing foes by 50% for 2.5s.'
  },
  blood_rage: {
    id: 'blood_rage', class: 'warrior', reqLevel: 15, name: 'Berserker Blood Rage', icon: '🩸', category: 'Self Buff', fxType: 'blood_rage',
    mpCost: 12, cooldown: 7.0, duration: 6.0, bonusDmgPct: 0.35, lifestealPct: 0.04,
    desc: 'Sacrifice 8% HP to enter a berserk state for 6s: +35% DMG and 4% Life Steal on attacks.'
  },
  iron_fortress: {
    id: 'iron_fortress', class: 'warrior', reqLevel: 20, name: 'Iron Fortress', icon: '🏰', category: 'Defense / Thorns', fxType: 'iron_fortress',
    mpCost: 18, cooldown: 8.0, duration: 4.5, damageReduction: 0.60, thornsDmg: 25,
    desc: 'Assume an immovable iron stance for 4.5s: reduce damage taken by 60% and reflect 25 damage back to attackers.'
  },
  war_stomp: {
    id: 'war_stomp', class: 'warrior', reqLevel: 25, name: 'Thunder War Stomp', icon: '⚡', category: 'Vortex CC', fxType: 'war_stomp',
    mpCost: 20, cooldown: 5.5, radius: 4.2, dmgMult: 2.1, damageMultiplier: 2.1, stunDuration: 1.8,
    desc: 'Stomp with seismic thunder, pulling all nearby enemies toward you, dealing 2.1x damage and stunning for 1.8s.'
  },
  colossus_strike: {
    id: 'colossus_strike', class: 'warrior', reqLevel: 30, name: 'Colossus Decapitate', icon: '🗡️', category: 'Ultimate Burst', fxType: 'colossus_strike',
    mpCost: 28, cooldown: 9.0, radius: 3.0, dmgMult: 3.8, damageMultiplier: 3.8,
    desc: '[ULTIMATE] Leap high and smash down a colossal greatblade strike for 3.8x devastating burst damage!'
  },
  dragon_roar: {
    id: 'dragon_roar', class: 'warrior', reqLevel: 35, name: "Dragon's Battle Cry", icon: '🐲', category: 'AoE Fear & Buff', fxType: 'dragon_roar',
    mpCost: 22, cooldown: 8.0, radius: 4.5, dmgMult: 2.6, damageMultiplier: 2.6, duration: 6.0,
    desc: 'Unleash a primeval dragon roar dealing 2.6x damage, fearing foes for 2s and granting +40% ATK for 6s.'
  },
  meteor_dive: {
    id: 'meteor_dive', class: 'warrior', reqLevel: 40, name: 'Heavenly Meteor Dive', icon: '☄️', category: 'Leap & Crater', fxType: 'meteor_dive',
    mpCost: 26, cooldown: 7.5, radius: 4.0, dmgMult: 3.4, damageMultiplier: 3.4,
    desc: 'Leap into the heavens and crash like a meteor onto target zone, dealing 3.4x damage and leaving a burning crater.'
  },
  bladestorm_frenzy: {
    id: 'bladestorm_frenzy', class: 'warrior', reqLevel: 45, name: 'Bladestorm Hurricane', icon: '🌀', category: 'Sustained Heavy AoE', fxType: 'bladestorm_frenzy',
    mpCost: 30, cooldown: 9.0, radius: 4.2, dmgMult: 3.8, damageMultiplier: 3.8,
    desc: 'Enter an unstoppable whirlwind of steel, cutting nearby enemies 4 times for 3.8x total damage with crowd control immunity.'
  },
  titan_bastion: {
    id: 'titan_bastion', class: 'warrior', reqLevel: 50, name: "Titan's Immortal Bastion", icon: '🏛️', category: 'Ultimate Shield Wall', fxType: 'titan_bastion',
    mpCost: 25, cooldown: 12.0, duration: 5.0, shieldHp: 350,
    desc: 'Summon the golden bastion of the Titans: grant 350 HP shield, crowd control immunity, and +30% Armor for 5s.'
  },
  sundering_cleave: {
    id: 'sundering_cleave', class: 'warrior', reqLevel: 55, name: 'Sundering World Cleave', icon: '🪓', category: 'Linear Armor Shatter', fxType: 'sundering_cleave',
    mpCost: 28, cooldown: 7.0, distance: 9.0, dmgMult: 4.2, damageMultiplier: 4.2,
    desc: 'Shatter reality forward in an earth-shattering fissure, dealing 4.2x damage and reducing enemy defense by 40% for 5s.'
  },
  ragnarok_slash: {
    id: 'ragnarok_slash', class: 'warrior', reqLevel: 60, name: 'Ragnarök Godslayer', icon: '👑', category: 'Grand Ultimate', fxType: 'ragnarok_slash',
    mpCost: 45, cooldown: 14.0, radius: 5.5, dmgMult: 5.5, damageMultiplier: 5.5,
    desc: '[LV. 60 GRAND ULTIMATE] Channel primordial god-slaying fury: unleash 4 colossal golden cross-cleaves across the screen for 5.5x cataclysmic burst damage!'
  },

  // === MAGE SKILLS (Lv 1 - 60) ===
  firestorm: {
    id: 'firestorm', class: 'mage', reqLevel: 1, name: 'Firestorm Meteor', icon: '🔥', category: 'AoE Burn', fxType: 'firestorm',
    mpCost: 22, cooldown: 4.5, radius: 3.8, dmgMult: 2.4, damageMultiplier: 2.4, burnDuration: 3.0, burnDmg: 12,
    desc: 'Call down apocalyptic burning meteors dealing 2.4x damage and setting foes ablaze with Burn DoT.'
  },
  arcane_blink: {
    id: 'arcane_blink', class: 'mage', reqLevel: 1, isDash: true, name: 'Arcane Blink', icon: '🔮', category: 'Mobility Teleport', fxType: 'arcane_blink',
    mpCost: 15, cooldown: 3.5, distance: 5.2, dmgMult: 1.5, damageMultiplier: 1.5, radius: 2.4,
    desc: 'Teleport instantly in your movement direction, cleansing debuffs and releasing an arcane shockwave.'
  },
  frost_nova: {
    id: 'frost_nova', class: 'mage', reqLevel: 5, name: 'Frost Nova', icon: '❄️', category: 'AoE Freeze / Chill', fxType: 'frost_nova',
    mpCost: 18, cooldown: 4.0, radius: 4.0, dmgMult: 1.8, damageMultiplier: 1.8, chillDuration: 3.5,
    desc: 'Release an expanding glacial ring dealing 1.8x damage and chilling enemies by 50% for 3.5s.'
  },
  chain_lightning: {
    id: 'chain_lightning', class: 'mage', reqLevel: 10, name: 'Chain Lightning', icon: '⚡', category: 'Targeted Shock', fxType: 'chain_lightning',
    mpCost: 20, cooldown: 4.0, bounces: 5, dmgMult: 2.2, damageMultiplier: 2.2,
    desc: 'Cast crackling lightning that arcs across up to 5 nearby monsters, dealing 2.2x electric shock damage.'
  },
  mana_shield: {
    id: 'mana_shield', class: 'mage', reqLevel: 15, name: 'Arcane Mana Barrier', icon: '✨', category: 'Defensive Shield', fxType: 'mana_shield',
    mpCost: 15, cooldown: 8.0, duration: 6.0, absorbHp: 120,
    desc: 'Surround yourself with a prismatic arcane sphere absorbing up to 120 damage using Mana for 6s.'
  },
  pyroblast: {
    id: 'pyroblast', class: 'mage', reqLevel: 20, name: 'Pyroblast Nova', icon: '☄️', category: 'Burst Fireball', fxType: 'pyroblast',
    mpCost: 24, cooldown: 5.0, radius: 3.2, dmgMult: 3.2, damageMultiplier: 3.2, burnDuration: 4.0, burnDmg: 16,
    desc: 'Hurl an enormous molten fire orb that pierces and explodes for 3.2x burst damage + deep burn.'
  },
  blizzard: {
    id: 'blizzard', class: 'mage', reqLevel: 25, name: 'Glacial Blizzard', icon: '🌨️', category: 'AoE Freeze Hail', fxType: 'blizzard',
    mpCost: 25, cooldown: 6.0, radius: 4.4, dmgMult: 2.5, damageMultiplier: 2.5, freezeDuration: 2.0,
    desc: 'Summon a vicious hail of razor ice shards over an area, dealing 2.5x damage and freezing enemies solid.'
  },
  black_hole: {
    id: 'black_hole', class: 'mage', reqLevel: 30, name: 'Cosmic Singularity', icon: '🌌', category: 'Ultimate Gravity', fxType: 'black_hole',
    mpCost: 32, cooldown: 10.0, radius: 4.8, dmgMult: 3.6, damageMultiplier: 3.6, duration: 2.2,
    desc: '[ULTIMATE] Open a gravitational singularity that sucks all foes to the epicenter then violently implodes for 3.6x damage!'
  },
  thunder_storm: {
    id: 'thunder_storm', class: 'mage', reqLevel: 35, name: 'Tempest Cataclysm', icon: '🌩️', category: 'Multi-Lightning Storm', fxType: 'thunder_storm',
    mpCost: 28, cooldown: 7.5, radius: 4.5, dmgMult: 3.5, damageMultiplier: 3.5,
    desc: 'Summon torrential stormclouds that strike 6 rapid lightning bolts, electrocuting all foes for 3.5x damage.'
  },
  glacial_comet: {
    id: 'glacial_comet', class: 'mage', reqLevel: 40, name: 'Crystalline Glacial Comet', icon: '🧊', category: 'Frost Impact / Freeze', fxType: 'glacial_comet',
    mpCost: 30, cooldown: 8.0, radius: 4.2, dmgMult: 3.8, damageMultiplier: 3.8,
    desc: 'Pull down a massive crystalline comet from the void, crashing for 3.8x damage and encasing all targets in deep freeze.'
  },
  arcane_hyperbeam: {
    id: 'arcane_hyperbeam', class: 'mage', reqLevel: 45, name: 'Disintegration Hyperbeam', icon: '💫', category: 'Linear Death Ray', fxType: 'arcane_hyperbeam',
    mpCost: 34, cooldown: 8.5, distance: 10.0, dmgMult: 4.0, damageMultiplier: 4.0,
    desc: 'Channel an unrelenting prismatic antimatter laser piercing through all foes in front of you for 4.0x damage.'
  },
  time_dilation: {
    id: 'time_dilation', class: 'mage', reqLevel: 50, name: 'Chrono Time Warp', icon: '⏳', category: 'Chrono Control', fxType: 'time_dilation',
    mpCost: 32, cooldown: 13.0, radius: 5.0, duration: 4.5,
    desc: 'Bend space-time into a Chronosphere: slow all enemy movements and attacks by 80% while granting you +50% Cast Speed.'
  },
  supernova_blast: {
    id: 'supernova_blast', class: 'mage', reqLevel: 55, name: 'Solar Supernova', icon: '💥', category: 'Cosmic Stellar Flare', fxType: 'supernova_blast',
    mpCost: 38, cooldown: 11.0, radius: 5.2, dmgMult: 4.6, damageMultiplier: 4.6,
    desc: 'Spawn an embryonic star that swells and detonates in a blinding thermonuclear supernova flare for 4.6x damage!'
  },
  genesis_cataclysm: {
    id: 'genesis_cataclysm', class: 'mage', reqLevel: 60, name: 'Cataclysm of Genesis', icon: '✨', category: 'Grand Ultimate', fxType: 'genesis_cataclysm',
    mpCost: 50, cooldown: 15.0, radius: 6.0, dmgMult: 5.8, damageMultiplier: 5.8,
    desc: '[LV. 60 GRAND ULTIMATE] Initiate planetary celestial convergence: summon down orbital cosmic lances and stellar energy beams for 5.8x god-tier annihilation!'
  },

  // === ROGUE SKILLS (Lv 1 - 60) ===
  fan_of_knives: {
    id: 'fan_of_knives', class: 'rogue', reqLevel: 1, name: 'Fan of Knives', icon: '🗡️', category: 'AoE Critical', fxType: 'fan_of_knives',
    mpCost: 14, cooldown: 3.0, radius: 3.4, dmgMult: 2.2, damageMultiplier: 2.2, critBonus: 0.35,
    desc: 'Hurl a rapid 360° ring of razor daggers with +35% Critical Strike chance dealing 2.2x damage.'
  },
  shadow_dash: {
    id: 'shadow_dash', class: 'rogue', reqLevel: 1, isDash: true, name: 'Shadow Dash', icon: '💨', category: 'Mobility Sprint', fxType: 'shadow_dash',
    mpCost: 8, cooldown: 2.5, distance: 4.8, dmgMult: 1.9, damageMultiplier: 1.9,
    desc: 'Phantom sprint through shadows, slicing enemies along the path for 1.9x and gaining +40% speed for 2s.'
  },
  poison_darts: {
    id: 'poison_darts', class: 'rogue', reqLevel: 5, name: 'Venom Shurikens', icon: '🎯', category: 'Ranged Poison Spread', fxType: 'poison_darts',
    mpCost: 12, cooldown: 3.5, dmgMult: 2.3, damageMultiplier: 2.3, poisonDuration: 4.0, poisonDmg: 14,
    desc: 'Fling 3 venom-coated shurikens in a lethal spread, dealing 2.3x damage and inflicting heavy neurotoxin.'
  },
  caltrops: {
    id: 'caltrops', class: 'rogue', reqLevel: 10, name: 'Barbed Caltrops', icon: '⛓️', category: 'Ground Trap / Bleed', fxType: 'caltrops',
    mpCost: 14, cooldown: 5.0, radius: 3.2, dmgMult: 1.6, damageMultiplier: 1.6, slowDuration: 4.0,
    desc: 'Scatter razor-spiked caltrops on the ground, crippling enemy move speed by 60% and causing bleeding.'
  },
  shadowstep: {
    id: 'shadowstep', class: 'rogue', reqLevel: 15, name: 'Shadowstep Ambush', icon: '👤', category: 'Backstab Teleport', fxType: 'shadowstep',
    mpCost: 16, cooldown: 4.5, dmgMult: 2.8, damageMultiplier: 2.8, critBonus: 0.50,
    desc: 'Vanish and reappear directly behind the nearest enemy, backstabbing for 2.8x damage with +50% Crit!'
  },
  toxic_bomb: {
    id: 'toxic_bomb', class: 'rogue', reqLevel: 20, name: 'Toxic Smoke Bomb', icon: '☠️', category: 'AoE Poison Fog', fxType: 'toxic_bomb',
    mpCost: 16, cooldown: 4.5, radius: 3.2, dmgMult: 1.4, damageMultiplier: 1.4, poisonDuration: 4.5, poisonDmg: 11,
    desc: 'Toss a caustic chemical flask creating a corrosive poison cloud that melts enemy armor and deals 11 DoT.'
  },
  smoke_screen: {
    id: 'smoke_screen', class: 'rogue', reqLevel: 25, name: 'Vanish Smoke Screen', icon: '🌫️', category: 'Stealth & 100% Crit', fxType: 'smoke_screen',
    mpCost: 15, cooldown: 7.5, duration: 3.5,
    desc: 'Vanish into thick smoke for 3.5s: gain 100% movement speed and make your next strike a guaranteed 2.5x Critical.'
  },
  death_blossom: {
    id: 'death_blossom', class: 'rogue', reqLevel: 30, name: 'Death Blossom', icon: '🌸', category: 'Ultimate Omnislash', fxType: 'death_blossom',
    mpCost: 28, cooldown: 9.5, radius: 4.0, slashes: 8, dmgMult: 4.0, damageMultiplier: 4.0,
    desc: '[ULTIMATE] Become an untargetable shadow blur, slashing all surrounding enemies 8 times for 4.0x total damage!'
  },
  venomous_barrage: {
    id: 'venomous_barrage', class: 'rogue', reqLevel: 35, name: 'Viper Venom Barrage', icon: '🐍', category: 'Rapid Piercing Volley', fxType: 'venomous_barrage',
    mpCost: 22, cooldown: 5.5, distance: 7.5, dmgMult: 3.2, damageMultiplier: 3.2,
    desc: 'Spray a fan of 15 lethal neurotoxin needle-blades, piercing through all enemies for 3.2x damage and lethal poisoning.'
  },
  phantom_assassins: {
    id: 'phantom_assassins', class: 'rogue', reqLevel: 40, name: 'Shadow Clone Mirage', icon: '👥', category: 'Clone Decoy Flurry', fxType: 'phantom_assassins',
    mpCost: 24, cooldown: 7.0, radius: 4.2, dmgMult: 3.0, damageMultiplier: 3.0,
    desc: 'Project 2 ethereal shadow clone phantoms that dash through nearby targets, executing synchronized cross-cleaves for 3.0x damage.'
  },
  assassins_cull: {
    id: 'assassins_cull', class: 'rogue', reqLevel: 45, name: 'Guillotine Execution', icon: '🩸', category: 'Execute Heavy Burst', fxType: 'assassins_cull',
    mpCost: 26, cooldown: 6.5, dmgMult: 4.2, damageMultiplier: 4.2,
    desc: 'Perform a ruthless execution strike dealing 4.2x damage. Deals +100% additional bonus damage to enemies under 50% HP!'
  },
  abyssal_tether: {
    id: 'abyssal_tether', class: 'rogue', reqLevel: 50, name: 'Abyssal Shadow Chains', icon: '⛓️', category: 'Shadow Pull & Lockdown', fxType: 'abyssal_tether',
    mpCost: 26, cooldown: 10.0, radius: 5.2, rootDuration: 3.0,
    desc: 'Fire shadowy barbed chains that latch onto all surrounding foes, pulling them into an agonizing cluster and rooting them for 3s.'
  },
  blade_dance: {
    id: 'blade_dance', class: 'rogue', reqLevel: 55, name: 'Dancing Razor Mirage', icon: '🩰', category: 'Mirage Blade Flurry', fxType: 'blade_dance',
    mpCost: 32, cooldown: 9.0, radius: 4.8, dmgMult: 4.5, damageMultiplier: 4.5,
    desc: 'Dance through shadows at blinding speed, leaving cutting razor ribbons across the battlefield for 4.5x total damage.'
  },
  eclipse_execution: {
    id: 'eclipse_execution', class: 'rogue', reqLevel: 60, name: 'Void Eclipse Omnislash', icon: '🌑', category: 'Grand Ultimate', fxType: 'eclipse_execution',
    mpCost: 45, cooldown: 15.0, radius: 6.0, dmgMult: 6.0, damageMultiplier: 6.0,
    desc: '[LV. 60 GRAND ULTIMATE] Plunge the arena into total void eclipse: flash through all targets 16 times with neon-violet cross-cleaves for 6.0x catastrophic burst damage!'
  }
};

const CLASS_SKILLS_CATALOG = {
  warrior: Object.values(ALL_CLASS_SKILLS).filter(s => s.class === 'warrior').sort((a, b) => a.reqLevel - b.reqLevel),
  mage: Object.values(ALL_CLASS_SKILLS).filter(s => s.class === 'mage').sort((a, b) => a.reqLevel - b.reqLevel),
  rogue: Object.values(ALL_CLASS_SKILLS).filter(s => s.class === 'rogue').sort((a, b) => a.reqLevel - b.reqLevel)
};

const SKILL_RUNES = {
  none: { id: 'none', name: 'Standard Rune', icon: '⚪', desc: 'Default ability power without elemental modifiers.', color: '#94a3b8' },
  flame: { id: 'flame', name: 'Infernal Flame', icon: '🔴', desc: '+25% Damage and ignites enemies with persistent Burn DoT.', color: '#ef4444' },
  frost: { id: 'frost', name: 'Glacial Frost', icon: '🔵', desc: 'Adds 40% Chill Slow for 3.5s and 25% chance to Freeze solid.', color: '#38bdf8' },
  tempest: { id: 'tempest', name: 'Tempest Surge', icon: '⚡', desc: '-20% Cooldown reduction and +10% Electric Shock DMG.', color: '#eab308' },
  vampiric: { id: 'vampiric', name: 'Vampiric Drain', icon: '🟣', desc: 'Restores 25% of all skill damage dealt as immediate HP life leech.', color: '#a855f7' }
};

const DEFAULT_EQUIPPED_SKILLS = {
  warrior: {
    slot1: 'whirlwind',
    slot2: 'earthshaker',
    slot3: 'colossus_strike',
    dash: 'blade_charge',
    runes: { slot1: 'none', slot2: 'none', slot3: 'none', dash: 'none' }
  },
  mage: {
    slot1: 'firestorm',
    slot2: 'frost_nova',
    slot3: 'black_hole',
    dash: 'arcane_blink',
    runes: { slot1: 'none', slot2: 'none', slot3: 'none', dash: 'none' }
  },
  rogue: {
    slot1: 'fan_of_knives',
    slot2: 'toxic_bomb',
    slot3: 'death_blossom',
    dash: 'shadow_dash',
    runes: { slot1: 'none', slot2: 'none', slot3: 'none', dash: 'none' }
  }
};

// Slots a client may cast from (Skill Link casts use internal 'link_<skill>' slots)
const CLIENT_SKILL_SLOTS = new Set(['slot1', 'slot2', 'slot3', 'dash', 'weapon', 'skill1', 'skill2']);

const DEFAULT_SKILL_FOR_SLOT = (player, slot) => {
  const defaults = DEFAULT_EQUIPPED_SKILLS[player.characterClass] || DEFAULT_EQUIPPED_SKILLS.warrior;
  return ALL_CLASS_SKILLS[defaults[slot]] || ALL_CLASS_SKILLS.whirlwind;
};

const CLASS_SKILLS = {
  warrior: {
    skill1: ALL_CLASS_SKILLS.whirlwind,
    skill2: ALL_CLASS_SKILLS.earthshaker,
    dash: ALL_CLASS_SKILLS.blade_charge
  },
  mage: {
    skill1: ALL_CLASS_SKILLS.firestorm,
    skill2: ALL_CLASS_SKILLS.frost_nova,
    dash: ALL_CLASS_SKILLS.arcane_blink
  },
  rogue: {
    skill1: ALL_CLASS_SKILLS.fan_of_knives,
    skill2: ALL_CLASS_SKILLS.toxic_bomb,
    dash: ALL_CLASS_SKILLS.shadow_dash
  }
};

const SKILL_TREES = require('./talents');
// How close a hero must stand to a portal to use it (client shows the button in range)
const PORTAL_USE_RANGE = 2.5;
const RAID = require('./raidBosses');
// Party EXP sharing: members within this many tiles (1 tile = 1 metre) of the
// killer, on the same map, split the kill's EXP; each extra member adds this bonus
const PARTY_EXP_RANGE = 10;
const PARTY_EXP_BONUS = 0.1;
const TALENT_PROCS = SKILL_TREES.TALENT_PROCS;


const MAX_PLAYER_ELEMENT_RESIST = 0.6;
const PARTY_SUMMON_TTL_MS = 30000;
// Loot left on the ground disappears after this long
const ITEM_DESPAWN_MS = 5 * 60 * 1000;
const ITEM_SWEEP_INTERVAL_MS = 1000;
// Mage basic attacks burst on impact: nearby monsters take this share of the hit
const MAGE_SPLASH_SHARE = 0.3;
const MAGE_SPLASH_RADIUS = 1.9;
// Dungeon completion grade: par time grows with the number of rooms
const RUN_PAR_BASE_SEC = 90;
const RUN_PAR_PER_ROOM_SEC = 25;
const RUN_RANK_MULT = { S: 2, A: 1.5, B: 1.2, C: 1 };
// Potions usable from the quick slots: share of max HP / MP restored
const POTIONS = {
  health_potion: { kind: 'health', pct: 0.45 },
  greater_health_potion: { kind: 'health', pct: 0.75 },
  mana_potion: { kind: 'mana', pct: 0.5 },
  greater_mana_potion: { kind: 'mana', pct: 0.8 }
};
// Equipment drop rates (kept low on purpose)
const MOB_GEAR_DROP_CHANCE = 0.025;
const BOSS_GEAR_DROP_CHANCE = 0.35;
const BOSS_BONUS_GEAR_DROP_CHANCE = 0.06;
const BOSS_REVIVAL_STONE_CHANCE = 0.4;

class GameServer {
  [key: string]: any;
  io: any;
  townMap: any;
  fields: Map<string, any>;
  frostfellMap: any;
  dungeonFloor: number;
  dungeonDifficulty: string;
  dungeon: any;
  players: Map<string, any>;
  townMobs: Map<string, any>;
  frostfellMobs: Map<string, any>;
  dungeonMobs: Map<string, any>;
  townGroundItems: Map<string, any>;
  frostfellGroundItems: Map<string, any>;
  dungeonGroundItems: Map<string, any>;
  parties: Map<string, any>;
  playerParties: Map<string, any>;
  nextPartyId: number;
  dungeonInstances: Map<string, any>;
  ctxInstanceId: any;
  projectiles: Map<string, any>;
  smokeClouds: any[];
  nextEntityId: number;
  TICK_RATE: number;
  tickInterval: any;
  _ftQueue: Map<string, any>;
  constructor(io) {
    this.io = io;
    this.townMap = generateMap();

    // Level-chained open-world field zones (Greenmeadow Lv 1 ... Celestial Reach Lv 100).
    // The town itself is monster-free; townMobs stays empty.
    this.fields = new Map<any, any>();
    FIELD_ZONES.forEach(zone => {
      this.fields.set(zone.id, { zone, map: generateFieldMap(zone), mobs: new Map<any, any>(), groundItems: new Map<any, any>() });
    });
    const frostfell = this.fields.get('frostfell');
    this.frostfellMap = frostfell.map;
    this.dungeonFloor = 1;
    this.dungeonDifficulty = 'normal';
    this.dungeon = generateProceduralDungeon(this.dungeonFloor, this.dungeonDifficulty);

    this.players = new Map<any, any>();
    this.townMobs = new Map<any, any>();
    this.frostfellMobs = frostfell.mobs;
    this.dungeonMobs = new Map<any, any>();

    this.townGroundItems = new Map<any, any>();
    this.frostfellGroundItems = frostfell.groundItems;
    this.dungeonGroundItems = new Map<any, any>();
    this.parties = new Map<any, any>(); // partyId -> { id, leaderId, memberIds: Set }
    this.playerParties = new Map<any, any>(); // socketId -> partyId
    this.nextPartyId = 1;
    this.dungeonInstances = new Map<any, any>(); // instanceId -> { id, partyId, floor, difficulty, dungeon, mobs, groundItems, chests, cleared }
    // Dungeon instance the current handler / tick step is acting in. Lookups and
    // emits that only know the zone name 'dungeon' resolve against it.
    this.ctxInstanceId = null;

    this.projectiles = new Map<any, any>();
    this.smokeClouds = []; // Nightblade Smoke Bomb: { zone, instanceId, x, y, r, miss, until }
    this.nextEntityId = 1000;

    this.TICK_RATE = 25;
    this.tickInterval = null;
    this._ftQueue = new Map<any, any>(); // socket room -> floating texts waiting for this tick's batch

    // Field raid / world boss events: per-zone live state and spawn schedule.
    this.raidStates = new Map<any, any>();   // zoneId -> { conf, def, mobId, damage: Map(id->amt), despawnAt, lastBroadcast }
    this.raidNextSpawn = new Map<string, number>();
    for (const zid of Object.keys(RAID.RAID_BOSSES)) {
      const conf = RAID.RAID_BOSSES[zid];
      this.raidNextSpawn.set(zid, Date.now() + (conf.firstDelayMinutes || 5) * RAID.MINUTE);
    }

    this.initFrostfellMonsters();
    this.initFieldMonsters();
    this.initDungeonMonsters();
    this.startGameLoop();

    // Auto-save all online players with an active account every 30 seconds
    setInterval(() => {
      this.saveAllOnlinePlayers();
    }, 30000);
  }

  savePlayerAccount(socketId) {
    const player = this.players.get(socketId);
    if (!player || !player.accountUsername) return;
    accountManager.saveCharacter(player.accountUsername, player, player.accountSlot || 0);
  }

  saveAllOnlinePlayers() {
    for (const player of this.players.values()) {
      if (player.accountUsername) {
        accountManager.saveCharacter(player.accountUsername, player, player.accountSlot || 0);
      }
    }
  }

  handleAccountRegister(socket, data) {
    if (!data) return;
    const { username, password, heroName, characterClass } = data;
    const name = (heroName || username || 'Hero').substring(0, 15).trim() || 'Hero';
    if (accountManager.isNameTaken(name)) {
      socket.emit('account_register_response', { success: false, message: 'ชื่อตัวละครนี้ถูกใช้แล้ว' });
      return;
    }
    const res = accountManager.register(username, password, this.makeStarterCharacter(name, characterClass));
    if (res.success) socket.data.username = res.username;
    socket.emit('account_register_response', res);
  }

  // Create another character on a logged-in account
  handleCreateCharacter(socket, data) {
    const username = accountManager.usernameForToken(data && data.token);
    if (!username) return socket.emit('character_list_response', { success: false, message: 'Session expired - please log in again.' });
    const name = String(data.name || '').substring(0, 15).trim();
    if (name.length < 2) return socket.emit('character_list_response', { success: false, message: 'ชื่อตัวละครต้องมีอย่างน้อย 2 ตัวอักษร' });
    const res = accountManager.createCharacter(username, this.makeStarterCharacter(name, data.characterClass));
    socket.emit('character_list_response', res);
  }

  handleDeleteCharacter(socket, data) {
    const username = accountManager.usernameForToken(data && data.token);
    if (!username) return socket.emit('character_list_response', { success: false, message: 'Session expired - please log in again.' });
    const slot = Number(data.slot);
    const online = Array.from(this.players.values()).some(p => p.accountUsername === username);
    if (online) return socket.emit('character_list_response', { success: false, message: 'Leave the game before deleting a character.' });
    socket.emit('character_list_response', accountManager.deleteCharacter(username, slot));
  }

  makeStarterCharacter(heroName, characterClass) {
    const defaultClasses = {
      warrior: { maxHp: 180, maxMp: 50, dmg: 22, def: 8, speed: 4.8, attackRange: 1.6, attackSpeed: 1.0, swipe: 40 },
      mage: { maxHp: 95, maxMp: 130, dmg: 32, def: 3, speed: 4.4, attackRange: 5.5, attackSpeed: 0.95, swipe: 15 },
      rogue: { maxHp: 125, maxMp: 70, dmg: 26, def: 5, speed: 5.4, attackRange: 1.8, attackSpeed: 1.30, swipe: 25 }
    };
    const chosenClass = defaultClasses[characterClass] ? characterClass : 'warrior';
    const cleanHeroName = (heroName || 'Hero').substring(0, 15).trim() || 'Hero';

    const starterChar = {
      name: cleanHeroName,
      characterClass: chosenClass,
      level: 1,
      exp: 0,
      expNext: expToNext(1),
      skillPoints: 1,
      skills: {},
      equippedSkills: JSON.parse(JSON.stringify(DEFAULT_EQUIPPED_SKILLS[chosenClass] || DEFAULT_EQUIPPED_SKILLS.warrior)),
      equipment: {
        weapon: chosenClass === 'warrior' ? { ...ITEMS.iron_blade, count: 1 } : (chosenClass === 'mage' ? { ...ITEMS.archmage_staff, count: 1 } : { ...ITEMS.shadow_daggers, count: 1 }),
        armor: chosenClass === 'mage' ? { ...ITEMS.mystic_robe, count: 1 } : (chosenClass === 'rogue' ? { ...ITEMS.leather_tunic, count: 1 } : null),
        helmet: chosenClass === 'warrior' ? { ...ITEMS.iron_helm, count: 1 } : null,
        boots: null,
        ring: null
      },
      gold: 50,
      inventory: {
        healthPotions: 3,
        manaPotions: 2,
        kills: 0,
        items: [
          { ...ITEMS.ancient_ruby, count: 1 },
          { ...ITEMS.revival_stone, count: 1 }
        ]
      },
      zone: 'town',
      x: 20,
      y: 23
    };

    return starterChar;
  }

  handleAccountLogin(socket, data) {
    if (!data) return;
    const res = accountManager.login(data.username, data.password);
    socket.emit('account_login_response', res);
  }

  // --- zone rooms: every socket sits in the room of the zone / dungeon instance it is in ---
  emitZone(zone, event, data, instanceId = null) {
    if (!zone) return this.io.emit(event, data);
    if (zone === 'dungeon' && !instanceId) instanceId = this.ctxInstanceId;
    const room = (zone === 'dungeon' && instanceId) ? `dungeon:${instanceId}` : `zone:${zone}`;
    // Damage numbers come by the hundred in big fights: queue them and send
    // one batch per room per tick (flushFloatingTexts) instead of a message each
    if (event === 'floating_text') {
      let q = this._ftQueue.get(room);
      if (!q) this._ftQueue.set(room, q = []);
      if (q.length < FLOATING_TEXT_BATCH_MAX) q.push(data);
      return;
    }
    this.io.to(room).emit(event, data);
  }

  flushFloatingTexts() {
    for (const [room, list] of this._ftQueue) {
      this.io.to(room).emit('floating_texts', list.map(t => ({
        ...t, x: Math.round(t.x * 100) / 100, y: Math.round(t.y * 100) / 100
      })));
    }
    this._ftQueue.clear();
  }

  // Run fn with the given player's dungeon instance as the active context.
  runAs(socketId, fn) {
    const prev = this.ctxInstanceId;
    const player = this.players.get(socketId);
    this.ctxInstanceId = player ? (player.dungeonInstanceId || null) : null;
    try {
      return fn();
    } finally {
      this.ctxInstanceId = prev;
    }
  }

  syncZoneRooms() {
    for (const player of this.players.values()) {
      const roomKey = (player.zone === 'dungeon' && player.dungeonInstanceId)
        ? `dungeon:${player.dungeonInstanceId}`
        : `zone:${player.zone}`;
      if (player._room === roomKey) continue;
      const socket = this.io.sockets.sockets.get(player.id);
      if (!socket) continue;
      if (player._room) socket.leave(player._room);
      socket.join(roomKey);
      player._room = roomKey;
    }
  }

  // --- dungeon instance helpers ---
  // Lava cracks, acid, frost and rifts afflict whoever stands on them
  applyDungeonHazard(player) {
    if (player.isDead || player.godMode) return;
    const inst = this.getPlayerDungeonInstance(player);
    const row = inst && inst.dungeon.tiles[Math.floor(player.y)];
    const hazard = row && DUNGEON_HAZARDS[row[Math.floor(player.x)]];
    if (!hazard) return;
    const value = hazard.dot ? Math.max(1, Math.round(player.maxHp * hazard.dot)) : 0.4;
    this.applyStatusEffect(player, hazard.status, hazard.duration, value);
  }

  getPlayerDungeonInstance(player) {
    if (!player || player.zone !== 'dungeon' || !player.dungeonInstanceId) return null;
    return this.dungeonInstances.get(player.dungeonInstanceId) || null;
  }

  getOrCreateDungeonInstance(player, floor = 1, difficulty = 'normal', forceRegen = false) {
    const instanceId = player.partyId ? `party_${player.partyId}` : `solo_${player.id}`;
    if (!forceRegen && this.dungeonInstances.has(instanceId)) {
      return this.dungeonInstances.get(instanceId);
    }

    const dungeonMap = generateProceduralDungeon(floor, difficulty);
    // Monsters wait per room and only appear once a door into their room
    // opens (see updateDungeonRooms / spawnDungeonRoom)
    const pendingMobs = new Map<any, any>(); // roomIdx -> mobs
    if (dungeonMap && dungeonMap.mobs) {
      dungeonMap.mobs.forEach(mob => {
        if (!pendingMobs.has(mob.roomIdx)) pendingMobs.set(mob.roomIdx, []);
        pendingMobs.get(mob.roomIdx).push({
          ...mob,
          def: mob.def || 10,
          buffs: mob.buffs || [],
          isCommander: !!mob.isCommander,
          auraRadius: mob.auraRadius || 0,
          hasCommanderBuff: false
        });
      });
    }

    const inst: any = {
      id: instanceId,
      partyId: player.partyId || null,
      floor,
      difficulty,
      dungeon: dungeonMap,
      mobs: new Map<any, any>(),
      pendingMobs,
      groundItems: new Map<any, any>(),
      chests: dungeonMap.chests || [],
      cleared: false,
      startedAt: Date.now()
    };

    this.dungeonInstances.set(instanceId, inst);
    // The entrance (no monsters) clears at once, opening its doors and
    // spawning the rooms behind them
    this.updateDungeonRooms(inst);
    inst.announce = true;
    return inst;
  }

  // ---------------------------------------------------------------- SP cards
  equipSpCard(player, itemIndex) {
    const socket = this.io.sockets.sockets.get(player.id);
    const say = (text, color = '#ef4444') => socket && socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text, color });
    const item = player.inventory.items[itemIndex];
    const card = item && SP.CARD_BY_ID[item.cardId];
    if (!card) return;
    if (card.cls !== player.characterClass) return say(`Only a ${card.cls} can wear this card!`);
    if ((player.jobLevel || 1) < card.jobReq) return say(`Requires Job Lv. ${card.jobReq}!`);
    if (player.spTransformed) this.setTransformed(player, false);
    player.inventory.items.splice(itemIndex, 1);
    const old = player.equipment.sp;
    if (old) player.inventory.items.push(old);
    player.equipment.sp = { ...item, count: 1 };
    this.recalculatePlayerStats(player);
    say(`Equipped SP Card: ${card.name}. Press T to transform!`, '#c084fc');
    if (socket) socket.emit('player_updated', player);
  }

  handleSpTransform(socketId) {
    const player = this.players.get(socketId);
    const socket = this.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead) return;
    const say = (text, color = '#ef4444') => socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text, color });
    const cardItem = player.equipment && player.equipment.sp;
    const card = cardItem && SP.CARD_BY_ID[cardItem.cardId];
    if (!card) return say('No SP card equipped!');
    if (player.spCooldown > 0) return say(`Transform ready in ${Math.ceil(player.spCooldown)}s`);
    if (!player.spTransformed && (player.jobLevel || 1) < card.jobReq) return say(`Requires Job Lv. ${card.jobReq}!`);
    this.setTransformed(player, !player.spTransformed);
  }

  // The card's four equipped skills for this hero (their picks from its arsenal)
  spLoadout(player, card) {
    if (!player.spLoadouts) player.spLoadouts = {};
    const saved = player.spLoadouts[card.id] || {};
    const out = {};
    for (const slot of ['slot1', 'slot2', 'slot3', 'dash']) {
      const id = saved[slot];
      const sk = id && card.arsenal.includes(id) && SP.SP_SKILLS[id];
      out[slot] = sk && sk.isDash === (slot === 'dash') ? id : card.skills[slot];
    }
    player.spLoadouts[card.id] = out;
    return { ...out };
  }

  // Spellbook while transformed: swap skills from the card's arsenal
  customizeSpSkill(player, data) {
    const socket = this.io.sockets.sockets.get(player.id);
    const say = (text, color = '#ef4444') => socket && socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text, color });
    const card = player.equipment && player.equipment.sp && SP.CARD_BY_ID[player.equipment.sp.cardId];
    const slots = ['slot1', 'slot2', 'slot3', 'dash'];
    if (!card || !data || !slots.includes(data.slot)) return;
    const loadout = this.spLoadout(player, card);
    let notice = null;

    if (data.skillId) {
      const sk = SP.SP_SKILLS[data.skillId];
      if (!sk || !card.arsenal.includes(data.skillId)) return;
      if (sk.isDash !== (data.slot === 'dash')) return say(sk.isDash ? 'Movement skills go in the [Shift] slot' : 'Only movement skills fit the [Shift] slot');
      // already in another slot: trade places
      for (const slot of slots) if (slot !== data.slot && loadout[slot] === data.skillId) loadout[slot] = loadout[data.slot];
      loadout[data.slot] = data.skillId;
      player.spLoadouts[card.id] = loadout;
      Object.assign(player.equippedSkills, loadout);
      notice = `Set [${sk.name}]`;
    }
    if (data.rune !== undefined && SKILL_RUNES[data.rune]) {
      player.equippedSkills.runes[data.slot] = data.rune;
      if (player.baseEquippedSkills && player.baseEquippedSkills.runes) player.baseEquippedSkills.runes[data.slot] = data.rune;
      notice = `Inscribed [${SKILL_RUNES[data.rune].name}]`;
    }
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('custom_skills_updated', { equippedSkills: player.equippedSkills });
      if (notice) say(notice, '#facc15');
    }
  }

  setTransformed(player, on) {
    const socket = this.io.sockets.sockets.get(player.id);
    const cardItem = player.equipment && player.equipment.sp;
    const card = cardItem && SP.CARD_BY_ID[cardItem.cardId];
    if (on && !card) return;
    if (on === !!player.spTransformed) return;
    if (on) {
      player.baseEquippedSkills = JSON.parse(JSON.stringify(player.equippedSkills || DEFAULT_EQUIPPED_SKILLS[player.characterClass]));
      player.equippedSkills = {
        ...this.spLoadout(player, card),
        runes: player.baseEquippedSkills.runes || { slot1: 'none', slot2: 'none', slot3: 'none', dash: 'none' }
      };
      player.spTransformed = true;
    } else {
      if (player.baseEquippedSkills) player.equippedSkills = player.baseEquippedSkills;
      player.baseEquippedSkills = null;
      player.spTransformed = false;
    }
    player.spCooldown = SP_TRANSFORM_COOLDOWN;
    this.recalculatePlayerStats(player);
    this.emitZone(player.zone, 'sp_transform', {
      playerId: player.id, on: player.spTransformed, cardId: cardItem ? cardItem.cardId : null,
      level: cardItem ? (cardItem.upgradeLevel || 0) : 0, x: player.x, y: player.y
    });
    if (socket) socket.emit('player_updated', player);
  }

  fragmentCount(player) {
    const stack = player.inventory.items.find(i => i.id === 'spirit_fragment');
    return stack ? (stack.count || 1) : 0;
  }

  spendFragments(player, n) {
    const idx = player.inventory.items.findIndex(i => i.id === 'spirit_fragment');
    if (idx < 0) return;
    const stack = player.inventory.items[idx];
    stack.count = (stack.count || 1) - n;
    if (stack.count <= 0) player.inventory.items.splice(idx, 1);
  }

  // Enchanter: +1 an SP card (equipped or in the bag) for gold and fragments
  handleSpCardEnhance(socketId, data) {
    const player = this.players.get(socketId);
    const socket = this.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead || player.zone !== 'town' || !data) return;
    const item = data.target === 'equipped' ? player.equipment.sp : player.inventory.items[data.itemIndex];
    if (!item || item.type !== 'sp_card') return;
    const fail = (message) => socket.emit('sp_enhance_result', { ok: false, message });
    const lvl = item.upgradeLevel || 0;
    if (lvl >= SP.SP_MAX_LEVEL) return fail(`Card is already +${SP.SP_MAX_LEVEL}!`);
    const cost = SP.cardEnhanceCost(item.cardId, lvl);
    if (player.gold < cost.gold) return fail(`Need ${cost.gold.toLocaleString()} Gold!`);
    if (this.fragmentCount(player) < cost.fragments) return fail(`Need ${cost.fragments} Spirit Fragments!`);

    player.gold -= cost.gold;
    this.spendFragments(player, cost.fragments);
    const success = Math.random() < (SP.SP_ENHANCE_CHANCE[lvl] || 0);
    let downgraded = false;
    if (success) item.upgradeLevel = lvl + 1;
    else if (lvl >= SP.SP_SAFE_LEVEL) { item.upgradeLevel = lvl - 1; downgraded = true; }
    const card = SP.CARD_BY_ID[item.cardId];
    item.name = `SP Card: ${card.name}${item.upgradeLevel ? ' +' + item.upgradeLevel : ''}`;
    if (data.target === 'equipped') this.recalculatePlayerStats(player);
    this.savePlayerAccount(socketId);
    socket.emit('player_updated', player);
    socket.emit('sp_enhance_result', { ok: true, success, downgraded, level: item.upgradeLevel || 0, cost, item });
    if (player.spTransformed && data.target === 'equipped') {
      this.emitZone(player.zone, 'sp_transform', { playerId: player.id, on: true, cardId: item.cardId, level: item.upgradeLevel || 0, x: player.x, y: player.y, refresh: true });
    }
    if (success && item.upgradeLevel >= 70) this.broadcastSystemMessage(`[${player.name}] enhanced [${card.name}] to +${item.upgradeLevel}!`);
  }

  // Enchanter: trade fragments + gold for a card of your class (any tier)
  handleSpCardExchange(socketId, data) {
    const player = this.players.get(socketId);
    const socket = this.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead || player.zone !== 'town' || !data) return;
    const card = SP.CARD_BY_ID[data.cardId];
    const fail = (message) => socket.emit('sp_exchange_result', { ok: false, message });
    if (!card || card.cls !== player.characterClass) return fail('That card is not for your class.');
    const price = SP.SP_TIERS[card.tier].exchange;
    if (!price) return fail('This card can only be found on the deepest bosses.');
    if (this.fragmentCount(player) < price.fragments) return fail(`Need ${price.fragments} Spirit Fragments!`);
    if (player.gold < price.gold) return fail(`Need ${price.gold.toLocaleString()} Gold!`);
    if (player.inventory.items.length >= 30) return fail('Inventory is full!');
    player.gold -= price.gold;
    this.spendFragments(player, price.fragments);
    player.inventory.items.push({ ...SP.makeCardItem(card.id), custom: true, count: 1 });
    this.savePlayerAccount(socketId);
    socket.emit('player_updated', player);
    socket.emit('sp_exchange_result', { ok: true, cardId: card.id });
    this.broadcastSystemMessage(`[${player.name}] obtained the SP Card [${card.name}] from Valka!`);
  }

  awardJobExp(player, amount) {
    if (!amount || (player.jobLevel || 1) >= SP.JOB_MAX_LEVEL) return;
    player.jobLevel = player.jobLevel || 1;
    player.jobExp = (player.jobExp || 0) + amount;
    player.jobExpNext = SP.jobExpToNext(player.jobLevel);
    let leveled = false;
    while (player.jobLevel < SP.JOB_MAX_LEVEL && player.jobExp >= player.jobExpNext) {
      player.jobExp -= player.jobExpNext;
      player.jobLevel++;
      player.jobExpNext = SP.jobExpToNext(player.jobLevel);
      leveled = true;
    }
    if (player.jobLevel >= SP.JOB_MAX_LEVEL) player.jobExp = 0;
    if (leveled) {
      this.recalculatePlayerStats(player);
      this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 1.7, text: `JOB LEVEL ${player.jobLevel}!`, color: '#c084fc', size: 20 });
      this.emitZone(player.zone, 'job_level_up', { playerId: player.id, jobLevel: player.jobLevel, x: player.x, y: player.y });
      this.broadcastSystemMessage(`[${player.name}] reached Job Level ${player.jobLevel}!`);
    }
  }

  // Boss loot for every hero in the instance: a rare card roll and fragments
  rollBossSpLoot(inst, bossLevel) {
    for (const p of this.players.values()) {
      if (p.zone !== 'dungeon' || p.dungeonInstanceId !== inst.id) continue;
      // heroes far above the boss's level get no card or fragments
      if (Math.random() >= lootGapMult(p.level, bossLevel)) continue;
      const cardId = SP.rollCardDrop(p.characterClass, inst.floor, inst.difficulty);
      if (cardId) {
        this.giveLootToPlayer(p, { type: 'item', itemId: 'sp_card', customItemData: { ...SP.makeCardItem(cardId), custom: true }, amount: 1 });
        this.broadcastSystemMessage(`[${p.name}] found the SP Card [${SP.CARD_BY_ID[cardId].name}] on B${inst.floor}!`);
      }
      if (Math.random() < SP.FRAGMENT_DROP.boss) {
        this.giveLootToPlayer(p, { type: 'item', itemId: 'spirit_fragment', amount: SP.bossFragments(inst.floor) });
      }
      const socket = this.io.sockets.sockets.get(p.id);
      if (socket) socket.emit('player_updated', p);
    }
  }

  newDungeonRun(inst, cleared = false) {
    return {
      floor: inst.floor, difficulty: inst.difficulty, cleared, gold: 0, items: [],
      startedAt: inst.startedAt || Date.now(), deaths: 0, kills: 0, exp: 0,
      revivalsUsed: 0, maxRevivals: 10
    };
  }

  // Doors open as rooms are cleared: every door leading on from a cleared room
  // unlocks, the boss door included (side rooms don't have to be cleared).
  // A room's monsters spawn when a door into it opens, so a room is cleared
  // only once it has spawned and all its monsters are dead.
  updateDungeonRooms(inst) {
    const dung = inst.dungeon;
    if (!dung || !dung.doors || !dung.rooms) return;
    if (!inst.roomsCleared) inst.roomsCleared = new Set();
    if (!inst.roomsSpawned) inst.roomsSpawned = new Set();
    const newlyCleared = [];
    const opened = [];
    const spawned = [];
    if (!inst.roomsSpawned.has(0)) spawned.push(...this.spawnDungeonRoom(inst, 0));

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
        dung.obstacles = dung.obstacles.filter(o => o.id !== d.id);
        opened.push({ id: d.id, tiles: d.tiles, boss: d.boss, x: d.x, y: d.y });
        if (!inst.roomsSpawned.has(d.to)) spawned.push(...this.spawnDungeonRoom(inst, d.to));
        progress = true;
      }
      if (!progress) break;
    }
    if (!newlyCleared.length && !opened.length) return;

    const bossIdx = dung.rooms.length - 1;
    if (!inst.announce) return; // first pass at creation: nobody to tell yet
    if (spawned.length) this.emitZone('dungeon', 'dungeon_mobs_spawned', { mobs: spawned }, inst.id);
    for (const i of newlyCleared) {
      if (i === 0 || i === bossIdx) continue;
      const r = dung.rooms[i];
      this.emitZone('dungeon', 'floating_text', { x: r.cx + 0.5, y: r.cy, text: 'ROOM CLEARED', color: '#4ade80', size: 22 }, inst.id);
    }
    if (opened.length) {
      this.emitZone('dungeon', 'dungeon_doors_opened', { doors: opened }, inst.id);
      if (opened.some(d => d.boss)) {
        const bd = opened.find(d => d.boss);
        this.emitZone('dungeon', 'floating_text', { x: bd.x, y: bd.y - 0.5, text: 'THE BOSS ROOM IS OPEN', color: '#ef4444', size: 24 }, inst.id);
      }
    }
    for (const p of this.players.values()) {
      if (p.zone === 'dungeon' && p.dungeonInstanceId === inst.id) this.emitDungeonRunUpdate(p);
    }
  }

  // Bring a room's waiting monsters into the instance. Once the run is live
  // they rise for DUNGEON_SPAWN_MS (no AI) while clients play the summon effect.
  // Returns what clients need for that effect.
  spawnDungeonRoom(inst, roomIdx) {
    inst.roomsSpawned.add(roomIdx);
    const list = (inst.pendingMobs && inst.pendingMobs.get(roomIdx)) || [];
    if (inst.pendingMobs) inst.pendingMobs.delete(roomIdx);
    const until = inst.announce ? Date.now() + DUNGEON_SPAWN_MS : 0;
    return list.map(m => {
      m.spawnUntil = until;
      inst.mobs.set(m.id, m);
      return { id: m.id, x: m.x, y: m.y, isBoss: !!m.isBoss, element: m.element || 'neutral' };
    });
  }

  cleanupDungeonInstanceIfEmpty(instanceId) {
    if (!instanceId || !this.dungeonInstances.has(instanceId)) return;
    const hasPlayers = Array.from(this.players.values()).some(p => p.zone === 'dungeon' && p.dungeonInstanceId === instanceId);
    if (!hasPlayers) {
      this.dungeonInstances.delete(instanceId);
    }
  }

  // --- zone lookups (town / field zones / per-instance dungeon) ---
  getMobsMap(zone, playerOrInstId = null) {
    if (zone === 'town') return this.townMobs;
    if (this.fields && this.fields.has(zone)) return this.fields.get(zone).mobs;
    if (zone === 'dungeon') {
      let instId = null;
      if (typeof playerOrInstId === 'string') instId = playerOrInstId;
      else if (playerOrInstId && playerOrInstId.dungeonInstanceId) instId = playerOrInstId.dungeonInstanceId;
      if (!instId) instId = this.ctxInstanceId;
      if (instId && this.dungeonInstances.has(instId)) {
        return this.dungeonInstances.get(instId).mobs;
      }
    }
    return this.dungeonMobs;
  }

  getGroundItemsMap(zone, playerOrInstId = null) {
    if (zone === 'town') return this.townGroundItems;
    if (this.fields && this.fields.has(zone)) return this.fields.get(zone).groundItems;
    if (zone === 'dungeon') {
      let instId = null;
      if (typeof playerOrInstId === 'string') instId = playerOrInstId;
      else if (playerOrInstId && playerOrInstId.dungeonInstanceId) instId = playerOrInstId.dungeonInstanceId;
      if (!instId) instId = this.ctxInstanceId;
      if (instId && this.dungeonInstances.has(instId)) {
        return this.dungeonInstances.get(instId).groundItems;
      }
    }
    return this.dungeonGroundItems;
  }

  // ==========================================
  // PARTY SYSTEM (Invites, Members, Sharing)
  // ==========================================
  getPartyData(partyId) {
    if (!partyId || !this.parties.has(partyId)) return null;
    const party = this.parties.get(partyId);
    const members = [];
    for (const memberId of party.memberIds) {
      const p = this.players.get(memberId);
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
    const data = this.getPartyData(partyId);
    if (!data) return;
    const party = this.parties.get(partyId);
    if (!party) return;
    for (const memberId of party.memberIds) {
      const socket = this.io.sockets.sockets.get(memberId);
      if (socket) {
        socket.emit('party_updated', data);
      }
    }
  }

  handlePartyInvite(socketId, data) {
    const player = this.players.get(socketId);
    if (!player || !data) return;
    const socket = this.io.sockets.sockets.get(socketId);

    let targetPlayer = null;
    if (data.targetPlayerId) {
      targetPlayer = this.players.get(data.targetPlayerId);
    } else if (data.targetName) {
      const nameLower = data.targetName.trim().toLowerCase();
      targetPlayer = Array.from(this.players.values()).find(p => p.name.toLowerCase() === nameLower);
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
      partyId = 'party_' + (this.nextPartyId++);
      this.parties.set(partyId, {
        id: partyId,
        leaderId: player.id,
        memberIds: new Set([player.id])
      });
      player.partyId = partyId;
      this.broadcastPartyUpdate(partyId);
    }

    const party = this.parties.get(partyId);
    if (!party || party.memberIds.size >= 4) {
      if (socket) {
        socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: '⚠️ Party is full! (Max 4 members)', color: '#ef4444' });
      }
      return;
    }

    const targetSocket = this.io.sockets.sockets.get(targetPlayer.id);
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
    const player = this.players.get(socketId);
    if (!player || !data || !data.partyId) return;
    const party = this.parties.get(data.partyId);
    if (!party || party.memberIds.size >= 4) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: '⚠️ Party no longer exists or is full!', color: '#ef4444' });
      return;
    }

    if (player.partyId) {
      this.removePlayerFromParty(socketId);
    }

    party.memberIds.add(player.id);
    player.partyId = party.id;
    this.broadcastPartyUpdate(party.id);

    const leaderPlayer = this.players.get(party.leaderId);
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `⚔️ Joined party of [${leaderPlayer ? leaderPlayer.name : 'Party'}]!`, color: '#4ade80' });
    }
    this.broadcastSystemMessage(`⚔️ [${player.name}] joined the party!`);
  }

  handlePartyDecline(socketId, data) {
    const player = this.players.get(socketId);
    if (!player || !data || !data.inviterId) return;
    const inviterSocket = this.io.sockets.sockets.get(data.inviterId);
    if (inviterSocket) {
      inviterSocket.emit('floating_text', { x: 0, y: 0, text: `[${player.name}] declined party invitation.`, color: '#94a3b8' });
    }
  }

  // Ask every other party member to teleport to this player's map (or dungeon)
  handlePartySummon(socketId) {
    const player = this.players.get(socketId);
    if (!player || player.isDead || !player.partyId) return;
    const party = this.parties.get(player.partyId);
    const socket = this.io.sockets.sockets.get(socketId);
    if (!party || party.memberIds.size <= 1) {
      if (socket) socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: '⚠️ No party members to summon!', color: '#ef4444' });
      return;
    }

    const inst = this.getPlayerDungeonInstance(player);
    const field = this.fields.get(player.zone);
    const where = inst ? `Dungeon B${inst.floor}` : field ? field.zone.name : 'Town';
    const expiresAt = Date.now() + PARTY_SUMMON_TTL_MS;
    let sent = 0;
    for (const memberId of party.memberIds) {
      if (memberId === player.id) continue;
      const member = this.players.get(memberId);
      const memberSocket = this.io.sockets.sockets.get(memberId);
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
    const player = this.players.get(socketId);
    const socket = this.io.sockets.sockets.get(socketId);
    if (!player || !socket || !data) return;
    const pending = player.pendingSummon;
    player.pendingSummon = null;
    const fail = (text) => socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text, color: '#ef4444' });
    if (!pending || pending.fromId !== data.fromId || Date.now() > pending.expiresAt) return fail('⚠️ The summon has expired.');
    const summoner = this.players.get(pending.fromId);
    if (!summoner || summoner.isDead || !player.partyId || summoner.partyId !== player.partyId) return fail('⚠️ The summoner is no longer available.');
    if (player.isDead) return;

    const at = { x: summoner.x, y: summoner.y };
    const inst = this.getPlayerDungeonInstance(summoner);
    const field = this.fields.get(summoner.zone);
    if (inst) {
      const floorConfig = DUNGEON_FLOORS[inst.floor - 1] || { minLevel: 1 };
      if ((player.level || 1) < floorConfig.minLevel) return fail(`⛔ Requires Level ${floorConfig.minLevel}+ for B${inst.floor}!`);
    } else if (field && (player.level || 1) < field.zone.gateLevel) {
      return fail(`⛔ ${field.zone.name} requires Level ${field.zone.gateLevel}+!`);
    }

    // Leaving another dungeon run counts the same as walking out of it
    if (player.zone === 'dungeon') {
      const prevInstId = player.dungeonInstanceId;
      this.endDungeonRun(player, socket);
      player.dungeonInstanceId = null;
      if (prevInstId) this.cleanupDungeonInstanceIfEmpty(prevInstId);
    }

    if (inst) {
      player.dungeonRun = this.newDungeonRun(inst, !!(summoner.dungeonRun && summoner.dungeonRun.cleared));
      this.teleportPlayerToDungeon(player, socket, inst, at);
      this.emitDungeonRunUpdate(player, socket);
    } else if (field) {
      this.teleportPlayerToField(player, socket, summoner.zone, 'south', at);
    } else {
      this.teleportPlayerToTown(player, socket, at);
    }
    player.portalCooldown = 4.0;
  }

  // Online players who can be invited (not in a party yet)
  handlePartyListCandidates(socketId) {
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return;
    const candidates = Array.from(this.players.values())
      .filter(p => p.id !== socketId && !p.partyId)
      .map(p => ({ id: p.id, name: p.name, level: p.level, characterClass: p.characterClass, zone: p.zone }));
    socket.emit('party_candidates', candidates);
  }

  handlePartyLeave(socketId) {
    this.removePlayerFromParty(socketId);
  }

  handlePartyKick(socketId, data) {
    const player = this.players.get(socketId);
    if (!player || !player.partyId || !data || !data.targetId) return;
    const party = this.parties.get(player.partyId);
    if (!party || party.leaderId !== player.id) return;
    if (data.targetId === player.id) return;

    const targetSocket = this.io.sockets.sockets.get(data.targetId);
    const targetPlayer = this.players.get(data.targetId);
    if (targetSocket && targetPlayer) {
      targetSocket.emit('floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '⚠️ You were removed from the party.', color: '#ef4444' });
    }
    this.removePlayerFromParty(data.targetId);
  }

  removePlayerFromParty(socketId) {
    const player = this.players.get(socketId);
    if (!player || !player.partyId) return;
    const partyId = player.partyId;
    const party = this.parties.get(partyId);
    player.partyId = null;

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('party_left');
    }

    if (party) {
      party.memberIds.delete(socketId);
      if (party.memberIds.size === 0) {
        this.parties.delete(partyId);
      } else {
        if (party.leaderId === socketId) {
          party.leaderId = Array.from(party.memberIds)[0];
          const newLeader = this.players.get(party.leaderId);
          if (newLeader) {
            this.broadcastSystemMessage(`👑 [${newLeader.name}] is now the Party Leader!`);
          }
        }
        this.broadcastPartyUpdate(partyId);
      }
    }
  }

  initFieldMonsters() {
    for (const field of this.fields.values()) {
      const defs = buildFieldMobs(field.zone, field.map);
      if (!defs) continue;
      field.mobs.clear();
      defs.forEach(def => {
        const id = `${field.zone.id}_mob_${this.nextEntityId++}`;
        field.mobs.set(id, {
          id,
          type: def.type,
          name: def.name,
          level: def.level,
          x: def.spawn.x,
          y: def.spawn.y,
          spawnX: def.spawn.x,
          spawnY: def.spawn.y,
          zone: def.zone,
          fieldZone: field.zone.id,
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
        });
      });
    }
  }

  initFrostfellMonsters() {
    // Frostfell is a generated field now (fieldZones.js) and spawns with the rest
    if (!this.fields.get('frostfell').zone.custom) return;
    this.frostfellMobs.clear();
    const frostDefs = [
      { type: 'frost_wolf', name: 'Frostbite Wolf', level: 6, maxHp: 550, def: 15, dmg: 38, speed: 3.8, exp: 160, gold: 90, count: 6, buffs: ['frostbite'], element: 'ice', elementResist: { fire: -0.5, ice: 0.5 }, zone: { minX: 5, maxX: 18, minY: 20, maxY: 33 } },
      { type: 'ice_elemental', name: 'Glacial Elemental', level: 8, maxHp: 750, def: 20, dmg: 48, speed: 2.5, exp: 240, gold: 140, count: 6, buffs: ['frostbite'], element: 'ice', elementResist: { fire: -0.6, ice: 0.6 }, zone: { minX: 24, maxX: 38, minY: 8, maxY: 25 } },
      { type: 'frost_titan', name: 'Frost Titan Ymir', level: 12, maxHp: 2800, def: 35, dmg: 75, speed: 2.2, exp: 950, gold: 750, count: 1, buffs: ['frostbite', 'fortified'], element: 'ice', elementResist: { fire: -0.5, ice: 0.7, holy: -0.2 }, zone: { minX: 19, maxX: 23, minY: 16, maxY: 20 }, isBoss: true }
    ];

    frostDefs.forEach(def => {
      for (let i = 0; i < def.count; i++) {
        const id = `frost_mob_${this.nextEntityId++}`;
        // re-roll spawns that land inside trees, crystals or cliffs
        let spawnX, spawnY, tries = 0;
        do {
          spawnX = def.zone.minX + Math.random() * (def.zone.maxX - def.zone.minX);
          spawnY = def.zone.minY + Math.random() * (def.zone.maxY - def.zone.minY);
        } while (this.isColliding(spawnX, spawnY, 'frostfell', 0.3) && ++tries < 30);

        this.frostfellMobs.set(id, {
          id,
          type: def.type,
          name: def.name,
          level: def.level,
          x: spawnX,
          y: spawnY,
          spawnX,
          spawnY,
          zone: def.zone,
          isBoss: !!def.isBoss,
          hp: def.maxHp,
          maxHp: def.maxHp,
          dmg: def.dmg,
          def: def.def,
          speed: def.speed,
          exp: mobExp(def.level, def.isBoss ? 'boss' : 'normal'),
          gold: def.gold,
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
        });
      }
    });
  }

  initDungeonMonsters() {
    this.dungeonMobs.clear();
    if (this.dungeon && this.dungeon.mobs) {
      this.dungeon.mobs.forEach(mob => {
        this.dungeonMobs.set(mob.id, {
          ...mob,
          def: mob.def || 12,
          buffs: mob.buffs || [],
          isCommander: !!mob.isCommander,
          auraRadius: mob.auraRadius || 0,
          hasCommanderBuff: false
        });
      });
    }
  }

  regenerateDungeon(floor = 1, difficulty = 'normal') {
    this.dungeonFloor = floor;
    this.dungeonDifficulty = difficulty;
    this.dungeon = generateProceduralDungeon(floor, difficulty);
    this.dungeonGroundItems.clear();
    this.initDungeonMonsters();
    const floorConfig = DUNGEON_FLOORS[floor - 1] || { name: `Floor ${floor}` };
    const diffLabel = (DIFFICULTIES[difficulty] && DIFFICULTIES[difficulty].name) || difficulty;
    this.broadcastSystemMessage(`🌀 Abyssal Portal re-aligned to ${floorConfig.name} (B${floor}) [${diffLabel.toUpperCase()}]!`);
  }

  isColliding(x, y, zone = 'town', radius = 0.4) {
    if (zone === 'town') {
      if (x < 1 || x > MAP_WIDTH - 2 || y < 1 || y > MAP_HEIGHT - 2) return true;
      const tileX = Math.floor(x);
      const tileY = Math.floor(y);
      if (tileX >= 0 && tileX < MAP_WIDTH && tileY >= 0 && tileY < MAP_HEIGHT) {
        const tile = this.townMap.tiles[tileY][tileX];
        if (tile === TILES.WATER || tile === TILES.CLIFF) return true;
      }
      for (const obs of this.townMap.obstacles) {
        if (!obs.collidable) continue;
        const obsRadius = obs.radius || 0.6;
        if (Math.hypot(obs.x - x, obs.y - y) < (radius + obsRadius)) return true;
      }
    } else if (this.fields.has(zone)) {
      const map = this.fields.get(zone).map;
      if (x < 1 || x > map.width - 2 || y < 1 || y > map.height - 2) return true;
      const tileX = Math.floor(x);
      const tileY = Math.floor(y);
      if (tileX >= 0 && tileX < map.width && tileY >= 0 && tileY < map.height) {
        const tile = map.tiles[tileY][tileX];
        if (map.blockingTiles.includes(tile)) return true;
      }
      for (const obs of map.obstacles) {
        if (!obs.collidable) continue;
        const obsRadius = obs.radius || 0.65;
        if (Math.hypot(obs.x - x, obs.y - y) < (radius + obsRadius)) return true;
      }
    } else {
      // Dungeon collision
      const ctxInst = this.ctxInstanceId && this.dungeonInstances.get(this.ctxInstanceId);
      const dungeon = ctxInst ? ctxInst.dungeon : this.dungeon;
      if (x < 1 || x > dungeon.width - 2 || y < 1 || y > dungeon.height - 2) return true;

      // Check perimeter circle points with radius (prevents wall clipping)
      const r = Math.max(0.2, radius);
      const points = [
        { dx: 0, dy: 0 },
        { dx: -r, dy: 0 },
        { dx: r, dy: 0 },
        { dx: 0, dy: -r },
        { dx: 0, dy: r },
        { dx: -r * 0.7, dy: -r * 0.7 },
        { dx: r * 0.7, dy: -r * 0.7 },
        { dx: -r * 0.7, dy: r * 0.7 },
        { dx: r * 0.7, dy: r * 0.7 }
      ];

      for (const pt of points) {
        const tx = Math.floor(x + pt.dx);
        const ty = Math.floor(y + pt.dy);
        if (tx < 0 || tx >= dungeon.width || ty < 0 || ty >= dungeon.height) return true;
        const tile = dungeon.tiles[ty][tx];
        // 7 = WALL, 8 = VOID, plus deep liquids and star pits
        if (tile === 7 || tile === 8 || BLOCKING_FEATURES.has(tile)) return true;
      }

      for (const obs of dungeon.obstacles) {
        if (!obs.collidable) continue;
        if (Math.hypot(obs.x - x, obs.y - y) < (radius + 0.6)) return true;
      }
    }
    return false;
  }

  distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  addPlayer(socket, data) {
    const defaultClasses = {
      warrior: { maxHp: 180, maxMp: 50, dmg: 22, def: 8, speed: 4.8, attackRange: 1.6, attackSpeed: 1.0, swipe: 40, skillName: 'Whirlwind' },
      mage: { maxHp: 95, maxMp: 130, dmg: 32, def: 3, speed: 4.4, attackRange: 5.5, attackSpeed: 0.95, swipe: 15, skillName: 'Firestorm' },
      rogue: { maxHp: 125, maxMp: 70, dmg: 26, def: 5, speed: 5.4, attackRange: 1.8, attackSpeed: 1.30, swipe: 25, skillName: 'Shadow Strike' }
    };

    let savedChar = null;
    const accountUsername = accountManager.usernameForToken(data && data.token);
    const accountSlot = Math.max(0, parseInt(data && data.slot, 10) || 0);
    if (accountUsername) {
      savedChar = accountManager.getCharacter(accountUsername, accountSlot);
      if (!savedChar) {
        socket.emit('character_list_response', { success: false, message: 'Character not found.' });
        return;
      }
      // The same character can only be in the world once (reconnects replace the old session)
      for (const other of this.players.values()) {
        if (other.accountUsername === accountUsername && other.accountSlot === accountSlot && other.id !== socket.id) {
          const oldSocket = this.io.sockets.sockets.get(other.id);
          this.removePlayer(other.id);
          if (oldSocket) oldSocket.disconnect(true);
        }
      }
    }

    const chosenClass = savedChar ? (savedChar.characterClass || 'warrior') : (defaultClasses[data.characterClass] ? data.characterClass : 'warrior');
    const classStats = defaultClasses[chosenClass];

    const spawnX = 20 + (Math.random() - 0.5) * 2;
    const spawnY = 23 + (Math.random() - 0.5) * 1.5; // Spawn in open south plaza, away from fountain

    const player = {
      id: socket.id,
      accountUsername: accountUsername || null,
      accountSlot,
      role: accountManager.roleFor(accountUsername),
      name: savedChar ? savedChar.name : ((data.name || 'Hero').substring(0, 15).trim() || 'Hero'),
      characterClass: chosenClass,
      zone: 'town', // 'town', 'frostfell', or 'dungeon'
      x: spawnX,
      y: spawnY,
      targetX: null,
      targetY: null,
      moveDir: { dx: 0, dy: 0 },
      facing: 'SE',
      isMoving: false,
      level: savedChar ? (savedChar.level || 1) : 1,
      exp: savedChar ? (savedChar.exp || 0) : 0,
      expNext: expToNext(savedChar ? (savedChar.level || 1) : 1),
      skillPoints: savedChar ? (savedChar.skillPoints !== undefined ? savedChar.skillPoints : 1) : 1,
      jobLevel: savedChar ? (savedChar.jobLevel || 1) : 1,
      spLoadouts: (savedChar && savedChar.spLoadouts) || {},
      // (links saved by the older slot-to-slot version are dropped)
      skillLinks: Object.fromEntries(Object.entries((savedChar && savedChar.skillLinks) || {}).filter(([, id]) => ALL_CLASS_SKILLS[id as string])),
      jobExp: savedChar ? (savedChar.jobExp || 0) : 0,
      jobExpNext: SP.jobExpToNext(savedChar ? (savedChar.jobLevel || 1) : 1),
      spTransformed: false,
      spCooldown: 0,
      skills: savedChar ? (savedChar.skills || {}) : {}, // { [skillId]: rank }
      baseStats: {
        maxHp: classStats.maxHp,
        maxMp: classStats.maxMp,
        dmg: classStats.dmg,
        def: classStats.def,
        speed: classStats.speed,
        attackRange: classStats.attackRange,
        attackSpeed: classStats.attackSpeed,
        swipe: classStats.swipe
      },
      attackSpeed: classStats.attackSpeed,
      swipe: classStats.swipe,
      equipment: savedChar && savedChar.equipment ? savedChar.equipment : {
        weapon: null,
        armor: null,
        helmet: null,
        boots: null,
        ring: null
      },
      hp: classStats.maxHp,
      maxHp: classStats.maxHp,
      mp: classStats.maxMp,
      maxMp: classStats.maxMp,
      dmg: classStats.dmg,
      def: classStats.def,
      speed: classStats.speed,
      attackRange: classStats.attackRange,
      gold: savedChar && savedChar.gold !== undefined ? savedChar.gold : 50,
      inventory: savedChar && savedChar.inventory ? savedChar.inventory : {
        healthPotions: 3,
        manaPotions: 2,
        kills: 0,
        items: [
          { ...ITEMS.ancient_ruby, count: 1 },
          { ...ITEMS.revival_stone, count: 1 }
        ]
      },
      attackCooldown: 0,
      skillCooldown: 0,
      equippedSkills: savedChar && savedChar.equippedSkills ? savedChar.equippedSkills : JSON.parse(JSON.stringify(DEFAULT_EQUIPPED_SKILLS[chosenClass] || DEFAULT_EQUIPPED_SKILLS.warrior)),
      skillCooldowns: {
        slot1: 0,
        slot2: 0,
        slot3: 0,
        dash: 0,
        skill1: 0,
        skill2: 0
      },
      sprintTimer: 0,
      portalCooldown: 0,
      isAttacking: false,
      speechBubble: null,
      speechTimer: 0,
      isDead: false,
      respawnTimer: 0,
      statusEffects: [],
      speedFactor: 1.0,
      shieldHp: 0,
      berserkTimer: 0,
      ironFortressTimer: 0,
      smokeScreenTimer: 0
    };

    if (!savedChar) {
      // Equip starter gear tailored to chosen class
      if (chosenClass === 'warrior') {
        player.equipment.weapon = { ...ITEMS.iron_blade, count: 1 };
        player.equipment.helmet = { ...ITEMS.iron_helm, count: 1 };
      } else if (chosenClass === 'mage') {
        player.equipment.weapon = { ...ITEMS.archmage_staff, count: 1 };
        player.equipment.armor = { ...ITEMS.mystic_robe, count: 1 };
      } else if (chosenClass === 'rogue') {
        player.equipment.weapon = { ...ITEMS.shadow_daggers, count: 1 };
        player.equipment.armor = { ...ITEMS.leather_tunic, count: 1 };
      }
      if (player.accountUsername) {
        accountManager.saveCharacter(player.accountUsername, player, player.accountSlot || 0);
      }
    }

    // Weapons became class-locked; tag older saved items and move a wrong-class weapon back to the bag
    for (const it of [...player.inventory.items, ...Object.values(player.equipment)]) {
      const c = it && it.type === 'sp_card' ? (SP.CARD_BY_ID[it.cardId] || {}).cls : requiredClass(it);
      if (c) it.cls = c;
    }
    const heldWeapon = player.equipment.weapon;
    const heldCls = requiredClass(heldWeapon);
    if (heldCls && heldCls !== player.characterClass) {
      player.inventory.items.push({ ...heldWeapon, count: 1 });
      player.equipment.weapon = null;
    }

    // SP cards from before the +100 scale: keep their strength (+N -> +N*10)
    SP.upgradeCardScale(player.equipment.sp);
    for (const it of player.inventory.items || []) SP.upgradeCardScale(it);

    this.recalculatePlayerStats(player);

    this.players.set(socket.id, player);

    // Initial world state for this client
    socket.emit('init_game', {
      playerId: socket.id,
      zone: 'town',
      map: this.townMap,
      player,
      players: Array.from(this.players.values()).filter(p => p.zone === 'town'),
      mobs: Array.from(this.townMobs.values()),
      groundItems: Array.from(this.townGroundItems.values()),
      shopItems: Object.values(ITEMS).filter(it => it.type === 'consumable' && it.buyPrice),
      skillTrees: SKILL_TREES,
      allSkills: ALL_CLASS_SKILLS,
      allSkillsCatalog: CLASS_SKILLS_CATALOG,
      skillRunes: SKILL_RUNES,
      spCatalog: SP.clientCatalog(),
      weaponAbilities: Object.fromEntries(Object.values(WEAPON_ABILITIES).map(a => [a.id, { id: a.id, name: a.name, desc: a.desc, mpCost: a.mpCost, cooldown: a.cooldown, isDash: a.isDash, shape: a.shape, element: a.element, color: a.color }])),
      enhanceRules: { max: ENHANCE_MAX, safeLevel: ENHANCE_SAFE_LEVEL, base: ENHANCE_BASE_COST, growth: ENHANCE_COST_GROWTH, chance: ENHANCE_CHANCE }
    });

    socket.broadcast.emit('player_joined', player);
    this.broadcastSystemMessage(`⚔️ [${player.name} the ${player.characterClass.toUpperCase()}] entered the realm!`);
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      if (player.accountUsername) {
        accountManager.saveCharacter(player.accountUsername, player, player.accountSlot || 0);
      }
      this.removePlayerFromParty(socketId);
      if (player.spTransformed) this.setTransformed(player, false);
      // Disconnecting mid-run forfeits the escrowed chest loot
      player.dungeonRun = null;
      this.players.delete(socketId);
      if (player.dungeonInstanceId) {
        this.cleanupDungeonInstanceIfEmpty(player.dungeonInstanceId);
      }
      this.io.emit('player_left', socketId);
      this.broadcastSystemMessage(`🚪 [${player.name}] has departed.`);
    }
  }

  // Handle using Revival Stone (หินชุบชีวิต); superStone picks the Super Revival Stone
  handleUseRevivalStone(socketId, superStone = false) {
    const player = this.players.get(socketId);
    if (!player || !player.isDead) return;

    const stoneId = superStone ? 'super_revival_stone' : 'revival_stone';
    const stoneIdx = player.inventory && player.inventory.items ? player.inventory.items.findIndex(it => it.id === stoneId) : -1;
    if (stoneIdx === -1) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: '⚠️ ไม่มีหินชุบชีวิตในกระเป๋า!',
          color: '#ef4444'
        });
      }
      return;
    }

    // Check dungeon run revival quota (limit 10 per run)
    if (player.zone === 'dungeon') {
      if (!player.dungeonRun) {
        player.dungeonRun = { revivalsUsed: 0, maxRevivals: 10 };
      }
      const used = player.dungeonRun.revivalsUsed || 0;
      const maxRev = player.dungeonRun.maxRevivals || 10;
      if (used >= maxRev) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('floating_text', {
            x: player.x,
            y: player.y - 0.7,
            text: `⚠️ ใช้หินชุบในดันเจี้ยนครบโควต้าแล้ว (${used}/${maxRev} ก้อน)!`,
            color: '#ef4444',
            size: 18
          });
          socket.emit('chat_message', {
            sender: 'System',
            text: `⚠️ ไม่สามารถชุบชีวิตได้: โควต้าหินชุบชีวิตในดันเจี้ยนจำกัดไม่เกิน ${maxRev} ก้อนต่อรอบ (ใช้ครบ ${used}/${maxRev} แล้ว)`,
            color: '#ef4444'
          });
        }
        return;
      }
      player.dungeonRun.revivalsUsed = used + 1;
      this.emitDungeonRunUpdate(player);
    }

    // Deduct 1 stone
    const stoneItem = player.inventory.items[stoneIdx];
    if (stoneItem.count > 1) {
      stoneItem.count--;
    } else {
      player.inventory.items.splice(stoneIdx, 1);
    }

    // Revive on the spot with the stone's share of HP & MP (30% normal, 100% super)
    const share = (ITEMS[stoneId] && ITEMS[stoneId].reviveShare) || 0.3;
    player.isDead = false;
    player.respawnTimer = 0;
    player.hp = Math.max(1, Math.round(player.maxHp * share));
    player.mp = Math.round(player.maxMp * share);

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_respawned', { playerId: player.id, x: player.x, y: player.y, onSpot: true });
      socket.emit('player_updated', player);
      const revMsg = player.zone === 'dungeon'
        ? `✨ ชุบชีวิตสำเร็จ! (หินชุบในดัน: ${player.dungeonRun.revivalsUsed}/${player.dungeonRun.maxRevivals || 10})`
        : `✨ ชุบชีวิตสำเร็จ! (${superStone ? 'Super Revival Stone' : 'Revival Stone'} - ${Math.round(share * 100)}% HP)`;
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.9,
        text: revMsg,
        color: '#facc15',
        size: 20
      });
    }

    this.emitZone(player.zone, 'skill_fx', {
      type: 'holy_resurrection',
      x: player.x,
      y: player.y,
      radius: 2.5,
      playerId: player.id
    });
    this.broadcastSystemMessage(`🌟 [${player.name}] ได้ใช้หินชุบชีวิต ฟื้นคืนชีพขึ้นมา ณ จุดเดิม!`);
    this.savePlayerAccount(socketId);
  }

  handlePlayerInput(socketId, input) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    if (input.type === 'click_move') {
      let maxX = MAP_WIDTH - 2;
      let maxY = MAP_HEIGHT - 2;
      const playerInst = this.getPlayerDungeonInstance(player);
      const playerDungeon = playerInst ? playerInst.dungeon : this.dungeon;
      if (player.zone === 'dungeon' && playerDungeon) {
        maxX = playerDungeon.width - 2;
        maxY = playerDungeon.height - 2;
      } else if (this.fields.has(player.zone)) {
        const fieldMap = this.fields.get(player.zone).map;
        maxX = fieldMap.width - 2;
        maxY = fieldMap.height - 2;
      }
      player.targetX = Math.max(1, Math.min(maxX, input.x));
      player.targetY = Math.max(1, Math.min(maxY, input.y));
      player.moveDir = { dx: 0, dy: 0 };
    } else if (input.type === 'wasd_move') {
      player.moveDir = { dx: input.dx || 0, dy: input.dy || 0 };
      player.targetX = null;
      player.targetY = null;
    } else if (input.type === 'stop_move') {
      player.targetX = null;
      player.targetY = null;
      player.moveDir = { dx: 0, dy: 0 };
      player.isMoving = false;
    }
  }

  // Portals no longer fire by walking onto them: the client shows a button
  // near one and sends 'use_portal' (handleUsePortal)
  handleUsePortal(socketId) {
    const player = this.players.get(socketId);
    const socket = this.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead) return;
    this.checkPortalAndInteractions(player, socket);
  }

  checkPortalAndInteractions(player, socket) {
    if (player.portalCooldown > 0) return;

    if (player.zone === 'town') {
      for (const obs of this.townMap.obstacles) {
        if (Math.hypot(player.x - obs.x, player.y - obs.y) >= PORTAL_USE_RANGE) continue;
        // Abyssal Dungeon Portal on the plaza
        if (obs.id === 'portal_dungeon') {
          player.portalCooldown = 2.0;
          socket.emit('open_dungeon_portal_modal');
          return;
        }
        // North city gate out to the first field zone
        if (obs.type === 'field_portal') {
          this.teleportPlayerToField(player, socket, obs.target, obs.arrive);
          return;
        }
      }
    } else if (this.fields.has(player.zone)) {
      // Field zone portals: back to the previous zone / on to the next one
      const map = this.fields.get(player.zone).map;
      for (const obs of map.obstacles) {
        if (obs.type !== 'field_portal') continue;
        if (Math.hypot(player.x - obs.x, player.y - obs.y) >= PORTAL_USE_RANGE) continue;
        if (obs.target === 'town') this.teleportPlayerToTown(player, socket, this.townMap.arrivals && this.townMap.arrivals[obs.arrive]);
        else this.teleportPlayerToField(player, socket, obs.target, obs.arrive);
        return;
      }
    }
  }

  handleEnterDungeon(socketId: any, options: any = {}) {
    const player = this.players.get(socketId);
    if (!player || player.zone !== 'town' || player.isDead) return;
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return;

    // Party members join the dungeon their party already has open
    const partyInst = player.partyId ? this.dungeonInstances.get(`party_${player.partyId}`) : null;
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

    const inst = this.getOrCreateDungeonInstance(player, floor, difficulty);
    if (partyInst) {
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `⚔️ Joining your party in B${inst.floor}!`, color: '#4ade80' });
    }
    player.dungeonInstanceId = inst.id;
    player.dungeonRun = this.newDungeonRun(inst);
    this.teleportPlayerToDungeon(player, socket, inst);
    this.emitDungeonRunUpdate(player, socket);
    if (options.inviteParty) this.handlePartySummon(socketId);
  }

  handleLeaveDungeon(socketId) {
    const player = this.players.get(socketId);
    if (!player || player.zone !== 'dungeon' || player.isDead) return;
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return;

    const inst = this.getPlayerDungeonInstance(player);
    const dung = inst ? inst.dungeon : this.dungeon;
    const mobsMap = inst ? inst.mobs : this.dungeonMobs;

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
      this.cleanupDungeonInstanceIfEmpty(prevInstanceId);
    }
    this.teleportPlayerToTown(player, socket);
  }

  teleportPlayerToDungeon(player, socket, inst = null, at = null) {
    if (!inst) {
      inst = this.getPlayerDungeonInstance(player) || this.getOrCreateDungeonInstance(player);
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
        players: Array.from(this.players.values()).filter(p => p.zone === 'dungeon' && p.dungeonInstanceId === inst.id),
        // big floors hold thousands of mobs: send the living ones in view (game_tick adds the rest as they come into view)
        mobs: (Array.from(inst.mobs.values()) as any[]).filter(m => m.state !== 'dead' && (m.isBoss || mobInView(m, player))),
        groundItems: Array.from(inst.groundItems.values()),
        chests: inst.chests
      });
    }

    const floorConfig = DUNGEON_FLOORS[inst.floor - 1] || { name: `Floor ${inst.floor}` };
    const diffName = (DIFFICULTIES[inst.difficulty] && DIFFICULTIES[inst.difficulty].name) || inst.difficulty;
    this.broadcastSystemMessage(`🌀 [${player.name}] entered ${floorConfig.name} (B${inst.floor} - ${diffName})!`);
  }

  // Move a player into a field zone, arriving at its south (from the previous
  // zone) or north (coming back from the next zone) portal.
  teleportPlayerToField(player, socket, zoneId, arrive = 'south', at = null) {
    const field = this.fields.get(zoneId);
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
      players: Array.from(this.players.values()).filter(p => p.zone === zoneId),
      mobs: Array.from(field.mobs.values()),
      groundItems: Array.from(field.groundItems.values()),
      raid: this.raidInfo(zoneId)
    });

    this.broadcastSystemMessage(`🧭 [${player.name}] ventured into ${zone.name} (Lv. ${zone.minLevel}-${zone.maxLevel})!`);
  }

  teleportPlayerToFrostfell(player, socket) {
    this.teleportPlayerToField(player, socket, 'frostfell', 'south');
  }

  teleportPlayerToTown(player, socket, at = null) {
    if (player.zone === 'dungeon') {
      const prevInstId = player.dungeonInstanceId;
      player.dungeonInstanceId = null;
      if (prevInstId) this.cleanupDungeonInstanceIfEmpty(prevInstId);
      this.endDungeonRun(player, socket);
    }
    player.portalCooldown = 4.0; // 4 second cooldown prevents bounce-back
    player.zone = 'town';
    player.x = at ? at.x : 21.0;
    player.y = at ? at.y : 19.0;
    player.targetX = null;
    player.targetY = null;

    socket.emit('zone_change', {
      zone: 'town',
      map: this.townMap,
      player,
      players: Array.from(this.players.values()).filter(p => p.zone === 'town'),
      mobs: Array.from(this.townMobs.values()),
      groundItems: Array.from(this.townGroundItems.values())
    });

    this.broadcastSystemMessage(`🏰 [${player.name}] returned safely to town.`);
  }

  handleAllocateSkillPoint(socketId, skillId) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;
    if (!player.skillPoints || player.skillPoints <= 0) return;
    if (!player.skills) player.skills = {};

    const tree = SKILL_TREES[player.characterClass] || [];
    const talent = tree.find(t => t.id === skillId);
    if (!talent) return;

    const curRank = player.skills[skillId] || 0;
    if (curRank >= talent.maxRank) return;

    // Specialization lock: once points are spent in a branch, the other
    // branches stay closed until the talents are reset.
    const committedBranches = new Set(tree.filter(t => (player.skills[t.id] || 0) > 0).map(t => t.branch));
    if (committedBranches.size > 0 && !committedBranches.has(talent.branch)) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: '⚠️ Locked to your chosen specialization! Reset talents to switch.',
          color: '#ef4444'
        });
        // Resync the client in case it optimistically added the point
        socket.emit('skill_tree_updated', { skillPoints: player.skillPoints, skills: player.skills });
      }
      return;
    }

    if (talent.requires) {
      const prereqRank = player.skills[talent.requires] || 0;
      if (prereqRank < 1) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('floating_text', {
            x: player.x,
            y: player.y - 0.7,
            text: '⚠️ Requires prerequisite talent!',
            color: '#ef4444'
          });
        }
        return;
      }
    }

    player.skillPoints--;
    player.skills[skillId] = curRank + 1;
    this.recalculatePlayerStats(player);

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('skill_tree_updated', {
        skillPoints: player.skillPoints,
        skills: player.skills
      });
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: `✨ Learned [${talent.name}] (Rank ${player.skills[skillId]}/${talent.maxRank})`,
        color: '#facc15'
      });
    }

    this.broadcastSystemMessage(`🌳 [${player.name}] upgraded talent [${talent.name}]!`);
  }

  handleResetSkillPoints(socketId) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;
    if (!player.skills) return;

    let pointsSpent = 0;
    for (const rank of Object.values(player.skills)) {
      pointsSpent += Number(rank || 0);
    }
    if (pointsSpent === 0) return;

    const resetCost = Math.min(500, pointsSpent * 50);
    const socket = this.io.sockets.sockets.get(socketId);

    if (player.gold < resetCost) {
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: `⚠️ Need ${resetCost} Gold to respec talents!`,
          color: '#ef4444'
        });
      }
      return;
    }

    player.gold -= resetCost;
    player.skillPoints = (player.skillPoints || 0) + pointsSpent;
    player.skills = {};
    this.recalculatePlayerStats(player);

    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('skill_tree_updated', {
        skillPoints: player.skillPoints,
        skills: player.skills
      });
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: `🔄 Talents Reset! Restored ${pointsSpent} points (-${resetCost} Gold)`,
        color: '#38bdf8'
      });
    }

    this.broadcastSystemMessage(`🔄 [${player.name}] redistributed their talent points.`);
  }

  // Handle Opening Treasure Chests in Dungeon
  handleOpenChest(socketId, chestId) {
    const player = this.players.get(socketId);
    if (!player || player.zone !== 'dungeon' || player.isDead) return;

    const inst = this.getPlayerDungeonInstance(player);
    const chests = inst ? inst.chests : this.dungeon.chests;
    const chestFloor = inst ? inst.floor : this.dungeonFloor;
    const chestDifficulty = inst ? inst.difficulty : this.dungeonDifficulty;
    const chest = chests.find(c => c.id === chestId);
    // Every party member loots each chest once for themselves
    if (!chest) return;
    if (!chest.openedBy) chest.openedBy = [];
    if (chest.openedBy.includes(player.id)) return;

    const dist = Math.hypot(chest.x - player.x, chest.y - player.y);
    if (dist <= 2.5) {
      chest.openedBy.push(player.id);
      const loot = rollDungeonLoot(chest.isGold, chestFloor, player.characterClass);
      const socket = this.io.sockets.sockets.get(socketId);

      // Chest loot is only secured once the dungeon is cleared: until the boss
      // falls it is held in the run's loot bag (see endDungeonRun).
      if (!player.dungeonRun) {
        player.dungeonRun = inst ? this.newDungeonRun(inst) : { floor: chestFloor, difficulty: chestDifficulty, cleared: false, gold: 0, items: [], startedAt: Date.now(), deaths: 0, kills: 0, exp: 0 };
      }
      const run = player.dungeonRun;
      loot.forEach((it) => {
        if (run.cleared) {
          this.giveLootToPlayer(player, it);
        } else if (it.type === 'gold') {
          run.gold += it.amount;
        } else {
          run.items.push(it);
        }
      });
      if (run.cleared && socket) socket.emit('player_updated', player);
      this.emitDungeonRunUpdate(player, socket);

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

  handlePlayerAttack(socketId, targetInfo) {
    const player = this.players.get(socketId);
    if (!player || player.isDead || player.attackCooldown > 0) return;

    const atkSpeed = Math.max(0.4, player.attackSpeed || 1.0);
    player.attackCooldown = Math.max(0.12, 0.55 / atkSpeed);
    player.isAttacking = true;

    const mobsMap = this.getMobsMap(player.zone);

    let targetMob = null;
    if (targetInfo && targetInfo.targetType === 'mob') {
      const mob = mobsMap.get(targetInfo.targetId);
      if (mob && mob.state !== 'dead') {
        targetMob = mob;
      }
    }

    if (targetMob) {
      player.facing = this.calculateFacing(player.x, player.y, targetMob.x, targetMob.y);
    } else if (targetInfo && targetInfo.worldX !== undefined) {
      player.facing = this.calculateFacing(player.x, player.y, targetInfo.worldX, targetInfo.worldY);
    }

    const critChance = 0.15 + (player.critChanceBonus || 0);
    let isCrit = Math.random() < critChance;
    if (player.smokeScreenTimer > 0) {
      isCrit = true;
      player.smokeScreenTimer = 0;
      this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '💥 AMBUSH!', color: '#f59e0b', size: 20 });
    }

    let attackDmg = player.dmg;
    if (player.berserkTimer > 0) {
      attackDmg = Math.round(attackDmg * 1.35);
    }
    if (player.spTransformed && player.spCardId === 'sp_dread_lord') {
      const missingHp = Math.max(0, 1 - (player.hp / Math.max(1, player.maxHp)));
      attackDmg = Math.round(attackDmg * (1 + 0.5 * missingHp));
    }
    if (player.bloodlust) attackDmg = Math.round(attackDmg * this.bloodRage(player));
    // melee hits below add up what they took, for the SP card passive leech
    let meleeDealt = 0;
    const strike = (mob, dmg, crit) => {
      const before = mob.hp;
      this.applyDamageToMob(player, mob, dmg, crit);
      meleeDealt += Math.max(0, before - Math.max(0, mob.hp));
    };

    let hasSweepTriggered = false;

    if (player.characterClass === 'mage') {
      // Mage Ranged Projectiles
      if (targetMob) {
        const dist = Math.hypot(targetMob.x - player.x, targetMob.y - player.y);
        if (dist <= player.attackRange + 1.0) {
          this.spawnProjectile(player, targetMob.x, targetMob.y, targetMob.id, 'mob', attackDmg, { splash: MAGE_SPLASH_SHARE, crit: isCrit });
        }
      } else if (targetInfo && targetInfo.worldX !== undefined && targetInfo.worldY !== undefined) {
        this.spawnProjectile(player, targetInfo.worldX, targetInfo.worldY, null, 'point', attackDmg, { splash: MAGE_SPLASH_SHARE, crit: isCrit });
      } else {
        const facingVectors = {
          E: { x: 1, y: 0 }, SE: { x: 0.707, y: 0.707 }, S: { x: 0, y: 1 }, SW: { x: -0.707, y: 0.707 },
          W: { x: -1, y: 0 }, NW: { x: -0.707, y: -0.707 }, N: { x: 0, y: -1 }, NE: { x: 0.707, y: -0.707 }
        };
        const fv = facingVectors[player.facing] || { x: 1, y: 0 };
        this.spawnProjectile(player, player.x + fv.x * 6, player.y + fv.y * 6, null, 'point', attackDmg, { splash: MAGE_SPLASH_SHARE, crit: isCrit });
      }
    } else {
      // Melee basic attacks with Minecraft-style Sweeping Edge cleave!
      const hitMobs = new Set();
      let primaryHit = false;

      // 1. Primary target damage
      if (targetMob) {
        const dist = Math.hypot(targetMob.x - player.x, targetMob.y - player.y);
        if (dist <= player.attackRange + 1.1) {
          strike(targetMob, attackDmg, isCrit);
          hitMobs.add(targetMob.id);
          primaryHit = true;
          if (player.berserkTimer > 0) {
            const maxHeal = Math.max(2, Math.round(player.maxHp * 0.04));
            const lifesteal = Math.min(maxHeal, Math.max(1, Math.round(attackDmg * 0.04)));
            player.hp = Math.min(player.maxHp, player.hp + lifesteal);
          }
          this.chainBasicAttack(player, targetMob, attackDmg, mobsMap, strike);
        }
      }

      // 2. Sweeping Edge (Swipe) Cleave to surrounding enemies in front arc
      const swipePct = (player.swipe !== undefined ? player.swipe : 35);
      if (swipePct > 0) {
        hasSweepTriggered = true;
        const facingVectors = {
          E: { x: 0.707, y: -0.707 },
          SE: { x: 1.0, y: 0.0 },
          S: { x: 0.707, y: 0.707 },
          SW: { x: 0.0, y: 1.0 },
          W: { x: -0.707, y: 0.707 },
          NW: { x: -1.0, y: 0.0 },
          N: { x: -0.707, y: -0.707 },
          NE: { x: 0.0, y: -1.0 }
        };
        const fv = facingVectors[player.facing] || { x: 1.0, y: 0.0 };
        const sweepRange = (player.attackRange || 1.6) + 1.15;
        const swipeDmg = Math.max(1, Math.round(attackDmg * (swipePct / 100)));

        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead' || hitMobs.has(mob.id)) continue;
          const dx = mob.x - player.x;
          const dy = mob.y - player.y;
          const dist = Math.hypot(dx, dy);
          if (dist > sweepRange) continue;

          // Check angle in cone (±68 degrees, cos >= 0.38)
          const dot = dist > 0.001 ? (dx * fv.x + dy * fv.y) / dist : 1.0;
          if (dot >= 0.35) {
            hitMobs.add(mob.id);
            strike(mob, swipeDmg, false);
          }
        }
      }
      this.cardPassiveLeech(player, meleeDealt);
    }

    this.emitZone(player.zone, 'entity_attack_fx', {
      attackerId: player.id,
      attackerType: 'player',
      class: player.characterClass,
      cardId: player.spTransformed && player.equipment && player.equipment.sp ? player.equipment.sp.cardId : null,
      targetId: targetInfo ? targetInfo.targetId : null,
      x: player.x,
      y: player.y,
      facing: player.facing,
      targetX: targetMob ? targetMob.x : undefined,
      targetY: targetMob ? targetMob.y : undefined,
      hasSweep: hasSweepTriggered,
      attackSpeed: player.attackSpeed || 1.0,
      swipe: player.swipe || 0
    });
  }

  handleCustomizeSkill(socketId, data) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;
    if (data && data.link !== undefined) return this.setSkillLink(player, data.slot, data.link);
    if (player.spTransformed) return this.customizeSpSkill(player, data);

    if (!data || !data.slot) return;
    const validSlots = ['slot1', 'slot2', 'slot3', 'dash'];
    if (!validSlots.includes(data.slot)) return;

    if (!player.equippedSkills) {
      player.equippedSkills = JSON.parse(JSON.stringify(DEFAULT_EQUIPPED_SKILLS[player.characterClass] || DEFAULT_EQUIPPED_SKILLS.warrior));
    }
    if (!player.equippedSkills.runes) {
      player.equippedSkills.runes = { slot1: 'none', slot2: 'none', slot3: 'none', dash: 'none' };
    }

    if (data.skillId) {
      const skillDef = ALL_CLASS_SKILLS[data.skillId];
      if (skillDef && skillDef.class === player.characterClass) {
        if (skillDef.reqLevel && player.level < skillDef.reqLevel) {
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket) {
            socket.emit('floating_text', {
              x: player.x,
              y: player.y - 0.7,
              text: `🔒 Requires Level ${skillDef.reqLevel}!`,
              color: '#ef4444'
            });
          }
          return;
        }
        player.equippedSkills[data.slot] = data.skillId;
      }
    }

    if (data.rune !== undefined) {
      if (SKILL_RUNES[data.rune]) {
        player.equippedSkills.runes[data.slot] = data.rune;
      }
    }

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('custom_skills_updated', {
        equippedSkills: player.equippedSkills
      });
      const skillName = ALL_CLASS_SKILLS[player.equippedSkills[data.slot]] ? ALL_CLASS_SKILLS[player.equippedSkills[data.slot]].name : player.equippedSkills[data.slot];
      const slotKey = data.slot === 'slot1' ? 'Q' : data.slot === 'slot2' ? 'E' : data.slot === 'slot3' ? 'R' : 'Shift';
      const runeDef = SKILL_RUNES[player.equippedSkills.runes[data.slot]] || SKILL_RUNES.none;

      let noticeText = `⚡ Set [${skillName}] to [${slotKey}]!`;
      if (data.rune !== undefined) {
        noticeText = `🔮 Inscribed ${runeDef.icon} [${runeDef.name}] into [${slotKey}]!`;
      }

      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: noticeText,
        color: '#facc15'
      });
    }

    this.broadcastSystemMessage(`⚡ [${player.name}] customized their active ability loadout.`);
  }

  // Skill Link: a hotbar slot also casts one extra class skill, which doesn't
  // need a hotbar slot of its own. skillId 'none' unlinks.
  setSkillLink(player, slot, skillId) {
    const slots = ['slot1', 'slot2', 'slot3', 'dash'];
    if (!slots.includes(slot)) return;
    const socket = this.io.sockets.sockets.get(player.id);
    const say = (text, color = '#ef4444') => socket && socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text, color });
    const links = player.skillLinks = player.skillLinks || {};
    const key = { slot1: 'Q', slot2: 'E', slot3: 'R', dash: 'Shift' }[slot];
    if (skillId === 'none') {
      delete links[slot];
      say(`Unlinked [${key}]`, '#facc15');
    } else {
      const def = ALL_CLASS_SKILLS[skillId];
      const own = (player.baseEquippedSkills || player.equippedSkills || {})[slot];
      if (!def || def.class !== player.characterClass) return;
      if (def.reqLevel && player.level < def.reqLevel) return say(`Requires Level ${def.reqLevel}!`);
      if (skillId === own) return say('That skill is already in this slot');
      links[slot] = skillId;
      say(`[${key}] now also casts ${def.name}`, '#facc15');
    }
    if (socket) socket.emit('player_updated', player);
  }

  // The skill definition used for a slot; a transformed hero uses the card's
  // own SP skill, its damage scaled by the card's upgrade level.
  resolvePlayerSkill(player, slot, skillId) {
    // Right-click weapon ability: +5% damage per weapon upgrade level
    if (slot === 'weapon') {
      const weapon = player.equipment && player.equipment.weapon;
      const ability = weaponAbility(weapon);
      if (!ability) return null;
      return Object.assign({}, ability, { dmgMult: ability.dmgMult * (1 + 0.05 * (weapon.upgradeLevel || 0)) });
    }
    const base = ALL_CLASS_SKILLS[skillId] || DEFAULT_SKILL_FOR_SLOT(player, slot);
    const card = player.spTransformed && player.equipment && player.equipment.sp && SP.CARD_BY_ID[player.equipment.sp.cardId];
    const spSkill = card && card.arsenal.includes(skillId) && SP.SP_SKILLS[skillId];
    if (!spSkill) return base;
    const k = 1 + SP.SP_SKILL_PER_LEVEL * (player.equipment.sp.upgradeLevel || 0);
    return Object.assign({}, spSkill, { dmgMult: spSkill.dmgMult * k });
  }

  // Damage multiplier from Bloodlust (Berserker buff)
  bloodRage(player) {
    return player.bloodlust ? 1 + (player.bloodlust.rage || 0) : 1;
  }

  // SP card passive leech (Berserker Bloodthirst) on `dealt` damage; Bloodlust multiplies it
  cardPassiveLeech(player, dealt) {
    const card = player.spTransformed && player.equipment && player.equipment.sp && SP.CARD_BY_ID[player.equipment.sp.cardId];
    const passive = card && card.passive;
    if (!passive || !passive.leech || dealt <= 0) return;
    const thirst = player.bloodlust ? player.bloodlust.thirst || 1 : 1;
    const heal = Math.min(Math.round(player.maxHp * passive.cap * thirst), Math.max(1, Math.round(dealt * passive.leech * thirst)));
    player.hp = Math.min(player.maxHp, player.hp + heal);
    this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.6, text: `🩸 +${heal}`, color: '#f87171', size: 13 });
  }

  // Storm Herald Arc Conduit (a toggled chainAttack): a basic attack that lands
  // arcs on to the nearest enemies, each jump weaker; every swing costs MP and
  // the conduit fades when there is not enough
  chainBasicAttack(player, first, attackDmg, mobsMap, strike) {
    const toggle = (Object.values(player.spToggles || {}) as any[]).find(a => a.skill.chainAttack);
    if (!toggle) return;
    const sk = toggle.skill, C = sk.chainAttack;
    const cost = Math.round(C.mp * (player.manaCostMult || 1));
    if (player.mp < cost) {
      this.endSpToggle(player, sk.id, true);
      this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.8, text: '💧 OUT OF MANA - conduit fades', color: '#38bdf8', size: 16 });
      return;
    }
    player.mp -= cost;
    const visited = new Set([first]);
    const points = [{ x: first.x, y: first.y }];
    let cur = first, mult = 1;
    while (points.length < C.n) {
      let next = null, best = C.jump;
      for (const m of mobsMap.values()) {
        if (m.state === 'dead' || visited.has(m)) continue;
        const d = Math.hypot(m.x - cur.x, m.y - cur.y);
        if (d <= best) { best = d; next = m; }
      }
      if (!next) break;
      mult *= C.decay;
      visited.add(next);
      points.push({ x: next.x, y: next.y });
      strike(next, Math.max(1, Math.round(attackDmg * mult)), false);
      cur = next;
    }
    if (points.length > 1) {
      this.emitZone(player.zone, 'skill_fx', {
        type: 'sp_skill', shape: 'chain', quiet: true, x: player.x, y: player.y, startX: player.x, startY: player.y, points,
        element: sk.element, color: sk.color, cardId: sk.cardId, skillId: sk.id
      });
    }
  }

  endSpToggle(player, skillId, quiet = false) {
    const toggle = player.spToggles && player.spToggles[skillId];
    if (!toggle) return;
    delete player.spToggles[skillId];
    if (!quiet) this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.8, text: `${toggle.skill.name.toUpperCase()} OFF`, color: '#94a3b8' });
  }

  // Every frame: toggled SP skills pay their upkeep (HP `drain` - natural HP
  // regen is off meanwhile - or MP `mpDrain`) and strike everything within r
  // every `every` seconds. Out of blood or mana, the toggles paying it end.
  tickSpToggles(player, dt) {
    const loadout = Object.values(player.equippedSkills || {});
    for (const id of Object.keys(player.spToggles)) {
      if (!player.spTransformed || !loadout.includes(id)) this.endSpToggle(player, id);
    }
    const all: any[] = Object.values(player.spToggles);
    if (!all.length) return false;
    const sum = (k) => all.reduce((s, a) => s + (a.skill[k] || 0), 0);
    const hpDrain = sum('drain'), mpDrain = sum('mpDrain');
    if (!player.godMode) {
      player.hp = Math.max(1, player.hp - player.maxHp * hpDrain * dt);
      player.mp = Math.max(0, player.mp - player.maxMp * mpDrain * dt);
    }
    const say = (text) => this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.8, text, color: '#ef4444', size: 16 });
    if (hpDrain && player.hp <= player.maxHp * BLOOD_AURA_MIN_HP) {
      for (const a of all) if (a.skill.drain) this.endSpToggle(player, a.skill.id, true);
      say('🩸 OUT OF BLOOD - aura fades');
    }
    if (mpDrain && player.mp <= 0) {
      for (const a of all) if (a.skill.mpDrain) this.endSpToggle(player, a.skill.id, true);
      say('💧 OUT OF MANA - blades stop');
    }
    const mobsMap = this.getMobsMap(player.zone, player);
    const rage = this.bloodRage(player);
    const critChance = 0.15 + (player.critChanceBonus || 0);
    for (const a of (Object.values(player.spToggles) as any[])) {
      const sk = a.skill;
      if (!sk.r || !sk.dmgMult) continue;
      a.clock += dt;
      if (a.clock + 1e-6 < sk.every) continue;
      a.clock -= sk.every;
      const dmg = Math.max(1, Math.round(player.dmg * sk.dmgMult * rage * SKILL_DAMAGE_SCALE));
      let struck = 0, dealt = 0;
      let targets = [...mobsMap.values()].filter(m => m.state !== 'dead' && Math.hypot(m.x - player.x, m.y - player.y) <= sk.r);
      // skyStrike: a bolt from the sky on each of the nearest few instead of a ring
      if (sk.skyStrike) {
        targets = targets.sort((p1, p2) => Math.hypot(p1.x - player.x, p1.y - player.y) - Math.hypot(p2.x - player.x, p2.y - player.y)).slice(0, sk.skyStrike);
      }
      const bolts = sk.skyStrike ? targets.map(m => ({ x: m.x, y: m.y })) : null;
      for (const mob of targets) {
        if (sk.burn) { mob.burnTimer = Math.max(mob.burnTimer || 0, sk.burn); mob.burnDmg = Math.max(mob.burnDmg || 0, Math.round(player.dmg * 0.2)); }
        if (sk.chill) mob.chillTimer = Math.max(mob.chillTimer || 0, sk.chill);
        const before = mob.hp;
        this.applyDamageToMob(player, mob, dmg, Math.random() < critChance);
        dealt += Math.max(0, before - Math.max(0, mob.hp));
        struck++;
      }
      if (sk.spin) this.cardPassiveLeech(player, dealt);
      if (struck) {
        this.emitZone(player.zone, 'skill_fx', {
          type: 'sp_skill', shape: 'aura', pulse: true, spin: !!sk.spin, bolts, x: player.x, y: player.y, radius: sk.r,
          element: sk.element, color: sk.color, cardId: sk.cardId, skillId: sk.id
        });
      }
    }
    return hpDrain > 0;
  }

  // Buffs and debuffs on a hero, for the HUD tray: [{ k, n, i, t?, v?, d? }]
  // (k key, n name, i icon, t seconds left, v stacks / amount, d = debuff)
  heroBuffs(p) {
    const out = [];
    const timed = (k, n, i, t) => { if (t > 0) out.push({ k, n, i, t: Math.ceil(t) }); };
    for (const a of (Object.values(p.spToggles || {}) as any[])) out.push({ k: a.skill.id, n: a.skill.name, i: a.skill.icon || '✨' });
    if (p.bloodlust) timed('bloodlust', 'Bloodlust', '🔥', p.bloodlust.timer);
    timed('rage', 'Rage', '💢', p.berserkTimer);
    timed('fortress', 'Fortress', '🛡️', p.ironFortressTimer);
    timed('vanish', 'Vanish', '👤', p.smokeScreenTimer);
    timed('undying', 'Undying', '💀', p.undyingTimer);
    timed('haste', 'Haste', '💨', p.sprintTimer);
    if (p.shieldHp > 0) out.push({ k: 'shield', n: 'Shield', i: '🔰', v: Math.round(p.shieldHp) });
    if (p.flowStacks > 0) out.push({ k: 'flow', n: 'Flow', i: '🌊', v: p.flowStacks, t: Math.ceil(p.flowTimer || 0) });
    if (p.stormCharge > 0) out.push({ k: 'charge', n: 'Static Charge', i: '⚡', v: p.stormCharge, t: Math.ceil(p.stormChargeTimer || 0) });
    if (p.voidSouls > 0) out.push({ k: 'souls', n: 'Souls', i: '👻', v: p.voidSouls, t: Math.ceil(p.voidSoulTimer || 0) });
    const DEBUFFS = { poison: ['Poison', '☠️'], burn: ['Burn', '🔥'], chill: ['Chill', '❄️'] };
    for (const e of p.statusEffects || []) {
      const [n, i] = DEBUFFS[e.type] || [e.type, '⚠️'];
      out.push({ k: 'd_' + e.type, n, i, t: Math.ceil(e.duration), d: 1 });
    }
    return out;
  }

  // =================================================================
  // FIELD RAID / WORLD BOSS EVENTS
  // =================================================================
  updateRaidEvents() {
    const now = Date.now();
    for (const zoneId of Object.keys(RAID.RAID_BOSSES)) {
      const st = this.raidStates.get(zoneId);
      if (!st) {
        if (now >= (this.raidNextSpawn.get(zoneId) || 0)) this.spawnRaidBoss(zoneId);
        continue;
      }
      // the boss window expired without a kill: it retreats and the clock resets
      if (now >= st.despawnAt) {
        this.despawnRaidBoss(zoneId, 'timeup');
        continue;
      }
      if (now - st.lastBroadcast >= 4000) {
        st.lastBroadcast = now;
        this.broadcastRaidLeaderboard(zoneId, st);
      }
    }
  }

  spawnRaidBoss(zoneId) {
    const conf = RAID.RAID_BOSSES[zoneId];
    const field = this.fields.get(zoneId);
    if (!conf || !field || this.raidStates.has(zoneId)) return;
    const def = RAID.buildRaidMobDef(zoneId);
    if (!def) return;
    const id = `${zoneId}_raid_${this.nextEntityId++}`;
    const mob: any = {
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
    field.mobs.set(id, mob);
    const now = Date.now();
    this.raidStates.set(zoneId, {
      conf,
      def,
      mobId: id,
      damage: new Map(),
      despawnAt: now + (conf.windowMinutes || 15) * RAID.MINUTE,
      lastBroadcast: 0
    });
    this.broadcastSystemMessage(`☠️ RAID EVENT! [${def.name}] (Lv.${def.level}) has awakened in [${field.zone.name}]! It won't fall alone.`);
    this.emitZone(zoneId, 'raid_spawn', {
      zoneId,
      name: def.name,
      level: def.level,
      hp: mob.maxHp,
      maxHp: mob.maxHp,
      endsIn: (conf.windowMinutes || 15) * 60
    });
  }

  despawnRaidBoss(zoneId, why = 'timeup') {
    const st = this.raidStates.get(zoneId);
    if (!st) return;
    const field = this.fields.get(zoneId);
    if (field) field.mobs.delete(st.mobId);
    this.raidStates.delete(zoneId);
    const conf = RAID.RAID_BOSSES[zoneId];
    this.raidNextSpawn.set(zoneId, Date.now() + (conf ? conf.respawnMinutes : 25) * RAID.MINUTE);
    if (why === 'timeup') {
      this.broadcastSystemMessage(`💨 [${st.def.name}] senses the odds and retreats into the deep. It returns in ${conf ? conf.respawnMinutes : 25} minutes.`);
      this.emitZone(zoneId, 'raid_gone', { zoneId, reason: 'timeup' });
    }
  }

  recordRaidDamage(zoneId, playerId, amount) {
    const st = this.raidStates.get(zoneId);
    if (!st || !playerId || !(amount > 0)) return;
    st.damage.set(playerId, (st.damage.get(playerId) || 0) + amount);
  }

  // Live standings for the boss: online players sorted by damage dealt
  raidStandings(st) {
    const rows = [];
    for (const [pid, dmg] of st.damage) {
      const p = this.players.get(pid);
      if (!p || p.isDead) continue;
      rows.push({ id: pid, name: p.name, dmg: Math.round(dmg) });
    }
    rows.sort((a, b) => b.dmg - a.dmg);
    return rows;
  }

  broadcastRaidLeaderboard(zoneId, st) {
    const mob = this.fields.get(zoneId) && this.fields.get(zoneId).mobs.get(st.mobId);
    if (!mob || mob.state === 'dead') return;
    const standings = this.raidStandings(st);   // full board: clients resolve their own rank
    this.emitZone(zoneId, 'raid_leaderboard', {
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
  raidInfo(zoneId) {
    const st = this.raidStates.get(zoneId);
    if (!st) return { active: false };
    const field = this.fields.get(zoneId);
    const mob = field && field.mobs.get(st.mobId);
    if (!mob || mob.state === 'dead') return { active: false };
    const standings = this.raidStandings(st);   // full board: clients resolve their own rank
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

  onRaidBossDeath(mob, killerPlayer) {
    const zoneId = mob.fieldZone || (killerPlayer && killerPlayer.zone) || Object.keys(RAID.RAID_BOSSES)[0];
    const st = this.raidStates.get(zoneId);
    if (!st || !mob.isRaidBoss) return;
    const def = st.def;
    const standings = this.raidStandings(st);

    const podium = standings.slice(0, 5).map((r, i) => `${i + 1}. ${r.name} (${r.dmg.toLocaleString()})`).join('  ');
    this.broadcastSystemMessage(`🏆 RAID SLAYED! [${def.name}] has fallen! Damage: ${podium || 'no one recorded'}`);
    this.emitZone(zoneId, 'raid_gone', { zoneId, reason: 'kill' });
    this.emitZone(zoneId, 'mob_died', { mobId: mob.id, killerId: killerPlayer ? killerPlayer.id : null });

    let rank = 0;
    const total = standings.length;
    for (const row of standings) {
      rank++;
      const p = this.players.get(row.id);
      if (!p) continue;
      this.payRaidReward(p, def, RAID.raidBucketFor(rank), rank, total);
    }
    this.despawnRaidBoss(zoneId, 'kill');
  }

  payRaidReward(player, def, bucket, rank, total) {
    const gold = Math.max(1, Math.round(def.gold * bucket.gold * (0.85 + Math.random() * 0.3)));
    this.giveLootToPlayer(player, { type: 'gold', amount: gold }, false);

    const exp = Math.max(1, Math.round(def.exp * bucket.exp * (0.9 + Math.random() * 0.2)));
    this.awardExp(player, exp);
    this.awardJobExp(player, exp);

    const [fmin, fmax] = bucket.frag;
    const frags = fmin + Math.floor(Math.random() * (fmax - fmin + 1));
    if (frags > 0) this.giveLootToPlayer(player, { type: 'item', itemId: 'spirit_fragment', amount: frags }, false);

    // gear roll (top ranks roll guaranteed, boss-quality gear)
    if (Math.random() < bucket.gear) {
      const cls = player.characterClass;
      let gear = generateRandomizedGear(pickGearForLevel(def.level, { boss: bucket.gearBoss, cls }), def.level, bucket.gearBoss);
      const reforge = (bucket.mythic || Math.random() < 0.5) ? rollSkyblockReforge(gear) : null;
      if (reforge) gear = applySkyblockReforge(gear, reforge);
      this.giveLootToPlayer(player, { type: 'item', itemId: gear.id, customItemData: gear, amount: 1 }, false);
    }

    // SP-card roll from the boss's card tier pool
    if (Math.random() < bucket.card) {
      const pool = (SP.SP_CARDS[player.characterClass] || []).filter(c => c.tier === (def.cardTier || 1));
      const chosen = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      if (chosen) {
        const cardItem = SP.makeCardItem(chosen.id);
        if (cardItem) {
          this.giveLootToPlayer(player, { type: 'item', itemId: 'sp_card', customItemData: { ...cardItem, custom: true }, amount: 1 }, false);
          this.broadcastSystemMessage(`🃏 [${player.name}] pulled an SP Card [${chosen.name}] from the raid bounty!`);
        }
      }
    }

    const socket = this.io.sockets.sockets.get(player.id);
    if (socket) {
      socket.emit('raid_reward', { rank, total, label: bucket.label, gold, exp, fragments: frags, bossName: def.name });
      socket.emit('player_updated', player);
    }
  }

  // Run a card skill from its SP_SKILLS data (see the shape list in spCards.js)
  castSpSkill(player, skill, ctx) {
    const { slot, cooldown, runeId, skillData, mobsMap, applySkillDamage, computeDashVector, isEcho, isShadow, recall } = ctx;
    const zone = player.zone;
    const instanceId = player.dungeonInstanceId || null;
    // a Nightblade shadow casts from where it stands
    const px = ctx.origin ? ctx.origin.x : player.x, py = ctx.origin ? ctx.origin.y : player.y;
    const fxBase = { type: 'sp_skill', shape: skill.spShape, element: skill.element, color: skill.color, cardId: skill.cardId, rune: runeId, skillId: skill.id, name: skill.name };
    const emit = (data, first) => this.emitZone(zone, 'skill_fx', first && !isEcho && !isShadow
      ? { ...fxBase, ...data, skillSlot: slot, cooldown, playerId: player.id }
      : { ...fxBase, ...data });
    const alive = () => [...mobsMap.values()].filter(m => m.state !== 'dead');
    const within = (cx, cy, r) => alive().filter(m => Math.hypot(m.x - cx, m.y - cy) <= r);
    const nearest = (cx: number, cy: number, r: number, exclude: any = null) => {
      let best = null, bestD = r;
      for (const m of alive()) {
        if (exclude && exclude.has(m)) continue;
        const d = Math.hypot(m.x - cx, m.y - cy);
        if (d <= bestD) { best = m; bestD = d; }
      }
      return best;
    };

    let dealt = 0;
    const say = (x, y, text, color, size) => this.emitZone(zone, 'floating_text', { x, y: y - 0.8, text, color, size });
    // Tempest: Discharge spends every Static Charge for a bigger hit
    let dischargeMult = 1;
    if (skill.discharge && player.stormCharge > 0) {
      dischargeMult = 1 + skill.discharge * player.stormCharge;
      say(px, py, `⚡ DISCHARGE x${player.stormCharge}`, '#facc15', 17);
      player.stormCharge = 0;
    }
    const gainCharge = (n) => {
      player.stormCharge = Math.min(STORM_CHARGE_MAX, (player.stormCharge || 0) + n);
      player.stormChargeTimer = STORM_CHARGE_SECONDS;
    };
    // Soul harvesters (Void Archon, Duskblade): every Soul empowers its skills; Devour spends them
    const isSoulCard = skill.souls !== undefined || skill.devour !== undefined;
    const souls = isSoulCard ? (player.voidSouls || 0) : 0;
    let soulMult = 1 + VOID_SOUL_BONUS * souls;
    if (skill.devour && souls > 0) {
      soulMult *= 1 + 0.12 * souls;
      const heal = Math.round(player.maxHp * skill.devour * souls);
      player.hp = Math.min(player.maxHp, player.hp + heal);
      say(px, py, `🌑 DEVOUR x${souls} (+${heal} HP)`, '#c084fc', 17);
      player.voidSouls = 0;
    }
    const gainSouls = (n) => {
      player.voidSouls = Math.min(VOID_SOUL_MAX, (player.voidSouls || 0) + n);
      player.voidSoulTimer = VOID_SOUL_SECONDS;
    };
    let chargeHits = 0;
    const hit = (mob, mult = 1, fromX = px, fromY = py) => {
      if (!mob || mob.state === 'dead') return;
      let m = skill.dmgMult * mult * dischargeMult * soulMult;
      // Pyromancer: Combust detonates Scorch, Fire Chain feeds on it
      if (skill.combust && mob.scorchStacks > 0) {
        m *= 1 + skill.combust * mob.scorchStacks;
        say(mob.x, mob.y, `💥 COMBUST x${mob.scorchStacks}`, '#fb923c', 16);
        mob.scorchStacks = 0;
      }
      if (skill.scorchBonus && mob.scorchStacks > 0) m *= 1 + skill.scorchBonus * mob.scorchStacks;
      // Cryo Sage: Shatter a frozen enemy for big damage, which thaws it
      if (skill.shatterFrozen && mob.frozenTimer > 0 && mob.frozenKind === 'ice') {
        m *= skill.shatterFrozen;
        mob.frozenTimer = 0;
        say(mob.x, mob.y, '🧊 SHATTER!', '#a5f3fc', 17);
      }
      if (skill.backstab) {
        const isStealthed = player.smokeScreenTimer > 0;
        let isBack = isStealthed;
        if (!isBack && mob.facing) {
          const dx = mob.x - px, dy = mob.y - py;
          const facingVecs = { 'E': [1, 0], 'SE': [0.7, 0.7], 'S': [0, 1], 'SW': [-0.7, 0.7], 'W': [-1, 0], 'NW': [-0.7, -0.7], 'N': [0, -1], 'NE': [0.7, -0.7] };
          const fv = facingVecs[mob.facing] || [0, 1];
          if (dx * fv[0] + dy * fv[1] > 0.15) isBack = true;
        }
        if (isBack) {
          m *= 2.8;
          mob.shadowMarkTimer = 6.0;
          this.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.8, text: '🗡️ BACKSTAB CRIT!', color: '#c084fc', size: 18 });
        } else {
          mob.shadowMarkTimer = 4.0;
        }
      }
      if (skill.execute && mob.maxHp && mob.hp <= mob.maxHp * skill.execute[0]) m *= skill.execute[1];
      if (skill.furyBonus) {
        const missingHp = Math.max(0, 1 - (player.hp / Math.max(1, player.maxHp)));
        m *= 1 + skill.furyBonus * missingHp;
      }
      if (skill.shatter && mob.chillTimer > 0) m *= skill.shatter;
      const before = mob.hp;
      if (skill.burn) { mob.burnTimer = skill.burn; mob.burnDmg = Math.max(mob.burnDmg || 0, Math.round(player.dmg * 0.2)); }
      if (skill.chill) mob.chillTimer = Math.max(mob.chillTimer || 0, skill.chill);
      if (skill.poisonStacks) {
        mob.poisonStacks = Math.min(10, (mob.poisonStacks || 0) + skill.poisonStacks);
        mob.poisonTimer = Math.max(mob.poisonTimer || 0, skill.poison || 6.0);
        mob.poisonDmg = Math.max(mob.poisonDmg || 0, Math.round(player.dmg * 0.12 * mob.poisonStacks));
        this.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.6, text: `🧪 POISON x${mob.poisonStacks}`, color: '#4ade80' });
      } else if (skill.poison) {
        mob.poisonTimer = skill.poison;
        mob.poisonDmg = Math.max(mob.poisonDmg || 0, Math.round(player.dmg * 0.15));
      }
      if (skill.staticCharge) {
        mob.staticCharge = skill.staticCharge;
        this.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.6, text: '⚡ STATIC', color: '#facc15' });
      }
      applySkillDamage(mob, Math.round(player.dmg * m), true);
      dealt += Math.max(0, before - Math.max(0, mob.hp));
      const stillUp = mob.state !== 'dead' && mob.hp > 0;
      if (stillUp && skill.scorch) {
        mob.scorchStacks = Math.min(SCORCH_MAX, (mob.scorchStacks || 0) + skill.scorch);
        mob.scorchTimer = SCORCH_SECONDS;
      }
      if (stillUp && skill.frost && !(mob.frozenTimer > 0)) {
        mob.frostStacks = (mob.frostStacks || 0) + skill.frost;
        mob.frostTimer = FROST_SECONDS;
        mob.chillTimer = Math.max(mob.chillTimer || 0, 2);
        if (mob.frostStacks >= FROST_TO_FREEZE) {
          mob.frostStacks = 0;
          mob.frozenTimer = mob.isBoss ? BOSS_FREEZE_SECONDS : FREEZE_SECONDS;
          mob.frozenKind = 'ice';
          say(mob.x, mob.y, '❄️ FROZEN', '#67e8f9', 16);
        }
      }
      if (stillUp && skill.stasis) {
        mob.frozenTimer = Math.max(mob.frozenTimer || 0, mob.isBoss ? skill.stasis * 0.4 : skill.stasis);
        mob.frozenKind = 'time';
      }
      if (stillUp && skill.stun) mob.attackCooldown = Math.max(mob.attackCooldown || 0, skill.stun);
      if (skill.souls) gainSouls(skill.souls);
      else if (!stillUp && isSoulCard) gainSouls(1);
      if (skill.chargeHit && chargeHits < STORM_CHARGE_MAX) { chargeHits++; gainCharge(skill.chargeHit); }
      if (skill.knock && mob.state !== 'dead') {
        const d = Math.hypot(mob.x - fromX, mob.y - fromY) || 1;
        const kx = mob.x + ((mob.x - fromX) / d) * skill.knock;
        const ky = mob.y + ((mob.y - fromY) / d) * skill.knock;
        if (!this.isColliding(kx, ky, zone)) { mob.x = kx; mob.y = ky; }
      }
    };
    const settleLeech = () => {
      if (!skill.leech || dealt <= 0) return;
      const heal = Math.min(Math.round(player.maxHp * 0.1), Math.max(1, Math.round(dealt * skill.leech)));
      player.hp = Math.min(player.maxHp, player.hp + heal);
      this.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 0.6, text: `+${heal} HP`, color: '#4ade80' });
      dealt = 0;
    };
    // Later waves run on a timer; skip them if the hero left, died or changed instance
    const later = (seconds, fn) => setTimeout(() => {
      const p = this.players.get(player.id);
      if (!p || p !== player || p.isDead || p.zone !== zone || (p.dungeonInstanceId || null) !== instanceId) return;
      this.runAs(player.id, () => { fn(); settleLeech(); });
    }, seconds * 1000);

    // Aim: toward the target point (or the dash direction for movement skills)
    const rawTx = Number.isFinite(skillData.targetX) ? skillData.targetX : px;
    const rawTy = Number.isFinite(skillData.targetY) ? skillData.targetY : py;
    const td = Math.hypot(rawTx - px, rawTy - py);
    const dir = td > 0.3 && !skill.isDash
      ? { normX: (rawTx - px) / td, normY: (rawTy - py) / td }
      : computeDashVector();
    const range = skill.range || 7;
    const aimX = td > range ? px + dir.normX * range : (td > 0.3 ? rawTx : px + dir.normX * Math.min(range, 3));
    const aimY = td > range ? py + dir.normY * range : (td > 0.3 ? rawTy : py + dir.normY * Math.min(range, 3));

    // Walk from (x0, y0) along (nx, ny) until a wall, returning the furthest free point
    const ray = (x0: number, y0: number, nx: number, ny: number, len: number, radius: number = 0.35) => {
      let ex = x0, ey = y0;
      for (let d = 0.25; d <= len; d += 0.25) {
        const tx = x0 + nx * d, ty = y0 + ny * d;
        if (this.isColliding(tx, ty, zone, radius)) break;
        ex = tx; ey = ty;
      }
      return { x: ex, y: ey };
    };
    // Move the hero along dir (a shadow's copy only measures the path)
    const travel = (len) => {
      const { x: nx, y: ny } = ray(px, py, dir.normX, dir.normY, len);
      if (isShadow) return { x: nx, y: ny };
      player.x = nx; player.y = ny;
      player.targetX = null; player.targetY = null;
      player.facing = this.calculateFacing(px, py, nx, ny);
      return { x: nx, y: ny };
    };

    let spot = null; // where a lingering field (skill.field) settles
    switch (skill.spShape) {
      case 'aura': {
        // toggled on here; tickSpToggles pays the upkeep and strikes every frame after
        if (!player.spToggles) player.spToggles = {};
        player.spToggles[skill.id] = { skill, clock: 0 };
        emit({ x: px, y: py, radius: skill.r || 1.4, spin: !!skill.spin }, true);
        say(px, py, `${skill.icon || '✨'} ${skill.name.toUpperCase()} ON`, skill.color || '#ef4444', 16);
        break;
      }
      case 'rewind': {
        // back to the oldest sample within 'back' seconds
        const trail = player.timeTrail || [];
        const want = Date.now() - (skill.back || 3) * 1000;
        const past = trail.find(t => t.t >= want) || trail[0];
        if (past && !this.isColliding(past.x, past.y, zone)) {
          player.x = past.x; player.y = past.y;
          player.targetX = null; player.targetY = null;
          if (past.hp > player.hp) player.hp = Math.min(player.maxHp, past.hp);
        }
        emit({ startX: px, startY: py, x: player.x, y: player.y, radius: 1.2 }, true);
        say(player.x, player.y, '⏪ REWIND', '#fde68a', 17);
        player.timeTrail = [];
        break;
      }
      case 'nova':
      case 'buff': {
        emit({ x: px, y: py, radius: skill.r || 1.4 }, true);
        if (skill.dmg) within(px, py, skill.r).forEach(m => hit(m));
        break;
      }
      case 'shuriken': {
        const width = skill.width || 0.8;
        if (recall) {
          // every star out there (the shadow's too) flies back to the hero, cutting what it passes
          const out = player.nbStars;
          player.nbStars = null;
          const hx = player.x, hy = player.y;
          emit({ recall: true, ownerId: player.id, x: hx, y: hy, stars: out.stars }, false);
          for (const s of out.stars) {
            for (const m of alive()) {
              if (this.distToSegment(m.x, m.y, s.x, s.y, hx, hy) <= width) hit(m, skill.back || 1, s.x, s.y);
            }
          }
          say(hx, hy, '🌀 RECALL!', '#c084fc', 15);
          break;
        }
        // a fan of stars toward the cursor; each stops at its spot (or a wall) and hovers there
        const n = skill.n || 5;
        const reach = Math.min(range, Math.max(3, Math.hypot(aimX - px, aimY - py)));
        const base = Math.atan2(dir.normY, dir.normX), step = n > 1 ? (skill.spread * Math.PI / 180) / (n - 1) : 0;
        const stars = [];
        for (let i = 0; i < n; i++) {
          const ang = base + (i - (n - 1) / 2) * step;
          const end = ray(px, py, Math.cos(ang), Math.sin(ang), reach, 0.2);
          stars.push({ x: end.x, y: end.y });
          for (const m of alive()) {
            if (this.distToSegment(m.x, m.y, px, py, end.x, end.y) <= width) hit(m);
          }
        }
        if (isShadow) {
          // the shadow's stars come back with the hero's on recall
          if (player.nbStars) player.nbStars.stars.push(...stars);
        } else {
          player.nbStars = { slot, skillId: skill.id, stars, until: Date.now() + (skill.hold || 5) * 1000, zone, instanceId };
        }
        emit({ startX: px, startY: py, x: aimX, y: aimY, stars, ownerId: player.id, duration: skill.hold || 5 }, true);
        break;
      }
      case 'smoke': {
        // anyone standing in the cloud makes monster attacks miss (see smokeMissChance)
        this.smokeClouds.push({ zone, instanceId, x: px, y: py, r: skill.r, miss: skill.miss, until: Date.now() + skill.dur * 1000 });
        emit({ x: px, y: py, radius: skill.r, duration: skill.dur }, true);
        if (skill.dmg) within(px, py, skill.r).forEach(m => hit(m));
        if (!isShadow) say(px, py, '💨 SMOKE BOMB', '#cbd5e1', 15);
        break;
      }
      case 'shadow': {
        const spotAt = ray(px, py, dir.normX, dir.normY, Math.hypot(aimX - px, aimY - py), 0.3);
        player.nbShadow = { x: spotAt.x, y: spotAt.y, mirror: skill.mirror, until: Date.now() + skill.dur * 1000, zone, instanceId };
        emit({ startX: px, startY: py, x: spotAt.x, y: spotAt.y, radius: skill.r, duration: skill.dur }, true);
        if (skill.dmg) within(spotAt.x, spotAt.y, skill.r).forEach(m => hit(m, 1, spotAt.x, spotAt.y));
        say(spotAt.x, spotAt.y, '👤 SHADOW', '#a855f7', 15);
        break;
      }
      case 'orbit': {
        // stars circle the hero (or stay put around the shadow) and cut on every tick
        const centre = () => (isShadow ? { x: px, y: py } : { x: player.x, y: player.y });
        emit({ x: px, y: py, radius: skill.r, n: skill.n, duration: skill.dur, followId: isShadow ? null : player.id }, true);
        const spin = () => {
          const c = centre();
          within(c.x, c.y, skill.r).forEach(m => hit(m, 1, c.x, c.y));
        };
        spin();
        const ticks = Math.round(skill.dur / skill.every);
        for (let i = 1; i < ticks; i++) later(i * skill.every, spin);
        break;
      }
      case 'orbs': {
        // n storm orbs fan out ahead (±spread rad) and drift len tiles over dur s,
        // stopping at walls, shocking everything within r of each every `every` s
        const n = skill.n || 2, base = Math.atan2(dir.normY, dir.normX);
        const orbs = [];
        for (let i = 0; i < n; i++) {
          const ang = base + (n > 1 ? (i / (n - 1) * 2 - 1) * skill.spread : 0);
          const end = ray(px, py, Math.cos(ang), Math.sin(ang), skill.len, 0.3);
          orbs.push({ sx: px, sy: py, ex: end.x, ey: end.y });
        }
        emit({ x: px, y: py, orbs, radius: skill.r, duration: skill.dur }, true);
        const ticks = Math.round(skill.dur / skill.every);
        const shock = (i) => {
          const k = i / ticks;
          for (const o of orbs) {
            const ox = o.sx + (o.ex - o.sx) * k, oy = o.sy + (o.ey - o.sy) * k;
            within(ox, oy, skill.r).forEach(m => hit(m, 1, ox, oy));
          }
        };
        for (let i = 1; i <= ticks; i++) later(i * skill.every, () => shock(i));
        break;
      }
      case 'detonate': {
        emit({ x: px, y: py, radius: skill.r || 7.0 }, true);
        let detonatedCount = 0;
        for (const m of within(px, py, skill.r || 7.0)) {
          const stacks = m.poisonStacks || (m.poisonTimer > 0 ? 2 : 0);
          if (stacks > 0) {
            const detonateMult = (skill.dmgMult || 2.2) + (stacks * 0.75);
            const detonateDmg = Math.round(player.dmg * detonateMult);
            applySkillDamage(m, detonateDmg, true);
            m.poisonStacks = 0;
            m.poisonTimer = 0;
            m.poisonDmg = 0;
            detonatedCount++;
            this.emitZone(zone, 'floating_text', { x: m.x, y: m.y - 0.8, text: `💥 DETONATE! -${detonateDmg}`, color: '#22c55e', size: 18 });
          }
        }
        if (detonatedCount > 0) {
          this.emitZone(zone, 'floating_text', { x: px, y: py - 0.8, text: `☣️ DETONATED ${detonatedCount} ENEMIES!`, color: '#86efac', size: 16 });
        }
        break;
      }
      case 'blast': {
        spot = { x: aimX, y: aimY };
        emit({ x: aimX, y: aimY, startX: px, startY: py, radius: skill.r }, true);
        within(aimX, aimY, skill.r).forEach(m => hit(m, 1, aimX, aimY));
        break;
      }
      case 'pull': {
        spot = { x: aimX, y: aimY };
        const isDreadRoar = skill.id === 'sp_void_grasp';
        const pullCenterX = isDreadRoar ? px : aimX;
        const pullCenterY = isDreadRoar ? py : aimY;
        emit({ x: pullCenterX, y: pullCenterY, radius: skill.r }, true);
        if (isDreadRoar) say(px, py, '💀 MOCKING DREAD ROAR!', '#c084fc', 17);
        for (const m of within(pullCenterX, pullCenterY, skill.r)) {
          const nx = pullCenterX + (m.x - pullCenterX) * (isDreadRoar ? 0.25 : 0.3);
          const ny = pullCenterY + (m.y - pullCenterY) * (isDreadRoar ? 0.25 : 0.3);
          if (!this.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
          if (isDreadRoar) {
            m.attackCooldown = Math.max(m.attackCooldown || 0, 1.2);
            m.targetPlayerId = player.id;
          }
          hit(m, 1, pullCenterX, pullCenterY);
        }
        break;
      }
      case 'cone': {
        emit({ x: px, y: py, dirX: dir.normX, dirY: dir.normY, range: skill.range, arc: skill.arc }, true);
        if (skill.id === 'sp_dread_wave') say(px, py, '🪓 CATACLYSMIC AXE DRAG!', '#f43f5e', 17);
        const half = (skill.arc * Math.PI) / 360;
        for (const m of within(px, py, skill.range)) {
          const d = Math.hypot(m.x - px, m.y - py);
          if (d < 0.5) { hit(m); continue; }
          const cos = ((m.x - px) * dir.normX + (m.y - py) * dir.normY) / d;
          if (Math.acos(Math.max(-1, Math.min(1, cos))) <= half) {
            hit(m);
            if (skill.id === 'sp_dread_wave' && m.state !== 'dead') {
              m.burnTimer = Math.max(m.burnTimer || 0, 3.5);
              m.burnDmg = Math.max(m.burnDmg || 0, Math.round(player.dmg * 0.28));
            }
          }
        }
        break;
      }
      case 'line': {
        const ex = px + dir.normX * skill.len, ey = py + dir.normY * skill.len;
        emit({ startX: px, startY: py, x: ex, y: ey, width: skill.width }, true);
        if (skill.id === 'sp_abyss_cleave') say(px, py, '🪓 ABYSSAL GUILLOTINE!', '#c084fc', 17);
        for (const m of alive()) {
          if (this.distToSegment(m.x, m.y, px, py, ex, ey) <= skill.width) hit(m);
        }
        if (skill.id === 'sp_abyss_cleave') {
          later(0.32, () => {
            emit({ startX: px, startY: py, x: ex, y: ey, width: skill.width * 1.15, wave: 1 }, false);
            for (const m of alive()) {
              if (this.distToSegment(m.x, m.y, px, py, ex, ey) <= skill.width * 1.15) hit(m, 0.45);
            }
          });
        }
        break;
      }
      case 'strike': {
        // Prefer the enemy at the aim point, else the closest one in reach
        const atAim = nearest(aimX, aimY, 2.5);
        const target = atAim && Math.hypot(atAim.x - px, atAim.y - py) <= skill.range + 1 ? atAim : nearest(px, py, skill.range);
        const tx = target ? target.x : aimX, ty = target ? target.y : aimY;
        emit({ startX: px, startY: py, x: tx, y: ty, radius: 0.9 }, true);
        if (target) {
          if (skill.id === 'sp_soul_rend') {
            const isExec = target.maxHp && target.hp <= target.maxHp * 0.45;
            say(target.x, target.y, isExec ? '🪓 GUILLOTINE EXECUTE!' : '🪓 BEHEADING!', '#f43f5e', isExec ? 19 : 17);
            hit(target, isExec ? 1.35 : 1.0);
          } else {
            hit(target);
          }
        }
        break;
      }
      case 'volley': {
        const targets = within(px, py, skill.range)
          .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
          .slice(0, skill.n);
        emit({ x: px, y: py, startX: px, startY: py, points: targets.map(m => ({ x: m.x, y: m.y })) }, true);
        targets.forEach(m => hit(m));
        break;
      }
      case 'chain': {
        const visited = new Set();
        const points = [];
        let cur = nearest(px, py, skill.range);
        let mult = 1;
        while (cur && points.length < skill.n) {
          visited.add(cur);
          points.push({ x: cur.x, y: cur.y });
          hit(cur, mult, points.length > 1 ? points[points.length - 2].x : px, points.length > 1 ? points[points.length - 2].y : py);
          mult *= skill.decay || 0.85;
          cur = nearest(cur.x, cur.y, skill.jump || 4, visited);
        }
        emit({ x: px, y: py, startX: px, startY: py, points }, true);
        break;
      }
      case 'pulse': {
        const onTarget = skill.at === 'target';
        let seekX = aimX, seekY = aimY, lastPrey = null;
        if (skill.id === 'sp_soul_bastion') {
          const missingShare = Math.max(0, 1 - (player.hp / Math.max(1, player.maxHp)));
          const bloodlustHeal = Math.max(1, Math.round(player.maxHp * (0.12 + 0.18 * missingShare)));
          player.hp = Math.min(player.maxHp, player.hp + bloodlustHeal);
          say(px, py, `🔥 UNDYING RAGE! (+${bloodlustHeal} HP)`, '#f43f5e', 18);
        }
        const wave = (i) => {
          let cx = onTarget ? seekX : player.x, cy = onTarget ? seekY : player.y;
          if (skill.seek) {
            // hop to a different enemy each pulse (stay put only if it is the last one)
            const prey = nearest(cx, cy, skill.seek, lastPrey ? new Set([lastPrey]) : null) || (lastPrey && lastPrey.state !== 'dead' ? lastPrey : nearest(cx, cy, skill.seek));
            if (prey) { lastPrey = prey; seekX = cx = prey.x; seekY = cy = prey.y; }
          }
          emit({ x: cx, y: cy, radius: skill.r, wave: i }, i === 0);
          within(cx, cy, skill.r).forEach(m => hit(m, 1, cx, cy));
        };
        wave(0);
        for (let i = 1; i < skill.n; i++) later(i * skill.every, () => wave(i));
        break;
      }
      case 'rain': {
        // Each strike lands on a random enemy in the area, or a random spot if none
        if (skill.id === 'sp_grave_rain') say(aimX, aimY, '🪓 GUILLOTINE SKYFALL!', '#c084fc', 17);
        const strike = (i) => {
          const inArea = within(aimX, aimY, skill.r);
          const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * skill.r;
          const pick = inArea.length ? inArea[Math.floor(Math.random() * inArea.length)] : null;
          const sx = pick ? pick.x : aimX + Math.cos(a) * d, sy = pick ? pick.y : aimY + Math.sin(a) * d;
          emit({ x: sx, y: sy, radius: skill.hit, wave: i, areaX: aimX, areaY: aimY, areaR: skill.r }, i === 0);
          within(sx, sy, skill.hit).forEach(m => hit(m, 1, sx, sy));
          if (skill.id === 'sp_grave_rain' && i === skill.n - 1) {
            within(aimX, aimY, skill.r).forEach(m => hit(m, 0.75, aimX, aimY));
          }
        };
        strike(0);
        for (let i = 1; i < skill.n; i++) later(i * skill.every, () => strike(i));
        break;
      }
      case 'dash': {
        const end = travel(skill.len);
        spot = { x0: px, y0: py, x1: end.x, y1: end.y };
        let resetDash = false;
        let spinHits = 0;
        for (const m of alive()) {
          if (this.distToSegment(m.x, m.y, px, py, end.x, end.y) <= skill.width) {
            if (skill.resetOnStatic && m.staticCharge && m.staticCharge > 0) {
              m.staticCharge = 0;
              resetDash = true;
            }
            spinHits++;
            hit(m);
          }
        }
        if (resetDash) {
          player.skillCooldowns['dash'] = 0;
          player.skillCooldowns[slot] = 0;
          this.emitZone(zone, 'floating_text', { x: end.x, y: end.y - 0.7, text: '⚡ DASH RESET!', color: '#facc15', size: 16 });
          const socket = this.io.sockets.sockets.get(player.id);
          if (socket) socket.emit('player_updated', player);
        } else if (skill.spinReset && spinHits > 0) {
          const cdReduce = spinHits * skill.spinReset;
          player.skillCooldowns['dash'] = Math.max(0, (player.skillCooldowns['dash'] || 0) - cdReduce);
          if (player.skillCooldowns[slot] !== undefined) {
            player.skillCooldowns[slot] = Math.max(0, (player.skillCooldowns[slot] || 0) - cdReduce);
          }
          this.emitZone(zone, 'floating_text', { x: end.x, y: end.y - 0.7, text: `🪓 SPIN SLAUGHTER -${cdReduce.toFixed(1)}s CD!`, color: '#c084fc', size: 15 });
          const socket = this.io.sockets.sockets.get(player.id);
          if (socket) socket.emit('player_updated', player);
        }
        emit({ startX: px, startY: py, x: end.x, y: end.y, width: skill.width, facing: player.facing }, true);
        break;
      }
      case 'backstep': {
        const target = nearest(aimX, aimY, 3.5) || nearest(px, py, skill.range || 7);
        if (target) {
          const tdir = { normX: dir.normX || 1, normY: dir.normY || 0 };
          let destX = target.x - tdir.normX * 1.0;
          let destY = target.y - tdir.normY * 1.0;
          if (this.isColliding(destX, destY, zone)) {
            destX = target.x + tdir.normX * 1.0;
            destY = target.y + tdir.normY * 1.0;
          }
          emit({ startX: px, startY: py, x: destX, y: destY, radius: 1.5 }, true);
          hit(target, 2.2);
          target.shadowMarkTimer = 6.0;
          if (!isShadow) {
            player.x = destX; player.y = destY;
            player.targetX = null; player.targetY = null;
            player.facing = this.calculateFacing(destX, destY, target.x, target.y);
            this.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '👤 SHADOWSTEP!', color: '#a855f7' });
            const socket = this.io.sockets.sockets.get(player.id);
            if (socket) socket.emit('player_updated', player);
          }
        } else {
          const end = travel(skill.len || 6);
          emit({ startX: px, startY: py, x: end.x, y: end.y, radius: 1.5 }, true);
        }
        break;
      }
      case 'blink': {
        const end = travel(skill.len);
        emit({ startX: px, startY: py, x: end.x, y: end.y, radius: skill.r || 0, origin: !!(skill.origin || skill.originOnly), landing: !skill.originOnly && !!skill.dmg, facing: player.facing }, true);
        if (skill.id === 'sp_void_step') say(end.x, end.y, '🪓 OBLIVION SLAM!', '#c084fc', 17);
        if (skill.riftPull) {
          within(px, py, skill.riftPull).forEach((m, i) => {
            const a = (i / 6) * Math.PI * 2;
            const nx = end.x + Math.cos(a) * 1.2, ny = end.y + Math.sin(a) * 1.2;
            if (!this.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
          });
        }
        if (skill.taunt) {
          for (const m of within(px, py, 8)) {
            m.targetPlayerId = null;
            m.state = 'idle';
            m.wanderTarget = { x: px, y: py };
            m.nextWanderTime = Date.now() + skill.taunt * 1000;
          }
        }
        if (skill.dmg) {
          const struck = new Set();
          if (skill.origin || skill.originOnly) within(px, py, skill.r).forEach(m => { struck.add(m); hit(m, 1, px, py); });
          if (!skill.originOnly) within(end.x, end.y, skill.r).filter(m => !struck.has(m)).forEach(m => hit(m, 1, end.x, end.y));
        }
        break;
      }
    }

    // Lingering ground: burning crater / fire trail / gravity well, ticking on its own
    if (skill.field && spot) {
      const F = skill.field;
      const line = spot.x1 !== undefined;
      const cx = line ? (spot.x0 + spot.x1) / 2 : spot.x, cy = line ? (spot.y0 + spot.y1) / 2 : spot.y;
      emit(line
        ? { shape: 'field', startX: spot.x0, startY: spot.y0, x: spot.x1, y: spot.y1, radius: F.r, duration: F.dur, pull: !!F.pull }
        : { shape: 'field', x: cx, y: cy, radius: F.r, duration: F.dur, pull: !!F.pull }, false);
      const ticks = Math.round(F.dur / F.every);
      for (let i = 1; i <= ticks; i++) {
        later(i * F.every, () => {
          const victims = line
            ? alive().filter(m => this.distToSegment(m.x, m.y, spot.x0, spot.y0, spot.x1, spot.y1) <= F.r)
            : within(cx, cy, F.r);
          for (const m of victims) {
            if (F.pull) {
              const nx = cx + (m.x - cx) * (1 - F.pull), ny = cy + (m.y - cy) * (1 - F.pull);
              if (!this.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
            }
            hit(m, F.mult, cx, cy);
          }
        });
      }
    }
    // Singularity: after a beat, everything nearby falls into the point and is crushed
    if (skill.implode) {
      const I = skill.implode;
      later(I.delay, () => {
        emit({ shape: 'pull', x: aimX, y: aimY, radius: I.r, implode: true }, false);
        for (const m of within(aimX, aimY, I.r)) {
          const nx = aimX + (m.x - aimX) * 0.2, ny = aimY + (m.y - aimY) * 0.2;
          if (!this.isColliding(nx, ny, zone)) { m.x = nx; m.y = ny; }
          hit(m, I.mult, aimX, aimY);
        }
      });
    }
    // a shadow's copy only deals damage: no self buffs, cooldown cuts or echoes
    if (isShadow) {
      settleLeech();
      return;
    }
    // Chronomancer Echo: the whole skill replays later at reduced strength
    if (skill.echo && !isEcho) {
      later(skill.echo, () => {
        say(aimX, aimY, '⏳ ECHO', '#fde68a', 15);
        const echoSkill = Object.assign({}, skill, {
          dmgMult: skill.dmgMult * ECHO_DAMAGE, echo: 0, heal: 0, mana: 0, shield: 0, fortress: 0, haste: 0, sprint: 0, smoke: 0
        });
        this.castSpSkill(player, echoSkill, Object.assign({}, ctx, { skillData: Object.assign({}, skillData, { targetX: aimX, targetY: aimY }), isEcho: true }));
      });
    }
    if (skill.charge) gainCharge(skill.charge);
    if (skill.haste && player.skillCooldowns) {
      for (const k of Object.keys(player.skillCooldowns)) {
        if (k !== slot && player.skillCooldowns[k] > 0) player.skillCooldowns[k] = Math.max(0, player.skillCooldowns[k] - skill.haste);
      }
    }

    // Self effects
    const buffs = [];
    if (skill.charge || skill.chargeHit) buffs.push(`⚡ CHARGE ${player.stormCharge || 0}/${STORM_CHARGE_MAX}`);
    if (skill.haste) buffs.push(`HASTE -${skill.haste}s`);
    if (skill.cleanse) {
      player.statusEffects = [];
      buffs.push('CLEANSED');
    }
    if (skill.flowGain) {
      player.flowStacks = Math.min(5, (player.flowStacks || 0) + skill.flowGain);
      player.flowTimer = 5.0;
      buffs.push(`FLOW x${player.flowStacks}`);
    }
    if (skill.invuln) {
      player.smokeScreenTimer = Math.max(player.smokeScreenTimer || 0, skill.invuln);
    }
    if (skill.hpCost) player.hp = Math.max(1, player.hp - Math.round(player.hp * skill.hpCost));
    if (skill.undying) { player.undyingTimer = Math.max(player.undyingTimer || 0, skill.undying); buffs.push('UNDYING RAGE'); }
    if (skill.berserk) { player.berserkTimer = Math.max(player.berserkTimer || 0, skill.berserk); buffs.push('RAGE'); }
    if (skill.bloodlust) {
      const b = skill.bloodlust;
      player.bloodlust = { timer: b.dur, rage: b.rage, atkSpeed: b.atkSpeed, thirst: b.thirst };
      this.recalculatePlayerStats(player);
      buffs.push('BLOODLUST');
    }
    if (skill.fortress) { player.ironFortressTimer = Math.max(player.ironFortressTimer || 0, skill.fortress); buffs.push('FORTRESS'); }
    if (skill.sprint) player.sprintTimer = Math.max(player.sprintTimer || 0, skill.sprint);
    if (skill.smoke) { player.smokeScreenTimer = Math.max(player.smokeScreenTimer || 0, skill.smoke); buffs.push('VANISH'); }
    if (skill.shield) { const v = Math.round(player.maxHp * skill.shield); player.shieldHp = (player.shieldHp || 0) + v; buffs.push(`+${v} SHIELD`); }
    if (skill.heal) { const v = Math.round(player.maxHp * skill.heal); player.hp = Math.min(player.maxHp, player.hp + v); buffs.push(`+${v} HP`); }
    if (skill.mana) player.mp = Math.min(player.maxMp, player.mp + Math.round(player.maxMp * skill.mana));
    if (buffs.length && !isEcho) {
      this.emitZone(zone, 'floating_text', { x: player.x, y: player.y - 0.8, text: `${skill.name.toUpperCase()} (${buffs.join(' / ')})`, color: skill.color || '#e2e8f0' });
    }
    if (isSoulCard && player.voidSouls > 0 && !isEcho) say(player.x, player.y - 0.3, `👻 SOULS ${player.voidSouls}/${VOID_SOUL_MAX}`, '#c084fc', 13);
    settleLeech();
    if (skill.haste || skill.spShape === 'rewind') {
      const socket = this.io.sockets.sockets.get(player.id);
      if (socket) socket.emit('player_updated', player);
    }
  }

  // Chance a monster's attack on this hero misses because they stand in a Smoke Bomb cloud
  smokeMissChance(player) {
    const now = Date.now();
    if (this.smokeClouds.length) this.smokeClouds = this.smokeClouds.filter(c => c.until > now);
    const instanceId = player.dungeonInstanceId || null;
    let miss = 0;
    for (const c of this.smokeClouds) {
      if (c.zone === player.zone && c.instanceId === instanceId && Math.hypot(player.x - c.x, player.y - c.y) <= c.r) miss = Math.max(miss, c.miss);
    }
    return miss;
  }

  // linkedSkillId is only set by the server itself (Skill Link casts)
  handlePlayerSkill(socketId: any, skillData: any = {}, linkedSkillId: any = null) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    const rawSlot = skillData.skillSlot || 'slot1';
    const slot = (rawSlot === 'skill1') ? 'slot1' : (rawSlot === 'skill2') ? 'slot2' : rawSlot;
    if (!linkedSkillId && !CLIENT_SKILL_SLOTS.has(slot)) return;

    if (!player.equippedSkills) {
      player.equippedSkills = JSON.parse(JSON.stringify(DEFAULT_EQUIPPED_SKILLS[player.characterClass] || DEFAULT_EQUIPPED_SKILLS.warrior));
    }
    if (!player.skillCooldowns) {
      player.skillCooldowns = { slot1: 0, slot2: 0, slot3: 0, dash: 0, skill1: 0, skill2: 0 };
    }
    // Nightblade: casting Phantom Shuriken again while its stars are out calls them back (free, ignores cooldown)
    const stars = player.nbStars;
    const recall = !!(stars && stars.slot === slot && Date.now() < stars.until && player.equippedSkills && player.equippedSkills[slot] === stars.skillId
      && stars.zone === player.zone && stars.instanceId === (player.dungeonInstanceId || null));
    if (!recall && (player.skillCooldowns[slot] > 0 || (player.skillCooldowns[rawSlot] > 0))) return;

    const socket0 = this.io.sockets.sockets.get(socketId);
    const skillId = linkedSkillId ? linkedSkillId : slot === 'weapon' ? 'weapon'
      : player.equippedSkills[slot] || (DEFAULT_EQUIPPED_SKILLS[player.characterClass] && DEFAULT_EQUIPPED_SKILLS[player.characterClass][slot]) || 'whirlwind';
    const skill = this.resolvePlayerSkill(player, slot, skillId);
    if (!skill) {
      if (socket0) socket0.emit('floating_text', { x: player.x, y: player.y - 0.7, text: 'This weapon has no ability', color: '#94a3b8' });
      return;
    }
    const runeId = (player.equippedSkills.runes && player.equippedSkills.runes[slot]) || 'none';

    const socket = this.io.sockets.sockets.get(socketId);
    const playerTalents = player.skills || {};

    if (skill.spShape === 'aura') {
      // casting an active blood aura again switches it off, for free
      if (player.spToggles && player.spToggles[skill.id]) {
        player.skillCooldowns[slot] = player.skillCooldowns[rawSlot] = skill.cooldown;
        this.endSpToggle(player, skill.id);
        this.emitZone(player.zone, 'skill_fx', {
          type: 'sp_skill', shape: 'aura', off: true, x: player.x, y: player.y, radius: skill.r || 1.4, element: skill.element, color: skill.color,
          cardId: skill.cardId, skillId: skill.id, name: skill.name, skillSlot: slot, cooldown: skill.cooldown, playerId: player.id
        });
        if (socket) socket.emit('player_updated', player);
        return;
      }
      if (skill.drain && player.hp <= player.maxHp * BLOOD_AURA_START_HP) {
        if (socket) socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: '🩸 Not enough blood!', color: '#ef4444' });
        return;
      }
    }

    let mpCost = Math.round(skill.mpCost * (player.manaCostMult || 1));
    if (playerTalents.mana_flow) {
      mpCost = Math.max(2, Math.round(mpCost * (1 - playerTalents.mana_flow * 0.15)));
    }

    if (!recall && player.mp < mpCost) {
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: '⚠️ Not enough Mana!',
          color: '#38bdf8'
        });
      }
      return;
    }

    let cooldown = skill.cooldown;
    if (runeId === 'tempest') {
      cooldown = Math.max(1.0, Number((cooldown * 0.8).toFixed(1)));
    }
    if (slot === 'dash') {
      if (playerTalents.sundering_dash) cooldown = Math.max(1.2, cooldown - playerTalents.sundering_dash * 0.5);
      if (playerTalents.arcane_haste) cooldown = Math.max(1.2, cooldown - playerTalents.arcane_haste * 0.6);
      if (playerTalents.shadow_sprint) cooldown = Math.max(1.2, cooldown - playerTalents.shadow_sprint * 0.5);
    }

    if (!recall) {
      player.mp -= mpCost;
      player.skillCooldowns[slot] = cooldown;
      player.skillCooldowns[rawSlot] = cooldown;
      if (slot === 'slot1') player.skillCooldown = cooldown;
      if (socket) socket.emit('player_updated', player);
    }

    const mobsMap = this.getMobsMap(player.zone);
    let totalDmgDealt = 0;

    // `canCrit` only allows a crit; it is rolled like a basic attack, plus the
    // skill's own critBonus (e.g. Fan of Knives, Shadowstep).
    const skillCritChance = 0.15 + (player.critChanceBonus || 0) + (skill.critBonus || 0);
    const applySkillDamage = (mob, baseDmg, canCrit = false) => {
      const isCrit = canCrit && Math.random() < skillCritChance;
      let dmg = Math.max(1, Math.round(baseDmg * SKILL_DAMAGE_SCALE));
      if (runeId === 'flame') {
        dmg = Math.round(dmg * 1.25);
        mob.burnTimer = 3.5;
        mob.burnDmg = 16;
      }
      if (runeId === 'frost') {
        mob.chillTimer = 3.5;
        if (Math.random() < 0.25) mob.chillTimer = 5.0;
      }
      if (runeId === 'tempest') {
        dmg = Math.round(dmg * 1.10);
      }
      if (player.berserkTimer > 0) {
        dmg = Math.round(dmg * 1.35);
      }
      if (player.bloodlust) dmg = Math.round(dmg * this.bloodRage(player));
      this.applyDamageToMob(player, mob, dmg, isCrit);
      totalDmgDealt += dmg;
    };

    // Helper for Dash vector calculations
    const computeDashVector = () => {
      let dirX = 0, dirY = 0;
      if (skillData.dirX !== undefined && skillData.dirY !== undefined && (skillData.dirX !== 0 || skillData.dirY !== 0)) {
        dirX = skillData.dirX;
        dirY = skillData.dirY;
      } else if (player.moveDir && (player.moveDir.dx !== 0 || player.moveDir.dy !== 0)) {
        const sLen = Math.hypot(player.moveDir.dx, player.moveDir.dy);
        const nx = player.moveDir.dx / sLen;
        const ny = player.moveDir.dy / sLen;
        dirX = (nx + ny * 2) * 0.5;
        dirY = (ny * 2 - nx) * 0.5;
      } else if (player.targetX !== null && player.targetY !== null) {
        const td = Math.hypot(player.targetX - player.x, player.targetY - player.y);
        if (td > 0.1) {
          dirX = (player.targetX - player.x) / td;
          dirY = (player.targetY - player.y) / td;
        }
      }
      if (Math.hypot(dirX, dirY) < 0.001) {
        const facingVectors = {
          'E': { dx: 1, dy: -1 }, 'SE': { dx: 1, dy: 0 }, 'S': { dx: 1, dy: 1 },
          'SW': { dx: 0, dy: 1 }, 'W': { dx: -1, dy: 1 }, 'NW': { dx: -1, dy: 0 },
          'N': { dx: -1, dy: -1 }, 'NE': { dx: 0, dy: -1 }
        };
        const vec = facingVectors[player.facing] || { dx: 1, dy: 0 };
        dirX = vec.dx; dirY = vec.dy;
      }
      const dirLen = Math.hypot(dirX, dirY) || 1;
      return { normX: dirX / dirLen, normY: dirY / dirLen };
    };

    // EXECUTE SPECIFIC ABILITY
    switch (skill.spShape ? 'sp_skill' : skill.id) {
      case 'sp_skill': {
        const spCtx = { slot, cooldown, runeId, skillData, mobsMap, applySkillDamage, computeDashVector, recall };
        this.castSpSkill(player, skill, spCtx);
        // Nightblade's tossed shadow casts the same skill from where it stands
        const shadow = player.nbShadow;
        if (shadow && Date.now() < shadow.until && shadow.zone === player.zone && shadow.instanceId === (player.dungeonInstanceId || null)
          && !recall && !SHADOW_SKIPS_SHAPES.has(skill.spShape)) {
          const echo = Object.assign({}, skill, { dmgMult: skill.dmgMult * shadow.mirror });
          this.castSpSkill(player, echo, Object.assign({}, spCtx, { isShadow: true, origin: { x: shadow.x, y: shadow.y } }));
        }
        break;
      }

      // === WARRIOR SKILLS ===
      case 'whirlwind': {
        const wwRadius = skill.radius + (playerTalents.cyclone_cleave ? playerTalents.cyclone_cleave * 0.6 : 0);
        const wwDmgMult = skill.dmgMult + (playerTalents.cyclone_cleave ? playerTalents.cyclone_cleave * 0.25 : 0);
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'whirlwind', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: wwRadius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= wwRadius) {
            applySkillDamage(mob, Math.round(player.dmg * wwDmgMult), true);
          }
        }
        break;
      }

      case 'earthshaker': {
        const slamDmgMult = skill.dmgMult + (playerTalents.seismic_shatter ? playerTalents.seismic_shatter * 0.30 : 0);
        const slowDur = (skill.slowDuration || 2.5) + (playerTalents.seismic_shatter ? playerTalents.seismic_shatter * 1.5 : 0);
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'earthshaker', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * slamDmgMult), true);
            mob.chillTimer = slowDur;
          }
        }
        break;
      }

      case 'blade_charge': {
        const { normX, normY } = computeDashVector();
        const startX = player.x, startY = player.y;
        const dashDist = skill.distance || 4.8;
        let newX = startX, newY = startY;
        const steps = Math.floor(dashDist / 0.25);
        for (let s = 1; s <= steps; s++) {
          const tx = startX + normX * (s * 0.25);
          const ty = startY + normY * (s * 0.25);
          if (this.isColliding(tx, ty, player.zone)) break;
          newX = tx; newY = ty;
        }
        player.x = newX; player.y = newY;
        player.targetX = null; player.targetY = null;
        player.facing = this.calculateFacing(startX, startY, newX, newY);
        const chargeDmgMult = skill.dmgMult + (playerTalents.sundering_dash ? playerTalents.sundering_dash * 0.25 : 0);
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = this.distToSegment(mob.x, mob.y, startX, startY, newX, newY);
          if (dist <= 1.4) {
            applySkillDamage(mob, Math.round(player.dmg * chargeDmgMult), true);
            const kx = mob.x + normX * 0.8;
            const ky = mob.y + normY * 0.8;
            if (!this.isColliding(kx, ky, player.zone)) { mob.x = kx; mob.y = ky; }
          }
        }
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'blade_charge', skillSlot: slot, cooldown, startX, startY, x: newX, y: newY, playerId: player.id });
        break;
      }

      case 'shield_slam': {
        let targetMob = null;
        let minDist = 3.2;
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (dist < minDist) { minDist = dist; targetMob = mob; }
        }
        const hitX = targetMob ? targetMob.x : player.x;
        const hitY = targetMob ? targetMob.y : player.y;
        player.shieldHp = (player.shieldHp || 0) + (skill.shieldHp || 80);
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: `🛡️ Shield Barrier +${skill.shieldHp || 80}!`, color: '#38bdf8' });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'shield_slam', skillSlot: slot, cooldown, x: hitX, y: hitY, playerId: player.id });
        if (targetMob) {
          applySkillDamage(targetMob, Math.round(player.dmg * skill.dmgMult), true);
          targetMob.chillTimer = skill.stunDuration || 2.0;
        }
        break;
      }

      case 'blood_rage': {
        const hpLoss = Math.max(10, Math.round(player.hp * 0.10));
        player.hp = Math.max(1, player.hp - hpLoss);
        player.berserkTimer = skill.duration || 6.0;
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '🩸 BERSERK RAGE (+35% DMG & 20% Leech)', color: '#ef4444' });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'blood_rage', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'colossus_strike': {
        const hitX = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const hitY = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'colossus_strike', skillSlot: slot, cooldown, x: hitX, y: hitY, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - hitX, mob.y - hitY) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'iron_fortress': {
        player.ironFortressTimer = skill.duration || 4.5;
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '🏰 IRON FORTRESS (60% Shield & Thorns)', color: '#94a3b8' });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'iron_fortress', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'war_stomp': {
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'war_stomp', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (dist <= skill.radius) {
            mob.x = player.x + (mob.x - player.x) * 0.35;
            mob.y = player.y + (mob.y - player.y) * 0.35;
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.chillTimer = skill.stunDuration || 1.8;
          }
        }
        break;
      }

      case 'dragon_roar': {
        player.berserkTimer = skill.duration || 6.0;
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: "🐲 DRAGON'S ROAR (+40% ATK & FEAR)", color: '#f97316', size: 19 });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'dragon_roar', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.chillTimer = 2.0;
          }
        }
        break;
      }

      case 'meteor_dive': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        if (!this.isColliding(tx, ty, player.zone)) {
          player.x = tx; player.y = ty;
        }
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'meteor_dive', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.burnTimer = 4.0;
            mob.burnDmg = 18;
          }
        }
        break;
      }

      case 'bladestorm_frenzy': {
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'bladestorm_frenzy', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'titan_bastion': {
        player.shieldHp = (player.shieldHp || 0) + (skill.shieldHp || 350);
        player.ironFortressTimer = skill.duration || 5.0;
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: `🏛️ TITAN BASTION (+${skill.shieldHp || 350} Shield & Armor)`, color: '#facc15', size: 19 });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'titan_bastion', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'sundering_cleave': {
        const { normX, normY } = computeDashVector();
        const cleaveDist = skill.distance || 9.0;
        const cleaveX = player.x + normX * cleaveDist;
        const cleaveY = player.y + normY * cleaveDist;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'sundering_cleave', skillSlot: slot, cooldown, startX: player.x, startY: player.y, x: cleaveX, y: cleaveY, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = this.distToSegment(mob.x, mob.y, player.x, player.y, cleaveX, cleaveY);
          if (dist <= 1.8) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.chillTimer = 3.0;
          }
        }
        break;
      }

      case 'ragnarok_slash': {
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.9, text: '👑 RAGNARÖK GODSLAYER!', color: '#eab308', size: 24 });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'ragnarok_slash', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      // === MAGE SKILLS ===
      case 'firestorm': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        const meteorRadius = skill.radius + (playerTalents.infernal_cataclysm ? playerTalents.infernal_cataclysm * 1.0 : 0);
        const meteorDmgMult = skill.dmgMult + (playerTalents.infernal_cataclysm ? playerTalents.infernal_cataclysm * 0.30 : 0);
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'firestorm', skillSlot: slot, cooldown, x: tx, y: ty, radius: meteorRadius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= meteorRadius) {
            applySkillDamage(mob, Math.round(player.dmg * meteorDmgMult), true);
            mob.burnTimer = skill.burnDuration || 3.0;
            mob.burnDmg = (skill.burnDmg || 12) + (playerTalents.infernal_cataclysm ? playerTalents.infernal_cataclysm * 5 : 0);
          }
        }
        break;
      }

      case 'frost_nova': {
        const novaDmgMult = skill.dmgMult + (playerTalents.glacial_tomb ? playerTalents.glacial_tomb * 0.25 : 0);
        const chillDur = (skill.chillDuration || 3.5) + (playerTalents.glacial_tomb ? playerTalents.glacial_tomb * 1.5 : 0);
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'frost_nova', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * novaDmgMult), false);
            mob.chillTimer = chillDur;
          }
        }
        break;
      }

      case 'arcane_blink': {
        const { normX, normY } = computeDashVector();
        const startX = player.x, startY = player.y;
        let dashDist = skill.distance || 5.2;
        if (playerTalents.arcane_haste) dashDist += playerTalents.arcane_haste * 1.5;
        let newX = startX, newY = startY;
        const steps = Math.floor(dashDist / 0.25);
        for (let s = steps; s >= 1; s--) {
          const tx = startX + normX * (s * 0.25);
          const ty = startY + normY * (s * 0.25);
          if (!this.isColliding(tx, ty, player.zone)) {
            newX = tx; newY = ty;
            break;
          }
        }
        player.x = newX; player.y = newY;
        player.targetX = null; player.targetY = null;
        player.statusEffects = [];
        player.speedFactor = 1.0;
        player.facing = this.calculateFacing(startX, startY, newX, newY);
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - newX, mob.y - newY) <= (skill.radius || 2.4)) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
            mob.chillTimer = skill.chillDuration || 2.0;
          }
        }
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'arcane_blink', skillSlot: slot, cooldown, startX, startY, x: newX, y: newY, playerId: player.id });
        break;
      }

      case 'chain_lightning': {
        let currentTarget = null;
        let minDist = 7.0;
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (dist < minDist) { minDist = dist; currentTarget = mob; }
        }
        const points = [{ x: player.x, y: player.y }];
        const hitMobIds = new Set();
        let chainTarget = currentTarget;
        for (let b = 0; b < (skill.bounces || 5); b++) {
          if (!chainTarget) break;
          hitMobIds.add(chainTarget.id);
          points.push({ x: chainTarget.x, y: chainTarget.y });
          applySkillDamage(chainTarget, Math.round(player.dmg * skill.dmgMult), true);
          let nextTarget = null;
          let nextDist = 5.0;
          for (const mob of mobsMap.values()) {
            if (mob.state === 'dead' || hitMobIds.has(mob.id)) continue;
            const dist = Math.hypot(mob.x - chainTarget.x, mob.y - chainTarget.y);
            if (dist < nextDist) { nextDist = dist; nextTarget = mob; }
          }
          chainTarget = nextTarget;
        }
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'chain_lightning', skillSlot: slot, cooldown, points, playerId: player.id });
        break;
      }

      case 'mana_shield': {
        player.shieldHp = (player.shieldHp || 0) + (skill.absorbHp || 120);
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: `✨ Mana Barrier +${skill.absorbHp || 120} Shield!`, color: '#67e8f9' });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'mana_shield', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'black_hole': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'black_hole', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - tx, mob.y - ty);
          if (dist <= skill.radius) {
            mob.x = tx + (mob.x - tx) * 0.2;
            mob.y = ty + (mob.y - ty) * 0.2;
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'blizzard': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'blizzard', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
            mob.chillTimer = 4.0;
          }
        }
        break;
      }

      case 'pyroblast': {
        const { normX, normY } = computeDashVector();
        const hitX = player.x + normX * 4.5;
        const hitY = player.y + normY * 4.5;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'pyroblast', skillSlot: slot, cooldown, startX: player.x, startY: player.y, x: hitX, y: hitY, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - hitX, mob.y - hitY) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.burnTimer = skill.burnDuration || 4.0;
            mob.burnDmg = skill.burnDmg || 16;
          }
        }
        break;
      }

      case 'thunder_storm': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'thunder_storm', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.chillTimer = 1.5;
          }
        }
        break;
      }

      case 'glacial_comet': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'glacial_comet', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.chillTimer = 4.0;
          }
        }
        break;
      }

      case 'arcane_hyperbeam': {
        const { normX, normY } = computeDashVector();
        const beamDist = skill.distance || 10.0;
        const beamEndX = player.x + normX * beamDist;
        const beamEndY = player.y + normY * beamDist;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'arcane_hyperbeam', skillSlot: slot, cooldown, startX: player.x, startY: player.y, x: beamEndX, y: beamEndY, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = this.distToSegment(mob.x, mob.y, player.x, player.y, beamEndX, beamEndY);
          if (dist <= 1.6) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'time_dilation': {
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '⏳ CHRONOSPHERE (80% Slow & Haste)', color: '#38bdf8', size: 19 });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'time_dilation', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            mob.chillTimer = skill.duration || 4.5;
          }
        }
        break;
      }

      case 'supernova_blast': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'supernova_blast', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.burnTimer = 5.0;
            mob.burnDmg = 25;
          }
        }
        break;
      }

      case 'genesis_cataclysm': {
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.9, text: '✨ CATACLYSM OF GENESIS!', color: '#a855f7', size: 24 });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'genesis_cataclysm', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      // === ROGUE SKILLS ===
      case 'fan_of_knives': {
        const knifeDmgMult = skill.dmgMult + (playerTalents.venomous_knives ? playerTalents.venomous_knives * 0.30 : 0);
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'fan_of_knives', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * knifeDmgMult), true);
            if (playerTalents.venomous_knives) {
              mob.poisonTimer = 4.0;
              mob.poisonDmg = 8 * playerTalents.venomous_knives;
            }
          }
        }
        break;
      }

      case 'toxic_bomb': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        const smokeRad = skill.radius + (playerTalents.noxious_cloud ? playerTalents.noxious_cloud * 0.8 : 0);
        const smokeDmg = (skill.poisonDmg || 9) + (playerTalents.noxious_cloud ? playerTalents.noxious_cloud * 4 : 0);
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'toxic_bomb', skillSlot: slot, cooldown, x: tx, y: ty, radius: smokeRad, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= smokeRad) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
            mob.poisonTimer = skill.poisonDuration || 4.5;
            mob.poisonDmg = smokeDmg;
          }
        }
        break;
      }

      case 'shadow_dash': {
        const { normX, normY } = computeDashVector();
        const startX = player.x, startY = player.y;
        const dashDist = skill.distance || 4.8;
        let newX = startX, newY = startY;
        const steps = Math.floor(dashDist / 0.25);
        for (let s = 1; s <= steps; s++) {
          const tx = startX + normX * (s * 0.25);
          const ty = startY + normY * (s * 0.25);
          if (this.isColliding(tx, ty, player.zone)) break;
          newX = tx; newY = ty;
        }
        player.x = newX; player.y = newY;
        player.targetX = null; player.targetY = null;
        player.facing = this.calculateFacing(startX, startY, newX, newY);
        player.sprintTimer = (skill.sprintDuration || 2.0) + (playerTalents.shadow_sprint ? playerTalents.shadow_sprint * 1.0 : 0);
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = this.distToSegment(mob.x, mob.y, startX, startY, newX, newY);
          if (dist <= 1.4) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'shadow_dash', skillSlot: slot, cooldown, startX, startY, x: newX, y: newY, playerId: player.id });
        break;
      }

      case 'shadowstep': {
        let targetMob = null;
        let minDist = 7.0;
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (dist < minDist) { minDist = dist; targetMob = mob; }
        }
        if (targetMob) {
          const startX = player.x, startY = player.y;
          const behindX = targetMob.x + 0.6;
          const behindY = targetMob.y + 0.6;
          if (!this.isColliding(behindX, behindY, player.zone)) {
            player.x = behindX; player.y = behindY;
          }
          player.facing = this.calculateFacing(player.x, player.y, targetMob.x, targetMob.y);
          applySkillDamage(targetMob, Math.round(player.dmg * skill.dmgMult), true);
          this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'shadowstep', skillSlot: slot, cooldown, startX, startY, x: targetMob.x, y: targetMob.y, playerId: player.id });
        }
        break;
      }

      case 'smoke_screen': {
        player.smokeScreenTimer = skill.duration || 3.5;
        player.sprintTimer = skill.duration || 3.5;
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '🌫️ VANISH! (Stealth & 100% Crit)', color: '#a855f7' });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'smoke_screen', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'death_blossom': {
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'death_blossom', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'poison_darts': {
        const { normX, normY } = computeDashVector();
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'poison_darts', skillSlot: slot, cooldown, x: player.x, y: player.y, dirX: normX, dirY: normY, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (dist <= 5.5) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
            mob.poisonTimer = skill.poisonDuration || 4.0;
            mob.poisonDmg = skill.poisonDmg || 14;
          }
        }
        break;
      }

      case 'caltrops': {
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'caltrops', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
            mob.chillTimer = skill.slowDuration || 4.0;
          }
        }
        break;
      }

      case 'venomous_barrage': {
        const { normX, normY } = computeDashVector();
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'venomous_barrage', skillSlot: slot, cooldown, x: player.x, y: player.y, dirX: normX, dirY: normY, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (dist <= 7.5) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.poisonTimer = 5.0;
            mob.poisonDmg = 18;
          }
        }
        break;
      }

      case 'phantom_assassins': {
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'phantom_assassins', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'assassins_cull': {
        let cullTarget = null;
        let cDist = 4.5;
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const d = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (d < cDist) { cDist = d; cullTarget = mob; }
        }
        if (cullTarget) {
          const isExecute = (cullTarget.hp / cullTarget.maxHp) <= 0.5;
          const executeMult = isExecute ? skill.dmgMult * 2.0 : skill.dmgMult;
          applySkillDamage(cullTarget, Math.round(player.dmg * executeMult), true);
          this.emitZone(player.zone, 'floating_text', { x: cullTarget.x, y: cullTarget.y - 0.8, text: isExecute ? '🩸 EXECUTION CULL (x2 DMG)!' : '🗡️ Cull Strike!', color: '#ef4444', size: isExecute ? 22 : 16 });
          this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'assassins_cull', skillSlot: slot, cooldown, x: cullTarget.x, y: cullTarget.y, playerId: player.id });
        }
        break;
      }

      case 'abyssal_tether': {
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '⛓️ ABYSSAL SHADOW CHAINS (ROOT)', color: '#a855f7', size: 18 });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'abyssal_tether', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            mob.x = player.x + (mob.x - player.x) * 0.25;
            mob.y = player.y + (mob.y - player.y) * 0.25;
            mob.chillTimer = skill.rootDuration || 3.0;
          }
        }
        break;
      }

      case 'blade_dance': {
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'blade_dance', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'eclipse_execution': {
        this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.9, text: '🌑 VOID ECLIPSE OMNISLASH!', color: '#c084fc', size: 24 });
        this.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'eclipse_execution', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }
    }

    // Process Vampiric & Berserk heals (balanced with Max HP caps)
    if (runeId === 'vampiric' && totalDmgDealt > 0) {
      const maxDrain = Math.max(2, Math.round(player.maxHp * 0.08));
      const vHeal = Math.min(maxDrain, Math.max(1, Math.round(totalDmgDealt * 0.05)));
      player.hp = Math.min(player.maxHp, player.hp + vHeal);
      this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.6, text: `+${vHeal} HP (Vampiric Drain)`, color: '#c084fc' });
    }
    if (player.berserkTimer > 0 && totalDmgDealt > 0) {
      const maxBHeal = Math.max(2, Math.round(player.maxHp * 0.06));
      const bHeal = Math.min(maxBHeal, Math.max(1, Math.round(totalDmgDealt * 0.04)));
      player.hp = Math.min(player.maxHp, player.hp + bHeal);
      this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.45, text: `+${bHeal} HP (Lifesteal)`, color: '#ef4444' });
    }

    // Skill Link: the linked skill fires too, with its own MP and cooldown (if
    // it is not ready it simply doesn't cast). A linked skill that also sits in
    // a hotbar slot shares that slot's cooldown, so it can't be used twice.
    const linkedId = !linkedSkillId && player.skillLinks && player.skillLinks[slot];
    if (linkedId && ALL_CLASS_SKILLS[linkedId] && !player.isDead) {
      const shared = ['slot1', 'slot2', 'slot3', 'dash'].find(s => player.equippedSkills[s] === linkedId);
      this.handlePlayerSkill(socketId, { ...skillData, skillSlot: shared || 'link_' + linkedId }, linkedId);
    }
  }

  recalculatePlayerStats(player) {
    if (!player || !player.baseStats) return;

    let totalBonusDmg = 0;
    let totalBonusDef = 0;
    let totalBonusHp = 0;
    let totalBonusMp = 0;
    let totalBonusSpeed = 0;
    let totalBonusAttackSpeed = 0;
    let totalBonusSwipe = 0;
    let totalCritChanceBonus = 0;
    let totalCritDmgBonus = 0;
    let totalThorns = 0;
    let totalDodgeChance = 0;
    let totalLifeSteal = 0;
    const totalElementResist: Record<string, number> = {};

    if (player.equipment) {
      for (const eq of (Object.values(player.equipment) as any[])) {
        if (!eq) continue;
        if (eq.elementResist) {
          for (const [el, val] of Object.entries(eq.elementResist)) {
            totalElementResist[el] = (totalElementResist[el] || 0) + (val as number);
          }
        }
        if (eq.bonusDmg) totalBonusDmg += eq.bonusDmg;
        if (eq.bonusDef) totalBonusDef += eq.bonusDef;
        if (eq.bonusHp) totalBonusHp += eq.bonusHp;
        if (eq.bonusMp) totalBonusMp += eq.bonusMp;
        if (eq.bonusSpeed) totalBonusSpeed += eq.bonusSpeed;
        if (eq.bonusAttackSpeed) totalBonusAttackSpeed += eq.bonusAttackSpeed;
        if (eq.bonusSwipe) totalBonusSwipe += eq.bonusSwipe;

        // Hypixel Skyblock Reforge Modifier Stats
        if (eq.reforgeStats) {
          if (eq.reforgeStats.bonusDmg) totalBonusDmg += eq.reforgeStats.bonusDmg;
          if (eq.reforgeStats.bonusDef) totalBonusDef += eq.reforgeStats.bonusDef;
          if (eq.reforgeStats.bonusHp) totalBonusHp += eq.reforgeStats.bonusHp;
          if (eq.reforgeStats.bonusMp) totalBonusMp += eq.reforgeStats.bonusMp;
          if (eq.reforgeStats.bonusSpeed) totalBonusSpeed += eq.reforgeStats.bonusSpeed;
          if (eq.reforgeStats.bonusAttackSpeed) totalBonusAttackSpeed += eq.reforgeStats.bonusAttackSpeed;
          if (eq.reforgeStats.bonusSwipe) totalBonusSwipe += eq.reforgeStats.bonusSwipe;
          if (eq.reforgeStats.critChance) totalCritChanceBonus += eq.reforgeStats.critChance / 100;
          if (eq.reforgeStats.critDmg) totalCritDmgBonus += eq.reforgeStats.critDmg / 100;
        }
      }
    }

    // Talent tree passive bonuses
    const procs = {};
    if (player.skills) {
      const tree = SKILL_TREES[player.characterClass] || [];
      for (const talent of tree) {
        const rank = player.skills[talent.id] || 0;
        if (rank > 0 && talent.effects) {
          for (const stat of Object.keys(TALENT_PROCS.base)) {
            if (talent.effects[stat]) procs[stat] = (procs[stat] || 0) + talent.effects[stat] * rank;
          }
          if (talent.effects.bonusDmg) totalBonusDmg += talent.effects.bonusDmg * rank;
          if (talent.effects.bonusDef) totalBonusDef += talent.effects.bonusDef * rank;
          if (talent.effects.bonusHp) totalBonusHp += talent.effects.bonusHp * rank;
          if (talent.effects.bonusMp) totalBonusMp += talent.effects.bonusMp * rank;
          if (talent.effects.bonusSpeed) totalBonusSpeed += talent.effects.bonusSpeed * rank;
          if (talent.effects.bonusAttackSpeed) totalBonusAttackSpeed += talent.effects.bonusAttackSpeed * rank;
          if (talent.effects.bonusSwipe) totalBonusSwipe += talent.effects.bonusSwipe * rank;
          if (talent.effects.critChanceBonus) totalCritChanceBonus += talent.effects.critChanceBonus * rank;
          if (talent.effects.critDmgBonus) totalCritDmgBonus += talent.effects.critDmgBonus * rank;
          if (talent.effects.thorns) totalThorns += talent.effects.thorns * rank;
          if (talent.effects.dodgeChance) totalDodgeChance += talent.effects.dodgeChance * rank;
          if (talent.effects.lifeSteal) totalLifeSteal += talent.effects.lifeSteal * rank;
        }
      }
    }

    // Job level bonus
    const jobSteps = Math.max(0, (player.jobLevel || 1) - 1);
    totalBonusDmg += jobSteps * SP.JOB_LEVEL_BONUS.bonusDmg;
    totalBonusHp += jobSteps * SP.JOB_LEVEL_BONUS.bonusHp;
    totalBonusMp += jobSteps * SP.JOB_LEVEL_BONUS.bonusMp;

    // Specialist card stats apply only while transformed
    const spCard = player.equipment && player.equipment.sp;
    if (player.spTransformed && spCard) {
      const cs: any = SP.cardStats(spCard.cardId, spCard.upgradeLevel || 0);
      totalBonusDmg += cs.bonusDmg || 0;
      totalBonusDef += cs.bonusDef || 0;
      totalBonusHp += cs.bonusHp || 0;
      totalBonusMp += cs.bonusMp || 0;
      totalBonusSpeed += cs.bonusSpeed || 0;
      totalBonusAttackSpeed += cs.bonusAttackSpeed || 0;
      totalCritChanceBonus += (cs.critChance || 0) / 100;
    }
    if (player.bloodlust) totalBonusAttackSpeed += player.bloodlust.atkSpeed || 0;

    // Combat Mastery multiplies every source of damage at high level
    player.mastery = Number(masteryMult(player.level).toFixed(2));
    player.dmg = Math.round((player.baseStats.dmg + totalBonusDmg) * player.mastery);
    player.def = player.baseStats.def + totalBonusDef;
    player.maxHp = player.baseStats.maxHp + totalBonusHp;
    player.maxMp = player.baseStats.maxMp + totalBonusMp;
    player.manaCostMult = Number((MANA_COST_SCALE * (1 + MANA_COST_PER_LEVEL * ((player.level || 1) - 1))).toFixed(3));
    player.speed = Number((player.baseStats.speed + totalBonusSpeed).toFixed(2));
    player.attackSpeed = Number(((player.baseStats.attackSpeed || 1.0) + totalBonusAttackSpeed).toFixed(2));
    player.swipe = Math.round((player.baseStats.swipe || 0) + totalBonusSwipe);
    player.critChanceBonus = Math.min(0.75, Number(totalCritChanceBonus.toFixed(3)));
    player.critDmgBonus = Number(totalCritDmgBonus.toFixed(3));
    player.thorns = Math.round(totalThorns);
    player.dodgeChance = Math.min(0.50, Number(totalDodgeChance.toFixed(3)));
    player.lifeSteal = Math.min(0.08, Number(totalLifeSteal.toFixed(3)));
    // Branch mechanics (burn, chill, echo, venom): the first rank unlocks the base strength
    player.talentProcs = {};
    for (const [stat, v] of Object.entries(procs)) {
      player.talentProcs[stat] = Number((TALENT_PROCS.base[stat] + v).toFixed(4));
    }
    // Elemental resistance from gear, capped so no element is fully negated
    player.elementResist = {};
    for (const [el, val] of Object.entries(totalElementResist)) {
      player.elementResist[el] = Number(Math.min(MAX_PLAYER_ELEMENT_RESIST, val as number).toFixed(2));
    }

    player.hp = Math.min(player.hp, player.maxHp);
    player.mp = Math.min(player.mp, player.maxMp);
  }

  handleEquipItem(socketId, itemIndex) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    if (itemIndex < 0 || itemIndex >= player.inventory.items.length) return;
    const item = player.inventory.items[itemIndex];
    if (item && item.type === 'sp_card') return this.equipSpCard(player, itemIndex);
    if (!item || item.type !== 'equipment' || !item.slot) return;

    const cls = requiredClass(item);
    if (cls && cls !== player.characterClass) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `Only a ${cls} can use this weapon!`, color: '#ef4444' });
      return;
    }

    const slot = item.slot;
    const oldEquipped = player.equipment[slot];

    // Remove 1 from inventory
    if (item.count > 1) {
      item.count--;
    } else {
      player.inventory.items.splice(itemIndex, 1);
    }

    // If an item was previously equipped in this slot, return it to inventory
    if (oldEquipped) {
      const existing = player.inventory.items.find(i => i.id === oldEquipped.id);
      if (existing && existing.type !== 'equipment') {
        existing.count = (existing.count || 1) + 1;
      } else {
        player.inventory.items.push({ ...oldEquipped, count: 1 });
      }
    }

    // Equip the new item
    player.equipment[slot] = { ...item, count: 1 };
    this.recalculatePlayerStats(player);

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: `⚔️ Equipped ${item.name}!`,
        color: '#4ade80'
      });
    }

    this.broadcastSystemMessage(`🛡️ [${player.name}] equipped [${item.name}]!`);
  }

  handleUnequipItem(socketId, slot) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;
    if (slot === 'sp' && player.spTransformed) this.setTransformed(player, false);

    if (!player.equipment || !player.equipment[slot]) return;
    const item = player.equipment[slot];

    // Check bag capacity (limit to 30 items)
    if (player.inventory.items.length >= 30) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: `⚠️ Inventory is full!`,
          color: '#ef4444'
        });
      }
      return;
    }

    player.equipment[slot] = null;
    player.inventory.items.push({ ...item, count: 1 });
    this.recalculatePlayerStats(player);

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: `Unequipped ${item.name}`,
        color: '#94a3b8'
      });
    }
  }

  // Merchant Shop Actions: Buy & Sell
  handleBuyItem(socketId, itemId, count = 1) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    const qty = Math.max(1, Math.min(999, parseInt(String(count), 10) || 1));
    const itemDef = ITEMS[itemId];
    if (!itemDef || !itemDef.buyPrice || itemDef.type !== 'consumable') return;

    const totalPrice = itemDef.buyPrice * qty;
    const socket = this.io.sockets.sockets.get(socketId);

    if (player.gold < totalPrice) {
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.6,
          text: `⚠️ Need ${totalPrice} Gold! (Have ${player.gold})`,
          color: '#ef4444'
        });
      }
      return;
    }

    player.gold -= totalPrice;

    if (itemDef.id === 'health_potion') {
      player.inventory.healthPotions = (player.inventory.healthPotions || 0) + qty;
    } else if (itemDef.id === 'mana_potion') {
      player.inventory.manaPotions = (player.inventory.manaPotions || 0) + qty;
    } else {
      const existing = player.inventory.items.find(i => i.id === itemDef.id);
      if (existing) {
        existing.count = (existing.count || 1) + qty;
      } else {
        player.inventory.items.push({ ...itemDef, count: qty });
      }
    }

    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.6,
        text: `Bought ${itemDef.name} x${qty}! (-${totalPrice}g)`,
        color: '#facc15'
      });
    }
  }

  handleSellItem(socketId, itemIndex, quantity = 1) {
    const player = this.players.get(socketId);
    if (!player || player.isDead || player.zone !== 'town') return;

    if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= player.inventory.items.length) return;

    const item = player.inventory.items[itemIndex];
    const stackCount = item.count || 1;
    const sellCount = Math.max(1, Math.min(stackCount, parseInt(String(quantity), 10) || 1));
    const sellPrice = (item.sellPrice || 10) * sellCount;

    player.gold += sellPrice;

    if (stackCount > sellCount) {
      item.count = stackCount - sellCount;
    } else {
      player.inventory.items.splice(itemIndex, 1);
    }

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.6,
        text: `+${sellPrice} Gold (Sold ${sellCount > 1 ? `${sellCount}x ` : ''}${item.name})`,
        color: '#facc15'
      });
    }
  }

  // Sell several bag slots at once: entries = [{ itemIndex, quantity }]
  handleSellItems(socketId, entries) {
    const player = this.players.get(socketId);
    if (!player || player.isDead || player.zone !== 'town') return;
    if (!Array.isArray(entries) || entries.length === 0) return;

    const items = player.inventory.items;
    const qtyByIndex = new Map<any, any>();
    for (const e of entries.slice(0, items.length)) {
      if (!e || !Number.isInteger(e.itemIndex) || e.itemIndex < 0 || e.itemIndex >= items.length) continue;
      const item = items[e.itemIndex];
      // Special Cards are protected and will never be sold via Sell All / bulk selling
      if (item && (item.type === 'sp_card' || (item.id && item.id.startsWith('sp_card_')))) continue;
      qtyByIndex.set(e.itemIndex, e.quantity);
    }
    if (qtyByIndex.size === 0) return;

    let total = 0;
    let soldCount = 0;
    // Highest index first so splicing does not shift the slots still to be sold
    for (const index of [...qtyByIndex.keys()].sort((a, b) => b - a)) {
      const item = items[index];
      const stackCount = item.count || 1;
      const sellCount = Math.max(1, Math.min(stackCount, parseInt(qtyByIndex.get(index), 10) || 1));
      total += (item.sellPrice || 10) * sellCount;
      soldCount += sellCount;
      if (stackCount > sellCount) item.count = stackCount - sellCount;
      else items.splice(index, 1);
    }
    player.gold += total;

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.6,
        text: `+${total} Gold (Sold ${soldCount} item${soldCount > 1 ? 's' : ''})`,
        color: '#facc15'
      });
    }
  }

  // Hypixel Skyblock Reforge Anvil Actions (Brom the Master Smith)
  handleReforgeItem(socketId, data) {
    const player = this.players.get(socketId);
    if (!player || player.isDead || player.zone !== 'town') return;

    let targetItem = null;
    let isEquipped = false;

    if (data.target === 'equipped') {
      if (player.equipment && player.equipment[data.slot]) {
        targetItem = player.equipment[data.slot];
        isEquipped = true;
      }
    } else if (data.target === 'inventory') {
      if (player.inventory && player.inventory.items && player.inventory.items[data.itemIndex]) {
        targetItem = player.inventory.items[data.itemIndex];
      }
    }

    if (!targetItem || targetItem.type !== 'equipment') return;

    const rarity = targetItem.rarity || 'common';
    const reforgeCost = REFORGE_COSTS[rarity] || 50;
    const socket = this.io.sockets.sockets.get(socketId);

    if (player.gold < reforgeCost) {
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: `⚠️ ต้องการ ${reforgeCost} Gold!`,
          color: '#ef4444'
        });
      }
      return;
    }

    // Deduct reforge fee
    player.gold -= reforgeCost;

    // Roll Hypixel Skyblock Reforge
    const rolledReforge = rollSkyblockReforge(targetItem);
    if (!rolledReforge) return;

    applySkyblockReforge(targetItem, rolledReforge);
    this.applyItemUpgradeStats(targetItem);

    if (isEquipped) {
      this.recalculatePlayerStats(player);
    }

    this.savePlayerAccount(socketId);

    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('reforge_result', {
        success: true,
        item: targetItem,
        reforge: rolledReforge,
        reforgeStats: targetItem.reforgeStats,
        cost: reforgeCost,
        target: data.target,
        slot: data.slot,
        itemIndex: data.itemIndex
      });
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.8,
        text: `🔨 REFORGED: ${rolledReforge}!`,
        color: '#facc15',
        size: 20
      });
    }

    this.emitZone(player.zone, 'skill_fx', {
      type: 'whirlwind',
      x: player.x,
      y: player.y,
      radius: 1.5,
      playerId: player.id
    });

    if (targetItem.rarity === 'legendary' || targetItem.rarity === 'epic') {
      this.broadcastSystemMessage(`🌟 [${player.name}] reforged [${targetItem.name}] with [${rolledReforge}] at Brom's Anvil!`);
    }
  }

  applyItemUpgradeStats(item) {
    if (!item) return;
    const lvl = item.upgradeLevel || 0;
    if (item.baseBonusDmg === undefined) item.baseBonusDmg = item.bonusDmg || 0;
    if (item.baseBonusDef === undefined) item.baseBonusDef = item.bonusDef || 0;
    if (item.baseBonusHp === undefined) item.baseBonusHp = item.bonusHp || 0;
    if (item.baseBonusMp === undefined) item.baseBonusMp = item.bonusMp || 0;
    if (item.baseBonusSpeed === undefined) item.baseBonusSpeed = item.bonusSpeed || 0;
    if (item.baseBonusAttackSpeed === undefined) item.baseBonusAttackSpeed = item.bonusAttackSpeed || 0;
    if (item.baseBonusSwipe === undefined) item.baseBonusSwipe = item.bonusSwipe || 0;
    if (!item.baseName) item.baseName = item.name.replace(/\s\+\d+$/, '');

    let addDmg = 0, addDef = 0, addHp = 0, addMp = 0, addSpeed = 0, addAtkSpd = 0, addSwipe = 0;
    // Each level also adds a share of the item's own base stats
    const pct = lvl * 0.05;
    addDmg += Math.round(item.baseBonusDmg * pct);
    addDef += Math.round(item.baseBonusDef * pct);
    addHp += Math.round(item.baseBonusHp * pct);
    addMp += Math.round(item.baseBonusMp * pct);
    if (item.slot === 'weapon') {
      addDmg += lvl * 4;
      addSwipe = lvl * 3;
      addAtkSpd = lvl * 0.02;
    } else if (item.slot === 'armor') {
      addDef += lvl * 2;
      addHp += lvl * 25;
    } else if (item.slot === 'helmet') {
      addDef += lvl * 2;
      addHp += lvl * 15;
      addMp += lvl * 10;
    } else if (item.slot === 'boots') {
      addDef += lvl * 1;
      addSpeed = lvl * 0.08;
      addHp += lvl * 10;
    } else if (item.slot === 'ring') {
      addDmg += lvl * 3;
      addHp += lvl * 15;
      addMp += lvl * 15;
      addAtkSpd = lvl * 0.01;
    }

    item.bonusDmg = item.baseBonusDmg + addDmg;
    item.bonusDef = item.baseBonusDef + addDef;
    item.bonusHp = item.baseBonusHp + addHp;
    item.bonusMp = item.baseBonusMp + addMp;
    item.bonusSpeed = Number((item.baseBonusSpeed + addSpeed).toFixed(2));
    item.bonusAttackSpeed = Number((item.baseBonusAttackSpeed + addAtkSpd).toFixed(2));
    item.bonusSwipe = Math.round(item.baseBonusSwipe + addSwipe);
    const named = item.reforge ? `${item.reforge} ${item.baseName}` : item.baseName;
    item.name = lvl > 0 ? `${named} +${lvl}` : named;
  }

  // Enchanter: try to raise an item's +level. Gold is spent either way; from
  // +${ENHANCE_SAFE_LEVEL} upward a failure also drops the item one level.
  handleEnhanceItem(socketId, data) {
    const player = this.players.get(socketId);
    const socket = this.io.sockets.sockets.get(socketId);
    if (!player || !socket || player.isDead || player.zone !== 'town' || !data) return;

    let item = null;
    let isEquipped = false;
    if (data.target === 'equipped' && player.equipment && player.equipment[data.slot]) {
      item = player.equipment[data.slot];
      isEquipped = true;
    } else if (data.target === 'inventory' && Number.isInteger(data.itemIndex)) {
      item = player.inventory.items[data.itemIndex] || null;
    }
    if (!item || item.type !== 'equipment') return;

    const lvl = item.upgradeLevel || 0;
    const fail = (text) => socket.emit('enhance_result', { ok: false, message: text });
    if (lvl >= ENHANCE_MAX) return fail(`Already at the maximum +${ENHANCE_MAX}!`);
    const cost = enhanceCost(item);
    if (player.gold < cost) return fail(`Need ${cost.toLocaleString()} Gold!`);

    player.gold -= cost;
    const chance = enhanceChance(item);
    const success = Math.random() < chance;
    let downgraded = false;
    if (success) {
      item.upgradeLevel = lvl + 1;
    } else if (lvl >= ENHANCE_SAFE_LEVEL) {
      item.upgradeLevel = lvl - 1;
      downgraded = true;
    }
    this.applyItemUpgradeStats(item);
    if (isEquipped) this.recalculatePlayerStats(player);
    this.savePlayerAccount(socketId);

    socket.emit('player_updated', player);
    socket.emit('enhance_result', { ok: true, success, downgraded, level: item.upgradeLevel || 0, cost, item, target: data.target, slot: data.slot, itemIndex: data.itemIndex });
    this.emitZone(player.zone, 'floating_text', {
      x: player.x, y: player.y - 0.8,
      text: success ? `ENHANCED +${item.upgradeLevel}!` : downgraded ? `FAILED - dropped to +${item.upgradeLevel}` : 'ENHANCE FAILED',
      color: success ? '#facc15' : '#ef4444', size: 20
    });
    if (success && item.upgradeLevel >= 10) {
      this.broadcastSystemMessage(`[${player.name}] enhanced [${item.name}] to +${item.upgradeLevel}!`);
    }
  }

  getPotionSlots(player) {
    if (!player.inventory.potionSlots) {
      player.inventory.potionSlots = { health: 'health_potion', mana: 'mana_potion' };
    }
    return player.inventory.potionSlots;
  }

  getPotionCount(player, itemId) {
    if (itemId === 'health_potion') return player.inventory.healthPotions || 0;
    if (itemId === 'mana_potion') return player.inventory.manaPotions || 0;
    const stack = player.inventory.items.find(i => i.id === itemId);
    return stack ? (stack.count || 1) : 0;
  }

  consumePotion(player, itemId) {
    if (itemId === 'health_potion') { player.inventory.healthPotions--; return; }
    if (itemId === 'mana_potion') { player.inventory.manaPotions--; return; }
    const idx = player.inventory.items.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    const stack = player.inventory.items[idx];
    if ((stack.count || 1) > 1) stack.count--;
    else player.inventory.items.splice(idx, 1);
  }

  // potionType: 'health' | 'mana' drinks the potion assigned to that quick slot;
  // { itemId } drinks that specific potion (clicked in the bag).
  handleUsePotion(socketId, potionType) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    const slots = this.getPotionSlots(player);
    let itemId = null;
    if (potionType === 'health' || potionType === 'mana') itemId = slots[potionType];
    else if (potionType && typeof potionType.itemId === 'string') itemId = potionType.itemId;
    const potion = POTIONS[itemId];
    if (!potion) return;

    const socket = this.io.sockets.sockets.get(socketId);
    if (this.getPotionCount(player, itemId) <= 0) {
      if (socket) socket.emit('floating_text', { x: player.x, y: player.y - 0.6, text: `⚠️ Out of ${ITEMS[itemId].name}!`, color: '#ef4444' });
      return;
    }

    if (potion.kind === 'health') {
      if (player.hp >= player.maxHp) return;
      this.consumePotion(player, itemId);
      const healAmount = Math.round(player.maxHp * potion.pct);
      player.hp = Math.min(player.maxHp, player.hp + healAmount);

      this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.5, text: `+${healAmount} HP`, color: '#4ade80' });
      this.emitZone(player.zone, 'heal_fx', { targetId: player.id, type: 'health' });
    } else {
      if (player.mp >= player.maxMp) return;
      this.consumePotion(player, itemId);
      const manaAmount = Math.round(player.maxMp * potion.pct);
      player.mp = Math.min(player.maxMp, player.mp + manaAmount);

      this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.5, text: `+${manaAmount} MP`, color: '#38bdf8' });
      this.emitZone(player.zone, 'heal_fx', { targetId: player.id, type: 'mana' });
    }
    if (socket) socket.emit('player_updated', player);
  }

  // Choose which potion the HP / MP quick slot drinks
  handleSetPotionSlot(socketId, data) {
    const player = this.players.get(socketId);
    if (!player || !data) return;
    const potion = POTIONS[data.itemId];
    if (!potion || potion.kind !== data.kind) return;
    this.getPotionSlots(player)[data.kind] = data.itemId;
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) socket.emit('player_updated', player);
  }

  applyStatusEffect(player, type, duration, value) {
    if (!player || player.isDead) return;
    if (!player.statusEffects) player.statusEffects = [];

    const existing = player.statusEffects.find(e => e.type === type);
    if (existing) {
      existing.duration = Math.max(existing.duration, duration);
      existing.value = Math.max(existing.value, value);
    } else {
      player.statusEffects.push({
        type,
        duration,
        value,
        tickTimer: 0.8
      });

      const icon = type === 'poison' ? '☠️' : type === 'burn' ? '🔥' : '❄️';
      const color = type === 'poison' ? '#22c55e' : type === 'burn' ? '#f97316' : '#38bdf8';
      this.emitZone(player.zone, 'floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: `${icon} ${type.toUpperCase()}!`,
        color,
        size: 15
      });
    }
  }

  // Add one loot entry ({ type: 'gold', amount } or { itemId, amount, customItemData })
  // to the player's purse / inventory, with a floating pickup label.
  giveLootToPlayer(player, entry, showText = true) {
    const text = (label, color) => {
      if (showText) this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.6, text: label, color });
    };
    if (entry.type === 'gold') {
      player.gold += entry.amount;
      text(`+${entry.amount} Gold`, '#facc15');
    } else if (entry.itemId === 'health_potion') {
      player.inventory.healthPotions += (entry.amount || 1);
      text(`+${entry.amount || 1} Health Potion`, '#f87171');
    } else if (entry.itemId === 'mana_potion') {
      player.inventory.manaPotions += (entry.amount || 1);
      text(`+${entry.amount || 1} Mana Potion`, '#60a5fa');
    } else {
      // Collectible Relic / Equipment / Consumables
      const def = entry.customItemData || ITEMS[entry.itemId];
      if (def) {
        const n = entry.amount || 1;
        const existing = player.inventory.items.find(i => i.id === def.id && !def.custom);
        if (existing && def.type !== 'equipment') {
          existing.count = (existing.count || 1) + n;
        } else {
          player.inventory.items.push({ ...def, count: def.type === 'equipment' ? 1 : n });
        }
        text(`+${def.name}`, def.rarity === 'legendary' ? '#f59e0b' : def.rarity === 'epic' ? '#a855f7' : def.rarity === 'rare' ? '#38bdf8' : '#4ade80');
      }
    }
  }

  lootEntryName(entry) {
    if (entry.type === 'gold') return `${entry.amount} Gold`;
    const def = entry.customItemData || ITEMS[entry.itemId];
    const name = def ? def.name : entry.itemId;
    return (entry.amount || 1) > 1 ? `${name} x${entry.amount}` : name;
  }

  lootEntryToItem(entry) {
    if (!entry) return null;
    if (entry.type === 'gold') {
      return { id: 'gold', name: `${entry.amount} Gold`, count: entry.amount, type: 'gold', rarity: 'common' };
    }
    if (entry.itemId === 'health_potion') {
      return { id: 'health_potion', name: 'Health Potion', count: entry.amount || 1, type: 'consumable', rarity: 'common', desc: 'Restores 60 Health instantly.' };
    }
    if (entry.itemId === 'mana_potion') {
      return { id: 'mana_potion', name: 'Mana Potion', count: entry.amount || 1, type: 'consumable', rarity: 'common', desc: 'Restores 50 Mana instantly.' };
    }
    const def = entry.customItemData || ITEMS[entry.itemId];
    if (def) {
      return { ...def, count: entry.amount || 1 };
    }
    return { id: entry.itemId || 'unknown', name: this.lootEntryName(entry), count: entry.amount || 1, rarity: 'common' };
  }

  emitDungeonRunUpdate(player: any, socket?: any) {
    socket = socket || this.io.sockets.sockets.get(player.id);
    if (!socket) return;
    const run = player.dungeonRun;
    const inst = this.getPlayerDungeonInstance(player);
    socket.emit('dungeon_run_update', run ? {
      active: true,
      cleared: run.cleared,
      gold: run.gold,
      items: run.items.map(it => this.lootEntryName(it)),
      lootItems: run.items.map(it => this.lootEntryToItem(it)),
      startedAt: run.startedAt,
      serverNow: Date.now(),
      clearedMs: run.clearedAt ? run.clearedAt - run.startedAt : null,
      floor: run.floor,
      difficulty: run.difficulty,
      deaths: run.deaths || 0,
      roomsCleared: inst && inst.roomsCleared ? inst.roomsCleared.size : 0,
      roomsTotal: inst && inst.dungeon.rooms ? inst.dungeon.rooms.length : 0,
      clearedRooms: inst && inst.roomsCleared ? [...inst.roomsCleared] : [] // minimap ticks
    } : { active: false });
  }

  // Boss defeated: everything in the loot bag is secured immediately.
  completeDungeonRun(player) {
    const run = player.dungeonRun;
    if (!run || run.cleared) return;
    run.cleared = true;
    run.clearedAt = Date.now();
    const secured = [];
    const securedItems = [];
    if (run.gold > 0) {
      this.giveLootToPlayer(player, { type: 'gold', amount: run.gold }, false);
      secured.push(`${run.gold} Gold`);
      securedItems.push({ id: 'gold', name: `${run.gold} Gold`, count: run.gold, type: 'gold', rarity: 'common' });
    }
    run.items.forEach(it => {
      this.giveLootToPlayer(player, it, false);
      secured.push(this.lootEntryName(it));
      securedItems.push(this.lootEntryToItem(it));
    });
    const chestGold = run.gold;
    run.gold = 0;
    run.items = [];

    // Grade the clear: deaths and running over par time cost points
    const inst = this.getPlayerDungeonInstance(player);
    const roomsTotal = inst && inst.dungeon.rooms ? inst.dungeon.rooms.length : 0;
    const timeMs = Date.now() - (run.startedAt || Date.now());
    const parSec = RUN_PAR_BASE_SEC + roomsTotal * RUN_PAR_PER_ROOM_SEC;
    const overPar = Math.max(0, timeMs / 1000 - parSec) / parSec;
    const score = 100 - (run.deaths || 0) * 12 - Math.min(40, overPar * 40);
    const rank = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : 'C';
    const mult = RUN_RANK_MULT[rank];
    const bonusGold = Math.round(run.floor * 120 * mult);
    const bonusExp = Math.round((player.expNext || 100) * 0.06 * mult);
    const runExp = run.exp || 0;
    player.gold += bonusGold;
    this.awardExp(player, bonusExp);

    const floorConfig: any = DUNGEON_FLOORS[run.floor - 1] || {};
    const socket = this.io.sockets.sockets.get(player.id);
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
    this.emitDungeonRunUpdate(player, socket);
  }

  // Leaving the dungeon. Without a boss kill the run counts as failed and only
  // FAILED_RUN_LOOT_KEEP of the escrowed chest loot is kept.
  endDungeonRun(player, socket) {
    const run = player.dungeonRun;
    player.dungeonRun = null;
    socket = socket || this.io.sockets.sockets.get(player.id);
    if (!run) return;
    if (run.cleared) {
      this.emitDungeonRunUpdate(player, socket);
      return;
    }

    const kept = [];
    const lost = [];
    const keptItems = [];
    const lostItems = [];
    const keptGold = Math.floor(run.gold * FAILED_RUN_LOOT_KEEP);
    if (keptGold > 0) {
      this.giveLootToPlayer(player, { type: 'gold', amount: keptGold }, false);
      kept.push(`${keptGold} Gold`);
      keptItems.push({ id: 'gold', name: `${keptGold} Gold`, count: keptGold, type: 'gold', rarity: 'common' });
    }
    if (run.gold - keptGold > 0) {
      const lostGold = run.gold - keptGold;
      lost.push(`${lostGold} Gold`);
      lostItems.push({ id: 'gold', name: `${lostGold} Gold`, count: lostGold, type: 'gold', rarity: 'common' });
    }

    const shuffled = [...run.items].sort(() => Math.random() - 0.5);
    const keepCount = Math.floor(shuffled.length * FAILED_RUN_LOOT_KEEP);
    shuffled.forEach((it, i) => {
      const itemObj = this.lootEntryToItem(it);
      if (i < keepCount) {
        this.giveLootToPlayer(player, it, false);
        kept.push(this.lootEntryName(it));
        if (itemObj) keptItems.push(itemObj);
      } else {
        lost.push(this.lootEntryName(it));
        if (itemObj) lostItems.push(itemObj);
      }
    });

    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('dungeon_result', { success: false, kept, lost, keptItems, lostItems });
    }
    this.broadcastSystemMessage(`💀 [${player.name}] failed the dungeon run on B${run.floor}.`);
    this.emitDungeonRunUpdate(player, socket);
  }

  handlePickupItem(socketId, itemId) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    const itemsMap = this.getGroundItemsMap(player.zone);
    const item = itemsMap.get(itemId);
    if (!item) return;

    const dist = Math.hypot(item.x - player.x, item.y - player.y);
    if (dist <= 2.2) {
      this.giveLootToPlayer(player, item);

      itemsMap.delete(itemId);
      this.emitZone(player.zone, 'item_picked', { itemId, pickerId: player.id });

      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) socket.emit('player_updated', player);
    }
  }

  handleChatMessage(socketId, message) {
    const player = this.players.get(socketId);
    if (!player) return;

    const text = (message || '').trim().substring(0, 100);
    if (!text) return;

    if (text.startsWith('/')) {
      const handled = adminCommands.handleCommand(this, player, text);
      if (handled) return;
    }

    player.speechBubble = text;
    player.speechTimer = 5.0;

    this.io.emit('chat_broadcast', {
      senderId: player.id,
      senderName: player.name,
      senderClass: player.characterClass,
      text,
      timestamp: Date.now()
    });
  }

  spawnProjectile(caster, targetX, targetY, targetId, targetType, damage, opts: any = {}) {
    const element = (caster.equipment && caster.equipment.weapon && caster.equipment.weapon.element) || 'neutral';
    const id = `proj_${this.nextEntityId++}`;
    let dx = (targetX !== undefined ? targetX : caster.x) - caster.x;
    let dy = (targetY !== undefined ? targetY : caster.y) - caster.y;
    let angle = Math.atan2(dy, dx);
    if (Math.hypot(dx, dy) < 0.001) {
      const facingAngles = { E: 0, SE: Math.PI / 4, S: Math.PI / 2, SW: 3 * Math.PI / 4, W: Math.PI, NW: -3 * Math.PI / 4, N: -Math.PI / 2, NE: -Math.PI / 4 };
      angle = facingAngles[caster.facing] !== undefined ? facingAngles[caster.facing] : 0;
    }
    const speed = 9.0;
    // a transformed mage throws its card's own bolt (drawn per card on the client)
    const cardId = caster.spTransformed && caster.equipment && caster.equipment.sp ? caster.equipment.sp.cardId : null;

    this.projectiles.set(id, {
      cardId,
      instanceId: caster.zone === 'dungeon' ? (caster.dungeonInstanceId || null) : null,
      id,
      zone: caster.zone,
      casterId: caster.id,
      x: caster.x,
      y: caster.y,
      targetX,
      targetY,
      targetId,
      targetType,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      splash: opts.splash || 0,
      crit: !!opts.crit,
      element,
      life: 2.0,
      color: '#f97316'
    });

    this.emitZone(caster.zone, 'projectile_spawned', {
      id,
      zone: caster.zone,
      x: caster.x,
      y: caster.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      casterId: caster.id,
      element,
      cardId,
      splash: opts.splash || 0,
      color: '#f97316'
    });
  }

  // Area burst around a projectile's impact (mage basic attack)
  applyProjectileSplash(caster, proj, primary, mobsMap) {
    const splashDmg = Math.max(1, Math.round(proj.damage * proj.splash));
    for (const other of mobsMap.values()) {
      if (other === primary || other.state === 'dead') continue;
      if (Math.hypot(other.x - primary.x, other.y - primary.y) > MAGE_SPLASH_RADIUS) continue;
      this.applyDamageToMob(caster, other, splashDmg, false);
    }
  }

  // isEcho: a Void Echo repeat hit, which must not trigger talent procs again
  applyDamageToMob(player, mob, baseDamage, isCritical = false, isEcho = false) {
    if (mob.spawnUntil && Date.now() < mob.spawnUntil) return; // still rising: untouchable
    const variation = (Math.random() * 0.4) - 0.2;
    let rawDamage = Math.round(baseDamage * (1 + variation));

    // Weapon Element vs Monster Element / Resist
    const spEl = player && player.spTransformed && player.equipment && player.equipment.sp && SP.CARD_BY_ID[player.equipment.sp.cardId];
    const atkElement = spEl ? spEl.element
      : (player && player.equipment && player.equipment.weapon && player.equipment.weapon.element)
        ? player.equipment.weapon.element
        : 'neutral';
    const mobElement = mob.element || 'neutral';
    const mobResists = mob.elementResist || {};
    const elemMult = calculateElementalMultiplier(atkElement, mobElement, mobResists);
    rawDamage = Math.max(1, Math.round(rawDamage * elemMult));

    // Cryomancer Frostbite: chilled enemies take extra damage
    const procs = player && player.talentProcs;
    if (procs && procs.shatterBonus && mob.chillTimer > 0) {
      rawDamage = Math.round(rawDamage * (1 + procs.shatterBonus));
    }

    // Level Gap Mitigation & Deflection
    let isGlancing = false;
    let isDeflected = false;
    if (player && mob.level && player.level) {
      const levelGap = mob.level - player.level;
      if (levelGap >= 20) {
        // Enormous level gap: attacks deflect completely!
        isDeflected = true;
        isCritical = false;
      } else if (levelGap > 3) {
        // High level gap: glancing blows and steep defense penalty
        isGlancing = true;
        const penaltyMult = Math.pow(0.85, levelGap - 3);
        rawDamage = Math.max(1, Math.round(rawDamage * penaltyMult));
        if (levelGap >= 8) {
          isCritical = false; // Cannot score critical hits on foes 8+ levels higher
        }
      }
    }

    if (isCritical) {
      const critMultiplier = 1.5 + (player && player.critDmgBonus ? player.critDmgBonus : 0);
      rawDamage = Math.round(rawDamage * critMultiplier);
    }

    // Mob defense removes a share of every hit (see MOB_DEF_K)
    const mobDef = (mob.def || 0) + (mob.hasCommanderBuff ? 8 : 0);
    let damage = isDeflected ? 1 : Math.max(1, Math.round(rawDamage * MOB_DEF_K / (MOB_DEF_K + mobDef)));

    // Fortified affix absorbs 30% damage
    if (mob.buffs && mob.buffs.includes('fortified')) {
      damage = Math.max(1, Math.round(damage * 0.7));
    }

    mob.hp -= damage;
    mob.state = 'chase';
    mob.targetPlayerId = player ? player.id : null;
    if (player) mob.lastHitBy = player.id; // burn / poison kills are credited to them

    // Field raid boss: feed the live leaderboard (actual damage dealt)
    if (mob.isRaidBoss && player) {
      this.recordRaidDamage(mob.fieldZone || player.zone, player.id, damage);
    }

    // Apply Talent Life Steal (balanced with per-hit cap and throttled floating text)
    if (player && player.lifeSteal && player.lifeSteal > 0 && damage > 0 && !isDeflected) {
      const maxLeech = Math.max(2, Math.round(player.maxHp * 0.04));
      const leech = Math.min(maxLeech, Math.max(1, Math.round(damage * player.lifeSteal)));
      player.hp = Math.min(player.maxHp, player.hp + leech);
      const now = Date.now();
      if (!player._lastLeechText || now - player._lastLeechText > 250) {
        player._lastLeechText = now;
        this.emitZone((player && player.zone) || mob.fieldZone, 'floating_text', {
          x: player.x,
          y: player.y - 0.5,
          text: `+${leech} HP (Leech)`,
          color: '#c084fc',
          size: 13
        });
      }
    }

    let text = `${damage}`;
    let textColor = '#ffea00'; // Iconic Ragnarok Online yellow damage text
    let textSize = 17;

    // Plain numbers: colour and size show weak / resisted / glancing hits
    if (elemMult >= 1.25) {
      textColor = '#f59e0b';
      textSize = 20;
    } else if (elemMult <= 0.75) {
      textColor = '#94a3b8';
      textSize = 15;
    }

    if (isDeflected) {
      text = 'MISS';
      textColor = '#94a3b8';
      textSize = 15;
    } else if (isCritical) {
      text = `${damage}`;
      textColor = '#ff3366';
      textSize = 24;
    } else if (isGlancing) {
      text = `${damage}`;
      textColor = '#fb923c';
      textSize = 15;
    }
    if (isEcho && !isDeflected) {
      text = `✦ ${damage}`;
      textColor = '#c084fc';
    }

    const instId = player && player.zone === 'dungeon' ? player.dungeonInstanceId : null;
    this.emitZone((player && player.zone) || mob.fieldZone, 'floating_text', {
      x: mob.x,
      y: mob.y - 0.7,
      text,
      color: textColor,
      size: textSize,
      crit: !!isCritical
    }, instId);

    if (mob.hp <= 0) {
      this.handleMobDeath(mob, player);
    } else if (player && !isDeflected && !isEcho) {
      this.applyTalentProcs(player, mob, baseDamage, damage);
    }
  }

  // Talent branch mechanics (talents.js BRANCH_SIGNATURES), run on every hit
  // that lands and leaves the enemy alive
  applyTalentProcs(player, mob, baseDamage, damage) {
    const tp = player.talentProcs;
    if (!tp) return;
    if (tp.manaLeech) {
      player.mp = Math.min(player.maxMp, player.mp + Math.max(1, Math.round(damage * tp.manaLeech)));
    }
    if (tp.burnPower) {
      mob.burnTimer = Math.max(mob.burnTimer || 0, TALENT_PROCS.burnSeconds);
      mob.burnDmg = Math.max(mob.burnDmg || 0, Math.round(player.dmg * tp.burnPower));
    }
    if (tp.poisonPower) {
      const stacks = Math.min(TALENT_PROCS.poisonMaxStacks, (mob.poisonTimer > 0 ? mob.poisonStacks || 0 : 0) + 1);
      mob.poisonStacks = stacks;
      mob.poisonTimer = Math.max(mob.poisonTimer || 0, TALENT_PROCS.poisonSeconds);
      mob.poisonDmg = Math.max(mob.poisonDmg || 0, Math.round(player.dmg * tp.poisonPower * stacks));
    }
    if (tp.chillChance && Math.random() < tp.chillChance) {
      mob.chillTimer = Math.max(mob.chillTimer || 0, TALENT_PROCS.chillSeconds);
    }
    if (tp.echoChance && Math.random() < tp.echoChance) {
      this.applyDamageToMob(player, mob, Math.max(1, Math.round(baseDamage * TALENT_PROCS.echoShare)), false, true);
    }
  }

  handleMobDeath(mob, killerPlayer) {
    // Field raid bosses are paid out by participation rank, not ground loot:
    // give everyone their bounty, broadcast the kill, and let the schedule reset.
    if (mob.isRaidBoss) {
      this.onRaidBossDeath(mob, killerPlayer);
      return;
    }
    mob.state = 'dead';
    mob.hp = 0;
    const isDungeon = (mob.zone === 'dungeon') || (mob.id && mob.id.startsWith('dungeon_')) || (killerPlayer && killerPlayer.zone === 'dungeon');
    mob.respawnTimer = isDungeon ? Infinity : (mob.isBoss ? 25.0 : 10.0);

    const zone = killerPlayer ? killerPlayer.zone : (mob.fieldZone || (mob.id.startsWith('frost_') ? 'frostfell' : 'town'));
    const isBoss = !!mob.isBoss;
    const isMiniboss = !!mob.isMiniboss;
    const instId = killerPlayer && killerPlayer.zone === 'dungeon' ? killerPlayer.dungeonInstanceId : null;
    // Item drops fade out when the killer is far above the monster's level
    // (gold still drops); `lucky` scales every item roll below
    const lootMult = killerPlayer ? lootGapMult(killerPlayer.level, mob.level) : 1;
    const lucky = chance => Math.random() < chance * lootMult;

    if (killerPlayer) {
      // Venom Lord Epidemic Spread on Kill
      if ((mob.poisonStacks && mob.poisonStacks > 0) || (mob.poisonTimer && mob.poisonTimer > 0)) {
        const stacks = mob.poisonStacks || 2;
        const mobsMap = this.getMobsMap(zone);
        let spreadCount = 0;
        for (const nearby of mobsMap.values()) {
          if (nearby === mob || nearby.state === 'dead') continue;
          if (Math.hypot(nearby.x - mob.x, nearby.y - mob.y) <= 4.2) {
            nearby.poisonStacks = Math.min(10, (nearby.poisonStacks || 0) + stacks);
            nearby.poisonTimer = Math.max(nearby.poisonTimer || 0, 7.0);
            nearby.poisonDmg = Math.max(nearby.poisonDmg || 0, Math.round((killerPlayer.dmg || 30) * 0.12 * nearby.poisonStacks));
            spreadCount++;
          }
        }
        if (spreadCount > 0) {
          this.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.7, text: `☣️ EPIDEMIC (${spreadCount})`, color: '#4ade80' });
        }
      }

      // Nightblade Shadow Mark Dash Reset on Kill
      if (mob.shadowMarkTimer > 0) {
        if (killerPlayer.skillCooldowns && killerPlayer.skillCooldowns.dash > 0) {
          killerPlayer.skillCooldowns.dash = 0;
          const kSocket = this.io.sockets.sockets.get(killerPlayer.id);
          if (kSocket) kSocket.emit('player_updated', killerPlayer);
          this.emitZone(zone, 'floating_text', { x: killerPlayer.x, y: killerPlayer.y - 0.7, text: `🗡️ SHADOW RESET!`, color: '#a855f7' });
        }
      }

      killerPlayer.inventory.kills++;
      if (killerPlayer.dungeonRun) killerPlayer.dungeonRun.kills = (killerPlayer.dungeonRun.kills || 0) + 1;
      // full EXP near your level, much less for monsters far below you; party
      // members nearby on the same map split it (see partyExpSharers)
      const sharers = this.partyExpSharers(killerPlayer);
      const share = mob.exp * (1 + PARTY_EXP_BONUS * (sharers.length - 1)) / sharers.length;
      for (const member of sharers) {
        const memberExp = Math.max(1, Math.round(share * levelGapMult(member.level, mob.level)));
        this.awardExp(member, memberExp);
        this.awardJobExp(member, memberExp);
        if (member !== killerPlayer) {
          const mSocket = this.io.sockets.sockets.get(member.id);
          if (mSocket) mSocket.emit('player_updated', member);
        }
      }

      // Talent on-kill effects (Juggernaut, Astral Overload, Vampiric Edge)
      if (killerPlayer.skills) {
        const tree = SKILL_TREES[killerPlayer.characterClass] || [];
        for (const t of tree) {
          const rank = killerPlayer.skills[t.id] || 0;
          if (rank > 0 && t.effects) {
            if (t.effects.killHealPercent) {
              const heal = Math.round(killerPlayer.maxHp * t.effects.killHealPercent * rank);
              killerPlayer.hp = Math.min(killerPlayer.maxHp, killerPlayer.hp + heal);
              this.emitZone(zone, 'floating_text', { x: killerPlayer.x, y: killerPlayer.y - 0.5, text: `+${heal} HP (Juggernaut)`, color: '#4ade80' });
            }
            if (t.effects.killHealFlat) {
              const heal = t.effects.killHealFlat * rank;
              killerPlayer.hp = Math.min(killerPlayer.maxHp, killerPlayer.hp + heal);
              this.emitZone(zone, 'floating_text', { x: killerPlayer.x, y: killerPlayer.y - 0.5, text: `+${heal} HP (Vampiric)`, color: '#4ade80' });
            }
            if (t.effects.killManaRestore) {
              const mana = t.effects.killManaRestore * rank;
              killerPlayer.mp = Math.min(killerPlayer.maxMp, killerPlayer.mp + mana);
              this.emitZone(zone, 'floating_text', { x: killerPlayer.x, y: killerPlayer.y - 0.5, text: `+${mana} MP (Astral)`, color: '#38bdf8' });
            }
          }
        }
      }

      if (mob.isBoss) {
        this.broadcastSystemMessage(`👑 Legendary Conquest! [${killerPlayer.name}] vanquished [${mob.name}]!`);
        const bossInst = this.getPlayerDungeonInstance(killerPlayer);
        if (bossInst) this.rollBossSpLoot(bossInst, mob.level);
        if (killerPlayer.zone === 'dungeon') {
          this.broadcastSystemMessage(`🎉 The Dungeon Boss fell! A portal to deeper dungeon depths has unlocked.`);
          for (const p of this.players.values()) {
            if (p.zone === 'dungeon' && p.dungeonInstanceId === killerPlayer.dungeonInstanceId && p.dungeonRun && !p.dungeonRun.cleared) {
              this.completeDungeonRun(p);
            }
          }
        }
      } else if (mob.isMiniboss) {
        this.broadcastSystemMessage(`⚔️ Miniboss Slain! [${killerPlayer.name}] vanquished [${mob.name}]!`);
        this.spawnGroundItem(zone, 'item', 'spirit_fragment', mob.x, mob.y, 1, null, instId);
        if (lucky(0.40)) {
          const cls = killerPlayer && killerPlayer.characterClass;
          let gear = generateRandomizedGear(pickGearForLevel(mob.level || 1, { boss: false, cls }), mob.level || 1, false);
          const reforge = rollSkyblockReforge(gear);
          if (reforge) gear = applySkyblockReforge(gear, reforge);
          this.spawnGroundItem(zone, 'item', gear.id, mob.x + (Math.random() - 0.5) * 1.0, mob.y + (Math.random() - 0.5) * 1.0, 1, gear, instId);
          this.broadcastSystemMessage(`💎 Miniboss Bounty! [${mob.name}] dropped [${gear.name}]!`);
        }
      }
    }

    // Spirit fragments from elite (commander) monsters and, rarely, any dungeon monster
    if (!isBoss && !isMiniboss && zone === 'dungeon' && lucky(mob.isCommander ? SP.FRAGMENT_DROP.commander : SP.FRAGMENT_DROP.mob)) {
      this.spawnGroundItem(zone, 'item', 'spirit_fragment', mob.x, mob.y, 1, null, instId);
    }

    // Drop Gold: Reduced drop rate (45% for trash mobs, 100% for bosses/minibosses/commanders) and rebalanced amount
    const shouldDropGold = isBoss || isMiniboss || mob.isCommander || Math.random() < 0.45;
    if (shouldDropGold && mob.gold > 0) {
      const goldScale = isBoss ? 0.7 : isMiniboss ? 0.6 : 0.45;
      const goldDrop = Math.max(1, Math.round(mob.gold * goldScale * (0.8 + Math.random() * 0.4)));
      this.spawnGroundItem(zone, 'gold', 'Gold Coins', mob.x + (Math.random() - 0.5) * 0.5, mob.y + (Math.random() - 0.5) * 0.5, goldDrop, null, instId);
    }

    if (isBoss) {
      // Boss gear is high quality with a rolled reforge ("ออฟสวยๆ"), but kept rare:
      // 35% for one piece, 6% for a second.
      const equipCount = (lucky(BOSS_GEAR_DROP_CHANCE) ? 1 : 0) + (lucky(BOSS_BONUS_GEAR_DROP_CHANCE) ? 1 : 0);
      const cls = killerPlayer && killerPlayer.characterClass;
      for (let i = 0; i < equipCount; i++) {
        let gear = generateRandomizedGear(pickGearForLevel(mob.level || 1, { boss: true, cls }), mob.level || 1, true);
        const reforge = rollSkyblockReforge(gear);
        if (reforge) {
          gear = applySkyblockReforge(gear, reforge);
        }
        this.spawnGroundItem(zone, 'item', gear.id, mob.x + (Math.random() - 0.5) * 1.2, mob.y + (Math.random() - 0.5) * 1.2, 1, gear, instId);
        if (killerPlayer) {
          this.broadcastSystemMessage(`👑 Boss Loot! [${mob.name}] dropped [${gear.name}] (${gear.rarity ? gear.rarity.toUpperCase() : 'RARE'})!`);
        }
      }

      if (lucky(BOSS_REVIVAL_STONE_CHANCE)) {
        this.spawnGroundItem(zone, 'item', 'revival_stone', mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1, null, instId);
      }

      // High-tier Potions
      if (lucky(1)) {
        this.spawnGroundItem(zone, 'item', 'health_potion', mob.x + 0.4, mob.y, 2, null, instId);
        this.spawnGroundItem(zone, 'item', 'mana_potion', mob.x - 0.4, mob.y, 2, null, instId);
      }
    } else {
      // Normal mobs:
      // "แต่อัตราการดรอปของ ทำให้น้อยๆหน่อย" (Low drop rate: ~3.5% equipment, ~6% potions/stone)
      if (lucky(MOB_GEAR_DROP_CHANCE)) {
        const cls = killerPlayer && killerPlayer.characterClass;
        let gear = generateRandomizedGear(pickGearForLevel(mob.level || 1, { cls }), mob.level || 1, false);
        if (Math.random() < 0.25) {
          const reforge = rollSkyblockReforge(gear);
          if (reforge) gear = applySkyblockReforge(gear, reforge);
        }
        this.spawnGroundItem(zone, 'item', gear.id, mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1, gear, instId);
      }

      if (lucky(0.06)) {
        const cChoice = Math.random();
        if (cChoice < 0.45) {
          this.spawnGroundItem(zone, 'item', 'health_potion', mob.x + (Math.random() - 0.5) * 0.6, mob.y + (Math.random() - 0.5) * 0.6, 1, null, instId);
        } else if (cChoice < 0.90) {
          this.spawnGroundItem(zone, 'item', 'mana_potion', mob.x + (Math.random() - 0.5) * 0.6, mob.y + (Math.random() - 0.5) * 0.6, 1, null, instId);
        } else {
          // Rare revival stone drop from regular mob!
          this.spawnGroundItem(zone, 'item', 'revival_stone', mob.x, mob.y, 1, null, instId);
        }
      }

      // Relic drops in dungeon/field (reduced to 12%)
      if ((zone === 'dungeon' || (this.fields && this.fields.has(zone))) && lucky(0.12)) {
        const relics = ['ancient_ruby', 'cursed_chalice', 'shadow_essence'];
        const r = relics[Math.floor(Math.random() * relics.length)];
        this.spawnGroundItem(zone, 'item', r, mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1, null, instId);
      }
    }

    this.emitZone(zone, 'mob_died', { mobId: mob.id, killerId: killerPlayer ? killerPlayer.id : null }, instId);
  }

  // Who shares the EXP of a kill: the killer plus party members who are alive,
  // on the same map (same field zone, or the same dungeon run) and within
  // PARTY_EXP_RANGE tiles of the killer
  partyExpSharers(killer) {
    const party = killer.partyId && this.parties.get(killer.partyId);
    if (!party) return [killer];
    const out = [killer];
    for (const id of party.memberIds) {
      const m = this.players.get(id);
      if (!m || m === killer || m.isDead || m.zone !== killer.zone) continue;
      if (killer.zone === 'dungeon' && m.dungeonInstanceId !== killer.dungeonInstanceId) continue;
      if (Math.hypot(m.x - killer.x, m.y - killer.y) > PARTY_EXP_RANGE) continue;
      out.push(m);
    }
    return out;
  }

  awardExp(player, amount) {
    if (player.level >= 150) return;
    if (player.dungeonRun && !player.dungeonRun.cleared) player.dungeonRun.exp = (player.dungeonRun.exp || 0) + amount;
    player.exp += amount;
    this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 1.0, text: `+${amount} EXP`, color: '#a855f7' });

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

      this.recalculatePlayerStats(player);

      player.hp = player.maxHp;
      player.mp = player.maxMp;

      this.emitZone(player.zone, 'level_up', { playerId: player.id, level: player.level, x: player.x, y: player.y });
      this.emitZone(player.zone, 'floating_text', {
        x: player.x,
        y: player.y - 1.4,
        text: `🌳 +1 Skill Point! (Total: ${player.skillPoints})`,
        color: '#4ade80',
        size: 18
      });
      this.broadcastSystemMessage(`✨ [${player.name}] reached Level ${player.level}! Earned 1 Skill Point.`);
    }

    if (player.level >= 150) {
      player.exp = 0;
    }
  }

  spawnGroundItem(zone, type, itemIdOrName, x, y, amount, customItemData = null, instanceId = null) {
    const id = `item_${this.nextEntityId++}`;
    const itemsMap = this.getGroundItemsMap(zone, instanceId);

    const baseDef = ITEMS[itemIdOrName];
    const item = {
      id,
      zone,
      type,
      itemId: type === 'item' ? itemIdOrName : null,
      name: type === 'gold' ? `${amount} Gold` : (customItemData && customItemData.name ? customItemData.name : (baseDef ? baseDef.name : itemIdOrName)),
      x,
      y,
      amount,
      customItemData,
      createdAt: Date.now(),
      expiresAt: Date.now() + ITEM_DESPAWN_MS
    };

    itemsMap.set(id, item);
    this.emitZone(zone, 'item_dropped', item, instanceId);
  }

  calculateFacing(fromX, fromY, toX, toY) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return 'S';

    const screenDx = dx - dy; // Horizontal screen direction (+ right, - left)
    const screenDy = (dx + dy) * 0.5; // Vertical screen direction (+ down, - up)

    const angle = Math.atan2(screenDy, screenDx);
    const deg = (angle * 180) / Math.PI; // -180 to 180

    // 8-directional screen orientation
    if (deg >= -22.5 && deg < 22.5) return 'E';
    if (deg >= 22.5 && deg < 67.5) return 'SE';
    if (deg >= 67.5 && deg < 112.5) return 'S';
    if (deg >= 112.5 && deg < 157.5) return 'SW';
    if (deg >= 157.5 || deg < -157.5) return 'W';
    if (deg >= -157.5 && deg < -112.5) return 'NW';
    if (deg >= -112.5 && deg < -67.5) return 'N';
    if (deg >= -67.5 && deg < -22.5) return 'NE';

    return 'S';
  }

  broadcastSystemMessage(text) {
    this.io.emit('chat_broadcast', {
      senderId: 'system',
      senderName: 'SYSTEM',
      senderClass: 'system',
      text,
      timestamp: Date.now()
    });
  }

  sendDirectMessage(socketId, text) {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('chat_broadcast', {
        senderId: 'system',
        senderName: 'SYSTEM',
        senderClass: 'system',
        text,
        timestamp: Date.now()
      });
    }
  }

  // Authoritative Game Loop
  startGameLoop() {
    const dt = 1 / this.TICK_RATE;
    this.tickInterval = setInterval(() => {
      this.update(dt);
      this.broadcastSnapshot();
      this.flushFloatingTexts();
    }, 1000 / this.TICK_RATE);
  }

  // Remove ground loot older than ITEM_DESPAWN_MS in every zone and instance
  sweepGroundItems() {
    const now = Date.now();
    if (this._lastItemSweep && now - this._lastItemSweep < ITEM_SWEEP_INTERVAL_MS) return;
    this._lastItemSweep = now;
    const sweep = (map: any, zone: string, instanceId: any = null) => {
      for (const [id, item] of map) {
        if (item.expiresAt && item.expiresAt <= now) {
          map.delete(id);
          this.emitZone(zone, 'item_despawned', { itemId: id, x: item.x, y: item.y }, instanceId);
        }
      }
    };
    sweep(this.townGroundItems, 'town');
    for (const [fieldId, field] of this.fields) sweep(field.groundItems, fieldId);
    for (const inst of this.dungeonInstances.values()) sweep(inst.groundItems, 'dungeon', inst.id);
  }

  update(dt) {
    this.syncZoneRooms();
    this.sweepGroundItems();
    // 1. Update Players
    for (const player of this.players.values()) {
      const socket = this.io.sockets.sockets.get(player.id);
      this.ctxInstanceId = player.dungeonInstanceId || null;
      if (player.isDead) {
        if (player.spToggles) {
          for (const id of Object.keys(player.spToggles)) this.endSpToggle(player, id, true);
        }
        if (player.bloodlust) {
          player.bloodlust = null;
          this.recalculatePlayerStats(player);
        }
        player.respawnTimer -= dt;
        if (player.respawnTimer <= 0) {
          if (player.zone === 'dungeon') {
            this.endDungeonRun(player, socket);
            const prevInstId = player.dungeonInstanceId;
            player.dungeonInstanceId = null;
            player.zone = 'town';
            if (prevInstId) this.cleanupDungeonInstanceIfEmpty(prevInstId);
          }
          player.isDead = false;
          player.hp = player.maxHp;
          player.mp = player.maxMp;
          player.zone = 'town';
          player.x = 20 + (Math.random() - 0.5) * 2;
          player.y = 23 + (Math.random() - 0.5) * 1.5;
          this.io.emit('player_respawned', { playerId: player.id, x: player.x, y: player.y });
          this.broadcastSystemMessage(`❤️ [${player.name}] has revived in town.`);
          if (socket) {
            socket.emit('zone_change', {
              zone: 'town',
              map: this.townMap,
              player,
              players: Array.from(this.players.values()).filter(p => p.zone === 'town'),
              mobs: Array.from(this.townMobs.values()),
              groundItems: Array.from(this.townGroundItems.values())
            });
          }
        }
        continue;
      }

      if (player.attackCooldown > 0) player.attackCooldown = Math.max(0, player.attackCooldown - dt);
      if (player.skillCooldown > 0) player.skillCooldown = Math.max(0, player.skillCooldown - dt);
      if (player.skillCooldowns) {
        for (const k of Object.keys(player.skillCooldowns)) {
          if (player.skillCooldowns[k] > 0) player.skillCooldowns[k] = Math.max(0, player.skillCooldowns[k] - dt);
        }
        player.skillCooldown = player.skillCooldowns.slot1 || player.skillCooldowns.skill1 || 0;
      }
      if (player.sprintTimer > 0) player.sprintTimer = Math.max(0, player.sprintTimer - dt);
      if (player.portalCooldown > 0) player.portalCooldown = Math.max(0, player.portalCooldown - dt);
      if (player.spCooldown > 0) player.spCooldown = Math.max(0, player.spCooldown - dt);
      if (player.berserkTimer > 0) player.berserkTimer = Math.max(0, player.berserkTimer - dt);
      if (player.undyingTimer > 0) player.undyingTimer = Math.max(0, player.undyingTimer - dt);
      if (player.ironFortressTimer > 0) player.ironFortressTimer = Math.max(0, player.ironFortressTimer - dt);
      if (player.smokeScreenTimer > 0) player.smokeScreenTimer = Math.max(0, player.smokeScreenTimer - dt);
      if (player.stormChargeTimer > 0) {
        player.stormChargeTimer -= dt;
        if (player.stormChargeTimer <= 0) player.stormCharge = 0;
      }
      if (player.voidSoulTimer > 0) {
        player.voidSoulTimer -= dt;
        if (player.voidSoulTimer <= 0) player.voidSouls = 0;
      }
      // where we were a moment ago (Chronomancer Rewind)
      player.timeTrailClock = (player.timeTrailClock || 0) + dt;
      if (player.timeTrailClock >= REWIND_SAMPLE_S && !player.isDead) {
        player.timeTrailClock = 0;
        const now = Date.now();
        player.timeTrail = (player.timeTrail || []).filter(t => now - t.t <= REWIND_KEEP_S * 1000);
        player.timeTrail.push({ t: now, x: player.x, y: player.y, hp: player.hp });
      }
      if (player.flowTimer > 0) {
        player.flowTimer = Math.max(0, player.flowTimer - dt);
        if (player.flowTimer <= 0) {
          player.flowStacks = 0;
          this.recalculatePlayerStats(player);
        }
      }
      if (player.speechTimer > 0) {
        player.speechTimer -= dt;
        if (player.speechTimer <= 0) player.speechBubble = null;
      }

      // an HP-draining toggle (Crimson Aura) stops natural HP regen
      const bleeding = player.spToggles && Object.keys(player.spToggles).length && this.tickSpToggles(player, dt);
      if (!bleeding) player.hp = Math.min(player.maxHp, player.hp + (player.maxHp * 0.015 * dt));
      if (player.bloodlust) {
        player.bloodlust.timer -= dt;
        if (player.bloodlust.timer <= 0) {
          player.bloodlust = null;
          this.recalculatePlayerStats(player);
        }
      }
      player.mp = Math.min(player.maxMp, player.mp + (player.maxMp * MANA_REGEN_PCT * dt) + (MANA_REGEN_FLAT * dt));

      if (player.zone === 'dungeon') this.applyDungeonHazard(player);

      // Status Effects Processing (Poison DoT, Burn DoT, Chill Slow)
      if (player.statusEffects && player.statusEffects.length > 0) {
        let isChilled = false;
        for (let i = player.statusEffects.length - 1; i >= 0; i--) {
          const fx = player.statusEffects[i];
          fx.duration -= dt;
          fx.tickTimer -= dt;

          if (player.godMode) continue;

          if (fx.type === 'poison' && fx.tickTimer <= 0) {
            fx.tickTimer = 0.8;
            const dotDmg = Math.max(1, Math.round(fx.value));
            player.hp = Math.max(player.undyingTimer > 0 ? 1 : 0, player.hp - dotDmg);
            this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: `☠️ -${dotDmg}`, color: '#22c55e', size: 14 });
          } else if (fx.type === 'burn' && fx.tickTimer <= 0) {
            fx.tickTimer = 0.6;
            const dotDmg = Math.max(1, Math.round(fx.value));
            player.hp = Math.max(player.undyingTimer > 0 ? 1 : 0, player.hp - dotDmg);
            this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: `🔥 -${dotDmg}`, color: '#f97316', size: 14 });
          } else if (fx.type === 'chill') {
            isChilled = true;
          }

          if (player.hp <= 0 && !player.isDead) {
            player.hp = 0;
            player.isDead = true;
            player.respawnTimer = 5.0;
            this.emitZone(player.zone, 'player_died', { playerId: player.id, killerName: fx.type.toUpperCase() });
            this.broadcastSystemMessage(`☠️ [${player.name}] succumbed to ${fx.type.toUpperCase()}!`);
          }

          if (fx.duration <= 0) {
            player.statusEffects.splice(i, 1);
          }
        }

        player.speedFactor = isChilled ? 0.6 : 1.0;
      } else {
        player.speedFactor = 1.0;
      }

      // Movement
      let moveX = 0;
      let moveY = 0;

      const sprintBonus = (player.sprintTimer && player.sprintTimer > 0) ? 1.35 : 1.0;

      if (player.moveDir.dx !== 0 || player.moveDir.dy !== 0) {
        const screenLen = Math.hypot(player.moveDir.dx, player.moveDir.dy);
        const normScreenX = player.moveDir.dx / screenLen;
        const normScreenY = player.moveDir.dy / screenLen;

        const worldDx = (normScreenX + normScreenY * 2) * 0.5;
        const worldDy = (normScreenY * 2 - normScreenX) * 0.5;

        const speedFactor = player.speed * (player.speedFactor || 1.0) * sprintBonus * 0.65;
        moveX = worldDx * speedFactor * dt;
        moveY = worldDy * speedFactor * dt;

        player.facing = this.calculateFacing(0, 0, moveX, moveY);
        player.isMoving = true;
      } else if (player.targetX !== null && player.targetY !== null) {
        const screenCurX = (player.x - player.y);
        const screenCurY = (player.x + player.y) * 0.5;
        const screenTarX = (player.targetX - player.targetY);
        const screenTarY = (player.targetX + player.targetY) * 0.5;

        const screenDist = Math.hypot(screenTarX - screenCurX, screenTarY - screenCurY);

        if (screenDist > 0.15) {
          const normSx = (screenTarX - screenCurX) / screenDist;
          const normSy = (screenTarY - screenCurY) / screenDist;

          const worldDx = (normSx + normSy * 2) * 0.5;
          const worldDy = (normSy * 2 - normSx) * 0.5;

          const speedFactor = player.speed * (player.speedFactor || 1.0) * 0.65;
          const moveStep = Math.min(screenDist, speedFactor * dt);
          moveX = worldDx * moveStep;
          moveY = worldDy * moveStep;

          player.facing = this.calculateFacing(player.x, player.y, player.targetX, player.targetY);
          player.isMoving = true;
        } else {
          player.targetX = null;
          player.targetY = null;
          player.isMoving = false;
        }
      } else {
        player.isMoving = false;
      }

      if (moveX !== 0 || moveY !== 0) {
        const nextX = player.x + moveX;
        const nextY = player.y + moveY;

        if (!this.isColliding(nextX, nextY, player.zone)) {
          player.x = nextX;
          player.y = nextY;
        } else if (!this.isColliding(nextX, player.y, player.zone)) {
          player.x = nextX;
        } else if (!this.isColliding(player.x, nextY, player.zone)) {
          player.y = nextY;
        }
      }

      // Auto-Loot System: Automatically collect ground loot within 1.8 tiles
      const groundMap = this.getGroundItemsMap(player.zone);
      for (const item of groundMap.values()) {
        const d = Math.hypot(item.x - player.x, item.y - player.y);
        if (d <= 1.8) {
          this.handlePickupItem(player.id, item.id);
        }
      }

    }

    this.ctxInstanceId = null;

    // Update Town and Field Mobs
    this.updateMobsList(this.townMobs, 'town', dt);
    for (const [fieldId, field] of this.fields) this.updateMobsList(field.mobs, fieldId, dt);

    // Field raid / world boss schedule & live leaderboards
    this.updateRaidEvents();

    // Update Dungeon Mobs per Instance
    for (const inst of this.dungeonInstances.values()) {
      const commanderMobs = [];
      for (const mob of inst.mobs.values()) {
        if (mob.state !== 'dead' && mob.isCommander && mob.auraRadius > 0) {
          commanderMobs.push(mob);
        }
        mob.hasCommanderBuff = false;
      }

      if (commanderMobs.length > 0) {
        // Bucket commanders on a grid as coarse as the widest aura, so each mob
        // only checks the commanders in its own and the 8 surrounding cells
        const cell = Math.max(...commanderMobs.map(c => c.auraRadius));
        const buckets = new Map<any, any>();
        for (const cmdr of commanderMobs) {
          const k = Math.floor(cmdr.x / cell) + ',' + Math.floor(cmdr.y / cell);
          if (!buckets.has(k)) buckets.set(k, []);
          buckets.get(k).push(cmdr);
        }
        for (const mob of inst.mobs.values()) {
          if (mob.state === 'dead' || mob.isCommander) continue;
          const cx = Math.floor(mob.x / cell), cy = Math.floor(mob.y / cell);
          search:
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const near = buckets.get((cx + dx) + ',' + (cy + dy));
              if (!near) continue;
              for (const cmdr of near) {
                if (Math.hypot(mob.x - cmdr.x, mob.y - cmdr.y) <= cmdr.auraRadius) {
                  mob.hasCommanderBuff = true;
                  break search;
                }
              }
            }
          }
        }
      }
      this.ctxInstanceId = inst.id;
      this.updateMobsList(inst.mobs, 'dungeon', dt, inst.id);
      this.updateDungeonRooms(inst);
      this.ctxInstanceId = null;
    }

    // 3. Update Projectiles
    for (const [projId, proj] of this.projectiles.entries()) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;

      this.ctxInstanceId = proj.instanceId || null;
      const mobsMap = this.getMobsMap(proj.zone);
      let hit = false;
      for (const mob of mobsMap.values()) {
        if (mob.state === 'dead') continue;
        if (Math.hypot(mob.x - proj.x, mob.y - proj.y) < 0.8) {
          const caster = this.players.get(proj.casterId);
          if (caster) {
            this.applyDamageToMob(caster, mob, proj.damage, proj.crit);
            if (proj.splash > 0) this.applyProjectileSplash(caster, proj, mob, mobsMap);
          }
          hit = true;
          break;
        }
      }

      if (hit || proj.life <= 0 || this.isColliding(proj.x, proj.y, proj.zone, 0.2)) {
        this.emitZone(proj.zone, 'projectile_exploded', { id: proj.id, x: proj.x, y: proj.y, element: proj.element, cardId: proj.cardId, splash: proj.splash > 0, radius: MAGE_SPLASH_RADIUS });
        this.projectiles.delete(projId);
      }
    }
    this.ctxInstanceId = null;
  }

  updateMobsList(mobsMap, zone, dt, instanceId = null) {
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') {
        if (zone === 'dungeon' || (mob.id && mob.id.startsWith('dungeon_'))) {
          // Dungeon mobs NEVER respawn during an active run! Must leave and re-enter.
          continue;
        }
        mob.respawnTimer -= dt;
        if (mob.respawnTimer <= 0) {
          mob.state = 'idle';
          mob.hp = mob.maxHp;
          mob.x = mob.spawnX;
          mob.y = mob.spawnY;
          mob.targetPlayerId = null;
        }
        continue;
      }

      // Still rising from its room's summon: no AI yet
      if (mob.spawnUntil) {
        if (Date.now() < mob.spawnUntil) continue;
        mob.spawnUntil = 0;
      }

      if (mob.attackCooldown > 0) mob.attackCooldown = Math.max(0, mob.attackCooldown - dt);

      // Mob Status Effects (Chill, Burn DoT, Poison DoT). A DoT kill is
      // credited to the last hero who hit the mob, if still in this zone.
      const dotOwner = () => {
        const p = mob.lastHitBy && this.players.get(mob.lastHitBy);
        return p && p.zone === zone && !p.isDead && (!instanceId || p.dungeonInstanceId === instanceId) ? p : null;
      };
      if (mob.chillTimer > 0) {
        mob.chillTimer = Math.max(0, mob.chillTimer - dt);
      }
      if (mob.burnTimer > 0) {
        mob.burnTimer = Math.max(0, mob.burnTimer - dt);
        mob.burnTickTimer = (mob.burnTickTimer || 0) - dt;
        if (mob.burnTickTimer <= 0) {
          mob.burnTickTimer = 0.6;
          const dotDmg = Math.max(1, Math.round(mob.burnDmg || 8));
          mob.hp -= dotDmg;
          this.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.7, text: `🔥 -${dotDmg}`, color: '#f97316', size: 14 }, instanceId);
          if (mob.hp <= 0) {
            this.handleMobDeath(mob, dotOwner());
            continue;
          }
        }
        if (mob.burnTimer <= 0) mob.burnDmg = 0; // next ignite starts fresh
      }
      if (mob.poisonTimer > 0) {
        mob.poisonTimer = Math.max(0, mob.poisonTimer - dt);
        mob.poisonTickTimer = (mob.poisonTickTimer || 0) - dt;
        if (mob.poisonTickTimer <= 0) {
          mob.poisonTickTimer = 0.8;
          const dotDmg = Math.max(1, Math.round(mob.poisonDmg || 6));
          mob.hp -= dotDmg;
          const stackTag = mob.poisonStacks > 1 ? ` x${mob.poisonStacks}` : '';
          this.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.7, text: `☠️ -${dotDmg}${stackTag}`, color: '#22c55e', size: 14 }, instanceId);
          if (mob.hp <= 0) {
            this.handleMobDeath(mob, dotOwner());
            continue;
          }
        }
        if (mob.poisonTimer <= 0) { mob.poisonDmg = 0; mob.poisonStacks = 0; }
      }
      if (mob.shadowMarkTimer > 0) mob.shadowMarkTimer = Math.max(0, mob.shadowMarkTimer - dt);
      if (mob.staticCharge > 0) mob.staticCharge = Math.max(0, mob.staticCharge - dt);
      if (mob.scorchTimer > 0) { mob.scorchTimer -= dt; if (mob.scorchTimer <= 0) mob.scorchStacks = 0; }
      if (mob.frostTimer > 0) { mob.frostTimer -= dt; if (mob.frostTimer <= 0) mob.frostStacks = 0; }
      // Frozen solid (Cryo) or stopped in time (Chrono): no moving, no attacking
      if (mob.frozenTimer > 0) {
        mob.frozenTimer = Math.max(0, mob.frozenTimer - dt);
        mob.attackCooldown = Math.max(mob.attackCooldown, 0.3);
        continue;
      }

      if (mob.state === 'idle') {
        let closestPlayer = null;
        let closestDist = 5.0;

        for (const p of this.players.values()) {
          if (p.isDead || p.zone !== zone || (instanceId && p.dungeonInstanceId !== instanceId)) continue;
          const d = Math.hypot(p.x - mob.x, p.y - mob.y);
          if (d < closestDist) {
            closestDist = d;
            closestPlayer = p;
          }
        }

        if (closestPlayer) {
          mob.state = 'chase';
          mob.targetPlayerId = closestPlayer.id;
          // Wind-up so freshly aggroed mobs don't all land a hit the instant they arrive
          mob.attackCooldown = Math.max(mob.attackCooldown, 0.6 + Math.random() * 0.5);
        } else {
          if (Date.now() > mob.nextWanderTime) {
            mob.nextWanderTime = Date.now() + 2000 + Math.random() * 4000;
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 2.5;
            mob.wanderTarget = {
              x: mob.spawnX + Math.cos(angle) * dist,
              y: mob.spawnY + Math.sin(angle) * dist
            };
          }

          if (mob.wanderTarget) {
            const wd = Math.hypot(mob.wanderTarget.x - mob.x, mob.wanderTarget.y - mob.y);
            if (wd > 0.2) {
              const step = Math.min(wd, (mob.speed * 0.4) * dt);
              const wx = ((mob.wanderTarget.x - mob.x) / wd) * step;
              const wy = ((mob.wanderTarget.y - mob.y) / wd) * step;
              if (!this.isColliding(mob.x + wx, mob.y + wy, zone)) {
                mob.x += wx;
                mob.y += wy;
                mob.facing = this.calculateFacing(0, 0, wx, wy);
              } else {
                mob.wanderTarget = null;
              }
            } else {
              mob.wanderTarget = null;
            }
          }
        }
      } else if (mob.state === 'chase') {
        const targetPlayer = this.players.get(mob.targetPlayerId);
        if (!targetPlayer || targetPlayer.isDead || targetPlayer.zone !== zone) {
          mob.state = 'return';
          mob.targetPlayerId = null;
          continue;
        }

        const distToPlayer = Math.hypot(targetPlayer.x - mob.x, targetPlayer.y - mob.y);
        const distToSpawn = Math.hypot(mob.spawnX - mob.x, mob.spawnY - mob.y);

        if (distToPlayer > 10.0 || distToSpawn > 14.0) {
          mob.state = 'return';
          mob.targetPlayerId = null;
          continue;
        }

        if (distToPlayer <= 1.2) {
          mob.facing = this.calculateFacing(mob.x, mob.y, targetPlayer.x, targetPlayer.y);
          // Brief global hit lockout per player so a whole pack can't machine-gun one target
          const now = Date.now();
          if (mob.attackCooldown <= 0 && now < (targetPlayer.nextMobHitAt || 0)) {
            mob.attackCooldown = 0.15 + Math.random() * 0.2;
          } else if (mob.attackCooldown <= 0) {
            mob.attackCooldown = 1.2 + Math.random() * 0.5; // jitter desyncs packs
            targetPlayer.nextMobHitAt = now + (mob.isBoss ? 150 : 350);

            if (targetPlayer.godMode) {
              this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '🛡️ IMMUNE (God Mode)', color: '#facc15' });
              continue;
            }

            if (targetPlayer.smokeScreenTimer > 0) {
              this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '💨 MISS! (Stealth)', color: '#94a3b8' });
              continue;
            }
            if (Math.random() < this.smokeMissChance(targetPlayer)) {
              this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '💨 MISS! (Smoke)', color: '#94a3b8' });
              continue;
            }

            // Dodge chance from talents
            if (targetPlayer.dodgeChance && Math.random() < targetPlayer.dodgeChance) {
              this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '💨 DODGE!', color: '#38bdf8' });
              continue;
            }

            const effectiveDmg = mob.hasCommanderBuff ? Math.round(mob.dmg * 1.35) : mob.dmg;
            let damageDealt = Math.max(1, Math.round(effectiveDmg - (targetPlayer.def * 0.5)));

            // Monster element vs the player's elemental resistance from gear
            const elemResistMult = calculateElementalMultiplier(mob.element || 'neutral', 'neutral', targetPlayer.elementResist || {});
            damageDealt = Math.max(1, Math.round(damageDealt * elemResistMult));

            // Crushing Blow from high level monsters against underleveled players!
            let isCrushing = false;
            if (mob.level && targetPlayer.level && (mob.level - targetPlayer.level >= 5)) {
              const gap = mob.level - targetPlayer.level;
              const crushingMult = 1.0 + Math.min(4.0, (gap - 3) * 0.08);
              damageDealt = Math.round(damageDealt * crushingMult);
              isCrushing = true;
            }

            // Thorns reflection (Iron Fortress + passive Unyielding Spikes/Colossus Avatar)
            const thornsDmg = (targetPlayer.ironFortressTimer > 0 ? 25 : 0) + (targetPlayer.thorns || 0);
            if (thornsDmg > 0) {
              this.applyDamageToMob(targetPlayer, mob, thornsDmg, false);
              this.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.7, text: `🌵 ${thornsDmg} Thorns!`, color: '#e2e8f0' });
            }

            // Iron Fortress: -60% damage
            if (targetPlayer.ironFortressTimer > 0) {
              damageDealt = Math.max(1, Math.round(damageDealt * 0.40));
            }

            // Shield Barrier absorption
            if (targetPlayer.shieldHp > 0) {
              const absorbed = Math.min(targetPlayer.shieldHp, damageDealt);
              targetPlayer.shieldHp -= absorbed;
              damageDealt -= absorbed;
              this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.5, text: `🛡️ Absorbed -${absorbed}`, color: '#38bdf8' });
            }

            targetPlayer.hp -= damageDealt;
            if (targetPlayer.undyingTimer > 0 && targetPlayer.hp < 1) {
              targetPlayer.hp = 1;
              this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 1.0, text: '💀 UNDYING RAGE!', color: '#c084fc', size: 18 });
            }

            // Apply Mob Buffs/Affixes to targetPlayer
            if (mob.buffs && mob.buffs.length > 0) {
              if (mob.buffs.includes('venomous')) {
                this.applyStatusEffect(targetPlayer, 'poison', 4.5, 9);
              }
              if (mob.buffs.includes('frostbite')) {
                this.applyStatusEffect(targetPlayer, 'chill', 2.5, 0.45);
              }
              if (mob.buffs.includes('ignited')) {
                this.applyStatusEffect(targetPlayer, 'burn', 3.0, 14);
              }
            }

            if (isCrushing) {
              this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: `-${damageDealt}`, color: '#dc2626', size: 18 });
            } else if (elemResistMult < 1) {
              this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: `-${damageDealt}`, color: '#fca5a5' });
            } else {
              this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: `-${damageDealt}`, color: '#ef4444' });
            }
            this.emitZone(zone, 'entity_attack_fx', { attackerId: mob.id, attackerType: 'mob', targetId: targetPlayer.id, x: mob.x, y: mob.y });

            if (targetPlayer.hp <= 0) {
              targetPlayer.hp = 0;
              targetPlayer.isDead = true;
              if (targetPlayer.dungeonRun) targetPlayer.dungeonRun.deaths = (targetPlayer.dungeonRun.deaths || 0) + 1;
              targetPlayer.respawnTimer = 5.0;
              this.emitZone(zone, 'player_died', { playerId: targetPlayer.id, killerName: mob.name });
              this.broadcastSystemMessage(`☠️ [${targetPlayer.name}] was slain by [${mob.name}]!`);
              mob.state = 'return';
            }
          }
        } else {
          let effectiveSpeed = mob.hasCommanderBuff ? mob.speed * 1.25 : mob.speed;
          if (mob.chillTimer > 0) effectiveSpeed *= 0.5;
          const step = Math.min(distToPlayer, effectiveSpeed * dt);
          const mx = ((targetPlayer.x - mob.x) / distToPlayer) * step;
          const my = ((targetPlayer.y - mob.y) / distToPlayer) * step;

          // slide along pillars and pools instead of sticking to them
          if (!this.isColliding(mob.x + mx, mob.y + my, zone)) {
            mob.x += mx;
            mob.y += my;
          } else if (Math.abs(mx) > 1e-4 && !this.isColliding(mob.x + Math.sign(mx) * step, mob.y, zone)) {
            mob.x += Math.sign(mx) * step;
          } else if (Math.abs(my) > 1e-4 && !this.isColliding(mob.x, mob.y + Math.sign(my) * step, zone)) {
            mob.y += Math.sign(my) * step;
          }
          mob.facing = this.calculateFacing(mob.x, mob.y, targetPlayer.x, targetPlayer.y);
        }
      } else if (mob.state === 'return') {
        const distToSpawn = Math.hypot(mob.spawnX - mob.x, mob.spawnY - mob.y);
        if (distToSpawn > 0.2) {
          mob.facing = this.calculateFacing(mob.x, mob.y, mob.spawnX, mob.spawnY);
          const step = Math.min(distToSpawn, (mob.speed * 1.2) * dt);
          mob.x += ((mob.spawnX - mob.x) / distToSpawn) * step;
          mob.y += ((mob.spawnY - mob.y) / distToSpawn) * step;
          mob.hp = Math.min(mob.maxHp, mob.hp + (mob.maxHp * 0.2 * dt));
        } else {
          mob.state = 'idle';
          mob.hp = mob.maxHp;
        }
      }
    }
  }

  broadcastSnapshot() {
    // Heavy per-player fields (bag, gear, talents...) only go out when they
    // change, plus a full refresh once a second for anyone who just arrived
    this._snapTick = (this._snapTick || 0) + 1;
    const fullRefresh = this._snapTick % this.TICK_RATE === 0;
    if (!this._heavySigs) this._heavySigs = new WeakMap();
    const round2 = v => Math.round(v * 100) / 100;
    const playersArr = Array.from(this.players.values()).map(p => {
      const snap = {
      id: p.id,
      name: p.name,
      characterClass: p.characterClass,
      zone: p.zone,
      dungeonInstanceId: p.dungeonInstanceId || null,
      partyId: p.partyId || null,
      x: round2(p.x),
      y: round2(p.y),
      facing: p.facing,
      isMoving: p.isMoving,
      hp: Math.round(p.hp),
      maxHp: p.maxHp,
      mp: Math.round(p.mp),
      maxMp: p.maxMp,
      dmg: p.dmg,
      def: p.def,
      speed: p.speed,
      level: p.level,
      exp: p.exp,
      expNext: p.expNext,
      skillPoints: p.skillPoints !== undefined ? p.skillPoints : 0,
      gold: p.gold,
      speechBubble: p.speechBubble,
      isDead: p.isDead,
      statusEffects: (p.statusEffects || []).map(e => ({ type: e.type, duration: Math.ceil(e.duration) })),
      skillCooldowns: p.skillCooldowns,
      attackSpeed: p.attackSpeed || 1.0,
      swipe: p.swipe || 0,
      jobLevel: p.jobLevel || 1,
      spTransformed: !!p.spTransformed,
      spCardId: p.spTransformed && p.equipment && p.equipment.sp ? p.equipment.sp.cardId : null,
      spLevel: p.spTransformed && p.equipment && p.equipment.sp ? (p.equipment.sp.upgradeLevel || 0) : 0,
      shieldHp: Math.round(p.shieldHp || 0),
      berserkTimer: Number((p.berserkTimer || 0).toFixed(1)),
      spToggles: p.spToggles ? Object.values(p.spToggles).map((a: any) => ({ id: a.skill.id, r: a.skill.r || 0, spin: !!a.skill.spin, c: a.skill.color })) : [],
      buffs: this.heroBuffs(p),
      mastery: p.mastery || 1,
      ironFortressTimer: Number((p.ironFortressTimer || 0).toFixed(1)),
      smokeScreenTimer: Number((p.smokeScreenTimer || 0).toFixed(1))
      };
      const heavy = {
        inventory: p.inventory, equipment: p.equipment, baseStats: p.baseStats,
        skills: p.skills || {}, equippedSkills: p.equippedSkills, elementResist: p.elementResist || {},
        skillLinks: p.skillLinks || {}
      };
      const sig = JSON.stringify(heavy);
      if (fullRefresh || sig !== this._heavySigs.get(p)) {
        this._heavySigs.set(p, sig);
        Object.assign(snap, heavy);
      }
      return snap;
    });

    const snapMob = m => ({
      id: m.id, type: m.type, name: m.name, level: m.level, x: round2(m.x), y: round2(m.y),
      facing: m.facing, hp: Math.round(m.hp), maxHp: m.maxHp, state: m.state, isBoss: m.isBoss, isMiniboss: !!m.isMiniboss,
      buffs: m.buffs || [], isCommander: !!m.isCommander, auraRadius: m.auraRadius || 0, hasCommanderBuff: !!m.hasCommanderBuff,
      element: m.element || 'neutral', elementResist: m.elementResist || {},
      hue: m.hue || 0, scale: m.scale || 1,
      frozen: m.frozenTimer > 0 ? (m.frozenKind === 'time' ? 2 : 1) : 0, scorch: m.scorchStacks || 0, frost: m.frostStacks || 0
    });
    // Moving parts only; defaults (no buffs, not a commander) are left out
    const snapMobDelta = (m: any) => {
      const d: any = { id: m.id, x: round2(m.x), y: round2(m.y), facing: m.facing, hp: Math.round(m.hp), maxHp: m.maxHp, state: m.state,
        frozen: m.frozenTimer > 0 ? (m.frozenKind === 'time' ? 2 : 1) : 0, scorch: m.scorchStacks || 0, frost: m.frostStacks || 0 };
      if (m.buffs && m.buffs.length) d.buffs = m.buffs;
      if (m.isCommander) { d.isCommander = true; d.auraRadius = m.auraRadius || 0; }
      if (m.isMiniboss) d.isMiniboss = true;
      if (m.hasCommanderBuff) d.hasCommanderBuff = true;
      return d;
    };
    const townMobsArr = Array.from(this.townMobs.values()).map(snapMob);

    // Only send field zones somebody is actually standing in
    const occupied = new Set(playersArr.map(p => p.zone));
    const fieldMobs: Record<string, any[]> = {};
    for (const [fieldId, field] of this.fields) {
      if (occupied.has(fieldId)) fieldMobs[fieldId] = Array.from(field.mobs.values()).map(snapMob);
    }

    this.syncZoneRooms();
    for (const zone of occupied) {
      if (zone === 'dungeon') continue; // Dungeon instances are broadcast separately below!
      this.io.to(`zone:${zone}`).emit('game_tick', {
        timestamp: Date.now(),
        players: playersArr.filter(p => p.zone === zone),
        townMobs: zone === 'town' ? townMobsArr : [],
        fieldMobs: fieldMobs[zone] ? { [zone]: fieldMobs[zone] } : {},
        frostfellMobs: zone === 'frostfell' ? (fieldMobs.frostfell || []) : [],
        dungeonMobs: [],
        dungeonChests: []
      });
    }

    // Broadcast isolated game_tick for each dungeon instance (Zero ghosting across parties!)
    for (const inst of this.dungeonInstances.values()) {
      const instPlayers = playersArr.filter(p => p.zone === 'dungeon' && p.dungeonInstanceId === inst.id);
      if (instPlayers.length === 0) continue;
      // Only living mobs someone in the instance could see (bosses always);
      // dead dungeon mobs are never drawn. Between full refreshes (once a
      // second) the tick is a diff: new mobs in full, changed ones as deltas,
      // unchanged ones left out, and the ids that left view or died as `gone`.
      const instMobsArr = [];
      const mobRefresh = this._snapTick % (this.TICK_RATE * MOB_FULL_REFRESH_S) === 0;
      const sentBefore = (!mobRefresh && inst._sentMobs) || new Map<any, any>();
      const sentNow = new Map<any, any>();
      for (const m of inst.mobs.values()) {
        if (m.state === 'dead') continue;
        if (!m.isBoss && !instPlayers.some(p => mobInView(m, p))) continue;
        const delta = snapMobDelta(m);
        const sig = JSON.stringify(delta);
        if (!sentBefore.has(m.id)) instMobsArr.push(snapMob(m));
        else if (sentBefore.get(m.id) !== sig) instMobsArr.push(delta);
        sentNow.set(m.id, sig);
      }
      const gone = [];
      if (!mobRefresh && inst._sentMobs) for (const id of inst._sentMobs.keys()) if (!sentNow.has(id)) gone.push(id);
      inst._sentMobs = sentNow;
      // Chests only change when someone opens one
      const chestSig = JSON.stringify(inst.chests || []);
      const chestsChanged = mobRefresh || chestSig !== inst._chestSig;
      inst._chestSig = chestSig;
      this.io.to(`dungeon:${inst.id}`).emit('game_tick', {
        timestamp: Date.now(),
        players: instPlayers,
        townMobs: [],
        fieldMobs: {},
        frostfellMobs: [],
        dungeonMobs: instMobsArr,
        dungeonMobsFull: mobRefresh || !inst._mobsStreamed,
        dungeonMobsGone: gone,
        dungeonChests: chestsChanged ? (inst.chests || []) : undefined
      });
      inst._mobsStreamed = true;
    }
  }
}

export { GameServer };
export default GameServer;
module.exports = GameServer;







