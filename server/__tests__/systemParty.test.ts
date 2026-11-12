// Party system (invite / accept / decline / summon / kick / leave, party data, EXP sharing): locked to a fixture
// captured BEFORE the methods moved out of GameServer. Every scenario records all emitted events and calls to
// the teleport / dungeon helpers (stubbed), plus the resulting state. UPDATE_FIXTURES=1 rewrites the fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FIXTURE = path.join(__dirname, 'fixtures/systemParty.json');
const NOW = 1700000000000;
const plain = (v: any) => (v === undefined ? null : JSON.parse(JSON.stringify(v, (_k, x) => (x instanceof Set ? { __set: Array.from(x) } : x))));

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'));
  process.env.DATA_DIR = dir; // the server module imports the accountManager singleton
  const mod: any = await import('../gameServer');
  const GS = mod.default || mod.GameServer;
  const make = (props: any = {}) => {
    const fake: any = Object.create(GS.prototype);
    Object.assign(fake, props);
    if (typeof fake.initSystems === 'function') fake.initSystems();
    return fake;
  };
  return { dir, make };
}

interface PSpec { id: string; name?: string; level?: number; zone?: string; x?: number; y?: number; partyId?: string | null; isDead?: boolean; dungeonInstanceId?: string | null; socket?: boolean; extra?: any }

function world(make: any, o: { players: PSpec[]; parties?: { id: string; leader: string; members: string[] }[]; nextPartyId?: number; instances?: [string, any][]; fields?: [string, any][]; joinRift?: boolean }) {
  const log: any[] = [];
  const sockets = new Map<string, any>();
  const players = new Map<string, any>();
  for (const p of o.players) {
    players.set(p.id, {
      id: p.id, name: p.name || p.id.toUpperCase(), level: p.level ?? 10, characterClass: 'warrior', hp: 50, maxHp: 100, mp: 5, maxMp: 10,
      zone: p.zone || 'town', x: p.x ?? 0, y: p.y ?? 0, partyId: p.partyId ?? null, isDead: !!p.isDead, dungeonInstanceId: p.dungeonInstanceId ?? null, ...(p.extra || {}),
    });
    if (p.socket !== false) sockets.set(p.id, { emit: (ev: string, d: any) => log.push([p.id, ev, plain(d)]) });
  }
  const parties = new Map((o.parties || []).map(pp => [pp.id, { id: pp.id, leaderId: pp.leader, memberIds: new Set(pp.members) }]));
  const call = (name: string) => (...a: any[]) => { log.push(['call', name, ...a.map(x => (x && x.id !== undefined ? 'id:' + x.id : plain(x)))]); };
  const gs = make({
    players, parties, nextPartyId: o.nextPartyId ?? 1,
    io: { sockets: { sockets } },
    fields: new Map(o.fields || [['wildwood', { zone: { name: 'Wildwood', gateLevel: 10 } }]]),
    dungeonInstances: new Map(o.instances || []),
    broadcastSystemMessage: (t: string) => log.push(['system', t]),
    endDungeonRun: call('endDungeonRun'),
    cleanupDungeonInstanceIfEmpty: call('cleanupDungeonInstanceIfEmpty'),
    joinRift: (...a: any[]) => { call('joinRift')(...a); return o.joinRift ?? true; },
    newDungeonRun: (inst: any, cleared: boolean) => { log.push(['call', 'newDungeonRun', inst.id, cleared]); return { run: true, cleared }; },
    teleportPlayerToDungeon: call('teleportPlayerToDungeon'),
    emitDungeonRunUpdate: call('emitDungeonRunUpdate'),
    teleportPlayerToField: call('teleportPlayerToField'),
    teleportPlayerToTown: call('teleportPlayerToTown'),
  });
  const state = () => ({
    parties: plain(Array.from(parties.entries())), nextPartyId: gs.nextPartyId,
    players: Array.from(players.values()).map((p: any) => plain({ id: p.id, partyId: p.partyId, pendingSummon: p.pendingSummon, portalCooldown: p.portalCooldown, zone: p.zone, dungeonInstanceId: p.dungeonInstanceId, dungeonRun: p.dungeonRun })),
  });
  return { gs, log, players, parties, state };
}

