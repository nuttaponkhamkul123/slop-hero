// Slop Hero - Specialist (SP) cards, NosTale style.
// Wearing a card and transforming swaps the hero's look and skill set. Each
// class has five cards, one per tier; tiers need a higher job level, are
// rarer to obtain and cost more to enhance (+0 .. +10).
const { expToNext } = require('./progression');

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
const SP_MAX_LEVEL = 10;
const SP_ENHANCE_GROWTH = 1.6;
const SP_ENHANCE_CHANCE = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.22, 0.15];
const SP_SAFE_LEVEL = 5;            // failing from +5 upward drops one level
const SP_STAT_PER_LEVEL = 0.08;     // +8% card stats per level
const SP_SKILL_PER_LEVEL = 0.04;    // +4% card skill damage per level

// ---------------------------------------------------------------- cards
// skills: slot -> SP skill id (see SP_SKILLS); every card has its own kit
// palette: PixelHeroes material overrides [outline, dark, mid, light, highlight?]
// (the costume itself - head, weapon, cape... - is in pixelHeroes.js COSTUMES,
// keyed by card id)
const SP_CARDS = {
  warrior: [
    { id: 'sp_crusader', tier: 1, name: 'Crusader', element: 'holy', color: '#fde68a',
      stats: { bonusDef: 18, bonusHp: 160 },
      palette: { cape: ['#2e2205', '#b8860b', '#e6c23a', '#fff1a8'], tabard: ['#3a2a05', '#c9a227', '#f1d36b', '#fff6c8'], steel: ['#2a2410', '#8f8670', '#d8d2bf', '#f6f2e6', '#ffffff'] },
      skills: { slot1: 'sp_holy_cleave', slot2: 'sp_judgement', slot3: 'sp_sanctuary', dash: 'sp_divine_charge' },
      desc: 'A holy guardian sworn to shield the weak. Bashes foes away, calls down light, shields and heals.' },
    { id: 'sp_berserker', tier: 2, name: 'Berserker', element: 'fire', color: '#ef4444',
      stats: { bonusDmg: 34, bonusAttackSpeed: 0.18 },
      palette: { cape: ['#2a0602', '#7a1a08', '#c2410c', '#fb923c'], steel: ['#1c0f0b', '#4a2a22', '#7b4436', '#b06a52'], darkSteel: ['#120806', '#33190f', '#542a1b', '#7a3f28'], tabard: ['#2a0602', '#7f1d1d', '#b91c1c', '#ef4444'] },
      skills: { slot1: 'sp_blood_frenzy', slot2: 'sp_red_rage', slot3: 'sp_rampage_fissure', dash: 'sp_reckless_leap' },
      desc: 'Fury made flesh. Bleeds for power, drinks it back, and burns everything in reach.' },
    { id: 'sp_frost_templar', tier: 3, name: 'Frost Templar', element: 'ice', color: '#67e8f9',
      stats: { bonusDef: 26, bonusHp: 260, bonusDmg: 22 },
      palette: { cape: ['#06222e', '#0e7490', '#22d3ee', '#a5f3fc'], steel: ['#0c1d2b', '#4f86a6', '#9fd3ee', '#e0f6ff', '#ffffff'], tabard: ['#0b1f33', '#1e3a8a', '#3b82f6', '#93c5fd'] },
      skills: { slot1: 'sp_glacier_strike', slot2: 'sp_winter_ward', slot3: 'sp_avalanche', dash: 'sp_ice_glide' },
      desc: 'A knight of the frozen north whose blade freezes everything it touches.' },
    { id: 'sp_storm_herald', tier: 4, name: 'Storm Herald', element: 'lightning', color: '#facc15',
      stats: { bonusDmg: 52, bonusAttackSpeed: 0.22, bonusSpeed: 0.4 },
      palette: { cape: ['#2a2205', '#a16207', '#eab308', '#fef08a'], steel: ['#14161f', '#3f4660', '#6b7596', '#b8c2e0', '#fffbe0'], tabard: ['#1e1b4b', '#3730a3', '#6366f1', '#a5b4fc'] },
      skills: { slot1: 'sp_thunder_cleave', slot2: 'sp_stormcall', slot3: 'sp_thunder_roar', dash: 'sp_lightning_rush' },
      desc: 'Herald of the tempest. Every swing arrives with a thunderclap.' },
    { id: 'sp_dread_lord', tier: 5, name: 'Dread Lord', element: 'dark', color: '#a855f7',
      stats: { bonusDmg: 75, bonusDef: 30, bonusHp: 400, critChance: 10 },
      palette: { cape: ['#13041f', '#3b0764', '#6b21a8', '#a855f7'], steel: ['#0b0a12', '#2b2838', '#4a4560', '#7c7699', '#e9d5ff'], darkSteel: ['#07060b', '#1c1a26', '#302c40', '#4a4560'], tabard: ['#13041f', '#4c1d95', '#7c3aed', '#c4b5fd'], gold: ['#1a0a24', '#6b21a8', '#a855f7', '#e9d5ff'] },
      skills: { slot1: 'sp_abyss_cleave', slot2: 'sp_void_grasp', slot3: 'sp_soul_bastion', dash: 'sp_shadow_charge' },
      desc: 'A fallen king who commands the void. The rarest of all warrior cards.' }
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
      skills: { slot1: 'sp_night_fang', slot2: 'sp_shadow_net', slot3: 'sp_shroud', dash: 'sp_night_dash' },
      desc: 'Assassin from the dark. Backstabs, shadow clones, and marks enemies for execution.' },
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
const SP_SKILLS = {
  // Warrior - Crusader: holy guardian - knockback, light from above, shields & heals
  sp_holy_cleave: { name: 'Shield Bash', shape: 'strike', range: 3.2, dmg: 2.8, knock: 2.4, shield: 0.06, mp: 14, cd: 3.5 },
  sp_judgement: { name: 'Judgement', shape: 'rain', r: 2.4, range: 7, n: 3, every: 0.3, hit: 1.8, dmg: 1.5, chill: 1.5, mp: 18, cd: 5 },
  sp_sanctuary: { name: 'Sanctuary', shape: 'buff', r: 3, dmg: 1.5, fortress: 5, heal: 0.2, shield: 0.15, mp: 30, cd: 14 },
  sp_divine_charge: { name: 'Divine Charge', shape: 'dash', len: 5.2, width: 1.4, dmg: 2.0, shield: 0.08, mp: 10, cd: 3.5 },
  // Warrior - Berserker: blood-fire savage - pays HP, steals it back, burns up close
  sp_blood_frenzy: { name: 'Blood Frenzy', shape: 'pulse', r: 2.8, n: 5, every: 0.2, dmg: 0.85, burn: 3, leech: 0.06, hpCost: 0.03, mp: 12, cd: 4 },
  sp_red_rage: { name: 'Red Rage', shape: 'buff', berserk: 7, sprint: 3, hpCost: 0.08, mp: 12, cd: 14 },
  sp_rampage_fissure: { name: 'Rampage Fissure', shape: 'cone', range: 6.5, arc: 50, dmg: 4.2, burn: 4, knock: 1, mp: 26, cd: 8 },
  sp_reckless_leap: { name: 'Reckless Leap', shape: 'blink', len: 6, r: 2.6, dmg: 2.4, knock: 1.2, mp: 10, cd: 4 },
  // Warrior - Frost Templar
  sp_glacier_strike: { name: 'Glacier Strike', shape: 'strike', range: 3.5, dmg: 3.6, chill: 3, execute: [0.3, 1.5], mp: 14, cd: 3.5 },
  sp_winter_ward: { name: 'Winter Ward', shape: 'buff', r: 3.2, dmg: 1.6, chill: 3, shield: 0.25, mp: 20, cd: 9 },
  sp_avalanche: { name: 'Avalanche', shape: 'rain', r: 3.5, range: 7, n: 6, every: 0.18, hit: 1.4, dmg: 1.6, chill: 2, mp: 32, cd: 11 },
  sp_ice_glide: { name: 'Ice Glide', shape: 'dash', len: 6, width: 1.2, dmg: 1.8, chill: 2, sprint: 2, mp: 10, cd: 3.5 },
  // Warrior - Storm Herald
  sp_thunder_cleave: { name: 'Thunder Cleave', shape: 'chain', range: 4, jump: 4.5, n: 5, decay: 0.85, dmg: 3.0, mp: 16, cd: 4 },
  sp_stormcall: { name: 'Stormcall', shape: 'rain', r: 4, range: 7, n: 8, every: 0.15, hit: 1.2, dmg: 1.5, chill: 0.6, mp: 24, cd: 7 },
  sp_thunder_roar: { name: 'Thunder Roar', shape: 'nova', r: 4.5, dmg: 3.8, chill: 2, berserk: 5, mp: 30, cd: 12 },
  sp_lightning_rush: { name: 'Lightning Rush', shape: 'blink', len: 7, r: 2, dmg: 2.2, origin: true, mp: 10, cd: 3.5 },
  // Warrior - Dread Lord
  sp_abyss_cleave: { name: 'Abyss Cleave', shape: 'line', len: 6, width: 2, dmg: 3.6, leech: 0.08, mp: 16, cd: 3.5 },
  sp_void_grasp: { name: 'Void Grasp', shape: 'pull', r: 5, range: 7, dmg: 3.4, chill: 2, mp: 22, cd: 6 },
  sp_soul_bastion: { name: 'Soul Bastion', shape: 'pulse', r: 3.5, n: 3, every: 0.4, dmg: 1.6, leech: 0.1, fortress: 6, shield: 0.4, mp: 34, cd: 15 },
  sp_shadow_charge: { name: 'Shadow Charge', shape: 'dash', len: 6.5, width: 1.6, dmg: 3.0, leech: 0.05, mp: 10, cd: 3.5 },

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

  // Rogue - Nightblade (Assassin: Backstab, Shadow Decoy, Mark & Execute)
  sp_night_fang: { name: 'Assassinate', shape: 'strike', range: 3.2, dmg: 3.4, crit: 0.35, execute: [0.35, 1.8], backstab: true, mp: 12, cd: 3.0 },
  sp_shadow_net: { name: 'Shadow Clone', shape: 'decoy', r: 3.5, dmg: 1.5, smoke: 3.0, sprint: 3.0, mp: 18, cd: 8.0 },
  sp_shroud: { name: 'Shadow Reap', shape: 'nova', r: 4.2, dmg: 3.0, reapsMark: true, mp: 24, cd: 7.0 },
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
  sp_skull_splitter: { name: 'Skull Splitter', shape: 'strike', range: 3.5, dmg: 4.4, burn: 2, execute: [0.3, 1.5], leech: 0.1, hpCost: 0.04, mp: 16, cd: 4 },
  sp_war_cry: { name: 'War Cry', shape: 'buff', r: 4.5, dmg: 0.8, chill: 2.5, berserk: 4, mp: 18, cd: 8 },
  sp_inferno_spin: { name: 'Inferno Spin', shape: 'nova', r: 3.4, dmg: 2.6, burn: 3, mp: 20, cd: 5 },
  sp_bull_rush: { name: 'Bull Rush', shape: 'dash', len: 5.5, width: 1.6, dmg: 2.2, knock: 1.5, mp: 10, cd: 4 },
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
  // Warrior - Dread Lord
  sp_soul_rend: { name: 'Soul Rend', shape: 'strike', range: 4, dmg: 3.8, leech: 0.15, mp: 16, cd: 4 },
  sp_dread_wave: { name: 'Dread Wave', shape: 'cone', range: 5, arc: 100, dmg: 2.8, chill: 2, mp: 20, cd: 5 },
  sp_grave_rain: { name: 'Grave Rain', shape: 'rain', r: 3.5, range: 7, n: 6, every: 0.2, hit: 1.4, dmg: 1.8, leech: 0.05, mp: 30, cd: 10 },
  sp_void_step: { name: 'Void Step', shape: 'blink', len: 7, r: 2.4, dmg: 2.4, origin: true, mp: 12, cd: 4 },

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
  sp_moon_volley: { name: 'Moon Volley', shape: 'volley', range: 6, n: 4, dmg: 2.0, crit: 0.15, mp: 14, cd: 4 },
  sp_umbral_line: { name: 'Umbral Line', shape: 'line', len: 7, width: 1.2, dmg: 3.0, mp: 16, cd: 4 },
  sp_night_terror: { name: 'Night Terror', shape: 'nova', r: 3.6, dmg: 2.2, chill: 3, smoke: 1.5, mp: 22, cd: 9 },
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
  sp_berserker: ['sp_skull_splitter', 'sp_war_cry', 'sp_inferno_spin', 'sp_bull_rush'],
  sp_frost_templar: ['sp_frost_lance', 'sp_hail_shards', 'sp_glacial_prison', 'sp_frost_vault'],
  sp_storm_herald: ['sp_thunder_spear', 'sp_static_cleave', 'sp_storm_aegis', 'sp_storm_dash'],
  sp_dread_lord: ['sp_soul_rend', 'sp_dread_wave', 'sp_grave_rain', 'sp_void_step'],
  sp_pyromancer: ['sp_meteor_call', 'sp_fire_chain', 'sp_cinder_rain', 'sp_phoenix_blink'],
  sp_cryo_sage: ['sp_ice_shards', 'sp_frost_cone', 'sp_glacial_pull', 'sp_frost_slide'],
  sp_tempest: ['sp_ball_lightning', 'sp_thunder_nova', 'sp_spark_rain', 'sp_storm_surge'],
  sp_chronomancer: ['sp_rewind', 'sp_chrono_lance', 'sp_stasis_field', 'sp_time_skip'],
  sp_void_archon: ['sp_dark_nova', 'sp_shadow_chain', 'sp_oblivion_rain', 'sp_void_dash'],
  sp_nightblade: ['sp_moon_volley', 'sp_umbral_line', 'sp_night_terror', 'sp_shadow_hop'],
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
  buff: s => (s.dmg ? `Burst around you (radius ${s.r})` : 'Empower yourself'),
  decoy: s => `Deploy a shadow clone & stealth (cast again within 3s to swap positions)`,
  backstep: s => `Shadowstep behind the nearest enemy with +50% Crit Chance`,
  detonate: s => `Detonate all poison stacks on nearby enemies for massive burst damage`,
  rewind: s => `Rewind yourself ${s.back}s: back to where you stood, with the HP you had then (if higher)`
};

function spSkillDesc(s) {
  const parts = [(SP_SHAPE_TEXT[s.shape] || (() => 'Special ability'))(s)];
  if (s.dmg) parts.push(`${s.dmg}x damage${s.n && (s.shape === 'pulse' || s.shape === 'rain') ? ' each' : ''}`);
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
    sellPrice: 500 * c.tier,
    desc: `${c.desc} Requires Job Lv. ${c.jobReq}.`
  };
}

