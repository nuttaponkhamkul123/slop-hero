// Class skills: casting every slot (class skills, weapon abilities, dispatch to SP skills), loadout customizing, skill resolution and the armor-set cast hooks.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import { weaponAbility } from '../items';
import * as SP from '../spCards';
import { SKILL_DAMAGE_SCALE, BLOOD_AURA_START_HP, ULT_COOLDOWN, ULT_CHARGE_MAX, ULT_LOCK_SECONDS, SHADOW_SKIPS_SHAPES } from '../config/constants';
import { ALL_CLASS_SKILLS, SKILL_RUNES, DEFAULT_EQUIPPED_SKILLS, CLIENT_SKILL_SLOTS, DEFAULT_SKILL_FOR_SLOT } from '../data/skills';

export class SkillSystem {
  constructor(private readonly gs: GameServer) {}

  handleCustomizeSkill(socketId, data) {
    const player = this.gs.players.get(socketId);
    if (!player || player.isDead) return;
    if (player.spTransformed) return this.gs.customizeSpSkill(player, data);

    if (!data || !data.slot) return;
    const validSlots = ['slot1', 'slot2', 'slot3', 'dash'];
    if (!validSlots.includes(data.slot)) return;

    if (!player.equippedSkills) {
      player.equippedSkills = JSON.parse(JSON.stringify(DEFAULT_EQUIPPED_SKILLS[player.characterClass] || DEFAULT_EQUIPPED_SKILLS.warrior));
    }
    if (!player.equippedSkills.runes) {
      player.equippedSkills.runes = { slot1: 'none', slot2: 'none', slot3: 'none', dash: 'none' };
    }

    if (data.skillId) {
      const skillDef = ALL_CLASS_SKILLS[data.skillId];
      if (skillDef && skillDef.class === player.characterClass) {
        if (skillDef.reqLevel && player.level < skillDef.reqLevel) {
          const socket = this.gs.io.sockets.sockets.get(socketId);
          if (socket) {
            socket.emit('floating_text', {
              x: player.x,
              y: player.y - 0.7,
              text: `🔒 Requires Level ${skillDef.reqLevel}!`,
              color: '#ef4444'
            });
          }
          return;
        }
        player.equippedSkills[data.slot] = data.skillId;
      }
    }

    if (data.rune !== undefined) {
      if (SKILL_RUNES[data.rune]) {
        player.equippedSkills.runes[data.slot] = data.rune;
      }
    }

    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('custom_skills_updated', {
        equippedSkills: player.equippedSkills
      });
      const skillName = ALL_CLASS_SKILLS[player.equippedSkills[data.slot]] ? ALL_CLASS_SKILLS[player.equippedSkills[data.slot]].name : player.equippedSkills[data.slot];
      const slotKey = data.slot === 'slot1' ? 'Q' : data.slot === 'slot2' ? 'E' : data.slot === 'slot3' ? 'R' : 'Shift';
      const runeDef = SKILL_RUNES[player.equippedSkills.runes[data.slot]] || SKILL_RUNES.none;

      let noticeText = `⚡ Set [${skillName}] to [${slotKey}]!`;
      if (data.rune !== undefined) {
        noticeText = `🔮 Inscribed ${runeDef.icon} [${runeDef.name}] into [${slotKey}]!`;
      }

      socket.emit('floating_text', {
        x: player.x,
        y: player.y - 0.7,
        text: noticeText,
        color: '#facc15'
      });
    }

