// Item Database & Loot Tables for Slop Hero
const ITEMS = {
  // Consumables (Potions, Scrolls & Elixirs sold in Olaf's Shop)
  health_potion: {
    id: 'health_potion',
    name: 'Health Potion',
    type: 'consumable',
    icon: '🧪',
    rarity: 'common',
    buyPrice: 25,
    sellPrice: 12,
    healAmount: 60,
    desc: 'Restores 60 Health instantly.'
  },
  mana_potion: {
    id: 'mana_potion',
    name: 'Mana Potion',
    type: 'consumable',
    icon: '🔮',
    rarity: 'common',
    buyPrice: 30,
    sellPrice: 15,
    manaAmount: 50,
    desc: 'Restores 50 Mana instantly.'
  },
  greater_health_potion: {
    id: 'greater_health_potion',
    name: 'Greater Health Potion',
    type: 'consumable',
    icon: '🧪',
    rarity: 'rare',
    buyPrice: 70,
    sellPrice: 32,
    healAmount: 140,
    desc: 'Potent draught. Restores 140 Health instantly.'
  },
  greater_mana_potion: {
    id: 'greater_mana_potion',
    name: 'Greater Mana Potion',
    type: 'consumable',
    icon: '🔮',
    rarity: 'rare',
    buyPrice: 80,
    sellPrice: 38,
    manaAmount: 120,
    desc: 'Potent brew. Restores 120 Mana instantly.'
  },
  town_scroll: {
    id: 'town_scroll',
    name: 'Town Portal Scroll',
    type: 'consumable',
    icon: '📜',
    rarity: 'rare',
    buyPrice: 50,
    sellPrice: 25,
    desc: 'Instantly teleports you back to town safely.'
  },
  elixir_of_fury: {
    id: 'elixir_of_fury',
    name: 'Elixir of Fury',
    type: 'consumable',
    icon: '⚗️',
    rarity: 'rare',
    buyPrice: 95,
    sellPrice: 45,
    desc: 'Restores 40 Mana and grants ferocious battle vigor.'
  },
  elixir_of_iron: {
    id: 'elixir_of_iron',
    name: 'Elixir of Iron Skin',
    type: 'consumable',
    icon: '🛡️',
    rarity: 'rare',
    buyPrice: 90,
    sellPrice: 40,
    desc: 'Alchemical stone draught. Fortifies body against strikes.'
  },

  // Dungeon Relics & Treasures (Valuable loot to sell in shop for Gold)
  ancient_ruby: {
    id: 'ancient_ruby',
    name: 'Ancient Ruby',
    type: 'treasure',
    icon: '💎',
    rarity: 'rare',
    sellPrice: 65,
    desc: 'A sparkling blood-red gem mined from the abyss. High sell value.'
  },
  cursed_chalice: {
    id: 'cursed_chalice',
    name: 'Cursed Chalice',
    type: 'treasure',
    icon: '🏆',
    rarity: 'rare',
    sellPrice: 90,
    desc: 'An ornate silver goblet inlaid with ancient engravings.'
  },
  dragon_scale: {
    id: 'dragon_scale',
    name: 'Dragon Scale',
    type: 'treasure',
    icon: '🐉',
    rarity: 'epic',
    sellPrice: 160,
    desc: 'A hardened iridescent dragon scale prized by merchants.'
  },
  golden_idol: {
    id: 'golden_idol',
    name: 'Golden Idol',
    type: 'treasure',
    icon: '🗿',
    rarity: 'legendary',
    sellPrice: 300,
    desc: 'A priceless relic of a forgotten sun deity.'
  },
  shadow_essence: {
    id: 'shadow_essence',
    name: 'Shadow Essence',
    type: 'treasure',
    icon: '✨',
    rarity: 'rare',
    sellPrice: 75,
    desc: 'Concentrated dark energy captured from dungeon wraiths.'
  },

  // Weapons & Equipment (Drop from dungeon chests with randomized stats; NOT sold in shop!)
  iron_blade: {
    id: 'iron_blade',
    name: 'Knight Broadsword',
    type: 'equipment',
    slot: 'weapon',
    icon: '🗡️',
    rarity: 'common',
    sellPrice: 50,
    bonusDmg: 10,
    bonusSwipe: 30,
    desc: '+10 Attack Power, +30% Swipe (Cleave).'
  },
  shadow_daggers: {
    id: 'shadow_daggers',
    name: 'Obsidian Daggers',
    type: 'equipment',
    slot: 'weapon',
    icon: '🔪',
    rarity: 'rare',
    sellPrice: 95,
    bonusDmg: 16,
    bonusSpeed: 0.5,
    bonusAttackSpeed: 0.25,
    desc: '+16 Attack Power, +25% Attack Speed, +0.5 Speed.'
  },
  sweeping_claymore: {
    id: 'sweeping_claymore',
    name: 'Sweeping Claymore',
    type: 'equipment',
    slot: 'weapon',
    icon: '⚔️',
    rarity: 'rare',
    sellPrice: 110,
    bonusDmg: 18,
    bonusSwipe: 55,
    bonusAttackSpeed: 0.10,
    desc: '+18 Attack Power, +55% Sweeping Edge, +10% Attack Speed.'
  },
  wind_rapier: {
    id: 'wind_rapier',
    name: 'Zephyr Swiftblade',
    type: 'equipment',
    slot: 'weapon',
    icon: '🗡️',
    rarity: 'epic',
    sellPrice: 160,
    bonusDmg: 22,
    bonusAttackSpeed: 0.35,
    bonusSwipe: 25,
    desc: '+22 Attack Power, +35% Attack Speed, +25% Swipe.'
  },
  archmage_staff: {
    id: 'archmage_staff',
    name: 'Archmage Staff',
    type: 'equipment',
    slot: 'weapon',
    icon: '🪄',
    rarity: 'epic',
    sellPrice: 150,
    bonusDmg: 24,
    bonusMp: 40,
    bonusAttackSpeed: 0.10,
    desc: '+24 Attack Power, +40 Max Mana, +10% Attack Speed.'
  },
  excalibur: {
    id: 'excalibur',
    name: 'Radiant Holy Blade',
    type: 'equipment',
    slot: 'weapon',
    icon: '⚔️',
    rarity: 'legendary',
    sellPrice: 280,
    bonusDmg: 35,
    bonusHp: 50,
    bonusSwipe: 45,
    bonusAttackSpeed: 0.20,
    desc: '+35 Attack Power, +45% Swipe, +20% Attack Speed, +50 Max Health. Shines with divine light.'
  },

  // Armor Slot
  leather_tunic: {
    id: 'leather_tunic',
    name: 'Rogue Leather Armor',
    type: 'equipment',
    slot: 'armor',
    icon: '🥋',
    rarity: 'common',
    sellPrice: 45,
    bonusDef: 4,
    bonusSpeed: 0.4,
    desc: '+4 Defense, +0.4 Speed.'
  },
  plate_cuirass: {
    id: 'plate_cuirass',
    name: 'Gilded Plate Armor',
    type: 'equipment',
    slot: 'armor',
    icon: '🛡️',
    rarity: 'rare',
    sellPrice: 120,
    bonusHp: 60,
    bonusDef: 9,
    desc: '+60 Max Health, +9 Defense.'
  },
  mystic_robe: {
    id: 'mystic_robe',
    name: 'Ethereal Silk Robes',
    type: 'equipment',
    slot: 'armor',
    icon: '🥻',
    rarity: 'epic',
    sellPrice: 155,
    bonusHp: 40,
    bonusMp: 60,
    bonusDef: 6,
    desc: '+40 HP, +60 MP, +6 Defense.'
  },

  // Helmet Slot
  iron_helm: {
    id: 'iron_helm',
    name: 'Knight Great Helm',
    type: 'equipment',
    slot: 'helmet',
    icon: '🪖',
    rarity: 'common',
    sellPrice: 40,
    bonusDef: 5,
    bonusHp: 25,
    desc: '+5 Defense, +25 Max Health.'
  },
  shadow_hood: {
    id: 'shadow_hood',
    name: 'Assassin Shadow Cowl',
    type: 'equipment',
    slot: 'helmet',
    icon: '🥷',
    rarity: 'rare',
    sellPrice: 80,
    bonusDmg: 8,
    bonusSpeed: 0.3,
    desc: '+8 Attack Power, +0.3 Speed.'
  },
  archmage_cowl: {
    id: 'archmage_cowl',
    name: 'Crown of the Astral Sea',
    type: 'equipment',
    slot: 'helmet',
    icon: '👑',
    rarity: 'epic',
    sellPrice: 140,
    bonusDmg: 12,
    bonusMp: 45,
    desc: '+12 Attack Power, +45 Max Mana.'
  },

  // Boots Slot
  iron_greaves: {
    id: 'iron_greaves',
    name: 'Reinforced Greaves',
    type: 'equipment',
    slot: 'boots',
    icon: '👢',
    rarity: 'common',
    sellPrice: 35,
    bonusDef: 3,
    bonusSpeed: 0.3,
    desc: '+3 Defense, +0.3 Speed.'
  },
  winged_boots: {
    id: 'winged_boots',
    name: 'Hermes Winged Boots',
    type: 'equipment',
    slot: 'boots',
    icon: '🥾',
    rarity: 'epic',
    sellPrice: 110,
    bonusSpeed: 0.9,
    bonusDef: 4,
    desc: '+0.9 Movement Speed, +4 Defense.'
  },

  // Ring / Accessory Slot
  ring_of_power: {
    id: 'ring_of_power',
    name: 'Ring of the Abyss',
    type: 'equipment',
    slot: 'ring',
    icon: '💍',
    rarity: 'legendary',
    sellPrice: 200,
    bonusDmg: 15,
    bonusHp: 40,
    bonusMp: 30,
    desc: '+15 DMG, +40 HP, +30 MP. Pulsing dark power.'
  }
};

