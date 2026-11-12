// Derived hero stats: recalculating everything from base stats, gear, runes, sets, passives and cards; the regen multiplier; rune counts; the cosmetic trail.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import { isRangedClass } from '../data/heroClasses';
import { ITEMS, weaponPower, ensureSockets, ARMOR_SOCKET_SLOTS, ARMOR_SETS, equippedSetCounts } from '../items';
import { masteryMult } from '../progression';
import * as SP from '../spCards';
import * as ATTR from '../itemAttributes';
import { TRAIL_IDS, MANA_COST_SCALE, MANA_COST_PER_LEVEL, MANA_REGEN_PCT, MANA_REGEN_FLAT, HP_REGEN_PCT, MAX_PLAYER_ELEMENT_RESIST, ENERGY_SHIELD } from '../config/constants';
const PASSIVES = require('../talents');
const TALENT_PROCS = PASSIVES.TALENT_PROCS;

export class StatsSystem {
  constructor(private readonly gs: GameServer) {}

  // Cosmetic only: which trail the hero wears. Anything outside the whitelist clears it.
  handleSetEffects(socketId: string, data: any) {
    const player: any = this.gs.players.get(socketId);
    if (!player) return;
    const trail = data && typeof data.trail === 'string' && TRAIL_IDS.has(data.trail) ? data.trail : null;
    player.effects = { ...(player.effects || {}), trail };
  }

  // Multiplier on natural HP regen: Wayfarer 2-piece and Renewal runes
  hpRegenMult(player) {
    return ((player.set2 && player.set2.wayfarer && player.set2.wayfarer.regenMult) || 1)
      * (1 + 0.35 * ((player.armorRunes && player.armorRunes.renewal) || 0));
  }

