// makeStarterCharacter output is locked to a fixture captured BEFORE the hero class table refactor.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/starterCharacters.json'), 'utf8'));

test('makeStarterCharacter: matches the pre-refactor fixture for every class and edge case', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // gameServer imports the accountManager singleton: keep it away from real accounts
  try {
    const mod: any = await import('../gameServer');
    const GameServer = mod.default || mod.GameServer;
    const make = GameServer.prototype.makeStarterCharacter;
    const got: any = {};
    for (const cls of ['warrior', 'mage', 'rogue', 'banana', undefined]) got[String(cls)] = make.call({}, 'Hero', cls);
    got.longName = make.call({}, '   ABCDEFGHIJKLMNOPQRSTUVWXYZ   ', 'mage');
    got.noName = make.call({}, '', 'rogue');
    assert.deepEqual(JSON.parse(JSON.stringify(got)), fixture);
  } finally {
    await (await import('../accountManager')).default.flush(); // let the startup save finish before deleting its folder
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
