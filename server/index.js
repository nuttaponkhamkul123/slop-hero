const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const GameServer = require('./gameServer');
const adminCommands = require('./adminCommands');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Explicit route to serve city.wav music file
app.get('/city.wav', (req, res) => {
  const cityPath = path.join(__dirname, '..', 'city.wav');
  if (fs.existsSync(cityPath)) {
    res.sendFile(cityPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// Explicit route to serve dunjion.wav music file for dungeon zone
app.get(['/dunjion.wav', '/dungeon.wav', '/dunjion'], (req, res) => {
  const dungeonPath = path.join(__dirname, '..', 'dunjion.wav');
  if (fs.existsSync(dungeonPath)) {
    res.sendFile(dungeonPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// Explicit route to serve login.wav music file for the login screen
app.get('/login.wav', (req, res) => {
  const loginPath = path.join(__dirname, '..', 'login.wav');
  if (fs.existsSync(loginPath)) {
    res.sendFile(loginPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// Explicit route to serve frosfell.wav music file for the Frostfell zone
app.get(['/frosfell.wav', '/frostfell.wav'], (req, res) => {
  const frostfellPath = path.join(__dirname, '..', 'frosfell.wav');
  if (fs.existsSync(frostfellPath)) {
    res.sendFile(frostfellPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// Explicit route to serve "shadowfell ruins.wav" music file for the Shadowfell zone
app.get('/shadowfell-ruins.wav', (req, res) => {
  const shadowfellPath = path.join(__dirname, '..', 'shadowfell ruins.wav');
  if (fs.existsSync(shadowfellPath)) {
    res.sendFile(shadowfellPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// Explicit route to serve wildwood.wav music file for the Verdant Wildwood zone
app.get('/wildwood.wav', (req, res) => {
  const wildwoodPath = path.join(__dirname, '..', 'wildwood.wav');
  if (fs.existsSync(wildwoodPath)) {
    res.sendFile(wildwoodPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// Explicit route to serve celestial.wav music file for the Celestial Reach zone
app.get('/celestial.wav', (req, res) => {
  const celestialPath = path.join(__dirname, '..', 'celestial.wav');
  if (fs.existsSync(celestialPath)) {
    res.sendFile(celestialPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// Initialize Game Engine
const gameServer = new GameServer(io);

// Handle WebSockets
io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // Every handler runs in the context of the sender's dungeon instance, so
  // zone-wide emits and lookups from inside a dungeon stay in that instance.
  const rawOn = socket.on.bind(socket);
  socket.on = (event, handler) => rawOn(event, (...args) => gameServer.runAs(socket.id, () => handler(...args)));

  socket.on('account_register', (data) => {
    gameServer.handleAccountRegister(socket, data);
  });

  socket.on('account_login', (data) => {
    gameServer.handleAccountLogin(socket, data);
  });

  socket.on('create_character', (data) => {
    gameServer.handleCreateCharacter(socket, data);
  });

  socket.on('delete_character', (data) => {
    gameServer.handleDeleteCharacter(socket, data);
  });

  socket.on('join_game', (data) => {
    gameServer.addPlayer(socket, data);
  });

  socket.on('use_revival_stone', (data) => {
    gameServer.handleUseRevivalStone(socket.id, !!(data && data.super));
  });

  socket.on('player_input', (input) => {
    gameServer.handlePlayerInput(socket.id, input);
  });

  socket.on('player_attack', (targetInfo) => {
    gameServer.handlePlayerAttack(socket.id, targetInfo);
  });

  socket.on('player_skill', (skillData) => {
    gameServer.handlePlayerSkill(socket.id, skillData);
  });

  socket.on('use_potion', (potionType) => {
    gameServer.handleUsePotion(socket.id, potionType);
  });

  socket.on('use_portal', () => {
    gameServer.handleUsePortal(socket.id);
  });

  socket.on('pickup_item', (itemId) => {
    gameServer.handlePickupItem(socket.id, itemId);
  });

  socket.on('send_chat', (message) => {
    gameServer.handleChatMessage(socket.id, message);
  });

  // Admin menu dropdown data (answers { isAdmin: false } to everyone else)
  socket.on('admin_catalog', () => {
    socket.emit('admin_catalog', adminCommands.buildCatalog(gameServer, gameServer.players.get(socket.id)));
  });

  socket.on('buy_item', (data) => {
    gameServer.handleBuyItem(socket.id, data.itemId, data.count || data.quantity || 1);
  });

  socket.on('sell_item', (data) => {
    gameServer.handleSellItem(socket.id, data.itemIndex, data.quantity);
  });

  socket.on('sell_items', (data) => {
    gameServer.handleSellItems(socket.id, data && data.entries);
  });

  socket.on('equip_item', (data) => {
    gameServer.handleEquipItem(socket.id, data.itemIndex);
  });

  socket.on('unequip_item', (data) => {
    gameServer.handleUnequipItem(socket.id, data.slot);
  });

  socket.on('sp_transform', () => {
    gameServer.handleSpTransform(socket.id);
  });

  socket.on('sp_card_enhance', (data) => {
    gameServer.handleSpCardEnhance(socket.id, data);
  });

  socket.on('sp_card_exchange', (data) => {
    gameServer.handleSpCardExchange(socket.id, data);
  });

  socket.on('enhance_item', (data) => {
    gameServer.handleEnhanceItem(socket.id, data);
  });

  socket.on('reforge_item', (data) => {
    gameServer.handleReforgeItem(socket.id, data);
  });

  socket.on('open_chest', (data) => {
    gameServer.handleOpenChest(socket.id, data.chestId);
  });

  socket.on('enter_dungeon', (options) => {
    gameServer.handleEnterDungeon(socket.id, options);
  });

  socket.on('leave_dungeon', () => {
    gameServer.handleLeaveDungeon(socket.id);
  });

  socket.on('allocate_skill_point', (data) => {
    gameServer.handleAllocateSkillPoint(socket.id, data ? data.skillId : null);
  });

  socket.on('reset_skill_points', () => {
    gameServer.handleResetSkillPoints(socket.id);
  });

  socket.on('customize_skill_slot', (data) => {
    gameServer.handleCustomizeSkill(socket.id, data);
  });

  // Party System Socket Handlers
  socket.on('party_invite', (data) => {
    gameServer.handlePartyInvite(socket.id, data);
  });

  socket.on('party_accept', (data) => {
    gameServer.handlePartyAccept(socket.id, data);
  });

  socket.on('party_decline', (data) => {
    gameServer.handlePartyDecline(socket.id, data);
  });

  socket.on('party_leave', () => {
    gameServer.handlePartyLeave(socket.id);
  });

  socket.on('party_kick', (data) => {
    gameServer.handlePartyKick(socket.id, data);
  });

  socket.on('party_summon', () => {
    gameServer.handlePartySummon(socket.id);
  });

  socket.on('party_summon_accept', (data) => {
    gameServer.handlePartySummonAccept(socket.id, data);
  });

  socket.on('party_list_candidates', () => {
    gameServer.handlePartyListCandidates(socket.id);
  });

  socket.on('set_potion_slot', (data) => {
    gameServer.handleSetPotionSlot(socket.id, data);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
    gameServer.removePlayer(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`⚔️  SLOP HERO MMORPG SERVER RUNNING ON:        ⚔️`);
  console.log(`👉  http://localhost:${PORT}                   👈`);
  console.log(`===============================================`);
});
