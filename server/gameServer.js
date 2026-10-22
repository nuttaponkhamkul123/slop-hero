const { MAP_WIDTH, MAP_HEIGHT, TILES, generateMap, generateFrostfellMap } = require('./mapData');
const { generateProceduralDungeon, rollDungeonLoot, DIFFICULTIES, AFFIX_POOL, DUNGEON_FLOORS } = require('./dungeonGenerator');
const { ITEMS } = require('./items');
const { FIELD_ZONES, FIELD_ZONE_BY_ID, generateFieldMap, buildFieldMobs } = require('./fieldZones');
const { expToNext, mobExp, levelGapMult } = require('./progression');

// Global tuning knob for every skill's damage against monsters
// (multiplies player.dmg * skill.dmgMult before rune/berserk/crit).
const SKILL_DAMAGE_SCALE = 0.9;

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

const SKILL_TREES = {
  warrior: [
    // Branch 1: Juggernaut (Defense, Bulk & Fortitude)
    {
      id: 'iron_skin',
      branch: 'Juggernaut (Defense)',
      tier: 1,
      name: 'Iron Skin',
      icon: '🛡️',
      desc: 'Harden body with steel resolve. +12 Armor and +80 Max HP per rank.',
      maxRank: 3,
      requires: null,
      effects: { bonusDef: 12, bonusHp: 80 }
    },
    {
      id: 'hardened_carapace',
      branch: 'Juggernaut (Defense)',
      tier: 2,
      name: 'Hardened Carapace',
      icon: '🪖',
      desc: 'Reinforce armor plates with ironclad density. +20 Armor and +120 Max HP per rank.',
      maxRank: 3,
      requires: 'iron_skin',
      effects: { bonusDef: 20, bonusHp: 120 }
    },
    {
      id: 'titan_vitality',
      branch: 'Juggernaut (Defense)',
      tier: 3,
      name: 'Titan Vitality',
      icon: '❤️',
      desc: 'Infuse blood with primordial vitality. +250 Max HP per rank.',
      maxRank: 3,
      requires: 'hardened_carapace',
      effects: { bonusHp: 250 }
    },
    {
      id: 'unyielding_thorns',
      branch: 'Juggernaut (Defense)',
      tier: 4,
      name: 'Unyielding Spikes',
      icon: '🌵',
      desc: 'Jagged steel counter-attacks. Reflects +20 Thorns damage to attackers per rank.',
      maxRank: 3,
      requires: 'titan_vitality',
      effects: { thorns: 20 }
    },
    {
      id: 'iron_fortress_mastery',
      branch: 'Juggernaut (Defense)',
      tier: 4,
      name: 'Bulwark Aegis',
      icon: '🏰',
      desc: 'Mastery of fortress stance: +25 Armor and +150 Max HP per rank.',
      maxRank: 3,
      requires: 'titan_vitality',
      effects: { bonusDef: 25, bonusHp: 150 }
    },
    {
      id: 'colossus_avatar',
      branch: 'Juggernaut (Defense)',
      tier: 5,
      isKeystone: true,
      name: 'Colossus Avatar',
      icon: '🗿',
      desc: 'KEYSTONE: Transform into an immovable stone titan. +600 Max HP, +60 Armor, and +40 Thorns.',
      maxRank: 1,
      requires: 'iron_fortress_mastery',
      effects: { bonusHp: 600, bonusDef: 60, thorns: 40 }
    },

    // Branch 2: Blademaster (Swipe, Attack Speed & Cyclone)
    {
      id: 'blade_mastery',
      branch: 'Blademaster (Cleave & Speed)',
      tier: 1,
      name: 'Blade Mastery',
      icon: '⚔️',
      desc: 'Hone edge proficiency. +10 Attack Damage and +15% Swipe Cleave per rank.',
      maxRank: 3,
      requires: null,
      effects: { bonusDmg: 10, bonusSwipe: 15 }
    },
    {
      id: 'sweeping_fury',
      branch: 'Blademaster (Cleave & Speed)',
      tier: 2,
      name: 'Sweeping Fury',
      icon: '🌊',
      desc: 'Master the Sweeping Edge arc. +25% Swipe Cleave damage per rank.',
      maxRank: 3,
      requires: 'blade_mastery',
      effects: { bonusSwipe: 25 }
    },
    {
      id: 'flurry_cadence',
      branch: 'Blademaster (Cleave & Speed)',
      tier: 3,
      name: 'Flurry Cadence',
      icon: '⚡',
      desc: 'Accelerate basic attack tempo. +15% Attack Speed and +0.3 Move Speed per rank.',
      maxRank: 3,
      requires: 'sweeping_fury',
      effects: { bonusAttackSpeed: 0.15, bonusSpeed: 0.3 }
    },
    {
      id: 'cyclone_cleave',
      branch: 'Blademaster (Cleave & Speed)',
      tier: 4,
      name: 'Cyclone Cleave',
      icon: '🌪️',
      desc: 'Empowers Whirlwind Slash: +35% damage and +0.8m cyclone radius per rank.',
      maxRank: 3,
      requires: 'flurry_cadence',
      effects: { whirlwindDmg: 0.35, whirlwindRadius: 0.8, bonusSwipe: 15 }
    },
    {
      id: 'razor_tempest',
      branch: 'Blademaster (Cleave & Speed)',
      tier: 4,
      name: 'Razor Tempest',
      icon: '🌀',
      desc: 'Blades slice air into vacuum razors. +15 Attack Damage and +12% Attack Speed per rank.',
      maxRank: 3,
      requires: 'flurry_cadence',
      effects: { bonusDmg: 15, bonusAttackSpeed: 0.12 }
    },
    {
      id: 'blade_singularity',
      branch: 'Blademaster (Cleave & Speed)',
      tier: 5,
      isKeystone: true,
      name: 'Blade Singularity',
      icon: '💫',
      desc: 'KEYSTONE: Transcendent sword perfection. +40% Attack Speed, +60% Swipe Cleave, and +25 Attack Damage.',
      maxRank: 1,
      requires: 'cyclone_cleave',
      effects: { bonusAttackSpeed: 0.40, bonusSwipe: 60, bonusDmg: 25 }
    },

    // Branch 3: Warlord Executioner (Crits, Dash & Berserk)
    {
      id: 'brutal_might',
      branch: 'Warlord (Crits & Burst)',
      tier: 1,
      name: 'Brutal Might',
      icon: '💥',
      desc: 'Devastating heavy impact. +12 Attack Damage and +8% Critical Strike Chance per rank.',
      maxRank: 3,
      requires: null,
      effects: { bonusDmg: 12, critChance: 0.08 }
    },
    {
      id: 'sundering_dash',
      branch: 'Warlord (Crits & Burst)',
      tier: 2,
      name: 'Sundering Dash',
      icon: '🏃',
      desc: 'Blade Charge leaves armor-breaking shockwave. +30% Charge damage and -0.6s cooldown.',
      maxRank: 3,
      requires: 'brutal_might',
      effects: { dashDmg: 0.30, dashCdReduce: 0.6 }
    },
    {
      id: 'seismic_shatter',
      branch: 'Warlord (Crits & Burst)',
      tier: 3,
      name: 'Seismic Shatter',
      icon: '🔨',
      desc: 'Earthshaker Slam deals +35% damage and inflicts +1.5s slow/stun per rank.',
      maxRank: 3,
      requires: 'sundering_dash',
      effects: { earthshakerDmg: 0.35, earthshakerSlow: 1.5 }
    },
    {
      id: 'bloodlust_frenzy',
      branch: 'Warlord (Crits & Burst)',
      tier: 4,
      name: 'Bloodlust Frenzy',
      icon: '🩸',
      desc: 'Thirst for carnage: restores 3% Max HP on mob kill and grants 2% Lifesteal per rank.',
      maxRank: 3,
      requires: 'seismic_shatter',
      effects: { killHealPercent: 0.03, lifeSteal: 0.02 }
    },
    {
      id: 'executioner_strike',
      branch: 'Warlord (Crits & Burst)',
      tier: 4,
      name: 'Executioner Precision',
      icon: '🗡️',
      desc: 'Savage decimation: +40% Critical Strike Damage and +15 Attack Damage per rank.',
      maxRank: 3,
      requires: 'seismic_shatter',
      effects: { critDmg: 0.40, bonusDmg: 15 }
    },
    {
      id: 'warlord_supremacy',
      branch: 'Warlord (Crits & Burst)',
      tier: 5,
      isKeystone: true,
      name: 'Warlord Supremacy',
      icon: '👑',
      desc: 'KEYSTONE: Absolute battlefield dominion. +60 Attack Damage, +25% Critical Chance, and +4% Life Leech on all hits.',
      maxRank: 1,
      requires: 'bloodlust_frenzy',
      effects: { bonusDmg: 60, critChance: 0.25, lifeSteal: 0.04 }
    }
  ],
  mage: [
    // Branch 1: Pyromancer (Firestorm, Burn & Annihilation)
    {
      id: 'infernal_touch',
      branch: 'Pyromancer (Fire & Burst)',
      tier: 1,
      name: 'Infernal Touch',
      icon: '🔥',
      desc: 'Attune spells to elemental flame. +14 Magic Damage and +12 Burn damage per rank.',
      maxRank: 3,
      requires: null,
      effects: { bonusDmg: 14 }
    },
    {
      id: 'conflagration',
      branch: 'Pyromancer (Fire & Burst)',
      tier: 2,
      name: 'Conflagration',
      icon: '☄️',
      desc: 'Intensify flame eruptions. +25% Fire damage and burns tick 30% faster per rank.',
      maxRank: 3,
      requires: 'infernal_touch',
      effects: { bonusDmg: 16 }
    },
    {
      id: 'infernal_cataclysm',
      branch: 'Pyromancer (Fire & Burst)',
      tier: 3,
      name: 'Infernal Cataclysm',
      icon: '🌋',
      desc: 'Firestorm Meteor erupts with fury: +35% damage and +1.2m impact radius per rank.',
      maxRank: 3,
      requires: 'conflagration',
      effects: { firestormDmg: 0.35, firestormRadius: 1.2 }
    },
    {
      id: 'pyroblast_focus',
      branch: 'Pyromancer (Fire & Burst)',
      tier: 4,
      name: 'Pyroblast Focus',
      icon: '💥',
      desc: 'Pyroblast cooldown reduced by 2.0s, and deals +40% direct impact damage per rank.',
      maxRank: 3,
      requires: 'infernal_cataclysm',
      effects: { bonusDmg: 20 }
    },
    {
      id: 'pyromaniac_celerity',
      branch: 'Pyromancer (Fire & Burst)',
      tier: 4,
      name: 'Pyromaniac Haste',
      icon: '⚡',
      desc: 'Flames ignite speed. +18% Attack Speed and +0.3 Move Speed per rank.',
      maxRank: 3,
      requires: 'infernal_cataclysm',
      effects: { bonusAttackSpeed: 0.18, bonusSpeed: 0.3 }
    },
    {
      id: 'phoenix_avatar',
      branch: 'Pyromancer (Fire & Burst)',
      tier: 5,
      isKeystone: true,
      name: 'Phoenix Avatar',
      icon: '🦅',
      desc: 'KEYSTONE: Become an avatar of eternal flame. +80 Magic Damage, +30% Burn Intensity, and basic attacks explode.',
      maxRank: 1,
      requires: 'pyroblast_focus',
      effects: { bonusDmg: 80, bonusAttackSpeed: 0.15 }
    },

    // Branch 2: Cryomancer (Frost Nova, Blizzard & Ice Barrier)
    {
      id: 'frost_shroud',
      branch: 'Cryomancer (Ice & Defense)',
      tier: 1,
      name: 'Frost Shroud',
      icon: '❄️',
      desc: 'Layer of glacial rime. +12 Armor and +70 Max MP per rank.',
      maxRank: 3,
      requires: null,
      effects: { bonusDef: 12, bonusMp: 70 }
    },
    {
      id: 'glacial_tomb',
      branch: 'Cryomancer (Ice & Defense)',
      tier: 2,
      name: 'Glacial Tomb',
      icon: '🧊',
      desc: 'Frost Nova freezes deep: +30% damage and +2.0s chill freeze duration per rank.',
      maxRank: 3,
      requires: 'frost_shroud',
      effects: { frostNovaDmg: 0.30, frostNovaChill: 2.0 }
    },
    {
      id: 'absolute_zero',
      branch: 'Cryomancer (Ice & Defense)',
      tier: 3,
      name: 'Absolute Zero',
      icon: '🌨️',
      desc: 'Blizzard slows enemies by 75% and inflicts biting frost dealing +25% damage per rank.',
      maxRank: 3,
      requires: 'glacial_tomb',
      effects: { bonusDef: 15, bonusMp: 100 }
    },
    {
      id: 'mana_shield_fortress',
      branch: 'Cryomancer (Ice & Defense)',
      tier: 4,
      name: 'Crystal Aegis',
      icon: '🛡️',
      desc: 'Mana Shield absorbs +160 additional damage and grants +20 Armor per rank.',
      maxRank: 3,
      requires: 'absolute_zero',
      effects: { bonusDef: 20, bonusHp: 150 }
    },
    {
      id: 'shatter_strike',
      branch: 'Cryomancer (Ice & Defense)',
      tier: 4,
      name: 'Shatter Strike',
      icon: '💎',
      desc: 'Chilled and frozen enemies take +40% Critical Strike damage per rank.',
      maxRank: 3,
      requires: 'absolute_zero',
      effects: { critDmg: 0.40, critChance: 0.08 }
    },
    {
      id: 'permafrost_ascendance',
      branch: 'Cryomancer (Ice & Defense)',
      tier: 5,
      isKeystone: true,
      name: 'Permafrost Ascendance',
      icon: '🏔️',
      desc: 'KEYSTONE: Sovereign of the Frozen Throne. +50 Armor, +500 Max MP, and attackers are instantly chilled.',
      maxRank: 1,
      requires: 'mana_shield_fortress',
      effects: { bonusDef: 50, bonusMp: 500 }
    },

    // Branch 3: Archmage Void (Mana, Cooldown, Black Hole & Blink)
    {
      id: 'arcane_intellect',
      branch: 'Archmage (Void & Mana)',
      tier: 1,
      name: 'Arcane Intellect',
      icon: '📖',
      desc: 'Ancient grimoire comprehension. +12 Magic Damage and +80 Max MP per rank.',
      maxRank: 3,
      requires: null,
      effects: { bonusDmg: 12, bonusMp: 80 }
    },
    {
      id: 'mana_surge',
      branch: 'Archmage (Void & Mana)',
      tier: 2,
      name: 'Mana Surge',
      icon: '💧',
      desc: 'Deepen arcane wellspring: +4 MP/s regeneration and reduces skill MP costs by 15% per rank.',
      maxRank: 3,
      requires: 'arcane_intellect',
      effects: { mpRegenBonus: 4, mpCostDiscount: 0.15 }
    },
    {
      id: 'arcane_haste',
      branch: 'Archmage (Void & Mana)',
      tier: 3,
      name: 'Blink Mastery',
      icon: '🌀',
      desc: 'Arcane Blink distance +1.8m and cooldown reduced by 0.8s per rank.',
      maxRank: 3,
      requires: 'mana_surge',
      effects: { blinkDist: 1.8, blinkCdReduce: 0.8 }
    },
    {
      id: 'astral_overload',
      branch: 'Archmage (Void & Mana)',
      tier: 4,
      name: 'Astral Overload',
      icon: '🔮',
      desc: 'Spells cause cosmic resonance: restores 40 MP on kill and +20 Magic Damage per rank.',
      maxRank: 3,
      requires: 'arcane_haste',
      effects: { killManaRestore: 40, bonusDmg: 20 }
    },
    {
      id: 'singularity_collapse',
      branch: 'Archmage (Void & Mana)',
      tier: 4,
      name: 'Event Horizon',
      icon: '🕳️',
      desc: 'Black Hole pulls 50% stronger, radius +1.2m, and deals +40% crushing damage per rank.',
      maxRank: 3,
      requires: 'arcane_haste',
      effects: { bonusDmg: 22, bonusMp: 120 }
    },
    {
      id: 'cosmic_ascension',
      branch: 'Archmage (Void & Mana)',
      tier: 5,
      isKeystone: true,
      name: 'Cosmic Ascension',
      icon: '🌌',
      desc: 'KEYSTONE: Master of Space and Time. +85 Magic Damage, -25% All Skill Cooldowns, and +30% Attack Speed.',
      maxRank: 1,
      requires: 'astral_overload',
      effects: { bonusDmg: 85, bonusAttackSpeed: 0.30 }
    }
  ],
  rogue: [
    // Branch 1: Shadow Assassin (Crits, Ambush & Death Blossom)
    {
      id: 'deadly_precision',
      branch: 'Shadow Assassin (Crits)',
      tier: 1,
      name: 'Deadly Precision',
      icon: '🎯',
      desc: 'Pierce pressure points. +12 Attack Damage and +12% Critical Strike Chance per rank.',
      maxRank: 3,
      requires: null,
      effects: { bonusDmg: 12, critChance: 0.12 }
    },
    {
      id: 'lethal_ambush',
      branch: 'Shadow Assassin (Crits)',
      tier: 2,
      name: 'Lethal Ambush',
      icon: '🗡️',
      desc: 'Strikes from unseen angles. +40% Critical Strike Damage per rank.',
      maxRank: 3,
      requires: 'deadly_precision',
      effects: { critDmg: 0.40 }
    },
    {
      id: 'shadowstep_strike',
      branch: 'Shadow Assassin (Crits)',
      tier: 3,
      name: 'Shadowstep Strike',
      icon: '👤',
      desc: 'Shadowstep deals +45% damage and teleports behind enemy with 100% crit chance per rank.',
      maxRank: 3,
      requires: 'lethal_ambush',
      effects: { bonusDmg: 16 }
    },
    {
      id: 'death_blossom_flurry',
      branch: 'Shadow Assassin (Crits)',
      tier: 4,
      name: 'Death Blossom Flurry',
      icon: '🌸',
      desc: 'Death Blossom omnislash +40% damage, +1.2m radius, and -1.5s cooldown per rank.',
      maxRank: 3,
      requires: 'shadowstep_strike',
      effects: { bonusDmg: 22 }
    },
    {
      id: 'assassin_momentum',
      branch: 'Shadow Assassin (Crits)',
      tier: 4,
      name: 'Shadow Momentum',
      icon: '💨',
      desc: 'Critical strikes increase Move Speed by 30% for 4s and grant +15% Attack Speed.',
      maxRank: 3,
      requires: 'shadowstep_strike',
      effects: { bonusSpeed: 0.35, bonusAttackSpeed: 0.15 }
    },
    {
      id: 'master_of_shadows',
      branch: 'Shadow Assassin (Crits)',
      tier: 5,
      isKeystone: true,
      name: 'Master of Shadows',
      icon: '🖤',
      desc: 'KEYSTONE: Supreme ghost executioner. +35% Critical Chance, +80% Critical Damage, and kills reset Dash.',
      maxRank: 1,
      requires: 'death_blossom_flurry',
      effects: { critChance: 0.35, critDmg: 0.80, bonusDmg: 40 }
    },

    // Branch 2: Venomous Saboteur (Poison DoT & Traps)
    {
      id: 'toxic_potency',
      branch: 'Venomous Saboteur (Poison)',
      tier: 1,
      name: 'Toxic Potency',
      icon: '🧪',
      desc: 'Refine virulent toxins. +10 Poison damage/tick and poison duration +2.0s per rank.',
      maxRank: 3,
      requires: null,
      effects: { bonusDmg: 10 }
    },
    {
      id: 'venomous_knives',
      branch: 'Venomous Saboteur (Poison)',
      tier: 2,
      name: 'Venomous Daggers',
      icon: '🔪',
      desc: 'Fan of Knives fires poisoned blades: +35% damage and coats targets in deadly neurotoxin.',
      maxRank: 3,
      requires: 'toxic_potency',
      effects: { knivesDmg: 0.35, knivesPoison: true }
    },
    {
      id: 'noxious_cloud',
      branch: 'Venomous Saboteur (Poison)',
      tier: 3,
      name: 'Noxious Cloud',
      icon: '☠️',
      desc: 'Toxic Bomb cloud expands: +1.0m radius and +6 poison damage per tick per rank.',
      maxRank: 3,
      requires: 'venomous_knives',
      effects: { smokeRadius: 1.0, smokePoisonDmg: 6 }
    },
    {
      id: 'barbed_caltrops_trap',
      branch: 'Venomous Saboteur (Poison)',
      tier: 4,
      name: 'Barbed Caltrops Trap',
      icon: '⛓️',
      desc: 'Caltrops slow enemies by 75% and cause severe hemorrhaging bleed for 18 dmg/s.',
      maxRank: 3,
      requires: 'noxious_cloud',
      effects: { bonusDmg: 18, bonusDef: 12 }
    },
    {
      id: 'corrosive_venom',
      branch: 'Venomous Saboteur (Poison)',
      tier: 4,
      name: 'Corrosive Acid',
      icon: '🟢',
      desc: 'Acid melts armor: poisoned targets take +25% increased damage from all attacks.',
      maxRank: 3,
      requires: 'noxious_cloud',
      effects: { bonusDmg: 20 }
    },
    {
      id: 'epidemic_catalyst',
      branch: 'Venomous Saboteur (Poison)',
      tier: 5,
      isKeystone: true,
      name: 'Epidemic Catalyst',
      icon: '☣️',
      desc: 'KEYSTONE: Sovereign of biological ruin. +60 Attack Damage, poisons deal double damage, and dying enemies detonate.',
      maxRank: 1,
      requires: 'barbed_caltrops_trap',
      effects: { bonusDmg: 60 }
    },

    // Branch 3: Windrunner Duelist (Attack Speed, Swipe & Dodge)
    {
      id: 'fleet_footwork',
      branch: 'Windrunner Duelist (Speed & Swipe)',
      tier: 1,
      name: 'Fleet Footwork',
      icon: '👟',
      desc: 'Agile acrobatic movements. +0.45 Move Speed and +8 Armor per rank.',
      maxRank: 3,
      requires: null,
      effects: { bonusSpeed: 0.45, bonusDef: 8 }
    },
    {
      id: 'wind_flurry',
      branch: 'Windrunner Duelist (Speed & Swipe)',
      tier: 2,
      name: 'Wind Flurry',
      icon: '🌪️',
      desc: 'High-velocity twin blade flurries. +20% Attack Speed per rank.',
      maxRank: 3,
      requires: 'fleet_footwork',
      effects: { bonusAttackSpeed: 0.20 }
    },
    {
      id: 'sweeping_daggers',
      branch: 'Windrunner Duelist (Speed & Swipe)',
      tier: 3,
      name: 'Sweeping Daggers',
      icon: '⚔️',
      desc: 'Extend basic attack cleave. +30% Swipe Cleave damage per rank.',
      maxRank: 3,
      requires: 'wind_flurry',
      effects: { bonusSwipe: 30 }
    },
    {
      id: 'shadow_sprint_haste',
      branch: 'Windrunner Duelist (Speed & Swipe)',
      tier: 4,
      name: 'Shadow Sprint Haste',
      icon: '⚡',
      desc: 'Shadow Dash sprint duration +1.5s and cooldown reduced by 0.7s per rank.',
      maxRank: 3,
      requires: 'sweeping_daggers',
      effects: { dashSprintBonus: 1.5, dashCdReduce: 0.7 }
    },
    {
      id: 'evasive_reflexes',
      branch: 'Windrunner Duelist (Speed & Swipe)',
      tier: 4,
      name: 'Evasive Reflexes',
      icon: '🍃',
      desc: 'Instinctive parrying: grants 15% chance to completely Dodge any incoming attack per rank.',
      maxRank: 3,
      requires: 'sweeping_daggers',
      effects: { dodgeChance: 0.15 }
    },
    {
      id: 'phantom_duelist',
      branch: 'Windrunner Duelist (Speed & Swipe)',
      tier: 5,
      isKeystone: true,
      name: 'Phantom Duelist',
      icon: '🎭',
      desc: 'KEYSTONE: Flurry phantom avatar. +40% Attack Speed, +45% Swipe Cleave, and +25% Dodge Chance.',
      maxRank: 1,
      requires: 'evasive_reflexes',
      effects: { bonusAttackSpeed: 0.40, bonusSwipe: 45, dodgeChance: 0.25, bonusDmg: 30 }
    }
  ]
};

