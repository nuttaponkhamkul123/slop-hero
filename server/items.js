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
  // Revive on the spot; reviveShare = share of max HP & MP restored
  revival_stone: {
    id: 'revival_stone',
    name: 'หินชุบชีวิต (Revival Stone)',
    type: 'consumable',
    icon: '💎',
    iconKey: 'gem',
    rarity: 'legendary',
    buyPrice: 5000,
    sellPrice: 1500,
    reviveShare: 0.3,
    desc: 'หินเวทมนตร์ศักดิ์สิทธิ์ ชุบชีวิตฟื้นคืนชีพ ณ จุดที่ตาย พร้อม 30% HP & MP โดยไม่ถูกส่งกลับเมืองและไม่สูญเสียความคืบหน้าดันเจี้ยน'
  },
  super_revival_stone: {
    id: 'super_revival_stone',
    name: 'หินชุบชีวิตระดับซุปเปอร์ (Super Revival Stone)',
    type: 'consumable',
    icon: '💎',
    iconKey: 'ruby',
    rarity: 'mythic',
    buyPrice: 50000,
    sellPrice: 15000,
    reviveShare: 1,
    desc: 'หินชุบชีวิตระดับสูงสุด ฟื้นคืนชีพ ณ จุดที่ตาย พร้อม 100% HP & MP เต็ม โดยไม่ถูกส่งกลับเมืองและไม่สูญเสียความคืบหน้าดันเจี้ยน'
  },

  // SP card material: exchanged and spent at the enchanter
  spirit_fragment: {
    id: 'spirit_fragment',
    name: 'Spirit Fragment',
    type: 'material',
    iconKey: 'fragment',
    rarity: 'epic',
    sellPrice: 150,
    desc: 'A shard of a hero\'s spirit. Valka the Enchanter trades SP cards and card enhancements for these.'
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
    element: 'neutral',
    desc: '+10 Attack Power, +30% Swipe (Cleave) [⚪ Neutral Element].'
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
    element: 'dark',
    desc: '+16 Attack Power, +25% Attack Speed, +0.5 Speed [💀 Dark Element].'
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
    element: 'earth',
    desc: '+18 Attack Power, +55% Sweeping Edge, +10% Attack Speed [🌿 Earth Element].'
  },
  inferno_blade: {
    id: 'inferno_blade',
    name: 'Inferno Edge',
    type: 'equipment',
    slot: 'weapon',
    icon: '🔥',
    rarity: 'rare',
    sellPrice: 120,
    bonusDmg: 20,
    bonusSwipe: 35,
    element: 'fire',
    desc: '+20 Attack Power, +35% Swipe [🔥 Fire Element]. Scorches foes with blistering heat.'
  },
  glacial_spire: {
    id: 'glacial_spire',
    name: 'Glacial Spire',
    type: 'equipment',
    slot: 'weapon',
    icon: '❄️',
    rarity: 'rare',
    sellPrice: 125,
    bonusDmg: 21,
    bonusMp: 35,
    element: 'ice',
    desc: '+21 Attack Power, +35 Max Mana [❄️ Ice Element]. Freezes monsters upon strike.'
  },
  storm_breaker: {
    id: 'storm_breaker',
    name: 'Storm Breaker',
    type: 'equipment',
    slot: 'weapon',
    icon: '⚡',
    rarity: 'epic',
    sellPrice: 175,
    bonusDmg: 26,
    bonusAttackSpeed: 0.22,
    bonusSwipe: 40,
    element: 'lightning',
    desc: '+26 Attack Power, +22% Attack Speed, +40% Swipe [⚡ Lightning Element].'
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
    element: 'lightning',
    desc: '+22 Attack Power, +35% Attack Speed, +25% Swipe [⚡ Wind/Lightning Element].'
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
    element: 'fire',
    desc: '+24 Attack Power, +40 Max Mana, +10% Attack Speed [🔥 Arcane Fire Element].'
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
    element: 'holy',
    desc: '+35 Attack Power, +45% Swipe, +20% Attack Speed, +50 Max Health [✨ Holy Element]. Annihilates dark creatures.'
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
    elementResist: { fire: 0.10 },
    desc: '+60 Max Health, +9 Defense, 🔥 Fire RES +10%.'
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
    elementResist: { dark: 0.12, holy: 0.12 },
    desc: '+40 HP, +60 MP, +6 Defense, 💀 Dark / ✨ Holy RES +12%.'
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
    elementResist: { dark: 0.15 },
    desc: '+15 DMG, +40 HP, +30 MP, 💀 Dark RES +15%. Pulsing dark power.'
  },

  // ---- Expanded equipment catalogue (drops only) ----
  woodsman_axe: {
    id: 'woodsman_axe',
    name: "Woodsman Axe",
    type: 'equipment',
    slot: 'weapon',
    iconKey: 'axe',
    rarity: 'common',
    sellPrice: 45,
    bonusDmg: 12,
    bonusSwipe: 40,
    element: 'earth',
    desc: "+12 Attack Power, +40% Swipe, [Earth Element]. A heavy logging axe that bites deep."
  },
  iron_morningstar: {
    id: 'iron_morningstar',
    name: "Iron Morningstar",
    type: 'equipment',
    slot: 'weapon',
    iconKey: 'mace',
    rarity: 'common',
    sellPrice: 50,
    bonusDmg: 14,
    bonusDef: 2,
    element: 'neutral',
    desc: "+14 Attack Power, +2 Defense, [Neutral Element]. Spiked iron that cracks armor."
  },
  hunter_spear: {
    id: 'hunter_spear',
    name: "Hunter's Spear",
    type: 'equipment',
    slot: 'weapon',
    iconKey: 'spear',
    rarity: 'common',
    sellPrice: 48,
    bonusDmg: 13,
    bonusAttackSpeed: 0.1,
    element: 'neutral',
    desc: "+13 Attack Power, +10% Attack Speed, [Neutral Element]. Long reach, quick jabs."
  },
  frostbite_katana: {
    id: 'frostbite_katana',
    name: "Frostbite Katana",
    type: 'equipment',
    slot: 'weapon',
    iconKey: 'katana',
    rarity: 'rare',
    sellPrice: 130,
    bonusDmg: 22,
    bonusAttackSpeed: 0.2,
    element: 'ice',
    desc: "+22 Attack Power, +20% Attack Speed, [Ice Element]. Its edge never thaws."
  },
  venom_kris: {
    id: 'venom_kris',
    name: "Venom Fang Kris",
    type: 'equipment',
    slot: 'weapon',
    iconKey: 'dagger',
    rarity: 'rare',
    sellPrice: 115,
    bonusDmg: 18,
    bonusAttackSpeed: 0.3,
    element: 'earth',
    desc: "+18 Attack Power, +30% Attack Speed, [Earth Element]. A wavy blade dripping with toxin."
  },
  voidcaller_wand: {
    id: 'voidcaller_wand',
    name: "Voidcaller Wand",
    type: 'equipment',
    slot: 'weapon',
    iconKey: 'wand',
    rarity: 'rare',
    sellPrice: 125,
    bonusDmg: 19,
    bonusMp: 50,
    element: 'dark',
    desc: "+19 Attack Power, +50 Max Mana, [Dark Element]. Whispers from the abyss guide each bolt."
  },
  ember_scythe: {
    id: 'ember_scythe',
    name: "Ember Reaper Scythe",
    type: 'equipment',
    slot: 'weapon',
    iconKey: 'scythe',
    rarity: 'epic',
    sellPrice: 190,
    bonusDmg: 28,
    bonusSwipe: 60,
    element: 'fire',
    desc: "+28 Attack Power, +60% Swipe, [Fire Element]. Harvests souls in sweeping arcs of flame."
  },
  thunder_maul: {
    id: 'thunder_maul',
    name: "Thunder Maul",
    type: 'equipment',
    slot: 'weapon',
    iconKey: 'hammer',
    rarity: 'epic',
    sellPrice: 200,
    bonusDmg: 32,
    bonusSwipe: 35,
    element: 'lightning',
    desc: "+32 Attack Power, +35% Swipe, [Lightning Element]. Every blow rolls like a storm."
  },
  dawn_scepter: {
    id: 'dawn_scepter',
    name: "Scepter of Dawn",
    type: 'equipment',
    slot: 'weapon',
    iconKey: 'scepter',
    rarity: 'legendary',
    sellPrice: 300,
    bonusDmg: 34,
    bonusMp: 60,
    bonusHp: 40,
    element: 'holy',
    desc: "+34 Attack Power, +60 Max Mana, +40 Max Health, [Holy Element]. Radiates the first light of morning."
  },
  dragonbone_glaive: {
    id: 'dragonbone_glaive',
    name: "Dragonbone Glaive",
    type: 'equipment',
    slot: 'weapon',
    iconKey: 'spear',
    rarity: 'legendary',
    sellPrice: 320,
    bonusDmg: 38,
    bonusSwipe: 55,
    element: 'fire',
    desc: "+38 Attack Power, +55% Swipe, [Fire Element]. Carved from the spine of an elder wyrm."
  },
  chain_hauberk: {
    id: 'chain_hauberk',
    name: "Chainmail Hauberk",
    type: 'equipment',
    slot: 'armor',
    iconKey: 'chainmail',
    rarity: 'common',
    sellPrice: 50,
    bonusDef: 7,
    bonusHp: 30,
    desc: "+7 Defense, +30 Max Health. Riveted rings of honest steel."
  },
  ranger_jerkin: {
    id: 'ranger_jerkin',
    name: "Ranger's Jerkin",
    type: 'equipment',
    slot: 'armor',
    iconKey: 'armor_leather',
    rarity: 'common',
    sellPrice: 45,
    bonusDef: 4,
    bonusSpeed: 0.3,
    desc: "+4 Defense, +0.3 Speed. Light leather for long patrols."
  },
  glacier_plate: {
    id: 'glacier_plate',
    name: "Glacier Plate",
    type: 'equipment',
    slot: 'armor',
    iconKey: 'armor_ice',
    rarity: 'rare',
    sellPrice: 135,
    bonusDef: 11,
    bonusHp: 50,
    elementResist:  {ice: 0.15},
    desc: "+11 Defense, +50 Max Health, Ice RES +15%. Frost-forged plates that shrug off cold."
  },
  nightstalker_garb: {
    id: 'nightstalker_garb',
    name: "Nightstalker Garb",
    type: 'equipment',
    slot: 'armor',
    iconKey: 'robe_dark',
    rarity: 'epic',
    sellPrice: 170,
    bonusDef: 7,
    bonusDmg: 10,
    bonusAttackSpeed: 0.15,
    elementResist:  {dark: 0.12},
    desc: "+7 Defense, +10 Attack Power, +15% Attack Speed, Dark RES +12%. Woven from shadow silk."
  },
  dragonscale_plate: {
    id: 'dragonscale_plate',
    name: "Dragonscale Plate",
    type: 'equipment',
    slot: 'armor',
    iconKey: 'armor_dragon',
    rarity: 'legendary',
    sellPrice: 320,
    bonusDef: 16,
    bonusHp: 120,
    elementResist:  {fire: 0.2},
    desc: "+16 Defense, +120 Max Health, Fire RES +20%. Scales that once withstood dragonfire."
  },
  archon_vestments: {
    id: 'archon_vestments',
    name: "Archon Vestments",
    type: 'equipment',
    slot: 'armor',
    iconKey: 'robe_gold',
    rarity: 'legendary',
    sellPrice: 300,
    bonusDef: 9,
    bonusHp: 70,
    bonusMp: 110,
    elementResist:  {holy: 0.15},
    desc: "+9 Defense, +70 Max Health, +110 Max Mana, Holy RES +15%. Robes of the high archons."
  },
  rogue_bandana: {
    id: 'rogue_bandana',
    name: "Rogue Bandana",
    type: 'equipment',
    slot: 'helmet',
    iconKey: 'bandana',
    rarity: 'common',
    sellPrice: 35,
    bonusSpeed: 0.3,
    bonusDmg: 4,
    desc: "+0.3 Speed, +4 Attack Power. Keeps the hair out of the eyes."
  },
  horned_helm: {
    id: 'horned_helm',
    name: "Horned Viking Helm",
    type: 'equipment',
    slot: 'helmet',
    iconKey: 'horned',
    rarity: 'rare',
    sellPrice: 95,
    bonusDef: 7,
    bonusHp: 40,
    bonusDmg: 4,
    desc: "+7 Defense, +40 Max Health, +4 Attack Power. Worn by raiders of the north."
  },
  starweaver_hat: {
    id: 'starweaver_hat',
    name: "Starweaver Hat",
    type: 'equipment',
    slot: 'helmet',
    iconKey: 'hat',
    rarity: 'rare',
    sellPrice: 100,
    bonusMp: 50,
    bonusDmg: 8,
    desc: "+50 Max Mana, +8 Attack Power. Embroidered with living constellations."
  },
  winter_crown: {
    id: 'winter_crown',
    name: "Crown of Winter",
    type: 'equipment',
    slot: 'helmet',
    iconKey: 'crown_frost',
    rarity: 'epic',
    sellPrice: 160,
    bonusDef: 6,
    bonusMp: 40,
    elementResist:  {ice: 0.15},
    desc: "+6 Defense, +40 Max Mana, Ice RES +15%. A circlet of never-melting ice."
  },
  bone_warden_mask: {
    id: 'bone_warden_mask',
    name: "Bone Warden Mask",
    type: 'equipment',
    slot: 'helmet',
    iconKey: 'skull_mask',
    rarity: 'epic',
    sellPrice: 165,
    bonusDef: 8,
    bonusDmg: 10,
    elementResist:  {dark: 0.1},
    desc: "+8 Defense, +10 Attack Power, Dark RES +10%. The face of a long-dead warden."
  },
  traveler_boots: {
    id: 'traveler_boots',
    name: "Traveler's Boots",
    type: 'equipment',
    slot: 'boots',
    iconKey: 'boots',
    rarity: 'common',
    sellPrice: 30,
    bonusSpeed: 0.4,
    desc: "+0.4 Speed. Broken in by a thousand roads."
  },
  steel_sabatons: {
    id: 'steel_sabatons',
    name: "Steel Sabatons",
    type: 'equipment',
    slot: 'boots',
    iconKey: 'boots_steel',
    rarity: 'rare',
    sellPrice: 90,
    bonusDef: 7,
    bonusHp: 25,
    desc: "+7 Defense, +25 Max Health. Articulated plate for the feet."
  },
  ember_treads: {
    id: 'ember_treads',
    name: "Ember Treads",
    type: 'equipment',
    slot: 'boots',
    iconKey: 'boots_ember',
    rarity: 'epic',
    sellPrice: 150,
    bonusSpeed: 0.6,
    bonusDmg: 6,
    elementResist:  {fire: 0.12},
    desc: "+0.6 Speed, +6 Attack Power, Fire RES +12%. Leave smouldering footprints."
  },
  shadowstep_boots: {
    id: 'shadowstep_boots',
    name: "Shadowstep Boots",
    type: 'equipment',
    slot: 'boots',
    iconKey: 'boots_shadow',
    rarity: 'legendary',
    sellPrice: 260,
    bonusSpeed: 1,
    bonusAttackSpeed: 0.1,
    elementResist:  {dark: 0.1},
    desc: "+1 Speed, +10% Attack Speed, Dark RES +10%. Step between the shadows."
  },
  copper_band: {
    id: 'copper_band',
    name: "Copper Band",
    type: 'equipment',
    slot: 'ring',
    iconKey: 'ring_copper',
    rarity: 'common',
    sellPrice: 25,
    bonusDmg: 4,
    bonusHp: 15,
    desc: "+4 Attack Power, +15 Max Health. Simple, sturdy, slightly green."
  },
  sapphire_signet: {
    id: 'sapphire_signet',
    name: "Sapphire Signet",
    type: 'equipment',
    slot: 'ring',
    iconKey: 'ring_sapphire',
    rarity: 'rare',
    sellPrice: 95,
    bonusMp: 40,
    bonusDmg: 6,
    elementResist:  {ice: 0.08},
    desc: "+40 Max Mana, +6 Attack Power, Ice RES +8%. A cold blue stone set in silver."
  },
  ruby_signet: {
    id: 'ruby_signet',
    name: "Ruby Signet",
    type: 'equipment',
    slot: 'ring',
    iconKey: 'ring_ruby',
    rarity: 'rare',
    sellPrice: 100,
    bonusDmg: 10,
    elementResist:  {fire: 0.08},
    desc: "+10 Attack Power, Fire RES +8%. Warm to the touch."
  },
  emerald_loop: {
    id: 'emerald_loop',
    name: "Emerald Loop",
    type: 'equipment',
    slot: 'ring',
    iconKey: 'ring_emerald',
    rarity: 'rare',
    sellPrice: 95,
    bonusHp: 50,
    bonusSpeed: 0.2,
    elementResist:  {earth: 0.08},
    desc: "+50 Max Health, +0.2 Speed, Earth RES +8%. Hums with the life of the forest."
  },
  void_eye_ring: {
    id: 'void_eye_ring',
    name: "Void Eye Ring",
    type: 'equipment',
    slot: 'ring',
    iconKey: 'ring_void',
    rarity: 'epic',
    sellPrice: 170,
    bonusDmg: 14,
    bonusAttackSpeed: 0.12,
    elementResist:  {dark: 0.1},
    desc: "+14 Attack Power, +12% Attack Speed, Dark RES +10%. An eye that stares back."
  },
  phoenix_ring: {
    id: 'phoenix_ring',
    name: "Phoenix Feather Ring",
    type: 'equipment',
    slot: 'ring',
    iconKey: 'ring_phoenix',
    rarity: 'legendary',
    sellPrice: 280,
    bonusHp: 90,
    bonusDmg: 12,
    elementResist:  {fire: 0.15, holy: 0.1},
    desc: "+90 Max Health, +12 Attack Power, Fire RES +15%, Holy RES +10%. Reborn from its own ashes."
  }
};

