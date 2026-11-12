// Compile-time conformance: the real objects captured in the fixtures must be assignable to the
// entity interfaces. `npm run typecheck` fails here when an interface drifts from what the game builds.
import test from 'node:test';
import assert from 'node:assert/strict';
import classJoin from '../../scripts/fixtures/class-join.json';
import starters from './fixtures/starterCharacters.json';
import type { Player, SavedCharacter } from '../entities/types';

// the fixture player has no id / x / y (they are random per join and were removed)
type PlayerSnapshot = Omit<Player, 'id' | 'x' | 'y'>;

const livePlayers: PlayerSnapshot[] = [
  classJoin.warrior.player,
  classJoin.mage.player,
  classJoin.rogue.player,
  classJoin.banana.player,
];

const savedCharacters: SavedCharacter[] = [
  starters.warrior,
  starters.mage,
  starters.rogue,
  starters.banana,
  starters.undefined,
  starters.longName,
  starters.noName,
];

test('entity types: fixtures are assignable (checked by tsc)', () => {
  assert.equal(livePlayers.length, 4);
  assert.equal(savedCharacters.length, 7);
  assert.equal(livePlayers[1].characterClass, 'mage');
});
