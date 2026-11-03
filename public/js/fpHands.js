// First-person hands: the hero's own arms and weapon at the bottom of the
// first-person view (firstPerson.js), drawn as chunky pixel art into a small
// buffer and scaled up with nearest-neighbour so it matches the sprites.
//
//   warrior: sword in the right gauntlet, shield rim at the left
//   rogue:   a dagger in each gloved hand, alternating stabs
//   mage:    staff with a glowing orb in the right hand, spell hand on the left
//
// SP card transforms re-skin the hands from the card palette, and warrior
// cards hold their own weapon (mace, warhammer, axe, lance, coloured blades).
//
// Animations: idle breathing, walk bob, attack (swing / stab / staff thrust),
// cast (skill used), a jolt when hit, and a slide in / out with the camera move.
(function() {
  'use strict';

  const BW = 240, BH = 135;   // buffer size (pixels before upscaling)
  const CAST_MS = 420;
  const HURT_MS = 220;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  // 0 -> 1 -> 0 hump over q in [a, b]
  const hump = (q, a, b) => (q <= a || q >= b ? 0 : Math.sin(((q - a) / (b - a)) * Math.PI));

  // colour ramps: [outline, dark, mid, light, shine]
  const BASE = {
    steel: ['#121324', '#434a6b', '#7c87a6', '#bac4d6', '#fff8e6'],
    plate: ['#141824', '#3a4258', '#5d6788', '#8f9bbd', '#d5dcef'],
    gold: ['#2a2005', '#9f6a10', '#dca528', '#f5d16e', '#fff3c4'],
    red: ['#1c0a12', '#6b1d2c', '#a8301f', '#dc5626', '#f2864a'],
    leather: ['#1a0e0c', '#4f2b1f', '#7a4a2a', '#a8743f', '#cf9f5e'],
    glove: ['#0b0c16', '#2a2f45', '#434c66', '#68758f', '#93a0b8'],
    skin: ['#3a1d12', '#b86f4c', '#e5a47a', '#f6c9a2', '#ffe3c8'],
    robe: ['#140828', '#33186a', '#5a2a9e', '#8550d0', '#b388ee'],
    trim: ['#2e1d03', '#9a6b12', '#d9a62a', '#fbe08a', '#fff3c4'],
    wood: ['#1d1107', '#472a12', '#6b421f', '#936238', '#b78452'],
    orb: ['#04394a', '#0aa0c4', '#43e0f4', '#c9fbff', '#ffffff'],
    venom: ['#05290f', '#15a046', '#49dd7e', '#d6ffe3', '#ffffff'],
    blade: ['#121324', '#434a6b', '#7c87a6', '#bac4d6', '#fff8e6']
  };
  // the ramps in use this frame (BASE, or BASE re-skinned by an SP card)
  let C = BASE;

  // ---- SP card looks
  // weapon each warrior card holds (matches its pixelHeroes costume)
  const SP_WEAPON = {
    sp_crusader: 'mace', sp_sentinel: 'mace', sp_storm_herald: 'hammer', sp_gravelord: 'hammer', sp_titan: 'hammer',
    sp_dread_lord: 'axe', sp_warchief: 'axe', sp_dragoon: 'lance', sp_bannerman: 'lance',
    sp_berserker: 'sword', sp_frost_templar: 'sword', sp_reaver: 'sword', sp_runeknight: 'sword', sp_duskblade: 'sword', sp_phoenix_oath: 'sword'
  };
  const SP_FLAME = new Set(['sp_reaver', 'sp_phoenix_oath', 'sp_berserker']);

  function hexToRgb(h) {
    const n = parseInt(String(h).replace('#', '').padEnd(6, '0').slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbHex(r, g, b) {
    const c = v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
  }
  // a 5-step ramp around one colour: outline, dark, base, light, white-hot
  function rampOf(hex) {
    const [r, g, b] = hexToRgb(hex);
    const mix = (k, t) => rgbHex(r + (t - r) * k, g + (t - g) * k, b + (t - b) * k);
    return [mix(0.82, 8), mix(0.45, 10), hex, mix(0.4, 255), mix(0.82, 255)];
  }
  // card palettes have 4 or 5 steps; ours want 5
  const five = a => (a && a.length >= 4 ? (a.length >= 5 ? a.slice(0, 5) : [...a, a[a.length - 1]]) : null);

  const lookCache = new Map();
  function looksFor(card) {
    if (!card) return BASE;
    if (lookCache.has(card.id)) return lookCache.get(card.id);
    const p = card.palette || {};
    const col = card.color || '#e2e8f0';
    const L = Object.assign({}, BASE);
    if (five(p.steel)) { L.steel = five(p.steel); L.plate = five(p.darkSteel) || five(p.steel); }
    else if (five(p.darkSteel)) L.plate = five(p.darkSteel);
    if (five(p.tabard)) L.red = five(p.tabard);
    else if (five(p.cape)) L.red = five(p.cape);
    L.gold = five(p.goldTrim) || five(p.gold) || rampOf(col);
    if (five(p.robe)) L.robe = five(p.robe);
    if (five(p.robeTrim)) L.trim = five(p.robeTrim);
    L.orb = five(p.orb) || rampOf(col);
    if (five(p.rogue)) L.glove = five(p.rogue);
    if (five(p.strap)) L.leather = five(p.strap);
    L.venom = five(p.venom) || rampOf(col);
    L.blade = card.id === 'sp_berserker' ? rampOf('#ef4444') : card.id === 'sp_frost_templar' ? rampOf('#67e8f9')
      : (card.element && card.element !== 'neutral' ? rampOf(col) : L.steel);
    L.weapon = SP_WEAPON[card.id] || null;
    L.flame = SP_FLAME.has(card.id);
    L.glowCol = col;
    lookCache.set(card.id, L);
    return L;
  }

  class FpHands {
    constructor() {
      this.buf = document.createElement('canvas');
      this.buf.width = BW;
      this.buf.height = BH;
      this.g = this.buf.getContext('2d', { willReadFrequently: true });
      this.attackAt = -1e9;
      this.attackMs = 420;
      this.attackSide = 1;      // rogue: which hand stabs
      this.castAt = -1e9;
      this.hurtAt = -1e9;
      this.lastHp = null;
      this.walk = 0;            // walk cycle phase
      this.walkAmt = 0;         // 0..1 eased "is walking"
    }

    attack(attackSpeed) {
      const now = performance.now();
      this.attackMs = clamp(Math.round(520 / Math.max(0.4, attackSpeed || 1)), 220, 520);
      // a new swing during the previous one switches hands (rogue) and restarts
      this.attackSide = -this.attackSide;
      this.attackAt = now;
    }
    cast() { this.castAt = performance.now(); }

    // ---- low-res drawing helpers (crisp: alpha is thresholded afterwards)
    poly(pts, ramp, shade) {
      const g = this.g;
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath();
      g.fillStyle = ramp[shade == null ? 2 : shade];
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = ramp[0];
      g.stroke();
    }
    rect(x, y, w, h, ramp, shade) { this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], ramp, shade); }
    line(x1, y1, x2, y2, col, w) {
      const g = this.g;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
      g.lineWidth = w || 1; g.strokeStyle = col; g.stroke();
    }
    disc(x, y, r, ramp, shade) {
      const g = this.g;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = ramp[shade == null ? 2 : shade]; g.fill();
      g.lineWidth = 1.2; g.strokeStyle = ramp[0]; g.stroke();
    }
    // push a transform: pivot (x, y), rotation a, optional mirror
    at(x, y, a, mirror, fn) {
      const g = this.g;
      g.save();
      g.translate(x, y);
      if (mirror) g.scale(-1, 1);
      g.rotate(a);
      fn();
      g.restore();
    }

    // ---- shared limbs (local coords: pivot at the elbow below the screen, arm points up -y)
    gauntletArm() {
      this.poly([[-10, 0], [10, 0], [8, -36], [-8, -36]], C.plate, 2);
      this.poly([[-10, 0], [-3, 0], [-3, -36], [-8, -36]], C.plate, 1);
      this.rect(-9, -24, 18, 4, C.gold, 2);                  // cuff band
      this.poly([[-11, -36], [11, -36], [10, -52], [-10, -52]], C.steel, 2); // fist
      this.line(-8, -47, 8, -47, C.steel[1]);
      this.line(-8, -42, 8, -42, C.steel[1]);
      this.line(-9, -50, 9, -50, C.steel[3]);
    }
    gloveArm() {
      this.poly([[-8, 0], [8, 0], [7, -34], [-7, -34]], C.leather, 2);
      this.poly([[-8, 0], [-2, 0], [-2, -34], [-7, -34]], C.leather, 1);
      this.rect(-8, -22, 16, 3, C.leather, 0);                  // strap
      this.poly([[-9, -34], [9, -34], [8, -47], [-8, -47]], C.glove, 2);
      this.line(-7, -43, 7, -43, C.glove[1]);
      this.line(-7, -39, 7, -39, C.glove[1]);
    }
    sleeveArm(handOpen) {
      this.poly([[-13, 4], [13, 4], [9, -30], [-9, -30]], C.robe, 2);
      this.poly([[-13, 4], [-4, 4], [-4, -30], [-9, -30]], C.robe, 1);
      this.poly([[-10, -27], [10, -27], [9, -33], [-9, -33]], C.trim, 2);   // cuff trim
      if (handOpen) {
        // open palm toward the view, fingers up
        this.poly([[-8, -32], [8, -32], [9, -46], [-8, -46]], C.skin, 2);
        for (let i = 0; i < 4; i++) this.rect(-8 + i * 4.3, -56 + (i === 0 || i === 3 ? 3 : 0), 3.4, 11, C.skin, i % 2 ? 2 : 3);
        this.poly([[8, -38], [14, -44], [12, -47], [7, -43]], C.skin, 2);   // thumb
      } else {
        this.poly([[-9, -32], [9, -32], [8, -46], [-8, -46]], C.skin, 2);  // fist
        this.line(-7, -42, 7, -42, C.skin[1]);
        this.line(-7, -38, 7, -38, C.skin[1]);
      }
    }

    // ---- weapons (drawn in the hand's frame); each returns its tip's y
    sword() {
      const B = C.blade;
      this.poly([[-4, -56], [4, -56], [4, -118], [0, -128], [-4, -118]], B, 3);
      this.poly([[-4, -56], [0, -56], [0, -126], [-4, -118]], B, 2);
      this.line(0, -60, 0, -114, B[1]);                             // fuller
      this.line(3, -60, 3, -116, B[4]);                             // edge glint
      this.rect(-17, -57, 34, 5, C.gold, 2);                        // crossguard
      this.disc(-17, -54.5, 3, C.gold, 3);
      this.disc(17, -54.5, 3, C.gold, 3);
      this.disc(0, -32, 3.5, C.gold, 3);                            // pommel
      return -124;
    }
    // haft from below the fist up to `top`
    haft(top) {
      this.poly([[-2.5, -28], [2.5, -28], [2.5, top], [-2.5, top]], C.wood, 2);
      this.line(-1.5, -30, -1.5, top + 2, C.wood[3]);
    }
    mace() {
      this.haft(-92);
      this.rect(-5, -96, 10, 6, C.gold, 2);
      this.disc(0, -106, 11, C.steel, 3);
      this.disc(-3, -109, 4.5, C.steel, 4);
      for (const [x, y] of [[0, -121], [-13, -106], [13, -106], [-9, -117], [9, -117]]) this.disc(x, y, 2.6, C.gold, 3);
      return -112;
    }
    hammer() {
      this.haft(-96);
      this.rect(-22, -114, 44, 20, C.steel, 2);
      this.rect(-22, -114, 44, 6, C.steel, 3);
      this.rect(-6, -116, 12, 24, C.gold, 2);                       // banded core
      this.line(-20, -98, 20, -98, C.steel[1]);
      return -104;
    }
    axe() {
      this.haft(-112);
      this.poly([[2, -88], [24, -96], [32, -110], [26, -124], [10, -116], [2, -112]], C.blade, 3);
      this.poly([[2, -88], [24, -96], [22, -100], [2, -96]], C.blade, 2);
      this.line(30, -110, 25, -122, C.blade[4]);
      this.poly([[-2, -92], [-12, -98], [-12, -106], [-2, -108]], C.steel, 2); // back spike
      this.disc(0, -114, 3, C.gold, 3);
      return -110;
    }
    lance() {
      this.haft(-70);
      this.poly([[-9, -66], [9, -66], [5, -78], [-5, -78]], C.gold, 2);   // vamplate
      this.poly([[-5, -78], [5, -78], [0, -134]], C.blade, 3);
      this.poly([[-5, -78], [0, -78], [0, -132]], C.blade, 2);
      this.poly([[2, -82], [20, -88], [12, -92], [22, -98], [2, -96]], C.red, 3);   // pennant
      return -128;
    }
    dagger(ramp) {
      this.poly([[-3, -48], [3, -48], [3, -78], [0, -86], [-3, -78]], ramp || C.steel, 3);
      this.line(0, -50, 0, -80, (ramp || C.steel)[1]);
      this.rect(-9, -50, 18, 4, C.leather, 3);
      this.disc(0, -33, 2.6, C.steel, 2);
    }
    shield(x, y) {
      const g = this.g;
      g.save();
      g.translate(x, y);
      g.beginPath(); g.ellipse(0, 0, 54, 62, -0.15, 0, Math.PI * 2);
      g.fillStyle = C.gold[1]; g.fill();
      g.lineWidth = 1.2; g.strokeStyle = C.gold[0]; g.stroke();
      g.beginPath(); g.ellipse(0, 0, 47, 55, -0.15, 0, Math.PI * 2);
      g.fillStyle = C.red[2]; g.fill();
      g.beginPath(); g.ellipse(-8, -6, 30, 36, -0.15, 0, Math.PI * 2);
      g.fillStyle = C.red[3]; g.fill();
      g.fillStyle = C.gold[2];
      g.fillRect(-4, -50, 8, 100);                                  // emblem stripe
      g.restore();
      this.disc(x + 2, y - 4, 8, C.steel, 3);                       // boss
    }
    staff() {
      this.poly([[-3, 20], [3, 20], [3, -112], [-3, -112]], C.wood, 2);
      this.poly([[-3, 20], [-1, 20], [-1, -112], [-3, -112]], C.wood, 1);
      // head: gold claws holding the orb (its soft glow is added after the alpha pass)
      this.poly([[-9, -110], [9, -110], [6, -118], [-6, -118]], C.trim, 2);
      this.poly([[-9, -112], [-12, -130], [-6, -122]], C.trim, 3);
      this.poly([[9, -112], [12, -130], [6, -122]], C.trim, 3);
      this.disc(0, -126, 7.5, C.orb, 2);
      this.disc(-2, -128, 3.5, C.orb, 3);
      this.g.fillStyle = C.orb[4];
      this.g.fillRect(-3, -130, 2, 2);
    }

    // ---- main
    draw(hud, w, h, ctx) {
      const { cls, e, moving, dead, hp, time, card } = ctx;
      if (dead || e < 0.8) return;
      // SP transformed: the card's armour colours and weapon
      C = looksFor(card);
      const glowRgb = hexToRgb(card ? C.glowCol : '#dcebff');
      const glow = a => `rgba(${glowRgb[0]}, ${glowRgb[1]}, ${glowRgb[2]}, ${a})`;
      const now = performance.now();
      if (this.lastHp != null && hp < this.lastHp) this.hurtAt = now;
      this.lastHp = hp;

      // walk cycle eases in and out so the hands don't snap
      const dt = Math.min(0.1, (now - (this.lastNow || now)) / 1000);
      this.lastNow = now;
      this.walkAmt += ((moving ? 1 : 0) - this.walkAmt) * Math.min(1, dt * 8);
      this.walk += dt * 9.5 * (0.3 + 0.7 * this.walkAmt);

      const bobX = Math.sin(this.walk) * 5 * this.walkAmt;
      const bobY = Math.abs(Math.cos(this.walk)) * 5 * this.walkAmt + Math.sin(time * 1.8) * 1.5;
      const slide = (1 - easeOut(clamp((e - 0.8) / 0.2, 0, 1))) * 90;
      const hurt = now - this.hurtAt < HURT_MS ? (1 - (now - this.hurtAt) / HURT_MS) : 0;
      const shakeX = hurt ? Math.sin(now / 18) * 4 * hurt : 0;
      const ox = bobX + shakeX, oy = bobY + slide + hurt * 6;

      const qa = clamp((now - this.attackAt) / this.attackMs, 0, 1);
      const attacking = now - this.attackAt < this.attackMs;
      const qc = clamp((now - this.castAt) / CAST_MS, 0, 1);
      const casting = now - this.castAt < CAST_MS;

      const g = this.g;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, BW, BH);
      g.imageSmoothingEnabled = false;
      let smear = null;
      this.palm = null;
      this.flameAt = null;

      if (cls === 'mage') {
        // staff hand: thrust the orb toward the crosshair on attack
        const th = attacking ? hump(qa, 0, 1) : 0;
        const sx = 192 + ox - th * 34, sy = 150 + oy - th * 22;
        this.at(sx, sy, -0.22 - th * 0.25, false, () => { this.staff(); this.sleeveArm(false); });
        // spell hand: palm pushes forward on cast, small arcane flicker otherwise
        const ch = casting ? hump(qc, 0, 1) : 0;
        const lx = 50 + ox * 0.8 + ch * 50, ly = 150 + oy * 0.8 - ch * 30;
        this.at(lx, ly, 0.28 - ch * 0.2, false, () => this.sleeveArm(true));
        this.palm = { x: lx + Math.sin(0.28 - ch * 0.2) * 50, y: ly - Math.cos(0.28 - ch * 0.2) * 50, power: ch };
      } else if (cls === 'rogue') {
        // the stabbing hand drives forward and in, the other pulls back a touch
        for (const side of [-1, 1]) {
          const stab = attacking && side === this.attackSide ? hump(qa, 0, 1) : 0;
          const back = attacking && side !== this.attackSide ? hump(qa, 0, 1) * 0.25 : 0;
          const cast = casting ? hump(qc, 0, 1) : 0;
          const bx = side > 0 ? 188 : 52;
          const x = bx + ox * (side > 0 ? 1 : 0.8) - side * stab * 52 - side * cast * 18;
          const y = 152 + oy + back * 10 - stab * 40 - cast * 14;
          const a = side * (-0.2 - stab * 0.55);
          // SP blades always carry the card's colour; plain daggers flash venom on a skill
          this.at(x, y, a, false, () => { this.dagger(card || cast > 0.1 ? C.venom : C.steel); this.gloveArm(); });
          if (stab > 0.55) smear = { x: x - side * 20, y: y - 70, r: 18, a0: side > 0 ? -2.2 : -0.9, a1: side > 0 ? -1.2 : 0.1 };
        }
      } else {
        // warrior: wind up to the right, cut across down-left, recover
        let a = -0.38, dx = 0, dy = 0;
        if (attacking) {
          // the arm rises as it cuts so the blade stays on screen across the swing
          if (qa < 0.22) { const k = easeOut(qa / 0.22); a = -0.38 + 0.8 * k; dx = 12 * k; dy = -10 * k; }
          else if (qa < 0.55) { const k = easeOut((qa - 0.22) / 0.33); a = 0.42 - 1.6 * k; dx = 12 - 72 * k; dy = -10 - 22 * k; }
          else { const k = easeOut((qa - 0.55) / 0.45); a = -1.18 + 0.8 * k; dx = -60 + 60 * k; dy = -32 + 32 * k; }
          if (qa > 0.22 && qa < 0.6) {
            const k = (qa - 0.22) / 0.38;
            smear = { x: 140 + ox, y: 150 + oy, r: 110, a0: -1.25 - k * 1.1, a1: -0.55 - k * 0.6 };
          }
        }
        // shield raises a little on cast and when hit (no shield with two-handed card weapons)
        const lift = (casting ? hump(qc, 0, 1) : 0) * 18 + hurt * 10;
        if (!C.weapon || C.weapon === 'sword' || C.weapon === 'mace') this.shield(14 + ox * 0.6, 150 + oy * 0.6 - lift);
        const px = 190 + ox + dx, py = 156 + oy + dy;
        let tip = -124;
        this.at(px, py, a, false, () => {
          const wpn = C.weapon && this[C.weapon] ? C.weapon : 'sword';
          tip = this[wpn]();
          this.gauntletArm();
        });
        // flaming blades (Reaver, Phoenix Oath, Berserker): a fire glow at the tip
        if (C.flame) this.flameAt = { x: px - Math.sin(a) * tip, y: py + Math.cos(a) * tip };
      }

      // crisp pixel edges: drop the half-transparent anti-aliasing
      const img = g.getImageData(0, 0, BW, BH);
      const d = img.data;
      for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
      g.putImageData(img, 0, 0);

      // glows go on after the threshold so they stay soft
      g.globalCompositeOperation = 'lighter';
      if (smear) {
        g.beginPath();
        g.arc(smear.x, smear.y, smear.r, smear.a0, smear.a1);
        g.lineWidth = 7; g.strokeStyle = glow(0.4); g.stroke();
        g.lineWidth = 2; g.strokeStyle = 'rgba(255, 255, 255, 0.7)'; g.stroke();
      }
      if (this.flameAt) {
        const f = this.flameAt, flick = 0.8 + 0.2 * Math.sin(time * 23);
        const fg = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, 26 * flick);
        fg.addColorStop(0, glow(0.7));
        fg.addColorStop(0.5, 'rgba(249, 115, 22, 0.35)');
        fg.addColorStop(1, 'rgba(249, 115, 22, 0)');
        g.fillStyle = fg;
        g.fillRect(f.x - 30, f.y - 30, 60, 60);
      }
      if (cls === 'mage') {
        // orb position from the staff transform used above
        const th = attacking ? hump(qa, 0, 1) : 0;
        const sa = -0.22 - th * 0.25;
        const sx = 192 + ox - th * 34, sy = 150 + oy - th * 22;
        const orx = sx + Math.sin(sa) * 126, ory = sy - Math.cos(sa) * 126;
        const pulse = 0.55 + 0.2 * Math.sin(time * 4) + th * 0.8;
        const rg = g.createRadialGradient(orx, ory, 0, orx, ory, 18 + th * 14);
        const orbRgb = hexToRgb(C.orb[3]);
        rg.addColorStop(0, `rgba(${orbRgb[0]}, ${orbRgb[1]}, ${orbRgb[2]}, ${0.55 * pulse})`);
        rg.addColorStop(1, `rgba(${orbRgb[0]}, ${orbRgb[1]}, ${orbRgb[2]}, 0)`);
        g.fillStyle = rg;
        g.fillRect(orx - 34, ory - 34, 68, 68);
        if (this.palm) {
          const p = this.palm, r = 10 + p.power * 26;
          const pg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          const pr = card ? glowRgb : [200, 150, 255];
          pg.addColorStop(0, `rgba(${pr[0]}, ${pr[1]}, ${pr[2]}, ${0.35 + p.power * 0.6})`);
          pg.addColorStop(1, `rgba(${pr[0]}, ${pr[1]}, ${pr[2]}, 0)`);
          g.fillStyle = pg;
          g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
          // a few motes circling the palm
          g.fillStyle = 'rgba(230, 210, 255, 0.9)';
          for (let i = 0; i < 3; i++) {
            const a = time * 3 + i * 2.1;
            g.fillRect(Math.round(p.x + Math.cos(a) * 9), Math.round(p.y + Math.sin(a) * 5 - 4), 1, 1);
          }
        }
      }
      g.globalCompositeOperation = 'source-over';

      // scale up into the HUD, bottom-aligned
      const s = Math.max(w / BW * 0.88, h / 190);
      const dw = BW * s, dh = BH * s;
      hud.imageSmoothingEnabled = false;
      hud.drawImage(this.buf, Math.round((w - dw) / 2), Math.round(h - dh), Math.round(dw), Math.round(dh));
    }
  }

  window.FpHands = FpHands;
})();
