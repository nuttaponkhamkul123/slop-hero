// First-person view with billboard sprites.
//
// A Three.js scene drawn on its own canvas over the 2D isometric canvas. The
// map is rebuilt in 3D (ground texture, raised wall / cliff blocks, props) and
// every hero, monster, NPC and chest is a camera-facing pixel sprite. Each
// sprite's frame is picked from the angle between the entity's facing and the
// camera, Doom style, so a monster walking past shows its side and one walking
// away shows its back.
//
// Toggling swoops the camera between the two views: it starts as a far-away,
// narrow-FOV perspective camera matched to the isometric framing (30 degree
// tilt, looking screen-up) and dollies down to the hero's eyes while the FOV
// opens up, so the switch reads as one continuous camera move.
//
// Scene axes: X = world x, Z = world y, Y = up, 1 unit = 1 map tile.
(function() {
  'use strict';
  if (typeof THREE === 'undefined') return;

  const TILE_PX = 32 * Math.SQRT2;                       // tile edge in iso screen px at zoom 1
  const TEXEL = 0.92 / Math.cos(Math.PI / 6) / TILE_PX;  // one hero sprite texel, in tiles
  const ISO_YAW = Math.atan2(-1, -1);                    // the iso camera looks screen-up = world (-1, -1)
  const ISO_PITCH = -Math.PI / 6;                        // 2:1 isometric tilt
  const ISO_FOV = 8;                                     // narrow FOV that passes for the ortho iso view
  const FP_FOV = 72;
  const FP_PITCH = -0.1;
  const EYE = 1.02;                                      // eye height (heroes stand ~1.2 tiles)
  const LOOK = 4;
  const TRANSITION_S = 1.15;
  const MOUSE_SENS = 0.0024;

  const FACINGS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  // screen direction of each facing on the (unsquashed) iso screen
  const FACING_SCREEN = {
    E: [1, 0], SE: [1, 0.5], S: [0, 1], SW: [-1, 0.5], W: [-1, 0], NW: [-1, -0.5], N: [0, -1], NE: [1, -0.5]
  };
  const HERO_VIEW = { E: 'E', W: 'E', SE: 'SE', SW: 'SE', S: 'S', NE: 'NE', NW: 'NE', N: 'N' };
  const FLIPPED = new Set(['W', 'SW', 'NW']);

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

  // iso screen vector <-> world vector
  const screenToWorldVec = (sx, sy) => [(sx + 2 * sy) / 2, (2 * sy - sx) / 2];
  const worldToScreenVec = (wx, wy) => [wx - wy, (wx + wy) / 2];

  function facingFromScreen(sx, sy) {
    const deg = Math.atan2(sy, sx) * 180 / Math.PI;
    return FACINGS[((Math.round(deg / 45) % 8) + 8) % 8];
  }
  function facingFromWorld(wx, wy) {
    const s = worldToScreenVec(wx, wy);
    return facingFromScreen(s[0], s[1]);
  }
  function facingWorldAngle(f) {
    const s = FACING_SCREEN[f] || FACING_SCREEN.S;
    const w = screenToWorldVec(s[0], s[1]);
    return Math.atan2(w[1], w[0]);
  }
  // The facing an entity shows to a camera turned `camYaw`: the facing it
  // would have on screen if the iso camera were turned the same amount
  function facingSeenFrom(facing, camYaw) {
    const a = facingWorldAngle(facing) - (camYaw - ISO_YAW);
    return facingFromWorld(Math.cos(a), Math.sin(a));
  }

  function hashTile(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  function shade(hex, k) {
    const c = new THREE.Color(hex);
    c.multiplyScalar(k);
    return '#' + c.getHexString();
  }

  // Town / field ground colours for the tile codes without a FIELD_TILE_PALETTE entry
  const BASE_TILE_COLORS = {
    0: ['#4d7c2f', '#527f33', '#47742b'], 1: ['#8a877c', '#827f74', '#918e83'], 2: ['#7a5a3a', '#73553a'],
    3: ['#1f6f9b'], 4: ['#6b6b66', '#64645f'], 5: ['#8b5a2b', '#7f5227'], 6: ['#7c6fb0'], 7: ['#4b5563'],
    9: ['#e2e8f0', '#dbe2ea', '#e8edf3'], 10: ['#7dd3fc'], 11: ['#64748b', '#5d6b80'], 12: ['#334155']
  };
  const LIQUID_TILES = new Set([3, 10]);
  const LIQUID_DETAILS = new Set(['water', 'lava', 'murk']);

  class FirstPersonView {
    constructor(gameCanvas, renderer2d) {
      this.gameCanvas = gameCanvas;
      this.r2d = renderer2d;
      this.target = 0;      // 0 = isometric, 1 = first person
      this.t = 0;           // transition progress
      this.yawOffset = 0;   // mouse look, relative to the iso heading
      this.pitch = FP_PITCH;
      this.onTurn = null;   // set by game.js: the look direction changed
      this.onClick = null;  // set by game.js: (button, worldPos) when clicking in first person
      this.locked = false;

      this.canvas = document.createElement('canvas');
      this.canvas.id = 'firstPersonCanvas';
      Object.assign(this.canvas.style, {
        position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
        zIndex: '1', display: 'none', cursor: 'crosshair', touchAction: 'none', imageRendering: 'pixelated'
      });
      this.hud = document.createElement('canvas');
      Object.assign(this.hud.style, {
        position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
        zIndex: '1', display: 'none', pointerEvents: 'none'
      });
      gameCanvas.insertAdjacentElement('afterend', this.hud);
      gameCanvas.insertAdjacentElement('afterend', this.canvas);
      this.hudCtx = this.hud.getContext('2d');

      this.gl = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false });
      this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.Fog(0x000000, 20, 60);
      this.camera = new THREE.PerspectiveCamera(FP_FOV, 1, 0.05, 2000);
      this.hemi = new THREE.HemisphereLight(0xdfe9ff, 0x3a2f24, 0.75);
      this.sun = new THREE.DirectionalLight(0xfff1dc, 0.75);
      this.sun.position.set(-30, 60, 40);
      this.torch = new THREE.PointLight(0xffc27a, 0, 12, 1.6);
      this.scene.add(this.hemi, this.sun, this.torch);

      this.worldGroup = new THREE.Group();   // ground + walls (rebuilt per map)
      this.propGroup = new THREE.Group();    // obstacles (rebuilt when they change)
      this.spriteGroup = new THREE.Group();
      this.scene.add(this.worldGroup, this.propGroup, this.spriteGroup);

      this.sprites = new Map();              // key -> { sprite, bar? }
      this.textures = new WeakMap();         // frame canvas -> texture
      this.animated = [];                    // props with an animate(t)
      this.mapKey = null;
      this.propKey = null;
      this.raycaster = new THREE.Raycaster();
      this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

      this.initParticles();
      this.bindInput();

      // our own hands and weapon as pixel art (fpHands.js); they swing / cast when the
      // renderer is told the local hero attacked or used a skill
      this.hands = window.FpHands ? new FpHands() : null;
      // the isometric renderer's own skill visuals, laid on the 3D ground (fpIsoFx.js)
      this.isoFx = window.FpIsoFx ? new FpIsoFx(this.scene, renderer2d) : null;
      const r = renderer2d;
      const atk = r.triggerAttackAnimation && r.triggerAttackAnimation.bind(r);
      if (atk) {
        r.triggerAttackAnimation = (d) => {
          try { this.onAttack(d); } catch (err) { console.warn('first-person attack fx:', err); }
          return atk(d);
        };
      }
      const fx = r.addSkillEffect && r.addSkillEffect.bind(r);
      if (fx) {
        r.addSkillEffect = (d) => {
          try { this.onSkill(d); } catch (err) { console.warn('first-person skill fx:', err); }
          return fx(d);
        };
      }
    }

    // a hero swung (local swings come from game.js, others from the server)
    onAttack(d) {
      if (!d || d.attackerType === 'mob') return;
      const self = this.localId && d.attackerId === this.localId;
      if (self && this.hands) this.hands.attack(d.attackSpeed);
    }
    onSkill(d) {
      if (!d) return;
      if (this.hands && this.localId && d.playerId === this.localId) this.hands.cast();
    }

    get active() { return this.target === 1; }
    // fully in first person (input and look follow the mouse)
    get settled() { return this.target === 1 && this.t >= 1; }

    toggle(on) {
      this.target = on === undefined ? (this.target ? 0 : 1) : (on ? 1 : 0);
      if (this.target === 1) {
        this.yawOffset = 0;
        this.pitch = FP_PITCH;
      } else if (document.pointerLockElement === this.canvas) {
        document.exitPointerLock();
      }
      return this.active;
    }

    // world heading the camera looks along
    yaw() { return ISO_YAW + this.yawOffset; }
    forward() { const a = this.yaw(); return { x: Math.cos(a), y: Math.sin(a) }; }
    facing() { const f = this.forward(); return facingFromWorld(f.x, f.y); }

    // WASD relative to the view as a world direction (no keys = straight ahead)
    worldDir(dx, dy) {
      const a = this.yaw();
      const fx = Math.cos(a), fy = Math.sin(a);
      if (!dx && !dy) return { x: fx, y: fy };
      const wx = fx * -dy - fy * dx, wy = fy * -dy + fx * dx;
      const len = Math.hypot(wx, wy) || 1;
      return { x: wx / len, y: wy / len };
    }
    // where an aimed skill should land: the crosshair, else `dist` tiles ahead
    aimPoint(me, dist) {
      const p = this.settled ? this.crosshairWorld() : null;
      if (p) return { x: p.x, y: p.y };
      const f = this.forward();
      return { x: me.x + f.x * dist, y: me.y + f.y * dist };
    }

    // WASD relative to the view -> the screen-space vector the server expects
    moveVector(dx, dy) {
      const a = this.yaw();
      const fx = Math.cos(a), fy = Math.sin(a);
      const rx = -fy, ry = fx;
      const wx = fx * -dy + rx * dx, wy = fy * -dy + ry * dx;
      const s = worldToScreenVec(wx, wy);
      const len = Math.hypot(s[0], s[1]) || 1;
      return { dx: s[0] / len, dy: s[1] / len, facing: facingFromWorld(wx, wy) };
    }

    // ---------------------------------------------------------------- input
    bindInput() {
      const c = this.canvas;
      c.addEventListener('contextmenu', e => e.preventDefault());
      c.addEventListener('wheel', e => e.preventDefault(), { passive: false });
      c.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (!this.settled) return;
        if (!this.locked) {
          // first click captures the mouse; fall back to drag-to-look if refused
          try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) {}
          this.dragging = true;
          return;
        }
        if (this.onClick) this.onClick(e.button, this.crosshairWorld());
      });
      window.addEventListener('mouseup', () => { this.dragging = false; });
      document.addEventListener('pointerlockchange', () => {
        this.locked = document.pointerLockElement === c;
        if (this.locked) this.dragging = false;
      });
      window.addEventListener('mousemove', (e) => {
        if (!this.settled || (!this.locked && !this.dragging)) return;
        this.turn(e.movementX || 0, e.movementY || 0);
      });
      // touch: drag to look
      let last = null;
      c.addEventListener('touchstart', (e) => { const t = e.touches[0]; last = t ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
      c.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        if (!t || !last || !this.settled) return;
        this.turn((t.clientX - last.x) * 1.6, (t.clientY - last.y) * 1.6);
        last = { x: t.clientX, y: t.clientY };
      }, { passive: true });
    }

    turn(mx, my) {
      this.yawOffset = wrapAngle(this.yawOffset + mx * MOUSE_SENS);
      this.pitch = clamp(this.pitch - my * MOUSE_SENS, -1.25, 0.7);
      if (this.onTurn) this.onTurn();
    }

    // Where the crosshair points: a monster / prop / chest sprite, else the ground
    crosshairWorld() {
      this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
      this.raycaster.far = 40;
      const hits = this.raycaster.intersectObjects([this.spriteGroup, this.propGroup], true);
      for (const h of hits) {
        if (!h.object.visible) continue;   // r128 raycasts hidden objects too
        let o = h.object;
        while (o && !o.userData.world) o = o.parent;
        if (o && o.userData.world && !o.userData.self) return { ...o.userData.world, entity: true };
      }
      const p = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.groundPlane, p) && p.distanceTo(this.camera.position) < 40) {
        return { x: p.x, y: p.z };
      }
      return null;
    }

    // ---------------------------------------------------------------- world
    texture(canvas) {
      let t = this.textures.get(canvas);
      if (!t) {
        t = new THREE.CanvasTexture(canvas);
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        t.generateMipmaps = false;
        this.textures.set(canvas, t);
      }
      return t;
    }

    clearGroup(g) {
      g.traverse((o) => {
        if (o.isMesh && o.userData.ownGeometry !== false && o.geometry) o.geometry.dispose();
        if (o.isMesh && o.userData.ownMaterial && o.material) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      });
      g.clear();
    }

    themeOf(map) {
      const isDungeon = !!(map.isDungeon || (map.tiles && map.tiles[0] && (map.tiles[0][0] === 8 || map.tiles[0][0] === 7)));
      return { isDungeon, theme: map.theme || (isDungeon ? 'dungeon_crypt' : 'town') };
    }

    isRaised(map, t, isDungeon) {
      if (t === 7 || t === 12) return true;
      if (isDungeon) return false;
      const pal = typeof FIELD_TILE_PALETTE !== 'undefined' ? FIELD_TILE_PALETTE[t] : null;
      if (LIQUID_TILES.has(t) || (pal && LIQUID_DETAILS.has(pal.detail))) return false;
      return !!(map.blockingTiles && map.blockingTiles.includes(t));
    }

    tileColor(map, t, x, y, info) {
      const r = hashTile(x, y);
      if (info.isDungeon) {
        const pal = typeof DUNGEON_THEME_TILES !== 'undefined' ? (DUNGEON_THEME_TILES[info.theme] || DUNGEON_THEME_TILES.dungeon_crypt) : null;
        if (pal) {
          const list = t === 1 ? pal.corridor : pal.flag;
          if (list && list.length) return list[Math.floor(r * list.length)];
        }
        return '#262c38';
      }
      const fp = typeof FIELD_TILE_PALETTE !== 'undefined' ? FIELD_TILE_PALETTE[t] : null;
      const list = fp ? fp.tops : (BASE_TILE_COLORS[t] || BASE_TILE_COLORS[0]);
      return list[Math.floor(r * list.length)];
    }

    buildWorld(map) {
      this.clearGroup(this.worldGroup);
      const info = this.themeOf(map);
      this.info = info;
      const W = map.width, H = map.height;

      // Ground: one texture, a few texels per tile with a little speckle
      const px = clamp(Math.floor(4096 / Math.max(W, H)), 2, 8);
      const gc = document.createElement('canvas');
      gc.width = W * px; gc.height = H * px;
      const g = gc.getContext('2d');
      g.fillStyle = '#000';
      g.fillRect(0, 0, gc.width, gc.height);
      const walls = [];
      for (let y = 0; y < H; y++) {
        const row = map.tiles[y];
        for (let x = 0; x < W; x++) {
          const t = row[x];
          if (t === 8) continue;
          if (this.isRaised(map, t, info.isDungeon)) { walls.push({ x, y, t }); }
          const col = this.tileColor(map, t, x, y, info);
          g.fillStyle = col;
          g.fillRect(x * px, y * px, px, px);
          if (px >= 4) {
            for (let k = 0; k < 3; k++) {
              const r = hashTile(x * 7 + k, y * 13 - k);
              g.fillStyle = r > 0.5 ? shade(col, 1.12) : shade(col, 0.86);
              g.fillRect(x * px + Math.floor(hashTile(x + k, y) * px), y * px + Math.floor(hashTile(x, y + k) * px), 1, 1);
            }
          }
        }
      }
      const gtex = new THREE.CanvasTexture(gc);
      gtex.magFilter = THREE.NearestFilter;
      gtex.minFilter = THREE.NearestFilter;
      gtex.generateMipmaps = false;
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshLambertMaterial({ map: gtex }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(W / 2, 0, H / 2);
      ground.userData.ownMaterial = true;
      this.worldGroup.add(ground);

      // Raised tiles: one instanced, brick-textured box per wall / cliff tile
      if (walls.length) {
        const bc = document.createElement('canvas');
        bc.width = 16; bc.height = 16;
        const b = bc.getContext('2d');
        b.fillStyle = '#d6d6d6'; b.fillRect(0, 0, 16, 16);
        b.fillStyle = '#9a9a9a';
        for (let r = 0; r < 4; r++) {
          b.fillRect(0, r * 4 + 3, 16, 1);
          const off = r % 2 ? 4 : 0;
          b.fillRect(off, r * 4, 1, 3); b.fillRect(off + 8, r * 4, 1, 3);
        }
        const btex = new THREE.CanvasTexture(bc);
        btex.magFilter = THREE.NearestFilter;
        btex.minFilter = THREE.NearestFilter;
        btex.generateMipmaps = false;
        btex.wrapS = btex.wrapT = THREE.RepeatWrapping;
        const wallH = info.isDungeon ? 2.2 : 1.5;
        const geo = new THREE.BoxGeometry(1, wallH, 1);
        const uv = geo.attributes.uv;
        // side faces repeat the brick texture once per tile height unit
        for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (i < 8 || (i >= 16) ? wallH : 1));
        const mat = new THREE.MeshLambertMaterial({ map: btex });
        const mesh = new THREE.InstancedMesh(geo, mat, walls.length);
        mesh.userData.ownMaterial = true;
        const m4 = new THREE.Matrix4();
        const col = new THREE.Color();
        const wpal = info.isDungeon && typeof DUNGEON_THEME_WALLS !== 'undefined' ? (DUNGEON_THEME_WALLS[info.theme] || DUNGEON_THEME_WALLS.dungeon_crypt) : null;
        walls.forEach((w, i) => {
          m4.makeTranslation(w.x + 0.5, wallH / 2, w.y + 0.5);
          mesh.setMatrixAt(i, m4);
          const base = wpal ? wpal.left : (BASE_TILE_COLORS[w.t] || (typeof FIELD_TILE_PALETTE !== 'undefined' && FIELD_TILE_PALETTE[w.t] ? [FIELD_TILE_PALETTE[w.t].left] : ['#555b66']))[0];
          col.set(base).multiplyScalar(info.isDungeon ? 1.9 : 1.15 + hashTile(w.x, w.y) * 0.15);
          mesh.setColorAt(i, col);
        });
        this.worldGroup.add(mesh);
      }

      // Sky / fog / light per zone
      const bg = info.isDungeon
        ? ((map && map.bg) || (typeof DUNGEON_THEME_BG !== 'undefined' && DUNGEON_THEME_BG[info.theme]) || '#080c14')
        : (/frost|snow|glac/.test(info.theme) ? '#b9d3e6' : '#8fc3e6');
      this.skyColor = new THREE.Color(bg);
      this.scene.background = this.skyColor;
      this.scene.fog.color.copy(this.skyColor);
      this.fogNear = info.isDungeon ? 5 : 18;
      this.fogFar = info.isDungeon ? 28 : 55;
      this.hemi.intensity = info.isDungeon ? 0.55 : 0.8;
      this.sun.intensity = info.isDungeon ? 0.2 : 0.75;
      this.torch.intensity = info.isDungeon ? 2.2 : 0;
      if (info.isDungeon && typeof DUNGEON_THEME_TORCH !== 'undefined') {
        const tc = DUNGEON_THEME_TORCH[info.theme];
        const m = tc && /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(tc.mid);
        this.torch.color.setRGB(m ? m[1] / 255 : 1, m ? m[2] / 255 : 0.76, m ? m[3] / 255 : 0.48);
        this.torch.color.lerp(new THREE.Color(0xffd8a0), 0.55);
      }
    }

    // ---------------------------------------------------------------- props
    mat(color, extra) {
      const m = new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {}));
      return m;
    }
    glowMat(color) { return new THREE.MeshBasicMaterial({ color }); }

    addMesh(parent, geo, mat, x, y, z) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      m.userData.ownMaterial = true;
      parent.add(m);
      return m;
    }

    // Simple stand-ins for the props the 2D renderer paints by hand
    makeProp(obs) {
      const g = new THREE.Group();
      const R = obs.radius || 0.45;
      const t = obs.type;
      const add = (geo, mat, x, y, z) => this.addMesh(g, geo, mat, x, y, z);
      if (t === 'town_wall') {
        const along = obs.axis === 'y' ? [0.9, 1.6, 1.05] : [1.05, 1.6, 0.9];
        add(new THREE.BoxGeometry(along[0], 2.4, along[2]), this.mat('#9a8f7c'), 0, 1.2, 0);
        add(new THREE.BoxGeometry(along[0] * 0.5, 0.35, along[2] * 0.5), this.mat('#857b69'), 0, 2.55, 0);
      } else if (t === 'oak_tree' || t === 'pine_tree' || t === 'dead_tree') {
        add(new THREE.CylinderGeometry(0.12, 0.18, 1.4, 6), this.mat('#5b3a22'), 0, 0.7, 0);
        if (t === 'pine_tree') {
          add(new THREE.ConeGeometry(0.9, 1.6, 7), this.mat('#1f5130'), 0, 1.7, 0);
          add(new THREE.ConeGeometry(0.65, 1.2, 7), this.mat('#246038'), 0, 2.4, 0);
        } else if (t === 'oak_tree') {
          add(new THREE.IcosahedronGeometry(1.0, 0), this.mat('#3c6e26', { flatShading: true }), 0, 2.0, 0);
        } else {
          add(new THREE.CylinderGeometry(0.04, 0.08, 0.9, 4), this.mat('#4a3424'), 0.25, 1.6, 0).rotation.z = -0.6;
          add(new THREE.CylinderGeometry(0.04, 0.08, 0.8, 4), this.mat('#4a3424'), -0.2, 1.5, 0.1).rotation.z = 0.7;
        }
      } else if (t === 'boulder' || t === 'bone_pile' || t === 'gold_hoard') {
        const col = t === 'gold_hoard' ? '#d4a017' : t === 'bone_pile' ? '#d8d0b8' : '#6b6f75';
        add(new THREE.DodecahedronGeometry(Math.max(0.35, R), 0), this.mat(col, { flatShading: true }), 0, Math.max(0.25, R * 0.6), 0).scale.y = 0.7;
      } else if (t === 'stone_pillar' || t === 'frost_monolith' || t === 'ice_crystal') {
        const col = t === 'stone_pillar' ? '#8a8a84' : '#9fdcf5';
        add(new THREE.CylinderGeometry(0.3, 0.36, 2.4, t === 'stone_pillar' ? 8 : 5), this.mat(col, { flatShading: true }), 0, 1.2, 0);
      } else if (t === 'torch' || t === 'wall_torch' || t === 'brazier' || t === 'lamp_post') {
        const h = t === 'brazier' ? 0.8 : 1.6;
        add(new THREE.CylinderGeometry(0.06, 0.08, h, 6), this.mat('#3b3027'), 0, h / 2, 0);
        add(new THREE.OctahedronGeometry(0.16, 0), this.glowMat('#ffb347'), 0, h + 0.15, 0);
      } else if (t === 'fountain' || t === 'holy_fountain' || t === 'well') {
        add(new THREE.CylinderGeometry(Math.max(0.8, R), Math.max(0.9, R + 0.1), 0.5, 14), this.mat('#a7a49b'), 0, 0.25, 0);
        add(new THREE.CylinderGeometry(Math.max(0.65, R - 0.15), Math.max(0.65, R - 0.15), 0.05, 14), this.glowMat('#4aa8d8'), 0, 0.48, 0);
      } else if (t === 'cactus') {
        add(new THREE.CylinderGeometry(0.18, 0.2, 1.4, 7), this.mat('#3f7d3a'), 0, 0.7, 0);
      } else if (t === 'giant_mushroom') {
        add(new THREE.CylinderGeometry(0.15, 0.22, 1.2, 7), this.mat('#e8dcc2'), 0, 0.6, 0);
        add(new THREE.SphereGeometry(0.75, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), this.mat('#b8324a'), 0, 1.15, 0);
      } else if (t === 'sarcophagus') {
        add(new THREE.BoxGeometry(0.8, 0.6, 1.6), this.mat('#6d6a73'), 0, 0.3, 0);
      } else if (/portal|rift_gate/.test(t)) {
        const ring = add(new THREE.TorusGeometry(0.9, 0.12, 6, 20), this.glowMat(obs.color || '#a855f7'), 0, 1.1, 0);
        ring.rotation.y = Math.PI / 4;
        const disc = add(new THREE.CircleGeometry(0.85, 20), new THREE.MeshBasicMaterial({ color: obs.color || '#c084fc', transparent: true, opacity: 0.45, side: THREE.DoubleSide }), 0, 1.1, 0);
        disc.rotation.y = Math.PI / 4;
        this.animated.push({ animate: (time) => { ring.rotation.z = time * 0.8; disc.material.opacity = 0.35 + 0.15 * Math.sin(time * 3); } });
      } else if (obs.collidable) {
        add(new THREE.BoxGeometry(R * 1.6, 1, R * 1.6), this.mat('#7a6f60'), 0, 0.5, 0);
      } else {
        return null;
      }
      return g;
    }

    buildProps(map, sealed) {
      this.clearGroup(this.propGroup);
      this.animated = [];
      this.keepers = [];
      const models = window.TownPropModels;
      for (const obs of map.obstacles || []) {
        if (obs.type === 'dungeon_door') continue;
        let node = null;
        if (models && models.has(obs.type)) {
          const built = models.build(obs);
          if (built) {
            node = new THREE.Group();
            built.root.scale.setScalar(1 / models.TILE);
            node.add(built.root);
            if (built.animate) this.animated.push(built);
            node.userData.townProp = true;
          }
          const keeper = typeof SHOPKEEPERS !== 'undefined' ? SHOPKEEPERS[obs.type] : null;
          if (keeper) this.keepers.push({ obs, keeper: (keeper.forObs && keeper.forObs(obs)) || keeper });
        }
        if (!node) node = this.makeProp(obs);
        if (!node) continue;
        node.position.set(obs.x, 0, obs.y);
        node.userData.world = { x: obs.x, y: obs.y };
        this.propGroup.add(node);
      }
      // closed dungeon doorways: a portcullis in each sealed tile
      if (sealed && sealed.size) {
        const geo = new THREE.BoxGeometry(1, 2.2, 0.18);
        const mat = this.mat('#4b4f57');
        for (const k of sealed) {
          const [x, y] = k.split(',').map(Number);
          const bars = new THREE.Mesh(geo, mat);
          bars.userData.ownGeometry = false;
          const ns = this.lastMap && (this.lastMap.tiles[y - 1] && this.lastMap.tiles[y - 1][x] === 7);
          bars.position.set(x + 0.5, 1.1, y + 0.5);
          if (ns) bars.rotation.y = Math.PI / 2;
          this.propGroup.add(bars);
        }
      }
    }

    // ---------------------------------------------------------------- sprites
    spriteFor(key, renderOrder) {
      let e = this.sprites.get(key);
      if (!e) {
        const mat = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.5, fog: true });
        const sprite = new THREE.Sprite(mat);
        sprite.renderOrder = renderOrder || 0;
        this.spriteGroup.add(sprite);
        e = { sprite, seen: 0 };
        this.sprites.set(key, e);
      }
      e.seen = this.frameNo;
      return e;
    }

    // Put a pixel frame (canvas with an anchor) on a sprite standing at (x, y)
    placeFrame(e, img, ax, ay, x, y, scale, flip, lift) {
      const s = e.sprite;
      const tex = this.texture(img);
      if (s.material.map !== tex) { s.material.map = tex; s.material.needsUpdate = true; }
      const w = img.width * TEXEL * scale, h = img.height * TEXEL * scale;
      s.scale.set(flip ? -w : w, h, 1);
      // flipped sprites mirror about their anchor, like the 2D renderer
      s.center.set(ax / img.width, 1 - ay / img.height);
      s.position.set(x, lift || 0, y);
      s.visible = true;
    }

    hpBar(key, ratio, x, y, top, color) {
      const e = this.spriteFor(key, 2);
      if (!e.canvas) {
        e.canvas = document.createElement('canvas');
        e.canvas.width = 40; e.canvas.height = 5;
        e.sprite.material.map = new THREE.CanvasTexture(e.canvas);
        e.sprite.material.map.magFilter = THREE.NearestFilter;
        e.sprite.material.map.minFilter = THREE.NearestFilter;
        e.sprite.material.alphaTest = 0;
        e.sprite.material.depthWrite = false;
        e.sprite.center.set(0.5, 0);
        e.sprite.scale.set(0.8, 0.1, 1);
      }
      const q = Math.round(ratio * 40);
      if (e.q !== q || e.color !== color) {
        e.q = q; e.color = color;
        const g = e.canvas.getContext('2d');
        g.fillStyle = '#111'; g.fillRect(0, 0, 40, 5);
        g.fillStyle = color; g.fillRect(1, 1, Math.max(0, q - 2), 3);
        e.sprite.material.map.needsUpdate = true;
      }
      e.sprite.position.set(x, top + 0.12, y);
      e.sprite.visible = true;
    }

    heroFrame(p, camYaw, now) {
      const PH = window.PixelHeroes;
      if (!PH || !this.r2d.heroFrameFor) return null;
      const cls = PH.classes.includes(p.characterClass) ? p.characterClass : 'warrior';
      const t = now / 1000 + (p._fpSeed || (p._fpSeed = Math.random() * 10));
      let action = 'idle', idx = PH.loopIndex(cls, 'idle', t);
      if (p.isDead) { action = 'death'; idx = PH.meta(cls, 'death').frames - 1; }
      else if (p.isMoving) { action = 'run'; idx = PH.loopIndex(cls, 'run', t); }
      const seen = facingSeenFrom(p.facing || 'S', camYaw);
      const img = this.r2d.heroFrameFor(p, HERO_VIEW[seen] || 'S', action, idx);
      return { img, ax: PH.AX || 40, ay: PH.AY || 66, flip: FLIPPED.has(seen), top: ((PH.AY || 66) - 16) * TEXEL };
    }

    mobFrame(mob, camYaw, now) {
      const PM = window.PixelMobs;
      if (!PM || !PM.has(mob.type)) return null;
      const st = this.mobState || (this.mobState = new Map());
      let a = st.get(mob.id);
      if (!a) { a = { x: mob.x, y: mob.y, hp: mob.hp, movingUntil: 0, hurtAt: -1e9, seed: Math.random() * 10 }; st.set(mob.id, a); }
      if (Math.hypot(mob.x - a.x, mob.y - a.y) > 0.002) a.movingUntil = now + 160;
      if (mob.hp < a.hp) a.hurtAt = now;
      a.x = mob.x; a.y = mob.y; a.hp = mob.hp; a.seen = now;
      const atk = this.r2d.mobAttacks && this.r2d.mobAttacks.get(mob.id);
      const t = now / 1000 + a.seed;
      let action, k;
      if (atk && now - atk < 420) { action = 'attack'; k = Math.floor(((now - atk) / 420) * PM.frameCount(mob.type, 'attack')); }
      else if (now - a.hurtAt < 160) { action = 'hurt'; k = 0; }
      else if (now < a.movingUntil) { action = 'walk'; k = Math.floor(t * 10); }
      else { action = 'idle'; k = Math.floor(t * 5); }
      const seen = facingSeenFrom(mob.facing || 'SE', camYaw);
      const view = seen === 'E' || seen === 'W' ? 'side' : seen.startsWith('N') ? 'back' : 'front';
      const img = PM.mobFrame(mob.type, view, action, k, mob.hue || 0);
      return { img, ax: img.anchorX, ay: img.anchorY, flip: FLIPPED.has(seen), top: (img.anchorY - (img.top || 0)) * TEXEL };
    }

    updateSprites(gameState, localId, e, camYaw) {
      const now = performance.now();
      this.frameNo = (this.frameNo || 0) + 1;

      for (const p of gameState.players || []) {
        if (p.zone && gameState.zone && p.zone !== gameState.zone) continue;
        const isSelf = p.id === localId;
        // our own body fades out as the camera reaches our eyes
        if (isSelf && e > 0.82) continue;
        const f = this.heroFrame(p, camYaw, now);
        if (!f || !f.img) continue;
        const s = this.spriteFor('p:' + p.id, 1);
        this.placeFrame(s, f.img, f.ax, f.ay, p.x, p.y, 1, f.flip);
        s.sprite.userData.world = { x: p.x, y: p.y };
        s.sprite.userData.self = isSelf;
        if (!isSelf && p.maxHp) this.hpBar('ph:' + p.id, clamp(p.hp / p.maxHp, 0, 1), p.x, p.y, f.top, '#4ade80');
      }

      for (const m of gameState.mobs || []) {
        if (m.state === 'dead') continue;
        const f = this.mobFrame(m, camYaw, now);
        if (!f) continue;
        const scale = m.scale || 1;
        const s = this.spriteFor('m:' + m.id, 1);
        this.placeFrame(s, f.img, f.ax, f.ay, m.x, m.y, scale, f.flip);
        s.sprite.userData.world = { x: m.x, y: m.y };
        if (m.maxHp) this.hpBar('mh:' + m.id, clamp(m.hp / m.maxHp, 0, 1), m.x, m.y, f.top * scale, m.isBoss ? '#f59e0b' : '#ef4444');
      }

      if (window.PixelMobs) {
        for (const c of gameState.chests || []) {
          const img = window.PixelMobs.chestFrame(c.isGold, c.opened);
          const s = this.spriteFor('c:' + c.id, 1);
          // chests are drawn 1 texel per screen px (not hero scale)
          this.placeFrame(s, img, img.anchorX, img.anchorY, c.x, c.y, 1 / 0.92, false);
          s.sprite.userData.world = { x: c.x, y: c.y };
        }
        const time = this.r2d.animations ? this.r2d.animations.time : now / 1000;
        for (const { obs, keeper } of this.keepers || []) {
          const img = window.PixelMobs.npcFrame(keeper.npc, time + (obs.variant || 0) * 1.37, obs.variant || 0, keeper.view);
          const s = this.spriteFor('k:' + obs.id + ':' + obs.x + ':' + obs.y, 1);
          const tile = 32 * Math.SQRT2;
          const kx = obs.x + keeper.x / tile, ky = obs.y + keeper.z / tile;
          this.placeFrame(s, img, img.anchorX, img.anchorY, kx, ky, keeper.scale || 1, !!keeper.flip);
          s.sprite.userData.world = { x: obs.x, y: obs.y };
        }
      }

      for (const it of gameState.groundItems || []) {
        const s = this.spriteFor('i:' + it.id, 1);
        if (!s.canvas) {
          s.canvas = document.createElement('canvas');
          s.canvas.width = 8; s.canvas.height = 8;
          const g = s.canvas.getContext('2d');
          g.fillStyle = it.type === 'gold' ? '#facc15' : '#e9d5ff';
          g.beginPath(); g.moveTo(4, 0); g.lineTo(8, 4); g.lineTo(4, 8); g.lineTo(0, 4); g.fill();
          g.fillStyle = '#fff'; g.fillRect(3, 2, 2, 2);
          s.sprite.material.map = this.texture(s.canvas);
          s.sprite.material.fog = false;
        }
        s.sprite.scale.set(0.2, 0.2, 1);
        s.sprite.center.set(0.5, 0.5);
        s.sprite.position.set(it.x, 0.3 + Math.sin(now / 250 + it.x) * 0.06, it.y);
        s.sprite.userData.world = { x: it.x, y: it.y };
        s.sprite.visible = true;
      }

      // drop sprites whose entity left
      for (const [k, v] of this.sprites) {
        if (v.seen === this.frameNo) continue;
        if (this.frameNo - v.seen > 120) {
          this.spriteGroup.remove(v.sprite);
          if (v.canvas && v.sprite.material.map) v.sprite.material.map.dispose();
          v.sprite.material.dispose();
          this.sprites.delete(k);
        } else {
          v.sprite.visible = false;
        }
      }
    }

    // ---------------------------------------------------------------- particles
    initParticles() {
      const MAX = 1500;
      this.pMax = MAX;
      this.pPos = new Float32Array(MAX * 3);
      this.pCol = new Float32Array(MAX * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
      const dot = document.createElement('canvas');
      dot.width = dot.height = 16;
      const g = dot.getContext('2d');
      const grd = g.createRadialGradient(8, 8, 0, 8, 8, 8);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.4, 'rgba(255,255,255,0.7)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 16, 16);
      this.points = new THREE.Points(geo, new THREE.PointsMaterial({
        size: 0.16, map: new THREE.CanvasTexture(dot), vertexColors: true, transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
      }));
      this.points.frustumCulled = false;
      this.scene.add(this.points);
      this.tmpColor = new THREE.Color();
    }

    updateParticles() {
      const anim = this.r2d.animations;
      const list = (anim && anim.particles) || [];
      let n = 0;
      const push = (x, h, y, col, k) => {
        if (n >= this.pMax) return;
        this.pPos[n * 3] = x; this.pPos[n * 3 + 1] = h; this.pPos[n * 3 + 2] = y;
        try { this.tmpColor.set(col); } catch (_) { this.tmpColor.set('#ffffff'); }
        this.pCol[n * 3] = this.tmpColor.r * k; this.pCol[n * 3 + 1] = this.tmpColor.g * k; this.pCol[n * 3 + 2] = this.tmpColor.b * k;
        n++;
      };
      for (const p of list) {
        if (typeof p.x !== 'number') continue;
        push(p.x, (p.z || 0) * 0.82 + 0.05, p.y, p.color || '#ffffff', clamp(p.life / (p.maxLife || 1), 0, 1));
      }
      // projectiles: a bright head with a short glow trail
      if (this.r2d.flyingProjectiles) {
        for (const pr of this.r2d.flyingProjectiles.values()) {
          const fx = typeof ELEMENT_FX !== 'undefined' ? (ELEMENT_FX[pr.element] || ELEMENT_FX.neutral) : null;
          const col = (fx && fx.color) || pr.color || '#fde68a';
          for (let i = 0; i < 4; i++) push(pr.x - (pr.vx || 0) * i * 0.02, 0.7, pr.y - (pr.vy || 0) * i * 0.02, col, 1 - i * 0.2);
        }
      }
      const geo = this.points.geometry;
      geo.setDrawRange(0, n);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    }

    // ---------------------------------------------------------------- hud
    drawHud(w, h, e) {
      const g = this.hudCtx;
      const pr = this.hud.width / w;
      g.setTransform(pr, 0, 0, pr, 0, 0);
      g.clearRect(0, 0, w, h);
      if (e < 0.5) return;
      if (this.hands && this.me) {
        const me = this.me;
        this.hands.draw(g, w, h, {
          cls: me.characterClass, e, moving: !!me.isMoving, dead: !!me.isDead, hp: me.hp,
          card: this.r2d.spCardFor ? this.r2d.spCardFor(me) : null,
          time: this.r2d.animations ? this.r2d.animations.time : performance.now() / 1000
        });
      }
      g.globalAlpha = clamp((e - 0.5) * 2, 0, 1);

      // floating combat text, projected from the world into this view
      const anim = this.r2d.animations;
      const v = new THREE.Vector3();
      if (anim && anim.floatingTexts) {
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        for (const ft of anim.floatingTexts) {
          v.set(ft.x, 1.5, ft.y).project(this.camera);
          if (v.z > 1 || v.z < -1) continue;
          const dist = this.camera.position.distanceTo(new THREE.Vector3(ft.x, 1.5, ft.y));
          if (dist > 30) continue;
          const sx = (v.x * 0.5 + 0.5) * w + (ft.screenOffsetX || 0);
          const sy = (-v.y * 0.5 + 0.5) * h + (ft.screenOffsetY || 0);
          const size = Math.round(clamp((ft.size || 16) * 4 / Math.max(2, dist), 10, 40));
          g.font = `${size}px "DotGothic16", monospace`;
          const a = clamp(ft.life / ((ft.maxLife || 1) * 0.3), 0, 1);
          g.globalAlpha = a * clamp((e - 0.5) * 2, 0, 1);
          g.lineWidth = 3;
          g.strokeStyle = 'rgba(0,0,0,0.85)';
          g.strokeText(ft.text, sx, sy);
          g.fillStyle = ft.color || '#fff';
          g.fillText(ft.text, sx, sy);
        }
      }

      // crosshair + hint
      g.globalAlpha = clamp((e - 0.5) * 2, 0, 1);
      const cx = Math.round(w / 2), cy = Math.round(h / 2);
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(cx - 7, cy - 2, 14, 4); g.fillRect(cx - 2, cy - 7, 4, 14);
      g.fillStyle = '#f8fafc';
      g.fillRect(cx - 6, cy - 1, 12, 2); g.fillRect(cx - 1, cy - 6, 2, 12);
      if (this.settled && !this.locked) {
        g.font = '14px "DotGothic16", monospace';
        g.textAlign = 'center';
        g.fillStyle = 'rgba(0,0,0,0.55)';
        const msg = 'Click to look around  ·  Esc frees the mouse';
        const tw = g.measureText(msg).width + 20;
        g.fillRect(cx - tw / 2, h * 0.16, tw, 24);
        g.fillStyle = '#e2e8f0';
        g.fillText(msg, cx, h * 0.16 + 13);
      }
      g.globalAlpha = 1;
    }

    // ---------------------------------------------------------------- frame
    resize(w, h) {
      if (this.w === w && this.h === h) return;
      this.w = w; this.h = h;
      this.gl.setSize(w, h, false);
      const pr = Math.min(window.devicePixelRatio || 1, 2);
      this.hud.width = Math.round(w * pr);
      this.hud.height = Math.round(h * pr);
      this.camera.aspect = w / h;
    }

    update(dt, gameState, localId) {
      this.frameDt = dt;
      const step = dt / TRANSITION_S;
      this.t = this.target ? Math.min(1, this.t + step) : Math.max(0, this.t - step);
      const visible = this.t > 0;
      const disp = visible ? 'block' : 'none';
      if (this.canvas.style.display !== disp) {
        this.canvas.style.display = disp;
        this.hud.style.display = disp;
      }
      // the 2D canvas underneath stops taking clicks while this view is up
      this.canvas.style.pointerEvents = this.target ? 'auto' : 'none';
      // from the next frame on the 2D renderer paints its skill effects for us
      if (this.isoFx) {
        this.isoFx.active = visible;
        if (!visible) this.isoFx.clear();
      }
      if (!visible) return;

      const map = gameState && gameState.map;
      const me = gameState && gameState.players && gameState.players.find(p => p.id === localId);
      if (!map || !me) return;
      this.localId = localId;
      this.me = me;

      const w = this.r2d.viewW || this.gameCanvas.clientWidth, h = this.r2d.viewH || this.gameCanvas.clientHeight;
      this.resize(w, h);

      const mapKey = map;
      if (this.lastMap !== mapKey || this.mapVersion !== (map._tilesVersion || 0)) {
        this.lastMap = mapKey;
        this.mapVersion = map._tilesVersion || 0;
        this.buildWorld(map);
        if (this.isoFx) this.isoFx.clear();
        this.propKey = null;
        for (const v of this.sprites.values()) { this.spriteGroup.remove(v.sprite); v.sprite.material.dispose(); }
        this.sprites.clear();
      }
      const sealed = this.r2d.sealedDoorTiles ? this.r2d.sealedDoorTiles(map) : null;
      const propKey = (map.obstacles ? map.obstacles.length : 0) + '|' + (sealed ? [...sealed].join(';') : '');
      if (this.propKey !== propKey || this.propObs !== map.obstacles) {
        this.propKey = propKey;
        this.propObs = map.obstacles;
        this.buildProps(map, sealed);
      }

      // ---- camera: iso framing -> eye level
      const e = easeInOut(this.t);
      const cam2d = this.r2d.camera;
      const isoCenter = window.Isometric ? Isometric.screenToWorld(w / 2, h / 2, cam2d, w, h) : { x: me.x, y: me.y };
      const blend = clamp(e * 3, 0, 1);
      const px = lerp(isoCenter.x, me.x, blend), py = lerp(isoCenter.y, me.y, blend);

      const yaw = ISO_YAW + this.yawOffset * e;
      const pitch = lerp(ISO_PITCH, this.pitch, e);
      const fwd = new THREE.Vector3(Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch));

      const zoom = cam2d.zoom || 1;
      const isoHeight = h / (TILE_PX * zoom);                         // tiles visible top to bottom in the iso view
      const isoDist = (isoHeight / 2) / Math.tan((ISO_FOV / 2) * Math.PI / 180);
      const dist = isoDist * Math.pow(LOOK / isoDist, e);
      const fpHeight = 2 * LOOK * Math.tan((FP_FOV / 2) * Math.PI / 180);
      const visH = lerp(isoHeight, fpHeight, e);
      const bob = this.settled && me.isMoving ? Math.sin(performance.now() / 95) * 0.035 : 0;
      const eyeH = lerp(0.45, EYE + bob, e);

      const look = new THREE.Vector3(px, eyeH, py).addScaledVector(fwd, LOOK * e);
      this.camera.position.copy(look).addScaledVector(fwd, -dist);
      this.camera.fov = 2 * Math.atan(visH / 2 / dist) * 180 / Math.PI;
      this.camera.near = Math.max(0.05, dist - 60 > 1 ? dist - 60 : 0.05);
      this.camera.far = dist + 120;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(look);

      this.scene.fog.near = this.fogNear + dist - LOOK;
      this.scene.fog.far = this.fogFar + dist - LOOK;
      this.torch.position.set(me.x, 1.6, me.y);

      const time = this.r2d.animations ? this.r2d.animations.time : performance.now() / 1000;
      for (const a of this.animated) { try { a.animate(time); } catch (_) {} }

      this.updateSprites(gameState, localId, e, yaw);
      this.updateParticles();

      // fade in over the start of the swoop (the iso framing matches, so it reads as one move)
      this.canvas.style.opacity = String(clamp(this.t / 0.18, 0, 1));
      this.gl.render(this.scene, this.camera);

      this.drawHud(w, h, e);
    }
  }

  window.FirstPersonView = FirstPersonView;
})();
