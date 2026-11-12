// lootEntryToItem / lootEntryName: locked to a fixture captured before they moved to the item factory
// (UPDATE_FIXTURES=1 rewrites it from the current behavior).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/lootEntries.json');

const ENTRIES: Record<string, any> = {
  nullEntry: null,
  gold: { type: 'gold', amount: 1500 },
  goldBig: { type: 'gold', amount: 1234567 },
  healthPotion: { type: 'item', itemId: 'health_potion', amount: 3 },
  healthPotionNoAmount: { type: 'item', itemId: 'health_potion' },
  manaPotion: { type: 'item', itemId: 'mana_potion', amount: 2 },
  customData: { type: 'item', itemId: 'sp_card', customItemData: { id: 'sp_card', name: 'Custom Card', rarity: 'epic', custom: true }, amount: 1 },
  customDataBig: { type: 'item', itemId: 'x', customItemData: { id: 'x', name: 'Stack Thing', count: 99 }, amount: 4 },
  knownItem: { type: 'item', itemId: 'ancient_ruby', amount: 2 },
  knownItemNoAmount: { type: 'item', itemId: 'revival_stone' },
  unknownItem: { type: 'item', itemId: 'does_not_exist', amount: 5 },
  unknownNoAmount: { type: 'item', itemId: 'does_not_exist' },
  noItemId: { type: 'item', amount: 7 },
};

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // the server module imports the accountManager singleton
  const mod: any = await import('../gameServer');
  const GS = mod.default || mod.GameServer;
  const fake: any = { lootEntryName: GS.prototype.lootEntryName };
  return { dir, toItem: (e: any) => GS.prototype.lootEntryToItem.call(fake, e), name: (e: any) => GS.prototype.lootEntryName.call(fake, e) };
}

test('lootEntryToItem / lootEntryName match the pre-refactor fixture', async () => {
  const { dir, toItem, name } = await load();
  try {
    const got: any = { items: {}, names: {} };
    for (const [k, e] of Object.entries(ENTRIES)) {
      got.items[k] = JSON.parse(JSON.stringify(toItem(e) ?? null));
      if (e) got.names[k] = e.type === 'gold' || e.itemId !== undefined || e.customItemData ? name(e) : null;
    }
    if (process.env.UPDATE_FIXTURES === '1') { fs.writeFileSync(FIXTURE, JSON.stringify(got, null, 2) + '\n', 'utf8'); return; }
    assert.deepEqual(got, JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
  } finally {
    await (await import('../accountManager')).default.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
