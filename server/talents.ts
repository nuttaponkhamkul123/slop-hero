// Slop Hero - Passive Tree
//
// One giant passive tree shared by every class, in the style of Path of Exile 2. Each class
// starts at its own spot near the middle (Mage at the top, Rogue bottom-right, Warrior
// bottom-left) and paths outward; any class can walk anywhere.
//
// Every node has ONE rank. A hero earns 1 point per level (about 150 at the cap) and the tree has
// about 1,000 nodes, so a build only covers a small part of it.
//
// Node kinds:
//   travel    small stepping stones on the roads (half a minor's worth of the region's stat)
//   minor     small passives inside clusters
//   notable   named passives: 2-3 stats, or an upgrade to one of your active skills
//   keystone  one per region, at the outer edge: a big effect with a real drawback
//   start     a class's starting point (free, owned by that class only, can't be allocated)
//
// The twelve regions go around the circle; each class owns the three around its start, and the
// three regions between classes are hybrids:
//
//   Arcane (Mage start) · Fire · Void · Venom · Precision (Rogue start) · Evasion
//   Tempest · Brutality · Plate (Warrior start) · Vitality · Retaliation · Frost
//
// Each region (one 30-degree slice) is built from the same skeleton: two spokes that run outward
// and branch at four junctions, four orbit wheels between the spokes (two notables on each), four
// side spurs that end in a notable, and the keystone at the far end. Rings of road join
// neighbouring regions at four radii, so the tree is one connected web.
//
// Stat values (all percentages of your own stats, so a node is worth the same at any level):
//   dmgPct / hpPct / defPct / mpPct   +x% of base + gear (0.04 = +4%)
//   bonusAttackSpeed                  attacks per second (base ~1.0)
//   bonusSpeed                        move speed (base 4.4-5.4)
//   bonusSwipe                        % cleave damage to nearby enemies
//   critChanceBonus / critDmgBonus    crit chance (cap 75%) / extra crit damage
//   dodgeChance (cap 50%), lifeSteal (cap 8%)
//   thornsPct                         reflect x% of your Armor to every enemy that hits you
//   killHealPercent / killManaPercent restore x% of max HP / MP on every kill
//   burnPower, chillChance, shatterBonus, echoChance, manaLeech, poisonPower: hit procs (TALENT_PROCS)
//
// Skill-upgrade notables use the ids the server reads while casting (cyclone_cleave,
// seismic_shatter, sundering_dash, infernal_cataclysm, glacial_tomb, arcane_haste, mana_flow,
// venomous_knives, noxious_cloud, shadow_sprint). They only do something for the class that owns
// that skill; their tooltips say which.

type Fx = Record<string, number>;
interface NotableDef { name: string; fx?: Fx; note?: string; id?: string; icon?: string }
interface KeystoneDef { name: string; fx: Fx; note: string }
interface RegionDef {
  key: string; name: string; color: string; cls?: string;
  travel: Fx[];          // road nodes cycle through these
  minors: Fx[];          // cluster minors cycle through these
  notables: NotableDef[]; // 12: wheels C1..C4 (outer, inner), then spurs S1..S4
  keystone: KeystoneDef;
}

export interface PassiveNode {
  id: string;
  name: string;
  kind: 'start' | 'travel' | 'minor' | 'notable' | 'keystone';
  region: number;
  x: number;
  y: number;
  effects: Fx;
  desc: string;
  links: string[];
  icon?: string;
  cls?: string;
  // kept for older code paths
  maxRank: number;
  isNotable: boolean;
  isKeystone: boolean;
}

