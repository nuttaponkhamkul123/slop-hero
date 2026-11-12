// Locks in the moved skill/potion data (and that the 0.4x cooldown scaling runs exactly once).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_CLASS_SKILLS, CLASS_SKILLS_CATALOG, CLASS_SKILLS, DEFAULT_EQUIPPED_SKILLS, DEFAULT_SKILL_FOR_SLOT } from '../data/skills';
import { POTIONS, POTION_COOLDOWN_MS } from '../data/potions';

test('skills: cooldowns are scaled by 0.4 exactly once', () => {
  assert.equal((ALL_CLASS_SKILLS as any).whirlwind.cooldown, 1.4); // authored 3.5
});

test('skills: catalog and class tables share the same skill objects', () => {
  assert.equal(CLASS_SKILLS.warrior.skill1, (ALL_CLASS_SKILLS as any).whirlwind);
  for (const cls of ['warrior', 'mage', 'rogue'] as const) {
    assert.ok(CLASS_SKILLS_CATALOG[cls].length > 0);
    assert.ok(CLASS_SKILLS_CATALOG[cls].every((s: any) => s.class === cls));
    for (const slot of ['slot1', 'slot2', 'slot3', 'dash'] as const) {
      assert.ok((ALL_CLASS_SKILLS as any)[(DEFAULT_EQUIPPED_SKILLS as any)[cls][slot]], `${cls}.${slot} default skill exists`);
    }
  }
  assert.equal(Object.keys(ALL_CLASS_SKILLS).length, Object.values(CLASS_SKILLS_CATALOG).reduce((n, a) => n + a.length, 0));
});

test('skills: default skill lookup falls back to whirlwind', () => {
  assert.equal(DEFAULT_SKILL_FOR_SLOT({ characterClass: 'mage' }, 'slot1'), (ALL_CLASS_SKILLS as any).firestorm);
  assert.equal(DEFAULT_SKILL_FOR_SLOT({ characterClass: 'mage' }, 'nope'), (ALL_CLASS_SKILLS as any).whirlwind);
});

test('potions: tuning values', () => {
  assert.deepEqual(POTIONS, {
    health_potion: { kind: 'health', pct: 0.45 },
    greater_health_potion: { kind: 'health', pct: 0.75 },
    mana_potion: { kind: 'mana', pct: 0.5 },
    greater_mana_potion: { kind: 'mana', pct: 0.8 },
  });
  assert.deepEqual(POTION_COOLDOWN_MS, { health: 10000, mana: 5000 });
});
