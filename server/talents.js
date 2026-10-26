// Slop Hero - Comprehensive 405 Talent Tree Architecture
// 3 Classes x 3 Specializations x 45 Talents = 405 Total Talents (15 Tiers per Branch)

function buildBranchTalents(classKey, branchName, branchPrefix, tierThemes) {
  const talents = [];

  for (let tier = 1; tier <= 15; tier++) {
    const theme = tierThemes[tier - 1];
    const prevA = tier > 1 ? `${branchPrefix}_t${tier - 1}_a` : null;
    const prevB = tier > 1 ? `${branchPrefix}_t${tier - 1}_b` : null;
    const prevC = tier > 1 ? `${branchPrefix}_t${tier - 1}_c` : null;
    const isKeystone = tier === 15;
    const maxRank = isKeystone ? 1 : 3;

    // Node A (Primary Specialty)
    talents.push({
      id: `${branchPrefix}_t${tier}_a`,
      branch: branchName,
      tier,
      isKeystone,
      name: theme.nodes[0].name,
      icon: theme.nodes[0].icon,
      desc: theme.nodes[0].desc,
      maxRank,
      requires: prevA,
      effects: theme.nodes[0].effects
    });

    // Node B (Utility / Synergy)
    talents.push({
      id: `${branchPrefix}_t${tier}_b`,
      branch: branchName,
      tier,
      isKeystone,
      name: theme.nodes[1].name,
      icon: theme.nodes[1].icon,
      desc: theme.nodes[1].desc,
      maxRank,
      requires: prevB,
      effects: theme.nodes[1].effects
    });

    // Node C (Secondary Stat / Empowerment)
    talents.push({
      id: `${branchPrefix}_t${tier}_c`,
      branch: branchName,
      tier,
      isKeystone,
      name: theme.nodes[2].name,
      icon: theme.nodes[2].icon,
      desc: theme.nodes[2].desc,
      maxRank,
      requires: prevC,
      effects: theme.nodes[2].effects
    });
  }

  return talents;
}

// ==========================================
// WARRIOR TALENTS (3 Branches x 45 = 135)
// ==========================================

// 1. Warrior - Juggernaut (Defense)
const warJugThemes = [
  { nodes: [
    { name: 'Iron Skin', icon: '🛡️', desc: '+15 Armor and +80 Max HP per rank.', effects: { bonusDef: 15, bonusHp: 80 } },
    { name: 'Thick Hide', icon: '🦏', desc: '+120 Max HP and +8 Armor per rank.', effects: { bonusHp: 120, bonusDef: 8 } },
    { name: 'Spiked Pauldrons', icon: '🌵', desc: '+15 Thorns damage and +6 Armor per rank.', effects: { thorns: 15, bonusDef: 6 } }
  ]},
  { nodes: [
    { name: 'Hardened Carapace', icon: '🪖', desc: '+22 Armor and +140 Max HP per rank.', effects: { bonusDef: 22, bonusHp: 140 } },
    { name: 'Blood of Titans', icon: '🩸', desc: '+200 Max HP per rank.', effects: { bonusHp: 200 } },
    { name: 'Bramble Armor', icon: '🌿', desc: '+25 Thorns damage and +10 Armor per rank.', effects: { thorns: 25, bonusDef: 10 } }
  ]},
  { nodes: [
    { name: 'Steel Bulwark', icon: '🏰', desc: '+28 Armor and +160 Max HP per rank.', effects: { bonusDef: 28, bonusHp: 160 } },
    { name: 'Unyielding Girth', icon: '🍖', desc: '+260 Max HP and +10 Armor per rank.', effects: { bonusHp: 260, bonusDef: 10 } },
    { name: 'Razor Spikes', icon: '⚡', desc: '+35 Thorns and +12 Attack Damage per rank.', effects: { thorns: 35, bonusDmg: 12 } }
  ]},
  { nodes: [
    { name: 'Granite Resolve', icon: '🪨', desc: '+35 Armor and +180 Max HP per rank.', effects: { bonusDef: 35, bonusHp: 180 } },
    { name: 'Colossus Stature', icon: '🗿', desc: '+320 Max HP and +15 Armor per rank.', effects: { bonusHp: 320, bonusDef: 15 } },
    { name: 'Retaliatory Spite', icon: '💥', desc: '+45 Thorns damage and +15 Defense per rank.', effects: { thorns: 45, bonusDef: 15 } }
  ]},
  { nodes: [
    { name: 'Aegis of Valor', icon: '🎖️', desc: '+42 Armor and +220 Max HP per rank.', effects: { bonusDef: 42, bonusHp: 220 } },
    { name: 'Behemoth Vigor', icon: '🐘', desc: '+400 Max HP per rank.', effects: { bonusHp: 400 } },
    { name: 'Iron Thorns Barricade', icon: '⛓️', desc: '+55 Thorns damage and +20 Armor per rank.', effects: { thorns: 55, bonusDef: 20 } }
  ]},
  { nodes: [
    { name: 'Bastion of the North', icon: '❄️', desc: '+50 Armor and +260 Max HP per rank.', effects: { bonusDef: 50, bonusHp: 260 } },
    { name: 'Gargantuan Blood', icon: '❤️', desc: '+480 Max HP and +25 Armor per rank.', effects: { bonusHp: 480, bonusDef: 25 } },
    { name: 'Spikeflesh Mutation', icon: '🦴', desc: '+70 Thorns and +20 Attack Damage per rank.', effects: { thorns: 70, bonusDmg: 20 } }
  ]},
  { nodes: [
    { name: 'Impenetrable Plate', icon: '🛡️', desc: '+58 Armor and +300 Max HP per rank.', effects: { bonusDef: 58, bonusHp: 300 } },
    { name: 'Primordial Endurance', icon: '🌋', desc: '+560 Max HP per rank.', effects: { bonusHp: 560 } },
    { name: 'Punishing Counter', icon: '⚔️', desc: '+85 Thorns and +30 Armor per rank.', effects: { thorns: 85, bonusDef: 30 } }
  ]},
  { nodes: [
    { name: 'Dreadnought Hull', icon: '🚢', desc: '+66 Armor and +350 Max HP per rank.', effects: { bonusDef: 66, bonusHp: 350 } },
    { name: 'Mountain Heart', icon: '🏔️', desc: '+650 Max HP and +35 Armor per rank.', effects: { bonusHp: 650, bonusDef: 35 } },
    { name: 'Barbed Exoskeleton', icon: '🦂', desc: '+100 Thorns and +25 Attack Damage per rank.', effects: { thorns: 100, bonusDmg: 25 } }
  ]},
  { nodes: [
    { name: 'Adamantine Coating', icon: '💎', desc: '+75 Armor and +400 Max HP per rank.', effects: { bonusDef: 75, bonusHp: 400 } },
    { name: 'Leviathan Constitution', icon: '🐋', desc: '+750 Max HP per rank.', effects: { bonusHp: 750 } },
    { name: 'Serrated Fortress', icon: '🏰', desc: '+120 Thorns and +40 Armor per rank.', effects: { thorns: 120, bonusDef: 40 } }
  ]},
  { nodes: [
    { name: 'Fortress Wall Form', icon: '🧱', desc: '+85 Armor and +450 Max HP per rank.', effects: { bonusDef: 85, bonusHp: 450 } },
    { name: 'Eternal Vitality', icon: '🌳', desc: '+860 Max HP and +45 Armor per rank.', effects: { bonusHp: 860, bonusDef: 45 } },
    { name: 'Vengeful Carapace', icon: '⚡', desc: '+140 Thorns and +30 Attack Damage per rank.', effects: { thorns: 140, bonusDmg: 30 } }
  ]},
  { nodes: [
    { name: 'Diamondplate Cuirass', icon: '💠', desc: '+95 Armor and +500 Max HP per rank.', effects: { bonusDef: 95, bonusHp: 500 } },
    { name: 'Immortal Font', icon: '⛲', desc: '+980 Max HP per rank.', effects: { bonusHp: 980 } },
    { name: 'Spikequake Shell', icon: '💥', desc: '+165 Thorns and +50 Armor per rank.', effects: { thorns: 165, bonusDef: 50 } }
  ]},
  { nodes: [
    { name: 'Obsidian Ward', icon: '🖤', desc: '+110 Armor and +560 Max HP per rank.', effects: { bonusDef: 110, bonusHp: 560 } },
    { name: 'Titan God Resilience', icon: '👑', desc: '+1,100 Max HP and +55 Armor per rank.', effects: { bonusHp: 1100, bonusDef: 55 } },
    { name: 'Retribution Aura', icon: '☀️', desc: '+190 Thorns and +40 Attack Damage per rank.', effects: { thorns: 190, bonusDmg: 40 } }
  ]},
  { nodes: [
    { name: 'Worldbreaker Armor', icon: '🌌', desc: '+125 Armor and +640 Max HP per rank.', effects: { bonusDef: 125, bonusHp: 640 } },
    { name: 'Immense Bulk', icon: '🪐', desc: '+1,250 Max HP per rank.', effects: { bonusHp: 1250 } },
    { name: 'Iron Bramble Sovereign', icon: '👑', desc: '+220 Thorns and +65 Armor per rank.', effects: { thorns: 220, bonusDef: 65 } }
  ]},
  { nodes: [
    { name: 'Invincible Citadel', icon: '🏛️', desc: '+145 Armor and +750 Max HP per rank.', effects: { bonusDef: 145, bonusHp: 750 } },
    { name: 'Primordial Core Bulk', icon: '🔮', desc: '+1,450 Max HP and +75 Armor per rank.', effects: { bonusHp: 1450, bonusDef: 75 } },
    { name: 'Hellthorn Armor', icon: '🔥', desc: '+260 Thorns and +50 Attack Damage per rank.', effects: { thorns: 260, bonusDmg: 50 } }
  ]},
  { nodes: [
    { name: 'Colossus Avatar', icon: '🗿', desc: 'KEYSTONE: Immovable titan sovereign. +2,000 Max HP, +220 Armor, and +350 Thorns.', effects: { bonusHp: 2000, bonusDef: 220, thorns: 350 } },
    { name: 'Immortal Bastion Sovereign', icon: '🏰', desc: 'KEYSTONE: Infinite stamina. +2,800 Max HP, +160 Armor, and +50 Attack Damage.', effects: { bonusHp: 2800, bonusDef: 160, bonusDmg: 50 } },
    { name: 'Iron God of Retribution', icon: '⚡', desc: 'KEYSTONE: Spikes shatter foes. +500 Thorns, +180 Armor, and +80 Attack Damage.', effects: { thorns: 500, bonusDef: 180, bonusDmg: 80 } }
  ]}
];

