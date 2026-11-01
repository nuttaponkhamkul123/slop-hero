// Slop Hero - SP card wings. A transformed hero grows a pair of wings whose
// style changes with every +10 the card has been upgraded (tiers 1-10), drawn
// in the card's colour as pixel art on the hero sprite's own pixel grid.
// Each style is rasterised once per colour and flap frame, then cached.
(function (root) {
  'use strict';

  const W = 120, H = 76;          // sprite size (art pixels)
  const RX = 60, RY = 36;         // wing root (between the shoulder blades)
  const FRAMES = 8;               // flap cycle
  const TIERS = 10;

  // ---------------------------------------------------------------- colour
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t));
  const BLACK = [0, 0, 0], WHITE = [255, 255, 255];
  const mat = (o, d, m, l, h) => ({ o, d, m, l, h: h || l });
  // material ramps derived from the card colour
  function palette(hex) {
    const c = hexRgb(hex || '#a855f7');
    return {
      card: mat(mix(c, BLACK, 0.82), mix(c, BLACK, 0.5), c, mix(c, WHITE, 0.45), mix(c, WHITE, 0.8)),
      deep: mat(mix(c, BLACK, 0.9), mix(c, BLACK, 0.78), mix(c, BLACK, 0.62), mix(c, BLACK, 0.4), mix(c, BLACK, 0.2)),
      plume: mat(mix(c, BLACK, 0.75), mix([200, 206, 222], c, 0.3), mix([234, 238, 246], c, 0.14), [255, 255, 255], [255, 255, 255]),
      glow: mat(mix(c, WHITE, 0.2), mix(c, WHITE, 0.15), mix(c, WHITE, 0.4), mix(c, WHITE, 0.75), [255, 255, 255]),
      gold: mat([58, 36, 5], [168, 116, 26], [227, 177, 58], [253, 230, 138], [255, 251, 224]),
      steel: mat([20, 24, 33], [77, 88, 102], [143, 156, 171], [212, 219, 227], [255, 255, 255]),
      bone: mat(mix(c, BLACK, 0.85), [52, 46, 60], [84, 76, 96], [120, 110, 136])
    };
  }

  // ---------------------------------------------------------------- shapes
  // Wing space: x outward from the root, y up. A shape's test returns
  // [t, s] (t: 0 root .. 1 tip, s: -1 lower edge .. 1 upper edge) or null.
  const rad = d => d * Math.PI / 180;
  const dir = a => [Math.cos(rad(a)), Math.sin(rad(a))];
  const add = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k];

  // Tapered quill from a to b, rounded at the root and pointed (pinch) at the tip
  function quill(a, b, w0, w1, wave) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-6, len = Math.sqrt(l2);
    return (x, y) => {
      const t = ((x - a[0]) * dx + (y - a[1]) * dy) / l2;
      if (t < -w0 / len || t > 1) return null;
      const tc = Math.max(0, t);
      const off = ((x - a[0]) * -dy + (y - a[1]) * dx) / len - (wave ? wave(tc) : 0);
      const w = w0 + (w1 - w0) * tc;
      const ex = t < 0 ? Math.hypot(x - a[0], y - a[1]) : Math.abs(off);
      if (ex > (t < 0 ? w0 : w)) return null;
      return [tc, Math.max(-1, Math.min(1, off / (w || 1)))];
    };
  }

  function polygon(pts) {
    return (x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
      return inside ? [Math.min(1, Math.hypot(x, y) / 40), 0] : null;
    };
  }

  // The wing's arm curves: steep off the shoulder, flattening toward the wrist
  const BEND = 18;
  const boneAt = (bone, ang, u) => add([0, 0], dir(ang + BEND * (1 - u)), bone * u);

  // A row of feathers hanging off the arm. Angles run from the inner feather to
  // the outer one, and the outer flight feathers are lifted (o.lift, degrees) so
  // the wingtips rise
  // o: { bone, boneAng, n, len: [inner, outer], ang: [inner, outer], w, from, gap, wave, lift }
  function featherRow(o, m, extra) {
    const lift = o.lift === undefined ? 30 : o.lift;
    const from = o.from || 0.2;
    const parts = [];
    for (let i = o.n - 1; i >= 0; i--) {         // tip feathers first, inner ones overlap them
      const u = o.n === 1 ? 1 : i / (o.n - 1);
      const a = o.ang[0] + (o.ang[1] + lift - o.ang[0]) * u;
      const base = add(boneAt(o.bone, o.boneAng, from + (1 - from) * u), dir(a), o.gap || 0);
      const len = o.len[0] + (o.len[1] - o.len[0]) * u;
      const tip = add(base, dir(a), len);
      parts.push(Object.assign({ test: quill(base, tip, o.w, o.w * (o.tipW || 0.3), o.wave ? o.wave(i) : null), m }, extra));
    }
    return parts;
  }

  // The arm of the wing: a thick capsule following the curved bone
  const arm = (bone, ang, w, m) => {
    const p0 = [0, 0], p1 = boneAt(bone, ang, 0.5), p2 = boneAt(bone, ang, 1);
    const a = quill(p0, p1, w, w * 0.85), b = quill(p1, p2, w * 0.85, w * 0.7);
    return { test: (x, y) => a(x, y) || b(x, y), m, flat: true };
  };

  // ---------------------------------------------------------------- styles
  // Each tier: (P palette, f flap frame) -> list of parts, drawn back to front
  const STYLES = [
    null,
    // +10 Fledgling: two little sprouting plumes
    (P) => [
      ...featherRow({ bone: 7, boneAng: 60, n: 3, len: [5, 8], ang: [-80, -20], w: 1.7 }, P.plume),
      arm(7, 60, 1.6, P.plume)
    ],
    // +20 Plumed: a small, neat feathered wing in the card colour
    (P) => [
      ...featherRow({ bone: 11, boneAng: 58, n: 4, len: [7, 13], ang: [-95, -25], w: 2 }, P.card),
      ...featherRow({ bone: 11, boneAng: 58, n: 3, len: [3, 6], ang: [-60, -10], w: 1.7, from: 0.3 }, P.plume),
      arm(11, 58, 1.8, P.plume)
    ],
    // +30 Duskwing: a bat's wing, card-lit membrane stretched over dark fingers
    (P) => {
      const L = 16, wr = add([0, 0], dir(48), 14), el = add([0, 0], dir(70), 7);
      const tips = [-5, -40, -75].map((a, i) => add(wr, dir(a), L * (1 - i * 0.16)));
      const sc = (a, b) => { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; return [m[0] + (wr[0] - m[0]) * 0.32, m[1] + (wr[1] - m[1]) * 0.32]; };
      const low = [2, -11];
      return [
        { test: polygon([[0, 0], el, wr, tips[0], sc(tips[0], tips[1]), tips[1], sc(tips[1], tips[2]), tips[2], sc(tips[2], low), low]), m: P.deep, flat: true, shadeY: true },
        ...tips.map(t => ({ test: quill(wr, t, 0.8, 0.4), m: P.bone, flat: true })),
        { test: quill([0, 0], el, 1.4, 1.1), m: P.bone, flat: true },
        { test: quill(el, wr, 1.1, 0.9), m: P.bone, flat: true },
        spike(wr, [0.3, 1], 2.2, 0.8, P.bone)
      ];
    },
    // +40 Seraph: full white angel wing with a covert row
    (P) => [
      ...featherRow({ bone: 15, boneAng: 55, n: 6, len: [9, 20], ang: [-100, -25], w: 2.1 }, P.plume),
      ...featherRow({ bone: 15, boneAng: 55, n: 5, len: [4, 8], ang: [-70, -10], w: 1.8, from: 0.3 }, P.plume),
      arm(15, 55, 2, P.plume),
      { test: quill(add([0, 0], dir(55), 4), add([0, 0], dir(55), 15), 0.5, 0.4), m: P.card, flat: true, tone: 'l', rim: false }
    ],
    // +50 Prism: crystal shards fanned out with gaps, lit from within
    (P) => {
      const out = [];
      const bd = dir(52);
      for (let i = 5; i >= 0; i--) {
        const u = i / 5, a = -100 + 80 * u, len = 10 + 10 * u;
        const base = add([0, 0], bd, 3 + 12 * u), v = dir(a), n = [-v[1], v[0]];
        const mid = add(base, v, len * 0.35), tip = add(base, v, len);
        out.push({ test: polygon([base, add(mid, n, 2.6), tip, add(mid, n, -2.6)]), m: P.card, crystal: true, alpha: 235 });
      }
      out.push(arm(15, 52, 1.4, P.steel));
      return out;
    },
    // +60 Pyre: wings of flickering flame tongues
    (P, f) => [
      ...featherRow({
        bone: 15, boneAng: 55, n: 6, len: [10, 20], ang: [-95, -20], w: 2.5, tipW: 0.15,
        // each tongue licks sideways, a little more toward its tip, phase shifting per frame
        wave: (i) => (t) => Math.sin(t * 7 + f * 0.8 + i * 1.7) * 1.1 * t
      }, P.card, { flame: true }),
      Object.assign(arm(15, 55, 1.8, P.card), { flame: true })
    ],
    // +70 Bladewing: steel blades hovering free of a floating spine, edges in the card colour
    (P, f) => {
      const hover = Math.sin(f / FRAMES * Math.PI * 2) * 0.6;
      const out = featherRow({ bone: 16, boneAng: 55, n: 6, len: [9, 18], ang: [-100, -25], w: 1.8, tipW: 0.1, gap: 2.2 + hover }, P.steel, { blade: true });
      out.push(arm(16, 55, 1.2, P.card));
      return out;
    },
    // +80 Twinplume: a dark card-coloured wing behind a white one
    (P) => [
      ...featherRow({ bone: 17, boneAng: 65, n: 6, len: [11, 21], ang: [-75, 0], w: 2.1 }, P.card),
      ...featherRow({ bone: 15, boneAng: 48, n: 6, len: [9, 18], ang: [-105, -35], w: 2 }, P.plume),
      ...featherRow({ bone: 15, boneAng: 48, n: 5, len: [4, 7], ang: [-70, -15], w: 1.8, from: 0.3 }, P.plume),
      arm(15, 48, 2, P.plume)
    ],
    // +90 Wraith: great spectral wings, translucent with glowing edges
    (P) => [
      ...featherRow({ bone: 19, boneAng: 56, n: 7, len: [11, 24], ang: [-105, -20], w: 2.3 }, P.card, { spectral: true, alpha: 175 }),
      ...featherRow({ bone: 19, boneAng: 56, n: 5, len: [4, 9], ang: [-70, -10], w: 1.9, from: 0.3 }, P.glow, { spectral: true, alpha: 200 }),
      Object.assign(arm(19, 56, 1.8, P.glow), { spectral: true })
    ],
    // +100 Celestial: three pairs - a vast card-colour wing, a golden-trimmed white
    // wing over it and a small lower pair
    (P) => [
      ...featherRow({ bone: 20, boneAng: 66, n: 7, len: [13, 26], ang: [-70, 5], w: 2.3 }, P.card),
      ...featherRow({ bone: 9, boneAng: -35, n: 4, len: [7, 12], ang: [-100, -55], w: 1.8, lift: 0 }, P.plume),
      ...featherRow({ bone: 18, boneAng: 48, n: 7, len: [10, 20], ang: [-108, -30], w: 2.1 }, P.plume),
      ...featherRow({ bone: 18, boneAng: 48, n: 6, len: [4, 7], ang: [-70, -15], w: 1.8, from: 0.3 }, P.gold),
      arm(18, 48, 1.6, P.gold),
      arm(9, -35, 1.3, P.gold)
    ]
  ];

  function spike(base, v, len, w, m) {
    const n = [-v[1], v[0]];
    return { test: polygon([add(base, n, w), add(base, v, len), add(base, n, -w)]), m, flat: true };
  }

  // ---------------------------------------------------------------- raster
  function put(d, x, y, rgb, a) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    if (a >= 255 || d[i + 3] === 0) {
      d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = Math.max(a, d[i + 3]);
      return;
    }
    const k = a / 255;
    d[i] = d[i] * (1 - k) + rgb[0] * k; d[i + 1] = d[i + 1] * (1 - k) + rgb[1] * k; d[i + 2] = d[i + 2] * (1 - k) + rgb[2] * k;
    d[i + 3] = Math.max(d[i + 3], a);
  }

  // Wings for tier at flap frame f: RGBA buffer W x H. sides: which wings,
  // -1 left / 1 right of the root (default both; the renderer draws one at a time
  // so each can be turned and layered on its own)
  function raster(tier, hex, f, sides) {
    const data = new Uint8ClampedArray(W * H * 4);
    const style = STYLES[Math.max(0, Math.min(TIERS, tier))];
    if (!style) return { w: W, h: H, data };
    const parts = style(palette(hex), f);
    // flap: the whole wing swings about its root
    const phi = 0.2 * Math.sin(f / FRAMES * Math.PI * 2) + (tier >= 9 ? 0.05 : 0);
    const c = Math.cos(phi), s = Math.sin(phi);
    for (const side of sides || [-1, 1]) {
      const local = (px, py) => {
        const dx = side * (px + 0.5 - RX), dy = RY - (py + 0.5);
        return [dx * c + dy * s, -dx * s + dy * c];
      };
      for (const p of parts) {
        const inside = (x, y) => { const [lx, ly] = local(x, y); return p.test(lx, ly); };
        const alpha = p.alpha || 255;
        // outline first (gives internal lines where parts overlap); spectral and
        // crystal parts are rimmed in their light tone, flames not at all
        if (p.rim !== false && !p.flame) {
          const rimCol = p.spectral || p.crystal ? p.m.h : p.m.o;
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            if (inside(x, y)) continue;
            if (inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1)) put(data, x, y, rimCol, p.spectral ? 200 : 255);
          }
        }
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const r = inside(x, y);
          if (!r) continue;
          const [t, sv] = r;
          let col, a = alpha;
          if (p.tone) col = p.m[p.tone];
          else if (p.flame) {
            // hot core near the root and along the middle, thinning to the tips
            col = t < 0.3 || Math.abs(sv) < 0.3 ? p.m.h : t < 0.65 ? p.m.l : p.m.m;
            a = Math.round(255 * (1 - t * 0.55));
          } else if (p.crystal) col = sv > 0.25 || t > 0.85 ? p.m.h : sv < -0.3 ? p.m.m : p.m.l;
          else if (p.blade) col = Math.abs(sv) > 0.55 ? (sv > 0 ? p.m.h : CARD_EDGE(p, parts)) : p.m.m;
          else if (p.shadeY) { const [, ly] = local(x, y); col = ly > 2 ? p.m.l : ly > -4 ? p.m.m : p.m.d; }
          else if (p.flat) col = sv > 0.3 ? p.m.l : sv < -0.4 ? p.m.d : p.m.m;
          else col = t > 0.82 && sv > 0 ? p.m.h : sv > 0.35 ? p.m.l : sv < -0.45 ? p.m.d : p.m.m;
          put(data, x, y, col, a);
        }
      }
    }
    return { w: W, h: H, data };
  }
  // blade edges take the card colour carried by the spine (last part)
  const CARD_EDGE = (p, parts) => parts[parts.length - 1].m.l;

  const api = { W, H, RX, RY, FRAMES, TIERS, raster };

  // ---------------------------------------------------------------- browser
  if (typeof document !== 'undefined') {
    const cache = new Map();
    // Cached canvas of one wing (the right one, spreading +x from RX) for tier
    // (1-10), card colour and flap frame; mirror it for the other side
    api.wing = (tier, hex, f) => {
      const k = tier + '|' + hex + '|' + f;
      let cv = cache.get(k);
      if (!cv) {
        const r = raster(tier, hex, f, [1]);
        cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        cv.getContext('2d').putImageData(new ImageData(r.data, W, H), 0, 0);
        cache.set(k, cv);
      }
      return cv;
    };
    root.SpWings = api;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
