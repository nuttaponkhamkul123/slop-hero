// Slop Hero - Specialist (SP) cards, NosTale style.
// Wearing a card and transforming swaps the hero's look and skill set. Each
// class has five cards, one per tier; tiers need a higher job level, are
// rarer to obtain and cost more to enhance (+0 .. +100).
import { expToNext } from './progression';

// ---------------------------------------------------------------- job level
// Job EXP comes from the same kills as base EXP but each job level needs 30%
// more, so the job level climbs a little slower than the base level.
const JOB_MAX_LEVEL = 60;
const JOB_EXP_FACTOR = 1.3;
const jobExpToNext = (jobLevel) => Math.round(expToNext(jobLevel) * JOB_EXP_FACTOR);
// Small permanent bonuses per job level above 1
const JOB_LEVEL_BONUS = { bonusDmg: 1, bonusHp: 5, bonusMp: 3 };

// ---------------------------------------------------------------- tiers
const SP_TIERS = {
  1: { jobReq: 10, rarity: 'rare', enhanceBase: 5000, exchange: { fragments: 10, gold: 5000 } },
  2: { jobReq: 20, rarity: 'epic', enhanceBase: 15000, exchange: { fragments: 25, gold: 20000 } },
  3: { jobReq: 30, rarity: 'epic', enhanceBase: 40000, exchange: { fragments: 60, gold: 70000 } },
  4: { jobReq: 40, rarity: 'legendary', enhanceBase: 100000, exchange: { fragments: 140, gold: 220000 } },
  5: { jobReq: 50, rarity: 'mythic', enhanceBase: 250000, exchange: { fragments: 300, gold: 600000 } }
};

// Boss drop chance per tier: [minFloor, {difficulty: chance}]. Tier I is a
// common reward from floor 1 on; harder tiers need deeper floors / difficulty.
const SP_DROP_TABLE = {
  1: [1, { normal: 0.15, hard: 0.2, nightmare: 0.25 }],
  2: [3, { normal: 0.07, hard: 0.1, nightmare: 0.14 }],
  3: [5, { normal: 0.03, hard: 0.06, nightmare: 0.09 }],
  4: [7, { normal: 0.012, hard: 0.025, nightmare: 0.045 }],
  5: [9, { hard: 0.008, nightmare: 0.02 }]
};

// Spirit fragments: the exchange / enhancement material. Every boss kill
// pays out (bossFragments), elites and normal dungeon monsters sometimes do.
const FRAGMENT_DROP = { boss: 1, commander: 0.15, mob: 0.02 };
const bossFragments = floor => 2 + Math.floor(floor / 2) + Math.floor(Math.random() * 3);

// ---------------------------------------------------------------- enhancement
// Cards go to +100 in small steps: SP_LEVEL_STEP levels now give what one
// level used to (+100 is as strong as the old +10), and cost about as much
const SP_LEVEL_STEP = 10;
const SP_MAX_LEVEL = 100;
const SP_ENHANCE_GROWTH = 1.6;      // cost growth per SP_LEVEL_STEP levels
// success chance per current level: 100% at +0 easing down to 15% at +99
const SP_ENHANCE_CHANCE = Array.from({ length: SP_MAX_LEVEL }, (_, l) => +(1 - 0.85 * Math.pow(l / (SP_MAX_LEVEL - 1), 0.8)).toFixed(3));
const SP_SAFE_LEVEL = 50;           // failing from +50 upward drops one level
const SP_STAT_PER_LEVEL = 0.008;    // +0.8% card stats per level
const SP_SKILL_PER_LEVEL = 0.004;   // +0.4% card skill damage per level

