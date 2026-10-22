// Three.js 3D Hero Model Renderer for Slop Hero MMORPG
// High-Fidelity Stylized 3D Character Models: Heroic Anatomical Silhouettes, Sculpted Armor, Layered Cloth, Runic Weapons & Biomechanical Rig

(function() {
  class ThreeHeroRenderer {
    constructor() {
      this.enabled = false; // Toggle between 3D and 2D models
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

      // Shared Geometries & Materials Cache
      this.materials = this.createMaterials();
      this.geometries = this.createGeometries();

      // Three.js Scene Setup
      this.scene = new THREE.Scene();

      // Orthographic Camera aligned with screen pixel space
      this.camera = new THREE.OrthographicCamera(
        -this.width / 2, this.width / 2,
        this.height / 2, -this.height / 2,
        -2500, 2500
      );
      this.camera.position.set(0, 0, 1000);
      this.camera.lookAt(0, 0, 0);

      // WebGL Renderer
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

      // Lighting Setup for High-Fidelity Specular & Ambient Contrast
      this.setupLighting();

      // Hero 3D Models Map: key -> Hero3DInstance
      this.heroes = new Map();

      // Handle Resize
      window.addEventListener('resize', () => this.handleResize());
    }

    setupLighting() {
      // Soft ambient fill
      this.ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
      this.scene.add(this.ambientLight);

      // Main directional sun light with warm hero tint
      this.sunLight = new THREE.DirectionalLight(0xfff7ed, 0.95);
      this.sunLight.position.set(300, 600, 400);
      this.scene.add(this.sunLight);

      // Cool blue rim light for sharp specular edge highlights
      this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
      this.rimLight.position.set(-350, 200, -300);
      this.scene.add(this.rimLight);
    }

    createMaterials() {
      return {
        // Skin & Anatomy
        skin: new THREE.MeshStandardMaterial({ color: 0xfec89a, roughness: 0.45, metalness: 0.05 }),
        skinShadow: new THREE.MeshStandardMaterial({ color: 0xf4a261, roughness: 0.5 }),
        hairBlonde: new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.35, metalness: 0.1 }),
        hairDark: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 }),
        hairSilver: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.2 }),
        hairBrown: new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4 }),

        // Facial Eyes
        eyeWhite: new THREE.MeshBasicMaterial({ color: 0xffffff }),
        pupil: new THREE.MeshBasicMaterial({ color: 0x020617 }),
        irisBlue: new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
        irisGreen: new THREE.MeshBasicMaterial({ color: 0x22c55e }),
        irisPurple: new THREE.MeshBasicMaterial({ color: 0xc084fc }),

        // Warrior Materials
        steel: new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.22 }),
        steelDark: new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.25 }),
        steelShine: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.15 }),
        warriorBlue: new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.5 }),
        warriorLeather: new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 }),
        goldTrim: new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.92, roughness: 0.18, emissive: 0xb45309, emissiveIntensity: 0.2 }),
        warriorCape: new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.55, side: THREE.DoubleSide }),
        ruby: new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xd97706, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.2 }),

        // Mage Materials
        mageRobe: new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.5 }),
        mageHat: new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.45 }),
        mageSilk: new THREE.MeshStandardMaterial({ color: 0x4338ca, roughness: 0.4 }),
        arcaneCrystal: new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.85, roughness: 0.05, metalness: 0.1 }),
        woodStaff: new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 }),

        // Rogue Materials
        rogueLeather: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55, metalness: 0.25 }),
        rogueGreen: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.45 }),
        poisonBlade: new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.75, metalness: 0.85, roughness: 0.15 }),
        stealthGlow: new THREE.MeshBasicMaterial({ color: 0x06b6d4 }),

        // Accents & Common
        leatherBelt: new THREE.MeshStandardMaterial({ color: 0x3b1c09, roughness: 0.7 }),
        whiteCloth: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 }),
        glowRune: new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
      };
    }

    createGeometries() {
      return {
        // Sculpted Anatomy Primitives
        headJaw: new THREE.CylinderGeometry(7.2, 5.8, 14, 12),
        headDome: new THREE.SphereGeometry(7.2, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
        torsoChest: new THREE.CylinderGeometry(8.8, 7.2, 12, 10),
        torsoWaist: new THREE.CylinderGeometry(7.2, 7.6, 10, 10),
        pelvisTaper: new THREE.CylinderGeometry(7.6, 6.8, 7, 10),
        armUpper: new THREE.CylinderGeometry(3.3, 2.7, 10, 8),
        jointSphere: new THREE.SphereGeometry(2.5, 8, 8),
        armLower: new THREE.CylinderGeometry(3.6, 2.8, 10, 8),
        fist: new THREE.BoxGeometry(4.2, 4.2, 4.8),
        legUpper: new THREE.CylinderGeometry(3.8, 3.1, 11, 8),
        kneeCop: new THREE.SphereGeometry(2.7, 8, 8),
        legLower: new THREE.CylinderGeometry(3.6, 2.9, 11, 8),
        bootFoot: new THREE.BoxGeometry(6.2, 3.4, 10),
        bootToe: new THREE.CylinderGeometry(3.1, 3.1, 3.4, 8, 1, false, 0, Math.PI),

        // Armor, Helmets & Gear
        pauldronTier: new THREE.SphereGeometry(6.2, 8, 8, 0, Math.PI, 0, Math.PI * 0.75),
        swordBlade: new THREE.BoxGeometry(3.2, 34, 1.2),
        swordGuard: new THREE.BoxGeometry(13, 2.6, 3.2),
        swordGrip: new THREE.CylinderGeometry(1.3, 1.3, 10, 8),
        shieldKite: new THREE.CylinderGeometry(8, 1, 24, 8, 1, false, 0, Math.PI),
        staffShaft: new THREE.CylinderGeometry(1.4, 1.8, 38, 8),
        crystalOcta: new THREE.OctahedronGeometry(4.8, 0),
        daggerBlade: new THREE.BoxGeometry(2.2, 18, 1.0),
        daggerGuard: new THREE.BoxGeometry(7, 2, 2),
        daggerGrip: new THREE.CylinderGeometry(1.1, 1.1, 6, 8),
        bookCover: new THREE.BoxGeometry(9, 12, 2.5),
        bookPages: new THREE.BoxGeometry(8, 11, 2),
        hatBrim: new THREE.CylinderGeometry(16, 16, 1.8, 14),
        hatCone: new THREE.ConeGeometry(9.5, 24, 10)
      };
    }

    handleResize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.renderer.setSize(this.width, this.height);
      this.camera.left = -this.width / 2;
      this.camera.right = this.width / 2;
      this.camera.top = this.height / 2;
      this.camera.bottom = -this.height / 2;
      this.camera.updateProjectionMatrix();
    }

    // Main update called every frame
    updateAndRender(gameState, camera, localPlayerId, attacksMap, dt) {
      if (!this.enabled) {
        if (this.canvas.style.display !== 'none') {
          this.canvas.style.display = 'none';
        }
        return;
      }
      if (this.canvas.style.display !== 'block') {
        this.canvas.style.display = 'block';
      }

      const activeIds = new Set();
      const players = gameState.players || [];

      // Sort by isometric depth so 3D characters layer naturally with terrain
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

        hero.update(p, camera, this.width, this.height, dt, isLocal, isAttacking, attackProg);
      });

      // Cleanup despawned players
      for (const [id, hero] of this.heroes.entries()) {
        if (!activeIds.has(id)) {
          this.scene.remove(hero.root);
          this.heroes.delete(id);
        }
      }

      this.renderer.render(this.scene, this.camera);
    }
  }

  // 3D Hero Instance with Biomechanical Animation Rig & Sculpted Anatomy
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

      // Base offset container (centered on feet)
      this.modelContainer = new THREE.Group();
      this.root.add(this.modelContainer);
      this.modelContainer.rotation.set(0, 0, 0);

      // 1. Pelvis / Hips (Sculpted tapered cylinder)
      this.pelvis = new THREE.Group();
      this.pelvis.position.y = 15.25;
      this.modelContainer.add(this.pelvis);

      const pelvisMesh = new THREE.Mesh(G.pelvisTaper, this.characterClass === 'warrior' ? M.steelDark : this.characterClass === 'mage' ? M.mageRobe : M.rogueLeather);
      this.pelvis.add(pelvisMesh);

      // Heavy War Belt with Buckle & Pouches
      const belt = new THREE.Mesh(new THREE.CylinderGeometry(8.1, 8.1, 3.2, 12), M.leatherBelt);
      belt.position.y = 2.0;
      this.pelvis.add(belt);

      const buckle = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.2, 1.8), M.goldTrim);
      buckle.position.set(0, 2.0, 7.5);
      this.pelvis.add(buckle);

      // Side Leather Pouch
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(4.5, 5, 3), M.leatherBelt);
      pouch.position.set(7.5, 1.5, 2.5);
      this.pelvis.add(pouch);

      if (this.characterClass === 'warrior') {
        // Royal Blue Under-Tunic Skirt
        const tunicSkirt = new THREE.Mesh(new THREE.CylinderGeometry(8.0, 9.2, 6.5, 10, 1, true), M.warriorBlue);
        tunicSkirt.position.y = -1.5;
        this.pelvis.add(tunicSkirt);
      } else if (this.characterClass === 'mage') {
        // Long Flowing Wizard Robe Skirt
        const robeSkirt = new THREE.Mesh(new THREE.CylinderGeometry(7.8, 12.5, 15, 12), M.mageRobe);
        robeSkirt.position.y = -5.5;
        this.pelvis.add(robeSkirt);
      }

      // 2. Torso Group (Abdomen + Segmented Chestplate)
      this.torsoGroup = new THREE.Group();
      this.torsoGroup.position.y = 5.5;
      this.pelvis.add(this.torsoGroup);

      // Abdomen
      const abMesh = new THREE.Mesh(G.torsoWaist, this.characterClass === 'warrior' ? M.warriorBlue : this.characterClass === 'mage' ? M.mageRobe : M.rogueLeather);
      abMesh.position.y = 4.5;
      this.torsoGroup.add(abMesh);

      // Sculpted Heroic Pectoral Chestplate
      const chestMat = this.characterClass === 'warrior' ? M.steel : this.characterClass === 'mage' ? M.mageRobe : M.rogueLeather;
      this.torso = new THREE.Mesh(G.torsoChest, chestMat);
      this.torso.position.y = 13.5;
      this.torsoGroup.add(this.torso);

      if (this.characterClass === 'warrior') {
        // Central Golden Cross & Breastplate Bevel
        const ridge = new THREE.Mesh(new THREE.BoxGeometry(2.0, 11, 2.5), M.goldTrim);
        ridge.position.set(0, 14, 7.2);
        this.torsoGroup.add(ridge);

        const crossBar = new THREE.Mesh(new THREE.BoxGeometry(10, 2.0, 2.5), M.goldTrim);
        crossBar.position.set(0, 15, 7.2);
        this.torsoGroup.add(crossBar);

        const gemHeart = new THREE.Mesh(new THREE.OctahedronGeometry(1.8, 0), M.ruby);
        gemHeart.position.set(0, 15, 8.2);
        this.torsoGroup.add(gemHeart);
      } else if (this.characterClass === 'mage') {
        // Golden Astrological Sash & Collar
        const collar = new THREE.Mesh(new THREE.TorusGeometry(6.5, 1.5, 6, 12), M.goldTrim);
        collar.position.set(0, 19, 0);
        collar.rotation.x = Math.PI * 0.5;
        this.torsoGroup.add(collar);
      } else if (this.characterClass === 'rogue') {
        // Assassin Crossed Weapon Harness & Throwing Daggers
        const harness = new THREE.Mesh(new THREE.BoxGeometry(14, 2.2, 14.5), M.leatherBelt);
        harness.position.set(0, 13.5, 0);
        harness.rotation.z = 0.45;
        this.torsoGroup.add(harness);

        // 3 Throwing Daggers slotted across harness
        for (let d = -1; d <= 1; d++) {
          const td = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5.5, 0.8), M.steel);
          td.position.set(d * 3.5, 13.5 + d * 1.5, 7.5);
          td.rotation.z = -0.3;
          this.torsoGroup.add(td);
        }
      }

      // 3. Head & Neck
      this.headGroup = new THREE.Group();
      this.headGroup.position.set(0, 22.5, 0);
      this.torsoGroup.add(this.headGroup);

      // Neck
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.0, 4, 8), M.skin);
      neck.position.y = 1.0;
      this.headGroup.add(neck);

      // Sculpted Head Jaw + Dome (Anime/Heroic proportions)
      const headBase = new THREE.Group();
      headBase.position.y = 8.5;
      this.headGroup.add(headBase);

      const jawMesh = new THREE.Mesh(G.headJaw, M.skin);
      jawMesh.position.y = -1;
      headBase.add(jawMesh);

      const domeMesh = new THREE.Mesh(G.headDome, M.skin);
      domeMesh.position.y = 6;
      headBase.add(domeMesh);

      // Detailed Expressive 3D Eyes
      const irisMat = this.characterClass === 'warrior' ? M.irisBlue : this.characterClass === 'mage' ? M.irisPurple : M.stealthGlow;
      for (const dir of [-1, 1]) {
        // Sclera (White)
        const eyeWhite = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 0.8), M.eyeWhite);
        eyeWhite.position.set(dir * 3.2, 7.5, 6.2);
        this.headGroup.add(eyeWhite);

        // Iris
        const eyeIris = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 0.9), irisMat);
        eyeIris.position.set(dir * 3.2, 7.5, 6.3);
        this.headGroup.add(eyeIris);

        // Pupil
        const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 1.0), M.pupil);
        pupil.position.set(dir * 3.2, 7.5, 6.4);
        this.headGroup.add(pupil);

        // Eyebrow
        const brow = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.8, 0.8), this.characterClass === 'warrior' ? M.hairBlonde : this.characterClass === 'mage' ? M.hairSilver : M.hairDark);
        brow.position.set(dir * 3.2, 9.2, 6.4);
        brow.rotation.z = -dir * 0.15;
        this.headGroup.add(brow);
      }

      // 4. Class Headwear & Distinct Silhouettes
      this.buildClassAccessories(M, G);

      // 5. Left Arm (Shoulder -> Bicep -> Elbow -> Gauntlet -> Fist)
      this.armL = new THREE.Group();
      this.armL.position.set(-11, 19, 0);
      this.torsoGroup.add(this.armL);

      const armLUpper = new THREE.Mesh(G.armUpper, this.characterClass === 'warrior' ? M.warriorBlue : this.characterClass === 'mage' ? M.mageRobe : M.rogueLeather);
      armLUpper.position.y = -5.0;
      this.armL.add(armLUpper);

      // Elbow Cop
      const elbowL = new THREE.Mesh(G.jointSphere, this.characterClass === 'warrior' ? M.steel : M.leatherBelt);
      elbowL.position.y = -10;
      this.armL.add(elbowL);

      this.forearmL = new THREE.Group();
      this.forearmL.position.set(0, -10, 0);
      this.armL.add(this.forearmL);

      const armLLower = new THREE.Mesh(G.armLower, this.characterClass === 'warrior' ? M.steel : this.characterClass === 'rogue' ? M.rogueLeather : M.skin);
      armLLower.position.y = -5.0;
      this.forearmL.add(armLLower);

      this.handL = new THREE.Group();
      this.handL.position.set(0, -10.5, 0.8);
      this.forearmL.add(this.handL);

      const fistL = new THREE.Mesh(G.fist, this.characterClass === 'warrior' ? M.steelDark : this.characterClass === 'rogue' ? M.rogueLeather : M.skin);
      this.handL.add(fistL);

      // 6. Right Arm (Shoulder -> Bicep -> Elbow -> Gauntlet -> Fist)
      this.armR = new THREE.Group();
      this.armR.position.set(11, 19, 0);
      this.torsoGroup.add(this.armR);

      const armRUpper = new THREE.Mesh(G.armUpper, this.characterClass === 'warrior' ? M.warriorBlue : this.characterClass === 'mage' ? M.mageRobe : M.rogueLeather);
      armRUpper.position.y = -5.0;
      this.armR.add(armRUpper);

      // Elbow Cop
      const elbowR = new THREE.Mesh(G.jointSphere, this.characterClass === 'warrior' ? M.steel : M.leatherBelt);
      elbowR.position.y = -10;
      this.armR.add(elbowR);

      this.forearmR = new THREE.Group();
      this.forearmR.position.set(0, -10, 0);
      this.armR.add(this.forearmR);

      const armRLower = new THREE.Mesh(G.armLower, this.characterClass === 'warrior' ? M.steel : this.characterClass === 'rogue' ? M.rogueLeather : M.skin);
      armRLower.position.y = -5.0;
      this.forearmR.add(armRLower);

      this.handR = new THREE.Group();
      this.handR.position.set(0, -10.5, 0.8);
      this.forearmR.add(this.handR);

      const fistR = new THREE.Mesh(G.fist, this.characterClass === 'warrior' ? M.steelDark : this.characterClass === 'rogue' ? M.rogueLeather : M.skin);
      this.handR.add(fistR);

      // 7. Left Leg (Hip -> Thigh -> Knee -> Greave -> Boot)
      this.legL = new THREE.Group();
      this.legL.position.set(-4.5, 0, 0);
      this.pelvis.add(this.legL);

      const legLUpper = new THREE.Mesh(G.legUpper, this.characterClass === 'warrior' ? M.steelDark : M.rogueLeather);
      legLUpper.position.y = -5.5;
      this.legL.add(legLUpper);

      // Knee Cop Poleyn
      const kneeL = new THREE.Mesh(G.kneeCop, this.characterClass === 'warrior' ? M.steel : M.leatherBelt);
      kneeL.position.set(0, -11, 2.5);
      this.legL.add(kneeL);

      const legLLower = new THREE.Mesh(G.legLower, this.characterClass === 'warrior' ? M.steel : M.warriorLeather);
      legLLower.position.y = -15;
      this.legL.add(legLLower);

      // Armored Boot with Toe Cap
      const bootL = new THREE.Mesh(G.bootFoot, this.characterClass === 'warrior' ? M.steelDark : M.leatherBelt);
      bootL.position.set(0, -21.5, 2.0);
      this.legL.add(bootL);

      const toeL = new THREE.Mesh(G.bootToe, this.characterClass === 'warrior' ? M.steel : M.leatherBelt);
      toeL.position.set(0, -21.5, 7.0);
      toeL.rotation.x = Math.PI * 0.5;
      this.legL.add(toeL);

      // 8. Right Leg (Hip -> Thigh -> Knee -> Greave -> Boot)
      this.legR = new THREE.Group();
      this.legR.position.set(4.5, 0, 0);
      this.pelvis.add(this.legR);

      const legRUpper = new THREE.Mesh(G.legUpper, this.characterClass === 'warrior' ? M.steelDark : M.rogueLeather);
      legRUpper.position.y = -5.5;
      this.legR.add(legRUpper);

      // Knee Cop Poleyn
      const kneeR = new THREE.Mesh(G.kneeCop, this.characterClass === 'warrior' ? M.steel : M.leatherBelt);
      kneeR.position.set(0, -11, 2.5);
      this.legR.add(kneeR);

      const legRLower = new THREE.Mesh(G.legLower, this.characterClass === 'warrior' ? M.steel : M.warriorLeather);
      legRLower.position.y = -15;
      this.legR.add(legRLower);

      // Armored Boot with Toe Cap
      const bootR = new THREE.Mesh(G.bootFoot, this.characterClass === 'warrior' ? M.steelDark : M.leatherBelt);
      bootR.position.set(0, -21.5, 2.0);
      this.legR.add(bootR);

      const toeR = new THREE.Mesh(G.bootToe, this.characterClass === 'warrior' ? M.steel : M.leatherBelt);
      toeR.position.set(0, -21.5, 7.0);
      toeR.rotation.x = Math.PI * 0.5;
      this.legR.add(toeR);

      // 9. Weapons, Shields & Off-Hands
      this.buildWeapons(M, G);
    }

    buildClassAccessories(M, G) {
      if (this.characterClass === 'warrior') {
        // Majestic Winged Knight Sallet Greathelm
        const helmDome = new THREE.Mesh(new THREE.SphereGeometry(7.8, 12, 10), M.steel);
        helmDome.position.set(0, 8.5, 0);
        this.headGroup.add(helmDome);

        // Flanged Visor with Glowing Cyan T-Visor Slit
        const visor = new THREE.Mesh(new THREE.CylinderGeometry(8.1, 7.8, 5.5, 12, 1, false, -Math.PI * 0.45, Math.PI * 0.9), M.steelDark);
        visor.position.set(0, 7.5, 0);
        this.headGroup.add(visor);

        const tVisorGlow = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.2, 0.8), M.glowRune);
        tVisorGlow.position.set(0, 7.5, 7.8);
        this.headGroup.add(tVisorGlow);

        // Golden Wing Crests on Helmet Temples
        for (const dir of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.ConeGeometry(2.2, 10, 4), M.goldTrim);
          wing.position.set(dir * 8.5, 11, -1);
          wing.rotation.set(-0.4, 0, dir * 0.6);
          this.headGroup.add(wing);
        }

        // Helmet Crown Ridge
        const crestRidge = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.5, 15), M.goldTrim);
        crestRidge.position.set(0, 15, 0);
        this.headGroup.add(crestRidge);

        // Tiered Layered Pauldrons (Curved 3-piece Shoulder Armor)
        for (const dir of [-1, 1]) {
          const pauldronGroup = new THREE.Group();
          pauldronGroup.position.set(dir * 13, 20.5, 0);

          const p1 = new THREE.Mesh(G.pauldronTier, M.steel);
          p1.rotation.set(0, dir * 0.5, dir * 0.8);
          pauldronGroup.add(p1);

          const pGold = new THREE.Mesh(new THREE.TorusGeometry(5.0, 1.0, 6, 10), M.goldTrim);
          pGold.position.y = 1;
          pGold.rotation.x = Math.PI * 0.5;
          pauldronGroup.add(pGold);

          const rubyBrooch = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 6), M.ruby);
          rubyBrooch.position.set(0, 3, dir * 1.5);
          pauldronGroup.add(rubyBrooch);

          this.torsoGroup.add(pauldronGroup);
        }

        // Royal Flowing Cloak with Golden Shoulder Clasps
        const cape = new THREE.Mesh(new THREE.CylinderGeometry(8, 14, 26, 8, 1, true, -Math.PI * 0.6, Math.PI * 1.2), M.warriorCape);
        cape.position.set(0, 6.5, -4.5);
        cape.rotation.y = Math.PI;
        this.torsoGroup.add(cape);
        this.cape = cape;

      } else if (this.characterClass === 'mage') {
        // Grand Archmage Wizard Hat
        const brim = new THREE.Mesh(G.hatBrim, M.mageHat);
        brim.position.set(0, 15.5, 0);
        this.headGroup.add(brim);

        // Golden Rune Band with Dangling Star Charm
        const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 2.2, 10), M.goldTrim);
        hatBand.position.set(0, 17.5, 0);
        this.headGroup.add(hatBand);

        const starCharm = new THREE.Mesh(new THREE.OctahedronGeometry(1.8, 0), M.arcaneCrystal);
        starCharm.position.set(0, 16.5, 10.5);
        this.headGroup.add(starCharm);

        // Curled Conical Hat Peak
        const cone = new THREE.Mesh(G.hatCone, M.mageHat);
        cone.position.set(0, 28, -2.5);
        cone.rotation.x = -0.25;
        this.headGroup.add(cone);

        // Layered Mystic Mantle Cowl Collar
        const cowl = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 13.5, 7, 10, 1, true), M.mageRobe);
        cowl.position.set(0, 18, 0);
        this.torsoGroup.add(cowl);

        // Flowing Hair Locks framing face
        for (const dir of [-1, 1]) {
          const hairLock = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.4, 12, 6), M.hairSilver);
          hairLock.position.set(dir * 5.8, 7.5, 4.5);
          hairLock.rotation.z = -dir * 0.15;
          this.headGroup.add(hairLock);
        }

      } else if (this.characterClass === 'rogue') {
        // Sleek Assassin Shadow Hood & Cowl
        const hoodDome = new THREE.Mesh(new THREE.SphereGeometry(8.2, 12, 10), M.rogueLeather);
        hoodDome.position.set(0, 9, -0.5);
        this.headGroup.add(hoodDome);

        // Forward Shadow Peak
        const hoodPeak = new THREE.Mesh(new THREE.ConeGeometry(4, 5, 4), M.rogueLeather);
        hoodPeak.position.set(0, 15.5, 5.5);
        hoodPeak.rotation.x = 0.5;
        this.headGroup.add(hoodPeak);

        // Ninja Mask / Veil
        const mask = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 5.5, 6, 10, 1, false, -Math.PI * 0.35, Math.PI * 0.7), M.rogueGreen);
        mask.position.set(0, 4.5, 2.5);
        this.headGroup.add(mask);

        // Dual Long Flowing Ninja Scarf Tails that stream dynamically in wind
        this.cape = new THREE.Group();
        this.cape.position.set(0, 16, -6.5);
        this.torsoGroup.add(this.cape);

        for (const dir of [-1, 1]) {
          const scarfTail = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.8, 22, 6), M.rogueGreen);
          scarfTail.position.set(dir * 3.5, -9, -3);
          scarfTail.rotation.x = -0.4;
          this.cape.add(scarfTail);
        }
      }
    }

    buildWeapons(M, G) {
      if (this.characterClass === 'warrior') {
        // Excalibur-Tier Two-Handed Broadsword
        this.weaponR = new THREE.Group();
        this.weaponR.position.set(0, 0, 0.5);
        this.weaponR.rotation.set(-1.15, 0.25, -0.2);
        this.handR.add(this.weaponR);

        // Long Leather-Wrapped Two-Hand Grip
        const grip = new THREE.Mesh(G.swordGrip, M.warriorLeather);
        grip.position.set(0, -1, 0);
        this.weaponR.add(grip);

        // Ornate Dragon-Quillon Crossguard
        const guard = new THREE.Mesh(G.swordGuard, M.steel);
        guard.position.set(0, 4.5, 0);
        this.weaponR.add(guard);

        const guardGem = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), M.ruby);
        guardGem.position.set(0, 4.5, 1.8);
        this.weaponR.add(guardGem);

        // Steel Pommel with Gold Ring
        const pommel = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 8), M.steel);
        pommel.position.set(0, -6.8, 0);
        this.weaponR.add(pommel);

        // Tapered Steel Blade with Central Fuller
        const blade = new THREE.Mesh(G.swordBlade, M.steelShine);
        blade.position.set(0, 22, 0);
        this.weaponR.add(blade);

        const fuller = new THREE.Mesh(new THREE.BoxGeometry(1.2, 28, 1.5), M.glowRune);
        fuller.position.set(0, 20, 0);
        this.weaponR.add(fuller);

        // Heraldic Heater Shield slung across the back
        const shieldGroup = new THREE.Group();
        shieldGroup.position.set(0, 12, -7.5);
        shieldGroup.rotation.set(0.1, Math.PI, 0.2);

        const shieldMesh = new THREE.Mesh(new THREE.CylinderGeometry(7, 3, 20, 8, 1, false, 0, Math.PI), M.steel);
        shieldGroup.add(shieldMesh);

        const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(2.4, 6, 6), M.goldTrim);
        shieldBoss.position.set(0, 0, 4.5);
        shieldGroup.add(shieldBoss);

        this.torsoGroup.add(shieldGroup);

      } else if (this.characterClass === 'mage') {
        // Celestial Dragon Staff held in Right Hand
        this.weaponR = new THREE.Group();
        this.weaponR.position.set(0, 0, 0.5);
        this.weaponR.rotation.set(-0.35, -0.2, -0.25);
        this.handR.add(this.weaponR);

        const shaft = new THREE.Mesh(G.staffShaft, M.woodStaff);
        shaft.position.set(0, 6, 0);
        this.weaponR.add(shaft);

        // 4-Pronged Dragon Claw Crown
        for (let c = 0; c < 4; c++) {
          const cAngle = c * Math.PI * 0.5;
          const claw = new THREE.Mesh(new THREE.ConeGeometry(1.2, 7, 4), M.goldTrim);
          claw.position.set(Math.cos(cAngle) * 3.5, 23, Math.sin(cAngle) * 3.5);
          claw.rotation.set(Math.sin(cAngle) * 0.35, 0, -Math.cos(cAngle) * 0.35);
          this.weaponR.add(claw);
        }

        // Floating Rotating Arcane Crystal hovering at staff head
        this.floatingCrystal = new THREE.Mesh(G.crystalOcta, M.arcaneCrystal);
        this.floatingCrystal.position.set(0, 24, 0);
        this.weaponR.add(this.floatingCrystal);

        // Floating Spell Grimoire levitating above Left Palm
        this.offhandL = new THREE.Group();
        this.offhandL.position.set(0, 3.5, 4);
        this.offhandL.rotation.set(0.65, -0.35, 0.25);
        this.handL.add(this.offhandL);

        const bookCover = new THREE.Mesh(G.bookCover, M.goldTrim);
        this.offhandL.add(bookCover);

        const bookPages = new THREE.Mesh(G.bookPages, M.whiteCloth);
        bookPages.position.set(0, 0, 0.3);
        this.offhandL.add(bookPages);

        const bookGem = new THREE.Mesh(new THREE.SphereGeometry(1.8, 6, 6), M.arcaneCrystal);
        bookGem.position.set(0, 0, 1.5);
        this.offhandL.add(bookGem);

      } else if (this.characterClass === 'rogue') {
        // Dual Serrated Poison Daggers
        this.weaponR = new THREE.Group();
        this.weaponR.position.set(0, 0, 0.5);
        this.weaponR.rotation.set(-1.1, 0.25, -0.2);
        this.handR.add(this.weaponR);

        const gripR = new THREE.Mesh(G.daggerGrip, M.leatherBelt);
        this.weaponR.add(gripR);

        const guardR = new THREE.Mesh(G.daggerGuard, M.goldTrim);
        guardR.position.set(0, 3, 0);
        this.weaponR.add(guardR);

        const bladeR = new THREE.Mesh(G.daggerBlade, M.poisonBlade);
        bladeR.position.set(0, 11, 0);
        this.weaponR.add(bladeR);

        const pommelR = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.5, 6, 8), M.goldTrim);
        pommelR.position.set(0, -3.5, 0);
        this.weaponR.add(pommelR);

        // Left Dagger
        this.weaponL = new THREE.Group();
        this.weaponL.position.set(0, 0, 0.5);
        this.weaponL.rotation.set(-1.1, -0.25, 0.2);
        this.handL.add(this.weaponL);

        const gripL = new THREE.Mesh(G.daggerGrip, M.leatherBelt);
        this.weaponL.add(gripL);

        const guardL = new THREE.Mesh(G.daggerGuard, M.goldTrim);
        guardL.position.set(0, 3, 0);
        this.weaponL.add(guardL);

        const bladeL = new THREE.Mesh(G.daggerBlade, M.poisonBlade);
        bladeL.position.set(0, 11, 0);
        this.weaponL.add(bladeL);

        const pommelL = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.5, 6, 8), M.goldTrim);
        pommelL.position.set(0, -3.5, 0);
        this.weaponL.add(pommelL);
      }
    }

    update(player, camera, canvasWidth, canvasHeight, dt, isLocal, isAttacking, attackProg) {
      this.player = player;
      const z = camera.zoom || 1;

      // Convert Isometric Game World Position to Screen Pixels
      const TILE_WIDTH = 64;
      const TILE_HEIGHT = 32;
      const screenX = (player.x - player.y) * (TILE_WIDTH / 2) * z + canvasWidth / 2 - camera.x * z;
      const screenY = (player.x + player.y) * (TILE_HEIGHT / 2) * z + canvasHeight / 2 - camera.y * z;

      // Position in Three.js Screen Space
      this.root.position.x = screenX - canvasWidth / 2;
      this.root.position.y = -(screenY - canvasHeight / 2) - 1.5 * z;
      this.root.position.z = (player.x + player.y) * 2; // Depth layering

      // Overall Scale based on Camera Zoom
      const scale = z * 0.92;
      this.root.scale.set(scale, scale, scale);

      // Facing Angle Calculation
      const facingAngles = {
        'S': 0,
        'SE': Math.PI * 0.25,
        'E': Math.PI * 0.5,
        'NE': Math.PI * 0.75,
        'N': Math.PI,
        'NW': -Math.PI * 0.75,
        'W': -Math.PI * 0.5,
        'SW': -Math.PI * 0.25
      };

      let targetYaw = facingAngles[player.facing || 'S'];
      if (targetYaw === undefined) targetYaw = 0;

      // Smooth shortest-arc interpolation for fluid turning
      let diff = targetYaw - this.currentYaw;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;

      this.currentYaw += diff * Math.min(1, dt * 16);

      while (this.currentYaw < -Math.PI) this.currentYaw += Math.PI * 2;
      while (this.currentYaw > Math.PI) this.currentYaw -= Math.PI * 2;

      this.modelContainer.rotation.y = this.currentYaw;

      // Biomechanical Animation Cycles
      const isMoving = !!player.isMoving;
      if (isMoving) {
        this.walkTime += dt * 12;
      } else {
        this.walkTime += dt * 3;
      }

      const idleBreath = Math.sin(this.walkTime * 0.8) * 0.4;
      const walkBob = isMoving ? Math.abs(Math.sin(this.walkTime)) * 1.6 : idleBreath;
      this.pelvis.position.y = 15.25 + walkBob;

      // Natural Pendulum Limb Stride
      const legStride = isMoving ? Math.sin(this.walkTime) * 0.6 : 0;
      this.legL.rotation.x = legStride;
      this.legR.rotation.x = -legStride;

      // Class-Specific Weapon Handling & Arm Dynamics
      const walkCycle = Math.sin(this.walkTime);
      const armIdleBreath = Math.sin(this.walkTime * 0.8) * 0.05;

      if (!isAttacking) {
        if (this.characterClass === 'warrior') {
          // Warrior: Two-Handed Bastard Sword ready guard stance across chest
          const rSway = isMoving ? walkCycle * 0.18 : armIdleBreath;
          const lSway = isMoving ? -walkCycle * 0.15 : armIdleBreath * 0.8;

          this.armR.rotation.set(-0.45 + rSway, 0.2, -0.2);
          this.forearmR.rotation.set(-0.6, 0.15, 0);
          this.handR.rotation.set(-0.1, 0, 0);

          this.armL.rotation.set(-0.4 + lSway, -0.3, 0.35);
          this.forearmL.rotation.set(-0.75, -0.25, 0);
          this.handL.rotation.set(0, 0, 0);

        } else if (this.characterClass === 'mage') {
          // Mage: Staff held steadily with arcane presence, grimoire hovering over palm
          const rSway = isMoving ? walkCycle * 0.14 : armIdleBreath;
          const lSway = isMoving ? -walkCycle * 0.12 : armIdleBreath * 0.8;

          this.armR.rotation.set(-0.25 + rSway, 0, -0.2);
          this.forearmR.rotation.set(-0.45, 0, 0);
          this.handR.rotation.set(0, 0, 0);

          this.armL.rotation.set(-0.3 + lSway, 0, 0.2);
          this.forearmL.rotation.set(-0.65, 0, 0);
          this.handL.rotation.set(0.1, 0, 0);

          if (this.offhandL) {
            this.offhandL.position.y = 3.5 + Math.sin(this.walkTime * 2.5) * 0.8;
            this.offhandL.rotation.y = -0.35 + Math.sin(this.walkTime * 1.5) * 0.08;
          }

        } else {
          // Rogue: Low aggressive twin dagger guard
          const rSway = isMoving ? walkCycle * 0.25 : armIdleBreath;
          const lSway = isMoving ? -walkCycle * 0.25 : armIdleBreath;

          this.armR.rotation.set(-0.4 + rSway, 0, -0.18);
          this.forearmR.rotation.set(-0.65 + (isMoving ? Math.cos(this.walkTime) * 0.1 : 0), 0, 0);
          this.handR.rotation.set(-0.1, 0, 0);

          this.armL.rotation.set(-0.4 + lSway, 0, 0.18);
          this.forearmL.rotation.set(-0.65 + (isMoving ? -Math.cos(this.walkTime) * 0.1 : 0), 0, 0);
          this.handL.rotation.set(-0.1, 0, 0);
        }
      } else {
        // Dynamic Heroic Attack Animations
        if (this.characterClass === 'warrior') {
          const swing = Math.sin(attackProg * Math.PI);
          this.armR.rotation.set(-0.45 - (1 - attackProg) * 1.2 + attackProg * 0.9, 0.15, -0.2 + swing * 0.6);
          this.forearmR.rotation.set(-0.6 - (1 - attackProg) * 0.4 + attackProg * 0.7, 0.1, 0);
          this.handR.rotation.set(-0.1 + swing * 0.3, 0, 0);

          this.armL.rotation.set(-0.4 - (1 - attackProg) * 1.0 + attackProg * 0.8, -0.2, 0.35 + swing * 0.4);
          this.forearmL.rotation.set(-0.75 - (1 - attackProg) * 0.3 + attackProg * 0.6, -0.2, 0);

        } else if (this.characterClass === 'mage') {
          const thrust = Math.sin(attackProg * Math.PI);
          this.armR.rotation.set(-0.25 - thrust * 0.9, 0, -0.2);
          this.forearmR.rotation.set(-0.45 + thrust * 0.3, 0, 0);

          this.armL.rotation.set(-0.3 - thrust * 0.4, 0, 0.25);
          this.forearmL.rotation.set(-0.65 + thrust * 0.25, 0, 0);

          if (this.floatingCrystal) {
            const crystalPulse = 1 + thrust * 0.6;
            this.floatingCrystal.scale.set(crystalPulse, crystalPulse, crystalPulse);
          }

        } else {
          const rLunge = attackProg < 0.5 ? Math.sin(attackProg * 2 * Math.PI) : 0;
          const lLunge = attackProg >= 0.5 ? Math.sin((attackProg - 0.5) * 2 * Math.PI) : 0;

          this.armR.rotation.set(-0.4 - rLunge * 0.8, 0, -0.18 + rLunge * 0.2);
          this.forearmR.rotation.set(-0.65 + rLunge * 0.5, 0, 0);

          this.armL.rotation.set(-0.4 - lLunge * 0.8, 0, 0.18 - lLunge * 0.2);
          this.forearmL.rotation.set(-0.65 + lLunge * 0.5, 0, 0);
        }
      }

      // Cape / Scarf Tail Wave Dynamics
      if (this.cape) {
        const capeWave = Math.sin(this.walkTime * (isMoving ? 1.5 : 0.8)) * (isMoving ? 0.35 : 0.1);
        this.cape.rotation.x = -0.15 - (isMoving ? 0.35 : 0.05) + capeWave;
      }

      // Floating Arcane Crystal Rotation
      if (this.floatingCrystal) {
        this.floatingCrystal.rotation.x += dt * 2.5;
        this.floatingCrystal.rotation.y += dt * 3.5;
      }
    }
  }

  // Export globally
  window.ThreeHeroRenderer = ThreeHeroRenderer;
})();
