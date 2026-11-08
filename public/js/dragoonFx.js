// Slop Hero - Dragoon skill visuals (the storm-lance kit in server/spCards.ts).
// Installed onto IsometricRenderer: drawSpSkill hands every Dragoon effect here first.
// Drawn texel by texel with the renderer's pixel motif kit (spMotifs) in the lightning ramp
// (violet -> gold -> white), the lances themselves in gilded silver.
//
//   rod        Lightning Rod      a planted storm lance, crackling, a rune ring at its foot
//   rodStrike  (rod tick/passive) a bolt out of the sky onto a rod (or onto an enemy: Storm Rider)
//   fence      (rod link)         an arc fence crackling between two rods
//   overload   (Skyfall/dive)     a giant bolt column that spends a rod
//   spear      Storm Lance        the thrown lance; the recast Lightning Dive
//   cone       Thunderwing Sweep  a fan of forked lightning across the arc, wing feathers at the rim
//   jump       Skyfall Dive       a storm sigil on the landing spot, then the crash
//   blink      Volt Step          the hero becomes a bolt from one spot to the other
//   chain      Arc Lance / arcs   lightning jumping between targets (or from a rod)
//   blast      Stormcall Standard a bolt calling a rod down at the target
//   rain       Lance Storm        lightning lances dropping out of the sky
//   nova       Tempest Wings / signature thunder nova
(function () {
  'use strict';
  if (!window.IsometricRenderer) return;
  const TAU = Math.PI * 2;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const out3 = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  // the lance: gilded silver
  const LANCE = { dark: '#16224a', shaft: '#6f80a3', lit: '#dfe7f5', gold: '#e0a91c', goldLit: '#fde58a', white: '#ffffff' };

  IsometricRenderer.prototype.drawDragoonSkill = function (ctx, fx, progress, toScreen, z) {
    const M = this.spMotifs(ctx, fx, progress);
    const { R, top, tex, hash } = M;
    const P = M.px;
    const time = this.animations.time;
    const frame = M.frame;
    ctx.globalCompositeOperation = 'source-over';
    const seg = (a, b) => clamp01((progress - a) / (b - a));
    const fade = progress < 0.65 ? 1 : clamp01(1 - (progress - 0.65) / 0.35);
    const sx = fx.startX !== undefined ? fx.startX : fx.x, sy = fx.startY !== undefined ? fx.startY : fx.y;
    const tx = fx.x !== undefined ? fx.x : sx, ty = fx.y !== undefined ? fx.y : sy;
    const flick = (salt) => hash(salt + Math.floor(frame / 2) * 17) > 0.25;   // lightning stutters

    // ---- pieces ----
    // a bolt straight down out of the sky onto (x, y) at height h0
    const skyBolt = (x, y, h0, salt, thick = 1) => {
      const a = toScreen(x, y, 11), b = toScreen(x, y, h0);
      M.bolt(a, b, 1.2, salt);
      if (thick > 1) M.bolt({ x: a.x + 3 * tex, y: a.y }, b, 1.4, salt + 7);
      if (thick > 2) M.bolt({ x: a.x - 4 * tex, y: a.y }, b, 1.6, salt + 13);
    };
    // forked arcs crawling over the ground from the centre
    const groundArcs = (cx, cy, r, n, env, salt) => {
      if (env <= 0.02) return;
      const c = toScreen(cx, cy, 0.05);
      for (let i = 0; i < n; i++) {
        if (!flick(salt + i * 5)) continue;
        const a = (i / n) * TAU + hash(salt + i) * 0.6, d = r * env * (0.6 + 0.4 * hash(salt + i + 30));
        M.bolt(c, toScreen(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.05), 0.7, salt + i * 11);
      }
    };
    // an expanding shock ring on the ground
    const shock = (cx, cy, r, e) => {
      if (e <= 0 || e >= 1) return;
      M.ellipse(cx, cy, r * out3(e), R(top - Math.round(e * 3)), e < 0.4 ? 2 : 1, 0.06 + e * 0.4);
    };
    // sparks thrown up from a point, falling back
    const sparks = (cx, cy, n, dist, e, salt) => {
      if (e <= 0 || e >= 1) return;
      const c = toScreen(cx, cy, 0.4), D = dist * 32 * Math.SQRT2 * z;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + hash(salt + i) * 0.8, d = D * (0.35 + 0.65 * hash(salt + i + 20)) * out3(e);
        const q = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.55 - Math.sin(Math.PI * e) * D * 0.35 + e * e * D * 0.25 };
        P(q.x, q.y, R(top - Math.round(e * 3)), e < 0.4 ? 2 : 1);
      }
    };
    // a hexagram-and-ring storm sigil on the ground
    const sigil = (cx, cy, r, rot, env) => {
      if (env <= 0.02) return;
      M.ellipse(cx, cy, r, R(top - 1), 1, 0.12);
      M.ellipse(cx, cy, r * 0.72, R(3), 1, 0.5);
      for (let k = 0; k < 2; k++) {
        const pts = [0, 1, 2].map(j => { const a = rot + k * Math.PI / 3 + j * TAU / 3; return toScreen(cx + Math.cos(a) * r * 0.72 * env, cy + Math.sin(a) * r * 0.72 * env, 0); });
        for (let j = 0; j < 3; j++) M.line(pts[j], pts[(j + 1) % 3], R(4), 1);
      }
    };
    // the planted storm lance at (x, y), lifted by h (it falls out of the sky); env fades it
    const lanceAt = (x, y, h, env) => {
      const g = toScreen(x, y, h), t = toScreen(x + 0.1, y - 0.1, h + 2.1);
      const at = (k) => ({ x: g.x + (t.x - g.x) * k, y: g.y + (t.y - g.y) * k });
      const n = env < 1 ? Math.max(0, Math.round(env * 4)) : 4;
      if (n <= 0) return;
      M.line(g, t, LANCE.dark, 3);
      M.line(g, t, LANCE.shaft, 2);
      M.line({ x: g.x - tex, y: g.y }, { x: t.x - tex, y: t.y }, LANCE.lit, 1);
      // winged crossguard just above the ground (the blade is buried)
      const w = at(0.16);
      for (const sgn of [-1, 1]) {
        M.line(w, { x: w.x + sgn * 5 * tex, y: w.y - 3 * tex }, LANCE.gold, 2);
        M.line({ x: w.x + sgn * 2 * tex, y: w.y - 2 * tex }, { x: w.x + sgn * 6 * tex, y: w.y - 5 * tex }, LANCE.goldLit, 1);
      }
      P(w.x, w.y, LANCE.goldLit, 2);
      // gold bands up the shaft and a storm crystal at the top
      for (const k of [0.45, 0.72]) { const b = at(k); M.line({ x: b.x - 2 * tex, y: b.y }, { x: b.x + 2 * tex, y: b.y }, LANCE.gold, 1); }
      P(t.x, t.y - tex, LANCE.gold, 3);
      P(t.x, t.y - 2 * tex, R(top - 1), 2);
      P(t.x, t.y - 2 * tex, LANCE.white, 1);
      return t;
    };
    // crackle round a point: two tiny bolts in random directions every couple of frames
    const crackle = (p, size, salt) => {
      for (let i = 0; i < 2; i++) {
        if (!flick(salt + i * 3)) continue;
        const a = hash(salt + i + Math.floor(frame / 2) * 5) * TAU;
        M.bolt(p, { x: p.x + Math.cos(a) * size * tex, y: p.y + Math.sin(a) * size * 0.7 * tex }, 0.5, salt + i * 9);
      }
    };

    switch (fx.shape) {
      // ---- LIGHTNING ROD: a planted lance that crackles until the storm takes it
      case 'rod': {
        const dur = fx.duration || 8, el = progress * dur;
        if (fx.thrown && el < 0.2) return true;                          // still in flight (Storm Lance)
        const drop = fx.thrown ? 1 : out3(el / 0.2);
        const env = clamp01((dur - el) / 0.45);
        // rune ring at its foot, breathing
        const breathe = 0.5 + 0.5 * Math.sin(time * 4 + (fx.x || 0));
        M.ellipse(tx, ty, 0.62 + 0.06 * breathe, R(3 + Math.round(breathe)), 1, 0.45);
        if (Math.floor(time * 6 + tx) % 4 === 0) M.ellipse(tx, ty, 0.95, R(2), 1, 0.7);
        const tip = lanceAt(tx, ty, (1 - drop) * 7, env);
        if (!fx.thrown && el < 0.35) {
          if (el < 0.22) skyBolt(tx, ty, (1 - drop) * 7 + 2, 3);
          if (el > 0.18) { M.hit(tx, ty, 1.3, 1 - clamp01((el - 0.18) / 0.17)); shock(tx, ty, 1.4, (el - 0.18) / 0.4); }
        }
        if (tip && env > 0.3) crackle(tip, 6, 41);
        return true;
      }

      // ---- the sky striking a rod (or an enemy: the Storm Rider passive)
      case 'rodStrike': {
        const h0 = fx.sky ? 0.2 : 2.3;
        if (progress < 0.42 && flick(5)) skyBolt(tx, ty, h0, 9, fx.sky ? 1 : 2);
        if (progress < 0.3) M.hit(tx, ty, fx.sky ? 0.9 : 1.2, 1 - progress / 0.3);
        shock(tx, ty, fx.radius || 1.6, seg(0.05, 0.7));
        groundArcs(tx, ty, (fx.radius || 1.6) * 0.9, fx.sky ? 3 : 5, (1 - progress) * 0.9, 21);
        return true;
      }

      // ---- the arc fence between two rods: a doubled bolt between their tips, sparks at the ground
      case 'fence': {
        const a = toScreen(sx, sy, 1.9), b = toScreen(tx, ty, 1.9);
        if (fade > 0.1 && flick(3)) M.bolt(a, b, 1.1, 5);
        if (fade > 0.3 && flick(11)) M.bolt(a, b, 1.6, 23);
        const ga = toScreen(sx, sy, 0.05), gb = toScreen(tx, ty, 0.05);
        const n = Math.max(3, Math.round(Math.hypot(gb.x - ga.x, gb.y - ga.y) / (5 * tex)));
        for (let j = 1; j < n; j++) if (hash(j * 7 + Math.floor(frame / 2)) < 0.4 * fade) P(ga.x + (gb.x - ga.x) * j / n, ga.y + (gb.y - ga.y) * j / n, R(top - 1), 2);
        return true;
      }

      // ---- OVERLOAD: a column of bolts swallows the rod
      case 'overload': {
        const r = fx.radius || 2.4;
        if (progress < 0.32) {
          const g = toScreen(tx, ty, 0);
          M.pillar(g.x, g.y, 120 * z * (1 - progress / 0.32), 3, 1 - progress / 0.32);
          skyBolt(tx, ty, 0, 31, 3);
        }
        if (progress < 0.2) M.hit(tx, ty, 2.2, 1 - progress / 0.2);
        shock(tx, ty, r * 1.15, seg(0, 0.45));
        shock(tx, ty, r * 0.7, seg(0.08, 0.55));
        groundArcs(tx, ty, r, 9, fade, 51);
        sparks(tx, ty, 18, r * 0.9, seg(0.1, 0.95), 7);
        return true;
      }

      // ---- STORM LANCE: the throw (flight, then a wake of lightning), or the recast Lightning Dive
      case 'spear': {
        if (fx.dive) {
          const k = out3(seg(0, 0.3));
          const a = toScreen(sx, sy, 0.8), b = toScreen(tx, ty, 0.3);
          const m = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - Math.sin(Math.PI * k) * 40 * z };
          if (progress < 0.45 && flick(2)) { M.bolt(a, m, 1.3, 3); M.bolt(m, b, 0.8, 9); }
          if (progress > 0.2 && progress < 0.4) M.hit(tx, ty, 1.8, 1 - seg(0.2, 0.4));
          shock(tx, ty, (fx.radius || 2.6) * 1.1, seg(0.2, 0.7));
          groundArcs(tx, ty, fx.radius || 2.6, 7, 1 - seg(0.2, 1), 61);
          return true;
        }
        const dur = fx.duration || 4, el = progress * dur;
        const k = clamp01(el / 0.2);
        if (k < 1) {
          // the lance in flight, nose first, a streak of lightning behind it
          const x = sx + (tx - sx) * out3(k), y = sy + (ty - sy) * out3(k);
          const head = toScreen(x, y, 0.9), d = Math.hypot(tx - sx, ty - sy) || 1;
          const tail = toScreen(x - (tx - sx) / d * 1.6, y - (ty - sy) / d * 1.6, 0.9);
          M.line(tail, head, LANCE.dark, 3); M.line(tail, head, LANCE.lit, 1);
          P(head.x, head.y, R(top), 2);
          M.bolt(toScreen(sx, sy, 0.9), tail, 0.6, 7);
          return true;
        }
        // the lightning wake along the throw fades out
        if (el < 0.45 && flick(4)) M.bolt(toScreen(sx, sy, 0.6), toScreen(tx, ty, 0.6), 0.9, 13);
        // dive ready: chevrons pulse above the lance while a recast is possible
        if (fx.ownerId && el < dur - 0.1 && Math.floor(time * 4) % 2 === 0) {
          const c = toScreen(tx, ty, 3);
          for (const off of [0, 3]) {
            M.line({ x: c.x - 3 * tex, y: c.y + (off - 2) * tex }, { x: c.x, y: c.y + (off + 1) * tex }, R(top - 1), 1);
            M.line({ x: c.x + 3 * tex, y: c.y + (off - 2) * tex }, { x: c.x, y: c.y + (off + 1) * tex }, R(top - 1), 1);
          }
        }
        return true;
      }

      // ---- THUNDERWING SWEEP: forked lightning fans across the arc, feathers of light at its rim
      case 'cone': {
        const range = fx.range || 4.2, half = ((fx.arc || 150) * Math.PI) / 360;
        const base = Math.atan2(fx.dirY || 0, fx.dirX || 1);
        const sweep = out3(seg(0, 0.35));
        const n = 9;
        const o = toScreen(sx, sy, 0.6);
        for (let i = 0; i < n; i++) {
          const f = i / (n - 1);
          if (f > sweep + 0.001) break;
          if (!flick(i * 13 + 1) || fade < 0.15) continue;
          const a = base - half + 2 * half * f, d = range * (0.75 + 0.25 * hash(i + 9));
          M.bolt(o, toScreen(sx + Math.cos(a) * d, sy + Math.sin(a) * d, 0.3), 0.9, i * 19);
        }
        // the wing: a crescent of feathers along the rim
        const a0 = base - half, a1 = base - half + 2 * half * sweep;
        const steps = Math.max(6, Math.round(range * 8 * sweep));
        let prev = null;
        for (let i = 0; i <= steps; i++) {
          const a = a0 + (a1 - a0) * (i / steps);
          const q = toScreen(sx + Math.cos(a) * range, sy + Math.sin(a) * range, 0.15);
          if (prev && hash(i * 5 + Math.floor(frame / 2)) < 0.8 * fade + 0.1) M.line(prev, q, R(top - 1), 2);
          prev = q;
        }
        for (let i = 0; i <= 12; i++) {
          const a = a0 + (a1 - a0) * (i / 12);
          if (hash(i * 3) > fade) continue;
          const p = toScreen(sx + Math.cos(a) * range, sy + Math.sin(a) * range, 0.2);
          const q = toScreen(sx + Math.cos(a - 0.12) * range * 0.82, sy + Math.sin(a - 0.12) * range * 0.82, 0.5);
          M.line(p, q, R(i % 2 ? 4 : top - 1), 1);
        }
        return true;
      }

      // ---- SKYFALL DIVE / signature: a storm sigil marks the landing, then the hero comes down as lightning
      case 'jump': {
        const r = fx.radius || 3;
        if (!fx.landed) {
          const k = out3(seg(0, 0.5));
          sigil(tx, ty, r * (0.55 + 0.45 * k), time * 1.4, k);
          // bolts converging on the centre from the sigil's rim
          for (let i = 0; i < 3; i++) {
            if (!flick(i * 7)) continue;
            const a = time * 2 + i * TAU / 3;
            M.bolt(toScreen(tx + Math.cos(a) * r, ty + Math.sin(a) * r, 0.05), toScreen(tx, ty, 0.05), 0.6, i * 23);
          }
          return true;
        }
        if (progress < 0.25) skyBolt(tx, ty, 0, 71, 3);
        if (progress < 0.16) M.hit(tx, ty, 2.6, 1 - progress / 0.16);
        shock(tx, ty, r * 1.35, seg(0, 0.4));
        shock(tx, ty, r * 0.85, seg(0.08, 0.5));
        groundArcs(tx, ty, r * 1.05, 12, fade, 81);
        sparks(tx, ty, 22, r, seg(0.05, 0.9), 13);
        return true;
      }

      // ---- VOLT STEP: the hero is a bolt between the two spots
      case 'blink': {
        const a = toScreen(sx, sy, 0.8), b = toScreen(tx, ty, 0.8);
        if (progress < 0.4 && flick(1)) { M.bolt(a, b, 1.1, 5); M.bolt(a, b, 0.6, 17); }
        const r = fx.radius || 1.8;
        if (progress < 0.25) {
          if (fx.origin) M.hit(sx, sy, 1.3, 1 - progress / 0.25);
          M.hit(tx, ty, 1.5, 1 - progress / 0.25);
        }
        if (fx.origin) shock(sx, sy, r, seg(0, 0.6));
        shock(tx, ty, r * 1.1, seg(0.05, 0.65));
        groundArcs(tx, ty, r, 5, fade, 91);
        return true;
      }

      // ---- ARC LANCE / rod arcs: lightning hopping target to target
      case 'chain': {
        const pts = fx.points || [];
        if (!pts.length) return true;
        let prev = fx.fromRod ? toScreen(sx, sy, 1.9) : toScreen(sx, sy, 0.9);
        const show = Math.ceil(pts.length * out3(seg(0, 0.4)));
        for (let i = 0; i < show; i++) {
          const q = toScreen(pts[i].x, pts[i].y, 0.6);
          if (fade > 0.1 && flick(i * 5 + 3)) M.bolt(prev, q, 0.9, i * 29);
          const local = clamp01(progress * 4 - i * 0.4);
          if (local < 1) M.hit(pts[i].x, pts[i].y, 0.9, 1 - local);
          prev = q;
        }
        return true;
      }

      // ---- STORMCALL STANDARD: the sky answers at the target
      case 'blast': {
        const r = fx.radius || 2.4;
        if (progress < 0.3 && flick(6)) skyBolt(tx, ty, 0, 101, 2);
        if (progress < 0.18) M.hit(tx, ty, 1.8, 1 - progress / 0.18);
        sigil(tx, ty, r * 0.9, time, fade);
        shock(tx, ty, r * 1.1, seg(0, 0.5));
        groundArcs(tx, ty, r, 7, fade, 111);
        return true;
      }

      // ---- LANCE STORM / signature rain: lightning lances out of the sky
      case 'rain': {
        const r = fx.radius || 1.2;
        if (fx.areaR && progress < 0.6) M.ellipse(fx.areaX, fx.areaY, fx.areaR, R(3), 1, 0.65);
        if (progress < 0.3) {
          const k = progress / 0.3, h = 9 * (1 - k * k);
          const hd = toScreen(tx, ty, h), tl = toScreen(tx, ty, h + 2.4);
          M.line(tl, hd, LANCE.dark, 3); M.line(tl, hd, LANCE.lit, 1);
          P(hd.x, hd.y, R(top), 2);
          if (flick(3)) M.bolt(toScreen(tx, ty, 11), tl, 0.8, 3 + (fx.wave || 0));
          return true;
        }
        const k = seg(0.3, 1);
        if (k < 0.25) M.hit(tx, ty, 1.2, 1 - k / 0.25);
        shock(tx, ty, r * 1.2, k);
        groundArcs(tx, ty, r, 4, 1 - k, 121 + (fx.wave || 0) * 7);
        if (k < 0.7) lanceAt(tx, ty, -0.6, 1 - k / 0.7);
        return true;
      }

      // ---- TEMPEST WINGS / signature nova: a thunder ring; the wings beat out of the hero's back
      case 'nova':
      case 'pulse': {
        const r = fx.radius || 3.4;
        if (progress < 0.14) M.hit(tx, ty, 2, 1 - progress / 0.14);
        shock(tx, ty, r * 1.1, seg(0, 0.45));
        shock(tx, ty, r * 0.7, seg(0.1, 0.55));
        groundArcs(tx, ty, r, 10, fade, 131);
        if (fx.skillId === 'sp_dragoon_tempest_wings') {
          // two wings of lightning spreading up and out, feather by feather
          const spread = out3(seg(0, 0.4)), o = toScreen(tx, ty, 1.4);
          for (const sgn of [-1, 1]) {
            for (let i = 0; i < 5; i++) {
              if (hash(i + (sgn > 0 ? 10 : 0)) > fade + 0.2) continue;
              const a = -Math.PI / 2 + sgn * (0.5 + i * 0.32) * spread;
              const len = (34 - i * 4) * z * spread;
              const tip = { x: o.x + Math.cos(a) * len * 1.3, y: o.y + Math.sin(a) * len * 0.8 };
              if (flick(i * 7 + (sgn > 0 ? 3 : 0))) M.bolt(o, tip, 0.5, i * 13 + (sgn > 0 ? 50 : 0));
              P(tip.x, tip.y, R(top), 2);
            }
          }
        }
        sparks(tx, ty, 16, r * 0.8, seg(0.05, 0.9), 17);
        return true;
      }
    }
    return false;
  };
})();
