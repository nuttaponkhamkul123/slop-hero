// 3D town props for Slop Hero: market stall (Olaf), forge (Brom), houses,
// gate towers and corner keeps.
//
// Each prop is modelled in "game axes" (X = world +x, Z = world +y, Y = up,
// TILE units per map tile) and rendered offscreen through an isometric
// orthographic camera, then painted into the 2D canvas at the prop's ground
// anchor from inside the 2D renderer's depth-sorted pass. Static props are
// cached per zoom level; the two NPC booths animate every frame.
(function() {
  'use strict';

  if (typeof THREE === 'undefined') return;

  // One map tile edge in model units (64px tile diamond at zoom 1)
  const TILE = 32 * Math.SQRT2;
  const ISO_TILT = Math.PI / 6;   // 2:1 isometric ground
  const ISO_YAW = -Math.PI / 4;   // +X -> screen lower-right, +Z -> lower-left

  // ---------- small modelling helpers ----------
  const matCache = new Map();
  function mat(color, opts) {
    const key = color + (opts ? JSON.stringify(opts) : '');
    if (!matCache.has(key)) {
      matCache.set(key, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.82, metalness: 0.05, flatShading: true }, opts || {})));
    }
    return matCache.get(key);
  }
  const glow = (color, intensity = 1) => mat(color, { emissive: color, emissiveIntensity: intensity, roughness: 0.4 });

  // Box whose bottom sits at y
  function box(parent, w, h, d, color, x, y, z, opts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' || typeof color === 'number' ? mat(color, opts) : color);
    m.position.set(x, y + h / 2, z);
    parent.add(m);
    return m;
  }
  function cyl(parent, rTop, rBot, h, color, x, y, z, seg = 10, opts) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), typeof color === 'string' || typeof color === 'number' ? mat(color, opts) : color);
    m.position.set(x, y + h / 2, z);
    parent.add(m);
    return m;
  }
  function sphere(parent, r, color, x, y, z, seg = 10) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), typeof color === 'string' || typeof color === 'number' ? mat(color) : color);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  function textPlane(text, w, h, bg, fg) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = Math.round(256 * h / w);
    const c = canvas.getContext('2d');
    c.fillStyle = bg;
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.strokeStyle = '#3b2412';
    c.lineWidth = 10;
    c.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    c.fillStyle = fg;
    c.font = `bold ${Math.round(canvas.height * 0.5)}px Georgia, serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
    const tex = new THREE.CanvasTexture(canvas);
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  }

  // ---------- humanoid NPC (front faces +Z, ~52 units tall) ----------
  function makeHuman(o) {
    const g = new THREE.Group();
    const parts = {};
    const broad = o.broad || 1;

    // legs & boots
    for (const sx of [-1, 1]) {
      cyl(g, 2.8 * broad, 2.4, 17, o.pants, sx * 3.2 * broad, 3, 0, 8);
      box(g, 5.4 * broad, 3.4, 8, o.boots, sx * 3.2 * broad, 0, 1.2);
    }

    // torso (slightly tapered) + belly for the burly smith
    parts.torso = new THREE.Group();
    parts.torso.position.y = 19;
    g.add(parts.torso);
    cyl(parts.torso, 7.6 * broad, 6.4 * broad, 17, o.shirt, 0, 0, 0, 10);
    if (o.belly) sphere(parts.torso, 6.6 * broad, o.shirt, 0, 5, 2.2, 10).scale.set(1, 1, 0.75);
    box(parts.torso, 13.6 * broad, 2.4, 11 * broad, o.belt, 0, 1.2, 0);
    sphere(parts.torso, 1.3, '#d4a017', 0, 2.4, 5.6 * broad, 6);
    if (o.apron) box(parts.torso, 11 * broad, 18, 1.2, o.apron, 0, -6, 6.6 * broad);
    if (o.vest) {
      box(parts.torso, 4.4, 16, 1.2, o.vest, -4.2 * broad, 0.5, 6.3 * broad);
      box(parts.torso, 4.4, 16, 1.2, o.vest, 4.2 * broad, 0.5, 6.3 * broad);
    }
    // shoulders
    sphere(parts.torso, 3.8 * broad, o.sleeve || o.shirt, -7.4 * broad, 15.6, 0, 8);
    sphere(parts.torso, 3.8 * broad, o.sleeve || o.shirt, 7.4 * broad, 15.6, 0, 8);

    // arms: pivot at the shoulder, hanging down -Y
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? 1 : -1; // character's left is +X when facing +Z
      const arm = new THREE.Group();
      arm.position.set(sx * 8.4 * broad, 15.4, 0);
      parts.torso.add(arm);
      cyl(arm, 2.5 * broad, 2.2 * broad, 9, o.sleeve || o.shirt, 0, -9, 0, 8);
      const fore = new THREE.Group();
      fore.position.y = -9;
      arm.add(fore);
      cyl(fore, 2.1 * broad, 1.9 * broad, 8.5, o.forearm || o.skin, 0, -8.5, 0, 8);
      const hand = sphere(fore, 2.4 * broad, o.skin, 0, -9.6, 0, 8);
      parts['arm' + side] = arm;
      parts['fore' + side] = fore;
      parts['hand' + side] = hand;
    }

    // head
    parts.head = new THREE.Group();
    parts.head.position.y = 17.5;
    parts.torso.add(parts.head);
    cyl(parts.head, 2.4, 2.8, 3, o.skin, 0, 0, 0, 8);
    const skull = sphere(parts.head, 6.2, o.skin, 0, 8.4, 0, 14);
    skull.scale.set(0.95, 1.08, 1);
    for (const sx of [-1, 1]) {
      sphere(parts.head, 0.95, '#1b1410', sx * 2.3, 9.4, 5.6, 6);           // eye
      box(parts.head, 2.6, 0.7, 0.8, o.brow || o.hair, sx * 2.3, 10.9, 5.4); // brow
      sphere(parts.head, 1.4, o.skin, sx * 6.1, 8.4, 0, 6);                  // ear
    }
    box(parts.head, 1.6, 2.6, 2.2, o.nose || o.skin, 0, 6.8, 6.2);          // nose
    sphere(parts.head, 1.1, '#e8a17a', -3.4, 6.6, 5.0, 6).scale.set(1, 0.6, 0.4); // cheeks
    sphere(parts.head, 1.1, '#e8a17a', 3.4, 6.6, 5.0, 6).scale.set(1, 0.6, 0.4);
    if (o.hair) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(6.5, 14, 10, 0, Math.PI * 2, 0, Math.PI * (o.bald ? 0.18 : 0.52)), mat(o.hair));
      cap.position.y = 8.8;
      cap.rotation.x = o.bald ? 0 : -0.25;
      parts.head.add(cap);
      if (o.bald) {
        // fringe around the back of a bald head
        const fringe = new THREE.Mesh(new THREE.TorusGeometry(5.6, 1.4, 6, 14, Math.PI * 1.2), mat(o.hair));
        fringe.rotation.set(Math.PI / 2, 0, Math.PI * 0.9);
        fringe.position.set(0, 7.4, -1);
        parts.head.add(fringe);
      }
    }
    if (o.beard) {
      const beard = new THREE.Mesh(new THREE.ConeGeometry(5.2, o.longBeard ? 11 : 7, 10), mat(o.beard));
      beard.rotation.x = Math.PI;
      beard.position.set(0, o.longBeard ? 1.4 : 3.2, 4.2);
      beard.scale.z = 0.7;
      parts.head.add(beard);
      box(parts.head, 6.4, 1.4, 1.6, o.beard, 0, 5.2, 6.0); // moustache
    }
    if (o.hat) o.hat(parts.head);

    g.userData.parts = parts;
    return g;
  }

  // ---------- prop builders: return { root, animate?(t, state) } ----------
  const BUILDERS = {};

  BUILDERS.merchant = () => {
    const root = new THREE.Group();
    const wood = '#8b5a2b', darkWood = '#5b3a1e', light = '#b07a45';

    // plank floor
    box(root, 76, 2, 76, darkWood, 0, 0, 0);
    for (let i = -3; i <= 3; i++) box(root, 76, 0.4, 0.8, '#3f2814', 0, 2, i * 10.5);

    // posts: the awning only shades the back shelves, so the shopkeeper
    // standing at the counter stays in view from the iso camera
    for (const [px, pz, h] of [[-34, -34, 76], [-34, 34, 76], [-4, -34, 66], [-4, 34, 66]]) cyl(root, 2.2, 2.6, h, darkWood, px, 2, pz, 8);

    // striped awning, sloping from the back (y78) down toward the counter (y66)
    const canopy = new THREE.Group();
    const run = 46, drop = 12;
    canopy.position.set(-17, 73, 0);
    canopy.rotation.z = -Math.atan2(drop, run);
    root.add(canopy);
    const stripes = 8, span = 84;
    for (let i = 0; i < stripes; i++) {
      const sw = span / stripes;
      box(canopy, Math.hypot(run, drop), 1.6, sw, i % 2 ? '#f3ead8' : '#b83227', 0, 0, -span / 2 + sw * (i + 0.5));
    }
    // scalloped valance along the front edge
    for (let i = 0; i < stripes; i++) {
      const sw = span / stripes;
      const flap = new THREE.Mesh(new THREE.CylinderGeometry(sw / 2, sw / 2, 1.4, 12, 1, false, 0, Math.PI), mat(i % 2 ? '#f3ead8' : '#b83227'));
      flap.rotation.set(0, Math.PI / 2, Math.PI / 2);
      flap.position.set(6.5, 66.5, -span / 2 + sw * (i + 0.5));
      root.add(flap);
    }

    // back shelves with jars & pots
    box(root, 6, 40, 70, wood, -33, 2, 0);
    for (const sy of [16, 30]) {
      box(root, 12, 1.6, 70, light, -28, sy, 0);
      for (let j = -3; j <= 3; j++) {
        const colors = ['#2e7d32', '#1565c0', '#8e24aa', '#c62828', '#ef6c00'];
        cyl(root, 2.2, 2.6, 6, colors[(j + 3 + sy) % colors.length], -27, sy + 1.6, j * 9.5, 8, { roughness: 0.3 });
      }
    }

    // counter
    box(root, 12, 22, 64, wood, 24, 2, 0);
    box(root, 15, 2, 68, light, 24, 24, 0);
    box(root, 1, 16, 58, '#6d4423', 30.4, 5, 0);
    // goods: apples crate, potions, cloth rolls, bread
    box(root, 12, 5, 16, darkWood, 24, 26, -20);
    for (let a = 0; a < 7; a++) sphere(root, 2.5, a % 3 ? '#c62828' : '#7cb342', 21 + (a % 3) * 3, 31.4, -25 + Math.floor(a / 3) * 4.5 + (a % 2), 8);
    const potionColors = ['#e53935', '#1e88e5', '#43a047', '#8e24aa'];
    potionColors.forEach((c, i) => {
      cyl(root, 1.8, 2.4, 6.5, mat(c, { emissive: c, emissiveIntensity: 0.35, roughness: 0.2 }), 21 + (i % 2) * 5, 26, -4 + i * 3.4, 8);
      cyl(root, 1, 1, 1.6, '#c8a165', 21 + (i % 2) * 5, 32.5, -4 + i * 3.4, 6);
    });
    for (let r = 0; r < 3; r++) {
      const roll = cyl(root, 2.8, 2.8, 12, ['#5e35b1', '#00897b', '#f9a825'][r], 0, 0, 0, 10);
      roll.rotation.x = Math.PI / 2;
      roll.position.set(22 + (r === 2 ? 3 : 0), 28.8 + (r === 2 ? 4.6 : 0), 14 + (r === 2 ? 2.8 : r * 5.6));
    }
    // barrels & crate by the stall
    cyl(root, 7, 6.2, 16, '#7b4a22', 42, 0, 30, 12);
    for (const by of [3, 12]) cyl(root, 7.3, 7.3, 1.2, '#3e3e3e', 42, by, 30, 12);
    box(root, 13, 12, 13, light, 42, 0, -30);
    box(root, 13.4, 1, 13.4, darkWood, 42, 6, -30);

    // sign board on the counter front
    const sign = textPlane("OLAF'S GOODS", 40, 10.5, '#d9b67c', '#3b2412');
    sign.position.set(30.8, 12, 0);
    sign.rotation.y = Math.PI / 2;
    root.add(sign);
    // lanterns hanging from the awning edge
    for (const lz of [-30, 30]) {
      box(root, 0.6, 6, 0.6, '#222', 4, 60, lz);
      box(root, 3.6, 5, 3.6, glow('#ffb347', 0.9), 4, 55, lz);
    }

    // Olaf: green cap with a feather, rosy cheeks, ginger moustache
    const olaf = makeHuman({
      skin: '#e9b48f', hair: '#b5651d', brow: '#8d4b16', beard: '#b5651d',
      shirt: '#2f6fb0', sleeve: '#2f6fb0', vest: '#7a4b23', pants: '#5d4037', boots: '#3e2723', belt: '#3e2723',
      hat: head => {
        cyl(head, 6.8, 6.8, 3.6, '#2e7d32', 0, 12.2, 0, 14);
        cyl(head, 9.4, 9.4, 0.8, '#1b5e20', 0, 11.6, 0, 16);
        const feather = new THREE.Mesh(new THREE.ConeGeometry(1.2, 11, 6), mat('#e53935'));
        feather.position.set(-5, 18, -2);
        feather.rotation.z = 0.6;
        head.add(feather);
      }
    });
    olaf.position.set(11, 2, 0);
    olaf.rotation.y = Math.PI / 2;
    root.add(olaf);
    const P = olaf.userData.parts;
    P.armL.rotation.set(-0.5, 0, 0.12);
    P.foreL.rotation.x = -0.9;

    return {
      root,
      animate(t) {
        P.torso.scale.y = 1 + Math.sin(t * 2.2) * 0.012;
        P.head.rotation.y = Math.sin(t * 0.6) * 0.45;
        P.head.rotation.x = Math.sin(t * 0.9) * 0.05;
        // friendly wave every ~6 seconds
        const cyc = t % 6;
        const wave = cyc < 1.6 ? Math.sin((cyc / 1.6) * Math.PI) : 0;
        P.armR.rotation.set(-wave * 0.4, 0, -0.1 - wave * 2.3);
        P.foreR.rotation.set(0, 0, -wave * (0.6 + Math.sin(t * 14) * 0.35));
      }
    };
  };

  BUILDERS.blacksmith = () => {
    const root = new THREE.Group();
    const stone = '#7a7f87', darkStone = '#565b63', wood = '#6d4423';

    box(root, 78, 2, 78, '#5f646b', 0, 0, 0);
    for (let i = -3; i <= 3; i++) box(root, 78, 0.3, 0.6, '#45494f', 0, 2, i * 11);

    // timber posts & a shingled lean-to that only covers the forge at the
    // back, leaving Brom and the anvil out front in view
    for (const [px, pz, h] of [[-36, -36, 74], [-36, 36, 74], [-6, -36, 64], [-6, 36, 64]]) box(root, 4.4, h, 4.4, wood, px, 2, pz);
    const roof = new THREE.Group();
    roof.position.set(-21, 71, 0);
    roof.rotation.z = -Math.atan2(12, 44);
    root.add(roof);
    for (let r = 0; r < 4; r++) box(roof, 13, 2.2, 84, r % 2 ? '#5b3a29' : '#4a2f21', -19 + r * 12.2, -r * 0.5, 0);

    // stone forge with glowing coals, chimney and bellows
    box(root, 24, 26, 34, stone, -24, 2, -18);
    box(root, 26, 3, 36, darkStone, -24, 28, -18);
    box(root, 2, 12, 18, '#1a1410', -11.6, 8, -18);
    for (let c = 0; c < 6; c++) sphere(root, 2.6, glow(c % 2 ? '#ff6d00' : '#ffab40', 1.4), -14 + (c % 2) * 2.4, 10 + (c % 3), -24 + c * 2.4, 6);
    box(root, 14, 74, 14, darkStone, -28, 31, -20);
    box(root, 17, 3, 17, stone, -28, 104, -20);
    const bellows = box(root, 10, 5, 14, '#5d4037', -8, 2, -40);
    bellows.rotation.z = 0.25;

    // anvil on a stump, with a glowing blade on it
    cyl(root, 7, 8, 10, '#8d6e63', 18, 2, 6, 12);
    box(root, 9, 3, 7, '#2b2f36', 18, 12, 6, { metalness: 0.6, roughness: 0.4 });
    box(root, 5, 4, 5, '#2b2f36', 18, 15, 6, { metalness: 0.6, roughness: 0.4 });
    box(root, 7, 4, 18, '#3a3f47', 18, 19, 6, { metalness: 0.7, roughness: 0.35 });
    const horn = new THREE.Mesh(new THREE.ConeGeometry(3, 8, 8), mat('#3a3f47', { metalness: 0.7, roughness: 0.35 }));
    horn.rotation.x = Math.PI / 2;
    horn.position.set(18, 21, 19);
    root.add(horn);
    box(root, 1.6, 0.8, 14, glow('#ff8f00', 1.2), 18, 23, 4);

    // tool rack on the back wall
    box(root, 2, 24, 30, wood, -36, 30, 18);
    for (let k = 0; k < 4; k++) {
      cyl(root, 0.7, 0.7, 14, '#5d4037', -34.5, 34, 7 + k * 7, 6);
      box(root, 3, 3.4, 5, '#4b5058', -34.5, 46, 7 + k * 7, { metalness: 0.6 });
    }
    // quench trough and a barrel of finished swords
    box(root, 14, 9, 22, wood, 30, 2, -22);
    box(root, 11, 0.6, 19, mat('#3d7ab8', { roughness: 0.15 }), 30, 10.6, -22);
    cyl(root, 6, 5.4, 13, '#7b4a22', 36, 2, 28, 12);
    for (let k = 0; k < 3; k++) {
      const sw = box(root, 1.4, 22, 3, '#c9d1d9', 34 + k * 2.4, 10, 26 + k * 2, { metalness: 0.8, roughness: 0.25 });
      sw.rotation.z = -0.15 + k * 0.12;
      box(root, 6, 1.2, 1.2, '#8d6e63', 34 + k * 2.4, 31, 26 + k * 2);
    }

    // sign on the chimney, above the roofline
    const sign = textPlane('BROM FORGE', 26, 7, '#c9b28a', '#2b1a0e');
    sign.position.set(-20.6, 86, -20);
    sign.rotation.y = Math.PI / 2;
    root.add(sign);

    // Brom: burly, bald, big grey beard, leather apron, hammer in hand
    const brom = makeHuman({
      broad: 1.22, belly: true, bald: true, longBeard: true,
      skin: '#d79b72', hair: '#5d4037', brow: '#4e342e', beard: '#9e9e9e',
      shirt: '#7b5e45', sleeve: '#d79b72', forearm: '#d79b72', apron: '#4e342e',
      pants: '#37474f', boots: '#212121', belt: '#212121'
    });
    brom.position.set(4, 2, 6);
    brom.rotation.y = Math.PI / 2;
    root.add(brom);
    const P = brom.userData.parts;
    const hammer = new THREE.Group();
    hammer.position.y = -9.6;
    P.foreR.add(hammer);
    cyl(hammer, 0.9, 0.9, 13, '#6d4c41', 0, -1, 0, 6).rotation.x = Math.PI / 2;
    hammer.children[0].position.set(0, 0, 5);
    box(hammer, 4.4, 4.4, 7, '#3d4249', 0, -2.2, 11, { metalness: 0.7, roughness: 0.3 });
    P.armL.rotation.set(-0.7, 0, 0.15);
    P.foreL.rotation.x = -0.6;

    const STRIKE = 1.3; // seconds per hammer blow
    const state = { lastBlow: -1 };
    return {
      root,
      // world-space offset (in tiles) and height of the anvil face for sparks
      sparkOffset: { x: 18 / TILE, y: 6 / TILE, z: 0.6 },
      animate(t) {
        const ph = (t % STRIKE) / STRIKE;
        // slow lift, fast slam, short rest
        let lift;
        if (ph < 0.55) lift = Math.sin((ph / 0.55) * Math.PI * 0.5);
        else if (ph < 0.68) lift = 1 - (ph - 0.55) / 0.13;
        else lift = 0;
        P.armR.rotation.set(-0.55 - lift * 1.9, 0, -0.05);
        P.foreR.rotation.x = -0.75 + lift * 0.35;
        P.torso.rotation.x = 0.06 + (1 - lift) * 0.06;
        P.head.rotation.x = 0.15;
        P.torso.scale.y = 1 + Math.sin(t * 2) * 0.01;
        const blow = Math.floor(t / STRIKE);
        if (ph >= 0.68 && blow !== state.lastBlow) {
          state.lastBlow = blow;
          return { struck: true };
        }
        return null;
      }
    };
  };

  BUILDERS.house = (variant = 0) => {
    const root = new THREE.Group();
    const roofColors = ['#9c3b2e', '#3d5a80', '#5b6b3a'];
    const plaster = ['#efe3c8', '#e8dcc4', '#f1e7d0'][variant % 3];
    const timber = '#4a2f1d';
    const W = 92, D = 72, H = 40;

    box(root, W + 4, 7, D + 4, '#7d7f84', 0, 0, 0);          // stone footing
    box(root, W, H, D, plaster, 0, 7, 0);                    // walls
    // timber frame on the two visible faces (+X and +Z)
    for (const zx of [-W / 2, W / 2]) box(root, 3, H, 3, timber, zx, 7, D / 2);
    for (const zz of [-D / 2, D / 2]) box(root, 3, H, 3, timber, W / 2, 7, zz);
    box(root, W, 2.6, 1.6, timber, 0, 7 + H * 0.5, D / 2 + 0.6);
    box(root, 1.6, 2.6, D, timber, W / 2 + 0.6, 7 + H * 0.5, 0);
    box(root, W, 3, 1.6, timber, 0, 7 + H - 3, D / 2 + 0.6);
    for (const bx of [-W / 2 + 14, W / 2 - 14]) {
      const brace = box(root, 2.2, H * 0.6, 1.4, timber, bx, 7 + H * 0.5, D / 2 + 0.9);
      brace.position.y = 7 + H * 0.75;
      brace.rotation.z = bx < 0 ? 0.7 : -0.7;
    }

    // door + steps on the +Z face, windows with warm light and shutters
    box(root, 15, 24, 2, '#5d3a1f', -W / 2 + 22, 7, D / 2 + 1);
    box(root, 18, 2.4, 2.6, timber, -W / 2 + 22, 31, D / 2 + 1.2);
    sphere(root, 1, '#d4a017', -W / 2 + 27, 19, D / 2 + 2.4, 6);
    box(root, 20, 3, 6, '#7d7f84', -W / 2 + 22, 0, D / 2 + 4);
    const windowAt = (x, y, z, facingX) => {
      const pane = box(root, facingX ? 1 : 12, 11, facingX ? 12 : 1, glow('#ffcc70', 0.8), x, y, z);
      const shutter = (off) => box(root, facingX ? 1.4 : 5, 12, facingX ? 5 : 1.4, roofColors[variant % 3], facingX ? x + 0.4 : x + off, y - 0.5, facingX ? z + off : z + 0.4);
      shutter(-8.6); shutter(8.6);
      box(root, facingX ? 3 : 14, 2.4, facingX ? 14 : 3, '#6d4423', facingX ? x + 1.2 : x, y - 3.4, facingX ? z : z + 1.2);
      // flower box
      for (let f = -1; f <= 1; f++) sphere(root, 1.8, f ? '#e57373' : '#fff176', facingX ? x + 2.2 : x + f * 4, y - 0.6, facingX ? z + f * 4 : z + 2.2, 6);
      return pane;
    };
    windowAt(W / 2 - 22, 18, D / 2 + 0.6, false);
    windowAt(W / 2 + 0.6, 18, -D / 2 + 20, true);
    windowAt(W / 2 + 0.6, 18, D / 2 - 20, true);

    // gabled roof, ridge along X
    const roofY = 7 + H;
    const pitch = 0.62;
    const slopeLen = (D / 2 + 8) / Math.cos(pitch);
    for (const side of [-1, 1]) {
      const slope = new THREE.Group();
      slope.position.set(0, roofY + Math.tan(pitch) * (D / 2 + 8) / 2, side * (D / 4 + 2));
      slope.rotation.x = side * pitch;
      root.add(slope);
      for (let r = 0; r < 5; r++) box(slope, W + 12, 2.6, slopeLen / 5 + 1, r % 2 ? roofColors[variant % 3] : new THREE.Color(roofColors[variant % 3]).multiplyScalar(0.82).getStyle(), 0, -1.3, -side * (slopeLen / 2 - (r + 0.5) * slopeLen / 5));
    }
    // gable triangles
    const ridgeH = Math.tan(pitch) * (D / 2);
    const gable = new THREE.Shape();
    gable.moveTo(-D / 2, 0); gable.lineTo(D / 2, 0); gable.lineTo(0, ridgeH); gable.lineTo(-D / 2, 0);
    for (const gx of [-W / 2, W / 2]) {
      const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), mat(plaster, { side: THREE.DoubleSide }));
      gm.rotation.y = Math.PI / 2;
      gm.position.set(gx, roofY, 0);
      root.add(gm);
    }
    // chimney
    box(root, 9, 26, 9, '#8a5a44', -W / 2 + 18, roofY + 10, -D / 6);
    box(root, 11, 2.4, 11, '#5b5f66', -W / 2 + 18, roofY + 36, -D / 6);
    return { root };
  };

  function stoneTower(root, w, h) {
    box(root, w, h, w, '#8b9099', 0, 0, 0);
    for (let y = 16; y < h; y += 16) box(root, w + 1.2, 1.2, w + 1.2, '#6f747d', 0, y, 0);
    // arrow slits on the visible faces
    for (const y of [h * 0.45, h * 0.75]) {
      box(root, 2.6, 10, 1, '#14171c', 0, y, w / 2 + 0.2);
      box(root, 1, 10, 2.6, '#14171c', w / 2 + 0.2, y, 0);
    }
    // battlement
    box(root, w + 8, 6, w + 8, '#9da2ab', 0, h, 0);
    const half = (w + 8) / 2 - 3.5;
    for (let i = -1; i <= 1; i++) {
      for (const [mx, mz] of [[i * half * 0.66, half], [i * half * 0.66, -half], [half, i * half * 0.66], [-half, i * half * 0.66]]) {
        box(root, 7, 8, 7, '#9da2ab', mx, h + 6, mz);
      }
    }
  }

  function banner(root, x, y, z, facingX) {
    const b = box(root, facingX ? 1 : 14, 30, facingX ? 14 : 1, '#9b1c1c', x, y, z);
    box(root, facingX ? 1.6 : 16, 2.4, facingX ? 16 : 1.6, '#d4a017', x, y + 29, z);
    const emblem = box(root, facingX ? 1.6 : 6, 6, facingX ? 6 : 1.6, '#f6c343', x + (facingX ? 0.3 : 0), y + 15, z + (facingX ? 0 : 0.3));
    emblem.rotation[facingX ? 'x' : 'z'] = Math.PI / 4;
    return b;
  }

  BUILDERS.gate_tower = () => {
    const root = new THREE.Group();
    const w = 36, h = 92;
    stoneTower(root, w, h);
    banner(root, 0, h - 44, w / 2 + 0.8, false);
    banner(root, w / 2 + 0.8, h - 44, 0, true);
    // torch sconce glow
    box(root, 3, 4, 3, glow('#ffb347', 1.2), w / 2 + 2, 30, w / 2 - 6);
    return { root };
  };

  BUILDERS.corner_keep = () => {
    const root = new THREE.Group();
    const r = 26, h = 104;
    cyl(root, r, r + 2, h, '#8b9099', 0, 0, 0, 16);
    for (let y = 18; y < h; y += 18) cyl(root, r + 0.8, r + 0.8, 1.4, '#6f747d', 0, y, 0, 16);
    cyl(root, r + 5, r + 5, 6, '#9da2ab', 0, h, 0, 16);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      box(root, 7, 8, 7, '#9da2ab', Math.cos(a) * (r + 2), h + 6, Math.sin(a) * (r + 2));
    }
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r + 4, 44, 16), mat('#2f3b55'));
    cone.position.y = h + 6 + 22;
    root.add(cone);
    cyl(root, 0.8, 0.8, 26, '#3e2723', 0, h + 50, 0, 6);
    const flag = box(root, 1, 11, 18, '#b71c1c', 0, h + 63, 9);
    flag.rotation.y = -0.35;
    for (const y of [h * 0.4, h * 0.7]) {
      box(root, 2.6, 10, 1, '#14171c', 0, y, r + 1.2);
      box(root, 1, 10, 2.6, '#14171c', r + 1.2, y, 0);
    }
    return { root };
  };

  // ---------- offscreen renderer ----------
  class TownProps3D {
    constructor() {
      this.canvas = document.createElement('canvas');
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
      this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.setClearColor(0x000000, 0);
      this.bufW = 0;
      this.bufH = 0;
      this.ensureBuffer(256, 256);

      this.scene = new THREE.Scene();
      this.scene.add(new THREE.HemisphereLight(0xe0ecff, 0x4a3a2a, 0.75));
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
      const sun = new THREE.DirectionalLight(0xfff4e0, 1.25);
      sun.position.set(-320, 520, 420);
      this.scene.add(sun);

      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
      this.camera.position.set(0, 0, 1000);
      this.camera.lookAt(0, 0, 0);

      this.instances = new Map(); // key -> { tilt, prop, frame }
      this.cache = new Map();     // key|zoom -> canvas
      this.cacheZoom = null;
    }

    ensureBuffer(w, h) {
      if (w <= this.bufW && h <= this.bufH) return;
      this.bufW = Math.max(w, this.bufW);
      this.bufH = Math.max(h, this.bufH);
      this.renderer.setSize(this.bufW, this.bufH, false);
    }

    getInstance(type, variant) {
      const key = `${type}|${variant || 0}`;
      if (this.instances.has(key)) return this.instances.get(key);
      const builder = BUILDERS[type];
      if (!builder) return null;
      const prop = builder(variant || 0);
      const tilt = new THREE.Group();
      tilt.rotation.x = ISO_TILT;
      const yaw = new THREE.Group();
      yaw.rotation.y = ISO_YAW;
      tilt.add(yaw);
      yaw.add(prop.root);
      tilt.visible = false;
      this.scene.add(tilt);

      // Screen-space frame at zoom 1 (camera looks straight down -Z, so world
      // x/y are screen px), padded for animation
      tilt.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(tilt);
      const pad = 8;
      const frame = { minX: bb.min.x - pad, maxX: bb.max.x + pad, minY: bb.min.y - pad, maxY: bb.max.y + pad };
      const inst = { key, tilt, prop, frame, animated: !!prop.animate };
      this.instances.set(key, inst);
      return inst;
    }

    renderInstance(inst, zoom) {
      const f = inst.frame;
      const w = Math.ceil((f.maxX - f.minX) * zoom);
      const h = Math.ceil((f.maxY - f.minY) * zoom);
      this.ensureBuffer(w, h);

      inst.tilt.scale.setScalar(zoom);
      this.camera.left = f.minX * zoom;
      this.camera.right = f.minX * zoom + w;
      this.camera.top = f.maxY * zoom;
      this.camera.bottom = f.maxY * zoom - h;
      this.camera.updateProjectionMatrix();

      for (const other of this.instances.values()) other.tilt.visible = other === inst;
      this.renderer.setViewport(0, this.bufH - h, w, h);
      this.renderer.setScissor(0, this.bufH - h, w, h);
      this.renderer.setScissorTest(true);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      inst.tilt.visible = false;
      return { w, h };
    }

    // Paint a prop at its ground anchor. Returns null if the type is not a
    // 3D prop, otherwise { top, events } where top is the screen y of the
    // prop's highest point (for name tags).
    draw(ctx, obs, screenX, screenY, zoom, time) {
      const inst = this.getInstance(obs.type, obs.variant);
      if (!inst) return null;
      const f = inst.frame;
      const dx = screenX + f.minX * zoom;
      const dy = screenY - f.maxY * zoom;
      let events = null;

      if (inst.animated) {
        events = inst.prop.animate(time) || null;
        const { w, h } = this.renderInstance(inst, zoom);
        const pr = this.pixelRatio;
        ctx.drawImage(this.canvas, 0, 0, w * pr, h * pr, dx, dy, w, h);
      } else {
        // Cache at zoom steps of 0.05 and scale the image in between, so a
        // smooth camera zoom doesn't re-render every static prop each frame
        const bucket = Math.max(0.3, Math.round(zoom * 20) / 20);
        const zoomKey = bucket.toFixed(2);
        if (this.cacheZoom !== zoomKey) {
          this.cache.clear();
          this.cacheZoom = zoomKey;
        }
        let img = this.cache.get(inst.key);
        if (!img) {
          const { w, h } = this.renderInstance(inst, bucket);
          const pr = this.pixelRatio;
          img = document.createElement('canvas');
          img.width = Math.ceil(w * pr);
          img.height = Math.ceil(h * pr);
          img.getContext('2d').drawImage(this.canvas, 0, 0, w * pr, h * pr, 0, 0, img.width, img.height);
          img.cssW = w;
          img.cssH = h;
          this.cache.set(inst.key, img);
        }
        const s = zoom / bucket;
        ctx.drawImage(img, dx, dy, img.cssW * s, img.cssH * s);
      }

      return { top: dy, events, sparkOffset: inst.prop.sparkOffset };
    }
  }

  try {
    window.townProps3D = new TownProps3D();
  } catch (err) {
    console.warn('3D town props unavailable, falling back to 2D props:', err);
    window.townProps3D = null;
  }
})();