// 2. Warrior - Blademaster (Cleave & Speed)
const warBladeThemes = [
  { nodes: [
    { name: 'Blade Mastery', icon: '⚔️', desc: '+12 Attack Damage and +15% Swipe Cleave per rank.', effects: { bonusDmg: 12, bonusSwipe: 15 } },
    { name: 'Quick Reflexes', icon: '⚡', desc: '+10% Attack Speed and +0.2 Move Speed per rank.', effects: { bonusAttackSpeed: 0.10, bonusSpeed: 0.2 } },
    { name: 'Honed Edge', icon: '🗡️', desc: '+16 Attack Damage per rank.', effects: { bonusDmg: 16 } }
  ]},
  { nodes: [
    { name: 'Sweeping Arc', icon: '🌊', desc: '+22% Swipe Cleave and +15 Attack Damage per rank.', effects: { bonusSwipe: 22, bonusDmg: 15 } },
    { name: 'Flurry Cadence', icon: '🌪️', desc: '+14% Attack Speed and +0.25 Move Speed per rank.', effects: { bonusAttackSpeed: 0.14, bonusSpeed: 0.25 } },
    { name: 'Razor Edge', icon: '🔪', desc: '+22 Attack Damage per rank.', effects: { bonusDmg: 22 } }
  ]},
  { nodes: [
    { name: 'Cyclone Sweep', icon: '🌀', desc: '+30% Swipe Cleave and +18 Attack Damage per rank.', effects: { bonusSwipe: 30, bonusDmg: 18 } },
    { name: 'Battle Tempo', icon: '🥁', desc: '+18% Attack Speed and +0.3 Move Speed per rank.', effects: { bonusAttackSpeed: 0.18, bonusSpeed: 0.3 } },
    { name: 'Serrated Steel', icon: '🗡️', desc: '+28 Attack Damage per rank.', effects: { bonusDmg: 28 } }
  ]},
  { nodes: [
    { name: 'Tide of Steel', icon: '🌊', desc: '+38% Swipe Cleave and +22 Attack Damage per rank.', effects: { bonusSwipe: 38, bonusDmg: 22 } },
    { name: 'Wind Dancer Steps', icon: '🍃', desc: '+22% Attack Speed and +0.35 Move Speed per rank.', effects: { bonusAttackSpeed: 0.22, bonusSpeed: 0.35 } },
    { name: 'Keen Falchion', icon: '⚔️', desc: '+35 Attack Damage per rank.', effects: { bonusDmg: 35 } }
  ]},
  { nodes: [
    { name: 'Wide Cleave', icon: '💥', desc: '+46% Swipe Cleave and +26 Attack Damage per rank.', effects: { bonusSwipe: 46, bonusDmg: 26 } },
    { name: 'Swiftblade Mastery', icon: '⚡', desc: '+26% Attack Speed and +0.4 Move Speed per rank.', effects: { bonusAttackSpeed: 0.26, bonusSpeed: 0.4 } },
    { name: 'Brutal Edge', icon: '🪓', desc: '+42 Attack Damage per rank.', effects: { bonusDmg: 42 } }
  ]},
  { nodes: [
    { name: 'Vacuum Slash', icon: '🌪️', desc: '+54% Swipe Cleave and +30 Attack Damage per rank.', effects: { bonusSwipe: 54, bonusDmg: 30 } },
    { name: 'Stormfury Strikes', icon: '🌩️', desc: '+30% Attack Speed and +0.4 Move Speed per rank.', effects: { bonusAttackSpeed: 0.30, bonusSpeed: 0.4 } },
    { name: 'Adamant Blade', icon: '💎', desc: '+50 Attack Damage per rank.', effects: { bonusDmg: 50 } }
  ]},
  { nodes: [
    { name: 'Whirlwind Supremacy', icon: '🌀', desc: '+62% Swipe Cleave and +35 Attack Damage per rank.', effects: { bonusSwipe: 62, bonusDmg: 35 } },
    { name: 'Zephyr Momentum', icon: '💨', desc: '+34% Attack Speed and +0.45 Move Speed per rank.', effects: { bonusAttackSpeed: 0.34, bonusSpeed: 0.45 } },
    { name: 'Vorpal Edge', icon: '🗡️', desc: '+58 Attack Damage per rank.', effects: { bonusDmg: 58 } }
  ]},
  { nodes: [
    { name: 'Great Cleaver', icon: '⚔️', desc: '+70% Swipe Cleave and +40 Attack Damage per rank.', effects: { bonusSwipe: 70, bonusDmg: 40 } },
    { name: 'Sonic Slashes', icon: '⚡', desc: '+38% Attack Speed and +0.5 Move Speed per rank.', effects: { bonusAttackSpeed: 0.38, bonusSpeed: 0.5 } },
    { name: 'Runed Greatsword', icon: '✨', desc: '+66 Attack Damage per rank.', effects: { bonusDmg: 66 } }
  ]},
  { nodes: [
    { name: 'Typhoon Vortex', icon: '🌪️', desc: '+80% Swipe Cleave and +46 Attack Damage per rank.', effects: { bonusSwipe: 80, bonusDmg: 46 } },
    { name: 'Lightning Tempo', icon: '🌩️', desc: '+42% Attack Speed and +0.55 Move Speed per rank.', effects: { bonusAttackSpeed: 0.42, bonusSpeed: 0.55 } },
    { name: 'Titanium Edge', icon: '🔩', desc: '+75 Attack Damage per rank.', effects: { bonusDmg: 75 } }
  ]},
  { nodes: [
    { name: 'Horizon Cutter', icon: '🌅', desc: '+90% Swipe Cleave and +52 Attack Damage per rank.', effects: { bonusSwipe: 90, bonusDmg: 52 } },
    { name: 'Infinite Flurry', icon: '💫', desc: '+46% Attack Speed and +0.6 Move Speed per rank.', effects: { bonusAttackSpeed: 0.46, bonusSpeed: 0.6 } },
    { name: 'Godforged Steel', icon: '👑', desc: '+85 Attack Damage per rank.', effects: { bonusDmg: 85 } }
  ]},
  { nodes: [
    { name: 'Maelstrom Cleave', icon: '🌊', desc: '+100% Swipe Cleave and +60 Attack Damage per rank.', effects: { bonusSwipe: 100, bonusDmg: 60 } },
    { name: 'Hypervelocity Form', icon: '⚡', desc: '+50% Attack Speed and +0.65 Move Speed per rank.', effects: { bonusAttackSpeed: 0.50, bonusSpeed: 0.65 } },
    { name: 'Executioner Greatblade', icon: '🪓', desc: '+96 Attack Damage per rank.', effects: { bonusDmg: 96 } }
  ]},
  { nodes: [
    { name: 'Planet Cleaver', icon: '🪐', desc: '+115% Swipe Cleave and +68 Attack Damage per rank.', effects: { bonusSwipe: 115, bonusDmg: 68 } },
    { name: 'Supersonic Strikes', icon: '💨', desc: '+55% Attack Speed and +0.7 Move Speed per rank.', effects: { bonusAttackSpeed: 0.55, bonusSpeed: 0.7 } },
    { name: 'Mythic Edge', icon: '🌟', desc: '+110 Attack Damage per rank.', effects: { bonusDmg: 110 } }
  ]},
  { nodes: [
    { name: 'Dimensional Shear', icon: '🌌', desc: '+130% Swipe Cleave and +78 Attack Damage per rank.', effects: { bonusSwipe: 130, bonusDmg: 78 } },
    { name: 'Chronoblade Pace', icon: '⏳', desc: '+60% Attack Speed and +0.75 Move Speed per rank.', effects: { bonusAttackSpeed: 0.60, bonusSpeed: 0.75 } },
    { name: 'Primordial Blade', icon: '🔥', desc: '+125 Attack Damage per rank.', effects: { bonusDmg: 125 } }
  ]},
  { nodes: [
    { name: 'Celestial Cleave', icon: '✨', desc: '+150% Swipe Cleave and +90 Attack Damage per rank.', effects: { bonusSwipe: 150, bonusDmg: 90 } },
    { name: 'Warp Speed Flurry', icon: '🚀', desc: '+66% Attack Speed and +0.8 Move Speed per rank.', effects: { bonusAttackSpeed: 0.66, bonusSpeed: 0.8 } },
    { name: 'Infinity Falchion', icon: '♾️', desc: '+145 Attack Damage per rank.', effects: { bonusDmg: 145 } }
  ]},
  { nodes: [
    { name: 'Blade Singularity Sovereign', icon: '💫', desc: 'KEYSTONE: Infinite cleaving void. +220% Swipe Cleave, +75% Attack Speed, and +150 Attack Damage.', effects: { bonusSwipe: 220, bonusAttackSpeed: 0.75, bonusDmg: 150 } },
    { name: 'Tempest God Speed', icon: '⚡', desc: 'KEYSTONE: Godspeed strikes. +100% Attack Speed, +1.2 Move Speed, and +160 Attack Damage.', effects: { bonusAttackSpeed: 1.00, bonusSpeed: 1.2, bonusDmg: 160 } },
    { name: 'Grand Blademaster Ascendance', icon: '👑', desc: 'KEYSTONE: Supreme sword saint. +220 Attack Damage, +120% Swipe Cleave, and +50% Attack Speed.', effects: { bonusDmg: 220, bonusSwipe: 120, bonusAttackSpeed: 0.50 } }
  ]}
];