// Weapons are class-locked: only the listed class can equip them.
const WEAPON_CLASS = {
  warrior: ['iron_blade', 'sweeping_claymore', 'inferno_blade', 'storm_breaker', 'excalibur',
    'woodsman_axe', 'iron_morningstar', 'thunder_maul', 'dragonbone_glaive'],
  mage: ['archmage_staff', 'glacial_spire', 'voidcaller_wand', 'dawn_scepter'],
  rogue: ['shadow_daggers', 'wind_rapier', 'hunter_spear', 'frostbite_katana', 'venom_kris', 'ember_scythe']
};
for (const [cls, ids] of Object.entries(WEAPON_CLASS)) {
  for (const id of ids) ITEMS[id].cls = cls;
}

// Weapon abilities (right click). Same data shape and engine as SP card skills
// (see SP_SKILLS in spCards.js); colour and element come from the weapon.
const WEAPON_ABILITIES = {
  // Warrior
  iron_blade: { name: 'Shield Breaker', shape: 'strike', range: 3, dmg: 2.4, knock: 1, mp: 10, cd: 6 },
  sweeping_claymore: { name: 'Grand Sweep', shape: 'cone', range: 4, arc: 200, dmg: 2.0, mp: 12, cd: 6 },
  inferno_blade: { name: 'Flame Slash', shape: 'line', len: 6, width: 1.4, dmg: 2.4, burn: 3, mp: 14, cd: 7 },
  storm_breaker: { name: 'Thunderclap', shape: 'nova', r: 3.4, dmg: 2.4, chill: 1, mp: 16, cd: 8 },
  excalibur: { name: 'Holy Excalibur', shape: 'line', len: 10, width: 2, dmg: 4.0, heal: 0.08, mp: 24, cd: 12 },
  woodsman_axe: { name: 'Timber!', shape: 'blast', r: 2, range: 4, dmg: 2.6, chill: 1.5, mp: 12, cd: 7 },
  iron_morningstar: { name: 'Skull Crack', shape: 'strike', range: 3, dmg: 3.0, chill: 1.5, mp: 12, cd: 7 },
  thunder_maul: { name: 'Storm Hammer', shape: 'pulse', r: 3, n: 3, every: 0.3, dmg: 1.2, mp: 18, cd: 9 },
  dragonbone_glaive: { name: 'Dragon Breath', shape: 'cone', range: 5.5, arc: 70, dmg: 3.0, burn: 4, mp: 20, cd: 9 },
  // Mage
  archmage_staff: { name: 'Arcane Orb', shape: 'blast', r: 2.2, range: 8, dmg: 2.6, burn: 2, mp: 16, cd: 6 },
  glacial_spire: { name: 'Ice Prison', shape: 'pull', r: 3.5, range: 7, dmg: 2.0, chill: 3, mp: 18, cd: 9 },
  voidcaller_wand: { name: 'Void Bolts', shape: 'volley', range: 8, n: 4, dmg: 1.8, leech: 0.05, mp: 16, cd: 7 },
  dawn_scepter: { name: 'Dawn Blessing', shape: 'buff', r: 3, dmg: 1.5, heal: 0.2, shield: 0.1, mp: 20, cd: 14 },
  // Rogue
  shadow_daggers: { name: 'Shadow Fang', shape: 'strike', range: 4, dmg: 2.6, crit: 0.25, mp: 8, cd: 5 },
  wind_rapier: { name: 'Lunge', shape: 'dash', len: 5, width: 1.2, dmg: 2.2, mp: 8, cd: 6 },
  hunter_spear: { name: 'Spear Throw', shape: 'line', len: 8, width: 0.9, dmg: 2.6, mp: 10, cd: 6 },
  frostbite_katana: { name: 'Iaijutsu', shape: 'dash', len: 6, width: 1.4, dmg: 2.8, chill: 2, mp: 12, cd: 8 },
  venom_kris: { name: 'Venom Strike', shape: 'strike', range: 3.5, dmg: 2.0, poison: 6, mp: 8, cd: 6 },
  ember_scythe: { name: 'Reaper Spin', shape: 'nova', r: 3.2, dmg: 2.6, burn: 3, leech: 0.05, mp: 14, cd: 8 }
};
// Cooldowns above are scaled by this (rounded to 0.5s) so right-click stays snappy
const WEAPON_ABILITY_CD_MULT = 0.4;
const ELEMENT_COLORS = { neutral: '#e2e8f0', fire: '#f97316', ice: '#67e8f9', lightning: '#facc15', earth: '#4ade80', holy: '#fde68a', dark: '#a855f7' };
{
  const { normalizeSpSkill } = require('./spCards');
  for (const [weaponId, a] of Object.entries(WEAPON_ABILITIES)) {
    const weapon = ITEMS[weaponId];
    const element = (weapon && weapon.element) || 'neutral';
    a.cd = Math.max(1, Math.round(a.cd * WEAPON_ABILITY_CD_MULT * 2) / 2);
    normalizeSpSkill('wpn_' + weaponId, Object.assign(a, { element, color: ELEMENT_COLORS[element] || ELEMENT_COLORS.neutral }));
    if (weapon) weapon.abilityId = a.id;
  }
}

