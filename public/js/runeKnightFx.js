// Slop Hero - Rune Knight skill visuals (the glyph kit in server/spCards.ts; mechanics untouched).
// Installed onto IsometricRenderer: drawSpSkill hands every Rune Knight effect here first.
// Everything is carved in light: real rune letters (elder futhark) laid flat in glowing circles
// on the ground or floating upright, in three inks - jade for Ruin and the knight's own magic,
// gold for Binding, ice for Frost - drawn texel by texel with the pixel motif kit (spMotifs).
//
//   rune    a carved glyph (draws itself stroke by stroke, then breathes) / its burst
//   invoke  Invocation: a circle under the knight, ley beams racing out to every glyph
//   line    Runic Bladewave: a crescent of light that burns runes into the ground behind it
//   blink   Runic Step: the circle under you folds up and opens again where you land
//   chain   Ley Chain: a sinuous ley line threading through the targets
//   buff    Guardian Glyph: a ward circle with rune tablets orbiting the knight
//   blast   Grand Inscription (signature): a great inscribed circle that detonates
//   echo    Runic Echo (passive): a rune flashing over the echoed target
(function () {
  'use strict';
  if (!window.IsometricRenderer) return;
  const TAU = Math.PI * 2;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const out3 = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  const lerp = (a, b, t) => a + (b - a) * t;

  // dark -> white inks, 7 steps each
  const INK = {
    jade: ['#03140c', '#0a3a24', '#126b45', '#1fb06f', '#5ef0a8', '#c9ffe4', '#ffffff'],
    gold: ['#1a1003', '#5c3a08', '#a8700f', '#e0a91c', '#fde58a', '#fffbe0', '#ffffff'],
    ice: ['#04121f', '#0b3d5c', '#1677a8', '#3fb6e8', '#9fe7ff', '#e6fbff', '#ffffff']
  };
  const inkFor = (kind) => (kind === 'bind' ? INK.gold : kind === 'frost' ? INK.ice : INK.jade);

  // rune letters as strokes in a unit box (u right, v up, both -0.5..0.5)
  const RUNES = [
    [[-0.2, -0.5, -0.2, 0.5], [-0.2, 0.15, 0.3, 0.45], [-0.2, -0.12, 0.3, 0.18]],                       // fehu
    [[-0.3, -0.5, -0.3, 0.5], [-0.3, 0.5, 0.3, 0.2], [0.3, 0.2, 0.3, -0.5]],                              // uruz
    [[-0.2, -0.5, -0.2, 0.5], [-0.2, 0.28, 0.25, 0], [0.25, 0, -0.2, -0.28]],                             // thurisaz
    [[-0.25, -0.5, -0.25, 0.5], [-0.25, 0.5, 0.25, 0.25], [0.25, 0.25, -0.25, 0], [-0.25, 0, 0.25, -0.5]], // raidho
    [[0, -0.5, 0, 0.5], [0, 0.08, -0.35, 0.5], [0, 0.08, 0.35, 0.5]],                                     // algiz
    [[0, -0.5, 0, 0.5], [0, 0.5, -0.32, 0.18], [0, 0.5, 0.32, 0.18]],                                     // tiwaz
    [[0, 0.5, 0.3, 0.15], [0.3, 0.15, 0, -0.2], [0, -0.2, -0.3, 0.15], [-0.3, 0.15, 0, 0.5], [-0.25, -0.12, 0.25, -0.5], [0.25, -0.12, -0.25, -0.5]], // othala
    [[-0.3, -0.5, -0.3, 0.5], [0.3, -0.5, 0.3, 0.5], [-0.3, 0.5, 0.3, 0.08], [0.3, 0.5, -0.3, 0.08]],    // mannaz
    [[-0.3, -0.5, -0.3, 0.5], [0.3, -0.5, 0.3, 0.5], [-0.3, 0.5, 0.3, -0.5], [-0.3, -0.5, 0.3, 0.5]],    // dagaz
    [[0.22, 0.5, -0.2, 0.15], [-0.2, 0.15, 0.2, -0.15], [0.2, -0.15, -0.22, -0.5]],                       // sowilo
    [[-0.25, 0.5, 0.25, -0.5], [0.25, 0.5, -0.25, -0.5], [-0.25, 0.5, 0.25, 0.5]],                        // a closing rune
    [[0, -0.5, 0, 0.5], [-0.3, 0.25, 0.3, -0.25]]                                                         // nauthiz
  ];
  // the rune each glyph kind shows over its heart
  const HEART = { ruin: 4, bind: 8, frost: 11 };

  IsometricRenderer.prototype.drawRuneKnightSkill = function (ctx, fx, progress, toScreen, z) {
    const M = this.spMotifs(ctx, fx, progress);
    const { tex, hash } = M;
    const P = M.px, Ln = M.line;
    const time = this.animations.time;
    ctx.globalCompositeOperation = 'source-over';
    const seg = (a, b) => clamp01((progress - a) / (b - a));
    const fade = progress < 0.65 ? 1 : clamp01(1 - (progress - 0.65) / 0.35);
    const sx = fx.startX !== undefined ? fx.startX : fx.x, sy = fx.startY !== undefined ? fx.startY : fx.y;
    const tx = fx.x !== undefined ? fx.x : sx, ty = fx.y !== undefined ? fx.y : sy;
    const PXW = 32 * Math.SQRT2 * z;                         // screen px per world tile (across)
    const C = inkFor(fx.kind);
    const K = (inkArr, i) => inkArr[Math.max(0, Math.min(6, Math.round(i)))];

    // ---- pieces ----
    const W = (cx, cy, r, a, h = 0) => toScreen(cx + Math.cos(a) * r, cy + Math.sin(a) * r, h);
    // a glowing stroke: a halo under a bright core. As it fades the halo goes first and then
    // the stroke itself, so nothing ever turns into a dark line
    const halo = (lvl) => lvl >= 4.6;
    const seen = (lvl) => lvl >= 2.6;
    // a plain ground ring that fades out the same way
    const ring = (cx, cy, r, ink, lvl, w = 1, gap = 0) => { if (seen(lvl)) M.ellipse(cx, cy, r, K(ink, Math.max(3, lvl)), w, gap); };
    const glow = (a, b, ink, lvl, w = 1) => {
      if (!seen(lvl)) return;
      if (halo(lvl)) Ln(a, b, K(ink, lvl - 3), w + 2);
      Ln(a, b, K(ink, Math.max(3, lvl)), w);
    };
    // an arc of a world circle, from angle a0 over `span`, as a glowing ring
    const arc = (cx, cy, r, a0, span, ink, lvl, w = 1, h = 0) => {
      if (span <= 0.01 || r <= 0.02 || !seen(lvl)) return;
      const n = Math.max(6, Math.round((r * PXW * Math.abs(span)) / (3 * tex)));
      let prev = W(cx, cy, r, a0, h);
      if (halo(lvl)) for (let i = 1; i <= n; i++) { const q = W(cx, cy, r, a0 + span * (i / n), h); Ln(prev, q, K(ink, lvl - 3), w + 2); prev = q; }
      prev = W(cx, cy, r, a0, h);
      for (let i = 1; i <= n; i++) { const q = W(cx, cy, r, a0 + span * (i / n), h); Ln(prev, q, K(ink, Math.max(3, lvl)), w); prev = q; }
    };
    // a rune letter laid flat on the ground at (cx, cy), its "up" pointing along angle `up`
    const flatRune = (cx, cy, idx, size, up, ink, lvl, h = 0) => {
      const strokes = RUNES[((idx % RUNES.length) + RUNES.length) % RUNES.length];
      const ux = -Math.sin(up), uy = Math.cos(up), vx = Math.cos(up), vy = Math.sin(up);
      if (!seen(lvl)) return;
      const at = (u, v) => toScreen(cx + (u * ux + v * vx) * size, cy + (u * uy + v * vy) * size, h);
      if (halo(lvl)) for (const s of strokes) Ln(at(s[0], s[1]), at(s[2], s[3]), K(ink, lvl - 3), 3);
      for (const s of strokes) Ln(at(s[0], s[1]), at(s[2], s[3]), K(ink, Math.max(3, lvl)), 1);
    };
    // a rune letter standing upright on screen, centred at screen point p, `px` tall
    const uprightRune = (p, idx, px, ink, lvl) => {
      const strokes = RUNES[((idx % RUNES.length) + RUNES.length) % RUNES.length];
      if (!seen(lvl)) return;
      const at = (u, v) => ({ x: p.x + u * px * 0.8, y: p.y - v * px });
      if (halo(lvl)) for (const s of strokes) Ln(at(s[0], s[1]), at(s[2], s[3]), K(ink, lvl - 3), 3);
      for (const s of strokes) Ln(at(s[0], s[1]), at(s[2], s[3]), K(ink, Math.max(3, lvl)), 2);
    };
    // a column of light rising from screen point p, `hp` px tall, `w` texels half-width
    const beam = (p, hp, w, ink, env) => {
      if (env <= 0.02 || hp < 2) return;
      const rows = Math.round(hp / tex);
      for (let r = 0; r < rows; r++) {
        const t = r / rows;
        if (hash(r * 3 + Math.floor(time * 30)) > env * (1 - t * 0.85)) continue;
        const half = Math.max(0, Math.round(w * (1 - t * 0.5)));
        for (let i = -half; i <= half; i++) {
          const e = half ? Math.abs(i) / half : 0;
          P(p.x + i * tex, p.y - r * tex, K(ink, e < 0.35 ? 6 : e < 0.7 ? 5 : 3));
        }
      }
    };
    // a starburst flash at screen point p
    const flash = (p, px, ink, env) => {
      if (env <= 0.02) return;
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + 0.3, len = px * env * (i % 2 ? 0.55 : 1);
        Ln(p, { x: p.x + Math.cos(a) * len, y: p.y + Math.sin(a) * len * 0.6 }, K(ink, i % 2 ? 4 : 5), 1);
      }
      P(p.x, p.y, K(ink, 6), Math.max(2, Math.round(4 * env)));
    };
    // motes of light drifting up off a disc
    const motes = (cx, cy, r, n, ink, env, salt) => {
      if (env <= 0.02) return;
      for (let i = 0; i < n; i++) {
        const ph = (time * (0.35 + 0.2 * hash(salt + i)) + hash(salt + i + 9)) % 1;
        const a = hash(salt + i + 3) * TAU, d = r * Math.sqrt(hash(salt + i + 5));
        const p = toScreen(cx + Math.cos(a) * d, cy + Math.sin(a) * d, ph * 1.8);
        if (hash(salt + i + 11) > env) continue;
        P(p.x, p.y, K(ink, 6 - ph * 3), ph < 0.4 ? 2 : 1);
      }
    };
    // the inscribed circle: outer double ring, a band of runes, the kind's sigil; draw 0..1 carves it
    const circle = (cx, cy, r, kind, ink, draw, lvl, spin, salt) => {
      const D = clamp01(draw);
      arc(cx, cy, r, spin, TAU * D, ink, lvl, 1);
      arc(cx, cy, r * 0.76, -spin * 1.3, TAU * clamp01(D * 1.25 - 0.2), ink, lvl - 1, 1);
      // runes around the band
      const n = 8;
      for (let i = 0; i < n; i++) {
        if (D < (i + 1) / n) continue;
        const a = spin + (i / n) * TAU;
        flatRune(cx + Math.cos(a) * r * 0.88, cy + Math.sin(a) * r * 0.88, salt + i * 5, r * 0.15, a, ink, lvl - 1);
      }
      // the sigil inside
      const s = clamp01(D * 1.6 - 0.6);
      if (s <= 0) return;
      const ri = r * 0.62;
      if (kind === 'frost') {
        for (let j = 0; j < 6; j++) {
          const a = -spin + j * Math.PI / 3;
          const tip = W(cx, cy, ri * s, a), c0 = toScreen(cx, cy, 0);
          glow(c0, tip, ink, lvl, 1);
          const m = { x: cx + Math.cos(a) * ri * 0.55 * s, y: cy + Math.sin(a) * ri * 0.55 * s };
          for (const sg of [-1, 1]) glow(toScreen(m.x, m.y, 0), W(m.x, m.y, ri * 0.25 * s, a + sg * 0.7), ink, lvl - 1, 1);
        }
      } else if (kind === 'bind') {
        for (const off of [0, Math.PI / 4]) {
          const pts = [0, 1, 2, 3].map(j => W(cx, cy, ri * s, spin * 0.7 + off + j * Math.PI / 2));
          for (let j = 0; j < 4; j++) glow(pts[j], pts[(j + 1) % 4], ink, lvl - (off ? 1 : 0), 1);
        }
        for (let j = 0; j < 4; j++) M.ellipse(cx + Math.cos(spin * 0.7 + j * Math.PI / 2) * ri * s, cy + Math.sin(spin * 0.7 + j * Math.PI / 2) * ri * s, 0.12, K(ink, lvl), 1, 0);
      } else {
        for (let tri = 0; tri < 2; tri++) {
          const pts = [0, 1, 2].map(j => W(cx, cy, ri, -spin + tri * Math.PI / 3 + j * TAU / 3));
          for (let j = 0; j < 3; j++) {
            const u = clamp01(s * 3 - j);
            if (u <= 0) continue;
            const a = pts[j], b = pts[(j + 1) % 3];
            glow(a, { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) }, ink, lvl - tri, 1);
          }
        }
      }
      // the heart rune, laid at the centre
      if (s > 0.6) flatRune(cx, cy, HEART[kind] !== undefined ? HEART[kind] : 4, r * 0.3, -Math.PI / 2, ink, lvl);
    };

    switch (fx.shape) {
      // ---- GLYPHS: carved, armed, waiting; then the burst
      case 'rune': {
        const rr = fx.radius || 2.4;
        const r = Math.max(0.75, rr * 0.42);
        if (fx.scar) {
          // the inscribed ground a burst leaves behind: smouldering runes that flare on every tick
          const dur = fx.duration || 3, el = progress * dur;
          const env = clamp01(1 - el / dur), appear = out3(clamp01(el / 0.25));
          const pulse = Math.pow(0.5 + 0.5 * Math.cos(((el % 0.5) / 0.5) * TAU), 2);
          const lvl = 3 + 2.8 * env * (0.55 + 0.45 * pulse);
          arc(tx, ty, rr * appear, time * 0.3, TAU, C, lvl, 1);
          ring(tx, ty, rr * 0.7 * appear, C, lvl - 0.6, 1, 0.55);
          for (let i = 0; i < 6; i++) {
            const a = -time * 0.25 + (i / 6) * TAU;
            flatRune(tx + Math.cos(a) * rr * 0.55, ty + Math.sin(a) * rr * 0.55, i * 4 + 3, rr * 0.16, a, C, lvl - 0.3 + (hash(i + Math.floor(time * 8)) - 0.5));
          }
          if (pulse > 0.8 && env > 0.1) ring(tx, ty, rr * (1.05 - 0.25 * pulse), C, 5.5, 1, 0.3);
          motes(tx, ty, rr, 12, C, env, 47);
          return true;
        }
        if (fx.burst) {
          const e = out3(seg(0, 0.45));
          const c = toScreen(tx, ty, 0);
          // the circle bursts outward, its runes flung up and away
          arc(tx, ty, lerp(r, rr, e), time, TAU, C, 6 - progress * 4, e < 0.5 ? 2 : 1);
          ring(tx, ty, rr * (0.6 + 0.5 * e), C, 5 - progress * 3, 1, 0.35 + progress * 0.4);
          for (let i = 0; i < 8; i++) {
            const a = time * 0.4 + (i / 8) * TAU, d = lerp(r * 0.88, rr * 1.1, e);
            if (fade > 0.1) flatRune(tx + Math.cos(a) * d, ty + Math.sin(a) * d, i * 5, r * 0.18, a, C, 6 - progress * 4, Math.sin(Math.PI * e) * 1.4);
          }
          if (progress < 0.4) beam(c, 120 * z * (1 - progress / 0.4), 3, C, 1 - progress / 0.4);
          if (progress < 0.25) flash(toScreen(tx, ty, 0.3), 30 * z, C, 1 - progress / 0.25);
          if (fx.kind === 'bind') {
            // golden chains reel in from the rim and lock on the heart
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * TAU, n = 12;
              for (let j = 0; j <= n * e; j++) {
                const u = j / n, p = toScreen(lerp(tx + Math.cos(a) * rr, tx, u), lerp(ty + Math.sin(a) * rr, ty, u), 0.15 + Math.sin(u * Math.PI) * 0.4 * (1 - e));
                if (j % 2) P(p.x, p.y, K(C, 5 - progress * 3), 2);
                else { P(p.x, p.y, K(C, 2), 4); P(p.x, p.y, K(C, 6 - progress * 3), 2); }
              }
            }
          } else if (fx.kind === 'frost') {
            // a ring of ice spears punching up
            const hh = 30 * z * clamp01(progress * 5) * (progress < 0.55 ? 1 : 1 - (progress - 0.55) / 0.45);
            for (let i = 0; i < 9; i++) {
              const a = (i / 9) * TAU, p = W(tx, ty, rr * 0.6, a);
              const h = hh * (0.7 + 0.4 * hash(i)), w = 2 * tex;
              Ln({ x: p.x - w, y: p.y }, { x: p.x, y: p.y - h }, K(C, 3), 2);
              Ln({ x: p.x + w, y: p.y }, { x: p.x, y: p.y - h }, K(C, 5), 1);
            }
          } else {
            // ruin: jade shards flung out and up
            for (let i = 0; i < 14; i++) {
              const a = (i / 14) * TAU + hash(i) * 0.5, d = rr * (0.5 + 0.6 * hash(i + 20)) * e;
              const p = toScreen(tx + Math.cos(a) * d, ty + Math.sin(a) * d, Math.sin(Math.PI * e) * (0.8 + hash(i + 7)));
              if (fade > 0.15) { P(p.x, p.y, K(C, 2), 3); P(p.x, p.y, K(C, 5), 1); }
            }
          }
          return true;
        }
        const dur = fx.duration || 12, el = progress * dur;
        const draw = clamp01(el / 0.4), armed = el > 0.4;
        const life = clamp01((dur - el) / 0.6);
        // fading out at the end: it flickers away
        if (life < 1 && hash(Math.floor(time * 20)) > life) return true;
        const breathe = armed ? 0.5 + 0.5 * Math.sin(time * 4 + tx) : 0;
        const lvl = 5 + breathe;
        const spin = time * 0.35 + tx;
        // the reach of the burst, faint and dotted, once it is armed
        if (armed) { ring(tx, ty, rr, C, 3.3 + breathe, 1, 0.68); motes(tx, ty, rr, 5, C, life * 0.8, 71); }
        circle(tx, ty, r, fx.kind, C, draw, lvl, spin, 3);
        // the chisel: a spark riding the carving
        if (draw < 1) { const p = W(tx, ty, r, spin + TAU * draw); P(p.x, p.y, K(C, 6), 3); }
        if (armed) {
          motes(tx, ty, r, 6, C, life, 17);
          // the heart rune hovering over the glyph
          const p = toScreen(tx, ty, 0.9 + 0.12 * Math.sin(time * 2.5 + tx));
          uprightRune(p, HEART[fx.kind] !== undefined ? HEART[fx.kind] : 4, 9 * z, C, 4 + breathe);
        }
        return true;
      }

      // ---- INVOCATION: a circle under the knight, ley beams out to every glyph
      case 'invoke': {
        const r = Math.max(1.2, (fx.radius || 3) * 0.5);
        circle(tx, ty, r, 'ruin', INK.jade, out3(seg(0, 0.2)), 6 - progress * 2, time * 1.2, 11);
        if (progress < 0.3) beam(toScreen(tx, ty, 0), 90 * z * (1 - progress / 0.3), 2, INK.jade, 1 - progress / 0.3);
        // a great rune above the knight
        const big = toScreen(tx, ty, 2.6 + 0.3 * out3(seg(0, 0.3)));
        if (fade > 0.1) uprightRune(big, 4, 18 * z * out3(seg(0, 0.2)), INK.jade, 6 - progress * 2);
        const pts = fx.points || [];
        pts.forEach((g, i) => {
          const k = out3(clamp01((progress - i * 0.09) / 0.3));
          if (k <= 0) return;
          const a = toScreen(tx, ty, 1.2), b = toScreen(g.x, g.y, 0.1);
          const n = 14, head = Math.round(n * k);
          let prev = a;
          for (let j = 1; j <= head; j++) {
            const u = j / n, q = { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) - Math.sin(Math.PI * u) * 30 * z };
            if (fade > 0.2) glow(prev, q, INK.jade, 5, 1);
            prev = q;
          }
          if (k < 1) P(prev.x, prev.y, K(INK.jade, 6), 3);
          else if (progress - i * 0.09 < 0.5) flash(b, 14 * z, INK.jade, 1 - (progress - i * 0.09 - 0.3) / 0.2);
        });
        if (!pts.length) motes(tx, ty, r, 8, INK.jade, fade, 5);
        return true;
      }

      // ---- RUNIC BLADEWAVE: a crescent of light that burns a line of runes into the ground
      case 'line': {
        const dx = tx - sx, dy = ty - sy, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
        const w = (fx.width || 1.3) * 0.9;
        const k = out3(seg(0, 0.45));
        const hx = sx + dx * k, hy = sy + dy * k;
        // the burned trail: two rails and a rune every 0.9 tiles, fading after the wave
        const rail = (side) => {
          const ox = -uy * w * side, oy = ux * w * side, n = Math.max(2, Math.round(len * k * 3));
          for (let j = 0; j < n; j++) {
            if ((j + Math.floor(time * 12)) % 3 === 0) continue;       // dashes running along it
            const f0 = (j / n) * k, f1 = ((j + 0.7) / n) * k;
            glow(toScreen(sx + dx * f0 + ox, sy + dy * f0 + oy, 0), toScreen(sx + dx * f1 + ox, sy + dy * f1 + oy, 0), INK.jade, 3 + fade * 2.5, 1);
          }
        };
        rail(-0.7); rail(0.7);
        const n = Math.floor(len / 0.9);
        for (let i = 1; i <= n; i++) {
          const f = (i * 0.9) / len;
          if (f > k) break;
          const age = clamp01((progress - f * 0.45) / 0.55);
          if (hash(i * 7) > 1 - age * 0.8 && age > 0.4) continue;      // runes crumble away one by one
          flatRune(sx + dx * f, sy + dy * f, i * 3 + 1, 0.6, Math.atan2(uy, ux), INK.jade, 6 - age * 3);
        }
        // the crescent: an arc across the line, bowed forward, with a hot edge
        if (progress < 0.6) {
          const bow = 0.7, env = 1 - seg(0.45, 0.6);
          const N = 10;
          let prev = null;
          for (let j = 0; j <= N; j++) {
            const t = j / N - 0.5, off = t * 2 * w * 1.3, fwd = bow * (1 - 4 * t * t);
            const q = toScreen(hx - uy * off + ux * fwd, hy + ux * off + uy * fwd, 0.5);
            if (prev && env > 0.05) { Ln(prev, q, K(INK.jade, 3), 6); Ln(prev, q, K(INK.jade, 5), 3); Ln(prev, q, K(INK.jade, 6), 1); }
            prev = q;
          }
          flash(toScreen(hx + ux * bow, hy + uy * bow, 0.5), 10 * z, INK.jade, env * 0.8);
        }
        if (progress > 0.4 && progress < 0.7) flash(toScreen(tx, ty, 0.4), 18 * z, INK.jade, 1 - seg(0.4, 0.7));
        return true;
      }

      // ---- RUNIC STEP: the circle folds up where you were and opens where you land
      case 'blink': {
        const r = Math.max(0.8, (fx.radius || 2) * 0.45);
        const close = 1 - out3(seg(0, 0.4)), open = out3(seg(0.1, 0.45));
        if (close > 0.05) circle(sx, sy, r * close, 'ruin', INK.jade, 1, 5, time * 2, 7);
        circle(tx, ty, r * (0.4 + 0.6 * open), 'ruin', INK.jade, open, 6 - progress * 2, -time * 2, 21);
        // a trail of runes hanging in the air between the two
        for (let i = 1; i <= 4; i++) {
          const u = i / 5, appear = clamp01(progress * 4 - u);
          if (appear <= 0 || fade < 0.1) continue;
          uprightRune(toScreen(lerp(sx, tx, u), lerp(sy, ty, u), 0.9 + 0.2 * Math.sin(time * 3 + i)), i * 3, 8 * z, INK.jade, 5 - progress * 3);
        }
        if (progress < 0.25) { flash(toScreen(tx, ty, 0.4), 22 * z, INK.jade, 1 - progress / 0.25); beam(toScreen(tx, ty, 0), 70 * z * (1 - progress / 0.25), 2, INK.jade, 1 - progress / 0.25); }
        if (fx.radius) ring(tx, ty, fx.radius * out3(seg(0.05, 0.6)), INK.jade, 5.5 - progress * 3.5, 1, 0.3);
        return true;
      }

      // ---- LEY CHAIN: a sinuous ley line threading through the targets
      case 'chain': {
        const pts = fx.points || [];
        if (!pts.length) return true;
        let px0 = sx, py0 = sy;
        const show = pts.length * out3(seg(0, 0.45));
        for (let i = 0; i < pts.length; i++) {
          const part = clamp01(show - i);
          if (part <= 0) break;
          const p1 = pts[i], dx = p1.x - px0, dy = p1.y - py0, L2 = Math.hypot(dx, dy) || 1;
          const nx = -dy / L2, ny = dx / L2, N = 16;
          let prev = toScreen(px0, py0, 0.6);
          for (let j = 1; j <= Math.round(N * part); j++) {
            const u = j / N, wob = Math.sin(u * Math.PI * 2 + time * 6 + i) * 0.25 * Math.sin(u * Math.PI);
            const q = toScreen(px0 + dx * u + nx * wob, py0 + dy * u + ny * wob, 0.6);
            if (fade > 0.1) glow(prev, q, INK.jade, 5, 1);
            prev = q;
          }
          if (part >= 1) {
            const local = clamp01(show - i - 1);
            arc(p1.x, p1.y, 0.55, time * 2 + i, TAU, INK.jade, 5 - progress * 2, 1);
            uprightRune(toScreen(p1.x, p1.y, 1.3), i * 4 + 2, 9 * z, INK.jade, 6 - progress * 3);
            if (local < 1) flash(toScreen(p1.x, p1.y, 0.5), 14 * z, INK.jade, 1 - local);
          }
          px0 = p1.x; py0 = p1.y;
        }
        return true;
      }

      // ---- GUARDIAN GLYPH: a ward circle round the knight, rune tablets orbiting
      case 'buff': {
        const r = 1.5;
        circle(tx, ty, r, 'bind', INK.gold, out3(seg(0, 0.3)), 6 - progress * 2, time * 0.8, 13);
        if (progress < 0.3) beam(toScreen(tx, ty, 0), 80 * z * (1 - progress / 0.3), 3, INK.gold, 1 - progress / 0.3);
        // four rune tablets circling at waist height
        const rise = out3(seg(0, 0.35));
        for (let i = 0; i < 4; i++) {
          const a = time * 1.4 + (i / 4) * TAU;
          const p = toScreen(tx + Math.cos(a) * r * 0.9, ty + Math.sin(a) * r * 0.9, 1.0 * rise + 0.15 * Math.sin(time * 3 + i));
          if (fade < 0.1) continue;
          const hw = 5 * z, hh = 7 * z;
          Ln({ x: p.x - hw, y: p.y - hh }, { x: p.x + hw, y: p.y - hh }, K(INK.gold, 3), 1);
          Ln({ x: p.x - hw, y: p.y + hh }, { x: p.x + hw, y: p.y + hh }, K(INK.gold, 3), 1);
          Ln({ x: p.x - hw, y: p.y - hh }, { x: p.x - hw, y: p.y + hh }, K(INK.gold, 3), 1);
          Ln({ x: p.x + hw, y: p.y - hh }, { x: p.x + hw, y: p.y + hh }, K(INK.gold, 3), 1);
          uprightRune(p, i * 3 + 4, 10 * z, INK.gold, 6 - progress * 2);
        }
        motes(tx, ty, r, 10, INK.gold, fade, 31);
        return true;
      }

      // ---- GRAND INSCRIPTION (signature): a great circle inscribed under the target, then it detonates
      case 'blast': {
        const r = fx.radius || 4;
        const carve = out3(seg(0, 0.28));
        const go = seg(0.28, 1);
        if (go <= 0) {
          circle(tx, ty, r * 0.85, 'ruin', INK.jade, carve, 6, time * 0.6, 41);
          circle(tx, ty, r * 0.45, 'ruin', INK.jade, clamp01(carve * 1.3 - 0.3), 5, -time * 0.9, 61);
          return true;
        }
        const e = out3(go);
        circle(tx, ty, lerp(r * 0.85, r * 1.05, e), 'ruin', INK.jade, 1, 6 - go * 4, time * 0.6, 41);
        if (go < 0.4) {
          beam(toScreen(tx, ty, 0), 160 * z * (1 - go / 0.4), 5, INK.jade, 1 - go / 0.4);
          flash(toScreen(tx, ty, 0.4), 40 * z, INK.jade, 1 - go / 0.4);
        }
        ring(tx, ty, r * (0.5 + 0.7 * e), INK.jade, 6 - go * 3.5, go < 0.3 ? 2 : 1, 0.15 + go * 0.5);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU + time * 0.2, d = lerp(r * 0.4, r * 1.2, e);
          if (fade > 0.15) flatRune(tx + Math.cos(a) * d, ty + Math.sin(a) * d, i * 5 + 2, 0.5, a, INK.jade, 6 - go * 4, Math.sin(Math.PI * e) * 1.6);
        }
        return true;
      }

      // ---- RUNIC ECHO (passive): the rune of the echo flashes over the target
      case 'echo': {
        const c = toScreen(tx, ty, 1.3 + progress * 0.6);
        if (fade > 0.05) uprightRune(c, 9, 16 * z, INK.jade, 6 - progress * 2.5);
        arc(tx, ty, 0.4 + 0.6 * out3(progress), time, TAU, INK.jade, 6 - progress * 3, 1);
        if (progress < 0.3) flash(toScreen(tx, ty, 0.6), 12 * z, INK.jade, 1 - progress / 0.3);
        return true;
      }
    }
    return false;
  };
})();