    this.gs.sendDirectMessage(player.id, `⚡ [${player.name}] customized their active ability loadout.`);
  }

  // The skill definition used for a slot; a transformed hero uses the card's
  // own SP skill, its damage scaled by the card's upgrade level.
  resolvePlayerSkill(player, slot, skillId) {
    // Right-click weapon ability: +5% damage per weapon upgrade level
    if (slot === 'weapon') {
      const weapon = player.equipment && player.equipment.weapon;
      const ability = weaponAbility(weapon);
      if (!ability) return null;
      return Object.assign({}, ability, { dmgMult: ability.dmgMult * (1 + 0.05 * (weapon.upgradeLevel || 0)) });
    }
    const card = this.gs.spCard(player);
    const lvl = (card && player.equipment.sp.upgradeLevel) || 0;
    const k = 1 + SP.SP_SKILL_PER_LEVEL * lvl;
    // Signature: its first stage, carrying every stage (scaled like card skills)
    if (slot === 'ult') {
      if (!card || !card.signature) return null;
      const stages = card.signature.stages.map(st => Object.assign({}, st, { dmgMult: st.dmgMult * k }));
      return Object.assign({}, stages[0], { cooldown: ULT_COOLDOWN, ultStages: stages });
    }
    const base = ALL_CLASS_SKILLS[skillId] || DEFAULT_SKILL_FOR_SLOT(player, slot);
    const spSkill = card && card.arsenal.includes(skillId) && SP.skillUnlocked(card, skillId, lvl) && SP.SP_SKILLS[skillId];
    if (!spSkill) return base;
    return Object.assign({}, spSkill, { dmgMult: spSkill.dmgMult * k });
  }

  handlePlayerSkill(socketId: any, skillData: any = {}) {
    const player = this.gs.players.get(socketId);
    if (!player || player.isDead) return;

    const rawSlot = skillData.skillSlot || 'slot1';
    const slot = (rawSlot === 'skill1') ? 'slot1' : (rawSlot === 'skill2') ? 'slot2' : rawSlot;
    if (!CLIENT_SKILL_SLOTS.has(slot)) return;

    if (!player.equippedSkills) {
      player.equippedSkills = JSON.parse(JSON.stringify(DEFAULT_EQUIPPED_SKILLS[player.characterClass] || DEFAULT_EQUIPPED_SKILLS.warrior));
    }
    if (!player.skillCooldowns) {
      player.skillCooldowns = { slot1: 0, slot2: 0, slot3: 0, dash: 0, skill1: 0, skill2: 0 };
    }
    // Nightblade: casting Phantom Shuriken again while its stars are out calls them back (free, ignores cooldown)
    // Dragoon: casting Sky Lance again while it is planted dives onto it (also free)
    const recast = (o) => !!(o && o.slot === slot && Date.now() < o.until && player.equippedSkills && player.equippedSkills[slot] === o.skillId
      && o.zone === player.zone && o.instanceId === (player.dungeonInstanceId || null));
    const recall = recast(player.nbStars) || recast(player.dgSpear);
    if (!recall && (player.skillCooldowns[slot] > 0 || (player.skillCooldowns[rawSlot] > 0))) return;

    const socket0 = this.gs.io.sockets.sockets.get(socketId);
    const skillId = slot === 'weapon' ? 'weapon' : slot === 'ult' ? 'ult'
      : player.equippedSkills[slot] || (DEFAULT_EQUIPPED_SKILLS[player.characterClass] && DEFAULT_EQUIPPED_SKILLS[player.characterClass][slot]) || 'whirlwind';
    const skill = this.gs.resolvePlayerSkill(player, slot, skillId);
    if (!skill) {
      if (socket0) socket0.emit('floating_text', { x: player.x, y: player.y - 0.7, text: slot === 'ult' ? 'Transform with an SP card to use its Signature' : 'This weapon has no ability', color: '#94a3b8' });
      return;
    }
    // Signature: needs a full charge instead of mana
    if (slot === 'ult' && (player.ultCharge || 0) < ULT_CHARGE_MAX) {
      if (socket0) socket0.emit('floating_text', { x: player.x, y: player.y - 0.7, text: `✦ Signature charging ... ${Math.floor(player.ultCharge || 0)}%`, color: '#94a3b8' });
      return;
    }
    const runeId = (player.equippedSkills.runes && player.equippedSkills.runes[slot]) || 'none';

    const socket = this.gs.io.sockets.sockets.get(socketId);
    const playerTalents = player.skills || {};

    if (skill.spShape === 'aura') {
      // casting an active blood aura again switches it off, for free
      if (player.spToggles && player.spToggles[skill.id]) {
        player.skillCooldowns[slot] = player.skillCooldowns[rawSlot] = skill.cooldown;
        this.gs.endSpToggle(player, skill.id);
        this.gs.emitZone(player.zone, 'skill_fx', {
          type: 'sp_skill', shape: 'aura', off: true, x: player.x, y: player.y, radius: skill.r || 1.4, element: skill.element, color: skill.color,
          cardId: skill.cardId, skillId: skill.id, name: skill.name, skillSlot: slot, cooldown: skill.cooldown, playerId: player.id
        });
        if (socket) socket.emit('player_updated', player);
        return;
      }
      if (skill.drain && player.hp <= player.maxHp * BLOOD_AURA_START_HP) {
        if (socket) socket.emit('floating_text', { x: player.x, y: player.y - 0.7, text: '🩸 Not enough blood!', color: '#ef4444' });
        return;
      }
    }

    let mpCost = Math.round(skill.mpCost * (player.manaCostMult || 1));
    if (playerTalents.mana_flow) {
      mpCost = Math.max(2, Math.round(mpCost * (1 - playerTalents.mana_flow * 0.30)));
    }

    if (skill.cardId === 'sp_reaver' && player.overheatUntil > Date.now()) mpCost = 0;

    if (!recall && player.mp < mpCost) {
      if (socket) {
        socket.emit('floating_text', {
          x: player.x,
          y: player.y - 0.7,
          text: '⚠️ Not enough Mana!',
          color: '#38bdf8'
        });
      }
      return;
    }

    const runeCounts = this.gs.getWeaponRuneCounts(player);
    let cooldown = skill.cooldown;
    if (runeCounts.tempest > 0) {
      // (the 0.4s floor never lengthens a cooldown that is already shorter, e.g. Rift Step's 0.1s)
      cooldown = Math.max(Math.min(0.4, cooldown), Number((cooldown * Math.pow(0.8, runeCounts.tempest)).toFixed(2)));
    }
    // Cooldown reduction from gear and attributes
    if (player.cdr > 0) cooldown = Number((cooldown * (1 - player.cdr)).toFixed(2));
    // Stormcaller 2-piece: shorter cooldowns
    if (player.set2 && player.set2.stormcaller) cooldown = Number((cooldown * (1 - player.set2.stormcaller.cdr)).toFixed(2));
    // Exhausting dungeon modifier: longer cooldowns for the whole run
    if (player.zone === 'dungeon') {
      const dInst = this.gs.getPlayerDungeonInstance(player);
      if (dInst && dInst.mods && dInst.mods.includes('exhausting')) cooldown = Number((cooldown * 1.25).toFixed(2));
    }
    if (slot === 'dash') {
      if (playerTalents.sundering_dash) cooldown = Math.max(0.4, cooldown - playerTalents.sundering_dash * 0.4);
      if (playerTalents.arcane_haste) cooldown = Math.max(0.4, cooldown - playerTalents.arcane_haste * 0.5);
      if (playerTalents.shadow_sprint) cooldown = Math.max(0.4, cooldown - playerTalents.shadow_sprint * 0.4);
    }

    if (!recall) {
      player.mp -= mpCost;
      player.skillCooldowns[slot] = cooldown;
      player.skillCooldowns[rawSlot] = cooldown;
      if (slot === 'slot1') player.skillCooldown = cooldown;
      if (slot === 'ult') {
        player.ultCharge = 0;
        player.ultLockUntil = Date.now() + ULT_LOCK_SECONDS * 1000;
        this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 1.6, text: `✦ ${skill.name.toUpperCase()} ✦`, color: skill.color || '#facc15', size: 26 });
      }
      this.gs.applySetOnSkillCast(player, skill.cooldown);
      if (socket) socket.emit('player_updated', player);
    }

    const mobsMap = this.gs.getMobsMap(player.zone);
    let totalDmgDealt = 0;

    // `canCrit` only allows a crit; it is rolled like a basic attack, plus the
    // skill's own critBonus (e.g. Fan of Knives, Shadowstep).
    const skillCritChance = 0.15 + (player.critChanceBonus || 0) + (skill.critBonus || 0);
    const applySkillDamage = (mob, baseDmg, canCrit = false) => {
      const isCrit = canCrit && Math.random() < skillCritChance;
      let dmg = Math.max(1, Math.round(baseDmg * SKILL_DAMAGE_SCALE));
      if (runeId === 'flame') {
        dmg = Math.round(dmg * 1.25);
        mob.burnTimer = 3.5;
        mob.burnDmg = 16;
      }
      if (runeId === 'frost') {
        mob.chillTimer = 3.5;
        if (Math.random() < 0.25) mob.chillTimer = 5.0;
      }
      if (runeId === 'tempest') {
        dmg = Math.round(dmg * 1.10);
      }
      if (player.berserkTimer > 0) {
        dmg = Math.round(dmg * 1.35);
      }
      if (player.bloodlust) dmg = Math.round(dmg * this.gs.bloodRage(player));
      this.gs.applyDamageToMob(player, mob, dmg, isCrit);
      totalDmgDealt += dmg;
    };

    // Helper for Dash vector calculations
    const computeDashVector = () => {
      let dirX = 0, dirY = 0;
      if (skillData.dirX !== undefined && skillData.dirY !== undefined && (skillData.dirX !== 0 || skillData.dirY !== 0)) {
        dirX = skillData.dirX;
        dirY = skillData.dirY;
      } else if (player.moveDir && (player.moveDir.dx !== 0 || player.moveDir.dy !== 0)) {
        const sLen = Math.hypot(player.moveDir.dx, player.moveDir.dy);
        const nx = player.moveDir.dx / sLen;
        const ny = player.moveDir.dy / sLen;
        dirX = (nx + ny * 2) * 0.5;
        dirY = (ny * 2 - nx) * 0.5;
      } else if (player.targetX !== null && player.targetY !== null) {
        const td = Math.hypot(player.targetX - player.x, player.targetY - player.y);
        if (td > 0.1) {
          dirX = (player.targetX - player.x) / td;
          dirY = (player.targetY - player.y) / td;
        }
      }
      if (Math.hypot(dirX, dirY) < 0.001) {
        const facingVectors = {
          'E': { dx: 1, dy: -1 }, 'SE': { dx: 1, dy: 0 }, 'S': { dx: 1, dy: 1 },
          'SW': { dx: 0, dy: 1 }, 'W': { dx: -1, dy: 1 }, 'NW': { dx: -1, dy: 0 },
          'N': { dx: -1, dy: -1 }, 'NE': { dx: 0, dy: -1 }
        };
        const vec = facingVectors[player.facing] || { dx: 1, dy: 0 };
        dirX = vec.dx; dirY = vec.dy;
      }
      const dirLen = Math.hypot(dirX, dirY) || 1;
      return { normX: dirX / dirLen, normY: dirY / dirLen };
    };

    // field props near the caster, and near where the skill was aimed, take a hit
    if (this.gs.fields.has(player.zone)) {
      this.gs.damageFieldProps(player, player.x, player.y, 3);
      if (Number.isFinite(skillData && skillData.targetX) && Number.isFinite(skillData && skillData.targetY)) {
        this.gs.damageFieldProps(player, skillData.targetX, skillData.targetY, 1.8);
      }
    }

    // EXECUTE SPECIFIC ABILITY
    switch (skill.spShape ? 'sp_skill' : skill.id) {
      case 'sp_skill': {
        const spCtx = { slot, cooldown, runeId, skillData, mobsMap, applySkillDamage, computeDashVector, recall };
        if (skill.ultStages) {
          // Signature: every stage after the first lands on its delay, from
          // wherever the hero is by then (the first may have moved them)
          const zone0 = player.zone, inst0 = player.dungeonInstanceId || null;
          skill.ultStages.forEach((stage, i) => {
            const run = () => {
              if (player.isDead || player.zone !== zone0 || (player.dungeonInstanceId || null) !== inst0) return;
              this.gs.castSpSkill(player, stage, i === 0 ? spCtx : Object.assign({}, spCtx, { quiet: true }));
            };
            if (i === 0 || !(stage.delay > 0)) run(); else setTimeout(run, stage.delay * 1000);
          });
          if (socket) socket.emit('player_updated', player);
          break;
        }
        this.gs.castSpSkill(player, skill, spCtx);
        // Nightblade's tossed shadow casts the same skill from where it stands
        const shadow = player.nbShadow;
        if (shadow && Date.now() < shadow.until && shadow.zone === player.zone && shadow.instanceId === (player.dungeonInstanceId || null)
          && !recall && !SHADOW_SKIPS_SHAPES.has(skill.spShape)) {
          const echo = Object.assign({}, skill, { dmgMult: skill.dmgMult * shadow.mirror });
          this.gs.castSpSkill(player, echo, Object.assign({}, spCtx, { isShadow: true, origin: { x: shadow.x, y: shadow.y } }));
        }
        break;
      }

      // === WARRIOR SKILLS ===
      case 'whirlwind': {
        const wwRadius = skill.radius + (playerTalents.cyclone_cleave ? playerTalents.cyclone_cleave * 1.2 : 0);
        const wwDmgMult = skill.dmgMult + (playerTalents.cyclone_cleave ? playerTalents.cyclone_cleave * 0.5 : 0);
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'whirlwind', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: wwRadius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= wwRadius) {
            applySkillDamage(mob, Math.round(player.dmg * wwDmgMult), true);
          }
        }
        break;
      }

      case 'earthshaker': {
        const slamDmgMult = skill.dmgMult + (playerTalents.seismic_shatter ? playerTalents.seismic_shatter * 0.60 : 0);
        const slowDur = (skill.slowDuration || 2.5) + (playerTalents.seismic_shatter ? playerTalents.seismic_shatter * 3 : 0);
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'earthshaker', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * slamDmgMult), true);
            mob.chillTimer = slowDur;
          }
        }
        break;
      }

      case 'blade_charge': {
        const { normX, normY } = computeDashVector();
        const startX = player.x, startY = player.y;
        const dashDist = skill.distance || 4.8;
        let newX = startX, newY = startY;
        const steps = Math.floor(dashDist / 0.25);
        for (let s = 1; s <= steps; s++) {
          const tx = startX + normX * (s * 0.25);
          const ty = startY + normY * (s * 0.25);
          if (this.gs.isColliding(tx, ty, player.zone)) break;
          newX = tx; newY = ty;
        }
        player.x = newX; player.y = newY;
        player.targetX = null; player.targetY = null;
        player.facing = this.gs.calculateFacing(startX, startY, newX, newY);
        const chargeDmgMult = skill.dmgMult + (playerTalents.sundering_dash ? playerTalents.sundering_dash * 0.5 : 0);
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = this.gs.distToSegment(mob.x, mob.y, startX, startY, newX, newY);
          if (dist <= 1.4) {
            applySkillDamage(mob, Math.round(player.dmg * chargeDmgMult), true);
            const kx = mob.x + normX * 0.8;
            const ky = mob.y + normY * 0.8;
            if (!this.gs.isColliding(kx, ky, player.zone)) { mob.x = kx; mob.y = ky; }
          }
        }
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'blade_charge', skillSlot: slot, cooldown, startX, startY, x: newX, y: newY, playerId: player.id });
        break;
      }

      case 'shield_slam': {
        let targetMob = null;
        let minDist = 3.2;
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (dist < minDist) { minDist = dist; targetMob = mob; }
        }
        const hitX = targetMob ? targetMob.x : player.x;
        const hitY = targetMob ? targetMob.y : player.y;
        player.shieldHp = (player.shieldHp || 0) + (skill.shieldHp || 80);
        this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: `🛡️ Shield Barrier +${skill.shieldHp || 80}!`, color: '#38bdf8' });
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'shield_slam', skillSlot: slot, cooldown, x: hitX, y: hitY, playerId: player.id });
        if (targetMob) {
          applySkillDamage(targetMob, Math.round(player.dmg * skill.dmgMult), true);
          targetMob.chillTimer = skill.stunDuration || 2.0;
        }
        break;
      }

      case 'blood_rage': {
        const hpLoss = Math.max(10, Math.round(player.hp * 0.10));
        player.hp = Math.max(1, player.hp - hpLoss);
        player.berserkTimer = skill.duration || 6.0;
        this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '🩸 BERSERK RAGE (+35% DMG & 20% Leech)', color: '#ef4444' });
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'blood_rage', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'colossus_strike': {
        const hitX = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const hitY = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'colossus_strike', skillSlot: slot, cooldown, x: hitX, y: hitY, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - hitX, mob.y - hitY) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'iron_fortress': {
        player.ironFortressTimer = skill.duration || 4.5;
        this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '🏰 IRON FORTRESS (60% Shield & Thorns)', color: '#94a3b8' });
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'iron_fortress', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'war_stomp': {
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'war_stomp', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (dist <= skill.radius) {
            mob.x = player.x + (mob.x - player.x) * 0.35;
            mob.y = player.y + (mob.y - player.y) * 0.35;
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.chillTimer = skill.stunDuration || 1.8;
          }
        }
        break;
      }

      case 'dragon_roar': {
        player.berserkTimer = skill.duration || 6.0;
        this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: "🐲 DRAGON'S ROAR (+40% ATK & FEAR)", color: '#f97316', size: 19 });
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'dragon_roar', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.chillTimer = 2.0;
          }
        }
        break;
      }

      case 'meteor_dive': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        if (!this.gs.isColliding(tx, ty, player.zone)) {
          player.x = tx; player.y = ty;
        }
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'meteor_dive', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.burnTimer = 4.0;
            mob.burnDmg = 18;
          }
        }
        break;
      }

      case 'bladestorm_frenzy': {
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'bladestorm_frenzy', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'titan_bastion': {
        player.shieldHp = (player.shieldHp || 0) + (skill.shieldHp || 350);
        player.ironFortressTimer = skill.duration || 5.0;
        this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: `🏛️ TITAN BASTION (+${skill.shieldHp || 350} Shield & Armor)`, color: '#facc15', size: 19 });
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'titan_bastion', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'sundering_cleave': {
        const { normX, normY } = computeDashVector();
        const cleaveDist = skill.distance || 9.0;
        const cleaveX = player.x + normX * cleaveDist;
        const cleaveY = player.y + normY * cleaveDist;
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'sundering_cleave', skillSlot: slot, cooldown, startX: player.x, startY: player.y, x: cleaveX, y: cleaveY, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = this.gs.distToSegment(mob.x, mob.y, player.x, player.y, cleaveX, cleaveY);
          if (dist <= 1.8) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.chillTimer = 3.0;
          }
        }
        break;
      }

      case 'ragnarok_slash': {
        this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.9, text: '👑 RAGNARÖK GODSLAYER!', color: '#eab308', size: 24 });
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'ragnarok_slash', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      // === MAGE SKILLS ===
      case 'firestorm': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        const meteorRadius = skill.radius + (playerTalents.infernal_cataclysm ? playerTalents.infernal_cataclysm * 2.0 : 0);
        const meteorDmgMult = skill.dmgMult + (playerTalents.infernal_cataclysm ? playerTalents.infernal_cataclysm * 0.60 : 0);
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'firestorm', skillSlot: slot, cooldown, x: tx, y: ty, radius: meteorRadius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= meteorRadius) {
            applySkillDamage(mob, Math.round(player.dmg * meteorDmgMult), true);
            mob.burnTimer = skill.burnDuration || 3.0;
            mob.burnDmg = (skill.burnDmg || 12) + (playerTalents.infernal_cataclysm ? playerTalents.infernal_cataclysm * 10 : 0);
          }
        }
        break;
      }

      case 'frost_nova': {
        const novaDmgMult = skill.dmgMult + (playerTalents.glacial_tomb ? playerTalents.glacial_tomb * 0.5 : 0);
        const chillDur = (skill.chillDuration || 3.5) + (playerTalents.glacial_tomb ? playerTalents.glacial_tomb * 3 : 0);
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'frost_nova', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * novaDmgMult), false);
            mob.chillTimer = chillDur;
          }
        }
        break;
      }

      case 'arcane_blink': {
        const { normX, normY } = computeDashVector();
        const startX = player.x, startY = player.y;
        let dashDist = skill.distance || 5.2;
        if (playerTalents.arcane_haste) dashDist += playerTalents.arcane_haste * 3;
        let newX = startX, newY = startY;
        const steps = Math.floor(dashDist / 0.25);
        for (let s = steps; s >= 1; s--) {
          const tx = startX + normX * (s * 0.25);
          const ty = startY + normY * (s * 0.25);
          if (!this.gs.isColliding(tx, ty, player.zone)) {
            newX = tx; newY = ty;
            break;
          }
        }
        player.x = newX; player.y = newY;
        player.targetX = null; player.targetY = null;
        player.statusEffects = [];
        player.speedFactor = 1.0;
        player.facing = this.gs.calculateFacing(startX, startY, newX, newY);
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - newX, mob.y - newY) <= (skill.radius || 2.4)) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
            mob.chillTimer = skill.chillDuration || 2.0;
          }
        }
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'arcane_blink', skillSlot: slot, cooldown, startX, startY, x: newX, y: newY, playerId: player.id });
        break;
      }

      case 'chain_lightning': {
        let currentTarget = null;
        let minDist = 7.0;
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (dist < minDist) { minDist = dist; currentTarget = mob; }
        }
        const points = [{ x: player.x, y: player.y }];
        const hitMobIds = new Set();
        let chainTarget = currentTarget;
        for (let b = 0; b < (skill.bounces || 5); b++) {
          if (!chainTarget) break;
          hitMobIds.add(chainTarget.id);
          points.push({ x: chainTarget.x, y: chainTarget.y });
          applySkillDamage(chainTarget, Math.round(player.dmg * skill.dmgMult), true);
          let nextTarget = null;
          let nextDist = 5.0;
          for (const mob of mobsMap.values()) {
            if (mob.state === 'dead' || hitMobIds.has(mob.id)) continue;
            const dist = Math.hypot(mob.x - chainTarget.x, mob.y - chainTarget.y);
            if (dist < nextDist) { nextDist = dist; nextTarget = mob; }
          }
          chainTarget = nextTarget;
        }
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'chain_lightning', skillSlot: slot, cooldown, points, playerId: player.id });
        break;
      }

      case 'mana_shield': {
        player.shieldHp = (player.shieldHp || 0) + (skill.absorbHp || 120);
        this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: `✨ Mana Barrier +${skill.absorbHp || 120} Shield!`, color: '#67e8f9' });
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'mana_shield', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'black_hole': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'black_hole', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - tx, mob.y - ty);
          if (dist <= skill.radius) {
            mob.x = tx + (mob.x - tx) * 0.2;
            mob.y = ty + (mob.y - ty) * 0.2;
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'blizzard': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'blizzard', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
            mob.chillTimer = 4.0;
          }
        }
        break;
      }

      case 'pyroblast': {
        const { normX, normY } = computeDashVector();
        const hitX = player.x + normX * 4.5;
        const hitY = player.y + normY * 4.5;
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'pyroblast', skillSlot: slot, cooldown, startX: player.x, startY: player.y, x: hitX, y: hitY, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - hitX, mob.y - hitY) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.burnTimer = skill.burnDuration || 4.0;
            mob.burnDmg = skill.burnDmg || 16;
          }
        }
        break;
      }

      case 'thunder_storm': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'thunder_storm', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.chillTimer = 1.5;
          }
        }
        break;
      }

      case 'glacial_comet': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'glacial_comet', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.chillTimer = 4.0;
          }
        }
        break;
      }

      case 'arcane_hyperbeam': {
        const { normX, normY } = computeDashVector();
        const beamDist = skill.distance || 10.0;
        const beamEndX = player.x + normX * beamDist;
        const beamEndY = player.y + normY * beamDist;
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'arcane_hyperbeam', skillSlot: slot, cooldown, startX: player.x, startY: player.y, x: beamEndX, y: beamEndY, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = this.gs.distToSegment(mob.x, mob.y, player.x, player.y, beamEndX, beamEndY);
          if (dist <= 1.6) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'time_dilation': {
        this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '⏳ CHRONOSPHERE (80% Slow & Haste)', color: '#38bdf8', size: 19 });
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'time_dilation', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            mob.chillTimer = skill.duration || 4.5;
          }
        }
        break;
      }

      case 'supernova_blast': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'supernova_blast', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.burnTimer = 5.0;
            mob.burnDmg = 25;
          }
        }
        break;
      }

      case 'genesis_cataclysm': {
        this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.9, text: '✨ CATACLYSM OF GENESIS!', color: '#a855f7', size: 24 });
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'genesis_cataclysm', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      // === ROGUE SKILLS ===
      case 'fan_of_knives': {
        const knifeDmgMult = skill.dmgMult + (playerTalents.venomous_knives ? playerTalents.venomous_knives * 0.60 : 0);
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'fan_of_knives', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * knifeDmgMult), true);
            if (playerTalents.venomous_knives) {
              mob.poisonTimer = 4.0;
              mob.poisonDmg = 16 * playerTalents.venomous_knives;
            }
          }
        }
        break;
      }

      case 'toxic_bomb': {
        const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
        const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
        const smokeRad = skill.radius + (playerTalents.noxious_cloud ? playerTalents.noxious_cloud * 1.6 : 0);
        const smokeDmg = (skill.poisonDmg || 9) + (playerTalents.noxious_cloud ? playerTalents.noxious_cloud * 8 : 0);
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'toxic_bomb', skillSlot: slot, cooldown, x: tx, y: ty, radius: smokeRad, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - tx, mob.y - ty) <= smokeRad) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
            mob.poisonTimer = skill.poisonDuration || 4.5;
            mob.poisonDmg = smokeDmg;
          }
        }
        break;
      }

      case 'shadow_dash': {
        const { normX, normY } = computeDashVector();
        const startX = player.x, startY = player.y;
        const dashDist = skill.distance || 4.8;
        let newX = startX, newY = startY;
        const steps = Math.floor(dashDist / 0.25);
        for (let s = 1; s <= steps; s++) {
          const tx = startX + normX * (s * 0.25);
          const ty = startY + normY * (s * 0.25);
          if (this.gs.isColliding(tx, ty, player.zone)) break;
          newX = tx; newY = ty;
        }
        player.x = newX; player.y = newY;
        player.targetX = null; player.targetY = null;
        player.facing = this.gs.calculateFacing(startX, startY, newX, newY);
        player.sprintTimer = (skill.sprintDuration || 2.0) + (playerTalents.shadow_sprint ? playerTalents.shadow_sprint * 2.0 : 0);
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = this.gs.distToSegment(mob.x, mob.y, startX, startY, newX, newY);
          if (dist <= 1.4) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'shadow_dash', skillSlot: slot, cooldown, startX, startY, x: newX, y: newY, playerId: player.id });
        break;
      }

      case 'shadowstep': {
        let targetMob = null;
        let minDist = 7.0;
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (dist < minDist) { minDist = dist; targetMob = mob; }
        }
        if (targetMob) {
          const startX = player.x, startY = player.y;
          const behindX = targetMob.x + 0.6;
          const behindY = targetMob.y + 0.6;
          if (!this.gs.isColliding(behindX, behindY, player.zone)) {
            player.x = behindX; player.y = behindY;
          }
          player.facing = this.gs.calculateFacing(player.x, player.y, targetMob.x, targetMob.y);
          applySkillDamage(targetMob, Math.round(player.dmg * skill.dmgMult), true);
          this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'shadowstep', skillSlot: slot, cooldown, startX, startY, x: targetMob.x, y: targetMob.y, playerId: player.id });
        }
        break;
      }

      case 'smoke_screen': {
        player.smokeScreenTimer = skill.duration || 3.5;
        player.sprintTimer = skill.duration || 3.5;
        this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '🌫️ VANISH! (Stealth & 100% Crit)', color: '#a855f7' });
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'smoke_screen', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
        break;
      }

      case 'death_blossom': {
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'death_blossom', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'poison_darts': {
        const { normX, normY } = computeDashVector();
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'poison_darts', skillSlot: slot, cooldown, x: player.x, y: player.y, dirX: normX, dirY: normY, playerId: player.id });
        // Eight shurikens fly out in a ring, curve, turn at their reach and come back to the thrower.
        // Whatever one of them passes through is hit (once per shuriken on the way out, once on the
        // way back). The path is the same one the client draws (renderer.js, poison_darts).
        {
          const N = 8, REACH = 5.2, DURATION_MS = 950, HIT_R = 0.95, TICK_MS = 40;
          const zone0 = player.zone, inst0 = player.dungeonInstanceId || null;
          const ox0 = player.x, oy0 = player.y, base = Math.atan2(normY, normX) + Math.PI / N;
          const perHit = Math.round(player.dmg * skill.dmgMult * 0.5);
          const shurikenAt = (i: number, u: number) => {
            const ang = base + (i / N) * Math.PI * 2;
            const tx = ox0 + Math.cos(ang) * REACH, ty = oy0 + Math.sin(ang) * REACH;
            const bow = Math.sin(Math.PI * u) * 1.1 * (i % 2 ? 1 : -1);
            let x: number, y: number;
            if (u < 0.5) {
              const t = 1 - Math.pow(1 - u / 0.5, 2.4);
              x = ox0 + (tx - ox0) * t; y = oy0 + (ty - oy0) * t;
            } else {
              const k = (u - 0.5) / 0.5, t = k * k * (1.6 - 0.6 * k);
              x = tx + (player.x - tx) * t; y = ty + (player.y - ty) * t;   // home to wherever the thrower is now
            }
            return { x: x - Math.sin(ang) * bow, y: y + Math.cos(ang) * bow };
          };
          const hitOnce = new Set<string>();
          const startedAt = Date.now();
          let prevU = 0;
          const tick = setInterval(() => {
            const p = this.gs.players.get(player.id);
            if (!p || p !== player || p.isDead || p.zone !== zone0 || (p.dungeonInstanceId || null) !== inst0) { clearInterval(tick); return; }
            const u = Math.min(1, (Date.now() - startedAt) / DURATION_MS);
            this.gs.runAs(player.id, () => {
              for (let i = 0; i < N; i++) {
                for (let s = 1; s <= 3; s++) {                       // sample the stretch since the last tick so none slip through
                  const pos = shurikenAt(i, prevU + ((u - prevU) * s) / 3);
                  const phase = u < 0.5 ? 0 : 1;
                  for (const mob of mobsMap.values()) {
                    if (mob.state === 'dead' || mob.hp <= 0) continue;
                    const key = `${i}|${phase}|${mob.id}`;
                    if (hitOnce.has(key)) continue;
                    if (Math.hypot(mob.x - pos.x, mob.y - pos.y) > HIT_R + (mob.isBoss ? 0.8 : 0)) continue;
                    hitOnce.add(key);
                    applySkillDamage(mob, perHit, false);
                  }
                }
              }
            });
            prevU = u;
            if (u >= 1) clearInterval(tick);
          }, TICK_MS);
        }
        break;
      }

      case 'caltrops': {
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'caltrops', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
            mob.chillTimer = skill.slowDuration || 4.0;
          }
        }
        break;
      }

      case 'venomous_barrage': {
        const { normX, normY } = computeDashVector();
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'venomous_barrage', skillSlot: slot, cooldown, x: player.x, y: player.y, dirX: normX, dirY: normY, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (dist <= 7.5) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
            mob.poisonTimer = 5.0;
            mob.poisonDmg = 18;
          }
        }
        break;
      }

      case 'phantom_assassins': {
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'phantom_assassins', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'assassins_cull': {
        let cullTarget = null;
        let cDist = 4.5;
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          const d = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (d < cDist) { cDist = d; cullTarget = mob; }
        }
        if (cullTarget) {
          const isExecute = (cullTarget.hp / cullTarget.maxHp) <= 0.5;
          const executeMult = isExecute ? skill.dmgMult * 2.0 : skill.dmgMult;
          applySkillDamage(cullTarget, Math.round(player.dmg * executeMult), true);
          this.gs.emitZone(player.zone, 'floating_text', { x: cullTarget.x, y: cullTarget.y - 0.8, text: isExecute ? '🩸 EXECUTION CULL (x2 DMG)!' : '🗡️ Cull Strike!', color: '#ef4444', size: isExecute ? 22 : 16 });
          this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'assassins_cull', skillSlot: slot, cooldown, x: cullTarget.x, y: cullTarget.y, playerId: player.id });
        }
        break;
      }

      case 'abyssal_tether': {
        this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '⛓️ ABYSSAL SHADOW CHAINS (ROOT)', color: '#a855f7', size: 18 });
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'abyssal_tether', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            mob.x = player.x + (mob.x - player.x) * 0.25;
            mob.y = player.y + (mob.y - player.y) * 0.25;
            mob.chillTimer = skill.rootDuration || 3.0;
          }
        }
        break;
      }

      case 'blade_dance': {
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'blade_dance', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }

      case 'eclipse_execution': {
        this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.9, text: '🌑 VOID ECLIPSE OMNISLASH!', color: '#c084fc', size: 24 });
        this.gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'eclipse_execution', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
        for (const mob of mobsMap.values()) {
          if (mob.state === 'dead') continue;
          if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
            applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
          }
        }
        break;
      }
    }

    // Process Vampiric & Berserk heals (balanced with Max HP caps)
    if (runeId === 'vampiric' && totalDmgDealt > 0) {
      const maxDrain = Math.max(2, Math.round(player.maxHp * 0.08));
      const vHeal = Math.min(maxDrain, Math.max(1, Math.round(totalDmgDealt * 0.05)));
      player.hp = Math.min(player.maxHp, player.hp + vHeal);
      this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.6, text: `+${vHeal} HP (Vampiric Drain)`, color: '#c084fc' });
    }
    if (player.berserkTimer > 0 && totalDmgDealt > 0) {
      const maxBHeal = Math.max(2, Math.round(player.maxHp * 0.06));
      const bHeal = Math.min(maxBHeal, Math.max(1, Math.round(totalDmgDealt * 0.04)));
      player.hp = Math.min(player.maxHp, player.hp + bHeal);
      this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.45, text: `+${bHeal} HP (Lifesteal)`, color: '#ef4444' });
    }

  }

  // Skill cast hooks: Stormcaller Static stacks, Eclipse phase flip
  applySetOnSkillCast(player, cooldown) {
    if (!player.set4) return;
    const st = player.set4.stormcaller;
    if (st) player.staticStacks = Math.min(st.stacks, (player.staticStacks || 0) + 1);
    const ec = player.set4.eclipse;
    if (ec && cooldown >= ec.flipCooldown) this.gs.flipEclipse(player);
  }

  flipEclipse(player) {
    const ec = player.set4 && player.set4.eclipse;
    if (!ec) return;
    player.eclipsePhase = player.eclipsePhase === 'dusk' ? 'dawn' : 'dusk';
    player.eclipseTimer = ec.period;
    this.gs.recalculatePlayerStats(player);   // Dawn's Defense bonus
    const dusk = player.eclipsePhase === 'dusk';
    this.gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 1.0, text: dusk ? '🌑 DUSK' : '🌕 DAWN', color: dusk ? '#a855f7' : '#fde68a', size: 16 });
    this.gs.emitZone(player.zone, 'skill_fx', { type: 'set_proc', set: 'eclipse', phase: player.eclipsePhase, x: player.x, y: player.y, radius: dusk ? 1.4 : ec.dawnRadius, color: dusk ? '#a855f7' : '#fde68a', playerId: player.id });
  }
}