// The ability of a weapon item (by base id, so items saved earlier work too)
function weaponAbility(item) {
  return (item && WEAPON_ABILITIES[item.id]) || null;
}

// Class required to equip an item, or null if anyone can. Looks up the base
// definition so items saved before the class lock still get checked.
function requiredClass(item) {
  if (!item) return null;
  const base = ITEMS[item.id];
  return (base && base.cls) || item.cls || null;
}

// Equipment drop pools by source. Monsters and plain chests roll from
// common/rare gear, bosses and boss chests from rare-and-up gear.
const GEAR_POOLS = {
  common: ['iron_blade', 'shadow_daggers', 'leather_tunic', 'iron_helm', 'iron_greaves',
    'woodsman_axe', 'iron_morningstar', 'hunter_spear', 'chain_hauberk', 'ranger_jerkin',
    'rogue_bandana', 'traveler_boots', 'copper_band'],
  rare: ['sweeping_claymore', 'inferno_blade', 'glacial_spire', 'shadow_hood', 'plate_cuirass',
    'frostbite_katana', 'venom_kris', 'voidcaller_wand', 'glacier_plate', 'horned_helm',
    'starweaver_hat', 'steel_sabatons', 'sapphire_signet', 'ruby_signet', 'emerald_loop'],
  boss: ['storm_breaker', 'wind_rapier', 'archmage_staff', 'excalibur', 'mystic_robe', 'archmage_cowl',
    'winged_boots', 'ring_of_power', 'ember_scythe', 'thunder_maul', 'dawn_scepter', 'dragonbone_glaive',
    'nightstalker_garb', 'dragonscale_plate', 'archon_vestments', 'winter_crown', 'bone_warden_mask',
    'ember_treads', 'shadowstep_boots', 'void_eye_ring', 'phoenix_ring']
};

