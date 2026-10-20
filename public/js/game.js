// Main Game Controller for Aetheria Online MMORPG with Procedural Dungeons & Merchant Shop
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const renderer = new IsometricRenderer(canvas);
  const socket = io();

  let localPlayerId = null;
  let localPlayer = null;
  let shopItemsCatalog = [];

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

  let skillCooldownTimer = 0;
  let skillCooldownMax = 5.0;

  const activeKeys = { w: false, a: false, s: false, d: false };

  // DOM Elements
  const joinModal = document.getElementById('joinModal');
  const btnJoinGame = document.getElementById('btnJoinGame');
  const inputHeroName = document.getElementById('inputHeroName');
  const classCards = document.querySelectorAll('.class-card');

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
  const slotSkill = document.getElementById('slotSkill');
  const slotSkillIcon = document.getElementById('slotSkillIcon');
  const slotHealthPotion = document.getElementById('slotHealthPotion');
  const slotManaPotion = document.getElementById('slotManaPotion');
  const badgeHealthPotion = document.getElementById('badgeHealthPotion');
  const badgeManaPotion = document.getElementById('badgeManaPotion');
  const cdOverlaySkill = document.getElementById('cdOverlaySkill');

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

  let reforgeTab = 'equipped'; // 'equipped' or 'bag'
  let selectedReforgeTarget = null; // { target, slot, itemIndex, item }

  // Dungeon Expedition Portal Modal Elements
  const dungeonPortalModal = document.getElementById('dungeonPortalModal');
  const btnCloseDungeonPortal = document.getElementById('btnCloseDungeonPortal');
  const btnConfirmEnterDungeon = document.getElementById('btnConfirmEnterDungeon');
  const floorCards = document.querySelectorAll('.floor-card');
  const diffCards = document.querySelectorAll('.diff-card');

  let selectedDungeonFloor = 1;
  let selectedDungeonDifficulty = 'normal';

  floorCards.forEach(card => {
    card.addEventListener('click', () => {
      floorCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedDungeonFloor = parseInt(card.getAttribute('data-floor'), 10) || 1;
      window.soundEngine.playCoin();
    });
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
      dungeonPortalModal.style.display = 'flex';
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

  if (btnConfirmEnterDungeon) {
    btnConfirmEnterDungeon.addEventListener('click', () => {
      socket.emit('enter_dungeon', {
        floor: selectedDungeonFloor,
        difficulty: selectedDungeonDifficulty
      });
      closeDungeonPortalModal();
      window.soundEngine.playLevelUp();
    });
  }

  let selectedClass = 'warrior';

  // Class Selection Setup
  classCards.forEach(card => {
    card.addEventListener('click', () => {
      classCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedClass = card.getAttribute('data-class');
    });
  });

  // Join Game Button
  btnJoinGame.addEventListener('click', () => {
    const name = inputHeroName.value.trim() || 'AetherKnight';
    window.soundEngine.init();
    window.soundEngine.playLevelUp();

    socket.emit('join_game', {
      name,
      characterClass: selectedClass
    });

    joinModal.style.display = 'none';

    if (selectedClass === 'warrior') {
      slotSkillIcon.textContent = '🌪️';
      slotSkill.title = 'Whirlwind Slash (AoE)';
      playerAvatarIcon.textContent = '🛡️';
      skillCooldownMax = 5.0;
    } else if (selectedClass === 'mage') {
      slotSkillIcon.textContent = '🔥';
      slotSkill.title = 'Firestorm Meteor (AoE)';
      playerAvatarIcon.textContent = '🧙‍♂️';
      skillCooldownMax = 6.0;
    } else if (selectedClass === 'rogue') {
      slotSkillIcon.textContent = '⚡';
      slotSkill.title = 'Shadow Strike Dash';
      playerAvatarIcon.textContent = '🗡️';
      skillCooldownMax = 4.0;
    }
  });

  // ================= NETWORKING & SOCKET EVENTS =================

  socket.on('connect', () => {
    if (localPlayer && localPlayer.name) {
      socket.emit('join_game', { name: localPlayer.name, characterClass: localPlayer.characterClass });
    }
  });

  socket.on('init_game', (data) => {
    localPlayerId = data.playerId;
    gameState.map = data.map;
    gameState.players = data.players;
    gameState.mobs = data.mobs;
    gameState.groundItems = data.groundItems;
    shopItemsCatalog = data.shopItems || [];

    localPlayer = data.player;
    updatePlayerHUD(localPlayer);
    renderShopBuyList();
    renderInventoryGrid();
    renderer.setCameraTarget(localPlayer.x, localPlayer.y);
  });

  socket.on('zone_change', (data) => {
    gameState.map = data.map;
    gameState.players = data.players || [];
    gameState.mobs = data.mobs || [];
    gameState.groundItems = data.groundItems || [];
    gameState.chests = data.chests || [];

    if (data.player) {
      localPlayer = data.player;
      updatePlayerHUD(localPlayer);
      renderer.setCameraTarget(localPlayer.x, localPlayer.y);
      renderer.camera.x = renderer.camera.targetX;
      renderer.camera.y = renderer.camera.targetY;
    }

    if (zoneIcon && zoneText) {
      if (data.zone === 'dungeon') {
        zoneIcon.textContent = '🌀';
        zoneText.textContent = `Dungeon - Floor ${data.floorLevel || 1}`;
        window.soundEngine.playSkillWhoosh();
      } else {
        zoneIcon.textContent = '🏰';
        zoneText.textContent = 'Town of Slop Hero';
        window.soundEngine.playLevelUp();
      }
    }
  });

  if (zoneBadge) {
    zoneBadge.style.cursor = 'pointer';
    zoneBadge.title = 'Click to Teleport (Town <-> Dungeon)';
    zoneBadge.addEventListener('click', () => {
      if (!localPlayer) return;
      if (localPlayer.zone === 'town') {
        openDungeonPortalModal();
      } else {
        socket.emit('leave_dungeon');
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
        existing.inventory = p.inventory;
        existing.equipment = p.equipment;
        existing.baseStats = p.baseStats;
        existing.dmg = p.dmg;
        existing.def = p.def;
        existing.speed = p.speed;
      } else {
        p.targetX = p.x;
        p.targetY = p.y;
        gameState.players.push(p);
      }
    });
    gameState.players = gameState.players.filter(oldP => incomingPlayers.some(p => p.id === oldP.id));

    if (localPlayer) {
      const isTown = localPlayer.zone === 'town';
      const incomingMobs = isTown ? (tickData.townMobs || []) : (tickData.dungeonMobs || []);
      
      incomingMobs.forEach(m => {
        const existingMob = gameState.mobs.find(oldM => oldM.id === m.id);
        if (existingMob) {
          existingMob.targetX = m.x;
          existingMob.targetY = m.y;
          existingMob.facing = m.facing;
          existingMob.hp = m.hp;
          existingMob.maxHp = m.maxHp;
          existingMob.state = m.state;
          existingMob.buffs = m.buffs || [];
          existingMob.isCommander = !!m.isCommander;
          existingMob.auraRadius = m.auraRadius || 0;
          existingMob.hasCommanderBuff = !!m.hasCommanderBuff;
        } else {
          m.targetX = m.x;
          m.targetY = m.y;
          gameState.mobs.push(m);
        }
      });
      gameState.mobs = gameState.mobs.filter(oldM => incomingMobs.some(m => m.id === oldM.id));

      gameState.chests = isTown ? [] : (tickData.dungeonChests || []);

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

    // Update target HUD
    if (selectedTargetId && gameState.mobs) {
      const mob = gameState.mobs.find(m => m.id === selectedTargetId);
      if (mob && mob.state !== 'dead') {
        targetHud.classList.add('active');
        targetName.textContent = `${mob.name} (Lv. ${mob.level})`;
        const hpPct = Math.round((mob.hp / mob.maxHp) * 100);
        targetHpFill.style.width = `${hpPct}%`;
        targetIcon.textContent = mob.isBoss ? '👑' : mob.type === 'slime' ? '🟢' : mob.type === 'goblin' ? '👺' : '💀';
      } else {
        targetHud.classList.remove('active');
        selectedTargetId = null;
      }
    }

    if (onlineCountText) {
      const count = gameState.players.length;
      onlineCountText.textContent = `${count} Hero${count > 1 ? 'es' : ''} Online`;
    }
  });

  socket.on('player_updated', (updatedPlayer) => {
    localPlayer = updatedPlayer;
    updatePlayerHUD(localPlayer);
    renderInventoryGrid();
    renderShopSellList();
    if (shopPlayerGold) shopPlayerGold.textContent = localPlayer.gold;
  });

  socket.on('item_dropped', (item) => {
    gameState.groundItems.push(item);
  });

  socket.on('item_picked', (data) => {
    gameState.groundItems = gameState.groundItems.filter(i => i.id !== data.itemId);
    if (data.pickerId === localPlayerId) {
      window.soundEngine.playCoin();
      if (renderer) renderer.addParticles(localPlayer.x, localPlayer.y, 'gold', 8);
    }
  });

  socket.on('item_dropped', (item) => {
    if (localPlayer && item.zone === localPlayer.zone && gameState.groundItems) {
      if (!gameState.groundItems.some(i => i.id === item.id)) {
        gameState.groundItems.push(item);
      }
    }
  });

  socket.on('player_updated', (updatedPlayer) => {
    localPlayer = updatedPlayer;
    updatePlayerHUD(localPlayer);
    renderInventoryGrid();
    renderShopSellList();
    if (shopPlayerGold) shopPlayerGold.textContent = localPlayer.gold;
  });

  socket.on('chest_opened', (data) => {
    window.soundEngine.playLevelUp();
    if (gameState.chests) {
      const chest = gameState.chests.find(c => c.id === data.chestId);
      if (chest) chest.opened = true;
    }
  });

  socket.on('entity_attack_fx', (fx) => {
    if (renderer) renderer.triggerAttackAnimation(fx);

    if (fx.attackerType === 'player') {
      if (fx.class === 'mage') {
        window.soundEngine.playFireball();
      } else {
        window.soundEngine.playSlash();
      }
    } else {
      window.soundEngine.playHit();
    }
  });

  socket.on('skill_fx', (fx) => {
    if (renderer) renderer.addSkillEffect(fx);

    if (fx.playerId === localPlayerId) {
      skillCooldownTimer = skillCooldownMax;
    }

    if (fx.type === 'whirlwind') {
      window.soundEngine.playSkillWhoosh();
    } else if (fx.type === 'firestorm') {
      window.soundEngine.playExplosion();
    } else if (fx.type === 'shadow_strike') {
      window.soundEngine.playSkillWhoosh();
    }
  });

  socket.on('projectile_exploded', (data) => {
    window.soundEngine.playExplosion();
    renderer.addParticles(data.x, data.y, 'fire', 12);
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
  });

  socket.on('player_died', (data) => {
    if (data.playerId === localPlayerId) {
      if (deathScreen) deathScreen.classList.add('active');
    }
  });

  socket.on('player_respawned', (data) => {
    if (data.playerId === localPlayerId) {
      if (deathScreen) deathScreen.classList.remove('active');
    }
  });

  // ================= INPUT & CONTROLS =================

  let isPointerDown = false;
  let lastMoveEmitTime = 0;

  // Prevent default right-click context menu on game canvas
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function handlePointerAction(e, isDragging = false) {
    window.soundEngine.init();
    if (!localPlayer || localPlayer.isDead) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldPos = Isometric.screenToWorld(mouseX, mouseY, renderer.camera, canvas.width, canvas.height);

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

    // Single Click Actions (Right click is always move, Left click checks interactables)
    const isRightClick = e.button === 2;

    if (!isRightClick) {
      // 1. Check if clicked on Merchant Olaf or Blacksmith Brom in town
      if (localPlayer.zone === 'town') {
        const clickDistToMerchant = Math.hypot(16.5 - worldPos.x, 21 - worldPos.y);
        const clickDistToBrom = Math.hypot(24.2 - worldPos.x, 23.5 - worldPos.y);
        const clickDistToPortal = Math.hypot(23.5 - worldPos.x, 16.5 - worldPos.y);

        // Precise hitbox: click must land directly on NPC (radius < 0.9)
        if (clickDistToMerchant < 0.9) {
          const playerDist = Math.hypot(16.5 - localPlayer.x, 21 - localPlayer.y);
          if (playerDist <= 3.5) {
            openShopModal();
          } else {
            socket.emit('player_input', { type: 'click_move', x: 17.5, y: 21 });
          }
          return;
        }

        if (clickDistToBrom < 0.9) {
          const playerDist = Math.hypot(24.2 - localPlayer.x, 23.5 - localPlayer.y);
          if (playerDist <= 3.5) {
            openReforgeModal();
          } else {
            socket.emit('player_input', { type: 'click_move', x: 23.2, y: 23.5 });
          }
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
      } else if (localPlayer.zone === 'dungeon') {
        if (gameState.map && gameState.map.exitPortal) {
          const ep = gameState.map.exitPortal;
          if (Math.hypot(ep.x - worldPos.x, ep.y - worldPos.y) < 2.5) {
            socket.emit('leave_dungeon');
            return;
          }
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
        socket.emit('player_attack', {
          targetId: clickedMob.id,
          targetType: 'mob'
        });
        return;
      }
    }

    // Destination Move
    renderer.addClickMarker(worldPos.x, worldPos.y);
    socket.emit('player_input', {
      type: 'click_move',
      x: worldPos.x,
      y: worldPos.y
    });
  }

  canvas.addEventListener('mousedown', (e) => {
    isPointerDown = true;
    handlePointerAction(e, false);
  });

  window.addEventListener('mouseup', () => {
    isPointerDown = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isPointerDown && !selectedTargetId) {
      handlePointerAction(e, true);
    }
  });

  // Mouse Wheel Zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
    renderer.camera.zoom = Math.max(0.65, Math.min(1.85, renderer.camera.zoom + zoomDelta));
  }, { passive: false });

  // Keyboard Event Listeners
  window.addEventListener('keydown', (e) => {
    if (document.activeElement === chatInput) {
      if (e.key === 'Enter') sendChatMessage();
      return;
    }

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
      useClassSkill();
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

    if (code === 'Escape') {
      statsModal.style.display = 'none';
      inventoryModal.style.display = 'none';
      helpModal.style.display = 'none';
      shopModal.style.display = 'none';
      if (reforgeModal) reforgeModal.style.display = 'none';
      if (dungeonPortalModal) dungeonPortalModal.style.display = 'none';
      chatInput.blur();
      return;
    }

    if (code === 'KeyR' || key === 'r') {
      if (reforgeModal && reforgeModal.style.display === 'flex') {
        reforgeModal.style.display = 'none';
      } else {
        openReforgeModal();
      }
    }
    if (code === 'KeyP' || key === 'p') openShopModal();
    if (code === 'KeyC' || key === 'c') toggleModal(statsModal);
    if (code === 'KeyI' || key === 'i') {
      renderInventoryGrid();
      toggleModal(inventoryModal);
    }
    if (code === 'KeyH' || key === 'h') toggleModal(helpModal);
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
      socket.emit('player_input', { type: 'wasd_move', dx, dy });
    } else {
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
      targetIcon.textContent = nextTarget.isBoss ? '👑' : nextTarget.type === 'slime' ? '🟢' : nextTarget.type === 'goblin' ? '👺' : '💀';
    }
  }

  // Space Key Smart Attack: Attacks locked target or auto-finds closest enemy
  function useBasicAttack() {
    if (!localPlayer || localPlayer.isDead) return;

    const AUTO_LOCK_RADIUS = 8.5;
    let targetMob = null;

    // 1. Check if currently selected target is valid and alive
    if (selectedTargetId && gameState.mobs) {
      const mob = gameState.mobs.find(m => m.id === selectedTargetId);
      if (mob && mob.state !== 'dead') {
        const dist = Math.hypot(mob.x - localPlayer.x, mob.y - localPlayer.y);
        if (dist <= AUTO_LOCK_RADIUS + 3.0) {
          targetMob = mob;
        }
      }
    }

    // 2. If no valid target, auto-find closest alive mob within radius
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
          targetIcon.textContent = closestMob.isBoss ? '👑' : closestMob.type === 'slime' ? '🟢' : closestMob.type === 'goblin' ? '👺' : '💀';
        }
      }
    }

    // 3. Dispatch Attack
    if (targetMob) {
      const dist = Math.hypot(targetMob.x - localPlayer.x, targetMob.y - localPlayer.y);
      const attackRange = localPlayer.characterClass === 'mage' ? 5.5 : 2.2;

      // For melee, if slightly out of reach (e.g. 2.2 to 4.5 tiles), step forward to engage
      if (dist > attackRange && dist <= 4.5) {
        socket.emit('player_input', {
          type: 'click_move',
          x: targetMob.x,
          y: targetMob.y
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
  }

  function useClassSkill() {
    if (!localPlayer || localPlayer.isDead || skillCooldownTimer > 0) return;

    const mpCost = localPlayer.characterClass === 'warrior' ? 12 : localPlayer.characterClass === 'rogue' ? 15 : 20;
    if (localPlayer.mp < mpCost) {
      if (renderer) renderer.addFloatingText(localPlayer.x, localPlayer.y - 0.7, '⚠️ Not enough Mana!', '#38bdf8', 15);
      return;
    }

    let targetX = localPlayer.x;
    let targetY = localPlayer.y;

    if (selectedTargetId && gameState.mobs) {
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

    socket.emit('player_skill', { targetX, targetY });
  }

  function drinkPotion(type) {
    if (!localPlayer || localPlayer.isDead) return;
    socket.emit('use_potion', type);
    window.soundEngine.playPotion();
  }

  function sendChatMessage() {
    const text = chatInput.value.trim();
    if (text) {
      socket.emit('send_chat', text);
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

  // Sound FX Toggle
  const btnAudioToggle = document.getElementById('btnAudioToggle');
  function toggleAudio() {
    const isMuted = window.soundEngine.toggleMute();
    btnAudioToggle.textContent = isMuted ? '🔇' : '🔊';
  }
  btnAudioToggle.addEventListener('click', toggleAudio);

  // HUD Update
  function updatePlayerHUD(p) {
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
      badgeHealthPotion.textContent = p.inventory.healthPotions || 0;
      badgeManaPotion.textContent = p.inventory.manaPotions || 0;
      const invHp = document.getElementById('invHpCount');
      const invMp = document.getElementById('invMpCount');
      const invGold = document.getElementById('invGoldText');
      if (invHp) invHp.textContent = p.inventory.healthPotions || 0;
      if (invMp) invMp.textContent = p.inventory.manaPotions || 0;
      if (invGold) invGold.textContent = p.gold;
    }

    const statClass = document.getElementById('statClass');
    const statLevel = document.getElementById('statLevel');
    const statExp = document.getElementById('statExp');
    const statHp = document.getElementById('statHp');
    const statMp = document.getElementById('statMp');
    const statDmg = document.getElementById('statDmg');
    const statDef = document.getElementById('statDef');
    const statSpeed = document.getElementById('statSpeed');
    const statKills = document.getElementById('statKills');
    const statGold = document.getElementById('statGold');

    let bonusDmg = 0, bonusDef = 0, bonusHp = 0, bonusMp = 0, bonusSpeed = 0;
    if (p.equipment) {
      for (const eq of Object.values(p.equipment)) {
        if (!eq) continue;
        if (eq.bonusDmg) bonusDmg += eq.bonusDmg;
        if (eq.bonusDef) bonusDef += eq.bonusDef;
        if (eq.bonusHp) bonusHp += eq.bonusHp;
        if (eq.bonusMp) bonusMp += eq.bonusMp;
        if (eq.bonusSpeed) bonusSpeed += eq.bonusSpeed;
      }
    }

    if (statClass) statClass.textContent = p.characterClass.toUpperCase();
    if (statLevel) statLevel.textContent = p.level;
    if (statExp) statExp.textContent = `${p.exp} / ${p.expNext}`;
    if (statHp) statHp.innerHTML = `${p.hp} / ${p.maxHp} ${bonusHp ? `<span style="color:#4ade80; font-size:11px;">(+${bonusHp})</span>` : ''}`;
    if (statMp) statMp.innerHTML = `${p.mp} / ${p.maxMp} ${bonusMp ? `<span style="color:#38bdf8; font-size:11px;">(+${bonusMp})</span>` : ''}`;
    if (statDmg) statDmg.innerHTML = `${p.dmg || 20} ${bonusDmg ? `<span style="color:#f59e0b; font-size:11px;">(+${bonusDmg})</span>` : ''}`;
    if (statDef) statDef.innerHTML = `${p.def || 5} ${bonusDef ? `<span style="color:#60a5fa; font-size:11px;">(+${bonusDef})</span>` : ''}`;
    if (statSpeed) statSpeed.innerHTML = `${p.speed || 4.5} ${bonusSpeed ? `<span style="color:#a855f7; font-size:11px;">(+${bonusSpeed.toFixed(1)})</span>` : ''}`;
    if (statKills) statKills.textContent = `${(p.inventory && p.inventory.kills) || 0}`;
    if (statGold) statGold.textContent = `${p.gold} 🪙`;
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
      card.innerHTML = `
        <div class="shop-item-left">
          <div class="shop-item-icon">${item.icon || '📦'}</div>
          <div class="shop-item-details">
            <div class="shop-item-name">${item.name}</div>
            <div class="shop-item-desc">${item.desc || ''}</div>
          </div>
        </div>
        <button class="btn-shop-action" data-buy-id="${item.id}">
          Buy 🪙 ${item.buyPrice}
        </button>
      `;

      const btn = card.querySelector('button');
      btn.addEventListener('click', () => {
        socket.emit('buy_item', { itemId: item.id });
        window.soundEngine.playCoin();
      });

      shopBuyList.appendChild(card);
    });
  }

  function renderShopSellList() {
    if (!shopSellList || !localPlayer || !localPlayer.inventory) return;
    shopSellList.innerHTML = '';

    const items = localPlayer.inventory.items || [];
    if (items.length === 0) {
      shopSellList.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 30px;">Your bag has no relics to sell. Delve into the dungeon to find loot!</div>';
      return;
    }

    items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = `shop-item-card rarity-${item.rarity || 'common'}`;
      card.innerHTML = `
        <div class="shop-item-left">
          <div class="shop-item-icon">${item.icon || '📦'}</div>
          <div class="shop-item-details">
            <div class="shop-item-name">${item.name} ${item.count > 1 ? `x${item.count}` : ''}</div>
            <div class="shop-item-desc">${item.desc || ''}</div>
          </div>
        </div>
        <button class="btn-shop-action sell" data-sell-index="${index}">
          Sell +🪙 ${item.sellPrice || 10}
        </button>
      `;

      const btn = card.querySelector('button');
      btn.addEventListener('click', () => {
        socket.emit('sell_item', { itemIndex: index });
        window.soundEngine.playCoin();
      });

      shopSellList.appendChild(card);
    });
  }

  function renderInventoryGrid() {
    if (!localPlayer) return;

    // 1. Render Equipped Gear Paperdoll Slots
    const equipmentSlots = [
      { id: 'eqSlotHelmet', slot: 'helmet', defaultIcon: '🪖' },
      { id: 'eqSlotArmor', slot: 'armor', defaultIcon: '🛡️' },
      { id: 'eqSlotWeapon', slot: 'weapon', defaultIcon: '🗡️' },
      { id: 'eqSlotBoots', slot: 'boots', defaultIcon: '👢' },
      { id: 'eqSlotRing', slot: 'ring', defaultIcon: '💍' }
    ];

    const playerEq = localPlayer.equipment || {};
    let totalBonusDmg = 0;
    let totalBonusDef = 0;
    let totalBonusHp = 0;
    let totalBonusMp = 0;
    let totalBonusSpeed = 0;

    equipmentSlots.forEach(({ id, slot, defaultIcon }) => {
      const el = document.getElementById(id);
      if (!el) return;

      const item = playerEq[slot];
      const contentEl = el.querySelector('.equip-item-content');
      const placeholder = el.querySelector('.slot-placeholder-icon');

      // Clear rarity classes
      el.className = 'equip-slot';

      if (item) {
        el.classList.add('filled', `rarity-${item.rarity || 'common'}`);
        if (placeholder) placeholder.style.display = 'none';

        let statsDesc = [];
        if (item.bonusDmg) { statsDesc.push(`+${item.bonusDmg} DMG`); totalBonusDmg += item.bonusDmg; }
        if (item.bonusDef) { statsDesc.push(`+${item.bonusDef} DEF`); totalBonusDef += item.bonusDef; }
        if (item.bonusHp) { statsDesc.push(`+${item.bonusHp} HP`); totalBonusHp += item.bonusHp; }
        if (item.bonusMp) { statsDesc.push(`+${item.bonusMp} MP`); totalBonusMp += item.bonusMp; }
        if (item.bonusSpeed) { statsDesc.push(`+${item.bonusSpeed} SPD`); totalBonusSpeed += item.bonusSpeed; }

        el.title = `${item.name} (${item.rarity.toUpperCase()})\n${statsDesc.join(', ')}\n${item.desc || ''}\n\n👉 [Click to Unequip]`;

        if (contentEl) {
          contentEl.innerHTML = `
            <div class="equip-item-icon">${item.icon || '⚔️'}</div>
            <div class="equip-item-name">${item.name}</div>
          `;
        }

        // Click to Unequip
        el.onclick = () => {
          socket.emit('unequip_item', { slot });
          window.soundEngine.playSlash();
        };
      } else {
        if (placeholder) placeholder.style.display = 'block';
        if (contentEl) contentEl.innerHTML = '';
        el.title = `${slot.toUpperCase()} Slot (Empty)\nClick equipment in your bag to equip.`;
        el.onclick = null;
      }
    });

    // 2. Render Gear Stat Bonuses Pill Bar
    const bonusesBar = document.getElementById('gearBonusesSummary');
    if (bonusesBar) {
      bonusesBar.innerHTML = '';
      const bonusItems = [
        { label: 'Attack', val: totalBonusDmg, icon: '⚔️' },
        { label: 'Defense', val: totalBonusDef, icon: '🛡️' },
        { label: 'Max HP', val: totalBonusHp, icon: '❤️' },
        { label: 'Max MP', val: totalBonusMp, icon: '💧' },
        { label: 'Speed', val: totalBonusSpeed ? totalBonusSpeed.toFixed(1) : 0, icon: '👟' }
      ];

      bonusItems.forEach(b => {
        const pill = document.createElement('span');
        const isActive = Number(b.val) > 0;
        pill.className = `stat-pill ${isActive ? 'active' : ''}`;
        pill.innerHTML = `${b.icon} ${b.label}: ${isActive ? `+${b.val}` : '-'}`;
        bonusesBar.appendChild(pill);
      });
    }

    // 3. Render 24 Compact Bag Slots (6 Columns x 4 Rows)
    const invGrid = document.getElementById('invItemsGrid');
    if (!invGrid || !localPlayer.inventory) return;
    invGrid.innerHTML = '';

    const items = localPlayer.inventory.items || [];
    const maxCapacity = 24;

    const capacityText = document.getElementById('invCapacityText');
    if (capacityText) capacityText.textContent = `${items.length} / ${maxCapacity} Slots`;

    for (let i = 0; i < maxCapacity; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot-compact';

      if (i < items.length) {
        const item = items[i];
        slot.classList.add(`rarity-${item.rarity || 'common'}`);

        let actionHint = item.type === 'equipment' ? '👉 [Click to Equip]' :
                         item.type === 'consumable' ? '👉 [Click to Drink/Use]' :
                         `💰 Value: ${item.sellPrice || 10} Gold (Sell to Olaf)`;

        slot.title = `${item.name} (${item.rarity.toUpperCase()})\n${item.desc || ''}\n${actionHint}`;
        slot.innerHTML = `
          <div class="inv-icon">${item.icon || '📦'}</div>
          ${item.count > 1 ? `<div class="inv-badge">x${item.count}</div>` : ''}
        `;

        slot.addEventListener('click', () => {
          if (item.type === 'equipment') {
            socket.emit('equip_item', { itemIndex: i });
            window.soundEngine.playLevelUp();
          } else if (item.id === 'health_potion') {
            drinkPotion('health');
          } else if (item.id === 'mana_potion') {
            drinkPotion('mana');
          }
        });
      } else {
        slot.classList.add('empty');
      }

      invGrid.appendChild(slot);
    }
  }

  // Hook Quick Potions inside inventory modal
  const modalHp = document.getElementById('invHpSlot');
  const modalMp = document.getElementById('invMpSlot');
  if (modalHp) modalHp.addEventListener('click', () => drinkPotion('health'));
  if (modalMp) modalMp.addEventListener('click', () => drinkPotion('mana'));

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

  // ================= BROM'S FORGE & REFORGE UI =================
  const reforgeRates = [
    { rate: 1.0, cost: 50, label: '100% (Guaranteed)', safe: true },
    { rate: 1.0, cost: 80, label: '100% (Guaranteed)', safe: true },
    { rate: 1.0, cost: 120, label: '100% (Safe Zone)', safe: true },
    { rate: 0.85, cost: 180, label: '85% Success Chance', safe: true },
    { rate: 0.75, cost: 260, label: '75% Success Chance', safe: true },
    { rate: 0.65, cost: 360, label: '65% Success Chance', safe: true },
    { rate: 0.50, cost: 500, label: '50% Moderate Risk', safe: true },
    { rate: 0.40, cost: 700, label: '40% High Risk', safe: false },
    { rate: 0.30, cost: 950, label: '30% Dangerous', safe: false },
    { rate: 0.20, cost: 1300, label: '20% Legendary Risk', safe: false }
  ];

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

      const row = document.createElement('div');
      row.className = `reforge-list-item ${isSelected ? 'selected' : ''} rarity-${item.rarity || 'common'}`;
      row.innerHTML = `
        <div class="rf-item-left">
          <div class="rf-item-icon">${item.icon || '⚔️'}</div>
          <div class="rf-item-name">${item.name}</div>
        </div>
        <span class="rf-item-lvl">+${item.upgradeLevel || 0}</span>
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

    if (rfItemIcon) rfItemIcon.textContent = item.icon || '⚔️';
    if (rfItemName) rfItemName.textContent = item.name;

    const curLvl = item.upgradeLevel || 0;
    if (curLvl >= 10) {
      if (rfLevelBadge) rfLevelBadge.textContent = '⭐ MAX ENHANCEMENT (+10)';
      if (rfStatPreview) rfStatPreview.innerHTML = '<div style="color: #facc15; font-size: 13px; text-align: center; font-weight:700;">✨ This item has reached its peak mythical power!</div>';
      if (rfChanceVal) {
        rfChanceVal.textContent = 'MAX LEVEL';
        rfChanceVal.style.color = '#facc15';
      }
      if (rfRiskTag) rfRiskTag.textContent = 'Max forge level reached.';
      if (rfCostVal) rfCostVal.textContent = '0';
      if (btnHammerItem) {
        btnHammerItem.disabled = true;
        btnHammerItem.textContent = '✨ MAX UPGRADE REACHED';
      }
      return;
    }

    const cfg = reforgeRates[curLvl] || { rate: 0.15, cost: 1800, label: '15% Extremely High Risk', safe: false };
    if (rfLevelBadge) rfLevelBadge.textContent = `Level +${curLvl} ➜ +${curLvl + 1}`;

    let previewHtml = '';
    if (item.slot === 'weapon') {
      const curDmg = item.bonusDmg || 0;
      previewHtml = `
        <div class="rf-stat-row"><span>Attack Power:</span><strong>${curDmg} ➜ ${curDmg + 4} (+4)</strong></div>
      `;
    } else if (item.slot === 'armor') {
      const curDef = item.bonusDef || 0;
      const curHp = item.bonusHp || 0;
      previewHtml = `
        <div class="rf-stat-row"><span>Defense:</span><strong>${curDef} ➜ ${curDef + 2} (+2)</strong></div>
        <div class="rf-stat-row"><span>Max Health:</span><strong>${curHp} ➜ ${curHp + 25} (+25)</strong></div>
      `;
    } else if (item.slot === 'helmet') {
      const curDef = item.bonusDef || 0;
      const curHp = item.bonusHp || 0;
      previewHtml = `
        <div class="rf-stat-row"><span>Defense:</span><strong>${curDef} ➜ ${curDef + 2} (+2)</strong></div>
        <div class="rf-stat-row"><span>Max Health:</span><strong>${curHp} ➜ ${curHp + 15} (+15)</strong></div>
      `;
    } else if (item.slot === 'boots') {
      const curDef = item.bonusDef || 0;
      const curSpd = item.bonusSpeed || 0;
      previewHtml = `
        <div class="rf-stat-row"><span>Defense:</span><strong>${curDef} ➜ ${curDef + 1} (+1)</strong></div>
        <div class="rf-stat-row"><span>Movement Speed:</span><strong>${curSpd.toFixed(2)} ➜ ${(curSpd + 0.08).toFixed(2)} (+0.08)</strong></div>
      `;
    } else if (item.slot === 'ring') {
      const curDmg = item.bonusDmg || 0;
      const curHp = item.bonusHp || 0;
      previewHtml = `
        <div class="rf-stat-row"><span>Attack Power:</span><strong>${curDmg} ➜ ${curDmg + 3} (+3)</strong></div>
        <div class="rf-stat-row"><span>Max Health:</span><strong>${curHp} ➜ ${curHp + 15} (+15)</strong></div>
      `;
    }
    if (rfStatPreview) rfStatPreview.innerHTML = previewHtml;

    if (rfChanceVal) {
      rfChanceVal.textContent = cfg.label;
      rfChanceVal.style.color = cfg.rate >= 0.8 ? '#4ade80' : cfg.rate >= 0.5 ? '#facc15' : '#ef4444';
    }
    if (rfRiskTag) {
      rfRiskTag.innerHTML = cfg.safe
        ? '🛡️ <strong style="color:#4ade80;">Safe Zone:</strong> Level never drops on fail'
        : '⚠️ <strong style="color:#f87171;">High Risk:</strong> May drop 1 level on failure';
    }
    if (rfCostVal) rfCostVal.textContent = cfg.cost;

    if (btnHammerItem) {
      btnHammerItem.disabled = false;
      btnHammerItem.textContent = `🔨 STRIKE ANVIL & REFORGE (🪙 ${cfg.cost})`;
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
  slotAttack.addEventListener('click', () => useBasicAttack());
  slotSkill.addEventListener('click', () => useClassSkill());
  slotHealthPotion.addEventListener('click', () => drinkPotion('health'));
  slotManaPotion.addEventListener('click', () => drinkPotion('mana'));

  function toggleModal(modal) {
    if (modal.style.display === 'flex') {
      modal.style.display = 'none';
    } else {
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

  [statsModal, inventoryModal, helpModal, shopModal, reforgeModal].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  });

  // Main Render Loop (60 FPS)
  function gameLoop(currentTime) {
    const dt = Math.min(0.1, (currentTime - lastFrameTime) / 1000);
    lastFrameTime = currentTime;

    if (skillCooldownTimer > 0) {
      skillCooldownTimer = Math.max(0, skillCooldownTimer - dt);
      const cdPct = (skillCooldownTimer / skillCooldownMax) * 100;
      cdOverlaySkill.style.height = `${cdPct}%`;
    } else {
      cdOverlaySkill.style.height = '0%';
    }

    // Smooth entity position interpolation (60+ FPS lerp)
    const lerpFactor = 0.35;
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

    renderer.render(gameState, localPlayerId, selectedTargetId, dt);
    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
});
