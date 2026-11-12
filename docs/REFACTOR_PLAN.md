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

## Step 0 — Branch and baseline

1. `git status` — if the working tree has uncommitted changes besides untracked media, stop and ask the user.
2. Create the branch: `git checkout -b refactor/server-structure`
3. Run `npm run typecheck` and record the result (pass, or the number of existing errors).
   Existing errors are the baseline — later steps must not add new ones.
4. Record line counts as a baseline: `wc -l server/*.ts`

No commit for this step.

---

## Step 1 — Safety net (tests + smoke test)

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

## Step 2 — Fix save performance (behavior change, isolated)

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

## Step 3 — Extract constants (move only)

Create `server/config/constants.ts`. Move these top-level `const`s from `gameServer.ts` verbatim,
each with `export`:
- Lines ~46–142 (tuning constants: `SP_TRANSFORM_COOLDOWN` … `FAILED_RUN_LOOT_KEEP`),
  including the small pure helpers `dungeonProgressWeight` and `mobInView`.
- Lines ~437–484 (`PORTAL_USE_RANGE` … `BOSS_REVIVAL_STONE_CHANCE`), except anything
  that is built from a `require(...)` (e.g. `TALENT_PROCS = PASSIVES.TALENT_PROCS`) — leave those.

Do **not** move the mutable counters `let minionSeq` / `let spObjSeq` — they stay in `gameServer.ts`.
Keep comments with the constants they describe.

In `gameServer.ts` add one import: `import * as C from './config/constants';`
**or** a named import list — prefer named imports so the rest of the file stays unchanged.

Verify: grep that each moved name is defined exactly once across `server/`.
Run the checklist. Commit: `refactor: move tuning constants to config/constants.ts`.

---

## Step 4 — Extract static skill data (move only)

Create `server/data/skills.ts` and move verbatim, with `export`:
`ALL_CLASS_SKILLS` (~line 145), `CLASS_SKILLS_CATALOG`, `SKILL_RUNES`, `DEFAULT_EQUIPPED_SKILLS`,
`CLIENT_SKILL_SLOTS`, `DEFAULT_SKILL_FOR_SLOT`, `CLASS_SKILLS`, and `POTIONS` / `POTION_COOLDOWN_MS`
(or put potions in `server/data/potions.ts`).

`gameServer.ts` imports them back, and must keep re-exporting `ALL_CLASS_SKILLS`
at the bottom (`export { GameServer, ALL_CLASS_SKILLS }`).

Run the checklist. Commit: `refactor: move skill and potion data to data/`.

---

## Step 5 — Extract systems (repeat per system)

### The pattern (use it for every system)
To keep risk low on a 9k-line class, do it in two passes:

**Pass 1 — move with a delegating stub (move only).**
1. Create `server/systems/<system>.ts`.
2. Move each method body into an exported function whose **first parameter is the server**:
   ```ts
   // server/systems/statusEffects.ts
   import type { GameServer } from '../gameServer';
   export function applyStatusEffect(gs: GameServer, target, effect, ...rest) {
     // original body, with `this.` replaced by `gs.`
   }
   ```
3. Leave a one-line stub in the class so **no call site changes**:
   ```ts
   applyStatusEffect(target, effect, ...rest) { return StatusFx.applyStatusEffect(this, target, effect, ...rest); }
   ```
4. Replace `this.` with `gs.` **only inside the moved body**. Watch for:
   - arrow functions/callbacks inside the body that used `this` — they become `gs` too;
   - `function () {}` callbacks that relied on their own `this` — leave those alone;
   - private helpers the body calls (`this.foo()` → `gs.foo()` is fine; it still exists on the class).
   - module-level constants/imports the body uses — import them in the new file.
5. Use `import type` for `GameServer` to avoid a circular runtime import.

**Pass 2 (later, optional) — narrow the inputs.** Once a system is in its own file and tested,
functions can take the specific state they need instead of the whole `gs`. Separate commits.

### Order (smallest/safest first)
Extract one system per commit. Line numbers are approximate — grep for the method names.

