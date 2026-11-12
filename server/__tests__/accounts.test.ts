// Save/load round trip against a throwaway DATA_DIR (never the real accounts.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

test('accountManager: register + saveCharacter round-trips through disk', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // read by accountManager at import time
  try {
    const { default: am } = await import('../accountManager');
    am.init();
    const reg = am.register('roundtrip', 'secret1', { name: 'Tester', characterClass: 'warrior', level: 1, gold: 50 });
    assert.equal(reg.success, true);
    const ok = am.saveCharacter('roundtrip', {
      name: 'Tester', characterClass: 'warrior', level: 7, exp: 123, gold: 999,
      inventory: { healthPotions: 4, manaPotions: 1, maxSlots: 150, items: [{ id: 'ancient_ruby', count: 2 }] },
      zone: 'town', x: 11, y: 12,
    }, 0);
    assert.equal(ok, true);
    const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'accounts.json'), 'utf-8'));
    const ch = onDisk.roundtrip.characters[0];
    assert.equal(ch.level, 7);
    assert.equal(ch.gold, 999);
    assert.equal(ch.inventory.healthPotions, 4);
    assert.deepEqual(ch.inventory.items, [{ id: 'ancient_ruby', count: 2 }]);
    assert.equal(ch.x, 11);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
