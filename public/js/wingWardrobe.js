// Slop Hero - SP wing wardrobe (server: server/wingSkins.ts)
//
// Pick the wings an SP transformation wears: Auto (the card's own style for its level), None,
// any style the equipped card has reached (+10 per style), or an unlocked wing skin. Also
// draws the wing previews used here and as the wing skin items' icons.
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const STYLE_NAMES = ['', 'Fledgling', 'Pinion', 'Drake', 'Gale', 'Dusk', 'Blaze', 'Crystal', 'Seraph', 'Sovereign', 'Ascendant'];
  const RARITY_COLOR = { rare: '#41a6f6', epic: '#9a5bd6', legendary: '#ffcd75', mythic: '#ef7d57' };
  const W = {
    socket: null, getPlayer: null, el: null,
    previews: new Map()
  };

  // How far a wing's pixels reach from its root (art pixels), so a pair can be scaled to fill
  // a preview instead of floating small in the middle of the wing canvas
  const extents = new Map();
  function extentOf(wing, key) {
    if (extents.has(key)) return extents.get(key);
    const SW = window.SpWings;
    const c = document.createElement('canvas');
    c.width = SW.W; c.height = SW.H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(wing, 0, 0);
    const d = g.getImageData(0, 0, SW.W, SW.H).data;
    let x1 = SW.RX + 1, y0 = SW.RY, y1 = SW.RY;
    for (let y = 0; y < SW.H; y++) for (let x = 0; x < SW.W; x++) {
      if (d[(y * SW.W + x) * 4 + 3] < 20) continue;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    const e = { reach: x1 - SW.RX + 1, y0, y1 };
    extents.set(key, e);
    return e;
  }
  // Draw both wings of a style into g, filling a box of bw x bh centred at (cx, cy)
  function drawPair(g, tier, color, frame, cx, cy, bw, bh) {
    const SW = window.SpWings;
    const wing = SW.wing(tier, color, frame);
    const e = extentOf(wing, tier + '|' + color + '|' + frame);
    const s = Math.min(bw / (e.reach * 2), bh / (e.y1 - e.y0 + 1));
    const midY = (e.y0 + e.y1 + 1) / 2;
    for (const side of [-1, 1]) {
      g.save();
      g.translate(cx, cy);
      g.scale(side * s, s);
      g.drawImage(wing, -SW.RX, -midY);
      g.restore();
    }
  }

  // Both wings of a style, spread, on a small canvas (cached as a data URL)
  function previewUrl(tier, color, size = 96, frame = 2) {
    const key = tier + '|' + color + '|' + size + '|' + frame;
    if (W.previews.has(key)) return W.previews.get(key);
    const SW = window.SpWings;
    if (!SW || !tier) return '';
    const c = document.createElement('canvas');
    c.width = size; c.height = Math.round(size * 0.66);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    drawPair(g, tier, color, frame, c.width / 2, c.height / 2, c.width * 0.94, c.height * 0.92);
    const url = c.toDataURL();
    W.previews.set(key, url);
    return url;
  }
  W.previewUrl = previewUrl;

  // Icon for a wing skin item: the wings on a dark tile framed in the skin colour
  W.itemIconUrl = function (skinId) {
    const cat = window.WING_SKINS, SW = window.SpWings;
    const skin = cat && cat.skins.find(s => s.id === skinId);
    if (!skin || !SW) return '';
    const key = 'item|' + skinId;
    if (W.previews.has(key)) return W.previews.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = 48;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#1a1c2c'; g.fillRect(0, 0, 48, 48);
    const glow = g.createRadialGradient(24, 24, 2, 24, 24, 30);
    glow.addColorStop(0, skin.color); glow.addColorStop(1, 'rgba(26, 28, 44, 0)');
    g.globalAlpha = 0.45; g.fillStyle = glow; g.fillRect(2, 2, 44, 44); g.globalAlpha = 1;
    drawPair(g, skin.style, skin.color, 2, 24, 24, 42, 38);
    g.fillStyle = skin.color;
    g.fillRect(0, 0, 48, 2); g.fillRect(0, 46, 48, 2); g.fillRect(0, 0, 2, 48); g.fillRect(46, 0, 2, 48);
    const url = c.toDataURL();
    W.previews.set(key, url);
    return url;
  };

  function cardOf(p) {
    const sp = p && p.equipment && p.equipment.sp;
    const cat = window.SP_CATALOG;
    if (!sp || !cat) return null;
    for (const list of Object.values(cat.cards)) { const c = list.find(x => x.id === sp.cardId); if (c) return { card: c, level: sp.upgradeLevel || 0 }; }
    return null;
  }

  // The wardrobe lives in the Customize window's Wings tab (#customizeWings)
  const host = () => document.getElementById('customizeWings');
  function render() {
    const p = W.getPlayer && W.getPlayer();
    const body = host();
    if (!body || !p) return;
    const eq = cardOf(p);
    const color = eq ? eq.card.color : '#a855f7';
    const own = eq ? Math.min(10, Math.floor(eq.level / 10)) : 0;
    const current = p.wingStyle || 'auto';
    const owned = new Set(p.wingSkins || []);
    const cat = window.WING_SKINS || { skins: [] };
    const opt = (id, title, sub, img, locked, lockText, accent) => `
      <button type="button" class="ww-opt ${current === id ? 'is-on' : ''} ${locked ? 'is-locked' : ''}" data-style="${esc(id)}" ${locked ? 'disabled' : ''} title="${esc(locked ? lockText : title)}" style="--acc:${accent || color}">
        <span class="ww-prev">${img ? `<img src="${img}" alt="">` : `<span class="ww-empty">${esc(sub)}</span>`}</span>
        <span class="ww-name">${esc(title)}</span>
        ${locked ? `<span class="ww-lock">${esc(lockText)}</span>` : ''}
      </button>`;
    const styles = [];
    for (let n = 1; n <= 10; n++) {
      styles.push(opt('tier:' + n, `${ROMAN[n]} · ${STYLE_NAMES[n]}`, '', previewUrl(n, color), n > own, `Card +${n * 10}`));
    }
    const skins = cat.skins.map(s => opt(s.id, s.name, '', previewUrl(s.style, s.color), !owned.has(s.id), 'Drops from bosses', RARITY_COLOR[s.rarity]));
    body.innerHTML = `
      <div class="ww-note">${eq ? `Your <b style="color:${color}">${esc(eq.card.name)}</b> card is <b>+${eq.level}</b>: ${own ? `styles up to ${ROMAN[own]} unlocked` : 'wings start at +10'}. Skins can be worn at any card level.` : 'Equip an SP card to wear wings when you transform. Unlocked skins stay yours.'}</div>
      <div class="ww-section">GENERAL</div>
      <div class="ww-grid">
        ${opt('auto', 'Auto', own ? '' : 'Card level', own ? previewUrl(own, color) : '', false, '')}
        ${opt('none', 'No wings', 'None', '', false, '')}
      </div>
      <div class="ww-section">CARD STYLES <small>(card colour, one per +10)</small></div>
      <div class="ww-grid">${styles.join('')}</div>
      <div class="ww-section">WING SKINS <small>${owned.size} / ${cat.skins.length} unlocked</small></div>
      <div class="ww-grid">${skins.join('')}</div>`;
    body.querySelectorAll('.ww-opt:not(.is-locked)').forEach(b => b.addEventListener('click', () => {
      W.socket.emit('set_wing_style', { style: b.dataset.style });
      // show it at once; player_updated confirms
      p.wingStyle = b.dataset.style;
      render();
      if (window.soundEngine) window.soundEngine.playCoin();
    }));
  }

  W.render = render;
  // open the Customize window on its Wings tab (game.js)
  W.open = function () { if (window.openCustomize) window.openCustomize('wings'); };
  W.close = function () { const m = document.getElementById('effectsModal'); if (m) m.style.display = 'none'; };
  // showing = the Customize window is open on the Wings tab
  W.isOpen = () => { const b = host(); return !!(b && b.offsetParent); };

  W.bind = function (socket, getPlayer) {
    W.socket = socket;
    W.getPlayer = getPlayer;
    socket.on('player_updated', () => { if (W.isOpen()) setTimeout(render, 0); });
    socket.on('wing_skin_unlocked', () => { if (W.isOpen()) setTimeout(render, 0); });
  };

  window.WingWardrobe = W;
})();
