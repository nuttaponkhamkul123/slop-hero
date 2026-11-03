// Slop Hero - procedural pixel-art hero sprites.
// Every class is a small 2D skeleton (IK legs that keep feet planted, IK arms that
// grip the weapon) posed per action and rasterised pixel by pixel with cylinder
// shading and per-part outlines. Frames face right; the renderer flips them.
(function (root) {
  'use strict';

  const W = 80, H = 80;          // frame size (tall enough for overhead swings on the longer body)
  const AX = 40, AY = 74;        // anchor (feet on the ground)
  const LIGHT = [-0.54, -0.84];  // light from the upper left
  // Anatomy: poses and bones are authored for a stocky, big-headed hero. The
  // body is stretched by BODY_K (limbs keep their thickness, so it reads leaner)
  // and the head is drawn at HEAD_K, for closer-to-life proportions
  // (about five and a half heads tall instead of three and a half).
  const BODY_K = 1.2;
  const HEAD_K = 0.78;
  // while a head is being drawn, head-space offsets and shape radii shrink by this
  let HEAD_SCALE = 1;

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
    steel: mat('#121324', '#434a6b', '#7c87a6', '#bac4d6', '#fff8e6'),
    darkSteel: mat('#0c0d1a', '#292c47', '#4b5375', '#7783a4', '#c9cfdc'),
    platemail: mat('#141824', '#5a6485', '#8a97b9', '#c5cee6', '#f7f9ff'),
    goldTrim: mat('#2a2005', '#b8941f', '#e6b63d', '#f5d16e', '#fff3c4'),
    tabard: mat('#1c0a12', '#6b1d2c', '#a8301f', '#dc5626', '#f2864a'),
    cape: mat('#1a0612', '#5a0f2e', '#a01b27', '#d83a2c', '#f2704a'),
    leather: mat('#1a0e0c', '#4f2b1f', '#7a4a2a', '#a8743f', '#cf9f5e'),
    skin: mat('#3a1d12', '#b86f4c', '#e5a47a', '#f6c9a2'),
    gold: mat('#382403', '#9f6a10', '#dca528', '#fde58a', '#fffbe0'),
    navy: mat('#0b111f', '#1d2741', '#303f61', '#4a5d88'),
    robe: mat('#140828', '#33186a', '#5a2a9e', '#8550d0', '#b388ee'),
    robeTrim: mat('#2e1d03', '#9a6b12', '#d9a62a', '#fbe08a'),
    beard: mat('#2a2a2e', '#86868f', '#c2c2ca', '#ececf2'),
    mageArmor: mat('#0b0c18', '#252a40', '#3d4561', '#626e92', '#b8c2e0'),
    mageHair: mat('#140a0a', '#3a2018', '#613b24', '#8c5a34', '#b58450'),
    wood: mat('#1d1107', '#472a12', '#6b421f', '#936238'),
    orb: mat('#04394a', '#0aa0c4', '#43e0f4', '#c9fbff', '#ffffff'),
    rogue: mat('#0b0c16', '#2a2f45', '#434c66', '#68758f', '#93a0b8'),
    hood: mat('#08080f', '#1e2131', '#323848', '#525b70', '#77819a'),
    strap: mat('#1a0e0c', '#46271a', '#6b4322', '#9a6a3c', '#c49559'),
    scarf: mat('#04120f', '#0b3530', '#15583e', '#2a8250', '#5ab06a'),
    venom: mat('#05290f', '#15a046', '#49dd7e', '#d6ffe3', '#ffffff'),
    smear: mat('#ffffff', '#cfe8ff', '#e8f4ff', '#ffffff'),
    // base warrior: blackened gunmetal plate, ember glow, horn
    gunmetal: mat('#0b0c16', '#2c3049', '#4f5878', '#8e99ba', '#e6ebff'),
    ember: mat('#3a0a02', '#c2410c', '#fb923c', '#fed7aa', '#fffbeb'),
    horn: mat('#1a150d', '#6e6047', '#b3a37c', '#e6dcbc', '#fffaf0')
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
    r1 *= HEAD_SCALE; r2 *= HEAD_SCALE;
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
    r *= HEAD_SCALE; ry *= HEAD_SCALE;
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

  // 4x4 ordered (Bayer) thresholds, for dithered band edges on cloth
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  const mixRgb = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t));

  // Fill a shape with a material ramp; rim draws a 1px outline around it first,
  // which also gives internal lines where parts overlap.
  // o.metal: polished plate - dark core, bright band, warm glint, bounce light on the far rim
  // o.dither: cloth - band edges blended through a Bayer pattern
  // o.mail: chainmail rings over the shading
  // o.selout: selective outline, softened on the edges facing the light
  function paint(f, s, m, o) {
    o = o || {};
    const [x0, y0, x1, y1] = s.bbox;
    const alpha = o.alpha;
    const inside = (x, y) => s.test(x + 0.5, y + 0.5);
    if (o.rim !== false) {
      const soft = o.selout ? mixRgb(m.o, m.d, 0.55) : null;
      for (let y = y0 - 1; y <= y1 + 1; y++) {
        for (let x = x0 - 1; x <= x1 + 1; x++) {
          if (inside(x, y)) continue;
          const r = inside(x + 1, y), l = inside(x - 1, y), dn = inside(x, y + 1), u = inside(x, y - 1);
          if (!(r || l || dn || u)) continue;
          const ox = (l ? 1 : 0) - (r ? 1 : 0), oy = (u ? 1 : 0) - (dn ? 1 : 0);
          put(f, x, y, soft && ox * LIGHT[0] + oy * LIGHT[1] > 0.5 ? soft : m.o, alpha);
        }
      }
    }
    // Seven-step ramp: the material's four tones with a blended tone between each
    // pair, so round forms turn gradually instead of in three hard bands.
    // index: 0 dark, 1 dark/mid, 2 mid, 3 mid/light, 4 light, 5 light/high, 6 high
    const ramp = m._ramp7 || (m._ramp7 = [m.d, mixRgb(m.d, m.m, 0.5), m.m, mixRgb(m.m, m.l, 0.5), m.l, mixRgb(m.l, m.h, 0.5), m.h]);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const n = inside(x, y);
        if (!n) continue;
        let c;
        if (o.tone) c = m[o.tone];
        else {
          const s2 = n[0] * LIGHT[0] + n[1] * LIGHT[1];
          // how close to the silhouette edge (1 = on the rim): edges turn away from the viewer
          const edge = Math.min(1, n[0] * n[0] + n[1] * n[1]);
          let i;
          if (o.metal) {
            // polished plate: dark core, bright band, hot glint, bounce light on the far rim
            i = s2 > 0.86 ? 6 : s2 > 0.62 ? 5 : s2 > 0.38 ? 4 : s2 > 0.1 ? 3 : s2 > -0.2 ? 2 : s2 > -0.5 ? 1 : s2 > -0.82 ? 0 : 1;
          } else {
            i = (o.spec && s2 > 0.8) ? 6 : s2 > 0.55 ? 4 : s2 > 0.22 ? 3 : s2 > -0.14 ? 2 : s2 > -0.48 ? 1 : 0;
            if (o.dither) {
              // cloth: blend across each band edge through the Bayer pattern
              const edges = [0.55, 0.22, -0.14, -0.48];
              for (let k = 0; k < edges.length; k++) {
                if (Math.abs(s2 - edges[k]) < 0.09) { i = (s2 - edges[k] + 0.09) / 0.18 > bayer(x, y) ? 4 - k : 3 - k; break; }
              }
            }
            // soft occlusion: the shadow side of the silhouette rolls off one more step
            if (s2 < 0 && edge > 0.72) i = Math.max(0, i - 1);
          }
          if (o.mail && !(y & 1) && ((x + (y >> 1)) & 1)) i = Math.max(0, i - 2);
          c = ramp[i];
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
    // longer body (see BODY_K): the authored pose and bones stretch together, the head shrinks
    const K = BODY_K, sc = v => (v ? [v[0] * K, v[1] * K] : v);
    p = Object.assign({}, p, { hip: sc(p.hip), handF: sc(p.handF), handB: sc(p.handB), footF: sc(p.footF), footB: sc(p.footB) });
    rig = Object.assign({}, rig, {
      torso: rig.torso * K, thigh: rig.thigh * K, shin: rig.shin * K, upper: rig.upper * K, fore: rig.fore * K, headUp: rig.headUp * HEAD_K
    });
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
  // (b, along the body, stretches with BODY_K like the torso it sits on)
  const L = (sk, o, a, b) => (b *= BODY_K, [o[0] + sk.side[0] * a + sk.up[0] * b, o[1] + sk.side[1] * a + sk.up[1] * b]);
  const Hd = (sk, dx, dy) => (dx *= HEAD_SCALE, dy *= HEAD_SCALE, [sk.head[0] + sk.hside[0] * dx - sk.hup[0] * dy, sk.head[1] + sk.hside[1] * dx - sk.hup[1] * dy]);
  // Frontal head space: dx is left-right across the face (never squashed)
  const Hf = (sk, dx, dy) => {
    dx *= HEAD_SCALE; dy *= HEAD_SCALE;
    const lat = sk.hlat || sk.hside;
    return [sk.head[0] + lat[0] * dx - sk.hup[0] * dy, sk.head[1] + lat[1] * dx - sk.hup[1] * dy];
  };

  // draw a head at HEAD_K (head-space offsets and radii shrink about the head centre)
  function inHead(fn) {
    HEAD_SCALE = HEAD_K;
    try { fn(); } finally { HEAD_SCALE = 1; }
  }

  // ---------------------------------------------------------------- body parts
  function leg(f, sk, which, mats, r) {
    const hip = which === 'F' ? sk.hipF : sk.hipB;
    const knee = which === 'F' ? sk.kneeF : sk.kneeB;
    const ankle = which === 'F' ? sk.ankleF : sk.ankleB;
    const grounded = which === 'F' ? sk.groundF : sk.groundB;
    const fx = mats.fx;
    paint(f, capsule(hip, knee, r[0], r[1]), mats.thigh, fx);
    paint(f, capsule(knee, ankle, r[1], r[2]), mats.shin, fx);
    const sd = [ankle[0] - knee[0], ankle[1] - knee[1]];
    const sl = Math.hypot(sd[0], sd[1]) || 1;
    let fwd = [sd[1] / sl, -sd[0] / sl];
    if (grounded) fwd = sk.fwd || [1, 0];
    const down = [-fwd[1], fwd[0]];
    paint(f, capsule(add(add(ankle, fwd, -0.6), down, 0.8), add(add(ankle, fwd, 3.2), down, 1.1), 1.55, 1.25), mats.boot, fx);
    // cloth wraps binding the shin
    if (mats.wraps) wraps(f, knee, ankle, r[1] + 0.2, mats.wraps);
    // plate harness: a knee cop over the joint
    if (mats.cop) paint(f, disc(add(knee, [sd[0] / sl, sd[1] / sl], 0.3), r[1] + 0.35), mats.cop, fx);
  }

  // Three bands across a limb segment, a shade darker than the cloth they bind
  function wraps(f, a, b, w, m) {
    const d = norm([b[0] - a[0], b[1] - a[1]]), n = perpOf(d);
    for (const t of [0.3, 0.55, 0.8]) {
      const c = [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
      paint(f, capsule(add(add(c, n, w), d, 0.5), add(add(c, n, -w), d, -0.5), 0.36), m, { tone: 'd', rim: false });
    }
  }

  function arm(f, sk, which, mats, r) {
    const sh = which === 'F' ? sk.shF : sk.shB;
    const el = which === 'F' ? sk.elbowF : sk.elbowB;
    const hand = which === 'F' ? sk.handF : sk.handB;
    const fx = mats.fx;
    paint(f, capsule(sh, el, r[0], r[1]), mats.upper, fx);
    paint(f, capsule(el, hand, r[1], r[2]), mats.fore, fx);
    if (mats.wraps) wraps(f, el, hand, r[1] + 0.2, mats.wraps);
    // plate harness: elbow cop and a flared gauntlet cuff
    if (mats.cop) paint(f, disc(el, r[1] + 0.2), mats.cop, fx);
    if (mats.cuff) {
      const ed = [hand[0] - el[0], hand[1] - el[1]];
      paint(f, capsule(add(el, ed, 0.58), add(el, ed, 0.8), r[2] + 0.35, r[2] + 0.75), mats.cuff, fx);
    }
    paint(f, disc(hand, 1.7), mats.hand, fx);
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
    ]), M.steel, { metal: true });
    // fuller: a dark groove down the blade with a bright bevel beside it
    paint(f, capsule(add(hand, d, 3.0), add(hand, d, len * 0.62), 0.4), M.steel, { tone: 'd', rim: false });
    paint(f, capsule(add(add(hand, d, 3.2), n, 0.75), add(add(hand, d, len - 3), n, 0.6), 0.36), M.steel, { tone: 'h', rim: false });
    return add(hand, d, len);
  }

  // Base warrior's greatsword: long broad blade with an ember-lit rune fuller and swept guard
  function greatsword(f, hand, d) {
    const n = perpOf(d), len = 21;
    paint(f, capsule(add(hand, d, -3.8), add(hand, d, 1.4), 0.95), M.leather);
    spike(f, add(hand, d, -4.2), [-d[0], -d[1]], 2.2, 1.2, M.gold, { spec: true });
    paint(f, poly([add(add(hand, d, 1.4), n, 1.2), add(add(hand, d, 2.6), n, 4.2), add(add(hand, d, 2.2), n, 0), add(add(hand, d, 2.6), n, -4.2), add(add(hand, d, 1.4), n, -1.2)]), M.gold, { spec: true });
    paint(f, poly([
      add(add(hand, d, 2.4), n, 1.8), add(add(hand, d, 2.4), n, -1.8),
      add(add(hand, d, len - 3.4), n, -1.45), add(hand, d, len), add(add(hand, d, len - 3.4), n, 1.45)
    ]), M.steel, { metal: true, selout: true });
    paint(f, capsule(add(hand, d, 3.6), add(hand, d, len * 0.68), 0.5), M.ember, { tone: 'd', rim: false });
    for (let t = 4.4; t < len * 0.68; t += 2.6) paint(f, disc(add(hand, d, t), 0.55), M.ember, { tone: 'h', rim: false });
    paint(f, capsule(add(add(hand, d, 3.4), n, 1.05), add(add(hand, d, len - 3.6), n, 0.85), 0.35), M.steel, { tone: 'h', rim: false });
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
    // Full plate harness: polished metal shading, cops over knees and elbows,
    // sabatons and gauntlets; cloth is dithered, everything sel-outlined
    const MET = { metal: true, selout: true };
    const CLOTH = { dither: true, selout: true };
    // the base warrior (no SP costume) wears the blackened horned plate; costumes keep the classic look
    const cool = !COSTUME || !!COSTUME.gear;
    const legMats = cool ? { thigh: M.gunmetal, shin: M.gunmetal, boot: C.gearBoot || M.darkSteel, cop: M.steel, fx: MET }
      : { thigh: M.plate || M.steel, shin: M.steel, boot: M.darkSteel, cop: M.steel, fx: MET };
    const armMatsF = C.armMatsF ? C.armMatsF() : cool ? { upper: M.gunmetal, fore: M.gunmetal, hand: M.darkSteel, cop: M.steel, cuff: M.gold, fx: MET }
      : { upper: M.plate || M.steel, fore: M.steel, hand: M.darkSteel, cop: M.steel, cuff: M.steel, fx: MET };
    const armMatsB = C.armMatsB ? C.armMatsB() : { upper: M.darkPlate || M.darkSteel, fore: M.darkSteel, hand: M.darkSteel, cop: M.darkSteel, cuff: M.darkSteel, fx: MET };
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
      [sk.hip[0] - (1.8 + 2.2 * turn) - tr * 11 * turn, sk.hip[1] + (14.5 - tr * 7 + fl) * BODY_K],
      [sk.hip[0] - (5.6 + 2.5 * turn) - tr * 14 * turn, sk.hip[1] + (12.0 - tr * 8 + fl2) * BODY_K]
    ];
    const X = { f, p, sk, view, ph, tr, fl, fl2, capePts };
    // only SP costumes bring their own cape; otherwise the hero wears the equipped cape item (if any)
    const spLook = !!COSTUME && !COSTUME.gear;
    const capePoly = !spLook || C.cape === null ? null : poly(C.cape ? C.cape(X) : capePts);
    const drawCape = () => {
      if (!spLook) {
        if (C.gearCape) drawGearCape(f, sk, p, view, ph, C.gearCape, 4.6);
        return;
      }
      if (capePoly) {
        const cm = C.capeMat ? C.capeMat() : M.cape;
        paint(f, capePoly, cm, CLOTH);
        // heavy wool hangs in folds: dark troughs running from the shoulders to the hem
        if (!C.cape) {
          const cp = capePts, pl = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
          for (const t of [0.3, 0.7]) {
            const top = pl(pl(cp[0], cp[1], t), t < 0.5 ? pl(cp[4], cp[3], t * 2) : pl(cp[3], cp[2], t * 2 - 1), 0.2);
            const hem = t < 0.5 ? pl(cp[4], cp[3], t * 2) : pl(cp[3], cp[2], t * 2 - 1);
            paint(f, capsule(top, pl(top, hem, 0.94), 0.3, 0.6), cm, { tone: 'd', rim: false });
          }
        }
      }
      if (C.onBack) C.onBack(X);
    };
    const weapon = C.weapon || (cool ? greatsword : ((ff, hand, d) => sword(ff, hand, d, 18)));
    const wTipUp = sk.handF[1] + sk.wdir[1] * 12 < sk.neck[1];
    // the sword hand itself up at the shoulders (overhead swings), not just the blade pointing up
    const wRaised = sk.handF[1] < sk.neck[1] + 3;
    const swordBehind = !!p.wBack;
    const drawSword = () => { if (!p.drop) { f.meta.tip = weapon(f, sk.handF, sk.wdir); f.meta.hand = sk.handF; } };
    // off-hand blade (dual-wield costumes), drawn just under the back arm
    const armB = (r) => {
      if (C.weaponB && !p.drop) f.meta.tipB = C.weaponB(f, sk.handB, sk.wdirB);
      arm(f, sk, 'B', armMatsB, r);
    };
    const torso = () => {
      // hauberk skirt of riveted mail under the plate
      paint(f, poly([L(sk, sk.hip, -4.6, 1.8), L(sk, sk.hip, 4.8, 1.8), L(sk, sk.hip, 5.2, -3.6), L(sk, sk.hip, -4.8, -3.6)]), M.plate || M.darkSteel, { mail: true, selout: true });
      paint(f, poly([L(sk, sk.shC, -4.5, 1.1), L(sk, sk.shC, 4.9, 1.1), L(sk, sk.hip, 4.3, 1.4), L(sk, sk.hip, -4.1, 1.4)]), cool ? M.gunmetal : M.steel, MET);
      // fauld lames: the belly plates overlap in bands above the belt
      for (const b of [3.2, 5.0]) paint(f, capsule(L(sk, sk.hip, -3.8, b), L(sk, sk.hip, 4.2, b), 0.32), cool ? M.gunmetal : M.steel, { tone: 'd', rim: false });
      paint(f, capsule(L(sk, sk.shC, -4.2, 1.0), L(sk, sk.shC, 4.6, 1.0), 0.5), M.gold || M.robeTrim, { rim: false, spec: true });
      if (view === 'front') {
        const t0 = frontal ? -1.2 : (-1.2 + 1.6 * turn);
        paint(f, poly([L(sk, sk.shC, t0, -1.4), L(sk, sk.shC, t0 + 2.6, -1.4), L(sk, sk.hip, t0 + 2.6, -4.8), L(sk, sk.hip, t0, -4.8)]), M.tabard, CLOTH);
        paint(f, capsule(L(sk, sk.shC, t0 + 1.3, -1.2), L(sk, sk.hip, t0 + 1.3, -4.6), 0.4), M.gold || M.robeTrim, { rim: false, spec: true });
      }
      paint(f, capsule(L(sk, sk.hip, -4.2, 1.5), L(sk, sk.hip, 4.6, 1.5), 1.0), M.leather, { rim: false });
      paint(f, capsule(L(sk, sk.hip, -4.2, 1.4), L(sk, sk.hip, 4.6, 1.4), 0.55), M.gold || M.robeTrim, { rim: false, spec: true });
      // belt pouch on the off hip
      if (!frontal) {
        paint(f, poly([L(sk, sk.hip, -4.4, 1.0), L(sk, sk.hip, -2.0, 1.0), L(sk, sk.hip, -2.2, -2.2), L(sk, sk.hip, -4.2, -2.2)]), M.leather, CLOTH);
        paint(f, capsule(L(sk, sk.hip, -4.1, 0.6), L(sk, sk.hip, -2.3, 0.6), 0.35), M.leather, { tone: 'l', rim: false });
      }
      if (view === 'front') paint(f, disc(L(sk, sk.hip, frontal ? 0.2 : 1.6 * turn, 1.5), 1.1), M.gold || M.robeTrim, { rim: false, spec: true });
      if (C.torso) C.torso(X);
      // ember core set in the breastplate
      if (cool && view === 'front') {
        const c = L(sk, sk.shC, frontal ? 0.2 : 1.4 * turn, -3.2);
        paint(f, disc(c, 2.6), M.ember, { tone: 'm', rim: false, alpha: 60 });
        paint(f, disc(c, 1.25), M.ember, { spec: true });
      }
    };
    // Facing the camera / away: helmet seen straight on
    const frontalHead = () => {
      paint(f, poly([Hf(sk, -1.4, -5.4), Hf(sk, 1.4, -5.4), Hf(sk, 1.0 + fl * 0.35, -9.2), Hf(sk, -1.0 + fl * 0.35, -9.4)]), M.cape, CLOTH);
      paint(f, poly([Hf(sk, -2.8, -1.2), Hf(sk, 2.8, -1.2), Hf(sk, 2.4, -4.8), Hf(sk, -2.4, -4.8)]), M.plate || M.steel);
      paint(f, disc(Hf(sk, 0, -0.3), 5.6), M.plate || M.steel, MET);
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
    // Horned great helm with a glowing visor slit (base warrior)
    const ember = (pts, halo) => {
      paint(f, disc(halo, 3.4), M.ember, { tone: 'm', rim: false, alpha: 55 });
      for (const [a, b] of pts) paint(f, capsule(a, b, 0.75), M.ember, { tone: 'h', rim: false });
    };
    const coolHeadSide = () => {
      paint(f, disc(Hd(sk, -0.4, -0.3), 5.6), M.gunmetal, MET);
      paint(f, capsule(Hd(sk, 2.2, -5.4), Hd(sk, -4.4, -3.4), 0.6), M.gold, { rim: false, spec: true });
      if (view === 'front') {
        paint(f, poly([Hd(sk, 0.6, -1.4), Hd(sk, 5.8, -1.4), Hd(sk, 5.6, 3.4), Hd(sk, 2.8, 4.9), Hd(sk, 0.4, 4.4)]), M.gunmetal, MET);
        paint(f, capsule(Hd(sk, 0.2, -1.7), Hd(sk, 6.0, -1.7), 0.55), M.gold, { rim: false, spec: true });
        ember([[Hd(sk, 2.0, 0.3), Hd(sk, 5.6, 0.3)]], Hd(sk, 4.4, 0.3));
        for (const y of [2.3, 3.4]) dot(f, Hd(sk, 4.6, y), M.gunmetal.o);
      } else {
        paint(f, poly([Hd(sk, -4.8, 1.2), Hd(sk, 3.2, 1.2), Hd(sk, 2.8, 4.8), Hd(sk, -4.4, 4.4)]), M.darkSteel);
        paint(f, capsule(Hd(sk, -4.8, 1.1), Hd(sk, 3.2, 1.1), 0.5), M.gold, { rim: false, spec: true });
      }
      horn(f, [Hd(sk, 0.4, -3.6), Hd(sk, -3.4, -6.2), Hd(sk, -6.8, -6.8), Hd(sk, -9.0, -9.6)], 1.8, 0.4, M.horn);
    };
    const coolHeadFrontal = () => {
      for (const k of [-1, 1]) horn(f, [Hf(sk, 3.4 * k, -2.6), Hf(sk, 6.6 * k, -4.6), Hf(sk, 8.2 * k, -8), Hf(sk, 7.2 * k, -11.4)], 1.5, 0.35, M.horn);
      paint(f, disc(Hf(sk, 0, -0.3), 5.6), M.gunmetal, MET);
      paint(f, capsule(Hf(sk, 0, -5.6), Hf(sk, 0, -1.8), 0.6), M.gold, { rim: false, spec: true });
      if (view === 'front') {
        paint(f, poly([Hf(sk, -3.8, -1.4), Hf(sk, 3.8, -1.4), Hf(sk, 3.4, 3.4), Hf(sk, 0, 5.2), Hf(sk, -3.4, 3.4)]), M.gunmetal, MET);
        paint(f, capsule(Hf(sk, -4.0, -1.7), Hf(sk, 4.0, -1.7), 0.55), M.gold, { rim: false, spec: true });
        ember([[Hf(sk, -3.0, 0.3), Hf(sk, -0.9, 0.3)], [Hf(sk, 0.9, 0.3), Hf(sk, 3.0, 0.3)]], Hf(sk, 0, 0.3));
        paint(f, capsule(Hf(sk, 0, -1.2), Hf(sk, 0, 4.4), 0.5), M.gunmetal, { tone: 'l', rim: false });
      } else {
        paint(f, poly([Hf(sk, -4.2, 1.2), Hf(sk, 4.2, 1.2), Hf(sk, 3.8, 4.8), Hf(sk, -3.8, 4.8)]), M.darkSteel);
        paint(f, capsule(Hf(sk, -4.2, 1.1), Hf(sk, 4.2, 1.1), 0.5), M.gold, { rim: false, spec: true });
      }
    };
    const head = C.head ? () => C.head(X) : cool ? (frontal ? coolHeadFrontal : coolHeadSide) : frontal ? frontalHead : () => {
      paint(f, disc(Hd(sk, -0.4, -0.3), 5.6), M.plate || M.steel, MET);
      const pl = (tr * 3) + fl * 0.6;
      paint(f, poly([Hd(sk, 0, -5.5), Hd(sk, -2, -6.6), Hd(sk, -6.5 - pl, -4.6 + fl * 0.5), Hd(sk, -6 - pl * 0.7, -2.8), Hd(sk, -1.5, -4.4)]), M.cape, CLOTH);
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
    // layered spiked pauldron (base warrior)
    const coolPauldron = (pt, m) => {
      const pm = m === M.darkSteel ? M.darkSteel : M.gunmetal;
      spike(f, add(pt, sk.up, 1.8), norm([sk.up[0] - sk.side[0] * 0.45, sk.up[1] - sk.side[1] * 0.45]), 4.2, 1.2, M.steel, MET);
      paint(f, disc(add(pt, sk.up, -1.8), 3.4, 2.4), pm, MET);
      paint(f, disc(add(pt, sk.up, 0.6), 4.0, 3.2), pm, MET);
      paint(f, capsule(add(add(pt, sk.up, 0.4), sk.side, -2.4), add(add(pt, sk.up, 0.4), sk.side, 2.4), 0.45), M.gold, { rim: false, spec: true });
    };
    const pauldron = C.pauldron ? (pt, m) => C.pauldron(X, pt, m)
      : cool ? coolPauldron : (pt, m) => { paint(f, disc(add(pt, sk.up, -1.6), 3.0, 2.2), m, MET); paint(f, disc(add(pt, sk.up, 0.5), 3.4, 2.8), m, MET); paint(f, capsule(add(add(pt, sk.up, 0.5), sk.side, -1.8), add(add(pt, sk.up, 0.5), sk.side, 1.8), 0.4), M.gold || M.robeTrim, { rim: false, spec: true }); };

    if (C.behind) C.behind(X);
    if (frontal && view === 'front') {
      // Facing the camera: cape behind, both arms at the sides in front
      drawCape();
      if (swordBehind) drawSword();
      leg(f, sk, 'B', legMats, [2.3, 2.0, 1.7]);
      leg(f, sk, 'F', legMats, [2.5, 2.1, 1.8]);
      torso();
      armB([1.9, 1.7, 1.5]);
      pauldron(sk.shB, M.darkSteel);
      inHead(head);
      if (!swordBehind) drawSword();
      arm(f, sk, 'F', armMatsF, [2, 1.8, 1.6]);
      pauldron(sk.shF, M.steel);
    } else if (frontal) {
      // Facing away: the blade held in front is hidden by the body unless raised.
      // Arms go under the cape (it hangs over the back between them), so a swinging
      // arm passes behind it and only shows where it reaches past the cape's edge.
      if (!wRaised) drawSword();
      leg(f, sk, 'F', legMats, [2.5, 2.1, 1.8]);
      leg(f, sk, 'B', legMats, [2.3, 2.0, 1.7]);
      torso();
      arm(f, sk, 'F', armMatsF, [2, 1.8, 1.6]);
      armB([1.9, 1.7, 1.5]);
      inHead(head);
      drawCape();
      pauldron(sk.shF, M.steel);
      pauldron(sk.shB, M.steel);
      if (wRaised) drawSword();
    } else if (view === 'front') {
      drawCape();
      if (swordBehind) drawSword();
      armB([1.9, 1.7, 1.5]);
      leg(f, sk, 'B', legMats, [2.3, 2.0, 1.7]);
      leg(f, sk, 'F', legMats, [2.5, 2.1, 1.8]);
      torso();
      pauldron(sk.shB, M.darkSteel);
      inHead(head);
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
      inHead(head);
      if (!wTipUp) drawSword();
      // the near arm also passes under the cape (see the facing-away case)
      armB([1.9, 1.7, 1.5]);
      drawCape();
      pauldron(sk.shF, M.steel);
      pauldron(sk.shB, M.steel);
      if (wTipUp) drawSword();
    }
    if (!spLook && C.gearCape) drawGearCapeFront(f, sk, p, view, ph, C.gearCape, 4.6);
    if (C.front) C.front(X);
    if (p.drop) weapon(f, [6, -1.4], [1, 0.02]);
    if (p.drop && C.weaponB) C.weaponB(f, [-10, -1.2], [-1, 0.05]);
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
    const MET = { metal: true, selout: true };
    const CLOTH = { dither: true, selout: true };
    const legMats = { thigh: M.robe, shin: M.mageArmor, boot: C.gearBoot || M.mageArmor, cop: M.mageArmor, fx: { selout: true } };
    const sleeve = { upper: M.robe, fore: M.mageArmor, hand: C.hand || M.leather, cuff: M.robeTrim, fx: { selout: true } };
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
      paint(f, disc(c, big ? 3.5 : 3, big ? 2.6 : 2.2), M.mageArmor, MET);
      paint(f, capsule(add(c, sk.side, -3), add(c, sk.side, 3), 0.55), M.robeTrim, { rim: false, spec: true });
      spike(f, add(c, sk.up, 1.6), norm(add(sk.up, sk.side, -0.35)), big ? 3.6 : 3, 1, M.robeTrim, { spec: true });
    };
    const robeBody = () => {
      paint(f, coat, M.robe, CLOTH);
      // folds running down the coat tails
      if (!sk.rotated) {
        for (const k of frontal ? [-2.2, 2.2] : [-2.4, 0.6]) {
          const top = L(sk, sk.hip, k, -1.5);
          paint(f, capsule(top, [lerp(top[0], k < 0 ? bx : fx, 0.35), hemY - 1.2], 0.3, 0.55), M.robe, { tone: 'd', rim: false });
        }
      }
      if (!sk.rotated) paint(f, capsule([bx - tr * 4 * trail + 0.6, hemY - tr * 2.4 + sway - 0.5], [(fx + bx) / 2, hemY - 0.4], 0.6), M.robeTrim, { rim: false });
      leg(f, sk, 'B', legMats, [2.1, 1.8, 1.6]);
      leg(f, sk, 'F', legMats, [2.2, 1.9, 1.7]);
      // coat body with an armoured breastplate and a gem at the heart
      paint(f, poly([L(sk, sk.shC, -4.4, 1.2), L(sk, sk.shC, 4.8, 1.2), L(sk, sk.hip, 4.6, 1.6), L(sk, sk.hip, -4.4, 1.6)]), M.robe, CLOTH);
      paint(f, poly([L(sk, sk.shC, -2.6, 0.4), L(sk, sk.shC, 4.4, 0.4), L(sk, sk.hip, 3.8, 3.6), L(sk, sk.hip, -1.6, 3)]), M.mageArmor, MET);
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
      paint(f, disc(Hf(sk, 0, -0.4), 4.7), M.mageHair, CLOTH);
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
      paint(f, poly([Hd(sk, -3.6, -2.4), Hd(sk, -9 - tr * 2, -2.8 + sway * 0.3), Hd(sk, -6.6, 0), Hd(sk, -9.4 - tr * 2, 2 + sway * 0.4), Hd(sk, -3.8, 3)]), M.mageHair, CLOTH);
      paint(f, disc(Hd(sk, -0.4, -0.2), 4.7), M.mageHair, CLOTH);
      // a lock of hair catching the light
      paint(f, capsule(Hd(sk, -3.2, -3), Hd(sk, -7 - tr * 1.5, -2.2 + sway * 0.3), 0.35), M.mageHair, { tone: 'h', rim: false });
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
    // equipped cape (SP costumes never wear one): behind the body seen from the front, over the coat from behind
    const gearCape = COSTUME && COSTUME.gear && COSTUME.gearCape;
    const capeBack = () => { if (gearCape) drawGearCape(f, sk, p, view, ph, gearCape, 4.4); };
    if (C.behind) C.behind(X);
    if (frontal && view === 'front') {
      capeBack();
      if (staffBehind) drawStaff();
      robeBody();
      armB();
      inHead(head);
      if (!staffBehind) drawStaff();
      armF();
    } else if (frontal) {
      if (staffBehind) drawStaff();
      robeBody();
      capeBack();
      inHead(head);
      armF();
      armB();
      if (!staffBehind) drawStaff();
    } else if (view === 'front') {
      capeBack();
      if (staffBehind) drawStaff();
      armB();
      robeBody();
      inHead(head);
      if (!staffBehind) drawStaff();
      armF();
    } else {
      if (staffBehind) drawStaff();
      armF();
      robeBody();
      capeBack();
      inHead(head);
      armB();
      if (!staffBehind) drawStaff();
    }
    if (gearCape) drawGearCapeFront(f, sk, p, view, ph, gearCape, 4.4);
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
    // the plain rogue wears its own look (ROGUE_BASE); SP cards recolour the shared M
    const K = COSTUME && !COSTUME.gear ? M : (COSTUME && COSTUME.gearRL) || RL;
    const tr = p.cape || 0;
    const fl = Math.sin(ph * Math.PI * 2) * (0.7 + tr * 1.6);
    const CLOTH = { dither: true, selout: true };
    const GC = COSTUME || {};
    const legMats = { thigh: K.rogue, shin: K.rogue, boot: GC.gearBoot || K.hood, wraps: K.hood, fx: CLOTH };
    const armMats = { upper: K.rogue, fore: K.strap, hand: GC.gearHand || K.hood, wraps: K.strap, fx: CLOTH };
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
    const C = COSTUME || ROGUE_BASE;
    const X = { f, p, sk, view, ph, tr, fl, scarfShape: scarf };
    const blade = C.dagger || dagger;
    const drawDaggerF = () => { if (!p.drop) { f.meta.tipF = blade(f, sk.handF, sk.wdir, 'F'); f.meta.handF = sk.handF; } };
    const drawDaggerB = () => { if (!p.drop) { f.meta.tipB = blade(f, sk.handB, sk.wdirB, 'B'); f.meta.handB = sk.handB; } };
    // the plain / geared rogue has no cloak of its own: it wears the equipped cape item; SP costumes keep theirs
    const spLook = !!COSTUME && !COSTUME.gear;
    const drawScarf = () => {
      if (!spLook) { if (GC.gearCape) drawGearCape(f, sk, p, view, ph, GC.gearCape, 4.2); return; }
      if (C.scarf) C.scarf(X); else paint(f, scarf, K.scarf, CLOTH);
    };
    const legRadii = { F: [2.3, 2, 1.7], B: [2.2, 1.9, 1.6] };
    const drawLegs = (a, b) => {
      if (C.legs) return C.legs(X);
      leg(f, sk, a, legMats, legRadii[a]);
      leg(f, sk, b, legMats, legRadii[b]);
    };
    const torso = () => {
      paint(f, poly([L(sk, sk.shC, -4, 0.8), L(sk, sk.shC, 4.3, 0.8), L(sk, sk.hip, 3.9, 1.2), L(sk, sk.hip, -3.7, 1.2)]), K.rogue, CLOTH);
      if (view === 'front') paint(f, capsule(L(sk, sk.shC, 3.6, -0.6), L(sk, sk.hip, -3, 2.2), 0.7), K.strap, { tone: 'm', rim: false });
      paint(f, capsule(L(sk, sk.hip, -3.8, 1.2), L(sk, sk.hip, 4.1, 1.2), 0.85), K.strap, { rim: false });
      if (view === 'front') paint(f, disc(L(sk, sk.hip, frontal ? 0.2 : 1.5, 1.2), 0.9), K.venom, { rim: false, tone: 'm' });
      paint(f, poly([L(sk, sk.hip, -4.1, 1.6), L(sk, sk.hip, 4.3, 1.6), L(sk, sk.hip, 3.6, -3.8), L(sk, sk.hip, -4.4, -3.4)]), K.hood, CLOTH);
      // a spare blade sheathed and a pouch on the off hip
      if (!frontal) {
        paint(f, capsule(L(sk, sk.hip, -3.2, 2), L(sk, sk.hip, -6.4, -3.8), 0.75), K.strap, { selout: true });
        paint(f, poly([L(sk, sk.hip, -3.8, 1.2), L(sk, sk.hip, -1.4, 1.2), L(sk, sk.hip, -1.6, -1.8), L(sk, sk.hip, -3.6, -1.8)]), K.strap, CLOTH);
      }
      if (C.torso) C.torso(X);
    };
    // Facing the camera / away: hood seen straight on, masked face in the middle
    const frontalHead = () => {
      paint(f, disc(Hf(sk, 0, -0.3), 5.6), K.hood, CLOTH);
      paint(f, poly([Hf(sk, -1.6, -5.4), Hf(sk, 1.6, -5.4), Hf(sk, 0.4, -7.4)]), K.hood, CLOTH);
      if (view === 'front') {
        paint(f, poly([Hf(sk, -2.6, -1.8), Hf(sk, 2.6, -1.8), Hf(sk, 2.6, 0.3), Hf(sk, -2.6, 0.3)]), M.skin, { rim: false });
        paint(f, poly([Hf(sk, -2.8, 0.3), Hf(sk, 2.8, 0.3), Hf(sk, 2.2, 3.4), Hf(sk, -2.2, 3.4)]), K.rogue, { rim: false });
        dot(f, Hf(sk, -1.3, -0.8), ROGUE_EYE);
        dot(f, Hf(sk, 1.3, -0.8), ROGUE_EYE);
      }
    };
    const head = C.head ? () => C.head(X) : frontal ? frontalHead : () => {
      paint(f, disc(Hd(sk, -0.6, -0.3), 5.6), K.hood, CLOTH);
      paint(f, poly([Hd(sk, -1, -5.7), Hd(sk, 4.6, -4.6), Hd(sk, 6.4, -2), Hd(sk, 3, -3.8)]), K.hood, CLOTH);
      if (view === 'front') {
        paint(f, poly([Hd(sk, 1.6, -1.8), Hd(sk, 5.3, -1.8), Hd(sk, 5.3, 0.3), Hd(sk, 1.6, 0.3)]), M.skin, { rim: false });
        paint(f, poly([Hd(sk, 1.5, 0.3), Hd(sk, 5.5, 0.3), Hd(sk, 5, 3.2), Hd(sk, 1.7, 3.4)]), K.rogue, { rim: false });
        // the hood's opening falls into shadow around the face
        paint(f, capsule(Hd(sk, 1.3, -2.2), Hd(sk, 1.3, 3.4), 0.5), K.hood, { tone: 'o', rim: false });
        dot(f, Hd(sk, 3, -0.8), ROGUE_EYE);
        dot(f, Hd(sk, 4.6, -0.8), ROGUE_EYE);
      }
    };
    if (C.behind) C.behind(X);
    if (frontal && view === 'front') {
      drawScarf();
      drawLegs('B', 'F');
      torso();
      inHead(head);
      drawDaggerB();
      arm(f, sk, 'B', armMats, [1.8, 1.6, 1.4]);
      drawDaggerF();
      arm(f, sk, 'F', armMats, [1.9, 1.7, 1.5]);
    } else if (frontal) {
      drawDaggerF();
      drawDaggerB();
      drawLegs('F', 'B');
      torso();
      inHead(head);
      drawScarf();
      arm(f, sk, 'F', armMats, [1.9, 1.7, 1.5]);
      arm(f, sk, 'B', armMats, [1.8, 1.6, 1.4]);
    } else if (view === 'front') {
      drawScarf();
      drawDaggerB();
      arm(f, sk, 'B', armMats, [1.8, 1.6, 1.4]);
      drawLegs('B', 'F');
      torso();
      inHead(head);
      drawDaggerF();
      arm(f, sk, 'F', armMats, [1.9, 1.7, 1.5]);
    } else {
      drawDaggerF();
      arm(f, sk, 'F', armMats, [1.9, 1.7, 1.5]);
      drawLegs('F', 'B');
      torso();
      inHead(head);
      drawScarf();
      drawDaggerB();
      arm(f, sk, 'B', armMats, [1.8, 1.6, 1.4]);
    }
    if (!spLook && GC.gearCape) drawGearCapeFront(f, sk, p, view, ph, GC.gearCape, 4.2);
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
    sand: mat('#3a2a08', '#d4a017', '#facc15', '#fef08a'),
    silver: mat('#2e2b3a', '#8f8aa6', '#cfcbe0', '#f4f2fa', '#ffffff')
  };
  const STAR = hexRgb('#ece8ff');
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

  // War lance: long octagonal shaft, gold grip, leaf-shaped steel head
  // (Dragoon / Bannerman)
  function lance(f, hand, d) {
    const n = perpOf(d);
    paint(f, capsule(add(hand, d, -6), add(hand, d, 15), 0.8), M.wood);
    paint(f, disc(add(hand, d, -6.6), 1.1), M.gold, { spec: true });
    paint(f, capsule(add(hand, d, 6), add(hand, d, 8), 1.05), M.leather);
    const h = add(hand, d, 15.4);
    const s = (a, b) => add(add(h, d, a), n, b);
    paint(f, poly([s(0.8, -3.4), s(1.4, 4.4), s(7, 2.6), s(7, -2.6)]), M.steel, { spec: true });
    paint(f, capsule(s(1.6, 0), s(6.2, 0), 0.42), M.gold, { tone: 'h', rim: false, spec: true });
    return s(7, 0);
  }

  // Single-hand war axe: bearded crescent head on a leather grip (Warchief pairs)
  function battleAxe(f, hand, d) {
    const n = perpOf(d);
    const s = (a, b) => add(add(hand, d, a), n, b);
    paint(f, capsule(s(-2.6, 0), s(1.4, 0), 0.9), M.leather);
    paint(f, disc(s(-3.4, 0), 1.2), M.gold, { spec: true });
    spike(f, s(1.6, 0), d, 2.7, 1.1, M.gold, { spec: true });
    paint(f, poly([s(1.6, -1.5), s(4.2, -5.4), s(6.4, -5), s(4.6, 0), s(6.4, 5), s(4.2, 5.4), s(1.6, 1.5)]), M.steel, { spec: true });
    paint(f, capsule(s(3.1, 0), s(5.2, 0), 0.5), M.gold, { tone: 'h', rim: false, spec: true });
    return s(6.4, -4);
  }

  // Berserker twin blade: short heavy cleaver-sword with a blood-red fuller,
  // one in each hand
  function bloodBlade(f, hand, d) {
    const n = perpOf(d);
    const s = (a, b) => add(add(hand, d, a), n, b);
    paint(f, capsule(s(-3, 0), s(1.2, 0), 0.85), M.leather);
    paint(f, disc(s(-3.7, 0), 1.1), CM.bone, { spec: true });
    paint(f, poly([s(1.2, 2.6), s(2.4, 2.2), s(2.4, -2.2), s(1.2, -2.6)]), M.darkSteel, { spec: true });
    // widens toward a clipped, back-swept tip
    paint(f, poly([s(2.4, 1.2), s(10, 1.8), s(13.5, 1.3), s(15.5, -0.4), s(12.5, -1.6), s(2.4, -1.2)]), CM.iron, { spec: true });
    paint(f, capsule(s(3.4, 0.1), s(11.5, 0.3), 0.45), CM.crimson, { tone: 'm', rim: false });
    return s(15.5, -0.4);
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

  // Six-armed snowflake (three crossed bars) centred on c
  function snowflake(f, c, r, alpha) {
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3;
      const v = [Math.cos(a) * r, Math.sin(a) * r];
      paint(f, capsule([c[0] - v[0], c[1] - v[1]], [c[0] + v[0], c[1] + v[1]], 0.45), CM.ice, { tone: 'h', rim: false, alpha });
    }
    dot(f, c, CM.ice.h);
  }
  const FROST_HAIR = mat('#2b3a4f', '#8fb3cc', '#d4ebf7', '#ffffff');

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

  // No staff: a small ball of thunder floating in an open palm, crackling as it spins.
  // (f, hand, d, glow, ph) -> ball centre, like the staves
  function thunderBall(f, hand, d, glow, ph) {
    const c = add(hand, d, 5);
    const g = glow || 0;
    paint(f, disc(c, 2.7 + g * 1.1), CM.bolt, { tone: 'l', rim: false, alpha: Math.round(45 + g * 70) });
    paint(f, disc(c, 1.7 + g * 0.4), CM.bolt, { spec: true });
    for (let i = 0; i < 3; i++) {
      const a = (ph || 0) * Math.PI * 4 + i * 2.1;
      spike(f, c, [Math.cos(a), Math.sin(a)], 2.8 + g * 1 + (i % 2) * 0.8, 0.4, CM.bolt, { rim: false, spec: true });
    }
    return c;
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

  // Frost Shade claws: an ice-crusted gauntlet with three long glowing icicle talons
  function frostClaws(f, hand, d) {
    const n = perpOf(d);
    paint(f, disc(add(hand, d, 6), 4.2), CM.ice, { tone: 'l', rim: false, alpha: 45 });
    for (const k of [-1, 0, 1]) {
      const v = norm(add(d, n, k * 0.32));
      spike(f, add(hand, v, 0.6), v, 11 - Math.abs(k) * 2.6, 1, CM.ice, { spec: true });
      paint(f, capsule(add(hand, v, 2), add(hand, v, 8.5 - Math.abs(k) * 2.2), 0.3), CM.ice, { tone: 'h', rim: false });
    }
    paint(f, capsule(add(hand, d, -1.4), add(hand, d, 0.8), 1.4), CM.glass, { spec: true });
    return add(hand, d, 11.5);
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

  // Eclipse scythe: spiked iron snath, a crescent blade with a dark spine and a
  // glowing cutting edge, an eclipse gem where the blade meets the snath
  function eclipseScythe(f, hand, d) {
    const n = perpOf(d);
    paint(f, capsule(add(hand, d, -6), add(hand, d, 18), 0.8), CM.iron);
    spike(f, add(hand, d, -6), [-d[0], -d[1]], 2.6, 0.9, CM.iron, { spec: true });
    paint(f, capsule(add(hand, d, 8.5), add(hand, d, 9.5), 1.1), CM.iron, { spec: true });
    const end = add(hand, d, 18);
    const len = 14;
    const centre = s => add(add(end, n, -s), d, -0.065 * s * s);
    const width = s => 2.6 * (1 - s / (len + 1.2));
    const back = [], edge = [], spine = [];
    for (let s = 0; s <= len; s++) {
      const c = centre(s), w = width(s);
      back.push(add(c, d, w));
      edge.unshift(add(c, d, -w));
      spine.unshift(add(c, d, w * 0.2));
    }
    paint(f, poly(back.concat(edge)), M.venom, { spec: true });
    paint(f, poly(back.concat(spine)), CM.iron, { spec: true, rim: false });
    for (let s = 1; s < len - 1; s += 2) {
      paint(f, capsule(add(centre(s), d, -width(s) * 0.65), add(centre(s + 2), d, -width(s + 2) * 0.65), 0.4), M.venom, { tone: 'h', rim: false });
    }
    spike(f, end, n, 3.4, 1, CM.iron, { spec: true });
    spike(f, end, d, 2.4, 0.9, CM.iron, { spec: true });
    paint(f, disc(end, 1.9), CM.voidGlow, { spec: true });
    paint(f, disc(end, 1.1), CM.sun, { rim: false });
    return centre(len);
  }

  // Scatter of stars over a quad cloak (corners: top back, top front, hem front,
  // hem back); positions are in cloak space so they ride the cloth
  const CLOAK_STARS = [[0.2, 0.25], [0.65, 0.18], [0.45, 0.42], [0.15, 0.6], [0.75, 0.55], [0.35, 0.78], [0.6, 0.86], [0.85, 0.35], [0.28, 0.95]];
  function starryCloth(f, q, ph) {
    const at = (u, v) => {
      const top = [lerp(q[0][0], q[1][0], u), lerp(q[0][1], q[1][1], u)];
      const hem = [lerp(q[3][0], q[2][0], u), lerp(q[3][1], q[2][1], u)];
      return [lerp(top[0], hem[0], v), lerp(top[1], hem[1], v)];
    };
    // violet nebula drifting through the weave
    for (const [u, v, r] of [[0.35, 0.5, 2.6], [0.6, 0.72, 2.2], [0.25, 0.3, 1.8]]) {
      paint(f, disc(at(u, v), r, r * 0.7), CM.voidGlow, { tone: 'd', rim: false, alpha: 70 });
    }
    CLOAK_STARS.forEach(([u, v], i) => {
      const p = at(u, v);
      const tw = Math.sin((ph + i * 0.37) * Math.PI * 2);
      dot(f, p, tw > 0.3 ? STAR : CM.voidGlow.l);
      if (i % 3 === 0 && tw > 0.5) {
        dot(f, [p[0] + 1, p[1]], CM.voidGlow.l);
        dot(f, [p[0] - 1, p[1]], CM.voidGlow.l);
        dot(f, [p[0], p[1] + 1], CM.voidGlow.l);
        dot(f, [p[0], p[1] - 1], CM.voidGlow.l);
      }
    });
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

  // ---------------------------------------------------------------- plain rogue
  // Hooded blade in dark teal and worn leather: a cloak lined in violet, an
  // uncovered face with amber eyes, bandoliers of throwing knives and two long
  // daggers whose edges glow teal. Its own materials, so other classes' uses of
  // M.hood / M.venom stay as they are.
  const RL = {
    hood: mat('#04070a', '#0f1a1f', '#19292f', '#27404a', '#3e626d'),
    rogue: mat('#0b0809', '#261b1d', '#3a2a2c', '#533d3f', '#76595a'),
    scarf: mat('#031110', '#0c2d2b', '#164541', '#245f59', '#3f8a80'),
    strap: mat('#0a0706', '#2b1d18', '#45302a', '#634640', '#8e6a5f'),
    venom: mat('#03201e', '#0f766e', '#2dd4bf', '#ccfbf1', '#ffffff'),
    lining: mat('#12051f', '#3b0f63', '#5b21b6', '#7c3aed', '#a78bfa'),
    steel: mat('#151a20', '#56636f', '#9eacb8', '#dfe6ec', '#ffffff'),
    skin: mat('#2a1409', '#7a4527', '#a8673f', '#c98a5c'),
    shadeSkin: mat('#0a0608', '#22181c', '#2f2226', '#3d2d31'),   // a face lost in the hood's shadow
    hair: mat('#050506', '#141317', '#221f26', '#34303a')
  };

  // Long dagger: dark grip, steel guard, a straight blade with a glowing edge
  // (lk: the look's materials)
  function longDagger(f, hand, d, lk) {
    const n = perpOf(d);
    const s = (a, b) => add(add(hand, d, a), n, b);
    paint(f, capsule(s(-2.4, 0), s(1, 0), 0.8), lk.strap);
    paint(f, disc(s(-3.1, 0), 1), lk.steel, { spec: true });
    paint(f, capsule(s(1.4, -2.2), s(1.4, 2.2), 0.6), lk.steel, { spec: true });
    paint(f, poly([s(1.8, 2), s(9, 2.1), s(14.6, 0), s(9, -2.1), s(1.8, -2)]), lk.venom, { tone: 'm', rim: false, alpha: 70 });
    paint(f, poly([s(1.8, 1.1), s(9.5, 1.1), s(13.5, 0), s(9.5, -1.1), s(1.8, -1.1)]), lk.blade || lk.steel, { metal: true });
    paint(f, capsule(s(2.6, -0.6), s(11, -0.4), 0.35), lk.venom, { tone: 'l', rim: false });
    return s(13.5, 0);
  }

  // Hooded rogue costume (the plain rogue, Nightblade): a lined cloak, a cowl, crossed
  // bandoliers of throwing knives, long daggers and a hood over an open face, or
  // masked with glowing eyes (lk.mask). look() hands back the materials at draw time,
  // so an SP card palette (which recolours M) reaches them. lk.stars sprinkles the
  // cloak with starlight; lk.wisps trails smoke behind.
  function hoodedRogue(look) {
    return {
      dagger: (f, hand, d) => longDagger(f, hand, d, look()),
      behind({ f, sk, p, ph, tr }) {
        const lk = look();
        if (!lk.wisps || p.drop) return;
        // shadow smoke curling off the shoulders and streaming back
        for (let i = 0; i < 4; i++) {
          const q = (ph + i / 4) % 1;
          const c = [sk.shC[0] - 5 - q * (7 + tr * 8) - i, sk.shC[1] - 2 + i * 3 - q * 4];
          paint(f, disc(c, 2.6 * (1 - q * 0.6), 2 * (1 - q * 0.6)), lk.wisps, { tone: i % 2 ? 'd' : 'm', rim: false, alpha: Math.round(170 * (1 - q)) });
        }
      },
      // cloak over a lining that shows along the hem
      scarf({ f, sk, tr, fl, p, ph }) {
        const lk = look();
        const frontal = isFrontal(sk);
        const hemY = Math.max(sk.ankleF[1], sk.ankleB[1]) - (p.drop ? 6 : 4.5);
        let q;
        if (sk.rotated) {
          q = [L(sk, sk.shC, -4.4, 1.2), L(sk, sk.shC, 3.6, 1.2), L(sk, sk.hip, 4, -6), L(sk, sk.hip, -5.6, -7)];
        } else if (frontal) {
          q = [L(sk, sk.shC, -5, 1.2), L(sk, sk.shC, 5, 1.2),
            [sk.hip[0] + 6.5 + fl * 0.4, hemY - tr * 3], [sk.hip[0] - 6.5 + fl * 0.6, hemY - tr * 3]];
        } else {
          q = [L(sk, sk.shC, -4.4, 1.4), L(sk, sk.shC, 2.8, 1.4),
            [sk.hip[0] + 2, hemY - 1 - tr * 2],
            [sk.hip[0] - 6 - tr * 12, hemY - 2 - tr * 7 + fl]];
        }
        const shape = (drop) => {
          const hf = [q[2][0], q[2][1] + drop], hb = [q[3][0], q[3][1] + drop];
          const pts = [q[0], q[1], hf, ...ragged(hf, hb, 6, 1.8), hb];
          if (!frontal && !sk.rotated) pts.push([sk.hip[0] - 5 - tr * 6, sk.hip[1] - 3 - tr * 2 + fl * 0.5]);
          return poly(pts);
        };
        paint(f, shape(1.6), lk.lining, { dither: true });
        paint(f, shape(0), lk.cloak, { dither: true, selout: true });
        paint(f, capsule([lerp(q[0][0], q[1][0], 0.45), lerp(q[0][1], q[1][1], 0.45) + 3], [lerp(q[3][0], q[2][0], 0.5), lerp(q[3][1], q[2][1], 0.5) - 2], 0.3, 0.6), lk.cloak, { tone: 'd', rim: false });
        if (lk.stars) starryCloth(f, q, ph);
      },
      // crossed bandoliers of throwing knives and a cowl wrapped round the neck
      torso({ f, sk, view }) {
        const lk = look();
        const frontal = isFrontal(sk);
        if (view === 'front') {
          if (frontal) paint(f, capsule(L(sk, sk.shC, -3.4, -0.6), L(sk, sk.hip, 3.2, 2.2), 0.7), lk.strap, { tone: 'm', rim: false });
          const a = L(sk, sk.shC, 3.6, -0.6), b = L(sk, sk.hip, -3, 2.2);
          for (const t of [0.25, 0.45, 0.65]) {
            const c = [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
            spike(f, c, [-sk.up[0], -sk.up[1]], 2.6, 0.6, lk.steel, { spec: true });
          }
        }
        paint(f, capsule(L(sk, sk.neck, -3.2, -0.8), L(sk, sk.neck, 3.4, -0.6), 1.7), lk.cowl || lk.cloak, { dither: true, selout: true });
      },
      head({ f, sk, view }) {
        const lk = look();
        const CLOTH = { dither: true, selout: true };
        const eye = lk.mask ? GLOW_EYE.void : ROGUE_EYE;
        // a masked face glows: a soft halo round each eye
        const eyes = (pts) => pts.forEach(pt => {
          if (lk.mask) paint(f, disc(pt, 1.1), lk.venom, { tone: 'm', rim: false, alpha: 150 });
          dot(f, pt, eye);
        });
        if (isFrontal(sk)) {
          paint(f, disc(Hf(sk, 0, -0.3), 5.8), lk.hood, CLOTH);
          paint(f, poly([Hf(sk, -1.8, -5.4), Hf(sk, 1.8, -5.4), Hf(sk, 0.4, -8)]), lk.hood, CLOTH);
          if (view !== 'front') return;
          paint(f, poly([Hf(sk, -3.4, -3), Hf(sk, 3.4, -3), Hf(sk, 3.6, 4), Hf(sk, -3.6, 4)]), lk.hood, { tone: 'o', rim: false });
          paint(f, poly([Hf(sk, -2.6, -2.2), Hf(sk, 2.6, -2.2), Hf(sk, 2.4, 1.8), Hf(sk, 1.2, 3.6), Hf(sk, -1.2, 3.6), Hf(sk, -2.4, 1.8)]), lk.skin, { rim: false });
          paint(f, poly([Hf(sk, -2.8, -2.6), Hf(sk, 2.8, -2.6), Hf(sk, 1.8, -1.2), Hf(sk, 0.4, -1.8), Hf(sk, -0.8, -1), Hf(sk, -2.2, -1.6)]), lk.hair, { rim: false });
          if (lk.mask) {
            paint(f, poly([Hf(sk, -2.8, 0.6), Hf(sk, 2.8, 0.6), Hf(sk, 2.6, 2.6), Hf(sk, 0, 4), Hf(sk, -2.6, 2.6)]), lk.mask, { rim: false });
          } else {
            dot(f, Hf(sk, 0.4, 2.2), lk.skin.d);
            dot(f, Hf(sk, 1.3, 1.9), lk.skin.d);
          }
          eyes([Hf(sk, -1.2, -0.3), Hf(sk, 1.2, -0.3)]);
          return;
        }
        // the hood falls back onto the shoulders, its peak forward over the brow
        paint(f, poly([Hd(sk, -5, -1), Hd(sk, -6.4, 4.8), Hd(sk, -1, 5.4)]), lk.hood, CLOTH);
        paint(f, disc(Hd(sk, -0.6, -0.3), 5.8), lk.hood, CLOTH);
        paint(f, poly([Hd(sk, -1, -5.8), Hd(sk, 4.8, -4.8), Hd(sk, 6.6, -1.8), Hd(sk, 3, -3.8)]), lk.hood, CLOTH);
        if (view !== 'front') return;
        paint(f, poly([Hd(sk, 1.6, -2.2), Hd(sk, 5.4, -2), Hd(sk, 5.6, 0.6), Hd(sk, 4.8, 3.4), Hd(sk, 2, 3.6), Hd(sk, 1.6, 1)]), lk.skin, { rim: false });
        paint(f, poly([Hd(sk, 1.4, -2.6), Hd(sk, 5.6, -2.4), Hd(sk, 4.4, -1.2), Hd(sk, 3.2, -1.6), Hd(sk, 2.2, -0.8)]), lk.hair, { rim: false });
        if (lk.mask) {
          paint(f, poly([Hd(sk, 1.6, 0.8), Hd(sk, 5.7, 0.8), Hd(sk, 5.4, 2.8), Hd(sk, 4.4, 4), Hd(sk, 1.8, 3.8)]), lk.mask, { rim: false });
        } else {
          dot(f, Hd(sk, 4.4, 2.2), lk.skin.d);
          dot(f, Hd(sk, 5, 2), lk.skin.d);
        }
        eyes([Hd(sk, 3.2, -0.3), Hd(sk, 4.8, -0.3)]);
        paint(f, capsule(Hd(sk, 1.3, -2.4), Hd(sk, 1.3, 3.6), 0.5), lk.hood, { tone: 'o', rim: false });
      }
    };
  }

  const ROGUE_LOOK = { hood: RL.hood, cloak: RL.scarf, lining: RL.lining, strap: RL.strap, venom: RL.venom, steel: RL.steel, skin: RL.skin, hair: RL.hair };
  const ROGUE_BASE = hoodedRogue(() => ROGUE_LOOK);

  // ---------------------------------------------------------------- gear looks
  // A hero who isn't SP-transformed shows what they wear: the armor recolours
  // the body (plate / robe / leathers), the helmet swaps the head, the weapon's
  // shape and element glow follow the item, gloves and boots recolour hands
  // and feet. A gear look is a costume (gear: true) registered under a key
  // 'g|class|ids' and built through withLook like an SP card's, so it is drawn
  // lazily per view and cached. SP costumes never use any of this.
  const GM = {
    forest: mat('#06140b', '#173d24', '#24603a', '#3b8a52', '#6cbf7a'),
    olive: mat('#12140a', '#3b4120', '#5c6532', '#838f4c', '#b2bd74'),
    bronze: mat('#2a1606', '#7c4a1c', '#b0702c', '#d9a050', '#f5d08a'),
    iceSteel: mat('#0f2233', '#3d6a8c', '#6fa3c7', '#b5dcf2', '#f0fbff'),
    frostCloth: mat('#2b3a4a', '#a9c6dd', '#d6e9f7', '#ffffff'),
    night: mat('#05040a', '#1a1426', '#2a2140', '#40335e', '#6a5a94'),
    nightCloth: mat('#020205', '#0d0b14', '#18142a', '#272040', '#3b3160'),
    violet: mat('#1e0838', '#5b21b6', '#7c3aed', '#a78bfa', '#ddd6fe'),
    pearl: mat('#2e2b3a', '#9d97b5', '#d8d4ea', '#f6f4ff', '#ffffff'),
    lavender: mat('#1f1235', '#5b4a8f', '#8b78c4', '#bcaee8', '#ece6ff'),
    darkRed: mat('#1a0406', '#5a0d14', '#8a1820', '#b8302c', '#e0604a'),
    archon: mat('#3a2a08', '#c9b27a', '#efe2b8', '#fffaf0', '#ffffff'),
    holy: mat('#3a2a02', '#eab308', '#fde68a', '#fffbeb', '#ffffff'),
    earth: mat('#1a2a06', '#4d7c0f', '#84cc16', '#d9f99d', '#f7fee7'),
    riftCloth: mat('#0d0418', '#2e1065', '#4c1d95', '#6d28d9', '#a78bfa'),
    wraps: mat('#2a2218', '#8a7a5c', '#c2b08a', '#e6dcc0'),
    plume: mat('#2a0610', '#7f1d1d', '#b91c1c', '#ef4444', '#fca5a5'),
    bandana: mat('#2a0610', '#7f1d1d', '#c2410c', '#ea580c', '#fdba74'),
    hatBlue: mat('#060a1c', '#172554', '#1e3a8a', '#2f55b8', '#5b82e0'),
    hair: mat('#120a06', '#3b2416', '#5c3a22', '#7f5634', '#a87a50')
  };
  // armor -> { main: body plate / jacket, accent: trim, cloth: cape / coat / cloak, glow }
  const ARMOR_TONES = {
    leather_tunic: { main: M.leather, accent: GM.bronze, cloth: GM.forest, glow: CM.sand },
    ranger_jerkin: { main: GM.olive, accent: M.leather, cloth: M.leather, glow: GM.earth },
    chain_hauberk: { main: CM.iron, accent: CM.silver, cloth: M.navy, glow: GM.iceSteel },
    plate_cuirass: { main: M.platemail, accent: M.gold, cloth: M.cape, glow: M.gold },
    glacier_plate: { main: GM.iceSteel, accent: CM.silver, cloth: GM.frostCloth, glow: CM.ice },
    nightstalker_garb: { main: GM.night, accent: GM.violet, cloth: GM.nightCloth, glow: GM.violet },
    mystic_robe: { main: GM.pearl, accent: M.gold, cloth: GM.lavender, glow: M.orb },
    dragonscale_plate: { main: CM.scale, accent: M.gold, cloth: GM.darkRed, glow: CM.fire },
    archon_vestments: { main: GM.archon, accent: M.gold, cloth: CM.feather, glow: GM.holy },
    rift_warden_plate: { main: CM.void, accent: CM.voidGlow, cloth: GM.riftCloth, glow: CM.voidGlow }
  };
  const GLOVE_MAT = {
    leather_gloves: M.leather, iron_gauntlets: CM.iron, brawler_wraps: GM.wraps, hunters_grips: GM.forest,
    berserker_fists: CM.crimson, assassin_grips: GM.night, titans_grasp: M.gold
  };
  const BOOT_MAT = {
    iron_greaves: CM.iron, winged_boots: GM.pearl, traveler_boots: M.leather, steel_sabatons: M.platemail,
    ember_treads: CM.fire, shadowstep_boots: GM.night
  };
  const ELEM_GLOW = { fire: CM.fire, ice: CM.ice, lightning: CM.bolt, holy: GM.holy, dark: CM.voidGlow, earth: GM.earth };

  // Sword of any size with an element-lit rune fuller (glow null: a plain steel groove)
  function runeSword(len, w, glow, bladeMat) {
    return (f, hand, d) => {
      const n = perpOf(d), bm = bladeMat || M.steel;
      paint(f, capsule(add(hand, d, -3.6), add(hand, d, 1.4), 0.9), M.leather);
      paint(f, disc(add(hand, d, -4.2), 1.15), M.gold, { spec: true });
      paint(f, poly([add(add(hand, d, 1.4), n, 1), add(add(hand, d, 2.5), n, 2 + w * 1.2), add(add(hand, d, 2.2), n, 0), add(add(hand, d, 2.5), n, -2 - w * 1.2), add(add(hand, d, 1.4), n, -1)]), M.gold, { spec: true });
      paint(f, poly([
        add(add(hand, d, 2.4), n, w), add(add(hand, d, 2.4), n, -w),
        add(add(hand, d, len - 3), n, -w * 0.8), add(hand, d, len), add(add(hand, d, len - 3), n, w * 0.8)
      ]), bm, { metal: true, selout: true });
      if (glow) {
        paint(f, disc(add(hand, d, len * 0.45), w + 2.2, w + 2.2), glow, { tone: 'm', rim: false, alpha: 45 });
        paint(f, capsule(add(hand, d, 3.4), add(hand, d, len * 0.7), 0.5), glow, { tone: 'd', rim: false });
        for (let t = 4.2; t < len * 0.7; t += 2.6) paint(f, disc(add(hand, d, t), 0.55), glow, { tone: 'h', rim: false });
      } else {
        paint(f, capsule(add(hand, d, 3.2), add(hand, d, len * 0.62), 0.4), bm, { tone: 'd', rim: false });
      }
      paint(f, capsule(add(add(hand, d, 3.2), n, w * 0.55), add(add(hand, d, len - 3.2), n, w * 0.45), 0.35), bm, { tone: 'h', rim: false });
      return add(hand, d, len);
    };
  }

  // ---- forged swords: every sword item (and SP card blade) is its own model
  // built from a spec, so they differ in silhouette, not just in colour.
  //   len / w      blade length and half-width at the guard (rig units)
  //   profile(t)   width along the blade, t 0 (guard) .. 1 (tip)
  //   curve(t)     sideways bend of the centre line (sabres, katanas)
  //   wave / zig   flamberge waves or a lightning zigzag ({ amp, n })
  //   serrate      teeth on the leading edge ({ amp, n })
  //   back         width of the back edge (1 double-edged, < 1 single-edged)
  //   guard        bar | swept | wings | horns | bolt | tsuba | cup | crescent | gate
  //   pommel       disc | gem | spike | ring
  //   fuller       dark groove material, or glow: lit rune channel material
  //   extras(f, at, k)  one-off details; at(s, o) is a point s along the blade, o across it
  const smoothTip = tipFrac => t => (t < 1 - tipFrac ? 1 : Math.max(0, (1 - t) / tipFrac));
  function forgeBlade(spec) {
    return (f, hand, d) => {
      const n = perpOf(d);
      const L = spec.len, b0 = 2.3, N = 22;
      const curve = spec.curve || (() => 0);
      const wiggle = t => (spec.wave ? spec.wave.amp * Math.sin(t * spec.wave.n * Math.PI * 2) : 0)
        + (spec.zig ? spec.zig.amp * (Math.abs(((t * spec.zig.n) % 1) - 0.5) * 4 - 1) * (t < 0.92 ? 1 : 0) : 0);
      const tOf = s => Math.max(0, Math.min(1, (s - b0) / (L - b0)));
      const at = (s, o) => add(add(hand, d, s), n, (o || 0) + curve(tOf(s)) + (s > b0 ? wiggle(tOf(s)) : 0));
      const bm = spec.mat || M.steel, gm = spec.guardMat || M.gold;
      // grip, wrap and pommel
      const grip = spec.grip || 3.4;
      paint(f, capsule(at(-grip, 0), at(1.4, 0), 0.9), spec.gripMat || M.leather);
      if (spec.wrap) for (let s = -grip + 0.8; s < 1.2; s += 1.1) paint(f, capsule(at(s, 0.8), at(s + 0.5, -0.8), 0.3), spec.wrap, { tone: 'l', rim: false });
      const pm = spec.pommelMat || gm, pp = at(-grip - 0.7, 0);
      if (spec.pommel === 'spike') spike(f, at(-grip, 0), [-d[0], -d[1]], 2.6, 1.1, pm, { spec: true });
      else if (spec.pommel === 'ring') paint(f, ellRing(pp, 1.5, 1.5, 0.45), pm, { spec: true });
      else if (spec.pommel === 'gem') { paint(f, disc(pp, 1.3), gm, { spec: true }); paint(f, disc(pp, 0.7), pm, { tone: 'h', rim: false }); }
      else paint(f, disc(pp, 1.2), pm, { spec: true });
      // blade outline: both edges sampled along the (bent) centre line
      const prof = spec.profile || smoothTip(0.2);
      const back = spec.back === undefined ? 1 : spec.back;
      const top = [], bot = [], inner = [], mid = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, s = b0 + t * (L - b0);
        let w = spec.w * prof(t);
        let wt = w;
        if (spec.serrate && t > 0.08 && t < 0.86) wt += ((i % 2) ? spec.serrate.amp : 0);
        top.push(at(s, wt));
        bot.unshift(at(s, -w * back));
        inner.push(at(s, w * 0.5));
        mid.push(at(s, (w - w * back) * 0.5));
      }
      paint(f, poly(top.concat([at(L, 0)], bot)), bm, { metal: true, selout: true });
      // fuller: a dark groove, or a lit rune channel with bright beads
      const fEnd = Math.round(N * (spec.fullerTo || 0.66));
      if (spec.glow) {
        paint(f, disc(at(b0 + (L - b0) * 0.45, 0), spec.w + 2.4, spec.w + 2.4), spec.glow, { tone: 'm', rim: false, alpha: 40 });
        for (let i = 1; i < fEnd; i++) paint(f, capsule(mid[i], mid[i + 1], spec.glowW || 0.45), spec.glow, { tone: 'm', rim: false });
        for (let i = 2; i < fEnd; i += 3) paint(f, disc(mid[i], 0.55), spec.glow, { tone: 'h', rim: false });
      } else if (spec.fuller !== null) {
        for (let i = 1; i < fEnd; i++) paint(f, capsule(mid[i], mid[i + 1], 0.38), spec.fuller || bm, { tone: 'd', rim: false });
      }
      // the bright bevel along the leading edge
      const em = spec.edgeMat || bm;
      for (let i = 1; i < N - 1; i++) paint(f, capsule(inner[i], inner[i + 1], 0.32), em, { tone: 'h', rim: false });
      // guard
      const G = 1.8, span = spec.span || 3.2, gp = at(G, 0);
      const MET = { metal: true, selout: true };
      switch (spec.guard) {
        case 'swept':      // quillons bent toward the blade, quatrefoil ends
          for (const k of [-1, 1]) {
            paint(f, capsule(gp, at(G + 1.6, span * k), 0.75), gm, MET);
            paint(f, disc(at(G + 1.9, (span + 0.5) * k), 1), gm, { spec: true });
          }
          break;
        case 'wings':      // angel wings swept up the blade
          for (const k of [-1, 1]) {
            paint(f, poly([at(G - 0.4, 0.7 * k), at(G - 0.2, span * k), at(G + 4.6, (span + 1.4) * k), at(G + 3.2, span * 0.62 * k), at(G + 2.4, (span * 0.7) * k), at(G + 1.4, 1.1 * k)]), gm, MET);
            paint(f, capsule(at(G + 0.6, span * 0.55 * k), at(G + 3.6, (span + 0.6) * k), 0.3), gm, { tone: 'h', rim: false });
          }
          break;
        case 'horns':      // curled horns hooking forward
          for (const k of [-1, 1]) horn(f, [at(G, 0.6 * k), at(G + 0.2, span * 0.7 * k), at(G + 1.6, span * k), at(G + 3.2, (span - 0.4) * k)], 0.9, 0.35, gm);
          break;
        case 'bolt':       // a crossguard broken like lightning
          for (const k of [-1, 1]) paint(f, poly([at(G - 0.7, 0.4 * k), at(G + 0.3, span * 0.55 * k), at(G - 0.5, span * 0.6 * k), at(G + 0.9, (span + 0.9) * k), at(G + 0.6, span * 0.45 * k), at(G + 1.2, 0.5 * k)]), gm, MET);
          break;
        case 'tsuba':      // round katana guard
          paint(f, disc(gp, span * 0.6, span * 0.6), gm, MET);
          paint(f, disc(gp, span * 0.28, span * 0.28), gm, { tone: 'd', rim: false });
          break;
        case 'cup':        // rapier cup and knuckle bow
          paint(f, crescentShape(at(G - 0.2, 0), span * 0.7, [d[0] * -1.4, d[1] * -1.4]), gm, MET);
          horn(f, [at(G, -span * 0.6), at(-0.6, -span * 0.85), at(-grip + 0.4, -1)], 0.45, 0.4, gm);
          break;
        case 'crescent':   // a moon hooked round the blade
          paint(f, crescentShape(gp, span * 0.75, [d[0] * 1.4, d[1] * 1.4]), gm, MET);
          break;
        case 'gate':       // a wide lintel with two posts running up the blade
          paint(f, capsule(at(G, span), at(G, -span), 0.95), gm, MET);
          for (const k of [-1, 1]) spike(f, at(G, (span - 0.5) * k), d, 3.4, 0.7, gm, MET);
          paint(f, disc(gp, 1.1), spec.gemMat || CM.ice, { spec: true });
          break;
        default:           // straight bar with squared ends
          paint(f, capsule(at(G, span), at(G, -span), 0.8), gm, MET);
          for (const k of [-1, 1]) paint(f, disc(at(G, span * k), 1.05), gm, { spec: true });
      }
      if (spec.gemMat && spec.guard !== 'gate') paint(f, disc(gp, 0.95), spec.gemMat, { spec: true });
      if (spec.extras) spec.extras(f, at, { hand, d, n, L, b0, top, bot });
      return at(L, 0);
    };
  }
  // a small four-point sparkle
  const twinkle = (f, p, m) => { dot(f, p, m.h); for (const v of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(f, [p[0] + v[0], p[1] + v[1]], m.l); };

  const SWORDS = {
    // Knight Broadsword: broad, parallel edges, plain bar guard and iron pommel
    iron_blade: forgeBlade({ len: 19, w: 1.6, profile: smoothTip(0.16), guard: 'bar', span: 3.4, guardMat: CM.iron, pommelMat: CM.iron, fullerTo: 0.72 }),
    // Sweeping Claymore: long two-hander, swept quillons, leather ricasso, earthen runes
    sweeping_claymore: forgeBlade({ len: 24, w: 1.45, profile: t => (t < 0.8 ? 1 - 0.3 * t : (1 - t) / 0.2 * 0.76), grip: 4.8, guard: 'swept', span: 3.6, guardMat: GM.bronze,
      pommel: 'gem', pommelMat: GM.earth, glow: GM.earth, fullerTo: 0.7,
      extras: (f, at) => paint(f, capsule(at(2.6, 0), at(4.6, 0), 1.9), GM.wraps, { selout: true }) }),
    // Inferno Edge: flamberge waves, horned guard, a burning channel and a flame at the tip
    inferno_blade: forgeBlade({ len: 21, w: 1.55, wave: { amp: 0.75, n: 3 }, profile: smoothTip(0.18), guard: 'horns', span: 2.8, guardMat: GM.darkRed,
      pommel: 'spike', pommelMat: GM.darkRed, glow: CM.fire, glowW: 0.6, edgeMat: CM.fire,
      extras: (f, at, k) => { flame(f, at(k.L - 1.5, 0), 3.4, 1.3, 0); for (const s of [8, 13]) dot(f, at(s, 2.6), CM.fire.h); } }),
    // Storm Breaker: a lightning-bolt blade, a broken crossguard and sparks jumping off it
    storm_breaker: forgeBlade({ len: 21, w: 1.35, zig: { amp: 0.75, n: 4 }, profile: smoothTip(0.14), mat: CM.iron, guard: 'bolt', span: 3, guardMat: CM.bolt,
      pommel: 'gem', pommelMat: CM.bolt, glow: CM.bolt, glowW: 0.35, fullerTo: 0.9,
      extras: (f, at) => { twinkle(f, at(11, 3.4), CM.bolt); twinkle(f, at(17, -3.2), CM.bolt); } }),
    // Radiant Holy Blade: silver leaf blade between angel wings, a sapphire and a halo of light
    excalibur: forgeBlade({ len: 23, w: 1.4, profile: t => (t < 0.82 ? 1 + 0.3 * Math.sin(t / 0.82 * Math.PI) : (1 - t) / 0.18), mat: CM.silver, guard: 'wings', span: 4,
      guardMat: GM.holy, gemMat: CM.ice, pommel: 'gem', pommelMat: CM.ice, glow: GM.holy, glowW: 0.35,
      extras: (f, at, k) => twinkle(f, at(k.L + 1.2, 0), GM.holy) }),
    // Gatekeeper's Greatsword: a slab of silver with gate-window slots, a squared chisel point and a gate guard
    gatekeeper_greatsword: forgeBlade({ len: 26, w: 2.5, profile: t => (t < 0.9 ? 1 : 1 - (t - 0.9) / 0.1 * 0.7), back: 0.85, mat: CM.silver, guard: 'gate', span: 4.4,
      guardMat: GM.holy, grip: 5, pommel: 'ring', fuller: null,
      extras: (f, at) => { for (const s of [7, 11.5, 16]) paint(f, capsule(at(s, 0), at(s + 2.2, 0), 0.65), CM.void, { rim: false }); for (const s of [5, 20]) dot(f, at(s, 0), GM.holy.h); } }),
    // Riftwalker's Edge: a dark single-edged blade split by a glowing rift, shards drifting at the tip
    riftwalker_edge: forgeBlade({ len: 22, w: 1.9, back: 0.55, curve: t => 0.9 * t * t, mat: GM.night, guard: 'crescent', span: 3, guardMat: GM.violet,
      pommel: 'gem', pommelMat: CM.voidGlow, fuller: null, edgeMat: GM.lavender,
      extras: (f, at, k) => {
        const crack = [at(3, 0), at(6, 0.6), at(8, -0.3), at(11, 0.5), at(13.5, -0.4), at(16, 0.3), at(18, 0)];
        paint(f, disc(at(11, 0), 4.6, 4.6), CM.voidGlow, { tone: 'm', rim: false, alpha: 45 });
        for (let i = 0; i < crack.length - 1; i++) paint(f, capsule(crack[i], crack[i + 1], 0.75), CM.voidGlow, { tone: 'l', rim: false });
        for (let i = 0; i < crack.length - 1; i++) paint(f, capsule(crack[i], crack[i + 1], 0.35), CM.voidGlow, { tone: 'h', rim: false });
        paint(f, capsule(at(8, -0.3), at(9.5, -1.6), 0.3), CM.voidGlow, { tone: 'l', rim: false });
        for (const [s, o] of [[k.L - 2, 3.2], [k.L + 1, -2.6]]) { const c = at(s, o); paint(f, poly([[c[0], c[1] - 1.4], [c[0] + 0.8, c[1]], [c[0], c[1] + 1.4], [c[0] - 0.8, c[1]]]), CM.voidGlow, { spec: true }); }
      } }),
    // Nightfall (one blade in a warrior's hands): a crescent sabre with a moon guard and stars
    nightfall_twinblades: forgeBlade({ len: 20, w: 1.4, back: 0.5, profile: t => (t < 0.8 ? 0.8 + 0.6 * Math.sin(t / 0.8 * Math.PI) : (1 - t) / 0.2 * 0.8), curve: t => 4.2 * t * t, mat: GM.night, guard: 'crescent', span: 2.8, guardMat: CM.silver,
      pommel: 'disc', pommelMat: CM.silver, fuller: null, edgeMat: CM.silver,
      extras: (f, at) => { for (const [s, o] of [[9, 3.4], [14, -2.8], [18, 3.6]]) twinkle(f, at(s, o), CM.silver); } })
  };

  // SP card blades (Reaver, Runeknight, Duskblade, Phoenix Oath). Specs are
  // read when drawn, so a card's palette (it swaps shared materials) applies.
  const SP_SPECS = {
    // a serrated blood greatsword
    reaver: () => forgeBlade({ len: 27, w: 1.9, serrate: { amp: 0.75 }, back: 0.8, profile: smoothTip(0.14), mat: CM.iron, guard: 'horns', span: 3.4, guardMat: CM.bone,
      grip: 4.6, pommel: 'spike', pommelMat: CM.bone, glow: CM.crimson, glowW: 0.5 }),
    // a rune-etched knightly blade: glyph crosses along a pale channel
    runeknight: () => forgeBlade({ len: 25, w: 1.5, mat: CM.silver, guard: 'swept', span: 3.4, guardMat: M.robeTrim, pommel: 'gem', pommelMat: M.orb, glow: CM.ghost, glowW: 0.3,
      extras: (f, at) => { for (const s of [6, 10, 14]) { paint(f, capsule(at(s, -0.9), at(s, 0.9), 0.25), M.orb, { tone: 'h', rim: false }); paint(f, capsule(at(s - 0.9, 0), at(s + 0.9, 0), 0.25), M.orb, { tone: 'h', rim: false }); } } }),
    // a falchion that widens toward a clipped point
    duskblade: () => forgeBlade({ len: 25, w: 1.4, back: 0.4, profile: t => (t < 0.82 ? 0.9 + 0.9 * t : (1 - t) / 0.18 * 1.64), curve: t => -1.2 * t * t, mat: GM.riftCloth,
      guard: 'crescent', span: 3, guardMat: GM.violet, pommel: 'gem', pommelMat: CM.voidGlow, fuller: null, edgeMat: CM.voidGlow }),
    // a silver blade cradled by flame wings
    phoenix: () => forgeBlade({ len: 25, w: 1.45, mat: CM.silver, guard: 'wings', span: 3.2, guardMat: CM.fire, pommel: 'gem', pommelMat: CM.fire, glow: CM.fire, glowW: 0.4 })
  };
  const SP_SWORDS = {};
  for (const k of Object.keys(SP_SPECS)) SP_SWORDS[k] = (f, hand, d) => SP_SPECS[k]()(f, hand, d);

  // Rogue blades: a pair per weapon (the off hand gets its partner, or nothing)
  const ROGUE_SWORDS = {
    // Zephyr Swiftblade: a swept-hilt rapier, with a parrying dagger in the off hand
    wind_rapier: {
      F: forgeBlade({ len: 18, w: 0.65, profile: t => 1 - 0.4 * t, mat: CM.silver, guard: 'cup', span: 3, guardMat: GM.iceSteel, grip: 2.6, pommel: 'disc', pommelMat: GM.iceSteel,
        fuller: null, extras: (f, at) => { for (const [s, o] of [[8, 2.2], [11, -2]]) paint(f, capsule(at(s, o), at(s - 3, o), 0.3), CM.ghost, { tone: 'l', rim: false, alpha: 160 }); } }),
      B: forgeBlade({ len: 9, w: 0.85, mat: CM.silver, guard: 'bar', span: 2.2, guardMat: GM.iceSteel, grip: 2.2, fuller: null })
    },
    // Frostbite Katana: curved single edge, round tsuba, white-wrapped grip, ice at the tip; a wakizashi beside it
    frostbite_katana: {
      F: forgeBlade({ len: 18, w: 0.95, back: 0.35, curve: t => 1.3 * t * t, profile: smoothTip(0.1), mat: GM.iceSteel, edgeMat: CM.ice, guard: 'tsuba', span: 2.4, guardMat: CM.iron,
        grip: 3.4, gripMat: GM.frostCloth, wrap: CM.iron, pommel: 'disc', pommelMat: CM.iron, fuller: null,
        extras: (f, at, k) => spike(f, at(k.L - 1, 0.6), k.d, 2.2, 0.7, CM.ice, { spec: true }) }),
      B: forgeBlade({ len: 10, w: 0.75, back: 0.35, curve: t => 0.6 * t * t, profile: smoothTip(0.12), mat: GM.iceSteel, edgeMat: CM.ice, guard: 'tsuba', span: 2, guardMat: CM.iron,
        grip: 2.4, gripMat: GM.frostCloth, wrap: CM.iron, fuller: null })
    },
    // Nightfall Twinblades: a matched pair of crescent moon blades
    nightfall_twinblades: {
      F: forgeBlade({ len: 13, w: 1.25, back: 0.5, curve: t => 2.8 * t * t, mat: GM.night, edgeMat: CM.silver, guard: 'crescent', span: 2.2, guardMat: CM.silver, grip: 2.4, fuller: null,
        extras: (f, at) => dot(f, at(8, 2.4), STAR) }),
      B: forgeBlade({ len: 13, w: 1.25, back: 0.5, curve: t => -2.8 * t * t, mat: GM.night, edgeMat: CM.silver, guard: 'crescent', span: 2.2, guardMat: CM.silver, grip: 2.4, fuller: null,
        extras: (f, at) => dot(f, at(8, -2.4), STAR) })
    },
    // Riftwalker's Edge: one rift-split blade, the off hand free
    riftwalker_edge: {
      F: forgeBlade({ len: 16, w: 1.4, back: 0.5, curve: t => 0.7 * t * t, mat: GM.night, edgeMat: GM.lavender, guard: 'crescent', span: 2.6, guardMat: GM.violet, grip: 2.6,
        pommel: 'gem', pommelMat: CM.voidGlow, fuller: null,
        extras: (f, at) => { const c = [at(3, 0), at(5.5, 0.4), at(8, -0.3), at(11, 0.2)]; for (let i = 0; i < c.length - 1; i++) paint(f, capsule(c[i], c[i + 1], 0.55), CM.voidGlow, { tone: 'h', rim: false }); } }),
      B: null
    }
  };

  const WARRIOR_WEAPONS = {
    iron_blade: () => SWORDS.iron_blade,
    sweeping_claymore: () => SWORDS.sweeping_claymore,
    inferno_blade: () => SWORDS.inferno_blade,
    storm_breaker: () => SWORDS.storm_breaker,
    excalibur: () => SWORDS.excalibur,
    woodsman_axe: () => battleAxe,
    iron_morningstar: () => mace,
    thunder_maul: () => warhammer,
    dragonbone_glaive: () => lance,
    gatekeeper_greatsword: () => SWORDS.gatekeeper_greatsword,
    riftwalker_edge: () => SWORDS.riftwalker_edge,
    nightfall_twinblades: () => SWORDS.nightfall_twinblades
  };
  const MAGE_STAVES = {
    glacial_spire: crystalStaff, archmage_staff: brazierStaff, sunfire_conduit: brazierStaff,
    voidcaller_wand: crescentStaff, riftwalker_edge: crescentStaff, nightfall_twinblades: crescentStaff
  };

  // ---- helmets: one head drawer per style, shared by every class (the face and
  // hair under an open helm follow the class)
  const HELM_STYLE = {
    iron_helm: 'greathelm', horned_helm: 'horned', shadow_hood: 'hood', rogue_bandana: 'bandana',
    archmage_cowl: 'astral', starweaver_hat: 'wizard', winter_crown: 'winter', bone_warden_mask: 'skull'
  };
  const CLASS_HAIR = { warrior: GM.hair, mage: M.mageHair, rogue: RL.hair };
  const CLASS_SKIN = { warrior: M.skin, mage: M.skin, rogue: RL.skin };

  function gearHead(style, cls) {
    const hair = CLASS_HAIR[cls], skin = CLASS_SKIN[cls];
    const CLOTH = { dither: true, selout: true }, MET = { metal: true, selout: true };
    // bare face and hair (open helms, crowns, hats)
    const face = ({ f, sk, view }) => {
      if (isFrontal(sk)) {
        paint(f, disc(Hf(sk, 0, -0.5), 5.1), hair, CLOTH);
        if (view !== 'front') { paint(f, poly([Hf(sk, -3.4, 1.5), Hf(sk, 3.4, 1.5), Hf(sk, 2.6, 5.6), Hf(sk, -2.6, 5.6)]), hair); return; }
        paint(f, poly([Hf(sk, -3.2, -1.6), Hf(sk, 3.2, -1.6), Hf(sk, 3, 2), Hf(sk, 1.4, 4), Hf(sk, -1.4, 4), Hf(sk, -3, 2)]), skin, { rim: false });
        paint(f, poly([Hf(sk, -3.6, -2.2), Hf(sk, 3.6, -2.2), Hf(sk, 2.2, -0.8), Hf(sk, 0.4, -1.4), Hf(sk, -1.6, -0.6), Hf(sk, -3.2, -1)]), hair, { rim: false });
        dot(f, Hf(sk, -1.3, 0.4), EYE); dot(f, Hf(sk, 1.3, 0.4), EYE);
        return;
      }
      paint(f, disc(Hd(sk, -0.6, -0.4), 5.1), hair, CLOTH);
      if (view !== 'front') return;
      paint(f, poly([Hd(sk, 1, -1.6), Hd(sk, 5.4, -1.4), Hd(sk, 5.6, 1.4), Hd(sk, 4.6, 3.8), Hd(sk, 1.4, 4.2)]), skin, { rim: false });
      paint(f, poly([Hd(sk, -0.4, -3.4), Hd(sk, 5.4, -2.6), Hd(sk, 4, -1), Hd(sk, 1.2, -1.2)]), hair, { rim: false });
      dot(f, Hd(sk, 3.2, 0.2), EYE); dot(f, Hd(sk, 4.8, 0.2), EYE);
    };
    const glowEyes = (f, pts, m, eye) => pts.forEach(pt => { paint(f, disc(pt, 1.2), m, { tone: 'm', rim: false, alpha: 140 }); dot(f, pt, eye); });

    const STYLES = {
      // closed bucket helm, cross-shaped visor slit, a red plume
      greathelm(X) {
        const { f, sk, view, tr, fl } = X, fr = isFrontal(sk), s = fl || 0, t = tr || 0;
        if (fr) {
          paint(f, poly([Hf(sk, -1.2, -5.2), Hf(sk, 1.2, -5.2), Hf(sk, 1 + s * 0.3, -9.4), Hf(sk, -1 + s * 0.3, -9.6)]), GM.plume, CLOTH);
          paint(f, poly([Hf(sk, -5, -4.8), Hf(sk, 5, -4.8), Hf(sk, 5.4, 4.6), Hf(sk, -5.4, 4.6)]), M.steel, MET);
          paint(f, capsule(Hf(sk, -5, -3.4), Hf(sk, 5, -3.4), 0.6), M.gold, { rim: false, spec: true });
          if (view === 'front') {
            paint(f, capsule(Hf(sk, -4, 0.2), Hf(sk, 4, 0.2), 0.6), CM.slit, { rim: false });
            paint(f, capsule(Hf(sk, 0, -1), Hf(sk, 0, 3.8), 0.55), CM.slit, { rim: false });
          }
          return;
        }
        paint(f, poly([Hd(sk, -1, -5), Hd(sk, -4, -7.6), Hd(sk, -8.6 - t * 3, -6.4 + s * 0.5), Hd(sk, -7.4 - t * 2, -4.4), Hd(sk, -3.6, -4.6)]), GM.plume, CLOTH);
        paint(f, poly([Hd(sk, -5, -5), Hd(sk, 4.8, -5), Hd(sk, 5.6, -3.2), Hd(sk, 5.6, 4.6), Hd(sk, -5, 4.6)]), M.steel, MET);
        paint(f, capsule(Hd(sk, -5, -3.4), Hd(sk, 5.6, -3.4), 0.6), M.gold, { rim: false, spec: true });
        if (view === 'front') {
          paint(f, capsule(Hd(sk, 1.4, 0.2), Hd(sk, 5.8, 0.2), 0.6), CM.slit, { rim: false });
          paint(f, capsule(Hd(sk, 3.8, -1), Hd(sk, 3.8, 3.6), 0.5), CM.slit, { rim: false });
        }
      },
      // open-faced helm, nose guard, two great bone horns
      horned(X) {
        const { f, sk, view } = X, fr = isFrontal(sk);
        face(X);
        if (fr) {
          for (const k of [-1, 1]) horn(f, [Hf(sk, 4 * k, -2.4), Hf(sk, 7.4 * k, -3.6), Hf(sk, 9 * k, -7), Hf(sk, 8 * k, -10.4)], 1.7, 0.4, CM.bone);
          paint(f, poly([Hf(sk, -5.4, -1), Hf(sk, 5.4, -1), Hf(sk, 4.6, -4.4), Hf(sk, 0, -6.2), Hf(sk, -4.6, -4.4)]), M.steel, MET);
          paint(f, capsule(Hf(sk, -5.4, -1.2), Hf(sk, 5.4, -1.2), 0.7), M.gold, { rim: false, spec: true });
          if (view === 'front') paint(f, capsule(Hf(sk, 0, -1), Hf(sk, 0, 2.4), 0.6), M.steel, { tone: 'l', rim: false });
          return;
        }
        horn(f, [Hd(sk, -2, -3.6), Hd(sk, -5.6, -5), Hd(sk, -7.6, -8.4), Hd(sk, -6.6, -11.6)], 1.7, 0.4, CM.bone);
        paint(f, poly([Hd(sk, -5.4, -1), Hd(sk, 5.6, -1), Hd(sk, 4.4, -4.6), Hd(sk, -0.4, -6.2), Hd(sk, -4.6, -4.4)]), M.steel, MET);
        paint(f, capsule(Hd(sk, -5.4, -1.2), Hd(sk, 5.6, -1.2), 0.7), M.gold, { rim: false, spec: true });
        if (view === 'front') paint(f, capsule(Hd(sk, 4.6, -1), Hd(sk, 4.8, 2.6), 0.6), M.steel, { tone: 'l', rim: false });
        horn(f, [Hd(sk, 2.4, -3.6), Hd(sk, 1.4, -6.4), Hd(sk, -1.2, -9), Hd(sk, -0.6, -12)], 1.7, 0.4, CM.bone);
      },
      // deep cowl, the face lost in shadow but for two glowing eyes
      hood(X) {
        const { f, sk, view } = X, fr = isFrontal(sk), m = GM.nightCloth;
        if (fr) {
          paint(f, disc(Hf(sk, 0, -0.3), 6), m, CLOTH);
          paint(f, poly([Hf(sk, -2, -5.4), Hf(sk, 2, -5.4), Hf(sk, 0.4, -8.4)]), m, CLOTH);
          if (view !== 'front') return;
          paint(f, poly([Hf(sk, -3.4, -2.6), Hf(sk, 3.4, -2.6), Hf(sk, 3, 3.4), Hf(sk, 0, 4.6), Hf(sk, -3, 3.4)]), CM.shadow, { rim: false });
          glowEyes(f, [Hf(sk, -1.3, 0), Hf(sk, 1.3, 0)], GM.violet, GLOW_EYE.void);
          return;
        }
        paint(f, poly([Hd(sk, -5, -1), Hd(sk, -6.6, 5), Hd(sk, -1, 5.6)]), m, CLOTH);
        paint(f, disc(Hd(sk, -0.6, -0.3), 6), m, CLOTH);
        paint(f, poly([Hd(sk, -1, -6), Hd(sk, 5, -5), Hd(sk, 7, -1.6), Hd(sk, 3, -3.8)]), m, CLOTH);
        if (view !== 'front') return;
        paint(f, poly([Hd(sk, 1.4, -2.6), Hd(sk, 5.8, -2), Hd(sk, 5.6, 3), Hd(sk, 2, 4)]), CM.shadow, { rim: false });
        glowEyes(f, [Hd(sk, 3.2, -0.2), Hd(sk, 4.8, -0.2)], GM.violet, GLOW_EYE.void);
      },
      // a red bandana knotted at the back, its tails flying
      bandana(X) {
        const { f, sk, view, tr, fl } = X, fr = isFrontal(sk), s = fl || 0, t = tr || 0;
        face(X);
        if (fr) {
          paint(f, poly([Hf(sk, -5.2, -1.4), Hf(sk, 5.2, -1.4), Hf(sk, 4.6, -4.4), Hf(sk, 0, -5.8), Hf(sk, -4.6, -4.4)]), GM.bandana, CLOTH);
          if (view !== 'front') paint(f, poly([Hf(sk, -0.6, -2), Hf(sk, 0.6, -2), Hf(sk, 1.6 + s * 0.4, 6), Hf(sk, -0.8 + s * 0.4, 6.4)]), GM.bandana, CLOTH);
          return;
        }
        paint(f, poly([Hd(sk, -4, -2.2), Hd(sk, -8.6 - t * 3, -0.6 + s * 0.6), Hd(sk, -7.6 - t * 2, 1.6 + s * 0.6), Hd(sk, -4.4, -0.4)]), GM.bandana, CLOTH);
        paint(f, poly([Hd(sk, -5.2, -1.4), Hd(sk, 5.4, -1.6), Hd(sk, 4.6, -4.4), Hd(sk, 0, -5.8), Hd(sk, -4.6, -4.4)]), GM.bandana, CLOTH);
        paint(f, capsule(Hd(sk, -4.8, -2), Hd(sk, 5, -2.2), 0.4), GM.bandana, { tone: 'd', rim: false });
      },
      // crown of the astral sea: gold circlet with gems and a halo of tiny stars
      astral(X) {
        const { f, sk, view, ph } = X, fr = isFrontal(sk), P = (a, b) => fr ? Hf(sk, a, b) : Hd(sk, a, b);
        face(X);
        paint(f, capsule(P(-4.8, -2.6), P(4.8, -2.6), 0.75), M.gold, { rim: false, spec: true });
        for (const [dx, h] of [[-3.4, 2.4], [0, 3.6], [3.4, 2.4]]) spike(f, P(dx, -3), fr ? sk.hup : Hv(sk, 0, -1), h, 1, M.gold, { spec: true });
        if (view === 'front') paint(f, disc(P(fr ? 0 : 2.4, -2.6), 1.1), M.orb, { spec: true });
        for (let i = 0; i < 3; i++) {
          const a = (ph || 0) * Math.PI * 2 + i * 2.1;
          dot(f, P(Math.cos(a) * 6.4, -6.4 + Math.sin(a) * 1.2), STAR);
        }
      },
      // tall pointed wizard hat with a wide brim and a sprinkle of stars
      wizard(X) {
        const { f, sk, view, fl } = X, fr = isFrontal(sk), s = fl || 0;
        face(X);
        if (fr) {
          paint(f, poly([Hf(sk, -3.8, -3), Hf(sk, 3.8, -3), Hf(sk, 1.6 + s * 0.3, -9), Hf(sk, 4.4 + s * 0.6, -12.4), Hf(sk, -0.6 + s * 0.3, -9.6)]), GM.hatBlue, CLOTH);
          paint(f, capsule(Hf(sk, -7, -2.4), Hf(sk, 7, -2.4), 1), GM.hatBlue, CLOTH);
          paint(f, capsule(Hf(sk, -3.8, -3.6), Hf(sk, 3.8, -3.6), 0.55), M.gold, { rim: false, spec: true });
          dot(f, Hf(sk, -1, -6.4), STAR); dot(f, Hf(sk, 1.4, -8), STAR);
          return;
        }
        paint(f, poly([Hd(sk, -3.6, -3), Hd(sk, 4, -3), Hd(sk, 0.4, -8.6), Hd(sk, -5 + s * 0.4, -11.6), Hd(sk, -2.4, -8.4)]), GM.hatBlue, CLOTH);
        paint(f, capsule(Hd(sk, -7, -2.4), Hd(sk, 7.6, -2.6), 1), GM.hatBlue, CLOTH);
        paint(f, capsule(Hd(sk, -3.6, -3.6), Hd(sk, 4, -3.6), 0.55), M.gold, { rim: false, spec: true });
        dot(f, Hd(sk, 0, -6), STAR); dot(f, Hd(sk, -2.6, -8.6), STAR);
      },
      // crown of winter: a ring of ice spikes over frosted hair
      winter(X) {
        const { f, sk, view } = X, fr = isFrontal(sk);
        face(X);
        const P = (a, b) => fr ? Hf(sk, a, b) : Hd(sk, a, b);
        for (const [dx, lean, len] of [[-3.8, -0.5, 3.4], [-1.4, -0.15, 5.6], [1.2, 0.15, 5.6], [3.6, 0.5, 3.4]]) {
          spike(f, P(dx, -3.4), fr ? norm([sk.hlat[0] * lean + sk.hup[0], sk.hlat[1] * lean + sk.hup[1]]) : Hv(sk, lean, -1), len, 1.2, CM.ice, { spec: true });
        }
        paint(f, capsule(P(-4.8, -2.8), P(4.8, -2.8), 0.7), CM.silver, { rim: false, spec: true });
        if (view === 'front') paint(f, disc(P(fr ? 0 : 2.6, -2.8), 0.9), CM.ice, { tone: 'h', rim: false });
      },
      // bone warden: a horned skull mask with ember-lit sockets, a dark cowl behind
      skull(X) {
        const { f, sk, view } = X, fr = isFrontal(sk);
        if (fr) {
          paint(f, disc(Hf(sk, 0, -0.2), 6), GM.nightCloth, CLOTH);
          for (const k of [-1, 1]) horn(f, [Hf(sk, 3 * k, -3.6), Hf(sk, 5.4 * k, -6.4), Hf(sk, 4.6 * k, -9.6)], 1.3, 0.35, CM.bone);
          if (view !== 'front') return;
          paint(f, poly([Hf(sk, -4, -3.6), Hf(sk, 4, -3.6), Hf(sk, 4.2, 1.4), Hf(sk, 2.4, 4.8), Hf(sk, -2.4, 4.8), Hf(sk, -4.2, 1.4)]), CM.bone, { spec: true });
          for (const k of [-1, 1]) paint(f, disc(Hf(sk, 1.6 * k, 0), 1.2), CM.slit, { rim: false });
          glowEyes(f, [Hf(sk, -1.6, 0), Hf(sk, 1.6, 0)], CM.fire, GLOW_EYE.ember);
          for (const x of [-1.6, -0.5, 0.6, 1.7]) dot(f, Hf(sk, x, 3.6), CM.bone.o);
          return;
        }
        paint(f, disc(Hd(sk, -0.8, -0.2), 6), GM.nightCloth, CLOTH);
        horn(f, [Hd(sk, -1, -3.8), Hd(sk, -4.2, -6.6), Hd(sk, -4, -10)], 1.3, 0.35, CM.bone);
        if (view !== 'front') return;
        paint(f, poly([Hd(sk, 0.4, -3.6), Hd(sk, 5.6, -3), Hd(sk, 6, 1.4), Hd(sk, 4.8, 4.8), Hd(sk, 1.2, 4.6)]), CM.bone, { spec: true });
        paint(f, disc(Hd(sk, 3.8, 0), 1.2), CM.slit, { rim: false });
        glowEyes(f, [Hd(sk, 3.8, 0)], CM.fire, GLOW_EYE.ember);
        for (const x of [2.4, 3.5, 4.6]) dot(f, Hd(sk, x, 3.6), CM.bone.o);
      }
    };
    return STYLES[style];
  }

  // ---- capes: their own equipment slot. Heroes have no cape of their own;
  // an equipped cape item is drawn from its model below, so every cape has its
  // own silhouette (hem cut, length, flare) and its own details, not a recolour.
  // A model: mat (outside), lining (inside, peeks under the hem), len (1 = to
  // the knees, measured from the shoulders), flare (hem spread), hem(u, ph)
  // (extra length along the hem, u 0 = back edge .. 1 = front edge, rig units),
  // decor(D) (details on the cloth), front(D) (clasps etc. over the chest).
  // SP costumes keep their own capes and never draw these.
  const tri = x => { x -= Math.floor(x); return 1 - Math.abs(2 * x - 1); };
  const CPM = {
    wool: mat('#140b06', '#3e2716', '#5e3d22', '#835a35', '#a87b4e'),
    tan: mat('#2a1c0c', '#8a6a3e', '#b08c56', '#d2b07a'),
    wolf: mat('#121418', '#454a52', '#737a85', '#a6adb8', '#dce1e8'),
    warRed: mat('#1a0410', '#5c0b22', '#9b1430', '#d4283c', '#ff6a6a'),
    ash: mat('#0c0506', '#2a0d0b', '#46160f', '#6a2414', '#a4401c'),
    raven: mat('#020205', '#0b0a12', '#17152a', '#2a2645', '#4b4277'),
    royal: mat('#12041f', '#3b0a5c', '#5b1490', '#8231c4', '#b77ae6'),
    membrane: mat('#1a0406', '#4a0c10', '#7a1a18', '#a8321e', '#d85a2a'),
    ruby: mat('#2a0408', '#8a1020', '#d0283c', '#ff7a8a', '#ffffff')
  };
  // run a chain of small capsules along the hem (u0..u1), `extra` rig units below its base line
  function hemBand(D, extra, r, m, o, u0, u1) {
    u0 = u0 === undefined ? 0 : u0; u1 = u1 === undefined ? 1 : u1;
    const n = 16;
    let prev = D.hemAt(u0, extra);
    for (let i = 1; i <= n; i++) {
      const u = lerp(u0, u1, i / n), cur = D.hemAt(u, extra);
      paint(D.f, capsule(prev, cur, r), m, o);
      prev = cur;
    }
  }
  function goldClasps(D, gem) {
    const { f, sk } = D;
    const pts = D.frontal ? [L(sk, sk.shC, -2.6, 0.3), L(sk, sk.shC, 2.6, 0.3)] : [L(sk, sk.shC, 2.2, 0.3)];
    for (const c of pts) {
      paint(f, disc(c, 1.25), M.gold, { spec: true });
      if (gem) dot(f, c, gem.m);
    }
    return pts;
  }
  const CAPES = {
    // plain road wool, frayed hem, a patched back and a rope tie
    travelers_cloak: {
      mat: CPM.wool, lining: CPM.tan, len: 1,
      hem: u => 0.7 * tri(u * 11) - 0.3,
      decor(D) {
        if (!D.outside) return;
        const { f, at } = D;
        paint(f, poly([at(0.52, 0.42), at(0.76, 0.42), at(0.76, 0.6), at(0.52, 0.6)]), CPM.tan, { tone: 'd', rim: false });
        for (const [u, v] of [[0.52, 0.42], [0.76, 0.42], [0.76, 0.6], [0.52, 0.6], [0.64, 0.42], [0.64, 0.6]]) dot(f, at(u, v), CPM.wool.o);
      },
      front(D) {
        const c = D.frontal ? L(D.sk, D.sk.shC, 0, 0.2) : L(D.sk, D.sk.shC, 2, 0.3);
        paint(D.f, disc(c, 1.1), CPM.tan, { spec: true });
        paint(D.f, capsule(c, add(c, D.sk.up, -2.6), 0.35), CPM.tan, { tone: 'd', rim: false });
      }
    },
    // short shoulder mantle of wolf fur, shaggy tufted hem, tusk pin
    wolfpelt_mantle: {
      mat: CPM.wolf, lining: M.leather, len: 0.46, flare: 1.15, noFolds: true,
      hem: u => 2.6 * Math.pow(tri(u * 8), 0.7) + 0.8 * tri(u * 13) - 0.6,
      decor(D) {
        const { f, at } = D;
        for (let i = 0; i < 9; i++) {
          const u = (i + 0.5) / 9;
          paint(f, capsule(at(u, 0.3), at(u + 0.03, 0.92), 0.25), CPM.wolf, { tone: i % 2 ? 'd' : 'l', rim: false });
        }
        // thick ruff of pale fur over the shoulders
        paint(f, capsule(at(-0.02, 0.02), at(1.02, 0.02), 1.9), CM.furWhite, { dither: true, selout: true });
        for (let i = 0; i < 6; i++) dot(f, at((i + 0.5) / 6, 0.06), CM.furWhite.d);
      },
      front(D) {
        if (D.view !== 'front') return;
        const c = D.frontal ? L(D.sk, D.sk.shC, 0, 0.6) : L(D.sk, D.sk.shC, 2.2, 0.6);
        spike(D.f, c, norm(add(D.sk.up, D.sk.side, 0.5)), 3.2, 0.9, CM.bone, { spec: true });
      }
    },
    // long crimson battle cape, swallowtail cut, gold-edged, sword sigil
    crimson_warcape: {
      mat: CPM.warRed, lining: M.navy, len: 1.18,
      hem: u => -1 + 5.5 * Math.pow(tri(u * 2), 1.5) - 5 * Math.max(0, 1 - Math.abs(u - 0.5) / 0.16),
      decor(D) {
        const { f, at } = D;
        hemBand(D, -0.7, 0.42, M.gold, { rim: false, spec: true });
        if (!D.outside || !D.back) return;
        paint(f, capsule(at(0.5, 0.16), at(0.5, 0.56), 0.55), M.gold, { spec: true });
        paint(f, capsule(at(0.4, 0.26), at(0.6, 0.26), 0.5), M.gold, { spec: true });
        paint(f, disc(at(0.5, 0.13), 0.8), M.gold, { spec: true });
      },
      front: D => goldClasps(D, CPM.ruby)
    },
    // forest-green shroud whose hem is cut into leaves; a rolled hood at the collar
    ranger_leafshroud: {
      mat: GM.forest, lining: GM.olive, len: 1.02,
      hem: u => 3.6 * Math.pow(tri(u * 6), 0.55) - 0.8,
      decor(D) {
        const { f, at } = D;
        for (let k = 0; k < 6; k++) {
          const u = (k + 0.5) / 6;
          paint(f, capsule(D.hemAt(u, -2.4), D.hemAt(u, 1.8), 0.28), GM.forest, { tone: 'd', rim: false });
        }
        if (D.outside) {
          for (const [u, v] of [[0.25, 0.32], [0.62, 0.26], [0.42, 0.52], [0.76, 0.56], [0.2, 0.7], [0.55, 0.74]]) {
            const a = at(u, v), b = at(u + 0.04, v + 0.12);
            spike(f, a, norm([b[0] - a[0], b[1] - a[1]]), 2.4, 0.9, GM.forest, { tone: 'l', rim: false });
          }
        }
        if (D.back) paint(f, disc(at(0.5, 0.05), 3, 2.2), GM.forest, { dither: true, selout: true });
      },
      front(D) {
        if (D.view !== 'front') return;
        const c = D.frontal ? L(D.sk, D.sk.shC, 0, 0.3) : L(D.sk, D.sk.shC, 2.2, 0.3);
        spike(D.f, add(c, D.sk.side, -0.8), D.sk.side, 2.2, 0.9, GM.earth, { spec: true });
      }
    },
    // frost cloth with an icicle hem, rime and a white fur collar
    frostweave_mantle: {
      mat: GM.frostCloth, lining: GM.iceSteel, len: 1.05,
      hem: u => {
        const L7 = [2.5, 6.2, 3, 7.6, 2.8, 5.6, 3.4], i = Math.min(6, Math.floor(u * 7));
        return L7[i] * Math.pow(tri(u * 7), 2.2) - 0.4;
      },
      decor(D) {
        const { f, at, ph } = D;
        hemBand(D, -1.3, 0.55, CM.ice, { tone: 'l', rim: false, alpha: 190 });
        for (let i = 0; i < 7; i++) dot(f, D.hemAt((i + 0.5) / 7, -0.4), CM.ice.h);
        if (D.outside) {
          [[0.3, 0.3], [0.68, 0.22], [0.5, 0.55], [0.22, 0.62], [0.78, 0.66]].forEach(([u, v], i) => {
            const p = at(u, v), tw = Math.sin((ph + i * 0.29) * Math.PI * 2);
            if (tw < -0.2) return;
            dot(f, p, CM.ice.h);
            if (tw > 0.6) for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(f, [p[0] + d[0], p[1] + d[1]], CM.ice.l);
          });
        }
        paint(f, capsule(at(-0.02, 0.02), at(1.02, 0.02), 1.6), CM.furWhite, { dither: true, selout: true });
      },
      front: D => goldClasps(D, CM.ice)
    },
    // ash-dark cape whose hem is burning away: glowing edge, flame tongues, rising embers
    emberwing_cape: {
      mat: CPM.ash, lining: CM.fire, len: 1.05,
      hem: u => 1.3 * tri(u * 7) - 0.7 * tri(u * 13),
      decor(D) {
        const { f, at, ph } = D;
        if (D.outside) {
          // smouldering cracks
          for (const pts of [[[0.3, 0.45], [0.36, 0.6], [0.3, 0.74], [0.37, 0.88]], [[0.68, 0.55], [0.62, 0.7], [0.7, 0.9]]]) {
            for (let i = 0; i < pts.length - 1; i++) paint(f, capsule(at(...pts[i]), at(...pts[i + 1]), 0.3), CM.fire, { tone: 'm', rim: false });
          }
        }
        hemBand(D, -0.9, 0.9, CM.fire, { tone: 'm', rim: false, alpha: 170 });
        for (let i = 0; i < 5; i++) {
          const u = (i + 0.5) / 5, b = D.hemAt(u, 0.6);
          flame(f, b, 3.4 + 1.8 * Math.sin((ph * 2 + i * 0.27) * Math.PI * 2), 1.2, Math.sin((ph + i * 0.4) * Math.PI * 2) * 0.8);
        }
        for (let i = 0; i < 4; i++) {
          const q = (ph * 1.5 + i * 0.25) % 1, b = D.hemAt((i + 0.3) / 4, 0);
          dot(f, [b[0] + Math.sin((q + i) * 6) * 1.5, b[1] - 3 - q * 9], q < 0.6 ? CM.fire.h : CM.fire.l);
        }
      }
    },
    // layer upon layer of black feathers, a feathered hem and a ruff at the neck
    ravenfeather_cloak: {
      mat: CPM.raven, lining: GM.violet, len: 1.1, flare: 1.1, noFolds: true,
      hem: u => { const i = Math.floor(u * 9); return (i % 2 ? 4.6 : 3) * Math.pow(tri(u * 9), 1.6) - 0.6; },
      decor(D) {
        const { f, at, sk } = D;
        if (D.outside) {
          [0.22, 0.4, 0.58, 0.76].forEach((v, row) => {
            for (let k = 0; k < 6; k++) {
              const u = (k + (row % 2) * 0.5 + 0.25) / 6;
              if (u > 0.98) continue;
              const a = at(u, v - 0.05), b = at(u, v + 0.1);
              spike(f, a, norm([b[0] - a[0], b[1] - a[1]]), Math.hypot(b[0] - a[0], b[1] - a[1]), 1.1, CPM.raven, { tone: 'd', rim: false });
              dot(f, at(u - 0.03, v), GM.violet.d);
            }
          });
        }
        for (let k = 0; k < 7; k++) {
          const u = k / 6;
          spike(f, at(u, 0.03), norm(add(sk.up, sk.side, (u - 0.5) * 1.4)), 2.8, 0.9, CPM.raven, { selout: true });
        }
      },
      front: D => goldClasps(D, GM.violet)
    },
    // imperial purple, rounded train trimmed in spotted ermine, gold chain and crown
    royal_ermine_mantle: {
      mat: CPM.royal, lining: M.gold, len: 1.22, flare: 1.2,
      hem: u => 1.4 * Math.sin(Math.PI * u),
      decor(D) {
        const { f, at } = D;
        hemBand(D, -1.1, 1.35, CM.furWhite, { dither: true, selout: true });
        for (let i = 0; i < 8; i++) dot(f, D.hemAt((i + 0.5) / 8, -1.1 + (i % 2) * 0.6), CM.shadow.m);
        if (D.inside) {
          // the ermine runs up both front edges
          for (const u of [0.02, 0.98]) paint(f, capsule(at(u, 0.05), at(u, 0.95), 1.2), CM.furWhite, { dither: true, selout: true });
        }
        paint(f, capsule(at(-0.02, 0.02), at(1.02, 0.02), 1.5), CM.furWhite, { dither: true, selout: true });
        for (let i = 0; i < 5; i++) dot(f, at((i + 0.5) / 5, 0.03), CM.shadow.m);
        if (D.outside && D.back) {
          const b = at(0.5, 0.36);
          paint(f, poly([add(b, D.sk.side, -2.6), add(b, D.sk.side, 2.6), add(add(b, D.sk.side, 2.8), D.sk.up, 3.2), add(add(b, D.sk.side, 1.2), D.sk.up, 1.6),
            add(b, D.sk.up, 3.6), add(add(b, D.sk.side, -1.2), D.sk.up, 1.6), add(add(b, D.sk.side, -2.8), D.sk.up, 3.2)]), M.gold, { spec: true });
          dot(f, add(b, D.sk.up, 1), CPM.ruby.m);
        }
      },
      front(D) {
        const pts = goldClasps(D, CPM.ruby);
        if (pts.length === 2 && D.view === 'front') {
          const mid = add(L(D.sk, D.sk.shC, 0, 0.3), D.sk.up, -1.6);
          paint(D.f, capsule(pts[0], mid, 0.35), M.gold, { rim: false, spec: true });
          paint(D.f, capsule(mid, pts[1], 0.35), M.gold, { rim: false, spec: true });
        }
      }
    },
    // a piece of the night sky: starlit void, a glowing hem that dissolves into drifting shards
    starfall_cloak: {
      mat: CM.void, lining: CM.voidGlow, len: 1.12,
      hem: u => 2.4 * Math.pow(tri(u * 6), 1.2) - 0.8,
      decor(D) {
        const { f, at, ph } = D;
        if (D.outside) starryCloth(f, [at(0, 0.04), at(1, 0.04), at(1, 0.96), at(0, 0.96)], ph);
        hemBand(D, -0.6, 0.5, CM.voidGlow, { tone: 'm', rim: false, alpha: 150 });
        for (let i = 0; i < 5; i++) {
          const q = (ph + i * 0.37) % 1, c = D.hemAt((i + 0.5) / 5, 2 + q * 5);
          paint(f, poly([add(c, D.sk.up, 1.1), add(c, D.sk.side, 0.8), add(c, D.sk.up, -1.1), add(c, D.sk.side, -0.8)]), CM.voidGlow, { tone: q < 0.5 ? 'l' : 'm', rim: false, alpha: Math.round(230 * (1 - q)) });
        }
      },
      front: D => goldClasps(D, CM.voidGlow)
    },
    // a war banner: stiff gold crossbar, zigzag hem, lightning sigil, crackling sparks
    stormbanner_cape: {
      mat: GM.hatBlue, lining: M.navy, len: 1.1, noFolds: true,
      hem: u => 3.2 * tri(u * 5) - 0.6,
      decor(D) {
        const { f, at, ph } = D;
        hemBand(D, -1.7, 0.32, M.gold, { rim: false, spec: true });
        if (D.outside && D.back) {
          const z = [[0.55, 0.14], [0.4, 0.4], [0.56, 0.42], [0.42, 0.7]];
          for (let i = 0; i < z.length - 1; i++) paint(f, capsule(at(...z[i]), at(...z[i + 1]), 0.75), CM.bolt, { spec: true });
        }
        if (!D.inside) {
          paint(f, capsule(at(-0.08, 0), at(1.08, 0), 0.8), M.gold, { spec: true });
          for (const u of [-0.08, 1.08]) paint(f, disc(at(u, 0), 1.1), M.gold, { spec: true });
        }
        if (Math.sin(ph * Math.PI * 6) > 0.55) {
          const k = Math.floor(ph * 5) % 5, a = D.hemAt(k / 5, 0), b = D.hemAt((k + 0.5) / 5, 2.6), c = D.hemAt((k + 1) / 5, 0);
          paint(f, capsule(a, b, 0.3), CM.bolt, { tone: 'h', rim: false });
          paint(f, capsule(b, c, 0.3), CM.bolt, { tone: 'h', rim: false });
        }
      },
      front: D => goldClasps(D, CM.bolt)
    },
    // a folded drake wing: bone fingers fanning to claw tips, scalloped membrane between
    dragonwing_cape: {
      mat: CPM.membrane, lining: GM.darkRed, len: 1.16, flare: 1.25, noFolds: true,
      hem: u => 2.6 - 4.6 * Math.sin(Math.PI * ((u * 3) % 1)),
      decor(D) {
        const { f, at, sk } = D;
        const root = at(0.62, 0.02);
        for (let k = 0; k <= 3; k++) {
          const u = k / 3, tip = D.hemAt(u, 2.6), mid = at(lerp(0.62, u, 0.6), 0.45);
          // a vein of light through each membrane panel
          if (D.outside && k < 3) paint(f, capsule(at((k + 0.5) / 3, 0.3), D.hemAt((k + 0.5) / 3, -2.6), 0.3), CPM.membrane, { tone: 'l', rim: false, alpha: 140 });
          if (!D.outside && k > 0 && k < 3) continue;
          // thin bone finger (dark under-edge, pale ridge) ending in a claw
          paint(f, capsule(root, mid, 0.6, 0.5), CM.bone, { tone: 'd', rim: false });
          paint(f, capsule(mid, tip, 0.5, 0.35), CM.bone, { tone: 'd', rim: false });
          paint(f, capsule(root, mid, 0.3), CM.bone, { tone: 'h', rim: false });
          paint(f, capsule(mid, tip, 0.25), CM.bone, { tone: 'l', rim: false });
          spike(f, tip, norm([tip[0] - mid[0], tip[1] - mid[1]]), 1.6, 0.5, CM.bone, { spec: true });
        }
        paint(f, disc(root, 1), CM.bone, { spec: true });
        for (const u of [0, 1]) spike(f, at(u, 0), norm(add(sk.up, sk.side, u ? 0.6 : -0.6)), 3, 1, CM.bone, { spec: true });
      },
      front: D => goldClasps(D, CM.fire)
    }
  };

  // Build the cape's frame for this pose: top edge (shoulders) and hem curve
  // (sw: the class's shoulder half-width)
  function capeFrame(sk, p, ph, model, sw) {
    const tr = p.cape || 0;
    const fl = Math.sin(ph * Math.PI * 2) * (0.7 + tr * 1.5);
    const fl2 = Math.sin(ph * Math.PI * 2 + 1.9) * (0.7 + tr * 1.7);
    const frontal = isFrontal(sk) && !sk.rotated;
    // full-length hem points [shoulder back, shoulder front, hem front, hem middle, hem back]
    const P = frontal ? [
      L(sk, sk.shC, -sw, 1), L(sk, sk.shC, sw, 1),
      L(sk, sk.hip, 6.0 + fl * 0.35, -13.5 + tr * 5.5),
      L(sk, sk.hip, 0.4 + fl * 0.7, -15 + tr * 5.5 + fl * 0.6),
      L(sk, sk.hip, -6.0 + fl2 * 0.35, -13.5 + tr * 5.5)
    ] : [
      L(sk, sk.shC, -sw, 1.3), L(sk, sk.shC, 2.6, 1.3),
      add(L(sk, sk.hip, 2.6, -13.5), [-tr * 8, -tr * 6], 1),
      [sk.hip[0] - 4 - tr * 11, sk.hip[1] + (14.5 - tr * 7 + fl) * BODY_K],
      [sk.hip[0] - 8.1 - tr * 14, sk.hip[1] + (12.0 - tr * 8 + fl2) * BODY_K]
    ];
    const len = model.len || 1, flare = model.flare || 1;
    const pl = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
    const topMid = pl(P[0], P[1], 0.5);
    let hb = pl(P[0], P[4], len), hm = pl(topMid, P[3], len), hf = pl(P[1], P[2], len);
    hb = pl(hm, hb, flare); hf = pl(hm, hf, flare);
    const ctl = [2 * hm[0] - (hb[0] + hf[0]) / 2, 2 * hm[1] - (hb[1] + hf[1]) / 2];
    const top = u => pl(P[0], P[1], u);
    const hemBase = u => {
      const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
      return [a * hb[0] + b * ctl[0] + c * hf[0], a * hb[1] + b * ctl[1] + c * hf[1]];
    };
    const at = (u, v) => pl(top(u), hemBase(u), v);
    const hemAt = (u, extra) => {
      const t = top(u), h = hemBase(u), d = norm([h[0] - t[0], h[1] - t[1]]);
      return add(h, d, (model.hem ? model.hem(u, ph) : 0) + (extra || 0));
    };
    return { frontal, top, at, hemAt, tr, fl };
  }

  // Draw an equipped cape (model) behind / over the hero
  function drawGearCape(f, sk, p, view, ph, model, sw) {
    const cf = capeFrame(sk, p, ph, model, sw || 4.6);
    const inside = cf.frontal && view === 'front';   // facing the camera: the lining shows
    const D = Object.assign({ f, sk, view, ph, inside, outside: !inside, back: view === 'back' }, cf);
    const N = 30;
    const shape = drop => {
      const pts = [cf.top(0), cf.top(1)];
      for (let i = N; i >= 0; i--) pts.push(cf.hemAt(i / N, drop));
      return poly(pts);
    };
    const CLOTH = { dither: true, selout: true };
    if (inside) {
      paint(f, shape(0), model.lining, CLOTH);
      for (const u of [0, 1]) paint(f, capsule(cf.at(u, 0.04), cf.at(u, 0.97), 0.7), model.mat, { rim: false });
    } else {
      paint(f, shape(1.4), model.lining, { dither: true });
      paint(f, shape(0), model.mat, CLOTH);
      if (!model.noFolds) {
        for (const u of [0.3, 0.7]) paint(f, capsule(cf.at(u, 0.2), cf.at(u, 0.92), 0.3, 0.6), model.mat, { tone: 'd', rim: false });
      }
    }
    if (model.decor) model.decor(D);
  }
  // Clasps / chains over the chest, drawn after the body
  function drawGearCapeFront(f, sk, p, view, ph, model, sw) {
    if (!model.front || view !== 'front' && !model.frontAlways) return;
    const cf = capeFrame(sk, p, ph, model, sw || 4.6);
    model.front(Object.assign({ f, sk, view, ph, inside: cf.frontal, outside: !cf.frontal, back: false }, cf));
  }

  // ---- per-class gear costumes
  function gearCostume(cls, eq) {
    const id = s => (eq[s] && eq[s].id) || '';
    const tones = ARMOR_TONES[id('armor')];
    const elem = eq.weapon && eq.weapon.element;
    const glowOf = () => ELEM_GLOW[elem] || null;
    const style = HELM_STYLE[id('helmet')];
    const C = { gear: true, palette: {} };
    if (style) C.head = gearHead(style, cls);
    const glove = GLOVE_MAT[id('gloves')], boot = BOOT_MAT[id('boots')];
    if (boot) C.gearBoot = boot;
    if (CAPES[id('cape')]) C.gearCape = CAPES[id('cape')];
    const MET = { metal: true, selout: true };

    if (cls === 'warrior') {
      if (tones) Object.assign(C.palette, { gunmetal: tones.main, cape: tones.cloth, ember: tones.glow, gold: tones.accent });
      const w = id('weapon');
      if (w) C.weapon = WARRIOR_WEAPONS[w] ? WARRIOR_WEAPONS[w]() : runeSword(20, 1.6, glowOf());
      if (glove) {
        C.armMatsF = () => ({ upper: M.gunmetal, fore: M.gunmetal, hand: glove, cop: M.steel, cuff: M.gold, fx: MET });
        C.armMatsB = () => ({ upper: M.darkSteel, fore: M.darkSteel, hand: glove, cop: M.darkSteel, cuff: M.darkSteel, fx: MET });
      }
    } else if (cls === 'mage') {
      if (tones) Object.assign(C.palette, { robe: tones.cloth, mageArmor: tones.main, robeTrim: tones.accent, orb: tones.glow });
      const w = id('weapon');
      if (w) {
        if (MAGE_STAVES[w]) C.staff = MAGE_STAVES[w];
        else if (elem === 'lightning') C.staff = stormFork;
        if (glowOf()) C.palette.orb = glowOf();
      }
      if (glove) C.hand = glove;
    } else if (cls === 'rogue') {
      // the plain rogue's hooded look, recoloured by the armor and lit by the weapon's element
      const lk = Object.assign({}, ROGUE_LOOK, tones ? { cloak: tones.cloth, lining: tones.accent, venom: tones.glow } : {}, glowOf() ? { venom: glowOf() } : {});
      const base = hoodedRogue(() => lk);
      Object.assign(C, base, style ? { head: C.head } : {});
      C.gearRL = Object.assign({}, RL, tones ? { rogue: tones.main } : {});
      const w = id('weapon');
      if (ROGUE_SWORDS[w]) {
        const pair = ROGUE_SWORDS[w];
        C.dagger = (f, hand, d, which) => (pair[which] ? pair[which](f, hand, d) : undefined);
      } else if (w === 'venom_kris') C.dagger = kris;
      else if (w === 'ember_scythe') C.dagger = (f, hand, d, which) => which === 'F' ? scythe(f, hand, d) : undefined;
      if (w === 'venom_kris' || w === 'ember_scythe') C.palette.venom = glowOf() || RL.venom;
      if (glove) C.gearHand = glove;
    }
    return C;
  }

  const GEAR = new Map();   // gear key -> costume
  const GEAR_SLOTS = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'cape'];
  // Key of the look a hero's equipment gives them (null: nothing that changes the look)
  function gearKey(cls, eq) {
    if (!eq || !CLASS_ANIMS[cls]) return null;
    const ids = GEAR_SLOTS.map(s => (eq[s] && eq[s].id) || '');
    if (!ids.some(Boolean)) return null;
    const key = 'g|' + cls + '|' + ids.join(',') + '|' + ((eq.weapon && eq.weapon.element) || '');
    if (!GEAR.has(key)) GEAR.set(key, gearCostume(cls, eq));
    return key;
  }

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
      smear: () => CM.crimson,
      smearR: [5, 16.5],
      weapon: bloodBlade,
      weaponB: bloodBlade,
      // dual wield: the off hand lets go of the grip and carries its own blade,
      // trailing low behind when the arm is free (run, dash)
      pose(p) {
        if (p.drop) return p;
        if (!p.twoHand && p.handB) return p.wpnB !== undefined ? p : Object.assign({}, p, { wpnB: -0.7 });
        return Object.assign({}, p, { twoHand: false, handB: [p.handF[0] - 5, p.handF[1] + 3], wpnB: p.wpn - 0.9 });
      },
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
    // God of Thunder: a white cropped robe over a bare midriff, white storm hair and
    // lightning-yellow eyes. No staff: each hand holds a small ball of thunder.
    sp_tempest: {
      // the whole outfit is white and pale gold (robe = coat and trousers, mageArmor = boots and bracers)
      palette: {
        robe: ['#4a5166', '#b4bccd', '#eef2f7', '#ffffff'],
        mageArmor: ['#5a5440', '#c9c2a2', '#f1ecd4', '#fffdf0']
      },
      smear: () => CM.bolt,
      hand: M.skin, // bare hands, no gloves
      staff: thunderBall,
      // the off hand's ball (the main hand's is the "staff" and also sets the cast origin)
      front({ f, sk, ph, p }) {
        if (p.drop) return;
        thunderBall(f, [sk.handB[0], sk.handB[1] - 1], [0, -1], p.glow || 0, ph + 0.37);
      },
      // crop top: the robe stops under the chest, the belly is bare
      torso({ f, sk, view }) {
        paint(f, poly([L(sk, sk.shC, -4.4, -4.6), L(sk, sk.shC, 4.8, -4.6), L(sk, sk.hip, 4.6, 2.2), L(sk, sk.hip, -4.4, 2.2)]), M.skin, { rim: false });
        paint(f, capsule(L(sk, sk.hip, 0.3, 3.2), L(sk, sk.hip, 0.3, 6.6), 0.28), M.skin, { tone: 'd', rim: false });
        if (view === 'front') {
          paint(f, capsule(L(sk, sk.hip, -2, 4.4), L(sk, sk.hip, 2.6, 4.4), 0.25), M.skin, { tone: 'd', rim: false });
          dot(f, L(sk, sk.hip, 0.3, 2.6), M.skin.d);
        }
        paint(f, capsule(L(sk, sk.shC, -4.4, -4.6), L(sk, sk.shC, 4.8, -4.6), 0.55), M.robeTrim, { rim: false, spec: true });
        paint(f, capsule(L(sk, sk.hip, -4.4, 1.5), L(sk, sk.hip, 4.8, 1.5), 0.9), M.robeTrim, { rim: false });
        paint(f, disc(L(sk, sk.hip, view === 'front' ? 0.4 : 2.6, 1.5), 1), M.orb, { tone: 'l', rim: false });
      },
      // storm-charged spiky hair and a horned circlet
      head({ f, sk, view }) {
        for (const [bx, by, tx, ty] of [[-4.4, -0.8, -9, -4], [-3, -3, -6, -9], [-0.6, -4, -1.2, -10.6], [2, -3.6, 3.8, -9.2], [4, -2.2, 7, -6]]) {
          paint(f, poly([Hd(sk, bx - 1.8, by + 0.6), Hd(sk, tx, ty), Hd(sk, bx + 1.8, by + 0.4)]), CM.stormHair);
        }
        paint(f, disc(Hd(sk, -0.4, 0), 4.8), CM.stormHair);
        if (view === 'front') {
          paint(f, disc(Hd(sk, 1.2, 0.6), 3.8), M.skin);
          paint(f, capsule(Hd(sk, 3.8, 3.4), Hd(sk, 4.4, 5.6), 0.8), CM.stormHair, { rim: false });
          // eyes burning thunder-yellow: a lit streak running out of each
          paint(f, capsule(Hd(sk, 2.2, 0), Hd(sk, 5.4, -0.2), 0.7), CM.bolt, { tone: 'l', rim: false, alpha: 130 });
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
    // masked shadow in a starlit cloak, smoke curling off the shoulders, violet blades
    sp_nightblade: hoodedRogue(() => ({
      hood: M.hood, cloak: M.scarf, cowl: M.hood, lining: RL.lining, strap: M.strap,
      venom: M.venom, blade: M.venom, steel: RL.steel, skin: RL.shadeSkin, hair: RL.hair,
      mask: CM.shadow, stars: true, wisps: RL.lining
    })),
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
    // Frost Shade: a ghost of the glacier. A frost-rimmed hood crowned with ice crystals over a
    // hollow dark face behind a cracked ice half-mask with two piercing eyes, a frozen heart
    // glowing through the chest, ice spurs on the shoulders and knees, frost-crusted shins and a
    // long tattered scarf. Snow hangs in the air around it, and its hands end in long glowing
    // ice claws.
    sp_frost_shade: {
      palette: {
        strap: ['#0b1d2a', '#5b7f99', '#9cc3db', '#d9f1ff', '#ffffff'],
        hood: ['#050c14', '#13283a', '#22415a', '#3b6687', '#8fd0ee'],
        rogue: ['#060f18', '#173149', '#28506e', '#4a7ea3', '#9ad8f2']
      },
      smear: () => CM.ice,
      dagger: frostClaws,
      // snow drifting slowly down around the shade
      behind({ f, sk, ph, p }) {
        if (p.drop) return;
        for (let i = 0; i < 5; i++) {
          const t = (ph + i / 5) % 1;
          const x = sk.hip[0] + [-9, -4, 3, 8, -12][i] + Math.sin((ph + i) * Math.PI * 2) * 1.2;
          const y = sk.neck[1] - 8 + t * 26;
          const alpha = Math.round(200 * Math.sin(t * Math.PI));
          if (alpha > 20) paint(f, disc([x, y], 0.6), CM.ice, { tone: 'h', rim: false, alpha });
        }
      },
      // real legs in glacier-blue cloth, with frost-crusted shin cuffs and an ice spur at each knee
      front({ f, sk, p }) {
        if (p.drop) return;
        for (const [knee, ankle, sc] of [[sk.kneeB, sk.ankleB, 0.8], [sk.kneeF, sk.ankleF, 1]]) {
          const shin = norm([ankle[0] - knee[0], ankle[1] - knee[1]]);
          paint(f, capsule(add(ankle, shin, -2.6), add(ankle, shin, -0.6), 1.5 * sc), CM.ice, { tone: 'l', rim: false, alpha: 190 });
          spike(f, knee, norm(add(sk.side, sk.up, 0.5)), 2.6 * sc, 0.75, CM.ice, { spec: true });
        }
      },
      // long tattered scarf with a faint frost sheen
      scarf({ f, scarfShape }) {
        paint(f, scarfShape, CM.ghost, { alpha: 170, dither: true });
        paint(f, scarfShape, CM.ice, { tone: 'h', rim: false, alpha: 40 });
      },
      // ice spurs on both shoulders, frost on the collar and a frozen heart glowing through the chest
      torso({ f, sk, view, ph }) {
        const frontal = isFrontal(sk);
        paint(f, capsule(L(sk, sk.shC, -3.8, 0.6), L(sk, sk.shC, 4.2, 0.6), 1), CM.ice, { tone: 'l', rim: false, alpha: 170 });
        for (const [pt, sc] of [[sk.shB, 0.8], [sk.shF, 1]]) {
          spike(f, add(pt, sk.up, 1.2), norm(add(sk.up, sk.side, -0.9)), 3.4 * sc, 0.85, CM.ice, { spec: true });
          spike(f, add(add(pt, sk.up, 1.2), sk.side, 1.2), norm(add(sk.up, sk.side, -0.3)), 2.6 * sc, 0.75, CM.ice, { spec: true });
        }
        if (view === 'front') {
          const c = L(sk, sk.shC, frontal ? 0.2 : 1.6, -3.4);
          const k = 0.5 + 0.5 * Math.sin(ph * Math.PI * 4);
          paint(f, disc(c, 2.6 + k * 0.6), CM.ice, { tone: 'l', rim: false, alpha: Math.round(60 + 60 * k) });
          paint(f, poly([add(c, sk.up, 2.2), add(c, sk.side, 1.6), add(c, sk.up, -2.4), add(c, sk.side, -1.6)]), CM.ice, { spec: true });
          dot(f, c, CM.ice.h);
        }
      },
      // frost-rimmed hood crowned with ice crystals; inside, darkness behind a cracked ice
      // half-mask and two piercing eyes
      head({ f, sk, view, tr, fl }) {
        if (isFrontal(sk)) {
          for (const [dx, hh] of [[-3, 3.6], [0, 5.2], [3, 3.6]]) spike(f, Hf(sk, dx, -5), norm([dx * 0.12, -1]), hh, 1, CM.ice, { spec: true });
          paint(f, disc(Hf(sk, 0, -0.3), 5.8), M.hood, { dither: true, selout: true });
          paint(f, poly([Hf(sk, -1.8, -5.4), Hf(sk, 1.8, -5.4), Hf(sk, 0.4, -7.6)]), M.hood, { dither: true });
          if (view === 'front') {
            paint(f, poly([Hf(sk, -3.4, -2.8), Hf(sk, 3.4, -2.8), Hf(sk, 3.6, 4), Hf(sk, -3.6, 4)]), CM.shadow, { rim: false });
            paint(f, poly([Hf(sk, -2.6, 1), Hf(sk, 2.6, 1), Hf(sk, 2, 3.4), Hf(sk, -2, 3.4)]), CM.ghost, { rim: false, alpha: 190 });
            paint(f, capsule(Hf(sk, -0.4, 1.2), Hf(sk, 0.4, 3.2), 0.25), CM.ice, { tone: 'd', rim: false });
            for (const ex of [-1.5, 1.5]) {
              paint(f, disc(Hf(sk, ex, -0.8), 1), CM.ice, { tone: 'l', rim: false, alpha: 120 });
              dot(f, Hf(sk, ex, -0.8), GLOW_EYE.ice);
            }
          }
          return;
        }
        // hood tail streaming back
        paint(f, poly([Hd(sk, -4.6, -2.6), Hd(sk, -9.4 - tr * 3, 1 + fl * 0.4), Hd(sk, -4.4, 3.4)]), M.hood, { dither: true });
        for (const [dx, lean, len] of [[-4, -0.9, 3.4], [-1.6, -0.5, 5.4], [0.8, -0.15, 3.8]]) {
          spike(f, Hd(sk, dx, -4.4), Hv(sk, lean, -1), len, 1.05, CM.ice, { spec: true });
        }
        paint(f, disc(Hd(sk, -0.6, -0.3), 5.7), M.hood, { dither: true, selout: true });
        paint(f, poly([Hd(sk, -1, -5.7), Hd(sk, 4.6, -4.6), Hd(sk, 6.6, -1.8), Hd(sk, 3, -3.8)]), M.hood, { dither: true });
        if (view === 'front') {
          paint(f, poly([Hd(sk, 1.2, -2.4), Hd(sk, 5.8, -2.2), Hd(sk, 5.4, 3.8), Hd(sk, 1.4, 4)]), CM.shadow, { rim: false });
          // cracked ice half-mask over the lower face
          paint(f, poly([Hd(sk, 2, 1), Hd(sk, 5.8, 0.8), Hd(sk, 5.2, 3.2), Hd(sk, 3.2, 3.8), Hd(sk, 2, 2.8)]), CM.ghost, { rim: false, alpha: 190 });
          paint(f, capsule(Hd(sk, 3.4, 1.2), Hd(sk, 3.9, 3.2), 0.25), CM.ice, { tone: 'd', rim: false });
          for (const ex of [3, 4.8]) {
            paint(f, disc(Hd(sk, ex, -0.8), 1), CM.ice, { tone: 'l', rim: false, alpha: 120 });
            dot(f, Hd(sk, ex, -0.8), GLOW_EYE.ice);
          }
          paint(f, capsule(Hd(sk, 4.8, -0.8), Hd(sk, 7.2, -1.4), 0.35), CM.ice, { tone: 'l', rim: false, alpha: 110 });
          // frost lining the hood's opening
          paint(f, capsule(Hd(sk, 1.2, -2.8), Hd(sk, 1, 4.2), 0.4), CM.ice, { tone: 'l', rim: false, alpha: 150 });
        }
      }
    },
    sp_eclipse_reaper: {
      // one great scythe; the off hand stays empty
      dagger: (f, hand, d, which) => (which === 'F' ? eclipseScythe(f, hand, d) : undefined),
      noSmearB: true,
      smearR: [12, 22],
      // long tattered cloak of starry void, in place of the scarf
      scarf({ f, sk, tr, fl, ph, p }) {
        const frontal = isFrontal(sk);
        const hemY = Math.max(sk.ankleF[1], sk.ankleB[1]) - (p.drop ? 4 : 1.5);
        let q;
        if (sk.rotated) {
          q = [L(sk, sk.shC, -4.6, 1.4), L(sk, sk.shC, 4, 1.4), L(sk, sk.hip, 4.4, -8), L(sk, sk.hip, -6, -9)];
        } else if (frontal) {
          q = [L(sk, sk.shC, -5.4, 1.2), L(sk, sk.shC, 5.4, 1.2),
            [sk.hip[0] + 7.5 + fl * 0.4, hemY - tr * 3], [sk.hip[0] - 7.5 + fl * 0.6, hemY - tr * 3]];
        } else {
          q = [L(sk, sk.shC, -4.6, 1.6), L(sk, sk.shC, 3.4, 1.6),
            [sk.hip[0] + 3, hemY - 1 - tr * 2],
            [sk.hip[0] - 7 - tr * 13, hemY - 2 - tr * 7 + fl]];
        }
        const pts = [q[0], q[1], q[2], ...ragged(q[2], q[3], 7, 2.2), q[3]];
        if (!frontal && !sk.rotated) pts.push([sk.hip[0] - 6 - tr * 6, sk.hip[1] - 2 - tr * 2 + fl * 0.5]);
        paint(f, poly(pts), M.scarf, { dither: true, selout: true });
        // a dark fold down the middle of the cloth
        paint(f, capsule([lerp(q[0][0], q[1][0], 0.4), lerp(q[0][1], q[1][1], 0.4) + 3], [lerp(q[3][0], q[2][0], 0.45), lerp(q[3][1], q[2][1], 0.45) - 2], 0.3, 0.7), M.scarf, { tone: 'd', rim: false });
        starryCloth(f, q, ph);
      },
      // spiked iron collar and an eclipse amulet on the chest
      torso({ f, sk, view }) {
        const frontal = isFrontal(sk);
        paint(f, capsule(L(sk, sk.shC, -4, 0.6), L(sk, sk.shC, 4.4, 0.6), 1.1), CM.iron, { spec: true });
        for (const [a, lean] of [[-3.6, -0.9], [-1.2, -0.35], [1.4, 0.35], [3.8, 0.9]]) {
          spike(f, L(sk, sk.shC, a, 1.2), norm(add(sk.up, sk.side, lean)), 2.6, 0.7, CM.iron, { spec: true });
        }
        if (view === 'front') {
          const c = L(sk, sk.shC, frontal ? 0.2 : 1.8, -3.2);
          spike(f, add(c, sk.up, -1.6), [-sk.up[0], -sk.up[1]], 1.8, 0.7, CM.iron, { spec: true });
          paint(f, disc(c, 1.9), CM.voidGlow, { spec: true });
          paint(f, disc(c, 1.1), CM.sun, { rim: false });
        }
      },
      // peaked hood over a bone skull, violet eyes and long white hair,
      // an eclipse sigil sewn on the brow
      head({ f, sk, view }) {
        const sigil = c => {
          paint(f, disc(c, 1.9), CM.voidGlow, { spec: true });
          paint(f, disc(c, 1.15), CM.sun, { rim: false });
        };
        if (isFrontal(sk)) {
          paint(f, poly([Hf(sk, -6.4, 0), Hf(sk, 6.4, 0), Hf(sk, 7, 6), Hf(sk, -7, 6)]), M.hood, { dither: true });
          paint(f, disc(Hf(sk, 0, -0.4), 6), M.hood, { dither: true, selout: true });
          paint(f, poly([Hf(sk, -3.4, -4.6), Hf(sk, 0.4, -9.6), Hf(sk, 3.4, -4.6)]), M.hood, { dither: true, selout: true });
          if (view === 'front') {
            paint(f, poly([Hf(sk, -3.8, -3.2), Hf(sk, 3.8, -3.2), Hf(sk, 4.2, 4.6), Hf(sk, -4.2, 4.6)]), CM.shadow, { rim: false });
            paint(f, poly([Hf(sk, -2.6, -2.4), Hf(sk, 2.6, -2.4), Hf(sk, 2.6, 1.4), Hf(sk, 1.4, 3.6), Hf(sk, -1.4, 3.6), Hf(sk, -2.6, 1.4)]), CM.bone, { spec: true });
            for (const ex of [-1.3, 1.3]) {
              paint(f, disc(Hf(sk, ex, -0.6), 1), CM.voidGlow, { tone: 'd', rim: false });
              dot(f, Hf(sk, ex, -0.6), GLOW_EYE.void);
            }
            paint(f, capsule(Hf(sk, -1.2, 2.6), Hf(sk, 1.2, 2.6), 0.4), CM.shadow, { rim: false });
            for (const tx of [-1, 0, 1]) dot(f, Hf(sk, tx, 2.6), CM.bone.l);
            // white hair falling either side of the skull, a fringe across the brow
            for (const k of [-1, 1]) paint(f, poly([Hf(sk, 2.4 * k, -3.4), Hf(sk, 4 * k, -2.6), Hf(sk, 4.4 * k, 4.4), Hf(sk, 3 * k, 2.4), Hf(sk, 2.4 * k, 0)]), CM.silver, { spec: true });
            paint(f, poly([Hf(sk, -3, -3.6), Hf(sk, 3, -3.6), Hf(sk, 1.4, -2), Hf(sk, 0.2, -1.4), Hf(sk, -1, -2.2)]), CM.silver, { spec: true });
            sigil(Hf(sk, 0, -5.4));
          }
          return;
        }
        // the hood drapes down onto the shoulders behind
        paint(f, poly([Hd(sk, -5.4, -1.5), Hd(sk, -7, 5.6), Hd(sk, -1, 6.6), Hd(sk, 1, 2)]), M.hood, { dither: true });
        paint(f, disc(Hd(sk, -0.6, -0.4), 6), M.hood, { dither: true, selout: true });
        paint(f, poly([Hd(sk, -2.6, -5.4), Hd(sk, -4.4, -9.4), Hd(sk, 1, -6), Hd(sk, 5, -5), Hd(sk, 7, -1.4), Hd(sk, 3, -4)]), M.hood, { dither: true, selout: true });
        if (view === 'front') {
          // dark hollow of the hood around the face
          paint(f, poly([Hd(sk, 0.8, -3.6), Hd(sk, 6, -3.2), Hd(sk, 6.2, 4.2), Hd(sk, 1, 4.6)]), CM.shadow, { rim: false });
          paint(f, poly([Hd(sk, 1.6, -2.4), Hd(sk, 5.6, -2.4), Hd(sk, 5.6, 1.4), Hd(sk, 4.6, 3.6), Hd(sk, 2.2, 3.8), Hd(sk, 1.6, 1.6)]), CM.bone, { spec: true });
          for (const ex of [3, 4.9]) {
            paint(f, disc(Hd(sk, ex, -0.4), 1.1), CM.voidGlow, { tone: 'm', rim: false });
            dot(f, Hd(sk, ex, -0.4), GLOW_EYE.void);
          }
          paint(f, capsule(Hd(sk, 2.4, 2.8), Hd(sk, 4.8, 2.8), 0.4), CM.shadow, { rim: false });
          for (const tx of [3, 4, 5]) dot(f, Hd(sk, tx, 2.8), CM.bone.l);
          // white hair spilling out from under the hood
          paint(f, poly([Hd(sk, 0.6, -3.4), Hd(sk, 1.8, -3.2), Hd(sk, 1.6, 2), Hd(sk, 1.2, 5.4), Hd(sk, 0.4, 2.6)]), CM.silver, { spec: true, rim: false });
          paint(f, poly([Hd(sk, 1.6, -3.6), Hd(sk, 5.8, -3.2), Hd(sk, 4.4, -2.2), Hd(sk, 3.4, -1.8), Hd(sk, 2.6, -2.4)]), CM.silver, { spec: true, rim: false });
        }
        sigil(Hd(sk, -1.8, -3));
      }
    },
    sp_gravelord: {
      smear: () => CM.iron,
      weapon: warhammer,
      capeMat: () => CM.fur,
      head({ f, sk, view }) {
        paint(f, disc(Hd(sk, -0.6, -0.4), 5.6), M.darkSteel, { spec: true });
        paint(f, poly([Hd(sk, -4.4, -4.8), Hd(sk, 4.4, -4.8), Hd(sk, 3.4, 4.6), Hd(sk, -3.4, 4.6)]), M.steel);
        spike(f, Hd(sk, 0.2, -5), [0, -1], 3.2, 1.1, M.gold, { spec: true });
        if (view === 'front') {
          paint(f, capsule(Hd(sk, -2.4, -1.6), Hd(sk, 2.4, -1.6), 0.7), CM.slit, { rim: false });
          paint(f, capsule(Hd(sk, 0, -1.6), Hd(sk, 0, 3), 0.7), CM.slit, { rim: false });
        }
        paint(f, capsule(Hd(sk, -3.8, 4), Hd(sk, 4.2, 4), 0.5), M.gold, { rim: false, spec: true });
      },
      torso({ f, sk, view }) {
        if (view === 'front') paint(f, disc(L(sk, sk.shC, 0.9, -3.2), 1.7), M.gold, { spec: true });
      },
      // stone pavise slung across the fur cape
      onBack({ f, sk }) {
        const S = (a, b) => L(sk, sk.shC, a, b);
        paint(f, poly([S(-9.6, 3.4), S(-1.6, 3.4), S(-2.2, -7), S(-5.6, -12.6), S(-9.4, -7)]), M.steel, { spec: true });
        paint(f, capsule(S(-2.6, -4.6), S(-9, 1.2), 0.7), M.gold, { rim: false, spec: true });
      }
    },
    sp_dragoon: {
      smear: () => CM.bolt,
      weapon: lance,
      cape: null,
      armMatsF: () => ({ upper: M.steel, fore: M.steel, hand: M.leather }),
      armMatsB: () => ({ upper: M.darkSteel, fore: M.darkSteel, hand: M.leather }),
      // wing crest pauldrons
      pauldron: ({ f, sk }, pt) => {
        const c = add(pt, sk.up, 0.7);
        paint(f, disc(c, 3.2, 2.6), M.steel, { spec: true });
        spike(f, add(c, sk.side, -2.2), [-sk.side[0], -sk.side[1]], 3.2, 1.1, CM.bolt, { spec: true });
        spike(f, add(c, sk.side, 2.2), sk.side, 3.2, 1.1, CM.bolt, { spec: true });
      },
      head({ f, sk, view }) {
        paint(f, disc(Hd(sk, -0.6, -0.3), 5.4), M.steel, { spec: true });
        paint(f, capsule(Hd(sk, -4.6, -2.4), Hd(sk, 4.8, -2.4), 0.6), M.gold, { rim: false, spec: true });
        spike(f, Hd(sk, -3.4, -4.2), Hv(sk, -1, -0.7), 3.2, 1, M.gold, { spec: true });
        spike(f, Hd(sk, 4.4, -4.2), Hv(sk, 1, -0.7), 3.2, 1, M.gold, { spec: true });
        if (view === 'front') {
          paint(f, poly([Hd(sk, -1.2, -4), Hd(sk, 4.8, -3.2), Hd(sk, 4.6, 2.4), Hd(sk, -0.6, 2)]), M.skin);
          dot(f, Hd(sk, 1.2, -0.6), EYE);
          dot(f, Hd(sk, 4, -0.6), EYE);
        }
      }
    },
    sp_reaver: {
      smear: () => CM.fire,
      weapon: (f, hand, d) => { const tip = SP_SWORDS.reaver(f, hand, d); flame(f, add(hand, d, 24), 4.5, 2, 0); return tip; },
      capeMat: () => CM.crimson,
      cape: (X) => [
        L(X.sk, X.sk.shC, -4.2, 1), L(X.sk, X.sk.shC, 4.4, 1),
        ...ragged(X.sk.hip, [X.sk.hip[0] + X.sway * 2 + 1, X.sk.hip[1] + 13 + X.tr * 6], 6, 2),
        [X.sk.hip[0] - 4.5, X.sk.hip[1] + 12]
      ],
      head({ f, sk, view }) {
        paint(f, disc(Hd(sk, -0.5, -0.2), 5.2), CM.hair);
        paint(f, poly([Hd(sk, -1.6, -5), Hd(sk, 1.4, -5.2), Hd(sk, 0.2, -8.6)]), CM.hair);
        if (view === 'front') {
          paint(f, poly([Hd(sk, -1, -4.2), Hd(sk, 5, -4), Hd(sk, 4.6, 2.6), Hd(sk, -0.4, 2.8)]), M.skin);
          dot(f, Hd(sk, 1.2, -0.6), EYE);
          dot(f, Hd(sk, 4, -0.6), EYE);
          paint(f, capsule(Hd(sk, 0.4, 1), Hd(sk, 4, 1.6), 0.8), CM.crimson, { rim: false });
        }
      }
    },
    sp_runeknight: {
      smear: () => CM.ghost,
      weapon: (f, hand, d) => SP_SWORDS.runeknight(f, hand, d),
      capeMat: () => M.robeTrim,
      behind({ f, sk, p }) {
        if (p.drop) return;
        for (const dx of [-8.5, 0, 8]) {
          const c = Hd(sk, dx, -9);
          paint(f, disc(c, 1.5), M.orb, { tone: 'l', rim: false, alpha: 150 });
          paint(f, disc(c, 0.8), M.venom, { spec: true });
        }
      },
      head({ f, sk, view }) {
        paint(f, disc(Hd(sk, -0.6, -0.3), 5.4), M.hood);
        paint(f, poly([Hd(sk, -1, -5.5), Hd(sk, 4.6, -4.4), Hd(sk, 6.4, -1.6), Hd(sk, 3, -3.6)]), M.hood);
        paint(f, capsule(Hd(sk, -3.8, -3), Hd(sk, 4.8, -3), 0.6), M.robeTrim, { rim: false, spec: true });
        paint(f, disc(Hd(sk, -3.2, -3), 0.8), M.orb, { spec: true });
        paint(f, disc(Hd(sk, 4.2, -3), 0.8), M.orb, { spec: true });
        if (view === 'front') {
          paint(f, poly([Hd(sk, 1.4, -2.2), Hd(sk, 5.4, -2.2), Hd(sk, 5.2, 0.6), Hd(sk, 1.6, 0.6)]), CM.shadow, { rim: false });
          dot(f, Hd(sk, 3, -0.8), GLOW_EYE.venom);
          dot(f, Hd(sk, 4.6, -0.8), GLOW_EYE.venom);
        }
      }
    },
    sp_sentinel: {
      smear: () => CM.feather,
      weapon: mace,
      cape: null,
      // knightly tower shield slung on the back
      onBack({ f, sk }) {
        const S = (a, b) => L(sk, sk.shC, a, b);
        paint(f, poly([S(-11, 3.5), S(-1.6, 3.5), S(-2.2, -6.5), S(-6.3, -12.5), S(-10.4, -6.5)]), M.steel, { spec: true });
        paint(f, capsule(S(-6.4, -10.6), S(-6.4, 0.8), 0.8), M.gold, { rim: false, spec: true });
        paint(f, capsule(S(-10, -3.6), S(-2.6, -3.6), 0.8), M.gold, { rim: false, spec: true });
      },
      head({ f, sk, view }) {
        paint(f, disc(Hd(sk, -0.6, -0.4), 5.8), M.plate || M.steel, { spec: true });
        if (view === 'front') {
          paint(f, capsule(Hd(sk, -1.4, -1.8), Hd(sk, 2.6, -1.8), 0.9), CM.slit, { rim: false });
          paint(f, capsule(Hd(sk, 0.6, -1.8), Hd(sk, 0.6, 2.6), 0.9), CM.slit, { rim: false });
        } else {
          paint(f, poly([Hd(sk, -4.6, 1), Hd(sk, 3, 1), Hd(sk, 2.6, 4.6), Hd(sk, -4.2, 4.2)]), M.darkSteel);
        }
        paint(f, capsule(Hd(sk, -4.6, -2.2), Hd(sk, 4.8, -2.2), 0.6), M.gold, { rim: false, spec: true });
        for (const dx of [-3.2, 0, 3.2]) paint(f, disc(Hd(sk, dx, -3.4), 0.7), M.gold, { spec: true });
      }
    },
    sp_duskblade: {
      smear: () => CM.voidGlow,
      weapon: (f, hand, d) => SP_SWORDS.duskblade(f, hand, d),
      capeMat: () => CM.shadow,
      cape: (X) => [
        L(X.sk, X.sk.shC, -4.2, 1), L(X.sk, X.sk.shC, 4.4, 1),
        ...ragged(X.sk.hip, [X.sk.hip[0] + X.sway + 0.5, X.sk.hip[1] + 14 + X.tr * 6], 5, 2),
        [X.sk.hip[0] - 4.6, X.sk.hip[1] + 13]
      ],
      behind({ f, sk, p }) {
        if (p.drop) return;
        paint(f, disc(Hd(sk, -6.5, -7), 1.1), CM.voidGlow, { alpha: 170 });
        paint(f, disc(Hd(sk, 6.5, -7.5), 1), CM.voidGlow, { alpha: 170 });
      },
      head({ f, sk, view }) {
        paint(f, disc(Hd(sk, -0.6, -0.3), 5.6), M.darkSteel);
        for (const dx of [-2.6, 0.4, 3.4]) spike(f, Hd(sk, dx, -5.4), Hv(sk, dx, -1), 3, 1.05, M.gold, { spec: true });
        if (view === 'front') {
          paint(f, poly([Hd(sk, 1.2, -2), Hd(sk, 5.4, -2), Hd(sk, 5, 2.4), Hd(sk, 1.4, 2.6)]), CM.shadow, { rim: false });
          dot(f, Hd(sk, 2.8, -0.6), GLOW_EYE.blood);
          dot(f, Hd(sk, 4.4, -0.6), GLOW_EYE.blood);
        } else {
          paint(f, poly([Hd(sk, -4.6, 1), Hd(sk, 3, 1), Hd(sk, 2.6, 4.6), Hd(sk, -4.2, 4.2)]), M.darkSteel);
        }
      }
    },
    sp_titan: {
      smear: () => CM.iron,
      weapon: warhammer,
      cape: null,
      // slab pauldrons
      pauldron: ({ f, sk }, pt) => {
        const c = add(pt, sk.up, 1.2);
        paint(f, disc(c, 4.6, 3.6), M.darkSteel, { spec: true });
        paint(f, disc(add(c, sk.up, 1.2), 2.6, 1.8), M.steel, { spec: true });
        spike(f, add(c, sk.side, -3.4), [-sk.side[0], -sk.side[1]], 3.4, 1.2, M.gold, { spec: true });
      },
      // megalith slab across the back
      onBack({ f, sk }) {
        const S = (a, b) => L(sk, sk.shC, a, b);
        paint(f, poly([S(-10.5, 3), S(-2.5, 3), S(-3, -8), S(-6.5, -12.5), S(-10, -8)]), M.darkSteel, { spec: true });
        paint(f, poly([S(-9, 0.5), S(-4.5, 0.5), S(-5, -7), S(-6.5, -9.5), S(-8.5, -7)]), M.steel, { spec: true });
      },
      head({ f, sk, view }) {
        paint(f, poly([Hd(sk, -5.4, -6.4), Hd(sk, 5.4, -6.4), Hd(sk, 4.6, 4.6), Hd(sk, -4.6, 4.6)]), M.darkSteel, { spec: true });
        paint(f, poly([Hd(sk, -4, -7.2), Hd(sk, 4.8, -7.2), Hd(sk, 3.4, -9.4), Hd(sk, -3.2, -9.4)]), M.steel, { spec: true });
        if (view === 'front') {
          paint(f, capsule(Hd(sk, -3, -0.6), Hd(sk, 3, -0.6), 0.55), CM.slit, { rim: false });
        } else {
          paint(f, poly([Hd(sk, -4.6, 1.4), Hd(sk, 3, 1.4), Hd(sk, 2.6, 4.6), Hd(sk, -4.2, 4.6)]), M.darkSteel);
        }
      }
    },
    sp_bannerman: {
      smear: () => M.gold,
      weapon: lance,
      cape: null,
      // furled war banner slung across the back
      onBack({ f, sk }) {
        const S = (a, b) => L(sk, sk.shC, a, b);
        paint(f, capsule(S(-5.4, -8), S(-5.4, 4), 0.7), M.wood);
        paint(f, poly([S(-5.8, -8.4), S(-0.4, -8), S(-5.8, -4)]), M.tabard, { spec: true });
        paint(f, poly([S(-6, -8.9), S(0.4, -8.4), S(-6, -3.4)]), M.gold, { rim: false, spec: true });
        paint(f, disc(S(-5.4, 4.4), 1), M.gold, { spec: true });
      },
      head({ f, sk, view }) {
        paint(f, disc(Hd(sk, -0.6, -0.3), 5.3), M.steel, { spec: true });
        horn(f, [Hd(sk, -4.6, -4.6), Hd(sk, -7, -7.4), Hd(sk, -6.4, -10.4)], 1.1, 0.7, M.darkSteel);
        horn(f, [Hd(sk, 4.6, -4.6), Hd(sk, 7, -7.4), Hd(sk, 6.4, -10.4)], 1.1, 0.7, M.darkSteel);
        if (view === 'front') {
          paint(f, poly([Hd(sk, -1.4, -3.4), Hd(sk, 4.6, -3.2), Hd(sk, 4.4, 2.6), Hd(sk, -0.8, 2.8)]), M.skin);
          dot(f, Hd(sk, 1.2, -0.6), EYE);
          dot(f, Hd(sk, 3.8, -0.6), EYE);
          paint(f, capsule(Hd(sk, 0, 2.4), Hd(sk, 3.8, 2.4), 0.5), M.tabard, { rim: false });
        }
      }
    },
    sp_warchief: {
      smear: () => CM.crimson,
      smearR: [6, 18],
      weapon: battleAxe,
      weaponB: battleAxe,
      capeMat: () => CM.fur,
      armMatsF: () => ({ upper: M.skin, fore: M.leather, hand: M.leather }),
      armMatsB: () => ({ upper: M.skin, fore: M.leather, hand: M.leather }),
      torso({ f, sk, view }) {
        if (view !== 'front') return;
        for (const dx of [-1.4, 1.4]) {
          paint(f, disc(L(sk, sk.shC, 0.2, -1.6 + dx), 1.1), CM.bone, { spec: true });
        }
      },
      head({ f, sk, view }) {
        paint(f, disc(Hd(sk, -0.6, -0.4), 5.4), CM.hair);
        paint(f, poly([Hd(sk, -1.6, -5.2), Hd(sk, 1.6, -5.2), Hd(sk, 0, -9.6)]), CM.hair, { spec: true });
        if (view === 'front') {
          paint(f, poly([Hd(sk, -1.4, -1.8), Hd(sk, 5, -1.8), Hd(sk, 4.8, 3), Hd(sk, -0.8, 3.2)]), M.skin);
          dot(f, Hd(sk, 1.2, -0.4), EYE);
          dot(f, Hd(sk, 3.8, -0.4), EYE);
          paint(f, capsule(Hd(sk, 0.2, 1.6), Hd(sk, 3.6, 1.6), 0.6), CM.crimson, { rim: false });
        }
      }
    },
    sp_phoenix_oath: {
      smear: () => CM.fire,
      smearR: [8, 20],
      weapon: (f, hand, d) => { const tip = SP_SWORDS.phoenix(f, hand, d); flame(f, add(hand, d, 22), 5, 1.8, 0); return tip; },
      capeMat: () => CM.fire,
      // warm rebirth halo behind the head
      behind({ f, sk, p }) {
        if (p.drop) return;
        const c = Hd(sk, -1, -5);
        paint(f, disc(c, 7), CM.fire, { tone: 'l', rim: false, alpha: 90 });
        paint(f, disc(add(c, [2, -2.4], 1), 5.4), CM.fire, { tone: 'm', rim: false, alpha: 120 });
      },
      head({ f, sk, view }) {
        paint(f, disc(Hd(sk, -0.6, -0.3), 5.2), M.gold, { spec: true });
        flame(f, Hd(sk, 1, -5.4), 4.6, 1.6, 0.5);
        flame(f, Hd(sk, -2.4, -5), 3.4, 1.2, -0.4);
        if (view === 'front') {
          paint(f, poly([Hd(sk, 1.2, -1.8), Hd(sk, 5.2, -1.8), Hd(sk, 5, 2.4), Hd(sk, 1.4, 2.6)]), M.skin);
          dot(f, Hd(sk, 2.8, -0.6), EYE);
          dot(f, Hd(sk, 4.6, -0.6), EYE);
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

  // Keys the motion comes to rest on: the ends, a key a segment eases 'out'
  // into, and a key the next segment eases 'in' from. Everywhere else the
  // motion flows straight through the key instead of stopping on it.
  function heldKeys(keys) {
    if (!keys.held) {
      keys.held = keys.map((k, i) => {
        const next = keys[i + 1];
        return i === 0 || !next || k.ease === 'out' || k.ease === 'inout' || next.ease === 'in' || next.ease === 'inout';
      });
    }
    return keys.held;
  }

  // Keyed poses are joined by a cubic Hermite spline (Catmull-Rom tangents,
  // zero on held keys), so limbs carry their momentum through each key
  function sampleKeys(keys, t) {
    for (let i = 1; i < keys.length; i++) {
      if (t > keys[i].t) continue;
      const k0 = keys[i - 1], k1 = keys[i];
      const h = k1.t - k0.t || 1;
      const u = Math.max(0, Math.min(1, (t - k0.t) / h));
      const held = heldKeys(keys);
      const u2 = u * u, u3 = u2 * u;
      const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
      // slope at key j for one value (comp: array index or -1), scaled to this segment
      const slope = (j, key, comp, fallback) => {
        if (held[j]) return 0;
        const pick = k => { const v = keys[k].pose[key]; return v === undefined ? fallback : comp < 0 ? v : v[comp]; };
        return (pick(j + 1) - pick(j - 1)) / (keys[j + 1].t - keys[j - 1].t) * h;
      };
      const herm = (key, comp, a, b) => a * h00 + slope(i - 1, key, comp, a) * h10 + b * h01 + slope(i, key, comp, b) * h11;
      const out = {};
      for (const k of new Set([...Object.keys(k0.pose), ...Object.keys(k1.pose)])) {
        const va = k0.pose[k] !== undefined ? k0.pose[k] : k1.pose[k];
        const vb = k1.pose[k] !== undefined ? k1.pose[k] : k0.pose[k];
        if (Array.isArray(va)) out[k] = [herm(k, 0, va[0], vb[0]), herm(k, 1, va[1], vb[1])];
        else if (typeof va === 'number') out[k] = herm(k, -1, va, vb);
        else out[k] = u < 0.5 ? va : vb;
      }
      // the spline may swing a planted foot a hair below the ground
      if (out.footF && out.footF[1] > 0) out.footF[1] = 0;
      if (out.footB && out.footB[1] > 0) out.footB[1] = 0;
      return out;
    }
    return keys[keys.length - 1].pose;
  }

  // Per-class base stances and action definitions
  const CLASS_ANIMS = {
    warrior: (() => {
      const base = { hip: [0, -19], lean: 0.08, head: 0, footF: [5, 0], footB: [-4, 0], handF: [6, -22.5], twoHand: true, wpn: 2.55, cape: 0.15 };
      const P = o => Object.assign({}, base, o);
      return {
        idle: { frames: 12, loop: true, pose: ph => { const b = Math.sin(ph * Math.PI * 2); return P({ hip: [0, -19 + 0.55 * b], lean: 0.08 + 0.02 * b, head: 0.04 * Math.sin(ph * Math.PI * 2 - 1.2), handF: [6, -22.5 + 0.5 * b], wpn: 2.55 + 0.03 * b, cape: 0.12 + 0.05 * Math.sin(ph * Math.PI * 2 + 1) }); } },
        // hip drops on each footfall and rises in flight; the free arm pumps hard
        run: { frames: 12, loop: true, pose: ph => { const s = Math.sin(ph * Math.PI * 2); return P(Object.assign(runFeet(ph, 8.5, 8), { hip: [1, -17.6 + 1.3 * Math.cos(ph * Math.PI * 4)], lean: 0.42 + 0.04 * Math.cos(ph * Math.PI * 4), head: -0.12 - 0.05 * Math.cos(ph * Math.PI * 4 - 0.8), twoHand: false, handF: [2 + s * 3.5, -19.5 - s], wpn: 0.75 + s * 0.2, handB: [4 - s * 7.5, -23.5 + Math.abs(s) * 2 - Math.max(0, -s) * 2], cape: 1 })); } },
        attack: { frames: 12, smear: [0.3, 0.7], keys: [
          { t: 0, pose: P({}) },
          { t: 0.24, ease: 'out', pose: P({ hip: [-1.5, -19.2], lean: -0.22, head: -0.1, footF: [6, 0], footB: [-6, 0], handF: [-4.5, -40], wpn: 3.75, wBack: true, cape: 0.3 }) },
          { t: 0.44, ease: 'in', pose: P({ hip: [3, -16.8], lean: 0.5, head: 0.15, footF: [11, 0], footB: [-6, 0], handF: [12, -21], wpn: 1.75, cape: 0.65 }) },
          { t: 0.62, ease: 'out', pose: P({ hip: [3.5, -16.3], lean: 0.6, head: 0.1, footF: [11, 0], footB: [-6, 0], handF: [8, -12.5], wpn: 0.8, cape: 0.5 }) },
          { t: 1, pose: P({}) }
        ] },
        // Return swing for combos: blade drops low behind, then rips upward
        // (wpn past 2*PI so the frames sweep forward instead of spinning back)
        attack2: { frames: 12, smear: [0.3, 0.7], keys: [
          { t: 0, pose: P({}) },
          { t: 0.24, ease: 'out', pose: P({ hip: [-1, -18], lean: 0.15, head: 0.05, footF: [7, 0], footB: [-5, 0], handF: [-5, -15], wpn: 5.6, wBack: true, cape: 0.3 }) },
          { t: 0.46, ease: 'in', pose: P({ hip: [3, -18.5], lean: -0.05, head: -0.1, footF: [11, 0], footB: [-6, 0], handF: [12, -26], wpn: 8.3, cape: 0.65 }) },
          { t: 0.64, ease: 'out', pose: P({ hip: [3, -19], lean: -0.15, head: -0.15, footF: [11, 0], footB: [-6, 0], handF: [8, -35], wpn: 9.0, cape: 0.5 }) },
          { t: 1, pose: P({ wpn: 2.55 + Math.PI * 2 }) }
        ] },
        dash: { frames: 9, keys: [
          { t: 0, pose: P({ hip: [-1, -15.5], lean: 0.45, footF: [5, 0], footB: [-6, 0], twoHand: false, handF: [1, -17], wpn: -1.2, handB: [-4, -20], cape: 0.3 }) },
          { t: 0.3, ease: 'out', pose: P({ hip: [5, -18], lean: 0.8, footF: [12, -2], footB: [-9, -2.5], twoHand: false, handF: [15, -23], wpn: 1.62, handB: [-6, -24], cape: 1 }) },
          { t: 0.7, pose: P({ hip: [6, -18.5], lean: 0.75, footF: [11, -1], footB: [-10, -3], twoHand: false, handF: [16, -24], wpn: 1.6, handB: [-7, -25], cape: 1 }) },
          { t: 1, ease: 'out', pose: P({ hip: [0, -17], lean: -0.05, footF: [8, 0], footB: [-5, 0], handF: [7, -22], wpn: 2.4, cape: 0.5 }) }
        ] },
        cast: { frames: 12, smear: [0.4, 0.62], keys: [
          { t: 0, pose: P({}) },
          { t: 0.32, ease: 'out', pose: P({ hip: [0, -19.6], lean: -0.12, head: -0.15, footF: [5, 0], footB: [-5, 0], handF: [1, -38], wpn: 3.14, wBack: true, cape: 0.4, glow: 1 }) },
          { t: 0.55, ease: 'in', pose: P({ hip: [2, -15], lean: 0.55, head: 0.1, footF: [10, 0], footB: [-6, 0], handF: [11, -12], wpn: 1.1, cape: 0.7, glow: 1 }) },
          { t: 1, pose: P({}) }
        ] },
        hurt: { frames: 6, keys: [
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
        idle: { frames: 12, loop: true, pose: ph => { const b = Math.sin(ph * Math.PI * 2); return P({ hip: [0, -19 + 0.5 * b], lean: 0.05 + 0.015 * b, head: 0.04 * Math.sin(ph * Math.PI * 2 - 1.2), handF: [6, -23 + 0.4 * b], handB: [-1, -21.5 + 0.4 * b], glow: 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(ph * Math.PI * 4)), cape: 0.1 }); } },
        run: { frames: 12, loop: true, pose: ph => { const s = Math.sin(ph * Math.PI * 2); return P(Object.assign(runFeet(ph, 7.5, 6.5), { hip: [1, -18 + 1.2 * Math.cos(ph * Math.PI * 4)], lean: 0.34 + 0.04 * Math.cos(ph * Math.PI * 4), head: -0.1 - 0.05 * Math.cos(ph * Math.PI * 4 - 0.8), handF: [6 + s * 2.2, -24 - Math.abs(s) * 0.8], wpn: 2.2 + s * 0.1, handB: [-2 - s * 6.5, -23 + Math.abs(s) * 1.2], cape: 1, glow: 0.5 })); } },
        attack: { frames: 12, keys: [
          { t: 0, pose: P({}) },
          { t: 0.26, ease: 'out', pose: P({ hip: [-1, -19], lean: -0.15, head: -0.1, footF: [4, 0], footB: [-4, 0], handF: [-3, -28], wpn: 3.6, wBack: true, handB: [3, -26], cape: 0.3, glow: 0.7 }) },
          { t: 0.46, ease: 'in', pose: P({ hip: [2, -18], lean: 0.4, head: 0.05, footF: [8, 0], footB: [-5, 0], handF: [13, -27], wpn: 1.85, handB: [-6, -23], cape: 0.6, glow: 1 }) },
          { t: 0.66, pose: P({ hip: [2, -18], lean: 0.36, footF: [8, 0], footB: [-5, 0], handF: [12, -26], wpn: 1.95, handB: [-5, -23], cape: 0.5, glow: 0.8 }) },
          { t: 1, pose: P({}) }
        ] },
        dash: { frames: 9, keys: [
          { t: 0, pose: P({ hip: [-1, -17], lean: 0.3, footF: [4, 0], footB: [-4, 0], handF: [4, -21], wpn: 2.4, cape: 0.3, glow: 0.6 }) },
          { t: 0.3, ease: 'out', pose: P({ hip: [5, -19], lean: 0.7, footF: [10, -2], footB: [-8, -3], handF: [14, -25], wpn: 1.7, handB: [-6, -24], cape: 1, glow: 1 }) },
          { t: 0.7, pose: P({ hip: [6, -19], lean: 0.68, footF: [10, -1.5], footB: [-9, -3], handF: [15, -25], wpn: 1.7, handB: [-7, -24], cape: 1, glow: 1 }) },
          { t: 1, ease: 'out', pose: P({ hip: [0, -18], lean: 0, footF: [5, 0], footB: [-3, 0], cape: 0.4 }) }
        ] },
        cast: { frames: 12, keys: [
          { t: 0, pose: P({}) },
          { t: 0.3, ease: 'out', pose: P({ hip: [0, -19.5], lean: -0.12, head: -0.2, handF: [3, -38], wpn: 3.14, handB: [-4, -35], cape: 0.5, glow: 1 }) },
          { t: 0.62, pose: P({ hip: [0, -21.5], lean: -0.1, head: -0.2, footF: [3, -2], footB: [-3, -2], handF: [3, -40], wpn: 3.14, handB: [-5, -37], cape: 0.7, glow: 1 }) },
          { t: 1, pose: P({}) }
        ] },
        hurt: { frames: 6, keys: [
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
        idle: { frames: 12, loop: true, pose: ph => { const b = Math.sin(ph * Math.PI * 2); return P({ hip: [0, -17 + 0.6 * b], lean: 0.22 + 0.02 * b, head: -0.05 + 0.04 * Math.sin(ph * Math.PI * 2 - 1.2), handF: [7, -21 + 0.5 * b], handB: [0, -22 + 0.5 * b], cape: 0.2 + 0.1 * Math.sin(ph * Math.PI * 2 + 1.3) }); } },
        // low ninja sprint: deep crouch, long stride, blades trailing behind
        run: { frames: 12, loop: true, pose: ph => { const s = Math.sin(ph * Math.PI * 2); return P(Object.assign(runFeet(ph, 9, 8), { hip: [1.5, -16 + 1.2 * Math.cos(ph * Math.PI * 4)], lean: 0.7 + 0.04 * Math.cos(ph * Math.PI * 4), head: -0.32 - 0.05 * Math.cos(ph * Math.PI * 4 - 0.8), handF: [-7 + s * 2.5, -18.5 + s * 0.8], wpn: -1.45, handB: [-5 - s * 2.5, -20 - s * 0.8], wpnB: -1.35, cape: 1 })); } },
        attack: { frames: 12, smear: [0.26, 0.7], keys: [
          { t: 0, pose: P({}) },
          { t: 0.22, ease: 'out', pose: P({ hip: [-1, -17], lean: 0.05, head: -0.05, handF: [1, -27], wpn: 3.6, handB: [3, -26.5], wpnB: 3.4, cape: 0.3 }) },
          { t: 0.42, ease: 'in', pose: P({ hip: [4, -15.5], lean: 0.55, head: 0.05, footF: [11, 0], footB: [-6, 0], handF: [13, -17], wpn: 1.3, handB: [11, -29], wpnB: 2.2, cape: 0.8 }) },
          { t: 0.62, ease: 'out', pose: P({ hip: [4, -15.2], lean: 0.6, footF: [11, 0], footB: [-6, 0], handF: [9, -12], wpn: 0.6, handB: [13, -24], wpnB: 1.6, cape: 0.6 }) },
          { t: 1, pose: P({}) }
        ] },
        // Return swing for combos: both blades pulled low, then swept up and across
        attack2: { frames: 12, smear: [0.26, 0.7], keys: [
          { t: 0, pose: P({}) },
          { t: 0.22, ease: 'out', pose: P({ hip: [-1, -16.5], lean: 0.35, handF: [-3, -19], wpn: -1.6, handB: [-6, -21], wpnB: -1.9, cape: 0.3 }) },
          { t: 0.42, ease: 'in', pose: P({ hip: [4, -15.5], lean: 0.6, footF: [11, 0], footB: [-6, 0], handF: [14, -22], wpn: 1.4, handB: [12, -18], wpnB: 0.9, cape: 0.8 }) },
          { t: 0.62, ease: 'out', pose: P({ hip: [4, -15.3], lean: 0.55, footF: [11, 0], footB: [-6, 0], handF: [11, -27], wpn: 2.2, handB: [13, -14], wpnB: 0.3, cape: 0.6 }) },
          { t: 1, pose: P({}) }
        ] },
        dash: { frames: 9, keys: [
          { t: 0, pose: P({ hip: [-1, -14], lean: 0.6, footF: [6, 0], footB: [-6, 0], handF: [-3, -16], wpn: -1.4, handB: [-5, -18], wpnB: -1.4, cape: 0.4 }) },
          { t: 0.3, ease: 'out', pose: P({ hip: [6, -14], lean: 1.05, head: -0.4, footF: [12, -2], footB: [-9, -3], handF: [17, -17], wpn: 1.6, handB: [-8, -18], wpnB: -1.6, cape: 1 }) },
          { t: 0.7, pose: P({ hip: [7, -14.5], lean: 1, head: -0.4, footF: [12, -1], footB: [-10, -3], handF: [18, -18], wpn: 1.6, handB: [-9, -18], wpnB: -1.6, cape: 1 }) },
          { t: 1, ease: 'out', pose: P({ hip: [0, -15], lean: 0.25, footF: [8, 0], footB: [-6, 0], cape: 0.5 }) }
        ] },
        cast: { frames: 12, smear: [0.4, 0.62], keys: [
          { t: 0, pose: P({}) },
          { t: 0.35, ease: 'out', pose: P({ hip: [0, -14], lean: 0.3, head: 0.05, footF: [6, 0], footB: [-6, 0], handF: [2, -22], wpn: 3.5, handB: [4, -21], wpnB: 3.3, cape: 0.3 }) },
          { t: 0.58, ease: 'in', pose: P({ hip: [0, -20.5], lean: -0.1, head: -0.15, footF: [4, -1.5], footB: [-4, -1.5], handF: [12, -30], wpn: 2.3, handB: [-10, -29], wpnB: -2.3, cape: 0.9, glow: 1 }) },
          { t: 1, pose: P({}) }
        ] },
        hurt: { frames: 6, keys: [
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
    return { frames: 12, hold: true, keys: [
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
  const LOOP_HZ = { idle: 0.75, run: 1.75 };
  const ACTIONS = ['idle', 'run', 'attack', 'attack2', 'dash', 'cast', 'hurt', 'death'];

  function poseAt(def, i) {
    const n = def.frames;
    return poseAtT(def, def.loop ? i / n : (def.hold ? i / (n - 1) : i / n));
  }

  function poseAtT(def, t) {
    const pose = def.pose ? def.pose(t) : sampleKeys(def.keys, t);
    // a costume may re-grip the class poses (e.g. dual wield)
    return { pose: COSTUME && COSTUME.pose ? COSTUME.pose(pose) : pose, t };
  }

  // The smear trails the blade over a fixed slice of the action, however many
  // frames the action is cut into
  const SMEAR_SPAN = 0.125;

  // Attacking on the move: the swing's upper body over the run cycle's legs
  // (run phase ri), the hip riding the run's bob plus half the swing's crouch
  function runBlend(cls, ri) {
    const runPose = poseAt(CLASS_ANIMS[cls].run, ri).pose;
    const stand = poseAt(CLASS_ANIMS[cls].idle, 0).pose;
    return up => Object.assign({}, up, {
      footF: runPose.footF, footB: runPose.footB,
      hip: [up.hip[0], runPose.hip[1] + (up.hip[1] - stand.hip[1]) * 0.5],
      cape: Math.max(up.cape || 0, runPose.cape || 0)
    });
  }

  function buildFrame(cls, view, action, i, blend) {
    const def = CLASS_ANIMS[cls][action];
    const { pose: rawPose, t } = poseAt(def, i);
    const pose = blend ? blend(rawPose) : rawPose;
    const f = newFrame();
    const vd = VIEW_DEF[view] || VIEW_DEF.E;
    const sk = skeleton(pose, (COSTUME && COSTUME.rig) || RIGS[cls], vd.phi);
    // Motion smear disabled: removed small swing arc near character
    // if (def.smear && t >= def.smear[0] && t <= def.smear[1] && i > 0 && !pose.drop) { ... }
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
  function withLook(palette, costumeKey, fn) {
    const saved = {};
    // a costume can carry its own colours, which win over the card's palette
    const costume = (costumeKey && (COSTUMES[costumeKey] || GEAR.get(costumeKey))) || null;
    palette = Object.assign({}, palette, (costume && costume.palette) || {});
    for (const [k, cols] of Object.entries(palette)) {
      if (!M[k]) continue;
      saved[k] = M[k];
      M[k] = Array.isArray(cols) ? mat(cols[0], cols[1], cols[2], cols[3], cols[4]) : cols;
    }
    COSTUME = costume;
    try {
      return fn();
    } finally {
      Object.assign(M, saved);
      COSTUME = null;
    }
  }

  function buildVariant(cls, palette, costumeKey, views) {
    return withLook(palette, costumeKey, () => buildClass(cls, views));
  }

  // One swing frame (action frame ai) over run frame ri, optionally in an SP card's look
  function buildRunAttack(cls, palette, costumeKey, view, action, ai, ri) {
    return withLook(palette, costumeKey, () => buildFrame(cls, view, action, ai, runBlend(cls, ri)));
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
    // Looping actions play at a fixed rate (cycles per second) whatever their
    // frame count: loopIndex picks the frame for a clock in seconds
    LOOP_HZ,
    loopIndex: (cls, action, seconds) => {
      const n = (CLASS_ANIMS[cls] || CLASS_ANIMS.warrior)[action].frames;
      return ((Math.floor(seconds * LOOP_HZ[action] * n) % n) + n) % n;
    },
    buildAll, buildFrame, buildVariant, buildRunAttack, topRow,
    // key of the look a hero's equipment gives them, for variantFrame / runAttackFrame / headTop
    gearKey
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
    // Swing-while-running frame: attack frame ai on run frame ri (key: SP card id or null)
    const runAttacks = new Map();
    api.runAttackFrame = (cls, key, palette, view, action, ai, ri) => {
      if (!CLASS_ANIMS[cls]) cls = 'warrior';
      if (!VIEW_DEF[view]) view = 'E';
      if (palette) palettes.set(key, palette);
      const n = CLASS_ANIMS[cls][action].frames, m = CLASS_ANIMS[cls].run.frames;
      ai = Math.max(0, Math.min(n - 1, ai)); ri = ((ri % m) + m) % m;
      const k = (key || cls) + '|' + view + '|' + action + '|' + ai + '|' + ri;
      let c = runAttacks.get(k);
      if (!c) {
        c = toCanvas(buildRunAttack(cls, key ? palettes.get(key) : null, key, view, action, ai, ri));
        runAttacks.set(k, c);
      }
      return c;
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