class GameServer {
  constructor(io) {
    this.io = io;
    this.townMap = generateMap();

    // Level-chained open-world field zones (Frostfell Lv 6 ... Celestial Reach Lv 100)
    this.fields = new Map();
    FIELD_ZONES.forEach(zone => {
      this.fields.set(zone.id, { zone, map: generateFieldMap(zone), mobs: new Map(), groundItems: new Map() });
    });
    const frostfell = this.fields.get('frostfell');
    this.frostfellMap = frostfell.map;
    this.dungeonFloor = 1;
    this.dungeonDifficulty = 'normal';
    this.dungeon = generateProceduralDungeon(this.dungeonFloor, this.dungeonDifficulty);

    this.players = new Map();
    this.townMobs = new Map();
    this.frostfellMobs = frostfell.mobs;
    this.dungeonMobs = new Map();

    this.townGroundItems = new Map();
    this.frostfellGroundItems = frostfell.groundItems;
    this.dungeonGroundItems = new Map();

    this.projectiles = new Map();
    this.nextEntityId = 1000;

    this.TICK_RATE = 25;
    this.tickInterval = null;

    this.initTownMonsters();
    this.initFrostfellMonsters();
    this.initFieldMonsters();
    this.initDungeonMonsters();
    this.startGameLoop();
  }

