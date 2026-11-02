// Slop Hero - Talent Web
//
// Every class has 3 specialisations (branches). Each branch has 3 themed LANES, and every lane
// climbs the same 6 tiers:
//
//   T1  minor     5 ranks  small stat step (all T1 talents are starting points)
//   T2  minor     5 ranks
//   T3  NOTABLE   2 ranks  a mechanic or an upgrade to one of your active skills
//   T4  minor     5 ranks
//   T5  NOTABLE   2 ranks
//   T6  KEYSTONE  1 rank   the lane's payoff, often with a trade-off
//
// That is 20 points per lane, 60 per branch and 180 per class. A hero earns 1 point per level
// (150 at the cap), so nobody owns the whole web: you commit to the lanes your build wants.
//
// Numbers are PERCENTAGES of your own stats wherever possible (damage, HP, armor, MP, thorns),
// so a talent is worth the same at level 5 as at level 150. Stats per rank:
//   dmgPct / hpPct / defPct / mpPct   +x% of base + gear (0.02 = +2%)
//   bonusAttackSpeed                  attacks per second (base ~1.0)
//   bonusSpeed                        move speed (base 4.4-5.4)
//   bonusSwipe                        % cleave damage to nearby enemies
//   critChanceBonus / critDmgBonus    crit chance (cap 75%) / extra crit damage
//   dodgeChance (cap 50%), lifeSteal (cap 8%)
//   thornsPct                         reflect x% of your Armor to every enemy that hits you
//   killHealPercent / killManaPercent restore x% of max HP / MP on every kill
//   burnPower, chillChance, shatterBonus, echoChance, manaLeech, poisonPower: hit procs (TALENT_PROCS)
//
// Skill-upgrade notables use the id the server already reads while casting (cyclone_cleave,
// seismic_shatter, sundering_dash, infernal_cataclysm, glacial_tomb, arcane_haste, mana_flow,
// venomous_knives, noxious_cloud, shadow_sprint), so their rank powers that skill directly.

type Fx = Record<string, number>;
interface NodeDef { name: string; fx?: Fx; note?: string; id?: string; icon?: string }
interface LaneDef { theme: string; nodes: NodeDef[] }   // 6 nodes, T1..T6
interface BranchDef { prefix: string; name: string; lanes: LaneDef[] }

const TIER_RANKS = [5, 5, 2, 5, 2, 1];
const TIER_KIND = ['minor', 'minor', 'notable', 'minor', 'notable', 'keystone'];

