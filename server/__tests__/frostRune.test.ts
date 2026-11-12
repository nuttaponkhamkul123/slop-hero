// Frost rune: a successful freeze roll must set the field the game actually reads (frozenTimer).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function loadApplyDamage() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // keep the accountManager singleton away from real accounts
  const mod: any = await import('../gameServer');
  const GS = mod.default || mod.GameServer;
  const cfg: any = await import('../config/constants');
  const { CombatSystem } = await import('../systems/CombatSystem');
  // the system's method with a stand-in server (the system reaches the server as this.gs)
  const apply = (fake: any, p: any, m: any, dmg: number) => (new CombatSystem(fake) as any).applyDamageToMob(p, m, dmg);
  return { dir, apply, cfg };
}

// `this` stand-in: frost rune x4, everything else a harmless no-op
const fakeServer = () => new Proxy({ getWeaponRuneCounts: () => ({ frost: 4, flame: 0, tempest: 0, vampiric: 0 }), players: new Map() } as any, {
  get: (t, k) => (k in t ? t[k] : () => undefined),
});
const player = () => ({ id: 'p1', zone: 'town', level: 10, x: 0, y: 0, equipment: {}, dmg: 10 });
const mob = (extra: any = {}) => ({ id: 'm1', level: 10, hp: 1e9, maxHp: 1e9, def: 0, x: 1, y: 1, state: 'idle', buffs: [], ...extra });

test('frost rune freezes through frozenTimer (and sets chill, not the dead chillSlow field)', async () => {
  const { dir, apply, cfg } = await loadApplyDamage();
  const realRandom = Math.random;
  try {
    Math.random = () => 0; // always rolls "freeze"
    const m: any = mob();
    apply(fakeServer(), player(), m, 50);
    assert.equal(m.frozenTimer, cfg.FREEZE_SECONDS);
    assert.equal(m.frozenKind, 'ice');
    assert.equal(m.chillTimer, 3.5);
    assert.equal('chillSlow' in m, false);
    assert.equal('freezeTimer' in m, false);

    const boss: any = mob({ isBoss: true });
    apply(fakeServer(), player(), boss, 50);
    assert.equal(boss.frozenTimer, cfg.BOSS_FREEZE_SECONDS);

    const stasis: any = mob({ frozenTimer: 3, frozenKind: 'time' }); // Chrono stasis must stay stasis
    apply(fakeServer(), player(), stasis, 50);
    assert.equal(stasis.frozenTimer, 3);
    assert.equal(stasis.frozenKind, 'time');
  } finally {
    Math.random = realRandom;
    await (await import('../accountManager')).default.flush(); // let the startup save finish before deleting its folder
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('frost rune does not freeze when the roll fails', async () => {
  const { dir, apply } = await loadApplyDamage();
  const realRandom = Math.random;
  try {
    Math.random = () => 0.99;
    const m: any = mob();
    apply(fakeServer(), player(), m, 50);
    assert.ok(!(m.frozenTimer > 0));
    assert.equal(m.chillTimer, 3.5);
  } finally {
    Math.random = realRandom;
    await (await import('../accountManager')).default.flush(); // let the startup save finish before deleting its folder
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
