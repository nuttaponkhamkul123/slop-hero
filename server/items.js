// Item Database & Loot Tables for Aetheria Online
const ITEMS = {
  // Consumables
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

  // Dungeon Relics & Treasures (Great sell value)
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

  // Equipment / Gear (Gives bonus stats or sells for high gold)
  iron_blade: {
    id: 'iron_blade',
    name: 'Knight Broadsword',
    type: 'equipment',
    slot: 'weapon',
    icon: '🗡️',
    rarity: 'common',
    buyPrice: 120,
    sellPrice: 50,
    bonusDmg: 10,
    desc: '+10 Attack Power.'
  },
  shadow_daggers: {
    id: 'shadow_daggers',
    name: 'Obsidian Daggers',
    type: 'equipment',
    slot: 'weapon',
    icon: '🔪',
    rarity: 'rare',
    buyPrice: 220,
    sellPrice: 95,
    bonusDmg: 16,
    bonusSpeed: 0.5,
    desc: '+16 Attack Power, +0.5 Speed.'
  },
  archmage_staff: {
    id: 'archmage_staff',
    name: 'Archmage Staff',
    type: 'equipment',
    slot: 'weapon',
    icon: '🪄',
    rarity: 'epic',
    buyPrice: 350,
    sellPrice: 150,
    bonusDmg: 24,
    bonusMp: 40,
    desc: '+24 Attack Power, +40 Max Mana.'
  },
  excalibur: {
    id: 'excalibur',
    name: 'Radiant Holy Blade',
    type: 'equipment',
    slot: 'weapon',
    icon: '⚔️',
    rarity: 'legendary',
    buyPrice: 650,
    sellPrice: 280,
    bonusDmg: 35,
    bonusHp: 50,
    desc: '+35 Attack Power, +50 Max Health. Shines with divine light.'
  },

  // Armor Slot
  leather_tunic: {
    id: 'leather_tunic',
    name: 'Rogue Leather Armor',
    type: 'equipment',
    slot: 'armor',
    icon: '🥋',
    rarity: 'common',
    buyPrice: 110,
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
    buyPrice: 280,
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
    buyPrice: 360,
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
    buyPrice: 90,
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
    buyPrice: 180,
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
    buyPrice: 320,
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
    buyPrice: 85,
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
    buyPrice: 260,
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
    buyPrice: 450,
    sellPrice: 200,
    bonusDmg: 15,
    bonusHp: 40,
    bonusMp: 30,
    desc: '+15 DMG, +40 HP, +30 MP. Pulsing dark power.'
  }
};

module.exports = {
  ITEMS
};
