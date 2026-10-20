const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const GameServer = require('./gameServer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Initialize Game Engine
const gameServer = new GameServer(io);

// Handle WebSockets
io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  socket.on('join_game', (data) => {
    gameServer.addPlayer(socket, data);
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

  socket.on('pickup_item', (itemId) => {
    gameServer.handlePickupItem(socket.id, itemId);
  });

  socket.on('send_chat', (message) => {
    gameServer.handleChatMessage(socket.id, message);
  });

  socket.on('buy_item', (data) => {
    gameServer.handleBuyItem(socket.id, data.itemId);
  });

  socket.on('sell_item', (data) => {
    gameServer.handleSellItem(socket.id, data.itemIndex);
  });

  socket.on('equip_item', (data) => {
    gameServer.handleEquipItem(socket.id, data.itemIndex);
  });

  socket.on('unequip_item', (data) => {
    gameServer.handleUnequipItem(socket.id, data.slot);
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
