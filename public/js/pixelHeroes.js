// Slop Hero - procedural pixel-art hero sprites.
// Every class is a small 2D skeleton (IK legs that keep feet planted, IK arms that
// grip the weapon) posed per action and rasterised pixel by pixel with cylinder
// shading and per-part outlines. Frames face right; the renderer flips them.
(function (root) {
  'use strict';

  const W = 80, H = 72;          // frame size
  const AX = 40, AY = 66;        // anchor (feet on the ground)
  const LIGHT = [-0.54, -0.84];  // light from the upper left

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
    steel: mat('#10131d', '#4b566b', '#8593ad', '#c3ccdc', '#f5f7fa'),
    darkSteel: mat('#0e121b', '#313a4d', '#586280', '#808cae'),
    platemail: mat('#141824', '#5a6485', '#8a97b9', '#c5cee6', '#f7f9ff'),
    goldTrim: mat('#2a2005', '#b8941f', '#e6b63d', '#f5d16e', '#fff3c4'),
    tabard: mat('#190f08', '#7a2f16', '#b63f1f', '#e85d2a'),
    cape: mat('#160606', '#7a1414', '#b71c1c', '#e53935'),
    leather: mat('#1a110a', '#5a371d', '#7f4d27', '#a87c4a'),
    skin: mat('#3a1d12', '#b86f4c', '#e5a47a', '#f6c9a2'),
    gold: mat('#382403', '#9f6a10', '#dca528', '#fde58a', '#fffbe0'),
    navy: mat('#0b111f', '#1d2741', '#303f61', '#4a5d88'),
    robe: mat('#170a2a', '#3c1b69', '#57299b', '#7a4ccc'),
    robeTrim: mat('#2e1d03', '#9a6b12', '#d9a62a', '#fbe08a'),
    beard: mat('#2a2a2e', '#86868f', '#c2c2ca', '#ececf2'),
    mageArmor: mat('#0b0d16', '#272c3f', '#3d4560', '#5f6a8a', '#aab4d4'),
    mageHair: mat('#120c08', '#3a2416', '#5c3a22', '#835634'),
    wood: mat('#1d1107', '#472a12', '#6b421f', '#936238'),
    orb: mat('#04394a', '#0aa0c4', '#43e0f4', '#c9fbff', '#ffffff'),
    rogue: mat('#0a0c12', '#2b303c', '#414959', '#646e83'),
    hood: mat('#07080c', '#1f232c', '#30353f', '#4a5161'),
    strap: mat('#1a0f08', '#4a2c15', '#6b4322', '#93653a'),
    scarf: mat('#03140d', '#0c3a29', '#15583e', '#1f7c58'),
    venom: mat('#05290f', '#15a046', '#49dd7e', '#d6ffe3', '#ffffff'),
    smear: mat('#ffffff', '#cfe8ff', '#e8f4ff', '#ffffff')
  };
  const EYE = hexRgb('#16131f');
  const ROGUE_EYE = hexRgb('#f7d774');

  // ---------------------------------------------------------------- raster
  function newFrame() {
    return { data: new Uint8ClampedArray(W * H * 4), meta: {} };
  }

  function put(f, x, y, rgb, a) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const d = f.data, i = (y * W + x) * 4;
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

  function dot(f, p, rgb) {
    put(f, Math.floor(AX + p[0]), Math.floor(AY + p[1]), rgb);
  }

  // Shapes take rig-space points (origin at the feet) and expose a pixel test
  // returning a pseudo-normal used for shading.
  function capsule(a, b, r1, r2) {
    if (r2 === undefined) r2 = r1;
    const ax = AX + a[0], ay = AY + a[1], bx = AX + b[0], by = AY + b[1];
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

  function disc(c, r, ry) {
    if (ry === undefined) ry = r;
    const cx = AX + c[0], cy = AY + c[1];
    return {
      bbox: [Math.floor(cx - r - 1), Math.floor(cy - ry - 1), Math.ceil(cx + r + 1), Math.ceil(cy + ry + 1)],
      test(px, py) {
        const nx = (px - cx) / r, ny = (py - cy) / ry;
        return nx * nx + ny * ny <= 1 ? [nx, ny] : null;
      }
    };
  }

  function poly(pts) {
    const P = pts.map(p => [AX + p[0], AY + p[1]]);
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

  // Motion smear: a crescent swept by a weapon between two angles
  function smear(f, pivot, a0, a1, r0, r1, m, alpha) {
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
    const cx = AX + pivot[0], cy = AY + pivot[1];
    for (let y = Math.floor(cy - r1 - 1); y <= cy + r1 + 1; y++) {
      for (let x = Math.floor(cx - r1 - 1); x <= cx + r1 + 1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const d = Math.hypot(dx, dy);
        if (d < r0 || d > r1) continue;
        let a = Math.atan2(dx, dy);
        while (a < lo) a += Math.PI * 2;
        while (a > hi + 1e-9) a -= Math.PI * 2;
        if (a < lo) continue;
        // newest part of the swing (a1 side) is the most opaque
        const k = (a - a0) / (a1 - a0 || 1);
        const radial = (d - r0) / (r1 - r0);
        const tone = radial > 0.62 ? m.l : m.m;
        put(f, x, y, tone, Math.round(alpha * (0.25 + 0.75 * k)));
      }
    }
  }

  // ---------------------------------------------------------------- vectors
  const add = (a, v, k) => [a[0] + v[0] * k, a[1] + v[1] * k];
  const dirOf = a => [Math.sin(a), Math.cos(a)]; // angle 0 = down, PI/2 = forward, PI = up
  const perpOf = d => [-d[1], d[0]];
  const lerp = (a, b, t) => a + (b - a) * t;

  function ik(rootPt, target, l1, l2, bend) {
    const dx = target[0] - rootPt[0], dy = target[1] - rootPt[1];
    const a = Math.atan2(dy, dx);
    const d = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(l1 + l2 - 0.01, Math.hypot(dx, dy)));
    const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
    const ja = a + bend * A;
    return {
      joint: [rootPt[0] + Math.cos(ja) * l1, rootPt[1] + Math.sin(ja) * l1],
      end: [rootPt[0] + Math.cos(a) * d, rootPt[1] + Math.sin(a) * d]
    };
  }

  // Pose -> joint positions (rig space, facing right). phi turns the hero
  // about the vertical axis: 0 = side-on (the authored pose), +PI/2 = facing
  // the camera, -PI/2 = facing away (see projectSkeleton).
  function skeleton(p, rig, phi) {
    const lean = p.lean || 0;
    const up = [Math.sin(lean), -Math.cos(lean)];
    const side = [Math.cos(lean), Math.sin(lean)];
    const hip = p.hip;
    const shC = add(hip, up, rig.torso);
    const neck = add(hip, up, rig.torso + 1.4);
    const ht = lean + (p.head || 0);
    const hup = [Math.sin(ht), -Math.cos(ht)];
    const hside = [Math.cos(ht), Math.sin(ht)];
    const head = add(add(neck, hup, rig.headUp), hside, 0.6);
    const shF = add(shC, side, 1.8), shB = add(shC, side, -2.2);
    const hipF = add(hip, side, 1.6), hipB = add(hip, side, -1.4);
    const legF = ik(hipF, [p.footF[0], p.footF[1] - 1.5], rig.thigh, rig.shin, -1);
    const legB = ik(hipB, [p.footB[0], p.footB[1] - 1.5], rig.thigh, rig.shin, -1);
    const wdir = dirOf(p.wpn);
    const armF = ik(shF, p.handF, rig.upper, rig.fore, 1);
    const handBTarget = p.twoHand ? add(armF.end, wdir, -3.2) : p.handB;
    const armB = ik(shB, handBTarget, rig.upper, rig.fore, 1);
    const sk = {
      hip, shC, neck, head, up, side, hup, hside, shF, shB, hipF, hipB,
      kneeF: legF.joint, ankleF: legF.end, kneeB: legB.joint, ankleB: legB.end,
      elbowF: armF.joint, handF: armF.end, elbowB: armB.joint, handB: armB.end,
      wdir, wdirB: dirOf(p.wpnB === undefined ? p.wpn : p.wpnB),
      groundF: p.footF[1] > -0.4, groundB: p.footB[1] > -0.4
    };
    // Turn first, then topple in screen space: a falling hero always drops
    // sideways onto the ground, whichever way they faced
    if (phi) projectSkeleton(sk, p, phi);
    if (p.rot) transformSkeleton(sk, p.rot, p.shift || [0, 0]);
    return sk;
  }

  // Turn the side-on skeleton by phi. Poses are authored in the hero's side
  // plane (x forward, y up); every limb joint also gets a lateral depth z
  // (+ = the near / weapon side, - = the far side). After the turn, forward
  // motion mostly becomes screen depth (squashed into y by DEPTH_K) and the
  // lateral offsets spread the limbs left and right. Torso and head stay
  // billboards: their side / up axes are only re-derived from the turned lean.
  // Facing (nearly) straight at or away from the camera: the class draws its
  // frontal head / cape / chest and keeps both arms in front of the torso.
  // Heads without a frontal version (SP costumes) are drawn 3/4, squeezed by
  // HEAD_TURN_SQUASH so the face sits near the middle.
  const DEPTH_K = 0.4;
  const WEAPON_TILT = 0.35;      // weapons lean out to their hand's side when turned
  const FRONTAL_PHI = 1.2;
  const HEAD_TURN_SQUASH = 0.55;
  const isFrontal = sk => Math.abs(sk.phi || 0) > FRONTAL_PHI;
  function projectSkeleton(sk, p, phi) {
    const c = Math.cos(phi), s = Math.sin(phi);
    const twoHand = !!p.twoHand;
    const Z = {
      shF: 3.6, shB: -3.6, elbowF: 4.4, elbowB: twoHand ? 2.4 : -4.4,
      handF: twoHand ? 1.2 : 4.2, handB: twoHand ? 0.6 : -4.2,
      hipF: 2.4, hipB: -2.4, kneeF: 2.7, kneeB: -2.7, ankleF: 2.7, ankleB: -2.7
    };
    const P = (v, z) => [v[0] * c - z * s, v[1] + v[0] * s * DEPTH_K];
    const D = (v, z) => norm(P(v, z));
    for (const k of ['hip', 'shC', 'neck', 'head', 'shF', 'shB', 'hipF', 'hipB', 'kneeF', 'ankleF', 'kneeB', 'ankleB', 'elbowF', 'handF', 'elbowB', 'handB']) {
      sk[k] = P(sk[k], Z[k] || 0);
    }
    sk.up = D(sk.up, 0);
    sk.side = [-sk.up[1], sk.up[0]];
    sk.hup = D(sk.hup, 0);
    sk.hlat = [-sk.hup[1], sk.hup[0]];   // true left-right axis of the head
    sk.phi = phi;
    sk.hside = isFrontal(sk) ? [sk.hlat[0] * HEAD_TURN_SQUASH, sk.hlat[1] * HEAD_TURN_SQUASH] : sk.hlat;
    sk.wdir = D(sk.wdir, WEAPON_TILT);
    sk.wdirB = D(sk.wdirB, -WEAPON_TILT);
    sk.fwd = norm([c, s * DEPTH_K]); // where a planted boot points
  }

  // A weapon angle (dirOf convention) as it looks after projectSkeleton
  function projectAngle(a, phi, tilt) {
    if (!phi) return a;
    const d = dirOf(a), c = Math.cos(phi), s = Math.sin(phi);
    return Math.atan2(d[0] * c - tilt * s, d[1] + d[0] * s * DEPTH_K);
  }

  // A swept arc a0 -> a1 after projection, unwrapped so it turns the same way
  function projectArc(a0, a1, phi, tilt) {
    if (!phi) return [a0, a1];
    const n = 8;
    let prev = projectAngle(a0, phi, tilt), acc = prev;
    for (let i = 1; i <= n; i++) {
      const cur = projectAngle(a0 + (a1 - a0) * i / n, phi, tilt);
      let d = cur - prev;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      acc += d;
      prev = cur;
    }
    return [projectAngle(a0, phi, tilt), acc];
  }

  // Whole-body rotation (falling over on death)
  function transformSkeleton(sk, rot, shift) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const R = v => [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
    for (const k of Object.keys(sk)) {
      const v = sk[k];
      if (!Array.isArray(v)) continue;
      const r = R(v);
      const isDir = k === 'up' || k === 'side' || k === 'hup' || k === 'hside' || k === 'hlat' || k === 'fwd' || k === 'wdir' || k === 'wdirB';
      sk[k] = isDir ? r : [r[0] + shift[0], r[1] + shift[1]];
    }
    sk.groundF = sk.groundB = false;
    sk.rotated = true;
  }

  // Local-frame helpers: o + side*a + up*b ; head space uses (dx right, dy down)
  const L = (sk, o, a, b) => [o[0] + sk.side[0] * a + sk.up[0] * b, o[1] + sk.side[1] * a + sk.up[1] * b];
  const Hd = (sk, dx, dy) => [sk.head[0] + sk.hside[0] * dx - sk.hup[0] * dy, sk.head[1] + sk.hside[1] * dx - sk.hup[1] * dy];
  // Frontal head space: dx is left-right across the face (never squashed)
  const Hf = (sk, dx, dy) => {
    const lat = sk.hlat || sk.hside;
    return [sk.head[0] + lat[0] * dx - sk.hup[0] * dy, sk.head[1] + lat[1] * dx - sk.hup[1] * dy];
  };

  // ---------------------------------------------------------------- body parts
  function leg(f, sk, which, mats, r) {
    const hip = which === 'F' ? sk.hipF : sk.hipB;
    const knee = which === 'F' ? sk.kneeF : sk.kneeB;
    const ankle = which === 'F' ? sk.ankleF : sk.ankleB;
    const grounded = which === 'F' ? sk.groundF : sk.groundB;
    paint(f, capsule(hip, knee, r[0], r[1]), mats.thigh);
    paint(f, capsule(knee, ankle, r[1], r[2]), mats.shin);
    const sd = [ankle[0] - knee[0], ankle[1] - knee[1]];
    const sl = Math.hypot(sd[0], sd[1]) || 1;
    let fwd = [sd[1] / sl, -sd[0] / sl];
    if (grounded) fwd = sk.fwd || [1, 0];
    const down = [-fwd[1], fwd[0]];
    paint(f, capsule(add(add(ankle, fwd, -0.6), down, 0.8), add(add(ankle, fwd, 3.2), down, 1.1), 1.55, 1.25), mats.boot);
  }

  function arm(f, sk, which, mats, r) {
    const sh = which === 'F' ? sk.shF : sk.shB;
    const el = which === 'F' ? sk.elbowF : sk.elbowB;
    const hand = which === 'F' ? sk.handF : sk.handB;
    paint(f, capsule(sh, el, r[0], r[1]), mats.upper);
    paint(f, capsule(el, hand, r[1], r[2]), mats.fore);
    paint(f, disc(hand, 1.7), mats.hand);
  }

  // ---------------------------------------------------------------- weapons
  function sword(f, hand, d, len) {
    const n = perpOf(d);
    paint(f, capsule(add(hand, d, -3.4), add(hand, d, 1.4), 0.9), M.leather);
    paint(f, disc(add(hand, d, -4.1), 1.15), M.gold, { spec: true });
    paint(f, capsule(add(add(hand, d, 1.8), n, 3.1), add(add(hand, d, 1.8), n, -3.1), 0.85), M.gold, { spec: true });
    paint(f, poly([
      add(add(hand, d, 2.4), n, 1.35), add(add(hand, d, 2.4), n, -1.35),
      add(add(hand, d, len - 2.2), n, -1.1), add(hand, d, len), add(add(hand, d, len - 2.2), n, 1.1)
    ]), M.steel, { spec: true });
    paint(f, capsule(add(hand, d, 3.2), add(hand, d, len - 3), 0.38), M.steel, { tone: 'h', rim: false });
    return add(hand, d, len);
  }

  // Battle staff: dark metal shaft, a blade at the heel, two swept prongs
  // cradling a floating crystal
  function staff(f, hand, d, glow) {
    const n = perpOf(d);
    paint(f, capsule(add(hand, d, -10), add(hand, d, 12.4), 0.85), M.mageArmor);
    paint(f, capsule(add(hand, d, -1.8), add(hand, d, 1.8), 1.05), M.leather);
    spike(f, add(hand, d, -10), [-d[0], -d[1]], 3.4, 1.1, M.robeTrim, { spec: true });
    paint(f, disc(add(hand, d, 11.8), 1.4), M.robeTrim, { spec: true });
    for (const k of [-1, 1]) {
      paint(f, poly([add(add(hand, d, 11.6), n, 0.9 * k), add(add(hand, d, 14.2), n, 3.6 * k), add(add(hand, d, 19), n, 2.6 * k), add(add(hand, d, 15), n, 1.5 * k)]), M.robeTrim, { spec: true });
    }
    const orb = add(hand, d, 16.4);
    paint(f, disc(orb, 3 + glow * 2.6), M.orb, { tone: 'l', rim: false, alpha: Math.round(55 + glow * 90) });
    paint(f, poly([add(orb, d, 3.2), add(orb, n, 1.9), add(orb, d, -3.2), add(orb, n, -1.9)]), M.orb, { spec: true });
    return orb;
  }

  function dagger(f, hand, d) {
    const n = perpOf(d);
    paint(f, capsule(add(hand, d, -1.8), add(hand, d, 1.2), 0.8), M.rogue);
    paint(f, capsule(add(add(hand, d, 1.5), n, 1.7), add(add(hand, d, 1.5), n, -1.7), 0.6), M.darkSteel);
    // curved blade: centre line bends along the normal
    const top = [], bot = [];
    const len = 9;
    for (let s = 0; s <= len; s += 1) {
      const c = add(add(hand, d, 2 + s), n, 0.045 * s * s);
      const w = 1.25 * (1 - s / (len + 1.5));
      top.push(add(c, n, w));
      bot.unshift(add(c, n, -w));
    }
    paint(f, poly(top.concat(bot)), M.venom, { spec: true });
    return add(add(hand, d, 2 + len), n, 0.045 * len * len);
  }

  // ---------------------------------------------------------------- classes
  const RIGS = {
    warrior: { torso: 11, headUp: 4.6, thigh: 9, shin: 9.2, upper: 7, fore: 6.5 },
    mage: { torso: 11.8, headUp: 5.1, thigh: 9.5, shin: 9.6, upper: 7.2, fore: 6.7 },
    rogue: { torso: 10.5, headUp: 4.5, thigh: 8.8, shin: 9, upper: 7, fore: 6.5 }
  };
  function drawWarrior(f, p, sk, view, ph) {
    const C = COSTUME || {};
    const legMats = { thigh: M.plate || M.steel, shin: M.steel, boot: M.leather };
    const armMatsF = C.armMatsF ? C.armMatsF() : { upper: M.plate || M.steel, fore: M.steel, hand: M.leather };
    const armMatsB = C.armMatsB ? C.armMatsB() : { upper: M.darkPlate || M.darkSteel, fore: M.steel, hand: M.leather };
    const tr = p.cape || 0;
    const fl = Math.sin(ph * Math.PI * 2) * (0.7 + tr * 1.5);
    const fl2 = Math.sin(ph * Math.PI * 2 + 1.9) * (0.7 + tr * 1.7);
    const frontal = isFrontal(sk);
    const turn = sk.turn !== undefined ? sk.turn : 1;
    // Cape outline: [shoulder back, shoulder front, hem front, hem middle, hem back].
    const capePts = frontal ? [
      L(sk, sk.shC, -4.6, 1), L(sk, sk.shC, 4.6, 1),
      L(sk, sk.hip, 6.0 + fl * 0.35, -13.5 + tr * 5.5),
      L(sk, sk.hip, 0.4 + fl * 0.7, -15 + tr * 5.5 + fl * 0.6),
      L(sk, sk.hip, -6.0 + fl2 * 0.35, -13.5 + tr * 5.5)
    ] : [
      L(sk, sk.shC, -4.6, 1.3), L(sk, sk.shC, 3.8 - 1.2 * turn, 1.3),
      add(L(sk, sk.hip, 4.0 - 1.4 * turn, -13.5), [-tr * 8 * turn, -tr * 6], 1),
      [sk.hip[0] - (1.8 + 2.2 * turn) - tr * 11 * turn, sk.hip[1] + 14.5 - tr * 7 + fl],
      [sk.hip[0] - (5.6 + 2.5 * turn) - tr * 14 * turn, sk.hip[1] + 12.0 - tr * 8 + fl2]
    ];
    const X = { f, p, sk, view, ph, tr, fl, fl2, capePts };
    const capePoly = C.cape === null ? null : poly(C.cape ? C.cape(X) : capePts);
    const drawCape = () => {
      if (capePoly) paint(f, capePoly, C.capeMat ? C.capeMat() : M.cape);
      if (C.onBack) C.onBack(X);
    };
    const weapon = C.weapon || ((ff, hand, d) => sword(ff, hand, d, 18));
    const wTipUp = sk.handF[1] + sk.wdir[1] * 12 < sk.neck[1];
    const swordBehind = !!p.wBack;
    const drawSword = () => { if (!p.drop) f.meta.tip = weapon(f, sk.handF, sk.wdir); };
    const torso = () => {
      paint(f, poly([L(sk, sk.hip, -4.6, 1.8), L(sk, sk.hip, 4.8, 1.8), L(sk, sk.hip, 5.2, -3.6), L(sk, sk.hip, -4.8, -3.6)]), M.plate || M.darkSteel);
      paint(f, poly([L(sk, sk.shC, -4.5, 1.1), L(sk, sk.shC, 4.9, 1.1), L(sk, sk.hip, 4.3, 1.4), L(sk, sk.hip, -4.1, 1.4)]), M.steel, { spec: true });
      paint(f, capsule(L(sk, sk.shC, -4.2, 1.0), L(sk, sk.shC, 4.6, 1.0), 0.5), M.gold || M.robeTrim, { rim: false, spec: true });
      if (view === 'front') {
        const t0 = frontal ? -1.2 : (-1.2 + 1.6 * turn);
        paint(f, poly([L(sk, sk.shC, t0, -1.4), L(sk, sk.shC, t0 + 2.6, -1.4), L(sk, sk.hip, t0 + 2.6, -4.8), L(sk, sk.hip, t0, -4.8)]), M.tabard);
        paint(f, capsule(L(sk, sk.shC, t0 + 1.3, -1.2), L(sk, sk.hip, t0 + 1.3, -4.6), 0.4), M.gold || M.robeTrim, { rim: false, spec: true });
      }
      paint(f, capsule(L(sk, sk.hip, -4.2, 1.5), L(sk, sk.hip, 4.6, 1.5), 1.0), M.leather, { rim: false });
      paint(f, capsule(L(sk, sk.hip, -4.2, 1.4), L(sk, sk.hip, 4.6, 1.4), 0.55), M.gold || M.robeTrim, { rim: false, spec: true });
      if (view === 'front') paint(f, disc(L(sk, sk.hip, frontal ? 0.2 : 1.6 * turn, 1.5), 1.1), M.gold || M.robeTrim, { rim: false, spec: true });
      if (C.torso) C.torso(X);
    };
    // Facing the camera / away: helmet seen straight on
    const frontalHead = () => {
      paint(f, poly([Hf(sk, -1.4, -5.4), Hf(sk, 1.4, -5.4), Hf(sk, 1.0 + fl * 0.35, -9.2), Hf(sk, -1.0 + fl * 0.35, -9.4)]), M.cape);
      paint(f, poly([Hf(sk, -2.8, -1.2), Hf(sk, 2.8, -1.2), Hf(sk, 2.4, -4.8), Hf(sk, -2.4, -4.8)]), M.plate || M.steel);
      paint(f, disc(Hf(sk, 0, -0.3), 5.6), M.plate || M.steel, { spec: true });
      paint(f, capsule(Hf(sk, -2.8, -1.0), Hf(sk, 2.8, -1.0), 0.8), M.gold || M.robeTrim, { rim: false, spec: true });
      if (view === 'front') {
        paint(f, poly([Hf(sk, -2.8, -0.8), Hf(sk, 2.8, -0.8), Hf(sk, 2.4, 3.8), Hf(sk, -2.4, 3.8)]), M.skin);
        for (const k of [-1, 1]) {
          paint(f, poly([Hf(sk, 3.9 * k, -0.5), Hf(sk, 2.5 * k, -0.5), Hf(sk, 2.5 * k, 4.6), Hf(sk, 3.7 * k, 4.0)]), M.plate || M.steel);
          paint(f, capsule(Hf(sk, 3.7 * k, -0.4), Hf(sk, 2.6 * k, 4.0), 0.3), M.gold || M.robeTrim, { rim: false, spec: true });
        }
        paint(f, capsule(Hf(sk, -3.6, -1.2), Hf(sk, 3.6, -1.2), 0.8), M.plate || M.steel, { tone: 'l', rim: false });
        paint(f, capsule(Hf(sk, -3.6, -1.1), Hf(sk, 3.6, -1.1), 0.5), M.gold || M.robeTrim, { rim: false, spec: true });
        paint(f, capsule(Hf(sk, 0, -1.1), Hf(sk, 0, 2.2), 0.6), M.plate || M.steel, { tone: 'm', rim: false });
        dot(f, Hf(sk, -1.4, 0.5), EYE);
        dot(f, Hf(sk, 1.4, 0.5), EYE);
        paint(f, poly([Hf(sk, -0.8, -5.2), Hf(sk, 0.8, -5.2), Hf(sk, 0.5, -7.6), Hf(sk, -0.5, -7.6)]), M.gold || M.robeTrim, { spec: true });
      } else {
        paint(f, poly([Hf(sk, -4.2, 1.2), Hf(sk, 4.2, 1.2), Hf(sk, 3.8, 4.8), Hf(sk, -3.8, 4.8)]), M.darkSteel);
        paint(f, capsule(Hf(sk, -4.2, 1.1), Hf(sk, 4.2, 1.1), 0.5), M.gold || M.robeTrim, { rim: false, spec: true });
      }
    };
    const head = C.head ? () => C.head(X) : frontal ? frontalHead : () => {
      paint(f, disc(Hd(sk, -0.4, -0.3), 5.6), M.plate || M.steel, { spec: true });
      const pl = (tr * 3) + fl * 0.6;
      paint(f, poly([Hd(sk, 0, -5.5), Hd(sk, -2, -6.6), Hd(sk, -6.5 - pl, -4.6 + fl * 0.5), Hd(sk, -6 - pl * 0.7, -2.8), Hd(sk, -1.5, -4.4)]), M.cape);
      paint(f, capsule(Hd(sk, -0.4, -5.6), Hd(sk, -1.8, -6.8), 0.5), M.gold || M.robeTrim, { rim: false, spec: true });
      if (view === 'front') {
        paint(f, poly([Hd(sk, 0.8, -0.9), Hd(sk, 5.4, -0.9), Hd(sk, 5.0, 3.8), Hd(sk, 1.2, 4.4)]), M.skin);
        paint(f, poly([Hd(sk, 0.6, -1.0), Hd(sk, 5.2, -1.0), Hd(sk, 5.6, -3.6), Hd(sk, -0.2, -4.8), Hd(sk, -0.8, -3.6)]), M.plate || M.steel);
        paint(f, capsule(Hd(sk, 0.4, -1.2), Hd(sk, 5.6, -1.2), 0.8), M.plate || M.steel, { tone: 'l', rim: false });
        paint(f, capsule(Hd(sk, 0.4, -1.1), Hd(sk, 5.6, -1.1), 0.5), M.gold || M.robeTrim, { rim: false, spec: true });
        paint(f, capsule(Hd(sk, 3.8, -1.0), Hd(sk, 4.0, 1.8), 0.5), M.plate || M.steel, { tone: 'm', rim: false });
        paint(f, poly([Hd(sk, -0.8, -0.5), Hd(sk, 1.4, -0.5), Hd(sk, 1.8, 4.8), Hd(sk, -1.0, 4.0)]), M.plate || M.steel);
        paint(f, capsule(Hd(sk, -0.8, -0.4), Hd(sk, 1.4, -0.4), 0.5), M.gold || M.robeTrim, { rim: false, spec: true });
        dot(f, Hd(sk, 2.8, 0.5), EYE);
        dot(f, Hd(sk, 4.8, 0.5), EYE);
      } else {
        paint(f, poly([Hd(sk, -4.8, 1.2), Hd(sk, 3.2, 1.2), Hd(sk, 2.8, 4.8), Hd(sk, -4.4, 4.4)]), M.darkSteel);
        paint(f, capsule(Hd(sk, -4.8, 1.1), Hd(sk, 3.2, 1.1), 0.5), M.gold || M.robeTrim, { rim: false, spec: true });
      }
    };
    const pauldron = C.pauldron ? (pt, m) => C.pauldron(X, pt, m)
      : (pt, m) => { paint(f, disc(add(pt, sk.up, 0.5), 3.4, 2.8), m, { spec: true }); paint(f, capsule(add(add(pt, sk.up, 0.5), sk.side, -1.8), add(add(pt, sk.up, 0.5), sk.side, 1.8), 0.4), M.gold || M.robeTrim, { rim: false, spec: true }); };

    if (C.behind) C.behind(X);
    if (frontal && view === 'front') {
      // Facing the camera: cape behind, both arms at the sides in front
      drawCape();
      if (swordBehind) drawSword();
      leg(f, sk, 'B', legMats, [2.3, 2.0, 1.7]);
      leg(f, sk, 'F', legMats, [2.5, 2.1, 1.8]);
      torso();
      arm(f, sk, 'B', armMatsB, [1.9, 1.7, 1.5]);
      pauldron(sk.shB, M.darkSteel);
      head();
      if (!swordBehind) drawSword();
      arm(f, sk, 'F', armMatsF, [2, 1.8, 1.6]);
      pauldron(sk.shF, M.steel);
    } else if (frontal) {
      // Facing away: the blade held in front is hidden by the body unless raised
      if (!wTipUp) drawSword();
      leg(f, sk, 'F', legMats, [2.5, 2.1, 1.8]);
      leg(f, sk, 'B', legMats, [2.3, 2.0, 1.7]);
      torso();
      head();
      drawCape();
      arm(f, sk, 'F', armMatsF, [2, 1.8, 1.6]);
      arm(f, sk, 'B', armMatsB, [1.9, 1.7, 1.5]);
      pauldron(sk.shF, M.steel);
      pauldron(sk.shB, M.steel);
      if (wTipUp) drawSword();
    } else if (view === 'front') {
      drawCape();
      if (swordBehind) drawSword();
      arm(f, sk, 'B', armMatsB, [1.9, 1.7, 1.5]);
      leg(f, sk, 'B', legMats, [2.3, 2.0, 1.7]);
      leg(f, sk, 'F', legMats, [2.5, 2.1, 1.8]);
      torso();
      pauldron(sk.shB, M.darkSteel);
      head();
      if (!swordBehind) drawSword();
      arm(f, sk, 'F', armMatsF, [2, 1.8, 1.6]);
      pauldron(sk.shF, M.steel);
    } else {
      // Seen from behind the blade sits over the body at the side, and over
      // the cape only once it is raised above the shoulders
      arm(f, sk, 'F', armMatsF, [2, 1.8, 1.6]);
      leg(f, sk, 'F', legMats, [2.5, 2.1, 1.8]);
      leg(f, sk, 'B', legMats, [2.3, 2.0, 1.7]);
      torso();
      head();
      if (!wTipUp) drawSword();
      drawCape();
      arm(f, sk, 'B', armMatsB, [1.9, 1.7, 1.5]);
      pauldron(sk.shF, M.steel);
      pauldron(sk.shB, M.steel);
      if (wTipUp) drawSword();
    }
    if (C.front) C.front(X);
    if (p.drop) weapon(f, [6, -1.4], [1, 0.02]);
  }

  // Battle mage: long split coat over armoured legs, breastplate, ornate
  // pauldrons, high collar, circlet and a crystal battle staff. Coat, trim
  // and gems use robe / robeTrim / orb, so every SP card palette recolours them.
  function drawMage(f, p, sk, view, ph) {
    const C = COSTUME || {};
    const tr = p.cape || 0;
    const sway = Math.sin(ph * Math.PI * 2) * (0.5 + tr * 1.2);
    const X = { f, p, sk, view, ph, tr, sway };
    const staffFn = C.staff || staff;
    const legMats = { thigh: M.robe, shin: M.mageArmor, boot: M.mageArmor };
    const sleeve = { upper: M.robe, fore: M.mageArmor, hand: M.leather };
    const glow = p.glow || 0;
    const frontal = isFrontal(sk);
    const trail = frontal ? 0 : 1; // the hem only streams sideways when seen side-on
    const fx = Math.max(sk.ankleF[0], sk.ankleB[0]) + 2.4;
    const bx = Math.min(sk.ankleF[0], sk.ankleB[0]) - 4.2;
    const hemY = Math.max(sk.ankleF[1], sk.ankleB[1]) - 1.2;
    // coat tails: long behind, cut away in front so the stride shows
    const coat = sk.rotated
      ? poly([L(sk, sk.hip, -4.8, 1), L(sk, sk.hip, 5, 1), L(sk, sk.hip, 5.2, -14), L(sk, sk.hip, -6.4, -15.5)])
      : frontal
        ? poly([L(sk, sk.hip, -5, 1), L(sk, sk.hip, 5, 1), [fx + 0.6, hemY], [(fx + bx) / 2, hemY + 0.8 + sway * 0.3], [bx - 0.6, hemY + sway * 0.4]])
        : poly([
          L(sk, sk.hip, -4.6, 1), L(sk, sk.hip, 3, 1), L(sk, sk.hip, 2.2, -7),
          [(fx + bx) / 2 - 1, hemY - 1 + sway * 0.3], [bx - tr * 4 * trail, hemY - tr * 2.4 + sway]
        ]);
    const pauldron = (pt, big) => {
      const c = add(pt, sk.up, 0.9);
      paint(f, disc(c, big ? 3.5 : 3, big ? 2.6 : 2.2), M.mageArmor, { spec: true });
      paint(f, capsule(add(c, sk.side, -3), add(c, sk.side, 3), 0.55), M.robeTrim, { rim: false, spec: true });
      spike(f, add(c, sk.up, 1.6), norm(add(sk.up, sk.side, -0.35)), big ? 3.6 : 3, 1, M.robeTrim, { spec: true });
    };
    const robeBody = () => {
      paint(f, coat, M.robe);
      if (!sk.rotated) paint(f, capsule([bx - tr * 4 * trail + 0.6, hemY - tr * 2.4 + sway - 0.5], [(fx + bx) / 2, hemY - 0.4], 0.6), M.robeTrim, { rim: false });
      leg(f, sk, 'B', legMats, [2.1, 1.8, 1.6]);
      leg(f, sk, 'F', legMats, [2.2, 1.9, 1.7]);
      // coat body with an armoured breastplate and a gem at the heart
      paint(f, poly([L(sk, sk.shC, -4.4, 1.2), L(sk, sk.shC, 4.8, 1.2), L(sk, sk.hip, 4.6, 1.6), L(sk, sk.hip, -4.4, 1.6)]), M.robe);
      paint(f, poly([L(sk, sk.shC, -2.6, 0.4), L(sk, sk.shC, 4.4, 0.4), L(sk, sk.hip, 3.8, 3.6), L(sk, sk.hip, -1.6, 3)]), M.mageArmor, { spec: true });
      paint(f, capsule(L(sk, sk.shC, 4.2, 0.2), L(sk, sk.hip, 3.6, 3.4), 0.45), M.robeTrim, { rim: false, tone: 'l' });
      paint(f, disc(L(sk, sk.shC, frontal ? 0.4 : 1.6, -3), 1.25), M.orb, { spec: true });
      // belt, buckle and a short front flap
      paint(f, capsule(L(sk, sk.hip, -4.4, 1.5), L(sk, sk.hip, 4.8, 1.5), 0.9), M.robeTrim, { rim: false });
      paint(f, disc(L(sk, sk.hip, frontal ? 0.4 : 2.6, 1.5), 1), M.orb, { tone: 'l', rim: false });
      if (!sk.rotated) {
        const a = frontal ? [-2, 2, 1.4, -1.4] : [1, 4.4, 3.6, 1.6];
        paint(f, poly([L(sk, sk.hip, a[0], 1), L(sk, sk.hip, a[1], 1), L(sk, sk.hip, a[2], -4.5), L(sk, sk.hip, a[3], -4)]), M.robe);
      }
      // high standing collar (the head covers its middle)
      paint(f, poly([L(sk, sk.shC, -3.8, 0.6), L(sk, sk.shC, -3.4, 4.6), L(sk, sk.shC, 2.6, 3.4), L(sk, sk.shC, 3, 0.6)]), M.robe);
      paint(f, capsule(L(sk, sk.shC, -3.4, 4.6), L(sk, sk.shC, 2.6, 3.4), 0.45), M.robeTrim, { rim: false });
      if (C.torso) C.torso(X);
    };
    // Facing the camera / away: young face straight on
    const frontalHead = () => {
      paint(f, disc(Hf(sk, 0, -0.4), 4.7), M.mageHair);
      if (view === 'front') {
        paint(f, disc(Hf(sk, 0, 0.6), 3.9), M.skin);
        paint(f, poly([Hf(sk, -4, -1.2), Hf(sk, -1, -3.6), Hf(sk, 3.8, -2.4), Hf(sk, 1.6, -1.4), Hf(sk, -1.8, -0.6)]), M.mageHair, { rim: false });
        dot(f, Hf(sk, -1.4, 0.4), M.orb.l);
        dot(f, Hf(sk, 1.4, 0.4), M.orb.l);
        dot(f, Hf(sk, 0, 2.8), M.skin.d);
      } else {
        paint(f, poly([Hf(sk, -3, 2), Hf(sk, 3, 2), Hf(sk, 1.6 + sway * 0.3, 7), Hf(sk, -1.2 + sway * 0.3, 7)]), M.mageHair);
      }
      paint(f, capsule(Hf(sk, -4.4, -1.8), Hf(sk, 4.4, -1.8), 0.6), M.robeTrim, { rim: false, spec: true });
      if (view === 'front') paint(f, disc(Hf(sk, 0, -1.9), 1.1), M.orb, { spec: true });
      spike(f, Hf(sk, 0, -2.4), [0, -1], 3, 0.8, M.robeTrim, { spec: true });
    };
    const head = C.head ? () => C.head(X) : frontal ? frontalHead : () => {
      // swept-back hair streaming behind
      paint(f, poly([Hd(sk, -3.6, -2.4), Hd(sk, -9 - tr * 2, -2.8 + sway * 0.3), Hd(sk, -6.6, 0), Hd(sk, -9.4 - tr * 2, 2 + sway * 0.4), Hd(sk, -3.8, 3)]), M.mageHair);
      paint(f, disc(Hd(sk, -0.4, -0.2), 4.7), M.mageHair);
      if (view === 'front') {
        paint(f, disc(Hd(sk, 1.3, 0.7), 3.8), M.skin);
        paint(f, poly([Hd(sk, -0.4, -3.8), Hd(sk, 5, -2.8), Hd(sk, 3.6, -1), Hd(sk, 0.6, -1.4)]), M.mageHair, { rim: false });
        dot(f, Hd(sk, 2.8, 0.2), M.orb.l);
        dot(f, Hd(sk, 4.4, 0.2), M.orb.l);
        dot(f, Hd(sk, 4.2, 2.6), M.skin.d);
      }
      paint(f, capsule(Hd(sk, -4.4, -1.8), Hd(sk, 4.6, -1.9), 0.6), M.robeTrim, { rim: false, spec: true });
      if (view === 'front') paint(f, disc(Hd(sk, 4.3, -1.9), 1), M.orb, { spec: true });
      spike(f, Hd(sk, 0.4, -2.4), Hv(sk, 0.15, -1), 3, 0.8, M.robeTrim, { spec: true });
    };
    const drawStaff = () => {
      if (p.drop) return;
      f.meta.orb = staffFn(f, sk.handF, sk.wdir, glow, ph);
    };
    const armF = () => { arm(f, sk, 'F', sleeve, [2.1, 2.3, 1.6]); pauldron(sk.shF, true); };
    const armB = () => { arm(f, sk, 'B', sleeve, [2, 2.1, 1.5]); pauldron(sk.shB, false); };
    const staffBehind = view === 'back' ? sk.handF[1] > sk.neck[1] : !!p.wBack;
    if (C.behind) C.behind(X);
    if (frontal && view === 'front') {
      if (staffBehind) drawStaff();
      robeBody();
      armB();
      head();
      if (!staffBehind) drawStaff();
      armF();
    } else if (frontal) {
      if (staffBehind) drawStaff();
      robeBody();
      head();
      armF();
      armB();
      if (!staffBehind) drawStaff();
    } else if (view === 'front') {
      if (staffBehind) drawStaff();
      armB();
      robeBody();
      head();
      if (!staffBehind) drawStaff();
      armF();
    } else {
      if (staffBehind) drawStaff();
      armF();
      robeBody();
      head();
      armB();
      if (!staffBehind) drawStaff();
    }
    if (C.front) C.front(X);
    else if (!p.drop && !frontal) {
      // two arcane motes circling the waist (seen side-on; head-on they read as buttons)
      for (let i = 0; i < 2; i++) {
        const a = ph * Math.PI * 2 + i * Math.PI;
        const c = add(L(sk, sk.hip, Math.cos(a) * 7.5, 5), sk.up, Math.sin(a) * 1.2);
        paint(f, disc(c, 1.6), M.orb, { tone: 'l', rim: false, alpha: 110 });
        paint(f, disc(c, 0.8), M.orb, { tone: 'h', rim: false });
      }
    }
    if (p.drop) staffFn(f, [-2, -1.2], [1, 0.02], 0, ph);
  }

  function drawRogue(f, p, sk, view, ph) {
    const tr = p.cape || 0;
    const fl = Math.sin(ph * Math.PI * 2) * (0.7 + tr * 1.6);
    const legMats = { thigh: M.rogue, shin: M.rogue, boot: M.hood };
    const armMats = { upper: M.rogue, fore: M.strap, hand: M.hood };
    const frontal = isFrontal(sk);
    // Facing the camera / away the scarf tails hang straight down the back
    const scarf = frontal ? poly([
      L(sk, sk.neck, -2.6, 0.4), L(sk, sk.neck, 2.6, 0.4),
      L(sk, sk.neck, 2 + fl * 0.4, -9 + tr * 3), L(sk, sk.neck, 0.2 + fl * 0.7, -11.5 + tr * 3), L(sk, sk.neck, -1.8 + fl * 0.4, -8 + tr * 3)
    ]) : poly([
      L(sk, sk.neck, -2.6, 0.4), L(sk, sk.neck, -0.8, -1.4),
      add(L(sk, sk.neck, -5.5, -3.5), [-tr * 9, -tr * 2 + fl], 1),
      add(L(sk, sk.neck, -10, -5), [-tr * 14, -tr * 3 + fl * 1.6], 1),
      add(L(sk, sk.neck, -8.6, -2.4), [-tr * 12, -tr * 4 + fl * 1.2], 1)
    ]);
    const C = COSTUME || {};
    const X = { f, p, sk, view, ph, tr, fl, scarfShape: scarf };
    const blade = C.dagger || dagger;
    const drawDaggerF = () => { if (!p.drop) f.meta.tipF = blade(f, sk.handF, sk.wdir, 'F'); };
    const drawDaggerB = () => { if (!p.drop) f.meta.tipB = blade(f, sk.handB, sk.wdirB, 'B'); };
    const drawScarf = () => { if (C.scarf) C.scarf(X); else paint(f, scarf, M.scarf); };
    const legRadii = { F: [2.3, 2, 1.7], B: [2.2, 1.9, 1.6] };
    const drawLegs = (a, b) => {
      if (C.legs) return C.legs(X);
      leg(f, sk, a, legMats, legRadii[a]);
      leg(f, sk, b, legMats, legRadii[b]);
    };
    const torso = () => {
      paint(f, poly([L(sk, sk.shC, -4, 0.8), L(sk, sk.shC, 4.3, 0.8), L(sk, sk.hip, 3.9, 1.2), L(sk, sk.hip, -3.7, 1.2)]), M.rogue);
      if (view === 'front') paint(f, capsule(L(sk, sk.shC, 3.6, -0.6), L(sk, sk.hip, -3, 2.2), 0.7), M.strap, { tone: 'm', rim: false });
      paint(f, capsule(L(sk, sk.hip, -3.8, 1.2), L(sk, sk.hip, 4.1, 1.2), 0.85), M.strap, { rim: false });
      if (view === 'front') paint(f, disc(L(sk, sk.hip, frontal ? 0.2 : 1.5, 1.2), 0.9), M.venom, { rim: false, tone: 'm' });
      paint(f, poly([L(sk, sk.hip, -4.1, 1.6), L(sk, sk.hip, 4.3, 1.6), L(sk, sk.hip, 3.6, -3.8), L(sk, sk.hip, -4.4, -3.4)]), M.hood);
      if (C.torso) C.torso(X);
    };
    // Facing the camera / away: hood seen straight on, masked face in the middle
    const frontalHead = () => {
      paint(f, disc(Hf(sk, 0, -0.3), 5.6), M.hood);
      paint(f, poly([Hf(sk, -1.6, -5.4), Hf(sk, 1.6, -5.4), Hf(sk, 0.4, -7.4)]), M.hood);
      if (view === 'front') {
        paint(f, poly([Hf(sk, -2.6, -1.8), Hf(sk, 2.6, -1.8), Hf(sk, 2.6, 0.3), Hf(sk, -2.6, 0.3)]), M.skin, { rim: false });
        paint(f, poly([Hf(sk, -2.8, 0.3), Hf(sk, 2.8, 0.3), Hf(sk, 2.2, 3.4), Hf(sk, -2.2, 3.4)]), M.rogue, { rim: false });
        dot(f, Hf(sk, -1.3, -0.8), ROGUE_EYE);
        dot(f, Hf(sk, 1.3, -0.8), ROGUE_EYE);
      }
    };
    const head = C.head ? () => C.head(X) : frontal ? frontalHead : () => {
      paint(f, disc(Hd(sk, -0.6, -0.3), 5.6), M.hood);
      paint(f, poly([Hd(sk, -1, -5.7), Hd(sk, 4.6, -4.6), Hd(sk, 6.4, -2), Hd(sk, 3, -3.8)]), M.hood);
      if (view === 'front') {
        paint(f, poly([Hd(sk, 1.6, -1.8), Hd(sk, 5.3, -1.8), Hd(sk, 5.3, 0.3), Hd(sk, 1.6, 0.3)]), M.skin, { rim: false });
        paint(f, poly([Hd(sk, 1.5, 0.3), Hd(sk, 5.5, 0.3), Hd(sk, 5, 3.2), Hd(sk, 1.7, 3.4)]), M.rogue, { rim: false });
        dot(f, Hd(sk, 3, -0.8), ROGUE_EYE);
        dot(f, Hd(sk, 4.6, -0.8), ROGUE_EYE);
      }
    };
    if (C.behind) C.behind(X);
    if (frontal && view === 'front') {
      drawScarf();
      drawLegs('B', 'F');
      torso();
      head();
      drawDaggerB();
      arm(f, sk, 'B', armMats, [1.8, 1.6, 1.4]);
      drawDaggerF();
      arm(f, sk, 'F', armMats, [1.9, 1.7, 1.5]);
    } else if (frontal) {
      drawDaggerF();
      drawDaggerB();
      drawLegs('F', 'B');
      torso();
      head();
      drawScarf();
      arm(f, sk, 'F', armMats, [1.9, 1.7, 1.5]);
      arm(f, sk, 'B', armMats, [1.8, 1.6, 1.4]);
    } else if (view === 'front') {
      drawScarf();
      drawDaggerB();
      arm(f, sk, 'B', armMats, [1.8, 1.6, 1.4]);
      drawLegs('B', 'F');
      torso();
      head();
      drawDaggerF();
      arm(f, sk, 'F', armMats, [1.9, 1.7, 1.5]);
    } else {
      drawDaggerF();
      arm(f, sk, 'F', armMats, [1.9, 1.7, 1.5]);
      drawLegs('F', 'B');
      torso();
      head();
      drawScarf();
      drawDaggerB();
      arm(f, sk, 'B', armMats, [1.8, 1.6, 1.4]);
    }
    if (C.front) C.front(X);
    if (p.drop) {
      blade(f, [4, -1.2], [1, 0.05], 'F');
      blade(f, [-12, -1.2], [-1, 0.05], 'B');
    }
  }

  // ---------------------------------------------------------------- SP costumes
  // A transformed hero wears its SP card's costume: whole parts of the class
  // sprite (head, weapon, cape, legs, extras) are swapped for the card's own,
  // so every card has its own silhouette. The card palette still recolours
  // the shared materials (M) underneath. Hooks receive X = { f, p, sk, view,
  // ph, tr, ... } from the class draw function.
  let COSTUME = null;            // set while a variant sheet is being built

  const CM = {
    slit: mat('#05060a', '#0b0d14', '#141824', '#1e2433'),
    fur: mat('#1f140b', '#5c3d22', '#86603a', '#b48a5c'),
    furWhite: mat('#3b4552', '#a9b8c8', '#dbe7f2', '#ffffff'),
    bone: mat('#2b2416', '#a39a7f', '#d9d0b2', '#f5efdc'),
    horn: mat('#05040a', '#2a2238', '#463a5c', '#6e5e8a', '#c4b5fd'),
    hair: mat('#2a0a04', '#8a2a0e', '#c2501c', '#f08a3c'),
    stormHair: mat('#2b2f3a', '#9aa3b5', '#dfe6f2', '#ffffff'),
    blonde: mat('#3a2a08', '#b8860b', '#e6c34a', '#fff0a8'),
    fire: mat('#5a0f02', '#d9480f', '#fb8c1c', '#ffd166', '#fff6d5'),
    ice: mat('#0b3446', '#3fa9d1', '#8fe3fb', '#dff9ff', '#ffffff'),
    ghost: mat('#0b3446', '#5fb6d6', '#a9e6f7', '#eefcff'),
    bolt: mat('#3a2a02', '#eab308', '#fde047', '#fffbe0', '#ffffff'),
    feather: mat('#2c2c34', '#b8bdc8', '#e6e9ef', '#ffffff'),
    iron: mat('#101218', '#2f3440', '#4b5263', '#7a8396', '#c9d0dd'),
    shadow: mat('#000000', '#0a0a10', '#14141c', '#22222e'),
    void: mat('#000000', '#0d0618', '#1b0d2e', '#2f1a4d'),
    voidGlow: mat('#2e0854', '#9333ea', '#c084fc', '#f5d0fe', '#ffffff'),
    crimson: mat('#2a0610', '#881337', '#e11d48', '#fda4af', '#fff1f2'),
    sun: mat('#000000', '#050505', '#0b0b0b', '#151515'),
    scale: mat('#03200c', '#14532d', '#15803d', '#4ade80', '#bbf7d0'),
    glass: mat('#2b3a4a', '#a5d8ff', '#d6f0ff', '#ffffff'),
    sand: mat('#3a2a08', '#d4a017', '#facc15', '#fef08a')
  };
  const GLOW_EYE = {
    ice: hexRgb('#cffafe'), bolt: hexRgb('#fef08a'), void: hexRgb('#f0abfc'), gold: hexRgb('#fffbe0'),
    blood: hexRgb('#ff3355'), white: hexRgb('#ffffff'), venom: hexRgb('#bbf7d0'), ember: hexRgb('#ffd166')
  };

  const norm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  // Head-space direction (same axes as Hd: dx forward, dy down)
  const Hv = (sk, dx, dy) => norm([sk.hside[0] * dx - sk.hup[0] * dy, sk.hside[1] * dx - sk.hup[1] * dy]);

  function ellRing(c, r, ry, inner) {
    const cx = AX + c[0], cy = AY + c[1];
    return {
      bbox: [Math.floor(cx - r - 1), Math.floor(cy - ry - 1), Math.ceil(cx + r + 1), Math.ceil(cy + ry + 1)],
      test(px, py) {
        const nx = (px - cx) / r, ny = (py - cy) / ry, d = nx * nx + ny * ny;
        return d <= 1 && d >= inner * inner ? [nx, ny] : null;
      }
    };
  }

  // Disc with a smaller disc bitten out of it, offset by off
  function crescentShape(c, r, off) {
    const outer = disc(c, r), inner = disc(add(c, off, 1), r * 0.82);
    return { bbox: outer.bbox, test: (px, py) => (inner.test(px, py) ? null : outer.test(px, py)) };
  }

  function spike(f, base, dir, len, w, m, o) {
    const n = perpOf(dir);
    paint(f, poly([add(base, n, w), add(base, dir, len), add(base, n, -w)]), m, o);
  }

  // Curved horn / braid: tapering capsules through the given points
  function horn(f, pts, r0, r1, m) {
    for (let i = 0; i < pts.length - 1; i++) {
      const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1);
      paint(f, capsule(pts[i], pts[i + 1], lerp(r0, r1, t0), lerp(r0, r1, t1)), m, { spec: true });
    }
  }

  // Flame tongue rising from base (flames always rise, whatever the pose)
  function flame(f, base, h, w, sway) {
    const [x, y] = base;
    paint(f, poly([[x - w, y], [x - w * 0.7 + sway * 0.4, y - h * 0.55], [x + sway, y - h], [x + w * 0.75 + sway * 0.5, y - h * 0.5], [x + w, y]]), CM.fire);
    paint(f, poly([[x - w * 0.45, y], [x + sway * 0.6, y - h * 0.6], [x + w * 0.45, y]]), CM.fire, { tone: 'h', rim: false });
  }

  // Points strictly between a and b, every other one pushed down (torn hem)
  function ragged(a, b, n, depth) {
    const out = [];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t) + (i % 2 ? depth : 0)]);
    }
    return out;
  }

  // ---- warrior weapons
  function mace(f, hand, d) {
    const n = perpOf(d);
    paint(f, capsule(add(hand, d, -3.6), add(hand, d, 11), 0.85), M.leather);
    paint(f, disc(add(hand, d, -4.2), 1.1), M.gold, { spec: true });
    const head = add(hand, d, 13);
    for (const k of [-1, 1]) spike(f, add(head, n, k * 1.5), [n[0] * k, n[1] * k], 2.8, 1.5, M.gold, { spec: true });
    spike(f, add(head, d, 1.5), d, 2.8, 1.4, M.gold, { spec: true });
    paint(f, disc(head, 2.9), M.gold, { spec: true });
    return add(head, d, 4);
  }

  function greatAxe(f, hand, d) {
    const n = perpOf(d);
    paint(f, capsule(add(hand, d, -5), add(hand, d, 17), 0.95), M.wood);
    const h = add(hand, d, 14);
    for (const k of [-1, 1]) {
      const s = (a, b) => add(add(h, d, a), n, b * k);
      paint(f, poly([s(-1.6, 0.8), s(-4.4, 5.6), s(-1, 7.6), s(2.6, 7.8), s(5.6, 5.2), s(2.4, 0.8)]), CM.iron, { spec: true });
    }
    paint(f, capsule(add(h, d, -1.5), add(h, d, 2.5), 1.4), M.darkSteel);
    spike(f, add(hand, d, 17), d, 3, 1, CM.iron, { spec: true });
    return add(hand, d, 20);
  }

  function warhammer(f, hand, d) {
    const n = perpOf(d);
    paint(f, capsule(add(hand, d, -5), add(hand, d, 15), 0.9), M.darkSteel);
    paint(f, disc(add(hand, d, -5.6), 1.2), M.gold, { spec: true });
    const h = add(hand, d, 15.5);
    const s = (a, b) => add(add(h, d, a), n, b);
    paint(f, poly([s(-2.6, -6), s(2.8, -6), s(2.8, 5), s(-2.6, 5)]), M.steel, { spec: true });
    paint(f, capsule(s(0.1, -5.2), s(0.1, 4.2), 0.7), CM.bolt, { tone: 'h', rim: false });
    spike(f, s(2.8, -0.5), d, 3, 1.2, M.steel, { spec: true });
    return s(5.5, -0.5);
  }

  function iceBlade(f, hand, d) {
    const n = perpOf(d);
    const s = (a, b) => add(add(hand, d, a), n, b);
    paint(f, capsule(s(-3.6, 0), s(1.4, 0), 0.9), M.leather);
    paint(f, disc(s(-4.3, 0), 1.3), CM.ice, { spec: true });
    paint(f, poly([s(1.6, 4.2), s(2.8, 2), s(2.8, -2), s(1.6, -4.2), s(0.8, 0)]), CM.ice, { spec: true });
    paint(f, poly([s(2.6, 2), s(7, 2.6), s(9, 1.6), s(12, 2.8), s(15, 1.4), s(17.5, 2), s(21, 0),
      s(17, -1.6), s(14, -2.6), s(11, -1.6), s(8, -2.8), s(5, -2), s(2.6, -2)]), CM.ice, { spec: true });
    paint(f, capsule(s(3.5, 0), s(18, 0), 0.45), CM.ice, { tone: 'h', rim: false });
    return s(21, 0);
  }

  // Colossal executioner axe: long haft, crescent blade with a void-lit edge
  function dreadAxe(f, hand, d) {
    const n = perpOf(d);
    // choke up on the haft in steep downswings so the head stays inside the frame
    const reach = 14.5 - Math.max(0, d[1] - 0.3) * 7;
    paint(f, capsule(add(hand, d, -7), add(hand, d, reach + 2.5), 0.95), CM.shadow);
    paint(f, disc(add(hand, d, -7.6), 1.4), CM.voidGlow, { spec: true });
    paint(f, capsule(add(hand, d, 7), add(hand, d, 8.5), 1.15), M.gold, { rim: false, spec: true });
    const h = add(hand, d, reach);
    const s = (a, b) => add(add(h, d, a), n, b);
    spike(f, s(0, -0.8), [-n[0], -n[1]], 4, 1.2, CM.iron, { spec: true });
    spike(f, s(2.5, 0), d, 3, 1, CM.iron, { spec: true });
    // bearded blade: sharp upper horn and long lower beard, cut in towards the haft
    paint(f, poly([s(3, 0.8), s(4, 3.5), s(7.5, 8.5), s(4, 9.4), s(0, 9.8), s(-4, 9.4), s(-8.5, 8), s(-4.5, 4), s(-2.5, 0.8)]), CM.iron, { spec: true });
    paint(f, capsule(s(5.5, 8.6), s(0, 9.4), 0.5), CM.voidGlow, { tone: 'l', rim: false });
    paint(f, capsule(s(0, 9.4), s(-6.5, 8.2), 0.5), CM.voidGlow, { tone: 'l', rim: false });
    paint(f, disc(s(-0.5, 5), 1), CM.voidGlow, { tone: 'l', rim: false });
    return s(0, 9.8);
  }

  // ---- mage staves: (f, hand, d, glow, ph) -> orb point
  function brazierStaff(f, hand, d, glow, ph) {
    const n = perpOf(d);
    paint(f, capsule(add(hand, d, -9), add(hand, d, 12), 0.95), CM.iron);
    paint(f, poly([add(add(hand, d, 11.5), n, 1), add(add(hand, d, 15), n, 3.2), add(add(hand, d, 15), n, -3.2), add(add(hand, d, 11.5), n, -1)]), CM.iron, { spec: true });
    const top = add(hand, d, 15.5);
    const k = Math.sin(ph * Math.PI * 4);
    flame(f, top, 6 + glow * 4 + k, 2.8 + glow * 0.8, k * 0.8);
    return [top[0], top[1] - 3];
  }

  function crystalStaff(f, hand, d, glow) {
    const n = perpOf(d);
    paint(f, capsule(add(hand, d, -9), add(hand, d, 12.5), 0.9), CM.bone);
    const top = add(hand, d, 15.5);
    paint(f, disc(top, 2.5 + glow * 2.2), CM.ice, { tone: 'l', rim: false, alpha: Math.round(40 + glow * 80) });
    for (const k of [-1, 1]) spike(f, add(add(hand, d, 12), n, 1.6 * k), norm(add(d, n, 0.5 * k)), 5, 1.3, CM.ice, { spec: true });
    paint(f, poly([add(hand, d, 11.5), add(add(hand, d, 14.5), n, 2.2), add(hand, d, 20), add(add(hand, d, 14.5), n, -2.2)]), CM.ice, { spec: true });
    return top;
  }

  function stormFork(f, hand, d, glow) {
    const n = perpOf(d);
    paint(f, capsule(add(hand, d, -9), add(hand, d, 12.5), 0.85), CM.iron);
    const base = add(hand, d, 12.5);
    paint(f, capsule(add(base, n, 3), add(base, n, -3), 0.8), CM.iron, { spec: true });
    for (const k of [-1, 1]) paint(f, capsule(add(base, n, 3 * k), add(add(base, n, 3.4 * k), d, 5.5), 0.75, 0.35), CM.iron, { spec: true });
    const orb = add(base, d, 3.8);
    paint(f, disc(orb, 3 + glow * 2.2), CM.bolt, { tone: 'l', rim: false, alpha: Math.round(50 + glow * 90) });
    paint(f, disc(orb, 1.8 + glow * 0.5), CM.bolt, { spec: true });
    return orb;
  }

  function hourglassStaff(f, hand, d) {
    const n = perpOf(d);
    const s = (a, b) => add(add(hand, d, a), n, b);
    paint(f, capsule(s(-9, 0), s(11, 0), 0.9), M.gold);
    paint(f, poly([s(11.6, -2.6), s(11.6, 2.6), s(15.5, 0.5), s(19.4, 2.6), s(19.4, -2.6), s(15.5, -0.5)]), CM.glass);
    paint(f, poly([s(16.2, 0), s(19.4, 2.2), s(19.4, -2.2)]), CM.sand, { rim: false });
    paint(f, poly([s(12, -1), s(12, 1), s(14.6, 0)]), CM.sand, { rim: false });
    for (const k of [-1, 1]) paint(f, capsule(s(11, 3.2 * k), s(20, 3.2 * k), 0.45), M.gold, { spec: true });
    paint(f, capsule(s(11, -3.4), s(11, 3.4), 0.7), M.gold, { spec: true });
    paint(f, capsule(s(20, -3.4), s(20, 3.4), 0.7), M.gold, { spec: true });
    return s(15.5, 0);
  }

  function crescentStaff(f, hand, d, glow) {
    paint(f, capsule(add(hand, d, -9), add(hand, d, 12), 0.9), CM.shadow);
    const c = add(hand, d, 16);
    paint(f, crescentShape(c, 5, [d[0] * 2.4, d[1] * 2.4]), CM.iron, { spec: true });
    paint(f, disc(c, 2.6 + glow * 2), CM.voidGlow, { tone: 'l', rim: false, alpha: Math.round(50 + glow * 90) });
    paint(f, disc(c, 1.7 + glow * 0.5), CM.voidGlow, { spec: true });
    return c;
  }

  // ---- rogue blades: (f, hand, d, 'F' | 'B') -> tip (or nothing for an empty hand)
  function ninjato(f, hand, d) {
    const n = perpOf(d);
    paint(f, capsule(add(hand, d, -2.6), add(hand, d, 1.2), 0.75), M.hood);
    paint(f, poly([add(add(hand, d, 1.2), n, 1.6), add(add(hand, d, 2.2), n, 1.6), add(add(hand, d, 2.2), n, -1.6), add(add(hand, d, 1.2), n, -1.6)]), CM.iron, { spec: true });
    paint(f, poly([add(add(hand, d, 2.2), n, 0.9), add(add(hand, d, 12.5), n, 0.9), add(add(hand, d, 14.5), n, -0.2), add(add(hand, d, 2.2), n, -0.9)]), M.venom, { spec: true });
    return add(hand, d, 14.5);
  }

  function kunai(f, hand, d) {
    const n = perpOf(d);
    paint(f, ellRing(add(hand, d, -3), 1.4, 1.4, 0.4), CM.iron);
    paint(f, capsule(add(hand, d, -2), add(hand, d, 1.2), 0.6), M.hood);
    paint(f, poly([add(add(hand, d, 1.4), n, 1.4), add(hand, d, 7.5), add(add(hand, d, 1.4), n, -1.4)]), M.venom, { spec: true });
    return add(hand, d, 7.5);
  }

  function kris(f, hand, d) {
    const n = perpOf(d);
    paint(f, capsule(add(hand, d, -1.8), add(hand, d, 1.2), 0.8), CM.scale);
    paint(f, capsule(add(add(hand, d, 1.5), n, 1.9), add(add(hand, d, 1.5), n, -1.9), 0.6), M.gold);
    const top = [], bot = [], len = 10;
    const centre = s => add(add(hand, d, 2 + s), n, 0.7 * Math.sin(s * 1.3));
    for (let s = 0; s <= len; s++) {
      const c = centre(s), w = 1.3 * (1 - s / (len + 1.5));
      top.push(add(c, n, w));
      bot.unshift(add(c, n, -w));
    }
    paint(f, poly(top.concat(bot)), M.venom, { spec: true });
    const tip = centre(len);
    paint(f, disc([tip[0], tip[1] + 1.8], 0.7, 1), M.venom, { tone: 'l', rim: false });  // venom drip
    return tip;
  }

  function chakram(f, hand, d) {
    const n = perpOf(d);
    const c = add(hand, d, 3.4);
    for (const [a, b] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const v = [d[0] * a + n[0] * b, d[1] * a + n[1] * b];
      spike(f, add(c, v, 3.4), v, 2.4, 1, M.venom, { spec: true });
    }
    paint(f, ellRing(c, 3.9, 3.9, 0.5), M.venom, { spec: true });
    return add(c, d, 5.8);
  }

  function iceClaws(f, hand, d) {
    const n = perpOf(d);
    for (const k of [-1, 0, 1]) {
      const v = norm(add(d, n, k * 0.3));
      spike(f, add(hand, v, 0.6), v, 8.5 - Math.abs(k) * 2, 0.85, CM.ice, { spec: true });
    }
    paint(f, capsule(add(hand, d, -1.2), add(hand, d, 0.8), 1.3), CM.iron);
    return add(hand, d, 9);
  }

  function scythe(f, hand, d) {
    const n = perpOf(d);
    paint(f, capsule(add(hand, d, -5), add(hand, d, 17), 0.85), CM.shadow);
    const end = add(hand, d, 17);
    const top = [], bot = [], len = 13;
    const centre = s => add(add(end, n, -s), d, -0.06 * s * s);
    for (let s = 0; s <= len; s++) {
      const c = centre(s), w = 2.2 * (1 - s / (len + 1.2));
      top.push(add(c, d, w));
      bot.unshift(add(c, d, -w));
    }
    paint(f, poly(top.concat(bot)), M.venom, { spec: true });
    paint(f, disc(end, 1.4), CM.bone, { spec: true });
    return centre(len);
  }

  // Two sparks circling the waist; the near half of the orbit is in front
  function orbiters({ f, sk, ph, p }, near) {
    if (p.drop) return;
    for (let i = 0; i < 2; i++) {
      const a = (ph + i * 0.5) * Math.PI * 2;
      if ((Math.sin(a) >= 0) !== near) continue;
      const c = [sk.hip[0] + Math.cos(a) * 10, sk.hip[1] - 9 + Math.sin(a) * 3];
      paint(f, disc(c, 2.8), CM.bolt, { tone: 'l', rim: false, alpha: 90 });
      paint(f, disc(c, 1.4), CM.bolt, { spec: true });
    }
  }

  // Closed-helm back view (shared by the helmeted warrior costumes)
  const helmBack = (f, sk) => paint(f, poly([Hd(sk, -4.6, 1), Hd(sk, 3, 1), Hd(sk, 2.6, 4.6), Hd(sk, -4.2, 4.2)]), M.darkSteel);

  const COSTUMES = {
    // ---------------- warrior
    sp_crusader: {
      smear: () => M.gold,
      weapon: mace,
      head({ f, sk, view }) {
        paint(f, poly([Hd(sk, -1, -5.6), Hd(sk, -3.6, -9.4), Hd(sk, -7.6, -10.2), Hd(sk, -5.6, -8), Hd(sk, -8, -7.4), Hd(sk, -4.6, -5)]), M.gold, { spec: true });
        paint(f, poly([Hd(sk, -5, -5), Hd(sk, 4.6, -5), Hd(sk, 5.4, -3.4), Hd(sk, 5.4, 4.4), Hd(sk, -5, 4.4)]), M.steel, { spec: true });
        paint(f, capsule(Hd(sk, -5, -3.2), Hd(sk, 5.4, -3.2), 0.7), M.gold, { rim: false, spec: true });
        if (view === 'front') {
          paint(f, capsule(Hd(sk, 1.6, 0), Hd(sk, 5.6, 0), 0.6), CM.slit, { rim: false });
          paint(f, capsule(Hd(sk, 3.6, -1.4), Hd(sk, 3.6, 3.4), 0.55), CM.slit, { rim: false });
        }
      },
      torso({ f, sk, view }) {
        if (view !== 'front') return;
        paint(f, poly([L(sk, sk.hip, -0.6, 0.6), L(sk, sk.hip, 3.8, 0.6), L(sk, sk.hip, 3.6, -8.5), L(sk, sk.hip, 1.6, -9.6), L(sk, sk.hip, -0.4, -8.5)]), M.tabard);
        paint(f, capsule(L(sk, sk.shC, 1.6, -1.4), L(sk, sk.shC, 1.6, -6.6), 0.6), CM.crimson, { rim: false });
        paint(f, capsule(L(sk, sk.shC, 0.2, -3.2), L(sk, sk.shC, 3, -3.2), 0.6), CM.crimson, { rim: false });
      },
      capeMat: () => CM.feather,
      // gold kite shield slung on the back, over a white cape
      onBack({ f, sk }) {
        const S = (a, b) => L(sk, sk.shC, a, b);
        paint(f, poly([S(-8.6, 1.6), S(-0.8, 1.6), S(-1, -6), S(-4.7, -11.5), S(-8.4, -6)]), M.gold, { spec: true });
        paint(f, capsule(S(-4.7, 0.4), S(-4.7, -9), 0.6), CM.crimson, { rim: false });
        paint(f, capsule(S(-7.4, -2.6), S(-2, -2.6), 0.6), CM.crimson, { rim: false });
      }
    },
    sp_berserker: {
      smear: () => CM.fire,
      weapon: greatAxe,
      cape: null,
      armMatsF: () => ({ upper: M.skin, fore: M.leather, hand: M.leather }),
      armMatsB: () => ({ upper: M.skin, fore: M.leather, hand: M.leather }),
      pauldron: ({ f, sk }, pt) => paint(f, disc(add(pt, sk.up, 0.8), 4, 3.2), CM.fur),
      torso({ f, sk, view }) {
        if (view !== 'front') return;
        paint(f, capsule(L(sk, sk.shC, -3.4, 0.2), L(sk, sk.hip, 3.6, 1.6), 0.65), M.leather, { rim: false });
        paint(f, capsule(L(sk, sk.shC, 4, 0.2), L(sk, sk.hip, -3, 1.6), 0.65), M.leather, { rim: false });
        paint(f, disc(L(sk, sk.shC, 0.6, -4.6), 1.3), CM.bone, { spec: true });
      },
      head({ f, sk, view, tr, fl }) {
        const [hx, hy] = sk.head;
        paint(f, capsule(Hd(sk, -3.6, 0.6), [hx - 7 - tr * 4, hy + 6 + fl * 0.5], 1.5, 0.7), CM.hair);
        if (view === 'front') {
          paint(f, disc(Hd(sk, -0.6, 0.4), 4.8), CM.hair);
          paint(f, poly([Hd(sk, 0.8, -2.2), Hd(sk, 5, -2.2), Hd(sk, 5.2, 2.4), Hd(sk, 1, 2.8)]), M.skin);
          paint(f, poly([Hd(sk, 0.6, 1.2), Hd(sk, 5.6, 1), Hd(sk, 5, 5.6), Hd(sk, 2.8, 8.6), Hd(sk, 0.4, 5)]), CM.hair);
          dot(f, Hd(sk, 2.8, -0.6), EYE);
          dot(f, Hd(sk, 4.6, -0.6), EYE);
        } else {
          paint(f, disc(Hd(sk, -0.4, 0.4), 5.2), CM.hair);
        }
        paint(f, poly([Hd(sk, -5, -1.4), Hd(sk, 5.2, -1.4), Hd(sk, 4, -5), Hd(sk, 0, -6.6), Hd(sk, -4, -5)]), M.darkSteel, { spec: true });
        paint(f, capsule(Hd(sk, -5, -1.6), Hd(sk, 5.2, -1.6), 0.8), M.gold, { rim: false });
        horn(f, [Hd(sk, -2.6, -3.6), Hd(sk, -6, -5.4), Hd(sk, -7.4, -8.8), Hd(sk, -6, -11.8)], 1.6, 0.4, CM.bone);
        horn(f, [Hd(sk, 2.4, -3.6), Hd(sk, 5.8, -5.2), Hd(sk, 7.2, -8.6), Hd(sk, 6, -11.6)], 1.6, 0.4, CM.bone);
      }
    },
    sp_frost_templar: {
      smear: () => CM.ice,
      weapon: iceBlade,
      // long cape with an icicle hem
      cape({ capePts: c }) {
        const lo = [c[3][0], c[3][1] + 2.5], lo2 = [c[4][0] - 1, c[4][1] + 2.5];
        return [c[0], c[1], c[2], ...ragged(c[2], lo, 3, 2.6), lo, ...ragged(lo, lo2, 4, 3), lo2];
      },
      pauldron({ f, sk }, pt, m) {
        spike(f, add(add(pt, sk.up, 2), sk.side, -1), norm(add(sk.up, sk.side, -0.3)), 4, 1, CM.ice, { spec: true });
        spike(f, add(add(pt, sk.up, 2), sk.side, 1.2), sk.up, 3, 0.9, CM.ice, { spec: true });
        paint(f, disc(add(pt, sk.up, 0.4), 3.2, 2.7), m, { spec: true });
      },
      head({ f, sk, view }) {
        for (const [dx, lean, len] of [[-3.6, -0.6, 4], [-1, -0.2, 6.4], [1.8, 0.2, 5], [3.8, 0.5, 3]]) {
          spike(f, Hd(sk, dx, -3.8), Hv(sk, lean, -1), len + 1.2, 1.2, CM.ice, { spec: true });
        }
        paint(f, disc(Hd(sk, -0.4, -0.4), 5.3), M.steel, { spec: true });
        if (view === 'front') {
          paint(f, poly([Hd(sk, 1, -1.6), Hd(sk, 5.4, -1.6), Hd(sk, 5.4, -0.2), Hd(sk, 4, -0.2), Hd(sk, 4, 3.8), Hd(sk, 2.8, 3.8), Hd(sk, 2.8, -0.2), Hd(sk, 1, -0.2)]), CM.slit, { rim: false });
          dot(f, Hd(sk, 2, -1), GLOW_EYE.ice);
          dot(f, Hd(sk, 4.6, -1), GLOW_EYE.ice);
        } else {
          helmBack(f, sk);
        }
      }
    },
    sp_storm_herald: {
      smear: () => CM.bolt,
      weapon: warhammer,
      // short half-cape
      cape({ capePts: c }) {
        const s = (pt, k) => [lerp(c[0][0], pt[0], k), lerp(c[0][1], pt[1], k)];
        return [c[0], c[1], s(c[2], 0.7), s(c[3], 0.55), s(c[4], 0.55)];
      },
      capeMat: () => M.tabard,
      torso({ f, sk, view }) {
        if (view !== 'front') return;
        paint(f, poly([L(sk, sk.shC, 2.4, -1), L(sk, sk.shC, 0.4, -3.6), L(sk, sk.shC, 1.8, -3.6), L(sk, sk.shC, 0.2, -6.8), L(sk, sk.shC, 3.2, -3), L(sk, sk.shC, 1.8, -3)]), CM.bolt, { spec: true });
      },
      head({ f, sk, view }) {
        paint(f, poly([Hd(sk, -0.6, -4.8), Hd(sk, 1.8, -8.4), Hd(sk, 0.4, -8.2), Hd(sk, 2.6, -12), Hd(sk, -1.8, -7.4), Hd(sk, -0.2, -7.4), Hd(sk, -2.2, -4.8)]), CM.bolt, { spec: true });
        paint(f, disc(Hd(sk, -0.4, -0.4), 5.3), M.steel, { spec: true });
        paint(f, poly([Hd(sk, -2, -1.6), Hd(sk, -6.4, -6), Hd(sk, -11, -8.6), Hd(sk, -9.4, -5.8), Hd(sk, -11.6, -4.6), Hd(sk, -8.6, -2.8), Hd(sk, -9.8, -0.8), Hd(sk, -4, 0.6)]), CM.feather, { spec: true });
        if (view === 'front') {
          paint(f, poly([Hd(sk, 0.8, -1.8), Hd(sk, 5.4, -1.8), Hd(sk, 5, 4), Hd(sk, 1.2, 4.2)]), CM.slit, { rim: false });
          paint(f, capsule(Hd(sk, 3.6, -1.6), Hd(sk, 3.6, 4), 0.55), M.steel, { tone: 'm', rim: false });
          dot(f, Hd(sk, 2.4, 0.2), GLOW_EYE.bolt);
          dot(f, Hd(sk, 4.8, 0.2), GLOW_EYE.bolt);
        } else {
          helmBack(f, sk);
        }
      }
    },
    sp_dread_lord: {
      smear: () => CM.voidGlow,
      weapon: dreadAxe,
      // huge tattered cape
      cape({ capePts: c }) {
        const lo = [c[3][0] - 2, c[3][1] + 5], lo2 = [c[4][0] - 4, c[4][1] + 4];
        return [[c[0][0] - 1.5, c[0][1] - 1], c[1], c[2], ...ragged(c[2], lo, 3, 2.4), lo, ...ragged(lo, lo2, 5, 3.4), lo2];
      },
      pauldron({ f, sk }, pt, m) {
        for (const [a, len] of [[-0.6, 4.6], [0, 5.6], [0.6, 4.2]]) spike(f, add(pt, sk.up, 1.6), norm(add(sk.up, sk.side, a)), len, 1, M.darkSteel, { spec: true });
        paint(f, disc(add(pt, sk.up, 0.4), 3.6, 2.9), m, { spec: true });
      },
      head({ f, sk, view }) {
        horn(f, [Hd(sk, -1.4, -3.6), Hd(sk, -5.4, -5.6), Hd(sk, -9.6, -5.4), Hd(sk, -12.4, -8), Hd(sk, -12, -11.6)], 1.9, 0.4, CM.horn);
        for (const dx of [-3.4, -1.2, 1, 3.2]) spike(f, Hd(sk, dx, -4.4), Hv(sk, dx * 0.08, -1), Math.abs(dx) < 2 ? 3.6 : 2.6, 0.9, M.gold, { spec: true });
        paint(f, disc(Hd(sk, -0.4, -0.4), 5.4), M.darkSteel, { spec: true });
        paint(f, capsule(Hd(sk, -4.8, -3.8), Hd(sk, 4.6, -4), 0.8), M.gold, { rim: false, spec: true });
        if (view === 'front') {
          paint(f, poly([Hd(sk, 0.8, -2), Hd(sk, 5.4, -2), Hd(sk, 4.8, 3.6), Hd(sk, 2.4, 5.2), Hd(sk, 1, 3.6)]), CM.slit, { rim: false });
          dot(f, Hd(sk, 2.4, -0.4), GLOW_EYE.void);
          dot(f, Hd(sk, 4.6, -0.4), GLOW_EYE.void);
        }
        horn(f, [Hd(sk, 2, -3), Hd(sk, 5, -5.6), Hd(sk, 5.2, -9.4), Hd(sk, 3, -12)], 1.7, 0.4, CM.horn);
      }
    },

    // ---------------- mage
    sp_pyromancer: {
      smear: () => CM.fire,
      staff: brazierStaff,
      // battle-mage cape whose hem burns away into flame
      behind({ f, sk, ph, p, tr, sway }) {
        if (p.drop) return;
        const hem = (a) => L(sk, sk.hip, a - tr * 4, -13 + tr * 4 + (a < 0 ? sway : 0));
        paint(f, poly([L(sk, sk.shC, -4.6, 1.6), L(sk, sk.shC, 2.6, 1.6), hem(2), hem(-2), hem(-6)]), CM.iron);
        const k = Math.sin(ph * Math.PI * 4);
        for (const [a, h] of [[-6, 6], [-3.6, 8], [-1, 6.5], [1.6, 5]]) {
          const base = hem(a);
          flame(f, [base[0], base[1] + 2], h + k * (a === -3.6 ? 1.2 : -0.6), 2, -tr * 2);
        }
      },
      // iron gorget and flame-crested pauldrons over the robe, an ember gem at the belt
      torso({ f, sk, view, ph }) {
        paint(f, capsule(L(sk, sk.shC, -3.6, 1.6), L(sk, sk.shC, 3.8, 1.6), 1.4), CM.iron, { spec: true });
        const k = Math.sin(ph * Math.PI * 4 + 1);
        for (const [pt, w] of [[sk.shB, 2.8], [sk.shF, 3.2]]) {
          paint(f, disc(add(pt, sk.up, 0.6), w, w * 0.75), CM.iron, { spec: true });
          flame(f, add(pt, sk.up, 2), 4.5 + k, 1.4, 0);
        }
        if (view === 'front') paint(f, disc(L(sk, sk.hip, 0.8, 1.4), 1.3), CM.fire, { tone: 'l', spec: true });
      },
      // young caster whose hair blazes straight up like a crown
      head({ f, sk, view, ph }) {
        const k = Math.sin(ph * Math.PI * 4);
        for (const [dx, dy, h, w, sw] of [[-3.2, -2.4, 8, 2.2, -0.6], [-1, -3.6, 11 + k, 2.6, 0.3], [1.6, -3.2, 9 - k, 2.2, 0.6], [3.6, -2, 6, 1.8, 0.8]]) {
          flame(f, Hd(sk, dx, dy), h, w, sw);
        }
        paint(f, disc(Hd(sk, -0.4, -0.4), 4.5), CM.hair);
        if (view === 'front') {
          paint(f, disc(Hd(sk, 1.2, 0.8), 3.7), M.skin);
          paint(f, capsule(Hd(sk, 0.2, -2.4), Hd(sk, 4.8, -2.2), 1), CM.hair, { rim: false });
          // brow shadow over glowing ember eyes
          paint(f, capsule(Hd(sk, 2.2, -0.9), Hd(sk, 4.8, -1), 0.5), M.skin, { tone: 'd', rim: false });
          dot(f, Hd(sk, 2.8, 0), GLOW_EYE.ember);
          dot(f, Hd(sk, 4.4, 0), GLOW_EYE.ember);
          dot(f, Hd(sk, 4.2, 2.6), M.skin.d);
        }
        paint(f, capsule(Hd(sk, -3.4, 4), Hd(sk, 3.4, 4.2), 1.1), CM.iron, { spec: true });
      }
    },
    sp_cryo_sage: {
      smear: () => CM.ice,
      staff: crystalStaff,
      torso: ({ f, sk }) => paint(f, capsule(L(sk, sk.shC, -4.2, 0.4), L(sk, sk.shC, 4.6, 0.4), 2.2), CM.furWhite),
      // fur-lined parka hood crowned with ice
      head({ f, sk, view, tr, sway }) {
        paint(f, poly([Hd(sk, -3, -4), Hd(sk, -9 - tr * 3, -1 + sway), Hd(sk, -5, 2)]), M.robe);
        for (const [dx, lean, len] of [[-3.4, -0.5, 3], [-0.8, 0, 4.6], [1.8, 0.4, 3.2]]) {
          spike(f, Hd(sk, dx, -4.4), Hv(sk, lean, -1), len + 1.4, 1.2, CM.ice, { spec: true });
        }
        paint(f, disc(Hd(sk, -0.6, -0.2), 5.8), M.robe);
        if (view === 'front') {
          paint(f, disc(Hd(sk, 1.8, 0.6), 4.4), CM.furWhite);
          paint(f, disc(Hd(sk, 2, 0.4), 3.2), M.skin);
          dot(f, Hd(sk, 2.6, -0.2), GLOW_EYE.ice);
          dot(f, Hd(sk, 4.2, -0.2), GLOW_EYE.ice);
        }
      }
    },
    sp_tempest: {
      smear: () => CM.bolt,
      staff: stormFork,
      behind: X => orbiters(X, false),
      front: X => orbiters(X, true),
      // storm-charged spiky hair and a horned circlet
      head({ f, sk, view }) {
        for (const [bx, by, tx, ty] of [[-4.4, -0.8, -9, -4], [-3, -3, -6, -9], [-0.6, -4, -1.2, -10.6], [2, -3.6, 3.8, -9.2], [4, -2.2, 7, -6]]) {
          paint(f, poly([Hd(sk, bx - 1.8, by + 0.6), Hd(sk, tx, ty), Hd(sk, bx + 1.8, by + 0.4)]), CM.stormHair);
        }
        paint(f, disc(Hd(sk, -0.4, 0), 4.8), CM.stormHair);
        if (view === 'front') {
          paint(f, disc(Hd(sk, 1.2, 0.6), 3.8), M.skin);
          paint(f, capsule(Hd(sk, 3.8, 3.4), Hd(sk, 4.4, 5.6), 0.8), CM.stormHair, { rim: false });
          dot(f, Hd(sk, 2.8, 0), GLOW_EYE.bolt);
          dot(f, Hd(sk, 4.4, 0), GLOW_EYE.bolt);
        }
        paint(f, capsule(Hd(sk, -4.4, -2.2), Hd(sk, 4.6, -2.4), 0.6), M.robeTrim, { rim: false, spec: true });
        spike(f, Hd(sk, 3.4, -2.6), Hv(sk, 0.5, -1), 4, 0.9, CM.bolt, { spec: true });
        spike(f, Hd(sk, -2.8, -2.6), Hv(sk, -0.5, -1), 3.4, 0.9, CM.bolt, { spec: true });
      }
    },
    sp_chronomancer: {
      smear: () => CM.sand,
      staff: hourglassStaff,
      // clock-face halo with a sweeping hand
      behind({ f, sk, ph, p }) {
        if (p.drop) return;
        const c = Hd(sk, -1.6, -0.6);
        paint(f, ellRing(c, 9.5, 9.5, 0.82), M.gold, { spec: true });
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2;
          dot(f, [c[0] + Math.sin(a) * 7.2, c[1] - Math.cos(a) * 7.2], i % 3 ? M.gold.m : M.gold.h);
        }
        const a = ph * Math.PI * 2;
        paint(f, capsule(c, [c[0] + Math.sin(a) * 6.4, c[1] - Math.cos(a) * 6.4], 0.5), M.gold, { rim: false, tone: 'h' });
      },
      head({ f, sk, view }) {
        paint(f, poly([Hd(sk, -3.4, -4.4), Hd(sk, -7.6, 1), Hd(sk, -4, 3)]), M.robe);
        paint(f, disc(Hd(sk, -0.4, -0.2), 5.6), M.robe);
        if (view === 'front') {
          paint(f, ellRing(Hd(sk, 2, 0.6), 4.6, 4.6, 0.78), M.robeTrim);
          paint(f, disc(Hd(sk, 2, 0.6), 3.8), CM.shadow, { rim: false });
          dot(f, Hd(sk, 2.8, 0), GLOW_EYE.gold);
          dot(f, Hd(sk, 4.4, 0), GLOW_EYE.gold);
        }
        paint(f, disc(Hd(sk, -0.6, -5.2), 1.1), CM.sand, { spec: true });
      }
    },
    sp_void_archon: {
      smear: () => CM.voidGlow,
      staff: crescentStaff,
      // tattered void wings (far one smaller, behind the near one)
      behind({ f, sk, ph, p }) {
        if (p.drop) return;
        const flap = Math.sin(ph * Math.PI * 2) * 1.6;
        for (const [k, off, alpha] of [[0.8, 1.5, 160], [1, -1, 225]]) {
          const w = (a, b) => L(sk, sk.shC, a * k + off, b * k + (b > 2 ? flap : 0));
          paint(f, poly([w(0, 0), w(-5, 5), w(-11, 10), w(-17, 6), w(-14, 2.5), w(-18, -2), w(-13, -2.5), w(-15, -8), w(-9, -5), w(-6, -9), w(-3, -3)]), CM.void, { alpha });
          paint(f, capsule(w(-2, 0.5), w(-14, 6), 0.45), CM.voidGlow, { rim: false, tone: 'm', alpha: 150 });
        }
      },
      // faceless cowl under a floating crown of shards
      head({ f, sk, view, ph }) {
        paint(f, poly([Hd(sk, -3.6, -4), Hd(sk, -3, -10), Hd(sk, 1.6, -5)]), M.robe);
        paint(f, disc(Hd(sk, -0.6, 0), 5.8), M.robe);
        if (view === 'front') {
          paint(f, disc(Hd(sk, 2, 0.8), 3.9), CM.void, { rim: false });
          dot(f, Hd(sk, 2.8, 0.2), GLOW_EYE.void);
          dot(f, Hd(sk, 4.6, 0.2), GLOW_EYE.void);
        }
        for (let i = 0; i < 3; i++) {
          const bob = Math.sin((ph + i / 3) * Math.PI * 2) * 0.8;
          const c = Hd(sk, -4 + i * 4, -11.6 - (i === 1 ? 2 : 0) + bob);
          paint(f, poly([[c[0], c[1] - 2.4], [c[0] + 1.2, c[1]], [c[0], c[1] + 2.4], [c[0] - 1.2, c[1]]]), CM.voidGlow, { spec: true });
        }
      }
    },

    // ---------------- rogue
    sp_nightblade: {
      dagger: (f, hand, d, which) => (which === 'F' ? ninjato(f, hand, d) : kunai(f, hand, d)),
      // headband tails instead of the scarf
      scarf({ f, sk, tr, fl }) {
        const [hx, hy] = sk.head;
        for (const [o, k] of [[0, 1], [1.6, 0.8]]) {
          paint(f, poly([Hd(sk, -4.2, -2.8 + o), Hd(sk, -4.2, -1.2 + o), [hx - 10 - tr * 10 * k, hy + 1 + o * 2 + fl * 1.2], [hx - 13 - tr * 13 * k, hy - 0.8 + o * 2 + fl * 1.6]]), M.scarf);
        }
      },
      head({ f, sk, view }) {
        paint(f, disc(Hd(sk, -0.4, -0.2), 5.1), M.hood);
        if (view === 'front') {
          paint(f, poly([Hd(sk, 1.4, -1.6), Hd(sk, 5.4, -1.6), Hd(sk, 5.4, 0), Hd(sk, 1.4, 0)]), M.skin, { rim: false });
          dot(f, Hd(sk, 3, -0.8), GLOW_EYE.white);
          dot(f, Hd(sk, 4.6, -0.8), GLOW_EYE.white);
        }
        paint(f, capsule(Hd(sk, -4.8, -2.4), Hd(sk, 4.8, -2.8), 0.75), M.scarf, { rim: false });
        if (view === 'front') paint(f, poly([Hd(sk, 3.4, -3.6), Hd(sk, 5.4, -3.8), Hd(sk, 5.4, -1.6), Hd(sk, 3.4, -1.6)]), CM.iron, { spec: true });
      }
    },
    sp_venom_lord: {
      dagger: kris,
      // cobra hood with a fanged snake head on the brow
      head({ f, sk, view }) {
        paint(f, poly([Hd(sk, 0, -6.4), Hd(sk, -6, -6), Hd(sk, -10.4, -1), Hd(sk, -10, 5), Hd(sk, -6.4, 9.4), Hd(sk, -1.4, 7.4)]), CM.scale, { spec: true });
        paint(f, poly([Hd(sk, -2, -4.4), Hd(sk, -7.6, -1), Hd(sk, -7.4, 4.6), Hd(sk, -3, 6)]), CM.scale, { tone: 'd', rim: false });
        paint(f, disc(Hd(sk, -0.6, -0.3), 5.4), M.hood);
        paint(f, poly([Hd(sk, -3.6, -3.6), Hd(sk, 1.6, -6.6), Hd(sk, 6.4, -5.8), Hd(sk, 7.6, -4.2), Hd(sk, 2, -3)]), CM.scale, { spec: true });
        dot(f, Hd(sk, 4.6, -5.2), ROGUE_EYE);
        spike(f, Hd(sk, 6.6, -3.8), Hv(sk, 0.15, 1), 2, 0.5, CM.bone);
        if (view === 'front') {
          paint(f, poly([Hd(sk, 1.6, -1.8), Hd(sk, 5.3, -1.8), Hd(sk, 5.3, 0.3), Hd(sk, 1.6, 0.3)]), M.skin, { rim: false });
          paint(f, poly([Hd(sk, 1.5, 0.3), Hd(sk, 5.5, 0.3), Hd(sk, 5, 3.2), Hd(sk, 1.7, 3.4)]), CM.scale, { rim: false });
          dot(f, Hd(sk, 3, -0.8), GLOW_EYE.venom);
          dot(f, Hd(sk, 4.6, -0.8), GLOW_EYE.venom);
        }
      }
    },
    sp_blade_dancer: {
      dagger: chakram,
      // long ponytail and waist ribbons instead of the scarf
      scarf({ f, sk, tr, fl }) {
        const [hx, hy] = sk.head;
        horn(f, [Hd(sk, -3.4, -3.4), [hx - 7 - tr * 5, hy - 2 + fl * 0.5], [hx - 10 - tr * 9, hy + 2 + fl], [hx - 12 - tr * 12, hy + 6 + fl * 1.5]], 2, 0.6, CM.blonde);
        for (const o of [0, 1.4]) {
          paint(f, poly([L(sk, sk.hip, -3.4, 1 - o), L(sk, sk.hip, -3.4, -0.4 - o), [sk.hip[0] - 9 - tr * 8, sk.hip[1] + 4 + o * 2 + fl * 1.4], [sk.hip[0] - 10 - tr * 10, sk.hip[1] + 2 + o * 2 + fl]]), M.scarf);
        }
      },
      head({ f, sk, view }) {
        paint(f, disc(Hd(sk, -0.6, -0.2), 5), CM.blonde);
        if (view === 'front') {
          paint(f, disc(Hd(sk, 1.6, 0.4), 3.8), M.skin);
          paint(f, capsule(Hd(sk, 0.6, -2.8), Hd(sk, 5, -2.2), 1), CM.blonde, { rim: false });
          paint(f, poly([Hd(sk, 1.4, 1), Hd(sk, 5.6, 0.8), Hd(sk, 5, 4.4), Hd(sk, 1.8, 4.6)]), M.scarf, { alpha: 210 });
          dot(f, Hd(sk, 3, -0.4), EYE);
          dot(f, Hd(sk, 4.6, -0.4), EYE);
        }
        paint(f, capsule(Hd(sk, -4.4, -2.6), Hd(sk, 4.4, -3.4), 0.55), M.strap, { rim: false, spec: true });
        paint(f, disc(Hd(sk, 3.6, -3.6), 1), M.venom, { spec: true });
      }
    },
    sp_frost_shade: {
      smear: () => CM.ice,
      dagger: iceClaws,
      // no legs: the body trails off into a ghostly wisp
      legs({ f, sk, tr, fl }) {
        const h = sk.hip;
        paint(f, poly([L(sk, h, -4, 1), L(sk, h, 4.2, 1), [h[0] + 3, h[1] + 8], [h[0] - 2 - tr * 4, h[1] + 13 + fl * 0.6], [h[0] - 7 - tr * 9, h[1] + 15 + fl], [h[0] - 5, h[1] + 6]]), CM.ghost, { alpha: 170 });
        paint(f, poly([L(sk, h, -2, 0), L(sk, h, 2.4, 0), [h[0] + 1, h[1] + 7], [h[0] - 4 - tr * 6, h[1] + 12 + fl]]), CM.ghost, { tone: 'l', rim: false, alpha: 120 });
      },
      scarf: ({ f, scarfShape }) => paint(f, scarfShape, CM.ghost, { alpha: 150 }),
      head({ f, sk, view }) {
        for (const [dx, lean, len] of [[-3.8, -0.9, 4], [-1.6, -0.5, 5], [0.8, -0.2, 3.6]]) {
          spike(f, Hd(sk, dx, -4), Hv(sk, lean, -1), len + 1, 1.1, CM.ice, { spec: true });
        }
        paint(f, disc(Hd(sk, -0.6, -0.3), 5.6), M.hood);
        paint(f, poly([Hd(sk, -1, -5.7), Hd(sk, 4.6, -4.6), Hd(sk, 6.4, -2), Hd(sk, 3, -3.8)]), M.hood);
        if (view === 'front') {
          paint(f, poly([Hd(sk, 1.4, -2), Hd(sk, 5.4, -2), Hd(sk, 5, 3.4), Hd(sk, 1.6, 3.6)]), CM.shadow, { rim: false });
          dot(f, Hd(sk, 3, -0.6), GLOW_EYE.ice);
          dot(f, Hd(sk, 4.6, -0.6), GLOW_EYE.ice);
        }
      }
    },
    sp_eclipse_reaper: {
      // one great scythe; the off hand stays empty
      dagger: (f, hand, d, which) => (which === 'F' ? scythe(f, hand, d) : undefined),
      noSmearB: true,
      smearR: [12, 22],
      // black sun with a crimson corona behind the head
      behind({ f, sk, p }) {
        if (p.drop) return;
        const c = Hd(sk, -4, -4.5);
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2, v = [Math.sin(a), -Math.cos(a)];
          spike(f, add(c, v, 8.6), v, i % 2 ? 2.6 : 4, 1, CM.crimson, { alpha: 220, rim: false });
        }
        paint(f, disc(c, 9.4), CM.crimson, { tone: 'l', rim: false, alpha: 230 });
        paint(f, disc(c, 7.6), CM.sun);
      },
      // deep hood over a bone skull mask
      head({ f, sk, view }) {
        paint(f, disc(Hd(sk, -0.6, -0.3), 5.7), M.hood);
        paint(f, poly([Hd(sk, -1, -5.8), Hd(sk, 4.8, -4.6), Hd(sk, 6.6, -1.6), Hd(sk, 3, -3.8)]), M.hood);
        if (view === 'front') {
          paint(f, poly([Hd(sk, 1.4, -2.2), Hd(sk, 5.4, -2.2), Hd(sk, 5.2, 2), Hd(sk, 4.2, 3.8), Hd(sk, 2, 3.8), Hd(sk, 1.4, 2)]), CM.bone, { spec: true });
          for (const ex of [2.6, 4.4]) {
            paint(f, disc(Hd(sk, ex, -0.6), 0.9), CM.shadow, { rim: false });
            dot(f, Hd(sk, ex, -0.6), GLOW_EYE.blood);
          }
          paint(f, capsule(Hd(sk, 2.4, 2.6), Hd(sk, 4.6, 2.6), 0.35), CM.shadow, { rim: false });
        }
      }
    }
  };

  const DRAW = { warrior: drawWarrior, mage: drawMage, rogue: drawRogue };

  // ---------------------------------------------------------------- animation
  // Run cycle: each foot spends ~45% of the cycle planted and swings through
  // the rest, so the body really travels over a planted foot.
  function runFeet(ph, stride, lift) {
    const foot = q => {
      if (q < 0.45) return [lerp(stride, -stride, q / 0.45), 0];
      const s = (q - 0.45) / 0.55;
      const e = 0.5 - 0.5 * Math.cos(s * Math.PI);
      return [lerp(-stride, stride, e), -Math.sin(s * Math.PI) * lift - (s < 0.4 ? (0.4 - s) * lift * 0.9 : 0)];
    };
    return { footF: foot(ph), footB: foot((ph + 0.5) % 1) };
  }

  const ease = {
    linear: t => t,
    in: t => t * t,
    out: t => 1 - (1 - t) * (1 - t),
    inout: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
  };

  function mix(a, b, t) {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const va = a[k] !== undefined ? a[k] : b[k];
      const vb = b[k] !== undefined ? b[k] : a[k];
      if (Array.isArray(va)) out[k] = [lerp(va[0], vb[0], t), lerp(va[1], vb[1], t)];
      else if (typeof va === 'number') out[k] = lerp(va, vb, t);
      else out[k] = t < 0.5 ? va : vb;
    }
    return out;
  }

  function sampleKeys(keys, t) {
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i].t) {
        const k0 = keys[i - 1], k1 = keys[i];
        const u = (t - k0.t) / (k1.t - k0.t || 1);
        return mix(k0.pose, k1.pose, ease[k1.ease || 'inout'](u));
      }
    }
    return keys[keys.length - 1].pose;
  }

  // Per-class base stances and action definitions
  const CLASS_ANIMS = {
    warrior: (() => {
      const base = { hip: [0, -19], lean: 0.08, head: 0, footF: [5, 0], footB: [-4, 0], handF: [6, -22.5], twoHand: true, wpn: 2.55, cape: 0.15 };
      const P = o => Object.assign({}, base, o);
      return {
        idle: { frames: 8, loop: true, pose: ph => { const b = Math.sin(ph * Math.PI * 2); return P({ hip: [0, -19 + 0.55 * b], lean: 0.08 + 0.02 * b, handF: [6, -22.5 + 0.5 * b], wpn: 2.55 + 0.03 * b, cape: 0.12 + 0.05 * Math.sin(ph * Math.PI * 2 + 1) }); } },
        // hip drops on each footfall and rises in flight; the free arm pumps hard
        run: { frames: 8, loop: true, pose: ph => { const s = Math.sin(ph * Math.PI * 2); return P(Object.assign(runFeet(ph, 8.5, 8), { hip: [1, -17.6 + 1.3 * Math.cos(ph * Math.PI * 4)], lean: 0.42, head: -0.12, twoHand: false, handF: [2 + s * 3.5, -19.5 - s], wpn: 0.75 + s * 0.2, handB: [4 - s * 7.5, -23.5 + Math.abs(s) * 2 - Math.max(0, -s) * 2], cape: 1 })); } },
        attack: { frames: 8, smear: [0.3, 0.7], keys: [
          { t: 0, pose: P({}) },
          { t: 0.24, ease: 'out', pose: P({ hip: [-1.5, -19.2], lean: -0.22, head: -0.1, footF: [6, 0], footB: [-6, 0], handF: [-4.5, -40], wpn: 3.75, wBack: true, cape: 0.3 }) },
          { t: 0.44, ease: 'in', pose: P({ hip: [3, -16.8], lean: 0.5, head: 0.15, footF: [11, 0], footB: [-6, 0], handF: [12, -21], wpn: 1.75, cape: 0.65 }) },
          { t: 0.62, ease: 'out', pose: P({ hip: [3.5, -16.3], lean: 0.6, head: 0.1, footF: [11, 0], footB: [-6, 0], handF: [8, -12.5], wpn: 0.8, cape: 0.5 }) },
          { t: 1, pose: P({}) }
        ] },
        // Return swing for combos: blade drops low behind, then rips upward
        // (wpn past 2*PI so the frames sweep forward instead of spinning back)
        attack2: { frames: 8, smear: [0.3, 0.7], keys: [
          { t: 0, pose: P({}) },
          { t: 0.24, ease: 'out', pose: P({ hip: [-1, -18], lean: 0.15, head: 0.05, footF: [7, 0], footB: [-5, 0], handF: [-5, -15], wpn: 5.6, wBack: true, cape: 0.3 }) },
          { t: 0.46, ease: 'in', pose: P({ hip: [3, -18.5], lean: -0.05, head: -0.1, footF: [11, 0], footB: [-6, 0], handF: [12, -26], wpn: 8.3, cape: 0.65 }) },
          { t: 0.64, ease: 'out', pose: P({ hip: [3, -19], lean: -0.15, head: -0.15, footF: [11, 0], footB: [-6, 0], handF: [8, -35], wpn: 9.0, cape: 0.5 }) },
          { t: 1, pose: P({ wpn: 2.55 + Math.PI * 2 }) }
        ] },
        dash: { frames: 6, keys: [
          { t: 0, pose: P({ hip: [-1, -15.5], lean: 0.45, footF: [5, 0], footB: [-6, 0], twoHand: false, handF: [1, -17], wpn: -1.2, handB: [-4, -20], cape: 0.3 }) },
          { t: 0.3, ease: 'out', pose: P({ hip: [5, -18], lean: 0.8, footF: [12, -2], footB: [-9, -2.5], twoHand: false, handF: [15, -23], wpn: 1.62, handB: [-6, -24], cape: 1 }) },
          { t: 0.7, pose: P({ hip: [6, -18.5], lean: 0.75, footF: [11, -1], footB: [-10, -3], twoHand: false, handF: [16, -24], wpn: 1.6, handB: [-7, -25], cape: 1 }) },
          { t: 1, ease: 'out', pose: P({ hip: [0, -17], lean: -0.05, footF: [8, 0], footB: [-5, 0], handF: [7, -22], wpn: 2.4, cape: 0.5 }) }
        ] },
        cast: { frames: 8, smear: [0.4, 0.62], keys: [
          { t: 0, pose: P({}) },
          { t: 0.32, ease: 'out', pose: P({ hip: [0, -19.6], lean: -0.12, head: -0.15, footF: [5, 0], footB: [-5, 0], handF: [1, -38], wpn: 3.14, wBack: true, cape: 0.4, glow: 1 }) },
          { t: 0.55, ease: 'in', pose: P({ hip: [2, -15], lean: 0.55, head: 0.1, footF: [10, 0], footB: [-6, 0], handF: [11, -12], wpn: 1.1, cape: 0.7, glow: 1 }) },
          { t: 1, pose: P({}) }
        ] },
        hurt: { frames: 4, keys: [
          { t: 0, pose: P({}) },
          { t: 0.3, ease: 'out', pose: P({ hip: [-2, -18.5], lean: -0.38, head: -0.25, footF: [5, 0], footB: [-6, 0], handF: [3, -21], wpn: 2.2, cape: 0.4 }) },
          { t: 1, pose: P({}) }
        ] },
        death: deathKeys(P, { handF: [5, -10], wpn: 1.2 })
      };
    })(),

    mage: (() => {
      const base = { hip: [0, -19], lean: 0.05, head: 0, footF: [3, 0], footB: [-3, 0], handF: [6, -23], wpn: 3.02, handB: [-1, -21.5], cape: 0.1, glow: 0.3 };
      const P = o => Object.assign({}, base, o);
      return {
        idle: { frames: 8, loop: true, pose: ph => { const b = Math.sin(ph * Math.PI * 2); return P({ hip: [0, -19 + 0.5 * b], lean: 0.05 + 0.015 * b, handF: [6, -23 + 0.4 * b], handB: [-1, -21.5 + 0.4 * b], glow: 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(ph * Math.PI * 4)), cape: 0.1 }); } },
        run: { frames: 8, loop: true, pose: ph => { const s = Math.sin(ph * Math.PI * 2); return P(Object.assign(runFeet(ph, 7.5, 6.5), { hip: [1, -18 + 1.2 * Math.cos(ph * Math.PI * 4)], lean: 0.34, head: -0.1, handF: [6 + s * 2.2, -24 - Math.abs(s) * 0.8], wpn: 2.2 + s * 0.1, handB: [-2 - s * 6.5, -23 + Math.abs(s) * 1.2], cape: 1, glow: 0.5 })); } },
        attack: { frames: 8, smear: [0.3, 0.6], keys: [
          { t: 0, pose: P({}) },
          { t: 0.26, ease: 'out', pose: P({ hip: [-1, -19], lean: -0.15, head: -0.1, footF: [4, 0], footB: [-4, 0], handF: [-3, -28], wpn: 3.6, wBack: true, handB: [3, -26], cape: 0.3, glow: 0.7 }) },
          { t: 0.46, ease: 'in', pose: P({ hip: [2, -18], lean: 0.4, head: 0.05, footF: [8, 0], footB: [-5, 0], handF: [13, -27], wpn: 1.85, handB: [-6, -23], cape: 0.6, glow: 1 }) },
          { t: 0.66, pose: P({ hip: [2, -18], lean: 0.36, footF: [8, 0], footB: [-5, 0], handF: [12, -26], wpn: 1.95, handB: [-5, -23], cape: 0.5, glow: 0.8 }) },
          { t: 1, pose: P({}) }
        ] },
        dash: { frames: 6, keys: [
          { t: 0, pose: P({ hip: [-1, -17], lean: 0.3, footF: [4, 0], footB: [-4, 0], handF: [4, -21], wpn: 2.4, cape: 0.3, glow: 0.6 }) },
          { t: 0.3, ease: 'out', pose: P({ hip: [5, -19], lean: 0.7, footF: [10, -2], footB: [-8, -3], handF: [14, -25], wpn: 1.7, handB: [-6, -24], cape: 1, glow: 1 }) },
          { t: 0.7, pose: P({ hip: [6, -19], lean: 0.68, footF: [10, -1.5], footB: [-9, -3], handF: [15, -25], wpn: 1.7, handB: [-7, -24], cape: 1, glow: 1 }) },
          { t: 1, ease: 'out', pose: P({ hip: [0, -18], lean: 0, footF: [5, 0], footB: [-3, 0], cape: 0.4 }) }
        ] },
        cast: { frames: 8, keys: [
          { t: 0, pose: P({}) },
          { t: 0.3, ease: 'out', pose: P({ hip: [0, -19.5], lean: -0.12, head: -0.2, handF: [3, -38], wpn: 3.14, handB: [-4, -35], cape: 0.5, glow: 1 }) },
          { t: 0.62, pose: P({ hip: [0, -21.5], lean: -0.1, head: -0.2, footF: [3, -2], footB: [-3, -2], handF: [3, -40], wpn: 3.14, handB: [-5, -37], cape: 0.7, glow: 1 }) },
          { t: 1, pose: P({}) }
        ] },
        hurt: { frames: 4, keys: [
          { t: 0, pose: P({}) },
          { t: 0.3, ease: 'out', pose: P({ hip: [-2, -18.5], lean: -0.36, head: -0.25, handF: [4, -21], wpn: 2.7, handB: [-5, -26], cape: 0.4, glow: 0.1 }) },
          { t: 1, pose: P({}) }
        ] },
        death: deathKeys(P, { handF: [5, -10], wpn: 2, glow: 0 })
      };
    })(),

    rogue: (() => {
      const base = { hip: [0, -17], lean: 0.22, head: -0.05, footF: [6, 0], footB: [-6, 0], handF: [7, -21], wpn: -0.5, handB: [0, -22], wpnB: -0.75, cape: 0.2 };
      const P = o => Object.assign({}, base, o);
      return {
        idle: { frames: 8, loop: true, pose: ph => { const b = Math.sin(ph * Math.PI * 2); return P({ hip: [0, -17 + 0.6 * b], lean: 0.22 + 0.02 * b, handF: [7, -21 + 0.5 * b], handB: [0, -22 + 0.5 * b], cape: 0.2 + 0.1 * Math.sin(ph * Math.PI * 2 + 1.3) }); } },
        // low ninja sprint: deep crouch, long stride, blades trailing behind
        run: { frames: 8, loop: true, pose: ph => { const s = Math.sin(ph * Math.PI * 2); return P(Object.assign(runFeet(ph, 9, 8), { hip: [1.5, -16 + 1.2 * Math.cos(ph * Math.PI * 4)], lean: 0.7, head: -0.32, handF: [-7 + s * 2.5, -18.5 + s * 0.8], wpn: -1.45, handB: [-5 - s * 2.5, -20 - s * 0.8], wpnB: -1.35, cape: 1 })); } },
        attack: { frames: 8, smear: [0.26, 0.7], keys: [
          { t: 0, pose: P({}) },
          { t: 0.22, ease: 'out', pose: P({ hip: [-1, -17], lean: 0.05, head: -0.05, handF: [1, -27], wpn: 3.6, handB: [3, -26.5], wpnB: 3.4, cape: 0.3 }) },
          { t: 0.42, ease: 'in', pose: P({ hip: [4, -15.5], lean: 0.55, head: 0.05, footF: [11, 0], footB: [-6, 0], handF: [13, -17], wpn: 1.3, handB: [11, -29], wpnB: 2.2, cape: 0.8 }) },
          { t: 0.62, ease: 'out', pose: P({ hip: [4, -15.2], lean: 0.6, footF: [11, 0], footB: [-6, 0], handF: [9, -12], wpn: 0.6, handB: [13, -24], wpnB: 1.6, cape: 0.6 }) },
          { t: 1, pose: P({}) }
        ] },
        // Return swing for combos: both blades pulled low, then swept up and across
        attack2: { frames: 8, smear: [0.26, 0.7], keys: [
          { t: 0, pose: P({}) },
          { t: 0.22, ease: 'out', pose: P({ hip: [-1, -16.5], lean: 0.35, handF: [-3, -19], wpn: -1.6, handB: [-6, -21], wpnB: -1.9, cape: 0.3 }) },
          { t: 0.42, ease: 'in', pose: P({ hip: [4, -15.5], lean: 0.6, footF: [11, 0], footB: [-6, 0], handF: [14, -22], wpn: 1.4, handB: [12, -18], wpnB: 0.9, cape: 0.8 }) },
          { t: 0.62, ease: 'out', pose: P({ hip: [4, -15.3], lean: 0.55, footF: [11, 0], footB: [-6, 0], handF: [11, -27], wpn: 2.2, handB: [13, -14], wpnB: 0.3, cape: 0.6 }) },
          { t: 1, pose: P({}) }
        ] },
        dash: { frames: 6, keys: [
          { t: 0, pose: P({ hip: [-1, -14], lean: 0.6, footF: [6, 0], footB: [-6, 0], handF: [-3, -16], wpn: -1.4, handB: [-5, -18], wpnB: -1.4, cape: 0.4 }) },
          { t: 0.3, ease: 'out', pose: P({ hip: [6, -14], lean: 1.05, head: -0.4, footF: [12, -2], footB: [-9, -3], handF: [17, -17], wpn: 1.6, handB: [-8, -18], wpnB: -1.6, cape: 1 }) },
          { t: 0.7, pose: P({ hip: [7, -14.5], lean: 1, head: -0.4, footF: [12, -1], footB: [-10, -3], handF: [18, -18], wpn: 1.6, handB: [-9, -18], wpnB: -1.6, cape: 1 }) },
          { t: 1, ease: 'out', pose: P({ hip: [0, -15], lean: 0.25, footF: [8, 0], footB: [-6, 0], cape: 0.5 }) }
        ] },
        cast: { frames: 8, smear: [0.4, 0.62], keys: [
          { t: 0, pose: P({}) },
          { t: 0.35, ease: 'out', pose: P({ hip: [0, -14], lean: 0.3, head: 0.05, footF: [6, 0], footB: [-6, 0], handF: [2, -22], wpn: 3.5, handB: [4, -21], wpnB: 3.3, cape: 0.3 }) },
          { t: 0.58, ease: 'in', pose: P({ hip: [0, -20.5], lean: -0.1, head: -0.15, footF: [4, -1.5], footB: [-4, -1.5], handF: [12, -30], wpn: 2.3, handB: [-10, -29], wpnB: -2.3, cape: 0.9, glow: 1 }) },
          { t: 1, pose: P({}) }
        ] },
        hurt: { frames: 4, keys: [
          { t: 0, pose: P({}) },
          { t: 0.3, ease: 'out', pose: P({ hip: [-2, -17], lean: -0.3, head: -0.3, handF: [4, -23], wpn: 0.3, handB: [-4, -25], wpnB: -0.3, cape: 0.5 }) },
          { t: 1, pose: P({}) }
        ] },
        death: deathKeys(P, { handF: [5, -10], wpn: 0.4, handB: [-2, -11], wpnB: -0.4 })
      };
    })()
  };

  // The mage's bolt has no return swing
  CLASS_ANIMS.mage.attack2 = CLASS_ANIMS.mage.attack;

  // Shared death: recoil, knees buckle, fall onto the back and stay down
  function deathKeys(P, arms) {
    return { frames: 8, hold: true, keys: [
      { t: 0, pose: P({}) },
      { t: 0.18, ease: 'out', pose: P({ hip: [-2, -18.5], lean: -0.5, head: -0.35, footF: [5, 0], footB: [-6, 0], cape: 0.5 }) },
      { t: 0.45, ease: 'in', pose: P(Object.assign({ hip: [-1, -11.5], lean: -0.15, head: 0.35, footF: [6, 0], footB: [-4, 0], cape: 0.3, twoHand: false, drop: true, handB: [-3, -10] }, arms)) },
      { t: 0.75, ease: 'in', pose: P(Object.assign({ hip: [-1, -12], lean: -0.1, head: 0.2, footF: [6, 0], footB: [-3, 0], cape: 0.2, rot: -0.9, shift: [2, -2], twoHand: false, drop: true, handB: [-3, -10] }, arms)) },
      { t: 1, ease: 'out', pose: P({ hip: [0, -19], lean: 0, head: 0.25, footF: [2, 0], footB: [-1, 0], handF: [3, -16], handB: [-2, -16], twoHand: false, cape: 0, rot: -1.5, shift: [12, -3.5], drop: true, glow: 0 }) }
    ] };
  }

  // Five drawn views cover the eight facings (the renderer mirrors E / SE / NE
  // for W / SW / NW). phi: turn of the side-on rig (see projectSkeleton);
  // order: which draw path the class uses ('front' = facing the camera side,
  // 'back' = seen from behind).
  const VIEW_DEF = {
    E: { phi: 0, order: 'front' },
    SE: { phi: 0.75, order: 'front' },
    S: { phi: Math.PI / 2, order: 'front' },
    NE: { phi: -0.75, order: 'back' },
    N: { phi: -Math.PI / 2, order: 'back' }
  };
  const VIEWS = Object.keys(VIEW_DEF);
  const ACTIONS = ['idle', 'run', 'attack', 'attack2', 'dash', 'cast', 'hurt', 'death'];

  function poseAt(def, i) {
    const n = def.frames;
    const t = def.loop ? i / n : (def.hold ? i / (n - 1) : i / n);
    return { pose: def.pose ? def.pose(t) : sampleKeys(def.keys, t), t };
  }

  function buildFrame(cls, view, action, i) {
    const def = CLASS_ANIMS[cls][action];
    const { pose, t } = poseAt(def, i);
    const f = newFrame();
    const vd = VIEW_DEF[view] || VIEW_DEF.E;
    const sk = skeleton(pose, (COSTUME && COSTUME.rig) || RIGS[cls], vd.phi);
    // Motion smear when the weapon swept a wide arc since the previous frame
    if (def.smear && t >= def.smear[0] && t <= def.smear[1] && i > 0 && !pose.drop) {
      const C = COSTUME || {};
      const prev = poseAt(def, i - 1).pose;
      const pairs = [[prev.wpn, pose.wpn, sk.handF, WEAPON_TILT]];
      if (cls === 'rogue' && !C.noSmearB) pairs.push([prev.wpnB === undefined ? prev.wpn : prev.wpnB, pose.wpnB, sk.handB, -WEAPON_TILT]);
      const sm = C.smear ? C.smear() : cls === 'rogue' ? M.venom : cls === 'mage' ? M.orb : M.smear;
      const r = C.smearR || (cls === 'warrior' ? [8, 19] : cls === 'mage' ? [12, 18.5] : [3.5, 11.5]);
      for (const [a0, a1, pivot, tilt] of pairs) {
        if (a0 === undefined || a1 === undefined || Math.abs(a1 - a0) <= 0.6) continue;
        const [b0, b1] = projectArc(a0, a1, vd.phi, tilt);
        smear(f, pivot, b0, b1, r[0], r[1], sm, 200);
      }
    }
    DRAW[cls](f, pose, sk, vd.order, t);
    return f;
  }

  function buildView(cls, view) {
    const out = {};
    for (const action of ACTIONS) {
      const def = CLASS_ANIMS[cls][action];
      const frames = [];
      for (let i = 0; i < def.frames; i++) frames.push(buildFrame(cls, view, action, i));
      out[action] = frames;
    }
    return out;
  }

  function buildClass(cls, views) {
    const out = {};
    for (const view of views || VIEWS) out[view] = buildView(cls, view);
    return out;
  }

  function buildAll() {
    const sheets = {};
    for (const cls of Object.keys(CLASS_ANIMS)) sheets[cls] = buildClass(cls);
    return sheets;
  }

  // Build a class wearing an SP card: its costume parts (COSTUMES[costumeKey])
  // plus some materials recoloured.
  // palette: { materialName: [outline, dark, mid, light, highlight?] }
  function buildVariant(cls, palette, costumeKey, views) {
    const saved = {};
    for (const [k, cols] of Object.entries(palette || {})) {
      if (!M[k]) continue;
      saved[k] = M[k];
      M[k] = mat(cols[0], cols[1], cols[2], cols[3], cols[4]);
    }
    COSTUME = (costumeKey && COSTUMES[costumeKey]) || null;
    try {
      return buildClass(cls, views);
    } finally {
      Object.assign(M, saved);
      COSTUME = null;
    }
  }

  // Highest opaque row of a frame (for placing name tags above the head)
  function topRow(f) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) if (f.data[(y * W + x) * 4 + 3] > 0) return y;
    }
    return AY;
  }

  const api = {
    W, H, AX, AY, ACTIONS, VIEWS,
    classes: Object.keys(CLASS_ANIMS),
    meta: (cls, action) => {
      const d = CLASS_ANIMS[cls][action];
      return { frames: d.frames, loop: !!d.loop, hold: !!d.hold };
    },
    buildAll, buildFrame, buildVariant, topRow
  };

  // ---------------------------------------------------------------- browser
  if (typeof document !== 'undefined') {
    const toCanvas = (f) => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      c.getContext('2d').putImageData(new ImageData(f.data, W, H), 0, 0);
      c.meta = f.meta;
      return c;
    };
    // Sheets are built lazily, one class (or SP card) and view at a time, so
    // a session only pays for the facings it actually shows
    const sheets = new Map();   // 'cls|view' or 'cardId|view' -> { action: canvases }
    const tops = {};
    const pick = (list, idx) => list[Math.max(0, Math.min(list.length - 1, idx))];
    const toSheet = raw => {
      const sheet = {};
      for (const a of ACTIONS) sheet[a] = raw[a].map(toCanvas);
      return sheet;
    };
    api.ready = true;
    api.init = () => {};
    api.frame = (cls, view, action, idx) => {
      if (!CLASS_ANIMS[cls]) cls = 'warrior';
      if (!VIEW_DEF[view]) view = 'E';
      const k = cls + '|' + view;
      if (!sheets.has(k)) {
        const raw = buildView(cls, view);
        if (view === 'E') tops[cls] = topRow(raw.idle[0]);
        sheets.set(k, toSheet(raw));
      }
      return pick(sheets.get(k)[action], idx);
    };
    // Optional key: an SP card id, whose costume may stand taller (horns, halo)
    api.headTop = (cls, key) => {
      if (key && tops[key] === undefined) api.variantFrame(cls, key, null, 'E', 'idle', 0);
      if (key && tops[key] !== undefined) return tops[key];
      if (tops[cls] === undefined) api.frame(cls, 'E', 'idle', 0);
      return tops[cls] !== undefined ? tops[cls] : 20;
    };
    // SP card sheet: costume + recolour (built per view on first use, then cached)
    const palettes = new Map();
    api.variantFrame = (cls, key, palette, view, action, idx) => {
      if (palette) palettes.set(key, palette);
      if (!VIEW_DEF[view]) view = 'E';
      const k = key + '|' + view;
      if (!sheets.has(k)) {
        const raw = buildVariant(cls, palettes.get(key), key, [view])[view];
        if (view === 'E') tops[key] = topRow(raw.idle[0]);
        sheets.set(k, toSheet(raw));
      }
      return pick(sheets.get(k)[action], idx);
    };
    // Head-and-shoulders portrait for HUD avatars
    api.portrait = (cls, size) => {
      const src = api.frame(cls, 'E', 'idle', 0);
      const c = document.createElement('canvas');
      c.width = c.height = size || 64;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      const top = api.headTop(cls);
      const crop = 26;
      g.drawImage(src, AX - crop / 2 + 1, Math.max(0, top - 1), crop, crop, 0, 0, c.width, c.height);
      return c.toDataURL();
    };
    root.PixelHeroes = api;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
