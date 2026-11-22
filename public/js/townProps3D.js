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
  // houses keep more of their paint, so the streets read as many homes rather than one grey-brown
  const AGE_HOUSE = { sat: 0.62, light: 0.82, lightLift: 0.04, warmHue: 30 / 360, warmPull: 0.14 };
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
      const vivid = o.vivid;
      delete o.roughness; delete o.metalness; delete o.vivid;
      const tint = aged(color, o.emissive ? AGE_GLOW : vivid ? AGE_HOUSE : AGE);
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
  // animated props (smith, flags...) re-render + re-pixelate this often; each
  // pass is a WebGL draw, a read-back and a full pixel pass
  const ANIMATED_PROP_FRAME_MS = 125;
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

  // ---------- houses ----------
  // Six builds, each in several colour schemes. The map gives a house a roof colour
  // (variant 0-2); propVariant adds a build picked from where it stands, so the
  // street mixes them: variant = roof + 3 * build. Every build keeps its door on the
  // +Z face (the street side) and reports where its door and chimney top are, for
  // the footpaths, cats and chimney smoke in townLife.js (houseInfo below).
  const HOUSE_BUILDS = 6;
  const V = { vivid: true };
  const hmat = c => mat(c, V);
  const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getStyle();
  const HOUSE_ROOFS = ['#a8402f', '#3f5f8f', '#56703a'];
  const HOUSE_PLASTER = ['#f1e4c4', '#e8cf9a', '#d8e1e6', '#efcfc0', '#e2e7cc'];
  const TIMBER = '#4a2f1d', STONE = '#9a948a', STONE_DK = '#76716a', DOOR = '#5d3a1f', STRAW = '#c9a14a';

  // Gabled roof over a W x D block whose walls end at y0, ridge along X (alongZ: along Z),
  // laid in courses of alternating shade; returns the ridge height above y0
  function gableRoof(parent, cx, cz, W, D, y0, pitch, color, ov = 7, alongZ = false, thick = 2.6, courses = 5) {
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    if (alongZ) { g.rotation.y = Math.PI / 2; [W, D] = [D, W]; }
    parent.add(g);
    const half = D / 2 + ov, len = half / Math.cos(pitch), t = Math.tan(pitch);
    const yEave = y0 - ov * t, yRidge = y0 + (D / 2) * t;
    for (const side of [-1, 1]) {
      const slope = new THREE.Group();
      slope.position.set(0, (yEave + yRidge) / 2, side * half / 2);
      slope.rotation.x = side * pitch;
      g.add(slope);
      for (let r = 0; r < courses; r++) {
        box(slope, W + ov * 2, thick, len / courses + 1, hmat(r % 2 ? color : shade(color, 0.84)), 0, -thick, -side * (len / 2 - (r + 0.5) * len / courses));
      }
    }
    box(g, W + ov * 2 + 1, 3, 4, hmat(shade(color, 0.7)), 0, yRidge - 0.5, 0);   // ridge cap
    const gable = new THREE.Shape();
    gable.moveTo(-D / 2, 0); gable.lineTo(D / 2, 0); gable.lineTo(0, (D / 2) * t); gable.lineTo(-D / 2, 0);
    return { ridge: (D / 2) * t, gable, ends: [-W / 2, W / 2], group: g };
  }
  // plaster (or stone) gable triangles closing the ends of a gableRoof
  function gableEnds(roof, y0, color) {
    for (const gx of roof.ends) {
      const gm = new THREE.Mesh(new THREE.ShapeGeometry(roof.gable), hmat(color).clone());
      gm.material.side = THREE.DoubleSide;
      gm.rotation.y = Math.PI / 2;
      gm.position.set(gx, y0, 0);
      roof.group.add(gm);
    }
  }
  // four-sided (hipped) roof: a square pyramid stretched over W x D
  function hipRoof(parent, cx, cz, W, D, y0, h, color, ov = 7) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1), hmat(color));
    cone.rotation.y = Math.PI / 4;
    const g = new THREE.Group();
    g.add(cone);
    g.scale.set(W + ov * 2, h, D + ov * 2);
    g.position.set(cx, y0 + h / 2, cz);
    parent.add(g);
    box(parent, W + ov * 2, 2, D + ov * 2, hmat(shade(color, 0.75)), cx, y0 - 1, cz);   // eave band
  }
  // a window on the +Z face (facingX false) or +X face, glowing, with shutters, sill and flowers
  function houseWindow(root, x, y, z, facingX, o = {}) {
    const w = o.w || 12, h = o.h || 11;
    box(root, facingX ? 1 : w, h, facingX ? w : 1, glow('#ffcc70', 0.8), x, y, z);
    // mullion cross
    box(root, facingX ? 1.6 : 1.4, h, facingX ? 1.4 : 1.6, hmat(TIMBER), facingX ? x + 0.4 : x, y, facingX ? z : z + 0.4);
    box(root, facingX ? 1.6 : w, 1.4, facingX ? w : 1.6, hmat(TIMBER), facingX ? x + 0.4 : x, y + h / 2 - 0.7, facingX ? z : z + 0.4);
    if (o.shutter) for (const off of [-(w / 2 + 2.6), w / 2 + 2.6]) box(root, facingX ? 1.4 : 5, h + 1, facingX ? 5 : 1.4, hmat(o.shutter), facingX ? x + 0.6 : x + off, y - 0.5, facingX ? z + off : z + 0.6);
    if (o.arch) box(root, facingX ? 2 : w + 3, 3, facingX ? w + 3 : 2, hmat(o.arch), facingX ? x + 0.4 : x, y + h, facingX ? z : z + 0.4);
    box(root, facingX ? 3 : w + 2, 2.2, facingX ? w + 2 : 3, hmat('#6d4423'), facingX ? x + 1.2 : x, y - 2.2, facingX ? z : z + 1.2);
    if (o.flowers !== false) {
      const cols = o.flowers || ['#e05a5a', '#f2d64b', '#e88ad0'];
      for (let f = -1; f <= 1; f++) sphere(root, 1.9, hmat(cols[(f + 1) % cols.length]), facingX ? x + 2.4 : x + f * 4, y - 0.4, facingX ? z + f * 4 : z + 2.4, 6);
    }
  }
  // door on the +Z face at (x, z), its bottom at y; arched or square, with a lantern beside it
  function houseDoor(root, x, y, z, o = {}) {
    const w = o.w || 15, h = o.h || 24;
    box(root, w, h, 2, hmat(o.color || DOOR), x, y, z + 1);
    for (const px of [-w / 2 + 3.5, 0, w / 2 - 3.5]) box(root, 0.8, h - 3, 2.4, hmat(shade(o.color || DOOR, 0.7)), x + px, y + 1, z + 1);
    box(root, w + 3, 2.6, 2.8, hmat(o.frame || TIMBER), x, y + h, z + 1.2);
    if (o.arch) { const a = cyl(root, w / 2 + 1.5, w / 2 + 1.5, 2.8, hmat(o.frame || TIMBER), x, y + h - 1, z + 1.2, 12); a.rotation.x = Math.PI / 2; a.position.y = y + h; }
    sphere(root, 1, '#d4a017', x + w / 2 - 3, y + h * 0.48, z + 2.4, 6);
    box(root, w + 6, 3, 7, hmat(STONE), x, y - 3, z + 4);                         // step
    if (o.lantern !== false) {
      box(root, 1.2, 5, 4, hmat('#2b2b2b'), x + w / 2 + 5, y + h - 6, z + 2.6);
      box(root, 3, 4, 3, glow('#ffb347', 1.1), x + w / 2 + 5, y + h - 10, z + 4);
    }
  }
  function chimney(root, x, y, z, h, color = '#8a5a44') {
    box(root, 10, h, 10, hmat(color), x, y, z);
    box(root, 12, 2.6, 12, hmat('#5b5f66'), x, y + h, z);
    return [x, y + h + 2.6, z];
  }
  function barrel(root, x, z, s = 1) {
    cyl(root, 5 * s, 4.4 * s, 11 * s, hmat('#7b4a22'), x, 0, z, 10);
    for (const hy of [2.2, 8.2]) cyl(root, 5.2 * s, 5.2 * s, 1, hmat('#3a3a3a'), x, hy * s, z, 10);
  }
  function crate(root, x, z, s = 1, y = 0) {
    box(root, 10 * s, 10 * s, 10 * s, hmat('#a5713d'), x, y, z);
    box(root, 10.4 * s, 1.4 * s, 10.4 * s, hmat('#6b4423'), x, y + 4.3 * s, z);
  }
  function ivy(root, x, y, z, facingX, n = 9, seed = 1) {
    for (let i = 0; i < n; i++) {
      const a = hash(i, seed), b = hash(seed, i);
      sphere(root, 2.4 + a * 1.6, hmat(a < 0.5 ? '#3f6b2f' : '#4f7f36'), facingX ? x + 1.4 : x + (a - 0.5) * 12, y + b * 22, facingX ? z + (a - 0.5) * 12 : z + 1.4, 6);
    }
  }
  function sign(root, x, y, z, color, facingX) {
    box(root, facingX ? 12 : 1.4, 1.4, facingX ? 1.4 : 12, hmat('#2b2b2b'), facingX ? x + 6 : x, y, facingX ? z : z + 6);
    box(root, facingX ? 10 : 1.2, 8, facingX ? 1.2 : 10, hmat(color), facingX ? x + 8 : x, y - 9, facingX ? z : z + 8);
    box(root, facingX ? 4 : 1.6, 4, facingX ? 1.6 : 4, hmat('#d4a017'), facingX ? x + 8 : x, y - 7, facingX ? z : z + 8);
  }
  // timber frame on a wall block's two visible faces: corner posts, rails, braces
  function timberFrame(root, W, D, y0, H, cx = 0, cz = 0) {
    for (const zx of [-W / 2, W / 2]) box(root, 3, H, 3, hmat(TIMBER), cx + zx, y0, cz + D / 2);
    for (const zz of [-D / 2, D / 2]) box(root, 3, H, 3, hmat(TIMBER), cx + W / 2, y0, cz + zz);
    box(root, W, 2.6, 1.6, hmat(TIMBER), cx, y0 + H * 0.5, cz + D / 2 + 0.6);
    box(root, 1.6, 2.6, D, hmat(TIMBER), cx + W / 2 + 0.6, y0 + H * 0.5, cz);
    box(root, W, 3, 1.6, hmat(TIMBER), cx, y0 + H - 3, cz + D / 2 + 0.6);
    box(root, 1.6, 3, D, hmat(TIMBER), cx + W / 2 + 0.6, y0 + H - 3, cz);
    for (const bx of [-W / 2 + 12, W / 2 - 12]) {
      const br = box(root, 2.2, H * 0.55, 1.4, hmat(TIMBER), cx + bx, y0, cz + D / 2 + 0.9);
      br.position.y = y0 + H * 0.73;
      br.rotation.z = bx < 0 ? 0.7 : -0.7;
    }
  }

  const HOUSE_STYLES = [
    // 0 timber cottage: plaster and timber frame, a dormer and a bench by the door, ivy up the side
    (root, c) => {
      const W = 92, D = 72, H = 38, F = 7;
      box(root, W + 4, F, D + 4, hmat(STONE_DK), 0, 0, 0);
      box(root, W, H, D, hmat(c.plaster), 0, F, 0);
      timberFrame(root, W, D, F, H);
      houseDoor(root, -24, F, D / 2);
      houseWindow(root, 18, F + 12, D / 2 + 0.6, false, { shutter: c.roof });
      houseWindow(root, W / 2 + 0.6, F + 12, -16, true, { shutter: c.roof });
      houseWindow(root, W / 2 + 0.6, F + 12, 18, true, { shutter: c.roof });
      ivy(root, W / 2, F, D / 2 - 6, true, 10, 3);
      // bench
      box(root, 16, 1.6, 5, hmat('#7a5030'), 2, F + 5, D / 2 + 5);
      for (const bx of [-5, 9]) box(root, 1.6, 5, 4, hmat('#5a3a20'), bx, F, D / 2 + 5);
      const roof = gableRoof(root, 0, 0, W, D, F + H, 0.62, c.roof);
      gableEnds(roof, F + H, c.plaster);
      // dormer on the street-side slope
      const dz = D / 2 - 14, dy = F + H + 8;
      box(root, 16, 14, 14, hmat(c.plaster), 6, dy, dz);
      houseWindow(root, 6, dy + 3, dz + 7.4, false, { w: 8, h: 8, flowers: false });
      const dr = gableRoof(root, 6, dz, 14, 16, dy + 14, 0.7, c.roof, 3, true, 2, 3);
      gableEnds(dr, dy + 14, c.plaster);
      return { door: [-24, D / 2], chimney: chimney(root, -W / 2 + 18, F + H + 6, -D / 6, 30) };
    },
    // 1 jettied townhouse: stone shop floor, the timber upper floor overhanging it, gable end to the street
    (root, c) => {
      const W = 72, D = 82, H1 = 30, H2 = 30, F = 6, J = 5;
      box(root, W + 4, F, D + 4, hmat(STONE_DK), 0, 0, 0);
      box(root, W, H1, D, hmat(STONE), 0, F, 0);
      for (let y = F + 7; y < F + H1; y += 7) box(root, W + 0.8, 1, D + 0.8, hmat(STONE_DK), 0, y, 0);
      // upper floor juts out over the street side and the right side
      box(root, W + J, 3, D + J, hmat(TIMBER), J / 2, F + H1, J / 2);
      box(root, W + J, H2, D + J, hmat(c.plaster), J / 2, F + H1 + 3, J / 2);
      timberFrame(root, W + J, D + J, F + H1 + 3, H2, J / 2, J / 2);
      houseDoor(root, -14, F, D / 2, { arch: true, color: '#6b3b22', frame: STONE_DK });
      houseWindow(root, 16, F + 8, D / 2 + 0.6, false, { w: 16, h: 13, arch: STONE_DK, flowers: false });
      houseWindow(root, W / 2 + 0.6, F + 10, 10, true, { arch: STONE_DK, flowers: false });
      for (const wx of [-16, 16]) houseWindow(root, wx + J / 2, F + H1 + 14, D / 2 + J + 0.6, false, { shutter: c.roof });
      houseWindow(root, W / 2 + J + 0.6, F + H1 + 14, -12, true, { shutter: c.roof });
      houseWindow(root, W / 2 + J + 0.6, F + H1 + 14, 20, true, { shutter: c.roof });
      sign(root, W / 2 + J, F + H1 - 4, D / 2 - 10, c.roof, true);
      const top = F + H1 + 3 + H2;
      const roof = gableRoof(root, J / 2, J / 2, W + J, D + J, top, 0.82, c.roof, 6, true, 2.6, 6);
      gableEnds(roof, top, c.plaster);
      houseWindow(root, J / 2, top + 10, D / 2 + J + 0.6, false, { w: 9, h: 9, flowers: false });
      return { door: [-14, D / 2], chimney: chimney(root, -W / 2 + 12, top + 10, -D / 4, 34, '#7c4a3a') };
    },
    // 2 stone house with a round corner tower under a cone roof and a pennant
    (root, c) => {
      const W = 88, D = 70, H = 40, F = 5;
      box(root, W + 4, F, D + 4, hmat(STONE_DK), 0, 0, 0);
      box(root, W, H, D, hmat(c.stone), 0, F, 0);
      for (let y = F + 8; y < F + H; y += 8) box(root, W + 0.8, 1, D + 0.8, hmat(shade(c.stone, 0.8)), 0, y, 0);
      for (const [qx, qz] of [[W / 2, D / 2], [-W / 2, D / 2], [W / 2, -D / 2]]) box(root, 6, H, 6, hmat(shade(c.stone, 0.88)), qx, F, qz);
      houseDoor(root, -18, F, D / 2, { arch: true, color: '#4e2e1a', frame: STONE_DK, w: 16, h: 26 });
      houseWindow(root, 14, F + 14, D / 2 + 0.6, false, { arch: STONE_DK, shutter: c.roof });
      houseWindow(root, W / 2 + 0.6, F + 14, -10, true, { arch: STONE_DK, shutter: c.roof });
      hipRoof(root, 0, 0, W, D, F + H, 34, c.roof, 6);
      // the tower at the front-right corner, taller than the house
      const tx = W / 2 - 4, tz = D / 2 - 4, tr = 17, th = F + H + 26;
      cyl(root, tr, tr + 1, th, hmat(shade(c.stone, 1.05)), tx, 0, tz, 14);
      for (let y = 14; y < th; y += 14) cyl(root, tr + 0.6, tr + 0.6, 1.2, hmat(shade(c.stone, 0.8)), tx, y, tz, 14);
      for (const a of [Math.PI * 0.25, Math.PI * 0.6]) {
        const wx = tx + Math.cos(a) * (tr + 0.4), wz = tz + Math.sin(a) * (tr + 0.4);
        box(root, 3, 10, 3, glow('#ffcc70', 0.8), wx, th - 16, wz);
        box(root, 3, 8, 3, glow('#ffcc70', 0.7), tx + Math.cos(a - 0.4) * (tr + 0.4), F + 18, tz + Math.sin(a - 0.4) * (tr + 0.4));
      }
      cyl(root, tr + 3, tr + 3, 3, hmat(shade(c.stone, 0.75)), tx, th, tz, 14);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(tr + 5, 38, 14), hmat(c.roof));
      cone.position.set(tx, th + 3 + 19, tz);
      root.add(cone);
      cyl(root, 0.8, 0.8, 14, hmat('#3e2723'), tx, th + 40, tz, 6);
      const flag = box(root, 1, 6, 11, hmat(c.flag), tx, th + 47, tz + 6);
      flag.rotation.x = 0.1;
      return { door: [-18, D / 2], chimney: chimney(root, -W / 2 + 16, F + H + 10, -D / 5, 30, '#6f6a62') };
    },
    // 3 thatched cottage: low whitewashed walls, a deep straw roof, round window, picket fence, woodpile
    (root, c) => {
      const W = 84, D = 64, H = 26, F = 4;
      box(root, W + 4, F, D + 4, hmat(STONE_DK), 0, 0, 0);
      box(root, W, H, D, hmat('#f2ede0'), 0, F, 0);
      box(root, W + 0.6, 5, D + 0.6, hmat('#b9b2a2'), 0, F, 0);   // splash band
      houseDoor(root, -22, F, D / 2, { color: '#3f6b8f', h: 21, lantern: false });
      houseWindow(root, 14, F + 9, D / 2 + 0.6, false, { shutter: '#3f6b8f' });
      houseWindow(root, W / 2 + 0.6, F + 9, 0, true, { shutter: '#3f6b8f' });
      // thatch: a thick, rounded straw roof that sweeps low
      const ov = 6, pitch = 0.78;
      const roof = gableRoof(root, 0, 0, W, D, F + H, pitch, STRAW, ov, false, 7, 4);
      gableEnds(roof, F + H, '#f2ede0');
      // straw rolled thick along the ridge and both eaves, so the roof reads soft and heavy
      const roll = (y, z, r, col) => {
        const m = cyl(root, r, r, W + ov * 2 + 2, hmat(col), 0, 0, 0, 10);
        m.rotation.z = Math.PI / 2;
        m.position.set(0, y, z);
      };
      roll(F + H + roof.ridge + 1, 0, 5, '#a8843a');
      for (const side of [-1, 1]) roll(F + H - ov * Math.tan(pitch) - 2, side * (D / 2 + ov), 4.2, '#b8913f');
      // round attic window in the visible gable
      const rw = cyl(root, 5, 5, 1.6, glow('#ffcc70', 0.7), W / 2 + 0.8, F + H + 9, 0, 12);
      rw.rotation.z = Math.PI / 2;
      // picket fence along the front garden, a gap at the door
      for (let fx = -W / 2 - 4; fx <= W / 2 + 4; fx += 5) {
        if (Math.abs(fx + 22) < 9) continue;
        box(root, 1.8, 9, 1.8, hmat('#e9e2d0'), fx, 0, D / 2 + 16);
      }
      box(root, W + 8, 1.4, 1.2, hmat('#d8d0bb'), 0, 5, D / 2 + 16);
      for (let i = 0; i < 6; i++) sphere(root, 2.2, hmat(['#e05a5a', '#f2d64b', '#e88ad0', '#7fb6e8'][i % 4]), 4 + i * 7, 2, D / 2 + 9, 6);
      // woodpile against the right wall
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) {
        const lg = cyl(root, 2.2, 2.2, 18, hmat(k % 2 ? '#8a5a34' : '#a06c3e'), W / 2 + 4, 0, -14 + k * 4.6 + r * 2.3, 8);
        lg.rotation.z = Math.PI / 2; lg.position.y = 2.2 + r * 4;
      }
      return { door: [-22, D / 2], chimney: chimney(root, -W / 2 + 14, F + H + 14, -D / 6, 22, '#9a6a4a') };
    },
    // 4 merchant's house: two painted storeys, a striped awning over the shop window, crates and barrels
    (root, c) => {
      const W = 90, D = 68, H = 54, F = 6;
      box(root, W + 4, F, D + 4, hmat(STONE_DK), 0, 0, 0);
      box(root, W, H, D, hmat(c.paint), 0, F, 0);
      for (const [qx, qz] of [[W / 2, D / 2], [-W / 2, D / 2], [W / 2, -D / 2]]) box(root, 4, H, 4, hmat('#efe6d2'), qx, F, qz);
      box(root, W + 1, 2.4, D + 1, hmat('#efe6d2'), 0, F + H / 2, 0);   // floor band
      houseDoor(root, -26, F, D / 2, { color: '#2f5d4a' });
      houseWindow(root, 10, F + 7, D / 2 + 0.6, false, { w: 26, h: 15, flowers: false });
      // awning: striped slats sloping out over the shop window
      for (let k = 0; k < 8; k++) {
        const s = box(root, 4, 1.2, 14, hmat(k % 2 ? '#f3ead8' : c.awning), -4 + k * 4, 0, D / 2 + 7);
        s.rotation.x = 0.45; s.position.y = F + 26;
      }
      for (let k = 0; k < 8; k++) box(root, 4, 3, 1, hmat(k % 2 ? '#f3ead8' : c.awning), -4 + k * 4, F + 20.5, D / 2 + 13);
      for (const wx of [-24, 2, 26]) houseWindow(root, wx, F + H / 2 + 8, D / 2 + 0.6, false, { shutter: c.awning, w: 10 });
      houseWindow(root, W / 2 + 0.6, F + 10, -8, true, { flowers: false });
      houseWindow(root, W / 2 + 0.6, F + H / 2 + 8, -14, true, { shutter: c.awning, w: 10 });
      houseWindow(root, W / 2 + 0.6, F + H / 2 + 8, 14, true, { shutter: c.awning, w: 10 });
      // balcony on the right side
      box(root, 6, 2, 34, hmat(TIMBER), W / 2 + 3, F + H / 2 + 2, 0);
      for (let bz = -16; bz <= 16; bz += 4) box(root, 1.2, 8, 1.2, hmat(TIMBER), W / 2 + 5.5, F + H / 2 + 4, bz);
      box(root, 1.6, 1.6, 34, hmat(TIMBER), W / 2 + 5.5, F + H / 2 + 11.5, 0);
      crate(root, 30, D / 2 + 9); crate(root, 30, D / 2 + 9, 0.8, 10); barrel(root, 42, D / 2 + 8);
      barrel(root, W / 2 + 8, D / 2 - 6, 0.9);
      sign(root, -10, F + H / 2 + 2, D / 2, c.awning, false);
      const roof = gableRoof(root, 0, 0, W, D, F + H, 0.5, c.roof, 6);
      gableEnds(roof, F + H, c.paint);
      return { door: [-26, D / 2], chimney: chimney(root, W / 2 - 18, F + H + 6, -D / 5, 24, '#8a5a44') };
    },
    // 5 manor: an L of a main hall and a wing, a pillared porch, two chimneys and a banner
    (root, c) => {
      const W = 96, D = 56, H = 42, F = 7, WW = 40, WD = 34;
      // main hall along X at the back, wing coming forward on the right
      box(root, W + 4, F, D + 4, hmat(STONE_DK), 0, 0, -12);
      box(root, W, H, D, hmat(c.plaster), 0, F, -12);
      timberFrame(root, W, D, F, H, 0, -12);
      box(root, WW + 4, F, WD + 4, hmat(STONE_DK), W / 2 - WW / 2, 0, D / 2 - 12 + WD / 2);
      box(root, WW, H - 6, WD, hmat(c.plaster), W / 2 - WW / 2, F, D / 2 - 12 + WD / 2);
      timberFrame(root, WW, WD, F, H - 6, W / 2 - WW / 2, D / 2 - 12 + WD / 2);
      const fz = D / 2 - 12;   // the hall's street face
      houseDoor(root, -20, F, fz, { arch: true, w: 17, h: 27 });
      // porch: slab roof on four pillars, steps
      box(root, 30, 3, 18, hmat(shade(c.roof, 0.9)), -20, F + 31, fz + 9);
      for (const [px, pz] of [[-33, fz + 16], [-7, fz + 16]]) {
        cyl(root, 1.8, 2, 31, hmat('#ece4d2'), px, F, pz, 8);
      }
      box(root, 30, 3, 8, hmat(STONE), -20, 0, fz + 13);
      for (const wx of [-42, 2]) houseWindow(root, wx, F + 14, fz + 0.6, false, { shutter: c.roof });
      houseWindow(root, W / 2 - WW / 2, F + 14, fz + WD + 0.6, false, { shutter: c.roof });
      houseWindow(root, W / 2 + 0.6, F + 14, fz + WD / 2, true, { shutter: c.roof });
      houseWindow(root, W / 2 + 0.6, F + 14, -30, true, { shutter: c.roof });
      // banner on the wing's front
      box(root, 12, 26, 1, hmat('#9b1c1c'), W / 2 - WW / 2, F + 4, fz + WD + 1.2);
      const em = box(root, 5, 5, 1.6, hmat('#f6c343'), W / 2 - WW / 2, F + 14, fz + WD + 1.4);
      em.rotation.z = Math.PI / 4;
      const r1 = gableRoof(root, 0, -12, W, D, F + H, 0.6, c.roof, 7);
      gableEnds(r1, F + H, c.plaster);
      const r2 = gableRoof(root, W / 2 - WW / 2, D / 2 - 12 + WD / 2, WD + 8, WW, F + H - 6, 0.7, c.roof, 5, true);
      gableEnds(r2, F + H - 6, c.plaster);
      chimney(root, W / 2 - 10, F + H + 10, -26, 30);
      return { door: [-20, fz], chimney: chimney(root, -W / 2 + 14, F + H + 6, -26, 32) };
    }
  ];

  // variant = roof (0-2) + 3 * build; colour scheme from the roof and the build together
  function buildHouse(variant) {
    const root = new THREE.Group();
    const roofI = variant % 3, build = Math.floor(variant / 3) % HOUSE_BUILDS;
    const c = {
      roof: HOUSE_ROOFS[roofI],
      plaster: HOUSE_PLASTER[(roofI * 2 + build) % HOUSE_PLASTER.length],
      paint: ['#d98c5f', '#7fa7b8', '#c9b25a', '#b97a9a', '#8fae7a'][(roofI + build) % 5],
      awning: ['#c0392b', '#2e6fb5', '#2f9e57', '#8e44ad'][(roofI + build) % 4],
      stone: ['#a39d92', '#9aa0a6', '#b0a08a'][(roofI + build) % 3],
      flag: ['#c53030', '#2b6cb0', '#d69e2e'][roofI]
    };
    const info = HOUSE_STYLES[build](root, c);
    return { root, info };
  }
  BUILDERS.house = (variant = 0) => buildHouse(variant);

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

  BUILDERS.personal_chest = () => {
    const root = new THREE.Group();
    box(root, 22, 14, 16, '#78350f', 0, 0, 0);
    box(root, 23, 5, 17, '#92400e', 0, 14, 0);
    box(root, 2.2, 19.5, 17.2, '#facc15', -7, 0, 0);
    box(root, 2.2, 19.5, 17.2, '#facc15', 7, 0, 0);
    box(root, 4, 5, 1.2, '#facc15', 0, 11, 8.4);
    box(root, 1.6, 2, 0.4, '#1e293b', 0, 11, 9.1);
    return { root };
  };

  // Market stalls south of the east-west boulevard (y 18-22) turn to face it
  const BOULEVARD_MID_Y = 20.5;
  // A house's build is picked from where it stands (the map only gives its roof colour);
  // the salts are tuned so the town's 30 houses get every build 4-7 times, neighbours mostly differing
  const houseBuild = obs => Math.floor(hash(Math.round(obs.x * 7) + 30.14, Math.round(obs.y * 13) + 64.02) * HOUSE_BUILDS);
  const propVariant = obs => (obs.type === 'market_stall' && obs.y > BOULEVARD_MID_Y ? (obs.variant || 0) + 4
    : obs.type === 'house' ? ((obs.variant || 0) % 3) + 3 * houseBuild(obs) : obs.variant);
  // where a house's door and chimney top are, in model units from its anchor:
  // door [x, z] on the +Z face, chimney [x, y, z]
  const houseInfoCache = new Map();
  const houseInfo = obs => {
    const v = propVariant(obs);
    if (!houseInfoCache.has(v)) houseInfoCache.set(v, buildHouse(v).info);
    return houseInfoCache.get(v);
  };

  // The raw prop models (game axes, TILE units, anchored at the obstacle), for
  // the first-person view (firstPerson.js), which places them in its own scene
  window.TownPropModels = {
    TILE,
    has: type => !!BUILDERS[type],
    build: obs => (BUILDERS[obs.type] ? BUILDERS[obs.type](propVariant(obs) || 0) : null),
    // for the 2D sprites baked from these models (pixelProps.js)
    variant: obs => propVariant(obs) || 0,
    buildVariant: (type, v) => (BUILDERS[type] ? BUILDERS[type](v || 0) : null),
    houseInfo
  };

  // ---------- offscreen renderer ----------
  class TownProps3D {
    constructor() {
      this.instances = new Map(); // key -> { tilt, prop, frame }
      this.cache = new Map();     // key|zoom -> canvas
      this.cacheZoom = null;
      // set by the renderer: false while the camera zoom is still changing, when
      // cached images are scaled instead of re-rendered through WebGL
      this.zoomSettled = true;
      // the town draws in 2D pixel sprites unless 3D props are switched on in the settings;
      // until then no WebGL context is made at all
      this.enabled = false;
      this.renderer = null;
    }

    ensureGL() {
      if (this.renderer) return true;
      try {
        this.initGL();
        return true;
      } catch (err) {
        console.warn('3D town props unavailable, staying with 2D props:', err);
        this.enabled = false;
        return false;
      }
    }

    initGL() {
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
      if (!this.enabled || !this.ensureGL()) return null;
      const inst = this.getInstance(obs.type, propVariant(obs), layer);
      if (!inst) return null;
      // a layer with nothing in it (e.g. the back of a stall whose counter faces us)
      if (inst.empty) return { top: screenY, events: null, sparkOffset: inst.prop.sparkOffset };
      const f = inst.frame;
      const dx = screenX + f.minX * zoom;
      const dy = screenY - f.maxY * zoom;
      let events = null;

      if (inst.animated) {
        // Pose every frame (cheap) but re-render through WebGL at ~8 fps: each
        // render + copy out of the GL canvas stalls the GPU pipeline
        events = inst.prop.animate(time) || null;
        const now = performance.now();
        const zoomKey = zoom.toFixed(3);
        // mid-zoom: keep the last frame (scaled below) until the zoom settles
        const rezoom = inst.frameZoom !== zoomKey && this.zoomSettled;
        if (!inst.frameImg || rezoom || (now - inst.frameAt > ANIMATED_PROP_FRAME_MS && inst.frameZoom === zoomKey)) {
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
