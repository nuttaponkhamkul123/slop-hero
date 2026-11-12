// Smoke test: boots the real server on an isolated port + temp data dir, plays briefly, checks for life.
// Never touches server/data/*.json (DATA_DIR is a throwaway folder) or the user's port-3000 server.
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { io } from 'socket.io-client';

const PORT = Number(process.env.SMOKE_PORT) || 3917;
const URL = `http://localhost:${PORT}`;
const root = path.resolve(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-smoke-'));
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

async function main() {
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