// ==========================================
// REGIONS (clockwise from the top)
// ==========================================
const REGIONS: RegionDef[] = [
  {
    key: 'arcane', name: 'Arcane', color: '#8b7cf6', cls: 'mage',
    travel: [{ mpPct: 0.02 }, { dmgPct: 0.012 }],
    minors: [{ mpPct: 0.035 }, { dmgPct: 0.025 }, { mpPct: 0.025, dmgPct: 0.012 }],
    notables: [
      { name: 'Deep Reserves', fx: { mpPct: 0.06, killManaPercent: 0.01 } },
      { name: 'Arcane Focus', fx: { dmgPct: 0.04, critChanceBonus: 0.007 } },
      { name: 'Arcane Haste', id: 'arcane_haste', icon: 'boots', fx: { bonusSpeed: 0.05 }, note: 'Mage: Arcane Blink travels 3 tiles further and its cooldown is 0.5s shorter.' },
      { name: 'Mana Font', fx: { mpPct: 0.05, manaLeech: 0.005 } },
      { name: 'Spell Weaving', fx: { bonusAttackSpeed: 0.035, dmgPct: 0.02 } },
      { name: 'Astral Siphon', fx: { killManaPercent: 0.03, mpPct: 0.03 } },
      { name: 'Overcharge', fx: { dmgPct: 0.04, critDmgBonus: 0.06 } },
      { name: 'Arcane Battery', fx: { mpPct: 0.07, defPct: 0.016 } },
      { name: 'Aegis of the Mind', fx: { mpPct: 0.05, hpPct: 0.02 } },
      { name: 'Archive of Spells', fx: { dmgPct: 0.03, bonusAttackSpeed: 0.02 } },
      { name: 'Resonant Core', fx: { echoChance: 0.008, mpPct: 0.035 } },
      { name: "Sage's Insight", fx: { critChanceBonus: 0.014, dmgPct: 0.025 } }
    ],
    keystone: { name: "Archmage's Vessel", fx: { mpPct: 0.50, dmgPct: 0.15, hpPct: -0.10 }, note: 'Pour your life into an ocean of mana.' }
  },
  {
    key: 'fire', name: 'Fire', color: '#f97316',
    travel: [{ dmgPct: 0.012 }, { burnPower: 0.003 }],
    minors: [{ burnPower: 0.006 }, { dmgPct: 0.025 }, { burnPower: 0.004, dmgPct: 0.012 }],
    notables: [
      { name: 'Kindling', fx: { burnPower: 0.006, dmgPct: 0.02 }, note: 'Any Ignite node unlocks IGNITE: your hits burn enemies for 5% of your Attack every 0.6s for 3s.' },
      { name: 'Searing Heat', fx: { burnPower: 0.009, critChanceBonus: 0.007 } },
      { name: 'Cataclysm', id: 'infernal_cataclysm', icon: 'fire', fx: { burnPower: 0.003 }, note: 'Mage: Firestorm covers 2 tiles more, deals +60% damage and burns 10 harder.' },
      { name: 'Wildfire', fx: { burnPower: 0.007, bonusSwipe: 3 } },
      { name: 'Combustion', fx: { critDmgBonus: 0.09, burnPower: 0.004 } },
      { name: 'Pyromania', fx: { dmgPct: 0.05 } },
      { name: 'Flashpoint', fx: { dmgPct: 0.03, critChanceBonus: 0.01 } },
      { name: 'Heat Surge', fx: { bonusAttackSpeed: 0.03, burnPower: 0.004 } },
      { name: 'Conflagration', fx: { burnPower: 0.012 } },
      { name: 'Fire Ward', fx: { hpPct: 0.025, defPct: 0.02 } },
      { name: 'Blazing Speed', fx: { bonusAttackSpeed: 0.03, bonusSpeed: 0.06 } },
      { name: 'Phoenix Blood', fx: { killHealPercent: 0.015, burnPower: 0.004 } }
    ],
    keystone: { name: 'Living Inferno', fx: { burnPower: 0.10, dmgPct: 0.08, defPct: -0.15 }, note: 'You burn so hot your armor softens.' }
  },
  {
    key: 'void', name: 'Void', color: '#c084fc',
    travel: [{ dmgPct: 0.012 }, { echoChance: 0.004 }],
    minors: [{ echoChance: 0.008 }, { manaLeech: 0.005 }, { dmgPct: 0.02, mpPct: 0.015 }],
    notables: [
      { name: 'Echo of the Void', fx: { echoChance: 0.012 }, note: 'Any Void Echo node unlocks VOID ECHO: a chance per hit to strike again for 60% damage.' },
      { name: 'Mind Leech', fx: { manaLeech: 0.008, mpPct: 0.03 }, note: 'Any Mana Leech node unlocks MANA LEECH: 3% of damage dealt returns as MP.' },
      { name: 'Mana Flow', id: 'mana_flow', icon: 'mp_potion', note: 'Your skills cost 30% less Mana.' },
      { name: 'Resonance', fx: { echoChance: 0.01, critChanceBonus: 0.007 } },
      { name: 'Reverberation', fx: { echoChance: 0.008, bonusAttackSpeed: 0.02 } },
      { name: 'Rift Walker', fx: { bonusSpeed: 0.07, dodgeChance: 0.008 } },
      { name: 'Null Blade', fx: { dmgPct: 0.035, critDmgBonus: 0.05 } },
      { name: 'Hollow Heart', fx: { hpPct: 0.025, manaLeech: 0.004 } },
      { name: 'Rift Echo', fx: { echoChance: 0.016 } },
      { name: 'Event Horizon', fx: { dmgPct: 0.03, echoChance: 0.006 } },
      { name: 'Starless Night', fx: { critChanceBonus: 0.014, dodgeChance: 0.008 } },
      { name: 'Void Siphon', fx: { killManaPercent: 0.02, killHealPercent: 0.01 } }
    ],
    keystone: { name: 'Infinite Echo', fx: { echoChance: 0.15, critChanceBonus: -0.05 }, note: 'Every blow repeats itself, but few of them land true.' }
  },
  {
    key: 'venom', name: 'Venom', color: '#84cc16',
    travel: [{ poisonPower: 0.0008 }, { hpPct: 0.012 }],
    minors: [{ poisonPower: 0.0017 }, { dmgPct: 0.02 }, { poisonPower: 0.0014, bonusAttackSpeed: 0.01 }],
    notables: [
      { name: 'Toxic Coating', fx: { poisonPower: 0.002 }, note: 'Any Venom node unlocks VENOM: every hit adds a poison stack (max 5), each dealing 2% of your Attack every 0.8s for 4s.' },
      { name: 'Virulence', fx: { poisonPower: 0.003 } },
      { name: 'Venomous Knives', id: 'venomous_knives', icon: 'dagger', fx: { poisonPower: 0.0007 }, note: 'Rogue: Fan of Knives deals +60% damage and poisons its targets.' },
      { name: 'Noxious Cloud', id: 'noxious_cloud', icon: 'poison', fx: { poisonPower: 0.0007 }, note: 'Rogue: Toxic Bomb covers 1.6 tiles more and its poison deals +8 damage.' },
      { name: 'Lethal Dose', fx: { poisonPower: 0.002, critChanceBonus: 0.007 } },
      { name: 'Antidote Tolerance', fx: { hpPct: 0.03, defPct: 0.016 } },
      { name: 'Plague', fx: { poisonPower: 0.003, bonusSwipe: 3 } },
      { name: 'Toxic Blood', fx: { thornsPct: 0.07, hpPct: 0.02 } },
      { name: 'Serrated Blades', fx: { dmgPct: 0.03, poisonPower: 0.0014 } },
      { name: 'Alchemist', fx: { killHealPercent: 0.015, hpPct: 0.015 } },
      { name: 'Creeping Death', fx: { poisonPower: 0.002, bonusAttackSpeed: 0.02 } },
      { name: 'Open Wounds', fx: { dmgPct: 0.025, critDmgBonus: 0.05 } }
    ],
    keystone: { name: 'Plaguebringer', fx: { poisonPower: 0.025, critDmgBonus: -0.30 }, note: 'Your blades are coated, not sharpened.' }
  },
  {
    key: 'precision', name: 'Precision', color: '#facc15', cls: 'rogue',
    travel: [{ critChanceBonus: 0.006 }, { dmgPct: 0.012 }],
    minors: [{ critChanceBonus: 0.01 }, { critDmgBonus: 0.045 }, { dmgPct: 0.025 }],
    notables: [
      { name: 'Find Weakness', fx: { critChanceBonus: 0.017 } },
      { name: 'Ambush', fx: { critChanceBonus: 0.014, critDmgBonus: 0.06 } },
      { name: 'Killer Instinct', fx: { critChanceBonus: 0.02 } },
      { name: 'Deadly Aim', fx: { critDmgBonus: 0.09, critChanceBonus: 0.007 } },
      { name: 'Lethality', fx: { dmgPct: 0.03, critChanceBonus: 0.01 } },
      { name: 'Cutthroat', fx: { dmgPct: 0.04, critDmgBonus: 0.03 } },
      { name: 'Exploit Weakness', fx: { critChanceBonus: 0.014, bonusAttackSpeed: 0.02 } },
      { name: 'Marked for Death', fx: { critDmgBonus: 0.12 } },
      { name: 'Keen Eye', fx: { critChanceBonus: 0.014, bonusSpeed: 0.04 } },
      { name: 'Opportunist', fx: { dmgPct: 0.025, killHealPercent: 0.01 } },
      { name: 'Twist the Knife', fx: { critDmgBonus: 0.07, lifeSteal: 0.0015 } },
      { name: 'Cold Precision', fx: { critChanceBonus: 0.017, dmgPct: 0.015 } }
    ],
    keystone: { name: "Assassin's Mark", fx: { critChanceBonus: 0.15, critDmgBonus: 0.30, hpPct: -0.10 }, note: 'Strike first, strike true, and never get hit.' }
  },
  {
    key: 'evasion', name: 'Evasion', color: '#2dd4bf',
    travel: [{ dodgeChance: 0.004 }, { bonusSpeed: 0.03 }],
    minors: [{ dodgeChance: 0.008 }, { bonusSpeed: 0.05 }, { dodgeChance: 0.005, bonusAttackSpeed: 0.01 }],
    notables: [
      { name: 'Light Feet', fx: { bonusSpeed: 0.07, dodgeChance: 0.008 } },
      { name: 'Shadowstep', fx: { dodgeChance: 0.015 } },
      { name: 'Shadow Sprint', id: 'shadow_sprint', icon: 'boots', fx: { bonusSpeed: 0.03 }, note: 'Rogue: Shadow Dash cooldown is 0.4s shorter and its sprint lasts 2s longer.' },
      { name: 'Nimble', fx: { dodgeChance: 0.011, bonusAttackSpeed: 0.02 } },
      { name: 'Vanish', fx: { dodgeChance: 0.015, bonusSpeed: 0.05 } },
      { name: 'Acrobatics', fx: { dodgeChance: 0.015, defPct: 0.012 } },
      { name: 'Windwalk', fx: { bonusSpeed: 0.1 } },
      { name: 'Riposte', fx: { dodgeChance: 0.008, thornsPct: 0.07 } },
      { name: 'Sidestep', fx: { dodgeChance: 0.011, critChanceBonus: 0.007 } },
      { name: 'Fleet Footed', fx: { bonusSpeed: 0.06, bonusAttackSpeed: 0.02 } },
      { name: 'Smoke Screen', fx: { dodgeChance: 0.015, hpPct: 0.015 } },
      { name: 'Elusive', fx: { dodgeChance: 0.011, killHealPercent: 0.01 } }
    ],
    keystone: { name: 'Phantom', fx: { dodgeChance: 0.12, bonusSpeed: 0.30, defPct: -0.30 }, note: 'Nothing touches you, so you stop wearing anything heavy.' }
  },
  {
    key: 'tempest', name: 'Tempest', color: '#38bdf8',
    travel: [{ bonusAttackSpeed: 0.014 }, { bonusSwipe: 2 }],
    minors: [{ bonusAttackSpeed: 0.03 }, { bonusSwipe: 4 }, { bonusAttackSpeed: 0.014, bonusSwipe: 2 }],
    notables: [
      { name: 'Quick Hands', fx: { bonusAttackSpeed: 0.035 } },
      { name: 'Wide Swings', fx: { bonusSwipe: 6, dmgPct: 0.01 } },
      { name: 'Cyclone', id: 'cyclone_cleave', icon: 'whirl', fx: { bonusSwipe: 2 }, note: 'Warrior: Whirlwind reaches 1.2 tiles further and deals +50% damage.' },
      { name: 'Flurry', fx: { bonusAttackSpeed: 0.035, critChanceBonus: 0.007 } },
      { name: 'Battle Rhythm', fx: { bonusAttackSpeed: 0.03, bonusSpeed: 0.04 } },
      { name: 'Reaping Arc', fx: { bonusSwipe: 7 } },
      { name: 'Follow-Through', fx: { bonusSwipe: 4, bonusAttackSpeed: 0.014 } },
      { name: 'Whirling Blades', fx: { bonusAttackSpeed: 0.02, bonusSwipe: 4 } },
      { name: 'Blur', fx: { bonusAttackSpeed: 0.03, dodgeChance: 0.008 } },
      { name: 'Gale Blades', fx: { bonusSwipe: 6, dmgPct: 0.015 } },
      { name: 'Momentum', fx: { killHealPercent: 0.01, bonusAttackSpeed: 0.02 } },
      { name: 'Relentless', fx: { bonusAttackSpeed: 0.04 } }
    ],
    keystone: { name: 'Thousand Cuts', fx: { bonusAttackSpeed: 0.25, bonusSwipe: 20, dmgPct: -0.10 }, note: 'Lighter cuts, many more of them.' }
  },
  {
    key: 'brutality', name: 'Brutality', color: '#ef4444',
    travel: [{ dmgPct: 0.012 }, { critDmgBonus: 0.025 }],
    minors: [{ dmgPct: 0.025 }, { critDmgBonus: 0.045 }, { dmgPct: 0.012, critChanceBonus: 0.006 }],
    notables: [
      { name: 'Heavy Blows', fx: { dmgPct: 0.04 } },
      { name: 'Executioner', fx: { critDmgBonus: 0.09, dmgPct: 0.015 } },
      { name: 'Sundering Charge', id: 'sundering_dash', icon: 'boots', fx: { dmgPct: 0.01 }, note: 'Warrior: Blade Charge deals +50% damage and its cooldown is 0.4s shorter.' },
      { name: 'Bone Breaker', fx: { critDmgBonus: 0.07, critChanceBonus: 0.007 } },
      { name: 'Weapon Training', fx: { dmgPct: 0.03, bonusAttackSpeed: 0.014 } },
      { name: 'Devastate', fx: { critDmgBonus: 0.12 } },
      { name: 'Battle Trance', fx: { critChanceBonus: 0.014, bonusAttackSpeed: 0.02 } },
      { name: 'Master-at-Arms', fx: { dmgPct: 0.035, critChanceBonus: 0.007 } },
      { name: 'Brute Force', fx: { dmgPct: 0.03, hpPct: 0.015 } },
      { name: 'Crushing Blows', fx: { critDmgBonus: 0.06, bonusSwipe: 3 } },
      { name: 'Bloodthirst', fx: { lifeSteal: 0.002, dmgPct: 0.015 } },
      { name: 'War Veteran', fx: { dmgPct: 0.025, defPct: 0.016 } }
    ],
    keystone: { name: 'Annihilator', fx: { critDmgBonus: 1.00, critChanceBonus: -0.05 }, note: 'Fewer crits, but each one is a finisher.' }
  },
  {
    key: 'plate', name: 'Plate', color: '#94a3b8', cls: 'warrior',
    travel: [{ defPct: 0.012 }, { hpPct: 0.012 }],
    minors: [{ defPct: 0.025 }, { hpPct: 0.025 }, { defPct: 0.016, hpPct: 0.012 }],
    notables: [
      { name: 'Iron Skin', fx: { defPct: 0.04 } },
      { name: 'Tempered Plate', fx: { defPct: 0.03, hpPct: 0.015 } },
      { name: 'Seismic Shatter', id: 'seismic_shatter', icon: 'hammer', fx: { defPct: 0.012 }, note: 'Warrior: Earthshaker deals +60% damage and its slow lasts 3s longer.' },
      { name: 'Unbreakable', fx: { defPct: 0.04, hpPct: 0.02 } },
      { name: 'Bulwark', fx: { defPct: 0.03, thornsPct: 0.035 } },
      { name: 'Shield Wall', fx: { defPct: 0.05 } },
      { name: 'Steel Resolve', fx: { hpPct: 0.03, defPct: 0.02 } },
      { name: 'Juggernaut', fx: { defPct: 0.03, dmgPct: 0.015 } },
      { name: 'Stalwart', fx: { defPct: 0.025, killHealPercent: 0.01 } },
      { name: 'Iron Will', fx: { hpPct: 0.025, mpPct: 0.03 } },
      { name: 'Reinforced', fx: { defPct: 0.035, lifeSteal: 0.0005 } },
      { name: 'Unyielding', fx: { hpPct: 0.04 } }
    ],
    keystone: { name: 'Living Fortress', fx: { defPct: 0.40, hpPct: 0.10, bonusSpeed: -0.40 }, note: 'Nothing gets through, but you move like a wall.' }
  },
  {
    key: 'vitality', name: 'Vitality', color: '#f472b6',
    travel: [{ hpPct: 0.012 }, { lifeSteal: 0.001 }],
    minors: [{ hpPct: 0.025 }, { lifeSteal: 0.0015 }, { hpPct: 0.015, dmgPct: 0.01 }],
    notables: [
      { name: 'Thick Hide', fx: { hpPct: 0.04 } },
      { name: 'Second Wind', fx: { killHealPercent: 0.02 } },
      { name: 'Hearty', fx: { hpPct: 0.03, defPct: 0.012 } },
      { name: "Giant's Blood", fx: { hpPct: 0.05 } },
      { name: 'Bloodbound', fx: { hpPct: 0.025, lifeSteal: 0.002 } },
      { name: 'Sanguine', fx: { lifeSteal: 0.003 } },
      { name: 'Carnage', fx: { killHealPercent: 0.015, dmgPct: 0.02 } },
      { name: 'Battle Hunger', fx: { lifeSteal: 0.0015, bonusAttackSpeed: 0.02 } },
      { name: 'Troll Blood', fx: { hpPct: 0.035, killHealPercent: 0.01 } },
      { name: 'Crimson Tide', fx: { lifeSteal: 0.002, critDmgBonus: 0.05 } },
      { name: 'Vigor', fx: { hpPct: 0.025, bonusSpeed: 0.04 } },
      { name: 'Red Mist', fx: { dmgPct: 0.03, lifeSteal: 0.0015 } }
    ],
    keystone: { name: 'Blood God', fx: { lifeSteal: 0.03, hpPct: 0.15, killHealPercent: 0.02, defPct: -0.15 }, note: 'You heal through anything, so you stop blocking it.' }
  },
  {
    key: 'retaliation', name: 'Retaliation', color: '#a16207',
    travel: [{ thornsPct: 0.03 }, { defPct: 0.012 }],
    minors: [{ thornsPct: 0.05 }, { defPct: 0.02, mpPct: 0.015 }, { thornsPct: 0.03, hpPct: 0.012 }],
    notables: [
      { name: 'Spiked Plates', fx: { thornsPct: 0.085 } },
      { name: 'Barbed Mail', fx: { thornsPct: 0.055, defPct: 0.016 } },
      { name: 'Runic Ward', fx: { mpPct: 0.05, defPct: 0.02 } },
      { name: 'Retaliation', fx: { thornsPct: 0.07, hpPct: 0.015 } },
      { name: 'Vengeful Spikes', fx: { thornsPct: 0.105 } },
      { name: 'Spellforged Plate', fx: { defPct: 0.03, mpPct: 0.035 } },
      { name: 'Arcane Thorns', fx: { thornsPct: 0.055, mpPct: 0.03 } },
      { name: 'Blood for Blood', fx: { thornsPct: 0.055, lifeSteal: 0.0015 } },
      { name: 'Bastion', fx: { defPct: 0.04, hpPct: 0.015 } },
      { name: 'Punishment', fx: { thornsPct: 0.07, dmgPct: 0.015 } },
      { name: 'Iron Conduit', fx: { mpPct: 0.05, killManaPercent: 0.01 } },
      { name: 'Spite', fx: { thornsPct: 0.085, critChanceBonus: 0.003 } }
    ],
    keystone: { name: 'Iron Maiden', fx: { thornsPct: 0.80, defPct: 0.15, dmgPct: -0.15 }, note: 'You barely swing back. You do not need to.' }
  },
  {
    key: 'frost', name: 'Frost', color: '#7dd3fc',
    travel: [{ chillChance: 0.008 }, { defPct: 0.012 }],
    minors: [{ chillChance: 0.016 }, { shatterBonus: 0.02 }, { defPct: 0.016, hpPct: 0.012 }],
    notables: [
      { name: 'Cold Touch', fx: { chillChance: 0.025 }, note: 'Any Frostbite node unlocks FROSTBITE: a 15% chance per hit to chill (slow) the enemy for 2.5s.' },
      { name: 'Brittle', fx: { shatterBonus: 0.03 }, note: 'Any Shatter node unlocks SHATTER: chilled enemies take +10% damage from you.' },
      { name: 'Glacial Tomb', id: 'glacial_tomb', icon: 'snow', fx: { chillChance: 0.008 }, note: 'Mage: Frost Nova deals +50% damage and its chill lasts 3s longer.' },
      { name: 'Deep Freeze', fx: { chillChance: 0.03 } },
      { name: 'Ice Shards', fx: { shatterBonus: 0.04, critChanceBonus: 0.007 } },
      { name: 'Frost Shroud', fx: { defPct: 0.03, hpPct: 0.015 } },
      { name: 'Permafrost', fx: { chillChance: 0.025, shatterBonus: 0.025 } },
      { name: 'Frozen Heart', fx: { hpPct: 0.03, defPct: 0.025 } },
      { name: 'Splinter', fx: { critDmgBonus: 0.06, shatterBonus: 0.016 } },
      { name: 'Hypothermia', fx: { chillChance: 0.016, bonusAttackSpeed: 0.02 } },
      { name: 'Ice Barrier', fx: { defPct: 0.04 } },
      { name: 'Shatterpoint', fx: { shatterBonus: 0.05 } }
    ],
    keystone: { name: 'Absolute Zero', fx: { shatterBonus: 0.25, chillChance: 0.10, bonusAttackSpeed: -0.10 }, note: 'The cold slows everything, you included.' }
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
  chillChance: ['Frostbite chance', pct],
  shatterBonus: ['damage vs chilled', pct],
  echoChance: ['Void Echo chance', pct],
  manaLeech: ['Mana Leech', pct],
  poisonPower: ['Venom damage per stack (of Attack)', pct]
};
// Short names for small nodes, from their first stat
const STAT_NAME: Record<string, string> = {
  dmgPct: 'Damage', hpPct: 'Life', defPct: 'Armor', mpPct: 'Mana', bonusAttackSpeed: 'Attack Speed',
  bonusSpeed: 'Swiftness', bonusSwipe: 'Cleave', critChanceBonus: 'Critical Chance', critDmgBonus: 'Critical Damage',
  dodgeChance: 'Evasion', lifeSteal: 'Life Leech', thornsPct: 'Thorns', killHealPercent: 'Recovery',
  killManaPercent: 'Mana Recovery', burnPower: 'Ignite', chillChance: 'Frostbite', shatterBonus: 'Shatter',
  echoChance: 'Void Echo', manaLeech: 'Mana Leech', poisonPower: 'Venom'
};

function describe(fx: Fx): string {
  const parts = Object.entries(fx).map(([k, v]) => {
    const [label, fmt] = STAT_TEXT[k] || [k, num];
    return `${fmt(v)} ${label}`;
  });
  if (!parts.length) return '';
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `${list}.`;
}

// ==========================================
// LAYOUT
// ==========================================
// World units; the client draws 1 unit = 1 px at zoom 1. Angles are in degrees, screen style
// (0 = right, 90 = down), so the Mage region at -90 sits at the top.
const DEG = Math.PI / 180;
const SPACING = 135;                 // target distance between nodes on a road
const START_R = 250;
const RING = { gate: 480, j1: 880, j2: 1320, j3: 1780, j4: 2240, key: 3150 };
const CLASS_START: Record<string, number> = { mage: 0, rogue: 4, warrior: 8 }; // region index

type Pt = { x: number; y: number };
const polar = (deg: number, r: number): Pt => ({ x: Math.cos(deg * DEG) * r, y: Math.sin(deg * DEG) * r });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

const nodes: PassiveNode[] = [];
// Edges for drawing: [a, b] straight, or [a, b, cx, cy] an arc around (cx, cy)
const edges: [string, string, number?, number?][] = [];
let seq = 0;
const travelTurn: number[] = REGIONS.map(() => 0);
const minorTurn: number[] = REGIONS.map(() => 0);

function makeNode(kind: PassiveNode['kind'], region: number, p: Pt, name: string, fx: Fx, extra: Partial<PassiveNode> = {}): PassiveNode {
  const n: PassiveNode = {
    id: extra.id || `p${++seq}`,
    name,
    kind,
    region,
    x: Math.round(p.x),
    y: Math.round(p.y),
    effects: { ...fx },
    desc: '',
    links: [],
    maxRank: 1,
    isNotable: kind === 'notable',
    isKeystone: kind === 'keystone'
  };
  if (extra.icon) n.icon = extra.icon;
  if (extra.cls) n.cls = extra.cls;
  const tag = kind === 'keystone' ? 'KEYSTONE:' : kind === 'notable' ? 'NOTABLE:' : '';
  n.desc = [tag, extra.desc, describe(fx)].filter(Boolean).join(' ');
  nodes.push(n);
  return n;
}
const nameOf = (fx: Fx) => STAT_NAME[Object.keys(fx)[0]] || 'Passive';
function travelNode(region: number, p: Pt) {
  const pool = REGIONS[region].travel;
  const fx = pool[travelTurn[region]++ % pool.length];
  return makeNode('travel', region, p, nameOf(fx), fx);
}
function minorNode(region: number, p: Pt) {
  const pool = REGIONS[region].minors;
  const fx = pool[minorTurn[region]++ % pool.length];
  return makeNode('minor', region, p, nameOf(fx), fx);
}
function notableNode(region: number, p: Pt, def: NotableDef) {
  return makeNode('notable', region, p, def.name, def.fx || {}, { id: def.id, icon: def.icon, desc: def.note });
}

function link(a: PassiveNode, b: PassiveNode, arc?: Pt) {
  if (a === b || a.links.includes(b.id)) return;
  a.links.push(b.id);
  b.links.push(a.id);
  edges.push(arc ? [a.id, b.id, Math.round(arc.x), Math.round(arc.y)] : [a.id, b.id]);
}

// A straight road of travel nodes from a to b
function road(a: PassiveNode, b: PassiveNode, region: number) {
  const n = Math.max(0, Math.round(dist(a, b) / SPACING) - 1);
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const node = travelNode(region, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    link(prev, node);
    prev = node;
  }
  link(prev, b);
}

// A road that follows the orbit around the tree centre from a to b (same radius)
function orbit(a: PassiveNode, b: PassiveNode, region: number) {
  const ra = Math.hypot(a.x, a.y), rb = Math.hypot(b.x, b.y);
  const aa = Math.atan2(a.y, a.x);
  let da = Math.atan2(b.y, b.x) - aa;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const len = Math.abs(da) * (ra + rb) / 2;
  const n = Math.max(0, Math.round(len / SPACING) - 1);
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const r = ra + (rb - ra) * t, ang = aa + da * t;
    const node = travelNode(region, { x: Math.cos(ang) * r, y: Math.sin(ang) * r });
    link(prev, node, { x: 0, y: 0 });
    prev = node;
  }
  link(prev, b, { x: 0, y: 0 });
}

