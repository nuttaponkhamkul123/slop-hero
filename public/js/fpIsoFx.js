// Skill visuals for the first-person view, drawn by the isometric renderer itself.
//
// While first person is up, the 2D renderer's effect pass (drawEffects: skill
// effects, SP card effects, AoE rings, impact slashes, SP pixel particles) is
// pointed at an offscreen canvas framed on the hero instead of the hidden iso
// canvas. That canvas is the exact isometric picture of the effects, so it is
// laid on the 3D ground as a decal through the same projection: a ground point
// (x, y) lands on the canvas pixel the iso view would put it on. Ground rings,
// slashes, AoEs, trails and novas therefore look exactly as they do in iso.
// (Parts the iso art draws up in the air are flattened onto the ground.)
//
// The rest of the effect pass (loose particles, projectiles, damage numbers)
// still runs on the normal canvas so it keeps its timing; first person draws
// those itself in 3D / on its HUD.
(function() {
  'use strict';
  if (typeof THREE === 'undefined') return;

  const W = 1536, H = 896;   // decal canvas (iso px)
  const ZOOM = 0.9;          // iso zoom the effects are drawn at (texel size on the ground)

  class FpIsoFx {
    constructor(scene, r2d) {
      this.r2d = r2d;
      this.active = false;
      this.canvas = document.createElement('canvas');
      this.canvas.width = W;
      this.canvas.height = H;
      this.g = this.canvas.getContext('2d', { willReadFrequently: true });

      this.tex = new THREE.CanvasTexture(this.canvas);
      this.tex.magFilter = THREE.NearestFilter;
      this.tex.minFilter = THREE.NearestFilter;
      this.tex.generateMipmaps = false;

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
      // canvas corners TL, TR, BR, BL (texture flipY: canvas top = v 1)
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2));
      geo.setIndex([0, 2, 1, 0, 3, 2]);
      this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        map: this.tex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide
      }));
      this.mesh.renderOrder = -1;          // under the sprites standing on it
      this.mesh.frustumCulled = false;
      this.mesh.visible = false;
      scene.add(this.mesh);

      const orig = r2d.drawEffects && r2d.drawEffects.bind(r2d);
      if (orig) r2d.drawEffects = (ctx, dt) => (this.active ? this.split(orig, ctx, dt) : orig(ctx, dt));
    }

    hasEffects() {
      const r = this.r2d;
      return (r.animations.skillEffects && r.animations.skillEffects.length) || (r.aoeRings && r.aoeRings.length)
        || (r.cardImpacts && r.cardImpacts.length) || (r._impactMobs && r._impactMobs.length) || (r.pxParts && r.pxParts.length);
    }

    split(orig, ctx, dt) {
      const r = this.r2d, A = r.animations;

      // ---- pass 1 (normal canvas): particles, projectiles, click marker, damage numbers
      const fx = A.skillEffects, aoe = r.aoeRings, imp = r.cardImpacts, mobImp = r._impactMobs, pxp = r.pxParts;
      A.skillEffects = []; r.aoeRings = []; r.cardImpacts = []; r._impactMobs = null; r.pxParts = [];
      try { orig(ctx, dt); } finally {
        A.skillEffects = fx; r.aoeRings = aoe; r.cardImpacts = imp; r._impactMobs = mobImp; r.pxParts = pxp;
      }

      if (!this.hasEffects()) { this.mesh.visible = false; return; }

      // ---- pass 2 (decal canvas): the skill effects, framed on our hero
      const gs = r.lastGameState;
      const me = gs && gs.players && gs.players.find(p => p.id === r.localPlayerId);
      if (!me) { this.mesh.visible = false; return; }
      const iso = Isometric.worldToIso(me.x, me.y);
      // whole iso px steps, so the effect pixels don't swim as we walk
      const cam = { x: Math.round(iso.x * ZOOM) / ZOOM, y: Math.round(iso.y * ZOOM) / ZOOM, zoom: ZOOM, shakeOffsetX: 0, shakeOffsetY: 0 };

      const saved = {
        camera: r.camera, canvas: r.canvas, viewW: r.viewW, viewH: r.viewH,
        particles: A.particles, texts: A.floatingTexts, proj: r.flyingProjectiles, marker: A.clickMarker
      };
      const newParticles = [];
      r.camera = cam; r.canvas = this.canvas; r.viewW = W; r.viewH = H;
      // particles the skills emit while drawing are collected and handed back
      A.particles = newParticles; A.floatingTexts = []; r.flyingProjectiles = new Map(); A.clickMarker = null;
      // ground novas normally paint in the floor pass (skipped here): draw them with the rest
      r.isGroundNova = () => false;
      const g = this.g;
      try {
        if (g.reset) g.reset();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, W, H);
        orig(g, dt);
      } catch (err) {
        console.warn('first-person effect pass:', err);
      } finally {
        delete r.isGroundNova;
        r.camera = saved.camera; r.canvas = saved.canvas; r.viewW = saved.viewW; r.viewH = saved.viewH;
        A.particles = saved.particles; A.floatingTexts = saved.texts; r.flyingProjectiles = saved.proj; A.clickMarker = saved.marker;
        for (const p of newParticles) A.particles.push(p);
      }

      // ---- lay the canvas on the ground: its corners through the inverse iso projection
      const pos = this.mesh.geometry.attributes.position;
      [[0, 0], [W, 0], [W, H], [0, H]].forEach(([sx, sy], i) => {
        const w = Isometric.screenToWorld(sx, sy, cam, W, H);
        pos.setXYZ(i, w.x, 0.035, w.y);
      });
      pos.needsUpdate = true;
      this.mesh.geometry.computeBoundingSphere();
      this.tex.needsUpdate = true;
      this.mesh.visible = true;
    }

    clear() { this.mesh.visible = false; }
  }

  window.FpIsoFx = FpIsoFx;
})();
