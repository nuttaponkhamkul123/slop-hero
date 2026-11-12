// Status effects on monsters, ticked in this order every update (Phase D4 of docs/REFACTOR_PLAN.md). Before, the
// ticks were inline in MobAISystem.updateMobsList. An effect's tick returns 'dead' when it killed the monster, which
// ends that monster's update for the tick (a damage-over-time kill is credited through ctx.dotOwner()).
// The applying side of these effects (chill, burn, poison, scorch, frost, conduct, ...) stays where each skill, rune
// or passive sets it: those sites differ in strength and stacking, so they are not merged here.

export interface MobEffectCtx {
  gs: any;
  zone: string;
  instanceId: string | null;
  /** the last hero who hit the mob, if still in this zone and alive (gets the credit for a DoT kill) */
  dotOwner: () => any;
}

export interface MobEffect {
  id: string;
  tick(mob: any, dt: number, ctx: MobEffectCtx): 'dead' | void;
}

export const MOB_EFFECTS: MobEffect[] = [
  {
    id: 'chill',
    tick(mob, dt) {
      if (mob.chillTimer > 0) {
        mob.chillTimer = Math.max(0, mob.chillTimer - dt);
      }
    }
  },
  {
    id: 'burn',
    tick(mob, dt, { gs, zone, instanceId, dotOwner }) {
      if (mob.burnTimer > 0) {
        mob.burnTimer = Math.max(0, mob.burnTimer - dt);
        mob.burnTickTimer = (mob.burnTickTimer || 0) - dt;
        if (mob.burnTickTimer <= 0) {
          mob.burnTickTimer = 0.6;
          const dotDmg = Math.max(1, Math.round(mob.burnDmg || 8));
          mob.hp -= dotDmg;
          gs.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.7, text: `🔥 -${dotDmg}`, color: '#f97316', size: 14 }, instanceId);
          if (mob.hp <= 0) {
            gs.handleMobDeath(mob, dotOwner());
            return 'dead';
          }
        }
        if (mob.burnTimer <= 0) mob.burnDmg = 0; // next ignite starts fresh
      }
    }
  },
  {
    id: 'poison',
    tick(mob, dt, { gs, zone, instanceId, dotOwner }) {
      if (mob.poisonTimer > 0) {
        mob.poisonTimer = Math.max(0, mob.poisonTimer - dt);
        mob.poisonTickTimer = (mob.poisonTickTimer || 0) - dt;
        if (mob.poisonTickTimer <= 0) {
          mob.poisonTickTimer = 0.8;
          const dotDmg = Math.max(1, Math.round(mob.poisonDmg || 6));
          mob.hp -= dotDmg;
          const stackTag = mob.poisonStacks > 1 ? ` x${mob.poisonStacks}` : '';
          gs.emitZone(zone, 'floating_text', { x: mob.x, y: mob.y - 0.7, text: `☠️ -${dotDmg}${stackTag}`, color: '#22c55e', size: 14 }, instanceId);
          if (mob.hp <= 0) {
            gs.handleMobDeath(mob, dotOwner());
            return 'dead';
          }
        }
        if (mob.poisonTimer <= 0) { mob.poisonDmg = 0; mob.poisonStacks = 0; }
      }
    }
  },
  { id: 'shadowMark', tick(mob, dt) { if (mob.shadowMarkTimer > 0) mob.shadowMarkTimer = Math.max(0, mob.shadowMarkTimer - dt); } },
  { id: 'static', tick(mob, dt) { if (mob.staticCharge > 0) mob.staticCharge = Math.max(0, mob.staticCharge - dt); } },
  { id: 'conduct', tick(mob, dt) { if (mob.conductTimer > 0) { mob.conductTimer -= dt; if (mob.conductTimer <= 0) mob.conduct = 0; } } },
  { id: 'scorch', tick(mob, dt) { if (mob.scorchTimer > 0) { mob.scorchTimer -= dt; if (mob.scorchTimer <= 0) mob.scorchStacks = 0; } } },
  { id: 'frost', tick(mob, dt) { if (mob.frostTimer > 0) { mob.frostTimer -= dt; if (mob.frostTimer <= 0) mob.frostStacks = 0; } } }
];
