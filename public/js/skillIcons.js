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
    shadow: { top: '#3730a3', bot: '#0b0a1f', fg: '#ddd6fe', acc: '#8b5cf6', hot: '#f0abfc' }
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

  let uid = 0;

  function svg(skillId) {
    const entry = GLYPHS[skillId] || GLYPHS.empty;
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
