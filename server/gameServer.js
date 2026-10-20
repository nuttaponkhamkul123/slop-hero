const { MAP_WIDTH, MAP_HEIGHT, TILES, generateMap, generateFrostfellMap } = require('./mapData');
const { generateProceduralDungeon, rollDungeonLoot, DIFFICULTIES, AFFIX_POOL, DUNGEON_FLOORS } = require('./dungeonGenerator');
const { ITEMS } = require('./items');

// ================= MASSIVE CLASS SKILL ARSENAL (24 SKILLS) =================
const ALL_CLASS_SKILLS = {
  // === WARRIOR SKILLS ===
  whirlwind: {
    id: 'whirlwind',
    class: 'warrior',
    name: 'Whirlwind Slash',
    icon: '🌪️',
    category: 'AoE Physical',
    fxType: 'whirlwind',
    mpCost: 14,
    cooldown: 3.5,
    radius: 3.4,
    dmgMult: 2.0,
    desc: 'Spin continuously dealing 2.0x Physical damage in a 360° cyclone around you.'
  },
  earthshaker: {
    id: 'earthshaker',
    class: 'warrior',
    name: 'Earthshaker Slam',
    icon: '💥',
    category: 'AoE Stun / Slow',
    fxType: 'earthshaker',
    mpCost: 16,
    cooldown: 4.5,
    radius: 3.4,
    dmgMult: 2.2,
    slowDuration: 2.5,
    desc: 'Strike the ground with colossal force, dealing 2.2x damage and slowing foes by 50% for 2.5s.'
  },
  blade_charge: {
    id: 'blade_charge',
    class: 'warrior',
    name: 'Blade Charge',
    icon: '⚔️',
    category: 'Mobility / Pierce',
    fxType: 'blade_charge',
    mpCost: 10,
    cooldown: 3.0,
    distance: 4.8,
    dmgMult: 1.8,
    desc: 'Rush forward piercing enemies for 1.8x damage and knocking them back.'
  },
  shield_slam: {
    id: 'shield_slam',
    class: 'warrior',
    name: 'Aegis Shield Bash',
    icon: '🛡️',
    category: 'Stun & Shield',
    fxType: 'shield_slam',
    mpCost: 15,
    cooldown: 4.0,
    radius: 2.4,
    dmgMult: 2.4,
    stunDuration: 2.0,
    shieldHp: 80,
    desc: 'Slam enemies with an iron aegis, dealing 2.4x damage, stunning for 2s, and granting an 80 HP shield.'
  },
  blood_rage: {
    id: 'blood_rage',
    class: 'warrior',
    name: 'Berserker Blood Rage',
    icon: '🩸',
    category: 'Self Buff',
    fxType: 'blood_rage',
    mpCost: 12,
    cooldown: 7.0,
    hpCostPct: 0.10,
    duration: 6.0,
    bonusDmgPct: 0.35,
    lifestealPct: 0.20,
    desc: 'Sacrifice 10% HP to enter a berserk state for 6s: +35% DMG and 20% Life Steal on every attack.'
  },
  colossus_strike: {
    id: 'colossus_strike',
    class: 'warrior',
    name: 'Colossus Decapitate',
    icon: '🗡️',
    category: 'Ultimate Burst',
    fxType: 'colossus_strike',
    mpCost: 28,
    cooldown: 9.0,
    radius: 3.0,
    dmgMult: 3.8,
    desc: '[ULTIMATE] Leap high and smash down a colossal greatblade strike for 3.8x devastating burst damage!'
  },
  iron_fortress: {
    id: 'iron_fortress',
    class: 'warrior',
    name: 'Iron Fortress',
    icon: '🏰',
    category: 'Defense / Thorns',
    fxType: 'iron_fortress',
    mpCost: 18,
    cooldown: 8.0,
    duration: 4.5,
    damageReduction: 0.60,
    thornsDmg: 25,
    desc: 'Assume an immovable iron stance for 4.5s: reduce damage taken by 60% and reflect 25 damage back to attackers.'
  },
  war_stomp: {
    id: 'war_stomp',
    class: 'warrior',
    name: 'Thunder War Stomp',
    icon: '⚡',
    category: 'Vortex CC',
    fxType: 'war_stomp',
    mpCost: 20,
    cooldown: 5.5,
    radius: 4.2,
    dmgMult: 2.1,
    stunDuration: 1.8,
    desc: 'Stomp with seismic thunder, pulling all nearby enemies toward you, dealing 2.1x damage and stunning for 1.8s.'
  },

  // === MAGE SKILLS ===
  firestorm: {
    id: 'firestorm',
    class: 'mage',
    name: 'Firestorm Meteor',
    icon: '🔥',
    category: 'AoE Burn',
    fxType: 'firestorm',
    mpCost: 22,
    cooldown: 4.5,
    radius: 3.8,
    dmgMult: 2.4,
    burnDuration: 3.0,
    burnDmg: 12,
    desc: 'Call down apocalyptic burning meteors dealing 2.4x damage and setting foes ablaze with Burn DoT.'
  },
  frost_nova: {
    id: 'frost_nova',
    class: 'mage',
    name: 'Frost Nova',
    icon: '❄️',
    category: 'AoE Freeze / Chill',
    fxType: 'frost_nova',
    mpCost: 18,
    cooldown: 4.0,
    radius: 4.0,
    dmgMult: 1.8,
    chillDuration: 3.5,
    desc: 'Release an expanding glacial ring dealing 1.8x damage and chilling enemies by 50% for 3.5s.'
  },
  arcane_blink: {
    id: 'arcane_blink',
    class: 'mage',
    name: 'Arcane Blink',
    icon: '🔮',
    category: 'Mobility / Cleanse',
    fxType: 'arcane_blink',
    mpCost: 15,
    cooldown: 3.5,
    distance: 5.2,
    dmgMult: 1.5,
    radius: 2.4,
    chillDuration: 2.0,
    desc: 'Teleport instantly in your movement direction, cleansing debuffs and releasing an arcane shockwave.'
  },
  chain_lightning: {
    id: 'chain_lightning',
    class: 'mage',
    name: 'Chain Lightning',
    icon: '⚡',
    category: 'Targeted Shock',
    fxType: 'chain_lightning',
    mpCost: 20,
    cooldown: 4.0,
    bounces: 5,
    dmgMult: 2.2,
    desc: 'Cast crackling lightning that arcs across up to 5 nearby monsters, dealing 2.2x electric shock damage.'
  },
  mana_shield: {
    id: 'mana_shield',
    class: 'mage',
    name: 'Arcane Mana Barrier',
    icon: '✨',
    category: 'Defensive Shield',
    fxType: 'mana_shield',
    mpCost: 15,
    cooldown: 8.0,
    duration: 6.0,
    absorbHp: 120,
    desc: 'Surround yourself with a prismatic arcane sphere absorbing up to 120 damage using Mana for 6s.'
  },
  black_hole: {
    id: 'black_hole',
    class: 'mage',
    name: 'Cosmic Singularity',
    icon: '🌌',
    category: 'Ultimate Gravity',
    fxType: 'black_hole',
    mpCost: 32,
    cooldown: 10.0,
    radius: 4.8,
    dmgMult: 3.6,
    duration: 2.2,
    desc: '[ULTIMATE] Open a gravitational singularity that sucks all foes to the epicenter then violently implodes for 3.6x damage!'
  },
  blizzard: {
    id: 'blizzard',
    class: 'mage',
    name: 'Glacial Blizzard',
    icon: '🌨️',
    category: 'AoE Freeze Hail',
    fxType: 'blizzard',
    mpCost: 25,
    cooldown: 6.0,
    radius: 4.4,
    dmgMult: 2.5,
    freezeDuration: 2.0,
    desc: 'Summon a vicious hail of razor ice shards over an area, dealing 2.5x damage and freezing enemies solid.'
  },
  pyroblast: {
    id: 'pyroblast',
    class: 'mage',
    name: 'Pyroblast Nova',
    icon: '☄️',
    category: 'Burst Fireball',
    fxType: 'pyroblast',
    mpCost: 24,
    cooldown: 5.0,
    radius: 3.2,
    dmgMult: 3.2,
    burnDuration: 4.0,
    burnDmg: 16,
    desc: 'Hurl an enormous molten fire orb that pierces and explodes for 3.2x burst damage + deep burn.'
  },

  // === ROGUE SKILLS ===
  fan_of_knives: {
    id: 'fan_of_knives',
    class: 'rogue',
    name: 'Fan of Knives',
    icon: '🗡️',
    category: 'AoE Critical',
    fxType: 'fan_of_knives',
    mpCost: 14,
    cooldown: 3.0,
    radius: 3.4,
    dmgMult: 2.2,
    critBonus: 0.35,
    desc: 'Hurl a rapid 360° ring of razor daggers with +35% Critical Strike chance dealing 2.2x damage.'
  },
  toxic_bomb: {
    id: 'toxic_bomb',
    class: 'rogue',
    name: 'Toxic Smoke Bomb',
    icon: '☠️',
    category: 'AoE Poison Fog',
    fxType: 'toxic_bomb',
    mpCost: 16,
    cooldown: 4.5,
    radius: 3.2,
    dmgMult: 1.4,
    poisonDuration: 4.5,
    poisonDmg: 11,
    desc: 'Toss a caustic chemical flask creating a corrosive poison cloud that melts enemy armor and deals 11 DoT.'
  },
  shadow_dash: {
    id: 'shadow_dash',
    class: 'rogue',
    name: 'Shadow Dash',
    icon: '💨',
    category: 'Mobility / Sprint',
    fxType: 'shadow_dash',
    mpCost: 8,
    cooldown: 2.5,
    distance: 4.8,
    dmgMult: 1.9,
    sprintDuration: 2.0,
    desc: 'Phantom sprint through shadows, slicing enemies along the path for 1.9x and gaining +40% speed for 2s.'
  },
  shadowstep: {
    id: 'shadowstep',
    class: 'rogue',
    name: 'Shadowstep Ambush',
    icon: '👤',
    category: 'Backstab Teleport',
    fxType: 'shadowstep',
    mpCost: 16,
    cooldown: 4.5,
    dmgMult: 2.8,
    critBonus: 0.50,
    desc: 'Vanish and reappear directly behind the nearest enemy, backstabbing for 2.8x damage with +50% Crit!'
  },
  smoke_screen: {
    id: 'smoke_screen',
    class: 'rogue',
    name: 'Vanish Smoke Screen',
    icon: '🌫️',
    category: 'Stealth & 100% Crit',
    fxType: 'smoke_screen',
    mpCost: 15,
    cooldown: 7.5,
    duration: 3.5,
    desc: 'Vanish into thick smoke for 3.5s: gain 100% movement speed and make your next strike a guaranteed 2.5x Critical.'
  },
  death_blossom: {
    id: 'death_blossom',
    class: 'rogue',
    name: 'Death Blossom',
    icon: '🌸',
    category: 'Ultimate Omnislash',
    fxType: 'death_blossom',
    mpCost: 28,
    cooldown: 9.5,
    radius: 4.0,
    slashes: 8,
    dmgMult: 4.0,
    desc: '[ULTIMATE] Become an untargetable shadow blur, slashing all surrounding enemies 8 times for 4.0x total damage!'
  },
  poison_darts: {
    id: 'poison_darts',
    class: 'rogue',
    name: 'Venom Shurikens',
    icon: '🎯',
    category: 'Ranged Poison Spread',
    fxType: 'poison_darts',
    mpCost: 12,
    cooldown: 3.5,
    dmgMult: 2.3,
    poisonDuration: 4.0,
    poisonDmg: 14,
    desc: 'Fling 3 venom-coated shurikens in a lethal spread, dealing 2.3x damage and inflicting heavy neurotoxin.'
  },
  caltrops: {
    id: 'caltrops',
    class: 'rogue',
    name: 'Barbed Caltrops',
    icon: '⛓️',
    category: 'Ground Trap / Bleed',
    fxType: 'caltrops',
    mpCost: 14,
    cooldown: 5.0,
    radius: 3.2,
    dmgMult: 1.6,
    slowDuration: 4.0,
    desc: 'Scatter razor-spiked caltrops on the ground, crippling enemy move speed by 60% and causing bleeding.'
  }
};

