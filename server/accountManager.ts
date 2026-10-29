import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UserRole } from './types';

// Check local directory or root project server/data directory
const DATA_DIR = process.env.DATA_DIR || (
  fs.existsSync(path.join(__dirname, 'data')) 
    ? path.join(__dirname, 'data') 
    : path.join(process.cwd(), 'server', 'data')
);
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const MAX_CHARACTERS = 10;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const ROLES: UserRole[] = ['player', 'admin'];

// Accounts that start as admin; extend via ADMIN_USERNAMES=alice,bob
const DEFAULT_ADMINS = (process.env.ADMIN_USERNAMES || 'admin,test')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

export interface CharacterSummary {
  slot: number;
  name: string;
  characterClass: string;
  level: number;
  jobLevel: number;
  gold: number;
  savedAt: number | null;
}

export interface AccountPayload {
  username: string;
  role: UserRole;
  characters: CharacterSummary[];
  maxCharacters: number;
}

export interface AccountRecord {
  username: string;
  salt: string;
  passwordHash: string;
  createdAt: number;
  lastLogin: number;
  role: UserRole;
  characters: any[];
  character?: any;
}

export class AccountManager {
  public accounts: Record<string, AccountRecord>;
  public sessions: Map<string, { key: string; expiresAt: number }>;

  constructor() {
    this.accounts = {};
    this.sessions = new Map(); // token -> { key, expiresAt }
    this.init();
  }

  // Older accounts stored a single `character`; they now hold a list
  normalize(account: AccountRecord): AccountRecord {
    if (!account.characters) {
      account.characters = account.character ? [account.character] : [];
      delete account.character;
    }
    if (!ROLES.includes(account.role)) {
      account.role = DEFAULT_ADMINS.includes(String(account.username || '').toLowerCase()) ? 'admin' : 'player';
    }
    return account;
  }

  roleFor(username?: string): UserRole {
    const u = String(username || '').trim().toLowerCase();
    if (u === 'admin' || u === 'test') return 'admin';
    const acc = username && this.accounts[u];
    return acc ? this.normalize(acc).role : 'player';
  }

  setRole(username: string, role: UserRole): boolean {
    const acc = username && this.accounts[String(username).trim().toLowerCase()];
    if (!acc || !ROLES.includes(role)) return false;
    acc.role = role;
    this.saveAccounts();
    return true;
  }

  // Session token handed out at login/register; join_game must present it
  issueToken(key: string): string {
    const token = crypto.randomBytes(24).toString('hex');
    this.sessions.set(token, { key, expiresAt: Date.now() + SESSION_TTL_MS });
    return token;
  }

  usernameForToken(token?: string): string | null {
    const s = token && this.sessions.get(token);
    if (!s) return null;
    if (Date.now() > s.expiresAt) {
      this.sessions.delete(token);
      return null;
    }
    return this.accounts[s.key] ? this.accounts[s.key].username : null;
  }

  summaries(key: string): CharacterSummary[] {
    const acc = this.accounts[key];
    if (!acc) return [];
    return this.normalize(acc).characters.map((c, slot) => ({
      slot,
      name: c.name,
      characterClass: c.characterClass,
      level: c.level || 1,
      jobLevel: c.jobLevel || 1,
      gold: c.gold || 0,
      savedAt: c.savedAt || null
    }));
  }

  accountPayload(key: string): AccountPayload {
    const acc = this.accounts[key];
    return {
      username: acc.username,
      role: this.normalize(acc).role,
      characters: this.summaries(key),
      maxCharacters: MAX_CHARACTERS
    };
  }

  isNameTaken(name?: string): boolean {
    const n = String(name || '').trim().toLowerCase();
    return Object.values(this.accounts).some(acc =>
      this.normalize(acc).characters.some(c => (c.name || '').toLowerCase() === n)
    );
  }

  createCharacter(username: string, characterData: any): { success: boolean; message?: string; account?: AccountPayload } {
    const key = String(username || '').trim().toLowerCase();
    const acc = this.accounts[key];
    if (!acc) return { success: false, message: 'ไม่พบบัญชีผู้ใช้' };
    this.normalize(acc);
    if (acc.characters.length >= MAX_CHARACTERS) return { success: false, message: `สร้างตัวละครได้สูงสุด ${MAX_CHARACTERS} ตัวต่อบัญชี` };
    if (this.isNameTaken(characterData.name)) return { success: false, message: 'ชื่อตัวละครนี้ถูกใช้แล้ว' };
    acc.characters.push(characterData);
    this.saveAccounts();
    return { success: true, account: this.accountPayload(key) };
  }