  recalculatePlayerStats(player) {
    if (!player || !player.baseStats) return;

    let totalBonusDmg = 0;
    let totalBonusDef = 0;
    let totalBonusHp = 0;
    let totalBonusMp = 0;
    let totalBonusSpeed = 0;
    let totalBonusAttackSpeed = 0;
    let totalBonusSwipe = 0;
    let totalCritChanceBonus = 0;
    let totalCritDmgBonus = 0;
    let totalThorns = 0;
    let totalDodgeChance = 0;
    let totalLifeSteal = 0;
    // talent percentages of (base + gear): damage, HP, armor, MP, and thorns as a share of armor
    const talentPct = { dmgPct: 0, hpPct: 0, defPct: 0, mpPct: 0, thornsPct: 0 };
    const totalElementResist: Record<string, number> = {};
    this.gs.refundStaleTalents(player);

    if (player.equipment) {
      for (const eq of Object.values(player.equipment) as any[]) ensureSockets(eq);
      for (const eq of (Object.values(player.equipment) as any[])) {
        if (!eq) continue;
        if (eq.elementResist) {
          for (const [el, val] of Object.entries(eq.elementResist)) {
            totalElementResist[el] = (totalElementResist[el] || 0) + (val as number);
          }
        }
        if (eq.bonusDmg) totalBonusDmg += eq.bonusDmg;
        if (eq.bonusDef) totalBonusDef += eq.bonusDef;
        if (eq.bonusHp) totalBonusHp += eq.bonusHp;
        if (eq.bonusMp) totalBonusMp += eq.bonusMp;
        if (eq.bonusSpeed) totalBonusSpeed += eq.bonusSpeed;
        if (eq.bonusAttackSpeed) totalBonusAttackSpeed += eq.bonusAttackSpeed;
        if (eq.bonusSwipe) totalBonusSwipe += eq.bonusSwipe;
        if (eq.critChance) totalCritChanceBonus += eq.critChance / 100;
        if (eq.critDmg) totalCritDmgBonus += eq.critDmg / 100;

        // Hypixel Skyblock Reforge Modifier Stats
        if (eq.reforgeStats) {
          if (eq.reforgeStats.bonusDmg) totalBonusDmg += eq.reforgeStats.bonusDmg;
          if (eq.reforgeStats.bonusDef) totalBonusDef += eq.reforgeStats.bonusDef;
          if (eq.reforgeStats.bonusHp) totalBonusHp += eq.reforgeStats.bonusHp;
          if (eq.reforgeStats.bonusMp) totalBonusMp += eq.reforgeStats.bonusMp;
          if (eq.reforgeStats.bonusSpeed) totalBonusSpeed += eq.reforgeStats.bonusSpeed;
          if (eq.reforgeStats.bonusAttackSpeed) totalBonusAttackSpeed += eq.reforgeStats.bonusAttackSpeed;
          if (eq.reforgeStats.bonusSwipe) totalBonusSwipe += eq.reforgeStats.bonusSwipe;
          if (eq.reforgeStats.critChance) totalCritChanceBonus += eq.reforgeStats.critChance / 100;
          if (eq.reforgeStats.critDmg) totalCritDmgBonus += eq.reforgeStats.critDmg / 100;
        }
      }
    }

    const weaponRunes = this.gs.getWeaponRuneCounts(player);
    if (weaponRunes.vampiric > 0) {
      totalLifeSteal += 0.25 * weaponRunes.vampiric;
    }
    // Defensive runes in armor sockets (data/items/runes.json, socketFor: armor)
    const armorRunes = this.gs.getArmorRuneCounts(player);
    talentPct.hpPct += 0.06 * (armorRunes.bulwark || 0);
    talentPct.defPct += 0.08 * (armorRunes.aegis || 0);
    totalBonusSpeed += 0.25 * (armorRunes.swiftness || 0);
    if (armorRunes.warding) {
      for (const el of ['fire', 'ice', 'lightning', 'earth', 'holy', 'dark']) totalElementResist[el] = (totalElementResist[el] || 0) + 0.06 * armorRunes.warding;
    }
    player.armorRunes = armorRunes;

    // Item attributes (Jerry) plus HP / MP regen and cooldown reduction written on gear
    const attrs = ATTR.sumAttrs(player.equipment);
    let hpRegenFlat = attrs.hpRegen, mpRegenFlat = attrs.mpRegen, cdrPct = attrs.cdr;
    for (const eq of Object.values(player.equipment || {}) as any[]) {
      if (!eq) continue;
      hpRegenFlat += eq.hpRegen || 0;
      mpRegenFlat += eq.mpRegen || 0;
      cdrPct += eq.cdr || 0;
    }
    totalBonusDmg += attrs.dmg;
    totalBonusDef += attrs.def;
    totalBonusHp += attrs.hp;
    totalBonusMp += attrs.mp;
    totalCritChanceBonus += attrs.critChance / 100;
    totalCritDmgBonus += attrs.critDmg / 100;
    totalBonusAttackSpeed += attrs.atkSpeed / 100;
    totalBonusSpeed += attrs.moveSpeed;

    // Passive tree bonuses (every node has one rank)
    const procs = {};
    let killHeal = 0, killMana = 0;
    if (player.skills) {
      for (const [id, owned] of Object.entries(player.skills)) {
        const talent = PASSIVES.BY_ID.get(id);
        const rank = Number(owned) || 0;
        if (talent && rank > 0 && talent.effects) {
          killHeal += (talent.effects.killHealPercent || 0) * rank;
          killMana += (talent.effects.killManaPercent || 0) * rank;
          for (const stat of Object.keys(TALENT_PROCS.base)) {
            if (talent.effects[stat]) procs[stat] = (procs[stat] || 0) + talent.effects[stat] * rank;
          }
          if (talent.effects.bonusDmg) totalBonusDmg += talent.effects.bonusDmg * rank;
          if (talent.effects.bonusDef) totalBonusDef += talent.effects.bonusDef * rank;
          if (talent.effects.bonusHp) totalBonusHp += talent.effects.bonusHp * rank;
          if (talent.effects.bonusMp) totalBonusMp += talent.effects.bonusMp * rank;
          if (talent.effects.bonusSpeed) totalBonusSpeed += talent.effects.bonusSpeed * rank;
          if (talent.effects.bonusAttackSpeed) totalBonusAttackSpeed += talent.effects.bonusAttackSpeed * rank;
          if (talent.effects.bonusSwipe) totalBonusSwipe += talent.effects.bonusSwipe * rank;
          if (talent.effects.critChanceBonus) totalCritChanceBonus += talent.effects.critChanceBonus * rank;
          if (talent.effects.critDmgBonus) totalCritDmgBonus += talent.effects.critDmgBonus * rank;
          if (talent.effects.thorns) totalThorns += talent.effects.thorns * rank;
          if (talent.effects.dodgeChance) totalDodgeChance += talent.effects.dodgeChance * rank;
          if (talent.effects.lifeSteal) totalLifeSteal += talent.effects.lifeSteal * rank;
          for (const k of Object.keys(talentPct)) if (talent.effects[k]) talentPct[k] += talent.effects[k] * rank;
        }
      }
    }

    // Armor sets: 2-piece stat bonuses here; the 4-piece effects are read by
    // combat code through player.set4[setId] (see the SET EFFECTS section)
    const setCounts = equippedSetCounts(player.equipment);
    player.setCounts = setCounts;
    player.set2 = {};
    player.set4 = {};
    for (const [setId, n] of Object.entries(setCounts)) {
      const set = ARMOR_SETS[setId];
      if (n >= 2) {
        const b2 = set.bonuses['2'] || {};
        player.set2[setId] = b2;
        if (b2.hpPct) talentPct.hpPct += b2.hpPct;
        for (const [el, v] of Object.entries(b2.resist || {})) totalElementResist[el] = (totalElementResist[el] || 0) + (v as number);
      }
      if (n >= 4) player.set4[setId] = set.bonuses['4'];
    }
    if (!player.set4.eclipse) player.eclipsePhase = null;
    else if (!player.eclipsePhase) { player.eclipsePhase = 'dusk'; player.eclipseTimer = player.set4.eclipse.period; }

    // Job level bonus
    const jobSteps = Math.max(0, (player.jobLevel || 1) - 1);
    totalBonusDmg += jobSteps * SP.JOB_LEVEL_BONUS.bonusDmg;
    totalBonusHp += jobSteps * SP.JOB_LEVEL_BONUS.bonusHp;
    totalBonusMp += jobSteps * SP.JOB_LEVEL_BONUS.bonusMp;

    // Specialist card stats apply only while transformed
    const spCard = player.equipment && player.equipment.sp;
    if (player.spTransformed && spCard) {
      const cs: any = SP.cardStats(spCard.cardId, spCard.upgradeLevel || 0);
      totalBonusDmg += cs.bonusDmg || 0;
      totalBonusDef += cs.bonusDef || 0;
      totalBonusHp += cs.bonusHp || 0;
      totalBonusMp += cs.bonusMp || 0;
      totalBonusSpeed += cs.bonusSpeed || 0;
      totalBonusAttackSpeed += cs.bonusAttackSpeed || 0;
      totalCritChanceBonus += (cs.critChance || 0) / 100;
    }
    if (player.bloodlust) totalBonusAttackSpeed += player.bloodlust.atkSpeed || 0;

    // Combat Mastery multiplies every source of damage at high level
    player.mastery = Number(masteryMult(player.level).toFixed(2));
    // James the Gatekeeper's weapons: passive powers (Gatekeeper's Greatsword -30%, Sunfire Conduit +10%)
    const power = weaponPower(player.equipment && player.equipment.weapon);
    player.weaponPower = power;
    const pctMult = (v) => Math.max(0.1, 1 + v);   // a keystone trade-off can lower a stat, never zero it
    player.dmg = Math.round((player.baseStats.dmg + totalBonusDmg) * pctMult(talentPct.dmgPct) * player.mastery * ((power && power.dmgMult) || 1));
    // (Eclipse set, Dawn phase: +20% Defense)
    const dawnDef = player.eclipsePhase === 'dawn' && player.set4.eclipse ? player.set4.eclipse.dawnDef : 0;
    player.def = Math.round((player.baseStats.def + totalBonusDef) * pctMult(talentPct.defPct + dawnDef));
    player.maxHp = Math.round((player.baseStats.maxHp + totalBonusHp) * pctMult(talentPct.hpPct));
    player.maxMp = Math.round((player.baseStats.maxMp + totalBonusMp) * pctMult(talentPct.mpPct));
    totalThorns += Math.max(0, player.def) * talentPct.thornsPct;
    player.manaCostMult = Number((MANA_COST_SCALE * (1 + MANA_COST_PER_LEVEL * ((player.level || 1) - 1))).toFixed(3));
    player.speed = Number((player.baseStats.speed + totalBonusSpeed).toFixed(2));
    player.attackSpeed = Number(((player.baseStats.attackSpeed || 1.0) + totalBonusAttackSpeed).toFixed(2));
    player.swipe = Math.round((player.baseStats.swipe || 0) + totalBonusSwipe);
    player.critChanceBonus = Math.min(0.75, Number(totalCritChanceBonus.toFixed(3)));
    player.critDmgBonus = Number(totalCritDmgBonus.toFixed(3));
    player.thorns = Math.round(totalThorns);
    player.dodgeChance = Math.min(0.50, Number(totalDodgeChance.toFixed(3)));
    player.lifeSteal = Math.min(0.08, Number(totalLifeSteal.toFixed(3)));
    // Branch mechanics (burn, chill, echo, venom): the first rank unlocks the base strength
    player.talentKill = { hp: Number(killHeal.toFixed(4)), mp: Number(killMana.toFixed(4)) };
    player.talentProcs = {};
    for (const [stat, v] of Object.entries(procs)) {
      player.talentProcs[stat] = Number((TALENT_PROCS.base[stat] + v).toFixed(4));
    }
    // Elemental resistance from gear, capped so no element is fully negated
    player.elementResist = {};
    for (const [el, val] of Object.entries(totalElementResist)) {
      player.elementResist[el] = Number(Math.min(MAX_PLAYER_ELEMENT_RESIST, val as number).toFixed(2));
    }

    player.hp = Math.min(player.hp, player.maxHp);
    player.mp = Math.min(player.mp, player.maxMp);

    // Regeneration per second (natural + gear) and cooldown reduction, read by the tick and skill casts
    player.hpRegenFlat = Number(hpRegenFlat.toFixed(1));
    player.mpRegenFlat = Number(mpRegenFlat.toFixed(1));
    player.hpRegen = Number((player.maxHp * HP_REGEN_PCT * this.gs.hpRegenMult(player) + player.hpRegenFlat).toFixed(1));
    player.mpRegen = Number((player.maxMp * MANA_REGEN_PCT + MANA_REGEN_FLAT + player.mpRegenFlat).toFixed(1));
    player.cdr = Number(Math.min(ATTR.MAX_CDR, cdrPct / 100).toFixed(3));

    // Mage Energy Shield: a passive barrier that soaks hits before HP and
    // recharges after a moment without taking damage (see tickEnergyShield)
    if (isRangedClass(player.characterClass)) {
      player.esMax = Math.round(player.maxHp * ENERGY_SHIELD.hpShare + player.maxMp * ENERGY_SHIELD.mpShare);
      if (player.es === undefined || player.es === null) player.es = player.esMax;
      player.es = Math.min(player.es, player.esMax);
    } else {
      player.esMax = 0;
      player.es = 0;
    }
  }

  // Defensive runes socketed in the worn armor pieces: { bulwark: 2, aegis: 1, ... }
  getArmorRuneCounts(player: any): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const slot of ARMOR_SOCKET_SLOTS) {
      const it = player?.equipment?.[slot];
      if (!it || !Array.isArray(it.sockets)) continue;
      for (const s of it.sockets) {
        if (!s) continue;
        const def = ITEMS[s];
        if (def && def.socketFor === 'armor') counts[def.runeType] = (counts[def.runeType] || 0) + 1;
      }
    }
    return counts;
  }

  getWeaponRuneCounts(player: any): Record<string, number> {
    const counts: Record<string, number> = { flame: 0, frost: 0, tempest: 0, vampiric: 0 };
    const weapon = player?.equipment?.weapon;
    if (!weapon || !Array.isArray(weapon.sockets)) return counts;
    for (const s of weapon.sockets) {
      if (!s) continue;
      const key = String(s).replace(/^rune_/, '');
      if (counts[key] !== undefined) {
        counts[key]++;
      }
    }
    return counts;
  }
}
