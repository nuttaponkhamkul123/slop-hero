// server/adminCommands.js
// Slop Hero - Admin & Game Master Command Handler

import { ITEMS, generateRandomizedGear } from './items';
import * as SP from './spCards';
import { mobStats, FIELD_ZONES } from './fieldZones';
import accountManager from './accountManager';
import { UserRole } from './types';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'slopadmin';

// Helper: send system feedback message directly to a player's chat
function sendFeedback(gameServer, player, text, color = '#facc15') {
  const socket = gameServer.io.sockets.sockets.get(player.id);
  if (socket) {
    socket.emit('chat_broadcast', {
      senderId: 'system',
      senderName: 'SYSTEM',
      senderClass: 'system admin-feedback',
      text: text,
      timestamp: Date.now()
    });
  }
}

// Helper: find online player by name (case-insensitive)
function findPlayerByName(gameServer, name) {
  if (!name) return null;
  const target = name.trim().toLowerCase();
  for (const p of gameServer.players.values()) {
    if (p.name && p.name.toLowerCase() === target) return p;
  }
  return null;
}

// Helper: get mobs Map for the player's current zone/instance
function getMobsMapForPlayer(gameServer, player) {
  if (player.zone === 'town') return gameServer.townMobs;
  if (player.zone === 'dungeon') {
    const inst = gameServer.getPlayerDungeonInstance(player);
    return inst ? inst.mobs : gameServer.dungeonMobs;
  }
  const field = gameServer.fields.get(player.zone);
  return field ? field.mobs : null;
}

// Helper: check if player has admin rights (via role, account name, or character name)
function isPlayerAdmin(player) {
  if (!player) return false;
  if (player.role === 'admin') return true;
  const username = String(player.accountUsername || '').trim().toLowerCase();
  if (username === 'admin' || username === 'test') return true;
  const charName = String(player.name || '').trim().toLowerCase();
  if (charName === 'test' || charName === 'admin') return true;
  return false;
}

