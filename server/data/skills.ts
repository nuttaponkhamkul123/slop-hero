
import type { Player } from '../entities/types';// Class skill data (moved verbatim from gameServer.ts; values unchanged).
// The cooldown scaling loop below runs once, when this module is first loaded.

// ================= MASSIVE CLASS SKILL ARSENAL (24 SKILLS) =================
export const ALL_CLASS_SKILLS = {
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
    id: 'poison_darts', class: 'rogue', reqLevel: 5, name: 'Shurikens', icon: '🎯', category: 'Ranged Spread', fxType: 'poison_darts',
    mpCost: 12, cooldown: 3.5, dmgMult: 2.3, damageMultiplier: 2.3,
    desc: 'Hurl 8 steel shurikens in every direction; they curve back to you, hitting every enemy they pass through (out and back) for 1.15x damage each.'
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

// Reduce all class skill cooldowns by 60% (cooldown * 0.40)
for (const s of Object.values(ALL_CLASS_SKILLS)) {
  if (s && typeof (s as any).cooldown === 'number') {
    (s as any).cooldown = Math.max(0.4, Number(((s as any).cooldown * 0.4).toFixed(2)));
  }
}

export const CLASS_SKILLS_CATALOG = {
  warrior: Object.values(ALL_CLASS_SKILLS).filter(s => s.class === 'warrior').sort((a, b) => a.reqLevel - b.reqLevel),
  mage: Object.values(ALL_CLASS_SKILLS).filter(s => s.class === 'mage').sort((a, b) => a.reqLevel - b.reqLevel),
  rogue: Object.values(ALL_CLASS_SKILLS).filter(s => s.class === 'rogue').sort((a, b) => a.reqLevel - b.reqLevel)
};

export const SKILL_RUNES = {
  none: { id: 'none', name: 'Standard Rune', icon: '⚪', desc: 'Default ability power without elemental modifiers.', color: '#94a3b8' },
  flame: { id: 'flame', name: 'Infernal Flame', icon: '🔴', desc: '+25% Damage and ignites enemies with persistent Burn DoT.', color: '#ef4444' },
  frost: { id: 'frost', name: 'Glacial Frost', icon: '🔵', desc: 'Adds 50% Chill Slow for 3.5s and 25% chance to Freeze solid.', color: '#38bdf8' },
  tempest: { id: 'tempest', name: 'Tempest Surge', icon: '⚡', desc: '-20% Cooldown reduction and +10% Electric Shock DMG.', color: '#eab308' },
  vampiric: { id: 'vampiric', name: 'Vampiric Drain', icon: '🟣', desc: 'Restores 25% of all skill damage dealt as immediate HP life leech.', color: '#a855f7' }
};

export const DEFAULT_EQUIPPED_SKILLS = {
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

// Slots a client may cast from
export const CLIENT_SKILL_SLOTS = new Set(['slot1', 'slot2', 'slot3', 'dash', 'weapon', 'skill1', 'skill2', 'ult']);

export const DEFAULT_SKILL_FOR_SLOT = (player: Player, slot: any) => {
  const defaults = (DEFAULT_EQUIPPED_SKILLS as any)[player.characterClass] || DEFAULT_EQUIPPED_SKILLS.warrior;
  return (ALL_CLASS_SKILLS as any)[defaults[slot]] || ALL_CLASS_SKILLS.whirlwind;
};

export const CLASS_SKILLS = {
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
