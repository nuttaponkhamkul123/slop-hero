// Slop Hero - pixel-art ground for the open-world field zones.
//
// The town paints its whole map into one texture (townLife.js); a field is
// 160 x 160 tiles, which would be a ~10000 x 5000 px image, so fields are
// painted in 256 x 256 texel chunks (1 texel = 1 screen px at zoom 1, in iso
// coordinates) around the camera, a few ms per frame, nearest chunk first,
// and kept in a small LRU cache. Until a chunk is ready the plain tiles show.
//
// Each texel blends between the materials of the four nearest tile centres
// (bilinear weights plus noise), so roads, lakes and cliffs get soft organic
// edges instead of diamond outlines. Liquids are painted too (shore, depth);
// the renderer adds a cheap animated shimmer over them each frame.
(function () {
  'use strict';

  const TW = 64, TH = 32;
  const CH = 256;                 // chunk size in texels
  const MAX_CHUNKS = 96;          // LRU cap (~24 MB of canvases)

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
  const fbm = (x, y) => vnoise(x, y) * 0.5 + vnoise(x * 2.07 + 7.3, y * 2.07 + 1.7) * 0.3 + vnoise(x * 4.3 + 3.1, y * 4.3 + 9.2) * 0.2;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const pack = ([r, g, b]) => (255 << 24) | (b << 16) | (g << 8) | r;
  const ramp = list => list.map(h => pack(rgb(h)));
  const quant = (r, v, tx, ty) => {
    const i = Math.floor(v + BAYER[((ty & 3) << 2) | (tx & 3)] - 0.5);
    return r[i < 0 ? 0 : i >= r.length ? r.length - 1 : i];
  };
  const C = (hex) => pack(rgb(hex));

  // Slowly varying noise on a coarse world grid, filled in lazily and interpolated
  function lazyField(W, H, R, fn) {
    const gw = W * R + 1, gh = H * R + 1;
    const f = new Float32Array(gw * gh).fill(NaN);
    const at = (gx, gy) => {
      const i = gy * gw + gx;
      let v = f[i];
      if (v !== v) v = f[i] = fn(gx / R - 0.5, gy / R - 0.5);
      return v;
    };
    return (wx, wy) => {
      const fx = Math.min(Math.max((wx + 0.5) * R, 0), gw - 1.001), fy = Math.min(Math.max((wy + 0.5) * R, 0), gh - 1.001);
      const x0 = fx | 0, y0 = fy | 0, u = fx - x0, v = fy - y0;
      return (at(x0, y0) * (1 - u) + at(x0 + 1, y0) * u) * (1 - v) + (at(x0, y0 + 1) * (1 - u) + at(x0 + 1, y0 + 1) * u) * v;
    };
  }

  // ---------------------------------------------------------------- palettes
  const R = {
    grass: ramp(['#2a4a1f', '#335a24', '#3e6a2a', '#497a30', '#558937', '#62973e', '#71a547', '#83b352']),
    dry: ramp(['#3b4220', '#4a5126', '#5a612d', '#6a7034', '#7b7e3b', '#8b8b44', '#9a984e', '#aaa65a']),
    forest: ramp(['#1d3a18', '#24461d', '#2c5322', '#356128', '#3f6f2e', '#4a7d34', '#578b3c']),
    swamp: ramp(['#1f2a17', '#27341c', '#2f3f21', '#384a27', '#41552d', '#4b6034', '#566b3b']),
    earth: ramp(['#2e2419', '#3a2d20', '#473727', '#55422f', '#634d37', '#715a41', '#7f6749']),
    mud: ramp(['#1d170f', '#261e14', '#30261a', '#3a2f21', '#453828', '#51432f']),
    snow: ramp(['#8ea3bd', '#a3b6cc', '#b8c8db', '#cbd8e7', '#dce6f1', '#eaf1f8', '#f6f9fd', '#ffffff']),
    slate: ramp(['#2c3646', '#364253', '#414e61', '#4d5b6f', '#5a687d', '#68778c', '#78879b']),
    sand: ramp(['#9c7a45', '#ab8850', '#ba965b', '#c8a466', '#d4b072', '#dfbc7f', '#e8c88d', '#f0d49c']),
    hardpan: ramp(['#7a5634', '#87613b', '#946c43', '#a1784b', '#ae8454', '#bb905e', '#c79c69']),
    sandstone: ramp(['#5a2b1c', '#6e3524', '#82412c', '#964d35', '#a95b3f', '#bb6a4b']),
    ash: ramp(['#2b2928', '#353231', '#3f3c3a', '#4a4644', '#55514e', '#615c59', '#6d6865']),
    cinder: ramp(['#1b1919', '#232020', '#2c2828', '#353030', '#3e3838']),
    obsidian: ramp(['#0e0c12', '#151219', '#1c1922', '#24202b', '#2d2836']),
    crystal: ramp(['#3a3352', '#433c5e', '#4d456a', '#585077', '#635b84', '#6f6791', '#7c749e']),
    lilac: ramp(['#5d5582', '#6a6290', '#786f9e', '#867dac', '#958cba', '#a49bc7', '#b4abd4']),
    violet: ramp(['#1e1734', '#261d42', '#2f2451', '#382b60', '#42336f']),
    dusk: ramp(['#1e1b1a', '#262221', '#2f2a28', '#383230', '#423b38', '#4c4441']),
    ruin: ramp(['#2f323b', '#383c46', '#424651', '#4c515d', '#575c69', '#626876']),
    ebony: ramp(['#0f0d16', '#15121d', '#1b1725', '#221d2e']),
    cloud: ramp(['#b9c0d6', '#c6cce0', '#d2d7e9', '#dee2f1', '#e9ecf7', '#f3f5fb', '#fbfcff']),
    gold: ramp(['#7a5a1c', '#8e6b24', '#a27d2d', '#b68f37', '#c9a243', '#dab552', '#e8c766']),
    pale: ramp(['#6f7686', '#7c8394', '#8a91a2', '#989fb0', '#a7aebe', '#b6bdcc']),
    moss: ramp(['#22311b', '#2a3d20', '#334a26', '#3c5630']),
    rock: ramp(['#202227', '#2a2d33', '#35383f', '#41454c', '#4d525a', '#5a5f68']),
    water: ramp(['#0b2d4f', '#0e3d64', '#13507c', '#1a6596', '#237bb0', '#3392c6', '#4eaad8']),
    oasis: ramp(['#06403f', '#08524f', '#0b6661', '#0f7a73', '#169087', '#21a69b', '#33bcae']),
    murk: ramp(['#0f1c14', '#14261a', '#1a3121', '#213c28', '#284830', '#305438']),
    lava: ramp(['#2a0703', '#4a0d04', '#7a1a06', '#b02c08', '#dc4a0c', '#f57418', '#fba632', '#fdd36a']),
    arcane: ramp(['#1a0b3d', '#25104f', '#311663', '#3f1d78', '#4f258e', '#6230a6', '#7a40c0']),
    voidp: ramp(['#08020f', '#0e0418', '#150722', '#1d0a2e', '#270e3b']),
    night: ramp(['#05071a', '#080b22', '#0b0f2b', '#0f1435']),
    ice: ramp(['#3d7fa8', '#4b91ba', '#5ba3c9', '#6eb5d6', '#84c6e2', '#9dd6ec', '#b9e5f4', '#d7f2fb'])
  };
  const FLOWERS = ['#f4f1e8', '#f6d84a', '#ec8fb0', '#b9a3ec', '#f39a4a'].map(C);
  const PEBBLE = C('#8e8a7f'), PEBBLE_DARK = C('#4f4b44');

  // ---------------------------------------------------------------- materials
  // paint(s) -> packed colour. s: { wx, wy, tx, ty, ao, edge (0..1, 1 = right at
  // a border with another material), other (that material's id), F (fields) }
  const grassy = (base, flowers) => (s) => {
    const { wx, wy, tx, ty, ao, F } = s;
    const h = hash2(tx, ty);
    const dark = s.edge > 0.6 ? (s.otherKind === 'liquid' ? 1.2 : 0.7) * (s.edge - 0.6) * 2.5 : 0;
    if (flowers && h > 0.988 && ao < 0.2 && dark === 0 && F.flower(wx, wy) > 0.62) return FLOWERS[Math.floor(hash2(tx + 3, ty) * FLOWERS.length)];
    if (h < 0.0022) return PEBBLE;
    let v = 1.3 + F.macro(wx, wy) * 3.8 + (F.fine(wx, wy) - 0.5) * 1.4 - dark - ao * 3.2;
    if (h < 0.075) v -= 1.6;                      // dark blade
    else if (hash2(tx, ty + 1) < 0.075) v += 1.1; // its lit tip, one texel up
    const dry = F.dry(wx, wy);
    const r = base === R.grass && dry > 0.64 && BAYER[((ty & 3) << 2) | (tx & 3)] < (dry - 0.64) * 6 ? R.dry : base;
    return quant(r, v * (r.length / 8), tx, ty);
  };
  const dirt = (base, pebbles = 0.05) => (s) => {
    const { wx, wy, tx, ty, ao, F } = s;
    const h = hash2(tx + 11, ty + 5);
    if (h < pebbles * 0.6) return PEBBLE;
    if (h < pebbles) return PEBBLE_DARK;
    // worn ruts: a darker band along the middle of the road
    const v = 2.6 + (F.earth(wx, wy) - 0.5) * 2.6 + (F.macro(wx, wy) - 0.5) * 1.2 - ao * 2.2 - (s.edge > 0.7 ? 0.6 : 0);
    return quant(base, v * (base.length / 7), tx, ty);
  };
  const snow = (s) => {
    const { wx, wy, tx, ty, ao, F } = s;
    if (hash2(tx, ty) < 0.004) return R.snow[7];                       // glints
    const drift = Math.sin((wx * 1.2 + wy * 0.6) * 3 + F.macro(wx, wy) * 7) * 0.5;
    return quant(R.snow, 4.4 + F.macro(wx, wy) * 2.4 + drift + (F.fine(wx, wy) - 0.5) * 0.8 - ao * 3.4 - (s.edge > 0.7 ? 1 : 0), tx, ty);
  };
  const sand = (s) => {
    const { wx, wy, tx, ty, ao, F } = s;
    // wind ripples across the dunes, bent by the large-scale noise
    const rip = Math.sin((wx * 0.7 + wy * 1.5) * 5.5 + F.macro(wx, wy) * 9);
    let v = 3.4 + F.macro(wx, wy) * 2.4 + (rip > 0.55 ? 0.9 : rip < -0.75 ? -0.7 : 0) + (hash2(tx, ty) - 0.5) * 0.5 - ao * 3;
    if (s.edge > 0.65 && s.otherKind === 'liquid') v -= 1.6;           // damp sand at the waterline
    if (hash2(tx + 5, ty) < 0.003) return PEBBLE_DARK;
    return quant(R.sand, v, tx, ty);
  };
  const ash = (s) => {
    const { wx, wy, tx, ty, ao, F } = s;
    const crack = Math.abs(vnoise(wx * 2.2 + 40, wy * 2.2) - 0.5);
    if (crack < 0.018) return hash2(tx, ty) < 0.12 ? C('#f97316') : R.cinder[0];   // cracks, a few still glowing
    let v = 2.8 + F.macro(wx, wy) * 2.6 + (F.fine(wx, wy) - 0.5) * 1.2 - ao * 3;
    if (crack < 0.04) v -= 1;
    return quant(R.ash, v, tx, ty);
  };
  const crystalGround = (s) => {
    const { wx, wy, tx, ty, ao, F } = s;
    const h = hash2(tx, ty);
    if (h < 0.005) return C('#e9d5ff');                                 // crystal glints
    if (h < 0.008) return C('#a78bfa');
    const facet = Math.abs(vnoise(wx * 3.1, wy * 3.1 + 20) - 0.5) < 0.03 ? -1.2 : 0;
    return quant(R.crystal, 2.8 + F.macro(wx, wy) * 2.8 + (F.fine(wx, wy) - 0.5) + facet - ao * 3, tx, ty);
  };
  const deadEarth = (s) => {
    const { wx, wy, tx, ty, ao, F } = s;
    const h = hash2(tx, ty);
    if (h < 0.05 && F.dry(wx, wy) > 0.45) return quant(R.dry, 1 + hash2(tx + 2, ty) * 2, tx, ty);   // dead grass tufts
    const crack = Math.abs(vnoise(wx * 1.7 + 9, wy * 1.7) - 0.5) < 0.016;
    return quant(R.dusk, 2.4 + F.macro(wx, wy) * 2.6 + (F.fine(wx, wy) - 0.5) * 1.2 - (crack ? 1.6 : 0) - ao * 3, tx, ty);
  };
  const cloud = (s) => {
    const { wx, wy, tx, ty, ao, F } = s;
    const billow = fbm(wx * 0.5 + 50, wy * 0.5);
    if (hash2(tx, ty) < 0.003) return C('#fff6cc');
    return quant(R.cloud, 2.6 + billow * 4 + (F.fine(wx, wy) - 0.5) * 0.6 - ao * 3, tx, ty);
  };
  // irregular flagstones (Voronoi cells) with grout of the given colour
  const flags = (base, grout, grassInGaps) => (s) => {
    const { wx, wy, tx, ty, ao } = s;
    const cs = 0.42, gx = wx / cs, gy = wy / cs, cx = Math.floor(gx), cy = Math.floor(gy);
    let d1 = 9, d2 = 9, id = 0, ox = 0, oy = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const px = cx + i + 0.15 + 0.7 * hash2(cx + i, cy + j), py = cy + j + 0.15 + 0.7 * hash2(cy + j + 17, cx + i + 3);
        const d = Math.hypot(gx - px, gy - py);
        if (d < d1) { d2 = d1; d1 = d; id = hash2(cx + i + 9, cy + j + 41); ox = gx - px; oy = gy - py; } else if (d < d2) d2 = d;
      }
    }
    const gap = d2 - d1, n = vnoise(wx * 7, wy * 7);
    if (gap < 0.08 + n * 0.1) return grassInGaps ? quant(grassInGaps, 1.5 + n * 2, tx, ty) : grout;
    let v = 1.8 + id * 2.6 + (hash2(tx, ty) - 0.5) * 0.9 - ao * 2.5 - (s.edge > 0.75 ? 0.8 : 0);
    if (gap < 0.2) v += ox + oy < 0 ? 1 : -1;     // lit / shaded stone edges
    if (id < 0.12) v -= 1.2;                      // the odd cracked, darker slab
    return quant(base, v * (base.length / 7), tx, ty);
  };
  const rock = (base, mossy) => (s) => {
    const { wx, wy, tx, ty, F } = s;
    const n = fbm(wx * 1.1, wy * 1.1);
    const crack = Math.abs(vnoise(wx * 2.6, wy * 2.6 + 3) - 0.5) < 0.025;
    if (mossy && n > 0.62 && hash2(tx, ty) < 0.7) return quant(R.moss, 1 + (n - 0.62) * 8, tx, ty);
    // the rim catches the light; deeper in it falls into shadow
    const rim = s.edge > 0.6 ? 1.2 : 0;
    return quant(base, 1.6 + (n - 0.5) * 3.4 + (F.fine(wx, wy) - 0.5) + rim - (crack ? 1.4 : 0), tx, ty);
  };
  // liquids: darker with depth, a pale line where they meet the shore
  const liquid = (base, opts = {}) => (s) => {
    const { wx, wy, tx, ty, F } = s;
    const depth = s.depth;                         // 0 at the shore .. 1 in open water
    if (s.edge > 0.86 && !opts.noFoam) return opts.foam || base[base.length - 1];
    let v = (base.length - 1) * (0.85 - depth * 0.7) + (F.fine(wx, wy) - 0.5) * 0.8;
    if (opts.ripple) {
      // short scattered glints stretched along the screen (iso) horizontal
      const g = vnoise((wx - wy) * 5 + 3, (wx + wy) * 11);
      if (g > 0.8) v += (g - 0.8) * 9;
      v += (vnoise(wx * 0.6, wy * 0.6) - 0.5) * 1.2;
    }
    if (opts.crust) {
      // lava: dark crust plates with bright seams between them
      const c = Math.abs(vnoise(wx * 2.4, wy * 2.4 + 7) - 0.5);
      v = c < 0.05 ? base.length - 1 - c * 20 : 1.4 + vnoise(wx * 5, wy * 5) * 1.6;
    }
    if (opts.stars && hash2(tx, ty) < 0.006) return C('#e0e7ff');
    return quant(base, v, tx, ty);
  };
  const iceSheet = (s) => {
    const { wx, wy, tx, ty, F } = s;
    if (s.edge > 0.86) return R.snow[6];
    const crack = Math.abs(vnoise(wx * 2.5, wy * 2.5 + 11) - 0.5) < 0.012;
    const sheen = vnoise((wx - wy) * 1.5, (wx + wy) * 4) > 0.78 ? 0.9 : 0;
    return quant(R.ice, 2.4 + s.depth * -0.8 + F.macro(wx, wy) * 2 + sheen + (crack ? 2.4 : 0), tx, ty);
  };

  // kind: 'ground' | 'path' | 'liquid' | 'cliff' (drives edge effects and depth)
  const M = (kind, paint) => ({ kind, paint });
  const MATS = {
    // Frostfell
    9: M('ground', snow), 10: M('liquid', iceSheet), 11: M('path', flags(R.slate, R.slate[0])), 12: M('cliff', rock(R.slate)),
    // Greenmeadow / Verdant Wildwood
    13: M('ground', grassy(R.grass, true)), 14: M('path', dirt(R.earth)), 15: M('liquid', liquid(R.water, { ripple: true })), 16: M('cliff', rock(R.rock, true)),
    // Scorched Dunes
    17: M('ground', sand), 18: M('path', dirt(R.hardpan, 0.03)), 19: M('liquid', liquid(R.oasis, { ripple: true })), 20: M('cliff', rock(R.sandstone)),
    // Mirefen Swamp
    21: M('ground', grassy(R.swamp, false)), 22: M('path', dirt(R.mud, 0.02)), 23: M('liquid', liquid(R.murk, { foam: C('#4a6b3a') })), 24: M('cliff', rock(R.rock, true)),
    // Ashen Wastes
    25: M('ground', ash), 26: M('path', dirt(R.cinder, 0.04)), 27: M('liquid', liquid(R.lava, { crust: true, noFoam: true })), 28: M('cliff', rock(R.obsidian)),
    // Crystal Highlands
    29: M('ground', crystalGround), 30: M('path', flags(R.lilac, C('#3a3352'))), 31: M('liquid', liquid(R.arcane, { foam: C('#c4b5fd') })), 32: M('cliff', rock(R.violet)),
    // Shadowfell Ruins
    33: M('ground', deadEarth), 34: M('path', flags(R.ruin, C('#16161c'), R.moss)), 35: M('liquid', liquid(R.voidp, { foam: C('#7c3aed') })), 36: M('cliff', rock(R.ebony)),
    // Celestial Reach
    37: M('ground', cloud), 38: M('path', flags(R.gold, C('#6b4f17'))), 39: M('liquid', liquid(R.night, { stars: true, foam: C('#c7d2fe') })), 40: M('cliff', rock(R.pale))
  };

  // ---------------------------------------------------------------- per-map state
  const OCCLUDERS = {
    oak_tree: [0.2, 0.8, 0.5], pine_tree: [0.15, 0.65, 0.45], snow_pine: [0.15, 0.6, 0.45], dead_tree: [0.12, 0.5, 0.35],
    boulder: [0.45, 0.45, 0.55], stone_pillar: [0.3, 0.4, 0.45], frost_monolith: [0.35, 0.45, 0.5], ice_crystal: [0.3, 0.4, 0.4],
    cactus: [0.2, 0.35, 0.35], giant_mushroom: [0.3, 0.6, 0.45], bone_pile: [0.3, 0.3, 0.3], sarcophagus: [0.6, 0.4, 0.45],
    gold_hoard: [0.45, 0.4, 0.4], field_portal: [0.6, 0.6, 0.4], brazier: [0.25, 0.3, 0.3]
  };
  function buildOcclusion(map) {
    const RG = 4, gw = map.width * RG + 1, gh = map.height * RG + 1;
    const ao = new Float32Array(gw * gh);
    for (const o of map.obstacles || []) {
      const s = OCCLUDERS[o.type];
      if (!s) continue;
      const [r, rad, str] = s, ext = r + rad;
      const gx0 = Math.max(0, Math.floor((o.x - ext + 0.5) * RG)), gx1 = Math.min(gw - 1, Math.ceil((o.x + ext + 0.5) * RG));
      const gy0 = Math.max(0, Math.floor((o.y - ext + 0.5) * RG)), gy1 = Math.min(gh - 1, Math.ceil((o.y + ext + 0.5) * RG));
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const d = Math.max(0, Math.hypot(gx / RG - 0.5 - o.x, gy / RG - 0.5 - o.y) - r);
          const k = Math.max(0, 1 - d / rad), a = str * k * k, i = gy * gw + gx;
          if (a > ao[i]) ao[i] = a;
        }
      }
    }
    return (wx, wy) => {
      const fx = (wx + 0.5) * RG, fy = (wy + 0.5) * RG, x0 = Math.floor(fx), y0 = Math.floor(fy);
      if (x0 < 0 || y0 < 0 || x0 >= gw - 1 || y0 >= gh - 1) return 0;
      const u = fx - x0, v = fy - y0, i = y0 * gw + x0;
      return (ao[i] * (1 - u) + ao[i + 1] * u) * (1 - v) + (ao[i + gw] * (1 - u) + ao[i + gw + 1] * u) * v;
    };
  }

  const states = new WeakMap();
  function stateFor(map) {
    let st = states.get(map);
    const version = map._tilesVersion || 0;
    if (st && st.version === version) return st;
    const W = map.width, H = map.height;
    const tileAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : map.tiles[y][x]);
    const isLiquid = (t) => !!(MATS[t] && MATS[t].kind === 'liquid');
    st = {
      version, W, H, tileAt,
      minX: -(H - 1) * (TW / 2) - TW / 2, minY: -TH / 2,
      chunks: new Map(), tick: 0, sig: 0,
      F: {
        macro: lazyField(W, H, 4, (x, y) => fbm(x * 0.16, y * 0.16)),
        fine: lazyField(W, H, 8, (x, y) => vnoise(x * 2.2, y * 2.2)),
        dry: lazyField(W, H, 2, (x, y) => vnoise(x * 0.09 + 31.7, y * 0.09 + 11.3)),
        flower: lazyField(W, H, 2, (x, y) => vnoise(x * 0.35 + 70, y * 0.35 + 13)),
        earth: lazyField(W, H, 8, (x, y) => fbm(x * 1.3, y * 1.3)),
        // share of liquid in the 5 x 5 tiles around a point: 1 in open water
        depth: lazyField(W, H, 1, (x, y) => {
          let n = 0;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (isLiquid(tileAt(Math.round(x) + dx, Math.round(y) + dy))) n++;
          return n / 25;
        })
      },
      ao: null
    };
    states.set(map, st);
    return st;
  }

  // ---------------------------------------------------------------- chunk painter
  function* paintChunk(st, i, j) {
    if (!st.ao) { st.ao = buildOcclusion(st.map); yield; }
    const { W, H, tileAt, F } = st;
    const ox = st.minX + i * CH, oy = st.minY + j * CH;
    const canvas = document.createElement('canvas');
    canvas.width = CH; canvas.height = CH;
    const cctx = canvas.getContext('2d');
    const img = cctx.createImageData(CH, CH);
    const px = new Uint32Array(img.data.buffer);
    const s = { wx: 0, wy: 0, tx: 0, ty: 0, ao: 0, edge: 0, other: -1, otherKind: null, depth: 0, F };
    const ids = [0, 0, 0, 0], ws = [0, 0, 0, 0];
    let any = false;
    for (let y = 0; y < CH; y++) {
      if ((y & 15) === 15) yield;
      const Y = oy + y + 0.5;
      for (let x = 0; x < CH; x++) {
        const X = ox + x + 0.5;
        const wx = (X / (TW / 2) + Y / (TH / 2)) / 2, wy = (Y / (TH / 2) - X / (TW / 2)) / 2;
        const ix = Math.round(wx), iy = Math.round(wy);
        if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
        // bilinear weights of the four surrounding tile centres, per material
        const x0 = Math.floor(wx), y0 = Math.floor(wy), u = wx - x0, v = wy - y0;
        ids[0] = tileAt(x0, y0); ws[0] = (1 - u) * (1 - v);
        ids[1] = tileAt(x0 + 1, y0); ws[1] = u * (1 - v);
        ids[2] = tileAt(x0, y0 + 1); ws[2] = (1 - u) * v;
        ids[3] = tileAt(x0 + 1, y0 + 1); ws[3] = u * v;
        let best = -1, bw = -1, second = -1, sw = -1;
        for (let k = 0; k < 4; k++) {
          const t = ids[k];
          if (t < 0 || t === best || t === second) continue;
          let w = 0;
          for (let m = 0; m < 4; m++) if (ids[m] === t) w += ws[m];
          if (w <= 0) continue;
          // wobble the border so it never follows the tile grid
          w += (vnoise(wx * 1.2 + t * 7.7, wy * 1.2 - t * 3.3) - 0.5) * 0.5 + (vnoise(wx * 4.3 - t, wy * 4.3 + t) - 0.5) * 0.22;
          if (w > bw) { second = best; sw = bw; best = t; bw = w; } else if (w > sw) { second = t; sw = w; }
        }
        const mat = MATS[best];
        if (!mat) continue;          // a tile this painter does not know: the plain tile shows through
        s.wx = wx; s.wy = wy; s.tx = x + ox; s.ty = y + oy;
        s.ao = st.ao(wx, wy);
        s.edge = second >= 0 ? Math.max(0, 1 - (bw - sw) / 0.35) : 0;
        s.other = second;
        s.otherKind = second >= 0 && MATS[second] ? MATS[second].kind : null;
        s.depth = mat.kind === 'liquid' ? F.depth(wx, wy) : 0;
        px[y * CH + x] = mat.paint(s);
        any = true;
      }
    }
    if (!any) return null;
    cctx.putImageData(img, 0, 0);
    return canvas;
  }

  // Paint pending chunks over the iso rectangle [x0, x1] x [y0, y1] for up to
  // budgetMs, nearest the rectangle's centre first. Returns a number that
  // changes whenever a chunk inside the rectangle has just been finished.
  function pump(map, x0, y0, x1, y1, budgetMs) {
    const st = stateFor(map);
    st.map = map;
    st.tick++;
    const i0 = Math.floor((x0 - st.minX) / CH), i1 = Math.floor((x1 - st.minX) / CH);
    const j0 = Math.floor((y0 - st.minY) / CH), j1 = Math.floor((y1 - st.minY) / CH);
    const maxI = Math.ceil((st.W + st.H) * (TW / 2) / CH), maxJ = Math.ceil((st.W + st.H) * (TH / 2) / CH);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const todo = [];
    for (let j = Math.max(0, j0); j <= Math.min(maxJ, j1); j++) {
      for (let i = Math.max(0, i0); i <= Math.min(maxI, i1); i++) {
        const key = j * 1024 + i;
        let c = st.chunks.get(key);
        if (!c) { c = { i, j, canvas: null, done: false, job: null }; st.chunks.set(key, c); }
        c.used = st.tick;
        if (!c.done) {
          const dx = st.minX + (i + 0.5) * CH - cx, dy = st.minY + (j + 0.5) * CH - cy;
          todo.push({ c, d: dx * dx + dy * dy * 4 });
        }
      }
    }
    st.pending = todo.length;
    if (todo.length) {
      todo.sort((a, b) => a.d - b.d);
      const t0 = performance.now();
      for (const { c } of todo) {
        if (!c.job) c.job = paintChunk(st, c.i, c.j);
        while (performance.now() - t0 < budgetMs) {
          const r = c.job.next();
          if (r.done) { c.canvas = r.value; c.done = true; c.job = null; st.sig++; break; }
        }
        if (performance.now() - t0 >= budgetMs) break;
      }
    }
    // forget the least recently used chunks
    if (st.chunks.size > MAX_CHUNKS) {
      const old = [...st.chunks.entries()].sort((a, b) => a[1].used - b[1].used);
      for (let k = 0; k < old.length - MAX_CHUNKS; k++) if (old[k][1].used !== st.tick) st.chunks.delete(old[k][0]);
    }
    return st.sig;
  }

  // Finished chunks over an iso rectangle: [{ canvas, x, y }] (iso px, top-left)
  function readyChunks(map, x0, y0, x1, y1) {
    const st = states.get(map);
    if (!st) return [];
    const out = [];
    for (const c of st.chunks.values()) {
      if (!c.done || !c.canvas) continue;
      const x = st.minX + c.i * CH, y = st.minY + c.j * CH;
      if (x > x1 || x + CH < x0 || y > y1 || y + CH < y0) continue;
      out.push({ canvas: c.canvas, x, y });
    }
    return out;
  }

  // Is the ground under tile (x, y) painted yet? (the renderer then draws only a
  // shimmer over liquids instead of repainting the whole tile)
  function paintedAt(map, x, y) {
    const st = states.get(map);
    if (!st) return false;
    const X = (x - y) * (TW / 2), Y = (x + y) * (TH / 2);
    const c = st.chunks.get(Math.floor((Y - st.minY) / CH) * 1024 + Math.floor((X - st.minX) / CH));
    return !!(c && c.done);
  }

  const handles = (map) => !!(map && map.tiles && map.zoneId);
  const liquidKind = (t) => (MATS[t] && MATS[t].kind === 'liquid' ? t : 0);

  // chunks still waiting in the area last pumped
  const pending = (map) => { const st = states.get(map); return st ? st.pending || 0 : 0; };

  window.FieldGround = { handles, pump, pending, readyChunks, paintedAt, liquidKind, CHUNK: CH };
})();