| # | Module | Methods to move |
|---|---|---|
| 5.1 | `systems/statusEffects.ts` | `applyStatusEffect`, `smokeMissChance`, `applyTalentProcs` |
| 5.2 | `systems/potions.ts` | `getPotionSlots`, `getPotionCount`, `consumePotion`, `handleUsePotion`, `handleSetPotionSlot` |
| 5.3 | `systems/minions.ts` | `corpseKey`, `addCorpse`, `takeCorpses`, `raiseMinion`, `crumbleMinion`, `dismissMinions`, `tickMinions` |
| 5.4 | `systems/party.ts` | `getPartyData`, `broadcastPartyUpdate`, `handleParty*`, `removePlayerFromParty`, `partyExpSharers` |
| 5.5 | `systems/raid.ts` | `updateRaidEvents`, `spawnRaidBoss`, `despawnRaidBoss`, `recordRaidDamage`, `raidStandings`, `broadcastRaidLeaderboard`, `raidInfo`, `onRaidBossDeath`, `payRaidReward` |
| 5.6 | `systems/spCards.ts` (server side; name it `spSystem.ts` to avoid clashing with existing `spCards.ts`) | `equipSpCard`, `handleSpTransform`, `spLoadout`, `customizeSpSkill`, `setTransformed`, `fragmentCount`, `spendFragments`, `handleSpCard*`, `awardJobExp`, `rollBossSpLoot`, `endSpToggle`, `tickSpToggles` |
| 5.7 | `systems/inventory.ts` | `handleEquipItem`, `handleUnequipItem`, `handleBuy/Sell*`, `handleToggleFavorite`, `handlePickupItem`, `handleUseBagExpander`, chest handlers (`handleOpenPersonalChest`, `handleDepositToChest`, `handleWithdrawFromChest`, `handleUseChestExpander`) |
| 5.8 | `systems/itemUpgrades.ts` | `handleReforgeItem`, `handleEnhanceItem`, `applyItemUpgradeStats`, socket/rune handlers, `handleAttributes`, `handleCraft` |
| 5.9 | `systems/progression.ts` (name `levelSystem.ts`; `progression.ts` exists) | `awardExp`, `handleAllocateSkillPoint`, `handleAllocatePassives`, `handleRefundPassive`, `refundStaleTalents`, `handleResetSkillPoints` |
| 5.10 | `systems/loot.ts` | `giveLootToPlayer`, `lootEntryName`, `lootEntryToItem`, `spawnGroundItem`, `sweepGroundItems` |
| 5.11 | `systems/dungeonRuns.ts` | `newDungeonRun`, `updateDungeonRooms`, `spawnDungeonRoom`, `countDungeonProgress`, `emitDungeonRunUpdate`, `completeDungeonRun`, `endDungeonRun`, dungeon instance helpers |
| 5.12 | `systems/zones.ts` | `teleportPlayerTo*`, `handleEnterDungeon`, `handleLeaveDungeon`, `handleUsePortal`, `checkPortalAndInteractions`, `init*Monsters` |
| 5.13 | `systems/passives.ts` | `passiveDamageMult`, `passiveOnHit`, `passiveOnKill`, `passiveOnHurt`, `cardPassiveLeech`, `heroBuffs`, `bloodRage`, `phoenixRebirth` |
| 5.14 | `systems/stats.ts` | `recalculatePlayerStats`, `hpRegenMult`, `handleSetEffects`, `getArmorRuneCounts`, `getWeaponRuneCounts` |
| 5.15 | `systems/combat.ts` | `handlePlayerAttack`, `meleeSweep`, `chainBasicAttack`, `applyDamageToMob`, `handleMobDeath`, `spawnProjectile`, `applyProjectileSplash`, `gainUltCharge` |
| 5.16 | `systems/skills.ts` | `handlePlayerSkill` (~900 lines), `resolvePlayerSkill`, `handleCustomizeSkill` |
| 5.17 | `systems/spSkills.ts` | `castSpSkill` (~1,200 lines) |
| 5.18 | `systems/mobAI.ts` | `updateMobsList` |

For 5.16 and 5.17: after moving (Pass 1, verbatim), the huge functions are likely a big
`switch`/`if` chain over skill ids. In **separate** commits afterwards, split each case into its
own small function in a lookup table (`const SKILL_HANDLERS: Record<string, Fn> = {...}`).
Do this a few cases per commit.

After **each** row: run the checklist, play-check is not possible headless, so the smoke test
must exercise that system where feasible (extend `scripts/smoke.ts` — e.g. use a potion,
equip an item, cast a skill). Commit: `refactor: extract <system> from GameServer`.

---

## Step 6 — Thin socket handlers

Socket handlers live in `server/index.ts` (`socket.on('account_register', ...)` etc., ~60 total).
Move them into `server/network/handlers.ts` exporting `registerHandlers(io, socket, gameServer)`.
Each handler should only: validate input → call a `GameServer` method/system → done.
Keep event names identical. Commit: `refactor: move socket handlers to network/handlers.ts`.

---

## Step 7 — Types (gradual)

1. In `server/types.ts`, define `Player`, `Monster`, `GroundItem`, `DungeonInstance` interfaces
   from the fields actually used (read `makeStarterCharacter`, `addPlayer`, `saveCharacter`).
   Use optional fields (`?`) generously at first.
2. Replace `any` with these types **one system module at a time**, starting with the small ones.
   Fix real type errors that appear; if a fix would change behavior, leave a `// TODO(types):`
   comment and use a cast instead.
3. When `server/systems/*` is mostly typed, try `"noImplicitAny": true` in `tsconfig.json`.
   If it produces too many errors, revert and continue file by file.
One module per commit: `types: type <system>`.

---

## Done criteria

- `server/gameServer.ts` is mostly wiring: constructor, the tick loop (`startGameLoop`/`update`),
  player add/remove, and delegating stubs.
- Every system lives in `server/systems/*.ts` and can be read on its own.
- `npm run typecheck`, `npm test`, `npm run smoke` all pass.
- Autosave writes `accounts.json` once per cycle, atomically, without blocking the loop.

## Out of scope (separate plans later)
- Client refactor (`public/js/renderer.js` ~22.8k lines, `game.js` ~7.8k).
- SQLite migration.
- Passive/balance changes of any kind.

## Reporting back to the user
At the end of each session, report: which steps were completed (with commit hashes),
verification results, anything skipped or reverted and why, and the new line count of
`server/gameServer.ts`.
