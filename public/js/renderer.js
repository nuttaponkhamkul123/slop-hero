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

    this.initCanvasSize();
    window.addEventListener('resize', () => this.initCanvasSize());
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
    this.animations.floatingTexts.push({
      x: worldX,
      y: worldY,
      text,
      color,
      size,
      vy: -0.6,
      life: 1.2,
      maxLife: 1.2
    });
  }

  triggerAttackAnimation(data) {
    if (!data || !data.attackerId) return;

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
      x: data.x,
      y: data.y,
      hasSweep: !!data.hasSweep
    });

    // Camera punchy impact shake!
    this.triggerScreenShake(isWarrior ? 7 : isRogue ? 5 : 6, 0.16);

    // Minecraft-Style Sweeping Edge Visual Effect
    if (data.hasSweep && !isMage) {
      this.animations.skillEffects.push({
        type: 'sweeping_edge',
        x: data.x,
        y: data.y,
        facing: data.facing || 'SE',
        life: 0.28,
        maxLife: 0.28,
        radius: isWarrior ? 2.5 : 2.0,
        class: data.class || 'warrior'
      });
      this.addParticles(data.x, data.y, 'slash', 22);
      this.addParticles(data.x, data.y, 'wind', 16);
    } else if (isMage) {
      this.addParticles(data.x, data.y, 'fire', 14);
    } else if (isRogue) {
      this.addParticles(data.x, data.y, 'shadow', 14);
      this.addParticles(data.x, data.y, 'slash', 10);
    } else {
      this.addParticles(data.x, data.y, 'slash', 18);
    }
  }

  addSkillEffect(fx) {
    if (!fx || !fx.type) return;
    const effect = {
      ...fx,
      life: fx.type === 'firestorm' ? 0.9 : fx.type === 'earthshaker' ? 0.8 : 0.65,
      maxLife: fx.type === 'firestorm' ? 0.9 : fx.type === 'earthshaker' ? 0.8 : 0.65
    };
    this.animations.skillEffects.push(effect);

    // Elemental Rune Particle Burst!
    if (fx.rune && fx.rune !== 'none') {
      const rx = fx.x !== undefined ? fx.x : (fx.startX !== undefined ? fx.startX : 0);
      const ry = fx.y !== undefined ? fx.y : (fx.startY !== undefined ? fx.startY : 0);
      if (fx.rune === 'flame') {
        this.addParticles(rx, ry, 'fire', 26);
      } else if (fx.rune === 'frost') {
        this.addParticles(rx, ry, 'ice', 26);
      } else if (fx.rune === 'tempest') {
        this.addParticles(rx, ry, 'arcane', 26);
      } else if (fx.rune === 'vampiric') {
        this.addParticles(rx, ry, 'shadow', 26);
      }
    }

    if (fx.type === 'whirlwind') {
      this.addParticles(fx.x, fx.y, 'wind', 36);
      this.triggerScreenShake(6, 0.15);
    } else if (fx.type === 'firestorm') {
      this.addParticles(fx.x, fx.y, 'fire', 48);
      this.triggerScreenShake(8, 0.22);
    } else if (fx.type === 'blade_charge') {
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'slash', 18);
      this.addParticles(fx.x, fx.y, 'slash', 24);
      this.triggerScreenShake(7, 0.18);
    } else if (fx.type === 'earthshaker') {
      this.addParticles(fx.x, fx.y, 'earth', 45);
      this.triggerScreenShake(12, 0.26);
    } else if (fx.type === 'frost_nova') {
      this.addParticles(fx.x, fx.y, 'ice', 42);
      this.triggerScreenShake(5, 0.15);
    } else if (fx.type === 'arcane_blink') {
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'arcane', 22);
      this.addParticles(fx.x, fx.y, 'arcane', 28);
      this.triggerScreenShake(4, 0.12);
    } else if (fx.type === 'fan_of_knives') {
      this.addParticles(fx.x, fx.y, 'slash', 28);
      this.addParticles(fx.x, fx.y, 'shadow', 20);
      this.triggerScreenShake(6, 0.16);
    } else if (fx.type === 'toxic_bomb') {
      this.addParticles(fx.x, fx.y, 'poison', 40);
      this.triggerScreenShake(5, 0.15);
    } else if (fx.type === 'shadow_dash') {
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'shadow', 24);
      this.addParticles(fx.x, fx.y, 'shadow', 24);
      this.triggerScreenShake(5, 0.14);
    } else if (fx.type === 'shadow_strike') {
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'shadow', 24);
      this.addParticles(fx.x, fx.y, 'shadow', 24);
    } else if (fx.type === 'colossus_strike') {
      this.addParticles(fx.x, fx.y, 'earth', 50);
      this.addParticles(fx.x, fx.y, 'slash', 35);
      this.triggerScreenShake(14, 0.3);
    } else if (fx.type === 'shield_slam') {
      this.addParticles(fx.x, fx.y, 'shield', 25);
      this.triggerScreenShake(6, 0.16);
    } else if (fx.type === 'blood_rage') {
      this.addParticles(fx.x, fx.y, 'fire', 30);
      this.triggerScreenShake(5, 0.14);
    } else if (fx.type === 'iron_fortress') {
      this.addParticles(fx.x, fx.y, 'shield', 30);
    } else if (fx.type === 'war_stomp') {
      this.addParticles(fx.x, fx.y, 'earth', 45);
      this.addParticles(fx.x, fx.y, 'wind', 25);
      this.triggerScreenShake(10, 0.22);
    } else if (fx.type === 'chain_lightning') {
      if (fx.points) {
        fx.points.forEach(pt => this.addParticles(pt.x, pt.y, 'arcane', 12));
      }
      this.triggerScreenShake(6, 0.18);
    } else if (fx.type === 'mana_shield') {
      this.addParticles(fx.x, fx.y, 'arcane', 30);
    } else if (fx.type === 'black_hole') {
      this.addParticles(fx.x, fx.y, 'shadow', 50);
      this.addParticles(fx.x, fx.y, 'arcane', 35);
      this.triggerScreenShake(12, 0.28);
    } else if (fx.type === 'blizzard') {
      this.addParticles(fx.x, fx.y, 'ice', 50);
      this.triggerScreenShake(6, 0.18);
    } else if (fx.type === 'pyroblast') {
      this.addParticles(fx.x, fx.y, 'fire', 45);
      this.triggerScreenShake(9, 0.22);
    } else if (fx.type === 'shadowstep') {
      this.addParticles(fx.startX || fx.x, fx.startY || fx.y, 'shadow', 24);
      this.addParticles(fx.x, fx.y, 'shadow', 30);
      this.triggerScreenShake(6, 0.15);
    } else if (fx.type === 'smoke_screen') {
      this.addParticles(fx.x, fx.y, 'shadow', 40);
      this.addParticles(fx.x, fx.y, 'poison', 20);
    } else if (fx.type === 'death_blossom') {
      this.addParticles(fx.x, fx.y, 'slash', 40);
      this.addParticles(fx.x, fx.y, 'shadow', 30);
      this.triggerScreenShake(10, 0.24);
    } else if (fx.type === 'poison_darts') {
      this.addParticles(fx.x, fx.y, 'poison', 25);
    } else if (fx.type === 'caltrops') {
      this.addParticles(fx.x, fx.y, 'earth', 20);
    }
  }

  addParticles(worldX, worldY, type = 'slash', count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 2.8;
      let color = '#38bdf8';
      let size = 3 + Math.random() * 4;
      let life = 0.45 + Math.random() * 0.45;

      if (type === 'fire') {
        const fireColors = ['#ef4444', '#f97316', '#facc15', '#fbbf24', '#ffffff'];
        color = fireColors[Math.floor(Math.random() * fireColors.length)];
        size = 4 + Math.random() * 5;
      } else if (type === 'wind') {
        const windColors = ['#38bdf8', '#7dd3fc', '#bae6fd', '#ffffff', '#e0f2fe'];
        color = windColors[Math.floor(Math.random() * windColors.length)];
        size = 3.5 + Math.random() * 4;
      } else if (type === 'shadow') {
        const shadowColors = ['#a855f7', '#9333ea', '#7c3aed', '#6366f1', '#3b0764'];
        color = shadowColors[Math.floor(Math.random() * shadowColors.length)];
        size = 3.5 + Math.random() * 4.5;
      } else if (type === 'slash') {
        const slashColors = ['#ffffff', '#bae6fd', '#38bdf8', '#e2e8f0'];
        color = slashColors[Math.floor(Math.random() * slashColors.length)];
        size = 3 + Math.random() * 3.5;
      } else if (type === 'ice') {
        const iceColors = ['#06b6d4', '#67e8f9', '#a5f3fc', '#ffffff', '#e0f2fe'];
        color = iceColors[Math.floor(Math.random() * iceColors.length)];
        size = 3.5 + Math.random() * 4.5;
      } else if (type === 'earth') {
        const earthColors = ['#d97706', '#b45309', '#f59e0b', '#78350f', '#fde68a'];
        color = earthColors[Math.floor(Math.random() * earthColors.length)];
        size = 3.5 + Math.random() * 5.0;
      } else if (type === 'poison') {
        const poisonColors = ['#22c55e', '#4ade80', '#16a34a', '#86efac', '#14532d'];
        color = poisonColors[Math.floor(Math.random() * poisonColors.length)];
        size = 3.5 + Math.random() * 4.5;
      } else if (type === 'arcane') {
        const arcaneColors = ['#c084fc', '#e879f9', '#38bdf8', '#818cf8', '#ffffff'];
        color = arcaneColors[Math.floor(Math.random() * arcaneColors.length)];
        size = 3.5 + Math.random() * 4.5;
      } else if (type === 'gold' || type === 'loot') {
        const goldColors = ['#facc15', '#fde047', '#eab308', '#ffffff'];
        color = goldColors[Math.floor(Math.random() * goldColors.length)];
        size = 3.5 + Math.random() * 3.5;
      } else if (type === 'level') {
        const lvlColors = ['#38bdf8', '#818cf8', '#c084fc', '#facc15'];
        color = lvlColors[Math.floor(Math.random() * lvlColors.length)];
        size = 4 + Math.random() * 4.5;
      }

      this.animations.particles.push({
        x: worldX,
        y: worldY,
        z: 0.3 + Math.random() * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: 1.0 + Math.random() * 1.5,
        type,
        color,
        size,
        life,
        maxLife: life
      });
    }
  }

  render(gameState, localPlayerId, selectedTargetId, dt) {
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

    // 8-Directional Orientation
    const facing = player.facing || 'S';
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

    ctx.save();
    // Anchor at player center-ground
    ctx.translate(screen.x, screen.y - 14 * z - walkBob);
    if (isFacingLeft) ctx.scale(-1, 1);

    // Attack state
    const attack = this.attacks ? this.attacks.get(player.id) : null;
    const isAttacking = attack && (performance.now() - attack.time < attack.duration);
    const attackProg = isAttacking ? (performance.now() - attack.time) / attack.duration : 0;
    const attackLean = isAttacking ? Math.sin(attackProg * Math.PI) * 6 * z : 0;

    // Skin Palette
    const skinBase = '#fec89a';
    const skinShadow = '#f4a261';
    const skinBlush = 'rgba(244, 63, 94, 0.25)';

    // =========================================================================
    // LAYER 1: BACK CAPE / BACK COWL (Rendered behind body in Front View, or covering Back in Back View)
    // =========================================================================
    if (player.characterClass === 'warrior') {
      const capeWave = Math.sin(t * 6 + (isMoving ? 3 : 0)) * (isMoving ? 7 : 3) * z;
      ctx.save();
      if (isBackView) {
        // Back View: Majestic Full Cape draped across the back
        ctx.beginPath();
        ctx.moveTo(-8 * z + attackLean, -18 * z);
        ctx.lineTo(8 * z + attackLean, -18 * z);
        ctx.quadraticCurveTo(12 * z + capeWave, 0, 10 * z + capeWave, 16 * z);
        ctx.lineTo(-10 * z + capeWave, 16 * z);
        ctx.quadraticCurveTo(-12 * z + capeWave, 0, -8 * z + attackLean, -18 * z);
        ctx.closePath();
        ctx.fillStyle = '#991b1b'; // Deep royal crimson
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.2 * z;
        ctx.stroke();
      } else {
        // Front View: Cape billows out from behind shoulders
        ctx.beginPath();
        ctx.moveTo(-7 * z + attackLean, -18 * z);
        ctx.lineTo(2 * z + attackLean, -18 * z);
        ctx.quadraticCurveTo(-10 * z + capeWave, 0, -14 * z + capeWave, 16 * z);
        ctx.lineTo(-4 * z + capeWave, 17 * z);
        ctx.quadraticCurveTo(-2 * z, 0, 1 * z + attackLean, -17 * z);
        ctx.closePath();
        ctx.fillStyle = '#991b1b';
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1 * z;
        ctx.stroke();
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
    // Thigh / Pants
    ctx.fillStyle = player.characterClass === 'warrior' ? '#334155' : player.characterClass === 'mage' ? '#1e1b4b' : '#0f172a';
    ctx.fillRect(-2.5 * z, 0, 5 * z, 8 * z);
    // Knee pad / Greave
    ctx.fillStyle = player.characterClass === 'warrior' ? '#64748b' : '#334155';
    ctx.fillRect(-2.5 * z, 5 * z, 5 * z, 4 * z);
    // Boot / Foot
    ctx.fillStyle = hasWingedBoots ? '#e0f2fe' : (player.characterClass === 'warrior' ? '#475569' : '#1e293b');
    ctx.fillRect(-3 * z, 8 * z, 6 * z, 6 * z);
    // Sole
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-3.5 * z, 13 * z, 7 * z, 2 * z);
    ctx.restore();

    // Right Leg (Front Leg)
    ctx.save();
    ctx.translate(4 * z, -2 * z);
    ctx.rotate(legR_Angle);
    // Thigh / Pants
    ctx.fillStyle = player.characterClass === 'warrior' ? '#1e293b' : player.characterClass === 'mage' ? '#1e1b4b' : '#0f172a';
    ctx.fillRect(-2.5 * z, 0, 5 * z, 8 * z);
    // Knee pad
    ctx.fillStyle = player.characterClass === 'warrior' ? '#64748b' : '#334155';
    ctx.fillRect(-2.5 * z, 5 * z, 5 * z, 4 * z);
    // Boot
    ctx.fillStyle = hasWingedBoots ? '#e0f2fe' : (player.characterClass === 'warrior' ? '#475569' : '#1e293b');
    ctx.fillRect(-2.5 * z, 8 * z, 6 * z, 6 * z);
    // Sole
    ctx.fillStyle = '#0f172a';
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
        // Back View: Solid Steel Backplate & Spine Guard
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(-8 * z, -18 * z);
        ctx.lineTo(8 * z, -18 * z);
        ctx.lineTo(6.5 * z, -6 * z);
        ctx.lineTo(-6.5 * z, -6 * z);
        ctx.closePath();
        ctx.fill();

        // Spine Ridge
        ctx.fillStyle = '#475569';
        ctx.fillRect(-2 * z, -17 * z, 4 * z, 11 * z);
      } else {
        // Front View: Polished Breastplate with Golden Royal Cross
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(-8 * z, -18 * z);
        ctx.lineTo(8 * z, -18 * z);
        ctx.lineTo(6.5 * z, -6 * z);
        ctx.lineTo(-6.5 * z, -6 * z);
        ctx.closePath();
        ctx.fill();

        // Steel Chest Plate Highlight (Pecs contour)
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-6 * z, -16 * z, 12 * z, 5 * z);

        // Golden Royal Cross Crest
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-1.5 * z, -16 * z, 3 * z, 9 * z);
        ctx.fillRect(-5 * z, -13 * z, 10 * z, 2.5 * z);
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
    // LAYER 4: SHOULDERS & ARMS (Left Arm / Shield)
    // =========================================================================
    ctx.save();
    ctx.translate(-7 * z + attackLean, -17 * z);
    ctx.rotate(armL_Angle);

    // Pauldron / Shoulder Guard
    ctx.fillStyle = player.characterClass === 'warrior' ? '#334155' : player.characterClass === 'mage' ? '#4c1d95' : '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, 4 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1 * z;
    ctx.stroke();

    // Forearm & Hand
    ctx.fillStyle = skinBase;
    ctx.fillRect(-1.5 * z, 2 * z, 3 * z, 7 * z);

    // Ornate Kite Shield on Left Arm (Warrior)
    if (player.characterClass === 'warrior') {
      ctx.save();
      ctx.translate(-2 * z, 4 * z);
      ctx.beginPath();
      ctx.moveTo(-6 * z, -8 * z);
      ctx.lineTo(6 * z, -8 * z);
      ctx.lineTo(5 * z, 6 * z);
      ctx.lineTo(0, 14 * z);
      ctx.lineTo(-5 * z, 6 * z);
      ctx.closePath();
      ctx.fillStyle = '#1e3a8a';
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.8 * z;
      ctx.stroke();
      if (!isBackView) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-1 * z, -3 * z, 2 * z, 10 * z);
        ctx.fillRect(-3.5 * z, 0, 7 * z, 2 * z);
      }
      ctx.restore();
    } else if (player.characterClass === 'rogue') {
      const stabLeft = isAttacking ? Math.cos(attackProg * Math.PI * 2) * 12 * z : 0;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-2 * z + stabLeft, 6 * z, 3 * z, 14 * z);
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(-1 * z + stabLeft, 7 * z, 1.5 * z, 12 * z);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-3.5 * z + stabLeft, 6 * z, 6 * z, 2.5 * z);
    }
    ctx.restore();

    // =========================================================================
    // LAYER 5: HUMAN HEAD, FACE & HAIR (Front vs Back vs Profile)
    // =========================================================================
    ctx.save();
    ctx.translate(attackLean, -26 * z);

    // Hair Colors per class
    const hairColor = player.characterClass === 'warrior' ? '#d97706' : // Golden-Blonde / Chestnut
                      player.characterClass === 'mage' ? '#e2e8f0' :    // Mystic Platinum Silver
                      '#1e1b4b';                                        // Midnight Raven Indigo

    const hairHighlight = player.characterClass === 'warrior' ? '#fde68a' :
                          player.characterClass === 'mage' ? '#ffffff' :
                          '#818cf8';

    if (isBackView) {
      // =====================================================================
      // BACK VIEW OF HEAD: Rich flowing hair, back of helm/hat, no face!
      // =====================================================================
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.arc(0, 0, 8.5 * z, 0, Math.PI * 2);
      ctx.fill();

      // Flowing hair strands cascading down the back of the neck
      ctx.beginPath();
      ctx.moveTo(-7.5 * z, 0);
      ctx.quadraticCurveTo(-9.5 * z, 7 * z, -6 * z, 12 * z);
      ctx.lineTo(6 * z, 12 * z);
      ctx.quadraticCurveTo(9.5 * z, 7 * z, 7.5 * z, 0);
      ctx.closePath();
      ctx.fillStyle = hairColor;
      ctx.fill();

      // Hair strand highlights
      ctx.fillStyle = hairHighlight;
      ctx.fillRect(-2.5 * z, -2 * z, 5 * z, 7 * z);

      // Back of Headwear
      if (player.characterClass === 'warrior') {
        // Back of Golden Circlet & Feather Plume trailing back
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-6.5 * z, -5 * z, 13 * z, 2.2 * z);
        // Crimson Plume fluttering backwards
        const plumeWave = Math.sin(t * 6) * 3 * z;
        ctx.beginPath();
        ctx.moveTo(-1 * z, -6 * z);
        ctx.quadraticCurveTo(-6 * z + plumeWave, -16 * z, -12 * z + plumeWave, -14 * z);
        ctx.lineTo(-2 * z, -6 * z);
        ctx.closePath();
        ctx.fillStyle = '#ef4444';
        ctx.fill();

      } else if (player.characterClass === 'mage') {
        // Back of Wizard Hat Cone & Brim
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
        // Ninja Headband Back Knot & Two Fluttering Ribbon Tails
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-6.5 * z, -4.5 * z, 13 * z, 2.8 * z);
        // Knot
        ctx.fillRect(-2 * z, -3.5 * z, 4 * z, 3 * z);

        // Fluttering ribbon tails in wind
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
      // =====================================================================
      // FRONT / SIDE VIEW OF HEAD: Expressive Human Face, Anime Eyes & Bangs
      // =====================================================================
      // 1. Back hair volume
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.arc(0, 0, 8.5 * z, 0, Math.PI * 2);
      ctx.fill();

      // 2. Human Skin Face Contour
      ctx.fillStyle = skinBase;
      ctx.beginPath();
      ctx.arc(0, 1 * z, 6.8 * z, 0, Math.PI * 2);
      ctx.fill();

      // Cheeks Blush
      ctx.fillStyle = skinBlush;
      ctx.beginPath();
      ctx.arc(-3.8 * z, 2.8 * z, 1.8 * z, 0, Math.PI * 2);
      ctx.arc(3.8 * z, 2.8 * z, 1.8 * z, 0, Math.PI * 2);
      ctx.fill();

      // Ears
      ctx.fillStyle = skinBase;
      ctx.beginPath();
      ctx.arc(-6.5 * z, 1.5 * z, 1.8 * z, 0, Math.PI * 2);
      ctx.arc(6.5 * z, 1.5 * z, 1.8 * z, 0, Math.PI * 2);
      ctx.fill();

      // 3. Expressive RPG Eyes with Specular Highlight
      const eyeIrisColor = player.characterClass === 'warrior' ? '#0284c7' :
                           player.characterClass === 'mage' ? '#8b5cf6' :
                           '#16a34a';

      const drawEye = (ex, ey) => {
        // Eyelash line
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(ex - 2.5 * z, ey - 2.5 * z, 5 * z, 1.3 * z);
        // White sclera
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ex - 2 * z, ey - 1.2 * z, 4 * z, 3 * z);
        // Iris
        ctx.fillStyle = eyeIrisColor;
        ctx.fillRect(ex - 1.2 * z, ey - 1.2 * z, 2.8 * z, 3 * z);
        // Pupil
        ctx.fillStyle = '#09090b';
        ctx.fillRect(ex - 0.7 * z, ey - 0.7 * z, 1.8 * z, 2 * z);
        // White Catchlight
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ex - 0.3 * z, ey - 1.0 * z, 1.0 * z, 1.0 * z);
      };

      if (isDirectSouth) {
        // Direct Front: Centered eyes looking at player
        drawEye(-2.5 * z, 1 * z);
        drawEye(2.5 * z, 1 * z);
      } else if (isDirectSide) {
        // Pure Side/Profile: One prominent forward-facing eye
        drawEye(2.0 * z, 1 * z);
      } else {
        // 3/4 Diagonal View (SE / SW)
        drawEye(-1.5 * z, 1 * z);
        drawEye(3.0 * z, 1 * z);
      }

      // Smile / Mouth
      ctx.fillStyle = '#b45309';
      ctx.fillRect(-1.2 * z, 5.5 * z, 2.4 * z, 0.9 * z);

      // Rogue Ninja Lower Half Mask
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
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 0.8 * z;
        ctx.stroke();
      }

      // 4. Front Layered Anime Hair (Bangs & Locks)
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

      // Hair Shimmer Highlight
      ctx.fillStyle = hairHighlight;
      ctx.fillRect(-3 * z, -4.5 * z, 6 * z, 1.2 * z);

      // 5. Headwear (Warrior Circlet, Mage Hat, Rogue Bandana)
      if (player.characterClass === 'warrior') {
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-6.5 * z, -5 * z, 13 * z, 2.2 * z);
        ctx.beginPath();
        ctx.arc(0, -5 * z, 2 * z, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-2 * z, -6 * z);
        ctx.quadraticCurveTo(-6 * z, -14 * z, -10 * z, -12 * z);
        ctx.lineTo(-3 * z, -6 * z);
        ctx.closePath();
        ctx.fillStyle = '#ef4444';
        ctx.fill();

      } else if (player.characterClass === 'mage') {
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

    ctx.restore(); // End Layer 5 Head

    // =========================================================================
    // LAYER 6: RIGHT ARM & WEAPON (Attacking / Idle Hand)
    // =========================================================================
    ctx.save();
    ctx.translate(7 * z + attackLean, -16 * z);

    // Right Pauldron
    ctx.fillStyle = player.characterClass === 'warrior' ? '#475569' : player.characterClass === 'mage' ? '#4c1d95' : '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, 4.2 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1 * z;
    ctx.stroke();

    if (player.characterClass === 'warrior') {
      // Right Hand with Broadsword
      ctx.rotate(armR_Angle);

      // Human Forearm & Gauntlet
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-1.5 * z, 2 * z, 3 * z, 6 * z);

      // Hand / Knuckles
      ctx.fillStyle = skinBase;
      ctx.beginPath();
      ctx.arc(0, 8 * z, 2 * z, 0, Math.PI * 2);
      ctx.fill();

      // Broadsword Attack or Idle
      ctx.save();
      if (isAttacking) {
        const swingAngle = -1.2 + Math.sin(attackProg * Math.PI) * 2.8;
        ctx.translate(0, 8 * z);
        ctx.rotate(swingAngle);

        // Blade Body
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-2 * z, -28 * z, 4 * z, 30 * z);
        // Golden Crossguard & Pommel
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-6 * z, 0, 12 * z, 3 * z);
        ctx.beginPath();
        ctx.arc(0, 5 * z, 2.5 * z, 0, Math.PI * 2);
        ctx.fill();

        // High-Speed Slashing Light Arc
        ctx.beginPath();
        ctx.arc(0, -18 * z, 28 * z, -0.8, 1.6);
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.95 * (1 - attackProg)})`;
        ctx.lineWidth = 6 * z;
        ctx.stroke();
      } else {
        // Resting Sword Pose
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, -20 * z, 3.5 * z, 28 * z);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-3 * z, 6 * z, 8 * z, 2.8 * z);
        ctx.beginPath();
        ctx.arc(1 * z, 10 * z, 2 * z, 0, Math.PI * 2);
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

        if (fx.type === 'sweeping_edge') {
          // Minecraft-Style Sweeping Edge Crescent Slash Arc
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.35, this.camera, this.canvas.width, this.canvas.height);
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

          // Sweeping crescent sweep span: from -0.85 rad to +0.85 rad
          const sweepSpan = Math.PI * 0.44;

          // Outer glowing crescent body
          ctx.beginPath();
          ctx.arc(0, 0, outerR, -sweepSpan, sweepSpan, false);
          ctx.arc(0, 0, innerR, sweepSpan, -sweepSpan, true);
          ctx.closePath();

          const crescentGrad = ctx.createRadialGradient(0, 0, innerR, 0, 0, outerR);
          crescentGrad.addColorStop(0, `rgba(56, 189, 248, 0)`);
          crescentGrad.addColorStop(0.45, `rgba(186, 230, 253, ${alpha * 0.75})`);
          crescentGrad.addColorStop(0.85, `rgba(255, 255, 255, ${alpha * 0.98})`);
          crescentGrad.addColorStop(1, `rgba(56, 189, 248, ${alpha * 0.9})`);
          ctx.fillStyle = crescentGrad;
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 14 * z;
          ctx.fill();

          // Brilliant White Razor Blade Edge
          ctx.beginPath();
          ctx.arc(0, 0, outerR, -sweepSpan, sweepSpan, false);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();

          // Sweeping wind speed trails (concentric thin cutting arcs)
          for (let s = 1; s <= 2; s++) {
            const trailR = innerR + (outerR - innerR) * (s * 0.35);
            ctx.beginPath();
            ctx.arc(0, 0, trailR, -sweepSpan * 0.82, sweepSpan * 0.82, false);
            ctx.strokeStyle = `rgba(224, 242, 254, ${alpha * 0.75})`;
            ctx.lineWidth = 2 * z;
            ctx.stroke();
          }

          ctx.restore();
        } else if (fx.type === 'whirlwind') {
          // Whirlwind Spinning Wind Cyclone Rings
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.2) * 28 * z * (0.6 + progress * 0.5);
          const rot = this.animations.time * 14;

          ctx.save();
          ctx.translate(screen.x, screen.y);
          ctx.rotate(rot);

          // Outer Spinning Wind Arc
          ctx.beginPath();
          ctx.ellipse(0, 0, rad, rad * 0.5, 0, 0, Math.PI * 1.7);
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.95})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();

          // Inner Cyclone Arc
          ctx.beginPath();
          ctx.ellipse(0, 0, rad * 0.65, rad * 0.32, Math.PI * 0.6, 0, Math.PI * 1.6);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
          ctx.lineWidth = 3 * z;
          ctx.stroke();

          ctx.restore();
        } else if (fx.type === 'firestorm') {
          // Firestorm Expanding Flame Shockwave
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.5) * 32 * z * Math.min(1.0, progress * 1.4);

          ctx.save();
          const grad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          grad.addColorStop(0, `rgba(255, 255, 220, ${alpha * 0.95})`);
          grad.addColorStop(0.3, `rgba(249, 115, 22, ${alpha * 0.8})`);
          grad.addColorStop(0.7, `rgba(239, 68, 68, ${alpha * 0.5})`);
          grad.addColorStop(1, 'rgba(239, 68, 68, 0)');

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.85})`;
          ctx.lineWidth = 3 * z;
          ctx.stroke();
          ctx.restore();
        } else if (fx.type === 'blade_charge') {
          // Warrior Blade Charge - Golden Steel Rush Streak & Slashes
          const p1 = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const p2 = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);

          ctx.save();
          // Outer Gold Glow Streak
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(245, 158, 11, ${alpha * 0.85})`;
          ctx.lineWidth = 10 * z;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Inner Gleaming Steel Beam
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.lineWidth = 3.5 * z;
          ctx.stroke();

          // Slash crosscuts along the dash
          const midX = (p1.x + p2.x) * 0.5;
          const midY = (p1.y + p2.y) * 0.5;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy) || 1;
          const px = -dy / len;
          const py = dx / len;
          const cutSize = 16 * z;

          ctx.beginPath();
          ctx.moveTo(midX - px * cutSize, midY - py * cutSize);
          ctx.lineTo(midX + px * cutSize, midY + py * cutSize);
          ctx.strokeStyle = `rgba(254, 240, 138, ${alpha * 0.9})`;
          ctx.lineWidth = 3 * z;
          ctx.stroke();

          // Impact flare at destination
          const flareRad = 24 * z * progress;
          ctx.beginPath();
          ctx.ellipse(p2.x, p2.y, flareRad, flareRad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251, 191, 36, ${alpha * 0.6})`;
          ctx.fill();
          ctx.restore();
        } else if (fx.type === 'earthshaker') {
          // Warrior Earthshaker Slam - Ground Fissures & Shockwave
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.4) * 26 * z * Math.min(1.0, progress * 1.5);

          ctx.save();
          // Amber shockwave fill
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(217, 119, 6, ${alpha * 0.35})`;
          ctx.fill();

          // Heavy outer shockwave border
          ctx.strokeStyle = `rgba(245, 158, 11, ${alpha * 0.9})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();

          // Jagged earth fissure cracks radiating outward
          ctx.strokeStyle = `rgba(120, 53, 15, ${alpha * 0.95})`;
          ctx.lineWidth = 2.5 * z;
          for (let a = 0; a < 6; a++) {
            const angle = (a * Math.PI / 3) + 0.2;
            const crackLen = rad * 0.9;
            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y);
            const midCrackX = screen.x + Math.cos(angle) * (crackLen * 0.5) + (Math.sin(a * 4) * 6 * z);
            const midCrackY = screen.y + Math.sin(angle) * (crackLen * 0.25) + (Math.cos(a * 4) * 4 * z);
            const endCrackX = screen.x + Math.cos(angle) * crackLen;
            const endCrackY = screen.y + Math.sin(angle) * (crackLen * 0.5);
            ctx.lineTo(midCrackX, midCrackY);
            ctx.lineTo(endCrackX, endCrackY);
            ctx.stroke();
          }
          ctx.restore();
        } else if (fx.type === 'frost_nova') {
          // Mage Frost Nova - Crystalline Blizzard Ring
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.0) * 24 * z * Math.min(1.0, progress * 1.6);

          ctx.save();
          // Ice blue inner gradient
          const iceGrad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          iceGrad.addColorStop(0, `rgba(224, 242, 254, ${alpha * 0.8})`);
          iceGrad.addColorStop(0.5, `rgba(56, 189, 248, ${alpha * 0.5})`);
          iceGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = iceGrad;
          ctx.fill();

          // Ring edge
          ctx.strokeStyle = `rgba(186, 230, 253, ${alpha * 0.95})`;
          ctx.lineWidth = 3.5 * z;
          ctx.stroke();

          // 8 Snowflake crystal spikes
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
          ctx.lineWidth = 2 * z;
          for (let a = 0; a < 8; a++) {
            const angle = (a * Math.PI / 4) + (this.animations.time * 2);
            ctx.beginPath();
            ctx.moveTo(screen.x + Math.cos(angle) * (rad * 0.7), screen.y + Math.sin(angle) * (rad * 0.35));
            ctx.lineTo(screen.x + Math.cos(angle) * (rad * 1.15), screen.y + Math.sin(angle) * (rad * 0.58));
            ctx.stroke();
          }
          ctx.restore();
        } else if (fx.type === 'arcane_blink') {
          // Mage Arcane Blink - Cosmic Portal Rifts
          const p1 = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const p2 = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);

          ctx.save();
          // Arcane beam connecting points
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.75})`;
          ctx.lineWidth = 5 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(224, 231, 255, ${alpha * 0.95})`;
          ctx.lineWidth = 1.8 * z;
          ctx.stroke();

          // Origin collapsing rift
          const r1 = 20 * z * (1.0 - progress);
          ctx.beginPath();
          ctx.ellipse(p1.x, p1.y, r1, r1 * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(192, 132, 252, ${alpha})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();

          // Destination expanding cosmic burst
          const r2 = 28 * z * Math.min(1.0, progress * 1.5);
          ctx.beginPath();
          ctx.ellipse(p2.x, p2.y, r2, r2 * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.9})`;
          ctx.lineWidth = 3 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.ellipse(p2.x, p2.y, r2 * 0.7, r2 * 0.35, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(168, 85, 247, ${alpha * 0.4})`;
          ctx.fill();
          ctx.restore();
        } else if (fx.type === 'fan_of_knives') {
          // Rogue Fan of Knives - Whirling Spiral Daggers
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.4) * 25 * z * Math.min(1.0, progress * 1.5);
          const rot = this.animations.time * 12;

          ctx.save();
          // Central flash
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, 14 * z, 7 * z, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(168, 85, 247, ${alpha * 0.6})`;
          ctx.fill();

          // Radiating flying daggers
          for (let k = 0; k < 10; k++) {
            const angle = (k * (Math.PI * 2 / 10)) + rot;
            const kx = screen.x + Math.cos(angle) * rad;
            const ky = screen.y + Math.sin(angle) * (rad * 0.5);

            ctx.save();
            ctx.translate(kx, ky);
            ctx.rotate(angle + Math.PI * 0.25);
            ctx.beginPath();
            ctx.moveTo(0, -6 * z);
            ctx.lineTo(2 * z, 4 * z);
            ctx.lineTo(-2 * z, 4 * z);
            ctx.closePath();
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.9})`;
            ctx.lineWidth = 1.5 * z;
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();
        } else if (fx.type === 'toxic_bomb') {
          // Rogue Toxic Smoke Bomb - Bubbling Acidic Puddle & Fog
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.2) * 26 * z * Math.min(1.0, progress * 1.4);

          ctx.save();
          const toxGrad = ctx.createRadialGradient(screen.x, screen.y, 2 * z, screen.x, screen.y, rad);
          toxGrad.addColorStop(0, `rgba(74, 222, 128, ${alpha * 0.75})`);
          toxGrad.addColorStop(0.6, `rgba(34, 197, 94, ${alpha * 0.5})`);
          toxGrad.addColorStop(1, 'rgba(20, 83, 45, 0)');

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = toxGrad;
          ctx.fill();

          ctx.strokeStyle = `rgba(134, 239, 172, ${alpha * 0.85})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();
          ctx.restore();
        } else if (fx.type === 'shadow_dash') {
          // Rogue Shadow Dash - Obsidian Phantom Dash & Smoke
          const p1 = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const p2 = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);

          ctx.save();
          // Shadow trail beam
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(147, 51, 234, ${alpha * 0.85})`;
          ctx.lineWidth = 8 * z;
          ctx.lineCap = 'round';
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.lineWidth = 2.2 * z;
          ctx.stroke();

          // Smoke puff at start
          ctx.beginPath();
          ctx.ellipse(p1.x, p1.y, 18 * z, 9 * z, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(59, 7, 100, ${alpha * 0.6})`;
          ctx.fill();
          ctx.restore();
        } else if (fx.type === 'shadow_strike') {
          // Shadow Strike Dash Beam
          const p1 = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const p2 = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.85})`;
          ctx.lineWidth = 6 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();
          ctx.restore();
        } else if (fx.type === 'colossus_strike') {
          // Colossus Decapitate - Massive Golden Greatsword Leap & Ground Shatter
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.0) * 32 * z * Math.min(1.0, progress * 1.5);

          ctx.save();
          // Impact crater radial gradient
          const grad = ctx.createRadialGradient(screen.x, screen.y, 4 * z, screen.x, screen.y, rad);
          grad.addColorStop(0, `rgba(254, 240, 138, ${alpha * 0.9})`);
          grad.addColorStop(0.35, `rgba(245, 158, 11, ${alpha * 0.7})`);
          grad.addColorStop(0.8, `rgba(180, 83, 9, ${alpha * 0.4})`);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();

          // Golden fracture rings
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.95})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();
          ctx.restore();
        } else if (fx.type === 'shield_slam') {
          // Aegis Shield Bash Flash
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const rad = 22 * z * (0.8 + progress * 0.6);

          ctx.save();
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.9})`;
          ctx.lineWidth = 3.5 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad * 0.6, rad * 0.3, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(250, 204, 21, ${alpha * 0.4})`;
          ctx.fill();
          ctx.restore();
        } else if (fx.type === 'blood_rage') {
          // Berserker Blood Rage Aura Ring
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.2, this.camera, this.canvas.width, this.canvas.height);
          const rad = 26 * z * (0.7 + progress * 0.5);

          ctx.save();
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.9})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad * 0.7, rad * 0.35, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(185, 28, 28, ${alpha * 0.4})`;
          ctx.fill();
          ctx.restore();
        } else if (fx.type === 'iron_fortress') {
          // Iron Fortress Hexagonal Ring
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.3, this.camera, this.canvas.width, this.canvas.height);
          const rad = 28 * z;

          ctx.save();
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(148, 163, 184, ${alpha * 0.9})`;
          ctx.lineWidth = 3 * z;
          ctx.stroke();
          ctx.restore();
        } else if (fx.type === 'war_stomp') {
          // Thunder War Stomp
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.2) * 25 * z * Math.min(1.0, progress * 1.5);

          ctx.save();
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.9})`;
          ctx.lineWidth = 3.5 * z;
          ctx.stroke();

          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad * 0.7, rad * 0.35, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.8})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();
          ctx.restore();
        } else if (fx.type === 'chain_lightning') {
          // Chain Lightning Arcs Connecting Points
          if (fx.points && fx.points.length > 1) {
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < fx.points.length - 1; i++) {
              const pt1 = Isometric.worldToScreen(fx.points[i].x, fx.points[i].y, 0.4, this.camera, this.canvas.width, this.canvas.height);
              const pt2 = Isometric.worldToScreen(fx.points[i + 1].x, fx.points[i + 1].y, 0.4, this.camera, this.canvas.width, this.canvas.height);
              const midX = (pt1.x + pt2.x) * 0.5 + (Math.random() - 0.5) * 16 * z;
              const midY = (pt1.y + pt2.y) * 0.5 + (Math.random() - 0.5) * 16 * z;
              ctx.moveTo(pt1.x, pt1.y);
              ctx.lineTo(midX, midY);
              ctx.lineTo(pt2.x, pt2.y);
            }
            ctx.strokeStyle = `rgba(103, 232, 249, ${alpha * 0.95})`;
            ctx.lineWidth = 3 * z;
            ctx.stroke();

            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            ctx.lineWidth = 1.5 * z;
            ctx.stroke();
            ctx.restore();
          }
        } else if (fx.type === 'mana_shield') {
          // Arcane Mana Shield Bubble
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const rad = 25 * z;

          ctx.save();
          ctx.beginPath();
          ctx.arc(screen.x, screen.y - 12 * z, rad, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.35})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(103, 232, 249, ${alpha * 0.9})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();
          ctx.restore();
        } else if (fx.type === 'black_hole') {
          // Cosmic Singularity - Swirling Void Vortex
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.8) * 26 * z * (0.6 + progress * 0.6);
          const rot = this.animations.time * 16;

          ctx.save();
          ctx.translate(screen.x, screen.y);
          ctx.rotate(rot);

          // Deep void core
          ctx.beginPath();
          ctx.ellipse(0, 0, rad * 0.5, rad * 0.25, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(15, 23, 42, ${alpha * 0.95})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.95})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();

          // Outer accretion ring
          ctx.beginPath();
          ctx.ellipse(0, 0, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(192, 132, 252, ${alpha * 0.75})`;
          ctx.lineWidth = 2.5 * z;
          ctx.stroke();
          ctx.restore();
        } else if (fx.type === 'blizzard') {
          // Glacial Blizzard Hail Storm
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.4) * 24 * z;

          ctx.save();
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(186, 230, 253, ${alpha * 0.28})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.8})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();
          ctx.restore();
        } else if (fx.type === 'pyroblast') {
          // Pyroblast Fireball Blast
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const rad = 28 * z * Math.min(1.0, progress * 1.5);

          ctx.save();
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, rad, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(249, 115, 22, ${alpha * 0.7})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(254, 240, 138, ${alpha * 0.95})`;
          ctx.lineWidth = 3 * z;
          ctx.stroke();
          ctx.restore();
        } else if (fx.type === 'shadowstep') {
          // Shadowstep Flash
          const p1 = Isometric.worldToScreen(fx.startX || fx.x, fx.startY || fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const p2 = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.8})`;
          ctx.lineWidth = 4 * z;
          ctx.stroke();
          ctx.restore();
        } else if (fx.type === 'smoke_screen') {
          // Smoke Screen
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.3, this.camera, this.canvas.width, this.canvas.height);
          const rad = 28 * z * (0.8 + progress * 0.5);

          ctx.save();
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(75, 85, 99, ${alpha * 0.65})`;
          ctx.fill();
          ctx.restore();
        } else if (fx.type === 'death_blossom') {
          // Death Blossom Omnislash Flurry
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 4.0) * 26 * z;

          ctx.save();
          for (let s = 0; s < 6; s++) {
            const angle = (s * Math.PI / 3) + progress * 8;
            const x1 = screen.x + Math.cos(angle) * (rad * 0.3);
            const y1 = screen.y + Math.sin(angle) * (rad * 0.15);
            const x2 = screen.x + Math.cos(angle) * rad;
            const y2 = screen.y + Math.sin(angle) * (rad * 0.5);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = `rgba(244, 114, 182, ${alpha * 0.9})`;
            ctx.lineWidth = 2.5 * z;
            ctx.stroke();
          }
          ctx.restore();
        } else if (fx.type === 'poison_darts') {
          // Venom Shurikens
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0.4, this.camera, this.canvas.width, this.canvas.height);
          ctx.save();
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, 16 * z * progress, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(74, 222, 128, ${alpha * 0.9})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();
          ctx.restore();
        } else if (fx.type === 'caltrops') {
          // Barbed Caltrops
          const screen = Isometric.worldToScreen(fx.x, fx.y, 0, this.camera, this.canvas.width, this.canvas.height);
          const rad = (fx.radius || 3.2) * 22 * z;
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(148, 163, 184, ${alpha * 0.6})`;
          ctx.lineWidth = 2 * z;
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 2. Dynamic Particles
    for (let i = this.animations.particles.length - 1; i >= 0; i--) {
      const p = this.animations.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.life -= dt;

      if (p.life <= 0) {
        this.animations.particles.splice(i, 1);
        continue;
      }

      const screen = Isometric.worldToScreen(p.x, p.y, p.z, this.camera, this.canvas.width, this.canvas.height);
      const alpha = p.life / p.maxLife;

      ctx.save();
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, p.size * z * alpha, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.restore();
    }

    // 3. Floating Combat Damage Numbers
    for (let i = this.animations.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.animations.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;

      if (ft.life <= 0) {
        this.animations.floatingTexts.splice(i, 1);
        continue;
      }

      const screen = Isometric.worldToScreen(ft.x, ft.y, 0.8, this.camera, this.canvas.width, this.canvas.height);
      const alpha = Math.min(1, ft.life / (ft.maxLife * 0.4));

      ctx.save();
      ctx.font = `bold ${Math.round(ft.size * z)}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = alpha;

      // Shadow
      ctx.fillStyle = '#000';
      ctx.fillText(ft.text, screen.x + 2, screen.y + 2);

      // Main Text
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, screen.x, screen.y);
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
