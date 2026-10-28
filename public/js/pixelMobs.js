// Slop Hero - procedural pixel-art monsters and town shopkeepers.
// Same look as the heroes (pixelHeroes.js): every body part is a shaded shape
// lit from the upper left with its own 1px outline. Parts are placed in a tiny
// 3D rig space (x forward, y down, z toward the creature's right side), turned
// to the view and painted back to front, so one rig gives side, front-3/4 and
// back-3/4 views. Frames face right; the renderer flips them.
(function (root) {
  'use strict';

  const LIGHT = [-0.54, -0.84];  // light from the upper left
  const DEPTH_K = 0.32;          // how far nearer parts sit lower on screen
  const VIEW_PHI = { side: 0, front: 0.8, back: -0.8 };

  // ---------------------------------------------------------------- palette
  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // outline, dark, mid, light, highlight
  function mat(o, d, m, l, h) {
    return { o: hexRgb(o), d: hexRgb(d), m: hexRgb(m), l: hexRgb(l), h: hexRgb(h || l) };
  }
  const M = {
    slime: mat('#052e16', '#15803d', '#22c55e', '#4ade80', '#bbf7d0'),
    slimeCore: mat('#052e16', '#14532d', '#166534', '#15803d'),
    gob: mat('#0f2a14', '#15803d', '#22c55e', '#4ade80', '#bbf7d0'),
    leather: mat('#1c0d02', '#451a03', '#78350f', '#a16207'),
    wood: mat('#1d1107', '#472a12', '#6b421f', '#936238'),
    gold: mat('#382403', '#9f6a10', '#dca528', '#fde58a', '#fffbe0'),
    bone: mat('#1e293b', '#94a3b8', '#cbd5e1', '#f1f5f9', '#ffffff'),
    rust: mat('#1f1309', '#6b4423', '#8f6a4a', '#b3967a'),
    steel: mat('#10131d', '#4b566b', '#8593ad', '#c3ccdc', '#f5f7fa'),
    shield: mat('#1c0d02', '#5a3415', '#7c4a1e', '#9a6430'),
    stone: mat('#0b1120', '#334155', '#475569', '#64748b', '#94a3b8'),
    stoneDark: mat('#0b1120', '#1e293b', '#334155', '#475569'),
    core: mat('#083344', '#0891b2', '#22d3ee', '#a5f3fc', '#ffffff'),
    fur: mat('#1e293b', '#94a3b8', '#e2e8f0', '#f8fafc', '#ffffff'),
    ice: mat('#082f49', '#0369a1', '#38bdf8', '#7dd3fc', '#e0f2fe'),
    iceCore: mat('#0c4a6e', '#7dd3fc', '#bae6fd', '#e0f2fe', '#ffffff'),
    armor: mat('#05070d', '#0f172a', '#1e293b', '#475569', '#94a3b8'),
    frostSkin: mat('#082f49', '#0284c7', '#38bdf8', '#7dd3fc'),
    dark: mat('#05070d', '#0f172a', '#0f172a', '#1e293b'),
    // shopkeepers
    skinOlaf: mat('#3a1d12', '#c98a66', '#e9b48f', '#f6cfae'),
    skinBrom: mat('#3a1d12', '#b5774f', '#d79b72', '#ebbb94'),
    skinValka: mat('#3a1d12', '#c98a66', '#e8b48f', '#f6cfae'),
    ginger: mat('#2a1205', '#8d4b16', '#b5651d', '#d98a3d'),
    shirtBlue: mat('#0b1a2e', '#22528a', '#2f6fb0', '#4f8fd0'),
    vest: mat('#1c0d02', '#5a3618', '#7a4b23', '#9a6a3a'),
    pantsBrown: mat('#170c07', '#3e2b25', '#5d4037', '#7b5a4e'),
    boots: mat('#0d0705', '#2a1a16', '#3e2723', '#5a3d36'),
    capGreen: mat('#06200b', '#1b5e20', '#2e7d32', '#43a047'),
    feather: mat('#3b0606', '#b71c1c', '#e53935', '#ff6f60'),
    greyBeard: mat('#2a2a2e', '#7c7c84', '#9e9e9e', '#c8c8cc', '#ececf2'),
    apron: mat('#120a07', '#3a2620', '#4e342e', '#6a4a40'),
    shirtBrom: mat('#1c120a', '#5e4633', '#7b5e45', '#977a5f'),
    slate: mat('#0a0f12', '#263238', '#37474f', '#4f646e'),
    blackBoots: mat('#050505', '#151515', '#212121', '#3a3a3a'),
    hammerHead: mat('#0a0c10', '#2b2f36', '#3d4249', '#5f6670', '#a0a8b4'),
    robe: mat('#170a2a', '#4c1d95', '#6d28d9', '#8b5cf6'),
    robeDark: mat('#0e0620', '#2e1065', '#4c1d95', '#6d28d9'),
    silver: mat('#3b3f48', '#a1a6b0', '#d1d5db', '#eef0f3', '#ffffff'),
    hatPurple: mat('#120626', '#3b1782', '#5b21b6', '#7c3aed'),
    gemGold: mat('#382403', '#ca8a04', '#facc15', '#fde68a')
  };
  const C = {
    eye: hexRgb('#16131f'), white: hexRgb('#ffffff'), yellow: hexRgb('#fde047'),
    red: hexRgb('#ff4d4d'), cyan: hexRgb('#67e8f9'), cyanHot: hexRgb('#cffafe'),
    teeth: hexRgb('#fef3c7'), blush: hexRgb('#e8917a'), violet: hexRgb('#e9d5ff'),
    nose: hexRgb('#1e1b24'), mouth: hexRgb('#3b0d0d')
  };

  // ---------------------------------------------------------------- raster
  function newFrame(W, H, AX, AY) {
    return { W, H, AX, AY, data: new Uint8ClampedArray(W * H * 4) };
  }

  function put(f, x, y, rgb, a) {
    if (x < 0 || y < 0 || x >= f.W || y >= f.H) return;
    const d = f.data, i = (y * f.W + x) * 4;
    a = a === undefined ? 255 : a;
    if (a >= 255 || d[i + 3] === 0) {
      d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2];
      d[i + 3] = Math.max(a, d[i + 3]);
      return;
    }
    const k = a / 255;
    d[i] = d[i] * (1 - k) + rgb[0] * k;
    d[i + 1] = d[i + 1] * (1 - k) + rgb[1] * k;
    d[i + 2] = d[i + 2] * (1 - k) + rgb[2] * k;
  }

  // 2D shapes in frame pixels (points relative to the anchor); test() returns
  // a pseudo-normal used for shading
  function capsule(f, a, b, r1, r2) {
    const ax = f.AX + a[0], ay = f.AY + a[1], bx = f.AX + b[0], by = f.AY + b[1];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-6;
    const r = Math.max(r1, r2);
    return {
      bbox: [Math.floor(Math.min(ax, bx) - r - 1), Math.floor(Math.min(ay, by) - r - 1),
        Math.ceil(Math.max(ax, bx) + r + 1), Math.ceil(Math.max(ay, by) + r + 1)],
      test(px, py) {
        let t = ((px - ax) * dx + (py - ay) * dy) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const rr = r1 + (r2 - r1) * t;
        const ex = px - (ax + dx * t), ey = py - (ay + dy * t);
        if (ex * ex + ey * ey > rr * rr) return null;
        return [ex / rr, ey / rr];
      }
    };
  }

  function disc(f, c, r, ry) {
    const cx = f.AX + c[0], cy = f.AY + c[1];
    return {
      bbox: [Math.floor(cx - r - 1), Math.floor(cy - ry - 1), Math.ceil(cx + r + 1), Math.ceil(cy + ry + 1)],
      test(px, py) {
        const nx = (px - cx) / r, ny = (py - cy) / ry;
        return nx * nx + ny * ny <= 1 ? [nx, ny] : null;
      }
    };
  }

  function poly(f, pts) {
    const P = pts.map(p => [f.AX + p[0], f.AY + p[1]]);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, cx = 0, cy = 0;
    for (const [x, y] of P) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      cx += x; cy += y;
    }
    cx /= P.length; cy /= P.length;
    const sx = Math.max(1, (x1 - x0) / 2), sy = Math.max(1, (y1 - y0) / 2);
    return {
      bbox: [Math.floor(x0 - 1), Math.floor(y0 - 1), Math.ceil(x1 + 1), Math.ceil(y1 + 1)],
      test(px, py) {
        let inside = false;
        for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
          const [xi, yi] = P[i], [xj, yj] = P[j];
          if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
        }
        return inside ? [(px - cx) / sx, (py - cy) / sy] : null;
      }
    };
  }

  // Fill a shape with a material ramp; rim draws a 1px outline around it first,
  // which also gives internal lines where parts overlap.
  function paint(f, s, m, o) {
    o = o || {};
    const [x0, y0, x1, y1] = s.bbox;
    const alpha = o.alpha;
    const inside = (x, y) => s.test(x + 0.5, y + 0.5);
    if (o.rim !== false) {
      for (let y = y0 - 1; y <= y1 + 1; y++) {
        for (let x = x0 - 1; x <= x1 + 1; x++) {
          if (inside(x, y)) continue;
          if (inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1)) put(f, x, y, m.o, alpha);
        }
      }
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const n = inside(x, y);
        if (!n) continue;
        let c;
        if (o.tone) c = m[o.tone];
        else {
          const s2 = n[0] * LIGHT[0] + n[1] * LIGHT[1];
          c = (o.spec && s2 > 0.8) ? m.h : s2 > 0.38 ? m.l : s2 < -0.36 ? m.d : m.m;
        }
        put(f, x, y, c, alpha);
      }
    }
  }

  // ---------------------------------------------------------------- vectors
  const V3 = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const lerp = (a, b, t) => a + (b - a) * t;
  // joint between a and b for a two-bone limb of total length len, bending toward dir
  function joint(a, b, len, dir) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const h = d < len ? Math.sqrt((len / 2) ** 2 - (d / 2) ** 2) : 0;
    return V3(mix3(a, b, 0.5), dir, h);
  }
  // reach from a toward b, at most len
  function reach(a, b, len) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
    return d <= len ? b : mix3(a, b, len / d);
  }

  // ---------------------------------------------------------------- scene
  // Parts are queued with their depth (toward the camera) and painted back to front
  function Scene(f, phi) {
    const c = Math.cos(phi), s = Math.sin(phi);
    this.f = f;
    this.s = s;
    this.P = p => [p[0] * c - p[2] * s, p[1] + (p[0] * s + p[2] * c) * DEPTH_K];
    this.D = p => p[0] * s + p[2] * c;
    this.parts = [];
  }
  Scene.prototype = {
    add(d, fn) { this.parts.push({ d, i: this.parts.length, fn }); },
    ball(p, r, m, o = {}) {
      const q = this.P(p), f = this.f;
      this.add(this.D(p) + (o.bias || 0), () => paint(f, disc(f, q, r * (o.sx || 1), r * (o.sy || 1)), m, o));
    },
    limb(a, b, r1, r2, m, o = {}) {
      const qa = this.P(a), qb = this.P(b), f = this.f;
      this.add((this.D(a) + this.D(b)) / 2 + (o.bias || 0), () => paint(f, capsule(f, qa, qb, r1, r2), m, o));
    },
    // two-bone limb with a round joint
    bone2(a, j, b, r1, rj, r2, m, m2, o = {}) {
      this.limb(a, j, r1, rj, m, o);
      this.limb(j, b, rj, r2, m2 || m, Object.assign({}, o, { bias: (o.bias || 0) + 0.05 }));
    },
    shape(pts, m, o = {}) {
      const q = pts.map(this.P), f = this.f;
      const d = pts.reduce((a, p) => a + this.D(p), 0) / pts.length;
      this.add(d + (o.bias || 0), () => paint(f, poly(f, q), m, o));
    },
    // screen-space crystal around a rig point: h tall, w wide, leaning by tilt
    gem(p, h, w, m, o = {}) {
      const q = this.P(p), f = this.f, t = o.tilt || 0;
      const ux = Math.sin(t), uy = -Math.cos(t), vx = -uy, vy = ux;
      const pts = [
        [q[0] + ux * h, q[1] + uy * h], [q[0] + vx * w, q[1] + vy * w],
        [q[0] - ux * h * (o.tail || 0.7), q[1] - uy * h * (o.tail || 0.7)], [q[0] - vx * w, q[1] - vy * w]
      ];
      this.add(this.D(p) + (o.bias || 0), () => paint(f, poly(f, pts), m, o));
    },
    px(p, rgb, o = {}) {
      const q = this.P(p), f = this.f;
      const w = o.w || 1, h = o.h || 1;
      this.add(this.D(p) + (o.bias === undefined ? 0.5 : o.bias), () => {
        const x0 = Math.floor(f.AX + q[0]), y0 = Math.floor(f.AY + q[1]);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(f, x0 + x, y0 + y, rgb, o.alpha);
      });
    },
    draw() {
      this.parts.sort((a, b) => a.d - b.d || a.i - b.i);
      for (const p of this.parts) p.fn();
    }
  };

  // ---------------------------------------------------------------- shared rigs
  // Legs of a biped; foot targets come from the walk cycle
  function walkFeet(t, stride, lift, spread, moving) {
    if (!moving) return [[0.6, 0, -spread], [-0.6, 0, spread]];
    const w = t * Math.PI * 2;
    return [
      [Math.sin(w) * stride, -Math.max(0, Math.cos(w)) * lift, -spread],
      [-Math.sin(w) * stride, -Math.max(0, -Math.cos(w)) * lift, spread]
    ];
  }

  // ---------------------------------------------------------------- monsters
  // Each type: frame size + anchor, frame counts per action and a draw(S, pose)
  // pose = { action, t (0..1 through the action), k (frame index) }
  const MOBS = {};

  MOBS.slime = {
    W: 48, H: 40, AX: 24, AY: 36,
    frames: { idle: 4, walk: 6, attack: 5, hurt: 1 },
    draw(S, p) {
      const { action, t } = p;
      let hop = 0, sx = 1, sy = 1, fwd = 0, open = 0;
      if (action === 'idle') { sy = 1 + 0.07 * Math.sin(t * Math.PI * 2); sx = 2 - sy; }
      else if (action === 'walk') { const h = Math.sin(Math.PI * t); hop = h * 6; sy = 0.86 + 0.26 * h; sx = 1.12 - 0.2 * h; }
      else if (action === 'attack') {
        if (t < 0.4) { sy = 0.8; sx = 1.2; fwd = -2; }
        else if (t < 0.75) { const h = Math.sin(((t - 0.4) / 0.35) * Math.PI); fwd = 2 + 7 * h; hop = 4 * h; sy = 1.12; sx = 0.9; open = 1; }
        else { sy = 0.92; sx = 1.08; fwd = 1; }
      } else { sy = 0.78; sx = 1.22; fwd = -3; }
      const R = 12, cy = -R * sy - hop;
      const c = [fwd, cy, 0];
      S.ball(c, R, M.slime, { sx, sy, spec: true });
      // darker core and bubbles seen through the jelly
      S.ball([fwd - 1.5, cy + 2.5, 0], R * 0.5, M.slimeCore, { sx, sy: sy * 0.8, rim: false, alpha: 120, bias: 0.2 });
      S.px([fwd - 5, cy - 4, 4], M.slime.h, { bias: 12, w: 2, h: 2 });
      S.px([fwd - 2, cy + 3, 5], M.slime.l, { bias: 12 });
      S.px([fwd + 3, cy + 5, -4], M.slime.l, { bias: 12 });
      // face on the front of the blob
      const fx = fwd + R * 0.72 * sx;
      for (const ez of [-4, 4]) {
        S.ball([fx, cy - 1.5, ez], 1.7, { o: C.eye, d: C.eye, m: C.eye, l: C.eye, h: C.eye }, { rim: false, tone: 'm', sy: 1.3, bias: 1 });
        S.px([fx - 0.4, cy - 3, ez], C.white, { bias: 2 });
      }
      if (open) S.ball([fx + 0.5, cy + 3.5, 0], 2.6, { o: C.eye, d: C.mouth, m: C.mouth, l: C.mouth, h: C.mouth }, { tone: 'm', sy: 0.8, bias: 1 });
      else S.limb([fx + 0.3, cy + 3, -2], [fx + 0.3, cy + 3, 2], 0.6, 0.6, { o: C.eye, d: C.eye, m: C.eye, l: C.eye, h: C.eye }, { rim: false, tone: 'm', bias: 1 });
    }
  };

  // Green goblin with a spiked club
  MOBS.goblin = {
    W: 60, H: 56, AX: 30, AY: 52,
    frames: { idle: 4, walk: 6, attack: 5, hurt: 1 },
    draw(S, p) {
      const { action, t } = p;
      const moving = action === 'walk';
      const w = t * Math.PI * 2;
      const bob = moving ? Math.abs(Math.cos(w)) * 1.5 : Math.sin(w) * 0.5;
      let lean = moving ? 1.5 : 0;
      let clubHand, farHand, clubAng;
      const swing = moving ? Math.sin(w) : 0;
      if (action === 'attack') {
        const k = t < 0.35 ? t / 0.35 : 1;
        const strike = t < 0.35 ? 0 : t < 0.65 ? (t - 0.35) / 0.3 : 1;
        const up = [-3, -36, 6.5], down = [10, -16, 6.5];
        clubHand = strike > 0 ? mix3(up, down, strike) : mix3([3, -17, 7], up, k);
        clubAng = strike > 0 ? lerp(-2.6, 0.9, strike) : lerp(0.3, -2.6, k);
        lean = strike > 0 ? 3 * strike : -1.5 * k;
        farHand = [4, -21, -6.5];
      } else if (action === 'hurt') {
        lean = -3; clubHand = [-1, -18, 7.5]; clubAng = 1.6; farHand = [-3, -19, -7];
      } else {
        clubHand = [3 - swing * 4, -16 + bob, 7.5]; clubAng = 0.5 - swing * 0.3; farHand = [1 + swing * 4, -15 + bob, -7];
      }
      const hipY = -13 + bob;
      const feet = walkFeet(t, 5, 2.5, 3.5, moving);
      for (const [i, foot] of feet.entries()) {
        const hip = [0, hipY, i ? 3 : -3];
        const knee = joint(hip, foot, 14, [1, 0, 0]);
        S.bone2(hip, knee, [foot[0], foot[1] - 1.5, foot[2]], 2.6, 2.2, 2, M.gob);
        S.ball([foot[0] + 1.5, foot[1] - 1.2, foot[2]], 2.4, M.leather, { sy: 0.6 });
      }
      const chest = [lean, -24 + bob, 0];
      S.limb([0, hipY - 1, 0], chest, 5.5, 6.5, M.gob);
      S.ball([1.5 + lean * 0.4, -17.5 + bob, 0], 5.2, M.gob, { bias: 0.4 });
      // belt and loincloth
      S.ball([0.5, hipY - 1.5, 0], 6.2, M.leather, { sy: 0.32, bias: 0.6 });
      S.px([6.6, hipY - 1.8, 0], M.gold.l, { w: 2, h: 2, bias: 6 });
      S.shape([[4.5, hipY, -3], [4.5, hipY, 3], [6, hipY + 7, 2], [6, hipY + 7, -2]], M.leather, { bias: 4 });
      // harness strap across the chest
      S.limb([lean + 3.5, -26.5 + bob, 4.5], [3, hipY - 2, -4], 1.1, 1.1, M.leather, { bias: 6 });
      // head with big ears and hooked nose
      const head = [2 + lean, -31.5 + bob, 0];
      S.ball(head, 6.3, M.gob, { spec: true });
      for (const sz of [-1, 1]) {
        S.shape([V3(head, [-1, -1, 4.5 * sz], 1), V3(head, [-6, -5, 10 * sz], 1), V3(head, [-2, 1.5, 6 * sz], 1)], M.gob, { bias: 0.2 });
        S.px(V3(head, [4.4, -1.2, 2.3 * sz], 1), C.yellow, { w: 2, bias: 3 });
        S.px(V3(head, [4.6, -1.2, 2.3 * sz], 1), C.mouth, { bias: 3.1 });
      }
      S.limb(V3(head, [4.5, 0.2, 0], 1), V3(head, [8.5, 2, 0], 1), 1.7, 1.1, M.gob, { bias: 3 });
      S.limb(V3(head, [4, 4, -2], 1), V3(head, [4, 4, 2], 1), 0.6, 0.6, M.gob, { tone: 'o', rim: false, bias: 3 });
      S.px(V3(head, [4.3, 3.6, 1.6], 1), C.teeth, { bias: 3.2 });
      S.px(V3(head, [4.3, 3.6, -1.6], 1), C.teeth, { bias: 3.2 });
      // arms
      for (const [sz, hand] of [[-1, farHand], [1, clubHand]]) {
        const sh = [lean, -23.5 + bob, 6.5 * sz];
        const h2 = reach(sh, hand, 12);
        const el = joint(sh, h2, 12, [-0.8, 0.4, 0.2 * sz]);
        S.bone2(sh, el, h2, 2.2, 1.9, 1.8, M.gob);
        S.ball(h2, 2.2, M.gob, { bias: 0.1 });
        if (sz > 0) {
          const dir = [Math.cos(clubAng), Math.sin(clubAng), 0];
          const tip = V3(h2, dir, 13);
          S.limb(V3(h2, dir, -2), tip, 1.4, 3.2, M.wood, { bias: 0.3 });
          S.px(V3(tip, dir, -2), M.steel.l, { bias: 0.8, w: 2 });
          S.px(V3(tip, [-dir[1], dir[0], 0], 2.8), M.steel.l, { bias: 0.8 });
        }
      }
    }
  };

  // Skeleton with a rusty sword and a round shield
  MOBS.skeleton = {
    W: 60, H: 60, AX: 30, AY: 54,
    frames: { idle: 4, walk: 6, attack: 5, hurt: 1 },
    draw(S, p) {
      const { action, t } = p;
      const moving = action === 'walk';
      const w = t * Math.PI * 2;
      const bob = moving ? Math.abs(Math.cos(w)) * 1.2 : Math.sin(w) * 0.4;
      const swing = moving ? Math.sin(w) : 0;
      let lean = moving ? 1 : 0, swordHand, swordAng, shieldHand;
      if (action === 'attack') {
        const k = t < 0.35 ? t / 0.35 : 1, strike = t < 0.35 ? 0 : t < 0.65 ? (t - 0.35) / 0.3 : 1;
        swordHand = strike > 0 ? mix3([-1, -38, 6], [11, -20, 6], strike) : mix3([4, -18, 6.5], [-1, -38, 6], k);
        swordAng = strike > 0 ? lerp(-2.2, 0.4, strike) : lerp(-0.6, -2.2, k);
        lean = strike > 0 ? 3 * strike : -1;
        shieldHand = [6, -24, -6];
      } else if (action === 'hurt') {
        lean = -3; swordHand = [-1, -19, 7]; swordAng = 1.3; shieldHand = [4, -25, -6];
      } else {
        swordHand = [4 - swing * 3, -18 + bob, 6.5]; swordAng = -0.6 - swing * 0.2; shieldHand = [5 + swing * 2, -21 + bob, -6.5];
      }
      const hipY = -15 + bob;
      const feet = walkFeet(t, 5, 2.5, 3, moving);
      for (const [i, foot] of feet.entries()) {
        const hip = [0, hipY, i ? 2.8 : -2.8];
        const knee = joint(hip, foot, 16, [1, 0, 0]);
        S.bone2(hip, knee, [foot[0], foot[1] - 1, foot[2]], 1.3, 1.6, 1.2, M.bone);
        S.limb([foot[0] - 1, foot[1] - 0.8, foot[2]], [foot[0] + 3, foot[1] - 0.6, foot[2]], 1.2, 1, M.bone);
      }
      S.ball([0, hipY, 0], 3.6, M.bone, { sy: 0.7, bias: 0.3 });
      // tattered loincloth
      S.shape([[2.5, hipY - 0.5, -3], [2.5, hipY - 0.5, 3], [3.5, hipY + 6, 1.5], [3, hipY + 4, 0], [3.5, hipY + 6.5, -2]], M.rust, { bias: 3 });
      const chest = [lean + 0.5, -24 + bob, 0];
      S.limb([0, hipY, 0], [lean, -27 + bob, 0], 1.3, 1.3, M.bone, { tone: 'm' });
      S.ball(chest, 5.4, M.bone, { spec: true });
      for (let i = 0; i < 3; i++) {
        const y = chest[1] - 2.2 + i * 2.2;
        S.limb([chest[0] + 3.6, y, -3.5], [chest[0] + 3.6, y, 3.5], 0.45, 0.45, M.bone, { tone: 'o', rim: false, bias: 4 });
        S.limb([chest[0] + 1, y, 5], [chest[0] - 2, y, 5], 0.45, 0.45, M.bone, { tone: 'o', rim: false, bias: 4 });
      }
      // skull
      const head = [lean + 1.5, -32.5 + bob, 0];
      S.ball(head, 5.2, M.bone, { spec: true });
      S.ball(V3(head, [1.6, 3.6, 0], 1), 3, M.bone, { sy: 0.7, bias: 0.2 });
      for (const sz of [-1, 1]) {
        S.ball(V3(head, [3.8, -0.4, 2 * sz], 1), 1.4, M.dark, { rim: false, tone: 'm', bias: 2 });
        S.px(V3(head, [4, -0.6, 2 * sz], 1), C.red, { bias: 3 });
      }
      for (let i = -1; i <= 1; i++) S.px(V3(head, [4.4, 3.4, i * 1.2], 1), C.eye, { bias: 3 });
      // arms
      for (const [sz, hand] of [[-1, shieldHand], [1, swordHand]]) {
        const sh = [lean, -27 + bob, 5 * sz];
        const h2 = reach(sh, hand, 14);
        const el = joint(sh, h2, 14, [-0.8, 0.4, 0.2 * sz]);
        S.bone2(sh, el, h2, 1.2, 1.4, 1.1, M.bone);
        S.ball(sh, 1.9, M.bone, { bias: 0.1 });
        if (sz > 0) {
          const dir = [Math.cos(swordAng), Math.sin(swordAng), 0];
          S.limb(V3(h2, dir, 1.5), V3(h2, dir, 16), 1.3, 0.7, M.rust, { bias: 0.3 });
          S.limb(V3(h2, [-dir[1], dir[0], 0], 2.4), V3(h2, [dir[1], -dir[0], 0], 2.4), 0.8, 0.8, M.leather, { bias: 0.4 });
        } else {
          S.ball(V3(h2, [1.5, 0, -1], 1), 6, M.shield, { sx: 0.4 + 0.6 * Math.abs(S.s), bias: 0.5 });
          S.ball(V3(h2, [1.5, 0, -1], 1), 1.6, M.steel, { bias: 0.9, sx: 0.5 + 0.5 * Math.abs(S.s) });
        }
      }
    }
  };

  // Hulking stone golem with a glowing rune core
  MOBS.golem = {
    W: 100, H: 92, AX: 50, AY: 86,
    frames: { idle: 4, walk: 6, attack: 5, hurt: 1 },
    draw(S, p) {
      const { action, t } = p;
      const moving = action === 'walk';
      const w = t * Math.PI * 2;
      const bob = moving ? Math.abs(Math.cos(w)) * 2 : Math.sin(w) * 0.8;
      const swing = moving ? Math.sin(w) : 0;
      let lean = moving ? 2 : 0, hands;
      if (action === 'attack') {
        const k = t < 0.4 ? t / 0.4 : 1, slam = t < 0.4 ? 0 : t < 0.7 ? (t - 0.4) / 0.3 : 1;
        const up = [4, -74, 13], down = [22, -8, 12];
        const hz = slam > 0 ? mix3(up, down, slam) : mix3([8, -22, 21], up, k);
        hands = [[hz[0], hz[1], -hz[2]], hz];
        lean = slam > 0 ? 6 * slam : -2 * k;
      } else if (action === 'hurt') {
        lean = -4; hands = [[-2, -26, -21], [-2, -26, 21]];
      } else {
        hands = [[8 + swing * 6, -22 + bob, -21], [8 - swing * 6, -22 + bob, 21]];
      }
      const hipY = -24 + bob;
      const feet = walkFeet(t, 7, 3, 10, moving);
      for (const [i, foot] of feet.entries()) {
        const hip = [0, hipY, i ? 9 : -9];
        const knee = joint(hip, foot, 25, [1, 0, 0]);
        S.bone2(hip, knee, [foot[0], foot[1] - 3, foot[2]], 6.5, 6, 7, M.stone, M.stoneDark);
        S.ball([foot[0] + 2, foot[1] - 2.5, foot[2]], 6.5, M.stone, { sy: 0.55 });
      }
      S.ball([0, hipY - 2, 0], 10, M.stoneDark, { sy: 0.7 });
      const chest = [lean, -44 + bob, 0];
      S.ball(chest, 17, M.stone, { sy: 0.92, spec: true });
      S.ball([lean + 4, -31 + bob, 0], 9.5, M.stone, { bias: 1 });
      // cracks
      S.limb(V3(chest, [9, -8, 9], 1), V3(chest, [12, -2, 6], 1), 0.5, 0.5, M.stone, { tone: 'o', rim: false, bias: 9 });
      S.limb(V3(chest, [12, -2, 6], 1), V3(chest, [11, 4, 8], 1), 0.5, 0.5, M.stone, { tone: 'o', rim: false, bias: 9 });
      S.limb(V3(chest, [-6, -10, 12], 1), V3(chest, [-2, -4, 13], 1), 0.5, 0.5, M.stone, { tone: 'o', rim: false, bias: 9 });
      // rune core in the chest
      const corePt = V3(chest, [15, 1, 0], 1);
      S.ball(corePt, 4.2, M.core, { spec: true, bias: 2 });
      S.px(V3(corePt, [0, -1, 0], 1), C.white, { w: 2, h: 2, bias: 3 });
      // small sunk-in head
      const head = [lean + 9, -59 + bob, 0];
      S.ball(head, 7.2, M.stone, { spec: true, bias: -1 });
      S.limb(V3(head, [4, -3, -5], 1), V3(head, [4, -3, 5], 1), 1.6, 1.6, M.stoneDark, { bias: 1 });
      for (const sz of [-1, 1]) S.px(V3(head, [6.3, -0.5, 2.8 * sz], 1), C.cyan, { w: 2, h: 2, bias: 3 });
      // arms with boulder fists
      for (const [i, hand] of hands.entries()) {
        const sz = i ? 1 : -1;
        const sh = [lean - 1, -52 + bob, 16 * sz];
        const h2 = reach(sh, hand, 34);
        const el = joint(sh, h2, 34, [-0.7, 0.5, 0.3 * sz]);
        S.bone2(sh, el, h2, 5.5, 5, 6, M.stoneDark, M.stone);
        S.ball(sh, 9, M.stone, { spec: true, bias: 0.2 });
        S.ball(V3(sh, [-2, -6, 1 * sz], 1), 3, M.stoneDark, { bias: 0.4 });
        S.ball(h2, 8, M.stone, { spec: true, bias: 0.3 });
      }
    }
  };

  // Frost wolf: white fur, ice spikes along the back, glowing eyes
  MOBS.frost_wolf = {
    W: 84, H: 60, AX: 42, AY: 54,
    frames: { idle: 4, walk: 6, attack: 5, hurt: 1 },
    draw(S, p) {
      const { action, t } = p;
      const moving = action === 'walk';
      const w = t * Math.PI * 2;
      let fwd = 0, headDip = 0, jaw = 0, rear = 0;
      const bob = moving ? Math.abs(Math.cos(w)) * 1.5 : Math.sin(w) * 0.5;
      if (action === 'attack') {
        const k = t < 0.35 ? t / 0.35 : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        const lunge = t < 0.35 ? -2 * k : t < 0.7 ? 6 : 6 * k;
        fwd = lunge; headDip = t < 0.35 ? -2 : 3; jaw = t >= 0.35 && t < 0.8 ? 1 : 0.4;
      } else if (action === 'hurt') { fwd = -3; rear = 2; }
      const by = -19 - bob;
      const rump = [fwd - 10, by + rear, 0], breast = [fwd + 9, by - 1, 0];
      // legs (trot: diagonal pairs move together)
      const legs = [[9, -4.5, 0], [9, 4.5, Math.PI], [-9, -4.5, Math.PI], [-9, 4.5, 0]];
      for (const [lx, lz, ph] of legs) {
        const hip = [fwd + lx, by + 3, lz];
        const s = moving ? Math.sin(w + ph) : 0;
        const lift = moving ? Math.max(0, Math.cos(w + ph)) * 3 : 0;
        const foot = [fwd + lx + s * 5, -lift, lz * 1.05];
        const knee = joint(hip, foot, 19, lx > 0 ? [-0.3, 0, 0] : [-1, 0, 0]);
        S.bone2(hip, knee, [foot[0], foot[1] - 1.4, foot[2]], 3.2, 2.2, 1.9, M.fur);
        S.ball([foot[0] + 1, foot[1] - 1.2, foot[2]], 2.3, M.fur, { sy: 0.6 });
      }
      // tail
      const wag = Math.sin(w * (moving ? 1 : 0.5)) * 2;
      S.limb(V3(rump, [-4, -1, 0], 1), V3(rump, [-13, -6 + wag, 0], 1), 3.6, 2.2, M.fur, { bias: -2 });
      S.ball(V3(rump, [-13.5, -6.5 + wag, 0], 1), 2.2, M.ice, { bias: -1.9 });
      // body
      S.limb(rump, breast, 8.5, 9.5, M.fur, { spec: true });
      // ice spikes along the back
      for (let i = 0; i < 5; i++) {
        const base = mix3(V3(breast, [0, -8.5, 0], 1), V3(rump, [2, -7, 0], 1), i / 4);
        S.gem(base, 4 - i * 0.4, 1.8, M.ice, { tilt: -0.5, tail: 0.3, bias: -0.5 });
      }
      // neck and head
      const head = [fwd + 18, by - 6 + headDip, 0];
      S.limb(breast, head, 6.5, 5.5, M.fur, { bias: 0.5 });
      S.ball(head, 6.2, M.fur, { spec: true, bias: 1 });
      for (const sz of [-1, 1]) {
        S.shape([V3(head, [-3, -4, 3 * sz], 1), V3(head, [-4.5, -11, 3.5 * sz], 1), V3(head, [0, -5, 3 * sz], 1)], M.fur, { bias: 0.8 });
        S.px(V3(head, [4, -1.8, 2.4 * sz], 1), C.cyan, { w: 2, bias: 3 });
      }
      // snout and jaw
      S.limb(V3(head, [3, 0.5, 0], 1), V3(head, [10, 2.5 + jaw * 0.5, 0], 1), 3.2, 2.3, M.fur, { bias: 1.5 });
      S.limb(V3(head, [3, 3.5, 0], 1), V3(head, [8.5, 4.5 + jaw * 3.5, 0], 1), 2, 1.5, M.fur, { bias: 1.4 });
      if (jaw > 0.5) {
        S.px(V3(head, [8, 3.4 + jaw, 0.8], 1), C.white, { bias: 2 });
        S.px(V3(head, [6, 3.6 + jaw, 0.8], 1), C.white, { bias: 2 });
      }
      S.ball(V3(head, [10.6, 2, 0], 1), 1.3, M.dark, { rim: false, tone: 'm', bias: 2 });
    }
  };

  // Floating ice elemental: shards around a glowing core
  MOBS.ice_elemental = {
    W: 64, H: 72, AX: 32, AY: 66,
    frames: { idle: 6, walk: 6, attack: 5, hurt: 1 },
    draw(S, p) {
      const { action, t } = p;
      const w = t * Math.PI * 2;
      const bob = Math.sin(w) * 2;
      let arm = 0, flare = 0, tilt = 0;
      if (action === 'attack') { const k = Math.sin(Math.min(1, t / 0.6) * Math.PI); arm = 8 * k; flare = k; }
      else if (action === 'hurt') { tilt = -0.25; arm = -3; }
      else if (action === 'walk') tilt = 0.15;
      const cy = -32 + bob;
      // tapering tail with frost wisps
      S.gem([0, cy + 13, 0], 6, 5, M.ice, { tail: 2.2, bias: -1 });
      S.px([-2, cy + 26, 1], M.ice.l, { bias: 2 });
      S.px([2, cy + 23, -1], M.ice.h, { bias: 2 });
      // orbiting splinters
      for (let i = 0; i < 3; i++) {
        const a = w + i * (Math.PI * 2 / 3);
        S.gem([Math.cos(a) * 14, cy + 2 + Math.sin(a * 2) * 2, Math.sin(a) * 14], 3, 1.5, M.ice, { tilt: a * 0.3 });
      }
      // body crystals
      S.gem([0, cy - 4, 0], 12, 8, M.ice, { tilt, spec: true });
      for (const sz of [-1, 1]) S.gem([-1, cy - 8, 8 * sz], 7, 3.5, M.ice, { tilt: tilt - 0.6 * sz * (S.s < 0 ? -1 : 1) });
      // core
      S.ball([2, cy, 0], 5.5 + flare * 2, M.iceCore, { spec: true, bias: 4 });
      S.px([1, cy - 2, 0], C.white, { w: 2, h: 2, bias: 6 });
      // head crystal with eyes
      const head = [1.5, cy - 19, 0];
      S.gem(head, 7, 4.5, M.ice, { tilt: tilt * 0.5, spec: true, bias: 1 });
      for (const sz of [-1, 1]) S.px(V3(head, [3, 0, 1.6 * sz], 1), C.cyanHot, { bias: 3 });
      // arms: floating blades
      for (const sz of [-1, 1]) {
        S.gem([5 + arm, cy - 1, 12 * sz], 6, 2.5, M.ice, { tilt: 1.3 + tilt, bias: 0.5 });
      }
    }
  };

  // Frost titan: armoured giant with a horned helm and an ice warhammer
  MOBS.frost_titan = {
    W: 124, H: 124, AX: 62, AY: 116,
    frames: { idle: 4, walk: 6, attack: 6, hurt: 1 },
    draw(S, p) {
      const { action, t } = p;
      const moving = action === 'walk';
      const w = t * Math.PI * 2;
      const bob = moving ? Math.abs(Math.cos(w)) * 2.4 : Math.sin(w) * 0.9;
      const swing = moving ? Math.sin(w) : 0;
      let lean = moving ? 2 : 0, hand, ang, farHand;
      if (action === 'attack') {
        const k = t < 0.45 ? t / 0.45 : 1, slam = t < 0.45 ? 0 : t < 0.7 ? (t - 0.45) / 0.25 : 1;
        hand = slam > 0 ? mix3([-2, -96, 14], [22, -40, 13], slam) : mix3([10, -40, 22], [-2, -96, 14], k);
        ang = slam > 0 ? lerp(-2.2, 0.55, slam) : lerp(1.1, -2.2, k);
        lean = slam > 0 ? 7 * slam : -3 * k;
        farHand = V3(hand, [Math.cos(ang), Math.sin(ang), -2], 8);
        farHand[2] = 2;
      } else if (action === 'hurt') {
        lean = -5; hand = [4, -44, 23]; ang = 1.4; farHand = [2, -46, -23];
      } else {
        hand = [10 - swing * 5, -42 + bob, 23]; ang = 1.1; farHand = [6 + swing * 5, -42 + bob, -23];
      }
      const hipY = -32 + bob;
      const feet = walkFeet(t, 9, 4, 11, moving);
      for (const [i, foot] of feet.entries()) {
        const hip = [0, hipY, i ? 11 : -11];
        const knee = joint(hip, foot, 33, [1, 0, 0]);
        S.bone2(hip, knee, [foot[0], foot[1] - 4, foot[2]], 7, 7, 7.5, M.frostSkin, M.armor);
        S.ball(knee, 4.5, M.ice, { bias: 0.3 });
        S.ball([foot[0] + 2.5, foot[1] - 3, foot[2]], 7.5, M.armor, { sy: 0.55 });
      }
      // loin plates and belt
      S.shape([[7, hipY, -7], [7, hipY, 7], [9, hipY + 14, 5], [9, hipY + 14, -5]], M.armor, { bias: 6 });
      const chest = [lean, -56 + bob, 0];
      S.ball(chest, 20, M.armor, { sy: 0.95, spec: true });
      S.ball(V3(chest, [11, 0, 0], 1), 7, M.ice, { spec: true, bias: 4 });
      S.ball([1, hipY - 3, 0], 14, M.armor, { sy: 0.35, bias: 2 });
      S.gem([15, hipY - 3, 0], 3, 2.5, M.iceCore, { bias: 6 });
      // head: frost-blue face under a horned helm, icicle beard
      const head = [lean + 6, -81 + bob, 0];
      S.ball(head, 8, M.frostSkin, { bias: 1 });
      S.ball(V3(head, [-0.5, -2.8, 0], 1), 8.8, M.armor, { sy: 0.78, spec: true, bias: 1.1 });
      for (const sz of [-1, 1]) {
        S.px(V3(head, [6.6, 0, 3 * sz], 1), C.cyanHot, { w: 2, bias: 3 });
        S.shape([V3(head, [-1, -6, 7 * sz], 1), V3(head, [-8, -20, 12 * sz], 1), V3(head, [-4, -17, 9.5 * sz], 1), V3(head, [1, -4, 8 * sz], 1)], M.ice, { bias: 0.5 });
      }
      S.shape([V3(head, [5, 4, -4], 1), V3(head, [5, 4, 4], 1), V3(head, [8, 15, 0], 1)], M.ice, { bias: 3 });
      // arms; the near hand holds the hammer
      for (const [sz, hd] of [[-1, farHand], [1, hand]]) {
        const sh = [lean - 1, -67 + bob, 20 * sz];
        const h2 = reach(sh, hd, 38);
        const el = joint(sh, h2, 38, [-0.7, 0.5, 0.3 * sz]);
        S.bone2(sh, el, h2, 6, 6, 6.5, M.frostSkin, M.armor);
        S.ball(sh, 8, M.armor, { spec: true, bias: 0.3 });
        S.gem(V3(sh, [-1, -7, 0], 1), 7, 2.5, M.ice, { tilt: -0.3 * sz, bias: 0.35 });
        S.ball(h2, 6, M.armor, { bias: 0.4 });
        if (sz > 0) {
          const dir = [Math.cos(ang), Math.sin(ang), 0];
          const headPt = V3(h2, dir, 30);
          S.limb(V3(h2, dir, -6), headPt, 1.8, 1.8, M.wood, { bias: 0.2 });
          const perp = [-dir[1], dir[0], 0];
          S.limb(V3(headPt, perp, -8), V3(headPt, perp, 8), 6.5, 6.5, M.ice, { spec: true, bias: 0.5 });
          S.gem(V3(headPt, perp, 8), 4, 2, M.iceCore, { tilt: Math.atan2(perp[0], -perp[1]), bias: 0.7 });
        }
      }
    }
  };

  // ---------------------------------------------------------------- shopkeepers
  // One human rig dressed per shopkeeper. pose: { near: hand, far: hand, lean, bob }
  function human(S, o, pose) {
    const b = o.broad || 1, bob = pose.bob || 0, lean = pose.lean || 0;
    const hipY = -17 + bob;
    if (o.robe) {
      S.limb([0, hipY, 0], [0.5, -2, 0], 6 * b, 8.5 * b, o.robe === true ? M.robe : o.robe, {});
      S.ball([1, -1.5, 0], 8.5 * b, o.robe === true ? M.robeDark : o.robe, { sy: 0.3, bias: 0.2 });
    } else {
      const feet = pose.feet || [[0.5, 0, -3.4 * b], [0.5, 0, 3.4 * b]];
      for (const foot of feet) {
        const sz = foot[2] < 0 ? -1 : 1;
        const hip = [0, hipY, 3.2 * sz * b], ankle = [foot[0], foot[1] - 1.5, foot[2]];
        const knee = joint(hip, ankle, 16, [1, 0, 0]);
        S.bone2(hip, knee, ankle, 2.7 * b, 2.5 * b, 2.4 * b, o.pants);
        S.ball([foot[0] + 1.1, foot[1] - 1.5, foot[2]], 2.9, o.boots, { sy: 0.65 });
      }
      if (o.dress) {
        S.limb([0, hipY - 1, 0], [0.5, -6, 0], 6 * b, 8 * b, o.dress, { bias: 0.6 });
        if (o.hem) S.ball([0.5, -6, 0], 8 * b, o.hem, { sy: 0.28, bias: 0.7 });
      }
    }
    const chest = [lean, -29 + bob, 0];
    S.limb([0, hipY - 1, 0], chest, 6 * b, 6.6 * b, o.torso);
    if (o.belly) S.ball([3, -21 + bob, 0], 6.5 * b, o.apron || o.torso, { bias: 1 });
    if (o.shirtStrip) S.shape([[lean + 5.8 * b, -30 + bob, -2], [lean + 5.8 * b, -30 + bob, 2], [5.2 * b, hipY, 2], [5.2 * b, hipY, -2]], o.shirtStrip, { bias: 6 });
    if (o.apron) S.shape([[lean + 5.6 * b, -24 + bob, -3.5], [lean + 5.6 * b, -24 + bob, 3.5], [6.4 * b, -9, 4.5], [6.4 * b, -9, -4.5]], o.apron, { bias: 7 });
    S.ball([0.3, hipY - 1.3, 0], 6.4 * b, o.belt, { sy: 0.3, bias: 1.5 });
    if (o.buckle) S.px([6.4 * b, hipY - 1.6, 0], o.buckle, { w: 2, h: 2, bias: 8 });
    // head
    const head = [lean + 1, -37.5 + bob, 0];
    S.limb(chest, head, 2.4, 2.4, o.skin, { bias: -0.5 });
    if (o.hairBack) S.ball(V3(head, [-2.2, -1, 0], 1), 6.2, o.hair, { sy: 0.95, bias: -0.8 });
    if (o.fringe) S.ball(V3(head, [-2.5, 0.5, 0], 1), 4.8, o.hair, { sy: 0.65, bias: -0.6 });
    S.ball(head, 5.8, o.skin, { spec: true });
    if (o.hairTop) {
      // cap of hair ending in bangs just above the eyes
      S.ball(V3(head, [-0.6, -3.8, 0], 1), 6.4, o.hair, { sy: 0.55, bias: 0.3 });
    }
    for (const sz of [-1, 1]) {
      S.px(V3(head, [4.8, -0.6, 2.1 * sz], 1), C.eye, { h: 2, bias: 3 });
      S.px(V3(head, [4.6, -2.4, 2.1 * sz], 1), o.brow, { w: 2, bias: 3 });
      S.px(V3(head, [4.4, 1.6, 3.2 * sz], 1), C.blush, { bias: 2.6 });
    }
    S.px(V3(head, [6, 0.8, 0], 1), o.skin.d, { h: 2, bias: 3.2 });
    if (o.moustache) S.limb(V3(head, [5.4, 2.6, -2.6], 1), V3(head, [5.4, 2.6, 2.6], 1), 1.1, 1.1, o.moustache, { bias: 3.4 });
    if (o.beard) S.shape([V3(head, [4, 1.5, -4], 1), V3(head, [4, 1.5, 4], 1), V3(head, [6, 14, 0], 1)], o.beard, { bias: 3.3 });
    if (o.hat) o.hat(S, head);
    // arms
    for (const [sz, hand] of [[-1, pose.far], [1, pose.near]]) {
      const sh = [lean, -28 + bob, 6.8 * sz * b];
      const h2 = reach(sh, hand, 17);
      const el = joint(sh, h2, 17, [-0.6, 0.6, 0.3 * sz]);
      S.bone2(sh, el, h2, 2.5 * b, 2.3 * b, 2.1 * b, o.sleeve, o.forearm || o.sleeve);
      S.ball(h2, 2.1 * b, o.skin, { bias: 0.1 });
      if (sz > 0 && o.tool) o.tool(S, h2, pose);
      if (sz < 0 && o.carry) o.carry(S, h2, pose);
      if (pose.glow) S.px(V3(h2, [1.5, -2.5, 0], 1), C.violet, { bias: 1 });
    }
  }

  // A material ramp from one base colour
  function ramp(hex) {
    const c = hexRgb(hex);
    const to = (k) => '#' + c.map(v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))).map(v => v.toString(16).padStart(2, '0')).join('');
    return mat(to(-0.78), to(-0.3), hex, to(0.22), to(0.42));
  }
  // The four market stall keepers (same outfits as the old 3D keepers)
  const KEEPERS = [
    { skin: '#e8b48a', shirt: '#b5651d', pants: '#4b3621', boots: '#2b1d14', belt: '#3b2a1a', hair: '#5a3825', apron: '#f2e6cf' },
    { skin: '#c68b59', shirt: '#2c5d8a', pants: '#3b3b48', boots: '#22222a', belt: '#2a2a33', hair: '#1f1a17', beard: '#1f1a17' },
    { skin: '#f0c9a0', shirt: '#6a8f3a', pants: '#5a4630', boots: '#2b1d14', belt: '#3b2a1a', hair: '#c9772e', apron: '#e9dcc0' },
    { skin: '#d9a77a', shirt: '#5b3a7a', pants: '#3a2f45', boots: '#1f1a24', belt: '#2b2233', hair: '#d9d4cc', bald: true, beard: '#d9d4cc' }
  ].map(k => ({
    skin: ramp(k.skin), torso: ramp(k.shirt), sleeve: ramp(k.shirt), pants: ramp(k.pants), boots: ramp(k.boots), belt: ramp(k.belt),
    hair: ramp(k.hair), brow: ramp(k.hair).d, apron: k.apron ? ramp(k.apron) : null,
    beard: k.beard ? ramp(k.beard) : null, moustache: k.beard ? ramp(k.beard) : null,
    hairBack: !k.bald, hairTop: !k.bald, fringe: !!k.bald
  }));

  // Townsfolk strolling the streets (outfits from renderer.buildTownsfolk)
  function townsfolkLook(outfit, skin) {
    const tunic = ramp(outfit.tunic);
    const look = {
      skin: ramp(skin), torso: tunic, sleeve: tunic, pants: ramp(outfit.legs), boots: ramp('#3d2817'), belt: ramp('#4a2f1c'),
      hair: ramp(outfit.hair), brow: ramp(outfit.hair).d, hairBack: !outfit.hat, hairTop: !outfit.hat,
      buckle: outfit.trim ? hexRgb(outfit.trim) : null,
      shirtStrip: outfit.trim ? ramp(outfit.trim) : null,
      apron: outfit.apron ? ramp('#efe6cf') : null,
      dress: outfit.dress ? tunic : null, hem: outfit.dress ? ramp(outfit.trim || '#e8dcc0') : null
    };
    if (outfit.beard) { look.beard = ramp(outfit.hair); look.moustache = ramp(outfit.hair); }
    if (outfit.hat) {
      const hat = ramp(outfit.hat), band = ramp(outfit.band || '#3b2a1a');
      look.hairBack = true;
      look.hat = (S, head) => {
        S.ball(V3(head, [0.3, -3.4, 0], 1), 8.6, hat, { sy: 0.24, bias: 0.6 });
        S.ball(V3(head, [-0.3, -5.4, 0], 1), 5.4, hat, { sy: 0.62, spec: true, bias: 0.7 });
        S.ball(V3(head, [-0.2, -4.2, 0], 1), 5.6, band, { sy: 0.2, bias: 0.75 });
      };
    }
    if (outfit.staff) {
      look.tool = (S, hand) => {
        S.limb(V3(hand, [0.5, -14, 0], 1), V3(hand, [1, 16, 0], 1), 1, 1, M.wood, { bias: 0.3 });
        S.ball(V3(hand, [0.5, -15.5, 0], 1), 1.8, M.iceCore, { spec: true, bias: 0.4 });
      };
    }
    if (outfit.basket) {
      look.carry = (S, hand) => {
        S.ball(V3(hand, [0.5, 3.5, 0], 1), 3.8, M.wood, { sy: 0.75, bias: 0.3 });
        S.limb(V3(hand, [-3, 2, 0], 1), V3(hand, [3.5, 2, 0], 1), 0.6, 0.6, M.wood, { tone: 'l', rim: false, bias: 0.35 });
        S.px(V3(hand, [-1, 1.4, 0], 1), hexRgb('#d63031'), { w: 2, bias: 0.5 });
        S.px(V3(hand, [1.5, 1.2, 0], 1), hexRgb('#7cb342'), { w: 2, bias: 0.5 });
      };
    }
    return look;
  }

  function buildTownsfolkFrame(outfit, skin, back, frame) {
    const f = newFrame(52, 68, 26, 63);
    const S = new Scene(f, back ? VIEW_PHI.back : VIEW_PHI.front);
    const moving = frame > 0, t = moving ? (frame - 1) / 6 : 0;
    const swing = moving ? Math.sin(t * Math.PI * 2) : 0;
    human(S, townsfolkLook(outfit, skin), {
      bob: moving ? -Math.abs(Math.cos(t * Math.PI * 2)) * 0.8 : 0,
      feet: walkFeet(t, 4, 2.2, 3.4, moving),
      near: [1 - swing * 3.5, -14, 7.5],
      far: outfit.basket ? [4, -18, -7] : [1 + swing * 3.5, -14, -7.5]
    });
    S.draw();
    return f;
  }

  const NPCS = {
    // Market stall keepers lean on the counter and call out to passers-by
    stallkeeper: {
      W: 56, H: 72, AX: 28, AY: 66, view: 'front', period: 5, frames: 20,
      draw(S, t, variant) {
        const cyc = t * 5, call = cyc > 3 && cyc < 4.4 ? Math.sin(((cyc - 3) / 1.4) * Math.PI) : 0;
        human(S, KEEPERS[variant % KEEPERS.length], {
          bob: Math.sin(t * Math.PI * 2 * 2) * 0.4,
          near: mix3([8, -21, 6], [6, -40, 9], call),
          far: [8, -21, -6]
        });
      }
    },
    // Olaf: green cap with a feather, ginger moustache; waves every 6 seconds
    merchant: {
      W: 56, H: 72, AX: 28, AY: 66, view: 'front', period: 6, frames: 24,
      draw(S, t) {
        const cyc = t * 6, wave = cyc < 1.6 ? Math.sin((cyc / 1.6) * Math.PI) : 0;
        const wig = Math.sin(cyc * 14) * 2 * wave;
        human(S, {
          skin: M.skinOlaf, hair: M.ginger, brow: M.ginger.d, moustache: M.ginger, hairBack: true,
          torso: M.vest, shirtStrip: M.shirtBlue, sleeve: M.shirtBlue, pants: M.pantsBrown, boots: M.boots, belt: M.boots, buckle: M.gold.l,
          hat: (S2, head) => {
            S2.ball(V3(head, [0.4, -3.6, 0], 1), 8.4, M.capGreen, { sy: 0.24, bias: 0.6 });
            S2.ball(V3(head, [-0.4, -5.5, 0], 1), 5.8, M.capGreen, { sy: 0.55, spec: true, bias: 0.7 });
            S2.limb(V3(head, [-3, -6, -4], 1), V3(head, [-8, -14, -5], 1), 1.3, 0.5, M.feather, { bias: 0.2 });
          }
        }, {
          bob: Math.sin(t * Math.PI * 2 * 3) * 0.4,
          near: mix3([3, -14, 8.5], [4 + wig, -46, 10], wave),
          far: [9, -21, -6]
        });
      }
    },
    // Brom: burly and bald with a long grey beard, hammering the anvil
    blacksmith: {
      W: 64, H: 76, AX: 30, AY: 70, view: 'front', period: 1.3, frames: 10,
      draw(S, t) {
        let lift;
        if (t < 0.55) lift = Math.sin((t / 0.55) * Math.PI * 0.5);
        else if (t < 0.68) lift = 1 - (t - 0.55) / 0.13;
        else lift = 0;
        const ang = lerp(0.9, -2.2, lift);
        human(S, {
          broad: 1.22, belly: true, fringe: true,
          skin: M.skinBrom, hair: M.pantsBrown, brow: M.pantsBrown.m, beard: M.greyBeard, moustache: M.greyBeard,
          torso: M.shirtBrom, apron: M.apron, sleeve: M.skinBrom, pants: M.slate, boots: M.blackBoots, belt: M.blackBoots,
          tool: (S2, hand) => {
            const dir = [Math.cos(ang), Math.sin(ang), 0];
            const hd = V3(hand, dir, 11);
            S2.limb(V3(hand, dir, -1.5), hd, 1, 1, M.wood, { bias: 0.2 });
            const perp = [-dir[1], dir[0], 0];
            S2.limb(V3(hd, perp, -3), V3(hd, perp, 3.5), 2.6, 2.6, M.hammerHead, { spec: true, bias: 0.4 });
          }
        }, {
          lean: (1 - lift) * 1.5, bob: 0,
          near: mix3([10, -22, 9], [2, -46, 9], lift),
          far: [10, -23, -7]
        });
      }
    },
    // Valka: silver-haired enchantress in violet robes, weaving runes
    enchanter: {
      W: 60, H: 84, AX: 30, AY: 76, view: 'side', phi: 0.3, period: Math.PI, frames: 12,
      draw(S, t) {
        const w = t * Math.PI * 2;
        human(S, {
          broad: 0.92, robe: true, hairBack: true, hairTop: true,
          skin: M.skinValka, hair: M.silver, brow: M.silver.d, torso: M.robe, sleeve: M.robe, apron: M.robeDark,
          belt: M.gemGold, buckle: M.gemGold.h,
          hat: (S2, head) => {
            S2.ball(V3(head, [0.5, -4.6, 0], 1), 9.5, M.hatPurple, { sy: 0.22, bias: 0.8 });
            S2.shape([V3(head, [-5.5, -5.5, 0], 1), V3(head, [5.5, -5.5, 0], 1), V3(head, [-5, -22, 0], 1)], M.hatPurple, { bias: 0.9 });
            S2.ball(V3(head, [0.2, -6, 0], 1), 5.6, M.gemGold, { sy: 0.22, bias: 1 });
          }
        }, {
          bob: Math.sin(w) * 0.4, lean: 0.5, glow: true,
          near: [11, -33 + Math.sin(w) * 2, 5],
          far: [11, -32 + Math.sin(w + 1.2) * 2, -5]
        });
      }
    }
  };

  // ---------------------------------------------------------------- chest
  // A treasure chest rendered texel by texel on the 2:1 iso grid (1 world unit
  // = 1 texel, the same density as the dungeon floor): surfaces are sampled
  // densely and kept by a depth buffer, then lit per face and outlined.
  const CHEST = { L: 22, D: 14, H: 9, W: 48, Hpx: 48, AX: 24, AY: 36 };
  function buildChest(gold, opened) {
    const { L, D, H, W, Hpx, AX, AY } = CHEST;
    const f = newFrame(W, Hpx, AX, AY);
    const zbuf = new Float32Array(W * Hpx).fill(-1e9);
    const P = (x, y, z) => [AX + (x - y), AY + (x + y) * 0.5 - z];
    const depth = (x, y, z) => 0.612 * (x + y) + 0.5 * z;
    const wood = gold ? ['#7a4a0c', '#b8791a', '#e0a533', '#f6cd6a'] : ['#3a2210', '#5c3a1c', '#7c4f27', '#9c6a3a'];
    const iron = gold ? ['#6b4a06', '#c9971c', '#f5d060', '#fff1b0'] : ['#1a1d24', '#3b414d', '#5f6878', '#8a93a3'];
    const W8 = wood.map(hexRgb), I8 = iron.map(hexRgb);
    const LOCK = [hexRgb('#7a5a08'), hexRgb('#facc15'), hexRgb('#fff3b0')];
    const splat = (x, y, z, col) => {
      const [sx, sy] = P(x, y, z), px = Math.floor(sx), py = Math.floor(sy);
      if (px < 0 || py < 0 || px >= W || py >= Hpx) return;
      const d = depth(x, y, z), i = py * W + px;
      if (d < zbuf[i]) return;
      zbuf[i] = d;
      put(f, px, py, col);
    };
    // material at a surface point: shade 0..3, iron bands across the length
    const band = x => Math.abs(Math.abs(x) - L * 0.3) < 1.3;
    const shade = (tone, x, plank) => (band(x) ? I8 : W8)[Math.max(0, Math.min(3, tone - (plank ? 1 : 0)))];
    const S = 0.25;
    // body: front (+y) face lit, side (+x) face darker, bottom rim
    for (let x = -L / 2; x <= L / 2; x += S) for (let z = 0; z <= H; z += S) {
      const plank = z < 1.2;   // darker footing along the bottom
      splat(x, D / 2, z, shade(z > H - 1 ? 2 : 2, x, plank));
    }
    for (let y = -D / 2; y <= D / 2; y += S) for (let z = 0; z <= H; z += S) {
      const plank = z < 1.2;   // darker footing along the bottom
      const edge = Math.abs(y) > D / 2 - 1.2;
      splat(L / 2, y, z, edge ? I8[1] : shade(1, 0, plank));
    }
    const R = D / 2;
    if (!opened) {
      // rounded lid: a half cylinder along x
      for (let x = -L / 2; x <= L / 2; x += S) for (let a = 0; a <= Math.PI; a += 0.03) {
        const y = Math.cos(a) * R, z = H + Math.sin(a) * R * 0.85;
        const tone = a > 2.0 ? 2 : a > 0.9 ? 3 : 1;   // front slope catches the light
        splat(x, y, z, shade(tone, x, false));
      }
      for (let a = 0; a <= Math.PI; a += 0.03) for (let r = 0; r <= R; r += S) {
        splat(L / 2, Math.cos(a) * r, H + Math.sin(a) * r * 0.85, Math.abs(r - R) < 1.1 ? I8[1] : W8[1]);
      }
      // brass lock plate on the front
      for (let x = -2; x <= 2; x += S) for (let z = H - 3.5; z <= H + 1.5; z += S) {
        const c = Math.abs(x) < 0.7 && z < H - 0.5 && z > H - 2.4 ? hexRgb('#2a1d05') : x < -1.2 || z > H + 0.8 ? LOCK[2] : LOCK[1];
        splat(x, D / 2 + 0.3, z, c);
      }
    } else {
      // open: dark inside, heaped gold, lid thrown back on its hinge
      for (let x = -L / 2 + 1; x <= L / 2 - 1; x += S) for (let y = -D / 2 + 1; y <= D / 2 - 1; y += S) {
        const heap = 2.2 - (x * x) / 60 - (y * y) / 30;
        if (heap > 0) {
          const glint = ((Math.floor(x * 2) * 7 + Math.floor(y * 2) * 13) % 11) === 0;
          splat(x, y, H - 1.5 + heap, glint ? LOCK[2] : (Math.floor(x + y) % 2 ? LOCK[1] : hexRgb('#d4a017')));
        } else splat(x, y, H - 1, hexRgb('#140c05'));
      }
      for (let x = -L / 2; x <= L / 2; x += S) for (let a = 0; a <= Math.PI; a += 0.03) {
        // rotate the closed lid about the back top edge (y = -R, z = H) by ~105 degrees
        const y0 = Math.cos(a) * R + R, z0 = Math.sin(a) * R * 0.85, t = 1.83;
        const y = -R + y0 * Math.cos(t) - z0 * Math.sin(t), z = H + y0 * Math.sin(t) + z0 * Math.cos(t);
        splat(x, y, z, shade(a < 1 ? 1 : 2, x, false));
      }
    }
    // outline the silhouette
    const out = hexRgb(gold ? '#2a1802' : '#0d0805');
    const src = f.data.slice();
    const opaque = (x, y) => x >= 0 && y >= 0 && x < W && y < Hpx && src[(y * W + x) * 4 + 3] > 0;
    for (let y = 0; y < Hpx; y++) for (let x = 0; x < W; x++) {
      if (opaque(x, y)) continue;
      if (opaque(x + 1, y) || opaque(x - 1, y) || opaque(x, y + 1) || opaque(x, y - 1)) put(f, x, y, out);
    }
    return f;
  }

  // ---------------------------------------------------------------- colour
  // CSS hue-rotate + saturate, applied to the finished sprite once
  function hueRotate(data, deg, sat) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const h = [
      0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
      0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
      0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072
    ];
    const S2 = [
      0.213 + 0.787 * sat, 0.715 - 0.715 * sat, 0.072 - 0.072 * sat,
      0.213 - 0.213 * sat, 0.715 + 0.285 * sat, 0.072 - 0.072 * sat,
      0.213 - 0.213 * sat, 0.715 - 0.715 * sat, 0.072 + 0.928 * sat
    ];
    const m = [];
    for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) {
      m[r * 3 + col] = S2[r * 3] * h[col] + S2[r * 3 + 1] * h[3 + col] + S2[r * 3 + 2] * h[6 + col];
    }
    for (let i = 0; i < data.length; i += 4) {
      if (!data[i + 3]) continue;
      const R = data[i], G = data[i + 1], B = data[i + 2];
      data[i] = R * m[0] + G * m[1] + B * m[2];
      data[i + 1] = R * m[3] + G * m[4] + B * m[5];
      data[i + 2] = R * m[6] + G * m[7] + B * m[8];
    }
  }

  function whiten(data, k) {
    for (let i = 0; i < data.length; i += 4) {
      if (!data[i + 3]) continue;
      data[i] += (255 - data[i]) * k;
      data[i + 1] += (235 - data[i + 1]) * k;
      data[i + 2] += (235 - data[i + 2]) * k;
    }
  }

  function topRow(f) {
    for (let y = 0; y < f.H; y++) {
      for (let x = 0; x < f.W; x++) if (f.data[(y * f.W + x) * 4 + 3] > 0) return y;
    }
    return f.AY;
  }

  function buildMobFrame(type, view, action, k, hue) {
    const def = MOBS[type];
    const n = def.frames[action];
    const f = newFrame(def.W, def.H, def.AX, def.AY);
    const S = new Scene(f, VIEW_PHI[view] || 0);
    def.draw(S, { action, t: n > 1 ? k / n : 0, k });
    S.draw();
    if (hue) hueRotate(f.data, hue, 1.15);
    if (action === 'hurt') whiten(f.data, 0.45);
    return f;
  }

  function buildNpcFrame(type, k, variant, view) {
    const def = NPCS[type];
    const f = newFrame(def.W, def.H, def.AX, def.AY);
    const S = new Scene(f, view ? VIEW_PHI[view] : def.phi !== undefined ? def.phi : VIEW_PHI[def.view]);
    def.draw(S, k / def.frames, variant || 0);
    S.draw();
    return f;
  }

  const api = {
    types: Object.keys(MOBS),
    has: type => !!MOBS[type],
    hasNpc: type => !!NPCS[type],
    frameCount: (type, action) => MOBS[type].frames[action],
    buildMobFrame, buildNpcFrame, buildTownsfolkFrame, buildChest
  };

  // ---------------------------------------------------------------- browser
  if (typeof document !== 'undefined') {
    const toCanvas = (f) => {
      const c = document.createElement('canvas');
      c.width = f.W; c.height = f.H;
      c.getContext('2d').putImageData(new ImageData(f.data, f.W, f.H), 0, 0);
      c.anchorX = f.AX;
      c.anchorY = f.AY;
      c.top = topRow(f);
      return c;
    };
    const cache = new Map();
    // A monster frame as a canvas; each type/hue/view/action is built on first use
    api.mobFrame = (type, view, action, k, hue) => {
      const def = MOBS[type];
      if (!def.frames[action]) action = 'idle';
      const key = `${type}|${hue || 0}|${view}|${action}`;
      let list = cache.get(key);
      if (!list) {
        list = [];
        for (let i = 0; i < def.frames[action]; i++) list.push(toCanvas(buildMobFrame(type, view, action, i, hue)));
        cache.set(key, list);
      }
      return list[((k % list.length) + list.length) % list.length];
    };
    // A shopkeeper frame at time t (seconds); their loops are short and cached
    // view overrides the shopkeeper's usual angle (e.g. 'back' when their stall is turned)
    api.npcFrame = (type, t, variant, view) => {
      const def = NPCS[type];
      const k = Math.floor(((t % def.period) / def.period) * def.frames) % def.frames;
      const key = `npc|${type}|${variant || 0}|${view || ''}|${k}`;
      let c = cache.get(key);
      if (!c) { c = toCanvas(buildNpcFrame(type, k, variant, view)); cache.set(key, c); }
      return c;
    };
    // A townsperson: frame 0 stands, 1..6 walk; keyed by their outfit object
    const folkKeys = new WeakMap();
    let folkCount = 0;
    api.townsfolkFrame = (outfit, skin, back, frame) => {
      if (!folkKeys.has(outfit)) folkKeys.set(outfit, folkCount++);
      const key = `folk|${folkKeys.get(outfit)}|${skin}|${back ? 1 : 0}|${frame}`;
      let c = cache.get(key);
      if (!c) { c = toCanvas(buildTownsfolkFrame(outfit, skin, back, frame)); cache.set(key, c); }
      return c;
    };
    // Dungeon treasure chest, closed or opened (anchor = centre of its base)
    api.chestFrame = (gold, opened) => {
      const key = `chest|${gold ? 1 : 0}|${opened ? 1 : 0}`;
      let c = cache.get(key);
      if (!c) { c = toCanvas(buildChest(gold, opened)); cache.set(key, c); }
      return c;
    };
    // Length of a shopkeeper's animation loop in seconds
    api.npcPeriod = type => NPCS[type].period;
    root.PixelMobs = api;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