test('party system matches the pre-refactor fixture', async () => {
  const { dir, make } = await load();
  const realNow = Date.now;
  Date.now = () => NOW;
  try {
    const got: any = { scenarios: {} };
    const run = (name: string, o: Parameters<typeof world>[1], fn: (w: ReturnType<typeof world>) => any) => {
      const w = world(make, o);
      const result = fn(w);
      got.scenarios[name] = { result: plain(result === undefined ? null : result), log: w.log, state: w.state() };
    };
    const A = { id: 'a', name: 'Alice', x: 1, y: 1 }, B = { id: 'b', name: 'Bob', x: 2, y: 2 }, C = { id: 'c', name: 'Cara' }, D = { id: 'd', name: 'Dan' }, E = { id: 'e', name: 'Eve' };
    const trio = { players: [{ ...A, partyId: 'party_1' }, { ...B, partyId: 'party_1' }, { ...C, partyId: 'party_1' }, D, E], parties: [{ id: 'party_1', leader: 'a', members: ['a', 'b', 'c'] }], nextPartyId: 2 };

    // party data and broadcasting
    run('partyData', trio, w => ({ none: w.gs.getPartyData(null), unknown: w.gs.getPartyData('nope'), data: w.gs.getPartyData('party_1') }));
    run('partyDataSkipsOffline', { ...trio, players: trio.players.filter(p => p.id !== 'c') }, w => w.gs.getPartyData('party_1'));
    run('broadcast', trio, w => { w.gs.broadcastPartyUpdate('party_1'); w.gs.broadcastPartyUpdate('nope'); });

    // invite
    run('inviteUnknownTarget', { players: [A, B] }, w => w.gs.handlePartyInvite('a', { targetPlayerId: 'zzz' }));
    run('inviteSelf', { players: [A, B] }, w => w.gs.handlePartyInvite('a', { targetPlayerId: 'a' }));
    run('inviteNoData', { players: [A, B] }, w => { w.gs.handlePartyInvite('a', null); w.gs.handlePartyInvite('nobody', { targetPlayerId: 'b' }); });
    run('inviteByNameCreatesParty', { players: [A, B] }, w => w.gs.handlePartyInvite('a', { targetName: '  bOb ' }));
    run('inviteByIdCreatesParty', { players: [A, B], nextPartyId: 7 }, w => w.gs.handlePartyInvite('a', { targetPlayerId: 'b' }));
    run('inviteTargetAlreadyInParty', { players: [A, { ...B, partyId: 'party_9' }] }, w => w.gs.handlePartyInvite('a', { targetPlayerId: 'b' }));
    run('inviteExistingParty', { ...trio }, w => w.gs.handlePartyInvite('a', { targetPlayerId: 'd' }));
    run('inviteFullParty', { players: [{ ...A, partyId: 'party_1' }, { ...B, partyId: 'party_1' }, { ...C, partyId: 'party_1' }, { ...D, partyId: 'party_1' }, E], parties: [{ id: 'party_1', leader: 'a', members: ['a', 'b', 'c', 'd'] }] }, w => w.gs.handlePartyInvite('a', { targetPlayerId: 'e' }));
    run('inviteTargetWithoutSocket', { players: [A, { ...B, socket: false }] }, w => w.gs.handlePartyInvite('a', { targetPlayerId: 'b' }));

    // accept / decline
    run('acceptJoins', trio, w => w.gs.handlePartyAccept('d', { partyId: 'party_1' }));
    run('acceptNoData', trio, w => { w.gs.handlePartyAccept('d', null); w.gs.handlePartyAccept('d', {}); w.gs.handlePartyAccept('nobody', { partyId: 'party_1' }); });
    run('acceptGonePartyOrFull', { players: [{ ...A, partyId: 'party_1' }, { ...B, partyId: 'party_1' }, { ...C, partyId: 'party_1' }, { ...D, partyId: 'party_1' }, E], parties: [{ id: 'party_1', leader: 'a', members: ['a', 'b', 'c', 'd'] }] }, w => { w.gs.handlePartyAccept('e', { partyId: 'party_1' }); w.gs.handlePartyAccept('e', { partyId: 'party_404' }); });
    run('acceptLeavesOldPartyFirst', { players: [{ ...A, partyId: 'party_1' }, { ...B, partyId: 'party_1' }, { ...C, partyId: 'party_2' }, { ...D, partyId: 'party_2' }], parties: [{ id: 'party_1', leader: 'a', members: ['a', 'b'] }, { id: 'party_2', leader: 'c', members: ['c', 'd'] }] }, w => w.gs.handlePartyAccept('d', { partyId: 'party_1' }));
    run('acceptLeaderGone', { players: [{ ...B, partyId: 'party_1' }, D], parties: [{ id: 'party_1', leader: 'a', members: ['b'] }] }, w => w.gs.handlePartyAccept('d', { partyId: 'party_1' }));
    run('decline', { players: [A, B] }, w => { w.gs.handlePartyDecline('b', { inviterId: 'a' }); w.gs.handlePartyDecline('b', { inviterId: 'zzz' }); w.gs.handlePartyDecline('b', {}); w.gs.handlePartyDecline('b', null); });

    // leave / kick / removal
    run('leaveMember', trio, w => w.gs.handlePartyLeave('b'));
    run('leaveLeaderPassesLeadership', trio, w => w.gs.handlePartyLeave('a'));
    run('leaveLastMemberDeletesParty', { players: [{ ...A, partyId: 'party_1' }, B], parties: [{ id: 'party_1', leader: 'a', members: ['a'] }] }, w => w.gs.handlePartyLeave('a'));
    run('leaveWithoutParty', trio, w => { w.gs.handlePartyLeave('d'); w.gs.handlePartyLeave('nobody'); });
    run('leaveWithMissingPartyRecord', { players: [{ ...A, partyId: 'party_x' }], parties: [] }, w => w.gs.handlePartyLeave('a'));
    run('kickByLeader', trio, w => w.gs.handlePartyKick('a', { targetId: 'b' }));
    run('kickByNonLeader', trio, w => w.gs.handlePartyKick('b', { targetId: 'c' }));
    run('kickSelfOrInvalid', trio, w => { w.gs.handlePartyKick('a', { targetId: 'a' }); w.gs.handlePartyKick('a', {}); w.gs.handlePartyKick('a', null); w.gs.handlePartyKick('d', { targetId: 'a' }); });

    // candidates
    run('candidates', trio, w => { w.gs.handlePartyListCandidates('a'); w.gs.handlePartyListCandidates('d'); w.gs.handlePartyListCandidates('nobody'); });

    // summon
    const farTrio = { players: [{ ...A, partyId: 'party_1' }, { ...B, partyId: 'party_1', zone: 'wildwood' }, { ...C, partyId: 'party_1' }, D, E], parties: [{ id: 'party_1', leader: 'a', members: ['a', 'b', 'c'] }] };
    run('summonFromTown', farTrio, w => w.gs.handlePartySummon('a'));
    run('summonAllHere', trio, w => w.gs.handlePartySummon('a'));
    run('summonNoParty', trio, w => { w.gs.handlePartySummon('d'); w.gs.handlePartySummon('nobody'); });
    run('summonDeadOrAlone', { players: [{ ...A, partyId: 'party_1', isDead: true }, { ...B, partyId: 'party_2' }], parties: [{ id: 'party_1', leader: 'a', members: ['a'] }, { id: 'party_2', leader: 'b', members: ['b'] }] }, w => { w.gs.handlePartySummon('a'); w.gs.handlePartySummon('b'); });
    run('summonFromField', { players: [{ ...A, partyId: 'party_1', zone: 'wildwood' }, { ...B, partyId: 'party_1' }], parties: [{ id: 'party_1', leader: 'a', members: ['a', 'b'] }] }, w => w.gs.handlePartySummon('a'));
    run('summonFromDungeon', { players: [{ ...A, partyId: 'party_1', zone: 'dungeon', dungeonInstanceId: 'party_party_1' }, { ...B, partyId: 'party_1' }], parties: [{ id: 'party_1', leader: 'a', members: ['a', 'b'] }], instances: [['party_party_1', { id: 'party_party_1', floor: 3 }]] }, w => w.gs.handlePartySummon('a'));
    run('summonFromRift', { players: [{ ...A, partyId: 'party_1', zone: 'dungeon', dungeonInstanceId: 'rift_party_party_1' }, { ...B, partyId: 'party_1' }, { ...C, partyId: 'party_1', socket: false }], parties: [{ id: 'party_1', leader: 'a', members: ['a', 'b', 'c'] }], instances: [['rift_party_party_1', { id: 'rift_party_party_1', floor: 0, rift: {} }]] }, w => w.gs.handlePartySummon('a'));

    // accepting a summon
    const summoned = (pending: any, over: any = {}) => ({ players: [{ ...A, partyId: 'party_1', zone: 'wildwood', ...over.a }, { ...B, partyId: 'party_1', extra: { pendingSummon: pending }, ...over.b }], parties: [{ id: 'party_1', leader: 'a', members: ['a', 'b'] }], ...over.world });
    const ok = { fromId: 'a', expiresAt: NOW + 30000 };
    run('acceptSummonField', summoned(ok), w => w.gs.handlePartySummonAccept('b', { fromId: 'a' }));
    run('acceptSummonTown', summoned(ok, { a: { zone: 'town' } }), w => w.gs.handlePartySummonAccept('b', { fromId: 'a' }));
    run('acceptSummonExpired', summoned({ fromId: 'a', expiresAt: NOW - 1 }), w => w.gs.handlePartySummonAccept('b', { fromId: 'a' }));
    run('acceptSummonWrongSender', summoned(ok), w => w.gs.handlePartySummonAccept('b', { fromId: 'zzz' }));
    run('acceptSummonNothingPending', summoned(null), w => w.gs.handlePartySummonAccept('b', { fromId: 'a' }));
    run('acceptSummonSummonerDead', summoned(ok, { a: { isDead: true } }), w => w.gs.handlePartySummonAccept('b', { fromId: 'a' }));
    run('acceptSummonSummonerLeftParty', summoned(ok, { a: { partyId: null } }), w => w.gs.handlePartySummonAccept('b', { fromId: 'a' }));
    run('acceptSummonFieldLevelGate', summoned(ok, { b: { level: 3 } }), w => w.gs.handlePartySummonAccept('b', { fromId: 'a' }));
    run('acceptSummonDeadSelf', summoned(ok, { b: { isDead: true } }), w => w.gs.handlePartySummonAccept('b', { fromId: 'a' }));
    run('acceptSummonNoData', summoned(ok), w => { w.gs.handlePartySummonAccept('b', null); w.gs.handlePartySummonAccept('nobody', { fromId: 'a' }); });
    const dungeonWorld = { instances: [['party_party_1', { id: 'party_party_1', floor: 2 }]] as [string, any][] };
    run('acceptSummonDungeon', summoned(ok, { a: { zone: 'dungeon', dungeonInstanceId: 'party_party_1', extra: { dungeonRun: { cleared: true } } }, b: { level: 50 }, world: dungeonWorld }), w => w.gs.handlePartySummonAccept('b', { fromId: 'a' }));
    run('acceptSummonDungeonLevelGate', summoned(ok, { a: { zone: 'dungeon', dungeonInstanceId: 'party_party_1' }, b: { level: 1 }, world: { instances: [['party_party_1', { id: 'party_party_1', floor: 9 }]] } }), w => w.gs.handlePartySummonAccept('b', { fromId: 'a' }));
    run('acceptSummonLeavesOtherDungeonFirst', summoned(ok, { a: { zone: 'dungeon', dungeonInstanceId: 'party_party_1' }, b: { zone: 'dungeon', dungeonInstanceId: 'solo_b', level: 50 }, world: dungeonWorld }), w => w.gs.handlePartySummonAccept('b', { fromId: 'a' }));
    const riftWorld = { instances: [['rift_party_party_1', { id: 'rift_party_party_1', floor: 0, rift: {} }]] as [string, any][] };
    run('acceptSummonRift', summoned(ok, { a: { zone: 'dungeon', dungeonInstanceId: 'rift_party_party_1' }, world: riftWorld }), w => w.gs.handlePartySummonAccept('b', { fromId: 'a' }));
    run('acceptSummonRiftEnded', summoned(ok, { a: { zone: 'dungeon', dungeonInstanceId: 'rift_party_party_1' }, world: { ...riftWorld, joinRift: false } }), w => w.gs.handlePartySummonAccept('b', { fromId: 'a' }));

    // EXP sharing
    run('expSharers', {
      players: [
        { id: 'k', name: 'Killer', zone: 'wildwood', x: 0, y: 0, partyId: 'party_1' },
        { id: 'near', zone: 'wildwood', x: 3, y: 4, partyId: 'party_1' },            // distance 5: shares
        { id: 'edge', zone: 'wildwood', x: 10, y: 0, partyId: 'party_1' },           // exactly PARTY_EXP_RANGE: shares
        { id: 'far', zone: 'wildwood', x: 10.1, y: 0, partyId: 'party_1' },          // just outside
        { id: 'dead', zone: 'wildwood', x: 1, y: 0, partyId: 'party_1', isDead: true },
        { id: 'other', zone: 'town', x: 1, y: 0, partyId: 'party_1' },               // other map
        { id: 'solo', zone: 'wildwood', x: 1, y: 1 },
        { id: 'dk', zone: 'dungeon', x: 0, y: 0, partyId: 'party_2', dungeonInstanceId: 'i1' },
        { id: 'dsame', zone: 'dungeon', x: 2, y: 0, partyId: 'party_2', dungeonInstanceId: 'i1' },
        { id: 'ddiff', zone: 'dungeon', x: 2, y: 0, partyId: 'party_2', dungeonInstanceId: 'i2' },
      ],
      parties: [{ id: 'party_1', leader: 'k', members: ['k', 'near', 'edge', 'far', 'dead', 'other', 'ghost'] }, { id: 'party_2', leader: 'dk', members: ['dk', 'dsame', 'ddiff'] }],
    }, w => ({
      field: w.gs.partyExpSharers(w.players.get('k')).map((p: any) => p.id),
      solo: w.gs.partyExpSharers(w.players.get('solo')).map((p: any) => p.id),
      dungeon: w.gs.partyExpSharers(w.players.get('dk')).map((p: any) => p.id),
      noPartyRecord: w.gs.partyExpSharers({ id: 'x', partyId: 'party_404' }).map((p: any) => p.id),
    }));

    if (process.env.UPDATE_FIXTURES === '1') { fs.writeFileSync(FIXTURE, JSON.stringify(got, null, 2) + '\n', 'utf8'); return; }
    assert.deepEqual(plain(got), JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
  } finally {
    Date.now = realNow;
    await (await import('../accountManager')).default.flush();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