function cardStats(cardId, upgradeLevel = 0) {
  const c = CARD_BY_ID[cardId];
  if (!c) return {};
  const k = 1 + SP_STAT_PER_LEVEL * upgradeLevel;
  const out = {};
  for (const [stat, v] of Object.entries(c.stats)) out[stat] = stat === 'bonusAttackSpeed' || stat === 'bonusSpeed' ? Number((v * k).toFixed(2)) : Math.round(v * k);
  return out;
}

function cardEnhanceCost(cardId, upgradeLevel) {
  const c = CARD_BY_ID[cardId];
  const tier = SP_TIERS[c ? c.tier : 1];
  return { gold: Math.round(tier.enhanceBase * Math.pow(SP_ENHANCE_GROWTH, upgradeLevel)), fragments: (upgradeLevel + 1) * 2 };
}

// Roll at most one card (the highest tier that hits) for a boss kill
function rollCardDrop(cls, floor, difficulty) {
  const cards = SP_CARDS[cls] || [];
  for (let tier = 5; tier >= 1; tier--) {
    const [minFloor, chances] = SP_DROP_TABLE[tier];
    const chance = chances[difficulty] || 0;
    if (floor >= minFloor && chance > 0 && Math.random() < chance) {
      const card = cards.find(c => c.tier === tier);
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
      stats: c.stats, palette: c.palette, desc: c.desc,
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
    enhanceBase: Object.fromEntries(Object.entries(SP_TIERS).map(([t, v]) => [t, v.enhanceBase])), growth: SP_ENHANCE_GROWTH,
    jobMax: JOB_MAX_LEVEL
  };
}

module.exports = {
  JOB_MAX_LEVEL, JOB_LEVEL_BONUS, jobExpToNext,
  SP_TIERS, SP_CARDS, SP_SKILLS, CARD_BY_ID, SP_MAX_LEVEL, SP_ENHANCE_CHANCE, SP_SAFE_LEVEL, SP_SKILL_PER_LEVEL, FRAGMENT_DROP, bossFragments,
  makeCardItem, cardStats, cardEnhanceCost, rollCardDrop, clientCatalog, normalizeSpSkill
};