const SKILL_RUNES = {
  none: { id: 'none', name: 'Standard Rune', icon: '⚪', desc: 'Default ability power without elemental modifiers.' },
  flame: { id: 'flame', name: 'Infernal Rune', icon: '🔴', desc: '+20% Damage and ignites enemies with persistent Burn DoT.' },
  frost: { id: 'frost', name: 'Glacial Rune', icon: '🔵', desc: 'Adds 50% Chill Slow for 3.5s and 25% chance to Freeze solid.' },
  tempest: { id: 'tempest', name: 'Tempest Rune', icon: '⚡', desc: '-20% Cooldown reduction and crackles with electric shock.' },
  vampiric: { id: 'vampiric', name: 'Vampiric Rune', icon: '🟣', desc: 'Restores 15% of skill damage dealt as immediate HP life leech.' }
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
    {
      id: 'iron_skin',
      name: 'Iron Skin',
      icon: '🛡️',
      desc: 'Harden body with steel resolve. Grants +10 Armor and +80 Max HP per rank.',
      maxRank: 3,
      requires: null,
      effects: { bonusDef: 10, bonusHp: 80 }
    },
    {
      id: 'blade_mastery',
      name: 'Blade Mastery',
      icon: '⚔️',
      desc: 'Hone edge proficiency. Grants +8 Attack Damage and +0.2 Move Speed per rank.',
      maxRank: 3,
      requires: null,
      effects: { bonusDmg: 8, bonusSpeed: 0.2 }
    },
    {
      id: 'cyclone_cleave',
      name: 'Cyclone Cleave',
      icon: '🌪️',
      desc: 'Empowers Whirlwind Slash: +25% damage and +0.6m radius per rank.',
      maxRank: 3,
      requires: 'blade_mastery',
      effects: { whirlwindDmg: 0.25, whirlwindRadius: 0.6 }
    },
    {
      id: 'seismic_shatter',
      name: 'Seismic Shatter',
      icon: '🔨',
      desc: 'Earthshaker Slam creates shockwaves dealing +30% damage and +1.5s slow per rank.',
      maxRank: 3,
      requires: 'iron_skin',
      effects: { earthshakerDmg: 0.30, earthshakerSlow: 1.5 }
    },
    {
      id: 'sundering_dash',
      name: 'Sundering Dash',
      icon: '⚡',
      desc: 'Blade Charge leaves an armor-breaking trail. +25% charge damage and -0.5s cooldown.',
      maxRank: 3,
      requires: 'cyclone_cleave',
      effects: { dashDmg: 0.25, dashCdReduce: 0.5 }
    },
    {
      id: 'juggernaut',
      name: 'Juggernaut Resolve',
      icon: '🩸',
      desc: 'Ultimate survival: +150 Max HP and restores 5% HP on every mob kill per rank.',
      maxRank: 3,
      requires: 'seismic_shatter',
      effects: { bonusHp: 150, killHealPercent: 0.05 }
    }
  ],
  mage: [
    {
      id: 'arcane_intellect',
      name: 'Arcane Intellect',
      icon: '📖',
      desc: 'Channel elder magic wisdom. Grants +12 Magic Damage and +60 Max MP per rank.',
      maxRank: 3,
      requires: null,
      effects: { bonusDmg: 12, bonusMp: 60 }
    },
    {
      id: 'mana_flow',
      name: 'Mana Surge',
      icon: '💧',
      desc: 'Deepen arcane reserves. Grants +3 MP regen/s and reduces skill MP costs by 15% per rank.',
      maxRank: 3,
      requires: null,
      effects: { mpRegenBonus: 3, mpCostDiscount: 0.15 }
    },
    {
      id: 'infernal_cataclysm',
      name: 'Infernal Cataclysm',
      icon: '☄️',
      desc: 'Firestorm Meteor erupts with wild fury: +30% damage and +1.0m radius per rank.',
      maxRank: 3,
      requires: 'arcane_intellect',
      effects: { firestormDmg: 0.30, firestormRadius: 1.0 }
    },
    {
      id: 'glacial_tomb',
      name: 'Glacial Tomb',
      icon: '❄️',
      desc: 'Frost Nova freezes targets: +25% damage and +1.5s freeze chill duration per rank.',
      maxRank: 3,
      requires: 'mana_flow',
      effects: { frostNovaDmg: 0.25, frostNovaChill: 1.5 }
    },
    {
      id: 'arcane_haste',
      name: 'Blink Mastery',
      icon: '🌀',
      desc: 'Arcane Blink range +1.5m and cooldown reduced by 0.6s per rank.',
      maxRank: 3,
      requires: 'glacial_tomb',
      effects: { blinkDist: 1.5, blinkCdReduce: 0.6 }
    },
    {
      id: 'astral_overload',
      name: 'Astral Overload',
      icon: '🔮',
      desc: 'Spells cause arcane overload on kill: restores 30 MP and +15 Magic Damage per rank.',
      maxRank: 3,
      requires: 'infernal_cataclysm',
      effects: { killManaRestore: 30, bonusDmg: 15 }
    }
  ],
  rogue: [
    {
      id: 'deadly_precision',
      name: 'Deadly Precision',
      icon: '🎯',
      desc: 'Strike critical pressure points. Grants +10 Attack Damage and +15% Crit chance.',
      maxRank: 3,
      requires: null,
      effects: { bonusDmg: 10, critChance: 0.15 }
    },
    {
      id: 'fleet_footwork',
      name: 'Fleet Footwork',
      icon: '👟',
      desc: 'Agile stealth movements. Grants +0.4 Move Speed and +5 Armor per rank.',
      maxRank: 3,
      requires: null,
      effects: { bonusSpeed: 0.4, bonusDef: 5 }
    },
    {
      id: 'venomous_knives',
      name: 'Venomous Daggers',
      icon: '🗡️',
      desc: 'Fan of Knives fires poisoned blades: +30% damage and applies poison DoT.',
      maxRank: 3,
      requires: 'deadly_precision',
      effects: { knivesDmg: 0.30, knivesPoison: true }
    },
    {
      id: 'noxious_cloud',
      name: 'Noxious Cloud',
      icon: '💨',
      desc: 'Toxic Smoke Bomb cloud expands: +0.8m radius and +4 poison damage per tick.',
      maxRank: 3,
      requires: 'fleet_footwork',
      effects: { smokeRadius: 0.8, smokePoisonDmg: 4 }
    },
    {
      id: 'shadow_sprint',
      name: 'Shadow Sprint',
      icon: '⚡',
      desc: 'Shadow Dash sprint duration +1.0s and cooldown reduced by 0.5s per rank.',
      maxRank: 3,
      requires: 'noxious_cloud',
      effects: { dashSprintBonus: 1.0, dashCdReduce: 0.5 }
    },
    {
      id: 'vampiric_edge',
      name: 'Vampiric Edge',
      icon: '🩸',
      desc: 'Feast on the blood of the fallen. Restores 35 HP on kill and +8 Attack Damage per rank.',
      maxRank: 3,
      requires: 'venomous_knives',
      effects: { killHealFlat: 35, bonusDmg: 8 }
    }
  ]
};