// ---------------------------------------------------------------- cards
// skills: slot -> SP skill id (see SP_SKILLS); every card has its own kit
// kit: bumped when a card's skills are reworked, so saved loadouts reset to the new defaults
// palette: PixelHeroes material overrides [outline, dark, mid, light, highlight?]
// (the costume itself - head, weapon, cape... - is in pixelHeroes.js COSTUMES,
// keyed by card id)
const SP_CARDS: Record<string, any[]> = {
  warrior: [
    { id: 'sp_crusader', tier: 1, name: 'Crusader', element: 'holy', color: '#fde68a',
      stats: { bonusDef: 18, bonusHp: 160 },
      palette: { cape: ['#2e2205', '#b8860b', '#e6c23a', '#fff1a8'], tabard: ['#3a2a05', '#c9a227', '#f1d36b', '#fff6c8'], steel: ['#2a2410', '#8f8670', '#d8d2bf', '#f6f2e6', '#ffffff'] },
      skills: { slot1: 'sp_holy_cleave', slot2: 'sp_judgement', slot3: 'sp_sanctuary', dash: 'sp_divine_charge' },
      desc: 'A holy guardian sworn to shield the weak. Bashes foes away, calls down light, shields and heals.' },
    { id: 'sp_berserker', tier: 2, name: 'Berserker', element: 'fire', color: '#ef4444',
      stats: { bonusDmg: 34, bonusAttackSpeed: 0.18 },
      palette: { cape: ['#2a0602', '#7a1a08', '#c2410c', '#fb923c'], steel: ['#1c0f0b', '#4a2a22', '#7b4436', '#b06a52'], darkSteel: ['#120806', '#33190f', '#542a1b', '#7a3f28'], tabard: ['#2a0602', '#7f1d1d', '#b91c1c', '#ef4444'] },
      skills: { slot1: 'sp_crimson_aura', slot2: 'sp_bloodlust', slot3: 'sp_blade_whirl', dash: 'sp_crimson_rush' },
      passive: { name: 'Bloodthirst', leech: 0.1, cap: 0.05 },
      desc: 'Fury made flesh, wielding twin blood-blades. Burns his own blood in a crimson aura and whirls both swords for as long as his mana lasts. Bloodthirst: basic attacks and Blade Whirl heal 10% of the damage they deal.' },
    { id: 'sp_frost_templar', tier: 3, name: 'Frost Templar', element: 'ice', color: '#67e8f9',
      stats: { bonusDef: 26, bonusHp: 260, bonusDmg: 22 },
      palette: { cape: ['#06222e', '#0e7490', '#22d3ee', '#a5f3fc'], steel: ['#0c1d2b', '#4f86a6', '#9fd3ee', '#e0f6ff', '#ffffff'], tabard: ['#0b1f33', '#1e3a8a', '#3b82f6', '#93c5fd'] },
      skills: { slot1: 'sp_glacier_strike', slot2: 'sp_winter_ward', slot3: 'sp_avalanche', dash: 'sp_ice_glide' },
      desc: 'A knight of the frozen north whose blade freezes everything it touches.' },
    { id: 'sp_storm_herald', tier: 4, name: 'Storm Herald', element: 'lightning', color: '#facc15',
      stats: { bonusDmg: 52, bonusAttackSpeed: 0.22, bonusSpeed: 0.4 },
      palette: { cape: ['#2a2205', '#a16207', '#eab308', '#fef08a'], steel: ['#14161f', '#3f4660', '#6b7596', '#b8c2e0', '#fffbe0'], tabard: ['#1e1b4b', '#3730a3', '#6366f1', '#a5b4fc'] },
      skills: { slot1: 'sp_thunderhead', slot2: 'sp_arc_conduit', slot3: 'sp_storm_orbs', dash: 'sp_lightning_rush' },
      desc: 'Herald of the tempest. A thunderhead strikes whatever comes near him, his swings arc through whole packs, and storm orbs crackle ahead of him.' },
    { id: 'sp_dread_lord', tier: 5, name: 'Dread Lord', element: 'dark', color: '#a855f7',
      stats: { bonusDmg: 82, bonusDef: 32, bonusHp: 420, critChance: 15 },
      palette: { cape: ['#13041f', '#3b0764', '#6b21a8', '#a855f7'], steel: ['#0b0a12', '#2b2838', '#4a4560', '#7c7699', '#e9d5ff'], darkSteel: ['#07060b', '#1c1a26', '#302c40', '#4a4560'], tabard: ['#13041f', '#4c1d95', '#7c3aed', '#c4b5fd'], gold: ['#1a0a24', '#6b21a8', '#a855f7', '#e9d5ff'] },
      skills: { slot1: 'sp_abyss_cleave', slot2: 'sp_void_grasp', slot3: 'sp_soul_bastion', dash: 'sp_shadow_charge' },
      desc: 'An undying warlord dragging a colossal black-violet executioner axe. Hits harder as his blood runs low and refuses to die.' },
    // ---- variant cards below: each has its own 8-axis costume (pixelHeroes.js COSTUMES) ----
    { id: 'sp_gravelord', kit: 2, tier: 1, name: 'Gravelord', element: 'earth', color: '#4ade80',
      stats: { bonusDef: 22, bonusHp: 150, bonusDmg: 12 },
      palette: { steel: ['#14130d', '#4a4a3a', '#6e6e58', '#9a9a7d', '#d6d6ba'], darkSteel: ['#0d0f0a', '#2c3324', '#45573a', '#647c52'], tabard: ['#0c1a10', '#1f4d2e', '#2e7d46', '#4c9e63'], cape: ['#171008', '#4a3018', '#6e4a28', '#996a3c'], gold: ['#2a2005', '#9a6b12', '#cba72a', '#e8d46a', '#fff3c4'], leather: ['#180f08', '#4a2c15', '#6b4322', '#93653a'], robeTrim: ['#101607', '#3a5c1c', '#5c8a2e', '#8ab84e'] },
      skills: { slot1: 'sp_gravelord_slam', slot2: 'sp_gravelord_fault', slot3: 'sp_gravelord_cataclysm', dash: 'sp_gravelord_siege' },
      desc: 'A walking avalanche in rusted plate, swinging a seismic warhammer. Every strike grinds the earth into Seismic Charge — then Cataclysm lets it all loose and leaves a quaking ruin behind.' },
    { id: 'sp_dragoon', kit: 2, tier: 1, name: 'Dragoon', element: 'lightning', color: '#facc15',
      stats: { bonusDmg: 30, bonusAttackSpeed: 0.15, bonusSpeed: 0.3 },
      palette: { steel: ['#0e1426', '#3b4f78', '#5f7ea8', '#8fb2dd', '#e6f2ff'], darkSteel: ['#0a0f1c', '#22304d', '#3a5176', '#5a76a3'], tabard: ['#0b1630', '#1e3a8a', '#2563eb', '#60a5fa'], cape: ['#0b1630', '#1e3a8a', '#3b82f6', '#93c5fd'], gold: ['#2a2205', '#a16207', '#eab308', '#fde047', '#fffbe0'], robeTrim: ['#0f1526', '#334a86', '#5a7cc9', '#93b4f0'] },
      skills: { slot1: 'sp_dragoon_impale', slot2: 'sp_dragoon_wing_slash', slot3: 'sp_dragoon_leap', dash: 'sp_dragoon_wind' },
      desc: 'A winged lancer who fights from the air. Leaping impales finish wounded prey, and a skyfall barrage of lances rains down on the field below.' },
    { id: 'sp_reaver', kit: 2, tier: 2, name: 'Reaver', element: 'fire', color: '#fb923c',
      stats: { bonusDmg: 40, bonusAttackSpeed: 0.12 },
      palette: { steel: ['#24100a', '#5a2418', '#7e3624', '#a64e34', '#e8b894'], darkSteel: ['#160806', '#38150d', '#542418', '#7a3824'], tabard: ['#1c0602', '#7f1d1d', '#b91c1c', '#ef4444'], cape: ['#170705', '#4a140c', '#6e200f', '#93351c'], gold: ['#241203', '#8a4a0a', '#c8791a', '#efac3c', '#ffe2a0'], leather: ['#160b07', '#402313', '#5f341c', '#8a5230'], venom: ['#2a0702', '#c2410c', '#fb8c1c', '#ffd166', '#fff6d5'] },
      skills: { slot1: 'sp_reaver_slash', slot2: 'sp_reaver_wall', slot3: 'sp_reaver_inferno', dash: 'sp_reaver_step' },
      desc: 'A living bonfire with a greatsword. Pyre Slashes stack long-burning flames, a toggled Flame Stance scours the ground around him, and Firebrand Chain drags the blaze through whole packs.' },
    { id: 'sp_runeknight', kit: 2, tier: 2, name: 'Rune Knight', element: 'earth', color: '#a3e635',
      stats: { bonusDmg: 34, bonusMp: 130, bonusAttackSpeed: 0.10 },
      palette: { steel: ['#101418', '#35414b', '#56707c', '#82a4b3', '#d6ecf2'], darkSteel: ['#0b0f13', '#232f37', '#3a4d59', '#5a7686'], tabard: ['#071414', '#123c3c', '#1d5f5f', '#2e8c8c'], cape: ['#0a1013', '#1e3a42', '#2e5a66', '#4a7f8c'], gold: ['#211304', '#8a5a0a', '#c8921a', '#e9c94e', '#fff3b0'], robeTrim: ['#0a140d', '#1e4d30', '#2e7a4a', '#4cae6b'], orb: ['#03200c', '#14a04c', '#4be08a', '#c9ffe0', '#ffffff'], venom: ['#03200c', '#14a04c', '#4be08a', '#c9ffe0', '#ffffff'] },
      skills: { slot1: 'sp_runeknight_wave', slot2: 'sp_runeknight_glyph', slot3: 'sp_runeknight_invoke', dash: 'sp_runeknight_step' },
      desc: 'A scholar-knight whose greatsword is a spell focus. Every blow is carved with runes that echo — each cast replays itself moments later at half strength.' },
    { id: 'sp_sentinel', kit: 2, tier: 2, name: 'Sentinel', element: 'holy', color: '#fde68a',
      stats: { bonusDef: 30, bonusHp: 230, bonusDmg: 8 },
      palette: { steel: ['#141824', '#5a6485', '#8a97b9', '#c5cee6', '#f7f9ff'], darkSteel: ['#0e121b', '#313a4d', '#586280', '#808cae'], tabard: ['#1c1206', '#7a5216', '#b8860b', '#e6c23a'], cape: ['#1c1606', '#6e5210', '#a88416', '#d4ac28'], gold: ['#382403', '#b8941f', '#e6b63d', '#f7d86e', '#fff3c4'], leather: ['#150f08', '#4a3324', '#6e5227', '#8a6a3c'] },
      skills: { slot1: 'sp_sentinel_throw', slot2: 'sp_sentinel_warcry', slot3: 'sp_sentinel_riposte', dash: 'sp_sentinel_guard' },
      desc: 'The shield that never breaks. A holy bulwark of the king\'s hall — war cries that stun, fortresses that refuse to fall, a shield ram that scatters packs, and a Bulwark Mist that blinds anything daring to swing at him.' },
    { id: 'sp_duskblade', kit: 2, tier: 3, name: 'Duskblade', element: 'dark', color: '#c084fc',
      stats: { bonusDmg: 52, bonusDef: 16, bonusHp: 180, critChance: 6 },
      palette: { steel: ['#140d1e', '#3a2a58', '#544080', '#7a61ab', '#cfc2ee'], darkSteel: ['#0b0712', '#241a3e', '#362a5c', '#4f3f80'], tabard: ['#12071f', '#3b0764', '#6b21a8', '#a855f7'], cape: ['#0c0614', '#2b1a40', '#402a63', '#5c3f85'], gold: ['#180d26', '#4a2a70', '#7a45a5', '#a77bd4', '#e9d5ff'], robeTrim: ['#140826', '#4c1d95', '#7c3aed', '#c4b5fd'], venom: ['#150826', '#6d28d9', '#a855f7', '#f3e8ff', '#ffffff'] },
      skills: { slot1: 'sp_duskblade_soul_rend', slot2: 'sp_duskblade_doom', slot3: 'sp_duskblade_devour', dash: 'sp_duskblade_tread' },
      desc: 'A prisoner of his own curse, wielding a greatsword that drinks souls. Strikes harvest Souls; Devour spends them in a burst of raw spirit and stolen life.' },
    { id: 'sp_titan', kit: 2, tier: 3, name: 'Titan', element: 'earth', color: '#84cc16',
      stats: { bonusDef: 36, bonusHp: 340, bonusDmg: 16 },
      palette: { steel: ['#161511', '#4a463a', '#6e6a58', '#9a9580', '#d6d2ba'], darkSteel: ['#0f0e0a', '#2e2c21', '#464438', '#635f4c'], tabard: ['#101906', '#2f4d17', '#47782e', '#4a8a52'], cape: ['#151a10', '#3a4a2c', '#55683f', '#7c9357'], gold: ['#241a05', '#8a6410', '#c89c28', '#e6c85e', '#fff3a8'], leather: ['#150f08', '#423015', '#63491f', '#8a6a30'], robeTrim: ['#121a12', '#2f522f', '#487f3f', '#6aa852'] },
      skills: { slot1: 'sp_titan_hurl', slot2: 'sp_titan_graviton', slot3: 'sp_titan_fissure', dash: 'sp_titan_stomp' },
      desc: 'A mountain given fists. The Titan warps gravity around a Graviton Core to drag packs in, then collapses everything into a Titan Fissure that leaves the ground stunned.' },
    { id: 'sp_bannerman', kit: 2, tier: 3, name: 'Bannerman', element: 'holy', color: '#fbbf24',
      stats: { bonusHp: 260, bonusDmg: 26, bonusMp: 120, bonusAttackSpeed: 0.08 },
      palette: { steel: ['#141824', '#5a6485', '#8a97b9', '#c5cee6', '#f7f9ff'], darkSteel: ['#0e121b', '#313a4d', '#586280', '#808cae'], tabard: ['#2a2005', '#b8860b', '#e6c23a', '#fff1a8'], cape: ['#1c1606', '#6e5210', '#a88416', '#d4ac28'], gold: ['#382403', '#b8941f', '#e6b63d', '#f7d86e', '#fff3c4'], leather: ['#1a0f08', '#5a3018', '#7f4827', '#a86a3c'], robeTrim: ['#241206', '#5c3a10', '#935a16', '#c98c2a'] },
      skills: { slot1: 'sp_bannerman_plant', slot2: 'sp_bannerman_warshout', slot3: 'sp_bannerman_rally', dash: 'sp_bannerman_flag' },
      desc: 'The war banner made flesh. Plants radiant standards that scorch the field, rallies the blood with war shouts, and refuses to let his line fall.' },
    { id: 'sp_warchief', kit: 2, tier: 4, name: 'Warchief', element: 'fire', color: '#f97316',
      stats: { bonusDmg: 64, bonusAttackSpeed: 0.2, bonusHp: 160 },
      palette: { steel: ['#1a1210', '#54342a', '#75493a', '#a06a54', '#e0b49a'], darkSteel: ['#120b08', '#33211a', '#4f3126', '#734a38'], tabard: ['#260603', '#991b1b', '#dc2626', '#f87171'], cape: ['#1f140b', '#5c3d22', '#86603a', '#b48a5c'], gold: ['#2a1003', '#93490a', '#c96b16', '#efa348', '#ffe0a8'], leather: ['#180c06', '#4a2412', '#6b351c', '#935028'] },
      skills: { slot1: 'sp_warchief_hack', slot2: 'sp_warchief_axes', slot3: 'sp_warchief_devastate', dash: 'sp_warchief_charge' },
      desc: 'A roaring chieftain of twin war-axes. Rage fades in seconds if the blades stop moving — so he never stops; Howl of War ignites it in an instant and Devastate spends it all in a blood-drinking cleave.' },
    { id: 'sp_phoenix_oath', kit: 2, tier: 5, name: 'Phoenix Oath', element: 'fire', color: '#fbbf24',
      stats: { bonusDmg: 76, bonusDef: 24, bonusHp: 300, critChance: 10 },
      palette: { steel: ['#241606', '#7a5216', '#b8860b', '#e6c23a', '#fff6c8'], darkSteel: ['#1c1105', '#4a330e', '#6e4e16', '#9a7430'], tabard: ['#250a03', '#93340c', '#d95f1a', '#f59e0b'], cape: ['#2a1202', '#8a3c08', '#c96b14', '#efa63c'], gold: ['#382403', '#b8941f', '#e6b63d', '#f7d86e', '#fff3c4'], robeTrim: ['#2a0d02', '#8a2f0a', '#c85a14', '#ef9a2e'], orb: ['#3b0a02', '#e05a10', '#ffb84c', '#ffe8b0', '#ffffff'] },
      passive: { name: 'Rebirth', rebirth: { cd: 90, hp: 0.4, r: 4, dmg: 4 } },
      skills: { slot1: 'sp_phoenix_strike', slot2: 'sp_phoenix_firebird', slot3: 'sp_phoenix_immolation', dash: 'sp_phoenix_ember' },
      desc: 'The eternal flame given a knight. Ember Orbs wheel around him scorching whatever they touch; his Immolation Oath refuses to die, and every rebirth erupts in a blinding conflagration.' }
  ],
  mage: [
    { id: 'sp_pyromancer', tier: 1, name: 'Pyromancer', element: 'fire', color: '#f97316',
      stats: { bonusDmg: 32, bonusMp: 80 },
      palette: { robe: ['#2a0802', '#7c2d12', '#c2410c', '#fb923c'], robeTrim: ['#2e1d03', '#b45309', '#f59e0b', '#fde68a'], orb: ['#3b0d02', '#ea580c', '#fb923c', '#fed7aa', '#ffffff'] },
      skills: { slot1: 'sp_flame_wave', slot2: 'sp_ember_volley', slot3: 'sp_sunburst', dash: 'sp_flame_step' },
      desc: 'A wielder of raw flame. Simple, brutal and very hot.' },
    { id: 'sp_cryo_sage', tier: 2, name: 'Cryo Sage', element: 'ice', color: '#67e8f9',
      stats: { bonusDmg: 30, bonusDef: 14, bonusMp: 120 },
      palette: { robe: ['#06222e', '#155e75', '#0891b2', '#67e8f9'], robeTrim: ['#0b2530', '#94a3b8', '#e2e8f0', '#ffffff'], beard: ['#1e293b', '#94a3b8', '#e0f2fe', '#ffffff'] },
      skills: { slot1: 'sp_ice_lance', slot2: 'sp_frozen_orb', slot3: 'sp_permafrost', dash: 'sp_ice_blink' },
      desc: 'Master of the long winter, freezing foes in place before shattering them.' },
    { id: 'sp_tempest', tier: 3, name: 'Tempest Caller', element: 'lightning', color: '#facc15',
      stats: { bonusDmg: 44, bonusAttackSpeed: 0.2, bonusMp: 140 },
      palette: { robe: ['#1e1b4b', '#312e81', '#4f46e5', '#818cf8'], robeTrim: ['#2a2205', '#ca8a04', '#facc15', '#fef9c3'], orb: ['#2a2205', '#ca8a04', '#fde047', '#fefce8', '#ffffff'] },
      skills: { slot1: 'sp_arc_bolt', slot2: 'sp_static_field', slot3: 'sp_storm_lance', dash: 'sp_static_blink' },
      desc: 'Calls the storm down from a clear sky.' },
    { id: 'sp_chronomancer', tier: 4, name: 'Chronomancer', element: 'holy', color: '#fef08a',
      stats: { bonusDmg: 58, bonusMp: 220, bonusDef: 20, bonusSpeed: 0.3 },
      palette: { robe: ['#2b2205', '#a16207', '#d4a017', '#fde68a'], robeTrim: ['#1e293b', '#e2e8f0', '#ffffff', '#ffffff'], orb: ['#2b2205', '#facc15', '#fef9c3', '#ffffff', '#ffffff'] },
      skills: { slot1: 'sp_time_warp', slot2: 'sp_temporal_ward', slot3: 'sp_dawn_rain', dash: 'sp_phase_shift' },
      desc: 'Bends time itself: what was, will be undone.' },
    { id: 'sp_void_archon', tier: 5, name: 'Void Archon', element: 'dark', color: '#a855f7',
      stats: { bonusDmg: 82, bonusMp: 300, bonusHp: 220, critChance: 8 },
      palette: { robe: ['#0b0614', '#2e1065', '#4c1d95', '#7c3aed'], robeTrim: ['#13041f', '#7e22ce', '#c084fc', '#f3e8ff'], orb: ['#13041f', '#7e22ce', '#c084fc', '#f5d0fe', '#ffffff'], beard: ['#13041f', '#4c1d95', '#a78bfa', '#ddd6fe'] },
      skills: { slot1: 'sp_event_horizon', slot2: 'sp_void_volley', slot3: 'sp_void_ray', dash: 'sp_rift_walk' },
      desc: 'An archon who drank from the void between stars. Mythic and terrible.' }
  ],
  rogue: [
    { id: 'sp_nightblade', tier: 1, name: 'Nightblade', element: 'dark', color: '#a855f7',
      stats: { bonusDmg: 22, critChance: 6 },
      palette: { scarf: ['#13041f', '#4c1d95', '#7c3aed', '#a78bfa'], venom: ['#13041f', '#7e22ce', '#c084fc', '#f3e8ff', '#ffffff'] },
      skills: { slot1: 'sp_phantom_shuriken', slot2: 'sp_smoke_bomb', slot3: 'sp_shadow_toss', dash: 'sp_night_dash' },
      desc: 'Shuriken master of the night. Throws stars that come back, hides in smoke and tosses a shadow that copies every skill.' },
    { id: 'sp_venom_lord', tier: 2, name: 'Venom Lord', element: 'earth', color: '#4ade80',
      stats: { bonusDmg: 30, bonusAttackSpeed: 0.2, bonusHp: 90 },
      palette: { scarf: ['#052e16', '#166534', '#16a34a', '#86efac'], rogue: ['#0a120c', '#24342a', '#365043', '#4f7360'], venom: ['#052e16', '#16a34a', '#86efac', '#f0fdf4', '#ffffff'] },
      skills: { slot1: 'sp_plague_breath', slot2: 'sp_venom_rain', slot3: 'sp_viper_nest', dash: 'sp_serpent_slip' },
      desc: 'Master of virulent toxins. Stacks lethal poison, spreads epidemics on kill, and detonates.' },
    { id: 'sp_blade_dancer', tier: 3, name: 'Blade Dancer', element: 'lightning', color: '#facc15',
      stats: { bonusDmg: 42, bonusAttackSpeed: 0.3, bonusSpeed: 0.5 },
      palette: { scarf: ['#2a2205', '#ca8a04', '#facc15', '#fef9c3'], strap: ['#2a2205', '#a16207', '#d4a017', '#fde68a'], venom: ['#2a2205', '#eab308', '#fef08a', '#ffffff', '#ffffff'] },
      skills: { slot1: 'sp_storm_waltz', slot2: 'sp_knife_storm', slot3: 'sp_mirror_dance', dash: 'sp_flash_step' },
      desc: 'A lightning-fast duelist in continuous motion. Chains infinite dashes and whirlwind strikes.' },
    { id: 'sp_frost_shade', tier: 4, name: 'Frost Shade', element: 'ice', color: '#67e8f9',
      stats: { bonusDmg: 56, critChance: 8, bonusDef: 18, bonusSpeed: 0.3 },
      palette: { scarf: ['#06222e', '#0e7490', '#22d3ee', '#cffafe'], hood: ['#0a1620', '#1c3344', '#2c4d63', '#476f8a'], rogue: ['#0b1620', '#2a4152', '#3e5c73', '#5f86a3'], venom: ['#06222e', '#0891b2', '#67e8f9', '#ecfeff', '#ffffff'] },
      skills: { slot1: 'sp_frozen_execution', slot2: 'sp_shatter', slot3: 'sp_ice_spikes', dash: 'sp_cold_step' },
      desc: 'A ghost of the glacier. Its touch stops the heart.' },
    { id: 'sp_eclipse_reaper', tier: 5, name: 'Eclipse Reaper', element: 'fire', color: '#f43f5e',
      stats: { bonusDmg: 80, critChance: 12, bonusAttackSpeed: 0.3, bonusHp: 200 },
      palette: { scarf: ['#2a0610', '#881337', '#e11d48', '#fda4af'], hood: ['#0d0507', '#2a1015', '#3f1820', '#5f2430'], rogue: ['#120709', '#33141a', '#4f1f28', '#73303c'], venom: ['#2a0610', '#e11d48', '#fda4af', '#fff1f2', '#ffffff'] },
      skills: { slot1: 'sp_total_eclipse', slot2: 'sp_blood_tether', slot3: 'sp_crimson_bloom', dash: 'sp_reaper_step' },
      desc: 'Harvester under the black sun. Mythic, and almost never seen.' }
  ]
};