// 3. Warrior - Warlord (Crits & Burst)
const warWarlordThemes = [
  { nodes: [
    { name: 'Brutal Might', icon: '💥', desc: '+15 Attack Damage and +8% Critical Chance per rank.', effects: { bonusDmg: 15, critChanceBonus: 0.08 } },
    { name: 'Carnage Lifesteal', icon: '🩸', desc: '+1.5% Lifesteal and +80 Max HP per rank.', effects: { lifeSteal: 0.015, bonusHp: 80 } },
    { name: 'Executioner Focus', icon: '🎯', desc: '+25% Critical Damage and +10 Attack Damage per rank.', effects: { critDmgBonus: 0.25, bonusDmg: 10 } }
  ]},
  { nodes: [
    { name: 'Savage Precision', icon: '🗡️', desc: '+20 Attack Damage and +10% Critical Chance per rank.', effects: { bonusDmg: 20, critChanceBonus: 0.10 } },
    { name: 'Blood Feast', icon: '🥩', desc: '+2.0% Lifesteal and +120 Max HP per rank.', effects: { lifeSteal: 0.02, bonusHp: 120 } },
    { name: 'Cruel Decapitation', icon: '🪓', desc: '+35% Critical Damage and +15 Attack Damage per rank.', effects: { critDmgBonus: 0.35, bonusDmg: 15 } }
  ]},
  { nodes: [
    { name: 'Warlord Fury', icon: '😡', desc: '+26 Attack Damage and +12% Critical Chance per rank.', effects: { bonusDmg: 26, critChanceBonus: 0.12 } },
    { name: 'Sanguine Thirst', icon: '🍷', desc: '+2.5% Lifesteal and +160 Max HP per rank.', effects: { lifeSteal: 0.025, bonusHp: 160 } },
    { name: 'Annihilating Blow', icon: '🔨', desc: '+45% Critical Damage and +20 Attack Damage per rank.', effects: { critDmgBonus: 0.45, bonusDmg: 20 } }
  ]},
  { nodes: [
    { name: 'Bone Shatter', icon: '🦴', desc: '+32 Attack Damage and +14% Critical Chance per rank.', effects: { bonusDmg: 32, critChanceBonus: 0.14 } },
    { name: 'Vampiric Vitality', icon: '🧛', desc: '+3.0% Lifesteal and +200 Max HP per rank.', effects: { lifeSteal: 0.03, bonusHp: 200 } },
    { name: 'Mortal Wound', icon: '🩸', desc: '+55% Critical Damage and +25 Attack Damage per rank.', effects: { critDmgBonus: 0.55, bonusDmg: 25 } }
  ]},
  { nodes: [
    { name: 'Wrathful Cleaver', icon: '⚔️', desc: '+40 Attack Damage and +16% Critical Chance per rank.', effects: { bonusDmg: 40, critChanceBonus: 0.16 } },
    { name: 'Bloodlust Surges', icon: '⚡', desc: '+3.5% Lifesteal and +250 Max HP per rank.', effects: { lifeSteal: 0.035, bonusHp: 250 } },
    { name: 'Rupturing Criticals', icon: '💥', desc: '+65% Critical Damage and +30 Attack Damage per rank.', effects: { critDmgBonus: 0.65, bonusDmg: 30 } }
  ]},
  { nodes: [
    { name: 'Ravaging Impact', icon: '🌋', desc: '+48 Attack Damage and +18% Critical Chance per rank.', effects: { bonusDmg: 48, critChanceBonus: 0.18 } },
    { name: 'Crimson Reservoir', icon: '🧪', desc: '+4.0% Lifesteal and +300 Max HP per rank.', effects: { lifeSteal: 0.04, bonusHp: 300 } },
    { name: 'Fatal Strike Mastery', icon: '🎯', desc: '+75% Critical Damage and +36 Attack Damage per rank.', effects: { critDmgBonus: 0.75, bonusDmg: 36 } }
  ]},
  { nodes: [
    { name: 'Berserker Onslaught', icon: '🔥', desc: '+56 Attack Damage and +20% Critical Chance per rank.', effects: { bonusDmg: 56, critChanceBonus: 0.20 } },
    { name: 'Gore Drinker', icon: '🩸', desc: '+4.5% Lifesteal and +360 Max HP per rank.', effects: { lifeSteal: 0.045, bonusHp: 360 } },
    { name: 'Executioner Wrath', icon: '🪓', desc: '+90% Critical Damage and +42 Attack Damage per rank.', effects: { critDmgBonus: 0.90, bonusDmg: 42 } }
  ]},
  { nodes: [
    { name: 'Skull Crusher', icon: '💀', desc: '+65 Attack Damage and +22% Critical Chance per rank.', effects: { bonusDmg: 65, critChanceBonus: 0.22 } },
    { name: 'Vital Leech', icon: '❤️', desc: '+5.0% Lifesteal and +420 Max HP per rank.', effects: { lifeSteal: 0.05, bonusHp: 420 } },
    { name: 'Devastating Rend', icon: '⚔️', desc: '+105% Critical Damage and +50 Attack Damage per rank.', effects: { critDmgBonus: 1.05, bonusDmg: 50 } }
  ]},
  { nodes: [
    { name: 'Titan Slayer', icon: '🗿', desc: '+75 Attack Damage and +24% Critical Chance per rank.', effects: { bonusDmg: 75, critChanceBonus: 0.24 } },
    { name: 'Immortal Sanguine', icon: '🧛', desc: '+5.5% Lifesteal and +500 Max HP per rank.', effects: { lifeSteal: 0.055, bonusHp: 500 } },
    { name: 'Cataclysmic Decapitation', icon: '💥', desc: '+120% Critical Damage and +58 Attack Damage per rank.', effects: { critDmgBonus: 1.20, bonusDmg: 58 } }
  ]},
  { nodes: [
    { name: 'Warlord Supremacy Force', icon: '👑', desc: '+86 Attack Damage and +26% Critical Chance per rank.', effects: { bonusDmg: 86, critChanceBonus: 0.26 } },
    { name: 'Carnage Eternal', icon: '🔥', desc: '+6.0% Lifesteal and +600 Max HP per rank.', effects: { lifeSteal: 0.06, bonusHp: 600 } },
    { name: 'Apex Predator Blow', icon: '🦁', desc: '+140% Critical Damage and +66 Attack Damage per rank.', effects: { critDmgBonus: 1.40, bonusDmg: 66 } }
  ]},
  { nodes: [
    { name: 'Godslayer Precision', icon: '⚡', desc: '+98 Attack Damage and +28% Critical Chance per rank.', effects: { bonusDmg: 98, critChanceBonus: 0.28 } },
    { name: 'Blood God Grace', icon: '🩸', desc: '+6.5% Lifesteal and +720 Max HP per rank.', effects: { lifeSteal: 0.065, bonusHp: 720 } },
    { name: 'Disemboweling Might', icon: '🗡️', desc: '+160% Critical Damage and +75 Attack Damage per rank.', effects: { critDmgBonus: 1.60, bonusDmg: 75 } }
  ]},
  { nodes: [
    { name: 'Cataclysmic Burst', icon: '🌋', desc: '+112 Attack Damage and +30% Critical Chance per rank.', effects: { bonusDmg: 112, critChanceBonus: 0.30 } },
    { name: 'Sanguine Sovereign', icon: '👑', desc: '+7.0% Lifesteal and +850 Max HP per rank.', effects: { lifeSteal: 0.07, bonusHp: 850 } },
    { name: 'Infinity Execution', icon: '🪓', desc: '+185% Critical Damage and +85 Attack Damage per rank.', effects: { critDmgBonus: 1.85, bonusDmg: 85 } }
  ]},
  { nodes: [
    { name: 'Ragnarok Fury', icon: '🔥', desc: '+128 Attack Damage and +33% Critical Chance per rank.', effects: { bonusDmg: 128, critChanceBonus: 0.33 } },
    { name: 'Vampiric Overlord', icon: '🦇', desc: '+7.5% Lifesteal and +1,000 Max HP per rank.', effects: { lifeSteal: 0.075, bonusHp: 1000 } },
    { name: 'Oblivion Strike', icon: '🖤', desc: '+210% Critical Damage and +96 Attack Damage per rank.', effects: { critDmgBonus: 2.10, bonusDmg: 96 } }
  ]},
  { nodes: [
    { name: 'Abyssal Decimation', icon: '🌌', desc: '+145 Attack Damage and +36% Critical Chance per rank.', effects: { bonusDmg: 145, critChanceBonus: 0.36 } },
    { name: 'Fountain of Blood', icon: '⛲', desc: '+8.0% Lifesteal and +1,200 Max HP per rank.', effects: { lifeSteal: 0.08, bonusHp: 1200 } },
    { name: 'World End Severance', icon: '💥', desc: '+240% Critical Damage and +110 Attack Damage per rank.', effects: { critDmgBonus: 2.40, bonusDmg: 110 } }
  ]},
  { nodes: [
    { name: 'Warlord Godhead Ascendance', icon: '👑', desc: 'KEYSTONE: Absolute decimation. +200 Attack Damage, +45% Critical Chance, and +150% Critical Damage.', effects: { bonusDmg: 200, critChanceBonus: 0.45, critDmgBonus: 1.50 } },
    { name: 'Blood God Incarnation', icon: '🩸', desc: 'KEYSTONE: Unkillable vampire god. +8% Lifesteal, +2,500 Max HP, and +160 Attack Damage.', effects: { lifeSteal: 0.08, bonusHp: 2500, bonusDmg: 160 } },
    { name: 'Executioner Sovereign Apocalypse', icon: '🪓', desc: 'KEYSTONE: Infinite execution power. +350% Critical Damage, +180 Attack Damage, and +25% Critical Chance.', effects: { critDmgBonus: 3.50, bonusDmg: 180, critChanceBonus: 0.25 } }
  ]}
];

// ==========================================
// MAGE TALENTS (3 Branches x 45 = 135)
// ==========================================

// 1. Mage - Pyromancer (Fire & Burst)
const magePyroThemes = [
  { nodes: [
    { name: 'Infernal Spark', icon: '🔥', desc: '+15 Magic Damage and +10 Burn DoT per rank.', effects: { bonusDmg: 15 } },
    { name: 'Molten Core', icon: '☄️', desc: '+18 Magic Damage and +80 Max MP per rank.', effects: { bonusDmg: 18, bonusMp: 80 } },
    { name: 'Flame Haste', icon: '⚡', desc: '+10% Attack Speed and +0.25 Move Speed per rank.', effects: { bonusAttackSpeed: 0.10, bonusSpeed: 0.25 } }
  ]},
  { nodes: [
    { name: 'Blazing Touch', icon: '🔥', desc: '+22 Magic Damage and +15 Burn DoT per rank.', effects: { bonusDmg: 22 } },
    { name: 'Searing Mana', icon: '🌋', desc: '+25 Magic Damage and +120 Max MP per rank.', effects: { bonusDmg: 25, bonusMp: 120 } },
    { name: 'Pyroclastic Celerity', icon: '💨', desc: '+14% Attack Speed and +0.3 Move Speed per rank.', effects: { bonusAttackSpeed: 0.14, bonusSpeed: 0.3 } }
  ]},
  { nodes: [
    { name: 'Conflagration', icon: '💥', desc: '+30 Magic Damage and +20 Burn DoT per rank.', effects: { bonusDmg: 30 } },
    { name: 'Magma Chamber', icon: '♨️', desc: '+32 Magic Damage and +160 Max MP per rank.', effects: { bonusDmg: 32, bonusMp: 160 } },
    { name: 'Combustion Rhythm', icon: '🥁', desc: '+18% Attack Speed and +0.35 Move Speed per rank.', effects: { bonusAttackSpeed: 0.18, bonusSpeed: 0.35 } }
  ]},
  { nodes: [
    { name: 'Infernal Cataclysm', icon: '🌋', desc: '+38 Magic Damage and +25 Burn DoT per rank.', effects: { bonusDmg: 38 } },
    { name: 'Volcanic Reservoir', icon: '🩸', desc: '+40 Magic Damage and +200 Max MP per rank.', effects: { bonusDmg: 40, bonusMp: 200 } },
    { name: 'Wildfire Surge', icon: '🔥', desc: '+22% Attack Speed and +0.4 Move Speed per rank.', effects: { bonusAttackSpeed: 0.22, bonusSpeed: 0.4 } }
  ]},
  { nodes: [
    { name: 'Hellfire Ignition', icon: '🔥', desc: '+46 Magic Damage and +30 Burn DoT per rank.', effects: { bonusDmg: 46 } },
    { name: 'Brimstone Heart', icon: '🖤', desc: '+48 Magic Damage and +250 Max MP per rank.', effects: { bonusDmg: 48, bonusMp: 250 } },
    { name: 'Scorching Momentum', icon: '⚡', desc: '+26% Attack Speed and +0.45 Move Speed per rank.', effects: { bonusAttackSpeed: 0.26, bonusSpeed: 0.45 } }
  ]},
  { nodes: [
    { name: 'Superheated Plasma', icon: '💥', desc: '+55 Magic Damage and +35 Burn DoT per rank.', effects: { bonusDmg: 55 } },
    { name: 'Abyssal Firewell', icon: '🔮', desc: '+58 Magic Damage and +300 Max MP per rank.', effects: { bonusDmg: 58, bonusMp: 300 } },
    { name: 'Solar Agility', icon: '☀️', desc: '+30% Attack Speed and +0.5 Move Speed per rank.', effects: { bonusAttackSpeed: 0.30, bonusSpeed: 0.5 } }
  ]},
  { nodes: [
    { name: 'Napalm Torrent', icon: '🌊', desc: '+65 Magic Damage and +40 Burn DoT per rank.', effects: { bonusDmg: 65 } },
    { name: 'Pyromancer Soul', icon: '🦅', desc: '+68 Magic Damage and +360 Max MP per rank.', effects: { bonusDmg: 68, bonusMp: 360 } },
    { name: 'Thermal Velocity', icon: '💨', desc: '+34% Attack Speed and +0.55 Move Speed per rank.', effects: { bonusAttackSpeed: 0.34, bonusSpeed: 0.55 } }
  ]},
  { nodes: [
    { name: 'Thermonuclear Core', icon: '☢️', desc: '+76 Magic Damage and +46 Burn DoT per rank.', effects: { bonusDmg: 76 } },
    { name: 'Phoenix Ash Rebirth', icon: '🔥', desc: '+80 Magic Damage and +420 Max MP per rank.', effects: { bonusDmg: 80, bonusMp: 420 } },
    { name: 'Supernova Cadence', icon: '✨', desc: '+38% Attack Speed and +0.6 Move Speed per rank.', effects: { bonusAttackSpeed: 0.38, bonusSpeed: 0.6 } }
  ]},
  { nodes: [
    { name: 'Starfire Eruption', icon: '🌟', desc: '+88 Magic Damage and +52 Burn DoT per rank.', effects: { bonusDmg: 88 } },
    { name: 'Corona Mana Well', icon: '👑', desc: '+92 Magic Damage and +500 Max MP per rank.', effects: { bonusDmg: 92, bonusMp: 500 } },
    { name: 'Solar Wind Sprint', icon: '🚀', desc: '+42% Attack Speed and +0.65 Move Speed per rank.', effects: { bonusAttackSpeed: 0.42, bonusSpeed: 0.65 } }
  ]},
  { nodes: [
    { name: 'Apocalyptic Flare', icon: '💥', desc: '+100 Magic Damage and +60 Burn DoT per rank.', effects: { bonusDmg: 100 } },
    { name: 'Stellar Conduit', icon: '🌌', desc: '+105 Magic Damage and +600 Max MP per rank.', effects: { bonusDmg: 105, bonusMp: 600 } },
    { name: 'Plasma Jet Haste', icon: '⚡', desc: '+46% Attack Speed and +0.7 Move Speed per rank.', effects: { bonusAttackSpeed: 0.46, bonusSpeed: 0.7 } }
  ]},
  { nodes: [
    { name: 'Cosmic Incineration', icon: '☄️', desc: '+115 Magic Damage and +70 Burn DoT per rank.', effects: { bonusDmg: 115 } },
    { name: 'Solar Core Heart', icon: '☀️', desc: '+120 Magic Damage and +720 Max MP per rank.', effects: { bonusDmg: 120, bonusMp: 720 } },
    { name: 'Blazing Starstride', icon: '🌠', desc: '+50% Attack Speed and +0.75 Move Speed per rank.', effects: { bonusAttackSpeed: 0.50, bonusSpeed: 0.75 } }
  ]},
  { nodes: [
    { name: 'Armageddon Firestorm', icon: '🌋', desc: '+130 Magic Damage and +80 Burn DoT per rank.', effects: { bonusDmg: 130 } },
    { name: 'Font of Pure Flame', icon: '⛲', desc: '+135 Magic Damage and +850 Max MP per rank.', effects: { bonusDmg: 135, bonusMp: 850 } },
    { name: 'Light Speed Combustion', icon: '💫', desc: '+55% Attack Speed and +0.8 Move Speed per rank.', effects: { bonusAttackSpeed: 0.55, bonusSpeed: 0.8 } }
  ]},
  { nodes: [
    { name: 'Singularity Burn', icon: '🕳️', desc: '+148 Magic Damage and +95 Burn DoT per rank.', effects: { bonusDmg: 148 } },
    { name: 'Genesis Fire Font', icon: '✨', desc: '+152 Magic Damage and +1,000 Max MP per rank.', effects: { bonusDmg: 152, bonusMp: 1000 } },
    { name: 'Chrono Flame Dash', icon: '⏳', desc: '+60% Attack Speed and +0.85 Move Speed per rank.', effects: { bonusAttackSpeed: 0.60, bonusSpeed: 0.85 } }
  ]},
  { nodes: [
    { name: 'Omega Thermal Flare', icon: '💥', desc: '+168 Magic Damage and +110 Burn DoT per rank.', effects: { bonusDmg: 168 } },
    { name: 'Sun God Core', icon: '👑', desc: '+172 Magic Damage and +1,200 Max MP per rank.', effects: { bonusDmg: 172, bonusMp: 1200 } },
    { name: 'Infinite Solar Rush', icon: '🔥', desc: '+66% Attack Speed and +0.9 Move Speed per rank.', effects: { bonusAttackSpeed: 0.66, bonusSpeed: 0.9 } }
  ]},
  { nodes: [
    { name: 'Phoenix God Avatar', icon: '🦅', desc: 'KEYSTONE: Supreme elemental fire sovereign. +240 Magic Damage, +150 Burn Intensity, and +50% Attack Speed.', effects: { bonusDmg: 240, bonusAttackSpeed: 0.50 } },
    { name: 'Solar Supernova Sovereign', icon: '☀️', desc: 'KEYSTONE: Infinite cosmic flame well. +180 Magic Damage, +2,200 Max MP, and +60% Attack Speed.', effects: { bonusDmg: 180, bonusMp: 2200, bonusAttackSpeed: 0.60 } },
    { name: 'Genesis Fire Godhead', icon: '🔥', desc: 'KEYSTONE: Blinding thermonuclear destruction. +300 Magic Damage, +25% Critical Chance, and +80% Critical Damage.', effects: { bonusDmg: 300, critChanceBonus: 0.25, critDmgBonus: 0.80 } }
  ]}
];

