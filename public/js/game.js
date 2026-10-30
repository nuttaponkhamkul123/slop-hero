// Main Game Controller for Aetheria Online MMORPG with Procedural Dungeons & Merchant Shop
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const renderer = new IsometricRenderer(canvas);
  // Camera zoom range for the wheel / pinch; heroes enter at the closest zoom
  const MIN_ZOOM = 0.65;
  const MAX_ZOOM = 3.0;
  renderer.camera.zoom = MAX_ZOOM;
  const socket = io();

  let localPlayerId = null;
  let localPlayer = null;
  let shopItemsCatalog = [];
  let skillTreesCatalog = {};

  let gameState = {
    map: null,
    players: [],
    mobs: [],
    groundItems: [],
    chests: []
  };

  let selectedTargetId = null;
  let selectedTargetType = null;
  let lastFrameTime = performance.now();

  let skill1CooldownTimer = 0;
  let skill1CooldownMax = 3.5;
  let skill2CooldownTimer = 0;
  let skill2CooldownMax = 4.5;
  let skill3CooldownTimer = 0;
  let skill3CooldownMax = 9.0;
  let dashCooldownTimer = 0;
  let dashCooldownMax = 3.0;
  let weaponCooldownTimer = 0;
  let weaponCooldownMax = 6.0;
  let weaponAbilities = {};   // right-click weapon abilities, by ability id
  let skillCooldownTimer = 0;
  let skillCooldownMax = 3.5;
  let lastBasicAttackTime = 0;

  // Calculate 8-directional facing vector between two isometric world coordinates
  function calculateFacingFromTo(fromX, fromY, toX, toY) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return 'S';

    const screenDx = dx - dy;
    const screenDy = (dx + dy) * 0.5;
    const angle = Math.atan2(screenDy, screenDx);
    const deg = (angle * 180) / Math.PI;

    if (deg >= -22.5 && deg < 22.5) return 'E';
    if (deg >= 22.5 && deg < 67.5) return 'SE';
    if (deg >= 67.5 && deg < 112.5) return 'S';
    if (deg >= 112.5 && deg < 157.5) return 'SW';
    if (deg >= 157.5 || deg < -157.5) return 'W';
    if (deg >= -157.5 && deg < -112.5) return 'NW';
    if (deg >= -112.5 && deg < -67.5) return 'N';
    if (deg >= -67.5 && deg < -22.5) return 'NE';

    return 'S';
  }

  let allSkillsCatalog = {};
  let skillRunesCatalog = {};
  let selectedLoadoutSlot = 'slot1';
  let activeSkillsModalTab = 'talents'; // Default to passive talents tree

  const activeKeys = { w: false, a: false, s: false, d: false };

  // Auth & Character Modal DOM Elements
  const authModal = document.getElementById('authModal') || document.getElementById('joinModal');
  const tabAuthLogin = document.getElementById('tabAuthLogin');
  const tabAuthRegister = document.getElementById('tabAuthRegister');
  const authAlertBanner = document.getElementById('authAlertBanner');

  // Login View
  const viewAuthLogin = document.getElementById('viewAuthLogin');
  const loginUsername = document.getElementById('loginUsername');
  const loginPassword = document.getElementById('loginPassword');
  const btnSubmitLogin = document.getElementById('btnSubmitLogin');

  // Character Select View
  const viewCharSelect = document.getElementById('viewCharSelect');
  const btnEnterWorld = document.getElementById('btnEnterWorld');
  const btnLogoutSwitch = document.getElementById('btnLogoutSwitch');

  // Register View
  const viewAuthRegister = document.getElementById('viewAuthRegister');
  const regStepAccount = document.getElementById('regStepAccount');
  const regStepClass = document.getElementById('regStepClass');
  const regUsername = document.getElementById('regUsername');
  const regPassword = document.getElementById('regPassword');
  const regConfirmPassword = document.getElementById('regConfirmPassword');
  const regHeroName = document.getElementById('regHeroName');
  const btnRegToClassStep = document.getElementById('btnRegToClassStep');
  const btnRegBackToAccount = document.getElementById('btnRegBackToAccount');
  const btnSubmitRegister = document.getElementById('btnSubmitRegister');

  // Backward compatibility aliases
  const joinModal = authModal;
  const btnJoinGame = btnEnterWorld;
  const inputHeroName = regHeroName;
  const classCards = document.querySelectorAll('.class-card');
  const previewClassName = document.getElementById('previewClassName');
  const previewClassRole = document.getElementById('previewClassRole');
  const previewClassLore = document.getElementById('previewClassLore');
  const previewClassStats = document.getElementById('previewClassStats');
  const classPreviewCanvas = document.getElementById('classPreviewCanvas');

  const hudPlayerName = document.getElementById('hudPlayerName');
  const hudPlayerClass = document.getElementById('hudPlayerClass');
  const playerAvatarIcon = document.getElementById('playerAvatarIcon');
  const playerLevelBadge = document.getElementById('playerLevelBadge');
  const hudHpFill = document.getElementById('hudHpFill');
  const hudHpText = document.getElementById('hudHpText');
  const hudMpFill = document.getElementById('hudMpFill');
  const hudMpText = document.getElementById('hudMpText');
  const hudExpFill = document.getElementById('hudExpFill');
  const onlineCountText = document.getElementById('onlineCountText');
  const goldCountText = document.getElementById('goldCountText');

  const zoneBadge = document.getElementById('zoneBadge');
  const zoneIcon = document.getElementById('zoneIcon');
  const zoneText = document.getElementById('zoneText');

  const targetHud = document.getElementById('targetHud');
  const targetName = document.getElementById('targetName');
  const targetHpFill = document.getElementById('targetHpFill');
  const targetIcon = document.getElementById('targetIcon');

  const slotTarget = document.getElementById('slotTarget');
  const slotAttack = document.getElementById('slotAttack');

  const slotSkill1 = document.getElementById('slotSkill1') || document.getElementById('slotSkill');
  const slotSkill1Icon = document.getElementById('slotSkill1Icon') || document.getElementById('slotSkillIcon');
  const cdOverlaySkill1 = document.getElementById('cdOverlaySkill1') || document.getElementById('cdOverlaySkill');

  const slotSkill2 = document.getElementById('slotSkill2');
  const slotSkill2Icon = document.getElementById('slotSkill2Icon');
  const cdOverlaySkill2 = document.getElementById('cdOverlaySkill2');

  const slotSkill3 = document.getElementById('slotSkill3');
  const slotSkill3Icon = document.getElementById('slotSkill3Icon');
  const cdOverlaySkill3 = document.getElementById('cdOverlaySkill3');

  const slotDash = document.getElementById('slotDash');
  const slotDashIcon = document.getElementById('slotDashIcon');
  const cdOverlayDash = document.getElementById('cdOverlayDash');
  const slotWeapon = document.getElementById('slotWeapon');
  const slotWeaponIcon = document.getElementById('slotWeaponIcon');
  const cdOverlayWeapon = document.getElementById('cdOverlayWeapon');

  // Alias for backward compatibility
  const slotSkill = slotSkill1;
  const slotSkillIcon = slotSkill1Icon;
  const cdOverlaySkill = cdOverlaySkill1;

  // 📱 Mobile HUD & Touch Control Elements
  const mobileControlsOverlay = document.getElementById('mobileControlsOverlay');
  const mobileJoystickZone = document.getElementById('mobileJoystickZone');
  const mobileJoystickBase = document.getElementById('mobileJoystickBase');
  const mobileJoystickKnob = document.getElementById('mobileJoystickKnob');
  const mobileActionCluster = document.getElementById('mobileActionCluster');
  const mobileBtnInteract = document.getElementById('mobileBtnInteract');
  const mobileInteractIcon = document.getElementById('mobileInteractIcon');
  const mobileInteractText = document.getElementById('mobileInteractText');
  const mobileBtnTarget = document.getElementById('mobileBtnTarget');
  const mobileBtnHp = document.getElementById('mobileBtnHp');
  const mobileBadgeHp = document.getElementById('mobileBadgeHp');
  const mobileBtnMp = document.getElementById('mobileBtnMp');
  const mobileBadgeMp = document.getElementById('mobileBadgeMp');
  const mobileBtnDash = document.getElementById('mobileBtnDash');
  const mobileDashIcon = document.getElementById('mobileDashIcon');
  const mobileCdDash = document.getElementById('mobileCdDash');
  const mobileBtnSkill1 = document.getElementById('mobileBtnSkill1');
  const mobileSkill1Icon = document.getElementById('mobileSkill1Icon');
  const mobileCdSkill1 = document.getElementById('mobileCdSkill1');
  const mobileBtnSkill2 = document.getElementById('mobileBtnSkill2');
  const mobileSkill2Icon = document.getElementById('mobileSkill2Icon');
  const mobileCdSkill2 = document.getElementById('mobileCdSkill2');
  const mobileBtnSkill3 = document.getElementById('mobileBtnSkill3');
  const mobileSkill3Icon = document.getElementById('mobileSkill3Icon');
  const mobileCdSkill3 = document.getElementById('mobileCdSkill3');
  const mobileBtnAttack = document.getElementById('mobileBtnAttack');
  const mobileAttackIcon = document.getElementById('mobileAttackIcon');
  const mobileCdAttack = document.getElementById('mobileCdAttack');

  const btnMobileMenuToggle = document.getElementById('btnMobileMenuToggle');
  const mobileMenuDrawer = document.getElementById('mobileMenuDrawer');
  const btnChatToggle = document.getElementById('btnChatToggle');
  const mBtnOpenSkillTree = document.getElementById('mBtnOpenSkillTree');
  const mBtnOpenShop = document.getElementById('mBtnOpenShop');
  const mBtnOpenStats = document.getElementById('mBtnOpenStats');
  const mBtnOpenInventory = document.getElementById('mBtnOpenInventory');
  const mBtnOpenHelp = document.getElementById('mBtnOpenHelp');

  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');

  const statsModal = document.getElementById('statsModal');
  const inventoryModal = document.getElementById('inventoryModal');
  const helpModal = document.getElementById('helpModal');
  const shopModal = document.getElementById('shopModal');
  const reforgeModal = document.getElementById('reforgeModal');
  const deathScreen = document.getElementById('deathScreen') || document.getElementById('death-screen');

  // Shop Elements
  const btnOpenShop = document.getElementById('btnOpenShop');
  const btnCloseShop = document.getElementById('btnCloseShop');
  const tabShopBuy = document.getElementById('tabShopBuy');
  const tabShopSell = document.getElementById('tabShopSell');
  const shopBuyList = document.getElementById('shopBuyList');
  const shopSellList = document.getElementById('shopSellList');
  const shopPlayerGold = document.getElementById('shopPlayerGold');

  // Reforge Blacksmith Elements
  const btnOpenReforge = document.getElementById('btnOpenReforge');
  const btnCloseReforge = document.getElementById('btnCloseReforge');
  const tabReforgeEquipped = document.getElementById('tabReforgeEquipped');
  const tabReforgeBag = document.getElementById('tabReforgeBag');
  const reforgeItemsList = document.getElementById('reforgeItemsList');
  const reforgeEmptyPrompt = document.getElementById('reforgeEmptyPrompt');
  const reforgeActiveView = document.getElementById('reforgeActiveView');
  const rfItemIcon = document.getElementById('rfItemIcon');
  const rfItemName = document.getElementById('rfItemName');
  const rfLevelBadge = document.getElementById('rfLevelBadge');
  const rfStatPreview = document.getElementById('rfStatPreview');
  const rfChanceVal = document.getElementById('rfChanceVal');
  const rfRiskTag = document.getElementById('rfRiskTag');
  const rfCostVal = document.getElementById('rfCostVal');
  const btnHammerItem = document.getElementById('btnHammerItem');

  // Class Skill Tree & Custom Spellbook Modal Elements
  const skillTreeModal = document.getElementById('skillTreeModal');
  const btnOpenSkillTree = document.getElementById('btnOpenSkillTree');
  const btnCloseSkillTree = document.getElementById('btnCloseSkillTree');
  const stClassName = document.getElementById('stClassName');
  const stAvailablePoints = document.getElementById('stAvailablePoints');
  const skillTreeGrid = document.getElementById('skillTreeGrid');
  const btnResetTalents = document.getElementById('btnResetTalents');
  const tabNavLoadout = document.getElementById('tabNavLoadout');
  const tabNavTalents = document.getElementById('tabNavTalents');
  const tabContentLoadout = document.getElementById('tabContentLoadout');
  const tabContentTalents = document.getElementById('tabContentTalents');
  const loadoutSlotsRow = document.getElementById('loadoutSlotsRow');
  const runesSelectorRow = document.getElementById('runesSelectorRow');
  const skillsCatalogGrid = document.getElementById('skillsCatalogGrid');
  const spBannerWrapper = document.getElementById('spBannerWrapper');

  let reforgeTab = 'equipped'; // 'equipped' or 'bag'
  let selectedReforgeTarget = null; // { target, slot, itemIndex, item }

  // Dungeon Expedition Portal Modal Elements
  const dungeonPortalModal = document.getElementById('dungeonPortalModal');
  const btnCloseDungeonPortal = document.getElementById('btnCloseDungeonPortal');
  const btnConfirmEnterDungeon = document.getElementById('btnConfirmEnterDungeon');
  const floorCards = document.querySelectorAll('.floor-node');
  const diffCards = document.querySelectorAll('.diff-card');

  let selectedDungeonFloor = 1;
  let selectedDungeonDifficulty = 'normal';

  const floorLevelReqs = {
    1: 1, 2: 16, 3: 31, 4: 46, 5: 61, 6: 76, 7: 91, 8: 106, 9: 121, 10: 136
  };

  // Potential rewards preview per dungeon floor (B1 - B10)
  const FLOOR_LOOT_PREVIEWS = {
    1: [
      { id: 'gold', name: 'Gold Coins (150-300)', count: 300, type: 'gold', rarity: 'common' },
      { id: 'health_potion', name: 'Health Potion', count: 3, type: 'consumable', rarity: 'common', desc: 'Restores 50 HP.' },
      { id: 'mana_potion', name: 'Mana Potion', count: 2, type: 'consumable', rarity: 'common', desc: 'Restores 50 MP.' },
      { id: 'ancient_ruby', name: 'Ancient Ruby', count: 1, type: 'treasure', rarity: 'rare', sellPrice: 80, desc: 'A gleaming red gem from the crypt. Sells for gold.' },
      { id: 'iron_blade', name: "Sentry's Iron Blade", count: 1, type: 'equipment', slot: 'weapon', rarity: 'rare', bonusDmg: 8, element: 'dark', desc: 'Weapon recovered from the Tomb Sentry.' }
    ],
    2: [
      { id: 'gold', name: 'Gold Coins (300-600)', count: 600, type: 'gold', rarity: 'common' },
      { id: 'greater_health_potion', name: 'Greater Health Potion', count: 2, type: 'consumable', rarity: 'rare', desc: 'Restores 150 HP.' },
      { id: 'cursed_chalice', name: 'Cursed Chalice', count: 1, type: 'treasure', rarity: 'epic', sellPrice: 200, desc: 'An ancient chalice dripping with dark magic. Sells for gold.' },
      { id: 'ancient_ruby', name: 'Ancient Ruby', count: 2, type: 'treasure', rarity: 'rare', sellPrice: 80, desc: 'Valuable gemstone.' },
      { id: 'leather_tunic', name: "Drowned Mariner's Garb", count: 1, type: 'equipment', slot: 'armor', rarity: 'rare', bonusDef: 12, bonusHp: 30, element: 'ice' }
    ],
    3: [
      { id: 'gold', name: 'Gold Coins (600-1200)', count: 1200, type: 'gold', rarity: 'common' },
      { id: 'elixir_of_fury', name: 'Elixir of Fury', count: 1, type: 'consumable', rarity: 'rare', desc: 'Temp boost to ATK & Attack Speed.' },
      { id: 'shadow_essence', name: 'Shadow Essence', count: 1, type: 'treasure', rarity: 'epic', sellPrice: 350, desc: 'Swirling dark vapor trapped in a crystal.' },
      { id: 'cursed_chalice', name: 'Cursed Chalice', count: 2, type: 'treasure', rarity: 'epic', sellPrice: 200, desc: 'Valuable relic.' },
      { id: 'sweeping_claymore', name: 'Obsidian Greatsword', count: 1, type: 'equipment', slot: 'weapon', rarity: 'epic', bonusDmg: 28, bonusSwipe: 20, element: 'fire' }
    ],
    4: [
      { id: 'gold', name: 'Gold Coins (1200-2200)', count: 2200, type: 'gold', rarity: 'common' },
      { id: 'revival_stone', name: 'Revival Stone', count: 1, type: 'consumable', rarity: 'rare', desc: 'Auto-revives upon death with 50% HP.' },
      { id: 'dragon_scale', name: 'Frost Drake Scale', count: 1, type: 'treasure', rarity: 'legendary', sellPrice: 600, desc: 'Glistening cryo-hardened dragon scale.' },
      { id: 'shadow_essence', name: 'Shadow Essence', count: 2, type: 'treasure', rarity: 'epic', sellPrice: 350, desc: 'Rare essence.' },
      { id: 'plate_cuirass', name: 'Glacial Permafrost Plate', count: 1, type: 'equipment', slot: 'armor', rarity: 'epic', bonusDef: 34, bonusHp: 120, element: 'ice' }
    ],
    5: [
      { id: 'gold', name: 'Gold Coins (2000-3800)', count: 3800, type: 'gold', rarity: 'common' },
      { id: 'elixir_of_iron', name: 'Elixir of Iron', count: 2, type: 'consumable', rarity: 'rare', desc: 'Temp boost to DEF & Max HP.' },
      { id: 'golden_idol', name: 'Golden Idol of Thok', count: 1, type: 'treasure', rarity: 'legendary', sellPrice: 850, desc: 'Pure solid gold relic. Very high value.' },
      { id: 'dragon_scale', name: 'Dragon Scale', count: 1, type: 'treasure', rarity: 'legendary', sellPrice: 600, desc: 'Ancient scale.' },
      { id: 'wind_rapier', name: 'Toxic Blight-Piercer', count: 1, type: 'equipment', slot: 'weapon', rarity: 'legendary', bonusDmg: 45, bonusAttackSpeed: 0.25, element: 'earth' }
    ],
    6: [
      { id: 'gold', name: 'Gold Coins (3500-6000)', count: 6000, type: 'gold', rarity: 'common' },
      { id: 'revival_stone', name: 'Revival Stone', count: 2, type: 'consumable', rarity: 'rare', desc: 'Revival on fatal hit.' },
      { id: 'golden_idol', name: 'Golden Idol', count: 2, type: 'treasure', rarity: 'legendary', sellPrice: 850, desc: 'Pure gold idol.' },
      { id: 'shadow_essence', name: 'Infernal Shadow Essence', count: 3, type: 'treasure', rarity: 'epic', sellPrice: 350, desc: 'Dense dark essence.' },
      { id: 'excalibur', name: 'Hellfire Sunderer', count: 1, type: 'equipment', slot: 'weapon', rarity: 'legendary', bonusDmg: 68, bonusSwipe: 25, element: 'fire' }
    ],
    7: [
      { id: 'gold', name: 'Gold Coins (5500-9000)', count: 9000, type: 'gold', rarity: 'common' },
      { id: 'elixir_of_fury', name: 'Celestial Elixir', count: 2, type: 'consumable', rarity: 'rare', desc: 'Ultimate combat stimulant.' },
      { id: 'dragon_scale', name: 'Astral Dragon Scale', count: 2, type: 'treasure', rarity: 'legendary', sellPrice: 600, desc: 'Shimmers with starlight.' },
      { id: 'golden_idol', name: 'Golden Idol', count: 2, type: 'treasure', rarity: 'legendary', sellPrice: 850, desc: 'Treasured antiquity.' },
      { id: 'archmage_staff', name: 'Singularity Void-Scepter', count: 1, type: 'equipment', slot: 'weapon', rarity: 'legendary', bonusDmg: 85, bonusMp: 180, element: 'holy' }
    ],
    8: [
      { id: 'gold', name: 'Gold Coins (8000-13000)', count: 13000, type: 'gold', rarity: 'common' },
      { id: 'revival_stone', name: 'Revival Stone', count: 2, type: 'consumable', rarity: 'rare', desc: 'Dungeon survival talisman.' },
      { id: 'dragon_scale', name: 'Deathlord Dragon Scale', count: 3, type: 'treasure', rarity: 'legendary', sellPrice: 600, desc: 'Dark-infused scale.' },
      { id: 'golden_idol', name: 'Golden Idol', count: 3, type: 'treasure', rarity: 'legendary', sellPrice: 850, desc: 'Royal gold statue.' },
      { id: 'plate_cuirass', name: 'Dread Citadel Netherplate', count: 1, type: 'equipment', slot: 'armor', rarity: 'mythic', bonusDef: 85, bonusHp: 350, element: 'dark' }
    ],
    9: [
      { id: 'gold', name: 'Gold Coins (11000-18000)', count: 18000, type: 'gold', rarity: 'common' },
      { id: 'dragon_scale', name: 'Imperator Drake Scale', count: 4, type: 'treasure', rarity: 'legendary', sellPrice: 600, desc: 'Pristine dragon crest.' },
      { id: 'golden_idol', name: 'Golden Idol', count: 3, type: 'treasure', rarity: 'legendary', sellPrice: 850, desc: 'Sacred hoard.' },
      { id: 'excalibur', name: "Wyrmfang Emperor's Blade", count: 1, type: 'equipment', slot: 'weapon', rarity: 'mythic', bonusDmg: 120, bonusAttackSpeed: 0.35, element: 'fire' },
      { id: 'winged_boots', name: 'Drake-Wing Greaves', count: 1, type: 'equipment', slot: 'boots', rarity: 'legendary', bonusDef: 40, bonusSpeed: 1.2 }
    ],
    10: [
      { id: 'gold', name: 'Gold Coins (18000-30000)', count: 30000, type: 'gold', rarity: 'common' },
      { id: 'dragon_scale', name: 'Primordial Chaos Scale', count: 5, type: 'treasure', rarity: 'mythic', sellPrice: 1500, desc: 'Cosmic scale of the Primordial Titan.' },
      { id: 'golden_idol', name: 'Oblivion Golden Relic', count: 5, type: 'treasure', rarity: 'mythic', sellPrice: 2000, desc: 'Mythic relic from beyond reality.' },
      { id: 'excalibur', name: 'Titan World-Cleaver', count: 1, type: 'equipment', slot: 'weapon', rarity: 'mythic', bonusDmg: 160, bonusSwipe: 40, bonusAttackSpeed: 0.4, element: 'dark' },
      { id: 'plate_cuirass', name: 'Chaos Titan Carapace', count: 1, type: 'equipment', slot: 'armor', rarity: 'mythic', bonusDef: 130, bonusHp: 600, bonusSpeed: 0.8 }
    ]
  };

  // Helper: Normalize raw loot strings/objects into inventory-compatible item objects
  function normalizeLootItem(it) {
    if (!it) return null;
    if (typeof it === 'object') {
      const copy = { ...it };
      if (!copy.name && copy.itemId) copy.name = copy.itemId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      if (copy.amount && !copy.count) copy.count = copy.amount;
      return copy;
    }
    const str = String(it);
    if (str.toLowerCase().includes('gold')) {
      const num = parseInt(str.replace(/[^\d]/g, ''), 10) || 1;
      return { id: 'gold', name: str, count: num, type: 'gold', rarity: 'common' };
    }
    return { id: 'item', name: str, count: 1, rarity: 'common', type: 'misc' };
  }

  // Render an inventory-style slot cell with rarity border, pixel icon, count badge, and hover tooltip
  function renderLootItemSlot(itemInput, opts = {}) {
    const item = normalizeLootItem(itemInput);
    if (!item) return document.createElement('div');
    const slot = document.createElement('div');
    const rarity = item.rarity || 'common';
    slot.className = `inv-slot-compact rarity-${rarity}`;
    if (opts.customClass) slot.classList.add(opts.customClass);

    let iconHtml = '';
    if (item.type === 'gold' || item.id === 'gold') {
      iconHtml = (window.PixelIcons && window.PixelIcons.html) ? window.PixelIcons.html('coin') : '🪙';
    } else if (window.PixelIcons && window.PixelIcons.itemHtml) {
      iconHtml = window.PixelIcons.itemHtml(item);
    }

    const count = item.count || item.amount || 1;
    const badgeText = count > 1 ? (count > 9999 ? `${Math.floor(count / 1000)}k` : `${count}`) : '';

    slot.innerHTML = `
      <div class="inv-icon">${iconHtml}</div>
      ${item.upgradeLevel ? `<span class="upgrade-badge">+${item.upgradeLevel}</span>` : ''}
      ${badgeText ? `<div class="inv-badge">${badgeText}</div>` : ''}
    `;

    if (window.GameTooltip) {
      if (item.type === 'gold' || item.id === 'gold') {
        const amtStr = (count || 0).toLocaleString();
        GameTooltip.html(slot, `<div class="tip-card"><div class="tip-title" style="color:var(--gold,#facc15);">🪙 ${escapeHtml(item.name || 'Gold Coins')}</div><div class="tip-desc">${amtStr} Gold secured from the dungeon.</div></div>`);
      } else {
        GameTooltip.item(slot, item, { hint: opts.hint });
      }
    }
    return slot;
  }

  // Detail strip under the node path: shows the selected floor, or the hovered one
  function showFloorDetail(card) {
    if (!card) return;
    const playerLvl = (localPlayer && localPlayer.level) || 1;
    const minLvl = parseInt(card.dataset.min, 10) || 1;
    const locked = card.classList.contains('locked-floor');
    const detail = document.getElementById('floorDetail');
    document.getElementById('floorDetailNum').textContent = `B${card.dataset.floor}`;
    document.getElementById('floorDetailName').textContent = card.dataset.name || '';
    document.getElementById('floorDetailInfo').textContent = `Lv. ${card.dataset.min} - ${card.dataset.max} • ${card.dataset.desc || ''}`;
    const status = document.getElementById('floorDetailStatus');
    if (locked) status.textContent = `🔒 Requires Lv. ${minLvl}`;
    else if (card.classList.contains('boss-floor')) status.textContent = '💀 Final Floor';
    else status.textContent = playerLvl > (parseInt(card.dataset.max, 10) || 0) ? 'Below your level' : 'Recommended';
    if (detail) detail.classList.toggle('locked', locked);

    const lootSlots = document.getElementById('floorLootSlots');
    if (lootSlots) {
      lootSlots.innerHTML = '';
      const fl = parseInt(card.dataset.floor, 10) || 1;
      const previews = FLOOR_LOOT_PREVIEWS[fl] || FLOOR_LOOT_PREVIEWS[1] || [];
      previews.forEach(item => {
        const cell = renderLootItemSlot(item, { hint: 'Expected floor drop' });
        lootSlots.appendChild(cell);
      });
    }
  }

  const selectedFloorCard = () => Array.from(floorCards).find(c => c.classList.contains('selected'));

  floorCards.forEach(card => {
    card.addEventListener('click', () => {
      if (card.classList.contains('locked-floor')) {
        window.soundEngine.playUpgradeFail();
        return;
      }
      floorCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedDungeonFloor = parseInt(card.getAttribute('data-floor'), 10) || 1;
      showFloorDetail(card);
      window.soundEngine.playCoin();
    });
    card.addEventListener('mouseenter', () => showFloorDetail(card));
    card.addEventListener('mouseleave', () => showFloorDetail(selectedFloorCard()));
  });

  diffCards.forEach(card => {
    card.addEventListener('click', () => {
      diffCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedDungeonDifficulty = card.getAttribute('data-diff') || 'normal';
      window.soundEngine.playCoin();
    });
  });

  function openDungeonPortalModal() {
    if (dungeonPortalModal) {
      const playerLvl = (localPlayer && localPlayer.level) || 1;

      floorCards.forEach(card => {
        const fl = parseInt(card.getAttribute('data-floor'), 10) || 1;
        const minLvl = floorLevelReqs[fl] || 1;
        const isLocked = playerLvl < minLvl;

        card.classList.toggle('locked-floor', isLocked);
        if (isLocked) card.classList.remove('selected');
        card.title = isLocked ? `Requires Lv. ${minLvl}` : '';
      });

      // If currently selected floor is locked, fall back to highest unlocked floor
      const curReq = floorLevelReqs[selectedDungeonFloor] || 1;
      if (playerLvl < curReq) {
        selectedDungeonFloor = 1;
        floorCards.forEach(c => {
          if (c.getAttribute('data-floor') === '1') c.classList.add('selected');
          else c.classList.remove('selected');
        });
      }

      dungeonPortalModal.style.display = 'flex';
      const sel = selectedFloorCard();
      showFloorDetail(sel);
      if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'center' });
      window.soundEngine.playSkillWhoosh();
    }
  }

  function closeDungeonPortalModal() {
    if (dungeonPortalModal) {
      dungeonPortalModal.style.display = 'none';
    }
  }

  if (btnCloseDungeonPortal) {
    btnCloseDungeonPortal.addEventListener('click', closeDungeonPortalModal);
  }

  function enterDungeon(inviteParty) {
    socket.emit('enter_dungeon', {
      floor: selectedDungeonFloor,
      difficulty: selectedDungeonDifficulty,
      inviteParty
    });
    closeDungeonPortalModal();
    window.soundEngine.playLevelUp();
  }

  if (btnConfirmEnterDungeon) {
    btnConfirmEnterDungeon.addEventListener('click', () => enterDungeon(false));
  }
  const btnEnterDungeonWithParty = document.getElementById('btnEnterDungeonWithParty');
  if (btnEnterDungeonWithParty) {
    btnEnterDungeonWithParty.addEventListener('click', () => enterDungeon(true));
  }

  let spCatalog = null;       // SP card definitions from the server
  let enhanceRules = null;    // gear enhancement price / chance tables
  let selectedClass = 'warrior';
  let authenticatedAccount = null;

  // Character Creation Preview (3D hero showcase)
  const classPreview = (typeof window.ClassPreview === 'function' && classPreviewCanvas)
    ? new window.ClassPreview(classPreviewCanvas)
    : null;

  function applyClassSelection(cls) {
    selectedClass = cls;
    classCards.forEach(c => c.classList.toggle('selected', c.getAttribute('data-class') === cls));

    const meta = (window.CLASS_META && window.CLASS_META[cls]) || null;
    if (meta) {
      if (previewClassName) previewClassName.textContent = meta.name;
      if (previewClassRole) previewClassRole.textContent = `${meta.archetype} · ${meta.role}`;
      if (previewClassLore) previewClassLore.textContent = meta.lore;

      if (previewClassStats) {
        previewClassStats.innerHTML = Object.entries(meta.stats).map(([label, value]) => `
          <div class="class-stat-row">
            <span class="class-stat-label">${label}</span>
            <span class="class-stat-bar"><span class="class-stat-fill" style="width: ${value}%; background: ${meta.accent};"></span></span>
            <span class="class-stat-value">${value}</span>
          </div>
        `).join('');
      }
    }

    if (classPreview) classPreview.setClass(cls);
  }

  // Class Selection Setup
  classCards.forEach(card => {
    card.addEventListener('click', () => {
      applyClassSelection(card.getAttribute('data-class'));
    });
  });

  function showAuthAlert(msg, type = 'error') {
    if (!authAlertBanner) return;
    authAlertBanner.textContent = msg;
    authAlertBanner.style.display = 'block';
    authAlertBanner.className = `auth-alert-banner ${type}`;
  }

  function clearAuthAlert() {
    if (!authAlertBanner) return;
    authAlertBanner.textContent = '';
    authAlertBanner.style.display = 'none';
  }

  function switchAuthTab(mode) {
    clearAuthAlert();
    if (mode === 'login') {
      if (tabAuthLogin) tabAuthLogin.classList.add('active');
      if (tabAuthRegister) tabAuthRegister.classList.remove('active');
      if (viewAuthLogin) viewAuthLogin.style.display = 'block';
      if (viewAuthRegister) viewAuthRegister.style.display = 'none';
      if (viewCharSelect) viewCharSelect.style.display = 'none';
      if (classPreview) classPreview.stop();
    } else if (mode === 'register') {
      if (tabAuthRegister) tabAuthRegister.classList.add('active');
      if (tabAuthLogin) tabAuthLogin.classList.remove('active');
      if (viewAuthLogin) viewAuthLogin.style.display = 'none';
      if (viewAuthRegister) viewAuthRegister.style.display = 'block';
      if (viewCharSelect) viewCharSelect.style.display = 'none';
      if (regStepAccount) regStepAccount.style.display = 'block';
      if (regStepClass) regStepClass.style.display = 'none';
      if (classPreview) classPreview.stop();
    }
  }

  if (tabAuthLogin) tabAuthLogin.addEventListener('click', () => switchAuthTab('login'));
  if (tabAuthRegister) tabAuthRegister.addEventListener('click', () => switchAuthTab('register'));

  // Register: Step 1 -> Step 2
  if (btnRegToClassStep) {
    btnRegToClassStep.addEventListener('click', () => {
      clearAuthAlert();
      const u = regUsername ? regUsername.value.trim() : '';
      const p = regPassword ? regPassword.value : '';
      const cp = regConfirmPassword ? regConfirmPassword.value : '';
      const h = regHeroName ? regHeroName.value.trim() : '';

      if (!u || u.length < 3) {
        showAuthAlert('Username ต้องมีความยาวอย่างน้อย 3 ตัวอักษร');
        return;
      }
      if (!p || p.length < 4) {
        showAuthAlert('Password ต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
        return;
      }
      if (p !== cp) {
        showAuthAlert('ยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
        return;
      }
      if (!h) {
        showAuthAlert('กรุณากรอกชื่อตัวละครในเกม');
        return;
      }

      if (regStepAccount) regStepAccount.style.display = 'none';
      if (regStepClass) regStepClass.style.display = 'block';

      if (classPreview) {
        classPreview.setClass(selectedClass);
        classPreview.resize();
        classPreview.start();
      }
      window.soundEngine.playSkillWhoosh();
    });
  }

  if (btnRegBackToAccount) {
    btnRegBackToAccount.addEventListener('click', () => {
      clearAuthAlert();
      if (regStepClass) regStepClass.style.display = 'none';
      if (regStepAccount) regStepAccount.style.display = 'block';
      if (classPreview) classPreview.stop();
      window.soundEngine.playSkillWhoosh();
    });
  }

  // Submit Login
  if (btnSubmitLogin) {
    btnSubmitLogin.addEventListener('click', () => {
      clearAuthAlert();
      const u = loginUsername ? loginUsername.value.trim() : '';
      const p = loginPassword ? loginPassword.value : '';
      if (!u || !p) {
        showAuthAlert('กรุณากรอก Username และ Password');
        return;
      }
      window.soundEngine.playCoin();
      socket.emit('account_login', { username: u, password: p });
    });
  }

  if (loginPassword) {
    loginPassword.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (btnSubmitLogin) btnSubmitLogin.click();
      }
    });
  }

  // Submit Register
  if (btnSubmitRegister) {
    btnSubmitRegister.addEventListener('click', () => {
      clearAuthAlert();
      const u = regUsername ? regUsername.value.trim() : '';
      const p = regPassword ? regPassword.value : '';
      const h = regHeroName ? regHeroName.value.trim() : '';
      if (!u || !p || !h) {
        showAuthAlert('กรุณากรอกข้อมูลให้ครบถ้วน');
        return;
      }
      window.soundEngine.playLevelUp();
      socket.emit('account_register', {
        username: u,
        password: p,
        heroName: h,
        characterClass: selectedClass
      });
    });
  }

  // ---------------------------------------------------------------- character select
  let selectedSlot = 0;
  let joinedSlot = null;      // slot in the world, for reconnects
  let newCharClass = 'warrior';
  const csList = document.getElementById('csList');
  const csCreate = document.getElementById('csCreate');

  function displayCharacterCard(account, token) {
    authenticatedAccount = Object.assign({}, authenticatedAccount || {}, account, token ? { token } : {});
    const chars = authenticatedAccount.characters || [];
    if (selectedSlot >= chars.length) selectedSlot = Math.max(0, chars.length - 1);
    renderCharList();
    if (csCreate) csCreate.style.display = chars.length ? 'none' : 'flex';

    if (viewAuthLogin) viewAuthLogin.style.display = 'none';
    if (viewAuthRegister) viewAuthRegister.style.display = 'none';
    if (viewCharSelect) viewCharSelect.style.display = 'block';
    if (classPreview) classPreview.stop();
  }

  function renderCharList() {
    if (!csList || !authenticatedAccount) return;
    const chars = authenticatedAccount.characters || [];
    const max = authenticatedAccount.maxCharacters || 10;
    const count = document.getElementById('csCount');
    if (count) count.textContent = `${chars.length} / ${max}`;
    csList.innerHTML = '';
    chars.forEach(c => {
      const row = document.createElement('div');
      row.className = `cs-row ${c.slot === selectedSlot ? 'selected' : ''}`;
      const portrait = window.PixelHeroes ? PixelHeroes.portrait(c.characterClass, 40) : '';
      row.innerHTML = `<img src="${portrait}" alt="">
        <div class="cs-row-info">
          <div class="cs-row-name"></div>
          <div class="cs-row-meta">${(c.characterClass || '').toUpperCase()} - <b>Lv. ${c.level}</b> - Job ${c.jobLevel} - ${(c.gold || 0).toLocaleString()} Gold</div>
        </div>`;
      row.querySelector('.cs-row-name').textContent = c.name;
      row.addEventListener('click', () => { selectedSlot = c.slot; renderCharList(); });
      row.addEventListener('dblclick', enterWorld);
      csList.appendChild(row);
    });
    if (chars.length < max) {
      const add = document.createElement('div');
      add.className = 'cs-row cs-new';
      add.textContent = '+ CREATE NEW CHARACTER';
      add.addEventListener('click', () => {
        if (csCreate) csCreate.style.display = 'flex';
        const nameInput = document.getElementById('csNewName');
        if (nameInput) nameInput.focus();
      });
      csList.appendChild(add);
    }
    const enterBtn = document.getElementById('btnEnterWorld');
    if (enterBtn) enterBtn.disabled = !chars.length;
  }

  document.querySelectorAll('#csClassPick .cs-class-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      newCharClass = btn.dataset.class;
      document.querySelectorAll('#csClassPick .cs-class-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
  });
  const btnCsCreateConfirm = document.getElementById('btnCsCreateConfirm');
  if (btnCsCreateConfirm) {
    btnCsCreateConfirm.addEventListener('click', () => {
      const name = (document.getElementById('csNewName').value || '').trim();
      if (name.length < 2) return showAuthAlert('ชื่อตัวละครต้องมีอย่างน้อย 2 ตัวอักษร');
      socket.emit('create_character', { token: authenticatedAccount && authenticatedAccount.token, name, characterClass: newCharClass });
    });
  }
  const btnCsCreateCancel = document.getElementById('btnCsCreateCancel');
  if (btnCsCreateCancel) btnCsCreateCancel.addEventListener('click', () => { csCreate.style.display = 'none'; });
  const btnCsDelete = document.getElementById('btnCsDelete');
  if (btnCsDelete) {
    btnCsDelete.addEventListener('click', () => {
      const c = authenticatedAccount && (authenticatedAccount.characters || [])[selectedSlot];
      if (!c) return;
      const typed = window.prompt(`ลบตัวละคร "${c.name}" ถาวร? พิมพ์ชื่อตัวละครเพื่อยืนยัน`);
      if (typed === null) return;
      if (typed.trim() !== c.name) return showAuthAlert('ชื่อไม่ตรง ยกเลิกการลบ');
      socket.emit('delete_character', { token: authenticatedAccount.token, slot: selectedSlot });
    });
  }

  socket.on('character_list_response', (res) => {
    if (!res.success) {
      showAuthAlert(res.message || 'Something went wrong');
      window.soundEngine.playUpgradeFail();
      return;
    }
    const before = (authenticatedAccount.characters || []).length;
    displayCharacterCard(res.account);
    if (res.account.characters.length > before) {
      selectedSlot = res.account.characters.length - 1;   // select the new hero
      document.getElementById('csNewName').value = '';
      renderCharList();
    }
    window.soundEngine.playCoin();
  });

  function enterWorld() {
    const c = authenticatedAccount && (authenticatedAccount.characters || [])[selectedSlot];
    if (!c) return;
    window.soundEngine.init();
    window.soundEngine.playLevelUp();
    if (classPreview) classPreview.stop();
    joinedSlot = selectedSlot;
    renderer.camera.zoom = MAX_ZOOM; // every character enters fully zoomed in
    socket.emit('join_game', { token: authenticatedAccount.token, slot: selectedSlot });
    if (authModal) authModal.style.display = 'none';
    setupClassSkillHUD(c.characterClass);
  }

  // Enter World Button
  if (btnEnterWorld) btnEnterWorld.addEventListener('click', enterWorld);

  // Switch Account Button
  if (btnLogoutSwitch) {
    btnLogoutSwitch.addEventListener('click', () => {
      authenticatedAccount = null;
      joinedSlot = null;
      switchAuthTab('login');
      if (loginPassword) loginPassword.value = '';
    });
  }

  // Saved Username Autocomplete
  try {
    const savedUser = localStorage.getItem('slophero_saved_user');
    if (savedUser && loginUsername) {
      loginUsername.value = savedUser;
    }
  } catch (_) {}

  applyClassSelection(selectedClass);

  // Auto-join support for testing via URL query (e.g. ?autojoin=1)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('autojoin') === '1' || urlParams.get('autojoin') === 'true') {
    btnJoinGame.click();
  }

  window.addEventListener('pixelicons:ready', () => {
    if (localPlayer) setupClassSkillHUD(localPlayer.characterClass);
    if (skillTreeModal && skillTreeModal.style.display === 'flex') {
      if (activeSkillsModalTab === 'loadout') renderCustomSkillLoadout();
      else renderSkillTree();
    }
  });

  // Avatar portrait: head-and-shoulders crop of the hero's pixel sprite
  function heroPortraitHtml(cls) {
    if (window.PixelHeroes) {
      const url = window.PixelHeroes.portrait(cls || 'warrior', 64);
      return `<div class="portrait-sprite" style="background-image:url('${url}'); background-size: cover; background-position: center; inset: 0;"></div>`;
    }
    const classSprites = { warrior: 'swordman_idle_strip.png', mage: 'mage_idle_strip.png', rogue: 'rogue_idle_strip.png' };
    return `<div class="portrait-sprite" style="background-image:url('sprites/${classSprites[cls] || classSprites.warrior}')"></div>`;
  }

  // Skill definition by id: class skills, or an SP card's own skills
  // SP skill shapes aimed at the mouse cursor instead of the nearest monster
  const CURSOR_AIMED_SHAPES = new Set(['shuriken', 'shadow', 'spear', 'jump', 'wall', 'rune', 'banner', 'hurl', 'fault', 'boomerang', 'firebird']);
  let lastCursor = null; // canvas px of the mouse
  let shurikenRecall = null; // { slot, until }: Phantom Shuriken stars are out and can be called back

  function findSkillDef(skillId) {
    if (!skillId) return null;
    if (spCatalog && spCatalog.skills && spCatalog.skills[skillId]) return spCatalog.skills[skillId];
    if (weaponAbilities[skillId]) return weaponAbilities[skillId];
    for (const list of Object.values(allSkillsCatalog)) {
      const def = Array.isArray(list) && list.find(s => s.id === skillId);
      if (def) return def;
    }
    return null;
  }

  // Skill MP cost after the server's level scaling (player.manaCostMult)
  function manaCost(base) {
    return Math.round(base * ((localPlayer && localPlayer.manaCostMult) || 1));
  }
  window.manaCost = manaCost; // read by tooltip.js

  // The right-click ability of the equipped weapon (null without one)
  function currentWeaponAbility() {
    const weapon = localPlayer && localPlayer.equipment && localPlayer.equipment.weapon;
    return weapon ? weaponAbilities['wpn_' + weapon.id] || null : null;
  }

  function setupWeaponAbilityHUD() {
    if (!slotWeapon) return;
    const ability = currentWeaponAbility();
    if (slotWeaponIcon) SkillIcons.apply(slotWeaponIcon, ability ? ability.id : 'empty');
    slotWeapon.title = ability
      ? `${ability.name} [Right Click] (${manaCost(ability.mpCost)} MP, ${ability.cooldown}s) - ${ability.desc}`
      : 'Weapon Ability [Right Click] - equip a weapon';
    if (ability) weaponCooldownMax = ability.cooldown;
  }

  function setupClassSkillHUD(cls) {
    if (!cls) return;
    setupWeaponAbilityHUD();
    if (playerAvatarIcon) playerAvatarIcon.innerHTML = heroPortraitHtml(cls);
    const basicAttackIcons = { warrior: 'basic_attack', mage: 'basic_attack_mage', rogue: 'basic_attack_rogue' };
    const atkIconKey = basicAttackIcons[cls] || 'basic_attack';
    SkillIcons.apply(document.getElementById('slotAttackIcon'), atkIconKey);
    if (mobileAttackIcon) SkillIcons.apply(mobileAttackIcon, atkIconKey);

    // If player has equippedSkills configured:
    if (localPlayer && localPlayer.equippedSkills && allSkillsCatalog[cls]) {
      const eq = localPlayer.equippedSkills;
      const classSkills = allSkillsCatalog[cls];

      const getSlotSkill = (rawSlot, defaultIndex) => {
        const sid = typeof rawSlot === 'object' && rawSlot !== null ? rawSlot.skillId : rawSlot;
        return findSkillDef(sid) || classSkills[defaultIndex];
      };

      const getSlotRune = (slotKey) => {
        const rKey = (eq.runes && eq.runes[slotKey]) || (typeof eq[slotKey] === 'object' && eq[slotKey]?.rune) || 'none';
        return (skillRunesCatalog && skillRunesCatalog[rKey]) || { name: 'Standard', icon: '⚪', color: '#94a3b8' };
      };

      const s1 = getSlotSkill(eq.slot1, 0);
      const s2 = getSlotSkill(eq.slot2, 1);
      const s3 = getSlotSkill(eq.slot3, 2);
      const sd = getSlotSkill(eq.dash, classSkills.findIndex(s => s.isDash) >= 0 ? classSkills.findIndex(s => s.isDash) : 3);

      const r1 = getSlotRune('slot1');
      const r2 = getSlotRune('slot2');
      const r3 = getSlotRune('slot3');
      const rd = getSlotRune('dash');

      if (slotSkill1Icon && s1) SkillIcons.apply(slotSkill1Icon, s1.id);
      if (mobileSkill1Icon && s1) SkillIcons.apply(mobileSkill1Icon, s1.id);
      if (slotSkill1 && s1) slotSkill1.title = `${s1.name} [Q] (${manaCost(s1.mpCost)} MP) [${r1.icon} ${r1.name}] - ${s1.desc}`;

      if (slotSkill2Icon && s2) SkillIcons.apply(slotSkill2Icon, s2.id);
      if (mobileSkill2Icon && s2) SkillIcons.apply(mobileSkill2Icon, s2.id);
      if (slotSkill2 && s2) slotSkill2.title = `${s2.name} [E] (${manaCost(s2.mpCost)} MP) [${r2.icon} ${r2.name}] - ${s2.desc}`;

      if (slotSkill3Icon && s3) SkillIcons.apply(slotSkill3Icon, s3.id);
      if (mobileSkill3Icon && s3) SkillIcons.apply(mobileSkill3Icon, s3.id);
      if (slotSkill3 && s3) slotSkill3.title = `${s3.name} [R] (${manaCost(s3.mpCost)} MP) [${r3.icon} ${r3.name}] - ${s3.desc}`;

      if (slotDashIcon && sd) SkillIcons.apply(slotDashIcon, sd.id);
      if (mobileDashIcon && sd) SkillIcons.apply(mobileDashIcon, sd.id);
      if (slotDash && sd) slotDash.title = `${sd.name} [Shift] (${manaCost(sd.mpCost)} MP) [${rd.icon} ${rd.name}] - ${sd.desc}`;

      skill1CooldownMax = s1 ? s1.cooldown : 3.5;
      skill2CooldownMax = s2 ? s2.cooldown : 4.5;
      skill3CooldownMax = s3 ? s3.cooldown : 9.0;
      dashCooldownMax = sd ? sd.cooldown : 3.0;

      if (r1.id === 'tempest') skill1CooldownMax = Math.max(1.0, Number((skill1CooldownMax * 0.8).toFixed(1)));
      if (r2.id === 'tempest') skill2CooldownMax = Math.max(1.0, Number((skill2CooldownMax * 0.8).toFixed(1)));
      if (r3.id === 'tempest') skill3CooldownMax = Math.max(1.0, Number((skill3CooldownMax * 0.8).toFixed(1)));
      if (rd.id === 'tempest') dashCooldownMax = Math.max(1.0, Number((dashCooldownMax * 0.8).toFixed(1)));
      return;
    }

    if (cls === 'warrior') {
      if (slotSkill1Icon) SkillIcons.apply(slotSkill1Icon, 'whirlwind');
      if (mobileSkill1Icon) SkillIcons.apply(mobileSkill1Icon, 'whirlwind');
      if (slotSkill1) slotSkill1.title = 'Whirlwind Slash [Q] (14 MP) - 360° AoE Physical Spin';

      if (slotSkill2Icon) SkillIcons.apply(slotSkill2Icon, 'earthshaker');
      if (mobileSkill2Icon) SkillIcons.apply(mobileSkill2Icon, 'earthshaker');
      if (slotSkill2) slotSkill2.title = 'Earthshaker Slam [E] (16 MP) - Heavy Ground Slam & Slow';

      if (slotSkill3Icon) SkillIcons.apply(slotSkill3Icon, 'colossus_strike');
      if (mobileSkill3Icon) SkillIcons.apply(mobileSkill3Icon, 'colossus_strike');
      if (slotSkill3) slotSkill3.title = 'Colossus Strike [R] (28 MP) - Titanic Strike & Ground Shockwave';

      if (slotDashIcon) SkillIcons.apply(slotDashIcon, 'blade_charge');
      if (mobileDashIcon) SkillIcons.apply(mobileDashIcon, 'blade_charge');
      if (slotDash) slotDash.title = 'Blade Charge Dash [Shift] (10 MP) - Pierce Dash & Slice Forward';

      skill1CooldownMax = 3.5;
      skill2CooldownMax = 4.5;
      skill3CooldownMax = 9.0;
      dashCooldownMax = 3.0;
    } else if (cls === 'mage') {
      if (slotSkill1Icon) SkillIcons.apply(slotSkill1Icon, 'firestorm');
      if (mobileSkill1Icon) SkillIcons.apply(mobileSkill1Icon, 'firestorm');
      if (slotSkill1) slotSkill1.title = 'Firestorm Meteor [Q] (22 MP) - Apocalyptic Meteor & Burn DoT';

      if (slotSkill2Icon) SkillIcons.apply(slotSkill2Icon, 'frost_nova');
      if (mobileSkill2Icon) SkillIcons.apply(mobileSkill2Icon, 'frost_nova');
      if (slotSkill2) slotSkill2.title = 'Frost Nova [E] (18 MP) - Freezing Frost Ring & 50% Chill Slow';

      if (slotSkill3Icon) SkillIcons.apply(slotSkill3Icon, 'black_hole');
      if (mobileSkill3Icon) SkillIcons.apply(mobileSkill3Icon, 'black_hole');
      if (slotSkill3) slotSkill3.title = 'Singularity Black Hole [R] (35 MP) - Gravitational Vortex';

      if (slotDashIcon) SkillIcons.apply(slotDashIcon, 'arcane_blink');
      if (mobileDashIcon) SkillIcons.apply(mobileDashIcon, 'arcane_blink');
      if (slotDash) slotDash.title = 'Arcane Blink [Shift] (15 MP) - Teleport & Break Crowd Control';

      skill1CooldownMax = 4.5;
      skill2CooldownMax = 4.0;
      skill3CooldownMax = 12.0;
      dashCooldownMax = 3.5;
    } else if (cls === 'rogue') {
      if (slotSkill1Icon) SkillIcons.apply(slotSkill1Icon, 'fan_of_knives');
      if (mobileSkill1Icon) SkillIcons.apply(mobileSkill1Icon, 'fan_of_knives');
      if (slotSkill1) slotSkill1.title = 'Fan of Knives [Q] (14 MP) - 360° Lethal Dagger Flurry & High Crit';

      if (slotSkill2Icon) SkillIcons.apply(slotSkill2Icon, 'toxic_bomb');
      if (mobileSkill2Icon) SkillIcons.apply(mobileSkill2Icon, 'toxic_bomb');
      if (slotSkill2) slotSkill2.title = 'Toxic Smoke Bomb [E] (16 MP) - Chemical Fog & Poison DoT';

      if (slotSkill3Icon) SkillIcons.apply(slotSkill3Icon, 'death_blossom');
      if (mobileSkill3Icon) SkillIcons.apply(mobileSkill3Icon, 'death_blossom');
      if (slotSkill3) slotSkill3.title = 'Death Blossom [R] (30 MP) - 360° Lethal Dagger Spiral';

      if (slotDashIcon) SkillIcons.apply(slotDashIcon, 'shadow_dash');
      if (mobileDashIcon) SkillIcons.apply(mobileDashIcon, 'shadow_dash');
      if (slotDash) slotDash.title = 'Shadow Dash [Shift] (8 MP) - Swift Phantom Dash & Speed Boost';

      skill1CooldownMax = 3.0;
      skill2CooldownMax = 4.5;
      skill3CooldownMax = 8.5;
      dashCooldownMax = 2.5;
    }
  }

  // ================= NETWORKING & SOCKET EVENTS =================

  // Audio Context & City BGM Auto-Unlocker on first interaction
  const unlockAudioEngine = () => {
    window.soundEngine.init();
    window.soundEngine.updateZoneBgm(localPlayer ? (localPlayer.zone || 'town') : 'login');
  };
  window.addEventListener('pointerdown', unlockAudioEngine, { once: true });
  window.addEventListener('keydown', unlockAudioEngine, { once: true });

  // Account Authentication Listeners
  socket.on('account_register_response', (res) => {
    if (res.success && res.account) {
      try {
        localStorage.setItem('slophero_saved_user', res.account.username);
      } catch (_) {}
      displayCharacterCard(res.account, res.token);
      window.soundEngine.playLevelUp();
    } else {
      showAuthAlert(res.message || 'การสมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      window.soundEngine.playUpgradeFail();
    }
  });

  socket.on('account_login_response', (res) => {
    if (res.success && res.account) {
      try {
        localStorage.setItem('slophero_saved_user', res.account.username);
      } catch (_) {}
      displayCharacterCard(res.account, res.token);
      window.soundEngine.playCoin();
    } else {
      showAuthAlert(res.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      window.soundEngine.playUpgradeFail();
    }
  });

  socket.on('connect', () => {
    if (authenticatedAccount && authenticatedAccount.token && joinedSlot !== null) {
      socket.emit('join_game', { token: authenticatedAccount.token, slot: joinedSlot });
    } else if (localPlayer && localPlayer.name) {
      socket.emit('join_game', { name: localPlayer.name, characterClass: localPlayer.characterClass });
    }
  });

  socket.on('init_game', (data) => {
    localPlayerId = data.playerId;
    spCatalog = data.spCatalog || null;
    window.SP_CATALOG = spCatalog;
    enhanceRules = data.enhanceRules || null;
    gameState.map = data.map;
    gameState.players = data.players;
    gameState.mobs = data.mobs;
    gameState.groundItems = data.groundItems;
    shopItemsCatalog = data.shopItems || [];
    skillTreesCatalog = data.skillTrees || {};
    if (data.allSkillsCatalog) {
      allSkillsCatalog = data.allSkillsCatalog;
    } else if (data.allSkills) {
      if (Array.isArray(data.allSkills.warrior)) {
        allSkillsCatalog = data.allSkills;
      } else {
        const skillsArr = Object.values(data.allSkills);
        allSkillsCatalog = {
          warrior: skillsArr.filter(s => s.class === 'warrior').sort((a, b) => (a.reqLevel || 1) - (b.reqLevel || 1)),
          mage: skillsArr.filter(s => s.class === 'mage').sort((a, b) => (a.reqLevel || 1) - (b.reqLevel || 1)),
          rogue: skillsArr.filter(s => s.class === 'rogue').sort((a, b) => (a.reqLevel || 1) - (b.reqLevel || 1))
        };
      }
    } else {
      allSkillsCatalog = {};
    }
    skillRunesCatalog = data.skillRunes || {};
    weaponAbilities = data.weaponAbilities || {};
    window.WeaponAbilities = weaponAbilities; // read by tooltip.js

    localPlayer = data.player;
    updatePlayerHUD(localPlayer);
    setupClassSkillHUD(localPlayer.characterClass);
    requestAdminCatalog();
    renderShopBuyList();
    renderInventoryGrid();
    renderer.setCameraTarget(localPlayer.x, localPlayer.y);

    // City BGM update
    window.soundEngine.updateZoneBgm(localPlayer.zone || 'town');
  });

  // Chests are looted per player: a chest is "opened" only if we opened it
  function withOwnChestState(chests) {
    return (chests || []).map(c => ({ ...c, opened: !!(c.openedBy && c.openedBy.includes(socket.id)) }));
  }

  socket.on('zone_change', (data) => {
    gameState.map = data.map;
    gameState.players = data.players || [];
    gameState.mobs = data.mobs || [];
    gameState.groundItems = data.groundItems || [];
    gameState.chests = withOwnChestState(data.chests);

    if (data.player) {
      localPlayer = data.player;
      updatePlayerHUD(localPlayer);
      renderer.setCameraTarget(localPlayer.x, localPlayer.y);
      renderer.camera.x = renderer.camera.targetX;
      renderer.camera.y = renderer.camera.targetY;
    }

    // City BGM update when entering town or dungeon
    window.soundEngine.updateZoneBgm(data.zone || (localPlayer && localPlayer.zone) || 'town');

    if (zoneIcon && zoneText) {
      if (data.zone === 'dungeon') {
        const floorName = (data.map && data.map.name) ? data.map.name : `Dungeon Floor ${data.floorLevel || 1}`;
        const floorIcon = (data.map && data.map.icon) ? data.map.icon : 'whirl';
        zoneIcon.dataset.pxi = floorIcon;
        zoneText.textContent = `B${data.floorLevel || 1}: ${floorName}`;
        window.soundEngine.playSkillWhoosh();
      } else if (data.zone === 'frostfell') {
        zoneIcon.dataset.pxi = 'snow';
        zoneText.textContent = `Frostfell Peaks${data.zoneLevel ? ' (' + data.zoneLevel + ')' : ''}`;
        window.soundEngine.playFrostNova();
      } else if (data.zoneName) {
        zoneIcon.dataset.pxi = 'compass';
        zoneText.textContent = `${data.zoneName}${data.zoneLevel ? ' (' + data.zoneLevel + ')' : ''}`;
        window.soundEngine.playSkillWhoosh();
      } else {
        zoneIcon.dataset.pxi = 'castle';
        zoneText.textContent = 'Town of Slop Hero';
        window.soundEngine.playLevelUp();
      }
    }

    // Field raid / world boss widget: show while a raid boss is up in this zone
    if (data.raid && data.raid.active) {
      showRaidWidget(data.raid);
    } else {
      hideRaidWidget();
    }
  });

  // ---------------------------------------------------------------- field raid / world boss
  const raidPanel = document.getElementById('raidPanel');
  const raidNameEl = document.getElementById('raidName');
  const raidHpFill = document.getElementById('raidHpFill');
  const raidTimerEl = document.getElementById('raidTimer');
  const raidDmgRow = document.getElementById('raidDmgRow');
  const raidCountEl = document.getElementById('raidCount');
  const raidYouEl = document.getElementById('raidYou');

  function hideRaidWidget() {
    if (raidPanel) raidPanel.style.display = 'none';
  }

  function showRaidWidget(info) {
    if (!raidPanel) return;
    raidPanel.style.display = 'block';
    if (raidNameEl) raidNameEl.textContent = `${info.name || 'Raid Boss'}${info.level ? ` (Lv. ${info.level})` : ''}`;
    const pct = info.maxHp ? Math.max(0, Math.min(100, (info.hp / info.maxHp) * 100)) : 100;
    if (raidHpFill) raidHpFill.style.width = `${pct}%`;
    if (raidTimerEl) {
      raidTimerEl.textContent = info.endsIn != null && info.endsIn >= 0
        ? `⏳ ${Math.floor(info.endsIn / 60)}:${String(Math.floor(info.endsIn % 60)).padStart(2, '0')}`
        : '';
    }
    const top = info.top || [];
    const medals = ['🥇', '🥈', '🥉'];
    let html = '';
    top.slice(0, 3).forEach((r, i) => {
      const me = r.id === localPlayerId ? ' rd-you' : '';
      html += `<div class="rd-line rd-${i + 1}${me}">${medals[i]} ${escapeHtml(r.name)}<span>${r.dmg.toLocaleString()}</span></div>`;
    });
    if (raidDmgRow) raidDmgRow.innerHTML = html;
    if (raidCountEl) raidCountEl.textContent = `${info.count || 0} Raider${(info.count || 0) === 1 ? '' : 's'}`;
    if (raidYouEl) {
      const myIdx = top.findIndex(r => r.id === localPlayerId);
      raidYouEl.textContent = myIdx >= 0
        ? `You: #${myIdx + 1} · ${top[myIdx].dmg.toLocaleString()} dmg`
        : 'Strike the boss to enter the board!';
    }
  }

  socket.on('raid_spawn', (data) => showRaidWidget(data));
  socket.on('raid_leaderboard', (data) => showRaidWidget(data));
  socket.on('raid_gone', () => hideRaidWidget());
  socket.on('raid_reward', (data) => {
    if (!data) return;
    const parts = [
      data.gold ? `+${data.gold.toLocaleString()} Gold` : null,
      data.exp ? `+${data.exp.toLocaleString()} EXP` : null,
      data.fragments ? `+${data.fragments} Fragments` : null
    ].filter(Boolean);
    appendChatMessage({
      senderClass: 'system',
      text: `🏆 RAID REWARD (${data.label || 'Reward'} ${data.rank}/${data.total}): ${parts.join(', ') || '—'} from [${data.bossName || 'the Raid Boss'}].`
    });
  });

  if (zoneBadge) {
    zoneBadge.style.cursor = 'pointer';
    zoneBadge.title = 'Click to Teleport (Town <-> Dungeon)';
    zoneBadge.addEventListener('click', () => {
      if (!localPlayer) return;
      if (localPlayer.zone === 'town') {
        openDungeonPortalModal();
      } else {
        confirmLeaveDungeon(() => socket.emit('leave_dungeon'));
      }
    });
  }

  socket.on('open_dungeon_portal_modal', () => {
    openDungeonPortalModal();
  });

  socket.on('game_tick', (tickData) => {
    const incomingPlayers = tickData.players || [];
    incomingPlayers.forEach(p => {
      const existing = gameState.players.find(oldP => oldP.id === p.id);
      if (existing) {
        existing.targetX = p.x;
        existing.targetY = p.y;
        existing.facing = p.facing;
        existing.isMoving = p.isMoving;
        existing.hp = p.hp;
        existing.maxHp = p.maxHp;
        existing.mp = p.mp;
        existing.maxMp = p.maxMp;
        existing.level = p.level;
        existing.gold = p.gold;
        existing.speechBubble = p.speechBubble;
        existing.isDead = p.isDead;
        existing.statusEffects = p.statusEffects || [];
        // bag / gear / talents only arrive when they change (see broadcastSnapshot)
        if (p.inventory) existing.inventory = p.inventory;
        if (p.equipment) existing.equipment = p.equipment;
        if (p.baseStats) existing.baseStats = p.baseStats;
        existing.dmg = p.dmg;
        existing.mastery = p.mastery;
        existing.def = p.def;
        existing.speed = p.speed;
        if (p.elementResist) existing.elementResist = p.elementResist;
        existing.jobLevel = p.jobLevel;
        existing.spTransformed = p.spTransformed;
        existing.spCardId = p.spCardId;
        existing.spLevel = p.spLevel;
        existing.spToggles = p.spToggles || [];
        existing.buffs = p.buffs || [];
        existing.skillPoints = p.skillPoints !== undefined ? p.skillPoints : (existing.skillPoints || 0);
        existing.skills = p.skills || existing.skills || {};
        existing.equippedSkills = p.equippedSkills || existing.equippedSkills;
      } else {
        p.targetX = p.x;
        p.targetY = p.y;
        // a tick without the heavy fields: keep what we already know about ourselves
        if (p.id === localPlayerId && localPlayer) {
          for (const k of ['inventory', 'equipment', 'baseStats', 'skills', 'equippedSkills', 'elementResist']) {
            if (p[k] === undefined) p[k] = localPlayer[k];
          }
        }
        gameState.players.push(p);
      }
    });
    gameState.players = gameState.players.filter(oldP => incomingPlayers.some(p => p.id === oldP.id));

    if (localPlayer) {
      const isTown = localPlayer.zone === 'town';
      const isDungeonZone = localPlayer.zone === 'dungeon';
      const incomingMobs = isTown ? (tickData.townMobs || [])
        : isDungeonZone ? (tickData.dungeonMobs || [])
        : ((tickData.fieldMobs && tickData.fieldMobs[localPlayer.zone]) || []);
      
      const knownMobs = new Map(gameState.mobs.map(oldM => [oldM.id, oldM]));
      const incomingIds = new Set();
      // dungeon ticks are diffs between full refreshes: unchanged mobs are left out
      const mobDiff = isDungeonZone && tickData.dungeonMobsFull === false;
      incomingMobs.forEach(m => {
        incomingIds.add(m.id);
        const existingMob = knownMobs.get(m.id);
        if (existingMob) {
          existingMob.targetX = m.x;
          existingMob.targetY = m.y;
          existingMob.facing = m.facing;
          // hp dropped -> the monster just got hit: pop the impact slash on it
          if ((m.hp != null) && existingMob.hp !== undefined && m.hp < existingMob.hp && renderer) {
            renderer.queueMobHit(m.id, existingMob.hp - m.hp, m.x, m.y);
          }
          existingMob.hp = m.hp;
          existingMob.maxHp = m.maxHp;
          existingMob.state = m.state;
          existingMob.buffs = m.buffs || [];
          existingMob.isCommander = !!m.isCommander;
          existingMob.auraRadius = m.auraRadius || 0;
          existingMob.hasCommanderBuff = !!m.hasCommanderBuff;
          // mage card states (frozen / stasis, Scorch & Frost stacks)
          existingMob.frozen = m.frozen || 0;
          existingMob.scorch = m.scorch || 0;
          existingMob.frost = m.frost || 0;
        } else if (m.type) {
          // (a delta-only entry for a mob we never got in full waits for the next full one)
          m.targetX = m.x;
          m.targetY = m.y;
          gameState.mobs.push(m);
        }
      });
      if (mobDiff) {
        const gone = new Set(tickData.dungeonMobsGone || []);
        if (gone.size) gameState.mobs = gameState.mobs.filter(oldM => !gone.has(oldM.id));
      } else {
        gameState.mobs = gameState.mobs.filter(oldM => incomingIds.has(oldM.id));
      }

      if (!isDungeonZone) gameState.chests = [];
      else if (tickData.dungeonChests) gameState.chests = withOwnChestState(tickData.dungeonChests);

      const me = gameState.players.find(p => p.id === localPlayerId);
      if (me) {
        localPlayer = me;
        updatePlayerHUD(me);
        renderer.setCameraTarget(me.x, me.y);

        if (me.isDead) {
          if (deathScreen) deathScreen.classList.add('active');
        } else {
          if (deathScreen) deathScreen.classList.remove('active');
        }
      }
    }

    // Update target HUD with Elemental Badge and Weaknesses
    if (selectedTargetId && gameState.mobs) {
      const mob = gameState.mobs.find(m => m.id === selectedTargetId);
      if (mob && mob.state !== 'dead') {
        targetHud.classList.add('active');
        targetName.textContent = `${mob.name} (Lv. ${mob.level})`;
        const hpPct = Math.round((mob.hp / mob.maxHp) * 100);
        targetHpFill.style.width = `${hpPct}%`;
        targetIcon.dataset.pxi = mob.isBoss ? 'crown' : mob.isMiniboss ? 'sword' : 'skull';

        const elemBadge = document.getElementById('targetElementBadge');
        const weakRow = document.getElementById('targetWeaknessRow');
        if (elemBadge) {
          const elem = mob.element || 'neutral';
          const elemNames = { fire: '🔥 Fire', ice: '❄️ Ice', lightning: '⚡ Lightning', earth: '🌿 Earth', holy: '✨ Holy', dark: '🌑 Dark', neutral: '⚪ Neutral' };
          elemBadge.textContent = elemNames[elem] || elem.toUpperCase();
          elemBadge.className = `target-element-badge elem-${elem}`;
          elemBadge.style.display = 'inline-flex';
        }
        if (weakRow) {
          if (mob.elementResist && Object.keys(mob.elementResist).length > 0) {
            const weaknesses = [];
            const resists = [];
            for (const [k, v] of Object.entries(mob.elementResist)) {
              const icon = k === 'fire' ? '🔥' : k === 'ice' ? '❄️' : k === 'lightning' ? '⚡' : k === 'earth' ? '🌿' : k === 'holy' ? '✨' : k === 'dark' ? '🌑' : '';
              if (v < 0) weaknesses.push(`${icon} +${Math.round(Math.abs(v) * 100)}%`);
              else if (v > 0) resists.push(`${icon} -${Math.round(v * 100)}%`);
            }
            let infoText = '';
            if (weaknesses.length > 0) infoText += `Weak: ${weaknesses.join(' ')} `;
            if (resists.length > 0) infoText += `| Resist: ${resists.join(' ')}`;
            weakRow.textContent = infoText.trim();
            weakRow.style.display = infoText ? 'block' : 'none';
          } else {
            weakRow.style.display = 'none';
          }
        }
      } else {
        targetHud.classList.remove('active');
        selectedTargetId = null;
        const elemBadge = document.getElementById('targetElementBadge');
        if (elemBadge) elemBadge.style.display = 'none';
        const weakRow = document.getElementById('targetWeaknessRow');
        if (weakRow) weakRow.style.display = 'none';
      }
    }

    if (onlineCountText) {
      const count = gameState.players.length;
      onlineCountText.textContent = `${count} Hero${count > 1 ? 'es' : ''} Online`;
    }
  });

  socket.on('player_updated', (updatedPlayer) => {
    if (updatedPlayer.role === 'admin' && !adminCatalog) requestAdminCatalog();
    localPlayer = updatedPlayer;
    updatePlayerHUD(localPlayer);
    setupClassSkillHUD(localPlayer.characterClass);
    renderInventoryGrid();
    renderShopSellList();
    if (enchanterModal && enchanterModal.style.display === 'flex') renderEnchanter();
    if (shopPlayerGold) shopPlayerGold.textContent = localPlayer.gold;
    if (skillTreeModal && skillTreeModal.style.display === 'flex') {
      if (activeSkillsModalTab === 'loadout') {
        renderCustomSkillLoadout();
      } else {
        renderSkillTree();
      }
    }
  });

  socket.on('skill_tree_updated', (data) => {
    if (localPlayer) {
      localPlayer.skillPoints = data.skillPoints;
      localPlayer.skills = data.skills;
    }
    renderSkillTree();
  });

  socket.on('custom_skills_updated', (data) => {
    if (localPlayer) {
      localPlayer.equippedSkills = data.equippedSkills;
      setupClassSkillHUD(localPlayer.characterClass);
      if (skillTreeModal && skillTreeModal.style.display === 'flex' && activeSkillsModalTab === 'loadout') {
        renderCustomSkillLoadout();
      }
    }
  });

  socket.on('item_dropped', (item) => {
    if (localPlayer && item.zone === localPlayer.zone && gameState.groundItems) {
      if (!gameState.groundItems.some(i => i.id === item.id)) {
        gameState.groundItems.push(item);
      }
    }
  });

  socket.on('item_despawned', (data) => {
    gameState.groundItems = gameState.groundItems.filter(i => i.id !== data.itemId);
    if (renderer) renderer.addParticles(data.x, data.y, 'dust', 4);
  });

  socket.on('item_picked', (data) => {
    gameState.groundItems = gameState.groundItems.filter(i => i.id !== data.itemId);
    if (data.pickerId === localPlayerId) {
      window.soundEngine.playCoin();
      if (renderer) renderer.addParticles(localPlayer.x, localPlayer.y, 'gold', 8);
    }
  });

  socket.on('chest_opened', (data) => {
    window.soundEngine.playLevelUp();
    if (gameState.chests) {
      const chest = gameState.chests.find(c => c.id === data.chestId);
      if (chest) chest.opened = true;
    }
  });

  socket.on('entity_attack_fx', (fx) => {
    // Only trigger animation for other players/mobs (local player already triggered client-side with zero latency)
    if (renderer && fx.attackerId !== localPlayerId) {
      renderer.triggerAttackAnimation(fx);
    }

    if (fx.attackerType === 'player') {
      if (fx.class === 'mage') {
        window.soundEngine.playFireball();
      } else {
        if (fx.hasSweep && window.soundEngine.playSweepingEdge) {
          window.soundEngine.playSweepingEdge();
        } else {
          window.soundEngine.playSlash();
        }
      }
    } else {
      window.soundEngine.playHit();
    }
  });

  // SP card skills: pick a sound from the skill's shape and element
  function playSpSkillSound(fx) {
    const se = window.soundEngine;
    // variant warrior signature shapes
    const VARIANT = {
      fault: 'playEarthshaker', spear: 'playShuriken', jump: 'playBlink', wall: 'playFireball', rune: 'playTargetLock',
      invoke: 'playExplosion', ricochet: 'playShuriken', phantom: 'playShadowDash', hurl: 'playEarthshaker',
      banner: 'playShield', rally: 'playBladeCharge', boomerang: 'playSweepingEdge', firebird: 'playFireball', sacrifice: 'playExplosion'
    };
    if (VARIANT[fx.shape] && se[VARIANT[fx.shape]]) return se[VARIANT[fx.shape]]();
    if (fx.shape === 'aura') return fx.off ? se.playSkillWhoosh() : se.playBerserk();
    if (fx.shape === 'blink') return se.playBlink();
    if (fx.shape === 'dash') return se.playBladeCharge();
    if (fx.shape === 'pull') return se.playSingularity();
    if (fx.shape === 'buff') return se.playShield();
    if (fx.element === 'lightning') return se.playThunder();
    if (fx.element === 'ice') return se.playFrostNova();
    if (fx.element === 'earth') return se.playToxicBomb();
    if (fx.shape === 'volley' || fx.shape === 'chain') return se.playFanOfKnives();
    if (fx.element === 'fire' || fx.shape === 'blast' || fx.shape === 'rain') return se.playExplosion();
    if (fx.shape === 'nova' || fx.shape === 'pulse') return se.playEarthshaker();
    return se.playSkillWhoosh();
  }

  socket.on('skill_fx', (fx) => {
    if (renderer) renderer.addSkillEffect(fx);

    // follow-up beats of variant warrior skills (landings, bursts) get their own sound
    if (fx.type === 'sp_skill' && !fx.playerId) {
      const se = window.soundEngine;
      if (fx.shape === 'jump' && fx.landed) se.playEarthshaker();
      else if (fx.shape === 'spear' && fx.dive) se.playThunder();
      else if (fx.shape === 'rune' && fx.burst) se.playExplosion();
      else if (fx.shape === 'doom' && fx.burst) se.playSingularity();
      else if (fx.shape === 'riposte') se.playShield();
      else if (fx.shape === 'rebirth') se.playFireball();
    }

    // Phantom Shuriken stars / a planted Sky Lance: the next press recalls (dives), cooldown or not
    if (fx.type === 'sp_skill' && (fx.shape === 'shuriken' || fx.shape === 'spear') && fx.ownerId === localPlayerId) {
      if (fx.recall || fx.dive) {
        shurikenRecall = null;
        window.soundEngine.playFanOfKnives();
      } else if (fx.skillSlot) {
        shurikenRecall = { slot: fx.skillSlot, until: performance.now() + (fx.duration || 5) * 1000 - 150 };
      }
    }

    if (fx.playerId === localPlayerId) {
      const slot = fx.skillSlot === 'skill1' ? 'slot1' : fx.skillSlot === 'skill2' ? 'slot2' : fx.skillSlot === 'skill3' ? 'slot3' : fx.skillSlot;
      if (slot === 'slot1') {
        skill1CooldownMax = fx.cooldown || skill1CooldownMax;
        skill1CooldownTimer = skill1CooldownMax;
        skillCooldownTimer = skill1CooldownTimer;
        skillCooldownMax = skill1CooldownMax;
      } else if (slot === 'slot2') {
        skill2CooldownMax = fx.cooldown || skill2CooldownMax;
        skill2CooldownTimer = skill2CooldownMax;
      } else if (slot === 'slot3') {
        skill3CooldownMax = fx.cooldown || skill3CooldownMax;
        skill3CooldownTimer = skill3CooldownMax;
      } else if (slot === 'dash') {
        dashCooldownMax = fx.cooldown || dashCooldownMax;
        dashCooldownTimer = dashCooldownMax;
      } else if (slot === 'weapon') {
        weaponCooldownMax = fx.cooldown || weaponCooldownMax;
        weaponCooldownTimer = weaponCooldownMax;
      } else {
        skill1CooldownMax = fx.cooldown || skill1CooldownMax;
        skill1CooldownTimer = skill1CooldownMax;
      }
    }

    if (fx.type === 'sp_skill') {
      if (fx.playerId) playSpSkillSound(fx);
    } else if (fx.type === 'whirlwind') {
      window.soundEngine.playSkillWhoosh();
    } else if (fx.type === 'blade_charge') {
      window.soundEngine.playBladeCharge();
    } else if (fx.type === 'earthshaker' || fx.type === 'colossus_strike' || fx.type === 'war_stomp') {
      window.soundEngine.playEarthshaker();
    } else if (fx.type === 'shield_slam' || fx.type === 'iron_fortress' || fx.type === 'mana_shield') {
      window.soundEngine.playShield();
    } else if (fx.type === 'blood_rage') {
      window.soundEngine.playBerserk();
    } else if (fx.type === 'firestorm' || fx.type === 'pyroblast') {
      window.soundEngine.playExplosion();
    } else if (fx.type === 'frost_nova' || fx.type === 'blizzard') {
      window.soundEngine.playFrostNova();
    } else if (fx.type === 'arcane_blink' || fx.type === 'shadowstep') {
      window.soundEngine.playBlink();
    } else if (fx.type === 'chain_lightning') {
      window.soundEngine.playThunder();
    } else if (fx.type === 'black_hole') {
      window.soundEngine.playSingularity();
    } else if (fx.type === 'fan_of_knives' || fx.type === 'poison_darts') {
      window.soundEngine.playFanOfKnives();
    } else if (fx.type === 'toxic_bomb' || fx.type === 'smoke_screen') {
      window.soundEngine.playToxicBomb();
    } else if (fx.type === 'shadow_dash') {
      window.soundEngine.playShadowDash();
    } else if (fx.type === 'death_blossom') {
      window.soundEngine.playBlossom();
    } else if (fx.type === 'caltrops') {
      window.soundEngine.playShuriken();
    } else {
      window.soundEngine.playSkillWhoosh();
    }
  });

  socket.on('projectile_spawned', (data) => {
    if (renderer && localPlayer && data.zone === localPlayer.zone) renderer.addProjectile(data);
  });

  socket.on('projectile_exploded', (data) => {
    window.soundEngine.playExplosion();
    if (renderer) renderer.explodeProjectile(data);
  });

  // The server batches zone-wide texts (damage numbers) once per tick
  socket.on('floating_texts', (list) => {
    if (!Array.isArray(list)) return;
    for (const d of list) renderer.addFloatingText(d.x, d.y, d.text, d.color, d.size || 16);
  });
  socket.on('floating_text', (data) => {
    renderer.addFloatingText(data.x, data.y, data.text, data.color, data.size || 16);
  });

  socket.on('level_up', (data) => {
    if (data.playerId === localPlayerId) {
      window.soundEngine.playLevelUp();
    }
    renderer.addParticles(data.x, data.y, 'level', 30);
  });

  socket.on('reforge_result', (data) => {
    window.soundEngine.playAnvil();
    if (renderer) renderer.triggerScreenShake(data.success ? 8 : 4, 0.22);

    setTimeout(() => {
      if (data.success) {
        window.soundEngine.playUpgradeSuccess();
        if (renderer && localPlayer) {
          renderer.addParticles(localPlayer.x, localPlayer.y, 'level', 25);
        }
      } else {
        window.soundEngine.playUpgradeFail();
      }

      if (selectedReforgeTarget) {
        selectedReforgeTarget.item = data.item;
      }
      renderReforgeItemsList();
      renderInventoryGrid();
    }, 180);
  });

  socket.on('chat_broadcast', (msg) => {
    appendChatMessage(msg);
    if (msg && msg.senderClass && msg.senderClass.includes('admin-feedback')) {
      pushAdminLog(msg.text);
      // a successful /op turns the menu on
      if (!adminCatalog && /Admin/.test(msg.text) && msg.text.includes('👑')) requestAdminCatalog();
    }
  });

  // Death Screen & Revival Stone Handling
  const btnUseRevivalStone = document.getElementById('btnUseRevivalStone');
  const revivalStoneCount = document.getElementById('revivalStoneCount');
  const btnUseSuperRevivalStone = document.getElementById('btnUseSuperRevivalStone');
  const superRevivalStoneCount = document.getElementById('superRevivalStoneCount');

  if (btnUseRevivalStone) {
    btnUseRevivalStone.addEventListener('click', () => {
      socket.emit('use_revival_stone');
      window.soundEngine.playLevelUp();
    });
  }
  if (btnUseSuperRevivalStone) {
    btnUseSuperRevivalStone.addEventListener('click', () => {
      socket.emit('use_revival_stone', { super: true });
      window.soundEngine.playLevelUp();
    });
  }

  // One button per stone the hero carries: normal (30% HP) and super (100% HP)
  function updateDeathScreenRevivalButton() {
    if (!localPlayer) return;
    const invItems = (localPlayer.inventory && localPlayer.inventory.items) || [];
    const show = (btn, label, id) => {
      if (!btn) return;
      const stone = invItems.find(i => i.id === id);
      const count = stone ? (stone.count || 1) : 0;
      if (label) label.textContent = count;
      btn.style.display = count > 0 ? 'inline-block' : 'none';
    };
    show(btnUseRevivalStone, revivalStoneCount, 'revival_stone');
    show(btnUseSuperRevivalStone, superRevivalStoneCount, 'super_revival_stone');
  }

  socket.on('player_died', (data) => {
    if (data.playerId === localPlayerId) {
      updateDeathScreenRevivalButton();
      if (deathScreen) deathScreen.classList.add('active');
    }
  });

  socket.on('player_respawned', (data) => {
    if (data.playerId === localPlayerId) {
      if (deathScreen) deathScreen.classList.remove('active');
    }
  });

  // ================= DUNGEON RUN: LOOT BAG & RESULT =================
  // Chest loot is held by the server until the boss dies; leaving early is a
  // failed run that only keeps part of it.
  let dungeonRunState = { active: false };

  const runBagPanel = document.createElement('div');
  runBagPanel.className = 'dungeon-run-bag hud-panel';
  runBagPanel.style.display = 'none';
  document.body.appendChild(runBagPanel);

  socket.on('dungeon_doors_opened', (data) => {
    const map = gameState.map;
    if (!map || !map.isDungeon || !data || !data.doors) return;
    for (const d of data.doors) {
      for (const [x, y] of d.tiles) if (map.tiles[y]) map.tiles[y][x] = 4;
      map._tilesVersion = (map._tilesVersion || 0) + 1; // repaint cached ground & minimap
      map.obstacles = (map.obstacles || []).filter(o => o.id !== d.id);
      if (renderer) renderer.addParticles(d.x, d.y, d.boss ? 'fire' : 'gold', 18);
    }
    window.soundEngine.playCoin();
  });

  // A room just opened: its monsters rise out of summoning circles
  socket.on('dungeon_mobs_spawned', (data) => {
    if (renderer && data && data.mobs) renderer.triggerMobSpawn(data.mobs);
  });

  // Run timer: server elapsed time, advanced locally between updates
  let runStartLocal = 0;
  const fmtDuration = (ms) => {
    const sec = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  };
  setInterval(() => {
    const el = document.getElementById('runTimerValue');
    if (el && dungeonRunState.active && !dungeonRunState.cleared) el.textContent = fmtDuration(Date.now() - runStartLocal);
  }, 250);

  // Right-side dungeon panel: timer, progress, loot bag and Return to Town
  socket.on('dungeon_run_update', (data) => {
    dungeonRunState = data || { active: false };
    if (renderer) renderer.dungeonClearedRooms = new Set(dungeonRunState.clearedRooms || []);
    if (dungeonRunState.active && dungeonRunState.startedAt) {
      runStartLocal = Date.now() - ((dungeonRunState.serverNow || Date.now()) - dungeonRunState.startedAt);
    }
    if (!dungeonRunState.active) {
      runBagPanel.style.display = 'none';
      return;
    }
    const st = dungeonRunState;
    const items = st.items || [];
    const lootItems = (st.lootItems && st.lootItems.length) ? st.lootItems : items;
    const time = st.cleared && st.clearedMs != null ? st.clearedMs : Date.now() - runStartLocal;
    runBagPanel.style.display = 'flex';
    runBagPanel.innerHTML = `
      <div class="run-head">
        <span class="run-floor">B${st.floor || '?'} - ${(st.difficulty || 'normal').toUpperCase()}</span>
        <span class="run-state ${st.cleared ? 'is-cleared' : ''}">${st.cleared ? 'CLEARED' : 'IN PROGRESS'}</span>
      </div>
      <div class="run-clock ${st.cleared ? 'is-cleared' : ''}" id="runTimerValue">${fmtDuration(time)}</div>
      <div class="run-stats">
        <div><b>${st.roomsCleared || 0}/${st.roomsTotal || 0}</b><span>ROOMS</span></div>
        <div><b>${st.deaths || 0}</b><span>DEATHS</span></div>
        <div><b>${(st.gold || 0).toLocaleString()}</b><span>GOLD</span></div>
        <div><b>${lootItems.length}</b><span>ITEMS</span></div>
      </div>
      <div class="run-bag-header">
        <span class="run-bag-title">🎒 ESCROWED LOOT</span>
        <span class="run-bag-count">${lootItems.length} item(s)</span>
      </div>
      <div class="run-bag-grid" id="runBagGrid"></div>
      <div class="run-note">${st.cleared ? 'All chest loot is secured.' : 'Defeat the boss to keep your loot. Leaving now fails the run.'}</div>
      <button class="run-leave-btn ${st.cleared ? 'is-safe' : ''}" id="btnRunLeave">${PixelIcons.html('castle')} RETURN TO TOWN</button>
    `;

    const bagGrid = document.getElementById('runBagGrid');
    if (bagGrid) {
      let count = 0;
      if (st.gold > 0) {
        bagGrid.appendChild(renderLootItemSlot({ id: 'gold', name: `${st.gold.toLocaleString()} Gold`, count: st.gold, type: 'gold', rarity: 'common' }, { hint: 'Escrowed dungeon gold' }));
        count++;
      }
      lootItems.forEach(it => {
        bagGrid.appendChild(renderLootItemSlot(it, { hint: 'Chest reward (at risk)' }));
        count++;
      });
      if (count === 0) {
        bagGrid.innerHTML = '<div class="run-bag-empty">No loot found yet. Open room chests!</div>';
      }
    }

    document.getElementById('btnRunLeave').addEventListener('click', () => {
      confirmLeaveDungeon(() => socket.emit('leave_dungeon'));
    });
  });

  socket.on('dungeon_result', (data) => {
    const overlay = document.createElement('div');
    overlay.className = `dungeon-result-overlay ${data.success ? 'is-success' : 'is-failed'}`;
    const keptList = (data.keptItems && data.keptItems.length) ? data.keptItems : (data.kept || []);
    const lostList = (data.lostItems && data.lostItems.length) ? data.lostItems : (data.lost || []);

    if (data.success && data.rank) {
      const r = data.rewards || {};
      const diffLabel = (data.difficulty || 'normal').toUpperCase();
      overlay.innerHTML = `
        <div class="dungeon-result-card hud-panel v2">
          <div class="dr-top">
            <div class="dr-rank rank-${data.rank}">${data.rank}</div>
            <div class="dr-heading">
              <div class="dungeon-result-title">CONGRATULATIONS!</div>
              <div class="dungeon-result-sub">${escapeHtml(data.bossName || 'The boss')} has fallen - ${escapeHtml(data.floorName || 'Dungeon')} B${data.floor} (${diffLabel})</div>
            </div>
          </div>
          <div class="dr-stats">
            <div class="dr-stat"><b>${fmtDuration(data.timeMs || 0)}</b><span>Clear time</span></div>
            <div class="dr-stat"><b>${data.deaths || 0}</b><span>Deaths</span></div>
            <div class="dr-stat"><b>${data.kills || 0}</b><span>Kills</span></div>
            <div class="dr-stat"><b>${data.roomsCleared || 0}/${data.roomsTotal || 0}</b><span>Rooms</span></div>
          </div>
          <div class="dr-rewards">
            <div class="dr-reward-row"><span>Chest gold</span><b>${(r.chestGold || 0).toLocaleString()} G</b></div>
            <div class="dr-reward-row"><span>Clear bonus (rank ${data.rank})</span><b>+${(r.bonusGold || 0).toLocaleString()} G</b></div>
            <div class="dr-reward-row"><span>EXP earned in the run</span><b>${(r.runExp || 0).toLocaleString()}</b></div>
            <div class="dr-reward-row"><span>Clear bonus EXP</span><b>+${(r.bonusExp || 0).toLocaleString()}</b></div>
          </div>
          <div class="dr-loot-section">
            <div class="dr-loot-title">✨ SECURED CHEST REWARDS (${keptList.length})</div>
            <div class="dr-loot-grid" id="drKeptGrid"></div>
          </div>
          <button class="btn-primary dungeon-result-close">CONTINUE</button>
        </div>`;

      const grid = overlay.querySelector('#drKeptGrid');
      if (grid) {
        if (keptList.length > 0) {
          keptList.forEach(it => grid.appendChild(renderLootItemSlot(it, { hint: 'Secured dungeon reward' })));
        } else {
          grid.innerHTML = '<div class="run-bag-empty">No item drops in this run.</div>';
        }
      }
    } else {
      overlay.innerHTML = `
        <div class="dungeon-result-card hud-panel">
          <div class="dungeon-result-title">${data.success ? 'DUNGEON CLEARED' : 'MISSION FAILED'}</div>
          <div class="dungeon-result-sub">${data.success
            ? 'The boss has fallen. All chest loot is yours.'
            : 'You left before defeating the boss. Most of the chest loot was lost.'}</div>
          <div class="dungeon-result-lists">
            <div class="dr-loot-section">
              <div class="dr-loot-title" style="color: var(--lime, #4ade80);">🎒 KEPT REWARDS (${keptList.length})</div>
              <div class="dr-loot-grid" id="drKeptGrid"></div>
            </div>
            ${lostList.length ? `
            <div class="dr-loot-section">
              <div class="dr-loot-title" style="color: var(--crimson, #ef4444);">💀 LOST TO THE DUNGEON (${lostList.length})</div>
              <div class="dr-loot-grid" id="drLostGrid"></div>
            </div>` : ''}
            ${(!keptList.length && !lostList.length) ? '<div class="result-empty">No chest loot collected this run.</div>' : ''}
          </div>
          <button class="btn-primary dungeon-result-close">CONTINUE</button>
        </div>`;

      const keptGrid = overlay.querySelector('#drKeptGrid');
      if (keptGrid) {
        if (keptList.length > 0) {
          keptList.forEach(it => keptGrid.appendChild(renderLootItemSlot(it, { hint: 'Kept reward' })));
        } else {
          keptGrid.innerHTML = '<div class="run-bag-empty">No items kept.</div>';
        }
      }
      const lostGrid = overlay.querySelector('#drLostGrid');
      if (lostGrid && lostList.length) {
        lostList.forEach(it => lostGrid.appendChild(renderLootItemSlot(it, { hint: 'Lost to dungeon' })));
      }
    }
    document.body.appendChild(overlay);
    overlay.querySelector('.dungeon-result-close').addEventListener('click', () => overlay.remove());
    if (data.success) window.soundEngine.playLevelUp();
  });

  // Ask (with an in-game dialog) before leaving a dungeon run that has not been cleared yet
  function confirmLeaveDungeon(onLeave) {
    if (!dungeonRunState.active || dungeonRunState.cleared) return onLeave();
    if (document.querySelector('.leave-confirm-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'dungeon-result-overlay leave-confirm-overlay is-failed';
    overlay.innerHTML = `
      <div class="dungeon-result-card hud-panel">
        <div class="dungeon-result-title">LEAVE DUNGEON?</div>
        <div class="dungeon-result-sub">The boss is still alive. Leaving now counts as a <b>FAILED</b> mission and you will lose most of the chest loot.</div>
        <div class="leave-confirm-actions">
          <button class="btn-secondary leave-confirm-stay">STAY</button>
          <button class="btn-primary leave-confirm-go">LEAVE ANYWAY</button>
        </div>
      </div>`;
    const close = () => {
      overlay.remove();
      window.removeEventListener('keydown', onKey, true);
    };
    // Esc stays; keys don't reach the game (skills, movement) while the dialog is open
    const onKey = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') close();
    };
    overlay.querySelector('.leave-confirm-stay').addEventListener('click', close);
    overlay.querySelector('.leave-confirm-go').addEventListener('click', () => { close(); onLeave(); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    overlay.querySelector('.leave-confirm-stay').focus();
  }

  // ================= INPUT & CONTROLS =================

  let isPointerDown = false;
  let lastMoveEmitTime = 0;

  // Prevent default right-click context menu on game canvas
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // ...and anywhere else on the page once in the world (HUD, panels, chat log),
  // so a stray right-click never pops the browser menu mid-fight. Text fields
  // keep it for copy / paste.
  document.addEventListener('contextmenu', (e) => {
    if (!localPlayer) return;
    if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
    e.preventDefault();
  });

  function handlePointerAction(e, isDragging = false) {
    window.soundEngine.init();
    if (!localPlayer || localPlayer.isDead) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldPos = Isometric.screenToWorld(mouseX, mouseY, renderer.camera, renderer.viewW, renderer.viewH);

    // If dragging / holding mouse down, continuously stream destination
    if (isDragging) {
      const now = performance.now();
      if (now - lastMoveEmitTime > 65) {
        lastMoveEmitTime = now;
        socket.emit('player_input', {
          type: 'click_move',
          x: worldPos.x,
          y: worldPos.y
        });
      }
      return;
    }

    // Single Click Actions (Right click uses the weapon ability, Left click checks interactables)
    const isRightClick = e.button === 2;
    if (isRightClick) {
      if (!isDragging) useSkill('weapon', worldPos);
      return;
    }

    if (!isRightClick) {
      // 1. Check if clicked on Merchant Olaf or Blacksmith Brom in town
      if (localPlayer.zone === 'town') {
        const townObstacles = (gameState.map && gameState.map.obstacles) || [];
        const merchant = townObstacles.find(o => o.id === 'npc_merchant') || { x: 16.2, y: 19.6 };
        const brom = townObstacles.find(o => o.id === 'npc_blacksmith') || { x: 16.2, y: 23.4 };
        const valka = townObstacles.find(o => o.id === 'npc_enchanter') || { x: 23.8, y: 23.4 };
        if (Math.hypot(valka.x - worldPos.x, valka.y - worldPos.y) < 1.3) {
          if (Math.hypot(valka.x - localPlayer.x, valka.y - localPlayer.y) <= 3.5) openEnchanter();
          else socket.emit('player_input', { type: 'click_move', x: valka.x - 1.8, y: valka.y });
          return;
        }
        const clickDistToMerchant = Math.hypot(merchant.x - worldPos.x, merchant.y - worldPos.y);
        const clickDistToBrom = Math.hypot(brom.x - worldPos.x, brom.y - worldPos.y);
        const clickDistToPortal = Math.hypot(23.5 - worldPos.x, 16.5 - worldPos.y);

        // Click anywhere on the booth; walk up to its counter (+x side) first
        if (clickDistToMerchant < 1.3) {
          const playerDist = Math.hypot(merchant.x - localPlayer.x, merchant.y - localPlayer.y);
          if (playerDist <= 3.5) {
            openShopModal();
          } else {
            socket.emit('player_input', { type: 'click_move', x: merchant.x + 1.8, y: merchant.y });
          }
          return;
        }

        if (clickDistToBrom < 1.3) {
          const playerDist = Math.hypot(brom.x - localPlayer.x, brom.y - localPlayer.y);
          if (playerDist <= 3.5) {
            openReforgeModal();
          } else {
            socket.emit('player_input', { type: 'click_move', x: brom.x + 1.8, y: brom.y });
          }
          return;
        }

        const clickDistToFrostPortal = Math.hypot(16.5 - worldPos.x, 16.5 - worldPos.y);
        if (clickDistToFrostPortal < 1.1) {
          socket.emit('player_input', { type: 'click_move', x: 16.5, y: 16.5 });
          return;
        }

        if (clickDistToPortal < 1.1) {
          const playerDist = Math.hypot(23.5 - localPlayer.x, 16.5 - localPlayer.y);
          if (playerDist <= 3.0) {
            openDungeonPortalModal();
          } else {
            socket.emit('player_input', { type: 'click_move', x: 23.5, y: 17.5 });
          }
          return;
        }
      } else if (localPlayer.zone !== 'dungeon') {
        // Field zones: clicking a zone portal walks onto it
        const fieldPortal = ((gameState.map && gameState.map.obstacles) || []).find(o =>
          o.type === 'field_portal' && Math.hypot(o.x - worldPos.x, o.y - worldPos.y) < 1.3);
        if (fieldPortal) {
          socket.emit('player_input', { type: 'click_move', x: fieldPortal.x, y: fieldPortal.y });
          return;
        }
      }

      // 2. Check if clicked on a Chest in dungeon
      if (localPlayer.zone === 'dungeon' && gameState.chests) {
        for (const chest of gameState.chests) {
          if (!chest.opened && Math.hypot(chest.x - worldPos.x, chest.y - worldPos.y) < 2.0) {
            socket.emit('open_chest', { chestId: chest.id });
            return;
          }
        }
      }

      // 3. Check if clicked on a Ground Item to pick up
      let clickedItem = null;
      for (const it of gameState.groundItems) {
        const d = Math.hypot(it.x - worldPos.x, it.y - worldPos.y);
        if (d < 1.4) {
          clickedItem = it;
          break;
        }
      }

      if (clickedItem) {
        socket.emit('pickup_item', clickedItem.id);
        return;
      }

      // 4. Check if clicked on a Mob to target and attack
      let clickedMob = null;
      if (gameState.mobs) {
        for (const mob of gameState.mobs) {
          if (mob.state === 'dead') continue;
          const d = Math.hypot(mob.x - worldPos.x, mob.y - worldPos.y);
          if (d < (mob.isBoss ? 2.2 : 1.3)) {
            clickedMob = mob;
            break;
          }
        }
      }

      if (clickedMob) {
        selectedTargetId = clickedMob.id;
        selectedTargetType = 'mob';

        const now = performance.now();
        const atkSpeed = Math.max(0.4, (localPlayer && localPlayer.attackSpeed) || 1.0);
        const cooldownMs = Math.round(550 / atkSpeed);

        if (now - lastBasicAttackTime >= cooldownMs) {
          lastBasicAttackTime = now;
          if (localPlayer) {
            localPlayer.facing = calculateFacingFromTo(localPlayer.x, localPlayer.y, clickedMob.x, clickedMob.y);
            if (renderer) {
              renderer.triggerAttackAnimation({
                attackerId: localPlayer.id,
                class: localPlayer.characterClass,
                cardId: localPlayer.spTransformed && localPlayer.equipment && localPlayer.equipment.sp ? localPlayer.equipment.sp.cardId : null,
                x: localPlayer.x,
                y: localPlayer.y,
                facing: localPlayer.facing,
                attackSpeed: atkSpeed,
                hasSweep: true
              });
            }
          }
          socket.emit('player_attack', {
            targetId: clickedMob.id,
            targetType: 'mob'
          });
        }
        return;
      }
    }

    // Destination Move
    renderer.addClickMarker(worldPos.x, worldPos.y);
    if (localPlayer) {
      localPlayer.facing = calculateFacingFromTo(localPlayer.x, localPlayer.y, worldPos.x, worldPos.y);
      localPlayer.isMoving = true;
    }
    socket.emit('player_input', {
      type: 'click_move',
      x: worldPos.x,
      y: worldPos.y
    });
  }

  canvas.addEventListener('mousedown', (e) => {
    isPointerDown = e.button !== 2;   // right button casts, it never drag-moves
    handlePointerAction(e, false);
  });

  window.addEventListener('mouseup', () => {
    isPointerDown = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    lastCursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (isPointerDown && !selectedTargetId) {
      handlePointerAction(e, true);
    }
  });

  // Mouse Wheel Zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
    renderer.camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, renderer.camera.zoom + zoomDelta));
  }, { passive: false });

  // Mobile Touch Gestures (Pinch-to-zoom & Tap-to-move)
  let touchStartDist = 0;
  let touchStartZoom = 1.0;
  let isPinching = false;

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      isPinching = true;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      touchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchStartZoom = renderer.camera.zoom;
      e.preventDefault();
    } else if (e.touches.length === 1 && !isPinching) {
      const t = e.touches[0];
      isPointerDown = true;
      handlePointerAction({ clientX: t.clientX, clientY: t.clientY, button: 0 }, false);
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && isPinching && touchStartDist > 0) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = dist / touchStartDist;
      renderer.camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, touchStartZoom * ratio));
    } else if (e.touches.length === 1 && !isPinching && isPointerDown && !selectedTargetId) {
      const t = e.touches[0];
      handlePointerAction({ clientX: t.clientX, clientY: t.clientY, button: 0 }, true);
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      isPinching = false;
    }
    if (e.touches.length === 0) {
      isPointerDown = false;
    }
  });

  canvas.addEventListener('touchcancel', () => {
    isPinching = false;
    isPointerDown = false;
  });

  // Game shortcuts only work once in the world (not on the login / character
  // screen) and never while typing into a text field
  function gameHotkeysEnabled(e) {
    if (!localPlayer) return false;
    if (authModal && getComputedStyle(authModal).display !== 'none') return false;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return false;
    // While any dialog is open only Esc (close) reaches the game
    if (e.code !== 'Escape' && anyDialogOpen()) return false;
    return true;
  }

  function anyDialogOpen() {
    for (const el of document.querySelectorAll('.modal-overlay, .dungeon-result-overlay')) {
      if (el.id === 'authModal' || el.id === 'joinModal') continue;
      if (getComputedStyle(el).display !== 'none') return true;
    }
    return false;
  }

  // Keyboard Event Listeners
  window.addEventListener('keydown', (e) => {
    if (document.activeElement === chatInput) {
      if (e.key === 'Enter') sendChatMessage();
      return;
    }
    if (!gameHotkeysEnabled(e)) return;

    const code = e.code;
    const key = e.key.toLowerCase();

    // WASD & Arrow Movement (Layout-independent e.code so Thai keyboards work!)
    if (code === 'KeyW' || code === 'ArrowUp' || key === 'w' || key === 'arrowup') {
      activeKeys.w = true;
      updateWASDInput();
      return;
    }
    if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a' || key === 'arrowleft') {
      activeKeys.a = true;
      updateWASDInput();
      return;
    }
    if (code === 'KeyS' || code === 'ArrowDown' || key === 's' || key === 'arrowdown') {
      activeKeys.s = true;
      updateWASDInput();
      return;
    }
    if (code === 'KeyD' || code === 'ArrowRight' || key === 'd' || key === 'arrowright') {
      activeKeys.d = true;
      updateWASDInput();
      return;
    }

    if (code === 'Tab' || key === 'tab') {
      e.preventDefault();
      cycleNextTarget();
      return;
    }

    if (code === 'Space') {
      e.preventDefault();
      useBasicAttack();
      return;
    }

    if (code === 'KeyQ' || key === 'q') {
      useSkill('slot1');
      return;
    }

    if (code === 'KeyE' || key === 'e') {
      useSkill('slot2');
      return;
    }

    if (code === 'KeyF' || key === 'f') {
      usePortal();
      return;
    }

    if (code === 'KeyR' || key === 'r') {
      useSkill('slot3');
      return;
    }

    if (code === 'ShiftLeft' || code === 'ShiftRight' || key === 'shift') {
      e.preventDefault();
      useSkill('dash');
      return;
    }

    if (code === 'Digit1' || key === '1') {
      drinkPotion('health');
      return;
    }
    if (code === 'Digit2' || key === '2') {
      drinkPotion('mana');
      return;
    }

    if (code === 'Enter') {
      chatInput.focus();
      return;
    }

    if (code === 'F2' && adminCatalog) {
      e.preventDefault();
      toggleAdminPanel();
      return;
    }

    if (code === 'KeyK' || key === 'k') {
      toggleSkillTreeModal();
      return;
    }

    if (code === 'Escape') {
      for (const el of document.querySelectorAll('.modal-overlay')) {
        if (el.id !== 'authModal' && el.id !== 'joinModal') el.style.display = 'none';
      }
      if (window.GameTooltip) window.GameTooltip.hide();
      chatInput.blur();
      return;
    }
    if (code === 'KeyP' || key === 'p') openShopModal();
    if (code === 'KeyC' || key === 'c') toggleModal(statsModal);
    if (code === 'KeyI' || key === 'i') {
      renderInventoryGrid();
      toggleModal(inventoryModal);
    }
    if (code === 'KeyH' || key === 'h') toggleModal(helpModal);
    if (code === 'KeyO' || key === 'o') togglePartyPanel();
    if (code === 'KeyT' || key === 't') requestTransform();
    if (code === 'KeyM' || key === 'm') toggleAudio();
  });

  window.addEventListener('keyup', (e) => {
    if (document.activeElement === chatInput) return;
    const code = e.code;
    const key = e.key.toLowerCase();

    if (code === 'KeyW' || code === 'ArrowUp' || key === 'w' || key === 'arrowup') activeKeys.w = false;
    if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a' || key === 'arrowleft') activeKeys.a = false;
    if (code === 'KeyS' || code === 'ArrowDown' || key === 's' || key === 'arrowdown') activeKeys.s = false;
    if (code === 'KeyD' || code === 'ArrowRight' || key === 'd' || key === 'arrowright') activeKeys.d = false;
    updateWASDInput();
  });

  function updateWASDInput() {
    let dx = 0;
    let dy = 0;
    if (activeKeys.w) { dy -= 1; }
    if (activeKeys.s) { dy += 1; }
    if (activeKeys.a) { dx -= 1; }
    if (activeKeys.d) { dx += 1; }

    if (dx !== 0 || dy !== 0) {
      if (localPlayer) {
        if (dx > 0 && dy < 0) localPlayer.facing = 'NE';
        else if (dx < 0 && dy < 0) localPlayer.facing = 'NW';
        else if (dx > 0 && dy > 0) localPlayer.facing = 'SE';
        else if (dx < 0 && dy > 0) localPlayer.facing = 'SW';
        else if (dy < 0) localPlayer.facing = 'N';
        else if (dy > 0) localPlayer.facing = 'S';
        else if (dx > 0) localPlayer.facing = 'E';
        else if (dx < 0) localPlayer.facing = 'W';
        localPlayer.isMoving = true;
      }
      socket.emit('player_input', { type: 'wasd_move', dx, dy });
    } else {
      if (localPlayer) localPlayer.isMoving = false;
      socket.emit('player_input', { type: 'stop_move' });
    }
  }

  // Tab Key Target Cycling through nearby alive enemies
  function cycleNextTarget() {
    if (!localPlayer || localPlayer.isDead || !gameState.mobs) return;

    const TARGET_RADIUS = 9.0;
    const aliveNearbyMobs = gameState.mobs.filter(m => {
      if (m.state === 'dead') return false;
      const dist = Math.hypot(m.x - localPlayer.x, m.y - localPlayer.y);
      return dist <= TARGET_RADIUS;
    });

    if (aliveNearbyMobs.length === 0) {
      selectedTargetId = null;
      selectedTargetType = null;
      if (targetHud) targetHud.classList.remove('active');
      return;
    }

    // Sort by distance to player
    aliveNearbyMobs.sort((a, b) => {
      const da = Math.hypot(a.x - localPlayer.x, a.y - localPlayer.y);
      const db = Math.hypot(b.x - localPlayer.x, b.y - localPlayer.y);
      return da - db;
    });

    // If currently targeting one in this list, pick the next one
    let nextIndex = 0;
    if (selectedTargetId) {
      const curIndex = aliveNearbyMobs.findIndex(m => m.id === selectedTargetId);
      if (curIndex !== -1) {
        nextIndex = (curIndex + 1) % aliveNearbyMobs.length;
      }
    }

    const nextTarget = aliveNearbyMobs[nextIndex];
    selectedTargetId = nextTarget.id;
    selectedTargetType = 'mob';

    window.soundEngine.playTargetLock();

    if (targetHud) {
      targetHud.classList.add('active');
      targetName.textContent = `${nextTarget.name} (Lv. ${nextTarget.level})`;
      const hpPct = Math.round((nextTarget.hp / nextTarget.maxHp) * 100);
      targetHpFill.style.width = `${hpPct}%`;
      targetIcon.dataset.pxi = nextTarget.isBoss ? 'crown' : nextTarget.isMiniboss ? 'sword' : 'skull';
    }
  }

  // Space Key Smart Attack: Attacks locked target or auto-finds closest enemy
  function useBasicAttack() {
    if (!localPlayer || localPlayer.isDead) return;

    // 1. Check Attack Speed Cooldown:
    // Attacks must strictly respect player attack speed stat!
    const now = performance.now();
    const atkSpeed = Math.max(0.4, localPlayer.attackSpeed || 1.0);
    const cooldownMs = Math.round(550 / atkSpeed);

    if (now - lastBasicAttackTime < cooldownMs) {
      // Still on attack cooldown cycle - ignore spacebar spam until ready
      return;
    }

    const AUTO_LOCK_RADIUS = 8.5;
    let targetMob = null;

    // 2. Check if currently selected target is valid and alive
    if (selectedTargetId && gameState.mobs) {
      const mob = gameState.mobs.find(m => m.id === selectedTargetId);
      if (mob && mob.state !== 'dead') {
        const dist = Math.hypot(mob.x - localPlayer.x, mob.y - localPlayer.y);
        if (dist <= AUTO_LOCK_RADIUS + 3.0) {
          targetMob = mob;
        }
      }
    }

    // 3. If no valid target, auto-find closest alive mob within radius
    if (!targetMob && gameState.mobs) {
      let closestMob = null;
      let closestDist = AUTO_LOCK_RADIUS;

      for (const m of gameState.mobs) {
        if (m.state === 'dead') continue;
        const d = Math.hypot(m.x - localPlayer.x, m.y - localPlayer.y);
        if (d < closestDist) {
          closestDist = d;
          closestMob = m;
        }
      }

      if (closestMob) {
        targetMob = closestMob;
        selectedTargetId = closestMob.id;
        selectedTargetType = 'mob';
        window.soundEngine.playTargetLock();

        if (targetHud) {
          targetHud.classList.add('active');
          targetName.textContent = `${closestMob.name} (Lv. ${closestMob.level})`;
          const hpPct = Math.round((closestMob.hp / closestMob.maxHp) * 100);
          targetHpFill.style.width = `${hpPct}%`;
          targetIcon.dataset.pxi = closestMob.isBoss ? 'crown' : closestMob.isMiniboss ? 'sword' : 'skull';
        }
      }
    }

    // 4. Turn to face locked target when attacking!
    if (targetMob) {
      localPlayer.facing = calculateFacingFromTo(localPlayer.x, localPlayer.y, targetMob.x, targetMob.y);
    }

    // Register attack timestamp
    lastBasicAttackTime = now;

    // 5. Dispatch Attack
    if (targetMob) {
      const dist = Math.hypot(targetMob.x - localPlayer.x, targetMob.y - localPlayer.y);
      const attackRange = localPlayer.characterClass === 'mage' ? 5.5 : 2.2;

      // For melee, if slightly out of reach (e.g. 2.2 to 4.5 tiles), step forward to engage:
      // stop at sword's length in front of the monster, not on top of it
      if (dist > attackRange && dist <= 4.5) {
        const stopAt = Math.max(0.9, attackRange * 0.6);
        socket.emit('player_input', {
          type: 'click_move',
          x: targetMob.x - ((targetMob.x - localPlayer.x) / dist) * stopAt,
          y: targetMob.y - ((targetMob.y - localPlayer.y) / dist) * stopAt
        });
      }

      socket.emit('player_attack', {
        targetId: targetMob.id,
        targetType: 'mob',
        worldX: targetMob.x,
        worldY: targetMob.y
      });
    } else {
      socket.emit('player_attack', {
        targetId: null,
        targetType: 'none',
        worldX: localPlayer.x,
        worldY: localPlayer.y
      });
    }

    // Immediate client-side attack slash animation trigger with locked target facing!
    if (renderer && localPlayer) {
      renderer.triggerAttackAnimation({
        attackerId: localPlayer.id,
        class: localPlayer.characterClass,
        cardId: localPlayer.spTransformed && localPlayer.equipment && localPlayer.equipment.sp ? localPlayer.equipment.sp.cardId : null,
        x: localPlayer.x,
        y: localPlayer.y,
        facing: localPlayer.facing,
        targetX: targetMob ? targetMob.x : undefined,
        targetY: targetMob ? targetMob.y : undefined,
        attackSpeed: atkSpeed,
        hasSweep: true
      });
    }
  }

  function useSkill(slot = 'slot1', aim = null) {
    if (!localPlayer || localPlayer.isDead) return;

    // Normalize slot names
    if (slot === 'skill1') slot = 'slot1';
    if (slot === 'skill2') slot = 'slot2';
    if (slot === 'skill3') slot = 'slot3';

    const rawEquipped = localPlayer.equippedSkills && localPlayer.equippedSkills[slot];
    const equippedDef = findSkillDef(typeof rawEquipped === 'object' && rawEquipped ? rawEquipped.skillId : rawEquipped);
    // Nightblade throws go where the mouse points, not at the nearest monster
    if (!aim && equippedDef && CURSOR_AIMED_SHAPES.has(equippedDef.shape) && lastCursor && renderer) {
      aim = Isometric.screenToWorld(lastCursor.x, lastCursor.y, renderer.camera, renderer.viewW, renderer.viewH);
    }
    // Phantom Shuriken out: pressing again calls the stars back, cooldown or not
    if (shurikenRecall && shurikenRecall.slot === slot && performance.now() < shurikenRecall.until) {
      shurikenRecall = null;
      socket.emit('player_skill', { skillSlot: slot, targetX: localPlayer.x, targetY: localPlayer.y, dirX: 0, dirY: 0 });
      return;
    }

    if (slot === 'slot1' && skill1CooldownTimer > 0) return;
    if (slot === 'slot2' && skill2CooldownTimer > 0) return;
    if (slot === 'slot3' && skill3CooldownTimer > 0) return;
    if (slot === 'dash' && dashCooldownTimer > 0) return;
    if (slot === 'weapon') {
      if (weaponCooldownTimer > 0) return;
      if (!currentWeaponAbility()) {
        if (renderer) renderer.addFloatingText(localPlayer.x, localPlayer.y - 0.7, 'No weapon ability', '#94a3b8', 14);
        return;
      }
    }

    let mpCost = 15;
    const cls = localPlayer.characterClass || 'warrior';
    if (slot === 'weapon') {
      mpCost = manaCost(currentWeaponAbility().mpCost);
    } else if (localPlayer.equippedSkills && localPlayer.equippedSkills[slot] && allSkillsCatalog[cls]) {
      const raw = localPlayer.equippedSkills[slot];
      const skillDef = findSkillDef(typeof raw === 'object' ? raw.skillId : raw);
      if (skillDef) mpCost = manaCost(skillDef.mpCost);
      const manaFlow = localPlayer.skills && localPlayer.skills.mana_flow;
      if (manaFlow) mpCost = Math.max(2, Math.round(mpCost * (1 - manaFlow * 0.15)));
    } else {
      const mpCosts = {
        warrior: { slot1: 14, slot2: 16, slot3: 28, dash: 10 },
        mage: { slot1: 22, slot2: 18, slot3: 35, dash: 15 },
        rogue: { slot1: 14, slot2: 16, slot3: 30, dash: 8 }
      };
      const clsCosts = mpCosts[cls] || mpCosts.warrior;
      mpCost = manaCost(clsCosts[slot] || 15);
    }

    if (localPlayer.mp < mpCost) {
      if (renderer) renderer.addFloatingText(localPlayer.x, localPlayer.y - 0.7, '⚠️ Not enough Mana!', '#38bdf8', 15);
      return;
    }

    let targetX = localPlayer.x;
    let targetY = localPlayer.y;

    if (aim) {
      // aimed at the cursor (weapon ability)
      targetX = aim.x;
      targetY = aim.y;
    } else if (selectedTargetId && gameState.mobs) {
      const mob = gameState.mobs.find(m => m.id === selectedTargetId);
      if (mob) {
        targetX = mob.x;
        targetY = mob.y;
      }
    } else if (gameState.mobs) {
      // Auto-target closest enemy if none targeted
      let closestMob = null;
      let closestDist = 8.0;
      for (const m of gameState.mobs) {
        if (m.state === 'dead') continue;
        const d = Math.hypot(m.x - localPlayer.x, m.y - localPlayer.y);
        if (d < closestDist) {
          closestDist = d;
          closestMob = m;
        }
      }
      if (closestMob) {
        targetX = closestMob.x;
        targetY = closestMob.y;
        selectedTargetId = closestMob.id;
        selectedTargetType = 'mob';
      }
    }

    // Direction calculation for Dash / Mobility skill
    let dirX = 0;
    let dirY = 0;
    if (aim) {
      const d = Math.hypot(aim.x - localPlayer.x, aim.y - localPlayer.y) || 1;
      dirX = (aim.x - localPlayer.x) / d;
      dirY = (aim.y - localPlayer.y) / d;
    } else if (slot === 'dash') {
      if (activeKeys.w || activeKeys.a || activeKeys.s || activeKeys.d) {
        let dx = 0;
        let dy = 0;
        if (activeKeys.w) dy -= 1;
        if (activeKeys.s) dy += 1;
        if (activeKeys.a) dx -= 1;
        if (activeKeys.d) dx += 1;
        const len = Math.hypot(dx, dy) || 1;
        const normSx = dx / len;
        const normSy = dy / len;
        dirX = (normSx + normSy * 2) * 0.5;
        dirY = (normSy * 2 - normSx) * 0.5;
      } else if (localPlayer.targetX !== null && localPlayer.targetY !== null) {
        const d = Math.hypot(localPlayer.targetX - localPlayer.x, localPlayer.targetY - localPlayer.y);
        if (d > 0.1) {
          dirX = (localPlayer.targetX - localPlayer.x) / d;
          dirY = (localPlayer.targetY - localPlayer.y) / d;
        }
      }

      if (Math.hypot(dirX, dirY) < 0.001) {
        const facingVectors = {
          'E': { dx: 1, dy: -1 },
          'SE': { dx: 1, dy: 0 },
          'S': { dx: 1, dy: 1 },
          'SW': { dx: 0, dy: 1 },
          'W': { dx: -1, dy: 1 },
          'NW': { dx: -1, dy: 0 },
          'N': { dx: -1, dy: -1 },
          'NE': { dx: 0, dy: -1 }
        };
        const vec = facingVectors[localPlayer.facing] || { dx: 1, dy: 0 };
        dirX = vec.dx;
        dirY = vec.dy;
      }
    }

    socket.emit('player_skill', { skillSlot: slot, targetX, targetY, dirX, dirY });

    if (slot === 'dash' && renderer && localPlayer) {
      renderer.triggerDashAnimation({ playerId: localPlayer.id, duration: 340, facing: localPlayer.facing });
    }
  }

  function useClassSkill() {
    useSkill('skill1');
  }

  // Quick-slot potion types: key 1 = health, key 2 = mana
  const POTION_CHOICES = {
    health: [{ id: 'health_potion', name: 'Health Potion' }, { id: 'greater_health_potion', name: 'Greater Health' }],
    mana: [{ id: 'mana_potion', name: 'Mana Potion' }, { id: 'greater_mana_potion', name: 'Greater Mana' }]
  };

  function selectedPotion(p, kind) {
    const slots = p && p.inventory && p.inventory.potionSlots;
    return (slots && slots[kind]) || POTION_CHOICES[kind][0].id;
  }

  function potionCount(p, itemId) {
    if (!p || !p.inventory) return 0;
    if (itemId === 'health_potion') return p.inventory.healthPotions || 0;
    if (itemId === 'mana_potion') return p.inventory.manaPotions || 0;
    const stack = (p.inventory.items || []).find(i => i.id === itemId);
    return stack ? (stack.count || 1) : 0;
  }

  function renderPotionSlotLabels(p) {
    [['health', 'invHpLabel', 'invHpSlot', '1'], ['mana', 'invMpLabel', 'invMpSlot', '2']].forEach(([kind, labelId, slotId, key]) => {
      const current = POTION_CHOICES[kind].find(c => c.id === selectedPotion(p, kind)) || POTION_CHOICES[kind][0];
      const label = document.getElementById(labelId);
      const slot = document.getElementById(slotId);
      if (label) label.textContent = current.name;
      if (slot) slot.title = `Click to drink ${current.name} (${key})`;
    });
  }

  function switchPotionSlot(kind) {
    if (!localPlayer) return;
    const choices = POTION_CHOICES[kind];
    const idx = choices.findIndex(c => c.id === selectedPotion(localPlayer, kind));
    const next = choices[(idx + 1) % choices.length];

    if (!localPlayer.inventory) localPlayer.inventory = {};
    if (!localPlayer.inventory.potionSlots) localPlayer.inventory.potionSlots = {};
    localPlayer.inventory.potionSlots[kind] = next.id;

    socket.emit('set_potion_slot', { kind, itemId: next.id });

    const count = potionCount(localPlayer, next.id);
    if (renderer) {
      const color = kind === 'health' ? '#4ade80' : '#38bdf8';
      renderer.addFloatingText(localPlayer.x, localPlayer.y - 0.7, `⇄ ${next.name} (${count})`, color, 14);
    }
    if (window.soundEngine) {
      if (window.soundEngine.playItemPickup) window.soundEngine.playItemPickup();
      else if (window.soundEngine.playBladeCharge) window.soundEngine.playBladeCharge();
    }
    updatePlayerHUD(localPlayer);
  }

  function drinkPotion(type) {
    if (!localPlayer || localPlayer.isDead) return;
    socket.emit('use_potion', type);
    window.soundEngine.playPotion();
  }

  function sendChatMessage() {
    const text = chatInput.value.trim();
    if (text) {
      if (text.startsWith('/invite ') || text.startsWith('/party ')) {
        const parts = text.split(' ');
        const targetName = parts.slice(1).join(' ').trim();
        if (targetName) {
          socket.emit('party_invite', { targetName });
        }
      } else if (text === '/leave') {
        socket.emit('party_leave');
      } else if (text.startsWith('/kick ')) {
        const parts = text.split(' ');
        const targetName = parts.slice(1).join(' ').trim();
        let partyHandled = false;
        if (targetName && currentParty && currentParty.members && currentParty.leaderId === localPlayerId) {
          const member = currentParty.members.find(m => m.name.toLowerCase() === targetName.toLowerCase());
          if (member) {
            socket.emit('party_kick', { targetId: member.id });
            partyHandled = true;
          }
        }
        if (!partyHandled) {
          socket.emit('send_chat', text);
        }
      } else {
        socket.emit('send_chat', text);
      }
      chatInput.value = '';
    }
    chatInput.blur();
  }

  function appendChatMessage(msg) {
    const div = document.createElement('div');
    div.className = `chat-msg ${msg.senderClass || ''}`;
    if (msg.senderId === 'system') {
      div.textContent = msg.text;
    } else {
      div.innerHTML = `<span class="sender">[${msg.senderName}]:</span> ${escapeHtml(msg.text)}`;
    }
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // --- Game Settings, GUI Scale & Master Audio Controls ---
  const settingsModal = document.getElementById('settingsModal');
  const btnSettingsToggle = document.getElementById('btnSettingsToggle');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const mBtnOpenSettings = document.getElementById('mBtnOpenSettings');
  const sliderGuiScale = document.getElementById('sliderGuiScale');
  const lblGuiScaleVal = document.getElementById('lblGuiScaleVal');
  const guiScalePresets = document.querySelectorAll('.gui-scale-preset[data-scale]');
  const graphicsPresets = document.querySelectorAll('.gui-scale-preset[data-quality]');
  const lblGraphicsVal = document.getElementById('lblGraphicsVal');
  const btnResetGuiScale = document.getElementById('btnResetGuiScale');
  const btnSettingsResetCamera = document.getElementById('btnSettingsResetCamera');
  const sliderBgm = document.getElementById('sliderBgm');
  const sliderSfx = document.getElementById('sliderSfx');
  const lblBgmVal = document.getElementById('lblBgmVal');
  const lblSfxVal = document.getElementById('lblSfxVal');
  const btnSettingsMuteToggle = document.getElementById('btnSettingsMuteToggle');
  const iconSettingsMute = document.getElementById('iconSettingsMute');
  const lblSettingsMute = document.getElementById('lblSettingsMute');

  // GUI Scale logic (persisted in localStorage)
  let currentGuiScalePct = 100;
  try {
    const saved = localStorage.getItem('slop_gui_scale');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (parsed >= 60 && parsed <= 160) currentGuiScalePct = parsed;
    }
  } catch (_) {}

  function applyGuiScale(pct) {
    currentGuiScalePct = Math.max(60, Math.min(150, pct));
    const factor = (currentGuiScalePct / 100).toFixed(2);
    document.documentElement.style.setProperty('--gui-scale', factor);
    if (lblGuiScaleVal) lblGuiScaleVal.textContent = `${currentGuiScalePct}%`;
    if (sliderGuiScale && parseInt(sliderGuiScale.value, 10) !== currentGuiScalePct) {
      sliderGuiScale.value = currentGuiScalePct;
    }
    guiScalePresets.forEach(b => {
      const p = parseInt(b.dataset.scale, 10);
      b.classList.toggle('active', p === currentGuiScalePct);
    });
    try {
      localStorage.setItem('slop_gui_scale', currentGuiScalePct.toString());
    } catch (_) {}
  }

  // Initial apply on boot
  applyGuiScale(currentGuiScalePct);

  if (sliderGuiScale) {
    sliderGuiScale.addEventListener('input', (e) => {
      applyGuiScale(parseInt(e.target.value, 10));
    });
  }

  guiScalePresets.forEach(btn => {
    btn.addEventListener('click', () => {
      const scale = parseInt(btn.dataset.scale, 10);
      if (scale) applyGuiScale(scale);
    });
  });

  if (btnResetGuiScale) {
    btnResetGuiScale.addEventListener('click', () => {
      applyGuiScale(100);
    });
  }

  // Graphics quality (persisted in localStorage): the world is drawn into a
  // smaller canvas buffer and stretched, which is what slow laptops need most.
  // Auto starts sharp and steps down while the frame rate stays low.
  const GRAPHICS_SCALES = { high: 1, medium: 0.75, low: 0.55, potato: 0.42 };
  const AUTO_SCALE_STEPS = [1, 0.75, 0.55, 0.42];
  const AUTO_LOW_FPS = 42;          // average fps over one window that counts as lagging
  const AUTO_WINDOW_MS = 2000;
  let graphicsQuality = 'auto';
  let autoScaleStep = 0;
  const fpsWindow = { start: 0, frames: 0 };
  try {
    const saved = localStorage.getItem('slop_graphics_quality');
    if (saved === 'auto' || GRAPHICS_SCALES[saved]) graphicsQuality = saved;
  } catch (_) {}

  function applyGraphicsQuality(quality) {
    graphicsQuality = quality;
    const scale = quality === 'auto' ? AUTO_SCALE_STEPS[autoScaleStep] : (GRAPHICS_SCALES[quality] || 1);
    renderer.setRenderScale(scale);
    const effQuality = quality === 'auto'
      ? (autoScaleStep >= 3 ? 'potato' : (autoScaleStep >= 2 ? 'low' : (autoScaleStep >= 1 ? 'medium' : 'high')))
      : quality;
    if (renderer.setQuality) {
      renderer.setQuality(effQuality);
    } else {
      renderer.lowEffects = quality === 'low' || quality === 'potato' || (quality === 'auto' && autoScaleStep >= 2);
    }
    fpsWindow.start = 0;
    graphicsPresets.forEach(b => b.classList.toggle('active', b.dataset.quality === quality));
    if (lblGraphicsVal) {
      const label = quality === 'potato' ? 'Potato' : (quality.charAt(0).toUpperCase() + quality.slice(1));
      lblGraphicsVal.textContent = `${label} · ${Math.round(scale * 100)}%`;
    }
    try {
      localStorage.setItem('slop_graphics_quality', quality);
    } catch (_) {}
  }

  // Called once per frame by the game loop
  function trackFrameRate(now) {
    // only judge the world itself, not the login screen's 3D class preview
    if (graphicsQuality !== 'auto' || autoScaleStep >= AUTO_SCALE_STEPS.length - 1 || !localPlayer) return;
    // a long gap (tab hidden, alert, loading) is not lag; start a fresh window
    if (!fpsWindow.start || now - fpsWindow.last > 250) {
      fpsWindow.start = now;
      fpsWindow.frames = 0;
    }
    fpsWindow.last = now;
    fpsWindow.frames++;
    const elapsed = now - fpsWindow.start;
    if (elapsed < AUTO_WINDOW_MS) return;
    const fps = (fpsWindow.frames * 1000) / elapsed;
    fpsWindow.start = 0;
    if (fps < AUTO_LOW_FPS) {
      autoScaleStep++;
      applyGraphicsQuality('auto');
    }
  }

  applyGraphicsQuality(graphicsQuality);

  graphicsPresets.forEach(btn => {
    btn.addEventListener('click', () => {
      // picking Auto again gives it a fresh start at full sharpness
      if (btn.dataset.quality === 'auto') autoScaleStep = 0;
      applyGraphicsQuality(btn.dataset.quality);
    });
  });

  // Target FPS limiter (30 FPS eco, 60 FPS, Uncapped)
  const targetFpsPresets = document.querySelectorAll('.gui-scale-preset[data-fps]');
  const lblFpsLimitVal = document.getElementById('lblFpsLimitVal');
  let targetFps = 0; // 0 = uncapped
  let frameInterval = 0; // ms
  let lastRenderTime = 0;

  try {
    const savedFps = localStorage.getItem('slop_target_fps');
    if (savedFps !== null) {
      const parsed = parseInt(savedFps, 10);
      if (!isNaN(parsed) && (parsed === 0 || parsed === 30 || parsed === 60)) {
        targetFps = parsed;
      }
    }
  } catch (_) {}

  function applyTargetFps(fps) {
    targetFps = parseInt(fps, 10) || 0;
    frameInterval = targetFps > 0 ? (1000 / targetFps) : 0;
    targetFpsPresets.forEach(b => b.classList.toggle('active', parseInt(b.dataset.fps, 10) === targetFps));
    if (lblFpsLimitVal) {
      lblFpsLimitVal.textContent = targetFps === 0 ? 'Uncapped' : `${targetFps} FPS`;
    }
    try {
      localStorage.setItem('slop_target_fps', targetFps.toString());
    } catch (_) {}
  }
  applyTargetFps(targetFps);

  targetFpsPresets.forEach(btn => {
    btn.addEventListener('click', () => {
      applyTargetFps(btn.dataset.fps);
    });
  });

  // 3D Town Props mode (Auto, On, Off/2D Fast)
  const townPropsPresets = document.querySelectorAll('.gui-scale-preset[data-props]');
  const lblTownPropsVal = document.getElementById('lblTownPropsVal');
  let townPropsMode = 'auto';

  try {
    const savedProps = localStorage.getItem('slop_town_props');
    if (savedProps === 'auto' || savedProps === 'on' || savedProps === 'off') {
      townPropsMode = savedProps;
    }
  } catch (_) {}

  function applyTownPropsMode(mode) {
    townPropsMode = mode;
    if (renderer && renderer.setTownPropsMode) {
      renderer.setTownPropsMode(mode);
    }
    townPropsPresets.forEach(b => b.classList.toggle('active', b.dataset.props === mode));
    if (lblTownPropsVal) {
      lblTownPropsVal.textContent = mode === 'auto' ? 'Auto' : (mode === 'on' ? '3D On' : '2D Fast');
    }
    try {
      localStorage.setItem('slop_town_props', mode);
    } catch (_) {}
  }
  applyTownPropsMode(townPropsMode);

  townPropsPresets.forEach(btn => {
    btn.addEventListener('click', () => {
      applyTownPropsMode(btn.dataset.props);
    });
  });

  // VFX & Particles quality (Auto, Full, Reduced, Minimal)
  const vfxPresets = document.querySelectorAll('.gui-scale-preset[data-vfx]');
  const lblVfxVal = document.getElementById('lblVfxVal');
  let vfxLevel = 'auto';

  try {
    const savedVfx = localStorage.getItem('slop_vfx_level');
    if (savedVfx === 'auto' || savedVfx === 'full' || savedVfx === 'reduced' || savedVfx === 'minimal') {
      vfxLevel = savedVfx;
    }
  } catch (_) {}

  function applyVfxLevel(level) {
    vfxLevel = level;
    if (renderer && renderer.setVfxLevel) {
      renderer.setVfxLevel(level);
    }
    vfxPresets.forEach(b => b.classList.toggle('active', b.dataset.vfx === level));
    if (lblVfxVal) {
      lblVfxVal.textContent = level.charAt(0).toUpperCase() + level.slice(1);
    }
    try {
      localStorage.setItem('slop_vfx_level', level);
    } catch (_) {}
  }
  applyVfxLevel(vfxLevel);

  vfxPresets.forEach(btn => {
    btn.addEventListener('click', () => {
      applyVfxLevel(btn.dataset.vfx);
    });
  });

  if (btnSettingsResetCamera) {
    btnSettingsResetCamera.addEventListener('click', () => {
      if (renderer && renderer.resetCamera) {
        renderer.resetCamera();
      } else if (renderer && renderer.camera) {
        renderer.camera.zoom = 1;
      }
      if (window.soundEngine && window.soundEngine.playLevelUp) {
        window.soundEngine.playLevelUp();
      }
    });
  }

  // Audio Controls inside Settings
  if (sliderBgm && window.soundEngine) {
    const bgmPct = Math.round((window.soundEngine.bgmVolume !== undefined ? window.soundEngine.bgmVolume : 0.6) * 100);
    sliderBgm.value = bgmPct;
    if (lblBgmVal) lblBgmVal.textContent = `${bgmPct}%`;
    sliderBgm.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (lblBgmVal) lblBgmVal.textContent = `${val}%`;
      window.soundEngine.setBgmVolume(val / 100);
    });
  }

  if (sliderSfx && window.soundEngine) {
    const sfxPct = Math.round((window.soundEngine.sfxVolume !== undefined ? window.soundEngine.sfxVolume : 0.7) * 100);
    sliderSfx.value = sfxPct;
    if (lblSfxVal) lblSfxVal.textContent = `${sfxPct}%`;
    sliderSfx.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (lblSfxVal) lblSfxVal.textContent = `${val}%`;
      window.soundEngine.setSfxVolume(val / 100);
    });
  }

  function updateMuteStateUI() {
    if (!window.soundEngine) return;
    const isMuted = !!window.soundEngine.muted;
    if (lblSettingsMute) lblSettingsMute.textContent = isMuted ? '🔊 Unmute All Audio' : '🔇 Mute All Audio';
    if (iconSettingsMute) iconSettingsMute.dataset.pxi = isMuted ? 'mute' : 'sound';
    if (btnSettingsMuteToggle) {
      btnSettingsMuteToggle.classList.toggle('is-muted', isMuted);
    }
  }

  if (btnSettingsMuteToggle) {
    btnSettingsMuteToggle.addEventListener('click', () => {
      if (window.soundEngine) {
        window.soundEngine.toggleMute();
        updateMuteStateUI();
      }
    });
  }

  function openSettingsModal() {
    if (!settingsModal) return;
    updateMuteStateUI();
    if (sliderGuiScale) sliderGuiScale.value = currentGuiScalePct;
    if (lblGuiScaleVal) lblGuiScaleVal.textContent = `${currentGuiScalePct}%`;
    settingsModal.style.display = 'flex';
  }

  function closeSettingsModal() {
    if (settingsModal) settingsModal.style.display = 'none';
  }

  function toggleSettingsModal() {
    if (!settingsModal) return;
    if (settingsModal.style.display === 'flex') {
      closeSettingsModal();
    } else {
      openSettingsModal();
    }
  }

  if (btnSettingsToggle) {
    btnSettingsToggle.addEventListener('click', toggleSettingsModal);
  }
  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', closeSettingsModal);
  }
  if (mBtnOpenSettings) {
    mBtnOpenSettings.addEventListener('click', () => {
      const mobileDrawer = document.getElementById('mobileMenuDrawer');
      if (mobileDrawer) mobileDrawer.style.display = 'none';
      openSettingsModal();
    });
  }

  function toggleAudio() {
    if (window.soundEngine) {
      window.soundEngine.toggleMute();
      updateMuteStateUI();
    }
  }

  // --- Party System Client Logic ---
  let currentParty = null;
  let pendingPartyInvite = null;
  const partyFrame = document.getElementById('partyFrame');
  const partyCountText = document.getElementById('partyCountText');
  const partyMembersList = document.getElementById('partyMembersList');
  const btnLeaveParty = document.getElementById('btnLeaveParty');
  const partyInviteBanner = document.getElementById('partyInviteBanner');
  const partyInviterName = document.getElementById('partyInviterName');
  const btnAcceptParty = document.getElementById('btnAcceptParty');
  const btnDeclineParty = document.getElementById('btnDeclineParty');

  if (btnLeaveParty) {
    btnLeaveParty.addEventListener('click', () => {
      socket.emit('party_leave');
    });
  }

  if (btnAcceptParty) {
    btnAcceptParty.addEventListener('click', () => {
      if (pendingPartyInvite) {
        socket.emit('party_accept', { partyId: pendingPartyInvite.partyId });
        pendingPartyInvite = null;
      }
      if (partyInviteBanner) partyInviteBanner.style.display = 'none';
    });
  }

  if (btnDeclineParty) {
    btnDeclineParty.addEventListener('click', () => {
      if (pendingPartyInvite) {
        socket.emit('party_decline', { inviterId: pendingPartyInvite.inviterId });
        pendingPartyInvite = null;
      }
      if (partyInviteBanner) partyInviteBanner.style.display = 'none';
    });
  }

  socket.on('party_invite_received', (data) => {
    pendingPartyInvite = data;
    if (partyInviterName) partyInviterName.textContent = data.inviterName;
    if (partyInviteBanner) {
      partyInviteBanner.style.display = 'flex';
      setTimeout(() => {
        if (pendingPartyInvite === data) {
          partyInviteBanner.style.display = 'none';
          pendingPartyInvite = null;
        }
      }, 20000);
    }
    window.soundEngine.playLevelUp();
  });

  socket.on('party_updated', (partyData) => {
    currentParty = partyData;
    renderPartyFrame();
    renderPartyPanel();
  });

  socket.on('party_left', () => {
    currentParty = null;
    if (partyFrame) partyFrame.style.display = 'none';
    renderPartyPanel();
  });

  // --- Party summon (teleport to a member's map / dungeon) ---
  const partySummonBanner = document.getElementById('partySummonBanner');
  let pendingSummon = null;
  let summonHideTimer = null;

  socket.on('party_summon_received', (data) => {
    pendingSummon = data;
    const nameEl = document.getElementById('partySummonerName');
    const whereEl = document.getElementById('partySummonWhere');
    if (nameEl) nameEl.textContent = data.fromName;
    if (whereEl) whereEl.textContent = data.where;
    if (!partySummonBanner) return;
    partySummonBanner.style.display = 'flex';
    window.soundEngine.playLevelUp();
    clearTimeout(summonHideTimer);
    summonHideTimer = setTimeout(() => {
      partySummonBanner.style.display = 'none';
      pendingSummon = null;
    }, 30000);
  });

  const btnAcceptSummon = document.getElementById('btnAcceptSummon');
  const btnDeclineSummon = document.getElementById('btnDeclineSummon');
  if (btnAcceptSummon) {
    btnAcceptSummon.addEventListener('click', () => {
      if (pendingSummon) socket.emit('party_summon_accept', { fromId: pendingSummon.fromId });
      pendingSummon = null;
      if (partySummonBanner) partySummonBanner.style.display = 'none';
    });
  }
  if (btnDeclineSummon) {
    btnDeclineSummon.addEventListener('click', () => {
      pendingSummon = null;
      if (partySummonBanner) partySummonBanner.style.display = 'none';
    });
  }

  function summonParty() {
    socket.emit('party_summon');
  }
  const btnPartyFrameSummon = document.getElementById('btnPartyFrameSummon');
  if (btnPartyFrameSummon) btnPartyFrameSummon.addEventListener('click', summonParty);

  // --- Party panel (invite online players, summon, leave) ---
  const partyModal = document.getElementById('partyModal');
  const partyPanelMembers = document.getElementById('partyPanelMembers');
  const partyPanelCandidates = document.getElementById('partyPanelCandidates');
  const partyPanelCount = document.getElementById('partyPanelCount');
  const btnPartyPanelSummon = document.getElementById('btnPartyPanelSummon');
  const btnPartyPanelLeave = document.getElementById('btnPartyPanelLeave');
  const ZONE_LABELS = { town: 'Town', dungeon: 'Dungeon', frostfell: 'Frostfell', meadow: 'Outskirts' };
  const zoneLabel = (zone) => ZONE_LABELS[zone] || (zone ? zone.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '');
  const classIcon = (cls) => cls === 'mage' ? '🔮' : cls === 'rogue' ? '🗡️' : '⚔️';
  let partyCandidates = [];

  function hasPartyMates() {
    return !!(currentParty && currentParty.members && currentParty.members.length > 1);
  }

  function renderPartyPanel() {
    const btnWithParty = document.getElementById('btnEnterDungeonWithParty');
    if (btnWithParty) btnWithParty.style.display = hasPartyMates() ? '' : 'none';
    if (!partyModal || partyModal.style.display !== 'flex') return;

    const members = (currentParty && currentParty.members) || [];
    if (partyPanelCount) partyPanelCount.textContent = members.length ? `(${members.length}/4)` : '';
    if (btnPartyPanelSummon) btnPartyPanelSummon.style.display = hasPartyMates() ? '' : 'none';
    if (btnPartyPanelLeave) btnPartyPanelLeave.style.display = members.length ? '' : 'none';

    partyPanelMembers.innerHTML = '';
    if (!members.length) {
      partyPanelMembers.innerHTML = '<div class="party-panel-empty">You are not in a party. Invite someone below!</div>';
    }
    members.forEach(m => {
      const row = document.createElement('div');
      row.className = 'party-panel-row';
      row.innerHTML = `<span>${classIcon(m.characterClass)}</span>
        <span class="party-panel-name"></span>
        <span class="party-panel-meta">Lv. ${m.level} · ${zoneLabel(m.zone)}</span>`;
      row.querySelector('.party-panel-name').textContent = (m.isLeader ? '👑 ' : '') + m.name;
      partyPanelMembers.appendChild(row);
    });

    partyPanelCandidates.innerHTML = '';
    const partyFull = members.length >= 4;
    if (!partyCandidates.length) {
      partyPanelCandidates.innerHTML = '<div class="party-panel-empty">No other players available to invite.</div>';
    }
    partyCandidates.forEach(c => {
      const row = document.createElement('div');
      row.className = 'party-panel-row';
      row.innerHTML = `<span>${classIcon(c.characterClass)}</span>
        <span class="party-panel-name"></span>
        <span class="party-panel-meta">Lv. ${c.level} · ${zoneLabel(c.zone)}</span>
        <button class="party-row-invite-btn">+ Invite</button>`;
      row.querySelector('.party-panel-name').textContent = c.name;
      const btn = row.querySelector('.party-row-invite-btn');
      btn.disabled = partyFull;
      btn.addEventListener('click', () => {
        socket.emit('party_invite', { targetPlayerId: c.id });
        btn.disabled = true;
        btn.textContent = 'Sent';
      });
      partyPanelCandidates.appendChild(row);
    });
  }

  socket.on('party_candidates', (list) => {
    partyCandidates = list || [];
    renderPartyPanel();
  });

  function openPartyPanel() {
    if (!partyModal) return;
    partyModal.style.display = 'flex';
    socket.emit('party_list_candidates');
    renderPartyPanel();
  }

  function togglePartyPanel() {
    if (partyModal && partyModal.style.display === 'flex') partyModal.style.display = 'none';
    else openPartyPanel();
  }

  const btnOpenParty = document.getElementById('btnOpenParty');
  if (btnOpenParty) btnOpenParty.addEventListener('click', togglePartyPanel);
  const btnCloseParty = document.getElementById('btnCloseParty');
  if (btnCloseParty) btnCloseParty.addEventListener('click', () => { partyModal.style.display = 'none'; });
  if (partyModal) {
    partyModal.addEventListener('click', (e) => {
      if (e.target === partyModal) partyModal.style.display = 'none';
    });
  }
  const btnPartyRefresh = document.getElementById('btnPartyRefresh');
  if (btnPartyRefresh) btnPartyRefresh.addEventListener('click', () => socket.emit('party_list_candidates'));
  if (btnPartyPanelSummon) btnPartyPanelSummon.addEventListener('click', summonParty);
  if (btnPartyPanelLeave) btnPartyPanelLeave.addEventListener('click', () => socket.emit('party_leave'));
  const mBtnOpenParty = document.getElementById('mBtnOpenParty');
  if (mBtnOpenParty) {
    mBtnOpenParty.addEventListener('click', () => {
      if (mobileMenuDrawer) mobileMenuDrawer.style.display = 'none';
      openPartyPanel();
    });
  }

  function renderPartyFrame() {
    if (!partyFrame || !partyMembersList) return;
    if (!currentParty || !currentParty.members || currentParty.members.length <= 1) {
      partyFrame.style.display = 'none';
      return;
    }

    partyFrame.style.display = 'flex';
    if (partyCountText) partyCountText.textContent = `${currentParty.members.length}/4`;

    const isLeader = localPlayer && currentParty.leaderId === localPlayer.id;
    partyMembersList.innerHTML = '';

    currentParty.members.forEach(m => {
      const row = document.createElement('div');
      row.className = 'party-member-row';

      const avatar = document.createElement('div');
      avatar.className = 'party-member-avatar';
      avatar.textContent = m.characterClass === 'mage' ? '🔮' : m.characterClass === 'rogue' ? '🗡️' : '⚔️';

      const info = document.createElement('div');
      info.className = 'party-member-info';

      const nameRow = document.createElement('div');
      nameRow.className = 'party-member-name-row';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'party-member-name';
      nameSpan.textContent = (m.isLeader ? '👑 ' : '') + m.name;
      if (localPlayer && m.id === localPlayer.id) {
        nameSpan.style.color = '#38bdf8';
      }

      const lvlSpan = document.createElement('span');
      lvlSpan.className = 'party-member-level';
      lvlSpan.textContent = `Lv. ${m.level}`;
      if (localPlayer && m.id !== localPlayer.id && m.zone !== localPlayer.zone) {
        const zoneSpan = document.createElement('span');
        zoneSpan.className = 'party-member-zone';
        zoneSpan.textContent = ` · ${zoneLabel(m.zone)}`;
        lvlSpan.appendChild(zoneSpan);
      }

      nameRow.appendChild(nameSpan);
      nameRow.appendChild(lvlSpan);

      const bars = document.createElement('div');
      bars.className = 'party-member-bars';

      const hpBar = document.createElement('div');
      hpBar.className = 'party-mini-bar';
      const hpFill = document.createElement('div');
      hpFill.className = 'party-mini-fill-hp';
      const hpPct = Math.max(0, Math.min(100, Math.round((m.hp / (m.maxHp || 1)) * 100)));
      hpFill.style.width = `${hpPct}%`;
      hpBar.appendChild(hpFill);

      const mpBar = document.createElement('div');
      mpBar.className = 'party-mini-bar';
      const mpFill = document.createElement('div');
      mpFill.className = 'party-mini-fill-mp';
      const mpPct = Math.max(0, Math.min(100, Math.round((m.mp / (m.maxMp || 1)) * 100)));
      mpFill.style.width = `${mpPct}%`;
      mpBar.appendChild(mpFill);

      bars.appendChild(hpBar);
      bars.appendChild(mpBar);

      info.appendChild(nameRow);
      info.appendChild(bars);

      row.appendChild(avatar);
      row.appendChild(info);

      if (isLeader && localPlayer && m.id !== localPlayer.id) {
        const kickBtn = document.createElement('button');
        kickBtn.className = 'party-kick-btn';
        kickBtn.title = `Kick ${m.name}`;
        kickBtn.textContent = '✕';
        kickBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          socket.emit('party_kick', { targetId: m.id });
        });
        row.appendChild(kickBtn);
      }

      partyMembersList.appendChild(row);
    });
  }


  // HUD Update
  // Buff / debuff chips right of the player frame. Ticks carry p.buffs as
  // [{ k, n, i, t?, v?, d? }] (see heroBuffs on the server); a raw
  // 'player_updated' object has none, so the tray keeps what it shows.
  const buffTray = document.getElementById('buffTray');
  let buffTraySig = '';
  function renderBuffTray(p) {
    if (!buffTray || !Array.isArray(p.buffs)) return;
    const sig = JSON.stringify(p.buffs);
    if (sig === buffTraySig) return;
    buffTraySig = sig;
    buffTray.replaceChildren(...p.buffs.map(b => {
      const chip = document.createElement('div');
      chip.className = 'buff-chip' + (b.d ? ' is-debuff' : '');
      chip.title = b.n + (b.v !== undefined ? ` (${b.v})` : '') + (b.t ? ` - ${b.t}s` : b.d ? '' : ' - until switched off');
      const icon = document.createElement('span');
      icon.className = 'buff-icon';
      icon.textContent = b.i;
      chip.appendChild(icon);
      if (b.v !== undefined) {
        const v = document.createElement('span');
        v.className = 'buff-stack';
        v.textContent = b.v;
        chip.appendChild(v);
      }
      const time = document.createElement('span');
      time.className = 'buff-time';
      time.textContent = b.t ? `${b.t}s` : (b.d ? '' : 'ON');
      chip.appendChild(time);
      return chip;
    }));
  }

  function updatePlayerHUD(p) {
    renderBuffTray(p);
    hudPlayerName.textContent = p.name;
    hudPlayerClass.textContent = p.characterClass;
    playerLevelBadge.textContent = `Lv. ${p.level}`;

    const hpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
    hudHpFill.style.width = `${hpPct}%`;
    hudHpText.textContent = `${p.hp} / ${p.maxHp} HP`;

    const mpPct = Math.max(0, Math.min(100, (p.mp / p.maxMp) * 100));
    hudMpFill.style.width = `${mpPct}%`;
    hudMpText.textContent = `${p.mp} / ${p.maxMp} MP`;

    const expPct = Math.max(0, Math.min(100, (p.exp / p.expNext) * 100));
    hudExpFill.style.width = `${expPct}%`;

    goldCountText.textContent = `${p.gold} Gold`;
    if (shopPlayerGold) shopPlayerGold.textContent = p.gold;

    if (p.inventory) {
      const hpId = selectedPotion(p, 'health');
      const mpId = selectedPotion(p, 'mana');
      const hpCount = potionCount(p, hpId);
      const mpCount = potionCount(p, mpId);
      if (badgeHealthPotion) badgeHealthPotion.textContent = hpCount;
      if (badgeManaPotion) badgeManaPotion.textContent = mpCount;
      if (mobileBadgeHp) mobileBadgeHp.textContent = hpCount;
      if (mobileBadgeMp) mobileBadgeMp.textContent = mpCount;

      const isGreaterHp = hpId === 'greater_health_potion';
      const isGreaterMp = mpId === 'greater_mana_potion';

      if (slotHealthPotion) {
        slotHealthPotion.classList.toggle('greater-potion', isGreaterHp);
        slotHealthPotion.title = `${isGreaterHp ? '★ Greater Health Potion (+75% HP)' : 'Health Potion (+45% HP)'} [x${hpCount}]\n• Click or ⇄ to Switch Size\n• Press [1] to Drink`;
      }
      if (slotManaPotion) {
        slotManaPotion.classList.toggle('greater-potion', isGreaterMp);
        slotManaPotion.title = `${isGreaterMp ? '★ Greater Mana Potion (+80% MP)' : 'Mana Potion (+50% MP)'} [x${mpCount}]\n• Click or ⇄ to Switch Size\n• Press [2] to Drink`;
      }

      const invHp = document.getElementById('invHpCount');
      const invMp = document.getElementById('invMpCount');
      const invGold = document.getElementById('invGoldText');
      if (invHp) invHp.textContent = hpCount;
      if (invMp) invMp.textContent = mpCount;
      if (invGold) invGold.textContent = p.gold;
      renderPotionSlotLabels(p);
    }

    // Job level bar and SP transform slot
    const jobPct = p.jobExpNext ? Math.max(0, Math.min(100, ((p.jobExp || 0) / p.jobExpNext) * 100)) : 0;
    const hudJobBadge = document.getElementById('hudJobBadge');
    const hudJobFill = document.getElementById('hudJobFill');
    if (hudJobBadge) hudJobBadge.textContent = `JOB ${p.jobLevel || 1}`;
    if (hudJobFill) hudJobFill.style.width = `${jobPct}%`;
    updateSpSlot(p);
    if (statsModal && statsModal.style.display === 'flex') renderStatsPanel(p);
  }

  // ---------------------------------------------------------------- SP cards
  function spCardDef(cardId) {
    if (!spCatalog || !cardId) return null;
    for (const list of Object.values(spCatalog.cards)) {
      const c = list.find(x => x.id === cardId);
      if (c) return c;
    }
    return null;
  }

  function updateSpSlot(p) {
    const slot = document.getElementById('slotSpCard');
    const mobileSp = document.getElementById('mobileBtnSp');
    const cardItem = p.equipment && p.equipment.sp;
    const card = cardItem && spCardDef(cardItem.cardId);
    [slot, mobileSp].forEach(el => {
      if (!el) return;
      el.classList.toggle('has-card', !!card);
      el.classList.toggle('is-active', !!p.spTransformed);
    });
    if (slot && window.GameTooltip) {
      GameTooltip.html(slot, () => card
        ? `<div class="tip-text"><b style="color:${card.color}">${escapeHtml(card.name)}${cardItem.upgradeLevel ? ' +' + cardItem.upgradeLevel : ''}</b><br>${p.spTransformed ? 'Transformed - press T to revert' : 'Press T to transform'}${(p.jobLevel || 1) < card.jobReq ? `<br><span style="color:#ff6b6b">Requires Job Lv. ${card.jobReq}</span>` : ''}</div>`
        : '<div class="tip-text"><b>SP Card</b><br>Equip an SP card in your inventory, then press T to transform.</div>');
    }
  }

  function requestTransform() {
    if (!localPlayer || localPlayer.isDead) return;
    socket.emit('sp_transform');
  }

  const slotSpCard = document.getElementById('slotSpCard');
  if (slotSpCard) slotSpCard.addEventListener('click', requestTransform);
  const mobileBtnSpEl = document.getElementById('mobileBtnSp');
  if (mobileBtnSpEl) mobileBtnSpEl.addEventListener('click', requestTransform);

  socket.on('sp_transform', (data) => {
    if (renderer) renderer.triggerSpTransform(data);
    if (!data.refresh) window.soundEngine.playLevelUp();
  });

  socket.on('job_level_up', (data) => {
    if (renderer) renderer.addParticles(data.x, data.y, 'arcane', 24);
    if (data.playerId === localPlayerId) window.soundEngine.playLevelUp();
  });

  // ---------------------------------------------------------------- stats panel
  const ELEMENT_NAMES = { fire: 'Fire', ice: 'Ice', lightning: 'Lightning', earth: 'Earth', holy: 'Holy', dark: 'Dark', neutral: 'Neutral' };
  const ELEMENT_COLORS = { fire: '#f97316', ice: '#38bdf8', lightning: '#facc15', earth: '#4ade80', holy: '#fef08a', dark: '#a855f7', neutral: '#94a3b8' };
  const portraitCache = {};
  function heroPortraitUrl(cls) {
    if (!window.PixelHeroes) return '';
    if (!portraitCache[cls]) portraitCache[cls] = PixelHeroes.portrait(cls, 72);
    return portraitCache[cls];
  }

  // Sum of the bonus stats on worn gear (with reforges)
  function gearTotals(eq) {
    const keys = ['bonusDmg', 'bonusDef', 'bonusHp', 'bonusMp', 'bonusSpeed', 'bonusAttackSpeed', 'bonusSwipe'];
    const tot = Object.fromEntries(keys.map(k => [k, 0]));
    for (const it of Object.values(eq || {})) {
      if (!it || it.type !== 'equipment') continue;
      for (const k of keys) tot[k] += (it[k] || 0) + ((it.reforgeStats && it.reforgeStats[k]) || 0);
    }
    return tot;
  }

  function renderStatsPanel(p) {
    const body = document.getElementById('statsBody');
    if (!body || !p) return;
    const gear = gearTotals(p.equipment);
    const cardItem = p.equipment && p.equipment.sp;
    const card = cardItem && spCardDef(cardItem.cardId);
    const pct = (a, b) => (b ? Math.max(0, Math.min(100, (a / b) * 100)) : 0);
    const bonus = v => (v ? `<i>+${v}</i>` : '');
    const critChance = Math.round((0.15 + (p.critChanceBonus || 0)) * 100);
    const critDmg = Math.round((1.5 + (p.critDmgBonus || 0)) * 100);
    const statCards = [
      ['sword', 'Attack', p.dmg, bonus(gear.bonusDmg)],
      ['crown', 'Mastery', `x${(p.mastery || 1).toFixed(2)}`, '<i>ATK, from Lv 21</i>'],
      ['shield', 'Defense', p.def, bonus(gear.bonusDef)],
      ['heart', 'Max HP', p.maxHp, bonus(gear.bonusHp)],
      ['mp_potion', 'Max MP', p.maxMp, bonus(gear.bonusMp)],
      ['bolt', 'Attack Speed', `${(p.attackSpeed || 1).toFixed(2)}x`, gear.bonusAttackSpeed ? `<i>+${Math.round(gear.bonusAttackSpeed * 100)}%</i>` : ''],
      ['boots', 'Move Speed', (p.speed || 0).toFixed(1), ''],
      ['whirl', 'Swipe', `${p.swipe || 0}%`, ''],
      ['target', 'Crit Chance', `${critChance}%`, ''],
      ['burst', 'Crit Damage', `${critDmg}%`, ''],
      ['feather', 'Dodge', `${Math.round((p.dodgeChance || 0) * 100)}%`, ''],
      ['fang', 'Life Steal', `${Math.round((p.lifeSteal || 0) * 1000) / 10}%`, ''],
      ['thorns', 'Thorns', p.thorns || 0, '']
    ];
    // Talent branch mechanics, shown once unlocked
    const tp = p.talentProcs || {};
    const pc = v => `${+(v * 100).toFixed(1)}%`;
    if (tp.burnPower) statCards.push(['fire', 'Ignite', `${pc(tp.burnPower)} ATK/0.6s`, '']);
    if (tp.chillChance) statCards.push(['snow', 'Frostbite', `${pc(tp.chillChance)} chill`, `<i>+${pc(tp.shatterBonus || 0)} dmg</i>`]);
    if (tp.echoChance) statCards.push(['essence', 'Void Echo', pc(tp.echoChance), `<i>${pc(tp.manaLeech || 0)} MP leech</i>`]);
    if (tp.poisonPower) statCards.push(['poison', 'Venom', `${pc(tp.poisonPower)} ATK/stack`, '<i>max x5</i>']);
    const weaponEl = (p.spTransformed && card) ? card.element
      : (p.equipment && p.equipment.weapon && p.equipment.weapon.element) || 'neutral';
    const resist = p.elementResist || {};
    const spLine = card
      ? `SP: <b style="color:${card.color}">${escapeHtml(card.name)}${cardItem.upgradeLevel ? ' +' + cardItem.upgradeLevel : ''}</b> - ${p.spTransformed ? 'transformed' : (p.jobLevel || 1) < card.jobReq ? `needs Job ${card.jobReq}` : 'ready (T)'}`
      : 'SP: no card equipped';

    body.innerHTML = `
      <div class="stats-hero">
        <img class="stats-portrait" src="${heroPortraitUrl(p.characterClass)}" alt="">
        <div class="stats-hero-info">
          <div class="stats-hero-name">${escapeHtml(p.name)}<small>${(p.characterClass || '').toUpperCase()}</small></div>
          <div class="stats-bar exp"><div style="width:${pct(p.exp, p.expNext)}%"></div><span>Lv. ${p.level} - ${p.exp} / ${p.expNext} EXP</span></div>
          <div class="stats-bar job"><div style="width:${pct(p.jobExp || 0, p.jobExpNext)}%"></div><span>Job ${p.jobLevel || 1} - ${p.jobExp || 0} / ${p.jobExpNext || 0}</span></div>
          <div class="stats-sp">${spLine}</div>
        </div>
      </div>
      <div class="stats-section">
        <div class="stats-section-title">COMBAT</div>
        <div class="stat-grid">${statCards.map(([icon, label, value, extra]) => `
          <div class="stat-card">${PixelIcons.html(icon)}<div><div class="stat-card-label">${label}</div><div class="stat-card-value">${value}${extra}</div></div></div>`).join('')}
        </div>
      </div>
      <div class="stats-section">
        <div class="stats-section-title">ELEMENTS</div>
        <div class="elem-row"><span>Attack</span><span style="color:${ELEMENT_COLORS[weaponEl]}">${ELEMENT_NAMES[weaponEl] || weaponEl}</span><b></b></div>
        ${['fire', 'ice', 'lightning', 'earth', 'holy', 'dark'].map(el => {
          const v = Math.round((resist[el] || 0) * 100);
          return `<div class="elem-row"><span style="color:${ELEMENT_COLORS[el]}">${ELEMENT_NAMES[el]} RES</span><div class="stats-bar"><div style="width:${Math.min(100, v / 0.6)}%; background:${ELEMENT_COLORS[el]}"></div></div><b>${v}%</b></div>`;
        }).join('')}
      </div>
      <div class="stats-section">
        <div class="stats-section-title">RECORDS</div>
        <div class="stats-records">
          <span>Monsters slain <b>${(p.inventory && p.inventory.kills) || 0}</b></span>
          <span>Gold <b>${(p.gold || 0).toLocaleString()}</b></span>
          <span>Skill points <b>${p.skillPoints || 0}</b></span>
        </div>
      </div>`;
  }

  // ================= SHOP & INVENTORY UI =================

  function openShopModal() {
    renderShopBuyList();
    renderShopSellList();
    if (shopPlayerGold && localPlayer) shopPlayerGold.textContent = localPlayer.gold;
    shopModal.style.display = 'flex';
  }

  function renderShopBuyList() {
    if (!shopBuyList || !shopItemsCatalog.length) return;
    shopBuyList.innerHTML = '';

    shopItemsCatalog.forEach(item => {
      const card = document.createElement('div');
      card.className = `shop-item-card rarity-${item.rarity || 'common'}`;
      let qty = 1;
      const unitPrice = item.buyPrice || 0;

      card.innerHTML = `
        <div class="shop-item-left">
          <div class="shop-item-icon">${PixelIcons.itemHtml(item)}</div>
          <div class="shop-item-details">
            <div class="shop-item-name">${item.name}</div>
            <div class="shop-item-desc">${item.desc || ''}</div>
          </div>
        </div>
        <div class="shop-buy-action-group" style="display: flex; align-items: center; gap: 8px;">
          <div class="shop-qty-controls" style="display: flex; align-items: center; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 4px; gap: 3px;">
            <button type="button" class="btn-qty-sub" style="width: 22px; height: 22px; background: rgba(255,255,255,0.1); border: none; color: #fff; cursor: pointer; border-radius: 3px; font-weight: bold; line-height: 1;">-</button>
            <input type="number" class="shop-qty-val" min="1" max="999" value="1" style="width: 44px; height: 22px; background: transparent; border: none; color: #fde68a; font-weight: bold; font-family: monospace; text-align: center; font-size: 13px;">
            <button type="button" class="btn-qty-add" style="width: 22px; height: 22px; background: rgba(255,255,255,0.1); border: none; color: #fff; cursor: pointer; border-radius: 3px; font-weight: bold; line-height: 1;">+</button>
            <button type="button" class="btn-qty-max" style="padding: 0 6px; height: 22px; background: rgba(245,158,11,0.25); border: 1px solid rgba(245,158,11,0.5); color: #fde68a; cursor: pointer; border-radius: 3px; font-size: 11px; font-weight: bold;">Max</button>
          </div>
          <button class="btn-shop-action" data-buy-id="${item.id}">
            Buy 1x (${unitPrice}g)
          </button>
        </div>
      `;

      GameTooltip.item(card.querySelector('.shop-item-icon'), item);

      const btnSub = card.querySelector('.btn-qty-sub');
      const btnAdd = card.querySelector('.btn-qty-add');
      const btnMax = card.querySelector('.btn-qty-max');
      const inputVal = card.querySelector('.shop-qty-val');
      const btnBuy = card.querySelector('.btn-shop-action');

      const updateUI = () => {
        const total = qty * unitPrice;
        btnBuy.textContent = `Buy ${qty}x (${total}g)`;
        inputVal.value = qty;
      };

      btnSub.addEventListener('click', (e) => {
        e.stopPropagation();
        qty = Math.max(1, qty - 1);
        updateUI();
      });

      btnAdd.addEventListener('click', (e) => {
        e.stopPropagation();
        qty = Math.min(999, qty + 1);
        updateUI();
      });

      btnMax.addEventListener('click', (e) => {
        e.stopPropagation();
        const playerGold = (localPlayer && localPlayer.gold) || 0;
        const maxAffordable = unitPrice > 0 ? Math.floor(playerGold / unitPrice) : 999;
        qty = Math.max(1, Math.min(999, maxAffordable));
        updateUI();
      });

      inputVal.addEventListener('change', () => {
        let v = parseInt(inputVal.value, 10);
        if (isNaN(v) || v < 1) v = 1;
        if (v > 999) v = 999;
        qty = v;
        updateUI();
      });

      inputVal.addEventListener('click', (e) => e.stopPropagation());

      btnBuy.addEventListener('click', () => {
        socket.emit('buy_item', { itemId: item.id, count: qty });
        window.soundEngine.playCoin();
      });

      shopBuyList.appendChild(card);
    });
  }

  // Sell tab state: selected bag slots (index -> item id, so a changed bag drops
  // stale picks) and whether Shift is held (Shift = sell the whole stack).
  const sellSelected = new Map();
  const sellQty = new Map();
  let sellFocus = -1;
  let sellShiftHeld = false;
  let sellRefreshers = [];
  function setSellShift(held) {
    if (held === sellShiftHeld) return;
    sellShiftHeld = held;
    sellRefreshers.forEach(fn => fn());
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Shift') setSellShift(true); });
  document.addEventListener('keyup', (e) => { if (e.key === 'Shift') setSellShift(false); });
  window.addEventListener('blur', () => setSellShift(false));

  function renderShopSellList() {
    if (!shopSellList || !localPlayer || !localPlayer.inventory) return;
    shopSellList.innerHTML = '';
    sellRefreshers = [];

    const items = localPlayer.inventory.items || [];
    for (const [index, id] of sellSelected) {
      if (!items[index] || items[index].id !== id) { sellSelected.delete(index); sellQty.delete(index); }
    }
    for (const index of sellQty.keys()) {
      if (!sellSelected.has(index)) sellQty.delete(index);
    }
    if (!items[sellFocus]) sellFocus = -1;
    if (items.length === 0) {
      shopSellList.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 30px;">Your bag has no relics to sell. Delve into the dungeon to find loot!</div>';
      return;
    }

    const countOf = (index) => items[index].count || 1;
    const qtyOf = (index) => sellShiftHeld ? countOf(index) : Math.max(1, Math.min(countOf(index), sellQty.get(index) || 1));

    const isSpecialCard = (it) => it && (it.type === 'sp_card' || (it.id && it.id.startsWith('sp_card_')));

    // Bulk bar: select all + sell every ticked slot in one go (Special Cards protected)
    const bar = document.createElement('div');
    bar.className = 'sell-bulk-bar';
    bar.innerHTML = `
      <label class="sell-bulk-all"><input type="checkbox"> Select all</label>
      <span class="sell-bulk-hint">Click slots to select - hold SHIFT to sell stacks (Special Cards protected)</span>
      <button class="btn-shop-action sell sell-bulk-btn"></button>`;
    shopSellList.appendChild(bar);
    const allBox = bar.querySelector('input');
    const bulkBtn = bar.querySelector('.sell-bulk-btn');

    const grid = document.createElement('div');
    grid.className = 'inventory-grid-compact sell-grid';
    shopSellList.appendChild(grid);

    const detail = document.createElement('div');
    detail.className = 'sell-detail';
    shopSellList.appendChild(detail);

    const cells = [];
    const refreshBulk = () => {
      let total = 0;
      for (const index of sellSelected.keys()) {
        if (items[index]) total += (items[index].sellPrice || 10) * qtyOf(index);
      }
      bulkBtn.textContent = `Sell selected (${sellSelected.size}) +${total}g`;
      bulkBtn.disabled = sellSelected.size === 0;
      const sellableCount = items.filter(it => !isSpecialCard(it)).length;
      allBox.checked = sellableCount > 0 && sellSelected.size === sellableCount;
      cells.forEach((cell, index) => cell.classList.toggle('selected', sellSelected.has(index)));
    };

    // Detail bar for the last clicked slot: quantity + single sell
    const renderDetail = () => {
      if (sellFocus < 0) {
        detail.innerHTML = '<span class="sell-detail-empty">Select an item to see its price</span>';
        return;
      }
      const item = items[sellFocus];
      const index = sellFocus;
      const count = countOf(index);
      const unitPrice = item.sellPrice || 10;
      detail.innerHTML = `
        <div class="shop-item-icon">${PixelIcons.itemHtml(item)}</div>
        <div class="shop-item-details">
          <div class="shop-item-name">${item.name} ${count > 1 ? `x${count}` : ''}</div>
          <div class="shop-item-desc">${unitPrice}g each</div>
        </div>
        <div class="sell-qty-controls">
          ${count > 1 ? `
            <input type="number" class="sell-qty-input" min="1" max="${count}" value="${sellQty.get(index) || 1}" title="Amount to sell">
            <button class="sell-qty-max" title="Sell all">MAX</button>
          ` : ''}
          <button class="btn-shop-action sell"></button>
        </div>`;
      const btn = detail.querySelector('.btn-shop-action');
      const qtyInput = detail.querySelector('.sell-qty-input');
      const refreshPrice = () => {
        btn.textContent = `${sellShiftHeld && count > 1 ? 'Sell all' : 'Sell'} +${unitPrice * qtyOf(index)}g`;
      };
      const setQty = (val) => {
        sellQty.set(index, Math.max(1, Math.min(count, parseInt(val, 10) || 1)));
        refreshPrice();
        refreshBulk();
      };
      if (qtyInput) {
        qtyInput.addEventListener('input', () => setQty(qtyInput.value));
        qtyInput.addEventListener('keydown', (e) => e.stopPropagation());
        detail.querySelector('.sell-qty-max').addEventListener('click', () => {
          qtyInput.value = count;
          setQty(count);
        });
      }
      btn.addEventListener('click', (e) => {
        socket.emit('sell_item', { itemIndex: index, quantity: e.shiftKey ? count : qtyOf(index) });
        window.soundEngine.playCoin();
      });
      sellRefreshers.push(refreshPrice);
      refreshPrice();
    };

    sellRefreshers.push(refreshBulk);
    allBox.addEventListener('change', () => {
      sellSelected.clear();
      if (allBox.checked) {
        items.forEach((it, i) => {
          if (!isSpecialCard(it)) sellSelected.set(i, it.id);
        });
      }
      refreshBulk();
    });
    bulkBtn.addEventListener('click', () => {
      if (sellSelected.size === 0) return;
      const entries = [...sellSelected.keys()]
        .filter(index => items[index] && !isSpecialCard(items[index]))
        .map(index => ({ itemIndex: index, quantity: qtyOf(index) }));
      sellSelected.clear();
      sellQty.clear();
      sellFocus = -1;
      if (entries.length > 0) {
        socket.emit('sell_items', { entries });
        window.soundEngine.playCoin();
      }
    });

    const slots = Math.max(BAG_CAPACITY, Math.ceil(items.length / 6) * 6);
    for (let i = 0; i < slots; i++) {
      const cell = document.createElement('div');
      cell.className = 'inv-slot-compact';
      const item = items[i];
      if (!item) {
        cell.classList.add('empty');
        grid.appendChild(cell);
        continue;
      }
      const isSp = isSpecialCard(item);
      cell.classList.add(`rarity-${item.rarity || 'common'}`);
      if (isSp) cell.classList.add('sp-card-protected');
      cell.innerHTML = `
        <div class="inv-icon">${PixelIcons.itemHtml(item)}</div>
        ${item.upgradeLevel ? `<span class="upgrade-badge">+${item.upgradeLevel}</span>` : ''}
        ${item.count > 1 ? `<div class="inv-badge">x${item.count}</div>` : ''}`;
      GameTooltip.item(cell, item, {
        hint: isSp
          ? 'Specialist Card (Protected from Select All)'
          : `Sell price ${item.sellPrice || 10}g${item.count > 1 ? ' each' : ''}`
      });
      cell.addEventListener('click', () => {
        if (sellSelected.has(i) && sellFocus === i) {
          sellSelected.delete(i);
          sellQty.delete(i);
        } else {
          sellSelected.set(i, item.id);
        }
        sellFocus = sellSelected.has(i) ? i : -1;
        renderDetail();
        refreshBulk();
      });
      cells[i] = cell;
      grid.appendChild(cell);
    }

    renderDetail();
    refreshBulk();
  }

  let invFilter = 'all';
  let invSorted = false;
  const BAG_CAPACITY = 30;
  const RARITY_RANK = { mythic: 5, legendary: 4, epic: 3, rare: 2, common: 1 };
  const TYPE_RANK = { sp_card: 0, equipment: 1, consumable: 2, material: 3, treasure: 4 };
  const EQUIP_SLOTS = [
    ['eqSlotHelmet', 'helmet'], ['eqSlotArmor', 'armor'], ['eqSlotWeapon', 'weapon'],
    ['eqSlotRing', 'ring'], ['eqSlotBoots', 'boots'], ['eqSlotSp', 'sp']
  ];

  // Gear locked to another class (weapons, SP cards) goes in OTHER instead of GEAR
  function isOtherClassGear(item) {
    return !!(item.cls && localPlayer && item.cls !== localPlayer.characterClass);
  }

  function itemMatchesFilter(item) {
    if (invFilter === 'gear') return (item.type === 'equipment' || item.type === 'sp_card') && !isOtherClassGear(item);
    if (invFilter === 'other') return isOtherClassGear(item);
    if (invFilter === 'use') return item.type === 'consumable';
    if (invFilter === 'loot') return item.type === 'treasure' || item.type === 'material';
    return true;
  }

  // Why this gear can't be equipped right now (wrong class, job level too low), or null
  function equipBlocker(item) {
    if (item.type !== 'equipment' && item.type !== 'sp_card') return null;
    if (isOtherClassGear(item)) return `${item.cls.charAt(0).toUpperCase() + item.cls.slice(1)} only`;
    if (item.type === 'sp_card') {
      const card = spCardDef(item.cardId);
      if (card && localPlayer && (localPlayer.jobLevel || 1) < card.jobReq) return `Requires Job Lv. ${card.jobReq}`;
    }
    return null;
  }

  function bagHint(item) {
    const blocker = equipBlocker(item);
    if (blocker) return `Can't equip: ${blocker}`;
    if (item.type === 'equipment') return 'Click to equip';
    if (item.type === 'sp_card') {
      const card = spCardDef(item.cardId);
      return card ? `Click to equip (Job Lv. ${card.jobReq})` : 'Click to equip';
    }
    if (/potion/.test(item.id || '')) return 'Click to drink';
    return `Sell to Olaf for ${item.sellPrice || 10}g`;
  }

  // Live idle preview of the hero (in costume when transformed)
  let invPreviewRaf = 0;
  function startInvHeroPreview() {
    if (invPreviewRaf || !window.PixelHeroes || !renderer) return;
    const cv = document.getElementById('invHeroCanvas');
    if (!cv) return;
    const g = cv.getContext('2d');
    const step = (ts) => {
      if (inventoryModal.style.display !== 'flex' || !localPlayer) { invPreviewRaf = 0; return; }
      g.clearRect(0, 0, cv.width, cv.height);
      g.imageSmoothingEnabled = false;
      g.drawImage(renderer.heroFrameFor(localPlayer, 'S', 'idle', Math.floor(ts / 1000 * 6) % 8), 0, 0);
      invPreviewRaf = requestAnimationFrame(step);
    };
    invPreviewRaf = requestAnimationFrame(step);
  }

  function renderInventoryGrid() {
    if (!localPlayer) return;
    const eq = localPlayer.equipment || {};

    // 1. Paper doll
    EQUIP_SLOTS.forEach(([id, slot]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const item = eq[slot];
      const content = el.querySelector('.equip-item-content');
      const placeholder = el.querySelector('.slot-placeholder-icon');
      el.className = 'equip-slot';
      el.querySelectorAll('.upgrade-badge').forEach(b => b.remove());
      if (item) {
        el.classList.add('filled', `rarity-${item.rarity || 'common'}`);
        if (placeholder) placeholder.style.display = 'none';
        content.innerHTML = PixelIcons.itemHtml(item);
        if (item.upgradeLevel) el.insertAdjacentHTML('beforeend', `<span class="upgrade-badge">+${item.upgradeLevel}</span>`);
        GameTooltip.item(el, item, { hint: 'Click to unequip' });
        el.onclick = () => {
          socket.emit('unequip_item', { slot });
          window.soundEngine.playSlash();
        };
      } else {
        if (placeholder) placeholder.style.display = '';
        content.innerHTML = '';
        GameTooltip.html(el, `<div class="tip-text"><b>${slot === 'sp' ? 'SP CARD' : slot.toUpperCase()}</b><br>${slot === 'sp' ? 'Equip an SP card, then press T to transform.' : 'Empty - click gear in your bag to equip.'}</div>`);
        el.onclick = null;
      }
    });
    const nameEl = document.getElementById('invHeroName');
    const subEl = document.getElementById('invHeroSub');
    if (nameEl) nameEl.textContent = localPlayer.name;
    if (subEl) subEl.textContent = `Lv. ${localPlayer.level} ${localPlayer.characterClass} - Job ${localPlayer.jobLevel || 1}`;
    startInvHeroPreview();

    // 2. Gear totals
    const bonusesBar = document.getElementById('gearBonusesSummary');
    if (bonusesBar) {
      const t = gearTotals(eq);
      const rows = [
        ['sword', 'Attack', t.bonusDmg && `+${t.bonusDmg}`],
        ['shield', 'Defense', t.bonusDef && `+${t.bonusDef}`],
        ['heart', 'Max HP', t.bonusHp && `+${t.bonusHp}`],
        ['mp_potion', 'Max MP', t.bonusMp && `+${t.bonusMp}`],
        ['boots', 'Speed', t.bonusSpeed && `+${t.bonusSpeed.toFixed(1)}`],
        ['bolt', 'Atk Spd', t.bonusAttackSpeed && `+${Math.round(t.bonusAttackSpeed * 100)}%`],
        ['whirl', 'Swipe', t.bonusSwipe && `+${t.bonusSwipe}%`],
        ['fire', 'Element', eq.weapon && eq.weapon.element && eq.weapon.element !== 'neutral' ? ELEMENT_NAMES[eq.weapon.element] : '']
      ];
      bonusesBar.innerHTML = rows.map(([icon, label, val]) =>
        `<span class="stat-pill ${val ? 'active' : ''}"><span>${PixelIcons.html(icon)}${label}</span><b>${val || '-'}</b></span>`).join('');
    }

    // 3. Bag
    const invGrid = document.getElementById('invItemsGrid');
    if (!invGrid || !localPlayer.inventory) return;
    const items = localPlayer.inventory.items || [];
    const capacityText = document.getElementById('invCapacityText');
    if (capacityText) {
      capacityText.textContent = `${items.length} / ${BAG_CAPACITY}`;
      capacityText.classList.toggle('is-full', items.length >= BAG_CAPACITY);
    }
    let list = items.map((item, index) => ({ item, index })).filter(e => itemMatchesFilter(e.item));
    if (invSorted) {
      list.sort((a, b) => (RARITY_RANK[b.item.rarity] || 0) - (RARITY_RANK[a.item.rarity] || 0)
        || (TYPE_RANK[a.item.type] || 9) - (TYPE_RANK[b.item.type] || 9)
        || String(a.item.name).localeCompare(String(b.item.name)));
    }
    invGrid.innerHTML = '';
    const cells = Math.max(BAG_CAPACITY, Math.ceil(list.length / 6) * 6);
    for (let i = 0; i < cells; i++) {
      const cell = document.createElement('div');
      cell.className = 'inv-slot-compact';
      const entry = list[i];
      if (!entry) {
        cell.classList.add('empty');
        invGrid.appendChild(cell);
        continue;
      }
      const { item, index } = entry;
      cell.classList.add(`rarity-${item.rarity || 'common'}`);
      if (equipBlocker(item)) cell.classList.add('unusable');
      cell.innerHTML = `
        <div class="inv-icon">${PixelIcons.itemHtml(item)}</div>
        ${item.upgradeLevel ? `<span class="upgrade-badge">+${item.upgradeLevel}</span>` : ''}
        ${item.count > 1 ? `<div class="inv-badge">x${item.count}</div>` : ''}`;
      GameTooltip.item(cell, item, { compare: item.slot ? eq[item.slot] : null, hint: bagHint(item) });
      cell.addEventListener('click', () => {
        if (item.type === 'equipment' || item.type === 'sp_card') {
          socket.emit('equip_item', { itemIndex: index });
          window.soundEngine.playLevelUp();
        } else if (item.id === 'health_potion') {
          drinkPotion('health');
        } else if (item.id === 'mana_potion') {
          drinkPotion('mana');
        } else if (item.id === 'greater_health_potion' || item.id === 'greater_mana_potion') {
          drinkPotion({ itemId: item.id });
        }
      });
      invGrid.appendChild(cell);
    }
  }

  document.querySelectorAll('#invTabs .inv-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      invFilter = tab.dataset.filter;
      document.querySelectorAll('#invTabs .inv-tab').forEach(t => t.classList.toggle('active', t === tab));
      renderInventoryGrid();
    });
  });
  const invSortBtn = document.getElementById('invSortBtn');
  if (invSortBtn) {
    invSortBtn.addEventListener('click', () => {
      invSorted = !invSorted;
      invSortBtn.classList.toggle('active', invSorted);
      renderInventoryGrid();
    });
  }

  // ---------------------------------------------------------------- Valka's rune forge
  const enchanterModal = document.getElementById('enchanterModal');
  let enchTab = 'gear';
  let enchSelected = null;   // 'eq:<slot>' | 'inv:<index>' | card id (exchange tab)
  let enchResult = null;     // { ok, text }

  function openEnchanter() {
    if (!enchanterModal) return;
    enchResult = null;
    renderEnchanter();
    enchanterModal.style.display = 'flex';
  }

  function fragmentCount() {
    const stack = localPlayer && localPlayer.inventory.items.find(i => i.id === 'spirit_fragment');
    return stack ? (stack.count || 1) : 0;
  }

  function enchEntries() {
    const eq = localPlayer.equipment || {};
    const out = [];
    const want = enchTab === 'gear' ? 'equipment' : 'sp_card';
    for (const [slot, it] of Object.entries(eq)) if (it && it.type === want) out.push({ key: `eq:${slot}`, item: it, target: 'equipped', slot, equipped: true });
    localPlayer.inventory.items.forEach((it, i) => { if (it.type === want) out.push({ key: `inv:${i}`, item: it, target: 'inventory', itemIndex: i }); });
    return out;
  }

  function gearEnhanceInfo(item) {
    const lvl = item.upgradeLevel || 0;
    const r = enhanceRules || { max: 15, safeLevel: 7, base: { common: 400, rare: 900, epic: 2000, legendary: 4500 }, growth: 1.55, chance: [] };
    return {
      lvl, max: r.max, safe: r.safeLevel,
      cost: Math.round((r.base[item.rarity] || r.base.common) * Math.pow(r.growth, lvl)),
      chance: r.chance[lvl] || 0
    };
  }

  function cardEnhanceInfo(item) {
    const lvl = item.upgradeLevel || 0;
    const card = spCardDef(item.cardId);
    const c = spCatalog;
    return {
      lvl, max: c.maxLevel, safe: c.safeLevel, card,
      // same formula as server/spCards.js cardEnhanceCost
      gold: Math.round((c.enhanceBase[card.tier] * Math.pow(c.growth, lvl / (c.levelStep || 1))) / (c.levelStep || 1)),
      fragments: Math.max(1, Math.round((((lvl / (c.levelStep || 1)) + 1) * 2) / (c.levelStep || 1))),
      chance: c.chance[lvl] || 0
    };
  }

  function chanceBar(chance) {
    const cls = chance < 0.35 ? 'danger' : chance < 0.7 ? 'risky' : '';
    return `<div class="ench-chance">Success chance <div class="stats-bar ${cls}"><div style="width:${Math.round(chance * 100)}%"></div><span>${Math.round(chance * 100)}%</span></div></div>`;
  }

  function cardStatLines(card, lvl) {
    const k = 1 + spCatalog.statPerLevel * lvl;
    const label = { bonusDmg: 'Attack', bonusDef: 'Defense', bonusHp: 'Max HP', bonusMp: 'Max MP', bonusSpeed: 'Speed', bonusAttackSpeed: 'Atk Speed', critChance: 'Crit' };
    return Object.entries(card.stats).map(([st, v]) => {
      const val = st === 'bonusAttackSpeed' ? `+${Math.round(v * k * 100)}%` : st === 'critChance' ? `+${Math.round(v * k)}%` : st === 'bonusSpeed' ? `+${(v * k).toFixed(2)}` : `+${Math.round(v * k)}`;
      return `<div class="tip-line"><span>${label[st] || st}</span><b>${val}</b></div>`;
    }).join('');
  }

  function cardSkillList(card) {
    const names = { slot1: 'Q', slot2: 'E', slot3: 'R', dash: 'Shift' };
    return `<div class="sp-skill-list">${Object.entries(card.skills).map(([slot, skillId]) => {
      const sk = findSkillDef(skillId);
      return sk ? `<div><b>[${names[slot]}] ${escapeHtml(sk.name)}</b>${escapeHtml(sk.desc)}</div>` : '';
    }).join('')}</div>`;
  }

  function cardObtainText(card) {
    const diffs = Object.entries(card.drop.chances).map(([d, c]) => `${d} ${(c * 100).toFixed(c < 0.01 ? 2 : 1)}%`).join(', ');
    return `<div class="sp-obtain"><b>How to obtain:</b> dungeon boss drop from Floor ${card.drop.minFloor}+ (${diffs} per boss kill)${card.exchange
      ? `, or trade <b>${card.exchange.fragments} Spirit Fragments + ${card.exchange.gold.toLocaleString()} Gold</b> here`
      : '. <b>Cannot be traded</b> - boss drop only'}. Spirit Fragments drop from dungeon bosses and elite monsters.</div>`;
  }

  function renderEnchanter() {
    if (!enchanterModal || !localPlayer) return;
    document.getElementById('enchGold').textContent = (localPlayer.gold || 0).toLocaleString();
    document.getElementById('enchFragments').textContent = fragmentCount();
    document.querySelectorAll('#enchTabs .ench-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === enchTab));
    const listEl = document.getElementById('enchList');
    const detailEl = document.getElementById('enchDetail');
    listEl.innerHTML = '';

    if (enchTab === 'exchange') {
      const cards = (spCatalog && spCatalog.cards[localPlayer.characterClass]) || [];
      if (!enchSelected || !cards.some(c => c.id === enchSelected)) enchSelected = cards[0] && cards[0].id;
      cards.forEach(card => {
        const row = document.createElement('div');
        row.className = `ench-row rarity-${card.rarity} ${card.id === enchSelected ? 'selected' : ''}`;
        row.innerHTML = `${PixelIcons.html('card')}<span class="ench-row-name" style="color:${card.color}">${escapeHtml(card.name)}<small>Tier ${card.tier} - Job ${card.jobReq}</small></span>`;
        row.addEventListener('click', () => { enchSelected = card.id; enchResult = null; renderEnchanter(); });
        listEl.appendChild(row);
      });
      const card = cards.find(c => c.id === enchSelected);
      if (!card) { detailEl.innerHTML = '<div class="ench-empty">No cards for this class.</div>'; return; }
      const ex = card.exchange;
      const canTrade = ex && fragmentCount() >= ex.fragments && localPlayer.gold >= ex.gold;
      detailEl.innerHTML = `
        <div class="ench-detail-head">${PixelIcons.html('card')}<div><div class="ench-detail-name" style="color:${card.color}">${escapeHtml(card.name)}</div>
          <div class="tip-type">${card.rarity.toUpperCase()} - Tier ${card.tier} - ${ELEMENT_NAMES[card.element]} - requires Job Lv. ${card.jobReq}</div></div></div>
        <div class="tip-flavour">${escapeHtml(card.desc)}</div>
        <div>${cardStatLines(card, 0)}</div>
        ${cardSkillList(card)}
        ${cardObtainText(card)}
        ${ex ? `<div class="ench-cost"><span class="${fragmentCount() < ex.fragments ? 'short' : ''}">${ex.fragments} Fragments</span><span class="${localPlayer.gold < ex.gold ? 'short' : ''}">${ex.gold.toLocaleString()} Gold</span></div>
          <button class="ench-btn" id="enchAction" ${canTrade ? '' : 'disabled'}>TRADE FOR CARD</button>` : ''}
        <div class="ench-result ${enchResult ? (enchResult.ok ? 'ok' : 'bad') : ''}">${enchResult ? escapeHtml(enchResult.text) : ''}</div>`;
      const btn = document.getElementById('enchAction');
      if (btn) btn.addEventListener('click', () => socket.emit('sp_card_exchange', { cardId: card.id }));
      return;
    }

    const entries = enchEntries();
    if (!entries.some(e => e.key === enchSelected)) enchSelected = entries[0] ? entries[0].key : null;
    if (!entries.length) {
      listEl.innerHTML = `<div class="ench-empty">${enchTab === 'gear' ? 'No equipment to enhance.' : 'No SP cards yet. Find them on dungeon bosses or trade fragments in Card Exchange.'}</div>`;
      detailEl.innerHTML = '';
      return;
    }
    entries.forEach(e => {
      const row = document.createElement('div');
      row.className = `ench-row rarity-${e.item.rarity || 'common'} ${e.key === enchSelected ? 'selected' : ''}`;
      row.innerHTML = `${PixelIcons.itemHtml(e.item)}<span class="ench-row-name">${escapeHtml(e.item.name)}<small>${e.equipped ? 'Equipped' : 'In bag'}</small></span><span class="ench-row-lvl">+${e.item.upgradeLevel || 0}</span>`;
      GameTooltip.item(row, e.item);
      row.addEventListener('click', () => { enchSelected = e.key; enchResult = null; renderEnchanter(); });
      listEl.appendChild(row);
    });

    const sel = entries.find(e => e.key === enchSelected);
    const item = sel.item;
    const resultHtml = `<div class="ench-result ${enchResult ? (enchResult.ok ? 'ok' : 'bad') : ''}">${enchResult ? escapeHtml(enchResult.text) : ''}</div>`;
    if (enchTab === 'gear') {
      const info = gearEnhanceInfo(item);
      const maxed = info.lvl >= info.max;
      const short = localPlayer.gold < info.cost;
      detailEl.innerHTML = `
        <div class="ench-detail-head">${PixelIcons.itemHtml(item)}<div><div class="ench-detail-name" style="color:${({ rare: '#38bdf8', epic: '#c084fc', legendary: '#f59e0b' })[item.rarity] || '#e2e8f0'}">${escapeHtml(item.name)}</div><div class="tip-type">${(item.rarity || 'common').toUpperCase()} ${(item.slot || '').toUpperCase()}</div></div></div>
        <div class="ench-levels">+${info.lvl} ${maxed ? '<span class="arrow">MAX</span>' : `<span class="arrow">&gt;</span> <span class="next">+${info.lvl + 1}</span>`}</div>
        ${maxed ? '' : chanceBar(info.chance)}
        ${maxed ? '' : `<div class="ench-cost"><span class="${short ? 'short' : ''}">${info.cost.toLocaleString()} Gold</span></div>`}
        <div class="ench-warn">Each level adds ~5% of the item's base stats plus a slot bonus.${info.lvl >= info.safe ? ` Failing at +${info.safe} or higher drops the item one level.` : ` Safe until +${info.safe}: failures only cost gold.`}</div>
        <button class="ench-btn" id="enchAction" ${maxed || short ? 'disabled' : ''}>ENHANCE</button>
        ${resultHtml}`;
      const btn = document.getElementById('enchAction');
      if (btn) btn.addEventListener('click', () => socket.emit('enhance_item', { target: sel.target, slot: sel.slot, itemIndex: sel.itemIndex }));
    } else {
      const info = cardEnhanceInfo(item);
      const card = info.card;
      const maxed = info.lvl >= info.max;
      const shortGold = localPlayer.gold < info.gold, shortFrag = fragmentCount() < info.fragments;
      detailEl.innerHTML = `
        <div class="ench-detail-head">${PixelIcons.html('card')}<div><div class="ench-detail-name" style="color:${card.color}">${escapeHtml(card.name)}</div><div class="tip-type">Tier ${card.tier} - ${ELEMENT_NAMES[card.element]} - Job ${card.jobReq}</div></div></div>
        <div class="ench-levels">+${info.lvl} ${maxed ? '<span class="arrow">MAX</span>' : `<span class="arrow">&gt;</span> <span class="next">+${info.lvl + 1}</span>`}</div>
        <div>${cardStatLines(card, maxed ? info.lvl : info.lvl + 1)}</div>
        ${maxed ? '' : chanceBar(info.chance)}
        ${maxed ? '' : `<div class="ench-cost"><span class="${shortGold ? 'short' : ''}">${info.gold.toLocaleString()} Gold</span><span class="${shortFrag ? 'short' : ''}">${info.fragments} Spirit Fragments</span></div>`}
        <div class="ench-warn">+0.8% card stats and +0.4% card skill power per level; the aura grows at +40, +70 and +100.${info.lvl >= info.safe ? ` Failing at +${info.safe} or higher drops the card one level.` : ''}</div>
        <button class="ench-btn" id="enchAction" ${maxed || shortGold || shortFrag ? 'disabled' : ''}>EMPOWER CARD</button>
        ${resultHtml}`;
      const btn = document.getElementById('enchAction');
      if (btn) btn.addEventListener('click', () => socket.emit('sp_card_enhance', { target: sel.target, itemIndex: sel.itemIndex }));
    }
  }

  document.querySelectorAll('#enchTabs .ench-tab').forEach(tab => {
    tab.addEventListener('click', () => { enchTab = tab.dataset.tab; enchSelected = null; enchResult = null; renderEnchanter(); });
  });
  const btnCloseEnchanter = document.getElementById('btnCloseEnchanter');
  if (btnCloseEnchanter) btnCloseEnchanter.addEventListener('click', () => { enchanterModal.style.display = 'none'; });
  if (enchanterModal) enchanterModal.addEventListener('click', (e) => { if (e.target === enchanterModal) enchanterModal.style.display = 'none'; });

  const showEnchResult = (data, okText) => {
    enchResult = data.ok
      ? { ok: data.success, text: data.success ? okText(data) : data.downgraded ? `Failed... dropped to +${data.level}` : 'Failed! The runes fizzle out.' }
      : { ok: false, text: data.message };
    if (data.ok) (data.success ? window.soundEngine.playLevelUp() : window.soundEngine.playUpgradeFail());
    renderEnchanter();
  };
  socket.on('enhance_result', (data) => showEnchResult(data, d => `Success! Now +${d.level}`));
  socket.on('sp_enhance_result', (data) => showEnchResult(data, d => `Card empowered to +${d.level}!`));
  socket.on('sp_exchange_result', (data) => {
    enchResult = data.ok ? { ok: true, text: 'Card obtained! Check your bag.' } : { ok: false, text: data.message };
    if (data.ok) window.soundEngine.playLevelUp();
    renderEnchanter();
  });

  // Hook Quick Potions inside inventory modal
  const modalHp = document.getElementById('invHpSlot');
  const modalMp = document.getElementById('invMpSlot');
  if (modalHp) modalHp.addEventListener('click', () => drinkPotion('health'));
  if (modalMp) modalMp.addEventListener('click', () => drinkPotion('mana'));
  [['invHpSwitch', 'health'], ['invMpSwitch', 'mana']].forEach(([id, kind]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchPotionSlot(kind);
    });
  });

  // Shop Tabs
  tabShopBuy.addEventListener('click', () => {
    tabShopBuy.classList.add('active');
    tabShopSell.classList.remove('active');
    shopBuyList.style.display = 'flex';
    shopSellList.style.display = 'none';
    renderShopBuyList();
  });

  tabShopSell.addEventListener('click', () => {
    tabShopSell.classList.add('active');
    tabShopBuy.classList.remove('active');
    shopBuyList.style.display = 'none';
    shopSellList.style.display = 'flex';
    renderShopSellList();
  });

  btnOpenShop.addEventListener('click', openShopModal);
  btnCloseShop.addEventListener('click', () => shopModal.style.display = 'none');

  // ================= HYPIXEL SKYBLOCK REFORGE ANVIL UI =================
  const SKYBLOCK_REFORGE_COSTS = {
    common: 50,
    rare: 150,
    epic: 350,
    legendary: 750
  };

  function openReforgeModal() {
    renderReforgeItemsList();
    updateReforgeBench();
    reforgeModal.style.display = 'flex';
  }

  function renderReforgeItemsList() {
    if (!reforgeItemsList || !localPlayer) return;
    reforgeItemsList.innerHTML = '';

    let itemsToDisplay = [];
    if (reforgeTab === 'equipped') {
      const eq = localPlayer.equipment || {};
      for (const [slot, item] of Object.entries(eq)) {
        if (item) {
          itemsToDisplay.push({ target: 'equipped', slot, item });
        }
      }
    } else {
      const invItems = (localPlayer.inventory && localPlayer.inventory.items) || [];
      invItems.forEach((item, index) => {
        if (item.type === 'equipment') {
          itemsToDisplay.push({ target: 'inventory', itemIndex: index, item });
        }
      });
    }

    if (itemsToDisplay.length === 0) {
      reforgeItemsList.innerHTML = `<div style="color:var(--text-muted); font-size:12px; text-align:center; padding:30px 10px;">No equipment in this tab.</div>`;
      if (selectedReforgeTarget && selectedReforgeTarget.target === reforgeTab) {
        selectedReforgeTarget = null;
        updateReforgeBench();
      }
      return;
    }

    itemsToDisplay.forEach(entry => {
      const { item } = entry;
      const isSelected = selectedReforgeTarget &&
        ((entry.target === 'equipped' && selectedReforgeTarget.slot === entry.slot) ||
         (entry.target === 'inventory' && selectedReforgeTarget.itemIndex === entry.itemIndex));

      const refName = item.reforge || item.reforgeName;
      const displayName = item.baseName ? (refName ? `${refName} ${item.baseName}` : item.baseName) : item.name;
      const reforgeBadge = refName ? `[${refName}]` : 'Vanilla';

      const row = document.createElement('div');
      row.className = `reforge-list-item ${isSelected ? 'selected' : ''} rarity-${item.rarity || 'common'}`;
      row.innerHTML = `
        <div class="rf-item-left">
          <div class="rf-item-icon">${PixelIcons.itemHtml(item)}</div>
          <div class="rf-item-name">${displayName}</div>
        </div>
        <span class="rf-item-lvl" style="color: ${refName ? '#38bdf8' : 'var(--text-muted)'}; font-size: 11px;">${reforgeBadge}</span>
      `;

      row.addEventListener('click', () => {
        selectedReforgeTarget = entry;
        renderReforgeItemsList();
        updateReforgeBench();
        window.soundEngine.playTargetLock();
      });

      reforgeItemsList.appendChild(row);
    });

    if (selectedReforgeTarget) {
      if (selectedReforgeTarget.target === 'equipped' && localPlayer.equipment) {
        selectedReforgeTarget.item = localPlayer.equipment[selectedReforgeTarget.slot];
      } else if (selectedReforgeTarget.target === 'inventory' && localPlayer.inventory && localPlayer.inventory.items) {
        selectedReforgeTarget.item = localPlayer.inventory.items[selectedReforgeTarget.itemIndex];
      }
      updateReforgeBench();
    }
  }

  function updateReforgeBench() {
    if (!selectedReforgeTarget || !selectedReforgeTarget.item) {
      if (reforgeEmptyPrompt) reforgeEmptyPrompt.style.display = 'block';
      if (reforgeActiveView) reforgeActiveView.style.display = 'none';
      return;
    }

    const item = selectedReforgeTarget.item;
    if (reforgeEmptyPrompt) reforgeEmptyPrompt.style.display = 'none';
    if (reforgeActiveView) reforgeActiveView.style.display = 'flex';

    const rfResultIcon = document.getElementById('rfResultIcon');
    const rfReforgeTag = document.getElementById('rfReforgeTag');
    const rfRarityFooter = document.getElementById('rfRarityFooter');
    const sbLoreCard = document.getElementById('sbLoreCard');

    if (rfItemIcon) rfItemIcon.dataset.pxi = PixelIcons.item(item);
    if (rfResultIcon) rfResultIcon.dataset.pxi = PixelIcons.item(item);

    const refName = item.reforge || item.reforgeName;
    const displayName = item.baseName ? (refName ? `${refName} ${item.baseName}` : item.baseName) : item.name;
    const rarity = item.rarity || 'common';

    if (rfItemName) {
      rfItemName.textContent = displayName;
      const rarityColors = { common: '#fff', rare: '#38bdf8', epic: '#c084fc', legendary: '#f59e0b' };
      rfItemName.style.color = rarityColors[rarity] || '#facc15';
    }

    if (sbLoreCard) {
      const rarityBorders = { common: '#4b5563', rare: '#0284c7', epic: '#7c3aed', legendary: '#d97706' };
      sbLoreCard.style.borderColor = rarityBorders[rarity] || '#7c3aed';
    }

    if (rfReforgeTag) {
      if (refName) {
        rfReforgeTag.textContent = `Reforged with [${refName}]`;
        rfReforgeTag.style.color = '#38bdf8';
      } else {
        rfReforgeTag.textContent = 'Unforged Item (Ready for Skyblock Reforge)';
        rfReforgeTag.style.color = 'var(--text-muted)';
      }
    }

    const slotName = (item.slot || 'gear').toUpperCase();
    if (rfRarityFooter) {
      rfRarityFooter.textContent = `${rarity.toUpperCase()} ${slotName}`;
      rfRarityFooter.className = `sb-lore-rarity-footer rarity-${rarity}`;
    }

    const cost = SKYBLOCK_REFORGE_COSTS[rarity] || 150;
    if (rfCostVal) rfCostVal.textContent = cost;

    // Hypixel Skyblock Lore Card Stats Lines Rendering
    const rf = item.reforgeStats || {};
    let statLines = [];

    if (item.slot === 'weapon') {
      const baseDmg = item.baseBonusDmg !== undefined ? item.baseBonusDmg : (item.bonusDmg || 10);
      statLines.push(`
        <div class="sb-stat-line" style="color: #ef4444;">
          <span>Damage:</span>
          <div>
            <strong>+${baseDmg}</strong>
            ${rf.bonusDmg ? `<span class="sb-reforge-bonus" style="color: #38bdf8; margin-left: 6px;">(+${rf.bonusDmg})</span>` : ''}
          </div>
        </div>
      `);

      if (rf.strength) {
        statLines.push(`
          <div class="sb-stat-line" style="color: #f87171;">
            <span>Strength:</span>
            <div>
              <strong>+${rf.strength}</strong>
              <span class="sb-reforge-bonus" style="color: #38bdf8; margin-left: 6px;">(+${rf.strength})</span>
            </div>
          </div>
        `);
      }

      if (rf.critChance) {
        statLines.push(`
          <div class="sb-stat-line" style="color: #60a5fa;">
            <span>Critical Chance:</span>
            <div>
              <strong>+${rf.critChance}%</strong>
              <span class="sb-reforge-bonus" style="color: #38bdf8; margin-left: 6px;">(+${rf.critChance}%)</span>
            </div>
          </div>
        `);
      }

      if (rf.critDmg) {
        statLines.push(`
          <div class="sb-stat-line" style="color: #60a5fa;">
            <span>Critical Damage:</span>
            <div>
              <strong>+${rf.critDmg}%</strong>
              <span class="sb-reforge-bonus" style="color: #38bdf8; margin-left: 6px;">(+${rf.critDmg}%)</span>
            </div>
          </div>
        `);
      }

      if (rf.bonusAttackSpeed) {
        statLines.push(`
          <div class="sb-stat-line" style="color: #facc15;">
            <span>Bonus Attack Speed:</span>
            <div>
              <strong>+${Math.round(rf.bonusAttackSpeed * 100)}%</strong>
              <span class="sb-reforge-bonus" style="color: #38bdf8; margin-left: 6px;">(+${Math.round(rf.bonusAttackSpeed * 100)}%)</span>
            </div>
          </div>
        `);
      }
    } else {
      // Armor, Helmet, Boots, Ring
      if (item.baseBonusDef !== undefined || item.bonusDef || rf.bonusDef) {
        const baseDef = item.baseBonusDef !== undefined ? item.baseBonusDef : (item.bonusDef || 0);
        statLines.push(`
          <div class="sb-stat-line" style="color: #4ade80;">
            <span>Defense:</span>
            <div>
              <strong>+${baseDef}</strong>
              ${rf.bonusDef ? `<span class="sb-reforge-bonus" style="color: #38bdf8; margin-left: 6px;">(+${rf.bonusDef})</span>` : ''}
            </div>
          </div>
        `);
      }

      if (item.baseBonusHp !== undefined || item.bonusHp || rf.bonusHp) {
        const baseHp = item.baseBonusHp !== undefined ? item.baseBonusHp : (item.bonusHp || 0);
        statLines.push(`
          <div class="sb-stat-line" style="color: #ef4444;">
            <span>Health:</span>
            <div>
              <strong>+${baseHp} HP</strong>
              ${rf.bonusHp ? `<span class="sb-reforge-bonus" style="color: #38bdf8; margin-left: 6px;">(+${rf.bonusHp})</span>` : ''}
            </div>
          </div>
        `);
      }

      if (item.baseBonusMp !== undefined || item.bonusMp || rf.bonusMp) {
        const baseMp = item.baseBonusMp !== undefined ? item.baseBonusMp : (item.bonusMp || 0);
        statLines.push(`
          <div class="sb-stat-line" style="color: #00ffff;">
            <span>Intelligence (Mana):</span>
            <div>
              <strong>+${baseMp}</strong>
              ${rf.bonusMp ? `<span class="sb-reforge-bonus" style="color: #38bdf8; margin-left: 6px;">(+${rf.bonusMp})</span>` : ''}
            </div>
          </div>
        `);
      }

      if (item.baseBonusSpeed !== undefined || item.bonusSpeed || rf.bonusSpeed) {
        const baseSpd = item.baseBonusSpeed !== undefined ? item.baseBonusSpeed : (item.bonusSpeed || 0);
        statLines.push(`
          <div class="sb-stat-line" style="color: #ffffff;">
            <span>Speed:</span>
            <div>
              <strong>+${baseSpd.toFixed(1)}</strong>
              ${rf.bonusSpeed ? `<span class="sb-reforge-bonus" style="color: #38bdf8; margin-left: 6px;">(+${rf.bonusSpeed.toFixed(1)})</span>` : ''}
            </div>
          </div>
        `);
      }

      if (rf.critChance) {
        statLines.push(`
          <div class="sb-stat-line" style="color: #60a5fa;">
            <span>Critical Chance:</span>
            <div>
              <strong>+${rf.critChance}%</strong>
              <span class="sb-reforge-bonus" style="color: #38bdf8; margin-left: 6px;">(+${rf.critChance}%)</span>
            </div>
          </div>
        `);
      }

      if (rf.critDmg) {
        statLines.push(`
          <div class="sb-stat-line" style="color: #60a5fa;">
            <span>Critical Damage:</span>
            <div>
              <strong>+${rf.critDmg}%</strong>
              <span class="sb-reforge-bonus" style="color: #38bdf8; margin-left: 6px;">(+${rf.critDmg}%)</span>
            </div>
          </div>
        `);
      }
    }

    if (item.reforgeBonusDesc) {
      statLines.push(`
        <div class="sb-reforge-ability" style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.15); color: #facc15; font-size: 11px;">
          <strong>Reforge Ability:</strong> ${item.reforgeBonusDesc}
        </div>
      `);
    } else {
      statLines.push(`
        <div class="sb-reforge-ability" style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.15); color: #94a3b8; font-size: 11px; font-style: italic;">
          ⚡ Anvil Reforging applies permanent Skyblock stat modifiers.
        </div>
      `);
    }

    if (rfStatPreview) rfStatPreview.innerHTML = statLines.join('');

    if (btnHammerItem) {
      const hasEnoughGold = (localPlayer && localPlayer.gold !== undefined) ? localPlayer.gold >= cost : true;
      btnHammerItem.disabled = !hasEnoughGold;
      btnHammerItem.innerHTML = hasEnoughGold
        ? `🔨 REFORGE ITEM (${cost} Gold)`
        : `⚠️ NOT ENOUGH GOLD (${cost} Gold Required)`;
    }
  }

  // Reforge Tabs & Buttons
  if (tabReforgeEquipped) {
    tabReforgeEquipped.addEventListener('click', () => {
      reforgeTab = 'equipped';
      tabReforgeEquipped.classList.add('active');
      tabReforgeBag.classList.remove('active');
      renderReforgeItemsList();
    });
  }

  if (tabReforgeBag) {
    tabReforgeBag.addEventListener('click', () => {
      reforgeTab = 'bag';
      tabReforgeBag.classList.add('active');
      tabReforgeEquipped.classList.remove('active');
      renderReforgeItemsList();
    });
  }

  if (btnOpenReforge) btnOpenReforge.addEventListener('click', openReforgeModal);
  if (btnCloseReforge) btnCloseReforge.addEventListener('click', () => reforgeModal.style.display = 'none');

  if (btnHammerItem) {
    btnHammerItem.addEventListener('click', () => {
      if (!selectedReforgeTarget || !selectedReforgeTarget.item) return;

      socket.emit('reforge_item', {
        target: selectedReforgeTarget.target,
        slot: selectedReforgeTarget.slot,
        itemIndex: selectedReforgeTarget.itemIndex
      });

      // Quick hammer clank feedback
      window.soundEngine.playAnvil();
    });
  }

  // Action Slots
  if (slotTarget) slotTarget.addEventListener('click', () => cycleNextTarget());
  if (slotAttack) slotAttack.addEventListener('click', () => useBasicAttack());
  if (slotSkill1) slotSkill1.addEventListener('click', () => useSkill('slot1'));
  if (slotSkill2) slotSkill2.addEventListener('click', () => useSkill('slot2'));
  if (slotSkill3) slotSkill3.addEventListener('click', () => useSkill('slot3'));
  if (slotDash) slotDash.addEventListener('click', () => useSkill('dash'));
  if (slotHealthPotion) {
    slotHealthPotion.addEventListener('click', (e) => {
      if (e.shiftKey) drinkPotion('health');
      else switchPotionSlot('health');
    });
    slotHealthPotion.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      switchPotionSlot('health');
    });
  }
  if (slotManaPotion) {
    slotManaPotion.addEventListener('click', (e) => {
      if (e.shiftKey) drinkPotion('mana');
      else switchPotionSlot('mana');
    });
    slotManaPotion.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      switchPotionSlot('mana');
    });
  }

  const btnSwapHp = document.getElementById('btnSwapHp');
  if (btnSwapHp) {
    btnSwapHp.addEventListener('click', (e) => {
      e.stopPropagation();
      switchPotionSlot('health');
    });
  }
  const btnSwapMp = document.getElementById('btnSwapMp');
  if (btnSwapMp) {
    btnSwapMp.addEventListener('click', (e) => {
      e.stopPropagation();
      switchPotionSlot('mana');
    });
  }

  // ================= CLASS SKILL TREE & LOADOUT CUSTOMIZER UI =================
  function openSkillTreeModal() {
    if (activeSkillsModalTab === 'loadout') {
      if (tabContentLoadout) tabContentLoadout.style.display = 'block';
      if (tabContentTalents) tabContentTalents.style.display = 'none';
      if (tabNavLoadout) tabNavLoadout.classList.add('active');
      if (tabNavTalents) tabNavTalents.classList.remove('active');
      if (spBannerWrapper) spBannerWrapper.style.display = 'none';
      renderCustomSkillLoadout();
    } else {
      if (tabContentLoadout) tabContentLoadout.style.display = 'none';
      if (tabContentTalents) tabContentTalents.style.display = 'block';
      if (tabNavLoadout) tabNavLoadout.classList.remove('active');
      if (tabNavTalents) tabNavTalents.classList.add('active');
      if (spBannerWrapper) spBannerWrapper.style.display = 'flex';
      renderSkillTree();
    }
    if (skillTreeModal) {
      skillTreeModal.style.display = 'flex';
      window.soundEngine.playLevelUp();
    }
  }

  function closeSkillTreeModal() {
    if (skillTreeModal) {
      skillTreeModal.style.display = 'none';
    }
  }

  function toggleSkillTreeModal() {
    if (!skillTreeModal) return;
    if (skillTreeModal.style.display === 'flex') {
      closeSkillTreeModal();
    } else {
      openSkillTreeModal();
    }
  }

  if (tabNavLoadout) {
    tabNavLoadout.addEventListener('click', () => {
      activeSkillsModalTab = 'loadout';
      tabNavLoadout.classList.add('active');
      if (tabNavTalents) tabNavTalents.classList.remove('active');
      if (tabContentLoadout) tabContentLoadout.style.display = 'block';
      if (tabContentTalents) tabContentTalents.style.display = 'none';
      if (spBannerWrapper) spBannerWrapper.style.display = 'none';
      renderCustomSkillLoadout();
      window.soundEngine.playSkillWhoosh();
    });
  }

  if (tabNavTalents) {
    tabNavTalents.addEventListener('click', () => {
      activeSkillsModalTab = 'talents';
      tabNavTalents.classList.add('active');
      if (tabNavLoadout) tabNavLoadout.classList.remove('active');
      if (tabContentLoadout) tabContentLoadout.style.display = 'none';
      if (tabContentTalents) tabContentTalents.style.display = 'block';
      if (spBannerWrapper) spBannerWrapper.style.display = 'flex';
      renderSkillTree();
      window.soundEngine.playSkillWhoosh();
    });
  }

  // The SP card the hero is transformed with, or null
  function transformedCard() {
    if (!localPlayer || !localPlayer.spTransformed) return null;
    const cardItem = localPlayer.equipment && localPlayer.equipment.sp;
    return cardItem ? spCardDef(cardItem.cardId) : null;
  }

  const SLOT_KEYS = { slot1: 'Q', slot2: 'E', slot3: 'R', dash: 'Shift' };

  function renderCustomSkillLoadout() {
    if (!localPlayer || !loadoutSlotsRow || !skillsCatalogGrid) return;

    const cls = localPlayer.characterClass || 'warrior';
    // Transformed: the spellbook lists the card's own arsenal instead of the class skills
    const spCard = transformedCard();
    const classSkills = spCard
      ? (spCard.arsenal || []).map(findSkillDef).filter(Boolean)
      : ((allSkillsCatalog && allSkillsCatalog[cls]) || []);
    const equipped = localPlayer.equippedSkills || {};
    if (!equipped.runes) {
      equipped.runes = { slot1: 'none', slot2: 'none', slot3: 'none', dash: 'none' };
    }

    if (stClassName) {
      stClassName.textContent = spCard ? `${spCard.name.toUpperCase()} SP SPELLBOOK` : `${cls.toUpperCase()} SPELLBOOK & LOADOUT`;
    }

    const getSlotSkillId = (slotKey) => {
      const val = equipped[slotKey];
      if (typeof val === 'object' && val !== null) return val.skillId;
      return val || (slotKey === 'dash' ? (classSkills.find(s => s.isDash)?.id || 'blade_charge') : (classSkills[0]?.id || 'whirlwind'));
    };

    const getSlotRuneId = (slotKey) => {
      if (equipped.runes && equipped.runes[slotKey]) return equipped.runes[slotKey];
      const val = equipped[slotKey];
      if (typeof val === 'object' && val !== null && val.rune) return val.rune;
      return 'none';
    };

    // 1. Render the 4 Hotbar Slot Cards as Interactive Drop Targets
    loadoutSlotsRow.innerHTML = '';
    const slotsConfig = [
      { key: 'slot1', label: 'Primary Skill', keybind: 'Q' },
      { key: 'slot2', label: 'Secondary Skill', keybind: 'E' },
      { key: 'slot3', label: 'Ultimate / Heavy', keybind: 'R' },
      { key: 'dash',  label: 'Mobility Dash', keybind: 'Shift' }
    ];

    slotsConfig.forEach(sConf => {
      const isSelected = selectedLoadoutSlot === sConf.key;
      const skillId = getSlotSkillId(sConf.key);
      const runeId = getSlotRuneId(sConf.key);
      const skill = findSkillDef(skillId);
      const rune = (skillRunesCatalog && skillRunesCatalog[runeId]) || { name: 'Standard', icon: '⚪', color: '#94a3b8' };

      const card = document.createElement('div');
      card.className = `hotbar-slot-card ${isSelected ? 'selected active-slot' : ''}`;
      card.setAttribute('data-slot-key', sConf.key);
      card.setAttribute('title', `${sConf.keybind}: ${skill ? skill.name : 'Empty Slot'} - ${sConf.label} | Rune: ${rune.name}`);
card.innerHTML = `
        <div class="slot-card-badge">${sConf.keybind}</div>
        <div class="slot-card-icon">${SkillIcons.svg(skill ? skill.id : 'empty')}</div>
        <div class="slot-drop-callout">⬇️ Drop Skill Here</div>
      `;

      // Click to select slot
      card.addEventListener('click', () => {
        selectedLoadoutSlot = sConf.key;
        renderCustomSkillLoadout();
        window.soundEngine.playTargetLock();
      });

      // HTML5 Drag and Drop Target Listeners
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
      });

      card.addEventListener('dragleave', (e) => {
        if (!card.contains(e.relatedTarget)) {
          card.classList.remove('drag-over');
        }
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        document.querySelectorAll('.hotbar-slot-card').forEach(sc => {
          sc.classList.remove('drop-target-active');
          sc.classList.remove('drag-over');
        });

        const droppedSkillId = e.dataTransfer.getData('text/plain');
        if (!droppedSkillId) return;
        const dropped = findSkillDef(droppedSkillId);
        if (spCard && dropped && !!dropped.isDash !== (sConf.key === 'dash')) {
          if (renderer) renderer.addFloatingText(localPlayer.x, localPlayer.y - 0.7, dropped.isDash ? 'Movement skills go in [Shift]' : 'Only movement skills fit [Shift]', '#ef4444', 15);
          return;
        }

        if (!localPlayer.equippedSkills) localPlayer.equippedSkills = {};
        localPlayer.equippedSkills[sConf.key] = droppedSkillId;
        socket.emit('customize_skill_slot', {
          slot: sConf.key,
          skillId: droppedSkillId
        });
        window.soundEngine.playBladeCharge();
        selectedLoadoutSlot = sConf.key;
        renderCustomSkillLoadout();
        setupClassSkillHUD(localPlayer.characterClass);
      });

      loadoutSlotsRow.appendChild(card);
    });

    // 2. Render Rune Selector for the currently selected slot
    if (runesSelectorRow) {
      runesSelectorRow.innerHTML = '';
      const curRune = getSlotRuneId(selectedLoadoutSlot);

      const runesList = Object.entries(skillRunesCatalog).length > 0 
        ? Object.entries(skillRunesCatalog) 
        : [
            ['none', { name: 'Standard Rune', icon: '⚪', desc: 'Default ability power without elemental modifiers.', color: '#94a3b8' }],
            ['flame', { name: 'Infernal Flame', icon: '🔴', desc: '+25% Damage and ignites enemies with persistent Burn DoT.', color: '#ef4444' }],
            ['frost', { name: 'Glacial Frost', icon: '🔵', desc: 'Adds 40% Chill Slow for 3.5s and 25% chance to Freeze solid.', color: '#38bdf8' }],
            ['tempest', { name: 'Tempest Surge', icon: '⚡', desc: '-20% Cooldown reduction and +10% Electric Shock DMG.', color: '#eab308' }],
            ['vampiric', { name: 'Vampiric Drain', icon: '🟣', desc: 'Restores 25% of all skill damage dealt as immediate HP life leech.', color: '#a855f7' }]
          ];

      runesList.forEach(([rKey, rDef]) => {
        const isRuneActive = curRune === rKey;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `rune-pill-btn ${isRuneActive ? 'active' : ''}`;
        if (isRuneActive) {
          btn.style.borderColor = rDef.color || '#facc15';
          btn.style.setProperty('--line', rDef.color || '#ffcd75');
        }
        btn.innerHTML = `<span class="rune-icon">${PixelIcons.html(({ none: 'dot', flame: 'fire', frost: 'snow', tempest: 'bolt', vampiric: 'heart' })[rKey] || 'dot')}</span> <span>${rDef.name}</span>`;
        btn.title = `${rDef.name}: ${rDef.desc}`;

        btn.addEventListener('click', () => {
          if (!localPlayer.equippedSkills) localPlayer.equippedSkills = {};
          if (!localPlayer.equippedSkills.runes) {
            localPlayer.equippedSkills.runes = { slot1: 'none', slot2: 'none', slot3: 'none', dash: 'none' };
          }
          localPlayer.equippedSkills.runes[selectedLoadoutSlot] = rKey;
          socket.emit('customize_skill_slot', {
            slot: selectedLoadoutSlot,
            rune: rKey
          });
          window.soundEngine.playUpgradeSuccess();
          renderCustomSkillLoadout();
          setupClassSkillHUD(localPlayer.characterClass);
        });

        runesSelectorRow.appendChild(btn);
      });
    }

    // 3. Render Skills Catalog with Drag-and-Drop Cards
    skillsCatalogGrid.innerHTML = '';

    // Add Drag & Drop Instruction Ribbon
    const guideRibbon = document.createElement('div');
    guideRibbon.className = 'loadout-drag-guide-ribbon';
    guideRibbon.style.gridColumn = '1 / -1';
    guideRibbon.innerHTML = `
      <span style="font-size: 16px;">🖐️</span>
      <span><strong>Drag & Drop:</strong> Drag any unlocked skill card below directly into <strong>[Q], [E], [R], or [Shift]</strong> slots above to equip!</span>
    `;
    if (spCard) {
      guideRibbon.innerHTML = `<span><strong>${escapeHtml(spCard.name)} skills:</strong> drag a card skill into <strong>[Q], [E], [R]</strong>; movement skills (MOVE) go in <strong>[Shift]</strong>. Revert to edit your class skills.</span>`;
    }
    skillsCatalogGrid.appendChild(guideRibbon);

    const sortedSkills = [...classSkills].sort((a, b) => (a.reqLevel || 1) - (b.reqLevel || 1));

    sortedSkills.forEach(s => {
      let equippedInSlot = null;
      for (const sKey of ['slot1', 'slot2', 'slot3', 'dash']) {
        if (getSlotSkillId(sKey) === s.id) {
          equippedInSlot = sKey;
          break;
        }
      }

      const isEquippedHere = equippedInSlot === selectedLoadoutSlot;
      const isEquippedElsewhere = equippedInSlot && !isEquippedHere;
      const slotBindName = equippedInSlot === 'slot1' ? '[Q]' : equippedInSlot === 'slot2' ? '[E]' : equippedInSlot === 'slot3' ? '[R]' : equippedInSlot === 'dash' ? '[Shift]' : '';
      const reqLvl = s.reqLevel || 1;
      const isLocked = (localPlayer.level || 1) < reqLvl;

      const card = document.createElement('div');
      card.className = `catalog-skill-card ${isEquippedHere ? 'is-equipped' : ''} ${isLocked ? 'is-locked' : 'draggable-skill'}`;

      if (!isLocked) {
        card.draggable = true;
        card.setAttribute('title', `Drag into [Q], [E], [R], [Shift] slots above, or click to equip into [${selectedLoadoutSlot.toUpperCase()}]`);

        // Drag Events
        card.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', s.id);
          e.dataTransfer.effectAllowed = 'move';
          card.classList.add('is-dragging');
          document.querySelectorAll('.hotbar-slot-card').forEach(sc => {
            sc.classList.add('drop-target-active');
          });
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('is-dragging');
          document.querySelectorAll('.hotbar-slot-card').forEach(sc => {
            sc.classList.remove('drop-target-active');
            sc.classList.remove('drag-over');
          });
        });
      }

      card.setAttribute('title', spCard
        ? `${s.name} - ${s.cooldown}s CD, ${manaCost(s.mpCost)} MP | ${s.desc}`
        : `${s.name} - Lv.${reqLvl} - ${s.cooldown}s CD, ${manaCost(s.mpCost)} MP, ${(s.damageMultiplier*100).toFixed(0)}% DMG | ${s.desc}`);