function pickGear(pool) {
  const list = GEAR_POOLS[pool] || GEAR_POOLS.common;
  return list[Math.floor(Math.random() * list.length)];
}

// ---- Level-banded drops ----
// Every piece belongs to a tier (from its pool; legendary boss gear is its own
// tier) and only drops from monsters whose level is inside the tier's band.
// (mid-tier pieces keep dropping at high levels, so high-tier ones stay the rarer find)
const GEAR_TIER_BANDS = { common: [1, 40], rare: [10, 999], epic: [50, 999], legendary: [70, 999] };
// How likely each tier is, among the pieces that fit the level
const NORMAL_TIER_WEIGHT = { common: 1, rare: 1, epic: 0.15, legendary: 0 };   // legendary: bosses only
const BOSS_TIER_WEIGHT = { common: 0.15, rare: 0.5, epic: 1, legendary: 0.6 };
const BOSS_LEVEL_REACH = 20;      // bosses also drop tiers up to this many levels above them
const CLASS_WEAPON_SHARE = 0.6;   // share of weapon drops that fit the killer's class
const GEAR_TIER = {};
for (const id of GEAR_POOLS.common) GEAR_TIER[id] = 'common';
for (const id of GEAR_POOLS.rare) GEAR_TIER[id] = 'rare';
for (const id of GEAR_POOLS.boss) GEAR_TIER[id] = ITEMS[id].rarity === 'legendary' ? 'legendary' : 'epic';