// 2. Mage - Cryomancer (Ice & Defense)
const mageCryoThemes = [
  { nodes: [
    { name: 'Frost Shroud', icon: '❄️', desc: '+14 Defense and +70 Max MP per rank.', effects: { bonusDef: 14, bonusMp: 70 } },
    { name: 'Glacial Armor', icon: '🧊', desc: '+16 Defense and +60 Max HP per rank.', effects: { bonusDef: 16, bonusHp: 60 } },
    { name: 'Chilled Touch', icon: '🌨️', desc: '+14 Magic Damage and +8% Critical Chance per rank.', effects: { bonusDmg: 14, critChanceBonus: 0.08 } }
  ]},
  { nodes: [
    { name: 'Permafrost Shield', icon: '🛡️', desc: '+20 Defense and +100 Max MP per rank.', effects: { bonusDef: 20, bonusMp: 100 } },
    { name: 'Rime Encasement', icon: '🧊', desc: '+22 Defense and +90 Max HP per rank.', effects: { bonusDef: 22, bonusHp: 90 } },
    { name: 'Frostbite Strike', icon: '❄️', desc: '+20 Magic Damage and +10% Critical Chance per rank.', effects: { bonusDmg: 20, critChanceBonus: 0.10 } }
  ]},
  { nodes: [
    { name: 'Absolute Zero Ward', icon: '🌨️', desc: '+26 Defense and +140 Max MP per rank.', effects: { bonusDef: 26, bonusMp: 140 } },
    { name: 'Iceberg Bulk', icon: '🏔️', desc: '+28 Defense and +130 Max HP per rank.', effects: { bonusDef: 28, bonusHp: 130 } },
    { name: 'Shatter Shards', icon: '💎', desc: '+26 Magic Damage and +25% Critical Damage per rank.', effects: { bonusDmg: 26, critDmgBonus: 0.25 } }
  ]},
  { nodes: [
    { name: 'Crystal Aegis', icon: '💠', desc: '+34 Defense and +180 Max MP per rank.', effects: { bonusDef: 34, bonusMp: 180 } },
    { name: 'Glacial Constitution', icon: '🧊', desc: '+36 Defense and +170 Max HP per rank.', effects: { bonusDef: 36, bonusHp: 170 } },
    { name: 'Freezing Gale', icon: '🌬️', desc: '+32 Magic Damage and +12% Critical Chance per rank.', effects: { bonusDmg: 32, critChanceBonus: 0.12 } }
  ]},
  { nodes: [
    { name: 'Ice Fortress', icon: '🏰', desc: '+42 Defense and +220 Max MP per rank.', effects: { bonusDef: 42, bonusMp: 220 } },
    { name: 'Frozen Vitality', icon: '💙', desc: '+45 Defense and +220 Max HP per rank.', effects: { bonusDef: 45, bonusHp: 220 } },
    { name: 'Blizzard Razor', icon: '❄️', desc: '+40 Magic Damage and +35% Critical Damage per rank.', effects: { bonusDmg: 40, critDmgBonus: 0.35 } }
  ]},
  { nodes: [
    { name: 'Diamond Frost Shield', icon: '💎', desc: '+50 Defense and +270 Max MP per rank.', effects: { bonusDef: 50, bonusMp: 270 } },
    { name: 'Avalanche Carapace', icon: '🏔️', desc: '+52 Defense and +280 Max HP per rank.', effects: { bonusDef: 52, bonusHp: 280 } },
    { name: 'Shatter Precision', icon: '🎯', desc: '+48 Magic Damage and +15% Critical Chance per rank.', effects: { bonusDmg: 48, critChanceBonus: 0.15 } }
  ]},
  { nodes: [
    { name: 'Glacial Citadel', icon: '🏛️', desc: '+58 Defense and +320 Max MP per rank.', effects: { bonusDef: 58, bonusMp: 320 } },
    { name: 'Biting Frostbulk', icon: '🥶', desc: '+60 Defense and +340 Max HP per rank.', effects: { bonusDef: 60, bonusHp: 340 } },
    { name: 'Cryocrystal Flurry', icon: '✨', desc: '+56 Magic Damage and +45% Critical Damage per rank.', effects: { bonusDmg: 56, critDmgBonus: 0.45 } }
  ]},
  { nodes: [
    { name: 'Northwind Bastion', icon: '🌬️', desc: '+68 Defense and +380 Max MP per rank.', effects: { bonusDef: 68, bonusMp: 380 } },
    { name: 'Titan Glacial Heart', icon: '💙', desc: '+70 Defense and +400 Max HP per rank.', effects: { bonusDef: 70, bonusHp: 400 } },
    { name: 'Frostbite Execution', icon: '⚔️', desc: '+66 Magic Damage and +18% Critical Chance per rank.', effects: { bonusDmg: 66, critChanceBonus: 0.18 } }
  ]},
  { nodes: [
    { name: 'Subzero Barrier', icon: '🛡️', desc: '+78 Defense and +440 Max MP per rank.', effects: { bonusDef: 78, bonusMp: 440 } },
    { name: 'Ice Giant Bulk', icon: '🗿', desc: '+80 Defense and +480 Max HP per rank.', effects: { bonusDef: 80, bonusHp: 480 } },
    { name: 'Splintering Glaze', icon: '🧊', desc: '+76 Magic Damage and +55% Critical Damage per rank.', effects: { bonusDmg: 76, critDmgBonus: 0.55 } }
  ]},
  { nodes: [
    { name: 'Crystalline Wall', icon: '🧱', desc: '+88 Defense and +500 Max MP per rank.', effects: { bonusDef: 88, bonusMp: 500 } },
    { name: 'Glacial Leviathan', icon: '🐋', desc: '+92 Defense and +560 Max HP per rank.', effects: { bonusDef: 92, bonusHp: 560 } },
    { name: 'Deep Freeze Decimation', icon: '💥', desc: '+88 Magic Damage and +20% Critical Chance per rank.', effects: { bonusDmg: 88, critChanceBonus: 0.20 } }
  ]},
  { nodes: [
    { name: 'Arctic Fortress Shell', icon: '🏰', desc: '+100 Defense and +580 Max MP per rank.', effects: { bonusDef: 100, bonusMp: 580 } },
    { name: 'Permafrost Font', icon: '⛲', desc: '+105 Defense and +650 Max HP per rank.', effects: { bonusDef: 105, bonusHp: 650 } },
    { name: 'Hailstorm Burst', icon: '🌨️', desc: '+100 Magic Damage and +70% Critical Damage per rank.', effects: { bonusDmg: 100, critDmgBonus: 0.70 } }
  ]},
  { nodes: [
    { name: 'Boreal Bulwark', icon: '❄️', desc: '+114 Defense and +660 Max MP per rank.', effects: { bonusDef: 114, bonusMp: 660 } },
    { name: 'Eternal Ice Heart', icon: '💙', desc: '+120 Defense and +750 Max HP per rank.', effects: { bonusDef: 120, bonusHp: 750 } },
    { name: 'Glacial Cataclysm Spike', icon: '⚡', desc: '+114 Magic Damage and +25% Critical Chance per rank.', effects: { bonusDmg: 114, critChanceBonus: 0.25 } }
  ]},
  { nodes: [
    { name: 'Polar Sovereign Armor', icon: '👑', desc: '+130 Defense and +760 Max MP per rank.', effects: { bonusDef: 130, bonusMp: 760 } },
    { name: 'Immense Glacial Bulk', icon: '🏔️', desc: '+136 Defense and +880 Max HP per rank.', effects: { bonusDef: 136, bonusHp: 880 } },
    { name: 'Absolute Shatter', icon: '💎', desc: '+130 Magic Damage and +90% Critical Damage per rank.', effects: { bonusDmg: 130, critDmgBonus: 0.90 } }
  ]},
  { nodes: [
    { name: 'Void Ice Carapace', icon: '🌌', desc: '+148 Defense and +880 Max MP per rank.', effects: { bonusDef: 148, bonusMp: 880 } },
    { name: 'Frozen Throne Stature', icon: '🪑', desc: '+155 Defense and +1,050 Max HP per rank.', effects: { bonusDef: 155, bonusHp: 1050 } },
    { name: 'Supercooled Annihilation', icon: '💥', desc: '+148 Magic Damage and +30% Critical Chance per rank.', effects: { bonusDmg: 148, critChanceBonus: 0.30 } }
  ]},
  { nodes: [
    { name: 'Permafrost Sovereign Ascendance', icon: '🏔️', desc: 'KEYSTONE: King of the Frozen Throne. +220 Defense, +1,800 Max MP, and attackers are chilled.', effects: { bonusDef: 220, bonusMp: 1800 } },
    { name: 'Glacial Leviathan Godhead', icon: '🐋', desc: 'KEYSTONE: Colossal glacial health. +180 Defense, +2,200 Max HP, and +80 Magic Damage.', effects: { bonusDef: 180, bonusHp: 2200, bonusDmg: 80 } },
    { name: 'Absolute Zero Shatter God', icon: '💎', desc: 'KEYSTONE: Shatters freeze solid. +240 Magic Damage, +180% Critical Damage, and +35% Critical Chance.', effects: { bonusDmg: 240, critDmgBonus: 1.80, critChanceBonus: 0.35 } }
  ]}
];

