// Three.js 3D Hero Model Renderer for Slop Hero MMORPG
// Realistic Biomechanical Character Rig & Kinematic Locomotion:
// - Articulated Multi-Joint Skeleton: Hip -> Knee -> Ankle -> Foot & Shoulder -> Elbow -> Wrist
// - Organic Humanoid Kinematics: Knee Flexion, Ankle Leveling, Pelvic Weight Transfer (Sway), Torso Counter-Rotation & Double-Bounce Gait
// - Faithful 2D Sprite Replica Stance:
//   * Warrior: Grounded contrapposto combat stance, knees flexed, two hands gripping grand broadsword diagonally across chest, Norman nasal spangenhelm & billowing crimson mantle
//   * Mage: Wise elder wizard pacing with flowing beard, wide floppy purple hat, gold-hemmed robe & radiant arcane staff
//   * Rogue: Low spring-loaded stealth predator crouch, dual curved venom daggers & streaming scarf tails

(function() {
  'use strict';

  // --- Procedural Canvas Texture Generators for Realistic Materials ---
  class TextureFactory {
    static createSteelTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0, '#f1f5f9');
      grad.addColorStop(0.3, '#cbd5e1');
      grad.addColorStop(0.5, '#ffffff');
      grad.addColorStop(0.7, '#94a3b8');
      grad.addColorStop(1, '#475569');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      // Micro-scratches & directional brush grain
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      for (let i = 0; i < 80; i++) {
        ctx.fillRect(0, Math.random() * 256, 256, 1.2);
      }
      ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
      for (let i = 0; i < 60; i++) {
        ctx.fillRect(0, Math.random() * 256, 256, 1.0);
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, 252, 252);

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

    static createGambesonTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(0, 0, 128, 128);

      // Diamond quilted stitching
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = -128; i <= 256; i += 32) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 128, 128);
        ctx.moveTo(i + 128, 0);
        ctx.lineTo(i, 128);
      }
      ctx.stroke();

      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -128; i <= 256; i += 32) {
        ctx.moveTo(i, 1);
        ctx.lineTo(i + 128, 129);
      }
      ctx.stroke();

      // Padded vertex indent buttons
      ctx.fillStyle = '#172554';
      for (let x = 0; x <= 128; x += 32) {
        for (let y = 0; y <= 128; y += 32) {
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 2);
      return tex;
    }

    static createChainmailTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 128, 128);

      ctx.lineWidth = 2.5;
      for (let y = 0; y <= 128; y += 12) {
        const xOffset = (y % 24 === 0) ? 0 : 6;
        for (let x = -6; x <= 134; x += 12) {
          ctx.strokeStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(x + xOffset, y, 5, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.arc(x + xOffset, y - 0.5, 4.5, -0.6, 1.2);
          ctx.stroke();
        }
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(3, 3);
      return tex;
    }

    static createLeatherTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 128, 128);
      grad.addColorStop(0, '#78350f');
      grad.addColorStop(0.5, '#92400e');
      grad.addColorStop(1, '#54260a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      for (let i = 0; i < 150; i++) {
        ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 1.5);
      }

      ctx.strokeStyle = '#b45309';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(4, 4, 120, 120);

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

    static createMageRobeTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0, '#581c87');
      grad.addColorStop(0.6, '#4a154b');
      grad.addColorStop(1, '#3b0764');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);

      // Gold embroidery border
      ctx.fillStyle = '#facc15';
      ctx.fillRect(0, 114, 128, 6);
      ctx.fillRect(0, 108, 128, 2);

      ctx.fillStyle = '#fef08a';
      for (let x = 8; x < 128; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 110);
        ctx.lineTo(x + 4, 114);
        ctx.lineTo(x, 118);
        ctx.lineTo(x - 4, 114);
        ctx.closePath();
        ctx.fill();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

    static createPoisonBladeTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 64, 0);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(0.35, '#334155');
      grad.addColorStop(0.65, '#22c55e');
      grad.addColorStop(1, '#86efac');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 256);

      ctx.fillStyle = '#4ade80';
      for (let i = 0; i < 30; i++) {
        ctx.fillRect(40 + Math.random() * 20, Math.random() * 256, 2.5, 4);
      }

      return new THREE.CanvasTexture(canvas);
    }

    static createShadowTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
      grad.addColorStop(0, 'rgba(5, 5, 12, 0.7)');
      grad.addColorStop(0.5, 'rgba(10, 14, 20, 0.35)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(64, 64, 60, 0, Math.PI * 2);
      ctx.fill();

      return new THREE.CanvasTexture(canvas);
    }

    static createMarbleTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      // Polished antique marble stone gradient with rich chiaroscuro
      const grad = ctx.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0, '#f1f5f9');
      grad.addColorStop(0.35, '#cbd5e1');
      grad.addColorStop(0.7, '#94a3b8');
      grad.addColorStop(1, '#64748b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      // Fine golden-amber & charcoal marble veins
      ctx.lineWidth = 1.5;
      for (let v = 0; v < 10; v++) {
        ctx.strokeStyle = (v % 2 === 0) ? 'rgba(217, 119, 6, 0.16)' : 'rgba(30, 41, 59, 0.28)';
        ctx.beginPath();
        let x = (v * 38) % 256;
        let y = 0;
        ctx.moveTo(x, y);
        while (y < 256) {
          y += 14 + Math.random() * 20;
          x += (Math.random() - 0.48) * 32;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Classical architectural fluting and masonry lines
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
      ctx.lineWidth = 2.5;
      for (let x = 0; x <= 256; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 256);
        ctx.stroke();
      }

      // Waterline moss and patina gradient along base
      const moss = ctx.createLinearGradient(0, 210, 0, 256);
      moss.addColorStop(0, 'rgba(16, 185, 129, 0)');
      moss.addColorStop(1, 'rgba(5, 150, 105, 0.38)');
      ctx.fillStyle = moss;
      ctx.fillRect(0, 210, 256, 46);

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

    static createWaterTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      // Shimmering cerulean to deep sapphire water depth
      const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 130);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(0.45, '#0284c7');
      grad.addColorStop(1, '#0369a1');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      // Intersecting caustic rings
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.55)';
      for (let i = 0; i < 36; i++) {
        const cx = (i * 37) % 256;
        const cy = ((i * 53) + 20) % 256;
        const r = 16 + (i % 5) * 6;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Specular sunlight sparkle points
      ctx.fillStyle = '#ffffff';
      for (let s = 0; s < 45; s++) {
        const sx = Math.random() * 256;
        const sy = Math.random() * 256;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.random() * 2 + 1, 0, Math.PI * 2);
        ctx.fill();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    }

    static createCascadeTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, 128, 256);

      // Translucent azure waterfall stream backing
      const grad = ctx.createLinearGradient(0, 0, 128, 0);
      grad.addColorStop(0, 'rgba(14, 165, 233, 0.12)');
      grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.45)');
      grad.addColorStop(1, 'rgba(14, 165, 233, 0.12)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 256);

      // Vertical streaming foam strands
      for (let i = 0; i < 44; i++) {
        const x = Math.random() * 128;
        const len = 40 + Math.random() * 120;
        const y = Math.random() * 256;
        const foamGrad = ctx.createLinearGradient(x, y, x, y + len);
        foamGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        foamGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.88)');
        foamGrad.addColorStop(1, 'rgba(224, 242, 254, 0)');
        ctx.strokeStyle = foamGrad;
        ctx.lineWidth = 1.4 + Math.random() * 2.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + len);
        ctx.stroke();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 1);
      return tex;
    }

    static createFoamTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(0.4, 'rgba(224, 242, 254, 0.8)');
      grad.addColorStop(0.8, 'rgba(56, 189, 248, 0.3)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(32, 32, 30, 0, Math.PI * 2);
      ctx.fill();

      return new THREE.CanvasTexture(canvas);
    }
  }

  // --- Shared Asset Builders (reusable by the class-select preview) ---
  function buildTextures() {
    return {
      steel: TextureFactory.createSteelTexture(),
      gambeson: TextureFactory.createGambesonTexture(),
      chainmail: TextureFactory.createChainmailTexture(),
      leather: TextureFactory.createLeatherTexture(),
      mageRobe: TextureFactory.createMageRobeTexture(),
      poisonBlade: TextureFactory.createPoisonBladeTexture(),
      shadow: TextureFactory.createShadowTexture(),
      marble: TextureFactory.createMarbleTexture(),
      water: TextureFactory.createWaterTexture(),
      cascade: TextureFactory.createCascadeTexture(),
      foam: TextureFactory.createFoamTexture()
    };
  }

  // Palette sampled directly from the 2D reference sprites so the 3D rig and
  // the pixel art read as the same character.
  //   swordman_idle_strip.png -> helm #b7d1d5 / crest #ebf7f6 / cape #88362d / gambeson #304770
  //   mage_idle_strip.png     -> robe #5b2a85 / hat band #f1cc52 / beard #c5c2bd
  //   rogue_idle_strip.png    -> hood #2f3742 / body #08080e / blade #4a9549
  function buildMaterials(T) {
    return {
      skin: new THREE.MeshStandardMaterial({ color: 0xd9a077, roughness: 0.62, metalness: 0.02 }),
      faceEyes: new THREE.MeshBasicMaterial({ color: 0x0b0c14 }),
      steelPolished: new THREE.MeshStandardMaterial({ map: T.steel, color: 0xc2d6dc, metalness: 0.92, roughness: 0.18 }),
      steelTrim: new THREE.MeshStandardMaterial({ color: 0x6d818c, metalness: 0.9, roughness: 0.3 }),
      helmCrest: new THREE.MeshBasicMaterial({ color: 0xebf7f6 }),
      gambesonBlue: new THREE.MeshStandardMaterial({ map: T.gambeson, color: 0x3c5a8f, roughness: 0.68, metalness: 0.05 }),
      chainmail: new THREE.MeshStandardMaterial({ map: T.chainmail, color: 0x718a8f, metalness: 0.8, roughness: 0.38 }),
      crimsonCape: new THREE.MeshStandardMaterial({ color: 0x8f2f28, roughness: 0.58, metalness: 0.06, side: THREE.DoubleSide }),
      goldTrim: new THREE.MeshStandardMaterial({ color: 0xd8b44a, metalness: 0.9, roughness: 0.28, emissive: 0x6b4a12, emissiveIntensity: 0.2 }),
      leatherBrown: new THREE.MeshStandardMaterial({ map: T.leather, color: 0x7a5334, roughness: 0.62, metalness: 0.08 }),
      leatherDark: new THREE.MeshStandardMaterial({ color: 0x33200f, roughness: 0.75, metalness: 0.12 }),
      swordSteel: new THREE.MeshStandardMaterial({ map: T.steel, color: 0xd8e6ea, metalness: 0.96, roughness: 0.12 }),
      swordGleam: new THREE.MeshBasicMaterial({ color: 0xf0f9ff }),

      magePurple: new THREE.MeshStandardMaterial({ map: T.mageRobe, color: 0x5b2a85, roughness: 0.5, metalness: 0.08 }),
      mageHatDeep: new THREE.MeshStandardMaterial({ color: 0x4a1d6e, roughness: 0.6 }),
      mageTrim: new THREE.MeshStandardMaterial({ color: 0x8e6ab5, roughness: 0.45, metalness: 0.12 }),
      wizardBeard: new THREE.MeshStandardMaterial({ color: 0xbdb7b0, roughness: 0.55, metalness: 0.02 }),
      woodGnarled: new THREE.MeshStandardMaterial({ color: 0x5b3a1c, roughness: 0.88, metalness: 0.04 }),
      arcaneOrb: new THREE.MeshStandardMaterial({ color: 0xc4b5fd, emissive: 0x7c3aed, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.15 }),
      orbHalo: new THREE.MeshBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),

      assassinBlack: new THREE.MeshStandardMaterial({ color: 0x0c0c14, roughness: 0.62, metalness: 0.18 }),
      assassinCowl: new THREE.MeshStandardMaterial({ color: 0x2f3742, roughness: 0.7, side: THREE.DoubleSide }),
      ninjaMask: new THREE.MeshStandardMaterial({ color: 0x08080e, roughness: 0.66 }),
      greenEyes: new THREE.MeshBasicMaterial({ color: 0x8ef27a }),
      poisonBlade: new THREE.MeshStandardMaterial({ map: T.poisonBlade, color: 0x8ef27a, emissive: 0x2f9e44, emissiveIntensity: 1.0, metalness: 0.85, roughness: 0.14 }),
      scarfTeal: new THREE.MeshStandardMaterial({ color: 0x26303a, roughness: 0.72, side: THREE.DoubleSide }),

      contactShadow: new THREE.MeshBasicMaterial({ map: T.shadow, transparent: true, opacity: 0.65, depthWrite: false }),

      // 🏛️ Classical Fantasy Tiered Fountain Materials
      fountainMarble: new THREE.MeshStandardMaterial({ map: T.marble, color: 0x94a3b8, roughness: 0.70, metalness: 0.15 }),
      fountainBasinDark: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.90, metalness: 0.1 }),
      fountainGold: new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.92, roughness: 0.22, emissive: 0x78350f, emissiveIntensity: 0.35 }),
      fountainWater: new THREE.MeshStandardMaterial({ map: T.water, color: 0x0284c7, roughness: 0.05, metalness: 0.22, transparent: true, opacity: 0.88 }),
      fountainCascade: new THREE.MeshStandardMaterial({ map: T.cascade, color: 0xbae6fd, roughness: 0.08, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false }),
      fountainGem: new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.4, roughness: 0.04, metalness: 0.35 }),
      fountainGemAura: new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
      fountainSplash: new THREE.MeshBasicMaterial({ map: T.foam, color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
    };
  }

  // Cloth sheet hanging from y = 0 (the shoulder line) down to y = -length.
  // The sheet sits behind the body (-z), its side edges wrap forward around
  // the shoulders/hips, the hem drapes backward and shallow vertical folds
  // break up the flat surface. Pivoting at the top lets the cape swing from
  // the shoulders like real cloth.
  function buildDrapeGeometry(o) {
    const segX = o.segX || 16;
    const segY = o.segY || 12;
    const folds = o.folds || 3;
    const foldDepth = o.foldDepth !== undefined ? o.foldDepth : 0.4;
    const positions = [];
    const indices = [];
    for (let j = 0; j <= segY; j++) {
      const v = j / segY;
      const halfW = (o.topWidth + (o.bottomWidth - o.topWidth) * v) * 0.5;
      const wrap = o.wrapTop + (o.wrapBottom - o.wrapTop) * v;
      for (let i = 0; i <= segX; i++) {
        const u = (i / segX) * 2 - 1;
        const x = u * halfW;
        const y = -v * o.length;
        const z = -o.drape * Math.pow(v, 1.4) + wrap * u * u - foldDepth * v * Math.cos(u * Math.PI * folds);
        positions.push(x, y, z);
      }
    }
    for (let j = 0; j < segY; j++) {
      for (let i = 0; i < segX; i++) {
        const a = j * (segX + 1) + i;
        const b = a + segX + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  function buildGeometries() {
    return {
      shadowPlane: new THREE.PlaneGeometry(38, 24)
    };
  }

  // --- Main ThreeHeroRenderer Engine ---
  class ThreeHeroRenderer {
    constructor() {
      this.enabled = false;
      this.canvas = document.getElementById('threeCanvas');
      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'threeCanvas';
        const gameCanvas = document.getElementById('gameCanvas');
        if (gameCanvas && gameCanvas.parentNode) {
          gameCanvas.parentNode.insertBefore(this.canvas, gameCanvas.nextSibling);
        } else {
          document.body.appendChild(this.canvas);
        }
      }

      this.width = window.innerWidth;
      this.height = window.innerHeight;

      this.textures = buildTextures();
      this.materials = buildMaterials(this.textures);
      this.geometries = buildGeometries();

      this.scene = new THREE.Scene();

      this.camera = new THREE.OrthographicCamera(
        -this.width / 2, this.width / 2,
        this.height / 2, -this.height / 2,
        -3000, 3000
      );
      this.camera.position.set(0, 0, 1500);
      this.camera.lookAt(0, 0, 0);

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(this.width, this.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setClearColor(0x000000, 0);
      this.canvas.style.display = this.enabled ? 'block' : 'none';

      this.setupLighting();
      this.heroes = new Map();

      // 🏛️ 3D Classical Fantasy Fountain Instance
      this.fountain = new Fountain3DInstance(this);
      this.scene.add(this.fountain.root);
      this.fountain.root.visible = false;

      window.addEventListener('resize', () => this.handleResize());
    }

    setupLighting() {
      // Natural Sky Ambient Light
      this.ambientLight = new THREE.AmbientLight(0xf8fafc, 1.05);
      this.scene.add(this.ambientLight);

      // Main Sun Key Light
      this.sunLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
      this.sunLight.position.set(280, 520, 360);
      this.scene.add(this.sunLight);

      // Cool Specular Rim Light
      this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
      this.rimLight.position.set(-360, 200, -260);
      this.scene.add(this.rimLight);

      // Warm Ground Bounce Light
      this.bounceLight = new THREE.DirectionalLight(0xfef08a, 0.4);
      this.bounceLight.position.set(0, -300, 200);
      this.scene.add(this.bounceLight);
    }

    handleResize() {
      // Hero placement uses the 2D canvas size; the WebGL viewport itself is
      // sized per hero in drawHero()
      this.width = window.innerWidth;
      this.height = window.innerHeight;
    }

    // Advance every hero's animation and placement for this frame. Nothing is
    // drawn here: each hero is composited into the 2D canvas by drawHero()
    // from inside the 2D renderer's depth-sorted pass, so walls and props in
    // front of a hero correctly hide it.
    update(gameState, camera, localPlayerId, attacksMap, dt) {
      // The WebGL canvas is only an offscreen render target now
      if (this.canvas.style.display !== 'none') {
        this.canvas.style.display = 'none';
      }
      if (!this.enabled) return;

      const activeIds = new Set();
      const players = gameState.players || [];

      players.forEach(p => {
        activeIds.add(p.id);
        let hero = this.heroes.get(p.id);
        if (!hero || hero.characterClass !== p.characterClass) {
          if (hero) {
            this.scene.remove(hero.root);
          }
          hero = new Hero3DInstance(p, this);
          this.heroes.set(p.id, hero);
          this.scene.add(hero.root);
        }

        const isLocal = p.id === localPlayerId;
        const attack = attacksMap ? attacksMap.get(p.id) : null;
        const isAttacking = attack && (performance.now() - attack.time < attack.duration);
        const attackProg = isAttacking ? (performance.now() - attack.time) / attack.duration : 0;

        // While swinging, face the locked target exactly (or the attack's
        // 8-way facing when there is no target)
        let attackYaw = null;
        if (isAttacking) {
          if (attack.targetX !== undefined && attack.targetY !== undefined) {
            attackYaw = Hero3DInstance.yawTowards(p.x, p.y, attack.targetX, attack.targetY);
          } else if (attack.facing && Hero3DInstance.FACING_YAW[attack.facing] !== undefined) {
            attackYaw = Hero3DInstance.FACING_YAW[attack.facing];
          }
        }

        hero.update(p, camera, this.width, this.height, dt, isLocal, isAttacking, attackProg, attackYaw, isAttacking ? (attack.side || 1) : 1);
      });

      for (const [id, hero] of this.heroes.entries()) {
        if (!activeIds.has(id)) {
          this.scene.remove(hero.root);
          this.heroes.delete(id);
        }
      }
    }

    // Render a single hero into a small viewport framed around it and paint
    // that image onto the 2D canvas at the hero's ground anchor (screenX,
    // screenY). Returns false if the hero has no 3D model yet.
    drawHero(ctx, playerId, screenX, screenY, zoom) {
      const hero = this.heroes.get(playerId);
      if (!this.enabled || !hero) return false;

      // Generous frame: tall weapons above, the attack swings to the sides
      const halfW = Math.ceil(70 * zoom);
      const up = Math.ceil(115 * zoom);
      const down = Math.ceil(24 * zoom);
      const w = halfW * 2;
      const h = up + down;
      if (this.frameW !== w || this.frameH !== h) {
        this.renderer.setSize(w, h, false);
        this.frameW = w;
        this.frameH = h;
      }

      const root = hero.root.position;
      this.camera.left = root.x - halfW;
      this.camera.right = root.x + halfW;
      this.camera.top = root.y + up;
      this.camera.bottom = root.y - down;
      this.camera.updateProjectionMatrix();

      for (const other of this.heroes.values()) other.root.visible = other === hero;
      if (this.fountain) this.fountain.root.visible = false;
      // The 2D renderer already draws the ground shadow under every player
      if (hero.shadow) hero.shadow.visible = false;
      this.renderer.render(this.scene, this.camera);
      for (const other of this.heroes.values()) other.root.visible = true;

      // root.y sits 1.5*zoom px below the anchor (see Hero3DInstance.update)
      ctx.drawImage(this.canvas, screenX - halfW, screenY + 1.5 * zoom - up, w, h);
      return true;
    }

    // Render the 3D town fountain into an offscreen viewport and composite
    // into the 2D canvas at the fountain obstacle's depth-sorted position
    drawFountain(ctx, screenX, screenY, zoom, time) {
      if (!this.enabled || !this.fountain) return false;

      // Frame sizing covering base plinth (r ~ 36), spray arcs, and apex crystal
      const halfW = Math.ceil(52 * zoom);
      const up = Math.ceil(88 * zoom);
      const down = Math.ceil(32 * zoom);
      const w = halfW * 2;
      const h = up + down;

      if (this.frameW !== w || this.frameH !== h) {
        this.renderer.setSize(w, h, false);
        this.frameW = w;
        this.frameH = h;
      }

      const scale = zoom * 0.92;
      this.fountain.root.scale.set(scale, scale, scale);
      this.fountain.root.position.set(0, 0, 0);

      this.camera.left = -halfW;
      this.camera.right = halfW;
      this.camera.top = up;
      this.camera.bottom = -down;
      this.camera.updateProjectionMatrix();

      // Hide all heroes so only the fountain renders into this pass
      for (const hero of this.heroes.values()) hero.root.visible = false;
      this.fountain.root.visible = true;

      this.fountain.update(time || (performance.now() * 0.001));

      this.renderer.render(this.scene, this.camera);

      // Restore heroes and hide fountain
      for (const hero of this.heroes.values()) hero.root.visible = true;
      this.fountain.root.visible = false;

      // Base stone ring contact plane sits at y=0, perfectly matching (screenX, screenY)
      ctx.drawImage(this.canvas, screenX - halfW, screenY - up, w, h);
      return true;
    }
  }

  // --- 🏛️ Realistic Classical Fantasy 3D Tiered Fountain ---
  class Fountain3DInstance {
    constructor(system) {
      this.system = system;
      this.root = new THREE.Group();

      this.modelContainer = new THREE.Group();
      this.modelContainer.rotation.x = 0.48; // Authentic 2:1 isometric vantage
      this.root.add(this.modelContainer);

      this.buildFountain();
    }

    buildFountain() {
      const M = this.system.materials;

      // 1. Soft Ambient Ground Contact Shadow
      const shadowGeo = new THREE.PlaneGeometry(74, 52);
      const shadowMesh = new THREE.Mesh(shadowGeo, M.contactShadow);
      shadowMesh.rotation.x = -Math.PI * 0.5;
      shadowMesh.position.y = 0.2;
      this.modelContainer.add(shadowMesh);

      // 2. Foundation Plinth Base (Octagonal / Multi-stepped Marble Slabs)
      const base1 = new THREE.Mesh(new THREE.CylinderGeometry(35, 36.5, 3, 24), M.fountainMarble);
      base1.position.y = 1.5;
      this.modelContainer.add(base1);

      const base2 = new THREE.Mesh(new THREE.CylinderGeometry(32.5, 34, 3, 24), M.fountainMarble);
      base2.position.y = 4.5;
      this.modelContainer.add(base2);

      // 3. Lower Basin Wall & Carved Coping Stone Rim
      const basinWall = new THREE.Mesh(new THREE.CylinderGeometry(31, 31.8, 8, 32, 1, false), M.fountainMarble);
      basinWall.position.y = 8.5;
      this.modelContainer.add(basinWall);

      const basinRim = new THREE.Mesh(new THREE.TorusGeometry(31.2, 2.0, 12, 32), M.fountainMarble);
      basinRim.rotation.x = Math.PI * 0.5;
      basinRim.position.y = 12.5;
      this.modelContainer.add(basinRim);

      const rimGold = new THREE.Mesh(new THREE.TorusGeometry(31.2, 0.6, 8, 32), M.fountainGold);
      rimGold.rotation.x = Math.PI * 0.5;
      rimGold.position.y = 11.5;
      this.modelContainer.add(rimGold);

      // 8 Sculpted Pilasters / Brackets with Golden Studs
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const pilaster = new THREE.Mesh(new THREE.BoxGeometry(3.5, 8.5, 3), M.fountainMarble);
        pilaster.position.set(Math.cos(ang) * 31.8, 8.5, Math.sin(ang) * 31.8);
        pilaster.rotation.y = -ang;
        this.modelContainer.add(pilaster);

        const stud = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 8), M.fountainGold);
        stud.position.set(Math.cos(ang) * 33.2, 10.5, Math.sin(ang) * 33.2);
        this.modelContainer.add(stud);
      }

      // Interior Basin Submerged Dark Flagstones
      const floor = new THREE.Mesh(new THREE.CylinderGeometry(29, 29, 1, 32), M.fountainBasinDark);
      floor.position.y = 4.5;
      this.modelContainer.add(floor);

      // Lower Basin Water Surface
      const lowerWater = new THREE.Mesh(new THREE.CylinderGeometry(29, 29, 0.4, 32), M.fountainWater);
      lowerWater.position.y = 10.5;
      this.modelContainer.add(lowerWater);
      this.lowerWater = lowerWater;

      // Concentric Expanding Water Ripples
      this.ripples = [];
      for (let r = 0; r < 2; r++) {
        const rip = new THREE.Mesh(new THREE.TorusGeometry(12 + r * 7, 0.35, 6, 24), M.fountainSplash);
        rip.rotation.x = Math.PI * 0.5;
        rip.position.y = 10.7;
        this.modelContainer.add(rip);
        this.ripples.push({ mesh: rip, baseR: 12 + r * 7, speed: 0.7 + r * 0.3 });
      }

      // 4. Central Monumental Pedestal & Fluted Column Shaft
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(10, 12, 5, 16), M.fountainMarble);
      pedestal.position.y = 7;
      this.modelContainer.add(pedestal);

      const pedTorus = new THREE.Mesh(new THREE.TorusGeometry(9.8, 1.2, 8, 16), M.fountainMarble);
      pedTorus.rotation.x = Math.PI * 0.5;
      pedTorus.position.y = 9.5;
      this.modelContainer.add(pedTorus);

      const column1 = new THREE.Mesh(new THREE.CylinderGeometry(6, 7.2, 16, 16), M.fountainMarble);
      column1.position.y = 17.5;
      this.modelContainer.add(column1);

      // 4 Sculpted Lion-Head Water Spouts + Curved Arcing Water Jets
      this.waterJets = [];
      for (let j = 0; j < 4; j++) {
        const ang = (j / 4) * Math.PI * 2;
        const snout = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.6), M.fountainMarble);
        snout.position.set(Math.cos(ang) * 6.8, 20.5, Math.sin(ang) * 6.8);
        snout.rotation.y = -ang;
        this.modelContainer.add(snout);

        const lionMask = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.8, 4), M.fountainGold);
        lionMask.rotation.x = Math.PI * 0.5;
        lionMask.position.set(Math.cos(ang) * 8.0, 20.5, Math.sin(ang) * 8.0);
        lionMask.rotation.y = -ang;
        this.modelContainer.add(lionMask);

        // Arcing Water Jet Curve (mouth -> crest -> lower pool)
        const p0 = new THREE.Vector3(Math.cos(ang) * 7.5, 20.5, Math.sin(ang) * 7.5);
        const p1 = new THREE.Vector3(Math.cos(ang) * 14.5, 22.8, Math.sin(ang) * 14.5);
        const p2 = new THREE.Vector3(Math.cos(ang) * 23.0, 10.7, Math.sin(ang) * 23.0);
        const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
        const jetGeo = new THREE.TubeGeometry(curve, 16, 0.7, 8, false);
        const jetMesh = new THREE.Mesh(jetGeo, M.fountainCascade);
        this.modelContainer.add(jetMesh);
        this.waterJets.push(jetMesh);

        // Foam landing circle
        const splash = new THREE.Mesh(new THREE.CircleGeometry(2.2, 8), M.fountainSplash);
        splash.rotation.x = -Math.PI * 0.5;
        splash.position.copy(p2);
        splash.position.y = 10.8;
        this.modelContainer.add(splash);
      }

      // 5. Tier 2: Mid-Tier Scalloped Bowl (Tier 2 Basin)
      const midBase = new THREE.Mesh(new THREE.CylinderGeometry(14, 6, 5, 16), M.fountainMarble);
      midBase.position.y = 28;
      this.modelContainer.add(midBase);

      const midBowl = new THREE.Mesh(new THREE.CylinderGeometry(17, 13.5, 5, 24), M.fountainMarble);
      midBowl.position.y = 33;
      this.modelContainer.add(midBowl);

      const midRim = new THREE.Mesh(new THREE.TorusGeometry(17.2, 1.4, 8, 24), M.fountainMarble);
      midRim.rotation.x = Math.PI * 0.5;
      midRim.position.y = 35.5;
      this.modelContainer.add(midRim);

      const midGold = new THREE.Mesh(new THREE.TorusGeometry(17.2, 0.45, 8, 24), M.fountainGold);
      midGold.rotation.x = Math.PI * 0.5;
      midGold.position.y = 34.8;
      this.modelContainer.add(midGold);

      const midWater = new THREE.Mesh(new THREE.CylinderGeometry(15.6, 15.6, 0.4, 24), M.fountainWater);
      midWater.position.y = 34.5;
      this.modelContainer.add(midWater);
      this.midWater = midWater;

      // Cascading Waterfall Curtain (Mid Bowl -> Lower Pool)
      const midCascade = new THREE.Mesh(new THREE.CylinderGeometry(17.2, 19.5, 23.5, 24, 1, true), M.fountainCascade);
      midCascade.position.y = 22.8;
      this.modelContainer.add(midCascade);
      this.midCascade = midCascade;

      // 6. Tier 3: Upper Pedestal & Crown Chalice (Tier 3 Basin)
      const col2 = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.8, 11, 16), M.fountainMarble);
      col2.position.y = 40;
      this.modelContainer.add(col2);

      const colGold = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.6, 8, 16), M.fountainGold);
      colGold.rotation.x = Math.PI * 0.5;
      colGold.position.y = 40;
      this.modelContainer.add(colGold);

      const topBowl = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 3.8, 4.5, 16), M.fountainMarble);
      topBowl.position.y = 47.5;
      this.modelContainer.add(topBowl);

      const topRim = new THREE.Mesh(new THREE.TorusGeometry(9.6, 0.9, 8, 16), M.fountainGold);
      topRim.rotation.x = Math.PI * 0.5;
      topRim.position.y = 49.8;
      this.modelContainer.add(topRim);

      const topWater = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 0.4, 16), M.fountainWater);
      topWater.position.y = 49.2;
      this.modelContainer.add(topWater);
      this.topWater = topWater;

      // Cascading Waterfall Curtain (Top Chalice -> Mid Bowl)
      const topCascade = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 11.8, 14.5, 16, 1, true), M.fountainCascade);
      topCascade.position.y = 42;
      this.modelContainer.add(topCascade);
      this.topCascade = topCascade;

      // 7. Apex Arcane Geyser Spout & Hovering Aquatic Crystal
      const geyser = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.5, 8, 12), M.fountainCascade);
      geyser.position.y = 53.5;
      this.modelContainer.add(geyser);
      this.geyser = geyser;

      const geyserCrest = new THREE.Mesh(new THREE.SphereGeometry(2.0, 8, 8), M.fountainSplash);
      geyserCrest.position.y = 57.5;
      this.modelContainer.add(geyserCrest);
      this.geyserCrest = geyserCrest;

      // Faceted Aquatic Power Crystal
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(3.4, 0), M.fountainGem);
      crystal.position.y = 62;
      this.modelContainer.add(crystal);
      this.crystal = crystal;

      // Levitating Arcane Orbital Halo Ring
      const halo = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.35, 8, 24), M.fountainGemAura);
      halo.position.y = 62;
      halo.rotation.x = 0.8;
      this.modelContainer.add(halo);
      this.halo = halo;

      // Mystical Aquatic Point Light
      const light = new THREE.PointLight(0x38bdf8, 1.8, 70);
      light.position.set(0, 62, 10);
      this.modelContainer.add(light);
      this.light = light;

      // 8. Dynamic Sparkling Splash Droplets
      this.splashDrops = [];
      for (let d = 0; d < 8; d++) {
        const drop = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 6), M.fountainSplash);
        const ang = (d / 8) * Math.PI * 2;
        drop.userData = {
          ang: ang,
          radius: 20 + (d % 3) * 3,
          phase: (d * 1.3) % (Math.PI * 2),
          speed: 4.5 + (d % 4) * 0.8
        };
        this.modelContainer.add(drop);
        this.splashDrops.push(drop);
      }
    }

    update(time) {
      const T = this.system.textures;
      // Flowing downward water cascade texture scrolling
      if (T && T.cascade) {
        T.cascade.offset.y = -time * 1.5;
      }
      if (T && T.water) {
        T.water.offset.x = Math.sin(time * 0.4) * 0.06;
        T.water.offset.y = Math.cos(time * 0.3) * 0.06;
      }

      // Gentle water level undulation
      if (this.lowerWater) this.lowerWater.position.y = 10.5 + Math.sin(time * 3) * 0.15;
      if (this.midWater) this.midWater.position.y = 34.5 + Math.sin(time * 3 + 1) * 0.12;
      if (this.topWater) this.topWater.position.y = 49.2 + Math.sin(time * 4) * 0.1;

      // Expanding ripple rings
      if (this.ripples) {
        this.ripples.forEach((r, idx) => {
          const ripProg = ((time * r.speed) + idx * 0.5) % 1.0;
          const scale = 1.0 + ripProg * 0.45;
          r.mesh.scale.set(scale, scale, 1);
          if (r.mesh.material) {
            r.mesh.material.opacity = (1 - ripProg) * 0.6;
          }
        });
      }

      // Pulsing apex geyser jet
      if (this.geyser) {
        const surge = 1 + 0.22 * Math.sin(time * 7);
        this.geyser.scale.set(1 + 0.1 * Math.cos(time * 6), surge, 1 + 0.1 * Math.sin(time * 6));
      }
      if (this.geyserCrest) {
        this.geyserCrest.position.y = 57.5 + Math.sin(time * 7) * 0.9;
        const s = 1 + 0.15 * Math.sin(time * 9);
        this.geyserCrest.scale.set(s, s, s);
      }

      // Floating and rotating arcane crystal
      if (this.crystal) {
        this.crystal.position.y = 62 + Math.sin(time * 2.8) * 1.6;
        this.crystal.rotation.y = time * 1.4;
        this.crystal.rotation.z = Math.sin(time * 1.8) * 0.15;
      }
      if (this.halo) {
        this.halo.position.y = this.crystal ? this.crystal.position.y : 62;
        this.halo.rotation.x = 0.8 + Math.sin(time * 2) * 0.25;
        this.halo.rotation.y = time * 2.4;
      }
      if (this.light && this.crystal) {
        this.light.position.y = this.crystal.position.y;
        this.light.intensity = 1.6 + 0.4 * Math.sin(time * 5);
      }

      // Bouncing water splash droplets
      if (this.splashDrops) {
        this.splashDrops.forEach(drop => {
          const d = drop.userData;
          const bounce = Math.abs(Math.sin(time * d.speed + d.phase));
          drop.position.x = Math.cos(d.ang) * d.radius;
          drop.position.z = Math.sin(d.ang) * d.radius;
          drop.position.y = 10.8 + bounce * 3.5;
          const s = 0.6 + bounce * 0.4;
          drop.scale.set(s, s, s);
        });
      }
    }
  }

  // --- Hero 3D Instance with Articulated Kinematic Skeleton ---
  class Hero3DInstance {
    constructor(player, system) {
      this.player = player;
      this.system = system;
      this.characterClass = player.characterClass || 'warrior';
      this.walkTime = 0;
      this.currentYaw = 0;

      this.root = new THREE.Group();
      this.buildModel();
    }

    buildModel() {
      const M = this.system.materials;
      const G = this.system.geometries;

      // Realistic Ground Contact Shadow
      const shadow = new THREE.Mesh(G.shadowPlane, M.contactShadow);
      shadow.rotation.x = -Math.PI * 0.5;
      shadow.position.y = 0.3;
      this.root.add(shadow);
      this.shadow = shadow;

      // Model container tilted forward for authentic 3/4 isometric vantage
      this.modelContainer = new THREE.Group();
      this.modelContainer.rotation.x = 0.28;
      this.root.add(this.modelContainer);

      // Per-class body metrics derived from the 2D reference sprites.
      //   warrior -> swordman_idle_strip.png : 215px tall  (heroic, ~10 heads)
      //   mage    -> mage_idle_strip.png     : 168px tall  (short, wide-brimmed)
      //   rogue   -> rogue_idle_strip.png    : 204px tall  (hunched, hooded)
      // `pelvisBaseY` is the hip-joint height; every leg length is derived from
      // it so the boots always land exactly on the ground plane (y = 0).
      const METRICS = {
        warrior: { pelvisBaseY: 21.9, thigh: 9.6, shin: 7.3, boot: 4.6, height: 54 },
        mage: { pelvisBaseY: 18.2, thigh: 8.4, shin: 6.2, boot: 3.6, height: 43 },
        rogue: { pelvisBaseY: 20.4, thigh: 9.0, shin: 7.2, boot: 3.8, height: 50 }
      };
      const metrics = METRICS[this.characterClass] || METRICS.warrior;
      this.pelvisBaseY = metrics.pelvisBaseY;
      this.metrics = metrics;

      // Pelvis / Hips (Root of humanoid skeletal hierarchy)
      this.pelvis = new THREE.Group();
      this.pelvis.position.y = metrics.pelvisBaseY;
      this.modelContainer.add(this.pelvis);

      if (this.characterClass === 'warrior') {
        this.buildWarrior(M);
      } else if (this.characterClass === 'mage') {
        this.buildMage(M);
      } else {
        this.buildRogue(M);
      }

      // Pose the model in its idle stance first: the grounding reference has to
      // be taken from the pose the player actually sees.
      if (this.animate) this.animate(0.016, false, false, 0);

      this.groundModel();
    }

    // The 3/4 view tilt (modelContainer.rotation.x) swings the feet below the
    // contact shadow, so lift the whole model until its lowest vertex rests on
    // the shadow plane. The resulting visual height is exported so the class
    // preview can frame the camera around the real silhouette.
    groundModel() {
      const GROUND_Y = 0.3; // matches the contact shadow plane
      this.modelContainer.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(this.modelContainer);
      if (!isFinite(box.min.y) || !isFinite(box.max.y)) return;
      this.modelHeight = box.max.y - box.min.y;
      this.modelContainer.position.y += GROUND_Y - box.min.y;
      this.modelContainer.updateMatrixWorld(true);
    }

    // ==========================================
    // ⚔️ WARRIOR: 2D SPRITE REPLICA (swordman_idle_strip.png)
    // 54 units tall / ~10 heads tall. Silhouette: tall polished steel cone-helm
    // with a bright crest, bare arms, heavy crimson cape over a muted blue
    // gambeson, leather belt and boots.
    // ==========================================
    buildWarrior(M) {
      const mt = this.metrics;

      // 1. Pelvis, Hauberk & Blue Gambeson Skirt
      const pelvisMesh = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 3.7, 5.0, 12), M.chainmail);
      this.pelvis.add(pelvisMesh);

      // Royal Blue Gambeson Skirt (visible below the mantle)
      this.fauldSkirt = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.0, 7.0, 12, 1, true), M.gambesonBlue);
      this.fauldSkirt.position.y = -2.6;
      this.pelvis.add(this.fauldSkirt);

      // Studded Leather War Belt with Lion Buckle
      const belt = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 2.0, 14), M.leatherBrown);
      belt.position.y = 3.2;
      this.pelvis.add(belt);

      const buckle = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 1.0), M.goldTrim);
      buckle.position.set(0, 3.2, 4.2);
      this.pelvis.add(buckle);

      // 2. Spine / Torso (Articulated at waist)
      this.torsoGroup = new THREE.Group();
      this.torsoGroup.position.y = 5.0;
      this.pelvis.add(this.torsoGroup);

      // Royal Blue Padded Gambeson Under-Armor
      const underArmor = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.0, 10.5, 12), M.gambesonBlue);
      underArmor.position.y = 5.4;
      this.torsoGroup.add(underArmor);

      // Anatomical Curved Steel Cuirass (Breastplate)
      const cuirass = new THREE.Mesh(new THREE.CylinderGeometry(4.9, 4.3, 9.0, 12, 1, false, -Math.PI * 0.5, Math.PI), M.steelPolished);
      cuirass.position.set(0, 5.8, 0.3);
      this.torsoGroup.add(cuirass);

      const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.0, 8.6, 1.3), M.steelTrim);
      ridge.position.set(0, 5.8, 4.3);
      this.torsoGroup.add(ridge);

      // 3. Flowing Crimson Mantle - the signature of the sprite silhouette.
      //    Hangs from the shoulders (pivot at the top) down to the ankles and
      //    flares gently toward the hem, leaving the front of the body open.
      this.cape = new THREE.Group();
      this.cape.position.set(0, 12.4, -5.0);
      this.torsoGroup.add(this.cape);

      this.cape.add(new THREE.Mesh(buildDrapeGeometry({
        topWidth: 11.0, bottomWidth: 17.0, length: 36.0,
        wrapTop: 3.4, wrapBottom: 4.2, drape: 3.0, folds: 3, foldDepth: 0.5
      }), M.crimsonCape));

      // Mantle collar resting on the pauldrons
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5.6, 2.4, 18, 1, true, Math.PI * 0.3, Math.PI * 1.4), M.crimsonCape);
      collar.position.set(0, 12.6, -0.6);
      this.torsoGroup.add(collar);

      for (const dir of [-1, 1]) {
        const brooch = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.6, 10), M.goldTrim);
        brooch.position.set(dir * 3.4, 12.2, 4.0);
        brooch.rotation.x = Math.PI * 0.5;
        this.torsoGroup.add(brooch);
      }

      // 4. Head, Face & Norman Pointed Nasal Helmet
      this.headGroup = new THREE.Group();
      this.headGroup.position.set(0, 15.2, 0);
      this.torsoGroup.add(this.headGroup);

      const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 2.4, 10), M.skin);
      neck.position.y = 1.4;
      this.headGroup.add(neck);

      // Resolute Face below the helmet brim (the sprite's face is clearly visible)
      const faceGroup = new THREE.Group();
      faceGroup.position.set(0, 4.4, 0.2);
      this.headGroup.add(faceGroup);

      const faceHead = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.3, 4.6, 12), M.skin);
      faceGroup.add(faceHead);

      for (const dir of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.4), M.faceEyes);
        eye.position.set(dir * 1.1, 0.5, 2.55);
        faceGroup.add(eye);

        const brow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.4), M.leatherDark);
        brow.position.set(dir * 1.1, 1.2, 2.6);
        brow.rotation.z = -dir * 0.12;
        faceGroup.add(brow);
      }

      // Rounded Norman Dome with a short point, sitting on top of the head
      const helmCone = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.15, 12.6),
        new THREE.Vector2(0.7, 11.9),
        new THREE.Vector2(1.6, 11.1),
        new THREE.Vector2(2.4, 10.2),
        new THREE.Vector2(3.0, 9.0),
        new THREE.Vector2(3.3, 7.7),
        new THREE.Vector2(3.4, 6.4),
        new THREE.Vector2(3.45, 5.8)
      ], 16), M.steelPolished);
      helmCone.position.set(0, 0, 0.1);
      this.headGroup.add(helmCone);

      // Brow Band
      const helmBand = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.9, 16, 1, true), M.steelTrim);
      helmBand.position.set(0, 6.1, 0.1);
      this.headGroup.add(helmBand);

      // Luminous Crest Ring (the near-white cyan specular band on the sprite helm)
      const crest = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.22, 6, 16), M.helmCrest);
      crest.rotation.x = Math.PI * 0.5;
      crest.position.set(0, 9.6, 0.1);
      this.headGroup.add(crest);

      // Central Nasal Guard (Descending down between eyes)
      const nasalGuard = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.4, 0.6), M.steelPolished);
      nasalGuard.position.set(0, 5.0, 3.1);
      this.headGroup.add(nasalGuard);

      // Cheek Flaps & Aventail
      for (const dir of [-1, 1]) {
        const cheekPlate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.0, 2.4), M.steelPolished);
        cheekPlate.position.set(dir * 3.0, 4.4, 0.4);
        this.headGroup.add(cheekPlate);
      }
      const aventail = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.6, 3.2, 12, 1, true, Math.PI * 0.6, Math.PI * 0.8), M.steelTrim);
      aventail.position.set(0, 4.0, 0.1);
      this.headGroup.add(aventail);

      // 5. Articulated Legs: Hip -> Knee Joint -> Ankle Joint -> Boot
      for (const side of ['L', 'R']) {
        const dir = side === 'L' ? -1 : 1;

        this['leg' + side] = new THREE.Group();
        this['leg' + side].position.set(dir * 3.0, 0, 0);
        this.pelvis.add(this['leg' + side]);

        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.1, mt.thigh, 10), M.gambesonBlue);
        thigh.position.y = -mt.thigh * 0.5;
        this['leg' + side].add(thigh);

        this['knee' + side] = new THREE.Group();
        this['knee' + side].position.set(0, -mt.thigh, 0);
        this['leg' + side].add(this['knee' + side]);

        const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(1.9, 8, 8), M.steelPolished);
        kneeCap.position.set(0, 0, 1.2);
        this['knee' + side].add(kneeCap);

        const calf = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 1.6, mt.shin, 10), M.leatherBrown);
        calf.position.y = -mt.shin * 0.5;
        this['knee' + side].add(calf);

        this['ankle' + side] = new THREE.Group();
        this['ankle' + side].position.set(0, -mt.shin, 0);
        this['knee' + side].add(this['ankle' + side]);

        const boot = new THREE.Mesh(new THREE.BoxGeometry(3.6, mt.boot, 7.4), M.leatherDark);
        boot.position.set(0, -mt.boot * 0.5, 1.8);
        this['ankle' + side].add(boot);

        const bootCuff = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.1, 2.0, 10), M.leatherBrown);
        bootCuff.position.set(0, -0.6, 0);
        this['ankle' + side].add(bootCuff);
      }

      // 6. Articulated Arms: Shoulder -> Elbow Joint -> Wrist -> Hand
      for (const side of ['L', 'R']) {
        const dir = side === 'L' ? -1 : 1;

        this['arm' + side] = new THREE.Group();
        this['arm' + side].position.set(dir * 4.4, 12.0, 0);
        this.torsoGroup.add(this['arm' + side]);

        // Bare upper arm (the sprite shows skin between the pauldrons and bracers)
        const bicep = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.6, 7.0, 10), M.skin);
        bicep.position.y = -3.5;
        this['arm' + side].add(bicep);

        const pauldron = new THREE.Mesh(new THREE.SphereGeometry(2.6, 10, 8, 0, Math.PI, 0, Math.PI * 0.72), M.steelPolished);
        pauldron.position.set(-dir * 0.7, 0.8, 0);
        pauldron.rotation.set(0, 0, dir * 0.45);
        this['arm' + side].add(pauldron);

        this['forearm' + side] = new THREE.Group();
        this['forearm' + side].position.set(0, -7.0, 0);
        this['arm' + side].add(this['forearm' + side]);

        const gauntlet = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.4, 6.6, 10), M.leatherBrown);
        gauntlet.position.y = -3.3;
        this['forearm' + side].add(gauntlet);

        const cuff = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.7, 1.6, 10), M.leatherDark);
        cuff.position.y = -0.8;
        this['forearm' + side].add(cuff);

        this['hand' + side] = new THREE.Group();
        this['hand' + side].position.set(0, -6.8, 0.4);
        this['forearm' + side].add(this['hand' + side]);
        this['hand' + side].add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.4), M.skin));
      }

      // 7. Grand Two-Handed Broadsword (Attached to Right Hand, gripped with Both Hands)
      this.weapon = new THREE.Group();
      this.weapon.position.set(0, -1.0, 0.6);
      this.handR.add(this.weapon);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(3.6, 22, 0.9), M.swordSteel);
      blade.position.set(0, 15.5, 0);
      this.weapon.add(blade);

      const fullerGroove = new THREE.Mesh(new THREE.BoxGeometry(1.1, 18, 1.0), M.steelTrim);
      fullerGroove.position.set(0, 14, 0);
      this.weapon.add(fullerGroove);

      const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(1.7, 4.5, 4), M.swordSteel);
      bladeTip.position.set(0, 28.5, 0);
      bladeTip.rotation.y = Math.PI * 0.25;
      this.weapon.add(bladeTip);

      this.bladeGleam = new THREE.Mesh(new THREE.OctahedronGeometry(1.0, 0), M.swordGleam);
      this.bladeGleam.position.set(0, 24, 0.6);
      this.weapon.add(this.bladeGleam);

      const crossguard = new THREE.Mesh(new THREE.BoxGeometry(9.0, 1.6, 1.8), M.steelPolished);
      crossguard.position.set(0, 4.5, 0);
      this.weapon.add(crossguard);

      for (const dir of [-1, 1]) {
        const finial = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 8), M.goldTrim);
        finial.position.set(dir * 4.5, 4.5, 0);
        this.weapon.add(finial);
      }

      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 8, 8), M.leatherBrown);
      grip.position.set(0, -0.5, 0);
      this.weapon.add(grip);

      const pommel = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 10), M.steelPolished);
      pommel.position.set(0, -5.0, 0);
      this.weapon.add(pommel);
    }

    // ==========================================
    // 🔮 MAGE: 2D SPRITE REPLICA (mage_idle_strip.png)
    // 42 units tall - clearly shorter and rounder than the warrior. Silhouette:
    // wide floppy conical hat with a gold band, pale beard, and a bell-shaped
    // purple robe that flares all the way to the floor.
    // ==========================================
    buildMage(M) {
      const mt = this.metrics;

      // Bell-Shaped Robe reaching the floor.
      // The sprite silhouette is one continuous bell from the shoulders down -
      // there is no narrow waist - so it is revolved from a profile curve.
      this.fauldSkirt = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(5.0, 7.0),
        new THREE.Vector2(5.2, 4.0),
        new THREE.Vector2(5.5, 0.0),
        new THREE.Vector2(6.1, -5.0),
        new THREE.Vector2(6.9, -10.0),
        new THREE.Vector2(7.6, -14.0),
        new THREE.Vector2(8.1, -17.0),
        new THREE.Vector2(8.2, -17.9)
      ], 24), M.magePurple);
      this.fauldSkirt.position.y = 0;
      this.pelvis.add(this.fauldSkirt);

      // Gold hem along the bottom of the robe
      const hem = new THREE.Mesh(new THREE.TorusGeometry(8.1, 0.35, 6, 24), M.goldTrim);
      hem.rotation.x = Math.PI * 0.5;
      hem.position.y = -17.3;
      this.fauldSkirt.add(hem);

      const belt = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 1.6, 20), M.leatherBrown);
      belt.position.y = 2.4;
      this.pelvis.add(belt);

      this.torsoGroup = new THREE.Group();
      this.torsoGroup.position.y = 4.0;
      this.pelvis.add(this.torsoGroup);

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.1, 8.0, 18), M.magePurple);
      torso.position.y = 3.0;
      this.torsoGroup.add(torso);

      // Rounded robe shoulders
      const shoulderMantle = new THREE.Mesh(new THREE.SphereGeometry(5.0, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), M.magePurple);
      shoulderMantle.scale.set(1.05, 0.45, 0.8);
      shoulderMantle.position.y = 6.8;
      this.torsoGroup.add(shoulderMantle);

      const collar = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.5, 6, 16), M.goldTrim);
      collar.position.set(0, 8.4, 0);
      collar.rotation.x = Math.PI * 0.5;
      this.torsoGroup.add(collar);

      // Head & Pale Wizard Beard
      this.headGroup = new THREE.Group();
      this.headGroup.position.set(0, 8.4, 0);
      this.torsoGroup.add(this.headGroup);

      const faceHead = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.3, 4.4, 12), M.skin);
      faceHead.position.set(0, 2.4, 0.2);
      this.headGroup.add(faceHead);

      for (const dir of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.4), M.faceEyes);
        eye.position.set(dir * 1.0, 3.2, 2.55);
        this.headGroup.add(eye);

        const brow = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.5), M.wizardBeard);
        brow.position.set(dir * 1.0, 3.9, 2.55);
        brow.rotation.z = dir * 0.15;
        this.headGroup.add(brow);
      }

      this.beard = new THREE.Group();
      this.beard.position.set(0, 2.2, 2.0);
      this.headGroup.add(this.beard);

      const mustache = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 1.0), M.wizardBeard);
      mustache.position.set(0, 0.2, 0.5);
      this.beard.add(mustache);

      // Wide at the jaw, tapering to a point on the chest
      const mainBeard = new THREE.Mesh(new THREE.ConeGeometry(2.4, 6.0, 10, 3), M.wizardBeard);
      mainBeard.position.set(0, -2.8, 0.2);
      mainBeard.rotation.x = Math.PI;
      this.beard.add(mainBeard);

      // Wide-Brimmed Pointed Wizard Hat with Gold Band
      const hatGroup = new THREE.Group();
      hatGroup.position.set(0, 4.5, 0.1);
      hatGroup.rotation.set(-0.08, 0, 0.12);
      this.headGroup.add(hatGroup);

      const brim = new THREE.Mesh(new THREE.CylinderGeometry(6.0, 6.2, 0.5, 24), M.mageHatDeep);
      brim.position.y = 0.2;
      hatGroup.add(brim);

      const brimTrim = new THREE.Mesh(new THREE.TorusGeometry(6.1, 0.25, 6, 24), M.mageTrim);
      brimTrim.rotation.x = Math.PI * 0.5;
      brimTrim.position.y = 0.2;
      hatGroup.add(brimTrim);

      const hatCone = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.2, 10.5),
        new THREE.Vector2(1.0, 9.0),
        new THREE.Vector2(1.8, 7.2),
        new THREE.Vector2(2.6, 5.0),
        new THREE.Vector2(3.2, 2.6),
        new THREE.Vector2(3.5, 0.4)
      ], 18), M.mageHatDeep);
      hatGroup.add(hatCone);

      // Antique Gold Hat Band
      const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.55, 1.0, 16), M.goldTrim);
      hatBand.position.y = 1.1;
      hatGroup.add(hatBand);

      // Articulated Legs underneath the robe
      for (const side of ['L', 'R']) {
        const dir = side === 'L' ? -1 : 1;

        this['leg' + side] = new THREE.Group();
        this['leg' + side].position.set(dir * 2.8, 0, 0);
        this.pelvis.add(this['leg' + side]);

        this['knee' + side] = new THREE.Group();
        this['knee' + side].position.set(0, -mt.thigh, 0);
        this['leg' + side].add(this['knee' + side]);

        this['ankle' + side] = new THREE.Group();
        this['ankle' + side].position.set(0, -mt.shin, 0);
        this['knee' + side].add(this['ankle' + side]);

        const foot = new THREE.Mesh(new THREE.BoxGeometry(3.2, mt.boot, 6.0), M.leatherDark);
        foot.position.set(0, -mt.boot * 0.5, 1.4);
        this['ankle' + side].add(foot);
      }

      // Arms & Gnarled Staff
      for (const side of ['L', 'R']) {
        const dir = side === 'L' ? -1 : 1;

        this['arm' + side] = new THREE.Group();
        this['arm' + side].position.set(dir * 5.4, 6.4, 0);
        this.torsoGroup.add(this['arm' + side]);

        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.6, 8.0, 12), M.magePurple);
        sleeve.position.y = -4.0;
        this['arm' + side].add(sleeve);

        this['forearm' + side] = new THREE.Group();
        this['forearm' + side].position.set(0, -7.6, 0);
        this['arm' + side].add(this['forearm' + side]);

        const cuff = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.4, 1.0, 12), M.goldTrim);
        cuff.position.y = -0.4;
        this['forearm' + side].add(cuff);

        this['hand' + side] = new THREE.Group();
        this['hand' + side].position.set(0, -1.9, 0.3);
        this['forearm' + side].add(this['hand' + side]);
        this['hand' + side].add(new THREE.Mesh(new THREE.SphereGeometry(1.3, 8, 8), M.skin));
      }

      // Staff - held upright at the sprite's right side, foot near the ground
      this.weapon = new THREE.Group();
      this.weapon.position.set(0, 0, 0.6);
      this.weapon.rotation.z = -0.30;
      this.handR.add(this.weapon);

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 34, 8), M.woodGnarled);
      shaft.position.set(0, 2, 0);
      this.weapon.add(shaft);

      // Claws flare out around the shaft and cradle the orb, like the
      // sprite's gnarled staff head.
      for (let c = 0; c < 4; c++) {
        const cAngle = c * Math.PI * 0.5;
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.6, 4, 2), M.woodGnarled);
        claw.position.set(Math.cos(cAngle) * 1.5, 20.0, Math.sin(cAngle) * 1.5);
        claw.rotation.set(Math.sin(cAngle) * 0.4, 0, -Math.cos(cAngle) * 0.4);
        this.weapon.add(claw);
      }

      this.arcaneOrb = new THREE.Mesh(new THREE.SphereGeometry(2.4, 14, 14), M.arcaneOrb);
      this.arcaneOrb.position.set(0, 21.4, 0);
      this.weapon.add(this.arcaneOrb);

      this.orbHalo = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.22, 6, 16), M.orbHalo);
      this.orbHalo.rotation.x = Math.PI * 0.5;
      this.orbHalo.position.set(0, 21.4, 0);
      this.weapon.add(this.orbHalo);
    }

    // ==========================================
    // 🗡️ ROGUE: 2D SPRITE REPLICA (rogue_idle_strip.png)
    // 51 units tall. Silhouette: peaked slate hood over a near-black masked
    // body, narrow legs and bright green poison daggers held low at the hip.
    // ==========================================
    buildRogue(M) {
      const mt = this.metrics;

      const pelvisMesh = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.0, 5.0, 12), M.assassinBlack);
      this.pelvis.add(pelvisMesh);

      const belt = new THREE.Mesh(new THREE.CylinderGeometry(4.9, 4.9, 2.0, 12), M.leatherDark);
      belt.position.y = 2.8;
      this.pelvis.add(belt);

      const buckle = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 0.8), M.steelTrim);
      buckle.position.set(0, 2.8, 4.6);
      this.pelvis.add(buckle);

      this.torsoGroup = new THREE.Group();
      this.torsoGroup.position.y = 5.0;
      this.pelvis.add(this.torsoGroup);

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 4.4, 11.0, 12), M.assassinBlack);
      torso.position.y = 5.6;
      this.torsoGroup.add(torso);

      const harness = new THREE.Mesh(new THREE.BoxGeometry(9.5, 1.4, 9.5), M.leatherBrown);
      harness.position.set(0, 5.0, 0);
      harness.rotation.z = 0.45;
      this.torsoGroup.add(harness);

      const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(4.0, 6.0, 1.2), M.assassinCowl);
      chestPlate.position.set(0, 6.0, 4.2);
      this.torsoGroup.add(chestPlate);

      // Dark cloak hanging behind the body down to the knees.
      this.cape = new THREE.Group();
      this.cape.position.set(0, 11.2, -5.6);
      this.torsoGroup.add(this.cape);

      this.cape.add(new THREE.Mesh(buildDrapeGeometry({
        topWidth: 10.0, bottomWidth: 14.0, length: 25.0,
        wrapTop: 3.2, wrapBottom: 3.6, drape: 2.4, folds: 2, foldDepth: 0.4
      }), M.assassinCowl));

      // Peaked Hood & Mask
      this.headGroup = new THREE.Group();
      this.headGroup.position.set(0, 12.2, 0);
      this.torsoGroup.add(this.headGroup);

      const faceHead = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.3, 4.6, 12), M.skin);
      faceHead.position.set(0, 3.4, 0.2);
      this.headGroup.add(faceHead);

      // Cowl open at the front (lathe phi 0 faces +z) so the masked face shows,
      // with a short blunt peak at the top like the sprite.
      const hoodMesh = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.3, 8.6),
        new THREE.Vector2(1.6, 8.3),
        new THREE.Vector2(2.8, 7.4),
        new THREE.Vector2(3.4, 6.0),
        new THREE.Vector2(3.6, 4.2),
        new THREE.Vector2(3.7, 2.4),
        new THREE.Vector2(4.4, 0.8),
        new THREE.Vector2(5.4, -0.4)
      ], 16, Math.PI * 0.26, Math.PI * 1.48), M.assassinCowl);
      this.headGroup.add(hoodMesh);

      const hoodPeak = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.4, 8), M.assassinCowl);
      hoodPeak.position.set(0, 8.8, -1.0);
      hoodPeak.rotation.x = -0.5;
      this.headGroup.add(hoodPeak);

      // Lower-face mask up to the bridge of the nose
      const mask = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.4, 2.6, 12, 1, false, -Math.PI * 0.5, Math.PI), M.ninjaMask);
      mask.position.set(0, 2.3, 0.25);
      this.headGroup.add(mask);

      for (const dir of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.4), M.greenEyes);
        eye.position.set(dir * 1.05, 4.1, 2.75);
        this.headGroup.add(eye);
      }

      // Articulated Legs
      for (const side of ['L', 'R']) {
        const dir = side === 'L' ? -1 : 1;

        this['leg' + side] = new THREE.Group();
        this['leg' + side].position.set(dir * 2.9, 0, 0);
        this.pelvis.add(this['leg' + side]);

        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 1.9, mt.thigh, 10), M.assassinBlack);
        thigh.position.y = -mt.thigh * 0.5;
        this['leg' + side].add(thigh);

        this['knee' + side] = new THREE.Group();
        this['knee' + side].position.set(0, -mt.thigh, 0);
        this['leg' + side].add(this['knee' + side]);

        const calf = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.5, mt.shin, 10), M.assassinCowl);
        calf.position.y = -mt.shin * 0.5;
        this['knee' + side].add(calf);

        this['ankle' + side] = new THREE.Group();
        this['ankle' + side].position.set(0, -mt.shin, 0);
        this['knee' + side].add(this['ankle' + side]);

        const boot = new THREE.Mesh(new THREE.BoxGeometry(3.4, mt.boot, 6.8), M.ninjaMask);
        boot.position.set(0, -mt.boot * 0.5, 1.6);
        this['ankle' + side].add(boot);
      }

      // Arms & Dual Daggers
      for (const side of ['L', 'R']) {
        const dir = side === 'L' ? -1 : 1;

        this['arm' + side] = new THREE.Group();
        this['arm' + side].position.set(dir * 5.4, 11.0, 0);
        this.torsoGroup.add(this['arm' + side]);

        const bicep = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.5, 6.6, 10), M.assassinBlack);
        bicep.position.y = -3.3;
        this['arm' + side].add(bicep);

        const pauldron = new THREE.Mesh(new THREE.SphereGeometry(2.3, 10, 8, 0, Math.PI, 0, Math.PI * 0.72), M.assassinCowl);
        pauldron.position.set(-dir * 0.6, 0.7, 0);
        pauldron.rotation.set(0, 0, dir * 0.45);
        this['arm' + side].add(pauldron);

        this['forearm' + side] = new THREE.Group();
        this['forearm' + side].position.set(0, -6.6, 0);
        this['arm' + side].add(this['forearm' + side]);

        const forearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.3, 6.4, 10), M.assassinBlack);
        forearmMesh.position.y = -3.2;
        this['forearm' + side].add(forearmMesh);

        const bracer = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.6, 1.6, 10), M.leatherDark);
        bracer.position.y = -1.0;
        this['forearm' + side].add(bracer);

        this['hand' + side] = new THREE.Group();
        this['hand' + side].position.set(0, -6.6, 0.4);
        this['forearm' + side].add(this['hand' + side]);
        this['hand' + side].add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.0, 2.2), M.ninjaMask));
      }

      this.weaponR = this.createCurvedDagger(M, true);
      this.handR.add(this.weaponR);

      this.weaponL = this.createCurvedDagger(M, false);
      this.handL.add(this.weaponL);
    }

    createCurvedDagger(M, isRight) {
      const dagger = new THREE.Group();
      dagger.position.set(0, -0.5, 0.5);
      dagger.rotation.set(isRight ? 0.50 : -1.60, isRight ? -0.60 : 0.40, isRight ? -1.80 : 0.75);

      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 5.0, 8), M.leatherDark);
      dagger.add(grip);

      const guard = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.2, 1.5), M.steelTrim);
      guard.position.set(0, 2.6, 0);
      dagger.add(guard);

      const bladeGroup = new THREE.Group();
      bladeGroup.position.set(0, 3.2, 0);
      dagger.add(bladeGroup);

      const bladeSegment = new THREE.Mesh(new THREE.BoxGeometry(1.5, 10, 0.6), M.poisonBlade);
      bladeSegment.position.set(isRight ? 1.2 : -1.2, 5.2, 0);
      bladeSegment.rotation.z = isRight ? -0.20 : 0.20;
      bladeGroup.add(bladeSegment);

      const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.6, 4, 2), M.poisonBlade);
      bladeTip.position.set(isRight ? 2.6 : -2.6, 11.6, 0);
      bladeTip.rotation.z = isRight ? -0.40 : 0.40;
      bladeGroup.add(bladeTip);

      return dagger;
    }

    // ==========================================
    // 🏃 REALISTIC BIOMECHANICAL LOCOMOTION & IDLE
    // ==========================================
    // Model yaw for a world-space direction. On the iso projection a ground
    // vector (dx, dy) appears on screen as (dx - dy, (dx + dy) / 2); the 3D
    // ground plane is the screen with the vertical axis un-squashed, and
    // yaw 0 faces the camera (screen-down, i.e. 'S').
    static yawTowards(fromX, fromY, toX, toY) {
      const dx = toX - fromX;
      const dy = toY - fromY;
      if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) return null;
      return Math.atan2(dx - dy, dx + dy);
    }

    update(player, camera, canvasWidth, canvasHeight, dt, isLocal, isAttacking, attackProg, attackYaw = null, attackSide = 1) {
      this.player = player;
      const z = camera.zoom || 1;

      // Isometric Coordinate Transform: (x, y) -> Screen Space
      const TILE_WIDTH = 64;
      const TILE_HEIGHT = 32;
      const screenX = (player.x - player.y) * (TILE_WIDTH / 2) * z + canvasWidth / 2 - camera.x * z;
      const screenY = (player.x + player.y) * (TILE_HEIGHT / 2) * z + canvasHeight / 2 - camera.y * z;

      this.root.position.x = screenX - canvasWidth / 2;
      this.root.position.y = -(screenY - canvasHeight / 2) - 1.5 * z;
      this.root.position.z = (player.x + player.y) * 2;

      // True 1:1 Scale matched with the 2D Pixel Sprite height (~54px)
      const scale = z * 0.76;
      this.root.scale.set(scale, scale, scale);

      let targetYaw = attackYaw !== null ? attackYaw : Hero3DInstance.FACING_YAW[player.facing || 'S'];
      if (targetYaw === undefined) targetYaw = 0;

      // Smooth Shortest-Arc Turn Interpolation
      let diff = targetYaw - this.currentYaw;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.currentYaw += diff * Math.min(1, dt * 18);
      while (this.currentYaw < -Math.PI) this.currentYaw += Math.PI * 2;
      while (this.currentYaw > Math.PI) this.currentYaw -= Math.PI * 2;

      this.modelContainer.rotation.y = this.currentYaw;

      this.animate(dt, !!player.isMoving, isAttacking, attackProg, attackSide);
    }

    // Pure skeletal animation, decoupled from world positioning so it can be
    // reused by the character-creation preview (which has its own camera).
    animate(dt, isMoving, isAttacking, attackProg, attackSide = 1) {
      // Animation Cycle Timers
      if (isMoving) {
        this.walkTime += dt * 11.5;
      } else {
        this.walkTime += dt * 3.0;
      }

      // =====================================================================
      // 🦵 BIOMECHANICAL WALK CYCLE & IDLE CONTRAPPOSTO STANCE
      // =====================================================================
      if (isMoving) {
        // --- 1. Natural Humanoid Walk Cycle ---
        const cycle = this.walkTime;
        const baseY = this.pelvisBaseY || 17;

        // Double-bounce vertical gait (recoil down on contact, rise on mid-stance passing)
        const walkBob = Math.sin(cycle * 2.0) * 1.1;
        this.pelvis.position.y = baseY + walkBob;

        // Lateral pelvic sway (shifting weight over the stance leg)
        this.pelvis.position.x = Math.sin(cycle) * 1.4;

        // Pelvic roll (hip drops slightly on the unweighted swinging leg)
        this.pelvis.rotation.z = Math.sin(cycle) * 0.07;

        // Pelvic yaw (advancing hip rotates forward with stride)
        this.pelvis.rotation.y = -Math.sin(cycle) * 0.12;

        // Upper Torso / Spine Counter-Rotation (opposite twist to pelvis for balance)
        this.torsoGroup.rotation.y = Math.sin(cycle) * 0.14;
        this.torsoGroup.rotation.z = -Math.sin(cycle) * 0.05;
        this.torsoGroup.rotation.x = 0.08; // Natural forward stride lean

        // Left Leg Kinematics (Contact -> Down -> Passing -> Up)
        const phaseL = cycle;
        const hipPitchL = Math.sin(phaseL) * 0.65;
        this.legL.rotation.x = hipPitchL;
        this.legL.rotation.z = -0.04;

        // Knee bends backwards during the swing/passing phase to clear ground
        const kneeFlexL = Math.max(0, -Math.sin(phaseL - 0.4) * 0.95);
        this.kneeL.rotation.x = kneeFlexL;

        // Ankle keeps the foot level with the floor during swing, pushes off at back
        this.ankleL.rotation.x = -hipPitchL * 0.65 - kneeFlexL * 0.4;

        // Right Leg Kinematics (Opposite Phase by PI)
        const phaseR = cycle + Math.PI;
        const hipPitchR = Math.sin(phaseR) * 0.65;
        this.legR.rotation.x = hipPitchR;
        this.legR.rotation.z = 0.04;

        const kneeFlexR = Math.max(0, -Math.sin(phaseR - 0.4) * 0.95);
        this.kneeR.rotation.x = kneeFlexR;

        this.ankleR.rotation.x = -hipPitchR * 0.65 - kneeFlexR * 0.4;

        // Fauld/Robe skirt reacts dynamically to thigh motion
        if (this.fauldSkirt) {
          this.fauldSkirt.rotation.z = Math.sin(cycle) * 0.08;
          this.fauldSkirt.rotation.x = Math.abs(Math.sin(cycle)) * 0.08;
        }

      } else {
        // --- 2. Authentic Grounded Combat Contrapposto Idle Stance ---
        // Smooth breathing expansion
        const breath = Math.sin(this.walkTime * 1.8);
        const breathRise = breath * 0.35;

        // Relaxed stance: weight grounded primarily on back right leg, left leg forward
        const baseY = this.pelvisBaseY || 17;
        this.pelvis.position.y = baseY - 0.2 + breathRise;
        this.pelvis.position.x = 0.6; // Slight weight shift
        this.pelvis.rotation.set(0.04, -0.08, 0.04);

        // Spine upright with heroic posture, breathing chest expansion
        this.torsoGroup.rotation.set(0.05 + breath * 0.02, 0.06, -0.03);

        // Left leg: stepped slightly forward, knee flexed ~12 deg
        this.legL.rotation.set(-0.16, 0.05, -0.06);
        this.kneeL.rotation.set(0.24, 0, 0);
        this.ankleL.rotation.set(-0.08, 0, 0);

        // Right leg: back and angled outward for solid combat base
        this.legR.rotation.set(0.12, -0.14, 0.08);
        this.kneeR.rotation.set(0.08, 0, 0);
        this.ankleR.rotation.set(-0.18, 0, 0);

        if (this.fauldSkirt) {
          this.fauldSkirt.rotation.set(0.02, 0, 0.02);
        }
      }

      // =====================================================================
      // ⚔️ UPPER BODY, WEAPON STANCES & ATTACK ANIMATIONS
      // =====================================================================
      const walkCycle = Math.sin(this.walkTime);
      const armBreath = Math.sin(this.walkTime * 1.8) * 0.04;

      if (!isAttacking) {
        if (this.characterClass === 'warrior') {
          // --- WARRIOR: GREATSWORD RAISED AT THE SIDE ---
          // Matches the 2D reference: the blade is held upright beside the
          // right shoulder and towers over the conical helm.
          const rSway = isMoving ? walkCycle * 0.12 : armBreath;
          const lSway = isMoving ? -walkCycle * 0.10 : armBreath * 0.8;

          // Right arm swings out from the body with the forearm raised, so the
          // upright blade clears the pauldron and cuirass (pose found with a
          // blade-vs-body penetration search; stays clear through walk sway)
          this.armR.rotation.set(-0.10 + rSway, -0.27, 1.0);
          this.forearmR.rotation.set(-1.4, 0, 0);
          this.handR.rotation.set(0, 0, 0);

          // Left Arm rests relaxed at his side
          this.armL.rotation.set(-0.10 + lSway, -0.14, 0.16);
          this.forearmL.rotation.set(-0.26, 0, 0);
          this.handL.rotation.set(0, 0, 0);

          // Blade upright beside the right shoulder, tip above the helm
          if (this.weapon) {
            this.weapon.rotation.set(0.17, -0.25, -0.84);
          }

        } else if (this.characterClass === 'mage') {
          // --- MAGE: ARISTOCRATIC WIZARD STANCE ---
          const rSway = isMoving ? walkCycle * 0.14 : armBreath;
          const lSway = isMoving ? -walkCycle * 0.12 : armBreath;

          this.armR.rotation.set(-0.15 + rSway, 0.10, 0.30);
          this.forearmR.rotation.set(-0.20, 0, 0);
          this.handR.rotation.set(0, 0, 0);

          this.armL.rotation.set(-0.30 + lSway, -0.1, 0.22);
          this.forearmL.rotation.set(-0.55, 0, 0);
          this.handL.rotation.set(0.15, 0, 0);

          if (this.beard) {
            // Secondary soft hair sway
            this.beard.rotation.z = Math.sin(this.walkTime * 1.5) * 0.06;
            this.beard.rotation.x = 0.25 + (isMoving ? 0.12 : Math.sin(this.walkTime * 1.8) * 0.03);
          }

        } else {
          // --- ROGUE: LOW STEALTH PREDATOR CROUCH ---
          const rSway = isMoving ? walkCycle * 0.24 : armBreath;
          const lSway = isMoving ? -walkCycle * 0.24 : armBreath;

          this.armR.rotation.set(-0.55 + rSway, 0.15, -0.22);
          this.forearmR.rotation.set(-0.85, 0, 0);
          this.handR.rotation.set(-0.15, 0, 0);

          this.armL.rotation.set(-0.55 + lSway, -0.15, 0.0);
          this.forearmL.rotation.set(-1.0, 0, 0);
          this.handL.rotation.set(-0.15, 0, 0);
        }
      } else {
        // --- COMBAT ATTACK CLEAVE / CAST / SLASH ANIMATIONS ---
        if (this.characterClass === 'warrior') {
          // Heavy Overhead Diagonal Cleave; combo return swings rise the other way
          const swing = Math.sin(attackProg * Math.PI);
          const windup = 1.0 - attackProg;

          if (attackSide >= 0) {
            this.torsoGroup.rotation.y = (attackProg - 0.5) * 0.6;
            this.armR.rotation.set(-0.6 - windup * 1.4 + attackProg * 1.2, 0.25, -0.2 + swing * 0.7);
            this.forearmR.rotation.set(-0.75 - windup * 0.6 + attackProg * 0.9, 0.15, 0);

            this.armL.rotation.set(-0.55 - windup * 1.2 + attackProg * 1.0, -0.3, 0.4 + swing * 0.5);
            this.forearmL.rotation.set(-0.95 - windup * 0.5 + attackProg * 0.8, -0.2, 0);
          } else {
            this.torsoGroup.rotation.y = (0.5 - attackProg) * 0.6;
            this.armR.rotation.set(-0.2 - attackProg * 1.9 + windup * 0.3, 0.25, 0.5 - swing * 0.9);
            this.forearmR.rotation.set(-0.5 - attackProg * 0.6, 0.15, 0);

            this.armL.rotation.set(-0.2 - attackProg * 1.6 + windup * 0.3, -0.3, -0.1 - swing * 0.4);
            this.forearmL.rotation.set(-0.7 - attackProg * 0.5, -0.2, 0);
          }

        } else if (this.characterClass === 'mage') {
          // Arcane Staff Thrust & Orb Eruption
          const thrust = Math.sin(attackProg * Math.PI);
          this.armR.rotation.set(-0.35 - thrust * 1.1, 0, -0.2);
          this.forearmR.rotation.set(-0.45 + thrust * 0.4, 0, 0);

          this.armL.rotation.set(-0.40 - thrust * 0.6, 0, 0.35);
          this.forearmL.rotation.set(-0.70 + thrust * 0.35, 0, 0);

          if (this.arcaneOrb) {
            const pulse = 1 + thrust * 0.85;
            this.arcaneOrb.scale.set(pulse, pulse, pulse);
          }

        } else {
          // Dual Scissor Cross-Slash; combo return swings lead with the left blade
          const first = attackProg < 0.5 ? Math.sin(attackProg * 2 * Math.PI) : 0;
          const second = attackProg >= 0.5 ? Math.sin((attackProg - 0.5) * 2 * Math.PI) : 0;
          const rLunge = attackSide >= 0 ? first : second;
          const lLunge = attackSide >= 0 ? second : first;

          this.armR.rotation.set(-0.55 - rLunge * 0.95, 0.1, -0.22 + rLunge * 0.35);
          this.forearmR.rotation.set(-0.85 + rLunge * 0.7, 0, 0);

          this.armL.rotation.set(-0.55 - lLunge * 0.95, -0.1, 0.22 - lLunge * 0.35);
          this.forearmL.rotation.set(-0.85 + lLunge * 0.7, 0, 0);
        }
      }

      // Dynamic Cape Waves - the cape pivots at the shoulders, so a positive
      // pitch swings the hem backward away from the legs.
      if (this.cape) {
        const capeWave = Math.sin(this.walkTime * (isMoving ? 1.6 : 0.9)) * (isMoving ? 0.06 : 0.03);
        this.cape.rotation.x = (isMoving ? 0.18 : 0.05) + capeWave;
        this.cape.rotation.z = isMoving ? Math.sin(this.walkTime) * 0.05 : 0;
      }

      // Blade Specular Gleam Pulse
      if (this.bladeGleam) {
        const gleamPulse = 0.8 + Math.sin(this.walkTime * 2.5) * 0.4;
        this.bladeGleam.scale.set(gleamPulse, gleamPulse, gleamPulse);
      }

      // Arcane Orb Floating & Halo Rotation
      if (this.orbHalo) {
        this.orbHalo.rotation.x += dt * 2.2;
        this.orbHalo.rotation.y += dt * 3.1;
      }
    }
  }

  // Facing Direction Angles in Isometric Space
  Hero3DInstance.FACING_YAW = {
    'S': 0,
    'SE': Math.PI * 0.25,
    'E': Math.PI * 0.5,
    'NE': Math.PI * 0.75,
    'N': Math.PI,
    'NW': -Math.PI * 0.75,
    'W': -Math.PI * 0.5,
    'SW': -Math.PI * 0.25
  };

  // Export globally
  window.ThreeHeroRenderer = ThreeHeroRenderer;
  window.Hero3DInstance = Hero3DInstance;
  window.Fountain3DInstance = Fountain3DInstance;
  window.HeroAssetFactory = { buildTextures, buildMaterials, buildGeometries };
})();
