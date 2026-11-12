# Server Refactor Plan — hands-on execution guide

Goal: break up `server/gameServer.ts` (~9,760 lines, one `GameServer` class, ~200 methods)
into system modules, fix the save-performance problem, and add a safety net —
**without changing game behavior**.

Execute **one step at a time**, in order. Each step ends with a verification and a commit.
Do not start a step until the previous one is verified and committed.

---

## 0. Ground rules (read before every session)

### Never touch the user's live game
- The user plays on a server running on **port 3000** that reads/writes `server/data/accounts.json`
  and `server/data/sessions.json`. These hold real accounts.
- **Never** read-modify-write, delete, or overwrite anything in `server/data/accounts.json` or `sessions.json`.
- **Never** stop node processes broadly (no `taskkill /IM node.exe`, no `Stop-Process -Name node`,
  no killing by command line). Only stop a process you started, found by **your** port:
  ```powershell
  Get-NetTCPConnection -LocalPort 3917 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Confirm:$false }
  ```
- Run any test server on port **3917** (or 3918) with an isolated temp data dir:
  `DATA_DIR=<temp dir> PORT=3917` (`accountManager.ts` honors `DATA_DIR`).

### Refactor discipline
- **Move OR change, never both in one commit.** A "move" commit relocates code verbatim
  (only adding imports/exports). Behavior changes go in separate commits.
- **No balance/tuning changes.** Every number keeps its exact value.
- **No renames of socket event names, emitted payload fields, or saved-data fields** —
  the client (`public/js/*.js`) and existing saves depend on them.
- Keep `export { GameServer, ALL_CLASS_SKILLS }`, `export default GameServer` and
  `module.exports = GameServer` working at the bottom of `gameServer.ts` (`server/index.ts` imports it).
- Stage files explicitly (`git add server/... docs/...`). Never `git add -A` / `git add .`
  (there are untracked media files like `aaaaa.mp4` that must not be committed).
- If a verification fails and the cause isn't obvious within a few attempts:
  `git checkout -- <files>` to undo the step, and report what happened instead of improvising.

### Verification checklist (run after EVERY step)
1. `npm run typecheck` — must pass with no new errors.
2. `npm test` — all tests pass (from Step 1 onward).
3. `npm run smoke` — smoke test passes (from Step 1 onward).
4. `git diff --stat` — only the files you intended changed.

---

## Step 0 — Branch and baseline (DONE)

1. `git status` — if the working tree has uncommitted changes besides untracked media, stop and ask the user.
2. Create the branch: `git checkout -b refactor/server-structure`
3. Run `npm run typecheck` and record the result (pass, or the number of existing errors).
   Existing errors are the baseline — later steps must not add new ones.
4. Record line counts as a baseline: `wc -l server/*.ts`

No commit for this step.

---

## Step 1 — Safety net (tests + smoke test) (DONE, a66f3c5)

Node is v22, `tsx` is already a devDependency. Use the built-in `node:test` runner (no new deps).

### 1a. Test script
In `package.json` add/replace scripts:
```json
"test": "node --import tsx --test \"server/**/*.test.ts\"",
"smoke": "tsx scripts/smoke.ts"
```

### 1b. Characterization tests for pure logic
Create `server/__tests__/` (or `*.test.ts` next to files). These tests lock in **current** outputs —
call the function, and assert the value it returns today. Don't "fix" anything you think is wrong.

Cover at least:
- `progression.ts`: `expToNext`, `baseExpCurve`, `mobExp`, `levelGapMult` for a handful of levels.
- `elements.ts`: `calculateElementalMultiplier` for a few attacker/defender element pairs.
- `items.ts`: `enhanceCost`, `enhanceChance` across levels 0..`ENHANCE_MAX`.
- `talents.ts` / `progression.ts`: any other pure function that takes numbers and returns numbers.

For anything random (`rollSkyblockReforge`, `generateRandomizedGear`, loot rolls), only assert
shape/invariants (fields exist, values within range), not exact values.