function weightedPick(entries) {
  const total = entries.reduce((t, e) => t + e.w, 0);
  let r = Math.random() * total;
  for (const e of entries) if ((r -= e.w) <= 0) return e.id;
  return entries[entries.length - 1].id;
}

// Gear id for a drop at `level`; cls biases weapon drops toward that class
function pickGearForLevel(level, { boss = false, cls = null } = {}) {
  const weights = boss ? BOSS_TIER_WEIGHT : NORMAL_TIER_WEIGHT;
  const reach = boss ? BOSS_LEVEL_REACH : 0;
  const fits = Object.entries(GEAR_TIER)
    .filter(([, tier]) => weights[tier] > 0 && GEAR_TIER_BANDS[tier][0] <= level + reach && level <= GEAR_TIER_BANDS[tier][1])
    .map(([id, tier]) => ({ id, w: weights[tier] }));
  if (!fits.length) return pickGear(boss ? 'boss' : 'common');

  const weapons = fits.filter(e => ITEMS[e.id].slot === 'weapon');
  const others = fits.filter(e => ITEMS[e.id].slot !== 'weapon');
  const weaponShare = weapons.reduce((t, e) => t + e.w, 0) / fits.reduce((t, e) => t + e.w, 0);
  if (!weapons.length || (others.length && Math.random() >= weaponShare)) return weightedPick(others);
  const mine = cls ? weapons.filter(e => ITEMS[e.id].cls === cls) : [];
  return weightedPick(mine.length && Math.random() < CLASS_WEAPON_SHARE ? mine : weapons);
}