card.innerHTML = `
        <div class="catalog-icon-only">${SkillIcons.svg(s.id)}</div>
        <div class="catalog-mini-name">${s.name}</div>
        <div class="catalog-mini-level ${isLocked ? 'locked' : 'unlocked'}">${spCard ? (s.isDash ? 'MOVE' : 'SP') : `Lv.${reqLvl}`}</div>
      `;

      const btnEquip = card.querySelector('.btn-equip-skill:not(.locked)');
      if (btnEquip) {
        btnEquip.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!localPlayer.equippedSkills) localPlayer.equippedSkills = {};
          localPlayer.equippedSkills[selectedLoadoutSlot] = s.id;
          socket.emit('customize_skill_slot', {
            slot: selectedLoadoutSlot,
            skillId: s.id
          });
          window.soundEngine.playBladeCharge();
          renderCustomSkillLoadout();
          setupClassSkillHUD(localPlayer.characterClass);
        });
      }

      skillsCatalogGrid.appendChild(card);
    });
  }

  let selectedTalentId = null;

  function renderSkillTree() {
    if (!localPlayer || !skillTreeGrid) return;

    const cls = localPlayer.characterClass || 'warrior';
    const tree = (skillTreesCatalog && skillTreesCatalog[cls]) || [];
    const skills = localPlayer.skills || {};
    const availablePoints = localPlayer.skillPoints || 0;

    if (stClassName) {
      const clsTitle = cls.toUpperCase();
      stClassName.textContent = `${clsTitle} TALENT TREE (${tree.length} TALENTS)`;
    }

    if (stAvailablePoints) {
      stAvailablePoints.textContent = availablePoints;
    }

    let pointsSpent = 0;
    for (const rank of Object.values(skills)) {
      pointsSpent += (rank || 0);
    }

    if (btnResetTalents) {
      const cost = Math.min(500, pointsSpent * 50);
      btnResetTalents.textContent = `🔄 Reset Talents (${cost} Gold)`;
      btnResetTalents.disabled = pointsSpent === 0;
      btnResetTalents.style.opacity = pointsSpent === 0 ? '0.5' : '1';
    }

    // Save scroll state of containers to prevent annoying viewport jumps
    const scrollContainers = [
      document.querySelector('.skills-modal-content'),
      document.querySelector('.skill-tree-content'),
      skillTreeGrid,
      document.getElementById('tabContentTalents')
    ].filter(Boolean);
    const scrollMap = scrollContainers.map(el => ({ el, top: el.scrollTop, left: el.scrollLeft }));

    skillTreeGrid.innerHTML = '';

    // Group talents by specialization branch
    const branchesMap = new Map();
    tree.forEach(talent => {
      const bName = talent.branch || 'Specialization Branch';
      if (!branchesMap.has(bName)) branchesMap.set(bName, []);
      branchesMap.get(bName).push(talent);
    });

    // Specialization lock (mirrors the server rule): once a branch has points,
    // the other branches stay closed until the talents are reset.
    const committedBranches = new Set(
      tree.filter(t => (skills[t.id] || 0) > 0).map(t => t.branch || 'Specialization Branch')
    );

    const getTalentState = (talent) => {
      const curRank = skills[talent.id] || 0;
      const maxRank = talent.maxRank || 3;
      const branchName = talent.branch || 'Specialization Branch';
      const isMaxed = curRank >= maxRank;
      const branchLocked = committedBranches.size > 0 && !committedBranches.has(branchName);
      const prereq = talent.requires ? tree.find(t => t.id === talent.requires) : null;
      const reqMet = !talent.requires || (skills[talent.requires] || 0) > 0;
      const canLearn = availablePoints > 0 && !isMaxed && reqMet && !branchLocked;
      return { curRank, maxRank, isMaxed, branchLocked, prereq, reqMet, canLearn };
    };

    if (!selectedTalentId || !tree.some(t => t.id === selectedTalentId)) {
      selectedTalentId = tree.length ? tree[0].id : null;
    }

    const NODE_ROW_HEIGHT = 92;
    const NODE_TOP_PADDING = 44;

    branchesMap.forEach((branchTalents, branchName) => {
      const branchLocked = committedBranches.size > 0 && !committedBranches.has(branchName);
      const branchActive = committedBranches.has(branchName);

      const col = document.createElement('div');
      col.className = `talent-branch-column ${branchLocked ? 'branch-locked' : ''} ${branchActive ? 'branch-active' : ''}`;

      let branchPoints = 0;
      branchTalents.forEach(t => { branchPoints += (skills[t.id] || 0); });

      const header = document.createElement('div');
      header.className = 'talent-branch-header';
      header.innerHTML = `
        <span class="branch-title">${branchName}</span>
        <span class="branch-points-pill">${branchLocked ? 'LOCKED' : `${branchPoints} pts`}</span>
      `;
      col.appendChild(header);

      // Lay nodes out row-by-row by tier, spreading siblings evenly
      const tiers = [...new Set(branchTalents.map(t => t.tier || 1))].sort((a, b) => a - b);
      const positions = new Map();
      tiers.forEach((tier, rowIndex) => {
        const rowNodes = branchTalents.filter(t => (t.tier || 1) === tier);
        rowNodes.forEach((t, i) => {
          positions.set(t.id, {
            x: ((i + 1) / (rowNodes.length + 1)) * 100,
            y: NODE_TOP_PADDING + rowIndex * NODE_ROW_HEIGHT
          });
        });
      });
      const canvasHeight = NODE_TOP_PADDING * 2 + (tiers.length - 1) * NODE_ROW_HEIGHT;

      const canvas = document.createElement('div');
      canvas.className = 'talent-tree-canvas';
      canvas.style.height = `${canvasHeight}px`;

      // Connection lines (x in % of the column width, y in px)
      let links = '';
      branchTalents.forEach(t => {
        if (!t.requires || !positions.has(t.requires)) return;
        const from = positions.get(t.requires);
        const to = positions.get(t.id);
        const parentLearned = (skills[t.requires] || 0) > 0;
        const childLearned = (skills[t.id] || 0) > 0;
        const state = childLearned ? 'is-learned' : (parentLearned && !branchLocked) ? 'is-open' : 'is-closed';
        links += `<line class="talent-link ${state}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" vector-effect="non-scaling-stroke"/>`;
      });
      canvas.innerHTML = `<svg class="talent-links" viewBox="0 0 100 ${canvasHeight}" preserveAspectRatio="none">${links}</svg>`;

      branchTalents.forEach(talent => {
        const st = getTalentState(talent);
        const pos = positions.get(talent.id);

        const node = document.createElement('button');
        node.type = 'button';
        node.dataset.talentId = talent.id;
        node.className = [
          'talent-node',
          talent.maxRank === 1 ? 'is-keystone' : '',
          st.isMaxed ? 'is-maxed' : st.curRank > 0 ? 'has-rank' : '',
          st.canLearn ? 'can-upgrade' : '',
          (!st.reqMet || st.branchLocked) && st.curRank === 0 ? 'is-locked' : '',
          talent.id === selectedTalentId ? 'is-selected' : ''
        ].join(' ');
        node.style.left = `${pos.x}%`;
        node.style.top = `${pos.y}px`;
        node.title = `${talent.name} (${st.curRank}/${st.maxRank})`;
        node.innerHTML = `${PixelIcons.talentHtml(talent)}<span class="talent-node-rank">${st.curRank}/${st.maxRank}</span>`;
        node.addEventListener('click', (e) => {
          e.preventDefault();
          selectedTalentId = talent.id;
          // In-place node selection to avoid destroying DOM and snapping scroll position
          document.querySelectorAll('.talent-node').forEach(n => {
            n.classList.toggle('is-selected', n.dataset.talentId === talent.id);
          });
          renderTalentDetailPanel();
        });
        canvas.appendChild(node);
      });

      col.appendChild(canvas);
      skillTreeGrid.appendChild(col);
    });

    // Detail panel for the selected node
    function renderTalentDetailPanel() {
      const selected = tree.find(t => t.id === selectedTalentId);
      if (!selected) return;
      const st = getTalentState(selected);
      let statusText = '';
      if (st.isMaxed) statusText = 'Maxed out';
      else if (st.branchLocked) statusText = `Locked: you specialized in ${[...committedBranches].join(', ')}. Reset talents to switch.`;
      else if (!st.reqMet) statusText = `Requires: ${st.prereq ? st.prereq.name : selected.requires}`;
      else if (availablePoints <= 0) statusText = 'No skill points available';
      else statusText = st.prereq ? `Requirement met: ${st.prereq.name}` : `Tier ${selected.tier || 1} starter talent`;

      let panel = skillTreeGrid.querySelector('.talent-detail-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.className = 'talent-detail-panel';
        skillTreeGrid.appendChild(panel);
      }
      panel.innerHTML = `
        <div class="talent-detail-icon">${PixelIcons.talentHtml(selected)}</div>
        <div class="talent-detail-info">
          <div class="talent-detail-title">
            <span class="talent-name">${selected.name}</span>
            <span class="talent-rank-pill ${st.isMaxed ? 'max-rank' : st.curRank > 0 ? 'has-rank' : ''}">Rank ${st.curRank}/${st.maxRank}</span>
            <span class="talent-detail-branch">${selected.branch || ''} - Tier ${selected.tier || 1}</span>
          </div>
          <div class="talent-desc">${selected.desc}</div>
          <div class="talent-req-tag ${st.canLearn || st.isMaxed ? 'met' : 'unmet'}">${statusText}</div>
        </div>
        <button class="btn-learn-talent" ${st.canLearn ? '' : 'disabled'}>
          ${st.isMaxed ? 'MAXED' : st.canLearn ? '+ LEARN (1 SP)' : (st.branchLocked || !st.reqMet) ? 'LOCKED' : 'NEED SP'}
        </button>
      `;

      const btnLearn = panel.querySelector('.btn-learn-talent');
      if (btnLearn && st.canLearn) {
        btnLearn.addEventListener('click', (e) => {
          e.preventDefault();
          localPlayer.skillPoints = Math.max(0, (localPlayer.skillPoints || 1) - 1);
          localPlayer.skills = localPlayer.skills || {};
          localPlayer.skills[selected.id] = (localPlayer.skills[selected.id] || 0) + 1;
          renderSkillTree();
          socket.emit('allocate_skill_point', { skillId: selected.id });
          window.soundEngine.playLevelUp();
        });
      }
    }

    renderTalentDetailPanel();

    // Restore scroll positions so the view never jumps
    scrollMap.forEach(({ el, top, left }) => {
      el.scrollTop = top;
      el.scrollLeft = left;
    });
  }

  if (btnOpenSkillTree) btnOpenSkillTree.addEventListener('click', toggleSkillTreeModal);
  if (btnCloseSkillTree) btnCloseSkillTree.addEventListener('click', closeSkillTreeModal);
  if (btnResetTalents) {
    btnResetTalents.addEventListener('click', () => {
      socket.emit('reset_skill_points');
      window.soundEngine.playCoin();
    });
  }

  // ---------------------------------------------------------------- admin cheat menu
  // Admins only. Every button sends the /command chat would, so the server's
  // admin checks still apply; the catalog just fills the dropdowns.
  const adminModal = document.getElementById('adminModal');
  const adminBody = document.getElementById('adminBody');
  const btnOpenAdmin = document.getElementById('btnOpenAdmin');
  let adminCatalog = null;
  const adminLog = [];
  const adminCmd = (text) => socket.emit('send_chat', text.trim());
  const requestAdminCatalog = () => socket.emit('admin_catalog');

  socket.on('admin_catalog', (cat) => {
    adminCatalog = cat && cat.isAdmin ? cat : null;
    if (btnOpenAdmin) btnOpenAdmin.style.display = adminCatalog ? '' : 'none';
    if (adminModal.style.display === 'flex') renderAdminPanel();
  });

  function pushAdminLog(text) {
    adminLog.unshift(text);
    adminLog.length = Math.min(adminLog.length, 30);
    const box = adminBody.querySelector('.admin-log');
    if (box) box.innerHTML = adminLog.map(t => `<div>${escapeHtml(t)}</div>`).join('');
  }

  function toggleAdminPanel() {
    if (adminModal.style.display === 'flex') {
      adminModal.style.display = 'none';
      return;
    }
    requestAdminCatalog();
    renderAdminPanel();
    adminModal.style.display = 'flex';
  }

  function renderAdminPanel() {
    const log = `<div class="admin-log">${adminLog.map(t => `<div>${escapeHtml(t)}</div>`).join('') || 'Results show up here.'}</div>`;
    if (!adminCatalog) {
      adminBody.innerHTML = `
        <div class="admin-section">
          <h3>ADMIN LOGIN</h3>
          <div class="admin-row"><label>Password</label><input id="admPass" class="input-field" type="password" autocomplete="off">
            <button class="btn-shop-action" data-act="op">Become Admin</button></div>
          <div class="admin-hint">Same as typing /op &lt;password&gt; in chat.</div>
        </div>${log}`;
      return;
    }
    const c = adminCatalog;
    const opt = (v, label, sel) => `<option value="${escapeHtml(v)}"${sel ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    const prevTarget = (adminBody.querySelector('#admTarget') || {}).value || '';
    const players = c.players.map(p => opt(p.name, `${p.name} (Lv.${p.level}, ${p.zone})`, p.name === prevTarget)).join('');
    const itemsBySlot = {};
    for (const it of c.items) (itemsBySlot[it.slot] = itemsBySlot[it.slot] || []).push(it);
    const items = Object.entries(itemsBySlot).map(([slot, list]) =>
      `<optgroup label="${escapeHtml(slot)}">${list.map(it => opt(it.id, `${it.name} [${it.rarity || '-'}]`)).join('')}</optgroup>`).join('');
    const cards = c.cards.map(cd => opt(cd.id, `${cd.name} (${cd.cls}, T${cd.tier})`)).join('');
    const zones = c.zones.map(z => opt(z, z)).join('');
    const mobs = c.mobTypes.map(m => opt(m, m)).join('');
    adminBody.innerHTML = `
      <div class="admin-section">
        <div class="admin-row"><label>Target</label>
          <select id="admTarget" class="input-field">${opt('', '(myself)')}${players}</select>
          <button class="btn-shop-action" data-act="refresh">Refresh</button>
          <button class="btn-shop-action" data-act="who">Who</button></div>
        <div class="admin-hint">Heal, level, gold, EXP, items and player actions apply to the target.</div>
      </div>
      <div class="admin-grid">
        <div class="admin-section">
          <h3>CHARACTER</h3>
          <div class="admin-row">
            <button class="btn-shop-action${c.godMode ? ' on' : ''}" data-act="god">God Mode: ${c.godMode ? 'ON' : 'OFF'}</button>
            <button class="btn-shop-action" data-act="heal">Full Heal</button></div>
          <div class="admin-row"><label>Speed</label><input id="admSpeed" class="input-field" type="number" min="0.5" max="5" step="0.5" value="1"><button class="btn-shop-action" data-act="speed">Set</button></div>
          <div class="admin-row"><label>Level</label><input id="admLevel" class="input-field" type="number" min="1" max="100" value="${localPlayer ? localPlayer.level || 1 : 1}"><button class="btn-shop-action" data-act="level">Set</button></div>
          <div class="admin-row"><label>Job Level</label><input id="admJobLevel" class="input-field" type="number" min="1" max="60" value="10"><button class="btn-shop-action" data-act="joblevel">Set</button></div>
          <div class="admin-row"><label>Gold</label><input id="admGold" class="input-field" type="number" min="1" value="10000"><button class="btn-shop-action" data-act="gold">Add</button></div>
          <div class="admin-row"><label>EXP</label><input id="admExp" class="input-field" type="number" min="1" value="5000"><button class="btn-shop-action" data-act="exp">Add</button></div>
          <div class="admin-row"><label>Job EXP</label><input id="admJobExp" class="input-field" type="number" min="1" value="5000"><button class="btn-shop-action" data-act="jobexp">Add</button></div>
        </div>
        <div class="admin-section">
          <h3>ITEMS</h3>
          <div class="admin-row"><label>Search</label><input id="admItemFilter" class="input-field" type="text" placeholder="name or id"></div>
          <div class="admin-row"><label>Item</label><select id="admItem" class="input-field">${items}</select></div>
          <div class="admin-row"><label>Count</label><input id="admCount" class="input-field" type="number" min="1" max="999" value="1"><button class="btn-shop-action" data-act="give">Give</button></div>
          <div class="admin-row"><label>SP Card</label><select id="admCard" class="input-field">${cards}</select></div>
          <div class="admin-row"><label>Upgrade</label><input id="admCardLv" class="input-field" type="number" min="0" max="10" value="0"><button class="btn-shop-action" data-act="givesp">Give Card</button></div>
          <div class="admin-row"><button class="btn-shop-action danger" data-act="clearinv">Clear Inventory</button></div>
        </div>
        <div class="admin-section">
          <h3>WORLD</h3>
          <div class="admin-row"><label>Warp</label><select id="admZone" class="input-field">${zones}</select><button class="btn-shop-action" data-act="warp">Go</button></div>
          <div class="admin-row"><label>Go to X, Y</label><input id="admX" class="input-field" type="number" value="${localPlayer ? Math.round(localPlayer.x) : 0}"><input id="admY" class="input-field" type="number" value="${localPlayer ? Math.round(localPlayer.y) : 0}"><button class="btn-shop-action" data-act="goto">Go</button></div>
          <div class="admin-row"><label>Spawn</label><select id="admMob" class="input-field">${mobs}</select><input id="admMobCount" class="input-field" type="number" min="1" max="20" value="3"></div>
          <div class="admin-row"><label><input id="admBoss" type="checkbox"> Boss</label><button class="btn-shop-action" data-act="spawn">Spawn Here</button></div>
          <div class="admin-row"><label>Kill radius</label><input id="admRadius" class="input-field" type="number" min="1" max="100" value="15"><button class="btn-shop-action danger" data-act="killall">Kill All</button></div>
        </div>
        <div class="admin-section">
          <h3>PLAYERS &amp; SERVER</h3>
          <div class="admin-row"><button class="btn-shop-action" data-act="tp">Teleport to Target</button><button class="btn-shop-action" data-act="bring">Bring Target</button></div>
          <div class="admin-row"><label>Kick reason</label><input id="admKickReason" class="input-field" type="text" placeholder="optional"><button class="btn-shop-action danger" data-act="kick">Kick</button></div>
          <div class="admin-row"><label>Announce</label><input id="admAnnounce" class="input-field" type="text" maxlength="90"><button class="btn-shop-action" data-act="announce">Send</button></div>
          <div class="admin-row"><label>Account role</label><input id="admRoleUser" class="input-field" type="text" placeholder="username">
            <select id="admRoleKind" class="input-field">${opt('admin', 'admin')}${opt('player', 'player')}</select><button class="btn-shop-action" data-act="role">Set</button></div>
          <div class="admin-row"><button class="btn-shop-action" data-act="saveall">Save All Players</button></div>
        </div>
      </div>${log}`;
  }

  // keep typing in the menu from triggering game hotkeys (Escape still closes it)
  adminBody.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
  adminBody.addEventListener('input', (e) => {
    if (e.target.id !== 'admItemFilter' || !adminCatalog) return;
    const q = e.target.value.trim().toLowerCase();
    const sel = adminBody.querySelector('#admItem');
    let first = null;
    for (const o of sel.querySelectorAll('option')) {
      const show = !q || o.value.includes(q) || o.textContent.toLowerCase().includes(q);
      o.hidden = !show;
      if (show && !first) first = o;
    }
    for (const g of sel.querySelectorAll('optgroup')) g.hidden = ![...g.children].some(o => !o.hidden);
    if (first) sel.value = first.value;
  });
  adminBody.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const v = (id) => String((adminBody.querySelector('#' + id) || {}).value || '').trim();
    const num = (id, d) => { const x = parseFloat(v(id)); return Number.isFinite(x) ? x : d; };
    const who = v('admTarget');
    const needTarget = (fn) => () => (who ? fn() : pushAdminLog('⚠️ Pick a target player first.'));
    const acts = {
      op: () => adminCmd(`/op ${v('admPass')}`),
      refresh: requestAdminCatalog,
      who: () => adminCmd('/who'),
      god: () => { adminCmd('/god'); setTimeout(requestAdminCatalog, 250); },
      heal: () => adminCmd(`/heal ${who}`),
      speed: () => adminCmd(`/speed ${num('admSpeed', 1)}`),
      level: () => adminCmd(`/setlevel ${Math.round(num('admLevel', 1))} ${who}`),
      joblevel: () => adminCmd(`/setjoblevel ${Math.round(num('admJobLevel', 1))} ${who}`),
      gold: () => adminCmd(`/addgold ${Math.round(num('admGold', 0))} ${who}`),
      exp: () => adminCmd(`/addexp ${Math.round(num('admExp', 0))} ${who}`),
      jobexp: () => adminCmd(`/addjobexp ${Math.round(num('admJobExp', 0))} ${who}`),
      give: () => adminCmd(`/give ${v('admItem')} ${Math.max(1, Math.round(num('admCount', 1)))} ${who}`),
      givesp: () => adminCmd(`/givesp ${v('admCard')} ${Math.round(num('admCardLv', 0))} ${who}`),
      clearinv: () => { if (confirm(`Clear the whole inventory of ${who || 'yourself'}?`)) adminCmd(`/clearinv ${who}`); },
      warp: () => adminCmd(`/warp ${v('admZone')}`),
      goto: () => adminCmd(`/goto ${num('admX', 0)} ${num('admY', 0)}`),
      spawn: () => adminCmd(`/spawn ${v('admMob')} ${Math.round(num('admMobCount', 1))}${adminBody.querySelector('#admBoss').checked ? ' boss' : ''}`),
      killall: () => adminCmd(`/killall ${Math.round(num('admRadius', 15))}`),
      tp: needTarget(() => adminCmd(`/tp ${who}`)),
      bring: needTarget(() => adminCmd(`/bring ${who}`)),
      kick: needTarget(() => { if (confirm(`Kick ${who}?`)) adminCmd(`/kick ${who} ${v('admKickReason')}`); }),
      announce: () => { if (v('admAnnounce')) adminCmd(`/announce ${v('admAnnounce')}`); },
      role: () => { if (v('admRoleUser')) adminCmd(`/role ${v('admRoleUser')} ${v('admRoleKind')}`); },
      saveall: () => adminCmd('/saveall')
    };
    if (acts[b.dataset.act]) acts[b.dataset.act]();
  });
  if (btnOpenAdmin) btnOpenAdmin.addEventListener('click', toggleAdminPanel);
  document.getElementById('btnCloseAdmin').addEventListener('click', () => { adminModal.style.display = 'none'; });

  function toggleModal(modal) {
    if (modal.style.display === 'flex') {
      modal.style.display = 'none';
    } else {
      if (modal === statsModal && localPlayer) renderStatsPanel(localPlayer);
      modal.style.display = 'flex';
    }
  }

  document.getElementById('btnOpenStats').addEventListener('click', () => toggleModal(statsModal));
  document.getElementById('btnCloseStats').addEventListener('click', () => statsModal.style.display = 'none');

  document.getElementById('btnOpenInventory').addEventListener('click', () => {
    renderInventoryGrid();
    toggleModal(inventoryModal);
  });
  document.getElementById('btnCloseInventory').addEventListener('click', () => inventoryModal.style.display = 'none');

  document.getElementById('btnOpenHelp').addEventListener('click', () => toggleModal(helpModal));
  document.getElementById('btnCloseHelp').addEventListener('click', () => helpModal.style.display = 'none');

  [statsModal, inventoryModal, helpModal, shopModal, reforgeModal, skillTreeModal].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  });

  // 📱 Mobile Contextual Interaction Logic
  let mobileContextualAction = null;

  // Portals are used on purpose: standing near one shows a button (click or F)
  const PORTAL_USE_RANGE = 2.5;   // matches server/gameServer.js
  const portalPrompt = document.getElementById('portalPrompt');
  const portalPromptText = document.getElementById('portalPromptText');
  function nearbyPortal() {
    if (!localPlayer || localPlayer.isDead || !gameState.map) return null;
    let best = null, bestD = PORTAL_USE_RANGE;
    for (const o of gameState.map.obstacles || []) {
      if (o.type !== 'field_portal' && o.id !== 'portal_dungeon') continue;
      const d = Math.hypot(o.x - localPlayer.x, o.y - localPlayer.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }
  function portalLabel(o) {
    if (o.id === 'portal_dungeon') return 'Enter the Abyssal Dungeon';
    const text = (o.label || o.name || 'Portal').replace(/^.*?→\s*/, '').replace(/^Back to\s*/i, '');
    return `Travel to ${text}`;
  }
  function usePortal() {
    if (nearbyPortal()) socket.emit('use_portal');
  }
  function updatePortalPrompt() {
    if (!portalPrompt) return;
    const o = nearbyPortal();
    if (!o) {
      if (portalPrompt.style.display !== 'none') portalPrompt.style.display = 'none';
      return;
    }
    const label = portalLabel(o);
    if (portalPromptText.textContent !== label) portalPromptText.textContent = label;
    if (portalPrompt.style.display !== 'inline-flex') portalPrompt.style.display = 'inline-flex';
  }
  if (portalPrompt) portalPrompt.addEventListener('click', (e) => { e.stopPropagation(); usePortal(); });

  function updateMobileContextualInteract() {
    if (!mobileBtnInteract || !localPlayer) return;

    let targetInteract = null;

    if (localPlayer.zone === 'town') {
      const townObstacles = (gameState.map && gameState.map.obstacles) || [];
      const merchant = townObstacles.find(o => o.id === 'npc_merchant') || { x: 16.2, y: 19.6 };
      const brom = townObstacles.find(o => o.id === 'npc_blacksmith') || { x: 16.2, y: 23.4 };

      const distOlaf = Math.hypot(merchant.x - localPlayer.x, merchant.y - localPlayer.y);
      const distBrom = Math.hypot(brom.x - localPlayer.x, brom.y - localPlayer.y);
      const valka = townObstacles.find(o => o.id === 'npc_enchanter') || { x: 23.8, y: 23.4 };
      const distValka = Math.hypot(valka.x - localPlayer.x, valka.y - localPlayer.y);
      const distDungeon = Math.hypot(23.5 - localPlayer.x, 16.5 - localPlayer.y);
      const distFrost = Math.hypot(16.5 - localPlayer.x, 16.5 - localPlayer.y);

      if (distOlaf <= 3.5) {
        targetInteract = {
          icon: 'coin',
          label: 'SHOP',
          action: () => openShopModal()
        };
      } else if (distBrom <= 3.5) {
        targetInteract = {
          icon: 'hammer',
          label: 'REFORGE',
          action: () => openReforgeModal()
        };
      } else if (distValka <= 3.5) {
        targetInteract = {
          icon: 'anvil',
          label: 'ENHANCE',
          action: () => openEnchanter()
        };
      } else if (distDungeon <= 3.0) {
        targetInteract = {
          icon: 'whirl',
          label: 'DUNGEON',
          action: () => openDungeonPortalModal()
        };
      } else if (distFrost <= 2.5) {
        targetInteract = {
          icon: 'snow',
          label: 'PEAKS',
          action: () => socket.emit('player_input', { type: 'click_move', x: 16.5, y: 16.5 })
        };
      }
    } else if (localPlayer.zone === 'dungeon') {
      if (gameState.chests) {
        for (const chest of gameState.chests) {
          if (!chest.opened && Math.hypot(chest.x - localPlayer.x, chest.y - localPlayer.y) <= 2.2) {
            targetInteract = {
              icon: 'chest',
              label: 'OPEN',
              action: () => socket.emit('open_chest', { chestId: chest.id })
            };
            break;
          }
        }
      }
    } else {
      const fieldPortal = ((gameState.map && gameState.map.obstacles) || []).find(o =>
        o.type === 'field_portal' && Math.hypot(o.x - localPlayer.x, o.y - localPlayer.y) <= 2.5);
      if (fieldPortal) {
        targetInteract = {
          icon: 'door',
          label: 'ENTER',
          action: () => socket.emit('use_portal')
        };
      }
    }

    // any other portal in reach (e.g. the town's north gate)
    if (!targetInteract) {
      const portal = nearbyPortal();
      if (portal && portal.type === 'field_portal') targetInteract = { icon: 'door', label: 'ENTER', action: () => socket.emit('use_portal') };
    }

    if (!targetInteract && gameState.groundItems && gameState.groundItems.length > 0) {
      let closestItem = null;
      let minItemDist = 2.2;
      for (const it of gameState.groundItems) {
        const d = Math.hypot(it.x - localPlayer.x, it.y - localPlayer.y);
        if (d < minItemDist) {
          minItemDist = d;
          closestItem = it;
        }
      }
      if (closestItem) {
        targetInteract = {
          icon: 'star',
          label: 'LOOT',
          action: () => socket.emit('pickup_item', closestItem.id)
        };
      }
    }

    if (targetInteract) {
      mobileContextualAction = targetInteract.action;
      if (mobileInteractIcon) mobileInteractIcon.dataset.pxi = targetInteract.icon;
      if (mobileInteractText) mobileInteractText.textContent = targetInteract.label;
      mobileBtnInteract.style.display = 'inline-flex';
    } else {
      mobileContextualAction = null;
      mobileBtnInteract.style.display = 'none';
    }
  }

  // 📱 Mobile Virtual Joystick & Touch System Setup
  function setupMobileControls() {
    if (!mobileJoystickZone || !mobileJoystickBase || !mobileJoystickKnob) return;

    let activeJoystickTouchId = null;
    let joystickBaseRect = null;
    let joystickCenter = { x: 0, y: 0 };
    const maxRadius = 46; // px
    let moveEmitInterval = null;
    let currentNormX = 0;
    let currentNormY = 0;

    function resetJoystick() {
      activeJoystickTouchId = null;
      currentNormX = 0;
      currentNormY = 0;
      mobileJoystickKnob.style.transform = 'translate(0px, 0px)';
      if (moveEmitInterval) {
        clearInterval(moveEmitInterval);
        moveEmitInterval = null;
      }
      if (localPlayer) localPlayer.isMoving = false;
      socket.emit('player_input', { type: 'stop_move' });
    }

    function handleJoystickTouch(touch) {
      const dx = touch.clientX - joystickCenter.x;
      const dy = touch.clientY - joystickCenter.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 6) {
        currentNormX = 0;
        currentNormY = 0;
        mobileJoystickKnob.style.transform = 'translate(0px, 0px)';
        if (localPlayer) localPlayer.isMoving = false;
        socket.emit('player_input', { type: 'stop_move' });
        return;
      }

      const clampedDist = Math.min(maxRadius, dist);
      const angle = Math.atan2(dy, dx);
      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;

      mobileJoystickKnob.style.transform = `translate(${knobX.toFixed(1)}px, ${knobY.toFixed(1)}px)`;

      // Normalized screen direction
      currentNormX = Number(Math.cos(angle).toFixed(3));
      currentNormY = Number(Math.sin(angle).toFixed(3));

      // Local player prediction facing
      if (localPlayer) {
        localPlayer.isMoving = true;
        const deg = (angle * 180) / Math.PI;
        if (deg >= -22.5 && deg < 22.5) localPlayer.facing = 'E';
        else if (deg >= 22.5 && deg < 67.5) localPlayer.facing = 'SE';
        else if (deg >= 67.5 && deg < 112.5) localPlayer.facing = 'S';
        else if (deg >= 112.5 && deg < 157.5) localPlayer.facing = 'SW';
        else if (deg >= 157.5 || deg < -157.5) localPlayer.facing = 'W';
        else if (deg >= -157.5 && deg < -112.5) localPlayer.facing = 'NW';
        else if (deg >= -112.5 && deg < -67.5) localPlayer.facing = 'N';
        else if (deg >= -67.5 && deg < -22.5) localPlayer.facing = 'NE';
      }

      socket.emit('player_input', { type: 'wasd_move', dx: currentNormX, dy: currentNormY });
    }

    mobileJoystickZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.soundEngine.init();

      if (activeJoystickTouchId === null && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        activeJoystickTouchId = touch.identifier;
        joystickBaseRect = mobileJoystickBase.getBoundingClientRect();
        joystickCenter = {
          x: joystickBaseRect.left + joystickBaseRect.width / 2,
          y: joystickBaseRect.top + joystickBaseRect.height / 2
        };
        handleJoystickTouch(touch);

        if (!moveEmitInterval) {
          moveEmitInterval = setInterval(() => {
            if (activeJoystickTouchId !== null && (currentNormX !== 0 || currentNormY !== 0)) {
              socket.emit('player_input', { type: 'wasd_move', dx: currentNormX, dy: currentNormY });
            }
          }, 60);
        }
      }
    }, { passive: false });

    mobileJoystickZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      e.stopPropagation();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === activeJoystickTouchId) {
          handleJoystickTouch(touch);
          break;
        }
      }
    }, { passive: false });

    const endHandler = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeJoystickTouchId) {
          resetJoystick();
          break;
        }
      }
    };

    mobileJoystickZone.addEventListener('touchend', endHandler);
    mobileJoystickZone.addEventListener('touchcancel', endHandler);

    // Mouse fallback for testing joystick in mobile emulation
    let isMouseJoy = false;
    mobileJoystickZone.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isMouseJoy = true;
      joystickBaseRect = mobileJoystickBase.getBoundingClientRect();
      joystickCenter = {
        x: joystickBaseRect.left + joystickBaseRect.width / 2,
        y: joystickBaseRect.top + joystickBaseRect.height / 2
      };
      handleJoystickTouch(e);
      if (!moveEmitInterval) {
        moveEmitInterval = setInterval(() => {
          if (isMouseJoy && (currentNormX !== 0 || currentNormY !== 0)) {
            socket.emit('player_input', { type: 'wasd_move', dx: currentNormX, dy: currentNormY });
          }
        }, 60);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (isMouseJoy) {
        handleJoystickTouch(e);
      }
    });

    window.addEventListener('mouseup', () => {
      if (isMouseJoy) {
        isMouseJoy = false;
        resetJoystick();
      }
    });

    // Mobile Action Cluster buttons with zero-latency pointerdown
    function bindFastButton(btn, callback) {
      if (!btn) return;
      const fire = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.soundEngine.init();
        if (navigator.vibrate) {
          try { navigator.vibrate(12); } catch (_) {}
        }
        callback();
      };
      btn.addEventListener('pointerdown', fire);
    }

    bindFastButton(mobileBtnAttack, () => useBasicAttack());
    bindFastButton(mobileBtnSkill1, () => useSkill('slot1'));
    bindFastButton(mobileBtnSkill2, () => useSkill('slot2'));
    bindFastButton(mobileBtnSkill3, () => useSkill('slot3'));
    bindFastButton(mobileBtnDash, () => useSkill('dash'));
    bindFastButton(mobileBtnHp, () => drinkPotion('health'));
    bindFastButton(mobileBtnMp, () => drinkPotion('mana'));
    bindFastButton(mobileBtnTarget, () => cycleNextTarget());
    bindFastButton(mobileBtnInteract, () => {
      if (mobileContextualAction) mobileContextualAction();
    });

    // Mobile Drawer Navigation
    if (btnMobileMenuToggle && mobileMenuDrawer) {
      btnMobileMenuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        mobileMenuDrawer.style.display = mobileMenuDrawer.style.display === 'none' ? 'flex' : 'none';
      });
      document.addEventListener('click', (e) => {
        if (!mobileMenuDrawer.contains(e.target) && e.target !== btnMobileMenuToggle) {
          mobileMenuDrawer.style.display = 'none';
        }
      });
    }

    if (mBtnOpenSkillTree) {
      mBtnOpenSkillTree.addEventListener('click', () => {
        if (mobileMenuDrawer) mobileMenuDrawer.style.display = 'none';
        toggleSkillTreeModal();
      });
    }
    if (mBtnOpenShop) {
      mBtnOpenShop.addEventListener('click', () => {
        if (mobileMenuDrawer) mobileMenuDrawer.style.display = 'none';
        openShopModal();
      });
    }
    if (mBtnOpenStats) {
      mBtnOpenStats.addEventListener('click', () => {
        if (mobileMenuDrawer) mobileMenuDrawer.style.display = 'none';
        toggleModal(statsModal);
      });
    }
    if (mBtnOpenInventory) {
      mBtnOpenInventory.addEventListener('click', () => {
        if (mobileMenuDrawer) mobileMenuDrawer.style.display = 'none';
        renderInventoryGrid();
        toggleModal(inventoryModal);
      });
    }
    if (mBtnOpenHelp) {
      mBtnOpenHelp.addEventListener('click', () => {
        if (mobileMenuDrawer) mobileMenuDrawer.style.display = 'none';
        toggleModal(helpModal);
      });
    }

    // Chat collapsible toggle
    if (btnChatToggle) {
      const chatContainer = document.getElementById('chatContainer');
      btnChatToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (chatContainer) {
          chatContainer.classList.toggle('is-collapsed');
        }
      });
    }

    // Collapse chat on small mobile screens initially
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer && window.innerWidth <= 768) {
      chatContainer.classList.add('is-collapsed');
    }
  }

  // Prevent DOM layout thrashing by caching height percentage
  function setElementHeightPct(el, pct) {
    if (!el) return;
    const rounded = Math.round(pct * 10) / 10;
    if (el._lastPct !== rounded) {
      el._lastPct = rounded;
      el.style.height = `${rounded}%`;
    }
  }

  // Main Render Loop (with Target FPS throttling for low-end hardware)
  function gameLoop(currentTime) {
    if (frameInterval > 0) {
      const elapsed = currentTime - lastRenderTime;
      if (elapsed < frameInterval - 1) {
        requestAnimationFrame(gameLoop);
        return;
      }
      lastRenderTime = currentTime - (elapsed % frameInterval);
    } else {
      lastRenderTime = currentTime;
    }

    const dt = Math.min(0.1, (currentTime - lastFrameTime) / 1000);
    lastFrameTime = currentTime;
    trackFrameRate(currentTime);

    if (skill1CooldownTimer > 0) {
      skill1CooldownTimer = Math.max(0, skill1CooldownTimer - dt);
      const cdPct = (skill1CooldownTimer / skill1CooldownMax) * 100;
      setElementHeightPct(cdOverlaySkill1, cdPct);
      setElementHeightPct(cdOverlaySkill, cdPct);
      setElementHeightPct(mobileCdSkill1, cdPct);
    } else {
      setElementHeightPct(cdOverlaySkill1, 0);
      setElementHeightPct(cdOverlaySkill, 0);
      setElementHeightPct(mobileCdSkill1, 0);
    }

    if (skill2CooldownTimer > 0) {
      skill2CooldownTimer = Math.max(0, skill2CooldownTimer - dt);
      const cdPct = (skill2CooldownTimer / skill2CooldownMax) * 100;
      setElementHeightPct(cdOverlaySkill2, cdPct);
      setElementHeightPct(mobileCdSkill2, cdPct);
    } else {
      setElementHeightPct(cdOverlaySkill2, 0);
      setElementHeightPct(mobileCdSkill2, 0);
    }

    if (skill3CooldownTimer > 0) {
      skill3CooldownTimer = Math.max(0, skill3CooldownTimer - dt);
      const cdPct = (skill3CooldownTimer / skill3CooldownMax) * 100;
      setElementHeightPct(cdOverlaySkill3, cdPct);
      setElementHeightPct(mobileCdSkill3, cdPct);
    } else {
      setElementHeightPct(cdOverlaySkill3, 0);
      setElementHeightPct(mobileCdSkill3, 0);
    }

    if (dashCooldownTimer > 0) {
      dashCooldownTimer = Math.max(0, dashCooldownTimer - dt);
      const cdPct = (dashCooldownTimer / dashCooldownMax) * 100;
      setElementHeightPct(cdOverlayDash, cdPct);
      setElementHeightPct(mobileCdDash, cdPct);
    } else {
      setElementHeightPct(cdOverlayDash, 0);
      setElementHeightPct(mobileCdDash, 0);
    }

    if (weaponCooldownTimer > 0) {
      weaponCooldownTimer = Math.max(0, weaponCooldownTimer - dt);
      setElementHeightPct(cdOverlayWeapon, (weaponCooldownTimer / weaponCooldownMax) * 100);
    } else {
      setElementHeightPct(cdOverlayWeapon, 0);
    }

    // Toggled blood auras light up their hotbar slots
    if (localPlayer) {
      // ticks send a list; a raw 'player_updated' object holds the server's map
      const auras = localPlayer.spToggles || [];
      const on = new Set(Array.isArray(auras) ? auras.map(a => a.id) : Object.keys(auras));
      const eq = localPlayer.equippedSkills || {};
      for (const [slot, els] of [['slot1', [slotSkill1, mobileBtnSkill1]], ['slot2', [slotSkill2, mobileBtnSkill2]], ['slot3', [slotSkill3, mobileBtnSkill3]]]) {
        const active = on.has(eq[slot]);
        for (const el of els) if (el && el.classList.contains('is-toggled') !== active) el.classList.toggle('is-toggled', active);
      }
    }

    // Basic Attack Cooldown on Mobile
    if (localPlayer) {
      const atkSpeed = Math.max(0.4, localPlayer.attackSpeed || 1.0);
      const atkCooldownMs = Math.round(550 / atkSpeed);
      const elapsedAtk = currentTime - lastBasicAttackTime;
      if (elapsedAtk < atkCooldownMs) {
        const atkPct = ((atkCooldownMs - elapsedAtk) / atkCooldownMs) * 100;
        setElementHeightPct(mobileCdAttack, atkPct);
      } else {
        setElementHeightPct(mobileCdAttack, 0);
      }
    }

    // Contextual interaction detection for mobile, and the portal button
    updateMobileContextualInteract();
    updatePortalPrompt();

    // Smooth entity position interpolation (0.35 per 60 fps frame, scaled by
    // dt so heroes and mobs don't trail behind on slow machines)
    const lerpFactor = 1 - Math.pow(0.65, dt * 60);
    if (gameState.players) {
      gameState.players.forEach(p => {
        if (p.targetX !== undefined) {
          p.x += (p.targetX - p.x) * lerpFactor;
          p.y += (p.targetY - p.y) * lerpFactor;
        }
      });
    }
    if (gameState.mobs) {
      gameState.mobs.forEach(m => {
        if (m.targetX !== undefined) {
          m.x += (m.targetX - m.x) * lerpFactor;
          m.y += (m.targetY - m.y) * lerpFactor;
        }
      });
    }

    try {

      renderer.render(gameState, localPlayerId, selectedTargetId, dt);
    } catch (err) {
      console.error('Render error:', err);
    }

    requestAnimationFrame(gameLoop);
  }

  // Initialize mobile touch controls
  setupMobileControls();

  requestAnimationFrame(gameLoop);
});