  deleteCharacter(username: string, slot: number): { success: boolean; message?: string; account?: AccountPayload } {
    const key = String(username || '').trim().toLowerCase();
    const acc = this.accounts[key];
    if (!acc) return { success: false, message: 'ไม่พบบัญชีผู้ใช้' };
    this.normalize(acc);
    if (!Number.isInteger(slot) || !acc.characters[slot]) return { success: false, message: 'ไม่พบตัวละคร' };
    acc.characters.splice(slot, 1);
    this.saveAccounts();
    return { success: true, account: this.accountPayload(key) };
  }

  init(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(ACCOUNTS_FILE)) {
        const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
        this.accounts = JSON.parse(raw);
        for (const acc of Object.values(this.accounts)) this.normalize(acc);
        console.log(`[AccountManager] Loaded ${Object.keys(this.accounts).length} accounts.`);
      } else {
        this.saveAccounts();
      }
    } catch (err) {
      console.error('[AccountManager] Error initializing accounts:', err);
      this.accounts = {};
    }
  }

  saveAccounts(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(this.accounts, null, 2), 'utf-8');
    } catch (err) {
      console.error('[AccountManager] Error saving accounts:', err);
    }
  }

  hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  }

  register(username: string, password: string, characterData: any = null): {
    success: boolean;
    message?: string;
    username?: string;
    token?: string;
    account?: AccountPayload;
  } {
    if (!username || !password) {
      return { success: false, message: 'กรุณากรอก Username และ Password' };
    }

    const cleanUsername = username.trim();
    const key = cleanUsername.toLowerCase();

    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      return { success: false, message: 'Username ต้องมีความยาว 3 - 20 ตัวอักษร' };
    }

    if (password.length < 4) {
      return { success: false, message: 'Password ต้องมีความยาวอย่างน้อย 4 ตัวอักษร' };
    }

    if (this.accounts[key]) {
      return { success: false, message: 'Username นี้ถูกใช้งานแล้ว กรุณาเลือกชื่ออื่น' };
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);

    this.accounts[key] = {
      username: cleanUsername,
      salt,
      passwordHash,
      createdAt: Date.now(),
      lastLogin: Date.now(),
      role: DEFAULT_ADMINS.includes(key) ? 'admin' : 'player',
      characters: characterData ? [characterData] : []
    };

    this.saveAccounts();
    console.log(`[AccountManager] New user registered: ${cleanUsername}`);
    return {
      success: true,
      username: cleanUsername,
      token: this.issueToken(key),
      account: this.accountPayload(key)
    };
  }

  login(username: string, password: string): {
    success: boolean;
    message?: string;
    username?: string;
    token?: string;
    account?: AccountPayload;
  } {
    if (!username || !password) {
      return { success: false, message: 'กรุณากรอก Username และ Password' };
    }

    const cleanUsername = username.trim();
    const key = cleanUsername.toLowerCase();

    const account = this.accounts[key];
    if (!account) {
      return { success: false, message: 'ไม่พบชื่อผู้ใช้งานนี้' };
    }

    const checkHash = this.hashPassword(password, account.salt);
    if (checkHash !== account.passwordHash) {
      return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
    }

    account.lastLogin = Date.now();
    this.saveAccounts();

    console.log(`[AccountManager] User logged in: ${account.username}`);
    return {
      success: true,
      username: account.username,
      token: this.issueToken(key),
      account: this.accountPayload(key)
    };
  }

  getCharacter(username: string, slot: number = 0): any {
    if (!username) return null;
    const key = username.trim().toLowerCase();
    const acc = this.accounts[key];
    return acc ? (this.normalize(acc).characters[slot] || null) : null;
  }

  saveCharacter(username: string, characterData: any, slot: number = 0): boolean {
    if (!username || !characterData) return false;
    const key = username.trim().toLowerCase();
    if (!this.accounts[key]) return false;
    const acc = this.normalize(this.accounts[key]);
    if (!acc.characters[slot]) return false;

    // Filter serializable fields to keep file clean
    acc.characters[slot] = {
      name: characterData.name,
      characterClass: characterData.characterClass,
      level: characterData.level || 1,
      exp: characterData.exp || 0,
      expNext: characterData.expNext,
      skillPoints: characterData.skillPoints || 0,
      skills: characterData.skills || {},
      // a transformed hero is saved with their own skills, not the card's
      equippedSkills: (characterData.spTransformed && characterData.baseEquippedSkills) || characterData.equippedSkills || null,
      jobLevel: characterData.jobLevel || 1,
      spLoadouts: characterData.spLoadouts || {},
      skillLinks: characterData.skillLinks || {},
      jobExp: characterData.jobExp || 0,
      equipment: characterData.equipment || {},
      gold: characterData.gold || 0,
      inventory: characterData.inventory || { healthPotions: 3, manaPotions: 2, items: [] },
      zone: characterData.zone || 'town',
      x: characterData.x,
      y: characterData.y,
      savedAt: Date.now()
    };

    this.saveAccounts();
    return true;
  }
}

const defaultAccountManager = new AccountManager();
export default defaultAccountManager;
module.exports = defaultAccountManager;

