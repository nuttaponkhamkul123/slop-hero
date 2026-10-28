// High Performance 2D Canvas Isometric Renderer for Aetheria Online

// Footstep / running dust: small, slow puffs that stay close to the feet
const RUN_DUST_OPTS = { speed: 0.6, sizeScale: 0.5 };
// Skill effects that already play the dash animation (no separate cast pose)
// Props that never animate, so their tinted picture can be cached (drawTinted)
const STATIC_TINT_PROPS = new Set(['boulder', 'stone_pillar', 'oak_tree', 'pine_tree', 'ice_crystal', 'sarcophagus', 'bone_pile', 'gold_hoard']);
// Furthest a mob body is drawn from its anchor, in unscaled pixels (drawMob)
const MOB_BODY_EXTENT = { slime: 24, goblin: 38, skeleton: 38, golem: 72, frost_wolf: 38, ice_elemental: 32, frost_titan: 80 };
// Other tinted props animate; their cached picture is redrawn this often
const ANIMATED_TINT_REFRESH_MS = 120;
// Basic swings closer together than this (after the previous one ends) chain
// into a combo: they alternate direction and every third is a finisher
const SWING_COMBO_WINDOW_MS = 650;
// Sweep slash shape: half-arc (radians) of a normal swing and of a finisher
const SWEEP_HALF_ARC = Math.PI * 0.36;
const SWEEP_HALF_ARC_FINISHER = Math.PI * 0.62;
// Minimap shows at most this many tiles across; larger maps scroll with the hero
const MINIMAP_VIEW_TILES = 72;
const PIXEL_HERO_DASH_SKILLS = new Set(['blade_charge', 'arcane_blink', 'shadow_dash', 'shadowstep']);
// SP card skills: particle types per element and effect lifetime per shape
const SP_ELEMENT_PARTICLES = {
  holy: ['gold', 'spark'], fire: ['fire', 'spark'], ice: ['ice', 'spark'], lightning: ['lightning', 'spark'],
  dark: ['shadow', 'arcane'], earth: ['poison', 'earth'], arcane: ['arcane', 'spark'], neutral: ['slash', 'spark']
};
// Cards that share a warm palette get their own particles so their skills read apart
const SP_CARD_PARTICLES = {
  sp_crusader: ['level', 'gold'],   // rising motes of holy light
  sp_berserker: ['fire', 'slash'],  // flames and savage cuts
  sp_dread_lord: ['shadow', 'slash'], // black-violet abyssal energy and executioner cuts
  sp_nightblade: ['shadow', 'slash'], // dark tendrils and blade cuts
  sp_venom_lord: ['poison', 'dust'], // toxic mist and acid
  sp_blade_dancer: ['lightning', 'spark'], // electric bolts and sparks
  sp_frost_shade: ['ice', 'spark'], // glacial ice crystals and diamonds
  sp_eclipse_reaper: ['shadow', 'fire'] // void matter and blood flame
};
const SP_SHAPE_LIFE = {
  nova: 0.8, buff: 1.1, blast: 0.8, pull: 1.0, cone: 0.55, line: 0.7, strike: 0.5, volley: 0.55,
  chain: 0.6, pulse: 0.55, rain: 0.6, dash: 0.5, blink: 0.6, decoy: 1.2, backstep: 0.6, detonate: 0.95, rewind: 0.8
};
// Skills whose visuals play in phases and need longer than their shape's default
const SP_SKILL_LIFE = {
  // Nightblade
  sp_night_fang: 0.7, sp_shroud: 0.9, sp_moon_volley: 0.75, sp_night_terror: 1.0, sp_shadow_hop: 0.65,
  // Venom Lord
  sp_plague_breath: 0.75, sp_venom_rain: 0.8, sp_viper_nest: 1.0, sp_serpent_slip: 0.65,
  sp_toxic_lance: 0.75, sp_plague_chain: 0.8, sp_venom_dash: 0.6,
  // Blade Dancer
  sp_storm_waltz: 0.7, sp_knife_storm: 1.0, sp_flash_step: 0.55, sp_lightning_lunge: 0.6, sp_blade_tempest: 0.65,
  // Frost Shade
  sp_frozen_execution: 0.75, sp_shatter: 0.85, sp_ice_spikes: 0.9, sp_cold_step: 0.7, sp_frost_daggers: 0.75,
  // Pyromancer
  sp_flame_wave: 0.7, sp_ember_volley: 0.8, sp_sunburst: 0.7, sp_flame_step: 0.6,
  sp_meteor_call: 1.0, sp_fire_chain: 0.8, sp_cinder_rain: 0.65, sp_phoenix_blink: 0.8,
  // Cryo Sage
  sp_ice_lance: 0.8, sp_frozen_orb: 0.8, sp_permafrost: 1.1, sp_ice_blink: 0.8,
  sp_ice_shards: 0.75, sp_frost_cone: 0.8, sp_glacial_pull: 1.05, sp_frost_slide: 0.6,
  // Weapon abilities
  wpn_iron_blade: 0.7, wpn_iron_morningstar: 0.9, wpn_sweeping_claymore: 0.6, wpn_inferno_blade: 0.9, wpn_storm_breaker: 0.7,
  wpn_excalibur: 0.8, wpn_woodsman_axe: 0.9, wpn_thunder_maul: 0.6, wpn_dragonbone_glaive: 0.8, wpn_archmage_staff: 0.9,
  wpn_glacial_spire: 1.0, wpn_voidcaller_wand: 0.8, wpn_dawn_scepter: 1.1, wpn_shadow_daggers: 0.7, wpn_wind_rapier: 0.5,
  wpn_hunter_spear: 0.9, wpn_frostbite_katana: 0.75, wpn_venom_kris: 0.7, wpn_ember_scythe: 0.8,
  // Eclipse Reaper
  sp_total_eclipse: 0.8, sp_blood_tether: 0.8, sp_crimson_bloom: 1.0, sp_reaper_step: 0.6,
  sp_reaper_scythe: 0.6, sp_black_sun: 0.95, sp_harvest: 1.05, sp_crimson_blink: 0.7,
  // Dread Lord
  sp_abyss_cleave: 0.85, sp_void_grasp: 0.95, sp_soul_bastion: 1.0, sp_shadow_charge: 0.65,
  sp_soul_rend: 0.8, sp_dread_wave: 0.75, sp_grave_rain: 0.75, sp_void_step: 0.8
};
// Weapon ability colours by the weapon's element (same layout as SP_FX_PALETTES)
const WEAPON_FX_PALETTES = {
  neutral: { deep: '12, 14, 20', deep2: '40, 46, 60', main: '148, 163, 184', accent: '203, 213, 225', light: '226, 232, 240', core: '255, 255, 255' },
  earth: { deep: '10, 24, 10', deep2: '50, 40, 20', main: '22, 163, 74', accent: '74, 222, 128', light: '187, 247, 208', core: '240, 253, 244' },
  fire: { deep: '30, 8, 2', deep2: '90, 24, 6', main: '234, 88, 12', accent: '249, 115, 22', light: '253, 186, 116', core: '255, 247, 230' },
  lightning: { deep: '28, 22, 4', deep2: '70, 56, 8', main: '202, 138, 4', accent: '250, 204, 21', light: '254, 240, 138', core: '255, 255, 240' },
  holy: { deep: '30, 24, 6', deep2: '80, 64, 20', main: '234, 179, 8', accent: '253, 224, 71', light: '254, 243, 199', core: '255, 255, 250' },
  ice: { deep: '4, 20, 36', deep2: '14, 60, 90', main: '14, 165, 233', accent: '103, 232, 249', light: '186, 230, 253', core: '240, 249, 255' },
  dark: { deep: '10, 2, 20', deep2: '40, 12, 70', main: '126, 34, 206', accent: '192, 132, 252', light: '233, 213, 255', core: '250, 245, 255' }
};
// SP card skill colours: deep/deep2 are drawn opaque (shadows, pools),
// main -> accent -> light -> core additively from darkest to brightest
const SP_FX_PALETTES = {
  sp_nightblade: { deep: '14, 4, 28', deep2: '46, 16, 82', main: '126, 34, 206', accent: '168, 85, 247', light: '216, 180, 254', core: '250, 245, 255' },
  sp_venom_lord: { deep: '6, 24, 10', deep2: '20, 70, 30', main: '22, 163, 74', accent: '74, 222, 128', light: '190, 242, 100', core: '240, 253, 244' },
  sp_blade_dancer: { deep: '28, 20, 4', deep2: '80, 56, 6', main: '202, 138, 4', accent: '250, 204, 21', light: '254, 240, 138', core: '255, 255, 245' },
  sp_frost_shade: { deep: '4, 18, 28', deep2: '12, 60, 84', main: '8, 145, 178', accent: '34, 211, 238', light: '165, 243, 252', core: '240, 253, 255' },
  sp_pyromancer: { deep: '30, 8, 2', deep2: '90, 24, 6', main: '234, 88, 12', accent: '249, 115, 22', light: '253, 186, 116', core: '255, 247, 230' },
  sp_cryo_sage: { deep: '4, 20, 36', deep2: '14, 60, 90', main: '14, 165, 233', accent: '103, 232, 249', light: '186, 230, 253', core: '240, 249, 255' },
  sp_tempest: { deep: '28, 22, 4', deep2: '70, 56, 8', main: '202, 138, 4', accent: '250, 204, 21', light: '254, 240, 138', core: '255, 255, 240' },
  sp_chronomancer: { deep: '30, 22, 6', deep2: '80, 60, 16', main: '217, 119, 6', accent: '253, 224, 71', light: '254, 240, 138', core: '255, 251, 235' },
  sp_void_archon: { deep: '10, 2, 20', deep2: '40, 12, 70', main: '126, 34, 206', accent: '192, 132, 252', light: '233, 213, 255', core: '250, 245, 255' },
  sp_eclipse_reaper: { deep: '12, 2, 6', deep2: '45, 4, 16', main: '225, 29, 72', accent: '244, 63, 94', light: '253, 164, 175', core: '255, 241, 242' },
  sp_dread_lord: { deep: '8, 2, 16', deep2: '36, 8, 64', main: '107, 33, 168', accent: '168, 85, 247', light: '233, 213, 255', core: '255, 245, 255' }
};
const PIXEL_HERO_SCALE = 0.92;     // sprite pixels -> screen pixels at zoom 1
const PIXEL_HERO_DEATH_MS = 1100;
const PIXEL_HERO_HURT_MS = 280;
// Element colours / particle types for projectiles and SP auras
const ELEMENT_FX = {
  neutral: { color: '#c084fc', particle: 'arcane' },
  fire: { color: '#f97316', particle: 'fire' },
  ice: { color: '#67e8f9', particle: 'ice' },
  lightning: { color: '#facc15', particle: 'lightning' },
  earth: { color: '#4ade80', particle: 'poison' },
  holy: { color: '#fef08a', particle: 'gold' },
  dark: { color: '#a855f7', particle: 'arcane' }
};
const PROJECTILE_HEIGHT_PX = 24;   // flight height above the ground at zoom 1
const SP_FLASH_MS = 700;
const MOB_SPAWN_MS = 1000;         // dungeon summon rise (server DUNGEON_SPAWN_MS)
// Facing -> PixelHeroes view (W / SW / NW are drawn flipped)
const PIXEL_HERO_VIEW = { E: 'E', W: 'E', SE: 'SE', SW: 'SE', S: 'S', NE: 'NE', NW: 'NE', N: 'N' };
// Floating combat text: kept small and only loosely tied to the camera zoom
// (font px = size x FLOATING_TEXT_SCALE x zoom clamped to the range below)
const FLOATING_TEXT_SCALE = 0.88;
const FLOATING_TEXT_ZOOM_MIN = 0.85;
const FLOATING_TEXT_ZOOM_MAX = 1.15;
const FLOATING_TEXT_MAX = 45;           // live texts; the oldest go first
const FLOATING_TEXT_STACK_MS = 450;     // texts this close in time on one spot stack up
const FLOATING_TEXT_LINE_PX = 16;       // vertical step between stacked texts

function hexAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Field-zone ground tiles (ids from server/fieldZones.js): top shades,
// side faces, minimap colour and an optional surface detail
const FIELD_TILE_PALETTE = {
  13: { tops: ['#2f6b1f', '#357525', '#2a6119'], left: '#4a3426', right: '#3a291e', mini: '#2f6b1f', detail: 'tuft' },
  14: { tops: ['#7a5a3a', '#73553a', '#806040'], left: '#5a4029', right: '#47321f', mini: '#7a5a3a', detail: 'pebble' },
  15: { tops: ['#1f6f8b'], left: '#16566b', right: '#114456', mini: '#1f6f8b', detail: 'water' },
  16: { tops: ['#4b5340', '#454c3b', '#525a47'], left: '#353b2d', right: '#2a2f24', mini: '#262b20' },
  17: { tops: ['#d9b26f', '#d4ab67', '#ddb877'], left: '#a8834a', right: '#8f6e3c', mini: '#d9b26f', detail: 'grain' },
  18: { tops: ['#b98a55', '#b3844f', '#c0915c'], left: '#8c6538', right: '#74532d', mini: '#b98a55', detail: 'pebble' },
  19: { tops: ['#1aa3a3'], left: '#11807f', right: '#0d6666', mini: '#1aa3a3', detail: 'water' },
  20: { tops: ['#a0553a', '#9a5036', '#a85c40'], left: '#7a3f2a', right: '#633222', mini: '#5a2d1e' },
  21: { tops: ['#3c4f2a', '#425630', '#374826'], left: '#2b3820', right: '#222c19', mini: '#3c4f2a', detail: 'tuft' },
  22: { tops: ['#5b4632', '#55412e', '#614b36'], left: '#433324', right: '#36291d', mini: '#5b4632', detail: 'pebble' },
  23: { tops: ['#2f4a33'], left: '#243a28', right: '#1b2d1f', mini: '#2f4a33', detail: 'murk' },
  24: { tops: ['#2d3326', '#30372a', '#2a2f23'], left: '#1f241a', right: '#181c14', mini: '#1a1e16' },
  25: { tops: ['#4a4644', '#45413f', '#504b49'], left: '#33302e', right: '#292624', mini: '#4a4644', detail: 'crack' },
  26: { tops: ['#2e2b2b', '#332f2f', '#2a2727'], left: '#1f1d1d', right: '#181616', mini: '#2e2b2b', detail: 'pebble' },
  27: { tops: ['#c2410c'], left: '#7c2d12', right: '#5c2009', mini: '#ea580c', detail: 'lava' },
  28: { tops: ['#1c1a24', '#201d29', '#191720'], left: '#121018', right: '#0c0b10', mini: '#141219' },
  29: { tops: ['#5b5277', '#564d71', '#615880'], left: '#3f3854', right: '#332d45', mini: '#5b5277', detail: 'sparkle' },
  30: { tops: ['#8a7fb5', '#8479ae', '#9186bd'], left: '#625a85', right: '#4f486c', mini: '#8a7fb5', detail: 'glow' },
  31: { tops: ['#6d28d9'], left: '#5b21b6', right: '#4c1d95', mini: '#a78bfa', detail: 'pool' },
  32: { tops: ['#3b2f5c', '#40336a', '#362a55'], left: '#2a2142', right: '#211a35', mini: '#2a2142' },
  33: { tops: ['#3a3532', '#35302d', '#3f3936'], left: '#292523', right: '#201d1b', mini: '#3a3532', detail: 'crack' },
  34: { tops: ['#4b4f5c', '#474b57', '#505462'], left: '#33363f', right: '#282a31', mini: '#4b4f5c', detail: 'flag' },
  35: { tops: ['#1e0b33'], left: '#140724', right: '#0d0418', mini: '#4c1d95', detail: 'pool' },
  36: { tops: ['#1f1b2b', '#231e31', '#1b1826'], left: '#15121e', right: '#100e17', mini: '#120f18' },
  37: { tops: ['#e8eef8', '#e2e9f5', '#edf2fb'], left: '#b8c4d8', right: '#9eabc2', mini: '#e8eef8', detail: 'sparkle' },
  38: { tops: ['#e0c069', '#d9b85f', '#e6c773'], left: '#b08f3e', right: '#957833', mini: '#e0c069', detail: 'flag' },
  39: { tops: ['#0b1030'], left: '#070a20', right: '#050716', mini: '#1e1b4b', detail: 'stars' },
  40: { tops: ['#c9cfdb', '#c2c8d5', '#d0d6e1'], left: '#9aa2b3', right: '#838b9c', mini: '#7c8494' },
  // Dungeon room features (ids from server/dungeonGenerator.js FEATURE_TILES)
  41: { tops: ['#1b7f8c'], left: '#135e68', right: '#0e4a52', mini: '#14b8a6', detail: 'water' },                      // deep water
  42: { tops: ['#2a5e5c', '#2d6461'], left: '#1c4240', right: '#153331', mini: '#2a6f67', detail: 'water' },        // shallows (chill)
  43: { tops: ['#c2410c'], left: '#7c2d12', right: '#5c2009', mini: '#ea580c', detail: 'lava' },                       // lava
  44: { tops: ['#3b1b14', '#42201a', '#361812'], left: '#24100c', right: '#1a0b08', mini: '#7c2d12', detail: 'ember' }, // embers (burn)
  45: { tops: ['#3f6212', '#446a14'], left: '#2a420c', right: '#1f3109', mini: '#84cc16', detail: 'murk' },         // acid (poison)
  46: { tops: ['#9fd8ee', '#a9def2', '#94d0e8'], left: '#4f8aa3', right: '#3d6f85', mini: '#a5f3fc', detail: 'sparkle' }, // frost (chill)
  47: { tops: ['#070a1f'], left: '#04061a', right: '#030412', mini: '#0b1030', detail: 'stars' },                      // star pit
  48: { tops: ['#2a1245', '#2e144b'], left: '#1c0b30', right: '#140822', mini: '#4c1d95', detail: 'pool' },         // shadow (chill)
  49: { tops: ['#3d0f33', '#45123a'], left: '#280a22', right: '#1d0719', mini: '#be185d', detail: 'rift' },         // rift (burn)
  50: { tops: ['#2b1d12', '#30210f', '#271a10'], left: '#1c130b', right: '#140d07', mini: '#2b1d12', detail: 'crack' }, // scorched stone
  51: { tops: ['#2e2222', '#332626', '#291e1e'], left: '#1e1616', right: '#161010', mini: '#2e2222', detail: 'pebble' } // rubble
};

// Field tile details that animate (see drawFieldTileDetail); those tiles skip the ground cache
const ANIMATED_TILE_DETAILS = new Set(['water', 'murk', 'lava', 'pool', 'sparkle', 'glow', 'stars', 'ember', 'rift']);
// Of those, details that only twinkle on top of a still tile: the tile itself
// stays in the ground cache and only the twinkle is drawn each frame
const OVERLAY_TILE_DETAILS = new Set(['sparkle', 'glow', 'stars']);

// Obstacle types rendered by townProps3D.js
const TOWN_PROPS_3D = new Set(['merchant', 'blacksmith', 'enchanter', 'house', 'gate_tower', 'corner_keep',
  'market_stall', 'lamp_post', 'crates', 'flower_bed', 'bench', 'well']);

// Unique visual themes for all 10 Dungeon Floors
const DUNGEON_THEME_WALLS = {
  dungeon_crypt: {
    left: '#252c38', leftLow: '#1c212b',
    right: '#191e28', rightLow: '#12161f',
    mortar: 'rgba(20, 26, 36, 0.65)',
    top: '#384355', topLow: '#28313f',
    capStroke: 'rgba(99, 115, 145, 0.5)',
    highlight: 'rgba(56, 189, 248, 0.35)'
  },
  dungeon_sunken: {
    left: '#1c2b29', leftLow: '#152220',
    right: '#131f1e', rightLow: '#0d1716',
    mortar: 'rgba(10, 24, 22, 0.7)',
    top: '#2c3f3c', topLow: '#20302e',
    capStroke: 'rgba(45, 212, 191, 0.45)',
    highlight: 'rgba(45, 212, 191, 0.4)'
  },
  dungeon_obsidian: {
    left: '#2b1a1c', leftLow: '#201314',
    right: '#1d1112', rightLow: '#150c0d',
    mortar: 'rgba(249, 115, 22, 0.55)',
    top: '#3e2627', topLow: '#2d1b1c',
    capStroke: 'rgba(249, 115, 22, 0.5)',
    highlight: 'rgba(251, 146, 60, 0.5)'
  },
  dungeon_glacial: {
    left: '#1b283a', leftLow: '#141f2e',
    right: '#121c29', rightLow: '#0c131e',
    mortar: 'rgba(103, 232, 249, 0.45)',
    top: '#2a3d56', topLow: '#1f2e42',
    capStroke: 'rgba(103, 232, 249, 0.5)',
    highlight: 'rgba(165, 243, 252, 0.6)'
  },
  dungeon_toxic: {
    left: '#202a16', leftLow: '#182010',
    right: '#161e0e', rightLow: '#10170a',
    mortar: 'rgba(132, 204, 22, 0.45)',
    top: '#314023', topLow: '#243019',
    capStroke: 'rgba(132, 204, 22, 0.5)',
    highlight: 'rgba(163, 230, 53, 0.5)'
  },
  dungeon_infernal: {
    left: '#2e151b', leftLow: '#220f14',
    right: '#210d12', rightLow: '#17080c',
    mortar: 'rgba(239, 68, 68, 0.5)',
    top: '#442128', topLow: '#33171d',
    capStroke: 'rgba(239, 68, 68, 0.5)',
    highlight: 'rgba(248, 113, 113, 0.55)'
  },
  dungeon_celestial: {
    left: '#1e1c36', leftLow: '#161429',
    right: '#141226', rightLow: '#0e0c1c',
    mortar: 'rgba(250, 204, 21, 0.5)',
    top: '#302d52', topLow: '#23213e',
    capStroke: 'rgba(250, 204, 21, 0.55)',
    highlight: 'rgba(253, 224, 71, 0.65)'
  },
  dungeon_dread: {
    left: '#261735', leftLow: '#1c1028',
    right: '#1a0e27', rightLow: '#12081d',
    mortar: 'rgba(168, 85, 247, 0.45)',
    top: '#3a254f', topLow: '#2b1b3c',
    capStroke: 'rgba(168, 85, 247, 0.5)',
    highlight: 'rgba(192, 132, 252, 0.55)'
  },
  dungeon_dragon: {
    left: '#2f2014', leftLow: '#23170d',
    right: '#21150c', rightLow: '#160d07',
    mortar: 'rgba(245, 158, 11, 0.45)',
    top: '#473120', topLow: '#352417',
    capStroke: 'rgba(245, 158, 11, 0.5)',
    highlight: 'rgba(251, 191, 36, 0.55)'
  },
  dungeon_oblivion: {
    left: '#2b142a', leftLow: '#200d1f',
    right: '#1d0c1c', rightLow: '#140613',
    mortar: 'rgba(236, 72, 153, 0.5)',
    top: '#422140', topLow: '#31172f',
    capStroke: 'rgba(236, 72, 153, 0.55)',
    highlight: 'rgba(244, 114, 182, 0.65)'
  }
};

const DUNGEON_THEME_TILES = {
  dungeon_crypt: {
    flag: ['#222938', '#1e2430', '#273042', '#1b202a'],
    corridor: ['#353e4f', '#3a4457', '#313948'],
    flagLeft: '#191f28', flagRight: '#12161d',
    corrLeft: '#2a313d', corrRight: '#1e242e'
  },
  dungeon_sunken: {
    flag: ['#182926', '#14221f', '#1d302c', '#121e1c'],
    corridor: ['#273e3a', '#2b4540', '#233734'],
    flagLeft: '#111d1a', flagRight: '#0c1412',
    corrLeft: '#1c2d2a', corrRight: '#14201e'
  },
  dungeon_obsidian: {
    flag: ['#261a1b', '#201516', '#2d1f20', '#1a1112'],
    corridor: ['#3d2829', '#452c2e', '#362325'],
    flagLeft: '#1c1213', flagRight: '#130c0d',
    corrLeft: '#2d1d1e', corrRight: '#201415'
  },
  dungeon_glacial: {
    flag: ['#192738', '#152130', '#1e2f43', '#121c28'],
    corridor: ['#273a52', '#2c425c', '#233449'],
    flagLeft: '#121d2b', flagRight: '#0c131d',
    corrLeft: '#1c2b3d', corrRight: '#131e2b'
  },
  dungeon_toxic: {
    flag: ['#1d2715', '#182111', '#232f1a', '#141c0e'],
    corridor: ['#2c3b21', '#314225', '#27351d'],
    flagLeft: '#151d0e', flagRight: '#0e1409',
    corrLeft: '#202c17', corrRight: '#161f0f'
  },
  dungeon_infernal: {
    flag: ['#2a161b', '#231115', '#311b20', '#1c0d11'],
    corridor: ['#3f2229', '#47272e', '#381e24'],
    flagLeft: '#1e0e12', flagRight: '#14080b',
    corrLeft: '#2e181e', corrRight: '#200f14'
  },
  dungeon_celestial: {
    flag: ['#1b1930', '#161427', '#211f3b', '#121021'],
    corridor: ['#2d294d', '#332f57', '#272343'],
    flagLeft: '#131123', flagRight: '#0c0a18',
    corrLeft: '#211e39', corrRight: '#171428'
  },
  dungeon_dread: {
    flag: ['#231631', '#1c1127', '#2a1b3b', '#160c21'],
    corridor: ['#352349', '#3c2853', '#2e1e40'],
    flagLeft: '#190e24', flagRight: '#100818',
    corrLeft: '#271936', corrRight: '#1b1026'
  },
  dungeon_dragon: {
    flag: ['#2a1d13', '#22160d', '#332418', '#1c1109'],
    corridor: ['#3f2d1e', '#473423', '#372719'],
    flagLeft: '#1e130b', flagRight: '#140c06',
    corrLeft: '#2e2014', corrRight: '#20150c'
  },
  dungeon_oblivion: {
    flag: ['#271326', '#200e1f', '#2f182e', '#190a18'],
    corridor: ['#3c1f3a', '#442442', '#351b33'],
    flagLeft: '#1c0b1b', flagRight: '#130612',
    corrLeft: '#2c152a', corrRight: '#1e0d1d'
  }
};

const DUNGEON_THEME_TORCH = {
  dungeon_crypt: {
    haloInner: 'rgba(56, 189, 248, 0.45)', haloMid: 'rgba(14, 165, 233, 0.16)', haloOuter: 'rgba(14, 165, 233, 0)',
    outer: 'rgba(2, 132, 199, 0.85)', mid: 'rgba(56, 189, 248, 0.85)', inner: 'rgba(240, 249, 255, 0.95)',
    ember: 'rgba(56, 189, 248, ', floorWash0: 'rgba(56, 189, 248, 0.22)', floorWash1: 'rgba(14, 165, 233, 0.08)'
  },
  dungeon_sunken: {
    haloInner: 'rgba(45, 212, 191, 0.45)', haloMid: 'rgba(20, 184, 166, 0.16)', haloOuter: 'rgba(20, 184, 166, 0)',
    outer: 'rgba(13, 148, 136, 0.85)', mid: 'rgba(45, 212, 191, 0.85)', inner: 'rgba(204, 251, 241, 0.95)',
    ember: 'rgba(45, 212, 191, ', floorWash0: 'rgba(45, 212, 191, 0.22)', floorWash1: 'rgba(20, 184, 166, 0.08)'
  },
  dungeon_obsidian: {
    haloInner: 'rgba(251, 146, 60, 0.5)', haloMid: 'rgba(234, 88, 12, 0.2)', haloOuter: 'rgba(234, 88, 12, 0)',
    outer: 'rgba(220, 38, 38, 0.9)', mid: 'rgba(249, 115, 22, 0.9)', inner: 'rgba(254, 240, 138, 0.95)',
    ember: 'rgba(251, 146, 60, ', floorWash0: 'rgba(249, 115, 22, 0.25)', floorWash1: 'rgba(220, 38, 38, 0.08)'
  },
  dungeon_glacial: {
    haloInner: 'rgba(103, 232, 249, 0.5)', haloMid: 'rgba(6, 182, 212, 0.18)', haloOuter: 'rgba(6, 182, 212, 0)',
    outer: 'rgba(8, 145, 178, 0.85)', mid: 'rgba(103, 232, 249, 0.85)', inner: 'rgba(236, 254, 255, 0.95)',
    ember: 'rgba(103, 232, 249, ', floorWash0: 'rgba(103, 232, 249, 0.24)', floorWash1: 'rgba(8, 145, 178, 0.08)'
  },
  dungeon_toxic: {
    haloInner: 'rgba(163, 230, 53, 0.45)', haloMid: 'rgba(101, 163, 13, 0.18)', haloOuter: 'rgba(101, 163, 13, 0)',
    outer: 'rgba(77, 124, 15, 0.85)', mid: 'rgba(163, 230, 53, 0.85)', inner: 'rgba(247, 254, 231, 0.95)',
    ember: 'rgba(163, 230, 53, ', floorWash0: 'rgba(163, 230, 53, 0.22)', floorWash1: 'rgba(101, 163, 13, 0.08)'
  },
  dungeon_infernal: {
    haloInner: 'rgba(239, 68, 68, 0.5)', haloMid: 'rgba(185, 28, 28, 0.2)', haloOuter: 'rgba(185, 28, 28, 0)',
    outer: 'rgba(153, 27, 27, 0.9)', mid: 'rgba(239, 68, 68, 0.9)', inner: 'rgba(254, 226, 226, 0.95)',
    ember: 'rgba(239, 68, 68, ', floorWash0: 'rgba(239, 68, 68, 0.26)', floorWash1: 'rgba(185, 28, 28, 0.09)'
  },
  dungeon_celestial: {
    haloInner: 'rgba(250, 204, 21, 0.5)', haloMid: 'rgba(202, 138, 4, 0.2)', haloOuter: 'rgba(202, 138, 4, 0)',
    outer: 'rgba(202, 138, 4, 0.85)', mid: 'rgba(250, 204, 21, 0.85)', inner: 'rgba(255, 255, 255, 0.98)',
    ember: 'rgba(250, 204, 21, ', floorWash0: 'rgba(250, 204, 21, 0.26)', floorWash1: 'rgba(202, 138, 4, 0.09)'
  },
  dungeon_dread: {
    haloInner: 'rgba(168, 85, 247, 0.5)', haloMid: 'rgba(126, 34, 206, 0.2)', haloOuter: 'rgba(126, 34, 206, 0)',
    outer: 'rgba(107, 33, 168, 0.85)', mid: 'rgba(168, 85, 247, 0.85)', inner: 'rgba(250, 245, 255, 0.95)',
    ember: 'rgba(168, 85, 247, ', floorWash0: 'rgba(168, 85, 247, 0.25)', floorWash1: 'rgba(126, 34, 206, 0.08)'
  },
  dungeon_dragon: {
    haloInner: 'rgba(245, 158, 11, 0.5)', haloMid: 'rgba(217, 119, 6, 0.2)', haloOuter: 'rgba(217, 119, 6, 0)',
    outer: 'rgba(180, 83, 9, 0.85)', mid: 'rgba(245, 158, 11, 0.85)', inner: 'rgba(254, 243, 199, 0.95)',
    ember: 'rgba(245, 158, 11, ', floorWash0: 'rgba(245, 158, 11, 0.25)', floorWash1: 'rgba(180, 83, 9, 0.08)'
  },
  dungeon_oblivion: {
    haloInner: 'rgba(236, 72, 153, 0.5)', haloMid: 'rgba(190, 24, 93, 0.2)', haloOuter: 'rgba(190, 24, 93, 0)',
    outer: 'rgba(157, 23, 77, 0.85)', mid: 'rgba(236, 72, 153, 0.85)', inner: 'rgba(253, 242, 248, 0.98)',
    ember: 'rgba(236, 72, 153, ', floorWash0: 'rgba(236, 72, 153, 0.26)', floorWash1: 'rgba(190, 24, 93, 0.08)'
  }
};

const DUNGEON_THEME_BG = {
  dungeon_crypt: '#080c14',
  dungeon_sunken: '#051412',
  dungeon_obsidian: '#14080a',
  dungeon_glacial: '#04101c',
  dungeon_toxic: '#081406',
  dungeon_infernal: '#170508',
  dungeon_celestial: '#08071c',
  dungeon_dread: '#10061c',
  dungeon_dragon: '#140c04',
  dungeon_oblivion: '#16041a'
};

// Safe default fallbacks for un-prefixed 'dungeon' theme
DUNGEON_THEME_WALLS.dungeon = DUNGEON_THEME_WALLS.dungeon_crypt;
DUNGEON_THEME_TILES.dungeon = DUNGEON_THEME_TILES.dungeon_crypt;
DUNGEON_THEME_TORCH.dungeon = DUNGEON_THEME_TORCH.dungeon_crypt;
DUNGEON_THEME_BG.dungeon = DUNGEON_THEME_BG.dungeon_crypt;

class IsometricRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimapCanvas = document.getElementById('minimapCanvas');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

    this.camera = {
      x: 0,
      y: 0,
      zoom: 1.15, // game.js sets the starting zoom (its MAX_ZOOM)
      targetX: 0,
      targetY: 0,
      shakeOffsetX: 0,
      shakeOffsetY: 0
    };

    this.shake = {
      intensity: 0,
      time: 0,
      duration: 0
    };

    this.animations = {
      time: 0,
      clickMarker: null, // { x, y, life: 1.0 }
      particles: [],
      floatingTexts: [],
      skillEffects: []
    };

    this.attacks = new Map(); // playerId -> { time, duration, class, facing, x, y, side, finisher }
    this.swingCombos = new Map(); // playerId -> { time, count, side } for alternating swings
    this.dashes = new Map();  // playerId -> { time, duration, facing, x, y }
    this.casts = new Map();   // playerId -> { time, duration } (skill cast pose)
    this.flyingProjectiles = new Map(); // id -> { x, y, vx, vy, element, trail }
    this.aoeRings = [];                 // splash rings on projectile impact
    this.cardImpacts = [];              // SP card bolt impacts (drawCardImpacts)
    this.mobSpawns = new Map();         // mobId -> { at, x, y, color } while rising from a summon
    this._ftStacks = new Map();         // spot -> { t, n } for stacking floating texts
    this.spFlashes = new Map();         // playerId -> time of last SP transform

    // Authentic Pixel Art Sprite Assets (Idle, Walk/Run, Attack Slash & Dash)
    this.sprites = {
      swordman: new Image(),
      swordmanIdle: new Image(),
      swordmanAttack: new Image(),
      swordmanDash: new Image(),
      swordmanRunFront: new Image(),
      swordmanRunBack: new Image(),
      // Mage Authentic Pixel Art Sprites
      mageIdle: new Image(),
      mageAttack: new Image(),
      mageDash: new Image(),
      mageRun: new Image(),
      // Rogue Authentic Pixel Art Sprites
      rogueIdle: new Image(),
      rogueAttack: new Image(),
      rogueDash: new Image(),
      rogueRun: new Image()
    };
    this.sprites.swordman.src = 'sprites/swordman_sheet.png';
    this.sprites.swordmanIdle.src = 'sprites/swordman_idle_strip.png';
    this.sprites.swordmanAttack.src = 'sprites/swordman_attack_strip.png';
    this.sprites.swordmanDash.src = 'sprites/swordman_dash_strip.png';
    this.sprites.swordmanRunFront.src = 'sprites/swordman_run_front_strip.png';
    this.sprites.swordmanRunBack.src = 'sprites/swordman_run_back_strip.png';

    this.sprites.mageIdle.src = 'sprites/mage_idle_strip.png';
    this.sprites.mageAttack.src = 'sprites/mage_attack_strip.png';
    this.sprites.mageDash.src = 'sprites/mage_dash_strip.png';
    this.sprites.mageRun.src = 'sprites/mage_run_strip.png';

    this.sprites.rogueIdle.src = 'sprites/rogue_idle_strip.png';
    this.sprites.rogueAttack.src = 'sprites/rogue_attack_strip.png';
    this.sprites.rogueDash.src = 'sprites/rogue_dash_strip.png';
    this.sprites.rogueRun.src = 'sprites/rogue_run_strip.png';

    this.initCanvasSize();
    window.addEventListener('resize', () => this.initCanvasSize());
  }

  // Pixel-Perfect 8-Directional Swordman Turnaround Sprite Configuration (0 to 360 degrees)
  static get SWORDMAN_FRAMES() {
    return {
      S:  { sx: 0,   sy: 0,   sw: 256, sh: 286, anchorX: 129, anchorY: 262, footLX: 94,  footRX: 163, splitY: 228, midX: 129 },
      SE: { sx: 256, sy: 0,   sw: 256, sh: 286, anchorX: 113, anchorY: 261, footLX: 80,  footRX: 158, splitY: 228, midX: 119 },
      E:  { sx: 512, sy: 0,   sw: 256, sh: 286, anchorX: 88,  anchorY: 264, footLX: 87,  footRX: 150, splitY: 228, midX: 118 },
      NE: { sx: 768, sy: 0,   sw: 256, sh: 286, anchorX: 141, anchorY: 261, footLX: 97,  footRX: 170, splitY: 228, midX: 133 },
      N:  { sx: 0,   sy: 286, sw: 256, sh: 286, anchorX: 126, anchorY: 267, footLX: 97,  footRX: 159, splitY: 232, midX: 128 },
      NW: { sx: 256, sy: 286, sw: 256, sh: 286, anchorX: 102, anchorY: 267, footLX: 99,  footRX: 159, splitY: 232, midX: 129 },
      W:  { sx: 512, sy: 286, sw: 256, sh: 286, anchorX: 153, anchorY: 267, footLX: 110, footRX: 156, splitY: 228, midX: 133 },
      SW: { sx: 768, sy: 286, sw: 256, sh: 286, anchorX: 176, anchorY: 267, footLX: 93,  footRX: 177, splitY: 228, midX: 135 }
    };
  }

  // 4-Frame Dynamic Combat Run Dragging Sword (Front & Back Views)
  static get SWORDMAN_RUN_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 320, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 640, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 960, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Dynamic Sword Slash Attack Frames
  static get SWORDMAN_ATTACK_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 320, sh: 286, anchorX: 130, anchorY: 263 },
      { sx: 320, sy: 0, sw: 320, sh: 286, anchorX: 130, anchorY: 263 },
      { sx: 640, sy: 0, sw: 320, sh: 286, anchorX: 130, anchorY: 263 },
      { sx: 960, sy: 0, sw: 320, sh: 286, anchorX: 130, anchorY: 263 }
    ];
  }

  // 4-Frame Supersonic Dash / Blade Charge Frames
  static get SWORDMAN_DASH_FRAMES() {
    return [
      { sx: 0,    sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 360,  sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 720,  sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 1080, sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Living Idle Animation Frames (Breathing, Sway, Blade Gleam)
  static get SWORDMAN_IDLE_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 256, sh: 286, anchorX: 128, anchorY: 263 },
      { sx: 256, sy: 0, sw: 256, sh: 286, anchorX: 128, anchorY: 263 },
      { sx: 512, sy: 0, sw: 256, sh: 286, anchorX: 128, anchorY: 263 },
      { sx: 768, sy: 0, sw: 256, sh: 286, anchorX: 128, anchorY: 263 }
    ];
  }

  // 4-Frame Mage Dynamic Staff Dragging Combat Run Frames
  static get MAGE_RUN_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 320, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 640, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 960, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Mage Arcane Spell Beam / Burst Attack Frames
  static get MAGE_ATTACK_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 320, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 640, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 960, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Mage Arcane Blink / Warp Dash Frames
  static get MAGE_DASH_FRAMES() {
    return [
      { sx: 0,    sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 360,  sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 720,  sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 1080, sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Mage Living Idle Levitation & Breathing Frames
  static get MAGE_IDLE_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 320, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 640, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 960, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Rogue Reverse-Grip Dagger Dragging Ninja Sprint Frames
  static get ROGUE_RUN_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 320, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 640, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 960, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Rogue Dual Dagger Cross Cleave Attack Frames
  static get ROGUE_ATTACK_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 320, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 640, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 960, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Rogue Shadow Dive / Smoke Dash Frames
  static get ROGUE_DASH_FRAMES() {
    return [
      { sx: 0,    sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 360,  sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 720,  sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 1080, sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Rogue Living Stealth Crouch & Dagger Flip Idle Frames
  static get ROGUE_IDLE_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 320, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 640, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 960, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  initCanvasSize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setCameraTarget(worldX, worldY) {
    const iso = Isometric.worldToIso(worldX, worldY);
    this.camera.targetX = iso.x;
    this.camera.targetY = iso.y;
  }

  triggerScreenShake(intensity = 6, duration = 0.16) {
    this.shake.intensity = Math.max(this.shake.intensity, intensity);
    this.shake.duration = duration;
    this.shake.time = duration;
  }

  updateCamera(dt) {
    // Smooth camera lerp
    this.camera.x += (this.camera.targetX - this.camera.x) * 0.12;
    this.camera.y += (this.camera.targetY - this.camera.y) * 0.12;

    // Screen Shake Processing
    if (this.shake.time > 0) {
      this.shake.time -= dt;
      const progress = Math.max(0, this.shake.time / this.shake.duration);
      const curIntensity = Math.min(4.0, this.shake.intensity * 0.32) * progress * progress;
      const st = this.animations.time;
      this.camera.shakeOffsetX = Math.round(Math.sin(st * 44) * curIntensity);
      this.camera.shakeOffsetY = Math.round(Math.cos(st * 36) * curIntensity * 0.65);
    } else {
      this.camera.shakeOffsetX = 0;
      this.camera.shakeOffsetY = 0;
      this.shake.intensity = 0;
    }
  }

  addClickMarker(worldX, worldY) {
    this.animations.clickMarker = { x: worldX, y: worldY, life: 1.0 };
  }

  addFloatingText(worldX, worldY, text, color = '#ffffff', size = 16, isCritExplicit = false) {
    if (!text || worldX === undefined || worldY === undefined || isNaN(worldX) || isNaN(worldY)) return;

    // Hard cap active floating texts: instantly prune oldest if congested to eliminate lag
    if (this.animations.floatingTexts.length >= FLOATING_TEXT_MAX) {
      this.animations.floatingTexts.splice(0, this.animations.floatingTexts.length - FLOATING_TEXT_MAX + 6);
    }

    // Numbers landing on the same spot in quick succession stack upward and
    // alternate sides instead of piling on top of each other
    const now = performance.now();
    const key = Math.round(worldX * 2) + ',' + Math.round(worldY * 2);
    let stack = this._ftStacks.get(key);
    if (!stack || now - stack.t > 90) stack = { n: -1 };
    stack.n = (stack.n + 1) % 3;
    stack.t = now;
    this._ftStacks.set(key, stack);
    if (this._ftStacks.size > 300) {
      for (const [k, s] of this._ftStacks) if (now - s.t > FLOATING_TEXT_STACK_MS) this._ftStacks.delete(k);
    }
    const slot = stack.n;

    const isCrit = !!isCritExplicit || text.includes('CRIT') || text.includes('AMBUSH') || text.includes('EXECUTE') || text.includes('💥') || text.includes('👑') || size >= 24;
    const isHeal = text.includes('+') && text.includes('HP');
    const isMiss = text.toUpperCase().includes('MISS') || text.includes('DEFLECTED');
    const isPlayerDmg = text.startsWith('-');
    const isMonsterDmg = !isPlayerDmg && !isHeal && !isMiss && (/^\d+/.test(text) || color === '#ffea00' || color === '#ffcc00' || color === '#ef4444');

    // Ragnarok Online signature color mapping
    let roColor = color;
    if (isMonsterDmg) {
      // RO yellow by default; the server's colour marks weak / resisted / glancing hits
      roColor = color && color !== '#ffffff' ? color : '#ffea00';
    } else if (isPlayerDmg) {
      roColor = '#ff3333'; // RO player hit is vivid red
    } else if (isCrit) {
      roColor = '#fff740'; // RO crit text
    } else if (isMiss) {
      roColor = '#9ee7ff'; // RO miss is soft cyan
    } else if (isHeal) {
      roColor = '#34d399'; // RO heal is vivid emerald
    }

    // Ragnarok Online bouncy hop physics:
    // Vertical pop upwards, gravity brings it down softly
    const side = slot === 0 ? 0 : (slot % 2 ? 1 : -1);
    const vx = side * 10;
    const vy = isCrit ? -56 : -44;

    this.animations.floatingTexts.push({
      x: worldX,
      y: worldY,
      text,
      color: roColor,
      size: isCrit ? Math.max(size, 20) : size,
      vx,
      vy,
      screenOffsetX: slot ? side * 14 : 0,
      screenOffsetY: -slot * 18,
      gravity: 68,
      drag: 0.92,
      scale: isCrit ? 1.18 : 1.0,
      isCrit,
      isHeal,
      isMiss,
      isPlayerDmg,
      isMonsterDmg,
      life: isCrit ? 1.05 : 0.85,
      maxLife: isCrit ? 1.05 : 0.85
    });
  }

  triggerAttackAnimation(data) {
    if (!data || !data.attackerId) return;

    // Resolve accurate world position fallback if data.x / data.y are missing
    let posX = (data.x !== undefined && !isNaN(data.x)) ? data.x : null;
    let posY = (data.y !== undefined && !isNaN(data.y)) ? data.y : null;
    if (posX === null || posY === null) {
      if (this.lastGameState && this.lastGameState.players) {
        const pl = this.lastGameState.players.find(p => p.id === data.attackerId);
        if (pl && !isNaN(pl.x) && !isNaN(pl.y)) {
          posX = pl.x;
          posY = pl.y;
        }
      }
    }
    if (posX === null || posY === null) {
      posX = this.camera ? (this.camera.targetX || 0) : 0;
      posY = this.camera ? (this.camera.targetY || 0) : 0;
    }

    const isWarrior = data.class === 'warrior';
    const isMage = data.class === 'mage';
    const isRogue = data.class === 'rogue';
    const atkSpeed = Math.max(0.4, data.attackSpeed || 1.0);
    const baseDuration = isWarrior ? 300 : isRogue ? 260 : 320;
    const duration = Math.round(baseDuration / atkSpeed);

    // Swings in quick succession alternate direction; every third is a finisher
    const now = performance.now();
    const prevCombo = this.swingCombos.get(data.attackerId);
    const chained = prevCombo && now - prevCombo.time < duration + SWING_COMBO_WINDOW_MS;
    const combo = { time: now, count: chained ? prevCombo.count + 1 : 1, side: chained ? -prevCombo.side : 1 };
    this.swingCombos.set(data.attackerId, combo);
    const finisher = !isMage && combo.count % 3 === 0;

    const cardId = data.cardId || null;
    this.attacks.set(data.attackerId, {
      time: performance.now(),
      duration: duration,
      class: data.class || 'warrior',
      cardId,
      facing: data.facing || 'SE',
      x: posX,
      y: posY,
      // Locked target position, so 3D heroes can turn to face it exactly
      targetX: data.targetX,
      targetY: data.targetY,
      hasSweep: !!data.hasSweep,
      side: combo.side,
      finisher
    });

    // Camera punchy impact shake!
    if (finisher) this.triggerScreenShake(isWarrior ? 3.5 : 2.5, 0.12);

    // Authentic Class & SP Card Specific Basic Attack Slash & Cast FX
    if (isMage) {
      // SP Card adapted spell sparks
      const p1 = cardId === 'sp_pyromancer' ? 'fire' : cardId === 'sp_cryo_sage' ? 'ice' : cardId === 'sp_void_archon' ? 'shadow' : 'arcane';
      const p2 = cardId === 'sp_tempest' ? 'spark' : cardId === 'sp_chronomancer' ? 'spark' : 'spark';
      this.addParticles(posX, posY, p1, 5, { sizeScale: 0.6, speed: 1.3 });
      this.addParticles(posX, posY, p2, 4, { sizeScale: 0.5, speed: 1.2 });
    } else if (isRogue) {
      const life = finisher ? 0.34 : 0.26;
      this.animations.skillEffects.push({
        type: 'sweeping_edge',
        x: posX,
        y: posY,
        facing: data.facing || 'SE',
        life,
        maxLife: life,
        radius: finisher ? 2.3 : 1.8,
        class: 'rogue',
        cardId,
        side: combo.side,
        finisher
      });
      const pMain = cardId === 'sp_venom_lord' ? 'slash' : cardId === 'sp_frost_shade' ? 'ice' : cardId === 'sp_blade_dancer' ? 'spark' : 'shadow';
      this.addParticles(posX, posY, pMain, finisher ? 10 : 5);
      this.addParticles(posX, posY, 'slash', finisher ? 14 : 8);
    } else {
      // Warrior Heavy Cleave
      const life = finisher ? 0.4 : 0.3;
      this.animations.skillEffects.push({
        type: 'sweeping_edge',
        x: posX,
        y: posY,
        facing: data.facing || 'SE',
        life,
        maxLife: life,
        radius: (data.hasSweep ? 2.6 : 2.2) * (finisher ? 1.3 : 1),
        class: 'warrior',
        cardId,
        side: combo.side,
        finisher
      });
      const pMain = cardId === 'sp_berserker' ? 'fire' : cardId === 'sp_frost_templar' ? 'ice' : cardId === 'sp_dread_lord' ? 'shadow' : 'spark';
      this.addParticles(posX, posY, 'slash', finisher ? 12 : 6);
      this.addParticles(posX, posY, pMain, finisher ? 9 : 5);
    }
  }

  triggerDashAnimation(data) {
    if (!data) return;
    const playerId = typeof data === 'object' ? (data.playerId || data.attackerId) : data;
    if (!playerId) return;
    const duration = (typeof data === 'object' && data.duration) || 320;
    const facing = (typeof data === 'object' && data.facing) || 'SE';
    this.dashes.set(playerId, {
      time: performance.now(),
      duration: duration,
      facing: facing
    });
    this.triggerScreenShake(4, 0.14);
  }

  addProjectile(p) {
    this.flyingProjectiles.set(p.id, { ...p, trail: [], age: 0 });
  }

  explodeProjectile(d) {
    const p = this.flyingProjectiles.get(d.id);
    this.flyingProjectiles.delete(d.id);
    const fx = ELEMENT_FX[d.element || (p && p.element)] || ELEMENT_FX.neutral;
    this.addParticles(d.x, d.y, fx.particle, 14);
    this.addParticles(d.x, d.y, 'spark', 6);
    const cardId = d.cardId || (p && p.cardId);
    if (cardId) this.cardImpacts.push({ cardId, x: d.x, y: d.y, life: 0.4, max: 0.4, seed: Math.random() * 6 });
    if (d.splash) this.aoeRings.push({ x: d.x, y: d.y, r: d.radius || 1.9, life: 0.35, max: 0.35, color: fx.color });
  }

  drawProjectiles(ctx, dt) {
    const z = this.camera.zoom;
    for (const [id, p] of this.flyingProjectiles) {
      p.age += dt;
      if (p.age > 2.2) { this.flyingProjectiles.delete(id); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const sc = Isometric.worldToScreen(p.x, p.y, 0, this.camera, this.canvas.width, this.canvas.height);
      const sx = sc.x, sy = sc.y - PROJECTILE_HEIGHT_PX * z;
      p.trail.unshift({ x: sx, y: sy });
      if (p.trail.length > 9) p.trail.pop();
      const fx = ELEMENT_FX[p.element] || ELEMENT_FX.neutral;
      if (p.cardId && this.drawCardProjectile(ctx, p, sx, sy, z)) {
        if (Math.random() < 0.35) this.addParticles(p.x, p.y, fx.particle, 1, { sizeScale: 0.45, speed: 0.4, z: 0.5 });
        continue;
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // fading trail
      p.trail.forEach((pt, i) => {
        const k = 1 - i / p.trail.length;
        ctx.fillStyle = hexAlpha(fx.color, 0.45 * k);
        const r = (2 + 5 * k) * z;
        ctx.fillRect(Math.round(pt.x - r / 2), Math.round(pt.y - r / 2), Math.round(r), Math.round(r));
      });
      // glowing core
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 12 * z);
      glow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      glow.addColorStop(0.35, hexAlpha(fx.color, 0.85));
      glow.addColorStop(1, hexAlpha(fx.color, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(sx - 12 * z, sy - 12 * z, 24 * z, 24 * z);
      ctx.restore();
      // crisp pixel core with a spinning sparkle
      ctx.save();
      ctx.fillStyle = '#ffffff';
      const c = Math.max(2, Math.round(4 * z));
      ctx.fillRect(Math.round(sx - c / 2), Math.round(sy - c / 2), c, c);
      ctx.translate(sx, sy);
      ctx.rotate(p.age * 9);
      ctx.fillStyle = fx.color;
      ctx.fillRect(-7 * z, -0.75 * z, 14 * z, 1.5 * z);
      ctx.fillRect(-0.75 * z, -7 * z, 1.5 * z, 14 * z);
      ctx.restore();
      if (Math.random() < 0.35) this.addParticles(p.x, p.y, fx.particle, 1, { sizeScale: 0.45, speed: 0.4, z: 0.5 });
    }

    this.drawCardImpacts(ctx, dt);

    // splash rings
    for (let i = this.aoeRings.length - 1; i >= 0; i--) {
      const ring = this.aoeRings[i];
      ring.life -= dt;
      if (ring.life <= 0) { this.aoeRings.splice(i, 1); continue; }
      const k = 1 - ring.life / ring.max;
      const c0 = Isometric.worldToScreen(ring.x, ring.y, 0, this.camera, this.canvas.width, this.canvas.height);
      const c1 = Isometric.worldToScreen(ring.x + ring.r, ring.y - ring.r, 0, this.camera, this.canvas.width, this.canvas.height);
      const rx = Math.abs(c1.x - c0.x) * (0.35 + 0.65 * k);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexAlpha(ring.color, 0.9 * (1 - k));
      ctx.lineWidth = 3 * z;
      ctx.beginPath();
      ctx.ellipse(c0.x, c0.y, rx, rx / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = hexAlpha(ring.color, 0.18 * (1 - k));
      ctx.fill();
      ctx.restore();
    }
  }

  // Dungeon room opened: a summoning circle + burst under each new monster
  triggerMobSpawn(list) {
    const now = performance.now();
    for (const m of list) {
      const fx = ELEMENT_FX[m.element] || ELEMENT_FX.dark;
      const color = m.isBoss ? '#ef4444' : fx.color;
      this.mobSpawns.set(m.id, { at: now, x: m.x, y: m.y, color, boss: m.isBoss });
      this.addParticles(m.x, m.y, fx.particle, m.isBoss ? 30 : 10, { sizeScale: 0.7 });
      this.aoeRings.push({ x: m.x, y: m.y, r: m.isBoss ? 3.4 : 1.6, life: 0.6, max: 0.6, color });
    }
    if (list.some(m => m.isBoss)) this.triggerScreenShake(8, 0.4);
  }

  // 0..1 rise progress of a summoned mob (1 = fully arrived / not summoned)
  mobSpawnProgress(id) {
    const s = this.mobSpawns.get(id);
    if (!s) return 1;
    const k = (performance.now() - s.at) / MOB_SPAWN_MS;
    if (k >= 1.6) { this.mobSpawns.delete(id); return 1; }
    return Math.max(0, Math.min(1, k));
  }

  // Glowing runic circles under monsters still rising (drawn on the ground layer)
  drawMobSpawnCircles(ctx) {
    const now = performance.now();
    const z = this.camera.zoom;
    for (const s of this.mobSpawns.values()) {
      const k = (now - s.at) / MOB_SPAWN_MS;
      if (k >= 1.6) continue;
      const fade = k < 1 ? 1 : 1 - (k - 1) / 0.6;
      const grow = Math.min(1, k * 2.5);
      const c = Isometric.worldToScreen(s.x, s.y, 0, this.camera, this.canvas.width, this.canvas.height);
      const r = (s.boss ? 46 : 22) * z * grow;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(c.x, c.y);
      ctx.scale(1, 0.5);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, hexAlpha(s.color, 0.55 * fade));
      g.addColorStop(1, hexAlpha(s.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2 * z;
      ctx.strokeStyle = hexAlpha(s.color, 0.9 * fade);
      ctx.rotate(k * 3);
      ctx.setLineDash([5 * z, 4 * z]);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // inscribed star
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) {
        const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const px = Math.cos(a) * r * 0.62, py = Math.sin(a) * r * 0.62;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
      // light column while the monster rises
      if (k < 1) {
        const h = 70 * z * (1 - k);
        const col = ctx.createLinearGradient(0, c.y, 0, c.y - h);
        col.addColorStop(0, hexAlpha(s.color, 0.5 * (1 - k)));
        col.addColorStop(1, hexAlpha(s.color, 0));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = col;
        ctx.fillRect(c.x - r * 0.45, c.y - h, r * 0.9, h);
        ctx.restore();
      }
    }
  }

  triggerSpTransform(data) {
    if (!data) return;
    this.spFlashes.set(data.playerId, performance.now());
    const card = this.spCardDef(data.cardId);
    const fx = ELEMENT_FX[card && card.element] || ELEMENT_FX.neutral;
    this.addParticles(data.x, data.y, fx.particle, data.on ? 18 : 8, { sizeScale: 0.6 });
    this.addParticles(data.x, data.y, 'spark', data.on ? 10 : 4, { sizeScale: 0.6 });
    if (data.on && !data.refresh) this.triggerScreenShake(5, 0.2);
  }

  spCardDef(cardId) {
    const cat = window.SP_CATALOG;
    if (!cat || !cardId) return null;
    for (const list of Object.values(cat.cards)) {
      const c = list.find(x => x.id === cardId);
      if (c) return c;
    }
    return null;
  }

  // The SP card a hero is currently transformed with (null when not transformed)
  spCardFor(player) {
    if (!player.spTransformed) return null;
    return this.spCardDef(player.spCardId || (player.equipment && player.equipment.sp && player.equipment.sp.cardId));
  }

  // Sprite frame for a hero, wearing their SP card costume when transformed
  heroFrameFor(player, view, action, idx) {
    const PH = window.PixelHeroes;
    const cls = PH.classes.includes(player.characterClass) ? player.characterClass : 'warrior';
    const card = this.spCardFor(player);
    if (card) return PH.variantFrame(cls, card.id, card.palette, view, action, idx);
    return PH.frame(cls, view, action, idx);
  }

  // SP aura: grows with the card's +level. 'back' draws under the hero,
  // 'front' spawns particles over it.
  drawSpAura(ctx, player, x, y, z, t, layer) {
    const flashAt = this.spFlashes.get(player.id);
    const flashAge = flashAt ? (performance.now() - flashAt) / SP_FLASH_MS : 1;
    if (layer === 'back' && flashAge < 1) {
      const g = ctx.createLinearGradient(0, y, 0, y - 120 * z);
      g.addColorStop(0, `rgba(255, 255, 255, ${0.6 * (1 - flashAge)})`);
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(x - 22 * z, y - 120 * z, 44 * z, 120 * z);
      ctx.restore();
    }
    if (!player.spTransformed || player.isDead) return;
    const card = this.spCardDef(player.spCardId || (player.equipment && player.equipment.sp && player.equipment.sp.cardId));
    if (!card) return;
    const lvl = player.spLevel || 0;
    const fx = ELEMENT_FX[card.element] || ELEMENT_FX.neutral;
    const color = card.color || fx.color;

    if (layer === 'back') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.85 + 0.15 * Math.sin(t * 3);
      const r = (16 + Math.min(lvl, 10) * 1.4) * z * pulse;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, hexAlpha(color, 0.22 + lvl * 0.03));
      g.addColorStop(1, hexAlpha(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (lvl >= 7) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, 0.5);
        ctx.lineWidth = 2 * z;
        ctx.strokeStyle = hexAlpha(color, 0.8);
        ctx.setLineDash([6 * z, 4 * z]);
        ctx.rotate(t * 0.9);
        ctx.beginPath();
        ctx.arc(0, 0, 22 * z, 0, Math.PI * 2);
        ctx.stroke();
        ctx.rotate(-t * 1.8);
        ctx.setLineDash([2 * z, 5 * z]);
        ctx.beginPath();
        ctx.arc(0, 0, 15 * z, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (lvl >= 10) {
        const pg = ctx.createLinearGradient(0, y, 0, y - 110 * z);
        pg.addColorStop(0, hexAlpha(color, 0.38 * pulse));
        pg.addColorStop(1, hexAlpha(color, 0));
        ctx.fillStyle = pg;
        ctx.fillRect(x - 14 * z, y - 110 * z, 28 * z, 110 * z);
      }
      ctx.restore();
    } else {
      // Gentle trickle of element particles; denser (not bigger) with level
      const rate = 0.02 + lvl * 0.012;
      if (Math.random() < rate) {
        this.addParticles(player.x + (Math.random() - 0.5) * 0.8, player.y + (Math.random() - 0.5) * 0.8, fx.particle, 1,
          { sizeScale: 0.3 + lvl * 0.012, speed: 0.35, vz: 0.5 + Math.random() * 0.6 });
      }
      if (lvl >= 4 && Math.random() < 0.012 * (lvl - 3)) {
        this.addParticles(player.x, player.y, 'spark', 1, { sizeScale: 0.3, speed: 0.6, vz: 1.0 });
      }
    }
  }

  // Sealed doorway in a dungeon: a glowing barrier across the gap
  drawDungeonDoor(ctx, obs, z) {
    const half = 1.5;
    const a = obs.axis === 'x' ? [obs.x, obs.y - half] : [obs.x - half, obs.y];
    const b = obs.axis === 'x' ? [obs.x, obs.y + half] : [obs.x + half, obs.y];
    const p1 = Isometric.worldToScreen(a[0], a[1], 0, this.camera, this.canvas.width, this.canvas.height);
    const p2 = Isometric.worldToScreen(b[0], b[1], 0, this.camera, this.canvas.width, this.canvas.height);
    const h = 46 * z;
    const gs = this.lastGameState;
    const color = obs.boss ? '#ef4444' : (gs && gs.map && gs.map.color ? gs.map.color : '#facc15');
    const t = this.animations.time;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, p1.y, 0, p1.y - h);
    g.addColorStop(0, hexAlpha(color, 0.5 + 0.15 * Math.sin(t * 4)));
    g.addColorStop(1, hexAlpha(color, 0.05));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p2.x, p2.y - h);
    ctx.lineTo(p1.x, p1.y - h);
    ctx.closePath();
    ctx.fill();
    // iron bars
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(26, 28, 44, 0.85)';
    ctx.lineWidth = 2.5 * z;
    for (let i = 0; i <= 6; i++) {
      const k = i / 6;
      const bx = p1.x + (p2.x - p1.x) * k, by = p1.y + (p2.y - p1.y) * k;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx, by - h);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y - h);
    ctx.lineTo(p2.x, p2.y - h);
    ctx.stroke();
    // lock / skull emblem
    if (window.PixelIcons) {
      const size = Math.round(12 * Math.max(2, Math.round(z * 2)));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(PixelIcons.image(obs.boss ? 'skull' : 'lock'), Math.round((p1.x + p2.x) / 2 - size / 2), Math.round((p1.y + p2.y) / 2 - h * 0.55 - size / 2), size, size);
    }
    ctx.restore();
  }

  addSkillEffect(fx) {
    if (!fx || !fx.type) return;
    // Casting a non-movement skill plays the hero's cast pose
    const isSpMove = fx.type === 'sp_skill' && (fx.shape === 'dash' || fx.shape === 'blink' || fx.shape === 'rewind');
    if (fx.playerId && !PIXEL_HERO_DASH_SKILLS.has(fx.type) && !isSpMove) {
      this.casts.set(fx.playerId, { time: performance.now(), duration: 520 });
    }

    const skillLifetimes = {
      firestorm: 1.0,
      earthshaker: 0.9,
      whirlwind: 0.85,
      frost_nova: 0.8,
      black_hole: 1.25,
      blizzard: 1.25,
      toxic_bomb: 1.15,
      colossus_strike: 0.85,
      death_blossom: 0.85,
      chain_lightning: 0.55,
      blade_charge: 0.45,
      arcane_blink: 0.5,
      shadow_dash: 0.45,
      shadowstep: 0.45,
      shadow_strike: 0.45,
      shield_slam: 0.4,
      blood_rage: 1.1,
      iron_fortress: 1.1,
      war_stomp: 0.75,
      mana_shield: 1.1,
      pyroblast: 0.75,
      smoke_screen: 1.2,
      poison_darts: 0.5,
      caltrops: 1.2,
      dragon_roar: 1.2,
      meteor_dive: 0.9,
      bladestorm_frenzy: 1.25,
      titan_bastion: 1.2,
      sundering_cleave: 0.8,
      ragnarok_slash: 1.35,
      thunder_storm: 1.1,
      glacial_comet: 1.05,
      arcane_hyperbeam: 0.85,
      time_dilation: 1.3,
      supernova_blast: 1.15,
      genesis_cataclysm: 1.4,
      venomous_barrage: 0.75,
      phantom_assassins: 0.95,
      assassins_cull: 0.65,
      abyssal_tether: 1.15,
      blade_dance: 1.1,
      eclipse_execution: 1.45
    };

    const maxLife = fx.type !== 'sp_skill' ? (skillLifetimes[fx.type] || 0.65)
      : fx.shape === 'field' ? (fx.duration || 2) : (SP_SKILL_LIFE[fx.skillId] || SP_SHAPE_LIFE[fx.shape] || 0.65);
    const effect = {
      ...fx,
      life: maxLife,
      maxLife: maxLife,
      emitTimer: 0
    };
    this.animations.skillEffects.push(effect);

    // Elemental Rune Particle Burst!
    if (fx.rune && fx.rune !== 'none') {
      const rx = fx.x !== undefined ? fx.x : (fx.startX !== undefined ? fx.startX : 0);
      const ry = fx.y !== undefined ? fx.y : (fx.startY !== undefined ? fx.startY : 0);
      if (fx.rune === 'flame') {
        this.addParticles(rx, ry, 'fire', 32);
        this.addParticles(rx, ry, 'spark', 20);
      } else if (fx.rune === 'frost') {
        this.addParticles(rx, ry, 'ice', 32);
        this.addParticles(rx, ry, 'spark', 16);
      } else if (fx.rune === 'tempest') {
        this.addParticles(rx, ry, 'lightning', 28);
        this.addParticles(rx, ry, 'arcane', 24);
      } else if (fx.rune === 'vampiric') {
        this.addParticles(rx, ry, 'shadow', 32);
        this.addParticles(rx, ry, 'slash', 20);
      }
    }

    if (fx.type === 'sp_skill') {
      this.spSkillBurst(fx, isSpMove);
    } else if (fx.type === 'whirlwind') {
      const wr = fx.radius || 3.2;
      for (let k = 0; k < 18; k++) {
        const theta = (k / 18) * Math.PI * 2 + Math.random() * 0.2;
        const px = fx.x + Math.cos(theta) * wr * 0.8;
        const py = fx.y + Math.sin(theta) * wr * 0.8;
        // tangent of the spin (screen-clockwise == increasing world angle)
        this.addParticles(px, py, 'wind', 1, { speed: 3.2, angle: theta + Math.PI * 0.5, spread: 0.25, z: 0.3 });
        this.addParticles(px, py, 'slash', 1, { speed: 3.6, angle: theta + Math.PI * 0.45, spread: 0.3, z: 0.4 });
      }
      // ground kick-up ring at the hero's feet
      for (let k = 0; k < 12; k++) {
        const theta = (k / 12) * Math.PI * 2;
        this.addParticles(fx.x + Math.cos(theta) * 0.5, fx.y + Math.sin(theta) * 0.5, 'dust', 1, { speed: 1.6, angle: theta, spread: 0.3, sizeScale: 1.4 });
      }
      this.triggerScreenShake(6, 0.18);
    } else if (fx.type === 'firestorm') {
      this.addParticles(fx.x, fx.y, 'fire', 65);
      this.addParticles(fx.x, fx.y, 'spark', 42);
      this.addParticles(fx.x, fx.y, 'dust', 22);
      this.triggerScreenShake(11, 0.26);
    } else if (fx.type === 'blade_charge') {
      if (fx.playerId) this.triggerDashAnimation({ playerId: fx.playerId, duration: 350, facing: fx.facing });
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'slash', 32);
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'wind', 24);
      this.addParticles(fx.x, fx.y, 'spark', 36);
      this.addParticles(fx.x, fx.y, 'slash', 28);
      this.triggerScreenShake(9, 0.22);
    } else if (fx.type === 'earthshaker') {
      this.addParticles(fx.x, fx.y, 'earth', 55);
      this.addParticles(fx.x, fx.y, 'spark', 38);
      this.addParticles(fx.x, fx.y, 'dust', 45);
      this.triggerScreenShake(16, 0.32);
    } else if (fx.type === 'frost_nova') {
      this.addParticles(fx.x, fx.y, 'ice', 60);
      this.addParticles(fx.x, fx.y, 'arcane', 40);
      this.addParticles(fx.x, fx.y, 'spark', 24);
      this.triggerScreenShake(7, 0.18);
    } else if (fx.type === 'arcane_blink') {
      if (fx.playerId) this.triggerDashAnimation({ playerId: fx.playerId, duration: 300, facing: fx.facing });
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'arcane', 40);
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'spark', 20);
      this.addParticles(fx.x, fx.y, 'arcane', 45);
      this.addParticles(fx.x, fx.y, 'spark', 26);
      this.triggerScreenShake(6, 0.16);
    } else if (fx.type === 'fan_of_knives') {
      this.addParticles(fx.x, fx.y, 'slash', 48);
      this.addParticles(fx.x, fx.y, 'poison', 36);
      this.addParticles(fx.x, fx.y, 'spark', 24);
      this.triggerScreenShake(8, 0.20);
    } else if (fx.type === 'toxic_bomb') {
      this.addParticles(fx.x, fx.y, 'poison', 60);
      this.addParticles(fx.x, fx.y, 'shadow', 32);
      this.addParticles(fx.x, fx.y, 'dust', 20);
      this.triggerScreenShake(7, 0.18);
    } else if (fx.type === 'shadow_dash') {
      if (fx.playerId) this.triggerDashAnimation({ playerId: fx.playerId, duration: 320, facing: fx.facing });
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'shadow', 40);
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'slash', 22);
      this.addParticles(fx.x, fx.y, 'shadow', 40);
      this.addParticles(fx.x, fx.y, 'poison', 20);
      this.triggerScreenShake(7, 0.16);
    } else if (fx.type === 'shadow_strike') {
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'shadow', 36);
      this.addParticles(fx.x, fx.y, 'slash', 38);
      this.addParticles(fx.x, fx.y, 'shadow', 36);
      this.triggerScreenShake(9, 0.20);
    } else if (fx.type === 'colossus_strike') {
      this.addParticles(fx.x, fx.y, 'earth', 65);
      this.addParticles(fx.x, fx.y, 'spark', 50);
      this.addParticles(fx.x, fx.y, 'slash', 45);
      this.addParticles(fx.x, fx.y, 'dust', 40);
      this.triggerScreenShake(18, 0.35);
    } else if (fx.type === 'shield_slam') {
      this.addParticles(fx.x, fx.y, 'spark', 40);
      this.addParticles(fx.x, fx.y, 'wind', 32);
      this.addParticles(fx.x, fx.y, 'dust', 22);
      this.triggerScreenShake(9, 0.20);
    } else if (fx.type === 'blood_rage') {
      this.addParticles(fx.x, fx.y, 'fire', 55);
      this.addParticles(fx.x, fx.y, 'spark', 35);
      this.addParticles(fx.x, fx.y, 'shadow', 24);
      this.triggerScreenShake(7, 0.18);
    } else if (fx.type === 'iron_fortress') {
      this.addParticles(fx.x, fx.y, 'earth', 35);
      this.addParticles(fx.x, fx.y, 'spark', 35);
      this.addParticles(fx.x, fx.y, 'wind', 25);
      this.triggerScreenShake(6, 0.15);
    } else if (fx.type === 'war_stomp') {
      this.addParticles(fx.x, fx.y, 'earth', 55);
      this.addParticles(fx.x, fx.y, 'wind', 40);
      this.addParticles(fx.x, fx.y, 'spark', 35);
      this.addParticles(fx.x, fx.y, 'dust', 45);
      this.triggerScreenShake(13, 0.26);
    } else if (fx.type === 'chain_lightning') {
      if (fx.points) {
        fx.points.forEach(pt => {
          this.addParticles(pt.x, pt.y, 'lightning', 30);
          this.addParticles(pt.x, pt.y, 'spark', 22);
        });
      }
      this.triggerScreenShake(8, 0.22);
    } else if (fx.type === 'mana_shield') {
      this.addParticles(fx.x, fx.y, 'arcane', 45);
      this.addParticles(fx.x, fx.y, 'spark', 24);
    } else if (fx.type === 'black_hole') {
      this.addParticles(fx.x, fx.y, 'shadow', 65);
      this.addParticles(fx.x, fx.y, 'arcane', 55);
      this.addParticles(fx.x, fx.y, 'spark', 30);
      this.triggerScreenShake(15, 0.32);
    } else if (fx.type === 'blizzard') {
      this.addParticles(fx.x, fx.y, 'ice', 65);
      this.addParticles(fx.x, fx.y, 'wind', 35);
      this.addParticles(fx.x, fx.y, 'spark', 20);
      this.triggerScreenShake(8, 0.22);
    } else if (fx.type === 'pyroblast') {
      this.addParticles(fx.x, fx.y, 'fire', 65);
      this.addParticles(fx.x, fx.y, 'spark', 45);
      this.addParticles(fx.x, fx.y, 'dust', 25);
      this.triggerScreenShake(12, 0.28);
    } else if (fx.type === 'shadowstep') {
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'shadow', 36);
      this.addParticles(fx.x, fx.y, 'shadow', 45);
      this.addParticles(fx.x, fx.y, 'slash', 24);
      this.triggerScreenShake(8, 0.18);
    } else if (fx.type === 'smoke_screen') {
      this.addParticles(fx.x, fx.y, 'shadow', 55);
      this.addParticles(fx.x, fx.y, 'poison', 35);
      this.addParticles(fx.x, fx.y, 'dust', 30);
    } else if (fx.type === 'death_blossom') {
      this.addParticles(fx.x, fx.y, 'slash', 55);
      this.addParticles(fx.x, fx.y, 'shadow', 45);
      this.addParticles(fx.x, fx.y, 'poison', 28);
      this.triggerScreenShake(13, 0.28);
    } else if (fx.type === 'poison_darts') {
      this.addParticles(fx.x, fx.y, 'poison', 40);
      this.addParticles(fx.x, fx.y, 'slash', 24);
      this.triggerScreenShake(6, 0.14);
    } else if (fx.type === 'caltrops') {
      this.addParticles(fx.x, fx.y, 'earth', 30);
      this.addParticles(fx.x, fx.y, 'spark', 24);
    } else if (fx.type === 'dragon_roar') {
      this.addParticles(fx.x, fx.y, 'fire', 60);
      this.addParticles(fx.x, fx.y, 'spark', 40);
      this.addParticles(fx.x, fx.y, 'dust', 30);
      this.triggerScreenShake(14, 0.28);
    } else if (fx.type === 'meteor_dive') {
      this.addParticles(fx.x, fx.y, 'fire', 80);
      this.addParticles(fx.x, fx.y, 'earth', 45);
      this.addParticles(fx.x, fx.y, 'spark', 50);
      this.addParticles(fx.x, fx.y, 'dust', 40);
      this.triggerScreenShake(18, 0.35);
    } else if (fx.type === 'bladestorm_frenzy') {
      this.addParticles(fx.x, fx.y, 'wind', 70);
      this.addParticles(fx.x, fx.y, 'slash', 50);
      this.addParticles(fx.x, fx.y, 'spark', 35);
      this.triggerScreenShake(12, 0.25);
    } else if (fx.type === 'titan_bastion') {
      this.addParticles(fx.x, fx.y, 'spark', 50);
      this.addParticles(fx.x, fx.y, 'gold', 35);
      this.addParticles(fx.x, fx.y, 'arcane', 30);
      this.triggerScreenShake(10, 0.20);
    } else if (fx.type === 'sundering_cleave') {
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'earth', 45);
      this.addParticles(fx.x, fx.y, 'earth', 65);
      this.addParticles(fx.x, fx.y, 'spark', 40);
      this.addParticles(fx.x, fx.y, 'slash', 35);
      this.triggerScreenShake(16, 0.32);
    } else if (fx.type === 'ragnarok_slash') {
      this.addParticles(fx.x, fx.y, 'slash', 90);
      this.addParticles(fx.x, fx.y, 'gold', 60);
      this.addParticles(fx.x, fx.y, 'spark', 65);
      this.addParticles(fx.x, fx.y, 'lightning', 45);
      this.triggerScreenShake(22, 0.45);
    } else if (fx.type === 'thunder_storm') {
      this.addParticles(fx.x, fx.y, 'lightning', 65);
      this.addParticles(fx.x, fx.y, 'arcane', 45);
      this.addParticles(fx.x, fx.y, 'spark', 40);
      this.triggerScreenShake(14, 0.28);
    } else if (fx.type === 'glacial_comet') {
      this.addParticles(fx.x, fx.y, 'ice', 75);
      this.addParticles(fx.x, fx.y, 'arcane', 45);
      this.addParticles(fx.x, fx.y, 'spark', 35);
      this.addParticles(fx.x, fx.y, 'dust', 30);
      this.triggerScreenShake(17, 0.34);
    } else if (fx.type === 'arcane_hyperbeam') {
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'arcane', 40);
      this.addParticles(fx.x, fx.y, 'arcane', 60);
      this.addParticles(fx.x, fx.y, 'spark', 45);
      this.addParticles(fx.x, fx.y, 'lightning', 30);
      this.triggerScreenShake(12, 0.26);
    } else if (fx.type === 'time_dilation') {
      this.addParticles(fx.x, fx.y, 'arcane', 55);
      this.addParticles(fx.x, fx.y, 'ice', 35);
      this.addParticles(fx.x, fx.y, 'spark', 30);
      this.triggerScreenShake(8, 0.18);
    } else if (fx.type === 'supernova_blast') {
      this.addParticles(fx.x, fx.y, 'fire', 90);
      this.addParticles(fx.x, fx.y, 'spark', 70);
      this.addParticles(fx.x, fx.y, 'arcane', 50);
      this.addParticles(fx.x, fx.y, 'dust', 35);
      this.triggerScreenShake(20, 0.40);
    } else if (fx.type === 'genesis_cataclysm') {
      this.addParticles(fx.x, fx.y, 'arcane', 95);
      this.addParticles(fx.x, fx.y, 'spark', 80);
      this.addParticles(fx.x, fx.y, 'fire', 55);
      this.addParticles(fx.x, fx.y, 'lightning', 50);
      this.triggerScreenShake(24, 0.50);
    } else if (fx.type === 'venomous_barrage') {
      this.addParticles(fx.x, fx.y, 'poison', 55);
      this.addParticles(fx.x, fx.y, 'slash', 35);
      this.addParticles(fx.x, fx.y, 'spark', 25);
      this.triggerScreenShake(8, 0.18);
    } else if (fx.type === 'phantom_assassins') {
      this.addParticles(fx.x, fx.y, 'shadow', 60);
      this.addParticles(fx.x, fx.y, 'slash', 45);
      this.addParticles(fx.x, fx.y, 'arcane', 30);
      this.triggerScreenShake(10, 0.22);
    } else if (fx.type === 'assassins_cull') {
      this.addParticles(fx.x, fx.y, 'slash', 65);
      this.addParticles(fx.x, fx.y, 'shadow', 40);
      this.addParticles(fx.x, fx.y, 'spark', 35);
      this.triggerScreenShake(14, 0.26);
    } else if (fx.type === 'abyssal_tether') {
      this.addParticles(fx.x, fx.y, 'shadow', 65);
      this.addParticles(fx.x, fx.y, 'poison', 40);
      this.addParticles(fx.x, fx.y, 'arcane', 35);
      this.triggerScreenShake(10, 0.20);
    } else if (fx.type === 'blade_dance') {
      this.addParticles(fx.x, fx.y, 'slash', 75);
      this.addParticles(fx.x, fx.y, 'shadow', 50);
      this.addParticles(fx.x, fx.y, 'spark', 35);
      this.triggerScreenShake(12, 0.25);
    } else if (fx.type === 'eclipse_execution') {
      this.addParticles(fx.x, fx.y, 'shadow', 100);
      this.addParticles(fx.x, fx.y, 'slash', 85);
      this.addParticles(fx.x, fx.y, 'arcane', 60);
      this.addParticles(fx.x, fx.y, 'spark', 50);
      this.triggerScreenShake(22, 0.45);
    }
  }

  // Continuous Dynamic Multi-Wave Particle Emitter for Active Skills
  // ---------------------------------------------------------------- tinted drawing
  // ctx.filter on the main canvas makes the browser run the filter for every
  // single shape drawn while it is set. Instead `draw(c)` (which paints in screen
  // coordinates) goes to a small offscreen canvas and the filter runs once, on
  // the finished picture. box = { halfW, up, down } around the anchor (ax, ay).
  // With a cacheKey the tinted picture is kept until the zoom changes, or for
  // maxAgeMs when that is set (animated props: a little choppy, much cheaper).
  drawTinted(ctx, filter, ax, ay, box, draw, cacheKey = null, maxAgeMs = 0) {
    const w = Math.max(1, Math.ceil(box.halfW * 2));
    const h = Math.max(1, Math.ceil(box.up + box.down));
    const left = Math.round(ax - box.halfW), top = Math.round(ay - box.up);
    if (cacheKey) {
      if (!this._tintCache) this._tintCache = new WeakMap();
      const z = this.camera.zoom;
      let cached = this._tintCache.get(cacheKey);
      const now = performance.now();
      if (!cached || cached.zoom !== z || cached.filter !== filter || (maxAgeMs && now > cached.expires)) {
        const raw = document.createElement('canvas');
        raw.width = w; raw.height = h;
        const rc = raw.getContext('2d');
        rc.setTransform(1, 0, 0, 1, -left, -top);
        draw(rc);
        const tinted = document.createElement('canvas');
        tinted.width = w; tinted.height = h;
        const tc = tinted.getContext('2d');
        tc.filter = filter;
        tc.drawImage(raw, 0, 0);
        // jittered expiry so animated props don't all redraw on the same frame
        cached = { zoom: z, filter, canvas: tinted, expires: now + maxAgeMs * (0.75 + Math.random() * 0.5) };
        this._tintCache.set(cacheKey, cached);
      }
      ctx.drawImage(cached.canvas, left, top);
      return;
    }
    if (!this._tintScratch) this._tintScratch = document.createElement('canvas');
    const sc = this._tintScratch;
    if (sc.width < w || sc.height < h) {
      sc.width = Math.max(sc.width, w);
      sc.height = Math.max(sc.height, h);
    }
    const c = sc.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, sc.width, sc.height);
    c.setTransform(1, 0, 0, 1, -left, -top);
    draw(c);
    ctx.save();
    ctx.filter = filter;
    ctx.drawImage(sc, 0, 0, w, h, left, top, w, h);
    ctx.restore();
  }

  // ---------------------------------------------------------------- SP card skills
  // One-off particle burst + screen shake when an SP skill fires
  spSkillBurst(fx, isMove) {
    const [main, accent] = SP_CARD_PARTICLES[fx.cardId] || SP_ELEMENT_PARTICLES[fx.element] || SP_ELEMENT_PARTICLES.neutral;
    const first = !!fx.playerId;
    if (isMove) {
      if (first) this.triggerDashAnimation({ playerId: fx.playerId, duration: fx.shape === 'blink' ? 300 : 340, facing: fx.facing });
      this.addParticles(fx.startX, fx.startY, main, 30);
      this.addParticles(fx.x, fx.y, main, 30);
      this.addParticles(fx.x, fx.y, accent, 18);
      this.triggerScreenShake(7, 0.16);
      return;
    }
    if (fx.points) {
      for (const pt of fx.points) {
        this.addParticles(pt.x, pt.y, main, 14);
        this.addParticles(pt.x, pt.y, accent, 8);
      }
      this.triggerScreenShake(6, 0.15);
      return;
    }
    if (fx.shape === 'line') {
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        this.addParticles(fx.startX + (fx.x - fx.startX) * t, fx.startY + (fx.y - fx.startY) * t, main, 4);
      }
      this.triggerScreenShake(9, 0.2);
      return;
    }
    const big = (fx.radius || 1) >= 3;
    this.addParticles(fx.x, fx.y, main, big ? 50 : 24);
    this.addParticles(fx.x, fx.y, accent, big ? 30 : 14);
    if (first || fx.shape === 'rain') this.triggerScreenShake(big ? 12 : 6, big ? 0.26 : 0.15);
  }

  // Ground ring of world radius r around (cx, cy), traced in screen space
  spGroundPath(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let k = 0; k <= 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      const pt = Isometric.worldToScreen(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0, this.camera, this.canvas.width, this.canvas.height);
      if (k === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
  }

  // ---------------------------------------------------------------- Rogue SP card skill visuals
  drawRogueSkill(ctx, fx, progress, alpha, toScreen, z) {
    switch (fx.cardId) {
      case 'sp_nightblade': return this.drawNightbladeSkill(ctx, fx, progress, toScreen, z);
      case 'sp_venom_lord': return this.drawVenomLordSkill(ctx, fx, progress, toScreen, z);
      case 'sp_blade_dancer': return this.drawBladeDancerSkill(ctx, fx, progress, toScreen, z);
      case 'sp_frost_shade': return this.drawFrostShadeSkill(ctx, fx, progress, toScreen, z);
      case 'sp_eclipse_reaper': return this.drawEclipseReaperSkill(ctx, fx, progress, toScreen, z);
    }
    return false;
  }

  // Shared drawing helpers for SP card visuals, coloured by one palette.
  // Dark shapes are drawn with source-over because black adds nothing under
  // 'lighter'; the glows go on top additively.
  spFxKit(ctx, progress, toScreen, z, pal) {
    const time = this.animations.time;
    const TAU = Math.PI * 2;
    const U = 32 * Math.SQRT2 * z; // screen px per world tile (long axis of a ground circle)
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const seg = (a, b) => clamp01((progress - a) / (b - a)); // 0..1 across [a, b] of the effect's life
    const out3 = (t) => 1 - Math.pow(1 - t, 3);
    const fade = progress < 0.6 ? 1 : clamp01(1 - (progress - 0.6) / 0.4);
    const c = (rgb, a) => `rgba(${rgb}, ${clamp01(a)})`;
    const rnd = (n) => {
      const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return s - Math.floor(s);
    };

    const shade = (fn) => {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      fn();
      ctx.restore();
    };
    const oval = (p, rPx) => {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, Math.max(0.1, rPx), Math.max(0.1, rPx) * 0.5, 0, 0, TAU);
    };
    const ring = (p, rPx, rgb, a, w) => {
      if (a <= 0.01 || rPx <= 0.5) return;
      oval(p, rPx);
      ctx.strokeStyle = c(rgb, a);
      ctx.lineWidth = w * z;
      ctx.stroke();
    };
    // dark stain on the ground
    const pool = (p, rPx, a) => {
      if (a <= 0.01 || rPx <= 0.5) return;
      shade(() => {
        ctx.translate(p.x, p.y);
        ctx.scale(1, 0.5);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rPx);
        g.addColorStop(0, `rgba(${pal.deep}, ${a})`);
        g.addColorStop(0.7, `rgba(${pal.deep2}, ${a * 0.7})`);
        g.addColorStop(1, `rgba(${pal.deep2}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, rPx, 0, TAU);
        ctx.fill();
      });
    };
    // soft dark cloud of smoke or gas
    const puff = (p, rPx, a) => {
      if (a <= 0.01 || rPx <= 0.5) return;
      shade(() => {
        ctx.translate(p.x, p.y);
        ctx.scale(1, 0.75);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rPx);
        g.addColorStop(0, `rgba(${pal.deep2}, ${a * 0.8})`);
        g.addColorStop(0.6, `rgba(${pal.deep}, ${a * 0.45})`);
        g.addColorStop(1, `rgba(${pal.deep}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, rPx, 0, TAU);
        ctx.fill();
      });
    };
    const glow = (p, rPx, a, rgb = pal.accent) => {
      if (a <= 0.01 || rPx <= 0.5) return;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rPx);
      g.addColorStop(0, c(pal.core, a));
      g.addColorStop(0.35, c(rgb, a * 0.6));
      g.addColorStop(1, c(rgb, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rPx, 0, TAU);
      ctx.fill();
    };
    const bead = (p, rPx, a) => {
      if (a <= 0.01) return;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rPx);
      g.addColorStop(0, c(pal.core, a));
      g.addColorStop(0.45, c(pal.accent, a * 0.9));
      g.addColorStop(1, c(pal.main, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rPx, 0, TAU);
      ctx.fill();
    };
    // pointed streak through p (slashes, daggers, shards)
    const lens = (p, ang, L, w, rgb, a) => {
      if (a <= 0.01 || L <= 0.5) return;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      ctx.beginPath();
      ctx.moveTo(p.x - dx * L, p.y - dy * L);
      ctx.quadraticCurveTo(p.x - dy * w, p.y + dx * w, p.x + dx * L, p.y + dy * L);
      ctx.quadraticCurveTo(p.x + dy * w, p.y - dx * w, p.x - dx * L, p.y - dy * L);
      ctx.fillStyle = c(rgb, a);
      ctx.fill();
    };
    const blade = (p, ang, L, w, a) => {
      lens(p, ang, L, w, pal.accent, a * 0.9);
      lens(p, ang, L * 0.9, w * 0.3, pal.core, a);
    };
    const slashX = (p, L, a, tilt = 0.6) => {
      blade(p, tilt, L, 7 * z, a);
      blade(p, Math.PI - tilt, L, 7 * z, a);
    };
    const sparks = (p, n, r0, r1, a, seed = 0) => {
      if (a <= 0.01) return;
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const ang = (k * TAU) / n + rnd(seed + k) * 0.5;
        const len = r1 * (0.6 + 0.4 * rnd(seed + k + 50));
        ctx.moveTo(p.x + Math.cos(ang) * r0, p.y + Math.sin(ang) * r0 * 0.6);
        ctx.lineTo(p.x + Math.cos(ang) * len, p.y + Math.sin(ang) * len * 0.6);
      }
      ctx.strokeStyle = c(pal.light, a);
      ctx.lineWidth = 1.8 * z;
      ctx.stroke();
    };
    // Crescent blade: outer arc of radius R bulging toward local +x, thinned to points by an offset inner arc
    const crescent = (x, y, R, rot, span, bite, a, squash = 1) => {
      if (a <= 0.01 || R <= 1) return;
      const s = span / 2;
      const ex = R * Math.cos(s), ey = R * Math.sin(s);
      const ir = Math.hypot(ex + bite, ey), ia = Math.atan2(ey, ex + bite);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, squash);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.arc(0, 0, R + 4 * z, -s * 0.85, s * 0.85);
      ctx.strokeStyle = c(pal.main, a * 0.35);
      ctx.lineWidth = 8 * z;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, R, -s, s);
      ctx.arc(-bite, 0, ir, ia, -ia, true);
      ctx.closePath();
      const g = ctx.createLinearGradient(-bite, 0, R, 0);
      g.addColorStop(0, c(pal.main, a * 0.2));
      g.addColorStop(0.7, c(pal.accent, a * 0.85));
      g.addColorStop(1, c(pal.light, a));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, R, -s * 0.9, s * 0.9);
      ctx.strokeStyle = c(pal.core, a * 0.95);
      ctx.lineWidth = 1.6 * z;
      ctx.stroke();
      ctx.restore();
    };
    // Ground band between world radii r0..r1 over angles a0..a1 around (cx, cy)
    const groundBand = (cx, cy, r0, r1, a0, a1, h = 0) => {
      const N = 8;
      ctx.beginPath();
      for (let k = 0; k <= N; k++) {
        const a = a0 + ((a1 - a0) * k) / N;
        const p = toScreen(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, h);
        if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      for (let k = N; k >= 0; k--) {
        const a = a0 + ((a1 - a0) * k) / N;
        const p = toScreen(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, h);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
    };
    // Sweeping blade trail on the ground from angle a0 to the head at a1, thickest and brightest at the head
    const ribbon = (cx, cy, r0, r1, a0, a1, h, a) => {
      if (a <= 0.01) return;
      const N = 14;
      const inner = (k) => r1 - (r1 - r0) * k;
      for (let i = 0; i < N; i++) {
        const k0 = i / N, k1 = (i + 1) / N;
        const b0 = a0 + (a1 - a0) * k0, b1 = a0 + (a1 - a0) * k1;
        const quad = [[r1, b0], [r1, b1], [inner(k1), b1], [inner(k0), b0]]
          .map(([r, b]) => toScreen(cx + Math.cos(b) * r, cy + Math.sin(b) * r, h));
        ctx.beginPath();
        quad.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.fillStyle = c(k1 > 0.8 ? pal.accent : pal.main, a * (0.06 + 0.7 * k1 * k1));
        ctx.fill();
      }
      ctx.beginPath();
      for (let k = 0; k <= 16; k++) {
        const b = a0 + ((a1 - a0) * k) / 16;
        const p = toScreen(cx + Math.cos(b) * r1, cy + Math.sin(b) * r1, h);
        if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = c(pal.accent, a * 0.35);
      ctx.lineWidth = 6 * z;
      ctx.stroke();
      ctx.strokeStyle = c(pal.core, a * 0.95);
      ctx.lineWidth = 2 * z;
      ctx.stroke();
    };
    // Flat band along a world segment, tapering from wStart to wEnd (world half-widths)
    const strip = (x0, y0, x1, y1, wStart, wEnd, h = 0) => {
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
      const pts = [[x0 + nx * wStart, y0 + ny * wStart], [x1 + nx * wEnd, y1 + ny * wEnd], [x1 - nx * wEnd, y1 - ny * wEnd], [x0 - nx * wStart, y0 - ny * wStart]]
        .map(([x, y]) => toScreen(x, y, h));
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
    };
    // Jagged lightning between two screen points; the jitter re-rolls ~24 times a second
    const bolt = (a, b, w, al, seed = 0, jag = 1) => {
      if (al <= 0.01) return;
      const step = Math.floor(time * 24);
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const n = Math.max(3, Math.round(len / (14 * z)));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      for (let k = 1; k < n; k++) {
        const t = k / n;
        const o = (rnd(seed * 31 + k * 7 + step) - 0.5) * 16 * z * jag * Math.sin(t * Math.PI);
        ctx.lineTo(a.x + dx * t + nx * o, a.y + dy * t + ny * o);
      }
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = c(pal.accent, al * 0.45);
      ctx.lineWidth = w * 2.4 * z;
      ctx.stroke();
      ctx.strokeStyle = c(pal.light, al * 0.9);
      ctx.lineWidth = w * z;
      ctx.stroke();
      ctx.strokeStyle = c(pal.core, al);
      ctx.lineWidth = Math.max(1, w * 0.35 * z);
      ctx.stroke();
    };
    // Crystal jutting h px up from ground point p (negative h hangs it downward)
    const spike = (p, h, w, a) => {
      if (a <= 0.01 || Math.abs(h) < 1) return;
      ctx.beginPath();
      ctx.moveTo(p.x - w, p.y);
      ctx.lineTo(p.x - w * 0.45, p.y - h * 0.7);
      ctx.lineTo(p.x, p.y - h);
      ctx.lineTo(p.x + w * 0.55, p.y - h * 0.62);
      ctx.lineTo(p.x + w, p.y);
      ctx.closePath();
      const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y - h);
      g.addColorStop(0, c(pal.main, a * 0.6));
      g.addColorStop(0.6, c(pal.accent, a * 0.75));
      g.addColorStop(1, c(pal.light, a));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = c(pal.core, a * 0.9);
      ctx.lineWidth = 1.2 * z;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - h);
      ctx.lineTo(p.x + w * 0.1, p.y);
      ctx.strokeStyle = c(pal.core, a * 0.45);
      ctx.lineWidth = 1 * z;
      ctx.stroke();
    };
    // Hooded figure standing on p, s px tall: a glowing ghost, or an opaque shadow when dark
    const silhouette = (p, s, a, rgb = pal.accent, dark = false) => {
      if (a <= 0.01) return;
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(p.x - s * 0.1, p.y - s * 0.76);
        ctx.quadraticCurveTo(p.x - s * 0.34, p.y - s * 0.3, p.x - s * 0.26, p.y);
        ctx.lineTo(p.x + s * 0.26, p.y);
        ctx.quadraticCurveTo(p.x + s * 0.34, p.y - s * 0.3, p.x + s * 0.1, p.y - s * 0.76);
        ctx.closePath();
        ctx.moveTo(p.x + s * 0.14, p.y - s * 0.86);
        ctx.arc(p.x, p.y - s * 0.86, s * 0.14, 0, TAU);
      };
      if (dark) {
        shade(() => {
          path();
          ctx.fillStyle = `rgba(${pal.deep}, ${clamp01(a * 0.85)})`;
          ctx.fill();
        });
      } else {
        path();
        ctx.fillStyle = c(rgb, a * 0.4);
        ctx.fill();
      }
      path();
      ctx.strokeStyle = c(rgb, a);
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();
    };
    // six-armed frost glyph laid on the ground
    const snowflake = (p, R, rot, a) => {
      if (a <= 0.01 || R <= 1) return;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1, 0.5);
      ctx.rotate(rot);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i * TAU) / 6;
        const ux = Math.cos(ang), uy = Math.sin(ang);
        ctx.moveTo(0, 0);
        ctx.lineTo(ux * R, uy * R);
        for (const f of [0.45, 0.72]) {
          const bx = ux * R * f, by = uy * R * f, bl = R * (0.3 - f * 0.15);
          for (const s of [-1, 1]) {
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + Math.cos(ang + s * 0.7) * bl, by + Math.sin(ang + s * 0.7) * bl);
          }
        }
      }
      ctx.strokeStyle = c(pal.accent, a * 0.6);
      ctx.lineWidth = 4 * z;
      ctx.stroke();
      ctx.strokeStyle = c(pal.core, a * 0.9);
      ctx.lineWidth = 1.4 * z;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.05, 0, TAU);
      ctx.strokeStyle = c(pal.light, a * 0.5);
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();
      ctx.restore();
    };
    // frozen ground: a pale frost sheen instead of a dark stain
    const frost = (p, rPx, a) => {
      if (a <= 0.01 || rPx <= 0.5) return;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1, 0.5);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rPx);
      g.addColorStop(0, c(pal.light, a * 0.35));
      g.addColorStop(0.7, c(pal.accent, a * 0.18));
      g.addColorStop(1, c(pal.main, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rPx, 0, TAU);
      ctx.fill();
      ctx.restore();
    };
    // shards thrown out from p
    const shatterBurst = (p, n, dist, a, seed = 0) => {
      if (a <= 0.01) return;
      for (let i = 0; i < n; i++) {
        const ang = (i * TAU) / n + rnd(seed + i) * 0.4;
        const d = dist * (0.7 + 0.3 * rnd(seed + i + 30));
        blade({ x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d * 0.6 }, ang, 6 * z, 2.5 * z, a);
      }
    };
    // Tongue of fire standing on p, h px tall and w px wide at the base, swaying
    const flame = (p, h, w, a, seed = 0) => {
      if (a <= 0.01 || h < 1) return;
      const sway = Math.sin(time * 9 + seed * 1.7) * w * 0.6;
      for (const [k, rgb, al] of [[1, pal.main, 0.75], [0.65, pal.accent, 0.85], [0.35, pal.core, 0.9]]) {
        const ww = w * k, hh = h * (0.55 + 0.45 * k);
        ctx.beginPath();
        ctx.moveTo(p.x - ww, p.y);
        ctx.quadraticCurveTo(p.x - ww * 0.9, p.y - hh * 0.55, p.x + sway * k, p.y - hh);
        ctx.quadraticCurveTo(p.x + ww * 0.9, p.y - hh * 0.55, p.x + ww, p.y);
        ctx.quadraticCurveTo(p.x, p.y + ww * 0.35, p.x - ww, p.y);
        ctx.fillStyle = c(rgb, a * al);
        ctx.fill();
      }
    };
    // caster/target ends of a skill (moves and strikes carry startX/Y as well)
    const ends = (fx) => {
      const sx = fx.startX !== undefined ? fx.startX : fx.x;
      const sy = fx.startY !== undefined ? fx.startY : fx.y;
      return { sx, sy, tx: fx.x !== undefined ? fx.x : sx, ty: fx.y !== undefined ? fx.y : sy };
    };

    return {
      pal, time, TAU, U, clamp01, seg, out3, fade, c, rnd, shade, oval, ring, pool, puff, glow, bead, lens, blade,
      slashX, sparks, crescent, groundBand, ribbon, strip, bolt, spike, silhouette, flame, snowflake, frost, shatterBurst, ends
    };
  }

  // ---------------------------------------------------------------- Nightblade (SP tier 1)
  // Violet shadow assassin: smoke, crescent moons, cross cuts
  drawNightbladeSkill(ctx, fx, progress, toScreen, z) {
    const k = this.spFxKit(ctx, progress, toScreen, z, SP_FX_PALETTES.sp_nightblade);
    const { pal, time, TAU, U, seg, out3, fade, c, rnd, shade, ring, pool, puff, glow, bead, blade, slashX, sparks, crescent, silhouette } = k;
    const { sx, sy, tx, ty } = k.ends(fx);
    const BY_SHAPE = {
      strike: 'sp_night_fang', decoy: 'sp_shadow_net', nova: 'sp_shroud', backstep: 'sp_night_dash',
      volley: 'sp_moon_volley', line: 'sp_umbral_line', blink: 'sp_shadow_hop'
    };

    switch (fx.skillId || BY_SHAPE[fx.shape]) {
      // ASSASSINATE: the shadow lunges in, two cross cuts, a crescent moon flares behind the target
      case 'sp_night_fang': {
        const g = toScreen(tx, ty, 0), p = toScreen(tx, ty, 0.6);
        const lunge = 1 - seg(0, 0.35);
        if (lunge > 0 && Math.hypot(tx - sx, ty - sy) > 0.3) {
          const a = toScreen(sx, sy, 0.5);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = c(pal.main, lunge * 0.6);
          ctx.lineWidth = 8 * z;
          ctx.stroke();
          ctx.strokeStyle = c(pal.core, lunge * 0.8);
          ctx.lineWidth = 1.5 * z;
          ctx.stroke();
        }
        pool(g, 1.4 * U * out3(seg(0, 0.3)), 0.6 * fade);
        const moon = seg(0.1, 0.45);
        crescent(p.x, p.y - 8 * z, 24 * z * (0.6 + 0.4 * out3(moon)), -0.6, 3.4, 12 * z, moon > 0 ? fade * 0.8 : 0);
        const cutA = 1 - seg(0.5, 0.9);
        const c1 = seg(0.08, 0.28), c2 = seg(0.22, 0.42);
        if (c1 > 0) blade(p, 0.55, 42 * z * out3(c1), 7 * z, cutA);
        if (c2 > 0) blade(p, Math.PI - 0.55, 42 * z * out3(c2), 7 * z, cutA);
        const burst = seg(0.3, 0.8);
        if (burst > 0 && burst < 1) {
          for (let i = 0; i < 6; i++) {
            const a = (i * TAU) / 6 + 0.3, d = (10 + 38 * out3(burst)) * z;
            blade({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.6 }, a, 8 * z, 2.5 * z, 1 - burst);
          }
          ring(g, (0.4 + 1.3 * out3(burst)) * U, pal.accent, (1 - burst) * 0.8, 2.5);
        }
        return true;
      }

      // SHADOW CLONE: smoke billows out and a shadow double stays behind (small radius = the swap back)
      case 'sp_shadow_net': {
        const big = (fx.radius || 3) > 2.5;
        const g = toScreen(tx, ty, 0);
        const R = (fx.radius || 3) * U;
        const bl = out3(seg(0, 0.5));
        for (let i = 0; i < 9; i++) {
          const a = (i * TAU) / 9 + rnd(i) * 0.5;
          const d = R * (0.15 + 0.5 * bl) * (0.7 + 0.3 * rnd(i + 9));
          puff({ x: g.x + Math.cos(a) * d, y: g.y + Math.sin(a) * d * 0.5 - 6 * z }, (22 + 12 * rnd(i + 3)) * z * (0.5 + bl), 0.45 * fade);
        }
        silhouette(g, 46 * z, big ? fade * (0.55 + 0.2 * Math.sin(time * 6)) : 1 - seg(0, 0.6), pal.accent);
        ring(g, R * (0.3 + 0.7 * bl), pal.accent, (1 - seg(0.3, 1)) * 0.8, 2.5);
        if (big) {
          ctx.setLineDash([5 * z, 7 * z]);
          ring(g, 0.9 * U, pal.light, fade * 0.7, 1.5);
          ctx.setLineDash([]);
        }
        return true;
      }

      // SHADOW REAP: a moon sigil opens and a spectral blade circles the assassin
      case 'sp_shroud': {
        const Rw = fx.radius || 4.2, R = Rw * U;
        const g = toScreen(tx, ty, 0);
        const open = out3(seg(0, 0.35));
        pool(g, R * open, 0.5 * fade);
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.scale(1, 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.1, R * open), 0, TAU);
        ctx.strokeStyle = c(pal.accent, fade * 0.8);
        ctx.lineWidth = 3 * z;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.1, R * 0.7 * open), 0, TAU);
        ctx.strokeStyle = c(pal.main, fade * 0.6);
        ctx.lineWidth = 1.5 * z;
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = (i * TAU) / 6 + time * 0.8;
          crescent(Math.cos(a) * R * 0.85 * open, Math.sin(a) * R * 0.85 * open, 9 * z, a, 3.2, 5 * z, fade * 0.8);
        }
        ctx.restore();
        const sw = seg(0.1, 0.6), swA = 1 - seg(0.55, 0.75);
        if (sw > 0 && swA > 0) {
          const head = -Math.PI / 2 + out3(sw) * TAU;
          for (let j = 3; j >= 0; j--) {
            const a = head - j * 0.3;
            const q = toScreen(tx + Math.cos(a) * Rw * 0.6, ty + Math.sin(a) * Rw * 0.6, 0.5);
            const q2 = toScreen(tx + Math.cos(a + 0.1) * Rw * 0.6, ty + Math.sin(a + 0.1) * Rw * 0.6, 0.5);
            crescent(q.x, q.y, 30 * z, Math.atan2(q2.y - q.y, q2.x - q.x), 2.0, 18 * z, swA * (j ? 0.3 / j : 1));
          }
        }
        const wave = seg(0.45, 1);
        if (wave > 0) {
          ring(g, R * (0.4 + 0.7 * out3(wave)), pal.light, (1 - wave) * 0.9, 4);
          ring(g, R * (0.3 + 0.5 * out3(wave)), pal.main, (1 - wave) * 0.6, 2);
        }
        glow(toScreen(tx, ty, 0.5), 22 * z, fade * 0.5);
        return true;
      }

      // SHADOWSTEP: dissolve into smoke, re-form behind the target and cut
      case 'sp_night_dash': {
        const o = toScreen(sx, sy, 0), d = toScreen(tx, ty, 0);
        const gone = seg(0, 0.6);
        for (let i = 0; i < 5; i++) {
          const a = (i * TAU) / 5 + rnd(i) * 0.6;
          puff({ x: o.x + Math.cos(a) * 12 * z, y: o.y - 18 * z - gone * 20 * z + Math.sin(a) * 8 * z }, (12 + 8 * gone) * z, 0.65 * (1 - gone));
        }
        silhouette(o, 44 * z, (1 - seg(0, 0.35)) * 0.8, pal.main, true);
        const thread = fade * 0.5 * (1 - seg(0.2, 0.6));
        if (thread > 0) {
          const a = toScreen(sx, sy, 0.5), b = toScreen(tx, ty, 0.5);
          ctx.setLineDash([4 * z, 6 * z]);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = c(pal.accent, thread);
          ctx.lineWidth = 2 * z;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        const form = seg(0.1, 0.45);
        silhouette(d, 44 * z, form * fade * 0.8, pal.accent);
        const cut = seg(0.25, 0.6);
        if (cut > 0) {
          slashX(toScreen(tx, ty, 0.6), 34 * z * out3(cut), 1 - seg(0.6, 0.95));
          ring(d, (0.4 + 1.1 * out3(cut)) * U, pal.accent, (1 - cut) * 0.9, 3);
        }
        return true;
      }

      // MOON VOLLEY: spinning crescent blades arc out to each target
      case 'sp_moon_volley': {
        const op = toScreen(sx, sy, 0.6);
        const cast = seg(0, 0.5);
        ring(toScreen(sx, sy, 0), (0.5 + 0.6 * out3(cast)) * U, pal.accent, (1 - cast) * 0.8, 2);
        (fx.points || []).forEach((pt, i) => {
          const tp = toScreen(pt.x, pt.y, 0.6);
          const at = (t) => ({
            x: op.x + (tp.x - op.x) * t,
            y: op.y + (tp.y - op.y) * t - Math.sin(t * Math.PI) * 18 * z
          });
          const fly = seg(i * 0.04, 0.4 + i * 0.04);
          if (fly > 0 && fly < 1) {
            for (let j = 3; j >= 0; j--) {
              const t = fly - j * 0.07;
              if (t <= 0) continue;
              const p = at(t);
              crescent(p.x, p.y, 12 * z, t * TAU * 2.5, 3.4, 7 * z, fade * (j ? 0.25 / j : 1));
            }
          }
          const hit = seg(0.4 + i * 0.04, 0.8 + i * 0.04);
          if (hit > 0 && hit < 1) {
            slashX(tp, 18 * z * out3(Math.min(1, hit * 2)), 1 - hit);
            ring(toScreen(pt.x, pt.y, 0), (0.3 + 0.6 * out3(hit)) * U, pal.accent, (1 - hit) * 0.9, 2);
          }
        });
        return true;
      }

      // UMBRAL LINE: a wave of shadow rolls forward behind a crescent edge
      case 'sp_umbral_line': {
        const dx = tx - sx, dy = ty - sy;
        const w = (fx.width || 1.2) * 0.5;
        const reach = out3(seg(0, 0.35));
        const fx1 = sx + dx * reach, fy1 = sy + dy * reach;
        shade(() => {
          k.strip(sx, sy, fx1, fy1, w * 0.4, w, 0);
          ctx.fillStyle = `rgba(${pal.deep}, ${0.55 * fade})`;
          ctx.fill();
        });
        const a = toScreen(sx, sy, 0), b = toScreen(fx1, fy1, 0);
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, c(pal.main, 0));
        grad.addColorStop(1, c(pal.accent, 0.7 * fade));
        k.strip(sx, sy, fx1, fy1, w * 0.4, w, 0);
        ctx.fillStyle = grad;
        ctx.fill();
        for (let i = 0; i < 8; i++) {
          const t = (i + 0.5) / 8;
          if (t > reach) break;
          const p = toScreen(sx + dx * t, sy + dy * t, 0);
          puff({ x: p.x + (rnd(i) - 0.5) * 14 * z, y: p.y - (progress * 30 + rnd(i + 4) * 10) * z }, 10 * z, 0.45 * fade);
        }
        const front = toScreen(fx1, fy1, 0.5);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const edgeA = 1 - seg(0.4, 0.8);
        for (let j = 2; j >= 0; j--) {
          const t = Math.max(0, reach - j * 0.08);
          const p = toScreen(sx + dx * t, sy + dy * t, 0.5);
          crescent(p.x, p.y, 26 * z, ang, 2.2, 15 * z, edgeA * (j ? 0.3 / j : 1), 0.8);
        }
        bead(front, 12 * z, edgeA * 0.8);
        return true;
      }

      // NIGHT TERROR: darkness falls, shadow hands claw up from the edge, eyes open in the dark
      case 'sp_night_terror': {
        const Rw = fx.radius || 3.6, R = Rw * U;
        const g = toScreen(tx, ty, 0);
        const open = out3(seg(0, 0.4));
        pool(g, R * open, 0.7 * fade);
        ring(g, R * open, pal.accent, fade * 0.8, 2.5);
        const close = seg(0.3, 0.8);
        if (close > 0) ring(g, R * (1 - 0.8 * out3(close)), pal.light, (1 - close) * 0.7, 2);
        for (let i = 0; i < 12; i++) {
          const a = (i * TAU) / 12 + 0.2;
          const base = toScreen(tx + Math.cos(a) * Rw * 0.85 * open, ty + Math.sin(a) * Rw * 0.85 * open, 0);
          const h = (20 + 14 * rnd(i)) * z * out3(seg(0.1 + i * 0.02, 0.5 + i * 0.02));
          if (h < 1) continue;
          const trace = () => {
            ctx.beginPath();
            for (let j = 0; j <= 6; j++) {
              const x = base.x + Math.sin(j * 1.2 + time * 8 + i) * 4 * z * (j / 6);
              const y = base.y - (h * j) / 6;
              if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
          };
          shade(() => {
            trace();
            ctx.strokeStyle = `rgba(${pal.deep2}, ${0.85 * fade})`;
            ctx.lineWidth = 5 * z;
            ctx.lineCap = 'round';
            ctx.stroke();
          });
          trace();
          ctx.strokeStyle = c(pal.accent, fade * 0.8);
          ctx.lineWidth = 1.5 * z;
          ctx.stroke();
          bead({ x: base.x + Math.sin(6 * 1.2 + time * 8 + i) * 4 * z, y: base.y - h }, 4 * z, fade);
        }
        for (let i = 0; i < 4; i++) {
          const a = (i * TAU) / 4 + 0.7, d = R * 0.45;
          const e = { x: g.x + Math.cos(a) * d, y: g.y + Math.sin(a) * d * 0.5 - 10 * z };
          const blink = open * fade * (0.5 + 0.5 * Math.sin(time * 5 + i * 1.7));
          bead({ x: e.x - 4 * z, y: e.y }, 3 * z, blink);
          bead({ x: e.x + 4 * z, y: e.y }, 3 * z, blink);
        }
        return true;
      }

      // SHADOW HOP: cut where you stood, slip through smoke, re-form at the landing
      case 'sp_shadow_hop': {
        const o = toScreen(sx, sy, 0), d = toScreen(tx, ty, 0);
        const r = (fx.radius || 2) * U;
        const burst = seg(0, 0.55);
        pool(o, r * 0.8, 0.55 * (1 - burst));
        if (fx.origin) {
          ring(o, r * (0.3 + 0.7 * out3(burst)), pal.accent, (1 - burst) * 0.9, 3);
          slashX(toScreen(sx, sy, 0.6), 30 * z * out3(Math.min(1, progress * 5)), 1 - seg(0.05, 0.5));
        }
        for (let i = 0; i < 4; i++) {
          puff({ x: o.x + (rnd(i) - 0.5) * 24 * z, y: o.y - (10 + 20 * burst) * z }, 13 * z, 0.6 * (1 - burst));
          puff({ x: d.x + (rnd(i + 7) - 0.5) * 24 * z, y: d.y - (8 + 14 * burst) * z }, 11 * z, 0.5 * (1 - burst));
        }
        for (let i = 0; i <= 6; i++) {
          const t = i / 6;
          if (t > seg(0, 0.3)) break;
          bead(toScreen(sx + (tx - sx) * t, sy + (ty - sy) * t, 0.5 + Math.sin(t * Math.PI) * 0.8), 3.5 * z, fade * 0.6);
        }
        const land = seg(0.1, 0.5);
        silhouette(d, 44 * z, land * fade * 0.8, pal.accent);
        ring(d, r * 0.6 * (0.3 + 0.7 * out3(land)), pal.light, land > 0 ? (1 - land) * 0.9 : 0, 2.5);
        sparks(toScreen(tx, ty, 0.4), 6, 6 * z, 22 * z * out3(land), land > 0 ? 1 - land : 0, 3);
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- Venom Lord (SP tier 2)
  // Toxic alchemist: gas clouds, boiling bubbles, acid splashes, serpents
  drawVenomLordSkill(ctx, fx, progress, toScreen, z) {
    const k = this.spFxKit(ctx, progress, toScreen, z, SP_FX_PALETTES.sp_venom_lord);
    const { pal, time, TAU, U, clamp01, seg, out3, fade, c, rnd, shade, ring, pool, puff, glow, bead, lens, blade, sparks, groundBand, strip, silhouette } = k;
    const { sx, sy, tx, ty } = k.ends(fx);
    const bubble = (x, y, rPx, a) => {
      if (a <= 0.01 || rPx <= 0.5) return;
      ctx.beginPath();
      ctx.arc(x, y, rPx, 0, TAU);
      ctx.fillStyle = c(pal.main, a * 0.25);
      ctx.fill();
      ctx.strokeStyle = c(pal.light, a * 0.9);
      ctx.lineWidth = 1.2 * z;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - rPx * 0.35, y - rPx * 0.35, rPx * 0.25, 0, TAU);
      ctx.fillStyle = c(pal.core, a);
      ctx.fill();
    };
    // gas cloud: dark body with a sickly glow inside
    const cloud = (p, rPx, a) => {
      puff(p, rPx, a);
      glow(p, rPx * 0.9, a * 0.7, pal.main);
    };
    const BY_SHAPE = {
      cone: 'sp_plague_breath', pulse: 'sp_venom_rain', detonate: 'sp_viper_nest', dash: 'sp_serpent_slip',
      line: 'sp_toxic_lance', chain: 'sp_plague_chain', buff: 'sp_miasma'
    };

    switch (fx.skillId || BY_SHAPE[fx.shape]) {
      // TOXIC INJECTION: needles shoot ahead while a plague cloud rolls across the cone
      case 'sp_plague_breath': {
        const half = ((fx.arc || 80) * Math.PI) / 360;
        const base = Math.atan2(fx.dirY || 0, fx.dirX || 1);
        const range = fx.range || 5;
        const reach = out3(seg(0, 0.5));
        groundBand(tx, ty, 0.3, Math.max(0.35, range * reach), base - half, base + half, 0);
        ctx.fillStyle = c(pal.main, 0.12 * fade);
        ctx.fill();
        for (let i = 0; i < 18; i++) {
          const a = base + (rnd(i) * 2 - 1) * half * 0.85;
          const d = range * reach * (0.25 + 0.75 * rnd(i + 20));
          const p = toScreen(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 0.3 + rnd(i + 40) * 0.5);
          cloud(p, (14 + 14 * rnd(i + 60)) * z * (0.6 + 0.8 * reach), 0.45 * fade);
        }
        const shot = seg(0, 0.3), shotA = 1 - seg(0.3, 0.6);
        for (const j of [-0.5, 0, 0.5]) {
          const a = base + j * half * 0.6;
          const head = range * out3(shot), tail = Math.max(0, head - 1.4);
          const p0 = toScreen(tx + Math.cos(a) * tail, ty + Math.sin(a) * tail, 0.5);
          const p1 = toScreen(tx + Math.cos(a) * head, ty + Math.sin(a) * head, 0.5);
          blade({ x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }, Math.atan2(p1.y - p0.y, p1.x - p0.x), Math.hypot(p1.x - p0.x, p1.y - p0.y) / 2, 2.5 * z, shotA);
        }
        for (let i = 0; i < 8; i++) {
          const a = base + (rnd(i + 80) * 2 - 1) * half * 0.8;
          const d = range * reach * (0.4 + 0.6 * rnd(i + 90));
          const p = toScreen(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 0.6);
          const f = clamp01(progress * 1.5 - rnd(i + 99) * 0.4);
          bead({ x: p.x, y: p.y + f * 14 * z }, 3 * z, fade * (1 - f));
        }
        return true;
      }

      // MIASMA TRAP: each wave boils up from a toxic pool
      case 'sp_venom_rain': {
        const R = (fx.radius || 3.5) * U;
        const g = toScreen(tx, ty, 0);
        const wave = fx.wave || 0;
        const open = out3(seg(0, 0.4));
        pool(g, R * (0.6 + 0.4 * open), 0.35 * fade);
        if (wave === 0) {
          ctx.setLineDash([8 * z, 6 * z]);
          ring(g, R * open, pal.accent, fade * 0.9, 2.5);
          ctx.setLineDash([]);
        }
        const pulse = seg(0, 0.7);
        ring(g, R * (0.2 + 0.8 * out3(pulse)), pal.light, (1 - pulse) * 0.7, 2);
        for (let i = 0; i < 8; i++) {
          const s = i + wave * 10;
          const a = rnd(s) * TAU, d = Math.sqrt(rnd(s + 1)) * R * 0.8;
          const t = clamp01(progress * 1.4 - rnd(s + 2) * 0.4);
          bubble(g.x + Math.cos(a) * d, g.y + Math.sin(a) * d * 0.5 - t * 16 * z, (3 + 4 * rnd(s + 3)) * z * (0.5 + t), (1 - t) * fade);
        }
        for (let i = 0; i < 3; i++) {
          const s = i + wave * 10 + 50;
          const a = rnd(s) * TAU, d = rnd(s + 1) * R * 0.6;
          cloud({ x: g.x + Math.cos(a) * d, y: g.y + Math.sin(a) * d * 0.5 - progress * 20 * z }, 16 * z, 0.35 * fade);
        }
        return true;
      }

      // EPIDEMIC DETONATE: a toxic shockwave and acid geysers across the whole area
      case 'sp_viper_nest': {
        const Rw = fx.radius || 7, R = Rw * U;
        const g = toScreen(tx, ty, 0);
        glow(toScreen(tx, ty, 0.5), 60 * z, 1 - seg(0, 0.3), pal.accent);
        const wv = seg(0, 0.6);
        ring(g, R * out3(wv), pal.light, (1 - wv) * 0.9, 5);
        ring(g, R * 0.85 * out3(wv), pal.main, (1 - wv) * 0.7, 2.5);
        for (let i = 0; i < 10; i++) {
          const a = rnd(i) * TAU, d = (0.25 + 0.7 * rnd(i + 5)) * Rw;
          const wx = tx + Math.cos(a) * d, wy = ty + Math.sin(a) * d;
          const t0 = 0.1 + rnd(i + 9) * 0.25;
          const t = seg(t0, t0 + 0.55);
          if (t <= 0 || t >= 1) continue;
          const base = toScreen(wx, wy, 0), top = toScreen(wx, wy, Math.sin(t * Math.PI) * 1.6);
          const col = ctx.createLinearGradient(base.x, base.y, top.x, top.y);
          col.addColorStop(0, c(pal.accent, (1 - t) * 0.9));
          col.addColorStop(1, c(pal.light, 0));
          ctx.beginPath();
          ctx.moveTo(base.x, base.y);
          ctx.lineTo(top.x, top.y);
          ctx.strokeStyle = col;
          ctx.lineWidth = 8 * z;
          ctx.stroke();
          ring(base, (0.2 + 0.5 * t) * U, pal.light, 1 - t, 2);
          for (let j = 0; j < 4; j++) {
            const da = (j / 4) * TAU + rnd(i + j);
            bead({ x: top.x + Math.cos(da) * 12 * z * t, y: top.y + Math.sin(da) * 6 * z * t + t * t * 18 * z }, 3 * z, 1 - t);
          }
        }
        for (let i = 0; i < 5; i++) {
          cloud({ x: g.x + (rnd(i + 30) - 0.5) * 50 * z, y: g.y - (10 + progress * 40 + rnd(i + 31) * 20) * z }, 22 * z, 0.4 * fade);
        }
        return true;
      }

      // SERPENT SHED: slither through as a venom serpent, leaving the shed skin behind
      case 'sp_serpent_slip':
      // VENOM DASH: the same serpent, without the shed skin
      case 'sp_venom_dash': {
        const shed = fx.skillId === 'sp_serpent_slip';
        const dx = tx - sx, dy = ty - sy, len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const reach = out3(seg(0, 0.35));
        if (shed) silhouette(toScreen(sx, sy, 0), 42 * z, (1 - seg(0, 0.7)) * 0.7, pal.light);
        const at = (t) => {
          const wob = Math.sin(t * len * 2.2 - progress * 10) * 0.35 * (1 - t * 0.3);
          return toScreen(sx + dx * t + nx * wob, sy + dy * t + ny * wob, 0.2);
        };
        const N = 30;
        for (let s = 0; s < N; s++) {
          const t0 = (s / N) * reach, t1 = ((s + 1) / N) * reach;
          const p0 = at(t0), p1 = at(t1);
          const w = 2 + 7 * (s / N);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = c(pal.main, fade * 0.8);
          ctx.lineWidth = w * z;
          ctx.stroke();
          ctx.strokeStyle = c(pal.light, fade * 0.7);
          ctx.lineWidth = w * 0.35 * z;
          ctx.stroke();
          if (s % 3 === 0) bead(p1, w * 0.6 * z, fade * 0.6);
        }
        const head = at(reach);
        glow(head, 16 * z, fade, pal.accent);
        for (let i = 1; i <= 3; i++) {
          const t = i / 4;
          if (reach < t) continue;
          pool(toScreen(sx + dx * t, sy + dy * t, 0), 0.35 * U, 0.45 * fade);
          bubble(toScreen(sx + dx * t, sy + dy * t, 0).x, toScreen(sx + dx * t, sy + dy * t, 0).y - progress * 10 * z, 3 * z, fade * 0.8);
        }
        const end = seg(0.25, 0.8);
        if (end > 0) {
          ring(toScreen(tx, ty, 0), (0.3 + 1.0 * out3(end)) * U, pal.accent, (1 - end) * 0.9, 3);
          sparks(toScreen(tx, ty, 0.2), 8, 4 * z, 24 * z * out3(end), 1 - end, 7);
        }
        return true;
      }

      // TOXIC LANCE: an acid javelin that drips as it flies and splashes at the end
      case 'sp_toxic_lance': {
        const dx = tx - sx, dy = ty - sy;
        const head = out3(seg(0, 0.3));
        const hx = sx + dx * head, hy = sy + dy * head;
        shade(() => {
          strip(sx, sy, hx, hy, 0.15, (fx.width || 1.4) * 0.35, 0);
          ctx.fillStyle = `rgba(${pal.deep2}, ${0.4 * fade})`;
          ctx.fill();
        });
        const a = toScreen(sx, sy, 0.5), b = toScreen(hx, hy, 0.5);
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, c(pal.main, 0));
        grad.addColorStop(1, c(pal.accent, 0.85 * fade));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 6 * z;
        ctx.stroke();
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const flying = 1 - seg(0.3, 0.5);
        blade(b, ang, 18 * z, 5 * z, flying);
        glow(b, 14 * z, flying * 0.8);
        for (let i = 0; i < 10; i++) {
          const t = i / 10;
          if (t > head) break;
          const p = toScreen(sx + dx * t, sy + dy * t, 0.5);
          const f = clamp01((progress - t * 0.3) * 3);
          bead({ x: p.x, y: p.y + f * 14 * z }, 3 * z, (1 - f) * fade);
        }
        const hit = seg(0.3, 0.8);
        if (hit > 0 && hit < 1) {
          const e = toScreen(tx, ty, 0);
          pool(e, 0.9 * U, 0.5 * (1 - hit));
          ring(e, (0.3 + 0.9 * out3(hit)) * U, pal.light, 1 - hit, 2.5);
          for (let i = 0; i < 6; i++) {
            const da = (i / 6) * TAU + 0.3, dd = 22 * z * out3(hit);
            lens({ x: e.x + Math.cos(da) * dd, y: e.y + Math.sin(da) * dd * 0.5 - Math.sin(hit * Math.PI) * 12 * z }, da, 5 * z, 2 * z, pal.light, 1 - hit);
          }
        }
        return true;
      }

      // PLAGUE CHAIN: an arc of venom leaps from body to body, bursting into bubbles at each
      case 'sp_plague_chain': {
        const nodes = [{ x: sx, y: sy }, ...(fx.points || [])];
        for (let i = 0; i < nodes.length - 1; i++) {
          const reach = out3(seg(i * 0.08, i * 0.08 + 0.15));
          if (reach <= 0) break;
          const p0 = toScreen(nodes[i].x, nodes[i].y, 0.6), p1 = toScreen(nodes[i + 1].x, nodes[i + 1].y, 0.6);
          const cx = (p0.x + p1.x) / 2, cy = (p0.y + p1.y) / 2 - 24 * z;
          const at = (t) => ({
            x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * cx + t * t * p1.x,
            y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * cy + t * t * p1.y
          });
          ctx.beginPath();
          for (let s = 0; s <= 16; s++) {
            const p = at((s / 16) * reach);
            if (s === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          }
          ctx.strokeStyle = c(pal.main, fade * 0.5);
          ctx.lineWidth = 6 * z;
          ctx.stroke();
          ctx.strokeStyle = c(pal.accent, fade * 0.9);
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();
          ctx.strokeStyle = c(pal.core, fade * 0.8);
          ctx.lineWidth = 1 * z;
          ctx.stroke();
          if (reach < 1) {
            glow(at(reach), 10 * z, fade);
            continue;
          }
          const pop = seg(i * 0.08 + 0.15, i * 0.08 + 0.55);
          const g = toScreen(nodes[i + 1].x, nodes[i + 1].y, 0);
          ring(g, (0.3 + 0.6 * out3(pop)) * U, pal.light, (1 - pop) * 0.9, 2);
          glow(p1, 14 * z, (1 - pop) * 0.8);
          for (let j = 0; j < 4; j++) {
            bubble(p1.x + (rnd(i * 4 + j) - 0.5) * 20 * z, p1.y - pop * (12 + 10 * rnd(i * 4 + j + 9)) * z, (2.5 + 2 * rnd(j + i)) * z, (1 - pop) * fade);
          }
        }
        return true;
      }

      // MIASMA: a poison cloud swirls around the venom lord
      case 'sp_miasma': {
        const Rw = Math.max(1.8, fx.radius || 3.5), R = Rw * U;
        const g = toScreen(tx, ty, 0);
        const open = out3(seg(0, 0.4));
        pool(g, R * open, 0.4 * fade);
        ring(g, R * open, pal.accent, fade * 0.8, 2.5);
        for (let i = 0; i < 9; i++) {
          const a = (i * TAU) / 9 + progress * 3 + rnd(i) * 0.4;
          const d = Rw * (0.35 + 0.45 * open) * (0.8 + 0.2 * rnd(i + 3));
          cloud(toScreen(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 0.3 + 0.25 * Math.sin(time * 3 + i)), (16 + 8 * rnd(i + 5)) * z, 0.5 * fade);
        }
        for (let i = 0; i < 8; i++) {
          const t = (progress * 1.6 + rnd(i)) % 1;
          const a = rnd(i + 20) * TAU, d = rnd(i + 21) * R * 0.5;
          bubble(g.x + Math.cos(a) * d, g.y + Math.sin(a) * d * 0.5 - t * 34 * z, (2.5 + 2.5 * rnd(i + 22)) * z, (1 - t) * fade);
        }
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- Blade Dancer (SP tier 3)
  // Golden storm duelist: whirling blades, lightning, afterimages
  drawBladeDancerSkill(ctx, fx, progress, toScreen, z) {
    const k = this.spFxKit(ctx, progress, toScreen, z, SP_FX_PALETTES.sp_blade_dancer);
    const { pal, TAU, U, seg, out3, fade, rnd, ring, glow, blade, sparks, ribbon, bolt, silhouette } = k;
    const { sx, sy, tx, ty } = k.ends(fx);
    const BY_SHAPE = {
      nova: 'sp_storm_waltz', pull: 'sp_knife_storm', rain: 'sp_mirror_dance', dash: 'sp_flash_step',
      cone: 'sp_whirling_edge', strike: 'sp_lightning_lunge', blink: 'sp_spark_blink'
    };

    switch (fx.skillId || BY_SHAPE[fx.shape]) {
      // STORM FLOURISH: three blades whirl around the dancer, lightning snaps outward
      case 'sp_storm_waltz': {
        const Rw = fx.radius || 3.2, R = Rw * U;
        const g = toScreen(tx, ty, 0);
        const spin = out3(seg(0, 0.6)), spinA = 1 - seg(0.55, 0.9);
        for (let b = 0; b < 3; b++) {
          const head = (b * TAU) / 3 + spin * TAU * 1.2;
          ribbon(tx, ty, Rw * 0.5, Rw * 0.9, head - 1.3, head, 0.3, spinA);
        }
        const snap = seg(0.15, 0.6);
        if (snap > 0 && snap < 1) {
          for (let i = 0; i < 6; i++) {
            const a = (i * TAU) / 6 + 0.5;
            const p0 = toScreen(tx + Math.cos(a) * Rw * 0.3, ty + Math.sin(a) * Rw * 0.3, 0.4);
            const p1 = toScreen(tx + Math.cos(a) * Rw * (0.6 + 0.4 * out3(snap)), ty + Math.sin(a) * Rw * (0.6 + 0.4 * out3(snap)), 0.4);
            bolt(p0, p1, 2, 1 - snap, i);
          }
        }
        const wv = seg(0.2, 0.85);
        ring(g, R * (0.5 + 0.6 * out3(wv)), pal.light, wv > 0 ? (1 - wv) * 0.9 : 0, 3);
        glow(toScreen(tx, ty, 0.5), 20 * z, fade * 0.6);
        return true;
      }

      // TEMPEST VORTEX: a ring of knives spirals in on the target point and bursts
      case 'sp_knife_storm': {
        const Rw = fx.radius || 4.5, R = Rw * U;
        const g = toScreen(tx, ty, 0);
        const inward = out3(seg(0, 0.65)), snap = seg(0.6, 1);
        ring(g, R, pal.accent, fade * 0.6, 2);
        for (let i = 0; i < 6; i++) {
          const a0 = (i * TAU) / 6 + progress * 2, a1 = a0 + TAU / 12;
          bolt(toScreen(tx + Math.cos(a0) * Rw, ty + Math.sin(a0) * Rw, 0), toScreen(tx + Math.cos(a1) * Rw, ty + Math.sin(a1) * Rw, 0), 1.5, fade * 0.6, i + 10);
        }
        if (snap < 1) {
          for (let i = 0; i < 12; i++) {
            const a = (i * TAU) / 12 + progress * 7 + (i % 2) * 0.3;
            const rr = Rw * (0.95 - 0.8 * inward) * (0.8 + 0.2 * rnd(i));
            const p = toScreen(tx + Math.cos(a) * rr, ty + Math.sin(a) * rr, 0.5);
            const q = toScreen(tx + Math.cos(a + 0.05) * rr, ty + Math.sin(a + 0.05) * rr, 0.5);
            blade(p, Math.atan2(q.y - p.y, q.x - p.x) + 0.5, 15 * z, 3.5 * z, (1 - snap) * fade);
          }
        }
        if (snap > 0 && snap < 1) {
          const c0 = toScreen(tx, ty, 0.5);
          glow(c0, 40 * z, 1 - snap);
          for (let i = 0; i < 8; i++) blade(c0, (i * Math.PI) / 8, 36 * z * out3(snap), 3 * z, 1 - snap);
          ring(g, R * 0.6 * out3(snap), pal.light, 1 - snap, 3);
        }
        return true;
      }

      // THOUSAND CUTS: an afterimage flickers in and cuts at a random angle
      case 'sp_mirror_dance': {
        const g = toScreen(tx, ty, 0), p = toScreen(tx, ty, 0.6);
        const wave = fx.wave || 0;
        if (fx.areaR) ring(toScreen(fx.areaX, fx.areaY, 0), fx.areaR * U, pal.accent, fade * 0.2, 1.5);
        silhouette(g, 40 * z, (1 - seg(0, 0.5)) * 0.6, pal.accent);
        const ang = rnd(wave * 7.3 + 1) * Math.PI;
        const cut = seg(0, 0.25);
        blade(p, ang, 36 * z * out3(cut), 6 * z, 1 - seg(0.3, 0.9));
        const sp = seg(0.1, 0.7);
        ring(g, (0.3 + 0.8 * out3(sp)) * U, pal.light, (1 - sp) * 0.9, 2);
        sparks(p, 6, 4 * z, 20 * z * out3(sp), 1 - sp, wave);
        return true;
      }

      // BLADE TEMPEST: swords fall from the sky and bite into the ground
      case 'sp_blade_tempest': {
        const g = toScreen(tx, ty, 0);
        if (fx.areaR) ring(toScreen(fx.areaX, fx.areaY, 0), fx.areaR * U, pal.accent, fade * 0.2, 1.5);
        const fall = seg(0, 0.3);
        if (fall < 1) {
          const h = 0.4 + 4 * (1 - fall * fall);
          const p = toScreen(tx, ty, h), top = toScreen(tx, ty, h + 1.5);
          ctx.beginPath();
          ctx.moveTo(top.x, top.y);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = k.c(pal.accent, 0.5);
          ctx.lineWidth = 3 * z;
          ctx.stroke();
          blade(p, Math.PI / 2, 22 * z, 4 * z, 1);
          return true;
        }
        const hit = seg(0.3, 1);
        blade(toScreen(tx, ty, 0.35), Math.PI / 2 - 0.25, 16 * z, 3.5 * z, 1 - hit);
        glow(toScreen(tx, ty, 0.2), 26 * z, 1 - seg(0.3, 0.55));
        sparks(toScreen(tx, ty, 0.2), 8, 4 * z, 26 * z * out3(hit), 1 - hit, (fx.wave || 0) * 3);
        ring(g, (fx.radius || 1.1) * U * (0.3 + 0.7 * out3(hit)), pal.light, (1 - hit) * 0.9, 2.5);
        return true;
      }

      // FLASH CADENCE: a lightning streak with golden afterimages along the way
      case 'sp_flash_step':
      // SPARK BLINK: the same streak as a blink
      case 'sp_spark_blink': {
        const a = toScreen(sx, sy, 0.5), b = toScreen(tx, ty, 0.5);
        const zap = 1 - seg(0.3, 0.9);
        bolt(a, b, 4, zap, 1);
        bolt(a, b, 2, zap * 0.7, 2, 1.6);
        for (let i = 1; i <= 3; i++) {
          const t = i / 4;
          silhouette(toScreen(sx + (tx - sx) * t, sy + (ty - sy) * t, 0), 40 * z, 0.55 * (1 - seg(t * 0.4, t * 0.4 + 0.5)), pal.accent);
        }
        const st = seg(0, 0.5), land = seg(0.1, 0.7);
        ring(toScreen(sx, sy, 0), (0.3 + 0.6 * out3(st)) * U, pal.accent, (1 - st) * 0.8, 2);
        const lr = fx.shape === 'blink' ? (fx.radius || 2) : 1.2;
        ring(toScreen(tx, ty, 0), lr * U * (0.3 + 0.7 * out3(land)), pal.light, land > 0 ? (1 - land) * 0.9 : 0, 3);
        sparks(b, 10, 6 * z, 30 * z * out3(land), land > 0 ? 1 - land : 0, 5);
        glow(b, 24 * z, 1 - seg(0.1, 0.5));
        return true;
      }

      // WHIRLING EDGE: two blades sweep the arc in opposite directions and cross in the middle
      case 'sp_whirling_edge': {
        const half = ((fx.arc || 160) * Math.PI) / 360;
        const base = Math.atan2(fx.dirY || 0, fx.dirX || 1);
        const range = fx.range || 3.5;
        const sw = out3(seg(0, 0.45)), swA = fade;
        const h1 = base - half + 2 * half * sw, h2 = base + half - 2 * half * sw;
        ribbon(tx, ty, range * 0.45, range, Math.max(base - half, h1 - 1.4), h1, 0.3, swA);
        ribbon(tx, ty, range * 0.4, range * 0.85, Math.min(base + half, h2 + 1.4), h2, 0.3, swA * 0.85);
        const cross = seg(0.2, 0.6);
        if (cross > 0 && cross < 1) {
          const p = toScreen(tx + Math.cos(base) * range * 0.8, ty + Math.sin(base) * range * 0.8, 0.3);
          glow(p, 24 * z, 1 - cross);
          sparks(p, 8, 4 * z, 26 * z * out3(cross), 1 - cross, 2);
        }
        return true;
      }

      // LIGHTNING LUNGE: a bolt rams through the target, a piercing thrust and a spark burst
      case 'sp_lightning_lunge': {
        const a = toScreen(sx, sy, 0.6), p = toScreen(tx, ty, 0.6), g = toScreen(tx, ty, 0);
        const zap = 1 - seg(0.35, 0.9);
        bolt(a, p, 5, zap, 3);
        bolt(a, p, 2, zap * 0.7, 4, 1.8);
        const ang = Math.atan2(p.y - a.y, p.x - a.x);
        const thrust = seg(0.05, 0.3);
        blade({ x: p.x + Math.cos(ang) * 12 * z * out3(thrust), y: p.y + Math.sin(ang) * 12 * z * out3(thrust) }, ang, 30 * z * out3(thrust), 6 * z, 1 - seg(0.4, 0.85));
        const hit = seg(0.15, 0.75);
        glow(p, 30 * z, 1 - seg(0.15, 0.5));
        sparks(p, 8, 6 * z, 30 * z * out3(hit), hit > 0 ? 1 - hit : 0, 9);
        ring(g, (0.3 + 1.0 * out3(hit)) * U, pal.light, hit > 0 ? (1 - hit) * 0.9 : 0, 2.5);
        ring(toScreen(sx, sy, 0), 0.6 * U, pal.accent, (1 - seg(0, 0.4)) * 0.7, 2);
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- Frost Shade (SP tier 4)
  // Glacier ghost: frost mandalas, crystals, icicles, shards
  drawFrostShadeSkill(ctx, fx, progress, toScreen, z) {
    const k = this.spFxKit(ctx, progress, toScreen, z, SP_FX_PALETTES.sp_frost_shade);
    const { pal, time, TAU, U, seg, out3, fade, c, rnd, ring, glow, bead, blade, sparks, strip, spike, silhouette, snowflake, frost, shatterBurst } = k;
    const { sx, sy, tx, ty } = k.ends(fx);
    const BY_SHAPE = {
      strike: 'sp_frozen_execution', nova: 'sp_shatter', line: 'sp_ice_spikes', blink: 'sp_cold_step',
      volley: 'sp_frost_daggers', blast: 'sp_cold_snap', buff: 'sp_frozen_veil', dash: 'sp_ice_slide'
    };

    switch (fx.skillId || BY_SHAPE[fx.shape]) {
      // FROZEN EXECUTION: a frost glyph marks the target, a great icicle drops and it all shatters
      case 'sp_frozen_execution': {
        const g = toScreen(tx, ty, 0);
        const mark = out3(seg(0, 0.35));
        frost(g, 1.6 * U * mark, fade);
        snowflake(g, 1.3 * U * mark, time * 0.5, fade * 0.8);
        const drop = seg(0.1, 0.35);
        if (drop < 1) {
          const h = 0.3 + 3 * (1 - drop * drop);
          spike(toScreen(tx, ty, h), -40 * z, 8 * z, 1);
        } else {
          const stay = 1 - seg(0.6, 1);
          spike(g, 44 * z, 9 * z, stay);
          spike({ x: g.x - 12 * z, y: g.y + 3 * z }, 24 * z, 6 * z, stay);
          spike({ x: g.x + 13 * z, y: g.y + 2 * z }, 28 * z, 6 * z, stay);
          const hit = seg(0.35, 0.85);
          glow(toScreen(tx, ty, 0.4), 34 * z, 1 - seg(0.35, 0.55));
          shatterBurst(toScreen(tx, ty, 0.5), 8, (10 + 40 * out3(hit)) * z, 1 - hit, 3);
          ring(g, (0.4 + 1.3 * out3(hit)) * U, pal.light, (1 - hit) * 0.9, 3);
        }
        return true;
      }

      // SHATTER: crystals erupt in a ring, hold, then burst apart
      case 'sp_shatter': {
        const Rw = fx.radius || 3.4, R = Rw * U;
        const g = toScreen(tx, ty, 0);
        const grow = out3(seg(0, 0.35)), brk = seg(0.45, 0.9);
        frost(g, R * grow, fade);
        snowflake(g, R * 0.6 * grow, -time * 0.4, fade * 0.5);
        for (let i = 0; i < 12; i++) {
          const a = (i * TAU) / 12 + rnd(i) * 0.2;
          const d = Rw * (0.6 + 0.35 * rnd(i + 3));
          const base = toScreen(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 0);
          const h = (18 + 16 * rnd(i + 7)) * z * grow;
          spike(base, h * (1 - brk * 0.6), 6 * z, 1 - brk);
          if (brk > 0 && brk < 1) shatterBurst({ x: base.x, y: base.y - h * 0.5 }, 3, (6 + 30 * out3(brk)) * z, 1 - brk, i * 5);
        }
        if (brk > 0) {
          ring(g, R * (0.6 + 0.5 * out3(brk)), pal.light, (1 - brk) * 0.95, 4);
          ring(g, R * (0.4 + 0.4 * out3(brk)), pal.accent, (1 - brk) * 0.6, 2);
        }
        return true;
      }

      // ICE SPIKES: crystals burst out of the ground one after another along the line
      case 'sp_ice_spikes': {
        const dx = tx - sx, dy = ty - sy, len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const w = (fx.width || 1.6) * 0.5;
        const front = seg(0, 0.4);
        strip(sx, sy, sx + dx * front, sy + dy * front, w * 0.6, w, 0);
        ctx.fillStyle = c(pal.accent, 0.18 * fade);
        ctx.fill();
        const crumble = seg(0.65, 1);
        for (let s = 0; s <= 10; s++) {
          const t = s / 10;
          const erupt = seg(t * 0.35, t * 0.35 + 0.15);
          if (erupt <= 0) continue;
          const off = (rnd(s) - 0.5) * w * 1.2;
          const base = toScreen(sx + dx * t + nx * off, sy + dy * t + ny * off, 0);
          const h = (22 + 18 * rnd(s + 4)) * z * out3(erupt) * (1 - crumble * 0.5);
          spike(base, h, 7 * z, 1 - crumble);
          spike({ x: base.x + (rnd(s + 9) > 0.5 ? 9 : -9) * z, y: base.y + 2 * z }, h * 0.5, 4 * z, 1 - crumble);
          if (erupt < 1) ring(base, 0.5 * U * erupt, pal.light, 1 - erupt, 2);
        }
        if (crumble > 0) shatterBurst(toScreen(tx, ty, 0.5), 8, (8 + 30 * out3(crumble)) * z, 1 - crumble, 11);
        return true;
      }

      // COLD STEP: leave an ice statue that cracks apart, arrive in a burst of frost
      case 'sp_cold_step': {
        const o = toScreen(sx, sy, 0), d = toScreen(tx, ty, 0);
        const r = (fx.radius || 2) * U;
        const crack = seg(0.25, 0.6);
        silhouette(o, 46 * z, 0.85 * (1 - crack), pal.light);
        if (crack > 0 && crack < 1) shatterBurst(toScreen(sx, sy, 0.6), 10, (8 + 34 * out3(crack)) * z, 1 - crack, 2);
        frost(o, r * 0.6, 1 - seg(0.3, 1));
        for (let i = 0; i <= 8; i++) {
          const t = i / 8;
          if (t > seg(0, 0.3)) break;
          bead(toScreen(sx + (tx - sx) * t, sy + (ty - sy) * t, 0.5 + rnd(i) * 0.4), 3 * z, fade * 0.7);
        }
        const land = seg(0.1, 0.65);
        frost(d, r * out3(land), fade);
        snowflake(d, r * 0.8 * out3(land), time * 0.6, land > 0 ? fade * 0.9 : 0);
        ring(d, r * (0.3 + 0.7 * out3(land)), pal.light, land > 0 ? (1 - land) * 0.9 : 0, 3);
        return true;
      }

      // FROST DAGGERS: ice daggers fly out to each target and burst into frost
      case 'sp_frost_daggers': {
        const op = toScreen(sx, sy, 0.6);
        const cast = seg(0, 0.4);
        snowflake(toScreen(sx, sy, 0), 0.8 * U * out3(cast), 0, (1 - cast) * 0.8);
        (fx.points || []).forEach((pt, i) => {
          const tp = toScreen(pt.x, pt.y, 0.6);
          const ang = Math.atan2(tp.y - op.y, tp.x - op.x);
          const fly = seg(i * 0.03, 0.35 + i * 0.03);
          if (fly > 0 && fly < 1) {
            const t = out3(fly);
            const p = { x: op.x + (tp.x - op.x) * t, y: op.y + (tp.y - op.y) * t };
            const tail = { x: op.x + (tp.x - op.x) * Math.max(0, t - 0.25), y: op.y + (tp.y - op.y) * Math.max(0, t - 0.25) };
            ctx.beginPath();
            ctx.moveTo(tail.x, tail.y);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = c(pal.accent, 0.5 * fade);
            ctx.lineWidth = 3 * z;
            ctx.stroke();
            blade(p, ang, 12 * z, 3.5 * z, fade);
          }
          const hit = seg(0.35 + i * 0.03, 0.8 + i * 0.03);
          if (hit > 0 && hit < 1) {
            const g = toScreen(pt.x, pt.y, 0);
            snowflake(g, 0.6 * U * out3(hit), i, 1 - hit);
            shatterBurst(tp, 5, (6 + 22 * out3(hit)) * z, 1 - hit, i * 7);
          }
        });
        return true;
      }

      // COLD SNAP: a frost glyph spins up at the target, then everything freezes solid at once
      case 'sp_cold_snap': {
        const Rw = fx.radius || 2.4, R = Rw * U;
        const g = toScreen(tx, ty, 0);
        const charge = out3(seg(0, 0.3)), snap = seg(0.3, 1);
        frost(g, R * charge, fade);
        snowflake(g, R * 0.9 * charge, (1 - charge) * 2 + time * 0.3, fade);
        if (snap > 0) {
          glow(toScreen(tx, ty, 0.4), 40 * z, 1 - seg(0.3, 0.5));
          for (let i = 0; i < 8; i++) {
            const a = (i * TAU) / 8 + 0.2;
            const base = toScreen(tx + Math.cos(a) * Rw * 0.7, ty + Math.sin(a) * Rw * 0.7, 0);
            spike(base, (16 + 10 * rnd(i)) * z * out3(Math.min(1, snap * 3)), 5 * z, 1 - seg(0.6, 1));
          }
          spike(g, 34 * z * out3(Math.min(1, snap * 3)), 9 * z, 1 - seg(0.6, 1));
          ring(g, R * (0.3 + 0.8 * out3(snap)), pal.light, (1 - snap) * 0.95, 4);
          sparks(toScreen(tx, ty, 0.3), 10, 6 * z, 34 * z * out3(snap), 1 - snap, 4);
        }
        return true;
      }

      // FROZEN VEIL: freezing mist wraps the shade inside a shimmering hex ward
      case 'sp_frozen_veil': {
        const g = toScreen(tx, ty, 0), mid = toScreen(tx, ty, 0.8);
        const open = out3(seg(0, 0.35));
        frost(g, 1.6 * U * open, fade);
        for (let i = 0; i < 7; i++) {
          const a = (i * TAU) / 7 + progress * 4;
          const p = toScreen(tx + Math.cos(a) * 1.1 * open, ty + Math.sin(a) * 1.1 * open, 0.3 + 0.5 * rnd(i));
          glow(p, 18 * z, 0.35 * fade, pal.light);
        }
        const hexR = 30 * z * (0.5 + 0.5 * open);
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
          const a = (i * TAU) / 6 + time * 0.5;
          const x = mid.x + Math.cos(a) * hexR, y = mid.y + Math.sin(a) * hexR * 1.15;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.fillStyle = c(pal.accent, 0.12 * fade);
        ctx.fill();
        ctx.strokeStyle = c(pal.light, fade * (0.6 + 0.3 * Math.sin(time * 8)));
        ctx.lineWidth = 2 * z;
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = (i * TAU) / 6 + time * 0.5;
          ctx.beginPath();
          ctx.moveTo(mid.x, mid.y);
          ctx.lineTo(mid.x + Math.cos(a) * hexR, mid.y + Math.sin(a) * hexR * 1.15);
          ctx.strokeStyle = c(pal.core, fade * 0.25);
          ctx.lineWidth = 1 * z;
          ctx.stroke();
        }
        for (let i = 0; i < 8; i++) {
          const t = (progress * 1.3 + rnd(i)) % 1;
          bead({ x: mid.x + (rnd(i + 5) - 0.5) * 60 * z, y: mid.y - 30 * z + t * 50 * z }, 2.5 * z, (1 - t) * fade);
        }
        ring(g, 1.4 * U * open, pal.light, fade * 0.7, 2);
        return true;
      }

      // ICE SLIDE: glide over a sheet of cracking ice, kicking up shards at the end
      case 'sp_ice_slide': {
        const dx = tx - sx, dy = ty - sy, len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const w = (fx.width || 1.2) * 0.5;
        const reach = out3(seg(0, 0.3));
        const ex = sx + dx * reach, ey = sy + dy * reach;
        const sa = toScreen(sx, sy, 0), sb = toScreen(ex, ey, 0);
        const sheen = ctx.createLinearGradient(sa.x, sa.y, sb.x, sb.y);
        sheen.addColorStop(0, c(pal.light, 0.05 * fade));
        sheen.addColorStop(1, c(pal.light, 0.3 * fade));
        strip(sx, sy, ex, ey, w * 0.3, w, 0);
        ctx.fillStyle = sheen;
        ctx.fill();
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const t = (i + 0.5) / 6;
          if (t > reach) break;
          let px = sx + dx * t, py = sy + dy * t;
          let p = toScreen(px, py, 0);
          ctx.moveTo(p.x, p.y);
          for (let j = 1; j <= 3; j++) {
            px += dx / len * 0.25 + nx * (rnd(i * 3 + j) - 0.5) * w;
            py += dy / len * 0.25 + ny * (rnd(i * 3 + j) - 0.5) * w;
            p = toScreen(px, py, 0);
            ctx.lineTo(p.x, p.y);
          }
        }
        ctx.strokeStyle = c(pal.core, 0.6 * fade);
        ctx.lineWidth = 1 * z;
        ctx.stroke();
        const a = toScreen(sx, sy, 0.3), b = toScreen(ex, ey, 0.3);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = c(pal.core, 0.8 * fade);
        ctx.lineWidth = 1.5 * z;
        ctx.stroke();
        const end = seg(0.2, 0.75);
        if (end > 0 && end < 1) {
          const e = toScreen(tx, ty, 0);
          spike({ x: e.x - 8 * z, y: e.y }, 18 * z * out3(Math.min(1, end * 3)), 5 * z, 1 - end);
          spike({ x: e.x + 8 * z, y: e.y + 2 * z }, 14 * z * out3(Math.min(1, end * 3)), 4 * z, 1 - end);
          shatterBurst(toScreen(tx, ty, 0.4), 7, (6 + 26 * out3(end)) * z, 1 - end, 21);
          ring(e, (0.3 + 0.8 * out3(end)) * U, pal.light, (1 - end) * 0.9, 2.5);
        }
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- Pyromancer (SP tier 1, mage)
  // Raw flame: walls of fire, fireballs, meteors, a phoenix
  drawPyromancerSkill(ctx, fx, progress, toScreen, z) {
    const k = this.spFxKit(ctx, progress, toScreen, z, SP_FX_PALETTES.sp_pyromancer);
    const { pal, time, TAU, U, clamp01, seg, out3, fade, c, rnd, shade, ring, pool, puff, glow, bead, lens, sparks, groundBand, strip, flame } = k;
    const { sx, sy, tx, ty } = k.ends(fx);
    // fireball at p heading along ang, with a tapering tail of embers
    const fireball = (p, rPx, ang, a, tail = 5) => {
      for (let i = tail; i >= 1; i--) {
        const d = i * rPx * 0.9;
        bead({ x: p.x - Math.cos(ang) * d, y: p.y - Math.sin(ang) * d }, rPx * (1 - i / (tail + 1)) * 0.9, a * (1 - i / (tail + 1)) * 0.8);
      }
      glow(p, rPx * 2.4, a * 0.7, pal.main);
      bead(p, rPx, a);
    };
    // a burst of flame tongues ringing p (world radius rw)
    const flameRing = (wx, wy, rw, n, h, a, seed = 0) => {
      for (let i = 0; i < n; i++) {
        const ang = (i * TAU) / n + rnd(seed + i) * 0.4;
        const p = toScreen(wx + Math.cos(ang) * rw, wy + Math.sin(ang) * rw, 0);
        flame(p, h * (0.7 + 0.5 * rnd(seed + i + 20)), h * 0.32, a, seed + i);
      }
    };
    const BY_SHAPE = {
      cone: 'sp_flame_wave', volley: 'sp_ember_volley', pulse: 'sp_sunburst', dash: 'sp_flame_step',
      blast: 'sp_meteor_call', chain: 'sp_fire_chain', rain: 'sp_cinder_rain', blink: 'sp_phoenix_blink'
    };

    switch (fx.skillId || BY_SHAPE[fx.shape]) {
      // FLAME WAVE: a wall of fire rolls out across the cone, leaving scorched ground
      case 'sp_flame_wave': {
        const half = ((fx.arc || 70) * Math.PI) / 360;
        const base = Math.atan2(fx.dirY || 0, fx.dirX || 1);
        const range = fx.range || 5;
        const reach = range * (0.15 + 0.85 * out3(seg(0, 0.55)));
        shade(() => {
          groundBand(tx, ty, 0.4, reach, base - half, base + half, 0);
          ctx.fillStyle = `rgba(${pal.deep}, ${0.25 * fade})`;
          ctx.fill();
        });
        // glowing band just behind the front, then the wall itself in two ranks
        const wallA = 1 - seg(0.55, 0.95);
        groundBand(tx, ty, Math.max(0.4, reach - 1.4), reach, base - half, base + half, 0);
        ctx.fillStyle = c(pal.accent, 0.4 * wallA);
        ctx.fill();
        for (const [rank, n, hMul] of [[0.82, 9, 0.7], [1, 14, 1]]) {
          for (let i = 0; i < n; i++) {
            const a = base - half + ((i + 0.5) / n) * half * 2;
            const d = reach * rank * (0.95 + 0.05 * rnd(i + rank * 50));
            const p = toScreen(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 0);
            flame(p, (26 + 16 * rnd(i + 5)) * z * hMul * (0.6 + 0.4 * out3(seg(0, 0.3))), 9 * z, wallA, i + rank * 20);
          }
        }
        for (let i = 0; i < 10; i++) {
          const a = base + (rnd(i + 40) * 2 - 1) * half;
          const d = reach * rnd(i + 41);
          const p = toScreen(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 0.2 + progress * 1.4 + rnd(i + 42));
          bead(p, 2.5 * z, fade * 0.9);
        }
        return true;
      }

      // EMBER VOLLEY: fireballs arc out to each target and burst into flame
      case 'sp_ember_volley': {
        const op = toScreen(sx, sy, 0.8);
        const cast = seg(0, 0.4);
        glow(op, 26 * z, (1 - cast) * 0.9);
        ring(toScreen(sx, sy, 0), (0.5 + 0.6 * out3(cast)) * U, pal.accent, (1 - cast) * 0.8, 2);
        (fx.points || []).forEach((pt, i) => {
          const tp = toScreen(pt.x, pt.y, 0.5);
          const at = (t) => ({ x: op.x + (tp.x - op.x) * t, y: op.y + (tp.y - op.y) * t - Math.sin(t * Math.PI) * 30 * z });
          const fly = seg(i * 0.05, 0.4 + i * 0.05);
          if (fly > 0 && fly < 1) {
            const p = at(fly), q = at(Math.min(1, fly + 0.02));
            fireball(p, 6 * z, Math.atan2(q.y - p.y, q.x - p.x), 1);
          }
          const hit = seg(0.4 + i * 0.05, 0.85 + i * 0.05);
          if (hit > 0 && hit < 1) {
            const g = toScreen(pt.x, pt.y, 0);
            glow(tp, 28 * z, 1 - seg(0.4 + i * 0.05, 0.6 + i * 0.05));
            pool(g, 0.7 * U, 0.5 * (1 - hit));
            flameRing(pt.x, pt.y, 0.35 * out3(hit), 5, 18 * z * (1 - hit * 0.5), 1 - hit, i * 9);
            ring(g, (0.3 + 0.8 * out3(hit)) * U, pal.light, (1 - hit) * 0.9, 2.5);
            sparks(tp, 7, 4 * z, 22 * z * out3(hit), 1 - hit, i * 3);
          }
        });
        return true;
      }

      // SUNBURST: a small sun flares over the caster; each wave rolls a ring of fire outward
      case 'sp_sunburst': {
        const Rw = fx.radius || 4, R = Rw * U;
        const g = toScreen(tx, ty, 0);
        const wave = fx.wave || 0;
        const roll = out3(seg(0, 0.7));
        if (wave === 0) {
          const sun = toScreen(tx, ty, 1.8);
          glow(sun, 40 * z, fade);
          bead(sun, 12 * z, fade);
          // corona rays scorched on the ground
          ctx.save();
          ctx.translate(g.x, g.y);
          ctx.scale(1, 0.5);
          for (let i = 0; i < 12; i++) {
            const a = (i * TAU) / 12 + time * 0.3;
            const len = R * (i % 2 ? 0.7 : 1) * roll;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a - 0.08) * R * 0.15, Math.sin(a - 0.08) * R * 0.15);
            ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
            ctx.lineTo(Math.cos(a + 0.08) * R * 0.15, Math.sin(a + 0.08) * R * 0.15);
            ctx.closePath();
            ctx.fillStyle = c(i % 2 ? pal.main : pal.accent, 0.5 * fade);
            ctx.fill();
          }
          ctx.restore();
        }
        const rw = Rw * (0.2 + 0.8 * roll);
        ring(g, rw * U, pal.accent, (1 - roll) * 0.6 + 0.2 * fade, 8);
        ring(g, rw * U, pal.core, (1 - roll) * 0.9, 2);
        flameRing(tx, ty, rw, 14, 22 * z, (1 - seg(0.4, 0.9)), wave * 31);
        return true;
      }

      // FLAME STEP: dash leaving a trail of burning footprints
      case 'sp_flame_step': {
        const reach = out3(seg(0, 0.3));
        const ex = sx + (tx - sx) * reach, ey = sy + (ty - sy) * reach;
        shade(() => {
          strip(sx, sy, ex, ey, 0.15, (fx.width || 1.2) * 0.45, 0);
          ctx.fillStyle = `rgba(${pal.deep}, ${0.5 * fade})`;
          ctx.fill();
        });
        const a = toScreen(sx, sy, 0.3), b = toScreen(ex, ey, 0.3);
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, c(pal.main, 0));
        grad.addColorStop(1, c(pal.accent, 0.9 * fade));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 10 * z;
        ctx.stroke();
        ctx.strokeStyle = c(pal.core, 0.8 * fade);
        ctx.lineWidth = 2 * z;
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const t = (i + 0.5) / 8;
          if (t > reach) break;
          const life = 1 - seg(t * 0.3 + 0.2, t * 0.3 + 0.75);
          flame(toScreen(sx + (tx - sx) * t, sy + (ty - sy) * t, 0), (14 + 8 * rnd(i)) * z * life, 6 * z, life, i);
        }
        const land = seg(0.2, 0.7);
        if (land > 0 && land < 1) {
          glow(toScreen(tx, ty, 0.4), 30 * z, 1 - land);
          ring(toScreen(tx, ty, 0), (0.3 + 0.9 * out3(land)) * U, pal.light, 1 - land, 3);
        }
        return true;
      }

      // METEOR CALL: a burning rock streaks down onto the target and blows a crater
      case 'sp_meteor_call': {
        const R = (fx.radius || 2.6) * U;
        const g = toScreen(tx, ty, 0);
        const fall = seg(0, 0.35), boom = seg(0.35, 1);
        if (fall < 1) {
          ctx.setLineDash([6 * z, 6 * z]);
          ring(g, R, pal.main, 0.5 + 0.3 * Math.sin(time * 18), 2);
          ctx.setLineDash([]);
          pool(g, R * (0.2 + 0.6 * fall), 0.4);
          // comes in at an angle from high up-left
          const t = fall * fall;
          const from = { x: tx - 2.5, y: ty - 2.5, h: 6.5 };
          const wx = from.x + (tx - from.x) * t, wy = from.y + (ty - from.y) * t, wh = from.h * (1 - t) + 0.4;
          const p = toScreen(wx, wy, wh), q = toScreen(tx, ty, 0.4);
          const ang = Math.atan2(q.y - p.y, q.x - p.x);
          for (let i = 1; i <= 8; i++) {
            const tp = { x: p.x - Math.cos(ang) * i * 9 * z, y: p.y - Math.sin(ang) * i * 9 * z };
            puff(tp, (6 + i * 2.2) * z, 0.35 * (1 - i / 9));
          }
          fireball(p, 13 * z, ang, 1, 7);
          shade(() => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 7 * z, 0, TAU);
            ctx.fillStyle = `rgba(${pal.deep2}, 0.85)`;
            ctx.fill();
          });
          return true;
        }
        const flash = 1 - seg(0.35, 0.55);
        glow(toScreen(tx, ty, 0.4), R * 0.9, flash);
        pool(g, R * 0.85, 0.7 * fade);
        ring(g, R * (0.3 + 0.9 * out3(boom)), pal.light, (1 - boom) * 0.95, 5);
        ring(g, R * (0.2 + 0.6 * out3(boom)), pal.main, (1 - boom) * 0.7, 2.5);
        flameRing(tx, ty, (fx.radius || 2.6) * 0.55, 9, 30 * z * (1 - boom * 0.6), 1 - seg(0.5, 1), 77);
        flame(toScreen(tx, ty, 0), 40 * z * (1 - boom), 12 * z, 1 - boom, 3);
        // rock debris thrown out
        for (let i = 0; i < 8; i++) {
          const a = (i * TAU) / 8 + rnd(i + 60) * 0.5;
          const d = (10 + 50 * out3(boom)) * z;
          const p = { x: g.x + Math.cos(a) * d, y: g.y + Math.sin(a) * d * 0.5 - Math.sin(boom * Math.PI) * 26 * z };
          shade(() => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3 * z, 0, TAU);
            ctx.fillStyle = `rgba(${pal.deep2}, ${1 - boom})`;
            ctx.fill();
          });
          bead(p, 3 * z, (1 - boom) * 0.8);
        }
        return true;
      }

      // FIRE CHAIN: a lash of fire leaps from foe to foe, each one flowering into flame
      case 'sp_fire_chain': {
        const nodes = [{ x: sx, y: sy }, ...(fx.points || [])];
        for (let i = 0; i < nodes.length - 1; i++) {
          const reach = out3(seg(i * 0.07, i * 0.07 + 0.14));
          if (reach <= 0) break;
          const p0 = toScreen(nodes[i].x, nodes[i].y, 0.6), p1 = toScreen(nodes[i + 1].x, nodes[i + 1].y, 0.6);
          const cx = (p0.x + p1.x) / 2, cy = (p0.y + p1.y) / 2 - 22 * z;
          const at = (t) => ({
            x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * cx + t * t * p1.x,
            y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * cy + t * t * p1.y + Math.sin(t * 14 - time * 18) * 3 * z * Math.sin(t * Math.PI)
          });
          const lashA = 1 - seg(0.55, 0.95);
          for (const [w, rgb, al] of [[9, pal.main, 0.45], [4, pal.accent, 0.9], [1.5, pal.core, 0.9]]) {
            ctx.beginPath();
            for (let s = 0; s <= 18; s++) {
              const p = at((s / 18) * reach);
              if (s === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
            }
            ctx.strokeStyle = c(rgb, lashA * al);
            ctx.lineWidth = w * z;
            ctx.stroke();
          }
          if (reach < 1) {
            fireball(at(reach), 5 * z, 0, 1, 0);
            continue;
          }
          const bloom = seg(i * 0.07 + 0.14, i * 0.07 + 0.6);
          glow(p1, 22 * z, 1 - bloom);
          flameRing(nodes[i + 1].x, nodes[i + 1].y, 0.3 * out3(bloom), 5, 16 * z, 1 - bloom, i * 13);
          ring(toScreen(nodes[i + 1].x, nodes[i + 1].y, 0), (0.3 + 0.6 * out3(bloom)) * U, pal.light, (1 - bloom) * 0.9, 2);
        }
        return true;
      }

      // CINDER RAIN: burning cinders streak down across the area
      case 'sp_cinder_rain': {
        const g = toScreen(tx, ty, 0);
        if (fx.areaR && !fx.wave) {
          ctx.setLineDash([6 * z, 6 * z]);
          ring(toScreen(fx.areaX, fx.areaY, 0), fx.areaR * U, pal.main, fade * 0.6, 1.5);
          ctx.setLineDash([]);
        }
        const fall = seg(0, 0.35);
        if (fall < 1) {
          const t = fall * fall;
          const p = toScreen(tx - 1.2 * (1 - t), ty - 1.2 * (1 - t), 5 * (1 - t) + 0.3);
          const q = toScreen(tx, ty, 0.3);
          fireball(p, 6 * z, Math.atan2(q.y - p.y, q.x - p.x), 1, 5);
          return true;
        }
        const hit = seg(0.35, 1);
        glow(toScreen(tx, ty, 0.3), 24 * z, 1 - seg(0.35, 0.55));
        pool(g, (fx.radius || 1.2) * U * 0.6, 0.45 * (1 - hit));
        flame(g, 22 * z * (1 - hit), 8 * z, 1 - hit, fx.wave || 0);
        ring(g, (fx.radius || 1.2) * U * (0.3 + 0.7 * out3(hit)), pal.light, (1 - hit) * 0.9, 2.5);
        sparks(toScreen(tx, ty, 0.2), 6, 3 * z, 18 * z * out3(hit), 1 - hit, (fx.wave || 0) * 5);
        return true;
      }

      // PHOENIX BLINK: burst into flame, fly across as a phoenix, land with wings spread
      case 'sp_phoenix_blink': {
        const r = (fx.radius || 2.4) * U;
        const burst = seg(0, 0.5), land = seg(0.3, 0.85);
        const o = toScreen(sx, sy, 0), d = toScreen(tx, ty, 0);
        if (fx.origin) {
          ring(o, r * (0.3 + 0.7 * out3(burst)), pal.accent, (1 - burst) * 0.9, 4);
          flameRing(sx, sy, (fx.radius || 2.4) * 0.5 * out3(burst), 8, 22 * z, 1 - burst, 5);
        }
        pool(o, r * 0.6, 0.45 * (1 - seg(0.2, 1)));
        // the phoenix in flight
        const fly = seg(0.05, 0.45);
        if (fly > 0 && fly < 1) {
          const t = out3(fly);
          const p = toScreen(sx + (tx - sx) * t, sy + (ty - sy) * t, 0.8 + Math.sin(t * Math.PI) * 1.6);
          const q = toScreen(tx, ty, 0.8);
          const ang = Math.atan2(q.y - p.y, q.x - p.x);
          const flap = Math.sin(time * 22) * 0.35;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(ang);
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(4 * z, 0);
            ctx.quadraticCurveTo(-6 * z, side * (22 + flap * 10) * z, -22 * z, side * (26 + flap * 12) * z);
            ctx.quadraticCurveTo(-12 * z, side * 8 * z, -10 * z, 0);
            ctx.closePath();
            const wg = ctx.createLinearGradient(0, 0, -20 * z, side * 24 * z);
            wg.addColorStop(0, c(pal.core, 0.95));
            wg.addColorStop(0.5, c(pal.accent, 0.85));
            wg.addColorStop(1, c(pal.main, 0.2));
            ctx.fillStyle = wg;
            ctx.fill();
          }
          // tail plumes
          for (const s of [-0.25, 0, 0.25]) lens({ x: -22 * z, y: s * 20 * z }, s, 16 * z, 3 * z, pal.accent, 0.8);
          ctx.restore();
          glow(p, 22 * z, 0.8);
          bead(p, 6 * z, 1);
          for (let i = 1; i <= 6; i++) {
            const tt = Math.max(0, t - i * 0.05);
            bead(toScreen(sx + (tx - sx) * tt, sy + (ty - sy) * tt, 0.8 + Math.sin(tt * Math.PI) * 1.6), 4 * z * (1 - i / 7), 0.7 * (1 - i / 7));
          }
        }
        if (land > 0 && land < 1) {
          const la = 1 - land;
          glow(toScreen(tx, ty, 0.6), 40 * z, la);
          // wings flared over the landing point
          const p = toScreen(tx, ty, 1.2);
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y + 8 * z);
            ctx.quadraticCurveTo(p.x + side * 30 * z, p.y - 24 * z * out3(land), p.x + side * 46 * z, p.y - 6 * z);
            ctx.quadraticCurveTo(p.x + side * 22 * z, p.y, p.x, p.y + 8 * z);
            ctx.fillStyle = c(pal.accent, la * 0.7);
            ctx.fill();
          }
          ring(d, (fx.landing ? r : r * 0.5) * (0.3 + 0.7 * out3(land)), pal.light, la * 0.95, 3.5);
          flameRing(tx, ty, 0.6 * out3(land), 7, 20 * z, la, 17);
        }
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- Cryo Sage (SP tier 2, mage)
  // Arcane winter: glyphs, lances, a frozen orb, a glacier dome
  drawCryoSageSkill(ctx, fx, progress, toScreen, z) {
    const k = this.spFxKit(ctx, progress, toScreen, z, SP_FX_PALETTES.sp_cryo_sage);
    const { pal, time, TAU, U, seg, out3, fade, c, rnd, ring, glow, bead, lens, blade, sparks, groundBand, strip, spike, silhouette, snowflake, frost, shatterBurst } = k;
    const { sx, sy, tx, ty } = k.ends(fx);
    // faceted ice spear pointing along ang, tip at p
    const lance = (p, ang, L, w, a) => {
      if (a <= 0.01) return;
      const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
      const back = { x: p.x - dx * L, y: p.y - dy * L };
      const mid = { x: p.x - dx * L * 0.35, y: p.y - dy * L * 0.35 };
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(mid.x + nx * w, mid.y + ny * w);
      ctx.lineTo(back.x, back.y);
      ctx.lineTo(mid.x - nx * w, mid.y - ny * w);
      ctx.closePath();
      const g = ctx.createLinearGradient(back.x, back.y, p.x, p.y);
      g.addColorStop(0, c(pal.main, a * 0.3));
      g.addColorStop(0.6, c(pal.accent, a * 0.85));
      g.addColorStop(1, c(pal.core, a));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(back.x, back.y);
      ctx.strokeStyle = c(pal.core, a * 0.7);
      ctx.lineWidth = 1 * z;
      ctx.stroke();
    };
    const BY_SHAPE = {
      line: 'sp_ice_lance', pulse: 'sp_frozen_orb', nova: 'sp_permafrost', blink: 'sp_ice_blink',
      volley: 'sp_ice_shards', cone: 'sp_frost_cone', pull: 'sp_glacial_pull', dash: 'sp_frost_slide'
    };

    switch (fx.skillId || BY_SHAPE[fx.shape]) {
      // ICE LANCE: a crystal spear streaks down the line, crystals sprout in its wake, it shatters at the end
      case 'sp_ice_lance': {
        const dx = tx - sx, dy = ty - sy, len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const fly = out3(seg(0, 0.35));
        const hx = sx + dx * fly, hy = sy + dy * fly;
        const a = toScreen(sx, sy, 0), b = toScreen(hx, hy, 0);
        const sheen = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        sheen.addColorStop(0, c(pal.light, 0.05 * fade));
        sheen.addColorStop(1, c(pal.light, 0.35 * fade));
        strip(sx, sy, hx, hy, 0.15, (fx.width || 1) * 0.5, 0);
        ctx.fillStyle = sheen;
        ctx.fill();
        for (let i = 1; i <= 7; i++) {
          const t = i / 8;
          if (t > fly) break;
          const off = (rnd(i) - 0.5) * 0.7;
          const g = toScreen(sx + dx * t + nx * off, sy + dy * t + ny * off, 0);
          const grow = out3(seg(t * 0.35, t * 0.35 + 0.15));
          spike(g, (10 + 8 * rnd(i + 3)) * z * grow, 4 * z, 1 - seg(0.6, 1));
        }
        if (fly < 1 || progress < 0.4) {
          const p = toScreen(hx, hy, 0.7), q = toScreen(sx, sy, 0.7);
          const ang = Math.atan2(p.y - q.y, p.x - q.x);
          glow(p, 22 * z, 1 - seg(0.35, 0.45));
          lance(p, ang, 40 * z, 6 * z, 1 - seg(0.35, 0.45));
        }
        const brk = seg(0.35, 0.85);
        if (brk > 0 && brk < 1) {
          shatterBurst(toScreen(tx, ty, 0.6), 10, (8 + 36 * out3(brk)) * z, 1 - brk, 4);
          ring(toScreen(tx, ty, 0), (0.3 + 1.0 * out3(brk)) * U, pal.light, 1 - brk, 3);
          snowflake(toScreen(tx, ty, 0), 0.9 * U * out3(brk), brk, 1 - brk);
        }
        return true;
      }

      // FROZEN ORB: a slowly turning orb of ice hangs over the target, each pulse throws shards out
      case 'sp_frozen_orb': {
        const R = (fx.radius || 2.6) * U;
        const g = toScreen(tx, ty, 0), o = toScreen(tx, ty, 1.4);
        const wave = fx.wave || 0;
        if (wave === 0) {
          frost(g, R, fade);
          snowflake(g, R * 0.85 * out3(seg(0, 0.4)), time * 0.4, fade * 0.7);
        }
        // the orb itself: frosted sphere with a turning flake inside
        glow(o, 42 * z, fade * 0.6);
        ctx.beginPath();
        ctx.arc(o.x, o.y, 16 * z, 0, TAU);
        ctx.fillStyle = c(pal.accent, 0.25 * fade);
        ctx.fill();
        ctx.strokeStyle = c(pal.core, 0.8 * fade);
        ctx.lineWidth = 1.5 * z;
        ctx.stroke();
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(time * 2 + wave);
        for (let i = 0; i < 3; i++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath();
          ctx.moveTo(-12 * z, 0);
          ctx.lineTo(12 * z, 0);
          ctx.strokeStyle = c(pal.core, 0.7 * fade);
          ctx.lineWidth = 1.4 * z;
          ctx.stroke();
        }
        ctx.restore();
        // this pulse's shards and ring
        const burst = seg(0, 0.6);
        for (let i = 0; i < 8; i++) {
          const a = (i * TAU) / 8 + wave * 0.4;
          const d = (14 + (R * 0.9 - 14) * out3(burst));
          blade({ x: o.x + Math.cos(a) * d, y: o.y + Math.sin(a) * d * 0.55 + out3(burst) * 16 * z }, a, 7 * z, 2.5 * z, 1 - burst);
        }
        ring(g, R * (0.2 + 0.8 * out3(burst)), pal.light, (1 - burst) * 0.85, 2.5);
        return true;
      }

      // PERMAFROST: the ground freezes over, a wall of ice erupts around the sage under a frost dome
      case 'sp_permafrost': {
        const Rw = fx.radius || 5, R = Rw * U;
        const g = toScreen(tx, ty, 0);
        const spread = out3(seg(0, 0.45));
        frost(g, R * spread, fade);
        snowflake(g, R * 0.7 * spread, time * 0.2, fade * 0.8);
        for (let i = 0; i < 18; i++) {
          const a = (i * TAU) / 18 + rnd(i) * 0.15;
          const d = Rw * (0.82 + 0.1 * rnd(i + 3));
          const rise = out3(seg(0.15 + rnd(i + 7) * 0.15, 0.45 + rnd(i + 7) * 0.15));
          spike(toScreen(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 0), (20 + 16 * rnd(i + 9)) * z * rise, 6 * z, 1 - seg(0.7, 1));
        }
        const wv = seg(0.1, 0.6);
        ring(g, R * out3(wv), pal.core, (1 - wv) * 0.9, 3);
        // frost dome (the shield) over the sage
        const dome = out3(seg(0.1, 0.4));
        const top = toScreen(tx, ty, 1.6 * dome);
        const rx = 1.2 * U * dome;
        if (rx > 1) {
          ctx.beginPath();
          ctx.ellipse(g.x, g.y, rx, rx * 0.5, 0, 0, Math.PI);
          ctx.quadraticCurveTo(g.x - rx, top.y, g.x, top.y);
          ctx.quadraticCurveTo(g.x + rx, top.y, g.x + rx, g.y);
          ctx.fillStyle = c(pal.accent, 0.15 * fade);
          ctx.fill();
          ctx.strokeStyle = c(pal.light, (0.5 + 0.3 * Math.sin(time * 6)) * fade);
          ctx.lineWidth = 1.5 * z;
          ctx.stroke();
        }
        return true;
      }

      // ICE BLINK: leave a frozen statue that bursts into spikes, reappear in a glitter of frost
      case 'sp_ice_blink': {
        const r = (fx.radius || 2.4) * U;
        const o = toScreen(sx, sy, 0), d = toScreen(tx, ty, 0);
        const burst = seg(0.1, 0.55);
        frost(o, r, fade);
        silhouette(o, 46 * z, 0.85 * (1 - seg(0.4, 0.7)), pal.light);
        for (let i = 0; i < 10; i++) {
          const a = (i * TAU) / 10 + 0.3;
          const dd = (fx.radius || 2.4) * (0.4 + 0.5 * rnd(i));
          spike(toScreen(sx + Math.cos(a) * dd, sy + Math.sin(a) * dd, 0), (14 + 10 * rnd(i + 4)) * z * out3(burst), 5 * z, 1 - seg(0.6, 1));
        }
        ring(o, r * (0.3 + 0.7 * out3(burst)), pal.core, burst > 0 ? (1 - burst) * 0.9 : 0, 3);
        if (burst > 0.3) shatterBurst(toScreen(sx, sy, 0.6), 10, (10 + 34 * out3(seg(0.4, 0.8))) * z, 1 - seg(0.4, 0.9), 8);
        for (let i = 0; i <= 8; i++) {
          const t = i / 8;
          if (t > seg(0, 0.3)) break;
          bead(toScreen(sx + (tx - sx) * t, sy + (ty - sy) * t, 0.6 + Math.sin(t * Math.PI) * 0.6), 3 * z, fade * 0.8);
        }
        const land = seg(0.15, 0.6);
        snowflake(d, 0.7 * U * out3(land), time, land > 0 ? fade : 0);
        sparks(toScreen(tx, ty, 0.5), 8, 4 * z, 22 * z * out3(land), land > 0 ? 1 - land : 0, 2);
        return true;
      }

      // ICE SHARDS: a fan of spinning ice shards flies to each target and bursts
      case 'sp_ice_shards': {
        const op = toScreen(sx, sy, 0.8);
        glow(op, 22 * z, 1 - seg(0, 0.35));
        (fx.points || []).forEach((pt, i) => {
          const tp = toScreen(pt.x, pt.y, 0.6);
          const fly = out3(seg(i * 0.03, 0.35 + i * 0.03));
          if (fly > 0 && fly < 1) {
            const p = { x: op.x + (tp.x - op.x) * fly, y: op.y + (tp.y - op.y) * fly };
            const ang = Math.atan2(tp.y - op.y, tp.x - op.x);
            for (let j = 3; j >= 1; j--) {
              const tt = Math.max(0, fly - j * 0.06);
              bead({ x: op.x + (tp.x - op.x) * tt, y: op.y + (tp.y - op.y) * tt }, 3 * z, 0.5 / j);
            }
            lance(p, ang, 18 * z, 4 * z, 1);
          }
          const hit = seg(0.35 + i * 0.03, 0.8 + i * 0.03);
          if (hit > 0 && hit < 1) {
            const g = toScreen(pt.x, pt.y, 0);
            spike(g, 16 * z * out3(Math.min(1, hit * 3)), 5 * z, 1 - hit);
            snowflake(g, 0.5 * U * out3(hit), i, 1 - hit);
            shatterBurst(tp, 5, (6 + 18 * out3(hit)) * z, 1 - hit, i * 3);
          }
        });
        return true;
      }

      // FROST CONE: a blizzard breath; snow streams out and crystals form along its edge
      case 'sp_frost_cone': {
        const half = ((fx.arc || 80) * Math.PI) / 360;
        const base = Math.atan2(fx.dirY || 0, fx.dirX || 1);
        const range = fx.range || 5;
        const reach = range * out3(seg(0, 0.45));
        groundBand(tx, ty, 0.3, Math.max(0.35, reach), base - half, base + half, 0);
        ctx.fillStyle = c(pal.accent, 0.08 * fade);
        ctx.fill();
        for (let i = 0; i < 28; i++) {
          const a = base + (rnd(i) * 2 - 1) * half;
          const t = (progress * 1.6 + rnd(i + 30)) % 1;
          const d = range * t * out3(seg(0, 0.3));
          const p = toScreen(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 0.4 + rnd(i + 60) * 0.6);
          lens(p, Math.atan2(Math.sin(a) * 0.5, Math.cos(a)), 7 * z, 1.6 * z, pal.core, (1 - t) * fade * 0.9);
        }
        for (let i = 0; i < 9; i++) {
          const a = base - half + ((i + 0.5) / 9) * half * 2;
          const d = reach * (0.9 + 0.1 * rnd(i + 90));
          spike(toScreen(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 0), (12 + 10 * rnd(i + 91)) * z * out3(seg(0.25, 0.5)), 4.5 * z, 1 - seg(0.6, 1));
        }
        return true;
      }

      // GLACIAL PULL: a frost vortex drags shards inward, then a great ice pillar erupts at its heart
      case 'sp_glacial_pull': {
        const Rw = fx.radius || 4, R = Rw * U;
        const g = toScreen(tx, ty, 0);
        const inward = out3(seg(0, 0.6)), erupt = seg(0.55, 1);
        frost(g, R, fade);
        ring(g, R, pal.accent, fade * 0.7, 2);
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.scale(1, 0.5);
        for (let i = 0; i < 6; i++) {
          const a0 = (i * TAU) / 6 + time * 3;
          ctx.beginPath();
          for (let s = 0; s <= 10; s++) {
            const t = s / 10, rr = R * (1 - t), a = a0 + t * 2.4;
            if (s === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          ctx.strokeStyle = c(pal.light, fade * 0.55);
          ctx.lineWidth = 2 * z;
          ctx.stroke();
        }
        ctx.restore();
        if (erupt < 1) {
          for (let i = 0; i < 10; i++) {
            const a = (i * TAU) / 10 + progress * 6;
            const rr = Rw * (0.95 - 0.85 * inward);
            const p = toScreen(tx + Math.cos(a) * rr, ty + Math.sin(a) * rr, 0.5);
            const q = toScreen(tx, ty, 0.5);
            lance(p, Math.atan2(q.y - p.y, q.x - p.x), 12 * z, 3 * z, 1 - erupt);
          }
        }
        if (erupt > 0) {
          const h = 48 * z * out3(Math.min(1, erupt * 3)) * (1 - seg(0.85, 1) * 0.4);
          spike(g, h, 11 * z, 1 - seg(0.8, 1));
          spike({ x: g.x - 12 * z, y: g.y + 3 * z }, h * 0.55, 6 * z, 1 - seg(0.8, 1));
          spike({ x: g.x + 13 * z, y: g.y + 2 * z }, h * 0.6, 6 * z, 1 - seg(0.8, 1));
          ring(g, R * 0.7 * out3(erupt), pal.core, 1 - erupt, 3.5);
          glow(toScreen(tx, ty, 0.6), 36 * z, 1 - seg(0.55, 0.75));
        }
        return true;
      }

      // FROST SLIDE: skate away on blades of ice, leaving twin grooves and a puff of snow
      case 'sp_frost_slide': {
        const dx = tx - sx, dy = ty - sy, len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len * 0.3, ny = dx / len * 0.3;
        const reach = out3(seg(0, 0.3));
        const ex = sx + dx * reach, ey = sy + dy * reach;
        strip(sx, sy, ex, ey, 0.2, (fx.width || 1.2) * 0.5, 0);
        ctx.fillStyle = c(pal.light, 0.2 * fade);
        ctx.fill();
        for (const s of [-1, 1]) {
          const a = toScreen(sx + nx * s, sy + ny * s, 0), b = toScreen(ex + nx * s, ey + ny * s, 0);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = c(pal.core, 0.85 * fade);
          ctx.lineWidth = 1.5 * z;
          ctx.stroke();
        }
        for (let i = 0; i < 6; i++) {
          const t = (i + 0.5) / 6;
          if (t > reach) break;
          const p = toScreen(sx + dx * t, sy + dy * t, 0.2 + rnd(i) * 0.4);
          sparks(p, 4, 1 * z, 8 * z, fade * (1 - t * 0.5), i * 7);
        }
        const st = seg(0, 0.5);
        snowflake(toScreen(sx, sy, 0), 0.6 * U * out3(st), 0, 1 - st);
        const end = seg(0.2, 0.7);
        if (end > 0 && end < 1) {
          shatterBurst(toScreen(tx, ty, 0.3), 8, (6 + 24 * out3(end)) * z, 1 - end, 12);
          ring(toScreen(tx, ty, 0), (0.3 + 0.8 * out3(end)) * U, pal.light, 1 - end, 2.5);
        }
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- per-card basic attacks
  // Card flourish layered on a basic swing, drawn in drawSweepSlash's local
  // frame (squashed to the ground, rotated to the facing, additive)
  drawSweepAccent(ctx, fx, s) {
    const { outerR, thick, head, fromA, fade, eased, z } = s;
    const time = this.animations.time;
    const at = (a, r) => ({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    const along = (k) => fromA + (head - fromA) * k;
    const rgba = (rgb, a) => `rgba(${rgb}, ${Math.max(0, Math.min(1, a))})`;
    const seed = fx.x * 7.3 + fx.y * 3.1;
    const rnd = (n) => { const v = Math.sin((n + seed) * 127.1) * 43758.5453; return v - Math.floor(v); };
    const step = Math.floor(time * 24); // re-rolls jagged lines (lightning, cracks) 24x a second
    const dotGlow = (p, r, rgb, a) => {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, rgba('255, 255, 255', a));
      g.addColorStop(0.4, rgba(rgb, a * 0.7));
      g.addColorStop(1, rgba(rgb, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    const stroke = (rgb, a, w) => { ctx.strokeStyle = rgba(rgb, a); ctx.lineWidth = w * z; ctx.stroke(); };
    const tip = at(head, outerR - thick * 0.25);
    ctx.save();
    ctx.lineCap = 'round';
    switch (fx.cardId) {
      case 'sp_crusader': { // rays of light fan out along the swing, a cross gleams at the tip
        for (let i = 0; i < 4; i++) {
          const p = at(along(0.2 + i * 0.25), outerR * 1.2);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(p.x, p.y);
          stroke('253, 224, 71', fade * 0.3, 3);
        }
        const L = 11 * z * (0.6 + 0.4 * eased);
        ctx.beginPath();
        ctx.moveTo(tip.x - L, tip.y); ctx.lineTo(tip.x + L, tip.y);
        ctx.moveTo(tip.x, tip.y - L * 1.5); ctx.lineTo(tip.x, tip.y + L * 1.5);
        stroke('255, 251, 235', fade, 2.2);
        dotGlow(tip, 16 * z, '253, 224, 71', fade);
        break;
      }
      case 'sp_berserker': { // three ragged claw marks and flung blood
        for (const [k, w] of [[1.1, 2.6], [0.92, 3.2], [0.74, 2.4]]) {
          ctx.beginPath();
          ctx.arc(0, 0, outerR * k, along(0.25), head, head < fromA);
          stroke('239, 68, 68', fade * 0.9, w);
          stroke('254, 202, 202', fade * 0.6, w * 0.35);
        }
        for (let i = 0; i < 6; i++) {
          const p = at(along(0.3 + 0.7 * rnd(i)), outerR * (1.1 + 0.3 * (1 - fade)) + rnd(i + 9) * 8 * z);
          dotGlow(p, 3.5 * z, '220, 38, 38', fade);
        }
        break;
      }
      case 'sp_frost_templar': { // ice shards jut out of the blade's path
        for (let i = 0; i < 6; i++) {
          const k = (i + 0.5) / 6;
          if (k > eased + 0.1) break;
          const a = along(k), b = at(a, outerR), t = at(a, outerR + (10 + 6 * rnd(i)) * z);
          const n = { x: -Math.sin(a) * 3 * z, y: Math.cos(a) * 3 * z };
          ctx.beginPath();
          ctx.moveTo(b.x + n.x, b.y + n.y); ctx.lineTo(t.x, t.y); ctx.lineTo(b.x - n.x, b.y - n.y); ctx.closePath();
          ctx.fillStyle = rgba('165, 243, 252', fade * 0.85);
          ctx.fill();
          stroke('240, 249, 255', fade, 1);
        }
        break;
      }
      case 'sp_storm_herald': { // lightning crawls along the edge and forks outward
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) {
          const a = along(0.15 + 0.85 * i / 10);
          const p = at(a, outerR + (rnd(i * 7 + step) - 0.5) * 10 * z);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        stroke('250, 204, 21', fade * 0.8, 3);
        stroke('255, 255, 255', fade, 1.2);
        for (let j = 0; j < 2; j++) {
          const a = along(0.5 + j * 0.4), p0 = at(a, outerR);
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
          const p1 = at(a + (rnd(j + step) - 0.5) * 0.3, outerR + 12 * z), p2 = at(a + (rnd(j + 5 + step) - 0.5) * 0.4, outerR + 22 * z);
          ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
          stroke('254, 240, 138', fade * 0.9, 1.5);
        }
        break;
      }
      case 'sp_dread_lord': { // colossal black-violet executioner axe drag, heavy crescent edge & void cracks
        const dir = head >= fromA ? 1 : -1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.arc(0, 0, outerR * 0.92, along(0.05), along(0.95), head < fromA);
        stroke('10, 2, 22', fade * 0.8, thick / z * 0.72);
        // Bearded executioner axe silhouette at the leading edge
        const hPt = at(head, outerR * 0.88);
        ctx.save();
        ctx.translate(hPt.x, hPt.y);
        ctx.rotate(head + dir * Math.PI * 0.45);
        ctx.beginPath();
        ctx.moveTo(-10 * z, -6 * z);
        ctx.lineTo(14 * z, -16 * z);
        ctx.quadraticCurveTo(22 * z, 0, 10 * z, 20 * z);
        ctx.lineTo(-6 * z, 8 * z);
        ctx.closePath();
        ctx.fillStyle = `rgba(18, 4, 34, ${fade * 0.9})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(216, 180, 254, ${fade * 0.95})`;
        ctx.lineWidth = 2.2 * z;
        ctx.stroke();
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        // Jagged black-violet ground cracks radiating from the heavy axe drag
        for (let i = 0; i < 4; i++) {
          const a = along(0.25 + i * 0.22);
          const p0 = at(a, outerR * 0.75);
          const p1 = at(a + (rnd(i + step) - 0.5) * 0.18, outerR * 1.02);
          const p2 = at(a + (rnd(i + 7 + step) - 0.5) * 0.25, outerR * 1.18);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          stroke('168, 85, 247', fade * 0.85, 2.2);
          stroke('243, 232, 255', fade * 0.75, 1.0);
        }
        for (let i = 0; i < 6; i++) {
          const p = at(along(0.15 + 0.75 * rnd(i)), outerR * (0.68 + 0.35 * rnd(i + 3)));
          dotGlow({ x: p.x, y: p.y - (1 - fade) * 34 * z }, 6 * z, '192, 132, 252', fade);
        }
        break;
      }
      case 'sp_nightblade': { // a second, straight cut crosses the arc: an X
        const a0 = at(head - 0.9 * Math.sign(head - fromA || 1), outerR * 0.35), a1 = at(head, outerR * 1.12);
        ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y);
        stroke('168, 85, 247', fade * 0.85, 4);
        stroke('250, 245, 255', fade, 1.4);
        dotGlow(tip, 12 * z, '147, 51, 234', fade * 0.9);
        break;
      }
      case 'sp_venom_lord': { // acid flung off the blade
        for (let i = 0; i < 7; i++) {
          const a = along(0.2 + 0.8 * rnd(i));
          const p = at(a, outerR + (4 + 14 * (1 - fade)) * z * (0.5 + rnd(i + 2)));
          dotGlow({ x: p.x, y: p.y + (1 - fade) * 10 * z }, (2.5 + 2 * rnd(i + 4)) * z, '74, 222, 128', fade);
        }
        ctx.beginPath();
        ctx.arc(0, 0, outerR * 0.9, along(0.4), head, head < fromA);
        stroke('190, 242, 100', fade * 0.5, 1.5);
        break;
      }
      case 'sp_blade_dancer': { // afterimage blades a beat behind, a star flash at the tip
        for (const [lag, al] of [[0.3, 0.55], [0.6, 0.3]]) {
          const h = head - lag * Math.sign(head - fromA || 1);
          ctx.beginPath();
          ctx.arc(0, 0, outerR * (1 - lag * 0.15), Math.min(h, fromA), Math.max(h, fromA));
          stroke('250, 204, 21', fade * al, 2);
        }
        const L = 12 * z * fade;
        ctx.beginPath();
        ctx.moveTo(tip.x - L, tip.y); ctx.lineTo(tip.x + L, tip.y);
        ctx.moveTo(tip.x, tip.y - L); ctx.lineTo(tip.x, tip.y + L);
        stroke('255, 255, 245', fade, 1.6);
        dotGlow(tip, 10 * z, '250, 204, 21', fade);
        break;
      }
      case 'sp_frost_shade': { // little frost stars glint along the cut
        for (let i = 0; i < 4; i++) {
          const p = at(along(0.2 + i * 0.25), outerR - thick * 0.4);
          const L = 4.5 * z * fade;
          ctx.beginPath();
          for (let j = 0; j < 3; j++) {
            const a = (j * Math.PI) / 3 + time * 2;
            ctx.moveTo(p.x - Math.cos(a) * L, p.y - Math.sin(a) * L);
            ctx.lineTo(p.x + Math.cos(a) * L, p.y + Math.sin(a) * L);
          }
          stroke('240, 253, 255', fade, 1.2);
        }
        dotGlow(tip, 14 * z, '103, 232, 249', fade * 0.8);
        break;
      }
      case 'sp_eclipse_reaper': { // a black sun rides the scythe tip; blood flies off
        dotGlow(tip, 18 * z, '244, 63, 94', fade);
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 5.5 * z, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(10, 2, 6, ${fade})`;
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 5.5 * z, 0, Math.PI * 2);
        stroke('255, 241, 242', fade * 0.9, 1);
        for (let i = 0; i < 5; i++) {
          const p = at(along(0.3 + 0.7 * rnd(i)), outerR * 1.05 + rnd(i + 3) * 12 * z * (1 - fade + 0.3));
          dotGlow(p, 3 * z, '225, 29, 72', fade);
        }
        break;
      }
    }
    ctx.restore();
  }

  // Mage card bolts: each card throws its own kind of missile. Returns false
  // for plain mages so the element bolt is drawn instead.
  drawCardProjectile(ctx, p, sx, sy, z) {
    const time = this.animations.time;
    const prev = p.trail[1] || { x: sx - 1, y: sy };
    const ang = Math.atan2(sy - prev.y, sx - prev.x);
    const rgba = (rgb, a) => `rgba(${rgb}, ${Math.max(0, Math.min(1, a))})`;
    const glowAt = (x, y, r, rgb, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba('255, 255, 255', a));
      g.addColorStop(0.35, rgba(rgb, a * 0.8));
      g.addColorStop(1, rgba(rgb, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    switch (p.cardId) {
      case 'sp_pyromancer': { // fireball with a licking flame tail
        p.trail.forEach((pt, i) => glowAt(pt.x, pt.y - i * 0.8 * z, (9 - i * 0.7) * z, i < 3 ? '251, 146, 60' : '234, 88, 12', 0.6 * (1 - i / p.trail.length)));
        glowAt(sx, sy, 15 * z, '249, 115, 22', 1);
        ctx.translate(sx, sy);
        ctx.rotate(ang + Math.PI);
        for (const [dy, len] of [[-3, 14], [0, 20], [3, 13]]) {
          const fl = Math.sin(time * 20 + dy) * 2 * z;
          ctx.beginPath();
          ctx.moveTo(0, dy * z - 2 * z);
          ctx.quadraticCurveTo(len * 0.5 * z, dy * z + fl, len * z, dy * z * 1.6);
          ctx.quadraticCurveTo(len * 0.5 * z, dy * z + fl + 2 * z, 0, dy * z + 2 * z);
          ctx.fillStyle = rgba('253, 186, 116', 0.7);
          ctx.fill();
        }
        break;
      }
      case 'sp_cryo_sage': { // a spinning ice spear trailing snow
        p.trail.forEach((pt, i) => {
          if (i % 2) return;
          ctx.fillStyle = rgba('240, 249, 255', 0.8 * (1 - i / p.trail.length));
          ctx.fillRect(pt.x - 1.5 * z, pt.y - 1.5 * z, 3 * z, 3 * z);
        });
        glowAt(sx, sy, 13 * z, '103, 232, 249', 0.8);
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(10 * z, 0); ctx.lineTo(-2 * z, 4 * z); ctx.lineTo(-14 * z, 0); ctx.lineTo(-2 * z, -4 * z); ctx.closePath();
        ctx.fillStyle = rgba('186, 230, 253', 0.95);
        ctx.fill();
        ctx.strokeStyle = rgba('255, 255, 255', 0.9);
        ctx.lineWidth = 1 * z;
        ctx.stroke();
        break;
      }
      case 'sp_tempest': { // a crackling ball of lightning
        const step = Math.floor(time * 30);
        ctx.beginPath();
        p.trail.forEach((pt, i) => { const j = ((step + i * 7) % 5 - 2) * 2 * z; if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x + j, pt.y - j); });
        ctx.strokeStyle = rgba('250, 204, 21', 0.7);
        ctx.lineWidth = 2 * z;
        ctx.stroke();
        glowAt(sx, sy, 14 * z, '250, 204, 21', 1);
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2 + step * 0.7;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(a + 0.4) * 7 * z, sy + Math.sin(a + 0.4) * 7 * z);
          ctx.lineTo(sx + Math.cos(a) * 13 * z, sy + Math.sin(a) * 13 * z);
          ctx.strokeStyle = rgba('255, 255, 255', 0.9);
          ctx.lineWidth = 1.3 * z;
          ctx.stroke();
        }
        break;
      }
      case 'sp_chronomancer': { // a golden orb inside two turning rings
        p.trail.forEach((pt, i) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, (3 + i) * z, 0, Math.PI * 2);
          ctx.strokeStyle = rgba('253, 224, 71', 0.4 * (1 - i / p.trail.length));
          ctx.lineWidth = 1 * z;
          ctx.stroke();
        });
        glowAt(sx, sy, 12 * z, '250, 204, 21', 0.9);
        for (const [rot, tilt] of [[time * 4, 0.35], [-time * 3, 0.8]]) {
          ctx.beginPath();
          ctx.ellipse(sx, sy, 11 * z, 11 * z * tilt, rot, 0, Math.PI * 2);
          ctx.strokeStyle = rgba('254, 240, 138', 0.9);
          ctx.lineWidth = 1.4 * z;
          ctx.stroke();
        }
        break;
      }
      case 'sp_void_archon': { // a hole in the world with violet light spiralling in
        p.trail.forEach((pt, i) => glowAt(pt.x, pt.y, (8 - i * 0.6) * z, '147, 51, 234', 0.45 * (1 - i / p.trail.length)));
        for (let i = 0; i < 3; i++) {
          const a = time * 6 + (i * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.arc(sx, sy, 11 * z, a, a + 1.4);
          ctx.strokeStyle = rgba('216, 180, 254', 0.85);
          ctx.lineWidth = 1.6 * z;
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.arc(sx, sy, 6 * z, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(8, 2, 18, 0.95)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.95)';
        ctx.lineWidth = 1.2 * z;
        ctx.stroke();
        break;
      }
      default:
        ctx.restore();
        return false;
    }
    ctx.restore();
    return true;
  }

  // Impact bloom where a card bolt lands
  drawCardImpacts(ctx, dt) {
    const z = this.camera.zoom;
    for (let i = this.cardImpacts.length - 1; i >= 0; i--) {
      const h = this.cardImpacts[i];
      h.life -= dt;
      if (h.life <= 0) { this.cardImpacts.splice(i, 1); continue; }
      const k = 1 - h.life / h.max, a = 1 - k;
      const out = 1 - Math.pow(1 - k, 3);
      const c = Isometric.worldToScreen(h.x, h.y, 0.75, this.camera, this.canvas.width, this.canvas.height);
      const rgba = (rgb, al) => `rgba(${rgb}, ${Math.max(0, Math.min(1, al))})`;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      const rays = (n, r0, r1, rgb, w, jag = 0) => {
        ctx.beginPath();
        for (let j = 0; j < n; j++) {
          const ang = (j * Math.PI * 2) / n + h.seed;
          const mid = r0 + (r1 - r0) * 0.5;
          ctx.moveTo(c.x + Math.cos(ang) * r0, c.y + Math.sin(ang) * r0 * 0.6);
          ctx.lineTo(c.x + Math.cos(ang + jag) * mid, c.y + Math.sin(ang + jag) * mid * 0.6);
          ctx.lineTo(c.x + Math.cos(ang) * r1, c.y + Math.sin(ang) * r1 * 0.6);
        }
        ctx.strokeStyle = rgba(rgb, a);
        ctx.lineWidth = w * z;
        ctx.stroke();
      };
      switch (h.cardId) {
        case 'sp_pyromancer':
          for (let j = 0; j < 6; j++) {
            const ang = (j * Math.PI * 2) / 6 + h.seed, d = 14 * z * out;
            const x = c.x + Math.cos(ang) * d, y = c.y + Math.sin(ang) * d * 0.5;
            ctx.beginPath();
            ctx.moveTo(x - 4 * z, y); ctx.quadraticCurveTo(x, y - 16 * z * a, x + 4 * z, y);
            ctx.fillStyle = rgba('251, 146, 60', a);
            ctx.fill();
          }
          rays(8, 4 * z, 22 * z * out, '253, 186, 116', 1.6);
          break;
        case 'sp_cryo_sage':
          ctx.beginPath();
          for (let j = 0; j < 3; j++) {
            const ang = (j * Math.PI) / 3 + h.seed;
            const L = 16 * z * out;
            ctx.moveTo(c.x - Math.cos(ang) * L, c.y - Math.sin(ang) * L * 0.6);
            ctx.lineTo(c.x + Math.cos(ang) * L, c.y + Math.sin(ang) * L * 0.6);
          }
          ctx.strokeStyle = rgba('240, 249, 255', a);
          ctx.lineWidth = 2 * z;
          ctx.stroke();
          rays(6, 18 * z * out, 26 * z * out, '103, 232, 249', 1.4);
          break;
        case 'sp_tempest':
          rays(6, 2 * z, 28 * z * out, '250, 204, 21', 2, 0.35);
          rays(6, 2 * z, 24 * z * out, '255, 255, 255', 0.8, 0.35);
          break;
        case 'sp_chronomancer':
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, 22 * z * out, 11 * z * out, 0, 0, Math.PI * 2);
          ctx.strokeStyle = rgba('253, 224, 71', a);
          ctx.lineWidth = 2 * z;
          ctx.stroke();
          rays(12, 18 * z * out, 22 * z * out, '254, 240, 138', 1.4);
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(c.x + Math.cos(k * 6) * 16 * z, c.y + Math.sin(k * 6) * 8 * z);
          ctx.strokeStyle = rgba('255, 255, 255', a);
          ctx.stroke();
          break;
        case 'sp_void_archon': {
          // collapses inward instead of bursting out
          const r = 26 * z * (1 - out);
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, r, r * 0.55, 0, 0, Math.PI * 2);
          ctx.strokeStyle = rgba('192, 132, 252', a);
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();
          rays(5, r, r + 8 * z, '216, 180, 254', 1.4);
          break;
        }
      }
      ctx.restore();
    }
  }

  // Lingering ground left by a skill: burning ground (a circle or a trail) or a gravity well
  drawSpField(ctx, fx, progress, toScreen, z) {
    const k = this.spFxKit(ctx, progress, toScreen, z, SP_FX_PALETTES[fx.cardId] || SP_FX_PALETTES.sp_pyromancer);
    const { pal, time, TAU, U, c, rnd, ring, pool, glow, flame, bead } = k;
    const a = Math.min(1, progress * 8) * (progress > 0.8 ? (1 - progress) / 0.2 : 1);
    const line = fx.startX !== undefined && fx.shape === 'field' && fx.x !== fx.startX;
    if (fx.pull) {
      // gravity well: dark pool, spiral arms turning inward, a bright rim
      const g = toScreen(fx.x, fx.y, 0), R = (fx.radius || 3) * U;
      pool(g, R, 0.55 * a);
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.scale(1, 0.5);
      for (let i = 0; i < 5; i++) {
        const a0 = (i * TAU) / 5 - time * 3;
        ctx.beginPath();
        for (let s2 = 0; s2 <= 12; s2++) {
          const t = s2 / 12, rr = R * (1 - t), ang = a0 + t * 3;
          if (s2 === 0) ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr); else ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        }
        ctx.strokeStyle = c(pal.accent, 0.6 * a);
        ctx.lineWidth = 2.5 * z;
        ctx.stroke();
      }
      ctx.restore();
      ring(g, R * (0.9 + 0.1 * Math.sin(time * 6)), pal.light, 0.7 * a, 2);
      glow(toScreen(fx.x, fx.y, 0.3), 18 * z, 0.6 * a, pal.main);
      return;
    }
    // burning ground: scorched patch with flames licking up across it
    const pts = [];
    if (line) {
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        pts.push([fx.startX + (fx.x - fx.startX) * t + (rnd(i) - 0.5) * 0.5, fx.startY + (fx.y - fx.startY) * t + (rnd(i + 9) - 0.5) * 0.5]);
      }
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        pool(toScreen(fx.startX + (fx.x - fx.startX) * t, fx.startY + (fx.y - fx.startY) * t, 0), (fx.radius || 1) * U * 0.8, 0.4 * a);
      }
    } else {
      const R = fx.radius || 2;
      pool(toScreen(fx.x, fx.y, 0), R * U, 0.5 * a);
      ring(toScreen(fx.x, fx.y, 0), R * U, pal.main, 0.5 * a, 2);
      for (let i = 0; i < 9; i++) {
        const ang = rnd(i) * TAU, d = Math.sqrt(rnd(i + 20)) * R * 0.85;
        pts.push([fx.x + Math.cos(ang) * d, fx.y + Math.sin(ang) * d]);
      }
    }
    pts.forEach(([wx, wy], i) => {
      const p = toScreen(wx, wy, 0);
      const flick = 0.75 + 0.25 * Math.sin(time * 7 + i * 1.9);
      flame(p, (12 + 8 * rnd(i + 40)) * z * flick, 5 * z, a * 0.9, i);
      if (i % 3 === 0) bead({ x: p.x + (rnd(i + 3) - 0.5) * 10 * z, y: p.y - ((time * 30 + i * 13) % 40) * z }, 2 * z, a * 0.8);
    });
  }

  // Mage card states on a mob: frozen in ice, stopped in time, Scorch / Frost stacks
  drawMobStatus(ctx, mob, screen, z, overheadY) {
    const h = (MOB_BODY_EXTENT[mob.type] || 30) * (mob.scale || 1) * z;
    ctx.save();
    if (mob.frozen === 1) {
      // block of ice around the body
      const w = h * 0.75;
      ctx.beginPath();
      ctx.moveTo(screen.x - w, screen.y + 2 * z);
      ctx.lineTo(screen.x - w * 0.9, screen.y - h * 1.05);
      ctx.lineTo(screen.x - w * 0.2, screen.y - h * 1.25);
      ctx.lineTo(screen.x + w * 0.85, screen.y - h);
      ctx.lineTo(screen.x + w, screen.y + 2 * z);
      ctx.closePath();
      ctx.fillStyle = 'rgba(165, 243, 252, 0.38)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(240, 253, 255, 0.9)';
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(screen.x - w * 0.5, screen.y - h * 0.9);
      ctx.lineTo(screen.x - w * 0.1, screen.y - h * 0.3);
      ctx.moveTo(screen.x + w * 0.4, screen.y - h * 0.8);
      ctx.lineTo(screen.x + w * 0.55, screen.y - h * 0.45);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.stroke();
    } else if (mob.frozen === 2) {
      // stopped in time: a golden clock face with a hand that will not move
      const r = h * 0.7, cy = screen.y - h * 0.55;
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.arc(screen.x, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(253, 224, 71, 0.1)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.85)';
      ctx.lineWidth = 2 * z;
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const ang = (i * Math.PI) / 6;
        ctx.moveTo(screen.x + Math.cos(ang) * r * 0.8, cy + Math.sin(ang) * r * 0.8);
        ctx.lineTo(screen.x + Math.cos(ang) * r, cy + Math.sin(ang) * r);
      }
      ctx.moveTo(screen.x, cy);
      ctx.lineTo(screen.x + r * 0.55, cy - r * 0.3);
      ctx.strokeStyle = 'rgba(255, 251, 235, 0.9)';
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    // stack pips over the name tag: embers for Scorch, crystals for Frost
    const pips = (n, color, y) => {
      for (let i = 0; i < n; i++) {
        const x = screen.x + (i - (n - 1) / 2) * 7 * z;
        ctx.beginPath();
        ctx.moveTo(x, y - 4 * z); ctx.lineTo(x + 2.6 * z, y); ctx.lineTo(x, y + 2.6 * z); ctx.lineTo(x - 2.6 * z, y);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };
    let py = overheadY - 24 * z;
    if (mob.scorch) { pips(mob.scorch, '#fb923c', py); py -= 8 * z; }
    if (mob.frost) pips(mob.frost, '#a5f3fc', py);
    ctx.restore();
  }

  // ---------------------------------------------------------------- weapon (item) abilities
  // Right-click skills of weapons (server items.js WEAPON_ABILITIES), one look
  // per weapon, coloured by the weapon's element
  drawWeaponSkill(ctx, fx, progress, toScreen, z) {
    const k = this.spFxKit(ctx, progress, toScreen, z, WEAPON_FX_PALETTES[fx.element] || WEAPON_FX_PALETTES.neutral);
    const { pal, time, TAU, U, seg, out3, fade, c, rnd, shade, ring, pool, puff, glow, bead, lens, blade, slashX, sparks, crescent,
      groundBand, ribbon, strip, bolt, spike, flame, snowflake, frost, shatterBurst } = k;
    const { sx, sy, tx, ty } = k.ends(fx);
    const screenAng = (ax, ay, bx, by) => { const a = toScreen(ax, ay, 0), b = toScreen(bx, by, 0); return Math.atan2(b.y - a.y, b.x - a.x); };
    // ground cracks radiating from p
    const cracks = (p, n, len, a, seed = 0) => {
      if (a <= 0.01) return;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const ang = (i * TAU) / n + rnd(seed + i) * 0.5;
        let x = p.x, y = p.y;
        ctx.moveTo(x, y);
        for (let j = 1; j <= 3; j++) {
          const aa = ang + (rnd(seed + i * 7 + j) - 0.5) * 0.6;
          x += Math.cos(aa) * len / 3; y += Math.sin(aa) * len / 6;
          ctx.lineTo(x, y);
        }
      }
      shade(() => { ctx.strokeStyle = `rgba(${pal.deep}, ${a * 0.8})`; ctx.lineWidth = 2.5 * z; ctx.stroke(); });
      ctx.strokeStyle = c(pal.accent, a * 0.6);
      ctx.lineWidth = 1 * z;
      ctx.stroke();
    };

    switch (fx.skillId) {
      // IRON BLADE - Shield Breaker: an overhead smash that cracks the ground and shoves the foe back
      case 'wpn_iron_blade':
      // MORNINGSTAR - Skull Crack: the same smash, plus stars circling the dazed head
      case 'wpn_iron_morningstar': {
        const g = toScreen(tx, ty, 0), p = toScreen(tx, ty, 0.7);
        const fall = seg(0, 0.25), hit = seg(0.2, 0.8);
        if (fall < 1) crescent(p.x, p.y - 34 * z * (1 - out3(fall)), 44 * z, Math.PI / 2 + 0.3, 1.6, 24 * z, 1, 1);
        if (hit > 0) {
          glow(p, 42 * z, 1 - seg(0.2, 0.4), pal.accent);
          cracks(g, 7, 50 * z * out3(Math.min(1, hit * 2)), fade, 3);
          ring(g, (0.4 + 1.5 * out3(hit)) * U, pal.light, 1 - hit, 4);
          sparks(p, 10, 5 * z, 38 * z * out3(hit), 1 - hit, 5);
          // knock-back dust streaks
          const ang = screenAng(sx, sy, tx, ty);
          for (let i = -1; i <= 1; i++) lens({ x: g.x + Math.cos(ang) * 20 * z * out3(hit), y: g.y + Math.sin(ang) * 10 * z * out3(hit) + i * 5 * z }, ang, 9 * z, 1.5 * z, pal.light, (1 - hit) * 0.7);
        }
        if (fx.skillId === 'wpn_iron_morningstar' && hit > 0) {
          for (let i = 0; i < 3; i++) {
            const a = time * 5 + (i * TAU) / 3;
            const q = { x: p.x + Math.cos(a) * 12 * z, y: p.y - 22 * z + Math.sin(a) * 4 * z };
            ctx.beginPath();
            for (let j = 0; j < 5; j++) {
              const r = j % 2 ? 1.5 * z : 4 * z, aa = (j * Math.PI) / 2.5 - Math.PI / 2;
              ctx.lineTo(q.x + Math.cos(aa) * r, q.y + Math.sin(aa) * r);
            }
            ctx.fillStyle = `rgba(253, 224, 71, ${fade})`;
            ctx.fill();
          }
        }
        return true;
      }

      // CLAYMORE - Grand Sweep: a huge 200-degree sweep that throws up rocks
      case 'wpn_sweeping_claymore': {
        const half = ((fx.arc || 200) * Math.PI) / 360;
        const base = Math.atan2(fx.dirY || 0, fx.dirX || 1);
        const range = fx.range || 4;
        const sw = out3(seg(0, 0.45));
        const head = base - half + 2 * half * sw;
        shade(() => {
          groundBand(tx, ty, 0.5, range, base - half, head, 0);
          ctx.fillStyle = `rgba(${pal.deep}, ${0.12 * fade})`;
          ctx.fill();
        });
        ribbon(tx, ty, range * 0.45, range, Math.max(base - half, head - 1.8), head, 0.3, fade);
        for (let i = 0; i < 9; i++) {
          const a = base - half + ((i + 0.5) / 9) * half * 2;
          if (a > head) break;
          const t = seg(0.1 + i * 0.03, 0.7 + i * 0.03);
          const d = range * (0.9 + 0.5 * out3(t));
          const p = toScreen(tx + Math.cos(a) * d, ty + Math.sin(a) * d, Math.sin(t * Math.PI) * 0.8);
          shade(() => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.6 * z, 0, TAU); ctx.fillStyle = `rgba(${pal.deep2}, ${1 - t})`; ctx.fill(); });
        }
        return true;
      }

      // INFERNO BLADE - Flame Slash: a crescent of fire runs down the line and leaves it burning
      case 'wpn_inferno_blade':
      {
        const reach = out3(seg(0, 0.4));
        const ex = sx + (tx - sx) * reach, ey = sy + (ty - sy) * reach;
        const ang = screenAng(sx, sy, tx, ty);
        for (let i = 0; i < 7; i++) {
          const t = (i + 0.5) / 7;
          if (t > reach) break;
          const life = 1 - seg(t * 0.4 + 0.3, t * 0.4 + 0.8);
          flame(toScreen(sx + (tx - sx) * t, sy + (ty - sy) * t, 0), (14 + 8 * rnd(i)) * z * life, 6 * z, life, i);
        }
        const p = toScreen(ex, ey, 0.6);
        crescent(p.x, p.y, 26 * z, ang, 2.4, 14 * z, 1 - seg(0.4, 0.6), 0.8);
        glow(p, 22 * z, 1 - seg(0.4, 0.6));
        return true;
      }

      // STORM BREAKER - Thunderclap: bolts spray from the hero, the ground splits and crackles
      case 'wpn_storm_breaker': {
        const Rw = fx.radius || 3.4, g = toScreen(tx, ty, 0);
        const wv = seg(0, 0.6);
        ring(g, Rw * U * out3(wv), pal.light, 1 - wv, 4);
        cracks(g, 8, Rw * U * 0.8 * out3(Math.min(1, wv * 2)), fade, 9);
        for (let i = 0; i < 7; i++) {
          const a = (i * TAU) / 7 + 0.3;
          bolt(toScreen(tx, ty, 0.6), toScreen(tx + Math.cos(a) * Rw * out3(wv), ty + Math.sin(a) * Rw * out3(wv), 0.2), 2, 1 - seg(0.2, 0.7), i);
        }
        glow(toScreen(tx, ty, 0.6), 30 * z, 1 - seg(0, 0.35));
        return true;
      }

      // EXCALIBUR - Holy Excalibur: a colossal sword of light laid down the line
      case 'wpn_excalibur': {
        const grow = out3(seg(0, 0.35));
        const a = toScreen(sx, sy, 0.6), b = toScreen(sx + (tx - sx) * grow, sy + (ty - sy) * grow, 0.6);
        const ang = Math.atan2(b.y - a.y, b.x - a.x), len = Math.hypot(b.x - a.x, b.y - a.y);
        const w = 9 * z * (fx.width || 2) / 2;
        glow(a, 26 * z, fade);
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(ang);
        // blade
        ctx.beginPath();
        ctx.moveTo(10 * z, -w); ctx.lineTo(len - w * 2, -w * 0.7); ctx.lineTo(len, 0); ctx.lineTo(len - w * 2, w * 0.7); ctx.lineTo(10 * z, w);
        ctx.closePath();
        const gr = ctx.createLinearGradient(0, -w, 0, w);
        gr.addColorStop(0, c(pal.accent, 0.5 * fade));
        gr.addColorStop(0.5, c(pal.core, 0.95 * fade));
        gr.addColorStop(1, c(pal.accent, 0.5 * fade));
        ctx.fillStyle = gr;
        ctx.fill();
        // crossguard and hilt
        ctx.fillStyle = c(pal.main, fade);
        ctx.fillRect(4 * z, -w * 2.2, 5 * z, w * 4.4);
        ctx.fillRect(-10 * z, -2 * z, 14 * z, 4 * z);
        ctx.restore();
        for (let i = 0; i < 10; i++) {
          const t = rnd(i);
          if (t > grow) continue;
          bead({ x: a.x + (b.x - a.x) * t + (rnd(i + 5) - 0.5) * 20 * z, y: a.y + (b.y - a.y) * t - progress * 30 * z * rnd(i + 9) }, 2.5 * z, fade);
        }
        return true;
      }

      // WOODSMAN AXE - Timber!: a giant axe chops down on the spot, wood chips fly
      case 'wpn_woodsman_axe': {
        const g = toScreen(tx, ty, 0);
        const chop = seg(0, 0.3), hit = seg(0.3, 0.9);
        const swing = -1.4 + 1.4 * out3(chop);
        const pivot = toScreen(tx, ty, 2.2);
        if (hit < 1) {
          ctx.save();
          ctx.translate(pivot.x, pivot.y);
          ctx.rotate(swing);
          ctx.fillStyle = `rgba(120, 72, 32, ${fade})`;
          ctx.fillRect(-3 * z, 0, 6 * z, 90 * z);
          ctx.beginPath();
          ctx.moveTo(3 * z, 64 * z); ctx.quadraticCurveTo(38 * z, 70 * z, 34 * z, 98 * z); ctx.lineTo(3 * z, 88 * z); ctx.closePath();
          ctx.fillStyle = c(pal.light, fade);
          ctx.fill();
          ctx.restore();
        }
        if (hit > 0) {
          cracks(g, 6, 30 * z * out3(Math.min(1, hit * 2)), fade, 2);
          ring(g, (fx.radius || 2) * U * (0.3 + 0.7 * out3(hit)), pal.light, 1 - hit, 3);
          for (let i = 0; i < 8; i++) {
            const a = (i * TAU) / 8 + rnd(i);
            const d = 30 * z * out3(hit);
            ctx.fillStyle = `rgba(180, 120, 60, ${1 - hit})`;
            ctx.fillRect(g.x + Math.cos(a) * d - 2 * z, g.y + Math.sin(a) * d * 0.5 - Math.sin(hit * Math.PI) * 20 * z, 4 * z, 2 * z);
          }
        }
        return true;
      }

      // THUNDER MAUL - Storm Hammer: each pulse a slam and bolts out of the sky around the hero
      case 'wpn_thunder_maul': {
        const R = (fx.radius || 3) * U, g = toScreen(tx, ty, 0);
        const wave = fx.wave || 0;
        const wv = seg(0, 0.7);
        ring(g, R * out3(wv), pal.light, 1 - wv, 4);
        glow(toScreen(tx, ty, 0.3), 26 * z, 1 - seg(0, 0.3));
        for (let i = 0; i < 3; i++) {
          const a = (i * TAU) / 3 + wave * 1.1 + rnd(wave + i) * 0.6;
          const gx = tx + Math.cos(a) * (fx.radius || 3) * 0.7, gy = ty + Math.sin(a) * (fx.radius || 3) * 0.7;
          bolt(toScreen(gx, gy, 6), toScreen(gx, gy, 0), 3, 1 - seg(0.1, 0.5), wave * 3 + i);
          glow(toScreen(gx, gy, 0.1), 16 * z, 1 - seg(0.1, 0.5));
        }
        return true;
      }

      // DRAGONBONE GLAIVE - Dragon Breath: a roaring stream of fire across the cone
      case 'wpn_dragonbone_glaive': {
        const half = ((fx.arc || 70) * Math.PI) / 360;
        const base = Math.atan2(fx.dirY || 0, fx.dirX || 1);
        const range = fx.range || 5.5;
        const reach = range * out3(seg(0, 0.4));
        groundBand(tx, ty, 0.4, Math.max(0.5, reach), base - half, base + half, 0);
        ctx.fillStyle = c(pal.main, 0.12 * fade);
        ctx.fill();
        for (let i = 0; i < 22; i++) {
          const t = (progress * 2 + rnd(i)) % 1;
          const a = base + (rnd(i + 30) * 2 - 1) * half * (0.3 + 0.7 * t);
          const d = reach * t;
          const p = toScreen(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 0.4);
          glow(p, (8 + 16 * t) * z, (1 - t) * fade, t < 0.4 ? pal.accent : pal.main);
        }
        for (let i = 0; i < 6; i++) {
          const a = base + (rnd(i + 70) * 2 - 1) * half * 0.8, d = reach * (0.5 + 0.5 * rnd(i + 71));
          flame(toScreen(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 0), 16 * z * fade, 6 * z, fade, i);
        }
        return true;
      }

      // ARCHMAGE STAFF - Arcane Orb: a rune-ringed orb flies out and bursts into a magic circle
      case 'wpn_archmage_staff': {
        const R = (fx.radius || 2.2) * U, g = toScreen(tx, ty, 0);
        const fly = seg(0, 0.35), boom = seg(0.35, 1);
        if (fly < 1) {
          const t = out3(fly);
          const p = toScreen(sx + (tx - sx) * t, sy + (ty - sy) * t, 0.8 + Math.sin(t * Math.PI) * 0.8);
          glow(p, 18 * z, 1);
          bead(p, 7 * z, 1);
          for (const [rot, tilt] of [[time * 5, 0.35], [-time * 4, 0.9]]) {
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, 12 * z, 12 * z * tilt, rot, 0, TAU);
            ctx.strokeStyle = c(pal.light, 0.9);
            ctx.lineWidth = 1.4 * z;
            ctx.stroke();
          }
          return true;
        }
        glow(toScreen(tx, ty, 0.5), R, 1 - seg(0.35, 0.55));
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.scale(1, 0.5);
        ctx.rotate(time * 0.8);
        ctx.beginPath();
        ctx.arc(0, 0, R * out3(boom), 0, TAU);
        ctx.moveTo(R * 0.7 * out3(boom), 0);
        ctx.arc(0, 0, R * 0.7 * out3(boom), 0, TAU);
        for (let i = 0; i < 6; i++) {
          const a = (i * TAU) / 6, b2 = ((i + 2) * TAU) / 6, r = R * 0.7 * out3(boom);
          ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx.lineTo(Math.cos(b2) * r, Math.sin(b2) * r);
        }
        ctx.strokeStyle = c(pal.light, (1 - boom) * 0.9);
        ctx.lineWidth = 2 * z;
        ctx.stroke();
        ctx.restore();
        sparks(toScreen(tx, ty, 0.4), 10, 6 * z, 30 * z * out3(boom), 1 - boom, 4);
        return true;
      }

      // GLACIAL SPIRE - Ice Prison: bars of ice burst up in a ring and close in
      case 'wpn_glacial_spire': {
        const Rw = fx.radius || 3.5, g = toScreen(tx, ty, 0);
        const rise = out3(seg(0, 0.35)), close = out3(seg(0.2, 0.6));
        frost(g, Rw * U, fade);
        snowflake(g, Rw * U * 0.6, time * 0.4, fade * 0.6);
        for (let i = 0; i < 14; i++) {
          const a = (i * TAU) / 14;
          const d = Rw * (1 - 0.55 * close);
          spike(toScreen(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 0), (24 + 8 * rnd(i)) * z * rise, 4 * z, 1 - seg(0.75, 1));
        }
        ring(g, Rw * U * (1 - 0.55 * close), pal.light, fade * 0.8, 2.5);
        return true;
      }

      // VOIDCALLER WAND - Void Bolts: curving bolts of darkness, each hit drinking life back
      case 'wpn_voidcaller_wand': {
        const op = toScreen(sx, sy, 0.8);
        (fx.points || []).forEach((pt, i) => {
          const tp = toScreen(pt.x, pt.y, 0.6);
          const side = i % 2 ? 1 : -1;
          const at = (t) => ({ x: op.x + (tp.x - op.x) * t - Math.sin(t * Math.PI) * 22 * z * side * 0.5, y: op.y + (tp.y - op.y) * t - Math.sin(t * Math.PI) * 26 * z });
          const fly = seg(i * 0.05, 0.4 + i * 0.05);
          if (fly > 0 && fly < 1) {
            for (let j = 4; j >= 0; j--) bead(at(Math.max(0, fly - j * 0.05)), (9 - j * 1.4) * z, j ? 0.45 / j : 1);
            shade(() => { const p = at(fly); ctx.beginPath(); ctx.arc(p.x, p.y, 4.5 * z, 0, TAU); ctx.fillStyle = `rgba(${pal.deep}, 0.95)`; ctx.fill(); });
          }
          const hit = seg(0.4 + i * 0.05, 0.85 + i * 0.05);
          if (hit > 0 && hit < 1) {
            ring(toScreen(pt.x, pt.y, 0), 1.1 * U * (1 - out3(hit)), pal.accent, 1 - hit, 3);
            glow(tp, 22 * z * (1 - hit), 1 - hit, pal.main);
            // life drawn back to the caster
            const back = { x: tp.x + (op.x - tp.x) * out3(hit), y: tp.y + (op.y - tp.y) * out3(hit) };
            bead(back, 6 * z, (1 - hit) * 0.9);
          }
        });
        return true;
      }

      // DAWN SCEPTER - Dawn Blessing: a sunrise behind the hero, a pillar of light, falling feathers
      case 'wpn_dawn_scepter': {
        const g = toScreen(tx, ty, 0), top = toScreen(tx, ty, 3.4);
        const rise = out3(seg(0, 0.4));
        const sun = toScreen(tx, ty, 1.6);
        glow(sun, 46 * z * rise, fade * 0.8, pal.accent);
        ctx.beginPath();
        ctx.arc(sun.x, sun.y, 26 * z * rise, 0, TAU);
        ctx.strokeStyle = c(pal.light, fade * 0.8);
        ctx.lineWidth = 2 * z;
        ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const a = (i * TAU) / 12 + time * 0.3;
          ctx.beginPath();
          ctx.moveTo(sun.x + Math.cos(a) * 30 * z * rise, sun.y + Math.sin(a) * 30 * z * rise);
          ctx.lineTo(sun.x + Math.cos(a) * 40 * z * rise, sun.y + Math.sin(a) * 40 * z * rise);
          ctx.strokeStyle = c(pal.accent, fade * 0.7);
          ctx.stroke();
        }
        const col = ctx.createLinearGradient(g.x, g.y, top.x, top.y);
        col.addColorStop(0, c(pal.light, 0.5 * fade));
        col.addColorStop(1, c(pal.light, 0));
        ctx.fillStyle = col;
        ctx.fillRect(g.x - 12 * z, top.y, 24 * z, g.y - top.y);
        ring(g, (fx.radius || 3) * U * rise, pal.accent, fade * 0.8, 2.5);
        for (let i = 0; i < 7; i++) {
          const t = (progress * 1.2 + rnd(i)) % 1;
          const p = { x: g.x + (rnd(i + 3) - 0.5) * 70 * z + Math.sin(time * 3 + i) * 5 * z, y: top.y + t * (g.y - top.y) };
          lens(p, 0.6 + Math.sin(time * 4 + i) * 0.4, 5 * z, 2 * z, pal.core, (1 - t) * fade);
        }
        return true;
      }

      // SHADOW DAGGERS - Shadow Fang: two fangs of darkness bite shut on the target
      case 'wpn_shadow_daggers': {
        const p = toScreen(tx, ty, 0.6), g = toScreen(tx, ty, 0);
        const bite = out3(seg(0, 0.3));
        pool(g, 1.1 * U, 0.5 * fade);
        const gap = 32 * z * (1 - bite);
        crescent(p.x, p.y - gap, 28 * z, Math.PI / 2, 2.6, 16 * z, 1 - seg(0.5, 0.8));
        crescent(p.x, p.y + gap, 28 * z, -Math.PI / 2, 2.6, 16 * z, 1 - seg(0.5, 0.8));
        const hit = seg(0.25, 0.75);
        if (hit > 0) {
          for (let i = 0; i < 6; i++) puff({ x: p.x + (rnd(i) - 0.5) * 40 * z * hit, y: p.y - hit * 18 * z + (rnd(i + 4) - 0.5) * 14 * z }, 13 * z, 0.5 * (1 - hit));
          sparks(p, 8, 5 * z, 30 * z * out3(hit), 1 - hit, 2);
        }
        return true;
      }

      // WIND RAPIER - Lunge: a needle-thin thrust wrapped in wind and static
      case 'wpn_wind_rapier': {
        const a = toScreen(sx, sy, 0.6), b = toScreen(tx, ty, 0.6);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const thrust = 1 - seg(0.3, 0.8);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = c(pal.core, thrust);
        ctx.lineWidth = 1.5 * z;
        ctx.stroke();
        for (let i = -2; i <= 2; i++) {
          if (!i) continue;
          const o = i * 6 * z, t0 = 0.2 + rnd(i + 5) * 0.3;
          ctx.beginPath();
          ctx.moveTo(a.x + (b.x - a.x) * t0 - Math.sin(ang) * o, a.y + (b.y - a.y) * t0 + Math.cos(ang) * o);
          ctx.lineTo(a.x + (b.x - a.x) * (t0 + 0.4) - Math.sin(ang) * o, a.y + (b.y - a.y) * (t0 + 0.4) + Math.cos(ang) * o);
          ctx.strokeStyle = c(pal.light, thrust * 0.5);
          ctx.lineWidth = 1 * z;
          ctx.stroke();
        }
        bolt(a, b, 1, thrust * 0.6, 3, 0.5);
        const tipA = 1 - seg(0.2, 0.6);
        glow(b, 20 * z, tipA);
        sparks(b, 6, 3 * z, 16 * z, tipA, 1);
        return true;
      }

      // HUNTER SPEAR - Spear Throw: the spear flies down the line and sticks where it lands
      case 'wpn_hunter_spear': {
        const fly = out3(seg(0, 0.35));
        const a = toScreen(sx, sy, 0.7), b = toScreen(tx, ty, 0.7);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const p = fly < 1
          ? toScreen(sx + (tx - sx) * fly, sy + (ty - sy) * fly, 0.7 + Math.sin(fly * Math.PI) * 0.6)
          : toScreen(tx, ty, 0.3);
        const tilt = fly < 1 ? ang : ang + 0.5;
        const stayA = fly < 1 ? 1 : 1 - seg(0.6, 1);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(tilt);
        ctx.fillStyle = `rgba(150, 100, 55, ${stayA})`;
        ctx.fillRect(-50 * z, -1.8 * z, 44 * z, 3.6 * z);
        ctx.beginPath();
        ctx.moveTo(7 * z, 0); ctx.lineTo(-7 * z, -5 * z); ctx.lineTo(-7 * z, 5 * z); ctx.closePath();
        ctx.fillStyle = c(pal.light, stayA);
        ctx.fill();
        ctx.restore();
        if (fly < 1) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = c(pal.light, 0.3);
          ctx.lineWidth = 1 * z;
          ctx.stroke();
        } else {
          const hit = seg(0.35, 0.8);
          ring(toScreen(tx, ty, 0), 0.8 * U * out3(hit), pal.light, 1 - hit, 2);
          for (let i = 0; i < 4; i++) puff({ x: p.x + (rnd(i) - 0.5) * 20 * z, y: p.y + 6 * z - hit * 8 * z }, 6 * z, 0.3 * (1 - hit));
        }
        return true;
      }

      // FROSTBITE KATANA - Iaijutsu: a blur, then a single frozen cut opens along the whole path
      case 'wpn_frostbite_katana': {
        const a = toScreen(sx, sy, 0.6), b = toScreen(tx, ty, 0.6);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const blur = 1 - seg(0, 0.25);
        if (blur > 0) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = c(pal.light, blur * 0.4);
          ctx.lineWidth = 10 * z;
          ctx.stroke();
        }
        const cut = seg(0.25, 0.4), cutA = 1 - seg(0.55, 1);
        if (cut > 0) {
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const half = Math.hypot(b.x - a.x, b.y - a.y) / 2 + 10 * z;
          lens(mid, ang, half * out3(cut), 5 * z, pal.accent, cutA);
          lens(mid, ang, half * out3(cut) * 0.97, 1.5 * z, pal.core, cutA);
          for (let i = 0; i < 6; i++) {
            const t = (i + 0.5) / 6;
            const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
            lens(q, ang + Math.PI / 2 + (rnd(i) - 0.5) * 0.6, 7 * z, 1.5 * z, pal.light, cutA * 0.8);
          }
          shatterBurst(b, 6, 18 * z * out3(cut), cutA, 3);
        }
        return true;
      }

      // VENOM KRIS - Venom Strike: a quick stab that splashes the target with poison
      case 'wpn_venom_kris': {
        const a = toScreen(sx, sy, 0.6), p = toScreen(tx, ty, 0.6);
        const ang = Math.atan2(p.y - a.y, p.x - a.x);
        const stab = out3(seg(0, 0.2));
        blade({ x: p.x - Math.cos(ang) * 18 * z * (1 - stab), y: p.y - Math.sin(ang) * 18 * z * (1 - stab) }, ang, 22 * z, 4.5 * z, 1 - seg(0.3, 0.6));
        const sp = seg(0.15, 0.8);
        if (sp > 0) {
          for (let i = 0; i < 8; i++) {
            const da = ang + (rnd(i) - 0.5) * 2.2, d = 38 * z * out3(sp) * (0.6 + 0.4 * rnd(i + 3));
            bead({ x: p.x + Math.cos(da) * d, y: p.y + Math.sin(da) * d * 0.6 + sp * sp * 18 * z }, 4.5 * z, 1 - sp);
          }
          for (let i = 0; i < 3; i++) puff({ x: p.x + (rnd(i + 9) - 0.5) * 24 * z, y: p.y - sp * 20 * z }, 14 * z, 0.45 * (1 - sp));
          glow(p, 28 * z * (1 - sp), 1 - sp, pal.main);
        }
        return true;
      }

      // EMBER SCYTHE - Reaper Spin: a full circle of burning scythe blades
      case 'wpn_ember_scythe': {
        const Rw = fx.radius || 3.2, g = toScreen(tx, ty, 0);
        const spin = out3(seg(0, 0.55));
        for (let b2 = 0; b2 < 2; b2++) {
          const head = spin * TAU * 1.25 + b2 * Math.PI;
          ribbon(tx, ty, Rw * 0.5, Rw * 0.95, head - 1.6, head, 0.3, fade);
        }
        ring(g, Rw * U * (0.4 + 0.7 * out3(seg(0.3, 0.9))), pal.light, 1 - seg(0.3, 0.9), 3);
        for (let i = 0; i < 8; i++) {
          const a = (i * TAU) / 8 + time;
          flame(toScreen(tx + Math.cos(a) * Rw * 0.85, ty + Math.sin(a) * Rw * 0.85, 0), 14 * z * fade, 5 * z, fade * 0.8, i);
        }
        // stolen life rising back to the wielder
        for (let i = 0; i < 4; i++) {
          const t = seg(0.4 + i * 0.05, 0.9);
          const a = (i * TAU) / 4 + 0.6;
          const from = toScreen(tx + Math.cos(a) * Rw * 0.8, ty + Math.sin(a) * Rw * 0.8, 0.4);
          const to = toScreen(tx, ty, 0.8);
          if (t > 0 && t < 1) bead({ x: from.x + (to.x - from.x) * out3(t), y: from.y + (to.y - from.y) * out3(t) }, 3.5 * z, 1 - t);
        }
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- Eclipse Reaper (SP tier 5)
  // Black sun + blood crimson: eclipses, scythes, blood
  drawEclipseReaperSkill(ctx, fx, progress, toScreen, z) {
    const k = this.spFxKit(ctx, progress, toScreen, z, SP_FX_PALETTES.sp_eclipse_reaper);
    const { time, TAU, U, clamp01, seg, out3, fade, c, shade, ring, pool, bead, slashX, crescent, groundBand } = k;
    const { main: CRIMSON, accent: ROSE, light: PINK, core: BONE } = k.pal;
    // Black disc with a flickering blood corona and a diamond-ring glint
    const blackSun = (p, rad, a) => {
      if (rad <= 0.5 || a <= 0.01) return;
      const cor = ctx.createRadialGradient(p.x, p.y, rad * 0.8, p.x, p.y, rad * 2.4);
      cor.addColorStop(0, c(PINK, a * 0.95));
      cor.addColorStop(0.18, c(ROSE, a * 0.8));
      cor.addColorStop(0.5, c(CRIMSON, a * 0.35));
      cor.addColorStop(1, c(CRIMSON, 0));
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad * 2.4, 0, TAU);
      ctx.fill();
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * TAU + time * 0.8 + (k % 2) * 0.13;
        const len = rad * (1.45 + 0.5 * Math.sin(time * 7 + k * 2.3));
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(ang - 0.17) * rad * 0.95, p.y + Math.sin(ang - 0.17) * rad * 0.95);
        ctx.lineTo(p.x + Math.cos(ang) * len, p.y + Math.sin(ang) * len);
        ctx.lineTo(p.x + Math.cos(ang + 0.17) * rad * 0.95, p.y + Math.sin(ang + 0.17) * rad * 0.95);
        ctx.closePath();
        ctx.fillStyle = c(k % 2 ? PINK : ROSE, a * 0.5);
        ctx.fill();
      }
      shade(() => {
        const disc = ctx.createRadialGradient(p.x - rad * 0.25, p.y - rad * 0.25, rad * 0.1, p.x, p.y, rad);
        disc.addColorStop(0, `rgba(6, 1, 4, ${a})`);
        disc.addColorStop(0.85, `rgba(18, 3, 9, ${a})`);
        disc.addColorStop(1, `rgba(70, 8, 26, ${a})`);
        ctx.fillStyle = disc;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, TAU);
        ctx.fill();
      });
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, TAU);
      ctx.strokeStyle = c(BONE, a * 0.9);
      ctx.lineWidth = Math.max(1, rad * 0.09);
      ctx.stroke();
      const ga = -0.8 + 0.3 * Math.sin(time * 2);
      bead({ x: p.x + Math.cos(ga) * rad, y: p.y + Math.sin(ga) * rad }, rad * 0.55, a);
    };

    const sx = fx.startX !== undefined ? fx.startX : fx.x;
    const sy = fx.startY !== undefined ? fx.startY : fx.y;
    const tx = fx.x !== undefined ? fx.x : sx;
    const ty = fx.y !== undefined ? fx.y : sy;
    const BY_SHAPE = {
      strike: 'sp_total_eclipse', volley: 'sp_blood_tether', nova: 'sp_crimson_bloom', dash: 'sp_reaper_step',
      cone: 'sp_reaper_scythe', blast: 'sp_black_sun', pull: 'sp_harvest', blink: 'sp_crimson_blink'
    };

    switch (fx.skillId || BY_SHAPE[fx.shape]) {
      // TOTAL ECLIPSE: a black sun over the mark, a scythe whips through it, blood X on impact
      case 'sp_total_eclipse': {
        const g = toScreen(tx, ty, 0);
        const grow = out3(seg(0, 0.3));
        const lunge = 1 - seg(0.05, 0.4);
        if (lunge > 0 && Math.hypot(tx - sx, ty - sy) > 0.3) {
          const a = toScreen(sx, sy, 0.5), b = toScreen(tx, ty, 0.5);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = c(CRIMSON, lunge * 0.5);
          ctx.lineWidth = 7 * z;
          ctx.stroke();
          ctx.strokeStyle = c(BONE, lunge * 0.8);
          ctx.lineWidth = 1.5 * z;
          ctx.stroke();
        }
        pool(g, 1.7 * U * grow, 0.6 * fade);
        const wave = seg(0.38, 1);
        if (wave > 0) {
          ring(g, (0.5 + 2.1 * out3(wave)) * U, ROSE, (1 - wave) * 0.9, 3.5);
          ring(g, (0.3 + 1.4 * out3(wave)) * U, PINK, (1 - wave) * 0.5, 1.5);
        }
        blackSun(toScreen(tx, ty, 2.1 - 0.5 * grow), 15 * z * (0.25 + 0.75 * grow), fade);
        const sw = seg(0.18, 0.5);
        const swA = progress < 0.5 ? 1 : 1 - seg(0.5, 0.85);
        if (sw > 0 && swA > 0) {
          const mid = toScreen(tx, ty, 0.8);
          const rot = -2.4 + out3(sw) * 2.9;
          for (let k = 3; k >= 0; k--) {
            crescent(mid.x, mid.y, 46 * z, rot - k * 0.24 * (1 - sw * 0.5), 1.9, 30 * z, swA * (k ? 0.28 / k : 1), 0.7);
          }
        }
        const hit = seg(0.4, 0.85);
        if (hit > 0 && hit < 1) {
          const p = toScreen(tx, ty, 0.6), ha = 1 - hit;
          const L = 38 * z * out3(Math.min(1, hit * 2.5));
          const flash = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 30 * z);
          flash.addColorStop(0, c(BONE, ha));
          flash.addColorStop(0.4, c(ROSE, ha * 0.6));
          flash.addColorStop(1, c(CRIMSON, 0));
          ctx.fillStyle = flash;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 30 * z, 0, TAU);
          ctx.fill();
          slashX(p, L, ha);
          // blood spray
          for (let k = 0; k < 10; k++) {
            const ang = k * 2.39996 + 0.4, d0 = L * 0.4, d1 = L * (0.9 + (k % 3) * 0.25);
            ctx.beginPath();
            ctx.moveTo(p.x + Math.cos(ang) * d0, p.y + Math.sin(ang) * d0 * 0.6);
            ctx.lineTo(p.x + Math.cos(ang) * d1, p.y + Math.sin(ang) * d1 * 0.6 + hit * 10 * z);
            ctx.strokeStyle = c(CRIMSON, ha * 0.85);
            ctx.lineWidth = 2.5 * z;
            ctx.stroke();
          }
        }
        return true;
      }

      // BLOOD TETHER: writhing veins hook each target, then blood beads flow back to the reaper
      case 'sp_blood_tether': {
        const og = toScreen(sx, sy, 0), op = toScreen(sx, sy, 0.7);
        const grow = out3(seg(0, 0.25));
        pool(og, 1.1 * U * grow, 0.45 * fade);
        ring(og, (0.6 + 0.5 * grow) * U, ROSE, fade * 0.85, 2.5);
        const drink = seg(0.55, 1);
        if (drink > 0) ring(og, (0.4 + 0.9 * drink) * U, PINK, (1 - drink) * 0.8, 2);
        (fx.points || []).forEach((pt, i) => {
          const tp = toScreen(pt.x, pt.y, 0.7), tg = toScreen(pt.x, pt.y, 0);
          const dx = tp.x - op.x, dy = tp.y - op.y, len = Math.hypot(dx, dy) || 1;
          const bow = len * 0.28 * (i % 2 ? 1 : -1);
          const cx = (op.x + tp.x) / 2 - (dy / len) * bow, cy = (op.y + tp.y) / 2 + (dx / len) * bow - 14 * z;
          const at = (t) => {
            const u = 1 - t;
            const w = Math.sin(t * Math.PI) * Math.sin(t * 18 - time * 16) * 3 * z;
            return {
              x: u * u * op.x + 2 * u * t * cx + t * t * tp.x - (dy / len) * w,
              y: u * u * op.y + 2 * u * t * cy + t * t * tp.y + (dx / len) * w
            };
          };
          const reach = out3(seg(i * 0.05, 0.28 + i * 0.05));
          if (reach <= 0) return;
          const trace = () => {
            ctx.beginPath();
            for (let k = 0; k <= 24; k++) {
              const p = at((k / 24) * reach);
              if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
            }
          };
          shade(() => {
            trace();
            ctx.strokeStyle = `rgba(30, 3, 10, ${0.7 * fade})`;
            ctx.lineWidth = 6 * z;
            ctx.stroke();
          });
          trace();
          ctx.strokeStyle = c(ROSE, fade * 0.9);
          ctx.lineWidth = 3 * z;
          ctx.stroke();
          ctx.strokeStyle = c(BONE, fade * 0.7);
          ctx.lineWidth = 1 * z;
          ctx.stroke();
          if (reach >= 1) {
            const bite = seg(0.28 + i * 0.05, 0.6 + i * 0.05);
            ring(tg, (0.35 + 0.45 * out3(bite)) * U, ROSE, fade * (1 - bite * 0.6), 2.5);
            bead(tp, 9 * z, fade);
          }
          const back = seg(0.35, 0.95);
          if (back > 0 && back < 1) {
            for (let j = 0; j < 3; j++) {
              const t = 1 - clamp01(back * 1.35 - j * 0.14);
              if (t > 0 && t < 1) bead(at(t), 6 * z, fade);
            }
          }
        });
        return true;
      }

      // CRIMSON BLOOM: a blood lotus unfurls on the ground under a rising black sun
      case 'sp_crimson_bloom': {
        const g = toScreen(tx, ty, 0);
        const R = (fx.radius || 4.5) * U;
        const open = out3(seg(0, 0.45));
        pool(g, R * (0.3 + 0.7 * open), 0.55 * fade);
        const LAYERS = [
          { n: 8, len: 1.0, w: 0.3, rot: 0, rgb: CRIMSON, a: 0.5 },
          { n: 8, len: 0.7, w: 0.32, rot: Math.PI / 8, rgb: ROSE, a: 0.6 },
          { n: 5, len: 0.4, w: 0.45, rot: 0.3, rgb: PINK, a: 0.65 }
        ];
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.scale(1, 0.5);
        LAYERS.forEach((L, li) => {
          const unfurl = out3(seg(li * 0.07, 0.42 + li * 0.07));
          if (unfurl <= 0) return;
          const spin = (1 - unfurl) * 0.9 * (li % 2 ? -1 : 1) + progress * 0.2;
          const len = R * L.len * unfurl;
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, len);
          grad.addColorStop(0, c(L.rgb, 0.05 * fade));
          grad.addColorStop(0.65, c(L.rgb, L.a * fade));
          grad.addColorStop(1, c(PINK, L.a * fade));
          for (let k = 0; k < L.n; k++) {
            const a = L.rot + spin + (k * TAU) / L.n;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(Math.cos(a - L.w) * len * 0.75, Math.sin(a - L.w) * len * 0.75, Math.cos(a) * len, Math.sin(a) * len);
            ctx.quadraticCurveTo(Math.cos(a + L.w) * len * 0.75, Math.sin(a + L.w) * len * 0.75, 0, 0);
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.strokeStyle = c(PINK, 0.7 * fade);
            ctx.lineWidth = 1.5 * z;
            ctx.stroke();
          }
        });
        ctx.restore();
        const sh = seg(0.3, 0.85);
        if (sh > 0) {
          ring(g, R * (0.8 + 0.25 * out3(sh)), ROSE, (1 - sh) * 0.9, 4);
          ring(g, R * (0.8 + 0.25 * out3(sh)), BONE, (1 - sh) * 0.6, 1.5);
        }
        blackSun(toScreen(tx, ty, 1.4 + 1.0 * open), 14 * z * open, fade);
        // loose petals drifting up
        for (let k = 0; k < 12; k++) {
          const a = k * 2.39996, d = R * (0.35 + 0.55 * ((k * 0.618) % 1));
          const rise = progress * (40 + (k % 4) * 14) * z;
          ctx.save();
          ctx.translate(g.x + Math.cos(a) * d, g.y + Math.sin(a) * d * 0.5 - rise);
          ctx.rotate(a + time * 3 + k);
          ctx.beginPath();
          ctx.ellipse(0, 0, 4.5 * z, 2 * z, 0, 0, TAU);
          ctx.fillStyle = c(k % 2 ? PINK : ROSE, fade * 0.85 * open);
          ctx.fill();
          ctx.restore();
        }
        return true;
      }

      // REAPER STEP: a tapering blood wake with afterimage scythes, double cleave on landing
      case 'sp_reaper_step': {
        const ddx = tx - sx, ddy = ty - sy, dlen = Math.hypot(ddx, ddy) || 1;
        const ux = ddx / dlen, uy = ddy / dlen, nx = -uy, ny = ux;
        const w = (fx.width || 1.6) * 0.45;
        const reach = out3(seg(0, 0.3));
        const ex = sx + ddx * reach, ey = sy + ddy * reach;
        const a = toScreen(sx, sy, 0.15), b = toScreen(ex, ey, 0.15);
        pool(toScreen(sx, sy, 0), 0.9 * U, 0.5 * (1 - seg(0, 0.6)));
        // needle at the start, full width where the reaper lands
        const wake = () => {
          const pts = [
            [sx + nx * w * 0.1, sy + ny * w * 0.1], [ex + nx * w, ey + ny * w], [ex + ux * w * 0.8, ey + uy * w * 0.8],
            [ex - nx * w, ey - ny * w], [sx - nx * w * 0.1, sy - ny * w * 0.1]
          ].map(([x, y]) => toScreen(x, y, 0.15));
          ctx.beginPath();
          pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath();
        };
        shade(() => {
          wake();
          ctx.fillStyle = `rgba(20, 2, 8, ${0.55 * fade})`;
          ctx.fill();
        });
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, c(CRIMSON, 0));
        grad.addColorStop(0.6, c(CRIMSON, 0.55 * fade));
        grad.addColorStop(1, c(ROSE, 0.9 * fade));
        wake();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = c(BONE, 0.8 * fade);
        ctx.lineWidth = 1.5 * z;
        ctx.stroke();
        const full = toScreen(tx, ty, 0.15);
        const ang = Math.atan2(full.y - toScreen(sx, sy, 0.15).y, full.x - toScreen(sx, sy, 0.15).x);
        for (let k = 1; k <= 3; k++) {
          const t = k / 4;
          if (reach < t) continue;
          const p = toScreen(sx + ddx * t, sy + ddy * t, 0.6);
          crescent(p.x, p.y, 20 * z, ang, 2.2, 12 * z, fade * (0.2 + 0.15 * k), 0.8);
        }
        const land = seg(0.2, 0.75);
        if (land > 0 && land < 1) {
          const p = toScreen(tx, ty, 0.6), la = 1 - land;
          crescent(p.x, p.y, 30 * z, ang - 0.9 + land * 0.8, 1.9, 18 * z, la, 0.75);
          crescent(p.x, p.y, 30 * z, ang + 0.9 - land * 0.8, 1.9, 18 * z, la * 0.8, 0.75);
        }
        const rr = seg(0.15, 0.8);
        if (rr > 0) ring(toScreen(tx, ty, 0), (0.4 + 1.2 * out3(rr)) * U, ROSE, (1 - rr) * 0.85, 3);
        return true;
      }

      // REAPER SCYTHE: a great blade swept across the cone on a dark snath
      case 'sp_reaper_scythe': {
        const half = ((fx.arc || 140) * Math.PI) / 360;
        const base = Math.atan2(fx.dirY || 0, fx.dirX || 1);
        const range = fx.range || 4;
        const sw = out3(seg(0, 0.45));
        const head = base - half + 2 * half * sw;
        const tail = Math.max(base - half, head - 1.6);
        shade(() => {
          groundBand(tx, ty, 0.3, range, tail, head, 0);
          ctx.fillStyle = `rgba(25, 3, 10, ${0.22 * fade})`;
          ctx.fill();
        });
        // blade ribbon, brightest and thickest at the head
        const N = 16;
        const inner = (k) => range * (0.85 - 0.4 * k);
        for (let i = 0; i < N; i++) {
          const k0 = i / N, k1 = (i + 1) / N;
          const a0 = tail + (head - tail) * k0, a1 = tail + (head - tail) * k1;
          const quad = [[range, a0], [range, a1], [inner(k1), a1], [inner(k0), a0]]
            .map(([r, a]) => toScreen(tx + Math.cos(a) * r, ty + Math.sin(a) * r, 0.3));
          ctx.beginPath();
          quad.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath();
          ctx.fillStyle = c(k1 > 0.8 ? ROSE : CRIMSON, fade * (0.06 + 0.7 * k1 * k1));
          ctx.fill();
        }
        ctx.beginPath();
        for (let k = 0; k <= 16; k++) {
          const a = tail + ((head - tail) * k) / 16;
          const p = toScreen(tx + Math.cos(a) * range, ty + Math.sin(a) * range, 0.3);
          if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = c(ROSE, fade * 0.35);
        ctx.lineWidth = 6 * z;
        ctx.stroke();
        ctx.strokeStyle = c(BONE, fade * 0.95);
        ctx.lineWidth = 2 * z;
        ctx.stroke();
        // the snath from the reaper's hands to the blade
        const hand = toScreen(tx, ty, 0.7);
        const heel = toScreen(tx + Math.cos(head) * range * 0.55, ty + Math.sin(head) * range * 0.55, 0.4);
        shade(() => {
          ctx.beginPath();
          ctx.moveTo(hand.x, hand.y);
          ctx.lineTo(heel.x, heel.y);
          ctx.strokeStyle = `rgba(30, 6, 12, ${0.85 * fade})`;
          ctx.lineWidth = 4 * z;
          ctx.lineCap = 'round';
          ctx.stroke();
        });
        if (sw < 1) bead(toScreen(tx + Math.cos(head) * range * 0.95, ty + Math.sin(head) * range * 0.95, 0.3), 16 * z, fade);
        // stolen life drifting back to the reaper
        const back = seg(0.4, 1);
        if (back > 0 && back < 1) {
          for (let k = 0; k < 5; k++) {
            const a = base - half + ((k + 0.5) / 5) * 2 * half;
            const d = range * 0.8 * (1 - out3(back));
            bead(toScreen(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 0.5 + back * 0.4), 5 * z, 1 - back);
          }
        }
        return true;
      }

      // BLACK SUN: an eclipse drops from the sky and bursts into a corona scorched on the ground
      case 'sp_black_sun': {
        const R = (fx.radius || 3) * U;
        const g = toScreen(tx, ty, 0);
        const fall = seg(0, 0.3), boom = seg(0.3, 1);
        const H = 7;
        pool(g, R * (0.25 + 0.75 * fall), 0.6 * fade);
        if (fall < 1) {
          ctx.setLineDash([6 * z, 6 * z]);
          ring(g, R, CRIMSON, 0.6 + 0.3 * Math.sin(time * 20), 2);
          ctx.setLineDash([]);
          const h = 0.7 + (H - 0.7) * (1 - fall * fall);
          const sun = toScreen(tx, ty, h), from = toScreen(tx, ty, Math.min(H + 2, h + 3));
          const trail = ctx.createLinearGradient(from.x, from.y, sun.x, sun.y);
          trail.addColorStop(0, c(CRIMSON, 0));
          trail.addColorStop(1, c(ROSE, 0.8));
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(sun.x, sun.y);
          ctx.strokeStyle = trail;
          ctx.lineWidth = 18 * z;
          ctx.stroke();
          blackSun(sun, 17 * z, 1);
          return true;
        }
        // the sun sinks into the ground
        blackSun(toScreen(tx, ty, 0.7 * (1 - boom)), 17 * z * (1 - out3(Math.min(1, boom * 2.5))), 1 - boom);
        const fl = 1 - seg(0.3, 0.55);
        if (fl > 0) {
          const p = toScreen(tx, ty, 0.5);
          const flash = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * 0.8);
          flash.addColorStop(0, c(BONE, fl));
          flash.addColorStop(0.35, c(ROSE, fl * 0.6));
          flash.addColorStop(1, c(CRIMSON, 0));
          ctx.fillStyle = flash;
          ctx.beginPath();
          ctx.arc(p.x, p.y, R * 0.8, 0, TAU);
          ctx.fill();
        }
        // corona rays scorched across the ground
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.scale(1, 0.5);
        for (let k = 0; k < 16; k++) {
          const a = (k * TAU) / 16 + 0.1;
          const len = R * (k % 2 ? 0.8 : 1.05) * out3(boom);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a - 0.09) * R * 0.2, Math.sin(a - 0.09) * R * 0.2);
          ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
          ctx.lineTo(Math.cos(a + 0.09) * R * 0.2, Math.sin(a + 0.09) * R * 0.2);
          ctx.closePath();
          ctx.fillStyle = c(k % 2 ? CRIMSON : ROSE, (1 - boom) * 0.8);
          ctx.fill();
        }
        ctx.restore();
        ring(g, R * (0.2 + 0.9 * out3(boom)), ROSE, (1 - boom) * 0.95, 5);
        ring(g, R * (0.1 + 0.7 * out3(boom)), BONE, (1 - boom) * 0.6, 1.5);
        return true;
      }

      // HARVEST: a reaping sigil, spectral scythes spiral inward, the core bursts in a blood X
      case 'sp_harvest': {
        const Rw = fx.radius || 4.5, R = Rw * U;
        const g = toScreen(tx, ty, 0);
        const draw = out3(seg(0, 0.25));
        const inward = out3(seg(0.05, 0.62));
        const snap = seg(0.62, 1);
        pool(g, R * draw, 0.5 * fade);
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.scale(1, 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.1, R * draw), 0, TAU);
        ctx.strokeStyle = c(ROSE, fade * 0.85);
        ctx.lineWidth = 3 * z;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.1, R * 0.84 * draw), 0, TAU);
        ctx.strokeStyle = c(CRIMSON, fade * 0.6);
        ctx.lineWidth = 1.5 * z;
        ctx.stroke();
        // crescent runes between the rings
        for (let k = 0; k < 10; k++) {
          const a = (k * TAU) / 10 + time * 0.6;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * R * 0.92 * draw, Math.sin(a) * R * 0.92 * draw, 5 * z, a + 0.6, a + 0.6 + Math.PI * 1.2);
          ctx.strokeStyle = c(PINK, fade * 0.8);
          ctx.lineWidth = 2 * z;
          ctx.stroke();
        }
        // spiral arms dragging everything to the centre
        for (let k = 0; k < 5; k++) {
          const a0 = (k * TAU) / 5 - time * 4;
          ctx.beginPath();
          for (let s = 0; s <= 10; s++) {
            const t = s / 10, rr = R * draw * (1 - t), a = a0 + t * 2.6;
            if (s === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          ctx.strokeStyle = c(CRIMSON, fade * 0.55);
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();
        }
        ctx.restore();
        if (snap < 1) {
          for (let k = 0; k < 4; k++) {
            const a = (k * TAU) / 4 + progress * 9;
            const rr = Rw * (0.95 - 0.8 * inward);
            const p = toScreen(tx + Math.cos(a) * rr, ty + Math.sin(a) * rr, 0.6);
            const q = toScreen(tx + Math.cos(a + 0.1) * rr, ty + Math.sin(a + 0.1) * rr, 0.6);
            crescent(p.x, p.y, 18 * z, Math.atan2(q.y - p.y, q.x - p.x), 2.0, 11 * z, (1 - snap) * 0.85 * draw);
          }
        }
        blackSun(toScreen(tx, ty, 0.9), (6 + 12 * inward) * z * (1 - out3(snap)), 1 - snap);
        if (snap > 0 && snap < 1) {
          ring(g, R * (0.15 + 0.6 * out3(snap)), ROSE, (1 - snap) * 0.95, 4.5);
          slashX(toScreen(tx, ty, 0.6), 44 * z * out3(Math.min(1, snap * 3)), 1 - snap);
        }
        return true;
      }

      // CRIMSON BLINK: cut an X where you stood, arc through a stream of blood, land in a crimson pillar
      case 'sp_crimson_blink': {
        const r = (fx.radius || 2.4) * U;
        const o = toScreen(sx, sy, 0), d = toScreen(tx, ty, 0);
        const burst = seg(0, 0.55), land = seg(0.15, 0.75);
        pool(o, r * 0.8, 0.55 * (1 - burst));
        if (fx.origin) ring(o, r * (0.3 + 0.7 * out3(burst)), ROSE, (1 - burst) * 0.9, 3);
        slashX(toScreen(sx, sy, 0.6), 32 * z * out3(Math.min(1, progress * 5)), 1 - seg(0.05, 0.5));
        const lead = seg(0, 0.3);
        for (let k = 0; k <= 8; k++) {
          const t = k / 8;
          if (t > lead) break;
          const p = toScreen(sx + (tx - sx) * t, sy + (ty - sy) * t, 0.5 + Math.sin(t * Math.PI) * 1.2);
          bead(p, (3 + 2 * t) * z, fade * (0.35 + 0.65 * t));
        }
        if (land > 0 && land < 1) {
          const pa = 1 - land;
          const top = toScreen(tx, ty, 3.2);
          const w = 18 * z * (1 - land * 0.6);
          const col = ctx.createLinearGradient(d.x, d.y, top.x, top.y);
          col.addColorStop(0, c(ROSE, pa * 0.85));
          col.addColorStop(0.5, c(CRIMSON, pa * 0.45));
          col.addColorStop(1, c(CRIMSON, 0));
          ctx.fillStyle = col;
          ctx.fillRect(d.x - w / 2, top.y, w, d.y - top.y);
          ctx.fillStyle = c(BONE, pa * 0.7);
          ctx.fillRect(d.x - w * 0.12, top.y, w * 0.24, d.y - top.y);
          // ring of thorns
          const lr = (fx.landing ? r : r * 0.5) * (0.3 + 0.7 * out3(land));
          ring(d, lr, ROSE, pa * 0.95, 3.5);
          for (let k = 0; k < 10; k++) {
            const a = (k * TAU) / 10;
            const bx = d.x + Math.cos(a) * lr, by = d.y + Math.sin(a) * lr * 0.5;
            ctx.beginPath();
            ctx.moveTo(bx - 2.5 * z, by);
            ctx.lineTo(bx + Math.cos(a) * 3 * z, by - 12 * z * pa);
            ctx.lineTo(bx + 2.5 * z, by);
            ctx.closePath();
            ctx.fillStyle = c(PINK, pa * 0.9);
            ctx.fill();
          }
        }
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- Base Rogue Skills High-Fidelity Visuals
  drawBaseRogueSkill(ctx, fx, progress, alpha, toScreen, z) {
    if (!fx || !fx.type) return false;
    const time = this.animations.time;
    const easeOut = 1 - Math.pow(1 - Math.min(1, progress * 1.8), 3);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // =========================================================================
    // 1. FAN OF KNIVES (Lv. 1 AoE)
    // =========================================================================
    if (fx.type === 'fan_of_knives') {
      const screen = toScreen(fx.x, fx.y, 0);
      const hitRadius = (fx.radius || 3.4) * 26 * z * Math.min(1.0, progress * 1.4);
      const rot = time * 12;

      // Rotating Obsidian & Emerald Runic Ground Mandala
      const glyphR = hitRadius * 0.95;
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(rot * 0.2);
      ctx.beginPath();
      ctx.ellipse(0, 0, glyphR, glyphR * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(34, 197, 94, ${alpha * 0.7})`;
      ctx.lineWidth = 2.5 * z;
      ctx.stroke();

      // 8 Runic Inscriptions on Ground
      for (let g = 0; g < 8; g++) {
        const ga = g * (Math.PI / 4);
        const gx = Math.cos(ga) * (glyphR * 0.85);
        const gy = Math.sin(ga) * (glyphR * 0.425);
        ctx.beginPath();
        ctx.arc(gx, gy, 2.5 * z, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(134, 239, 172, ${alpha * 0.9})`;
        ctx.fill();
      }
      ctx.restore();

      // Central Toxic Chemical Detonation Flare
      const burstGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, 24 * z);
      burstGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
      burstGrad.addColorStop(0.35, `rgba(74, 222, 128, ${alpha * 0.92})`);
      burstGrad.addColorStop(0.7, `rgba(22, 101, 52, ${alpha * 0.65})`);
      burstGrad.addColorStop(1, 'rgba(5, 46, 22, 0)');
      ctx.fillStyle = burstGrad;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 24 * z, 12 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // 14 Radiating Ornate Obsidian-Steel Daggers with Luminous Curving Trails
      for (let k = 0; k < 14; k++) {
        const angle = (k * (Math.PI * 2 / 14)) + rot;
        const kx = screen.x + Math.cos(angle) * hitRadius;
        const ky = screen.y + Math.sin(angle) * (hitRadius * 0.5);
        const prevAngle = angle - 0.28;
        const prevKx = screen.x + Math.cos(prevAngle) * (hitRadius * 0.72);
        const prevKy = screen.y + Math.sin(prevAngle) * (hitRadius * 0.36);

        // Curving Poison Motion-Trail
        ctx.beginPath();
        ctx.moveTo(prevKx, prevKy);
        ctx.quadraticCurveTo((prevKx + kx) / 2 + Math.cos(angle + 0.5) * 6 * z, (prevKy + ky) / 2, kx, ky);
        ctx.strokeStyle = `rgba(34, 197, 94, ${alpha * 0.85})`;
        ctx.lineWidth = 4 * z;
        ctx.stroke();
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
        ctx.lineWidth = 1.4 * z;
        ctx.stroke();

        // 3D Shaded Dagger Model
        ctx.save();
        ctx.translate(kx, ky);
        ctx.rotate(angle + Math.PI * 0.5);

        // Blade Facets (Split light & shadow)
        ctx.beginPath();
        ctx.moveTo(0, -10 * z); // Blade Tip
        ctx.lineTo(3.2 * z, 2 * z);
        ctx.lineTo(0, 3 * z);
        ctx.closePath();
        ctx.fillStyle = '#ffffff'; // Light edge
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, -10 * z);
        ctx.lineTo(-3.2 * z, 2 * z);
        ctx.lineTo(0, 3 * z);
        ctx.closePath();
        ctx.fillStyle = '#64748b'; // Dark edge
        ctx.fill();

        // Neon Poison Fuller Channel
        ctx.beginPath();
        ctx.moveTo(0, -8 * z);
        ctx.lineTo(0, 2 * z);
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 1.5 * z;
        ctx.stroke();

        // Crossguard & Hilt
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-4 * z, 3 * z, 8 * z, 1.8 * z);
        ctx.fillRect(-1.5 * z, 4.8 * z, 3 * z, 4.5 * z);

        // Tip Specular Glint
        ctx.beginPath();
        ctx.arc(0, -10 * z, 2 * z, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.restore();
      }

      ctx.restore();
      return true;
    }

    // =========================================================================
    // 2. SHADOW DASH (Lv. 1 Mobility)
    // =========================================================================
    if (fx.type === 'shadow_dash') {
      const p1 = toScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4);
      const p2 = toScreen(fx.x, fx.y, 0.4);

      // Deep Ground Void Rift
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = `rgba(147, 51, 234, ${alpha * 0.85})`;
      ctx.lineWidth = 14 * z;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
      ctx.lineWidth = 3.5 * z;
      ctx.stroke();

      // 4 Shadow Ninja Afterimages along Dash Vector
      for (let i = 1; i <= 4; i++) {
        const t = i / 5;
        const ax = p1.x + (p2.x - p1.x) * t;
        const ay = p1.y + (p2.y - p1.y) * t;
        const imgAlpha = alpha * (0.3 + 0.6 * t);

        ctx.save();
        ctx.translate(ax, ay);

        // Ninja Shadow Torso & Hood
        ctx.beginPath();
        ctx.ellipse(0, -12 * z, 7 * z, 14 * z, 0.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(88, 28, 135, ${imgAlpha * 0.7})`;
        ctx.fill();

        // Fluttering Violet Scarf
        ctx.beginPath();
        ctx.moveTo(0, -16 * z);
        ctx.quadraticCurveTo(-12 * z, -14 * z, -20 * z, -18 * z);
        ctx.strokeStyle = `rgba(192, 132, 252, ${imgAlpha * 0.95})`;
        ctx.lineWidth = 3 * z;
        ctx.stroke();

        // Glowing Amethyst Slit Eyes
        ctx.beginPath();
        ctx.arc(3 * z, -18 * z, 1.4 * z, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.restore();
      }

      // Origin Implosion Ring & Destination Shockwave
      const r1 = 18 * z * (1 - progress);
      ctx.beginPath();
      ctx.ellipse(p1.x, p1.y, r1, r1 * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.9})`;
      ctx.lineWidth = 2.5 * z;
      ctx.stroke();

      const r2 = 26 * z * Math.min(1.0, progress * 1.5);
      ctx.beginPath();
      ctx.ellipse(p2.x, p2.y, r2, r2 * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.95})`;
      ctx.lineWidth = 3.5 * z;
      ctx.stroke();

      ctx.restore();
      return true;
    }

    // =========================================================================
    // 3. POISON DARTS / VENOM SHURIKENS (Lv. 5)
    // =========================================================================
    if (fx.type === 'poison_darts') {
      const screen = toScreen(fx.x, fx.y, 0.4);
      const dirX = fx.dirX || 1, dirY = fx.dirY || 0;
      const baseAngle = Math.atan2(dirY, dirX);
      const dist = 40 * z * Math.min(1.0, progress * 2.2);

      // Hero launch shockwave
      const mRad = 16 * z * easeOut;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, mRad, mRad * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(74, 222, 128, ${alpha * 0.8})`;
      ctx.lineWidth = 2.5 * z;
      ctx.stroke();

      // 6 Flying Venom-Coated Heavy Shurikens
      for (let s = 0; s < 6; s++) {
        const spreadAngle = baseAngle + (s - 2.5) * 0.18;
        const sx = screen.x + Math.cos(spreadAngle) * dist;
        const sy = screen.y + Math.sin(spreadAngle) * (dist * 0.5);
        const trailX = screen.x + Math.cos(spreadAngle) * (dist * 0.45);
        const trailY = screen.y + Math.sin(spreadAngle) * (dist * 0.225);

        // Fluid Emerald Toxic Motion Ribbon
        ctx.beginPath();
        ctx.moveTo(trailX, trailY);
        ctx.lineTo(sx, sy);
        ctx.strokeStyle = `rgba(34, 197, 94, ${alpha * 0.85})`;
        ctx.lineWidth = 3.5 * z;
        ctx.stroke();
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
        ctx.lineWidth = 1.2 * z;
        ctx.stroke();

        // 4-Pointed Hooked Ninja Shuriken
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(time * 22 + s);

        ctx.beginPath();
        for (let b = 0; b < 4; b++) {
          const ba = b * (Math.PI / 2);
          ctx.lineTo(Math.cos(ba) * 7.5 * z, Math.sin(ba) * 7.5 * z);
          ctx.lineTo(Math.cos(ba + 0.35) * 2.5 * z, Math.sin(ba + 0.35) * 2.5 * z);
        }
        ctx.closePath();
        ctx.fillStyle = '#f8fafc';
        ctx.fill();
        ctx.strokeStyle = `rgba(34, 197, 94, ${alpha * 0.98})`;
        ctx.lineWidth = 1.6 * z;
        ctx.stroke();

        // Center emerald jewel
        ctx.beginPath();
        ctx.arc(0, 0, 2 * z, 0, Math.PI * 2);
        ctx.fillStyle = '#15803d';
        ctx.fill();

        ctx.restore();
      }

      ctx.restore();
      return true;
    }

    // =========================================================================
    // 4. BARBED CALTROPS (Lv. 10 Trap)
    // =========================================================================
    if (fx.type === 'caltrops') {
      const screen = toScreen(fx.x, fx.y, 0);
      const rad = (fx.radius || 3.2) * 25 * z;

      // Outer Danger Hazard Perimeter (Barbed wire chain)
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(185, 28, 28, ${alpha * 0.8})`;
      ctx.lineWidth = 2.5 * z;
      ctx.stroke();

      // 16 Realistic 3D Metallic Tetrahedral Caltrops
      for (let c = 0; c < 16; c++) {
        const cAngle = c * 2.399; // Golden spiral
        const cDist = Math.sqrt((c + 1) / 16) * rad * 0.9;
        const cx = screen.x + Math.cos(cAngle) * cDist;
        const cy = screen.y + Math.sin(cAngle) * (cDist * 0.5);

        // Ground Drop Shadow
        ctx.beginPath();
        ctx.ellipse(cx, cy + 2 * z, 4 * z, 2 * z, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fill();

        // Shaded 3D Metal Spikes
        ctx.beginPath();
        ctx.moveTo(cx, cy - 6 * z); // Top Barb
        ctx.lineTo(cx + 4 * z, cy + 2.5 * z); // Right foot
        ctx.lineTo(cx, cy + 1 * z);
        ctx.closePath();
        ctx.fillStyle = '#cbd5e1'; // Light facet
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(cx, cy - 6 * z);
        ctx.lineTo(cx - 4 * z, cy + 2.5 * z); // Left foot
        ctx.lineTo(cx, cy + 1 * z);
        ctx.closePath();
        ctx.fillStyle = '#475569'; // Shadow facet
        ctx.fill();

        // Blood / Poison Coated Tip
        ctx.beginPath();
        ctx.moveTo(cx, cy - 6 * z);
        ctx.lineTo(cx + 1.5 * z, cy - 3 * z);
        ctx.lineTo(cx - 1.5 * z, cy - 3 * z);
        ctx.closePath();
        ctx.fillStyle = (c % 2 === 0) ? '#dc2626' : '#16a34a';
        ctx.fill();
      }

      ctx.restore();
      return true;
    }

    // =========================================================================
    // 5. SHADOWSTEP AMBUSH (Lv. 15 Backstab)
    // =========================================================================
    if (fx.type === 'shadowstep') {
      const p1 = toScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4);
      const p2 = toScreen(fx.x, fx.y, 0.4);

      // Origin: Dimensional Black Hole Implosion
      const r1 = 24 * z * (1 - progress);
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, r1, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.9})`;
      ctx.lineWidth = 3.5 * z;
      ctx.stroke();

      // Destination: Violent Cross-Cleave Razor Scythes (X-Slash)
      const slashLen = 32 * z * easeOut;
      ctx.beginPath();
      ctx.moveTo(p2.x - slashLen, p2.y - slashLen * 0.55);
      ctx.lineTo(p2.x + slashLen, p2.y + slashLen * 0.55);
      ctx.strokeStyle = `rgba(244, 63, 94, ${alpha * 0.95})`;
      ctx.lineWidth = 6 * z;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(p2.x + slashLen, p2.y - slashLen * 0.55);
      ctx.lineTo(p2.x - slashLen, p2.y + slashLen * 0.55);
      ctx.strokeStyle = `rgba(244, 63, 94, ${alpha * 0.95})`;
      ctx.lineWidth = 6 * z;
      ctx.stroke();

      // Sharp Pure White Razor Core
      ctx.beginPath();
      ctx.moveTo(p2.x - slashLen * 0.85, p2.y - slashLen * 0.45);
      ctx.lineTo(p2.x + slashLen * 0.85, p2.y + slashLen * 0.45);
      ctx.moveTo(p2.x + slashLen * 0.85, p2.y - slashLen * 0.45);
      ctx.lineTo(p2.x - slashLen * 0.85, p2.y + slashLen * 0.45);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
      ctx.lineWidth = 2.2 * z;
      ctx.stroke();

      // Floating Assassin Execution Eye Sigil above Target
      const eyeY = p2.y - 28 * z;
      ctx.beginPath();
      ctx.moveTo(p2.x - 14 * z, eyeY);
      ctx.quadraticCurveTo(p2.x, eyeY - 8 * z, p2.x + 14 * z, eyeY);
      ctx.quadraticCurveTo(p2.x, eyeY + 8 * z, p2.x - 14 * z, eyeY);
      ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.98})`;
      ctx.lineWidth = 2 * z;
      ctx.stroke();

      // Crimson Slit Pupil
      ctx.beginPath();
      ctx.ellipse(p2.x, eyeY, 3 * z, 6 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();

      ctx.restore();
      return true;
    }

    // =========================================================================
    // 6. TOXIC BOMB (Lv. 20 AoE Fog)
    // =========================================================================
    if (fx.type === 'toxic_bomb') {
      const screen = toScreen(fx.x, fx.y, 0);
      const rad = (fx.radius || 3.2) * 28 * z * Math.min(1.0, progress * 1.5);

      // Organic Boiling Acid Pool with multi-stop radial gradient
      const toxGrad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
      toxGrad.addColorStop(0, `rgba(187, 247, 208, ${alpha * 0.98})`);
      toxGrad.addColorStop(0.3, `rgba(74, 222, 128, ${alpha * 0.88})`);
      toxGrad.addColorStop(0.7, `rgba(22, 101, 52, ${alpha * 0.65})`);
      toxGrad.addColorStop(1, 'rgba(5, 46, 22, 0)');
      ctx.fillStyle = toxGrad;

      ctx.beginPath();
      for (let p = 0; p < 16; p++) {
        const pa = p * (Math.PI * 2 / 16);
        const wave = 1 + 0.08 * Math.sin(pa * 3 + time * 4);
        const px = screen.x + Math.cos(pa) * (rad * wave);
        const py = screen.y + Math.sin(pa) * (rad * 0.5 * wave);
        if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      // Outer Caustic Hazard Border Ring
      ctx.strokeStyle = `rgba(134, 239, 172, ${alpha * 0.95})`;
      ctx.lineWidth = 3.5 * z;
      ctx.stroke();

      // 9 Animated Popping Acid Bubbles with Specular Glints
      for (let b = 0; b < 9; b++) {
        const bAngle = (b * 1.25) + time * 1.8;
        const bDist = (0.2 + (b % 5) * 0.16) * rad;
        const bx = screen.x + Math.cos(bAngle) * bDist;
        const by = screen.y + Math.sin(bAngle) * (bDist * 0.5);
        const bPhase = (time * 5 + b * 1.7) % Math.PI;
        const bSize = Math.sin(bPhase) * 6.5 * z;

        if (bSize > 1) {
          ctx.beginPath();
          ctx.arc(bx, by, bSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(134, 239, 172, ${alpha * 0.9})`;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1 * z;
          ctx.stroke();

          // Bubble Specular Shine
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(bx - bSize * 0.35, by - bSize * 0.35, bSize * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Volumetric Billowing Smoke Clouds
      const smokeGrad = ctx.createRadialGradient(screen.x, screen.y - 14 * z, 3 * z, screen.x, screen.y - 14 * z, rad * 0.9);
      smokeGrad.addColorStop(0, `rgba(74, 222, 128, ${alpha * 0.55})`);
      smokeGrad.addColorStop(0.6, `rgba(22, 101, 52, ${alpha * 0.35})`);
      smokeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = smokeGrad;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 14 * z, rad * 0.9, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return true;
    }

    // =========================================================================
    // 7. VANISH SMOKE SCREEN (Lv. 25 Stealth)
    // =========================================================================
    if (fx.type === 'smoke_screen') {
      const screen = toScreen(fx.x, fx.y, 0.3);
      const rad = 36 * z * (0.8 + progress * 0.5);

      // Multi-Cluster Volumetric Rolling Ninja Concealment Fog
      for (let p = 0; p < 8; p++) {
        const pa = p * (Math.PI * 2 / 8) + time * 0.5;
        const pd = (0.3 + (p % 3) * 0.25) * rad;
        const px = screen.x + Math.cos(pa) * pd;
        const py = screen.y + Math.sin(pa) * (pd * 0.5);
        const puffR = (16 + (p % 4) * 6) * z;

        const pGrad = ctx.createRadialGradient(px, py, 2 * z, px, py, puffR);
        pGrad.addColorStop(0, `rgba(30, 41, 59, ${alpha * 0.9})`);
        pGrad.addColorStop(0.5, `rgba(51, 65, 85, ${alpha * 0.65})`);
        pGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.arc(px, py, puffR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Kawarimi Wooden Substitution Decoy Log in Center
      if (progress < 0.7) {
        const logAlpha = alpha * (1 - progress / 0.7);
        ctx.save();
        ctx.translate(screen.x, screen.y - 8 * z);
        // Tree log body
        ctx.fillStyle = `rgba(120, 53, 15, ${logAlpha * 0.95})`;
        ctx.fillRect(-6 * z, -14 * z, 12 * z, 20 * z);
        // Annual wood rings on cut top
        ctx.beginPath();
        ctx.ellipse(0, -14 * z, 6 * z, 3 * z, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(217, 119, 6, ${logAlpha * 0.95})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(180, 83, 9, ${logAlpha})`;
        ctx.lineWidth = 1.2 * z;
        ctx.stroke();
        ctx.restore();
      }

      // 6 Floating Burnt Talisman Paper Amulets (符)
      for (let t = 0; t < 6; t++) {
        const ta = (t * Math.PI * 2 / 6) + time * 2;
        const td = rad * 0.75 * Math.min(1.0, progress * 1.5);
        const tx = screen.x + Math.cos(ta) * td;
        const ty = screen.y + Math.sin(ta) * (td * 0.5);

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(ta + time * 3);
        ctx.fillStyle = `rgba(254, 240, 138, ${alpha * 0.9})`;
        ctx.fillRect(-2.5 * z, -5 * z, 5 * z, 10 * z);
        ctx.strokeStyle = `rgba(220, 38, 38, ${alpha * 0.95})`;
        ctx.lineWidth = 1 * z;
        ctx.strokeRect(-2.5 * z, -5 * z, 5 * z, 10 * z);
        ctx.restore();
      }

      ctx.restore();
      return true;
    }

    // =========================================================================
    // 8. DEATH BLOSSOM (Lv. 30 Grand Omnislash)
    // =========================================================================
    if (fx.type === 'death_blossom') {
      const screen = toScreen(fx.x, fx.y, 0.4);
      const rad = (fx.radius || 4.0) * 30 * z;

      // Grand Crimson Blood Lotus Mandala on the Ground
      for (let petal = 0; petal < 12; petal++) {
        const pAngle = (petal * Math.PI / 6) + (time * 1.2);
        const px = screen.x + Math.cos(pAngle) * rad;
        const py = screen.y + Math.sin(pAngle) * (rad * 0.5);

        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y);
        ctx.quadraticCurveTo(
          screen.x + Math.cos(pAngle - 0.25) * (rad * 0.65),
          screen.y + Math.sin(pAngle - 0.25) * (rad * 0.325),
          px, py
        );
        ctx.quadraticCurveTo(
          screen.x + Math.cos(pAngle + 0.25) * (rad * 0.65),
          screen.y + Math.sin(pAngle + 0.25) * (rad * 0.325),
          screen.x, screen.y
        );
        ctx.fillStyle = `rgba(225, 29, 72, ${alpha * 0.38})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(251, 113, 133, ${alpha * 0.85})`;
        ctx.lineWidth = 2 * z;
        ctx.stroke();
      }

      // 10 Razor Omnislash Blades Slicing across Area
      for (let s = 0; s < 10; s++) {
        const angle = (s * Math.PI / 5) + (progress * 14);
        const d1 = rad * (0.2 + 0.8 * Math.sin(s * 1.5));
        const x1 = screen.x + Math.cos(angle) * d1;
        const y1 = screen.y + Math.sin(angle) * (d1 * 0.5);

        const a2 = angle + Math.PI * 0.75;
        const d2 = rad * (0.4 + 0.6 * Math.cos(s * 2.1));
        const x2 = screen.x + Math.cos(a2) * d2;
        const y2 = screen.y + Math.sin(a2) * (d2 * 0.5);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(244, 114, 182, ${alpha * 0.95})`;
        ctx.lineWidth = 5 * z;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
        ctx.lineWidth = 2 * z;
        ctx.stroke();

        // Sakura Blossom Petals
        ctx.beginPath();
        ctx.ellipse(x2, y2, 4 * z, 2.5 * z, angle, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(253, 164, 175, ${alpha * 0.95})`;
        ctx.fill();
      }

      ctx.restore();
      return true;
    }

    // =========================================================================
    // 9. VIPER VENOM BARRAGE (Lv. 35 Piercing Needles)
    // =========================================================================
    if (fx.type === 'venomous_barrage') {
      const screen = toScreen(fx.x, fx.y, 0.4);
      const dirX = fx.dirX || 1, dirY = fx.dirY || 0;
      const baseAngle = Math.atan2(dirY, dirX);
      const nDist = 55 * z * Math.min(1.0, progress * 2.2);

      // 20 High-Speed Piercing Senbon Needles with Jade Trails
      for (let n = -10; n <= 10; n++) {
        const nAngle = baseAngle + (n * 0.05);
        const nx = screen.x + Math.cos(nAngle) * nDist;
        const ny = screen.y + Math.sin(nAngle) * (nDist * 0.5);
        const trailX = screen.x + Math.cos(nAngle) * (nDist * 0.5);
        const trailY = screen.y + Math.sin(nAngle) * (nDist * 0.25);

        // Luminous Tracer Beam
        ctx.beginPath();
        ctx.moveTo(trailX, trailY);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = `rgba(34, 197, 94, ${alpha * 0.9})`;
        ctx.lineWidth = 2.8 * z;
        ctx.stroke();

        // Chrome Senbon Needle Body
        ctx.beginPath();
        ctx.arc(nx, ny, 2.2 * z, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      ctx.restore();
      return true;
    }

    // =========================================================================
    // 10. SHADOW CLONE MIRAGE (Lv. 40 Decoy Flurry)
    // =========================================================================
    if (fx.type === 'phantom_assassins') {
      const screen = toScreen(fx.x, fx.y, 0);
      const rad = (fx.radius || 4.2) * 28 * z;

      // 2 Master Shadow Ninja Clones Flanking Hero
      for (let c = -1; c <= 1; c += 2) {
        const cx = screen.x + c * (rad * 0.7);
        const cy = screen.y - 12 * z;

        // Ground Summoning Seal
        ctx.beginPath();
        ctx.ellipse(cx, cy + 14 * z, 16 * z, 8 * z, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.85})`;
        ctx.lineWidth = 2 * z;
        ctx.stroke();

        ctx.save();
        ctx.translate(cx, cy);

        // Shadow Hood and Body Silhouette
        ctx.beginPath();
        ctx.ellipse(0, 0, 8 * z, 16 * z, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(30, 27, 75, ${alpha * 0.85})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.95})`;
        ctx.lineWidth = 2 * z;
        ctx.stroke();

        // Billowing Purple Scarf
        ctx.beginPath();
        ctx.moveTo(0, -8 * z);
        ctx.quadraticCurveTo(-14 * z * c, -6 * z, -22 * z * c, -12 * z);
        ctx.strokeStyle = `rgba(236, 72, 153, ${alpha * 0.9})`;
        ctx.lineWidth = 3.5 * z;
        ctx.stroke();

        // Glowing Amethyst Slit Eyes
        ctx.beginPath();
        ctx.arc(-2 * z * c, -10 * z, 1.6 * z, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Sweeping Crescent Kris Blade Slash Arc
        ctx.beginPath();
        ctx.arc(0, 0, 18 * z, -0.6 * c, 1.2 * c);
        ctx.strokeStyle = `rgba(216, 180, 254, ${alpha * 0.95})`;
        ctx.lineWidth = 3.5 * z;
        ctx.stroke();

        ctx.restore();
      }

      ctx.restore();
      return true;
    }

    // =========================================================================
    // 11. GUILLOTINE EXECUTION (Lv. 45 Heavy Burst)
    // =========================================================================
    if (fx.type === 'assassins_cull') {
      const screen = toScreen(fx.x, fx.y, 0.5);

      // Cataclysmic Crimson Earth Fissure
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y + 15 * z, 26 * z, 13 * z, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.9})`;
      ctx.lineWidth = 3.5 * z;
      ctx.stroke();

      // Spectral Guillotine Great-Blade Descending
      const dropH = Math.max(0, (1 - easeOut * 2.8) * 60 * z);
      const gy = screen.y - dropH;

      ctx.save();
      ctx.translate(screen.x, gy);

      // Angled Guillotine Blade Face
      ctx.beginPath();
      ctx.moveTo(-28 * z, -40 * z);
      ctx.lineTo(28 * z, -40 * z);
      ctx.lineTo(28 * z, 10 * z);
      ctx.lineTo(-28 * z, -15 * z); // Sharp Guillotine Bevel
      ctx.closePath();
      ctx.fillStyle = `rgba(220, 38, 38, ${alpha * 0.95})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
      ctx.lineWidth = 3.5 * z;
      ctx.stroke();

      // Blood-stained Razor Blade Edge
      ctx.beginPath();
      ctx.moveTo(-28 * z, -15 * z);
      ctx.lineTo(28 * z, 10 * z);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4.5 * z;
      ctx.stroke();

      ctx.restore();

      // Radial Execution Blood-Red Shockwaves
      for (let w = 0; w < 6; w++) {
        const wa = w * (Math.PI / 3) + time * 4;
        const wx = screen.x + Math.cos(wa) * (35 * z * easeOut);
        const wy = screen.y + Math.sin(wa) * (17.5 * z * easeOut);
        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y);
        ctx.lineTo(wx, wy);
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.9})`;
        ctx.lineWidth = 3 * z;
        ctx.stroke();
      }

      ctx.restore();
      return true;
    }

    // =========================================================================
    // 12. ABYSSAL SHADOW CHAINS (Lv. 50 Pull & Lockdown)
    // =========================================================================
    if (fx.type === 'abyssal_tether') {
      const screen = toScreen(fx.x, fx.y, 0);
      const rad = (fx.radius || 5.2) * 28 * z;

      // Central Gravitational Void Vortex
      const vGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, 20 * z);
      vGrad.addColorStop(0, '#09090b');
      vGrad.addColorStop(0.5, `rgba(88, 28, 135, ${alpha * 0.8})`);
      vGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = vGrad;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 20 * z, 10 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // 6 Hexagram Abyssal Void Rifts with Interlocking Spiked Chains
      for (let ch = 0; ch < 6; ch++) {
        const chAngle = (ch * Math.PI * 2 / 6) + time * 1.5;
        const chx = screen.x + Math.cos(chAngle) * rad;
        const chy = screen.y + Math.sin(chAngle) * (rad * 0.5);

        // Ground Void Rift at Perimeter
        ctx.beginPath();
        ctx.ellipse(chx, chy, 8 * z, 4 * z, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#1e1b4b';
        ctx.fill();
        ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.95})`;
        ctx.lineWidth = 2 * z;
        ctx.stroke();

        // Heavy Spiked Steel Chain Links surging toward Center
        const nLinks = 7;
        for (let l = 0; l <= nLinks; l++) {
          const lt = l / nLinks;
          const lx = screen.x + (chx - screen.x) * lt;
          const ly = screen.y + (chy - screen.y) * lt;
          ctx.beginPath();
          ctx.ellipse(lx, ly, 3.5 * z, 2 * z, chAngle, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.95})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();
        }
      }

      ctx.restore();
      return true;
    }

    // =========================================================================
    // 13. DANCING RAZOR MIRAGE (Lv. 55 Mirage Flurry)
    // =========================================================================
    if (fx.type === 'blade_dance') {
      const screen = toScreen(fx.x, fx.y, 0);
      const rad = (fx.radius || 4.8) * 30 * z;
      const rot = time * 16;

      // 4 Holographic Blade Dancers orbiting
      for (let b = 0; b < 4; b++) {
        const bAngle = rot + (b * Math.PI * 2 / 4);
        const bx = screen.x + Math.cos(bAngle) * rad;
        const by = screen.y + Math.sin(bAngle) * (rad * 0.5);

        // Sweeping Dual-Colored Razor Ribbon
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(bAngle);
        ctx.beginPath();
        ctx.arc(0, 0, 24 * z, -0.8, 1.2);
        ctx.strokeStyle = (b % 2 === 0) ? `rgba(244, 114, 182, ${alpha * 0.95})` : `rgba(56, 189, 248, ${alpha * 0.95})`;
        ctx.lineWidth = 4.5 * z;
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8 * z;
        ctx.stroke();

        // Specular Blade Starburst Glint (✦)
        ctx.beginPath();
        ctx.arc(0, 0, 3.5 * z, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
      }

      // Sacred Geometry Razor Star
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, rad * 0.65, rad * 0.325, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.8})`;
      ctx.lineWidth = 2 * z;
      ctx.stroke();

      ctx.restore();
      return true;
    }

    // =========================================================================
    // 14. VOID ECLIPSE OMNISLASH (Lv. 60 Grand Ultimate)
    // =========================================================================
    if (fx.type === 'eclipse_execution') {
      const screen = toScreen(fx.x, fx.y, 0);
      const rad = (fx.radius || 6.0) * 34 * z * Math.min(1.0, progress * 1.5);

      // Total Cosmic Eclipse Core on Ground
      const cGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, 28 * z);
      cGrad.addColorStop(0, '#000000');
      cGrad.addColorStop(0.4, '#090514');
      cGrad.addColorStop(0.75, `rgba(147, 51, 234, ${alpha * 0.9})`);
      cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 28 * z, 14 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shimmering Diamond-Violet Solar Corona Flares
      for (let p = 0; p < 12; p++) {
        const pa = (p * Math.PI * 2 / 12) + time * 3;
        const pLen = (28 + 8 * Math.sin(pa * 2)) * z;
        const px = screen.x + Math.cos(pa) * pLen;
        const py = screen.y + Math.sin(pa) * (pLen * 0.5);
        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y);
        ctx.lineTo(px, py);
        ctx.strokeStyle = `rgba(216, 180, 254, ${alpha * 0.85})`;
        ctx.lineWidth = 3 * z;
        ctx.stroke();
      }

      // 16 Supersonic Dimensional Omnislash Vectors
      for (let v = 0; v < 16; v++) {
        const vAngle = v * 0.95 + time * 14;
        const x1 = screen.x + Math.cos(vAngle) * rad;
        const y1 = screen.y + Math.sin(vAngle) * (rad * 0.5);
        const x2 = screen.x - Math.cos(vAngle) * rad;
        const y2 = screen.y - Math.sin(vAngle) * (rad * 0.5);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.95})`;
        ctx.lineWidth = 4.5 * z;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
        ctx.lineWidth = 2 * z;
        ctx.stroke();
      }

      ctx.restore();
      return true;
    }

    // =========================================================================
    // 15. SHADOW STRIKE (Rogue Dagger Strike)
    // =========================================================================
    if (fx.type === 'shadow_strike') {
      const p1 = toScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4);
      const p2 = toScreen(fx.x, fx.y, 0.4);

      // Teleport Dash Laser Line
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.9})`;
      ctx.lineWidth = 7 * z;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
      ctx.lineWidth = 2.5 * z;
      ctx.stroke();

      // Dual Cross-Cleave Razor Scythes at Destination
      const cutSize = 28 * z * easeOut;
      ctx.beginPath();
      ctx.moveTo(p2.x - cutSize, p2.y - cutSize * 0.5);
      ctx.lineTo(p2.x + cutSize, p2.y + cutSize * 0.5);
      ctx.moveTo(p2.x + cutSize, p2.y - cutSize * 0.5);
      ctx.lineTo(p2.x - cutSize, p2.y + cutSize * 0.5);
      ctx.strokeStyle = `rgba(236, 72, 153, ${alpha * 0.95})`;
      ctx.lineWidth = 4.5 * z;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(p2.x - cutSize * 0.8, p2.y - cutSize * 0.4);
      ctx.lineTo(p2.x + cutSize * 0.8, p2.y + cutSize * 0.4);
      ctx.moveTo(p2.x + cutSize * 0.8, p2.y - cutSize * 0.4);
      ctx.lineTo(p2.x - cutSize * 0.8, p2.y + cutSize * 0.4);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
      ctx.lineWidth = 2 * z;
      ctx.stroke();

      ctx.restore();
      return true;
    }

    ctx.restore();
    return false;
  }

  drawSpSkill(ctx, fx, progress, alpha) {
    const z = this.camera.zoom;
    const W = this.canvas.width, H = this.canvas.height;
    const toScreen = (x, y, h = 0) => Isometric.worldToScreen(x, y, h, this.camera, W, H);
    const color = fx.color || '#e2e8f0';
    const rgba = (a) => {
      const n = parseInt(color.slice(1), 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
    };
    const easeOut = 1 - Math.pow(1 - Math.min(1, progress * 1.8), 3);
    const ring = (cx, cy, r, fillA, strokeA, width) => {
      this.spGroundPath(ctx, cx, cy, r);
      if (fillA) { ctx.fillStyle = rgba(fillA); ctx.fill(); }
      if (strokeA) { ctx.strokeStyle = rgba(strokeA); ctx.lineWidth = width * z; ctx.stroke(); }
    };
    // jagged for lightning, straight otherwise
    const bolt = (a, b, width, coreA) => {
      const pa = toScreen(a.x, a.y, 0.6), pb = toScreen(b.x, b.y, 0.6);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      if (fx.element === 'lightning') {
        for (let k = 1; k < 6; k++) {
          const t = k / 6;
          ctx.lineTo(pa.x + (pb.x - pa.x) * t + (Math.random() - 0.5) * 14 * z, pa.y + (pb.y - pa.y) * t + (Math.random() - 0.5) * 14 * z);
        }
      }
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = rgba(alpha * 0.85);
      ctx.lineWidth = width * z;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * coreA})`;
      ctx.lineWidth = Math.max(1, width * 0.35) * z;
      ctx.stroke();
    };

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (fx.shape === 'field') {
      this.drawSpField(ctx, fx, progress, toScreen, z);
      ctx.restore();
      return;
    }
    if ((fx.skillId && fx.skillId.startsWith('wpn_') && this.drawWeaponSkill(ctx, fx, progress, toScreen, z)) ||
        this.drawRogueSkill(ctx, fx, progress, alpha, toScreen, z, rgba) ||
        (fx.cardId === 'sp_pyromancer' && this.drawPyromancerSkill(ctx, fx, progress, toScreen, z)) ||
        (fx.cardId === 'sp_cryo_sage' && this.drawCryoSageSkill(ctx, fx, progress, toScreen, z)) ||
        (fx.cardId === 'sp_dread_lord' && this.drawDreadLordSkill(ctx, fx, progress, toScreen, z))) {
      ctx.restore();
      return;
    }

    switch (fx.shape) {
      case 'nova':
      case 'pulse':
      case 'blast': {
        const r = (fx.radius || 2) * (fx.shape === 'blast' ? 0.4 + 0.6 * easeOut : easeOut);
        ring(fx.x, fx.y, r, alpha * 0.22, alpha * 0.9, 4);
        ring(fx.x, fx.y, r * 0.6, 0, alpha * 0.55, 2);
        if (fx.shape === 'blast') {
          // falling column onto the impact point
          const top = toScreen(fx.x, fx.y, 4 * (1 - easeOut)), base = toScreen(fx.x, fx.y, 0);
          ctx.beginPath();
          ctx.moveTo(top.x, top.y);
          ctx.lineTo(base.x, base.y);
          ctx.strokeStyle = rgba(alpha);
          ctx.lineWidth = 10 * z;
          ctx.stroke();
        }
        break;
      }
      case 'rain': {
        if (fx.areaR) ring(fx.areaX, fx.areaY, fx.areaR, 0, alpha * 0.25, 1.5);
        const top = toScreen(fx.x, fx.y, 5 * (1 - easeOut)), base = toScreen(fx.x, fx.y, 0);
        ctx.beginPath();
        ctx.moveTo(top.x, top.y - 30 * z);
        ctx.lineTo(top.x, top.y);
        ctx.strokeStyle = rgba(alpha);
        ctx.lineWidth = 6 * z;
        ctx.stroke();
        if (progress > 0.4) ring(fx.x, fx.y, (fx.radius || 1.2) * Math.min(1, (progress - 0.4) * 2.5), alpha * 0.3, alpha * 0.9, 3);
        ctx.beginPath();
        ctx.arc(base.x, base.y, 3 * z, 0, Math.PI * 2);
        ctx.fillStyle = rgba(alpha);
        ctx.fill();
        break;
      }
      case 'pull': {
        const r = (fx.radius || 3) * (1 - 0.65 * easeOut);
        ring(fx.x, fx.y, fx.radius || 3, 0, alpha * 0.35, 2);
        ring(fx.x, fx.y, r, alpha * 0.25, alpha * 0.9, 4);
        const c = toScreen(fx.x, fx.y, 0);
        for (let k = 0; k < 6; k++) {
          const a0 = (k / 6) * Math.PI * 2 + this.animations.time * 5;
          ctx.beginPath();
          for (let t = 0; t <= 1; t += 0.1) {
            const rr = (fx.radius || 3) * (1 - t);
            const pt = toScreen(fx.x + Math.cos(a0 + t * 2.5) * rr, fx.y + Math.sin(a0 + t * 2.5) * rr, 0);
            if (t === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
          }
          ctx.strokeStyle = rgba(alpha * 0.7);
          ctx.lineWidth = 2 * z;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(c.x, c.y, 8 * z * (0.5 + easeOut), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(10, 5, 20, ${alpha * 0.6})`;
        ctx.fill();
        break;
      }
      case 'cone': {
        const half = ((fx.arc || 90) * Math.PI) / 360;
        const base = Math.atan2(fx.dirY || 0, fx.dirX || 1);
        const reach = (fx.range || 4) * easeOut;
        ctx.beginPath();
        const o = toScreen(fx.x, fx.y, 0);
        ctx.moveTo(o.x, o.y);
        for (let k = 0; k <= 16; k++) {
          const a = base - half + (k / 16) * half * 2;
          const pt = toScreen(fx.x + Math.cos(a) * reach, fx.y + Math.sin(a) * reach, 0);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fillStyle = rgba(alpha * 0.3);
        ctx.fill();
        ctx.strokeStyle = rgba(alpha * 0.95);
        ctx.lineWidth = 3 * z;
        ctx.stroke();
        break;
      }
      case 'line': {
        const w = (fx.width || 1.2) * (1 - progress * 0.5);
        const dx = fx.x - fx.startX, dy = fx.y - fx.startY;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len * w, ny = dx / len * w;
        const reach = Math.min(1, progress * 3);
        const ex = fx.startX + dx * reach, ey = fx.startY + dy * reach;
        const pts = [[fx.startX + nx, fx.startY + ny], [ex + nx, ey + ny], [ex - nx, ey - ny], [fx.startX - nx, fx.startY - ny]].map(([x, y]) => toScreen(x, y, 0));
        ctx.beginPath();
        pts.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
        ctx.closePath();
        ctx.fillStyle = rgba(alpha * 0.35);
        ctx.fill();
        bolt({ x: fx.startX, y: fx.startY }, { x: ex, y: ey }, 6, 0.9);
        break;
      }
      case 'strike':
      case 'volley':
      case 'chain': {
        const from = { x: fx.startX, y: fx.startY };
        const targets = fx.points || [{ x: fx.x, y: fx.y }];
        let prev = from;
        for (const pt of targets) {
          bolt(fx.shape === 'chain' ? prev : from, pt, fx.shape === 'strike' ? 7 : 4, 0.85);
          ring(pt.x, pt.y, 0.9 * easeOut, alpha * 0.3, alpha * 0.9, 2.5);
          prev = pt;
        }
        break;
      }
      case 'dash': {
        bolt({ x: fx.startX, y: fx.startY }, { x: fx.x, y: fx.y }, 12 * (1 - progress * 0.6), 0.7);
        break;
      }
      case 'blink': {
        ring(fx.startX, fx.startY, (fx.origin ? fx.radius || 1 : 0.9) * easeOut, alpha * 0.25, alpha * 0.9, 3);
        ring(fx.x, fx.y, (fx.landing ? fx.radius || 1 : 0.9) * easeOut, alpha * 0.25, alpha * 0.9, 3);
        ctx.setLineDash([6 * z, 8 * z]);
        const a = toScreen(fx.startX, fx.startY, 0.5), b = toScreen(fx.x, fx.y, 0.5);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = rgba(alpha * 0.6);
        ctx.lineWidth = 2 * z;
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case 'rewind': {
        for (const [wx, wy, dir] of [[fx.startX, fx.startY, 1], [fx.x, fx.y, -1]]) {
          ring(wx, wy, 1.1 * easeOut, alpha * 0.15, alpha * 0.9, 3);
          const c0 = toScreen(wx, wy, 0.6);
          const hand = -dir * this.animations.time * 9;
          ctx.beginPath();
          ctx.moveTo(c0.x, c0.y);
          ctx.lineTo(c0.x + Math.cos(hand) * 16 * z, c0.y + Math.sin(hand) * 8 * z);
          ctx.strokeStyle = `rgba(255, 251, 235, ${alpha})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();
        }
        ctx.setLineDash([4 * z, 6 * z]);
        ctx.lineDashOffset = this.animations.time * 40 * z;
        const a = toScreen(fx.startX, fx.startY, 0.5), b = toScreen(fx.x, fx.y, 0.5);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = rgba(alpha * 0.8);
        ctx.lineWidth = 2.5 * z;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
        break;
      }
      case 'buff': {
        if (fx.radius > 1.5) ring(fx.x, fx.y, fx.radius * easeOut, alpha * 0.18, alpha * 0.8, 3);
        // rising pillar of light over the hero
        const base = toScreen(fx.x, fx.y, 0), top = toScreen(fx.x, fx.y, 3.2);
        const grad = ctx.createLinearGradient(base.x, base.y, top.x, top.y);
        grad.addColorStop(0, rgba(alpha * 0.55));
        grad.addColorStop(1, rgba(0));
        ctx.fillStyle = grad;
        const w = 22 * z * (0.6 + 0.4 * easeOut);
        ctx.fillRect(base.x - w / 2, top.y, w, base.y - top.y);
        ring(fx.x, fx.y, 1.1 + 0.4 * Math.sin(progress * Math.PI), 0, alpha * 0.9, 3);
        break;
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- Dread Lord (Colossal Black-Violet Executioner Axe)
  drawDreadLordSkill(ctx, fx, progress, toScreen, z) {
    const P = SP_FX_PALETTES.sp_dread_lord;
    const ease = 1 - Math.pow(1 - progress, 3);
    const fade = progress < 0.2 ? progress / 0.2 : Math.pow(1 - (progress - 0.2) / 0.8, 1.35);
    const a = (v) => Math.max(0, Math.min(1, v));
    const col = (rgb, al) => `rgba(${rgb}, ${a(al)})`;
    const seed = ((fx.x || 0) * 19.7 + (fx.y || 0) * 31.3 + (fx.wave || 0) * 7.1) % 100;
    const rnd = (i) => { const s = Math.sin(seed + i * 97.13) * 43758.5453; return s - Math.floor(s); };
    const over = (fn) => { ctx.save(); ctx.globalCompositeOperation = 'source-over'; fn(); ctx.restore(); };
    const glow = (pt, r, al = 1, tint = P.main) => {
      if (r <= 0.5 || al <= 0.01) return;
      const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
      g.addColorStop(0, col(P.core, al));
      g.addColorStop(0.28, col(P.light, al * 0.85));
      g.addColorStop(0.62, col(tint, al * 0.5));
      g.addColorStop(1, col(P.main, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill();
    };
    const isoPoly = (wx, wy, r, n = 28, h = 0) => {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const p = toScreen(wx + Math.cos(ang) * r, wy + Math.sin(ang) * r, h);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
    };
    const darkPool = (wx, wy, r, al) => {
      if (r <= 0.05 || al <= 0.01) return;
      over(() => {
        isoPoly(wx, wy, r);
        ctx.fillStyle = col(P.deep, al * 0.78);
        ctx.fill();
        ctx.strokeStyle = col(P.accent, al * 0.9);
        ctx.lineWidth = 2.4 * z;
        ctx.stroke();
      });
    };
    // Draws the colossal black-violet bearded executioner axe in screen space
    const greatAxe = (sx, sy, rot, scale, al = 1) => {
      if (al <= 0.02) return;
      const s = scale * z;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(rot);
      ctx.globalCompositeOperation = 'source-over';
      // Heavy dark-iron haft + pommel spike
      ctx.strokeStyle = col('24, 18, 34', al * 0.95);
      ctx.lineWidth = 4.5 * s;
      ctx.beginPath(); ctx.moveTo(-26 * s, 0); ctx.lineTo(18 * s, 0); ctx.stroke();
      ctx.strokeStyle = col(P.accent, al * 0.75);
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath(); ctx.moveTo(-22 * s, 0); ctx.lineTo(14 * s, 0); ctx.stroke();
      // Colossal bearded executioner blade (top + hooked lower beard)
      ctx.beginPath();
      ctx.moveTo(2 * s, -3 * s);
      ctx.lineTo(18 * s, -22 * s);
      ctx.quadraticCurveTo(28 * s, -4 * s, 14 * s, 26 * s);
      ctx.lineTo(-4 * s, 14 * s);
      ctx.quadraticCurveTo(4 * s, 6 * s, 2 * s, -3 * s);
      ctx.closePath();
      ctx.fillStyle = col(P.deep, al * 0.95);
      ctx.fill();
      ctx.strokeStyle = col(P.accent, al * 0.95);
      ctx.lineWidth = 2.4 * s;
      ctx.stroke();
      // Rear jagged executioner fluke
      ctx.beginPath();
      ctx.moveTo(2 * s, -3 * s);
      ctx.lineTo(8 * s, -15 * s);
      ctx.lineTo(15 * s, -8 * s);
      ctx.closePath();
      ctx.fillStyle = col(P.deep2, al * 0.92);
      ctx.fill();
      ctx.strokeStyle = col(P.light, al * 0.85);
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();
      // Glowing violet-white razor edge bevel + abyssal eye core
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.moveTo(18 * s, -22 * s);
      ctx.quadraticCurveTo(28 * s, -4 * s, 14 * s, 26 * s);
      ctx.lineTo(-4 * s, 14 * s);
      ctx.strokeStyle = col(P.core, al);
      ctx.lineWidth = 2.8 * s;
      ctx.stroke();
      glow({ x: 9 * s, y: 2 * s }, 10 * s, al * 0.9, P.accent);
      ctx.restore();
    };
    const voidBolt = (p0, p1, al, w = 2.5, seedOff = 0) => {
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const nx = -dy, ny = dx, len = Math.hypot(dx, dy) || 1;
      const pts = [p0];
      for (let i = 1; i < 6; i++) {
        const t = i / 6;
        const j = (rnd(i + seedOff) - 0.5) * 18 * z * Math.sin(t * Math.PI);
        pts.push({ x: p0.x + dx * t + (nx / len) * j, y: p0.y + dy * t + (ny / len) * j });
      }
      pts.push(p1);
      ctx.beginPath();
      pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.strokeStyle = col(P.accent, al * 0.85); ctx.lineWidth = (w + 3) * z; ctx.stroke();
      ctx.strokeStyle = col(P.core, al); ctx.lineWidth = w * z; ctx.stroke();
    };

    switch (fx.skillId) {
      case 'sp_abyss_cleave': {
        // ABYSSAL GUILLOTINE: Colossal overhead executioner axe slam tearing a black-violet void fissure
        const sx = fx.startX ?? fx.x, sy = fx.startY ?? fx.y;
        const reach = Math.min(1, progress * 2.4);
        const ex = sx + (fx.x - sx) * reach, ey = sy + (fx.y - sy) * reach;
        const dx = fx.x - sx, dy = fx.y - sy, len = Math.hypot(dx, dy) || 1;
        const px = -dy / len, py = dx / len;
        const w = (fx.width || 2.2) * 0.42;
        // Obsidian void trench torn open by the axe
        over(() => {
          ctx.beginPath();
          for (let i = 0; i <= 10; i++) {
            const t = i / 10, side = (i % 2 === 0 ? 1 : -1) * w * (0.4 + 0.6 * Math.sin(t * Math.PI));
            const p = toScreen(sx + (ex - sx) * t + px * side, sy + (ey - sy) * t + py * side, 0);
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          }
          for (let i = 10; i >= 0; i--) {
            const t = i / 10, side = (i % 2 === 0 ? -1 : 1) * w * (0.35 + 0.55 * Math.sin(t * Math.PI));
            const p = toScreen(sx + (ex - sx) * t + px * side, sy + (ey - sy) * t + py * side, 0);
            ctx.lineTo(p.x, p.y);
          }
          ctx.closePath();
          ctx.fillStyle = col(P.deep, fade * 0.9); ctx.fill();
          ctx.strokeStyle = col(P.accent, fade * 0.95); ctx.lineWidth = 2.8 * z; ctx.stroke();
        });
        const p0 = toScreen(sx, sy, 0.2), p1 = toScreen(ex, ey, 0.2);
        voidBolt(p0, p1, fade, 3.2, 1);
        voidBolt(p0, p1, fade * 0.75, 1.8, 9);
        // Erupting void pillars along the fissure
        for (let i = 1; i <= 5; i++) {
          const t = i / 5;
          if (reach < t * 0.85) continue;
          const wx = sx + (fx.x - sx) * t, wy = sy + (fx.y - sy) * t;
          const b = toScreen(wx, wy, 0), top = toScreen(wx, wy, 2.2 * Math.sin(Math.min(1, (reach - t * 0.7) * 3) * Math.PI));
          ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(top.x, top.y);
          ctx.strokeStyle = col(P.main, fade * 0.75); ctx.lineWidth = 10 * z; ctx.stroke();
          ctx.strokeStyle = col(P.core, fade * 0.95); ctx.lineWidth = 3 * z; ctx.stroke();
          glow(b, 18 * z, fade * 0.85, P.accent);
        }
        // Giant phantom executioner axe slamming into the tip of the fissure
        const slamT = Math.min(1, progress * 2.2);
        const axePos = toScreen(ex, ey, (1 - slamT) * 3.2 + 0.3);
        const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x) + (-1.3 + slamT * 1.65);
        greatAxe(axePos.x, axePos.y, ang, 1.55, fade);
        return true;
      }

      case 'sp_void_grasp': {
        // MOCKING DREAD ROAR: Tryndamere-style terrifying warcry + abyssal chains dragging foes inward
        const R = fx.radius || 5.5;
        const c = toScreen(fx.x, fx.y, 0.3);
        darkPool(fx.x, fx.y, R * (1 - 0.55 * ease), fade * 0.85);
        // Contracting jagged roar shockwaves
        for (let k = 0; k < 3; k++) {
          const rk = R * Math.max(0.12, 1 - ((progress * 1.2 + k * 0.28) % 1) * 0.85);
          isoPoly(fx.x, fx.y, rk, 28, 0.15);
          ctx.strokeStyle = col(k === 0 ? P.core : P.accent, fade * (0.85 - k * 0.2));
          ctx.lineWidth = (3.5 - k * 0.8) * z;
          ctx.stroke();
        }
        // 8 spiked black-violet chains yanking inward toward the Dread Lord
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2 + seed;
          const pullR = R * (1 - 0.78 * ease);
          const wx = fx.x + Math.cos(ang) * pullR, wy = fx.y + Math.sin(ang) * pullR;
          const tip = toScreen(wx, wy, 0.25);
          over(() => {
            ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(tip.x, tip.y);
            ctx.strokeStyle = col(P.deep, fade * 0.9); ctx.lineWidth = 5 * z; ctx.stroke();
          });
          ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(tip.x, tip.y);
          ctx.setLineDash([6 * z, 4 * z]);
          ctx.strokeStyle = col(P.light, fade * 0.9); ctx.lineWidth = 2.4 * z; ctx.stroke();
          ctx.setLineDash([]);
          glow(tip, 11 * z, fade * 0.85, P.accent);
        }
        // Towering abyssal skull/helm warcry silhouette above the Dread Lord
        const head = toScreen(fx.x, fx.y, 1.8 + ease * 0.7);
        glow(head, 32 * z, fade * 0.85, P.main);
        over(() => {
          const s = (1.0 + 0.35 * ease) * z;
          ctx.beginPath();
          ctx.moveTo(head.x - 16 * s, head.y - 6 * s);
          ctx.lineTo(head.x - 26 * s, head.y - 24 * s);
          ctx.lineTo(head.x - 8 * s, head.y - 14 * s);
          ctx.lineTo(head.x + 8 * s, head.y - 14 * s);
          ctx.lineTo(head.x + 26 * s, head.y - 24 * s);
          ctx.lineTo(head.x + 16 * s, head.y - 6 * s);
          ctx.lineTo(head.x + 12 * s, head.y + 12 * s);
          ctx.lineTo(head.x - 12 * s, head.y + 12 * s);
          ctx.closePath();
          ctx.fillStyle = col(P.deep, fade * 0.88); ctx.fill();
          ctx.strokeStyle = col(P.accent, fade * 0.95); ctx.lineWidth = 2.2 * z; ctx.stroke();
        });
        glow({ x: head.x - 6 * z, y: head.y - 2 * z }, 7 * z, fade, P.core);
        glow({ x: head.x + 6 * z, y: head.y - 2 * z }, 7 * z, fade, P.core);
        return true;
      }

      case 'sp_soul_bastion': {
        // UNDYING DREAD RAGE: Tryndamere Undying Rage crimson-violet volcano pillar & orbiting executioner axes
        const R = (fx.radius || 3.8) * (0.45 + 0.55 * ease);
        const c = toScreen(fx.x, fx.y, 0);
        const top = toScreen(fx.x, fx.y, 3.6);
        darkPool(fx.x, fx.y, R, fade * 0.9);
        // Erupting Undying Rage pillar
        const g = ctx.createLinearGradient(c.x, c.y, top.x, top.y);
        g.addColorStop(0, col(P.core, fade * 0.85));
        g.addColorStop(0.35, col(P.accent, fade * 0.65));
        g.addColorStop(0.7, col('225, 29, 72', fade * 0.4));
        g.addColorStop(1, col(P.main, 0));
        ctx.fillStyle = g;
        const pw = 38 * z * (0.7 + 0.3 * Math.sin(progress * Math.PI));
        ctx.fillRect(c.x - pw / 2, top.y, pw, c.y - top.y);
        // Shockwave rings
        isoPoly(fx.x, fx.y, R, 32, 0.1);
        ctx.strokeStyle = col(P.core, fade * 0.95); ctx.lineWidth = 3.5 * z; ctx.stroke();
        isoPoly(fx.x, fx.y, R * 0.68, 28, 0.25);
        ctx.strokeStyle = col('244, 63, 94', fade * 0.8); ctx.lineWidth = 2.5 * z; ctx.stroke();
        // 3 phantom executioner axes orbiting the Undying Dread Lord
        const spin = this.animations.time * 7 + (fx.wave || 0) * 1.4;
        for (let i = 0; i < 3; i++) {
          const ang = spin + (i * Math.PI * 2) / 3;
          const ax = fx.x + Math.cos(ang) * R * 0.78, ay = fx.y + Math.sin(ang) * R * 0.78;
          const p = toScreen(ax, ay, 0.75 + 0.2 * Math.sin(ang * 2));
          greatAxe(p.x, p.y, ang + Math.PI * 0.5, 1.05, fade * 0.95);
        }
        glow(c, 34 * z, fade * 0.85, P.accent);
        return true;
      }

      case 'sp_shadow_charge': {
        // SPINNING VOID SLASH: Tryndamere Spinning Slash cyclone rushing along the dash path
        const sx = fx.startX ?? fx.x, sy = fx.startY ?? fx.y;
        const w = (fx.width || 2.2) * 0.5;
        const dx = fx.x - sx, dy = fx.y - sy, len = Math.hypot(dx, dy) || 1;
        const px = -dy / len, py = dx / len;
        // Dark torn earth track along the spin path
        over(() => {
          const a0 = toScreen(sx + px * w, sy + py * w, 0), a1 = toScreen(fx.x + px * w, fx.y + py * w, 0);
          const b1 = toScreen(fx.x - px * w, fx.y - py * w, 0), b0 = toScreen(sx - px * w, sy - py * w, 0);
          ctx.beginPath();
          ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.lineTo(b1.x, b1.y); ctx.lineTo(b0.x, b0.y);
          ctx.closePath();
          ctx.fillStyle = col(P.deep, fade * 0.75); ctx.fill();
        });
        // 4 overlapping cyclone slash rings along the path + spinning giant axe at the head
        for (let i = 0; i < 4; i++) {
          const t = Math.min(1, (i / 3) * Math.min(1, progress * 1.8));
          const wx = sx + dx * t, wy = sy + dy * t;
          const r = (fx.width || 2.2) * (0.55 + 0.35 * (i / 3));
          isoPoly(wx, wy, r, 24, 0.35);
          ctx.strokeStyle = col(i === 3 ? P.core : P.accent, fade * (0.45 + 0.18 * i));
          ctx.lineWidth = (2.2 + i * 0.8) * z;
          ctx.stroke();
        }
        const headT = Math.min(1, progress * 1.6);
        const hx = sx + dx * headT, hy = sy + dy * headT;
        const hc = toScreen(hx, hy, 0.55);
        const spinAng = progress * Math.PI * 6;
        greatAxe(hc.x, hc.y, spinAng, 1.45, fade);
        greatAxe(hc.x, hc.y, spinAng + Math.PI, 1.15, fade * 0.7);
        glow(hc, 28 * z, fade * 0.9, P.accent);
        return true;
      }

      case 'sp_soul_rend': {
        // EXECUTIONER'S BEHEADING: Massive X-guillotine cleave + downward executioner axe chop on target
        const c = toScreen(fx.x, fx.y, 0.5);
        const gnd = toScreen(fx.x, fx.y, 0);
        darkPool(fx.x, fx.y, 1.5 * ease, fade * 0.9);
        // Giant X-guillotine slash across the target
        const slashLen = 46 * z * (0.65 + 0.35 * ease);
        for (const ang of [-0.68, 0.68]) {
          const dx = Math.cos(ang) * slashLen, dy = Math.sin(ang) * slashLen * 0.75;
          over(() => {
            ctx.beginPath(); ctx.moveTo(c.x - dx, c.y - dy); ctx.lineTo(c.x + dx, c.y + dy);
            ctx.strokeStyle = col(P.deep, fade * 0.9); ctx.lineWidth = 11 * z; ctx.stroke();
          });
          ctx.beginPath(); ctx.moveTo(c.x - dx, c.y - dy); ctx.lineTo(c.x + dx, c.y + dy);
          ctx.strokeStyle = col(P.accent, fade * 0.95); ctx.lineWidth = 6 * z; ctx.stroke();
          ctx.strokeStyle = col(P.core, fade); ctx.lineWidth = 2.4 * z; ctx.stroke();
        }
        // Colossal executioner axe guillotine dropping from above onto the target
        const drop = Math.min(1, progress * 2.5);
        const axePt = toScreen(fx.x, fx.y, (1 - drop) * 3.4 + 0.4);
        greatAxe(axePt.x, axePt.y, -0.9 + drop * 1.45, 1.65, fade);
        // Soul siphon tether back to caster if startX/Y present
        if (fx.startX !== undefined && fx.startY !== undefined) {
          const caster = toScreen(fx.startX, fx.startY, 0.6);
          voidBolt(gnd, caster, fade * 0.85, 2.2, 5);
        }
        glow(c, 32 * z, fade, P.accent);
        return true;
      }

      case 'sp_dread_wave': {
        // CATACLYSMIC AXE DRAG: 140-deg upward axe rip hurling a crescent wave of obsidian spikes
        const R = (fx.radius || 5.2) * (0.3 + 0.7 * ease);
        const arc = ((fx.arc || 140) * Math.PI) / 180;
        const base = Math.atan2(fx.dirY || 0, fx.dirX || 1);
        const origin = toScreen(fx.x, fx.y, 0.15);
        // Dark torn earth fan
        over(() => {
          ctx.beginPath();
          ctx.moveTo(origin.x, origin.y);
          for (let i = 0; i <= 18; i++) {
            const a0 = base - arc / 2 + (i / 18) * arc;
            const p = toScreen(fx.x + Math.cos(a0) * R, fx.y + Math.sin(a0) * R, 0);
            ctx.lineTo(p.x, p.y);
          }
          ctx.closePath();
          ctx.fillStyle = col(P.deep, fade * 0.78); ctx.fill();
        });
        // Heavy crescent wave arcs
        for (const mult of [1, 0.72]) {
          ctx.beginPath();
          for (let i = 0; i <= 20; i++) {
            const a0 = base - arc / 2 + (i / 20) * arc;
            const p = toScreen(fx.x + Math.cos(a0) * R * mult, fx.y + Math.sin(a0) * R * mult, 0.25);
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          }
          ctx.strokeStyle = col(mult === 1 ? P.core : P.accent, fade * (mult === 1 ? 0.95 : 0.75));
          ctx.lineWidth = (mult === 1 ? 4.5 : 2.8) * z;
          ctx.stroke();
        }
        // Erupting obsidian spikes along the outer arc
        for (let i = 0; i < 7; i++) {
          const a0 = base - arc * 0.45 + (i / 6) * arc * 0.9;
          const wx = fx.x + Math.cos(a0) * R * 0.92, wy = fx.y + Math.sin(a0) * R * 0.92;
          const b = toScreen(wx, wy, 0), top = toScreen(wx, wy, 1.5 * Math.sin(ease * Math.PI));
          over(() => {
            ctx.beginPath();
            ctx.moveTo(b.x - 5 * z, b.y);
            ctx.lineTo(top.x, top.y);
            ctx.lineTo(b.x + 5 * z, b.y);
            ctx.closePath();
            ctx.fillStyle = col(P.deep, fade * 0.92); ctx.fill();
            ctx.strokeStyle = col(P.accent, fade * 0.95); ctx.lineWidth = 1.8 * z; ctx.stroke();
          });
          glow(top, 9 * z, fade * 0.8, P.accent);
        }
        // Sweeping giant axe along the crescent wave
        const sweepA = base - arc / 2 + ease * arc;
        const axeTip = toScreen(fx.x + Math.cos(sweepA) * R * 0.85, fx.y + Math.sin(sweepA) * R * 0.85, 0.45);
        greatAxe(axeTip.x, axeTip.y, sweepA, 1.4, fade);
        return true;
      }

      case 'sp_grave_rain': {
        // GUILLOTINE SKYFALL: Colossal black-violet executioner axes raining from the heavens
        if (fx.areaR && (fx.wave || 0) === 0) {
          isoPoly(fx.areaX, fx.areaY, fx.areaR, 32, 0.05);
          ctx.strokeStyle = col(P.accent, fade * 0.45); ctx.lineWidth = 2 * z; ctx.stroke();
        }
        const fall = Math.min(1, progress * 2.1);
        const h = (1 - fall) * 5.2;
        const pos = toScreen(fx.x, fx.y, h);
        const gnd = toScreen(fx.x, fx.y, 0);
        // Vertical void skyfall beam
        ctx.beginPath(); ctx.moveTo(pos.x, pos.y - 36 * z); ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = col(P.accent, fade * 0.75); ctx.lineWidth = 8 * z; ctx.stroke();
        ctx.strokeStyle = col(P.core, fade); ctx.lineWidth = 2.5 * z; ctx.stroke();
        // Falling colossal executioner axe embedded into the ground on impact
        greatAxe(pos.x, pos.y, Math.PI * 0.45 + (1 - fall) * 2.2, 1.4, fade);
        if (fall >= 0.85) {
          const imp = Math.min(1, (progress - 0.35) / 0.65);
          const hitR = (fx.radius || 1.6) * (0.4 + 0.6 * imp);
          darkPool(fx.x, fx.y, hitR, fade * 0.85);
          isoPoly(fx.x, fx.y, hitR, 24, 0.1);
          ctx.strokeStyle = col(P.core, fade * 0.95); ctx.lineWidth = 3 * z; ctx.stroke();
          glow(gnd, 24 * z, fade * 0.9, P.accent);
        }
        return true;
      }

      case 'sp_void_step': {
        // OBLIVION LEAP SLAM: Leap through an abyssal tear and slam the giant axe down at destination
        const sx = fx.startX ?? fx.x, sy = fx.startY ?? fx.y;
        const R = fx.radius || 2.8;
        const p0 = toScreen(sx, sy, 0.2), p1 = toScreen(fx.x, fx.y, 0.2);
        // Departure void tear
        darkPool(sx, sy, R * 0.65 * ease, fade * 0.75);
        // Parabolic leap arc with spinning executioner axe mid-flight
        const arcMid = toScreen((sx + fx.x) / 2, (sy + fx.y) / 2, 2.8);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(arcMid.x, arcMid.y, p1.x, p1.y);
        ctx.strokeStyle = col(P.accent, fade * 0.85); ctx.lineWidth = 5 * z; ctx.stroke();
        ctx.strokeStyle = col(P.core, fade); ctx.lineWidth = 2 * z; ctx.stroke();
        // Destination crater + embedded giant executioner axe slam
        const slamR = R * (0.35 + 0.65 * ease);
        darkPool(fx.x, fx.y, slamR, fade * 0.9);
        isoPoly(fx.x, fx.y, slamR, 28, 0.1);
        ctx.strokeStyle = col(P.core, fade * 0.95); ctx.lineWidth = 3.5 * z; ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + seed;
          const edge = toScreen(fx.x + Math.cos(ang) * slamR, fx.y + Math.sin(ang) * slamR, 0.1);
          voidBolt(p1, edge, fade * 0.8, 1.8, i * 3);
        }
        const slamDrop = Math.min(1, progress * 2.2);
        const axeAt = toScreen(fx.x, fx.y, (1 - slamDrop) * 2.6 + 0.35);
        greatAxe(axeAt.x, axeAt.y, 0.55, 1.55, fade);
        glow(p1, 30 * z, fade * 0.95, P.accent);
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- basic sweep slash
  // Where the sweep's leading edge is: local angle (radians, in the slash's
  // frame) and how far through the motion it is
  sweepHead(fx, progress) {
    const half = fx.finisher ? SWEEP_HALF_ARC_FINISHER : SWEEP_HALF_ARC;
    const u = Math.min(1, progress / 0.55);
    const eased = 1 - Math.pow(1 - u, 3);
    return { half, angle: (fx.side || 1) * (-half + 2 * half * eased), eased };
  }

  // A blade arc drawn flat on the ground plane (iso), sweeping from one side to
  // the other (fx.side picks which), with a tapering trail behind its edge
  drawSweepSlash(ctx, fx, progress) {
    const screen = Isometric.worldToScreen(fx.x, fx.y, 0.35, this.camera, this.canvas.width, this.canvas.height);
    if (isNaN(screen.x) || isNaN(screen.y)) return;
    const z = this.camera.zoom;
    const FACING = { E: 0, SE: 0.25, S: 0.5, SW: 0.75, W: 1, NW: -0.75, N: -0.5, NE: -0.25 };
    const base = (FACING[fx.facing] !== undefined ? FACING[fx.facing] : 0.25) * Math.PI;
    const side = fx.side || 1;
    const { half, angle: head, eased } = this.sweepHead(fx, progress);
    const fade = progress < 0.55 ? 1 : Math.max(0, 1 - (progress - 0.55) / 0.45);
    const outerR = (fx.radius || 2.2) * 22 * z * (0.88 + 0.12 * eased);
    const thick = outerR * (fx.finisher ? 0.52 : 0.42);

    const SWEEP_THEMES = {
      // Warrior SP Cards
      sp_crusader: { body: [245, 158, 11], edge: [255, 255, 255], glow: [253, 224, 71], inner: [254, 240, 138] }, // Golden Holy Sun
      sp_berserker: { body: [220, 38, 38], edge: [254, 202, 202], glow: [239, 68, 68], inner: [249, 115, 22] }, // Crimson Magma Bleed
      sp_frost_templar: { body: [14, 165, 233], edge: [240, 249, 255], glow: [103, 232, 249], inner: [186, 230, 253] }, // Glacial Steel
      sp_storm_herald: { body: [234, 179, 8], edge: [254, 252, 232], glow: [250, 204, 21], inner: [253, 224, 71] }, // Electric Thunder
      sp_dread_lord: { body: [107, 33, 168], edge: [245, 208, 254], glow: [168, 85, 247], inner: [192, 132, 252] }, // Abyssal Void Violet

      // Rogue SP Cards
      sp_nightblade: { body: [76, 29, 149], edge: [233, 213, 255], glow: [147, 51, 234], inner: [168, 85, 247] }, // Dark Umbral Shroud
      sp_venom_lord: { body: [22, 163, 74], edge: [240, 253, 244], glow: [74, 222, 128], inner: [134, 239, 172] }, // Virulent Acid Green
      sp_blade_dancer: { body: [234, 179, 8], edge: [255, 255, 255], glow: [253, 224, 71], inner: [250, 204, 21] }, // Blinding Plasma Flash
      sp_frost_shade: { body: [6, 182, 212], edge: [240, 253, 250], glow: [103, 232, 249], inner: [165, 243, 252] }, // Frost Phantom Shard
      sp_eclipse_reaper: { body: [190, 18, 60], edge: [255, 228, 230], glow: [244, 63, 94], inner: [251, 113, 133] }, // Crimson Eclipse Scythe

      // Mage SP Cards
      sp_pyromancer: { body: [234, 88, 12], edge: [255, 237, 213], glow: [249, 115, 22], inner: [251, 146, 60] },
      sp_cryo_sage: { body: [8, 145, 178], edge: [236, 254, 255], glow: [103, 232, 249], inner: [165, 243, 252] },
      sp_tempest: { body: [202, 138, 4], edge: [254, 252, 232], glow: [250, 204, 21], inner: [253, 224, 71] },
      sp_chronomancer: { body: [217, 119, 6], edge: [254, 249, 195], glow: [253, 224, 71], inner: [254, 240, 138] },
      sp_void_archon: { body: [109, 40, 217], edge: [245, 208, 254], glow: [192, 132, 252], inner: [216, 180, 254] }
    };

    let col;
    if (fx.cardId && SWEEP_THEMES[fx.cardId]) {
      col = SWEEP_THEMES[fx.cardId];
    } else if (fx.class === 'rogue') {
      col = fx.finisher
        ? { body: [219, 39, 119], edge: [253, 242, 248], glow: [244, 114, 182], inner: [244, 63, 94] }
        : { body: [168, 85, 247], edge: [240, 253, 244], glow: [74, 222, 128], inner: [192, 132, 252] };
    } else if (fx.class === 'mage') {
      col = { body: [249, 115, 22], edge: [254, 240, 138], glow: [253, 224, 71], inner: [255, 255, 255] };
    } else {
      col = fx.finisher
        ? { body: [251, 191, 36], edge: [255, 251, 235], glow: [253, 224, 71], inner: [254, 240, 138] }
        : { body: [56, 189, 248], edge: [255, 255, 255], glow: [186, 230, 253], inner: [125, 211, 252] };
    }
    const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${Math.max(0, Math.min(1, a))})`;

    // trail runs from the start of the swing (or a fixed length behind) to the head
    const startA = -side * half;
    const trailLen = 2 * half * (fx.finisher ? 0.95 : 0.8);
    const fromA = side > 0 ? Math.max(startA, head - trailLen) : Math.min(startA, head + trailLen);
    const span = Math.abs(head - fromA);
    if (span < 0.01) return;

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.scale(1, 0.55);          // lay the arc on the ground plane
    ctx.rotate(base);
    ctx.globalCompositeOperation = 'lighter';

    // ribbon: segments get thicker and brighter toward the head
    const N = 18;
    for (let i = 0; i < N; i++) {
      const k0 = i / N, k1 = (i + 1) / N;
      const a0 = fromA + (head - fromA) * k0, a1 = fromA + (head - fromA) * k1;
      const w = thick * (0.15 + 0.85 * k1);
      ctx.beginPath();
      ctx.arc(0, 0, outerR, a0, a1, side < 0);
      ctx.arc(0, 0, outerR - w, a1, a0, side > 0);
      ctx.closePath();
      ctx.fillStyle = rgba(col.body, fade * (0.08 + 0.6 * k1 * k1));
      ctx.fill();
    }
    // soft outer glow and the razor edge
    ctx.beginPath();
    ctx.arc(0, 0, outerR + 3 * z, fromA + (head - fromA) * 0.35, head, side < 0);
    ctx.strokeStyle = rgba(col.glow, fade * 0.4);
    ctx.lineWidth = 7 * z;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, outerR, fromA + (head - fromA) * 0.2, head, side < 0);
    ctx.strokeStyle = rgba(col.edge, fade * 0.95);
    ctx.lineWidth = (fx.finisher ? 3.5 : 2.5) * z;
    ctx.stroke();

    // inner secondary energy speed line
    ctx.beginPath();
    ctx.arc(0, 0, outerR - thick * 0.55, fromA + (head - fromA) * 0.45, head, side < 0);
    ctx.strokeStyle = rgba(col.inner || col.glow, fade * 0.65);
    ctx.lineWidth = (fx.cardId ? 2.5 : 1.5) * z;
    ctx.stroke();

    // bright tip at the leading edge while it is still moving
    if (eased < 1) {
      const hx = Math.cos(head) * (outerR - thick * 0.25), hy = Math.sin(head) * (outerR - thick * 0.25);
      const tip = ctx.createRadialGradient(hx, hy, 0, hx, hy, 14 * z);
      tip.addColorStop(0, rgba(col.edge, fade));
      tip.addColorStop(0.5, rgba(col.inner || col.glow, fade * 0.7));
      tip.addColorStop(1, rgba(col.glow, 0));
      ctx.fillStyle = tip;
      ctx.beginPath();
      ctx.arc(hx, hy, 14 * z, 0, Math.PI * 2);
      ctx.fill();
    }
    // finisher: a shock ring at the end of the swing
    if (fx.finisher && progress > 0.4) {
      const r = outerR * (1 + (progress - 0.4) * 0.9);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(col.glow, (1 - progress) * 0.75);
      ctx.lineWidth = 3.5 * z;
      ctx.stroke();
    }
    if (fx.cardId) this.drawSweepAccent(ctx, fx, { outerR, thick, head, fromA, fade, eased, z });
    ctx.restore();
  }

  // World offset of a point on the sweep arc (for sparks thrown off the edge)
  sweepPointWorld(fx, angle, radiusPx) {
    const FACING = { E: 0, SE: 0.25, S: 0.5, SW: 0.75, W: 1, NW: -0.75, N: -0.5, NE: -0.25 };
    const a = angle + (FACING[fx.facing] !== undefined ? FACING[fx.facing] : 0.25) * Math.PI;
    // squashed-frame point -> iso pixels -> world tiles (zoom-free radius)
    const sx = Math.cos(a) * radiusPx, sy = Math.sin(a) * radiusPx * 0.55;
    return { x: fx.x + (sx / 32 + sy / 16) / 2, y: fx.y + (sy / 16 - sx / 32) / 2 };
  }

  emitSkillParticlesTick(fx, progress, alpha) {
    if (alpha <= 0.05) return;
    const fxX = fx.x !== undefined ? fx.x : (fx.startX || 0);
    const fxY = fx.y !== undefined ? fx.y : (fx.startY || 0);

    if (fx.type === 'sweeping_edge') {
      const { angle, eased } = this.sweepHead(fx, progress);
      if (eased >= 1) return;
      const p = this.sweepPointWorld(fx, angle, (fx.radius || 2.2) * 22);
      const cardId = fx.cardId;
      let pType = fx.class === 'rogue' ? 'slash' : 'spark';
      if (cardId === 'sp_berserker') pType = 'fire';
      else if (cardId === 'sp_frost_templar' || cardId === 'sp_frost_shade') pType = 'ice';
      else if (cardId === 'sp_dread_lord' || cardId === 'sp_nightblade') pType = 'shadow';
      else if (cardId === 'sp_blade_dancer' || cardId === 'sp_crusader' || cardId === 'sp_storm_herald') pType = 'spark';
      this.addParticles(p.x, p.y, pType, fx.finisher ? 2 : 1, { speed: 2.4, z: 0.4, sizeScale: 0.7 });
      return;
    }

    if (fx.type === 'sp_skill') {
      const [main] = SP_ELEMENT_PARTICLES[fx.element] || SP_ELEMENT_PARTICLES.neutral;
      if (fx.shape === 'line' || fx.shape === 'dash') {
        const t = Math.random();
        this.addParticles(fx.startX + (fx.x - fx.startX) * t, fx.startY + (fx.y - fx.startY) * t, main, 1, { speed: 1.2, z: 0.2 });
      } else if (fx.shape === 'buff') {
        const a = Math.random() * Math.PI * 2;
        this.addParticles(fxX + Math.cos(a) * 0.7, fxY + Math.sin(a) * 0.7, main, 1, { speed: 0.8, z: 0.2 });
      } else if (fx.radius) {
        const a = Math.random() * Math.PI * 2, r = fx.radius * Math.sqrt(Math.random());
        this.addParticles(fxX + Math.cos(a) * r, fxY + Math.sin(a) * r, main, 1, { speed: 1.0, z: 0.1 });
      }
      return;
    }

    if (fx.type === 'whirlwind') {
      // Follow the blade heads drawn in the skill-effect pass (rot = time * 11,
      // screen angle = world angle + 45deg on the iso projection)
      const wr = (fx.radius || 3.2) * (0.55 + 0.45 * (1 - Math.pow(1 - Math.min(1, progress * 2.5), 3)));
      const rot = this.animations.time * 11;
      for (let b = 0; b < 3; b++) {
        const theta = rot + (b * Math.PI * 2) / 3 - Math.PI * 0.25;
        const px = fxX + Math.cos(theta) * wr * 0.97;
        const py = fxY + Math.sin(theta) * wr * 0.97;
        this.addParticles(px, py, 'spark', 1, { speed: 2.6, angle: theta + Math.PI * 0.5, spread: 0.35, z: 0.45, sizeScale: 0.8 });
        if (Math.random() < 0.5) this.addParticles(px, py, 'wind', 1, { speed: 2.0, angle: theta + Math.PI * 0.5, spread: 0.2, z: 0.35 });
      }
    } else if (fx.type === 'firestorm') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 3.5) * Math.sqrt(Math.random());
      const px = fxX + Math.cos(angle) * r;
      const py = fxY + Math.sin(angle) * r;
      this.addParticles(px, py, 'fire', 2, { speed: 1.2, z: 0.1 });
      if (Math.random() < 0.6) this.addParticles(px, py, 'spark', 1, { speed: 2.0 });
    } else if (fx.type === 'blade_charge') {
      const p = Math.random();
      const px = (fx.startX || fxX) * (1 - p) + fxX * p;
      const py = (fx.startY || fxY) * (1 - p) + fxY * p;
      this.addParticles(px, py, 'spark', 1, { speed: 1.5 });
    } else if (fx.type === 'earthshaker') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 3.4) * Math.random();
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'spark', 1, { speed: 2.2 });
      if (Math.random() < 0.5) this.addParticles(fxX, fxY, 'dust', 1, { speed: 0.8 });
    } else if (fx.type === 'frost_nova') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 4.0) * (0.6 + Math.random() * 0.4) * Math.min(1.0, progress * 1.5);
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'ice', 1, { speed: 1.2 });
      if (Math.random() < 0.5) this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'arcane', 1);
    } else if (fx.type === 'black_hole') {
      // Inward-spiraling matter particles!
      for (let k = 0; k < 3; k++) {
        const angle = Math.random() * Math.PI * 2;
        const r = (fx.radius || 4.8) * (0.5 + Math.random() * 0.5);
        const px = fxX + Math.cos(angle) * r;
        const py = fxY + Math.sin(angle) * r;
        this.addParticles(px, py, 'shadow', 1, { speed: 1.8, angle: angle + Math.PI * 0.85, z: 0.2 });
      }
      this.addParticles(fxX, fxY, 'arcane', 1, { speed: 0.8 });
    } else if (fx.type === 'blizzard') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 4.4) * Math.sqrt(Math.random());
      const px = fxX + Math.cos(angle) * r;
      const py = fxY + Math.sin(angle) * r;
      this.addParticles(px, py, 'ice', 2, { speed: 1.4, z: 1.8, vz: -3.5 });
      this.addParticles(px, py, 'wind', 1, { speed: 2.2 });
    } else if (fx.type === 'toxic_bomb') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 3.2) * Math.sqrt(Math.random());
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'poison', 2, { speed: 0.9, z: 0.1 });
    } else if (fx.type === 'chain_lightning') {
      if (fx.points && fx.points.length > 1) {
        const idx = Math.floor(Math.random() * (fx.points.length - 1));
        const p1 = fx.points[idx];
        const p2 = fx.points[idx + 1];
        const t = Math.random();
        const px = p1.x * (1 - t) + p2.x * t;
        const py = p1.y * (1 - t) + p2.y * t;
        this.addParticles(px, py, 'lightning', 1, { speed: 1.5 });
        this.addParticles(px, py, 'spark', 1, { speed: 2.2 });
      }
    } else if (fx.type === 'colossus_strike') {
      this.addParticles(fxX, fxY, 'spark', 2, { speed: 3.0 });
      if (Math.random() < 0.6) this.addParticles(fxX, fxY, 'earth', 1, { speed: 2.5 });
    } else if (fx.type === 'death_blossom') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 4.0) * Math.random();
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'slash', 2, { speed: 2.8 });
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'shadow', 1, { speed: 1.5 });
    } else if (fx.type === 'blood_rage') {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.8 * Math.random();
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'fire', 1, { speed: 0.8, z: 0.2 });
    } else if (fx.type === 'mana_shield') {
      const angle = this.animations.time * 6 + Math.random() * 0.4;
      const r = 1.2;
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'arcane', 1, { speed: 0.5, z: 0.4 });
    } else if (fx.type === 'iron_fortress') {
      const angle = Math.random() * Math.PI * 2;
      const r = 1.4;
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'earth', 1, { speed: 1.0 });
    } else if (fx.type === 'pyroblast') {
      this.addParticles(fxX, fxY, 'fire', 2, { speed: 2.4 });
      this.addParticles(fxX, fxY, 'spark', 1, { speed: 2.8 });
    } else if (fx.type === 'smoke_screen') {
      const angle = Math.random() * Math.PI * 2;
      const r = 2.4 * Math.random();
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'shadow', 2, { speed: 0.8 });
    } else if (fx.type === 'fan_of_knives') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 3.4) * progress;
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'poison', 1, { speed: 1.5 });
    } else if (fx.type === 'toxic_bomb') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 3.2) * Math.random();
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'poison', 2, { speed: 1.2, z: 0.1 });
      if (Math.random() < 0.3) this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'dust', 1, { speed: 0.8 });
    } else if (fx.type === 'shadow_dash') {
      const t = Math.random();
      const lx = (fx.startX || fx.x) + (fx.x - (fx.startX || fx.x)) * t;
      const ly = (fx.startY || fx.y) + (fx.y - (fx.startY || fx.y)) * t;
      this.addParticles(lx, ly, 'shadow', 2, { speed: 1.6, z: 0.2 });
      if (Math.random() < 0.4) this.addParticles(lx, ly, 'slash', 1, { speed: 2.2 });
    } else if (fx.type === 'shadowstep') {
      this.addParticles(fxX, fxY, 'shadow', 2, { speed: 2.0, z: 0.3 });
      if (Math.random() < 0.5) this.addParticles(fxX, fxY, 'slash', 1, { speed: 2.5 });
    } else if (fx.type === 'poison_darts') {
      const angle = Math.random() * Math.PI * 2;
      const r = 2.0 * progress;
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'poison', 1, { speed: 1.4 });
    } else if (fx.type === 'caltrops') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 3.2) * Math.random();
      if (Math.random() < 0.35) this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'spark', 1, { speed: 0.6 });
    } else if (fx.type === 'venomous_barrage') {
      const angle = Math.random() * Math.PI * 2;
      const r = 3.5 * progress;
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'poison', 2, { speed: 2.5 });
    } else if (fx.type === 'phantom_assassins') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 4.2) * (0.4 + 0.6 * Math.random());
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'shadow', 2, { speed: 1.2, z: 0.2 });
    } else if (fx.type === 'assassins_cull') {
      this.addParticles(fxX, fxY, 'slash', 3, { speed: 3.5 });
      this.addParticles(fxX, fxY, 'shadow', 2, { speed: 2.0 });
    } else if (fx.type === 'abyssal_tether') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 5.2) * (1 - progress);
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'shadow', 2, { speed: 1.8 });
    } else if (fx.type === 'blade_dance') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 4.8) * Math.random();
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'slash', 2, { speed: 3.0 });
    } else if (fx.type === 'eclipse_execution') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 6.0) * Math.random();
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'shadow', 3, { speed: 2.5 });
      if (Math.random() < 0.6) this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'arcane', 2, { speed: 3.0 });
    }
  }

  // High-Performance Multi-Elemental Particle Spawner with Physical Dynamics
  addParticles(worldX, worldY, type = 'slash', count = 16, customOpts = {}) {
    for (let i = 0; i < count; i++) {
      const angle = customOpts.angle !== undefined
        ? (customOpts.angle + (Math.random() - 0.5) * (customOpts.spread || Math.PI * 0.6))
        : (Math.random() * Math.PI * 2);

      const baseSpeed = customOpts.speed || (1.2 + Math.random() * 3.8);
      const speed = baseSpeed * (0.6 + Math.random() * 0.8);

      let color = '#38bdf8';
      let coreColor = '#ffffff';
      let glowColor = 'rgba(56, 189, 248, 0.5)';
      let size = 3 + Math.random() * 4;
      let life = 0.45 + Math.random() * 0.45;
      let gravity = 0;
      let buoyancy = 0;
      let drag = 0.94;
      let bounce = false;
      let turbulence = 0;
      let blend = 'lighter';
      let rot = Math.random() * Math.PI * 2;
      let vrot = (Math.random() - 0.5) * 8;
      let vz = (Math.random() * 1.2 - 0.3);
      let zDrag = 1;      // per-60fps-frame damping of vertical velocity
      let maxZ = 2.0;     // ceiling (in tiles) so nothing drifts off into the sky

      if (type === 'fire') {
        const firePalettes = [
          { c: '#ef4444', core: '#fef08a', glow: 'rgba(239, 68, 68, 0.6)' },
          { c: '#f97316', core: '#ffffff', glow: 'rgba(249, 115, 22, 0.6)' },
          { c: '#facc15', core: '#ffffff', glow: 'rgba(250, 204, 21, 0.7)' },
          { c: '#dc2626', core: '#f97316', glow: 'rgba(220, 38, 38, 0.5)' }
        ];
        const p = firePalettes[Math.floor(Math.random() * firePalettes.length)];
        color = p.c; coreColor = p.core; glowColor = p.glow;
        size = 5 + Math.random() * 6.5;
        life = 0.5 + Math.random() * 0.5;
        buoyancy = 0.5;
        zDrag = 0.9;
        maxZ = 1.1;
        drag = 0.9;
        turbulence = 1.6;
        vz = 0.4 + Math.random() * 0.7;
      } else if (type === 'slash' || type === 'spark') {
        const sparkPalettes = [
          { c: '#fef08a', core: '#ffffff', glow: 'rgba(250, 204, 21, 0.8)' },
          { c: '#38bdf8', core: '#ffffff', glow: 'rgba(56, 189, 248, 0.8)' },
          { c: '#f59e0b', core: '#fef08a', glow: 'rgba(245, 158, 11, 0.7)' },
          { c: '#ffffff', core: '#ffffff', glow: 'rgba(255, 255, 255, 0.9)' }
        ];
        const p = sparkPalettes[Math.floor(Math.random() * sparkPalettes.length)];
        color = p.c; coreColor = p.core; glowColor = p.glow;
        size = 3.0 + Math.random() * 3.8;
        life = 0.35 + Math.random() * 0.35;
        gravity = 8.0;
        drag = 0.90;
        bounce = true;
        vz = 0.8 + Math.random() * 1.6;
      } else if (type === 'arcane') {
        const arcanePalettes = [
          { c: '#c084fc', core: '#ffffff', glow: 'rgba(192, 132, 252, 0.7)' },
          { c: '#38bdf8', core: '#ffffff', glow: 'rgba(56, 189, 248, 0.7)' },
          { c: '#e879f9', core: '#ffffff', glow: 'rgba(232, 121, 249, 0.6)' },
          { c: '#818cf8', core: '#c084fc', glow: 'rgba(129, 140, 248, 0.6)' }
        ];
        const p = arcanePalettes[Math.floor(Math.random() * arcanePalettes.length)];
        color = p.c; coreColor = p.core; glowColor = p.glow;
        size = 4.5 + Math.random() * 5.2;
        life = 0.55 + Math.random() * 0.45;
        zDrag = 0.88;
        maxZ = 1.0;
        drag = 0.93;
        turbulence = 1.2;
        vz = 0.3 + Math.random() * 0.6;
        vrot = (Math.random() - 0.5) * 6;
      } else if (type === 'ice') {
        const icePalettes = [
          { c: '#67e8f9', core: '#ffffff', glow: 'rgba(103, 232, 249, 0.7)' },
          { c: '#bae6fd', core: '#ffffff', glow: 'rgba(186, 230, 253, 0.7)' },
          { c: '#0284c7', core: '#a5f3fc', glow: 'rgba(2, 132, 199, 0.6)' },
          { c: '#ffffff', core: '#bae6fd', glow: 'rgba(255, 255, 255, 0.85)' }
        ];
        const p = icePalettes[Math.floor(Math.random() * icePalettes.length)];
        color = p.c; coreColor = p.core; glowColor = p.glow;
        size = 4 + Math.random() * 5.5;
        life = 0.5 + Math.random() * 0.45;
        gravity = 7.0;
        drag = 0.92;
        bounce = true;
        vz = 0.6 + Math.random() * 1.2;
        vrot = (Math.random() - 0.5) * 12;
      } else if (type === 'lightning') {
        const boltPalettes = [
          { c: '#67e8f9', core: '#ffffff', glow: 'rgba(103, 232, 249, 0.9)' },
          { c: '#fde047', core: '#ffffff', glow: 'rgba(253, 224, 71, 0.9)' },
          { c: '#c084fc', core: '#ffffff', glow: 'rgba(192, 132, 252, 0.8)' }
        ];
        const p = boltPalettes[Math.floor(Math.random() * boltPalettes.length)];
        color = p.c; coreColor = p.core; glowColor = p.glow;
        size = 5.5 + Math.random() * 6.0;
        life = 0.25 + Math.random() * 0.22;
        drag = 0.85;
        zDrag = 0.8;
        maxZ = 0.8;
        vz = (Math.random() - 0.5) * 0.6;
      } else if (type === 'poison') {
        const poisonPalettes = [
          { c: '#22c55e', core: '#86efac', glow: 'rgba(34, 197, 94, 0.7)' },
          { c: '#4ade80', core: '#ffffff', glow: 'rgba(74, 222, 128, 0.7)' },
          { c: '#16a34a', core: '#bbf7d0', glow: 'rgba(22, 163, 74, 0.6)' }
        ];
        const p = poisonPalettes[Math.floor(Math.random() * poisonPalettes.length)];
        color = p.c; coreColor = p.core; glowColor = p.glow;
        size = 4.5 + Math.random() * 5.2;
        life = 0.5 + Math.random() * 0.45;
        buoyancy = 0.15;
        zDrag = 0.88;
        maxZ = 0.6;
        drag = 0.92;
        turbulence = 1.4;
        vz = 0.15 + Math.random() * 0.35;
      } else if (type === 'shadow') {
        const shadowPalettes = [
          { c: '#a855f7', core: '#c084fc', glow: 'rgba(168, 85, 247, 0.7)' },
          { c: '#9333ea', core: '#e9d5ff', glow: 'rgba(147, 51, 234, 0.7)' },
          { c: '#6b21a8', core: '#a855f7', glow: 'rgba(107, 33, 168, 0.6)' }
        ];
        const p = shadowPalettes[Math.floor(Math.random() * shadowPalettes.length)];
        color = p.c; coreColor = p.core; glowColor = p.glow;
        size = 5 + Math.random() * 6;
        life = 0.55 + Math.random() * 0.45;
        drag = 0.92;
        buoyancy = 0.2;
        zDrag = 0.88;
        maxZ = 0.8;
        turbulence = 1.8;
        vz = 0.2 + Math.random() * 0.5;
      } else if (type === 'earth') {
        const earthColors = ['#78350f', '#92400e', '#b45309', '#d97706', '#64748b'];
        color = earthColors[Math.floor(Math.random() * earthColors.length)];
        coreColor = '#451a03';
        glowColor = 'rgba(0, 0, 0, 0.3)';
        size = 4 + Math.random() * 6.5;
        life = 0.6 + Math.random() * 0.45;
        gravity = 12.0;
        drag = 0.9;
        bounce = true;
        blend = 'source-over';
        vz = 1.4 + Math.random() * 2.2;
        vrot = (Math.random() - 0.5) * 14;
      } else if (type === 'wind') {
        const windColors = ['#e0f2fe', '#bae6fd', '#7dd3fc', '#ffffff'];
        color = windColors[Math.floor(Math.random() * windColors.length)];
        coreColor = '#ffffff';
        glowColor = 'rgba(56, 189, 248, 0.6)';
        size = 4 + Math.random() * 5.5;
        life = 0.4 + Math.random() * 0.35;
        drag = 0.94;
        zDrag = 0.8;
        maxZ = 0.6;
        vz = 0;
      } else if (type === 'gold' || type === 'loot') {
        color = '#facc15'; coreColor = '#ffffff'; glowColor = 'rgba(250, 204, 21, 0.8)';
        size = 4 + Math.random() * 4.5;
        life = 0.6 + Math.random() * 0.4;
        gravity = 8.0;
        bounce = true;
        drag = 0.92;
        vz = 1.2 + Math.random() * 1.4;
        vrot = (Math.random() - 0.5) * 8;
      } else if (type === 'dust') {
        color = 'rgba(168, 162, 158, 0.45)'; coreColor = 'rgba(214, 211, 209, 0.5)'; glowColor = 'rgba(0, 0, 0, 0.05)';
        size = 1.8 + Math.random() * 1.8;
        life = 0.22 + Math.random() * 0.15;
        drag = 0.85;
        blend = 'source-over';
        maxZ = 0.3;
        vz = 0.1 + Math.random() * 0.2;
      } else if (type === 'level') {
        const levelColors = ['#fde047', '#38bdf8', '#c084fc', '#ffffff'];
        color = levelColors[Math.floor(Math.random() * levelColors.length)];
        coreColor = '#ffffff';
        glowColor = 'rgba(250, 204, 21, 0.9)';
        size = 5.0 + Math.random() * 5.5;
        life = 0.8 + Math.random() * 0.5;
        buoyancy = 3.5;
        drag = 0.96;
        vz = 2.5 + Math.random() * 3.5;
        vrot = (Math.random() - 0.5) * 8;
        blend = 'lighter';
      }

      if (customOpts.sizeScale) size *= customOpts.sizeScale;

      this.animations.particles.push({
        id: Math.random() * 1000,
        x: worldX,
        y: worldY,
        z: customOpts.z !== undefined ? customOpts.z + Math.random() * 0.2 : 0.05 + Math.random() * 0.25,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: customOpts.vz !== undefined ? customOpts.vz : vz,
        zDrag,
        maxZ: customOpts.z !== undefined ? Math.max(maxZ, customOpts.z + 0.3) : maxZ,
        gravity,
        buoyancy,
        drag,
        bounce,
        turbulence,
        rot,
        vrot,
        blend,
        type,
        color,
        coreColor,
        glowColor,
        size,
        life,
        maxLife: life
      });
    }
  }

  // Log each distinct drawing failure once, with what was being drawn
  reportDrawError(what, err) {
    this._drawErrors = this._drawErrors || new Set();
    const key = what + '|' + (err && err.message);
    if (this._drawErrors.has(key)) return;
    this._drawErrors.add(key);
    console.error(`[render] failed drawing ${what}:`, err);
  }

  // Undo whatever a failed draw left on the context (transform, alpha, blend, filter)
  recoverContext(ctx, transform) {
    ctx.setTransform(transform);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.setLineDash([]);
  }

  render(gameState, localPlayerId, selectedTargetId, dt) {
    this.lastGameState = gameState;
    this.animations.time += dt;
    this.updateCamera(dt);

    const ctx = this.ctx;
    // A draw call that throws mid-frame (game.js catches it and keeps looping)
    // would leave saved states and a rotated / shifted transform behind, and the
    // next frames would draw the whole world tilted. Start every frame clean.
    if (ctx.reset) ctx.reset();
    else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
    }
    const w = this.canvas.width;
    const h = this.canvas.height;

    const map = gameState && gameState.map;
    const isDungeon = map && (map.isDungeon || (map.tiles && map.tiles[0] && (map.tiles[0][0] === 8 || map.tiles[0][0] === 7)));
    this.currentTheme = map ? (map.theme || (isDungeon ? 'dungeon_crypt' : 'town')) : 'town';

    // Clear Screen with deep fantasy ambient background (tinted per floor/zone theme)
    ctx.fillStyle = (map && map.bg) || DUNGEON_THEME_BG[this.currentTheme] || '#080c14';
    ctx.fillRect(0, 0, w, h);

    if (!map) return;

    // PASS 1: VISIBLE GROUND TILES PASS (Base Terrain Layer)
    // Rendered first so flat ground diamond tiles NEVER clip or cover players or mobs walking over them
    const wallTiles = [];
    const animatedTiles = [];

    const vis = this.visibleTileBounds(map, w, h, 160);
    for (let y = vis.y0; y <= vis.y1; y++) {
      for (let x = vis.x0; x <= vis.x1; x++) {
        const tileType = map.tiles[y][x];

        // If Deep Void (8), skip completely (natural dark abyss)
        if (tileType === 8) continue;
        const animated = this.isAnimatedTile(tileType);
        if (!animated && !(isDungeon && tileType === 7)) continue;

        const iso = Isometric.worldToIso(x, y);
        const sx = (iso.x - this.camera.x) * this.camera.zoom + w / 2;
        const sy = (iso.y - this.camera.y) * this.camera.zoom + h / 2;
        if (sx < -120 || sx > w + 120 || sy < -120 || sy > h + 120) continue;

        // In dungeon, solid perimeter walls (7) are 3D walls rendered in Pass 2
        if (isDungeon && tileType === 7) { wallTiles.push({ x, y }); continue; }
        const pal = FIELD_TILE_PALETTE[tileType];
        const overlay = !!(pal && OVERLAY_TILE_DETAILS.has(pal.detail));
        // (matches drawFieldTileDetail: only every third sparkle tile has a sparkle)
        if (overlay && pal.detail === 'sparkle' && ((x * 73 + y * 151) % 97) % 3 !== 0) continue;
        animatedTiles.push({ x, y, tileType, depth: x + y, overlay });
      }
    }

    // Static ground comes from an offscreen cache; animated tiles (water,
    // ice, glowing runes...) repaint their top face over it every frame
    this.drawGroundLayer(ctx, map, isDungeon, w, h);
    animatedTiles.sort((a, b) => a.depth - b.depth);
    ctx.save();
    for (const tile of animatedTiles) {
      if (tile.overlay) {
        const screen = Isometric.worldToScreen(tile.x, tile.y, 0, this.camera, w, h);
        const z = this.camera.zoom;
        this.drawFieldTileDetail(ctx, FIELD_TILE_PALETTE[tile.tileType].detail, screen, (TILE_WIDTH / 2) * z, (TILE_HEIGHT / 2) * z, tile.x, tile.y);
      } else {
        this.drawIsometricTile(ctx, tile.x, tile.y, tile.tileType, true);
      }
    }
    ctx.restore();

    // Summoning circles lie on the floor, under everything standing on it
    if (this.mobSpawns.size) this.drawMobSpawnCircles(ctx);

    // Town ambience (cosmetic): cloud and bird shadows lie on the ground
    let townLife = null;
    if (this.currentTheme === 'town' && window.TownLife) {
      if (!this.townLife || this.townLife.map !== map) this.townLife = new window.TownLife.Ambience(map);
      townLife = this.townLife;
      townLife.drawGround(ctx, this);
    }

    // Dungeon atmosphere (cosmetic): the floor sinks into darkness except for
    // pools of torch, hazard and hero light; walls are shaded to match
    let dungeonLife = null;
    if (isDungeon && window.DungeonLife && window.DungeonLife.has(this.currentTheme)) {
      if (!this.dungeonLife || this.dungeonLife.map !== map) this.dungeonLife = new window.DungeonLife.Atmosphere(map, this.currentTheme);
      dungeonLife = this.dungeonLife;
      dungeonLife.update(dt || 0.016, this);
      dungeonLife.drawLighting(ctx, this, gameState, localPlayerId);
    } else {
      this.dungeonLife = null;
    }

    // PASS 2: ENTITIES, PROPS & 3D DUNGEON WALLS (Depth Sorted with Painter's Algorithm)
    const renderList = [];

    // 0. 3D Dungeon Stone Walls
    for (const wall of wallTiles) {
      const isFloor = (tx, ty) => {
        if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) return false;
        const t = map.tiles[ty][tx];
        return t === 4 || t === 1 || t === 6;
      };
      const hasFloorSouth = isFloor(wall.x, wall.y + 1);
      const hasFloorEast = isFloor(wall.x + 1, wall.y);
      const hasFloorSouthEast = isFloor(wall.x + 1, wall.y + 1);
      const isBackWall = hasFloorSouth || hasFloorEast || hasFloorSouthEast;

      renderList.push({
        type: 'dungeon_wall',
        x: wall.x,
        y: wall.y,
        isBackWall,
        depth: Isometric.getDepth(wall.x, wall.y, 0, isBackWall ? 5 : 48)
      });
    }

    // 1. Obstacles / Props (culled: props stand on their anchor and rise
    // upward, so allow a tall margin below the screen and a small one above)
    if (map.obstacles) {
      const zoom = this.camera.zoom;
      for (const obs of map.obstacles) {
        if (obs.type !== 'dungeon_door') {
          const iso = Isometric.worldToIso(obs.x, obs.y);
          const sx = (iso.x - this.camera.x) * zoom + w / 2;
          const sy = (iso.y - this.camera.y) * zoom + h / 2;
          if (sx < -260 * zoom || sx > w + 260 * zoom || sy < -60 * zoom || sy > h + 320 * zoom) continue;
        }
        renderList.push({
          type: 'obstacle',
          data: obs,
          depth: Isometric.getDepth(obs.x, obs.y, 0, 10)
        });
      }
    }

    // 2. Ground Items
    if (gameState.groundItems) {
      for (const item of gameState.groundItems) {
        renderList.push({
          type: 'ground_item',
          data: item,
          depth: Isometric.getDepth(item.x, item.y, 0, 20)
        });
      }
    }

    // 3. Dungeon Chests
    if (gameState.chests) {
      for (const chest of gameState.chests) {
        renderList.push({
          type: 'chest',
          data: chest,
          depth: Isometric.getDepth(chest.x, chest.y, 0, 15)
        });
      }
    }

    // 4. Mobs (culled like props; bosses are big, so the margin is generous)
    if (gameState.mobs) {
      const zoom = this.camera.zoom;
      for (const mob of gameState.mobs) {
        if (mob.state === 'dead') continue;
        const iso = Isometric.worldToIso(mob.x, mob.y);
        const sx = (iso.x - this.camera.x) * zoom + w / 2;
        const sy = (iso.y - this.camera.y) * zoom + h / 2;
        if (sx < -220 * zoom || sx > w + 220 * zoom || sy < -120 * zoom || sy > h + 320 * zoom) continue;
        renderList.push({
          type: 'mob',
          data: mob,
          depth: Isometric.getDepth(mob.x, mob.y, 0, 50)
        });
      }
    }

    // 5. Players
    if (gameState.players) {
      for (const player of gameState.players) {
        // Dead heroes stay on the ground playing their death animation (2D sprites only)
        if (player.isDead && !this.usePixelHeroes()) continue;
        renderList.push({
          type: 'player',
          data: player,
          isLocal: player.id === localPlayerId,
          depth: Isometric.getDepth(player.x, player.y, 0, 60)
        });
      }
    }

    // 6. Townsfolk strolling the city (cosmetic, town only)
    if (this.currentTheme === 'town') {
      this.updateTownsfolk(dt || 0.016);
      for (const c of this.townsfolk.folk) {
        renderList.push({ type: 'townsfolk', data: c, depth: Isometric.getDepth(c.x, c.y, 0, 55) });
      }
      if (townLife) {
        // pigeons scatter from anyone walking by
        const walkers = this.townsfolk.folk.concat(gameState.players || []);
        townLife.update(dt || 0.016, this, walkers);
        for (const critter of townLife.critters()) {
          renderList.push({ type: 'town_critter', data: critter, depth: Isometric.getDepth(critter.x, critter.y, 0, 54) });
        }
      }
    }

    // Sort render list from back to front
    renderList.sort((a, b) => a.depth - b.depth);

    // DRAW ALL DEPTH SORTED OBJECTS
    ctx.save();
    const baseTransform = ctx.getTransform();
    for (const item of renderList) {
      // one broken object must not take the rest of the frame (or the transform) with it
      try {
      switch (item.type) {
        case 'dungeon_wall':
          this.drawDungeonWall(ctx, item.x, item.y, map, item.isBackWall);
          break;
        case 'obstacle':
          if (item.data.hue) {
            // zone-tinted props (e.g. purple crystals, autumn trees); static
            // ones are tinted once and cached, animated ones once per frame
            const obs = item.data;
            const at = Isometric.worldToScreen(obs.x, obs.y, 0, this.camera, w, h);
            const z = this.camera.zoom;
            this.drawTinted(ctx, `hue-rotate(${obs.hue}deg)`, at.x, at.y, { halfW: 80 * z, up: 120 * z, down: 40 * z },
              c => this.drawObstacle(c, obs), obs, STATIC_TINT_PROPS.has(obs.type) ? 0 : ANIMATED_TINT_REFRESH_MS);
          } else {
            this.drawObstacle(ctx, item.data);
          }
          break;
        case 'chest':
          this.drawChest(ctx, item.data);
          break;
        case 'ground_item':
          this.drawGroundItem(ctx, item.data);
          break;
        case 'mob': {
          // Freshly summoned mobs fade in and rise out of the ground
          const k = this.mobSpawnProgress(item.data.id);
          if (k < 1) {
            ctx.save();
            ctx.globalAlpha = k;
            ctx.translate(0, (1 - k) * 22 * this.camera.zoom);
          }
          this.drawMob(ctx, item.data, item.data.id === selectedTargetId);
          if (k < 1) ctx.restore();
          break;
        }
        case 'player':
          this.drawPlayer(ctx, item.data, item.isLocal);
          break;
        case 'townsfolk':
          this.drawTownsfolk(ctx, item.data);
          break;
        case 'town_critter':
          townLife.drawCritter(ctx, this, item.data);
          break;
      }
      } catch (err) {
        this.reportDrawError(item.type + (item.data && item.data.type ? ':' + item.data.type : ''), err);
        this.recoverContext(ctx, baseTransform);
      }
    }
    ctx.restore();

    // Chimney smoke, falling leaves and birds pass over the rooftops
    if (townLife) townLife.drawSky(ctx, this);
    // Low fog and floating dust / embers / spores in the dungeon air
    if (dungeonLife) dungeonLife.drawAmbient(ctx, this);

    // DRAW OVERLAYS & EFFECTS (Click Beacon, Particles, Floating Text)
    this.drawEffects(ctx, dt);

    // DRAW FULLSCREEN STATUS VIGNETTES (Poison, Chill, Burn)
    if (gameState.players) {
      const localP = gameState.players.find(p => p.id === localPlayerId);
      if (localP && localP.statusEffects && localP.statusEffects.length > 0) {
        this.drawStatusVignettes(ctx, localP.statusEffects);
      }
    }

    // RENDER MINIMAP
    this.renderMinimap(gameState, localPlayerId);
  }

  // Draw Screen Vignettes for Player Status Effects
  drawStatusVignettes(ctx, statusEffects) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const pulse = Math.sin(this.animations.time * 4) * 0.15 + 0.85;

    for (const fx of statusEffects) {
      ctx.save();
      const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      if (fx.type === 'poison') {
        grad.addColorStop(0, 'rgba(34, 197, 94, 0)');
        grad.addColorStop(1, `rgba(34, 197, 94, ${0.35 * pulse})`);
      } else if (fx.type === 'chill') {
        grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
        grad.addColorStop(1, `rgba(56, 189, 248, ${0.4 * pulse})`);
      } else if (fx.type === 'burn') {
        grad.addColorStop(0, 'rgba(249, 115, 22, 0)');
        grad.addColorStop(1, `rgba(249, 115, 22, ${0.38 * pulse})`);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  // Draw 3D Isometric Tile Block with Side Edges & Textures
  // Tiles whose look changes over time; everything else is cached by drawGroundLayer
  isAnimatedTile(tileType) {
    // the town plaza is part of the pixel ground texture once that is ready
    if (tileType === 6 && this.currentTheme === 'town' && this.groundCache && this.groundCache.tex) return false;
    if (tileType === 3 || tileType === 6 || tileType === 10 || tileType === 11) return true;
    const pal = FIELD_TILE_PALETTE[tileType];
    return !!(pal && ANIMATED_TILE_DETAILS.has(pal.detail));
  }

  // Tile index range covering the screen plus a margin (px), clamped to the map:
  // big dungeons are ~200x200, so per-frame passes must not walk every tile
  visibleTileBounds(map, w, h, margin) {
    const xs = [], ys = [];
    for (const [sx, sy] of [[-margin, -margin], [w + margin, -margin], [-margin, h + margin], [w + margin, h + margin]]) {
      const p = Isometric.screenToWorld(sx, sy, this.camera, w, h);
      xs.push(p.x); ys.push(p.y);
    }
    return {
      x0: Math.max(0, Math.floor(Math.min(...xs)) - 1), x1: Math.min(map.width - 1, Math.ceil(Math.max(...xs)) + 1),
      y0: Math.max(0, Math.floor(Math.min(...ys)) - 1), y1: Math.min(map.height - 1, Math.ceil(Math.max(...ys)) + 1)
    };
  }

  // Paint the static ground into an offscreen canvas a margin larger than the
  // screen and blit it; repaint only when the camera leaves the margin, the
  // zoom or viewport changes, or the map's tiles change (map._tilesVersion).
  drawGroundLayer(ctx, map, isDungeon, w, h) {
    const M = 200;
    const cam = this.camera;
    const zoom = cam.zoom;
    let g = this.groundCache;
    const version = map._tilesVersion || 0;
    // The town's pixel ground is painted a slice per frame; repaint once it is ready
    const tex = this.currentTheme === 'town' && window.TownLife ? window.TownLife.groundTexture(map) : null;
    const stale = !g || g.map !== map || g.theme !== this.currentTheme || g.version !== version || g.zoom !== zoom || g.w !== w || g.h !== h ||
      g.tex !== tex || Math.abs((g.camX - cam.x) * zoom) > M - 16 || Math.abs((g.camY - cam.y) * zoom) > M - 16;
    if (stale) {
      if (!g) g = this.groundCache = { canvas: document.createElement('canvas') };
      g.tex = tex;
      const cw = w + 2 * M, ch = h + 2 * M;
      if (g.canvas.width !== cw || g.canvas.height !== ch) {
        g.canvas.width = cw;
        g.canvas.height = ch;
      }
      const gctx = g.canvas.getContext('2d');
      gctx.clearRect(0, 0, cw, ch);
      Object.assign(g, { map, theme: this.currentTheme, version, zoom, w, h, camX: cam.x, camY: cam.y });

      const tiles = [];
      const vis = this.visibleTileBounds(map, w, h, M + 160);
      for (let y = vis.y0; y <= vis.y1; y++) {
        for (let x = vis.x0; x <= vis.x1; x++) {
          const tileType = map.tiles[y][x];
          if (tileType === 8 || (isDungeon && tileType === 7)) continue;
          const iso = Isometric.worldToIso(x, y);
          const sx = (iso.x - cam.x) * zoom + cw / 2;
          const sy = (iso.y - cam.y) * zoom + ch / 2;
          if (sx < -120 || sx > cw + 120 || sy < -120 || sy > ch + 120) continue;
          tiles.push({ x, y, tileType, depth: x + y });
        }
      }
      tiles.sort((a, b) => a.depth - b.depth);
      this._tileView = { camera: { x: cam.x, y: cam.y, zoom }, w: cw, h: ch };
      // dungeon floor tiles look at their neighbours for wall contact shadows
      this._dungeonMap = isDungeon && window.DungeonLife && window.DungeonLife.has(this.currentTheme) ? map : null;
      for (const t of tiles) this.drawIsometricTile(gctx, t.x, t.y, t.tileType);
      this._tileView = null;
      this._dungeonMap = null;
      // The town's tile tops are replaced by one continuous pixel-art ground
      // (1 texel per screen px at zoom 1); tile side faces stay underneath
      if (tex) {
        gctx.imageSmoothingEnabled = zoom < 1;
        gctx.drawImage(tex.canvas, (tex.minX - cam.x) * zoom + cw / 2, (tex.minY - cam.y) * zoom + ch / 2, tex.canvas.width * zoom, tex.canvas.height * zoom);
        gctx.imageSmoothingEnabled = true;
      }
    }
    const dx = Math.round((g.camX - cam.x) * zoom - M + (cam.shakeOffsetX || 0));
    const dy = Math.round((g.camY - cam.y) * zoom - M + (cam.shakeOffsetY || 0));
    ctx.drawImage(g.canvas, dx, dy);
  }

  drawIsometricTile(ctx, x, y, tileType, topOnly = false) {
    const view = this._tileView;
    const screen = view
      ? Isometric.worldToScreen(x, y, 0, view.camera, view.w, view.h)
      : Isometric.worldToScreen(x, y, 0, this.camera, this.canvas.width, this.canvas.height);
    const hw = (TILE_WIDTH / 2) * this.camera.zoom;
    const hh = (TILE_HEIGHT / 2) * this.camera.zoom;
    const depth = TILE_DEPTH * this.camera.zoom;

    // Colors per tile type
    let topColor = '#38761d';
    let leftSideColor = '#274e13';
    let rightSideColor = '#1e3c0f';

    switch (tileType) {
      case 0: // Grass
        const grassSeed = (x * 13 + y * 29) % 3;
        topColor = grassSeed === 0 ? '#438a22' : grassSeed === 1 ? '#3c7e1e' : '#4d9c28';
        leftSideColor = '#5c4033';
        rightSideColor = '#463127';
        break;
      case 1: // Cobblestone / Dungeon Corridor
        const dThemeCorr = DUNGEON_THEME_TILES[this.currentTheme];
        if (dThemeCorr) {
          const cobbleSeed = (x * 7 + y * 13) % dThemeCorr.corridor.length;
          topColor = dThemeCorr.corridor[cobbleSeed];
          leftSideColor = dThemeCorr.corrLeft;
          rightSideColor = dThemeCorr.corrRight;
        } else {
          const cobbleSeed = (x * 7 + y * 13) % 3;
          topColor = cobbleSeed === 0 ? '#3f4756' : cobbleSeed === 1 ? '#434b5b' : '#3b4351';
          leftSideColor = '#2a313d';
          rightSideColor = '#1e242e';
        }
        break;
      case 2: // Dirt
        topColor = '#85583f';
        leftSideColor = '#6a432e';
        rightSideColor = '#503222';
        break;
      case 3: // Water
        const wave = Math.sin(this.animations.time * 2 + x * 0.5 + y * 0.5) * 15;
        topColor = `rgb(14, ${116 + Math.round(wave)}, 144)`;
        leftSideColor = '#0e7490';
        rightSideColor = '#155e75';
        break;
      case 4: // Dungeon Room Flagstone
        const dThemeTile = DUNGEON_THEME_TILES[this.currentTheme];
        if (dThemeTile) {
          const stoneSeed = (x * 17 + y * 31) % dThemeTile.flag.length;
          topColor = dThemeTile.flag[stoneSeed];
          leftSideColor = dThemeTile.flagLeft;
          rightSideColor = dThemeTile.flagRight;
        } else {
          const stoneSeed = (x * 17 + y * 31) % 4;
          topColor = stoneSeed === 0 ? '#272f3d' : stoneSeed === 1 ? '#222935' : stoneSeed === 2 ? '#2c3545' : '#1f2530';
          leftSideColor = '#191f28';
          rightSideColor = '#12161d';
        }
        break;
      case 5: // Wood Bridge
        topColor = '#a16207';
        leftSideColor = '#854d0e';
        rightSideColor = '#713f12';
        break;
      case 6: // Plaza / Portal pad: polished stone with an inlaid trim
        topColor = '#5a6378';
        leftSideColor = '#3a4252';
        rightSideColor = '#2b3240';
        break;
      case 7: // Perimeter Wall (Fallback flat ground)
        topColor = '#212631';
        leftSideColor = '#161922';
        rightSideColor = '#0e1117';
        break;
      case 9: // Snow (Frostfell Peaks)
        const snowSeed = (x * 19 + y * 23) % 3;
        topColor = snowSeed === 0 ? '#f1f5f9' : snowSeed === 1 ? '#e2e8f0' : '#f8fafc';
        leftSideColor = '#94a3b8';
        rightSideColor = '#64748b';
        break;
      case 10: // Glacial Ice (Frozen Lake)
        const iceReflect = Math.sin(this.animations.time * 2 + x + y) * 12;
        topColor = `rgb(56, ${189 + Math.round(iceReflect)}, 248)`;
        leftSideColor = '#0284c7';
        rightSideColor = '#0369a1';
        break;
      case 11: // Frost Stone Path & Ancient Ruins
        const fStone = (x * 13 + y * 17) % 3;
        topColor = fStone === 0 ? '#334155' : fStone === 1 ? '#2d3748' : '#3e4c5e';
        leftSideColor = '#1e293b';
        rightSideColor = '#0f172a';
        break;
      case 12: // Frost Mountain Cliff Crag
        topColor = '#475569';
        leftSideColor = '#334155';
        rightSideColor = '#1e293b';
        break;
      default: {
        const pal = FIELD_TILE_PALETTE[tileType];
        if (pal) {
          topColor = pal.tops[(x * 7 + y * 13) % pal.tops.length];
          leftSideColor = pal.left;
          rightSideColor = pal.right;
        }
      }
    }

    // Side faces are static; the per-frame animated pass repaints only the top
    if (!topOnly) {
      // 1. Draw 3D Left Depth Face
      ctx.beginPath();
      ctx.moveTo(screen.x - hw, screen.y);
      ctx.lineTo(screen.x, screen.y + hh);
      ctx.lineTo(screen.x, screen.y + hh + depth);
      ctx.lineTo(screen.x - hw, screen.y + depth);
      ctx.closePath();
      ctx.fillStyle = leftSideColor;
      ctx.fill();

      // 2. Draw 3D Right Depth Face
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y + hh);
      ctx.lineTo(screen.x + hw, screen.y);
      ctx.lineTo(screen.x + hw, screen.y + depth);
      ctx.lineTo(screen.x, screen.y + hh + depth);
      ctx.closePath();
      ctx.fillStyle = rightSideColor;
      ctx.fill();
    }

    // Pixel-art flagstones (with contact shadows and clutter) for dungeon floors
    if (this._dungeonMap && (tileType === 4 || tileType === 1)) {
      window.DungeonLife.drawFloor(ctx, this.currentTheme, this._dungeonMap, x, y, tileType, screen, this.camera.zoom);
      return;
    }

    // 3. Draw Isometric Diamond Top Face
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - hh);
    ctx.lineTo(screen.x + hw, screen.y);
    ctx.lineTo(screen.x, screen.y + hh);
    ctx.lineTo(screen.x - hw, screen.y);
    ctx.closePath();
    ctx.fillStyle = topColor;
    ctx.fill();

    // Thin grid outline for crisp isometric definition
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Details for specific tiles
    if (FIELD_TILE_PALETTE[tileType] && FIELD_TILE_PALETTE[tileType].detail) {
      const detail = FIELD_TILE_PALETTE[tileType].detail;
      if (!(view && OVERLAY_TILE_DETAILS.has(detail))) this.drawFieldTileDetail(ctx, detail, screen, hw, hh, x, y);
    } else if (tileType === 3) {
      // Water Shimmer Highlights
      ctx.beginPath();
      const waveShift = Math.sin(this.animations.time * 3 + x + y) * (hw * 0.3);
      ctx.moveTo(screen.x - hw * 0.3 + waveShift, screen.y);
      ctx.lineTo(screen.x + hw * 0.3 + waveShift, screen.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (tileType === 4) {
      // Dungeon Flagstone subtle mortar seams
      ctx.beginPath();
      ctx.moveTo(screen.x - hw * 0.35, screen.y - hh * 0.15);
      ctx.lineTo(screen.x + hw * 0.25, screen.y + hh * 0.25);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (tileType === 1) {
      // Cobblestones: two offset mortar seams that follow the iso axes
      const seamSeed = (x * 5 + y * 11) % 2;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (seamSeed === 0) {
        ctx.moveTo(screen.x - hw * 0.5, screen.y - hh * 0.5);
        ctx.lineTo(screen.x + hw * 0.5, screen.y + hh * 0.5);
        ctx.moveTo(screen.x - hw * 0.05, screen.y - hh * 0.05);
        ctx.lineTo(screen.x - hw * 0.5, screen.y + hh * 0.45);
      } else {
        ctx.moveTo(screen.x + hw * 0.5, screen.y - hh * 0.5);
        ctx.lineTo(screen.x - hw * 0.5, screen.y + hh * 0.5);
        ctx.moveTo(screen.x + hw * 0.05, screen.y - hh * 0.05);
        ctx.lineTo(screen.x + hw * 0.5, screen.y + hh * 0.45);
      }
      ctx.stroke();
    } else if (tileType === 6) {
      // Polished plaza slab: bevelled inner panel, thin gold inlay and a
      // faint glowing rune, all drawn as iso diamonds so they lie flat.
      const diamond = (s) => {
        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y - hh * s);
        ctx.lineTo(screen.x + hw * s, screen.y);
        ctx.lineTo(screen.x, screen.y + hh * s);
        ctx.lineTo(screen.x - hw * s, screen.y);
        ctx.closePath();
      };
      diamond(0.78);
      ctx.fillStyle = '#4d5569';
      ctx.fill();
      // light catches the upper bevel edges
      ctx.beginPath();
      ctx.moveTo(screen.x - hw * 0.78, screen.y);
      ctx.lineTo(screen.x, screen.y - hh * 0.78);
      ctx.lineTo(screen.x + hw * 0.78, screen.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      diamond(0.62);
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      const pulse = 0.5 + Math.sin(this.animations.time * 2 + x * 0.7 + y * 0.9) * 0.25;
      diamond(0.22);
      ctx.fillStyle = `rgba(125, 211, 252, ${0.25 + pulse * 0.25})`;
      ctx.fill();
    } else if (tileType === 10) {
      // Glacial Ice Surface Glaze & Fracture Lines
      ctx.beginPath();
      ctx.moveTo(screen.x - hw * 0.4, screen.y - hh * 0.2);
      ctx.lineTo(screen.x + hw * 0.1, screen.y + hh * 0.1);
      ctx.lineTo(screen.x + hw * 0.35, screen.y - hh * 0.1);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else if (tileType === 11) {
      // Ancient Nordic Frost Rune Glow
      const runePulse = Math.sin(this.animations.time * 3 + x + y) * 0.2 + 0.8;
      ctx.strokeStyle = `rgba(103, 232, 249, ${0.45 * runePulse})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, hw * 0.28, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Draw 3D Masonry Dungeon Wall
  drawDungeonWall(ctx, x, y, map, isBackWall) {
    const screen = Isometric.worldToScreen(x, y, 0, this.camera, this.canvas.width, this.canvas.height);
    const z = this.camera.zoom;
    // Pixel-art brick walls, darkened by how far they sit from any light
    if (window.DungeonLife && window.DungeonLife.has(this.currentTheme)) {
      const dark = this.dungeonLife ? this.dungeonLife.darknessAt(x, y) : 0;
      window.DungeonLife.drawWall(ctx, this.currentTheme, x, y, isBackWall, screen, z, dark);
      return;
    }
    const hw = (TILE_WIDTH / 2) * z;
    const hh = (TILE_HEIGHT / 2) * z;
    const wallH = (isBackWall ? 40 : 12) * z;

    const wTheme = DUNGEON_THEME_WALLS[this.currentTheme] || DUNGEON_THEME_WALLS.dungeon_crypt;

    // 1. LEFT FACE (South-West facing)
    ctx.beginPath();
    ctx.moveTo(screen.x - hw, screen.y);
    ctx.lineTo(screen.x, screen.y + hh);
    ctx.lineTo(screen.x, screen.y + hh - wallH);
    ctx.lineTo(screen.x - hw, screen.y - wallH);
    ctx.closePath();
    ctx.fillStyle = isBackWall ? wTheme.left : wTheme.leftLow;
    ctx.fill();

    // Left face stone brick mortar lines (for tall back walls)
    if (isBackWall && wallH > 18) {
      ctx.strokeStyle = wTheme.mortar;
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        const hOffset = (wallH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(screen.x - hw, screen.y - hOffset);
        ctx.lineTo(screen.x, screen.y + hh - hOffset);
        ctx.stroke();
      }
    }

    // 2. RIGHT FACE (South-East facing - in natural shadow)
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y + hh);
    ctx.lineTo(screen.x + hw, screen.y);
    ctx.lineTo(screen.x + hw, screen.y - wallH);
    ctx.lineTo(screen.x, screen.y + hh - wallH);
    ctx.closePath();
    ctx.fillStyle = isBackWall ? wTheme.right : wTheme.rightLow;
    ctx.fill();

    // Right face stone brick mortar lines (for tall back walls)
    if (isBackWall && wallH > 18) {
      ctx.strokeStyle = wTheme.mortar;
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        const hOffset = (wallH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y + hh - hOffset);
        ctx.lineTo(screen.x + hw, screen.y - hOffset);
        ctx.stroke();
      }
    }

    // 3. TOP CAP DIAMOND (Beveled Stone Slabs)
    const topY = screen.y - wallH;
    ctx.beginPath();
    ctx.moveTo(screen.x, topY - hh);
    ctx.lineTo(screen.x + hw, topY);
    ctx.lineTo(screen.x, topY + hh);
    ctx.lineTo(screen.x - hw, topY);
    ctx.closePath();
    ctx.fillStyle = isBackWall ? wTheme.top : wTheme.topLow;
    ctx.fill();

    // Stone Cap Highlight Border
    ctx.strokeStyle = isBackWall ? wTheme.capStroke : 'rgba(60, 75, 95, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Subtle edge highlight on top front rim
    ctx.beginPath();
    ctx.moveTo(screen.x - hw, topY);
    ctx.lineTo(screen.x, topY + hh);
    ctx.lineTo(screen.x + hw, topY);
    ctx.strokeStyle = wTheme.highlight;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Surface dressing for field-zone ground tiles
  drawFieldTileDetail(ctx, detail, screen, hw, hh, x, y) {
    const t = this.animations.time;
    const seed = (x * 73 + y * 151) % 97;
    const rx = (k) => ((seed * (k + 3) * 17) % 100) / 100 - 0.5; // stable -0.5..0.5
    ctx.save();
    if (detail === 'tuft') {
      ctx.strokeStyle = 'rgba(134, 239, 172, 0.35)';
      ctx.lineWidth = 1;
      for (let k = 0; k < 2; k++) {
        const px = screen.x + rx(k) * hw * 1.1, py = screen.y + rx(k + 5) * hh * 1.1;
        ctx.beginPath();
        ctx.moveTo(px - 2, py); ctx.lineTo(px - 3, py - 4);
        ctx.moveTo(px, py); ctx.lineTo(px, py - 5);
        ctx.moveTo(px + 2, py); ctx.lineTo(px + 3, py - 4);
        ctx.stroke();
      }
    } else if (detail === 'pebble' || detail === 'grain') {
      ctx.fillStyle = detail === 'grain' ? 'rgba(120, 80, 30, 0.25)' : 'rgba(0, 0, 0, 0.22)';
      for (let k = 0; k < (detail === 'grain' ? 5 : 3); k++) {
        ctx.beginPath();
        ctx.ellipse(screen.x + rx(k) * hw * 1.2, screen.y + rx(k + 7) * hh * 1.2, detail === 'grain' ? 1 : 2.4, detail === 'grain' ? 0.6 : 1.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (detail === 'grain') {
        // wind ripples
        ctx.strokeStyle = 'rgba(255, 245, 220, 0.18)';
        ctx.beginPath();
        ctx.moveTo(screen.x - hw * 0.5, screen.y + rx(2) * hh);
        ctx.quadraticCurveTo(screen.x, screen.y + rx(2) * hh - 3, screen.x + hw * 0.5, screen.y + rx(2) * hh);
        ctx.stroke();
      }
    } else if (detail === 'crack') {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(screen.x + rx(1) * hw, screen.y + rx(2) * hh);
      ctx.lineTo(screen.x + rx(3) * hw * 0.4, screen.y + rx(4) * hh * 0.4);
      ctx.lineTo(screen.x + rx(5) * hw, screen.y + rx(6) * hh);
      ctx.stroke();
    } else if (detail === 'flag') {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(screen.x - hw * 0.5, screen.y - hh * 0.5); ctx.lineTo(screen.x + hw * 0.5, screen.y + hh * 0.5);
      ctx.moveTo(screen.x + hw * 0.5, screen.y - hh * 0.5); ctx.lineTo(screen.x - hw * 0.5, screen.y + hh * 0.5);
      ctx.stroke();
    } else if (detail === 'water' || detail === 'murk') {
      const wave = Math.sin(t * 2.4 + x * 0.7 + y * 0.5);
      ctx.strokeStyle = detail === 'murk' ? 'rgba(163, 230, 53, 0.18)' : 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(screen.x - hw * 0.35 + wave * hw * 0.2, screen.y + rx(1) * hh * 0.6);
      ctx.lineTo(screen.x + hw * 0.35 + wave * hw * 0.2, screen.y + rx(1) * hh * 0.6);
      ctx.stroke();
      if (detail === 'murk' && seed % 5 === 0) {
        const b = (t * 0.6 + seed * 0.1) % 1;
        ctx.fillStyle = `rgba(190, 242, 100, ${0.4 * (1 - b)})`;
        ctx.beginPath();
        ctx.arc(screen.x + rx(3) * hw, screen.y + rx(4) * hh, 1.5 + b * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (detail === 'lava' || detail === 'pool') {
      const pulse = 0.5 + Math.sin(t * 1.8 + x * 0.9 + y * 0.6) * 0.5;
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y - hh * 0.6);
      ctx.lineTo(screen.x + hw * 0.6, screen.y);
      ctx.lineTo(screen.x, screen.y + hh * 0.6);
      ctx.lineTo(screen.x - hw * 0.6, screen.y);
      ctx.closePath();
      ctx.fillStyle = detail === 'lava' ? `rgba(253, 186, 116, ${0.25 + pulse * 0.35})` : `rgba(196, 181, 253, ${0.12 + pulse * 0.25})`;
      ctx.fill();
      if (detail === 'lava') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(40, 12, 4, 0.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(screen.x + rx(1) * hw, screen.y + rx(2) * hh);
        ctx.lineTo(screen.x + rx(3) * hw, screen.y + rx(4) * hh);
        ctx.stroke();
      }
    } else if (detail === 'ember' || detail === 'rift') {
      // glowing fissure across the stone, flickering
      const pulse = 0.5 + Math.sin(t * 3.2 + seed) * 0.5;
      const rgb = detail === 'ember' ? '251, 146, 60' : '236, 72, 153';
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${rgb}, ${0.35 + pulse * 0.45})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(screen.x + rx(1) * hw * 1.1, screen.y + rx(2) * hh);
      ctx.lineTo(screen.x + rx(3) * hw * 0.3, screen.y + rx(4) * hh * 0.3);
      ctx.lineTo(screen.x + rx(5) * hw * 1.1, screen.y + rx(6) * hh);
      ctx.stroke();
      ctx.fillStyle = `rgba(${rgb}, ${0.1 + pulse * 0.15})`;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, hw * 0.55, hh * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (detail === 'sparkle' || detail === 'glow' || detail === 'stars') {
      ctx.globalCompositeOperation = 'lighter';
      const n = detail === 'stars' ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const tw = 0.5 + Math.sin(t * 3 + seed + k * 2) * 0.5;
        if (detail === 'sparkle' && seed % 3 !== 0) break;
        ctx.fillStyle = detail === 'glow' ? `rgba(221, 214, 254, ${0.15 + tw * 0.2})` : `rgba(255, 255, 255, ${0.3 + tw * 0.6})`;
        const s = detail === 'glow' ? 6 : 1.4;
        ctx.beginPath();
        ctx.arc(screen.x + rx(k) * hw, screen.y + rx(k + 4) * hh, s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Screen-space ambient weather for field zones (frostfell has its snowfall)
  drawAmbientWeather(ctx, theme, w, h, time) {
    const cfg = {
      wildwood: { n: 26, color: ['rgba(132, 204, 22, 0.7)', 'rgba(234, 179, 8, 0.7)'], vx: 18, vy: 34, size: 3, shape: 'leaf' },
      dunes: { n: 30, color: ['rgba(254, 243, 199, 0.35)'], vx: 220, vy: 6, size: 18, shape: 'streak' },
      mirefen: { n: 22, color: ['rgba(190, 242, 100, 0.9)'], vx: 8, vy: -6, size: 2.2, shape: 'firefly' },
      ashen: { n: 50, color: ['rgba(168, 162, 158, 0.75)', 'rgba(251, 146, 60, 0.9)'], vx: 14, vy: 40, size: 1.8, shape: 'dot' },
      crystal: { n: 30, color: ['rgba(233, 213, 255, 0.9)'], vx: 0, vy: -12, size: 2, shape: 'sparkle' },
      shadowfell: { n: 34, color: ['rgba(168, 85, 247, 0.55)', 'rgba(15, 23, 42, 0.6)'], vx: 6, vy: -22, size: 2.6, shape: 'dot' },
      celestial: { n: 40, color: ['rgba(253, 230, 138, 0.9)', 'rgba(255, 255, 255, 0.9)'], vx: 0, vy: -8, size: 1.8, shape: 'sparkle' },
      dungeon: { n: 24, color: ['rgba(56, 189, 248, 0.75)', 'rgba(147, 197, 253, 0.6)'], vx: 4, vy: -18, size: 2.2, shape: 'firefly' },
      // 10 Progressive Dungeon Floor Themes
      dungeon_crypt: { n: 24, color: ['rgba(56, 189, 248, 0.75)', 'rgba(147, 197, 253, 0.6)'], vx: 4, vy: -18, size: 2.2, shape: 'firefly' },
      dungeon_sunken: { n: 26, color: ['rgba(45, 212, 191, 0.8)', 'rgba(20, 184, 166, 0.6)'], vx: -8, vy: 14, size: 2.4, shape: 'firefly' },
      dungeon_obsidian: { n: 42, color: ['rgba(249, 115, 22, 0.9)', 'rgba(239, 68, 68, 0.85)', 'rgba(251, 191, 36, 0.95)'], vx: 16, vy: -35, size: 2.0, shape: 'dot' },
      dungeon_glacial: { n: 32, color: ['rgba(103, 232, 249, 0.95)', 'rgba(186, 230, 253, 0.9)'], vx: -12, vy: 25, size: 2.2, shape: 'sparkle' },
      dungeon_toxic: { n: 26, color: ['rgba(132, 204, 22, 0.85)', 'rgba(163, 230, 53, 0.7)'], vx: 10, vy: -12, size: 2.6, shape: 'firefly' },
      dungeon_infernal: { n: 45, color: ['rgba(239, 68, 68, 0.95)', 'rgba(220, 38, 38, 0.9)', 'rgba(254, 202, 202, 0.8)'], vx: 20, vy: -40, size: 2.2, shape: 'dot' },
      dungeon_celestial: { n: 36, color: ['rgba(250, 204, 21, 0.95)', 'rgba(255, 255, 255, 0.95)', 'rgba(253, 224, 71, 0.8)'], vx: 0, vy: -15, size: 2.0, shape: 'sparkle' },
      dungeon_dread: { n: 30, color: ['rgba(168, 85, 247, 0.85)', 'rgba(192, 132, 252, 0.7)'], vx: 6, vy: -20, size: 2.4, shape: 'dot' },
      dungeon_dragon: { n: 38, color: ['rgba(245, 158, 11, 0.85)', 'rgba(251, 191, 36, 0.9)'], vx: 22, vy: -28, size: 2.4, shape: 'leaf' },
      dungeon_oblivion: { n: 36, color: ['rgba(236, 72, 153, 0.9)', 'rgba(217, 70, 239, 0.9)', 'rgba(255, 255, 255, 0.9)'], vx: -15, vy: -25, size: 2.4, shape: 'sparkle' }
    }[theme];
    if (!cfg) return;
    ctx.save();
    ctx.globalCompositeOperation = theme === 'shadowfell' || theme === 'wildwood' ? 'source-over' : 'lighter';
    const px = 2;
    const snap = v => Math.round(v / px) * px;
    for (let i = 0; i < cfg.n; i++) {
      const sx = (((i * 137 + time * cfg.vx + Math.sin(time * 0.7 + i) * 20) % (w + 100)) + w + 100) % (w + 100) - 50;
      const sy = (((i * 89 + time * cfg.vy) % (h + 100)) + h + 100) % (h + 100) - 50;
      const ix = snap(sx);
      const iy = snap(sy);
      const tw = 0.5 + Math.sin(time * 3 + i * 1.7) * 0.5;
      const col = cfg.color[i % cfg.color.length];
      ctx.fillStyle = col;
      if (cfg.shape === 'leaf') {
        const frame = Math.floor(time * 3 + i) & 1;
        // Crisp 2-frame tumbling pixel leaf
        ctx.fillRect(ix, iy, px * 2, px * 2);
        if (frame === 0) {
          ctx.fillRect(ix - px, iy - px, px, px);
          ctx.fillRect(ix + px * 2, iy + px, px, px);
        } else {
          ctx.fillRect(ix + px * 2, iy - px, px, px);
          ctx.fillRect(ix - px, iy + px, px, px);
        }
      } else if (cfg.shape === 'streak') {
        // Crisp stepped pixel sand streak
        const segs = Math.max(2, Math.round((cfg.size * (0.5 + tw)) / (px * 2)));
        for (let s = 0; s < segs; s++) {
          ctx.fillRect(ix + s * px * 2, iy + (s > segs >> 1 ? px : 0), px * 2, px);
        }
      } else if (cfg.shape === 'sparkle') {
        ctx.globalAlpha = tw;
        if (tw > 0.55) {
          // 5-block pixel star cross
          ctx.fillRect(ix - px, iy, px * 3, px);
          ctx.fillRect(ix, iy - px, px, px * 3);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(ix, iy, px, px);
        } else {
          ctx.fillRect(ix, iy, px, px);
        }
        ctx.globalAlpha = 1;
      } else if (cfg.shape === 'firefly') {
        // Pixel firefly with stepped cross halo and hot pixel core
        ctx.globalAlpha = tw * 0.45;
        ctx.fillRect(ix - px, iy, px * 3, px);
        ctx.fillRect(ix, iy - px, px, px * 3);
        ctx.globalAlpha = 0.65 + tw * 0.35;
        ctx.fillRect(ix, iy, px, px);
        ctx.globalAlpha = 1;
      } else {
        // Crisp square pixel ash/ember mote
        const sz = (i % 3 === 0) ? px * 2 : px;
        ctx.fillRect(ix, iy, sz, sz);
      }
    }
    ctx.restore();
  }

  // Layered, flickering teardrop flame with a soft halo and rising embers.
  // (baseX, baseY) is where the flame sits; scale 1 is a hand-torch flame.
  drawTorchFlame(ctx, baseX, baseY, z, scale, seed) {
    const t = this.animations.time;
    const flick = 1 + Math.sin(t * 13 + seed) * 0.12 + Math.sin(t * 23 + seed * 2) * 0.06;
    const sway = Math.sin(t * 6 + seed) * 1.6 * z * scale;
    const w = 5 * z * scale;
    const h = 13 * z * scale * flick;

    const torchTheme = DUNGEON_THEME_TORCH[this.currentTheme];

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const halo = ctx.createRadialGradient(baseX, baseY - h * 0.45, 0, baseX, baseY - h * 0.45, 20 * z * scale);
    halo.addColorStop(0, torchTheme ? torchTheme.haloInner : 'rgba(253, 186, 116, 0.45)');
    halo.addColorStop(0.5, torchTheme ? torchTheme.haloMid : 'rgba(249, 115, 22, 0.16)');
    halo.addColorStop(1, torchTheme ? torchTheme.haloOuter : 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(baseX, baseY - h * 0.45, 20 * z * scale, 0, Math.PI * 2);
    ctx.fill();

    const tongue = (fw, fh, color) => {
      ctx.beginPath();
      ctx.moveTo(baseX + sway, baseY - fh);
      ctx.bezierCurveTo(baseX + fw * 0.9 + sway * 0.4, baseY - fh * 0.45, baseX + fw, baseY, baseX, baseY);
      ctx.bezierCurveTo(baseX - fw, baseY, baseX - fw * 0.9 + sway * 0.4, baseY - fh * 0.45, baseX + sway, baseY - fh);
      ctx.fillStyle = color;
      ctx.fill();
    };
    tongue(w, h, torchTheme ? torchTheme.outer : 'rgba(234, 88, 12, 0.85)');
    tongue(w * 0.68, h * 0.75, torchTheme ? torchTheme.mid : 'rgba(250, 204, 21, 0.85)');
    tongue(w * 0.36, h * 0.45, torchTheme ? torchTheme.inner : 'rgba(255, 251, 235, 0.95)');

    // embers drifting up out of the flame (snapped pixel blocks)
    const emberColor = torchTheme ? torchTheme.ember : 'rgba(253, 186, 116, ';
    const epx = Math.max(2, Math.round(2 * z));
    for (let i = 0; i < 3; i++) {
      const life = (t * 0.9 + i / 3 + seed * 0.13) % 1;
      const ex = Math.round((baseX + Math.sin(seed + i * 2.1 + life * 6) * 3 * z * scale) / epx) * epx;
      const ey = Math.round((baseY - h - life * 16 * z * scale) / epx) * epx;
      ctx.fillStyle = `${emberColor}${(1 - life) * 0.9})`;
      ctx.fillRect(ex, ey, epx, epx);
    }
    ctx.restore();
  }

  // Warm pool of firelight on the floor around a light source
  drawFloorFireLight(ctx, x, y, z, seed) {
    const flick = 0.85 + Math.sin(this.animations.time * 9 + seed) * 0.08 + Math.sin(this.animations.time * 17 + seed) * 0.05;
    const r = 46 * z * flick;
    const torchTheme = DUNGEON_THEME_TORCH[this.currentTheme];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.scale(1, 0.5);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, torchTheme ? torchTheme.floorWash0 : 'rgba(251, 146, 60, 0.22)');
    g.addColorStop(0.6, torchTheme ? torchTheme.floorWash1 : 'rgba(234, 88, 12, 0.08)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Town curtain wall segment: dressed sandstone blocks with crenellations.
  // North/west runs (back) are tall; south/east runs (front) stay low so the
  // plaza behind them is never hidden.
  drawTownWall(ctx, obs, screen, z) {
    const hw = (TILE_WIDTH / 2) * z;
    const hh = (TILE_HEIGHT / 2) * z;
    const wallH = (obs.back ? 34 : 14) * z;
    const topY = screen.y - wallH;

    const face = (x1, y1, x2, y2, color) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, y2 - wallH);
      ctx.lineTo(x1, y1 - wallH);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    face(screen.x - hw, screen.y, screen.x, screen.y + hh, '#8e8a80');
    face(screen.x, screen.y + hh, screen.x + hw, screen.y, '#6e6a62');

    // staggered block courses
    ctx.strokeStyle = 'rgba(40, 36, 30, 0.45)';
    ctx.lineWidth = 1;
    const courses = Math.max(1, Math.round(wallH / (9 * z)));
    for (let i = 1; i < courses; i++) {
      const o = (wallH / courses) * i;
      ctx.beginPath();
      ctx.moveTo(screen.x - hw, screen.y - o); ctx.lineTo(screen.x, screen.y + hh - o);
      ctx.lineTo(screen.x + hw, screen.y - o);
      ctx.stroke();
      const t = i % 2 ? 0.33 : 0.66;
      ctx.beginPath();
      ctx.moveTo(screen.x - hw + hw * t, screen.y + hh * t - o);
      ctx.lineTo(screen.x - hw + hw * t, screen.y + hh * t - o + wallH / courses);
      ctx.moveTo(screen.x + hw * t, screen.y + hh - hh * t - o);
      ctx.lineTo(screen.x + hw * t, screen.y + hh - hh * t - o + wallH / courses);
      ctx.stroke();
    }

    // walkway cap
    ctx.beginPath();
    ctx.moveTo(screen.x, topY - hh);
    ctx.lineTo(screen.x + hw, topY);
    ctx.lineTo(screen.x, topY + hh);
    ctx.lineTo(screen.x - hw, topY);
    ctx.closePath();
    ctx.fillStyle = '#b3ad9f';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.stroke();

    // two merlons along the wall's run
    const mh = (obs.back ? 9 : 6) * z;
    const along = obs.axis === 'x' ? { x: hw / 2, y: hh / 2 } : { x: -hw / 2, y: hh / 2 };
    for (const s of [-0.5, 0.5]) {
      const cx = screen.x + along.x * s * 1.1;
      const cy = topY + along.y * s * 1.1;
      const mw = hw * 0.32, mhh = hh * 0.32;
      face(cx - mw, cy, cx, cy + mhh, '#a39d90');
      ctx.beginPath();
      ctx.moveTo(cx, cy + mhh); ctx.lineTo(cx + mw, cy); ctx.lineTo(cx + mw, cy - mh); ctx.lineTo(cx, cy + mhh - mh); ctx.closePath();
      ctx.fillStyle = '#7f7a70';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy - mhh - mh); ctx.lineTo(cx + mw, cy - mh); ctx.lineTo(cx, cy + mhh - mh); ctx.lineTo(cx - mw, cy - mh); ctx.closePath();
      ctx.fillStyle = '#c4beb0';
      ctx.fill();
    }
  }

  // Draw Props & Obstacles
  drawObstacle(ctx, obs) {
    const screen = Isometric.worldToScreen(obs.x, obs.y, 0, this.camera, this.canvas.width, this.canvas.height);
    const z = this.camera.zoom;

    if (obs.type === 'dungeon_door') {
      this.drawDungeonDoor(ctx, obs, z);
      return;
    }

    if (obs.type === 'town_wall') {
      this.drawTownWall(ctx, obs, screen, z);
      return;
    }

    // 3D-modelled town props (booths with NPCs, houses, towers). Falls back
    // to the 2D drawings below when WebGL is unavailable.
    if (window.townProps3D && TOWN_PROPS_3D.has(obs.type)) {
      const drawn = window.townProps3D.draw(ctx, obs, screen.x, screen.y, z, this.animations.time);
      if (drawn) {
        if (drawn.events && drawn.events.struck && drawn.sparkOffset) {
          const so = drawn.sparkOffset;
          this.addParticles(obs.x + so.x, obs.y + so.y, 'spark', 6, { speed: 2.2, z: so.z, sizeScale: 0.7 });
        }
        const tag = obs.type === 'merchant' ? ['Olaf the Trader [Shop]', '#fde68a']
          : obs.type === 'blacksmith' ? ['Brom the Master Smith [Reforge]', '#fdba74']
            : obs.type === 'enchanter' ? ['Valka the Enchanter [Rune Forge]', '#d8b4fe'] : null;
        if (tag) {
          ctx.save();
          ctx.font = '15px "DotGothic16", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#000';
          ctx.fillText(tag[0], screen.x + 1, drawn.top + 6 * z + 1);
          ctx.fillStyle = tag[1];
          ctx.fillText(tag[0], screen.x, drawn.top + 6 * z);
          ctx.restore();
        }
        return;
      }
    }

    if ((obs.type === 'oak_tree' || obs.type === 'pine_tree') && window.TownLife) {
      // Pixel-art tree; the crown sways a pixel in the breeze
      const TL = window.TownLife;
      const spr = TL.treeSprite(obs.type, Math.floor(TL.hash2(Math.round(obs.x * 10), Math.round(obs.y * 10)) * 3));
      const p = 1.3 * z;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, (obs.type === 'oak_tree' ? 26 : 16) * z, (obs.type === 'oak_tree' ? 12 : 8) * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();
      const x0 = Math.round(screen.x - spr.ax * p), y0 = Math.round(screen.y - spr.ay * p);
      const sway = Math.round(Math.sin(this.animations.time * 1.1 + obs.x * 1.7 + obs.y)) * p;
      const dw = spr.trunk.width * p, dh = spr.trunk.height * p;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(spr.trunk, x0, y0, dw, dh);
      ctx.drawImage(spr.crown, x0 + sway, y0, dw, dh);
      ctx.restore();
    } else if (obs.type === 'oak_tree' || obs.type === 'pine_tree') {
      // Shadow
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 18 * z, 10 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fill();

      // Tree Trunk
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(screen.x - 4 * z, screen.y - 24 * z, 8 * z, 24 * z);

      if (obs.type === 'oak_tree') {
        // Lush Oak Canopy
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - 36 * z, 22 * z, 0, Math.PI * 2);
        ctx.fillStyle = '#2d5a1e';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(screen.x - 8 * z, screen.y - 42 * z, 16 * z, 0, Math.PI * 2);
        ctx.fillStyle = '#3c7e1e';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(screen.x + 8 * z, screen.y - 38 * z, 14 * z, 0, Math.PI * 2);
        ctx.fillStyle = '#4d9c28';
        ctx.fill();
      } else {
        // Conical Pine Tree
        const layers = [
          { y: -20 * z, w: 26 * z, h: 18 * z, color: '#143818' },
          { y: -34 * z, w: 20 * z, h: 16 * z, color: '#1b4d21' },
          { y: -46 * z, w: 14 * z, h: 14 * z, color: '#27692f' }
        ];
        layers.forEach(l => {
          ctx.beginPath();
          ctx.moveTo(screen.x, screen.y + l.y - l.h);
          ctx.lineTo(screen.x + l.w / 2, screen.y + l.y);
          ctx.lineTo(screen.x - l.w / 2, screen.y + l.y);
          ctx.closePath();
          ctx.fillStyle = l.color;
          ctx.fill();
        });
      }
    } else if (obs.type === 'stone_pillar') {
      // Ruin Stone Pillar
      ctx.fillStyle = '#64748b';
      ctx.fillRect(screen.x - 8 * z, screen.y - 38 * z, 16 * z, 38 * z);
      ctx.fillStyle = '#475569';
      ctx.fillRect(screen.x, screen.y - 38 * z, 8 * z, 38 * z);

      // Capital topper
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(screen.x - 11 * z, screen.y - 43 * z, 22 * z, 6 * z);
    } else if (obs.type === 'fountain') {
      // Enhanced 2D Town Fountain (Classical Tiered Marble Basin)
      const t = this.animations ? this.animations.time : (performance.now() * 0.001);

      // Ground Plinth Shadow
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y + 2 * z, 35 * z, 20 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.fill();

      // Lower Basin Outer Stone Wall & Rim
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 33 * z, 18.5 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#64748b';
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3.5 * z;
      ctx.stroke();

      // Golden Filigree Accent Ring
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 31 * z, 17 * z, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.2 * z;
      ctx.stroke();

      // Lower Water Pool Depth Gradient
      const waterGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, 26 * z);
      waterGrad.addColorStop(0, '#38bdf8');
      waterGrad.addColorStop(0.65, '#0284c7');
      waterGrad.addColorStop(1, '#0369a1');
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 26 * z, 14.5 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = waterGrad;
      ctx.fill();

      // Concentric Animated Water Ripples
      const rip1 = (t * 1.5) % 1;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, (12 + rip1 * 12) * z, (6.5 + rip1 * 6.5) * z, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(224, 242, 254, ${(1 - rip1) * 0.6})`;
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();

      // Central Fluted Pedestal Pillar
      ctx.fillStyle = '#475569';
      ctx.fillRect(screen.x - 6 * z, screen.y - 18 * z, 12 * z, 18 * z);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(screen.x - 5 * z, screen.y - 18 * z, 5 * z, 18 * z);

      // Mid-Tier Basin Bowl
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - 18 * z, 16 * z, 8 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#64748b';
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2 * z;
      ctx.stroke();

      // Mid-Tier Water
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - 18.5 * z, 13 * z, 6.5 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();

      // Cascading Waterfall Sheets falling from mid bowl
      ctx.fillStyle = 'rgba(224, 242, 254, 0.45)';
      ctx.fillRect(screen.x - 14 * z, screen.y - 17 * z, 2.5 * z, 16 * z);
      ctx.fillRect(screen.x + 11.5 * z, screen.y - 17 * z, 2.5 * z, 16 * z);

      // Upper Column & Spire
      ctx.fillStyle = '#475569';
      ctx.fillRect(screen.x - 3 * z, screen.y - 32 * z, 6 * z, 14 * z);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(screen.x - 3 * z, screen.y - 32 * z, 3 * z, 14 * z);

      // Top Chalice
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - 32 * z, 8 * z, 4 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();

      // Top Geyser Pulsing Spray & Pixel Particles
      const gpx = Math.max(2, Math.round(2 * z));
      const spray = Math.round((Math.sin(t * 8) * 3 * z) / gpx) * gpx;
      const gx = Math.round(screen.x / gpx) * gpx;
      const gy = Math.round((screen.y - 36 * z) / gpx) * gpx + spray;
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(gx - gpx * 2, gy, gpx * 4, gpx);
      ctx.fillRect(gx - gpx, gy - gpx, gpx * 2, gpx * 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(gx - gpx, gy, gpx * 2, gpx);

      // Floating Arcane Aqua Crystal
      const crystalBob = Math.sin(t * 3) * 2 * z;
      const crystalY = screen.y - 42 * z + crystalBob;
      ctx.save();
      ctx.translate(screen.x, crystalY);
      ctx.rotate(t * 0.8);
      ctx.beginPath();
      ctx.moveTo(0, -6 * z);
      ctx.lineTo(4 * z, 0);
      ctx.lineTo(0, 6 * z);
      ctx.lineTo(-4 * z, 0);
      ctx.closePath();
      ctx.fillStyle = '#67e8f9';
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1.2 * z;
      ctx.stroke();
      ctx.restore();
    } else if (obs.type === 'torch') {
      // Standing iron brazier
      const seed = obs.x * 3.7 + obs.y * 5.3;
      this.drawFloorFireLight(ctx, screen.x, screen.y, z, seed);

      // stone foot
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 7 * z, 3.5 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#2b2f38';
      ctx.fill();
      // iron pole with a lit edge
      ctx.fillStyle = '#1f2329';
      ctx.fillRect(screen.x - 1.8 * z, screen.y - 30 * z, 3.6 * z, 30 * z);
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(screen.x - 1.8 * z, screen.y - 30 * z, 1.2 * z, 30 * z);
      // decorative collar
      ctx.fillStyle = '#374151';
      ctx.fillRect(screen.x - 3 * z, screen.y - 16 * z, 6 * z, 2 * z);
      // brazier bowl
      ctx.beginPath();
      ctx.moveTo(screen.x - 8 * z, screen.y - 36 * z);
      ctx.lineTo(screen.x + 8 * z, screen.y - 36 * z);
      ctx.lineTo(screen.x + 4.5 * z, screen.y - 29 * z);
      ctx.lineTo(screen.x - 4.5 * z, screen.y - 29 * z);
      ctx.closePath();
      ctx.fillStyle = '#2d3239';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - 36 * z, 8 * z, 2.6 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#7c2d12';
      ctx.fill();
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 1;
      ctx.stroke();

      this.drawTorchFlame(ctx, screen.x, screen.y - 36 * z, z, 1.25, seed);
    } else if (obs.type === 'wall_torch') {
      // Torch in an iron sconce on the room-facing side of a dungeon wall.
      // side 'left' = face toward +y (lower-left on screen), 'right' = toward +x.
      const hw = (TILE_WIDTH / 2) * z;
      const hh = (TILE_HEIGHT / 2) * z;
      const dir = obs.side === 'right' ? 1 : -1;
      const fx = screen.x + dir * hw * 0.5;   // centre of the wall face
      const fy = screen.y + hh * 0.5;
      const mountY = fy - 22 * z;
      const seed = obs.x * 3.7 + obs.y * 5.3;

      this.drawFloorFireLight(ctx, fx + dir * 6 * z, fy + 6 * z, z, seed);

      // warm light washing the wall face around the sconce
      const wash = ctx.createRadialGradient(fx, mountY - 6 * z, 0, fx, mountY - 6 * z, 22 * z);
      wash.addColorStop(0, 'rgba(251, 146, 60, 0.28)');
      wash.addColorStop(1, 'rgba(251, 146, 60, 0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = wash;
      ctx.beginPath();
      ctx.arc(fx, mountY - 6 * z, 22 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // back plate, sheared to lie on the wall face
      ctx.save();
      ctx.translate(fx, mountY);
      ctx.transform(1, -dir * 0.5, 0, 1, 0, 0);
      ctx.fillStyle = '#1f2329';
      ctx.fillRect(-3 * z, -4 * z, 6 * z, 9 * z);
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(-3 * z, -4 * z, 6 * z, 1.2 * z);
      ctx.restore();

      // bracket arm angling out from the wall, then the torch handle
      const tipX = fx + dir * 4 * z;
      const tipY = mountY + 3 * z;
      ctx.strokeStyle = '#2d3239';
      ctx.lineWidth = 2 * z;
      ctx.beginPath();
      ctx.moveTo(fx, mountY + 2 * z);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.strokeStyle = '#6b3f1d';
      ctx.lineWidth = 2.6 * z;
      ctx.beginPath();
      ctx.moveTo(tipX - dir * 1 * z, tipY + 3 * z);
      ctx.lineTo(tipX + dir * 1.5 * z, tipY - 9 * z);
      ctx.stroke();
      // wrapped head
      ctx.fillStyle = '#3f2a18';
      ctx.beginPath();
      ctx.ellipse(tipX + dir * 1.6 * z, tipY - 10 * z, 2.6 * z, 1.8 * z, 0, 0, Math.PI * 2);
      ctx.fill();

      this.drawTorchFlame(ctx, tipX + dir * 1.6 * z, tipY - 10.5 * z, z, 1.0, seed);
    } else if (obs.type === 'merchant') {
      // Merchant Olaf's Shop Stall
      // Wooden Counter Table
      ctx.fillStyle = '#78350f';
      ctx.fillRect(screen.x - 16 * z, screen.y - 12 * z, 32 * z, 12 * z);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(screen.x - 18 * z, screen.y - 14 * z, 36 * z, 4 * z);

      // Striped Awning Canopy
      const awningColors = ['#ef4444', '#f8fafc', '#ef4444', '#f8fafc', '#ef4444'];
      const segmentW = (38 * z) / awningColors.length;
      awningColors.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(screen.x - 19 * z + (i * segmentW), screen.y - 36 * z, segmentW, 10 * z);
      });
      // Canopy Frame Posts
      ctx.fillStyle = '#451a03';
      ctx.fillRect(screen.x - 18 * z, screen.y - 36 * z, 3 * z, 24 * z);
      ctx.fillRect(screen.x + 15 * z, screen.y - 36 * z, 3 * z, 24 * z);

      // Merchant Olaf NPC
      ctx.fillStyle = '#0284c7'; // Blue merchant robe
      ctx.fillRect(screen.x - 6 * z, screen.y - 24 * z, 12 * z, 12 * z);
      // Head
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 28 * z, 6 * z, 0, Math.PI * 2);
      ctx.fill();
      // Merchant Green Hat with Gold Feather
      ctx.fillStyle = '#15803d';
      ctx.fillRect(screen.x - 8 * z, screen.y - 32 * z, 16 * z, 4 * z);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(screen.x + 4 * z, screen.y - 34 * z, 3 * z, 0, Math.PI * 2);
      ctx.fill();

      // Merchant Overhead Name Tag
      ctx.save();
      ctx.font = '15px "DotGothic16", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText('🏪 Olaf the Trader [Shop]', screen.x + 1, screen.y - 44 * z + 1);
      ctx.fillStyle = '#fde68a';
      ctx.fillText('🏪 Olaf the Trader [Shop]', screen.x, screen.y - 44 * z);
      ctx.restore();
    } else if (obs.type === 'portal') {
      // Swirling Arcane Dungeon Portal
      const rot = this.animations.time * 2.5;

      // Base Pedestal
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 24 * z, 12 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2 * z;
      ctx.stroke();

      // Swirling Vortex Layers
      ctx.save();
      ctx.translate(screen.x, screen.y - 14 * z);

      // Radial Pulsing Glow
      const portalGlow = ctx.createRadialGradient(0, 0, 4 * z, 0, 0, 26 * z);
      portalGlow.addColorStop(0, 'rgba(6, 182, 212, 0.8)');
      portalGlow.addColorStop(0.5, 'rgba(168, 85, 247, 0.5)');
      portalGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = portalGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 26 * z, 0, Math.PI * 2);
      ctx.fill();

      // Rotating Rune Rings
      ctx.rotate(rot);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2 * z;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18 * z, 8 * z, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.rotate(-rot * 2);
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1.5 * z;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12 * z, 5 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Portal Overhead Tag
      ctx.save();
      ctx.font = '15px "DotGothic16", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      const portalLabel = obs.label || '🌀 Dungeon Portal';
      ctx.fillText(portalLabel, screen.x + 1, screen.y - 42 * z + 1);
      ctx.fillStyle = obs.color || '#38bdf8';
      ctx.fillText(portalLabel, screen.x, screen.y - 42 * z);
      ctx.restore();
    } else if (obs.type === 'blacksmith') {
      // NPC Brom the Master Smith (Reforge / Item Enhancement)
      // Ground Shadow
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 14 * z, 8 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fill();

      // Strong Legs / Boots
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(screen.x - 7 * z, screen.y - 10 * z, 5 * z, 10 * z);
      ctx.fillRect(screen.x + 2 * z, screen.y - 10 * z, 5 * z, 10 * z);

      // Muscular Torso & Leather Blacksmith Apron
      ctx.fillStyle = '#78350f'; // Heavy Leather Apron
      ctx.fillRect(screen.x - 9 * z, screen.y - 25 * z, 18 * z, 16 * z);
      ctx.fillStyle = '#451a03'; // Dark apron hem
      ctx.fillRect(screen.x - 8 * z, screen.y - 12 * z, 16 * z, 4 * z);

      // Cross Straps with Brass Rivets
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2 * z;
      ctx.beginPath();
      ctx.moveTo(screen.x - 7 * z, screen.y - 25 * z);
      ctx.lineTo(screen.x + 7 * z, screen.y - 15 * z);
      ctx.moveTo(screen.x + 7 * z, screen.y - 25 * z);
      ctx.lineTo(screen.x - 7 * z, screen.y - 15 * z);
      ctx.stroke();

      // Head & Facial Hair
      ctx.fillStyle = '#fed7aa'; // Skin
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 30 * z, 6.5 * z, 0, Math.PI * 2);
      ctx.fill();

      // Thick Blacksmith Beard
      ctx.fillStyle = '#7c2d12'; // Russet Auburn Beard
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 28 * z, 6 * z, 0, Math.PI);
      ctx.fill();

      // Red Smith Headband
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(screen.x - 7 * z, screen.y - 35 * z, 14 * z, 3.5 * z);

      // Blacksmith Right Arm holding Heavy Sledgehammer
      const hammerSwing = Math.sin(this.animations.time * 4) * 0.15;
      ctx.save();
      ctx.translate(screen.x + 10 * z, screen.y - 22 * z);
      ctx.rotate(hammerSwing);

      // Wooden Handle
      ctx.fillStyle = '#a16207';
      ctx.fillRect(-2 * z, -16 * z, 4 * z, 20 * z);

      // Heavy Steel Hammer Head
      ctx.fillStyle = '#475569';
      ctx.fillRect(-6 * z, -22 * z, 12 * z, 7 * z);
      ctx.fillStyle = '#94a3b8'; // Highlight on hammer top
      ctx.fillRect(-6 * z, -22 * z, 12 * z, 2 * z);
      ctx.restore();

      // Overhead Name Tag & Interaction Prompt
      ctx.save();
      ctx.font = '15px "DotGothic16", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText('🔨 Brom the Master Smith [Reforge]', screen.x + 1, screen.y - 44 * z + 1);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('🔨 Brom the Master Smith [Reforge]', screen.x, screen.y - 44 * z);
      ctx.restore();
    } else if (obs.type === 'anvil') {
      // Burning Forge & Heavy Steel Anvil
      // Stone Hearth / Forge Firebox (behind anvil)
      ctx.fillStyle = '#334155';
      ctx.fillRect(screen.x - 14 * z, screen.y - 18 * z, 28 * z, 18 * z);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(screen.x - 12 * z, screen.y - 16 * z, 24 * z, 14 * z);

      // Fiery Embers Glow in Hearth
      const firePulse = Math.sin(this.animations.time * 8) * 0.2 + 0.8;
      const emberGlow = ctx.createRadialGradient(screen.x, screen.y - 10 * z, 2 * z, screen.x, screen.y - 10 * z, 18 * z);
      emberGlow.addColorStop(0, `rgba(251, 146, 60, ${0.85 * firePulse})`);
      emberGlow.addColorStop(0.5, `rgba(239, 68, 68, ${0.5 * firePulse})`);
      emberGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = emberGlow;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 10 * z, 18 * z, 0, Math.PI * 2);
      ctx.fill();

      // Steel Anvil Base & Horn
      ctx.fillStyle = '#1e293b'; // Anvil Base
      ctx.fillRect(screen.x - 8 * z, screen.y - 6 * z, 16 * z, 6 * z);

      // Anvil Waist & Horn
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(screen.x - 10 * z, screen.y - 12 * z);
      ctx.lineTo(screen.x + 12 * z, screen.y - 12 * z); // horn extension
      ctx.lineTo(screen.x + 7 * z, screen.y - 7 * z);
      ctx.lineTo(screen.x - 6 * z, screen.y - 7 * z);
      ctx.closePath();
      ctx.fill();

      // Top Striking Face (Beveled Steel Surface)
      ctx.fillStyle = '#64748b';
      ctx.fillRect(screen.x - 8 * z, screen.y - 14 * z, 14 * z, 3 * z);

      // Glowing Hot Ingot on Anvil Face
      const ingotGlow = Math.sin(this.animations.time * 10) * 0.15 + 0.85;
      ctx.fillStyle = `rgba(254, 215, 170, ${ingotGlow})`;
      ctx.fillRect(screen.x - 4 * z, screen.y - 16 * z, 8 * z, 2.5 * z);
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1;
      ctx.strokeRect(screen.x - 4 * z, screen.y - 16 * z, 8 * z, 2.5 * z);

      // Periodic Tiny Flying Sparks from Anvil
      if (Math.sin(this.animations.time * 12) > 0.6) {
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(screen.x + (Math.sin(this.animations.time * 30) * 8 * z), screen.y - (18 + Math.random() * 8) * z, 2 * z, 2 * z);
      }
    } else if (obs.type === 'snow_pine') {
      // Pine tree heavily dusted with winter snow
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 18 * z, 9 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();

      // Trunk
      ctx.fillStyle = '#452e23';
      ctx.fillRect(screen.x - 3.5 * z, screen.y - 20 * z, 7 * z, 20 * z);

      // Conical Snow Pine Layers
      const layers = [
        { y: -16 * z, w: 28 * z, h: 16 * z, color: '#133e24', snowColor: '#f1f5f9' },
        { y: -28 * z, w: 22 * z, h: 14 * z, color: '#1a4e2e', snowColor: '#f8fafc' },
        { y: -39 * z, w: 15 * z, h: 12 * z, color: '#23653d', snowColor: '#ffffff' }
      ];
      layers.forEach(l => {
        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y + l.y - l.h);
        ctx.lineTo(screen.x + l.w / 2, screen.y + l.y);
        ctx.lineTo(screen.x - l.w / 2, screen.y + l.y);
        ctx.closePath();
        ctx.fillStyle = l.color;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(screen.x - l.w / 2, screen.y + l.y);
        ctx.lineTo(screen.x, screen.y + l.y - 4 * z);
        ctx.lineTo(screen.x + l.w / 2, screen.y + l.y);
        ctx.lineTo(screen.x + l.w / 2 - 3 * z, screen.y + l.y + 3 * z);
        ctx.lineTo(screen.x - l.w / 2 + 3 * z, screen.y + l.y + 3 * z);
        ctx.closePath();
        ctx.fillStyle = l.snowColor;
        ctx.fill();
      });
    } else if (obs.type === 'ice_crystal') {
      // Glacial Ice Crystal Shard Cluster
      const crystalGlow = ctx.createRadialGradient(screen.x, screen.y - 18 * z, 2 * z, screen.x, screen.y - 18 * z, 24 * z);
      crystalGlow.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      crystalGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = crystalGlow;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 18 * z, 24 * z, 0, Math.PI * 2);
      ctx.fill();

      // Center Spire
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y - 36 * z);
      ctx.lineTo(screen.x + 8 * z, screen.y - 6 * z);
      ctx.lineTo(screen.x, screen.y);
      ctx.lineTo(screen.x - 8 * z, screen.y - 6 * z);
      ctx.closePath();
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();

      // Left shard
      ctx.beginPath();
      ctx.moveTo(screen.x - 6 * z, screen.y - 24 * z);
      ctx.lineTo(screen.x - 14 * z, screen.y - 4 * z);
      ctx.lineTo(screen.x - 4 * z, screen.y);
      ctx.closePath();
      ctx.fillStyle = '#0284c7';
      ctx.fill();

      // Right shard
      ctx.beginPath();
      ctx.moveTo(screen.x + 6 * z, screen.y - 22 * z);
      ctx.lineTo(screen.x + 4 * z, screen.y);
      ctx.lineTo(screen.x + 13 * z, screen.y - 5 * z);
      ctx.closePath();
      ctx.fillStyle = '#0284c7';
      ctx.fill();
    } else if (obs.type === 'frost_monolith') {
      // Ancient Glacial Monolith / Obelisk
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(screen.x - 10 * z, screen.y);
      ctx.lineTo(screen.x + 10 * z, screen.y);
      ctx.lineTo(screen.x + 6 * z, screen.y - 44 * z);
      ctx.lineTo(screen.x, screen.y - 52 * z);
      ctx.lineTo(screen.x - 6 * z, screen.y - 44 * z);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();

      // Glowing Rune Inscriptions
      const runeFlicker = Math.sin(this.animations.time * 4 + obs.y) * 0.25 + 0.75;
      ctx.strokeStyle = `rgba(103, 232, 249, ${runeFlicker})`;
      ctx.lineWidth = 1.8 * z;
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y - 38 * z);
      ctx.lineTo(screen.x, screen.y - 12 * z);
      ctx.moveTo(screen.x - 4 * z, screen.y - 30 * z);
      ctx.lineTo(screen.x + 4 * z, screen.y - 24 * z);
      ctx.moveTo(screen.x - 4 * z, screen.y - 18 * z);
      ctx.lineTo(screen.x + 4 * z, screen.y - 22 * z);
      ctx.stroke();
    } else if (obs.type === 'frost_portal') {
      // Gateway from Town to Frostfell Peaks
      const rot = this.animations.time * 2.0;

      // Base Pedestal
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 24 * z, 12 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2 * z;
      ctx.stroke();

      // Swirling Blizzard Vortex
      ctx.save();
      ctx.translate(screen.x, screen.y - 14 * z);

      const frostGlow = ctx.createRadialGradient(0, 0, 4 * z, 0, 0, 28 * z);
      frostGlow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      frostGlow.addColorStop(0.4, 'rgba(56, 189, 248, 0.7)');
      frostGlow.addColorStop(0.8, 'rgba(2, 132, 199, 0.4)');
      frostGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = frostGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 28 * z, 0, Math.PI * 2);
      ctx.fill();

      // Rotating Ice Rings
      ctx.rotate(rot);
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 2 * z;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18 * z, 8 * z, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.rotate(-rot * 2.2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5 * z;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12 * z, 5 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Portal Tag
      ctx.save();
      ctx.font = '15px "DotGothic16", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText('❄️ Frostfell Portal [Lv. 6+]', screen.x + 1, screen.y - 42 * z + 1);
      ctx.fillStyle = '#67e8f9';
      ctx.fillText('❄️ Frostfell Portal [Lv. 6+]', screen.x, screen.y - 42 * z);
      ctx.restore();
    } else if (obs.type === 'cactus') {
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 10 * z, 5 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();
      const limb = (x, y, w, h) => {
        ctx.beginPath();
        ctx.roundRect(screen.x + x * z, screen.y + y * z, w * z, h * z, (w / 2) * z);
        ctx.fill();
      };
      ctx.fillStyle = '#3f7d3a';
      limb(-4, -34, 8, 34);
      limb(-13, -24, 6, 12);
      limb(7, -28, 6, 14);
      ctx.fillRect(screen.x - 10 * z, screen.y - 15 * z, 8 * z, 4 * z);
      ctx.fillRect(screen.x + 2 * z, screen.y - 17 * z, 8 * z, 4 * z);
      ctx.fillStyle = '#5ea052';
      ctx.fillRect(screen.x - 3 * z, screen.y - 32 * z, 2 * z, 30 * z);
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 35 * z, 2.4 * z, 0, Math.PI * 2);
      ctx.fill();
    } else if (obs.type === 'dead_tree') {
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 14 * z, 7 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();
      ctx.strokeStyle = '#3b2a20';
      ctx.lineCap = 'round';
      const branch = (x1, y1, x2, y2, w) => {
        ctx.lineWidth = w * z;
        ctx.beginPath();
        ctx.moveTo(screen.x + x1 * z, screen.y + y1 * z);
        ctx.lineTo(screen.x + x2 * z, screen.y + y2 * z);
        ctx.stroke();
      };
      branch(0, 0, -2, -26, 6);
      branch(-2, -26, 2, -44, 4);
      branch(-1, -20, -14, -32, 3);
      branch(-14, -32, -18, -42, 2);
      branch(1, -30, 13, -40, 3);
      branch(13, -40, 20, -38, 2);
      branch(2, -44, -4, -52, 2);
      ctx.lineCap = 'butt';
    } else if (obs.type === 'boulder') {
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y + 2 * z, 16 * z, 7 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(screen.x - 15 * z, screen.y);
      ctx.lineTo(screen.x - 11 * z, screen.y - 14 * z);
      ctx.lineTo(screen.x - 2 * z, screen.y - 20 * z);
      ctx.lineTo(screen.x + 10 * z, screen.y - 15 * z);
      ctx.lineTo(screen.x + 15 * z, screen.y - 3 * z);
      ctx.lineTo(screen.x + 6 * z, screen.y + 4 * z);
      ctx.lineTo(screen.x - 9 * z, screen.y + 4 * z);
      ctx.closePath();
      ctx.fillStyle = '#6b6f78';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(screen.x - 11 * z, screen.y - 14 * z);
      ctx.lineTo(screen.x - 2 * z, screen.y - 20 * z);
      ctx.lineTo(screen.x + 10 * z, screen.y - 15 * z);
      ctx.lineTo(screen.x + 1 * z, screen.y - 10 * z);
      ctx.closePath();
      ctx.fillStyle = '#8b9099';
      ctx.fill();
    } else if (obs.type === 'bone_pile') {
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y + 1 * z, 15 * z, 6 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();
      ctx.lineCap = 'round';
      for (const [x0, y0, x1, y1] of [[-12, 0, 6, -5], [-6, -6, 10, 1], [-10, -3, 2, 3], [0, -9, 12, -4]]) {
        ctx.beginPath();
        ctx.moveTo(screen.x + x0 * z, screen.y + y0 * z);
        ctx.lineTo(screen.x + x1 * z, screen.y + y1 * z);
        ctx.strokeStyle = '#a8a29e';
        ctx.lineWidth = 3.4 * z;
        ctx.stroke();
        ctx.strokeStyle = '#e7e5e4';
        ctx.lineWidth = 1.6 * z;
        ctx.stroke();
      }
      // skull on top
      ctx.beginPath();
      ctx.arc(screen.x - 1 * z, screen.y - 10 * z, 5 * z, 0, Math.PI * 2);
      ctx.fillStyle = '#e7e5e4';
      ctx.fill();
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(screen.x - 3.5 * z, screen.y - 11 * z, 2 * z, 2 * z);
      ctx.fillRect(screen.x + 0.5 * z, screen.y - 11 * z, 2 * z, 2 * z);
      ctx.lineCap = 'butt';
    } else if (obs.type === 'sarcophagus') {
      // stone coffin lying along the floor: lid, two visible sides
      const L = 18 * z, W = 9 * z, H = 9 * z;
      const p = (u, v, h) => ({ x: screen.x + (u - v) * 0.9, y: screen.y + (u + v) * 0.45 - h });
      const quad = (pts, fill) => {
        ctx.beginPath();
        pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      };
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y + 3 * z, 22 * z, 9 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.fill();
      quad([p(-L, W, 0), p(L, W, 0), p(L, W, H), p(-L, W, H)], '#4b5563');
      quad([p(L, -W, 0), p(L, W, 0), p(L, W, H), p(L, -W, H)], '#374151');
      quad([p(-L, -W, H), p(L, -W, H), p(L, W, H), p(-L, W, H)], '#6b7280');
      quad([p(-L * 0.8, -W * 0.6, H + 2 * z), p(L * 0.8, -W * 0.6, H + 2 * z), p(L * 0.8, W * 0.6, H + 2 * z), p(-L * 0.8, W * 0.6, H + 2 * z)], '#9ca3af');
      // carved cross on the lid
      const a = p(-L * 0.5, 0, H + 2 * z), b = p(L * 0.5, 0, H + 2 * z), c = p(-L * 0.2, -W * 0.45, H + 2 * z), d = p(-L * 0.2, W * 0.45, H + 2 * z);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y);
      ctx.strokeStyle = 'rgba(31, 41, 55, 0.7)';
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();
    } else if (obs.type === 'brazier') {
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y + 1 * z, 11 * z, 5 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(screen.x - 2 * z, screen.y - 16 * z, 4 * z, 16 * z);
      ctx.fillRect(screen.x - 7 * z, screen.y - 1 * z, 14 * z, 2 * z);
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - 17 * z, 10 * z, 4 * z, 0, 0, Math.PI);
      ctx.lineTo(screen.x - 10 * z, screen.y - 17 * z);
      ctx.fillStyle = '#52525b';
      ctx.fill();
      const t = this.animations.time;
      const flick = Math.sin(t * 9 + obs.x * 3) * 2 * z;
      const glow = ctx.createRadialGradient(screen.x, screen.y - 22 * z, 0, screen.x, screen.y - 22 * z, 26 * z);
      glow.addColorStop(0, 'rgba(251, 146, 60, 0.45)');
      glow.addColorStop(1, 'rgba(251, 146, 60, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 22 * z, 26 * z, 0, Math.PI * 2);
      ctx.fill();
      for (const [w, h, col] of [[8, 16, '#ea580c'], [5.5, 11, '#f59e0b'], [3, 6, '#fef3c7']]) {
        ctx.beginPath();
        ctx.moveTo(screen.x - w * z, screen.y - 17 * z);
        ctx.quadraticCurveTo(screen.x - w * 0.6 * z, screen.y - (17 + h * 0.6) * z, screen.x + flick * 0.5, screen.y - (17 + h) * z);
        ctx.quadraticCurveTo(screen.x + w * 0.6 * z, screen.y - (17 + h * 0.6) * z, screen.x + w * z, screen.y - 17 * z);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
      }
    } else if (obs.type === 'gold_hoard') {
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y + 1 * z, 18 * z, 7 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(screen.x - 17 * z, screen.y + 2 * z);
      ctx.quadraticCurveTo(screen.x - 8 * z, screen.y - 14 * z, screen.x, screen.y - 15 * z);
      ctx.quadraticCurveTo(screen.x + 9 * z, screen.y - 13 * z, screen.x + 17 * z, screen.y + 2 * z);
      ctx.closePath();
      ctx.fillStyle = '#b45309';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(screen.x - 13 * z, screen.y - 1 * z);
      ctx.quadraticCurveTo(screen.x - 5 * z, screen.y - 13 * z, screen.x + 2 * z, screen.y - 13 * z);
      ctx.quadraticCurveTo(screen.x + 6 * z, screen.y - 8 * z, screen.x + 4 * z, screen.y - 2 * z);
      ctx.closePath();
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      for (const [dx, dy] of [[-8, -6], [-2, -11], [5, -7], [10, -2], [-12, -1], [1, -3]]) {
        ctx.beginPath();
        ctx.ellipse(screen.x + dx * z, screen.y + dy * z, 2.4 * z, 1.2 * z, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // a goblet and a gem
      ctx.fillStyle = '#facc15';
      ctx.fillRect(screen.x + 6 * z, screen.y - 14 * z, 4 * z, 6 * z);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(screen.x - 6 * z, screen.y - 10 * z, 2 * z, 0, Math.PI * 2);
      ctx.fill();
    } else if (obs.type === 'giant_mushroom') {
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 14 * z, 7 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();
      ctx.fillStyle = '#e7dcc4';
      ctx.fillRect(screen.x - 4 * z, screen.y - 22 * z, 8 * z, 22 * z);
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - 24 * z, 18 * z, 11 * z, 0, Math.PI, Math.PI * 2);
      ctx.fillStyle = '#c0392b';
      ctx.fill();
      ctx.fillStyle = '#922b21';
      ctx.fillRect(screen.x - 18 * z, screen.y - 25 * z, 36 * z, 3 * z);
      ctx.fillStyle = '#fdf6e3';
      for (const [dx, dy, r] of [[-9, -29, 2.6], [3, -32, 3], [11, -27, 2], [-2, -26, 1.6]]) {
        ctx.beginPath();
        ctx.arc(screen.x + dx * z, screen.y + dy * z, r * z, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (obs.type === 'field_portal') {
      // Gateway between field zones (colour/label from the destination)
      const accent = obs.color || '#facc15';
      const rot = this.animations.time * 2.2;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 24 * z, 12 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2 * z;
      ctx.stroke();
      ctx.save();
      ctx.translate(screen.x, screen.y - 14 * z);
      const pg = ctx.createRadialGradient(0, 0, 4 * z, 0, 0, 28 * z);
      pg.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      pg.addColorStop(0.45, accent);
      pg.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(0, 0, 28 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.rotate(rot);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * z;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18 * z, 8 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(-rot * 2);
      ctx.strokeStyle = accent;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12 * z, 5 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.font = '15px "DotGothic16", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(obs.label || 'Portal', screen.x + 1, screen.y - 42 * z + 1);
      ctx.fillStyle = accent;
      ctx.fillText(obs.label || 'Portal', screen.x, screen.y - 42 * z);
      ctx.restore();
    } else if (obs.type === 'town_portal') {
      // Gateway from Frostfell returning to Town
      const rot = this.animations.time * 2.2;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 24 * z, 12 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2 * z;
      ctx.stroke();

      ctx.save();
      ctx.translate(screen.x, screen.y - 14 * z);

      const townGlow = ctx.createRadialGradient(0, 0, 4 * z, 0, 0, 28 * z);
      townGlow.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
      townGlow.addColorStop(0.5, 'rgba(245, 158, 11, 0.6)');
      townGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = townGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 28 * z, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(rot);
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 2 * z;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18 * z, 8 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font = '15px "DotGothic16", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText('🏰 Return to Town', screen.x + 1, screen.y - 42 * z + 1);
      ctx.fillStyle = '#facc15';
      ctx.fillText('🏰 Return to Town', screen.x, screen.y - 42 * z);
      ctx.restore();
    }
  }

  // Draw Procedural Treasure Chests
  drawChest(ctx, chest) {
    const screen = Isometric.worldToScreen(chest.x, chest.y, 0, this.camera, this.canvas.width, this.canvas.height);
    const z = this.camera.zoom;
    const isGold = chest.isGold;

    // Shadow
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, 14 * z, 7 * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    ctx.save();
    ctx.translate(screen.x, screen.y);

    if (chest.opened) {
      // Opened Chest with Light Rays
      ctx.fillStyle = isGold ? '#b45309' : '#5c4033';
      ctx.fillRect(-10 * z, -10 * z, 20 * z, 10 * z);

      // Open Lid tilted
      ctx.fillStyle = isGold ? '#d97706' : '#78350f';
      ctx.fillRect(-11 * z, -20 * z, 22 * z, 6 * z);

      // Golden Treasure Light Beam
      const lightGrad = ctx.createLinearGradient(0, -10 * z, 0, -35 * z);
      lightGrad.addColorStop(0, 'rgba(250, 204, 21, 0.8)');
      lightGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.moveTo(-8 * z, -10 * z);
      ctx.lineTo(8 * z, -10 * z);
      ctx.lineTo(14 * z, -35 * z);
      ctx.lineTo(-14 * z, -35 * z);
      ctx.closePath();
      ctx.fill();
    } else {
      // Closed Chest
      ctx.fillStyle = isGold ? '#f59e0b' : '#78350f';
      ctx.fillRect(-10 * z, -14 * z, 20 * z, 14 * z);

      // Metal Bands / Straps
      ctx.fillStyle = isGold ? '#fde68a' : '#94a3b8';
      ctx.fillRect(-8 * z, -14 * z, 3 * z, 14 * z);
      ctx.fillRect(5 * z, -14 * z, 3 * z, 14 * z);

      // Chest Lid
      ctx.fillStyle = isGold ? '#fbbf24' : '#92400e';
      ctx.beginPath();
      ctx.arc(0, -14 * z, 10 * z, Math.PI, 0);
      ctx.fill();

      // Brass Lock
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, -9 * z, 2.5 * z, 0, Math.PI * 2);
      ctx.fill();

      // Floating Tooltip
      ctx.font = '14px "DotGothic16", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText('🗝️ Click to Open', 0, -24 * z);
    }

    ctx.restore();
  }

  // Draw Ground Items (Gold, Potions, Relics)
  drawGroundItem(ctx, item) {
    const screen = Isometric.worldToScreen(item.x, item.y, 0, this.camera, this.canvas.width, this.canvas.height);
    const z = this.camera.zoom;
    const bounce = Math.sin(this.animations.time * 4 + item.x) * 3 * z;

    // Shadow
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, 10 * z, 5 * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();

    // Item Icon (blinks faster and faster during its last 30s before despawning)
    ctx.save();
    const leftMs = item.expiresAt ? item.expiresAt - Date.now() : Infinity;
    if (leftMs < 30000) {
      const rate = leftMs < 10000 ? 10 : 5;
      ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.animations.time * rate));
    }
    ctx.font = `${Math.round(18 * z)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (window.PixelIcons) {
      const iconName = item.type === 'gold' ? 'coin' : PixelIcons.item({ itemId: item.itemId, ...(item.customItemData || {}), type: item.customItemData ? item.customItemData.type : item.type });
      const size = Math.round(12 * Math.max(2, Math.round(z * 2)));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(PixelIcons.image(iconName), Math.round(screen.x - size / 2), Math.round(screen.y - 12 * z + bounce - size / 2), size, size);
    }

    // Glowing Halo
    // (no glow halo in the pixel UI)

    ctx.restore();
  }

  // Draw Player Character with Realistic 8-Directional Humanoid Anatomy, Facial Features, Hair, Clothes & Physics
  drawPlayer(ctx, player, isLocal) {
    const screen = Isometric.worldToScreen(player.x, player.y, 0, this.camera, this.canvas.width, this.canvas.height);
    const z = this.camera.zoom;
    const t = this.animations.time;

    // Humanoid Biomechanical Parameters
    const isMoving = !!player.isMoving;
    const idleBreath = Math.sin(t * 3.2) * 1.2 * z;
    const walkCycle = isMoving ? (t * 13) : 0;
    const walkBob = isMoving ? Math.abs(Math.sin(walkCycle)) * 3.5 * z : idleBreath;

    // Leg Stride Angles (Natural pendulum stride)
    const legL_Angle = isMoving ? Math.sin(walkCycle) * 0.45 : 0;
    const legR_Angle = isMoving ? -Math.sin(walkCycle) * 0.45 : 0;
    const armL_Angle = isMoving ? -Math.sin(walkCycle) * 0.35 : (Math.sin(t * 2.8) * 0.08);
    const armR_Angle = isMoving ? Math.sin(walkCycle) * 0.35 : (-Math.sin(t * 2.8) * 0.08);

    // 8-Directional Orientation (Lock to attack direction during combat swings)
    const attack = this.attacks ? this.attacks.get(player.id) : null;
    const isAttacking = attack && (performance.now() - attack.time < attack.duration);
    const facing = (isAttacking && attack.facing) ? attack.facing : (player.facing || 'S');
    const isBackView = facing === 'N' || facing === 'NE' || facing === 'NW';
    const isFrontView = facing === 'S' || facing === 'SE' || facing === 'SW';
    const isDirectNorth = facing === 'N';
    const isDirectSouth = facing === 'S';
    const isDirectSide = facing === 'E' || facing === 'W';
    const isFacingLeft = facing === 'W' || facing === 'NW' || facing === 'SW';

    // Drop Shadow on Ground
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, (13 + (isMoving ? 1 : 0)) * z, 6.5 * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.fill();

    // Local Player Selection Ring
    if (isLocal) {
      const ringPulse = Math.sin(t * 4) * 1.5 * z;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 18 * z + ringPulse, 9 * z + ringPulse * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }



    // Procedural pixel-art heroes (all classes, all actions)
    if (this.usePixelHeroes()) {
      this.drawPixelHero(ctx, player, isLocal, screen, z, t);
      return;
    }

    // Authentic 8-Directional Pixel Art Swordman (Warrior) with Full 360-degree rotation
    if (player.characterClass === 'warrior') {
      this.drawSwordman(ctx, player, isLocal, screen, z, t);
      return;
    }

    // Authentic Pixel Art Archmage (Mage) with Levitation, Arcane Burst, Blink & Staff Run
    if (player.characterClass === 'mage') {
      this.drawMage(ctx, player, isLocal, screen, z, t);
      return;
    }

    // Authentic Pixel Art Rogue (Rogue) with Dagger Flip, Cross Slash, Shadow Dive & Ninja Sprint
    if (player.characterClass === 'rogue') {
      this.drawRogue(ctx, player, isLocal, screen, z, t);
      return;
    }

    ctx.save();
    // Anchor at player center-ground
    ctx.translate(screen.x, screen.y - 14 * z - walkBob);
    if (isFacingLeft) ctx.scale(-1, 1);

    // Attack state
    const attackProg = isAttacking ? (performance.now() - attack.time) / attack.duration : 0;
    const attackLean = isAttacking ? Math.sin(attackProg * Math.PI) * 6 * z : 0;

    // Skin Palette
    const skinBase = '#fec89a';
    const skinShadow = '#f4a261';
    const skinBlush = 'rgba(244, 63, 94, 0.25)';

    // =========================================================================
    // LAYER 1: BACK CAPE / BACK COWL
    // =========================================================================
    if (player.characterClass === 'warrior') {
      const capeWave = Math.sin(t * 6 + (isMoving ? 3 : 0)) * (isMoving ? 7 : 3) * z;
      ctx.save();
      if (isBackView) {
        // Back View: Majestic Full Crimson Cape draped across the back
        ctx.beginPath();
        ctx.moveTo(-9 * z + attackLean, -18 * z);
        ctx.lineTo(9 * z + attackLean, -18 * z);
        ctx.quadraticCurveTo(13 * z + capeWave, 0, 11 * z + capeWave, 18 * z);
        ctx.lineTo(-11 * z + capeWave, 18 * z);
        ctx.quadraticCurveTo(-13 * z + capeWave, 0, -9 * z + attackLean, -18 * z);
        ctx.closePath();
        ctx.fillStyle = '#991b1b'; // Deep royal crimson
        ctx.fill();

        // Inner Fold Shadows
        ctx.beginPath();
        ctx.moveTo(-4 * z + attackLean, -16 * z);
        ctx.quadraticCurveTo(-2 * z + capeWave * 0.5, 0, -3 * z + capeWave * 0.7, 18 * z);
        ctx.lineTo(0 + capeWave * 0.7, 18 * z);
        ctx.quadraticCurveTo(1 * z + capeWave * 0.5, 0, 0 + attackLean, -16 * z);
        ctx.closePath();
        ctx.fillStyle = '#7f1d1d';
        ctx.fill();

        // Golden Brooches at shoulders
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(-8 * z + attackLean, -17 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.arc(8 * z + attackLean, -17 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Front View: Crimson Cape billows behind shoulders with golden clasp brooches
        ctx.beginPath();
        ctx.moveTo(-8 * z + attackLean, -18 * z);
        ctx.lineTo(-2 * z + attackLean, -18 * z);
        ctx.quadraticCurveTo(-11 * z + capeWave, 0, -14 * z + capeWave, 17 * z);
        ctx.lineTo(-5 * z + capeWave, 18 * z);
        ctx.quadraticCurveTo(-3 * z, 0, 0 + attackLean, -17 * z);
        ctx.closePath();
        ctx.fillStyle = '#991b1b';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(2 * z + attackLean, -18 * z);
        ctx.lineTo(8 * z + attackLean, -18 * z);
        ctx.quadraticCurveTo(11 * z - capeWave, 0, 14 * z - capeWave, 17 * z);
        ctx.lineTo(5 * z - capeWave, 18 * z);
        ctx.quadraticCurveTo(3 * z, 0, 0 + attackLean, -17 * z);
        ctx.closePath();
        ctx.fillStyle = '#991b1b';
        ctx.fill();

        // Golden Shoulder Clasp Brooches
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(-7 * z + attackLean, -17 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.arc(7 * z + attackLean, -17 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

    } else if (player.characterClass === 'rogue') {
      const scarfWave = Math.sin(t * 7) * (isMoving ? 8 : 4) * z;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-5 * z + attackLean, -20 * z);
      ctx.quadraticCurveTo(-14 * z + scarfWave, -14 * z, -20 * z + scarfWave * 1.2, -6 * z);
      ctx.lineTo(-17 * z + scarfWave, -4 * z);
      ctx.quadraticCurveTo(-10 * z + scarfWave * 0.8, -16 * z, -3 * z + attackLean, -19 * z);
      ctx.closePath();
      ctx.fillStyle = '#6b21a8';
      ctx.fill();
      ctx.restore();
    }

    // =========================================================================
    // LAYER 2: LEGS & FEET (Natural Human Thighs, Knees, Boots)
    // =========================================================================
    const hasWingedBoots = player.equipment && player.equipment.boots && player.equipment.boots.id === 'winged_boots';

    // Left Leg (Back Leg)
    ctx.save();
    ctx.translate(-4 * z, -2 * z);
    ctx.rotate(legL_Angle);
    // Blue under-tunic rim
    if (player.characterClass === 'warrior') {
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(-2.5 * z, -1 * z, 5 * z, 3 * z);
    }
    // Thigh / Pants
    ctx.fillStyle = player.characterClass === 'warrior' ? '#1e293b' : player.characterClass === 'mage' ? '#1e1b4b' : '#0f172a';
    ctx.fillRect(-2.5 * z, 0, 5 * z, 8 * z);
    // Knee pad / Greave (Polished Steel)
    ctx.fillStyle = player.characterClass === 'warrior' ? '#64748b' : '#334155';
    ctx.fillRect(-2.5 * z, 5 * z, 5 * z, 4 * z);
    if (player.characterClass === 'warrior') {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-1.5 * z, 5.5 * z, 3 * z, 2 * z);
    }
    // Boot / Foot (Rich Brown Leather Riding Boots for Warrior)
    ctx.fillStyle = hasWingedBoots ? '#e0f2fe' : (player.characterClass === 'warrior' ? '#78350f' : '#1e293b');
    ctx.fillRect(-3 * z, 8 * z, 6 * z, 6 * z);
    // Folded Leather Cuff at Top of Boot
    if (player.characterClass === 'warrior') {
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-3.5 * z, 7.5 * z, 7 * z, 2.5 * z);
    }
    // Sole
    ctx.fillStyle = player.characterClass === 'warrior' ? '#1c0d02' : '#0f172a';
    ctx.fillRect(-3.5 * z, 13 * z, 7 * z, 2 * z);
    ctx.restore();

    // Right Leg (Front Leg)
    ctx.save();
    ctx.translate(4 * z, -2 * z);
    ctx.rotate(legR_Angle);
    if (player.characterClass === 'warrior') {
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(-2.5 * z, -1 * z, 5 * z, 3 * z);
    }
    ctx.fillStyle = player.characterClass === 'warrior' ? '#1e293b' : player.characterClass === 'mage' ? '#1e1b4b' : '#0f172a';
    ctx.fillRect(-2.5 * z, 0, 5 * z, 8 * z);
    ctx.fillStyle = player.characterClass === 'warrior' ? '#64748b' : '#334155';
    ctx.fillRect(-2.5 * z, 5 * z, 5 * z, 4 * z);
    if (player.characterClass === 'warrior') {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-1.5 * z, 5.5 * z, 3 * z, 2 * z);
    }
    ctx.fillStyle = hasWingedBoots ? '#e0f2fe' : (player.characterClass === 'warrior' ? '#78350f' : '#1e293b');
    ctx.fillRect(-2.5 * z, 8 * z, 6 * z, 6 * z);
    if (player.characterClass === 'warrior') {
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-3 * z, 7.5 * z, 7 * z, 2.5 * z);
    }
    ctx.fillStyle = player.characterClass === 'warrior' ? '#1c0d02' : '#0f172a';
    ctx.fillRect(-3 * z, 13 * z, 7.5 * z, 2 * z);

    // Winged Boots feather embellishment
    if (hasWingedBoots) {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(-4 * z, 9 * z);
      ctx.lineTo(-8 * z, 6 * z);
      ctx.lineTo(-6 * z, 12 * z);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // =========================================================================
    // LAYER 3: TORSO, BELT & CLOTHING (Front vs Back)
    // =========================================================================
    ctx.save();
    ctx.translate(attackLean, 0);

    // Hips & Waistline
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-6.5 * z, -4 * z, 13 * z, 4 * z);

    // Leather Belt & Golden Buckle
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-7 * z, -6 * z, 14 * z, 2.8 * z);
    if (!isBackView) {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-2 * z, -6.5 * z, 4 * z, 3.8 * z);
    }

    // Human Torso Shape (Tapered from shoulders to waist)
    if (player.characterClass === 'warrior') {
      if (isBackView) {
        // Back View: Solid Steel Backplate & Spine Guard with Blue Tunic Trim
        ctx.fillStyle = '#1d4ed8'; // Blue under-tunic trim
        ctx.fillRect(-7.5 * z, -4 * z, 15 * z, 2.5 * z);

        ctx.fillStyle = '#334155'; // Backplate
        ctx.beginPath();
        ctx.moveTo(-8 * z, -18 * z);
        ctx.lineTo(8 * z, -18 * z);
        ctx.lineTo(6.5 * z, -4 * z);
        ctx.lineTo(-6.5 * z, -4 * z);
        ctx.closePath();
        ctx.fill();

        // Spine Ridge
        ctx.fillStyle = '#475569';
        ctx.fillRect(-2 * z, -17 * z, 4 * z, 12 * z);
      } else {
        // Front View: Royal Blue Gambeson, Chainmail Hauberk & Polished Steel Cuirass
        // 1. Royal Blue Under-Tunic Skirt
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(-7.5 * z, -4 * z, 15 * z, 3 * z);

        // 2. Chainmail Hauberk Midriff
        ctx.fillStyle = '#475569';
        ctx.fillRect(-7 * z, -8 * z, 14 * z, 5 * z);
        // Mail ring accents
        ctx.fillStyle = '#334155';
        ctx.fillRect(-6 * z, -7 * z, 12 * z, 1.2 * z);
        ctx.fillRect(-5 * z, -5.2 * z, 10 * z, 1.2 * z);

        // 3. Steel Breastplate (Cuirass)
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(-8 * z, -18 * z);
        ctx.lineTo(8 * z, -18 * z);
        ctx.lineTo(6.5 * z, -8 * z);
        ctx.lineTo(-6.5 * z, -8 * z);
        ctx.closePath();
        ctx.fill();

        // Steel Pec Plates & Contour
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.ellipse(-3 * z, -14 * z, 3.2 * z, 2.5 * z, 0, 0, Math.PI * 2);
        ctx.ellipse(3 * z, -14 * z, 3.2 * z, 2.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Central Breastplate Ridge Highlight
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(-0.8 * z, -17.5 * z, 1.6 * z, 9 * z);

        // Royal Blue Gorget / Neck Border
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.moveTo(-5 * z, -18 * z);
        ctx.lineTo(5 * z, -18 * z);
        ctx.lineTo(3 * z, -16 * z);
        ctx.lineTo(-3 * z, -16 * z);
        ctx.closePath();
        ctx.fill();
      }

    } else if (player.characterClass === 'mage') {
      if (isBackView) {
        // Back View: Flowing Deep Violet Silk Robe
        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath();
        ctx.moveTo(-7 * z, -18 * z);
        ctx.lineTo(7 * z, -18 * z);
        ctx.lineTo(8.5 * z, -3 * z);
        ctx.lineTo(-8.5 * z, -3 * z);
        ctx.closePath();
        ctx.fill();

        // Astral Star Emblem on Back
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(0, -10 * z, 3.5 * z, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Front View: Layered Arcane Silk Robes with Golden Stole
        ctx.fillStyle = '#2e1065';
        ctx.beginPath();
        ctx.moveTo(-7 * z, -18 * z);
        ctx.lineTo(7 * z, -18 * z);
        ctx.lineTo(8.5 * z, -3 * z);
        ctx.lineTo(-8.5 * z, -3 * z);
        ctx.closePath();
        ctx.fill();

        // Starlight Golden Trim
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-1.5 * z, -18 * z, 3 * z, 14 * z);
        ctx.fillRect(-7 * z, -5 * z, 14 * z, 2 * z);
      }

    } else if (player.characterClass === 'rogue') {
      if (isBackView) {
        // Back View: Tactical Leather Doublet with Crossed Scabbard Straps
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(-7.5 * z, -18 * z);
        ctx.lineTo(7.5 * z, -18 * z);
        ctx.lineTo(6 * z, -6 * z);
        ctx.lineTo(-6 * z, -6 * z);
        ctx.closePath();
        ctx.fill();

        // Crossed Leather Dagger Frogs
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2 * z;
        ctx.beginPath();
        ctx.moveTo(-6 * z, -16 * z);
        ctx.lineTo(5 * z, -8 * z);
        ctx.moveTo(6 * z, -16 * z);
        ctx.lineTo(-5 * z, -8 * z);
        ctx.stroke();
      } else {
        // Front View: Fitted Tactical Leather Tunic with Potion Vials
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(-7.5 * z, -18 * z);
        ctx.lineTo(7.5 * z, -18 * z);
        ctx.lineTo(6 * z, -6 * z);
        ctx.lineTo(-6 * z, -6 * z);
        ctx.closePath();
        ctx.fill();

        // Leather Harness Straps
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 1.8 * z;
        ctx.beginPath();
        ctx.moveTo(-6 * z, -18 * z);
        ctx.lineTo(5 * z, -6 * z);
        ctx.stroke();

        // Potion Vials on Chest Straps
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-5 * z, -13 * z, 2.5 * z, 4 * z);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(2.5 * z, -11 * z, 2.5 * z, 4 * z);
      }
    }

    // Human Neck
    ctx.fillStyle = skinShadow;
    ctx.fillRect(-2.5 * z, -21 * z, 5 * z, 4 * z);
    ctx.restore(); // End Layer 3 Torso

    // =========================================================================
    // LAYER 4: SHOULDERS & ARMS (Left Arm / Two-Handed Stance)
    // =========================================================================
    ctx.save();
    ctx.translate(-7 * z + attackLean, -17 * z);
    ctx.rotate(armL_Angle);

    // Pauldron / Shoulder Guard
    ctx.fillStyle = player.characterClass === 'warrior' ? '#64748b' : player.characterClass === 'mage' ? '#4c1d95' : '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, 4.2 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = player.characterClass === 'warrior' ? '#94a3b8' : '#f59e0b';
    ctx.lineWidth = 1 * z;
    ctx.stroke();

    if (player.characterClass === 'warrior') {
      // Left Arm: Royal Blue sleeve, Chainmail, Brown Leather Gauntlet (Two-Handed Stance)
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(-1.5 * z, 1.5 * z, 3 * z, 3 * z);
      ctx.fillStyle = '#475569';
      ctx.fillRect(-1.5 * z, 4.5 * z, 3 * z, 2.5 * z);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-2 * z, 7 * z, 4 * z, 2 * z);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-1.8 * z, 8.8 * z, 3.6 * z, 3 * z);
      // Left hand curves inward to support the bastard sword hilt
    } else {
      // Forearm & Hand
      ctx.fillStyle = skinBase;
      ctx.fillRect(-1.5 * z, 2 * z, 3 * z, 7 * z);
    }

    // =========================================================================
    // LAYER 5: HUMAN HEAD, FACE, HELMET & HAIR
    // =========================================================================
    ctx.save();
    ctx.translate(attackLean, -26 * z);

    if (player.characterClass === 'warrior') {
      if (isBackView) {
        // BACK VIEW: Full Polished Steel Barbute / Sallet Helmet
        // Steel Dome
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(0, 0, 8.5 * z, 0, Math.PI * 2);
        ctx.fill();

        // Metallic Dome Highlight
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.ellipse(-2 * z, -2 * z, 5 * z, 4.5 * z, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Central Raised Helmet Crest Ridge
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(-1.2 * z, -8.5 * z, 2.4 * z, 17 * z);

        // Flared Steel Neck Guard / Aventail
        ctx.beginPath();
        ctx.moveTo(-7 * z, 3 * z);
        ctx.quadraticCurveTo(-8.5 * z, 9 * z, -6 * z, 12 * z);
        ctx.lineTo(6 * z, 12 * z);
        ctx.quadraticCurveTo(8.5 * z, 9 * z, 7 * z, 3 * z);
        ctx.closePath();
        ctx.fillStyle = '#334155';
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1 * z;
        ctx.stroke();

      } else {
        // FRONT VIEW: Steel Barbute Helmet with Central Crest, Nasal Guard & Determined Eyes
        // 1. Helmet Base Dome
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(0, 0, 8.5 * z, 0, Math.PI * 2);
        ctx.fill();

        // Metallic Dome Highlight
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.ellipse(-2.5 * z, -2.5 * z, 5 * z, 4 * z, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Central Raised Helmet Crest Ridge
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(-1.2 * z, -8.5 * z, 2.4 * z, 9 * z);

        // 2. Facial Opening
        ctx.fillStyle = skinBase;
        ctx.fillRect(-4.5 * z, -1 * z, 9 * z, 6.5 * z);

        // Eyes & Brows
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-4 * z, 0, 3 * z, 1 * z);
        ctx.fillRect(1 * z, 0, 3 * z, 1 * z);

        ctx.fillStyle = '#0284c7'; // Blue warrior eyes
        ctx.fillRect(-3.5 * z, 1.5 * z, 2 * z, 1.5 * z);
        ctx.fillRect(1.5 * z, 1.5 * z, 2 * z, 1.5 * z);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-3 * z, 1.5 * z, 0.8 * z, 0.8 * z);
        ctx.fillRect(2 * z, 1.5 * z, 0.8 * z, 0.8 * z);

        // 3. Steel Cheek Guards & Nasal Guard
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(-8.5 * z, -1 * z);
        ctx.lineTo(-4.5 * z, -1 * z);
        ctx.lineTo(-3.5 * z, 7 * z);
        ctx.lineTo(-6 * z, 8 * z);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(8.5 * z, -1 * z);
        ctx.lineTo(4.5 * z, -1 * z);
        ctx.lineTo(3.5 * z, 7 * z);
        ctx.lineTo(6 * z, 8 * z);
        ctx.closePath();
        ctx.fill();

        // Nasal Guard
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.moveTo(-1.2 * z, -1 * z);
        ctx.lineTo(1.2 * z, -1 * z);
        ctx.lineTo(1 * z, 4 * z);
        ctx.lineTo(0, 5.5 * z);
        ctx.lineTo(-1 * z, 4 * z);
        ctx.closePath();
        ctx.fill();

        // Brow Rim Trim
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-6.5 * z, -1.8 * z, 13 * z, 1.4 * z);
      }

    } else {
      // Hair Colors for Mage and Rogue
      const hairColor = player.characterClass === 'mage' ? '#e2e8f0' : '#1e1b4b';
      const hairHighlight = player.characterClass === 'mage' ? '#ffffff' : '#818cf8';

      if (isBackView) {
        ctx.fillStyle = hairColor;
        ctx.beginPath();
        ctx.arc(0, 0, 8.5 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-7.5 * z, 0);
        ctx.quadraticCurveTo(-9.5 * z, 7 * z, -6 * z, 12 * z);
        ctx.lineTo(6 * z, 12 * z);
        ctx.quadraticCurveTo(9.5 * z, 7 * z, 7.5 * z, 0);
        ctx.closePath();
        ctx.fillStyle = hairColor;
        ctx.fill();

        ctx.fillStyle = hairHighlight;
        ctx.fillRect(-2.5 * z, -2 * z, 5 * z, 7 * z);

        if (player.characterClass === 'mage') {
          ctx.fillStyle = '#3b0764';
          ctx.beginPath();
          ctx.ellipse(0, -4.5 * z, 11 * z, 4.5 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(-7 * z, -4.5 * z);
          ctx.lineTo(7 * z, -4.5 * z);
          ctx.lineTo(2 * z, -22 * z);
          ctx.closePath();
          ctx.fillStyle = '#2e1065';
          ctx.fill();

          ctx.fillStyle = '#facc15';
          ctx.fillRect(-6 * z, -7 * z, 12 * z, 2.5 * z);

        } else if (player.characterClass === 'rogue') {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-6.5 * z, -4.5 * z, 13 * z, 2.8 * z);
          ctx.fillRect(-2 * z, -3.5 * z, 4 * z, 3 * z);

          const tailWave1 = Math.sin(t * 8) * 4 * z;
          const tailWave2 = Math.cos(t * 7) * 4 * z;
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2 * z;
          ctx.beginPath();
          ctx.moveTo(-1 * z, -3 * z);
          ctx.quadraticCurveTo(-6 * z + tailWave1, 3 * z, -12 * z + tailWave1 * 1.2, 9 * z);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(1 * z, -3 * z);
          ctx.quadraticCurveTo(-3 * z + tailWave2, 5 * z, -8 * z + tailWave2 * 1.1, 12 * z);
          ctx.stroke();
        }

      } else {
        // Front View of Mage / Rogue
        ctx.fillStyle = hairColor;
        ctx.beginPath();
        ctx.arc(0, 0, 8.5 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = skinBase;
        ctx.beginPath();
        ctx.arc(0, 1 * z, 6.8 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = skinBlush;
        ctx.beginPath();
        ctx.arc(-3.8 * z, 2.8 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.arc(3.8 * z, 2.8 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = skinBase;
        ctx.beginPath();
        ctx.arc(-6.5 * z, 1.5 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.arc(6.5 * z, 1.5 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.fill();

        const eyeIrisColor = player.characterClass === 'mage' ? '#8b5cf6' : '#16a34a';
        const drawEye = (ex, ey) => {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(ex - 2.5 * z, ey - 2.5 * z, 5 * z, 1.3 * z);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(ex - 2 * z, ey - 1.2 * z, 4 * z, 3 * z);
          ctx.fillStyle = eyeIrisColor;
          ctx.fillRect(ex - 1.2 * z, ey - 1.2 * z, 2.8 * z, 3 * z);
          ctx.fillStyle = '#09090b';
          ctx.fillRect(ex - 0.7 * z, ey - 0.7 * z, 1.8 * z, 2 * z);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(ex - 0.3 * z, ey - 1.0 * z, 1.0 * z, 1.0 * z);
        };

        if (isDirectSouth) {
          drawEye(-2.5 * z, 1 * z);
          drawEye(2.5 * z, 1 * z);
        } else if (isDirectSide) {
          drawEye(2.0 * z, 1 * z);
        } else {
          drawEye(-1.5 * z, 1 * z);
          drawEye(3.0 * z, 1 * z);
        }

        ctx.fillStyle = '#b45309';
        ctx.fillRect(-1.2 * z, 5.5 * z, 2.4 * z, 0.9 * z);

        if (player.characterClass === 'rogue') {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.moveTo(-5.5 * z, 3.2 * z);
          ctx.lineTo(5.5 * z, 3.2 * z);
          ctx.lineTo(4 * z, 7.8 * z);
          ctx.lineTo(0, 9 * z);
          ctx.lineTo(-4 * z, 7.8 * z);
          ctx.closePath();
          ctx.fill();
        }

        ctx.fillStyle = hairColor;
        ctx.beginPath();
        ctx.moveTo(-6 * z, -3 * z);
        ctx.lineTo(-3 * z, 0 * z);
        ctx.lineTo(-1 * z, -2 * z);
        ctx.lineTo(2 * z, 0.5 * z);
        ctx.lineTo(4 * z, -2 * z);
        ctx.lineTo(6.5 * z, -1 * z);
        ctx.lineTo(6 * z, -5 * z);
        ctx.lineTo(-6 * z, -5 * z);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = hairHighlight;
        ctx.fillRect(-3 * z, -4.5 * z, 6 * z, 1.2 * z);

        if (player.characterClass === 'mage') {
          ctx.fillStyle = '#3b0764';
          ctx.beginPath();
          ctx.ellipse(0, -4.5 * z, 11 * z, 4.5 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(-7 * z, -4.5 * z);
          ctx.lineTo(7 * z, -4.5 * z);
          ctx.lineTo(2 * z, -22 * z);
          ctx.closePath();
          ctx.fillStyle = '#2e1065';
          ctx.fill();

          ctx.fillStyle = '#facc15';
          ctx.fillRect(-6 * z, -7 * z, 12 * z, 2.5 * z);
          ctx.beginPath();
          ctx.arc(2 * z, -22 * z, 2.8 * z, 0, Math.PI * 2);
          ctx.fillStyle = '#38bdf8';
          ctx.fill();

        } else if (player.characterClass === 'rogue') {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-6.5 * z, -4.5 * z, 13 * z, 2.8 * z);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(-3 * z, -4.5 * z, 6 * z, 2.2 * z);
        }
      }
    }

    ctx.restore(); // End Layer 5 Head

    // =========================================================================
    // LAYER 6: RIGHT ARM & WEAPON
    // =========================================================================
    ctx.save();
    ctx.translate(7 * z + attackLean, -16 * z);

    // Right Pauldron
    ctx.fillStyle = player.characterClass === 'warrior' ? '#64748b' : player.characterClass === 'mage' ? '#4c1d95' : '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = player.characterClass === 'warrior' ? '#94a3b8' : '#f59e0b';
    ctx.lineWidth = 1 * z;
    ctx.stroke();

    if (player.characterClass === 'warrior') {
      // Right Arm: Blue sleeve, Chainmail, Brown Leather Gauntlet
      ctx.rotate(armR_Angle);
      ctx.fillStyle = '#2563eb'; // Royal blue sleeve
      ctx.fillRect(-1.5 * z, 1.5 * z, 3 * z, 3 * z);
      ctx.fillStyle = '#475569'; // Chainmail elbow
      ctx.fillRect(-1.5 * z, 4.5 * z, 3 * z, 2.5 * z);
      ctx.fillStyle = '#92400e'; // Brown leather cuff
      ctx.fillRect(-2 * z, 7 * z, 4 * z, 2 * z);
      ctx.fillStyle = '#78350f'; // Brown leather hand
      ctx.beginPath();
      ctx.arc(0, 9.5 * z, 2.2 * z, 0, Math.PI * 2);
      ctx.fill();

      // TWO-HANDED BASTARD SWORD
      ctx.save();
      if (isAttacking) {
        // Dynamic Two-Handed Cleaving Strike
        const swingAngle = -1.4 + Math.sin(attackProg * Math.PI) * 2.9;
        ctx.translate(0, 9.5 * z);
        ctx.rotate(swingAngle);

        // Long Two-Handed Leather Grip
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-1.2 * z, -2 * z, 2.4 * z, 9 * z);
        // Steel Pommel
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(0, 7.5 * z, 2.2 * z, 0, Math.PI * 2);
        ctx.fill();

        // Steel Crossguard with flared quillons
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-7 * z, -3.5 * z, 14 * z, 2.8 * z);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-6.5 * z, -3 * z, 13 * z, 1.5 * z);

        // Double-Edged Bastard Sword Blade
        ctx.fillStyle = '#cbd5e1'; // Blade face
        ctx.fillRect(-2.2 * z, -32 * z, 4.4 * z, 29 * z);
        ctx.fillStyle = '#f8fafc'; // Sharp edge highlight
        ctx.fillRect(-1.8 * z, -32 * z, 1 * z, 29 * z);
        // Central Fuller Groove
        ctx.fillStyle = '#475569';
        ctx.fillRect(-0.5 * z, -30 * z, 1 * z, 25 * z);
        // Sharp Tip
        ctx.beginPath();
        ctx.moveTo(-2.2 * z, -32 * z);
        ctx.lineTo(2.2 * z, -32 * z);
        ctx.lineTo(0, -36 * z);
        ctx.closePath();
        ctx.fillStyle = '#f8fafc';
        ctx.fill();

        // Slashing Blade Arc Trail
        ctx.beginPath();
        ctx.arc(0, -20 * z, 30 * z, -0.9, 1.5);
        ctx.strokeStyle = `rgba(224, 242, 254, ${0.92 * (1 - attackProg)})`;
        ctx.lineWidth = 5 * z;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -20 * z, 28 * z, -0.8, 1.4);
        ctx.strokeStyle = `rgba(245, 158, 11, ${0.8 * (1 - attackProg)})`;
        ctx.lineWidth = 2.5 * z;
        ctx.stroke();

      } else {
        // Majestic Two-Handed Ready Guard Stance (Angled across chest like reference image!)
        ctx.translate(0, 9.5 * z);
        ctx.rotate(-0.45); // Tilted forward in front guard

        // Two-handed leather grip
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-1.2 * z, 0, 2.4 * z, 8 * z);
        // Steel Pommel
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(0, 8.5 * z, 2 * z, 0, Math.PI * 2);
        ctx.fill();

        // Steel Crossguard
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-6 * z, -2 * z, 12 * z, 2.5 * z);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-5.5 * z, -1.8 * z, 11 * z, 1.2 * z);

        // Bastard Blade Body
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(-2 * z, -28 * z, 4 * z, 26 * z);
        // Central fuller groove
        ctx.fillStyle = '#475569';
        ctx.fillRect(-0.5 * z, -26 * z, 1 * z, 22 * z);
        // Edge highlight
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-1.8 * z, -28 * z, 0.8 * z, 26 * z);
        // Tip
        ctx.beginPath();
        ctx.moveTo(-2 * z, -28 * z);
        ctx.lineTo(2 * z, -28 * z);
        ctx.lineTo(0, -32 * z);
        ctx.closePath();
        ctx.fillStyle = '#f8fafc';
        ctx.fill();
      }
      ctx.restore();

    } else if (player.characterClass === 'mage') {
      // Archmage Staff
      const staffThrust = isAttacking ? Math.sin(attackProg * Math.PI) * 14 * z : 0;
      ctx.translate(staffThrust, -staffThrust * 0.2);

      // Hand gripping staff
      ctx.fillStyle = skinBase;
      ctx.beginPath();
      ctx.arc(2 * z, 6 * z, 2.2 * z, 0, Math.PI * 2);
      ctx.fill();

      // Elderwood Staff
      ctx.fillStyle = '#78350f';
      ctx.fillRect(1 * z, -28 * z, 3.5 * z, 38 * z);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, -26 * z, 5.5 * z, 2.5 * z);

      // Arcane Crystal Core
      const crystalPulse = Math.sin(t * 8) * 2 * z;
      ctx.beginPath();
      ctx.arc(2.5 * z, -30 * z, 5.5 * z + crystalPulse, 0, Math.PI * 2);
      ctx.fillStyle = isAttacking ? '#facc15' : '#06b6d4';
      ctx.fill();

      // Cast Burst
      if (isAttacking) {
        ctx.beginPath();
        ctx.arc(2.5 * z, -30 * z, 20 * z * (1 - attackProg), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(250, 204, 21, ${0.9 * (1 - attackProg)})`;
        ctx.lineWidth = 3 * z;
        ctx.stroke();
      }

    } else if (player.characterClass === 'rogue') {
      // Right Hand Dagger
      const stabRight = isAttacking ? Math.sin(attackProg * Math.PI * 2) * 14 * z : 0;

      // Hand
      ctx.fillStyle = skinBase;
      ctx.beginPath();
      ctx.arc(stabRight, 6 * z, 2.2 * z, 0, Math.PI * 2);
      ctx.fill();

      // Obsidian Dagger
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-1.5 * z + stabRight, -14 * z, 3 * z, 20 * z);
      ctx.fillStyle = '#4ade80'; // Toxic edge
      ctx.fillRect(0.5 * z + stabRight, -13 * z, 1.2 * z, 18 * z);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-3 * z + stabRight, 4 * z, 6 * z, 2.5 * z);

      if (isAttacking) {
        ctx.beginPath();
        ctx.moveTo(-10 * z, -20 * z);
        ctx.lineTo(16 * z + stabRight, 6 * z);
        ctx.strokeStyle = `rgba(74, 222, 128, ${0.9 * (1 - attackProg)})`;
        ctx.lineWidth = 3.5 * z;
        ctx.stroke();
      }
    }

    ctx.restore(); // End Right Arm
    ctx.restore(); // End Player coordinate space (Line 1084)

    // Nametag, Guild Badge & Mini HP Bar
    this.drawEntityOverhead(ctx, screen.x, screen.y - 50 * z, this.playerTitledName(player), player.hp, player.maxHp, this.playerNameColor(player), `Lv.${player.level}`);

    // Speech Bubble
    if (player.speechBubble) {
      this.drawSpeechBubble(ctx, screen.x, screen.y - 74 * z, player.speechBubble);
    }
  }

  // Authentic 8-Directional Pixel Art Swordman Renderer (Full 360-Degree Rotation, Idle, Attack Slash, Dash & Walk Gait)
  usePixelHeroes() {
    return !!window.PixelHeroes;
  }

  // Draw one sprite frame anchored at its feet, optionally mirrored / tinted
  drawPixelHeroFrame(ctx, frame, x, y, s, flip, alpha = 1, tint = null, tintAlpha = 0) {
    const PH = window.PixelHeroes;
    let src = frame;
    if (tint) {
      if (!this._pixelTintCanvas) {
        this._pixelTintCanvas = document.createElement('canvas');
        this._pixelTintCanvas.width = PH.W;
        this._pixelTintCanvas.height = PH.H;
      }
      const g = this._pixelTintCanvas.getContext('2d');
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, PH.W, PH.H);
      g.drawImage(frame, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = tintAlpha;
      g.fillStyle = tint;
      g.fillRect(0, 0, PH.W, PH.H);
      g.globalAlpha = 1;
      src = this._pixelTintCanvas;
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(src, -PH.AX * s, -PH.AY * s, PH.W * s, PH.H * s);
    ctx.restore();
  }

  drawPixelHero(ctx, player, isLocal, screen, z, t) {
    const PH = window.PixelHeroes;
    if (!PH.ready) PH.init();
    const now = performance.now();
    const cls = PH.classes.includes(player.characterClass) ? player.characterClass : 'warrior';

    // Death / damage bookkeeping from the replicated state
    if (player.isDead) {
      if (!player._deathAt) player._deathAt = now;
    } else {
      player._deathAt = 0;
      if (player._lastHp !== undefined && player.hp < player._lastHp) player._hurtAt = now;
    }
    player._lastHp = player.hp;

    const attack = this.attacks.get(player.id);
    const isAttacking = !!attack && now - attack.time < attack.duration;
    const dash = this.dashes.get(player.id);
    const isDashing = !!dash && now - dash.time < dash.duration;
    const cast = this.casts.get(player.id);
    const isCasting = !!cast && now - cast.time < cast.duration;
    const hurtAge = player._hurtAt ? now - player._hurtAt : Infinity;

    const progIdx = (action, start, dur) => {
      const n = PH.meta(cls, action).frames;
      return Math.min(n - 1, Math.floor(((now - start) / dur) * n));
    };
    let action, idx;
    if (player.isDead) { action = 'death'; idx = progIdx('death', player._deathAt, PIXEL_HERO_DEATH_MS); }
    else if (isDashing) { action = 'dash'; idx = progIdx('dash', dash.time, dash.duration); }
    else if (isAttacking) { action = attack.side < 0 ? 'attack2' : 'attack'; idx = progIdx(action, attack.time, attack.duration); }
    else if (isCasting) { action = 'cast'; idx = progIdx('cast', cast.time, cast.duration); }
    else if (hurtAge < PIXEL_HERO_HURT_MS) { action = 'hurt'; idx = progIdx('hurt', player._hurtAt, PIXEL_HERO_HURT_MS); }
    else if (player.isMoving) { action = 'run'; idx = Math.floor(t * 14) % PH.meta(cls, 'run').frames; }
    else { action = 'idle'; idx = Math.floor(t * 6) % PH.meta(cls, 'idle').frames; }

    const facing = (isAttacking && attack.facing) ? attack.facing
      : ((isDashing && dash.facing) ? dash.facing : (player.facing || 'S'));
    // Five drawn views; the west-facing ones mirror their east twins
    const flip = facing === 'W' || facing === 'SW' || facing === 'NW';
    const view = PIXEL_HERO_VIEW[facing] || 'S';
    const frame = this.heroFrameFor(player, view, action, idx);
    const s = PIXEL_HERO_SCALE * z;
    const x = Math.round(screen.x), y = Math.round(screen.y);

    // Dash afterimages: remember recent poses in world space, draw them fading out
    player._pixelGhosts = player._pixelGhosts || [];
    if (isDashing && (!player._pixelGhostAt || now - player._pixelGhostAt > 45)) {
      player._pixelGhostAt = now;
      player._pixelGhosts.unshift({ wx: player.x, wy: player.y, frame, flip, time: now });
      if (player._pixelGhosts.length > 5) player._pixelGhosts.pop();
    }
    const ghostTint = cls === 'mage' ? '#67e8f9' : cls === 'rogue' ? '#4ade80' : '#bae6fd';
    for (const g of player._pixelGhosts) {
      const age = (now - g.time) / 300;
      if (age >= 1) continue;
      const gs = Isometric.worldToScreen(g.wx, g.wy, 0, this.camera, this.canvas.width, this.canvas.height);
      this.drawPixelHeroFrame(ctx, g.frame, Math.round(gs.x), Math.round(gs.y), s, g.flip, (1 - age) * 0.45, ghostTint, 0.65);
    }

    // Dust kicked up as each foot strikes the ground (run frames 0 and 4)
    const footfall = action === 'run' && idx % 4 === 0 ? idx : -1;
    if (footfall >= 0 && player._lastFootfall !== footfall) {
      this.addParticles(player.x, player.y, 'dust', 2, RUN_DUST_OPTS);
    }
    player._lastFootfall = footfall;

    // Body (red flash while recoiling from a hit), wrapped in the SP aura
    this.drawSpAura(ctx, player, x, y, z, t, 'back');
    const hurtFlash = action === 'hurt' ? 0.55 * (1 - hurtAge / PIXEL_HERO_HURT_MS) : 0;
    this.drawPixelHeroFrame(ctx, frame, x, y, s, flip, 1, hurtFlash > 0 ? '#ff3b3b' : null, hurtFlash);
    this.drawSpAura(ctx, player, x, y, z, t, 'front');

    // Additive glow on the mage orb and the rogue's venom blades
    const glowAt = (pt, color, radius) => {
      if (!pt) return;
      const gx = x + (flip ? -pt[0] : pt[0]) * s;
      const gy = y + pt[1] * s;
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = grad;
      ctx.fillRect(gx - radius, gy - radius, radius * 2, radius * 2);
      ctx.restore();
    };
    // (tinted with the SP card colour while transformed)
    const spCard = this.spCardFor(player);
    if (!player.isDead) {
      const pulse = 0.8 + 0.2 * Math.sin(t * 5);
      const strong = action === 'attack' || action === 'cast' || action === 'dash';
      if (cls === 'mage') {
        const a = strong ? 0.75 : 0.45 * pulse;
        glowAt(frame.meta.orb, spCard ? hexAlpha(spCard.color, a) : `rgba(103, 232, 249, ${a})`, (strong ? 16 : 10) * z);
      }
      if (cls === 'rogue') {
        const a = strong ? 0.6 : 0.3 * pulse;
        const c = spCard ? hexAlpha(spCard.color, a) : `rgba(74, 222, 128, ${a})`;
        glowAt(frame.meta.tipF, c, 6 * z);
        glowAt(frame.meta.tipB, c, 6 * z);
      }
      if (cls === 'warrior' && spCard && spCard.id === 'sp_dread_lord' && frame.meta.tip) {
        const a = strong ? 0.85 : 0.55 * pulse;
        glowAt(frame.meta.tip, `rgba(168, 85, 247, ${a})`, (strong ? 16 : 11) * z);
        // Dragging the heavy black-violet executioner axe across the ground throws void sparks
        if (player.isMoving && Math.random() < 0.38) {
          const tx = x + (flip ? -frame.meta.tip[0] : frame.meta.tip[0]) * s;
          const ty = y + frame.meta.tip[1] * s;
          const wp = Isometric.screenToWorld(tx, ty, this.camera, this.canvas.width, this.canvas.height);
          this.addParticles(wp.x, wp.y, Math.random() < 0.6 ? 'shadow' : 'slash', 1, { speed: 1.4, z: 0.08, sizeScale: 0.7 });
        }
      }
    }

    // Name tag & speech bubble sit just above this sprite's head
    if (!player.isDead) {
      const headY = y - (PH.AY - PH.headTop(cls, spCard && spCard.id)) * s;
      this.drawEntityOverhead(ctx, x, headY - 12 * z, this.playerTitledName(player), player.hp, player.maxHp, this.playerNameColor(player), `Lv.${player.level}`);
      if (player.speechBubble) this.drawSpeechBubble(ctx, x, headY - 36 * z, player.speechBubble);
    }
  }

  drawSwordman(ctx, player, isLocal, screen, z, t) {
    const isMoving = !!player.isMoving;

    // =========================================================================
    // STATE 1: DASH STATE (แดช / BLADE CHARGE)
    // =========================================================================
    const dash = this.dashes ? this.dashes.get(player.id) : null;
    const isDashing = dash && (performance.now() - dash.time < dash.duration);
    const dashProg = isDashing ? (performance.now() - dash.time) / dash.duration : 0;

    // =========================================================================
    // STATE 2: ATTACK / SWORD SLASH STATE (ฟันดาบ)
    // =========================================================================
    const attack = this.attacks ? this.attacks.get(player.id) : null;
    const isAttacking = attack && (performance.now() - attack.time < attack.duration);
    const attackProg = isAttacking ? (performance.now() - attack.time) / attack.duration : 0;

    // Facing direction: during attack or dash, lock facing towards targeted action direction!
    const facing = (isAttacking && attack.facing)
      ? attack.facing
      : ((isDashing && dash.facing) ? dash.facing : (player.facing || 'S'));

    const frames = IsometricRenderer.SWORDMAN_FRAMES;
    const frame = frames[facing] || frames.S;

    const baseScale = 0.205 * z;
    const splitY = frame.splitY || 228;
    const midX = frame.midX || 129;

    // Dynamic 8-Directional Lunge & Facing Vectors
    const lungeVecs = {
      S:  { x: 0,      y: 1.0 },
      SE: { x: 0.89,   y: 0.45 },
      E:  { x: 1.0,    y: 0.0 },
      NE: { x: 0.89,   y: -0.45 },
      N:  { x: 0,      y: -1.0 },
      NW: { x: -0.89,  y: -0.45 },
      W:  { x: -1.0,   y: 0.0 },
      SW: { x: -0.89,  y: 0.45 }
    };
    const lv = lungeVecs[facing] || lungeVecs.S;

    // Pose Offsets & Angles
    let lungeX = 0;
    let lungeY = 0;
    let poseTilt = 0;
    let verticalOffset = 0;

    if (isDashing) {
      // --- DASH POSE: Aerodynamic Piercing Stance ---
      const dashImpulse = Math.sin(dashProg * Math.PI);
      lungeX = lv.x * 15 * z * dashImpulse;
      lungeY = lv.y * 15 * z * dashImpulse;
      poseTilt = 0.36 * (lv.x >= 0 ? 1 : -1);
      verticalOffset = 4.0 * z; // Lower center of gravity into sprint

      // Record ghost afterimage trail positions
      player._dashTrail = player._dashTrail || [];
      player._dashTrail.unshift({
        x: screen.x + lungeX,
        y: screen.y + lungeY - verticalOffset,
        facing,
        time: performance.now()
      });
      if (player._dashTrail.length > 5) player._dashTrail.pop();

      // Spawn wind friction sparks along dash path
      if (Math.random() < 0.45) {
        this.addParticles(player.x, player.y, 'wind', 2);
        this.addParticles(player.x, player.y, 'slash', 1);
      }

    } else if (isAttacking) {
      // --- SWORD SLASH POSE: 3-Phase Cleaving Strike ---
      if (attackProg < 0.28) {
        // Phase 1: Heavy Windup - Coils back, bastard sword raised high
        const wp = attackProg / 0.28;
        lungeX = -lv.x * 5 * z * wp;
        lungeY = -lv.y * 5 * z * wp;
        poseTilt = -0.16 * wp * (lv.x >= 0 ? 1 : -1);
        verticalOffset = -1.5 * z * wp;
      } else if (attackProg <= 0.72) {
        // Phase 2: Cleave Strike - Explosive forward cleave lunge!
        const sp = (attackProg - 0.28) / 0.44;
        const strikeThrust = Math.sin(sp * Math.PI);
        lungeX = lv.x * 16 * z * strikeThrust;
        lungeY = lv.y * 16 * z * strikeThrust;
        poseTilt = 0.28 * strikeThrust * (lv.x >= 0 ? 1 : -1);
        verticalOffset = 2.0 * z * strikeThrust;
      } else {
        // Phase 3: Follow-through recovery
        const rp = (attackProg - 0.72) / 0.28;
        lungeX = lv.x * 8 * z * (1 - rp);
        lungeY = lv.y * 8 * z * (1 - rp);
        poseTilt = 0.12 * (1 - rp) * (lv.x >= 0 ? 1 : -1);
      }
    } else {
      // Clear dash trail when not dashing
      if (player._dashTrail && player._dashTrail.length > 0) {
        player._dashTrail = [];
      }
    }

    // Walking stride cadence (when moving and not attacking or dashing)
    const walkCycle = isMoving ? (t * 14) : 0;
    const stepCadence = Math.sin(walkCycle);

    const strideDist = (isMoving && !isAttacking && !isDashing) ? 3.8 * z : 0;
    const legL_stride = strideDist ? stepCadence : 0;
    const legR_stride = strideDist ? -stepCadence : 0;

    const legL_x = lv.x * legL_stride * strideDist;
    const legL_y = lv.y * legL_stride * strideDist * 0.5;
    const legL_lift = strideDist ? Math.max(0, -stepCadence) * 3.5 * z : 0;

    const legR_x = lv.x * legR_stride * strideDist;
    const legR_y = lv.y * legR_stride * strideDist * 0.5;
    const legR_lift = strideDist ? Math.max(0, stepCadence) * 3.5 * z : 0;

    // =========================================================================
    // STATE 3: IDLE STATE DYNAMICS (Breathing, Sway, Grounding)
    // =========================================================================
    const idleBreath = Math.sin(t * 3.0) * 0.9 * z;
    const idleSway = Math.sin(t * 2.0) * 0.015;

    const gaitBob = (isMoving && !isAttacking && !isDashing)
      ? (Math.abs(Math.sin(walkCycle)) * 2.4 * z)
      : (!isAttacking && !isDashing ? idleBreath : 0);

    const gaitSway = (isMoving && !isAttacking && !isDashing)
      ? (Math.sin(walkCycle) * 0.045)
      : (!isAttacking && !isDashing ? idleSway : 0);

    // Foot positions in screen space relative to anchor
    const footLRelX = (frame.footLX - frame.anchorX) * baseScale;
    const footRRelX = (frame.footRX - frame.anchorX) * baseScale;

    // Footstep ground dust puff when foot strikes the ground (Subtle & gentle)
    if (isMoving && !isAttacking && !isDashing && Math.abs(stepCadence) < 0.15 && Math.random() < 0.015) {
      this.addParticles(player.x, player.y, 'dust', 1, RUN_DUST_OPTS);
    }

    // =========================================================================
    // DUAL BOOT GROUND CONTACT SHADOWS & AMBIENT OCCLUSION
    // =========================================================================
    ctx.save();
    const shadowAngle = 0.28;

    // Ground Ambient Body Occlusion
    ctx.beginPath();
    ctx.ellipse(screen.x + lungeX, screen.y + lungeY, 15 * z, 6.5 * z, shadowAngle, 0, Math.PI * 2);
    ctx.fillStyle = isDashing ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Left Boot Contact Shadow (softens and shrinks when foot lifts)
    const shadowLAlpha = Math.max(0.12, 0.58 - (legL_lift / (3.5 * z)) * 0.42);
    const shadowLScale = Math.max(0.55, 1.0 - (legL_lift / (3.5 * z)) * 0.35);
    ctx.beginPath();
    ctx.ellipse(screen.x + lungeX + footLRelX + legL_x, screen.y + lungeY + legL_y, 7.5 * z * shadowLScale, 3.8 * z * shadowLScale, shadowAngle, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowLAlpha})`;
    ctx.fill();

    // Right Boot Contact Shadow (softens and shrinks when foot lifts)
    const shadowRAlpha = Math.max(0.12, 0.58 - (legR_lift / (3.5 * z)) * 0.42);
    const shadowRScale = Math.max(0.55, 1.0 - (legR_lift / (3.5 * z)) * 0.35);
    ctx.beginPath();
    ctx.ellipse(screen.x + lungeX + footRRelX + legR_x, screen.y + lungeY + legR_y, 7.5 * z * shadowRScale, 3.8 * z * shadowRScale, shadowAngle, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowRAlpha})`;
    ctx.fill();
    ctx.restore();

    // =========================================================================
    // SELECTION RING FOR LOCAL HERO
    // =========================================================================
    if (isLocal) {
      const ringPulse = Math.sin(t * 4) * 1.5 * z;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 18 * z + ringPulse, 9 * z + ringPulse * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    // =========================================================================
    // DRAW SPRITE: DASH AFTERIMAGES, ATTACK STRIKE, WALK GAIT OR IDLE
    // =========================================================================
    // =========================================================================
    // DRAW SPRITE: DEDICATED SPRITE SHEETS FOR DASH, ATTACK SLASH, IDLE & WALK
    // =========================================================================
    const isFacingLeft = (facing === 'W' || facing === 'NW' || facing === 'SW' || (isDashing && lv.x < 0) || (isAttacking && lv.x < 0));

    if (this.sprites.swordman.complete && this.sprites.swordman.naturalWidth > 0) {
      ctx.save();
      ctx.imageSmoothingEnabled = false; // preserve crisp pixel art rendering

      if (isDashing) {
        // --- 1. DASH STATE (แดช / BLADE CHARGE) ---
        const useDashStrip = this.sprites.swordmanDash && this.sprites.swordmanDash.complete && this.sprites.swordmanDash.naturalWidth > 0;
        const dashFrames = IsometricRenderer.SWORDMAN_DASH_FRAMES;
        let dFrameIdx = 0;
        if (dashProg < 0.15) dFrameIdx = 0;        // Sprint Crouch
        else if (dashProg < 0.45) dFrameIdx = 1;   // Dive Sprint with Wind
        else if (dashProg < 0.78) dFrameIdx = 2;   // Supersonic Blade Thrust
        else dFrameIdx = 3;                        // Slide Stop with Dust

        const curDFrame = dashFrames[dFrameIdx];
        const dImg = useDashStrip ? this.sprites.swordmanDash : this.sprites.swordman;
        const srcF = useDashStrip ? curDFrame : frame;

        const dw = srcF.sw * baseScale;
        const dh = srcF.sh * baseScale;
        const dx = -srcF.anchorX * baseScale;
        const dy = -srcF.anchorY * baseScale;

        // --- DASH GHOST AFTERIMAGES (Phantom Echoes) ---
        if (player._dashTrail && player._dashTrail.length > 1) {
          for (let i = 1; i < player._dashTrail.length; i++) {
            const ghost = player._dashTrail[i];
            const ghostAge = (performance.now() - ghost.time) / 320;
            if (ghostAge < 1.0) {
              ctx.save();
              ctx.globalAlpha = (1.0 - ghostAge) * (i === 1 ? 0.48 : i === 2 ? 0.28 : 0.14);
              ctx.translate(ghost.x, ghost.y);
              if (isFacingLeft) ctx.scale(-1, 1);
              ctx.drawImage(dImg, srcF.sx, srcF.sy, srcF.sw, srcF.sh, dx, dy, dw, dh);

              // Cyan Spectral Velocity Highlight
              ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
              ctx.fillRect(dx, dy, dw, dh);
              ctx.restore();
            }
          }
        }

        // Render Main Dash Body
        ctx.save();
        ctx.translate(screen.x + lungeX, screen.y + lungeY - verticalOffset);
        if (isFacingLeft) ctx.scale(-1, 1);
        ctx.drawImage(dImg, srcF.sx, srcF.sy, srcF.sw, srcF.sh, dx, dy, dw, dh);
        ctx.restore();

        // Speed Lines (Aerodynamic wind shear streaks cutting across the dash)
        ctx.save();
        const streakAngle = Math.atan2(lv.y, lv.x);
        ctx.translate(screen.x + lungeX, screen.y + lungeY - 14 * z);
        ctx.rotate(streakAngle);
        for (let s = -1; s <= 1; s++) {
          ctx.beginPath();
          ctx.moveTo(-22 * z, s * 8 * z);
          ctx.lineTo(20 * z, s * 8 * z);
          ctx.strokeStyle = `rgba(224, 242, 254, ${0.8 - Math.abs(s) * 0.2})`;
          ctx.lineWidth = 2.0 * z;
          ctx.stroke();
        }
        ctx.restore();

        // Spawn braking slide dust when entering stop phase
        if (dFrameIdx === 3 && Math.random() < 0.03) {
          this.addParticles(player.x, player.y, 'dust', 1, RUN_DUST_OPTS);
        }

      } else if (isAttacking) {
        // --- 2. ATTACK SLASH STATE (ฟันดาบ) ---
        const useAttackStrip = this.sprites.swordmanAttack && this.sprites.swordmanAttack.complete && this.sprites.swordmanAttack.naturalWidth > 0;
        const attackFrames = IsometricRenderer.SWORDMAN_ATTACK_FRAMES;
        let aFrameIdx = 0;
        if (attackProg < 0.22) aFrameIdx = 0;       // Windup
        else if (attackProg < 0.52) aFrameIdx = 1;  // Slash Cleave Arc
        else if (attackProg < 0.80) aFrameIdx = 2;  // Lunge Thrust
        else aFrameIdx = 3;                         // Recovery

        const curAFrame = attackFrames[aFrameIdx];
        const aImg = useAttackStrip ? this.sprites.swordmanAttack : this.sprites.swordman;
        const srcF = useAttackStrip ? curAFrame : frame;

        const dw = srcF.sw * baseScale;
        const dh = srcF.sh * baseScale;
        const dx = -srcF.anchorX * baseScale;
        const dy = -srcF.anchorY * baseScale;

        ctx.save();
        ctx.translate(screen.x + lungeX, screen.y + lungeY - verticalOffset);
        if (isFacingLeft) ctx.scale(-1, 1);
        ctx.drawImage(aImg, srcF.sx, srcF.sy, srcF.sw, srcF.sh, dx, dy, dw, dh);
        ctx.restore();

      } else if (isMoving) {
        // --- 3. DYNAMIC COMBAT RUN (วิ่งลากดาบเท่ๆ ด้วยมือเดียว / DRAGGING SWORD RUN) ---
        const isBackRun = (facing === 'N' || facing === 'NE' || facing === 'NW');
        const runImg = isBackRun ? this.sprites.swordmanRunBack : this.sprites.swordmanRunFront;
        const useRunStrip = runImg && runImg.complete && runImg.naturalWidth > 0;

        if (useRunStrip) {
          const runFrames = IsometricRenderer.SWORDMAN_RUN_FRAMES;
          // Fast-paced athletic running cadence (8.5 frames per second loop)
          const runIdx = Math.floor((t * 8.5) % 4);
          const rFrame = runFrames[runIdx];

          const dw = rFrame.sw * baseScale;
          const dh = rFrame.sh * baseScale;
          const dx = -rFrame.anchorX * baseScale;
          const dy = -rFrame.anchorY * baseScale;

          // Determine horizontal flip:
          // Front-view: faces right by default. Flip if moving left (W, SW, or lv.x < -0.2)
          // Back-view: faces right/up-right by default. Flip if moving up-left (NW, or lv.x < -0.2)
          const flipRun = isBackRun ? (facing === 'NW' || lv.x < -0.2) : (facing === 'W' || facing === 'SW' || lv.x < -0.2);

          // Athletic forward lean tilt + vertical run bounce
          const runLean = 0.09 * (flipRun ? -1 : 1);
          const runBob = Math.abs(Math.sin(t * 17)) * 2.5 * z;

          ctx.save();
          ctx.translate(screen.x, screen.y - runBob);
          ctx.rotate(runLean);
          if (flipRun) ctx.scale(-1, 1);
          ctx.drawImage(runImg, rFrame.sx, rFrame.sy, rFrame.sw, rFrame.sh, dx, dy, dw, dh);
          ctx.restore();

          // Blade Ground Friction Sparks & Dust (sparking along the ground where the heavy sword drags!)
          const sparkSide = flipRun ? 0.35 : -0.35;
          const swordTipX = player.x + sparkSide;
          const swordTipY = player.y + 0.12;
          if (Math.random() < 0.28) {
            this.addParticles(swordTipX, swordTipY, 'slash', 1);
          }
          if (Math.random() < 0.01) {
            this.addParticles(player.x, player.y, 'dust', 1, RUN_DUST_OPTS);
          }

        } else {
          // Fallback to turnaround sheet if strip is still loading
          const img = this.sprites.swordman;
          const dw = frame.sw * baseScale;
          const dh = frame.sh * baseScale;
          const dx = -frame.anchorX * baseScale;
          const dy = -frame.anchorY * baseScale;

          ctx.save();
          ctx.translate(screen.x, screen.y - gaitBob);
          ctx.rotate(gaitSway);
          ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, dx, dy, dw, dh);
          ctx.restore();
        }

      } else {
        // --- 4. IDLE STATE: Living Breathing Cadence, Stance Shift & Sword Specular Glint ---
        const isFrontal = (facing === 'S' || facing === 'SE' || facing === 'SW');
        const useIdleStrip = isFrontal && this.sprites.swordmanIdle && this.sprites.swordmanIdle.complete && this.sprites.swordmanIdle.naturalWidth > 0;

        if (useIdleStrip) {
          const idleFrames = IsometricRenderer.SWORDMAN_IDLE_FRAMES;
          const idleFrameIdx = Math.floor((t * 2.0) % 4);
          const iFrame = idleFrames[idleFrameIdx];
          const dw = iFrame.sw * baseScale;
          const dh = iFrame.sh * baseScale;
          const dx = -iFrame.anchorX * baseScale;
          const dy = -iFrame.anchorY * baseScale;

          ctx.save();
          ctx.translate(screen.x, screen.y - gaitBob);
          if (facing === 'SW') ctx.scale(-1, 1);
          ctx.drawImage(this.sprites.swordmanIdle, iFrame.sx, iFrame.sy, iFrame.sw, iFrame.sh, dx, dy, dw, dh);
          ctx.restore();

        } else {
          // 8-directional turnaround idle pose for back/side view angles
          const img = this.sprites.swordman;
          const dw = frame.sw * baseScale;
          const dh = frame.sh * baseScale;
          const dx = -frame.anchorX * baseScale;
          const dy = -frame.anchorY * baseScale;

          ctx.save();
          ctx.translate(screen.x, screen.y - gaitBob);
          ctx.rotate(gaitSway);
          ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, dx, dy, dw, dh);
          ctx.restore();

          // Steel Blade Specular Gleam Highlight (sweeps down sword edge every 2.8s)
          const gleamCycle = (t % 2.8);
          if (gleamCycle < 0.42) {
            const gp = gleamCycle / 0.42;
            const glintX = screen.x + (lv.x >= 0 ? 5 : -5) * z;
            const glintY = screen.y - (32 - gp * 18) * z;
            ctx.save();
            ctx.beginPath();
            ctx.arc(glintX, glintY, 2.6 * z * Math.sin(gp * Math.PI), 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#67e8f9';
            ctx.shadowBlur = 8 * z;
            ctx.fill();
            ctx.restore();
          }
        }
      }

      ctx.restore();
    }

    // =========================================================================
    // DYNAMIC COMBAT SLASHING BLADE ARC & CLEAVING VISUAL TRAILS
    // =========================================================================
    if (isAttacking && attackProg > 0.12 && attackProg < 0.85) {
      ctx.save();
      const slashAngle = Math.atan2(lv.y, lv.x);
      ctx.translate(screen.x + lungeX + lv.x * 12 * z, screen.y + lungeY + lv.y * 8 * z - 22 * z);
      ctx.rotate(slashAngle);

      const arcProg = (attackProg - 0.12) / 0.73;
      const arcStart = -1.2 + arcProg * 0.45;
      const arcEnd = 1.2;
      const alpha = Math.sin(arcProg * Math.PI) * 0.95;

      // Radiant Electric Outer Slash Aura
      ctx.beginPath();
      ctx.arc(0, 0, 28 * z, arcStart, arcEnd);
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.6})`;
      ctx.lineWidth = 6.5 * z;
      ctx.stroke();

      // Razor Steel Core Arc
      ctx.beginPath();
      ctx.arc(0, 0, 27 * z, arcStart, arcEnd);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 3.2 * z;
      ctx.stroke();

      // Fiery Golden Cutting Edge
      ctx.beginPath();
      ctx.arc(0, 0, 25 * z, arcStart + 0.1, arcEnd - 0.1);
      ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.88})`;
      ctx.lineWidth = 1.8 * z;
      ctx.stroke();

      ctx.restore();
    }

    // =========================================================================
    // OVERHEAD NAMETAG, GUILD BADGE & MINI HP BAR
    // =========================================================================
    this.drawEntityOverhead(ctx, screen.x, screen.y - 54 * z, this.playerTitledName(player), player.hp, player.maxHp, this.playerNameColor(player), `Lv.${player.level}`);

    // =========================================================================
    // SPEECH BUBBLE
    // =========================================================================
    if (player.speechBubble) {
      this.drawSpeechBubble(ctx, screen.x, screen.y - 78 * z, player.speechBubble);
    }
  }

  // Authentic Pixel Art Archmage Renderer (Levitation, Arcane Burst Cast, Blink Dash & Staff Drag Run)
  drawMage(ctx, player, isLocal, screen, z, t) {
    const isMoving = !!player.isMoving;

    // 1. DASH STATE (Arcane Blink / Warp Surge)
    const dash = this.dashes ? this.dashes.get(player.id) : null;
    const isDashing = dash && (performance.now() - dash.time < dash.duration);
    const dashProg = isDashing ? (performance.now() - dash.time) / dash.duration : 0;

    // 2. ATTACK STATE (Arcane Spell Beam / Burst Cast)
    const attack = this.attacks ? this.attacks.get(player.id) : null;
    const isAttacking = attack && (performance.now() - attack.time < attack.duration);
    const attackProg = isAttacking ? (performance.now() - attack.time) / attack.duration : 0;

    // Facing direction: during attack or dash, lock facing towards action direction!
    const facing = (isAttacking && attack.facing)
      ? attack.facing
      : ((isDashing && dash.facing) ? dash.facing : (player.facing || 'S'));

    const baseScale = 0.205 * z;

    // 8-Directional Lunge & Facing Vectors
    const lungeVecs = {
      S:  { x: 0,      y: 1.0 },
      SE: { x: 0.89,   y: 0.45 },
      E:  { x: 1.0,    y: 0.0 },
      NE: { x: 0.89,   y: -0.45 },
      N:  { x: 0,      y: -1.0 },
      NW: { x: -0.89,  y: -0.45 },
      W:  { x: -1.0,   y: 0.0 },
      SW: { x: -0.89,  y: 0.45 }
    };
    const lv = lungeVecs[facing] || lungeVecs.S;

    let lungeX = 0;
    let lungeY = 0;
    let verticalOffset = 0;

    if (isDashing) {
      const dashImpulse = Math.sin(dashProg * Math.PI);
      lungeX = lv.x * 16 * z * dashImpulse;
      lungeY = lv.y * 16 * z * dashImpulse;
      verticalOffset = 2.0 * z;

      player._dashTrail = player._dashTrail || [];
      player._dashTrail.unshift({
        x: screen.x + lungeX,
        y: screen.y + lungeY - verticalOffset,
        facing,
        time: performance.now()
      });
      if (player._dashTrail.length > 5) player._dashTrail.pop();

      if (Math.random() < 0.45) {
        this.addParticles(player.x, player.y, 'arcane', 2);
      }
    } else if (isAttacking) {
      if (attackProg < 0.25) {
        const wp = attackProg / 0.25;
        lungeX = -lv.x * 4 * z * wp;
        lungeY = -lv.y * 4 * z * wp;
        verticalOffset = -1.0 * z * wp;
      } else if (attackProg <= 0.70) {
        const sp = (attackProg - 0.25) / 0.45;
        const strikeThrust = Math.sin(sp * Math.PI);
        lungeX = lv.x * 14 * z * strikeThrust;
        lungeY = lv.y * 14 * z * strikeThrust;
        verticalOffset = 1.5 * z * strikeThrust;
      } else {
        const rp = (attackProg - 0.70) / 0.30;
        lungeX = lv.x * 6 * z * (1 - rp);
        lungeY = lv.y * 6 * z * (1 - rp);
      }
    } else {
      if (player._dashTrail && player._dashTrail.length > 0) {
        player._dashTrail = [];
      }
    }

    // Mage Levitating Hover Dynamics (gently floats above ground when idle)
    const hoverBob = (!isMoving && !isAttacking && !isDashing)
      ? Math.sin(t * 3.2) * 3.2 * z
      : 0;

    // Ground Arcane Levitation Shadow
    ctx.save();
    const shadowScale = (!isMoving && !isAttacking && !isDashing)
      ? (1.0 - (hoverBob / (18 * z)))
      : 1.0;
    ctx.beginPath();
    ctx.ellipse(screen.x + lungeX, screen.y + lungeY, 14 * z * shadowScale, 6.5 * z * shadowScale, 0.28, 0, Math.PI * 2);
    ctx.fillStyle = isDashing ? 'rgba(15, 23, 42, 0.2)' : 'rgba(15, 23, 42, 0.38)';
    ctx.fill();
    ctx.restore();

    // Local Hero Selection Ring
    if (isLocal) {
      const ringPulse = Math.sin(t * 4) * 1.5 * z;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 18 * z + ringPulse, 9 * z + ringPulse * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    const isFacingLeft = (facing === 'W' || facing === 'NW' || facing === 'SW' || (isDashing && lv.x < 0) || (isAttacking && lv.x < 0));

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (isDashing && this.sprites.mageDash && this.sprites.mageDash.complete && this.sprites.mageDash.naturalWidth > 0) {
      // 1. DASH STATE (Arcane Blink)
      const dashFrames = IsometricRenderer.MAGE_DASH_FRAMES;
      let dFrameIdx = 0;
      if (dashProg < 0.18) dFrameIdx = 0;
      else if (dashProg < 0.48) dFrameIdx = 1;
      else if (dashProg < 0.78) dFrameIdx = 2;
      else dFrameIdx = 3;

      const curDFrame = dashFrames[dFrameIdx];
      const dw = curDFrame.sw * baseScale;
      const dh = curDFrame.sh * baseScale;
      const dx = -curDFrame.anchorX * baseScale;
      const dy = -curDFrame.anchorY * baseScale;

      // Arcane Blink Ghost Afterimages (Phantom Echoes)
      if (player._dashTrail && player._dashTrail.length > 1) {
        for (let i = 1; i < player._dashTrail.length; i++) {
          const ghost = player._dashTrail[i];
          const ghostAge = (performance.now() - ghost.time) / 320;
          if (ghostAge < 1.0) {
            ctx.save();
            ctx.globalAlpha = (1.0 - ghostAge) * (i === 1 ? 0.45 : i === 2 ? 0.26 : 0.12);
            ctx.translate(ghost.x, ghost.y);
            if (isFacingLeft) ctx.scale(-1, 1);
            ctx.drawImage(this.sprites.mageDash, curDFrame.sx, curDFrame.sy, curDFrame.sw, curDFrame.sh, dx, dy, dw, dh);
            ctx.fillStyle = 'rgba(168, 85, 247, 0.32)';
            ctx.fillRect(dx, dy, dw, dh);
            ctx.restore();
          }
        }
      }

      ctx.save();
      ctx.translate(screen.x + lungeX, screen.y + lungeY - verticalOffset);
      if (isFacingLeft) ctx.scale(-1, 1);
      ctx.drawImage(this.sprites.mageDash, curDFrame.sx, curDFrame.sy, curDFrame.sw, curDFrame.sh, dx, dy, dw, dh);
      ctx.restore();

      // Cosmic Blink Streaks
      ctx.save();
      const streakAngle = Math.atan2(lv.y, lv.x);
      ctx.translate(screen.x + lungeX, screen.y + lungeY - 14 * z);
      ctx.rotate(streakAngle);
      for (let s = -1; s <= 1; s++) {
        ctx.beginPath();
        ctx.moveTo(-24 * z, s * 9 * z);
        ctx.lineTo(22 * z, s * 9 * z);
        ctx.strokeStyle = `rgba(192, 132, 252, ${0.85 - Math.abs(s) * 0.25})`;
        ctx.lineWidth = 2.2 * z;
        ctx.stroke();
      }
      ctx.restore();

    } else if (isAttacking && this.sprites.mageAttack && this.sprites.mageAttack.complete && this.sprites.mageAttack.naturalWidth > 0) {
      // 2. ATTACK STATE (Arcane Beam / Burst Cast)
      const attackFrames = IsometricRenderer.MAGE_ATTACK_FRAMES;
      let aFrameIdx = 0;
      if (attackProg < 0.22) aFrameIdx = 0;
      else if (attackProg < 0.52) aFrameIdx = 1;
      else if (attackProg < 0.80) aFrameIdx = 2;
      else aFrameIdx = 3;

      const curAFrame = attackFrames[aFrameIdx];
      const dw = curAFrame.sw * baseScale;
      const dh = curAFrame.sh * baseScale;
      const dx = -curAFrame.anchorX * baseScale;
      const dy = -curAFrame.anchorY * baseScale;

      ctx.save();
      ctx.translate(screen.x + lungeX, screen.y + lungeY - verticalOffset);
      if (isFacingLeft) ctx.scale(-1, 1);
      ctx.drawImage(this.sprites.mageAttack, curAFrame.sx, curAFrame.sy, curAFrame.sw, curAFrame.sh, dx, dy, dw, dh);
      ctx.restore();

      // Swirling Arcane Rune Circle under feet during spellcast
      if (attackProg > 0.15 && attackProg < 0.85) {
        ctx.save();
        const castAlpha = Math.sin((attackProg - 0.15) / 0.70 * Math.PI);
        ctx.beginPath();
        ctx.ellipse(screen.x + lungeX, screen.y + lungeY, 20 * z, 10 * z, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(168, 85, 247, ${castAlpha * 0.75})`;
        ctx.lineWidth = 2.0 * z;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(screen.x + lungeX, screen.y + lungeY, 13 * z, 6.5 * z, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${castAlpha * 0.65})`;
        ctx.lineWidth = 1.4 * z;
        ctx.stroke();
        ctx.restore();
      }

    } else if (isMoving && this.sprites.mageRun && this.sprites.mageRun.complete && this.sprites.mageRun.naturalWidth > 0) {
      // 3. RUN STATE (Staff Dragging Sprint)
      const runFrames = IsometricRenderer.MAGE_RUN_FRAMES;
      const runIdx = Math.floor((t * 7.5) % 4);
      const rFrame = runFrames[runIdx];

      const dw = rFrame.sw * baseScale;
      const dh = rFrame.sh * baseScale;
      const dx = -rFrame.anchorX * baseScale;
      const dy = -rFrame.anchorY * baseScale;

      const flipRun = (facing === 'W' || facing === 'NW' || facing === 'SW' || lv.x < -0.2);

      ctx.save();
      ctx.translate(screen.x, screen.y);
      if (flipRun) ctx.scale(-1, 1);
      ctx.drawImage(this.sprites.mageRun, rFrame.sx, rFrame.sy, rFrame.sw, rFrame.sh, dx, dy, dw, dh);
      ctx.restore();

      // Crystal Staff Ground Wake: Cyan mana sparks and stardust trailing where staff tip drags
      const staffTipX = player.x + (flipRun ? 0.35 : -0.35);
      const staffTipY = player.y + 0.1;
      if (Math.random() < 0.28) {
        this.addParticles(staffTipX, staffTipY, 'arcane', 1);
      }
      if (Math.random() < 0.008) {
        this.addParticles(player.x, player.y, 'dust', 1, RUN_DUST_OPTS);
      }

    } else if (this.sprites.mageIdle && this.sprites.mageIdle.complete && this.sprites.mageIdle.naturalWidth > 0) {
      // 4. IDLE STATE (Living Arcane Levitation & Breathing)
      const idleFrames = IsometricRenderer.MAGE_IDLE_FRAMES;
      const idleFrameIdx = Math.floor((t * 2.2) % 4);
      const iFrame = idleFrames[idleFrameIdx];

      const dw = iFrame.sw * baseScale;
      const dh = iFrame.sh * baseScale;
      const dx = -iFrame.anchorX * baseScale;
      const dy = -iFrame.anchorY * baseScale;

      ctx.save();
      ctx.translate(screen.x, screen.y - hoverBob);
      if (isFacingLeft) ctx.scale(-1, 1);
      ctx.drawImage(this.sprites.mageIdle, iFrame.sx, iFrame.sy, iFrame.sw, iFrame.sh, dx, dy, dw, dh);
      ctx.restore();

      // Orbiting Celestial Stardust Mote (Crisp Pixel Star)
      const orbitAngle = t * 3.5;
      const orbRadiusX = 14 * z;
      const orbRadiusY = 6 * z;
      const mpx = Math.max(2, Math.round(2 * z));
      const orbX = Math.round((screen.x + Math.cos(orbitAngle) * orbRadiusX) / mpx) * mpx;
      const orbY = Math.round((screen.y - 28 * z - hoverBob + Math.sin(orbitAngle) * orbRadiusY) / mpx) * mpx;
      ctx.save();
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(orbX - mpx, orbY, mpx * 3, mpx);
      ctx.fillRect(orbX, orbY - mpx, mpx, mpx * 3);
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(orbX, orbY, mpx, mpx);
      ctx.restore();
    }

    ctx.restore();

    // Arcane Cast Blast Arc (Explosive starlight discharge in front of staff)
    if (isAttacking && attackProg > 0.20 && attackProg < 0.75) {
      ctx.save();
      const beamAngle = Math.atan2(lv.y, lv.x);
      ctx.translate(screen.x + lungeX + lv.x * 14 * z, screen.y + lungeY + lv.y * 9 * z - 20 * z);
      ctx.rotate(beamAngle);

      const beamProg = (attackProg - 0.20) / 0.55;
      const alpha = Math.sin(beamProg * Math.PI);

      // Arcane Beam Aura
      ctx.beginPath();
      ctx.ellipse(12 * z, 0, 18 * z, 6 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(192, 132, 252, ${alpha * 0.7})`;
      ctx.fill();

      // Starlight Core
      ctx.beginPath();
      ctx.ellipse(12 * z, 0, 14 * z, 3 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
      ctx.fill();

      ctx.restore();
    }

    // Overhead Nametag, Guild Badge & Mini HP Bar
    this.drawEntityOverhead(ctx, screen.x, screen.y - 54 * z, this.playerTitledName(player), player.hp, player.maxHp, this.playerNameColor(player), `Lv.${player.level}`);

    // Speech Bubble
    if (player.speechBubble) {
      this.drawSpeechBubble(ctx, screen.x, screen.y - 78 * z, player.speechBubble);
    }
  }

  // Authentic Pixel Art Rogue Renderer (Dual Dagger Stealth, Cross Cleave, Shadow Dive & Reverse Grip Sprint)
  drawRogue(ctx, player, isLocal, screen, z, t) {
    const isMoving = !!player.isMoving;

    // 1. DASH STATE (Shadow Dive / Smoke Dash)
    const dash = this.dashes ? this.dashes.get(player.id) : null;
    const isDashing = dash && (performance.now() - dash.time < dash.duration);
    const dashProg = isDashing ? (performance.now() - dash.time) / dash.duration : 0;

    // 2. ATTACK STATE (Dual Dagger Cross Cleave)
    const attack = this.attacks ? this.attacks.get(player.id) : null;
    const isAttacking = attack && (performance.now() - attack.time < attack.duration);
    const attackProg = isAttacking ? (performance.now() - attack.time) / attack.duration : 0;

    // Facing direction: during attack or dash, lock facing towards action direction!
    const facing = (isAttacking && attack.facing)
      ? attack.facing
      : ((isDashing && dash.facing) ? dash.facing : (player.facing || 'S'));

    const baseScale = 0.205 * z;

    // 8-Directional Lunge & Facing Vectors
    const lungeVecs = {
      S:  { x: 0,      y: 1.0 },
      SE: { x: 0.89,   y: 0.45 },
      E:  { x: 1.0,    y: 0.0 },
      NE: { x: 0.89,   y: -0.45 },
      N:  { x: 0,      y: -1.0 },
      NW: { x: -0.89,  y: -0.45 },
      W:  { x: -1.0,   y: 0.0 },
      SW: { x: -0.89,  y: 0.45 }
    };
    const lv = lungeVecs[facing] || lungeVecs.S;

    let lungeX = 0;
    let lungeY = 0;
    let verticalOffset = 0;

    if (isDashing) {
      const dashImpulse = Math.sin(dashProg * Math.PI);
      lungeX = lv.x * 16 * z * dashImpulse;
      lungeY = lv.y * 16 * z * dashImpulse;
      verticalOffset = 3.5 * z; // Low shadow crouch

      player._dashTrail = player._dashTrail || [];
      player._dashTrail.unshift({
        x: screen.x + lungeX,
        y: screen.y + lungeY - verticalOffset,
        facing,
        time: performance.now()
      });
      if (player._dashTrail.length > 5) player._dashTrail.pop();

      if (Math.random() < 0.45) {
        this.addParticles(player.x, player.y, 'shadow', 2);
      }
    } else if (isAttacking) {
      if (attackProg < 0.22) {
        const wp = attackProg / 0.22;
        lungeX = -lv.x * 4 * z * wp;
        lungeY = -lv.y * 4 * z * wp;
        verticalOffset = -1.0 * z * wp;
      } else if (attackProg <= 0.68) {
        const sp = (attackProg - 0.22) / 0.46;
        const strikeThrust = Math.sin(sp * Math.PI);
        lungeX = lv.x * 16 * z * strikeThrust;
        lungeY = lv.y * 16 * z * strikeThrust;
        verticalOffset = 2.0 * z * strikeThrust;
      } else {
        const rp = (attackProg - 0.68) / 0.32;
        lungeX = lv.x * 7 * z * (1 - rp);
        lungeY = lv.y * 7 * z * (1 - rp);
      }
    } else {
      if (player._dashTrail && player._dashTrail.length > 0) {
        player._dashTrail = [];
      }
    }

    // Agile Foot Contact Shadows
    ctx.save();
    const shadowAngle = 0.28;
    ctx.beginPath();
    ctx.ellipse(screen.x + lungeX, screen.y + lungeY, 14 * z, 6.0 * z, shadowAngle, 0, Math.PI * 2);
    ctx.fillStyle = isDashing ? 'rgba(0, 0, 0, 0.22)' : 'rgba(0, 0, 0, 0.38)';
    ctx.fill();
    ctx.restore();

    // Local Hero Selection Ring
    if (isLocal) {
      const ringPulse = Math.sin(t * 4) * 1.5 * z;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 18 * z + ringPulse, 9 * z + ringPulse * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    const isFacingLeft = (facing === 'W' || facing === 'NW' || facing === 'SW' || (isDashing && lv.x < 0) || (isAttacking && lv.x < 0));

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (isDashing && this.sprites.rogueDash && this.sprites.rogueDash.complete && this.sprites.rogueDash.naturalWidth > 0) {
      // 1. DASH STATE (Shadow Dive)
      const dashFrames = IsometricRenderer.ROGUE_DASH_FRAMES;
      let dFrameIdx = 0;
      if (dashProg < 0.18) dFrameIdx = 0;
      else if (dashProg < 0.48) dFrameIdx = 1;
      else if (dashProg < 0.78) dFrameIdx = 2;
      else dFrameIdx = 3;

      const curDFrame = dashFrames[dFrameIdx];
      const dw = curDFrame.sw * baseScale;
      const dh = curDFrame.sh * baseScale;
      const dx = -curDFrame.anchorX * baseScale;
      const dy = -curDFrame.anchorY * baseScale;

      // Rogue Shadow Afterimages
      if (player._dashTrail && player._dashTrail.length > 1) {
        for (let i = 1; i < player._dashTrail.length; i++) {
          const ghost = player._dashTrail[i];
          const ghostAge = (performance.now() - ghost.time) / 320;
          if (ghostAge < 1.0) {
            ctx.save();
            ctx.globalAlpha = (1.0 - ghostAge) * (i === 1 ? 0.46 : i === 2 ? 0.26 : 0.12);
            ctx.translate(ghost.x, ghost.y);
            if (isFacingLeft) ctx.scale(-1, 1);
            ctx.drawImage(this.sprites.rogueDash, curDFrame.sx, curDFrame.sy, curDFrame.sw, curDFrame.sh, dx, dy, dw, dh);
            ctx.fillStyle = 'rgba(34, 197, 94, 0.28)';
            ctx.fillRect(dx, dy, dw, dh);
            ctx.restore();
          }
        }
      }

      ctx.save();
      ctx.translate(screen.x + lungeX, screen.y + lungeY - verticalOffset);
      if (isFacingLeft) ctx.scale(-1, 1);
      ctx.drawImage(this.sprites.rogueDash, curDFrame.sx, curDFrame.sy, curDFrame.sw, curDFrame.sh, dx, dy, dw, dh);
      ctx.restore();

      // Shadow Speed Lines
      ctx.save();
      const streakAngle = Math.atan2(lv.y, lv.x);
      ctx.translate(screen.x + lungeX, screen.y + lungeY - 12 * z);
      ctx.rotate(streakAngle);
      for (let s = -1; s <= 1; s++) {
        ctx.beginPath();
        ctx.moveTo(-22 * z, s * 8 * z);
        ctx.lineTo(20 * z, s * 8 * z);
        ctx.strokeStyle = `rgba(74, 222, 128, ${0.80 - Math.abs(s) * 0.25})`;
        ctx.lineWidth = 2.0 * z;
        ctx.stroke();
      }
      ctx.restore();

    } else if (isAttacking && this.sprites.rogueAttack && this.sprites.rogueAttack.complete && this.sprites.rogueAttack.naturalWidth > 0) {
      // 2. ATTACK STATE (Dual Dagger Cross Cleave)
      const attackFrames = IsometricRenderer.ROGUE_ATTACK_FRAMES;
      let aFrameIdx = 0;
      if (attackProg < 0.20) aFrameIdx = 0;
      else if (attackProg < 0.50) aFrameIdx = 1;
      else if (attackProg < 0.78) aFrameIdx = 2;
      else aFrameIdx = 3;

      const curAFrame = attackFrames[aFrameIdx];
      const dw = curAFrame.sw * baseScale;
      const dh = curAFrame.sh * baseScale;
      const dx = -curAFrame.anchorX * baseScale;
      const dy = -curAFrame.anchorY * baseScale;

      ctx.save();
      ctx.translate(screen.x + lungeX, screen.y + lungeY - verticalOffset);
      if (isFacingLeft) ctx.scale(-1, 1);
      ctx.drawImage(this.sprites.rogueAttack, curAFrame.sx, curAFrame.sy, curAFrame.sw, curAFrame.sh, dx, dy, dw, dh);
      ctx.restore();

    } else if (isMoving && this.sprites.rogueRun && this.sprites.rogueRun.complete && this.sprites.rogueRun.naturalWidth > 0) {
      // 3. RUN STATE (Reverse-Grip Ninja Sprint Dragging Daggers)
      const runFrames = IsometricRenderer.ROGUE_RUN_FRAMES;
      const runIdx = Math.floor((t * 9.0) % 4);
      const rFrame = runFrames[runIdx];

      const dw = rFrame.sw * baseScale;
      const dh = rFrame.sh * baseScale;
      const dx = -rFrame.anchorX * baseScale;
      const dy = -rFrame.anchorY * baseScale;

      const flipRun = (facing === 'W' || facing === 'NW' || facing === 'SW' || lv.x < -0.2);
      const runLean = 0.12 * (flipRun ? -1 : 1);
      const runBob = Math.abs(Math.sin(t * 18)) * 2.4 * z;

      ctx.save();
      ctx.translate(screen.x, screen.y - runBob);
      ctx.rotate(runLean);
      if (flipRun) ctx.scale(-1, 1);
      ctx.drawImage(this.sprites.rogueRun, rFrame.sx, rFrame.sy, rFrame.sw, rFrame.sh, dx, dy, dw, dh);
      ctx.restore();

      // Poison sparks scratching the ground behind the sprinting rogue
      const daggerTipX = player.x + (flipRun ? 0.32 : -0.32);
      const daggerTipY = player.y + 0.1;
      if (Math.random() < 0.32) {
        this.addParticles(daggerTipX, daggerTipY, 'slash', 1);
      }
      if (Math.random() < 0.01) {
        this.addParticles(player.x, player.y, 'dust', 1, RUN_DUST_OPTS);
      }

    } else if (this.sprites.rogueIdle && this.sprites.rogueIdle.complete && this.sprites.rogueIdle.naturalWidth > 0) {
      // 4. IDLE STATE (Living Stealth Crouch & Dagger Flipping)
      const idleFrames = IsometricRenderer.ROGUE_IDLE_FRAMES;
      const idleFrameIdx = Math.floor((t * 2.5) % 4);
      const iFrame = idleFrames[idleFrameIdx];

      const dw = iFrame.sw * baseScale;
      const dh = iFrame.sh * baseScale;
      const dx = -iFrame.anchorX * baseScale;
      const dy = -iFrame.anchorY * baseScale;

      const idleBreath = Math.sin(t * 3.0) * 0.8 * z;

      ctx.save();
      ctx.translate(screen.x, screen.y - idleBreath);
      if (isFacingLeft) ctx.scale(-1, 1);
      ctx.drawImage(this.sprites.rogueIdle, iFrame.sx, iFrame.sy, iFrame.sw, iFrame.sh, dx, dy, dw, dh);
      ctx.restore();

      // Poison Green Specular Dagger Gleam
      const gleamCycle = (t % 2.4);
      if (gleamCycle < 0.38) {
        const gp = gleamCycle / 0.38;
        const glintX = screen.x + (isFacingLeft ? -6 : 6) * z;
        const glintY = screen.y - (22 - gp * 12) * z;
        ctx.save();
        ctx.beginPath();
        ctx.arc(glintX, glintY, 2.5 * z * Math.sin(gp * Math.PI), 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 8 * z;
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();

    // Toxic Green 'X' Cross Cleave Visual Slash Effect in Front
    if (isAttacking && attackProg > 0.15 && attackProg < 0.82) {
      ctx.save();
      const slashAngle = Math.atan2(lv.y, lv.x);
      ctx.translate(screen.x + lungeX + lv.x * 12 * z, screen.y + lungeY + lv.y * 8 * z - 18 * z);
      ctx.rotate(slashAngle);

      const xProg = (attackProg - 0.15) / 0.67;
      const alpha = Math.sin(xProg * Math.PI);

      // Slash 1: Diagonal \
      ctx.beginPath();
      ctx.moveTo(-16 * z, -16 * z);
      ctx.lineTo(16 * z, 16 * z);
      ctx.strokeStyle = `rgba(34, 197, 94, ${alpha * 0.95})`;
      ctx.lineWidth = 3.5 * z;
      ctx.stroke();

      // Slash 2: Diagonal /
      ctx.beginPath();
      ctx.moveTo(-16 * z, 16 * z);
      ctx.lineTo(16 * z, -16 * z);
      ctx.strokeStyle = `rgba(74, 222, 128, ${alpha * 0.95})`;
      ctx.lineWidth = 3.5 * z;
      ctx.stroke();

      // Razor White Core Intersection
      ctx.beginPath();
      ctx.arc(0, 0, 4.5 * z, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 10 * z;
      ctx.fill();

      ctx.restore();
    }

    // Overhead Nametag, Guild Badge & Mini HP Bar
    this.drawEntityOverhead(ctx, screen.x, screen.y - 54 * z, this.playerTitledName(player), player.hp, player.maxHp, this.playerNameColor(player), `Lv.${player.level}`);

    // Speech Bubble
    if (player.speechBubble) {
      this.drawSpeechBubble(ctx, screen.x, screen.y - 78 * z, player.speechBubble);
    }
  }

  // Draw Monsters / Mobs
  drawMob(ctx, mob, isSelected) {
    const rawScreen = Isometric.worldToScreen(mob.x, mob.y, 0, this.camera, this.canvas.width, this.canvas.height);
    const screen = { x: Math.round(rawScreen.x), y: Math.round(rawScreen.y) };
    const z = this.camera.zoom;
    const isBoss = mob.isBoss;
    const isMiniboss = !!mob.isMiniboss;

    // Shadow
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, (isBoss ? 28 : isMiniboss ? 20 : 14) * z, (isBoss ? 14 : isMiniboss ? 10 : 7) * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Miniboss Runic Ground Seal
    if (isMiniboss) {
      const mbPulse = Math.sin(this.animations.time * 4) * 0.15 + 0.85;
      const mbR = 26 * z * mbPulse;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, mbR, mbR * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.7)';
      ctx.lineWidth = 2 * z;
      ctx.stroke();
      ctx.fillStyle = 'rgba(236, 72, 153, 0.1)';
      ctx.fill();
      ctx.restore();
    }

    // Commander Aura on Ground
    if (mob.isCommander && mob.auraRadius > 0) {
      const auraPulse = Math.sin(this.animations.time * 3) * 0.12 + 0.88;
      const auraR = mob.auraRadius * TILE_WIDTH * 0.5 * z;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, auraR, auraR * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245, 158, 11, ${0.45 * auraPulse})`;
      ctx.lineWidth = 2.5 * z;
      ctx.stroke();

      ctx.fillStyle = `rgba(245, 158, 11, ${0.06 * auraPulse})`;
      ctx.fill();

      // Rotating heraldry ticks on aura perimeter
      const auraRot = this.animations.time * 0.8;
      for (let i = 0; i < 6; i++) {
        const ang = auraRot + (i * Math.PI / 3);
        const ax = screen.x + Math.cos(ang) * auraR;
        const ay = screen.y + Math.sin(ang) * (auraR * 0.5);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(ax - 2 * z, ay - 2 * z, 4 * z, 4 * z);
      }
      ctx.restore();
    }

    if (mob.hasCommanderBuff) {
      // War buff ring under minions buffed by commander
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 18 * z, 9 * z, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();
      ctx.restore();
    }

    // Target Selection Reticle (Pulsing Lock-on Indicator)
    if (isSelected) {
      const pulse = Math.sin(this.animations.time * 8) * 2 * z;
      const rx = (isBoss ? 36 : 20) * z + pulse;
      const ry = (isBoss ? 18 : 10) * z + (pulse * 0.5);

      // Outer Glow Ring
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5 * z;
      ctx.stroke();

      // Inner Rotating Lock Bracket Ticks
      const rot = this.animations.time * 2;
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(rot);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2 * z;
      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI) / 2;
        const tx = Math.cos(ang) * (rx + 4 * z);
        const ty = Math.sin(ang) * (ry + 2 * z);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx * 0.8, ty * 0.8);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Field-zone variants reuse a body type with their own tint and size; the
    // tint is applied once to the finished body (see drawTinted)
    const drawBody = (ctx) => {
      ctx.save();
      ctx.translate(screen.x, screen.y);
      if (mob.scale && mob.scale !== 1) ctx.scale(mob.scale, mob.scale);

      const time = this.animations.time;
      const rawFacing = mob.facing || 'SE';
      // 8-Axis Directional Normalization: S, SE, E, NE, N, NW, W, SW
      // 5 Canonical Views: 'S' (front), 'SE' (front-3/4), 'E' (side), 'NE' (back-3/4), 'N' (back)
      // West-facing views (W, SW, NW) are rendered by horizontally mirroring E, SE, NE.
      const isWest = rawFacing === 'W' || rawFacing === 'SW' || rawFacing === 'NW';
      const view = (rawFacing === 'W') ? 'E' : (rawFacing === 'SW') ? 'SE' : (rawFacing === 'NW') ? 'NE' : rawFacing;
      const dirSign = isWest ? -1 : 1;

      const isPureFront = view === 'S';
      const isPureBack = view === 'N';
      const isPureSide = view === 'E';
      const isQuarterBack = view === 'NE';
      const isQuarterFront = view === 'SE';
      const isFacingBack = isPureBack || isQuarterBack;

      const drawRoundRect = (c, x, y, w, h, r) => {
        if (typeof c.roundRect === 'function') c.roundRect(x, y, w, h, r);
        else c.rect(x, y, w, h);
      };

      if (mob.type === 'slime') {
        // --- 8-AXIS 3D Volumetric Gelatin Slime ---
        ctx.save();
        // Note: We do NOT horizontally flip the whole slime context, so that radial gradient
        // lighting and specular sheen remain consistently illuminated from top-left in all 8 directions.

        const squish = Math.sin(time * 7 + (mob.x || 0)) * 2.5 * z;
        const rx = (16 * z) + squish;
        const ry = (13 * z) - squish * 0.8;
        const cy = -12 * z + (squish * 0.4);

        // Ground contact shadow
        ctx.beginPath();
        ctx.ellipse(0, -2 * z, rx * 0.95, ry * 0.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(5, 46, 22, 0.45)';
        ctx.fill();

        // 3D Jelly Dome gradient (Unified light from top-left)
        const slimeGrad = ctx.createRadialGradient(-4 * z, cy - 4 * z, 2 * z, 0, cy, rx);
        slimeGrad.addColorStop(0, '#86efac');
        slimeGrad.addColorStop(0.35, '#22c55e');
        slimeGrad.addColorStop(0.75, '#15803d');
        slimeGrad.addColorStop(1, '#052e16');

        ctx.beginPath();
        ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = slimeGrad;
        ctx.fill();
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 1.5 * z;
        ctx.stroke();

        // Suspended Glowing Inner Nucleus (Position shifts accurately across all 8 axes)
        let coreX = 0;
        let coreY = cy + Math.sin(time * 7 + 1.2) * 1.5 * z;
        switch (rawFacing) {
          case 'S':  coreX = 0; coreY += 1 * z; break;
          case 'SE': coreX = 2.5 * z; coreY += 0.6 * z; break;
          case 'E':  coreX = 4 * z; break;
          case 'NE': coreX = 2.5 * z; coreY -= 1.8 * z; break;
          case 'N':  coreX = 0; coreY -= 2.5 * z; break;
          case 'NW': coreX = -2.5 * z; coreY -= 1.8 * z; break;
          case 'W':  coreX = -4 * z; break;
          case 'SW': coreX = -2.5 * z; coreY += 0.6 * z; break;
        }

        const coreGrad = ctx.createRadialGradient(coreX - 1 * z, coreY - 1 * z, 1 * z, coreX, coreY, 5 * z);
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.4, '#bbf7d0');
        coreGrad.addColorStop(0.8, '#4ade80');
        coreGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
        ctx.beginPath();
        ctx.arc(coreX, coreY, 5 * z, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.fill();

        // 3D Specular Curved Gel Highlight (Always top-left)
        ctx.beginPath();
        ctx.ellipse(-5 * z, cy - 5 * z, rx * 0.45, ry * 0.28, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fillStyle = isFacingBack ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.65)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(2 * z, cy - 8 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fill();

        // 8-Axis Eye & Facial Rendering
        const eyeBob = Math.sin(time * 7) * 0.5 * z;
        const drawEye = (ex, ey, ew, eh) => {
          ctx.beginPath();
          ctx.ellipse(ex, ey, ew, eh, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#0f172a';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ex - ew * 0.28, ey - eh * 0.32, Math.min(ew, eh) * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        };

        const drawCheek = (cx, cy) => {
          ctx.beginPath();
          ctx.ellipse(cx, cy, 2.2 * z, 1.3 * z, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(244, 114, 182, 0.4)';
          ctx.fill();
        };

        const drawSmile = (sx, sy, rad) => {
          ctx.beginPath();
          ctx.arc(sx, sy, rad, 0.15 * Math.PI, 0.85 * Math.PI, false);
          ctx.strokeStyle = '#052e16';
          ctx.lineWidth = 1.2 * z;
          ctx.stroke();
        };

        // The face slides round the body toward the facing: two eyes head-on, one
        // in profile (E / W), and from behind only the edge of an eye peeks out
        const FACE = { S: [0, 1], SE: [0.55, 1], E: [0.95, 1], SW: [-0.55, 1], W: [-0.95, 1], NE: [0.75, -1], NW: [-0.75, -1], N: [0, -1] };
        const [turn, front] = FACE[rawFacing] || FACE.S;
        const side = turn >= 0 ? 1 : -1, t = Math.abs(turn);
        if (front > 0) {
          const ox = turn * 7.5 * z;
          const spread = 3.8 * z * (1 - t * 0.55);
          const profile = t > 0.9;
          if (!profile) {
            drawEye(ox - spread * side, cy - 1 * z + eyeBob, 2.8 * z, 3.4 * z);
            drawEye(ox + spread * side, cy - 1 * z + eyeBob, 2.8 * z * (1 - t * 0.35), 3.4 * z);
            drawSmile(ox + side * t * 1.4 * z, cy + 2.5 * z + eyeBob, 2.4 * z * (1 - t * 0.25));
            drawCheek(ox - side * (spread + 2.4 * z), cy + 1.2 * z + eyeBob);
            drawCheek(ox + side * (spread + 2.0 * z * (1 - t * 0.35)), cy + 1.2 * z + eyeBob);
          } else {
            drawEye(ox, cy - 1 * z + eyeBob, 2.5 * z, 3.4 * z);
            drawSmile(ox + side * 2.2 * z, cy + 2.2 * z + eyeBob, 1.8 * z);
            drawCheek(ox - side * 2.6 * z, cy + 1.4 * z + eyeBob);
          }
        } else if (t > 0) {
          // three-quarter back: dorsal gel fold + near eye rim & cheek peeking at the dome edge
          ctx.strokeStyle = 'rgba(134, 239, 172, 0.35)';
          ctx.lineWidth = 1.2 * z;
          ctx.beginPath();
          ctx.arc(-side * 2 * z, cy + 1 * z, rx * 0.55, -0.3 * Math.PI, 0.4 * Math.PI, false);
          ctx.stroke();
          drawCheek(turn * 9.5 * z, cy + 0.5 * z + eyeBob);
          drawEye(turn * 11.5 * z, cy - 2.0 * z + eyeBob, 1.5 * z, 2.8 * z);
        } else {
          // pure back (N): subtle dorsal gel ripples
          ctx.strokeStyle = 'rgba(134, 239, 172, 0.35)';
          ctx.lineWidth = 1.2 * z;
          ctx.beginPath();
          ctx.arc(0, cy + 2 * z, rx * 0.5, 0.2 * Math.PI, 0.8 * Math.PI, false);
          ctx.stroke();
        }

        ctx.restore();

      } else if (mob.type === 'goblin') {
        // --- 8-AXIS 3D Volumetric Goblin Warrior ---
        ctx.save();
        if (isWest) ctx.scale(-1, 1);

        const gobWalk = Math.sin(time * 8 + (mob.x || 0));
        const bobY = Math.abs(gobWalk) * 2 * z;
        const torsoY = -20 * z - bobY;
        const headY = torsoY - 8 * z;

        if (isPureFront) {
          // --- GOBLIN: SOUTH (PURE FRONTAL) ---
          // Both legs side by side
          [[-4 * z, gobWalk * 0.4], [4 * z, -gobWalk * 0.4]].forEach(([lx, lrot]) => {
            ctx.save();
            ctx.translate(lx, -9 * z);
            ctx.rotate(lrot);
            ctx.fillStyle = '#16a34a';
            ctx.fillRect(-2.5 * z, 0, 5 * z, 6 * z);
            ctx.fillStyle = '#166534';
            ctx.fillRect(-2 * z, 5 * z, 4 * z, 5 * z);
            ctx.beginPath();
            ctx.ellipse(0, 9 * z, 3.5 * z, 2 * z, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#15803d';
            ctx.fill();
            ctx.restore();
          });

          // Torso (Frontal chest & leather belt with centered buckle)
          ctx.fillStyle = '#14532d';
          ctx.fillRect(-6 * z, torsoY + 8 * z, 12 * z, 4 * z);
          const torsoGrad = ctx.createRadialGradient(0, torsoY + 3 * z, 2 * z, 0, torsoY + 5 * z, 9 * z);
          torsoGrad.addColorStop(0, '#4ade80');
          torsoGrad.addColorStop(0.5, '#22c55e');
          torsoGrad.addColorStop(1, '#15803d');
          ctx.fillStyle = torsoGrad;
          ctx.beginPath();
          drawRoundRect(ctx, -6.5 * z, torsoY, 13 * z, 11 * z, 4 * z);
          ctx.fill();
          ctx.strokeStyle = '#14532d';
          ctx.lineWidth = 1 * z;
          ctx.stroke();

          // Harness & Gold Belt Buckle (Centered)
          ctx.fillStyle = '#451a03';
          ctx.fillRect(-6.5 * z, torsoY + 8 * z, 13 * z, 2.5 * z);
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(-2 * z, torsoY + 7.5 * z, 4 * z, 3.5 * z);
          ctx.fillStyle = '#451a03';
          ctx.fillRect(-0.8 * z, torsoY + 8.5 * z, 1.6 * z, 1.5 * z);

          // Head (Centered Frontal)
          const headGrad = ctx.createRadialGradient(0, headY, 2 * z, 0, headY, 8 * z);
          headGrad.addColorStop(0, '#4ade80');
          headGrad.addColorStop(0.5, '#22c55e');
          headGrad.addColorStop(1, '#15803d');
          ctx.fillStyle = headGrad;
          ctx.beginPath();
          ctx.ellipse(0, headY, 7.5 * z, 6.5 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#14532d';
          ctx.lineWidth = 1 * z;
          ctx.stroke();

          // Symmetrical Goblin Ears (Left & Right)
          [[-1, -6 * z], [1, 6 * z]].forEach(([side, ex]) => {
            ctx.fillStyle = '#14532d';
            ctx.beginPath();
            ctx.moveTo(ex, headY - 1 * z);
            ctx.lineTo(ex + 6 * side * z, headY - 6 * z);
            ctx.lineTo(ex, headY + 3 * z);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#0f3d1e';
            ctx.beginPath();
            ctx.moveTo(ex + 1 * side * z, headY - 0.5 * z);
            ctx.lineTo(ex + 5 * side * z, headY - 4.5 * z);
            ctx.lineTo(ex + 1 * side * z, headY + 2 * z);
            ctx.closePath();
            ctx.fill();
          });

          // Frontal Snout
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.ellipse(0, headY + 2.5 * z, 4.5 * z, 3 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // Both Tusks jutting up
          ctx.fillStyle = '#fef3c7';
          [[-2.6 * z], [2.6 * z]].forEach(([tx]) => {
            ctx.beginPath();
            ctx.moveTo(tx - 0.8 * z, headY + 3.5 * z);
            ctx.lineTo(tx, headY - 0.5 * z);
            ctx.lineTo(tx + 0.8 * z, headY + 3.5 * z);
            ctx.closePath();
            ctx.fill();
          });

          // Both Yellow Amber Eyes
          [[-2.8 * z], [2.8 * z]].forEach(([ex]) => {
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(ex, headY - 1.2 * z, 1.8 * z, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(ex - 0.4 * z, headY - 2 * z, 0.8 * z, 1.8 * z);
          });

          // Left Arm (Clenched fist) & Right Arm (War Club ready)
          ctx.save();
          ctx.translate(-7.5 * z, torsoY + 2 * z);
          ctx.fillStyle = '#166534';
          ctx.fillRect(-2 * z, 0, 4 * z, 6 * z);
          ctx.beginPath();
          ctx.arc(0, 7 * z, 2.5 * z, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Spiked Club in right hand forward
          ctx.save();
          ctx.translate(7.5 * z, torsoY + 2 * z);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(-2 * z, 0, 4 * z, 6 * z);
          ctx.beginPath();
          ctx.arc(0, 7 * z, 2.5 * z, 0, Math.PI * 2);
          ctx.fill();
          ctx.translate(1 * z, 6 * z);
          ctx.rotate(-0.4);
          ctx.fillStyle = '#78350f';
          ctx.fillRect(-1.5 * z, -12 * z, 3 * z, 16 * z);
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(-3 * z, -9 * z, 6 * z, 1.5 * z);
          ctx.fillRect(-3 * z, -5 * z, 6 * z, 1.5 * z);
          ctx.restore();

        } else if (isPureBack) {
          // --- GOBLIN: NORTH (PURE BACK) ---
          // Both legs walking away
          [[-4 * z, -gobWalk * 0.4], [4 * z, gobWalk * 0.4]].forEach(([lx, lrot]) => {
            ctx.save();
            ctx.translate(lx, -9 * z);
            ctx.rotate(lrot);
            ctx.fillStyle = '#14532d';
            ctx.fillRect(-2.5 * z, 0, 5 * z, 8 * z);
            ctx.fillStyle = '#0f3d1e';
            ctx.beginPath();
            ctx.ellipse(0, 8.5 * z, 3 * z, 1.6 * z, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          });

          // Left & Right Arms swinging from behind + War Club in right hand
          ctx.save();
          ctx.translate(-7.5 * z, torsoY + 2 * z);
          ctx.rotate(gobWalk * 0.25);
          ctx.fillStyle = '#14532d';
          ctx.fillRect(-2 * z, 0, 4 * z, 6 * z);
          ctx.beginPath();
          ctx.arc(0, 7 * z, 2.4 * z, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          ctx.save();
          ctx.translate(7.5 * z, torsoY + 2 * z);
          ctx.rotate(-gobWalk * 0.25);
          ctx.fillStyle = '#15803d';
          ctx.fillRect(-2 * z, 0, 4 * z, 6 * z);
          ctx.beginPath();
          ctx.arc(0, 7 * z, 2.4 * z, 0, Math.PI * 2);
          ctx.fill();
          ctx.translate(1 * z, 4 * z);
          ctx.rotate(0.45);
          ctx.fillStyle = '#78350f';
          ctx.fillRect(-1.5 * z, -14 * z, 3 * z, 16 * z);
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(-3 * z, -11 * z, 6 * z, 1.5 * z);
          ctx.fillRect(-3 * z, -7 * z, 6 * z, 1.5 * z);
          ctx.restore();

          // Torso (Dorsal view with crossed harness straps)
          ctx.fillStyle = '#14532d';
          ctx.beginPath();
          drawRoundRect(ctx, -6.5 * z, torsoY, 13 * z, 11 * z, 4 * z);
          ctx.fill();
          ctx.strokeStyle = '#0f3d1e';
          ctx.lineWidth = 1 * z;
          ctx.stroke();

          // Crossed leather straps ('X') & belt
          ctx.fillStyle = '#451a03';
          ctx.fillRect(-6.5 * z, torsoY + 8 * z, 13 * z, 2.5 * z);
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 2 * z;
          ctx.beginPath();
          ctx.moveTo(-5 * z, torsoY + 1 * z); ctx.lineTo(5 * z, torsoY + 10 * z);
          ctx.moveTo(5 * z, torsoY + 1 * z); ctx.lineTo(-5 * z, torsoY + 10 * z);
          ctx.stroke();

          // Head Back (Messy spiky goblin hair tufts, no eyes/tusks)
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.ellipse(0, headY, 7.5 * z, 6.5 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // Back of ears angled outward
          [[-1, -6 * z], [1, 6 * z]].forEach(([side, ex]) => {
            ctx.fillStyle = '#14532d';
            ctx.beginPath();
            ctx.moveTo(ex, headY - 1 * z);
            ctx.lineTo(ex + 5.5 * side * z, headY - 5.5 * z);
            ctx.lineTo(ex, headY + 2.5 * z);
            ctx.closePath();
            ctx.fill();
          });

          // Spiky dark hair
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.moveTo(-4 * z, headY - 4 * z);
          ctx.lineTo(-2.5 * z, headY - 9 * z);
          ctx.lineTo(0, headY - 5 * z);
          ctx.lineTo(2.5 * z, headY - 9 * z);
          ctx.lineTo(4 * z, headY - 4 * z);
          ctx.closePath();
          ctx.fill();

        } else if (isQuarterBack) {
          // --- GOBLIN: NE / NW (3/4 BACK) ---
          // Far Arm & Spiked Club reaching forward-away (behind torso)
          ctx.save();
          ctx.translate(5.5 * z, torsoY + 1.5 * z);
          ctx.rotate(-0.25 - gobWalk * 0.2);
          ctx.fillStyle = '#15803d';
          ctx.fillRect(-1.8 * z, 0, 3.6 * z, 6 * z);
          ctx.translate(1 * z, 5 * z);
          ctx.rotate(0.4);
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.moveTo(-1.2 * z, 6 * z);
          ctx.lineTo(1.2 * z, 6 * z);
          ctx.lineTo(3.2 * z, -13 * z);
          ctx.lineTo(-2.5 * z, -13 * z);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1.8 * z;
          ctx.beginPath();
          ctx.moveTo(-2 * z, -9 * z); ctx.lineTo(-4.5 * z, -10 * z);
          ctx.moveTo(2.5 * z, -7 * z); ctx.lineTo(5 * z, -6 * z);
          ctx.stroke();
          ctx.restore();

          // Far Leg & Near Leg walking away
          ctx.save();
          ctx.translate(3 * z, -9 * z);
          ctx.rotate(-gobWalk * 0.4);
          ctx.fillStyle = '#0f3d1e';
          ctx.fillRect(-2.2 * z, 0, 4.4 * z, 8 * z);
          ctx.restore();

          ctx.save();
          ctx.translate(-3.5 * z, -9 * z);
          ctx.rotate(gobWalk * 0.4);
          ctx.fillStyle = '#14532d';
          ctx.fillRect(-2.4 * z, 0, 4.8 * z, 8.5 * z);
          ctx.fillStyle = '#0f3d1e';
          ctx.beginPath();
          ctx.ellipse(0, 8.5 * z, 3.2 * z, 1.6 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // 3/4 Dorsal Torso with Crossed Harness Straps
          ctx.fillStyle = '#14532d';
          ctx.beginPath();
          drawRoundRect(ctx, -6 * z, torsoY, 12 * z, 11 * z, 4 * z);
          ctx.fill();
          ctx.strokeStyle = '#0f3d1e';
          ctx.lineWidth = 1 * z;
          ctx.stroke();

          ctx.fillStyle = '#451a03';
          ctx.fillRect(-6 * z, torsoY + 8 * z, 12 * z, 2.5 * z);
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 2 * z;
          ctx.beginPath();
          ctx.moveTo(-5 * z, torsoY + 1 * z); ctx.lineTo(3.5 * z, torsoY + 10 * z);
          ctx.moveTo(3.5 * z, torsoY + 1 * z); ctx.lineTo(-5 * z, torsoY + 10 * z);
          ctx.stroke();

          // Far Ear (behind head on right)
          ctx.fillStyle = '#0f3d1e';
          ctx.beginPath();
          ctx.moveTo(4 * z, headY - 1.5 * z);
          ctx.lineTo(10 * z, headY - 5.5 * z);
          ctx.lineTo(5 * z, headY + 2 * z);
          ctx.closePath();
          ctx.fill();

          // Hint of Snout & Tusk peeking on far right edge
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.ellipse(5.5 * z, headY + 1.5 * z, 2.5 * z, 2 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fef3c7';
          ctx.beginPath();
          ctx.moveTo(6 * z, headY + 2 * z);
          ctx.lineTo(7.2 * z, headY - 1 * z);
          ctx.lineTo(7.8 * z, headY + 2 * z);
          ctx.closePath();
          ctx.fill();

          // 3/4 Back Head
          const headGrad = ctx.createRadialGradient(-2 * z, headY - 1 * z, 1.5 * z, 0, headY, 7.5 * z);
          headGrad.addColorStop(0, '#22c55e');
          headGrad.addColorStop(0.6, '#15803d');
          headGrad.addColorStop(1, '#14532d');
          ctx.fillStyle = headGrad;
          ctx.beginPath();
          ctx.ellipse(0, headY, 6.8 * z, 6.3 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // Near Ear (prominent, sweeping back-left)
          ctx.fillStyle = '#14532d';
          ctx.beginPath();
          ctx.moveTo(-4.5 * z, headY - 1 * z);
          ctx.lineTo(-11.5 * z, headY - 6 * z);
          ctx.lineTo(-5.5 * z, headY + 3 * z);
          ctx.closePath();
          ctx.fill();

          // Spiky dark hair tuft on crown/back
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.moveTo(-4.5 * z, headY - 3.5 * z);
          ctx.lineTo(-3 * z, headY - 8.5 * z);
          ctx.lineTo(-0.5 * z, headY - 5 * z);
          ctx.lineTo(1.5 * z, headY - 8.5 * z);
          ctx.lineTo(3 * z, headY - 4.5 * z);
          ctx.closePath();
          ctx.fill();

          // Near Back Arm swinging in foreground
          ctx.save();
          ctx.translate(-6 * z, torsoY + 2 * z);
          ctx.rotate(0.2 + gobWalk * 0.3);
          ctx.fillStyle = '#166534';
          ctx.fillRect(-2 * z, 0, 4 * z, 6.5 * z);
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.arc(0, 7.5 * z, 2.5 * z, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

        } else if (isPureSide) {
          // --- GOBLIN: E / W (PURE SIDE PROFILE) ---
          // Far Leg (behind)
          ctx.save();
          ctx.translate(-1 * z, -9 * z);
          ctx.rotate(-gobWalk * 0.45);
          ctx.fillStyle = '#14532d';
          ctx.fillRect(-2 * z, 0, 4 * z, 6 * z);
          ctx.fillStyle = '#0f3d1e';
          ctx.fillRect(-1.8 * z, 5 * z, 3.6 * z, 5 * z);
          ctx.beginPath();
          ctx.ellipse(1.5 * z, 9 * z, 3.5 * z, 1.8 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Near Leg (foreground)
          ctx.save();
          ctx.translate(1 * z, -9 * z);
          ctx.rotate(gobWalk * 0.45);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(-2.2 * z, 0, 4.4 * z, 6 * z);
          ctx.fillStyle = '#166534';
          ctx.fillRect(-1.8 * z, 5 * z, 3.6 * z, 5 * z);
          ctx.beginPath();
          ctx.ellipse(2 * z, 9 * z, 3.8 * z, 2 * z, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#15803d';
          ctx.fill();
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(4.8 * z, 8 * z, 1.5 * z, 2 * z);
          ctx.restore();

          // Profile Torso (narrower side silhouette)
          const torsoGrad = ctx.createRadialGradient(1 * z, torsoY + 3 * z, 1.5 * z, 0, torsoY + 5 * z, 7.5 * z);
          torsoGrad.addColorStop(0, '#4ade80');
          torsoGrad.addColorStop(0.5, '#22c55e');
          torsoGrad.addColorStop(1, '#14532d');
          ctx.fillStyle = torsoGrad;
          ctx.beginPath();
          drawRoundRect(ctx, -4.8 * z, torsoY, 9.6 * z, 11 * z, 3.8 * z);
          ctx.fill();
          ctx.strokeStyle = '#14532d';
          ctx.lineWidth = 1 * z;
          ctx.stroke();

          // Diagonal leather strap & belt with front-edge buckle
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 1.8 * z;
          ctx.beginPath();
          ctx.moveTo(-3.5 * z, torsoY + 1 * z);
          ctx.lineTo(3.5 * z, torsoY + 8 * z);
          ctx.stroke();
          ctx.fillStyle = '#451a03';
          ctx.fillRect(-4.8 * z, torsoY + 8 * z, 9.6 * z, 2.5 * z);
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(2.2 * z, torsoY + 7.5 * z, 2.8 * z, 3.5 * z);

          // Profile Head & Protruding Goblin Snout
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.ellipse(5.2 * z, headY + 1.8 * z, 3.8 * z, 2.6 * z, 0.1, 0, Math.PI * 2);
          ctx.fill();

          // Upward Tusk on Snout Tip
          ctx.fillStyle = '#fef3c7';
          ctx.beginPath();
          ctx.moveTo(5.2 * z, headY + 3 * z);
          ctx.lineTo(6.8 * z, headY - 1 * z);
          ctx.lineTo(7.8 * z, headY + 2.8 * z);
          ctx.closePath();
          ctx.fill();

          const headGrad = ctx.createRadialGradient(1 * z, headY - 1 * z, 1.5 * z, 0, headY, 7 * z);
          headGrad.addColorStop(0, '#4ade80');
          headGrad.addColorStop(0.55, '#22c55e');
          headGrad.addColorStop(1, '#15803d');
          ctx.fillStyle = headGrad;
          ctx.beginPath();
          ctx.ellipse(0, headY, 5.8 * z, 6.2 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // Spiky dark hair tuft at crown
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.moveTo(-4 * z, headY - 4 * z);
          ctx.lineTo(-2.5 * z, headY - 8.5 * z);
          ctx.lineTo(0, headY - 5.5 * z);
          ctx.lineTo(1.5 * z, headY - 8 * z);
          ctx.lineTo(2.5 * z, headY - 5 * z);
          ctx.closePath();
          ctx.fill();

          // Pointed Ear sweeping back from temple
          ctx.fillStyle = '#14532d';
          ctx.beginPath();
          ctx.moveTo(-1.5 * z, headY - 1 * z);
          ctx.lineTo(-10.5 * z, headY - 5.5 * z);
          ctx.lineTo(-3 * z, headY + 2.8 * z);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#0f3d1e';
          ctx.beginPath();
          ctx.moveTo(-2.5 * z, headY - 0.5 * z);
          ctx.lineTo(-8.5 * z, headY - 4 * z);
          ctx.lineTo(-3.5 * z, headY + 1.8 * z);
          ctx.closePath();
          ctx.fill();

          // Single Profile Amber Eye
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.ellipse(3.2 * z, headY - 1.2 * z, 1.7 * z, 2 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(3.6 * z, headY - 2.2 * z, 0.9 * z, 2 * z);

          // Near Arm & Spiked War Club held forward
          ctx.save();
          ctx.translate(1 * z, torsoY + 2.5 * z);
          ctx.rotate(-0.2 + Math.sin(time * 4) * 0.15);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(-1.8 * z, 0, 3.6 * z, 6.5 * z);
          ctx.fillStyle = '#166534';
          ctx.beginPath();
          ctx.arc(0, 7 * z, 2.4 * z, 0, Math.PI * 2);
          ctx.fill();

          ctx.translate(1 * z, 6 * z);
          ctx.rotate(-0.75);
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.moveTo(-1.5 * z, 9 * z);
          ctx.lineTo(1.5 * z, 9 * z);
          ctx.lineTo(3.8 * z, -14 * z);
          ctx.lineTo(-2.8 * z, -14 * z);
          ctx.closePath();
          ctx.fill();
          [[-2 * z, -10 * z, -5 * z, -11 * z], [3 * z, -8 * z, 6 * z, -7 * z]].forEach(([bx, by, tx, ty]) => {
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 2 * z;
            ctx.beginPath();
            ctx.moveTo(bx, by); ctx.lineTo(tx, ty);
            ctx.stroke();
          });
          ctx.restore();

        } else {
          // --- GOBLIN: SE / SW (3/4 FRONT) ---
          // Back Arm
          ctx.save();
          ctx.translate(-6.5 * z, -18 * z - bobY);
          ctx.rotate(-0.2 + gobWalk * 0.3);
          ctx.fillStyle = '#14532d';
          ctx.fillRect(-2 * z, 0, 4 * z, 7 * z);
          ctx.fillStyle = '#166534';
          ctx.beginPath();
          ctx.arc(0, 8 * z, 2.5 * z, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Back Leg & Clawed Foot
          ctx.save();
          ctx.translate(-3.5 * z, -9 * z);
          ctx.rotate(-gobWalk * 0.4);
          ctx.fillStyle = '#14532d';
          ctx.fillRect(-2.5 * z, 0, 5 * z, 6 * z);
          ctx.fillStyle = '#0f3d1e';
          ctx.fillRect(-2 * z, 5 * z, 4 * z, 5 * z);
          ctx.beginPath();
          ctx.ellipse(-1.5 * z, 9 * z, 3.5 * z, 1.8 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Front Leg & Clawed Foot
          ctx.save();
          ctx.translate(3 * z, -9 * z);
          ctx.rotate(gobWalk * 0.4);
          const thighGrad = ctx.createLinearGradient(-3 * z, 0, 3 * z, 0);
          thighGrad.addColorStop(0, '#22c55e');
          thighGrad.addColorStop(0.5, '#16a34a');
          thighGrad.addColorStop(1, '#15803d');
          ctx.fillStyle = thighGrad;
          ctx.fillRect(-2.5 * z, 0, 5 * z, 6 * z);
          ctx.fillStyle = '#166534';
          ctx.fillRect(-2 * z, 5 * z, 4 * z, 5 * z);
          ctx.beginPath();
          ctx.ellipse(1 * z, 9 * z, 4 * z, 2 * z, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#15803d';
          ctx.fill();
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(4 * z, 8 * z, 1.5 * z, 2 * z);
          ctx.restore();

          // 3/4 Torso
          ctx.fillStyle = '#14532d';
          ctx.fillRect(-6 * z, torsoY + 8 * z, 12 * z, 4 * z);
          const torsoGrad = ctx.createRadialGradient(-1 * z, torsoY + 2 * z, 2 * z, 0, torsoY + 4 * z, 9 * z);
          torsoGrad.addColorStop(0, '#4ade80');
          torsoGrad.addColorStop(0.4, '#22c55e');
          torsoGrad.addColorStop(1, '#14532d');
          ctx.fillStyle = torsoGrad;
          ctx.beginPath();
          drawRoundRect(ctx, -6 * z, torsoY, 12 * z, 11 * z, 4 * z);
          ctx.fill();
          ctx.strokeStyle = '#14532d';
          ctx.lineWidth = 1 * z;
          ctx.stroke();

          // Leather Belt & 3/4 Shifted Buckle
          ctx.fillStyle = '#451a03';
          ctx.fillRect(-6 * z, torsoY + 8 * z, 12 * z, 2.5 * z);
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(0, torsoY + 7.5 * z, 3.5 * z, 3.5 * z);
          ctx.fillStyle = '#451a03';
          ctx.fillRect(1 * z, torsoY + 8.5 * z, 1.5 * z, 1.5 * z);

          // Far Ear (right side, behind head)
          ctx.fillStyle = '#0f3d1e';
          ctx.beginPath();
          ctx.moveTo(4.5 * z, headY - 1.5 * z);
          ctx.lineTo(10 * z, headY - 5.5 * z);
          ctx.lineTo(5 * z, headY + 2 * z);
          ctx.closePath();
          ctx.fill();

          // 3/4 Head
          const headGrad = ctx.createRadialGradient(-1 * z, headY - 1 * z, 2 * z, 0, headY, 8 * z);
          headGrad.addColorStop(0, '#4ade80');
          headGrad.addColorStop(0.5, '#22c55e');
          headGrad.addColorStop(1, '#15803d');
          ctx.fillStyle = headGrad;
          ctx.beginPath();
          ctx.ellipse(0, headY, 7 * z, 6.5 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // Near Ear (left side)
          ctx.fillStyle = '#14532d';
          ctx.beginPath();
          ctx.moveTo(-5 * z, headY - 1 * z);
          ctx.lineTo(-12 * z, headY - 6 * z);
          ctx.lineTo(-6 * z, headY + 3 * z);
          ctx.closePath();
          ctx.fill();

          // 3/4 Snout, Both Tusks & Both Eyes
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.ellipse(2.2 * z, headY + 2.2 * z, 4.2 * z, 2.8 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#fef3c7';
          [[-0.2 * z], [4.2 * z]].forEach(([tx]) => {
            ctx.beginPath();
            ctx.moveTo(tx - 0.8 * z, headY + 3.5 * z);
            ctx.lineTo(tx + 0.3 * z, headY - 0.4 * z);
            ctx.lineTo(tx + 1.1 * z, headY + 3.5 * z);
            ctx.closePath();
            ctx.fill();
          });

          [[-0.8 * z, 1.8 * z], [3.6 * z, 1.5 * z]].forEach(([ex, er]) => {
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(ex, headY - 1.4 * z, er, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(ex, headY - 2.3 * z, 0.8 * z, 1.8 * z);
          });

          // Front Arm & Spiked Club
          ctx.save();
          ctx.translate(5 * z, torsoY + 2 * z);
          ctx.rotate(0.3 + Math.sin(time * 4) * 0.15);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(-2 * z, 0, 4 * z, 6 * z);
          ctx.fillStyle = '#166534';
          ctx.beginPath();
          ctx.arc(0, 7 * z, 2.5 * z, 0, Math.PI * 2);
          ctx.fill();

          // Spiked War Club
          ctx.translate(1 * z, 6 * z);
          ctx.rotate(-0.7);
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.moveTo(-1.5 * z, 10 * z);
          ctx.lineTo(1.5 * z, 10 * z);
          ctx.lineTo(4 * z, -14 * z);
          ctx.lineTo(-3 * z, -14 * z);
          ctx.closePath();
          ctx.fill();
          [[-2 * z, -10 * z, -5 * z, -11 * z], [3 * z, -8 * z, 6 * z, -7 * z]].forEach(([bx, by, tx, ty]) => {
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 2 * z;
            ctx.beginPath();
            ctx.moveTo(bx, by); ctx.lineTo(tx, ty);
            ctx.stroke();
          });
          ctx.restore();
        }

        ctx.restore();

      } else if (mob.type === 'skeleton') {
        // --- 8-AXIS 3D Undead Skeleton Warrior ---
        ctx.save();
        if (isWest) ctx.scale(-1, 1);

        const skelWalk = Math.sin(time * 6 + (mob.x || 0));
        const skelBob = Math.abs(skelWalk) * 1.5 * z;
        const skelTorsoY = -21 * z - skelBob;
        const skullY = skelTorsoY - 8.5 * z;
        const flamePulse = Math.sin(time * 8) * 0.3 + 0.7;

        if (isPureFront) {
          // --- SKELETON: SOUTH (PURE FRONTAL) ---
          // Both leg bones
          [[-3 * z, skelWalk * 0.35], [3 * z, -skelWalk * 0.35]].forEach(([lx, lrot]) => {
            ctx.save();
            ctx.translate(lx, -10 * z);
            ctx.rotate(lrot);
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(-1.2 * z, 0, 2.4 * z, 6 * z);
            ctx.beginPath();
            ctx.arc(0, 6 * z, 2 * z, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(-1.2 * z, 6 * z, 2.4 * z, 5 * z);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(-1 * z, 10 * z, 4 * z, 1.8 * z);
            ctx.restore();
          });

          // Pelvic Basin & Spine in center
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.moveTo(-4 * z, skelTorsoY + 9 * z);
          ctx.lineTo(4 * z, skelTorsoY + 9 * z);
          ctx.lineTo(2 * z, skelTorsoY + 12 * z);
          ctx.lineTo(-2 * z, skelTorsoY + 12 * z);
          ctx.closePath();
          ctx.fill();

          // Hollow Chest Shadow
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.beginPath();
          ctx.ellipse(0, skelTorsoY + 4 * z, 5.5 * z, 5.5 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // Spine Column
          for (let s = 0; s < 4; s++) {
            ctx.fillStyle = s % 2 === 0 ? '#f8fafc' : '#cbd5e1';
            ctx.fillRect(-1.2 * z, skelTorsoY + (s * 2.2) * z, 2.4 * z, 1.6 * z);
          }

          // Symmetrical Ribs (Left & Right pairs)
          for (let r = 0; r < 4; r++) {
            const ry = skelTorsoY + (1.5 + r * 1.8) * z;
            const rw = (5.8 - r * 0.4) * z;
            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 1.6 * z;
            ctx.beginPath();
            ctx.arc(-1 * z, ry, rw * 0.5, Math.PI * 0.6, Math.PI * 1.3, false);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(1 * z, ry, rw * 0.5, -Math.PI * 0.3, Math.PI * 0.4, false);
            ctx.stroke();
          }

          // Left & Right Skeletal Arms
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(-7.5 * z, skelTorsoY + 0.5 * z, 2 * z, 5 * z);
          ctx.fillRect(5.5 * z, skelTorsoY + 0.5 * z, 2 * z, 5 * z);

          // Frontal Skull
          const skullGrad = ctx.createRadialGradient(0, skullY - 1 * z, 1 * z, 0, skullY, 7 * z);
          skullGrad.addColorStop(0, '#ffffff');
          skullGrad.addColorStop(0.5, '#f1f5f9');
          skullGrad.addColorStop(1, '#94a3b8');
          ctx.fillStyle = skullGrad;
          ctx.beginPath();
          ctx.arc(0, skullY, 6.5 * z, 0, Math.PI * 2);
          ctx.fill();

          // Teeth & Jaw
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(-3 * z, skullY + 4 * z, 6 * z, 3 * z);
          ctx.fillStyle = '#1e293b';
          for (let t = -2; t <= 2; t++) {
            ctx.fillRect(t * 1.2 * z, skullY + 4.5 * z, 0.6 * z, 2.5 * z);
          }

          // Both Soul Flame Eyes
          [[-2.6 * z], [2.6 * z]].forEach(([ex]) => {
            ctx.beginPath();
            ctx.arc(ex, skullY, 2.2 * z, 0, Math.PI * 2);
            ctx.fillStyle = '#090d16';
            ctx.fill();
            const soulGrad = ctx.createRadialGradient(ex, skullY, 0.4 * z, ex, skullY, 2.5 * z);
            soulGrad.addColorStop(0, '#ffffff');
            soulGrad.addColorStop(0.3, '#f87171');
            soulGrad.addColorStop(0.7, `rgba(239, 68, 68, ${flamePulse})`);
            soulGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
            ctx.fillStyle = soulGrad;
            ctx.beginPath();
            ctx.arc(ex, skullY - 0.4 * z, 2.2 * z, 0, Math.PI * 2);
            ctx.fill();
          });

          // Buckler in left hand & Broadsword in right hand
          ctx.save();
          ctx.translate(-7 * z, skelTorsoY + 5 * z);
          ctx.beginPath();
          ctx.ellipse(0, 0, 7 * z, 9 * z, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#475569';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, 0, 2.5 * z, 0, Math.PI * 2);
          ctx.fillStyle = '#d97706';
          ctx.fill();
          ctx.restore();

          ctx.save();
          ctx.translate(7 * z, skelTorsoY + 5 * z);
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(-1.5 * z, -20 * z, 3 * z, 20 * z);
          ctx.fillStyle = '#475569';
          ctx.fillRect(-4 * z, 0, 8 * z, 2 * z);
          ctx.restore();

        } else if (isPureBack) {
          // --- SKELETON: NORTH (PURE BACK) ---
          // Both legs walking away
          [[-3 * z, -skelWalk * 0.35], [3 * z, skelWalk * 0.35]].forEach(([lx, lrot]) => {
            ctx.save();
            ctx.translate(lx, -10 * z);
            ctx.rotate(lrot);
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(-1.2 * z, 0, 2.4 * z, 6 * z);
            ctx.beginPath();
            ctx.arc(0, 6 * z, 1.8 * z, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#64748b';
            ctx.fillRect(-1.1 * z, 6 * z, 2.2 * z, 5 * z);
            ctx.restore();
          });

          // Dorsal Pelvis & Ribcage Silhouette
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.moveTo(-4 * z, skelTorsoY + 9 * z);
          ctx.lineTo(4 * z, skelTorsoY + 9 * z);
          ctx.lineTo(2 * z, skelTorsoY + 12 * z);
          ctx.lineTo(-2 * z, skelTorsoY + 12 * z);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.beginPath();
          ctx.ellipse(0, skelTorsoY + 4 * z, 5 * z, 5 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          for (let r = 0; r < 4; r++) {
            const ry = skelTorsoY + (1.5 + r * 1.8) * z;
            const rw = (5.4 - r * 0.4) * z;
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.4 * z;
            ctx.beginPath();
            ctx.arc(-1 * z, ry, rw * 0.5, Math.PI * 0.6, Math.PI * 1.3, false);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(1 * z, ry, rw * 0.5, -Math.PI * 0.3, Math.PI * 0.4, false);
            ctx.stroke();
          }

          // Dorsal Spinal Column (Running up back)
          for (let s = 0; s < 6; s++) {
            ctx.fillStyle = s % 2 === 0 ? '#f8fafc' : '#cbd5e1';
            ctx.fillRect(-1.5 * z, skelTorsoY + (s * 2.2) * z, 3 * z, 1.8 * z);
          }

          // Scapulae (Shoulder blades)
          ctx.fillStyle = '#cbd5e1';
          [[-1, -4 * z], [1, 4 * z]].forEach(([side, sx]) => {
            ctx.beginPath();
            ctx.moveTo(sx, skelTorsoY + 1 * z);
            ctx.lineTo(sx + 3 * side * z, skelTorsoY + 2 * z);
            ctx.lineTo(sx, skelTorsoY + 6 * z);
            ctx.closePath();
            ctx.fill();
          });

          // Left Arm & Buckler (seen from behind)
          ctx.save();
          ctx.translate(-6.5 * z, skelTorsoY + 3 * z);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(-1 * z, -2 * z, 2 * z, 6 * z);
          ctx.beginPath();
          ctx.ellipse(-1 * z, 3 * z, 5.5 * z, 8 * z, 0.15, 0, Math.PI * 2);
          ctx.fillStyle = '#334155';
          ctx.fill();
          ctx.restore();

          // Right Arm & Broadsword angled forward
          ctx.save();
          ctx.translate(6.5 * z, skelTorsoY + 3 * z);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(-1 * z, -2 * z, 2 * z, 6 * z);
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(-1.2 * z, -18 * z, 2.4 * z, 18 * z);
          ctx.fillStyle = '#475569';
          ctx.fillRect(-3.5 * z, 0, 7 * z, 1.8 * z);
          ctx.restore();

          // Back of Skull (No teeth or eyes)
          const skullGrad = ctx.createRadialGradient(0, skullY - 1 * z, 1 * z, 0, skullY, 7 * z);
          skullGrad.addColorStop(0, '#f8fafc');
          skullGrad.addColorStop(0.7, '#cbd5e1');
          skullGrad.addColorStop(1, '#64748b');
          ctx.fillStyle = skullGrad;
          ctx.beginPath();
          ctx.arc(0, skullY, 6.5 * z, 0, Math.PI * 2);
          ctx.fill();

          // Suture lines on cranial vault
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 0.8 * z;
          ctx.beginPath();
          ctx.moveTo(0, skullY - 5 * z); ctx.lineTo(0, skullY + 1 * z);
          ctx.moveTo(-3 * z, skullY - 2 * z); ctx.lineTo(3 * z, skullY - 2 * z);
          ctx.stroke();

        } else if (isQuarterBack) {
          // --- SKELETON: NE / NW (3/4 BACK) ---
          // Far Sword Arm (reaching forward-away)
          ctx.save();
          ctx.translate(5 * z, skelTorsoY + 1.5 * z);
          ctx.rotate(-0.2 + Math.sin(time * 5) * 0.1);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(-1 * z, 0, 2 * z, 6.5 * z);
          ctx.translate(0, 6 * z);
          ctx.rotate(0.35);
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(-1.3 * z, -19 * z, 2.6 * z, 19 * z);
          ctx.fillStyle = '#475569';
          ctx.fillRect(-3.5 * z, -1 * z, 7 * z, 1.8 * z);
          ctx.restore();

          // Legs walking away with knee joints
          [[-3 * z, skelWalk * 0.35, '#cbd5e1'], [2.5 * z, -skelWalk * 0.35, '#94a3b8']].forEach(([lx, lrot, col]) => {
            ctx.save();
            ctx.translate(lx, -10 * z);
            ctx.rotate(lrot);
            ctx.fillStyle = col;
            ctx.fillRect(-1.1 * z, 0, 2.2 * z, 6 * z);
            ctx.beginPath();
            ctx.arc(0, 6 * z, 1.8 * z, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(-1 * z, 6 * z, 2 * z, 5 * z);
            ctx.restore();
          });

          // 3/4 Dorsal Pelvis & Ribcage
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.moveTo(-4 * z, skelTorsoY + 9 * z);
          ctx.lineTo(3.5 * z, skelTorsoY + 9 * z);
          ctx.lineTo(2 * z, skelTorsoY + 12 * z);
          ctx.lineTo(-2 * z, skelTorsoY + 12 * z);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
          ctx.beginPath();
          ctx.ellipse(0, skelTorsoY + 4 * z, 4.8 * z, 5.2 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          for (let r = 0; r < 4; r++) {
            const ry = skelTorsoY + (1.5 + r * 1.8) * z;
            const rw = (5.2 - r * 0.35) * z;
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.5 * z;
            ctx.beginPath();
            ctx.arc(-1.2 * z, ry, rw * 0.5, Math.PI * 0.55, Math.PI * 1.3, false);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0.8 * z, ry, rw * 0.45, -Math.PI * 0.3, Math.PI * 0.45, false);
            ctx.stroke();
          }

          // Dorsal Spine & Scapulae
          for (let s = 0; s < 5; s++) {
            ctx.fillStyle = s % 2 === 0 ? '#f8fafc' : '#cbd5e1';
            ctx.fillRect(-2 * z, skelTorsoY + (s * 2.2) * z, 2.6 * z, 1.7 * z);
          }
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.moveTo(-4.2 * z, skelTorsoY + 1 * z);
          ctx.lineTo(-1.5 * z, skelTorsoY + 2 * z);
          ctx.lineTo(-3.5 * z, skelTorsoY + 6 * z);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(1.5 * z, skelTorsoY + 1 * z);
          ctx.lineTo(4.2 * z, skelTorsoY + 2 * z);
          ctx.lineTo(2.5 * z, skelTorsoY + 6 * z);
          ctx.closePath();
          ctx.fill();

          // 3/4 Back Skull with Cranial Sutures & Peeking Cheek/Eye Glow
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(2.5 * z, skullY + 3.2 * z, 3.2 * z, 2.5 * z);
          ctx.fillStyle = `rgba(239, 68, 68, ${flamePulse * 0.85})`;
          ctx.beginPath();
          ctx.arc(5.4 * z, skullY - 0.3 * z, 1.4 * z, 0, Math.PI * 2);
          ctx.fill();

          const skullGrad = ctx.createRadialGradient(-1.5 * z, skullY - 1.5 * z, 1 * z, 0, skullY, 7 * z);
          skullGrad.addColorStop(0, '#f8fafc');
          skullGrad.addColorStop(0.65, '#cbd5e1');
          skullGrad.addColorStop(1, '#64748b');
          ctx.fillStyle = skullGrad;
          ctx.beginPath();
          ctx.arc(0, skullY, 6.3 * z, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 0.8 * z;
          ctx.beginPath();
          ctx.moveTo(-1 * z, skullY - 5 * z); ctx.lineTo(-1 * z, skullY + 1 * z);
          ctx.moveTo(-3.5 * z, skullY - 2 * z); ctx.lineTo(2 * z, skullY - 2 * z);
          ctx.stroke();

          // Near Back Arm & Shield in foreground
          ctx.save();
          ctx.translate(-5.5 * z, -19 * z - skelBob);
          ctx.rotate(-0.15 + skelWalk * 0.2);
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(-1 * z, 0, 2 * z, 7 * z);
          ctx.translate(-1.5 * z, 6 * z);
          ctx.beginPath();
          ctx.ellipse(0, 0, 6.5 * z, 10.5 * z, -0.2, 0, Math.PI * 2);
          ctx.fillStyle = '#334155';
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(0, 0, 4.5 * z, 8.5 * z, -0.2, 0, Math.PI * 2);
          ctx.fillStyle = '#78350f';
          ctx.fill();
          ctx.restore();

        } else if (isPureSide) {
          // --- SKELETON: E / W (PURE SIDE PROFILE) ---
          // Far Arm & Shield (in profile at front edge)
          ctx.save();
          ctx.translate(3.5 * z, -19 * z - skelBob);
          ctx.beginPath();
          ctx.ellipse(2 * z, 5 * z, 3.2 * z, 10 * z, 0.1, 0, Math.PI * 2);
          ctx.fillStyle = '#334155';
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(2.8 * z, 5 * z, 1.8 * z, 8 * z, 0.1, 0, Math.PI * 2);
          ctx.fillStyle = '#78350f';
          ctx.fill();
          ctx.restore();

          // Far Leg & Near Leg (striding in profile)
          [[-1 * z, -skelWalk * 0.4, '#94a3b8'], [1 * z, skelWalk * 0.4, '#e2e8f0']].forEach(([lx, lrot, col]) => {
            ctx.save();
            ctx.translate(lx, -10 * z);
            ctx.rotate(lrot);
            ctx.fillStyle = col;
            ctx.fillRect(-1.1 * z, 0, 2.2 * z, 6 * z);
            ctx.beginPath();
            ctx.arc(0, 6 * z, 1.8 * z, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(-1.1 * z, 6 * z, 2.2 * z, 5 * z);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(-0.5 * z, 10 * z, 4 * z, 1.8 * z);
            ctx.restore();
          });

          // Profile Pelvis
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.ellipse(0, skelTorsoY + 10.5 * z, 3.2 * z, 2 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // Dark ribcage interior & Curved Dorsal Spine + Profile Ribs
          ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
          ctx.beginPath();
          ctx.ellipse(0.5 * z, skelTorsoY + 4.5 * z, 3.8 * z, 5 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          for (let s = 0; s < 5; s++) {
            ctx.fillStyle = s % 2 === 0 ? '#f8fafc' : '#cbd5e1';
            ctx.fillRect(-3.2 * z, skelTorsoY + (s * 2.1) * z, 2.2 * z, 1.6 * z);
          }

          for (let r = 0; r < 4; r++) {
            const ry = skelTorsoY + (1.5 + r * 1.9) * z;
            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 1.5 * z;
            ctx.beginPath();
            ctx.moveTo(-2.2 * z, ry);
            ctx.quadraticCurveTo(2 * z, ry - 0.6 * z, (4.2 - r * 0.35) * z, ry + 0.8 * z);
            ctx.stroke();
          }

          // Profile Skull & Protruding Jaw
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(1 * z, skullY + 3.5 * z, 4.8 * z, 3.2 * z);
          ctx.fillStyle = '#1e293b';
          for (let t = 0; t < 3; t++) {
            ctx.fillRect((2 + t * 1.2) * z, skullY + 4.2 * z, 0.6 * z, 2.2 * z);
          }

          const skullGrad = ctx.createRadialGradient(0.5 * z, skullY - 1.5 * z, 1 * z, -0.5 * z, skullY, 6.5 * z);
          skullGrad.addColorStop(0, '#ffffff');
          skullGrad.addColorStop(0.55, '#f1f5f9');
          skullGrad.addColorStop(1, '#64748b');
          ctx.fillStyle = skullGrad;
          ctx.beginPath();
          ctx.ellipse(-0.3 * z, skullY, 5.8 * z, 6.2 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // Profile Soul Flame Eye Socket
          const ex = 3.2 * z;
          ctx.beginPath();
          ctx.ellipse(ex, skullY, 1.8 * z, 2.2 * z, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#090d16';
          ctx.fill();
          ctx.fillStyle = `rgba(239, 68, 68, ${flamePulse})`;
          ctx.beginPath();
          ctx.arc(ex + 0.2 * z, skullY - 0.3 * z, 1.6 * z, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ex + 0.4 * z, skullY - 0.5 * z, 0.7 * z, 0, Math.PI * 2);
          ctx.fill();

          // Near Arm & Broadsword
          ctx.save();
          ctx.translate(0.5 * z, skelTorsoY + 1.5 * z);
          ctx.rotate(0.25 + Math.sin(time * 5) * 0.1);
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(-1.1 * z, 0, 2.2 * z, 7 * z);
          ctx.translate(0, 7 * z);
          ctx.rotate(-0.85);
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(-1.5 * z, -20 * z, 3 * z, 20 * z);
          ctx.fillStyle = '#475569';
          ctx.fillRect(-4 * z, -1 * z, 8 * z, 2 * z);
          ctx.restore();

        } else {
          // --- SKELETON: SE / SW (3/4 FRONT) ---
          // Back Arm & Shield
          ctx.save();
          ctx.translate(-6 * z, -19 * z - skelBob);
          ctx.rotate(-0.2 + skelWalk * 0.2);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(-1 * z, 0, 2 * z, 7 * z);
          ctx.translate(-2 * z, 6 * z);
          ctx.beginPath();
          ctx.ellipse(0, 0, 7 * z, 11 * z, -0.2, 0, Math.PI * 2);
          ctx.fillStyle = '#334155';
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(0, 0, 5 * z, 9 * z, -0.2, 0, Math.PI * 2);
          ctx.fillStyle = '#78350f';
          ctx.fill();
          ctx.restore();

          // Legs with Knee Joints & Skeletal Feet
          [[-3 * z, -skelWalk * 0.35, '#94a3b8'], [3 * z, skelWalk * 0.35, '#e2e8f0']].forEach(([lx, lrot, col]) => {
            ctx.save();
            ctx.translate(lx, -10 * z);
            ctx.rotate(lrot);
            ctx.fillStyle = col;
            ctx.fillRect(-1.2 * z, 0, 2.4 * z, 6 * z);
            ctx.beginPath();
            ctx.arc(0, 6 * z, 1.9 * z, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(-1.1 * z, 6 * z, 2.2 * z, 5 * z);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(-0.8 * z, 10 * z, 3.8 * z, 1.8 * z);
            ctx.restore();
          });

          // 3/4 Pelvic Basin & Hollow Chest Cavity
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.moveTo(-3.8 * z, skelTorsoY + 9 * z);
          ctx.lineTo(4.2 * z, skelTorsoY + 9 * z);
          ctx.lineTo(2.4 * z, skelTorsoY + 12 * z);
          ctx.lineTo(-1.8 * z, skelTorsoY + 12 * z);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.beginPath();
          ctx.ellipse(0.5 * z, skelTorsoY + 4 * z, 5 * z, 5.2 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // Spine & Both Left/Right 3/4 Ribs
          for (let s = 0; s < 4; s++) {
            ctx.fillStyle = s % 2 === 0 ? '#f8fafc' : '#cbd5e1';
            ctx.fillRect(-0.8 * z, skelTorsoY + (s * 2.2) * z, 2.4 * z, 1.6 * z);
          }

          for (let r = 0; r < 4; r++) {
            const ry = skelTorsoY + (1.5 + r * 1.8) * z;
            const rw = (5.6 - r * 0.4) * z;
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1.5 * z;
            ctx.beginPath();
            ctx.arc(-0.8 * z, ry, rw * 0.45, Math.PI * 0.6, Math.PI * 1.3, false);
            ctx.stroke();
            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 1.6 * z;
            ctx.beginPath();
            ctx.arc(1.2 * z, ry, rw * 0.52, -Math.PI * 0.3, Math.PI * 0.4, false);
            ctx.stroke();
          }

          // 3/4 Skull, Jaw & Both Soul Flame Eye Sockets
          const skullGrad = ctx.createRadialGradient(-1 * z, skullY - 2 * z, 1 * z, 0, skullY, 7 * z);
          skullGrad.addColorStop(0, '#ffffff');
          skullGrad.addColorStop(0.5, '#f1f5f9');
          skullGrad.addColorStop(1, '#64748b');
          ctx.fillStyle = skullGrad;
          ctx.beginPath();
          ctx.arc(0, skullY, 6.5 * z, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(-1.5 * z, skullY + 4 * z, 5.5 * z, 3 * z);
          ctx.fillStyle = '#1e293b';
          for (let t = -1; t <= 2; t++) {
            ctx.fillRect((t * 1.2 + 0.5) * z, skullY + 4.5 * z, 0.6 * z, 2.4 * z);
          }

          [[-0.8 * z, 2.0 * z], [3.2 * z, 1.7 * z]].forEach(([ex, er]) => {
            ctx.beginPath();
            ctx.arc(ex, skullY, er, 0, Math.PI * 2);
            ctx.fillStyle = '#090d16';
            ctx.fill();
            ctx.fillStyle = `rgba(239, 68, 68, ${flamePulse})`;
            ctx.beginPath();
            ctx.arc(ex, skullY - 0.4 * z, er * 0.85, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(ex, skullY - 0.5 * z, er * 0.35, 0, Math.PI * 2);
            ctx.fill();
          });

          // Front Arm & Sword
          ctx.save();
          ctx.translate(5 * z, skelTorsoY + 1 * z);
          ctx.rotate(0.35 + Math.sin(time * 5) * 0.1);
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(-1 * z, 0, 2 * z, 7 * z);
          ctx.translate(0, 7 * z);
          ctx.rotate(-0.8);
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(-1.5 * z, -20 * z, 3 * z, 20 * z);
          ctx.fillStyle = '#475569';
          ctx.fillRect(-4 * z, -1 * z, 8 * z, 2 * z);
          ctx.restore();
        }

        ctx.restore();

      } else if (mob.type === 'golem') {
        // --- 8-AXIS 3D Megalithic Stone Golem Titan ---
        ctx.save();
        if (isWest) ctx.scale(-1, 1);

        const golemBreath = Math.sin(time * 3 + (mob.x || 0)) * 1.5 * z;
        const golemWalk = Math.sin(time * 4 + (mob.x || 0));
        const corePulse = Math.sin(time * 6) * 0.35 + 0.65;
        const golemTorsoY = -48 * z + golemBreath;
        const headY = golemTorsoY - 14 * z;
        const coreY = golemTorsoY + 14 * z;

        if (isPureFront) {
          // --- GOLEM: SOUTH (PURE FRONTAL) ---
          // Pillar Stone Legs
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-16 * z, (-20 + golemWalk * 1.5) * z, 12 * z, 18 * z);
          ctx.fillStyle = '#334155';
          ctx.fillRect(4 * z, (-20 - golemWalk * 1.5) * z, 12 * z, 18 * z);

          // Torso
          const stoneGrad = ctx.createLinearGradient(0, golemTorsoY, 0, golemTorsoY + 28 * z);
          stoneGrad.addColorStop(0, '#64748b');
          stoneGrad.addColorStop(0.5, '#475569');
          stoneGrad.addColorStop(1, '#334155');
          ctx.fillStyle = stoneGrad;
          ctx.beginPath();
          drawRoundRect(ctx, -22 * z, golemTorsoY, 44 * z, 28 * z, 5 * z);
          ctx.fill();
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 2 * z;
          ctx.stroke();

          // Symmetrical Energy Fissures
          ctx.strokeStyle = `rgba(34, 211, 238, ${corePulse})`;
          ctx.lineWidth = 2 * z;
          ctx.beginPath();
          ctx.moveTo(-14 * z, golemTorsoY + 5 * z); ctx.lineTo(-6 * z, golemTorsoY + 12 * z); ctx.lineTo(-10 * z, golemTorsoY + 22 * z);
          ctx.moveTo(14 * z, golemTorsoY + 5 * z); ctx.lineTo(6 * z, golemTorsoY + 12 * z); ctx.lineTo(10 * z, golemTorsoY + 22 * z);
          ctx.stroke();

          // Centered Power Core
          ctx.beginPath();
          ctx.arc(0, coreY, 9 * z, 0, Math.PI * 2);
          ctx.fillStyle = '#0f172a';
          ctx.fill();
          const coreGrad = ctx.createRadialGradient(0, coreY, 1 * z, 0, coreY, 8.5 * z);
          coreGrad.addColorStop(0, '#ffffff');
          coreGrad.addColorStop(0.3, '#67e8f9');
          coreGrad.addColorStop(0.7, `rgba(6, 182, 212, ${corePulse})`);
          coreGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
          ctx.fillStyle = coreGrad;
          ctx.beginPath();
          ctx.arc(0, coreY, 8.5 * z, 0, Math.PI * 2);
          ctx.fill();

          // Boulder Shoulders & Fists flanking symmetrically
          [[-24 * z, -1], [24 * z, 1]].forEach(([px, side]) => {
            ctx.fillStyle = side === -1 ? '#475569' : '#64748b';
            ctx.beginPath();
            ctx.arc(px, golemTorsoY + 4 * z, 9 * z, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#334155';
            ctx.beginPath();
            drawRoundRect(ctx, px - 5 * z, golemTorsoY + 14 * z, 10 * z, 16 * z, 3 * z);
            ctx.fill();
          });

          // Helm with BOTH Visor Eyes
          ctx.fillStyle = '#334155';
          ctx.fillRect(-12 * z, headY, 24 * z, 14 * z);
          ctx.fillStyle = '#090d16';
          ctx.fillRect(-9 * z, headY + 5 * z, 18 * z, 4 * z);
          ctx.fillStyle = '#22d3ee';
          ctx.fillRect(-7 * z, headY + 5.5 * z, 4 * z, 3 * z);
          ctx.fillRect(3 * z, headY + 5.5 * z, 4 * z, 3 * z);

        } else if (isPureBack) {
          // --- GOLEM: NORTH (PURE BACK) ---
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-16 * z, (-20 - golemWalk * 1.5) * z, 12 * z, 18 * z);
          ctx.fillRect(4 * z, (-20 + golemWalk * 1.5) * z, 12 * z, 18 * z);

          // Monolithic Stone Back Slabs with Runic Fissures (No Front Core)
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          drawRoundRect(ctx, -22 * z, golemTorsoY, 44 * z, 28 * z, 5 * z);
          ctx.fill();
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 2 * z;
          ctx.stroke();

          // Vertical Dorsal Energy Exhaust Vent
          ctx.strokeStyle = `rgba(34, 211, 238, ${corePulse * 0.85})`;
          ctx.lineWidth = 2.5 * z;
          ctx.beginPath();
          ctx.moveTo(0, golemTorsoY + 4 * z);
          ctx.lineTo(0, golemTorsoY + 24 * z);
          ctx.moveTo(-8 * z, golemTorsoY + 8 * z);
          ctx.lineTo(8 * z, golemTorsoY + 20 * z);
          ctx.moveTo(8 * z, golemTorsoY + 8 * z);
          ctx.lineTo(-8 * z, golemTorsoY + 20 * z);
          ctx.stroke();

          // Boulder shoulders & stone fists behind
          [[-24 * z, -1], [24 * z, 1]].forEach(([px]) => {
            ctx.fillStyle = '#334155';
            ctx.beginPath();
            ctx.arc(px, golemTorsoY + 4 * z, 9 * z, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            drawRoundRect(ctx, px - 5 * z, golemTorsoY + 14 * z, 10 * z, 16 * z, 3 * z);
            ctx.fill();
          });

          // Back of helm (Solid granite plates)
          ctx.fillStyle = '#334155';
          ctx.fillRect(-12 * z, headY, 24 * z, 14 * z);
          ctx.fillStyle = '#475569';
          ctx.fillRect(-8 * z, headY + 2 * z, 16 * z, 4 * z);

        } else if (isQuarterBack) {
          // --- GOLEM: NE / NW (3/4 BACK) ---
          // Far Stone Arm & Fist (behind torso on right)
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(21 * z, golemTorsoY + 4 * z, 8 * z, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          drawRoundRect(ctx, 16 * z, golemTorsoY + 13 * z, 9.5 * z, 15 * z, 3 * z);
          ctx.fill();

          // Pillar Stone Legs
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(3 * z, (-20 - golemWalk * 1.5) * z, 11 * z, 18 * z);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-14 * z, (-20 + golemWalk * 1.5) * z, 11 * z, 18 * z);

          // 3/4 Dorsal Stone Torso
          const stoneGrad = ctx.createLinearGradient(-20 * z, golemTorsoY, 20 * z, golemTorsoY + 28 * z);
          stoneGrad.addColorStop(0, '#475569');
          stoneGrad.addColorStop(0.6, '#334155');
          stoneGrad.addColorStop(1, '#1e293b');
          ctx.fillStyle = stoneGrad;
          ctx.beginPath();
          drawRoundRect(ctx, -20 * z, golemTorsoY, 40 * z, 28 * z, 5 * z);
          ctx.fill();
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 2 * z;
          ctx.stroke();

          // Dorsal Runic Exhaust Vent & Fissures (shifted 3/4)
          ctx.strokeStyle = `rgba(34, 211, 238, ${corePulse * 0.85})`;
          ctx.lineWidth = 2.2 * z;
          ctx.beginPath();
          ctx.moveTo(-3 * z, golemTorsoY + 4 * z);
          ctx.lineTo(-3 * z, golemTorsoY + 24 * z);
          ctx.moveTo(-11 * z, golemTorsoY + 9 * z);
          ctx.lineTo(5 * z, golemTorsoY + 19 * z);
          ctx.moveTo(5 * z, golemTorsoY + 9 * z);
          ctx.lineTo(-11 * z, golemTorsoY + 19 * z);
          ctx.stroke();

          // 3/4 Back Helm with granite plates & peeking side visor glow
          ctx.fillStyle = '#334155';
          ctx.fillRect(-11 * z, headY, 22 * z, 14 * z);
          ctx.fillStyle = '#475569';
          ctx.fillRect(-8 * z, headY + 2 * z, 14 * z, 4 * z);
          ctx.fillStyle = '#22d3ee';
          ctx.fillRect(8.5 * z, headY + 5.5 * z, 2.5 * z, 3 * z);

          // Near Stone Shoulder & Massive Forearm/Fist in foreground
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(-21 * z, golemTorsoY + 5 * z, 8.5 * z, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          drawRoundRect(ctx, -26 * z, golemTorsoY + 14 * z, 10 * z, 16 * z, 3 * z);
          ctx.fill();

        } else if (isPureSide) {
          // --- GOLEM: E / W (PURE SIDE PROFILE) ---
          // Far Stone Arm & Fist (ahead of torso)
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          drawRoundRect(ctx, 8 * z, golemTorsoY + 12 * z, 9 * z, 15 * z, 3 * z);
          ctx.fill();

          // Striding Stone Pillar Legs in profile
          ctx.fillStyle = '#0f172a';
          ctx.fillRect((-4 - golemWalk * 3) * z, -20 * z, 10 * z, 18 * z);
          ctx.fillStyle = '#334155';
          ctx.fillRect((-2 + golemWalk * 3) * z, -20 * z, 11 * z, 18 * z);

          // Narrower Profile Megalithic Torso
          const stoneGrad = ctx.createLinearGradient(-14 * z, golemTorsoY, 14 * z, golemTorsoY + 26 * z);
          stoneGrad.addColorStop(0, '#64748b');
          stoneGrad.addColorStop(0.5, '#475569');
          stoneGrad.addColorStop(1, '#334155');
          ctx.fillStyle = stoneGrad;
          ctx.beginPath();
          drawRoundRect(ctx, -14 * z, golemTorsoY, 28 * z, 28 * z, 5 * z);
          ctx.fill();
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 2 * z;
          ctx.stroke();

          // Side Energy Fissures
          ctx.strokeStyle = `rgba(34, 211, 238, ${corePulse})`;
          ctx.lineWidth = 2 * z;
          ctx.beginPath();
          ctx.moveTo(2 * z, golemTorsoY + 5 * z);
          ctx.lineTo(8 * z, golemTorsoY + 12 * z);
          ctx.lineTo(4 * z, golemTorsoY + 23 * z);
          ctx.stroke();

          // Protruding Front Power Core on Chest Edge
          ctx.beginPath();
          ctx.ellipse(11 * z, coreY, 4.5 * z, 7.5 * z, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#0f172a';
          ctx.fill();
          const coreGrad = ctx.createRadialGradient(12 * z, coreY, 0.8 * z, 11 * z, coreY, 7 * z);
          coreGrad.addColorStop(0, '#ffffff');
          coreGrad.addColorStop(0.35, '#67e8f9');
          coreGrad.addColorStop(0.75, `rgba(6, 182, 212, ${corePulse})`);
          coreGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
          ctx.fillStyle = coreGrad;
          ctx.beginPath();
          ctx.ellipse(11.5 * z, coreY, 4.2 * z, 7 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // Profile Helm & Front Visor Eye
          ctx.fillStyle = '#334155';
          ctx.fillRect(-9 * z, headY, 18 * z, 14 * z);
          ctx.fillStyle = '#090d16';
          ctx.fillRect(2 * z, headY + 5 * z, 7 * z, 4 * z);
          ctx.fillStyle = '#22d3ee';
          ctx.fillRect(3.5 * z, headY + 5.5 * z, 4.5 * z, 3 * z);

          // Near Boulder Shoulder & Massive Stone Forearm/Fist in foreground
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(-2 * z, golemTorsoY + 5 * z, 8.5 * z, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          drawRoundRect(ctx, -7 * z, golemTorsoY + 14 * z, 10 * z, 16 * z, 3 * z);
          ctx.fill();
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1.5 * z;
          ctx.stroke();

        } else {
          // --- GOLEM: SE / SW (3/4 FRONT) ---
          // Far Shoulder & Fist
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(21 * z, golemTorsoY + 4 * z, 8 * z, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          drawRoundRect(ctx, 16 * z, golemTorsoY + 14 * z, 9.5 * z, 15.5 * z, 3 * z);
          ctx.fill();

          // Pillar Stone Legs
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-14 * z, (-20 + golemWalk * 1.5) * z, 11 * z, 18 * z);
          ctx.fillStyle = '#334155';
          ctx.fillRect(4 * z, (-20 - golemWalk * 1.5) * z, 11 * z, 18 * z);

          // 3/4 Torso
          const stoneGrad = ctx.createLinearGradient(-20 * z, golemTorsoY, 20 * z, golemTorsoY + 26 * z);
          stoneGrad.addColorStop(0, '#64748b');
          stoneGrad.addColorStop(0.5, '#475569');
          stoneGrad.addColorStop(1, '#334155');
          ctx.fillStyle = stoneGrad;
          ctx.beginPath();
          drawRoundRect(ctx, -20 * z, golemTorsoY, 40 * z, 28 * z, 5 * z);
          ctx.fill();
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 2 * z;
          ctx.stroke();

          // 3/4 Energy Fissures
          ctx.strokeStyle = `rgba(34, 211, 238, ${corePulse})`;
          ctx.lineWidth = 2 * z;
          ctx.beginPath();
          ctx.moveTo(-9 * z, golemTorsoY + 5 * z); ctx.lineTo(-2 * z, golemTorsoY + 12 * z); ctx.lineTo(-6 * z, golemTorsoY + 22 * z);
          ctx.moveTo(15 * z, golemTorsoY + 5 * z); ctx.lineTo(10 * z, golemTorsoY + 12 * z); ctx.lineTo(13 * z, golemTorsoY + 22 * z);
          ctx.stroke();

          // 3/4 Power Core shifted right
          const cX = 4.5 * z;
          ctx.beginPath();
          ctx.arc(cX, coreY, 8.5 * z, 0, Math.PI * 2);
          ctx.fillStyle = '#0f172a';
          ctx.fill();
          const coreGrad = ctx.createRadialGradient(cX, coreY, 1 * z, cX, coreY, 8 * z);
          coreGrad.addColorStop(0, '#ffffff');
          coreGrad.addColorStop(0.3, '#67e8f9');
          coreGrad.addColorStop(0.7, `rgba(6, 182, 212, ${corePulse})`);
          coreGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
          ctx.fillStyle = coreGrad;
          ctx.beginPath();
          ctx.arc(cX, coreY, 8 * z, 0, Math.PI * 2);
          ctx.fill();

          // 3/4 Helm with Dark Visor Slot & Both Cyan Eyes
          ctx.fillStyle = '#334155';
          ctx.fillRect(-11 * z, headY, 22 * z, 14 * z);
          ctx.fillStyle = '#090d16';
          ctx.fillRect(-5 * z, headY + 5 * z, 15 * z, 4 * z);
          ctx.fillStyle = '#22d3ee';
          ctx.fillRect(-3.5 * z, headY + 5.5 * z, 4 * z, 3 * z);
          ctx.fillRect(4.5 * z, headY + 5.5 * z, 3.8 * z, 3 * z);

          // Near Shoulder & Massive Fist
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(-21 * z, golemTorsoY + 4 * z, 8.5 * z, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          drawRoundRect(ctx, -26 * z, golemTorsoY + 14 * z, 10 * z, 16 * z, 3 * z);
          ctx.fill();
        }

        ctx.restore();

      } else if (mob.type === 'frost_wolf') {
        // --- 8-AXIS 3D Arctic Frost Wolf ---
        ctx.save();
        if (isWest) ctx.scale(-1, 1);

        const wolfRun = Math.sin(time * 9 + (mob.x || 0));
        const wolfBob = Math.abs(wolfRun) * 2 * z;
        const wolfY = -17 * z - wolfBob;

        if (isPureFront) {
          // --- FROST WOLF: SOUTH (PURE FRONTAL) ---
          // Hind legs peeking behind
          [[-6.5 * z, -wolfRun * 0.3], [6.5 * z, wolfRun * 0.3]].forEach(([lx, lrot]) => {
            ctx.save();
            ctx.translate(lx, -10 * z);
            ctx.rotate(lrot);
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(-1.8 * z, 0, 3.6 * z, 9 * z);
            ctx.restore();
          });

          // Forelegs stepping toward camera
          [[-4 * z, wolfRun * 0.45], [4 * z, -wolfRun * 0.45]].forEach(([lx, lrot]) => {
            ctx.save();
            ctx.translate(lx, -9 * z);
            ctx.rotate(lrot);
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(-2 * z, 0, 4 * z, 10 * z);
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.ellipse(0, 9.5 * z, 2.5 * z, 1.4 * z, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          });

          // Front chest & Massive Fluffy Glacial Mane
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.ellipse(0, wolfY + 2 * z, 12 * z, 10 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.ellipse(0, wolfY + 2 * z, 10 * z, 8 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.ellipse(0, wolfY + 2 * z, 7 * z, 6 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // Symmetrical Wolf Head facing camera
          const hY = wolfY - 4 * z;
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.ellipse(0, hY, 7 * z, 6 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // Snout & Fangs (Centered)
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.ellipse(0, hY + 3 * z, 4 * z, 3 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-1.2 * z, hY + 2 * z, 2.4 * z, 1.8 * z); // nose
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-2 * z, hY + 4 * z, 1 * z, 2 * z); // fangs
          ctx.fillRect(1 * z, hY + 4 * z, 1 * z, 2 * z);

          // Both Glowing Arctic Eyes
          [[-2.8 * z], [2.8 * z]].forEach(([ex]) => {
            ctx.fillStyle = '#06b6d4';
            ctx.beginPath();
            ctx.arc(ex, hY - 1 * z, 1.6 * z, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(ex - 0.5 * z, hY - 1.5 * z, 1 * z, 1 * z);
          });

          // Both Pointed Ears
          [[-1, -4 * z], [1, 4 * z]].forEach(([side, ex]) => {
            ctx.fillStyle = '#0284c7';
            ctx.beginPath();
            ctx.moveTo(ex, hY - 3 * z);
            ctx.lineTo(ex + 3 * side * z, hY - 10 * z);
            ctx.lineTo(ex + 1 * side * z, hY - 3 * z);
            ctx.closePath();
            ctx.fill();
          });

        } else if (isPureBack) {
          // --- FROST WOLF: NORTH (PURE BACK) ---
          // Forelegs & Hind legs running away
          [[-6 * z, wolfRun * 0.35, '#64748b'], [6 * z, -wolfRun * 0.35, '#64748b'], [-3.8 * z, -wolfRun * 0.45, '#94a3b8'], [3.8 * z, wolfRun * 0.45, '#94a3b8']].forEach(([lx, lrot, col]) => {
            ctx.save();
            ctx.translate(lx, -9.5 * z);
            ctx.rotate(lrot);
            ctx.fillStyle = col;
            ctx.fillRect(-1.8 * z, 0, 3.6 * z, 9.5 * z);
            ctx.restore();
          });

          // Back of head with perked ears pointing away
          const hY = wolfY - 4 * z;
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.ellipse(0, hY, 6 * z, 5 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          [[-1, -3.5 * z], [1, 3.5 * z]].forEach(([side, ex]) => {
            ctx.fillStyle = '#0284c7';
            ctx.beginPath();
            ctx.moveTo(ex, hY - 2 * z);
            ctx.lineTo(ex + 2 * side * z, hY - 9 * z);
            ctx.lineTo(ex + 1 * side * z, hY - 2 * z);
            ctx.closePath();
            ctx.fill();
          });

          // Dorsal Glacial Mane & Hindquarters
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.ellipse(0, wolfY - 1 * z, 10.5 * z, 7.5 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.ellipse(0, wolfY + 2.5 * z, 9.5 * z, 7.5 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // Bushy animated tail waving in foreground
          const tailWag = Math.sin(time * 7) * 3 * z;
          ctx.save();
          ctx.translate(0, wolfY + 4 * z);
          ctx.rotate(tailWag * 0.08);
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 6 * z;
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(tailWag * 1.5, -12 * z);
          ctx.stroke();
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = 4 * z;
          ctx.beginPath();
          ctx.moveTo(0, -1 * z); ctx.lineTo(tailWag * 1.2, -11 * z);
          ctx.stroke();
          ctx.restore();

        } else if (isQuarterBack) {
          // --- FROST WOLF: NE / NW (3/4 BACK) ---
          // Forelegs stepping forward-away & Hind legs in foreground
          [[5 * z, -wolfRun * 0.4, '#64748b'], [8.5 * z, wolfRun * 0.4, '#94a3b8'], [-4 * z, wolfRun * 0.45, '#94a3b8'], [-8.5 * z, -wolfRun * 0.45, '#cbd5e1']].forEach(([lx, lrot, col]) => {
            ctx.save();
            ctx.translate(lx, -9.5 * z);
            ctx.rotate(lrot);
            ctx.fillStyle = col;
            ctx.fillRect(-1.8 * z, 0, 3.6 * z, 9.5 * z);
            ctx.restore();
          });

          // 3/4 Back Torso & Dorsal Glacial Mane
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          drawRoundRect(ctx, -10 * z, wolfY + 0.5 * z, 19 * z, 10.5 * z, 5 * z);
          ctx.fill();

          ctx.fillStyle = '#0369a1';
          ctx.beginPath();
          ctx.moveTo(-2 * z, wolfY - 5 * z);
          ctx.lineTo(8 * z, wolfY - 7 * z);
          ctx.lineTo(10 * z, wolfY + 4 * z);
          ctx.lineTo(-1 * z, wolfY + 3 * z);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(0, wolfY - 4 * z);
          ctx.lineTo(7 * z, wolfY - 5.5 * z);
          ctx.lineTo(8.5 * z, wolfY + 2 * z);
          ctx.lineTo(1 * z, wolfY + 1.5 * z);
          ctx.closePath();
          ctx.fill();

          // 3/4 Back Wolf Head with Peeking Snout Tip, Eye Glow & Both Pointed Ears
          const wolfHeadX = 8.5 * z;
          const wolfHeadY = wolfY - 3.5 * z;

          // Peeking snout tip on far right
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.moveTo(wolfHeadX + 2 * z, wolfHeadY - 1 * z);
          ctx.lineTo(wolfHeadX + 7.5 * z, wolfHeadY + 1 * z);
          ctx.lineTo(wolfHeadX + 2 * z, wolfHeadY + 3 * z);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#06b6d4';
          ctx.beginPath();
          ctx.arc(wolfHeadX + 4.5 * z, wolfHeadY - 0.8 * z, 1.2 * z, 0, Math.PI * 2);
          ctx.fill();

          // Back of skull
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.ellipse(wolfHeadX, wolfHeadY, 5.8 * z, 5.2 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // Far & Near Pointed Ears
          ctx.fillStyle = '#0369a1';
          ctx.beginPath();
          ctx.moveTo(wolfHeadX + 1.5 * z, wolfHeadY - 3 * z);
          ctx.lineTo(wolfHeadX + 5.5 * z, wolfHeadY - 10 * z);
          ctx.lineTo(wolfHeadX + 4.5 * z, wolfHeadY - 2 * z);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.moveTo(wolfHeadX - 3 * z, wolfHeadY - 3 * z);
          ctx.lineTo(wolfHeadX - 0.5 * z, wolfHeadY - 10.5 * z);
          ctx.lineTo(wolfHeadX + 1 * z, wolfHeadY - 2.5 * z);
          ctx.closePath();
          ctx.fill();

          // Prominent Bushy Tail in near-back foreground
          const tailWag = Math.sin(time * 7) * 2 * z;
          ctx.save();
          ctx.translate(-9.5 * z, wolfY + 2 * z);
          ctx.rotate(-0.25 + tailWag * 0.04);
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 5.5 * z;
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.quadraticCurveTo(-5 * z, -5 * z, -11 * z, -3 * z + tailWag);
          ctx.stroke();
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = 3.8 * z;
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.quadraticCurveTo(-5 * z, -4.5 * z, -10.5 * z, -2.5 * z + tailWag);
          ctx.stroke();
          ctx.restore();

        } else if (isPureSide) {
          // --- FROST WOLF: E / W (PURE SIDE PROFILE) ---
          // 4 Quadruped Legs (Far pair darker, Near pair brighter)
          [[-11.5 * z, -wolfRun * 0.45, '#64748b'], [4.5 * z, wolfRun * 0.45, '#94a3b8'], [-9.5 * z, wolfRun * 0.45, '#cbd5e1'], [7 * z, -wolfRun * 0.45, '#f8fafc']].forEach(([lx, lrot, col]) => {
            ctx.save();
            ctx.translate(lx, -9.5 * z);
            ctx.rotate(lrot);
            ctx.fillStyle = col;
            ctx.fillRect(-1.8 * z, 0, 3.6 * z, 10 * z);
            ctx.restore();
          });

          // Sleek Side Profile Torso
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          drawRoundRect(ctx, -13 * z, wolfY, 23 * z, 10.5 * z, 5 * z);
          ctx.fill();

          // Jagged Glacial Mane sweeping back from shoulders
          ctx.fillStyle = '#0369a1';
          ctx.beginPath();
          ctx.moveTo(-5 * z, wolfY - 5.5 * z);
          ctx.lineTo(8.5 * z, wolfY - 8 * z);
          ctx.lineTo(12 * z, wolfY + 6 * z);
          ctx.lineTo(1 * z, wolfY + 4 * z);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(-2.5 * z, wolfY - 4.5 * z);
          ctx.lineTo(7.5 * z, wolfY - 6 * z);
          ctx.lineTo(10 * z, wolfY + 3 * z);
          ctx.lineTo(0.5 * z, wolfY + 2 * z);
          ctx.closePath();
          ctx.fill();

          // Profile Wolf Head, Long Snout, Fang & Single Arctic Eye
          const wolfHeadX = 11.5 * z;
          const wolfHeadY = wolfY - 3 * z;
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.moveTo(wolfHeadX + 2 * z, wolfHeadY - 2 * z);
          ctx.lineTo(wolfHeadX + 9.5 * z, wolfHeadY + 0.8 * z);
          ctx.lineTo(wolfHeadX + 2 * z, wolfHeadY + 4 * z);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(wolfHeadX + 8 * z, wolfHeadY + 0.2 * z, 1.8 * z, 1.8 * z);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(wolfHeadX + 5.5 * z, wolfHeadY + 3 * z, 1.1 * z, 2 * z);

          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.ellipse(wolfHeadX, wolfHeadY, 5.8 * z, 5.2 * z, 0.1, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#06b6d4';
          ctx.beginPath();
          ctx.ellipse(wolfHeadX + 2.8 * z, wolfHeadY - 1 * z, 1.9 * z, 1.3 * z, 0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(wolfHeadX + 3 * z, wolfHeadY - 1.5 * z, 0.9 * z, 0.9 * z);

          // Profile Ear
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.moveTo(wolfHeadX - 0.5 * z, wolfHeadY - 3.5 * z);
          ctx.lineTo(wolfHeadX + 3.5 * z, wolfHeadY - 11 * z);
          ctx.lineTo(wolfHeadX + 4.5 * z, wolfHeadY - 3 * z);
          ctx.closePath();
          ctx.fill();

          // Streaming Tail
          ctx.save();
          ctx.translate(-12.5 * z, wolfY + 2 * z);
          ctx.rotate(-0.35);
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 5 * z;
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.quadraticCurveTo(-6 * z, -4 * z, -12 * z, -1 * z);
          ctx.stroke();
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = 3.5 * z;
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.quadraticCurveTo(-6 * z, -3.5 * z, -11.5 * z, -0.8 * z);
          ctx.stroke();
          ctx.restore();

        } else {
          // --- FROST WOLF: SE / SW (3/4 FRONT) ---
          // 4 Quadruped Legs in 3/4 Stance
          [[-9.5 * z, wolfRun * 0.4, '#64748b'], [-6.5 * z, -wolfRun * 0.4, '#cbd5e1'], [3 * z, -wolfRun * 0.45, '#cbd5e1'], [6.5 * z, wolfRun * 0.45, '#f8fafc']].forEach(([lx, lrot, col]) => {
            ctx.save();
            ctx.translate(lx, -9.5 * z);
            ctx.rotate(lrot);
            ctx.fillStyle = col;
            ctx.fillRect(-1.9 * z, 0, 3.8 * z, 10 * z);
            ctx.restore();
          });

          // 3/4 Foreshortened Torso
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          drawRoundRect(ctx, -10.5 * z, wolfY, 19.5 * z, 11 * z, 5 * z);
          ctx.fill();

          // Layered Glacial Mane around Chest & Neck
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.ellipse(4 * z, wolfY + 1 * z, 9.5 * z, 8.5 * z, -0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.ellipse(4.5 * z, wolfY + 1 * z, 7.5 * z, 6.8 * z, -0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.ellipse(5 * z, wolfY + 1.5 * z, 5.2 * z, 4.8 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // 3/4 Wolf Head with Both Ears, 3/4 Snout, Fangs & Both Arctic Eyes
          const wolfHeadX = 8 * z;
          const wolfHeadY = wolfY - 3.5 * z;

          // Far Ear & Near Ear
          ctx.fillStyle = '#0369a1';
          ctx.beginPath();
          ctx.moveTo(wolfHeadX + 2.5 * z, wolfHeadY - 3 * z);
          ctx.lineTo(wolfHeadX + 6.5 * z, wolfHeadY - 10 * z);
          ctx.lineTo(wolfHeadX + 5 * z, wolfHeadY - 2.5 * z);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.ellipse(wolfHeadX, wolfHeadY, 6.5 * z, 5.8 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.moveTo(wolfHeadX - 4 * z, wolfHeadY - 3 * z);
          ctx.lineTo(wolfHeadX - 2 * z, wolfHeadY - 10.5 * z);
          ctx.lineTo(wolfHeadX + 0.5 * z, wolfHeadY - 3 * z);
          ctx.closePath();
          ctx.fill();

          // 3/4 Snout, Nose & Fangs
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.ellipse(wolfHeadX + 3.8 * z, wolfHeadY + 2.2 * z, 4.2 * z, 2.8 * z, 0.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(wolfHeadX + 5.8 * z, wolfHeadY + 1 * z, 2 * z, 1.8 * z);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(wolfHeadX + 2.5 * z, wolfHeadY + 3.5 * z, 1 * z, 2 * z);
          ctx.fillRect(wolfHeadX + 5.5 * z, wolfHeadY + 3.5 * z, 1 * z, 2 * z);

          // Both Arctic Cyan Eyes (near & far)
          [[wolfHeadX - 0.5 * z, 1.6 * z], [wolfHeadX + 3.8 * z, 1.3 * z]].forEach(([ex, er]) => {
            ctx.fillStyle = '#06b6d4';
            ctx.beginPath();
            ctx.arc(ex, wolfHeadY - 1 * z, er, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(ex - 0.4 * z, wolfHeadY - 1.5 * z, 0.9 * z, 0.9 * z);
          });

          // Tail curving behind
          ctx.save();
          ctx.translate(-10 * z, wolfY + 2 * z);
          ctx.rotate(-0.4);
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = 4 * z;
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.quadraticCurveTo(-5 * z, -4 * z, -10.5 * z, -1 * z);
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();

      } else if (mob.type === 'ice_elemental') {
        // --- 8-AXIS 3D Glacial Elemental Octahedron ---
        const floatY = Math.sin(time * 4 + (mob.x || 0)) * 5 * z;
        const elemY = -22 * z + floatY;

        // 8-Axis turn & depth vectors
        const FACING_ANGLES = { E: 0, SE: Math.PI / 4, S: Math.PI / 2, SW: 3 * Math.PI / 4, W: Math.PI, NW: -3 * Math.PI / 4, N: -Math.PI / 2, NE: -Math.PI / 4 };
        const ELEM_AXES = {
          S:  [0, 1],
          SE: [0.65, 0.7],
          E:  [1.0, 0.1],
          NE: [0.65, -0.7],
          N:  [0, -1],
          NW: [-0.65, -0.7],
          W:  [-1.0, 0.1],
          SW: [-0.65, 0.7]
        };
        const rotAngle = FACING_ANGLES[rawFacing] || 0;
        const [turnX, frontDir] = ELEM_AXES[rawFacing] || ELEM_AXES.S;
        const tSide = turnX >= 0 ? 1 : -1;
        const absTurn = Math.abs(turnX);

        // Contact shadow
        ctx.beginPath();
        ctx.ellipse(0, -2 * z, 14 * z, 6 * z, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(2, 132, 199, 0.35)';
        ctx.fill();

        // Orbiting shards (Back pass)
        const numShards = 4;
        const shardRadiusX = 18 * z;
        const shardRadiusY = 8 * z;
        for (let i = 0; i < numShards; i++) {
          const ang = time * 2.5 + rotAngle + (i * Math.PI * 2 / numShards);
          const sy = Math.sin(ang);
          if (sy < 0) {
            const sx = Math.cos(ang) * shardRadiusX;
            const py = elemY + sy * shardRadiusY;
            ctx.save();
            ctx.translate(sx, py);
            ctx.rotate(ang + time);
            ctx.fillStyle = '#7dd3fc';
            ctx.beginPath();
            ctx.moveTo(0, -3.5 * z); ctx.lineTo(2.5 * z, 0); ctx.lineTo(0, 3.5 * z); ctx.lineTo(-2.5 * z, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        }

        // Octahedron Prism Facets (Central ridge vertex shifts horizontally & vertically across all 8 axes)
        const topY = elemY - 18 * z;
        const botY = elemY + 16 * z;
        const leftX = (-12 + turnX * 1.5) * z;
        const rightX = (12 + turnX * 1.5) * z;
        const midY = elemY;
        const ridgeX = turnX * 5.8 * z;
        const ridgeY = elemY + frontDir * 3.5 * z;

        // Top-Left Facet
        ctx.fillStyle = frontDir < 0 ? (turnX < 0 ? '#0369a1' : '#0284c7') : (turnX > 0.5 ? '#bae6fd' : '#e0f2fe');
        ctx.beginPath();
        ctx.moveTo(0, topY); ctx.lineTo(leftX, midY); ctx.lineTo(ridgeX, ridgeY);
        ctx.closePath();
        ctx.fill();

        // Top-Right Facet
        ctx.fillStyle = frontDir < 0 ? (turnX > 0 ? '#0284c7' : '#0369a1') : (turnX < -0.5 ? '#38bdf8' : '#7dd3fc');
        ctx.beginPath();
        ctx.moveTo(0, topY); ctx.lineTo(rightX, midY); ctx.lineTo(ridgeX, ridgeY);
        ctx.closePath();
        ctx.fill();

        // Bottom-Left Facet
        ctx.fillStyle = frontDir < 0 ? '#0f172a' : '#0284c7';
        ctx.beginPath();
        ctx.moveTo(leftX, midY); ctx.lineTo(0, botY); ctx.lineTo(ridgeX, ridgeY);
        ctx.closePath();
        ctx.fill();

        // Bottom-Right Facet
        ctx.fillStyle = frontDir < 0 ? '#1e293b' : '#0369a1';
        ctx.beginPath();
        ctx.moveTo(rightX, midY); ctx.lineTo(0, botY); ctx.lineTo(ridgeX, ridgeY);
        ctx.closePath();
        ctx.fill();

        // Specular Ridge Bevel Lines
        ctx.strokeStyle = frontDir >= 0 ? 'rgba(255, 255, 255, 0.7)' : 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 1.2 * z;
        ctx.beginPath();
        ctx.moveTo(0, topY); ctx.lineTo(ridgeX, ridgeY); ctx.lineTo(0, botY);
        ctx.moveTo(leftX, midY); ctx.lineTo(ridgeX, ridgeY); ctx.lineTo(rightX, midY);
        ctx.stroke();

        // Pulsating Inner Frost Star & 8-Axis Directional Arcane Eyes / Dorsal Crest
        const starPulse = Math.sin(time * 6) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 255, 255, ${starPulse})`;
        ctx.beginPath();
        ctx.arc(ridgeX * 0.65, elemY + frontDir * 1.2 * z, 3.2 * z, 0, Math.PI * 2);
        ctx.fill();

        if (frontDir > 0) {
          // Front & Side Views (S, SE, SW, E, W): Glowing Arcane Visor Eyes on crystal face
          const eyeCenterX = turnX * 5.2 * z;
          const eyeY = elemY - 3.5 * z;
          const spread = 3.2 * z * (1 - absTurn * 0.55);
          if (absTurn < 0.9) {
            // Two eyes in S, SE, SW
            [[eyeCenterX - spread * tSide, 2.0 * z], [eyeCenterX + spread * tSide, 2.0 * z * (1 - absTurn * 0.3)]].forEach(([ex, ew]) => {
              ctx.fillStyle = '#090d16';
              ctx.beginPath();
              ctx.ellipse(ex, eyeY, ew, 1.4 * z, -0.15 * turnX, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.ellipse(ex, eyeY, ew * 0.7, 0.9 * z, -0.15 * turnX, 0, Math.PI * 2);
              ctx.fill();
            });
          } else {
            // Single profile visor eye in E, W
            ctx.fillStyle = '#090d16';
            ctx.beginPath();
            ctx.ellipse(eyeCenterX + tSide * 1.2 * z, eyeY, 2.2 * z, 1.5 * z, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(eyeCenterX + tSide * 1.4 * z, eyeY, 1.5 * z, 1.0 * z, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // Back Views (N, NE, NW): Etched Dorsal Frost Rune Seal + peeking side eye on NE/NW
          ctx.strokeStyle = `rgba(125, 211, 252, ${starPulse})`;
          ctx.lineWidth = 1.5 * z;
          ctx.beginPath();
          ctx.moveTo(-turnX * 2 * z, elemY - 9 * z);
          ctx.lineTo(-turnX * 2 * z, elemY + 7 * z);
          ctx.moveTo((-4 - turnX * 2) * z, elemY - 2 * z);
          ctx.lineTo((4 - turnX * 2) * z, elemY - 2 * z);
          ctx.stroke();
          if (absTurn > 0.3) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(tSide * 8.5 * z, elemY - 3.5 * z, 1.1 * z, 1.5 * z, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Orbiting shards: Front pass
        for (let i = 0; i < numShards; i++) {
          const ang = time * 2.5 + rotAngle + (i * Math.PI * 2 / numShards);
          const sy = Math.sin(ang);
          if (sy >= 0) {
            const sx = Math.cos(ang) * shardRadiusX;
            const py = elemY + sy * shardRadiusY;
            ctx.save();
            ctx.translate(sx, py);
            ctx.rotate(ang + time);
            ctx.fillStyle = '#bae6fd';
            ctx.beginPath();
            ctx.moveTo(0, -4 * z); ctx.lineTo(3 * z, 0); ctx.lineTo(0, 4 * z); ctx.lineTo(-3 * z, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        }

      } else if (mob.type === 'frost_titan') {
        // --- 8-AXIS 3D Colossal Frost Titan Lord ---
        ctx.save();
        if (isWest) ctx.scale(-1, 1);

        const titanBob = Math.sin(time * 3 + (mob.x || 0)) * 2 * z;
        const titanWalk = Math.sin(time * 4 + (mob.x || 0));
        const titanPulse = Math.sin(time * 5) * 0.25 + 0.75;
        const titanY = -56 * z + titanBob;
        const helmY = titanY - 18 * z;
        const runeY = titanY + 12 * z;

        if (isPureFront) {
          // --- TITAN: SOUTH (PURE FRONTAL) ---
          // Pillar Stone-Ice Legs
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-18 * z, (-24 + titanWalk * 1.8) * z, 14 * z, 22 * z);
          ctx.fillRect(4 * z, (-24 - titanWalk * 1.8) * z, 14 * z, 22 * z);

          // Cuirass
          const plateGrad = ctx.createLinearGradient(0, titanY, 0, titanY + 26 * z);
          plateGrad.addColorStop(0, '#38bdf8');
          plateGrad.addColorStop(0.5, '#0284c7');
          plateGrad.addColorStop(1, '#0f172a');
          ctx.fillStyle = plateGrad;
          ctx.beginPath();
          drawRoundRect(ctx, -26 * z, titanY, 52 * z, 26 * z, 6 * z);
          ctx.fill();

          // Centered Frost Rune Heart
          ctx.fillStyle = `rgba(56, 189, 248, ${titanPulse})`;
          ctx.beginPath();
          ctx.arc(0, runeY, 10 * z, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2 * z;
          ctx.stroke();

          // Symmetrical crystalline shoulder spikes & gauntlets
          [[-26 * z, -1], [26 * z, 1]].forEach(([sx, sdir]) => {
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            drawRoundRect(ctx, sx - 5 * z, titanY + 8 * z, 10 * z, 16 * z, 3 * z);
            ctx.fill();
            ctx.fillStyle = '#7dd3fc';
            ctx.beginPath();
            ctx.moveTo(sx - 5 * z, titanY);
            ctx.lineTo(sx + 14 * z * sdir, titanY - 24 * z);
            ctx.lineTo(sx + 6 * z, titanY + 6 * z);
            ctx.closePath();
            ctx.fill();
          });

          // Helm & Horns arching Left and Right
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-15 * z, helmY, 30 * z, 20 * z);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(-15 * z, helmY, 30 * z, 4 * z);

          // Both Horns
          [[-1, -14 * z], [1, 14 * z]].forEach(([sdir, hx]) => {
            ctx.fillStyle = '#bae6fd';
            ctx.beginPath();
            ctx.moveTo(hx, helmY + 4 * z);
            ctx.quadraticCurveTo(hx + 14 * z * sdir, helmY - 10 * z, hx + 8 * z * sdir, helmY - 24 * z);
            ctx.quadraticCurveTo(hx + 6 * z * sdir, helmY - 12 * z, hx - 2 * z * sdir, helmY - 2 * z);
            ctx.closePath();
            ctx.fill();
          });

          // Visor with radiant flare across both eyes
          ctx.fillStyle = '#67e8f9';
          ctx.fillRect(-9 * z, helmY + 8 * z, 18 * z, 3 * z);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-5 * z, helmY + 8.5 * z, 10 * z, 2 * z);

          // Titan Mace held in right hand forward
          ctx.save();
          ctx.translate(28 * z, titanY + 8 * z);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(-8 * z, -28 * z, 16 * z, 16 * z);
          ctx.fillStyle = '#475569';
          ctx.fillRect(-2 * z, -26 * z, 4 * z, 42 * z);
          ctx.restore();

        } else if (isPureBack) {
          // --- TITAN: NORTH (PURE BACK) ---
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-18 * z, (-24 - titanWalk * 1.8) * z, 14 * z, 22 * z);
          ctx.fillRect(4 * z, (-24 + titanWalk * 1.8) * z, 14 * z, 22 * z);

          // Cuirass back with Ice Mantle / Fur Cape
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          drawRoundRect(ctx, -26 * z, titanY, 52 * z, 26 * z, 6 * z);
          ctx.fill();

          // Symmetrical Crystalline Shoulder Spikes & Gauntlets from behind
          [[-26 * z, -1], [26 * z, 1]].forEach(([sx, sdir]) => {
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            drawRoundRect(ctx, sx - 5 * z, titanY + 8 * z, 10 * z, 16 * z, 3 * z);
            ctx.fill();
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.moveTo(sx - 5 * z, titanY);
            ctx.lineTo(sx + 14 * z * sdir, titanY - 24 * z);
            ctx.lineTo(sx + 6 * z, titanY + 6 * z);
            ctx.closePath();
            ctx.fill();
          });

          // Cascading Ice Mantle
          ctx.fillStyle = '#0369a1';
          ctx.beginPath();
          ctx.moveTo(-20 * z, titanY);
          ctx.lineTo(20 * z, titanY);
          ctx.lineTo(16 * z, titanY + 24 * z);
          ctx.lineTo(0, titanY + 30 * z);
          ctx.lineTo(-16 * z, titanY + 24 * z);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#7dd3fc';
          ctx.beginPath();
          ctx.moveTo(-16 * z, titanY);
          ctx.lineTo(16 * z, titanY);
          ctx.lineTo(12 * z, titanY + 18 * z);
          ctx.lineTo(0, titanY + 22 * z);
          ctx.lineTo(-12 * z, titanY + 18 * z);
          ctx.closePath();
          ctx.fill();

          // Helm Back (Horns pointing away, no visor or rune heart)
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-15 * z, helmY, 30 * z, 20 * z);
          [[-1, -14 * z], [1, 14 * z]].forEach(([sdir, hx]) => {
            ctx.fillStyle = '#7dd3fc';
            ctx.beginPath();
            ctx.moveTo(hx, helmY + 4 * z);
            ctx.quadraticCurveTo(hx + 10 * z * sdir, helmY - 14 * z, hx + 5 * z * sdir, helmY - 22 * z);
            ctx.quadraticCurveTo(hx + 4 * z * sdir, helmY - 10 * z, hx, helmY);
            ctx.closePath();
            ctx.fill();
          });

          // Mace held forward-away
          ctx.save();
          ctx.translate(26 * z, titanY + 6 * z);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(-7 * z, -28 * z, 14 * z, 14 * z);
          ctx.fillStyle = '#475569';
          ctx.fillRect(-2 * z, -28 * z, 4 * z, 40 * z);
          ctx.restore();

        } else if (isQuarterBack) {
          // --- TITAN: NE / NW (3/4 BACK) ---
          // Great Mace held forward-away on far right
          ctx.save();
          ctx.translate(25 * z, titanY + 6 * z);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(-8 * z, -28 * z, 16 * z, 15 * z);
          ctx.fillStyle = '#475569';
          ctx.fillRect(-2.2 * z, -26 * z, 4.4 * z, 42 * z);
          ctx.restore();

          // Pillar Legs
          ctx.fillStyle = '#090d16';
          ctx.fillRect(3 * z, (-24 - titanWalk * 1.8) * z, 13 * z, 22 * z);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-16 * z, (-24 + titanWalk * 1.8) * z, 13 * z, 22 * z);

          // 3/4 Back Cuirass
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          drawRoundRect(ctx, -23 * z, titanY, 46 * z, 26 * z, 6 * z);
          ctx.fill();

          // Far Shoulder Spike (right) & Near Shoulder Spike + Gauntlet (left)
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(18 * z, titanY + 2 * z);
          ctx.lineTo(34 * z, titanY - 22 * z);
          ctx.lineTo(24 * z, titanY + 8 * z);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          drawRoundRect(ctx, -28 * z, titanY + 8 * z, 10 * z, 16 * z, 3 * z);
          ctx.fill();
          ctx.fillStyle = '#7dd3fc';
          ctx.beginPath();
          ctx.moveTo(-18 * z, titanY);
          ctx.lineTo(-36 * z, titanY - 23 * z);
          ctx.lineTo(-25 * z, titanY + 7 * z);
          ctx.closePath();
          ctx.fill();

          // Cascading 3/4 Ice Mantle draped across the back
          ctx.fillStyle = '#0369a1';
          ctx.beginPath();
          ctx.moveTo(-20 * z, titanY + 1 * z);
          ctx.lineTo(15 * z, titanY + 1 * z);
          ctx.lineTo(11 * z, titanY + 23 * z);
          ctx.lineTo(-3 * z, titanY + 29 * z);
          ctx.lineTo(-17 * z, titanY + 23 * z);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#7dd3fc';
          ctx.beginPath();
          ctx.moveTo(-16 * z, titanY + 1 * z);
          ctx.lineTo(11 * z, titanY + 1 * z);
          ctx.lineTo(7 * z, titanY + 17 * z);
          ctx.lineTo(-3 * z, titanY + 21 * z);
          ctx.lineTo(-13 * z, titanY + 17 * z);
          ctx.closePath();
          ctx.fill();

          // 3/4 Back Helm with Both Horns & Peeking Side Visor Glow
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-14 * z, helmY, 28 * z, 20 * z);
          ctx.fillStyle = '#67e8f9';
          ctx.fillRect(10 * z, helmY + 8 * z, 4 * z, 3 * z);

          [[-1, -13 * z], [1, 13 * z]].forEach(([sdir, hx]) => {
            ctx.fillStyle = sdir === -1 ? '#bae6fd' : '#7dd3fc';
            ctx.beginPath();
            ctx.moveTo(hx, helmY + 4 * z);
            ctx.quadraticCurveTo(hx + 11 * z * sdir, helmY - 12 * z, hx + 6 * z * sdir, helmY - 23 * z);
            ctx.quadraticCurveTo(hx + 4 * z * sdir, helmY - 10 * z, hx - 1 * z * sdir, helmY - 1 * z);
            ctx.closePath();
            ctx.fill();
          });

        } else if (isPureSide) {
          // --- TITAN: E / W (PURE SIDE PROFILE) ---
          // Flowing Ice Mantle behind back
          ctx.fillStyle = '#0369a1';
          ctx.beginPath();
          ctx.moveTo(-14 * z, titanY + 2 * z);
          ctx.lineTo(-24 * z, titanY + 26 * z);
          ctx.lineTo(-12 * z, titanY + 28 * z);
          ctx.closePath();
          ctx.fill();

          // Striding Pillar Legs in profile
          ctx.fillStyle = '#090d16';
          ctx.fillRect((-6 - titanWalk * 3.5) * z, -24 * z, 12 * z, 22 * z);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect((-3 + titanWalk * 3.5) * z, -24 * z, 13 * z, 22 * z);

          // Narrower Side Profile Cuirass
          const plateGrad = ctx.createLinearGradient(-16 * z, titanY, 16 * z, titanY + 24 * z);
          plateGrad.addColorStop(0, '#38bdf8');
          plateGrad.addColorStop(0.45, '#0284c7');
          plateGrad.addColorStop(1, '#0f172a');
          ctx.fillStyle = plateGrad;
          ctx.beginPath();
          drawRoundRect(ctx, -16 * z, titanY, 32 * z, 26 * z, 6 * z);
          ctx.fill();

          // Protruding Front Frost Rune Heart on Chest Edge
          ctx.fillStyle = `rgba(56, 189, 248, ${titanPulse})`;
          ctx.beginPath();
          ctx.ellipse(13 * z, runeY, 4.5 * z, 9 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.6 * z;
          ctx.stroke();

          // Profile Helm, Front Visor & Sweeping Glacial Horn
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-11 * z, helmY, 22 * z, 20 * z);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(-11 * z, helmY, 22 * z, 3.5 * z);
          ctx.fillStyle = '#67e8f9';
          ctx.fillRect(3 * z, helmY + 8 * z, 8 * z, 3 * z);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(6 * z, helmY + 8.5 * z, 5 * z, 2 * z);

          ctx.fillStyle = '#bae6fd';
          ctx.beginPath();
          ctx.moveTo(0, helmY + 4 * z);
          ctx.quadraticCurveTo(-14 * z, helmY - 10 * z, -8 * z, helmY - 24 * z);
          ctx.quadraticCurveTo(-4 * z, helmY - 12 * z, 5 * z, helmY - 2 * z);
          ctx.closePath();
          ctx.fill();

          // Near Armored Gauntlet, Profile Shoulder Spike & Great Mace held forward
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          drawRoundRect(ctx, -4 * z, titanY + 8 * z, 11 * z, 16 * z, 3 * z);
          ctx.fill();
          ctx.fillStyle = '#7dd3fc';
          ctx.beginPath();
          ctx.moveTo(-6 * z, titanY + 3 * z);
          ctx.lineTo(-14 * z, titanY - 23 * z);
          ctx.lineTo(6 * z, titanY + 6 * z);
          ctx.closePath();
          ctx.fill();

          ctx.save();
          ctx.translate(16 * z, titanY + 10 * z);
          ctx.rotate(0.2);
          ctx.fillStyle = '#475569';
          ctx.fillRect(-2.5 * z, -28 * z, 5 * z, 46 * z);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(-9 * z, -30 * z, 18 * z, 17 * z);
          ctx.restore();

        } else {
          // --- TITAN: SE / SW (3/4 FRONT) ---
          // Pillar Stone-Ice Legs
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-16 * z, (-24 + titanWalk * 1.8) * z, 13 * z, 22 * z);
          ctx.fillRect(4 * z, (-24 - titanWalk * 1.8) * z, 13 * z, 22 * z);

          // 3/4 Cuirass
          const plateGrad = ctx.createLinearGradient(-23 * z, titanY, 23 * z, titanY + 24 * z);
          plateGrad.addColorStop(0, '#38bdf8');
          plateGrad.addColorStop(0.35, '#0284c7');
          plateGrad.addColorStop(0.8, '#0f172a');
          ctx.fillStyle = plateGrad;
          ctx.beginPath();
          drawRoundRect(ctx, -23 * z, titanY, 46 * z, 26 * z, 6 * z);
          ctx.fill();

          // 3/4 Frost Rune Heart shifted right
          ctx.fillStyle = `rgba(56, 189, 248, ${titanPulse})`;
          ctx.beginPath();
          ctx.arc(5 * z, runeY, 9.5 * z, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.8 * z;
          ctx.stroke();

          // Both Crystalline Shoulder Spikes & Near Gauntlet
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          drawRoundRect(ctx, -28 * z, titanY + 8 * z, 10 * z, 16 * z, 3 * z);
          ctx.fill();
          ctx.fillStyle = '#7dd3fc';
          ctx.beginPath();
          ctx.moveTo(-18 * z, titanY);
          ctx.lineTo(-35 * z, titanY - 22 * z);
          ctx.lineTo(-25 * z, titanY + 7 * z);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#7dd3fc';
          ctx.beginPath();
          ctx.moveTo(18 * z, titanY + 2 * z);
          ctx.lineTo(35 * z, titanY - 22 * z);
          ctx.lineTo(24 * z, titanY + 8 * z);
          ctx.closePath();
          ctx.fill();

          // Great Mace
          ctx.save();
          ctx.translate(26 * z, titanY + 8 * z);
          ctx.fillStyle = '#475569';
          ctx.fillRect(-2.5 * z, -28 * z, 5 * z, 48 * z);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(-10 * z, -30 * z, 20 * z, 18 * z);
          ctx.restore();

          // 3/4 Helm, Both Horns & 3/4 Radiant Visor
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-14 * z, helmY, 28 * z, 20 * z);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(-14 * z, helmY, 28 * z, 3.5 * z);

          [[-1, -13 * z], [1, 13 * z]].forEach(([sdir, hx]) => {
            ctx.fillStyle = '#bae6fd';
            ctx.beginPath();
            ctx.moveTo(hx, helmY + 4 * z);
            ctx.quadraticCurveTo(hx + 13 * z * sdir, helmY - 10 * z, hx + 7.5 * z * sdir, helmY - 24 * z);
            ctx.quadraticCurveTo(hx + 5.5 * z * sdir, helmY - 12 * z, hx - 2 * z * sdir, helmY - 2 * z);
            ctx.closePath();
            ctx.fill();
          });

          ctx.fillStyle = '#67e8f9';
          ctx.fillRect(-4 * z, helmY + 8 * z, 15 * z, 3 * z);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, helmY + 8.5 * z, 9 * z, 2 * z);
        }

        ctx.restore();
      }

      ctx.restore();
    };
    if (mob.hue) {
      // box just around the body: the filter cost grows with its pixel area
      const s = (mob.scale || 1) * z;
      const r = MOB_BODY_EXTENT[mob.type] || 72;
      this.drawTinted(ctx, `hue-rotate(${mob.hue}deg) saturate(1.15)`, screen.x, screen.y, { halfW: (r + 8) * s, up: (r + 12) * s, down: (r * 0.5 + 8) * s }, drawBody);
    } else {
      drawBody(ctx);
    }

    // Overhead tag with Affix Badges
    const overheadY = screen.y - (isBoss ? 75 : isMiniboss ? 58 : 44) * z * (mob.scale || 1);
    this.drawEntityOverhead(
      ctx,
      screen.x,
      overheadY,
      isMiniboss ? `⚔️ ${mob.name}` : mob.name,
      mob.hp,
      mob.maxHp,
      isBoss ? '#f59e0b' : isMiniboss ? '#f472b6' : '#fca5a5',
      `Lv.${mob.level}${isMiniboss ? ' [MINIBOSS]' : ''}`,
      mob.buffs,
      mob.isCommander,
      mob.hasCommanderBuff
    );

    if (mob.frozen || mob.scorch || mob.frost) this.drawMobStatus(ctx, mob, screen, z, overheadY);

    // Bouncing overhead lock pointer for selected target
    if (isSelected) {
      const arrowBounce = Math.sin(this.animations.time * 10) * 3 * z;
      const arrowY = overheadY - 14 * z + arrowBounce;
      ctx.save();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(screen.x, arrowY + 6 * z);
      ctx.lineTo(screen.x - 6 * z, arrowY - 4 * z);
      ctx.lineTo(screen.x + 6 * z, arrowY - 4 * z);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Draw Overhead Name & Health Bar & Affixes
  // ---------- townsfolk: cosmetic citizens strolling the city streets ----------
  // Client-side only. They walk the street grid laid out by server/mapData.js
  // (boulevard at tiles 18-22, side streets at 9-10 and 31-32).
  buildTownsfolk() {
    const LANES = [10, 20.5, 32];
    const STOPS = [3.8, 10, 20.5, 32, 38.2];
    const halfWidth = v => (v === 20.5 ? 1.9 : 0.6);
    const nodes = [];
    for (const a of LANES) {
      for (const b of STOPS) {
        nodes.push({ x: a, y: b });
        nodes.push({ x: b, y: a });
      }
    }
    const key = n => `${n.x},${n.y}`;
    const unique = new Map(nodes.map(n => [key(n), n]));
    const neighbours = (n) => {
      const out = [];
      const step = (list, v, d) => list[list.indexOf(v) + d];
      if (LANES.includes(n.x)) [-1, 1].forEach(d => { const y = step(STOPS, n.y, d); if (y !== undefined) out.push(unique.get(key({ x: n.x, y }))); });
      if (LANES.includes(n.y)) [-1, 1].forEach(d => { const x = step(STOPS, n.x, d); if (x !== undefined) out.push(unique.get(key({ x, y: n.y }))); });
      return out.filter(Boolean);
    };
    // a walker keeps to one side of the street; the east-west boulevard is
    // walked on its south side only, clear of Olaf's booth and the fountain
    const pointFor = (n, c) => ({
      x: n.x + (LANES.includes(n.x) ? c.side * c.lean * halfWidth(n.x) : 0),
      y: n.y + (LANES.includes(n.y) ? (n.y === 20.5 ? 1 : c.side) * c.lean * halfWidth(n.y) : 0)
    });

    const outfits = [
      { tunic: '#b5651d', legs: '#4b3621', hair: '#5a3825', apron: true },
      { tunic: '#2c5d8a', legs: '#3b3b48', hair: '#1f1a17', trim: '#c9d6e3' },
      { tunic: '#6a8f3a', legs: '#5a4630', hair: '#c9772e', dress: true },
      { tunic: '#9b2d48', legs: '#3a2f45', hair: '#2b1d14', dress: true, apron: true },
      { tunic: '#d9b45a', legs: '#4b3621', hair: '#8a5a32', hat: '#6d4423', band: '#2f1d10' },
      { tunic: '#5b3a7a', legs: '#2a2a33', hair: '#d9d4cc', beard: true, staff: true, trim: '#d8b75a' },
      { tunic: '#3f7f7a', legs: '#4a3b2a', hair: '#f0d38a', dress: true, basket: true },
      { tunic: '#7a5230', legs: '#3b2a1a', hair: '#3b2a1a', hat: '#c9a227', band: '#8a2b1f', basket: true }
    ];
    const skins = ['#f0c9a0', '#e8b48a', '#c68b59', '#9a6440'];
    const all = Array.from(unique.values());
    const folk = [];
    for (let i = 0; i < 24; i++) {
      const start = all[(i * 7) % all.length];
      const c = {
        id: `townsfolk_${i}`,
        side: Math.random() < 0.5 ? -1 : 1,
        lean: 0.55 + Math.random() * 0.45,
        speed: 0.8 + Math.random() * 0.6,
        outfit: outfits[i % outfits.length],
        skin: skins[i % skins.length],
        node: start,
        prev: null,
        wait: Math.random() * 3,
        phase: Math.random() * 10,
        flip: false,
        back: false,
        moving: false,
        bubble: null,
        bubbleUntil: 0
      };
      const p = pointFor(start, c);
      c.x = p.x;
      c.y = p.y;
      folk.push(c);
    }
    this.townsfolk = { folk, neighbours, pointFor };
  }

  updateTownsfolk(dt) {
    if (!this.townsfolk) this.buildTownsfolk();
    const { folk, neighbours, pointFor } = this.townsfolk;
    const lines = ['Fresh bread, still warm!', 'Lovely day, isn\'t it?', 'Have you seen the Abyss portal?', 'Mind your coin purse.',
      'Brom\'s hammer never sleeps.', 'Monsters past the north gate!', 'Valka\'s runes glow brighter today.', 'Apples! Two for a copper!'];
    const now = performance.now();
    for (const c of folk) {
      if (c.wait > 0) {
        c.wait -= dt;
        c.moving = false;
        continue;
      }
      if (!c.target) {
        const options = neighbours(c.node).filter(n => n !== c.prev);
        const next = options.length ? options[Math.floor(Math.random() * options.length)] : c.prev;
        c.prev = c.node;
        c.node = next;
        c.target = pointFor(next, c);
      }
      const dx = c.target.x - c.x, dy = c.target.y - c.y;
      const dist = Math.hypot(dx, dy);
      const step = c.speed * dt;
      if (dist <= step) {
        c.x = c.target.x;
        c.y = c.target.y;
        c.target = null;
        if (Math.random() < 0.35) {
          c.wait = 1 + Math.random() * 3;
          if (Math.random() < 0.3) {
            c.bubble = lines[Math.floor(Math.random() * lines.length)];
            c.bubbleUntil = now + 2600;
          }
        }
      } else {
        c.x += (dx / dist) * step;
        c.y += (dy / dist) * step;
        c.moving = true;
        c.phase += dt * c.speed * 6;
        // isometric screen direction: +x goes right-down, +y goes left-down
        const sx = dx - dy, sy = dx + dy;
        if (Math.abs(sx) > 0.01) c.flip = sx < 0;
        c.back = sy < 0;
      }
    }
  }

  drawTownsfolk(ctx, c) {
    const screen = Isometric.worldToScreen(c.x, c.y, 0, this.camera, this.canvas.width, this.canvas.height);
    if (screen.x < -60 || screen.y < -80 || screen.x > this.canvas.width + 60 || screen.y > this.canvas.height + 60) return;
    const z = this.camera.zoom;
    const p = 2 * z; // one sprite pixel
    const x = Math.round(screen.x), y = Math.round(screen.y);
    // idle pose, or one of four walk frames per stride cycle
    const frame = c.moving ? 1 + (((Math.floor(c.phase / (Math.PI / 2)) % 4) + 4) % 4) : 0;
    const sprite = this.townsfolkSprite(c, c.back, frame);

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y, 7 * p * 0.6, 3 * p * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y);
    if (c.flip) ctx.scale(-1, 1);
    ctx.drawImage(sprite, -9 * p, -27 * p, sprite.width * p, sprite.height * p);
    ctx.restore();

    if (c.bubble && performance.now() < c.bubbleUntil) this.drawSpeechBubble(ctx, x, y - 26 * p, c.bubble);
  }

  // One townsperson pose as a tiny pixel-art canvas (18x28, feet at the bottom
  // centre). Parts are laid down as materials, then lit from the top-left,
  // shadowed on the bottom-right and outlined. Cached per person/view/frame.
  townsfolkSprite(c, back, frame) {
    if (!this.townsfolkSprites) this.townsfolkSprites = new Map();
    const cacheKey = `${c.id}|${back ? 'b' : 'f'}|${frame}`;
    const cached = this.townsfolkSprites.get(cacheKey);
    if (cached) return cached;

    const W = 18, H = 28;
    const o = c.outfit;
    const rgb = col => (typeof col === 'string' ? [1, 3, 5].map(i => parseInt(col.slice(i, i + 2), 16)) : col);
    const mix = (col, t) => rgb(col).map(v => Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t)));
    const mats = {};
    const mat = (name, col) => { mats[name] = { b: rgb(col), l: mix(col, 0.28), d: mix(col, -0.32) }; };
    mat('skin', c.skin);
    mat('hair', o.hair);
    mat('hairD', mix(o.hair, -0.3));
    mat('tunic', o.tunic);
    mat('fold', mix(o.tunic, -0.22));
    mat('armL', o.tunic);
    mat('armR', o.tunic);
    mat('trim', o.trim || '#e8dcc0');
    mat('belt', '#4a2f1c');
    mat('apron', '#efe6cf');
    mat('legL', o.legs);
    mat('legR', o.legs);
    mat('bootL', '#3d2817');
    mat('bootR', '#3d2817');
    mat('hat', o.hat || '#6d4423');
    mat('band', o.band || '#3b2a1a');
    mat('basket', '#a4723f');
    mat('basketD', '#6e4520');
    mat('wood', '#7a5233');
    mat('gem', '#7fd4e8');

    // y is shifted down one row so a hat brim on a bobbing frame keeps its outline
    const grid = new Array(W * H).fill(null);
    const flat = new Map();
    const at = (x, y) => (x >= 0 && x < W && y + 1 >= 0 && y + 1 < H ? (y + 1) * W + x : -1);
    const set = (x, y, m) => { const i = at(x, y); if (i >= 0) { grid[i] = m; flat.delete(i); } };
    const clear = (x, y) => { const i = at(x, y); if (i >= 0) { grid[i] = null; flat.delete(i); } };
    const fill = (x0, y0, x1, y1, m) => { for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) set(xx, yy, m); };
    const dot = (x, y, col) => { const i = at(x, y); if (i >= 0) { grid[i] = '*'; flat.set(i, rgb(col)); } };

    const stride = [0, 1, 0, -1, 0][frame];
    const bob = [0, 0, 1, 0, 1][frame];
    const U = yy => yy - bob; // upper body rides the step bob
    const liftL = stride > 0 ? 1 : 0, liftR = stride < 0 ? 1 : 0;

    // staff (behind everything, planted on the ground)
    if (o.staff) {
      fill(2, 8, 2, 25, 'wood');
      fill(1, 6, 3, 7, 'wood');
      set(2, 6, 'gem');
    }

    // legs + boots
    const leg = (x0, lift, lm, bm) => {
      fill(x0, U(19), x0 + 2, 23 - lift, lm);
      fill(x0, 24 - lift, x0 + 2, 25 - lift, bm);
    };
    leg(6, liftL, 'legL', 'bootL');
    leg(9, liftR, 'legR', 'bootR');

    // torso, skirt / dress
    fill(5, U(11), 12, U(18), 'tunic');
    clear(5, U(11));
    clear(12, U(11));
    if (o.dress) {
      fill(5, U(17), 12, U(19), 'tunic');
      fill(4, U(20), 13, U(22), 'tunic');
      fill(4, U(23), 13, U(23), 'trim');
      for (let yy = U(19); yy <= U(22); yy++) { set(7, yy, 'fold'); set(10, yy, 'fold'); }
    } else {
      set(8, U(18), 'fold');
    }
    if (back) {
      fill(7, U(11), 10, U(11), 'trim');
    } else {
      set(7, U(11), 'trim');
      set(10, U(11), 'trim');
      set(8, U(11), 'skin');
      set(9, U(11), 'skin');
      set(8, U(12), 'trim');
      set(9, U(12), 'trim');
    }

    // belt, apron
    fill(5, U(16), 12, U(16), 'belt');
    if (!back) dot(9, U(16), '#e8c15a');
    if (o.apron) {
      if (back) {
        dot(8, U(17), '#efe6cf');
        dot(9, U(17), '#efe6cf');
      } else {
        fill(7, U(13), 10, U(o.dress ? 22 : 19), 'apron');
        set(7, U(12), 'apron');
        set(10, U(12), 'apron');
      }
    }

    // arms swing opposite to the legs; a staff or basket keeps that arm still
    const arm = (x0, dy, am) => {
      set(x0 < 5 ? 4 : 13, U(11), am);
      fill(x0, U(12), x0 + 1, U(15) + dy, am);
      fill(x0, U(16) + dy, x0 + 1, U(16) + dy, 'trim');
      fill(x0, U(17) + dy, x0 + 1, U(18) + dy, 'skin');
    };
    arm(3, o.staff ? 0 : -stride, 'armL');
    arm(13, o.basket ? 0 : stride, 'armR');

    if (o.basket) {
      fill(13, U(19), 16, U(21), 'basket');
      clear(13, U(21));
      clear(16, U(21));
      set(14, U(20), 'basketD');
      set(16, U(20), 'basketD');
      set(16, U(17), 'basketD');
      set(16, U(18), 'basketD');
      dot(15, U(18), '#c8382c');
      dot(15, U(17), '#d9a05b');
    }

    // head
    fill(6, U(4), 11, U(10), 'skin');
    clear(6, U(4));
    clear(11, U(4));
    clear(6, U(10));
    clear(11, U(10));
    const long = !!o.dress;
    if (back) {
      fill(6, U(3), 11, U(9), 'hair');
      clear(6, U(3));
      clear(11, U(3));
      if (long) {
        fill(5, U(4), 12, U(13), 'hair');
        clear(5, U(13));
        clear(12, U(13));
      }
      for (let yy = U(4); yy <= U(long ? 12 : 8); yy++) set(8, yy, 'hairD');
    } else {
      if (!long && !o.hat) { set(5, U(7), 'skin'); set(12, U(7), 'skin'); }
      fill(7, U(3), 10, U(3), 'hair');
      fill(6, U(4), 11, U(4), 'hair');
      fill(6, U(5), 7, U(5), 'hair');
      fill(10, U(5), 11, U(5), 'hair');
      set(8, U(5), 'hair');
      set(6, U(6), 'hair');
      set(11, U(6), 'hair');
      if (long) {
        fill(5, U(4), 5, U(13), 'hair');
        fill(12, U(4), 12, U(13), 'hair');
        set(5, U(9), 'hairD');
        set(12, U(10), 'hairD');
      }
      if (o.beard) {
        fill(6, U(8), 11, U(11), 'hair');
        clear(6, U(11));
        clear(11, U(11));
        set(8, U(10), 'hairD');
      }
      dot(7, U(7), '#2b1d22');
      dot(10, U(7), '#2b1d22');
      dot(8, U(9), mix(c.skin, -0.35));
      dot(9, U(9), mix(c.skin, -0.35));
      if (!o.beard) {
        const blush = rgb(c.skin).map((v, i) => Math.round(v * 0.8 + [214, 98, 98][i] * 0.2));
        dot(6, U(8), blush);
        dot(11, U(8), blush);
      }
    }
    if (o.hat) {
      fill(4, U(4), 13, U(4), 'hat');
      fill(6, U(1), 11, U(3), 'hat');
      clear(6, U(1));
      clear(11, U(1));
      fill(6, U(3), 11, U(3), 'band');
    }

    // shade + outline
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const sctx = canvas.getContext('2d');
    const img = sctx.createImageData(W, H);
    const OUTLINE = [26, 18, 32];
    const cell = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : grid[y * W + x]);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const m = grid[i];
        let col = null;
        if (m === null) {
          if (cell(x - 1, y) || cell(x + 1, y) || cell(x, y - 1) || cell(x, y + 1)) col = OUTLINE;
        } else if (flat.has(i)) {
          col = flat.get(i);
        } else {
          const t = mats[m];
          if (cell(x, y - 1) === null || cell(x - 1, y) === null) col = t.l;
          else if (cell(x + 1, y) !== m || cell(x, y + 1) !== m) col = t.d;
          else col = t.b;
        }
        if (!col) continue;
        img.data[i * 4] = col[0];
        img.data[i * 4 + 1] = col[1];
        img.data[i * 4 + 2] = col[2];
        img.data[i * 4 + 3] = 255;
      }
    }
    sctx.putImageData(img, 0, 0);
    this.townsfolkSprites.set(cacheKey, canvas);
    return canvas;
  }

  // Role title shown in front of a player's name; admins are drawn in red
  playerTitledName(player) {
    return player.role === 'admin' ? `[Admin] ${player.name}` : player.name;
  }

  playerNameColor(player) {
    return player.role === 'admin' ? '#ef4444' : '#fff';
  }

  drawEntityOverhead(ctx, screenX, screenY, name, hp, maxHp, nameColor = '#fff', levelTag = '', buffs = [], isCommander = false, hasCommanderBuff = false) {
    ctx.save();
    ctx.font = '15px "DotGothic16", monospace';
    ctx.textAlign = 'center';

    let titlePrefix = '';
    if (isCommander) {
      titlePrefix = '[Commander] ';
      nameColor = '#ffcd75';
    }

    // Name text
    ctx.fillStyle = '#000';
    ctx.fillText(`${titlePrefix}${levelTag} ${name}`, screenX + 1, screenY + 1);
    ctx.fillStyle = nameColor;
    ctx.fillText(`${titlePrefix}${levelTag} ${name}`, screenX, screenY);

    // Mini Health Bar
    const barW = isCommander ? 46 : 38;
    const barH = 5;
    const barX = screenX - barW / 2;
    const barY = screenY + 4;
    const hpRatio = Math.max(0, Math.min(1, hp / maxHp));

    const bx = Math.round(barX), by = Math.round(barY);
    ctx.fillStyle = '#1a1c2c';
    ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
    ctx.fillStyle = '#5d275d';
    ctx.fillRect(bx, by, barW, barH);
    const fillW = Math.round(barW * hpRatio);
    ctx.fillStyle = isCommander ? '#ef7d57' : (hpRatio > 0.35 ? '#38b764' : '#b13e53');
    ctx.fillRect(bx, by, fillW, barH);
    ctx.fillStyle = isCommander ? '#ffcd75' : (hpRatio > 0.35 ? '#a7f070' : '#ef7d57');
    ctx.fillRect(bx, by, fillW, 1);

    // Draw Affix / Buff Badges above name
    if ((buffs && buffs.length > 0) || hasCommanderBuff) {
      const icons = [];
      if (hasCommanderBuff) icons.push({ icon: 'crown', color: '#ffcd75' });
      if (buffs) {
        if (buffs.includes('fortified')) icons.push({ icon: 'shield', color: '#94b0c2' });
        if (buffs.includes('frostbite')) icons.push({ icon: 'snow', color: '#41a6f6' });
        if (buffs.includes('venomous')) icons.push({ icon: 'poison', color: '#38b764' });
        if (buffs.includes('ignited')) icons.push({ icon: 'fire', color: '#ef7d57' });
      }

      const iconSpacing = 16;
      const startX = screenX - ((icons.length - 1) * iconSpacing) / 2;
      const badgeY = screenY - 12;

      ctx.imageSmoothingEnabled = false;
      icons.forEach((ic, idx) => {
        const ix = Math.round(startX + idx * iconSpacing);
        const iy = Math.round(badgeY);
        ctx.fillStyle = '#1a1c2c';
        ctx.fillRect(ix - 8, iy - 8, 16, 16);
        ctx.fillStyle = ic.color;
        ctx.fillRect(ix - 8, iy + 6, 16, 2);
        if (window.PixelIcons) ctx.drawImage(PixelIcons.image(ic.icon), ix - 6, iy - 7, 12, 12);
      });
    }

    ctx.restore();
  }

  // Draw Comic Speech Bubble
  drawSpeechBubble(ctx, screenX, screenY, text) {
    ctx.save();
    ctx.font = '14px "DotGothic16", monospace';
    const textMetrics = ctx.measureText(text);
    const bubbleW = Math.max(60, textMetrics.width + 16);
    const bubbleH = 26;
    const bubbleX = screenX - bubbleW / 2;
    const bubbleY = screenY - bubbleH;

    // Bubble Body
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#1a1c2c';
    ctx.fillRect(bubbleX - 2, bubbleY - 2, bubbleW + 4, bubbleH + 4);
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);

    // Tail
    ctx.beginPath();
    ctx.moveTo(screenX - 5, bubbleY + bubbleH);
    ctx.lineTo(screenX, bubbleY + bubbleH + 6);
    ctx.lineTo(screenX + 5, bubbleY + bubbleH);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();

    // Text
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, screenX, bubbleY + bubbleH / 2);

    ctx.restore();
  }

  // Draw Overlays: Click Beacon, Particles, Floating Combat Text
  drawEffects(ctx, dt) {
    this.drawProjectiles(ctx, dt);
    const z = this.camera.zoom;

    // 1. Click-to-Move Destination Beacon
    if (this.animations.clickMarker) {
      const marker = this.animations.clickMarker;
      marker.life -= dt * 1.8;

      const screen = Isometric.worldToScreen(marker.x, marker.y, 0, this.camera, this.canvas.width, this.canvas.height);
      const ringRadius = (1.0 - marker.life) * 24 * z;
      const alpha = Math.max(0, marker.life);

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, ringRadius * 1.5, ringRadius * 0.75, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();

      if (marker.life <= 0) {
        this.animations.clickMarker = null;
      }
    }

    // 1.5. Visual Skill Effects (Whirlwind, Firestorm, Shadow Strike)
    if (this.animations.skillEffects) {
      for (let i = this.animations.skillEffects.length - 1; i >= 0; i--) {
        const fx = this.animations.skillEffects[i];
        fx.life -= dt;
        if (fx.life <= 0) {
          this.animations.skillEffects.splice(i, 1);
          continue;
        }

        const progress = 1.0 - (fx.life / fx.maxLife);
        const alpha = Math.max(0, fx.life / fx.maxLife);

        // Continuous Multi-Wave Particle Emitter for Active Skills
        fx.emitTimer = (fx.emitTimer || 0) + dt;
        if (fx.emitTimer >= 0.045) {
          fx.emitTimer = 0;
          this.emitSkillParticlesTick(fx, progress, alpha);
        }

        if (fx.type === 'sp_skill') {
          const base = ctx.getTransform();
          try {
            this.drawSpSkill(ctx, fx, progress, alpha);
          } catch (err) {
            // drop the broken effect so it cannot fail again every frame
            this.reportDrawError('sp_skill:' + (fx.skillId || fx.shape), err);
            this.recoverContext(ctx, base);
            this.animations.skillEffects.splice(i, 1);
          }
          continue;
        }

        const toScreen = (wx, wy, wz = 0) => Isometric.worldToScreen(wx, wy, wz, this.camera, this.canvas.width, this.canvas.height);
        if (this.drawBaseRogueSkill(ctx, fx, progress, alpha, toScreen, z)) {
          continue;
        }

        if (fx.type === 'sweeping_edge') {
          if (fx.x === undefined || fx.y === undefined || isNaN(fx.x) || isNaN(fx.y)) {
            continue;
          }
          this.drawSweepSlash(ctx, fx, progress);
        } else if (fx.type === 'mage_basic_blast') {
          // Mage Incandescent Solar Arcane Burst
          if (fx.x === undefined || fx.y === undefined || isNaN(fx.x) || isNaN(fx.y)) {
            continue;
          }
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.45, this.camera, this.canvas.width, this.canvas.height);
          if (isNaN(screen.x) || isNaN(screen.y)) continue;

          const rad = (16 + progress * 24) * z;
          if (isNaN(rad) || rad <= 0) continue;

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Outer solar blast halo
          const mbGrad = ctx.createRadialGradient(screen.x, screen.y, Math.max(1, 2 * z), screen.x, screen.y, rad);
          mbGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
          mbGrad.addColorStop(0.35, `rgba(254, 240, 138, ${alpha * 0.9})`);
          mbGrad.addColorStop(0.7, `rgba(249, 115, 22, ${alpha * 0.65})`);
          mbGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
          ctx.fillStyle = mbGrad;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, rad, 0, Math.PI * 2);
          ctx.fill();

          // 4-pointed radiant stellar star flare
          const flareR = rad * 1.35;
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.lineWidth = 2 * z;
          ctx.beginPath();
          ctx.moveTo(screen.x - flareR, screen.y); ctx.lineTo(screen.x + flareR, screen.y);
          ctx.moveTo(screen.x, screen.y - flareR); ctx.lineTo(screen.x, screen.y + flareR);
          ctx.stroke();
          ctx.restore();
        } else if (fx.type === 'whirlwind') {
          // Warrior Whirlwind - three steel blade trails sweeping flat around
          // the hero on the iso ground plane, sized to the real hit radius.
          // A world-space circle of radius r projects to an axis-aligned
          // ellipse of r*TILE_W/sqrt(2) by r*TILE_H/sqrt(2) on screen.
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const hitRadius = fx.radius || 3.2;
          const grow = 1 - Math.pow(1 - Math.min(1, progress * 2.5), 3); // ease-out
          const rx = hitRadius * (TILE_WIDTH / Math.SQRT2) * z * (0.55 + 0.45 * grow);
          const ry = rx * 0.5;
          const fade = alpha * Math.min(1, progress * 8);
          const rot = this.animations.time * 11;
          const lift = 14 * z; // blades sweep at sword height, not on the floor

          ctx.save();
          ctx.translate(screen.x, screen.y);

          // Ground: soft wind pressure disc + expanding shockwave ring
          const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
          glow.addColorStop(0, `rgba(186, 230, 253, ${fade * 0.22})`);
          glow.addColorStop(0.7, `rgba(56, 189, 248, ${fade * 0.12})`);
          glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.save();
          ctx.scale(1, 0.5);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(0, 0, rx, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          const shockR = rx * (0.35 + progress * 0.85);
          ctx.beginPath();
          ctx.ellipse(0, 0, shockR, shockR * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(224, 242, 254, ${fade * (1 - progress) * 0.6})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();

          ctx.globalCompositeOperation = 'lighter';
          ctx.lineCap = 'butt'; // round caps overlap into visible beads under 'lighter'

          // Tapered trail along the ground-plane ellipse: thick & bright at
          // the blade head, fading to nothing at the tail.
          const drawTrail = (head, length, radiusScale, width, color, segments) => {
            const r1 = rx * radiusScale;
            const r2 = ry * radiusScale;
            for (let s = 0; s < segments; s++) {
              const t0 = s / segments;
              const t1 = (s + 1) / segments;
              const a0 = head - length * (1 - t0);
              const a1 = head - length * (1 - t1);
              ctx.beginPath();
              ctx.moveTo(Math.cos(a0) * r1, Math.sin(a0) * r2 - lift);
              ctx.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r2 - lift);
              ctx.strokeStyle = color(t1);
              ctx.lineWidth = Math.max(0.5, width * t1);
              ctx.stroke();
            }
          };

          for (let b = 0; b < 3; b++) {
            const head = rot + (b * Math.PI * 2) / 3;
            // Wide cyan wind wake, then the steel edge, then a white-hot core
            drawTrail(head, 2.1, 1.0, 11 * z, t => `rgba(56, 189, 248, ${fade * t * 0.35})`, 22);
            drawTrail(head, 1.6, 0.97, 5 * z, t => `rgba(203, 213, 225, ${fade * t * 0.8})`, 18);
            drawTrail(head, 1.1, 0.97, 2.2 * z, t => `rgba(255, 255, 255, ${fade * t})`, 14);

            // Glint where the blade edge is
            const hx = Math.cos(head) * rx * 0.97;
            const hy = Math.sin(head) * ry * 0.97 - lift;
            const g = (5 + Math.sin(this.animations.time * 40 + b) * 1.5) * z;
            ctx.fillStyle = `rgba(255, 255, 255, ${fade})`;
            ctx.beginPath();
            ctx.moveTo(hx, hy - g * 1.8); ctx.lineTo(hx + g * 0.35, hy);
            ctx.lineTo(hx, hy + g * 1.8); ctx.lineTo(hx - g * 0.35, hy);
            ctx.closePath();
            ctx.moveTo(hx - g * 1.8, hy); ctx.lineTo(hx, hy - g * 0.35);
            ctx.lineTo(hx + g * 1.8, hy); ctx.lineTo(hx, hy + g * 0.35);
            ctx.closePath();
            ctx.fill();
          }

          // Inner cyclone: two faster, thinner wind bands at different radii
          drawTrail(rot * 1.6, 3.4, 0.62, 3 * z, t => `rgba(224, 242, 254, ${fade * t * 0.55})`, 20);
          drawTrail(rot * 1.6 + Math.PI, 3.4, 0.4, 2.2 * z, t => `rgba(186, 230, 253, ${fade * t * 0.45})`, 16);

          ctx.restore();

        } else if (fx.type === 'firestorm') {
          // Mage Firestorm - Expanding Volcanic Inferno Shockwave
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.5) * 32 * z * Math.min(1.0, progress * 1.4);

          ctx.save();
          // Boiling solar plasma core
          const grad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
          grad.addColorStop(0.2, `rgba(254, 240, 138, ${alpha * 0.9})`);
          grad.addColorStop(0.5, `rgba(249, 115, 22, ${alpha * 0.75})`);
          grad.addColorStop(0.85, `rgba(220, 38, 38, ${alpha * 0.45})`);
          grad.addColorStop(1, 'rgba(127, 29, 29, 0)');

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();

          // Blazing Fire Ring Edge with animated flame tongues
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.95})`;
          ctx.lineWidth = 4.5 * z;
          ctx.stroke();

          // Inner flame vortex swirl
          const fireRot = this.animations.time * 8;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad * 0.7, rad * 0.35, fireRot, 0, Math.PI * 1.7);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();

          ctx.restore();

        } else if (fx.type === 'blade_charge') {
          // Warrior Blade Charge - Golden Steel Rush Streak & Sonic Boom
          const p1 = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const p2 = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);

          ctx.save();
          // Outer Gold Glow Speed Tunnel
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(245, 158, 11, ${alpha * 0.85})`;
          ctx.lineWidth = 14 * z;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Inner Gleaming Steel Laser Beam
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 5 * z;
          ctx.stroke();

          // Sonic Boom Rings along the dash path
          const midX = (p1.x + p2.x) * 0.5;
          const midY = (p1.y + p2.y) * 0.5;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy) || 1;
          const px = -dy / len;
          const py = dx / len;
          const cutSize = 18 * z;

          for (let c = -1; c <= 1; c++) {
            const cx = midX + (dx / len) * (c * 15 * z);
            const cy = midY + (dy / len) * (c * 15 * z);
            ctx.beginPath();
            ctx.moveTo(cx - px * cutSize, cy - py * cutSize);
            ctx.lineTo(cx + px * cutSize, cy + py * cutSize);
            ctx.strokeStyle = `rgba(254, 240, 138, ${alpha * 0.95})`;
            ctx.lineWidth = 3.5 * z;
            ctx.stroke();
          }

          // Impact shockwave flare at destination
          const flareRad = 28 * z * progress;
          ctx.beginPath();
          ctx.ellipse(p2.x, p2.y, flareRad, flareRad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251, 191, 36, ${alpha * 0.7})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();
          ctx.restore();

        } else if (fx.type === 'earthshaker') {
          // Warrior Earthshaker Slam - Molten Magma Fissures & Ground Shatter
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.4) * 26 * z * Math.min(1.0, progress * 1.5);

          ctx.save();
          // Molten crater radial gradient
          const craterGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, rad);
          craterGrad.addColorStop(0, `rgba(254, 240, 138, ${alpha * 0.9})`);
          craterGrad.addColorStop(0.35, `rgba(249, 115, 22, ${alpha * 0.7})`);
          craterGrad.addColorStop(0.75, `rgba(180, 83, 9, ${alpha * 0.4})`);
          craterGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = craterGrad;
          ctx.fill();

          // Heavy golden shockwave border
          ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.95})`;
          ctx.lineWidth = 4.5 * z;
          ctx.stroke();

          // Glowing Molten Magma Fissure Cracks
          for (let a = 0; a < 6; a++) {
            const angle = (a * Math.PI / 3) + 0.25;
            const crackLen = rad * 0.95;
            const midCrackX = screen.x + Math.cos(angle) * (crackLen * 0.5) + (Math.sin(a * 4) * 6 * z);
            const midCrackY = screen.y + Math.sin(angle) * (crackLen * 0.25) + (Math.cos(a * 4) * 4 * z);
            const endCrackX = screen.x + Math.cos(angle) * crackLen;
            const endCrackY = screen.y + Math.sin(angle) * (crackLen * 0.5);

            // Outer dark stone fissure
            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y);
            ctx.lineTo(midCrackX, midCrackY);
            ctx.lineTo(endCrackX, endCrackY);
            ctx.strokeStyle = `rgba(69, 26, 3, ${alpha * 0.95})`;
            ctx.lineWidth = 4 * z;
            ctx.stroke();

            // Inner molten lava glow
            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y);
            ctx.lineTo(midCrackX, midCrackY);
            ctx.lineTo(endCrackX, endCrackY);
            ctx.strokeStyle = `rgba(254, 240, 138, ${alpha * 0.98})`;
            ctx.lineWidth = 1.8 * z;
            ctx.stroke();
          }
          ctx.restore();

        } else if (fx.type === 'frost_nova') {
          // Mage Frost Nova - Ancient Glacial Rune Circle & 3D Crystal Ice Spires
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.0) * 24 * z * Math.min(1.0, progress * 1.6);
          const frostRot = this.animations.time * 2.5;

          ctx.save();
          // Crystalline ice blue radial aura
          const iceGrad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          iceGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.95})`);
          iceGrad.addColorStop(0.3, `rgba(186, 230, 253, ${alpha * 0.75})`);
          iceGrad.addColorStop(0.7, `rgba(56, 189, 248, ${alpha * 0.45})`);
          iceGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = iceGrad;
          ctx.fill();

          // Frost Rune Compass Outer Ring
          ctx.strokeStyle = `rgba(186, 230, 253, ${alpha * 0.95})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();

          // Inner rotating frost sigil ring
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad * 0.65, rad * 0.32, frostRot, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();

          // 8 Expanding 3D Crystalline Ice Spires
          for (let a = 0; a < 8; a++) {
            const angle = (a * Math.PI / 4) + frostRot;
            const spireBaseX = screen.x + Math.cos(angle) * (rad * 0.65);
            const spireBaseY = screen.y + Math.sin(angle) * (rad * 0.32);
            const spireTipX = screen.x + Math.cos(angle) * (rad * 1.15);
            const spireTipY = screen.y + Math.sin(angle) * (rad * 0.58) - (14 * z * Math.sin(progress * Math.PI));

            ctx.beginPath();
            ctx.moveTo(spireBaseX - 3 * z, spireBaseY);
            ctx.lineTo(spireTipX, spireTipY);
            ctx.lineTo(spireBaseX + 3 * z, spireBaseY);
            ctx.closePath();
            ctx.fillStyle = `rgba(186, 230, 253, ${alpha * 0.85})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
            ctx.lineWidth = 1.5 * z;
            ctx.stroke();
          }
          ctx.restore();
        } else if (fx.type === 'arcane_blink') {
          // Mage Arcane Blink - Cosmic Portal Rifts & Spatial Distortion
          const p1 = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const p2 = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Outer Celestial Energy Rush Beam
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.85})`;
          ctx.lineWidth = 10 * z;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Blinding Incandescent Core Laser
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 3.5 * z;
          ctx.stroke();

          // Origin Collapsing Dimensional Rift
          const r1 = 26 * z * (1.0 - progress);
          ctx.beginPath();
          ctx.ellipse(p1.x, p1.y, r1, r1 * 0.5, this.animations.time * 8, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.95})`;
          ctx.lineWidth = 3 * z;
          ctx.stroke();

          // Destination Expanding Cosmic Nova Portal
          const r2 = 34 * z * Math.min(1.0, progress * 1.5);
          const destGrad = ctx.createRadialGradient(p2.x, p2.y, 2 * z, p2.x, p2.y, r2);
          destGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
          destGrad.addColorStop(0.35, `rgba(56, 189, 248, ${alpha * 0.85})`);
          destGrad.addColorStop(0.75, `rgba(168, 85, 247, ${alpha * 0.5})`);
          destGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = destGrad;
          ctx.beginPath();
          ctx.ellipse(p2.x, p2.y, r2, r2 * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // 4-Pointed Celestial Star Flare at Destination
          const starLen = r2 * 1.4;
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.lineWidth = 2.2 * z;
          ctx.beginPath();
          ctx.moveTo(p2.x - starLen, p2.y); ctx.lineTo(p2.x + starLen, p2.y);
          ctx.moveTo(p2.x, p2.y - starLen * 0.5); ctx.lineTo(p2.x, p2.y + starLen * 0.5);
          ctx.stroke();

          ctx.restore();

        } else if (fx.type === 'fan_of_knives') {
          // Rogue Fan of Knives - 12 Whirling Poison-Tipped Razor Daggers
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.4) * 26 * z * Math.min(1.0, progress * 1.4);
          const rot = this.animations.time * 14;

          ctx.save();
          // Central toxic poison flash
          const burstGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, 20 * z);
          burstGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.95})`);
          burstGrad.addColorStop(0.4, `rgba(74, 222, 128, ${alpha * 0.8})`);
          burstGrad.addColorStop(0.8, `rgba(168, 85, 247, ${alpha * 0.4})`);
          burstGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = burstGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, 20 * z, 10 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // 12 Radiating Ornate Throwing Daggers with luminous motion trails
          for (let k = 0; k < 12; k++) {
            const angle = (k * (Math.PI * 2 / 12)) + rot;
            const kx = screen.x + Math.cos(angle) * rad;
            const ky = screen.y + Math.sin(angle) * (rad * 0.5);
            const prevKx = screen.x + Math.cos(angle - 0.25) * (rad * 0.78);
            const prevKy = screen.y + Math.sin(angle - 0.25) * (rad * 0.39);

            // Glowing poison motion-blur trail
            ctx.beginPath();
            ctx.moveTo(prevKx, prevKy);
            ctx.lineTo(kx, ky);
            ctx.strokeStyle = `rgba(34, 197, 94, ${alpha * 0.75})`;
            ctx.lineWidth = 3.5 * z;
            ctx.stroke();

            // Render Stylized Steel Dagger
            ctx.save();
            ctx.translate(kx, ky);
            ctx.rotate(angle + Math.PI * 0.5);

            // Steel Blade Face
            ctx.beginPath();
            ctx.moveTo(0, -9 * z); // Sharp dagger tip
            ctx.lineTo(3 * z, 2 * z);
            ctx.lineTo(1.2 * z, 7 * z); // Crossguard
            ctx.lineTo(-1.2 * z, 7 * z);
            ctx.lineTo(-3 * z, 2 * z);
            ctx.closePath();
            ctx.fillStyle = '#f1f5f9';
            ctx.fill();
            ctx.strokeStyle = `rgba(34, 197, 94, ${alpha * 0.95})`; // Poison edge glow
            ctx.lineWidth = 1.6 * z;
            ctx.stroke();

            // Specular Blade Ridge Highlight
            ctx.beginPath();
            ctx.moveTo(0, -8 * z);
            ctx.lineTo(0, 5 * z);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2 * z;
            ctx.stroke();

            // Wrapped Hilt
            ctx.fillStyle = '#1e1b4b';
            ctx.fillRect(-1.5 * z, 6 * z, 3 * z, 5 * z);

            ctx.restore();
          }
          ctx.restore();

        } else if (fx.type === 'toxic_bomb') {
          // Rogue Toxic Bomb - Boiling Cauldron Acid Pool & Poison Vapors
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.2) * 28 * z * Math.min(1.0, progress * 1.5);

          ctx.save();
          // Boiling Acid Pool Radial Gradient
          const toxGrad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          toxGrad.addColorStop(0, `rgba(187, 247, 208, ${alpha * 0.95})`);
          toxGrad.addColorStop(0.35, `rgba(74, 222, 128, ${alpha * 0.85})`);
          toxGrad.addColorStop(0.75, `rgba(22, 101, 52, ${alpha * 0.6})`);
          toxGrad.addColorStop(1, 'rgba(5, 46, 22, 0)');

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = toxGrad;
          ctx.fill();

          // Outer Caustic Hazard Border Ring
          ctx.strokeStyle = `rgba(134, 239, 172, ${alpha * 0.95})`;
          ctx.lineWidth = 3.5 * z;
          ctx.stroke();

          // 7 Animated Popping Acid Bubbles
          for (let b = 0; b < 7; b++) {
            const bAngle = (b * 1.1) + this.animations.time * 2;
            const bDist = (0.2 + (b % 4) * 0.2) * rad;
            const bx = screen.x + Math.cos(bAngle) * bDist;
            const by = screen.y + Math.sin(bAngle) * (bDist * 0.5);
            const bPhase = (this.animations.time * 5 + b * 1.7) % Math.PI;
            const bSize = Math.sin(bPhase) * 6 * z;

            if (bSize > 1) {
              ctx.beginPath();
              ctx.arc(bx, by, bSize, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(134, 239, 172, ${alpha * 0.9})`;
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1 * z;
              ctx.stroke();

              // Specular bubble shine
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(bx - bSize * 0.35, by - bSize * 0.35, bSize * 0.3, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Billowing Toxic Smoke Cloud
          const smokeGrad = ctx.createRadialGradient(screen.x, screen.y - 12 * z, 2 * z, screen.x, screen.y - 12 * z, rad * 0.85);
          smokeGrad.addColorStop(0, `rgba(74, 222, 128, ${alpha * 0.5})`);
          smokeGrad.addColorStop(0.6, `rgba(22, 101, 52, ${alpha * 0.3})`);
          smokeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = smokeGrad;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y - 12 * z, rad * 0.85, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();

        } else if (fx.type === 'shadow_dash') {
          // Rogue Shadow Dash - Obsidian Phantom Dash & Void Streamers
          const p1 = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const p2 = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Outer Abyssal Void Corona
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(147, 51, 234, ${alpha * 0.85})`;
          ctx.lineWidth = 12 * z;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Inner Gleaming Violet Laser Beam
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 3.5 * z;
          ctx.stroke();

          // Void Shockwave Rings at Dash Points
          const r1 = 18 * z * (1.0 - progress);
          ctx.beginPath();
          ctx.ellipse(p1.x, p1.y, r1, r1 * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.9})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();

          const r2 = 24 * z * Math.min(1.0, progress * 1.5);
          ctx.beginPath();
          ctx.ellipse(p2.x, p2.y, r2, r2 * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.95})`;
          ctx.lineWidth = 3 * z;
          ctx.stroke();

          ctx.restore();

        } else if (fx.type === 'shadow_strike') {
          // Rogue Shadow Strike - Intersecting Razor Void Cross-Cleaves
          const p1 = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4, this.camera, this.camera, this.canvas.width, this.canvas.height);
          const p2 = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Teleport Dash Laser Line
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.9})`;
          ctx.lineWidth = 7 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();

          // Dual Cross-Cleave Razor Scythes at Destination
          const cutSize = 26 * z * progress;
          ctx.beginPath();
          ctx.moveTo(p2.x - cutSize, p2.y - cutSize * 0.5);
          ctx.lineTo(p2.x + cutSize, p2.y + cutSize * 0.5);
          ctx.moveTo(p2.x + cutSize, p2.y - cutSize * 0.5);
          ctx.lineTo(p2.x - cutSize, p2.y + cutSize * 0.5);
          ctx.strokeStyle = `rgba(236, 72, 153, ${alpha * 0.95})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(p2.x - cutSize * 0.8, p2.y - cutSize * 0.4);
          ctx.lineTo(p2.x + cutSize * 0.8, p2.y + cutSize * 0.4);
          ctx.moveTo(p2.x + cutSize * 0.8, p2.y - cutSize * 0.4);
          ctx.lineTo(p2.x - cutSize * 0.8, p2.y + cutSize * 0.4);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();

          ctx.restore();

        } else if (fx.type === 'colossus_strike') {
          // Warrior Colossus Strike - Descending Titan Greatsword & Holy Ground Shatter
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.0) * 32 * z * Math.min(1.0, progress * 1.5);

          ctx.save();
          // Molten Holy Impact Crater Gradient
          const grad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
          grad.addColorStop(0.25, `rgba(254, 240, 138, ${alpha * 0.92})`);
          grad.addColorStop(0.6, `rgba(245, 158, 11, ${alpha * 0.7})`);
          grad.addColorStop(0.85, `rgba(180, 83, 9, ${alpha * 0.45})`);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();

          // Golden Seismic Shockwave Border
          ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.98})`;
          ctx.lineWidth = 5 * z;
          ctx.stroke();

          // Descending Titan Greatsword Phantom (impaled in center)
          const swordH = 48 * z * (1 - progress * 0.2);
          const swordDrop = Math.max(0, (1 - progress * 3) * 60 * z);
          const swordY = screen.y - swordDrop;

          ctx.save();
          ctx.translate(screen.x, swordY);

          // Greatsword Holy Golden Blade
          ctx.beginPath();
          ctx.moveTo(0, 0); // Tip in ground
          ctx.lineTo(6 * z, -swordH * 0.7);
          ctx.lineTo(6 * z, -swordH);
          ctx.lineTo(-6 * z, -swordH);
          ctx.lineTo(-6 * z, -swordH * 0.7);
          ctx.closePath();
          ctx.fillStyle = `rgba(254, 240, 138, ${alpha * 0.95})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();

          // Golden Crossguard & Pommel
          ctx.fillStyle = '#b45309';
          ctx.fillRect(-12 * z, -swordH - 3 * z, 24 * z, 6 * z);
          ctx.fillStyle = '#fde047';
          ctx.fillRect(-2.5 * z, -swordH - 15 * z, 5 * z, 12 * z); // Grip
          ctx.restore();

          // Radiant Ascending Light Pillars
          ctx.globalCompositeOperation = 'lighter';
          for (let p = -2; p <= 2; p++) {
            const px = screen.x + p * 12 * z;
            ctx.fillStyle = `rgba(254, 240, 138, ${alpha * 0.4})`;
            ctx.fillRect(px - 3 * z, screen.y - 70 * z, 6 * z, 70 * z);
          }

          ctx.restore();

        } else if (fx.type === 'shield_slam') {
          // Warrior Shield Slam - Concussive Sonic Boom Cone & Radiant Aegis Crest
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const facingAngles = { E: 0, SE: Math.PI * 0.25, S: Math.PI * 0.5, SW: Math.PI * 0.75, W: Math.PI, NW: -Math.PI * 0.75, N: -Math.PI * 0.5, NE: -Math.PI * 0.25 };
          const baseAngle = facingAngles[fx.facing] !== undefined ? facingAngles[fx.facing] : Math.PI * 0.25;
          const rad = (20 + progress * 26) * z;

          ctx.save();
          ctx.translate(screen.x, screen.y);
          ctx.rotate(baseAngle);
          ctx.globalCompositeOperation = 'lighter';

          // Concussive Shockwave Cone
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, rad, -Math.PI * 0.35, Math.PI * 0.35);
          ctx.closePath();
          const coneGrad = ctx.createRadialGradient(0, 0, 2 * z, 0, 0, rad);
          coneGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.95})`);
          coneGrad.addColorStop(0.4, `rgba(56, 189, 248, ${alpha * 0.8})`);
          coneGrad.addColorStop(0.8, `rgba(250, 204, 21, ${alpha * 0.5})`);
          coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = coneGrad;
          ctx.fill();

          // Outer Radiant Aegis Shield Crest Border
          ctx.beginPath();
          ctx.arc(0, 0, rad, -Math.PI * 0.35, Math.PI * 0.35);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();

          ctx.restore();

        } else if (fx.type === 'blood_rage') {
          // Warrior Blood Rage - Demonic Crimson Fury Aura & Orbiting Flame Wisps
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.2, this.camera, this.canvas.width, this.canvas.height);
          const rad = 28 * z * (0.7 + progress * 0.5);
          const rot = this.animations.time * 6;

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Inner Blood Fury Radial Glow
          const rageGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, rad);
          rageGrad.addColorStop(0, `rgba(254, 242, 242, ${alpha * 0.95})`);
          rageGrad.addColorStop(0.3, `rgba(239, 68, 68, ${alpha * 0.8})`);
          rageGrad.addColorStop(0.7, `rgba(185, 28, 28, ${alpha * 0.5})`);
          rageGrad.addColorStop(1, 'rgba(69, 10, 10, 0)');
          ctx.fillStyle = rageGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Jagged Demonic Spiked Fury Ring
          ctx.strokeStyle = `rgba(248, 113, 113, ${alpha * 0.95})`;
          ctx.lineWidth = 3.5 * z;
          ctx.stroke();

          // 6 Orbiting Crimson Flame Wisps
          for (let f = 0; f < 6; f++) {
            const fAngle = rot + (f * Math.PI * 2 / 6);
            const fxPos = screen.x + Math.cos(fAngle) * (rad * 0.85);
            const fyPos = screen.y + Math.sin(fAngle) * (rad * 0.42) - (8 * z * Math.sin(this.animations.time * 8 + f));

            ctx.beginPath();
            ctx.arc(fxPos, fyPos, 5 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(fxPos, fyPos, 9 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(239, 68, 68, ${alpha * 0.75})`;
            ctx.fill();
          }

          ctx.restore();

        } else if (fx.type === 'iron_fortress') {
          // Warrior Iron Fortress - 6 Rotating Fortified Steel Pavise Shields
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.3, this.camera, this.canvas.width, this.canvas.height);
          const rad = 30 * z;
          const rot = this.animations.time * 2.5;

          ctx.save();
          // Fortified Defense Barrier Ring
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(203, 213, 225, ${alpha * 0.85})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();

          // 6 Rotating Heavy Steel Pavise Shields
          for (let s = 0; s < 6; s++) {
            const sAngle = rot + (s * Math.PI * 2 / 6);
            const sx = screen.x + Math.cos(sAngle) * rad;
            const sy = screen.y + Math.sin(sAngle) * (rad * 0.5);

            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(sAngle + Math.PI * 0.5);

            // Steel Pavise Shield Face
            ctx.fillStyle = '#475569';
            ctx.fillRect(-4 * z, -9 * z, 8 * z, 18 * z);
            ctx.fillStyle = '#94a3b8'; // Specular highlight bevel
            ctx.fillRect(-4 * z, -9 * z, 8 * z, 3 * z);
            ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.95})`; // Golden defensive rune rim
            ctx.lineWidth = 1.5 * z;
            ctx.strokeRect(-4 * z, -9 * z, 8 * z, 18 * z);

            ctx.restore();
          }

          ctx.restore();

        } else if (fx.type === 'war_stomp') {
          // Warrior War Stomp - Triple Cascading Seismic Shockwave Rings
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.2) * 26 * z * Math.min(1.0, progress * 1.5);

          ctx.save();
          // Seismic Ground Glow
          const stompGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, rad);
          stompGrad.addColorStop(0, `rgba(254, 240, 138, ${alpha * 0.9})`);
          stompGrad.addColorStop(0.4, `rgba(245, 158, 11, ${alpha * 0.7})`);
          stompGrad.addColorStop(0.8, `rgba(180, 83, 9, ${alpha * 0.4})`);
          stompGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = stompGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Triple Expanding Seismic Rings
          for (let r = 1; r <= 3; r++) {
            const ringR = rad * (r / 3);
            ctx.beginPath();
            ctx.ellipse(screen.x, screen.y, ringR, ringR * 0.5, 0, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * (1 - r * 0.2)})`;
            ctx.lineWidth = (4.5 - r) * z;
            ctx.stroke();
          }

          ctx.restore();

        } else if (fx.type === 'chain_lightning') {
          // Mage Chain Lightning - Branching Fractal High-Voltage Arcs
          if (fx.points && fx.points.length > 1) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            for (let i = 0; i < fx.points.length - 1; i++) {
              const pt1 = Isometric.worldToScreen(fx.points[i].x, fx.points[i].y, 0.4, this.camera, this.canvas.width, this.canvas.height);
              const pt2 = Isometric.worldToScreen(fx.points[i + 1].x, fx.points[i + 1].y, 0.4, this.camera, this.canvas.width, this.canvas.height);

              // Draw Main Arc + 2 Branching Sub-Arcs with High-Frequency Jitter
              const segments = 6;
              const dx = (pt2.x - pt1.x) / segments;
              const dy = (pt2.y - pt1.y) / segments;
              const perpX = -dy;
              const perpY = dx;
              const pLen = Math.hypot(perpX, perpY) || 1;
              const normX = perpX / pLen;
              const normY = perpY / pLen;

              for (let arc = 0; arc < 2; arc++) {
                ctx.beginPath();
                ctx.moveTo(pt1.x, pt1.y);
                for (let s = 1; s < segments; s++) {
                  const jitter = (Math.random() - 0.5) * (20 + arc * 14) * z;
                  const sx = pt1.x + dx * s + normX * jitter;
                  const sy = pt1.y + dy * s + normY * jitter;
                  ctx.lineTo(sx, sy);
                }
                ctx.lineTo(pt2.x, pt2.y);

                // Outer Glowing Cyan/Violet Corona
                ctx.strokeStyle = arc === 0 ? `rgba(103, 232, 249, ${alpha * 0.95})` : `rgba(192, 132, 252, ${alpha * 0.8})`;
                ctx.lineWidth = (arc === 0 ? 5.5 : 3.0) * z;
                ctx.stroke();

                // Blinding Hot White Core
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
                ctx.lineWidth = (arc === 0 ? 2.5 : 1.2) * z;
                ctx.stroke();
              }

              // High-Voltage Contact Explosion Node at Points
              for (const pt of [pt1, pt2]) {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 8 * z, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 16 * z, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(103, 232, 249, ${alpha * 0.6})`;
                ctx.fill();
              }
            }

            ctx.restore();
          }

        } else if (fx.type === 'mana_shield') {
          // Mage Mana Shield - Shimmering Hexagonal Translucent Crystal Bubble
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const rad = 26 * z;
          const rot = this.animations.time * 3;

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Translucent Shield Dome
          const domeGrad = ctx.createRadialGradient(screen.x, screen.y - 12 * z, 2 * z, screen.x, screen.y - 12 * z, rad);
          domeGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.6})`);
          domeGrad.addColorStop(0.5, `rgba(56, 189, 248, ${alpha * 0.4})`);
          domeGrad.addColorStop(0.9, `rgba(147, 51, 234, ${alpha * 0.3})`);
          domeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = domeGrad;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y - 12 * z, rad, 0, Math.PI * 2);
          ctx.fill();

          // Hexagonal Shield Grid Matrix
          ctx.strokeStyle = `rgba(186, 230, 253, ${alpha * 0.9})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();

          // 4 Orbiting Arcane Focus Gems
          for (let g = 0; g < 4; g++) {
            const gAngle = rot + (g * Math.PI * 2 / 4);
            const gx = screen.x + Math.cos(gAngle) * rad;
            const gy = (screen.y - 12 * z) + Math.sin(gAngle) * (rad * 0.65);

            ctx.beginPath();
            ctx.arc(gx, gy, 4 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(gx, gy, 8 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.7})`;
            ctx.fill();
          }

          ctx.restore();

        } else if (fx.type === 'black_hole') {
          // Mage Cosmic Singularity - Absolute Event Horizon & Accretion Spiral Arms
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.8) * 28 * z * (0.6 + progress * 0.6);
          const rot = this.animations.time * 16;

          ctx.save();

          // Gravitational Lensing Violet Corona (Additive)
          ctx.globalCompositeOperation = 'lighter';
          const lensGrad = ctx.createRadialGradient(screen.x, screen.y, rad * 0.35, screen.x, screen.y, rad);
          lensGrad.addColorStop(0, `rgba(168, 85, 247, ${alpha * 0.9})`);
          lensGrad.addColorStop(0.5, `rgba(56, 189, 248, ${alpha * 0.6})`);
          lensGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = lensGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // 4 Rotating Spiral Galaxy Accretion Arms
          for (let arm = 0; arm < 4; arm++) {
            const baseAngle = rot + (arm * Math.PI * 0.5);
            ctx.beginPath();
            for (let step = 0; step < 16; step++) {
              const theta = baseAngle + (step * 0.28);
              const r = (rad * 0.35) + (step / 16) * (rad * 0.65);
              const ax = screen.x + Math.cos(theta) * r;
              const ay = screen.y + Math.sin(theta) * (r * 0.5);
              if (step === 0) ctx.moveTo(ax, ay); else ctx.lineTo(ax, ay);
            }
            ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.8})`;
            ctx.lineWidth = 3.5 * z;
            ctx.stroke();
          }

          // Blinding Incandescent Photon Sphere Rim
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad * 0.42, rad * 0.21, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();

          // Absolute Pitch-Black Event Horizon Core (Normal Composite)
          ctx.globalCompositeOperation = 'source-over';
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad * 0.38, rad * 0.19, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#020617';
          ctx.fill();

          ctx.restore();

        } else if (fx.type === 'blizzard') {
          // Mage Glacial Blizzard - Howling Glacial Vortex & Ice Spires
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.4) * 26 * z;
          const rot = this.animations.time * 8;

          ctx.save();
          // Sub-Zero Ground Frost Layer
          const blizGrad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          blizGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.85})`);
          blizGrad.addColorStop(0.35, `rgba(186, 230, 253, ${alpha * 0.65})`);
          blizGrad.addColorStop(0.75, `rgba(56, 189, 248, ${alpha * 0.35})`);
          blizGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
          ctx.fillStyle = blizGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Swirling Glacial Gale Rings
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, rot, 0, Math.PI * 1.8);
          ctx.strokeStyle = `rgba(186, 230, 253, ${alpha * 0.9})`;
          ctx.lineWidth = 3.5 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad * 0.65, rad * 0.32, -rot * 1.5, 0, Math.PI * 1.6);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();

          // 6 Impaling Glacial Ice Spires
          for (let s = 0; s < 6; s++) {
            const angle = (s * Math.PI / 3) + 0.3;
            const sx = screen.x + Math.cos(angle) * (rad * 0.6);
            const sy = screen.y + Math.sin(angle) * (rad * 0.3);
            const spikeH = 22 * z * Math.sin(progress * Math.PI);

            ctx.beginPath();
            ctx.moveTo(sx - 3 * z, sy);
            ctx.lineTo(sx, sy - spikeH);
            ctx.lineTo(sx + 3 * z, sy);
            ctx.closePath();
            ctx.fillStyle = `rgba(186, 230, 253, ${alpha * 0.9})`;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2 * z;
            ctx.stroke();
          }

          ctx.restore();

        } else if (fx.type === 'pyroblast') {
          // Mage Pyroblast - Solar Plasma Fireball Detonation
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const rad = 32 * z * Math.min(1.0, progress * 1.5);

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Boiling Solar Plasma Core
          const pyroGrad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          pyroGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
          pyroGrad.addColorStop(0.2, `rgba(254, 240, 138, ${alpha * 0.95})`);
          pyroGrad.addColorStop(0.5, `rgba(249, 115, 22, ${alpha * 0.85})`);
          pyroGrad.addColorStop(0.8, `rgba(220, 38, 38, ${alpha * 0.5})`);
          pyroGrad.addColorStop(1, 'rgba(127, 29, 29, 0)');
          ctx.fillStyle = pyroGrad;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, rad, 0, Math.PI * 2);
          ctx.fill();

          // Expanding Solar Prominence Flares
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, rad, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.98})`;
          ctx.lineWidth = 5 * z;
          ctx.stroke();

          // 8 Radiating Flame Tongues
          for (let f = 0; f < 8; f++) {
            const fAngle = (f * Math.PI / 4) + this.animations.time * 6;
            const fxPos = screen.x + Math.cos(fAngle) * (rad * 1.2);
            const fyPos = screen.y + Math.sin(fAngle) * (rad * 1.2);
            ctx.beginPath();
            ctx.arc(fxPos, fyPos, 4 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(254, 240, 138, ${alpha * 0.9})`;
            ctx.fill();
          }

          ctx.restore();

        } else if (fx.type === 'shadowstep') {
          // Rogue Shadowstep - Void Implosion & Phantom Cross-Slash
          const p1 = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const p2 = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Origin Shadow Implosion
          const r1 = 20 * z * (1 - progress);
          ctx.beginPath();
          ctx.arc(p1.x, p1.y, r1, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha})`;
          ctx.lineWidth = 3 * z;
          ctx.stroke();

          // Destination Void Emergence Cross-Slash
          const slashLen = 22 * z * progress;
          ctx.beginPath();
          ctx.moveTo(p2.x - slashLen, p2.y - slashLen * 0.5); ctx.lineTo(p2.x + slashLen, p2.y + slashLen * 0.5);
          ctx.moveTo(p2.x + slashLen, p2.y - slashLen * 0.5); ctx.lineTo(p2.x - slashLen, p2.y + slashLen * 0.5);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 3.5 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(p2.x, p2.y, 16 * z * progress, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(147, 51, 234, ${alpha * 0.6})`;
          ctx.fill();

          ctx.restore();

        } else if (fx.type === 'smoke_screen') {
          // Rogue Smoke Screen - Volumetric Rolling Ninja Concealment Fog
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.3, this.camera, this.canvas.width, this.canvas.height);
          const rad = 32 * z * (0.8 + progress * 0.5);

          ctx.save();
          // Volumetric Dark Matter Fog
          const smokeGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, rad);
          smokeGrad.addColorStop(0, `rgba(30, 41, 59, ${alpha * 0.92})`);
          smokeGrad.addColorStop(0.5, `rgba(51, 65, 85, ${alpha * 0.75})`);
          smokeGrad.addColorStop(0.85, `rgba(71, 85, 105, ${alpha * 0.45})`);
          smokeGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = smokeGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Outer Whispering Smoke Filaments
          ctx.strokeStyle = `rgba(148, 163, 184, ${alpha * 0.65})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();

          ctx.restore();

        } else if (fx.type === 'death_blossom') {
          // Rogue Death Blossom - Omnislash Multi-Directional Crimson Cleaves & Blood Lotus
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.0) * 28 * z;

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Epic Blood Lotus Core
          const blossomGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, 16 * z);
          blossomGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
          blossomGrad.addColorStop(0.4, `rgba(244, 114, 182, ${alpha * 0.85})`);
          blossomGrad.addColorStop(0.8, `rgba(225, 29, 72, ${alpha * 0.5})`);
          blossomGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = blossomGrad;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, 16 * z, 0, Math.PI * 2);
          ctx.fill();

          // 8 Razor Blade Omnislash Slashes Across Area
          for (let s = 0; s < 8; s++) {
            const angle = (s * Math.PI / 4) + progress * 10;
            const x1 = screen.x + Math.cos(angle) * (rad * 0.2);
            const y1 = screen.y + Math.sin(angle) * (rad * 0.1);
            const x2 = screen.x + Math.cos(angle) * rad;
            const y2 = screen.y + Math.sin(angle) * (rad * 0.5);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = `rgba(244, 114, 182, ${alpha * 0.95})`;
            ctx.lineWidth = 4 * z;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
            ctx.lineWidth = 1.8 * z;
            ctx.stroke();
          }

          ctx.restore();

        } else if (fx.type === 'poison_darts') {
          // Rogue Poison Darts - 6 Flying Venom Shurikens with Emerald Trails
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const rad = 28 * z * Math.min(1.0, progress * 1.5);
          const rot = this.animations.time * 20;

          ctx.save();
          for (let s = 0; s < 6; s++) {
            const angle = (s * Math.PI * 2 / 6) + rot * 0.3;
            const sx = screen.x + Math.cos(angle) * rad;
            const sy = screen.y + Math.sin(angle) * (rad * 0.5);

            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(rot);

            // 4-Pointed Steel Shuriken
            ctx.beginPath();
            ctx.moveTo(0, -6 * z);
            ctx.lineTo(1.8 * z, -1.8 * z);
            ctx.lineTo(6 * z, 0);
            ctx.lineTo(1.8 * z, 1.8 * z);
            ctx.lineTo(0, 6 * z);
            ctx.lineTo(-1.8 * z, 1.8 * z);
            ctx.lineTo(-6 * z, 0);
            ctx.lineTo(-1.8 * z, -1.8 * z);
            ctx.closePath();
            ctx.fillStyle = '#f8fafc';
            ctx.fill();
            ctx.strokeStyle = `rgba(34, 197, 94, ${alpha * 0.95})`;
            ctx.lineWidth = 1.5 * z;
            ctx.stroke();

            ctx.restore();
          }
          ctx.restore();

        } else if (fx.type === 'caltrops') {
          // Rogue Barbed Caltrops - 12 Steel Ground Spikes with Specular Gleam
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.2) * 24 * z;

          ctx.save();
          // Caltrop Trap Perimeter Ring
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(100, 116, 139, ${alpha * 0.7})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();

          // 12 Scattered 3D Tetrahedral Spikes
          for (let c = 0; c < 12; c++) {
            const cAngle = c * 2.399; // Golden ratio spread
            const cDist = Math.sqrt((c + 1) / 12) * rad * 0.88;
            const cx = screen.x + Math.cos(cAngle) * cDist;
            const cy = screen.y + Math.sin(cAngle) * (cDist * 0.5);

            ctx.beginPath();
            ctx.moveTo(cx, cy - 5 * z); // Top spike
            ctx.lineTo(cx + 3 * z, cy + 2 * z);
            ctx.lineTo(cx - 3 * z, cy + 2 * z);
            ctx.closePath();
            ctx.fillStyle = '#475569';
            ctx.fill();
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1 * z;
            ctx.stroke();
          }

          ctx.restore();
        } else if (fx.type === 'dragon_roar') {
          // Warrior Dragon Roar - Blazing Golden Dragon Sigil & Roaring Firewave
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.5) * 30 * z * Math.min(1.0, progress * 1.5);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const dGrad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          dGrad.addColorStop(0, `rgba(254, 240, 138, ${alpha * 0.95})`);
          dGrad.addColorStop(0.4, `rgba(249, 115, 22, ${alpha * 0.8})`);
          dGrad.addColorStop(0.8, `rgba(220, 38, 38, ${alpha * 0.4})`);
          dGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = dGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          // Dragon Fang Spikes Ring
          for (let i = 0; i < 8; i++) {
            const fangAngle = (i * Math.PI * 2 / 8) + this.animations.time * 2;
            const fxPos = screen.x + Math.cos(fangAngle) * rad;
            const fyPos = screen.y + Math.sin(fangAngle) * (rad * 0.5);
            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y);
            ctx.lineTo(fxPos, fyPos);
            ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.8})`;
            ctx.lineWidth = 3 * z;
            ctx.stroke();
          }
          ctx.restore();

        } else if (fx.type === 'meteor_dive') {
          // Warrior Meteor Dive - Blazing Celestial Crater & Magma Impact
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.0) * 32 * z * Math.min(1.0, progress * 1.6);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          // Fiery Crater Glow
          const mGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, rad);
          mGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
          mGrad.addColorStop(0.3, `rgba(245, 158, 11, ${alpha * 0.85})`);
          mGrad.addColorStop(0.7, `rgba(185, 28, 28, ${alpha * 0.6})`);
          mGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = mGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          // Expanding Shockwave Ring
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(254, 240, 138, ${alpha * 0.95})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();
          ctx.restore();

        } else if (fx.type === 'bladestorm_frenzy') {
          // Warrior Bladestorm Frenzy - Multi-tiered Steel Hurricane
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.2) * 30 * z;
          const rot = this.animations.time * 22;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let b = 0; b < 6; b++) {
            const bAngle = rot + (b * Math.PI * 2 / 6);
            ctx.save();
            ctx.translate(screen.x, screen.y);
            ctx.rotate(bAngle);
            ctx.beginPath();
            ctx.ellipse(0, 0, rad, rad * 0.45, 0, 0, Math.PI * 0.7);
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.9})`;
            ctx.lineWidth = 4 * z;
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(0, 0, rad * 0.9, rad * 0.4, 0, 0, Math.PI * 0.5);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            ctx.lineWidth = 2 * z;
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();

        } else if (fx.type === 'titan_bastion') {
          // Warrior Titan Bastion - Radiant Golden Aegis Wall
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const rad = 36 * z;
          const rot = this.animations.time * 3;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.9})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();
          for (let s = 0; s < 8; s++) {
            const sAngle = rot + (s * Math.PI * 2 / 8);
            const sx = screen.x + Math.cos(sAngle) * rad;
            const sy = screen.y + Math.sin(sAngle) * (rad * 0.5);
            ctx.beginPath();
            ctx.arc(sx, sy, 5 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(254, 240, 138, ${alpha * 0.95})`;
            ctx.fill();
          }
          ctx.restore();

        } else if (fx.type === 'sundering_cleave') {
          // Warrior Sundering Cleave - Earth-Shattering Magma Fissure
          const start = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const end = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.strokeStyle = `rgba(249, 115, 22, ${alpha * 0.9})`;
          ctx.lineWidth = 8 * z;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.lineWidth = 3 * z;
          ctx.stroke();
          ctx.restore();

        } else if (fx.type === 'ragnarok_slash') {
          // Warrior Ragnarök Godslayer - 4 Colossal Divine Cross Cleaves
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 5.5) * 32 * z * Math.min(1.0, progress * 1.5);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let a = 0; a < 4; a++) {
            const rot = (a * Math.PI / 4) + (this.animations.time * 4);
            ctx.save();
            ctx.translate(screen.x, screen.y);
            ctx.rotate(rot);
            ctx.beginPath();
            ctx.moveTo(-rad, 0); ctx.lineTo(rad, 0);
            ctx.strokeStyle = `rgba(234, 179, 8, ${alpha * 0.95})`;
            ctx.lineWidth = 7 * z;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-rad * 0.9, 0); ctx.lineTo(rad * 0.9, 0);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
            ctx.lineWidth = 2.5 * z;
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();

        } else if (fx.type === 'thunder_storm') {
          // Mage Tempest Cataclysm - Multi-Lightning Shock Vortex
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.5) * 30 * z;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          // Storm Aura
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(59, 130, 246, ${alpha * 0.25})`;
          ctx.fill();
          // Lightning Bolts
          for (let l = 0; l < 5; l++) {
            const lAngle = l * 1.25 + this.animations.time * 8;
            const lx = screen.x + Math.cos(lAngle) * (rad * 0.7);
            const ly = screen.y + Math.sin(lAngle) * (rad * 0.35);
            ctx.beginPath();
            ctx.moveTo(lx, ly - 50 * z);
            ctx.lineTo(lx - 5 * z, ly - 25 * z);
            ctx.lineTo(lx + 4 * z, ly - 10 * z);
            ctx.lineTo(lx, ly);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            ctx.lineWidth = 3 * z;
            ctx.stroke();
            ctx.strokeStyle = `rgba(147, 197, 253, ${alpha * 0.8})`;
            ctx.lineWidth = 6 * z;
            ctx.stroke();
          }
          ctx.restore();

        } else if (fx.type === 'glacial_comet') {
          // Mage Glacial Comet - Crystalline Impact & Frost Ring
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.2) * 30 * z * Math.min(1.0, progress * 1.5);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const gGrad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          gGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.95})`);
          gGrad.addColorStop(0.4, `rgba(56, 189, 248, ${alpha * 0.85})`);
          gGrad.addColorStop(0.8, `rgba(3, 105, 161, ${alpha * 0.45})`);
          gGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          // Hexagonal Ice Crystals
          for (let h = 0; h < 6; h++) {
            const hAngle = h * Math.PI / 3;
            const hx = screen.x + Math.cos(hAngle) * rad;
            const hy = screen.y + Math.sin(hAngle) * (rad * 0.5);
            ctx.beginPath();
            ctx.arc(hx, hy, 6 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(224, 242, 254, ${alpha * 0.95})`;
            ctx.fill();
          }
          ctx.restore();

        } else if (fx.type === 'arcane_hyperbeam') {
          // Mage Arcane Hyperbeam - Piercing Antimatter Laser
          const start = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const end = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.85})`;
          ctx.lineWidth = 14 * z;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();
          ctx.restore();

        } else if (fx.type === 'time_dilation') {
          // Mage Chrono Time Warp - Shimmering Chronosphere
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 5.0) * 28 * z;
          const rot = this.animations.time * 1.5;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.18})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.85})`;
          ctx.lineWidth = 3 * z;
          ctx.stroke();
          // Rotating Clock Dials
          for (let c = 0; c < 12; c++) {
            const cAngle = rot + (c * Math.PI * 2 / 12);
            const cx = screen.x + Math.cos(cAngle) * rad;
            const cy = screen.y + Math.sin(cAngle) * (rad * 0.5);
            ctx.beginPath();
            ctx.arc(cx, cy, 3 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
            ctx.fill();
          }
          ctx.restore();

        } else if (fx.type === 'supernova_blast') {
          // Mage Solar Supernova - Blinding Stellar Flare
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 5.2) * 32 * z * Math.min(1.0, progress * 1.6);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const sGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, rad);
          sGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
          sGrad.addColorStop(0.3, `rgba(253, 224, 71, ${alpha * 0.9})`);
          sGrad.addColorStop(0.7, `rgba(239, 68, 68, ${alpha * 0.6})`);
          sGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = sGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

        } else if (fx.type === 'genesis_cataclysm') {
          // Mage Cataclysm of Genesis - Orbital Celestial Annihilation
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 6.0) * 32 * z * Math.min(1.0, progress * 1.4);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let p = 0; p < 8; p++) {
            const pAngle = (p * Math.PI * 2 / 8) + this.animations.time * 3;
            const px = screen.x + Math.cos(pAngle) * rad;
            const py = screen.y + Math.sin(pAngle) * (rad * 0.5);
            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y); ctx.lineTo(px, py);
            ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.85})`;
            ctx.lineWidth = 4 * z;
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, rad * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.fill();
          ctx.restore();

        } else if (fx.type === 'venomous_barrage') {
          // Rogue Venom Barrage - 15 Piercing Pixel Needles
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const dirX = fx.dirX || 1, dirY = fx.dirY || 0;
          const baseAngle = Math.atan2(dirY, dirX);
          const npx = Math.max(2, Math.round(2 * z));
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let n = -7; n <= 7; n++) {
            const nAngle = baseAngle + (n * 0.08);
            const nDist = 45 * z * Math.min(1.0, progress * 2.0);
            const nx = Math.round((screen.x + Math.cos(nAngle) * nDist) / npx) * npx;
            const ny = Math.round((screen.y + Math.sin(nAngle) * (nDist * 0.5)) / npx) * npx;
            ctx.fillStyle = `rgba(34, 197, 94, ${alpha * 0.95})`;
            ctx.fillRect(nx - npx, ny, npx * 3, npx);
            ctx.fillRect(nx, ny - npx, npx, npx * 3);
            ctx.fillStyle = `rgba(187, 247, 208, ${alpha})`;
            ctx.fillRect(nx, ny, npx, npx);
          }
          ctx.restore();

        } else if (fx.type === 'phantom_assassins') {
          // Rogue Phantom Assassins - Dual Mirage Clones
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.2) * 26 * z;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let c = -1; c <= 1; c += 2) {
            const cx = screen.x + c * (rad * 0.7);
            const cy = screen.y - 10 * z;
            ctx.beginPath();
            ctx.ellipse(cx, cy, 14 * z, 26 * z, 0, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(168, 85, 247, ${alpha * 0.55})`;
            ctx.fill();
          }
          ctx.restore();

        } else if (fx.type === 'assassins_cull') {
          // Rogue Guillotine Execution Cleave
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.5, this.camera, this.canvas.width, this.canvas.height);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.moveTo(screen.x - 30 * z, screen.y - 45 * z);
          ctx.lineTo(screen.x + 30 * z, screen.y + 20 * z);
          ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.98})`;
          ctx.lineWidth = 7 * z;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(screen.x - 25 * z, screen.y - 40 * z);
          ctx.lineTo(screen.x + 25 * z, screen.y + 15 * z);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();
          ctx.restore();

        } else if (fx.type === 'abyssal_tether') {
          // Rogue Abyssal Shadow Chains
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 5.2) * 26 * z;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let ch = 0; ch < 6; ch++) {
            const chAngle = (ch * Math.PI * 2 / 6) + this.animations.time * 2;
            const chx = screen.x + Math.cos(chAngle) * rad;
            const chy = screen.y + Math.sin(chAngle) * (rad * 0.5);
            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y); ctx.lineTo(chx, chy);
            ctx.strokeStyle = `rgba(147, 51, 234, ${alpha * 0.85})`;
            ctx.lineWidth = 3.5 * z;
            ctx.stroke();
          }
          ctx.restore();

        } else if (fx.type === 'blade_dance') {
          // Rogue Dancing Razor Mirage
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.8) * 28 * z;
          const rot = this.animations.time * 18;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let b = 0; b < 5; b++) {
            const bAngle = rot + (b * Math.PI * 2 / 5);
            ctx.save();
            ctx.translate(screen.x, screen.y);
            ctx.rotate(bAngle);
            ctx.beginPath();
            ctx.ellipse(0, 0, rad, rad * 0.4, 0, 0, Math.PI * 0.8);
            ctx.strokeStyle = `rgba(244, 114, 182, ${alpha * 0.9})`;
            ctx.lineWidth = 4 * z;
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();

        } else if (fx.type === 'eclipse_execution') {
          // Rogue Void Eclipse Omnislash
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 6.0) * 32 * z * Math.min(1.0, progress * 1.5);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          // Void Eclipse Core
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, 22 * z, 0, Math.PI * 2);
          ctx.fillStyle = '#09090b';
          ctx.fill();
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.95})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();
          // Omnislash Violet Vectors
          for (let v = 0; v < 8; v++) {
            const vAngle = v * 1.1 + this.animations.time * 12;
            const x1 = screen.x + Math.cos(vAngle) * rad;
            const y1 = screen.y + Math.sin(vAngle) * (rad * 0.5);
            const x2 = screen.x - Math.cos(vAngle) * rad;
            const y2 = screen.y - Math.sin(vAngle) * (rad * 0.5);
            ctx.beginPath();
            ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
            ctx.strokeStyle = `rgba(216, 180, 254, ${alpha * 0.95})`;
            ctx.lineWidth = 3.5 * z;
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }

    // 2. Dynamic High-Performance AAA Particle Engine
    const prevComposite = ctx.globalCompositeOperation;
    for (let i = this.animations.particles.length - 1; i >= 0; i--) {
      const p = this.animations.particles[i];

      // Physics: Drag, Gravity, Buoyancy, Turbulence & Spin
      // (drag factors are tuned per 60fps frame; scale them by dt so the
      // motion is the same at any frame rate)
      const frameScale = dt * 60;
      const dragF = Math.pow(p.drag || 0.94, frameScale);
      p.vx *= dragF;
      p.vy *= dragF;
      if (p.gravity) p.vz -= p.gravity * dt;
      if (p.buoyancy) p.vz += p.buoyancy * dt;
      if (p.zDrag && p.zDrag < 1) p.vz *= Math.pow(p.zDrag, frameScale);
      if (p.turbulence) {
        p.vx += Math.cos(this.animations.time * 16 + p.id) * p.turbulence * dt;
        p.vy += Math.sin(this.animations.time * 16 + p.id) * p.turbulence * dt;
      }
      p.rot = (p.rot || 0) + (p.vrot || 0) * dt;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // Ground bounce for physical particles (earth, sparks); everything
      // else simply rests on the floor
      if (p.z <= 0) {
        p.z = 0;
        if (p.bounce && p.vz < -0.6) {
          p.vz = -p.vz * 0.35;
          p.vx *= 0.6;
          p.vy *= 0.6;
        } else {
          p.vz = 0;
        }
      } else if (p.maxZ && p.z > p.maxZ) {
        p.z = p.maxZ;
        if (p.vz > 0) p.vz = 0;
      }

      p.life -= dt;
      if (p.life <= 0) {
        this.animations.particles.splice(i, 1);
        continue;
      }

      const screen = Isometric.worldToScreen(p.x, p.y, Math.max(0, p.z), this.camera, this.canvas.width, this.canvas.height);
      const alpha = Math.max(0, p.life / p.maxLife);
      const prog = 1.0 - alpha;

      if (p.blend === 'source-over' || p.type === 'earth' || p.type === 'ice' || p.type === 'gold' || p.type === 'loot') {
        if (p.z > 0.08 && p.type !== 'dust') {
          const ground = Isometric.worldToScreen(p.x, p.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const spx = Math.max(2, Math.round(z));
          const sw = Math.max(1, Math.round((p.size * z * Math.max(0.35, 1 - p.z * 0.4)) / spx));
          const gx = Math.round(ground.x);
          const gy = Math.round(ground.y);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = `rgba(0, 0, 0, ${0.28 * alpha})`;
          ctx.fillRect(gx - sw * spx, gy, sw * 2 * spx, spx);
          if (sw > 1) {
            ctx.fillRect(gx - (sw - 1) * spx, gy - spx, (sw - 1) * 2 * spx, spx);
          }
        }
      }

      this.drawParticleItem(ctx, p, screen, z, alpha, prog);
    }
    ctx.globalCompositeOperation = prevComposite;

    // 3. Floating Combat Damage Numbers (Ultra-High FPS Hardware-Accelerated Vector Text)
    if (this.animations.floatingTexts.length > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;

      const cw = this.canvas.width;
      const ch = this.canvas.height;
      const textZoom = FLOATING_TEXT_SCALE * Math.max(FLOATING_TEXT_ZOOM_MIN, Math.min(FLOATING_TEXT_ZOOM_MAX, z));

      for (let i = this.animations.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.animations.floatingTexts[i];
        ft.life -= dt;
        if (ft.life <= 0 || isNaN(ft.x) || isNaN(ft.y)) {
          this.animations.floatingTexts.splice(i, 1);
          continue;
        }
        ft.vy = (ft.vy || 0) + (ft.gravity || 58) * dt;
        ft.vx = (ft.vx || 0) * (ft.drag || 0.94);
        ft.screenOffsetX = (ft.screenOffsetX || 0) + ft.vx * dt;
        ft.screenOffsetY = (ft.screenOffsetY || 0) + ft.vy * dt;
        if (ft.scale && ft.scale > 1.0) {
          ft.scale = Math.max(1.0, ft.scale - dt * 3.5);
        }
      }

      // Draw from oldest (0) to newest (length - 1) so newest damage numbers always sit crisply on top
      for (let i = 0; i < this.animations.floatingTexts.length; i++) {
        const ft = this.animations.floatingTexts[i];
        const screen = Isometric.worldToScreen(ft.x, ft.y, 0.8, this.camera, cw, ch);
        const drawX = Math.round(screen.x + ft.screenOffsetX);
        const drawY = Math.round(screen.y + ft.screenOffsetY);

        if (drawX < -80 || drawX > cw + 80 || drawY < -80 || drawY > ch + 80) {
          continue;
        }

        const alpha = Math.min(1.0, ft.life / (ft.maxLife * 0.25));
        const fontSize = Math.round(ft.size * textZoom);
        ctx.globalAlpha = alpha;

        // If Ragnarok Online Critical: Draw the iconic jagged explosive starburst plate!
        if (ft.isCrit) {
          ctx.save();
          const burstOuter = fontSize * 1.55;
          const burstInner = fontSize * 0.85;
          const points = 12;

          // Outer Starburst (Red / Dark Orange rim)
          ctx.beginPath();
          for (let p = 0; p < points; p++) {
            const a1 = (p * 2 * Math.PI) / points - Math.PI / 2;
            const a2 = a1 + Math.PI / points;
            const r1 = burstOuter * (0.85 + 0.25 * Math.sin(p * 3.7));
            const r2 = burstInner * 0.9;
            const x1 = drawX + Math.cos(a1) * r1;
            const y1 = drawY + Math.sin(a1) * r1;
            const x2 = drawX + Math.cos(a2) * r2;
            const y2 = drawY + Math.sin(a2) * r2;
            if (p === 0) ctx.moveTo(x1, y1);
            else ctx.lineTo(x1, y1);
            ctx.lineTo(x2, y2);
          }
          ctx.closePath();
          ctx.fillStyle = '#ffb703';
          ctx.fill();
          ctx.lineWidth = Math.max(1.5, fontSize * 0.12);
          ctx.strokeStyle = '#dc2626';
          ctx.stroke();

          // Inner Starburst (Bright Yellow Core)
          ctx.beginPath();
          for (let p = 0; p < points; p++) {
            const a1 = (p * 2 * Math.PI) / points - Math.PI / 2;
            const a2 = a1 + Math.PI / points;
            const r1 = burstOuter * 0.72;
            const r2 = burstInner * 0.65;
            const x1 = drawX + Math.cos(a1) * r1;
            const y1 = drawY + Math.sin(a1) * r1;
            const x2 = drawX + Math.cos(a2) * r2;
            const y2 = drawY + Math.sin(a2) * r2;
            if (p === 0) ctx.moveTo(x1, y1);
            else ctx.lineTo(x1, y1);
            ctx.lineTo(x2, y2);
          }
          ctx.closePath();
          ctx.fillStyle = '#fff566';
          ctx.fill();
          ctx.restore();
        }

        // Silkscreen: chunky pixel digits that stay readable mid-fight
        ctx.font = `bold ${Math.round(fontSize * 1.05)}px "Silkscreen", "DotGothic16", monospace`;

        // Solid dark border (doubles as the drop shadow: two passes per text)
        ctx.strokeStyle = '#0a0604';
        ctx.lineWidth = Math.max(2.5, fontSize * 0.28);
        ctx.strokeText(ft.text, drawX, drawY);

        // Main Text Fill
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, drawX, drawY);
      }

      ctx.restore();
    }

    // 3.5 Ambient weather for the other field zones
    this.drawAmbientWeather(ctx, this.currentTheme, this.canvas.width, this.canvas.height, this.animations.time);

    // 4. Ambient Snowfall Particle Weather in Frostfell Peaks (Crisp Pixel Snowflakes)
    if (this.currentTheme === 'frostfell') {
      const snowW = this.canvas.width;
      const snowH = this.canvas.height;
      const time = this.animations.time;
      const spx = 2;
      ctx.save();
      for (let s = 0; s < 70; s++) {
        const sx = Math.round((((s * 97 + time * 75) % (snowW + 100)) - 50) / spx) * spx;
        const sy = Math.round((((s * 131 + time * 120) % (snowH + 100)) - 50) / spx) * spx;
        const tier = s % 3;
        if (tier === 2) {
          // Stepped 5-pixel cross snowflake
          ctx.fillStyle = 'rgba(186, 230, 253, 0.75)';
          ctx.fillRect(sx - spx, sy, spx * 3, spx);
          ctx.fillRect(sx, sy - spx, spx, spx * 3);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.fillRect(sx, sy, spx, spx);
        } else if (tier === 1) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
          ctx.fillRect(sx, sy, spx * 2, spx * 2);
        } else {
          ctx.fillStyle = 'rgba(224, 242, 254, 0.72)';
          ctx.fillRect(sx, sy, spx, spx);
        }
      }
      ctx.restore();
    }
  }

  // Render individual stylized pixel-art particle snapped to an integer pixel grid
  drawParticleItem(ctx, p, screen, z, alpha, prog) {
    ctx.save();
    ctx.globalCompositeOperation = p.blend || 'lighter';
    ctx.globalAlpha = Math.min(1.0, alpha);

    // Base pixel unit scaled with camera zoom (minimum 2px for crisp retro blocks)
    const px = Math.max(2, Math.round(z));
    const ox = Math.round(screen.x);
    const oy = Math.round(screen.y);
    // Helper to draw a grid-snapped pixel rectangle at (gx, gy) of size (gw, gh) in pixel units
    const b = (gx, gy, gw, gh, col) => {
      if (col) ctx.fillStyle = col;
      ctx.fillRect(ox + gx * px, oy + gy * px, gw * px, gh * px);
    };

    if (p.type === 'slash' || p.type === 'spark') {
      // Stepped pixel velocity streak + incandescent pixel star tip
      const svx = (p.vx - p.vy);
      const svy = (p.vx + p.vy) * 0.5;
      const mag = Math.hypot(svx, svy) || 1;
      const dx = Math.round(svx / mag);
      const dy = Math.round(svy / mag);
      const steps = Math.max(2, Math.min(6, Math.round(Math.hypot(p.vx, p.vy) * 1.15 * (0.4 + 0.6 * alpha))));

      // Trailing colored pixel blocks stepping backward along velocity
      for (let s = steps; s >= 1; s--) {
        const tx = -dx * s;
        const ty = -dy * s;
        b(tx, ty, 1, 1, p.color);
        if (s <= 2 && p.size > 4.2) {
          b(tx, ty + 1, 1, 1, p.color);
        }
      }
      // Cross-glint around head for larger sparks
      if (p.size * alpha > 2.6) {
        b(-1, 0, 3, 1, p.color);
        b(0, -1, 1, 3, p.color);
      }
      // White-hot pixel core at the head
      b(0, 0, 1, 1, p.coreColor || '#ffffff');

    } else if (p.type === 'fire') {
      // Animated stepped pixel flame cluster
      const flick = (Math.floor(p.life * 18 + p.id) % 3) - 1; // -1, 0, 1 pixel sway
      const stage = prog < 0.35 ? 3 : (prog < 0.7 ? 2 : 1);

      if (stage === 3) {
        // Outer flame tongue (stepped pixel silhouette)
        b(-1, 1, 3, 1, p.color);
        b(-2, 0, 5, 1, p.color);
        b(-1, -1, 3, 1, p.color);
        b(flick, -2, 2, 1, p.color);
        b(flick, -3, 1, 1, '#dc2626');
        // Mid warm core
        b(-1, 0, 3, 1, p.coreColor || '#fef08a');
        b(0, -1, 2, 1, p.coreColor || '#fef08a');
        // White-hot heart
        b(0, 0, 1, 1, '#ffffff');
      } else if (stage === 2) {
        b(-1, 0, 3, 1, p.color);
        b(0, 1, 1, 1, p.color);
        b(flick, -1, 2, 1, p.color);
        b(0, -2, 1, 1, '#dc2626');
        b(0, 0, 1, 1, p.coreColor || '#fef08a');
      } else {
        // Dying pixel ember
        b(0, 0, 1, 1, p.color);
        b(flick, -1, 1, 1, p.coreColor || '#fef08a');
      }

    } else if (p.type === 'arcane') {
      // Twinkling pixel mana star (alternating 4-point cross and diamond rune)
      const frame = Math.floor(p.life * 14 + p.id) & 1;
      const halo = p.glowColor || 'rgba(192, 132, 252, 0.45)';
      if (frame === 0) {
        b(-2, 0, 5, 1, halo);
        b(0, -2, 1, 5, halo);
        b(-1, -1, 3, 3, halo);
        b(-2, 0, 5, 1, p.color);
        b(0, -2, 1, 5, p.color);
        b(0, 0, 1, 1, '#ffffff');
      } else {
        b(-1, -1, 3, 3, halo);
        b(-1, 0, 3, 1, p.color);
        b(0, -1, 1, 3, p.color);
        b(-2, -2, 1, 1, p.color);
        b(2, -2, 1, 1, p.color);
        b(-2, 2, 1, 1, p.color);
        b(2, 2, 1, 1, p.color);
        b(0, 0, 1, 1, '#ffffff');
      }

    } else if (p.type === 'ice') {
      // Crisp pixel-art frost shard / diamond crystal
      const orient = Math.floor((p.rot || 0) * 2) & 1;
      if (orient === 0) {
        // Vertical stepped ice crystal
        b(0, -2, 1, 5, '#0284c7');
        b(-1, -1, 3, 3, p.color);
        b(0, -2, 1, 1, '#ffffff');
        b(0, 2, 1, 1, p.color);
        b(0, -1, 1, 2, '#ffffff');
      } else {
        // Diagonal stepped snowflake shard
        b(-2, 0, 5, 1, p.color);
        b(0, -2, 1, 5, p.color);
        b(-1, -1, 3, 3, '#bae6fd');
        b(0, 0, 1, 1, '#ffffff');
        b(-1, -1, 1, 1, '#ffffff');
      }

    } else if (p.type === 'lightning') {
      // Stepped pixel zig-zag electric bolt
      const j1 = ((Math.floor(p.life * 45 + p.id * 7) % 3) - 1);
      const j2 = ((Math.floor(p.life * 35 + p.id * 13) % 3) - 1);
      // Outer electric glow blocks
      b(-3, j1, 2, 2, p.color);
      b(-1, 0, 2, 2, p.color);
      b(1, j2, 2, 2, p.color);
      b(3, -j1, 2, 1, p.color);
      // Crisp 1-pixel white-hot voltage spine
      b(-3, j1, 2, 1, '#ffffff');
      b(-1, 0, 2, 1, '#ffffff');
      b(1, j2, 2, 1, '#ffffff');
      b(3, -j1, 1, 1, '#ffffff');

    } else if (p.type === 'poison') {
      // Pixel-art toxic bubble / acid droplet with corner cutouts and top-left shine pixel
      const big = p.size * (0.6 + prog * 0.4) > 3.6;
      if (big) {
        b(-1, -2, 2, 1, p.color);
        b(-2, -1, 4, 2, p.color);
        b(-1, 1, 2, 1, '#15803d');
        b(-1, -1, 1, 1, '#ffffff');
        b(0, -1, 1, 1, p.coreColor || '#86efac');
      } else {
        b(0, -1, 1, 3, p.color);
        b(-1, 0, 3, 1, p.color);
        b(0, 1, 1, 1, '#15803d');
        b(0, 0, 1, 1, '#ffffff');
      }

    } else if (p.type === 'shadow') {
      // Pixel-art void wisp: dark purple pixel cluster with abyssal core and detached motes
      const drift = (Math.floor(p.life * 12 + p.id) & 1) ? 1 : -1;
      b(-1, -2, 3, 1, p.color);
      b(-2, -1, 5, 3, p.color);
      b(-1, 2, 3, 1, p.color);
      // Detached shadow pixel motes
      b(drift * 2, -2, 1, 1, p.coreColor || '#c084fc');
      b(-drift * 2, 2, 1, 1, p.color);
      // Deep void pixel core
      b(-1, -1, 3, 2, '#0f172a');
      b(0, 0, 1, 1, '#1e1b4b');

    } else if (p.type === 'earth') {
      // Chunky tumbling pixel rock fragment with dark bottom bevel and top highlight
      const tumble = Math.floor((p.rot || 0) * 2) & 1;
      if (tumble === 0) {
        b(-1, -2, 3, 1, '#291e14');
        b(-2, -1, 4, 2, '#291e14');
        b(-1, 1, 3, 1, '#291e14');
        b(-1, -1, 2, 2, p.color);
        b(1, -1, 1, 1, p.color);
        b(-1, -1, 1, 1, '#d6d3d1');
        b(-1, 0, 2, 1, p.coreColor || '#451a03');
      } else {
        b(-1, -1, 3, 3, '#291e14');
        b(0, -1, 2, 2, p.color);
        b(-1, 0, 1, 1, p.color);
        b(0, -1, 1, 1, '#d6d3d1');
        b(0, 1, 2, 1, p.coreColor || '#451a03');
      }

    } else if (p.type === 'gold' || p.type === 'loot') {
      // 4-frame spinning pixel gold coin + sparkle cross
      const frame = Math.floor(p.life * 14 + p.id) & 3;
      if (frame === 0) {
        b(-1, -2, 3, 4, '#b45309');
        b(0, -1, 2, 2, p.color);
        b(-1, -1, 1, 1, '#ffffff');
      } else if (frame === 1 || frame === 3) {
        b(0, -2, 2, 4, '#b45309');
        b(0, -1, 1, 2, p.color);
        b(0, -1, 1, 1, '#ffffff');
      } else {
        // Edge-on glint cross
        b(0, -2, 1, 5, '#fef08a');
        b(-2, 0, 5, 1, '#fef08a');
        b(0, -1, 1, 3, '#ffffff');
        b(-1, 0, 3, 1, '#ffffff');
      }

    } else if (p.type === 'dust') {
      // Dithered pixel dust puff that separates as it dissipates
      const sep = prog > 0.55 ? 1 : 0;
      b(-1 - sep, 0, 2, 1, p.color);
      b(sep, -1, 2, 1, p.color);
      b(0, sep, 1, 1, p.coreColor || p.color);
      if (prog < 0.6) {
        b(-1, -1, 2, 2, p.color);
      }

    } else if (p.type === 'wind') {
      // Stepped pixel wind ribbon aligned to velocity
      const svx = (p.vx - p.vy);
      const svy = (p.vx + p.vy) * 0.5;
      const mag = Math.hypot(svx, svy) || 1;
      const dx = Math.round(svx / mag);
      const dy = Math.round(svy / mag);
      for (let s = -2; s <= 2; s++) {
        const wave = (s & 1) ? 1 : 0;
        b(dx * s - dy * wave, dy * s + dx * wave, 1, 1, s === 2 ? '#ffffff' : p.color);
      }

    } else if (p.type === 'level') {
      // Grand pixel-art celestial level-up star
      const halo = p.glowColor || 'rgba(250, 204, 21, 0.45)';
      // Stepped outer pixel glow
      b(-3, 0, 7, 1, halo);
      b(0, -3, 1, 7, halo);
      b(-2, -1, 5, 3, halo);
      b(-1, -2, 3, 5, halo);
      // 8-point pixel star arms
      b(-3, 0, 7, 1, p.color);
      b(0, -3, 1, 7, p.color);
      b(-2, -2, 1, 1, p.color);
      b(2, -2, 1, 1, p.color);
      b(-2, 2, 1, 1, p.color);
      b(2, 2, 1, 1, p.color);
      // Incandescent white pixel diamond core
      b(-1, 0, 3, 1, '#ffffff');
      b(0, -1, 1, 3, '#ffffff');

    } else {
      // Default crisp pixel cluster
      b(-1, 0, 3, 1, p.color);
      b(0, -1, 1, 3, p.color);
      b(0, 0, 1, 1, p.coreColor || '#ffffff');
    }

    ctx.restore();
  }

  // Radar Minimap
  renderMinimap(gameState, localPlayerId) {
    if (!this.minimapCtx || !gameState || !gameState.map) return;
    const mctx = this.minimapCtx;
    const map = gameState.map;
    const mw = this.minimapCanvas.width;
    const mh = this.minimapCanvas.height;

    mctx.clearRect(0, 0, mw, mh);
    mctx.fillStyle = '#0a0e17';
    mctx.fillRect(0, 0, mw, mh);

    // Small maps fit whole; bigger ones (large dungeons) show a window of
    // MINIMAP_VIEW_TILES around the hero at a fixed scale
    const windowed = map.width > MINIMAP_VIEW_TILES || map.height > MINIMAP_VIEW_TILES;
    const scaleX = windowed ? mw / MINIMAP_VIEW_TILES : mw / map.width;
    const scaleY = windowed ? mh / MINIMAP_VIEW_TILES : mh / map.height;
    const cw = Math.ceil(map.width * scaleX), ch = Math.ceil(map.height * scaleY);

    // Terrain only changes with the map, so it is painted once into a cache
    const version = map._tilesVersion || 0;
    let mc = this.minimapCache;
    if (!mc || mc.map !== map || mc.version !== version || mc.w !== cw || mc.h !== ch) {
      if (!mc) mc = this.minimapCache = { canvas: document.createElement('canvas') };
      mc.canvas.width = cw;
      mc.canvas.height = ch;
      Object.assign(mc, { map, version, w: cw, h: ch });
      this.paintMinimapTerrain(mc.canvas.getContext('2d'), map, scaleX, scaleY);
    }
    let ox = 0, oy = 0;
    if (windowed) {
      const me = gameState.players && gameState.players.find(p => p.id === localPlayerId);
      const fx = me ? me.x : map.width / 2, fy = me ? me.y : map.height / 2;
      ox = Math.max(0, Math.min(cw - mw, fx * scaleX - mw / 2));
      oy = Math.max(0, Math.min(ch - mh, fy * scaleY - mh / 2));
    }
    mctx.drawImage(mc.canvas, -ox, -oy);
    mctx.save();
    mctx.translate(-ox, -oy);
    this.drawMinimapDynamic(mctx, gameState, localPlayerId, scaleX, scaleY);
    mctx.restore();
  }

  paintMinimapTerrain(mctx, map, scaleX, scaleY) {
    // Draw Map outlines (Town, Frostfell & Dungeon)
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const t = map.tiles[y][x];
        if (t === 3) {
          mctx.fillStyle = '#0284c7';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        } else if (t === 4) {
          // Dungeon Room Floor
          mctx.fillStyle = '#334155';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        } else if (t === 1) {
          // Path / Corridor
          mctx.fillStyle = '#475569';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        } else if (t === 7) {
          // Wall
          mctx.fillStyle = '#1e293b';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        } else if (t === 6) {
          // Portal
          mctx.fillStyle = '#c084fc';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        } else if (t === 9) {
          // Snow
          mctx.fillStyle = '#cbd5e1';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        } else if (t === 10) {
          // Frozen Ice Lake
          mctx.fillStyle = '#38bdf8';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        } else if (t === 11) {
          // Frost Stone
          mctx.fillStyle = '#64748b';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        } else if (t === 12) {
          // Frost Cliff
          mctx.fillStyle = '#1e293b';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        } else if (FIELD_TILE_PALETTE[t]) {
          mctx.fillStyle = FIELD_TILE_PALETTE[t].mini;
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        }
      }
    }
  }

  drawMinimapDynamic(mctx, gameState, localPlayerId, scaleX, scaleY) {
    // Dungeon: a green tick on every cleared room (the entrance never had monsters)
    const rooms = gameState.map.isDungeon && gameState.map.rooms;
    if (rooms && this.dungeonClearedRooms && this.dungeonClearedRooms.size) {
      mctx.save();
      mctx.lineCap = 'round';
      mctx.lineJoin = 'round';
      for (const i of this.dungeonClearedRooms) {
        const r = rooms[i];
        if (!r || i === 0) continue;
        const cx = (r.x + r.w / 2) * scaleX, cy = (r.y + r.h / 2) * scaleY;
        const s = Math.max(3, Math.min(r.w * scaleX, r.h * scaleY) * 0.28);
        const tick = () => {
          mctx.beginPath();
          mctx.moveTo(cx - s, cy);
          mctx.lineTo(cx - s * 0.3, cy + s * 0.7);
          mctx.lineTo(cx + s, cy - s * 0.8);
          mctx.stroke();
        };
        mctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
        mctx.lineWidth = 4;
        tick();
        mctx.strokeStyle = '#4ade80';
        mctx.lineWidth = 2;
        tick();
      }
      mctx.restore();
    }

    // Draw Loot as Yellow Dots
    if (gameState.groundItems) {
      mctx.fillStyle = '#facc15';
      for (const it of gameState.groundItems) {
        mctx.fillRect(it.x * scaleX - 1, it.y * scaleY - 1, 3, 3);
      }
    }

    // Draw Mobs as Red Dots
    if (gameState.mobs) {
      for (const mob of gameState.mobs) {
        if (mob.state === 'dead') continue;
        mctx.fillStyle = mob.isBoss ? '#f97316' : mob.isMiniboss ? '#ec4899' : '#ef4444';
        const size = mob.isBoss ? 5 : mob.isMiniboss ? 4 : 3;
        mctx.fillRect(mob.x * scaleX - size / 2, mob.y * scaleY - size / 2, size, size);
      }
    }

    // Draw Players
    if (gameState.players) {
      for (const p of gameState.players) {
        if (p.isDead) continue;
        const isLocal = p.id === localPlayerId;
        mctx.fillStyle = isLocal ? '#38bdf8' : '#22c55e';
        const px = p.x * scaleX;
        const py = p.y * scaleY;
        mctx.beginPath();
        mctx.arc(px, py, isLocal ? 4 : 3, 0, Math.PI * 2);
        mctx.fill();
      }
    }
  }
}

window.IsometricRenderer = IsometricRenderer;
