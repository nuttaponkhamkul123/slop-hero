// Slop Hero - melee swing and hit effects, drawn in screen space by renderer.js.
//
//   SlashFx.crescent(ctx, o)  a basic swing: the motion blur a blade leaves in the air. A smear of
//                             light that fades smoothly from the tail to the cutting edge (a conic
//                             gradient round the hero), feathered across its width, with a thin
//                             specular line along the edge and a glint at the head. It rushes round
//                             fast, then dissolves.
//   SlashFx.impact(ctx, o)    a hit landing: a small hot flash and a spray of sparks that streak
//                             out and arc down under gravity, cooling from white to the swing colour.
//
// Colours come in as { core, body, glow } rgb arrays.
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp01(a)})`;
  // small deterministic PRNG so an effect looks the same every frame
  const rng = (seed) => { let s = (seed * 9301 + 49297) % 233280 || 1; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

  // Width along the smear, tail (t = 0) to head (t = 1): a hair at the tail, fullest just
  // behind the head, rounded off at the head
  const profile = (t) => {
    if (t <= 0 || t >= 1) return 0;
    return t < 0.82 ? Math.pow(t / 0.82, 1.4) : Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.82) / 0.18, 2)));
  };

  // Trace an annular band from angle aFrom (t = 0) to aTo (t = 1), outer radius R,
  // width W * profile(t), the band's outer edge pulled in by inset
  function band(ctx, aFrom, aTo, R, W, inset) {
    const N = 32;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = aFrom + (aTo - aFrom) * t, r = R - inset;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N, a = aFrom + (aTo - aFrom) * t, r = R - inset - W * profile(t);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  }

  // A fill that ramps from transparent at the tail angle to `a` at the head angle
  function ramp(ctx, tail, head, c, a) {
    if (!ctx.createConicGradient) return rgba(c, a * 0.6);
    const fwd = head > tail;
    const g = ctx.createConicGradient(fwd ? tail : head, 0, 0);
    const span = Math.min(0.998, Math.abs(head - tail) / TAU);
    if (fwd) {
      g.addColorStop(0, rgba(c, 0));
      g.addColorStop(span * 0.55, rgba(c, a * 0.35));
      g.addColorStop(span, rgba(c, a));
      g.addColorStop(span + 0.001, rgba(c, 0));
    } else {
      g.addColorStop(0, rgba(c, a));
      g.addColorStop(span * 0.45, rgba(c, a * 0.35));
      g.addColorStop(span, rgba(c, 0));
    }
    return g;
  }

  // o: { x, y, dir, squash, R, W, half, side, p, col, alpha, z, finisher, delay }
  function crescent(ctx, o) {
    const p = clamp01((o.p - (o.delay || 0)) / (1 - (o.delay || 0)));
    if (p <= 0 || p >= 1) return;
    const side = o.side || 1;
    const a0 = -side * o.half, a1 = side * o.half;
    const sweep = easeOut(p / 0.34);                       // the blade rushes round, then stops
    const head = a0 + (a1 - a0) * sweep;
    // the blur trails the blade by most of the swing, and the tail catches up as it dissolves
    const settle = clamp01((p - 0.34) / 0.66);
    const trail = Math.abs(a1 - a0) * (o.finisher ? 0.85 : 0.72) * (1 - 0.65 * settle);
    const tail = side > 0 ? Math.max(a0, head - trail) : Math.min(a0, head + trail);
    const alpha = (o.alpha === undefined ? 1 : o.alpha) * Math.pow(1 - settle, 1.6);
    const z = o.z || 1;
    if (Math.abs(head - tail) < 0.03 || alpha <= 0.01) return;
    const W = o.W * (0.55 + 0.45 * easeOut(p / 0.2)) * (1 - 0.35 * settle);
    const { core, body, glow } = o.col;

    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(1, o.squash || 0.6);
    ctx.rotate(o.dir);
    ctx.globalCompositeOperation = 'lighter';

    // 1. a faint, wide haze of disturbed air around the cut
    band(ctx, tail, head, o.R + W * 0.35, W * 2.1, 0);
    ctx.fillStyle = ramp(ctx, tail, head, glow, 0.2 * alpha);
    ctx.fill();
    // 2. the smear, feathered: three nested bands, each narrower and brighter
    for (const [w, inset, a] of [[1, 0, 0.34], [0.62, W * 0.08, 0.45], [0.32, W * 0.12, 0.6]]) {
      band(ctx, tail, head, o.R, W * w, inset);
      ctx.fillStyle = ramp(ctx, tail, head, body, a * alpha);
      ctx.fill();
    }
    // 3. the specular line the edge leaves: thin, bright, only over the newest part of the cut
    const edgeFrom = head - (head - tail) * 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, o.R - W * 0.12, Math.min(edgeFrom, head), Math.max(edgeFrom, head));
    ctx.strokeStyle = ramp(ctx, edgeFrom, head, core, 0.95 * alpha);
    ctx.lineWidth = Math.max(1, (o.finisher ? 1.9 : 1.4) * z);
    ctx.lineCap = 'round';
    ctx.stroke();
    // 4. a soft glint riding the head while the blade is still moving
    if (p < 0.38) {
      const k = 1 - p / 0.38;
      const r = o.R - W * 0.15;
      const hx = Math.cos(head) * r, hy = Math.sin(head) * r;
      const gr = (o.finisher ? 9 : 6) * z;
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, gr);
      g.addColorStop(0, rgba(core, 0.9 * k * alpha));
      g.addColorStop(0.35, rgba(body, 0.35 * k * alpha));
      g.addColorStop(1, rgba(body, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(hx, hy, gr, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // o: { x, y, size, p, col, seed, crit, dir }  dir: screen angle the blow travelled (sparks fly on)
  function impact(ctx, o) {
    const p = clamp01(o.p);
    if (p >= 1) return;
    const r = rng(o.seed || 3);
    const { core, body, glow } = o.col;
    const S = o.size;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    // a small hot flash at the point of contact
    if (p < 0.28) {
      const k = 1 - p / 0.28;
      const fr = S * (0.55 + 0.45 * (1 - k));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, fr);
      g.addColorStop(0, rgba(core, 0.95 * k));
      g.addColorStop(0.3, rgba(body, 0.5 * k));
      g.addColorStop(1, rgba(glow, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, fr, 0, TAU); ctx.fill();
      // a short horizontal glare streak
      ctx.strokeStyle = rgba(core, 0.6 * k);
      ctx.lineWidth = Math.max(1, S * 0.04);
      ctx.beginPath(); ctx.moveTo(-S * 0.55 * k, 0); ctx.lineTo(S * 0.55 * k, 0); ctx.stroke();
    }

    // sparks: thrown mostly onward along the blow, arcing down under gravity, cooling as they go
    const n = o.crit ? 14 : 9;
    const dir = o.dir === undefined ? -Math.PI / 2 : o.dir;
    const T = p * 0.42;                                  // seconds of flight
    const grav = S * 22;
    for (let i = 0; i < n; i++) {
      const a = dir + (r() - 0.5) * 2.4 - 0.35;
      const sp = S * (6 + r() * 7) * (o.crit ? 1.3 : 1);
      const wid = 0.05 + 0.03 * r();
      const life = 0.6 + r() * 0.4;                      // share of the effect this spark lasts
      if (p > life) continue;
      const k = p / life;
      const pos = (t) => ({ x: Math.cos(a) * sp * t, y: Math.sin(a) * sp * t + 0.5 * grav * t * t });
      const now = pos(T), prev = pos(Math.max(0, T - 0.03));
      const hot = 1 - k;
      ctx.strokeStyle = hot > 0.55 ? rgba(core, hot) : rgba(body, hot * 1.4);
      ctx.lineWidth = Math.max(1, S * wid * (1 - 0.5 * k));
      ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(now.x, now.y); ctx.stroke();
    }
    ctx.restore();
  }

  window.SlashFx = { crescent, impact };
})();
