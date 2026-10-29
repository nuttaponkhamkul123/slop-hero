// Vector skill icons for Slop Hero (no emoji).
// SkillIcons.svg(skillId) returns an inline <svg> string: an element-tinted
// rounded badge with a hand-drawn glyph on a 64x64 grid.
(function() {
  'use strict';

  // Element palettes: badge gradient (top -> bottom), glyph fill, accent, hot core
  const PALETTES = {
    steel:  { top: '#475569', bot: '#0f172a', fg: '#e2e8f0', acc: '#94a3b8', hot: '#ffffff' },
    blood:  { top: '#7f1d1d', bot: '#1a0505', fg: '#fecaca', acc: '#ef4444', hot: '#fde68a' },
    gold:   { top: '#92400e', bot: '#1c1004', fg: '#fde68a', acc: '#f59e0b', hot: '#fffbeb' },
    earth:  { top: '#78350f', bot: '#1c1208', fg: '#fde68a', acc: '#d97706', hot: '#fef3c7' },
    fire:   { top: '#9a3412', bot: '#1c0a05', fg: '#fdba74', acc: '#f97316', hot: '#fde047' },
    ice:    { top: '#075985', bot: '#071827', fg: '#e0f2fe', acc: '#38bdf8', hot: '#ffffff' },
    bolt:   { top: '#854d0e', bot: '#111008', fg: '#fef08a', acc: '#facc15', hot: '#ffffff' },
    arcane: { top: '#5b21b6', bot: '#140726', fg: '#ede9fe', acc: '#a855f7', hot: '#f5d0fe' },
    poison: { top: '#166534', bot: '#04140a', fg: '#bbf7d0', acc: '#22c55e', hot: '#d9f99d' },
    shadow: { top: '#3730a3', bot: '#0b0a1f', fg: '#ddd6fe', acc: '#8b5cf6', hot: '#f0abfc' },
    dread:  { top: '#4c1d95', bot: '#07020f', fg: '#f3e8ff', acc: '#c084fc', hot: '#f43f5e' }
  };

  // --- Reusable glyph parts (all drawn pointing up, centred on x = 32) ---
  const sword = (p, t) => `<g transform="${t || ''}">
      <path d="M32 6 L36.5 13 V40 H27.5 V13 Z" fill="${p.fg}"/>
      <path d="M32 10 V38" stroke="${p.acc}" stroke-width="1.6"/>
      <rect x="21" y="40" width="22" height="4.5" rx="2.2" fill="${p.acc}"/>
      <rect x="29.6" y="44.5" width="4.8" height="9" fill="#7c4a24"/>
      <circle cx="32" cy="56.5" r="3" fill="${p.acc}"/></g>`;

  const dagger = (p, t) => `<g transform="${t || ''}">
      <path d="M32 10 L35.5 17 V38 H28.5 V17 Z" fill="${p.fg}"/>
      <path d="M32 14 V36" stroke="${p.acc}" stroke-width="1.4"/>
      <rect x="25" y="38" width="14" height="3.6" rx="1.8" fill="${p.acc}"/>
      <rect x="30" y="41.6" width="4" height="8" fill="#3f2a1a"/>
      <circle cx="32" cy="51.5" r="2.4" fill="${p.acc}"/></g>`;

  const cloud = (p, fill) => `<path d="M16 34 A8 8 0 0 1 20 19 A11 11 0 0 1 41 16 A9 9 0 0 1 50 33 Z" fill="${fill || p.fg}"/>`;

  const bolt = (fill, t) => `<path transform="${t || ''}" d="M36 6 L22 34 H31 L26 58 L44 26 H34 Z" fill="${fill}"/>`;

  const rays = (cx, cy, r1, r2, n, stroke, w, offset) => {
    let s = '';
    for (let i = 0; i < n; i++) {
      const a = (offset || 0) + (i / n) * Math.PI * 2;
      s += `<line x1="${(cx + Math.cos(a) * r1).toFixed(1)}" y1="${(cy + Math.sin(a) * r1).toFixed(1)}" x2="${(cx + Math.cos(a) * r2).toFixed(1)}" y2="${(cy + Math.sin(a) * r2).toFixed(1)}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
    }
    return s;
  };

  const star = (cx, cy, rOut, rIn, n, fill) => {
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 === 0 ? rOut : rIn;
      const a = -Math.PI / 2 + (i / (n * 2)) * Math.PI * 2;
      d += (i === 0 ? 'M' : 'L') + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1) + ' ';
    }
    return `<path d="${d}Z" fill="${fill}"/>`;
  };

  const hood = (p, t, opacity) => `<g transform="${t || ''}" opacity="${opacity || 1}">
      <path d="M32 10 C22 10 18 20 19 30 L14 56 H50 L45 30 C46 20 42 10 32 10 Z" fill="${p.fg}"/>
      <path d="M32 18 C26 18 24 24 24.5 30 C26 34 38 34 39.5 30 C40 24 38 18 32 18 Z" fill="#0b0a1f"/>
      <rect x="27" y="25" width="3.4" height="1.8" rx="0.9" fill="${p.hot}"/>
      <rect x="33.6" y="25" width="3.4" height="1.8" rx="0.9" fill="${p.hot}"/></g>`;

  const snowflake = (p, cx, cy, r, w) => {
    let s = '';
    for (let i = 0; i < 6; i++) {
      s += `<g transform="rotate(${i * 60} ${cx} ${cy})" stroke="${p.fg}" stroke-width="${w}" stroke-linecap="round" fill="none">
        <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - r}"/>
        <path d="M${cx - r * 0.28} ${cy - r * 0.72} L${cx} ${cy - r * 0.48} L${cx + r * 0.28} ${cy - r * 0.72}"/></g>`;
    }
    return s;
  };

  // --- Skill glyphs: [palette, (p) => svg markup] ---
  const GLYPHS = {
    // Shared basic attacks
    basic_attack: ['steel', p => sword(p, 'rotate(45 32 32)')],
    basic_attack_mage: ['arcane', p => `
      <line x1="20" y1="56" x2="40" y2="18" stroke="#8b5a2b" stroke-width="4" stroke-linecap="round"/>
      <circle cx="42" cy="15" r="8" fill="${p.acc}"/><circle cx="40" cy="13" r="3" fill="${p.hot}"/>`],
    basic_attack_rogue: ['shadow', p => dagger(p, 'rotate(40 32 32)')],
    empty: ['steel', p => `<rect x="18" y="18" width="28" height="28" rx="6" fill="none" stroke="${p.acc}" stroke-width="3" stroke-dasharray="5 4"/>`],

    // ===== WARRIOR =====
    whirlwind: ['steel', p => `
      <g fill="none" stroke="${p.acc}" stroke-width="4" stroke-linecap="round">
        <path d="M32 8 A24 24 0 0 1 55 28"/><path d="M52 46 A24 24 0 0 1 22 54"/><path d="M10 40 A24 24 0 0 1 16 14"/></g>
      ${sword(p, 'rotate(-35 32 32) translate(32 32) scale(0.72) translate(-32 -32)')}`],
    blade_charge: ['steel', p => `
      <g stroke="${p.acc}" stroke-width="3" stroke-linecap="round"><line x1="6" y1="22" x2="20" y2="22"/><line x1="4" y1="32" x2="16" y2="32"/><line x1="6" y1="42" x2="20" y2="42"/></g>
      ${sword(p, 'rotate(90 32 32) translate(32 32) scale(0.85) translate(-32 -32) translate(0 -6)')}`],
    shield_slam: ['steel', p => `
      <path d="M32 8 L51 15 V30 C51 43 42 51 32 57 C22 51 13 43 13 30 V15 Z" fill="${p.fg}" stroke="${p.acc}" stroke-width="2.5"/>
      <path d="M32 15 L45 20 V30 C45 39 39 45 32 49 C25 45 19 39 19 30 V20 Z" fill="#1e3a8a"/>
      <path d="M32 20 V44 M23 30 H41" stroke="${p.hot}" stroke-width="3" stroke-linecap="round"/>`],
    earthshaker: ['earth', p => `
      <rect x="29.5" y="6" width="5" height="24" fill="#7c4a24"/>
      <rect x="17" y="28" width="30" height="15" rx="3" fill="${p.fg}" stroke="${p.acc}" stroke-width="1.5"/>
      <path d="M6 47 H58" stroke="${p.acc}" stroke-width="3" stroke-linecap="round"/>
      <path d="M32 47 L28 53 L33 58 M32 47 L38 52 L36 58 M24 47 L18 54 M40 47 L46 54" stroke="${p.fg}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M8 38 A12 12 0 0 1 12 28 M56 38 A12 12 0 0 0 52 28" stroke="${p.hot}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`],
    dragon_roar: ['blood', p => `
      <path d="M18 19 L3 7 L23 15 Z M25 16 L13 3 L30 14 Z" fill="${p.acc}"/>
      <path d="M8 32 L16 20 L32 15 L48 20 L50 26 L34 28 L16 34 Z" fill="${p.fg}"/>
      <path d="M14 38 L34 33 L46 38 L42 42 L28 46 L14 46 Z" fill="${p.fg}"/>
      <path d="M8 32 L4 42 L14 38 Z M10 44 L6 54 L18 46 Z" fill="${p.acc}"/>
      <path d="M36 28 L38 32 L40 27.6 M42 27.2 L44 31 L46 26.8" fill="#ffffff"/>
      <path d="M26 21 L33 20 L30 24 Z" fill="${p.hot}"/>
      <g fill="none" stroke="${p.acc}" stroke-width="2.5" stroke-linecap="round"><path d="M52 28 A8 8 0 0 1 52 40"/><path d="M57 23 A14 14 0 0 1 57 45"/></g>`],
    titan_bastion: ['gold', p => `
      <path d="M8 22 L32 8 L56 22 Z" fill="${p.fg}"/>
      <rect x="8" y="22" width="48" height="4" fill="${p.acc}"/>
      ${[13, 24, 35, 46].map(x => `<rect x="${x}" y="27" width="5" height="22" fill="${p.fg}"/>`).join('')}
      <rect x="6" y="49" width="52" height="5" rx="1" fill="${p.acc}"/>
      <rect x="4" y="54" width="56" height="4" rx="1" fill="${p.fg}"/>`],
    blood_rage: ['blood', p => `
      <path d="M32 8 C32 8 16 29 16 40 A16 16 0 0 0 48 40 C48 29 32 8 32 8 Z" fill="${p.acc}"/>
      <path d="M24 40 A8 8 0 0 0 30 48" stroke="${p.fg}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      ${rays(32, 36, 22, 28, 8, p.fg, 2.5, Math.PI / 8)}`],
    iron_fortress: ['steel', p => `
      <path d="M12 56 V24 H18 V17 H25 V24 H28.5 V17 H35.5 V24 H39 V17 H46 V24 H52 V56 Z" fill="${p.fg}" stroke="${p.acc}" stroke-width="2"/>
      <path d="M26 56 V44 A6 6 0 0 1 38 44 V56 Z" fill="#1e293b"/>
      <rect x="18" y="31" width="5" height="7" fill="#1e293b"/><rect x="41" y="31" width="5" height="7" fill="#1e293b"/>`],
    war_stomp: ['bolt', p => `
      <ellipse cx="32" cy="52" rx="24" ry="6" fill="none" stroke="${p.acc}" stroke-width="2.5"/>
      <ellipse cx="32" cy="52" rx="14" ry="3.5" fill="none" stroke="${p.fg}" stroke-width="2"/>
      ${bolt(p.fg, 'translate(32 28) scale(0.8) translate(-32 -32)')}`],
    colossus_strike: ['gold', p => `
      ${star(32, 50, 12, 5, 8, p.acc)}
      ${sword(p, 'rotate(180 32 32) translate(0 6)')}`],
    meteor_dive: ['fire', p => `
      <g stroke-linecap="round"><line x1="56" y1="6" x2="30" y2="32" stroke="${p.acc}" stroke-width="7"/><line x1="50" y1="4" x2="34" y2="20" stroke="${p.fg}" stroke-width="3"/><line x1="60" y1="14" x2="44" y2="30" stroke="${p.fg}" stroke-width="3"/></g>
      <circle cx="24" cy="40" r="13" fill="${p.acc}"/><circle cx="21" cy="37" r="6" fill="${p.hot}"/>
      <path d="M6 58 H58" stroke="${p.fg}" stroke-width="2.5" stroke-linecap="round"/>`],
    bladestorm_frenzy: ['steel', p => `
      <circle cx="32" cy="32" r="25" fill="none" stroke="${p.acc}" stroke-width="2" stroke-dasharray="6 5"/>
      ${[0, 120, 240].map(a => sword(p, `rotate(${a} 32 32) translate(32 32) scale(0.55) translate(-32 -32) translate(0 -22)`)).join('')}
      <circle cx="32" cy="32" r="4" fill="${p.hot}"/>`],
    sundering_cleave: ['earth', p => `
      <path d="M8 58 L20 46 L26 50 L36 38 L42 42 L56 28" stroke="${p.acc}" stroke-width="3" fill="none" stroke-linejoin="round"/>
      <line x1="18" y1="48" x2="44" y2="12" stroke="#7c4a24" stroke-width="4" stroke-linecap="round"/>
      <path d="M38 10 C46 4 56 10 56 20 C50 18 46 20 44 24 Z" fill="${p.fg}"/>`],
    ragnarok_slash: ['gold', p => `
      ${sword(p, 'rotate(-40 32 36) translate(32 36) scale(0.78) translate(-32 -32)')}
      ${sword(p, 'rotate(40 32 36) translate(32 36) scale(0.78) translate(-32 -32)')}
      <path d="M17 26 L20 10 L26 18 L32 7 L38 18 L44 10 L47 26 Z" fill="${p.acc}" stroke="${p.hot}" stroke-width="1.5"/>`],

    // ===== MAGE =====
    firestorm: ['fire', p => `
      <path d="M32 6 C38 18 48 22 46 38 A14 14 0 0 1 18 38 C16 28 24 24 26 16 C28 22 30 24 32 27 C34 20 34 12 32 6 Z" fill="${p.acc}"/>
      <path d="M32 26 C36 32 40 36 38 44 A6 6 0 0 1 26 44 C25 38 30 34 32 26 Z" fill="${p.hot}"/>`],
    frost_nova: ['ice', p => `
      <circle cx="32" cy="32" r="25" fill="none" stroke="${p.acc}" stroke-width="2.5"/>
      ${snowflake(p, 32, 32, 19, 3)}`],
    arcane_blink: ['arcane', p => `
      <circle cx="22" cy="36" r="11" fill="none" stroke="${p.acc}" stroke-width="2.5" stroke-dasharray="4 3"/>
      ${star(42, 26, 14, 4.5, 4, p.fg)}
      <circle cx="42" cy="26" r="3" fill="${p.hot}"/>`],
    chain_lightning: ['bolt', p => `
      <path d="M10 14 L24 26 L18 32 L36 40 L30 46 L54 54" stroke="${p.fg}" stroke-width="3.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="10" cy="14" r="4.5" fill="${p.acc}"/><circle cx="30" cy="34" r="4.5" fill="${p.acc}"/><circle cx="54" cy="54" r="4.5" fill="${p.acc}"/>`],
    mana_shield: ['arcane', p => `
      <path d="M32 6 L54 19 V45 L32 58 L10 45 V19 Z" fill="${p.acc}" fill-opacity="0.35" stroke="${p.fg}" stroke-width="2.5"/>
      ${star(32, 32, 13, 4, 4, p.hot)}`],
    pyroblast: ['fire', p => `
      <g stroke-linecap="round"><line x1="8" y1="56" x2="26" y2="38" stroke="${p.acc}" stroke-width="8" opacity="0.6"/><line x1="14" y1="58" x2="28" y2="44" stroke="${p.fg}" stroke-width="3"/></g>
      <circle cx="38" cy="26" r="16" fill="${p.acc}"/><circle cx="38" cy="26" r="9" fill="${p.hot}"/>
      ${rays(38, 26, 18, 23, 8, p.fg, 2)}`],
    blizzard: ['ice', p => `
      ${cloud(p)}
      <g stroke="${p.acc}" stroke-width="3" stroke-linecap="round"><line x1="20" y1="40" x2="16" y2="50"/><line x1="32" y1="40" x2="28" y2="56"/><line x1="44" y1="40" x2="40" y2="50"/></g>
      <circle cx="16" cy="55" r="2" fill="${p.fg}"/><circle cx="40" cy="55" r="2" fill="${p.fg}"/>`],
    black_hole: ['arcane', p => `
      <ellipse cx="32" cy="32" rx="26" ry="10" fill="none" stroke="${p.acc}" stroke-width="2.5" transform="rotate(-20 32 32)"/>
      <ellipse cx="32" cy="32" rx="19" ry="7" fill="none" stroke="${p.fg}" stroke-width="2" transform="rotate(-20 32 32)"/>
      <circle cx="32" cy="32" r="10" fill="#05030d" stroke="${p.hot}" stroke-width="2"/>`],
    thunder_storm: ['bolt', p => `
      ${cloud(p, '#64748b')}
      ${bolt(p.fg, 'translate(22 40) scale(0.5) translate(-32 -32)')}
      ${bolt(p.acc, 'translate(40 42) scale(0.55) translate(-32 -32)')}`],
    glacial_comet: ['ice', p => `
      <g stroke-linecap="round"><line x1="58" y1="6" x2="34" y2="30" stroke="${p.acc}" stroke-width="6" opacity="0.7"/><line x1="52" y1="4" x2="38" y2="18" stroke="${p.fg}" stroke-width="2.5"/></g>
      <path d="M24 22 L36 34 L28 54 L12 42 Z" fill="${p.fg}" stroke="${p.acc}" stroke-width="2"/>
      <path d="M24 22 L24 46 M12 42 L36 34" stroke="${p.acc}" stroke-width="1.5"/>`],
    arcane_hyperbeam: ['arcane', p => `
      <path d="M18 26 L60 20 V44 L18 38 Z" fill="${p.acc}" opacity="0.7"/>
      <path d="M18 29 L60 28 V36 L18 35 Z" fill="${p.hot}"/>
      <circle cx="16" cy="32" r="11" fill="${p.fg}"/><circle cx="16" cy="32" r="5" fill="${p.acc}"/>`],
    time_dilation: ['arcane', p => `
      <path d="M18 8 H46 M18 56 H46" stroke="${p.fg}" stroke-width="4" stroke-linecap="round"/>
      <path d="M21 10 C21 24 30 28 30 32 C30 36 21 40 21 54 H43 C43 40 34 36 34 32 C34 28 43 24 43 10 Z" fill="none" stroke="${p.fg}" stroke-width="2.5"/>
      <path d="M25 16 H39 C38 22 33 26 32 30 C31 26 26 22 25 16 Z" fill="${p.acc}"/>
      <path d="M32 40 L40 51 H24 Z" fill="${p.hot}"/>`],
    supernova_blast: ['fire', p => `
      ${star(32, 32, 28, 11, 12, p.acc)}
      ${star(32, 32, 17, 8, 8, p.hot)}
      <circle cx="32" cy="32" r="6" fill="#ffffff"/>`],
    genesis_cataclysm: ['gold', p => `
      ${rays(32, 32, 20, 28, 12, p.acc, 2.5)}
      <circle cx="32" cy="32" r="13" fill="${p.fg}"/>
      <ellipse cx="32" cy="32" rx="22" ry="6" fill="none" stroke="${p.hot}" stroke-width="2.5" transform="rotate(-25 32 32)"/>
      <circle cx="28" cy="28" r="4" fill="${p.hot}"/>`],

    // ===== ROGUE =====
    fan_of_knives: ['steel', p => `
      ${[-56, -28, 0, 28, 56].map(a => dagger(p, `rotate(${a} 32 54) translate(32 54) scale(0.75) translate(-32 -54)`)).join('')}`],
    shadow_dash: ['shadow', p => `
      <g stroke="${p.acc}" stroke-width="3" stroke-linecap="round"><line x1="6" y1="24" x2="22" y2="24"/><line x1="4" y1="34" x2="18" y2="34"/><line x1="8" y1="44" x2="22" y2="44"/></g>
      ${hood(p, 'translate(40 34) scale(0.62) translate(-32 -32)', 1)}
      ${hood(p, 'translate(28 34) scale(0.62) translate(-32 -32)', 0.35)}`],
    poison_darts: ['poison', p => `
      ${star(30, 28, 20, 6, 4, p.fg)}
      <circle cx="30" cy="28" r="4" fill="${p.bot || '#04140a'}" stroke="${p.acc}" stroke-width="2"/>
      <path d="M46 44 C46 44 40 52 40 55 A6 6 0 0 0 52 55 C52 52 46 44 46 44 Z" fill="${p.acc}"/>`],
    caltrops: ['steel', p => `
      ${star(18, 46, 10, 3, 4, p.fg)}${star(44, 48, 9, 3, 4, p.fg)}${star(32, 24, 11, 3.5, 4, p.fg)}
      <path d="M6 58 H58" stroke="${p.acc}" stroke-width="2" stroke-linecap="round"/>
      <path d="M44 22 C44 22 40 28 40 30 A4 4 0 0 0 48 30 C48 28 44 22 44 22 Z" fill="#ef4444"/>`],
    shadowstep: ['shadow', p => `
      ${hood(p, 'translate(34 34) scale(0.8) translate(-32 -32)', 1)}
      ${dagger(p, 'rotate(-35 32 32) translate(14 20) scale(0.6) translate(-32 -32)')}`],
    toxic_bomb: ['poison', p => `
      <circle cx="26" cy="38" r="15" fill="#1e293b" stroke="${p.acc}" stroke-width="2.5"/>
      <rect x="31" y="20" width="8" height="6" rx="1.5" fill="#475569" transform="rotate(35 35 23)"/>
      <path d="M38 18 C42 12 46 14 48 10" stroke="${p.fg}" stroke-width="2" fill="none"/>
      <circle cx="50" cy="8" r="3" fill="${p.hot}"/>
      <circle cx="46" cy="44" r="7" fill="${p.acc}" opacity="0.75"/><circle cx="52" cy="34" r="5" fill="${p.acc}" opacity="0.6"/>
      <circle cx="22" cy="34" r="4" fill="${p.acc}" opacity="0.5"/>`],
    smoke_screen: ['shadow', p => `
      <circle cx="22" cy="40" r="12" fill="#64748b"/><circle cx="40" cy="38" r="14" fill="#94a3b8"/>
      <circle cx="30" cy="26" r="12" fill="#cbd5e1"/><circle cx="46" cy="24" r="8" fill="#64748b" opacity="0.8"/>
      <rect x="10" y="48" width="44" height="8" rx="4" fill="#94a3b8"/>`],
    death_blossom: ['blood', p => `
      ${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path transform="rotate(${a} 32 32)" d="M32 6 L36 20 L32 28 L28 20 Z" fill="${a % 90 === 0 ? p.fg : p.acc}"/>`).join('')}
      <circle cx="32" cy="32" r="5" fill="${p.hot}"/>`],
    venomous_barrage: ['poison', p => `
      ${[18, 32, 46].map(y => `<g><line x1="10" y1="${y + 4}" x2="44" y2="${y - 6}" stroke="${p.fg}" stroke-width="2.5" stroke-linecap="round"/><path d="M44 ${y - 6} L54 ${y - 9} L46 ${y - 1} Z" fill="${p.acc}"/></g>`).join('')}
      <circle cx="14" cy="56" r="3" fill="${p.acc}"/>`],
    phantom_assassins: ['shadow', p => `
      ${hood(p, 'translate(22 34) scale(0.7) translate(-32 -32)', 0.45)}
      ${hood(p, 'translate(42 34) scale(0.7) translate(-32 -32)', 0.45)}
      ${hood(p, 'translate(32 36) scale(0.78) translate(-32 -32)', 1)}`],
    assassins_cull: ['blood', p => `
      <path d="M14 58 V10 H50 V58" fill="none" stroke="#8b5a2b" stroke-width="4"/>
      <path d="M16 16 H48 V26 L16 34 Z" fill="${p.fg}" stroke="${p.acc}" stroke-width="1.5"/>
      <path d="M32 40 C32 40 26 48 26 51 A6 6 0 0 0 38 51 C38 48 32 40 32 40 Z" fill="${p.acc}"/>`],
    abyssal_tether: ['shadow', p => `
      ${[0, 1, 2, 3].map(i => `<rect x="${10 + i * 11}" y="${42 - i * 10}" width="14" height="8" rx="4" fill="none" stroke="${i % 2 ? p.acc : p.fg}" stroke-width="3" transform="rotate(-40 ${17 + i * 11} ${46 - i * 10})"/>`).join('')}
      <circle cx="52" cy="12" r="5" fill="#05030d" stroke="${p.hot}" stroke-width="2"/>`],
    blade_dance: ['shadow', p => `
      <path d="M10 44 C20 20 44 52 54 24" fill="none" stroke="${p.hot}" stroke-width="2.5" stroke-dasharray="4 3"/>
      ${dagger(p, 'rotate(-30 32 32)')}
      ${dagger(p, 'rotate(30 32 32)')}`],
    eclipse_execution: ['shadow', p => `
      ${rays(32, 32, 20, 27, 16, p.acc, 2)}
      <circle cx="32" cy="32" r="17" fill="${p.hot}"/>
      <circle cx="36" cy="29" r="16" fill="#05030d"/>
      <path d="M12 52 L52 12 M12 12 L52 52" stroke="${p.fg}" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>`]
  };

  // --- Passive talent glyphs ---
  // Re-use an active skill glyph with a different element palette
  const alias = (id, palette) => [palette || GLYPHS[id][0], GLYPHS[id][1]];
  const drop = (fill, t) => `<path transform="${t || ''}" d="M32 8 C32 8 16 29 16 40 A16 16 0 0 0 48 40 C48 29 32 8 32 8 Z" fill="${fill}"/>`;
  const heart = fill => `<path d="M32 54 C14 42 8 32 8 23 A12 12 0 0 1 32 17 A12 12 0 0 1 56 23 C56 32 50 42 32 54 Z" fill="${fill}"/>`;
  const shield = (p, t) => `<path transform="${t || ''}" d="M32 8 L51 15 V30 C51 43 42 51 32 57 C22 51 13 43 13 30 V15 Z" fill="${p.fg}" stroke="${p.acc}" stroke-width="2.5"/>`;
  const crown = p => `<path d="M10 46 L14 18 L24 30 L32 12 L40 30 L50 18 L54 46 Z" fill="${p.acc}" stroke="${p.hot}" stroke-width="2"/>
      <rect x="10" y="46" width="44" height="7" rx="2" fill="${p.fg}"/>
      <circle cx="32" cy="36" r="3.5" fill="${p.hot}"/>`;

  Object.assign(GLYPHS, {
    // ===== WARRIOR TALENTS =====
    iron_skin: ['steel', p => `${shield(p)}<path d="M20 26 H44 M20 34 H44 M22 42 H42" stroke="${p.acc}" stroke-width="2.5" stroke-linecap="round"/>`],
    hardened_carapace: ['steel', p => `
      <path d="M12 40 C12 22 20 10 32 10 C44 10 52 22 52 40 V50 H40 V38 H24 V50 H12 Z" fill="${p.fg}" stroke="${p.acc}" stroke-width="2"/>
      <rect x="29.5" y="30" width="5" height="18" fill="${p.acc}"/>
      <path d="M32 10 V22" stroke="${p.acc}" stroke-width="2.5"/>`],
    titan_vitality: ['blood', p => `${heart(p.acc)}<path d="M14 32 H24 L28 24 L34 40 L38 30 H50" stroke="${p.fg}" stroke-width="2.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`],
    unyielding_thorns: ['steel', p => `${star(32, 32, 28, 18, 12, p.acc)}${shield(p, 'translate(32 33) scale(0.7) translate(-32 -32)')}`],
    iron_fortress_mastery: alias('iron_fortress', 'gold'),
    colossus_avatar: ['gold', p => `
      ${rays(32, 30, 22, 28, 10, p.acc, 2.5)}
      <path d="M16 36 C16 20 22 12 32 12 C42 12 48 20 48 36 V48 H38 V36 H26 V48 H16 Z" fill="${p.fg}"/>
      <rect x="22" y="26" width="7" height="3" fill="#1c1004"/><rect x="35" y="26" width="7" height="3" fill="#1c1004"/>
      <rect x="12" y="48" width="40" height="6" rx="2" fill="${p.acc}"/>`],
    blade_mastery: ['steel', p => sword(p)],
    sweeping_fury: ['steel', p => `
      <path d="M8 44 A28 28 0 0 1 56 20" fill="none" stroke="${p.acc}" stroke-width="5" stroke-linecap="round"/>
      <path d="M14 50 A26 26 0 0 1 54 30" fill="none" stroke="${p.fg}" stroke-width="2.5" stroke-linecap="round"/>
      ${sword(p, 'rotate(50 32 32) translate(32 32) scale(0.7) translate(-32 -32)')}`],
    flurry_cadence: ['bolt', p => `${sword(p, 'rotate(-30 32 32) translate(32 32) scale(0.8) translate(-32 -32)')}${bolt(p.acc, 'translate(44 40) scale(0.45) translate(-32 -32)')}`],
    cyclone_cleave: alias('whirlwind'),
    razor_tempest: alias('bladestorm_frenzy', 'bolt'),
    blade_singularity: ['arcane', p => `
      <circle cx="32" cy="32" r="24" fill="none" stroke="${p.acc}" stroke-width="2.5"/>
      <circle cx="32" cy="32" r="16" fill="none" stroke="${p.fg}" stroke-width="1.5" stroke-dasharray="3 3"/>
      ${sword(p, 'translate(32 32) scale(0.8) translate(-32 -32)')}`],
    brutal_might: ['blood', p => `${star(32, 32, 27, 12, 10, p.acc)}${star(32, 32, 15, 7, 10, p.hot)}`],
    sundering_dash: alias('blade_charge', 'blood'),
    seismic_shatter: alias('earthshaker'),
    bloodlust_frenzy: alias('blood_rage'),
    executioner_strike: alias('sundering_cleave', 'blood'),
    warlord_supremacy: ['gold', p => crown(p)],

    // ===== MAGE TALENTS =====
    infernal_touch: alias('firestorm'),
    conflagration: alias('pyroblast'),
    infernal_cataclysm: ['fire', p => `
      <path d="M6 56 L24 24 H40 L58 56 Z" fill="#44403c"/>
      <path d="M24 24 L28 34 L32 28 L36 36 L40 24 Z" fill="${p.acc}"/>
      <path d="M30 30 L28 44 M34 32 L37 46" stroke="${p.acc}" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="24" cy="12" r="5" fill="${p.acc}"/><circle cx="36" cy="8" r="4" fill="${p.hot}"/><circle cx="44" cy="15" r="3" fill="${p.acc}"/>`],
    pyroblast_focus: ['fire', p => `
      <circle cx="32" cy="32" r="24" fill="none" stroke="${p.fg}" stroke-width="2"/>
      <path d="M32 4 V14 M32 50 V60 M4 32 H14 M50 32 H60" stroke="${p.fg}" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="32" cy="32" r="12" fill="${p.acc}"/><circle cx="32" cy="32" r="6" fill="${p.hot}"/>`],
    pyromaniac_celerity: ['fire', p => bolt(p.acc) + bolt(p.hot, 'translate(32 32) scale(0.55) translate(-32 -32)')],
    phoenix_avatar: ['fire', p => `
      <path d="M32 50 C24 40 14 38 4 22 C16 26 22 26 28 32 C26 22 28 14 32 8 C36 14 38 22 36 32 C42 26 48 26 60 22 C50 38 40 40 32 50 Z" fill="${p.acc}"/>
      <path d="M32 50 L26 60 M32 50 L32 61 M32 50 L38 60" stroke="${p.fg}" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="32" cy="26" r="4" fill="${p.hot}"/>`],
    frost_shroud: alias('frost_nova'),
    glacial_tomb: ['ice', p => `
      <path d="M32 6 L54 18 V44 L32 58 L10 44 V18 Z" fill="${p.acc}" fill-opacity="0.45" stroke="${p.fg}" stroke-width="2.5"/>
      <path d="M32 6 V32 L54 18 M32 32 L10 18 M32 32 V58" stroke="${p.fg}" stroke-width="1.6" fill="none"/>
      <path d="M18 24 L24 28" stroke="${p.hot}" stroke-width="2.5" stroke-linecap="round"/>`],
    absolute_zero: alias('blizzard'),
    mana_shield_fortress: alias('mana_shield', 'ice'),
    shatter_strike: ['ice', p => `
      <path d="M32 8 L44 22 L36 30 Z M46 26 L56 36 L40 38 Z M38 42 L44 56 L30 48 Z M26 44 L14 52 L20 38 Z M16 32 L8 22 L26 26 Z" fill="${p.fg}" stroke="${p.acc}" stroke-width="1.5"/>
      <circle cx="31" cy="34" r="4" fill="${p.hot}"/>`],
    permafrost_ascendance: ['ice', p => `
      <path d="M4 56 L24 18 L32 30 L40 22 L60 56 Z" fill="${p.acc}"/>
      <path d="M24 18 L30 30 L26 32 L22 28 L18 30 Z M40 22 L45 32 L41 34 L37 30 Z" fill="${p.hot}"/>
      ${star(50, 12, 6, 2, 4, p.fg)}`],
    arcane_intellect: ['arcane', p => `
      <path d="M8 16 C16 12 26 12 32 18 C38 12 48 12 56 16 V50 C48 46 38 46 32 52 C26 46 16 46 8 50 Z" fill="${p.fg}"/>
      <path d="M32 18 V52" stroke="${p.acc}" stroke-width="2.5"/>
      <path d="M14 24 H26 M14 30 H26 M38 24 H50 M38 30 H50 M38 36 H48" stroke="${p.acc}" stroke-width="1.8" stroke-linecap="round"/>
      ${star(20, 39, 5, 1.8, 4, p.acc)}`],
    mana_surge: ['arcane', p => `${drop(p.acc)}<path d="M24 40 A8 8 0 0 0 30 48" stroke="${p.hot}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M50 8 V20 M44 14 H56" stroke="${p.fg}" stroke-width="2.5" stroke-linecap="round"/>`],
    arcane_haste: alias('arcane_blink'),
    astral_overload: ['arcane', p => `
      <path d="M20 52 H44 L40 46 H24 Z" fill="#8b5a2b"/>
      <circle cx="32" cy="28" r="18" fill="${p.acc}" fill-opacity="0.8" stroke="${p.fg}" stroke-width="2"/>
      ${star(32, 28, 9, 3, 4, p.hot)}
      <circle cx="24" cy="20" r="3" fill="#ffffff" opacity="0.8"/>`],
    singularity_collapse: alias('black_hole'),
    cosmic_ascension: alias('genesis_cataclysm', 'arcane'),

    // ===== ROGUE TALENTS =====
    deadly_precision: ['blood', p => `
      <circle cx="32" cy="32" r="22" fill="none" stroke="${p.fg}" stroke-width="3"/>
      <circle cx="32" cy="32" r="12" fill="none" stroke="${p.acc}" stroke-width="3"/>
      <path d="M32 4 V18 M32 46 V60 M4 32 H18 M46 32 H60" stroke="${p.fg}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="32" cy="32" r="3.5" fill="${p.hot}"/>`],
    lethal_ambush: ['shadow', p => dagger(p, 'rotate(-20 32 32) translate(32 32) scale(1.15) translate(-32 -32)') + star(48, 14, 7, 2.5, 4, p.hot)],
    shadowstep_strike: alias('shadowstep'),
    death_blossom_flurry: alias('death_blossom'),
    assassin_momentum: alias('shadow_dash'),
    master_of_shadows: ['shadow', p => `
      <circle cx="32" cy="32" r="26" fill="${p.acc}" opacity="0.35"/>
      ${hood(p, 'translate(32 34) scale(0.85) translate(-32 -32)', 1)}`],
    toxic_potency: ['poison', p => `
      <rect x="26" y="6" width="12" height="6" rx="2" fill="#8b5a2b"/>
      <path d="M27 12 H37 V24 L50 48 A6 6 0 0 1 45 57 H19 A6 6 0 0 1 14 48 L27 24 Z" fill="${p.fg}" fill-opacity="0.3" stroke="${p.fg}" stroke-width="2.5"/>
      <path d="M20 40 H44 L49 49 A4 4 0 0 1 45 54 H19 A4 4 0 0 1 15 49 Z" fill="${p.acc}"/>
      <circle cx="28" cy="46" r="2.5" fill="${p.hot}"/><circle cx="36" cy="49" r="1.8" fill="${p.hot}"/>`],
    venomous_knives: alias('fan_of_knives', 'poison'),
    noxious_cloud: ['poison', p => `
      ${cloud(p, p.acc)}
      <circle cx="22" cy="44" r="4" fill="${p.acc}" opacity="0.7"/><circle cx="34" cy="48" r="5" fill="${p.acc}" opacity="0.6"/><circle cx="46" cy="44" r="3.5" fill="${p.acc}" opacity="0.7"/>
      <circle cx="26" cy="27" r="2.5" fill="${p.hot}"/><circle cx="38" cy="25" r="2.5" fill="${p.hot}"/>`],
    barbed_caltrops_trap: alias('caltrops', 'poison'),
    corrosive_venom: ['poison', p => `${drop(p.acc)}<path d="M18 56 C22 50 26 58 32 54 C38 50 42 58 46 54" stroke="${p.fg}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <circle cx="28" cy="38" r="3" fill="${p.hot}"/>`],
    epidemic_catalyst: ['poison', p => `
      ${[0, 120, 240].map(a => `<circle cx="32" cy="17" r="11" fill="none" stroke="${p.acc}" stroke-width="5" transform="rotate(${a} 32 34)"/>`).join('')}
      <circle cx="32" cy="34" r="7" fill="${p.fg}"/><circle cx="32" cy="34" r="3" fill="#04140a"/>`],
    fleet_footwork: ['steel', p => `
      <path d="M18 10 H32 V36 L50 42 A6 6 0 0 1 54 48 V52 H14 V40 Z" fill="${p.fg}" stroke="${p.acc}" stroke-width="2"/>
      <rect x="14" y="52" width="40" height="4" rx="2" fill="${p.acc}"/>
      <path d="M32 18 L48 10 L44 18 L56 16 L46 26 L32 28" fill="${p.hot}" stroke="${p.acc}" stroke-width="1.2"/>`],
    wind_flurry: ['poison', p => `
      <g fill="none" stroke="${p.fg}" stroke-width="3" stroke-linecap="round">
        <path d="M8 22 H40 A7 7 0 1 0 33 15"/><path d="M8 34 H50 A7 7 0 1 1 43 41"/><path d="M14 46 H30 A5 5 0 1 1 25 51"/></g>`],
    sweeping_daggers: alias('blade_dance', 'steel'),
    shadow_sprint_haste: ['shadow', p => bolt(p.acc) + `<g stroke="${p.fg}" stroke-width="3" stroke-linecap="round"><line x1="6" y1="22" x2="18" y2="22"/><line x1="4" y1="32" x2="16" y2="32"/><line x1="6" y1="42" x2="18" y2="42"/></g>`],
    evasive_reflexes: ['poison', p => `
      <path d="M14 52 C10 30 26 10 52 10 C54 34 38 52 14 52 Z" fill="${p.acc}"/>
      <path d="M14 52 L44 20 M26 40 L24 30 M34 32 L40 34" stroke="${p.fg}" stroke-width="2" stroke-linecap="round"/>`],
    phantom_duelist: ['shadow', p => `
      <path d="M12 14 C24 8 40 8 52 14 V30 C52 46 42 56 32 56 C22 56 12 46 12 30 Z" fill="${p.fg}"/>
      <path d="M18 26 L28 24 L26 30 Z M46 26 L36 24 L38 30 Z" fill="#0b0a1f"/>
      <path d="M22 42 C28 48 36 48 42 42" stroke="#0b0a1f" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M32 8 V56" stroke="${p.acc}" stroke-width="1.5" opacity="0.6"/>`]
  });

  // ---- SP card skills: palette from the card, glyph from the skill's shape,
  // and a small class emblem (sword / orb / dagger) in the corner ----
  const SP_SHAPE_GLYPHS = {
    nova: p => star(32, 30, 24, 9, 8, p.fg) + `<circle cx="32" cy="30" r="6" fill="${p.hot}"/>`,
    buff: p => `<path d="M32 8 L52 16 V32 C52 44 43 52 32 56 C21 52 12 44 12 32 V16 Z" fill="${p.fg}" stroke="${p.acc}" stroke-width="2"/>
      <path d="M32 20 V44 M20 32 H44" stroke="${p.acc}" stroke-width="5" stroke-linecap="round"/>`,
    blast: p => `<circle cx="32" cy="38" r="16" fill="none" stroke="${p.acc}" stroke-width="3"/><circle cx="32" cy="38" r="7" fill="${p.fg}"/>
      <path d="M32 6 V26 M25 19 L32 26 L39 19" stroke="${p.hot}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    pull: p => `<path d="M32 32 m0 -3 a3 3 0 1 1 -3 3 a7 7 0 0 1 10 -6 a11 11 0 0 1 -2 18 a16 16 0 0 1 -20 -12 a20 20 0 0 1 22 -20"
      fill="none" stroke="${p.fg}" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="32" r="3" fill="${p.hot}"/>`,
    rain: p => `<g stroke="${p.fg}" stroke-width="4" stroke-linecap="round"><line x1="18" y1="8" x2="12" y2="26"/><line x1="36" y1="6" x2="30" y2="24"/><line x1="52" y1="12" x2="46" y2="30"/></g>
      <g fill="${p.hot}"><circle cx="12" cy="40" r="4"/><circle cx="30" cy="48" r="5"/><circle cx="46" cy="42" r="4"/></g>`,
    cone: p => `<path d="M32 56 L10 14 A30 30 0 0 1 54 14 Z" fill="${p.fg}" opacity="0.9"/><path d="M32 56 L22 20 M32 56 V16 M32 56 L42 20" stroke="${p.acc}" stroke-width="2.5"/>`,
    line: p => `<path d="M8 44 L48 12 L56 20 L16 52 Z" fill="${p.fg}"/><path d="M12 48 L52 16" stroke="${p.hot}" stroke-width="3" stroke-linecap="round"/>`,
    strike: p => `<path d="M12 52 C24 30 34 18 54 8 C46 26 34 40 12 52 Z" fill="${p.fg}"/>` + star(46, 46, 10, 4, 4, p.hot),
    volley: p => [12, 28, 44].map(y => `<g transform="translate(0 ${y - 28})"><path d="M8 28 H44" stroke="${p.fg}" stroke-width="4" stroke-linecap="round"/><path d="M42 20 L56 28 L42 36 Z" fill="${p.acc}"/></g>`).join(''),
    chain: p => `<path d="M12 48 L28 18 L40 40 L54 12" fill="none" stroke="${p.fg}" stroke-width="4" stroke-linejoin="round"/>
      ${[[12, 48], [28, 18], [40, 40], [54, 12]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${p.hot}" stroke="${p.acc}" stroke-width="2"/>`).join('')}`,
    pulse: p => `<circle cx="32" cy="32" r="22" fill="none" stroke="${p.acc}" stroke-width="3"/><circle cx="32" cy="32" r="14" fill="none" stroke="${p.fg}" stroke-width="4"/><circle cx="32" cy="32" r="6" fill="${p.hot}"/>`,
    dash: p => `<path d="M20 22 H40 V12 L58 32 L40 52 V42 H20 Z" fill="${p.fg}"/><g stroke="${p.acc}" stroke-width="3" stroke-linecap="round"><line x1="6" y1="24" x2="14" y2="24"/><line x1="4" y1="32" x2="14" y2="32"/><line x1="6" y1="40" x2="14" y2="40"/></g>`,
    // toggled blood aura: a drop inside a dashed ring
    aura: p => `<circle cx="32" cy="32" r="23" fill="none" stroke="${p.acc}" stroke-width="3" stroke-dasharray="7 5"/>
      <path d="M32 12 C40 24 46 31 46 39 A14 14 0 0 1 18 39 C18 31 24 24 32 12 Z" fill="${p.fg}" stroke="${p.acc}" stroke-width="2"/>
      <ellipse cx="27" cy="38" rx="3" ry="5" fill="${p.hot}"/>`,
    // toggled thunderhead: a storm cloud with bolts dropping out of it
    cloud: p => `<path d="M14 30 A9 9 0 0 1 22 18 A12 12 0 0 1 44 16 A9 9 0 0 1 52 30 Z" fill="${p.fg}" stroke="${p.acc}" stroke-width="2"/>
      <path d="M22 34 L18 44 L24 44 L20 56 M40 34 L36 44 L42 44 L38 56" fill="none" stroke="${p.hot}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`,
    // two storm orbs flying forward, sparks around each
    orbs: p => [[20, 40], [42, 22]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="12" fill="none" stroke="${p.acc}" stroke-width="2" stroke-dasharray="3 3"/><circle cx="${x}" cy="${y}" r="7" fill="${p.fg}"/><circle cx="${x - 2}" cy="${y - 2}" r="2.5" fill="${p.hot}"/>`).join('')
      + `<path d="M6 58 L14 50 M28 58 L36 48" stroke="${p.acc}" stroke-width="2.5" stroke-linecap="round"/>`,
    // toggled blade spin: two swords crossed over swirling arcs
    whirl: p => `<path d="M10 30 A22 22 0 0 1 46 12 M54 34 A22 22 0 0 1 18 52" fill="none" stroke="${p.acc}" stroke-width="4" stroke-linecap="round"/>
      <path d="M46 6 L50 16 L40 14 Z M18 58 L14 48 L24 50 Z" fill="${p.acc}"/>
      <path d="M16 16 L44 44 M48 16 L20 44" stroke="${p.fg}" stroke-width="5" stroke-linecap="round"/>
      <path d="M40 48 L48 40 M16 40 L24 48" stroke="${p.hot}" stroke-width="4" stroke-linecap="round"/>`,
    blink: p => `<circle cx="16" cy="44" r="9" fill="none" stroke="${p.fg}" stroke-width="3" stroke-dasharray="4 3"/><circle cx="48" cy="18" r="10" fill="${p.fg}"/>
      <path d="M22 36 Q28 16 40 18" fill="none" stroke="${p.hot}" stroke-width="3" stroke-dasharray="3 4" stroke-linecap="round"/>`,
    // Nightblade: a fan of throwing stars with a return arrow
    shuriken: p => star(20, 42, 12, 4, 4, p.fg) + star(44, 20, 12, 4, 4, p.fg) + star(44, 46, 8, 3, 4, p.acc)
      + `<path d="M14 22 Q20 8 34 10" fill="none" stroke="${p.hot}" stroke-width="3" stroke-linecap="round"/><path d="M14 14 L13 23 L22 22" fill="none" stroke="${p.hot}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
    smoke: p => `<g fill="${p.fg}"><circle cx="20" cy="38" r="11"/><circle cx="34" cy="30" r="13"/><circle cx="46" cy="40" r="10"/><rect x="18" y="38" width="30" height="12" rx="6"/></g>
      <circle cx="32" cy="14" r="6" fill="${p.acc}"/><path d="M36 10 L42 4" stroke="${p.hot}" stroke-width="3" stroke-linecap="round"/>`,
    shadow: p => `<path d="M18 52 C16 36 20 28 24 24 A7 7 0 1 1 32 24 C36 28 40 36 38 52 Z" fill="${p.fg}" opacity="0.55" stroke="${p.acc}" stroke-width="2"/>
      <path d="M36 50 L54 18" stroke="${p.hot}" stroke-width="3" stroke-dasharray="4 4" stroke-linecap="round"/>` + star(54, 16, 7, 2.5, 4, p.hot),
    orbit: p => `<circle cx="32" cy="32" r="18" fill="none" stroke="${p.acc}" stroke-width="2.5" stroke-dasharray="6 5"/>`
      + star(32, 14, 8, 3, 4, p.fg) + star(48, 41, 8, 3, 4, p.fg) + star(16, 41, 8, 3, 4, p.fg) + `<circle cx="32" cy="32" r="5" fill="${p.hot}"/>`
  };
  const SP_EMBLEMS = {
    warrior: p => `<path d="M50 44 L53 47 L46 54 L43 51 Z M41 53 L48 60 M44 50 L51 57" stroke="${p.hot}" stroke-width="2" fill="${p.hot}"/>`,
    mage: p => `<circle cx="51" cy="51" r="5" fill="${p.hot}" stroke="${p.acc}" stroke-width="1.5"/><circle cx="49" cy="49" r="1.6" fill="#ffffff"/>`,
    rogue: p => `<path d="M56 44 L52 54 L49 51 Z" fill="${p.hot}"/><path d="M49 51 L45 56" stroke="${p.hot}" stroke-width="2.5" stroke-linecap="round"/>`
  };
  // skill id -> [palette, shape, class]
  const SP_ICONS = {};
  const spKit = (palette, cls, kit) => Object.entries(kit).forEach(([id, shape]) => { SP_ICONS[id] = [palette, shape, cls]; });
  spKit('gold', 'warrior', { sp_holy_cleave: 'cone', sp_judgement: 'blast', sp_sanctuary: 'buff', sp_divine_charge: 'dash' });
  spKit('blood', 'warrior', { sp_crimson_aura: 'aura', sp_bloodlust: 'buff', sp_blade_whirl: 'whirl', sp_crimson_rush: 'dash' });
  spKit('ice', 'warrior', { sp_glacier_strike: 'strike', sp_winter_ward: 'buff', sp_avalanche: 'rain', sp_ice_glide: 'dash' });
  spKit('bolt', 'warrior', { sp_thunderhead: 'cloud', sp_arc_conduit: 'chain', sp_storm_orbs: 'orbs', sp_lightning_rush: 'blink' });
  spKit('shadow', 'warrior', { sp_abyss_cleave: 'line', sp_void_grasp: 'pull', sp_soul_bastion: 'pulse', sp_shadow_charge: 'dash' });
  spKit('fire', 'mage', { sp_flame_wave: 'cone', sp_ember_volley: 'volley', sp_sunburst: 'pulse', sp_flame_step: 'dash' });
  spKit('ice', 'mage', { sp_ice_lance: 'line', sp_frozen_orb: 'pulse', sp_permafrost: 'nova', sp_ice_blink: 'blink' });
  spKit('bolt', 'mage', { sp_arc_bolt: 'strike', sp_static_field: 'volley', sp_storm_lance: 'line', sp_static_blink: 'blink' });
  spKit('arcane', 'mage', { sp_time_warp: 'blast', sp_temporal_ward: 'buff', sp_dawn_rain: 'rain', sp_phase_shift: 'blink' });
  spKit('shadow', 'mage', { sp_event_horizon: 'pull', sp_void_volley: 'volley', sp_void_ray: 'line', sp_rift_walk: 'blink' });
  spKit('shadow', 'rogue', { sp_phantom_shuriken: 'shuriken', sp_smoke_bomb: 'smoke', sp_shadow_toss: 'shadow', sp_night_dash: 'dash' });
  spKit('poison', 'rogue', { sp_plague_breath: 'cone', sp_venom_rain: 'rain', sp_viper_nest: 'pulse', sp_serpent_slip: 'blink' });
  spKit('bolt', 'rogue', { sp_storm_waltz: 'pulse', sp_knife_storm: 'volley', sp_mirror_dance: 'chain', sp_flash_step: 'dash' });
  spKit('ice', 'rogue', { sp_frozen_execution: 'strike', sp_shatter: 'nova', sp_ice_spikes: 'line', sp_cold_step: 'blink' });
  spKit('blood', 'rogue', { sp_total_eclipse: 'strike', sp_blood_tether: 'volley', sp_crimson_bloom: 'nova', sp_reaper_step: 'dash' });
  // arsenal extras
  spKit('gold', 'warrior', { sp_radiant_lance: 'line', sp_consecration: 'pulse', sp_halo_burst: 'nova', sp_angel_step: 'blink' });
  spKit('blood', 'warrior', { sp_twin_rend: 'cone', sp_exsanguinate: 'nova', sp_crimson_cross: 'line', sp_blood_leap: 'blink' });
  spKit('ice', 'warrior', { sp_frost_lance: 'line', sp_hail_shards: 'volley', sp_glacial_prison: 'pull', sp_frost_vault: 'blink' });
  spKit('bolt', 'warrior', { sp_thunder_spear: 'line', sp_static_cleave: 'cone', sp_storm_aegis: 'buff', sp_storm_dash: 'dash' });
  spKit('shadow', 'warrior', { sp_soul_rend: 'strike', sp_dread_wave: 'cone', sp_grave_rain: 'rain', sp_void_step: 'blink' });
  spKit('fire', 'mage', { sp_meteor_call: 'blast', sp_fire_chain: 'chain', sp_cinder_rain: 'rain', sp_phoenix_blink: 'blink' });
  spKit('ice', 'mage', { sp_ice_shards: 'volley', sp_frost_cone: 'cone', sp_glacial_pull: 'pull', sp_frost_slide: 'dash' });
  spKit('bolt', 'mage', { sp_ball_lightning: 'pulse', sp_thunder_nova: 'nova', sp_spark_rain: 'rain', sp_storm_surge: 'dash' });
  spKit('arcane', 'mage', { sp_rewind: 'nova', sp_chrono_lance: 'line', sp_stasis_field: 'pulse', sp_time_skip: 'dash' });
  spKit('shadow', 'mage', { sp_dark_nova: 'nova', sp_shadow_chain: 'chain', sp_oblivion_rain: 'rain', sp_void_dash: 'dash' });
  spKit('shadow', 'rogue', { sp_shuriken_storm: 'orbit', sp_moon_volley: 'volley', sp_night_fang: 'strike', sp_shadow_hop: 'blink' });
  spKit('poison', 'rogue', { sp_toxic_lance: 'line', sp_plague_chain: 'chain', sp_miasma: 'buff', sp_venom_dash: 'dash' });
  spKit('bolt', 'rogue', { sp_whirling_edge: 'cone', sp_lightning_lunge: 'strike', sp_blade_tempest: 'rain', sp_spark_blink: 'blink' });
  spKit('ice', 'rogue', { sp_frost_daggers: 'volley', sp_cold_snap: 'blast', sp_frozen_veil: 'buff', sp_ice_slide: 'dash' });
  spKit('blood', 'rogue', { sp_reaper_scythe: 'cone', sp_black_sun: 'blast', sp_harvest: 'pull', sp_crimson_blink: 'blink' });
  // weapon abilities (right click): palette from the weapon's element
  spKit('steel', 'warrior', { wpn_iron_blade: 'strike', wpn_iron_morningstar: 'blast' });
  spKit('earth', 'warrior', { wpn_sweeping_claymore: 'cone', wpn_woodsman_axe: 'blast' });
  spKit('fire', 'warrior', { wpn_inferno_blade: 'line', wpn_dragonbone_glaive: 'cone' });
  spKit('bolt', 'warrior', { wpn_storm_breaker: 'nova', wpn_thunder_maul: 'pulse' });
  spKit('gold', 'warrior', { wpn_excalibur: 'line' });
  spKit('fire', 'mage', { wpn_archmage_staff: 'blast' });
  spKit('ice', 'mage', { wpn_glacial_spire: 'pull' });
  spKit('shadow', 'mage', { wpn_voidcaller_wand: 'volley' });
  spKit('gold', 'mage', { wpn_dawn_scepter: 'buff' });
  spKit('shadow', 'rogue', { wpn_shadow_daggers: 'strike' });
  spKit('bolt', 'rogue', { wpn_wind_rapier: 'dash' });
  spKit('steel', 'rogue', { wpn_hunter_spear: 'line' });
  spKit('ice', 'rogue', { wpn_frostbite_katana: 'dash' });
  spKit('poison', 'rogue', { wpn_venom_kris: 'strike' });
  spKit('fire', 'rogue', { wpn_ember_scythe: 'nova' });
  for (const [id, [palette, shape, cls]] of Object.entries(SP_ICONS)) {
    GLYPHS[id] = [palette, p => SP_SHAPE_GLYPHS[shape](p) + SP_EMBLEMS[cls](p)];
  }

  // Bespoke Dread Lord (Colossal Black-Violet Executioner Axe) skill icons
  Object.assign(GLYPHS, {
    // Q: Abyssal Guillotine — Colossal executioner axe splitting the ground with a crimson-violet chasm
    sp_abyss_cleave: ['dread', p => `
      <path d="M8 58 L32 30 L56 58 Z" fill="#1e0538" stroke="${p.acc}" stroke-width="3"/>
      <path d="M32 6 L32 58" stroke="${p.hot}" stroke-width="6" stroke-linecap="round"/>
      <path d="M32 8 C8 8 4 30 14 42 C22 34 27 30 32 30 Z" fill="#140726" stroke="${p.fg}" stroke-width="3.5"/>
      <path d="M32 8 C56 8 60 30 50 42 C42 34 37 30 32 30 Z" fill="${p.acc}" stroke="${p.fg}" stroke-width="3.5"/>
      <circle cx="32" cy="22" r="6" fill="${p.hot}" stroke="#ffffff" stroke-width="2.5"/>`],

    // E: Mocking Dread Roar — Horned Abyssal Dread Skull roaring crimson shockwaves
    sp_void_grasp: ['dread', p => `
      <circle cx="32" cy="34" r="24" fill="none" stroke="${p.hot}" stroke-width="3.5" stroke-dasharray="7 4"/>
      <path d="M18 24 L6 8 L24 16 Z M46 24 L58 8 L40 16 Z" fill="#fde047" stroke="${p.fg}" stroke-width="2"/>
      <path d="M18 22 C18 10 46 10 46 22 L44 40 L36 48 H28 L20 40 Z" fill="#130524" stroke="${p.fg}" stroke-width="3.5"/>
      <circle cx="26" cy="28" r="4.5" fill="${p.hot}"/>
      <circle cx="38" cy="28" r="4.5" fill="${p.hot}"/>
      <rect x="24" y="39" width="16" height="8" fill="#ffffff"/>`],

    // R: Undying Dread Rage — Immortal horned dread helm engulfed in blood-crimson & gold undying fury flames
    sp_soul_bastion: ['dread', p => `
      <path d="M10 56 C6 34 14 14 32 4 C50 14 58 34 54 56 Z" fill="${p.hot}"/>
      <path d="M16 56 C14 38 20 20 32 12 C44 20 50 38 48 56 Z" fill="#fde047"/>
      <path d="M18 26 L6 10 L24 20 Z M46 26 L58 10 L40 20 Z" fill="${p.fg}"/>
      <path d="M18 24 H46 L44 50 L32 58 L20 50 Z" fill="#0f041d" stroke="${p.fg}" stroke-width="3.5"/>
      <path d="M21 34 L31 38 L23 42 Z M43 34 L33 38 L41 42 Z" fill="${p.hot}"/>`],

    // Shift: Spinning Void Slash — 360° Tryndamere-style hurricane greataxe vortex
    sp_shadow_charge: ['dread', p => `
      <path d="M32 6 A26 26 0 1 1 8 42" fill="none" stroke="${p.acc}" stroke-width="7" stroke-linecap="round"/>
      <path d="M32 13 A19 19 0 1 1 15 40" fill="none" stroke="${p.hot}" stroke-width="4" stroke-linecap="round"/>
      <g transform="rotate(-35 32 32)">
        <rect x="29" y="6" width="6" height="52" rx="2" fill="#ffffff"/>
        <path d="M32 10 C8 8 6 32 20 38 C25 31 29 28 32 28 Z" fill="${p.fg}" stroke="${p.acc}" stroke-width="2.5"/>
        <path d="M32 12 C54 10 56 30 44 36 C39 30 35 28 32 28 Z" fill="${p.hot}" stroke="#ffffff" stroke-width="2.5"/>
      </g>`],

    // Extra 1: Executioner's Beheading — Giant crimson-edged executioner axe with golden crown/skull split
    sp_soul_rend: ['dread', p => `
      <path d="M8 20 Q32 2 56 20" fill="none" stroke="${p.hot}" stroke-width="6" stroke-linecap="round"/>
      <rect x="29" y="8" width="6" height="48" rx="2" fill="#fde047"/>
      <path d="M32 12 C6 6 4 36 18 46 C24 38 28 34 32 34 Z" fill="${p.hot}" stroke="#ffffff" stroke-width="3"/>
      <path d="M32 12 C58 6 60 36 46 46 C40 38 36 34 32 34 Z" fill="#140526" stroke="${p.acc}" stroke-width="3"/>
      <circle cx="32" cy="24" r="6" fill="#ffffff"/>`],

    // Extra 2: Cataclysmic Axe Drag — Heavy axehead gouging the earth with erupting violet-crimson shockwaves
    sp_dread_wave: ['dread', p => `
      <path d="M6 48 Q32 22 58 48" fill="none" stroke="${p.acc}" stroke-width="7" stroke-linecap="round"/>
      <path d="M10 56 Q32 34 54 56" fill="none" stroke="${p.hot}" stroke-width="5" stroke-linecap="round"/>
      <path d="M12 10 L44 42" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
      <path d="M34 20 C56 16 62 36 46 50 C36 44 28 38 26 30 Z" fill="${p.hot}" stroke="#fde047" stroke-width="3"/>`],

    // Extra 3: Guillotine Skyfall — Three giant executioner axes raining down from a dark void rift
    sp_grave_rain: ['dread', p => `
      <ellipse cx="32" cy="12" rx="24" ry="7" fill="#090214" stroke="${p.acc}" stroke-width="3.5"/>
      <line x1="16" y1="16" x2="16" y2="48" stroke="${p.acc}" stroke-width="4"/>
      <path d="M8 34 L16 48 L24 34 Z" fill="${p.fg}"/>
      <line x1="48" y1="16" x2="48" y2="48" stroke="${p.acc}" stroke-width="4"/>
      <path d="M40 34 L48 48 L56 34 Z" fill="${p.fg}"/>
      <line x1="32" y1="12" x2="32" y2="56" stroke="#ffffff" stroke-width="5"/>
      <path d="M18 36 L32 58 L46 36 Z" fill="${p.hot}" stroke="#fde047" stroke-width="2.5"/>`],

    // Extra 4: Oblivion Leap Slam — Airborne meteoric leap arc slamming the colossal axe into a glowing crater
    sp_void_step: ['dread', p => `
      <path d="M10 46 C16 6 44 6 50 42" fill="none" stroke="#fde047" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="46" cy="50" rx="14" ry="8" fill="${p.hot}" stroke="#ffffff" stroke-width="3"/>
      <circle cx="12" cy="48" r="7" fill="${p.acc}" stroke="#ffffff" stroke-width="2.5"/>`]
  });

  // ---- 10 new variant warrior cards (gravelord / dragoon / reaver / rune knight / sentinel /
  // duskblade / titan / bannerman / warchief / phoenix oath) ----
  Object.assign(GLYPHS, {
    // Gravelord: seismic hammer & charge bursts
    sp_gravelord_slam: alias('earthshaker', 'earth'),
    sp_gravelord_momentum: ['earth', p => `${rays(32, 32, 14, 22, 10, p.acc, 2)}${star(32, 32, 13, 5, 4, p.hot)}`],
    sp_gravelord_cataclysm: alias('meteor_dive', 'earth'),
    sp_gravelord_siege: alias('blade_charge', 'earth'),
    // Dragoon: storm lance, leaps & skyfall
    sp_dragoon_impale: ['bolt', p => `${sword(p, 'rotate(90 32 32) translate(32 34) scale(0.75) translate(-32 -32)')}\n
      <path d="M20 18 L44 18" stroke="${p.acc}" stroke-width="4" stroke-linecap="round"/>`],
    sp_dragoon_leap: alias('meteor_dive', 'bolt'),
    sp_dragoon_barrage: alias('blizzard', 'bolt'),
    sp_dragoon_wind: alias('blade_charge', 'bolt'),
    // Reaver: flame greatsword & executions
    sp_reaver_slash: alias('sundering_cleave', 'fire'),
    sp_reaver_sear: alias('firestorm', 'fire'),
    sp_reaver_inferno: alias('pyroblast', 'fire'),
    sp_reaver_step: alias('arcane_blink', 'fire'),
    // Rune Knight: echoing rune-cast blades
    sp_runeknight_wave: alias('ragnarok_slash', 'earth'),
    sp_runeknight_burst: alias('mana_shield', 'earth'),
    sp_runeknight_sigil: alias('black_hole', 'earth'),
    sp_runeknight_step: alias('arcane_blink', 'earth'),
    // Sentinel: unbreakable holy bulwark
    sp_sentinel_warcry: alias('shield_slam', 'gold'),
    sp_sentinel_bulwark: alias('iron_fortress', 'gold'),
    sp_sentinel_ram: alias('colossus_strike', 'gold'),
    sp_sentinel_guard: ['gold', p => `${shield(p, 'rotate(20 32 32)')}${bolt(p.acc, 'translate(46 44) scale(0.5) translate(-32 -32)')}`],
    // Duskblade: soul-harvesting greatsword
    sp_duskblade_soul_rend: alias('sundering_cleave', 'shadow'),
    sp_duskblade_shadow_cleave: alias('death_blossom', 'shadow'),
    sp_duskblade_devour: alias('black_hole', 'shadow'),
    sp_duskblade_tread: alias('arcane_blink', 'shadow'),
    // Titan: gravity-pulling mountain
    sp_titan_maul: alias('colossus_strike', 'steel'),
    sp_titan_graviton: alias('black_hole', 'steel'),
    sp_titan_cataclysm: alias('earthshaker', 'steel'),
    sp_titan_stomp: alias('meteor_dive', 'steel'),
    // Bannerman: radiant war-banner support
    sp_bannerman_warshout: alias('dragon_roar', 'gold'),
    sp_bannerman_plant: ['gold', p => `${rays(32, 26, 16, 23, 8, p.acc, 2)}<rect x="29" y="8" width="5" height="22" fill="#7c4a24"/>\n
      <path d="M32 10 L52 16 L32 24 Z" fill="${p.fg}"/>`],
    sp_bannerman_inspire: alias('shield_slam', 'gold'),
    sp_bannerman_flag: alias('blade_charge', 'gold'),
    // Warchief: twin-axe rage machine
    sp_warchief_hack: alias('sundering_cleave', 'blood'),
    sp_warchief_whirl: alias('whirlwind', 'blood'),
    sp_warchief_devastate: alias('ragnarok_slash', 'blood'),
    sp_warchief_charge: alias('meteor_dive', 'blood'),
    // Phoenix Oath: undying rebirth in flame
    sp_phoenix_strike: alias('ragnarok_slash', 'fire'),
    sp_phoenix_flare: alias('pyroblast', 'fire'),
    sp_phoenix_immolation: alias('bladestorm_frenzy', 'fire'),
    sp_phoenix_ember: alias('arcane_blink', 'fire'),
    // extras share the generic sp_* pool below
    sp_gravelord_tremor: alias('black_hole', 'earth'),
    sp_gravelord_quakes: ['earth', p => `<path d="M6 46 Q32 20 58 46" fill="none" stroke="${p.acc}" stroke-width="6" stroke-linecap="round"/>\n
      <path d="M10 54 Q32 34 54 54" fill="none" stroke="${p.fg}" stroke-width="3" stroke-linecap="round"/>`],
    sp_reaver_crater: ['fire', p => `${drop(p.fg, 'translate(32 40) scale(0.8) translate(-32 -32)')}<path d="M10 52 H54" stroke="${p.hot}" stroke-width="3" stroke-linecap="round"/>`],
    sp_titan_fissure: ['steel', p => `${rays(32, 32, 18, 25, 10, p.acc, 2)}${star(32, 32, 12, 5, 4, p.hot)}`],
    sp_sentinel_aegis: alias('iron_fortress', 'gold'),
    sp_bannerman_call: alias('dragon_roar', 'gold'),
    sp_warchief_warcry: alias('earthshaker', 'blood'),
    sp_phoenix_rebirth: ['fire', p => `${heart(p.hot)}${rays(32, 34, 18, 26, 12, p.acc, 2)}`],
    // ---- reworked kits (extra distinct iteration) ----
    sp_gravelord_aftershock: ['earth', p => `${rays(32, 32, 10, 21, 8, p.acc, 2)}${heart(p.fg)}`],
    sp_dragoon_impact: alias('meteor_dive', 'bolt'),
    sp_dragoon_vantage: alias('colossus_strike', 'bolt'),
    sp_reaver_stance: ['fire', p => `${rays(32, 32, 14, 22, 12, p.acc, 2)}${drop(p.fg, 'translate(32 40) scale(0.7) translate(-32 -32)')}`],
    sp_reaver_firebrand: alias('chain_lightning', 'fire'),
    sp_runeknight_storm: alias('meteor_dive', 'earth'),
    sp_sentinel_mist: alias('smoke_screen', 'gold'),
    sp_duskblade_wail: alias('eclipse_execution', 'shadow'),
    sp_warchief_howl: ['blood', p => `${cloud(p, p.acc)}${rays(32, 30, 12, 20, 10, p.hot, 2.5)}`],
    sp_warchief_carnage: alias('blood_rage', 'blood'),
    sp_phoenix_orbs: ['fire', p => `${[0, 0.35, 0.7].map((o) => `<circle cx="${(26 + Math.cos(o * Math.PI * 2) * 18).toFixed(1)}" cy="${(32 + Math.sin(o * Math.PI * 2) * 10).toFixed(1)}" r="4" fill="${o === 0 ? p.hot : p.acc}"/>`).join('')}
      ${rays(32, 32, 20, 26, 8, p.hot, 2)}`]
  });

  // ---- variant warrior signature skills (one picture per mechanic) ----
  Object.assign(GLYPHS, {
    // Gravelord: a crack running away with stone shards
    sp_gravelord_fault: ['earth', p => `<path d="M8 54 L20 44 L18 36 L32 30 L30 22 L44 16 L56 8" fill="none" stroke="${p.acc}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M14 50 L18 36 L24 46 Z M28 40 L32 24 L38 36 Z M42 28 L46 12 L52 24 Z" fill="${p.fg}"/>`],
    sp_gravelord_rupture: ['earth', p => `${rays(32, 34, 8, 26, 8, p.acc, 3)}<path d="M22 44 L26 26 L32 40 L38 22 L42 44 Z" fill="${p.fg}"/>`],
    sp_gravelord_bastion: alias('iron_fortress', 'earth'),
    // Dragoon: planted lance / dive from the sky
    sp_dragoon_impale: ['bolt', p => `<line x1="12" y1="10" x2="46" y2="50" stroke="${p.fg}" stroke-width="4"/>
      <path d="M46 50 L40 38 L54 44 Z" fill="${p.hot}"/><path d="M10 58 Q32 50 56 58" fill="none" stroke="${p.acc}" stroke-width="3"/>${bolt(p.acc, 'translate(14 18) scale(0.35)')}`],
    sp_dragoon_leap: ['bolt', p => `<path d="M14 54 Q20 6 32 8 Q44 10 48 50" fill="none" stroke="${p.acc}" stroke-width="4" stroke-dasharray="5 4"/>
      <path d="M48 52 L42 40 L54 40 Z" fill="${p.hot}"/><ellipse cx="48" cy="56" rx="12" ry="4" fill="none" stroke="${p.fg}" stroke-width="2.5"/>`],
    sp_dragoon_updraft: ['bolt', p => `${cloud(p, p.acc)}<path d="M24 54 V36 M32 58 V30 M40 54 V36" stroke="${p.hot}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M20 40 L24 32 L28 40 M28 34 L32 26 L36 34 M36 40 L40 32 L44 40" fill="none" stroke="${p.hot}" stroke-width="3"/>`],
    // Reaver: heat gauge, wall, meltdown
    sp_reaver_slash: alias('firestorm', 'fire'),
    sp_reaver_wall: ['fire', p => `${[12, 22, 32, 42, 52].map((x, i) => drop(i % 2 ? p.acc : p.fg, `translate(${x} ${i % 2 ? 36 : 32}) scale(0.32) translate(-32 -32)`)).join('')}
      <path d="M6 50 H58" stroke="${p.hot}" stroke-width="4" stroke-linecap="round"/>`],
    sp_reaver_inferno: ['fire', p => `<rect x="26" y="8" width="12" height="36" rx="6" fill="none" stroke="${p.fg}" stroke-width="3"/>
      <rect x="29" y="22" width="6" height="20" fill="${p.hot}"/><circle cx="32" cy="48" r="9" fill="${p.acc}"/>${rays(32, 48, 12, 20, 8, p.hot, 2)}`],
    sp_reaver_step: ['fire', p => `<path d="M8 50 Q32 40 56 18" fill="none" stroke="${p.acc}" stroke-width="6" stroke-linecap="round"/>
      ${[16, 28, 40].map((x, i) => drop(p.hot, `translate(${x} ${46 - i * 9}) scale(0.25) translate(-32 -32)`)).join('')}`],
    // Rune Knight: glyph circles
    sp_runeknight_glyph: ['earth', p => `<ellipse cx="32" cy="36" rx="24" ry="14" fill="none" stroke="${p.acc}" stroke-width="3"/>
      <path d="M32 24 L44 42 H20 Z M32 48 L20 30 H44 Z" fill="none" stroke="${p.fg}" stroke-width="2.5"/><circle cx="32" cy="36" r="3" fill="${p.hot}"/>`],
    sp_runeknight_bind: ['gold', p => `<ellipse cx="32" cy="36" rx="24" ry="14" fill="none" stroke="${p.acc}" stroke-width="3"/>
      <path d="M12 36 H52 M32 22 V50" stroke="${p.fg}" stroke-width="3" stroke-dasharray="4 3"/><circle cx="32" cy="36" r="5" fill="none" stroke="${p.hot}" stroke-width="2.5"/>`],
    sp_runeknight_frost: ['ice', p => `<ellipse cx="32" cy="40" rx="24" ry="13" fill="none" stroke="${p.acc}" stroke-width="3"/>
      ${snowflake(p, 32, 30, 14, 3)}`],
    sp_runeknight_invoke: ['earth', p => `${[[14, 46], [50, 46], [32, 18]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="5" fill="none" stroke="${p.acc}" stroke-width="2.5"/><line x1="32" y1="36" x2="${x}" y2="${y}" stroke="${p.hot}" stroke-width="2.5"/>`).join('')}
      <circle cx="32" cy="36" r="6" fill="${p.fg}"/>`],
    // Sentinel: shield ricochet, challenge horn, riposte
    sp_sentinel_throw: ['gold', p => `<path d="M8 50 L24 18 L40 44 L56 14" fill="none" stroke="${p.acc}" stroke-width="2.5" stroke-dasharray="4 3"/>
      ${shield(p, 'translate(44 24) scale(0.5) translate(-32 -32)')}`],
    sp_sentinel_warcry: ['gold', p => `<path d="M14 40 L34 26 V54 Z" fill="${p.fg}"/><path d="M34 26 Q50 20 54 12 M34 54 Q50 58 54 62" fill="none" stroke="${p.acc}" stroke-width="3"/>
      ${rays(14, 40, 4, 12, 6, p.hot, 2)}`],
    sp_sentinel_riposte: ['gold', p => `${shield(p, 'translate(24 34) scale(0.7) translate(-32 -32)')}
      <path d="M30 30 L56 8" stroke="${p.hot}" stroke-width="4" stroke-linecap="round"/><path d="M48 8 H56 V16" fill="none" stroke="${p.hot}" stroke-width="3"/>`],
    sp_sentinel_ram: alias('colossus_strike', 'gold'),
    sp_sentinel_bulwark: alias('iron_fortress', 'gold'),
    // Duskblade: doom brand, phantom blades
    sp_duskblade_doom: ['shadow', p => `<circle cx="32" cy="32" r="20" fill="none" stroke="${p.acc}" stroke-width="4" stroke-dasharray="90 40" transform="rotate(-90 32 32)"/>
      <circle cx="32" cy="32" r="9" fill="#14061f" stroke="${p.hot}" stroke-width="2.5"/><path d="M28 30 h2 M34 30 h2 M28 37 h8" stroke="${p.fg}" stroke-width="2"/>`],
    sp_duskblade_phantom: ['shadow', p => `${sword(p, 'rotate(35 32 32) translate(-8 0)')}<g opacity="0.45">${sword(p, 'rotate(35 32 32) translate(8 -6)')}</g>
      <g opacity="0.25">${sword(p, 'rotate(35 32 32) translate(20 -12)')}</g>`],
    // Titan: grab and throw
    sp_titan_hurl: ['steel', p => `<path d="M10 52 Q28 0 54 40" fill="none" stroke="${p.acc}" stroke-width="3" stroke-dasharray="5 4"/>
      <circle cx="40" cy="16" r="8" fill="${p.fg}" stroke="${p.hot}" stroke-width="2"/>${rays(54, 44, 3, 10, 7, p.hot, 2)}
      <path d="M8 52 q4 -10 10 -6 q2 6 -4 10 Z" fill="${p.acc}"/>`],
    // Bannerman: planted standard, rally
    sp_bannerman_plant: ['gold', p => `<ellipse cx="28" cy="52" rx="22" ry="7" fill="none" stroke="${p.acc}" stroke-width="2.5" stroke-dasharray="5 3"/>
      <rect x="26" y="6" width="4" height="46" fill="#7c4a24"/><path d="M30 8 Q42 4 54 10 Q46 16 54 24 Q42 20 30 24 Z" fill="${p.fg}" stroke="${p.hot}" stroke-width="1.5"/>`],
    sp_bannerman_rally: ['gold', p => `<rect x="44" y="10" width="3" height="34" fill="#7c4a24"/><path d="M47 12 L58 16 L47 22 Z" fill="${p.fg}"/>
      <path d="M8 50 Q24 14 42 40" fill="none" stroke="${p.hot}" stroke-width="3.5" stroke-dasharray="5 4"/><path d="M42 40 L34 38 L40 32 Z" fill="${p.hot}"/>`],
    sp_bannerman_warshout: alias('dragon_roar', 'gold'),
    sp_bannerman_call: alias('war_stomp', 'gold'),
    // Warchief: boomerang axes, combo finisher
    sp_warchief_axes: ['blood', p => `<path d="M10 40 Q32 4 54 40" fill="none" stroke="${p.acc}" stroke-width="3" stroke-dasharray="5 4"/>
      <path d="M10 40 Q32 60 54 40" fill="none" stroke="${p.fg}" stroke-width="2" stroke-dasharray="3 4"/>
      <path d="M46 34 a9 9 0 1 1 10 10 l-6 -4 Z" fill="${p.hot}"/><path d="M8 46 a9 9 0 0 1 10 -10 l-2 6 Z" fill="${p.hot}"/>`],
    sp_warchief_devastate: ['blood', p => `${[0, 1, 2, 3, 4].map(i => `<rect x="${8 + i * 10}" y="${46 - i * 8}" width="7" height="${10 + i * 8}" fill="${i === 4 ? p.hot : p.acc}"/>`).join('')}`],
    sp_warchief_howl: alias('dragon_roar', 'blood'),
    sp_warchief_carnage: alias('death_blossom', 'blood'),
    // Phoenix Oath: firebird, sacrifice, kindled heart
    sp_phoenix_firebird: ['fire', p => `<path d="M10 50 C10 10 56 10 52 30 C48 50 20 44 10 50" fill="none" stroke="${p.acc}" stroke-width="2.5" stroke-dasharray="4 3"/>
      <path d="M44 22 L30 14 L36 24 L22 26 L36 30 L30 40 Z" fill="${p.hot}"/><circle cx="46" cy="24" r="3" fill="#ffffff"/>`],
    sp_phoenix_sacrifice: ['fire', p => `${heart(p.acc)}${rays(32, 34, 16, 28, 10, p.hot, 2.5)}<path d="M32 22 V44" stroke="#1c0a05" stroke-width="3"/>`],
    sp_phoenix_rebirth: ['fire', p => `${heart(p.hot)}<path d="M32 30 Q14 10 4 22 Q14 26 20 38 M32 30 Q50 10 60 22 Q50 26 44 38" fill="${p.acc}" stroke="${p.fg}" stroke-width="1.5"/>`]
  });


  let uid = 0;

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  function getGlyphEntry(skillId) {
    if (!skillId) return GLYPHS.empty;
    if (GLYPHS[skillId]) return GLYPHS[skillId];

    const h = hashStr(skillId);
    if (skillId.startsWith('war_jug')) {
      const list = [GLYPHS.shield_slam, GLYPHS.iron_fortress, GLYPHS.titan_bastion, GLYPHS.earthshaker];
      return list[h % list.length] || GLYPHS.shield_slam;
    }
    if (skillId.startsWith('war_blade')) {
      const list = [GLYPHS.whirlwind, GLYPHS.blade_charge, GLYPHS.bladestorm_frenzy, GLYPHS.ragnarok_slash];
      return list[h % list.length] || GLYPHS.whirlwind;
    }
    if (skillId.startsWith('war_war')) {
      const list = [GLYPHS.blood_rage, GLYPHS.colossus_strike, GLYPHS.sundering_cleave, GLYPHS.dragon_roar];
      return list[h % list.length] || GLYPHS.blood_rage;
    }
    if (skillId.startsWith('mag_pyro')) {
      const list = [GLYPHS.firestorm, GLYPHS.pyroblast, GLYPHS.meteor_dive];
      return list[h % list.length] || GLYPHS.firestorm;
    }
    if (skillId.startsWith('mag_cryo')) {
      const list = [GLYPHS.frost_nova, GLYPHS.blizzard];
      return list[h % list.length] || GLYPHS.frost_nova;
    }
    if (skillId.startsWith('mag_arch')) {
      const list = [GLYPHS.arcane_blink, GLYPHS.mana_shield, GLYPHS.black_hole, GLYPHS.chain_lightning];
      return list[h % list.length] || GLYPHS.arcane_blink;
    }
    if (skillId.startsWith('rog_shad')) {
      const list = [GLYPHS.master_of_shadows, GLYPHS.basic_attack_rogue];
      return list[h % list.length] || GLYPHS.master_of_shadows;
    }
    if (skillId.startsWith('rog_ven')) {
      const list = [GLYPHS.toxic_potency, GLYPHS.noxious_cloud, GLYPHS.corrosive_venom, GLYPHS.epidemic_catalyst];
      return list[h % list.length] || GLYPHS.toxic_potency;
    }
    if (skillId.startsWith('rog_wind')) {
      const list = [GLYPHS.fleet_footwork, GLYPHS.wind_flurry, GLYPHS.evasive_reflexes, GLYPHS.phantom_duelist];
      return list[h % list.length] || GLYPHS.fleet_footwork;
    }
    // Generic SP cards: any skill without a bespoke icon picks from a broad pool
    if (skillId.startsWith('sp_')) {
      const list = [GLYPHS.shield_slam, GLYPHS.iron_fortress, GLYPHS.titan_bastion, GLYPHS.earthshaker, GLYPHS.whirlwind,
        GLYPHS.blade_charge, GLYPHS.bladestorm_frenzy, GLYPHS.ragnarok_slash, GLYPHS.blood_rage, GLYPHS.colossus_strike,
        GLYPHS.sundering_cleave, GLYPHS.dragon_roar, GLYPHS.firestorm, GLYPHS.pyroblast, GLYPHS.meteor_dive,
        GLYPHS.frost_nova, GLYPHS.blizzard, GLYPHS.arcane_blink, GLYPHS.mana_shield, GLYPHS.black_hole, GLYPHS.chain_lightning];
      return list[h % list.length] || GLYPHS.empty;
    }

    return GLYPHS.empty;
  }

  function svg(skillId) {
    const entry = getGlyphEntry(skillId);
    const p = Object.assign({}, PALETTES[entry[0]] || PALETTES.steel);
    const id = 'skg' + (++uid);
    return `<svg class="skill-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.top}"/><stop offset="1" stop-color="${p.bot}"/></linearGradient></defs>
      <rect x="2" y="2" width="60" height="60" rx="12" fill="url(#${id})" stroke="${p.acc}" stroke-opacity="0.75" stroke-width="2"/>
      ${entry[1](p)}
    </svg>`;
  }

  // Set an element's content to a skill icon
  function apply(el, skillId) {
    // go through the public svg() so a pixel-art override (pixelIcons.js) applies
    if (el) el.innerHTML = window.SkillIcons.svg(skillId);
  }

  window.SkillIcons = { svg, apply, has: id => !!GLYPHS[id], ids: () => Object.keys(GLYPHS) };
})();
