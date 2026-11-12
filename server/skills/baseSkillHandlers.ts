// One handler per class skill (Phase D2 of docs/REFACTOR_PLAN.md): the cases of the old switch in handlePlayerSkill.
// A handler gets a context with the server (gs), the caster and everything the cast worked out before the switch.
import { SHADOW_SKIPS_SHAPES } from '../config/constants';

export interface SkillContext {
  gs: any; player: any; skill: any; slot: string; rawSlot: string; cooldown: number; runeId: string; mobsMap: Map<string, any>;
  playerTalents: any; skillData: any; socket: any; recall: boolean; applySkillDamage: (mob: any, baseDmg: number, canCrit?: boolean) => void;
  computeDashVector: () => { normX: number; normY: number }; mpCost: number; runeCounts: any; skillCritChance: number; socket0: any; skillId: string;
}

export type SkillHandler = (c: SkillContext) => void;

export const BASE_SKILL_HANDLERS: Record<string, SkillHandler> = {
  sp_skill: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, skillData, socket, recall, applySkillDamage, computeDashVector } = c;
    const spCtx = { slot, cooldown, runeId, skillData, mobsMap, applySkillDamage, computeDashVector, recall };
    if (skill.ultStages) {
      // Signature: every stage after the first lands on its delay, from
      // wherever the hero is by then (the first may have moved them)
      const zone0 = player.zone, inst0 = player.dungeonInstanceId || null;
      skill.ultStages.forEach((stage, i) => {
        const run = () => {
          if (player.isDead || player.zone !== zone0 || (player.dungeonInstanceId || null) !== inst0) return;
          gs.castSpSkill(player, stage, i === 0 ? spCtx : Object.assign({}, spCtx, { quiet: true }));
        };
        if (i === 0 || !(stage.delay > 0)) run(); else setTimeout(run, stage.delay * 1000);
      });
      if (socket) socket.emit('player_updated', player);
      return;
    }
    gs.castSpSkill(player, skill, spCtx);
    // Nightblade's tossed shadow casts the same skill from where it stands
    const shadow = player.nbShadow;
    if (shadow && Date.now() < shadow.until && shadow.zone === player.zone && shadow.instanceId === (player.dungeonInstanceId || null)
      && !recall && !SHADOW_SKIPS_SHAPES.has(skill.spShape)) {
      const echo = Object.assign({}, skill, { dmgMult: skill.dmgMult * shadow.mirror });
      gs.castSpSkill(player, echo, Object.assign({}, spCtx, { isShadow: true, origin: { x: shadow.x, y: shadow.y } }));
    }
  },

  whirlwind: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, playerTalents, applySkillDamage } = c;
    const wwRadius = skill.radius + (playerTalents.cyclone_cleave ? playerTalents.cyclone_cleave * 1.2 : 0);
    const wwDmgMult = skill.dmgMult + (playerTalents.cyclone_cleave ? playerTalents.cyclone_cleave * 0.5 : 0);
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'whirlwind', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: wwRadius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - player.x, mob.y - player.y) <= wwRadius) {
        applySkillDamage(mob, Math.round(player.dmg * wwDmgMult), true);
      }
    }
  },

  earthshaker: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, playerTalents, applySkillDamage } = c;
    const slamDmgMult = skill.dmgMult + (playerTalents.seismic_shatter ? playerTalents.seismic_shatter * 0.60 : 0);
    const slowDur = (skill.slowDuration || 2.5) + (playerTalents.seismic_shatter ? playerTalents.seismic_shatter * 3 : 0);
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'earthshaker', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * slamDmgMult), true);
        mob.chillTimer = slowDur;
      }
    }
  },

  blade_charge: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, playerTalents, applySkillDamage, computeDashVector } = c;
    const { normX, normY } = computeDashVector();
    const startX = player.x, startY = player.y;
    const dashDist = skill.distance || 4.8;
    let newX = startX, newY = startY;
    const steps = Math.floor(dashDist / 0.25);
    for (let s = 1; s <= steps; s++) {
      const tx = startX + normX * (s * 0.25);
      const ty = startY + normY * (s * 0.25);
      if (gs.isColliding(tx, ty, player.zone)) break;
      newX = tx; newY = ty;
    }
    player.x = newX; player.y = newY;
    player.targetX = null; player.targetY = null;
    player.facing = gs.calculateFacing(startX, startY, newX, newY);
    const chargeDmgMult = skill.dmgMult + (playerTalents.sundering_dash ? playerTalents.sundering_dash * 0.5 : 0);
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      const dist = gs.distToSegment(mob.x, mob.y, startX, startY, newX, newY);
      if (dist <= 1.4) {
        applySkillDamage(mob, Math.round(player.dmg * chargeDmgMult), true);
        const kx = mob.x + normX * 0.8;
        const ky = mob.y + normY * 0.8;
        if (!gs.isColliding(kx, ky, player.zone)) { mob.x = kx; mob.y = ky; }
      }
    }
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'blade_charge', skillSlot: slot, cooldown, startX, startY, x: newX, y: newY, playerId: player.id });
  },

  shield_slam: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage } = c;
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
    gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: `🛡️ Shield Barrier +${skill.shieldHp || 80}!`, color: '#38bdf8' });
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'shield_slam', skillSlot: slot, cooldown, x: hitX, y: hitY, playerId: player.id });
    if (targetMob) {
      applySkillDamage(targetMob, Math.round(player.dmg * skill.dmgMult), true);
      targetMob.chillTimer = skill.stunDuration || 2.0;
    }
  },

  blood_rage: (c) => {
    const { gs, skill, player, slot, cooldown, runeId } = c;
    const hpLoss = Math.max(10, Math.round(player.hp * 0.10));
    player.hp = Math.max(1, player.hp - hpLoss);
    player.berserkTimer = skill.duration || 6.0;
    gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '🩸 BERSERK RAGE (+35% DMG & 20% Leech)', color: '#ef4444' });
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'blood_rage', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
  },

  colossus_strike: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, skillData, applySkillDamage } = c;
    const hitX = skillData.targetX !== undefined ? skillData.targetX : player.x;
    const hitY = skillData.targetY !== undefined ? skillData.targetY : player.y;
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'colossus_strike', skillSlot: slot, cooldown, x: hitX, y: hitY, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - hitX, mob.y - hitY) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
      }
    }
  },

  iron_fortress: (c) => {
    const { gs, skill, player, slot, cooldown, runeId } = c;
    player.ironFortressTimer = skill.duration || 4.5;
    gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '🏰 IRON FORTRESS (60% Shield & Thorns)', color: '#94a3b8' });
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'iron_fortress', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
  },

  war_stomp: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage } = c;
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'war_stomp', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
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
  },

  dragon_roar: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage } = c;
    player.berserkTimer = skill.duration || 6.0;
    gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: "🐲 DRAGON'S ROAR (+40% ATK & FEAR)", color: '#f97316', size: 19 });
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'dragon_roar', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
        mob.chillTimer = 2.0;
      }
    }
  },

  meteor_dive: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, skillData, applySkillDamage } = c;
    const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
    const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
    if (!gs.isColliding(tx, ty, player.zone)) {
      player.x = tx; player.y = ty;
    }
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'meteor_dive', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
        mob.burnTimer = 4.0;
        mob.burnDmg = 18;
      }
    }
  },

  bladestorm_frenzy: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage } = c;
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'bladestorm_frenzy', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
      }
    }
  },

  titan_bastion: (c) => {
    const { gs, skill, player, slot, cooldown, runeId } = c;
    player.shieldHp = (player.shieldHp || 0) + (skill.shieldHp || 350);
    player.ironFortressTimer = skill.duration || 5.0;
    gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: `🏛️ TITAN BASTION (+${skill.shieldHp || 350} Shield & Armor)`, color: '#facc15', size: 19 });
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'titan_bastion', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
  },

  sundering_cleave: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage, computeDashVector } = c;
    const { normX, normY } = computeDashVector();
    const cleaveDist = skill.distance || 9.0;
    const cleaveX = player.x + normX * cleaveDist;
    const cleaveY = player.y + normY * cleaveDist;
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'sundering_cleave', skillSlot: slot, cooldown, startX: player.x, startY: player.y, x: cleaveX, y: cleaveY, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      const dist = gs.distToSegment(mob.x, mob.y, player.x, player.y, cleaveX, cleaveY);
      if (dist <= 1.8) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
        mob.chillTimer = 3.0;
      }
    }
  },

  ragnarok_slash: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage } = c;
    gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.9, text: '👑 RAGNARÖK GODSLAYER!', color: '#eab308', size: 24 });
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'ragnarok_slash', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
      }
    }
  },

  firestorm: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, playerTalents, skillData, applySkillDamage } = c;
    const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
    const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
    const meteorRadius = skill.radius + (playerTalents.infernal_cataclysm ? playerTalents.infernal_cataclysm * 2.0 : 0);
    const meteorDmgMult = skill.dmgMult + (playerTalents.infernal_cataclysm ? playerTalents.infernal_cataclysm * 0.60 : 0);
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'firestorm', skillSlot: slot, cooldown, x: tx, y: ty, radius: meteorRadius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - tx, mob.y - ty) <= meteorRadius) {
        applySkillDamage(mob, Math.round(player.dmg * meteorDmgMult), true);
        mob.burnTimer = skill.burnDuration || 3.0;
        mob.burnDmg = (skill.burnDmg || 12) + (playerTalents.infernal_cataclysm ? playerTalents.infernal_cataclysm * 10 : 0);
      }
    }
  },

  frost_nova: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, playerTalents, applySkillDamage } = c;
    const novaDmgMult = skill.dmgMult + (playerTalents.glacial_tomb ? playerTalents.glacial_tomb * 0.5 : 0);
    const chillDur = (skill.chillDuration || 3.5) + (playerTalents.glacial_tomb ? playerTalents.glacial_tomb * 3 : 0);
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'frost_nova', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * novaDmgMult), false);
        mob.chillTimer = chillDur;
      }
    }
  },

  arcane_blink: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, playerTalents, applySkillDamage, computeDashVector } = c;
    const { normX, normY } = computeDashVector();
    const startX = player.x, startY = player.y;
    let dashDist = skill.distance || 5.2;
    if (playerTalents.arcane_haste) dashDist += playerTalents.arcane_haste * 3;
    let newX = startX, newY = startY;
    const steps = Math.floor(dashDist / 0.25);
    for (let s = steps; s >= 1; s--) {
      const tx = startX + normX * (s * 0.25);
      const ty = startY + normY * (s * 0.25);
      if (!gs.isColliding(tx, ty, player.zone)) {
        newX = tx; newY = ty;
        break;
      }
    }
    player.x = newX; player.y = newY;
    player.targetX = null; player.targetY = null;
    player.statusEffects = [];
    player.speedFactor = 1.0;
    player.facing = gs.calculateFacing(startX, startY, newX, newY);
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - newX, mob.y - newY) <= (skill.radius || 2.4)) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
        mob.chillTimer = skill.chillDuration || 2.0;
      }
    }
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'arcane_blink', skillSlot: slot, cooldown, startX, startY, x: newX, y: newY, playerId: player.id });
  },

  chain_lightning: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage } = c;
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
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'chain_lightning', skillSlot: slot, cooldown, points, playerId: player.id });
  },

  mana_shield: (c) => {
    const { gs, skill, player, slot, cooldown, runeId } = c;
    player.shieldHp = (player.shieldHp || 0) + (skill.absorbHp || 120);
    gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: `✨ Mana Barrier +${skill.absorbHp || 120} Shield!`, color: '#67e8f9' });
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'mana_shield', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
  },

  black_hole: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, skillData, applySkillDamage } = c;
    const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
    const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'black_hole', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      const dist = Math.hypot(mob.x - tx, mob.y - ty);
      if (dist <= skill.radius) {
        mob.x = tx + (mob.x - tx) * 0.2;
        mob.y = ty + (mob.y - ty) * 0.2;
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
      }
    }
  },

  blizzard: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, skillData, applySkillDamage } = c;
    const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
    const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'blizzard', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - tx, mob.y - ty) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
        mob.chillTimer = 4.0;
      }
    }
  },

  pyroblast: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage, computeDashVector } = c;
    const { normX, normY } = computeDashVector();
    const hitX = player.x + normX * 4.5;
    const hitY = player.y + normY * 4.5;
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'pyroblast', skillSlot: slot, cooldown, startX: player.x, startY: player.y, x: hitX, y: hitY, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - hitX, mob.y - hitY) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
        mob.burnTimer = skill.burnDuration || 4.0;
        mob.burnDmg = skill.burnDmg || 16;
      }
    }
  },

  thunder_storm: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, skillData, applySkillDamage } = c;
    const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
    const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'thunder_storm', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - tx, mob.y - ty) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
        mob.chillTimer = 1.5;
      }
    }
  },

  glacial_comet: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, skillData, applySkillDamage } = c;
    const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
    const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'glacial_comet', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - tx, mob.y - ty) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
        mob.chillTimer = 4.0;
      }
    }
  },

  arcane_hyperbeam: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage, computeDashVector } = c;
    const { normX, normY } = computeDashVector();
    const beamDist = skill.distance || 10.0;
    const beamEndX = player.x + normX * beamDist;
    const beamEndY = player.y + normY * beamDist;
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'arcane_hyperbeam', skillSlot: slot, cooldown, startX: player.x, startY: player.y, x: beamEndX, y: beamEndY, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      const dist = gs.distToSegment(mob.x, mob.y, player.x, player.y, beamEndX, beamEndY);
      if (dist <= 1.6) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
      }
    }
  },

  time_dilation: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap } = c;
    gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '⏳ CHRONOSPHERE (80% Slow & Haste)', color: '#38bdf8', size: 19 });
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'time_dilation', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
        mob.chillTimer = skill.duration || 4.5;
      }
    }
  },

  supernova_blast: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, skillData, applySkillDamage } = c;
    const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
    const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'supernova_blast', skillSlot: slot, cooldown, x: tx, y: ty, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - tx, mob.y - ty) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
        mob.burnTimer = 5.0;
        mob.burnDmg = 25;
      }
    }
  },

  genesis_cataclysm: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage } = c;
    gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.9, text: '✨ CATACLYSM OF GENESIS!', color: '#a855f7', size: 24 });
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'genesis_cataclysm', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
      }
    }
  },

  fan_of_knives: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, playerTalents, applySkillDamage } = c;
    const knifeDmgMult = skill.dmgMult + (playerTalents.venomous_knives ? playerTalents.venomous_knives * 0.60 : 0);
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'fan_of_knives', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
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
  },

  toxic_bomb: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, playerTalents, skillData, applySkillDamage } = c;
    const tx = skillData.targetX !== undefined ? skillData.targetX : player.x;
    const ty = skillData.targetY !== undefined ? skillData.targetY : player.y;
    const smokeRad = skill.radius + (playerTalents.noxious_cloud ? playerTalents.noxious_cloud * 1.6 : 0);
    const smokeDmg = (skill.poisonDmg || 9) + (playerTalents.noxious_cloud ? playerTalents.noxious_cloud * 8 : 0);
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'toxic_bomb', skillSlot: slot, cooldown, x: tx, y: ty, radius: smokeRad, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - tx, mob.y - ty) <= smokeRad) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
        mob.poisonTimer = skill.poisonDuration || 4.5;
        mob.poisonDmg = smokeDmg;
      }
    }
  },

  shadow_dash: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, playerTalents, applySkillDamage, computeDashVector } = c;
    const { normX, normY } = computeDashVector();
    const startX = player.x, startY = player.y;
    const dashDist = skill.distance || 4.8;
    let newX = startX, newY = startY;
    const steps = Math.floor(dashDist / 0.25);
    for (let s = 1; s <= steps; s++) {
      const tx = startX + normX * (s * 0.25);
      const ty = startY + normY * (s * 0.25);
      if (gs.isColliding(tx, ty, player.zone)) break;
      newX = tx; newY = ty;
    }
    player.x = newX; player.y = newY;
    player.targetX = null; player.targetY = null;
    player.facing = gs.calculateFacing(startX, startY, newX, newY);
    player.sprintTimer = (skill.sprintDuration || 2.0) + (playerTalents.shadow_sprint ? playerTalents.shadow_sprint * 2.0 : 0);
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      const dist = gs.distToSegment(mob.x, mob.y, startX, startY, newX, newY);
      if (dist <= 1.4) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
      }
    }
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'shadow_dash', skillSlot: slot, cooldown, startX, startY, x: newX, y: newY, playerId: player.id });
  },

  shadowstep: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage } = c;
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
      if (!gs.isColliding(behindX, behindY, player.zone)) {
        player.x = behindX; player.y = behindY;
      }
      player.facing = gs.calculateFacing(player.x, player.y, targetMob.x, targetMob.y);
      applySkillDamage(targetMob, Math.round(player.dmg * skill.dmgMult), true);
      gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'shadowstep', skillSlot: slot, cooldown, startX, startY, x: targetMob.x, y: targetMob.y, playerId: player.id });
    }
  },

  smoke_screen: (c) => {
    const { gs, skill, player, slot, cooldown, runeId } = c;
    player.smokeScreenTimer = skill.duration || 3.5;
    player.sprintTimer = skill.duration || 3.5;
    gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '🌫️ VANISH! (Stealth & 100% Crit)', color: '#a855f7' });
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'smoke_screen', skillSlot: slot, cooldown, x: player.x, y: player.y, playerId: player.id });
  },

  death_blossom: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage } = c;
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'death_blossom', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
      }
    }
  },

  poison_darts: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage, computeDashVector } = c;
    const { normX, normY } = computeDashVector();
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'poison_darts', skillSlot: slot, cooldown, x: player.x, y: player.y, dirX: normX, dirY: normY, playerId: player.id });
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
        const p = gs.players.get(player.id);
        if (!p || p !== player || p.isDead || p.zone !== zone0 || (p.dungeonInstanceId || null) !== inst0) { clearInterval(tick); return; }
        const u = Math.min(1, (Date.now() - startedAt) / DURATION_MS);
        gs.runAs(player.id, () => {
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
  },

  caltrops: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage } = c;
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'caltrops', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), false);
        mob.chillTimer = skill.slowDuration || 4.0;
      }
    }
  },

  venomous_barrage: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage, computeDashVector } = c;
    const { normX, normY } = computeDashVector();
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'venomous_barrage', skillSlot: slot, cooldown, x: player.x, y: player.y, dirX: normX, dirY: normY, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
      if (dist <= 7.5) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
        mob.poisonTimer = 5.0;
        mob.poisonDmg = 18;
      }
    }
  },

  phantom_assassins: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage } = c;
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'phantom_assassins', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
      }
    }
  },

  assassins_cull: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage } = c;
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
      gs.emitZone(player.zone, 'floating_text', { x: cullTarget.x, y: cullTarget.y - 0.8, text: isExecute ? '🩸 EXECUTION CULL (x2 DMG)!' : '🗡️ Cull Strike!', color: '#ef4444', size: isExecute ? 22 : 16 });
      gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'assassins_cull', skillSlot: slot, cooldown, x: cullTarget.x, y: cullTarget.y, playerId: player.id });
    }
  },

  abyssal_tether: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap } = c;
    gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.7, text: '⛓️ ABYSSAL SHADOW CHAINS (ROOT)', color: '#a855f7', size: 18 });
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'abyssal_tether', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
        mob.x = player.x + (mob.x - player.x) * 0.25;
        mob.y = player.y + (mob.y - player.y) * 0.25;
        mob.chillTimer = skill.rootDuration || 3.0;
      }
    }
  },

  blade_dance: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage } = c;
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'blade_dance', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
      }
    }
  },

  eclipse_execution: (c) => {
    const { gs, skill, player, slot, cooldown, runeId, mobsMap, applySkillDamage } = c;
    gs.emitZone(player.zone, 'floating_text', { x: player.x, y: player.y - 0.9, text: '🌑 VOID ECLIPSE OMNISLASH!', color: '#c084fc', size: 24 });
    gs.emitZone(player.zone, 'skill_fx', { rune: runeId, type: 'eclipse_execution', skillSlot: slot, cooldown, x: player.x, y: player.y, radius: skill.radius, playerId: player.id });
    for (const mob of mobsMap.values()) {
      if (mob.state === 'dead') continue;
      if (Math.hypot(mob.x - player.x, mob.y - player.y) <= skill.radius) {
        applySkillDamage(mob, Math.round(player.dmg * skill.dmgMult), true);
      }
    }
  }

};
