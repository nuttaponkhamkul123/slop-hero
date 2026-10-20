// Three.js 3D Hero Model Renderer for Slop Hero MMORPG
// Renders rich, stylized low-poly 3D character models with animated limbs, 360° rotation, class equipment & lighting

(function() {
  class ThreeHeroRenderer {
    constructor() {
      this.enabled = true; // Toggle between 3D and 2D models
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

      // Lighting Setup for Studio-Quality 3D Models
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
      this.sunLight = new THREE.DirectionalLight(0xfff7ed, 0.85);
      this.sunLight.position.set(300, 600, 400);
      this.scene.add(this.sunLight);

      // Cool blue rim light for specular edge highlights
      this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
      this.rimLight.position.set(-350, 200, -300);
      this.scene.add(this.rimLight);
    }

    createMaterials() {
      return {
        // Skin tones
        skin: new THREE.MeshStandardMaterial({ color: 0xfec89a, roughness: 0.5, metalness: 0.05 }),
        skinShadow: new THREE.MeshStandardMaterial({ color: 0xf4a261, roughness: 0.5 }),
        hairBlonde: new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.4 }),
        hairDark: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 }),
        hairBrown: new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4 }),

        // Warrior Materials
        steel: new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 }),
        steelDark: new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.3 }),
        goldTrim: new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2, emissive: 0xb45309, emissiveIntensity: 0.15 }),
        warriorCape: new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6, side: THREE.DoubleSide }),
        ruby: new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xd97706, emissiveIntensity: 0.4, roughness: 0.1 }),

        // Mage Materials
        mageRobe: new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.55 }),
        mageHat: new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.5 }),
        arcaneCrystal: new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.65, roughness: 0.1, metalness: 0.1 }),
        woodStaff: new THREE.MeshStandardMaterial({ color: 0x5c3826, roughness: 0.7 }),

        // Rogue Materials
        rogueLeather: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.2 }),
        rogueGreen: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 }),
        poisonBlade: new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.2 }),
        stealthGlow: new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.8 }),

        // Eyes & Details
        eyes: new THREE.MeshBasicMaterial({ color: 0x0f172a }),
        eyesGlow: new THREE.MeshBasicMaterial({ color: 0x67e8f9 }),
        leatherBelt: new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 }),
        whiteCloth: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 })
      };
    }

    createGeometries() {
      return {
        head: new THREE.BoxGeometry(16, 17, 16),
        torso: new THREE.BoxGeometry(18, 22, 13),
        pelvis: new THREE.BoxGeometry(16, 8, 12),
        armUpper: new THREE.BoxGeometry(5.5, 11, 5.5),
        armLower: new THREE.BoxGeometry(5, 11, 5),
        legUpper: new THREE.BoxGeometry(6.5, 12, 6.5),
        legLower: new THREE.BoxGeometry(6, 12, 6),
        foot: new THREE.BoxGeometry(6.5, 4.5, 9),
        pauldron: new THREE.BoxGeometry(8, 8, 8),
        swordBlade: new THREE.BoxGeometry(3.5, 28, 1.2),
        swordCrossguard: new THREE.BoxGeometry(11, 2.5, 3),
        swordGrip: new THREE.CylinderGeometry(1.4, 1.4, 8, 6),
        shieldKite: new THREE.BoxGeometry(14, 20, 2),
        staffShaft: new THREE.CylinderGeometry(1.5, 1.8, 36, 6),
        crystalOcta: new THREE.OctahedronGeometry(4.5, 0),
        daggerBlade: new THREE.BoxGeometry(2.2, 16, 1),
        daggerGuard: new THREE.BoxGeometry(7, 2, 2),
        daggerGrip: new THREE.CylinderGeometry(1.1, 1.1, 6, 6),
        bookCover: new THREE.BoxGeometry(9, 12, 2.5),
        bookPages: new THREE.BoxGeometry(8, 11, 2),
        hatBrim: new THREE.CylinderGeometry(15, 15, 1.8, 10),
        hatCone: new THREE.ConeGeometry(9, 22, 8)
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
        this.renderer.clear();
        return;
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

  // 3D Hero Instance with Biomechanical Animation Rig
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

      // Keep upright without X tilt so turning around Y never causes diagonal roll or tumbling
      this.modelContainer.rotation.set(0, 0, 0);

      // Pelvis / Hips (calculated so boot bottoms rest firmly on ground at y = 0)
      this.pelvis = new THREE.Mesh(G.pelvis, this.characterClass === 'warrior' ? M.steelDark : this.characterClass === 'mage' ? M.mageRobe : M.rogueLeather);
      this.pelvis.position.y = 15.25;
      this.modelContainer.add(this.pelvis);

      // Torso / Chest
      this.torsoGroup = new THREE.Group();
      this.torsoGroup.position.y = 8;
      this.pelvis.add(this.torsoGroup);

      const torsoMat = this.characterClass === 'warrior' ? M.steel : this.characterClass === 'mage' ? M.mageRobe : M.rogueLeather;
      this.torso = new THREE.Mesh(G.torso, torsoMat);
      this.torso.position.y = 11;
      this.torsoGroup.add(this.torso);

      // Torso Gold Emblem / Buckle
      const emblem = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 2), M.goldTrim);
      emblem.position.set(0, 11, 7);
      this.torsoGroup.add(emblem);

      // Head & Neck
      this.headGroup = new THREE.Group();
      this.headGroup.position.set(0, 24, 0);
      this.torsoGroup.add(this.headGroup);

      this.head = new THREE.Mesh(G.head, M.skin);
      this.head.position.y = 8;
      this.headGroup.add(this.head);

      // Eyes
      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 1), this.characterClass === 'rogue' ? M.stealthGlow : M.eyes);
      eyeL.position.set(-4, 9, 8.2);
      this.headGroup.add(eyeL);

      const eyeR = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 1), this.characterClass === 'rogue' ? M.stealthGlow : M.eyes);
      eyeR.position.set(4, 9, 8.2);
      this.headGroup.add(eyeR);

      // Class-Specific Headwear & Equipment
      this.buildClassAccessories(M, G);

      // Left Arm (Shoulder -> Elbow -> Hand)
      this.armL = new THREE.Group();
      this.armL.position.set(-11, 19, 0);
      this.torsoGroup.add(this.armL);

      const armLUpper = new THREE.Mesh(G.armUpper, torsoMat);
      armLUpper.position.y = -5.5;
      this.armL.add(armLUpper);

      this.forearmL = new THREE.Group();
      this.forearmL.position.set(0, -11, 0); // Elbow joint
      this.armL.add(this.forearmL);

      const armLLower = new THREE.Mesh(G.armLower, M.skin);
      armLLower.position.y = -5.5;
      this.forearmL.add(armLLower);

      this.handL = new THREE.Group();
      this.handL.position.set(0, -11, 1); // Wrist joint
      this.forearmL.add(this.handL);

      const fistL = new THREE.Mesh(new THREE.BoxGeometry(4.5, 4.5, 5), this.characterClass === 'warrior' ? M.steel : this.characterClass === 'rogue' ? M.rogueLeather : M.skin);
      this.handL.add(fistL);

      // Right Arm (Shoulder -> Elbow -> Hand)
      this.armR = new THREE.Group();
      this.armR.position.set(11, 19, 0);
      this.torsoGroup.add(this.armR);

      const armRUpper = new THREE.Mesh(G.armUpper, torsoMat);
      armRUpper.position.y = -5.5;
      this.armR.add(armRUpper);

      this.forearmR = new THREE.Group();
      this.forearmR.position.set(0, -11, 0); // Elbow joint
      this.armR.add(this.forearmR);

      const armRLower = new THREE.Mesh(G.armLower, M.skin);
      armRLower.position.y = -5.5;
      this.forearmR.add(armRLower);

      this.handR = new THREE.Group();
      this.handR.position.set(0, -11, 1); // Wrist joint
      this.forearmR.add(this.handR);

      const fistR = new THREE.Mesh(new THREE.BoxGeometry(4.5, 4.5, 5), this.characterClass === 'warrior' ? M.steel : this.characterClass === 'rogue' ? M.rogueLeather : M.skin);
      this.handR.add(fistR);

      // Left Leg (Pivot at hip)
      this.legL = new THREE.Group();
      this.legL.position.set(-5, 0, 0);
      this.pelvis.add(this.legL);

      const legLMesh = new THREE.Mesh(G.legUpper, this.characterClass === 'warrior' ? M.steelDark : M.rogueLeather);
      legLMesh.position.y = -6;
      this.legL.add(legLMesh);

      const bootL = new THREE.Mesh(G.foot, this.characterClass === 'warrior' ? M.steel : M.leatherBelt);
      bootL.position.set(0, -13, 2);
      this.legL.add(bootL);

      // Right Leg (Pivot at hip)
      this.legR = new THREE.Group();
      this.legR.position.set(5, 0, 0);
      this.pelvis.add(this.legR);

      const legRMesh = new THREE.Mesh(G.legUpper, this.characterClass === 'warrior' ? M.steelDark : M.rogueLeather);
      legRMesh.position.y = -6;
      this.legR.add(legRMesh);

      const bootR = new THREE.Mesh(G.foot, this.characterClass === 'warrior' ? M.steel : M.leatherBelt);
      bootR.position.set(0, -13, 2);
      this.legR.add(bootR);

      // Weapons & Shields
      this.buildWeapons(M, G);
    }

    buildClassAccessories(M, G) {
      if (this.characterClass === 'warrior') {
        // Heavy Horned Knight Helmet
        const helmet = new THREE.Mesh(new THREE.BoxGeometry(17, 9, 17), M.steel);
        helmet.position.set(0, 13, 0);
        this.headGroup.add(helmet);

        const visor = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 2), M.goldTrim);
        visor.position.set(0, 10, 8.5);
        this.headGroup.add(visor);

        // Crimson Plume Crest
        const plume = new THREE.Mesh(new THREE.BoxGeometry(3.5, 12, 12), M.warriorCape);
        plume.position.set(0, 19, -2);
        this.headGroup.add(plume);

        // Shoulder Pauldrons
        const pauldronL = new THREE.Mesh(G.pauldron, M.steel);
        pauldronL.position.set(-13, 21, 0);
        this.torsoGroup.add(pauldronL);

        const pauldronR = new THREE.Mesh(G.pauldron, M.steel);
        pauldronR.position.set(13, 21, 0);
        this.torsoGroup.add(pauldronR);

        // Cape
        const cape = new THREE.Mesh(new THREE.BoxGeometry(16, 26, 1.2), M.warriorCape);
        cape.position.set(0, 8, -7.5);
        cape.rotation.x = -0.15;
        this.torsoGroup.add(cape);
        this.cape = cape;

      } else if (this.characterClass === 'mage') {
        // Pointed Archmage Wizard Hat
        const brim = new THREE.Mesh(G.hatBrim, M.mageHat);
        brim.position.set(0, 16.5, 0);
        this.headGroup.add(brim);

        const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 2, 8), M.goldTrim);
        hatBand.position.set(0, 18, 0);
        this.headGroup.add(hatBand);

        const cone = new THREE.Mesh(G.hatCone, M.mageHat);
        cone.position.set(0, 28, -2);
        cone.rotation.x = -0.2;
        this.headGroup.add(cone);

        // Wizard Robe Skirt Extension
        const robeSkirt = new THREE.Mesh(new THREE.CylinderGeometry(8, 12, 16, 8), M.mageRobe);
        robeSkirt.position.set(0, 11, 0);
        this.pelvis.add(robeSkirt);

      } else if (this.characterClass === 'rogue') {
        // Assassin Shadow Hood & Cowl
        const hood = new THREE.Mesh(new THREE.BoxGeometry(18, 18, 18), M.rogueLeather);
        hood.position.set(0, 9, 0);
        this.headGroup.add(hood);

        const mask = new THREE.Mesh(new THREE.BoxGeometry(13, 7, 2), M.rogueGreen);
        mask.position.set(0, 5, 8.5);
        this.headGroup.add(mask);

        // Dual Scarf Tails
        const scarf = new THREE.Mesh(new THREE.BoxGeometry(5, 18, 1.2), M.rogueGreen);
        scarf.position.set(4, 14, -8);
        scarf.rotation.x = -0.25;
        this.torsoGroup.add(scarf);
        this.cape = scarf;
      }
    }

    buildWeapons(M, G) {
      if (this.characterClass === 'warrior') {
        // Claymore / Broadsword gripped firmly in Right Fist, angled forward ready to strike
        this.weaponR = new THREE.Group();
        this.weaponR.position.set(0, 0, 0.5);
        this.weaponR.rotation.set(-1.15, 0.25, -0.2); // Tilted forward into combat ready stance
        this.handR.add(this.weaponR);

        const grip = new THREE.Mesh(G.swordGrip, M.leatherBelt);
        grip.position.set(0, 0, 0);
        this.weaponR.add(grip);

        const guard = new THREE.Mesh(G.swordCrossguard, M.goldTrim);
        guard.position.set(0, 4.5, 0);
        this.weaponR.add(guard);

        const pommel = new THREE.Mesh(new THREE.SphereGeometry(2.4, 6, 6), M.ruby);
        pommel.position.set(0, -5, 0);
        this.weaponR.add(pommel);

        const blade = new THREE.Mesh(G.swordBlade, M.steel);
        blade.position.set(0, 19, 0);
        this.weaponR.add(blade);

        const fuller = new THREE.Mesh(new THREE.BoxGeometry(1.2, 22, 1.6), M.steelDark);
        fuller.position.set(0, 17, 0);
        this.weaponR.add(fuller);

        // Kite Shield mounted solidly on Outer Left Forearm in defensive guard
        this.shieldL = new THREE.Group();
        this.shieldL.position.set(-3.5, -5.5, 1.5);
        this.shieldL.rotation.set(0.1, -Math.PI * 0.42, 0.15);
        this.forearmL.add(this.shieldL);

        const shieldPlate = new THREE.Mesh(G.shieldKite, M.steel);
        this.shieldL.add(shieldPlate);

        const shieldBoss = new THREE.Mesh(new THREE.BoxGeometry(5.5, 5.5, 2.8), M.goldTrim);
        shieldBoss.position.set(0, 1, 1.2);
        this.shieldL.add(shieldBoss);

        const shieldEmblem = new THREE.Mesh(new THREE.BoxGeometry(2.5, 9, 3.2), M.ruby);
        shieldEmblem.position.set(0, 1, 1.2);
        this.shieldL.add(shieldEmblem);

      } else if (this.characterClass === 'mage') {
        // Archmage Arcane Staff held in Right Hand, angled outward and forward
        this.weaponR = new THREE.Group();
        this.weaponR.position.set(0, 0, 0.5);
        this.weaponR.rotation.set(-0.35, -0.2, -0.25); // Clear of hat and torso
        this.handR.add(this.weaponR);

        const shaft = new THREE.Mesh(G.staffShaft, M.woodStaff);
        shaft.position.set(0, 6, 0); // Grip at 40% height, top tip at +24, bottom tip at -12
        this.weaponR.add(shaft);

        const staffHead = new THREE.Mesh(new THREE.TorusGeometry(5, 1.2, 6, 12), M.goldTrim);
        staffHead.position.set(0, 24, 0);
        this.weaponR.add(staffHead);

        // Floating Rotating Arcane Crystal hovering at staff head
        this.floatingCrystal = new THREE.Mesh(G.crystalOcta, M.arcaneCrystal);
        this.floatingCrystal.position.set(0, 24, 0);
        this.weaponR.add(this.floatingCrystal);

        const buttCap = new THREE.Mesh(new THREE.CylinderGeometry(2, 1.2, 4, 6), M.goldTrim);
        buttCap.position.set(0, -11, 0);
        this.weaponR.add(buttCap);

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
        // Dual Curved Poison Daggers held in forward assassin grip
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

        const pommelR = new THREE.Mesh(new THREE.SphereGeometry(1.8, 6, 6), M.stealthGlow);
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

        const pommelL = new THREE.Mesh(new THREE.SphereGeometry(1.8, 6, 6), M.stealthGlow);
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

      // Position in Three.js Screen Space: Boots anchored firmly on ground level
      this.root.position.x = screenX - canvasWidth / 2;
      this.root.position.y = -(screenY - canvasHeight / 2) - 1.5 * z;
      this.root.position.z = (player.x + player.y) * 2; // Depth layering

      // Overall Scale based on Camera Zoom
      const scale = z * 0.92;
      this.root.scale.set(scale, scale, scale);

      // Facing Angle Calculation (Exact Screen Compass: +X is right, -X is left, +Z is forward towards camera)
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

      // Normalize currentYaw to [-PI, PI]
      while (this.currentYaw < -Math.PI) this.currentYaw += Math.PI * 2;
      while (this.currentYaw > Math.PI) this.currentYaw -= Math.PI * 2;

      // Clean rotation around vertical Y axis only: no rolling or pitching
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
          // Warrior: Shield raised in guard, sword held forward ready
          const rSway = isMoving ? walkCycle * 0.2 : armIdleBreath;
          const lSway = isMoving ? -walkCycle * 0.08 : 0;

          this.armR.rotation.set(-0.35 + rSway, 0, -0.15);
          this.forearmR.rotation.set(-0.55 + (isMoving ? walkCycle * 0.08 : 0), 0, 0);
          this.handR.rotation.set(-0.1, 0, 0);

          this.armL.rotation.set(-0.38 + lSway, 0, 0.22);
          this.forearmL.rotation.set(-0.68, 0, 0);
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

          // Spellbook gentle hover bobbing
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
          // Powerful diagonal cleave
          const swing = Math.sin(attackProg * Math.PI);
          this.armR.rotation.set(-0.35 - (1 - attackProg) * 1.1 + attackProg * 0.8, 0, -0.15 + swing * 0.5);
          this.forearmR.rotation.set(-0.55 - (1 - attackProg) * 0.4 + attackProg * 0.6, 0, 0);
          this.handR.rotation.set(-0.1 + swing * 0.3, 0, 0);

          // Shield brace recoil
          this.armL.rotation.set(-0.38 - swing * 0.25, 0, 0.22);
          this.forearmL.rotation.set(-0.68 - swing * 0.15, 0, 0);

        } else if (this.characterClass === 'mage') {
          // Arcane staff thrust & crystal pulse
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
          // Rapid alternating twin dagger flurry
          const rLunge = attackProg < 0.5 ? Math.sin(attackProg * 2 * Math.PI) : 0;
          const lLunge = attackProg >= 0.5 ? Math.sin((attackProg - 0.5) * 2 * Math.PI) : 0;

          this.armR.rotation.set(-0.4 - rLunge * 0.8, 0, -0.18 + rLunge * 0.2);
          this.forearmR.rotation.set(-0.65 + rLunge * 0.5, 0, 0);

          this.armL.rotation.set(-0.4 - lLunge * 0.8, 0, 0.18 - lLunge * 0.2);
          this.forearmL.rotation.set(-0.65 + lLunge * 0.5, 0, 0);
        }
      }

      // Cape Wave
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
