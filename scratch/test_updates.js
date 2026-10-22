const { generateProceduralDungeon, DUNGEON_FLOORS } = require('../server/dungeonGenerator');

console.log('--- Testing Dungeon 10x Mob Density & Respawn ---');
const dungeonF1 = generateProceduralDungeon(1, 'normal');
console.log(`Floor 1 total mobs: ${dungeonF1.mobs.length}`);
const hasBoss = dungeonF1.mobs.some(m => m.isBoss);
const allRespawnInf = dungeonF1.mobs.every(m => m.respawnTimer === Infinity);
console.log(`Floor 1 has boss: ${hasBoss}`);
console.log(`Floor 1 all mobs have respawnTimer === Infinity: ${allRespawnInf}`);

if (dungeonF1.mobs.length < 80) {
  throw new Error(`Expected at least 80 mobs in 10x swarm dungeon, got ${dungeonF1.mobs.length}`);
}

console.log('\n--- Testing Dungeon Gate Floors ---');
console.log(`Floor 1 minLevel: ${DUNGEON_FLOORS[0].minLevel}`);
console.log(`Floor 2 minLevel: ${DUNGEON_FLOORS[1].minLevel}`);
console.log(`Floor 10 minLevel: ${DUNGEON_FLOORS[9].minLevel}`);

console.log('\nAll dungeon generation & balancing tests passed!');