// ---------------------------------------------------------------- SP skills
// Card-only skills: none of these reuse a base class skill. GameServer.castSpSkill
// runs them from data. shape: nova (around you), blast / pull / rain (at the
// target), cone, line, strike (one enemy), volley (N nearest), chain (jumps),
// pulse (repeating nova), dash, blink, buff. Tuning: r radius, range, arc (deg),
// len/width, n targets/jumps/waves, every (s between waves), hit (rain strike
// radius), at: 'target' for a pulse placed on the target, decay per chain jump.
// On hit: burn/chill/poison (s), knock (tiles), leech (share of damage healed),
// execute [hp share, mult], shatter (mult vs chilled), crit (bonus chance).
// Self: berserk/fortress/sprint/smoke (s), shield/heal/mana (share of max),
// hpCost (share of current HP), origin (blink: also burst where you left).
// aura: a toggle (cast again to switch off) that drains `drain` of max HP or
// `mpDrain` of max MP per second and strikes everything within r every
// `every` s (spin: the hero whirls, and the card passive leeches those hits).
// bloodlust: { dur, rage, atkSpeed, thirst } - timed +damage, +attack speed
// and a multiplier on the card passive's leech.
const SP_SKILLS: Record<string, any> = {
  // Warrior - Crusader: holy guardian - knockback, light from above, shields & heals
  sp_holy_cleave: { name: 'Shield Bash', shape: 'strike', range: 3.2, dmg: 2.8, knock: 2.4, shield: 0.06, mp: 14, cd: 3.5 },
  sp_judgement: { name: 'Judgement', shape: 'rain', r: 2.4, range: 7, n: 3, every: 0.3, hit: 1.8, dmg: 1.5, chill: 1.5, mp: 18, cd: 5 },
  sp_sanctuary: { name: 'Sanctuary', shape: 'buff', r: 3, dmg: 1.5, fortress: 5, heal: 0.2, shield: 0.15, mp: 30, cd: 14 },
  sp_divine_charge: { name: 'Divine Charge', shape: 'dash', len: 5.2, width: 1.4, dmg: 2.0, shield: 0.08, mp: 10, cd: 3.5 },
  // Warrior - Berserker: twin blood-blades - a toggled aura that burns HP, a
  // toggled blade spin that burns MP, and a Bloodlust buff; the card's
  // Bloodthirst passive drinks HP back from sword hits
  sp_crimson_aura: { name: 'Crimson Aura', shape: 'aura', icon: '🩸', r: 3, every: 0.5, dmg: 0.5, burn: 2, drain: 0.015, mp: 10, cd: 1 },
  sp_bloodlust: { name: 'Bloodlust', shape: 'buff', bloodlust: { dur: 8, rage: 0.3, atkSpeed: 0.25, thirst: 2 }, hpCost: 0.06, mp: 14, cd: 16 },
  sp_blade_whirl: { name: 'Blade Whirl', shape: 'aura', icon: '🌀', spin: true, r: 2.6, every: 0.25, dmg: 0.4, mpDrain: 0.09, mp: 6, cd: 1 },
  sp_crimson_rush: { name: 'Crimson Rush', shape: 'dash', len: 6, width: 1.5, dmg: 2.4, leech: 0.12, mp: 10, cd: 3.5 },
  // Warrior - Frost Templar
  sp_glacier_strike: { name: 'Glacier Strike', shape: 'strike', range: 3.5, dmg: 3.6, chill: 3, execute: [0.3, 1.5], mp: 14, cd: 3.5 },
  sp_winter_ward: { name: 'Winter Ward', shape: 'buff', r: 3.2, dmg: 1.6, chill: 3, shield: 0.25, mp: 20, cd: 9 },
  sp_avalanche: { name: 'Avalanche', shape: 'rain', r: 3.5, range: 7, n: 6, every: 0.18, hit: 1.4, dmg: 1.6, chill: 2, mp: 32, cd: 11 },
  sp_ice_glide: { name: 'Ice Glide', shape: 'dash', len: 6, width: 1.2, dmg: 1.8, chill: 2, sprint: 2, mp: 10, cd: 3.5 },
  // Warrior - Storm Herald: area storm - a toggled thunderhead that strikes
  // whatever comes near, a toggled conduit that chains every swing (paid in
  // MP per swing), and two storm orbs that shock everything they pass
  sp_thunderhead: { name: 'Thunderhead', shape: 'aura', icon: '🌩️', skyStrike: 5, r: 3, every: 0.6, dmg: 0.8, chill: 0.4, mpDrain: 0.05, mp: 10, cd: 1 },
  sp_arc_conduit: { name: 'Arc Conduit', shape: 'aura', icon: '⚡', chainAttack: { n: 5, jump: 4, decay: 0.85, mp: 5 }, mp: 6, cd: 1 },
  sp_storm_orbs: { name: 'Storm Orbs', shape: 'orbs', n: 2, spread: 0.3, len: 7, dur: 1.8, r: 2, every: 0.25, dmg: 0.5, mp: 22, cd: 6 },
  sp_lightning_rush: { name: 'Lightning Rush', shape: 'blink', len: 7, r: 2, dmg: 2.2, origin: true, mp: 10, cd: 3.5 },
  // Warrior - Dread Lord (Colossal Black-Violet Executioner Axe: Missing-HP Fury, Spinning Slash & Undying Rage)
  sp_abyss_cleave: { name: 'Abyssal Guillotine', shape: 'line', len: 6.5, width: 2.2, dmg: 4.2, execute: [0.35, 1.8], leech: 0.10, furyBonus: 0.75, knock: 1.2, mp: 16, cd: 3.5 },
  sp_void_grasp: { name: 'Mocking Dread Roar', shape: 'pull', r: 5.5, range: 6.5, dmg: 3.6, chill: 4.0, leech: 0.08, furyBonus: 0.6, mp: 20, cd: 6 },
  sp_soul_bastion: { name: 'Undying Dread Rage', shape: 'pulse', r: 3.8, n: 4, every: 0.35, dmg: 1.8, leech: 0.12, undying: 6, berserk: 7, sprint: 4, shield: 0.35, furyBonus: 0.75, mp: 32, cd: 15 },
  sp_shadow_charge: { name: 'Spinning Void Slash', shape: 'dash', len: 7.0, width: 2.2, dmg: 3.4, crit: 0.3, leech: 0.08, furyBonus: 0.6, spinReset: 1.0, mp: 10, cd: 3.5 },

  // ---- Variant warriors: every card plays around its own mechanic ----
  // Warrior - Gravelord: Fracture. Hits crack enemies (up to 5 Fracture);
  // Cataclysm and Rupture shatter the cracks for bonus damage and a stun.
  sp_gravelord_slam: { name: 'Seismic Hammer', shape: 'strike', range: 3.4, dmg: 2.8, fracture: 2, knock: 0.8, mp: 12, cd: 2.8 },
  sp_gravelord_fault: { name: 'Fault Line', shape: 'fault', n: 6, step: 1.1, every: 0.09, hit: 1.2, dmg: 1.3, fracture: 1, stun: 0.4, mp: 16, cd: 5 },
  sp_gravelord_cataclysm: { name: 'Cataclysm', shape: 'blast', r: 3.2, range: 7, dmg: 2.4, shatterEarth: 0.45, field: { dur: 2.5, every: 0.5, r: 2.6, mult: 0.3 }, mp: 24, cd: 9 },
  sp_gravelord_siege: { name: 'Siege Plow', shape: 'dash', len: 5.5, width: 1.5, dmg: 1.6, plow: true, fracture: 1, mp: 8, cd: 4 },
  sp_gravelord_aftershock: { name: 'Aftershock', shape: 'pulse', at: 'target', r: 2.8, range: 7, n: 3, every: 0.6, dmg: 1.0, fracture: 1, mp: 20, cd: 8 },
  sp_gravelord_rupture: { name: 'Rupture', shape: 'nova', r: 3.4, dmg: 1.6, shatterEarth: 0.3, knock: 1.5, mp: 18, cd: 6 },
  sp_gravelord_boulder: { name: 'Quake Boulders', shape: 'rain', r: 3.2, range: 7, n: 5, every: 0.2, hit: 1.2, dmg: 1.2, fracture: 1, mp: 26, cd: 9 },
  sp_gravelord_bastion: { name: 'Granite Skin', shape: 'buff', fortress: 5, shield: 0.12, mp: 22, cd: 12 },
  // Warrior - Dragoon: the air is his. Hurl the Sky Lance and dive onto it,
  // or vanish upward with Dragon Dive and come down on the cursor.
  sp_dragoon_impale: { name: 'Sky Lance', shape: 'spear', len: 7, width: 1.1, dmg: 2.4, hold: 4, dive: 1.8, diveR: 2.4, mp: 12, cd: 4 },
  sp_dragoon_wing_slash: { name: 'Wing Slash', shape: 'cone', range: 4, arc: 110, dmg: 2.2, crit: 0.15, mp: 14, cd: 3.5 },
  sp_dragoon_leap: { name: 'Dragon Dive', shape: 'jump', air: 0.75, range: 7, r: 3, dmg: 3.4, execute: [0.3, 1.7], stun: 0.6, mp: 22, cd: 8 },
  sp_dragoon_wind: { name: 'Wind Lance Dash', shape: 'dash', len: 6, width: 1.3, dmg: 1.8, crit: 0.1, sprint: 1.5, mp: 8, cd: 3.5 },
  sp_dragoon_pierce: { name: 'Piercing Lance', shape: 'chain', range: 5.5, jump: 4, n: 5, decay: 0.88, dmg: 1.8, execute: [0.3, 1.5], mp: 18, cd: 4.5 },
  sp_dragoon_impact: { name: 'Impact Wake', shape: 'nova', r: 3, dmg: 2.0, knock: 1.0, mp: 16, cd: 6 },
  sp_dragoon_barrage: { name: 'Skyfall Barrage', shape: 'rain', r: 3.2, range: 7, n: 5, every: 0.2, hit: 1.2, dmg: 1.5, execute: [0.35, 1.8], mp: 26, cd: 9 },
  sp_dragoon_updraft: { name: 'Updraft', shape: 'buff', sprint: 3, haste: 2.5, mp: 16, cd: 12 },
  // Warrior - Reaver: Heat. Every skill stokes Heat; at 100 he Overheats -
  // free skills and +40% damage while his own armour cooks him. Meltdown vents it all.
  sp_reaver_slash: { name: 'Pyre Slash', shape: 'cone', range: 3.8, arc: 120, dmg: 2.4, burn: 4, heat: 15, mp: 10, cd: 2.8 },
  sp_reaver_wall: { name: 'Wall of Fire', shape: 'wall', len: 5, range: 7, dmg: 1.4, burn: 3, heat: 20, field: { dur: 4, every: 0.5, r: 0.9, mult: 0.4 }, mp: 16, cd: 7 },
  sp_reaver_inferno: { name: 'Meltdown', shape: 'nova', r: 3.8, dmg: 2.4, burn: 5, vent: 0.12, mp: 24, cd: 9 },
  sp_reaver_step: { name: 'Scorched Path', shape: 'dash', len: 5.5, width: 1.4, dmg: 1.6, burn: 3, heat: 10, field: { dur: 3, every: 0.5, r: 1, mult: 0.35 }, mp: 10, cd: 4 },
  sp_reaver_stance: { name: 'Flame Stance', shape: 'aura', icon: '🔥', r: 3, every: 0.5, dmg: 0.5, burn: 2, mpDrain: 0.05, mp: 8, cd: 1 },
  sp_reaver_ember_cleave: { name: 'Ember Cleave', shape: 'line', len: 6.5, width: 1.4, dmg: 2.2, burn: 3, heat: 15, mp: 14, cd: 4 },
  sp_reaver_firebrand: { name: 'Firebrand Chain', shape: 'chain', range: 5.5, jump: 4, n: 5, decay: 0.85, dmg: 1.6, burn: 3, heat: 15, mp: 18, cd: 5 },
  sp_reaver_crater: { name: 'Searing Crater', shape: 'blast', r: 2.8, range: 7, dmg: 1.6, burn: 2, heat: 15, field: { dur: 3, every: 0.5, r: 1.8, mult: 0.4 }, mp: 20, cd: 7 },
  // Warrior - Rune Knight: glyph traps. Carve glyphs on the ground (4 at most);
  // they burst when an enemy steps on them, or all at once on Invocation.
  sp_runeknight_wave: { name: 'Runic Bladewave', shape: 'line', len: 6.5, width: 1.3, dmg: 2.4, mp: 12, cd: 3.5 },
  sp_runeknight_glyph: { name: 'Glyph of Ruin', shape: 'rune', kind: 'ruin', r: 2.4, range: 7, dur: 12, dmg: 2.6, mp: 14, cd: 2.5 },
  sp_runeknight_invoke: { name: 'Invocation', shape: 'invoke', r: 3, dmg: 1.6, mp: 20, cd: 8 },
  sp_runeknight_step: { name: 'Runic Step', shape: 'blink', len: 5.5, r: 2, dmg: 1.2, leaveRune: 'sp_runeknight_bind', mp: 10, cd: 4 },
  sp_runeknight_bind: { name: 'Binding Glyph', shape: 'rune', kind: 'bind', r: 2.2, range: 7, dur: 12, dmg: 1.2, stun: 1.6, mp: 14, cd: 5 },
  sp_runeknight_frost: { name: 'Frost Glyph', shape: 'rune', kind: 'frost', r: 2.8, range: 7, dur: 12, dmg: 1.4, chill: 4, mp: 14, cd: 5 },
  sp_runeknight_chain: { name: 'Ley Chain', shape: 'chain', range: 5.5, jump: 4, n: 5, decay: 0.85, dmg: 1.6, mp: 18, cd: 5 },
  sp_runeknight_guard: { name: 'Guardian Glyph', shape: 'buff', fortress: 4, mana: 0.10, shield: 0.12, mp: 24, cd: 10 },
  // Warrior - Sentinel: the wall. Riposte Stance blocks every blow and strikes
  // back, Challenge drags packs onto him, and the shield ricochets home.
  sp_sentinel_throw: { name: 'Shield Throw', shape: 'ricochet', range: 6, jump: 4, n: 4, dmg: 1.8, shieldPerHit: 0.03, mp: 14, cd: 4 },
  sp_sentinel_warcry: { name: 'Challenge', shape: 'nova', r: 4, dmg: 1.0, provoke: 0.35, stun: 0.8, mp: 14, cd: 7 },
  sp_sentinel_riposte: { name: 'Riposte Stance', shape: 'buff', parry: 2.5, riposte: 2.5, mp: 16, cd: 9 },
  sp_sentinel_guard: { name: 'Guard Dash', shape: 'dash', len: 5, width: 1.8, dmg: 1.6, shield: 0.12, mp: 8, cd: 4 },
  sp_sentinel_mist: { name: 'Bulwark Mist', shape: 'smoke', r: 3, dur: 6, miss: 0.45, mp: 18, cd: 11 },
  sp_sentinel_ram: { name: 'Shield Ram', shape: 'line', len: 6, width: 2.0, dmg: 2.4, knock: 2.0, mp: 18, cd: 5 },
  sp_sentinel_bulwark: { name: 'Bulwark', shape: 'buff', fortress: 5, shield: 0.25, mp: 24, cd: 12 },
  sp_sentinel_hallowed: { name: 'Hallowed Ground', shape: 'blast', r: 3, range: 7, dmg: 1.4, field: { dur: 3, every: 0.5, r: 2.2, mult: 0.45 }, mp: 20, cd: 7 },
  // Warrior - Duskblade: Doom. Branded enemies store the damage they take from
  // him and suffer it again when the brand runs out; Devour reaps every brand now.
  sp_duskblade_soul_rend: { name: 'Soul Rend', shape: 'strike', range: 3.6, dmg: 3.0, souls: 1, leech: 0.05, mp: 12, cd: 3 },
  sp_duskblade_doom: { name: 'Doom Brand', shape: 'cone', range: 4.2, arc: 120, dmg: 1.8, doom: { delay: 3.5, share: 0.6 }, souls: 1, mp: 16, cd: 6 },
  sp_duskblade_devour: { name: 'Devour', shape: 'nova', r: 3.6, dmg: 1.8, devour: 0.06, reap: true, mp: 20, cd: 7 },
  sp_duskblade_tread: { name: 'Soul Tread', shape: 'dash', len: 5.5, width: 1.3, dmg: 1.8, souls: 1, mp: 10, cd: 3.5 },
  sp_duskblade_phantom: { name: 'Phantom Blades', shape: 'phantom', range: 6, n: 6, every: 0.18, dmg: 1.0, souls: 1, mp: 20, cd: 8 },
  sp_duskblade_rain: { name: 'Grave Rain', shape: 'rain', r: 3.5, range: 7, n: 6, every: 0.18, hit: 1.2, dmg: 1.3, souls: 1, mp: 28, cd: 9 },
  sp_duskblade_wail: { name: 'Lantern Wail', shape: 'buff', r: 3, dmg: 1.0, souls: 2, shield: 0.2, mp: 22, cd: 12 },
  sp_duskblade_soul_mirror: { name: 'Soul Mirror', shape: 'blink', len: 6, r: 2.4, dmg: 1.6, origin: true, souls: 1, mp: 12, cd: 4 },
  // Warrior - Titan: picks monsters up and throws them; bends gravity to
  // gather packs, then collapses the ground under them.
  sp_titan_hurl: { name: "Titan's Grip", shape: 'hurl', range: 3.5, throw: 7, dmg: 2.4, land: { r: 2.2, mult: 1.4 }, stun: 1.2, mp: 16, cd: 5 },
  sp_titan_graviton: { name: 'Graviton Core', shape: 'blast', r: 3, range: 7, dmg: 1.4, field: { dur: 3, every: 0.5, r: 2.5, pull: 0.25, mult: 0.5 }, mp: 18, cd: 7 },
  sp_titan_fissure: { name: 'Titan Fissure', shape: 'blast', r: 2, range: 7, dmg: 1.2, implode: { delay: 0.8, r: 4, mult: 3.0 }, mp: 26, cd: 9 },
  sp_titan_stomp: { name: 'Stomp Dash', shape: 'dash', len: 5, width: 2.2, dmg: 2.0, stun: 1, mp: 10, cd: 4 },
  sp_titan_maul: { name: 'Colossal Maul', shape: 'strike', range: 3.8, dmg: 3.2, stun: 0.8, mp: 14, cd: 3.5 },
  sp_titan_cataclysm: { name: 'Titanquake', shape: 'nova', r: 4, dmg: 2.8, stun: 1.8, knock: 1.2, mp: 24, cd: 10 },
  sp_titan_landslide: { name: 'Landslide', shape: 'line', len: 7, width: 2.0, dmg: 2.4, knock: 1.2, mp: 16, cd: 5 },
  sp_titan_mountain: { name: 'Mountain Shrug', shape: 'buff', fortress: 6, heal: 0.08, mp: 24, cd: 12 },
  // Warrior - Bannerman: the War Standard. Plant it and fight beside it -
  // inside its ring he hits harder and mends; Rally leaps him back to it.
  sp_bannerman_plant: { name: 'War Standard', shape: 'banner', r: 3.2, range: 7, dur: 12, bonus: 0.3, dmg: 1.2, every: 1, tick: 0.4, regen: 0.02, mp: 20, cd: 10 },
  sp_bannerman_warshout: { name: 'War Shout', shape: 'nova', r: 3.6, dmg: 1.6, haste: 1.5, mp: 16, cd: 7 },
  sp_bannerman_rally: { name: 'Rally to the Standard', shape: 'rally', r: 3, dmg: 2.2, shield: 0.1, mp: 16, cd: 6 },
  sp_bannerman_flag: { name: 'Flag Dash', shape: 'dash', len: 5.5, width: 1.4, dmg: 1.5, mp: 10, cd: 4 },
  sp_bannerman_inspire: { name: 'Inspiring Presence', shape: 'buff', heal: 0.12, mana: 0.1, sprint: 3, mp: 24, cd: 12 },
  sp_bannerman_vanguard: { name: 'Vanguard Volley', shape: 'volley', range: 6.5, n: 4, dmg: 1.5, mp: 16, cd: 4 },
  sp_bannerman_last_stand: { name: 'Last Stand', shape: 'buff', fortress: 6, shield: 0.18, mp: 26, cd: 14 },
  sp_bannerman_call: { name: 'Call to Arms', shape: 'pulse', at: 'target', r: 3, range: 7, n: 3, every: 0.5, dmg: 1.1, mp: 22, cd: 9 },
  // Warrior - Warchief: Combo. Each skill that differs from the one before
  // stacks Combo (+10% damage each, up to 6); repeating a skill drops it to 1.
  // Devastate cashes the whole chain in.
  sp_warchief_hack: { name: 'Hack', shape: 'strike', range: 3.4, dmg: 2.8, combo: true, mp: 10, cd: 2.4 },
  sp_warchief_axes: { name: 'Twin Axe Throw', shape: 'boomerang', n: 2, spread: 0.25, len: 6, width: 1.1, dur: 1, dmg: 1.6, combo: true, mp: 14, cd: 4 },
  sp_warchief_devastate: { name: 'Devastate', shape: 'line', len: 6, width: 2, dmg: 2.6, finisher: 0.25, leech: 0.08, combo: true, mp: 22, cd: 8 },
  sp_warchief_charge: { name: 'Rage Charge', shape: 'dash', len: 5.5, width: 1.6, dmg: 2.2, crit: 0.15, combo: true, mp: 10, cd: 4 },
  sp_warchief_howl: { name: 'Howl of War', shape: 'buff', comboGain: 3, berserk: 4, combo: true, mp: 20, cd: 14 },
  sp_warchief_whirl: { name: 'Fury Whirl', shape: 'nova', r: 2.8, dmg: 1.8, combo: true, mp: 12, cd: 3.8 },
  sp_warchief_axe_rain: { name: 'Axe Rain', shape: 'rain', r: 3.5, range: 7, n: 6, every: 0.18, hit: 1.2, dmg: 1.3, combo: true, mp: 28, cd: 9 },
  sp_warchief_carnage: { name: 'Carnage', shape: 'cone', range: 3.8, arc: 150, dmg: 2.0, leech: 0.1, combo: true, mp: 14, cd: 5 },
  // Warrior - Phoenix Oath: Rebirth. A lethal blow sets him alight instead and
  // he rises at 40% HP in an explosion (once per 90s). The Firebird loops out and home.
  sp_phoenix_strike: { name: 'Radiant Strike', shape: 'strike', range: 3.6, dmg: 3.0, burn: 2, mp: 12, cd: 3 },
  sp_phoenix_firebird: { name: 'Firebird', shape: 'firebird', len: 6.5, dur: 1.6, r: 1.6, every: 0.12, dmg: 0.6, burn: 2, mp: 20, cd: 7 },
  sp_phoenix_immolation: { name: 'Immolation Oath', shape: 'pulse', r: 3.4, n: 3, every: 0.6, dmg: 1.4, burn: 2, undying: 6, mp: 30, cd: 14 },
  sp_phoenix_ember: { name: 'Ember Step', shape: 'dash', len: 5.5, width: 1.5, dmg: 1.8, burn: 2, mp: 10, cd: 4 },
  sp_phoenix_conflagration: { name: 'Conflagration', shape: 'blast', r: 3, range: 7, dmg: 1.6, burn: 2, field: { dur: 3, every: 0.5, r: 2, mult: 0.45 }, mp: 24, cd: 8 },
  sp_phoenix_sacrifice: { name: 'Ashen Sacrifice', shape: 'sacrifice', r: 3.6, dmg: 2.0, burnHp: 0.25, regrow: 1.2, mp: 18, cd: 10 },
  sp_phoenix_rebirth: { name: 'Kindled Heart', shape: 'buff', rekindle: true, shield: 0.15, mp: 28, cd: 30 },
  sp_phoenix_talon: { name: 'Phoenix Talon', shape: 'chain', range: 5.5, jump: 4, n: 5, decay: 0.85, dmg: 1.7, burn: 2, mp: 18, cd: 5 },

  // Mage - Pyromancer
  sp_flame_wave: { name: 'Flame Wave', shape: 'cone', range: 5, arc: 70, dmg: 2.6, burn: 3, scorch: 1, mp: 18, cd: 3.5 },
  sp_ember_volley: { name: 'Ember Volley', shape: 'volley', range: 7, n: 4, dmg: 2.0, burn: 3, scorch: 2, mp: 20, cd: 4.5 },
  sp_sunburst: { name: 'Sunburst', shape: 'nova', r: 4.5, dmg: 2.4, burn: 4, combust: 0.5, mp: 32, cd: 9 },
  sp_flame_step: { name: 'Flame Step', shape: 'dash', len: 5, width: 1.2, dmg: 1.6, burn: 3, field: { dur: 3, every: 0.5, r: 1, mult: 0.35 }, mp: 12, cd: 3.5 },
  // Mage - Cryo Sage
  sp_ice_lance: { name: 'Ice Lance', shape: 'line', len: 8, width: 1, dmg: 2.6, frost: 1, shatterFrozen: 2.2, mp: 18, cd: 3.5 },
  sp_frozen_orb: { name: 'Frozen Orb', shape: 'pulse', at: 'target', r: 2.6, range: 7, n: 4, every: 0.4, dmg: 0.9, frost: 1, mp: 22, cd: 6 },
  sp_permafrost: { name: 'Permafrost', shape: 'nova', r: 5, dmg: 2.0, frost: 3, shield: 0.15, mp: 36, cd: 12 },
  sp_ice_blink: { name: 'Ice Blink', shape: 'blink', len: 6, r: 2.4, dmg: 1.2, frost: 2, originOnly: true, taunt: 3, mp: 14, cd: 4 },
  // Mage - Tempest
  sp_arc_bolt: { name: 'Arc Bolt', shape: 'strike', range: 8, dmg: 2.4, crit: 0.1, charge: 1, mp: 12, cd: 2.5 },
  sp_static_field: { name: 'Static Field', shape: 'volley', range: 6, n: 6, dmg: 1.2, chargeHit: 1, mp: 22, cd: 5 },
  sp_storm_lance: { name: 'Storm Lance', shape: 'line', len: 10, width: 1.4, dmg: 2.8, discharge: 0.35, mp: 30, cd: 8 },
  sp_static_blink: { name: 'Static Blink', shape: 'blink', len: 7, r: 2.2, dmg: 1.6, mana: 0.1, charge: 2, mp: 10, cd: 3.5 },
  // Mage - Chronomancer
  sp_time_warp: { name: 'Time Warp', shape: 'blast', r: 3, range: 7, dmg: 2.0, chill: 4, echo: 1.5, mp: 18, cd: 4.5 },
  sp_temporal_ward: { name: 'Temporal Ward', shape: 'buff', fortress: 4, mana: 0.2, haste: 3, mp: 10, cd: 14 },
  sp_dawn_rain: { name: 'Dawn Rain', shape: 'rain', r: 3, range: 7, n: 5, every: 0.25, hit: 1.6, dmg: 1.6, echo: 2, mp: 34, cd: 11 },
  sp_phase_shift: { name: 'Phase Shift', shape: 'blink', len: 6, smoke: 2, haste: 1, mp: 12, cd: 4 },
  // Mage - Void Archon
  sp_event_horizon: { name: 'Event Horizon', shape: 'pull', r: 4.5, range: 7, dmg: 2.2, field: { dur: 2, every: 0.4, r: 4.5, mult: 0.3, pull: 0.25 }, mp: 24, cd: 7 },
  sp_void_volley: { name: 'Void Volley', shape: 'volley', range: 8, n: 5, dmg: 2.2, leech: 0.05, souls: 1, mp: 26, cd: 5 },
  sp_void_ray: { name: 'Void Ray', shape: 'line', len: 11, width: 2, dmg: 3.8, devour: 0.02, mp: 36, cd: 10 },
  sp_rift_walk: { name: 'Rift Walk', shape: 'blink', len: 7, r: 2.4, dmg: 2.0, origin: true, riftPull: 3, mp: 14, cd: 4 },

  // Rogue - Nightblade (Shuriken thrower: recalled stars, smoke and a mirroring shadow)
  sp_phantom_shuriken: { name: 'Phantom Shuriken', shape: 'shuriken', n: 5, range: 7, spread: 40, width: 0.8, dmg: 1.0, back: 1.3, hold: 5, mp: 16, cd: 6 },
  sp_smoke_bomb: { name: 'Smoke Bomb', shape: 'smoke', r: 3, dur: 5, miss: 0.5, dmg: 0.8, mp: 18, cd: 10 },
  sp_shadow_toss: { name: 'Shadow Toss', shape: 'shadow', range: 7, r: 2, dur: 3, mirror: 0.7, dmg: 1.2, mp: 14, cd: 8 },
  sp_night_dash: { name: 'Shadowstep', shape: 'backstep', range: 7, dmg: 2.2, crit: 0.5, mp: 8, cd: 3.0 },
  // Rogue - Venom Lord (Poison Alchemist: Stacks, Epidemic & Detonate)
  sp_plague_breath: { name: 'Toxic Injection', shape: 'cone', range: 5.0, arc: 80, dmg: 2.2, poisonStacks: 3, poison: 7, mp: 14, cd: 3.0 },
  sp_venom_rain: { name: 'Miasma Trap', shape: 'pulse', at: 'target', r: 3.5, range: 7, n: 6, every: 0.4, dmg: 1.0, poisonStacks: 1, poison: 5, chill: 2, mp: 22, cd: 7.0 },
  sp_viper_nest: { name: 'Epidemic Detonate', shape: 'detonate', r: 7.0, dmg: 2.5, mp: 28, cd: 8.0 },
  sp_serpent_slip: { name: 'Serpent Shed', shape: 'dash', len: 5.5, width: 1.6, dmg: 1.6, poisonStacks: 2, poison: 4, cleanse: true, mp: 8, cd: 3.0 },
  // Rogue - Blade Dancer (Rhythm Duelist: Flow, Static Charge & Infinite Dash Resets)
  sp_storm_waltz: { name: 'Storm Flourish', shape: 'nova', r: 3.2, dmg: 2.4, staticCharge: 6.0, flowGain: 1, mp: 12, cd: 2.5 },
  sp_knife_storm: { name: 'Tempest Vortex', shape: 'pull', r: 4.5, range: 6.5, dmg: 2.6, staticCharge: 6.0, mp: 20, cd: 6.0 },
  sp_mirror_dance: { name: 'Thousand Cuts', shape: 'rain', r: 3.5, range: 6, n: 8, every: 0.1, hit: 1.2, dmg: 1.4, crit: 0.25, invuln: 0.8, mp: 30, cd: 9.0 },
  sp_flash_step: { name: 'Flash Cadence', shape: 'dash', len: 6.5, width: 1.5, dmg: 2.4, resetOnStatic: true, mp: 8, cd: 3.0 },
  // Rogue - Frost Shade
  sp_frozen_execution: { name: 'Frozen Execution', shape: 'strike', range: 3.5, dmg: 3.6, chill: 2, execute: [0.35, 1.8], mp: 14, cd: 3.5 },
  sp_shatter: { name: 'Shatter', shape: 'nova', r: 3.4, dmg: 2.4, shatter: 1.6, mp: 18, cd: 5 },
  sp_ice_spikes: { name: 'Ice Spikes', shape: 'line', len: 8, width: 1.6, dmg: 3.8, chill: 3, mp: 28, cd: 9 },
  sp_cold_step: { name: 'Cold Step', shape: 'blink', len: 6, r: 2, dmg: 1.8, chill: 2, mp: 8, cd: 3 },
  // Rogue - Eclipse Reaper
  sp_total_eclipse: { name: 'Total Eclipse', shape: 'strike', range: 4, dmg: 4.6, burn: 4, execute: [0.3, 2.0], mp: 16, cd: 3.5 },
  sp_blood_tether: { name: 'Blood Tether', shape: 'volley', range: 6, n: 4, dmg: 2.6, leech: 0.1, mp: 20, cd: 5 },
  sp_crimson_bloom: { name: 'Crimson Bloom', shape: 'nova', r: 4.5, dmg: 4.8, burn: 4, leech: 0.05, mp: 36, cd: 11 },
  sp_reaper_step: { name: 'Reaper Step', shape: 'dash', len: 7, width: 1.6, dmg: 3.0, burn: 3, mp: 10, cd: 3 },
  // ---- Extra arsenal skills: swap these in from the Spellbook while transformed ----
  // Warrior - Crusader
  sp_radiant_lance: { name: 'Radiant Lance', shape: 'line', len: 7, width: 1.2, dmg: 2.8, chill: 1, mp: 16, cd: 4 },
  sp_consecration: { name: 'Consecration', shape: 'pulse', at: 'target', r: 3, range: 7, n: 4, every: 0.4, dmg: 1.0, heal: 0.04, mp: 22, cd: 8 },
  sp_halo_burst: { name: 'Halo Burst', shape: 'nova', r: 3.6, dmg: 2.4, shield: 0.1, mp: 24, cd: 8 },
  sp_angel_step: { name: 'Angel Step', shape: 'blink', len: 6, r: 2, dmg: 1.6, heal: 0.05, mp: 10, cd: 4 },
  // Warrior - Berserker
  sp_twin_rend: { name: 'Twin Rend', shape: 'cone', range: 3.6, arc: 120, dmg: 3.2, leech: 0.12, mp: 14, cd: 3.5 },
  sp_exsanguinate: { name: 'Exsanguinate', shape: 'nova', r: 3.8, dmg: 4.4, burn: 3, hpCost: 0.12, mp: 18, cd: 7 },
  sp_crimson_cross: { name: 'Crimson Cross', shape: 'line', len: 6, width: 1.4, dmg: 3.4, burn: 2, leech: 0.1, mp: 16, cd: 4 },
  sp_blood_leap: { name: 'Blood Leap', shape: 'blink', len: 6, r: 2.4, dmg: 2.2, leech: 0.1, mp: 10, cd: 4 },
  // Warrior - Frost Templar
  sp_frost_lance: { name: 'Frost Lance', shape: 'line', len: 7, width: 1.2, dmg: 3.0, chill: 2, mp: 16, cd: 4 },
  sp_hail_shards: { name: 'Hail Shards', shape: 'volley', range: 6, n: 4, dmg: 1.8, chill: 1.5, mp: 18, cd: 4.5 },
  sp_glacial_prison: { name: 'Glacial Prison', shape: 'pull', r: 4, range: 7, dmg: 2.4, chill: 4, mp: 26, cd: 9 },
  sp_frost_vault: { name: 'Frost Vault', shape: 'blink', len: 5, r: 2.4, dmg: 2.0, chill: 2, mp: 10, cd: 4 },
  // Warrior - Storm Herald
  sp_thunder_spear: { name: 'Thunder Spear', shape: 'line', len: 9, width: 1.2, dmg: 3.4, mp: 18, cd: 4 },
  sp_static_cleave: { name: 'Static Cleave', shape: 'cone', range: 4, arc: 100, dmg: 2.6, chill: 0.8, mp: 14, cd: 3.5 },
  sp_storm_aegis: { name: 'Storm Aegis', shape: 'buff', r: 3, dmg: 1.4, shield: 0.2, sprint: 3, mp: 22, cd: 12 },
  sp_storm_dash: { name: 'Storm Dash', shape: 'dash', len: 6.5, width: 1.4, dmg: 2.4, mp: 10, cd: 3.5 },
  // Warrior - Dread Lord (Extra Arsenal: Executioner's Beheading, Cataclysmic Axe Drag, Guillotine Skyfall, Oblivion Leap Slam)
  sp_soul_rend: { name: "Executioner's Beheading", shape: 'strike', range: 4.2, dmg: 4.8, crit: 0.35, execute: [0.4, 2.2], stun: 1.5, leech: 0.18, furyBonus: 0.85, mp: 16, cd: 4 },
  sp_dread_wave: { name: 'Cataclysmic Axe Drag', shape: 'cone', range: 5.2, arc: 140, dmg: 3.6, chill: 3, knock: 1.8, leech: 0.08, furyBonus: 0.6, mp: 20, cd: 4.5 },
  sp_grave_rain: { name: 'Guillotine Skyfall', shape: 'rain', r: 3.8, range: 7, n: 6, every: 0.18, hit: 1.6, dmg: 2.1, execute: [0.35, 1.6], leech: 0.06, furyBonus: 0.5, mp: 30, cd: 9.5 },
  sp_void_step: { name: 'Oblivion Leap Slam', shape: 'blink', len: 7, r: 2.8, dmg: 3.0, origin: true, stun: 1.2, leech: 0.08, furyBonus: 0.6, mp: 12, cd: 4 },

  // Mage - Pyromancer
  sp_meteor_call: { name: 'Meteor Call', shape: 'blast', r: 2.6, range: 7, dmg: 3.6, burn: 4, scorch: 2, field: { dur: 3, every: 0.5, r: 2, mult: 0.3 }, mp: 24, cd: 7 },
  sp_fire_chain: { name: 'Fire Chain', shape: 'chain', range: 6, jump: 4, n: 5, decay: 0.85, dmg: 2.4, burn: 2, scorch: 1, scorchBonus: 0.25, mp: 20, cd: 5 },
  sp_cinder_rain: { name: 'Cinder Rain', shape: 'rain', r: 3.5, range: 7, n: 7, every: 0.15, hit: 1.2, dmg: 1.3, burn: 3, scorch: 1, mp: 30, cd: 9 },
  sp_phoenix_blink: { name: 'Phoenix Blink', shape: 'blink', len: 6, r: 2.4, dmg: 2.0, burn: 3, origin: true, combust: 0.3, heal: 0.08, mp: 14, cd: 4 },
  // Mage - Cryo Sage
  sp_ice_shards: { name: 'Ice Shards', shape: 'volley', range: 7, n: 5, dmg: 1.6, frost: 1, mp: 20, cd: 4.5 },
  sp_frost_cone: { name: 'Frost Cone', shape: 'cone', range: 5, arc: 80, dmg: 1.8, frost: 2, mp: 18, cd: 4 },
  sp_glacial_pull: { name: 'Glacial Pull', shape: 'pull', r: 4, range: 7, dmg: 2.2, shatterFrozen: 2.0, mp: 24, cd: 7 },
  sp_frost_slide: { name: 'Frost Slide', shape: 'dash', len: 5, width: 1.2, dmg: 1.2, frost: 1, sprint: 1.5, shield: 0.06, mp: 12, cd: 3.5 },
  // Mage - Tempest
  sp_ball_lightning: { name: 'Ball Lightning', shape: 'pulse', at: 'target', r: 2.4, range: 7, n: 6, every: 0.35, dmg: 0.9, seek: 5, mp: 22, cd: 6 },
  sp_thunder_nova: { name: 'Thunder Nova', shape: 'nova', r: 4, dmg: 2.0, discharge: 0.25, stun: 1.5, mp: 26, cd: 8 },
  sp_spark_rain: { name: 'Spark Rain', shape: 'rain', r: 3.5, range: 7, n: 8, every: 0.12, hit: 1, dmg: 1.0, chargeHit: 1, mp: 26, cd: 9 },
  sp_storm_surge: { name: 'Storm Surge', shape: 'dash', len: 6, width: 1.4, dmg: 1.8, mana: 0.06, charge: 1, mp: 12, cd: 3.5 },
  // Mage - Chronomancer
  sp_rewind: { name: 'Rewind', shape: 'rewind', back: 3, mana: 0.1, mp: 20, cd: 14 },
  sp_chrono_lance: { name: 'Chrono Lance', shape: 'line', len: 9, width: 1.2, dmg: 2.6, stasis: 2, mp: 20, cd: 5 },
  sp_stasis_field: { name: 'Stasis Field', shape: 'blast', r: 3, range: 7, dmg: 1.4, stasis: 3, mp: 26, cd: 10 },
  sp_time_skip: { name: 'Time Skip', shape: 'dash', len: 6, width: 1.2, dmg: 1.4, sprint: 3, haste: 1.5, mp: 12, cd: 5 },
  // Mage - Void Archon
  sp_dark_nova: { name: 'Dark Nova', shape: 'nova', r: 4.5, dmg: 2.6, souls: 1, mp: 28, cd: 8 },
  sp_shadow_chain: { name: 'Shadow Chain', shape: 'chain', range: 6, jump: 4.5, n: 6, decay: 0.9, dmg: 2.0, leech: 0.04, mp: 24, cd: 5 },
  sp_oblivion_rain: { name: 'Singularity', shape: 'blast', r: 2, range: 7, dmg: 1.6, implode: { delay: 1.2, r: 5, mult: 2.2 }, mp: 34, cd: 11 },
  sp_void_dash: { name: 'Void Dash', shape: 'dash', len: 6.5, width: 1.6, dmg: 1.8, leech: 0.05, devour: 0.01, mp: 14, cd: 3.5 },

  // Rogue - Nightblade
  sp_shuriken_storm: { name: 'Shuriken Storm', shape: 'orbit', r: 2.6, n: 6, dur: 3, every: 0.25, dmg: 0.5, mp: 24, cd: 9 },
  sp_moon_volley: { name: 'Shuriken Volley', shape: 'volley', range: 6, n: 4, dmg: 2.0, crit: 0.15, mp: 14, cd: 4 },
  sp_night_fang: { name: 'Assassinate', shape: 'strike', range: 3.2, dmg: 3.4, crit: 0.35, execute: [0.35, 1.8], backstab: true, mp: 12, cd: 3.0 },
  sp_shadow_hop: { name: 'Shadow Hop', shape: 'blink', len: 6, r: 2, dmg: 1.8, origin: true, mp: 8, cd: 3 },
  // Rogue - Venom Lord
  sp_toxic_lance: { name: 'Toxic Lance', shape: 'line', len: 7, width: 1.4, dmg: 2.0, poison: 4, mp: 14, cd: 4 },
  sp_plague_chain: { name: 'Plague Chain', shape: 'chain', range: 5, jump: 4, n: 6, decay: 0.9, dmg: 1.6, poison: 3, mp: 18, cd: 5 },
  sp_miasma: { name: 'Miasma', shape: 'buff', r: 3.5, dmg: 1.0, poison: 5, smoke: 2, mp: 20, cd: 10 },
  sp_venom_dash: { name: 'Venom Dash', shape: 'dash', len: 5.5, width: 1.4, dmg: 1.4, poison: 3, mp: 8, cd: 3 },
  // Rogue - Blade Dancer
  sp_whirling_edge: { name: 'Whirling Edge', shape: 'cone', range: 3.5, arc: 160, dmg: 2.4, crit: 0.1, mp: 14, cd: 3.5 },
  sp_lightning_lunge: { name: 'Lightning Lunge', shape: 'strike', range: 5, dmg: 3.2, crit: 0.2, mp: 14, cd: 3.5 },
  sp_blade_tempest: { name: 'Blade Tempest', shape: 'rain', r: 3, range: 6, n: 8, every: 0.12, hit: 1.1, dmg: 1.0, crit: 0.1, mp: 24, cd: 8 },
  sp_spark_blink: { name: 'Spark Blink', shape: 'blink', len: 7, r: 2, dmg: 1.8, mp: 8, cd: 3 },
  // Rogue - Frost Shade
  sp_frost_daggers: { name: 'Frost Daggers', shape: 'volley', range: 6, n: 5, dmg: 1.8, chill: 1.5, mp: 16, cd: 4 },
  sp_cold_snap: { name: 'Cold Snap', shape: 'blast', r: 2.4, range: 7, dmg: 2.6, chill: 3, mp: 16, cd: 4.5 },
  sp_frozen_veil: { name: 'Frozen Veil', shape: 'buff', smoke: 3, shield: 0.15, sprint: 3, mp: 18, cd: 12 },
  sp_ice_slide: { name: 'Ice Slide', shape: 'dash', len: 6, width: 1.2, dmg: 2.0, chill: 2, mp: 8, cd: 3 },
  // Rogue - Eclipse Reaper
  sp_reaper_scythe: { name: 'Reaper Scythe', shape: 'cone', range: 4, arc: 140, dmg: 3.0, leech: 0.08, mp: 16, cd: 3.5 },
  sp_black_sun: { name: 'Black Sun', shape: 'blast', r: 3, range: 7, dmg: 3.6, burn: 4, mp: 24, cd: 6 },
  sp_harvest: { name: 'Harvest', shape: 'pull', r: 4.5, range: 7, dmg: 3.2, execute: [0.3, 1.6], mp: 26, cd: 8 },
  sp_crimson_blink: { name: 'Crimson Blink', shape: 'blink', len: 7, r: 2.4, dmg: 2.4, burn: 2, origin: true, mp: 10, cd: 3 }
};