// 3. Mage - Archmage (Void & Mana)
const mageArchThemes = [
  { nodes: [
    { name: 'Arcane Intellect', icon: '📖', desc: '+14 Magic Damage and +90 Max MP per rank.', effects: { bonusDmg: 14, bonusMp: 90 } },
    { name: 'Mana Wellspring', icon: '💧', desc: '+140 Max MP and +6 Attack Speed per rank.', effects: { bonusMp: 140, bonusAttackSpeed: 0.06 } },
    { name: 'Astral Flow', icon: '🌀', desc: '+0.2 Move Speed and +10% Attack Speed per rank.', effects: { bonusSpeed: 0.2, bonusAttackSpeed: 0.10 } }
  ]},
  { nodes: [
    { name: 'Deep Arcana', icon: '🔮', desc: '+20 Magic Damage and +130 Max MP per rank.', effects: { bonusDmg: 20, bonusMp: 130 } },
    { name: 'Font of Power', icon: '⛲', desc: '+200 Max MP and +8% Attack Speed per rank.', effects: { bonusMp: 200, bonusAttackSpeed: 0.08 } },
    { name: 'Blink Cadence', icon: '⚡', desc: '+0.25 Move Speed and +14% Attack Speed per rank.', effects: { bonusSpeed: 0.25, bonusAttackSpeed: 0.14 } }
  ]},
  { nodes: [
    { name: 'Astral Overload', icon: '✨', desc: '+26 Magic Damage and +180 Max MP per rank.', effects: { bonusDmg: 26, bonusMp: 180 } },
    { name: 'Chrono Surge', icon: '⏳', desc: '+270 Max MP and +10% Attack Speed per rank.', effects: { bonusMp: 270, bonusAttackSpeed: 0.10 } },
    { name: 'Warp Speed Steps', icon: '🚀', desc: '+0.3 Move Speed and +18% Attack Speed per rank.', effects: { bonusSpeed: 0.3, bonusAttackSpeed: 0.18 } }
  ]},
  { nodes: [
    { name: 'Singularity Force', icon: '🕳️', desc: '+34 Magic Damage and +230 Max MP per rank.', effects: { bonusDmg: 34, bonusMp: 230 } },
    { name: 'Infinite Font', icon: '💧', desc: '+350 Max MP and +12% Attack Speed per rank.', effects: { bonusMp: 350, bonusAttackSpeed: 0.12 } },
    { name: 'Phase Shift Haste', icon: '💨', desc: '+0.35 Move Speed and +22% Attack Speed per rank.', effects: { bonusSpeed: 0.35, bonusAttackSpeed: 0.22 } }
  ]},
  { nodes: [
    { name: 'Cosmic Burst', icon: '🌌', desc: '+42 Magic Damage and +290 Max MP per rank.', effects: { bonusDmg: 42, bonusMp: 290 } },
    { name: 'Arcane Reservoir', icon: '🏺', desc: '+440 Max MP and +15% Attack Speed per rank.', effects: { bonusMp: 440, bonusAttackSpeed: 0.15 } },
    { name: 'Dimensional Slip', icon: '💫', desc: '+0.4 Move Speed and +26% Attack Speed per rank.', effects: { bonusSpeed: 0.4, bonusAttackSpeed: 0.26 } }
  ]},
  { nodes: [
    { name: 'Event Horizon', icon: '⚫', desc: '+50 Magic Damage and +360 Max MP per rank.', effects: { bonusDmg: 50, bonusMp: 360 } },
    { name: 'Mana Geyser', icon: '⛲', desc: '+540 Max MP and +18% Attack Speed per rank.', effects: { bonusMp: 540, bonusAttackSpeed: 0.18 } },
    { name: 'Starstride Velocity', icon: '🌠', desc: '+0.45 Move Speed and +30% Attack Speed per rank.', effects: { bonusSpeed: 0.45, bonusAttackSpeed: 0.30 } }
  ]},
  { nodes: [
    { name: 'Void Lance Mastery', icon: '🗡️', desc: '+60 Magic Damage and +430 Max MP per rank.', effects: { bonusDmg: 60, bonusMp: 430 } },
    { name: 'Arcane Battery', icon: '🔋', desc: '+650 Max MP and +20% Attack Speed per rank.', effects: { bonusMp: 650, bonusAttackSpeed: 0.20 } },
    { name: 'Aetherial Drift', icon: '☁️', desc: '+0.5 Move Speed and +34% Attack Speed per rank.', effects: { bonusSpeed: 0.5, bonusAttackSpeed: 0.34 } }
  ]},
  { nodes: [
    { name: 'Gravitational Collapse', icon: '💥', desc: '+70 Magic Damage and +510 Max MP per rank.', effects: { bonusDmg: 70, bonusMp: 510 } },
    { name: 'Cosmic Sea Well', icon: '🌊', desc: '+780 Max MP and +22% Attack Speed per rank.', effects: { bonusMp: 780, bonusAttackSpeed: 0.22 } },
    { name: 'Teleportation Surge', icon: '⚡', desc: '+0.55 Move Speed and +38% Attack Speed per rank.', effects: { bonusSpeed: 0.55, bonusAttackSpeed: 0.38 } }
  ]},
  { nodes: [
    { name: 'Superluminal Mind', icon: '🧠', desc: '+82 Magic Damage and +600 Max MP per rank.', effects: { bonusDmg: 82, bonusMp: 600 } },
    { name: 'Universal Battery', icon: '🪐', desc: '+920 Max MP and +25% Attack Speed per rank.', effects: { bonusMp: 920, bonusAttackSpeed: 0.25 } },
    { name: 'Chrono Flurry Steps', icon: '⏳', desc: '+0.6 Move Speed and +42% Attack Speed per rank.', effects: { bonusSpeed: 0.6, bonusAttackSpeed: 0.42 } }
  ]},
  { nodes: [
    { name: 'Reality Tear', icon: '🔪', desc: '+95 Magic Damage and +700 Max MP per rank.', effects: { bonusDmg: 95, bonusMp: 700 } },
    { name: 'Font of Omniscience', icon: '👁️', desc: '+1,080 Max MP and +28% Attack Speed per rank.', effects: { bonusMp: 1080, bonusAttackSpeed: 0.28 } },
    { name: 'Blink Sovereign Pace', icon: '👑', desc: '+0.65 Move Speed and +46% Attack Speed per rank.', effects: { bonusSpeed: 0.65, bonusAttackSpeed: 0.46 } }
  ]},
  { nodes: [
    { name: 'Antimatter Ray Focus', icon: '💫', desc: '+110 Magic Damage and +820 Max MP per rank.', effects: { bonusDmg: 110, bonusMp: 820 } },
    { name: 'Tesseract Core', icon: '🧊', desc: '+1,250 Max MP and +32% Attack Speed per rank.', effects: { bonusMp: 1250, bonusAttackSpeed: 0.32 } },
    { name: 'Hyperspace Slide', icon: '🚀', desc: '+0.7 Move Speed and +50% Attack Speed per rank.', effects: { bonusSpeed: 0.7, bonusAttackSpeed: 0.50 } }
  ]},
  { nodes: [
    { name: 'Quasar Beam Pulse', icon: '🌟', desc: '+126 Magic Damage and +950 Max MP per rank.', effects: { bonusDmg: 126, bonusMp: 950 } },
    { name: 'Primordial Void Reservoir', icon: '🖤', desc: '+1,450 Max MP and +36% Attack Speed per rank.', effects: { bonusMp: 1450, bonusAttackSpeed: 0.36 } },
    { name: 'Light Speed Warp', icon: '⚡', desc: '+0.75 Move Speed and +55% Attack Speed per rank.', effects: { bonusSpeed: 0.75, bonusAttackSpeed: 0.55 } }
  ]},
  { nodes: [
    { name: 'Dark Energy Cataclysm', icon: '💥', desc: '+144 Magic Damage and +1,100 Max MP per rank.', effects: { bonusDmg: 144, bonusMp: 1100 } },
    { name: 'Infinite Arcane Well', icon: '⛲', desc: '+1,680 Max MP and +40% Attack Speed per rank.', effects: { bonusMp: 1680, bonusAttackSpeed: 0.40 } },
    { name: 'Quantum Leap Swiftness', icon: '👟', desc: '+0.8 Move Speed and +60% Attack Speed per rank.', effects: { bonusSpeed: 0.8, bonusAttackSpeed: 0.60 } }
  ]},
  { nodes: [
    { name: 'Genesis Cosmic Lance', icon: '✨', desc: '+165 Magic Damage and +1,300 Max MP per rank.', effects: { bonusDmg: 165, bonusMp: 1300 } },
    { name: 'God of Magic Core', icon: '👑', desc: '+1,950 Max MP and +45% Attack Speed per rank.', effects: { bonusMp: 1950, bonusAttackSpeed: 0.45 } },
    { name: 'Spacetime Master Sprint', icon: '🌌', desc: '+0.9 Move Speed and +66% Attack Speed per rank.', effects: { bonusSpeed: 0.9, bonusAttackSpeed: 0.66 } }
  ]},
  { nodes: [
    { name: 'Cosmic Singularity Sovereign', icon: '🌌', desc: 'KEYSTONE: Master of the multiverse. +260 Magic Damage, +2,500 Max MP, and +60% Attack Speed.', effects: { bonusDmg: 260, bonusMp: 2500, bonusAttackSpeed: 0.60 } },
    { name: 'Infinite Mana Sovereign', icon: '⛲', desc: 'KEYSTONE: Bottomless arcane wellspring. +3,500 Max MP, +180 Magic Damage, and +1.0 Move Speed.', effects: { bonusMp: 3500, bonusDmg: 180, bonusSpeed: 1.0 } },
    { name: 'Chrono God Teleportation', icon: '⏳', desc: 'KEYSTONE: Instant godspeed casting. +80% Attack Speed, +1.2 Move Speed, and +200 Magic Damage.', effects: { bonusAttackSpeed: 0.80, bonusSpeed: 1.2, bonusDmg: 200 } }
  ]}
];

// ==========================================
// ROGUE TALENTS (3 Branches x 45 = 135)
// ==========================================

