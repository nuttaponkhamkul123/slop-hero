// Town life for Slop Hero: a pixel-art ground texture for the walled city,
// pixel-art trees, and cosmetic ambience (cloud shadows, chimney smoke,
// pigeons, butterflies, birds, falling leaves, cats and a dog).
//
// Everything here is client-side decoration; nothing touches game state.
// The ground is painted once per map into one canvas at 1 texel per screen
// pixel at zoom 1 (iso coordinates), so it lines up with the 64x32 tiles and
// matches the pixel density of the hero sprites.
(function () {
  'use strict';

  const TW = 64, TH = 32;           // isometric tile size (isometric.js)
  const TILE_PX = 32 * Math.SQRT2;  // one tile edge in model units (townProps3D.js)

  // ---------------------------------------------------------------- noise
  function hash2(x, y) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) {
    return vnoise(x, y) * 0.5 + vnoise(x * 2.07 + 7.3, y * 2.07 + 1.7) * 0.3 + vnoise(x * 4.3 + 3.1, y * 4.3 + 9.2) * 0.2;
  }
  // 4x4 ordered dither, so colour ramps break into pixel-art patterns
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const pack = ([r, g, b]) => (255 << 24) | (b << 16) | (g << 8) | r;
  const ramp = list => list.map(h => pack(rgb(h)));

  const RAMPS = {
    grass: ramp(['#2a4a1f', '#335a24', '#3e6a2a', '#497a30', '#558937', '#62973e', '#71a547', '#83b352']),
    dry: ramp(['#3b4220', '#4a5126', '#5a612d', '#6a7034', '#7b7e3b', '#8b8b44', '#9a984e', '#aaa65a']),
    stone: ramp(['#3d3a35', '#4b4741', '#5a554d', '#69635a', '#787167', '#878074', '#958e81', '#a39b8d']),
    mortar: ramp(['#2a2724', '#322e2a', '#3a3631']),
    moss: ramp(['#22311b', '#2a3d20', '#334a26']),
    earth: ramp(['#2e2419', '#3a2d20', '#473727', '#55422f', '#634d37', '#715a41']),
    flag: ramp(['#3a3934', '#4a4842', '#5b5850', '#6c685f', '#7d786d', '#8e887c', '#9d978a']),
    wood: ramp(['#34200f', '#452b16', '#56371d', '#684425', '#7a522e', '#8b5f37', '#9a6c40']),
    rock: ramp(['#202227', '#2a2d33', '#35383f', '#41454c', '#4d525a']),
    paving: ramp(['#4a4743', '#57534e', '#65625b', '#76726a', '#878279', '#989288', '#a8a297', '#b7b1a5']),
    brass: ramp(['#4a3a1c', '#6a5428', '#8a6e34', '#a98840', '#c5a252', '#dcbc6a'])
  };
  const FLOWERS = ['#f4f1e8', '#f6d84a', '#ec8fb0', '#b9a3ec', '#f39a4a'].map(h => pack(rgb(h)));
  const PEBBLE = pack(rgb('#8e8a7f'));
  const PEBBLE_DARK = pack(rgb('#4f4b44'));

  function quant(r, v, tx, ty) {
    const i = Math.floor(v + BAYER[((ty & 3) << 2) | (tx & 3)] - 0.5);
    return r[i < 0 ? 0 : i >= r.length ? r.length - 1 : i];
  }

  // ---------------------------------------------------------------- ground
  const GRASS = 0, COBBLE = 1, DIRT = 2, WATER = 3, FLAGSTONE = 4, BRIDGE = 5, PLAZA = 6, CLIFF = 7;
  const PAVED = new Set([COBBLE, PLAZA, BRIDGE]);

  // Soft contact shadows around props, sampled from a coarse grid
  function buildOcclusion(map) {
    const R = 4;
    const gw = map.width * R + 1, gh = map.height * R + 1;
    const ao = new Float32Array(gw * gh);
    const SHAPES = {
      house: { hx: 1.06, hy: 0.84, rad: 0.55, str: 0.85 },
      town_wall: { r: 0.45, rad: 0.5, str: 0.55 },
      gate_tower: { r: 0.8, rad: 0.7, str: 0.7 },
      corner_keep: { r: 1, rad: 0.8, str: 0.7 },
      oak_tree: { r: 0.15, rad: 0.75, str: 0.55 },
      pine_tree: { r: 0.12, rad: 0.6, str: 0.5 },
      market_stall: { r: 0.6, rad: 0.5, str: 0.45 },
      flower_bed: { r: 0.3, rad: 0.35, str: 0.4 },
      crates: { r: 0.3, rad: 0.35, str: 0.45 },
      bench: { r: 0.25, rad: 0.3, str: 0.35 },
      well: { r: 0.5, rad: 0.45, str: 0.45 },
      stone_pillar: { r: 0.3, rad: 0.4, str: 0.45 }
    };
    for (const o of map.obstacles || []) {
      const s = SHAPES[o.type];
      if (!s) continue;
      const ext = (s.hx || s.r) + s.rad, exty = (s.hy || s.r) + s.rad;
      const gx0 = Math.max(0, Math.floor((o.x - ext + 0.5) * R)), gx1 = Math.min(gw - 1, Math.ceil((o.x + ext + 0.5) * R));
      const gy0 = Math.max(0, Math.floor((o.y - exty + 0.5) * R)), gy1 = Math.min(gh - 1, Math.ceil((o.y + exty + 0.5) * R));
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const wx = gx / R - 0.5, wy = gy / R - 0.5;
          let d;
          if (s.hx) {
            const dx = Math.max(Math.abs(wx - o.x) - s.hx, 0), dy = Math.max(Math.abs(wy - o.y) - s.hy, 0);
            d = Math.hypot(dx, dy);
          } else {
            d = Math.max(0, Math.hypot(wx - o.x, wy - o.y) - s.r);
          }
          const k = Math.max(0, 1 - d / s.rad);
          const a = s.str * k * k;
          const i = gy * gw + gx;
          if (a > ao[i]) ao[i] = a;
        }
      }
    }
    return (wx, wy) => {
      const fx = (wx + 0.5) * R, fy = (wy + 0.5) * R;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      if (x0 < 0 || y0 < 0 || x0 >= gw - 1 || y0 >= gh - 1) return 0;
      const u = fx - x0, v = fy - y0, i = y0 * gw + x0;
      return (ao[i] * (1 - u) + ao[i + 1] * u) * (1 - v) + (ao[i + gw] * (1 - u) + ao[i + gw + 1] * u) * v;
    };
  }

  // Worn dirt footpaths from each house door down to the street in front of it
  function buildFootpaths(map) {
    const buckets = new Map();
    const tileAt = (x, y) => (map.tiles[y] && map.tiles[y][x] !== undefined ? map.tiles[y][x] : -1);
    for (const o of map.obstacles || []) {
      if (o.type !== 'house') continue;
      // door on the +y face, 24 model units west of centre (townProps3D house)
      const dx = o.x - 24 / TILE_PX, dy = o.y + 36 / TILE_PX;
      const tx = Math.round(dx);
      let end = null;
      for (let k = 1; k <= 6; k++) {
        const ty = Math.round(dy) + k;
        if (PAVED.has(tileAt(tx, ty))) { end = ty - 0.5 + 0.12; break; }
      }
      if (end === null) continue;
      const seg = { x: dx, y0: dy, y1: end, seed: hash2(Math.round(o.x * 7), Math.round(o.y * 7)) * 10 };
      for (let ty = Math.floor(dy) - 1; ty <= Math.ceil(end) + 1; ty++) {
        for (let tx2 = tx - 1; tx2 <= tx + 1; tx2++) {
          const key = ty * 1000 + tx2;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(seg);
        }
      }
    }
    return (ix, iy, wx, wy) => {
      const list = buckets.get(iy * 1000 + ix);
      if (!list) return Infinity;
      let best = Infinity;
      for (const s of list) {
        if (wy < s.y0 - 0.05 || wy > s.y1) continue;
        const cx = s.x + 0.07 * Math.sin(wy * 3.6 + s.seed);
        const w = 0.15 + 0.05 * vnoise(wy * 3, s.seed);
        const d = Math.abs(wx - cx) / w;
        if (d < best) best = d;
      }
      return best;
    };
  }

  // Slowly varying noise precomputed on a coarse world grid (R samples per
  // tile) and interpolated, instead of evaluated for every texel
  function makeField(W, H, R, fn) {
    const gw = W * R + 1, gh = H * R + 1;
    const f = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) f[gy * gw + gx] = fn(gx / R - 0.5, gy / R - 0.5);
    return (wx, wy) => {
      const fx = Math.min(Math.max((wx + 0.5) * R, 0), gw - 1.001), fy = Math.min(Math.max((wy + 0.5) * R, 0), gh - 1.001);
      const x0 = fx | 0, y0 = fy | 0, u = fx - x0, v = fy - y0, i = y0 * gw + x0;
      return (f[i] * (1 - u) + f[i + 1] * u) * (1 - v) + (f[i + gw] * (1 - u) + f[i + gw + 1] * u) * v;
    };
  }

  // Generator: yields every few rows so the town can be painted over several frames
  function* generateGround(map) {
    const W = map.width, H = map.height;
    const tiles = map.tiles;
    const tileAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : tiles[y][x]);
    // (a yield between setup steps keeps each frame's slice short)
    const macroF = makeField(W, H, 4, (x, y) => fbm(x * 0.16, y * 0.16));
    yield;
    const fineF = makeField(W, H, 8, (x, y) => vnoise(x * 2.2, y * 2.2));
    yield;
    const dryF = makeField(W, H, 2, (x, y) => vnoise(x * 0.09 + 31.7, y * 0.09 + 11.3));
    const flowerF = makeField(W, H, 2, (x, y) => vnoise(x * 0.35 + 70, y * 0.35 + 13));
    const grimeF = makeField(W, H, 4, (x, y) => fbm(x * 0.3, y * 0.3));
    yield;
    const earthF = makeField(W, H, 8, (x, y) => fbm(x * 1.3, y * 1.3));
    yield;
    const minX = -(H - 1) * (TW / 2) - TW / 2, maxX = (W - 1) * (TW / 2) + TW / 2;
    const minY = -TH / 2, maxY = (W + H - 2) * (TH / 2) + TH / 2;
    const cw = maxX - minX, ch = maxY - minY;
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const cctx = canvas.getContext('2d');
    const img = cctx.createImageData(cw, ch);
    const px = new Uint32Array(img.data.buffer);
    const aoAt = buildOcclusion(map);
    yield;
    const pathAt = buildFootpaths(map);

    // distance from (wx, wy) to the nearest neighbouring tile matching pred
    const edgeDist = (ix, iy, wx, wy, pred) => {
      let best = Infinity;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const t = tileAt(ix + dx, iy + dy);
          if (t < 0 || !pred(t)) continue;
          const nx = ix + dx, ny = iy + dy;
          const ex = Math.max(nx - 0.5 - wx, 0, wx - nx - 0.5), ey = Math.max(ny - 0.5 - wy, 0, wy - ny - 0.5);
          const d = Math.hypot(ex, ey);
          if (d < best) best = d;
        }
      }
      return best;
    };
    const isSoft = t => t === GRASS || t === DIRT || t === CLIFF;
    const isHard = t => PAVED.has(t) || t === FLAGSTONE;
    // per tile: does any neighbour need edge blending? (skips most edge searches)
    const nbrFlags = (pred) => {
      const out = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          for (let dy = -1; dy <= 1 && !out[y * W + x]; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const t = tileAt(x + dx, y + dy);
              if ((dx || dy) && t >= 0 && pred(t)) { out[y * W + x] = 1; break; }
            }
          }
        }
      }
      return out;
    };
    const hardNbr = nbrFlags(isHard), softNbr = nbrFlags(isSoft);
    const plazaEdge = nbrFlags(t => t !== PLAZA);
    const fountain = (map.obstacles || []).find(o => o.type === 'fountain') || { x: W / 2, y: H / 2 };
    // plaza paving: stone shading shared by the radial and square layouts
    const paving = (hs, edgeA, edgeB, tx, ty, ao) => {
      let v = 3.1 + hs * 1.9 + (hash2(tx, ty) - 0.5) * 0.7 - ao * 2.4;
      if (edgeA) v += 1;
      else if (edgeB) v -= 1.1;
      return quant(RAMPS.paving, v, tx, ty);
    };

    const grass = (wx, wy, tx, ty, dark, ao) => {
      const h = hash2(tx, ty);
      if (h > 0.986 && dark < 0.5 && ao < 0.2 && flowerF(wx, wy) > 0.6) return FLOWERS[Math.floor(hash2(tx + 3, ty) * FLOWERS.length)];
      if (h < 0.0022) return PEBBLE;
      let v = 1.4 + macroF(wx, wy) * 3.8 + (fineF(wx, wy) - 0.5) * 1.4 - dark - ao * 3.2;
      if (h < 0.075) v -= 1.6;                      // dark blade
      else if (hash2(tx, ty + 1) < 0.075) v += 1.1; // its lit tip, one texel up
      const dry = dryF(wx, wy);
      const r = dry > 0.64 && BAYER[((ty & 3) << 2) | (tx & 3)] < (dry - 0.64) * 6 ? RAMPS.dry : RAMPS.grass;
      return quant(r, v, tx, ty);
    };
    const earth = (wx, wy, tx, ty, ao) => {
      const h = hash2(tx + 11, ty + 5);
      if (h < 0.03) return PEBBLE;
      if (h < 0.05) return PEBBLE_DARK;
      return quant(RAMPS.earth, 2.4 + (earthF(wx, wy) - 0.5) * 2.4 - ao * 2.2, tx, ty);
    };

    for (let ty = 0; ty < ch; ty++) {
      if ((ty & 7) === 0) yield;
      const Y = minY + ty + 0.5;
      for (let tx = 0; tx < cw; tx++) {
        const X = minX + tx + 0.5;
        const wx = (X / (TW / 2) + Y / (TH / 2)) / 2;
        const wy = (Y / (TH / 2) - X / (TW / 2)) / 2;
        const ix = Math.round(wx), iy = Math.round(wy);
        if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
        const t = tiles[iy][ix];
        const ao = aoAt(wx, wy);
        let c;
        if (t === GRASS) {
          const path = pathAt(ix, iy, wx, wy);
          const hard = hardNbr[iy * W + ix];
          const n = path < 2 || hard ? vnoise(wx * 6.1, wy * 6.1) : 0;
          if (path < 0.75 + n * 0.3) c = earth(wx, wy, tx, ty, ao);
          else if (path < 1.15 + n * 0.3) c = grass(wx, wy, tx, ty, 1.1, ao);
          else {
            const dp = hard ? edgeDist(ix, iy, wx, wy, isHard) : Infinity;
            c = grass(wx, wy, tx, ty, dp < 0.14 + n * 0.12 ? 0.9 : 0, ao);
          }
        } else if (t === COBBLE) {
          const soft = softNbr[iy * W + ix];
          const de = soft ? edgeDist(ix, iy, wx, wy, isSoft) : Infinity;
          const n = soft ? vnoise(wx * 5.3, wy * 5.3) : 0.5;
          if (de < 0.04 + n * 0.16) c = grass(wx, wy, tx, ty, 1, ao);
          else if (de < 0.12 + n * 0.2) c = earth(wx, wy, tx, ty, ao);
          else {
            // rounded stones laid in screen-aligned rows (texel space), each
            // row shifted at random, some stones split in two
            const SW = 10, SH = 6;
            const r = Math.floor(ty / SH), fv = ty - r * SH;
            const uu = tx + Math.floor(hash2(r, 91) * SW);
            let cell = Math.floor(uu / SW), fu = uu - cell * SW, w = SW - 1;
            if (hash2(cell, r + 400) < 0.25) {
              const half = SW >> 1;
              if (fu >= half) { fu -= half; cell += 1000; }
              w = half - 1;
            }
            const hs = hash2(cell, r * 7 + 3);
            const corner = (fu === 0 || fu === w - 1) && (fv === 0 || fv === SH - 2);
            if (fu >= w || fv >= SH - 1 || corner) {
              c = quant(de < 0.55 && n > 0.35 ? RAMPS.moss : RAMPS.mortar, 1.2 + (n - 0.5) * 2 - ao * 2, tx, ty);
            } else {
              let val = 3 + hs * 2.4 + (grimeF(wx, wy) - 0.5) * 1.6 + (hash2(tx, ty) - 0.5) * 0.8 - ao * 3;
              if (fv === 0) val += 1.3;           // lit top edge
              else if (fv === SH - 2) val -= 1.3; // shadowed lower edge
              if (fu === 0) val += 0.5;
              else if (fu === w - 1) val -= 0.6;
              c = quant(RAMPS.stone, val, tx, ty);
            }
          }
        } else if (t === FLAGSTONE) {
          const cs = 0.42, gx = wx / cs, gy = wy / cs, cx = Math.floor(gx), cy = Math.floor(gy);
          let d1 = 9, d2 = 9, id = 0, ox = 0, oy = 0;
          for (let j = -1; j <= 1; j++) {
            for (let i = -1; i <= 1; i++) {
              const px2 = cx + i + 0.15 + 0.7 * hash2(cx + i, cy + j), py2 = cy + j + 0.15 + 0.7 * hash2(cy + j + 17, cx + i + 3);
              const d = Math.hypot(gx - px2, gy - py2);
              if (d < d1) { d2 = d1; d1 = d; id = hash2(cx + i + 9, cy + j + 41); ox = gx - px2; oy = gy - py2; } else if (d < d2) d2 = d;
            }
          }
          const gap = d2 - d1, n = vnoise(wx * 7, wy * 7);
          if (gap < 0.1 + n * 0.12) c = grass(wx, wy, tx, ty, 1.3, ao);
          else {
            let val = 1.8 + id * 2.6 + (hash2(tx, ty) - 0.5) * 0.9 - ao * 2.5;
            if (gap < 0.22) val += ox + oy < 0 ? 1 : -1;
            c = quant(RAMPS.flag, val, tx, ty);
          }
        } else if (t === BRIDGE) {
          const r = Math.floor(wy * 4.5), fv = wy * 4.5 - r;
          const side = edgeDist(ix, iy, wx, wy, tt => tt === WATER || tt === GRASS);
          if (fv < 0.12) c = RAMPS.wood[0];
          else if (side < 0.09) c = quant(RAMPS.wood, 1 + (hash2(tx, ty) - 0.5), tx, ty);
          else c = quant(RAMPS.wood, 2.4 + hash2(r, 3) * 2 + (vnoise(wx * 9, r * 3.1) - 0.5) * 1.8 + (fv < 0.25 ? 0.8 : 0), tx, ty);
        } else if (t === PLAZA) {
          const de = plazaEdge[iy * W + ix] ? edgeDist(ix, iy, wx, wy, tt => tt !== PLAZA) : Infinity;
          const r = Math.hypot(wx - fountain.x, wy - fountain.y);
          if (de < 0.18) {
            // kerb of long dark blocks around the plaza
            const joint = ((wx + wy) * 1.6) % 1;
            c = joint < 0.07 ? RAMPS.mortar[1] : quant(RAMPS.paving, 1.4 + hash2(Math.floor((wx + wy) * 1.6), 5) + (de < 0.05 ? 1 : 0) - ao * 2, tx, ty);
          } else if (Math.abs(r - 3) < 0.13 || Math.abs(r - 5.4) < 0.13) {
            // brass inlay rings around the fountain
            const ring = Math.abs(r - 3) < 0.13 ? r - 3 : r - 5.4;
            c = quant(RAMPS.brass, 2.6 - ring * 9 + (hash2(tx, ty) - 0.5), tx, ty);
          } else if (r < 5.4) {
            // wedge-shaped stones laid in rings
            const band = Math.floor(r / 0.6), fr = r / 0.6 - band;
            const segs = Math.max(6, Math.floor((Math.PI * 2 * (band + 0.5) * 0.6) / 0.55));
            const ang = (Math.atan2(wy - fountain.y, wx - fountain.x) / (Math.PI * 2) + 1 + band * 0.37) * segs;
            const seg = Math.floor(ang), fa = ang - seg;
            const arc = (Math.PI * 2 * r) / segs; // world length of one stone along the ring
            if (fr < 0.1 || fa * arc < 0.045 || (1 - fa) * arc < 0.02) c = RAMPS.mortar[2];
            else c = paving(hash2(seg, band * 13 + 1), fr < 0.22, fr > 0.88, tx, ty, ao);
          } else {
            // square slabs in offset rows
            const v = wy * 2, row = Math.floor(v), fv = v - row;
            const u = wx * 2 + (row & 1) * 0.5, col = Math.floor(u), fu = u - col;
            if (fu < 0.07 || fv < 0.07) c = RAMPS.mortar[2];
            else c = paving(hash2(col, row * 5 + 2), fu < 0.17 || fv < 0.17, fu > 0.92 || fv > 0.92, tx, ty, ao);
          }
        } else if (t === DIRT) {
          c = earth(wx, wy, tx, ty, ao);
        } else if (t === CLIFF) {
          c = quant(RAMPS.rock, 2 + (fbm(wx * 1.1, wy * 1.1) - 0.5) * 3 + (hash2(tx, ty) - 0.5), tx, ty);
        } else {
          continue; // water repaints itself every frame
        }
        px[ty * cw + tx] = c;
      }
    }
    cctx.putImageData(img, 0, 0);
    return { canvas, minX, minY };
  }

  // Returns the finished texture, or null while it is still being painted:
  // each call spends at most budgetMs on it, so entering town never stalls
  const groundJobs = new WeakMap();
  function groundTexture(map, budgetMs = 6) {
    if (!map || !map.tiles) return null;
    const version = map._tilesVersion || 0;
    let job = groundJobs.get(map);
    if (!job || job.version !== version) {
      job = { version, it: generateGround(map), tex: null };
      groundJobs.set(map, job);
    }
    if (job.tex) return job.tex;
    const t0 = performance.now();
    while (performance.now() - t0 < budgetMs) {
      const step = job.it.next();
      if (step.done) { job.tex = step.value; break; }
    }
    return job.tex;
  }

  // ---------------------------------------------------------------- pixel painter
  // Material grid -> shaded, outlined pixel sprite (lit from the top-left).
  function paintSprite(W, H, palette, outline, draw) {
    const grid = new Array(W * H).fill(null);
    const flat = new Map();
    const mats = {};
    for (const [name, col] of Object.entries(palette)) {
      const c = rgb(col);
      const mix = (t) => c.map(v => Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t)));
      mats[name] = { b: c, l: mix(0.25), d: mix(-0.3) };
    }
    const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? y * W + x : -1);
    const api = {
      set(x, y, m) { const i = at(x, y); if (i >= 0) { grid[i] = m; flat.delete(i); } },
      clear(x, y) { const i = at(x, y); if (i >= 0) { grid[i] = null; flat.delete(i); } },
      fill(x0, y0, x1, y1, m) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) api.set(x, y, m); },
      dot(x, y, col) { const i = at(x, y); if (i >= 0) { grid[i] = '*'; flat.set(i, typeof col === 'string' ? rgb(col) : col); } }
    };
    draw(api);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const sctx = canvas.getContext('2d');
    const img = sctx.createImageData(W, H);
    const out = rgb(outline);
    const cell = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : grid[y * W + x]);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, m = grid[i];
        let col = null;
        if (m === null) {
          if (cell(x - 1, y) || cell(x + 1, y) || cell(x, y - 1) || cell(x, y + 1)) col = out;
        } else if (flat.has(i)) col = flat.get(i);
        else {
          const t = mats[m];
          if (cell(x, y - 1) === null || cell(x - 1, y) === null) col = t.l;
          else if (cell(x + 1, y) !== m || cell(x, y + 1) !== m) col = t.d;
          else col = t.b;
        }
        if (!col) continue;
        img.data.set([col[0], col[1], col[2], 255], i * 4);
      }
    }
    sctx.putImageData(img, 0, 0);
    return canvas;
  }

  // ---------------------------------------------------------------- trees
  // Procedural pixel trees: shaded leaf clusters (oak) or jagged tiers (pine).
  // Trunk and crown are separate canvases so the crown can sway.
  const LEAVES = ramp(['#132a17', '#1a3a1e', '#224a25', '#2c5c2c', '#376e33', '#46813b', '#589346', '#6ea653']);
  const NEEDLES = ramp(['#0e2216', '#132e1d', '#1a3b25', '#21492d', '#2a5836', '#35683f', '#427949']);
  const BARK = ramp(['#24170f', '#352318', '#4a3222', '#5f432e']);
  const treeCache = new Map();

  function rasterTree(W, H, fn, outlineHex) {
    const px = new Uint32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = fn(x, y); if (c) px[y * W + x] = c; }
    const out = pack(rgb(outlineHex));
    const lined = px.slice();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (px[y * W + x]) continue;
        const n = (x > 0 && px[y * W + x - 1]) || (x < W - 1 && px[y * W + x + 1]) || (y > 0 && px[(y - 1) * W + x]) || (y < H - 1 && px[(y + 1) * W + x]);
        if (n) lined[y * W + x] = out;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const cctx = canvas.getContext('2d');
    const img = cctx.createImageData(W, H);
    new Uint32Array(img.data.buffer).set(lined);
    cctx.putImageData(img, 0, 0);
    return canvas;
  }

  function treeSprite(type, variant) {
    const key = `${type}|${variant}`;
    if (treeCache.has(key)) return treeCache.get(key);
    const seed = variant * 101 + (type === 'pine_tree' ? 7 : 3);
    let spr;
    if (type === 'pine_tree') {
      const W = 40, H = 82, ax = 20, ay = 80;
      const trunk = rasterTree(W, H, (x, y) => {
        if (y < 66 || y > 79) return 0;
        const dx = x - ax + 0.5;
        if (Math.abs(dx) > 2.5) return 0;
        return quant(BARK, 2 - dx * 0.6 + (hash2(x, y + seed) - 0.5), x, y);
      }, '#140d08');
      const tiers = [[6, 30, 9], [20, 46, 13], [34, 61, 16], [48, 72, 18]];
      const crown = rasterTree(W, H, (x, y) => {
        const dx = x - ax + 0.5;
        for (let k = tiers.length - 1; k >= 0; k--) {
          const [y0, y1, hw] = tiers[k];
          const jag = (hash2(x * 3 + k, seed) < 0.5 ? 1 : 0) + ((x + k) % 3 === 0 ? 2 : 0);
          if (y < y0 || y > y1 - jag) continue;
          const f = (y - y0) / (y1 - y0);
          const half = 1 + f * hw;
          if (Math.abs(dx) > half) continue;
          const v = 2.6 - (dx / half) * 1.8 - f * 1.4 + (hash2(x + seed, y) - 0.5) * 1.2 + (k === 0 ? 0.6 : 0);
          return quant(NEEDLES, v, x, y);
        }
        return 0;
      }, '#081510');
      spr = { trunk, crown, ax, ay };
    } else {
      const W = 60, H = 80, ax = 30, ay = 78;
      const blobs = [];
      const rnd = (i) => hash2(i * 13 + seed, seed * 7 + i);
      blobs.push({ x: 30, y: 32, r: 15 });
      for (let i = 0; i < 11; i++) {
        const a = rnd(i) * Math.PI * 2, d = 0.35 + rnd(i + 40) * 0.6;
        blobs.push({ x: 30 + Math.cos(a) * 17 * d, y: 30 + Math.sin(a) * 14 * d - 3, r: 7 + rnd(i + 80) * 5 });
      }
      const L = [-0.55, -0.68, 0.48];
      const trunk = rasterTree(W, H, (x, y) => {
        if (y < 40 || y > 77) return 0;
        const dx = x - ax + 0.5;
        const flare = y > 72 ? (y - 72) * 0.9 : 0;
        if (Math.abs(dx) > 3.2 + flare) return 0;
        // a fork into two limbs inside the crown
        return quant(BARK, 2.1 - dx * 0.45 + (hash2(x + seed, y * 3) < 0.18 ? -1 : 0), x, y);
      }, '#140d08');
      const crown = rasterTree(W, H, (x, y) => {
        let best = 0, bb = null;
        for (const b of blobs) {
          const k = 1 - ((x - b.x) ** 2 + (y - b.y) ** 2) / (b.r * b.r);
          if (k > best) { best = k; bb = b; }
        }
        if (!bb) return 0;
        const nx = (x - bb.x) / bb.r, ny = (y - bb.y) / bb.r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lit = nx * L[0] + ny * L[1] + nz * L[2];
        const v = 1.2 + lit * 4.2 + (32 - y) / 26 + (hash2(x * 5 + seed, y * 3) - 0.5) * 1.3;
        return quant(LEAVES, v, x, y);
      }, '#0b1a0e');
      spr = { trunk, crown, ax, ay };
    }
    treeCache.set(key, spr);
    return spr;
  }

  // ---------------------------------------------------------------- critter sprites
  const spriteCache = new Map();
  const cached = (key, make) => {
    if (!spriteCache.has(key)) spriteCache.set(key, make());
    return spriteCache.get(key);
  };

  // pigeon, facing right: 'stand' | 'peck' | 'flyUp' | 'flyDown'
  function pigeonSprite(pose) {
    return cached('pigeon|' + pose, () => paintSprite(15, 11, {
      body: '#8d91a0', wing: '#a6aab6', bar: '#4f5361', tail: '#5d6170', neck: '#3f8a72', neck2: '#7b5a96', head: '#9599a8'
    }, '#22202a', ({ fill, set, clear, dot }) => {
      const flying = pose === 'flyUp' || pose === 'flyDown';
      fill(3, 5, 10, 8, 'body');
      clear(3, 8);
      fill(0, 5, 2, 6, 'tail');
      if (!flying) {
        fill(4, 5, 8, 6, 'wing');
        set(6, 6, 'bar');
        set(8, 6, 'bar');
        dot(6, 9, '#d88f6f');
        dot(8, 9, '#d88f6f');
        dot(5, 10, '#d88f6f');
        dot(9, 10, '#d88f6f');
      } else if (pose === 'flyUp') {
        fill(5, 1, 7, 4, 'wing');
        fill(6, 0, 7, 0, 'wing');
        set(7, 3, 'bar');
      } else {
        fill(5, 8, 7, 10, 'wing');
        set(6, 9, 'bar');
      }
      if (pose === 'peck') {
        fill(10, 6, 11, 7, 'neck');
        set(11, 7, 'neck2');
        fill(11, 8, 13, 9, 'head');
        dot(13, 8, '#f08a2c');
        dot(14, 9, '#3a3540');
      } else {
        fill(9, 3, 10, 5, 'neck');
        set(9, 5, 'neck2');
        set(10, 5, 'neck2');
        fill(10, 1, 12, 3, 'head');
        clear(12, 1);
        dot(12, 2, '#f08a2c');
        dot(13, 3, '#3a3540');
      }
    }));
  }

  const CAT_COATS = [
    { fur: '#d98a3d', dark: '#a85f22', chest: '#f3e2c4' },  // ginger tabby
    { fur: '#7d808a', dark: '#565963', chest: '#e6e2da' },  // grey
    { fur: '#2f2b35', dark: '#1f1c24', chest: '#e9e5dc' }   // tuxedo
  ];
  // sitting cat facing the viewer, head turned right; tail frame 0/1, blink
  function catSprite(coat, tail, blink) {
    const c = CAT_COATS[coat];
    return cached(`cat|${coat}|${tail}|${blink}`, () => paintSprite(15, 15, {
      fur: c.fur, dark: c.dark, chest: c.chest
    }, '#1a161d', ({ fill, set, clear, dot }) => {
      // body and haunches
      fill(2, 7, 9, 13, 'fur');
      fill(1, 10, 10, 13, 'fur');
      clear(1, 10);
      clear(10, 10);
      fill(4, 8, 6, 12, 'chest');
      dot(4, 13, c.chest);
      dot(6, 13, c.chest);
      // head with ears
      fill(2, 2, 8, 6, 'fur');
      clear(2, 2);
      clear(8, 2);
      set(2, 1, 'fur');
      set(3, 1, 'fur');
      set(7, 1, 'fur');
      set(8, 1, 'fur');
      set(2, 0, 'fur');
      set(8, 0, 'fur');
      dot(3, 2, '#e8a0a8');
      dot(7, 2, '#e8a0a8');
      for (const x of [4, 6]) set(x, 2, 'dark');
      set(1, 11, 'dark');
      set(9, 9, 'dark');
      fill(4, 5, 6, 6, 'chest');
      if (blink) {
        dot(3, 4, c.dark);
        dot(7, 4, c.dark);
      } else {
        dot(3, 4, '#b6e05c');
        dot(7, 4, '#b6e05c');
      }
      dot(5, 5, '#e3949a');
      // tail curling around the side
      if (tail === 0) {
        fill(10, 12, 12, 13, 'fur');
        set(13, 12, 'fur');
        set(13, 11, 'dark');
      } else {
        fill(10, 12, 11, 13, 'fur');
        set(12, 11, 'fur');
        set(12, 10, 'fur');
        set(13, 9, 'dark');
      }
    }));
  }

  // dog, side view facing right: frame 0-3 walk cycle, 4 = sitting
  function dogSprite(frame, wag) {
    return cached(`dog|${frame}|${wag}`, () => paintSprite(20, 15, {
      fur: '#a8723f', dark: '#6e4522', light: '#d2a26a', white: '#efe6d6', ear: '#5c391c'
    }, '#1c140e', ({ fill, set, clear, dot }) => {
      const sit = frame === 4;
      // tail
      if (wag) { set(3, 4, 'fur'); set(2, 3, 'fur'); set(1, 2, 'light'); } else { set(3, 5, 'fur'); set(2, 4, 'fur'); set(1, 4, 'light'); }
      if (sit) {
        fill(4, 7, 11, 11, 'fur');
        fill(5, 11, 10, 12, 'fur');
        fill(12, 5, 14, 12, 'fur');
        fill(13, 7, 14, 11, 'white');
        fill(12, 12, 13, 13, 'dark');
        fill(5, 13, 7, 13, 'dark');
      } else {
        fill(4, 6, 13, 10, 'fur');
        fill(6, 10, 12, 10, 'light');
        fill(12, 5, 14, 10, 'fur');
        fill(13, 7, 14, 10, 'white');
        // legs: back pair at 5/7, front pair at 11/13; they scissor through the cycle
        const off = [[1, -1, 1, -1], [0, 0, 0, 0], [-1, 1, -1, 1], [0, 0, 0, 0]][frame];
        const lift = [[0, 1, 0, 1], [0, 0, 0, 0], [1, 0, 1, 0], [0, 0, 0, 0]][frame];
        [5, 7, 11, 13].forEach((lx, i) => {
          const x = lx + off[i];
          fill(x, 11, x, 13 - lift[i], i % 2 ? 'dark' : 'fur');
        });
      }
      // head
      const hy = sit ? 0 : 1;
      fill(13, hy + 1, 16, hy + 4, 'fur');
      fill(17, hy + 3, 18, hy + 4, 'light');
      dot(18, hy + 3, '#16110e');
      dot(15, hy + 2, '#16110e');
      fill(13, hy + 1, 13, hy + 4, 'ear');
      set(14, hy, 'ear');
      clear(16, hy + 1);
      if (sit || frame % 2) dot(17, hy + 5, '#e4788a');
    }));
  }

  // ---------------------------------------------------------------- ambience
  const worldToScreen = (R, x, y, z = 0) => Isometric.worldToScreen(x, y, z, R.camera, R.canvas.width, R.canvas.height);
  const onScreen = (R, s, m = 80) => s.x > -m && s.y > -m && s.x < R.canvas.width + m && s.y < R.canvas.height + m;
  const WIND = { x: 0.16, y: -0.1 }; // tiles per second
  const BUTTERFLY_COLOURS = [['#f8f4e6', '#b8b2a0'], ['#f7d24a', '#b8901c'], ['#f08a3c', '#a4521a'], ['#8fb8f0', '#4a6fb0'], ['#e88ad0', '#a24c8c']];

  class Ambience {
    constructor(map) {
      this.map = map;
      this.time = 0;
      const obs = map.obstacles || [];
      this.houses = obs.filter(o => o.type === 'house').map(o => ({
        o,
        // chimney top on the 3D house: model (-28, 85.4, -12), 30 deg tilt
        cx: o.x - 28 / TILE_PX, cy: o.y - 12 / TILE_PX, cz: (85.4 * Math.cos(Math.PI / 6)) / TH,
        timer: hash2(Math.round(o.x * 10), Math.round(o.y * 10)) * 0.6
      }));
      this.oaks = obs.filter(o => o.type === 'oak_tree').map(o => ({ o, timer: 1 + hash2(Math.round(o.x * 9), Math.round(o.y * 9)) * 5 }));
      this.smoke = [];
      this.leaves = [];
      this.flocks = [];
      this.flockTimer = 3;

      this.clouds = [];
      for (let i = 0; i < 6; i++) {
        const lobes = [];
        for (let k = 0; k < 3; k++) lobes.push({ dx: (hash2(i, k) - 0.5) * 5, dy: (hash2(k, i + 7) - 0.5) * 4, r: 3.5 + hash2(i + 3, k + 5) * 3.5 });
        this.clouds.push({ x: hash2(i, 99) * 60 - 10, y: hash2(99, i) * 60 - 10, lobes });
      }

      // plaza pigeons
      this.plaza = { x0: 16.6, x1: 23.4, y0: 16.6, y1: 23.4 };
      this.blocked = obs.filter(o => ['fountain', 'merchant', 'blacksmith', 'enchanter', 'portal', 'flower_bed', 'torch'].includes(o.type))
        .map(o => ({ x: o.x, y: o.y, r: o.type === 'fountain' ? 2.3 : o.type === 'flower_bed' || o.type === 'torch' ? 0.7 : 1.6 }));
      this.pigeons = [];
      for (let i = 0; i < 12; i++) {
        const p = this.pigeonSpot(i * 3.7) || { x: 18, y: 21 };
        this.pigeons.push({ x: p.x, y: p.y, z: 0, state: 'ground', act: 'idle', t: hash2(i, 5) * 2, flip: hash2(i, 9) < 0.5, phase: hash2(i, 3) * 10 });
      }

      this.butterflies = obs.filter(o => o.type === 'flower_bed').map((o, i) => ({
        bed: o, phase: hash2(i, 31) * 20, speed: 0.7 + hash2(i, 33) * 0.6, colour: BUTTERFLY_COLOURS[i % BUTTERFLY_COLOURS.length], x: o.x, y: o.y, z: 0.5
      }));

      // cats lounging on a few doorsteps
      this.cats = this.houses.filter((h, i) => i % 5 === 1).slice(0, 3).map((h, i) => ({
        x: h.o.x - 24 / TILE_PX + 0.5, y: h.o.y + 36 / TILE_PX + 0.35, coat: i % CAT_COATS.length,
        flip: i % 2 === 0, phase: hash2(i, 77) * 10, blinkAt: 2 + hash2(i, 78) * 3
      }));

      this.dog = { x: 20, y: 26, phase: 0, moving: false, flip: false, ownerIndex: 1 };
    }

    pigeonSpot(seed) {
      const P = this.plaza;
      for (let k = 0; k < 20; k++) {
        const x = P.x0 + hash2(Math.floor(seed * 100) + k, 3) * (P.x1 - P.x0);
        const y = P.y0 + hash2(Math.floor(seed * 100) + k, 7) * (P.y1 - P.y0);
        if (!this.blocked.some(b => Math.hypot(b.x - x, b.y - y) < b.r)) return { x, y };
      }
      return null;
    }

    update(dt, R, walkers) {
      dt = Math.min(dt, 0.1);
      this.time += dt;
      const t = this.time;

      for (const c of this.clouds) {
        c.x += WIND.x * 1.6 * dt;
        c.y += WIND.y * 1.6 * dt;
        if (c.x > 55) c.x -= 70;
        if (c.y < -15) c.y += 70;
      }

      // pigeons peck about and burst into the air when someone walks close
      const near = (x, y, r) => walkers.some(w => Math.hypot(w.x - x, w.y - y) < r);
      for (const p of this.pigeons) {
        p.t -= dt;
        if (p.state === 'ground') {
          if (near(p.x, p.y, 1.4)) {
            const w = walkers.reduce((a, b) => (Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? b : a));
            let ax = p.x - w.x, ay = p.y - w.y;
            const l = Math.hypot(ax, ay) || 1;
            ax = ax / l + (Math.random() - 0.5) * 0.8;
            ay = ay / l + (Math.random() - 0.5) * 0.8;
            Object.assign(p, { state: 'fly', vx: ax * 2.6, vy: ay * 2.6, vz: 2.4, t: 2.6 });
            continue;
          }
          if (p.act === 'walk') {
            const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
            if (d < 0.02) p.t = 0;
            else {
              const s = Math.min(d, 0.8 * dt);
              p.x += (dx / d) * s;
              p.y += (dy / d) * s;
              p.phase += dt * 14;
            }
          }
          if (p.t <= 0) {
            const r = Math.random();
            if (r < 0.5) Object.assign(p, { act: 'peck', t: 0.6 + Math.random() * 1.2 });
            else if (r < 0.8) {
              const a = Math.random() * Math.PI * 2, d = 0.25 + Math.random() * 0.5;
              const tx = p.x + Math.cos(a) * d, ty = p.y + Math.sin(a) * d;
              const P = this.plaza;
              const ok = tx > P.x0 && tx < P.x1 && ty > P.y0 && ty < P.y1 && !this.blocked.some(b => Math.hypot(b.x - tx, b.y - ty) < b.r);
              Object.assign(p, ok ? { act: 'walk', tx, ty, t: 2 } : { act: 'idle', t: 0.5 });
              if (ok) p.flip = (tx - ty) - (p.x - p.y) < 0;
            } else Object.assign(p, { act: 'idle', t: 0.4 + Math.random() * 1.5 });
          }
        } else if (p.state === 'fly') {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.flip = p.vx - p.vy < 0;
          if (p.t <= 0) Object.assign(p, { state: 'gone', t: 6 + Math.random() * 9 });
        } else if (p.state === 'gone') {
          if (p.t <= 0) {
            const spot = this.pigeonSpot(Math.random() * 50);
            if (spot && !near(spot.x, spot.y, 2.5)) {
              const fromX = spot.x - 2.5 - Math.random(), fromY = spot.y + (Math.random() - 0.5) * 2;
              Object.assign(p, { state: 'land', sx: fromX, sy: fromY, ex: spot.x, ey: spot.y, t: 1.6, flip: false, x: fromX, y: fromY, z: 3.5 });
            } else p.t = 2;
          }
        } else if (p.state === 'land') {
          const k = 1 - Math.max(0, p.t) / 1.6;
          const e = 1 - (1 - k) * (1 - k);
          p.x = p.sx + (p.ex - p.sx) * e;
          p.y = p.sy + (p.ey - p.sy) * e;
          p.z = 3.5 * (1 - e);
          if (p.t <= 0) Object.assign(p, { state: 'ground', act: 'idle', z: 0, t: 0.5 });
        }
      }

      for (const b of this.butterflies) {
        const a = t * 0.9 * b.speed + b.phase;
        b.x = b.bed.x + Math.cos(a) * 0.55 + Math.sin(a * 2.3) * 0.15;
        b.y = b.bed.y + Math.sin(a * 1.7) * 0.4;
        b.z = 0.45 + 0.18 * Math.sin(a * 3.1);
      }

      // the dog trots after its owner and sits when they stop
      const folk = R.townsfolk && R.townsfolk.folk;
      const owner = folk && folk[this.dog.ownerIndex];
      if (owner) {
        const d = this.dog;
        const dx = owner.x - d.x, dy = owner.y - d.y, dist = Math.hypot(dx, dy);
        if (dist > 6) { d.x = owner.x - 0.6; d.y = owner.y + 0.3; }
        else if (dist > 0.85) {
          const s = Math.min(dist - 0.75, (dist > 1.6 ? 3 : 1.7) * dt);
          d.x += (dx / dist) * s;
          d.y += (dy / dist) * s;
          d.phase += s * 7;
          d.moving = true;
          const sx = dx - dy;
          if (Math.abs(sx) > 0.01) d.flip = sx < 0;
        } else d.moving = false;
      }

      // chimney smoke from houses near the screen
      for (const h of this.houses) {
        const s = worldToScreen(R, h.cx, h.cy, h.cz);
        if (!onScreen(R, s, 300)) continue;
        h.timer -= dt;
        if (h.timer <= 0) {
          h.timer = 0.28 + Math.random() * 0.2;
          this.smoke.push({ x: h.cx + (Math.random() - 0.5) * 0.05, y: h.cy, z: h.cz, age: 0, life: 4 + Math.random() * 1.5, size: 2.5 + Math.random() * 1.5, shade: Math.random() });
        }
      }
      for (let i = this.smoke.length - 1; i >= 0; i--) {
        const p = this.smoke[i];
        p.age += dt;
        if (p.age >= p.life) { this.smoke.splice(i, 1); continue; }
        const k = p.age / p.life;
        p.x += WIND.x * (0.5 + k * 1.5) * dt;
        p.y += WIND.y * (0.5 + k * 1.5) * dt;
        p.z += (0.42 - k * 0.2) * dt;
      }

      // leaves drift down from the oaks
      for (const tr of this.oaks) {
        const s = worldToScreen(R, tr.o.x, tr.o.y);
        if (!onScreen(R, s, 200)) continue;
        tr.timer -= dt;
        if (tr.timer <= 0) {
          tr.timer = 2.5 + Math.random() * 5;
          this.leaves.push({
            x: tr.o.x + (Math.random() - 0.5) * 0.7, y: tr.o.y + (Math.random() - 0.5) * 0.5, z: 1.3 + Math.random() * 0.6,
            age: 0, rest: 0, hue: Math.random(), phase: Math.random() * 6
          });
        }
      }
      for (let i = this.leaves.length - 1; i >= 0; i--) {
        const l = this.leaves[i];
        l.age += dt;
        if (l.z > 0) {
          l.z = Math.max(0, l.z - 0.32 * dt);
          l.x += (WIND.x + Math.sin(l.age * 2.6 + l.phase) * 0.35) * dt;
          l.y += WIND.y * 0.5 * dt;
        } else {
          l.rest += dt;
          if (l.rest > 4) this.leaves.splice(i, 1);
        }
      }

      // a flock crosses the sky now and then
      this.flockTimer -= dt;
      if (this.flockTimer <= 0) {
        this.flockTimer = 14 + Math.random() * 14;
        const c = Isometric.screenToWorld(R.canvas.width / 2, R.canvas.height / 2, R.camera, R.canvas.width, R.canvas.height);
        const a = Math.random() * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
        const n = 3 + Math.floor(Math.random() * 5);
        const birds = [];
        for (let i = 0; i < n; i++) {
          const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
          // V formation behind the leader
          birds.push({ ox: -dx * row * 0.7 + -dy * side * row * 0.6, oy: -dy * row * 0.7 + dx * side * row * 0.6, phase: Math.random() * 6 });
        }
        this.flocks.push({ x: c.x - dx * 16, y: c.y - dy * 16, vx: dx * 3.4, vy: dy * 3.4, z: 6 + Math.random() * 2, age: 0, birds });
      }
      for (let i = this.flocks.length - 1; i >= 0; i--) {
        const f = this.flocks[i];
        f.age += dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.age > 14) this.flocks.splice(i, 1);
      }
    }

    // Cloud and bird shadows sliding over the ground (under everything standing)
    drawGround(ctx, R) {
      const z = R.camera.zoom;
      ctx.save();
      for (const c of this.clouds) {
        for (const l of c.lobes) {
          const s = worldToScreen(R, c.x + l.dx, c.y + l.dy);
          const rx = l.r * TILE_PX * z;
          if (s.x < -rx || s.x > R.canvas.width + rx || s.y < -rx / 2 || s.y > R.canvas.height + rx / 2) continue;
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.scale(1, 0.5);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
          g.addColorStop(0, 'rgba(12, 22, 40, 0.16)');
          g.addColorStop(0.6, 'rgba(12, 22, 40, 0.1)');
          g.addColorStop(1, 'rgba(12, 22, 40, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, rx, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.fillStyle = 'rgba(10, 16, 24, 0.22)';
      for (const f of this.flocks) {
        for (const b of f.birds) {
          // the sun is high in the south-west, so shadows fall a little north-east of the bird
          const s = worldToScreen(R, f.x + b.ox + 1.2, f.y + b.oy - 1.6);
          if (!onScreen(R, s)) continue;
          ctx.beginPath();
          ctx.ellipse(s.x, s.y, 4 * z, 1.6 * z, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Depth-sorted creatures for the renderer's painter's-algorithm pass
    critters() {
      const out = [];
      for (const p of this.pigeons) if (p.state !== 'gone') out.push({ kind: 'pigeon', c: p, x: p.x, y: p.y });
      for (const b of this.butterflies) out.push({ kind: 'butterfly', c: b, x: b.x, y: b.y });
      for (const c of this.cats) out.push({ kind: 'cat', c, x: c.x, y: c.y });
      out.push({ kind: 'dog', c: this.dog, x: this.dog.x, y: this.dog.y });
      return out;
    }

    drawCritter(ctx, R, item) {
      const z = R.camera.zoom;
      const c = item.c;
      const ground = worldToScreen(R, c.x, c.y);
      if (!onScreen(R, ground, 60)) return;
      const t = this.time;
      const blit = (img, sx, sy, p, flip, ax, ay) => {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(Math.round(sx), Math.round(sy));
        if (flip) ctx.scale(-1, 1);
        ctx.drawImage(img, -ax * p, -ay * p, img.width * p, img.height * p);
        ctx.restore();
      };
      const shadow = (rx, ry, a) => {
        ctx.fillStyle = `rgba(0, 0, 0, ${a})`;
        ctx.beginPath();
        ctx.ellipse(ground.x, ground.y, rx * z, ry * z, 0, 0, Math.PI * 2);
        ctx.fill();
      };
      if (item.kind === 'pigeon') {
        const p = 1.3 * z;
        let pose = 'stand', hop = 0;
        if (c.state === 'fly' || c.state === 'land') pose = Math.sin(t * 28 + c.phase) > 0 ? 'flyUp' : 'flyDown';
        else if (c.act === 'peck') pose = Math.sin(t * 9 + c.phase) > 0 ? 'peck' : 'stand';
        else if (c.act === 'walk') hop = Math.abs(Math.sin(c.phase)) * 1.5 * p;
        shadow(5 / (1 + c.z), 2 / (1 + c.z), 0.28 / (1 + c.z));
        const s = worldToScreen(R, c.x, c.y, c.z);
        blit(pigeonSprite(pose), s.x, s.y - hop, p, c.flip, 7, 10);
      } else if (item.kind === 'butterfly') {
        const s = worldToScreen(R, c.x, c.y, c.z);
        const p = Math.max(1, Math.round(1.2 * z));
        const open = Math.abs(Math.sin(t * 20 + c.phase));
        const wing = open > 0.55 ? 2 : 1;
        const x = Math.round(s.x), y = Math.round(s.y);
        ctx.fillStyle = c.colour[1];
        ctx.fillRect(x - wing * p, y + p, wing * p, p);
        ctx.fillRect(x + p, y + p, wing * p, p);
        ctx.fillStyle = c.colour[0];
        ctx.fillRect(x - wing * p, y - p, wing * p, 2 * p);
        ctx.fillRect(x + p, y - p, wing * p, 2 * p);
        ctx.fillStyle = '#231c1a';
        ctx.fillRect(x, y - p, p, 3 * p);
      } else if (item.kind === 'cat') {
        const p = 1.5 * z;
        const tail = Math.sin(t * 1.4 + c.phase) > 0.2 ? 1 : 0;
        const blink = ((t + c.phase) % c.blinkAt) < 0.15;
        shadow(8, 3, 0.3);
        blit(catSprite(c.coat, tail, blink ? 1 : 0), ground.x, ground.y, p, c.flip, 6, 14);
      } else if (item.kind === 'dog') {
        const p = 1.5 * z;
        const frame = c.moving ? Math.floor(c.phase) % 4 : 4;
        const wag = Math.sin(t * (c.moving ? 10 : 16)) > 0 ? 1 : 0;
        shadow(10, 3.5, 0.3);
        blit(dogSprite(frame, wag), ground.x, ground.y, p, c.flip, 10, 14);
      }
    }

    // Above the rooftops: chimney smoke, falling leaves, birds
    drawSky(ctx, R) {
      const z = R.camera.zoom;
      const t = this.time;
      ctx.save();
      for (const p of this.smoke) {
        const s = worldToScreen(R, p.x, p.y, p.z);
        if (!onScreen(R, s, 40)) continue;
        const k = p.age / p.life;
        const a = (k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9) * 0.24;
        const r = (p.size + k * 12) * z;
        const g = Math.round(185 + p.shade * 30);
        ctx.fillStyle = `rgba(${g}, ${g - 3}, ${g - 8}, ${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      const LEAF = [['#c9862e', '#8a5a1c'], ['#d9b23c', '#9a7a20'], ['#7aa03c', '#4e6e24']];
      for (const l of this.leaves) {
        const s = worldToScreen(R, l.x, l.y, l.z);
        if (!onScreen(R, s, 20)) continue;
        const p = Math.max(1, Math.round(1.3 * z));
        const col = LEAF[Math.floor(l.hue * LEAF.length)];
        const flipping = l.z > 0 ? Math.cos(l.age * 5 + l.phase) : 1;
        ctx.globalAlpha = l.rest > 3 ? 4 - l.rest : 1;
        ctx.fillStyle = flipping > 0 ? col[0] : col[1];
        ctx.fillRect(Math.round(s.x), Math.round(s.y), (Math.abs(flipping) > 0.4 ? 2 : 1) * p, p);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1d1a22';
      for (const f of this.flocks) {
        for (const b of f.birds) {
          const s = worldToScreen(R, f.x + b.ox, f.y + b.oy, f.z);
          if (!onScreen(R, s, 20)) continue;
          const p = Math.max(1, Math.round(1.4 * z));
          const flap = Math.sin(t * 11 + b.phase);
          const x = Math.round(s.x), y = Math.round(s.y);
          const wy = flap > 0.3 ? -1 : flap < -0.3 ? 1 : 0;
          ctx.fillRect(x - p, y, 3 * p, p);                 // body
          ctx.fillRect(x - 3 * p, y + wy * p, 2 * p, p);    // wings
          ctx.fillRect(x + 2 * p, y + wy * p, 2 * p, p);
          ctx.fillRect(x - 4 * p, y + wy * 2 * p, p, p);    // wing tips
          ctx.fillRect(x + 4 * p, y + wy * 2 * p, p, p);
        }
      }
      ctx.restore();
    }
  }

  window.TownLife = {
    groundTexture, treeSprite, Ambience, hash2,
    // shared pixel-art helpers (dungeonLife.js)
    pixel: { hash2, vnoise, fbm, BAYER, rgb, pack, paintSprite }
  };
})();