// Enhancement (+1 .. +15) at the enchanter: price grows ~55% per level and
// the success chance falls; failing from +7 upward drops one level.
const ENHANCE_MAX = 15;
const ENHANCE_BASE_COST = { common: 400, rare: 900, epic: 2000, legendary: 4500 };
const ENHANCE_COST_GROWTH = 1.55;
const ENHANCE_CHANCE = [1, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.35, 0.28, 0.22, 0.17, 0.13, 0.1];
const ENHANCE_SAFE_LEVEL = 7;

function enhanceCost(item) {
  const lvl = item.upgradeLevel || 0;
  return Math.round((ENHANCE_BASE_COST[item.rarity] || ENHANCE_BASE_COST.common) * Math.pow(ENHANCE_COST_GROWTH, lvl));
}

function enhanceChance(item) {
  return ENHANCE_CHANCE[item.upgradeLevel || 0] || 0;
}

/**
 * Generates an item instance with rolled stats, quality prefix, and secondary affixes
 * Weapons & gear found in chests will have unique stats instead of generic fixed values!
 */
const { ELEMENT_INFO } = require('./elements');
const RESIST_ELEMENTS = ['fire', 'ice', 'lightning', 'earth', 'holy', 'dark'];

// itemLevel = level of the monster (or dungeon floor band) that dropped it.
// Stats grow smoothly with it: every 10 item levels is worth what one dungeon
// floor used to be (+3 base attack, +0.08 quality roll, +22% suffix).
function generateRandomizedGear(baseId, itemLevel = 1, isBoss = false) {
  const base = ITEMS[baseId];
  if (!base || base.type !== 'equipment') return { ...(base || {}) };
  itemLevel = Math.max(1, Math.round(itemLevel));
  const lvlSteps = (itemLevel - 1) / 10;

  // 1. Roll Quality Tier / Prefix
  const qualityRoll = Math.random() + (isBoss ? 0.25 : 0) + lvlSteps * 0.08;
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
    quality: qualityName,
    itemLevel
  };

  if (base.slot === 'weapon') {
    const elemPool = ['neutral', 'neutral', 'fire', 'ice', 'lightning', 'earth', 'holy', 'dark'];
    item.element = base.element || elemPool[Math.floor(Math.random() * elemPool.length)];
  }

  const floorBonus = lvlSteps * 3;
  if (base.bonusDmg) item.bonusDmg = Math.max(1, Math.round((base.bonusDmg + floorBonus) * qualityMult));
  if (base.bonusDef) item.bonusDef = Math.max(1, Math.round((base.bonusDef + Math.floor(floorBonus * 0.6)) * qualityMult));
  if (base.bonusHp) item.bonusHp = Math.max(5, Math.round((base.bonusHp + floorBonus * 12) * qualityMult));
  if (base.bonusMp) item.bonusMp = Math.max(5, Math.round((base.bonusMp + floorBonus * 8) * qualityMult));
  if (base.bonusSpeed) item.bonusSpeed = Number(((base.bonusSpeed || 0) * qualityMult).toFixed(2));
  if (base.bonusAttackSpeed) item.bonusAttackSpeed = Number(((base.bonusAttackSpeed || 0) * qualityMult).toFixed(2));
  if (base.bonusSwipe) item.bonusSwipe = Math.round((base.bonusSwipe + Math.floor(floorBonus * 0.8)) * qualityMult);

  // Armor pieces can roll elemental resistances (bosses roll more often and higher)
  if (base.slot !== 'weapon') {
    item.elementResist = { ...(base.elementResist || {}) };
    const resistRolls = (Math.random() < (isBoss ? 0.7 : 0.3) ? 1 : 0) + (qualityName === 'Mythic' ? 1 : 0);
    for (let i = 0; i < resistRolls; i++) {
      const el = RESIST_ELEMENTS[Math.floor(Math.random() * RESIST_ELEMENTS.length)];
      const val = (0.06 + Math.random() * 0.09) * (isBoss ? 1.4 : 1.0);
      item.elementResist[el] = Number(Math.min(0.35, (item.elementResist[el] || 0) + val).toFixed(2));
    }
    if (Object.keys(item.elementResist).length === 0) delete item.elementResist;
  }

  if (chosenSuffix) {
    const suffixScale = 1 + lvlSteps * 0.22;
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
  if (item.element && item.element !== 'neutral') {
    const elIcons = { fire: '🔥 Fire', ice: '❄️ Ice', lightning: '⚡ Lightning', earth: '🌿 Earth', holy: '✨ Holy', dark: '💀 Dark' };
    statList.push(`[${elIcons[item.element] || item.element}]`);
  }
  if (item.bonusDmg) statList.push(`+${item.bonusDmg} DMG`);
  if (item.bonusDef) statList.push(`+${item.bonusDef} DEF`);
  if (item.bonusHp) statList.push(`+${item.bonusHp} HP`);
  if (item.bonusMp) statList.push(`+${item.bonusMp} MP`);
  if (item.bonusSpeed) statList.push(`+${item.bonusSpeed} SPD`);
  if (item.bonusAttackSpeed) statList.push(`+${Math.round(item.bonusAttackSpeed * 100)}% Atk Spd`);
  if (item.bonusSwipe) statList.push(`+${item.bonusSwipe}% Swipe`);
  if (item.elementResist) {
    for (const [el, val] of Object.entries(item.elementResist)) {
      const info = ELEMENT_INFO[el];
      statList.push(`${info ? `${info.icon} ${info.name}` : el} RES +${Math.round(val * 100)}%`);
    }
  }

  item.desc = `${statList.join(', ')} (${qualityName || 'Standard'} Roll)`;
  item.sellPrice = Math.round((base.sellPrice || 30) * qualityMult * (chosenSuffix ? 1.3 : 1.0));
  delete item.buyPrice;

  return item;
}