// ==========================================
// WARRIOR
// ==========================================
const WARRIOR: BranchDef[] = [
  {
    prefix: 'w_jug', name: 'Juggernaut (Defense)', lanes: [
      { theme: 'Plate', nodes: [
        { name: 'Iron Skin', fx: { defPct: 0.04 } },
        { name: 'Tempered Plate', fx: { defPct: 0.03, hpPct: 0.01 } },
        { name: 'Unbreakable', fx: { defPct: 0.08, hpPct: 0.04 } },
        { name: 'Bulwark', fx: { defPct: 0.04 } },
        { name: 'Shield Wall', fx: { defPct: 0.10 } },
        { name: 'Living Fortress', fx: { defPct: 0.30, hpPct: 0.10, bonusSpeed: -0.3 }, note: 'Nothing gets through, but you move like a wall.' }
      ]},
      { theme: 'Vitality', nodes: [
        { name: 'Thick Hide', fx: { hpPct: 0.03 } },
        { name: 'Hearty', fx: { hpPct: 0.03 } },
        { name: 'Second Wind', fx: { killHealPercent: 0.02 } },
        { name: "Giant's Blood", fx: { hpPct: 0.03 } },
        { name: 'Bloodbound', fx: { hpPct: 0.06, lifeSteal: 0.005 } },
        { name: 'Colossus', fx: { hpPct: 0.25, defPct: 0.10 } }
      ]},
      { theme: 'Thorns', nodes: [
        { name: 'Spiked Plates', fx: { thornsPct: 0.04 } },
        { name: 'Barbed Mail', fx: { thornsPct: 0.03, defPct: 0.01 } },
        { name: 'Seismic Shatter', id: 'seismic_shatter', icon: 'hammer', note: 'Earthshaker deals +30% damage and its slow lasts 1.5s longer per rank.' },
        { name: 'Retaliation', fx: { thornsPct: 0.04 } },
        { name: 'Vengeful Spikes', fx: { thornsPct: 0.15 } },
        { name: 'Iron Maiden', fx: { thornsPct: 0.60, defPct: 0.10 }, note: 'Every blow against you comes back with interest.' }
      ]}
    ]
  },
  {
    prefix: 'w_blade', name: 'Blademaster (Cleave & Speed)', lanes: [
      { theme: 'Cleave', nodes: [
        { name: 'Wide Swings', fx: { bonusSwipe: 3 } },
        { name: 'Sweeping Edge', fx: { bonusSwipe: 2, dmgPct: 0.01 } },
        { name: 'Cyclone', id: 'cyclone_cleave', icon: 'whirl', note: 'Whirlwind reaches 0.6 tiles further and deals +25% damage per rank.' },
        { name: 'Follow-Through', fx: { bonusSwipe: 3 } },
        { name: 'Reaping Arc', fx: { bonusSwipe: 10, dmgPct: 0.03 } },
        { name: 'Tempest of Steel', fx: { bonusSwipe: 40, dmgPct: 0.05 }, note: 'Every swing carves through the whole crowd.' }
      ]},
      { theme: 'Tempo', nodes: [
        { name: 'Quick Hands', fx: { bonusAttackSpeed: 0.02 } },
        { name: 'Battle Rhythm', fx: { bonusAttackSpeed: 0.02 } },
        { name: 'Sundering Charge', id: 'sundering_dash', icon: 'boots', note: 'Blade Charge deals +25% damage and its cooldown is 0.2s shorter per rank.' },
        { name: 'Flurry', fx: { bonusAttackSpeed: 0.02 } },
        { name: 'Relentless', fx: { bonusAttackSpeed: 0.05, bonusSpeed: 0.1 } },
        { name: 'Blade Storm', fx: { bonusAttackSpeed: 0.20, defPct: -0.10 }, note: 'All offence: you swing faster but guard less.' }
      ]},
      { theme: 'Edge', nodes: [
        { name: 'Honed Edge', fx: { dmgPct: 0.02 } },
        { name: 'Weapon Training', fx: { dmgPct: 0.02 } },
        { name: 'Footwork', fx: { bonusSpeed: 0.15 } },
        { name: 'Master-at-Arms', fx: { dmgPct: 0.02 } },
        { name: "Duelist's Focus", fx: { dmgPct: 0.05, critChanceBonus: 0.02 } },
        { name: 'Sword Saint', fx: { dmgPct: 0.20, bonusAttackSpeed: 0.05 } }
      ]}
    ]
  },
  {
    prefix: 'w_warlord', name: 'Warlord (Crits & Burst)', lanes: [
      { theme: 'Precision', nodes: [
        { name: 'Keen Eye', fx: { critChanceBonus: 0.01 } },
        { name: 'Exploit Weakness', fx: { critChanceBonus: 0.01 } },
        { name: 'Battle Trance', fx: { critChanceBonus: 0.03, bonusAttackSpeed: 0.02 } },
        { name: 'Precision', fx: { critChanceBonus: 0.01 } },
        { name: 'Killer Instinct', fx: { critChanceBonus: 0.04 } },
        { name: "Warlord's Eye", fx: { critChanceBonus: 0.15, critDmgBonus: 0.25 } }
      ]},
      { theme: 'Brutality', nodes: [
        { name: 'Heavy Blows', fx: { critDmgBonus: 0.05 } },
        { name: 'Brutality', fx: { critDmgBonus: 0.05 } },
        { name: 'Executioner', fx: { critDmgBonus: 0.15 } },
        { name: 'Bone Breaker', fx: { critDmgBonus: 0.05 } },
        { name: 'Devastate', fx: { critDmgBonus: 0.20, dmgPct: 0.02 } },
        { name: 'Annihilator', fx: { critDmgBonus: 1.00, critChanceBonus: -0.05 }, note: 'Fewer crits, but each one is a finisher.' }
      ]},
      { theme: 'Bloodlust', nodes: [
        { name: 'Bloodthirst', fx: { lifeSteal: 0.002 } },
        { name: 'Battle Hunger', fx: { lifeSteal: 0.002, hpPct: 0.01 } },
        { name: 'Carnage', fx: { killHealPercent: 0.03 } },
        { name: 'Sanguine', fx: { lifeSteal: 0.002 } },
        { name: 'War Discipline', id: 'mana_flow', icon: 'mp_potion', note: 'Your skills cost 15% less Mana per rank.' },
        { name: 'Blood God', fx: { lifeSteal: 0.03, hpPct: 0.10 } }
      ]}
    ]
  }
];