// Extra skills each card can swap in (its arsenal = default four + these)
const SP_CARD_EXTRAS = {
  sp_crusader: ['sp_radiant_lance', 'sp_consecration', 'sp_halo_burst', 'sp_angel_step'],
  sp_berserker: ['sp_twin_rend', 'sp_exsanguinate', 'sp_crimson_cross', 'sp_blood_leap'],
  sp_frost_templar: ['sp_frost_lance', 'sp_hail_shards', 'sp_glacial_prison', 'sp_frost_vault'],
  sp_storm_herald: ['sp_thunder_spear', 'sp_static_cleave', 'sp_storm_aegis', 'sp_storm_dash'],
  sp_dread_lord: ['sp_soul_rend', 'sp_dread_wave', 'sp_grave_rain', 'sp_void_step'],
  sp_gravelord: ['sp_gravelord_aftershock', 'sp_gravelord_rupture', 'sp_gravelord_boulder', 'sp_gravelord_bastion'],
  sp_dragoon: ['sp_dragoon_pierce', 'sp_dragoon_impact', 'sp_dragoon_barrage', 'sp_dragoon_updraft'],
  sp_reaver: ['sp_reaver_stance', 'sp_reaver_ember_cleave', 'sp_reaver_firebrand', 'sp_reaver_crater'],
  sp_runeknight: ['sp_runeknight_bind', 'sp_runeknight_frost', 'sp_runeknight_chain', 'sp_runeknight_guard'],
  sp_sentinel: ['sp_sentinel_mist', 'sp_sentinel_ram', 'sp_sentinel_bulwark', 'sp_sentinel_hallowed'],
  sp_duskblade: ['sp_duskblade_phantom', 'sp_duskblade_rain', 'sp_duskblade_wail', 'sp_duskblade_soul_mirror'],
  sp_titan: ['sp_titan_maul', 'sp_titan_cataclysm', 'sp_titan_landslide', 'sp_titan_mountain'],
  sp_bannerman: ['sp_bannerman_inspire', 'sp_bannerman_vanguard', 'sp_bannerman_last_stand', 'sp_bannerman_call'],
  sp_warchief: ['sp_warchief_howl', 'sp_warchief_whirl', 'sp_warchief_axe_rain', 'sp_warchief_carnage'],
  sp_phoenix_oath: ['sp_phoenix_conflagration', 'sp_phoenix_sacrifice', 'sp_phoenix_rebirth', 'sp_phoenix_talon'],
  sp_pyromancer: ['sp_meteor_call', 'sp_fire_chain', 'sp_cinder_rain', 'sp_phoenix_blink'],
  sp_cryo_sage: ['sp_ice_shards', 'sp_frost_cone', 'sp_glacial_pull', 'sp_frost_slide'],
  sp_tempest: ['sp_ball_lightning', 'sp_thunder_nova', 'sp_spark_rain', 'sp_storm_surge'],
  sp_chronomancer: ['sp_rewind', 'sp_chrono_lance', 'sp_stasis_field', 'sp_time_skip'],
  sp_void_archon: ['sp_dark_nova', 'sp_shadow_chain', 'sp_oblivion_rain', 'sp_void_dash'],
  sp_nightblade: ['sp_shuriken_storm', 'sp_moon_volley', 'sp_night_fang', 'sp_shadow_hop'],
  sp_venom_lord: ['sp_toxic_lance', 'sp_plague_chain', 'sp_miasma', 'sp_venom_dash'],
  sp_blade_dancer: ['sp_whirling_edge', 'sp_lightning_lunge', 'sp_blade_tempest', 'sp_spark_blink'],
  sp_frost_shade: ['sp_frost_daggers', 'sp_cold_snap', 'sp_frozen_veil', 'sp_ice_slide'],
  sp_eclipse_reaper: ['sp_reaper_scythe', 'sp_black_sun', 'sp_harvest', 'sp_crimson_blink']
};

