// Class skills: casting every slot (class skills, weapon abilities, dispatch to SP skills), loadout customizing, skill resolution and the armor-set cast hooks.
// Moved verbatim out of GameServer (Phase C of docs/REFACTOR_PLAN.md): `this` is the server, reached as this.gs;
// GameServer keeps one-line forwarding methods, so no call site changed.
import type { GameServer } from '../gameServer';
import { BASE_SKILL_HANDLERS } from '../skills/baseSkillHandlers';
import { weaponAbility } from '../items';
import * as SP from '../spCards';
import { SKILL_DAMAGE_SCALE, BLOOD_AURA_START_HP, ULT_COOLDOWN, ULT_CHARGE_MAX, ULT_LOCK_SECONDS, SHADOW_SKIPS_SHAPES } from '../config/constants';
import { ALL_CLASS_SKILLS, SKILL_RUNES, DEFAULT_EQUIPPED_SKILLS, CLIENT_SKILL_SLOTS, DEFAULT_SKILL_FOR_SLOT } from '../data/skills';
import type { Player, Mob } from '../entities/types';

export class SkillSystem {
  constructor(private readonly gs: GameServer) {}

  handleCustomizeSkill(socketId: any, data: any) {
    const player = this.gs.players.get(socketId);
    if (!player || player.isDead) return;
    if (player.spTransformed) return this.gs.customizeSpSkill(player, data);

    if (!data || !data.slot) return;
    const validSlots = ['slot1', 'slot2', 'slot3', 'dash'];
    if (!validSlots.includes(data.slot)) return;

    if (!player.equippedSkills) {
      player.equippedSkills = JSON.parse(JSON.stringify((DEFAULT_EQUIPPED_SKILLS as any)[player.characterClass] || DEFAULT_EQUIPPED_SKILLS.warrior));
    }
    if (!player.equippedSkills.runes) {
      player.equippedSkills.runes = { slot1: 'none', slot2: 'none', slot3: 'none', dash: 'none' };
    }

    if (data.skillId) {
      const skillDef = (ALL_CLASS_SKILLS as any)[data.skillId];
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
      if ((SKILL_RUNES as any)[data.rune]) {
        player.equippedSkills.runes[data.slot] = data.rune;
      }
    }

    const socket = this.gs.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_updated', player);
      socket.emit('custom_skills_updated', {
        equippedSkills: player.equippedSkills
      });
      const skillName = (ALL_CLASS_SKILLS as any)[player.equippedSkills[data.slot]] ? (ALL_CLASS_SKILLS as any)[player.equippedSkills[data.slot]].name : player.equippedSkills[data.slot];
      const slotKey = data.slot === 'slot1' ? 'Q' : data.slot === 'slot2' ? 'E' : data.slot === 'slot3' ? 'R' : 'Shift';
      const runeDef = (SKILL_RUNES as any)[player.equippedSkills.runes[data.slot]] || SKILL_RUNES.none;

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
  resolvePlayerSkill(player: Player, slot: any, skillId: any) {
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
      const stages = card.signature.stages.map((st: any) => Object.assign({}, st, { dmgMult: st.dmgMult * k }));
      return Object.assign({}, stages[0], { cooldown: ULT_COOLDOWN, ultStages: stages });
    }
    const base = (ALL_CLASS_SKILLS as any)[skillId] || DEFAULT_SKILL_FOR_SLOT(player, slot);
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
      player.equippedSkills = JSON.parse(JSON.stringify((DEFAULT_EQUIPPED_SKILLS as any)[player.characterClass] || DEFAULT_EQUIPPED_SKILLS.warrior));
    }
    if (!player.skillCooldowns) {
      player.skillCooldowns = { slot1: 0, slot2: 0, slot3: 0, dash: 0, skill1: 0, skill2: 0 };
    }
    // Nightblade: casting Phantom Shuriken again while its stars are out calls them back (free, ignores cooldown)
    // Dragoon: casting Sky Lance again while it is planted dives onto it (also free)
    const recast = (o: any) => !!(o && o.slot === slot && Date.now() < o.until && player.equippedSkills && player.equippedSkills[slot] === o.skillId
      && o.zone === player.zone && o.instanceId === (player.dungeonInstanceId || null));
    const recall = recast(player.nbStars) || recast(player.dgSpear);
    if (!recall && (player.skillCooldowns[slot] > 0 || (player.skillCooldowns[rawSlot] > 0))) return;

    const socket0 = this.gs.io.sockets.sockets.get(socketId);
    const skillId = slot === 'weapon' ? 'weapon' : slot === 'ult' ? 'ult'
      : player.equippedSkills[slot] || ((DEFAULT_EQUIPPED_SKILLS as any)[player.characterClass] && ((DEFAULT_EQUIPPED_SKILLS as any)[player.characterClass] as any)[slot]) || 'whirlwind';
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
    const applySkillDamage = (mob: Mob, baseDmg: any, canCrit = false) => {
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
        const vec = (facingVectors as any)[player.facing] || { dx: 1, dy: 0 };
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
    const handler = Object.prototype.hasOwnProperty.call(BASE_SKILL_HANDLERS, skill.spShape ? 'sp_skill' : skill.id) ? BASE_SKILL_HANDLERS[skill.spShape ? 'sp_skill' : skill.id] : null;
    if (handler) {
      handler({ gs: this.gs, player, skill, slot, rawSlot, cooldown, runeId, mobsMap, playerTalents, skillData, socket, recall, applySkillDamage, computeDashVector, mpCost, runeCounts, skillCritChance, socket0, skillId });
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
  applySetOnSkillCast(player: Player, cooldown: any) {
    if (!player.set4) return;
    const st = player.set4.stormcaller;
    if (st) player.staticStacks = Math.min(st.stacks, (player.staticStacks || 0) + 1);
    const ec = player.set4.eclipse;
    if (ec && cooldown >= ec.flipCooldown) this.gs.flipEclipse(player);
  }

  flipEclipse(player: Player) {
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
