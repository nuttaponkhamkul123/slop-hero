import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server, Socket } from 'socket.io';
import GameServer from './gameServer';
import * as adminCommands from './adminCommands';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

process.on('uncaughtException', (err: Error) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason: any) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

const PORT = process.env.PORT || 3000;

// Resolve root directory correctly in both tsx dev and dist/ production
const rootDir = fs.existsSync(path.resolve(process.cwd(), 'public'))
  ? process.cwd()
  : path.resolve(__dirname, '..');
const publicDir = path.resolve(rootDir, 'public');

// Serve static frontend files
app.use(express.static(publicDir));

// Explicit route to serve city.wav music file
app.get('/city.wav', (_req: Request, res: Response) => {
  const cityPath = path.resolve(rootDir, 'city.wav');
  if (fs.existsSync(cityPath)) {
    res.sendFile(cityPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// Explicit route to serve dunjion.wav music file for dungeon zone
app.get(['/dunjion.wav', '/dungeon.wav', '/dunjion'], (_req: Request, res: Response) => {
  const dungeonPath = path.resolve(rootDir, 'dunjion.wav');
  if (fs.existsSync(dungeonPath)) {
    res.sendFile(dungeonPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// Explicit route to serve login.wav music file for the login screen
app.get('/login.wav', (_req: Request, res: Response) => {
  const loginPath = path.resolve(rootDir, 'login.wav');
  if (fs.existsSync(loginPath)) {
    res.sendFile(loginPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// Explicit route to serve frosfell.wav music file for the Frostfell zone
app.get(['/frosfell.wav', '/frostfell.wav'], (_req: Request, res: Response) => {
  const frostfellPath = path.resolve(rootDir, 'frosfell.wav');
  if (fs.existsSync(frostfellPath)) {
    res.sendFile(frostfellPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// Explicit route to serve "shadowfell ruins.wav" music file for the Shadowfell zone
app.get('/shadowfell-ruins.wav', (_req: Request, res: Response) => {
  const shadowfellPath = path.resolve(rootDir, 'shadowfell ruins.wav');
  if (fs.existsSync(shadowfellPath)) {
    res.sendFile(shadowfellPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// Explicit route to serve wildwood.wav music file for the Verdant Wildwood zone
app.get('/wildwood.wav', (_req: Request, res: Response) => {
  const wildwoodPath = path.resolve(rootDir, 'wildwood.wav');
  if (fs.existsSync(wildwoodPath)) {
    res.sendFile(wildwoodPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// Explicit route to serve celestial.wav music file for the Celestial Reach zone
app.get('/celestial.wav', (_req: Request, res: Response) => {
  const celestialPath = path.resolve(rootDir, 'celestial.wav');
  if (fs.existsSync(celestialPath)) {
    res.sendFile(celestialPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// Initialize Game Engine
const gameServer = new GameServer(io);

// Handle WebSockets
io.on('connection', (socket: Socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // Every handler runs in the context of the sender's dungeon instance, so
  // zone-wide emits and lookups from inside a dungeon stay in that instance.
  const rawOn = socket.on.bind(socket);
  socket.on = (event: string, handler: (...args: any[]) => void): Socket =>
    rawOn(event, (...args: any[]) => (gameServer as any).runAs(socket.id, () => handler(...args)));

  socket.on('account_register', (data: any) => {
    gameServer.handleAccountRegister(socket, data);
  });

  socket.on('account_login', (data: any) => {
    gameServer.handleAccountLogin(socket, data);
  });

  socket.on('create_character', (data: any) => {
    gameServer.handleCreateCharacter(socket, data);
  });

  socket.on('delete_character', (data: any) => {
    gameServer.handleDeleteCharacter(socket, data);
  });

  socket.on('join_game', (data: any) => {
    gameServer.addPlayer(socket, data);
  });

  socket.on('use_revival_stone', (data: any) => {
    gameServer.handleUseRevivalStone(socket.id, !!(data && data.super));
  });

  socket.on('player_input', (input: any) => {
    gameServer.handlePlayerInput(socket.id, input);
  });

  socket.on('player_attack', (targetInfo: any) => {
    gameServer.handlePlayerAttack(socket.id, targetInfo);
  });

  socket.on('player_skill', (skillData: any) => {
    gameServer.handlePlayerSkill(socket.id, skillData);
  });

  socket.on('use_potion', (potionType: any) => {
    gameServer.handleUsePotion(socket.id, potionType);
  });

  socket.on('use_portal', () => {
    gameServer.handleUsePortal(socket.id);
  });

  socket.on('pickup_item', (itemId: any) => {
    gameServer.handlePickupItem(socket.id, itemId);
  });

  socket.on('send_chat', (message: any) => {
    gameServer.handleChatMessage(socket.id, message);
  });

  // Admin menu dropdown data (answers { isAdmin: false } to everyone else)
  socket.on('admin_catalog', () => {
    socket.emit('admin_catalog', adminCommands.buildCatalog(gameServer, (gameServer as any).players.get(socket.id)));
  });

  socket.on('buy_item', (data: any) => {
    gameServer.handleBuyItem(socket.id, data.itemId, data.count || data.quantity || 1);
  });

  socket.on('sell_item', (data: any) => {
    gameServer.handleSellItem(socket.id, data.itemIndex, data.quantity);
  });

  socket.on('sell_items', (data: any) => {
    gameServer.handleSellItems(socket.id, data && data.entries);
  });

  socket.on('equip_item', (data: any) => {
    gameServer.handleEquipItem(socket.id, data.itemIndex);
  });

  socket.on('unequip_item', (data: any) => {
    gameServer.handleUnequipItem(socket.id, data.slot);
  });

  socket.on('sp_transform', () => {
    gameServer.handleSpTransform(socket.id);
  });

  socket.on('sp_card_enhance', (data: any) => {
    gameServer.handleSpCardEnhance(socket.id, data);
  });

  socket.on('sp_card_exchange', (data: any) => {
    gameServer.handleSpCardExchange(socket.id, data);
  });

  socket.on('enhance_item', (data: any) => {
    gameServer.handleEnhanceItem(socket.id, data);
  });

  socket.on('reforge_item', (data: any) => {
    gameServer.handleReforgeItem(socket.id, data);
  });
  socket.on('socket_rune', (data: any) => {
    gameServer.handleSocketRune(socket.id, data);
  });

  socket.on('unsocket_rune', (data: any) => {
    gameServer.handleUnsocketRune(socket.id, data);
  });

  socket.on('expand_socket', (data: any) => {
    gameServer.handleExpandSocket(socket.id, data);
  });

  socket.on('use_bag_expander', (data: any) => {
    gameServer.handleUseBagExpander(socket.id, data);
  });

  socket.on('open_personal_chest', () => {
    gameServer.handleOpenPersonalChest(socket.id);
  });

  socket.on('deposit_to_chest', (data: any) => {
    gameServer.handleDepositToChest(socket.id, data);
  });

  socket.on('withdraw_from_chest', (data: any) => {
    gameServer.handleWithdrawFromChest(socket.id, data);
  });

  socket.on('use_chest_expander', (data: any) => {
    gameServer.handleUseChestExpander(socket.id, data);
  });

  socket.on('open_chest', (data: any) => {
    gameServer.handleOpenChest(socket.id, data.chestId);
  });

  socket.on('enter_dungeon', (options: any) => {
    gameServer.handleEnterDungeon(socket.id, options);
  });

  socket.on('leave_dungeon', () => {
    gameServer.handleLeaveDungeon(socket.id);
  });

  socket.on('allocate_skill_point', (data: any) => {
    gameServer.handleAllocateSkillPoint(socket.id, data ? data.skillId : null);
  });

  socket.on('reset_skill_points', () => {
    gameServer.handleResetSkillPoints(socket.id);
  });

  socket.on('customize_skill_slot', (data: any) => {
    gameServer.handleCustomizeSkill(socket.id, data);
  });

  // Party System Socket Handlers
  socket.on('party_invite', (data: any) => {
    gameServer.handlePartyInvite(socket.id, data);
  });

  socket.on('party_accept', (data: any) => {
    gameServer.handlePartyAccept(socket.id, data);
  });

  socket.on('party_decline', (data: any) => {
    gameServer.handlePartyDecline(socket.id, data);
  });

  socket.on('party_leave', () => {
    gameServer.handlePartyLeave(socket.id);
  });

  socket.on('party_kick', (data: any) => {
    gameServer.handlePartyKick(socket.id, data);
  });

  socket.on('party_summon', () => {
    gameServer.handlePartySummon(socket.id);
  });

  socket.on('party_summon_accept', (data: any) => {
    gameServer.handlePartySummonAccept(socket.id, data);
  });

  socket.on('party_list_candidates', () => {
    gameServer.handlePartyListCandidates(socket.id);
  });

  socket.on('set_potion_slot', (data: any) => {
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

export { app, server, io, gameServer };

