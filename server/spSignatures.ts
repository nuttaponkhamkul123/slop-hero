// SP card signatures, passives and skill unlocks.
//
// Signature (ultimate): one per card, on its own hotbar key. It charges from
// combat while transformed (hits, kills, damage taken) and fires when full.
// A signature is a short combo of stages; each stage is an ordinary SP skill
// definition (same shapes and effect fields as SP_SKILLS in spCards.ts, so the
// server runs it with castSpSkill and the client draws it with the card's own
// VFX) fired `delay` seconds after the cast.
//
// Passive: always on while transformed. Fields (all optional):
//   hitProc  { chance, poison (stacks), burn (s), chill (s), frost (stacks),
//              stun (s), zap (x damage to another enemy nearby),
//              haste (s off all cooldowns), echoHit (x damage again 0.6s later) }
//   vs       { burn | poison | chill | frozen : bonus damage vs that status }
//   execute  { below (enemy HP share), dmg }    bonus damage vs low-HP enemies
//   opener   bonus damage vs an enemy at full HP
//   lowHp    { below (your HP share), dmg, def } while you are wounded
//   dmgTaken damage taken multiplier (0.88 = 12% less)
//   reflect  share of melee damage taken thrown back at the attacker
//   hurtShield { chance, share } gain a shield of share x max HP when hit
//   kill     { heal, mana (share of max), nova { r, dmg }, spread (r: poison
//              and burn jump to enemies nearby), cdr (s off all cooldowns),
//              souls (Void Souls) }
//   ultGain  extra signature charge (0.25 = charges 25% faster)
// leech / rebirth are the two older card passives, handled where they were.

const EXTRA_UNLOCK_LEVELS = [5, 10, 15, 20]; // card level that unlocks each extra skill, in arsenal order

