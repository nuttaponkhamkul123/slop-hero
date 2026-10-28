// 3D town props for Slop Hero: market stall (Olaf), forge (Brom), houses,
// gate towers, corner keeps and city street furniture (stalls, lamps, crates,
// flower beds, benches, the garden well).
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
  // Old-world colour grade: every painted surface is aged toward dusty, faded
  // earth tones (half the saturation, dimmer highlights, a warm brown cast).
  // Glowing parts (windows, lanterns, coals, runes) fade only a little.
  const AGE = { sat: 0.38, light: 0.72, lightLift: 0.05, warmHue: 30 / 360, warmPull: 0.22 };
  const AGE_GLOW = { sat: 0.55, light: 0.9, lightLift: 0, warmHue: 30 / 360, warmPull: 0.1 };
  function aged(color, k = AGE) {
    const c = new THREE.Color(color), hsl = {};
    c.getHSL(hsl);
    let dh = AGE.warmHue - hsl.h;
    if (dh > 0.5) dh -= 1; else if (dh < -0.5) dh += 1;
    const h = (hsl.h + dh * k.warmPull + 1) % 1;
    c.setHSL(h, hsl.s * k.sat, hsl.l * k.light + k.lightLift);
    return c;
  }
  const matCache = new Map();
  function mat(color, opts) {
    const key = color + (opts ? JSON.stringify(opts) : '');
    if (!matCache.has(key)) {
      // flat faces without specular sheen: each face reads as one colour, as in pixel art
      const o = Object.assign({}, opts || {});
      delete o.roughness; delete o.metalness;
      const tint = aged(color, o.emissive ? AGE_GLOW : AGE);
      if (o.emissive) o.emissive = aged(o.emissive, AGE_GLOW);
      matCache.set(key, new THREE.MeshPhongMaterial(Object.assign({ color: tint, flatShading: true, shininess: 0, specular: 0x000000 }, o)));
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

  // ---------- pixel-art pass ----------
  // The rendered prop is turned into pixel art so it sits with the pixel ground
  // and sprites: hard alpha, colours snapped to ramps with an ordered-dither
  // grain, 1px lines where faces of different brightness meet, dark outline.
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const STEP = 14;   // colour ramp step per channel
  // weathering: grime patches, chipped specks, dirt collecting toward the ground
  const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
  function grime(x, y) {
    const C = 7, gx = x / C, gy = y / C, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const sm = t => t * t * (3 - 2 * t);
    const a = hash(x0, y0), b = hash(x0 + 1, y0), c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1);
    return a + (b - a) * sm(fx) + (c - a) * sm(fy) + (a - b - c + d) * sm(fx) * sm(fy);
  }
  function pixelize(canvas) {
    const W = canvas.width, H = canvas.height;
    if (!W || !H) return;
    const g = canvas.getContext('2d');
    const img = g.getImageData(0, 0, W, H), d = img.data;
    const src = new Uint8ClampedArray(d);
    const lum = new Float32Array(W * H);
    for (let i = 0, p = 0; p < W * H; p++, i += 4) {
      if (src[i + 3] < 110) { d[i + 3] = 0; lum[p] = -1; continue; }
      const x = p % W, y = (p / W) | 0;
      const dither = (BAYER4[((y & 3) << 2) | (x & 3)] / 16 - 0.5) * STEP;
      const glowing = src[i] + src[i + 1] + src[i + 2] > 600;   // lit windows / flames stay clean
      let wear = 1;
      if (!glowing) {
        const patch = grime(x, y);
        if (patch > 0.62) wear -= (patch - 0.62) * 0.55;          // soot and grime stains
        if (hash(x * 3.1, y * 1.7) > 0.965) wear -= 0.16;          // chipped specks
        wear -= 0.1 * (y / H) * (y / H);                           // dirt toward the ground
      }
      for (let c = 0; c < 3; c++) d[i + c] = Math.round((src[i + c] * wear + dither) / STEP) * STEP;
      d[i + 3] = 255;
      lum[p] = src[i] * 0.3 + src[i + 1] * 0.59 + src[i + 2] * 0.11;
    }
    for (let p = 0; p < W * H; p++) {
      const i = p * 4, x = p % W, y = (p / W) | 0;
      if (lum[p] < 0) {
        // outline: an empty pixel touching the prop takes a deep shade of it
        const n = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1].find(q => q >= 0 && lum[q] >= 0);
        if (n !== undefined) {
          const j = n * 4;
          d[i] = src[j] * 0.22 + 6; d[i + 1] = src[j + 1] * 0.22 + 6; d[i + 2] = src[j + 2] * 0.22 + 14; d[i + 3] = 255;
        }
        continue;
      }
      // internal line on the darker side of a strong brightness step
      const r = x < W - 1 ? lum[p + 1] : -1, b = y < H - 1 ? lum[p + W] : -1;
      if ((r >= 0 && lum[p] < r - 38) || (b >= 0 && lum[p] < b - 38)) {
        d[i] *= 0.62; d[i + 1] *= 0.62; d[i + 2] *= 0.66;
      }
    }
    g.putImageData(img, 0, 0);
  }

  // ---------- prop builders: return { root, front?, animate?(t, state) } ----------
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

    // nearest the camera: drawn over the pixel-art shopkeeper (renderer.drawShopkeeper)
    const front = new THREE.Group();
    root.add(front);
    // counter
    box(front, 12, 22, 64, wood, 24, 2, 0);
    box(front, 15, 2, 68, light, 24, 24, 0);
    box(front, 1, 16, 58, '#6d4423', 30.4, 5, 0);
    // goods: apples crate, potions, cloth rolls, bread
    box(front, 12, 5, 16, darkWood, 24, 26, -20);
    for (let a = 0; a < 7; a++) sphere(front, 2.5, a % 3 ? '#c62828' : '#7cb342', 21 + (a % 3) * 3, 31.4, -25 + Math.floor(a / 3) * 4.5 + (a % 2), 8);
    const potionColors = ['#e53935', '#1e88e5', '#43a047', '#8e24aa'];
    potionColors.forEach((c, i) => {
      cyl(front, 1.8, 2.4, 6.5, mat(c, { emissive: c, emissiveIntensity: 0.35, roughness: 0.2 }), 21 + (i % 2) * 5, 26, -4 + i * 3.4, 8);
      cyl(front, 1, 1, 1.6, '#c8a165', 21 + (i % 2) * 5, 32.5, -4 + i * 3.4, 6);
    });
    for (let r = 0; r < 3; r++) {
      const roll = cyl(front, 2.8, 2.8, 12, ['#5e35b1', '#00897b', '#f9a825'][r], 0, 0, 0, 10);
      roll.rotation.x = Math.PI / 2;
      roll.position.set(22 + (r === 2 ? 3 : 0), 28.8 + (r === 2 ? 4.6 : 0), 14 + (r === 2 ? 2.8 : r * 5.6));
    }
    // barrels & crate by the stall
    cyl(front, 7, 6.2, 16, '#7b4a22', 42, 0, 30, 12);
    for (const by of [3, 12]) cyl(front, 7.3, 7.3, 1.2, '#3e3e3e', 42, by, 30, 12);
    box(front, 13, 12, 13, light, 42, 0, -30);
    box(front, 13.4, 1, 13.4, darkWood, 42, 6, -30);

    // sign board on the counter front
    const sign = textPlane("OLAF'S GOODS", 40, 10.5, '#d9b67c', '#3b2412');
    sign.position.set(30.8, 12, 0);
    sign.rotation.y = Math.PI / 2;
    front.add(sign);
    // lanterns hanging from the awning edge
    for (const lz of [-30, 30]) {
      box(root, 0.6, 6, 0.6, '#222', 4, 60, lz);
      box(root, 3.6, 5, 3.6, glow('#ffb347', 0.9), 4, 55, lz);
    }

    return { root, front };
  };

  // Valka's rune forge: an awning stall with a floating crystal over a rune
  // altar, where gear and SP cards are enhanced
  // Valka's stall opens toward the fountain (world -x): the whole booth is
  // turned half round, so the altar lies beyond her and the roof and posts
  // sit between her and the camera (the front layer, painted over her)
  BUILDERS.enchanter = () => {
    const root = new THREE.Group();
    const stone = '#5b5f7a', darkStone = '#3b3f57', wood = '#5d3a6e';
    const back = new THREE.Group(), front = new THREE.Group();
    back.rotation.y = front.rotation.y = Math.PI;
    root.add(back, front);

    box(back, 78, 2, 78, '#4a4e66', 0, 0, 0);
    for (let i = -3; i <= 3; i++) box(back, 78, 0.3, 0.6, '#3c3f55', 0, 2, i * 11);
    for (const [px, pz, h] of [[-36, -36, 70], [-36, 36, 70], [-8, -36, 62], [-8, 36, 62]]) box(front, 4.4, h, 4.4, wood, px, 2, pz);
    const roof = new THREE.Group();
    roof.position.set(-22, 67, 0);
    roof.rotation.z = -Math.atan2(10, 42);
    front.add(roof);
    for (let r = 0; r < 4; r++) box(roof, 12.4, 2.2, 84, r % 2 ? '#6d28d9' : '#4c1d95', -19 + r * 11.6, -r * 0.5, 0);

    // rune altar with a hovering crystal and a spinning ring
    box(back, 22, 14, 22, stone, 16, 2, -14);
    box(back, 25, 3, 25, darkStone, 16, 16, -14);
    for (const [rx, rz] of [[6, -24], [26, -24], [6, -4], [26, -4]]) sphere(back, 1.4, glow('#c084fc', 1.4), rx, 19.5, rz, 6);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(6, 0), glow('#c084fc', 1.6));
    crystal.position.set(16, 34, -14);
    back.add(crystal);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.8, 6, 20), glow('#a855f7', 1.2));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(16, 24, -14);
    back.add(ring);

    // low display of glowing SP cards along the camera side (kept low so it
    // doesn't hide her)
    box(front, 2, 12, 44, wood, -36, 2, 0);
    box(front, 6, 1.6, 44, darkStone, -33, 14, 0);
    ['#facc15', '#38bdf8', '#f97316', '#4ade80', '#c084fc'].forEach((c, k) => {
      box(front, 1.2, 8, 6, glow(c, 1.1), -33.4, 15.6, -16 + k * 8);
    });

    const sign = textPlane('VALKA RUNES', 26, 7, '#2e1065', '#e9d5ff');
    sign.position.set(-34.6, 58, 0);
    sign.rotation.y = -Math.PI / 2;   // the booth is turned round; keep the sign facing the camera
    front.add(sign);

    return {
      root,
      front,
      animateLayer: 'back',
      animate(t) {
        crystal.position.y = 34 + Math.sin(t * 2) * 2.5;
        crystal.rotation.y = t * 1.4;
        ring.rotation.z = t * 0.9;
        return null;
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

    // nearest the camera: drawn over the pixel-art shopkeeper (renderer.drawShopkeeper)
    const front = new THREE.Group();
    root.add(front);
    // anvil on a stump, with a glowing blade on it
    cyl(front, 7, 8, 10, '#8d6e63', 18, 2, 6, 12);
    box(front, 9, 3, 7, '#2b2f36', 18, 12, 6, { metalness: 0.6, roughness: 0.4 });
    box(front, 5, 4, 5, '#2b2f36', 18, 15, 6, { metalness: 0.6, roughness: 0.4 });
    box(front, 7, 4, 18, '#3a3f47', 18, 19, 6, { metalness: 0.7, roughness: 0.35 });
    const horn = new THREE.Mesh(new THREE.ConeGeometry(3, 8, 8), mat('#3a3f47', { metalness: 0.7, roughness: 0.35 }));
    horn.rotation.x = Math.PI / 2;
    horn.position.set(18, 21, 19);
    front.add(horn);
    box(front, 1.6, 0.8, 14, glow('#ff8f00', 1.2), 18, 23, 4);

    // tool rack on the back wall
    box(root, 2, 24, 30, wood, -36, 30, 18);
    for (let k = 0; k < 4; k++) {
      cyl(root, 0.7, 0.7, 14, '#5d4037', -34.5, 34, 7 + k * 7, 6);
      box(root, 3, 3.4, 5, '#4b5058', -34.5, 46, 7 + k * 7, { metalness: 0.6 });
    }
    // quench trough and a barrel of finished swords
    box(front, 14, 9, 22, wood, 30, 2, -22);
    box(front, 11, 0.6, 19, mat('#3d7ab8', { roughness: 0.15 }), 30, 10.6, -22);
    cyl(front, 6, 5.4, 13, '#7b4a22', 36, 2, 28, 12);
    for (let k = 0; k < 3; k++) {
      const sw = box(front, 1.4, 22, 3, '#c9d1d9', 34 + k * 2.4, 10, 26 + k * 2, { metalness: 0.8, roughness: 0.25 });
      sw.rotation.z = -0.15 + k * 0.12;
      box(front, 6, 1.2, 1.2, '#8d6e63', 34 + k * 2.4, 31, 26 + k * 2);
    }

    // sign on the chimney, above the roofline
    const sign = textPlane('BROM FORGE', 26, 7, '#c9b28a', '#2b1a0e');
    sign.position.set(-20.6, 86, -20);
    sign.rotation.y = Math.PI / 2;
    root.add(sign);

    return {
      root,
      front,
      // world-space offset (in tiles) and height of the anvil face for sparks
      sparkOffset: { x: 18 / TILE, y: 6 / TILE, z: 0.6 }
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

  // ---------- city street furniture ----------

  // Market stall: counter, striped awning and goods. Variant picks colours,
  // wares and the stall keeper; variant + 4 turns the stall to face north
  // (stalls on the south side of the boulevard face the road)
  BUILDERS.market_stall = (variant = 0) => {
    const root = new THREE.Group();
    const north = variant >= 4;
    const awnings = [['#c0392b', '#f5efe0'], ['#2e6fb5', '#f5efe0'], ['#2f9e57', '#fdf2d0'], ['#8e44ad', '#f9e79f']];
    const [stripeA, stripeB] = awnings[variant % 4];
    const wood = '#7a4a26', dark = '#4a2f1d';
    const W = 54, D = 30;

    // front = painted over the pixel-art keeper (renderer.drawShopkeeper): the
    // awning always (it hangs over their head), the counter when it is the near side
    const back = new THREE.Group(), front = new THREE.Group();
    if (north) back.rotation.y = front.rotation.y = Math.PI;
    root.add(back, front);
    const counter = north ? back : front;

    box(counter, W, 20, D * 0.55, wood, 0, 0, D * 0.2);                    // counter
    box(counter, W + 4, 2.4, D * 0.55 + 4, '#a8743f', 0, 20, D * 0.2);      // counter top
    for (let i = 0; i < 4; i++) box(counter, W, 1.2, 0.8, dark, 0, 4 + i * 4, D * 0.2 + D * 0.275 + 0.4); // planks
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) box(front, 3, 50, 3, dark, sx * (W / 2 - 1), 0, sz * (D / 2 - 1));
    }
    // sloped striped awning
    const awning = new THREE.Group();
    awning.position.set(0, 52, 0);
    awning.rotation.x = 0.28;
    front.add(awning);
    const stripes = 7;
    for (let i = 0; i < stripes; i++) {
      box(awning, W / stripes + 0.2, 2, D + 10, i % 2 ? stripeB : stripeA, -W / 2 + (i + 0.5) * W / stripes, 0, 2);
      box(awning, W / stripes + 0.2, 6, 1.2, i % 2 ? stripeB : stripeA, -W / 2 + (i + 0.5) * W / stripes, -6, D / 2 + 7);
    }

    // wares on the counter
    const top = 22.4, zc = D * 0.2;
    if (variant % 4 === 0) {
      for (let i = 0; i < 9; i++) sphere(counter, 3, i % 3 ? '#d63031' : '#7cb342', -18 + (i % 5) * 9, top + 3, zc - 4 + Math.floor(i / 5) * 7, 7);
    } else if (variant % 4 === 1) {
      for (let i = 0; i < 4; i++) {
        const fish = sphere(counter, 3.2, '#8fb3c9', -16 + i * 10, top + 2.4, zc, 7);
        fish.scale.set(2.2, 0.7, 1);
      }
      box(counter, 14, 6, 10, '#c9d6df', 16, top, zc - 2);
    } else if (variant % 4 === 2) {
      for (let i = 0; i < 4; i++) {
        const loaf = sphere(counter, 4, '#c98b3c', -18 + i * 9, top + 3, zc, 8);
        loaf.scale.set(1.5, 0.8, 1);
      }
      for (let i = 0; i < 3; i++) sphere(counter, 4, '#6fbf4a', 18, top + 4, zc - 6 + i * 6, 8);
    } else {
      const glass = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6'];
      for (let i = 0; i < 5; i++) {
        cyl(counter, 2.6, 3.2, 7, glow(glass[i], 0.25), -18 + i * 9, top, zc, 8);
        cyl(counter, 1, 1, 2.4, '#7a4a26', -18 + i * 9, top + 7, zc, 6);
      }
    }
    return { root, front };
  };

  BUILDERS.lamp_post = () => {
    const root = new THREE.Group();
    cyl(root, 4.5, 5.5, 5, '#3a3f47', 0, 0, 0, 8);
    cyl(root, 1.6, 2, 62, '#2c3038', 0, 5, 0, 8);
    box(root, 14, 1.8, 1.8, '#2c3038', 4, 62, 0);
    box(root, 8, 2, 8, '#2c3038', 10, 52, 0);
    box(root, 6, 9, 6, glow('#ffd27a', 1.4), 10, 43, 0);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(6.4, 6, 4), mat('#2c3038'));
    cap.position.set(10, 57, 0);
    cap.rotation.y = Math.PI / 4;
    root.add(cap);
    box(root, 1.2, 8, 1.2, '#2c3038', 10, 54, 0);
    return { root };
  };

  BUILDERS.crates = (variant = 0) => {
    const root = new THREE.Group();
    const crate = (x, y, z, s) => {
      box(root, s, s, s, '#a4723f', x, y, z);
      box(root, s + 0.6, 1.6, s + 0.6, '#6d4423', x, y + s - 1.6, z);
      box(root, s + 0.6, 1.6, s + 0.6, '#6d4423', x, y, z);
    };
    const barrel = (x, z) => {
      cyl(root, 7, 7, 18, '#8a5a32', x, 0, z, 12);
      for (const y of [3, 14]) cyl(root, 7.4, 7.4, 1.6, '#4a4f57', x, y, z, 12);
      cyl(root, 6.2, 6.2, 0.6, '#6d4423', x, 18, z, 12);
    };
    if (variant % 2 === 0) {
      crate(-6, 0, 0, 16);
      crate(9, 0, 4, 13);
      crate(-4, 16, 1, 12);
      barrel(10, -12);
    } else {
      barrel(-8, 0);
      barrel(8, 2);
      barrel(0, -12);
      crate(0, 18, 0, 10);
    }
    return { root };
  };

  BUILDERS.flower_bed = (variant = 0) => {
    const root = new THREE.Group();
    const palettes = [['#e57373', '#fff176', '#f48fb1'], ['#ba68c8', '#fff59d', '#81d4fa'], ['#ffb74d', '#e57373', '#ffffff']];
    const pal = palettes[variant % 3];
    box(root, 34, 9, 20, '#8d6e63', 0, 0, 0);
    box(root, 31, 1, 17, '#4e342e', 0, 9, 0);
    for (let i = 0; i < 12; i++) {
      const x = -13 + (i % 6) * 5.2, z = -5 + Math.floor(i / 6) * 10;
      cyl(root, 0.6, 0.6, 5, '#43a047', x, 9, z, 5);
      sphere(root, 2.4, pal[i % 3], x, 15, z, 6);
    }
    for (let i = 0; i < 5; i++) sphere(root, 3, '#558b2f', -12 + i * 6, 11, i % 2 ? 4 : -4, 6);
    return { root };
  };

  BUILDERS.bench = () => {
    const root = new THREE.Group();
    const wood = '#9c6b3e', iron = '#3a3f47';
    for (const sx of [-1, 1]) {
      box(root, 2.4, 10, 12, iron, sx * 14, 0, 0);
      box(root, 2.4, 14, 2.4, iron, sx * 14, 10, -5);
    }
    for (let i = 0; i < 3; i++) box(root, 34, 1.8, 3.4, wood, 0, 10, -4 + i * 4);
    for (let i = 0; i < 2; i++) box(root, 34, 3, 1.4, wood, 0, 15 + i * 5, -5.6);
    return { root };
  };

  BUILDERS.well = () => {
    const root = new THREE.Group();
    cyl(root, 18, 19, 16, '#8b9099', 0, 0, 0, 14);
    cyl(root, 19.4, 19.4, 2.4, '#9da2ab', 0, 16, 0, 14);
    cyl(root, 15, 15, 0.6, '#2f6f9f', 0, 13, 0, 14);
    for (const sx of [-1, 1]) box(root, 3, 34, 3, '#5d3a1f', sx * 15, 16, 0);
    box(root, 34, 2.4, 2.4, '#5d3a1f', 0, 42, 0);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(25, 16, 4), mat('#9c3b2e'));
    roof.position.y = 58;
    roof.rotation.y = Math.PI / 4;
    root.add(roof);
    cyl(root, 4, 3.4, 6, '#7a4a26', 4, 30, 0, 8); // bucket
    box(root, 0.6, 12, 0.6, '#c8b88a', 4, 36, 0);  // rope
    return { root };
  };

  // Market stalls south of the east-west boulevard (y 18-22) turn to face it
  const BOULEVARD_MID_Y = 20.5;
  const propVariant = obs => (obs.type === 'market_stall' && obs.y > BOULEVARD_MID_Y ? (obs.variant || 0) + 4 : obs.variant);

  // ---------- offscreen renderer ----------
  class TownProps3D {
    constructor() {
      this.canvas = document.createElement('canvas');
      // no anti-aliasing and one buffer pixel per screen pixel: the pixel pass needs crisp edges
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: false });
      this.pixelRatio = 1;
      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.setClearColor(0x000000, 0);
      this.bufW = 0;
      this.bufH = 0;
      this.ensureBuffer(256, 256);

      this.scene = new THREE.Scene();
      // softer than before: the flat Phong faces wash out to white under strong light
      this.scene.add(new THREE.HemisphereLight(0xe0ecff, 0x4a3a2a, 0.5));
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.22));
      const sun = new THREE.DirectionalLight(0xfff4e0, 0.85);
      sun.position.set(-320, 520, 420);
      this.scene.add(sun);

      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
      this.camera.position.set(0, 0, 1000);
      this.camera.lookAt(0, 0, 0);

      this.instances = new Map(); // key -> { tilt, prop, frame }
      this.cache = new Map();     // key|zoom -> canvas
      this.cacheZoom = null;
      // set by the renderer: false while the camera zoom is still changing, when
      // cached images are scaled instead of re-rendered through WebGL
      this.zoomSettled = true;
    }

    ensureBuffer(w, h) {
      if (w <= this.bufW && h <= this.bufH) return;
      this.bufW = Math.max(w, this.bufW);
      this.bufH = Math.max(h, this.bufH);
      this.renderer.setSize(this.bufW, this.bufH, false);
    }

    // layer: 'back' (everything but prop.front) or 'front' (only prop.front),
    // so a 2D shopkeeper can be painted in between; omitted = the whole prop
    getInstance(type, variant, layer) {
      const key = `${type}|${variant || 0}${layer ? '|' + layer : ''}`;
      if (this.instances.has(key)) return this.instances.get(key);
      const builder = BUILDERS[type];
      if (!builder) return null;
      const prop = builder(variant || 0);
      if (layer && prop.front) {
        if (layer === 'back') prop.root.remove(prop.front);
        else {
          prop.root.clear();
          prop.root.add(prop.front);
        }
      }
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
      // a layered prop animates only in the layer that holds its moving parts
      const inst = { key, tilt, prop, frame, empty: bb.isEmpty(), animated: !!prop.animate && (!layer || layer === (prop.animateLayer || 'front')) };
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
    draw(ctx, obs, screenX, screenY, zoom, time, layer) {
      const inst = this.getInstance(obs.type, propVariant(obs), layer);
      if (!inst) return null;
      // a layer with nothing in it (e.g. the back of a stall whose counter faces us)
      if (inst.empty) return { top: screenY, events: null, sparkOffset: inst.prop.sparkOffset };
      const f = inst.frame;
      const dx = screenX + f.minX * zoom;
      const dy = screenY - f.maxY * zoom;
      let events = null;

      if (inst.animated) {
        // Pose every frame (cheap) but re-render through WebGL at ~15 fps: each
        // render + copy out of the GL canvas stalls the GPU pipeline
        events = inst.prop.animate(time) || null;
        const now = performance.now();
        const zoomKey = zoom.toFixed(3);
        // mid-zoom: keep the last frame (scaled below) until the zoom settles
        const rezoom = inst.frameZoom !== zoomKey && this.zoomSettled;
        if (!inst.frameImg || rezoom || (now - inst.frameAt > 66 && inst.frameZoom === zoomKey)) {
          const { w, h } = this.renderInstance(inst, zoom);
          const pr = this.pixelRatio;
          const img = inst.frameImg || (inst.frameImg = document.createElement('canvas'));
          const iw = Math.ceil(w * pr), ih = Math.ceil(h * pr);
          if (img.width !== iw || img.height !== ih) {
            img.width = iw;
            img.height = ih;
          }
          const ic = img.getContext('2d');
          ic.clearRect(0, 0, iw, ih);
          ic.drawImage(this.canvas, 0, 0, w * pr, h * pr, 0, 0, iw, ih);
          pixelize(img);
          img.cssW = w;
          img.cssH = h;
          inst.frameAt = now;
          inst.frameZoom = zoomKey;
        }
        const fs = zoom / Number(inst.frameZoom);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(inst.frameImg, Math.round(dx), Math.round(dy), Math.round(inst.frameImg.cssW * fs), Math.round(inst.frameImg.cssH * fs));
        ctx.restore();
      } else {
        // Cache at zoom steps of 0.05 and scale the image in between, so a
        // smooth camera zoom doesn't re-render every static prop each frame;
        // mid-zoom the whole cache stays at its old step and is scaled
        let bucket = Math.max(0.3, Math.round(zoom * 20) / 20);
        let zoomKey = bucket.toFixed(2);
        if (this.cacheZoom !== zoomKey) {
          if (this.zoomSettled || this.cacheZoom === null) {
            this.cache.clear();
            this.cacheZoom = zoomKey;
          } else {
            zoomKey = this.cacheZoom;
            bucket = Number(zoomKey);
          }
        }
        let img = this.cache.get(inst.key);
        if (!img) {
          const { w, h } = this.renderInstance(inst, bucket);
          const pr = this.pixelRatio;
          img = document.createElement('canvas');
          img.width = Math.ceil(w * pr);
          img.height = Math.ceil(h * pr);
          img.getContext('2d').drawImage(this.canvas, 0, 0, w * pr, h * pr, 0, 0, img.width, img.height);
          pixelize(img);
          img.cssW = w;
          img.cssH = h;
          this.cache.set(inst.key, img);
        }
        const s = zoom / bucket;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, Math.round(dx), Math.round(dy), Math.round(img.cssW * s), Math.round(img.cssH * s));
        ctx.restore();
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
