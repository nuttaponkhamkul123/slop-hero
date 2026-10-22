// Pixel-art UI kit for Slop Hero.
//  - Hand-drawn 12x12 icons in the UI palette (Sweetie 16 + 3)
//  - Skill/talent icons: the vector glyphs from skillIcons.js are rasterised
//    to 16x16 and snapped to the palette so every icon shares one pixel look
//  - Emoji are stripped from all DOM text and canvas text (the UI uses icons)
(function() {
  'use strict';

  const PAL = {
    k: '#1a1c2c', p: '#5d275d', r: '#b13e53', o: '#ef7d57', y: '#ffcd75', L: '#a7f070', g: '#38b764', t: '#257179',
    n: '#29366f', b: '#3b5dc9', B: '#41a6f6', c: '#73eff7', w: '#f4f4f4', l: '#94b0c2', s: '#566c86', d: '#333c57',
    m: '#6b3e2e', T: '#a0603a', e: '#9a5bd6'
  };
  const PAL_RGB = Object.values(PAL).map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

  // 12x12, one character per art pixel ('.' = transparent)
  const ICONS = {
    sword: ['.........kkk', '........kwlk', '.......kwlk.', '......kwlk..', '.....kwlk...', '.k..kwlk....', 'kyk.kwlk....', '.kykwlk.....', '..kyyk......', '.kmkkyk.....', 'kmk..kyk....', 'kk....k.....'],
    dagger: ['............', '........kk..', '.......kwk..', '......kwlk..', '.....kwlk...', '....kwlk....', '..k.klk.....', '..kykk......', '...kyk......', '..kmkyk.....', '.kmk..k.....', '.kk.........'],
    staff: ['.......kkk..', '......kcBck.', '......kBwBk.', '......kcBck.', '.......kkk..', '......kmk...', '.....kmk....', '....kmk.....', '...kmk......', '..kmk.......', '.kmk........', '.kk.........'],
    hp_potion: ['....kkkk....', '....kmmk....', '....kkkk....', '.....kk.....', '....kwwk....', '...krwrrk...', '..krwrrrrk..', '..krrrrrrk..', '..krrrrrrk..', '..kprrrrpk..', '...kkkkkk...', '............'],
    mp_potion: ['....kkkk....', '....kmmk....', '....kkkk....', '.....kk.....', '....kwwk....', '...kbwbbk...', '..kbwBbbbk..', '..kbBbbbbk..', '..kbbbbbbk..', '..knbbbbnk..', '...kkkkkk...', '............'],
    coin: ['............', '....kkkk....', '..kkyyyykk..', '.kyywyyyTyk.', '.kywyyyyyTk.', 'kyyyykkyyyTk', 'kyyyykkyyyTk', '.kyyyyyyyTk.', '.kyyyyyyTTk.', '..kkTTTTkk..', '....kkkk....', '............'],
    heart: ['............', '.kkk...kkk..', 'krrrk.krrrk.', 'krwrrkrrrrk.', 'krrrrrrrrrk.', 'krrrrrrrrrk.', '.krrrrrrrpk.', '..krrrrrpk..', '...krrrpk...', '....krpk....', '.....kk.....', '............'],
    shield: ['.kkkkkkkkkk.', 'klllllssssk.', 'klwlllsddsk.', 'kllyyyydddk.', 'kllyrryyddk.', 'kllyrryyddk.', '.klyyyyydk..', '.klllssddk..', '..kllsddk...', '...klsdk....', '....kkk.....', '............'],
    skull: ['...kkkkkk...', '..kwwwwwwk..', '.kwwwwwwwlk.', '.kwkkwwkklk.', '.kwkkwwkklk.', '.kwwwkkwwlk.', '..kwwwwwlk..', '..kwkwkwk...', '..kkkkkkk...', '............', '............', '............'],
    bag: ['....kkkk....', '...kTkkTk...', '...kk..kk...', '..kkkkkkkk..', '.kTTTTTTTmk.', 'kTTyyTTTTTmk', 'kTTyyTTTTTmk', 'kTTTTTTTTTmk', 'kTTTTTTTTmmk', '.kmmmmmmmmk.', '..kkkkkkkk..', '............'],
    scroll: ['.kkkkkkkkk..', 'kwwwwwwwwyk.', 'kyyyyyyyyyk.', '.kyssssssyk.', '.kyyyyyyyyk.', '.kysssssyyk.', '.kyyyyyyyyk.', '.kyssssyyyk.', 'kyyyyyyyyyk.', 'kTTTTTTTTTk.', '.kkkkkkkkk..', '............'],
    gem: ['............', '...kkkkkk...', '..keeweeek..', '.keewweeeek.', 'kkkkkkkkkkkk', 'keeeewweeeek', '.keeeweeeek.', '..keeeeeek..', '...keeeek...', '....keek....', '.....kk.....', '............'],
    whirl: ['...kkkkk....', '..kccccck...', '.kckkkkcck..', 'kck....kck..', 'kck.kk..kck.', 'kck.kck.kck.', 'kck..kccck..', '.kck..kkk...', '..kcck...k..', '...kkccckk..', '.....kkk....', '............'],
    fire: ['.....k......', '....kok.....', '....kook....', '...koyok....', '..koyyok.k..', '..koyyyokok.', '.koyywyyook.', '.koywwwyyok.', '.koyywwyyok.', '..koyyyyok..', '...kkkkkk...', '............'],
    helmet: ['............', '....kkkk....', '...kllllk...', '..klwllssk..', '.klwlllsssk.', '.kllllsssdk.', '.kkkkkkkkkk.', '.klk.kk.ksk.', '.klk.kk.ksk.', '.kk..kk..kk.', '............', '............'],
    armor: ['............', '.kkk....kkk.', 'klllkkkkllsk', 'klwlllllssdk', '.kllllllssk.', '.klwllllsdk.', '.kllyyylssk.', '.klllllsssk.', '.kllllssssk.', '.klllsssddk.', '..kkkkkkkk..', '............'],
    boots: ['............', '...kkkk.....', '...kmTk.....', '...kmTk.....', '...kmTk.....', '...kmTk.....', '...kmTTkkk..', '..kmmTTTTTk.', '..kmTTTTTTk.', '..kkkkkkkkk.', '............', '............'],
    ring: ['............', '....kkkk....', '...keeeek...', '....kkkk....', '...kykkyk...', '..kyk..kyk..', '..kyk..kTk..', '..kyk..kTk..', '...kyTTTk...', '....kkkk....', '............', '............'],
    chalice: ['............', '.kkkkkkkkk..', '.kyyyyyyyk..', '.kyrrrrryk..', '..kyyyyyk...', '...kyyyk....', '....kyk.....', '....kyk.....', '...kyyyk....', '..kTTTTTk...', '..kkkkkkk...', '............'],
    scale: ['............', '.....kk.....', '....kLgk....', '...kLggtk...', '..kLgggttk..', '..kLggggtk..', '..kLggggtk..', '...kLggtk...', '....kgtk....', '.....kk.....', '............', '............'],
    idol: ['....kkkk....', '...kyyyyk...', '...kykkyk...', '...kyyyyk...', '...kyrryk...', '..kkyyyykk..', '.kyyyyyyyyk.', '.kTyyyyyyTk.', '..kyyyyyyk..', '..kTTTTTTk..', '..kkkkkkkk..', '............'],
    essence: ['.....k......', '.....e......', '....kek.....', '..k.kek.k...', '...keweek...', 'kkeewwweekk.', '...keweek...', '..k.kek.k...', '....kek.....', '.....e......', '.....k......', '............'],
    hammer: ['............', '.kkkkkk.....', 'kllllllk....', 'klwlllsk....', 'kllllssk....', '.kkkmkkk....', '....kmk.....', '.....kmk....', '......kmk...', '.......kmk..', '........kmk.', '.........kk.'],
    target: ['....kkkk....', '..kkrrrrkk..', '.krrkkkkrrk.', '.krk....krk.', 'krk..kk..krk', 'krk.kwwk.krk', 'krk.kwwk.krk', 'krk..kk..krk', '.krk....krk.', '.krrkkkkrrk.', '..kkrrrrkk..', '....kkkk....'],
    chat: ['............', '.kkkkkkkkkk.', 'kwwwwwwwwwwk', 'kwkkwkkwkkwk', 'kwwwwwwwwwwk', 'kwkkkkkwwwwk', 'kwwwwwwwwwwk', '.kkkwwkkkkk.', '...kwk......', '...kk.......', '............', '............'],
    sound: ['............', '.....k......', '....kk...k..', '...kwk.k..k.', 'kkkwwk..k.k.', 'kwwwwk..k.k.', 'kwwwwk..k.k.', 'kkkwwk..k.k.', '...kwk.k..k.', '....kk...k..', '.....k......', '............'],
    mute: ['............', '.....k......', '....kk......', '...kwk......', 'kkkwwk.r..r.', 'kwwwwk..rr..', 'kwwwwk..rr..', 'kkkwwk.r..r.', '...kwk......', '....kk......', '.....k......', '............'],
    menu: ['............', '............', '.kkkkkkkkkk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.', '............', '............', '............'],
    tree: ['....kkkk....', '..kkgLggkk..', '.kgLLgggggk.', '.kgLgggggtk.', 'kgggggggtttk', '.kggggggttk.', '..kkgttkkk..', '....kmk.....', '....kmk.....', '...kmmmk....', '..kkkkkkk...', '............'],
    stats: ['............', '........kkk.', '........kyk.', '....kkk.kyk.', '....kBk.kyk.', '....kBk.kyk.', 'kkk.kBk.kyk.', 'krk.kBk.kyk.', 'krk.kBk.kyk.', 'krk.kBk.kyk.', 'kkkkkkkkkkk.', '............'],
    help: ['...kkkkkk...', '..kwwwwwwk..', '.kwwkkkkwwk.', '.kkk...kwwk.', '......kwwk..', '.....kwwk...', '.....kwwk...', '.....kkkk...', '.....kwwk...', '.....kwwk...', '.....kkkk...', '............'],
    castle: ['............', 'kk.kk..kk.kk', 'klkkskkklksk', 'kllllllllssk', 'kllkllllkssk', 'kllllllllssk', 'klllkkkllssk', 'kllkmmmklssk', 'kllkmmmklssk', 'kkkkkkkkkkkk', '............', '............'],
    compass: ['....kkkk....', '..kkwwwwkk..', '.kwwwrrwwwk.', '.kwwwrrwwwk.', 'kwwwrrrrwwwk', 'kwwwkwwkwwwk', 'kwwwkllkwwwk', 'kwwwwllwwwwk', '.kwwwllwwwk.', '.kwwwwwwwwk.', '..kkwwwwkk..', '....kkkk....'],
    cube: ['............', '.....kk.....', '...kkwwkk...', '.kkwwwwwwkk.', '.klkkwwkksk.', '.klllkksssk.', '.kllllssssk.', '.kllllssssk.', '.kllllssssk.', '..kkllsskk..', '....kkkk....', '............'],
    lock: ['............', '....kkkk....', '...kllllk...', '..klk..klk..', '..klk..klk..', '.kkkkkkkkkk.', '.kyyyyyyyyk.', '.kyyykkyyTk.', '.kyyykkyyTk.', '.kyyyyyyTTk.', '.kkkkkkkkkk.', '............'],
    star: ['.....kk.....', '.....kk.....', '....kyyk....', 'kkkkyyyykkkk', '.kyyyyyyyyk.', '..kyyyyyyk..', '...kyyyyk...', '..kyyyyyyk..', '..kyykkyyk..', '.kyk....kyk.', '.kk......kk.', '............'],
    chest: ['............', '..kkkkkkkk..', '.kTTTTTTTTk.', 'kTmmmmmmmmTk', 'kkkkkkkkkkkk', 'kTTTTyyTTTTk', 'kTTTkyykTTTk', 'kmTTTkkTTTmk', 'kmTTTTTTTTmk', 'kmmmmmmmmmmk', 'kkkkkkkkkkkk', '............'],
    door: ['...kkkkkk...', '..kmmmmmmk..', '.kmTTmmTTmk.', '.kmTTmmTTmk.', '.kmTTmmTTmk.', '.kmmmmmmmmk.', '.kmTTmmTTyk.', '.kmTTmmTTmk.', '.kmTTmmTTmk.', '.kmmmmmmmmk.', '.kkkkkkkkkk.', '............'],
    dot: ['............', '....kkkk....', '...kllllk...', '..kllwllsk..', '..klwllssk..', '..kllllssk..', '..klllsssk..', '...kssssk...', '....kkkk....', '............', '............', '............'],
    snow: ['.....k......', '..k..c..k...', '...c.c.c....', '....ccc.....', 'kccccwcccck.', '....ccc.....', '...c.c.c....', '..k..c..k...', '.....k......', '............', '............', '............'],
    poison: ['.....k......', '....kgk.....', '....kgk.....', '...kgggk....', '..kgLgggk...', '.kgLggggtk..', '.kgLggggtk..', '.kggggggtk..', '..kgggttk...', '...kkkkk....', '............', '............'],
    bolt: ['.......kkk..', '......kyyk..', '.....kyyk...', '....kyyk....', '...kyyykkk..', '..kyyyyyyk..', '..kkkyyyk...', '....kyyk....', '...kyyk.....', '..kyyk......', '..kyk.......', '..kk........'],
    crown: ['............', '............', '.k...kk...k.', '.kk.kyyk.kk.', '.kyk.kk.kyk.', '.kyykyykyyk.', '.kyyyyyyyyk.', '.kyrryyrryk.', '.kyyyyyyyyk.', '.kkkkkkkkkk.', '............', '............'],
    refresh: ['....kkkk....', '..kkBBBBkk.k', '.kBBkkkkBBkk', '.kBk....kBBk', 'kBk....kBBBk', 'kBk....kkkkk', 'kBk.........', 'kkkkk....kBk', 'kBBBk....kBk', 'kBBk....kBk.', 'kk.kkBBBBkk.', 'k...kkkk....'],
    online: ['............', '............', '....kkkk....', '...kLLggk...', '..kLwLgggk..', '..kLLgggtk..', '..kggggttk..', '...kgttgk...', '....kkkk....', '............', '............', '............']
  };

  // Recoloured variants of the base icons
  const VARIANTS = {
    elixir_fury: ['hp_potion', { r: 'o', p: 'r' }],
    elixir_iron: ['hp_potion', { r: 'l', p: 's', w: 'w' }],
    ruby: ['gem', { e: 'r' }],
    sapphire: ['gem', { e: 'B' }]
  };

  const urlCache = new Map();
  function iconUrl(name) {
    if (urlCache.has(name)) return urlCache.get(name);
    let rows = ICONS[name];
    let swap = null;
    if (!rows && VARIANTS[name]) {
      rows = ICONS[VARIANTS[name][0]];
      swap = VARIANTS[name][1];
    }
    if (!rows) rows = ICONS.dot;
    const c = document.createElement('canvas');
    c.width = 12;
    c.height = 12;
    const ctx = c.getContext('2d');
    rows.forEach((row, y) => [...row.padEnd(12, '.').slice(0, 12)].forEach((ch, x) => {
      if (ch === '.') return;
      const key = swap && swap[ch] ? swap[ch] : ch;
      ctx.fillStyle = PAL[key] || PAL.k;
      ctx.fillRect(x, y, 1, 1);
    }));
    const url = c.toDataURL();
    urlCache.set(name, url);
    return url;
  }

  const imgCache = new Map();
  function iconImage(name) {
    if (!imgCache.has(name)) {
      const img = new Image();
      img.src = iconUrl(name);
      imgCache.set(name, img);
    }
    return imgCache.get(name);
  }

  const html = (name, cls = '') => `<img class="pxi ${cls}" src="${iconUrl(name)}" alt="" draggable="false">`;

  // Item -> icon name
  const ITEM_ICON = {
    health_potion: 'hp_potion', greater_health_potion: 'hp_potion',
    mana_potion: 'mp_potion', greater_mana_potion: 'mp_potion',
    town_scroll: 'scroll', elixir_of_fury: 'elixir_fury', elixir_of_iron: 'elixir_iron',
    ancient_ruby: 'ruby', cursed_chalice: 'chalice', dragon_scale: 'scale', golden_idol: 'idol', shadow_essence: 'essence',
    shadow_daggers: 'dagger', archmage_staff: 'staff', excalibur: 'sword', sweeping_claymore: 'sword', iron_blade: 'sword', wind_rapier: 'dagger',
    leather_tunic: 'armor', plate_cuirass: 'armor', mystic_robe: 'armor',
    iron_helm: 'helmet', shadow_hood: 'helmet', archmage_cowl: 'helmet',
    iron_greaves: 'boots', winged_boots: 'boots', ring_of_power: 'ring'
  };
  function itemIconName(item) {
    if (!item) return 'bag';
    if (item.type === 'gold') return 'coin';
    const id = item.baseId || item.itemId || item.id;
    if (ITEM_ICON[id]) return ITEM_ICON[id];
    const name = (item.name || '').toLowerCase();
    if (item.slot === 'weapon') return /staff|wand|scepter/.test(name) ? 'staff' : /dagger|knife|rapier|fang/.test(name) ? 'dagger' : 'sword';
    if (item.slot === 'armor') return 'armor';
    if (item.slot === 'helmet') return 'helmet';
    if (item.slot === 'boots') return 'boots';
    if (item.slot === 'ring') return 'ring';
    if (item.type === 'consumable') return /mana/.test(name) ? 'mp_potion' : 'hp_potion';
    if (item.type === 'treasure') return 'gem';
    return 'bag';
  }

  // ---------- skill / talent icons: vector glyph -> 16x16 palette pixels ----------
  const SKILL_PX = 16;
  const skillUrls = new Map();
  function nearestPalette(r, g, b) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < PAL_RGB.length; i++) {
      const [pr, pg, pb] = PAL_RGB[i];
      // weighted distance (perceptual-ish)
      const d = 2 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 3 * (b - pb) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return PAL_RGB[best];
  }
  function pixelateSvg(svgString) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = SKILL_PX;
        c.height = SKILL_PX;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, SKILL_PX, SKILL_PX);
        const data = ctx.getImageData(0, 0, SKILL_PX, SKILL_PX);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 110) { px[i + 3] = 0; continue; }
          const [r, g, b] = nearestPalette(px[i] * 255 / px[i + 3], px[i + 1] * 255 / px[i + 3], px[i + 2] * 255 / px[i + 3]);
          px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
        }
        ctx.putImageData(data, 0, 0);
        resolve(c.toDataURL());
      };
      img.onerror = () => resolve(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
    });
  }

  let skillsReady = false;
  function prepareSkillIcons() {
    if (!window.SkillIcons || !window.SkillIcons.ids) return Promise.resolve();
    const originalSvg = window.SkillIcons.svg;
    const jobs = window.SkillIcons.ids().map(id =>
      pixelateSvg(originalSvg(id)).then(url => { if (url) skillUrls.set(id, url); })
    );
    // From now on every skill/talent icon is the pixel version once ready
    window.SkillIcons.svg = (id) => {
      const url = skillUrls.get(id) || skillUrls.get('empty');
      return url ? `<img class="skill-svg pxi" src="${url}" alt="" draggable="false">` : originalSvg(id);
    };
    return Promise.all(jobs).then(() => {
      skillsReady = true;
      window.dispatchEvent(new Event('pixelicons:ready'));
    });
  }

  // ---------- emoji stripping (DOM + canvas) ----------
  const SYMBOL_SWAP = [[/➜|➔|→|➡️?/g, '>'], [/✕|✖️?|✗/g, 'x'], [/★|⭐/g, '*'], [/✓|✔️?/g, '+']];
  const EMOJI_RE = /(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{1F1E6}-\u{1F1FF}][\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]*)+|\u{FE0F}|\u{200D}/gu;
  function stripEmoji(text) {
    if (typeof text !== 'string' || !text) return text;
    let out = text;
    for (const [re, rep] of SYMBOL_SWAP) out = out.replace(re, rep);
    out = out.replace(EMOJI_RE, '');
    if (out === text) return text;
    return out.replace(/ {2,}/g, ' ').replace(/^\s+/, (m) => (/^\s/.test(text) ? m : ''));
  }

  function cleanNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const v = node.nodeValue;
      const s = stripEmoji(v);
      if (s !== v) node.nodeValue = s;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return;
    if (node.hasAttribute && node.hasAttribute('title')) {
      const t = node.getAttribute('title');
      const s = stripEmoji(t);
      if (s !== t) node.setAttribute('title', s);
    }
    if (node.hasAttribute && node.hasAttribute('placeholder')) {
      const t = node.getAttribute('placeholder');
      const s = stripEmoji(t);
      if (s !== t) node.setAttribute('placeholder', s);
    }
    if (node.dataset && node.dataset.pxi) hydrateOne(node);
    for (const child of node.childNodes) cleanNode(child);
  }

  function hydrateOne(el) {
    const name = el.dataset.pxi;
    if (el.dataset.pxiDone === name) return;
    el.dataset.pxiDone = name;
    el.innerHTML = html(name);
  }

  function startObserver() {
    cleanNode(document.body);
    const obs = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'characterData') cleanNode(m.target);
        else if (m.type === 'attributes') cleanNode(m.target);
        else m.addedNodes.forEach(cleanNode);
      }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'data-pxi'] });
  }

  // canvas text never shows emoji either
  const proto = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if (proto && !proto.__pxPatched) {
    proto.__pxPatched = true;
    for (const fn of ['fillText', 'strokeText', 'measureText']) {
      const orig = proto[fn];
      proto[fn] = function(text, ...rest) { return orig.call(this, stripEmoji(String(text)), ...rest); };
    }
  }

  function setFavicon() {
    const link = document.querySelector('link[rel="icon"]') || document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'icon' }));
    link.href = iconUrl('sword');
  }

  window.PixelIcons = {
    PAL, ICONS, url: iconUrl, image: iconImage, html, item: itemIconName,
    itemHtml: (item, cls) => html(itemIconName(item), cls),
    stripEmoji, isSkillReady: () => skillsReady
  };
  window.stripEmoji = stripEmoji;

  const boot = () => {
    startObserver();
    setFavicon();
    prepareSkillIcons();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
