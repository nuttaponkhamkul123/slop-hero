// Slop Hero - player trail effects.
// A trail is a stream of small pixel particles shed from a hero's feet while they move. The
// catalogue, the particle physics and the drawing live here so the game (renderer.js) and the
// live previews in the Effects dialog (game.js) draw exactly the same thing.
(function (root) {
  'use strict';

  // life / size / vz are [min, max]; size is in "pixel units"; vz in tiles per second
  const KINDS = {
    // not a particle trail: the renderer keeps recent poses of the real hero sprite and draws them as fading silhouettes
    afterimage: {
      name: 'Shadow Clone Trail', desc: 'Dark afterimages of you linger where you ran.',
      special: 'afterimage', colors: ['#3b1a78'], life: [0.6, 0.6], size: [1, 1], vz: [0, 0], drift: 0, gravity: 0, shape: 'sq', glow: false, rate: 1
    },
    ember: {
      name: 'Ember Trail', desc: 'Glowing embers lift off your footsteps.',
      colors: ['#fb923c', '#f97316', '#ef4444', '#fde047'], life: [0.5, 0.95], size: [1, 2], vz: [0.5, 1.2], drift: 0.35, gravity: 0, shape: 'sq', glow: true, rate: 2
    },
    frost: {
      name: 'Frost Trail', desc: 'Snowflakes and a chill glitter in your wake.',
      colors: ['#e0f2fe', '#bae6fd', '#7dd3fc', '#ffffff'], life: [0.7, 1.2], size: [1, 2], vz: [0.1, 0.35], drift: 0.2, gravity: -0.25, shape: 'star', glow: true, rate: 1.5
    },
    shadow: {
      name: 'Shadow Trail', desc: 'Dark violet smoke curls off your heels.',
      colors: ['#1e1b4b', '#3b0764', '#581c87', '#7e22ce'], life: [0.6, 1.1], size: [3, 4], vz: [0.2, 0.5], drift: 0.25, gravity: 0, shape: 'smoke', glow: false, rate: 1.5
    },
    sakura: {
      name: 'Sakura Trail', desc: 'Cherry blossom petals flutter behind you.',
      colors: ['#fbcfe8', '#f9a8d4', '#f472b6', '#ffe4e6'], life: [0.9, 1.5], size: [1, 2], vz: [0.2, 0.5], drift: 0.45, gravity: -0.35, shape: 'petal', glow: false, rate: 1.5
    },
    lightning: {
      name: 'Storm Trail', desc: 'Crackling bolts snap at your feet.',
      colors: ['#fde047', '#facc15', '#ffffff', '#93c5fd'], life: [0.14, 0.3], size: [2, 3], vz: [0, 0.2], drift: 0.5, gravity: 0, shape: 'bolt', glow: true, rate: 1
    },
    stardust: {
      name: 'Stardust Trail', desc: 'Twinkling gold stars left in the air.',
      colors: ['#fef08a', '#fde047', '#ffffff', '#fbbf24'], life: [0.8, 1.4], size: [1, 2], vz: [0.1, 0.45], drift: 0.3, gravity: -0.05, shape: 'twinkle', glow: true, rate: 1.5
    },
    toxic: {
      name: 'Toxic Trail', desc: 'Green bubbles pop where you walked.',
      colors: ['#4ade80', '#22c55e', '#86efac', '#a3e635'], life: [0.7, 1.2], size: [2, 3], vz: [0.25, 0.6], drift: 0.2, gravity: 0, shape: 'bubble', glow: false, rate: 1.2
    },
    rainbow: {
      name: 'Rainbow Trail', desc: 'A ribbon of colour that never repeats.',
      colors: null, life: [0.5, 0.9], size: [2, 3], vz: [0.05, 0.25], drift: 0.12, gravity: 0, shape: 'sq', glow: true, rate: 3
    }
  };
  const ORDER = ['afterimage', 'ember', 'frost', 'shadow', 'sakura', 'lightning', 'stardust', 'toxic', 'rainbow'];

  const rnd = (a, b) => a + Math.random() * (b - a);

  // Shed particles for one hero. dist is how far they moved since the last call (tiles); an
  // accumulator in `state` turns that into an even stream whatever the frame rate is.
  function shed(kindId, state, x, y, dist, list, cap) {
    const K = KINDS[kindId];
    if (!K || K.special) return;               // special trails (afterimage) are drawn by the renderer
    state.acc = (state.acc || 0) + dist;
    const STEP = 0.2 / K.rate;
    let guard = 0;
    while (state.acc >= STEP && guard++ < 6) {
      state.acc -= STEP;
      if (list.length >= (cap || 500)) return;
      const back = state.acc;                                // spawn along the stretch just walked
      const px = x - (state.dx || 0) * back, py = y - (state.dy || 0) * back;
      list.push({
        kind: kindId, x: px + rnd(-0.1, 0.1), y: py + rnd(-0.1, 0.1), z: rnd(0.02, 0.12),
        vx: rnd(-K.drift, K.drift) * 0.5 - (state.dx || 0) * 0.25, vy: rnd(-K.drift, K.drift) * 0.5 - (state.dy || 0) * 0.25,
        vz: rnd(K.vz[0], K.vz[1]), life: 0, max: rnd(K.life[0], K.life[1]),
        size: Math.round(rnd(K.size[0], K.size[1])), color: K.colors ? K.colors[Math.floor(Math.random() * K.colors.length)] : null,
        seed: Math.random()
      });
    }
  }

  function step(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i], K = KINDS[p.kind];
      p.life += dt;
      if (p.life >= p.max || !K) { list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vz += (K.gravity || 0) * dt;
      p.z = Math.max(0.02, p.z + p.vz * dt);
      if (K.shape === 'petal') { p.vx += Math.sin(p.life * 7 + p.seed * 6) * 0.5 * dt; p.vy += Math.cos(p.life * 6 + p.seed * 6) * 0.5 * dt; }
    }
  }

  // project(x, y, z) -> {x, y} on screen; zoom scales the pixel unit; time drives twinkle / hue
  function draw(ctx, list, project, zoom, time) {
    if (!list.length) return;
    const u = Math.max(2, Math.round(zoom * 1.5));          // one chunky "pixel"
    ctx.save();
    for (let i = 0; i < list.length; i++) {
      const p = list[i], K = KINDS[p.kind];
      if (!K) continue;
      const t = p.life / p.max;
      const a = Math.min(1, t * 8) * (1 - t) * (K.shape === 'smoke' ? 0.55 : 1);
      if (a <= 0.02) continue;
      const s = project(p.x, p.y, p.z);
      const col = p.color || `hsl(${Math.round((time * 140 + p.seed * 360) % 360)}, 92%, 62%)`;
      const sx = Math.round(s.x / u) * u, sy = Math.round(s.y / u) * u;
      ctx.globalCompositeOperation = K.glow ? 'lighter' : 'source-over';
      ctx.globalAlpha = a;
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      const n = p.size;
      switch (K.shape) {
        case 'star':                                          // a plus of pixels
          ctx.fillRect(sx - u / 2, sy - u / 2 - u * n, u, u * (n * 2 + 1));
          ctx.fillRect(sx - u / 2 - u * n, sy - u / 2, u * (n * 2 + 1), u);
          break;
        case 'twinkle': {                                     // a star that blinks
          const blink = 0.5 + 0.5 * Math.sin(time * 18 + p.seed * 20);
          const r = n * (0.6 + blink);
          ctx.fillRect(sx - u / 2, sy - u / 2 - u * r, u, u * (r * 2 + 1));
          ctx.fillRect(sx - u / 2 - u * r, sy - u / 2, u * (r * 2 + 1), u);
          ctx.globalAlpha = a * 0.9;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(sx - u / 2, sy - u / 2, u, u);
          break;
        }
        case 'petal': {                                       // two tumbling pixels
          const ph = time * 5 + p.seed * 9, ox = Math.round(Math.cos(ph) * 1.2) * u, oy = Math.round(Math.sin(ph) * 0.8) * u;
          ctx.fillRect(sx - u / 2, sy - u / 2, u * (n + 1), u);
          ctx.fillRect(sx - u / 2 + ox, sy - u / 2 + oy + u, u * n, u);
          break;
        }
        case 'bolt': {                                        // a short zig-zag
          ctx.lineWidth = Math.max(1, u * 0.7);
          ctx.lineCap = 'round';
          ctx.beginPath();
          let bx = sx, by = sy;
          ctx.moveTo(bx, by);
          for (let k = 0; k < 3; k++) {
            bx += (Math.sin(p.seed * 50 + k * 4 + Math.floor(time * 30)) * 1.4 + (k % 2 ? -0.6 : 0.6)) * u * n * 0.7;
            by += (Math.cos(p.seed * 30 + k * 3) * 0.6 - 0.4) * u * n * 0.7;
            ctx.lineTo(bx, by);
          }
          ctx.stroke();
          break;
        }
        case 'bubble':                                        // a hollow square that grows as it floats
          ctx.lineWidth = Math.max(1, u * 0.6);
          ctx.strokeRect(sx - u * n * (0.6 + t * 0.6), sy - u * n * (0.6 + t * 0.6), u * n * (1.2 + t * 1.2), u * n * (1.2 + t * 1.2));
          break;
        case 'smoke':                                         // soft blocks that swell and thin out
          ctx.fillRect(sx - u * n * (0.5 + t * 0.8), sy - u * n * (0.5 + t * 0.8), u * n * (1 + t * 1.6), u * n * (1 + t * 1.6));
          break;
        default:                                              // 'sq'
          ctx.fillRect(sx - u / 2, sy - u / 2, u * n, u * n);
      }
    }
    ctx.restore();
  }

  root.TrailFx = { KINDS, ORDER, shed, step, draw };
})(typeof window !== 'undefined' ? window : globalThis);