const SP_SHAPE_TEXT = {
  nova: s => `Burst around you (radius ${s.r})`,
  blast: s => `Strike the target area (radius ${s.r})`,
  pull: s => `Drag enemies within ${s.r} to the target and crush them`,
  rain: s => `${s.n} strikes rain on the target area`,
  cone: s => `Sweep a ${s.arc}° cone in front (${s.range} range)`,
  line: s => `Piercing line ${s.len} long`,
  strike: () => 'Single-target strike',
  volley: s => `Hits the ${s.n} nearest enemies`,
  chain: s => `Chains through ${s.n} enemies`,
  pulse: s => `${s.n} pulses ${s.at === 'target' ? 'on the target' : 'around you'} (radius ${s.r})`,
  dash: s => `Dash ${s.len} tiles through enemies`,
  blink: s => `Teleport ${s.len} tiles${s.dmg ? (s.originOnly ? ', bursting where you left' : s.origin ? ', bursting at both ends' : ', bursting on landing') : ''}`,
  alpha: s => `Blink between the ${s.n} nearest enemies, striking each (untouchable while it lasts)`,
  buff: s => (s.dmg ? `Burst around you (radius ${s.r})` : 'Empower yourself'),
  shuriken: s => `Throw ${s.n} shuriken at the cursor; cast again within ${s.hold}s to call them back, cutting through enemies on the way (${s.back}x)`,
  smoke: s => `Drop a smoke bomb (radius ${s.r}) for ${s.dur}s: enemies attacking anyone inside miss ${Math.round(s.miss * 100)}% of the time`,
  shadow: s => `Toss your shadow at the cursor for ${s.dur}s; it copies every skill you cast at ${Math.round(s.mirror * 100)}% damage`,
  orbit: s => `Shuriken spin around you for ${s.dur}s (radius ${s.r})`,
  backstep: s => `Shadowstep behind the nearest enemy with +50% Crit Chance`,
  detonate: s => `Detonate all poison stacks on nearby enemies for massive burst damage`,
  rewind: s => `Rewind yourself ${s.back}s: back to where you stood, with the HP you had then (if higher)`,
  aura: s => (s.spin ? `Toggle: spin your blades, cutting everything within ${s.r}`
    : s.skyStrike ? `Toggle: lightning strikes from the sky on up to ${s.skyStrike} enemies within ${s.r} of you`
    : s.chainAttack ? `Toggle: basic attacks arc through up to ${s.chainAttack.n} enemies (each jump x${s.chainAttack.decay})`
    : `Toggle: blood aura around you (radius ${s.r})`),
  orbs: s => `Launch ${s.n} storm orbs ${s.len} tiles ahead over ${s.dur}s, shocking everything within ${s.r} of each`,
  // variant warrior shapes
  fault: s => `A crack crawls ${Math.round(s.n * s.step)} tiles through the ground, erupting ${s.n} times`,
  spear: s => `Hurl a lance ${s.len} tiles; cast again within ${s.hold}s to dive onto it (${s.dive}x around the landing)`,
  jump: s => `Leap into the sky for ${s.air}s (untouchable), then crash down on the cursor (radius ${s.r})`,
  wall: s => `Raise a ${s.len}-tile wall of fire across the target point`,
  rune: s => `Carve a glyph at the cursor for ${s.dur}s (4 at most); it bursts (radius ${s.r}) when an enemy steps on it`,
  invoke: s => `Set off every glyph you have carved at once (radius ${s.r})`,
  ricochet: s => `Throw your shield: it bounces through ${s.n} enemies and flies back to you`,
  phantom: s => `A phantom blade slashes ${s.n} times, leaping to a new enemy each time`,
  hurl: s => `Grab the nearest enemy and throw it up to ${s.throw} tiles at the cursor; where it lands takes ${s.land.mult}x (radius ${s.land.r})`,
  banner: s => `Plant a War Standard for ${s.dur}s (radius ${s.r}): inside it you deal +${Math.round(s.bonus * 100)}% damage and heal ${Math.round(s.regen * 100)}% max HP/s, and it burns enemies around it`,
  rally: s => `Leap to your War Standard and burst there (radius ${s.r}); without one, burst where you stand`,
  boomerang: s => `Throw ${s.n} axes ${s.len} tiles out; they cut on the way out and again on the way back`,
  firebird: s => `Release a Firebird that loops ${s.len} tiles out and back over ${s.dur}s, burning everything within ${s.r} of it`,
  sacrifice: s => `Burn ${Math.round(s.burnHp * 100)}% of your current HP into a blast (radius ${s.r}) that grows with the HP spent`
};

