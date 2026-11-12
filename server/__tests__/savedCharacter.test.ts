// What AccountManager.saveCharacter writes for a character: locked to a fixture captured from the
// pre-refactor code (UPDATE_FIXTURES=1 rewrites it from the current behavior).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/savedCharacters.json');
const NOW = 1700000000000;

const cases: Record<string, any> = {
  full: {
    name: 'Full', characterClass: 'mage', level: 9, exp: 250, expNext: 700, skillPoints: 4,
    skills: { firestorm: 3 }, equippedSkills: { slot1: 'firestorm', runes: { slot1: 'flame' } },
    jobLevel: 5, spLoadouts: { sp_x: { slot1: 'a' } }, jobExp: 77,
    equipment: { weapon: { id: 'archmage_staff', count: 1 }, armor: null },
    gold: 1234, inventory: { healthPotions: 9, manaPotions: 8, maxSlots: 200, items: [{ id: 'ancient_ruby', count: 3 }] },
    storage: { maxSlots: 70, items: [{ id: 'revival_stone', count: 1 }] }, zone: 'frostfell', x: 11.5, y: 22.25,
    ignoredField: 'must not be saved', hp: 55, mp: 33,
  },
  minimal: { name: 'Minimal', characterClass: 'rogue' },
  falsyNumbers: { name: 'Zeros', characterClass: 'warrior', level: 0, exp: 0, skillPoints: 0, jobLevel: 0, jobExp: 0, gold: 0, x: 0, y: 0 },
  transformedWithBase: {
    name: 'T1', characterClass: 'warrior', spTransformed: true,
    baseEquippedSkills: { slot1: 'base_skill' }, equippedSkills: { slot1: 'card_skill' },
  },
  transformedWithoutBase: { name: 'T2', characterClass: 'warrior', spTransformed: true, equippedSkills: { slot1: 'card_skill' } },
  notTransformed: { name: 'T3', characterClass: 'warrior', baseEquippedSkills: { slot1: 'base_skill' }, equippedSkills: { slot1: 'real_skill' } },
  noSkillsAtAll: { name: 'T4', characterClass: 'mage', equippedSkills: undefined },
};

test('saveCharacter: whitelist, defaults and SP-transform handling match the pre-refactor fixture', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  const realNow = Date.now;
  try {
    const { default: shared } = await import('../accountManager');
    const am: any = new (shared.constructor as any)(dir);
    am.register('savetester', 'secret1', { name: 'seed', characterClass: 'warrior' });
    Date.now = () => NOW;
    const got: Record<string, any> = {};
    for (const [k, input] of Object.entries(cases)) {
      assert.equal(am.saveCharacter('savetester', input, 0, false), true, k);
      got[k] = JSON.parse(JSON.stringify(am.accounts.savetester.characters[0]));
    }
    Date.now = realNow;
    if (process.env.UPDATE_FIXTURES === '1') {
      fs.writeFileSync(FIXTURE, JSON.stringify(got, null, 2) + '\n', 'utf8');
      return;
    }
    assert.deepEqual(got, JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
    assert.ok(!('ignoredField' in got.full) && !('hp' in got.full));
  } finally {
    Date.now = realNow;
    await (await import('../accountManager')).default.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('saveCharacter: rejects unknown accounts, missing slots and empty input', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  try {
    const { default: shared } = await import('../accountManager');
    const am: any = new (shared.constructor as any)(dir);
    am.register('rejecter', 'secret1', { name: 'seed', characterClass: 'warrior' });
    assert.equal(am.saveCharacter('nobody', { name: 'x' }, 0, false), false);
    assert.equal(am.saveCharacter('rejecter', { name: 'x' }, 5, false), false);
    assert.equal(am.saveCharacter('rejecter', null, 0, false), false);
    assert.equal(am.saveCharacter('', { name: 'x' }, 0, false), false);
  } finally {
    await (await import('../accountManager')).default.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('toSavedCharacter (entities/savedCharacter): same fixture, pure function', async () => {
  const { toSavedCharacter } = await import('../entities/savedCharacter');
  const got: Record<string, any> = {};
  for (const [k, input] of Object.entries(cases)) got[k] = JSON.parse(JSON.stringify(toSavedCharacter(input, NOW)));
  assert.deepEqual(got, JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
});
