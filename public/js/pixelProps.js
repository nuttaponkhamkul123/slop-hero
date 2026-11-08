// Slop Hero - procedural pixel-art map props.
// Field and dungeon decorations (pillars, crystals, monoliths, rocks, cacti,
// dead trees, mushrooms, snowy pines, bones, coffins, braziers, gold) and the
// town fountain / torches are painted once into small sprites, one sprite pixel
// = 1.3 screen px at zoom 1 (like the pixel trees), lit from the top-left with
// dithered colour ramps and a dark outline. renderer.js draws them unsmoothed.
(function () {
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const ramp = (hexes) => hexes.map(rgb);
  // ramp step for a shade value, dithered between neighbouring steps
  const q = (R, v, x, y) => R[Math.max(0, Math.min(R.length - 1, Math.round(v + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 0.9)))];

  const STONE = ramp(['#2b313d', '#3b4352', '#4f5868', '#677184', '#838da0', '#a5aebe', '#c7cdd8']);
  const SLATE = ramp(['#0a1020', '#121b30', '#1b2742', '#273757', '#384b72', '#516a96']);
  const ICE = ramp(['#0b2540', '#0f3b63', '#1667a3', '#2b93d1', '#5cc4ee', '#a7e7fb', '#effcff']);
  const ROCK = ramp(['#24282f', '#343943', '#474e59', '#5c6470', '#77808d', '#98a1ae']);
  const MOSS = ramp(['#1c3318', '#2a4a22', '#3b632d', '#52803a']);
  const CACTUS = ramp(['#16391e', '#1f5129', '#2b6b34', '#3b8541', '#56a352', '#7cc06a']);
  const BARK = ramp(['#170f0a', '#271b12', '#3a2a1c', '#51402c', '#6b5640', '#857059']);
  const CAP = ramp(['#3d0d0c', '#6b1712', '#9c2419', '#c0392b', '#de5a43', '#f08a6f']);
  const STEM = ramp(['#5e4f37', '#857252', '#ad9a73', '#d3c29a', '#efe4c6']);
  const NEEDLES = ramp(['#0c1f14', '#122b1b', '#183a23', '#20492c', '#295937', '#346a41']);
  const SNOW = ramp(['#8ea4bb', '#bccbdb', '#dfe8f2', '#ffffff']);
  const BONE = ramp(['#4f473f', '#7d7369', '#a69d92', '#cdc6bc', '#efe9e1']);
  const IRON = ramp(['#141417', '#232327', '#35353b', '#4a4a52', '#66666f']);
  const GOLD = ramp(['#4a2c06', '#7a4a0b', '#b07214', '#d99a1e', '#f5c542', '#ffe88a', '#fffbe0']);
  const WATER = ramp(['#0b2d4f', '#0e4675', '#13629e', '#1f84c4', '#43a9e3', '#8fd5f7', '#e3f6ff']);
  const EMBER = ramp(['#3b0f05', '#7c2d12', '#c2410c', '#f97316', '#fbbf24']);

  // Paint a W x H sprite. fn(x, y) returns [r, g, b] (or null); a dark outline
  // rings the opaque pixels and an optional soft ground shadow sits under them.
  function paint(W, H, fn, outline, shadow) {
    const px = new Array(W * H).fill(null);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px[y * W + x] = fn(x, y);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const out = outline ? rgb(outline) : null;
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && px[y * W + x];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, o = i * 4, col = px[i];
        if (col) { img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = col[3] === undefined ? 255 : col[3]; continue; }
        if (out && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) {
          img.data[o] = out[0]; img.data[o + 1] = out[1]; img.data[o + 2] = out[2]; img.data[o + 3] = 255; continue;
        }
        if (shadow) {
          const dx = (x + 0.5 - shadow.cx) / shadow.rx, dy = (y + 0.5 - shadow.cy) / shadow.ry;
          if (dx * dx + dy * dy <= 1) { img.data[o + 3] = 80; } // black at ~30%
        }
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // distance from point to segment
  const segDist = (x, y, x1, y1, x2, y2) => {
    const vx = x2 - x1, vy = y2 - y1, l = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((x - x1) * vx + (y - y1) * vy) / l));
    return { d: Math.hypot(x - (x1 + vx * t), y - (y1 + vy * t)), side: (x - x1) * vy - (y - y1) * vx };
  };
  const inPoly = (x, y, pts) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  // ---------------------------------------------------------------- isometric volumes
  // Nature and stone props are small 3D shapes (signed distance fields) seen in
  // the game's 2:1 isometric projection, like the houses: screen x = x - y,
  // screen y = (x + y) / 2 - z, the camera looking along (-1, -1, -1). Units are
  // sprite pixels (a tile is ~24.6 units along x or y). Every pixel's ray is
  // sphere-traced, and the hit is lit by its surface normal from the upper
  // left (the +y face, left on screen, is lit; +x, right, is in shade), then
  // dithered into the prop's colour ramp. Painted once per variant and cached.
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  };
  const LIGHT = V.norm([-0.15, 0.85, 0.75]);
  // smooth 3D value noise in 0..1
  const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
  const vn = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const f = (t) => t * t * (3 - 2 * t);
    const u = f(x - xi), v = f(y - yi), w = f(z - zi);
    const L = (a, b, t) => a + (b - a) * t;
    const c = (i, j, k) => h3(xi + i, yi + j, zi + k);
    return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v),
      L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
  };
  // distance primitives
  const SD = {
    sphere: (p, c, r) => V.len(V.sub(p, c)) - r,
    ellipsoid: (p, c, r) => {
      const q = [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]];
      return (V.len(q) - 1) * Math.min(r[0], r[1], r[2]);
    },
    box: (p, c, h) => {
      const q = [Math.abs(p[0] - c[0]) - h[0], Math.abs(p[1] - c[1]) - h[1], Math.abs(p[2] - c[2]) - h[2]];
      return V.len([Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)]) + Math.min(Math.max(q[0], q[1], q[2]), 0);
    },
    // capsule with radius r1 at a and r2 at b (a tapered limb)
    limb: (p, a, b, r1, r2 = r1) => {
      const ba = V.sub(b, a), pa = V.sub(p, a);
      const h = Math.max(0, Math.min(1, V.dot(pa, ba) / (V.dot(ba, ba) || 1)));
      return V.len(V.sub(pa, V.mul(ba, h))) - (r1 + (r2 - r1) * h);
    },
    // upright cylinder from z0 to z1 around (cx, cy)
    cyl: (p, cx, cy, r, z0, z1) => {
      const dx = Math.hypot(p[0] - cx, p[1] - cy) - r, dz = Math.max(z0 - p[2], p[2] - z1);
      return Math.min(Math.max(dx, dz), 0) + Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
    },
    // upright cone, base radius r at z0 narrowing to a point at z0 + h
    cone: (p, cx, cy, r, z0, h) => {
      const rad = Math.hypot(p[0] - cx, p[1] - cy), k = r / h;
      const side = (rad - r * (1 - (p[2] - z0) / h)) / Math.sqrt(1 + k * k);
      return Math.max(side, z0 - p[2]);
    }
  };

  // spec: { ext: [bx, by, bz] (the model fits |x| <= bx, |y| <= by, 0 <= z <= bz),
  //         parts: [{ d: (p) => distance, color: (hit) => rgb }], outline, shadow,
  //         layers: { name: (hit) => rgb | null } extra overlays (no outline) }
  // hit: { p, n, lit (0..1), x, y (sprite pixel), part }
  function isoVolume(spec) {
    const [bx, by, bz] = spec.ext;
    const span = bx + by;
    const OX = Math.ceil(span + 3), OY = Math.ceil(span / 2 + bz + 3);
    const W = OX * 2, H = OY + Math.ceil(span / 2 + 4);
    const parts = spec.parts;
    const field = (p) => { let m = Infinity; for (const pt of parts) { const d = pt.d(p); if (d < m) m = d; } return m; };
    const hits = new Array(W * H).fill(null);
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const sx = px + 0.5 - OX, sy = py + 0.5 - OY;
        const hi = Math.min(bx - sx, by, bz + sy - sx / 2);
        const lo = Math.max(-bx - sx, -by, sy - sx / 2 - 0.6);
        let t = hi, hit = null;
        for (let i = 0; i < 220 && t >= lo; i++) {
          const p = [sx + t, t, sx / 2 + t - sy];
          const d = field(p);
          if (d < 0.06) { hit = p; break; }
          t -= Math.max(0.1, d / 1.732);
        }
        if (!hit) continue;
        const e = 0.3;
        const n = V.norm([
          field([hit[0] + e, hit[1], hit[2]]) - field([hit[0] - e, hit[1], hit[2]]),
          field([hit[0], hit[1] + e, hit[2]]) - field([hit[0], hit[1] - e, hit[2]]),
          field([hit[0], hit[1], hit[2] + e]) - field([hit[0], hit[1], hit[2] - e])
        ]);
        let part = parts[0], best = Infinity;
        for (const pt of parts) { const d = pt.d(hit); if (d < best) { best = d; part = pt; } }
        hits[py * W + px] = { p: hit, n, lit: Math.max(0, V.dot(n, LIGHT)), x: px, y: py, part };
      }
    }
    const shadow = spec.shadow === false ? null
      : { cx: OX, cy: OY, rx: (spec.shadowR || span * 0.62), ry: (spec.shadowR || span * 0.62) / 2 };
    const img = paint(W, H, (x, y) => { const h = hits[y * W + x]; return h ? h.part.color(h) : null; }, spec.outline, shadow);
    const out = { img, ax: OX, ay: OY };
    // a layer is fn(hit) -> rgb | null, or { fn, outline }
    for (const [name, L] of Object.entries(spec.layers || {})) {
      const fn = typeof L === 'function' ? L : L.fn;
      out[name] = paint(W, H, (x, y) => { const h = hits[y * W + x]; return h ? fn(h) : null; }, typeof L === 'function' ? null : L.outline, null);
    }
    return out;
  }
  // ramp colour for a hit: ambient + lit, plus a bias
  const lightRamp = (R, h, bias = 0, amb = 0.22) => q(R, (amb + (1 - amb) * h.lit) * (R.length - 1) + bias, h.x, h.y);
  const clipGround = (d, p) => Math.max(d, -p[2]);
  // Stacked cone tiers of a conifer ([z0, height, radius] each). under(p): the point
  // sits just below the skirt of the tier above, in its shade (the dark ledges).
  const pineCrown = (tiers, seed, jagAmt) => ({
    d: (p) => {
      let m = Infinity;
      for (const [z0, hh, r] of tiers) m = Math.min(m, SD.cone(p, 0, 0, r, z0, hh));
      return m + (vn(p[0] * 0.75 + seed, p[1] * 0.75, p[2] * 0.75) - 0.5) * jagAmt;
    },
    under: (p) => {
      const rad = Math.hypot(p[0], p[1]);
      for (let k = 1; k < tiers.length; k++) {
        const [z0, , r] = tiers[k];
        if (p[2] < z0 + 0.6 && p[2] > z0 - 3.2 && rad < r + 0.6) return true;
      }
      return false;
    }
  });

  const ISO = {
    boulder(v) {
      const sets = [
        [[0, 0, 5, 10, 8, 7], [-7, 6, 3, 5, 4, 3.6], [7, 6, 2.5, 4, 3.6, 3]],
        [[-2, -1, 5, 8, 7, 6.5], [6, 3, 4, 6, 5.5, 5], [-6, 7, 2, 3.6, 3.2, 2.6]],
        [[0, 0, 3.5, 12, 9, 4.6], [-9, 5, 2, 4, 3, 2.5], [9, 6, 1.8, 3.4, 3, 2.2]]
      ][v];
      const lump = (p) => (vn(p[0] * 0.32 + v * 7, p[1] * 0.32, p[2] * 0.32) - 0.5) * 2.6;
      return isoVolume({
        ext: [15, 13, 13], outline: '#111317', shadowR: 15,
        parts: [{
          d: (p) => {
            let m = Infinity;
            for (const [x, y, z, rx, ry, rz] of sets) m = Math.min(m, SD.ellipsoid(p, [x, y, z], [rx, ry, rz]));
            return clipGround(m + lump(p), p);
          },
          color: (h) => {
            const [x, y, z] = h.p;
            if (h.n[2] > 0.5 && vn(x * 0.45, y * 0.45, z * 0.45 + 3) > (v === 2 ? 0.38 : 0.5)) return lightRamp(MOSS, h, 0.2);
            const crack = Math.abs(vn(x * 0.7 + 11, y * 0.7, z * 0.7) - 0.5) < 0.035;
            return lightRamp(ROCK, h, crack ? -1.6 : (hash2(h.x, h.y) - 0.5) * 0.6);
          }
        }]
      });
    },

    stone_pillar(v) {
      const broken = v === 1, mossy = v === 2;
      const topAt = (p) => 19 + vn(p[0] * 0.5, p[1] * 0.5, 2) * 7;
      const shaft = (p) => {
        const a = Math.atan2(p[1], p[0]);
        let d = SD.cyl(p, 0, 0, 5.2, 4.5, broken ? 40 : 33.5) + Math.max(0, Math.cos(a * 10)) * 0.55;
        if (broken) d = Math.max(d, p[2] - topAt(p));
        return d;
      };
      const stone = (h) => {
        const [x, y, z] = h.p;
        const mossLine = mossy ? 14 : 7;
        if (z < mossLine && h.n[2] > -0.2 && vn(x * 0.6, y * 0.6, z * 0.6) > (mossy ? 0.42 : 0.58)) return lightRamp(MOSS, h, 0.2);
        if (mossy && h.n[2] > 0.6 && vn(x * 0.5, y * 0.5, z * 0.5 + 9) > 0.45) return lightRamp(MOSS, h, 0.3);
        const chip = hash2(Math.floor(x + 20) * 3 + Math.floor(z), Math.floor(y + 20)) < 0.04;
        return lightRamp(STONE, h, chip ? -1.4 : (hash2(h.x, h.y) - 0.5) * 0.5);
      };
      const parts = [
        { d: (p) => Math.min(SD.box(p, [0, 0, 1.5], [9.5, 9.5, 1.5]), SD.box(p, [0, 0, 3.75], [7.8, 7.8, 0.85])), color: stone },
        { d: shaft, color: stone }
      ];
      if (!broken) {
        parts.push({ d: (p) => Math.min(SD.box(p, [0, 0, 34.6], [6.8, 6.8, 1.1]), SD.box(p, [0, 0, 36.7], [8.2, 8.2, 1])), color: stone });
      } else {
        // a fallen drum of the shaft beside the plinth
        parts.push({ d: (p) => SD.limb(p, [11, -2, 2.6], [11, 7, 2.6], 2.6), color: stone });
      }
      return isoVolume({ ext: [14, 10, 39], outline: '#141820', shadowR: 13, parts });
    },

    ice_crystal(v) {
      const hs = [[30, 18, 16], [25, 22, 14], [32, 15, 20]][v];
      const prisms = [
        { b: [0, 0, 0], a: V.norm([0, 0.05, 1]), h: hs[0], r: 4.4 },
        { b: [-5, 5, 0], a: V.norm([-0.3, 0.25, 1]), h: hs[1], r: 3.3 },
        { b: [5, -3, 0], a: V.norm([0.35, -0.2, 1]), h: hs[2], r: 3.1 },
        { b: [3, 6, 0], a: V.norm([0.25, 0.45, 1]), h: hs[2] * 0.55, r: 2.2 }
      ].map(pr => {
        const u = V.norm([pr.a[2], 0, -pr.a[0]]);
        const w = [pr.a[1] * u[2] - pr.a[2] * u[1], pr.a[2] * u[0] - pr.a[0] * u[2], pr.a[0] * u[1] - pr.a[1] * u[0]];
        return { ...pr, u, w };
      });
      const prismD = (pr, p) => {
        const qv = V.sub(p, pr.b), hh = V.dot(qv, pr.a);
        const ru = Math.abs(V.dot(qv, pr.u)), rw = Math.abs(V.dot(qv, pr.w));
        const hex = Math.max(ru * 0.866 + rw * 0.5, rw);
        const k = hh / pr.h, rr = k < 0.7 ? pr.r : pr.r * Math.max(0, 1 - (k - 0.7) / 0.3);
        return Math.max((hex - rr) * 0.75, -hh, hh - pr.h);
      };
      return isoVolume({
        ext: [14, 13, 33], outline: '#071a2e', shadowR: 12,
        parts: prisms.map(pr => ({
          d: (p) => clipGround(prismD(pr, p), p),
          color: (h) => {
            const k = V.dot(V.sub(h.p, pr.b), pr.a) / pr.h;
            let s = 1.2 + h.lit * 4.6;
            if (k > 0.86) s += 1;               // bright tip
            if (k < 0.1) s -= 0.8;              // frosted foot
            const facet = Math.abs(h.n[2]) < 0.4 && Math.abs(h.n[0] - h.n[1]) < 0.12;
            if (facet) s += 0.9;                // edge between two side faces catches light
            return q(ICE, s, h.x, h.y);
          }
        }))
      });
    },

    frost_monolith(v) {
      const half = (z) => (z < 46 ? 6.2 - (z - 5) * 0.035 : Math.max(0, (55 - z) * 0.66));
      const body = (p) => Math.max((Math.max(Math.abs(p[0]), Math.abs(p[1])) - half(p[2])) * 0.8, 5 - p[2], p[2] - 55);
      // carved runes on the two visible faces (face coord u across, z up)
      const rune = (u, z) => {
        if (Math.abs(u) < 0.7 && z >= 13 && z <= 40) return true;
        if (z >= 31 && z <= 35 && Math.abs(Math.abs(u) - (35 - z) - (v ? 0.6 : 0)) < 0.7 && Math.abs(u) <= 4) return true;
        if (z >= 20 && z <= 24 && Math.abs(Math.abs(u) - (z - 20)) < 0.7 && Math.abs(u) <= 4) return true;
        return Math.abs(z - 16) < 0.7 && Math.abs(u) <= 3;
      };
      const runeAt = (h) => {
        if (h.part !== partBody || h.p[2] > 44) return false;
        if (h.n[1] > 0.8) return rune(h.p[0], h.p[2]);
        if (h.n[0] > 0.8) return rune(-h.p[1], h.p[2]);
        return false;
      };
      const partBody = {
        d: body,
        color: (h) => {
          if (runeAt(h)) return SLATE[0];
          if (h.p[2] > 49 && hash2(h.x, h.y) < 0.6) return SNOW[2];          // frosted tip
          return lightRamp(SLATE, h, hash2(h.x * 2, h.y) < 0.04 ? -1.2 : 0, 0.3);
        }
      };
      const partBase = {
        d: (p) => SD.box(p, [0, 0, 2.5], [10, 10, 2.5]),
        color: (h) => (h.n[2] > 0.7 && hash2(h.x, h.y * 3) < 0.75 ? SNOW[2 + (hash2(h.x, 9) < 0.5 ? 1 : 0)] : lightRamp(STONE, h, 0, 0.25))
      };
      return isoVolume({
        ext: [12, 12, 56], outline: '#05080f', shadowR: 13, parts: [partBase, partBody],
        layers: { glow: (h) => (runeAt(h) ? (hash2(h.x, h.y) < 0.5 ? rgb('#a5f3fc') : rgb('#22d3ee')) : null) }
      });
    },

    cactus(v) {
      const arms = [
        [[[0, 0, 9], [0, 7, 9], 2.4], [[0, 7, 9], [0, 7, v ? 19 : 17], 2.4]],
        [[[0, 0, 14], [7, 0, 14], 2.3], [[7, 0, 14], [7, 0, v === 2 ? 20 : 23], 2.3]]
      ];
      if (v === 1) arms.push([[[0, 0, 18], [-5, -2, 18], 1.9], [[-5, -2, 18], [-5, -2, 23], 1.9]]);
      const rib = (p, cx, cy) => Math.cos(Math.atan2(p[1] - cy, p[0] - cx) * 8) * 0.3;
      const green = (h) => {
        if (hash2(h.x * 7, h.y * 3) < 0.025) return rgb('#f5f0c8');          // spines
        return lightRamp(CACTUS, h, 0, 0.18);
      };
      const parts = [{ d: (p) => clipGround(SD.limb(p, [0, 0, 0], [0, 0, 26], 3.8) + rib(p, 0, 0), p), color: green }];
      for (const arm of arms) {
        parts.push({ d: (p) => Math.min(...arm.map(([a, b, r]) => SD.limb(p, a, b, r))) + rib(p, arm[1][0][0], arm[1][0][1]), color: green });
      }
      if (v !== 2) parts.push({ d: (p) => SD.sphere(p, [0, 0, 30], 1.7), color: (h) => (h.n[2] > 0.3 ? rgb('#fbcfe8') : rgb('#ec4899')) });
      return isoVolume({ ext: [10, 10, 32], outline: '#0b1f10', shadowR: 9, parts });
    },

    dead_tree(v) {
      const s = v === 1 ? -1 : 1, sw = v === 2;
      const P = (x, y, z) => (sw ? [y * s, x * s, z] : [x * s, y * s, z]);
      const limbs = [
        [P(0, 0, 0), P(0.6, 0, 22), 3.2, 2.2], [P(0.6, 0, 22), P(-0.8, 1, 37), 2.2, 1.2],
        [P(0, 0, 15), P(-9, 3, 25), 1.7, 1.0], [P(-9, 3, 25), P(-12, 4, 33), 1.0, 0.55], [P(-9, 3, 25), P(-15, 2, 24), 0.8, 0.45],
        [P(0.5, 0, 23), P(8, -4, 31), 1.5, 0.9], [P(8, -4, 31), P(13, -5, 30), 0.9, 0.5],
        [P(-0.8, 1, 37), P(-3, 2.5, 43), 1.1, 0.55], [P(0, 0.5, 31), P(4, 5, 38), 1.0, 0.5],
        // roots
        [P(0, 0, 1.5), P(5, 1.5, 0), 1.6, 0.6], [P(0, 0, 1.5), P(-3, 4, 0), 1.4, 0.5], [P(0, 0, 1.5), P(-1, -5, 0), 1.3, 0.5]
      ];
      return isoVolume({
        ext: [17, 17, 45], outline: '#0c0805', shadowR: 11,
        parts: [{
          d: (p) => { let m = Infinity; for (const [a, b, r1, r2] of limbs) m = Math.min(m, SD.limb(p, a, b, r1, r2)); return clipGround(m, p); },
          color: (h) => {
            const streak = vn(h.p[0] * 1.4, h.p[1] * 1.4, h.p[2] * 0.25) - 0.5;
            const knot = hash2(Math.floor(h.p[2] / 2), Math.floor(h.p[0] + h.p[1])) < 0.04;
            return lightRamp(BARK, h, streak * 1.2 - (knot ? 1.4 : 0), 0.25);
          }
        }]
      });
    },

    giant_mushroom(v) {
      const capR = [CAP, ramp(['#2a1238', '#43205c', '#63307f', '#8545a3', '#a866c3', '#c993dc']), ramp(['#3b2210', '#5e3818', '#835022', '#a8692d', '#c9873f', '#e2a95e'])][v];
      const spots = [];
      for (let i = 0; i < 11; i++) {
        const a = hash2(i, 3 + v) * Math.PI * 2, el = 0.25 + hash2(i, 9 + v) * 0.95;
        spots.push({ c: [Math.cos(a) * Math.cos(el) * 13, Math.sin(a) * Math.cos(el) * 13, 13 + Math.sin(el) * 8], r: 1.5 + hash2(i, 5) * 1.6 });
      }
      const stem = {
        d: (p) => clipGround(Math.min(SD.limb(p, [0, 0, 0], [0, 0, 13], 3.8, 2.9), SD.ellipsoid(p, [0, 0, 1], [4.8, 4.8, 2.4])), p),
        color: (h) => lightRamp(STEM, h, -0.3, 0.3)
      };
      const cap = {
        d: (p) => Math.max(SD.ellipsoid(p, [0, 0, 13], [13.5, 13.5, 8.5]), 12 - p[2]),
        color: (h) => {
          if (h.n[2] < -0.6) return q(STEM, 0.8 + (Math.floor(Math.atan2(h.p[1], h.p[0]) * 6) % 2 ? 0.4 : 0), h.x, h.y);   // gills
          for (const sp of spots) if (V.len(V.sub(h.p, sp.c)) < sp.r) return lightRamp(STEM, h, 0.6, 0.45);
          return lightRamp(capR, h, 0, 0.25);
        }
      };
      return isoVolume({ ext: [15, 15, 22], outline: '#160806', shadowR: 13, parts: [stem, cap] });
    },

    snow_pine(v) {
      const P = pineCrown([[6, 14, 13], [15, 13, 10.5], [24, 12, 8], [32, 11, 5.2]], v * 5, 1.6);
      const trunk = { d: (p) => clipGround(SD.cyl(p, 0, 0, 1.9, 0, 9), p), color: (h) => lightRamp(BARK, h, 0, 0.25) };
      const crown = {
        d: P.d,
        color: (h) => {
          const [x, y, z] = h.p;
          if (P.under(h.p)) return lightRamp(NEEDLES, h, -1.8, 0.1);
          if (h.n[2] > 0.45 && vn(x * 0.8, y * 0.8, z * 0.8 + 4) > 0.5) return lightRamp(SNOW, h, 0, 0.35);
          return lightRamp(NEEDLES, h, (hash2(h.x, h.y) - 0.5) * 0.6, 0.2);
        }
      };
      return isoVolume({ ext: [14, 14, 44], outline: '#07120c', shadowR: 12, parts: [trunk, crown] });
    },

    bone_pile(v) {
      const bones = [[[-9, 2, 1], [5, -3, 1]], [[-4, -6, 1], [8, 2, 1.2]], [[-7, -2, 2.4], [2, 5, 1]], [[1, -8, 0.9], [10, -2, 1]]];
      const sk = [v ? -5 : -1, 3, 3.4];
      const bone = (h) => lightRamp(BONE, h, 0.3, 0.3);
      const parts = bones.map(([a, b]) => ({
        d: (p) => clipGround(Math.min(SD.limb(p, a, b, 0.9), SD.sphere(p, a, 1.5), SD.sphere(p, b, 1.5)), p),
        color: bone
      }));
      parts.push({
        d: (p) => clipGround(Math.min(SD.ellipsoid(p, sk, [3.1, 3.4, 3]), SD.box(p, [sk[0], sk[1] + 1.2, 1.2], [2, 1.8, 1.2])), p),
        color: (h) => {
          // eye sockets and teeth on the face turned toward the camera (+y)
          const ex = h.p[0] - sk[0], ez = h.p[2] - sk[2];
          if (h.n[1] > 0.4 && Math.abs(ez - 0.4) < 0.9 && Math.abs(Math.abs(ex) - 1.4) < 0.85) return rgb('#1c1917');
          if (h.n[1] > 0.5 && h.p[2] < 2.2 && Math.floor(h.x) % 2 === 0) return BONE[1];
          return bone(h);
        }
      });
      return isoVolume({ ext: [13, 11, 8], outline: '#1b1612', shadowR: 12, parts });
    },

    gold_hoard(v) {
      const goblet = [-5 + v * 3, -2, 0];
      return isoVolume({
        ext: [16, 14, 14], outline: '#2a1803', shadowR: 16,
        parts: [
          {
            d: (p) => clipGround(SD.ellipsoid(p, [0, 0, 0], [14, 12, 8]) + (vn(p[0] * 0.8 + v, p[1] * 0.8, p[2] * 0.8) - 0.5) * 1.2, p),
            color: (h) => {
              const coin = hash2(Math.floor(h.p[0] * 0.8 + 30) + v, Math.floor(h.p[1] * 0.8 + 30) * 7 + Math.floor(h.p[2])) < 0.24;
              return lightRamp(GOLD, h, coin ? 1.1 : -0.7, 0.2);
            }
          },
          { d: (p) => Math.min(SD.cyl(p, goblet[0], goblet[1], 0.8, 6, 9.5), SD.cyl(p, goblet[0], goblet[1], 2.1, 9.5, 12.5), SD.cyl(p, goblet[0], goblet[1], 1.6, 6, 6.8)), color: (h) => lightRamp(GOLD, h, 0.6, 0.35) },
          { d: (p) => SD.sphere(p, [5, 4, 6.8], 1.7), color: (h) => (h.lit > 0.6 ? rgb('#fca5a5') : rgb('#dc2626')) }
        ]
      });
    }
  };

  // ---- Portal gate: a stone arch on a stepped dais, in the iso projection.
  // The arch stands in the x-z plane (y = 0); its opening is |x| < PORTAL.inner,
  // PORTAL.z0 < z < PORTAL.top, where the renderer draws the swirling vortex.
  const PORTAL = { half: 17, tube: 3.1, pillarTop: 30, z0: 5.2, inner: 13.9, top: 43.9 };
  const portalCache = new Map();
  function portalGate(accent) {
    if (portalCache.has(accent)) return portalCache.get(accent);
    const A = rgb(accent), G = PORTAL;
    const glowCol = (k) => A.map(v => Math.min(255, Math.round(v + (255 - v) * k)));
    // rune grooves cut into the front (+y) faces of both pillars and the keystone
    const rune = (h) => {
      if (h.n[1] < 0.75) return false;
      const [x, , z] = h.p, ax = Math.abs(x);
      if (ax > G.half - 1.4 && ax < G.half + 1.4 && z > 9 && z < G.pillarTop - 3) {
        const k = (z - 9) % 5;
        return Math.abs(ax - G.half) < 0.45 || (k < 0.7 && Math.abs(ax - G.half) < 1.1);
      }
      return z > G.pillarTop + G.half - 1.5 && ax < 1.2;
    };
    const stone = (h) => (rune(h) ? SLATE[1] : lightRamp(STONE, h, (hash2(h.x, h.y) - 0.5) * 0.6 - (h.p[2] < 5 ? 0.6 : 0), 0.25));
    const M = isoVolume({
      ext: [G.half + 5, 15, G.top + 8], outline: '#141820', shadowR: 23,
      parts: [
        // stepped dais
        { d: (p) => Math.min(SD.box(p, [0, 0, 1.5], [G.half + 4, 14, 1.5]), SD.box(p, [0, 0, 4], [G.half + 2, 11, 1.2])), color: stone },
        // two square pillars
        { d: (p) => Math.min(...[-1, 1].map(s => SD.box(p, [s * G.half, 0, (G.z0 + G.pillarTop) / 2], [G.tube, G.tube, (G.pillarTop - G.z0) / 2]))), color: stone },
        // the arch: half a ring in the x-z plane above the pillars, with a keystone
        {
          d: (p) => {
            const dz = p[2] - G.pillarTop;
            const ring = Math.hypot(Math.hypot(p[0], Math.max(dz, 0)) - G.half, p[1]) - G.tube;
            const key = SD.box(p, [0, 0, G.pillarTop + G.half], [2.2, G.tube + 0.3, 3]);
            return Math.min(dz < 0 ? Infinity : ring, key);
          },
          color: stone
        }
      ],
      layers: { glow: (h) => (rune(h) ? glowCol(hash2(h.x, h.y) < 0.5 ? 0.15 : 0.55) : null) }
    });
    const spr = { img: M.img, glow: M.glow, ax: M.ax, ay: M.ay, geo: G };
    portalCache.set(accent, spr);
    return spr;
  }

  // ---- Cave portal (the Eternal Rift's entrance): a rocky mound with a dark
  // tunnel opening toward +y. The model's origin is the cave floor at the mouth;
  // the renderer draws the vortex in the plane v = CAVE.v (inside the opening:
  // |x| < CAVE.inner, CAVE.z0 < z < CAVE.top).
  const K_CAVE = 1.9;   // overall size of the cave model
  const CAVE = { v: 3, inner: 14, z0: 1, top: 28, labelZ: 76 };
  const caveCache = new Map();
  function caveMouth(accent) {
    if (caveCache.has(accent)) return caveCache.get(accent);
    const A = rgb(accent), K = K_CAVE;
    const lump = (p) => (vn(p[0] * 0.1 + 3, p[1] * 0.1, p[2] * 0.1) - 0.5) * 12 + (vn(p[0] * 0.35, p[1] * 0.35 + 9, p[2] * 0.35) - 0.5) * 3.5;
    // the tunnel: a rounded arch cut into the mound's front, running back into the hill
    const tunnel = (p) => {
      const ax = Math.abs(p[0]) / (8 * K), az = Math.max(0, p[2] - 7 * K) / (8.5 * K);
      return Math.max((Math.hypot(ax, az) - 1) * 7.5 * K, -10 * K - p[1]);
    };
    const mound = (p) => clipGround(Math.min(
      SD.ellipsoid(p, [0, -13 * K, 0], [27 * K, 20 * K, 25 * K]),
      SD.ellipsoid(p, [-15 * K, -6 * K, 0], [13 * K, 11 * K, 12 * K]),
      SD.ellipsoid(p, [16 * K, -8 * K, 0], [12 * K, 12 * K, 13 * K])
    ) + lump(p), p);
    // rune stones framing the mouth glow in the portal colour
    const rune = (h) => h.n[1] > 0.55 && h.p[1] > -2 * K && Math.abs(Math.hypot(Math.abs(h.p[0]) / (9.6 * K), Math.max(0, h.p[2] - 7 * K) / (10 * K)) - 1) < 0.07
      && Math.floor(Math.atan2(h.p[2] - 7 * K, h.p[0]) * 4) % 2 === 0;
    const glowCol = (k) => A.map(v => Math.min(255, Math.round(v + (255 - v) * k)));
    const M = isoVolume({
      ext: [30 * K, 34 * K, 34 * K], outline: '#0f1116', shadowR: 30 * K,
      parts: [
        {
          d: (p) => Math.max(mound(p), -tunnel(p)),
          color: (h) => {
            // deep in the tunnel the rock falls into darkness
            const depth = Math.max(0, 6 * K - h.p[1]) / (14 * K);
            if (h.p[1] < 4 * K && tunnel(h.p) < 1.2 * K) return q(R_ROCK_DARK, 1.6 - depth * 2, h.x, h.y);
            if (rune(h)) return SLATE[2];
            if (h.n[2] > 0.6 && vn(h.p[0] * 0.16, h.p[1] * 0.16, h.p[2] * 0.16) > 0.6) return lightRamp(MOSS, h, 0.1);
            const crack = Math.abs(vn(h.p[0] * 0.28 + 4, h.p[1] * 0.28, h.p[2] * 0.28) - 0.5) < 0.03;
            return lightRamp(ROCK, h, crack ? -1.5 : (hash2(h.x, h.y) - 0.5) * 0.7, 0.2);
          }
        },
        // rubble scattered at the foot of the mouth
        {
          d: (p) => clipGround(Math.min(SD.ellipsoid(p, [-11 * K, 6 * K, 1.2 * K], [3.6 * K, 3 * K, 2.6 * K]), SD.ellipsoid(p, [12 * K, 4 * K, K], [3 * K, 2.6 * K, 2.2 * K]), SD.ellipsoid(p, [9 * K, 9 * K, 0.8 * K], [2 * K, 1.8 * K, 1.5 * K])) + lump(p) * 0.2, p),
          color: (h) => lightRamp(ROCK, h, 0.2, 0.22)
        }
      ],
      layers: { glow: (h) => (rune(h) ? glowCol(hash2(h.x, h.y) < 0.5 ? 0.2 : 0.6) : null) }
    });
    const spr = { img: M.img, glow: M.glow, ax: M.ax, ay: M.ay, geo: CAVE };
    caveCache.set(accent, spr);
    return spr;
  }
  const R_ROCK_DARK = ramp(['#050508', '#0b0b10', '#13131a', '#1c1d25', '#272833']);

  // Town trees (oak and pine) in the same projection. Trunk and crown come as
  // two images so the renderer can sway the crown in the breeze.
  const LEAVES = ramp(['#132a17', '#1a3a1e', '#224a25', '#2c5c2c', '#376e33', '#46813b', '#589346', '#6ea653']);
  const TRUNK = ramp(['#24170f', '#352318', '#4a3222', '#5f432e', '#76563c']);
  const treeCache = new Map();
  function isoTree(type, variant) {
    const key = type + '|' + variant;
    if (treeCache.has(key)) return treeCache.get(key);
    const seed = variant * 101 + (type === 'pine_tree' ? 7 : 3);
    const rnd = (i) => hash2(i * 13 + seed, seed * 7 + i);
    let trunkParts, crownParts, ext, outlineCrown;
    if (type === 'pine_tree') {
      const P = pineCrown([[10, 16, 15.5], [20, 15, 13], [30, 14, 10.5], [40, 13, 8], [50, 13, 5.2]], seed, 1.9);
      trunkParts = [{ d: (p) => clipGround(SD.cyl(p, 0, 0, 2.3, 0, 14), p), color: (h) => lightRamp(TRUNK, h, 0, 0.25) }];
      crownParts = [{
        d: P.d,
        color: (h) => (P.under(h.p) ? lightRamp(NEEDLES, h, -1.8, 0.08)
          : lightRamp(NEEDLES, h, (hash2(h.x + seed, h.y) - 0.5) * 0.9 + (h.p[2] > 55 ? 0.6 : 0), 0.18))
      }];
      ext = [17, 17, 66];
      outlineCrown = '#081510';
    } else {
      const blobs = [{ c: [0, 0, 36], r: 12 }];
      for (let i = 0; i < 12; i++) {
        const a = rnd(i) * Math.PI * 2, d = 0.4 + rnd(i + 40) * 0.6, z = 30 + (rnd(i + 60) - 0.4) * 16;
        blobs.push({ c: [Math.cos(a) * 11 * d, Math.sin(a) * 11 * d, z], r: 6 + rnd(i + 80) * 4.5 });
      }
      const lean = (rnd(99) - 0.5) * 2;
      trunkParts = [{
        d: (p) => clipGround(Math.min(
          SD.limb(p, [0, 0, 0], [lean, 0, 30], 3.4, 2.2),
          SD.limb(p, [lean * 0.6, 0, 20], [5, 3, 31], 1.6, 1.0),
          SD.limb(p, [lean * 0.6, 0, 22], [-4, -3, 32], 1.5, 0.9),
          SD.ellipsoid(p, [0, 0, 0.5], [5.2, 5.2, 2.6])
        ), p),
        color: (h) => lightRamp(TRUNK, h, hash2(h.x + seed, h.y * 3) < 0.15 ? -1 : 0, 0.25)
      }];
      const leafy = (p) => (vn(p[0] * 0.45 + seed, p[1] * 0.45, p[2] * 0.45) - 0.5) * 3 + (vn(p[0] * 1.3, p[1] * 1.3 + seed, p[2] * 1.3) - 0.5) * 1.1;
      crownParts = [{
        d: (p) => { let m = Infinity; for (const b of blobs) m = Math.min(m, SD.sphere(p, b.c, b.r)); return m + leafy(p); },
        color: (h) => lightRamp(LEAVES, h, (h.p[2] - 36) / 12 + (hash2(h.x * 5 + seed, h.y * 3) - 0.5) * 1.1, 0.05)
      }];
      ext = [20, 20, 52];
      outlineCrown = '#0b1a0e';
    }
    // One march for the whole tree, split into two images: every pixel goes to
    // whichever part is nearest the camera, so the crown never paints over
    // trunk that stands in front of it. (Shadows: the renderer draws them.)
    const crownColor = new Map(crownParts.map(pt => [pt, pt.color]));
    const parts = [...trunkParts, ...crownParts.map(pt => ({ d: pt.d, color: () => null, crown: pt }))];
    const M = isoVolume({
      ext, parts, outline: '#140d08', shadow: false,
      layers: { crown: { fn: (h) => (h.part.crown ? crownColor.get(h.part.crown)(h) : null), outline: outlineCrown } }
    });
    const spr = { trunk: M.img, crown: M.crown, ax: M.ax, ay: M.ay };
    treeCache.set(key, spr);
    return spr;
  }

  // ---------------------------------------------------------------- sprites
  const BUILD = {
    ...ISO,

    sarcophagus(v) {
      const W = 50, H = 34, ox = 25, oy = 25, L = 14, Wd = 7, Ht = 7;
      const p = (u, w, h) => [ox + (u - w) * 0.7, oy + (u + w) * 0.35 - h];
      const front = [p(-L, Wd, 0), p(L, Wd, 0), p(L, Wd, Ht), p(-L, Wd, Ht)];
      const side = [p(L, -Wd, 0), p(L, Wd, 0), p(L, Wd, Ht), p(L, -Wd, Ht)];
      const lid = [p(-L, -Wd, Ht), p(L, -Wd, Ht), p(L, Wd, Ht), p(-L, Wd, Ht)];
      const relief = [p(-L * 0.8, -Wd * 0.6, Ht + 1.5), p(L * 0.8, -Wd * 0.6, Ht + 1.5), p(L * 0.8, Wd * 0.6, Ht + 1.5), p(-L * 0.8, Wd * 0.6, Ht + 1.5)];
      const crossA = [p(-L * 0.5, 0, Ht + 1.5), p(L * 0.5, 0, Ht + 1.5)], crossB = [p(-L * 0.2, -Wd * 0.45, Ht + 1.5), p(-L * 0.2, Wd * 0.45, Ht + 1.5)];
      const img = paint(W, H, (x, y) => {
        const X = x + 0.5, Y = y + 0.5;
        if (inPoly(X, Y, relief)) {
          if (segDist(X, Y, ...crossA[0], ...crossA[1]).d < 0.7 || segDist(X, Y, ...crossB[0], ...crossB[1]).d < 0.7) return STONE[1];
          return q(STONE, 4.4 + (hash2(x, y) - 0.5) * 0.6, x, y);
        }
        if (inPoly(X, Y, lid)) return q(STONE, 3.6, x, y);
        if (inPoly(X, Y, side)) return q(STONE, 1.6 + (hash2(x, y) < 0.06 ? -1 : 0), x, y);
        if (inPoly(X, Y, front)) {
          if (v === 1 && hash2(x * 3, y) < 0.18) return MOSS[1];
          return q(STONE, 2.5 + (Y < front[3][1] + 1.5 ? 0.8 : 0), x, y);
        }
        return null;
      }, '#12151b', { cx: 25, cy: 28, rx: 22, ry: 5 });
      return { img, ax: 25, ay: 26 };
    },

    brazier() {
      const W = 26, H = 24;
      const img = paint(W, H, (x, y) => {
        const dx = x - 12.5;
        // coals glowing in the bowl
        if (y >= 6 && y <= 7 && Math.abs(dx) <= 8.5 - (7 - y)) return q(EMBER, 2.6 + hash2(x, y) * 1.8, x, y);
        // bowl
        if (y >= 7 && y <= 11 && Math.abs(dx) <= 9.5 - (y - 7) * 1.2) return q(IRON, 3 - dx * 0.2 + (y === 7 ? 1 : 0), x, y);
        // stem and three legs
        if (y >= 12 && y <= 20 && Math.abs(dx) <= 1.2) return q(IRON, 2.5 - dx, x, y);
        if (y >= 18 && y <= 21 && (Math.abs(dx - (y - 18) * 1.8) < 0.8 || Math.abs(dx + (y - 18) * 1.8) < 0.8)) return IRON[2];
        return null;
      }, '#0a0a0c', { cx: 13, cy: 21, rx: 9, ry: 2.5 });
      return { img, ax: 13, ay: 21, flameY: 6 };
    },



    torch() {
      const W = 20, H = 40, cx = 9.5;
      const img = paint(W, H, (x, y) => {
        const dx = x - cx;
        if (y >= 3 && y <= 4 && Math.abs(dx) <= 6.5) return q(EMBER, 2 + hash2(x, y) * 2, x, y); // coals
        if (y >= 4 && y <= 9 && Math.abs(dx) <= 6.5 - (y - 4) * 0.7) return q(IRON, 3 - dx * 0.25 + (y === 4 ? 1 : 0), x, y);
        if (y >= 22 && y <= 23 && Math.abs(dx) <= 2.5) return IRON[3];
        if (y >= 10 && y <= 34 && Math.abs(dx) <= 1.2) return q(IRON, 2.6 - dx * 1.2, x, y);
        if (y >= 34 && y <= 37 && Math.abs(dx) <= 5 - (37 - y) * 0.5) return q(STONE, 2.5 - dx * 0.2, x, y);
        return null;
      }, '#08080a', { cx: 10, cy: 37, rx: 7, ry: 2.5 });
      return { img, ax: 10, ay: 37, flameY: 3 };
    },

    fountain() {
      // tiered marble basin; the water moves in an overlay drawn each frame
      const W = 60, H = 56, cx = 29.5, by = 44;
      const ell = (x, y, ex, ey, rx, ry) => ((x + 0.5 - ex) / rx) ** 2 + ((y + 0.5 - ey) / ry) ** 2;
      const img = paint(W, H, (x, y) => {
        const dx = x - cx;
        // top chalice and spire
        if (ell(x, y, cx + 0.5, 12, 6, 2.6) <= 1) return y < 12 ? q(WATER, 5, x, y) : q(STONE, 5 - dx * 0.2, x, y);
        if (y > 12 && y <= 22 && Math.abs(dx) <= 2) return q(STONE, 4 - dx * 0.6, x, y);
        // mid bowl with water
        if (ell(x, y, cx + 0.5, 24, 10, 4.6) <= 1) {
          if (ell(x, y, cx + 0.5, 23.6, 8, 3.2) <= 1) return q(WATER, 4.6 - (y - 21) * 0.3, x, y);
          return q(STONE, 4.4 - dx * 0.12, x, y);
        }
        if (y > 24 && y <= 28 && Math.abs(dx) <= 7 - (y - 24) * 1.2) return q(STONE, 2.6 - dx * 0.15, x, y);
        if (y > 28 && y <= by && Math.abs(dx) <= 3.6) return q(STONE, 3.4 - dx * 0.4, x, y);
        // lower basin: rim, gold filigree, water
        const e = ell(x, y, cx + 0.5, by, 26, 13);
        if (e <= 1) {
          const inner = ell(x, y, cx + 0.5, by - 0.8, 21.5, 10.2);
          if (inner <= 1) return q(WATER, 2.4 + (1 - inner) * 2 - (y - by) * 0.08, x, y);
          if (inner <= 1.12) return GOLD[3];
          return q(STONE, 4.2 - dx * 0.05 - (y > by ? 1.2 : 0), x, y);
        }
        // basin wall below the rim
        if (y > by && y <= by + 5 && ell(x, by, cx + 0.5, by, 26, 13) <= 1) return q(STONE, 2.4 - dx * 0.05 + (y === by + 5 ? -0.8 : 0), x, y);
        return null;
      }, '#141922', { cx: 30, cy: 50, rx: 29, ry: 6 });
      return { img, ax: 30, ay: 50, water: { cx, by, rx: 21.5, ry: 10.2 } };
    }
  };

  // ---------------------------------------------------------------- town (2D mode)
  // The town's 3D models (townProps3D.js) have no 2D twin without these: houses,
  // gate towers, the keep, stalls, booths and street furniture. Front-on sprites
  // in the same palette as the models. Booths return `front` too: the counter
  // is painted over the shopkeeper, who stands between the two layers.
  const PLASTER = ramp(['#7d705a', '#a99b7e', '#cdbf9c', '#e8dcc0', '#fbf1d8']);
  const WOOD = ramp(['#1f130a', '#3a2415', '#5a3a20', '#7a5030', '#9c6a40', '#bf8a58']);
  const ROOFS = [
    ramp(['#3a1410', '#5f2219', '#8b3226', '#b04a38', '#d0705a']),
    ramp(['#141f33', '#22375a', '#34527f', '#4d72a3', '#7498c8']),
    ramp(['#1b2410', '#2f3d1c', '#475b2a', '#65803a', '#8aa854'])
  ];
  const AWNINGS = [['#c0392b', '#f5efe0'], ['#2e6fb5', '#f5efe0'], ['#2f9e57', '#fdf2d0'], ['#8e44ad', '#f9e79f']];
  const WARM = ramp(['#8a4b10', '#c97a1e', '#f0a83a', '#ffcc70', '#fff0b8']);
  const KEEP = ramp(['#1f232b', '#3a404b', '#585f6c', '#7a818e', '#9da2ab', '#c0c5cd']);
  const SLATEROOF = ramp(['#10182a', '#1c2842', '#2f3b55', '#455479', '#62749d']);
  const CLOTH_RED = ramp(['#3d0d0d', '#6e1414', '#9b1c1c', '#c53030', '#e25a5a']);
  const ARCANE = ramp(['#1e0f33', '#3b1d63', '#5b2e99', '#8450cf', '#b890f0', '#e6d4ff']);
  const BRICKR = ramp(['#2a1410', '#4a2418', '#6e3a28', '#8f5238', '#b06c4c']);

  const ell2 = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
  // courses of bricks: dark mortar lines with every other course shifted
  const bricks = (R, x, y, s, bw = 6, bh = 4) => {
    const row = Math.floor(y / bh), off = row % 2 ? bw / 2 : 0;
    const joint = y % bh === 0 || (x + off) % bw === 0;
    return q(R, s - (joint ? 1.15 : 0) + (hash2(x, y) - 0.5) * 0.5, x, y);
  };
  const rgbHex = (h) => rgb(h);

  // ---- Houses, in the game's 2:1 isometric projection.
  // A small 3D model (walls, gabled roof, chimneys, porch / shed / sign) is ray-cast
  // pixel by pixel: screen x = x - y, screen y = (x + y) / 2 - z, so the camera looks
  // along (-1, -1, -1) and sees the +y face (left on screen), the +x face (right) and
  // the roof. Four builds x three roof colours; v = roof + 3 * build.
  function buildHouse(v) {
    const roof = ROOFS[v % 3], st = Math.floor(v / 3) % 4;
    const P = [
      { Wx: 50, Wy: 40, H: 25, rise: 17, door: 0.5, chim: [0.2] },          // cottage
      { Wx: 46, Wy: 38, H: 38, rise: 16, door: 0.3, chim: [0.72] },         // two-storey townhouse
      { Wx: 52, Wy: 38, H: 25, rise: 16, door: 0.42, chim: [0.14, 0.62] },  // house with a side shed
      { Wx: 66, Wy: 40, H: 25, rise: 18, door: 0.5, chim: [0.12, 0.82] }    // manor with a porch
    ][st];
    const { Wx, Wy, H, rise } = P;
    const G0 = 3, ov = 3.2, mid = Wy / 2, k = rise / mid;          // footing height, eave overhang, roof pitch
    const top = G0 + H;                                              // wall top = eaves
    const doorU = Wx * P.door - (st === 1 ? 0 : 0), floorsMid = st === 1 ? G0 + H / 2 : null;
    const OX = Math.ceil(Wy + ov + 6), OY = Math.ceil(top + rise + 14);
    const Wd = OX + Math.ceil(Wx + ov + (st === 2 ? 20 : 6)) + 2;
    const Ht = OY + Math.ceil((Wx + Wy) / 2 + ov + 12);
    const zhigh = (y) => top + (mid - Math.abs(y - mid)) * k;
    const warm = (s, x, y) => q(WARM, s, x, y);
    const rx = (h) => rgbHex(h);

    // windows [u0, u1, v0, v1] per face (v measured up from the wall's base)
    const win = (a, b, c) => [a, a + 9, c, c + 9, b];
    const WA = st === 0 ? [win(6, 0, 11), win(Wx - 16, 0, 11)]
      : st === 1 ? [win(Wx * 0.5 + 2, 0, 5), win(Wx - 15, 0, 5), win(6 + Wx * 0.3, 0, 24), win(Wx - 15, 0, 24)]
        : st === 2 ? [win(5, 0, 11), win(Wx * 0.42 + 12, 0, 11)]
          : [win(6, 0, 11), win(Wx * 0.3 - 4, 0, 11), win(Wx * 0.5 + 14, 0, 11), win(Wx - 16, 0, 11)];
    const WB = st === 1 ? [win(5, 0, 5), win(Wy - 15, 0, 5), win(5, 0, 24), win(Wy - 15, 0, 24)] : [win(6, 0, 11), win(Wy - 16, 0, 11)];
    const inWin = (list, u, vv) => list.find(w => u >= w[0] && u <= w[1] && vv >= w[2] && vv <= w[3]);

    const wallTex = (face, u, vv, x, y) => {
      const len = face === 'A' ? Wx : Wy, sh = face === 'A' ? 3.5 : 2.5;
      const list = face === 'A' ? WA : WB;
      const w = inWin(list, u, vv);
      if (w) {
        const uu = u - w[0];
        if (uu < 1.6 || uu > 7.4) return q(roof, sh - 0.7 + (vv % 3 < 1 ? -0.4 : 0), x, y);   // shutters in the roof colour
        if (Math.abs(uu - 4.5) < 0.6 || Math.abs(vv - w[2] - 4.5) < 0.6) return q(WOOD, sh - 0.6, x, y);
        return warm(sh + 0.4 + (1 - (vv - w[2]) / 9) * 0.8, x, y);
      }
      // sill and flower box
      for (const w2 of list) {
        if (u >= w2[0] && u <= w2[1] && vv >= w2[2] - 3 && vv < w2[2]) {
          if (vv >= w2[2] - 1.2 && hash2(x, y) < 0.7) return rx(['#e57373', '#fff176', '#f48fb1'][(Math.floor(u) + v) % 3]);
          return vv >= w2[2] - 1.2 ? rx('#3b6b2c') : q(WOOD, sh - 0.4, x, y);
        }
      }
      if (face === 'A') {
        // door, arched on the manor
        const dw = st === 3 ? 6.5 : 5.5, dh = st === 3 ? 18 : 16;
        if (Math.abs(u - doorU) <= dw && vv <= dh) {
          const arch = st === 3 && vv > dh - 5 && Math.abs(u - doorU) > dw - 1.2 - (vv - (dh - 5)) * 0.0 && (Math.abs(u - doorU) - 1.5) > (dh - vv) * 1.2 + 0.5;
          if (!arch) {
            if (Math.abs(u - doorU) >= dw - 0.9 || vv > dh - 1) return q(WOOD, 1.5, x, y);
            if (Math.abs(u - doorU - dw * 0.6) < 0.7 && Math.abs(vv - 8) < 0.7) return q(GOLD, 4, x, y);
            return q(WOOD, 3 - (u - doorU) * 0.06 + (Math.floor(u * 0.9) % 3 === 0 ? -0.7 : 0), x, y);
          }
        }
        // door lantern
        if (Math.abs(u - (doorU + dw + 3.5)) <= 1.6 && vv >= 10 && vv <= 15) return vv > 14 || vv < 11 ? q(IRON, 3, x, y) : warm(4, x, y);
        // flower pot
        if (Math.abs(u - (doorU - dw - 4)) <= 1.8 && vv <= 4) return vv > 2.5 ? (hash2(x, y) < 0.7 ? rx(['#e57373', '#fff176'][(Math.floor(u) + v) % 2]) : q(MOSS, 3, x, y)) : q(BRICKR, 3.2, x, y);
        // manor banner
        if (st === 3 && u >= 8 && u <= 14 && vv >= 8 && vv <= 26 - (Math.abs(u - 11) < 1 ? -3 : 0)) {
          if (Math.abs(u - 11) + Math.abs(vv - 18) <= 3.5) return q(GOLD, 4.2, x, y);
          return q(CLOTH_RED, 3 - (u - 8) * 0.12 + (vv > 25 ? 1 : 0), x, y);
        }
      }
      // timber frame: end posts, intermediate posts, sill and wall-plate rails
      const post = u < 1.8 || u > len - 1.8 || (Math.floor(u) % 20 === 0 && u > 4 && u < len - 4);
      const rail = vv < 1.8 || vv > H - 2 || (floorsMid !== null && Math.abs(vv - H / 2) < 1.1);
      if (post || rail) return q(WOOD, sh - 0.5 + (vv > H - 2 ? 0.7 : 0), x, y);
      // diagonal braces low on the wall
      for (const [bu, dir] of [[2.5, 1], [len - 2.5, -1]]) {
        const t = (vv - 2) / 12;
        if (vv >= 2 && vv <= 14 && Math.abs(u - (bu + dir * t * 9)) < 1) return q(WOOD, sh - 0.9, x, y);
      }
      // ivy on the cottage
      if (st === 0 && u < 9 + 8 * hash2(Math.floor(vv / 3), face === 'A' ? 4 : 9) - vv * 0.12 && hash2(x, y) < 0.78) {
        return hash2(x * 2, y * 3) < 0.07 ? rx('#f48fb1') : q(MOSS, 1.4 + hash2(x, y + 2) * 2, x, y);
      }
      return q(PLASTER, sh - 0.2 + (hash2(Math.floor(u / 2), Math.floor(vv / 2)) - 0.5) * 0.45 - (vv < 5 ? 0.4 : 0), x, y);
    };

    const barrel = (x, y, z, cx, cy, r, h) => {
      const d = Math.hypot(x - cx, y - cy);
      if (d > r || z < 0 || z > h) return null;
      const hoop = Math.abs(z - h * 0.2) < 0.9 || Math.abs(z - h * 0.8) < 0.9;
      if (h - z < 1.2) return q(WOOD, 4.2, x, y);
      return hoop ? q(IRON, 3.4, x, y) : q(WOOD, 3.2 + ((x - cx) - (y - cy)) * -0.05 + (Math.floor((x - y) * 0.9) % 3 === 0 ? -0.5 : 0), x, y);
    };

    // what the camera meets at (x, y, z): a colour, or null for empty space
    const cast = (x, y, z) => {
      // chimneys
      for (const f of P.chim) {
        const cx0 = Wx * f;
        if (x >= cx0 && x <= cx0 + 5.5 && y >= mid - 3 && y <= mid + 2.5 && z >= top && z <= top + rise + 9) {
          if (top + rise + 9 - z < 1.5) return q(STONE, 4.4, x, y);
          const face = (cx0 + 5.5 - x) < (mid + 2.5 - y) ? 'B' : 'A';
          return bricks(BRICKR, Math.floor(face === 'A' ? x : y), Math.floor(z), face === 'A' ? 3.4 : 2.4, 3, 3);
        }
      }
      if (st === 1) { // hanging sign: an arm and a board turned to +x
        if (x >= Wx - 12 && x <= Wx - 11 && y >= Wy && y <= Wy + 9 && z >= top - 14 - G0 && z <= top - 13 - G0 + 1) return q(WOOD, 2.6, x, y);
        if (x >= Wx - 12.6 && x <= Wx - 11.4 && y >= Wy + 3 && y <= Wy + 9 && z >= top - 26 && z <= top - 15) {
          if (Math.abs(y - (Wy + 6)) + Math.abs(z - (top - 20.5)) <= 3) return q(GOLD, 4.2, x, y);
          return (y < Wy + 3.8 || y > Wy + 8.2 || z < top - 25.2 || z > top - 15.8) ? q(WOOD, 1.8, x, y) : q(PLASTER, 2.6, x, y);
        }
      }
      if (st === 2) {
        // lean-to shed on the +x side, two barrels in front of it
        const sx1 = Wx + 17, zt = G0 + 15 - (x - Wx) * 0.34;
        if (x >= Wx && x <= sx1 && y >= 6 && y <= Wy - 8 && z >= 0 && z <= zt + 2.4) {
          if (z >= zt) return q(roof, 3 - ((sx1 - x) % 3 < 1 ? 0.8 : 0) + (z > zt + 1.6 ? 0.7 : 0), x, y);
          const dB = Wy - 8 - y, dA = sx1 - x;
          return q(WOOD, dB < dA ? 2.7 : 1.9 + ((x + y) % 5 < 1 ? -0.7 : 0), x, y);
        }
        const b1 = barrel(x, y, z, Wx + 6, Wy - 3, 3.8, 9) || barrel(x, y, z, Wx + 14, Wy - 2, 3.6, 8);
        if (b1) return b1;
      }
      if (st === 3) {
        // porch: slab roof on four posts, with steps
        const px0 = Wx * 0.5 - 10, px1 = Wx * 0.5 + 10, py1 = Wy + 11;
        if (x >= px0 && x <= px1 && y >= Wy && y <= py1 && z >= G0 + 17 && z <= G0 + 20) {
          if (G0 + 20 - z < 1.2) return q(roof, 3.4, x, y);
          return q(WOOD, (py1 - y) < (px1 - x) ? 3 : 2, x, y);
        }
        for (const [qx, qy] of [[px0, Wy + 8], [px1 - 1.6, Wy + 8], [px0, Wy + 1], [px1 - 1.6, Wy + 1]]) {
          if (x >= qx && x <= qx + 1.8 && y >= qy && y <= qy + 1.8 && z >= G0 && z <= G0 + 17) return q(WOOD, 2.8, x, y);
        }
      }
      // door steps
      if (x >= doorU - 7 && x <= doorU + 7 && y >= Wy && y <= Wy + 3.2 && z >= 0 && z <= 2) return q(STONE, 4 - (Wy + 3.2 - y) * 0.2 - (2 - z) * 0.2, x, y);
      // roof: two tiled planes over a thin slab, with an overhang all round
      if (x >= -ov && x <= Wx + ov && y >= -ov && y <= Wy + ov) {
        const zh = zhigh(y);
        if (z <= zh && z >= zh - 2.6) {
          if (x > Wx + ov - 1.2 || y > Wy + ov - 1.2) return q(roof, 4, x, y); // a lit edge
          if (Math.abs(y - mid) < 1) return q(roof, 4.3, x, y);                 // ridge cap
          const front = y > mid;
          const s = (front ? Wy + ov - y : y + ov) / Math.cos(Math.atan(k));
          const course = Math.floor(s / 3.4), off = course % 2 ? 2.5 : 0;
          let sh = front ? 3.2 : 2.1;
          sh += (hash2(Math.floor((x + off) / 3), course) - 0.5) * 0.5 - (s % 3.4 > 2.5 ? 0.9 : 0) - (course % 2 ? 0.3 : 0);
          if (hash2(Math.floor(x / 7), course) < 0.06) sh += 1;
          if (front && s < 3 && hash2(x, Math.floor(y)) < 0.25) return q(MOSS, 2 + hash2(x, y), x, y);
          return q(roof, sh, x, y);
        }
      }
      // the gable triangle under the roof, plaster with a round attic window
      if (x >= 0 && x <= Wx && y >= 0 && y <= Wy && z >= top && z <= zhigh(y) - 2.6 + 0.01) {
        const u = y, vv = z - top;
        if (Math.hypot(u - mid, vv - rise * 0.38) < 3) return Math.hypot(u - mid, vv - rise * 0.38) < 2 ? warm(3.6, x, y) : q(WOOD, 3, x, y);
        return q(PLASTER, 2.2 + (hash2(Math.floor(u / 2), Math.floor(z / 2)) - 0.5) * 0.4, x, y);
      }
      // walls
      if (x >= 0 && x <= Wx && y >= 0 && y <= Wy && z >= G0 && z <= top) {
        const dA = Wy - y, dB = Wx - x;
        return dA < dB ? wallTex('A', x, z - G0, x, y) : wallTex('B', y, z - G0, x, y);
      }
      // footing
      if (x >= -1.6 && x <= Wx + 1.6 && y >= -1.6 && y <= Wy + 1.6 && z >= 0 && z <= G0) {
        const dA = Wy + 1.6 - y, dB = Wx + 1.6 - x, dT = G0 - z;
        return q(STONE, dT < Math.min(dA, dB) ? 3.8 : dA < dB ? 3.2 : 2.2, x, y);
      }
      return null;
    };

    const img = paint(Wd, Ht, (px, py) => {
      const sx = px - OX, sy = py - OY;
      const zMax = top + rise + 10;
      const hi = Math.min(zMax - sx / 2 + sy, Wx + ov + 20 - sx, Wy + ov + 12);
      const lo = Math.max(sy - sx / 2 - 0.5, -ov - sx, -ov);
      for (let t = hi; t >= lo; t -= 0.5) {
        const c = cast(sx + t, t, sx / 2 + t - sy);
        if (c) return c;
      }
      return null;
    }, '#16110c', null);
    // the footprint's centre on the ground is where the obstacle stands
    return { img, ax: Math.round(OX + (Wx - Wy) / 2), ay: Math.round(OY + (Wx + Wy) / 4) };
  }

  const TOWN = {
    house(v) { return buildHouse(v); },

    gate_tower() {
      const W = 38, H = 88, cx = 18.5;
      const img = paint(W, H, (x, y) => {
        const dx = x - cx;
        if (y >= 10 && y <= 15 && Math.abs(dx) <= 17.5 && (x % 8) < 5) return q(KEEP, 4.4 - dx * 0.05 + (y === 10 ? 1 : 0), x, y); // merlons
        if (y >= 16 && y <= 20 && Math.abs(dx) <= 17.5) return q(KEEP, 4 - dx * 0.04 + (y === 16 ? 0.8 : -0.6 * (y === 20)), x, y);   // parapet
        if (y >= 21 && y <= 80 && Math.abs(dx) <= 14.5) {
          // arrow slits
          if (Math.abs(dx + 0.5) <= 1 && ((y >= 38 && y <= 46) || (y >= 62 && y <= 70))) return q(KEEP, 0, x, y);
          // banner
          if (Math.abs(dx) <= 6.5 && y >= 26 && y <= 52 - (Math.abs(dx) <= 1.5 ? -3 : 0) + (Math.abs(dx) > 4 ? -1 : 0)) {
            if (Math.abs(dx + 0.5) + Math.abs(y - 38) <= 4.5) return q(GOLD, 4.2 - (dx * 0.15), x, y);
            return q(CLOTH_RED, 3 - dx * 0.12 + (y === 26 ? 1 : 0), x, y);
          }
          const band = y % 18 === 0 ? -0.8 : 0;
          return bricks(KEEP, x, y, 3.2 - dx * 0.09 + band, 6, 4);
        }
        if (y >= 81 && y <= 85 && Math.abs(dx) <= 16.5) return q(KEEP, 2.4 + (y === 81 ? 0.8 : -0.3), x, y);
        return null;
      }, '#0c0e12', { cx: 19, cy: 85, rx: 17, ry: 4 });
      return { img, ax: 19, ay: 85 };
    },

    corner_keep() {
      const W = 44, H = 112, cx = 21.5;
      const img = paint(W, H, (x, y) => {
        const dx = x - cx;
        if (y >= 14 && y <= 40) {
          // the conical slate roof, with a flagpole through the tip
          const half = (y - 14) * 0.7 + 0.4;
          if (Math.abs(dx) <= half) {
            const course = Math.floor((y - 14) / 3);
            return q(SLATEROOF, 3 - dx * 0.11 - (course % 2 ? 0.5 : 0) + (y >= 38 ? -1 : 0) + (Math.abs(dx) >= half - 1 ? 0.7 : 0), x, y);
          }
        }
        if (y >= 0 && y <= 14 && Math.abs(dx + 0.5) <= 0.6) return q(WOOD, 2.4, x, y);
        if (y >= 1 && y <= 6 && x >= cx + 1 && x <= cx + 10 - (y - 1) * 0.4) return q(CLOTH_RED, 3.2 + (y === 1 ? 0.8 : 0), x, y);
        if (y >= 41 && y <= 47 && Math.abs(dx) <= 19.5) { // machicolated rim
          if (y <= 43 && (x % 7) > 3) return null;
          return q(KEEP, 4.2 - dx * 0.07 + (y === 41 ? 0.8 : 0), x, y);
        }
        if (y >= 48 && y <= 100 && Math.abs(dx) <= 16.5) {
          if (Math.abs(dx - 3) <= 1 && ((y >= 60 && y <= 69) || (y >= 80 && y <= 89))) return q(KEEP, 0, x, y);
          return bricks(KEEP, x, y, 3.9 - dx * 0.16 - (y % 20 === 0 ? 0.7 : 0), 6, 4);
        }
        if (y >= 101 && y <= 106 && Math.abs(dx) <= 18.5) return q(KEEP, 2.6 + (y === 101 ? 0.8 : -0.3), x, y);
        return null;
      }, '#0c0e12', { cx: 22, cy: 106, rx: 21, ry: 5 });
      return { img, ax: 22, ay: 106 };
    },

    lamp_post() {
      const W = 18, H = 52, cx = 8.5;
      const img = paint(W, H, (x, y) => {
        const dx = x - cx;
        if (y >= 3 && y <= 4 && Math.abs(dx) <= 5) return q(IRON, 4, x, y);                         // cap
        if (y >= 5 && y <= 7 && Math.abs(dx) <= 3 - (y - 5) * 0.2) return q(IRON, 3, x, y);
        if (y >= 8 && y <= 19 && Math.abs(dx) <= 5) {                                              // lantern box
          if (Math.abs(dx) >= 4.5 || y === 19) return q(IRON, 3.4 - dx * 0.2, x, y);
          return q(WARM, 3.4 + (1 - Math.abs(dx) / 5) * 1.2, x, y);
        }
        if (y >= 20 && y <= 22 && Math.abs(dx) <= 4) return q(IRON, 3 - dx * 0.2, x, y);
        if (y >= 23 && y <= 44 && Math.abs(dx) <= 1.2) return q(IRON, 3 - dx * 1.2, x, y);         // post
        if (y >= 38 && y <= 40 && Math.abs(dx) <= 2.6) return q(IRON, 3.6, x, y);
        if (y >= 45 && y <= 48 && Math.abs(dx) <= 4.6 - (48 - y) * 0.4) return q(STONE, 3 - dx * 0.2, x, y);
        return null;
      }, '#08080a', { cx: 9, cy: 47, rx: 7, ry: 2.5 });
      return { img, ax: 9, ay: 47, flameY: 12 };
    },

    crates(v) {
      const W = 38, H = 32;
      const crate = (x, y, x0, y0, s, sh) => {
        if (x < x0 || x >= x0 + s || y < y0 || y >= y0 + s) return null;
        const lx = x - x0, ly = y - y0;
        if (lx <= 1 || lx >= s - 2 || ly <= 1 || ly >= s - 2) return q(WOOD, 3.4 + sh - lx * 0.03, x, y);   // frame
        if (Math.abs(lx - ly) <= 1 || Math.abs(lx - (s - 1 - ly)) <= 1) return q(WOOD, 2.2 + sh, x, y);     // cross brace
        return q(WOOD, 3 + sh - (lx / s) * 0.6 + (ly % 4 === 0 ? -0.5 : 0), x, y);
      };
      const img = paint(W, H, (x, y) => {
        if (v % 2 === 0) {
          return crate(x, y, 14, 4, 15, 0.3) || crate(x, y, 1, 14, 16, 0) || crate(x, y, 20, 17, 14, -0.3);
        }
        // a barrel and a sack-topped crate
        const dx = x - 11;
        if (y >= 8 && y <= 28 && Math.abs(dx) <= 8 - Math.abs(18 - y) * 0.05 * 1.4) {
          const hoop = y === 11 || y === 12 || y === 24 || y === 25;
          const stave = (x % 3) === 0 ? -0.5 : 0;
          if (y <= 9) return q(WOOD, 4.4 - dx * 0.1, x, y);
          return hoop ? q(IRON, 3.4, x, y) : q(WOOD, 3.2 - dx * 0.14 + stave, x, y);
        }
        return crate(x, y, 19, 13, 17, 0.1) || (ell2(x, y, 27.5, 11, 8, 5) <= 1 && y < 14 ? q(PLASTER, 2.4 + (11 - y) * 0.12 - (x - 20) * 0.04, x, y) : null);
      }, '#16110c', { cx: 19, cy: 29, rx: 18, ry: 3.5 });
      return { img, ax: 19, ay: 29 };
    },

    flower_bed(v) {
      const W = 34, H = 20;
      const pal = [['#e57373', '#fff176', '#f48fb1'], ['#ba68c8', '#fff59d', '#81d4fa'], ['#ffb74d', '#e57373', '#ffffff']][v % 3];
      const img = paint(W, H, (x, y) => {
        const e = ell2(x, y, 17, 12, 16, 6.2);
        if (e > 1) return null;
        if (e > 0.62) return q(STONE, 4.2 - (x - 17) * 0.05 - (y > 12 ? 1 : 0), x, y);                 // stone kerb
        const bloom = hash2(x * 3 + v, y * 5) < 0.34 && y < 15;
        if (bloom) return rgbHex(pal[Math.floor(hash2(x, y + v) * 3)]);
        if (hash2(x, y * 2) < 0.7 && y < 15) return q(MOSS, 2.4 + hash2(x + 1, y) * 1.6, x, y);     // leaves
        return q(BARK, 1.6 + (y - 8) * 0.1, x, y);                                                      // soil
      }, '#141820', { cx: 17, cy: 15, rx: 16, ry: 4 });
      return { img, ax: 17, ay: 14 };
    },

    bench() {
      const W = 36, H = 24;
      const img = paint(W, H, (x, y) => {
        if (y >= 4 && y <= 12 && x >= 3 && x <= 32) {                              // backrest planks
          if (y === 7 || y === 8) return q(WOOD, 1.6, x, y);
          return q(WOOD, 3.6 - (x - 3) * 0.02 + (y === 4 ? 0.7 : 0), x, y);
        }
        if (y >= 13 && y <= 17 && x >= 1 && x <= 34) return q(WOOD, 3.4 + (y === 13 ? 0.9 : -0.3) - (x - 1) * 0.02, x, y); // seat
        if (y >= 18 && y <= 22 && ((x >= 4 && x <= 6) || (x >= 29 && x <= 31))) return q(IRON, 2.8 - (x % 3) * 0.3, x, y);   // legs
        if (y >= 4 && y <= 17 && (x === 3 || x === 4 || x === 31 || x === 32)) return q(IRON, 3.2, x, y);
        return null;
      }, '#0e0a06', { cx: 18, cy: 21, rx: 17, ry: 3 });
      return { img, ax: 18, ay: 21 };
    },

    well() {
      const W = 44, H = 56, cx = 21.5;
      const img = paint(W, H, (x, y) => {
        const dx = x - cx;
        // little pitched roof
        if (y >= 3 && y <= 17 && Math.abs(dx) <= (y - 3) * 1.45 + 1) return q(ROOFS[0], 3 - dx * 0.05 - ((y - 3) % 4 === 3 ? 0.9 : 0) + (y >= 16 ? -0.8 : 0), x, y);
        // posts
        if (y >= 17 && y <= 38 && (Math.abs(dx + 13) <= 1.4 || Math.abs(dx - 13) <= 1.4)) return q(WOOD, 3 - (dx < 0 ? 0 : 0.8), x, y);
        // windlass beam, rope and bucket
        if (y >= 21 && y <= 23 && Math.abs(dx) <= 14) return q(WOOD, 3.8, x, y);
        if (y >= 24 && y <= 31 && Math.abs(dx - 1) <= 0.5) return q(PLASTER, 1.5, x, y);
        if (y >= 32 && y <= 37 && Math.abs(dx - 1) <= 3.2 - (37 - y) * 0.08) return q(WOOD, 3 - (dx - 1) * 0.2 + (y === 34 ? -1 : 0), x, y);
        // stone ring
        const e = ell2(x, y, cx + 0.5, 44, 17, 7);
        if (y >= 38 && y <= 52 && e <= 1) {
          if (y <= 44 && ell2(x, y, cx + 0.5, 43.4, 13, 4.8) <= 1) return q(WATER, 1.6 + (1 - ell2(x, y, cx + 0.5, 43.4, 13, 4.8)) * 1.6, x, y); // dark water
          return bricks(STONE, x, y, 3.8 - dx * 0.08 - (y > 45 ? 0.9 : 0), 6, 4);
        }
        return null;
      }, '#141820', { cx: 22, cy: 51, rx: 19, ry: 5 });
      return { img, ax: 22, ay: 50 };
    }
  };

  // ---- Vendor stalls and booths, in the same isometric projection as the houses.
  // Two layers per booth: `img` is everything behind the shopkeeper (posts, canopy, back
  // wall, furnace), `front` the counter / anvil that is painted over them. Both are ray-cast
  // from one small 3D model (screen x = x - y, screen y = (x + y) / 2 - z).
  function rayImage(M, layer) {
    return paint(M.Wd, M.Ht, (px, py) => {
      const sx = px - M.OX, sy = py - M.OY;
      const hi = Math.min(M.zMax - sx / 2 + sy, M.xMax - sx, M.yMax);
      const lo = Math.max(sy - sx / 2 - 0.5, -M.ov - sx, -M.ov);
      for (let t = hi; t >= lo; t -= 0.5) {
        const c = M.cast(layer, sx + t, t, sx / 2 + t - sy);
        if (c) return c;
      }
      return null;
    }, '#12100c', layer === 'back' ? M.shadow : null);
  }
  // nearest face of a box a point just entered: 'x' (+x, right on screen), 'y' (+y, left) or 'z' (top)
  const faceOf = (x, y, z, b) => {
    const dx = b[1] - x, dy = b[3] - y, dz = b[5] - z;
    return dz <= dx && dz <= dy ? 'z' : dy <= dx ? 'y' : 'x';
  };
  const inBox = (x, y, z, b) => x >= b[0] && x <= b[1] && y >= b[2] && y <= b[3] && z >= b[4] && z <= b[5];

  function boothModel(kind, v, facing = '+y') {
    // The model is built facing +y (counter on the +y side). 'facing' turns it by a quarter turn
    // steps: the camera ray is carried into the model's own axes, so the faces the camera sees
    // (and which one is lit) follow the turn.
    const north = false;
    const nearCounter = facing === '+y' || facing === '+x';
    const FACE = {
      '+y': { dx: 1, dy: 1 }, '+x': { dx: -1, dy: 1 }, '-x': { dx: 1, dy: -1 }, '-y': { dx: -1, dy: -1 }
    }[facing];
    let hitFront = false; // did the last faceOf call land on the model's own +y (front) face?
    const faceOf = (x, y, z, b) => {
      const ex = FACE.dx > 0 ? b[1] - x : x - b[0], ey = FACE.dy > 0 ? b[3] - y : y - b[2], ez = b[5] - z;
      if (ez <= ex && ez <= ey) { hitFront = false; return 'z'; }
      const axis = ey <= ex ? 'y' : 'x';
      hitFront = axis === 'y' && FACE.dy > 0;
      // lit class by the face's real direction on screen: 'y' = left (bright), 'x' = right (dark)
      return (facing === '+y' || facing === '-y') ? axis : (axis === 'y' ? 'x' : 'y');
    };
    const AW = kind === 'enchanter' ? ['#5b21b6', '#e9d5ff'] : AWNINGS[(kind === 'merchant' ? 0 : v) % 4];
    const sA = rgbHex(AW[0]), sB = rgbHex(AW[1]);
    const shade = (c, f) => [Math.min(255, c[0] * f) | 0, Math.min(255, c[1] * f) | 0, Math.min(255, c[2] * f) | 0];
    const G0 = 2, ov = 2;
    const Wx = kind === 'merchant' ? 40 : kind === 'stall' ? 36 : 36;
    const Wy = kind === 'blacksmith' ? 28 : kind === 'enchanter' ? 28 : 26;
    const tentRise = 17, tentBase = G0 + 12, mid = Wy / 2;
    const zawn = (y) => G0 + (kind === 'blacksmith' ? 31 : 29) - y * (kind === 'blacksmith' ? 0.3 : 0.28);
    const zTent = (y) => tentBase + (mid - Math.abs(y - mid)) * (tentRise / mid);
    const zTop = G0 + 44 + 4;
    const sideways = facing === '+x' || facing === '-x';
    const WXw = sideways ? Wy : Wx, WYw = sideways ? Wx : Wy, PAD = 16;     // footprint on the ground, in world axes
    const OX = Math.ceil(WYw + PAD + 4), OY = Math.ceil(zTop + 6);
    const Wd = OX + WXw + PAD + 4, Ht = OY + Math.ceil((WXw + WYw) / 2 + PAD + 6);
    // world ground point -> the model's own axes
    const toLocal = (X, Y) => facing === '+y' ? [X, Y] : facing === '+x' ? [Wx - Y, X] : facing === '-x' ? [Y, Wy - X] : [Wx - X, Wy - Y];
    const cnt = [1, Wx - 1, Wy - 7, Wy - 1, G0, G0 + 12];
    const wares = (x, y, z) => {                              // produce, bottles and crystals on the counter top
      const cy0 = Wy - 6;
      if (z < G0 + 12 || z > G0 + 17 || y < cy0 || y > cy0 + 5) return null;
      const cell = Math.floor((x - 3) / 5.4), lx = (x - 3) - cell * 5.4;
      if (cell < 0 || cell > 5 || lx > 3.6 || hash2(cell, v + 3) < 0.28) return null;
      const h = 2.6 + hash2(cell, 9) * 2.6;
      if (z > G0 + 12 + h) return null;
      if (kind === 'enchanter') return q(ARCANE, 4.2 + hash2(cell, 5) * 1.2 - (z - G0 - 12) * 0.2, x, y);
      const cols = ['#e25a5a', '#f0c24a', '#7bc96f', '#4aa3df', '#e8dcc0'];
      const c = rgbHex(cols[Math.floor(hash2(cell, v + 7) * cols.length)]);
      return shade(c, 0.78 + (z - G0 - 12) / h * 0.3 + (hash2(Math.floor(x), Math.floor(y)) - 0.5) * 0.1);
    };
    const counter = (x, y, z) => {
      if (!inBox(x, y, z, cnt)) return wares(x, y, z);
      const f = faceOf(x, y, z, cnt), vv = z - G0;
      if (f === 'z') return q(WOOD, 4.4, x, y);
      if (kind === 'enchanter' && vv > 3 && vv < 8 && hitFront) return q(ARCANE, 3.2 + ((Math.floor(x) % 6 === 0) ? 1.4 : 0), x, y);
      if (vv > 4 && vv < 9 && kind !== 'blacksmith' && hitFront) return Math.floor((x - 1) / 5) % 2 ? sB : sA;      // a striped cloth hangs on the front
      if (vv > 4 && vv < 9 && kind !== 'blacksmith' && !hitFront) return shade(Math.floor((y - 1) / 5) % 2 ? sB : sA, 0.7);
      return q(WOOD, (f === 'y' ? 3 : 2.1) + ((Math.floor(f === 'y' ? x : y) % 6 === 0) ? -0.8 : 0) + (vv < 1.5 ? -0.7 : 0), x, y);
    };
    const post = (x, y, z, px0, py0) => x >= px0 && x <= px0 + 2 && y >= py0 && y <= py0 + 2 && z >= G0;
    const bottleCols = ['#4aa3df', '#e25a5a', '#7bc96f', '#f0c24a'];

    // A stall turned to face away from the camera (south of the road) shows us its back wall, so
    // there it is a low shelf painted over the keeper, who stays in view above it
    const lowWall = kind === 'stall' && !nearCounter;
    const backWall = [0, Wx, 0, 2.6, G0, G0 + (lowWall ? 9 : 24)];
    // posts and the sloped striped awning (with scalloped fringe). Merchant and smithy roofs only cover the back half.
    const shortRoof = true;   // every roof covers only the back half, so counters and wares stay in view
    const aLim = shortRoof ? 15 : Wy + ov + 2;
    const canopy = (x, y, z) => {
      const fy = shortRoof ? 13 : Wy - 2;
      for (const [px0, py0] of [[0, 0], [Wx - 2, 0], [0, fy], [Wx - 2, fy]]) {
        if (post(x, y, z, px0, py0) && z <= zawn(shortRoof ? py0 : 0)) return q(WOOD, py0 + px0 > 0 ? 2.6 : 2.2, x, y);
      }
      if (x >= -ov && x <= Wx + ov && y >= -ov && y <= aLim) {
        const za = zawn(y);
        if (z <= za && z >= za - 1.8) {
          if (kind === 'blacksmith') {
            const s2 = Math.floor((15 - y) / 3.4);
            return q(ROOFS[0], 2.8 + (s2 % 2 ? -0.5 : 0) + (hash2(Math.floor(x / 3), s2) - 0.5) * 0.5 - ((15 - y) % 3.4 > 2.5 ? 0.8 : 0) + (y > 14 ? 0.8 : 0), x, y);
          }
          if (y > aLim - 0.5 && Math.floor(x / 3) % 2 === 0) return null;                      // scallops
          const stripe = Math.floor((x + ov) / 5) % 2 ? sB : sA;
          if (x > Wx + ov - 1.2) return shade(stripe, 0.7);
          return shade(stripe, (y > Wy ? 0.82 : 1) * (0.92 + (hash2(Math.floor(x), Math.floor(y)) - 0.5) * 0.06));
        }
      }
      return null;
    };
    const castLocal = (layer, x, y, z) => {
      if (layer === 'front') {
        if (kind === 'blacksmith') {
          // anvil on a stump, and a water trough
          const sx0 = Wx - 12, sy0 = Wy - 11;
          if (Math.hypot(x - (sx0 + 4), y - (sy0 + 3)) < 4.2 && z >= G0 && z <= G0 + 8) return q(WOOD, 3.2 - (x - sx0) * 0.1, x, y);
          if (x >= sx0 - 2 && x <= sx0 + 10 && y >= sy0 + 1.2 && y <= sy0 + 4.8 && z >= G0 + 8 && z <= G0 + 12) {
            return z > G0 + 11 ? q(IRON, 4.4, x, y) : q(IRON, (sy0 + 4.8 - y) < (sx0 + 10 - x) ? 3.2 : 2.2, x, y);
          }
          const tr = [2, 15, Wy - 8, Wy - 1, G0, G0 + 6];
          if (inBox(x, y, z, tr)) { const f = faceOf(x, y, z, tr); return f === 'z' ? (hash2(Math.floor(x / 2), Math.floor(y / 2)) < 0.15 ? q(WATER, 5, x, y) : q(WATER, 3.2, x, y)) : q(WOOD, f === 'y' ? 3 : 2, x, y); }
          return null;
        }
        // a counter on the near side is painted over the keeper; on the far side it belongs behind them
        const cc = nearCounter ? counter(x, y, z) : null;
        if (cc) return cc;
        if (lowWall) { const w = wallAt(x, y, z); if (w) return w; }
        return (kind === 'stall' || kind === 'enchanter') ? canopy(x, y, z) : null;
      }
      // ---- back layer
      if (!nearCounter && kind !== 'blacksmith' && kind !== 'merchant') { const c = counter(x, y, z); if (c) return c; }
      if (kind === 'merchant') { // crates beside the counter and a signboard on a post
        const cr = [Wx + 1, Wx + 9, Wy - 9, Wy - 1, G0, G0 + 8];
        if (inBox(x, y, z, cr)) { const f = faceOf(x, y, z, cr); return q(WOOD, f === 'z' ? 4.2 : f === 'y' ? 3.1 : 2.1, x, y); }
        if (x >= Wx + 3 && x <= Wx + 4 && y >= Wy + 3 && y <= Wy + 4 && z >= G0 && z <= G0 + 36) return q(WOOD, 2.4, x, y);
        if (x >= Wx + 2.4 && x <= Wx + 4.6 && y >= Wy + 0.5 && y <= Wy + 7 && z >= G0 + 26 && z <= G0 + 36) {
          return Math.hypot(y - (Wy + 3.8), z - (G0 + 31)) < 2.6 ? q(GOLD, 4.4, x, y) : q(WOOD, 2.2, x, y);
        }
      }
      if (kind === 'blacksmith') {
        const fz = G0 + 27, furn = [6, 24, 0, 11, G0, fz], flue = [11, 19, 2.4, 8.6, fz, G0 + 46];
        if (inBox(x, y, z, flue)) { const f = faceOf(x, y, z, flue); return f === 'z' ? q(STONE, 4.4, x, y) : bricks(BRICKR, Math.floor(f === 'y' ? x : y), Math.floor(z), f === 'y' ? 3.2 : 2.3, 4, 3); }
        if (inBox(x, y, z, furn)) {
          const f = faceOf(x, y, z, furn);
          if (hitFront && x >= 10 && x <= 20 && z >= G0 + 4 && z <= G0 + 15) { // the glowing mouth
            const heat = 3.4 + Math.sin(x * 1.3 + z * 0.9) * 0.5 + (1 - Math.abs(x - 15) / 5);
            return z < G0 + 9 ? q(EMBER, heat, x, y) : q(EMBER, heat * 0.55, x, y);
          }
          return f === 'z' ? q(STONE, 4, x, y) : bricks(BRICKR, Math.floor(f === 'y' ? x : y), Math.floor(z), f === 'y' ? 3.3 : 2.3, 6, 4);
        }
      }
      // merchant and smithy roofs live in the back layer (they only shade the back); the stall and
      // Valka's canopy hang over the keeper, so they are painted in the front layer
      if (kind === 'merchant' || kind === 'blacksmith') { const c = canopy(x, y, z); if (c) return c; }
      if (kind === 'enchanter') {
        // rune altar with a floating crystal, behind her
        const ax0 = Wx * 0.5 - 7;
        if (x >= ax0 && x <= ax0 + 14 && y >= 4 && y <= 13 && z >= G0 && z <= G0 + 8) {
          return z > G0 + 7 ? q(STONE, 3.4, x, y) : q(STONE, ((x - ax0) > (13 - y) ? 3.2 : 2.2), x, y);
        }
        const cz = G0 + 18 + Math.sin(0) * 2;
        if (Math.abs(x - (ax0 + 7)) + Math.abs(y - 8.5) + Math.abs(z - cz) * 0.7 <= 5.5) {
          return q(ARCANE, 4.6 + (z - cz) * 0.18 + (x < ax0 + 7 ? 0.3 : -0.2), x, y);
        }
      }
      if (kind !== 'blacksmith' && !lowWall) { const w = wallAt(x, y, z); if (w) return w; }
      return null;
    };
    // back wall: shelves of bottles and sacks
    function wallAt(x, y, z) {
      if (inBox(x, y, z, backWall)) {
        const f = faceOf(x, y, z, backWall), vv = z - G0;
        if (!hitFront && f !== 'z') return q(WOOD, 1.8, x, y);   // its back, or its side
        if (kind === 'enchanter' && f !== 'z') return q(ARCANE, 1.6 + (Math.floor(x / 4) % 2 ? 0.6 : 0) + (z - G0 > 20 ? 1 : 0), x, y);
        if (f === 'z') return q(WOOD, 2.6, x, y);
        if (Math.abs(vv - 9) < 1 || Math.abs(vv - 17) < 1 || vv > 23) return q(WOOD, 3, x, y);
        const cell = Math.floor((x - 1) / 4);
        if (hash2(cell, vv < 9 ? 3 : 4) < 0.62 && (x - 1) % 4 < 3) {
          const c = vv < 9 ? rgbHex('#c9b48a') : rgbHex(bottleCols[Math.floor(hash2(cell, 6) * 4)]);
          return shade(c, 0.85 + (x % 4) * 0.05);
        }
        return q(WOOD, 1.1 + (hash2(Math.floor(x), Math.floor(vv)) * 0.3), x, y);
      }
      return null;
    }
    const cast = (layer, X, Y, z) => { const [lx, ly] = toLocal(X, Y); return castLocal(layer, lx, ly, z); };
    return {
      Wd, Ht, OX, OY, ov: PAD, cast, zMax: zTop, xMax: WXw + PAD, yMax: WYw + PAD,
      shadow: { cx: OX + (WXw - WYw) / 2, cy: OY + (WXw + WYw) / 4 + 2, rx: (WXw + WYw) / 2 + 3, ry: 6 },
      ax: Math.round(OX + (WXw - WYw) / 2), ay: Math.round(OY + (WXw + WYw) / 4)
    };
  }
  function booth(kind, v, facing) {
    const M = boothModel(kind, v, facing);
    return { img: rayImage(M, 'back'), front: rayImage(M, 'front'), ax: M.ax, ay: M.ay };
  }
  // facings follow the 3D models: Olaf and Brom open toward +x, Valka's tent toward the fountain (-x),
  // market stalls toward the road (+y, or -y for the stalls south of it: variants 4+)
  TOWN.merchant = (v) => booth('merchant', v, '+x');
  TOWN.blacksmith = (v) => booth('blacksmith', v, '+x');
  TOWN.enchanter = (v) => booth('enchanter', v, '-x');
  TOWN.market_stall = (v) => booth('stall', v, v >= 4 ? '-y' : '+y');
  Object.assign(BUILD, TOWN);
  // these read obs.variant as is (awning colours, house roofs) instead of a 0-2 hash
  const RAW_VARIANT = new Set(['house', 'crates', 'flower_bed', 'market_stall']);

  const cache = new Map();
  function sprite(type, variant = 0) {
    const key = `${type}|${variant}`;
    if (!cache.has(key)) cache.set(key, BUILD[type] ? BUILD[type](RAW_VARIANT.has(type) ? variant : variant % 3) : null);
    return cache.get(key);
  }

  // Flame frames for torches and braziers, coloured from three CSS colours
  // (outer, mid, inner) so dungeon themes can tint them.
  const cssRgb = (c) => {
    const m = String(c).match(/(\d+)\D+(\d+)\D+(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : [249, 115, 22];
  };
  const flameCache = new Map();
  function flame(frame, outer, mid, inner) {
    const key = `${frame & 3}|${outer}|${mid}|${inner}`;
    if (flameCache.has(key)) return flameCache.get(key);
    const O = cssRgb(outer), Mi = cssRgb(mid), I = cssRgb(inner);
    const R = [O.map(v => Math.round(v * 0.55)), O, Mi, I, [255, 255, 245]];
    const W = 13, H = 20, f = frame & 3;
    const img = paint(W, H, (x, y) => {
      const t = (H - 1 - y) / (H - 1);
      const sway = Math.round(Math.sin(f * 1.6 + t * 4) * t * 2);
      const half = 5.6 * Math.pow(1 - t, 0.8) * (0.85 + 0.15 * Math.sin(f * 2.3 + y));
      const dx = x - 6 - sway;
      if (Math.abs(dx) > half || (t > 0.92 && hash2(x, f) < 0.5)) return null;
      // stray tongue licks off the top now and then
      const heat = (1 - t) * 0.9 + (1 - Math.abs(dx) / (half + 0.5)) * 0.9;
      return R[Math.max(0, Math.min(4, Math.round(heat * 2.4 - 0.2)))];
    }, null, null);
    flameCache.set(key, img);
    return img;
  }

  window.PixelProps = {
    TYPES: new Set(Object.keys(BUILD)),
    sprite, flame, hash2, WATER, isoTree, portalGate, caveMouth
  };

  // The 3D props take a few ms each to ray-cast (oaks ~80 ms): build them one
  // at a time while the browser is idle, so the first sight of one never hitches
  const warm = [];
  for (const t of Object.keys(ISO)) for (let v = 0; v < 3; v++) warm.push(() => sprite(t, v));
  for (const t of ['oak_tree', 'pine_tree']) for (let v = 0; v < 3; v++) warm.push(() => isoTree(t, v));
  const idle = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 200));
  const step = (dl) => {
    while (warm.length && dl.timeRemaining() > 4) warm.shift()();
    if (warm.length) idle(step);
  };
  idle(step);
})();
