// Slop Hero - SP card wing skins
//
// A transformed hero grows wings from +10 on their SP card, one style per +10 (client spWings.js,
// tiers 1-10, in the card's colour). The wardrobe lets a hero pick what they wear instead:
//   'auto'      the card's own style for its level (the default)
//   'none'      no wings
//   'tier:N'    any style the equipped card has already reached (N <= upgrade level / 10), card colour
//   <skin id>   a wing skin: a style in its own colours, worn at any card level once unlocked
// Skins drop as items from dungeon bosses and minibosses (and the odd gold chest); using one
// unlocks it on that hero for good. Only the server says what a hero may wear: set_wing_style
// is checked here, and others just draw the hero's wingStyle.
// No imports from items.ts (items.ts imports the skin items from here).

export const WING_SKINS: Record<string, { id: string; name: string; style: number; color: string; rarity: string; desc: string }> = {
  verdant: { id: 'verdant', name: 'Verdant Leafwings', style: 2, color: '#4ade80', rarity: 'rare', desc: 'Wings of living leaf that rustle as you fly.' },
  bonewing: { id: 'bonewing', name: 'Ossuary Wings', style: 3, color: '#e5e7eb', rarity: 'rare', desc: 'Bleached bone pinions from a crypt long sealed.' },
  frostwing: { id: 'frostwing', name: 'Frostwing', style: 4, color: '#7dd3fc', rarity: 'epic', desc: 'Feathers of rime that never melt.' },
  bloodbat: { id: 'bloodbat', name: 'Crimson Nightwings', style: 5, color: '#dc2626', rarity: 'epic', desc: 'Leathery wings dipped in a vampire lord\'s blood.' },
  emberwing: { id: 'emberwing', name: 'Emberwing', style: 6, color: '#f97316', rarity: 'epic', desc: 'Every beat scatters cinders.' },
  starlight: { id: 'starlight', name: 'Starlight Mantle', style: 8, color: '#c4b5fd', rarity: 'legendary', desc: 'Woven from the night sky over the Rift.' },
  voidseraph: { id: 'voidseraph', name: 'Void Seraph', style: 9, color: '#7c3aed', rarity: 'legendary', desc: 'The wings of something that should not have fallen.' },
  goldendawn: { id: 'goldendawn', name: 'Golden Dawn', style: 10, color: '#fbbf24', rarity: 'mythic', desc: 'Radiance itself, given feathers.' }
};
export const WING_TIERS = 10;
export const wingItemId = (skin: string) => 'wing_skin_' + skin;

// Inventory items, one per skin (registered in items.ts ITEMS)
export const WING_SKIN_ITEMS: Record<string, any> = Object.fromEntries(Object.values(WING_SKINS).map(s => [wingItemId(s.id), {
  id: wingItemId(s.id), name: `Wing Skin: ${s.name}`, type: 'wing_skin', skinId: s.id, iconKey: 'feather', rarity: s.rarity,
  sellPrice: s.rarity === 'mythic' ? 200000 : s.rarity === 'legendary' ? 80000 : s.rarity === 'epic' ? 30000 : 10000,
  desc: `${s.desc} Use it to unlock these wings for your SP transformations (Wardrobe: the WINGS button by your SP card slot).`
}]));

// The card's own wing tier for an upgrade level (+10 per tier)
export const cardWingTier = (level: number) => Math.max(0, Math.min(WING_TIERS, Math.floor((level || 0) / 10)));

// Is `style` something this hero may wear right now?
export function styleAllowed(player: any, style: string) {
  if (style === 'auto' || style === 'none') return true;
  if (style.startsWith('tier:')) {
    const n = parseInt(style.slice(5), 10);
    const lvl = (player.equipment && player.equipment.sp && player.equipment.sp.upgradeLevel) || 0;
    return n >= 1 && n <= cardWingTier(lvl);
  }
  return !!WING_SKINS[style] && (player.wingSkins || []).includes(style);
}

export function handleSetWingStyle(gs: any, socketId: string, data: any) {
  const p = gs.players.get(socketId);
  if (!p) return;
  const style = String((data && data.style) || 'auto');
  const socket = gs.io.sockets.sockets.get(socketId);
  if (!styleAllowed(p, style)) {
    if (socket) socket.emit('floating_text', { x: p.x, y: p.y - 0.7, text: 'Those wings are still locked', color: '#ef4444' });
    return;
  }
  p.wingStyle = style;
  if (socket) socket.emit('player_updated', p);
}

export function handleUseWingSkin(gs: any, socketId: string, data: any) {
  const p = gs.players.get(socketId);
  const socket = gs.io.sockets.sockets.get(socketId);
  if (!p || !socket || p.isDead || !data) return;
  const idx = Number(data.itemIndex);
  const item = p.inventory && p.inventory.items[idx];
  const skin = item && item.type === 'wing_skin' && WING_SKINS[item.skinId];
  if (!skin) return;
  p.wingSkins = p.wingSkins || [];
  if (p.wingSkins.includes(skin.id)) {
    socket.emit('floating_text', { x: p.x, y: p.y - 0.7, text: 'You already own these wings', color: '#fbbf24' });
    return;
  }
  if (item.count && item.count > 1) item.count--;
  else p.inventory.items.splice(idx, 1);
  p.wingSkins.push(skin.id);
  p.wingStyle = skin.id;            // wear them straight away
  socket.emit('floating_text', { x: p.x, y: p.y - 1, text: `🪽 ${skin.name} unlocked!`, color: skin.color, size: 20 });
  socket.emit('player_updated', p);
  socket.emit('wing_skin_unlocked', { skin: skin.id });
}

// A boss / miniboss / gold chest may drop a wing skin: the rarer skins come from the harder sources
export function rollWingSkinDrop(source: 'boss' | 'miniboss' | 'chest', floor = 1): string | null {
  const chance = source === 'boss' ? 0.05 : source === 'miniboss' ? 0.015 : 0.004;
  if (Math.random() >= chance) return null;
  const weights: Record<string, number> = { rare: 6, epic: 3, legendary: floor >= 6 ? 1.2 : 0.4, mythic: floor >= 9 ? 0.4 : 0.05 };
  const pool = Object.values(WING_SKINS);
  const total = pool.reduce((t, s) => t + weights[s.rarity], 0);
  let r = Math.random() * total;
  for (const s of pool) { r -= weights[s.rarity]; if (r <= 0) return wingItemId(s.id); }
  return wingItemId(pool[0].id);
}

export function clientCatalog() {
  return { tiers: WING_TIERS, skins: Object.values(WING_SKINS) };
}