const SIGNATURES = {
  // ------------------------------------------------------------------ warrior
  sp_crusader: {
    name: "Heaven's Verdict",
    desc: 'Drag foes into a pillar of judgement, rain six holy swords on them that stun, then a radiant burst heals you for 25% and shields you for 20%.',
    stages: [
      { shape: 'pull', r: 4.5, range: 7, dmg: 1.6 },
      { delay: 0.35, shape: 'rain', r: 3.4, range: 7, n: 6, every: 0.14, hit: 1.6, dmg: 2.2, stun: 0.8 },
      { delay: 1.3, shape: 'nova', r: 3.8, dmg: 2.4, heal: 0.25, shield: 0.2 }
    ]
  },
  sp_berserker: {
    name: 'Crimson Massacre',
    desc: 'Enter a blood frenzy (8s: +50% damage, +0.5 attack speed, Bloodthirst x2), explode in a burning blood nova, then rip a wide crimson cleave.',
    stages: [
      { shape: 'nova', r: 3.8, dmg: 3.2, burn: 3, bloodlust: { dur: 8, rage: 0.5, atkSpeed: 0.5, thirst: 2 } },
      { delay: 0.4, shape: 'cone', range: 5, arc: 170, dmg: 3.4 }
    ]
  },
  sp_frost_templar: {
    name: "Winter's Judgement",
    desc: 'Leap high and drive the hammer down: the landing flash-freezes everything around it, then the glacier beneath them shatters for triple damage on the frozen.',
    stages: [
      { shape: 'jump', range: 7, air: 0.6, r: 4.5, dmg: 2.4, frost: 3, chill: 3 },
      { delay: 1.15, shape: 'nova', r: 5, dmg: 2.6, shatterFrozen: 3 }
    ]
  },
  sp_storm_herald: {
    name: 'Wrath of the Storm',
    desc: 'Become the eye of the storm: five thunder pulses around you, a bolt that forks through ten enemies, and a final thunderclap that stuns.',
    stages: [
      { shape: 'pulse', r: 4.5, n: 5, every: 0.3, dmg: 1.5 },
      { delay: 0.3, shape: 'chain', range: 7, jump: 5, n: 10, decay: 0.95, dmg: 2.4 },
      { delay: 1.6, shape: 'nova', r: 4.5, dmg: 2.6, stun: 1.2 }
    ]
  },
  sp_dread_lord: {
    name: "Executioner's Doom",
    desc: 'Refuse death for 5s, cleave a colossal guillotine line that executes the wounded, then drop a rain of black axes.',
    stages: [
      { shape: 'line', len: 9, width: 2.4, dmg: 4.5, execute: [0.35, 2], undying: 5 },
      { delay: 0.5, shape: 'rain', r: 3.6, range: 7, n: 6, every: 0.14, hit: 1.6, dmg: 2.2 }
    ]
  },
  sp_gravelord: {
    name: 'Worldbreaker',
    desc: 'Smash the target area so hard it cracks the earth and stuns, the shockwave rolls out around you, then the sky drops boulders on the ruin.',
    stages: [
      { shape: 'blast', r: 4.5, range: 7, dmg: 3.6, stun: 1.5, fracture: 3 },
      { delay: 0.5, shape: 'nova', r: 5, dmg: 2.4, knock: 1 },
      { delay: 1.0, shape: 'rain', r: 4, range: 7, n: 5, every: 0.18, hit: 1.8, dmg: 2 }
    ]
  },
  sp_dragoon: {
    name: 'Wrath of the Storm Dragon',
    desc: 'Soar into the thunderheads and crash down on the target, overloading every Lightning Rod and planting a new one; a dozen lightning lances rain round the impact, then the storm dragon roars in a stunning thunder nova.',
    stages: [
      { shape: 'jump', air: 0.6, range: 8, r: 4, dmg: 3.5, stun: 1.0, overload: 1.8, rod: true },
      { delay: 0.7, shape: 'rain', r: 4.5, range: 6, n: 12, every: 0.07, hit: 1.3, dmg: 1.5, stun: 0.2 },
      { delay: 1.7, shape: 'nova', r: 4.5, dmg: 2.8, stun: 1.2 }
    ]
  },
  sp_reaver: {
    name: 'Inferno Engine',
    desc: 'Ignite into an instant Overheat, erupt in a scorching nova that leaves the ground burning, then sweep a wall of flame forward.',
    stages: [
      { shape: 'nova', r: 4.5, dmg: 3, burn: 5, scorch: 3, heat: 100, field: { dur: 5, every: 0.5, r: 3, mult: 0.4 } },
      { delay: 0.45, shape: 'cone', range: 5.5, arc: 120, dmg: 3.2, burn: 4 }
    ]
  },
  sp_runeknight: {
    name: 'Grand Inscription',
    desc: 'Carve a great rune under the target that detonates and stuns; it echoes once more at half strength, then a runic bladewave seals it.',
    stages: [
      { shape: 'blast', r: 4, range: 7, dmg: 3.4, stun: 1, echo: 0.8 },
      { delay: 0.3, shape: 'line', len: 8, width: 1.8, dmg: 3 }
    ]
  },
  sp_sentinel: {
    name: 'Aegis of the King',
    desc: 'Plant your shield: drag every enemy around onto you and stun them, become an iron fortress for 6s (-60% damage) and gain a 40% shield.',
    stages: [
      { shape: 'buff', r: 5, dmg: 2.2, provoke: 0.6, fortress: 6, shield: 0.4 },
      { delay: 0.4, shape: 'nova', r: 4.2, dmg: 2.4, stun: 1.5 }
    ]
  },
  sp_duskblade: {
    name: 'Soulstorm',
    desc: 'Tear three Souls out of everything around you, then devour them all in a burst of spirit that heals you and bursts every Doom brand.',
    stages: [
      { shape: 'nova', r: 5, dmg: 2.4, souls: 3 },
      { delay: 0.7, shape: 'buff', r: 5, dmg: 3, devour: 0.025, reap: true }
    ]
  },
  sp_titan: {
    name: 'Continental Collapse',
    desc: 'Rip the ground toward the target, dragging the whole pack in, crush it under a mountain that stuns, then the aftershock hurls them away.',
    stages: [
      { shape: 'pull', r: 5.5, range: 7, dmg: 2 },
      { delay: 0.5, shape: 'blast', r: 4.5, range: 7, dmg: 4, stun: 2 },
      { delay: 1.0, shape: 'nova', r: 5.5, dmg: 2.5, knock: 1.5 }
    ]
  },
  sp_bannerman: {
    name: "Legion's Standard",
    desc: 'Raise the legion: heal 30%, gain a 25% shield and 6s of battle rage, take 3s off every cooldown, then a volley of spears hits eight enemies.',
    stages: [
      { shape: 'pulse', r: 4, n: 4, every: 0.4, dmg: 1.3, heal: 0.3, shield: 0.25, berserk: 6, haste: 3 },
      { delay: 0.3, shape: 'volley', range: 8, n: 8, dmg: 2.2 }
    ]
  },
  sp_warchief: {
    name: 'Bloodbath Whirlwind',
    desc: 'Fly into a rage and whirl both axes in six spinning pulses that drink blood, then end it with a crushing double cleave.',
    stages: [
      { shape: 'pulse', r: 3.8, n: 6, every: 0.28, dmg: 1.5, leech: 0.12, berserk: 6 },
      { delay: 1.8, shape: 'cone', range: 5, arc: 150, dmg: 4.2 }
    ]
  },
  sp_phoenix_oath: {
    name: 'Ascension',
    desc: 'Rise as the Phoenix: untouchable for 2.5s, heal 35%, your Rebirth is ready again, then a conflagration erupts and fire rains down.',
    stages: [
      { shape: 'nova', r: 5, dmg: 3.5, burn: 5, invuln: 2.5, heal: 0.35, rekindle: true },
      { delay: 0.5, shape: 'rain', r: 4, range: 7, n: 8, every: 0.12, hit: 1.5, dmg: 1.8, burn: 3 }
    ]
  },

  // ------------------------------------------------------------------ mage
  sp_pyromancer: {
    name: 'Armageddon',
    desc: 'Ten meteors pound the target area and leave it scorched, then one last colossal meteor lands on the centre.',
    stages: [
      { shape: 'rain', r: 4.5, range: 7, n: 10, every: 0.14, hit: 1.8, dmg: 2.2, burn: 4, scorch: 2 },
      { delay: 1.7, shape: 'blast', r: 4, range: 7, dmg: 4.5, burn: 5, field: { dur: 4, every: 0.5, r: 3, mult: 0.35 } }
    ]
  },
  sp_cryo_sage: {
    name: 'Eternal Winter',
    desc: 'A blizzard freezes everything near you, a frozen orb pulses five times on the target, and a final ice comet shatters the frozen for 2.5x.',
    stages: [
      { shape: 'nova', r: 5, dmg: 1.8, frost: 3, chill: 3 },
      { delay: 0.3, shape: 'pulse', at: 'target', range: 7, r: 4, n: 5, every: 0.35, dmg: 1.4, chill: 3, frost: 1 },
      { delay: 2.1, shape: 'blast', r: 3.5, range: 7, dmg: 4, shatterFrozen: 2.5 }
    ]
  },
  sp_tempest: {
    name: 'Thunderclap Overload',
    desc: 'Mark ten enemies as Conductors with a storm of bolts, then a delayed thunderclap around you cashes every mark in and stuns.',
    stages: [
      { shape: 'volley', range: 8, n: 10, dmg: 1.4, conduct: 2 },
      { delay: 0.9, shape: 'nova', r: 6, dmg: 3, stun: 1, clap: { delay: 0.6, r: 3, mult: 1.2 } }
    ]
  },
  sp_chronomancer: {
    name: 'Time Stop',
    desc: 'Freeze time on the target area for 4s, take 6s off every cooldown and restore 50% mana; when time resumes, it all catches up at once.',
    stages: [
      { shape: 'blast', r: 5, range: 7, dmg: 1, stasis: 4, haste: 6, mana: 0.5 },
      { delay: 3.6, shape: 'blast', r: 5, range: 7, dmg: 4.6 }
    ]
  },
  sp_void_archon: {
    name: 'Singularity Collapse',
    desc: 'Open a black hole that drags in everything near the target, then collapse it in a void detonation that heals you for part of the damage.',
    stages: [
      { shape: 'pull', r: 6, range: 7, dmg: 2, souls: 2 },
      { delay: 0.8, shape: 'blast', r: 3.6, range: 7, dmg: 5, leech: 0.1 }
    ]
  },

  // ------------------------------------------------------------------ rogue
  sp_nightblade: {
    name: 'Thousand Night Stars',
    desc: 'Vanish into the night for 3s while twelve shuriken seek twelve enemies, then a storm of stars rains on the target area.',
    stages: [
      { shape: 'volley', range: 8, n: 12, dmg: 1.7, smoke: 3 },
      { delay: 0.4, shape: 'rain', r: 4, range: 7, n: 12, every: 0.08, hit: 1.1, dmg: 1.3 }
    ]
  },
  sp_venom_lord: {
    name: "Serpent's Embrace",
    desc: 'A giant serpent coils around the target area, dragging enemies in and soaking them in venom, then bites down in a toxic burst.',
    stages: [
      { shape: 'pull', r: 5, range: 7, dmg: 1.5, poisonStacks: 4, poison: 8 },
      { delay: 0.7, shape: 'blast', r: 4.5, range: 7, dmg: 3.2, poisonStacks: 4, poison: 8 }
    ]
  },
  sp_blade_dancer: {
    name: 'Storm of Blades',
    desc: 'Flash forward, become a whirlwind of eight lightning-fast spins, and take 4s off every cooldown so the dance never stops.',
    stages: [
      { shape: 'blink', len: 7, r: 2.6, dmg: 2.6, haste: 4 },
      { delay: 0.15, shape: 'pulse', r: 3.2, n: 8, every: 0.18, dmg: 1.2 }
    ]
  },
  sp_frost_shade: {
    name: 'Heart Stopper',
    desc: 'Freeze everything around you solid, then a single killing blow that does 2x to frozen enemies and executes the wounded.',
    stages: [
      { shape: 'nova', r: 4.5, dmg: 2, frost: 3, chill: 3 },
      { delay: 0.45, shape: 'strike', range: 6, dmg: 6, execute: [0.4, 2.2], shatterFrozen: 2 }
    ]
  },
  sp_eclipse_reaper: {
    name: 'Black Sun Harvest',
    desc: 'Drop a black sun on the target that burns everything, then reap the scorched pack: drag them in, execute the wounded and drink their life.',
    stages: [
      { shape: 'blast', r: 4.5, range: 7, dmg: 3.2, burn: 4 },
      { delay: 0.8, shape: 'pull', r: 5, range: 7, dmg: 3, execute: [0.35, 2], leech: 0.15 }
    ]
  }
};

