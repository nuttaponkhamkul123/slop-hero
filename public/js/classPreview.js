// Character Creation Preview Renderer (Authentic 2D Pixel Art Showcase)
// Renders an animated, breathing 2D pixel-art hero of the currently selected class
// on an isometric glowing pedestal inside the join-game modal.

(function() {
  'use strict';

  const CLASS_META = {
    warrior: {
      name: 'Warrior',
      archetype: 'Swordsman',
      role: 'Vanguard',
      icon: '⚔️',
      tagline: 'Holds the line. Breaks the front.',
      lore: 'A master of the greatsword who trades speed for raw power. Whirlwind cleaves whole packs, and Blade Charge carries you through the front rank of a mob.',
      accent: '#dc2626',
      stats: { 'STRENGTH': 92, 'VITALITY': 85, 'AGILITY': 45, 'INTELLECT': 30 }
    },
    mage: {
      name: 'Mage',
      archetype: 'Arcane Scholar',
      role: 'Caster',
      icon: '🧙',
      tagline: 'Folds distance into ash.',
      lore: 'A battle-scholar who burns the air out of the room. Firestorm blankets an area in flame, while Arcane Blink warps you clear of a blade before it lands.',
      accent: '#8b5cf6',
      stats: { 'STRENGTH': 30, 'VITALITY': 40, 'AGILITY': 55, 'INTELLECT': 96 }
    },
    rogue: {
      name: 'Rogue',
      archetype: 'Shadow Blade',
      role: 'Assassin',
      icon: '🗡️',
      tagline: 'Ends fights before they start.',
      lore: 'A knife in the dark. Fan of Knives shreds everything around you, and Shadow Dash turns your back into an open wound for whoever was chasing you.',
      accent: '#22c55e',
      stats: { 'STRENGTH': 65, 'VITALITY': 50, 'AGILITY': 95, 'INTELLECT': 45 }
    }
  };

  const SPRITE_CONFIG = {
    warrior: {
      src: 'sprites/swordman_idle_strip.png',
      frameCount: 4,
      frameWidth: 256,
      frameHeight: 286,
      anchorX: 128,
      anchorY: 263,
      scale: 0.95
    },
    mage: {
      src: 'sprites/mage_idle_strip.png',
      frameCount: 4,
      frameWidth: 320,
      frameHeight: 286,
      anchorX: 140,
      anchorY: 263,
      scale: 0.95
    },
    rogue: {
      src: 'sprites/rogue_idle_strip.png',
      frameCount: 4,
      frameWidth: 320,
      frameHeight: 286,
      anchorX: 140,
      anchorY: 263,
      scale: 0.95
    }
  };

  class ClassPreview {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.currentClass = 'warrior';
      this.running = false;
      this.animTime = 0;
      this.lastTime = 0;
      this.particles = [];

      // Preload sprite images
      this.images = {};
      Object.entries(SPRITE_CONFIG).forEach(([cls, cfg]) => {
        const img = new Image();
        img.src = cfg.src;
        this.images[cls] = img;
      });

      this.initParticles();
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    initParticles() {
      this.particles = [];
      for (let i = 0; i < 28; i++) {
        this.particles.push({
          x: (Math.random() - 0.5) * 160,
          y: (Math.random() - 0.5) * 120,
          vy: -(0.2 + Math.random() * 0.5),
          vx: (Math.random() - 0.5) * 0.2,
          size: i % 4 === 0 ? 2 : 1,
          star: i % 5 === 0,
          alpha: Math.random() * 0.7 + 0.2,
          life: Math.random() * 2
        });
      }
    }

    resize() {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(rect.width || 380, 240);
      const h = Math.max(rect.height || 380, 240);

      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      if (this.ctx) {
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.ctx.imageSmoothingEnabled = false;
      }
      this.width = w;
      this.height = h;
    }

    setClass(cls) {
      if (!CLASS_META[cls]) return;
      this.currentClass = cls;
      this.animTime = 0;
      this.initParticles();
      this.draw(0);
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.lastTime = performance.now();
      const loop = (now) => {
        if (!this.running) return;
        const dt = Math.min((now - this.lastTime) / 1000, 0.05);
        this.lastTime = now;
        this.animTime += dt;
        this.draw(dt);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    stop() {
      this.running = false;
    }

    draw(dt) {
      if (!this.ctx || !this.width || !this.height) return;
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;
      const cls = this.currentClass || 'warrior';
      const meta = CLASS_META[cls] || CLASS_META.warrior;
      const cfg = SPRITE_CONFIG[cls];
      const img = this.images[cls];

      ctx.clearRect(0, 0, w, h);

      const centerX = Math.round(w * 0.5);
      const centerY = Math.round(h * 0.68);

      // --- 1. Ambient Backdrop Glow ---
      const glowGrad = ctx.createRadialGradient(centerX, centerY - 40, 10, centerX, centerY - 40, 150);
      glowGrad.addColorStop(0, meta.accent + '33');
      glowGrad.addColorStop(0.6, meta.accent + '0d');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, w, h);

      // --- 2. Floating Ambient Pixel Sparkles/Motes ---
      ctx.save();
      ctx.translate(centerX, centerY - 30);
      const px = 2;
      this.particles.forEach(p => {
        p.y += p.vy;
        p.x += p.vx;
        p.life += dt;
        if (p.y < -120) {
          p.y = 20;
          p.x = (Math.random() - 0.5) * 140;
        }
        const ix = Math.round(p.x / px) * px;
        const iy = Math.round(p.y / px) * px;
        const pulse = (Math.sin(p.life * 3) + 1) * 0.5;
        ctx.globalAlpha = p.alpha * (0.4 + pulse * 0.6);
        ctx.fillStyle = meta.accent;
        if (p.star && pulse > 0.45) {
          ctx.fillRect(ix - px, iy, px * 3, px);
          ctx.fillRect(ix, iy - px, px, px * 3);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(ix, iy, px, px);
        } else {
          const sz = p.size * px;
          ctx.fillRect(ix, iy, sz, sz);
        }
      });
      ctx.restore();

      // --- 3. Ground Pedestal (Isometric Plinth) ---
      // Ground shadow
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + 8, 86, 28, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fill();

      // Stone dais lower bevel
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + 6, 76, 24, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Stone dais top disc
      ctx.beginPath();
      ctx.ellipse(centerX, centerY - 2, 72, 22, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#334155';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Glowing energy rim
      const ringPulse = 0.7 + Math.sin(this.animTime * 2.8) * 0.3;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY - 2, 68, 20, 0, 0, Math.PI * 2);
      ctx.strokeStyle = meta.accent;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = ringPulse;
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // Contact shadow immediately beneath hero
      ctx.beginPath();
      ctx.ellipse(centerX, centerY - 4, 34, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fill();

      // --- 4. 2D Pixel-Art Character Sprite ---
      if (img && img.complete && img.naturalWidth > 0 && cfg) {
        // 4-frame idle animation loop (~5.2 fps)
        const frameIndex = Math.floor((this.animTime * 5.2) % cfg.frameCount);
        const sx = frameIndex * cfg.frameWidth;
        const sy = 0;
        const sw = cfg.frameWidth;
        const sh = cfg.frameHeight;

        // Subtle idle motion (breathing & levitation for mage)
        let offsetY = 0;
        if (cls === 'mage') {
          // Arcane levitation bob
          offsetY = Math.sin(this.animTime * 2.4) * 6 - 8;
        } else if (cls === 'warrior') {
          // Grounded chest rise
          offsetY = Math.sin(this.animTime * 3.0) * 1.5;
        } else if (cls === 'rogue') {
          // Low predatory crouch sway
          offsetY = Math.sin(this.animTime * 3.4) * 1.8;
        }

        const scale = cfg.scale || 1.0;
        const dw = sw * scale;
        const dh = sh * scale;
        const dx = Math.round(centerX - cfg.anchorX * scale);
        const dy = Math.round(centerY - cfg.anchorY * scale + offsetY);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      }
    }
  }

  window.ClassPreview = ClassPreview;
  window.CLASS_META = CLASS_META;
})();