// ==========================================
// MAGE
// ==========================================
const MAGE: BranchDef[] = [
  {
    prefix: 'm_pyro', name: 'Pyromancer (Fire & Burst)', lanes: [
      { theme: 'Ignite', nodes: [
        { name: 'Kindling', fx: { burnPower: 0.004 }, note: 'Unlocks IGNITE: your hits set enemies ablaze, burning for 5% of your Attack every 0.6s for 3s.' },
        { name: 'Searing Heat', fx: { burnPower: 0.004 } },
        { name: 'Cataclysm', id: 'infernal_cataclysm', icon: 'fire', note: 'Firestorm covers 1 tile more, deals +30% damage and burns 5 harder per rank.' },
        { name: 'Wildfire', fx: { burnPower: 0.005 } },
        { name: 'Conflagration', fx: { burnPower: 0.03 } },
        { name: 'Living Inferno', fx: { burnPower: 0.08 } }
      ]},
      { theme: 'Firepower', nodes: [
        { name: 'Fire Affinity', fx: { dmgPct: 0.02 } },
        { name: 'Pyromania', fx: { dmgPct: 0.02 } },
        { name: 'Combustion', fx: { critDmgBonus: 0.15 } },
        { name: 'Heat Surge', fx: { dmgPct: 0.02 } },
        { name: 'Flashpoint', fx: { dmgPct: 0.04, critChanceBonus: 0.02 } },
        { name: 'Sun Heart', fx: { dmgPct: 0.20, hpPct: -0.10 }, note: 'Burn brighter, live shorter.' }
      ]},
      { theme: 'Haste', nodes: [
        { name: 'Quickcast', fx: { bonusAttackSpeed: 0.02 } },
        { name: 'Fleet Flame', fx: { bonusSpeed: 0.04 } },
        { name: 'Blazing Speed', fx: { bonusAttackSpeed: 0.04, bonusSpeed: 0.1 } },
        { name: 'Rapid Fire', fx: { bonusAttackSpeed: 0.02 } },
        { name: 'Overheat', fx: { bonusAttackSpeed: 0.06 } },
        { name: 'Firestorm Rhythm', fx: { bonusAttackSpeed: 0.20, dmgPct: 0.05 } }
      ]}
    ]
  },
  {
    prefix: 'm_cryo', name: 'Cryomancer (Ice & Defense)', lanes: [
      { theme: 'Frost Armor', nodes: [
        { name: 'Frost Shroud', fx: { defPct: 0.04 } },
        { name: 'Glacial Skin', fx: { hpPct: 0.03 } },
        { name: 'Glacial Tomb', id: 'glacial_tomb', icon: 'snow', note: 'Frost Nova deals +25% damage and its chill lasts 1.5s longer per rank.' },
        { name: 'Ice Barrier', fx: { defPct: 0.04, hpPct: 0.01 } },
        { name: 'Frozen Heart', fx: { hpPct: 0.06, defPct: 0.06 } },
        { name: 'Ice Fortress', fx: { defPct: 0.30, hpPct: 0.15, bonusSpeed: -0.3 }, note: 'Encased in ice: tough to crack, slow to move.' }
      ]},
      { theme: 'Chill', nodes: [
        { name: 'Cold Touch', fx: { chillChance: 0.01 }, note: 'Unlocks FROSTBITE: 15% chance per hit to chill (slow) the enemy for 2.5s.' },
        { name: 'Biting Cold', fx: { chillChance: 0.01 } },
        { name: 'Deep Freeze', fx: { chillChance: 0.04 } },
        { name: 'Hypothermia', fx: { chillChance: 0.01 } },
        { name: 'Permafrost', fx: { chillChance: 0.05, shatterBonus: 0.03 } },
        { name: "Winter's Grasp", fx: { chillChance: 0.10 } }
      ]},
      { theme: 'Shatter', nodes: [
        { name: 'Brittle', fx: { shatterBonus: 0.02 }, note: 'Unlocks SHATTER: chilled enemies take +10% damage from you.' },
        { name: 'Ice Shards', fx: { shatterBonus: 0.02 } },
        { name: 'Splinter', fx: { critChanceBonus: 0.03 } },
        { name: 'Fracture', fx: { shatterBonus: 0.02 } },
        { name: 'Shatterpoint', fx: { shatterBonus: 0.06, critDmgBonus: 0.10 } },
        { name: 'Absolute Zero', fx: { shatterBonus: 0.20 } }
      ]}
    ]
  },
  {
    prefix: 'm_arch', name: 'Archmage (Void & Mana)', lanes: [
      { theme: 'Mana', nodes: [
        { name: 'Deep Reserves', fx: { mpPct: 0.05 } },
        { name: 'Mana Font', fx: { mpPct: 0.04 } },
        { name: 'Mana Flow', id: 'mana_flow', icon: 'mp_potion', note: 'Your skills cost 15% less Mana per rank.' },
        { name: 'Arcane Battery', fx: { mpPct: 0.05 } },
        { name: 'Astral Siphon', fx: { killManaPercent: 0.03 } },
        { name: 'Archmage', fx: { mpPct: 0.30, dmgPct: 0.05 } }
      ]},
      { theme: 'Void Echo', nodes: [
        { name: 'Echo of the Void', fx: { echoChance: 0.01 }, note: 'Unlocks VOID ECHO: 10% chance per hit to strike again for 60% damage.' },
        { name: 'Resonance', fx: { echoChance: 0.01 } },
        { name: 'Mind Leech', fx: { manaLeech: 0.01 }, note: 'Unlocks MANA LEECH: 3% of damage dealt returns as MP.' },
        { name: 'Reverberation', fx: { echoChance: 0.01 } },
        { name: 'Rift Echo', fx: { echoChance: 0.04 } },
        { name: 'Infinite Echo', fx: { echoChance: 0.12 } }
      ]},
      { theme: 'Arcana', nodes: [
        { name: 'Arcane Focus', fx: { dmgPct: 0.02 } },
        { name: 'Spell Weaving', fx: { bonusAttackSpeed: 0.02 } },
        { name: 'Arcane Haste', id: 'arcane_haste', icon: 'boots', note: 'Arcane Blink travels 1.5 tiles further and its cooldown is 0.25s shorter per rank.' },
        { name: 'Overcharge', fx: { dmgPct: 0.02 } },
        { name: 'Arcane Mastery', fx: { dmgPct: 0.04, critChanceBonus: 0.02 } },
        { name: 'Glass Cannon', fx: { dmgPct: 0.25, hpPct: -0.15 }, note: 'Maximum power, minimum padding.' }
      ]}
    ]
  }
];

