// End-to-end check of the world through a real server (isolated: own port, temp DATA_DIR, never touches
// server/data or the server on port 3000). Plays as the default admin account and exercises every place
// monsters and items are created: town spawns, combat + loot, field zones, a dungeon, an Eternal Rift.
//
//   npm run e2e
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { io, Socket } from 'socket.io-client';

const PORT = Number(process.env.E2E_PORT) || 3918;
const URL = `http://localhost:${PORT}`;
const root = path.resolve(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-e2e-'));
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: any, detail: any = '') {
  if (ok) { passed++; console.log(`  ok    ${name}`); }
  else { failures.push(name); console.log(`  FAIL  ${name}${detail !== '' ? '  ->  ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 300) : ''}`); }
}
async function until<T>(fn: () => T | undefined | false | null, ms: number, step = 100): Promise<T | undefined> {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v as T; await sleep(step); }
  return undefined;
}

async function waitForServer(ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { await fetch(URL); return true; } catch { await sleep(250); } }
  return false;
}

const MOB_KEYS = ['id', 'type', 'name', 'level', 'x', 'y', 'hp', 'maxHp', 'state', 'isBoss', 'buffs', 'element'];
const hasMobShape = (m: any) => MOB_KEYS.every(k => k in m) && typeof m.hp === 'number' && m.hp > 0 && m.maxHp >= m.hp && Array.isArray(m.buffs);