const PASSIVES = {
  // ------------------------------------------------------------------ warrior
  sp_crusader: { name: 'Divine Grace', desc: 'Every kill heals 3% max HP; when hit, 15% chance to gain a 6% shield.', kill: { heal: 0.03 }, hurtShield: { chance: 0.15, share: 0.06 } },
  sp_berserker: { name: 'Bloodthirst', desc: 'Basic attacks and Blade Whirl heal 10% of the damage they deal (up to 5% max HP per hit).' },
  sp_frost_templar: { name: 'Rime Hammer', desc: 'Hammer blows have a 30% chance to add a Frost stack (3 stacks freeze); +30% damage to frozen enemies.', hitProc: { chance: 0.3, frost: 1 }, vs: { frozen: 0.3 } },
  sp_storm_herald: { name: 'Overcharge', desc: 'Hits have a 20% chance to arc lightning into another enemy nearby for 80% damage.', hitProc: { chance: 0.2, zap: 0.8 } },
  sp_dread_lord: { name: 'Blood of the Undying', desc: 'Below 50% HP: +35% damage and take 20% less damage.', lowHp: { below: 0.5, dmg: 0.35, def: 0.2 } },
  sp_gravelord: { name: 'Bedrock', desc: 'Take 12% less damage and throw 15% of melee damage taken back at the attacker.', dmgTaken: 0.88, reflect: 0.15 },
  sp_dragoon: { name: 'Storm Rider', desc: 'Hits have a 20% chance to call a lightning bolt down on the target for 70% damage; +25% damage to enemies below 30% HP.', hitProc: { chance: 0.2, skyBolt: 0.7 }, execute: { below: 0.3, dmg: 0.25 } },
  sp_reaver: { name: 'Smoldering Steel', desc: 'Hits have a 30% chance to set enemies on fire; +20% damage to burning enemies.', hitProc: { chance: 0.3, burn: 3 }, vs: { burn: 0.2 } },
  sp_runeknight: { name: 'Runic Echo', desc: 'Hits have a 15% chance to echo 0.6s later for 50% damage.', hitProc: { chance: 0.15, echoHit: 0.5 } },
  sp_sentinel: { name: 'Unbreakable', desc: 'When hit, 25% chance to gain a 7% shield; take 8% less damage.', hurtShield: { chance: 0.25, share: 0.07 }, dmgTaken: 0.92 },
  sp_duskblade: { name: 'Soul Siphon', desc: 'Every kill harvests a Soul and heals 2% max HP.', kill: { souls: 1, heal: 0.02 } },
  sp_titan: { name: 'Colossus', desc: 'Take 15% less damage; hits have a 10% chance to stun for 0.6s.', dmgTaken: 0.85, hitProc: { chance: 0.1, stun: 0.6 } },
  sp_bannerman: { name: 'Banner of Valor', desc: 'Your signature charges 30% faster; every kill restores 4% mana.', ultGain: 0.3, kill: { mana: 0.04 } },
  sp_warchief: { name: 'Axes Fly', desc: 'Every kill bursts into flying axes that hit enemies within 2.5 tiles for 120% damage.', kill: { nova: { r: 2.5, dmg: 1.2 } } },
  sp_phoenix_oath: { name: 'Rebirth', desc: 'On a lethal blow, rise again with 40% HP in a burst of fire (36s cooldown).' },

  // ------------------------------------------------------------------ mage
  sp_pyromancer: { name: 'Ignition', desc: 'Hits have a 30% chance to set enemies on fire; +15% damage to burning enemies.', hitProc: { chance: 0.3, burn: 3 }, vs: { burn: 0.15 } },
  sp_cryo_sage: { name: 'Shatter', desc: '+40% damage to frozen enemies; hits have a 20% chance to chill.', vs: { frozen: 0.4 }, hitProc: { chance: 0.2, chill: 2 } },
  sp_tempest: { name: 'Static Buildup', desc: 'Hits have a 22% chance to arc lightning into another enemy nearby for 110% damage.', hitProc: { chance: 0.22, zap: 1.1 } },
  sp_chronomancer: { name: 'Borrowed Time', desc: 'Every kill takes 0.6s off all your cooldowns.', kill: { cdr: 0.6 } },
  sp_void_archon: { name: 'Event Hunger', desc: 'Every kill collapses into a small void burst (radius 3, 160% damage) and restores 3% mana.', kill: { nova: { r: 3, dmg: 1.6 }, mana: 0.03 } },

  // ------------------------------------------------------------------ rogue
  sp_nightblade: { name: "Assassin's Mark", desc: '+60% damage to enemies at full HP.', opener: 0.6 },
  sp_venom_lord: { name: 'Epidemic', desc: 'Hits have a 35% chance to add 2 poison stacks; on a kill, its poison and fire jump to enemies within 3 tiles.', hitProc: { chance: 0.35, poison: 2 }, kill: { spread: 3 } },
  sp_blade_dancer: { name: 'Perpetual Motion', desc: 'Hits have a 25% chance to take 0.3s off all your cooldowns.', hitProc: { chance: 0.25, haste: 0.3 } },
  sp_frost_shade: { name: 'Cold Blood', desc: '+25% damage to chilled enemies and +50% to enemies below 25% HP.', vs: { chill: 0.25 }, execute: { below: 0.25, dmg: 0.5 } },
  sp_eclipse_reaper: { name: 'Soul Harvest', desc: 'Every kill heals 4% max HP; +40% damage to enemies below 20% HP.', kill: { heal: 0.04 }, execute: { below: 0.2, dmg: 0.4 } }
};

export { SIGNATURES, PASSIVES, EXTRA_UNLOCK_LEVELS };
module.exports = { SIGNATURES, PASSIVES, EXTRA_UNLOCK_LEVELS };