// Command Definitions & Documentation
export interface AdminCommandDef { usage: string; desc: string; public?: boolean; run: (gameServer: any, player: any, args: string[]) => void; [key: string]: any; }
const COMMANDS: Record<string, AdminCommandDef> = {
  help: {
    usage: '/help [command]',
    desc: 'แสดงรายชื่อคำสั่งทั้งหมด หรือวิธีใช้คำสั่งนั้นๆ',
    public: true,
    run(gameServer, player, args) {
      if (args[0]) {
        const cmd = COMMANDS[args[0].toLowerCase().replace(/^\//, '')];
        if (!cmd) return sendFeedback(gameServer, player, `❌ ไม่พบคำสั่ง /${args[0]}`);
        return sendFeedback(gameServer, player, `📖 ${cmd.usage} - ${cmd.desc}`);
      }

      const isAdmin = isPlayerAdmin(player);
      const available = Object.entries(COMMANDS)
        .filter(([, def]) => isAdmin || def.public)
        .map(([name, def]) => `${def.usage} : ${def.desc}`);

      sendFeedback(gameServer, player, `📜 รายการคำสั่งที่ใช้ได้:\n` + available.join('\n'));
      if (!isAdmin) {
        sendFeedback(gameServer, player, `💡 คำแนะนำ: พิมพ์ /op <password> เพื่อเปิดใช้งานสิทธิ์ Admin`);
      }
    }
  },

  op: {
    usage: '/op <password>',
    desc: 'เปิดใช้งานสิทธิ์ Admin ด้วยรหัสผ่าน',
    public: true,
    run(gameServer, player, args) {
      const pass = args[0];
      if (!pass || pass !== ADMIN_PASSWORD) {
        return sendFeedback(gameServer, player, `❌ รหัสผ่านไม่ถูกต้อง`);
      }

      player.role = 'admin';
      if (player.accountUsername) {
        accountManager.setRole(player.accountUsername, 'admin');
      }

      const socket = gameServer.io.sockets.sockets.get(player.id);
      if (socket) socket.emit('player_updated', player);

      sendFeedback(gameServer, player, `👑 คุณได้รับสิทธิ์ Admin เรียบร้อยแล้ว! (พิมพ์ /help เพื่อดูคำสั่งทั้งหมด)`);
    }
  },

  who: {
    usage: '/who',
    desc: 'ดูรายชื่อผู้เล่นที่ออนไลน์ทั้งหมด',
    public: true,
    run(gameServer, player) {
      const list = Array.from(gameServer.players.values()).map((p: any) => 
        `• [${p.characterClass || 'hero'}] ${p.name} (Lv.${p.level || 1}) ใน ${p.zone} @ (${Math.round(p.x)}, ${Math.round(p.y)})`
      );
      sendFeedback(gameServer, player, `👥 ผู้เล่นออนไลน์ (${list.length} คน):\n` + list.join('\n'));
    }
  },

  give: {
    usage: '/give <itemId> [count] [playerName]',
    desc: 'เสกไอเทม/เงิน/การ์ด SP ให้ตัวเองหรือผู้เล่นอื่น',
    run(gameServer, player, args) {
      if (!args[0]) {
        return sendFeedback(gameServer, player, `❌ รูปแบบ: /give <itemId> [count] [playerName] (ดูชื่อไอเทมพิมพ์ /items)`);
      }

      const rawId = args[0].toLowerCase();
      let count = parseInt(args[1], 10);
      let targetPlayer = player;

      // Check if second argument is a player name instead of count
      if (isNaN(count)) {
        count = 1;
        if (args[1]) {
          const found = findPlayerByName(gameServer, args[1]);
          if (found) targetPlayer = found;
        }
      } else if (args[2]) {
        const found = findPlayerByName(gameServer, args[2]);
        if (found) targetPlayer = found;
        else return sendFeedback(gameServer, player, `❌ ไม่พบผู้เล่นชื่อ "${args[2]}"`);
      }

      count = Math.max(1, Math.min(9999999, count));

      // 1. Give Gold
      if (rawId === 'gold') {
        targetPlayer.gold = (targetPlayer.gold || 0) + count;
        gameServer.emitZone(targetPlayer.zone, 'floating_text', {
          x: targetPlayer.x, y: targetPlayer.y - 0.6, text: `+${count} Gold`, color: '#facc15'
        });
        const targetSocket = gameServer.io.sockets.sockets.get(targetPlayer.id);
        if (targetSocket) targetSocket.emit('player_updated', targetPlayer);
        return sendFeedback(gameServer, player, `✅ เพิ่ม ${count.toLocaleString()} Gold ให้ ${targetPlayer.name} แล้ว (ยอดรวม: ${targetPlayer.gold.toLocaleString()})`);
      }

      // 2. Give Base EXP
      if (rawId === 'exp') {
        gameServer.awardExp(targetPlayer, count);
        return sendFeedback(gameServer, player, `✅ เพิ่ม ${count.toLocaleString()} EXP ให้ ${targetPlayer.name} แล้ว`);
      }

      // 3. Give Job EXP
      if (rawId === 'jobexp') {
        gameServer.awardJobExp(targetPlayer, count);
        return sendFeedback(gameServer, player, `✅ เพิ่ม ${count.toLocaleString()} Job EXP ให้ ${targetPlayer.name} แล้ว`);
      }

      // 4. Give SP Card
      const cleanCardId = rawId.startsWith('sp_card_') ? rawId.replace('sp_card_', '') : rawId;
      const spDef = SP.CARD_BY_ID[cleanCardId] || SP.CARD_BY_ID[rawId] || SP.CARD_BY_ID['sp_' + rawId];
      if (spDef) {
        if (!targetPlayer.inventory || !targetPlayer.inventory.items) {
          targetPlayer.inventory = { items: [], healthPotions: 3, manaPotions: 3 };
        }
        const maxSlots = targetPlayer.inventory.maxSlots || 30;
        if (targetPlayer.inventory.items.length >= maxSlots) {
          return sendFeedback(gameServer, player, `❌ กระเป๋าของ ${targetPlayer.name} เต็มแล้ว (${maxSlots}/${maxSlots} ช่อง)`);
        }
        const cardItem = { ...SP.makeCardItem(spDef.id), custom: true, count: 1 };
        targetPlayer.inventory.items.push(cardItem);

        gameServer.emitZone(targetPlayer.zone, 'floating_text', {
          x: targetPlayer.x, y: targetPlayer.y - 0.6, text: `+${cardItem.name}`, color: '#a855f7'
        });
        const targetSocket = gameServer.io.sockets.sockets.get(targetPlayer.id);
        if (targetSocket) targetSocket.emit('player_updated', targetPlayer);

        return sendFeedback(gameServer, player, `✅ เสกการ์ด [${cardItem.name}] ให้ ${targetPlayer.name} แล้ว`);
      }

      // 5. Normal Item / Equipment from ITEMS database
      const itemDef = ITEMS[rawId];
      if (!itemDef) {
        // Try partial match search to assist the admin
        const matches = Object.keys(ITEMS).filter(k => k.includes(rawId)).slice(0, 5);
        const matchMsg = matches.length > 0 ? ` (ใกล้เคียง: ${matches.join(', ')})` : ` (พิมพ์ /items เพื่อค้นหา)`;
        return sendFeedback(gameServer, player, `❌ ไม่พบไอเทมรหัส "${rawId}"${matchMsg}`);
      }

      if (!targetPlayer.inventory || !targetPlayer.inventory.items) {
        targetPlayer.inventory = { items: [], healthPotions: 3, manaPotions: 3 };
      }

      if (itemDef.type === 'equipment') {
        // Generate randomized gear
        for (let i = 0; i < Math.min(count, 10); i++) {
          const maxSlots = targetPlayer.inventory.maxSlots || 30;
          if (targetPlayer.inventory.items.length >= maxSlots) {
            sendFeedback(gameServer, player, `⚠️ กระเป๋าเต็ม เสกได้ ${i} ชิ้น`);
            break;
          }
          const gear = generateRandomizedGear(rawId, targetPlayer.level || 1, false);
          targetPlayer.inventory.items.push({ ...gear, count: 1 });
        }
      } else {
        // Consumable, material, relic
        gameServer.giveLootToPlayer(targetPlayer, { type: 'item', itemId: rawId, amount: count });
      }

      const targetSocket = gameServer.io.sockets.sockets.get(targetPlayer.id);
      if (targetSocket) targetSocket.emit('player_updated', targetPlayer);

      sendFeedback(gameServer, player, `✅ เสก [${itemDef.name}] x${count} ให้ ${targetPlayer.name} เรียบร้อยแล้ว`);
    }
  },

  givesp: {
    usage: '/givesp <cardId> [upgradeLevel 0-100] [playerName]',
    desc: 'เสก SP Card พร้อมเลเวลบวก (+0 ถึง +100)',
    run(gameServer, player, args) {
      if (!args[0]) {
        const availableCards = Object.keys(SP.CARD_BY_ID).join(', ');
        return sendFeedback(gameServer, player, `❌ รูปแบบ: /givesp <cardId> [upgradeLevel 0-100] [playerName]\nการ์ดที่มี: ${availableCards}`);
      }

      const rawId = args[0].toLowerCase().replace(/^sp_card_/, '');
      const spDef = SP.CARD_BY_ID[rawId] || SP.CARD_BY_ID['sp_' + rawId];
      if (!spDef) {
        return sendFeedback(gameServer, player, `❌ ไม่พบ SP Card: ${args[0]} (ดูชื่อการ์ดพิมพ์ /items sp)`);
      }

      const upgrade = Math.max(0, Math.min(SP.SP_MAX_LEVEL, parseInt(args[1], 10) || 0));
      let targetPlayer = player;
      if (args[2]) {
        const found = findPlayerByName(gameServer, args[2]);
        if (found) targetPlayer = found;
        else return sendFeedback(gameServer, player, `❌ ไม่พบผู้เล่น ${args[2]}`);
      }

      const maxSlots = targetPlayer.inventory.maxSlots || 30;
      if (targetPlayer.inventory.items.length >= maxSlots) {
        return sendFeedback(gameServer, player, `❌ กระเป๋าของ ${targetPlayer.name} เต็มแล้ว (${maxSlots}/${maxSlots} ช่อง)`);
      }

      const cardItem = { ...SP.makeCardItem(spDef.id, upgrade), custom: true, count: 1 };
      targetPlayer.inventory.items.push(cardItem);

      gameServer.emitZone(targetPlayer.zone, 'floating_text', {
        x: targetPlayer.x, y: targetPlayer.y - 0.6, text: `+${cardItem.name} +${upgrade}`, color: '#ec4899'
      });
      const targetSocket = gameServer.io.sockets.sockets.get(targetPlayer.id);
      if (targetSocket) targetSocket.emit('player_updated', targetPlayer);

      sendFeedback(gameServer, player, `✅ มอบ [${cardItem.name} +${upgrade}] ให้ ${targetPlayer.name} แล้ว`);
    }
  },

  items: {
    usage: '/items [filter]',
    desc: 'ค้นหารหัสไอเทม (itemId) ทั้งหมดในเกม',
    run(gameServer, player, args) {
      const filter = (args[0] || '').toLowerCase();
      let matched = [];

      if (filter === 'sp') {
        matched = Object.keys(SP.CARD_BY_ID).map(id => `SP: ${id} (${SP.CARD_BY_ID[id].name})`);
      } else {
        matched = Object.entries(ITEMS)
          .filter(([id, it]) => !filter || id.includes(filter) || (it.name && it.name.toLowerCase().includes(filter)))
          .slice(0, 25)
          .map(([id, it]) => `${id} [${it.name}]`);
      }

      if (matched.length === 0) {
        return sendFeedback(gameServer, player, `🔍 ไม่พบไอเทมที่ตรงกับ "${filter}"`);
      }

      sendFeedback(gameServer, player, `📦 รายการไอเทม (${matched.length} รายการ):\n` + matched.join(', '));
    }
  },

  god: {
    usage: '/god',
    desc: 'เปิด/ปิด โหมดอมตะ (God Mode)',
    run(gameServer, player) {
      player.godMode = !player.godMode;
      const status = player.godMode ? '🟢 เปิด (ON)' : '🔴 ปิด (OFF)';
      gameServer.emitZone(player.zone, 'floating_text', {
        x: player.x, y: player.y - 0.7, text: `God Mode: ${player.godMode ? 'ON' : 'OFF'}`, color: '#facc15'
      });
      sendFeedback(gameServer, player, `🛡️ โหมดอมตะ (God Mode): ${status}`);
    }
  },

  heal: {
    usage: '/heal [playerName]',
    desc: 'ฟื้นฟูเลือด (HP) และมานา (MP) เต็มหลอดทันที',
    run(gameServer, player, args) {
      let target = player;
      if (args[0]) {
        target = findPlayerByName(gameServer, args[0]);
        if (!target) return sendFeedback(gameServer, player, `❌ ไม่พบผู้เล่น ${args[0]}`);
      }

      target.hp = target.maxHp;
      target.mp = target.maxMp;
      target.isDead = false;

      gameServer.emitZone(target.zone, 'floating_text', {
        x: target.x, y: target.y - 0.7, text: `💚 FULL HEAL!`, color: '#22c55e', size: 16
      });
      const targetSocket = gameServer.io.sockets.sockets.get(target.id);
      if (targetSocket) targetSocket.emit('player_updated', target);

      sendFeedback(gameServer, player, `✨ ฟื้นฟู HP & MP ให้ ${target.name} เรียบร้อยแล้ว`);
    }
  },

  setlevel: {
    usage: '/setlevel <level 1-100> [playerName]',
    desc: 'ปรับระดับเลเวลตัวละคร (Base Level)',
    run(gameServer, player, args) {
      const lvl = parseInt(args[0], 10);
      if (isNaN(lvl) || lvl < 1 || lvl > 100) {
        return sendFeedback(gameServer, player, `❌ ระบุเลเวล 1 - 100`);
      }

      let target = player;
      if (args[1]) {
        target = findPlayerByName(gameServer, args[1]);
        if (!target) return sendFeedback(gameServer, player, `❌ ไม่พบผู้เล่น ${args[1]}`);
      }

      target.level = lvl;
      target.exp = 0;
      target.skillPoints = Math.max(0, lvl - 1);
      gameServer.recalculatePlayerStats(target);
      target.hp = target.maxHp;
      target.mp = target.maxMp;

      gameServer.emitZone(target.zone, 'floating_text', {
        x: target.x, y: target.y - 0.7, text: `⭐ Level Set to ${lvl}!`, color: '#facc15', size: 18
      });
      const targetSocket = gameServer.io.sockets.sockets.get(target.id);
      if (targetSocket) {
        targetSocket.emit('player_updated', target);
        targetSocket.emit('level_up', { level: lvl, maxHp: target.maxHp, maxMp: target.maxMp, dmg: target.dmg, def: target.def });
      }

      sendFeedback(gameServer, player, `✅ ปรับเลเวลของ ${target.name} เป็น Lv.${lvl} แล้ว`);
    }
  },

  setjoblevel: {
    usage: '/setjoblevel <level 1-60> [playerName]',
    desc: 'ปรับระดับ Job Level (สำหรับ SP Cards)',
    run(gameServer, player, args) {
      const lvl = parseInt(args[0], 10);
      if (isNaN(lvl) || lvl < 1 || lvl > SP.JOB_MAX_LEVEL) {
        return sendFeedback(gameServer, player, `❌ ระบุ Job Level 1 - ${SP.JOB_MAX_LEVEL}`);
      }

      let target = player;
      if (args[1]) {
        target = findPlayerByName(gameServer, args[1]);
        if (!target) return sendFeedback(gameServer, player, `❌ ไม่พบผู้เล่น ${args[1]}`);
      }

      target.jobLevel = lvl;
      target.jobExp = 0;
      target.jobExpNext = SP.jobExpToNext(lvl);
      gameServer.recalculatePlayerStats(target);

      gameServer.emitZone(target.zone, 'floating_text', {
        x: target.x, y: target.y - 0.7, text: `🌟 Job Level Set to ${lvl}!`, color: '#38bdf8', size: 16
      });
      const targetSocket = gameServer.io.sockets.sockets.get(target.id);
      if (targetSocket) targetSocket.emit('player_updated', target);

      sendFeedback(gameServer, player, `✅ ปรับ Job Level ของ ${target.name} เป็น Job Lv.${lvl} แล้ว`);
    }
  },

  addgold: {
    usage: '/addgold <amount> [playerName]',
    desc: 'เพิ่มเงิน Gold ให้ตัวละคร',
    run(gameServer, player, args) {
      COMMANDS.give.run(gameServer, player, ['gold', args[0], args[1]]);
    }
  },

  addexp: {
    usage: '/addexp <amount> [playerName]',
    desc: 'เพิ่มค่าประสบการณ์ Base EXP',
    run(gameServer, player, args) {
      COMMANDS.give.run(gameServer, player, ['exp', args[0], args[1]]);
    }
  },

  addjobexp: {
    usage: '/addjobexp <amount> [playerName]',
    desc: 'เพิ่มค่าประสบการณ์ Job EXP',
    run(gameServer, player, args) {
      COMMANDS.give.run(gameServer, player, ['jobexp', args[0], args[1]]);
    }
  },

  tp: {
    usage: '/tp <playerName>',
    desc: 'วาร์ปตัวเราไปหาผู้เล่นเป้าหมาย',
    run(gameServer, player, args) {
      if (!args[0]) return sendFeedback(gameServer, player, `❌ รูปแบบ: /tp <playerName>`);
      const target = findPlayerByName(gameServer, args[0]);
      if (!target) return sendFeedback(gameServer, player, `❌ ไม่พบผู้เล่น ${args[0]}`);

      const socket = gameServer.io.sockets.sockets.get(player.id);
      if (player.zone !== target.zone) {
        if (target.zone === 'town') {
          gameServer.teleportPlayerToTown(player, socket, { x: target.x, y: target.y });
        } else if (target.zone === 'dungeon') {
          const inst = gameServer.getPlayerDungeonInstance(target);
          if (inst) gameServer.teleportPlayerToDungeon(player, socket, inst, { x: target.x, y: target.y });
        } else {
          gameServer.teleportPlayerToField(player, socket, target.zone, 'south', { x: target.x, y: target.y });
        }
      } else {
        player.x = target.x;
        player.y = target.y;
        player.targetX = null;
        player.targetY = null;
        if (socket) socket.emit('player_updated', player);
      }

      sendFeedback(gameServer, player, `🌀 วาร์ปไปหา ${target.name} ณ ${target.zone} (${Math.round(target.x)}, ${Math.round(target.y)}) แล้ว`);
    }
  },

  bring: {
    usage: '/bring <playerName>',
    desc: 'ดึงผู้เล่นเป้าหมายมายังตำแหน่งที่เรายืนอยู่',
    run(gameServer, player, args) {
      if (!args[0]) return sendFeedback(gameServer, player, `❌ รูปแบบ: /bring <playerName>`);
      const target = findPlayerByName(gameServer, args[0]);
      if (!target) return sendFeedback(gameServer, player, `❌ ไม่พบผู้เล่น ${args[0]}`);

      const targetSocket = gameServer.io.sockets.sockets.get(target.id);
      if (target.zone !== player.zone) {
        if (player.zone === 'town') {
          gameServer.teleportPlayerToTown(target, targetSocket, { x: player.x, y: player.y });
        } else if (player.zone === 'dungeon') {
          const inst = gameServer.getPlayerDungeonInstance(player);
          if (inst) gameServer.teleportPlayerToDungeon(target, targetSocket, inst, { x: player.x, y: player.y });
        } else {
          gameServer.teleportPlayerToField(target, targetSocket, player.zone, 'south', { x: player.x, y: player.y });
        }
      } else {
        target.x = player.x;
        target.y = player.y;
        target.targetX = null;
        target.targetY = null;
        if (targetSocket) targetSocket.emit('player_updated', target);
      }

      sendFeedback(gameServer, player, `🌀 ดึงตัว ${target.name} มายังตำแหน่งของคุณแล้ว`);
    }
  },

  warp: {
    usage: '/warp <zone>',
    desc: 'วาร์ปไปยังโซนต่างๆ เช่น town, frostfell, meadow, wildwood, dungeon',
    run(gameServer, player, args) {
      const zoneId = (args[0] || '').toLowerCase();
      const socket = gameServer.io.sockets.sockets.get(player.id);
      if (!zoneId) {
        const zones = ['town', 'dungeon', ...Array.from(gameServer.fields.keys())].join(', ');
        return sendFeedback(gameServer, player, `❌ ระบุชื่อโซน: ${zones}`);
      }

      if (zoneId === 'town') {
        gameServer.teleportPlayerToTown(player, socket);
      } else if (zoneId === 'dungeon') {
        gameServer.handleEnterDungeon(player.id, { floor: 1, difficulty: 'normal' });
      } else if (gameServer.fields.has(zoneId)) {
        gameServer.teleportPlayerToField(player, socket, zoneId, 'south');
      } else {
        const available = ['town', 'dungeon', ...Array.from(gameServer.fields.keys())].join(', ');
        return sendFeedback(gameServer, player, `❌ ไม่พบโซน "${zoneId}" (ที่มี: ${available})`);
      }

      sendFeedback(gameServer, player, `🧭 วาร์ปไปยังโซน ${zoneId} แล้ว`);
    }
  },

  goto: {
    usage: '/goto <x> <y>',
    desc: 'วาร์ปไปยังพิกัด x y ในแผนที่ปัจจุบัน',
    run(gameServer, player, args) {
      const x = parseFloat(args[0]);
      const y = parseFloat(args[1]);
      if (isNaN(x) || isNaN(y)) {
        return sendFeedback(gameServer, player, `❌ รูปแบบ: /goto <x> <y> เช่น /goto 21 21`);
      }

      player.x = x;
      player.y = y;
      player.targetX = null;
      player.targetY = null;

      const socket = gameServer.io.sockets.sockets.get(player.id);
      if (socket) socket.emit('player_updated', player);

      sendFeedback(gameServer, player, `📍 วาร์ปไปยังพิกัด (${x}, ${y}) แล้ว`);
    }
  },

  speed: {
    usage: '/speed <multiplier 0.5 - 5.0>',
    desc: 'ปรับความเร็วการเดินของตัวละคร',
    run(gameServer, player, args) {
      const spd = parseFloat(args[0]);
      if (isNaN(spd) || spd < 0.5 || spd > 10) {
        return sendFeedback(gameServer, player, `❌ ระบุความเร็ว 0.5 ถึง 10.0 (ปกติคือ 1.0)`);
      }

      gameServer.recalculatePlayerStats(player);
      player.speed = player.speed * spd;

      const socket = gameServer.io.sockets.sockets.get(player.id);
      if (socket) socket.emit('player_updated', player);

      sendFeedback(gameServer, player, `⚡ ปรับความเร็วเดินเป็น ${spd}x (${player.speed.toFixed(1)})`);
    }
  },

  spawn: {
    usage: '/spawn <mobType> [count 1-20] [boss]',
    desc: 'เสกมอนสเตอร์หรือบอสในพิกัดปัจจุบัน',
    run(gameServer, player, args) {
      const mobType = (args[0] || 'slime').toLowerCase();
      const count = Math.max(1, Math.min(20, parseInt(args[1], 10) || 1));
      const isBoss = args[2] === 'boss' || args[1] === 'boss';

      const mobsMap = getMobsMapForPlayer(gameServer, player);
      if (!mobsMap) return sendFeedback(gameServer, player, `❌ ไม่สามารถเสกมอนสเตอร์ในโซนนี้ได้`);

      const lvl = player.level || 1;
      const stats = mobStats(lvl, isBoss);

      for (let i = 0; i < count; i++) {
        const id = `admin_mob_${gameServer.nextEntityId++}`;
        const jitterX = (Math.random() - 0.5) * 1.5;
        const jitterY = (Math.random() - 0.5) * 1.5;
        const mob = {
          id,
          type: mobType,
          name: (isBoss ? '👑 Boss ' : '') + mobType.charAt(0).toUpperCase() + mobType.slice(1),
          level: lvl,
          x: player.x + jitterX,
          y: player.y + jitterY,
          spawnX: player.x + jitterX,
          spawnY: player.y + jitterY,
          zone: player.zone,
          fieldZone: player.zone,
          isBoss,
          hp: stats.maxHp,
          maxHp: stats.maxHp,
          dmg: stats.dmg,
          def: stats.def,
          speed: isBoss ? 2.8 : 2.5,
          exp: stats.exp,
          gold: stats.gold,
          state: 'idle',
          facing: 'S',
          attackCooldown: 1.0,
          buffs: [],
          targetPlayerId: null,
          respawnTimer: 0
        };
        mobsMap.set(id, mob);
      }

      sendFeedback(gameServer, player, `👾 เสก [${mobType}] ${isBoss ? '(บอส) ' : ''}จำนวน ${count} ตัว ณ จุดนี้เรียบร้อยแล้ว`);
    }
  },

  killall: {
    usage: '/killall [radius]',
    desc: 'กำจัดมอนสเตอร์ทั้งหมดในแผนที่หรือในรัศมีที่กำหนด',
    run(gameServer, player, args) {
      const radius = parseFloat(args[0]) || 0;
      const mobsMap = getMobsMapForPlayer(gameServer, player);
      if (!mobsMap) return sendFeedback(gameServer, player, `❌ ไม่พบมอนสเตอร์ในโซนนี้`);

      let count = 0;
      for (const mob of (Array.from(mobsMap.values()) as any[])) {
        if (mob.state === 'dead') continue;
        if (radius > 0) {
          const dist = Math.hypot(mob.x - player.x, mob.y - player.y);
          if (dist > radius) continue;
        }
        gameServer.handleMobDeath(mob, player);
        count++;
      }

      sendFeedback(gameServer, player, `💥 กำจัดมอนสเตอร์ไปทั้งหมด ${count} ตัว`);
    }
  },

  clearinv: {
    usage: '/clearinv [playerName]',
    desc: 'ล้างช่องเก็บของทั้งหมด (Inventory Clear)',
    run(gameServer, player, args) {
      let target = player;
      if (args[0]) {
        target = findPlayerByName(gameServer, args[0]);
        if (!target) return sendFeedback(gameServer, player, `❌ ไม่พบผู้เล่น ${args[0]}`);
      }

      if (target.inventory) {
        target.inventory.items = [];
        target.inventory.healthPotions = 0;
        target.inventory.manaPotions = 0;
      }

      const socket = gameServer.io.sockets.sockets.get(target.id);
      if (socket) socket.emit('player_updated', target);

      sendFeedback(gameServer, player, `🧹 ล้างกระเป๋าของ ${target.name} เรียบร้อยแล้ว`);
    }
  },

  announce: {
    usage: '/announce <message> หรือ /b <message>',
    desc: 'ประกาศข้อความระบบตัวใหญ่ให้ทุกคนในเซิร์ฟเวอร์เห็น',
    run(gameServer, player, args) {
      const msg = args.join(' ').trim();
      if (!msg) return sendFeedback(gameServer, player, `❌ โปรดระบุข้อความ`);

      gameServer.broadcastSystemMessage(`📢 [ประกาศ]: ${msg}`);
      gameServer.io.emit('floating_text', {
        x: player.x, y: player.y - 1.2, text: `📢 ${msg}`, color: '#facc15', size: 22
      });

      sendFeedback(gameServer, player, `✅ ส่งประกาศระบบแล้ว: "${msg}"`);
    }
  },

  b: {
    usage: '/b <message>',
    desc: 'คำสั่งลัดสำหรับ /announce',
    run(gameServer, player, args) {
      COMMANDS.announce.run(gameServer, player, args);
    }
  },

  kick: {
    usage: '/kick <playerName> [reason]',
    desc: 'เตะผู้เล่นออกจากเซิร์ฟเวอร์',
    run(gameServer, player, args) {
      if (!args[0]) return sendFeedback(gameServer, player, `❌ รูปแบบ: /kick <playerName> [reason]`);
      const target = findPlayerByName(gameServer, args[0]);
      if (!target) return sendFeedback(gameServer, player, `❌ ไม่พบผู้เล่น ${args[0]}`);

      const reason = args.slice(1).join(' ') || 'ถูกเตะโดยผู้ดูแลระบบ';
      const socket = gameServer.io.sockets.sockets.get(target.id);

      if (socket) {
        socket.emit('chat_broadcast', {
          senderId: 'system',
          senderName: 'SYSTEM',
          senderClass: 'system',
          text: `⚠️ คุณถูกเตะออกจากเกม: ${reason}`,
          timestamp: Date.now()
        });
        socket.disconnect(true);
      }

      gameServer.broadcastSystemMessage(`🚪 [${target.name}] ถูกเตะออกจากเซิร์ฟเวอร์ (${reason})`);
      sendFeedback(gameServer, player, `✅ เตะผู้เล่น ${target.name} เรียบร้อยแล้ว`);
    }
  },

  role: {
    usage: '/role <username> <admin|player>',
    desc: 'แต่งตั้งหรือถอดถอนสิทธิ์ผู้ใช้ในระบบ',
    run(gameServer, player, args) {
      const targetUsername = args[0];
      const newRole = (args[1] || '').toLowerCase();
      if (!targetUsername || !['admin', 'player'].includes(newRole)) {
        return sendFeedback(gameServer, player, `❌ รูปแบบ: /role <username> <admin|player>`);
      }

      const ok = accountManager.setRole(targetUsername, newRole as UserRole);
      if (!ok) return sendFeedback(gameServer, player, `❌ ไม่พบบัญชี "${targetUsername}" หรือบันทึกไม่สำเร็จ`);

      // Update online player role immediately if currently connected
      for (const p of gameServer.players.values()) {
        if (p.accountUsername && p.accountUsername.toLowerCase() === targetUsername.toLowerCase()) {
          p.role = newRole;
          const socket = gameServer.io.sockets.sockets.get(p.id);
          if (socket) socket.emit('player_updated', p);
        }
      }

      sendFeedback(gameServer, player, `✅ อัปเดตสิทธิ์ของ "${targetUsername}" เป็น [${newRole}] แล้ว`);
    }
  },

  saveall: {
    usage: '/saveall',
    desc: 'บันทึกข้อมูลตัวละครของผู้เล่นทุกคนลงเซิร์ฟเวอร์ทันที',
    run(gameServer, player) {
      let count = 0;
      for (const socketId of gameServer.players.keys()) {
        gameServer.savePlayerAccount(socketId);
        count++;
      }
      sendFeedback(gameServer, player, `💾 บันทึกข้อมูลตัวละครสำเร็จ (${count} คน)`);
    }
  }
};

// Mob bodies the client can draw (for /spawn)
const MOB_TYPES = ['slime', 'goblin', 'skeleton', 'golem', 'frost_wolf', 'ice_elemental', 'frost_titan'];

// Dropdown data for the in-game admin menu. Non-admins only learn that they aren't one.
function buildCatalog(gameServer, player) {
  if (!isPlayerAdmin(player)) return { isAdmin: false };
  if (player.role !== 'admin') player.role = 'admin';
  return {
    isAdmin: true,
    items: Object.entries(ITEMS).map(([id, it]: [string, any]) => ({ id, name: it.name, slot: it.slot || it.type, rarity: it.rarity })),
    cards: Object.values(SP.CARD_BY_ID as Record<string, any>).map((c: any) => ({ id: c.id, name: c.name, cls: c.cls, tier: c.tier })),
    zones: ['town', 'dungeon', ...gameServer.fields.keys()],
    mobTypes: MOB_TYPES,
    players: [...gameServer.players.values()].map((p: any) => ({ name: p.name, level: p.level || 1, zone: p.zone })),
    godMode: !!player.godMode
  };
}

// Main Command Dispatcher
function handleCommand(gameServer, player, rawText) {
  if (!rawText || !rawText.startsWith('/')) return false;

  const parts = rawText.slice(1).trim().split(/\s+/);
  const cmdName = parts[0].toLowerCase();
  const args = parts.slice(1);

  const isAdmin = isPlayerAdmin(player);
  if (isAdmin && player.role !== 'admin') {
    player.role = 'admin';
  }

  const command = COMMANDS[cmdName];
  if (!command) {
    // If it's a slash command but not registered, send feedback if admin, or let it fall through
    if (isAdmin) {
      sendFeedback(gameServer, player, `❌ ไม่รู้จักคำสั่ง "/${cmdName}" พิมพ์ /help เพื่อดูคำสั่งทั้งหมด`);
      return true;
    }
    return false;
  }

  // Permission Check
  if (!command.public && !isAdmin) {
    sendFeedback(gameServer, player, `⛔ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้ (ใช้ /op <password> หากมีรหัสแอดมิน)`);
    return true;
  }

  try {
    command.run(gameServer, player, args);
  } catch (err) {
    console.error(`[AdminCommand Error] /${cmdName}:`, err);
    sendFeedback(gameServer, player, `⚠️ เกิดข้อผิดพลาดในการรันคำสั่ง: ${err.message}`);
  }

  return true;
}

export { handleCommand, buildCatalog, COMMANDS, ADMIN_PASSWORD };
module.exports = {
  handleCommand,
  buildCatalog,
  COMMANDS,
  ADMIN_PASSWORD
};