  // --- zone rooms: every socket sits in the room of the zone it is in, and
  // gameplay events are only sent to that room ---
  emitZone(zone, event, data) {
    if (!zone) return this.io.emit(event, data);
    this.io.to(`zone:${zone}`).emit(event, data);
  }

  syncZoneRooms() {
    for (const player of this.players.values()) {
      if (player._room === player.zone) continue;
      const socket = this.io.sockets.sockets.get(player.id);
      if (!socket) continue;
      if (player._room) socket.leave(`zone:${player._room}`);
      socket.join(`zone:${player.zone}`);
      player._room = player.zone;
    }
  }

  // --- zone lookups (town / field zones / dungeon) ---
  getMobsMap(zone) {
    if (zone === 'town') return this.townMobs;
    if (this.fields.has(zone)) return this.fields.get(zone).mobs;
    return this.dungeonMobs;
  }

  getGroundItemsMap(zone) {
    if (zone === 'town') return this.townGroundItems;
    if (this.fields.has(zone)) return this.fields.get(zone).groundItems;
    return this.dungeonGroundItems;
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
    this.frostfellMobs.clear();
    const frostDefs = [
      { type: 'frost_wolf', name: 'Frostbite Wolf', level: 6, maxHp: 550, def: 15, dmg: 38, speed: 3.8, exp: 160, gold: 90, count: 6, buffs: ['frostbite'], zone: { minX: 5, maxX: 18, minY: 20, maxY: 33 } },
      { type: 'ice_elemental', name: 'Glacial Elemental', level: 8, maxHp: 750, def: 20, dmg: 48, speed: 2.5, exp: 240, gold: 140, count: 6, buffs: ['frostbite'], zone: { minX: 24, maxX: 38, minY: 8, maxY: 25 } },
      { type: 'frost_titan', name: 'Frost Titan Ymir', level: 12, maxHp: 2800, def: 35, dmg: 75, speed: 2.2, exp: 950, gold: 750, count: 1, buffs: ['frostbite', 'fortified'], zone: { minX: 19, maxX: 23, minY: 16, maxY: 20 }, isBoss: true }
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

  initTownMonsters() {
    this.townMobs.clear();
    const mobDefinitions = [
      { type: 'slime', name: 'Meadow Slime', level: 1, maxHp: 120, def: 5, dmg: 14, speed: 2.3, exp: 35, gold: 15, count: 6, zone: { minX: 4, maxX: 14, minY: 4, maxY: 14 } },
      { type: 'goblin', name: 'Goblin Scout', level: 3, maxHp: 260, def: 10, dmg: 22, speed: 3.2, exp: 75, gold: 35, count: 6, zone: { minX: 27, maxX: 38, minY: 18, maxY: 35 } },
      { type: 'skeleton', name: 'Ancient Skeleton', level: 5, maxHp: 440, def: 16, dmg: 32, speed: 2.8, exp: 140, gold: 75, count: 5, zone: { minX: 5, maxX: 14, minY: 27, maxY: 37 } },
      { type: 'golem', name: 'Titan Stone Golem', level: 8, maxHp: 1400, def: 26, dmg: 52, speed: 2.0, exp: 450, gold: 300, count: 1, zone: { minX: 8, maxX: 10, minY: 31, maxY: 33 }, isBoss: true }
    ];

    mobDefinitions.forEach(def => {
      for (let i = 0; i < def.count; i++) {
        const id = `mob_${this.nextEntityId++}`;
        const spawnX = def.zone.minX + Math.random() * (def.zone.maxX - def.zone.minX);
        const spawnY = def.zone.minY + Math.random() * (def.zone.maxY - def.zone.minY);

        this.townMobs.set(id, {
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
          buffs: [],
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
      const dungeon = this.dungeon;
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
        // 7 = WALL, 8 = VOID
        if (tile === 7 || tile === 8) return true;
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

    const chosenClass = defaultClasses[data.characterClass] ? data.characterClass : 'warrior';
    const classStats = defaultClasses[chosenClass];

    const spawnX = 20 + (Math.random() - 0.5) * 2;
    const spawnY = 23 + (Math.random() - 0.5) * 1.5; // Spawn in open south plaza, away from fountain

    const player = {
      id: socket.id,
      name: (data.name || 'Hero').substring(0, 15).trim() || 'Hero',
      characterClass: chosenClass,
      zone: 'town', // 'town', 'frostfell', or 'dungeon'
      x: spawnX,
      y: spawnY,
      targetX: null,
      targetY: null,
      moveDir: { dx: 0, dy: 0 },
      facing: 'SE',
      isMoving: false,
      level: 1,
      exp: 0,
      expNext: expToNext(1),
      skillPoints: 1,
      skills: {}, // { [skillId]: rank }
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
      equipment: {
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
      gold: 50,
      inventory: {
        healthPotions: 3,
        manaPotions: 2,
        kills: 0,
        items: [
          { ...ITEMS.ancient_ruby, count: 1 } // Starter relic to try shop selling!
        ]
      },
      attackCooldown: 0,
      skillCooldown: 0,
      equippedSkills: JSON.parse(JSON.stringify(DEFAULT_EQUIPPED_SKILLS[chosenClass] || DEFAULT_EQUIPPED_SKILLS.warrior)),
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
      skillRunes: SKILL_RUNES
    });

    socket.broadcast.emit('player_joined', player);
    this.broadcastSystemMessage(`⚔️ [${player.name} the ${player.characterClass.toUpperCase()}] entered the realm!`);
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      // Disconnecting mid-run forfeits the escrowed chest loot
      player.dungeonRun = null;
      this.players.delete(socketId);
      this.io.emit('player_left', socketId);
      this.broadcastSystemMessage(`🚪 [${player.name}] has departed.`);
    }
  }

  handlePlayerInput(socketId, input) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    if (input.type === 'click_move') {
      let maxX = MAP_WIDTH - 2;
      let maxY = MAP_HEIGHT - 2;
      if (player.zone === 'dungeon' && this.dungeon) {
        maxX = this.dungeon.width - 2;
        maxY = this.dungeon.height - 2;
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

  // Handle Portals & Chests
  checkPortalAndInteractions(player, socket) {
    if (player.portalCooldown > 0) return;

    if (player.zone === 'town') {
      // 1. Abyssal Dungeon Portal (North-East, 23.5, 16.5)
      const distToDungeonPortal = Math.hypot(player.x - 23.5, player.y - 16.5);
      if (distToDungeonPortal < 1.3) {
        player.portalCooldown = 2.0;
        socket.emit('open_dungeon_portal_modal');
        return;
      }

      // 2. Frostfell Peaks Portal (North-West, 16.5, 16.5)
      const distToFrostfell = Math.hypot(player.x - 16.5, player.y - 16.5);
      if (distToFrostfell < 1.3) {
        this.teleportPlayerToField(player, socket, 'frostfell', 'south');
        return;
      }
    } else if (player.zone === 'dungeon') {
      const exitP = this.dungeon.exitPortal;
      const distToExit = Math.hypot(player.x - exitP.x, player.y - exitP.y);
      if (distToExit < 1.3) {
        this.teleportPlayerToTown(player, socket);
        return;
      }

      // Boss chamber exit (back to town)
      const bossExit = this.dungeon.bossExitPortal;
      if (bossExit && Math.hypot(player.x - bossExit.x, player.y - bossExit.y) < 1.3) {
        this.teleportPlayerToTown(player, socket);
        return;
      }

      // Teleport point at the end of the dungeon path -> boss chamber
      const bossP = this.dungeon.bossPortal;
      if (bossP && Math.hypot(player.x - bossP.x, player.y - bossP.y) < 1.3) {
        const arrival = this.dungeon.bossArrival;
        player.portalCooldown = 3.0;
        player.x = arrival.x;
        player.y = arrival.y;
        player.targetX = null;
        player.targetY = null;
        socket.emit('zone_change', {
          zone: 'dungeon',
          map: this.dungeon,
          floorLevel: this.dungeonFloor,
          difficulty: this.dungeonDifficulty,
          player,
          players: Array.from(this.players.values()).filter(p => p.zone === 'dungeon'),
          mobs: Array.from(this.dungeonMobs.values()),
          groundItems: Array.from(this.dungeonGroundItems.values()),
          chests: this.dungeon.chests
        });
        socket.emit('floating_text', { x: player.x, y: player.y - 0.8, text: 'BOSS CHAMBER', color: '#ef4444', size: 20 });
        this.broadcastSystemMessage(`⚔️ [${player.name}] stepped into the Boss Chamber!`);
      }
    } else if (this.fields.has(player.zone)) {
      // Field zone portals: back to the previous zone / on to the next one
      const map = this.fields.get(player.zone).map;
      for (const obs of map.obstacles) {
        if (obs.type !== 'field_portal') continue;
        if (Math.hypot(player.x - obs.x, player.y - obs.y) >= 1.3) continue;
        if (obs.target === 'town') this.teleportPlayerToTown(player, socket);
        else this.teleportPlayerToField(player, socket, obs.target, obs.arrive);
        return;
      }
    }
  }

  handleEnterDungeon(socketId, options = {}) {
    const player = this.players.get(socketId);
    if (!player || player.zone !== 'town' || player.isDead) return;
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return;

    const floor = Math.max(1, Math.min(10, parseInt(options.floor, 10) || 1));
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

    const difficulty = ['normal', 'hard', 'nightmare'].includes(options.difficulty) ? options.difficulty : 'normal';

    // Regenerate procedural dungeon with chosen floor and difficulty
    this.regenerateDungeon(floor, difficulty);
    player.dungeonRun = { floor, difficulty, cleared: false, gold: 0, items: [] };
    this.teleportPlayerToDungeon(player, socket);
    this.emitDungeonRunUpdate(player, socket);
  }

  handleLeaveDungeon(socketId) {
    const player = this.players.get(socketId);
    if (!player || player.zone !== 'dungeon' || player.isDead) return;
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) this.teleportPlayerToTown(player, socket);
  }

  teleportPlayerToDungeon(player, socket) {
    player.portalCooldown = 4.0; // 4 second cooldown prevents bounce-back
    player.zone = 'dungeon';
    player.x = this.dungeon.spawnPoint.x;
    player.y = this.dungeon.spawnPoint.y;
    player.targetX = null;
    player.targetY = null;

    socket.emit('zone_change', {
      zone: 'dungeon',
      map: this.dungeon,
      floorLevel: this.dungeonFloor,
      difficulty: this.dungeonDifficulty,
      player,
      players: Array.from(this.players.values()).filter(p => p.zone === 'dungeon'),
      mobs: Array.from(this.dungeonMobs.values()),
      groundItems: Array.from(this.dungeonGroundItems.values()),
      chests: this.dungeon.chests
    });

    const floorConfig = DUNGEON_FLOORS[this.dungeonFloor - 1] || { name: `Floor ${this.dungeonFloor}` };
    const diffName = (DIFFICULTIES[this.dungeonDifficulty] && DIFFICULTIES[this.dungeonDifficulty].name) || this.dungeonDifficulty;
    this.broadcastSystemMessage(`🌀 [${player.name}] entered ${floorConfig.name} (B${this.dungeonFloor} - ${diffName})!`);
  }

  // Move a player into a field zone, arriving at its south (from the previous
  // zone) or north (coming back from the next zone) portal.
  teleportPlayerToField(player, socket, zoneId, arrive = 'south') {
    const field = this.fields.get(zoneId);
    if (!field) return;
    const zone = field.zone;
    if ((player.level || 1) < zone.gateLevel) {
      player.portalCooldown = 2.0;
      socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `⛔ ${zone.name} requires Level ${zone.gateLevel}+!`, color: '#ef4444' });
      return;
    }

    const spot = (field.map.arrivals && field.map.arrivals[arrive]) || field.map.spawnPoint || { x: 21, y: 32 };
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
      groundItems: Array.from(field.groundItems.values())
    });

    this.broadcastSystemMessage(`🧭 [${player.name}] ventured into ${zone.name} (Lv. ${zone.minLevel}-${zone.maxLevel})!`);
  }

  teleportPlayerToFrostfell(player, socket) {
    this.teleportPlayerToField(player, socket, 'frostfell', 'south');
  }

  teleportPlayerToTown(player, socket) {
    if (player.zone === 'dungeon') this.endDungeonRun(player, socket);
    player.portalCooldown = 4.0; // 4 second cooldown prevents bounce-back
    player.zone = 'town';
    player.x = 21.0;
    player.y = 19.0;
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
      pointsSpent += (rank || 0);
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

    const chest = this.dungeon.chests.find(c => c.id === chestId);
    if (!chest || chest.opened) return;

    const dist = Math.hypot(chest.x - player.x, chest.y - player.y);
    if (dist <= 2.5) {
      chest.opened = true;
      const loot = rollDungeonLoot(chest.isGold, this.dungeonFloor);
      const socket = this.io.sockets.sockets.get(socketId);

      // Chest loot is only secured once the dungeon is cleared: until the boss
      // falls it is held in the run's loot bag (see endDungeonRun).
      if (!player.dungeonRun) {
        player.dungeonRun = { floor: this.dungeonFloor, difficulty: this.dungeonDifficulty, cleared: false, gold: 0, items: [] };
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

      this.emitZone('dungeon', 'chest_opened', { chestId, openedBy: player.name });
      this.emitZone('dungeon', 'floating_text', {
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
      this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '💥 AMBUSH CRITICAL!', color: '#f59e0b', size: 20 });
    }

    let attackDmg = player.dmg;
    if (player.berserkTimer > 0) {
      attackDmg = Math.round(attackDmg * 1.35);
    }

    let hasSweepTriggered = false;

    if (player.characterClass === 'mage') {
      // Mage Ranged Projectiles
      if (targetMob) {
        const dist = Math.hypot(targetMob.x - player.x, targetMob.y - player.y);
        if (dist <= player.attackRange + 1.0) {
          this.spawnProjectile(player, targetMob.x, targetMob.y, targetMob.id, 'mob', attackDmg);
        }
      } else if (targetInfo && targetInfo.worldX !== undefined && targetInfo.worldY !== undefined) {
        this.spawnProjectile(player, targetInfo.worldX, targetInfo.worldY, null, 'point', attackDmg);
      } else {
        const facingVectors = {
          E: { x: 1, y: 0 }, SE: { x: 0.707, y: 0.707 }, S: { x: 0, y: 1 }, SW: { x: -0.707, y: 0.707 },
          W: { x: -1, y: 0 }, NW: { x: -0.707, y: -0.707 }, N: { x: 0, y: -1 }, NE: { x: 0.707, y: -0.707 }
        };
        const fv = facingVectors[player.facing] || { x: 1, y: 0 };
        this.spawnProjectile(player, player.x + fv.x * 6, player.y + fv.y * 6, null, 'point', attackDmg);
      }
    } else {
      // Melee basic attacks with Minecraft-style Sweeping Edge cleave!
      const hitMobs = new Set();
      let primaryHit = false;

      // 1. Primary target damage
      if (targetMob) {
        const dist = Math.hypot(targetMob.x - player.x, targetMob.y - player.y);
        if (dist <= player.attackRange + 1.1) {
          this.applyDamageToMob(player, targetMob, attackDmg, isCrit);
          hitMobs.add(targetMob.id);
          primaryHit = true;
          if (player.berserkTimer > 0) {
            const maxHeal = Math.max(2, Math.round(player.maxHp * 0.04));
            const lifesteal = Math.min(maxHeal, Math.max(1, Math.round(attackDmg * 0.04)));
            player.hp = Math.min(player.maxHp, player.hp + lifesteal);
          }
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
            this.applyDamageToMob(player, mob, swipeDmg, false);
            this.emitZone(player.zone, 'floating_text', {
              x: mob.x,
              y: mob.y - 0.7,
              text: `⚔️ Sweep -${swipeDmg}`,
              color: '#38bdf8',
              size: 15
            });
          }
        }
      }
    }

    this.emitZone(player.zone, 'entity_attack_fx', {
      attackerId: player.id,
      attackerType: 'player',
      class: player.characterClass,
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

  handlePlayerSkill(socketId, skillData = {}) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    const rawSlot = skillData.skillSlot || 'slot1';
    const slot = (rawSlot === 'skill1') ? 'slot1' : (rawSlot === 'skill2') ? 'slot2' : rawSlot;

    if (!player.equippedSkills) {
      player.equippedSkills = JSON.parse(JSON.stringify(DEFAULT_EQUIPPED_SKILLS[player.characterClass] || DEFAULT_EQUIPPED_SKILLS.warrior));
    }
    if (!player.skillCooldowns) {
      player.skillCooldowns = { slot1: 0, slot2: 0, slot3: 0, dash: 0, skill1: 0, skill2: 0 };
    }
    if (player.skillCooldowns[slot] > 0 || (player.skillCooldowns[rawSlot] > 0)) return;

    const skillId = player.equippedSkills[slot] || (DEFAULT_EQUIPPED_SKILLS[player.characterClass] && DEFAULT_EQUIPPED_SKILLS[player.characterClass][slot]) || 'whirlwind';
    const skill = ALL_CLASS_SKILLS[skillId] || ALL_CLASS_SKILLS.whirlwind;
    const runeId = (player.equippedSkills.runes && player.equippedSkills.runes[slot]) || 'none';

    const socket = this.io.sockets.sockets.get(socketId);
    const playerTalents = player.skills || {};

    let mpCost = skill.mpCost;
    if (playerTalents.mana_flow) {
      mpCost = Math.max(2, Math.round(mpCost * (1 - playerTalents.mana_flow * 0.15)));
    }

    if (player.mp < mpCost) {
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

    player.mp -= mpCost;
    player.skillCooldowns[slot] = cooldown;
    player.skillCooldowns[rawSlot] = cooldown;
    if (slot === 'slot1') player.skillCooldown = cooldown;

    if (socket) socket.emit('player_updated', player);

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
    switch (skill.id) {
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

    if (player.equipment) {
      for (const eq of Object.values(player.equipment)) {
        if (!eq) continue;
        if (eq.bonusDmg) totalBonusDmg += eq.bonusDmg;
        if (eq.bonusDef) totalBonusDef += eq.bonusDef;
        if (eq.bonusHp) totalBonusHp += eq.bonusHp;
        if (eq.bonusMp) totalBonusMp += eq.bonusMp;
        if (eq.bonusSpeed) totalBonusSpeed += eq.bonusSpeed;
        if (eq.bonusAttackSpeed) totalBonusAttackSpeed += eq.bonusAttackSpeed;
        if (eq.bonusSwipe) totalBonusSwipe += eq.bonusSwipe;
      }
    }

    // Talent tree passive bonuses
    if (player.skills) {
      const tree = SKILL_TREES[player.characterClass] || [];
      for (const talent of tree) {
        const rank = player.skills[talent.id] || 0;
        if (rank > 0 && talent.effects) {
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

    player.dmg = player.baseStats.dmg + totalBonusDmg;
    player.def = player.baseStats.def + totalBonusDef;
    player.maxHp = player.baseStats.maxHp + totalBonusHp;
    player.maxMp = player.baseStats.maxMp + totalBonusMp;
    player.speed = Number((player.baseStats.speed + totalBonusSpeed).toFixed(2));
    player.attackSpeed = Number(((player.baseStats.attackSpeed || 1.0) + totalBonusAttackSpeed).toFixed(2));
    player.swipe = Math.round((player.baseStats.swipe || 0) + totalBonusSwipe);
    player.critChanceBonus = Number(totalCritChanceBonus.toFixed(3));
    player.critDmgBonus = Number(totalCritDmgBonus.toFixed(3));
    player.thorns = Math.round(totalThorns);
    player.dodgeChance = Number(totalDodgeChance.toFixed(3));
    player.lifeSteal = Math.min(0.08, Number(totalLifeSteal.toFixed(3)));

    player.hp = Math.min(player.hp, player.maxHp);
    player.mp = Math.min(player.mp, player.maxMp);
  }

  handleEquipItem(socketId, itemIndex) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    if (itemIndex < 0 || itemIndex >= player.inventory.items.length) return;
    const item = player.inventory.items[itemIndex];
    if (!item || item.type !== 'equipment' || !item.slot) return;

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
  handleBuyItem(socketId, itemId) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    const itemDef = ITEMS[itemId];
    if (!itemDef || !itemDef.buyPrice || itemDef.type !== 'consumable') return;

    const socket = this.io.sockets.sockets.get(socketId);

    if (player.gold < itemDef.buyPrice) {
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.6,
          text: `⚠️ Need ${itemDef.buyPrice} Gold!`,
          color: '#ef4444'
        });
      }
      return;
    }

    player.gold -= itemDef.buyPrice;

    if (itemDef.id === 'health_potion') {
      player.inventory.healthPotions++;
    } else if (itemDef.id === 'mana_potion') {
      player.inventory.manaPotions++;
    } else {
      const existing = player.inventory.items.find(i => i.id === itemDef.id);
      if (existing) {
        existing.count = (existing.count || 1) + 1;
      } else {
        player.inventory.items.push({ ...itemDef, count: 1 });
      }
    }

    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.6,
        text: `Bought ${itemDef.name}!`,
        color: '#facc15'
      });
    }
  }

  handleSellItem(socketId, itemIndex) {
    const player = this.players.get(socketId);
    if (!player || player.isDead || player.zone !== 'town') return;

    if (itemIndex < 0 || itemIndex >= player.inventory.items.length) return;

    const item = player.inventory.items[itemIndex];
    const sellPrice = item.sellPrice || 10;

    player.gold += sellPrice;

    if (item.count > 1) {
      item.count--;
    } else {
      player.inventory.items.splice(itemIndex, 1);
    }

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.6,
        text: `+${sellPrice} Gold (Sold ${item.name})`,
        color: '#facc15'
      });
    }
  }