// 1. Rogue - Shadow Assassin (Crits)
const rogueShadowThemes = [
  { nodes: [
    { name: 'Deadly Precision', icon: '🎯', desc: '+15 Attack Damage and +10% Critical Chance per rank.', effects: { bonusDmg: 15, critChanceBonus: 0.10 } },
    { name: 'Lethal Ambush', icon: '🗡️', desc: '+30% Critical Strike Damage and +10 Attack Damage per rank.', effects: { critDmgBonus: 0.30, bonusDmg: 10 } },
    { name: 'Shadow Velocity', icon: '💨', desc: '+0.3 Move Speed and +10% Attack Speed per rank.', effects: { bonusSpeed: 0.3, bonusAttackSpeed: 0.10 } }
  ]},
  { nodes: [
    { name: 'Pressure Points', icon: '🎯', desc: '+20 Attack Damage and +12% Critical Chance per rank.', effects: { bonusDmg: 20, critChanceBonus: 0.12 } },
    { name: 'Throat Slitter', icon: '🔪', desc: '+40% Critical Strike Damage and +15 Attack Damage per rank.', effects: { critDmgBonus: 0.40, bonusDmg: 15 } },
    { name: 'Silent Stalker', icon: '👤', desc: '+0.35 Move Speed and +14% Attack Speed per rank.', effects: { bonusSpeed: 0.35, bonusAttackSpeed: 0.14 } }
  ]},
  { nodes: [
    { name: 'Assassins Instinct', icon: '🖤', desc: '+26 Attack Damage and +14% Critical Chance per rank.', effects: { bonusDmg: 26, critChanceBonus: 0.14 } },
    { name: 'Sever Spine', icon: '🦴', desc: '+50% Critical Strike Damage and +20 Attack Damage per rank.', effects: { critDmgBonus: 0.50, bonusDmg: 20 } },
    { name: 'Vanish Momentum', icon: '💨', desc: '+0.4 Move Speed and +18% Attack Speed per rank.', effects: { bonusSpeed: 0.4, bonusAttackSpeed: 0.18 } }
  ]},
  { nodes: [
    { name: 'Heart Seeker', icon: '❤️', desc: '+32 Attack Damage and +16% Critical Chance per rank.', effects: { bonusDmg: 32, critChanceBonus: 0.16 } },
    { name: 'Brutal Guillotine', icon: '🪓', desc: '+65% Critical Strike Damage and +25 Attack Damage per rank.', effects: { critDmgBonus: 0.65, bonusDmg: 25 } },
    { name: 'Ghost Step', icon: '👻', desc: '+0.45 Move Speed and +22% Attack Speed per rank.', effects: { bonusSpeed: 0.45, bonusAttackSpeed: 0.22 } }
  ]},
  { nodes: [
    { name: 'Shadow Piercer', icon: '🗡️', desc: '+40 Attack Damage and +18% Critical Chance per rank.', effects: { bonusDmg: 40, critChanceBonus: 0.18 } },
    { name: 'Eviscerate Mastery', icon: '💥', desc: '+80% Critical Strike Damage and +30 Attack Damage per rank.', effects: { critDmgBonus: 0.80, bonusDmg: 30 } },
    { name: 'Phantom Haste', icon: '⚡', desc: '+0.5 Move Speed and +26% Attack Speed per rank.', effects: { bonusSpeed: 0.5, bonusAttackSpeed: 0.26 } }
  ]},
  { nodes: [
    { name: 'Mortal Focus', icon: '🎯', desc: '+48 Attack Damage and +20% Critical Chance per rank.', effects: { bonusDmg: 48, critChanceBonus: 0.20 } },
    { name: 'Death Blossom Edge', icon: '🌸', desc: '+95% Critical Strike Damage and +36 Attack Damage per rank.', effects: { critDmgBonus: 0.95, bonusDmg: 36 } },
    { name: 'Specter Drift', icon: '💨', desc: '+0.55 Move Speed and +30% Attack Speed per rank.', effects: { bonusSpeed: 0.55, bonusAttackSpeed: 0.30 } }
  ]},
  { nodes: [
    { name: 'Shadowstep Strike', icon: '👤', desc: '+56 Attack Damage and +22% Critical Chance per rank.', effects: { bonusDmg: 56, critChanceBonus: 0.22 } },
    { name: 'Executioner Blade', icon: '🔪', desc: '+115% Critical Strike Damage and +42 Attack Damage per rank.', effects: { critDmgBonus: 1.15, bonusDmg: 42 } },
    { name: 'Shade Velocity', icon: '🖤', desc: '+0.6 Move Speed and +34% Attack Speed per rank.', effects: { bonusSpeed: 0.6, bonusAttackSpeed: 0.34 } }
  ]},
  { nodes: [
    { name: 'Nightstalker Keen', icon: '🌙', desc: '+66 Attack Damage and +24% Critical Chance per rank.', effects: { bonusDmg: 66, critChanceBonus: 0.24 } },
    { name: 'Vital Laceration', icon: '🩸', desc: '+135% Critical Strike Damage and +50 Attack Damage per rank.', effects: { critDmgBonus: 1.35, bonusDmg: 50 } },
    { name: 'Umbral Sprint', icon: '⚡', desc: '+0.65 Move Speed and +38% Attack Speed per rank.', effects: { bonusSpeed: 0.65, bonusAttackSpeed: 0.38 } }
  ]},
  { nodes: [
    { name: 'Dark Void Precision', icon: '🌌', desc: '+76 Magic Damage and +26% Critical Chance per rank.', effects: { bonusDmg: 76, critChanceBonus: 0.26 } },
    { name: 'Omnislash Flurry', icon: '⚔️', desc: '+160% Critical Strike Damage and +58 Attack Damage per rank.', effects: { critDmgBonus: 1.60, bonusDmg: 58 } },
    { name: 'Blink Reflexes', icon: '💨', desc: '+0.7 Move Speed and +42% Attack Speed per rank.', effects: { bonusSpeed: 0.7, bonusAttackSpeed: 0.42 } }
  ]},
  { nodes: [
    { name: 'Ghostblade Strike', icon: '👻', desc: '+88 Attack Damage and +28% Critical Chance per rank.', effects: { bonusDmg: 88, critChanceBonus: 0.28 } },
    { name: 'Annihilating Daggers', icon: '🗡️', desc: '+185% Critical Strike Damage and +66 Attack Damage per rank.', effects: { critDmgBonus: 1.85, bonusDmg: 66 } },
    { name: 'Shadow Realm Pace', icon: '🌑', desc: '+0.75 Move Speed and +46% Attack Speed per rank.', effects: { bonusSpeed: 0.75, bonusAttackSpeed: 0.46 } }
  ]},
  { nodes: [
    { name: 'Soul Reaver Aim', icon: '💀', desc: '+100 Attack Damage and +30% Critical Chance per rank.', effects: { bonusDmg: 100, critChanceBonus: 0.30 } },
    { name: 'Fatal Severance', icon: '💥', desc: '+215% Critical Strike Damage and +76 Attack Damage per rank.', effects: { critDmgBonus: 2.15, bonusDmg: 76 } },
    { name: 'Hyper Agile Phantom', icon: '🚀', desc: '+0.8 Move Speed and +50% Attack Speed per rank.', effects: { bonusSpeed: 0.8, bonusAttackSpeed: 0.50 } }
  ]},
  { nodes: [
    { name: 'Eclipse Criticals', icon: '🌒', desc: '+115 Attack Damage and +32% Critical Chance per rank.', effects: { bonusDmg: 115, critChanceBonus: 0.32 } },
    { name: 'Cataclysmic Ambush', icon: '🪓', desc: '+250% Critical Strike Damage and +88 Attack Damage per rank.', effects: { critDmgBonus: 2.50, bonusDmg: 88 } },
    { name: 'Supersonic Shadow', icon: '⚡', desc: '+0.85 Move Speed and +55% Attack Speed per rank.', effects: { bonusSpeed: 0.85, bonusAttackSpeed: 0.55 } }
  ]},
  { nodes: [
    { name: 'Abyssal Dagger Focus', icon: '🖤', desc: '+132 Attack Damage and +34% Critical Chance per rank.', effects: { bonusDmg: 132, critChanceBonus: 0.34 } },
    { name: 'Extinction Decapitate', icon: '🔥', desc: '+290% Critical Strike Damage and +100 Attack Damage per rank.', effects: { critDmgBonus: 2.90, bonusDmg: 100 } },
    { name: 'Light Speed Vanish', icon: '💨', desc: '+0.9 Move Speed and +60% Attack Speed per rank.', effects: { bonusSpeed: 0.9, bonusAttackSpeed: 0.60 } }
  ]},
  { nodes: [
    { name: 'Grand Assassin Mark', icon: '🎯', desc: '+150 Attack Damage and +36% Critical Chance per rank.', effects: { bonusDmg: 150, critChanceBonus: 0.36 } },
    { name: 'Infinite Lethality', icon: '✨', desc: '+330% Critical Strike Damage and +115 Attack Damage per rank.', effects: { critDmgBonus: 3.30, bonusDmg: 115 } },
    { name: 'Chrono Stalker Rush', icon: '⏳', desc: '+1.0 Move Speed and +66% Attack Speed per rank.', effects: { bonusSpeed: 1.0, bonusAttackSpeed: 0.66 } }
  ]},
  { nodes: [
    { name: 'Master of Shadows Godhead', icon: '🖤', desc: 'KEYSTONE: Ghost of the abyss. +220 Attack Damage, +45% Critical Chance, and +200% Critical Damage.', effects: { bonusDmg: 220, critChanceBonus: 0.45, critDmgBonus: 2.00 } },
    { name: 'Apex Lethality Sovereign', icon: '👑', desc: 'KEYSTONE: Infinite assassination. +450% Critical Damage, +180 Attack Damage, and +25% Critical Chance.', effects: { critDmgBonus: 4.50, bonusDmg: 180, critChanceBonus: 0.25 } },
    { name: 'Phantom Ghost Assassin', icon: '👻', desc: 'KEYSTONE: Untouchable specter. +85% Attack Speed, +1.2 Move Speed, and +190 Attack Damage.', effects: { bonusAttackSpeed: 0.85, bonusSpeed: 1.2, bonusDmg: 190 } }
  ]}
];

