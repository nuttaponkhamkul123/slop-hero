// Smoke test: boots the real server on an isolated port + temp data dir, plays briefly, checks for life.
// Never touches server/data/*.json (DATA_DIR is a throwaway folder) or the user's port-3000 server.
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import assert from 'assert';
import { io } from 'socket.io-client';
import { ITEMS } from '../server/items';

const PORT = Number(process.env.SMOKE_PORT) || 3917;
const URL = `http://localhost:${PORT}`;
const root = path.resolve(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-smoke-'));
const FIXTURE_DIR = path.join(root, 'scripts/fixtures');
const UPDATE_FIXTURES = process.env.SMOKE_UPDATE_FIXTURES === '1';
const failures: string[] = [];
const fail = (m: string) => { failures.push(m); console.error('FAIL:', m); };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function waitForServer(ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(URL); if (r.ok || r.status < 500) return true; } catch { /* not up yet */ }
    await sleep(250);
  }
  return false;
}

// Remove what is random per run (socket id, spawn position, item socket rolls) from an init_game player.
function normalizePlayer(player: any) {
  const p = JSON.parse(JSON.stringify(player));
  for (const k of ['id', 'x', 'y']) delete p[k];
  for (const it of [...(p.inventory?.items || []), ...Object.values(p.equipment || {})] as any[]) {
    if (it && typeof it === 'object') { delete it.maxSockets; delete it.sockets; delete it.brokenSockets; }
  }
  return p;
}

// Join (as a guest, or with an account token + slot) and return the init_game payload.
async function joinGame(payload: any): Promise<any> {
  const s = io(URL, { transports: ['websocket'] });
  await new Promise<void>((res, rej) => { s.on('connect', () => res()); setTimeout(() => rej(new Error('connect timeout')), 10000); });
  const init: any = await new Promise((res, rej) => {
    s.once('init_game', res);
    s.emit('join_game', payload);
    setTimeout(() => rej(new Error('no init_game for ' + JSON.stringify(payload).slice(0, 80))), 10000);
  });
  s.disconnect();
  await sleep(150); // let the server process the disconnect (and save) before the next join
  return init;
}

// Compare with scripts/fixtures/<name>.json, or (SMOKE_UPDATE_FIXTURES=1) write it from the current behavior.
function writeOrAssert(name: string, data: any) {
  const file = path.join(FIXTURE_DIR, name + '.json');
  const normalized = JSON.parse(JSON.stringify(data));
  if (UPDATE_FIXTURES) {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
    console.log('smoke: fixture WRITTEN:', file);
    return;
  }
  const want = JSON.parse(fs.readFileSync(file, 'utf8'));
  try { assert.deepStrictEqual(normalized, want); console.log('smoke: fixture matches:', name); }
  catch (e: any) { fail(`${name}: start player differs from scripts/fixtures/${name}.json:\n` + String(e.message).slice(0, 1500)); }
}

async function checkClassFixture() {
  const got: Record<string, any> = {};
  for (const cls of ['warrior', 'mage', 'rogue', 'banana']) { // 'banana' = invalid class -> warrior
    const init = await joinGame({ name: 'Fixture', characterClass: cls });
    const payloadHash = crypto.createHash('sha1').update(JSON.stringify([init.allSkills, init.allSkillsCatalog, init.skillRunes])).digest('hex');
    got[cls] = { player: normalizePlayer(init.player), payloadHash };
  }
  writeOrAssert('class-join', got);
}

// ---- saved characters: seeded into the temp accounts.json BEFORE the server starts ----
const SEED_USER = 'seeduser', SEED_PASSWORD = 'seedpw1';
const item = (id: string, count = 1) => ({ ...(ITEMS as any)[id], count });