class GameServer {
  constructor(io) {
    this.io = io;
    this.townMap = generateMap();
    this.frostfellMap = generateFrostfellMap();
    this.dungeonFloor = 1;
    this.dungeonDifficulty = 'normal';
    this.dungeon = generateProceduralDungeon(this.dungeonFloor, this.dungeonDifficulty);

    this.players = new Map();
    this.townMobs = new Map();
    this.frostfellMobs = new Map();
    this.dungeonMobs = new Map();

    this.townGroundItems = new Map();
    this.frostfellGroundItems = new Map();
    this.dungeonGroundItems = new Map();

    this.projectiles = new Map();
    this.nextEntityId = 1000;

    this.TICK_RATE = 25;
    this.tickInterval = null;

    this.initTownMonsters();
    this.initFrostfellMonsters();
    this.initDungeonMonsters();
    this.startGameLoop();
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
        const spawnX = def.zone.minX + Math.random() * (def.zone.maxX - def.zone.minX);
        const spawnY = def.zone.minY + Math.random() * (def.zone.maxY - def.zone.minY);

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
          exp: def.exp,
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
          exp: def.exp,
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
    } else if (zone === 'frostfell') {
      const map = this.frostfellMap;
      if (x < 1 || x > map.width - 2 || y < 1 || y > map.height - 2) return true;
      const tileX = Math.floor(x);
      const tileY = Math.floor(y);
      if (tileX >= 0 && tileX < map.width && tileY >= 0 && tileY < map.height) {
        const tile = map.tiles[tileY][tileX];
        if (tile === TILES.FROST_CLIFF) return true;
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
      expNext: 100,
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
      skillRunes: SKILL_RUNES
    });