  // Reforge / Enhancement NPC Blacksmith Actions (Brom the Master Smith)
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

    const curLvl = targetItem.upgradeLevel || 0;
    if (curLvl >= 10) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: '⚠️ Item already at MAX +10!',
          color: '#facc15'
        });
      }
      return;
    }

    // Reforge Success Rates & Costs (MMORPG Reforge Table)
    const reforgeTable = [
      { rate: 1.0, cost: 50, canDowngrade: false },   // +0 -> +1 (100%)
      { rate: 1.0, cost: 80, canDowngrade: false },   // +1 -> +2 (100%)
      { rate: 1.0, cost: 120, canDowngrade: false },  // +2 -> +3 (100% Safe)
      { rate: 0.85, cost: 180, canDowngrade: false }, // +3 -> +4 (85%)
      { rate: 0.75, cost: 260, canDowngrade: false }, // +4 -> +5 (75%)
      { rate: 0.65, cost: 360, canDowngrade: false }, // +5 -> +6 (65%)
      { rate: 0.50, cost: 500, canDowngrade: false }, // +6 -> +7 (50%)
      { rate: 0.40, cost: 700, canDowngrade: true },  // +7 -> +8 (40%, safe or -1)
      { rate: 0.30, cost: 950, canDowngrade: true },  // +8 -> +9 (30%, safe or -1)
      { rate: 0.20, cost: 1300, canDowngrade: true }  // +9 -> +10 (20%, safe or -1)
    ];

    const forgeConfig = reforgeTable[curLvl] || { rate: 0.15, cost: 1800, canDowngrade: true };
    const socket = this.io.sockets.sockets.get(socketId);

    if (player.gold < forgeConfig.cost) {
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: `⚠️ Need ${forgeConfig.cost} Gold!`,
          color: '#ef4444'
        });
      }
      return;
    }

    // Deduct cost
    player.gold -= forgeConfig.cost;

    const roll = Math.random();
    const isSuccess = roll < forgeConfig.rate;

    if (isSuccess) {
      const newLvl = curLvl + 1;
      targetItem.upgradeLevel = newLvl;
      this.applyItemUpgradeStats(targetItem);

      if (isEquipped) {
        this.recalculatePlayerStats(player);
      }

      if (socket) {
        socket.emit('player_updated', player);
        socket.emit('reforge_result', {
          success: true,
          item: targetItem,
          oldLevel: curLvl,
          newLevel: newLvl,
          target: data.target,
          slot: data.slot,
          itemIndex: data.itemIndex
        });
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.8,
          text: `⭐ REFORGE +${newLvl} SUCCESS! ⭐`,
          color: '#facc15'
        });
      }

      this.emitZone(player.zone, 'skill_fx', {
        type: 'whirlwind',
        x: player.x,
        y: player.y,
        radius: 1.5,
        playerId: player.id
      });

      if (newLvl >= 7) {
        this.broadcastSystemMessage(`🌟 [${player.name}] successfully forged [${targetItem.name}] at Brom's Anvil!`);
      }
    } else {
      let downgraded = false;
      let newLvl = curLvl;

      if (forgeConfig.canDowngrade && Math.random() < 0.35 && curLvl > 0) {
        downgraded = true;
        newLvl = curLvl - 1;
        targetItem.upgradeLevel = newLvl;
        this.applyItemUpgradeStats(targetItem);

        if (isEquipped) {
          this.recalculatePlayerStats(player);
        }
      }

      if (socket) {
        socket.emit('player_updated', player);
        socket.emit('reforge_result', {
          success: false,
          item: targetItem,
          oldLevel: curLvl,
          newLevel: newLvl,
          downgraded,
          target: data.target,
          slot: data.slot,
          itemIndex: data.itemIndex
        });
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: downgraded ? `🔻 Reforge Failed (-1 Level)` : `💨 Reforge Failed...`,
          color: '#ef4444'
        });
      }
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
    if (item.slot === 'weapon') {
      addDmg = lvl * 4;
      addSwipe = lvl * 3;
      addAtkSpd = lvl * 0.02;
    } else if (item.slot === 'armor') {
      addDef = lvl * 2;
      addHp = lvl * 25;
    } else if (item.slot === 'helmet') {
      addDef = lvl * 2;
      addHp = lvl * 15;
      addMp = lvl * 10;
    } else if (item.slot === 'boots') {
      addDef = lvl * 1;
      addSpeed = lvl * 0.08;
      addHp = lvl * 10;
    } else if (item.slot === 'ring') {
      addDmg = lvl * 3;
      addHp = lvl * 15;
      addMp = lvl * 15;
      addAtkSpd = lvl * 0.01;
    }

    item.bonusDmg = item.baseBonusDmg + addDmg;
    item.bonusDef = item.baseBonusDef + addDef;
    item.bonusHp = item.baseBonusHp + addHp;
    item.bonusMp = item.baseBonusMp + addMp;
    item.bonusSpeed = Number((item.baseBonusSpeed + addSpeed).toFixed(2));
    item.bonusAttackSpeed = Number((item.baseBonusAttackSpeed + addAtkSpd).toFixed(2));
    item.bonusSwipe = Math.round(item.baseBonusSwipe + addSwipe);
    item.name = lvl > 0 ? `${item.baseName} +${lvl}` : item.baseName;
  }

  handleUsePotion(socketId, potionType) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    if (potionType === 'health' && player.inventory.healthPotions > 0) {
      if (player.hp >= player.maxHp) return;
      player.inventory.healthPotions--;
      const healAmount = Math.round(player.maxHp * 0.45);
      player.hp = Math.min(player.maxHp, player.hp + healAmount);

      this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.5, text: `+${healAmount} HP`, color: '#4ade80' });
      this.emitZone(player.zone, 'heal_fx', { targetId: player.id, type: 'health' });
    } else if (potionType === 'mana' && player.inventory.manaPotions > 0) {
      if (player.mp >= player.maxMp) return;
      player.inventory.manaPotions--;
      const manaAmount = Math.round(player.maxMp * 0.5);
      player.mp = Math.min(player.maxMp, player.mp + manaAmount);

      this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.5, text: `+${manaAmount} MP`, color: '#38bdf8' });
      this.emitZone(player.zone, 'heal_fx', { targetId: player.id, type: 'mana' });
    }
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
        const existing = player.inventory.items.find(i => i.id === def.id && !def.custom);
        if (existing && def.type !== 'equipment') {
          existing.count = (existing.count || 1) + 1;
        } else {
          player.inventory.items.push({ ...def, count: 1 });
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

  emitDungeonRunUpdate(player, socket) {
    socket = socket || this.io.sockets.sockets.get(player.id);
    if (!socket) return;
    const run = player.dungeonRun;
    socket.emit('dungeon_run_update', run ? {
      active: true,
      cleared: run.cleared,
      gold: run.gold,
      items: run.items.map(it => this.lootEntryName(it))
    } : { active: false });
  }

  // Boss defeated: everything in the loot bag is secured immediately.
  completeDungeonRun(player) {
    const run = player.dungeonRun;
    if (!run || run.cleared) return;
    run.cleared = true;
    const secured = [];
    if (run.gold > 0) {
      this.giveLootToPlayer(player, { type: 'gold', amount: run.gold }, false);
      secured.push(`${run.gold} Gold`);
    }
    run.items.forEach(it => {
      this.giveLootToPlayer(player, it, false);
      secured.push(this.lootEntryName(it));
    });
    run.gold = 0;
    run.items = [];

    const socket = this.io.sockets.sockets.get(player.id);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('dungeon_result', { success: true, kept: secured, lost: [] });
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
    const keptGold = Math.floor(run.gold * FAILED_RUN_LOOT_KEEP);
    if (keptGold > 0) {
      this.giveLootToPlayer(player, { type: 'gold', amount: keptGold }, false);
      kept.push(`${keptGold} Gold`);
    }
    if (run.gold - keptGold > 0) lost.push(`${run.gold - keptGold} Gold`);

    const shuffled = [...run.items].sort(() => Math.random() - 0.5);
    const keepCount = Math.floor(shuffled.length * FAILED_RUN_LOOT_KEEP);
    shuffled.forEach((it, i) => {
      if (i < keepCount) {
        this.giveLootToPlayer(player, it, false);
        kept.push(this.lootEntryName(it));
      } else {
        lost.push(this.lootEntryName(it));
      }
    });

    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('dungeon_result', { success: false, kept, lost });
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

  spawnProjectile(caster, targetX, targetY, targetId, targetType, damage) {
    const id = `proj_${this.nextEntityId++}`;
    let dx = (targetX !== undefined ? targetX : caster.x) - caster.x;
    let dy = (targetY !== undefined ? targetY : caster.y) - caster.y;
    let angle = Math.atan2(dy, dx);
    if (Math.hypot(dx, dy) < 0.001) {
      const facingAngles = { E: 0, SE: Math.PI / 4, S: Math.PI / 2, SW: 3 * Math.PI / 4, W: Math.PI, NW: -3 * Math.PI / 4, N: -Math.PI / 2, NE: -Math.PI / 4 };
      angle = facingAngles[caster.facing] !== undefined ? facingAngles[caster.facing] : 0;
    }
    const speed = 9.0;

    this.projectiles.set(id, {
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
      color: '#f97316'
    });
  }

  applyDamageToMob(player, mob, baseDamage, isCritical = false) {
    const variation = (Math.random() * 0.4) - 0.2;
    let rawDamage = Math.round(baseDamage * (1 + variation));

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

    // Apply mob defense reduction
    const mobDef = (mob.def || 0) + (mob.hasCommanderBuff ? 8 : 0);
    const defReduction = mobDef * 0.45;
    let damage = isDeflected ? 1 : Math.max(1, Math.round(rawDamage - defReduction));

    // Fortified affix absorbs 30% damage
    if (mob.buffs && mob.buffs.includes('fortified')) {
      damage = Math.max(1, Math.round(damage * 0.7));
    }

    mob.hp -= damage;
    mob.state = 'chase';
    mob.targetPlayerId = player ? player.id : null;

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
    let textColor = '#ef4444';
    let textSize = 16;
    if (isDeflected) {
      text = `🛡️ 1 (DEFLECTED!)`;
      textColor = '#94a3b8';
      textSize = 15;
    } else if (isCritical) {
      text = `${damage} CRIT!`;
      textColor = '#f59e0b';
      textSize = 22;
    } else if (isGlancing) {
      text = `${damage} (Glancing)`;
      textColor = '#fb923c';
      textSize = 15;
    }

    this.emitZone((player && player.zone) || mob.fieldZone, 'floating_text', {
      x: mob.x,
      y: mob.y - 0.7,
      text,
      color: textColor,
      size: textSize
    });

    if (mob.hp <= 0) {
      this.handleMobDeath(mob, player);
    }
  }

  handleMobDeath(mob, killerPlayer) {
    mob.state = 'dead';
    mob.hp = 0;
    const isDungeon = (mob.zone === 'dungeon') || (mob.id && mob.id.startsWith('dungeon_')) || (killerPlayer && killerPlayer.zone === 'dungeon');
    mob.respawnTimer = isDungeon ? Infinity : (mob.isBoss ? 25.0 : 10.0);

    const zone = killerPlayer ? killerPlayer.zone : (mob.fieldZone || (mob.id.startsWith('frost_') ? 'frostfell' : 'town'));

    if (killerPlayer) {
      killerPlayer.inventory.kills++;
      // full EXP near your level, much less for monsters far below you
      this.awardExp(killerPlayer, Math.max(1, Math.round(mob.exp * levelGapMult(killerPlayer.level, mob.level))));

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
        if (killerPlayer.zone === 'dungeon') {
          this.broadcastSystemMessage(`🎉 The Dungeon Boss fell! A portal to deeper dungeon depths has unlocked.`);
          for (const p of this.players.values()) {
            if (p.zone === 'dungeon' && p.dungeonRun && !p.dungeonRun.cleared) {
              this.completeDungeonRun(p);
            }
          }
        }
      }
    }

    // Drop Gold
    const goldDrop = Math.round(mob.gold * (0.8 + Math.random() * 0.4));
    this.spawnGroundItem(zone, 'gold', 'Gold Coins', mob.x + (Math.random() - 0.5) * 0.5, mob.y + (Math.random() - 0.5) * 0.5, goldDrop);

    // Drop Potions or Relics
    if (Math.random() < 0.6) {
      this.spawnGroundItem(zone, 'item', 'health_potion', mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1);
    }

    // Relic drops
    if ((zone === 'dungeon' || this.fields.has(zone)) && Math.random() < 0.45) {
      const relics = ['ancient_ruby', 'cursed_chalice', 'shadow_essence'];
      const r = relics[Math.floor(Math.random() * relics.length)];
      this.spawnGroundItem(zone, 'item', r, mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1);
    }

    this.emitZone(zone, 'mob_died', { mobId: mob.id, killerId: killerPlayer ? killerPlayer.id : null });
  }

  awardExp(player, amount) {
    if (player.level >= 150) return;
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

  spawnGroundItem(zone, type, itemIdOrName, x, y, amount, customItemData = null) {
    const id = `item_${this.nextEntityId++}`;
    const itemsMap = this.getGroundItemsMap(zone);

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
      createdAt: Date.now()
    };

    itemsMap.set(id, item);
    this.emitZone(zone, 'item_dropped', item);
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
    }, 1000 / this.TICK_RATE);
  }

  update(dt) {
    this.syncZoneRooms();
    // 1. Update Players
    for (const player of this.players.values()) {
      const socket = this.io.sockets.sockets.get(player.id);
      if (player.isDead) {
        player.respawnTimer -= dt;
        if (player.respawnTimer <= 0) {
          if (player.zone === 'dungeon') this.endDungeonRun(player, socket);
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
        if (player.skillCooldowns.slot1 > 0) player.skillCooldowns.slot1 = Math.max(0, player.skillCooldowns.slot1 - dt);
        if (player.skillCooldowns.slot2 > 0) player.skillCooldowns.slot2 = Math.max(0, player.skillCooldowns.slot2 - dt);
        if (player.skillCooldowns.slot3 > 0) player.skillCooldowns.slot3 = Math.max(0, player.skillCooldowns.slot3 - dt);
        if (player.skillCooldowns.dash > 0) player.skillCooldowns.dash = Math.max(0, player.skillCooldowns.dash - dt);
        if (player.skillCooldowns.skill1 > 0) player.skillCooldowns.skill1 = Math.max(0, player.skillCooldowns.skill1 - dt);
        if (player.skillCooldowns.skill2 > 0) player.skillCooldowns.skill2 = Math.max(0, player.skillCooldowns.skill2 - dt);
        player.skillCooldown = player.skillCooldowns.slot1 || player.skillCooldowns.skill1 || 0;
      }
      if (player.sprintTimer > 0) player.sprintTimer = Math.max(0, player.sprintTimer - dt);
      if (player.portalCooldown > 0) player.portalCooldown = Math.max(0, player.portalCooldown - dt);
      if (player.berserkTimer > 0) player.berserkTimer = Math.max(0, player.berserkTimer - dt);
      if (player.ironFortressTimer > 0) player.ironFortressTimer = Math.max(0, player.ironFortressTimer - dt);
      if (player.smokeScreenTimer > 0) player.smokeScreenTimer = Math.max(0, player.smokeScreenTimer - dt);
      if (player.speechTimer > 0) {
        player.speechTimer -= dt;
        if (player.speechTimer <= 0) player.speechBubble = null;
      }

      player.hp = Math.min(player.maxHp, player.hp + (player.maxHp * 0.015 * dt));
      player.mp = Math.min(player.maxMp, player.mp + (player.maxMp * 0.08 * dt) + (4 * dt));

      // Status Effects Processing (Poison DoT, Burn DoT, Chill Slow)
      if (player.statusEffects && player.statusEffects.length > 0) {
        let isChilled = false;
        for (let i = player.statusEffects.length - 1; i >= 0; i--) {
          const fx = player.statusEffects[i];
          fx.duration -= dt;
          fx.tickTimer -= dt;

          if (fx.type === 'poison' && fx.tickTimer <= 0) {
            fx.tickTimer = 0.8;
            const dotDmg = Math.max(1, Math.round(fx.value));
            player.hp = Math.max(0, player.hp - dotDmg);
            this.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: `☠️ -${dotDmg}`, color: '#22c55e', size: 14 });
          } else if (fx.type === 'burn' && fx.tickTimer <= 0) {
            fx.tickTimer = 0.6;
            const dotDmg = Math.max(1, Math.round(fx.value));
            player.hp = Math.max(0, player.hp - dotDmg);
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

      // Check Portal Teleports
      if (socket) {
        this.checkPortalAndInteractions(player, socket);
      }
    }

    // 2. Commander Aura Calculations for Dungeon Mobs
    const commanderMobs = [];
    for (const mob of this.dungeonMobs.values()) {
      if (mob.state !== 'dead' && mob.isCommander && mob.auraRadius > 0) {
        commanderMobs.push(mob);
      }
      mob.hasCommanderBuff = false;
    }

    if (commanderMobs.length > 0) {
      for (const mob of this.dungeonMobs.values()) {
        if (mob.state === 'dead' || mob.isCommander) continue;
        for (const cmdr of commanderMobs) {
          if (Math.hypot(mob.x - cmdr.x, mob.y - cmdr.y) <= cmdr.auraRadius) {
            mob.hasCommanderBuff = true;
            break;
          }
        }
      }
    }

    // Update Town, Frostfell, and Dungeon Mobs
    this.updateMobsList(this.townMobs, 'town', dt);
    for (const [fieldId, field] of this.fields) this.updateMobsList(field.mobs, fieldId, dt);
    this.updateMobsList(this.dungeonMobs, 'dungeon', dt);

    // 3. Update Projectiles
    for (const [projId, proj] of this.projectiles.entries()) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;

      const mobsMap = this.getMobsMap(proj.zone);
      let hit = false;
      for (const mob of mobsMap.values()) {
        if (mob.state === 'dead') continue;
        if (Math.hypot(mob.x - proj.x, mob.y - proj.y) < 0.8) {
          const caster = this.players.get(proj.casterId);
          if (caster) {
            this.applyDamageToMob(caster, mob, proj.damage, false);
          }
          hit = true;
          break;
        }
      }

      if (hit || proj.life <= 0 || this.isColliding(proj.x, proj.y, proj.zone, 0.2)) {
        this.emitZone(proj.zone, 'projectile_exploded', { id: proj.id, x: proj.x, y: proj.y });
        this.projectiles.delete(projId);
      }
    }
  }

  updateMobsList(mobsMap, zone, dt) {
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

      if (mob.attackCooldown > 0) mob.attackCooldown = Math.max(0, mob.attackCooldown - dt);

      // Mob Status Effects (Chill, Burn DoT, Poison DoT)
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
          this.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.7, text: `🔥 -${dotDmg}`, color: '#f97316', size: 14 });
          if (mob.hp <= 0) {
            this.handleMobDeath(mob, null);
            continue;
          }
        }
      }
      if (mob.poisonTimer > 0) {
        mob.poisonTimer = Math.max(0, mob.poisonTimer - dt);
        mob.poisonTickTimer = (mob.poisonTickTimer || 0) - dt;
        if (mob.poisonTickTimer <= 0) {
          mob.poisonTickTimer = 0.8;
          const dotDmg = Math.max(1, Math.round(mob.poisonDmg || 6));
          mob.hp -= dotDmg;
          this.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.7, text: `☠️ -${dotDmg}`, color: '#22c55e', size: 14 });
          if (mob.hp <= 0) {
            this.handleMobDeath(mob, null);
            continue;
          }
        }
      }

      if (mob.state === 'idle') {
        let closestPlayer = null;
        let closestDist = 5.0;

        for (const p of this.players.values()) {
          if (p.isDead || p.zone !== zone) continue;
          const d = Math.hypot(p.x - mob.x, p.y - mob.y);
          if (d < closestDist) {
            closestDist = d;
            closestPlayer = p;
          }
        }

        if (closestPlayer) {
          mob.state = 'chase';
          mob.targetPlayerId = closestPlayer.id;
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
          if (mob.attackCooldown <= 0) {
            mob.attackCooldown = 1.2;

            if (targetPlayer.smokeScreenTimer > 0) {
              this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '💨 MISS! (Stealth)', color: '#94a3b8' });
              continue;
            }

            // Dodge chance from talents
            if (targetPlayer.dodgeChance && Math.random() < targetPlayer.dodgeChance) {
              this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '💨 DODGE!', color: '#38bdf8' });
              continue;
            }

            const effectiveDmg = mob.hasCommanderBuff ? Math.round(mob.dmg * 1.35) : mob.dmg;
            let damageDealt = Math.max(1, Math.round(effectiveDmg - (targetPlayer.def * 0.5)));

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
              this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: `💥 CRUSHING -${damageDealt}!`, color: '#dc2626', size: 18 });
            } else {
              this.emitZone(zone, 'floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: `-${damageDealt}`, color: '#ef4444' });
            }
            this.emitZone(zone, 'entity_attack_fx', { attackerId: mob.id, attackerType: 'mob', targetId: targetPlayer.id, x: mob.x, y: mob.y });

            if (targetPlayer.hp <= 0) {
              targetPlayer.hp = 0;
              targetPlayer.isDead = true;
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

          if (!this.isColliding(mob.x + mx, mob.y + my, zone)) {
            mob.x += mx;
            mob.y += my;
          }
          mob.facing = this.calculateFacing(mob.x, mob.y, targetPlayer.x, targetPlayer.y);
        }
      } else if (mob.state === 'return') {
        const distToSpawn = Math.hypot(mob.spawnX - mob.x, mob.spawnY - mob.y);
        if (distToSpawn > 0.2) {
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
    const playersArr = Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      characterClass: p.characterClass,
      zone: p.zone,
      x: p.x,
      y: p.y,
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
      skills: p.skills || {},
      gold: p.gold,
      speechBubble: p.speechBubble,
      isDead: p.isDead,
      statusEffects: (p.statusEffects || []).map(e => ({ type: e.type, duration: Math.ceil(e.duration) })),
      inventory: p.inventory,
      equipment: p.equipment,
      baseStats: p.baseStats,
      equippedSkills: p.equippedSkills,
      skillCooldowns: p.skillCooldowns,
      attackSpeed: p.attackSpeed || 1.0,
      swipe: p.swipe || 0,
      shieldHp: Math.round(p.shieldHp || 0),
      berserkTimer: Number((p.berserkTimer || 0).toFixed(1)),
      ironFortressTimer: Number((p.ironFortressTimer || 0).toFixed(1)),
      smokeScreenTimer: Number((p.smokeScreenTimer || 0).toFixed(1))
    }));

    const snapMob = m => ({
      id: m.id, type: m.type, name: m.name, level: m.level, x: m.x, y: m.y,
      facing: m.facing, hp: Math.round(m.hp), maxHp: m.maxHp, state: m.state, isBoss: m.isBoss,
      buffs: m.buffs || [], isCommander: !!m.isCommander, auraRadius: m.auraRadius || 0, hasCommanderBuff: !!m.hasCommanderBuff,
      hue: m.hue || 0, scale: m.scale || 1
    });
    const townMobsArr = Array.from(this.townMobs.values()).map(snapMob);
    const dungeonMobsArr = Array.from(this.dungeonMobs.values()).map(snapMob);

    // Only send field zones somebody is actually standing in
    const occupied = new Set(playersArr.map(p => p.zone));
    const fieldMobs = {};
    for (const [fieldId, field] of this.fields) {
      if (occupied.has(fieldId)) fieldMobs[fieldId] = Array.from(field.mobs.values()).map(snapMob);
    }

    this.syncZoneRooms();
    for (const zone of occupied) {
      this.io.to(`zone:${zone}`).emit('game_tick', {
        timestamp: Date.now(),
        players: playersArr.filter(p => p.zone === zone),
        townMobs: zone === 'town' ? townMobsArr : [],
        fieldMobs: fieldMobs[zone] ? { [zone]: fieldMobs[zone] } : {},
        frostfellMobs: zone === 'frostfell' ? (fieldMobs.frostfell || []) : [],
        dungeonMobs: zone === 'dungeon' ? dungeonMobsArr : [],
        dungeonChests: zone === 'dungeon' && this.dungeon ? this.dungeon.chests : []
      });
    }
  }
}

module.exports = GameServer;