// ==========================================
// ROGUE
// ==========================================
const ROGUE: BranchDef[] = [
  {
    prefix: 'r_shadow', name: 'Shadow Assassin (Crits)', lanes: [
      { theme: 'Precision', nodes: [
        { name: 'Find Weakness', fx: { critChanceBonus: 0.01 } },
        { name: 'Precision', fx: { critChanceBonus: 0.01 } },
        { name: 'Ambush', fx: { critChanceBonus: 0.03, critDmgBonus: 0.10 } },
        { name: 'Lethality', fx: { critChanceBonus: 0.01 } },
        { name: 'Deadly Aim', fx: { critChanceBonus: 0.04 } },
        { name: "Assassin's Mark", fx: { critChanceBonus: 0.15, critDmgBonus: 0.30 } }
      ]},
      { theme: 'Cruelty', nodes: [
        { name: 'Sharp Blades', fx: { critDmgBonus: 0.05 } },
        { name: 'Vicious Strikes', fx: { critDmgBonus: 0.05 } },
        { name: 'Shadow Sprint', id: 'shadow_sprint', icon: 'boots', note: 'Shadow Dash cooldown is 0.2s shorter and its sprint lasts 1s longer per rank.' },
        { name: 'Hemorrhage', fx: { critDmgBonus: 0.05 } },
        { name: 'Gutting', fx: { critDmgBonus: 0.20 } },
        { name: 'Death Mark', fx: { critDmgBonus: 1.00, hpPct: -0.10 }, note: 'Crits kill; anything that touches you nearly does too.' }
      ]},
      { theme: 'Shadows', nodes: [
        { name: 'Light Feet', fx: { bonusSpeed: 0.04 } },
        { name: 'Shadowstep', fx: { dodgeChance: 0.01 } },
        { name: 'Cutthroat', fx: { dmgPct: 0.05 } },
        { name: 'Nimble', fx: { dodgeChance: 0.01 } },
        { name: 'Vanish', fx: { dodgeChance: 0.03, bonusSpeed: 0.1 } },
        { name: 'Phantom', fx: { dodgeChance: 0.12, bonusSpeed: 0.3 } }
      ]}
    ]
  },
  {
    prefix: 'r_poison', name: 'Venomous Saboteur (Poison)', lanes: [
      { theme: 'Venom', nodes: [
        { name: 'Toxic Coating', fx: { poisonPower: 0.002 }, note: 'Unlocks VENOM: every hit adds a poison stack (max 5), each dealing 2% of your Attack every 0.8s for 4s.' },
        { name: 'Virulence', fx: { poisonPower: 0.002 } },
        { name: 'Venomous Knives', id: 'venomous_knives', icon: 'dagger', note: 'Fan of Knives deals +30% damage and poisons its targets, harder per rank.' },
        { name: 'Lethal Dose', fx: { poisonPower: 0.002 } },
        { name: 'Plague', fx: { poisonPower: 0.008 } },
        { name: 'Plaguebringer', fx: { poisonPower: 0.02 } }
      ]},
      { theme: 'Toxin Craft', nodes: [
        { name: 'Alchemy', fx: { hpPct: 0.03 } },
        { name: 'Antidote Tolerance', fx: { defPct: 0.04 } },
        { name: 'Noxious Cloud', id: 'noxious_cloud', icon: 'poison', note: 'Toxic Bomb covers 0.8 tiles more and its poison deals +4 damage per rank.' },
        { name: 'Hardy', fx: { hpPct: 0.03 } },
        { name: 'Toxic Blood', fx: { thornsPct: 0.10, hpPct: 0.03 } },
        { name: 'Plague Doctor', fx: { hpPct: 0.20, defPct: 0.10, lifeSteal: 0.02 } }
      ]},
      { theme: 'Sabotage', nodes: [
        { name: 'Dirty Fighting', fx: { dmgPct: 0.02 } },
        { name: 'Serrated Blades', fx: { dmgPct: 0.02 } },
        { name: 'Opportunist', fx: { critChanceBonus: 0.03 } },
        { name: 'Exploit', fx: { dmgPct: 0.02 } },
        { name: 'Open Wounds', fx: { dmgPct: 0.05 } },
        { name: 'Saboteur', fx: { dmgPct: 0.15, critDmgBonus: 0.25 } }
      ]}
    ]
  },
  {
    prefix: 'r_wind', name: 'Windrunner Duelist (Speed & Swipe)', lanes: [
      { theme: 'Flurry', nodes: [
        { name: 'Quick Draw', fx: { bonusAttackSpeed: 0.02 } },
        { name: 'Blur', fx: { bonusAttackSpeed: 0.02 } },
        { name: 'Flurry', fx: { bonusAttackSpeed: 0.05 } },
        { name: 'Rapid Strikes', fx: { bonusAttackSpeed: 0.02 } },
        { name: 'Whirling Blades', fx: { bonusAttackSpeed: 0.04, bonusSwipe: 5 } },
        { name: 'Thousand Cuts', fx: { bonusAttackSpeed: 0.25, dmgPct: -0.05 }, note: 'Lighter cuts, many more of them.' }
      ]},
      { theme: 'Wind', nodes: [
        { name: 'Windwalk', fx: { bonusSpeed: 0.04 } },
        { name: 'Evasion', fx: { dodgeChance: 0.01 } },
        { name: 'Tailwind', fx: { bonusSpeed: 0.15 } },
        { name: 'Sidestep', fx: { dodgeChance: 0.01 } },
        { name: 'Riposte', fx: { dodgeChance: 0.03, thornsPct: 0.05 } },
        { name: 'Wind Spirit', fx: { dodgeChance: 0.12, bonusSpeed: 0.4 } }
      ]},
      { theme: 'Sweep', nodes: [
        { name: 'Wide Slashes', fx: { bonusSwipe: 3 } },
        { name: 'Crosscut', fx: { bonusSwipe: 2, dmgPct: 0.01 } },
        { name: 'Momentum', fx: { killHealPercent: 0.02 } },
        { name: 'Arc Mastery', fx: { bonusSwipe: 3 } },
        { name: 'Gale Blades', fx: { bonusSwipe: 8, dmgPct: 0.03 } },
        { name: 'Hurricane', fx: { bonusSwipe: 35, bonusAttackSpeed: 0.05 } }
      ]}
    ]
  }
];