### 1c. Account persistence round-trip test
`accountManager.ts` is a singleton that reads `DATA_DIR` **at import time**. So in the test:
1. Create a temp dir (`fs.mkdtempSync(path.join(os.tmpdir(), 'slop-test-'))`).
2. Set `process.env.DATA_DIR` to it **before** importing: use `await import('../accountManager')` inside the test.
3. Call `init()`, `register(...)`, `saveCharacter(...)`; then re-read the JSON from the temp dir
   and assert the character fields (level, gold, inventory) round-trip.
4. Delete the temp dir afterwards.

### 1d. Smoke test — `scripts/smoke.ts`
Boots the real server in isolation and drives it with a socket client:
1. Make a temp data dir; spawn `node node_modules/tsx/dist/cli.mjs server/index.ts`
   with env `PORT=3917`, `DATA_DIR=<temp>`.
2. Wait until `http://localhost:3917` responds.
3. Connect with `socket.io-client` (already in dependencies). Find the exact event names and
   payloads in `server/index.ts` (`socket.on('account_register' ...)`, `'create_character'`,
   `'join_game'`, etc.) and what the server emits back.
4. Register an account → create a character → join game → wait ~2 s receiving state updates →
   send a movement input and one attack → disconnect.
5. Assert: no error events, at least one state/update message received, server process still alive.
6. Kill **only the child process you spawned** (by its PID / port 3917), delete the temp dir.
   Exit code 0 on success, 1 on failure.

Run the checklist. Commit: `test: add characterization tests and smoke test`.

---

## Step 2 — Fix save performance (DONE: 0d3894e, 19da99e, 45856f4)

Problem: `saveCharacter()` (`server/accountManager.ts` ~line 313) calls `saveAccounts()`, which
rewrites the **entire** `accounts.json` synchronously. `saveAllOnlinePlayers()`
(`server/gameServer.ts` ~line 580) runs every 30 s and calls it once **per online player**,
so the game loop stalls for (online players × total file size) every 30 s.

### 2a. Don't wipe accounts after a failed load
In `init()`, if `JSON.parse` throws, the catch sets `this.accounts = {}`; the next save would
overwrite the real file with nothing. Change to: on parse failure, copy the bad file to
`accounts.corrupt-<timestamp>.json`, log loudly, and set a flag `this.loadFailed = true`
that makes `saveAccounts()` refuse to write. Add a test for this using a temp `DATA_DIR`
containing invalid JSON. Commit: `fix: never overwrite accounts after a failed load`.

### 2b. Batch the autosave
- Add an optional parameter: `saveCharacter(username, data, slot = 0, flush = true)`;
  when `flush` is false, update memory but skip `saveAccounts()`.
- In `saveAllOnlinePlayers()`, call `saveCharacter(..., false)` for each player,
  then call `accountManager.saveAccounts()` **once** at the end.
- Leave every other caller unchanged (they still flush immediately).
Commit: `perf: write accounts once per autosave cycle`.

### 2c. Atomic, non-blocking writes
Rewrite `saveAccounts()`:
- Serialize, write to `accounts.json.tmp` with `fs.promises.writeFile`, then
  `fs.promises.rename` it over `accounts.json` (atomic replace).
- Guard against overlapping writes: if a write is in progress, set `pendingSave = true`
  and run one more write when the current one finishes.
- Add `saveAccountsSync()` (the old sync logic, but also tmp+rename) and use it in the
  shutdown path (`server/index.ts` ~line 392) so the final save completes before exit.
- Do the same tmp+rename for `sessions.json`.
Update the round-trip test to `await` the save. Commit: `perf: atomic async account saves`.

---

# Class + factory structure (replaces the old Steps 3–7)

Design decision (made with the user):
- **Entities** (Player, Mob, Item, Projectile, ...) are typed `interface`s built by **factory functions**. They stay plain JSON so saving, `socket.emit` and `{...mob}` spreads keep working.
- **Systems** (combat, party, loot, ...) become **classes**: `class XSystem { constructor(private readonly gs: GameServer) {} }`.
- **Behavior that varies** (skills, SP shapes, mob status effects, hero classes) becomes **registries**: `Record<key, handler>`, like `COMMANDS` in `adminCommands.ts`.

Existing patterns to copy: `createBossMechanics` (`bossMechanics.ts`, closure factory with a private state Map) and `class AccountManager`.