function spSkillDesc(s) {
  const parts = [(SP_SHAPE_TEXT[s.shape] || (() => 'Special ability'))(s)];
  if (s.dmg) parts.push(`${s.dmg}x damage${s.shape === 'aura' || s.shape === 'orbit' || s.shape === 'orbs' ? ` every ${s.every}s` : s.n && (s.shape === 'pulse' || s.shape === 'rain' || s.shape === 'shuriken') ? ' each' : ''}`);
  if (s.bloodlust) {
    const b = s.bloodlust;
    parts.push(`Bloodlust ${b.dur}s: +${Math.round(b.rage * 100)}% damage, +${b.atkSpeed} attack speed, Bloodthirst heals x${b.thirst}`);
  }
  if (s.spin) parts.push('heals through Bloodthirst');
  if (s.backstab) parts.push('2.8x Backstab & marks target');
  if (s.poisonStacks) parts.push(`+${s.poisonStacks} poison stacks`);
  if (s.staticCharge) parts.push('applies Static Charge');
  if (s.resetOnStatic) parts.push('resets cooldown when dashing through Static Charged foes');
  if (s.cleanse) parts.push('cleanses all debuffs');
  if (s.burn) parts.push(`burns ${s.burn}s`);
  if (s.chill) parts.push(`slows ${s.chill}s`);
  if (s.poison) parts.push(`poisons ${s.poison}s`);
  if (s.knock) parts.push('knocks back');
  if (s.execute) parts.push(`x${s.execute[1]} vs enemies under ${Math.round(s.execute[0] * 100)}% HP`);
  if (s.furyBonus) parts.push(`up to +${Math.round(s.furyBonus * 100)}% bonus damage based on missing HP`);
  if (s.undying) parts.push(`Undying Rage ${s.undying}s (HP cannot drop below 1)`);
  if (s.spinReset) parts.push(`reduces cooldown by ${s.spinReset}s per enemy carved through`);
  if (s.crit) parts.push(`+${Math.round(s.crit * 100)}% Crit Chance`);
  if (s.shatter) parts.push(`x${s.shatter} vs slowed enemies`);
  if (s.leech) parts.push(`heals ${Math.round(s.leech * 100)}% of damage`);
  if (s.berserk) parts.push(`+35% damage ${s.berserk}s`);
  if (s.fortress) parts.push(`fortress ${s.fortress}s`);
  if (s.shield) parts.push(`shield ${Math.round(s.shield * 100)}% max HP`);
  if (s.heal) parts.push(`heals ${Math.round(s.heal * 100)}% max HP`);
  if (s.mana) parts.push(`restores ${Math.round(s.mana * 100)}% MP`);
  if (s.sprint) parts.push(`haste ${s.sprint}s`);
  if (s.smoke) parts.push(`vanish ${s.smoke}s`);
  if (s.hpCost) parts.push(`costs ${Math.round(s.hpCost * 100)}% HP`);
  if (s.drain) parts.push(`drains ${+(s.drain * 100).toFixed(1)}% max HP/s while on (HP regen stops)`);
  if (s.chainAttack) parts.push(`costs ${s.chainAttack.mp} MP per swing, fades when MP runs out`);
  if (s.mpDrain) parts.push(`costs ${+(s.mpDrain * 100).toFixed(1)}% max MP/s while on, stops when MP runs out`);
  // mage card mechanics
  if (s.scorch) parts.push(`+${s.scorch} Scorch`);
  if (s.combust) parts.push(`Combust: consumes Scorch for +${Math.round(s.combust * 100)}% per stack`);
  if (s.scorchBonus) parts.push(`+${Math.round(s.scorchBonus * 100)}% per Scorch stack`);
  if (s.field) parts.push(s.field.pull ? `leaves a gravity well ${s.field.dur}s` : `leaves burning ground ${s.field.dur}s`);
  if (s.frost) parts.push(`+${s.frost} Frost (3 = Frozen)`);
  if (s.shatterFrozen) parts.push(`x${s.shatterFrozen} Shatter vs Frozen`);
  if (s.taunt) parts.push(`leaves an ice statue that draws enemies ${s.taunt}s`);
  if (s.charge) parts.push(`+${s.charge} Static Charge`);
  if (s.chargeHit) parts.push(`+${s.chargeHit} Static Charge per enemy hit`);
  if (s.discharge) parts.push(`Discharge: spends all Charge for +${Math.round(s.discharge * 100)}% each`);
  if (s.seek) parts.push('the bolt hunts the nearest enemy each pulse');
  if (s.stun) parts.push(`stuns ${s.stun}s`);
  if (s.echo) parts.push(`Echo: replays at 60% after ${s.echo}s`);
  if (s.stasis) parts.push(`Stasis: stops enemies in time ${s.stasis}s`);
  if (s.haste) parts.push(`cuts your other cooldowns by ${s.haste}s`);
  if (s.souls) parts.push(`+${s.souls} Soul per enemy hit`);
  if (s.devour) parts.push(`Devour: spends Souls for +12% damage and ${Math.round(s.devour * 100)}% HP each`);
  if (s.riftPull) parts.push('drags nearby enemies through the rift with you');
  // variant warrior mechanics
  if (s.fracture) parts.push(`+${s.fracture} Fracture (max 5)`);
  if (s.shatterEarth) parts.push(`shatters Fracture: +${Math.round(s.shatterEarth * 100)}% damage and a 0.35s stun per crack`);
  if (s.plow) parts.push('shoves enemies along to the end of the charge');
  if (s.heat) parts.push(`+${s.heat} Heat (100 = Overheat 6s: free skills, +40% damage, you burn)`);
  if (s.vent) parts.push(`Vent: spends all Heat for +${Math.round(s.vent * 100)}% per 10 Heat`);
  if (s.leaveRune) parts.push('leaves a Binding Glyph where you stood');
  if (s.kind === 'bind') parts.push('the glyph binds what it catches');
  if (s.provoke) parts.push('drags enemies toward you and makes them attack you');
  if (s.parry) parts.push(`Riposte ${s.parry}s: blocks every monster attack and strikes back for ${s.riposte}x`);
  if (s.shieldPerHit) parts.push(`+${Math.round(s.shieldPerHit * 100)}% max HP shield per enemy hit`);
  if (s.doom) parts.push(`Doom ${s.doom.delay}s: replays ${Math.round(s.doom.share * 100)}% of the damage you deal the target`);
  if (s.reap) parts.push('reaps every Doom brand at once');
  if (s.combo) parts.push('Combo skill');
  if (s.comboGain) parts.push(`+${s.comboGain} Combo`);
  if (s.finisher) parts.push(`Finisher: spends Combo for +${Math.round(s.finisher * 100)}% per stack`);
  if (s.rekindle) parts.push('Rebirth is ready again');
  if (s.regrow) parts.push(`regrows ${Math.round(s.regrow * 100)}% of the HP spent over 5s`);
  if (s.implode) parts.push(`collapses after ${s.implode.delay}s, pulling in everything within ${s.implode.r} for ${s.implode.mult}x`);
  return parts.join(', ') + '.';
}