function seedAccounts() {
  const salt = 'seed-salt-0123456789abcdef';
  const passwordHash = crypto.pbkdf2Sync(SEED_PASSWORD, salt, 1000, 64, 'sha512').toString('hex');
  const characters = [
    { // 0: a rich mage with everything set, an old 30-slot bag and a warrior weapon equipped (moved back to the bag on join)
      name: 'Seeded Mage', characterClass: 'mage', level: 7, exp: 123, expNext: 999, skillPoints: 3,
      skills: { firestorm: 2, frost_nova: 1 },
      equippedSkills: { slot1: 'frost_nova', slot2: 'firestorm', slot3: 'black_hole', dash: 'arcane_blink', runes: { slot1: 'flame', slot2: 'none', slot3: 'none', dash: 'none' } },
      jobLevel: 3, jobExp: 40, spLoadouts: {},
      equipment: { weapon: item('iron_blade'), armor: item('mystic_robe'), helmet: item('iron_helm'), boots: null, gloves: null, cape: null, ring: null },
      gold: 4321,
      inventory: { healthPotions: 5, manaPotions: 1, kills: 12, maxSlots: 30, items: [item('ancient_ruby', 2), item('revival_stone')] },
      storage: { maxSlots: 60, items: [item('revival_stone', 3)] },
      zone: 'town', x: 5, y: 6,
    },
    { name: 'Bare Warrior', characterClass: 'warrior', level: 3 }, // 1: almost nothing saved: every default applies
    { // 2: zero values that must NOT fall back to defaults, and malformed containers that must
      name: 'Zero Rogue', characterClass: 'rogue', level: 12, skillPoints: 0, gold: 0,
      inventory: { healthPotions: 1, manaPotions: 0 }, storage: { maxSlots: 0 },
    },
  ];
  const account = { username: SEED_USER, salt, passwordHash, createdAt: 1700000000000, lastLogin: 1700000000000, role: 'player', characters };
  fs.writeFileSync(path.join(dataDir, 'accounts.json'), JSON.stringify({ [SEED_USER]: account }, null, 2), 'utf8');
}

async function checkSavedFixture() {
  const s = io(URL, { transports: ['websocket'] });
  await new Promise<void>((res, rej) => { s.on('connect', () => res()); setTimeout(() => rej(new Error('connect timeout')), 10000); });
  const login: any = await new Promise(res => { s.once('account_login_response', res); s.emit('account_login', { username: SEED_USER, password: SEED_PASSWORD }); });
  s.disconnect();
  if (!login || !login.success || !login.token) { fail('seed login failed: ' + JSON.stringify(login)); return; }
  const got: Record<string, any> = {};
  for (const slot of [0, 1, 2]) got['slot' + slot] = normalizePlayer((await joinGame({ token: login.token, slot })).player);
  writeOrAssert('saved-join', got);
}

async function main() {
  seedAccounts();
  const child = spawn(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), 'server/index.ts'], {
    cwd: root, env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverErr = '';
  child.stderr.on('data', d => { serverErr += d.toString(); });
  let exited = false;
  child.on('exit', () => { exited = true; });

  try {
    if (!(await waitForServer(40000))) { fail('server did not start within 40s'); return; }
    const socket = io(URL, { transports: ['websocket'] });
    let ticks = 0, inited = false;
    const errors: string[] = [];
    socket.on('connect_error', e => errors.push('connect_error ' + e.message));
    socket.on('init_game', () => { inited = true; });
    socket.on('game_tick', () => { ticks++; });

    await new Promise<void>((res, rej) => { socket.on('connect', () => res()); setTimeout(() => rej(new Error('socket connect timeout')), 10000); });

    const reg: any = await new Promise(res => {
      socket.once('account_register_response', res);
      socket.emit('account_register', { username: 'smokeuser', password: 'smokepw', heroName: 'SmokeHero', characterClass: 'warrior' });
    });
    if (!reg || !reg.success || !reg.token) { fail('register failed: ' + JSON.stringify(reg)); return; }

    socket.emit('join_game', { token: reg.token, slot: 0 });
    await sleep(1500);
    if (!inited) fail('never received init_game after join_game');

    socket.emit('player_input', { type: 'click_move', x: 22, y: 24 });
    await sleep(500);
    socket.emit('player_attack', { targetId: 'nonexistent', targetType: 'mob' });
    await sleep(1500);

    if (ticks < 5) fail(`only ${ticks} game_tick messages received (expected >= 5)`);
    if (errors.length) fail('socket errors: ' + errors.join('; '));
    if (exited) fail('server process exited unexpectedly');
    console.log(`smoke: init_game=${inited} game_ticks=${ticks}`);
    socket.disconnect();
    await checkClassFixture();
    await checkSavedFixture();
  } finally {
    if (!exited) child.kill(); // only the child we spawned
    await sleep(300);
    fs.rmSync(dataDir, { recursive: true, force: true });
    if (/TypeError|ReferenceError|Unhandled|Error:/.test(serverErr)) fail('server stderr contains errors:\n' + serverErr.slice(0, 1500));
  }
}

main().catch(e => fail(String(e))).finally(() => {
  if (failures.length) { console.error(`\nSMOKE FAILED (${failures.length})`); process.exit(1); }
  console.log('SMOKE OK'); process.exit(0);
});
