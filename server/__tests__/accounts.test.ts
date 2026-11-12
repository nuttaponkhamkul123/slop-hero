// Save/load round trip against a throwaway DATA_DIR (never the real accounts.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

test('accountManager: register + saveCharacter round-trips through disk', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  let made: any; // the manager instance of this test (flushed before the folder is deleted)
  process.env.DATA_DIR = dir; // read by accountManager at import time
  try {
    const { default: am } = await import('../accountManager');
    made = am;
    am.init();
    const reg = am.register('roundtrip', 'secret1', { name: 'Tester', characterClass: 'warrior', level: 1, gold: 50 });
    assert.equal(reg.success, true);
    const ok = am.saveCharacter('roundtrip', {
      name: 'Tester', characterClass: 'warrior', level: 7, exp: 123, gold: 999,
      inventory: { healthPotions: 4, manaPotions: 1, maxSlots: 150, items: [{ id: 'ancient_ruby', count: 2 }] },
      zone: 'town', x: 11, y: 12,
    }, 0);
    assert.equal(ok, true);
    await am.flush();
    const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'accounts.json'), 'utf-8'));
    const ch = onDisk.roundtrip.characters[0];
    assert.equal(ch.level, 7);
    assert.equal(ch.gold, 999);
    assert.equal(ch.inventory.healthPotions, 4);
    assert.deepEqual(ch.inventory.items, [{ id: 'ancient_ruby', count: 2 }]);
    assert.equal(ch.x, 11);
  } finally {
    if (made) await made.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('accountManager: a corrupt accounts.json is backed up and never overwritten', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  let made: any; // the manager instance of this test (flushed before the folder is deleted)
  fs.writeFileSync(path.join(dir, 'accounts.json'), '{ this is not json', 'utf-8');
  try {
    const { default: shared } = await import('../accountManager');
    const am: any = (made = new (shared.constructor as any)(dir)); // constructor loads (and fails to parse) the corrupt file
    assert.equal(am.loadFailed, true);
    am.register('someone', 'secret1', { name: 'X', characterClass: 'warrior' });
    am.saveAccounts();
    assert.equal(fs.readFileSync(path.join(dir, 'accounts.json'), 'utf-8'), '{ this is not json');
    assert.ok(fs.readdirSync(dir).some(f => f.startsWith('accounts.corrupt-')));
  } finally {
    if (made) await made.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('accountManager: saveCharacter(flush=false) defers the disk write', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  let made: any; // the manager instance of this test (flushed before the folder is deleted)
  try {
    const { default: shared } = await import('../accountManager');
    const am: any = (made = new (shared.constructor as any)(dir));
    am.register('batcher', 'secret1', { name: 'B', characterClass: 'warrior', level: 1 });
    let writes = 0;
    const orig = am.saveAccounts.bind(am);
    am.saveAccounts = () => { writes++; orig(); };
    am.saveCharacter('batcher', { name: 'B', characterClass: 'warrior', level: 5 }, 0, false);
    assert.equal(writes, 0);
    assert.equal(am.accounts.batcher.characters[0].level, 5); // memory updated
    am.saveCharacter('batcher', { name: 'B', characterClass: 'warrior', level: 6 }, 0);
    assert.equal(writes, 1); // default still flushes
    await am.flush();
  } finally {
    if (made) await made.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
