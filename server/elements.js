// Slop Hero - Elemental System (Weapons & Monsters)
// Elements: neutral, fire, ice, lightning, earth, holy, dark

const ELEMENTS = {
  NEUTRAL: 'neutral',
  FIRE: 'fire',
  ICE: 'ice',
  LIGHTNING: 'lightning',
  EARTH: 'earth',
  HOLY: 'holy',
  DARK: 'dark'
};

const ELEMENT_INFO = {
  neutral: { name: 'Neutral', nameTh: 'ไร้ธาตุ', icon: '⚪', color: '#94a3b8' },
  fire: { name: 'Fire', nameTh: 'ไฟ', icon: '🔥', color: '#ef4444' },
  ice: { name: 'Ice', nameTh: 'น้ำแข็ง', icon: '❄️', color: '#38bdf8' },
  lightning: { name: 'Lightning', nameTh: 'สายฟ้า', icon: '⚡', color: '#facc15' },
  earth: { name: 'Earth', nameTh: 'ดิน', icon: '🌿', color: '#4ade80' },
  holy: { name: 'Holy', nameTh: 'ศักดิ์สิทธิ์', icon: '✨', color: '#fef08a' },
  dark: { name: 'Dark', nameTh: 'ความมืด', icon: '💀', color: '#a855f7' }
};

// Attack Element vs Defender Element Base Advantage Matrix
// Fire > Ice (1.5x)
// Ice > Fire (1.5x), Ice > Lightning (1.25x)
// Lightning > Earth (1.5x), Lightning > Ice (1.25x)
// Earth > Lightning (1.5x), Earth > Fire (1.25x)
// Holy > Dark (1.75x)
// Dark > Holy (1.5x)
// Same element attacker vs defender deals 0.6x (resisted)
function getBaseElementAdvantage(atkElement, defElement) {
  if (!atkElement || atkElement === 'neutral' || !defElement || defElement === 'neutral') {
    return 1.0;
  }

  if (atkElement === defElement) {
    return 0.6; // Same element resistance
  }

  if (atkElement === 'fire') {
    if (defElement === 'ice') return 1.5;
    if (defElement === 'earth') return 1.25;
  } else if (atkElement === 'ice') {
    if (defElement === 'fire') return 1.5;
    if (defElement === 'lightning') return 1.25;
  } else if (atkElement === 'lightning') {
    if (defElement === 'earth') return 1.5;
    if (defElement === 'ice') return 1.25;
  } else if (atkElement === 'earth') {
    if (defElement === 'lightning') return 1.5;
    if (defElement === 'fire') return 1.25;
  } else if (atkElement === 'holy') {
    if (defElement === 'dark') return 1.75;
  } else if (atkElement === 'dark') {
    if (defElement === 'holy') return 1.5;
  }

  return 1.0;
}

/**
 * Calculate final elemental multiplier factoring in attacker element,
 * defender natural element, and specific defender element resistances.
 * @param {string} atkElement - Attacking element
 * @param {string} defElement - Defender element
 * @param {Object} defResists - Specific resistance values e.g. { fire: 0.2, holy: -0.5 }
 * @returns {number} multiplier (e.g. 1.5 for weakness, 0.5 for resist)
 */
function calculateElementalMultiplier(atkElement, defElement = 'neutral', defResists = {}) {
  const normAtk = (atkElement || 'neutral').toLowerCase();
  const normDef = (defElement || 'neutral').toLowerCase();

  const baseAdvantage = getBaseElementAdvantage(normAtk, normDef);
  const resist = (defResists && typeof defResists[normAtk] === 'number') ? defResists[normAtk] : 0;

  // Final multiplier: baseAdvantage * (1 - resist)
  // Clamp between 0.15 (heavy immunity) and 2.5 (extreme vulnerability)
  const mult = Math.max(0.15, Math.min(2.5, baseAdvantage * (1 - resist)));
  return Number(mult.toFixed(2));
}

module.exports = {
  ELEMENTS,
  ELEMENT_INFO,
  calculateElementalMultiplier,
  getBaseElementAdvantage
};