/**
 * Generates an item instance with rolled stats, quality prefix, and secondary affixes
 * Weapons & gear found in chests will have unique stats instead of generic fixed values!
 */
function generateRandomizedGear(baseId, floorLevel = 1, isBoss = false) {
  const base = ITEMS[baseId];
  if (!base || base.type !== 'equipment') return { ...(base || {}) };

  // 1. Roll Quality Tier / Prefix
  const qualityRoll = Math.random() + (isBoss ? 0.25 : 0) + (floorLevel - 1) * 0.08;
  let qualityName = '';
  let qualityMult = 1.0;
  let rarity = base.rarity || 'common';

  if (qualityRoll < 0.15 && !isBoss) {
    qualityName = 'Crude';
    qualityMult = 0.82;
    rarity = 'common';
  } else if (qualityRoll < 0.55) {
    qualityName = 'Tempered';
    qualityMult = 1.0 + Math.random() * 0.12;
    rarity = base.rarity === 'legendary' ? 'legendary' : (base.rarity === 'epic' ? 'epic' : 'common');
  } else if (qualityRoll < 0.85) {
    qualityName = 'Honed';
    qualityMult = 1.18 + Math.random() * 0.15;
    rarity = base.rarity === 'legendary' ? 'legendary' : 'rare';
  } else if (qualityRoll < 1.15) {
    qualityName = 'Masterwork';
    qualityMult = 1.35 + Math.random() * 0.18;
    rarity = base.rarity === 'legendary' ? 'legendary' : 'epic';
  } else {
    qualityName = 'Mythic';
    qualityMult = 1.55 + Math.random() * 0.25;
    rarity = 'legendary';
  }

  // 2. Roll Secondary Affix / Suffix (Chance: 50% normal, 85% boss)
  const hasSuffix = Math.random() < (isBoss ? 0.85 : 0.5);
  const suffixes = [
    { name: 'of the Titan', stat: 'bonusHp', min: 20, max: 50, icon: '❤️' },
    { name: 'of the Mystic', stat: 'bonusMp', min: 20, max: 45, icon: '💧' },
    { name: 'of Savagery', stat: 'bonusDmg', min: 3, max: 9, icon: '⚔️' },
    { name: 'of the Bulwark', stat: 'bonusDef', min: 2, max: 6, icon: '🛡️' },
    { name: 'of the Zephyr', stat: 'bonusSpeed', min: 0.2, max: 0.5, icon: '👟' },
    { name: 'of Sweeping Edge', stat: 'bonusSwipe', min: 15, max: 35, icon: '🌊' },
    { name: 'of the Gale', stat: 'bonusAttackSpeed', min: 0.12, max: 0.30, icon: '⚡' }
  ];
  let chosenSuffix = null;
  if (hasSuffix) {
    chosenSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  }

  // 3. Calculate randomized stats with floor scaling
  const item = {
    ...base,
    uniqueId: `${base.id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    custom: true,
    rarity,
    quality: qualityName
  };

  const floorBonus = (floorLevel - 1) * 3;
  if (base.bonusDmg) item.bonusDmg = Math.max(1, Math.round((base.bonusDmg + floorBonus) * qualityMult));
  if (base.bonusDef) item.bonusDef = Math.max(1, Math.round((base.bonusDef + Math.floor(floorBonus * 0.6)) * qualityMult));
  if (base.bonusHp) item.bonusHp = Math.max(5, Math.round((base.bonusHp + floorBonus * 12) * qualityMult));
  if (base.bonusMp) item.bonusMp = Math.max(5, Math.round((base.bonusMp + floorBonus * 8) * qualityMult));
  if (base.bonusSpeed) item.bonusSpeed = Number(((base.bonusSpeed || 0) * qualityMult).toFixed(2));
  if (base.bonusAttackSpeed) item.bonusAttackSpeed = Number(((base.bonusAttackSpeed || 0) * qualityMult).toFixed(2));
  if (base.bonusSwipe) item.bonusSwipe = Math.round((base.bonusSwipe + Math.floor(floorBonus * 0.8)) * qualityMult);

  if (chosenSuffix) {
    const suffixScale = 1 + (floorLevel - 1) * 0.22;
    const suffixVal = (chosenSuffix.stat === 'bonusSpeed' || chosenSuffix.stat === 'bonusAttackSpeed') ?
      Number(((chosenSuffix.min + Math.random() * (chosenSuffix.max - chosenSuffix.min)) * Math.min(2.0, suffixScale)).toFixed(2)) :
      Math.round((chosenSuffix.min + Math.random() * (chosenSuffix.max - chosenSuffix.min)) * suffixScale);

    item[chosenSuffix.stat] = (item[chosenSuffix.stat] || 0) + suffixVal;
    item.suffix = chosenSuffix.name;
  }

  // 4. Formulate rolled Name & Description
  const fullName = `${qualityName ? `${qualityName} ` : ''}${base.name}${chosenSuffix ? ` ${chosenSuffix.name}` : ''}`;
  item.name = fullName;

  const statList = [];
  if (item.bonusDmg) statList.push(`+${item.bonusDmg} DMG`);
  if (item.bonusDef) statList.push(`+${item.bonusDef} DEF`);
  if (item.bonusHp) statList.push(`+${item.bonusHp} HP`);
  if (item.bonusMp) statList.push(`+${item.bonusMp} MP`);
  if (item.bonusSpeed) statList.push(`+${item.bonusSpeed} SPD`);
  if (item.bonusAttackSpeed) statList.push(`+${Math.round(item.bonusAttackSpeed * 100)}% Atk Spd`);
  if (item.bonusSwipe) statList.push(`+${item.bonusSwipe}% Swipe`);

  item.desc = `${statList.join(', ')} (${qualityName || 'Standard'} Roll)`;
  item.sellPrice = Math.round((base.sellPrice || 30) * qualityMult * (chosenSuffix ? 1.3 : 1.0));
  delete item.buyPrice;

  return item;
}

module.exports = {
  ITEMS,
  generateRandomizedGear
};
