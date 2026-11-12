// Crafting for Slop Hero: recipes turn materials (+ gold) into items.
//
// Recipes are data: { id, name, category, inputs: [{ id, n }], gold, levelReq,
// output: { id, n } } and output.gear marks equipment, which is rolled fresh
// (generateRandomizedGear) at the crafter's level. Set-piece recipes are built
// from the armor sets; later systems (gathering, food, runes, furniture) add
// their recipes to RECIPES the same way.
import { ITEMS, ARMOR_SETS, generateRandomizedGear } from './items';

export const CRAFT_CATEGORIES = [
  { id: 'set', name: 'Set Pieces', icon: '🛡️' }
];

export const RECIPES: Record<string, any> = {};
function addRecipe(r: any) { RECIPES[r.id] = r; }

// ---- Set crafting: 8 fragments of a set + gold -> one piece of that set
export const SET_PIECE_FRAGMENTS = 8;
for (const set of Object.values(ARMOR_SETS) as any[]) {
  const legendary = set.id !== 'wayfarer';
  for (const pieceId of set.pieces) {
    const piece = ITEMS[pieceId];
    if (!piece) continue;
    addRecipe({
      id: `craft_${pieceId}`, name: piece.name, category: 'set', setId: set.id,
      inputs: [{ id: `fragment_${set.id}`, n: SET_PIECE_FRAGMENTS }],
      gold: legendary ? 9000 : 2500, levelReq: legendary ? 50 : 30,
      output: { id: pieceId, n: 1, gear: true }
    });
  }
}

// ---- Set fragment drops: bosses usually, everything else rarely. Legendary
// sets' fragments only come from monsters of level 40 and up.
export function rollFragmentDrop(mob: any): { itemId: string, n: number } | null {
  const boss = !!mob.isBoss;
  if (Math.random() >= (boss ? 0.6 : 0.002)) return null;
  const pool = (mob.level || 1) >= 40 ? ['wayfarer', 'emberheart', 'stormcaller', 'eclipse'] : ['wayfarer'];
  const setId = pool[Math.floor(Math.random() * pool.length)];
  return { itemId: `fragment_${setId}`, n: boss ? 2 + Math.floor(Math.random() * 3) : 1 };
}

// ---- inventory helpers (stacks are matched by item id)
export function countItem(player: any, id: string): number {
  if (id === 'health_potion') return player.inventory.healthPotions || 0;
  if (id === 'mana_potion') return player.inventory.manaPotions || 0;
  return (player.inventory.items || []).reduce((t: number, it: any) => t + (it && it.id === id && it.type !== 'equipment' ? (it.count || 1) : 0), 0);
}
function takeItem(player: any, id: string, n: number) {
  if (id === 'health_potion') { player.inventory.healthPotions -= n; return; }
  if (id === 'mana_potion') { player.inventory.manaPotions -= n; return; }
  const items = player.inventory.items;
  for (let i = items.length - 1; i >= 0 && n > 0; i--) {
    const it = items[i];
    if (!it || it.id !== id || it.type === 'equipment') continue;
    const take = Math.min(n, it.count || 1);
    it.count = (it.count || 1) - take;
    n -= take;
    if (it.count <= 0) items.splice(i, 1);
  }
}

// Where crafting is allowed (town for now; the housing plot joins later)
export function canCraftHere(player: any): boolean {
  return player.zone === 'town' || player.zone === 'plot';
}

// Craft `times` copies of a recipe. Returns { ok, message, items? } and only
// changes the player when every check passes.
export function craft(gs: any, player: any, recipeId: string, times = 1) {
  const r = RECIPES[recipeId];
  if (!r) return { ok: false, message: 'Unknown recipe.' };
  times = Math.max(1, Math.min(r.output.gear ? 1 : 50, Math.floor(times) || 1));
  if (!canCraftHere(player)) return { ok: false, message: 'Craft in town (or on your plot).' };
  if ((player.level || 1) < (r.levelReq || 1)) return { ok: false, message: `Requires level ${r.levelReq}.` };
  for (const inp of r.inputs) {
    if (countItem(player, inp.id) < inp.n * times) return { ok: false, message: `Not enough ${(ITEMS[inp.id] && ITEMS[inp.id].name) || inp.id}.` };
  }
  const gold = (r.gold || 0) * times;
  if ((player.gold || 0) < gold) return { ok: false, message: `Need ${gold.toLocaleString()} Gold.` };
  // room for the result: gear always takes a slot, a stack only if it is new
  const out = ITEMS[r.output.id];
  if (!out) return { ok: false, message: 'Recipe output is missing.' };
  const needsSlot = r.output.gear || (out.id !== 'health_potion' && out.id !== 'mana_potion' && countItem(player, out.id) === 0);
  const freed = r.inputs.some((inp: any) => countItem(player, inp.id) === inp.n * times) ? 1 : 0;
  if (needsSlot && player.inventory.items.length - freed >= (player.inventory.maxSlots || 150)) return { ok: false, message: 'Your bag is full.' };

  for (const inp of r.inputs) takeItem(player, inp.id, inp.n * times);
  player.gold -= gold;
  const made: any[] = [];
  if (r.output.gear) {
    const item = generateRandomizedGear(r.output.id, player.level || 1, true);
    gs.giveLootToPlayer(player, { type: 'item', itemId: item.id, customItemData: item, amount: 1 }, false);
    made.push(item);
  } else {
    gs.giveLootToPlayer(player, { type: 'item', itemId: out.id, amount: r.output.n * times }, false);
    made.push({ ...out, count: r.output.n * times });
  }
  return { ok: true, message: `Crafted ${made[0].name}${made[0].count > 1 ? ` x${made[0].count}` : ''}!`, items: made };
}

// What the client needs to list recipes (item data for icons and tooltips)
export function craftingCatalog() {
  const brief = (id: string) => {
    const d = ITEMS[id] || {};
    return { id, name: d.name || id, iconKey: d.iconKey, icon: d.icon, rarity: d.rarity, type: d.type, color: d.color };
  };
  return {
    categories: CRAFT_CATEGORIES,
    recipes: Object.values(RECIPES).map((r: any) => ({
      id: r.id, name: r.name, category: r.category, setId: r.setId, gold: r.gold || 0, levelReq: r.levelReq || 1,
      inputs: r.inputs.map((i: any) => ({ ...brief(i.id), n: i.n })),
      output: { ...(ITEMS[r.output.id] || {}), n: r.output.n, gear: !!r.output.gear }
    }))
  };
}
