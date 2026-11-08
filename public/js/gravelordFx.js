// Slop Hero - Gravelord: Raise the Fallen and its minions crumbling away (server: castSpSkill
// 'raise', GameServer.raiseMinion / crumbleMinion). The rest of the Gravelord kit keeps the
// shared variant-warrior visuals: this returns false for any other shape.
//
//   raise    the grave opens under every corpse: the earth cracks in a star, a pillar of grave
//            light goes up, clods are thrown out, and a ring marks how far the call reached
//   crumble  a minion's time is up: it falls into bone dust and its soul wisps scatter
//   rage     Grave Frenzy: the Gravelord roars, a shockwave rolls out, grave fire lashes to every minion
//   gravebomb Corpse Detonation: soul tethers snap taut to every minion; each then bursts in grave fire
(function () {
  'use strict';
  if (!window.IsometricRenderer) return;
  const TAU = Math.PI * 2;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const out3 = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  // grave light, dark to white
  const G = ['#03110a', '#0b2a17', '#14532d', '#22a35a', '#4ade80', '#bbf7d0', '#f0fff4'];
  const EARTH = ['#1a120a', '#3b2a18', '#5c4426', '#83653d'];
  const BONE = ['#4a4436', '#a39a7f', '#d9d0b2', '#f5efdc'];
  const K = (ramp, i) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(i)))];

  IsometricRenderer.prototype.drawGravelordSkill = function (ctx, fx, progress, toScreen, z) {
    if (fx.shape !== 'raise' && fx.shape !== 'crumble' && fx.shape !== 'rage' && fx.shape !== 'gravebomb') return false;
    const M = this.spMotifs(ctx, fx, progress);
    const { tex, hash } = M;
    const P = M.px, Ln = M.line;
    const time = this.animations.time;
    ctx.globalCompositeOperation = 'source-over';
    const seg = (a, b) => clamp01((progress - a) / (b - a));
    const fade = progress < 0.65 ? 1 : clamp01(1 - (progress - 0.65) / 0.35);
    const tx = fx.x, ty = fx.y;

    // a column of grave light rising from screen point p
    const pillar = (p, hp, w, env) => {
      if (env <= 0.02 || hp < 2) return;
      const rows = Math.round(hp / tex);
      for (let r = 0; r < rows; r++) {
        const t = r / rows;
        if (hash(r * 5 + Math.floor(time * 24)) > env * (1 - t * 0.85)) continue;
        const half = Math.max(0, Math.round(w * (1 - t * 0.6)));
        for (let i = -half; i <= half; i++) {
          const e = half ? Math.abs(i) / half : 0;
          P(p.x + i * tex, p.y - r * tex, K(G, e < 0.35 ? 6 : e < 0.7 ? 5 : 3));
        }
      }
    };
    // the earth cracks open in a star round (x, y)
    const cracks = (x, y, r, env, salt) => {
      if (env <= 0.02) return;
      const c = toScreen(x, y, 0);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + hash(salt + i) * 0.6, d = r * env * (0.6 + 0.4 * hash(salt + i + 9));
        const mid = toScreen(x + Math.cos(a + 0.2) * d * 0.5, y + Math.sin(a + 0.2) * d * 0.5, 0);
        const end = toScreen(x + Math.cos(a) * d, y + Math.sin(a) * d, 0);
        Ln(c, mid, K(EARTH, 0), 2); Ln(mid, end, K(EARTH, 0), 1);
        Ln({ x: c.x, y: c.y - tex }, { x: mid.x, y: mid.y - tex }, K(G, 4), 1);
        P(end.x, end.y, K(G, 3));
      }
    };
    // clods and bone bits thrown up out of the grave
    const clods = (x, y, n, dist, e, salt) => {
      if (e <= 0 || e >= 1) return;
      const c = toScreen(x, y, 0.2), D = dist * 32 * Math.SQRT2 * z;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + hash(salt + i) * 0.7, d = D * (0.4 + 0.6 * hash(salt + i + 20)) * out3(e);
        const q = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.55 - Math.sin(Math.PI * e) * D * 0.5 + e * e * D * 0.3 };
        const bone = i % 4 === 0;
        P(q.x, q.y, bone ? K(BONE, 3 - e * 2) : K(EARTH, 3 - e * 2), bone ? 2 : 3);
      }
    };

    // a soul tether from the Gravelord (h 1.4) to a minion, writhing
    const tether = (p, i, lvl, k) => {
      const a = toScreen(tx, ty, 1.4), b = toScreen(p.x, p.y, 0.6);
      const n = 12, m = Math.round(n * k);
      let prev = a;
      for (let j = 1; j <= m; j++) {
        const u = j / n, w = Math.sin(u * Math.PI * 3 + time * 14 + i) * 5 * z * Math.sin(u * Math.PI);
        const q = { x: a.x + (b.x - a.x) * u + w, y: a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * 18 * z };
        Ln(prev, q, K(G, lvl - 2), 3); Ln(prev, q, K(G, lvl), 1);
        prev = q;
      }
    };

    if (fx.shape === 'rage') {
      const r = fx.radius || 3;
      // the roar: twin shock rings and a burst of grave light round the Gravelord
      for (const [d, w] of [[0, 2], [0.12, 1]]) {
        const e = clamp01((progress - d) / 0.45);
        if (e > 0 && e < 1) M.ellipse(tx, ty, r * out3(e), K(G, 6 - e * 3), w, 0.08 + e * 0.4);
      }
      const c = toScreen(tx, ty, 0);
      if (progress < 0.35) pillar(c, 80 * z * (1 - progress / 0.35), 2, 1 - progress / 0.35);
      // grave fire licking up round him
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + time, rr = r * 0.4;
        const q = toScreen(tx + Math.cos(a) * rr, ty + Math.sin(a) * rr, 0);
        const h = (8 + 10 * hash(i + Math.floor(time * 12))) * z * fade;
        Ln(q, { x: q.x + Math.sin(time * 9 + i) * 2 * z, y: q.y - h }, K(G, 4), 2);
        P(q.x, q.y - h, K(G, 6), 1);
      }
      // and a lash of it to every minion
      (fx.points || []).forEach((p, i) => {
        if (progress < 0.6) tether(p, i, 6 - progress * 3, out3(progress / 0.25));
        if (progress > 0.15 && progress < 0.45) {
          const q = toScreen(p.x, p.y, 0.5), e = 1 - (progress - 0.15) / 0.3;
          for (let j = 0; j < 6; j++) { const a = (j / 6) * TAU; Ln(q, { x: q.x + Math.cos(a) * 14 * z * e, y: q.y + Math.sin(a) * 7 * z * e }, K(G, 5), 1); }
        }
      });
      return true;
    }

    if (fx.shape === 'gravebomb') {
      const r = fx.radius || 2.2;
      if (!fx.burst) {
        // the cast: tethers snap taut to every minion, the ones about to blow
        (fx.points || []).forEach((p, i) => { if (progress < 0.5) tether(p, i, 6 - progress * 4, out3(progress / 0.15)); });
        return true;
      }
      // one minion going up: a flash, a fireball of grave light, a smoke ring, bones flung out
      const c = toScreen(tx, ty, 0.4);
      if (progress < 0.2) {
        const e = 1 - progress / 0.2;
        ctx.fillStyle = K(G, 6);
        ctx.beginPath(); ctx.arc(Math.round(c.x), Math.round(c.y), 14 * z * (1.2 - e * 0.4), 0, TAU); ctx.fill();
        for (let j = 0; j < 10; j++) { const a = (j / 10) * TAU; Ln(c, { x: c.x + Math.cos(a) * 36 * z * e, y: c.y + Math.sin(a) * 20 * z * e }, K(G, j % 2 ? 5 : 6), 1); }
      }
      // the fireball, layered and dithered, rising as it cools
      const fb = clamp01(progress / 0.55);
      if (fb < 1) {
        const R = r * 32 * Math.SQRT2 * z * 0.5 * out3(fb), lift = fb * 18 * z;
        const steps = Math.max(6, Math.round(R / tex));
        for (let y = -steps; y <= steps; y++) for (let x = -steps; x <= steps; x++) {
          const d = Math.hypot(x, y * 1.4) / steps;
          if (d > 1 || hash(x * 31 + y * 17 + Math.floor(time * 20)) > (1 - fb) * (1.1 - d * 0.6)) continue;
          P(c.x + x * tex, c.y - lift + y * tex * 0.7, K(G, 6 - d * 3 - fb * 2.5));
        }
      }
      if (progress > 0.05) M.ellipse(tx, ty, r * out3(seg(0.05, 0.6)), K(G, 5 - seg(0.05, 0.9) * 3), 2, 0.15 + progress * 0.4);
      cracks(tx, ty, r * 0.9, out3(progress / 0.2) * fade, 91);
      clods(tx, ty, 16, r * 0.8, clamp01(progress / 0.85), 57);
      return true;
    }

    if (fx.shape === 'crumble') {
      const c = toScreen(tx, ty, 0);
      // bone dust settling, wisps flying off
      for (let i = 0; i < 14; i++) {
        const a = hash(i) * TAU, d = (6 + 14 * hash(i + 5)) * z * out3(progress);
        const q = { x: c.x + Math.cos(a) * d, y: c.y - 10 * z + Math.sin(a) * d * 0.5 + progress * 12 * z };
        if (hash(i + 30) < fade) P(q.x, q.y, K(BONE, 3 - progress * 2), 2);
      }
      for (let i = 0; i < 5; i++) {
        const q = { x: c.x + Math.sin(i * 2.1 + time * 3) * 8 * z, y: c.y - (14 + progress * 50 + i * 5) * z };
        if (fade > 0.1) P(q.x, q.y, K(G, 6 - progress * 3 - (i % 2)), 2);
      }
      M.ellipse(tx, ty, 0.5 * (1 - progress) + 0.2, K(G, 4 - progress * 2), 1, 0.4);
      return true;
    }

    // ---- RAISE THE FALLEN
    const pts = fx.points && fx.points.length ? fx.points : [{ x: tx, y: ty }];
    // the call's reach, once, on the ground at the cursor
    if (progress < 0.5) M.ellipse(tx, ty, (fx.radius || 5) * out3(seg(0, 0.25)), K(G, 4 - seg(0, 0.5) * 3), 1, 0.55);
    pts.forEach((p, i) => {
      const local = clamp01(progress - i * 0.06);
      const c = toScreen(p.x, p.y, 0);
      // the grave: a dark pit with a grave-light rim
      const open = out3(local / 0.2) * (local < 0.7 ? 1 : clamp01(1 - (local - 0.7) / 0.3));
      if (open > 0.02) {
        ctx.fillStyle = K(G, 0);
        const rx = 15 * z * open, ry = 7 * z * open;
        ctx.beginPath(); ctx.ellipse(Math.round(c.x), Math.round(c.y), rx, ry, 0, 0, TAU); ctx.fill();
        M.ellipse(p.x, p.y, 0.48 * open, K(G, 4 + Math.sin(time * 8) * 0.5), 1, 0.15);
      }
      cracks(p.x, p.y, 1.3, out3(local / 0.25) * fade, i * 17);
      if (local < 0.45) pillar(c, 110 * z * (1 - local / 0.45), 3, 1 - local / 0.45);
      clods(p.x, p.y, 14, 1.1, clamp01((local - 0.05) / 0.7), i * 31);
      // a burst of grave light at the rim as it opens
      if (local < 0.2) {
        const e = 1 - local / 0.2;
        for (let j = 0; j < 8; j++) {
          const a = (j / 8) * TAU, len = 22 * z * e;
          Ln(c, { x: c.x + Math.cos(a) * len, y: c.y + Math.sin(a) * len * 0.5 }, K(G, j % 2 ? 4 : 5), 1);
        }
      }
      // souls spiralling up out of the grave
      for (let j = 0; j < 5; j++) {
        const ph = (local * 1.4 + j * 0.18) % 1, a = j * 1.3 + time * 3;
        const q = { x: c.x + Math.cos(a) * 9 * z * (1 - ph), y: c.y - ph * 60 * z };
        if (fade > 0.1 && ph > 0.05) P(q.x, q.y, K(G, 6 - ph * 3), ph < 0.5 ? 2 : 1);
      }
    });
    return true;
  };
})();
