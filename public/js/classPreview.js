// Character Creation Preview Renderer
// Renders a rotating, idling 3D hero of the currently selected class inside the
// join-game modal. Reuses the procedural hero rig from threeHeroRenderer.js.

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

  class ClassPreview {
    constructor(canvas) {
      this.canvas = canvas;
      this.ready = false;
      this.currentClass = null;
      this.hero = null;
      this.rotation = 0;
      this.lastTime = 0;
      this.running = false;

      if (!canvas || typeof THREE === 'undefined' || !window.Hero3DInstance || !window.HeroAssetFactory) {
        return;
      }

      const textures = window.HeroAssetFactory.buildTextures();
      const materials = window.HeroAssetFactory.buildMaterials(textures);
      const geometries = window.HeroAssetFactory.buildGeometries();

      this.materials = materials;
      this.geometries = geometries;

      this.scene = new THREE.Scene();

      this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 2000);
      this.camera.position.set(0, 33, 127);
      this.camera.lookAt(0, 28, 0);

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setClearColor(0x000000, 0);

      this.scene.add(new THREE.AmbientLight(0xf8fafc, 1.0));

      const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.5);
      keyLight.position.set(180, 320, 260);
      this.scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
      rimLight.position.set(-260, 140, -180);
      this.scene.add(rimLight);

      const fillLight = new THREE.DirectionalLight(0xfef08a, 0.45);
      fillLight.position.set(0, -160, 220);
      this.scene.add(fillLight);

      this.podium = new THREE.Mesh(
        new THREE.CylinderGeometry(26, 29, 2.2, 32),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85, metalness: 0.15 })
      );
      this.podium.position.y = -0.1;
      this.scene.add(this.podium);

      this.podiumRing = new THREE.Mesh(
        new THREE.TorusGeometry(26.5, 0.55, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.7 })
      );
      this.podiumRing.rotation.x = Math.PI * 0.5;
      this.podiumRing.position.y = 1.05;
      this.scene.add(this.podiumRing);

      this.ready = true;
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    resize() {
      if (!this.ready) return;
      const w = this.canvas.clientWidth || 420;
      const h = this.canvas.clientHeight || 420;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    setClass(cls) {
      if (!this.ready) return;
      if (this.currentClass === cls) return;
      this.currentClass = cls;

      if (this.hero) {
        this.scene.remove(this.hero.root);
      }

      const fakePlayer = {
        id: 'preview',
        characterClass: cls,
        x: 0,
        y: 0,
        facing: 'S',
        isMoving: false
      };

      this.hero = new window.Hero3DInstance(fakePlayer, {
        materials: this.materials,
        geometries: this.geometries
      });

      this.hero.root.scale.setScalar(1.0);
      this.hero.root.position.set(0, 0, 0);
      this.hero.modelContainer.rotation.x = 0.10;
      this.hero.currentYaw = 0;
      this.hero.modelContainer.rotation.y = 0;
      // The flatter preview tilt changes where the feet land, so re-seat the
      // model on the contact shadow and refresh the measured height.
      this.hero.groundModel();

      this.scene.add(this.hero.root);

      this.frameClass();
      this.applyAccent(cls);
    }

    // Re-frame the camera for the selected class so a short, round mage and a
    // tall, lean swordsman are both presented at a readable size.
    frameClass() {
      const spriteHeight = (this.hero && this.hero.metrics && this.hero.metrics.height) || 54;
      // The camera has to clear the real 3D silhouette (staff, hat, sword tip),
      // which is taller than the sprite-derived proportions.
      const height = (this.hero && this.hero.modelHeight) || spriteHeight;
      const scale = spriteHeight / 54;

      // Podium shrinks with the character so it never dwarfs a short class.
      this.podium.scale.set(scale, 1, scale);
      this.podiumRing.scale.set(scale, scale, scale);
      this.podiumRing.position.y = 1.05 * 1;

      const dist = height * 2.35;
      const targetY = height * 0.52;
      this.camera.position.set(0, height * 0.62, dist);
      this.camera.lookAt(0, targetY, 0);
      this.camera.updateProjectionMatrix();
    }

    applyAccent(cls) {
      const meta = CLASS_META[cls];
      if (meta && this.podiumRing) {
        this.podiumRing.material.color.set(meta.accent);
      }
    }

    start() {
      if (!this.ready || this.running) return;
      this.running = true;
      this.lastTime = performance.now();
      const loop = (now) => {
        if (!this.running) return;
        const dt = Math.min((now - this.lastTime) / 1000, 0.05);
        this.lastTime = now;
        this.render(dt);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    stop() {
      this.running = false;
    }

    render(dt) {
      if (!this.ready || !this.hero) return;

      this.rotation += dt * 0.35;
      this.hero.modelContainer.rotation.y = this.rotation;
      this.hero.animate(dt, false, false, 0);

      this.podiumRing.rotation.z += dt * 0.5;

      this.renderer.render(this.scene, this.camera);
    }
  }

  window.ClassPreview = ClassPreview;
  window.CLASS_META = CLASS_META;
})();