const REFORGE_COSTS = {
  common: 50,
  rare: 150,
  epic: 350,
  legendary: 750
};

const SKYBLOCK_REFORGES = {
  weapon: {
    Spicy: {
      desc: 'Balanced offense with critical power and attack speed',
      stats: {
        common: { bonusDmg: 3, critChance: 2, critDmg: 20, bonusAttackSpeed: 0.04 },
        rare: { bonusDmg: 7, critChance: 4, critDmg: 35, bonusAttackSpeed: 0.08 },
        epic: { bonusDmg: 12, critChance: 6, critDmg: 55, bonusAttackSpeed: 0.12 },
        legendary: { bonusDmg: 20, critChance: 10, critDmg: 80, bonusAttackSpeed: 0.18 }
      }
    },
    Fabled: {
      desc: 'Raw damage and wide sweeping cleaves',
      stats: {
        common: { bonusDmg: 5, critDmg: 15, bonusSwipe: 15 },
        rare: { bonusDmg: 11, critDmg: 25, bonusSwipe: 25 },
        epic: { bonusDmg: 18, critDmg: 40, bonusSwipe: 35 },
        legendary: { bonusDmg: 28, critDmg: 65, bonusSwipe: 50 }
      }
    },
    Sharp: {
      desc: 'Extremely high critical hit chance and critical damage',
      stats: {
        common: { bonusDmg: 2, critChance: 6, critDmg: 15 },
        rare: { bonusDmg: 5, critChance: 12, critDmg: 25 },
        epic: { bonusDmg: 9, critChance: 18, critDmg: 40 },
        legendary: { bonusDmg: 15, critChance: 25, critDmg: 60 }
      }
    },
    Heroic: {
      desc: 'Favored by sorcerers, grants high mana and swift casting',
      stats: {
        common: { bonusDmg: 4, bonusMp: 20, bonusAttackSpeed: 0.04 },
        rare: { bonusDmg: 8, bonusMp: 45, bonusAttackSpeed: 0.08 },
        epic: { bonusDmg: 14, bonusMp: 75, bonusAttackSpeed: 0.12 },
        legendary: { bonusDmg: 22, bonusMp: 120, bonusAttackSpeed: 0.18 }
      }
    },
    Legendary: {
      desc: 'All-around formidable enhancement across all combat attributes',
      stats: {
        common: { bonusDmg: 4, critChance: 3, critDmg: 15, bonusMp: 10, bonusAttackSpeed: 0.04 },
        rare: { bonusDmg: 8, critChance: 6, critDmg: 28, bonusMp: 25, bonusAttackSpeed: 0.07 },
        epic: { bonusDmg: 14, critChance: 9, critDmg: 45, bonusMp: 45, bonusAttackSpeed: 0.10 },
        legendary: { bonusDmg: 24, critChance: 14, critDmg: 70, bonusMp: 70, bonusAttackSpeed: 0.15 }
      }
    },
    Fast: {
      desc: 'Extreme swiftness and rapid attack cadence',
      stats: {
        common: { bonusAttackSpeed: 0.12, bonusSpeed: 0.2 },
        rare: { bonusAttackSpeed: 0.22, bonusSpeed: 0.4 },
        epic: { bonusAttackSpeed: 0.32, bonusSpeed: 0.6 },
        legendary: { bonusAttackSpeed: 0.45, bonusSpeed: 0.9 }
      }
    },
    Odd: {
      desc: 'High critical gamble at the cost of mana',
      stats: {
        common: { critChance: 8, critDmg: 25, bonusMp: -10 },
        rare: { critChance: 14, critDmg: 45, bonusMp: -15 },
        epic: { critChance: 20, critDmg: 70, bonusMp: -25 },
        legendary: { critChance: 28, critDmg: 95, bonusMp: -35 }
      }
    }
  },
  armor: {
    Fierce: {
      desc: 'Offensive armor enhancement boosting damage, criticals and defense',
      stats: {
        common: { bonusDmg: 2, critChance: 2, critDmg: 10, bonusDef: 2 },
        rare: { bonusDmg: 5, critChance: 4, critDmg: 20, bonusDef: 6 },
        epic: { bonusDmg: 9, critChance: 6, critDmg: 32, bonusDef: 12 },
        legendary: { bonusDmg: 15, critChance: 10, critDmg: 50, bonusDef: 20 }
      }
    },
    Titanic: {
      desc: 'Colossal health pool and stalwart armor plating',
      stats: {
        common: { bonusHp: 20, bonusDef: 5 },
        rare: { bonusHp: 50, bonusDef: 14 },
        epic: { bonusHp: 90, bonusDef: 25 },
        legendary: { bonusHp: 160, bonusDef: 42 }
      }
    },
    Pure: {
      desc: 'Harmonious upgrade bestowing balanced boosts to every stat',
      stats: {
        common: { bonusDmg: 2, bonusDef: 3, bonusHp: 15, bonusSpeed: 0.1, critChance: 2, critDmg: 8 },
        rare: { bonusDmg: 4, bonusDef: 7, bonusHp: 35, bonusSpeed: 0.2, critChance: 4, critDmg: 16 },
        epic: { bonusDmg: 7, bonusDef: 13, bonusHp: 65, bonusSpeed: 0.3, critChance: 6, critDmg: 26 },
        legendary: { bonusDmg: 12, bonusDef: 22, bonusHp: 110, bonusSpeed: 0.5, critChance: 9, critDmg: 40 }
      }
    },
    Wise: {
      desc: 'Astronomical mana reservoir and increased mobility',
      stats: {
        common: { bonusMp: 25, bonusSpeed: 0.1 },
        rare: { bonusMp: 60, bonusSpeed: 0.2 },
        epic: { bonusMp: 110, bonusSpeed: 0.35 },
        legendary: { bonusMp: 180, bonusSpeed: 0.55 }
      }
    },
    Smart: {
      desc: 'Well-rounded arcane fortification with mana and defense',
      stats: {
        common: { bonusMp: 15, bonusDef: 4, bonusHp: 10 },
        rare: { bonusMp: 40, bonusDef: 10, bonusHp: 25 },
        epic: { bonusMp: 75, bonusDef: 18, bonusHp: 45 },
        legendary: { bonusMp: 130, bonusDef: 30, bonusHp: 80 }
      }
    },
    Ancient: {
      desc: 'Primeval relics enhancing critical might, health and defense',
      stats: {
        common: { bonusDmg: 3, critDmg: 12, bonusDef: 3 },
        rare: { bonusDmg: 7, critDmg: 24, bonusDef: 8 },
        epic: { bonusDmg: 12, critDmg: 38, bonusDef: 15 },
        legendary: { bonusDmg: 20, critDmg: 60, bonusDef: 26 }
      }
    },
    Heavy: {
      desc: 'Impenetrable defense at a slight cost to movement speed',
      stats: {
        common: { bonusDef: 8, bonusSpeed: -0.1 },
        rare: { bonusDef: 20, bonusSpeed: -0.15 },
        epic: { bonusDef: 38, bonusSpeed: -0.2 },
        legendary: { bonusDef: 65, bonusSpeed: -0.25 }
      }
    }
  },
  ring: {
    Godly: {
      desc: 'Divine accessory blessing amplifying raw damage and crits',
      stats: {
        common: { bonusDmg: 3, critChance: 3, critDmg: 15 },
        rare: { bonusDmg: 7, critChance: 6, critDmg: 30 },
        epic: { bonusDmg: 12, critChance: 9, critDmg: 50 },
        legendary: { bonusDmg: 20, critChance: 14, critDmg: 75 }
      }
    },
    Itchy: {
      desc: 'Substantial boost to critical damage and attack speed',
      stats: {
        common: { critDmg: 15, bonusAttackSpeed: 0.04 },
        rare: { critDmg: 30, bonusAttackSpeed: 0.08 },
        epic: { critDmg: 50, bonusAttackSpeed: 0.12 },
        legendary: { critDmg: 80, bonusAttackSpeed: 0.18 }
      }
    },
    Pleasant: {
      desc: 'Hearty vitality enhancement increasing maximum health',
      stats: {
        common: { bonusHp: 25 },
        rare: { bonusHp: 60 },
        epic: { bonusHp: 110 },
        legendary: { bonusHp: 180 }
      }
    },
    Silky: {
      desc: 'Pure concentrated critical damage',
      stats: {
        common: { critDmg: 20 },
        rare: { critDmg: 40 },
        epic: { critDmg: 70 },
        legendary: { critDmg: 110 }
      }
    }
  }
};