## Hard rules for this refactor (in addition to section 0)
1. **A factory returns exactly the same fields and values as the literal it replaces.** Do not pre-initialize fields that are added lazily, and do not rename anything. Snapshots and `player_joined` send whole objects to the client, so an extra or missing key changes behavior. Defaults must match each call site (e.g. `def || 12` in the legacy dungeon vs `def || 10` in instances): pass them as parameters when they differ.
2. **Keep ID formats and counters unchanged** (`this.nextEntityId`, the dungeon generator's own counter, `minionSeq`, `spObjSeq`). Factories receive the id as an argument or a `nextId()` callback.
3. Systems use `import type { GameServer }` (no circular runtime import). `GameServer` keeps a one-line forwarding method for every moved method, so no call site changes.
4. **Do not fix bugs found on the way; report them.** Known: the frost rune writes `mob.freezeTimer` (gameServer.ts ~7477) but the game only reads `frozenTimer`; `mob.chillSlow` is never read; `initFrostfellMonsters` is effectively dead code; `this.playerParties` is unused.
5. One step per commit. Run typecheck, `npm test` and `npm run smoke` after every step.
6. **Fixture rule for factories:** before replacing a literal, capture its output from the OLD code into a fixture (stub `Math.random` / `Date.now`), then assert the new factory deep-equals it.

## Target structure
```
server/
  config/constants.ts        tuning numbers
  data/skills.ts             ALL_CLASS_SKILLS, CLASS_SKILLS_CATALOG, SKILL_RUNES, DEFAULT_EQUIPPED_SKILLS, CLASS_SKILLS, ...
  data/potions.ts            POTIONS, POTION_COOLDOWN_MS
  data/heroClasses.ts        HERO_CLASSES[cls] = { baseStats, starterGear, isRanged }
  entities/types.ts          Player, SavedCharacter, Mob, Item, GroundItem, Projectile, DungeonInstance, Party
  entities/player.ts         createStarterCharacter, createLivePlayer, toSavedCharacter
  entities/mob.ts            MobFactory.{ field, dungeonPending, raidBoss, riftMob, bossAdd, adminSpawn }
  entities/item.ts           ItemFactory.{ stack, gear, card, fromLootEntry }
  entities/world.ts          createProjectile, createGroundItem, createDungeonInstance, createRiftInstance, createParty
  systems/<Name>System.ts    one class per game system
  skills/baseSkillHandlers.ts   BASE_SKILL_HANDLERS
  skills/SpCastContext.ts       holds the closures of castSpSkill
  skills/spShapeHandlers.ts     SP_SHAPE_HANDLERS
  effects/mobEffects.ts         MOB_EFFECTS
  gameServer.ts              wiring + game loop + forwarding stubs
```

---

## Phase A — data out of GameServer (move only)

### A1. `config/constants.ts` (DONE, 3f4de73)
Move verbatim, with `export`: the tuning constants at gameServer.ts ~lines 46–142 (`SP_TRANSFORM_COOLDOWN` ... `FAILED_RUN_LOOT_KEEP`, including the pure helpers `dungeonProgressWeight` and `mobInView`) and ~437–484 (`PORTAL_USE_RANGE` ... `BOSS_REVIVAL_STONE_CHANCE`), except anything built from a `require(...)` (e.g. `TALENT_PROCS = PASSIVES.TALENT_PROCS`) and the mutable `let minionSeq` / `let spObjSeq`, which stay. Import them back with a named import list. Verify each moved name is defined exactly once under `server/`. Commit: `refactor: move tuning constants to config/constants.ts`.

### A2. `data/skills.ts` and `data/potions.ts` (DONE, b137582)
Move verbatim: `ALL_CLASS_SKILLS`, `CLASS_SKILLS_CATALOG`, `SKILL_RUNES`, `DEFAULT_EQUIPPED_SKILLS`, `CLIENT_SKILL_SLOTS`, `DEFAULT_SKILL_FOR_SLOT`, `CLASS_SKILLS` (-> `data/skills.ts`); `POTIONS`, `POTION_COOLDOWN_MS` (-> `data/potions.ts`). `gameServer.ts` must keep `export { GameServer, ALL_CLASS_SKILLS }`. Commit: `refactor: move skill and potion data to data/`.

### A3. `data/heroClasses.ts` (DONE, a42fcaf; fixtures f1089ca)
One table replaces the duplicated `defaultClasses` stat table (in `makeStarterCharacter` and `addPlayer`; note `addPlayer`'s copy also has `skillName`), the duplicated starter-gear blocks, and gives `isRanged` (true for mage). **First** capture a fixture of `makeStarterCharacter(name, cls)` for warrior, mage, rogue and an invalid class, then make both methods read the table and assert deep equality. Do not touch the `=== 'mage'` branches yet (that is D1). Commit: `refactor: single hero class table`.

**Stop after Phase A and report to the user** (they restart their server and play-check).

---

## Phase B — entity types and factories

- **B1 (DONE, a0d0964). `entities/types.ts`**: interfaces from the real fields (player: identity, position, progression, stats, gear, combat timers, buffs, plus many optional lazily added fields; mob core fields; item; ground item; projectile; dungeon instance; party). All lazily added fields optional. Nothing uses them yet. Commit: `types: add entity interfaces`.
- **B2 (DONE: 9233b87 fixtures, 1ca47bb, 7910bb6, 94ed744). Player**: `createStarterCharacter` (moved `makeStarterCharacter`), `createLivePlayer(socketId, saved, account)` (the literal in `addPlayer` ~1757–1858), `toSavedCharacter(player)` (the whitelist in `accountManager.saveCharacter`, which then calls it). **First** extend `scripts/smoke.ts` to compare the sorted key list of the `init_game` player with `scripts/fixtures/player-keys.json` (create it from the old code), then refactor.
- **B3 (DONE: 3066bc4 + 609026d fixtures; 4c6e58e, d998359, f654959). Item**: `ItemFactory.stack(def, count)` for the `{...ITEMS.x, count}` spreads, `card(id, lvl)` (= `SP.makeCardItem` + `custom` + `count`), `gear()` wrapping `generateRandomizedGear`, `fromLootEntry` (moved `lootEntryToItem`). Replace call sites a few per commit.
- **B4 (DONE: 15f40cc fixture; f198444). Mob**: `MobFactory` with one variant per site (field, raidBoss, riftMob, bossAdd, dungeonMob, adminSpawn). No shared base object: the sites differ in key sets and defaults, and the "same fields" rule forbids unifying them. Replace in this order: admin `/spawn`, raid boss, rift, boss adds (`bossMechanics.ts` `summonAdds`), dungeon pending (`getOrCreateDungeonInstance`), field (`initFieldMonsters`). Leave the dungeon generator's def literals alone (they are input data). Each variant gets a fixture test. Note: `mob.zone` is a leash box on most mobs but the string `'dungeon'` on rift/admin mobs; keep both.
- **B5 (DONE: 97bb866 fixture; 78ac251). World**: `createProjectile` (dedupes `spawnProjectile` and `spawnRiftBolt`), `createGroundItem`, `createDungeonInstance`, `createRiftInstance`, `createParty`.

## Phase C — system classes (DONE)

Done: **StatusEffectSystem** (ae0f860), **PotionSystem** (5557b86), **MinionSystem** (6af8bc7), **PartySystem** (2fcea39), **RaidSystem** (bb2e43b), **SpCardSystem** (a09ecb9), **InventorySystem** (5b8dbeb), **ItemUpgradeSystem** (141957f), **LevelSystem** (509e97e), **LootSystem** (a3c4ac9), **DungeonRunSystem** (41a9e43), **ZoneSystem** (f3d375c), **PassiveSystem**, **StatsSystem**, **CombatSystem**, **SkillSystem**, **SpSkillSystem** (castSpSkill), **MobAISystem**.
**MobAISystem** done too: all 18 systems are extracted (`server/systems/`). `gameServer.ts` went from 9,762 to about 2,680 lines and now holds the constructor, `initSystems()`, the game loop, snapshots, joins and the Eternal Rift code (rift handlers, `createRiftInstance`, `getOrCreateDungeonInstance`), each with forwarding stubs for the moved methods.

Left in `GameServer` on purpose: the Eternal Rift methods (a candidate for a RiftSystem), `getOrCreateDungeonInstance`, `broadcastSnapshot`, `update`, `addPlayer`/`removePlayer`, `isColliding`, `distToSegment`, `spawnRiftBolt`, `handleUseRevivalStone`.

Note for the big systems (Skill, SpSkill, Combat, Stats): their fixtures store a hash plus a summary for bulk scenarios, so a mismatch does not say which field changed. To debug one, regenerate the fixture on the old commit with `UPDATE_FIXTURES=1` and diff the two JSON files.

Method lists per remaining system (grep the names; line numbers drift): raid = `updateRaidEvents`, `spawnRaidBoss`, `despawnRaidBoss`, `recordRaidDamage`, `raidStandings`, `broadcastRaidLeaderboard`, `raidInfo`, `onRaidBossDeath`, `payRaidReward`; spCard = `equipSpCard`, `handleSpTransform`, `spLoadout`, `customizeSpSkill`, `setTransformed`, `fragmentCount`, `spendFragments`, `handleSpCard*`, `awardJobExp`, `rollBossSpLoot`, `endSpToggle`, `tickSpToggles`; inventory = equip/unequip/buy/sell/favorite/pickup/bag-expander/personal-chest handlers; itemUpgrade = reforge/enhance/socket/rune/attributes/craft handlers; level = `awardExp` and the skill-point/passive handlers; loot = `giveLootToPlayer`, `lootEntryName`, `lootEntryToItem`, `spawnGroundItem`, `sweepGroundItems`; dungeonRun = `newDungeonRun`, `updateDungeonRooms`, `spawnDungeonRoom`, `countDungeonProgress`, `emitDungeonRunUpdate`, `completeDungeonRun`, `endDungeonRun`; zone = `teleportPlayerTo*`, enter/leave dungeon, portal handlers, `init*Monsters`; passive = `passiveDamageMult`, `passiveOnHit`, `passiveOnKill`, `passiveOnHurt`, `cardPassiveLeech`, `heroBuffs`, `bloodRage`, `phoenixRebirth`; stats = `recalculatePlayerStats`, `hpRegenMult`, `handleSetEffects`, rune-count getters; combat = `handlePlayerAttack`, `meleeSweep`, `chainBasicAttack`, `applyDamageToMob`, `handleMobDeath`, `spawnProjectile`, `applyProjectileSplash`, `gainUltCharge`.

### The procedure that works (one system per session-step, 3 commits)
1. **Characterization test first** (`server/__tests__/system<Name>.test.ts`). Build a server WITHOUT its constructor:
   ```ts
   const fake = Object.create(GS.prototype); Object.assign(fake, { players, io, emitZone: record, ...stubs });
   if (typeof fake.initSystems === 'function') fake.initSystems();   // wires the systems once they exist
   ```
   Stub everything the methods call that is not under test (teleports, dungeon helpers, sockets, `emitZone`) with recorders. Freeze `Date.now`, seed `Math.random`. Cover every branch (errors and no-ops too), record all emitted events, calls and the resulting state, and write them to `server/__tests__/fixtures/system<Name>.json` with `UPDATE_FIXTURES=1`. Run it twice and diff (must be deterministic) and read the fixture summary to check the scenarios really reach the branches. Commit.
2. **Extract mechanically**: `node scripts/extract-system.js scripts/system-configs/<name>.json` (config examples: status-effects, potions, minions (private counter + deleteLines), party). Then `npm run typecheck`.
3. **Verify and commit**: the fixture test must pass unchanged, plus `npm test`, `npm run smoke`, `npm run e2e`. Existing tests that call moved methods on a bare stand-in object (not via `initSystems()`) must be adapted to build the server the way step 1 does (their fixtures stay untouched).

Gotchas found so far:
- One-line methods (`corpseKey(...) { ... }`) are supported by the tool; methods are matched by their 2-space-indented name and end at the next line that is exactly `  }`.
- Module-level `let` counters used by a single system become private fields (`privateFields` + `textReplacements` + `deleteLines`). Module-level `const`s built with `require` need `extraTop`.
- `gameServer.ts` has CRLF line endings in the working tree (git autocrlf); the tool handles both.
- Do not put `\n`-style escapes in shell heredocs when writing files; use the Write/Edit tools.
- The party/minion tests show how to test a method that talks to sockets and teleports: stub the callees, log their arguments, fixture the log.

## Phase D — registries for behavior that varies (DONE, except D4's apply side)

- **D1 (DONE).** `isRangedClass(cls)` in `server/data/heroClasses.ts` (reads `HERO_CLASSES[cls].isRanged`) replaces the 7 `characterClass === 'mage'` checks. Unknown classes stay melee.
- **D2 (DONE).** `BASE_SKILL_HANDLERS` (`server/skills/baseSkillHandlers.ts`, 43 handlers): the switch in `SkillSystem.handlePlayerSkill` is now a lookup. Generated mechanically by `scripts/extract-skill-handlers.js` (needs a TypeScript 5.x for its JS API: `TS_PATH=<path to typescript 5> node scripts/extract-skill-handlers.js`; the project's TypeScript 7 has none). A handler gets a `SkillContext` (gs, player, skill, slot, cooldown, runeId, mobsMap, applySkillDamage, computeDashVector, ...).
- **D3 (DONE).** `SP_SHAPE_HANDLERS` (`server/skills/spShapeHandlers.ts`, 40 shapes in 39 handlers): the first switch in `SpSkillSystem.castSpSkill` is a lookup. The helpers `castSpSkill` builds first (hit, emit, say, placeRune, plantRod, ...) are fields of an `SpCastContext` object; its `let` variables (dealt, soulMult, comboMult, heatMult, spot) are shared through getters and setters. Generated by `scripts/extract-sp-handlers.js`. The placed-object id counter lives in `spShapeHandlers.ts` (`nextSpObjId`) so there is still one counter. The second, smaller switch after the shared tail (aura, rewind, ...) stays inline.
- **D4 (tick side DONE).** `MOB_EFFECTS` (`server/effects/mobEffects.ts`): the status ticks of `updateMobsList` (chill, burn, poison, shadow mark, static, conduct, scorch, frost) run through the registry in the old order; a burn or poison kill ends the monster's update. **Not done: merging the apply side.** Chill, burn, poison, scorch, frost and conduct are set in about six places (skills, runes, passives, talents, `hit()`) with different strengths, stacking and timers; merging them would change balance, so they stay where they are.

## Phase E — types (STARTED)

- **Step 1 (DONE).** `"noImplicitAny": true` is on and the project compiles. Parameters named player/killerPlayer/targetPlayer/caster/hero are `Player`, mob/targetMob/primary/nearby are `Mob`, item is `Item`, inst is `DungeonInstance`; every other untyped parameter is an explicit `any`. `scripts/add-types.js` did this from the compiler's own error list.
- **Step 2 (DONE).** The `[extra: string]: any` escape hatch is removed from Player, Item, Mob, DungeonInstance, EquipmentSlots, Inventory, EquippedSkills, StatusEffect, RiftState and RiftInstance: a typo in a field name of these is now a compile error. About 45 fields that were only added during play were declared as optional.
- **Left:** `strict` / `strictNullChecks` stay off. `SkillCooldowns` keeps its index signature (the keys are slot names). Many parameters are still an explicit `any` (sockets, the `p` loop variable, ctx objects): typing them is the next step. `GameServer.players`, `townMobs` and `dungeonInstances` are typed now; `parties`, `projectiles`, `fields` and the rest are still `any`. `EquipmentSlots` and `EquippedSkills` also keep an index signature (the client addresses slots by name).

---

## Done criteria
- `gameServer.ts` is wiring, the game loop, player add/remove and forwarding stubs.
- Entities are created only through factories; behavior that varies lives in registries.
- `npm run typecheck`, `npm test`, `npm run smoke` pass.

## Out of scope
Client refactor (`public/js/renderer.js`, `game.js`), SQLite migration, any balance change.

## Reporting back
At the end of each session report: steps completed (commit hashes), verification results, anything skipped or reverted and why, bugs noticed but not fixed, and the new line count of `gameServer.ts`.