// 2. Rogue - Venomous Saboteur (Poison)
const roguePoisonThemes = [
  { nodes: [
    { name: 'Toxic Potency', icon: '🧪', desc: '+14 Attack Damage and +10 Poison Damage/s per rank.', effects: { bonusDmg: 14 } },
    { name: 'Caustic Coating', icon: '🟢', desc: '+18 Attack Damage and +60 Max HP per rank.', effects: { bonusDmg: 18, bonusHp: 60 } },
    { name: 'Barbed Dart', icon: '🎯', desc: '+8% Critical Chance and +10 Attack Damage per rank.', effects: { critChanceBonus: 0.08, bonusDmg: 10 } }
  ]},
  { nodes: [
    { name: 'Venomous Daggers', icon: '🔪', desc: '+20 Attack Damage and +16 Poison Damage/s per rank.', effects: { bonusDmg: 20 } },
    { name: 'Acidic Mist', icon: '🌫️', desc: '+24 Attack Damage and +90 Max HP per rank.', effects: { bonusDmg: 24, bonusHp: 90 } },
    { name: 'Spiked Trap', icon: '⛓️', desc: '+10% Critical Chance and +14 Attack Damage per rank.', effects: { critChanceBonus: 0.10, bonusDmg: 14 } }
  ]},
  { nodes: [
    { name: 'Noxious Vapor', icon: '☠️', desc: '+26 Magic Damage and +22 Poison Damage/s per rank.', effects: { bonusDmg: 26 } },
    { name: 'Corrosive Slime', icon: '🧪', desc: '+30 Attack Damage and +130 Max HP per rank.', effects: { bonusDmg: 30, bonusHp: 130 } },
    { name: 'Vile Barb Injection', icon: '💉', desc: '+12% Critical Chance and +18 Attack Damage per rank.', effects: { critChanceBonus: 0.12, bonusDmg: 18 } }
  ]},
  { nodes: [
    { name: 'Virulent Bloom', icon: '🌺', desc: '+34 Attack Damage and +30 Poison Damage/s per rank.', effects: { bonusDmg: 34 } },
    { name: 'Neurotoxin Infusion', icon: '🧠', desc: '+38 Attack Damage and +170 Max HP per rank.', effects: { bonusDmg: 38, bonusHp: 170 } },
    { name: 'Toxic Caltrops', icon: '🌵', desc: '+14% Critical Chance and +22 Attack Damage per rank.', effects: { critChanceBonus: 0.14, bonusDmg: 22 } }
  ]},
  { nodes: [
    { name: 'Blighted Steel', icon: '🗡️', desc: '+42 Attack Damage and +38 Poison Damage/s per rank.', effects: { bonusDmg: 42 } },
    { name: 'Acidic Exudate', icon: '🧪', desc: '+46 Attack Damage and +220 Max HP per rank.', effects: { bonusDmg: 46, bonusHp: 220 } },
    { name: 'Poison Needle Flurry', icon: '🪡', desc: '+16% Critical Chance and +28 Attack Damage per rank.', effects: { critChanceBonus: 0.16, bonusDmg: 28 } }
  ]},
  { nodes: [
    { name: 'Hemotoxin Surge', icon: '🩸', desc: '+50 Attack Damage and +48 Poison Damage/s per rank.', effects: { bonusDmg: 50 } },
    { name: 'Biohazard Spore', icon: '☣️', desc: '+55 Attack Damage and +280 Max HP per rank.', effects: { bonusDmg: 55, bonusHp: 280 } },
    { name: 'Serrated Barb Shards', icon: '💥', desc: '+18% Critical Chance and +34 Attack Damage per rank.', effects: { critChanceBonus: 0.18, bonusDmg: 34 } }
  ]},
  { nodes: [
    { name: 'Deadly Contagion', icon: '🦠', desc: '+60 Attack Damage and +58 Poison Damage/s per rank.', effects: { bonusDmg: 60 } },
    { name: 'Corrosive Acid Rain', icon: '🌧️', desc: '+65 Attack Damage and +340 Max HP per rank.', effects: { bonusDmg: 65, bonusHp: 340 } },
    { name: 'Viper Strike', icon: '🐍', desc: '+20% Critical Chance and +40 Attack Damage per rank.', effects: { critChanceBonus: 0.20, bonusDmg: 40 } }
  ]},
  { nodes: [
    { name: 'Epidemic Catalyst', icon: '☣️', desc: '+70 Attack Damage and +70 Poison Damage/s per rank.', effects: { bonusDmg: 70 } },
    { name: 'Toxic Reservoir', icon: '🏺', desc: '+76 Attack Damage and +400 Max HP per rank.', effects: { bonusDmg: 76, bonusHp: 400 } },
    { name: 'Venom Needle Rain', icon: '🌧️', desc: '+22% Critical Chance and +48 Attack Damage per rank.', effects: { critChanceBonus: 0.22, bonusDmg: 48 } }
  ]},
  { nodes: [
    { name: 'Plague Bearer', icon: '🐀', desc: '+82 Attack Damage and +84 Poison Damage/s per rank.', effects: { bonusDmg: 82 } },
    { name: 'Putrefaction', icon: '💀', desc: '+88 Attack Damage and +480 Max HP per rank.', effects: { bonusDmg: 88, bonusHp: 480 } },
    { name: 'Cobra Fang Criticals', icon: '🐍', desc: '+24% Critical Chance and +56 Attack Damage per rank.', effects: { critChanceBonus: 0.24, bonusDmg: 56 } }
  ]},
  { nodes: [
    { name: 'Pandemic Spores', icon: '🍄', desc: '+95 Attack Damage and +98 Poison Damage/s per rank.', effects: { bonusDmg: 95 } },
    { name: 'Caustic Meltdown', icon: '🔥', desc: '+102 Attack Damage and +560 Max HP per rank.', effects: { bonusDmg: 102, bonusHp: 560 } },
    { name: 'Venomous Execution', icon: '🪓', desc: '+26% Critical Chance and +65 Attack Damage per rank.', effects: { critChanceBonus: 0.26, bonusDmg: 65 } }
  ]},
  { nodes: [
    { name: 'Necrotic Venom', icon: '🖤', desc: '+110 Attack Damage and +115 Poison Damage/s per rank.', effects: { bonusDmg: 110 } },
    { name: 'Blight Sovereign Bulk', icon: '👑', desc: '+118 Attack Damage and +650 Max HP per rank.', effects: { bonusDmg: 118, bonusHp: 650 } },
    { name: 'Scorpion Sting', icon: '🦂', desc: '+28% Critical Chance and +75 Attack Damage per rank.', effects: { critChanceBonus: 0.28, bonusDmg: 75 } }
  ]},
  { nodes: [
    { name: 'Bio-Decay Cloud', icon: '☁️', desc: '+126 Magic Damage and +135 Poison Damage/s per rank.', effects: { bonusDmg: 126 } },
    { name: 'Mutagenic Flesh', icon: '🧬', desc: '+135 Attack Damage and +750 Max HP per rank.', effects: { bonusDmg: 135, bonusHp: 750 } },
    { name: 'Rupture Neurotoxin', icon: '💉', desc: '+30% Critical Chance and +86 Attack Damage per rank.', effects: { critChanceBonus: 0.30, bonusDmg: 86 } }
  ]},
  { nodes: [
    { name: 'Abyssal Blight', icon: '🌌', desc: '+145 Attack Damage and +160 Poison Damage/s per rank.', effects: { bonusDmg: 145 } },
    { name: 'Acidic Sovereign Heart', icon: '💚', desc: '+155 Attack Damage and +880 Max HP per rank.', effects: { bonusDmg: 155, bonusHp: 880 } },
    { name: 'Toxin God Dart', icon: '⚡', desc: '+33% Critical Chance and +98 Attack Damage per rank.', effects: { critChanceBonus: 0.33, bonusDmg: 98 } }
  ]},
  { nodes: [
    { name: 'Cataclysmic Poison Wave', icon: '🌊', desc: '+165 Attack Damage and +190 Poison Damage/s per rank.', effects: { bonusDmg: 165 } },
    { name: 'Immortal Toxin Well', icon: '⛲', desc: '+175 Attack Damage and +1,050 Max HP per rank.', effects: { bonusDmg: 175, bonusHp: 1050 } },
    { name: 'Extinction Venom Strike', icon: '💥', desc: '+36% Critical Chance and +112 Attack Damage per rank.', effects: { critChanceBonus: 0.36, bonusDmg: 112 } }
  ]},
  { nodes: [
    { name: 'Epidemic God Sovereign', icon: '☣️', desc: 'KEYSTONE: Ruin of all organic life. +240 Attack Damage, +250 Poison Damage/s, and enemies explode on death.', effects: { bonusDmg: 240 } },
    { name: 'Biohazard Overlord', icon: '👑', desc: 'KEYSTONE: Unstoppable plague titan. +2,200 Max HP, +180 Attack Damage, and +150 Armor.', effects: { bonusHp: 2200, bonusDmg: 180, bonusDef: 150 } },
    { name: 'Basilisk King Fang', icon: '🐍', desc: 'KEYSTONE: Fatal venom criticals. +45% Critical Chance, +180% Critical Damage, and +200 Attack Damage.', effects: { critChanceBonus: 0.45, critDmgBonus: 1.80, bonusDmg: 200 } }
  ]}
];

// 3. Rogue - Windrunner Duelist (Speed & Swipe)
const rogueWindThemes = [
  { nodes: [
    { name: 'Fleet Footwork', icon: '👟', desc: '+0.35 Move Speed and +10 Defense per rank.', effects: { bonusSpeed: 0.35, bonusDef: 10 } },
    { name: 'Wind Flurry', icon: '🌪️', desc: '+14% Attack Speed and +10 Attack Damage per rank.', effects: { bonusAttackSpeed: 0.14, bonusDmg: 10 } },
    { name: 'Sweeping Daggers', icon: '⚔️', desc: '+20% Swipe Cleave and +8% Dodge Chance per rank.', effects: { bonusSwipe: 20, dodgeChance: 0.08 } }
  ]},
  { nodes: [
    { name: 'Zephyr Stride', icon: '🍃', desc: '+0.4 Move Speed and +15 Defense per rank.', effects: { bonusSpeed: 0.4, bonusDef: 15 } },
    { name: 'Twin Blade Tempo', icon: '🗡️', desc: '+18% Attack Speed and +14 Attack Damage per rank.', effects: { bonusAttackSpeed: 0.18, bonusDmg: 14 } },
    { name: 'Wide Slashes', icon: '🌊', desc: '+28% Swipe Cleave and +10% Dodge Chance per rank.', effects: { bonusSwipe: 28, dodgeChance: 0.10 } }
  ]},
  { nodes: [
    { name: 'Gale Velocity', icon: '💨', desc: '+0.45 Move Speed and +20 Defense per rank.', effects: { bonusSpeed: 0.45, bonusDef: 20 } },
    { name: 'Razor Whirlwind', icon: '🌀', desc: '+22% Attack Speed and +18 Attack Damage per rank.', effects: { bonusAttackSpeed: 0.22, bonusDmg: 18 } },
    { name: 'Evasive Acrobatics', icon: '🤸', desc: '+36% Swipe Cleave and +12% Dodge Chance per rank.', effects: { bonusSwipe: 36, dodgeChance: 0.12 } }
  ]},
  { nodes: [
    { name: 'Sonic Agility', icon: '⚡', desc: '+0.5 Move Speed and +26 Defense per rank.', effects: { bonusSpeed: 0.5, bonusDef: 26 } },
    { name: 'Dervish Dance', icon: '💃', desc: '+26% Attack Speed and +24 Attack Damage per rank.', effects: { bonusAttackSpeed: 0.26, bonusDmg: 24 } },
    { name: 'Mirage Reflexes', icon: '🪞', desc: '+45% Swipe Cleave and +14% Dodge Chance per rank.', effects: { bonusSwipe: 45, dodgeChance: 0.14 } }
  ]},
  { nodes: [
    { name: 'Tailwind Dash', icon: '🏃', desc: '+0.55 Move Speed and +32 Defense per rank.', effects: { bonusSpeed: 0.55, bonusDef: 32 } },
    { name: 'Storm Rapidity', icon: '🌩️', desc: '+30% Attack Speed and +30 Attack Damage per rank.', effects: { bonusAttackSpeed: 0.30, bonusDmg: 30 } },
    { name: 'Vortex Daggers', icon: '🌪️', desc: '+54% Swipe Cleave and +16% Dodge Chance per rank.', effects: { bonusSwipe: 54, dodgeChance: 0.16 } }
  ]},
  { nodes: [
    { name: 'Cyclone Steps', icon: '🌀', desc: '+0.6 Move Speed and +40 Defense per rank.', effects: { bonusSpeed: 0.6, bonusDef: 40 } },
    { name: 'Lightning Thrust', icon: '⚡', desc: '+34% Attack Speed and +36 Attack Damage per rank.', effects: { bonusAttackSpeed: 0.34, bonusDmg: 36 } },
    { name: 'Ghostly Evasion', icon: '👻', desc: '+64% Swipe Cleave and +18% Dodge Chance per rank.', effects: { bonusSwipe: 64, dodgeChance: 0.18 } }
  ]},
  { nodes: [
    { name: 'Tornado Rush', icon: '🌪️', desc: '+0.65 Move Speed and +48 Defense per rank.', effects: { bonusSpeed: 0.65, bonusDef: 48 } },
    { name: 'Bladestorm Mastery', icon: '⚔️', desc: '+38% Attack Speed and +44 Attack Damage per rank.', effects: { bonusAttackSpeed: 0.38, bonusDmg: 44 } },
    { name: 'Cleaving Specter', icon: '🖤', desc: '+74% Swipe Cleave and +20% Dodge Chance per rank.', effects: { bonusSwipe: 74, dodgeChance: 0.20 } }
  ]},
  { nodes: [
    { name: 'Soundbarrier Break', icon: '💥', desc: '+0.7 Move Speed and +56 Defense per rank.', effects: { bonusSpeed: 0.7, bonusDef: 56 } },
    { name: 'Furious Rapidity', icon: '🔥', desc: '+42% Attack Speed and +52 Attack Damage per rank.', effects: { bonusAttackSpeed: 0.42, bonusDmg: 52 } },
    { name: 'Phantom Parry', icon: '🎭', desc: '+85% Swipe Cleave and +22% Dodge Chance per rank.', effects: { bonusSwipe: 85, dodgeChance: 0.22 } }
  ]},
  { nodes: [
    { name: 'Hypersonic Glide', icon: '🚀', desc: '+0.75 Move Speed and +65 Defense per rank.', effects: { bonusSpeed: 0.75, bonusDef: 65 } },
    { name: 'Maelstrom Flurry', icon: '🌊', desc: '+46% Attack Speed and +60 Attack Damage per rank.', effects: { bonusAttackSpeed: 0.46, bonusDmg: 60 } },
    { name: 'Untouchable Mirage', icon: '✨', desc: '+96% Swipe Cleave and +24% Dodge Chance per rank.', effects: { bonusSwipe: 96, dodgeChance: 0.24 } }
  ]},
  { nodes: [
    { name: 'Warp Speed Stalker', icon: '🛸', desc: '+0.8 Move Speed and +75 Defense per rank.', effects: { bonusSpeed: 0.8, bonusDef: 75 } },
    { name: 'Mach Velocity Strike', icon: '⚡', desc: '+50% Attack Speed and +70 Attack Damage per rank.', effects: { bonusAttackSpeed: 0.50, bonusDmg: 70 } },
    { name: 'Slicing Typhoon', icon: '🌪️', desc: '+110% Swipe Cleave and +26% Dodge Chance per rank.', effects: { bonusSwipe: 110, dodgeChance: 0.26 } }
  ]},
  { nodes: [
    { name: 'Light Speed Steps', icon: '🌠', desc: '+0.85 Move Speed and +85 Defense per rank.', effects: { bonusSpeed: 0.85, bonusDef: 85 } },
    { name: 'Infinite Dagger Storm', icon: '🗡️', desc: '+55% Attack Speed and +80 Attack Damage per rank.', effects: { bonusAttackSpeed: 0.55, bonusDmg: 80 } },
    { name: 'Vanish In Plain Sight', icon: '🌫️', desc: '+125% Swipe Cleave and +28% Dodge Chance per rank.', effects: { bonusSwipe: 125, dodgeChance: 0.28 } }
  ]},
  { nodes: [
    { name: 'Blink Strider', icon: '💫', desc: '+0.9 Move Speed and +98 Defense per rank.', effects: { bonusSpeed: 0.9, bonusDef: 98 } },
    { name: 'Supersonic Tempest', icon: '🌩️', desc: '+60% Attack Speed and +92 Attack Damage per rank.', effects: { bonusAttackSpeed: 0.60, bonusDmg: 92 } },
    { name: 'Horizon Sever', icon: '🌅', desc: '+140% Swipe Cleave and +30% Dodge Chance per rank.', effects: { bonusSwipe: 140, dodgeChance: 0.30 } }
  ]},
  { nodes: [
    { name: 'Cosmic Wind Sprint', icon: '🌌', desc: '+0.95 Move Speed and +112 Defense per rank.', effects: { bonusSpeed: 0.95, bonusDef: 112 } },
    { name: 'Relativistic Strike', icon: '🪐', desc: '+66% Attack Speed and +105 Attack Damage per rank.', effects: { bonusAttackSpeed: 0.66, bonusDmg: 105 } },
    { name: 'Spacetime Cleave', icon: '⏳', desc: '+160% Swipe Cleave and +33% Dodge Chance per rank.', effects: { bonusSwipe: 160, dodgeChance: 0.33 } }
  ]},
  { nodes: [
    { name: 'Omnipresent Dash', icon: '👣', desc: '+1.0 Move Speed and +128 Defense per rank.', effects: { bonusSpeed: 1.0, bonusDef: 128 } },
    { name: 'Grand Duelist Mastery', icon: '👑', desc: '+72% Attack Speed and +120 Attack Damage per rank.', effects: { bonusAttackSpeed: 0.72, bonusDmg: 120 } },
    { name: 'Celestial Cleaver Form', icon: '✨', desc: '+180% Swipe Cleave and +36% Dodge Chance per rank.', effects: { bonusSwipe: 180, dodgeChance: 0.36 } }
  ]},
  { nodes: [
    { name: 'Phantom Duelist Sovereign', icon: '🎭', desc: 'KEYSTONE: Transcendent phantom avatar. +90% Attack Speed, +200% Swipe Cleave, and +45% Dodge Chance.', effects: { bonusAttackSpeed: 0.90, bonusSwipe: 200, dodgeChance: 0.45, bonusDmg: 160 } },
    { name: 'Wind God Incarnation', icon: '🌪️', desc: 'KEYSTONE: Untouchable wind sovereign. +1.5 Move Speed, +100% Attack Speed, and +170 Attack Damage.', effects: { bonusSpeed: 1.5, bonusAttackSpeed: 1.00, bonusDmg: 170 } },
    { name: 'Immortal Mirage Saint', icon: '✨', desc: 'KEYSTONE: Perfect evasion and decimation. +50% Dodge Chance, +220 Attack Damage, and +200 Defense.', effects: { dodgeChance: 0.50, bonusDmg: 220, bonusDef: 200 } }
  ]}
];