// Normalise into the same shape as base skills (id, mpCost, cooldown, dmgMult...).
// Also used for weapon abilities (items.js), which run on the same engine.
function normalizeSpSkill(id, s) {
  return Object.assign(s, {
    id, spShape: s.shape, mpCost: s.mp, cooldown: s.cd, dmgMult: s.dmg || 0,
    critBonus: s.crit || 0, isDash: s.shape === 'dash' || s.shape === 'blink', desc: spSkillDesc(s)
  });
}
for (const [id, s] of Object.entries(SP_SKILLS)) normalizeSpSkill(id, s);

const CARD_BY_ID = {};
for (const cls of Object.keys(SP_CARDS)) {
  for (const c of SP_CARDS[cls]) {
    const arsenal = [...Object.values(c.skills), ...SP_CARD_EXTRAS[c.id]];
    CARD_BY_ID[c.id] = Object.assign(c, { cls, arsenal, jobReq: SP_TIERS[c.tier].jobReq, rarity: SP_TIERS[c.tier].rarity });
    for (const skillId of arsenal) Object.assign(SP_SKILLS[skillId], { element: c.element, color: c.color, cardId: c.id });
  }
}

// Inventory item for a card
function makeCardItem(cardId, upgradeLevel = 0) {
  const c = CARD_BY_ID[cardId];
  if (!c) return null;
  return {
    id: 'sp_card_' + cardId,
    cardId,
    type: 'sp_card',
    slot: 'sp',
    cls: c.cls,
    name: `SP Card: ${c.name}`,
    rarity: c.rarity,
    upgradeLevel,
    spScale: SP_LEVEL_STEP,
    sellPrice: 500 * c.tier,
    desc: `${c.desc} Requires Job Lv. ${c.jobReq}.`
  };
}

