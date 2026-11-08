// Slop Hero - Frost Templar skill visuals (the glacier-warhammer kit in server/spCards.ts).
// Installed onto IsometricRenderer: drawSpSkill hands every Frost Templar effect here first.
// Everything is drawn texel by texel with the renderer's pixel motif kit (spMotifs) in the
// ice ramp, so it sits in the same pixel-art layer as the other SP cards.
//
//   blast     Glacier Smash      hammer slam: shock ring, radial cracks, a ring of spikes, shards
//   fault     Rime Quake         spike clusters bursting out of the ground one after another
//   jump      Hammerfall         landing sigil while airborne, then a crater of giant spikes
//   dash      Glacial Charge     frozen trail with spikes popping up behind the hero
//   boomerang Frost Hammer Throw a spinning ice hammer that flies out and back
//   buff      Frozen Bulwark     ice pillars rising round the hero, a shimmering ward
//   rain      Hailstorm          ice blocks dropping out of the sky and bursting
//   pull      Ice Prison         a ring of pillars closing in on the target
//   nova      (signature)        a flash-freeze wave / a shattering burst
(function () {
  'use strict';
  if (!window.IsometricRenderer) return;
  const TAU = Math.PI * 2;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const out3 = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  const bell = (t) => Math.sin(Math.PI * clamp01(t));

  IsometricRenderer.prototype.drawFrostTemplarSkill = function (ctx, fx, progress, toScreen, z) {
    const M = this.spMotifs(ctx, fx, progress);
    const { R, top, tex, hash } = M;
    const P = M.px;
    const time = this.animations.time;
    ctx.globalCompositeOperation = 'source-over';
    const seg = (a, b) => clamp01((progress - a) / (b - a));
    const fade = progress < 0.65 ? 1 : clamp01(1 - (progress - 0.65) / 0.35);
    const scaleZ = Math.min(1.4, z / 1.6);
    const sx = fx.startX !== undefined ? fx.startX : fx.x, sy = fx.startY !== undefined ? fx.startY : fx.y;
    const tx = fx.x !== undefined ? fx.x : sx, ty = fx.y !== undefined ? fx.y : sy;

    // ---- pieces ----
    // a spike of ice rising out of the ground (world x, y), height h texels at full growth
    const spikeAt = (x, y, h, w, grow) => {
      const k = Math.round(h * grow * scaleZ);
      if (k < 1) return;
      const p = toScreen(x, y, 0);
      M.crystal(p.x, p.y, k, Math.max(1, w));
    };
    // spikes scattered over a disc, rising (0..1) then sinking as they fade
    const spikeField = (cx, cy, r, n, h, grow, salt) => {
      const list = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + hash(salt + i) * 0.7, d = r * (0.35 + 0.65 * hash(salt + i + 40));
        list.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, h: h * 1.3 * (0.55 + 0.6 * hash(salt + i + 80)), w: 2 + Math.round(hash(salt + i + 9) * 1.4) });
      }
      list.sort((a, b) => (a.x + a.y) - (b.x + b.y)).forEach(s => spikeAt(s.x, s.y, s.h, s.w, grow));
    };
    // a ring of spikes leaning outward at radius r
    const spikeRing = (cx, cy, r, n, h, grow, salt) => {
      const list = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + hash(salt + i) * 0.25;
        list.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, h: h * 1.3 * (0.7 + 0.5 * hash(salt + i + 7)), w: 2 + (i % 3 === 0 ? 1 : 0) });
      }
      list.sort((a, b) => (a.x + a.y) - (b.x + b.y)).forEach(s => spikeAt(s.x, s.y, s.h, s.w, grow));
    };
    // radial frost cracks over the ground
    const cracks = (cx, cy, r, n, env, salt) => {
      if (env <= 0.02) return;
      const c = toScreen(cx, cy, 0);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + hash(salt + i) * 0.5;
        const mid = toScreen(cx + Math.cos(a + 0.15) * r * 0.5 * env, cy + Math.sin(a + 0.15) * r * 0.5 * env, 0);
        const end = toScreen(cx + Math.cos(a) * r * env, cy + Math.sin(a) * r * env, 0);
        M.line(c, mid, R(4), 1);
        M.line(mid, end, R(3), 1);
        P(end.x, end.y, R(top));
      }
    };
    // ice shards flung out of a point (world), e = 0..1 of their flight
    const shards = (cx, cy, n, dist, e, salt) => {
      if (e <= 0 || e >= 1) return;
      const c = toScreen(cx, cy, 0.3);
      const D = dist * 32 * Math.SQRT2 * z;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + hash(salt + i) * 0.6, d = D * (0.4 + 0.6 * hash(salt + i + 30)) * out3(e);
        const q = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.55 - Math.sin(Math.PI * e) * D * 0.25 + e * e * D * 0.3 };
        const spin = a + e * 9 * (hash(salt + i + 60) - 0.5);
        M.line(q, { x: q.x + Math.cos(spin) * 2 * tex, y: q.y + Math.sin(spin) * 2 * tex }, R(5 - e * 2.5), 1);
        P(q.x, q.y, R(top - e * 3));
      }
    };
    // an expanding shock ring on the ground
    const shock = (cx, cy, r, e) => {
      if (e <= 0 || e >= 1) return;
      M.ellipse(cx, cy, r * out3(e), R(top - Math.round(e * 3)), e < 0.5 ? 2 : 1, 0.05 + e * 0.4);
    };
    // a frosted patch of ground
    const frost = (cx, cy, r, env) => {
      if (env <= 0.02 || r <= 0.05) return;
      // rime on the ground: a frosted rim, a fainter inner ring and a sprinkle of glints
      // (no dither fill: at this scale it reads as a net laid over the floor)
      M.ellipse(cx, cy, r, R(4), 1, 0.3);
      M.ellipse(cx, cy, r * 0.6, R(3), 1, 0.65);
      const n = Math.round(6 + r * 5);
      for (let i = 0; i < n; i++) {
        if (hash(i * 7 + 3) > env) continue;
        const a = hash(i * 13 + 1) * TAU, d = Math.sqrt(hash(i * 17 + 5)) * r * 0.95;
        const q = toScreen(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0);
        P(q.x, q.y, R(i % 4 === 0 ? top : 4));
      }
    };
    // the hammer itself (spinning), centre at screen point c
    const hammer = (c, ang, s) => {
      const L = 9 * s, dx = Math.cos(ang), dy = Math.sin(ang);
      const a = { x: c.x - dx * L * 0.55 * tex, y: c.y - dy * L * 0.55 * tex }, b = { x: c.x + dx * L * 0.45 * tex, y: c.y + dy * L * 0.45 * tex };
      M.line(a, b, R(1), 1);                                         // haft
      const nx = -dy, ny = dx, H = 4 * s;
      const h0 = { x: b.x - nx * H * tex, y: b.y - ny * H * tex }, h1 = { x: b.x + nx * H * tex, y: b.y + ny * H * tex };
      M.line(h0, h1, R(3), 3);                                       // glacier head
      M.line(h0, h1, R(top), 1);
      P(h0.x, h0.y, R(top), 2); P(h1.x, h1.y, R(top), 2);
    };
    // a snowflake sigil on the ground
    const sigil = (cx, cy, r, rot, env) => {
      if (env <= 0.02) return;
      const c = toScreen(cx, cy, 0);
      M.ellipse(cx, cy, r, R(4), 1, 0.15);
      M.ellipse(cx, cy, r * 0.62, R(3), 1, 0.45);
      for (let j = 0; j < 6; j++) {
        const a = rot + j * Math.PI / 3;
        const tip = toScreen(cx + Math.cos(a) * r * env, cy + Math.sin(a) * r * env, 0);
        M.line(c, tip, R(4), 1);
        P(tip.x, tip.y, R(top), 2);
      }
    };

    switch (fx.shape) {
      // ---- GLACIER SMASH: the hammer comes down at the target spot
      case 'blast': {
        const r = fx.radius || 2.2;
        if (progress < 0.12) M.hit(tx, ty, 1.6, 1 - progress / 0.12);
        frost(tx, ty, r * out3(seg(0, 0.25)), fade);
        cracks(tx, ty, r * 1.05, 9, out3(seg(0, 0.2)) * fade, 3);
        shock(tx, ty, r * 1.25, seg(0, 0.4));
        const grow = progress < 0.6 ? out3(seg(0.04, 0.24)) : 1 - seg(0.6, 0.9);
        spikeRing(tx, ty, r * 0.72, 9, 15, grow, 11);
        spikeField(tx, ty, r * 0.45, 5, 9, grow, 51);
        shards(tx, ty, 14, r * 0.9, seg(0.58, 1), 7);
        return true;
      }

      // ---- RIME QUAKE: spike clusters burst out along the crack, one segment at a time
      case 'fault': {
        const segs = fx.segs || [];
        const dur = fx.duration || 1, every = fx.every || 0.08, el = progress * dur;
        const hitR = fx.radius || 1.2;
        let prev = toScreen(sx, sy, 0);
        segs.forEach((p, i) => {
          const t = (el - i * every) / 0.55;
          if (t <= 0) return;
          const q = toScreen(p.x, p.y, 0);
          M.line(prev, q, R(3), 1);
          prev = q;
          const env = t < 1 ? 1 : clamp01(1 - (el - i * every - 0.55) / 0.35);
          frost(p.x, p.y, hitR * 0.6 * out3(t), env);
          const grow = t < 0.6 ? out3(t / 0.35) : clamp01(1 - (t - 0.6) / 0.4);
          spikeField(p.x, p.y, hitR * 0.55, 4, 12 + i, grow, 20 + i * 9);
          if (t < 0.3) M.hit(p.x, p.y, 1, 1 - t / 0.3);
          shards(p.x, p.y, 6, hitR * 0.8, (t - 0.55) / 0.45, i * 13);
        });
        return true;
      }

      // ---- HAMMERFALL: a sigil marks the landing, then a crater of giant spikes
      case 'jump': {
        const r = fx.radius || 3.2;
        if (!fx.landed) {
          const k = out3(seg(0, 0.5));
          sigil(tx, ty, r * (0.5 + 0.5 * k), time * 1.5, k);
          if (Math.floor(time * 8) % 2) M.ellipse(tx, ty, r, R(top), 1, 0.5);
          return true;
        }
        if (progress < 0.14) M.hit(tx, ty, 2.4, 1 - progress / 0.14);
        frost(tx, ty, r * out3(seg(0, 0.2)), fade);
        cracks(tx, ty, r * 1.15, 12, out3(seg(0, 0.18)) * fade, 17);
        shock(tx, ty, r * 1.4, seg(0, 0.35));
        shock(tx, ty, r * 0.9, seg(0.08, 0.45));
        const grow = progress < 0.62 ? out3(seg(0.03, 0.2)) : 1 - seg(0.62, 0.92);
        spikeRing(tx, ty, r * 0.85, 12, 24, grow, 31);
        spikeRing(tx, ty, r * 0.5, 7, 15, grow, 71);
        shards(tx, ty, 22, r * 1.1, seg(0.6, 1), 19);
        return true;
      }

      // ---- GLACIAL CHARGE: a frozen trail, spikes popping up behind the hero
      case 'dash': {
        const dx = tx - sx, dy = ty - sy, len = Math.hypot(dx, dy) || 1;
        const reach = out3(seg(0, 0.3));
        M.path(sx, sy, sx + dx * reach, sy + dy * reach, (fx.width || 1.4) * 0.5, fade, 0.05);
        const n = Math.max(3, Math.round(len * 1.4));
        for (let i = 0; i < n; i++) {
          const f = (i + 0.5) / n;
          const t = (progress - f * 0.3) / 0.5;
          if (t <= 0) continue;
          const side = (hash(i * 3) - 0.5) * 0.8;
          const x = sx + dx * f - (dy / len) * side, y = sy + dy * f + (dx / len) * side;
          const grow = t < 0.6 ? out3(t / 0.3) : clamp01(1 - (t - 0.6) / 0.4);
          spikeAt(x, y, 10 + 8 * hash(i), 2, grow);
        }
        if (progress > 0.25 && progress < 0.5) M.hit(tx, ty, 1.2, 1 - seg(0.25, 0.5));
        shards(tx, ty, 8, 1, seg(0.3, 0.9), 5);
        return true;
      }

      // ---- FROST HAMMER THROW: out to the end point, then back to the hero
      case 'boomerang': {
        const a = (fx.axes && fx.axes[0]) || { ex: tx, ey: ty };
        let hx = sx, hy = sy;
        const pl = fx.followId && this.lastGameState && this.lastGameState.players ? this.lastGameState.players.find(p => p.id === fx.followId) : null;
        if (pl) { hx = pl.x; hy = pl.y; }
        const out = progress < 0.5;
        const k = out ? out3(progress / 0.5) : 1 - Math.pow(1 - (progress - 0.5) / 0.5, 2);
        const x = out ? sx + (a.ex - sx) * k : a.ex + (hx - a.ex) * k;
        const y = out ? sy + (a.ey - sy) * k : a.ey + (hy - a.ey) * k;
        // frost trail: a few fading texels behind it
        for (let j = 1; j <= 5; j++) {
          const kk = Math.max(0, (out ? progress / 0.5 : (progress - 0.5) / 0.5) - j * 0.04);
          const k2 = out ? out3(kk) : 1 - Math.pow(1 - kk, 2);
          const bx = out ? sx + (a.ex - sx) * k2 : a.ex + (hx - a.ex) * k2, by = out ? sy + (a.ey - sy) * k2 : a.ey + (hy - a.ey) * k2;
          const q = toScreen(bx, by, 0.7);
          P(q.x + (hash(j) - 0.5) * 4 * tex, q.y + (hash(j + 9) - 0.5) * 3 * tex, R(top - j));
        }
        frost(x, y, 0.5, 0.6);
        hammer(toScreen(x, y, 0.75), time * 18, 1.1);
        if (Math.abs(progress - 0.5) < 0.06) M.hit(a.ex, a.ey, 1.2, 1);
        return true;
      }

      // ---- FROZEN BULWARK: ice pillars rise round the hero behind a shimmering ward
      case 'buff': {
        const r = Math.max(1.4, (fx.radius || 2.6) * 0.55);
        const grow = progress < 0.7 ? out3(seg(0, 0.25)) : 1 - seg(0.7, 1);
        frost(tx, ty, (fx.radius || 2.6) * out3(seg(0, 0.3)), fade);
        shock(tx, ty, fx.radius || 2.6, seg(0, 0.45));
        spikeRing(tx, ty, r, 8, 18, grow, 41);
        const spin = time * 1.6;
        for (let i = 0; i < 6; i++) {
          const ang = spin + (i / 6) * TAU;
          const q = toScreen(tx + Math.cos(ang) * r * 0.75, ty + Math.sin(ang) * r * 0.75, 1 + 0.15 * Math.sin(time * 4 + i));
          P(q.x, q.y, R(top - (i % 2)), 2);
        }
        if (Math.floor(time * 10) % 3 !== 0) M.ellipse(tx, ty, r * 0.9, R(top - 1), 1, 0.55);
        return true;
      }

      // ---- HAILSTORM: one strike of the storm, a block of ice drops and bursts
      case 'rain': {
        const r = fx.radius || 1.2;
        if (fx.areaR && progress < 0.6) M.ellipse(fx.areaX, fx.areaY, fx.areaR, R(top - 3), 1, 0.6);
        if (progress < 0.35) {
          const k = progress / 0.35, h = 6 * (1 - k * k);
          const q = toScreen(tx, ty, h);
          M.crystal(q.x, q.y + 6 * tex, Math.round(13 * scaleZ), 3);
          M.ellipse(tx, ty, r * (0.4 + 0.6 * k), R(3), 1, 0.4);
          return true;
        }
        const k = seg(0.35, 1);
        if (k < 0.2) M.hit(tx, ty, 1.2, 1 - k / 0.2);
        frost(tx, ty, r * out3(k * 3), 1 - k);
        spikeField(tx, ty, r * 0.6, 5, 10, k < 0.5 ? out3(k / 0.2) : 1 - (k - 0.5) / 0.5, 61 + (fx.wave || 0) * 7);
        shards(tx, ty, 9, r, k, 3 + (fx.wave || 0));
        return true;
      }

      // ---- ICE PRISON: pillars close in on the target and lock it in
      case 'pull': {
        const r = fx.radius || 3.6;
        const close = out3(seg(0, 0.55));
        frost(tx, ty, r * (1 - 0.5 * close), fade);
        const grow = progress < 0.75 ? out3(seg(0, 0.2)) : 1 - seg(0.75, 1);
        spikeRing(tx, ty, r * (1 - 0.68 * close), 10, 20, grow, 81);
        if (progress > 0.5) sigil(tx, ty, r * 0.35, time, fade);
        shards(tx, ty, 16, r * 0.6, seg(0.72, 1), 9);
        return true;
      }

      // ---- NOVA (signature stages): a flash-freeze wave round the hero, or the shatter that ends it
      case 'nova':
      case 'pulse': {
        const r = fx.radius || 4;
        if (progress < 0.12) M.hit(tx, ty, 2, 1 - progress / 0.12);
        frost(tx, ty, r * out3(seg(0, 0.35)), fade);
        shock(tx, ty, r * 1.1, seg(0, 0.45));
        shock(tx, ty, r * 0.7, seg(0.1, 0.55));
        cracks(tx, ty, r, 14, out3(seg(0, 0.3)) * fade, 23);
        const grow = progress < 0.6 ? out3(seg(0.05, 0.3)) : 1 - seg(0.6, 0.9);
        spikeField(tx, ty, r * 0.9, 16, 14, grow, 91);
        shards(tx, ty, 26, r * 0.9, seg(0.55, 1), 29);
        return true;
      }
    }
    return false;
  };
})();
