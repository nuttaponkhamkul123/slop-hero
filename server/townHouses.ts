// Slop Hero - walk-in town houses
//
// The town's houses are drawn from 3D builds baked into sprites (public/js/townProps3D.js,
// HOUSE_STYLES). The server picks each house's build and knows its footprint, so it can wall
// the house in with a gap at the door and let heroes walk inside (the client fades the shell
// and shows the room). Everything is in the builds' model units (TILE per world tile,
// x -> world x, z -> world y), scaled by HOUSE_SCALE, with the door on the +z face.
// Keep BUILDS in step with HOUSE_STYLES.

export const HOUSE_SCALE = 2;          // houses at the chibi heroes' scale (a door ~ a hero tall)
const TILE = 32 * Math.SQRT2;          // model units per tile (townProps3D TILE)
export const HOUSE_BUILDS = 6;
const DOOR_GAP = 1.0;                  // tiles of doorway in the wall (the hero is ~0.8 across)

// rooms: walk-in rectangles [cx, cz, w, d]; solid: walled but closed (a wing); door: x of the
// doorway on the first room's +z face
const BUILDS: { rooms: number[][]; solid?: number[][]; door: number }[] = [
  { rooms: [[0, 0, 92, 72]], door: -24 },                       // 0 timber cottage
  { rooms: [[0, 0, 72, 82]], door: -14 },                       // 1 jettied townhouse
  { rooms: [[0, 0, 88, 70]], door: -18 },                       // 2 stone house with tower
  { rooms: [[0, 0, 84, 64]], door: -22 },                       // 3 thatched cottage
  { rooms: [[0, 0, 90, 68]], door: -26 },                       // 4 merchant's house
  { rooms: [[0, -12, 96, 56]], solid: [[28, 33, 40, 34]], door: -20 }  // 5 manor: hall + wing
];

const k = HOUSE_SCALE / TILE;
const toWorld = (x: number, y: number, r: number[]) => {
  const cx = x + r[0] * k, cy = y + r[1] * k, hw = (r[2] * k) / 2, hd = (r[3] * k) / 2;
  return { x0: cx - hw, y0: cy - hd, x1: cx + hw, y1: cy + hd };
};

// Rooms a hero can walk in, in world tiles (the client fades the house while you stand in one)
export function houseRooms(x: number, y: number, build: number) {
  return BUILDS[build % HOUSE_BUILDS].rooms.map(r => toWorld(x, y, r));
}

// Half extents of the whole house (for keeping trees and props off it)
export function houseExtent(build: number) {
  const b = BUILDS[build % HOUSE_BUILDS];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of [...b.rooms, ...(b.solid || [])]) {
    const w = toWorld(0, 0, r);
    x0 = Math.min(x0, w.x0); y0 = Math.min(y0, w.y0); x1 = Math.max(x1, w.x1); y1 = Math.max(y1, w.y1);
  }
  return { x0, y0, x1, y1 };
}

// Wall segments [x0, y0, x1, y1] in world tiles: every room's four sides with the doorway left
// open, and the solid parts closed all round
export function houseWalls(x: number, y: number, build: number) {
  const b = BUILDS[build % HOUSE_BUILDS];
  const segs: number[][] = [];
  const box = (w: { x0: number; y0: number; x1: number; y1: number }, door: number | null) => {
    segs.push([w.x0, w.y0, w.x1, w.y0], [w.x0, w.y0, w.x0, w.y1], [w.x1, w.y0, w.x1, w.y1]);
    if (door === null) { segs.push([w.x0, w.y1, w.x1, w.y1]); return; }
    const g0 = door - DOOR_GAP / 2, g1 = door + DOOR_GAP / 2;
    if (g0 > w.x0) segs.push([w.x0, w.y1, g0, w.y1]);
    if (g1 < w.x1) segs.push([g1, w.y1, w.x1, w.y1]);
  };
  b.rooms.forEach((r, i) => box(toWorld(x, y, r), i === 0 ? x + b.door * k : null));
  for (const r of b.solid || []) box(toWorld(x, y, r), null);
  return segs;
}

// Is a body of `radius` at (px, py) up against one of these walls?
export function hitsWall(walls: number[][], px: number, py: number, radius: number) {
  // walls are thin and heroes are drawn narrower than their 0.4 body circle: a slimmer reach
  // keeps a one-tile doorway easy to walk through without walking through the walls
  const r = radius * 0.55 + 0.05;
  for (const [x0, y0, x1, y1] of walls) {
    // walls are axis-aligned: quick box reject, then distance to the segment
    if (px < Math.min(x0, x1) - r || px > Math.max(x0, x1) + r || py < Math.min(y0, y1) - r || py > Math.max(y0, y1) + r) continue;
    const dx = x1 - x0, dy = y1 - y0;
    const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy || 1)));
    if (Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t)) < r) return true;
  }
  return false;
}