// An orbit wheel: `count` nodes on a circle around `c`, the outermost and innermost are notables,
// the rest minors; each entry node gets a road to the nearest wheel node.
function wheel(region: number, c: Pt, radius: number, count: number, outward: number, notables: NotableDef[], entries: PassiveNode[]) {
  const ring: PassiveNode[] = [];
  for (let i = 0; i < count; i++) {
    const ang = outward + (i * 360) / count;
    const p = { x: c.x + Math.cos(ang * DEG) * radius, y: c.y + Math.sin(ang * DEG) * radius };
    if (i === 0) ring.push(notableNode(region, p, notables[0]));
    else if (i === count / 2) ring.push(notableNode(region, p, notables[1]));
    else ring.push(minorNode(region, p));
  }
  for (let i = 0; i < count; i++) link(ring[i], ring[(i + 1) % count], c);
  for (const e of entries) {
    let best = ring[1], bd = Infinity;
    for (const w of ring) {
      if (w.kind === 'notable') continue;
      const d = dist(e, w);
      if (d < bd) { bd = d; best = w; }
    }
    road(e, best, region);
  }
  return ring;
}

// A spur: `from` -> a few minors -> notable at `to`
function spur(region: number, from: PassiveNode, to: Pt, minors: number, def: NotableDef) {
  let prev = from;
  for (let i = 1; i <= minors; i++) {
    const t = i / (minors + 1);
    const m = minorNode(region, { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
    link(prev, m);
    prev = m;
  }
  const n = notableNode(region, to, def);
  link(prev, n);
  return n;
}

function buildTree() {
  const gates: PassiveNode[] = [], j1: PassiveNode[][] = [], j3: PassiveNode[][] = [], j4: PassiveNode[][] = [];
  REGIONS.forEach((reg, ri) => {
    const th = -90 + ri * 30;
    const P = (d: number, r: number) => polar(th + d, r);
    const junction = (d: number, r: number) => travelNode(ri, P(d, r));
    const N = reg.notables;

    const g = junction(0, RING.gate);
    const jl1 = junction(-8, RING.j1), jr1 = junction(8, RING.j1);
    const jl2 = junction(-9, RING.j2), jr2 = junction(9, RING.j2);
    const jl3 = junction(-9, RING.j3), jr3 = junction(9, RING.j3);
    const jl4 = junction(-8, RING.j4), jr4 = junction(8, RING.j4);
    gates.push(g); j1.push([jl1, jr1]); j3.push([jl3, jr3]); j4.push([jl4, jr4]);

    // the two spokes
    road(g, jl1, ri); road(g, jr1, ri);
    road(jl1, jl2, ri); road(jr1, jr2, ri);
    road(jl2, jl3, ri); road(jr2, jr3, ri);
    road(jl3, jl4, ri); road(jr3, jr4, ri);

    // wheels between the spokes
    wheel(ri, P(0, 1100), 90, 6, th, [N[0], N[1]], [jl1, jr1]);
    wheel(ri, P(0, 1560), 110, 6, th, [N[2], N[3]], [jl2, jr2]);
    wheel(ri, P(0, 2010), 125, 8, th, [N[4], N[5]], [jl3, jr3]);
    const top = wheel(ri, P(0, 2640), 130, 8, th, [N[6], N[7]], [jl4, jr4]);

    // spurs off the outside of the spokes
    spur(ri, jl2, P(-12.5, 1620), 2, N[8]);
    spur(ri, jr2, P(12.5, 1620), 2, N[9]);
    spur(ri, jl4, P(-12, 2640), 2, N[10]);
    spur(ri, jr4, P(12, 2640), 2, N[11]);

    // the keystone past the last wheel
    const k = makeNode('keystone', ri, P(0, RING.key), reg.keystone.name, reg.keystone.fx, { desc: reg.keystone.note, icon: 'crown' });
    road(top[0], k, ri);
  });

  // rings joining neighbouring regions
  const R = REGIONS.length;
  for (let i = 0; i < R; i++) {
    const j = (i + 1) % R;
    orbit(gates[i], gates[j], i);
    orbit(j1[i][1], j1[j][0], i);
    orbit(j3[i][1], j3[j][0], j);
    orbit(j4[i][1], j4[j][0], i);
  }

  // class starts: linked to their own gate and both neighbouring gates
  for (const [cls, ri] of Object.entries(CLASS_START)) {
    const th = -90 + ri * 30;
    const s = makeNode('start', ri, polar(th, START_R), cls.toUpperCase(), {}, { id: `start_${cls}`, cls });
    s.desc = `The ${cls[0].toUpperCase() + cls.slice(1)}'s starting point.`;
    link(s, gates[ri]);
    road(s, gates[(ri + R - 1) % R], ri);
    road(s, gates[(ri + 1) % R], ri);
  }

  const ids = new Set(nodes.map(n => n.id));
  if (ids.size !== nodes.length) throw new Error('talents: duplicate passive id');
}
buildTree();

const BY_ID = new Map<string, PassiveNode>(nodes.map(n => [n.id, n]));
const START_OF: Record<string, string> = Object.fromEntries(Object.keys(CLASS_START).map(c => [c, `start_${c}`]));

// ==========================================
// RULES
// ==========================================
const owns = (skills: Record<string, number>, id: string) => (skills && skills[id] || 0) > 0;

// A node can be allocated when it touches your class start or a node you own
function canAllocate(cls: string, skills: Record<string, number>, id: string): boolean {
  const n = BY_ID.get(id);
  if (!n || n.kind === 'start' || owns(skills, id)) return false;
  const start = START_OF[cls];
  return n.links.some(l => l === start || owns(skills, l));
}

// Every owned node must exist, be allocatable, have rank 1 and be connected to the class start
function isValidAllocation(cls: string, skills: Record<string, number>): boolean {
  const start = START_OF[cls];
  if (!start) return Object.keys(skills || {}).length === 0;
  const owned = Object.keys(skills || {});
  for (const id of owned) {
    const n = BY_ID.get(id);
    if (!n || n.kind === 'start' || skills[id] !== 1) return false;
  }
  const seen = new Set<string>();
  const queue = BY_ID.get(start)!.links.filter(l => owns(skills, l));
  for (const id of queue) seen.add(id);
  while (queue.length) {
    const id = queue.pop()!;
    for (const l of BY_ID.get(id)!.links) {
      if (!seen.has(l) && owns(skills, l)) { seen.add(l); queue.push(l); }
    }
  }
  return seen.size === owned.length;
}

// Removing `id` keeps the rest connected
function canRefund(cls: string, skills: Record<string, number>, id: string): boolean {
  if (!owns(skills, id)) return false;
  const rest = { ...skills };
  delete rest[id];
  return isValidAllocation(cls, rest);
}

// ==========================================
// HIT PROCS
// ==========================================
// The first node carrying one of these unlocks it at its base strength; every node carrying it
// adds on top. GameServer.applyTalentProcs runs them per hit.
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

// What the client needs to draw the tree (sent once on join)
const CLIENT_TREE = {
  nodes: nodes.map(n => {
    const o: any = { id: n.id, name: n.name, kind: n.kind, region: n.region, x: n.x, y: n.y, desc: n.desc, effects: n.effects, links: n.links };
    if (n.icon) o.icon = n.icon;
    if (n.cls) o.cls = n.cls;
    return o;
  }),
  edges,
  regions: REGIONS.map((r, i) => ({ key: r.key, name: r.name, color: r.color, cls: r.cls || null, angle: -90 + i * 30 })),
  starts: START_OF,
  radius: RING.key + 200
};

const PASSIVE_TREE = { nodes, byId: BY_ID, starts: START_OF, canAllocate, canRefund, isValidAllocation, client: CLIENT_TREE };

export { TALENT_PROCS, PASSIVE_TREE, BY_ID, canAllocate, canRefund, isValidAllocation, CLIENT_TREE };
module.exports = { TALENT_PROCS, PASSIVE_TREE, BY_ID, canAllocate, canRefund, isValidAllocation, CLIENT_TREE };
