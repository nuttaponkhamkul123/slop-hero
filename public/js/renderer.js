// High Performance 2D Canvas Isometric Renderer for Aetheria Online
class IsometricRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimapCanvas = document.getElementById('minimapCanvas');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

    this.camera = {
      x: 0,
      y: 0,
      zoom: 1.15,
      targetX: 0,
      targetY: 0,
      shakeOffsetX: 0,
      shakeOffsetY: 0
    };

    this.shake = {
      intensity: 0,
      time: 0,
      duration: 0
    };

    this.animations = {
      time: 0,
      clickMarker: null, // { x, y, life: 1.0 }
      particles: [],
      floatingTexts: [],
      skillEffects: []
    };

    this.attacks = new Map(); // playerId -> { time, duration, class, facing, x, y }
    this.dashes = new Map();  // playerId -> { time, duration, facing, x, y }

    // Authentic Pixel Art Sprite Assets (Idle, Walk/Run, Attack Slash & Dash)
    this.sprites = {
      swordman: new Image(),
      swordmanIdle: new Image(),
      swordmanAttack: new Image(),
      swordmanDash: new Image(),
      swordmanRunFront: new Image(),
      swordmanRunBack: new Image(),
      // Mage Authentic Pixel Art Sprites
      mageIdle: new Image(),
      mageAttack: new Image(),
      mageDash: new Image(),
      mageRun: new Image(),
      // Rogue Authentic Pixel Art Sprites
      rogueIdle: new Image(),
      rogueAttack: new Image(),
      rogueDash: new Image(),
      rogueRun: new Image()
    };
    this.sprites.swordman.src = 'sprites/swordman_sheet.png';
    this.sprites.swordmanIdle.src = 'sprites/swordman_idle_strip.png';
    this.sprites.swordmanAttack.src = 'sprites/swordman_attack_strip.png';
    this.sprites.swordmanDash.src = 'sprites/swordman_dash_strip.png';
    this.sprites.swordmanRunFront.src = 'sprites/swordman_run_front_strip.png';
    this.sprites.swordmanRunBack.src = 'sprites/swordman_run_back_strip.png';

    this.sprites.mageIdle.src = 'sprites/mage_idle_strip.png';
    this.sprites.mageAttack.src = 'sprites/mage_attack_strip.png';
    this.sprites.mageDash.src = 'sprites/mage_dash_strip.png';
    this.sprites.mageRun.src = 'sprites/mage_run_strip.png';

    this.sprites.rogueIdle.src = 'sprites/rogue_idle_strip.png';
    this.sprites.rogueAttack.src = 'sprites/rogue_attack_strip.png';
    this.sprites.rogueDash.src = 'sprites/rogue_dash_strip.png';
    this.sprites.rogueRun.src = 'sprites/rogue_run_strip.png';

    this.initCanvasSize();
    window.addEventListener('resize', () => this.initCanvasSize());
  }

  // Pixel-Perfect 8-Directional Swordman Turnaround Sprite Configuration (0 to 360 degrees)
  static get SWORDMAN_FRAMES() {
    return {
      S:  { sx: 0,   sy: 0,   sw: 256, sh: 286, anchorX: 129, anchorY: 262, footLX: 94,  footRX: 163, splitY: 228, midX: 129 },
      SE: { sx: 256, sy: 0,   sw: 256, sh: 286, anchorX: 113, anchorY: 261, footLX: 80,  footRX: 158, splitY: 228, midX: 119 },
      E:  { sx: 512, sy: 0,   sw: 256, sh: 286, anchorX: 88,  anchorY: 264, footLX: 87,  footRX: 150, splitY: 228, midX: 118 },
      NE: { sx: 768, sy: 0,   sw: 256, sh: 286, anchorX: 141, anchorY: 261, footLX: 97,  footRX: 170, splitY: 228, midX: 133 },
      N:  { sx: 0,   sy: 286, sw: 256, sh: 286, anchorX: 126, anchorY: 267, footLX: 97,  footRX: 159, splitY: 232, midX: 128 },
      NW: { sx: 256, sy: 286, sw: 256, sh: 286, anchorX: 102, anchorY: 267, footLX: 99,  footRX: 159, splitY: 232, midX: 129 },
      W:  { sx: 512, sy: 286, sw: 256, sh: 286, anchorX: 153, anchorY: 267, footLX: 110, footRX: 156, splitY: 228, midX: 133 },
      SW: { sx: 768, sy: 286, sw: 256, sh: 286, anchorX: 176, anchorY: 267, footLX: 93,  footRX: 177, splitY: 228, midX: 135 }
    };
  }

  // 4-Frame Dynamic Combat Run Dragging Sword (Front & Back Views)
  static get SWORDMAN_RUN_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 320, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 640, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 960, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Dynamic Sword Slash Attack Frames
  static get SWORDMAN_ATTACK_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 320, sh: 286, anchorX: 130, anchorY: 263 },
      { sx: 320, sy: 0, sw: 320, sh: 286, anchorX: 130, anchorY: 263 },
      { sx: 640, sy: 0, sw: 320, sh: 286, anchorX: 130, anchorY: 263 },
      { sx: 960, sy: 0, sw: 320, sh: 286, anchorX: 130, anchorY: 263 }
    ];
  }

  // 4-Frame Supersonic Dash / Blade Charge Frames
  static get SWORDMAN_DASH_FRAMES() {
    return [
      { sx: 0,    sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 360,  sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 720,  sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 1080, sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Living Idle Animation Frames (Breathing, Sway, Blade Gleam)
  static get SWORDMAN_IDLE_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 256, sh: 286, anchorX: 128, anchorY: 263 },
      { sx: 256, sy: 0, sw: 256, sh: 286, anchorX: 128, anchorY: 263 },
      { sx: 512, sy: 0, sw: 256, sh: 286, anchorX: 128, anchorY: 263 },
      { sx: 768, sy: 0, sw: 256, sh: 286, anchorX: 128, anchorY: 263 }
    ];
  }

  // 4-Frame Mage Dynamic Staff Dragging Combat Run Frames
  static get MAGE_RUN_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 320, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 640, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 960, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Mage Arcane Spell Beam / Burst Attack Frames
  static get MAGE_ATTACK_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 320, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 640, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 960, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Mage Arcane Blink / Warp Dash Frames
  static get MAGE_DASH_FRAMES() {
    return [
      { sx: 0,    sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 360,  sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 720,  sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 1080, sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Mage Living Idle Levitation & Breathing Frames
  static get MAGE_IDLE_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 320, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 640, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 960, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Rogue Reverse-Grip Dagger Dragging Ninja Sprint Frames
  static get ROGUE_RUN_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 320, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 640, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 960, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Rogue Dual Dagger Cross Cleave Attack Frames
  static get ROGUE_ATTACK_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 320, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 640, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 960, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Rogue Shadow Dive / Smoke Dash Frames
  static get ROGUE_DASH_FRAMES() {
    return [
      { sx: 0,    sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 360,  sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 720,  sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 1080, sy: 0, sw: 360, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  // 4-Frame Rogue Living Stealth Crouch & Dagger Flip Idle Frames
  static get ROGUE_IDLE_FRAMES() {
    return [
      { sx: 0,   sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 320, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 640, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 },
      { sx: 960, sy: 0, sw: 320, sh: 286, anchorX: 140, anchorY: 263 }
    ];
  }

  initCanvasSize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setCameraTarget(worldX, worldY) {
    const iso = Isometric.worldToIso(worldX, worldY);
    this.camera.targetX = iso.x;
    this.camera.targetY = iso.y;
  }

  triggerScreenShake(intensity = 6, duration = 0.16) {
    this.shake.intensity = Math.max(this.shake.intensity, intensity);
    this.shake.duration = duration;
    this.shake.time = duration;
  }

  updateCamera(dt) {
    // Smooth camera lerp
    this.camera.x += (this.camera.targetX - this.camera.x) * 0.12;
    this.camera.y += (this.camera.targetY - this.camera.y) * 0.12;

    // Screen Shake Processing
    if (this.shake.time > 0) {
      this.shake.time -= dt;
      const progress = Math.max(0, this.shake.time / this.shake.duration);
      const curIntensity = this.shake.intensity * progress;
      this.camera.shakeOffsetX = (Math.random() - 0.5) * 2 * curIntensity;
      this.camera.shakeOffsetY = (Math.random() - 0.5) * 2 * curIntensity;
    } else {
      this.camera.shakeOffsetX = 0;
      this.camera.shakeOffsetY = 0;
      this.shake.intensity = 0;
    }
  }

  addClickMarker(worldX, worldY) {
    this.animations.clickMarker = { x: worldX, y: worldY, life: 1.0 };
  }

  addFloatingText(worldX, worldY, text, color = '#ffffff', size = 16) {
    if (!text || worldX === undefined || worldY === undefined || isNaN(worldX) || isNaN(worldY)) return;

    // Hard cap active floating texts: instantly prune oldest if congested to eliminate lag
    if (this.animations.floatingTexts.length >= 30) {
      this.animations.floatingTexts.splice(0, this.animations.floatingTexts.length - 24);
    }

    const isCrit = text.includes('CRIT') || text.includes('AMBUSH') || text.includes('💥') || text.includes('👑') || size >= 20;
    const isHeal = text.includes('+') && text.includes('HP');
    const isDeflect = text.includes('DEFLECTED') || text.includes('GLANCING');

    // Dynamic fountain arc spread: alternating left-right scatter
    const spreadAngle = (Math.random() - 0.5) * Math.PI * 0.7; // -63° to +63°
    const spreadSpeed = isCrit ? 45 + Math.random() * 25 : 30 + Math.random() * 20;
    const vx = Math.sin(spreadAngle) * spreadSpeed;
    const vy = -Math.cos(spreadAngle) * spreadSpeed - (isCrit ? 35 : 20);

    this.animations.floatingTexts.push({
      x: worldX + (Math.random() - 0.5) * 0.35,
      y: worldY + (Math.random() - 0.5) * 0.25,
      text,
      color,
      size: isCrit ? Math.max(size, 20) : size,
      vx,
      vy,
      screenOffsetX: (Math.random() - 0.5) * 16,
      screenOffsetY: -(Math.random() * 12),
      gravity: 58,
      drag: 0.94,
      scale: isCrit ? 1.35 : 1.15,
      isCrit,
      isHeal,
      isDeflect,
      life: isCrit ? 0.9 : 0.75, // Snappy lifetime clears quickly
      maxLife: isCrit ? 0.9 : 0.75
    });
  }

  triggerAttackAnimation(data) {
    if (!data || !data.attackerId) return;

    // Resolve accurate world position fallback if data.x / data.y are missing
    let posX = (data.x !== undefined && !isNaN(data.x)) ? data.x : null;
    let posY = (data.y !== undefined && !isNaN(data.y)) ? data.y : null;
    if (posX === null || posY === null) {
      if (this.lastGameState && this.lastGameState.players) {
        const pl = this.lastGameState.players.find(p => p.id === data.attackerId);
        if (pl && !isNaN(pl.x) && !isNaN(pl.y)) {
          posX = pl.x;
          posY = pl.y;
        }
      }
    }
    if (posX === null || posY === null) {
      posX = this.camera ? (this.camera.targetX || 0) : 0;
      posY = this.camera ? (this.camera.targetY || 0) : 0;
    }

    const isWarrior = data.class === 'warrior';
    const isMage = data.class === 'mage';
    const isRogue = data.class === 'rogue';
    const atkSpeed = Math.max(0.4, data.attackSpeed || 1.0);
    const baseDuration = isWarrior ? 300 : isRogue ? 260 : 320;
    const duration = Math.round(baseDuration / atkSpeed);

    this.attacks.set(data.attackerId, {
      time: performance.now(),
      duration: duration,
      class: data.class || 'warrior',
      facing: data.facing || 'SE',
      x: posX,
      y: posY,
      hasSweep: !!data.hasSweep
    });

    // Camera punchy impact shake!
    this.triggerScreenShake(isWarrior ? 7 : isRogue ? 5 : 6, 0.16);

    // Authentic Class-Specific Basic Attack Slash & Cast FX
    if (isMage) {
      this.animations.skillEffects.push({
        type: 'mage_basic_blast',
        x: posX,
        y: posY,
        facing: data.facing || 'SE',
        life: 0.28,
        maxLife: 0.28,
        class: 'mage'
      });
      this.addParticles(posX, posY, 'fire', 8);
      this.addParticles(posX, posY, 'spark', 8);
      this.addParticles(posX, posY, 'arcane', 6);
    } else if (isRogue) {
      this.animations.skillEffects.push({
        type: 'sweeping_edge',
        x: posX,
        y: posY,
        facing: data.facing || 'SE',
        life: 0.24,
        maxLife: 0.24,
        radius: 1.8,
        class: 'rogue'
      });
      this.addParticles(posX, posY, 'shadow', 8);
      this.addParticles(posX, posY, 'slash', 8);
    } else {
      // Warrior Heavy Cleave
      this.animations.skillEffects.push({
        type: 'sweeping_edge',
        x: posX,
        y: posY,
        facing: data.facing || 'SE',
        life: 0.28,
        maxLife: 0.28,
        radius: data.hasSweep ? 2.6 : 2.2,
        class: 'warrior'
      });
      this.addParticles(posX, posY, 'slash', 12);
      this.addParticles(posX, posY, 'spark', 8);
    }
  }

  triggerDashAnimation(data) {
    if (!data) return;
    const playerId = typeof data === 'object' ? (data.playerId || data.attackerId) : data;
    if (!playerId) return;
    const duration = (typeof data === 'object' && data.duration) || 320;
    const facing = (typeof data === 'object' && data.facing) || 'SE';
    this.dashes.set(playerId, {
      time: performance.now(),
      duration: duration,
      facing: facing
    });
    this.triggerScreenShake(4, 0.14);
  }

  addSkillEffect(fx) {
    if (!fx || !fx.type) return;

    const skillLifetimes = {
      firestorm: 1.0,
      earthshaker: 0.9,
      whirlwind: 0.85,
      frost_nova: 0.8,
      black_hole: 1.25,
      blizzard: 1.25,
      toxic_bomb: 1.15,
      colossus_strike: 0.85,
      death_blossom: 0.85,
      chain_lightning: 0.55,
      blade_charge: 0.45,
      arcane_blink: 0.5,
      shadow_dash: 0.45,
      shadowstep: 0.45,
      shadow_strike: 0.45,
      shield_slam: 0.4,
      blood_rage: 1.1,
      iron_fortress: 1.1,
      war_stomp: 0.75,
      mana_shield: 1.1,
      pyroblast: 0.75,
      smoke_screen: 1.2,
      poison_darts: 0.5,
      caltrops: 1.2,
      dragon_roar: 1.2,
      meteor_dive: 0.9,
      bladestorm_frenzy: 1.25,
      titan_bastion: 1.2,
      sundering_cleave: 0.8,
      ragnarok_slash: 1.35,
      thunder_storm: 1.1,
      glacial_comet: 1.05,
      arcane_hyperbeam: 0.85,
      time_dilation: 1.3,
      supernova_blast: 1.15,
      genesis_cataclysm: 1.4,
      venomous_barrage: 0.75,
      phantom_assassins: 0.95,
      assassins_cull: 0.65,
      abyssal_tether: 1.15,
      blade_dance: 1.1,
      eclipse_execution: 1.45
    };

    const maxLife = skillLifetimes[fx.type] || 0.65;
    const effect = {
      ...fx,
      life: maxLife,
      maxLife: maxLife,
      emitTimer: 0
    };
    this.animations.skillEffects.push(effect);

    // Elemental Rune Particle Burst!
    if (fx.rune && fx.rune !== 'none') {
      const rx = fx.x !== undefined ? fx.x : (fx.startX !== undefined ? fx.startX : 0);
      const ry = fx.y !== undefined ? fx.y : (fx.startY !== undefined ? fx.startY : 0);
      if (fx.rune === 'flame') {
        this.addParticles(rx, ry, 'fire', 32);
        this.addParticles(rx, ry, 'spark', 20);
      } else if (fx.rune === 'frost') {
        this.addParticles(rx, ry, 'ice', 32);
        this.addParticles(rx, ry, 'spark', 16);
      } else if (fx.rune === 'tempest') {
        this.addParticles(rx, ry, 'lightning', 28);
        this.addParticles(rx, ry, 'arcane', 24);
      } else if (fx.rune === 'vampiric') {
        this.addParticles(rx, ry, 'shadow', 32);
        this.addParticles(rx, ry, 'slash', 20);
      }
    }

    if (fx.type === 'whirlwind') {
      this.addParticles(fx.x, fx.y, 'wind', 55);
      this.addParticles(fx.x, fx.y, 'slash', 35);
      this.addParticles(fx.x, fx.y, 'spark', 28);
      this.addParticles(fx.x, fx.y, 'dust', 24);
      this.triggerScreenShake(8, 0.22);
    } else if (fx.type === 'firestorm') {
      this.addParticles(fx.x, fx.y, 'fire', 65);
      this.addParticles(fx.x, fx.y, 'spark', 42);
      this.addParticles(fx.x, fx.y, 'dust', 22);
      this.triggerScreenShake(11, 0.26);
    } else if (fx.type === 'blade_charge') {
      if (fx.playerId) this.triggerDashAnimation({ playerId: fx.playerId, duration: 350, facing: fx.facing });
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'slash', 32);
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'wind', 24);
      this.addParticles(fx.x, fx.y, 'spark', 36);
      this.addParticles(fx.x, fx.y, 'slash', 28);
      this.triggerScreenShake(9, 0.22);
    } else if (fx.type === 'earthshaker') {
      this.addParticles(fx.x, fx.y, 'earth', 55);
      this.addParticles(fx.x, fx.y, 'spark', 38);
      this.addParticles(fx.x, fx.y, 'dust', 45);
      this.triggerScreenShake(16, 0.32);
    } else if (fx.type === 'frost_nova') {
      this.addParticles(fx.x, fx.y, 'ice', 60);
      this.addParticles(fx.x, fx.y, 'arcane', 40);
      this.addParticles(fx.x, fx.y, 'spark', 24);
      this.triggerScreenShake(7, 0.18);
    } else if (fx.type === 'arcane_blink') {
      if (fx.playerId) this.triggerDashAnimation({ playerId: fx.playerId, duration: 300, facing: fx.facing });
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'arcane', 40);
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'spark', 20);
      this.addParticles(fx.x, fx.y, 'arcane', 45);
      this.addParticles(fx.x, fx.y, 'spark', 26);
      this.triggerScreenShake(6, 0.16);
    } else if (fx.type === 'fan_of_knives') {
      this.addParticles(fx.x, fx.y, 'slash', 48);
      this.addParticles(fx.x, fx.y, 'poison', 36);
      this.addParticles(fx.x, fx.y, 'spark', 24);
      this.triggerScreenShake(8, 0.20);
    } else if (fx.type === 'toxic_bomb') {
      this.addParticles(fx.x, fx.y, 'poison', 60);
      this.addParticles(fx.x, fx.y, 'shadow', 32);
      this.addParticles(fx.x, fx.y, 'dust', 20);
      this.triggerScreenShake(7, 0.18);
    } else if (fx.type === 'shadow_dash') {
      if (fx.playerId) this.triggerDashAnimation({ playerId: fx.playerId, duration: 320, facing: fx.facing });
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'shadow', 40);
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'slash', 22);
      this.addParticles(fx.x, fx.y, 'shadow', 40);
      this.addParticles(fx.x, fx.y, 'poison', 20);
      this.triggerScreenShake(7, 0.16);
    } else if (fx.type === 'shadow_strike') {
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'shadow', 36);
      this.addParticles(fx.x, fx.y, 'slash', 38);
      this.addParticles(fx.x, fx.y, 'shadow', 36);
      this.triggerScreenShake(9, 0.20);
    } else if (fx.type === 'colossus_strike') {
      this.addParticles(fx.x, fx.y, 'earth', 65);
      this.addParticles(fx.x, fx.y, 'spark', 50);
      this.addParticles(fx.x, fx.y, 'slash', 45);
      this.addParticles(fx.x, fx.y, 'dust', 40);
      this.triggerScreenShake(18, 0.35);
    } else if (fx.type === 'shield_slam') {
      this.addParticles(fx.x, fx.y, 'spark', 40);
      this.addParticles(fx.x, fx.y, 'wind', 32);
      this.addParticles(fx.x, fx.y, 'dust', 22);
      this.triggerScreenShake(9, 0.20);
    } else if (fx.type === 'blood_rage') {
      this.addParticles(fx.x, fx.y, 'fire', 55);
      this.addParticles(fx.x, fx.y, 'spark', 35);
      this.addParticles(fx.x, fx.y, 'shadow', 24);
      this.triggerScreenShake(7, 0.18);
    } else if (fx.type === 'iron_fortress') {
      this.addParticles(fx.x, fx.y, 'earth', 35);
      this.addParticles(fx.x, fx.y, 'spark', 35);
      this.addParticles(fx.x, fx.y, 'wind', 25);
      this.triggerScreenShake(6, 0.15);
    } else if (fx.type === 'war_stomp') {
      this.addParticles(fx.x, fx.y, 'earth', 55);
      this.addParticles(fx.x, fx.y, 'wind', 40);
      this.addParticles(fx.x, fx.y, 'spark', 35);
      this.addParticles(fx.x, fx.y, 'dust', 45);
      this.triggerScreenShake(13, 0.26);
    } else if (fx.type === 'chain_lightning') {
      if (fx.points) {
        fx.points.forEach(pt => {
          this.addParticles(pt.x, pt.y, 'lightning', 30);
          this.addParticles(pt.x, pt.y, 'spark', 22);
        });
      }
      this.triggerScreenShake(8, 0.22);
    } else if (fx.type === 'mana_shield') {
      this.addParticles(fx.x, fx.y, 'arcane', 45);
      this.addParticles(fx.x, fx.y, 'spark', 24);
    } else if (fx.type === 'black_hole') {
      this.addParticles(fx.x, fx.y, 'shadow', 65);
      this.addParticles(fx.x, fx.y, 'arcane', 55);
      this.addParticles(fx.x, fx.y, 'spark', 30);
      this.triggerScreenShake(15, 0.32);
    } else if (fx.type === 'blizzard') {
      this.addParticles(fx.x, fx.y, 'ice', 65);
      this.addParticles(fx.x, fx.y, 'wind', 35);
      this.addParticles(fx.x, fx.y, 'spark', 20);
      this.triggerScreenShake(8, 0.22);
    } else if (fx.type === 'pyroblast') {
      this.addParticles(fx.x, fx.y, 'fire', 65);
      this.addParticles(fx.x, fx.y, 'spark', 45);
      this.addParticles(fx.x, fx.y, 'dust', 25);
      this.triggerScreenShake(12, 0.28);
    } else if (fx.type === 'shadowstep') {
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'shadow', 36);
      this.addParticles(fx.x, fx.y, 'shadow', 45);
      this.addParticles(fx.x, fx.y, 'slash', 24);
      this.triggerScreenShake(8, 0.18);
    } else if (fx.type === 'smoke_screen') {
      this.addParticles(fx.x, fx.y, 'shadow', 55);
      this.addParticles(fx.x, fx.y, 'poison', 35);
      this.addParticles(fx.x, fx.y, 'dust', 30);
    } else if (fx.type === 'death_blossom') {
      this.addParticles(fx.x, fx.y, 'slash', 55);
      this.addParticles(fx.x, fx.y, 'shadow', 45);
      this.addParticles(fx.x, fx.y, 'poison', 28);
      this.triggerScreenShake(13, 0.28);
    } else if (fx.type === 'poison_darts') {
      this.addParticles(fx.x, fx.y, 'poison', 40);
      this.addParticles(fx.x, fx.y, 'slash', 24);
      this.triggerScreenShake(6, 0.14);
    } else if (fx.type === 'caltrops') {
      this.addParticles(fx.x, fx.y, 'earth', 30);
      this.addParticles(fx.x, fx.y, 'spark', 24);
    } else if (fx.type === 'dragon_roar') {
      this.addParticles(fx.x, fx.y, 'fire', 60);
      this.addParticles(fx.x, fx.y, 'spark', 40);
      this.addParticles(fx.x, fx.y, 'dust', 30);
      this.triggerScreenShake(14, 0.28);
    } else if (fx.type === 'meteor_dive') {
      this.addParticles(fx.x, fx.y, 'fire', 80);
      this.addParticles(fx.x, fx.y, 'earth', 45);
      this.addParticles(fx.x, fx.y, 'spark', 50);
      this.addParticles(fx.x, fx.y, 'dust', 40);
      this.triggerScreenShake(18, 0.35);
    } else if (fx.type === 'bladestorm_frenzy') {
      this.addParticles(fx.x, fx.y, 'wind', 70);
      this.addParticles(fx.x, fx.y, 'slash', 50);
      this.addParticles(fx.x, fx.y, 'spark', 35);
      this.triggerScreenShake(12, 0.25);
    } else if (fx.type === 'titan_bastion') {
      this.addParticles(fx.x, fx.y, 'spark', 50);
      this.addParticles(fx.x, fx.y, 'gold', 35);
      this.addParticles(fx.x, fx.y, 'arcane', 30);
      this.triggerScreenShake(10, 0.20);
    } else if (fx.type === 'sundering_cleave') {
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'earth', 45);
      this.addParticles(fx.x, fx.y, 'earth', 65);
      this.addParticles(fx.x, fx.y, 'spark', 40);
      this.addParticles(fx.x, fx.y, 'slash', 35);
      this.triggerScreenShake(16, 0.32);
    } else if (fx.type === 'ragnarok_slash') {
      this.addParticles(fx.x, fx.y, 'slash', 90);
      this.addParticles(fx.x, fx.y, 'gold', 60);
      this.addParticles(fx.x, fx.y, 'spark', 65);
      this.addParticles(fx.x, fx.y, 'lightning', 45);
      this.triggerScreenShake(22, 0.45);
    } else if (fx.type === 'thunder_storm') {
      this.addParticles(fx.x, fx.y, 'lightning', 65);
      this.addParticles(fx.x, fx.y, 'arcane', 45);
      this.addParticles(fx.x, fx.y, 'spark', 40);
      this.triggerScreenShake(14, 0.28);
    } else if (fx.type === 'glacial_comet') {
      this.addParticles(fx.x, fx.y, 'ice', 75);
      this.addParticles(fx.x, fx.y, 'arcane', 45);
      this.addParticles(fx.x, fx.y, 'spark', 35);
      this.addParticles(fx.x, fx.y, 'dust', 30);
      this.triggerScreenShake(17, 0.34);
    } else if (fx.type === 'arcane_hyperbeam') {
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'arcane', 40);
      this.addParticles(fx.x, fx.y, 'arcane', 60);
      this.addParticles(fx.x, fx.y, 'spark', 45);
      this.addParticles(fx.x, fx.y, 'lightning', 30);
      this.triggerScreenShake(12, 0.26);
    } else if (fx.type === 'time_dilation') {
      this.addParticles(fx.x, fx.y, 'arcane', 55);
      this.addParticles(fx.x, fx.y, 'ice', 35);
      this.addParticles(fx.x, fx.y, 'spark', 30);
      this.triggerScreenShake(8, 0.18);
    } else if (fx.type === 'supernova_blast') {
      this.addParticles(fx.x, fx.y, 'fire', 90);
      this.addParticles(fx.x, fx.y, 'spark', 70);
      this.addParticles(fx.x, fx.y, 'arcane', 50);
      this.addParticles(fx.x, fx.y, 'dust', 35);
      this.triggerScreenShake(20, 0.40);
    } else if (fx.type === 'genesis_cataclysm') {
      this.addParticles(fx.x, fx.y, 'arcane', 95);
      this.addParticles(fx.x, fx.y, 'spark', 80);
      this.addParticles(fx.x, fx.y, 'fire', 55);
      this.addParticles(fx.x, fx.y, 'lightning', 50);
      this.triggerScreenShake(24, 0.50);
    } else if (fx.type === 'venomous_barrage') {
      this.addParticles(fx.x, fx.y, 'poison', 55);
      this.addParticles(fx.x, fx.y, 'slash', 35);
      this.addParticles(fx.x, fx.y, 'spark', 25);
      this.triggerScreenShake(8, 0.18);
    } else if (fx.type === 'phantom_assassins') {
      this.addParticles(fx.x, fx.y, 'shadow', 60);
      this.addParticles(fx.x, fx.y, 'slash', 45);
      this.addParticles(fx.x, fx.y, 'arcane', 30);
      this.triggerScreenShake(10, 0.22);
    } else if (fx.type === 'assassins_cull') {
      this.addParticles(fx.x, fx.y, 'slash', 65);
      this.addParticles(fx.x, fx.y, 'shadow', 40);
      this.addParticles(fx.x, fx.y, 'spark', 35);
      this.triggerScreenShake(14, 0.26);
    } else if (fx.type === 'abyssal_tether') {
      this.addParticles(fx.x, fx.y, 'shadow', 65);
      this.addParticles(fx.x, fx.y, 'poison', 40);
      this.addParticles(fx.x, fx.y, 'arcane', 35);
      this.triggerScreenShake(10, 0.20);
    } else if (fx.type === 'blade_dance') {
      this.addParticles(fx.x, fx.y, 'slash', 75);
      this.addParticles(fx.x, fx.y, 'shadow', 50);
      this.addParticles(fx.x, fx.y, 'spark', 35);
      this.triggerScreenShake(12, 0.25);
    } else if (fx.type === 'eclipse_execution') {
      this.addParticles(fx.x, fx.y, 'shadow', 100);
      this.addParticles(fx.x, fx.y, 'slash', 85);
      this.addParticles(fx.x, fx.y, 'arcane', 60);
      this.addParticles(fx.x, fx.y, 'spark', 50);
      this.triggerScreenShake(22, 0.45);
    }
  }

  // Continuous Dynamic Multi-Wave Particle Emitter for Active Skills
  emitSkillParticlesTick(fx, progress, alpha) {
    if (alpha <= 0.05) return;
    const fxX = fx.x !== undefined ? fx.x : (fx.startX || 0);
    const fxY = fx.y !== undefined ? fx.y : (fx.startY || 0);

    if (fx.type === 'whirlwind') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 3.0) * (0.4 + Math.random() * 0.6);
      const px = fxX + Math.cos(angle) * r;
      const py = fxY + Math.sin(angle) * r;
      this.addParticles(px, py, 'wind', 2, { speed: 2.5, angle: angle + Math.PI * 0.5 });
      this.addParticles(px, py, 'spark', 1, { speed: 1.8 });
    } else if (fx.type === 'firestorm') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 3.5) * Math.sqrt(Math.random());
      const px = fxX + Math.cos(angle) * r;
      const py = fxY + Math.sin(angle) * r;
      this.addParticles(px, py, 'fire', 2, { speed: 1.2, z: 0.1 });
      if (Math.random() < 0.6) this.addParticles(px, py, 'spark', 1, { speed: 2.0 });
    } else if (fx.type === 'blade_charge') {
      const p = Math.random();
      const px = (fx.startX || fxX) * (1 - p) + fxX * p;
      const py = (fx.startY || fxY) * (1 - p) + fxY * p;
      this.addParticles(px, py, 'spark', 1, { speed: 1.5 });
    } else if (fx.type === 'earthshaker') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 3.4) * Math.random();
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'spark', 1, { speed: 2.2 });
      if (Math.random() < 0.5) this.addParticles(fxX, fxY, 'dust', 1, { speed: 0.8 });
    } else if (fx.type === 'frost_nova') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 4.0) * (0.6 + Math.random() * 0.4) * Math.min(1.0, progress * 1.5);
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'ice', 1, { speed: 1.2 });
      if (Math.random() < 0.5) this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'arcane', 1);
    } else if (fx.type === 'black_hole') {
      // Inward-spiraling matter particles!
      for (let k = 0; k < 3; k++) {
        const angle = Math.random() * Math.PI * 2;
        const r = (fx.radius || 4.8) * (0.5 + Math.random() * 0.5);
        const px = fxX + Math.cos(angle) * r;
        const py = fxY + Math.sin(angle) * r;
        this.addParticles(px, py, 'shadow', 1, { speed: 1.8, angle: angle + Math.PI * 0.85, z: 0.2 });
      }
      this.addParticles(fxX, fxY, 'arcane', 1, { speed: 0.8 });
    } else if (fx.type === 'blizzard') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 4.4) * Math.sqrt(Math.random());
      const px = fxX + Math.cos(angle) * r;
      const py = fxY + Math.sin(angle) * r;
      this.addParticles(px, py, 'ice', 2, { speed: 1.4, z: 1.8, vz: -3.5 });
      this.addParticles(px, py, 'wind', 1, { speed: 2.2 });
    } else if (fx.type === 'toxic_bomb') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 3.2) * Math.sqrt(Math.random());
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'poison', 2, { speed: 0.9, z: 0.1 });
    } else if (fx.type === 'chain_lightning') {
      if (fx.points && fx.points.length > 1) {
        const idx = Math.floor(Math.random() * (fx.points.length - 1));
        const p1 = fx.points[idx];
        const p2 = fx.points[idx + 1];
        const t = Math.random();
        const px = p1.x * (1 - t) + p2.x * t;
        const py = p1.y * (1 - t) + p2.y * t;
        this.addParticles(px, py, 'lightning', 1, { speed: 1.5 });
        this.addParticles(px, py, 'spark', 1, { speed: 2.2 });
      }
    } else if (fx.type === 'colossus_strike') {
      this.addParticles(fxX, fxY, 'spark', 2, { speed: 3.0 });
      if (Math.random() < 0.6) this.addParticles(fxX, fxY, 'earth', 1, { speed: 2.5 });
    } else if (fx.type === 'death_blossom') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 4.0) * Math.random();
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'slash', 2, { speed: 2.8 });
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'shadow', 1, { speed: 1.5 });
    } else if (fx.type === 'blood_rage') {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.8 * Math.random();
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'fire', 1, { speed: 0.8, z: 0.2 });
    } else if (fx.type === 'mana_shield') {
      const angle = this.animations.time * 6 + Math.random() * 0.4;
      const r = 1.2;
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'arcane', 1, { speed: 0.5, z: 0.4 });
    } else if (fx.type === 'iron_fortress') {
      const angle = Math.random() * Math.PI * 2;
      const r = 1.4;
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'earth', 1, { speed: 1.0 });
    } else if (fx.type === 'pyroblast') {
      this.addParticles(fxX, fxY, 'fire', 2, { speed: 2.4 });
      this.addParticles(fxX, fxY, 'spark', 1, { speed: 2.8 });
    } else if (fx.type === 'smoke_screen') {
      const angle = Math.random() * Math.PI * 2;
      const r = 2.4 * Math.random();
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'shadow', 2, { speed: 0.8 });
    } else if (fx.type === 'fan_of_knives') {
      const angle = Math.random() * Math.PI * 2;
      const r = (fx.radius || 3.4) * progress;
      this.addParticles(fxX + Math.cos(angle) * r, fxY + Math.sin(angle) * r, 'poison', 1, { speed: 1.5 });
    }
  }

  // High-Performance Multi-Elemental Particle Spawner with Physical Dynamics
  addParticles(worldX, worldY, type = 'slash', count = 16, customOpts = {}) {
    for (let i = 0; i < count; i++) {
      const angle = customOpts.angle !== undefined
        ? (customOpts.angle + (Math.random() - 0.5) * (customOpts.spread || Math.PI * 0.6))
        : (Math.random() * Math.PI * 2);

      const baseSpeed = customOpts.speed || (1.2 + Math.random() * 3.8);
      const speed = baseSpeed * (0.6 + Math.random() * 0.8);

      let color = '#38bdf8';
      let coreColor = '#ffffff';
      let glowColor = 'rgba(56, 189, 248, 0.5)';
      let size = 3 + Math.random() * 4;
      let life = 0.45 + Math.random() * 0.45;
      let gravity = 0;
      let buoyancy = 0;
      let drag = 0.94;
      let bounce = false;
      let turbulence = 0;
      let blend = 'lighter';
      let rot = Math.random() * Math.PI * 2;
      let vrot = (Math.random() - 0.5) * 8;
      let vz = (Math.random() * 2.2 - 0.5);

      if (type === 'fire') {
        const firePalettes = [
          { c: '#ef4444', core: '#fef08a', glow: 'rgba(239, 68, 68, 0.6)' },
          { c: '#f97316', core: '#ffffff', glow: 'rgba(249, 115, 22, 0.6)' },
          { c: '#facc15', core: '#ffffff', glow: 'rgba(250, 204, 21, 0.7)' },
          { c: '#dc2626', core: '#f97316', glow: 'rgba(220, 38, 38, 0.5)' }
        ];
        const p = firePalettes[Math.floor(Math.random() * firePalettes.length)];
        color = p.c; coreColor = p.core; glowColor = p.glow;
        size = 5 + Math.random() * 6.5;
        life = 0.5 + Math.random() * 0.5;
        buoyancy = 2.4;
        drag = 0.92;
        turbulence = 2.8;
        vz = 1.2 + Math.random() * 2.2;
      } else if (type === 'slash' || type === 'spark') {
        const sparkPalettes = [
          { c: '#fef08a', core: '#ffffff', glow: 'rgba(250, 204, 21, 0.8)' },
          { c: '#38bdf8', core: '#ffffff', glow: 'rgba(56, 189, 248, 0.8)' },
          { c: '#f59e0b', core: '#fef08a', glow: 'rgba(245, 158, 11, 0.7)' },
          { c: '#ffffff', core: '#ffffff', glow: 'rgba(255, 255, 255, 0.9)' }
        ];
        const p = sparkPalettes[Math.floor(Math.random() * sparkPalettes.length)];
        color = p.c; coreColor = p.core; glowColor = p.glow;
        size = 3.0 + Math.random() * 3.8;
        life = 0.35 + Math.random() * 0.35;
        gravity = 5.2;
        drag = 0.90;
        bounce = true;
        vz = 1.6 + Math.random() * 3.0;
      } else if (type === 'arcane') {
        const arcanePalettes = [
          { c: '#c084fc', core: '#ffffff', glow: 'rgba(192, 132, 252, 0.7)' },
          { c: '#38bdf8', core: '#ffffff', glow: 'rgba(56, 189, 248, 0.7)' },
          { c: '#e879f9', core: '#ffffff', glow: 'rgba(232, 121, 249, 0.6)' },
          { c: '#818cf8', core: '#c084fc', glow: 'rgba(129, 140, 248, 0.6)' }
        ];
        const p = arcanePalettes[Math.floor(Math.random() * arcanePalettes.length)];
        color = p.c; coreColor = p.core; glowColor = p.glow;
        size = 4.5 + Math.random() * 5.2;
        life = 0.55 + Math.random() * 0.45;
        buoyancy = 0.9;
        drag = 0.95;
        turbulence = 2.0;
        vrot = (Math.random() - 0.5) * 6;
      } else if (type === 'ice') {
        const icePalettes = [
          { c: '#67e8f9', core: '#ffffff', glow: 'rgba(103, 232, 249, 0.7)' },
          { c: '#bae6fd', core: '#ffffff', glow: 'rgba(186, 230, 253, 0.7)' },
          { c: '#0284c7', core: '#a5f3fc', glow: 'rgba(2, 132, 199, 0.6)' },
          { c: '#ffffff', core: '#bae6fd', glow: 'rgba(255, 255, 255, 0.85)' }
        ];
        const p = icePalettes[Math.floor(Math.random() * icePalettes.length)];
        color = p.c; coreColor = p.core; glowColor = p.glow;
        size = 4 + Math.random() * 5.5;
        life = 0.5 + Math.random() * 0.45;
        gravity = 3.4;
        drag = 0.93;
        bounce = true;
        vz = 1.0 + Math.random() * 2.4;
        vrot = (Math.random() - 0.5) * 12;
      } else if (type === 'lightning') {
        const boltPalettes = [
          { c: '#67e8f9', core: '#ffffff', glow: 'rgba(103, 232, 249, 0.9)' },
          { c: '#fde047', core: '#ffffff', glow: 'rgba(253, 224, 71, 0.9)' },
          { c: '#c084fc', core: '#ffffff', glow: 'rgba(192, 132, 252, 0.8)' }
        ];
        const p = boltPalettes[Math.floor(Math.random() * boltPalettes.length)];
        color = p.c; coreColor = p.core; glowColor = p.glow;
        size = 5.5 + Math.random() * 6.0;
        life = 0.25 + Math.random() * 0.22;
        drag = 0.85;
        vz = (Math.random() - 0.5) * 3;
      } else if (type === 'poison') {
        const poisonPalettes = [
          { c: '#22c55e', core: '#86efac', glow: 'rgba(34, 197, 94, 0.7)' },
          { c: '#4ade80', core: '#ffffff', glow: 'rgba(74, 222, 128, 0.7)' },
          { c: '#16a34a', core: '#bbf7d0', glow: 'rgba(22, 163, 74, 0.6)' }
        ];
        const p = poisonPalettes[Math.floor(Math.random() * poisonPalettes.length)];
        color = p.c; coreColor = p.core; glowColor = p.glow;
        size = 4.5 + Math.random() * 5.2;
        life = 0.5 + Math.random() * 0.45;
        buoyancy = 0.7;
        drag = 0.94;
        turbulence = 2.4;
        vz = 0.8 + Math.random() * 1.8;
      } else if (type === 'shadow') {
        const shadowPalettes = [
          { c: '#a855f7', core: '#c084fc', glow: 'rgba(168, 85, 247, 0.7)' },
          { c: '#9333ea', core: '#e9d5ff', glow: 'rgba(147, 51, 234, 0.7)' },
          { c: '#6b21a8', core: '#a855f7', glow: 'rgba(107, 33, 168, 0.6)' }
        ];
        const p = shadowPalettes[Math.floor(Math.random() * shadowPalettes.length)];
        color = p.c; coreColor = p.core; glowColor = p.glow;
        size = 5 + Math.random() * 6;
        life = 0.55 + Math.random() * 0.45;
        drag = 0.93;
        buoyancy = 1.1;
        turbulence = 3.2;
        vz = 1.0 + Math.random() * 1.8;
      } else if (type === 'earth') {
        const earthColors = ['#78350f', '#92400e', '#b45309', '#d97706', '#64748b'];
        color = earthColors[Math.floor(Math.random() * earthColors.length)];
        coreColor = '#451a03';
        glowColor = 'rgba(0, 0, 0, 0.3)';
        size = 4 + Math.random() * 6.5;
        life = 0.6 + Math.random() * 0.45;
        gravity = 9.8;
        drag = 0.92;
        bounce = true;
        blend = 'source-over';
        vz = 2.5 + Math.random() * 4.2;
        vrot = (Math.random() - 0.5) * 14;
      } else if (type === 'wind') {
        const windColors = ['#e0f2fe', '#bae6fd', '#7dd3fc', '#ffffff'];
        color = windColors[Math.floor(Math.random() * windColors.length)];
        coreColor = '#ffffff';
        glowColor = 'rgba(56, 189, 248, 0.6)';
        size = 4 + Math.random() * 5.5;
        life = 0.4 + Math.random() * 0.35;
        drag = 0.95;
        vz = 0.8 + Math.random() * 1.5;
      } else if (type === 'gold' || type === 'loot') {
        color = '#facc15'; coreColor = '#ffffff'; glowColor = 'rgba(250, 204, 21, 0.8)';
        size = 4 + Math.random() * 4.5;
        life = 0.6 + Math.random() * 0.4;
        gravity = 3.8;
        bounce = true;
        drag = 0.92;
        vz = 2.2 + Math.random() * 2.5;
        vrot = (Math.random() - 0.5) * 8;
      } else if (type === 'dust') {
        color = 'rgba(168, 162, 158, 0.45)'; coreColor = 'rgba(214, 211, 209, 0.5)'; glowColor = 'rgba(0, 0, 0, 0.05)';
        size = 1.8 + Math.random() * 1.8;
        life = 0.22 + Math.random() * 0.15;
        drag = 0.85;
        blend = 'source-over';
        vz = 0.2 + Math.random() * 0.4;
      } else if (type === 'level') {
        const levelColors = ['#fde047', '#38bdf8', '#c084fc', '#ffffff'];
        color = levelColors[Math.floor(Math.random() * levelColors.length)];
        coreColor = '#ffffff';
        glowColor = 'rgba(250, 204, 21, 0.9)';
        size = 5.0 + Math.random() * 5.5;
        life = 0.8 + Math.random() * 0.5;
        buoyancy = 3.5;
        drag = 0.96;
        vz = 2.5 + Math.random() * 3.5;
        vrot = (Math.random() - 0.5) * 8;
        blend = 'lighter';
      }

      this.animations.particles.push({
        id: Math.random() * 1000,
        x: worldX,
        y: worldY,
        z: (customOpts.z !== undefined ? customOpts.z : 0.3) + Math.random() * 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: vz,
        gravity,
        buoyancy,
        drag,
        bounce,
        turbulence,
        rot,
        vrot,
        blend,
        type,
        color,
        coreColor,
        glowColor,
        size,
        life,
        maxLife: life
      });
    }
  }

  render(gameState, localPlayerId, selectedTargetId, dt) {
    this.lastGameState = gameState;
    this.animations.time += dt;
    this.updateCamera(dt);

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear Screen with deep fantasy dark ambient background
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, w, h);

    if (!gameState || !gameState.map) return;

    // PASS 1: VISIBLE GROUND TILES PASS (Base Terrain Layer)
    // Rendered first so flat ground diamond tiles NEVER clip or cover players or mobs walking over them
    const map = gameState.map;
    this.currentTheme = map.theme || (map.isDungeon ? 'dungeon' : 'town');
    const isDungeon = map.isDungeon || (map.tiles && map.tiles[0] && (map.tiles[0][0] === 8 || map.tiles[0][0] === 7));
    const groundTiles = [];
    const wallTiles = [];

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tileType = map.tiles[y][x];

        // If Deep Void (8), skip completely (natural dark abyss)
        if (tileType === 8) continue;

        const iso = Isometric.worldToIso(x, y);
        const screen = {
          x: (iso.x - this.camera.x) * this.camera.zoom + w / 2,
          y: (iso.y - this.camera.y) * this.camera.zoom + h / 2
        };

        // Frustum Culling
        if (screen.x < -120 || screen.x > w + 120 || screen.y < -120 || screen.y > h + 120) {
          continue;
        }

        // In dungeon, solid perimeter walls (7) are 3D walls rendered in Pass 2
        if (isDungeon && tileType === 7) {
          wallTiles.push({ x, y });
          continue;
        }

        groundTiles.push({
          x,
          y,
          tileType,
          depth: (x + y)
        });
      }
    }

    // Sort ground tiles back-to-front by isometric order
    groundTiles.sort((a, b) => a.depth - b.depth);

    ctx.save();
    for (const tile of groundTiles) {
      this.drawIsometricTile(ctx, tile.x, tile.y, tile.tileType);
    }
    ctx.restore();

    // PASS 2: ENTITIES, PROPS & 3D DUNGEON WALLS (Depth Sorted with Painter's Algorithm)
    const renderList = [];

    // 0. 3D Dungeon Stone Walls
    for (const wall of wallTiles) {
      const isFloor = (tx, ty) => {
        if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) return false;
        const t = map.tiles[ty][tx];
        return t === 4 || t === 1 || t === 6;
      };
      const hasFloorSouth = isFloor(wall.x, wall.y + 1);
      const hasFloorEast = isFloor(wall.x + 1, wall.y);
      const hasFloorSouthEast = isFloor(wall.x + 1, wall.y + 1);
      const isBackWall = hasFloorSouth || hasFloorEast || hasFloorSouthEast;

      renderList.push({
        type: 'dungeon_wall',
        x: wall.x,
        y: wall.y,
        isBackWall,
        depth: Isometric.getDepth(wall.x, wall.y, 0, isBackWall ? 5 : 48)
      });
    }

    // 1. Obstacles / Props
    if (map.obstacles) {
      for (const obs of map.obstacles) {
        renderList.push({
          type: 'obstacle',
          data: obs,
          depth: Isometric.getDepth(obs.x, obs.y, 0, 10)
        });
      }
    }

    // 2. Ground Items
    if (gameState.groundItems) {
      for (const item of gameState.groundItems) {
        renderList.push({
          type: 'ground_item',
          data: item,
          depth: Isometric.getDepth(item.x, item.y, 0, 20)
        });
      }
    }

    // 3. Dungeon Chests
    if (gameState.chests) {
      for (const chest of gameState.chests) {
        renderList.push({
          type: 'chest',
          data: chest,
          depth: Isometric.getDepth(chest.x, chest.y, 0, 15)
        });
      }
    }

    // 4. Mobs
    if (gameState.mobs) {
      for (const mob of gameState.mobs) {
        if (mob.state === 'dead') continue;
        renderList.push({
          type: 'mob',
          data: mob,
          depth: Isometric.getDepth(mob.x, mob.y, 0, 50)
        });
      }
    }

    // 5. Players
    if (gameState.players) {
      for (const player of gameState.players) {
        if (player.isDead) continue;
        renderList.push({
          type: 'player',
          data: player,
          isLocal: player.id === localPlayerId,
          depth: Isometric.getDepth(player.x, player.y, 0, 60)
        });
      }
    }

    // Sort render list from back to front
    renderList.sort((a, b) => a.depth - b.depth);

    // DRAW ALL DEPTH SORTED OBJECTS
    ctx.save();
    for (const item of renderList) {
      switch (item.type) {
        case 'dungeon_wall':
          this.drawDungeonWall(ctx, item.x, item.y, map, item.isBackWall);
          break;
        case 'obstacle':
          this.drawObstacle(ctx, item.data);
          break;
        case 'chest':
          this.drawChest(ctx, item.data);
          break;
        case 'ground_item':
          this.drawGroundItem(ctx, item.data);
          break;
        case 'mob':
          this.drawMob(ctx, item.data, item.data.id === selectedTargetId);
          break;
        case 'player':
          this.drawPlayer(ctx, item.data, item.isLocal);
          break;
      }
    }
    ctx.restore();

    // DRAW OVERLAYS & EFFECTS (Click Beacon, Particles, Floating Text)
    this.drawEffects(ctx, dt);

    // DRAW FULLSCREEN STATUS VIGNETTES (Poison, Chill, Burn)
    if (gameState.players) {
      const localP = gameState.players.find(p => p.id === localPlayerId);
      if (localP && localP.statusEffects && localP.statusEffects.length > 0) {
        this.drawStatusVignettes(ctx, localP.statusEffects);
      }
    }

    // RENDER MINIMAP
    this.renderMinimap(gameState, localPlayerId);
  }

  // Draw Screen Vignettes for Player Status Effects
  drawStatusVignettes(ctx, statusEffects) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const pulse = Math.sin(this.animations.time * 4) * 0.15 + 0.85;

    for (const fx of statusEffects) {
      ctx.save();
      const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      if (fx.type === 'poison') {
        grad.addColorStop(0, 'rgba(34, 197, 94, 0)');
        grad.addColorStop(1, `rgba(34, 197, 94, ${0.35 * pulse})`);
      } else if (fx.type === 'chill') {
        grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
        grad.addColorStop(1, `rgba(56, 189, 248, ${0.4 * pulse})`);
      } else if (fx.type === 'burn') {
        grad.addColorStop(0, 'rgba(249, 115, 22, 0)');
        grad.addColorStop(1, `rgba(249, 115, 22, ${0.38 * pulse})`);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  // Draw 3D Isometric Tile Block with Side Edges & Textures
  drawIsometricTile(ctx, x, y, tileType) {
    const screen = Isometric.worldToScreen(x, y, 0, this.camera, this.canvas.width, this.canvas.height);
    const hw = (TILE_WIDTH / 2) * this.camera.zoom;
    const hh = (TILE_HEIGHT / 2) * this.camera.zoom;
    const depth = TILE_DEPTH * this.camera.zoom;

    // Colors per tile type
    let topColor = '#38761d';
    let leftSideColor = '#274e13';
    let rightSideColor = '#1e3c0f';

    switch (tileType) {
      case 0: // Grass
        const grassSeed = (x * 13 + y * 29) % 3;
        topColor = grassSeed === 0 ? '#438a22' : grassSeed === 1 ? '#3c7e1e' : '#4d9c28';
        leftSideColor = '#5c4033';
        rightSideColor = '#463127';
        break;
      case 1: // Cobblestone / Dungeon Corridor
        topColor = '#3f4756';
        leftSideColor = '#2a313d';
        rightSideColor = '#1e242e';
        break;
      case 2: // Dirt
        topColor = '#85583f';
        leftSideColor = '#6a432e';
        rightSideColor = '#503222';
        break;
      case 3: // Water
        const wave = Math.sin(this.animations.time * 2 + x * 0.5 + y * 0.5) * 15;
        topColor = `rgb(14, ${116 + Math.round(wave)}, 144)`;
        leftSideColor = '#0e7490';
        rightSideColor = '#155e75';
        break;
      case 4: // Dungeon Room Flagstone
        const stoneSeed = (x * 17 + y * 31) % 4;
        topColor = stoneSeed === 0 ? '#272f3d' : stoneSeed === 1 ? '#222935' : stoneSeed === 2 ? '#2c3545' : '#1f2530';
        leftSideColor = '#191f28';
        rightSideColor = '#12161d';
        break;
      case 5: // Wood Bridge
        topColor = '#a16207';
        leftSideColor = '#854d0e';
        rightSideColor = '#713f12';
        break;
      case 6: // Portal / Arcane Ring
        topColor = '#4a2574';
        leftSideColor = '#361856';
        rightSideColor = '#26103d';
        break;
      case 7: // Perimeter Wall (Fallback flat ground)
        topColor = '#212631';
        leftSideColor = '#161922';
        rightSideColor = '#0e1117';
        break;
      case 9: // Snow (Frostfell Peaks)
        const snowSeed = (x * 19 + y * 23) % 3;
        topColor = snowSeed === 0 ? '#f1f5f9' : snowSeed === 1 ? '#e2e8f0' : '#f8fafc';
        leftSideColor = '#94a3b8';
        rightSideColor = '#64748b';
        break;
      case 10: // Glacial Ice (Frozen Lake)
        const iceReflect = Math.sin(this.animations.time * 2 + x + y) * 12;
        topColor = `rgb(56, ${189 + Math.round(iceReflect)}, 248)`;
        leftSideColor = '#0284c7';
        rightSideColor = '#0369a1';
        break;
      case 11: // Frost Stone Path & Ancient Ruins
        const fStone = (x * 13 + y * 17) % 3;
        topColor = fStone === 0 ? '#334155' : fStone === 1 ? '#2d3748' : '#3e4c5e';
        leftSideColor = '#1e293b';
        rightSideColor = '#0f172a';
        break;
      case 12: // Frost Mountain Cliff Crag
        topColor = '#475569';
        leftSideColor = '#334155';
        rightSideColor = '#1e293b';
        break;
    }

    // 1. Draw 3D Left Depth Face
    ctx.beginPath();
    ctx.moveTo(screen.x - hw, screen.y);
    ctx.lineTo(screen.x, screen.y + hh);
    ctx.lineTo(screen.x, screen.y + hh + depth);
    ctx.lineTo(screen.x - hw, screen.y + depth);
    ctx.closePath();
    ctx.fillStyle = leftSideColor;
    ctx.fill();

    // 2. Draw 3D Right Depth Face
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y + hh);
    ctx.lineTo(screen.x + hw, screen.y);
    ctx.lineTo(screen.x + hw, screen.y + depth);
    ctx.lineTo(screen.x, screen.y + hh + depth);
    ctx.closePath();
    ctx.fillStyle = rightSideColor;
    ctx.fill();

    // 3. Draw Isometric Diamond Top Face
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - hh);
    ctx.lineTo(screen.x + hw, screen.y);
    ctx.lineTo(screen.x, screen.y + hh);
    ctx.lineTo(screen.x - hw, screen.y);
    ctx.closePath();
    ctx.fillStyle = topColor;
    ctx.fill();

    // Thin grid outline for crisp isometric definition
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Details for specific tiles
    if (tileType === 3) {
      // Water Shimmer Highlights
      ctx.beginPath();
      const waveShift = Math.sin(this.animations.time * 3 + x + y) * (hw * 0.3);
      ctx.moveTo(screen.x - hw * 0.3 + waveShift, screen.y);
      ctx.lineTo(screen.x + hw * 0.3 + waveShift, screen.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (tileType === 4) {
      // Dungeon Flagstone subtle mortar seams
      ctx.beginPath();
      ctx.moveTo(screen.x - hw * 0.35, screen.y - hh * 0.15);
      ctx.lineTo(screen.x + hw * 0.25, screen.y + hh * 0.25);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (tileType === 6) {
      // Portal Zone Pulsing Arcane Runic Ring
      const pulse = Math.sin(this.animations.time * 4) * 0.1 + 0.9;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, hw * 0.5 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(screen.x, screen.y, hw * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.35)';
      ctx.fill();
    } else if (tileType === 10) {
      // Glacial Ice Surface Glaze & Fracture Lines
      ctx.beginPath();
      ctx.moveTo(screen.x - hw * 0.4, screen.y - hh * 0.2);
      ctx.lineTo(screen.x + hw * 0.1, screen.y + hh * 0.1);
      ctx.lineTo(screen.x + hw * 0.35, screen.y - hh * 0.1);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else if (tileType === 11) {
      // Ancient Nordic Frost Rune Glow
      const runePulse = Math.sin(this.animations.time * 3 + x + y) * 0.2 + 0.8;
      ctx.strokeStyle = `rgba(103, 232, 249, ${0.45 * runePulse})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, hw * 0.28, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Draw 3D Masonry Dungeon Wall
  drawDungeonWall(ctx, x, y, map, isBackWall) {
    const screen = Isometric.worldToScreen(x, y, 0, this.camera, this.canvas.width, this.canvas.height);
    const z = this.camera.zoom;
    const hw = (TILE_WIDTH / 2) * z;
    const hh = (TILE_HEIGHT / 2) * z;

    // Back walls are tall (behind player/monsters, depth sorted at depth: 5)
    // Front walls are low cutaway curbs (so camera view is never obstructed)
    const wallH = (isBackWall ? 40 : 12) * z;

    // 1. LEFT FACE (South-West facing)
    ctx.beginPath();
    ctx.moveTo(screen.x - hw, screen.y);
    ctx.lineTo(screen.x, screen.y + hh);
    ctx.lineTo(screen.x, screen.y + hh - wallH);
    ctx.lineTo(screen.x - hw, screen.y - wallH);
    ctx.closePath();
    ctx.fillStyle = isBackWall ? '#262f3d' : '#1e2430';
    ctx.fill();

    // Left face stone brick mortar lines (for tall back walls)
    if (isBackWall && wallH > 18) {
      ctx.strokeStyle = 'rgba(15, 20, 28, 0.6)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        const hOffset = (wallH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(screen.x - hw, screen.y - hOffset);
        ctx.lineTo(screen.x, screen.y + hh - hOffset);
        ctx.stroke();
      }
    }

    // 2. RIGHT FACE (South-East facing - in natural shadow)
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y + hh);
    ctx.lineTo(screen.x + hw, screen.y);
    ctx.lineTo(screen.x + hw, screen.y - wallH);
    ctx.lineTo(screen.x, screen.y + hh - wallH);
    ctx.closePath();
    ctx.fillStyle = isBackWall ? '#1a202c' : '#141821';
    ctx.fill();

    // Right face stone brick mortar lines (for tall back walls)
    if (isBackWall && wallH > 18) {
      ctx.strokeStyle = 'rgba(10, 14, 20, 0.7)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        const hOffset = (wallH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y + hh - hOffset);
        ctx.lineTo(screen.x + hw, screen.y - hOffset);
        ctx.stroke();
      }
    }

    // 3. TOP CAP DIAMOND (Beveled Stone Slabs)
    const topY = screen.y - wallH;
    ctx.beginPath();
    ctx.moveTo(screen.x, topY - hh);
    ctx.lineTo(screen.x + hw, topY);
    ctx.lineTo(screen.x, topY + hh);
    ctx.lineTo(screen.x - hw, topY);
    ctx.closePath();
    ctx.fillStyle = isBackWall ? '#3b4557' : '#2b3442';
    ctx.fill();

    // Stone Cap Highlight Border
    ctx.strokeStyle = isBackWall ? 'rgba(99, 115, 145, 0.5)' : 'rgba(60, 75, 95, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Subtle edge highlight on top front rim
    ctx.beginPath();
    ctx.moveTo(screen.x - hw, topY);
    ctx.lineTo(screen.x, topY + hh);
    ctx.lineTo(screen.x + hw, topY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Draw Props & Obstacles
  drawObstacle(ctx, obs) {
    const screen = Isometric.worldToScreen(obs.x, obs.y, 0, this.camera, this.canvas.width, this.canvas.height);
    const z = this.camera.zoom;

    if (obs.type === 'oak_tree' || obs.type === 'pine_tree') {
      // Shadow
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 18 * z, 10 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fill();

      // Tree Trunk
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(screen.x - 4 * z, screen.y - 24 * z, 8 * z, 24 * z);

      if (obs.type === 'oak_tree') {
        // Lush Oak Canopy
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - 36 * z, 22 * z, 0, Math.PI * 2);
        ctx.fillStyle = '#2d5a1e';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(screen.x - 8 * z, screen.y - 42 * z, 16 * z, 0, Math.PI * 2);
        ctx.fillStyle = '#3c7e1e';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(screen.x + 8 * z, screen.y - 38 * z, 14 * z, 0, Math.PI * 2);
        ctx.fillStyle = '#4d9c28';
        ctx.fill();
      } else {
        // Conical Pine Tree
        const layers = [
          { y: -20 * z, w: 26 * z, h: 18 * z, color: '#143818' },
          { y: -34 * z, w: 20 * z, h: 16 * z, color: '#1b4d21' },
          { y: -46 * z, w: 14 * z, h: 14 * z, color: '#27692f' }
        ];
        layers.forEach(l => {
          ctx.beginPath();
          ctx.moveTo(screen.x, screen.y + l.y - l.h);
          ctx.lineTo(screen.x + l.w / 2, screen.y + l.y);
          ctx.lineTo(screen.x - l.w / 2, screen.y + l.y);
          ctx.closePath();
          ctx.fillStyle = l.color;
          ctx.fill();
        });
      }
    } else if (obs.type === 'stone_pillar') {
      // Ruin Stone Pillar
      ctx.fillStyle = '#64748b';
      ctx.fillRect(screen.x - 8 * z, screen.y - 38 * z, 16 * z, 38 * z);
      ctx.fillStyle = '#475569';
      ctx.fillRect(screen.x, screen.y - 38 * z, 8 * z, 38 * z);

      // Capital topper
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(screen.x - 11 * z, screen.y - 43 * z, 22 * z, 6 * z);
    } else if (obs.type === 'fountain') {
      // Town Fountain
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 32 * z, 18 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#475569';
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3 * z;
      ctx.stroke();

      // Fountain Water
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 24 * z, 13 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#06b6d4';
      ctx.fill();

      // Center Spire & Spray
      ctx.fillStyle = '#64748b';
      ctx.fillRect(screen.x - 4 * z, screen.y - 20 * z, 8 * z, 20 * z);

      // Water Particles
      const spray = Math.sin(this.animations.time * 6) * 4 * z;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 22 * z + spray, 4 * z, 0, Math.PI * 2);
      ctx.fillStyle = '#e0f2fe';
      ctx.fill();
    } else if (obs.type === 'torch') {
      // Wooden Torch Post
      ctx.fillStyle = '#78350f';
      ctx.fillRect(screen.x - 2 * z, screen.y - 24 * z, 4 * z, 24 * z);

      // Warm Fire Light Aura
      const flameFlicker = Math.sin(this.animations.time * 12) * 2 * z;
      const glowGrad = ctx.createRadialGradient(screen.x, screen.y - 26 * z, 2 * z, screen.x, screen.y - 26 * z, 28 * z);
      glowGrad.addColorStop(0, 'rgba(245, 158, 11, 0.45)');
      glowGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 26 * z, 28 * z, 0, Math.PI * 2);
      ctx.fill();

      // Flame
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 26 * z + flameFlicker, 4 * z, 0, Math.PI * 2);
      ctx.fillStyle = '#f97316';
      ctx.fill();
    } else if (obs.type === 'merchant') {
      // Merchant Olaf's Shop Stall
      // Wooden Counter Table
      ctx.fillStyle = '#78350f';
      ctx.fillRect(screen.x - 16 * z, screen.y - 12 * z, 32 * z, 12 * z);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(screen.x - 18 * z, screen.y - 14 * z, 36 * z, 4 * z);

      // Striped Awning Canopy
      const awningColors = ['#ef4444', '#f8fafc', '#ef4444', '#f8fafc', '#ef4444'];
      const segmentW = (38 * z) / awningColors.length;
      awningColors.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(screen.x - 19 * z + (i * segmentW), screen.y - 36 * z, segmentW, 10 * z);
      });
      // Canopy Frame Posts
      ctx.fillStyle = '#451a03';
      ctx.fillRect(screen.x - 18 * z, screen.y - 36 * z, 3 * z, 24 * z);
      ctx.fillRect(screen.x + 15 * z, screen.y - 36 * z, 3 * z, 24 * z);

      // Merchant Olaf NPC
      ctx.fillStyle = '#0284c7'; // Blue merchant robe
      ctx.fillRect(screen.x - 6 * z, screen.y - 24 * z, 12 * z, 12 * z);
      // Head
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 28 * z, 6 * z, 0, Math.PI * 2);
      ctx.fill();
      // Merchant Green Hat with Gold Feather
      ctx.fillStyle = '#15803d';
      ctx.fillRect(screen.x - 8 * z, screen.y - 32 * z, 16 * z, 4 * z);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(screen.x + 4 * z, screen.y - 34 * z, 3 * z, 0, Math.PI * 2);
      ctx.fill();

      // Merchant Overhead Name Tag
      ctx.save();
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText('🏪 Olaf the Trader [Shop]', screen.x + 1, screen.y - 44 * z + 1);
      ctx.fillStyle = '#fde68a';
      ctx.fillText('🏪 Olaf the Trader [Shop]', screen.x, screen.y - 44 * z);
      ctx.restore();
    } else if (obs.type === 'portal') {
      // Swirling Arcane Dungeon Portal
      const rot = this.animations.time * 2.5;

      // Base Pedestal
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 24 * z, 12 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2 * z;
      ctx.stroke();

      // Swirling Vortex Layers
      ctx.save();
      ctx.translate(screen.x, screen.y - 14 * z);

      // Radial Pulsing Glow
      const portalGlow = ctx.createRadialGradient(0, 0, 4 * z, 0, 0, 26 * z);
      portalGlow.addColorStop(0, 'rgba(6, 182, 212, 0.8)');
      portalGlow.addColorStop(0.5, 'rgba(168, 85, 247, 0.5)');
      portalGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = portalGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 26 * z, 0, Math.PI * 2);
      ctx.fill();

      // Rotating Rune Rings
      ctx.rotate(rot);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2 * z;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18 * z, 8 * z, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.rotate(-rot * 2);
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1.5 * z;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12 * z, 5 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Portal Overhead Tag
      ctx.save();
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText('🌀 Dungeon Portal', screen.x + 1, screen.y - 42 * z + 1);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('🌀 Dungeon Portal', screen.x, screen.y - 42 * z);
      ctx.restore();
    } else if (obs.type === 'blacksmith') {
      // NPC Brom the Master Smith (Reforge / Item Enhancement)
      // Ground Shadow
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 14 * z, 8 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fill();

      // Strong Legs / Boots
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(screen.x - 7 * z, screen.y - 10 * z, 5 * z, 10 * z);
      ctx.fillRect(screen.x + 2 * z, screen.y - 10 * z, 5 * z, 10 * z);

      // Muscular Torso & Leather Blacksmith Apron
      ctx.fillStyle = '#78350f'; // Heavy Leather Apron
      ctx.fillRect(screen.x - 9 * z, screen.y - 25 * z, 18 * z, 16 * z);
      ctx.fillStyle = '#451a03'; // Dark apron hem
      ctx.fillRect(screen.x - 8 * z, screen.y - 12 * z, 16 * z, 4 * z);

      // Cross Straps with Brass Rivets
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2 * z;
      ctx.beginPath();
      ctx.moveTo(screen.x - 7 * z, screen.y - 25 * z);
      ctx.lineTo(screen.x + 7 * z, screen.y - 15 * z);
      ctx.moveTo(screen.x + 7 * z, screen.y - 25 * z);
      ctx.lineTo(screen.x - 7 * z, screen.y - 15 * z);
      ctx.stroke();

      // Head & Facial Hair
      ctx.fillStyle = '#fed7aa'; // Skin
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 30 * z, 6.5 * z, 0, Math.PI * 2);
      ctx.fill();

      // Thick Blacksmith Beard
      ctx.fillStyle = '#7c2d12'; // Russet Auburn Beard
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 28 * z, 6 * z, 0, Math.PI);
      ctx.fill();

      // Red Smith Headband
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(screen.x - 7 * z, screen.y - 35 * z, 14 * z, 3.5 * z);

      // Blacksmith Right Arm holding Heavy Sledgehammer
      const hammerSwing = Math.sin(this.animations.time * 4) * 0.15;
      ctx.save();
      ctx.translate(screen.x + 10 * z, screen.y - 22 * z);
      ctx.rotate(hammerSwing);

      // Wooden Handle
      ctx.fillStyle = '#a16207';
      ctx.fillRect(-2 * z, -16 * z, 4 * z, 20 * z);

      // Heavy Steel Hammer Head
      ctx.fillStyle = '#475569';
      ctx.fillRect(-6 * z, -22 * z, 12 * z, 7 * z);
      ctx.fillStyle = '#94a3b8'; // Highlight on hammer top
      ctx.fillRect(-6 * z, -22 * z, 12 * z, 2 * z);
      ctx.restore();

      // Overhead Name Tag & Interaction Prompt
      ctx.save();
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText('🔨 Brom the Master Smith [Reforge]', screen.x + 1, screen.y - 44 * z + 1);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('🔨 Brom the Master Smith [Reforge]', screen.x, screen.y - 44 * z);
      ctx.restore();
    } else if (obs.type === 'anvil') {
      // Burning Forge & Heavy Steel Anvil
      // Stone Hearth / Forge Firebox (behind anvil)
      ctx.fillStyle = '#334155';
      ctx.fillRect(screen.x - 14 * z, screen.y - 18 * z, 28 * z, 18 * z);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(screen.x - 12 * z, screen.y - 16 * z, 24 * z, 14 * z);

      // Fiery Embers Glow in Hearth
      const firePulse = Math.sin(this.animations.time * 8) * 0.2 + 0.8;
      const emberGlow = ctx.createRadialGradient(screen.x, screen.y - 10 * z, 2 * z, screen.x, screen.y - 10 * z, 18 * z);
      emberGlow.addColorStop(0, `rgba(251, 146, 60, ${0.85 * firePulse})`);
      emberGlow.addColorStop(0.5, `rgba(239, 68, 68, ${0.5 * firePulse})`);
      emberGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = emberGlow;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 10 * z, 18 * z, 0, Math.PI * 2);
      ctx.fill();

      // Steel Anvil Base & Horn
      ctx.fillStyle = '#1e293b'; // Anvil Base
      ctx.fillRect(screen.x - 8 * z, screen.y - 6 * z, 16 * z, 6 * z);

      // Anvil Waist & Horn
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(screen.x - 10 * z, screen.y - 12 * z);
      ctx.lineTo(screen.x + 12 * z, screen.y - 12 * z); // horn extension
      ctx.lineTo(screen.x + 7 * z, screen.y - 7 * z);
      ctx.lineTo(screen.x - 6 * z, screen.y - 7 * z);
      ctx.closePath();
      ctx.fill();

      // Top Striking Face (Beveled Steel Surface)
      ctx.fillStyle = '#64748b';
      ctx.fillRect(screen.x - 8 * z, screen.y - 14 * z, 14 * z, 3 * z);

      // Glowing Hot Ingot on Anvil Face
      const ingotGlow = Math.sin(this.animations.time * 10) * 0.15 + 0.85;
      ctx.fillStyle = `rgba(254, 215, 170, ${ingotGlow})`;
      ctx.fillRect(screen.x - 4 * z, screen.y - 16 * z, 8 * z, 2.5 * z);
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1;
      ctx.strokeRect(screen.x - 4 * z, screen.y - 16 * z, 8 * z, 2.5 * z);

      // Periodic Tiny Flying Sparks from Anvil
      if (Math.sin(this.animations.time * 12) > 0.6) {
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(screen.x + (Math.sin(this.animations.time * 30) * 8 * z), screen.y - (18 + Math.random() * 8) * z, 2 * z, 2 * z);
      }
    } else if (obs.type === 'snow_pine') {
      // Pine tree heavily dusted with winter snow
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 18 * z, 9 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();

      // Trunk
      ctx.fillStyle = '#452e23';
      ctx.fillRect(screen.x - 3.5 * z, screen.y - 20 * z, 7 * z, 20 * z);

      // Conical Snow Pine Layers
      const layers = [
        { y: -16 * z, w: 28 * z, h: 16 * z, color: '#133e24', snowColor: '#f1f5f9' },
        { y: -28 * z, w: 22 * z, h: 14 * z, color: '#1a4e2e', snowColor: '#f8fafc' },
        { y: -39 * z, w: 15 * z, h: 12 * z, color: '#23653d', snowColor: '#ffffff' }
      ];
      layers.forEach(l => {
        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y + l.y - l.h);
        ctx.lineTo(screen.x + l.w / 2, screen.y + l.y);
        ctx.lineTo(screen.x - l.w / 2, screen.y + l.y);
        ctx.closePath();
        ctx.fillStyle = l.color;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(screen.x - l.w / 2, screen.y + l.y);
        ctx.lineTo(screen.x, screen.y + l.y - 4 * z);
        ctx.lineTo(screen.x + l.w / 2, screen.y + l.y);
        ctx.lineTo(screen.x + l.w / 2 - 3 * z, screen.y + l.y + 3 * z);
        ctx.lineTo(screen.x - l.w / 2 + 3 * z, screen.y + l.y + 3 * z);
        ctx.closePath();
        ctx.fillStyle = l.snowColor;
        ctx.fill();
      });
    } else if (obs.type === 'ice_crystal') {
      // Glacial Ice Crystal Shard Cluster
      const crystalGlow = ctx.createRadialGradient(screen.x, screen.y - 18 * z, 2 * z, screen.x, screen.y - 18 * z, 24 * z);
      crystalGlow.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      crystalGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = crystalGlow;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 18 * z, 24 * z, 0, Math.PI * 2);
      ctx.fill();

      // Center Spire
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y - 36 * z);
      ctx.lineTo(screen.x + 8 * z, screen.y - 6 * z);
      ctx.lineTo(screen.x, screen.y);
      ctx.lineTo(screen.x - 8 * z, screen.y - 6 * z);
      ctx.closePath();
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();

      // Left shard
      ctx.beginPath();
      ctx.moveTo(screen.x - 6 * z, screen.y - 24 * z);
      ctx.lineTo(screen.x - 14 * z, screen.y - 4 * z);
      ctx.lineTo(screen.x - 4 * z, screen.y);
      ctx.closePath();
      ctx.fillStyle = '#0284c7';
      ctx.fill();

      // Right shard
      ctx.beginPath();
      ctx.moveTo(screen.x + 6 * z, screen.y - 22 * z);
      ctx.lineTo(screen.x + 4 * z, screen.y);
      ctx.lineTo(screen.x + 13 * z, screen.y - 5 * z);
      ctx.closePath();
      ctx.fillStyle = '#0284c7';
      ctx.fill();
    } else if (obs.type === 'frost_monolith') {
      // Ancient Glacial Monolith / Obelisk
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(screen.x - 10 * z, screen.y);
      ctx.lineTo(screen.x + 10 * z, screen.y);
      ctx.lineTo(screen.x + 6 * z, screen.y - 44 * z);
      ctx.lineTo(screen.x, screen.y - 52 * z);
      ctx.lineTo(screen.x - 6 * z, screen.y - 44 * z);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();

      // Glowing Rune Inscriptions
      const runeFlicker = Math.sin(this.animations.time * 4 + obs.y) * 0.25 + 0.75;
      ctx.strokeStyle = `rgba(103, 232, 249, ${runeFlicker})`;
      ctx.lineWidth = 1.8 * z;
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y - 38 * z);
      ctx.lineTo(screen.x, screen.y - 12 * z);
      ctx.moveTo(screen.x - 4 * z, screen.y - 30 * z);
      ctx.lineTo(screen.x + 4 * z, screen.y - 24 * z);
      ctx.moveTo(screen.x - 4 * z, screen.y - 18 * z);
      ctx.lineTo(screen.x + 4 * z, screen.y - 22 * z);
      ctx.stroke();
    } else if (obs.type === 'frost_portal') {
      // Gateway from Town to Frostfell Peaks
      const rot = this.animations.time * 2.0;

      // Base Pedestal
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 24 * z, 12 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2 * z;
      ctx.stroke();

      // Swirling Blizzard Vortex
      ctx.save();
      ctx.translate(screen.x, screen.y - 14 * z);

      const frostGlow = ctx.createRadialGradient(0, 0, 4 * z, 0, 0, 28 * z);
      frostGlow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      frostGlow.addColorStop(0.4, 'rgba(56, 189, 248, 0.7)');
      frostGlow.addColorStop(0.8, 'rgba(2, 132, 199, 0.4)');
      frostGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = frostGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 28 * z, 0, Math.PI * 2);
      ctx.fill();

      // Rotating Ice Rings
      ctx.rotate(rot);
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 2 * z;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18 * z, 8 * z, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.rotate(-rot * 2.2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5 * z;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12 * z, 5 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Portal Tag
      ctx.save();
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText('❄️ Frostfell Portal [Lv. 6+]', screen.x + 1, screen.y - 42 * z + 1);
      ctx.fillStyle = '#67e8f9';
      ctx.fillText('❄️ Frostfell Portal [Lv. 6+]', screen.x, screen.y - 42 * z);
      ctx.restore();
    } else if (obs.type === 'town_portal') {
      // Gateway from Frostfell returning to Town
      const rot = this.animations.time * 2.2;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 24 * z, 12 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2 * z;
      ctx.stroke();

      ctx.save();
      ctx.translate(screen.x, screen.y - 14 * z);

      const townGlow = ctx.createRadialGradient(0, 0, 4 * z, 0, 0, 28 * z);
      townGlow.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
      townGlow.addColorStop(0.5, 'rgba(245, 158, 11, 0.6)');
      townGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = townGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 28 * z, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(rot);
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 2 * z;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18 * z, 8 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText('🏰 Return to Town', screen.x + 1, screen.y - 42 * z + 1);
      ctx.fillStyle = '#facc15';
      ctx.fillText('🏰 Return to Town', screen.x, screen.y - 42 * z);
      ctx.restore();
    }
  }

  // Draw Procedural Treasure Chests
  drawChest(ctx, chest) {
    const screen = Isometric.worldToScreen(chest.x, chest.y, 0, this.camera, this.canvas.width, this.canvas.height);
    const z = this.camera.zoom;
    const isGold = chest.isGold;

    // Shadow
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, 14 * z, 7 * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    ctx.save();
    ctx.translate(screen.x, screen.y);

    if (chest.opened) {
      // Opened Chest with Light Rays
      ctx.fillStyle = isGold ? '#b45309' : '#5c4033';
      ctx.fillRect(-10 * z, -10 * z, 20 * z, 10 * z);

      // Open Lid tilted
      ctx.fillStyle = isGold ? '#d97706' : '#78350f';
      ctx.fillRect(-11 * z, -20 * z, 22 * z, 6 * z);

      // Golden Treasure Light Beam
      const lightGrad = ctx.createLinearGradient(0, -10 * z, 0, -35 * z);
      lightGrad.addColorStop(0, 'rgba(250, 204, 21, 0.8)');
      lightGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.moveTo(-8 * z, -10 * z);
      ctx.lineTo(8 * z, -10 * z);
      ctx.lineTo(14 * z, -35 * z);
      ctx.lineTo(-14 * z, -35 * z);
      ctx.closePath();
      ctx.fill();
    } else {
      // Closed Chest
      ctx.fillStyle = isGold ? '#f59e0b' : '#78350f';
      ctx.fillRect(-10 * z, -14 * z, 20 * z, 14 * z);

      // Metal Bands / Straps
      ctx.fillStyle = isGold ? '#fde68a' : '#94a3b8';
      ctx.fillRect(-8 * z, -14 * z, 3 * z, 14 * z);
      ctx.fillRect(5 * z, -14 * z, 3 * z, 14 * z);

      // Chest Lid
      ctx.fillStyle = isGold ? '#fbbf24' : '#92400e';
      ctx.beginPath();
      ctx.arc(0, -14 * z, 10 * z, Math.PI, 0);
      ctx.fill();

      // Brass Lock
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, -9 * z, 2.5 * z, 0, Math.PI * 2);
      ctx.fill();

      // Floating Tooltip
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText('🗝️ Click to Open', 0, -24 * z);
    }

    ctx.restore();
  }

  // Draw Ground Items (Gold, Potions, Relics)
  drawGroundItem(ctx, item) {
    const screen = Isometric.worldToScreen(item.x, item.y, 0, this.camera, this.canvas.width, this.canvas.height);
    const z = this.camera.zoom;
    const bounce = Math.sin(this.animations.time * 4 + item.x) * 3 * z;

    // Shadow
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, 10 * z, 5 * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();

    // Item Icon
    ctx.save();
    ctx.font = `${Math.round(18 * z)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let icon = '🪙';
    if (item.type === 'health_potion') icon = '🧪';
    if (item.type === 'mana_potion') icon = '🔮';

    ctx.fillText(icon, screen.x, screen.y - 12 * z + bounce);

    // Glowing Halo
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - 12 * z + bounce, 12 * z, 0, Math.PI * 2);
    ctx.strokeStyle = item.type === 'gold' ? 'rgba(250, 204, 21, 0.6)' :
                      item.type === 'health_potion' ? 'rgba(239, 68, 68, 0.6)' : 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  // Draw Player Character with Realistic 8-Directional Humanoid Anatomy, Facial Features, Hair, Clothes & Physics
  drawPlayer(ctx, player, isLocal) {
    const screen = Isometric.worldToScreen(player.x, player.y, 0, this.camera, this.canvas.width, this.canvas.height);
    const z = this.camera.zoom;
    const t = this.animations.time;

    // Humanoid Biomechanical Parameters
    const isMoving = !!player.isMoving;
    const idleBreath = Math.sin(t * 3.2) * 1.2 * z;
    const walkCycle = isMoving ? (t * 13) : 0;
    const walkBob = isMoving ? Math.abs(Math.sin(walkCycle)) * 3.5 * z : idleBreath;

    // Leg Stride Angles (Natural pendulum stride)
    const legL_Angle = isMoving ? Math.sin(walkCycle) * 0.45 : 0;
    const legR_Angle = isMoving ? -Math.sin(walkCycle) * 0.45 : 0;
    const armL_Angle = isMoving ? -Math.sin(walkCycle) * 0.35 : (Math.sin(t * 2.8) * 0.08);
    const armR_Angle = isMoving ? Math.sin(walkCycle) * 0.35 : (-Math.sin(t * 2.8) * 0.08);

    // 8-Directional Orientation (Lock to attack direction during combat swings)
    const attack = this.attacks ? this.attacks.get(player.id) : null;
    const isAttacking = attack && (performance.now() - attack.time < attack.duration);
    const facing = (isAttacking && attack.facing) ? attack.facing : (player.facing || 'S');
    const isBackView = facing === 'N' || facing === 'NE' || facing === 'NW';
    const isFrontView = facing === 'S' || facing === 'SE' || facing === 'SW';
    const isDirectNorth = facing === 'N';
    const isDirectSouth = facing === 'S';
    const isDirectSide = facing === 'E' || facing === 'W';
    const isFacingLeft = facing === 'W' || facing === 'NW' || facing === 'SW';

    // Drop Shadow on Ground
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, (13 + (isMoving ? 1 : 0)) * z, 6.5 * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.fill();

    // Local Player Selection Ring
    if (isLocal) {
      const ringPulse = Math.sin(t * 4) * 1.5 * z;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 18 * z + ringPulse, 9 * z + ringPulse * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    // When 3D Hero Models are enabled, Three.js WebGL layer renders the 3D rigged character!
    if (window.threeHeroRenderer && window.threeHeroRenderer.enabled) {
      // Nametag, Guild Badge & Mini HP Bar
      this.drawEntityOverhead(ctx, screen.x, screen.y - 50 * z, player.name, player.hp, player.maxHp, isLocal ? '#38bdf8' : '#fff', `Lv.${player.level}`);

      // Speech Bubble
      if (player.speechBubble) {
        this.drawSpeechBubble(ctx, screen.x, screen.y - 74 * z, player.speechBubble);
      }
      return;
    }

    // Authentic 8-Directional Pixel Art Swordman (Warrior) with Full 360-degree rotation
    if (player.characterClass === 'warrior') {
      this.drawSwordman(ctx, player, isLocal, screen, z, t);
      return;
    }

    // Authentic Pixel Art Archmage (Mage) with Levitation, Arcane Burst, Blink & Staff Run
    if (player.characterClass === 'mage') {
      this.drawMage(ctx, player, isLocal, screen, z, t);
      return;
    }

    // Authentic Pixel Art Rogue (Rogue) with Dagger Flip, Cross Slash, Shadow Dive & Ninja Sprint
    if (player.characterClass === 'rogue') {
      this.drawRogue(ctx, player, isLocal, screen, z, t);
      return;
    }

    ctx.save();
    // Anchor at player center-ground
    ctx.translate(screen.x, screen.y - 14 * z - walkBob);
    if (isFacingLeft) ctx.scale(-1, 1);

    // Attack state
    const attackProg = isAttacking ? (performance.now() - attack.time) / attack.duration : 0;
    const attackLean = isAttacking ? Math.sin(attackProg * Math.PI) * 6 * z : 0;

    // Skin Palette
    const skinBase = '#fec89a';
    const skinShadow = '#f4a261';
    const skinBlush = 'rgba(244, 63, 94, 0.25)';

    // =========================================================================
    // LAYER 1: BACK CAPE / BACK COWL
    // =========================================================================
    if (player.characterClass === 'warrior') {
      const capeWave = Math.sin(t * 6 + (isMoving ? 3 : 0)) * (isMoving ? 7 : 3) * z;
      ctx.save();
      if (isBackView) {
        // Back View: Majestic Full Crimson Cape draped across the back
        ctx.beginPath();
        ctx.moveTo(-9 * z + attackLean, -18 * z);
        ctx.lineTo(9 * z + attackLean, -18 * z);
        ctx.quadraticCurveTo(13 * z + capeWave, 0, 11 * z + capeWave, 18 * z);
        ctx.lineTo(-11 * z + capeWave, 18 * z);
        ctx.quadraticCurveTo(-13 * z + capeWave, 0, -9 * z + attackLean, -18 * z);
        ctx.closePath();
        ctx.fillStyle = '#991b1b'; // Deep royal crimson
        ctx.fill();

        // Inner Fold Shadows
        ctx.beginPath();
        ctx.moveTo(-4 * z + attackLean, -16 * z);
        ctx.quadraticCurveTo(-2 * z + capeWave * 0.5, 0, -3 * z + capeWave * 0.7, 18 * z);
        ctx.lineTo(0 + capeWave * 0.7, 18 * z);
        ctx.quadraticCurveTo(1 * z + capeWave * 0.5, 0, 0 + attackLean, -16 * z);
        ctx.closePath();
        ctx.fillStyle = '#7f1d1d';
        ctx.fill();

        // Golden Brooches at shoulders
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(-8 * z + attackLean, -17 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.arc(8 * z + attackLean, -17 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Front View: Crimson Cape billows behind shoulders with golden clasp brooches
        ctx.beginPath();
        ctx.moveTo(-8 * z + attackLean, -18 * z);
        ctx.lineTo(-2 * z + attackLean, -18 * z);
        ctx.quadraticCurveTo(-11 * z + capeWave, 0, -14 * z + capeWave, 17 * z);
        ctx.lineTo(-5 * z + capeWave, 18 * z);
        ctx.quadraticCurveTo(-3 * z, 0, 0 + attackLean, -17 * z);
        ctx.closePath();
        ctx.fillStyle = '#991b1b';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(2 * z + attackLean, -18 * z);
        ctx.lineTo(8 * z + attackLean, -18 * z);
        ctx.quadraticCurveTo(11 * z - capeWave, 0, 14 * z - capeWave, 17 * z);
        ctx.lineTo(5 * z - capeWave, 18 * z);
        ctx.quadraticCurveTo(3 * z, 0, 0 + attackLean, -17 * z);
        ctx.closePath();
        ctx.fillStyle = '#991b1b';
        ctx.fill();

        // Golden Shoulder Clasp Brooches
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(-7 * z + attackLean, -17 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.arc(7 * z + attackLean, -17 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

    } else if (player.characterClass === 'rogue') {
      const scarfWave = Math.sin(t * 7) * (isMoving ? 8 : 4) * z;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-5 * z + attackLean, -20 * z);
      ctx.quadraticCurveTo(-14 * z + scarfWave, -14 * z, -20 * z + scarfWave * 1.2, -6 * z);
      ctx.lineTo(-17 * z + scarfWave, -4 * z);
      ctx.quadraticCurveTo(-10 * z + scarfWave * 0.8, -16 * z, -3 * z + attackLean, -19 * z);
      ctx.closePath();
      ctx.fillStyle = '#6b21a8';
      ctx.fill();
      ctx.restore();
    }

    // =========================================================================
    // LAYER 2: LEGS & FEET (Natural Human Thighs, Knees, Boots)
    // =========================================================================
    const hasWingedBoots = player.equipment && player.equipment.boots && player.equipment.boots.id === 'winged_boots';

    // Left Leg (Back Leg)
    ctx.save();
    ctx.translate(-4 * z, -2 * z);
    ctx.rotate(legL_Angle);
    // Blue under-tunic rim
    if (player.characterClass === 'warrior') {
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(-2.5 * z, -1 * z, 5 * z, 3 * z);
    }
    // Thigh / Pants
    ctx.fillStyle = player.characterClass === 'warrior' ? '#1e293b' : player.characterClass === 'mage' ? '#1e1b4b' : '#0f172a';
    ctx.fillRect(-2.5 * z, 0, 5 * z, 8 * z);
    // Knee pad / Greave (Polished Steel)
    ctx.fillStyle = player.characterClass === 'warrior' ? '#64748b' : '#334155';
    ctx.fillRect(-2.5 * z, 5 * z, 5 * z, 4 * z);
    if (player.characterClass === 'warrior') {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-1.5 * z, 5.5 * z, 3 * z, 2 * z);
    }
    // Boot / Foot (Rich Brown Leather Riding Boots for Warrior)
    ctx.fillStyle = hasWingedBoots ? '#e0f2fe' : (player.characterClass === 'warrior' ? '#78350f' : '#1e293b');
    ctx.fillRect(-3 * z, 8 * z, 6 * z, 6 * z);
    // Folded Leather Cuff at Top of Boot
    if (player.characterClass === 'warrior') {
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-3.5 * z, 7.5 * z, 7 * z, 2.5 * z);
    }
    // Sole
    ctx.fillStyle = player.characterClass === 'warrior' ? '#1c0d02' : '#0f172a';
    ctx.fillRect(-3.5 * z, 13 * z, 7 * z, 2 * z);
    ctx.restore();

    // Right Leg (Front Leg)
    ctx.save();
    ctx.translate(4 * z, -2 * z);
    ctx.rotate(legR_Angle);
    if (player.characterClass === 'warrior') {
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(-2.5 * z, -1 * z, 5 * z, 3 * z);
    }
    ctx.fillStyle = player.characterClass === 'warrior' ? '#1e293b' : player.characterClass === 'mage' ? '#1e1b4b' : '#0f172a';
    ctx.fillRect(-2.5 * z, 0, 5 * z, 8 * z);
    ctx.fillStyle = player.characterClass === 'warrior' ? '#64748b' : '#334155';
    ctx.fillRect(-2.5 * z, 5 * z, 5 * z, 4 * z);
    if (player.characterClass === 'warrior') {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-1.5 * z, 5.5 * z, 3 * z, 2 * z);
    }
    ctx.fillStyle = hasWingedBoots ? '#e0f2fe' : (player.characterClass === 'warrior' ? '#78350f' : '#1e293b');
    ctx.fillRect(-2.5 * z, 8 * z, 6 * z, 6 * z);
    if (player.characterClass === 'warrior') {
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-3 * z, 7.5 * z, 7 * z, 2.5 * z);
    }
    ctx.fillStyle = player.characterClass === 'warrior' ? '#1c0d02' : '#0f172a';
    ctx.fillRect(-3 * z, 13 * z, 7.5 * z, 2 * z);

    // Winged Boots feather embellishment
    if (hasWingedBoots) {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(-4 * z, 9 * z);
      ctx.lineTo(-8 * z, 6 * z);
      ctx.lineTo(-6 * z, 12 * z);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // =========================================================================
    // LAYER 3: TORSO, BELT & CLOTHING (Front vs Back)
    // =========================================================================
    ctx.save();
    ctx.translate(attackLean, 0);

    // Hips & Waistline
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-6.5 * z, -4 * z, 13 * z, 4 * z);

    // Leather Belt & Golden Buckle
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-7 * z, -6 * z, 14 * z, 2.8 * z);
    if (!isBackView) {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-2 * z, -6.5 * z, 4 * z, 3.8 * z);
    }

    // Human Torso Shape (Tapered from shoulders to waist)
    if (player.characterClass === 'warrior') {
      if (isBackView) {
        // Back View: Solid Steel Backplate & Spine Guard with Blue Tunic Trim
        ctx.fillStyle = '#1d4ed8'; // Blue under-tunic trim
        ctx.fillRect(-7.5 * z, -4 * z, 15 * z, 2.5 * z);

        ctx.fillStyle = '#334155'; // Backplate
        ctx.beginPath();
        ctx.moveTo(-8 * z, -18 * z);
        ctx.lineTo(8 * z, -18 * z);
        ctx.lineTo(6.5 * z, -4 * z);
        ctx.lineTo(-6.5 * z, -4 * z);
        ctx.closePath();
        ctx.fill();

        // Spine Ridge
        ctx.fillStyle = '#475569';
        ctx.fillRect(-2 * z, -17 * z, 4 * z, 12 * z);
      } else {
        // Front View: Royal Blue Gambeson, Chainmail Hauberk & Polished Steel Cuirass
        // 1. Royal Blue Under-Tunic Skirt
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(-7.5 * z, -4 * z, 15 * z, 3 * z);

        // 2. Chainmail Hauberk Midriff
        ctx.fillStyle = '#475569';
        ctx.fillRect(-7 * z, -8 * z, 14 * z, 5 * z);
        // Mail ring accents
        ctx.fillStyle = '#334155';
        ctx.fillRect(-6 * z, -7 * z, 12 * z, 1.2 * z);
        ctx.fillRect(-5 * z, -5.2 * z, 10 * z, 1.2 * z);

        // 3. Steel Breastplate (Cuirass)
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(-8 * z, -18 * z);
        ctx.lineTo(8 * z, -18 * z);
        ctx.lineTo(6.5 * z, -8 * z);
        ctx.lineTo(-6.5 * z, -8 * z);
        ctx.closePath();
        ctx.fill();

        // Steel Pec Plates & Contour
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.ellipse(-3 * z, -14 * z, 3.2 * z, 2.5 * z, 0, 0, Math.PI * 2);
        ctx.ellipse(3 * z, -14 * z, 3.2 * z, 2.5 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Central Breastplate Ridge Highlight
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(-0.8 * z, -17.5 * z, 1.6 * z, 9 * z);

        // Royal Blue Gorget / Neck Border
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.moveTo(-5 * z, -18 * z);
        ctx.lineTo(5 * z, -18 * z);
        ctx.lineTo(3 * z, -16 * z);
        ctx.lineTo(-3 * z, -16 * z);
        ctx.closePath();
        ctx.fill();
      }

    } else if (player.characterClass === 'mage') {
      if (isBackView) {
        // Back View: Flowing Deep Violet Silk Robe
        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath();
        ctx.moveTo(-7 * z, -18 * z);
        ctx.lineTo(7 * z, -18 * z);
        ctx.lineTo(8.5 * z, -3 * z);
        ctx.lineTo(-8.5 * z, -3 * z);
        ctx.closePath();
        ctx.fill();

        // Astral Star Emblem on Back
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(0, -10 * z, 3.5 * z, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Front View: Layered Arcane Silk Robes with Golden Stole
        ctx.fillStyle = '#2e1065';
        ctx.beginPath();
        ctx.moveTo(-7 * z, -18 * z);
        ctx.lineTo(7 * z, -18 * z);
        ctx.lineTo(8.5 * z, -3 * z);
        ctx.lineTo(-8.5 * z, -3 * z);
        ctx.closePath();
        ctx.fill();

        // Starlight Golden Trim
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-1.5 * z, -18 * z, 3 * z, 14 * z);
        ctx.fillRect(-7 * z, -5 * z, 14 * z, 2 * z);
      }

    } else if (player.characterClass === 'rogue') {
      if (isBackView) {
        // Back View: Tactical Leather Doublet with Crossed Scabbard Straps
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(-7.5 * z, -18 * z);
        ctx.lineTo(7.5 * z, -18 * z);
        ctx.lineTo(6 * z, -6 * z);
        ctx.lineTo(-6 * z, -6 * z);
        ctx.closePath();
        ctx.fill();

        // Crossed Leather Dagger Frogs
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2 * z;
        ctx.beginPath();
        ctx.moveTo(-6 * z, -16 * z);
        ctx.lineTo(5 * z, -8 * z);
        ctx.moveTo(6 * z, -16 * z);
        ctx.lineTo(-5 * z, -8 * z);
        ctx.stroke();
      } else {
        // Front View: Fitted Tactical Leather Tunic with Potion Vials
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(-7.5 * z, -18 * z);
        ctx.lineTo(7.5 * z, -18 * z);
        ctx.lineTo(6 * z, -6 * z);
        ctx.lineTo(-6 * z, -6 * z);
        ctx.closePath();
        ctx.fill();

        // Leather Harness Straps
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 1.8 * z;
        ctx.beginPath();
        ctx.moveTo(-6 * z, -18 * z);
        ctx.lineTo(5 * z, -6 * z);
        ctx.stroke();

        // Potion Vials on Chest Straps
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-5 * z, -13 * z, 2.5 * z, 4 * z);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(2.5 * z, -11 * z, 2.5 * z, 4 * z);
      }
    }

    // Human Neck
    ctx.fillStyle = skinShadow;
    ctx.fillRect(-2.5 * z, -21 * z, 5 * z, 4 * z);
    ctx.restore(); // End Layer 3 Torso

    // =========================================================================
    // LAYER 4: SHOULDERS & ARMS (Left Arm / Two-Handed Stance)
    // =========================================================================
    ctx.save();
    ctx.translate(-7 * z + attackLean, -17 * z);
    ctx.rotate(armL_Angle);

    // Pauldron / Shoulder Guard
    ctx.fillStyle = player.characterClass === 'warrior' ? '#64748b' : player.characterClass === 'mage' ? '#4c1d95' : '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, 4.2 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = player.characterClass === 'warrior' ? '#94a3b8' : '#f59e0b';
    ctx.lineWidth = 1 * z;
    ctx.stroke();

    if (player.characterClass === 'warrior') {
      // Left Arm: Royal Blue sleeve, Chainmail, Brown Leather Gauntlet (Two-Handed Stance)
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(-1.5 * z, 1.5 * z, 3 * z, 3 * z);
      ctx.fillStyle = '#475569';
      ctx.fillRect(-1.5 * z, 4.5 * z, 3 * z, 2.5 * z);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-2 * z, 7 * z, 4 * z, 2 * z);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-1.8 * z, 8.8 * z, 3.6 * z, 3 * z);
      // Left hand curves inward to support the bastard sword hilt
    } else {
      // Forearm & Hand
      ctx.fillStyle = skinBase;
      ctx.fillRect(-1.5 * z, 2 * z, 3 * z, 7 * z);
    }

    // =========================================================================
    // LAYER 5: HUMAN HEAD, FACE, HELMET & HAIR
    // =========================================================================
    ctx.save();
    ctx.translate(attackLean, -26 * z);

    if (player.characterClass === 'warrior') {
      if (isBackView) {
        // BACK VIEW: Full Polished Steel Barbute / Sallet Helmet
        // Steel Dome
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(0, 0, 8.5 * z, 0, Math.PI * 2);
        ctx.fill();

        // Metallic Dome Highlight
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.ellipse(-2 * z, -2 * z, 5 * z, 4.5 * z, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Central Raised Helmet Crest Ridge
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(-1.2 * z, -8.5 * z, 2.4 * z, 17 * z);

        // Flared Steel Neck Guard / Aventail
        ctx.beginPath();
        ctx.moveTo(-7 * z, 3 * z);
        ctx.quadraticCurveTo(-8.5 * z, 9 * z, -6 * z, 12 * z);
        ctx.lineTo(6 * z, 12 * z);
        ctx.quadraticCurveTo(8.5 * z, 9 * z, 7 * z, 3 * z);
        ctx.closePath();
        ctx.fillStyle = '#334155';
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1 * z;
        ctx.stroke();

      } else {
        // FRONT VIEW: Steel Barbute Helmet with Central Crest, Nasal Guard & Determined Eyes
        // 1. Helmet Base Dome
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(0, 0, 8.5 * z, 0, Math.PI * 2);
        ctx.fill();

        // Metallic Dome Highlight
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.ellipse(-2.5 * z, -2.5 * z, 5 * z, 4 * z, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Central Raised Helmet Crest Ridge
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(-1.2 * z, -8.5 * z, 2.4 * z, 9 * z);

        // 2. Facial Opening
        ctx.fillStyle = skinBase;
        ctx.fillRect(-4.5 * z, -1 * z, 9 * z, 6.5 * z);

        // Eyes & Brows
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-4 * z, 0, 3 * z, 1 * z);
        ctx.fillRect(1 * z, 0, 3 * z, 1 * z);

        ctx.fillStyle = '#0284c7'; // Blue warrior eyes
        ctx.fillRect(-3.5 * z, 1.5 * z, 2 * z, 1.5 * z);
        ctx.fillRect(1.5 * z, 1.5 * z, 2 * z, 1.5 * z);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-3 * z, 1.5 * z, 0.8 * z, 0.8 * z);
        ctx.fillRect(2 * z, 1.5 * z, 0.8 * z, 0.8 * z);

        // 3. Steel Cheek Guards & Nasal Guard
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(-8.5 * z, -1 * z);
        ctx.lineTo(-4.5 * z, -1 * z);
        ctx.lineTo(-3.5 * z, 7 * z);
        ctx.lineTo(-6 * z, 8 * z);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(8.5 * z, -1 * z);
        ctx.lineTo(4.5 * z, -1 * z);
        ctx.lineTo(3.5 * z, 7 * z);
        ctx.lineTo(6 * z, 8 * z);
        ctx.closePath();
        ctx.fill();

        // Nasal Guard
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.moveTo(-1.2 * z, -1 * z);
        ctx.lineTo(1.2 * z, -1 * z);
        ctx.lineTo(1 * z, 4 * z);
        ctx.lineTo(0, 5.5 * z);
        ctx.lineTo(-1 * z, 4 * z);
        ctx.closePath();
        ctx.fill();

        // Brow Rim Trim
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-6.5 * z, -1.8 * z, 13 * z, 1.4 * z);
      }

    } else {
      // Hair Colors for Mage and Rogue
      const hairColor = player.characterClass === 'mage' ? '#e2e8f0' : '#1e1b4b';
      const hairHighlight = player.characterClass === 'mage' ? '#ffffff' : '#818cf8';

      if (isBackView) {
        ctx.fillStyle = hairColor;
        ctx.beginPath();
        ctx.arc(0, 0, 8.5 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-7.5 * z, 0);
        ctx.quadraticCurveTo(-9.5 * z, 7 * z, -6 * z, 12 * z);
        ctx.lineTo(6 * z, 12 * z);
        ctx.quadraticCurveTo(9.5 * z, 7 * z, 7.5 * z, 0);
        ctx.closePath();
        ctx.fillStyle = hairColor;
        ctx.fill();

        ctx.fillStyle = hairHighlight;
        ctx.fillRect(-2.5 * z, -2 * z, 5 * z, 7 * z);

        if (player.characterClass === 'mage') {
          ctx.fillStyle = '#3b0764';
          ctx.beginPath();
          ctx.ellipse(0, -4.5 * z, 11 * z, 4.5 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(-7 * z, -4.5 * z);
          ctx.lineTo(7 * z, -4.5 * z);
          ctx.lineTo(2 * z, -22 * z);
          ctx.closePath();
          ctx.fillStyle = '#2e1065';
          ctx.fill();

          ctx.fillStyle = '#facc15';
          ctx.fillRect(-6 * z, -7 * z, 12 * z, 2.5 * z);

        } else if (player.characterClass === 'rogue') {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-6.5 * z, -4.5 * z, 13 * z, 2.8 * z);
          ctx.fillRect(-2 * z, -3.5 * z, 4 * z, 3 * z);

          const tailWave1 = Math.sin(t * 8) * 4 * z;
          const tailWave2 = Math.cos(t * 7) * 4 * z;
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2 * z;
          ctx.beginPath();
          ctx.moveTo(-1 * z, -3 * z);
          ctx.quadraticCurveTo(-6 * z + tailWave1, 3 * z, -12 * z + tailWave1 * 1.2, 9 * z);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(1 * z, -3 * z);
          ctx.quadraticCurveTo(-3 * z + tailWave2, 5 * z, -8 * z + tailWave2 * 1.1, 12 * z);
          ctx.stroke();
        }

      } else {
        // Front View of Mage / Rogue
        ctx.fillStyle = hairColor;
        ctx.beginPath();
        ctx.arc(0, 0, 8.5 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = skinBase;
        ctx.beginPath();
        ctx.arc(0, 1 * z, 6.8 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = skinBlush;
        ctx.beginPath();
        ctx.arc(-3.8 * z, 2.8 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.arc(3.8 * z, 2.8 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = skinBase;
        ctx.beginPath();
        ctx.arc(-6.5 * z, 1.5 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.arc(6.5 * z, 1.5 * z, 1.8 * z, 0, Math.PI * 2);
        ctx.fill();

        const eyeIrisColor = player.characterClass === 'mage' ? '#8b5cf6' : '#16a34a';
        const drawEye = (ex, ey) => {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(ex - 2.5 * z, ey - 2.5 * z, 5 * z, 1.3 * z);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(ex - 2 * z, ey - 1.2 * z, 4 * z, 3 * z);
          ctx.fillStyle = eyeIrisColor;
          ctx.fillRect(ex - 1.2 * z, ey - 1.2 * z, 2.8 * z, 3 * z);
          ctx.fillStyle = '#09090b';
          ctx.fillRect(ex - 0.7 * z, ey - 0.7 * z, 1.8 * z, 2 * z);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(ex - 0.3 * z, ey - 1.0 * z, 1.0 * z, 1.0 * z);
        };

        if (isDirectSouth) {
          drawEye(-2.5 * z, 1 * z);
          drawEye(2.5 * z, 1 * z);
        } else if (isDirectSide) {
          drawEye(2.0 * z, 1 * z);
        } else {
          drawEye(-1.5 * z, 1 * z);
          drawEye(3.0 * z, 1 * z);
        }

        ctx.fillStyle = '#b45309';
        ctx.fillRect(-1.2 * z, 5.5 * z, 2.4 * z, 0.9 * z);

        if (player.characterClass === 'rogue') {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.moveTo(-5.5 * z, 3.2 * z);
          ctx.lineTo(5.5 * z, 3.2 * z);
          ctx.lineTo(4 * z, 7.8 * z);
          ctx.lineTo(0, 9 * z);
          ctx.lineTo(-4 * z, 7.8 * z);
          ctx.closePath();
          ctx.fill();
        }

        ctx.fillStyle = hairColor;
        ctx.beginPath();
        ctx.moveTo(-6 * z, -3 * z);
        ctx.lineTo(-3 * z, 0 * z);
        ctx.lineTo(-1 * z, -2 * z);
        ctx.lineTo(2 * z, 0.5 * z);
        ctx.lineTo(4 * z, -2 * z);
        ctx.lineTo(6.5 * z, -1 * z);
        ctx.lineTo(6 * z, -5 * z);
        ctx.lineTo(-6 * z, -5 * z);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = hairHighlight;
        ctx.fillRect(-3 * z, -4.5 * z, 6 * z, 1.2 * z);

        if (player.characterClass === 'mage') {
          ctx.fillStyle = '#3b0764';
          ctx.beginPath();
          ctx.ellipse(0, -4.5 * z, 11 * z, 4.5 * z, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(-7 * z, -4.5 * z);
          ctx.lineTo(7 * z, -4.5 * z);
          ctx.lineTo(2 * z, -22 * z);
          ctx.closePath();
          ctx.fillStyle = '#2e1065';
          ctx.fill();

          ctx.fillStyle = '#facc15';
          ctx.fillRect(-6 * z, -7 * z, 12 * z, 2.5 * z);
          ctx.beginPath();
          ctx.arc(2 * z, -22 * z, 2.8 * z, 0, Math.PI * 2);
          ctx.fillStyle = '#38bdf8';
          ctx.fill();

        } else if (player.characterClass === 'rogue') {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-6.5 * z, -4.5 * z, 13 * z, 2.8 * z);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(-3 * z, -4.5 * z, 6 * z, 2.2 * z);
        }
      }
    }

    ctx.restore(); // End Layer 5 Head

    // =========================================================================
    // LAYER 6: RIGHT ARM & WEAPON
    // =========================================================================
    ctx.save();
    ctx.translate(7 * z + attackLean, -16 * z);

    // Right Pauldron
    ctx.fillStyle = player.characterClass === 'warrior' ? '#64748b' : player.characterClass === 'mage' ? '#4c1d95' : '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = player.characterClass === 'warrior' ? '#94a3b8' : '#f59e0b';
    ctx.lineWidth = 1 * z;
    ctx.stroke();

    if (player.characterClass === 'warrior') {
      // Right Arm: Blue sleeve, Chainmail, Brown Leather Gauntlet
      ctx.rotate(armR_Angle);
      ctx.fillStyle = '#2563eb'; // Royal blue sleeve
      ctx.fillRect(-1.5 * z, 1.5 * z, 3 * z, 3 * z);
      ctx.fillStyle = '#475569'; // Chainmail elbow
      ctx.fillRect(-1.5 * z, 4.5 * z, 3 * z, 2.5 * z);
      ctx.fillStyle = '#92400e'; // Brown leather cuff
      ctx.fillRect(-2 * z, 7 * z, 4 * z, 2 * z);
      ctx.fillStyle = '#78350f'; // Brown leather hand
      ctx.beginPath();
      ctx.arc(0, 9.5 * z, 2.2 * z, 0, Math.PI * 2);
      ctx.fill();

      // TWO-HANDED BASTARD SWORD
      ctx.save();
      if (isAttacking) {
        // Dynamic Two-Handed Cleaving Strike
        const swingAngle = -1.4 + Math.sin(attackProg * Math.PI) * 2.9;
        ctx.translate(0, 9.5 * z);
        ctx.rotate(swingAngle);

        // Long Two-Handed Leather Grip
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-1.2 * z, -2 * z, 2.4 * z, 9 * z);
        // Steel Pommel
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(0, 7.5 * z, 2.2 * z, 0, Math.PI * 2);
        ctx.fill();

        // Steel Crossguard with flared quillons
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-7 * z, -3.5 * z, 14 * z, 2.8 * z);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-6.5 * z, -3 * z, 13 * z, 1.5 * z);

        // Double-Edged Bastard Sword Blade
        ctx.fillStyle = '#cbd5e1'; // Blade face
        ctx.fillRect(-2.2 * z, -32 * z, 4.4 * z, 29 * z);
        ctx.fillStyle = '#f8fafc'; // Sharp edge highlight
        ctx.fillRect(-1.8 * z, -32 * z, 1 * z, 29 * z);
        // Central Fuller Groove
        ctx.fillStyle = '#475569';
        ctx.fillRect(-0.5 * z, -30 * z, 1 * z, 25 * z);
        // Sharp Tip
        ctx.beginPath();
        ctx.moveTo(-2.2 * z, -32 * z);
        ctx.lineTo(2.2 * z, -32 * z);
        ctx.lineTo(0, -36 * z);
        ctx.closePath();
        ctx.fillStyle = '#f8fafc';
        ctx.fill();

        // Slashing Blade Arc Trail
        ctx.beginPath();
        ctx.arc(0, -20 * z, 30 * z, -0.9, 1.5);
        ctx.strokeStyle = `rgba(224, 242, 254, ${0.92 * (1 - attackProg)})`;
        ctx.lineWidth = 5 * z;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -20 * z, 28 * z, -0.8, 1.4);
        ctx.strokeStyle = `rgba(245, 158, 11, ${0.8 * (1 - attackProg)})`;
        ctx.lineWidth = 2.5 * z;
        ctx.stroke();

      } else {
        // Majestic Two-Handed Ready Guard Stance (Angled across chest like reference image!)
        ctx.translate(0, 9.5 * z);
        ctx.rotate(-0.45); // Tilted forward in front guard

        // Two-handed leather grip
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-1.2 * z, 0, 2.4 * z, 8 * z);
        // Steel Pommel
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(0, 8.5 * z, 2 * z, 0, Math.PI * 2);
        ctx.fill();

        // Steel Crossguard
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-6 * z, -2 * z, 12 * z, 2.5 * z);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-5.5 * z, -1.8 * z, 11 * z, 1.2 * z);

        // Bastard Blade Body
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(-2 * z, -28 * z, 4 * z, 26 * z);
        // Central fuller groove
        ctx.fillStyle = '#475569';
        ctx.fillRect(-0.5 * z, -26 * z, 1 * z, 22 * z);
        // Edge highlight
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-1.8 * z, -28 * z, 0.8 * z, 26 * z);
        // Tip
        ctx.beginPath();
        ctx.moveTo(-2 * z, -28 * z);
        ctx.lineTo(2 * z, -28 * z);
        ctx.lineTo(0, -32 * z);
        ctx.closePath();
        ctx.fillStyle = '#f8fafc';
        ctx.fill();
      }
      ctx.restore();

    } else if (player.characterClass === 'mage') {
      // Archmage Staff
      const staffThrust = isAttacking ? Math.sin(attackProg * Math.PI) * 14 * z : 0;
      ctx.translate(staffThrust, -staffThrust * 0.2);

      // Hand gripping staff
      ctx.fillStyle = skinBase;
      ctx.beginPath();
      ctx.arc(2 * z, 6 * z, 2.2 * z, 0, Math.PI * 2);
      ctx.fill();

      // Elderwood Staff
      ctx.fillStyle = '#78350f';
      ctx.fillRect(1 * z, -28 * z, 3.5 * z, 38 * z);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, -26 * z, 5.5 * z, 2.5 * z);

      // Arcane Crystal Core
      const crystalPulse = Math.sin(t * 8) * 2 * z;
      ctx.beginPath();
      ctx.arc(2.5 * z, -30 * z, 5.5 * z + crystalPulse, 0, Math.PI * 2);
      ctx.fillStyle = isAttacking ? '#facc15' : '#06b6d4';
      ctx.fill();

      // Cast Burst
      if (isAttacking) {
        ctx.beginPath();
        ctx.arc(2.5 * z, -30 * z, 20 * z * (1 - attackProg), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(250, 204, 21, ${0.9 * (1 - attackProg)})`;
        ctx.lineWidth = 3 * z;
        ctx.stroke();
      }

    } else if (player.characterClass === 'rogue') {
      // Right Hand Dagger
      const stabRight = isAttacking ? Math.sin(attackProg * Math.PI * 2) * 14 * z : 0;

      // Hand
      ctx.fillStyle = skinBase;
      ctx.beginPath();
      ctx.arc(stabRight, 6 * z, 2.2 * z, 0, Math.PI * 2);
      ctx.fill();

      // Obsidian Dagger
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-1.5 * z + stabRight, -14 * z, 3 * z, 20 * z);
      ctx.fillStyle = '#4ade80'; // Toxic edge
      ctx.fillRect(0.5 * z + stabRight, -13 * z, 1.2 * z, 18 * z);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-3 * z + stabRight, 4 * z, 6 * z, 2.5 * z);

      if (isAttacking) {
        ctx.beginPath();
        ctx.moveTo(-10 * z, -20 * z);
        ctx.lineTo(16 * z + stabRight, 6 * z);
        ctx.strokeStyle = `rgba(74, 222, 128, ${0.9 * (1 - attackProg)})`;
        ctx.lineWidth = 3.5 * z;
        ctx.stroke();
      }
    }

    ctx.restore(); // End Right Arm
    ctx.restore(); // End Player coordinate space (Line 1084)

    // Nametag, Guild Badge & Mini HP Bar
    this.drawEntityOverhead(ctx, screen.x, screen.y - 50 * z, player.name, player.hp, player.maxHp, isLocal ? '#38bdf8' : '#fff', `Lv.${player.level}`);

    // Speech Bubble
    if (player.speechBubble) {
      this.drawSpeechBubble(ctx, screen.x, screen.y - 74 * z, player.speechBubble);
    }
  }

  // Authentic 8-Directional Pixel Art Swordman Renderer (Full 360-Degree Rotation, Idle, Attack Slash, Dash & Walk Gait)
  drawSwordman(ctx, player, isLocal, screen, z, t) {
    const isMoving = !!player.isMoving;

    // =========================================================================
    // STATE 1: DASH STATE (แดช / BLADE CHARGE)
    // =========================================================================
    const dash = this.dashes ? this.dashes.get(player.id) : null;
    const isDashing = dash && (performance.now() - dash.time < dash.duration);
    const dashProg = isDashing ? (performance.now() - dash.time) / dash.duration : 0;

    // =========================================================================
    // STATE 2: ATTACK / SWORD SLASH STATE (ฟันดาบ)
    // =========================================================================
    const attack = this.attacks ? this.attacks.get(player.id) : null;
    const isAttacking = attack && (performance.now() - attack.time < attack.duration);
    const attackProg = isAttacking ? (performance.now() - attack.time) / attack.duration : 0;

    // Facing direction: during attack or dash, lock facing towards targeted action direction!
    const facing = (isAttacking && attack.facing)
      ? attack.facing
      : ((isDashing && dash.facing) ? dash.facing : (player.facing || 'S'));

    const frames = IsometricRenderer.SWORDMAN_FRAMES;
    const frame = frames[facing] || frames.S;

    const baseScale = 0.205 * z;
    const splitY = frame.splitY || 228;
    const midX = frame.midX || 129;

    // Dynamic 8-Directional Lunge & Facing Vectors
    const lungeVecs = {
      S:  { x: 0,      y: 1.0 },
      SE: { x: 0.89,   y: 0.45 },
      E:  { x: 1.0,    y: 0.0 },
      NE: { x: 0.89,   y: -0.45 },
      N:  { x: 0,      y: -1.0 },
      NW: { x: -0.89,  y: -0.45 },
      W:  { x: -1.0,   y: 0.0 },
      SW: { x: -0.89,  y: 0.45 }
    };
    const lv = lungeVecs[facing] || lungeVecs.S;

    // Pose Offsets & Angles
    let lungeX = 0;
    let lungeY = 0;
    let poseTilt = 0;
    let verticalOffset = 0;

    if (isDashing) {
      // --- DASH POSE: Aerodynamic Piercing Stance ---
      const dashImpulse = Math.sin(dashProg * Math.PI);
      lungeX = lv.x * 15 * z * dashImpulse;
      lungeY = lv.y * 15 * z * dashImpulse;
      poseTilt = 0.36 * (lv.x >= 0 ? 1 : -1);
      verticalOffset = 4.0 * z; // Lower center of gravity into sprint

      // Record ghost afterimage trail positions
      player._dashTrail = player._dashTrail || [];
      player._dashTrail.unshift({
        x: screen.x + lungeX,
        y: screen.y + lungeY - verticalOffset,
        facing,
        time: performance.now()
      });
      if (player._dashTrail.length > 5) player._dashTrail.pop();

      // Spawn wind friction sparks along dash path
      if (Math.random() < 0.45) {
        this.addParticles(player.x, player.y, 'wind', 2);
        this.addParticles(player.x, player.y, 'slash', 1);
      }

    } else if (isAttacking) {
      // --- SWORD SLASH POSE: 3-Phase Cleaving Strike ---
      if (attackProg < 0.28) {
        // Phase 1: Heavy Windup - Coils back, bastard sword raised high
        const wp = attackProg / 0.28;
        lungeX = -lv.x * 5 * z * wp;
        lungeY = -lv.y * 5 * z * wp;
        poseTilt = -0.16 * wp * (lv.x >= 0 ? 1 : -1);
        verticalOffset = -1.5 * z * wp;
      } else if (attackProg <= 0.72) {
        // Phase 2: Cleave Strike - Explosive forward cleave lunge!
        const sp = (attackProg - 0.28) / 0.44;
        const strikeThrust = Math.sin(sp * Math.PI);
        lungeX = lv.x * 16 * z * strikeThrust;
        lungeY = lv.y * 16 * z * strikeThrust;
        poseTilt = 0.28 * strikeThrust * (lv.x >= 0 ? 1 : -1);
        verticalOffset = 2.0 * z * strikeThrust;
      } else {
        // Phase 3: Follow-through recovery
        const rp = (attackProg - 0.72) / 0.28;
        lungeX = lv.x * 8 * z * (1 - rp);
        lungeY = lv.y * 8 * z * (1 - rp);
        poseTilt = 0.12 * (1 - rp) * (lv.x >= 0 ? 1 : -1);
      }
    } else {
      // Clear dash trail when not dashing
      if (player._dashTrail && player._dashTrail.length > 0) {
        player._dashTrail = [];
      }
    }

    // Walking stride cadence (when moving and not attacking or dashing)
    const walkCycle = isMoving ? (t * 14) : 0;
    const stepCadence = Math.sin(walkCycle);

    const strideDist = (isMoving && !isAttacking && !isDashing) ? 3.8 * z : 0;
    const legL_stride = strideDist ? stepCadence : 0;
    const legR_stride = strideDist ? -stepCadence : 0;

    const legL_x = lv.x * legL_stride * strideDist;
    const legL_y = lv.y * legL_stride * strideDist * 0.5;
    const legL_lift = strideDist ? Math.max(0, -stepCadence) * 3.5 * z : 0;

    const legR_x = lv.x * legR_stride * strideDist;
    const legR_y = lv.y * legR_stride * strideDist * 0.5;
    const legR_lift = strideDist ? Math.max(0, stepCadence) * 3.5 * z : 0;

    // =========================================================================
    // STATE 3: IDLE STATE DYNAMICS (Breathing, Sway, Grounding)
    // =========================================================================
    const idleBreath = Math.sin(t * 3.0) * 0.9 * z;
    const idleSway = Math.sin(t * 2.0) * 0.015;

    const gaitBob = (isMoving && !isAttacking && !isDashing)
      ? (Math.abs(Math.sin(walkCycle)) * 2.4 * z)
      : (!isAttacking && !isDashing ? idleBreath : 0);

    const gaitSway = (isMoving && !isAttacking && !isDashing)
      ? (Math.sin(walkCycle) * 0.045)
      : (!isAttacking && !isDashing ? idleSway : 0);

    // Foot positions in screen space relative to anchor
    const footLRelX = (frame.footLX - frame.anchorX) * baseScale;
    const footRRelX = (frame.footRX - frame.anchorX) * baseScale;

    // Footstep ground dust puff when foot strikes the ground (Subtle & gentle)
    if (isMoving && !isAttacking && !isDashing && Math.abs(stepCadence) < 0.15 && Math.random() < 0.04) {
      this.addParticles(player.x, player.y, 'dust', 1);
    }

    // =========================================================================
    // DUAL BOOT GROUND CONTACT SHADOWS & AMBIENT OCCLUSION
    // =========================================================================
    ctx.save();
    const shadowAngle = 0.28;

    // Ground Ambient Body Occlusion
    ctx.beginPath();
    ctx.ellipse(screen.x + lungeX, screen.y + lungeY, 15 * z, 6.5 * z, shadowAngle, 0, Math.PI * 2);
    ctx.fillStyle = isDashing ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Left Boot Contact Shadow (softens and shrinks when foot lifts)
    const shadowLAlpha = Math.max(0.12, 0.58 - (legL_lift / (3.5 * z)) * 0.42);
    const shadowLScale = Math.max(0.55, 1.0 - (legL_lift / (3.5 * z)) * 0.35);
    ctx.beginPath();
    ctx.ellipse(screen.x + lungeX + footLRelX + legL_x, screen.y + lungeY + legL_y, 7.5 * z * shadowLScale, 3.8 * z * shadowLScale, shadowAngle, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowLAlpha})`;
    ctx.fill();

    // Right Boot Contact Shadow (softens and shrinks when foot lifts)
    const shadowRAlpha = Math.max(0.12, 0.58 - (legR_lift / (3.5 * z)) * 0.42);
    const shadowRScale = Math.max(0.55, 1.0 - (legR_lift / (3.5 * z)) * 0.35);
    ctx.beginPath();
    ctx.ellipse(screen.x + lungeX + footRRelX + legR_x, screen.y + lungeY + legR_y, 7.5 * z * shadowRScale, 3.8 * z * shadowRScale, shadowAngle, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowRAlpha})`;
    ctx.fill();
    ctx.restore();

    // =========================================================================
    // SELECTION RING FOR LOCAL HERO
    // =========================================================================
    if (isLocal) {
      const ringPulse = Math.sin(t * 4) * 1.5 * z;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 18 * z + ringPulse, 9 * z + ringPulse * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    // =========================================================================
    // DRAW SPRITE: DASH AFTERIMAGES, ATTACK STRIKE, WALK GAIT OR IDLE
    // =========================================================================
    // =========================================================================
    // DRAW SPRITE: DEDICATED SPRITE SHEETS FOR DASH, ATTACK SLASH, IDLE & WALK
    // =========================================================================
    const isFacingLeft = (facing === 'W' || facing === 'NW' || facing === 'SW' || (isDashing && lv.x < 0) || (isAttacking && lv.x < 0));

    if (this.sprites.swordman.complete && this.sprites.swordman.naturalWidth > 0) {
      ctx.save();
      ctx.imageSmoothingEnabled = false; // preserve crisp pixel art rendering

      if (isDashing) {
        // --- 1. DASH STATE (แดช / BLADE CHARGE) ---
        const useDashStrip = this.sprites.swordmanDash && this.sprites.swordmanDash.complete && this.sprites.swordmanDash.naturalWidth > 0;
        const dashFrames = IsometricRenderer.SWORDMAN_DASH_FRAMES;
        let dFrameIdx = 0;
        if (dashProg < 0.15) dFrameIdx = 0;        // Sprint Crouch
        else if (dashProg < 0.45) dFrameIdx = 1;   // Dive Sprint with Wind
        else if (dashProg < 0.78) dFrameIdx = 2;   // Supersonic Blade Thrust
        else dFrameIdx = 3;                        // Slide Stop with Dust

        const curDFrame = dashFrames[dFrameIdx];
        const dImg = useDashStrip ? this.sprites.swordmanDash : this.sprites.swordman;
        const srcF = useDashStrip ? curDFrame : frame;

        const dw = srcF.sw * baseScale;
        const dh = srcF.sh * baseScale;
        const dx = -srcF.anchorX * baseScale;
        const dy = -srcF.anchorY * baseScale;

        // --- DASH GHOST AFTERIMAGES (Phantom Echoes) ---
        if (player._dashTrail && player._dashTrail.length > 1) {
          for (let i = 1; i < player._dashTrail.length; i++) {
            const ghost = player._dashTrail[i];
            const ghostAge = (performance.now() - ghost.time) / 320;
            if (ghostAge < 1.0) {
              ctx.save();
              ctx.globalAlpha = (1.0 - ghostAge) * (i === 1 ? 0.48 : i === 2 ? 0.28 : 0.14);
              ctx.translate(ghost.x, ghost.y);
              if (isFacingLeft) ctx.scale(-1, 1);
              ctx.drawImage(dImg, srcF.sx, srcF.sy, srcF.sw, srcF.sh, dx, dy, dw, dh);

              // Cyan Spectral Velocity Highlight
              ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
              ctx.fillRect(dx, dy, dw, dh);
              ctx.restore();
            }
          }
        }

        // Render Main Dash Body
        ctx.save();
        ctx.translate(screen.x + lungeX, screen.y + lungeY - verticalOffset);
        if (isFacingLeft) ctx.scale(-1, 1);
        ctx.drawImage(dImg, srcF.sx, srcF.sy, srcF.sw, srcF.sh, dx, dy, dw, dh);
        ctx.restore();

        // Speed Lines (Aerodynamic wind shear streaks cutting across the dash)
        ctx.save();
        const streakAngle = Math.atan2(lv.y, lv.x);
        ctx.translate(screen.x + lungeX, screen.y + lungeY - 14 * z);
        ctx.rotate(streakAngle);
        for (let s = -1; s <= 1; s++) {
          ctx.beginPath();
          ctx.moveTo(-22 * z, s * 8 * z);
          ctx.lineTo(20 * z, s * 8 * z);
          ctx.strokeStyle = `rgba(224, 242, 254, ${0.8 - Math.abs(s) * 0.2})`;
          ctx.lineWidth = 2.0 * z;
          ctx.stroke();
        }
        ctx.restore();

        // Spawn braking slide dust when entering stop phase
        if (dFrameIdx === 3 && Math.random() < 0.08) {
          this.addParticles(player.x, player.y, 'dust', 1);
        }

      } else if (isAttacking) {
        // --- 2. ATTACK SLASH STATE (ฟันดาบ) ---
        const useAttackStrip = this.sprites.swordmanAttack && this.sprites.swordmanAttack.complete && this.sprites.swordmanAttack.naturalWidth > 0;
        const attackFrames = IsometricRenderer.SWORDMAN_ATTACK_FRAMES;
        let aFrameIdx = 0;
        if (attackProg < 0.22) aFrameIdx = 0;       // Windup
        else if (attackProg < 0.52) aFrameIdx = 1;  // Slash Cleave Arc
        else if (attackProg < 0.80) aFrameIdx = 2;  // Lunge Thrust
        else aFrameIdx = 3;                         // Recovery

        const curAFrame = attackFrames[aFrameIdx];
        const aImg = useAttackStrip ? this.sprites.swordmanAttack : this.sprites.swordman;
        const srcF = useAttackStrip ? curAFrame : frame;

        const dw = srcF.sw * baseScale;
        const dh = srcF.sh * baseScale;
        const dx = -srcF.anchorX * baseScale;
        const dy = -srcF.anchorY * baseScale;

        ctx.save();
        ctx.translate(screen.x + lungeX, screen.y + lungeY - verticalOffset);
        if (isFacingLeft) ctx.scale(-1, 1);
        ctx.drawImage(aImg, srcF.sx, srcF.sy, srcF.sw, srcF.sh, dx, dy, dw, dh);
        ctx.restore();

      } else if (isMoving) {
        // --- 3. DYNAMIC COMBAT RUN (วิ่งลากดาบเท่ๆ ด้วยมือเดียว / DRAGGING SWORD RUN) ---
        const isBackRun = (facing === 'N' || facing === 'NE' || facing === 'NW');
        const runImg = isBackRun ? this.sprites.swordmanRunBack : this.sprites.swordmanRunFront;
        const useRunStrip = runImg && runImg.complete && runImg.naturalWidth > 0;

        if (useRunStrip) {
          const runFrames = IsometricRenderer.SWORDMAN_RUN_FRAMES;
          // Fast-paced athletic running cadence (8.5 frames per second loop)
          const runIdx = Math.floor((t * 8.5) % 4);
          const rFrame = runFrames[runIdx];

          const dw = rFrame.sw * baseScale;
          const dh = rFrame.sh * baseScale;
          const dx = -rFrame.anchorX * baseScale;
          const dy = -rFrame.anchorY * baseScale;

          // Determine horizontal flip:
          // Front-view: faces right by default. Flip if moving left (W, SW, or lv.x < -0.2)
          // Back-view: faces right/up-right by default. Flip if moving up-left (NW, or lv.x < -0.2)
          const flipRun = isBackRun ? (facing === 'NW' || lv.x < -0.2) : (facing === 'W' || facing === 'SW' || lv.x < -0.2);

          // Athletic forward lean tilt + vertical run bounce
          const runLean = 0.09 * (flipRun ? -1 : 1);
          const runBob = Math.abs(Math.sin(t * 17)) * 2.5 * z;

          ctx.save();
          ctx.translate(screen.x, screen.y - runBob);
          ctx.rotate(runLean);
          if (flipRun) ctx.scale(-1, 1);
          ctx.drawImage(runImg, rFrame.sx, rFrame.sy, rFrame.sw, rFrame.sh, dx, dy, dw, dh);
          ctx.restore();

          // Blade Ground Friction Sparks & Dust (sparking along the ground where the heavy sword drags!)
          const sparkSide = flipRun ? 0.35 : -0.35;
          const swordTipX = player.x + sparkSide;
          const swordTipY = player.y + 0.12;
          if (Math.random() < 0.28) {
            this.addParticles(swordTipX, swordTipY, 'slash', 1);
          }
          if (Math.random() < 0.03) {
            this.addParticles(player.x, player.y, 'dust', 1);
          }

        } else {
          // Fallback to turnaround sheet if strip is still loading
          const img = this.sprites.swordman;
          const dw = frame.sw * baseScale;
          const dh = frame.sh * baseScale;
          const dx = -frame.anchorX * baseScale;
          const dy = -frame.anchorY * baseScale;

          ctx.save();
          ctx.translate(screen.x, screen.y - gaitBob);
          ctx.rotate(gaitSway);
          ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, dx, dy, dw, dh);
          ctx.restore();
        }

      } else {
        // --- 4. IDLE STATE: Living Breathing Cadence, Stance Shift & Sword Specular Glint ---
        const isFrontal = (facing === 'S' || facing === 'SE' || facing === 'SW');
        const useIdleStrip = isFrontal && this.sprites.swordmanIdle && this.sprites.swordmanIdle.complete && this.sprites.swordmanIdle.naturalWidth > 0;

        if (useIdleStrip) {
          const idleFrames = IsometricRenderer.SWORDMAN_IDLE_FRAMES;
          const idleFrameIdx = Math.floor((t * 2.0) % 4);
          const iFrame = idleFrames[idleFrameIdx];
          const dw = iFrame.sw * baseScale;
          const dh = iFrame.sh * baseScale;
          const dx = -iFrame.anchorX * baseScale;
          const dy = -iFrame.anchorY * baseScale;

          ctx.save();
          ctx.translate(screen.x, screen.y - gaitBob);
          if (facing === 'SW') ctx.scale(-1, 1);
          ctx.drawImage(this.sprites.swordmanIdle, iFrame.sx, iFrame.sy, iFrame.sw, iFrame.sh, dx, dy, dw, dh);
          ctx.restore();

        } else {
          // 8-directional turnaround idle pose for back/side view angles
          const img = this.sprites.swordman;
          const dw = frame.sw * baseScale;
          const dh = frame.sh * baseScale;
          const dx = -frame.anchorX * baseScale;
          const dy = -frame.anchorY * baseScale;

          ctx.save();
          ctx.translate(screen.x, screen.y - gaitBob);
          ctx.rotate(gaitSway);
          ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, dx, dy, dw, dh);
          ctx.restore();

          // Steel Blade Specular Gleam Highlight (sweeps down sword edge every 2.8s)
          const gleamCycle = (t % 2.8);
          if (gleamCycle < 0.42) {
            const gp = gleamCycle / 0.42;
            const glintX = screen.x + (lv.x >= 0 ? 5 : -5) * z;
            const glintY = screen.y - (32 - gp * 18) * z;
            ctx.save();
            ctx.beginPath();
            ctx.arc(glintX, glintY, 2.6 * z * Math.sin(gp * Math.PI), 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#67e8f9';
            ctx.shadowBlur = 8 * z;
            ctx.fill();
            ctx.restore();
          }
        }
      }

      ctx.restore();
    }

    // =========================================================================
    // DYNAMIC COMBAT SLASHING BLADE ARC & CLEAVING VISUAL TRAILS
    // =========================================================================
    if (isAttacking && attackProg > 0.12 && attackProg < 0.85) {
      ctx.save();
      const slashAngle = Math.atan2(lv.y, lv.x);
      ctx.translate(screen.x + lungeX + lv.x * 12 * z, screen.y + lungeY + lv.y * 8 * z - 22 * z);
      ctx.rotate(slashAngle);

      const arcProg = (attackProg - 0.12) / 0.73;
      const arcStart = -1.2 + arcProg * 0.45;
      const arcEnd = 1.2;
      const alpha = Math.sin(arcProg * Math.PI) * 0.95;

      // Radiant Electric Outer Slash Aura
      ctx.beginPath();
      ctx.arc(0, 0, 28 * z, arcStart, arcEnd);
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.6})`;
      ctx.lineWidth = 6.5 * z;
      ctx.stroke();

      // Razor Steel Core Arc
      ctx.beginPath();
      ctx.arc(0, 0, 27 * z, arcStart, arcEnd);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 3.2 * z;
      ctx.stroke();

      // Fiery Golden Cutting Edge
      ctx.beginPath();
      ctx.arc(0, 0, 25 * z, arcStart + 0.1, arcEnd - 0.1);
      ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.88})`;
      ctx.lineWidth = 1.8 * z;
      ctx.stroke();

      ctx.restore();
    }

    // =========================================================================
    // OVERHEAD NAMETAG, GUILD BADGE & MINI HP BAR
    // =========================================================================
    this.drawEntityOverhead(ctx, screen.x, screen.y - 54 * z, player.name, player.hp, player.maxHp, isLocal ? '#38bdf8' : '#fff', `Lv.${player.level}`);

    // =========================================================================
    // SPEECH BUBBLE
    // =========================================================================
    if (player.speechBubble) {
      this.drawSpeechBubble(ctx, screen.x, screen.y - 78 * z, player.speechBubble);
    }
  }

  // Authentic Pixel Art Archmage Renderer (Levitation, Arcane Burst Cast, Blink Dash & Staff Drag Run)
  drawMage(ctx, player, isLocal, screen, z, t) {
    const isMoving = !!player.isMoving;

    // 1. DASH STATE (Arcane Blink / Warp Surge)
    const dash = this.dashes ? this.dashes.get(player.id) : null;
    const isDashing = dash && (performance.now() - dash.time < dash.duration);
    const dashProg = isDashing ? (performance.now() - dash.time) / dash.duration : 0;

    // 2. ATTACK STATE (Arcane Spell Beam / Burst Cast)
    const attack = this.attacks ? this.attacks.get(player.id) : null;
    const isAttacking = attack && (performance.now() - attack.time < attack.duration);
    const attackProg = isAttacking ? (performance.now() - attack.time) / attack.duration : 0;

    // Facing direction: during attack or dash, lock facing towards action direction!
    const facing = (isAttacking && attack.facing)
      ? attack.facing
      : ((isDashing && dash.facing) ? dash.facing : (player.facing || 'S'));

    const baseScale = 0.205 * z;

    // 8-Directional Lunge & Facing Vectors
    const lungeVecs = {
      S:  { x: 0,      y: 1.0 },
      SE: { x: 0.89,   y: 0.45 },
      E:  { x: 1.0,    y: 0.0 },
      NE: { x: 0.89,   y: -0.45 },
      N:  { x: 0,      y: -1.0 },
      NW: { x: -0.89,  y: -0.45 },
      W:  { x: -1.0,   y: 0.0 },
      SW: { x: -0.89,  y: 0.45 }
    };
    const lv = lungeVecs[facing] || lungeVecs.S;

    let lungeX = 0;
    let lungeY = 0;
    let verticalOffset = 0;

    if (isDashing) {
      const dashImpulse = Math.sin(dashProg * Math.PI);
      lungeX = lv.x * 16 * z * dashImpulse;
      lungeY = lv.y * 16 * z * dashImpulse;
      verticalOffset = 2.0 * z;

      player._dashTrail = player._dashTrail || [];
      player._dashTrail.unshift({
        x: screen.x + lungeX,
        y: screen.y + lungeY - verticalOffset,
        facing,
        time: performance.now()
      });
      if (player._dashTrail.length > 5) player._dashTrail.pop();

      if (Math.random() < 0.45) {
        this.addParticles(player.x, player.y, 'arcane', 2);
      }
    } else if (isAttacking) {
      if (attackProg < 0.25) {
        const wp = attackProg / 0.25;
        lungeX = -lv.x * 4 * z * wp;
        lungeY = -lv.y * 4 * z * wp;
        verticalOffset = -1.0 * z * wp;
      } else if (attackProg <= 0.70) {
        const sp = (attackProg - 0.25) / 0.45;
        const strikeThrust = Math.sin(sp * Math.PI);
        lungeX = lv.x * 14 * z * strikeThrust;
        lungeY = lv.y * 14 * z * strikeThrust;
        verticalOffset = 1.5 * z * strikeThrust;
      } else {
        const rp = (attackProg - 0.70) / 0.30;
        lungeX = lv.x * 6 * z * (1 - rp);
        lungeY = lv.y * 6 * z * (1 - rp);
      }
    } else {
      if (player._dashTrail && player._dashTrail.length > 0) {
        player._dashTrail = [];
      }
    }

    // Mage Levitating Hover Dynamics (gently floats above ground when idle)
    const hoverBob = (!isMoving && !isAttacking && !isDashing)
      ? Math.sin(t * 3.2) * 3.2 * z
      : 0;

    // Ground Arcane Levitation Shadow
    ctx.save();
    const shadowScale = (!isMoving && !isAttacking && !isDashing)
      ? (1.0 - (hoverBob / (18 * z)))
      : 1.0;
    ctx.beginPath();
    ctx.ellipse(screen.x + lungeX, screen.y + lungeY, 14 * z * shadowScale, 6.5 * z * shadowScale, 0.28, 0, Math.PI * 2);
    ctx.fillStyle = isDashing ? 'rgba(15, 23, 42, 0.2)' : 'rgba(15, 23, 42, 0.38)';
    ctx.fill();
    ctx.restore();

    // Local Hero Selection Ring
    if (isLocal) {
      const ringPulse = Math.sin(t * 4) * 1.5 * z;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 18 * z + ringPulse, 9 * z + ringPulse * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    const isFacingLeft = (facing === 'W' || facing === 'NW' || facing === 'SW' || (isDashing && lv.x < 0) || (isAttacking && lv.x < 0));

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (isDashing && this.sprites.mageDash && this.sprites.mageDash.complete && this.sprites.mageDash.naturalWidth > 0) {
      // 1. DASH STATE (Arcane Blink)
      const dashFrames = IsometricRenderer.MAGE_DASH_FRAMES;
      let dFrameIdx = 0;
      if (dashProg < 0.18) dFrameIdx = 0;
      else if (dashProg < 0.48) dFrameIdx = 1;
      else if (dashProg < 0.78) dFrameIdx = 2;
      else dFrameIdx = 3;

      const curDFrame = dashFrames[dFrameIdx];
      const dw = curDFrame.sw * baseScale;
      const dh = curDFrame.sh * baseScale;
      const dx = -curDFrame.anchorX * baseScale;
      const dy = -curDFrame.anchorY * baseScale;

      // Arcane Blink Ghost Afterimages (Phantom Echoes)
      if (player._dashTrail && player._dashTrail.length > 1) {
        for (let i = 1; i < player._dashTrail.length; i++) {
          const ghost = player._dashTrail[i];
          const ghostAge = (performance.now() - ghost.time) / 320;
          if (ghostAge < 1.0) {
            ctx.save();
            ctx.globalAlpha = (1.0 - ghostAge) * (i === 1 ? 0.45 : i === 2 ? 0.26 : 0.12);
            ctx.translate(ghost.x, ghost.y);
            if (isFacingLeft) ctx.scale(-1, 1);
            ctx.drawImage(this.sprites.mageDash, curDFrame.sx, curDFrame.sy, curDFrame.sw, curDFrame.sh, dx, dy, dw, dh);
            ctx.fillStyle = 'rgba(168, 85, 247, 0.32)';
            ctx.fillRect(dx, dy, dw, dh);
            ctx.restore();
          }
        }
      }

      ctx.save();
      ctx.translate(screen.x + lungeX, screen.y + lungeY - verticalOffset);
      if (isFacingLeft) ctx.scale(-1, 1);
      ctx.drawImage(this.sprites.mageDash, curDFrame.sx, curDFrame.sy, curDFrame.sw, curDFrame.sh, dx, dy, dw, dh);
      ctx.restore();

      // Cosmic Blink Streaks
      ctx.save();
      const streakAngle = Math.atan2(lv.y, lv.x);
      ctx.translate(screen.x + lungeX, screen.y + lungeY - 14 * z);
      ctx.rotate(streakAngle);
      for (let s = -1; s <= 1; s++) {
        ctx.beginPath();
        ctx.moveTo(-24 * z, s * 9 * z);
        ctx.lineTo(22 * z, s * 9 * z);
        ctx.strokeStyle = `rgba(192, 132, 252, ${0.85 - Math.abs(s) * 0.25})`;
        ctx.lineWidth = 2.2 * z;
        ctx.stroke();
      }
      ctx.restore();

    } else if (isAttacking && this.sprites.mageAttack && this.sprites.mageAttack.complete && this.sprites.mageAttack.naturalWidth > 0) {
      // 2. ATTACK STATE (Arcane Beam / Burst Cast)
      const attackFrames = IsometricRenderer.MAGE_ATTACK_FRAMES;
      let aFrameIdx = 0;
      if (attackProg < 0.22) aFrameIdx = 0;
      else if (attackProg < 0.52) aFrameIdx = 1;
      else if (attackProg < 0.80) aFrameIdx = 2;
      else aFrameIdx = 3;

      const curAFrame = attackFrames[aFrameIdx];
      const dw = curAFrame.sw * baseScale;
      const dh = curAFrame.sh * baseScale;
      const dx = -curAFrame.anchorX * baseScale;
      const dy = -curAFrame.anchorY * baseScale;

      ctx.save();
      ctx.translate(screen.x + lungeX, screen.y + lungeY - verticalOffset);
      if (isFacingLeft) ctx.scale(-1, 1);
      ctx.drawImage(this.sprites.mageAttack, curAFrame.sx, curAFrame.sy, curAFrame.sw, curAFrame.sh, dx, dy, dw, dh);
      ctx.restore();

      // Swirling Arcane Rune Circle under feet during spellcast
      if (attackProg > 0.15 && attackProg < 0.85) {
        ctx.save();
        const castAlpha = Math.sin((attackProg - 0.15) / 0.70 * Math.PI);
        ctx.beginPath();
        ctx.ellipse(screen.x + lungeX, screen.y + lungeY, 20 * z, 10 * z, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(168, 85, 247, ${castAlpha * 0.75})`;
        ctx.lineWidth = 2.0 * z;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(screen.x + lungeX, screen.y + lungeY, 13 * z, 6.5 * z, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${castAlpha * 0.65})`;
        ctx.lineWidth = 1.4 * z;
        ctx.stroke();
        ctx.restore();
      }

    } else if (isMoving && this.sprites.mageRun && this.sprites.mageRun.complete && this.sprites.mageRun.naturalWidth > 0) {
      // 3. RUN STATE (Staff Dragging Sprint)
      const runFrames = IsometricRenderer.MAGE_RUN_FRAMES;
      const runIdx = Math.floor((t * 7.5) % 4);
      const rFrame = runFrames[runIdx];

      const dw = rFrame.sw * baseScale;
      const dh = rFrame.sh * baseScale;
      const dx = -rFrame.anchorX * baseScale;
      const dy = -rFrame.anchorY * baseScale;

      const flipRun = (facing === 'W' || facing === 'NW' || facing === 'SW' || lv.x < -0.2);

      ctx.save();
      ctx.translate(screen.x, screen.y);
      if (flipRun) ctx.scale(-1, 1);
      ctx.drawImage(this.sprites.mageRun, rFrame.sx, rFrame.sy, rFrame.sw, rFrame.sh, dx, dy, dw, dh);
      ctx.restore();

      // Crystal Staff Ground Wake: Cyan mana sparks and stardust trailing where staff tip drags
      const staffTipX = player.x + (flipRun ? 0.35 : -0.35);
      const staffTipY = player.y + 0.1;
      if (Math.random() < 0.28) {
        this.addParticles(staffTipX, staffTipY, 'arcane', 1);
      }
      if (Math.random() < 0.02) {
        this.addParticles(player.x, player.y, 'dust', 1);
      }

    } else if (this.sprites.mageIdle && this.sprites.mageIdle.complete && this.sprites.mageIdle.naturalWidth > 0) {
      // 4. IDLE STATE (Living Arcane Levitation & Breathing)
      const idleFrames = IsometricRenderer.MAGE_IDLE_FRAMES;
      const idleFrameIdx = Math.floor((t * 2.2) % 4);
      const iFrame = idleFrames[idleFrameIdx];

      const dw = iFrame.sw * baseScale;
      const dh = iFrame.sh * baseScale;
      const dx = -iFrame.anchorX * baseScale;
      const dy = -iFrame.anchorY * baseScale;

      ctx.save();
      ctx.translate(screen.x, screen.y - hoverBob);
      if (isFacingLeft) ctx.scale(-1, 1);
      ctx.drawImage(this.sprites.mageIdle, iFrame.sx, iFrame.sy, iFrame.sw, iFrame.sh, dx, dy, dw, dh);
      ctx.restore();

      // Orbiting Celestial Stardust Mote
      const orbitAngle = t * 3.5;
      const orbRadiusX = 14 * z;
      const orbRadiusY = 6 * z;
      const orbX = screen.x + Math.cos(orbitAngle) * orbRadiusX;
      const orbY = screen.y - 28 * z - hoverBob + Math.sin(orbitAngle) * orbRadiusY;
      ctx.save();
      ctx.beginPath();
      ctx.arc(orbX, orbY, 2.4 * z, 0, Math.PI * 2);
      ctx.fillStyle = '#67e8f9';
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 8 * z;
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // Arcane Cast Blast Arc (Explosive starlight discharge in front of staff)
    if (isAttacking && attackProg > 0.20 && attackProg < 0.75) {
      ctx.save();
      const beamAngle = Math.atan2(lv.y, lv.x);
      ctx.translate(screen.x + lungeX + lv.x * 14 * z, screen.y + lungeY + lv.y * 9 * z - 20 * z);
      ctx.rotate(beamAngle);

      const beamProg = (attackProg - 0.20) / 0.55;
      const alpha = Math.sin(beamProg * Math.PI);

      // Arcane Beam Aura
      ctx.beginPath();
      ctx.ellipse(12 * z, 0, 18 * z, 6 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(192, 132, 252, ${alpha * 0.7})`;
      ctx.fill();

      // Starlight Core
      ctx.beginPath();
      ctx.ellipse(12 * z, 0, 14 * z, 3 * z, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
      ctx.fill();

      ctx.restore();
    }

    // Overhead Nametag, Guild Badge & Mini HP Bar
    this.drawEntityOverhead(ctx, screen.x, screen.y - 54 * z, player.name, player.hp, player.maxHp, isLocal ? '#38bdf8' : '#fff', `Lv.${player.level}`);

    // Speech Bubble
    if (player.speechBubble) {
      this.drawSpeechBubble(ctx, screen.x, screen.y - 78 * z, player.speechBubble);
    }
  }

  // Authentic Pixel Art Rogue Renderer (Dual Dagger Stealth, Cross Cleave, Shadow Dive & Reverse Grip Sprint)
  drawRogue(ctx, player, isLocal, screen, z, t) {
    const isMoving = !!player.isMoving;

    // 1. DASH STATE (Shadow Dive / Smoke Dash)
    const dash = this.dashes ? this.dashes.get(player.id) : null;
    const isDashing = dash && (performance.now() - dash.time < dash.duration);
    const dashProg = isDashing ? (performance.now() - dash.time) / dash.duration : 0;

    // 2. ATTACK STATE (Dual Dagger Cross Cleave)
    const attack = this.attacks ? this.attacks.get(player.id) : null;
    const isAttacking = attack && (performance.now() - attack.time < attack.duration);
    const attackProg = isAttacking ? (performance.now() - attack.time) / attack.duration : 0;

    // Facing direction: during attack or dash, lock facing towards action direction!
    const facing = (isAttacking && attack.facing)
      ? attack.facing
      : ((isDashing && dash.facing) ? dash.facing : (player.facing || 'S'));

    const baseScale = 0.205 * z;

    // 8-Directional Lunge & Facing Vectors
    const lungeVecs = {
      S:  { x: 0,      y: 1.0 },
      SE: { x: 0.89,   y: 0.45 },
      E:  { x: 1.0,    y: 0.0 },
      NE: { x: 0.89,   y: -0.45 },
      N:  { x: 0,      y: -1.0 },
      NW: { x: -0.89,  y: -0.45 },
      W:  { x: -1.0,   y: 0.0 },
      SW: { x: -0.89,  y: 0.45 }
    };
    const lv = lungeVecs[facing] || lungeVecs.S;

    let lungeX = 0;
    let lungeY = 0;
    let verticalOffset = 0;

    if (isDashing) {
      const dashImpulse = Math.sin(dashProg * Math.PI);
      lungeX = lv.x * 16 * z * dashImpulse;
      lungeY = lv.y * 16 * z * dashImpulse;
      verticalOffset = 3.5 * z; // Low shadow crouch

      player._dashTrail = player._dashTrail || [];
      player._dashTrail.unshift({
        x: screen.x + lungeX,
        y: screen.y + lungeY - verticalOffset,
        facing,
        time: performance.now()
      });
      if (player._dashTrail.length > 5) player._dashTrail.pop();

      if (Math.random() < 0.45) {
        this.addParticles(player.x, player.y, 'shadow', 2);
      }
    } else if (isAttacking) {
      if (attackProg < 0.22) {
        const wp = attackProg / 0.22;
        lungeX = -lv.x * 4 * z * wp;
        lungeY = -lv.y * 4 * z * wp;
        verticalOffset = -1.0 * z * wp;
      } else if (attackProg <= 0.68) {
        const sp = (attackProg - 0.22) / 0.46;
        const strikeThrust = Math.sin(sp * Math.PI);
        lungeX = lv.x * 16 * z * strikeThrust;
        lungeY = lv.y * 16 * z * strikeThrust;
        verticalOffset = 2.0 * z * strikeThrust;
      } else {
        const rp = (attackProg - 0.68) / 0.32;
        lungeX = lv.x * 7 * z * (1 - rp);
        lungeY = lv.y * 7 * z * (1 - rp);
      }
    } else {
      if (player._dashTrail && player._dashTrail.length > 0) {
        player._dashTrail = [];
      }
    }

    // Agile Foot Contact Shadows
    ctx.save();
    const shadowAngle = 0.28;
    ctx.beginPath();
    ctx.ellipse(screen.x + lungeX, screen.y + lungeY, 14 * z, 6.0 * z, shadowAngle, 0, Math.PI * 2);
    ctx.fillStyle = isDashing ? 'rgba(0, 0, 0, 0.22)' : 'rgba(0, 0, 0, 0.38)';
    ctx.fill();
    ctx.restore();

    // Local Hero Selection Ring
    if (isLocal) {
      const ringPulse = Math.sin(t * 4) * 1.5 * z;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 18 * z + ringPulse, 9 * z + ringPulse * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    const isFacingLeft = (facing === 'W' || facing === 'NW' || facing === 'SW' || (isDashing && lv.x < 0) || (isAttacking && lv.x < 0));

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (isDashing && this.sprites.rogueDash && this.sprites.rogueDash.complete && this.sprites.rogueDash.naturalWidth > 0) {
      // 1. DASH STATE (Shadow Dive)
      const dashFrames = IsometricRenderer.ROGUE_DASH_FRAMES;
      let dFrameIdx = 0;
      if (dashProg < 0.18) dFrameIdx = 0;
      else if (dashProg < 0.48) dFrameIdx = 1;
      else if (dashProg < 0.78) dFrameIdx = 2;
      else dFrameIdx = 3;

      const curDFrame = dashFrames[dFrameIdx];
      const dw = curDFrame.sw * baseScale;
      const dh = curDFrame.sh * baseScale;
      const dx = -curDFrame.anchorX * baseScale;
      const dy = -curDFrame.anchorY * baseScale;

      // Rogue Shadow Afterimages
      if (player._dashTrail && player._dashTrail.length > 1) {
        for (let i = 1; i < player._dashTrail.length; i++) {
          const ghost = player._dashTrail[i];
          const ghostAge = (performance.now() - ghost.time) / 320;
          if (ghostAge < 1.0) {
            ctx.save();
            ctx.globalAlpha = (1.0 - ghostAge) * (i === 1 ? 0.46 : i === 2 ? 0.26 : 0.12);
            ctx.translate(ghost.x, ghost.y);
            if (isFacingLeft) ctx.scale(-1, 1);
            ctx.drawImage(this.sprites.rogueDash, curDFrame.sx, curDFrame.sy, curDFrame.sw, curDFrame.sh, dx, dy, dw, dh);
            ctx.fillStyle = 'rgba(34, 197, 94, 0.28)';
            ctx.fillRect(dx, dy, dw, dh);
            ctx.restore();
          }
        }
      }

      ctx.save();
      ctx.translate(screen.x + lungeX, screen.y + lungeY - verticalOffset);
      if (isFacingLeft) ctx.scale(-1, 1);
      ctx.drawImage(this.sprites.rogueDash, curDFrame.sx, curDFrame.sy, curDFrame.sw, curDFrame.sh, dx, dy, dw, dh);
      ctx.restore();

      // Shadow Speed Lines
      ctx.save();
      const streakAngle = Math.atan2(lv.y, lv.x);
      ctx.translate(screen.x + lungeX, screen.y + lungeY - 12 * z);
      ctx.rotate(streakAngle);
      for (let s = -1; s <= 1; s++) {
        ctx.beginPath();
        ctx.moveTo(-22 * z, s * 8 * z);
        ctx.lineTo(20 * z, s * 8 * z);
        ctx.strokeStyle = `rgba(74, 222, 128, ${0.80 - Math.abs(s) * 0.25})`;
        ctx.lineWidth = 2.0 * z;
        ctx.stroke();
      }
      ctx.restore();

    } else if (isAttacking && this.sprites.rogueAttack && this.sprites.rogueAttack.complete && this.sprites.rogueAttack.naturalWidth > 0) {
      // 2. ATTACK STATE (Dual Dagger Cross Cleave)
      const attackFrames = IsometricRenderer.ROGUE_ATTACK_FRAMES;
      let aFrameIdx = 0;
      if (attackProg < 0.20) aFrameIdx = 0;
      else if (attackProg < 0.50) aFrameIdx = 1;
      else if (attackProg < 0.78) aFrameIdx = 2;
      else aFrameIdx = 3;

      const curAFrame = attackFrames[aFrameIdx];
      const dw = curAFrame.sw * baseScale;
      const dh = curAFrame.sh * baseScale;
      const dx = -curAFrame.anchorX * baseScale;
      const dy = -curAFrame.anchorY * baseScale;

      ctx.save();
      ctx.translate(screen.x + lungeX, screen.y + lungeY - verticalOffset);
      if (isFacingLeft) ctx.scale(-1, 1);
      ctx.drawImage(this.sprites.rogueAttack, curAFrame.sx, curAFrame.sy, curAFrame.sw, curAFrame.sh, dx, dy, dw, dh);
      ctx.restore();

    } else if (isMoving && this.sprites.rogueRun && this.sprites.rogueRun.complete && this.sprites.rogueRun.naturalWidth > 0) {
      // 3. RUN STATE (Reverse-Grip Ninja Sprint Dragging Daggers)
      const runFrames = IsometricRenderer.ROGUE_RUN_FRAMES;
      const runIdx = Math.floor((t * 9.0) % 4);
      const rFrame = runFrames[runIdx];

      const dw = rFrame.sw * baseScale;
      const dh = rFrame.sh * baseScale;
      const dx = -rFrame.anchorX * baseScale;
      const dy = -rFrame.anchorY * baseScale;

      const flipRun = (facing === 'W' || facing === 'NW' || facing === 'SW' || lv.x < -0.2);
      const runLean = 0.12 * (flipRun ? -1 : 1);
      const runBob = Math.abs(Math.sin(t * 18)) * 2.4 * z;

      ctx.save();
      ctx.translate(screen.x, screen.y - runBob);
      ctx.rotate(runLean);
      if (flipRun) ctx.scale(-1, 1);
      ctx.drawImage(this.sprites.rogueRun, rFrame.sx, rFrame.sy, rFrame.sw, rFrame.sh, dx, dy, dw, dh);
      ctx.restore();

      // Poison sparks scratching the ground behind the sprinting rogue
      const daggerTipX = player.x + (flipRun ? 0.32 : -0.32);
      const daggerTipY = player.y + 0.1;
      if (Math.random() < 0.32) {
        this.addParticles(daggerTipX, daggerTipY, 'slash', 1);
      }
      if (Math.random() < 0.03) {
        this.addParticles(player.x, player.y, 'dust', 1);
      }

    } else if (this.sprites.rogueIdle && this.sprites.rogueIdle.complete && this.sprites.rogueIdle.naturalWidth > 0) {
      // 4. IDLE STATE (Living Stealth Crouch & Dagger Flipping)
      const idleFrames = IsometricRenderer.ROGUE_IDLE_FRAMES;
      const idleFrameIdx = Math.floor((t * 2.5) % 4);
      const iFrame = idleFrames[idleFrameIdx];

      const dw = iFrame.sw * baseScale;
      const dh = iFrame.sh * baseScale;
      const dx = -iFrame.anchorX * baseScale;
      const dy = -iFrame.anchorY * baseScale;

      const idleBreath = Math.sin(t * 3.0) * 0.8 * z;

      ctx.save();
      ctx.translate(screen.x, screen.y - idleBreath);
      if (isFacingLeft) ctx.scale(-1, 1);
      ctx.drawImage(this.sprites.rogueIdle, iFrame.sx, iFrame.sy, iFrame.sw, iFrame.sh, dx, dy, dw, dh);
      ctx.restore();

      // Poison Green Specular Dagger Gleam
      const gleamCycle = (t % 2.4);
      if (gleamCycle < 0.38) {
        const gp = gleamCycle / 0.38;
        const glintX = screen.x + (isFacingLeft ? -6 : 6) * z;
        const glintY = screen.y - (22 - gp * 12) * z;
        ctx.save();
        ctx.beginPath();
        ctx.arc(glintX, glintY, 2.5 * z * Math.sin(gp * Math.PI), 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 8 * z;
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();

    // Toxic Green 'X' Cross Cleave Visual Slash Effect in Front
    if (isAttacking && attackProg > 0.15 && attackProg < 0.82) {
      ctx.save();
      const slashAngle = Math.atan2(lv.y, lv.x);
      ctx.translate(screen.x + lungeX + lv.x * 12 * z, screen.y + lungeY + lv.y * 8 * z - 18 * z);
      ctx.rotate(slashAngle);

      const xProg = (attackProg - 0.15) / 0.67;
      const alpha = Math.sin(xProg * Math.PI);

      // Slash 1: Diagonal \
      ctx.beginPath();
      ctx.moveTo(-16 * z, -16 * z);
      ctx.lineTo(16 * z, 16 * z);
      ctx.strokeStyle = `rgba(34, 197, 94, ${alpha * 0.95})`;
      ctx.lineWidth = 3.5 * z;
      ctx.stroke();

      // Slash 2: Diagonal /
      ctx.beginPath();
      ctx.moveTo(-16 * z, 16 * z);
      ctx.lineTo(16 * z, -16 * z);
      ctx.strokeStyle = `rgba(74, 222, 128, ${alpha * 0.95})`;
      ctx.lineWidth = 3.5 * z;
      ctx.stroke();

      // Razor White Core Intersection
      ctx.beginPath();
      ctx.arc(0, 0, 4.5 * z, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 10 * z;
      ctx.fill();

      ctx.restore();
    }

    // Overhead Nametag, Guild Badge & Mini HP Bar
    this.drawEntityOverhead(ctx, screen.x, screen.y - 54 * z, player.name, player.hp, player.maxHp, isLocal ? '#38bdf8' : '#fff', `Lv.${player.level}`);

    // Speech Bubble
    if (player.speechBubble) {
      this.drawSpeechBubble(ctx, screen.x, screen.y - 78 * z, player.speechBubble);
    }
  }

  // Draw Monsters / Mobs
  drawMob(ctx, mob, isSelected) {
    const screen = Isometric.worldToScreen(mob.x, mob.y, 0, this.camera, this.canvas.width, this.canvas.height);
    const z = this.camera.zoom;
    const isBoss = mob.isBoss;

    // Shadow
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, (isBoss ? 28 : 14) * z, (isBoss ? 14 : 7) * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Commander Aura on Ground
    if (mob.isCommander && mob.auraRadius > 0) {
      const auraPulse = Math.sin(this.animations.time * 3) * 0.12 + 0.88;
      const auraR = mob.auraRadius * TILE_WIDTH * 0.5 * z;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, auraR, auraR * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245, 158, 11, ${0.45 * auraPulse})`;
      ctx.lineWidth = 2.5 * z;
      ctx.stroke();

      ctx.fillStyle = `rgba(245, 158, 11, ${0.06 * auraPulse})`;
      ctx.fill();

      // Rotating heraldry ticks on aura perimeter
      const auraRot = this.animations.time * 0.8;
      for (let i = 0; i < 6; i++) {
        const ang = auraRot + (i * Math.PI / 3);
        const ax = screen.x + Math.cos(ang) * auraR;
        const ay = screen.y + Math.sin(ang) * (auraR * 0.5);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(ax - 2 * z, ay - 2 * z, 4 * z, 4 * z);
      }
      ctx.restore();
    }

    if (mob.hasCommanderBuff) {
      // War buff ring under minions buffed by commander
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, 18 * z, 9 * z, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();
      ctx.restore();
    }

    // Target Selection Reticle (Pulsing Lock-on Indicator)
    if (isSelected) {
      const pulse = Math.sin(this.animations.time * 8) * 2 * z;
      const rx = (isBoss ? 36 : 20) * z + pulse;
      const ry = (isBoss ? 18 : 10) * z + (pulse * 0.5);

      // Outer Glow Ring
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5 * z;
      ctx.stroke();

      // Inner Rotating Lock Bracket Ticks
      const rot = this.animations.time * 2;
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(rot);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2 * z;
      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI) / 2;
        const tx = Math.cos(ang) * (rx + 4 * z);
        const ty = Math.sin(ang) * (ry + 2 * z);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx * 0.8, ty * 0.8);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(screen.x, screen.y);

    if (mob.type === 'slime') {
      // Slime Jelly Wobble
      const wobble = Math.sin(this.animations.time * 8 + mob.x) * 3 * z;
      ctx.beginPath();
      ctx.ellipse(0, -12 * z, (15 * z) + wobble, (12 * z) - wobble, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.fill();
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Eyes
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-4 * z, -14 * z, 2.5 * z, 0, Math.PI * 2);
      ctx.arc(4 * z, -14 * z, 2.5 * z, 0, Math.PI * 2);
      ctx.fill();
    } else if (mob.type === 'goblin') {
      // Goblin
      ctx.fillStyle = '#15803d'; // Green skin
      ctx.fillRect(-7 * z, -24 * z, 14 * z, 16 * z);
      // Pointy Ears
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.moveTo(-12 * z, -22 * z);
      ctx.lineTo(-7 * z, -26 * z);
      ctx.lineTo(-7 * z, -18 * z);
      ctx.closePath();
      ctx.fill();
      // Club Weapon
      ctx.fillStyle = '#78350f';
      ctx.fillRect(8 * z, -30 * z, 5 * z, 22 * z);
    } else if (mob.type === 'skeleton') {
      // Skeleton Bones
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-5 * z, -22 * z, 10 * z, 14 * z);
      // Skull
      ctx.beginPath();
      ctx.arc(0, -28 * z, 7 * z, 0, Math.PI * 2);
      ctx.fill();
      // Glowing Red Eye Sockets
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-3 * z, -29 * z, 2 * z, 2 * z);
      ctx.fillRect(1 * z, -29 * z, 2 * z, 2 * z);
    } else if (mob.type === 'golem') {
      // Massive Titan Golem Boss
      ctx.fillStyle = '#475569';
      ctx.fillRect(-22 * z, -50 * z, 44 * z, 38 * z);
      // Stone Head
      ctx.fillStyle = '#334155';
      ctx.fillRect(-12 * z, -64 * z, 24 * z, 16 * z);
      // Glowing Arcane Rune Chest Core
      const corePulse = Math.sin(this.animations.time * 6) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(6, 182, 212, ${corePulse})`;
      ctx.beginPath();
      ctx.arc(0, -32 * z, 8 * z, 0, Math.PI * 2);
      ctx.fill();
      // Massive Fists
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-28 * z, -36 * z, 10 * z, 20 * z);
      ctx.fillRect(18 * z, -36 * z, 10 * z, 20 * z);
    } else if (mob.type === 'frost_wolf') {
      // Frostbite Wolf (Quadruped white/cyan wolf)
      // Torso
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-10 * z, -16 * z, 20 * z, 10 * z);
      // Fur ruff on back
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(-8 * z, -16 * z);
      ctx.lineTo(0, -22 * z);
      ctx.lineTo(8 * z, -16 * z);
      ctx.closePath();
      ctx.fill();
      // Head
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(8 * z, -18 * z, 6 * z, 0, Math.PI * 2);
      ctx.fill();
      // Pointed Wolf Ears
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(6 * z, -23 * z);
      ctx.lineTo(10 * z, -28 * z);
      ctx.lineTo(11 * z, -22 * z);
      ctx.closePath();
      ctx.fill();
      // Glowing Cyan Eye
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(9 * z, -19 * z, 2.5 * z, 2.5 * z);
      // Wolf Tail
      const tailWag = Math.sin(this.animations.time * 8) * 3 * z;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3 * z;
      ctx.beginPath();
      ctx.moveTo(-10 * z, -14 * z);
      ctx.lineTo(-16 * z, -20 * z + tailWag);
      ctx.stroke();
    } else if (mob.type === 'ice_elemental') {
      // Glacial Elemental (Floating crystalline torso with orbiting shards)
      const floatY = Math.sin(this.animations.time * 4 + mob.x) * 4 * z;
      ctx.save();
      ctx.translate(0, -20 * z + floatY);

      // Radial Cyan Core Aura
      const coreAura = ctx.createRadialGradient(0, 0, 2 * z, 0, 0, 18 * z);
      coreAura.addColorStop(0, 'rgba(103, 232, 249, 0.9)');
      coreAura.addColorStop(0.6, 'rgba(2, 132, 199, 0.4)');
      coreAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = coreAura;
      ctx.beginPath();
      ctx.arc(0, 0, 18 * z, 0, Math.PI * 2);
      ctx.fill();

      // Sharp Crystalline Diamond
      ctx.beginPath();
      ctx.moveTo(0, -14 * z);
      ctx.lineTo(10 * z, 0);
      ctx.lineTo(0, 16 * z);
      ctx.lineTo(-10 * z, 0);
      ctx.closePath();
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();

      // Orbiting ice shards
      for (let i = 0; i < 3; i++) {
        const shardAngle = this.animations.time * 3 + (i * Math.PI * 2 / 3);
        const sx = Math.cos(shardAngle) * 16 * z;
        const sy = Math.sin(shardAngle) * 8 * z;
        ctx.fillStyle = '#bae6fd';
        ctx.fillRect(sx - 2 * z, sy - 2 * z, 4 * z, 4 * z);
      }
      ctx.restore();
    } else if (mob.type === 'frost_titan') {
      // Frost Titan Ymir Boss
      // Giant Stone Frost Torso
      ctx.fillStyle = '#334155';
      ctx.fillRect(-24 * z, -54 * z, 48 * z, 42 * z);
      // Ice Spikes on Shoulders
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(-24 * z, -54 * z);
      ctx.lineTo(-32 * z, -70 * z);
      ctx.lineTo(-18 * z, -54 * z);
      ctx.moveTo(24 * z, -54 * z);
      ctx.lineTo(32 * z, -70 * z);
      ctx.lineTo(18 * z, -54 * z);
      ctx.fill();
      // Titan Head with Glacial Horns
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-14 * z, -70 * z, 28 * z, 18 * z);
      // Glowing Cyan Titan Eyes
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(-8 * z, -64 * z, 5 * z, 3 * z);
      ctx.fillRect(3 * z, -64 * z, 5 * z, 3 * z);
      // Glowing Ice Rune Core on Chest
      const titanPulse = Math.sin(this.animations.time * 5) * 0.2 + 0.8;
      ctx.fillStyle = `rgba(56, 189, 248, ${titanPulse})`;
      ctx.beginPath();
      ctx.arc(0, -34 * z, 9 * z, 0, Math.PI * 2);
      ctx.fill();
      // Frozen Spiked Club in Right Hand
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(24 * z, -60 * z, 8 * z, 42 * z);
    }

    ctx.restore();

    // Overhead tag with Affix Badges
    const overheadY = screen.y - (isBoss ? 75 : 44) * z;
    this.drawEntityOverhead(ctx, screen.x, overheadY, mob.name, mob.hp, mob.maxHp, isBoss ? '#f59e0b' : '#fca5a5', `Lv.${mob.level}`, mob.buffs, mob.isCommander, mob.hasCommanderBuff);

    // Bouncing overhead lock pointer for selected target
    if (isSelected) {
      const arrowBounce = Math.sin(this.animations.time * 10) * 3 * z;
      const arrowY = overheadY - 14 * z + arrowBounce;
      ctx.save();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(screen.x, arrowY + 6 * z);
      ctx.lineTo(screen.x - 6 * z, arrowY - 4 * z);
      ctx.lineTo(screen.x + 6 * z, arrowY - 4 * z);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Draw Overhead Name & Health Bar & Affixes
  drawEntityOverhead(ctx, screenX, screenY, name, hp, maxHp, nameColor = '#fff', levelTag = '', buffs = [], isCommander = false, hasCommanderBuff = false) {
    ctx.save();
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.textAlign = 'center';

    let titlePrefix = '';
    if (isCommander) {
      titlePrefix = '👑 [Commander] ';
      nameColor = '#facc15';
    }

    // Name text
    ctx.fillStyle = '#000';
    ctx.fillText(`${titlePrefix}${levelTag} ${name}`, screenX + 1, screenY + 1);
    ctx.fillStyle = nameColor;
    ctx.fillText(`${titlePrefix}${levelTag} ${name}`, screenX, screenY);

    // Mini Health Bar
    const barW = isCommander ? 46 : 38;
    const barH = 5;
    const barX = screenX - barW / 2;
    const barY = screenY + 4;
    const hpRatio = Math.max(0, Math.min(1, hp / maxHp));

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(barX, barY, barW, barH);

    ctx.fillStyle = isCommander ? '#f59e0b' : '#22c55e';
    ctx.fillRect(barX, barY, barW * hpRatio, barH);

    // Draw Affix / Buff Badges above name
    if ((buffs && buffs.length > 0) || hasCommanderBuff) {
      const icons = [];
      if (hasCommanderBuff) icons.push({ icon: '⚔️', color: '#fde047' });
      if (buffs) {
        if (buffs.includes('fortified')) icons.push({ icon: '🛡️', color: '#94a3b8' });
        if (buffs.includes('frostbite')) icons.push({ icon: '❄️', color: '#38bdf8' });
        if (buffs.includes('venomous')) icons.push({ icon: '☠️', color: '#4ade80' });
        if (buffs.includes('ignited')) icons.push({ icon: '🔥', color: '#fb923c' });
      }

      const iconSpacing = 16;
      const startX = screenX - ((icons.length - 1) * iconSpacing) / 2;
      const badgeY = screenY - 12;

      ctx.font = '10px sans-serif';
      icons.forEach((ic, idx) => {
        const ix = startX + idx * iconSpacing;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.beginPath();
        ctx.arc(ix, badgeY, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = ic.color;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillText(ic.icon, ix, badgeY + 3.5);
      });
    }

    ctx.restore();
  }

  // Draw Comic Speech Bubble
  drawSpeechBubble(ctx, screenX, screenY, text) {
    ctx.save();
    ctx.font = '12px Outfit, sans-serif';
    const textMetrics = ctx.measureText(text);
    const bubbleW = Math.max(60, textMetrics.width + 16);
    const bubbleH = 26;
    const bubbleX = screenX - bubbleW / 2;
    const bubbleY = screenY - bubbleH;

    // Bubble Body
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 6);
    ctx.fill();
    ctx.stroke();

    // Tail
    ctx.beginPath();
    ctx.moveTo(screenX - 5, bubbleY + bubbleH);
    ctx.lineTo(screenX, bubbleY + bubbleH + 6);
    ctx.lineTo(screenX + 5, bubbleY + bubbleH);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();

    // Text
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, screenX, bubbleY + bubbleH / 2);

    ctx.restore();
  }

  // Draw Overlays: Click Beacon, Particles, Floating Combat Text
  drawEffects(ctx, dt) {
    const z = this.camera.zoom;

    // 1. Click-to-Move Destination Beacon
    if (this.animations.clickMarker) {
      const marker = this.animations.clickMarker;
      marker.life -= dt * 1.8;

      const screen = Isometric.worldToScreen(marker.x, marker.y, 0, this.camera, this.canvas.width, this.canvas.height);
      const ringRadius = (1.0 - marker.life) * 24 * z;
      const alpha = Math.max(0, marker.life);

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, ringRadius * 1.5, ringRadius * 0.75, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();

      if (marker.life <= 0) {
        this.animations.clickMarker = null;
      }
    }

    // 1.5. Visual Skill Effects (Whirlwind, Firestorm, Shadow Strike)
    if (this.animations.skillEffects) {
      for (let i = this.animations.skillEffects.length - 1; i >= 0; i--) {
        const fx = this.animations.skillEffects[i];
        fx.life -= dt;
        if (fx.life <= 0) {
          this.animations.skillEffects.splice(i, 1);
          continue;
        }

        const progress = 1.0 - (fx.life / fx.maxLife);
        const alpha = Math.max(0, fx.life / fx.maxLife);

        // Continuous Multi-Wave Particle Emitter for Active Skills
        fx.emitTimer = (fx.emitTimer || 0) + dt;
        if (fx.emitTimer >= 0.045) {
          fx.emitTimer = 0;
          this.emitSkillParticlesTick(fx, progress, alpha);
        }

        if (fx.type === 'sweeping_edge') {
          if (fx.x === undefined || fx.y === undefined || isNaN(fx.x) || isNaN(fx.y)) {
            continue;
          }
          // Authentic Sweeping Edge Crescent Slash Arc
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.35, this.camera, this.canvas.width, this.canvas.height);
          if (isNaN(screen.x) || isNaN(screen.y)) continue;
          const facingAngles = {
            E: 0,
            SE: Math.PI * 0.25,
            S: Math.PI * 0.5,
            SW: Math.PI * 0.75,
            W: Math.PI,
            NW: -Math.PI * 0.75,
            N: -Math.PI * 0.5,
            NE: -Math.PI * 0.25
          };
          const baseAngle = facingAngles[fx.facing] !== undefined ? facingAngles[fx.facing] : Math.PI * 0.25;
          const outerR = (26 + progress * 26) * z;
          const innerR = Math.max(6 * z, outerR - (16 + (1 - progress) * 10) * z);

          ctx.save();
          ctx.translate(screen.x, screen.y);
          ctx.rotate(baseAngle);

          const sweepSpan = Math.PI * 0.46;
          const isRogue = fx.class === 'rogue';

          // Outer glowing crescent body
          ctx.beginPath();
          ctx.arc(0, 0, outerR, -sweepSpan, sweepSpan, false);
          ctx.arc(0, 0, innerR, sweepSpan, -sweepSpan, true);
          ctx.closePath();

          const crescentGrad = ctx.createRadialGradient(0, 0, innerR, 0, 0, outerR);
          if (isRogue) {
            crescentGrad.addColorStop(0, 'rgba(168, 85, 247, 0)');
            crescentGrad.addColorStop(0.45, `rgba(147, 51, 234, ${alpha * 0.75})`);
            crescentGrad.addColorStop(0.85, `rgba(255, 255, 255, ${alpha * 0.98})`);
            crescentGrad.addColorStop(1, `rgba(34, 197, 94, ${alpha * 0.9})`);
          } else {
            crescentGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
            crescentGrad.addColorStop(0.45, `rgba(186, 230, 253, ${alpha * 0.75})`);
            crescentGrad.addColorStop(0.85, `rgba(255, 255, 255, ${alpha * 0.98})`);
            crescentGrad.addColorStop(1, `rgba(56, 189, 248, ${alpha * 0.9})`);
          }
          ctx.fillStyle = crescentGrad;
          ctx.shadowColor = isRogue ? '#a855f7' : '#38bdf8';
          ctx.shadowBlur = 14 * z;
          ctx.fill();

          // Brilliant White Razor Blade Edge
          ctx.beginPath();
          ctx.arc(0, 0, outerR, -sweepSpan, sweepSpan, false);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();

          // Sweeping wind speed trails
          for (let s = 1; s <= 2; s++) {
            const trailR = innerR + (outerR - innerR) * (s * 0.35);
            ctx.beginPath();
            ctx.arc(0, 0, trailR, -sweepSpan * 0.82, sweepSpan * 0.82, false);
            ctx.strokeStyle = isRogue ? `rgba(192, 132, 252, ${alpha * 0.75})` : `rgba(224, 242, 254, ${alpha * 0.75})`;
            ctx.lineWidth = 2 * z;
            ctx.stroke();
          }

          ctx.restore();
        } else if (fx.type === 'mage_basic_blast') {
          // Mage Incandescent Solar Arcane Burst
          if (fx.x === undefined || fx.y === undefined || isNaN(fx.x) || isNaN(fx.y)) {
            continue;
          }
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.45, this.camera, this.canvas.width, this.canvas.height);
          if (isNaN(screen.x) || isNaN(screen.y)) continue;

          const rad = (16 + progress * 24) * z;
          if (isNaN(rad) || rad <= 0) continue;

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Outer solar blast halo
          const mbGrad = ctx.createRadialGradient(screen.x, screen.y, Math.max(1, 2 * z), screen.x, screen.y, rad);
          mbGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
          mbGrad.addColorStop(0.35, `rgba(254, 240, 138, ${alpha * 0.9})`);
          mbGrad.addColorStop(0.7, `rgba(249, 115, 22, ${alpha * 0.65})`);
          mbGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
          ctx.fillStyle = mbGrad;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, rad, 0, Math.PI * 2);
          ctx.fill();

          // 4-pointed radiant stellar star flare
          const flareR = rad * 1.35;
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.lineWidth = 2 * z;
          ctx.beginPath();
          ctx.moveTo(screen.x - flareR, screen.y); ctx.lineTo(screen.x + flareR, screen.y);
          ctx.moveTo(screen.x, screen.y - flareR); ctx.lineTo(screen.x, screen.y + flareR);
          ctx.stroke();
          ctx.restore();
        } else if (fx.type === 'whirlwind') {
          // Warrior Whirlwind - Triple Razor Blade Cyclone Vortex
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.2) * 28 * z * (0.6 + progress * 0.5);
          const rot = this.animations.time * 16;

          ctx.save();
          ctx.translate(screen.x, screen.y);

          // Additive glowing wind vortex core
          ctx.beginPath();
          ctx.ellipse(0, 0, rad * 0.65, rad * 0.32, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.28})`;
          ctx.fill();

          // 3 Spinning Razor Steel / Wind Blade Arcs
          for (let b = 0; b < 3; b++) {
            const bAngle = rot + (b * Math.PI * 2 / 3);
            ctx.save();
            ctx.rotate(bAngle);

            // Outer sharp blade sweep
            ctx.beginPath();
            ctx.ellipse(0, 0, rad, rad * 0.48, 0, 0, Math.PI * 0.85);
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.95})`;
            ctx.lineWidth = 5 * z;
            ctx.stroke();

            // Blinding razor core
            ctx.beginPath();
            ctx.ellipse(0, 0, rad * 0.95, rad * 0.45, 0, 0, Math.PI * 0.7);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
            ctx.lineWidth = 2.5 * z;
            ctx.stroke();

            // Golden cutting tip glint
            const tipX = Math.cos(Math.PI * 0.85) * rad;
            const tipY = Math.sin(Math.PI * 0.85) * rad * 0.48;
            ctx.beginPath();
            ctx.arc(tipX, tipY, 4 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(250, 204, 21, ${alpha * 0.9})`;
            ctx.fill();

            ctx.restore();
          }

          // Inner Cyclone Shear Ring
          ctx.beginPath();
          ctx.ellipse(0, 0, rad * 0.45, rad * 0.22, -rot * 1.5, 0, Math.PI * 1.6);
          ctx.strokeStyle = `rgba(224, 242, 254, ${alpha * 0.85})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();

          ctx.restore();

        } else if (fx.type === 'firestorm') {
          // Mage Firestorm - Expanding Volcanic Inferno Shockwave
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.5) * 32 * z * Math.min(1.0, progress * 1.4);

          ctx.save();
          // Boiling solar plasma core
          const grad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
          grad.addColorStop(0.2, `rgba(254, 240, 138, ${alpha * 0.9})`);
          grad.addColorStop(0.5, `rgba(249, 115, 22, ${alpha * 0.75})`);
          grad.addColorStop(0.85, `rgba(220, 38, 38, ${alpha * 0.45})`);
          grad.addColorStop(1, 'rgba(127, 29, 29, 0)');

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();

          // Blazing Fire Ring Edge with animated flame tongues
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.95})`;
          ctx.lineWidth = 4.5 * z;
          ctx.stroke();

          // Inner flame vortex swirl
          const fireRot = this.animations.time * 8;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad * 0.7, rad * 0.35, fireRot, 0, Math.PI * 1.7);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();

          ctx.restore();

        } else if (fx.type === 'blade_charge') {
          // Warrior Blade Charge - Golden Steel Rush Streak & Sonic Boom
          const p1 = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const p2 = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);

          ctx.save();
          // Outer Gold Glow Speed Tunnel
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(245, 158, 11, ${alpha * 0.85})`;
          ctx.lineWidth = 14 * z;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Inner Gleaming Steel Laser Beam
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 5 * z;
          ctx.stroke();

          // Sonic Boom Rings along the dash path
          const midX = (p1.x + p2.x) * 0.5;
          const midY = (p1.y + p2.y) * 0.5;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy) || 1;
          const px = -dy / len;
          const py = dx / len;
          const cutSize = 18 * z;

          for (let c = -1; c <= 1; c++) {
            const cx = midX + (dx / len) * (c * 15 * z);
            const cy = midY + (dy / len) * (c * 15 * z);
            ctx.beginPath();
            ctx.moveTo(cx - px * cutSize, cy - py * cutSize);
            ctx.lineTo(cx + px * cutSize, cy + py * cutSize);
            ctx.strokeStyle = `rgba(254, 240, 138, ${alpha * 0.95})`;
            ctx.lineWidth = 3.5 * z;
            ctx.stroke();
          }

          // Impact shockwave flare at destination
          const flareRad = 28 * z * progress;
          ctx.beginPath();
          ctx.ellipse(p2.x, p2.y, flareRad, flareRad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251, 191, 36, ${alpha * 0.7})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();
          ctx.restore();

        } else if (fx.type === 'earthshaker') {
          // Warrior Earthshaker Slam - Molten Magma Fissures & Ground Shatter
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.4) * 26 * z * Math.min(1.0, progress * 1.5);

          ctx.save();
          // Molten crater radial gradient
          const craterGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, rad);
          craterGrad.addColorStop(0, `rgba(254, 240, 138, ${alpha * 0.9})`);
          craterGrad.addColorStop(0.35, `rgba(249, 115, 22, ${alpha * 0.7})`);
          craterGrad.addColorStop(0.75, `rgba(180, 83, 9, ${alpha * 0.4})`);
          craterGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = craterGrad;
          ctx.fill();

          // Heavy golden shockwave border
          ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.95})`;
          ctx.lineWidth = 4.5 * z;
          ctx.stroke();

          // Glowing Molten Magma Fissure Cracks
          for (let a = 0; a < 6; a++) {
            const angle = (a * Math.PI / 3) + 0.25;
            const crackLen = rad * 0.95;
            const midCrackX = screen.x + Math.cos(angle) * (crackLen * 0.5) + (Math.sin(a * 4) * 6 * z);
            const midCrackY = screen.y + Math.sin(angle) * (crackLen * 0.25) + (Math.cos(a * 4) * 4 * z);
            const endCrackX = screen.x + Math.cos(angle) * crackLen;
            const endCrackY = screen.y + Math.sin(angle) * (crackLen * 0.5);

            // Outer dark stone fissure
            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y);
            ctx.lineTo(midCrackX, midCrackY);
            ctx.lineTo(endCrackX, endCrackY);
            ctx.strokeStyle = `rgba(69, 26, 3, ${alpha * 0.95})`;
            ctx.lineWidth = 4 * z;
            ctx.stroke();

            // Inner molten lava glow
            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y);
            ctx.lineTo(midCrackX, midCrackY);
            ctx.lineTo(endCrackX, endCrackY);
            ctx.strokeStyle = `rgba(254, 240, 138, ${alpha * 0.98})`;
            ctx.lineWidth = 1.8 * z;
            ctx.stroke();
          }
          ctx.restore();

        } else if (fx.type === 'frost_nova') {
          // Mage Frost Nova - Ancient Glacial Rune Circle & 3D Crystal Ice Spires
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.0) * 24 * z * Math.min(1.0, progress * 1.6);
          const frostRot = this.animations.time * 2.5;

          ctx.save();
          // Crystalline ice blue radial aura
          const iceGrad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          iceGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.95})`);
          iceGrad.addColorStop(0.3, `rgba(186, 230, 253, ${alpha * 0.75})`);
          iceGrad.addColorStop(0.7, `rgba(56, 189, 248, ${alpha * 0.45})`);
          iceGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = iceGrad;
          ctx.fill();

          // Frost Rune Compass Outer Ring
          ctx.strokeStyle = `rgba(186, 230, 253, ${alpha * 0.95})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();

          // Inner rotating frost sigil ring
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad * 0.65, rad * 0.32, frostRot, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();

          // 8 Expanding 3D Crystalline Ice Spires
          for (let a = 0; a < 8; a++) {
            const angle = (a * Math.PI / 4) + frostRot;
            const spireBaseX = screen.x + Math.cos(angle) * (rad * 0.65);
            const spireBaseY = screen.y + Math.sin(angle) * (rad * 0.32);
            const spireTipX = screen.x + Math.cos(angle) * (rad * 1.15);
            const spireTipY = screen.y + Math.sin(angle) * (rad * 0.58) - (14 * z * Math.sin(progress * Math.PI));

            ctx.beginPath();
            ctx.moveTo(spireBaseX - 3 * z, spireBaseY);
            ctx.lineTo(spireTipX, spireTipY);
            ctx.lineTo(spireBaseX + 3 * z, spireBaseY);
            ctx.closePath();
            ctx.fillStyle = `rgba(186, 230, 253, ${alpha * 0.85})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
            ctx.lineWidth = 1.5 * z;
            ctx.stroke();
          }
          ctx.restore();
        } else if (fx.type === 'arcane_blink') {
          // Mage Arcane Blink - Cosmic Portal Rifts & Spatial Distortion
          const p1 = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const p2 = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Outer Celestial Energy Rush Beam
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.85})`;
          ctx.lineWidth = 10 * z;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Blinding Incandescent Core Laser
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 3.5 * z;
          ctx.stroke();

          // Origin Collapsing Dimensional Rift
          const r1 = 26 * z * (1.0 - progress);
          ctx.beginPath();
          ctx.ellipse(p1.x, p1.y, r1, r1 * 0.5, this.animations.time * 8, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.95})`;
          ctx.lineWidth = 3 * z;
          ctx.stroke();

          // Destination Expanding Cosmic Nova Portal
          const r2 = 34 * z * Math.min(1.0, progress * 1.5);
          const destGrad = ctx.createRadialGradient(p2.x, p2.y, 2 * z, p2.x, p2.y, r2);
          destGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
          destGrad.addColorStop(0.35, `rgba(56, 189, 248, ${alpha * 0.85})`);
          destGrad.addColorStop(0.75, `rgba(168, 85, 247, ${alpha * 0.5})`);
          destGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = destGrad;
          ctx.beginPath();
          ctx.ellipse(p2.x, p2.y, r2, r2 * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // 4-Pointed Celestial Star Flare at Destination
          const starLen = r2 * 1.4;
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.lineWidth = 2.2 * z;
          ctx.beginPath();
          ctx.moveTo(p2.x - starLen, p2.y); ctx.lineTo(p2.x + starLen, p2.y);
          ctx.moveTo(p2.x, p2.y - starLen * 0.5); ctx.lineTo(p2.x, p2.y + starLen * 0.5);
          ctx.stroke();

          ctx.restore();

        } else if (fx.type === 'fan_of_knives') {
          // Rogue Fan of Knives - 12 Whirling Poison-Tipped Razor Daggers
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.4) * 26 * z * Math.min(1.0, progress * 1.4);
          const rot = this.animations.time * 14;

          ctx.save();
          // Central toxic poison flash
          const burstGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, 20 * z);
          burstGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.95})`);
          burstGrad.addColorStop(0.4, `rgba(74, 222, 128, ${alpha * 0.8})`);
          burstGrad.addColorStop(0.8, `rgba(168, 85, 247, ${alpha * 0.4})`);
          burstGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = burstGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, 20 * z, 10 * z, 0, 0, Math.PI * 2);
          ctx.fill();

          // 12 Radiating Ornate Throwing Daggers with luminous motion trails
          for (let k = 0; k < 12; k++) {
            const angle = (k * (Math.PI * 2 / 12)) + rot;
            const kx = screen.x + Math.cos(angle) * rad;
            const ky = screen.y + Math.sin(angle) * (rad * 0.5);
            const prevKx = screen.x + Math.cos(angle - 0.25) * (rad * 0.78);
            const prevKy = screen.y + Math.sin(angle - 0.25) * (rad * 0.39);

            // Glowing poison motion-blur trail
            ctx.beginPath();
            ctx.moveTo(prevKx, prevKy);
            ctx.lineTo(kx, ky);
            ctx.strokeStyle = `rgba(34, 197, 94, ${alpha * 0.75})`;
            ctx.lineWidth = 3.5 * z;
            ctx.stroke();

            // Render Stylized Steel Dagger
            ctx.save();
            ctx.translate(kx, ky);
            ctx.rotate(angle + Math.PI * 0.5);

            // Steel Blade Face
            ctx.beginPath();
            ctx.moveTo(0, -9 * z); // Sharp dagger tip
            ctx.lineTo(3 * z, 2 * z);
            ctx.lineTo(1.2 * z, 7 * z); // Crossguard
            ctx.lineTo(-1.2 * z, 7 * z);
            ctx.lineTo(-3 * z, 2 * z);
            ctx.closePath();
            ctx.fillStyle = '#f1f5f9';
            ctx.fill();
            ctx.strokeStyle = `rgba(34, 197, 94, ${alpha * 0.95})`; // Poison edge glow
            ctx.lineWidth = 1.6 * z;
            ctx.stroke();

            // Specular Blade Ridge Highlight
            ctx.beginPath();
            ctx.moveTo(0, -8 * z);
            ctx.lineTo(0, 5 * z);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2 * z;
            ctx.stroke();

            // Wrapped Hilt
            ctx.fillStyle = '#1e1b4b';
            ctx.fillRect(-1.5 * z, 6 * z, 3 * z, 5 * z);

            ctx.restore();
          }
          ctx.restore();

        } else if (fx.type === 'toxic_bomb') {
          // Rogue Toxic Bomb - Boiling Cauldron Acid Pool & Poison Vapors
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.2) * 28 * z * Math.min(1.0, progress * 1.5);

          ctx.save();
          // Boiling Acid Pool Radial Gradient
          const toxGrad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          toxGrad.addColorStop(0, `rgba(187, 247, 208, ${alpha * 0.95})`);
          toxGrad.addColorStop(0.35, `rgba(74, 222, 128, ${alpha * 0.85})`);
          toxGrad.addColorStop(0.75, `rgba(22, 101, 52, ${alpha * 0.6})`);
          toxGrad.addColorStop(1, 'rgba(5, 46, 22, 0)');

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = toxGrad;
          ctx.fill();

          // Outer Caustic Hazard Border Ring
          ctx.strokeStyle = `rgba(134, 239, 172, ${alpha * 0.95})`;
          ctx.lineWidth = 3.5 * z;
          ctx.stroke();

          // 7 Animated Popping Acid Bubbles
          for (let b = 0; b < 7; b++) {
            const bAngle = (b * 1.1) + this.animations.time * 2;
            const bDist = (0.2 + (b % 4) * 0.2) * rad;
            const bx = screen.x + Math.cos(bAngle) * bDist;
            const by = screen.y + Math.sin(bAngle) * (bDist * 0.5);
            const bPhase = (this.animations.time * 5 + b * 1.7) % Math.PI;
            const bSize = Math.sin(bPhase) * 6 * z;

            if (bSize > 1) {
              ctx.beginPath();
              ctx.arc(bx, by, bSize, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(134, 239, 172, ${alpha * 0.9})`;
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1 * z;
              ctx.stroke();

              // Specular bubble shine
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(bx - bSize * 0.35, by - bSize * 0.35, bSize * 0.3, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Billowing Toxic Smoke Cloud
          const smokeGrad = ctx.createRadialGradient(screen.x, screen.y - 12 * z, 2 * z, screen.x, screen.y - 12 * z, rad * 0.85);
          smokeGrad.addColorStop(0, `rgba(74, 222, 128, ${alpha * 0.5})`);
          smokeGrad.addColorStop(0.6, `rgba(22, 101, 52, ${alpha * 0.3})`);
          smokeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = smokeGrad;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y - 12 * z, rad * 0.85, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();

        } else if (fx.type === 'shadow_dash') {
          // Rogue Shadow Dash - Obsidian Phantom Dash & Void Streamers
          const p1 = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const p2 = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Outer Abyssal Void Corona
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(147, 51, 234, ${alpha * 0.85})`;
          ctx.lineWidth = 12 * z;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Inner Gleaming Violet Laser Beam
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 3.5 * z;
          ctx.stroke();

          // Void Shockwave Rings at Dash Points
          const r1 = 18 * z * (1.0 - progress);
          ctx.beginPath();
          ctx.ellipse(p1.x, p1.y, r1, r1 * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.9})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();

          const r2 = 24 * z * Math.min(1.0, progress * 1.5);
          ctx.beginPath();
          ctx.ellipse(p2.x, p2.y, r2, r2 * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.95})`;
          ctx.lineWidth = 3 * z;
          ctx.stroke();

          ctx.restore();

        } else if (fx.type === 'shadow_strike') {
          // Rogue Shadow Strike - Intersecting Razor Void Cross-Cleaves
          const p1 = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4, this.camera, this.camera, this.canvas.width, this.canvas.height);
          const p2 = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Teleport Dash Laser Line
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.9})`;
          ctx.lineWidth = 7 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();

          // Dual Cross-Cleave Razor Scythes at Destination
          const cutSize = 26 * z * progress;
          ctx.beginPath();
          ctx.moveTo(p2.x - cutSize, p2.y - cutSize * 0.5);
          ctx.lineTo(p2.x + cutSize, p2.y + cutSize * 0.5);
          ctx.moveTo(p2.x + cutSize, p2.y - cutSize * 0.5);
          ctx.lineTo(p2.x - cutSize, p2.y + cutSize * 0.5);
          ctx.strokeStyle = `rgba(236, 72, 153, ${alpha * 0.95})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(p2.x - cutSize * 0.8, p2.y - cutSize * 0.4);
          ctx.lineTo(p2.x + cutSize * 0.8, p2.y + cutSize * 0.4);
          ctx.moveTo(p2.x + cutSize * 0.8, p2.y - cutSize * 0.4);
          ctx.lineTo(p2.x - cutSize * 0.8, p2.y + cutSize * 0.4);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();

          ctx.restore();

        } else if (fx.type === 'colossus_strike') {
          // Warrior Colossus Strike - Descending Titan Greatsword & Holy Ground Shatter
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.0) * 32 * z * Math.min(1.0, progress * 1.5);

          ctx.save();
          // Molten Holy Impact Crater Gradient
          const grad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
          grad.addColorStop(0.25, `rgba(254, 240, 138, ${alpha * 0.92})`);
          grad.addColorStop(0.6, `rgba(245, 158, 11, ${alpha * 0.7})`);
          grad.addColorStop(0.85, `rgba(180, 83, 9, ${alpha * 0.45})`);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();

          // Golden Seismic Shockwave Border
          ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.98})`;
          ctx.lineWidth = 5 * z;
          ctx.stroke();

          // Descending Titan Greatsword Phantom (impaled in center)
          const swordH = 48 * z * (1 - progress * 0.2);
          const swordDrop = Math.max(0, (1 - progress * 3) * 60 * z);
          const swordY = screen.y - swordDrop;

          ctx.save();
          ctx.translate(screen.x, swordY);

          // Greatsword Holy Golden Blade
          ctx.beginPath();
          ctx.moveTo(0, 0); // Tip in ground
          ctx.lineTo(6 * z, -swordH * 0.7);
          ctx.lineTo(6 * z, -swordH);
          ctx.lineTo(-6 * z, -swordH);
          ctx.lineTo(-6 * z, -swordH * 0.7);
          ctx.closePath();
          ctx.fillStyle = `rgba(254, 240, 138, ${alpha * 0.95})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();

          // Golden Crossguard & Pommel
          ctx.fillStyle = '#b45309';
          ctx.fillRect(-12 * z, -swordH - 3 * z, 24 * z, 6 * z);
          ctx.fillStyle = '#fde047';
          ctx.fillRect(-2.5 * z, -swordH - 15 * z, 5 * z, 12 * z); // Grip
          ctx.restore();

          // Radiant Ascending Light Pillars
          ctx.globalCompositeOperation = 'lighter';
          for (let p = -2; p <= 2; p++) {
            const px = screen.x + p * 12 * z;
            ctx.fillStyle = `rgba(254, 240, 138, ${alpha * 0.4})`;
            ctx.fillRect(px - 3 * z, screen.y - 70 * z, 6 * z, 70 * z);
          }

          ctx.restore();

        } else if (fx.type === 'shield_slam') {
          // Warrior Shield Slam - Concussive Sonic Boom Cone & Radiant Aegis Crest
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const facingAngles = { E: 0, SE: Math.PI * 0.25, S: Math.PI * 0.5, SW: Math.PI * 0.75, W: Math.PI, NW: -Math.PI * 0.75, N: -Math.PI * 0.5, NE: -Math.PI * 0.25 };
          const baseAngle = facingAngles[fx.facing] !== undefined ? facingAngles[fx.facing] : Math.PI * 0.25;
          const rad = (20 + progress * 26) * z;

          ctx.save();
          ctx.translate(screen.x, screen.y);
          ctx.rotate(baseAngle);
          ctx.globalCompositeOperation = 'lighter';

          // Concussive Shockwave Cone
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, rad, -Math.PI * 0.35, Math.PI * 0.35);
          ctx.closePath();
          const coneGrad = ctx.createRadialGradient(0, 0, 2 * z, 0, 0, rad);
          coneGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.95})`);
          coneGrad.addColorStop(0.4, `rgba(56, 189, 248, ${alpha * 0.8})`);
          coneGrad.addColorStop(0.8, `rgba(250, 204, 21, ${alpha * 0.5})`);
          coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = coneGrad;
          ctx.fill();

          // Outer Radiant Aegis Shield Crest Border
          ctx.beginPath();
          ctx.arc(0, 0, rad, -Math.PI * 0.35, Math.PI * 0.35);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();

          ctx.restore();

        } else if (fx.type === 'blood_rage') {
          // Warrior Blood Rage - Demonic Crimson Fury Aura & Orbiting Flame Wisps
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.2, this.camera, this.canvas.width, this.canvas.height);
          const rad = 28 * z * (0.7 + progress * 0.5);
          const rot = this.animations.time * 6;

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Inner Blood Fury Radial Glow
          const rageGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, rad);
          rageGrad.addColorStop(0, `rgba(254, 242, 242, ${alpha * 0.95})`);
          rageGrad.addColorStop(0.3, `rgba(239, 68, 68, ${alpha * 0.8})`);
          rageGrad.addColorStop(0.7, `rgba(185, 28, 28, ${alpha * 0.5})`);
          rageGrad.addColorStop(1, 'rgba(69, 10, 10, 0)');
          ctx.fillStyle = rageGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Jagged Demonic Spiked Fury Ring
          ctx.strokeStyle = `rgba(248, 113, 113, ${alpha * 0.95})`;
          ctx.lineWidth = 3.5 * z;
          ctx.stroke();

          // 6 Orbiting Crimson Flame Wisps
          for (let f = 0; f < 6; f++) {
            const fAngle = rot + (f * Math.PI * 2 / 6);
            const fxPos = screen.x + Math.cos(fAngle) * (rad * 0.85);
            const fyPos = screen.y + Math.sin(fAngle) * (rad * 0.42) - (8 * z * Math.sin(this.animations.time * 8 + f));

            ctx.beginPath();
            ctx.arc(fxPos, fyPos, 5 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(fxPos, fyPos, 9 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(239, 68, 68, ${alpha * 0.75})`;
            ctx.fill();
          }

          ctx.restore();

        } else if (fx.type === 'iron_fortress') {
          // Warrior Iron Fortress - 6 Rotating Fortified Steel Pavise Shields
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.3, this.camera, this.canvas.width, this.canvas.height);
          const rad = 30 * z;
          const rot = this.animations.time * 2.5;

          ctx.save();
          // Fortified Defense Barrier Ring
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(203, 213, 225, ${alpha * 0.85})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();

          // 6 Rotating Heavy Steel Pavise Shields
          for (let s = 0; s < 6; s++) {
            const sAngle = rot + (s * Math.PI * 2 / 6);
            const sx = screen.x + Math.cos(sAngle) * rad;
            const sy = screen.y + Math.sin(sAngle) * (rad * 0.5);

            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(sAngle + Math.PI * 0.5);

            // Steel Pavise Shield Face
            ctx.fillStyle = '#475569';
            ctx.fillRect(-4 * z, -9 * z, 8 * z, 18 * z);
            ctx.fillStyle = '#94a3b8'; // Specular highlight bevel
            ctx.fillRect(-4 * z, -9 * z, 8 * z, 3 * z);
            ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.95})`; // Golden defensive rune rim
            ctx.lineWidth = 1.5 * z;
            ctx.strokeRect(-4 * z, -9 * z, 8 * z, 18 * z);

            ctx.restore();
          }

          ctx.restore();

        } else if (fx.type === 'war_stomp') {
          // Warrior War Stomp - Triple Cascading Seismic Shockwave Rings
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.2) * 26 * z * Math.min(1.0, progress * 1.5);

          ctx.save();
          // Seismic Ground Glow
          const stompGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, rad);
          stompGrad.addColorStop(0, `rgba(254, 240, 138, ${alpha * 0.9})`);
          stompGrad.addColorStop(0.4, `rgba(245, 158, 11, ${alpha * 0.7})`);
          stompGrad.addColorStop(0.8, `rgba(180, 83, 9, ${alpha * 0.4})`);
          stompGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = stompGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Triple Expanding Seismic Rings
          for (let r = 1; r <= 3; r++) {
            const ringR = rad * (r / 3);
            ctx.beginPath();
            ctx.ellipse(screen.x, screen.y, ringR, ringR * 0.5, 0, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * (1 - r * 0.2)})`;
            ctx.lineWidth = (4.5 - r) * z;
            ctx.stroke();
          }

          ctx.restore();

        } else if (fx.type === 'chain_lightning') {
          // Mage Chain Lightning - Branching Fractal High-Voltage Arcs
          if (fx.points && fx.points.length > 1) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            for (let i = 0; i < fx.points.length - 1; i++) {
              const pt1 = Isometric.worldToScreen(fx.points[i].x, fx.points[i].y, 0.4, this.camera, this.canvas.width, this.canvas.height);
              const pt2 = Isometric.worldToScreen(fx.points[i + 1].x, fx.points[i + 1].y, 0.4, this.camera, this.canvas.width, this.canvas.height);

              // Draw Main Arc + 2 Branching Sub-Arcs with High-Frequency Jitter
              const segments = 6;
              const dx = (pt2.x - pt1.x) / segments;
              const dy = (pt2.y - pt1.y) / segments;
              const perpX = -dy;
              const perpY = dx;
              const pLen = Math.hypot(perpX, perpY) || 1;
              const normX = perpX / pLen;
              const normY = perpY / pLen;

              for (let arc = 0; arc < 2; arc++) {
                ctx.beginPath();
                ctx.moveTo(pt1.x, pt1.y);
                for (let s = 1; s < segments; s++) {
                  const jitter = (Math.random() - 0.5) * (20 + arc * 14) * z;
                  const sx = pt1.x + dx * s + normX * jitter;
                  const sy = pt1.y + dy * s + normY * jitter;
                  ctx.lineTo(sx, sy);
                }
                ctx.lineTo(pt2.x, pt2.y);

                // Outer Glowing Cyan/Violet Corona
                ctx.strokeStyle = arc === 0 ? `rgba(103, 232, 249, ${alpha * 0.95})` : `rgba(192, 132, 252, ${alpha * 0.8})`;
                ctx.lineWidth = (arc === 0 ? 5.5 : 3.0) * z;
                ctx.stroke();

                // Blinding Hot White Core
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
                ctx.lineWidth = (arc === 0 ? 2.5 : 1.2) * z;
                ctx.stroke();
              }

              // High-Voltage Contact Explosion Node at Points
              for (const pt of [pt1, pt2]) {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 8 * z, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 16 * z, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(103, 232, 249, ${alpha * 0.6})`;
                ctx.fill();
              }
            }

            ctx.restore();
          }

        } else if (fx.type === 'mana_shield') {
          // Mage Mana Shield - Shimmering Hexagonal Translucent Crystal Bubble
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const rad = 26 * z;
          const rot = this.animations.time * 3;

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Translucent Shield Dome
          const domeGrad = ctx.createRadialGradient(screen.x, screen.y - 12 * z, 2 * z, screen.x, screen.y - 12 * z, rad);
          domeGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.6})`);
          domeGrad.addColorStop(0.5, `rgba(56, 189, 248, ${alpha * 0.4})`);
          domeGrad.addColorStop(0.9, `rgba(147, 51, 234, ${alpha * 0.3})`);
          domeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = domeGrad;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y - 12 * z, rad, 0, Math.PI * 2);
          ctx.fill();

          // Hexagonal Shield Grid Matrix
          ctx.strokeStyle = `rgba(186, 230, 253, ${alpha * 0.9})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();

          // 4 Orbiting Arcane Focus Gems
          for (let g = 0; g < 4; g++) {
            const gAngle = rot + (g * Math.PI * 2 / 4);
            const gx = screen.x + Math.cos(gAngle) * rad;
            const gy = (screen.y - 12 * z) + Math.sin(gAngle) * (rad * 0.65);

            ctx.beginPath();
            ctx.arc(gx, gy, 4 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(gx, gy, 8 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.7})`;
            ctx.fill();
          }

          ctx.restore();

        } else if (fx.type === 'black_hole') {
          // Mage Cosmic Singularity - Absolute Event Horizon & Accretion Spiral Arms
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.8) * 28 * z * (0.6 + progress * 0.6);
          const rot = this.animations.time * 16;

          ctx.save();

          // Gravitational Lensing Violet Corona (Additive)
          ctx.globalCompositeOperation = 'lighter';
          const lensGrad = ctx.createRadialGradient(screen.x, screen.y, rad * 0.35, screen.x, screen.y, rad);
          lensGrad.addColorStop(0, `rgba(168, 85, 247, ${alpha * 0.9})`);
          lensGrad.addColorStop(0.5, `rgba(56, 189, 248, ${alpha * 0.6})`);
          lensGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = lensGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // 4 Rotating Spiral Galaxy Accretion Arms
          for (let arm = 0; arm < 4; arm++) {
            const baseAngle = rot + (arm * Math.PI * 0.5);
            ctx.beginPath();
            for (let step = 0; step < 16; step++) {
              const theta = baseAngle + (step * 0.28);
              const r = (rad * 0.35) + (step / 16) * (rad * 0.65);
              const ax = screen.x + Math.cos(theta) * r;
              const ay = screen.y + Math.sin(theta) * (r * 0.5);
              if (step === 0) ctx.moveTo(ax, ay); else ctx.lineTo(ax, ay);
            }
            ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.8})`;
            ctx.lineWidth = 3.5 * z;
            ctx.stroke();
          }

          // Blinding Incandescent Photon Sphere Rim
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad * 0.42, rad * 0.21, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();

          // Absolute Pitch-Black Event Horizon Core (Normal Composite)
          ctx.globalCompositeOperation = 'source-over';
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad * 0.38, rad * 0.19, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#020617';
          ctx.fill();

          ctx.restore();

        } else if (fx.type === 'blizzard') {
          // Mage Glacial Blizzard - Howling Glacial Vortex & Ice Spires
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.4) * 26 * z;
          const rot = this.animations.time * 8;

          ctx.save();
          // Sub-Zero Ground Frost Layer
          const blizGrad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          blizGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.85})`);
          blizGrad.addColorStop(0.35, `rgba(186, 230, 253, ${alpha * 0.65})`);
          blizGrad.addColorStop(0.75, `rgba(56, 189, 248, ${alpha * 0.35})`);
          blizGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
          ctx.fillStyle = blizGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Swirling Glacial Gale Rings
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, rot, 0, Math.PI * 1.8);
          ctx.strokeStyle = `rgba(186, 230, 253, ${alpha * 0.9})`;
          ctx.lineWidth = 3.5 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad * 0.65, rad * 0.32, -rot * 1.5, 0, Math.PI * 1.6);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();

          // 6 Impaling Glacial Ice Spires
          for (let s = 0; s < 6; s++) {
            const angle = (s * Math.PI / 3) + 0.3;
            const sx = screen.x + Math.cos(angle) * (rad * 0.6);
            const sy = screen.y + Math.sin(angle) * (rad * 0.3);
            const spikeH = 22 * z * Math.sin(progress * Math.PI);

            ctx.beginPath();
            ctx.moveTo(sx - 3 * z, sy);
            ctx.lineTo(sx, sy - spikeH);
            ctx.lineTo(sx + 3 * z, sy);
            ctx.closePath();
            ctx.fillStyle = `rgba(186, 230, 253, ${alpha * 0.9})`;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2 * z;
            ctx.stroke();
          }

          ctx.restore();

        } else if (fx.type === 'pyroblast') {
          // Mage Pyroblast - Solar Plasma Fireball Detonation
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const rad = 32 * z * Math.min(1.0, progress * 1.5);

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Boiling Solar Plasma Core
          const pyroGrad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          pyroGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
          pyroGrad.addColorStop(0.2, `rgba(254, 240, 138, ${alpha * 0.95})`);
          pyroGrad.addColorStop(0.5, `rgba(249, 115, 22, ${alpha * 0.85})`);
          pyroGrad.addColorStop(0.8, `rgba(220, 38, 38, ${alpha * 0.5})`);
          pyroGrad.addColorStop(1, 'rgba(127, 29, 29, 0)');
          ctx.fillStyle = pyroGrad;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, rad, 0, Math.PI * 2);
          ctx.fill();

          // Expanding Solar Prominence Flares
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, rad, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.98})`;
          ctx.lineWidth = 5 * z;
          ctx.stroke();

          // 8 Radiating Flame Tongues
          for (let f = 0; f < 8; f++) {
            const fAngle = (f * Math.PI / 4) + this.animations.time * 6;
            const fxPos = screen.x + Math.cos(fAngle) * (rad * 1.2);
            const fyPos = screen.y + Math.sin(fAngle) * (rad * 1.2);
            ctx.beginPath();
            ctx.arc(fxPos, fyPos, 4 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(254, 240, 138, ${alpha * 0.9})`;
            ctx.fill();
          }

          ctx.restore();

        } else if (fx.type === 'shadowstep') {
          // Rogue Shadowstep - Void Implosion & Phantom Cross-Slash
          const p1 = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const p2 = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Origin Shadow Implosion
          const r1 = 20 * z * (1 - progress);
          ctx.beginPath();
          ctx.arc(p1.x, p1.y, r1, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha})`;
          ctx.lineWidth = 3 * z;
          ctx.stroke();

          // Destination Void Emergence Cross-Slash
          const slashLen = 22 * z * progress;
          ctx.beginPath();
          ctx.moveTo(p2.x - slashLen, p2.y - slashLen * 0.5); ctx.lineTo(p2.x + slashLen, p2.y + slashLen * 0.5);
          ctx.moveTo(p2.x + slashLen, p2.y - slashLen * 0.5); ctx.lineTo(p2.x - slashLen, p2.y + slashLen * 0.5);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 3.5 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(p2.x, p2.y, 16 * z * progress, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(147, 51, 234, ${alpha * 0.6})`;
          ctx.fill();

          ctx.restore();

        } else if (fx.type === 'smoke_screen') {
          // Rogue Smoke Screen - Volumetric Rolling Ninja Concealment Fog
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.3, this.camera, this.canvas.width, this.canvas.height);
          const rad = 32 * z * (0.8 + progress * 0.5);

          ctx.save();
          // Volumetric Dark Matter Fog
          const smokeGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, rad);
          smokeGrad.addColorStop(0, `rgba(30, 41, 59, ${alpha * 0.92})`);
          smokeGrad.addColorStop(0.5, `rgba(51, 65, 85, ${alpha * 0.75})`);
          smokeGrad.addColorStop(0.85, `rgba(71, 85, 105, ${alpha * 0.45})`);
          smokeGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = smokeGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Outer Whispering Smoke Filaments
          ctx.strokeStyle = `rgba(148, 163, 184, ${alpha * 0.65})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();

          ctx.restore();

        } else if (fx.type === 'death_blossom') {
          // Rogue Death Blossom - Omnislash Multi-Directional Crimson Cleaves & Blood Lotus
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.0) * 28 * z;

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Epic Blood Lotus Core
          const blossomGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, 16 * z);
          blossomGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
          blossomGrad.addColorStop(0.4, `rgba(244, 114, 182, ${alpha * 0.85})`);
          blossomGrad.addColorStop(0.8, `rgba(225, 29, 72, ${alpha * 0.5})`);
          blossomGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = blossomGrad;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, 16 * z, 0, Math.PI * 2);
          ctx.fill();

          // 8 Razor Blade Omnislash Slashes Across Area
          for (let s = 0; s < 8; s++) {
            const angle = (s * Math.PI / 4) + progress * 10;
            const x1 = screen.x + Math.cos(angle) * (rad * 0.2);
            const y1 = screen.y + Math.sin(angle) * (rad * 0.1);
            const x2 = screen.x + Math.cos(angle) * rad;
            const y2 = screen.y + Math.sin(angle) * (rad * 0.5);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = `rgba(244, 114, 182, ${alpha * 0.95})`;
            ctx.lineWidth = 4 * z;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
            ctx.lineWidth = 1.8 * z;
            ctx.stroke();
          }

          ctx.restore();

        } else if (fx.type === 'poison_darts') {
          // Rogue Poison Darts - 6 Flying Venom Shurikens with Emerald Trails
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const rad = 28 * z * Math.min(1.0, progress * 1.5);
          const rot = this.animations.time * 20;

          ctx.save();
          for (let s = 0; s < 6; s++) {
            const angle = (s * Math.PI * 2 / 6) + rot * 0.3;
            const sx = screen.x + Math.cos(angle) * rad;
            const sy = screen.y + Math.sin(angle) * (rad * 0.5);

            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(rot);

            // 4-Pointed Steel Shuriken
            ctx.beginPath();
            ctx.moveTo(0, -6 * z);
            ctx.lineTo(1.8 * z, -1.8 * z);
            ctx.lineTo(6 * z, 0);
            ctx.lineTo(1.8 * z, 1.8 * z);
            ctx.lineTo(0, 6 * z);
            ctx.lineTo(-1.8 * z, 1.8 * z);
            ctx.lineTo(-6 * z, 0);
            ctx.lineTo(-1.8 * z, -1.8 * z);
            ctx.closePath();
            ctx.fillStyle = '#f8fafc';
            ctx.fill();
            ctx.strokeStyle = `rgba(34, 197, 94, ${alpha * 0.95})`;
            ctx.lineWidth = 1.5 * z;
            ctx.stroke();

            ctx.restore();
          }
          ctx.restore();

        } else if (fx.type === 'caltrops') {
          // Rogue Barbed Caltrops - 12 Steel Ground Spikes with Specular Gleam
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.2) * 24 * z;

          ctx.save();
          // Caltrop Trap Perimeter Ring
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(100, 116, 139, ${alpha * 0.7})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();

          // 12 Scattered 3D Tetrahedral Spikes
          for (let c = 0; c < 12; c++) {
            const cAngle = c * 2.399; // Golden ratio spread
            const cDist = Math.sqrt((c + 1) / 12) * rad * 0.88;
            const cx = screen.x + Math.cos(cAngle) * cDist;
            const cy = screen.y + Math.sin(cAngle) * (cDist * 0.5);

            ctx.beginPath();
            ctx.moveTo(cx, cy - 5 * z); // Top spike
            ctx.lineTo(cx + 3 * z, cy + 2 * z);
            ctx.lineTo(cx - 3 * z, cy + 2 * z);
            ctx.closePath();
            ctx.fillStyle = '#475569';
            ctx.fill();
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1 * z;
            ctx.stroke();
          }

          ctx.restore();
        } else if (fx.type === 'dragon_roar') {
          // Warrior Dragon Roar - Blazing Golden Dragon Sigil & Roaring Firewave
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.5) * 30 * z * Math.min(1.0, progress * 1.5);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const dGrad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          dGrad.addColorStop(0, `rgba(254, 240, 138, ${alpha * 0.95})`);
          dGrad.addColorStop(0.4, `rgba(249, 115, 22, ${alpha * 0.8})`);
          dGrad.addColorStop(0.8, `rgba(220, 38, 38, ${alpha * 0.4})`);
          dGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = dGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          // Dragon Fang Spikes Ring
          for (let i = 0; i < 8; i++) {
            const fangAngle = (i * Math.PI * 2 / 8) + this.animations.time * 2;
            const fxPos = screen.x + Math.cos(fangAngle) * rad;
            const fyPos = screen.y + Math.sin(fangAngle) * (rad * 0.5);
            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y);
            ctx.lineTo(fxPos, fyPos);
            ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.8})`;
            ctx.lineWidth = 3 * z;
            ctx.stroke();
          }
          ctx.restore();

        } else if (fx.type === 'meteor_dive') {
          // Warrior Meteor Dive - Blazing Celestial Crater & Magma Impact
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.0) * 32 * z * Math.min(1.0, progress * 1.6);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          // Fiery Crater Glow
          const mGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, rad);
          mGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
          mGrad.addColorStop(0.3, `rgba(245, 158, 11, ${alpha * 0.85})`);
          mGrad.addColorStop(0.7, `rgba(185, 28, 28, ${alpha * 0.6})`);
          mGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = mGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          // Expanding Shockwave Ring
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(254, 240, 138, ${alpha * 0.95})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();
          ctx.restore();

        } else if (fx.type === 'bladestorm_frenzy') {
          // Warrior Bladestorm Frenzy - Multi-tiered Steel Hurricane
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.2) * 30 * z;
          const rot = this.animations.time * 22;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let b = 0; b < 6; b++) {
            const bAngle = rot + (b * Math.PI * 2 / 6);
            ctx.save();
            ctx.translate(screen.x, screen.y);
            ctx.rotate(bAngle);
            ctx.beginPath();
            ctx.ellipse(0, 0, rad, rad * 0.45, 0, 0, Math.PI * 0.7);
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.9})`;
            ctx.lineWidth = 4 * z;
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(0, 0, rad * 0.9, rad * 0.4, 0, 0, Math.PI * 0.5);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            ctx.lineWidth = 2 * z;
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();

        } else if (fx.type === 'titan_bastion') {
          // Warrior Titan Bastion - Radiant Golden Aegis Wall
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const rad = 36 * z;
          const rot = this.animations.time * 3;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.9})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();
          for (let s = 0; s < 8; s++) {
            const sAngle = rot + (s * Math.PI * 2 / 8);
            const sx = screen.x + Math.cos(sAngle) * rad;
            const sy = screen.y + Math.sin(sAngle) * (rad * 0.5);
            ctx.beginPath();
            ctx.arc(sx, sy, 5 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(254, 240, 138, ${alpha * 0.95})`;
            ctx.fill();
          }
          ctx.restore();

        } else if (fx.type === 'sundering_cleave') {
          // Warrior Sundering Cleave - Earth-Shattering Magma Fissure
          const start = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const end = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.strokeStyle = `rgba(249, 115, 22, ${alpha * 0.9})`;
          ctx.lineWidth = 8 * z;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.lineWidth = 3 * z;
          ctx.stroke();
          ctx.restore();

        } else if (fx.type === 'ragnarok_slash') {
          // Warrior Ragnarök Godslayer - 4 Colossal Divine Cross Cleaves
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 5.5) * 32 * z * Math.min(1.0, progress * 1.5);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let a = 0; a < 4; a++) {
            const rot = (a * Math.PI / 4) + (this.animations.time * 4);
            ctx.save();
            ctx.translate(screen.x, screen.y);
            ctx.rotate(rot);
            ctx.beginPath();
            ctx.moveTo(-rad, 0); ctx.lineTo(rad, 0);
            ctx.strokeStyle = `rgba(234, 179, 8, ${alpha * 0.95})`;
            ctx.lineWidth = 7 * z;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-rad * 0.9, 0); ctx.lineTo(rad * 0.9, 0);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
            ctx.lineWidth = 2.5 * z;
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();

        } else if (fx.type === 'thunder_storm') {
          // Mage Tempest Cataclysm - Multi-Lightning Shock Vortex
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.5) * 30 * z;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          // Storm Aura
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(59, 130, 246, ${alpha * 0.25})`;
          ctx.fill();
          // Lightning Bolts
          for (let l = 0; l < 5; l++) {
            const lAngle = l * 1.25 + this.animations.time * 8;
            const lx = screen.x + Math.cos(lAngle) * (rad * 0.7);
            const ly = screen.y + Math.sin(lAngle) * (rad * 0.35);
            ctx.beginPath();
            ctx.moveTo(lx, ly - 50 * z);
            ctx.lineTo(lx - 5 * z, ly - 25 * z);
            ctx.lineTo(lx + 4 * z, ly - 10 * z);
            ctx.lineTo(lx, ly);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            ctx.lineWidth = 3 * z;
            ctx.stroke();
            ctx.strokeStyle = `rgba(147, 197, 253, ${alpha * 0.8})`;
            ctx.lineWidth = 6 * z;
            ctx.stroke();
          }
          ctx.restore();

        } else if (fx.type === 'glacial_comet') {
          // Mage Glacial Comet - Crystalline Impact & Frost Ring
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.2) * 30 * z * Math.min(1.0, progress * 1.5);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const gGrad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          gGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.95})`);
          gGrad.addColorStop(0.4, `rgba(56, 189, 248, ${alpha * 0.85})`);
          gGrad.addColorStop(0.8, `rgba(3, 105, 161, ${alpha * 0.45})`);
          gGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          // Hexagonal Ice Crystals
          for (let h = 0; h < 6; h++) {
            const hAngle = h * Math.PI / 3;
            const hx = screen.x + Math.cos(hAngle) * rad;
            const hy = screen.y + Math.sin(hAngle) * (rad * 0.5);
            ctx.beginPath();
            ctx.arc(hx, hy, 6 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(224, 242, 254, ${alpha * 0.95})`;
            ctx.fill();
          }
          ctx.restore();

        } else if (fx.type === 'arcane_hyperbeam') {
          // Mage Arcane Hyperbeam - Piercing Antimatter Laser
          const start = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const end = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.85})`;
          ctx.lineWidth = 14 * z;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();
          ctx.restore();

        } else if (fx.type === 'time_dilation') {
          // Mage Chrono Time Warp - Shimmering Chronosphere
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 5.0) * 28 * z;
          const rot = this.animations.time * 1.5;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.18})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.85})`;
          ctx.lineWidth = 3 * z;
          ctx.stroke();
          // Rotating Clock Dials
          for (let c = 0; c < 12; c++) {
            const cAngle = rot + (c * Math.PI * 2 / 12);
            const cx = screen.x + Math.cos(cAngle) * rad;
            const cy = screen.y + Math.sin(cAngle) * (rad * 0.5);
            ctx.beginPath();
            ctx.arc(cx, cy, 3 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
            ctx.fill();
          }
          ctx.restore();

        } else if (fx.type === 'supernova_blast') {
          // Mage Solar Supernova - Blinding Stellar Flare
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 5.2) * 32 * z * Math.min(1.0, progress * 1.6);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const sGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, rad);
          sGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
          sGrad.addColorStop(0.3, `rgba(253, 224, 71, ${alpha * 0.9})`);
          sGrad.addColorStop(0.7, `rgba(239, 68, 68, ${alpha * 0.6})`);
          sGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = sGrad;
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

        } else if (fx.type === 'genesis_cataclysm') {
          // Mage Cataclysm of Genesis - Orbital Celestial Annihilation
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 6.0) * 32 * z * Math.min(1.0, progress * 1.4);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let p = 0; p < 8; p++) {
            const pAngle = (p * Math.PI * 2 / 8) + this.animations.time * 3;
            const px = screen.x + Math.cos(pAngle) * rad;
            const py = screen.y + Math.sin(pAngle) * (rad * 0.5);
            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y); ctx.lineTo(px, py);
            ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.85})`;
            ctx.lineWidth = 4 * z;
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, rad * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.fill();
          ctx.restore();

        } else if (fx.type === 'venomous_barrage') {
          // Rogue Venom Barrage - 15 Piercing Needles
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const dirX = fx.dirX || 1, dirY = fx.dirY || 0;
          const baseAngle = Math.atan2(dirY, dirX);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let n = -7; n <= 7; n++) {
            const nAngle = baseAngle + (n * 0.08);
            const nDist = 45 * z * Math.min(1.0, progress * 2.0);
            const nx = screen.x + Math.cos(nAngle) * nDist;
            const ny = screen.y + Math.sin(nAngle) * (nDist * 0.5);
            ctx.beginPath();
            ctx.arc(nx, ny, 3 * z, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(34, 197, 94, ${alpha * 0.95})`;
            ctx.fill();
          }
          ctx.restore();

        } else if (fx.type === 'phantom_assassins') {
          // Rogue Phantom Assassins - Dual Mirage Clones
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.2) * 26 * z;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let c = -1; c <= 1; c += 2) {
            const cx = screen.x + c * (rad * 0.7);
            const cy = screen.y - 10 * z;
            ctx.beginPath();
            ctx.ellipse(cx, cy, 14 * z, 26 * z, 0, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(168, 85, 247, ${alpha * 0.55})`;
            ctx.fill();
          }
          ctx.restore();

        } else if (fx.type === 'assassins_cull') {
          // Rogue Guillotine Execution Cleave
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.5, this.camera, this.canvas.width, this.canvas.height);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.moveTo(screen.x - 30 * z, screen.y - 45 * z);
          ctx.lineTo(screen.x + 30 * z, screen.y + 20 * z);
          ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.98})`;
          ctx.lineWidth = 7 * z;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(screen.x - 25 * z, screen.y - 40 * z);
          ctx.lineTo(screen.x + 25 * z, screen.y + 15 * z);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();
          ctx.restore();

        } else if (fx.type === 'abyssal_tether') {
          // Rogue Abyssal Shadow Chains
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 5.2) * 26 * z;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let ch = 0; ch < 6; ch++) {
            const chAngle = (ch * Math.PI * 2 / 6) + this.animations.time * 2;
            const chx = screen.x + Math.cos(chAngle) * rad;
            const chy = screen.y + Math.sin(chAngle) * (rad * 0.5);
            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y); ctx.lineTo(chx, chy);
            ctx.strokeStyle = `rgba(147, 51, 234, ${alpha * 0.85})`;
            ctx.lineWidth = 3.5 * z;
            ctx.stroke();
          }
          ctx.restore();

        } else if (fx.type === 'blade_dance') {
          // Rogue Dancing Razor Mirage
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.8) * 28 * z;
          const rot = this.animations.time * 18;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let b = 0; b < 5; b++) {
            const bAngle = rot + (b * Math.PI * 2 / 5);
            ctx.save();
            ctx.translate(screen.x, screen.y);
            ctx.rotate(bAngle);
            ctx.beginPath();
            ctx.ellipse(0, 0, rad, rad * 0.4, 0, 0, Math.PI * 0.8);
            ctx.strokeStyle = `rgba(244, 114, 182, ${alpha * 0.9})`;
            ctx.lineWidth = 4 * z;
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();

        } else if (fx.type === 'eclipse_execution') {
          // Rogue Void Eclipse Omnislash
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 6.0) * 32 * z * Math.min(1.0, progress * 1.5);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          // Void Eclipse Core
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, 22 * z, 0, Math.PI * 2);
          ctx.fillStyle = '#09090b';
          ctx.fill();
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.95})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();
          // Omnislash Violet Vectors
          for (let v = 0; v < 8; v++) {
            const vAngle = v * 1.1 + this.animations.time * 12;
            const x1 = screen.x + Math.cos(vAngle) * rad;
            const y1 = screen.y + Math.sin(vAngle) * (rad * 0.5);
            const x2 = screen.x - Math.cos(vAngle) * rad;
            const y2 = screen.y - Math.sin(vAngle) * (rad * 0.5);
            ctx.beginPath();
            ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
            ctx.strokeStyle = `rgba(216, 180, 254, ${alpha * 0.95})`;
            ctx.lineWidth = 3.5 * z;
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }

    // 2. Dynamic High-Performance AAA Particle Engine
    const prevComposite = ctx.globalCompositeOperation;
    for (let i = this.animations.particles.length - 1; i >= 0; i--) {
      const p = this.animations.particles[i];

      // Physics: Drag, Gravity, Buoyancy, Turbulence & Spin
      p.vx *= (p.drag || 0.94);
      p.vy *= (p.drag || 0.94);
      if (p.gravity) p.vz -= p.gravity * dt;
      if (p.buoyancy) p.vz += p.buoyancy * dt;
      if (p.turbulence) {
        p.vx += Math.cos(this.animations.time * 16 + p.id) * p.turbulence * dt;
        p.vy += Math.sin(this.animations.time * 16 + p.id) * p.turbulence * dt;
      }
      p.rot = (p.rot || 0) + (p.vrot || 0) * dt;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // Ground bounce for physical particles (earth, sparks)
      if (p.bounce && p.z <= 0) {
        p.z = 0;
        p.vz = -p.vz * 0.45;
        p.vx *= 0.7;
        p.vy *= 0.7;
      }

      p.life -= dt;
      if (p.life <= 0) {
        this.animations.particles.splice(i, 1);
        continue;
      }

      const screen = Isometric.worldToScreen(p.x, p.y, Math.max(0, p.z), this.camera, this.canvas.width, this.canvas.height);
      const alpha = Math.max(0, p.life / p.maxLife);
      const prog = 1.0 - alpha;

      this.drawParticleItem(ctx, p, screen, z, alpha, prog);
    }
    ctx.globalCompositeOperation = prevComposite;

    // 3. Floating Combat Damage Numbers (Ultra-High FPS Hardware-Accelerated Vector Text)
    if (this.animations.floatingTexts.length > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;

      const cw = this.canvas.width;
      const ch = this.canvas.height;

      for (let i = this.animations.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.animations.floatingTexts[i];
        ft.life -= dt;

        if (ft.life <= 0) {
          this.animations.floatingTexts.splice(i, 1);
          continue;
        }

        // Physics: arc trajectories and drag
        ft.vy = (ft.vy || 0) + (ft.gravity || 58) * dt;
        ft.vx = (ft.vx || 0) * (ft.drag || 0.94);
        ft.screenOffsetX = (ft.screenOffsetX || 0) + ft.vx * dt;
        ft.screenOffsetY = (ft.screenOffsetY || 0) + ft.vy * dt;

        // Pop scale decay
        if (ft.scale && ft.scale > 1.0) {
          ft.scale = Math.max(1.0, ft.scale - dt * 2.2);
        }

        if (isNaN(ft.x) || isNaN(ft.y)) {
          this.animations.floatingTexts.splice(i, 1);
          continue;
        }

        const screen = Isometric.worldToScreen(ft.x, ft.y, 0.8, this.camera, cw, ch);
        const drawX = screen.x + ft.screenOffsetX;
        const drawY = screen.y + ft.screenOffsetY;

        // Viewport Culling: Skip rendering if offscreen to eliminate unnecessary GPU calls
        if (drawX < -80 || drawX > cw + 80 || drawY < -80 || drawY > ch + 80) {
          continue;
        }

        const alpha = Math.min(1.0, ft.life / (ft.maxLife * 0.35));
        const fontSize = Math.round(ft.size * z * (ft.scale || 1.0));

        ctx.font = `900 ${fontSize}px Outfit, sans-serif`;
        ctx.globalAlpha = alpha;

        // 1. High Performance Deep Solid Dark Outline (No shadowBlur software filter!)
        ctx.strokeStyle = '#050811';
        ctx.lineWidth = Math.max(3.0, 4.0 * z);
        ctx.strokeText(ft.text, drawX, drawY);

        // 2. Crit Glow Outline
        if (ft.isCrit) {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
          ctx.lineWidth = 1.8 * z;
          ctx.strokeText(ft.text, drawX, drawY);
        }

        // 3. Vibrant Fill Text
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, drawX, drawY);
      }

      ctx.restore();
    }

    // 4. Ambient Snowfall Particle Weather in Frostfell Peaks
    if (this.currentTheme === 'frostfell') {
      const snowW = this.canvas.width;
      const snowH = this.canvas.height;
      const time = this.animations.time;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      for (let s = 0; s < 70; s++) {
        const sx = ((s * 97 + time * 75) % (snowW + 100)) - 50;
        const sy = ((s * 131 + time * 120) % (snowH + 100)) - 50;
        const size = (s % 3) + 1.2;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Render individual stylized particle with custom shape, glow, and physics
  drawParticleItem(ctx, p, screen, z, alpha, prog) {
    ctx.save();
    ctx.globalCompositeOperation = p.blend || 'lighter';
    ctx.globalAlpha = Math.min(1.0, alpha);

    if (p.type === 'slash' || p.type === 'spark') {
      const speed = Math.hypot(p.vx, p.vy);
      const angle = Math.atan2(p.vy * 0.5, p.vx);
      const len = Math.max(5 * z, speed * 3.8 * z);
      ctx.translate(screen.x, screen.y);
      ctx.rotate(angle);

      // Outer glowing colored velocity streak
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.lineTo(len * 0.35, 0);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, p.size * z * alpha * 1.5);
      ctx.lineCap = 'round';
      ctx.stroke();

      // Hot white incandescent core
      ctx.beginPath();
      ctx.moveTo(-len * 0.65, 0);
      ctx.lineTo(len * 0.25, 0);
      ctx.strokeStyle = p.coreColor || '#ffffff';
      ctx.lineWidth = Math.max(0.8, p.size * z * alpha * 0.65);
      ctx.stroke();

    } else if (p.type === 'fire') {
      const r = p.size * z * (0.6 + prog * 0.8);
      const grad = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, p.coreColor || '#fef08a');
      grad.addColorStop(0.65, p.color);
      grad.addColorStop(1, 'rgba(185, 28, 28, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
      ctx.fill();

    } else if (p.type === 'arcane') {
      const sr = p.size * z * (0.8 + Math.sin(p.life * 18) * 0.25);
      ctx.translate(screen.x, screen.y);
      ctx.rotate(p.rot);

      // Soft celestial glow halo
      ctx.fillStyle = p.glowColor || 'rgba(192, 132, 252, 0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, sr * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // 4-Pointed Twinkling Star Cross
      ctx.beginPath();
      ctx.moveTo(0, -sr);
      ctx.quadraticCurveTo(0, 0, sr, 0);
      ctx.quadraticCurveTo(0, 0, 0, sr);
      ctx.quadraticCurveTo(0, 0, -sr, 0);
      ctx.quadraticCurveTo(0, 0, 0, -sr);
      ctx.fillStyle = p.color;
      ctx.fill();

      // Bright white diamond core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, sr * 0.32, 0, Math.PI * 2);
      ctx.fill();

    } else if (p.type === 'ice') {
      const ir = p.size * z * alpha;
      ctx.translate(screen.x, screen.y);
      ctx.rotate(p.rot);

      ctx.beginPath();
      ctx.moveTo(0, -ir * 1.6);
      ctx.lineTo(ir * 0.75, 0);
      ctx.lineTo(0, ir * 1.6);
      ctx.lineTo(-ir * 0.75, 0);
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(0.8, 1.2 * z);
      ctx.stroke();

    } else if (p.type === 'lightning') {
      const lr = p.size * 2.2 * z;
      ctx.translate(screen.x, screen.y);
      ctx.beginPath();
      ctx.moveTo(-lr, 0);
      ctx.lineTo(-lr * 0.35, Math.sin(p.id * 10 + p.life * 45) * 6 * z);
      ctx.lineTo(lr * 0.35, Math.cos(p.id * 10 + p.life * 45) * 6 * z);
      ctx.lineTo(lr, 0);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, 3.2 * z * alpha);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(0.6, 1.4 * z * alpha);
      ctx.stroke();

    } else if (p.type === 'poison') {
      const pr = p.size * z * (0.6 + prog * 0.5);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, pr, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

      // Specular acid shine
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(screen.x - pr * 0.3, screen.y - pr * 0.3, pr * 0.28, 0, Math.PI * 2);
      ctx.fill();

    } else if (p.type === 'shadow') {
      const vr = p.size * z * (0.8 + prog * 0.6);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, vr * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(screen.x, screen.y, vr * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fill();

    } else if (p.type === 'earth') {
      const er = p.size * z;
      ctx.translate(screen.x, screen.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.moveTo(-er, -er * 0.6);
      ctx.lineTo(er * 0.7, -er);
      ctx.lineTo(er, er * 0.5);
      ctx.lineTo(-er * 0.3, er);
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = '#291e14';
      ctx.lineWidth = Math.max(0.8, 1.2 * z);
      ctx.stroke();

    } else if (p.type === 'gold' || p.type === 'loot') {
      const gr = p.size * z * (0.8 + Math.sin(p.life * 15) * 0.2);
      ctx.translate(screen.x, screen.y);
      ctx.rotate(p.rot);

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, gr * 0.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2 * z;
      ctx.beginPath();
      ctx.moveTo(-gr * 1.2, 0); ctx.lineTo(gr * 1.2, 0);
      ctx.moveTo(0, -gr * 1.2); ctx.lineTo(0, gr * 1.2);
      ctx.stroke();

    } else if (p.type === 'dust') {
      const dr = p.size * z * (0.8 + prog * 1.4);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, dr, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

    } else if (p.type === 'wind') {
      const wr = p.size * z;
      const speed = Math.hypot(p.vx, p.vy);
      const angle = Math.atan2(p.vy * 0.5, p.vx);
      ctx.translate(screen.x, screen.y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(4 * z, speed * 2.8 * z), wr * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

    } else if (p.type === 'level') {
      const lr = p.size * z * (0.8 + Math.sin(p.life * 12) * 0.25);
      ctx.translate(screen.x, screen.y);
      ctx.rotate(p.rot);
      // Soft radial bloom
      ctx.fillStyle = p.glowColor || 'rgba(250, 204, 21, 0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, lr * 1.8, 0, Math.PI * 2);
      ctx.fill();
      // 8-pointed golden celestial star
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.8 * z;
      ctx.beginPath();
      ctx.moveTo(-lr * 1.5, 0); ctx.lineTo(lr * 1.5, 0);
      ctx.moveTo(0, -lr * 1.5); ctx.lineTo(0, lr * 1.5);
      const diag = lr * 0.9;
      ctx.moveTo(-diag, -diag); ctx.lineTo(diag, diag);
      ctx.moveTo(diag, -diag); ctx.lineTo(-diag, diag);
      ctx.stroke();
      // White diamond core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, lr * 0.4, 0, Math.PI * 2);
      ctx.fill();

    } else {
      // Default glowing particle
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, p.size * z * alpha, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    ctx.restore();
  }

  // Radar Minimap
  renderMinimap(gameState, localPlayerId) {
    if (!this.minimapCtx || !gameState || !gameState.map) return;
    const mctx = this.minimapCtx;
    const map = gameState.map;
    const mw = this.minimapCanvas.width;
    const mh = this.minimapCanvas.height;

    mctx.clearRect(0, 0, mw, mh);
    mctx.fillStyle = '#0a0e17';
    mctx.fillRect(0, 0, mw, mh);

    const scaleX = mw / map.width;
    const scaleY = mh / map.height;

    // Draw Map outlines (Town, Frostfell & Dungeon)
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const t = map.tiles[y][x];
        if (t === 3) {
          mctx.fillStyle = '#0284c7';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        } else if (t === 4) {
          // Dungeon Room Floor
          mctx.fillStyle = '#334155';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        } else if (t === 1) {
          // Path / Corridor
          mctx.fillStyle = '#475569';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        } else if (t === 7) {
          // Wall
          mctx.fillStyle = '#1e293b';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        } else if (t === 6) {
          // Portal
          mctx.fillStyle = '#c084fc';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        } else if (t === 9) {
          // Snow
          mctx.fillStyle = '#cbd5e1';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        } else if (t === 10) {
          // Frozen Ice Lake
          mctx.fillStyle = '#38bdf8';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        } else if (t === 11) {
          // Frost Stone
          mctx.fillStyle = '#64748b';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        } else if (t === 12) {
          // Frost Cliff
          mctx.fillStyle = '#1e293b';
          mctx.fillRect(x * scaleX, y * scaleY, scaleX + 1, scaleY + 1);
        }
      }
    }

    // Draw Loot as Yellow Dots
    if (gameState.groundItems) {
      mctx.fillStyle = '#facc15';
      for (const it of gameState.groundItems) {
        mctx.fillRect(it.x * scaleX - 1, it.y * scaleY - 1, 3, 3);
      }
    }

    // Draw Mobs as Red Dots
    if (gameState.mobs) {
      for (const mob of gameState.mobs) {
        if (mob.state === 'dead') continue;
        mctx.fillStyle = mob.isBoss ? '#f97316' : '#ef4444';
        const size = mob.isBoss ? 5 : 3;
        mctx.fillRect(mob.x * scaleX - size / 2, mob.y * scaleY - size / 2, size, size);
      }
    }

    // Draw Players
    if (gameState.players) {
      for (const p of gameState.players) {
        if (p.isDead) continue;
        const isLocal = p.id === localPlayerId;
        mctx.fillStyle = isLocal ? '#38bdf8' : '#22c55e';
        const px = p.x * scaleX;
        const py = p.y * scaleY;
        mctx.beginPath();
        mctx.arc(px, py, isLocal ? 4 : 3, 0, Math.PI * 2);
        mctx.fill();
      }
    }
  }
}

window.IsometricRenderer = IsometricRenderer;
