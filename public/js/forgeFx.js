// Slop Hero - Rune Forge upgrade effects.
// An overlay over the forge dialog: a short charge-up (anvil strikes throwing sparks) while the
// server rolls, then the outcome: a gold burst with rays and confetti on success, a shake, red
// flash and smoke on failure, plus falling shards and cracks when a level or a socket is lost.
// Pixel style: particles are drawn on a low-res canvas scaled up, animations step.
//
//   const fx = ForgeFx.start(hostEl, { iconHtml, color });   // returns null if one is running
//   fx.resolve({ kind: 'success' | 'fail' | 'down' | 'break', title, sub, epic });
//   fx.cancel();                                               // the request was refused
(function () {
  'use strict';

  const PX = 3;                 // one particle pixel = 3 screen pixels
  const MIN_CHARGE = 480;       // ms of build-up before the outcome shows
  const STRIKE_EVERY = 160;
  const HOLD = 950;             // ms the outcome stays before fading (click to skip)
  const FADE = 180;
  const MAX_WAIT = 5000;        // give up on a result that never comes
  const GOLD = ['#ffcd75', '#f6c453', '#ffffff', '#a7f070', '#ef7d57'];
  const SPARK = ['#ffcd75', '#ef7d57', '#ffffff', '#f4f4f4'];
  const RED = ['#b13e53', '#ef7d57', '#5d275d', '#f4f4f4'];
  const SMOKE = ['#566c86', '#333c57', '#94b0c2'];
  const sfx = (name) => { try { if (window.soundEngine && window.soundEngine[name]) window.soundEngine[name](); } catch (_) {} };

  let active = null;

  function start(host, opts) {
    if (!host || active) return null;
    const root = document.createElement('div');
    root.className = 'ffx is-charging';
    root.innerHTML = `<canvas class="ffx-canvas"></canvas><div class="ffx-flash"></div>
      <div class="ffx-stage"><div class="ffx-icon" style="--rc:${opts.color || '#ffcd75'}">${opts.iconHtml || ''}<i class="ffx-crack"></i></div>
      <div class="ffx-title">Forging</div><div class="ffx-sub"></div></div>`;
    host.appendChild(root);
    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const icon = root.querySelector('.ffx-icon');
    const title = root.querySelector('.ffx-title');
    const sub = root.querySelector('.ffx-sub');
    const flash = root.querySelector('.ffx-flash');

    let W = 0, H = 0;
    const size = () => {
      W = Math.max(1, Math.round(root.clientWidth / PX));
      H = Math.max(1, Math.round(root.clientHeight / PX));
      canvas.width = W; canvas.height = H;
    };
    size();
    // the icon's centre in canvas pixels
    const centre = () => {
      const r = root.getBoundingClientRect(), i = icon.getBoundingClientRect();
      return { x: (i.left + i.width / 2 - r.left) / PX, y: (i.top + i.height / 2 - r.top) / PX };
    };

    const parts = [];
    const burst = (n, colors, o = {}) => {
      const c = centre();
      for (let k = 0; k < n; k++) {
        const a = o.angle !== undefined ? o.angle + (Math.random() - 0.5) * (o.spread || 1) : Math.random() * Math.PI * 2;
        const sp = (o.speed || 60) * (0.35 + Math.random() * 0.9);
        parts.push({
          x: c.x + (Math.random() - 0.5) * (o.jitter || 6), y: c.y + (Math.random() - 0.5) * (o.jitter || 6),
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.lift || 0),
          g: o.gravity !== undefined ? o.gravity : 90, drag: o.drag || 0.985,
          life: 0, max: (o.life || 0.9) * (0.6 + Math.random() * 0.7),
          size: o.size || (Math.random() < 0.25 ? 2 : 1), color: colors[(Math.random() * colors.length) | 0],
          grow: o.grow || 0, twinkle: !!o.twinkle
        });
      }
    };

    let t0 = performance.now(), last = t0;
    let phase = 'charge', outcome = null, outcomeAt = 0, nextStrike = 0, raf = 0, done = false;
    let rays = 0, rayColor = '#ffcd75', glow = 0;

    const strike = () => {
      sfx('playAnvil');
      burst(14, SPARK, { speed: 70, gravity: 120, life: 0.55 });
      icon.classList.remove('is-hit'); void icon.offsetWidth; icon.classList.add('is-hit');
      glow = 1;
    };

    const reveal = () => {
      phase = 'outcome';
      outcomeAt = performance.now();
      root.classList.remove('is-charging');
      root.classList.add('is-' + outcome.kind);
      if (outcome.epic) root.classList.add('is-epic');
      title.textContent = outcome.title || '';
      sub.innerHTML = outcome.sub || '';
      flash.classList.add('go');
      if (outcome.kind === 'success') {
        sfx('playUpgradeSuccess');
        setTimeout(() => sfx('playLevelUp'), 120);
        rays = 1; rayColor = outcome.epic ? '#a7f070' : '#ffcd75';
        burst(outcome.epic ? 170 : 110, GOLD, { speed: outcome.epic ? 150 : 115, gravity: 70, life: 1.5, lift: 30, twinkle: true });
        burst(40, ['#ffffff', '#ffcd75'], { speed: 40, gravity: 0, life: 0.9, drag: 0.94, size: 2 });
        if (outcome.epic) {
          setTimeout(() => { if (!done) burst(90, GOLD, { speed: 130, gravity: 60, life: 1.4, lift: 40, twinkle: true }); sfx('playExplosion'); }, 200);
          host.classList.add('ffx-quake');
          setTimeout(() => host.classList.remove('ffx-quake'), 460);
        }
      } else {
        sfx('playUpgradeFail');
        host.classList.add('ffx-shake');
        setTimeout(() => host.classList.remove('ffx-shake'), 520);
        burst(36, SMOKE, { speed: 28, gravity: -26, life: 1.6, drag: 0.97, size: 2, grow: 1.6 });
        burst(26, RED, { speed: 85, gravity: 140, life: 0.8 });
        if (outcome.kind === 'down' || outcome.kind === 'break') {
          sfx('playExplosion');
          // shards breaking off the item and falling
          burst(30, ['#94b0c2', '#f4f4f4', '#566c86', '#b13e53'], { speed: 55, gravity: 200, life: 1.3, size: 2, lift: 40 });
        }
      }
    };

    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      root.classList.add('is-leaving');
      setTimeout(() => root.remove(), FADE);
      if (active === handle) active = null;
    };

    root.addEventListener('click', () => { if (phase === 'outcome' && performance.now() - outcomeAt > 120) finish(); });

    const frame = (now) => {
      if (done) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const el = now - t0;
      if (root.clientWidth / PX !== W) size();

      if (phase === 'charge') {
        if (el >= nextStrike) { strike(); nextStrike += STRIKE_EVERY; }
        if (outcome && el >= MIN_CHARGE) reveal();
        else if (el > MAX_WAIT) { finish(); return; }
        // embers drifting up toward the item while it charges
        if (Math.random() < 0.5) {
          const c = centre();
          parts.push({ x: c.x + (Math.random() - 0.5) * 70, y: c.y + 40 + Math.random() * 20, vx: 0, vy: -30 - Math.random() * 20, g: 0, drag: 1,
            life: 0, max: 0.9, size: 1, color: SPARK[(Math.random() * 2) | 0], grow: 0, twinkle: true });
        }
      } else if (now - outcomeAt > HOLD) { finish(); return; }

      ctx.clearRect(0, 0, W, H);
      const c = centre();
      // charge glow / success rays, drawn chunky at low resolution
      if (phase === 'charge' && glow > 0) {
        glow = Math.max(0, glow - dt * 2.4);
        // square rings pulsing out from the item on every strike
        ctx.fillStyle = '#ef7d57';
        for (const [r0, a] of [[20 + (1 - glow) * 22, glow * 0.8], [20 + (1 - glow) * 40, glow * 0.4]]) {
          const r = Math.round(r0), x = Math.round(c.x - r), y = Math.round(c.y - r), d = r * 2;
          ctx.globalAlpha = a;
          ctx.fillRect(x, y, d, 1); ctx.fillRect(x, y + d - 1, d, 1); ctx.fillRect(x, y, 1, d); ctx.fillRect(x + d - 1, y, 1, d);
        }
        ctx.globalAlpha = 1;
      }
      if (rays > 0) {
        const age = (now - outcomeAt) / 1000;
        const a0 = age * 0.9, len = Math.max(W, H);
        ctx.globalAlpha = Math.max(0, 0.32 - age * 0.12);
        ctx.fillStyle = rayColor;
        for (let k = 0; k < 12; k++) {
          const a = a0 + (k / 12) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(c.x + Math.cos(a - 0.09) * len, c.y + Math.sin(a - 0.09) * len);
          ctx.lineTo(c.x + Math.cos(a + 0.09) * len, c.y + Math.sin(a + 0.09) * len);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        if (p.life >= p.max) { parts.splice(i, 1); continue; }
        p.vy += p.g * dt;
        p.vx *= p.drag; p.vy *= p.drag;
        p.x += p.vx * dt; p.y += p.vy * dt;
        const k = p.life / p.max;
        if (p.twinkle && Math.random() < 0.15) continue;
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        ctx.fillStyle = p.color;
        const s = Math.max(1, Math.round(p.size + p.grow * k * 2));
        ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const handle = {
      resolve(o) { if (!done && !outcome) outcome = o || { kind: 'fail', title: 'Failed' }; },
      cancel() { finish(); }
    };
    active = handle;
    return handle;
  }

  window.ForgeFx = { start, busy: () => !!active };
})();
