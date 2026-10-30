// Dungeon look for Slop Hero: pixel-art flagstone floors with clutter, brick
// walls, and an atmosphere pass (darkness with pools of torch / hero light,
// low fog and theme particles). Purely cosmetic; one palette per floor theme.
//
// Floor tiles and walls are small sprites at 1 texel per screen pixel at
// zoom 1, painted once per theme and variant, then scaled with smoothing off.
(function () {
  'use strict';

  if (!window.TownLife) return;
  const { hash2, vnoise, BAYER, rgb, paintSprite } = window.TownLife.pixel;
  const TILE_PX = 32 * Math.SQRT2; // one tile edge in iso screen px at zoom 1

  const packA = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  const mixHex = (hex, t) => rgb(hex).map(v => Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t)));
  const rampOf = (hex, steps) => steps.map(t => packA(...mixHex(hex, t)));
  const STONE_STEPS = [-0.62, -0.48, -0.34, -0.2, -0.06, 0.08, 0.22, 0.36];
  function quant(r, v, x, y) {
    const i = Math.floor(v + BAYER[((y & 3) << 2) | (x & 3)] - 0.5);
    return r[i < 0 ? 0 : i >= r.length ? r.length - 1 : i];
  }

  // stone: base masonry colour; accent: what grows / glows on it; light: torch
  // and hero light colour; dark: the colour of the gloom and how deep it is
  const THEMES = {
    dungeon_crypt: { stone: '#535c6e', mortar: '#13161d', accent: 'moss', accentCol: '#3f5c3c', light: [150, 205, 255], dark: [4, 7, 14], darkness: 0.76, mote: 'dust', decals: ['bones', 'skull', 'rubble', 'candle', 'bones'] },
    dungeon_sunken: { stone: '#466660', mortar: '#0c1816', accent: 'moss', accentCol: '#2f7048', light: [130, 235, 215], dark: [2, 12, 12], darkness: 0.72, mote: 'drip', decals: ['puddle', 'puddle', 'rubble', 'bones', 'weed'] },
    dungeon_obsidian: { stone: '#4f393a', mortar: '#100808', accent: 'vein', accentCol: '#ff7a2e', light: [255, 155, 85], dark: [12, 4, 4], darkness: 0.72, mote: 'ember', decals: ['rubble', 'shard', 'rubble', 'bones'] },
    dungeon_glacial: { stone: '#647b96', mortar: '#18222f', accent: 'frost', accentCol: '#d9f2ff', light: [175, 222, 255], dark: [4, 10, 20], darkness: 0.62, mote: 'snow', decals: ['frostpatch', 'rubble', 'shard', 'bones'] },
    dungeon_toxic: { stone: '#4b5a3e', mortar: '#0e1407', accent: 'moss', accentCol: '#79cf3b', light: [175, 255, 125], dark: [4, 12, 4], darkness: 0.72, mote: 'spore', decals: ['slime', 'mushroom', 'bones', 'slime', 'rubble'] },
    dungeon_infernal: { stone: '#5e3633', mortar: '#130505', accent: 'vein', accentCol: '#ff5a1e', light: [255, 125, 65], dark: [16, 3, 2], darkness: 0.66, mote: 'ember', decals: ['scorch', 'bones', 'rubble', 'skull'] },
    dungeon_celestial: { stone: '#54517f', mortar: '#110f28', accent: 'gold', accentCol: '#f4d27a', light: [212, 202, 255], dark: [6, 5, 22], darkness: 0.62, mote: 'star', decals: ['starglint', 'rubble', 'rune', 'starglint'] },
    dungeon_dread: { stone: '#4b3e61', mortar: '#0e0917', accent: 'rune', accentCol: '#b072ff', light: [192, 135, 255], dark: [8, 3, 16], darkness: 0.78, mote: 'wisp', decals: ['skull', 'bones', 'candle', 'rune', 'blood'] },
    dungeon_dragon: { stone: '#6e5638', mortar: '#191005', accent: 'gold', accentCol: '#e8b84a', light: [255, 192, 115], dark: [14, 8, 2], darkness: 0.66, mote: 'ember', decals: ['coins', 'coins', 'bones', 'claw', 'skull'] },
    dungeon_oblivion: { stone: '#523859', mortar: '#110519', accent: 'void', accentCol: '#e070ff', light: [232, 125, 255], dark: [12, 2, 18], darkness: 0.76, mote: 'wisp', decals: ['rune', 'shard', 'rubble', 'skull'] }
  };
  const has = id => !!THEMES[id];
  const themeOf = id => THEMES[id] || THEMES.dungeon_crypt;
  const prepared = new Map();
  function prep(id) {
    if (prepared.has(id)) return prepared.get(id);
    const t = themeOf(id);
    const p = {
      t,
      stone: rampOf(t.stone, STONE_STEPS),
      mortar: rampOf(t.mortar, [0, 0.08, 0.16]),
      accent: rampOf(t.accentCol, [-0.45, -0.22, 0, 0.25]),
      seed: [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 9973
    };
    prepared.set(id, p);
    return p;
  }

  // raster a W x H sprite from a per-texel colour function (0 = transparent)
  function raster(W, H, fn, outlineHex) {
    const px = new Uint32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = fn(x, y); if (c) px[y * W + x] = c; }
    if (outlineHex) {
      const o = packA(...rgb(outlineHex));
      const src = px.slice();
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (src[y * W + x]) continue;
          if ((x > 0 && src[y * W + x - 1]) || (x < W - 1 && src[y * W + x + 1]) || (y > 0 && src[(y - 1) * W + x]) || (y < H - 1 && src[(y + 1) * W + x])) px[y * W + x] = o;
        }
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const c = canvas.getContext('2d');
    const img = c.createImageData(W, H);
    new Uint32Array(img.data.buffer).set(px);
    c.putImageData(img, 0, 0);
    return canvas;
  }
  const silhouette = (src) => {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#000';
    g.fillRect(0, 0, c.width, c.height);
    return c;
  };

  // ---------------------------------------------------------------- floor
  // Slab layouts inside one tile, in tile-local units (u along world x, w along world y)
  const LAYOUTS = [
    [[0, 0, 0.5, 0.5], [0.5, 0, 1, 0.5], [0, 0.5, 0.5, 1], [0.5, 0.5, 1, 1]],
    [[0, 0, 1, 1]],
    [[0, 0, 0.5, 1], [0.5, 0, 1, 1]],
    [[0, 0, 1, 0.5], [0, 0.5, 0.5, 1], [0.5, 0.5, 1, 1]],
    [[0, 0, 0.5, 0.5], [0.5, 0, 1, 0.5], [0, 0.5, 1, 1]]
  ];
  const FLOOR_VARIANTS = 10;
  const cache = new Map();
  const cached = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

  const segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(px - ax - dx * k, py - ay - dy * k);
  };

  function floorTile(themeId, variant, corridor) {
    return cached(`floor|${themeId}|${variant}|${corridor ? 1 : 0}`, () => {
      const P = prep(themeId), T = P.t, s = P.seed + variant * 17;
      const slabs = LAYOUTS[variant % LAYOUTS.length];
      // a crack wandering across the first slab on some variants
      const crack = variant === 2 || variant === 7 || variant === 9 ? (() => {
        const [x0, y0, x1, y1] = slabs[0];
        const pts = [];
        for (let i = 0; i <= 3; i++) pts.push([x0 + (x1 - x0) * (0.15 + 0.7 * hash2(s + i, 3)), y0 + (y1 - y0) * (i / 3)]);
        return pts;
      })() : null;
      const glowCracks = T.accent === 'vein' || T.accent === 'void';
      return raster(64, 32, (px, py) => {
        const X = px + 0.5 - 32, Y = py + 0.5 - 16;
        if (Math.abs(X) / 32 + Math.abs(Y) / 16 >= 1) return 0;
        const u = (X / 32 + Y / 16) / 2 + 0.5, w = (Y / 16 - X / 32) / 2 + 0.5;
        let slab = slabs[0], si = 0;
        for (let i = 0; i < slabs.length; i++) {
          const b = slabs[i];
          if (u >= b[0] && u < b[2] && w >= b[1] && w < b[3]) { slab = b; si = i; break; }
        }
        const dl = u - slab[0], dr = slab[2] - u, dt = w - slab[1], db = slab[3] - w;
        const edge = Math.min(dl, dr, dt, db);
        if (edge < 0.03) {
          if (glowCracks && hash2(px + s, py) < 0.12) return P.accent[1];
          if (T.accent === 'moss' && vnoise(u * 6 + variant * 3.1, w * 6) > 0.55) return quant(P.accent, 0.6 + vnoise(u * 9, w * 9), px, py);
          return quant(P.mortar, 1 + (hash2(px, py + s) - 0.5) * 1.5, px, py);
        }
        let v = 2.6 + hash2(si + s, variant + 11) * 1.8 + (vnoise(u * 7 + variant * 13, w * 7) - 0.5) * 1.3 + (hash2(px + s, py) - 0.5) * 0.8;
        if (corridor) v -= 0.5;
        if (dl < 0.07 || dt < 0.07) v += 1;         // lit edges face the top of the screen
        else if (dr < 0.06 || db < 0.06) v -= 0.9;
        if (crack && si === 0) {
          let d = 9;
          for (let i = 0; i < crack.length - 1; i++) d = Math.min(d, segDist(u, w, crack[i][0], crack[i][1], crack[i + 1][0], crack[i + 1][1]));
          if (d < 0.014) return glowCracks ? quant(P.accent, 2.4, px, py) : quant(P.stone, 0.2, px, py);
          if (d < 0.03) v -= 0.8;
        }
        if (T.accent === 'moss' && edge < 0.1 && vnoise(u * 6 + variant * 3.1, w * 6) > 0.62) return quant(P.accent, 1 + vnoise(u * 11, w * 11) * 1.6, px, py);
        if (T.accent === 'frost' && vnoise(u * 3 + variant, w * 3) > 0.7) return quant(P.accent, 0.8 + (hash2(px, py) - 0.5) * 1.2, px, py);
        // inlays only on whole-tile slabs (layout 1), so mortar never cuts them
        if (T.accent === 'gold' && slabs.length === 1 && Math.abs(Math.abs(u - 0.5) + Math.abs(w - 0.5) - 0.3) < 0.022) return quant(P.accent, 2 + (u + w < 1 ? 1 : 0), px, py);
        if ((T.accent === 'rune' || T.accent === 'void') && slabs.length === 1) {
          const r = Math.hypot(u - 0.5, w - 0.5);
          if (Math.abs(r - 0.28) < 0.02 || (Math.abs(r - 0.2) < 0.015 && hash2(Math.floor(Math.atan2(w - 0.5, u - 0.5) * 3), 1) < 0.6)) return quant(P.accent, 2.6, px, py);
        }
        return quant(P.stone, v, px, py);
      });
    });
  }

  // Contact shadow along one tile edge where a wall or the void stands
  // side: 0 = toward -x, 1 = +x, 2 = -y, 3 = +y
  function edgeShadow(side) {
    return cached(`ao|${side}`, () => raster(64, 32, (px, py) => {
      const X = px + 0.5 - 32, Y = py + 0.5 - 16;
      if (Math.abs(X) / 32 + Math.abs(Y) / 16 >= 1) return 0;
      const u = (X / 32 + Y / 16) / 2 + 0.5, w = (Y / 16 - X / 32) / 2 + 0.5;
      const d = [u, 1 - u, w, 1 - w][side];
      if (d > 0.4) return 0;
      const k = 1 - d / 0.4;
      // dithered alpha steps keep the pixel look
      const a = Math.round(k * k * 4 + BAYER[((py & 3) << 2) | (px & 3)] - 0.5) * 42;
      return a > 0 ? packA(0, 0, 0, Math.min(170, a)) : 0;
    }));
  }

  // ---------------------------------------------------------------- floor clutter
  const LIGHT_DECALS = new Set(['candle', 'mushroom']);
  function decalFor(themeId, x, y) {
    const T = themeOf(themeId);
    if (hash2(x * 7 + 1, y * 13 + 5) > 0.13) return null;
    const kind = T.decals[Math.floor(hash2(x, y + 99) * T.decals.length)];
    return { kind, ox: (hash2(x + 3, y) - 0.5) * 0.36, oy: (hash2(x, y + 3) - 0.5) * 0.36, flip: hash2(x + 5, y + 8) < 0.5 };
  }

  function decalSprite(kind, themeId) {
    return cached(`decal|${kind}|${themeId}`, () => {
      const P = prep(themeId), T = P.t;
      const acc = T.accentCol;
      const blob = (W, H, colFn) => raster(W, H, (x, y) => {
        const nx = (x + 0.5 - W / 2) / (W / 2), ny = (y + 0.5 - H / 2) / (H / 2);
        const r = nx * nx + ny * ny + (vnoise(x * 0.7 + W, y * 0.9) - 0.5) * 0.5;
        return r < 1 ? colFn(x, y, r) : 0;
      });
      switch (kind) {
        case 'bones': return paintSprite(13, 7, { bone: '#d8cfb8' }, '#2a2520', ({ set }) => {
          for (let i = 0; i <= 10; i++) set(1 + i, 2 + Math.round(i * 0.3), 'bone');
          for (let i = 0; i <= 8; i++) set(2 + i, 5 - Math.round(i * 0.45), 'bone');
          set(0, 2, 'bone'); set(1, 1, 'bone'); set(12, 5, 'bone'); set(11, 6, 'bone');
          set(1, 5, 'bone'); set(10, 0, 'bone');
        });
        case 'skull': return paintSprite(8, 7, { bone: '#e1d9c4', jaw: '#bfb59c' }, '#241f1b', ({ fill, clear, dot }) => {
          fill(1, 0, 6, 4, 'bone'); clear(1, 0); clear(6, 0);
          fill(2, 5, 5, 6, 'jaw');
          dot(2, 2, '#1a1512'); dot(5, 2, '#1a1512'); dot(3, 4, '#3a322a'); dot(4, 4, '#3a322a');
          dot(3, 6, '#1a1512');
        });
        case 'candle': return paintSprite(9, 11, { wax: '#e9dfc4', wick: '#3a2e22' }, '#2a2218', ({ fill, dot }) => {
          fill(1, 5, 2, 10, 'wax'); fill(4, 3, 5, 10, 'wax'); fill(7, 7, 8, 10, 'wax');
          for (const [x, y] of [[1, 3], [4, 1], [7, 5]]) { dot(x, y, '#ffe9a0'); dot(x, y + 1, '#ffb347'); }
        });
        case 'mushroom': return paintSprite(10, 8, { cap: acc, stem: '#d9e3c8' }, '#16200e', ({ fill, dot }) => {
          fill(1, 1, 4, 2, 'cap'); fill(2, 3, 3, 6, 'stem');
          fill(6, 3, 8, 4, 'cap'); fill(7, 5, 7, 7, 'stem');
          dot(2, 1, '#ffffff'); dot(7, 3, '#ffffff');
        });
        case 'shard': return paintSprite(6, 9, { gem: acc }, '#120a18', ({ set }) => {
          for (let y = 0; y < 8; y++) { const half = Math.min(2, Math.floor(y / 2)); for (let x = 2 - half; x <= 2 + half; x++) set(x, y, 'gem'); }
        });
        case 'rubble': return raster(12, 6, (x, y) => {
          for (const [cx, cy, r] of [[2.5, 3.5, 1.6], [6, 2.5, 2], [9.5, 4, 1.4], [5, 4.6, 1]]) {
            const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.4);
            if (d < r) return quant(P.stone, 4 + (cy - y) * 0.9 + (hash2(x, y) - 0.5), x, y);
          }
          return 0;
        }, T.mortar);
        case 'coins': return raster(14, 6, (x, y) => {
          const h = hash2(x * 3 + 1, y * 5 + 2);
          if (h < 0.22) return packA(...mixHex('#e8b84a', h < 0.07 ? 0.5 : 0));
          if (h < 0.3) return packA(...mixHex('#e8b84a', -0.45));
          return 0;
        });
        case 'puddle': case 'slime': {
          const base = kind === 'slime' ? acc : '#1d4252';
          return blob(18, 7, (x, y, r) => packA(...mixHex(base, r > 0.7 ? -0.35 : (hash2(x, y) < 0.06 ? 0.55 : -0.1)), 215));
        }
        case 'scorch': return blob(16, 7, (x, y, r) => packA(10, 6, 5, Math.round(170 * (1 - r * 0.7))));
        case 'frostpatch': return blob(16, 7, (x, y, r) => packA(...mixHex('#d9f2ff', hash2(x, y) < 0.15 ? 0.4 : -0.1), Math.round(200 * (1 - r * 0.6))));
        case 'blood': return blob(12, 6, (x, y, r) => (hash2(x, y) < 0.8 ? packA(...mixHex('#6e1414', r > 0.6 ? -0.4 : 0), 220) : 0));
        case 'claw': return raster(12, 7, (x, y) => ([0, 3, 6].some(o => Math.abs(x - (o + y * 0.9)) < 0.6) ? packA(14, 9, 6, 200) : 0));
        case 'weed': return paintSprite(9, 6, { leaf: '#3f7a3a' }, '#0e1a0c', ({ set }) => {
          for (const [x, h] of [[1, 3], [3, 5], [5, 4], [7, 2]]) for (let y = 0; y < h; y++) set(x + (y > 2 ? 1 : 0), 5 - y, 'leaf');
        });
        case 'starglint': return raster(7, 7, (x, y) => ((x === 3 && Math.abs(y - 3) < 3) || (y === 3 && Math.abs(x - 3) < 3) ? packA(...mixHex(acc, x === 3 && y === 3 ? 0.6 : 0)) : 0));
        case 'rune': return raster(14, 7, (x, y) => {
          const r = Math.hypot((x + 0.5 - 7) / 7, (y + 0.5 - 3.5) / 3.5);
          return Math.abs(r - 0.85) < 0.13 || (r < 0.5 && hash2(x, y + 2) < 0.35) ? packA(...mixHex(acc, 0.15)) : 0;
        });
        default: return raster(1, 1, () => 0);
      }
    });
  }

  const OPEN = new Set([4, 1, 6, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51]);

  // Paint one floor tile's top (and its contact shadows and clutter)
  function drawFloor(ctx, themeId, map, x, y, tileType, screen, z) {
    const variant = Math.floor(hash2(x * 5 + 2, y * 11 + 7) * FLOOR_VARIANTS);
    const left = screen.x - 32 * z, top = screen.y - 16 * z;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(floorTile(themeId, variant, tileType === 1), left, top, 64 * z, 32 * z);
    const tileAt = (tx, ty) => (map.tiles[ty] && map.tiles[ty][tx] !== undefined ? map.tiles[ty][tx] : 8);
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy], side) => {
      if (!OPEN.has(tileAt(x + dx, y + dy))) ctx.drawImage(edgeShadow(side), left, top, 64 * z, 32 * z);
    });
    const d = tileType === 4 ? decalFor(themeId, x, y) : null;
    if (d) {
      const img = decalSprite(d.kind, themeId);
      const cx = screen.x + (d.ox - d.oy) * 32 * z, cy = screen.y + (d.ox + d.oy) * 16 * z;
      ctx.translate(Math.round(cx), Math.round(cy));
      if (d.flip) ctx.scale(-1, 1);
      ctx.drawImage(img, Math.round(-img.width / 2) * z, Math.round(-img.height * 0.7) * z, img.width * z, img.height * z);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- walls
  // Brick block for one wall tile: tall (back walls, 40px) or low (12px).
  // Anchor = centre of the base diamond at (32, 16 + wallH).
  const WALL_VARIANTS = 4;
  function wallSprite(themeId, back, variant) {
    return cached(`wall|${themeId}|${back ? 1 : 0}|${variant}`, () => {
      const P = prep(themeId), T = P.t, s = P.seed + variant * 29;
      const wallH = back ? 40 : 12, W = 64, H = 32 + wallH;
      const rowH = 6, brickW = 11;
      const brick = (x, v, face) => {
        const row = Math.floor(v / rowH), fv = v - row * rowH;
        const bu = x + (row & 1) * 5 + variant * 3 + (face ? 2 : 0);
        const col = Math.floor(bu / brickW), fu = bu - col * brickW;
        if (fv < 1 || fu < 1) return null;
        let val = (face ? 2 : 3.4) + hash2(col + s, row * 3 + face * 57) * 1.5 + (hash2(Math.floor(x), Math.floor(v) + s) - 0.5) * 0.7;
        if (fv < 2) val += 0.8;
        else if (fv > rowH - 1.5) val -= 0.6;
        return val;
      };
      const canvas = raster(W, H, (px, py) => {
        const x = px + 0.5, y = py + 0.5;
        // top cap
        if (Math.abs(x - 32) / 32 + Math.abs(y - 16) / 16 < 1) {
          const nearFront = Math.abs(x - 32) / 32 + (y - 16) / 16 > 0.82;
          let v = 4.2 + (hash2(px + s, py) - 0.5) * 0.9 + (nearFront ? 1.3 : 0) - (y < 10 ? 0.6 : 0);
          if (T.accent === 'frost' && nearFront) return quant(P.accent, 2.6, px, py);
          return quant(P.stone, v, px, py);
        }
        const leftFace = x < 32;
        const yTop = leftFace ? 16 + x / 2 : 32 - (x - 32) / 2;
        const v = y - yTop;
        if (v < 0 || v >= wallH) return 0;
        const face = leftFace ? 0 : 1;
        let val = brick(x, v, face);
        if (val === null) return quant(P.mortar, 1 + (hash2(px, py + s) - 0.5) * 2, px, py);
        // grime toward the floor, a lit corner edge
        if (v > wallH - 4) val -= 1;
        if (Math.abs(x - 32) < 1) val += 1.2;
        if (back) {
          if (variant === 1 && leftFace && Math.abs((x - 6) - (v - 6) * 0.7) < 0.7 && v > 6 && v < 30) return quant(P.stone, 0.2, px, py);
          if (variant === 2 && v > wallH - 14 + Math.floor(hash2(Math.floor(x / 3), s) * 10)) {
            if (T.accent === 'moss') return quant(P.accent, 1 + hash2(px, py) * 1.6, px, py);
            if (T.accent === 'vein' || T.accent === 'void') { if (hash2(Math.floor(x / 2), Math.floor(v / 3) + s) < 0.12) return quant(P.accent, 2.4, px, py); }
          }
          if (variant === 3 && leftFace && x < 18 && v < 14) {
            // cobweb in the upper corner of the wall face
            const ang = Math.atan2(v, x - 1), r = Math.hypot(x - 1, v);
            const spoke = Math.abs(((ang / (Math.PI / 2)) * 4) % 1 - 0.5) > 0.42;
            const ring = Math.abs((r % 4) - 2) < 0.45;
            if (r < 15 && (spoke || ring) && hash2(px, py) < 0.85) return packA(205, 205, 210, 170);
          }
        }
        return quant(P.stone, val - (face ? 0 : 0) - (back ? 0 : 0.3), px, py);
      }, T.mortar);
      return { canvas, shadow: silhouette(canvas), wallH };
    });
  }

  function drawWall(ctx, themeId, x, y, back, screen, z, darkness) {
    const variant = back ? Math.floor(hash2(x * 3 + 4, y * 7 + 1) * WALL_VARIANTS) : 0;
    const spr = wallSprite(themeId, back, variant);
    const left = Math.round(screen.x - 32 * z), top = Math.round(screen.y - (16 + spr.wallH) * z);
    const w = spr.canvas.width * z, h = spr.canvas.height * z;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr.canvas, left, top, w, h);
    if (darkness > 0.01) {
      ctx.globalAlpha = darkness;
      ctx.drawImage(spr.shadow, left, top, w, h);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- atmosphere
  const GLOW_TILES = { 43: [1.8, 0.75, [255, 120, 50]], 44: [1.3, 0.45, [255, 140, 60]], 45: [1.3, 0.4, [150, 255, 90]], 49: [1.6, 0.6, [230, 90, 255]], 47: [1.3, 0.35, [200, 200, 255]] };
  const MOTES = {
    dust: { col: [205, 205, 195], n: 45 },
    drip: { col: [150, 232, 220], n: 40 },
    ember: { col: [255, 150, 60], n: 50 },
    snow: { col: [232, 242, 255], n: 70 },
    spore: { col: [175, 255, 120], n: 45 },
    star: { col: [222, 212, 255], n: 55 },
    wisp: { col: [205, 125, 255], n: 40 }
  };

  // Soft round light shapes painted once and stamped with drawImage: building
  // radial gradients for every light on every frame is far too slow
  const BLOB = 128;
  function blob(key, stops) {
    return cached('blob|' + key, () => {
      const c = document.createElement('canvas');
      c.width = c.height = BLOB;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(BLOB / 2, BLOB / 2, 0, BLOB / 2, BLOB / 2, BLOB / 2);
      for (const [at, col] of stops) grad.addColorStop(at, col);
      g.fillStyle = grad;
      g.fillRect(0, 0, BLOB, BLOB);
      return c;
    });
  }
  const holeBlob = () => blob('hole', [[0, 'rgba(0,0,0,1)'], [0.35, 'rgba(0,0,0,0.8)'], [0.7, 'rgba(0,0,0,0.3)'], [1, 'rgba(0,0,0,0)']]);
  const glowBlob = ([r, g, b]) => blob(`glow${r},${g},${b}`, [[0, `rgba(${r},${g},${b},1)`], [1, `rgba(${r},${g},${b},0)`]]);
  // stamp a blob as an iso ellipse (rx = rp, ry = rp / 2 * squash)
  const stamp = (g, img, sx, sy, rp, alpha, squash = 1) => {
    g.globalAlpha = Math.max(0, Math.min(1, alpha));
    g.drawImage(img, sx - rp, sy - rp * 0.5 * squash, rp * 2, rp * squash);
  };

  class Atmosphere {
    constructor(map, themeId) {
      this.map = map;
      this.themeId = themeId;
      this.T = themeOf(themeId);
      this.time = 0;
      const lights = [];
      for (const o of map.obstacles || []) {
        if (o.type === 'wall_torch') {
          // the pool lands on the floor in front of the wall face
          lights.push({ x: o.side === 'right' ? o.x + 0.85 : o.x, y: o.side === 'right' ? o.y : o.y + 0.85, r: 4.6, s: 1, seed: o.x * 3.7 + o.y });
        } else if (o.type === 'brazier') lights.push({ x: o.x, y: o.y, r: 4.2, s: 1, seed: o.x + o.y * 2.3 });
        // Eternal Rift: the Holy Fountain floods the middle with warm light, the gates glow violet
        else if (o.type === 'holy_fountain') lights.push({ x: o.x, y: o.y, r: 7.5, s: 1, col: [255, 236, 170], seed: 1.7 });
        else if (o.type === 'rift_gate') lights.push({ x: o.x, y: o.y, r: 3.8, s: 0.95, col: [205, 125, 255], seed: o.x + o.y });
      }
      // glowing hazard tiles are merged into one light per 3x3 block
      const clusters = new Map();
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const t = map.tiles[y][x];
          if (t === 6) lights.push({ x, y, r: 3.2, s: 0.9, col: [140, 200, 255], seed: x + y });
          else if (GLOW_TILES[t]) {
            const key = Math.floor(x / 3) * 1000 + Math.floor(y / 3);
            const c = clusters.get(key) || { sx: 0, sy: 0, n: 0, r: 0, s: 0, col: GLOW_TILES[t][2] };
            c.sx += x; c.sy += y; c.n++;
            c.r = Math.max(c.r, GLOW_TILES[t][0]);
            c.s = Math.max(c.s, GLOW_TILES[t][1]);
            clusters.set(key, c);
          } else if (t === 4) {
            const d = decalFor(themeId, x, y);
            if (d && LIGHT_DECALS.has(d.kind)) lights.push({ x: x + d.ox, y: y + d.oy, r: 2.2, s: 0.7, col: d.kind === 'candle' ? [255, 190, 110] : null, seed: x * 2 + y });
          }
        }
      }
      for (const c of clusters.values()) {
        lights.push({ x: c.sx / c.n, y: c.sy / c.n, r: c.r + Math.sqrt(c.n) * 0.55, s: Math.min(1, c.s * (0.7 + c.n * 0.06)), col: c.col, seed: c.sx + c.sy });
      }
      this.staticLights = lights;
      this.frameLights = [];
      this.motes = [];
      this.fog = [];
      this.canvas = document.createElement('canvas');
    }

    update(dt, R) {
      dt = Math.min(dt, 0.1);
      this.time += dt;
      const c = Isometric.screenToWorld(R.viewW / 2, R.viewH / 2, R.camera, R.viewW, R.viewH);
      const span = 9 / Math.max(0.65, R.camera.zoom) + 3;
      const kind = this.T.mote, M = MOTES[kind] || MOTES.dust;
      const spawn = (m, fresh) => {
        m.x = c.x + (Math.random() - 0.5) * span * 2;
        m.y = c.y + (Math.random() - 0.5) * span * 2;
        m.z = kind === 'snow' || kind === 'drip' ? 2 + Math.random() * 2.5 : Math.random() * 2;
        m.age = fresh ? Math.random() * 6 : 0;
        m.life = 4 + Math.random() * 5;
        m.phase = Math.random() * 6;
      };
      while (this.motes.length < M.n) { const m = {}; spawn(m, true); this.motes.push(m); }
      for (const m of this.motes) {
        m.age += dt;
        if (kind === 'ember') { m.z += 0.5 * dt; m.x += Math.sin(m.age * 2 + m.phase) * 0.2 * dt; }
        else if (kind === 'snow') { m.z -= 0.3 * dt; m.x += Math.sin(m.age * 1.5 + m.phase) * 0.25 * dt; }
        else if (kind === 'drip') { m.z -= 2.6 * dt; }
        else { m.x += Math.sin(m.age * 0.7 + m.phase) * 0.12 * dt; m.y += Math.cos(m.age * 0.5 + m.phase) * 0.12 * dt; m.z += Math.sin(m.age + m.phase) * 0.08 * dt; }
        if (m.age > m.life || m.z < 0 || m.z > 4.5 || Math.abs(m.x - c.x) > span * 1.3 || Math.abs(m.y - c.y) > span * 1.3) spawn(m, false);
      }
      while (this.fog.length < 6) this.fog.push({ x: c.x + (Math.random() - 0.5) * span * 2, y: c.y + (Math.random() - 0.5) * span * 2, r: 3 + Math.random() * 3, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25 });
      for (const f of this.fog) {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (Math.abs(f.x - c.x) > span * 1.6 || Math.abs(f.y - c.y) > span * 1.6) { f.x = c.x + (Math.random() - 0.5) * span * 2; f.y = c.y + (Math.random() - 0.5) * span * 2; }
      }
    }

    // The lights near the screen this frame, with flicker
    gatherLights(R, gameState, localPlayerId) {
      const out = [];
      const z = R.camera.zoom, W = R.viewW, H = R.viewH, t = this.time;
      const add = (l) => {
        const s = Isometric.worldToScreen(l.x, l.y, 0, R.camera, W, H);
        const rp = l.r * TILE_PX * z;
        if (s.x < -rp || s.x > W + rp || s.y < -rp / 2 || s.y > H + rp / 2) return;
        const flick = l.steady ? 1 : 1 + 0.05 * Math.sin(t * 9 + l.seed) + 0.03 * Math.sin(t * 23 + l.seed * 1.7);
        out.push({ x: l.x, y: l.y, r: l.r * flick, s: l.s, col: l.col, sx: s.x, sy: s.y });
      };
      for (const l of this.staticLights) add(l);
      for (const p of (gameState && gameState.players) || []) {
        if (p.isDead) continue;
        const local = p.id === localPlayerId;
        add({ x: p.x, y: p.y, r: local ? 4.2 : 3, s: local ? 1 : 0.85, col: [255, 236, 210], steady: true });
      }
      this.frameLights = out;
      return out;
    }

    // 0 = fully lit, up to theme darkness where no light reaches
    darknessAt(x, y) {
      let lit = 0;
      for (const l of this.frameLights) {
        const d = Math.hypot(x - l.x, y - l.y);
        if (d >= l.r) continue;
        const k = Math.pow(1 - d / l.r, 1.3) * l.s * 1.3;
        if (k > lit) lit = k;
      }
      // walls catch light on their faces, so they sink a little less than the floor
      return this.T.darkness * 0.85 * (1 - Math.min(1, lit));
    }

    // Darkness with light holes over the floor, then a soft coloured glow.
    // Both are painted at quarter resolution and stretched: light is soft
    // anyway, and full-size stamps of every light are a lot of overdraw.
    drawLighting(ctx, R, gameState, localPlayerId) {
      const lights = this.gatherLights(R, gameState, localPlayerId);
      const W = R.viewW, H = R.viewH, z = R.camera.zoom, q = 0.25;
      const lw = Math.ceil(W * q), lh = Math.ceil(H * q);
      const layer = (c) => {
        if (c.width !== lw || c.height !== lh) { c.width = lw; c.height = lh; }
        const g = c.getContext('2d');
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
        g.clearRect(0, 0, lw, lh);
        return g;
      };

      const g = layer(this.canvas);
      const [dr, dg, db] = this.T.dark;
      g.fillStyle = `rgba(${dr}, ${dg}, ${db}, ${this.T.darkness})`;
      g.fillRect(0, 0, lw, lh);
      g.globalCompositeOperation = 'destination-out';
      const hole = holeBlob();
      for (const l of lights) stamp(g, hole, l.sx * q, l.sy * q, l.r * TILE_PX * z * q, l.s);

      if (!this.glowCanvas) this.glowCanvas = document.createElement('canvas');
      const gl = layer(this.glowCanvas);
      gl.globalCompositeOperation = 'lighter';
      for (const l of lights) stamp(gl, glowBlob(l.col || this.T.light), l.sx * q, l.sy * q, l.r * TILE_PX * z * 0.75 * q, 0.22 * l.s);

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.canvas, 0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.glowCanvas, 0, 0, W, H);
      ctx.restore();
    }

    // Low drifting fog and floating particles over the scene
    drawAmbient(ctx, R) {
      const z = R.camera.zoom, W = R.viewW, H = R.viewH, t = this.time;
      const [lr, lg, lb] = this.T.light;
      ctx.save();
      const fogImg = glowBlob([lr, lg, lb]);
      for (const f of this.fog) {
        const s = Isometric.worldToScreen(f.x, f.y, 0, R.camera, W, H);
        const rp = f.r * TILE_PX * z;
        if (s.x < -rp || s.x > W + rp || s.y < -rp || s.y > H + rp) continue;
        stamp(ctx, fogImg, s.x, s.y, rp, 0.06, 0.9);
      }
      ctx.globalAlpha = 1;
      const M = MOTES[this.T.mote] || MOTES.dust;
      const [mr, mg, mb] = M.col;
      const p = Math.max(1, Math.round(1.2 * z));
      for (const m of this.motes) {
        const s = Isometric.worldToScreen(m.x, m.y, m.z, R.camera, W, H);
        if (s.x < 0 || s.y < 0 || s.x > W || s.y > H) continue;
        const k = m.age / m.life;
        const fade = Math.min(1, k * 5, (1 - k) * 4);
        const tw = this.T.mote === 'star' ? 0.5 + 0.5 * Math.sin(t * 6 + m.phase * 3) : 0.75 + 0.25 * Math.sin(t * 3 + m.phase);
        ctx.fillStyle = `rgba(${mr}, ${mg}, ${mb}, ${0.75 * fade * tw})`;
        const x = Math.round(s.x), y = Math.round(s.y);
        if (this.T.mote === 'drip') ctx.fillRect(x, y, p, p * 3);
        else ctx.fillRect(x, y, p, p);
        if (this.T.mote === 'star' && tw > 0.85) {
          ctx.fillRect(x - p, y, p * 3, p / 2 > 0.5 ? Math.round(p / 2) : 1);
        }
      }
      ctx.restore();
    }
  }

  window.DungeonLife = { has, drawFloor, drawWall, Atmosphere };
})();