async function main() {
  const child = spawn(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), 'server/index.ts'], {
    cwd: root, env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverErr = '';
  child.stderr.on('data', d => { serverErr += d.toString(); });
  let exited = false;
  child.on('exit', () => { exited = true; });
  let s: Socket | null = null;

  try {
    console.log('boot');
    check('server starts', await waitForServer(60000));

    s = io(URL, { transports: ['websocket'] });
    await new Promise<void>((res, rej) => { s!.on('connect', () => res()); setTimeout(() => rej(new Error('connect timeout')), 10000); });
    let tick: any = null, zoneMsg: any = null, init: any = null;
    const events: Record<string, any[]> = {};
    const seenDungeon = new Map<string, any>(); // dungeon ticks are diffs: keep every monster seen since entering
    s.on('game_tick', (t: any) => {
      tick = t;
      for (const m of (t.dungeonMobs || [])) seenDungeon.set(m.id, { ...(seenDungeon.get(m.id) || {}), ...m });
    });
    s.on('zone_change', (z: any) => { zoneMsg = z; seenDungeon.clear(); for (const m of (z.mobs || [])) seenDungeon.set(m.id, m); });
    s.on('init_game', (g: any) => { init = g; });
    const texts: string[] = []; // floating texts (the server batches them: +11 EXP, God Mode: ON, ...)
    s.on('floating_texts', (arr: any) => { if (Array.isArray(arr)) for (const f of arr) if (f && f.text) texts.push(String(f.text)); });
    s.onAny((ev: string, data: any) => { if (ev !== 'game_tick') (events[ev] = events[ev] || []).push(data); });
    const say = async (text: string, wait = 450) => { s!.emit('send_chat', text); await sleep(wait); };
    const mobsHere = (key: 'townMobs' | 'dungeonMobs') => (tick && tick[key]) || [];
    const fieldMobsOf = (zone: string) => (tick && tick.fieldMobs && tick.fieldMobs[zone]) || [];
    const warp = async (zone: string) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        zoneMsg = null;
        await say('/warp ' + zone, 100);
        const z = await until(() => zoneMsg && zoneMsg.zone === zone && zoneMsg, 6000);
        if (z) return z;
      }
      return undefined;
    };

    console.log('account + join');
    const reg: any = await new Promise(res => { s!.once('account_register_response', res); s!.emit('account_register', { username: 'admin', password: 'adminpw1', heroName: 'E2E Admin', characterClass: 'warrior' }); });
    check('register succeeds', reg && reg.success, reg);
    check('"admin" account gets the admin role', reg && reg.account && reg.account.role === 'admin');
    s.emit('join_game', { token: reg.token, slot: 0 });
    check('init_game received', await until(() => init, 8000));
    check('starter bag has the starter items', init && init.player.inventory.items.length >= 2);
    check('game ticks flow', await until(() => tick, 3000));
    await say('/god');
    check('god mode is ON (so monsters cannot kill the test hero)', texts.includes('God Mode: ON'));

    console.log('town: admin spawn');
    await say('/spawn slime 2');
    const slimes = mobsHere('townMobs').filter((m: any) => m.name === 'Slime');
    check('2 slimes spawned', slimes.length === 2, slimes.length);
    check('spawned mobs have the full snapshot shape', slimes.length > 0 && slimes.every(hasMobShape), slimes[0]);
    await say('/spawn dragon boss');
    const boss = mobsHere('townMobs').find((m: any) => m.isBoss);
    check('boss spawned with boss name', boss && boss.name === '👑 Boss Dragon', boss && boss.name);

    console.log('town: combat and loot');
    const target = slimes[0];
    const startHp = target.hp;
    texts.length = 0;
    let hpFell = false, dead = false;
    for (let i = 0; i < 40 && !dead; i++) {
      s.emit('player_attack', { targetId: target.id, targetType: 'mob' });
      await sleep(650);
      const cur = mobsHere('townMobs').find((m: any) => m.id === target.id);
      if (cur && cur.hp < startHp) hpFell = true;
      dead = !cur || cur.state === 'dead' || cur.hp <= 0;
    }
    check('attacking lowers a spawned monster\'s HP', hpFell);
    check('the monster can be killed', dead);
    await sleep(400);
    check('the kill rewarded EXP ("+N EXP")', texts.some(t => /^\+\d+ EXP$/.test(t)), texts.slice(-6));
    console.log(`        (loot dropped on the ground: ${(events['item_dropped'] || []).length}; drops are random)`);
    console.log('second player: party and ranged attack');
    const mage: Socket = io(URL, { transports: ['websocket'] });
    try {
      await new Promise<void>((res, rej) => { mage.on('connect', () => res()); setTimeout(() => rej(new Error('mage connect timeout')), 10000); });
      const mageEvents: Record<string, any[]> = {};
      mage.onAny((ev: string, data: any) => { if (ev !== 'game_tick') (mageEvents[ev] = mageEvents[ev] || []).push(data); });
      const mageInit: any = await new Promise((res, rej) => {
        mage.once('init_game', res);
        mage.emit('join_game', { name: 'E2E Mage', characterClass: 'mage' });
        setTimeout(() => rej(new Error('mage never got init_game')), 10000);
      });
      check('a guest mage joins the same world', mageInit && mageInit.player && mageInit.player.characterClass === 'mage' && mageInit.player.maxMp > mageInit.player.maxHp, mageInit && mageInit.player && { cls: mageInit.player.characterClass, maxMp: mageInit.player.maxMp, maxHp: mageInit.player.maxHp });

      // party: the admin invites, the mage accepts
      events['party_updated'] = [];
      s.emit('party_invite', { targetPlayerId: mageInit.playerId });
      const partyUp: any = await until(() => (events['party_updated'] || [])[0], 4000);
      check('inviting creates a party led by the admin (party_updated)', !!partyUp, Object.keys(events).filter(e => e.startsWith('party')));
      const invite: any = await until(() => (mageEvents['party_invite_received'] || [])[0], 4000);
      check('the mage receives the invitation', !!invite && !!invite.partyId, invite);
      if (invite) {
        mage.emit('party_accept', { partyId: invite.partyId });
        const both: any = await until(() => (mageEvents['party_updated'] || []).find((p: any) => p && JSON.stringify(p).includes('E2E Mage') && JSON.stringify(p).includes('E2E Admin')), 4000);
        check('after accepting, the party holds both heroes', !!both);
        s.emit('party_leave');
        mage.emit('party_leave');
        await sleep(300);
      }

      // ranged attack: the mage throws a projectile at a monster the admin spawned next to the plaza
      await say('/spawn e2etarget 1');
      const tgt = mobsHere('townMobs').find((m: any) => m.type === 'e2etarget');
      check('a target monster is in town', !!tgt);
      if (tgt) {
        let proj: any = null;
        for (let i = 0; i < 12 && !proj; i++) {
          mage.emit('player_attack', { targetId: tgt.id, targetType: 'mob' });
          await sleep(700);
          proj = (mageEvents['projectile_spawned'] || [])[0];
        }
        check('the mage\'s attack spawns a projectile', !!proj, Object.keys(mageEvents));
        check('  the projectile carries id, zone, position, velocity and caster', !!proj && proj.id && proj.zone === 'town' && typeof proj.x === 'number' && typeof proj.vx === 'number' && proj.casterId === mageInit.playerId, proj);
      }
    } finally {
      mage.disconnect();
    }

    await say('/setlevel 150'); // open every level gate for the zones below

    console.log('field zones');
    const fields: string[] = (init.zones && Object.keys(init.zones)) || [];
    const fieldIds = ['meadow', 'frostfell', 'celestial'];
    for (const zid of fieldIds) {
      await warp('town');
      const z = await warp(zid);
      check(`warp to ${zid}`, !!z, zoneMsg && zoneMsg.zone);
      if (!z) continue;
      await say('/spawn e2eblob 2');
      const adm = fieldMobsOf(zid).filter((m: any) => m.type === 'e2eblob');
      check(`  ${zid}: admin-spawned monsters appear in the zone snapshot`, adm.length === 2, adm.length);
      check(`  ${zid}: they have the full snapshot shape`, adm.length > 0 && adm.every(hasMobShape));
      const natural = fieldMobsOf(zid).filter((m: any) => m.type !== 'e2eblob');
      console.log(`        (${natural.length} natural monsters in view at the entrance of ${zid})`);
      if (natural.length) check(`  ${zid}: natural monsters have the full snapshot shape`, natural.every(hasMobShape), natural.find((m: any) => !hasMobShape(m)));
    }

    console.log('dungeon');
    await warp('town');
    const dz = await warp('dungeon');
    check('enter the dungeon', !!dz && dz.zone === 'dungeon', zoneMsg && zoneMsg.zone);
    // the rooms next to the entrance are already populated when the hero arrives: the full list is in zone_change
    const entered: any[] = (dz && dz.mobs) || [];
    check('the dungeon arrives populated (zone_change.mobs)', entered.length > 0, entered.length);
    check('  every dungeon monster has the full shape plus normalized fields',
      entered.length > 0 && entered.every((m: any) => hasMobShape(m) && typeof m.def === 'number' && m.def > 0 && typeof m.isCommander === 'boolean' && typeof m.auraRadius === 'number' && m.hasCommanderBuff === false && 'roomIdx' in m),
      entered.find((m: any) => !hasMobShape(m)));
    await sleep(800);
    const dm = Array.from(seenDungeon.values());
    console.log(`        (${entered.length} monsters on entry, ${dm.length} seen so far)`);
    check('  every monster seen in live ticks has id, position and HP', dm.length > 0 && dm.every((m: any) => m.id && typeof m.x === 'number' && typeof m.hp === 'number'), dm.find((m: any) => !(m.id && typeof m.x === 'number' && typeof m.hp === 'number')));
    await say('/spawn e2eblob 3');
    // a new monster is sent in full by the next dungeon tick
    const adminList = await until(() => { const l = Array.from(seenDungeon.values()).filter((m: any) => String(m.id).startsWith('admin_mob_')); return l.length >= 3 && l; }, 9000, 200);
    check('admin /spawn works inside a dungeon instance', !!adminList && adminList.length === 3, adminList && adminList.length);

    console.log('eternal rift');
    await warp('town');
    events['dungeon_mobs_spawned'] = [];
    zoneMsg = null;
    s.emit('enter_rift', { mode: 'normal' });
    check('enter the Eternal Rift', await until(() => zoneMsg && zoneMsg.zone === 'dungeon', 8000));
    const riftEv = await until(() => (events['dungeon_mobs_spawned'] || []).find((e: any) => e.mobs && e.mobs.some((m: any) => String(m.id).startsWith('rift_mob_'))), 45000, 250);
    check('wave 1 monsters pour out of the gates', !!riftEv, (events['dungeon_mobs_spawned'] || []).length + ' spawn events');
    await sleep(500);
    const rm = Array.from(seenDungeon.values()).filter((m: any) => String(m.id).startsWith('rift_mob_'));
    console.log(`        (${rm.length} rift monsters seen)`);
    check('  rift monsters appear in live ticks with id, position and HP', rm.length > 0 && rm.every((m: any) => m.id && typeof m.x === 'number' && typeof m.hp === 'number'), rm[0]);

    console.log('server health');
    check('server process is still running', !exited);
    check('no server errors logged', !/TypeError|ReferenceError|Unhandled|RangeError|Error:/.test(serverErr), serverErr.slice(0, 600));
  } catch (e: any) {
    check('script ran to the end', false, String(e && e.stack || e));
  } finally {
    if (s) s.disconnect();
    if (!exited) child.kill(); // only the child this script started
    await sleep(300);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().finally(() => {
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) { console.log('FAILED:\n  - ' + failures.join('\n  - ')); process.exit(1); }
  console.log('E2E OK');
  process.exit(0);
});