function getReforgeCategory(slot) {
  if (slot === 'weapon') return 'weapon';
  if (slot === 'armor' || slot === 'helmet' || slot === 'boots') return 'armor';
  if (slot === 'ring') return 'ring';
  return 'armor';
}

function rollSkyblockReforge(item) {
  if (!item || item.type !== 'equipment') return null;
  const catKey = getReforgeCategory(item.slot);
  const options = SKYBLOCK_REFORGES[catKey];
  if (!options) return null;

  const names = Object.keys(options);
  // Pick a random reforge different from current if possible
  const filtered = names.filter(n => n !== item.reforge);
  const pool = filtered.length > 0 ? filtered : names;
  const chosenName = pool[Math.floor(Math.random() * pool.length)];
  return chosenName;
}

function applySkyblockReforge(item, reforgeName) {
  if (!item || item.type !== 'equipment' || !reforgeName) return item;
  const catKey = getReforgeCategory(item.slot);
  const reforgeDef = SKYBLOCK_REFORGES[catKey] && SKYBLOCK_REFORGES[catKey][reforgeName];
  if (!reforgeDef) return item;

  const rarity = item.rarity || 'common';
  const stats = (reforgeDef.stats[rarity] || reforgeDef.stats.common);

  if (!item.baseName) {
    // Strip any previous reforge prefix or upgrade suffix
    const allReforgeNames = Object.keys(SKYBLOCK_REFORGES.weapon)
      .concat(Object.keys(SKYBLOCK_REFORGES.armor))
      .concat(Object.keys(SKYBLOCK_REFORGES.ring));
    let base = item.name.replace(/\s\+\d+$/, '').trim();
    for (const rName of allReforgeNames) {
      if (base.startsWith(`${rName} `)) {
        base = base.substring(rName.length + 1).trim();
        break;
      }
    }
    item.baseName = base;
  }

  item.reforge = reforgeName;
  item.reforgeStats = { ...stats };
  const lvl = item.upgradeLevel || 0;
  item.name = lvl > 0 ? `${reforgeName} ${item.baseName} +${lvl}` : `${reforgeName} ${item.baseName}`;

  return item;
}

module.exports = {
  ITEMS,
  requiredClass,
  WEAPON_ABILITIES,
  weaponAbility,
  GEAR_POOLS,
  pickGear,
  pickGearForLevel,
  ENHANCE_MAX,
  ENHANCE_SAFE_LEVEL,
  ENHANCE_BASE_COST,
  ENHANCE_COST_GROWTH,
  ENHANCE_CHANCE,
  enhanceCost,
  enhanceChance,
  generateRandomizedGear,
  SKYBLOCK_REFORGES,
  REFORGE_COSTS,
  getReforgeCategory,
  rollSkyblockReforge,
  applySkyblockReforge
};