    socket.broadcast.emit('player_joined', player);
    this.broadcastSystemMessage(`⚔️ [${player.name} the ${player.characterClass.toUpperCase()}] entered the realm!`);
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
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
      } else if (player.zone === 'frostfell' && this.frostfellMap) {
        maxX = this.frostfellMap.width - 2;
        maxY = this.frostfellMap.height - 2;
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
        this.teleportPlayerToFrostfell(player, socket);
        return;
      }
    } else if (player.zone === 'dungeon') {
      const exitP = this.dungeon.exitPortal;
      const distToExit = Math.hypot(player.x - exitP.x, player.y - exitP.y);
      if (distToExit < 1.3) {
        this.teleportPlayerToTown(player, socket);
      }
    } else if (player.zone === 'frostfell') {
      // Return portal to town (at 21, 34)
      const distToReturn = Math.hypot(player.x - 21.0, player.y - 34.0);
      if (distToReturn < 1.3) {
        this.teleportPlayerToTown(player, socket);
      }
    }
  }

  handleEnterDungeon(socketId, options = {}) {
    const player = this.players.get(socketId);
    if (!player || player.zone !== 'town' || player.isDead) return;
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return;

    const floor = Math.max(1, Math.min(10, parseInt(options.floor, 10) || 1));
    const difficulty = ['normal', 'hard', 'nightmare'].includes(options.difficulty) ? options.difficulty : 'normal';

    // Regenerate procedural dungeon with chosen floor and difficulty
    this.regenerateDungeon(floor, difficulty);
    this.teleportPlayerToDungeon(player, socket);
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

  teleportPlayerToFrostfell(player, socket) {
    player.portalCooldown = 4.0;
    player.zone = 'frostfell';
    player.x = this.frostfellMap.spawnPoint ? this.frostfellMap.spawnPoint.x : 21.0;
    player.y = this.frostfellMap.spawnPoint ? this.frostfellMap.spawnPoint.y : 32.0;
    player.targetX = null;
    player.targetY = null;

    socket.emit('zone_change', {
      zone: 'frostfell',
      map: this.frostfellMap,
      player,
      players: Array.from(this.players.values()).filter(p => p.zone === 'frostfell'),
      mobs: Array.from(this.frostfellMobs.values()),
      groundItems: Array.from(this.frostfellGroundItems.values())
    });

    this.broadcastSystemMessage(`❄️ [${player.name}] ventured into Frostfell Peaks! Beware the icy beasts.`);
  }

  teleportPlayerToTown(player, socket) {
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

      loot.forEach((it) => {
        const dropX = chest.x + (Math.random() - 0.5) * 1.5;
        const dropY = chest.y + (Math.random() - 0.5) * 1.5;
        if (it.type === 'gold') {
          this.spawnGroundItem('dungeon', 'gold', 'Gold Coins', dropX, dropY, it.amount);
        } else if (it.customItemData) {
          this.spawnGroundItem('dungeon', 'item', it.itemId, dropX, dropY, it.amount || 1, it.customItemData);
        } else {
          this.spawnGroundItem('dungeon', 'item', it.itemId, dropX, dropY, it.amount || 1);
        }
      });

      this.io.emit('chest_opened', { chestId, openedBy: player.name });
      this.io.emit('floating_text', {
        x: chest.x,
        y: chest.y - 0.8,
        text: '💎 Chest Unlocked!',
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

    const mobsMap = player.zone === 'town' ? this.townMobs : player.zone === 'frostfell' ? this.frostfellMobs : this.dungeonMobs;

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

    let isCrit = player.skills && player.skills.deadly_precision ? (Math.random() < 0.25 + player.skills.deadly_precision * 0.15) : (Math.random() < 0.15);
    if (player.smokeScreenTimer > 0) {
      isCrit = true;
      player.smokeScreenTimer = 0;
      this.io.emit('floating_text', { x: player.x, y: player.y - 0.7, text: '💥 AMBUSH CRITICAL!', color: '#f59e0b', size: 20 });
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
      } else if (targetInfo && targetInfo.worldX !== undefined) {
        this.spawnProjectile(player, targetInfo.worldX, targetInfo.worldY, null, 'point', attackDmg);
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
            const lifesteal = Math.max(1, Math.round(attackDmg * 0.20));
            player.hp = Math.min(player.maxHp, player.hp + lifesteal);
          }
        }
      }

      // 2. Sweeping Edge (Swipe) Cleave to surrounding enemies in front arc
      const swipePct = (player.swipe !== undefined ? player.swipe : 35);
      if (swipePct > 0) {
        hasSweepTriggered = true;
        const facingVectors = {
          E:  { x: 0.707, y: -0.707 },
          SE: { x: 1.0, y: 0.0 },
          S:  { x: 0.707, y: 0.707 },
          SW: { x: 0.0, y: 1.0 },
          W:  { x: -0.707, y: 0.707 },
          NW: { x: -1.0, y: 0.0 },
          N:  { x: -0.707, y: -0.707 },
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
            this.io.emit('floating_text', {
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

    this.io.emit('entity_attack_fx', {
      attackerId: player.id,
      attackerType: 'player',
      class: player.characterClass,
      targetId: targetInfo ? targetInfo.targetId : null,
      x: player.x,
      y: player.y,
      facing: player.facing,
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
        player.equippedSkills[data.slot] = data.skillId;
      }
    }

    if (data.rune) {
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
      const skillName = ALL_CLASS_SKILLS[player.equippedSkills[data.slot]] ? ALL_CLASS_SKILLS[player.equippedSkills[data.slot]].name : data.skillId;
      const slotKey = data.slot === 'slot1' ? 'Q' : data.slot === 'slot2' ? 'E' : data.slot === 'slot3' ? 'R' : 'Shift';
      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: `⚡ Set [${skillName}] to [${slotKey}]!`,
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

    const mobsMap = player.zone === 'town' ? this.townMobs : player.zone === 'frostfell' ? this.frostfellMobs : this.dungeonMobs;
    let totalDmgDealt = 0;

    const applySkillDamage = (mob, baseDmg, isCrit = false) => {
      let dmg = baseDmg;
      if (runeId === 'flame') {
        dmg = Math.round(dmg * 1.20);
        mob.burnTimer = 3.5;
        mob.burnDmg = 12;
      }
      if (runeId === 'frost') {
        mob.chillTimer = 3.5;
        if (Math.random() < 0.25) mob.chillTimer = 5.0;
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
        this.io.emit('skill_fx', { type: 'whirlwind', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: wwRadius, playerId: player.id });
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
        this.io.emit('skill_fx', { type: 'earthshaker', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
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
        this.io.emit('skill_fx', { type: 'blade_charge', skillSlot: slot, cooldown, startX, startY, x: newX, y: newY, playerId: player.id });
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
        this.io.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `🛡️ Shield Barrier +${skill.shieldHp || 80}!`, color: '#38bdf8' });
        this.io.emit('skill_fx', { type: 'shield_slam', skillSlot: slot, cooldown, x: hitX, y: hitY, playerId: player.id });
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
        this.io.emit('floating_text', { x: player.x, y: player.y - 0.7, text: '🩸 BERSERK RAGE (+35% DMG & 20% Leech)', color: '#ef4444' });
        this.io.emit('skill_fx', { type: 'blood_rage', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'colossus_strike': {
        const hitX = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const hitY = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.io.emit('skill_fx', { type: 'colossus_strike', skillSlot: slot, cooldown, x: hitX, y: hitY, radius: skill.radius, playerId: player.id });
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
        this.io.emit('floating_text', { x: player.x, y: player.y - 0.7, text: '🏰 IRON FORTRESS (60% Shield & Thorns)', color: '#94a3b8' });
        this.io.emit('skill_fx', { type: 'iron_fortress', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'war_stomp': {
        this.io.emit('skill_fx', { type: 'war_stomp', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
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

      // === MAGE SKILLS ===
      case 'firestorm': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        const meteorRadius = skill.radius + (playerTalents.infernal_cataclysm ? playerTalents.infernal_cataclysm * 1.0 : 0);
        const meteorDmgMult = skill.dmgMult + (playerTalents.infernal_cataclysm ? playerTalents.infernal_cataclysm * 0.30 : 0);
        this.io.emit('skill_fx', { type: 'firestorm', skillSlot: slot, cooldown, x: tx, y: ty, radius: meteorRadius, playerId: player.id });
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
        this.io.emit('skill_fx', { type: 'frost_nova', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
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
        this.io.emit('skill_fx', { type: 'arcane_blink', skillSlot: slot, cooldown, startX, startY, x: newX, y: newY, playerId: player.id });
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
        this.io.emit('skill_fx', { type: 'chain_lightning', skillSlot: slot, cooldown, points, playerId: player.id });
        break;
      }

      case 'mana_shield': {
        player.shieldHp = (player.shieldHp || 0) + (skill.absorbHp || 120);
        this.io.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `✨ Mana Barrier +${skill.absorbHp || 120} Shield!`, color: '#67e8f9' });
        this.io.emit('skill_fx', { type: 'mana_shield', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'black_hole': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.io.emit('skill_fx', { type: 'black_hole', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
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
        this.io.emit('skill_fx', { type: 'blizzard', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
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
        this.io.emit('skill_fx', { type: 'pyroblast', skillSlot: slot, cooldown, startX: player.x, startY: player.y, x: hitX, y: hitY, radius: skill.radius, playerId: player.id });
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

      // === ROGUE SKILLS ===
      case 'fan_of_knives': {
        const knifeDmgMult = skill.dmgMult + (playerTalents.venomous_knives ? playerTalents.venomous_knives * 0.30 : 0);
        this.io.emit('skill_fx', { type: 'fan_of_knives', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
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
        this.io.emit('skill_fx', { type: 'toxic_bomb', skillSlot: slot, cooldown, x: tx, y: ty, radius: smokeRad, playerId: player.id });
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
        this.io.emit('skill_fx', { type: 'shadow_dash', skillSlot: slot, cooldown, startX, startY, x: newX, y: newY, playerId: player.id });
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
          this.io.emit('skill_fx', { type: 'shadowstep', skillSlot: slot, cooldown, startX, startY, x: targetMob.x, y: targetMob.y, playerId: player.id });
        }
        break;
      }

      case 'smoke_screen': {
        player.smokeScreenTimer = skill.duration || 3.5;
        player.sprintTimer = skill.duration || 3.5;
        this.io.emit('floating_text', { x: player.x, y: player.y - 0.7, text: '🌫️ VANISH! (Stealth & 100% Crit)', color: '#a855f7' });
        this.io.emit('skill_fx', { type: 'smoke_screen', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'death_blossom': {
        this.io.emit('skill_fx', { type: 'death_blossom', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
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
        this.io.emit('skill_fx', { type: 'poison_darts', skillSlot: slot, cooldown, x: player.x, y: player.y, dirX: normX, dirY: normY, playerId: player.id });
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
        this.io.emit('skill_fx', { type: 'caltrops', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
            mob.chillTimer = skill.slowDuration || 4.0;
          }
        }
        break;
      }
    }

    // Process Vampiric & Berserk heals
    if (runeId === 'vampiric' && totalDmgDealt > 0) {
      const vHeal = Math.max(1, Math.round(totalDmgDealt * 0.15));
      player.hp = Math.min(player.maxHp, player.hp + vHeal);
      this.io.emit('floating_text', { x: player.x, y: player.y - 0.6, text: `+${vHeal} HP (Vampiric)`, color: '#c084fc' });
    }
    if (player.berserkTimer > 0 && totalDmgDealt > 0) {
      const bHeal = Math.max(1, Math.round(totalDmgDealt * 0.20));
      player.hp = Math.min(player.maxHp, player.hp + bHeal);
      this.io.emit('floating_text', { x: player.x, y: player.y - 0.45, text: `+${bHeal} HP (Lifesteal)`, color: '#ef4444' });
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

      this.io.emit('skill_fx', {
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

      this.io.emit('floating_text', { x: player.x, y: player.y - 0.5, text: `+${healAmount} HP`, color: '#4ade80' });
      this.io.emit('heal_fx', { targetId: player.id, type: 'health' });
    } else if (potionType === 'mana' && player.inventory.manaPotions > 0) {
      if (player.mp >= player.maxMp) return;
      player.inventory.manaPotions--;
      const manaAmount = Math.round(player.maxMp * 0.5);
      player.mp = Math.min(player.maxMp, player.mp + manaAmount);

      this.io.emit('floating_text', { x: player.x, y: player.y - 0.5, text: `+${manaAmount} MP`, color: '#38bdf8' });
      this.io.emit('heal_fx', { targetId: player.id, type: 'mana' });
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
      this.io.emit('floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: `${icon} ${type.toUpperCase()}!`,
        color,
        size: 15
      });
    }
  }

  handlePickupItem(socketId, itemId) {
    const player = this.players.get(socketId);
    if (!player || player.isDead) return;

    const itemsMap = player.zone === 'town' ? this.townGroundItems : player.zone === 'frostfell' ? this.frostfellGroundItems : this.dungeonGroundItems;
    const item = itemsMap.get(itemId);
    if (!item) return;

    const dist = Math.hypot(item.x - player.x, item.y - player.y);
    if (dist <= 2.2) {
      if (item.type === 'gold') {
        player.gold += item.amount;
        this.io.emit('floating_text', { x: player.x, y: player.y - 0.6, text: `+${item.amount} Gold`, color: '#facc15' });
      } else if (item.itemId === 'health_potion') {
        player.inventory.healthPotions += (item.amount || 1);
        this.io.emit('floating_text', { x: player.x, y: player.y - 0.6, text: `+${item.amount || 1} Health Potion`, color: '#f87171' });
      } else if (item.itemId === 'mana_potion') {
        player.inventory.manaPotions += (item.amount || 1);
        this.io.emit('floating_text', { x: player.x, y: player.y - 0.6, text: `+${item.amount || 1} Mana Potion`, color: '#60a5fa' });
      } else {
        // Collectible Relic / Equipment / Consumables
        const def = item.customItemData || ITEMS[item.itemId];
        if (def) {
          const existing = player.inventory.items.find(i => i.id === def.id && !def.custom);
          if (existing && def.type !== 'equipment') {
            existing.count = (existing.count || 1) + 1;
          } else {
            player.inventory.items.push({ ...def, count: 1 });
          }
          this.io.emit('floating_text', {
            x: player.x,
            y: player.y - 0.6,
            text: `+${def.name}`,
            color: def.rarity === 'legendary' ? '#f59e0b' : def.rarity === 'epic' ? '#a855f7' : def.rarity === 'rare' ? '#38bdf8' : '#4ade80'
          });
        }
      }

      itemsMap.delete(itemId);
      this.io.emit('item_picked', { itemId, pickerId: player.id });

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
    const angle = Math.atan2(targetY - caster.y, targetX - caster.x);
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

    this.io.emit('projectile_spawned', {
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
    if (isCritical) rawDamage = Math.round(rawDamage * 1.5);

    // Apply mob defense reduction
    const mobDef = (mob.def || 0) + (mob.hasCommanderBuff ? 8 : 0);
    const defReduction = mobDef * 0.45;
    let damage = Math.max(2, Math.round(rawDamage - defReduction));

    // Fortified affix absorbs 30% damage
    if (mob.buffs && mob.buffs.includes('fortified')) {
      damage = Math.max(1, Math.round(damage * 0.7));
    }

    mob.hp -= damage;
    mob.state = 'chase';
    mob.targetPlayerId = player.id;

    this.io.emit('floating_text', {
      x: mob.x,
      y: mob.y - 0.7,
      text: `${damage}${isCritical ? ' CRIT!' : ''}`,
      color: isCritical ? '#f59e0b' : '#ef4444',
      size: isCritical ? 22 : 16
    });

    if (mob.hp <= 0) {
      this.handleMobDeath(mob, player);
    }
  }

  handleMobDeath(mob, killerPlayer) {
    mob.state = 'dead';
    mob.hp = 0;
    mob.respawnTimer = mob.isBoss ? 25.0 : 10.0;

    const zone = killerPlayer ? killerPlayer.zone : (mob.id.startsWith('frost_') ? 'frostfell' : 'town');

    if (killerPlayer) {
      killerPlayer.inventory.kills++;
      this.awardExp(killerPlayer, mob.exp);

      // Talent on-kill effects (Juggernaut, Astral Overload, Vampiric Edge)
      if (killerPlayer.skills) {
        const tree = SKILL_TREES[killerPlayer.characterClass] || [];
        for (const t of tree) {
          const rank = killerPlayer.skills[t.id] || 0;
          if (rank > 0 && t.effects) {
            if (t.effects.killHealPercent) {
              const heal = Math.round(killerPlayer.maxHp * t.effects.killHealPercent * rank);
              killerPlayer.hp = Math.min(killerPlayer.maxHp, killerPlayer.hp + heal);
              this.io.emit('floating_text', { x: killerPlayer.x, y: killerPlayer.y - 0.5, text: `+${heal} HP (Juggernaut)`, color: '#4ade80' });
            }
            if (t.effects.killHealFlat) {
              const heal = t.effects.killHealFlat * rank;
              killerPlayer.hp = Math.min(killerPlayer.maxHp, killerPlayer.hp + heal);
              this.io.emit('floating_text', { x: killerPlayer.x, y: killerPlayer.y - 0.5, text: `+${heal} HP (Vampiric)`, color: '#4ade80' });
            }
            if (t.effects.killManaRestore) {
              const mana = t.effects.killManaRestore * rank;
              killerPlayer.mp = Math.min(killerPlayer.maxMp, killerPlayer.mp + mana);
              this.io.emit('floating_text', { x: killerPlayer.x, y: killerPlayer.y - 0.5, text: `+${mana} MP (Astral)`, color: '#38bdf8' });
            }
          }
        }
      }

      if (mob.isBoss) {
        this.broadcastSystemMessage(`👑 Legendary Conquest! [${killerPlayer.name}] vanquished [${mob.name}]!`);
        if (killerPlayer.zone === 'dungeon') {
          this.broadcastSystemMessage(`🎉 The Dungeon Boss fell! A portal to deeper dungeon depths has unlocked.`);
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
    if ((zone === 'dungeon' || zone === 'frostfell') && Math.random() < 0.45) {
      const relics = ['ancient_ruby', 'cursed_chalice', 'shadow_essence'];
      const r = relics[Math.floor(Math.random() * relics.length)];
      this.spawnGroundItem(zone, 'item', r, mob.x + (Math.random() - 0.5) * 0.8, mob.y + (Math.random() - 0.5) * 0.8, 1);
    }

    this.io.emit('mob_died', { mobId: mob.id, killerId: killerPlayer ? killerPlayer.id : null });
  }

  awardExp(player, amount) {
    if (player.level >= 150) return;
    player.exp += amount;
    this.io.emit('floating_text', { x: player.x, y: player.y - 1.0, text: `+${amount} EXP`, color: '#a855f7' });

    while (player.level < 150 && player.exp >= player.expNext) {
      player.exp -= player.expNext;
      player.level++;
      player.expNext = Math.round(70 + player.level * 45 + Math.pow(player.level, 1.82) * 11);

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

      this.io.emit('level_up', { playerId: player.id, level: player.level, x: player.x, y: player.y });
      this.io.emit('floating_text', {
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
    const itemsMap = zone === 'town' ? this.townGroundItems : zone === 'frostfell' ? this.frostfellGroundItems : this.dungeonGroundItems;

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
    this.io.emit('item_dropped', item);
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
    // 1. Update Players
    for (const player of this.players.values()) {
      const socket = this.io.sockets.sockets.get(player.id);
      if (player.isDead) {
        player.respawnTimer -= dt;
        if (player.respawnTimer <= 0) {
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
            this.io.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `☠️ -${dotDmg}`, color: '#22c55e', size: 14 });
          } else if (fx.type === 'burn' && fx.tickTimer <= 0) {
            fx.tickTimer = 0.6;
            const dotDmg = Math.max(1, Math.round(fx.value));
            player.hp = Math.max(0, player.hp - dotDmg);
            this.io.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `🔥 -${dotDmg}`, color: '#f97316', size: 14 });
          } else if (fx.type === 'chill') {
            isChilled = true;
          }

          if (player.hp <= 0 && !player.isDead) {
            player.hp = 0;
            player.isDead = true;
            player.respawnTimer = 5.0;
            this.io.emit('player_died', { playerId: player.id, killerName: fx.type.toUpperCase() });
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
      const groundMap = player.zone === 'town' ? this.townGroundItems : player.zone === 'frostfell' ? this.frostfellGroundItems : this.dungeonGroundItems;
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
    this.updateMobsList(this.frostfellMobs, 'frostfell', dt);
    this.updateMobsList(this.dungeonMobs, 'dungeon', dt);

    // 3. Update Projectiles
    for (const [projId, proj] of this.projectiles.entries()) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;

      const mobsMap = proj.zone === 'town' ? this.townMobs : proj.zone === 'frostfell' ? this.frostfellMobs : this.dungeonMobs;
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
        this.io.emit('projectile_exploded', { id: proj.id, x: proj.x, y: proj.y });
        this.projectiles.delete(projId);
      }
    }
  }

  updateMobsList(mobsMap, zone, dt) {
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') {
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
          this.io.emit('floating_text', { x: mob.x, y: mob.y - 0.7, text: `🔥 -${dotDmg}`, color: '#f97316', size: 14 });
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
          this.io.emit('floating_text', { x: mob.x, y: mob.y - 0.7, text: `☠️ -${dotDmg}`, color: '#22c55e', size: 14 });
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
              this.io.emit('floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: '💨 MISS! (Stealth)', color: '#94a3b8' });
              continue;
            }

            const effectiveDmg = mob.hasCommanderBuff ? Math.round(mob.dmg * 1.35) : mob.dmg;
            let damageDealt = Math.max(1, Math.round(effectiveDmg - (targetPlayer.def * 0.5)));

            // Iron Fortress: -60% damage and 25 Thorns reflect
            if (targetPlayer.ironFortressTimer > 0) {
              damageDealt = Math.max(1, Math.round(damageDealt * 0.40));
              this.applyDamageToMob(targetPlayer, mob, 25, false);
              this.io.emit('floating_text', { x: mob.x, y: mob.y - 0.7, text: '⚔️ 25 Thorns!', color: '#e2e8f0' });
            }

            // Shield Barrier absorption
            if (targetPlayer.shieldHp > 0) {
              const absorbed = Math.min(targetPlayer.shieldHp, damageDealt);
              targetPlayer.shieldHp -= absorbed;
              damageDealt -= absorbed;
              this.io.emit('floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.5, text: `🛡️ Absorbed -${absorbed}`, color: '#38bdf8' });
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

            this.io.emit('floating_text', { x: targetPlayer.x, y: targetPlayer.y - 0.7, text: `-${damageDealt}`, color: '#ef4444' });
            this.io.emit('entity_attack_fx', { attackerId: mob.id, attackerType: 'mob', targetId: targetPlayer.id, x: mob.x, y: mob.y });

            if (targetPlayer.hp <= 0) {
              targetPlayer.hp = 0;
              targetPlayer.isDead = true;
              targetPlayer.respawnTimer = 5.0;
              this.io.emit('player_died', { playerId: targetPlayer.id, killerName: mob.name });
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

    const townMobsArr = Array.from(this.townMobs.values()).map(m => ({
      id: m.id, type: m.type, name: m.name, level: m.level, x: m.x, y: m.y,
      facing: m.facing, hp: Math.round(m.hp), maxHp: m.maxHp, state: m.state, isBoss: m.isBoss,
      buffs: m.buffs || [], isCommander: !!m.isCommander, auraRadius: m.auraRadius || 0, hasCommanderBuff: !!m.hasCommanderBuff
    }));

    const dungeonMobsArr = Array.from(this.dungeonMobs.values()).map(m => ({
      id: m.id, type: m.type, name: m.name, level: m.level, x: m.x, y: m.y,
      facing: m.facing, hp: Math.round(m.hp), maxHp: m.maxHp, state: m.state, isBoss: m.isBoss,
      buffs: m.buffs || [], isCommander: !!m.isCommander, auraRadius: m.auraRadius || 0, hasCommanderBuff: !!m.hasCommanderBuff
    }));

    const frostfellMobsArr = Array.from(this.frostfellMobs.values()).map(m => ({
      id: m.id, type: m.type, name: m.name, level: m.level, x: m.x, y: m.y,
      facing: m.facing, hp: Math.round(m.hp), maxHp: m.maxHp, state: m.state, isBoss: m.isBoss,
      buffs: m.buffs || [], isCommander: !!m.isCommander, auraRadius: m.auraRadius || 0, hasCommanderBuff: !!m.hasCommanderBuff
    }));

    this.io.emit('game_tick', {
      timestamp: Date.now(),
      players: playersArr,
      townMobs: townMobsArr,
      frostfellMobs: frostfellMobsArr,
      dungeonMobs: dungeonMobsArr,
      dungeonChests: this.dungeon ? this.dungeon.chests : []
    });
  }
}

module.exports = GameServer;