function cardStats(cardId, upgradeLevel = 0) {
  const c = CARD_BY_ID[cardId];
  if (!c) return {};
  const k = 1 + SP_STAT_PER_LEVEL * upgradeLevel;
  const out = {};
  for (const [stat, rawV] of Object.entries(c.stats)) { const v = rawV as number; out[stat] = stat === 'bonusAttackSpeed' || stat === 'bonusSpeed' ? Number((v * k).toFixed(2)) : Math.round(v * k); }
  return out;
}

function cardEnhanceCost(cardId, upgradeLevel) {
  const c = CARD_BY_ID[cardId];
  const tier = SP_TIERS[c ? c.tier : 1];
  const stage = upgradeLevel / SP_LEVEL_STEP;
  return {
    gold: Math.round((tier.enhanceBase * Math.pow(SP_ENHANCE_GROWTH, stage)) / SP_LEVEL_STEP),
    fragments: Math.max(1, Math.round(((stage + 1) * 2) / SP_LEVEL_STEP))
  };
}

// Cards saved before the +100 scale keep their strength: old +N becomes +N*10
function upgradeCardScale(item) {
  if (!item || item.type !== 'sp_card' || item.spScale === SP_LEVEL_STEP) return;
  item.upgradeLevel = Math.min(SP_MAX_LEVEL, Math.round((item.upgradeLevel || 0) * SP_LEVEL_STEP));
  item.spScale = SP_LEVEL_STEP;
  const c = CARD_BY_ID[item.cardId];
  if (c) item.name = `SP Card: ${c.name}${item.upgradeLevel ? ' +' + item.upgradeLevel : ''}`;
}

// Roll at most one card (the highest tier that hits) for a boss kill. Several
// cards share a tier now, so a hit rolls a random variant from that tier's pool.
function rollCardDrop(cls, floor, difficulty) {
  const cards = SP_CARDS[cls] || [];
  for (let tier = 5; tier >= 1; tier--) {
    const [minFloor, chances] = SP_DROP_TABLE[tier];
    const chance = chances[difficulty] || 0;
    if (floor >= minFloor && chance > 0 && Math.random() < chance) {
      const pool = cards.filter(c => c.tier === tier);
      const card = pool[Math.floor(Math.random() * pool.length)];
      if (card) return card.id;
    }
  }
  return null;
}

// Client catalogue (no server-only fields)
function clientCatalog() {
  const out = {};
  for (const cls of Object.keys(SP_CARDS)) {
    out[cls] = SP_CARDS[cls].map(c => ({
      id: c.id, tier: c.tier, name: c.name, element: c.element, color: c.color, jobReq: c.jobReq, rarity: c.rarity,
      stats: c.stats, palette: c.palette, desc: c.desc, passive: c.passive || null,
      skills: c.skills, arsenal: c.arsenal,
      exchange: SP_TIERS[c.tier].exchange,
      drop: { minFloor: SP_DROP_TABLE[c.tier][0], chances: SP_DROP_TABLE[c.tier][1] }
    }));
  }
  const skills = {};
  for (const [id, sk] of Object.entries(SP_SKILLS)) {
    skills[id] = { id, name: sk.name, desc: sk.desc, mpCost: sk.mpCost, cooldown: sk.cooldown, isDash: sk.isDash, shape: sk.shape, element: sk.element, color: sk.color };
  }
  return {
    cards: out,
    skills,
    maxLevel: SP_MAX_LEVEL, chance: SP_ENHANCE_CHANCE, safeLevel: SP_SAFE_LEVEL,
    statPerLevel: SP_STAT_PER_LEVEL, skillPerLevel: SP_SKILL_PER_LEVEL,
    enhanceBase: Object.fromEntries(Object.entries(SP_TIERS).map(([t, v]) => [t, v.enhanceBase])), growth: SP_ENHANCE_GROWTH, levelStep: SP_LEVEL_STEP,
    jobMax: JOB_MAX_LEVEL
  };
}

export {
  JOB_MAX_LEVEL, JOB_LEVEL_BONUS, jobExpToNext,
  SP_TIERS, SP_CARDS, SP_SKILLS, CARD_BY_ID, SP_MAX_LEVEL, SP_ENHANCE_CHANCE, SP_SAFE_LEVEL, SP_SKILL_PER_LEVEL, FRAGMENT_DROP, bossFragments,
  makeCardItem, cardStats, cardEnhanceCost, upgradeCardScale, rollCardDrop, clientCatalog, normalizeSpSkill
};
export default SP_CARDS;
module.exports = {
  JOB_MAX_LEVEL, JOB_LEVEL_BONUS, jobExpToNext,
  SP_TIERS, SP_CARDS, SP_SKILLS, CARD_BY_ID, SP_MAX_LEVEL, SP_ENHANCE_CHANCE, SP_SAFE_LEVEL, SP_SKILL_PER_LEVEL, FRAGMENT_DROP, bossFragments,
  makeCardItem, cardStats, cardEnhanceCost, upgradeCardScale, rollCardDrop, clientCatalog, normalizeSpSkill
};