// ==========================================
// DESCRIPTIONS
// ==========================================
const pct = (v: number) => `${v > 0 ? '+' : '-'}${+(Math.abs(v) * 100).toFixed(2)}%`;
const num = (v: number) => `${v > 0 ? '+' : '-'}${+Math.abs(v).toFixed(2)}`;
const STAT_TEXT: Record<string, [string, (v: number) => string]> = {
  dmgPct: ['Damage', pct],
  hpPct: ['Max HP', pct],
  defPct: ['Armor', pct],
  mpPct: ['Max MP', pct],
  bonusAttackSpeed: ['Attack Speed', pct],
  bonusSpeed: ['Move Speed', num],
  bonusSwipe: ['Cleave', v => `${v > 0 ? '+' : '-'}${Math.abs(v)}%`],
  critChanceBonus: ['Crit Chance', pct],
  critDmgBonus: ['Crit Damage', pct],
  dodgeChance: ['Dodge', pct],
  lifeSteal: ['Lifesteal', pct],
  thornsPct: ['of your Armor reflected as Thorns', v => pct(v).replace('+', '')],
  killHealPercent: ['Max HP restored on kill', v => pct(v).replace('+', '')],
  killManaPercent: ['Max MP restored on kill', v => pct(v).replace('+', '')],
  burnPower: ['Ignite damage (of Attack per tick)', pct],
  chillChance: ['Chill chance', pct],
  shatterBonus: ['damage vs chilled', pct],
  echoChance: ['Void Echo chance', pct],
  manaLeech: ['Mana Leech', pct],
  poisonPower: ['Venom damage per stack (of Attack)', pct]
};