// Compile Complete Tree
const SKILL_TREES = {
  warrior: [
    ...buildBranchTalents('warrior', 'Juggernaut (Defense)', 'w_jug', warJugThemes),
    ...buildBranchTalents('warrior', 'Blademaster (Cleave & Speed)', 'w_blade', warBladeThemes),
    ...buildBranchTalents('warrior', 'Warlord (Crits & Burst)', 'w_warlord', warWarlordThemes)
  ],
  mage: [
    ...buildBranchTalents('mage', 'Pyromancer (Fire & Burst)', 'm_pyro', magePyroThemes),
    ...buildBranchTalents('mage', 'Cryomancer (Ice & Defense)', 'm_cryo', mageCryoThemes),
    ...buildBranchTalents('mage', 'Archmage (Void & Mana)', 'm_arch', mageArchThemes)
  ],
  rogue: [
    ...buildBranchTalents('rogue', 'Shadow Assassin (Crits)', 'r_shadow', rogueShadowThemes),
    ...buildBranchTalents('rogue', 'Venomous Saboteur (Poison)', 'r_poison', roguePoisonThemes),
    ...buildBranchTalents('rogue', 'Windrunner Duelist (Speed & Swipe)', 'r_wind', rogueWindThemes)
  ]
};

// ==========================================
// DAMAGE SCALING
// ==========================================
// The theme tables above were written with numbers that made a talent branch
// worth 8-20x the hero's own base damage. Offensive stats are scaled down here
// so a well-spent branch adds roughly +20% (early) to +75% (late) of base
// attack, and the other damage multipliers stay in the same range.
const TALENT_DAMAGE_SCALE = {
  bonusDmg: 0.04,          // attack: integer, at least +1 per rank
  thorns: 0.04,            // integer, at least +1 per rank
  bonusSwipe: 0.02,        // % cleave: integer, at least +1 per rank
  bonusAttackSpeed: 0.03,  // full branch ~ +50-80% attack speed
  critChanceBonus: 0.025,  // full branch ~ +25% crit chance
  critDmgBonus: 0.015      // full branch ~ +100% crit damage
};
const INT_STATS = new Set(['bonusDmg', 'thorns', 'bonusSwipe']);

// Stat text for regenerated descriptions: [label, value -> shown number]
const STAT_TEXT = {
  bonusDmg: ['Attack Damage', v => `+${v}`],
  bonusDef: ['Armor', v => `+${v.toLocaleString('en-US')}`],
  bonusHp: ['Max HP', v => `+${v.toLocaleString('en-US')}`],
  bonusMp: ['Max MP', v => `+${v.toLocaleString('en-US')}`],
  bonusSpeed: ['Move Speed', v => `+${v}`],
  bonusAttackSpeed: ['Attack Speed', v => `+${+(v * 100).toFixed(2)}%`],
  bonusSwipe: ['Swipe Cleave', v => `+${v}%`],
  critChanceBonus: ['Critical Chance', v => `+${+(v * 100).toFixed(2)}%`],
  critDmgBonus: ['Critical Damage', v => `+${+(v * 100).toFixed(2)}%`],
  thorns: ['Thorns', v => `+${v}`],
  dodgeChance: ['Dodge Chance', v => `+${+(v * 100).toFixed(2)}%`],
  lifeSteal: ['Lifesteal', v => `+${+(v * 100).toFixed(2)}%`],
  burnPower: ['Ignite Damage', v => `+${+(v * 100).toFixed(2)}%`],
  chillChance: ['Chill Chance', v => `+${+(v * 100).toFixed(2)}%`],
  shatterBonus: ['Damage vs Chilled', v => `+${+(v * 100).toFixed(2)}%`],
  echoChance: ['Void Echo Chance', v => `+${+(v * 100).toFixed(2)}%`],
  manaLeech: ['Mana Leech', v => `+${+(v * 100).toFixed(2)}%`],
  poisonPower: ['Venom Damage', v => `+${+(v * 100).toFixed(2)}%`]
};

function describeEffects(talent, classKey) {
  const parts = Object.entries(talent.effects).map(([k, v]) => {
    const [label, fmt] = STAT_TEXT[k] || [k, x => `+${x}`];
    return `${fmt(v)} ${k === 'bonusDmg' && classKey === 'mage' ? 'Magic Damage' : label}`;
  });
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  if (talent.isKeystone) {
    // keep the flavour line ("KEYSTONE: Immovable titan sovereign.") before the numbers
    const flavour = talent.desc.split(/\s\+\d/)[0].trim();
    return `${flavour} ${list}.`;
  }
  return `${list} per rank.`;
}

for (const [classKey, tree] of Object.entries(SKILL_TREES)) {
  for (const talent of tree) {
    let scaled = false;
    for (const [stat, factor] of Object.entries(TALENT_DAMAGE_SCALE)) {
      const v = talent.effects[stat];
      if (!v) continue;
      talent.effects[stat] = INT_STATS.has(stat) ? Math.max(1, Math.round(v * factor)) : +(v * factor).toFixed(4);
      scaled = true;
    }
    if (scaled) talent.desc = describeEffects(talent, classKey);
  }
}

// ==========================================
// BRANCH SIGNATURE MECHANICS
// ==========================================
// The elemental branches promise more than flat stats: one themed node per
// tier also grows a combat mechanic that the server runs on every hit
// (GameServer.applyTalentProcs). The first rank anywhere in that track
// unlocks the mechanic at its base strength; every rank adds to it.
//   burnPower    hits ignite: burn tick = Attack x power, every 0.6s for 3s
//   chillChance  chance per hit to chill (slow) the target for 2.5s
//   shatterBonus extra damage dealt to chilled targets
//   echoChance   chance per hit for a void echo dealing 60% of the hit again
//   manaLeech    share of damage dealt returned as MP
//   poisonPower  hits add a venom stack (max 5): tick = Attack x power x stacks, every 0.8s for 4s
const TALENT_PROCS = {
  base: { burnPower: 0.05, chillChance: 0.15, shatterBonus: 0.10, echoChance: 0.10, manaLeech: 0.03, poisonPower: 0.02 },
  burnSeconds: 3, chillSeconds: 2.5, echoShare: 0.6, poisonSeconds: 4, poisonMaxStacks: 5
};

// prefix -> themed node letter, per-rank [flat, per tier] growth, keystone grant, unlock text
const BRANCH_SIGNATURES = {
  m_pyro: {
    node: 'a', perRank: { burnPower: [0.003, 0.0003] }, keystone: { burnPower: 0.03 },
    unlock: 'Unlocks IGNITE: your hits set enemies ablaze for 5% of your Attack every 0.6s.'
  },
  m_cryo: {
    node: 'c', perRank: { chillChance: [0.004, 0.0002], shatterBonus: [0.004, 0.0004] }, keystone: { chillChance: 0.05, shatterBonus: 0.05 },
    unlock: 'Unlocks FROSTBITE: 15% chance per hit to chill (slow) the enemy; chilled enemies take +10% damage.'
  },
  m_arch: {
    node: 'a', perRank: { echoChance: [0.003, 0.0002], manaLeech: [0.001, 0.0001] }, keystone: { echoChance: 0.05, manaLeech: 0.01 },
    unlock: 'Unlocks VOID ECHO: 10% chance per hit to strike again for 60% damage; 3% of damage dealt returns as MP.'
  },
  r_poison: {
    node: 'a', perRank: { poisonPower: [0.001, 0.0001] }, keystone: { poisonPower: 0.01 },
    unlock: 'Unlocks VENOM: every hit adds a poison stack (max 5), each dealing 2% of your Attack every 0.8s.'
  }
};

for (const [classKey, tree] of Object.entries(SKILL_TREES)) {
  for (const talent of tree) {
    const prefix = talent.id.replace(/_t\d+_[abc]$/, '');
    const sig = BRANCH_SIGNATURES[prefix];
    if (!sig) continue;
    if (talent.isKeystone) {
      // keystones of the branch all carry the mechanic's capstone
      Object.assign(talent.effects, sig.keystone);
    } else if (talent.id.endsWith('_' + sig.node)) {
      for (const [stat, [flat, perTier]] of Object.entries(sig.perRank)) {
        talent.effects[stat] = +(flat + perTier * talent.tier).toFixed(4);
      }
    } else continue;
    talent.desc = describeEffects(talent, classKey);
    if (talent.tier === 1) talent.desc = `${sig.unlock} ${talent.desc}`;
  }
}

module.exports = SKILL_TREES;
// Not enumerable: the trees object is sent to clients and iterated by class
Object.defineProperty(module.exports, 'TALENT_PROCS', { value: TALENT_PROCS });