function describe(fx: Fx, ranks: number): string {
  const parts = Object.entries(fx).map(([k, v]) => {
    const [label, fmt] = STAT_TEXT[k] || [k, num];
    return `${fmt(v)} ${label}`;
  });
  if (!parts.length) return '';
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return ranks > 1 ? `${list} per rank.` : `${list}.`;
}

// ==========================================
// BUILD + TALENT WEB
// ==========================================
// Lanes form a ring around the origin (3 per branch, 9 per class). Inside a lane every talent
// links to the one above and below it; at T2 and T4 each lane also bridges to its neighbour in
// the ring (across branches too), so you can drift between themes. A talent can be learned when
// it is a starting point (T1) or touches one you already own.
const BRIDGE_TIERS = [2, 4];

function buildClass(branches: BranchDef[]) {
  const tree: any[] = [];
  const lanes: any[][] = [];
  for (const branch of branches) {
    branch.lanes.forEach((lane, li) => {
      const letter = 'abc'[li];
      const col: any[] = [];
      lane.nodes.forEach((n, ti) => {
        const tier = ti + 1;
        const maxRank = TIER_RANKS[ti];
        const kind = TIER_KIND[ti];
        const fx = n.fx || {};
        const stats = describe(fx, maxRank);
        const tag = kind === 'keystone' ? 'KEYSTONE' : kind === 'notable' ? 'NOTABLE' : '';
        const desc = [tag && `${tag}:`, n.note, stats].filter(Boolean).join(' ');
        const t = {
          id: n.id || `${branch.prefix}_${tier}${letter}`,
          branch: branch.name,
          lane: lane.theme,
          tier,
          kind,
          isKeystone: kind === 'keystone',
          isNotable: kind === 'notable',
          name: n.name,
          iconName: n.icon,
          desc,
          maxRank,
          effects: { ...fx },
          start: tier === 1,
          links: [] as string[]
        };
        tree.push(t);
        col.push(t);
      });
      lanes.push(col);
    });
  }
  const link = (x: any, y: any) => {
    if (!x || !y || x === y) return;
    if (!x.links.includes(y.id)) x.links.push(y.id);
    if (!y.links.includes(x.id)) y.links.push(x.id);
  };
  for (const col of lanes) for (let i = 0; i < col.length - 1; i++) link(col[i], col[i + 1]);
  for (const tier of BRIDGE_TIERS) lanes.forEach((col, i) => link(col[tier - 1], lanes[(i + 1) % lanes.length][tier - 1]));
  const ids = new Set(tree.map(t => t.id));
  if (ids.size !== tree.length) throw new Error('talents: duplicate talent id');
  return tree;
}

const SKILL_TREES = {
  warrior: buildClass(WARRIOR),
  mage: buildClass(MAGE),
  rogue: buildClass(ROGUE)
};

// ==========================================
// HIT PROCS
// ==========================================
// The first rank of any talent carrying one of these unlocks it at its base strength; every
// rank (of every talent carrying it) adds on top. GameServer.applyTalentProcs runs them per hit.
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

export { TALENT_PROCS, SKILL_TREES };
export default SKILL_TREES;
module.exports = SKILL_TREES;
// Not enumerable: the trees object is sent to clients and iterated by class
Object.defineProperty(module.exports, 'TALENT_PROCS', { value: TALENT_PROCS });
