import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UserRole } from './types';
import { toSavedCharacter } from './entities/savedCharacter';

// Check local directory or root project server/data directory
const DATA_DIR = process.env.DATA_DIR || (
  fs.existsSync(path.join(__dirname, 'data')) 
    ? path.join(__dirname, 'data') 
    : path.join(process.cwd(), 'server', 'data')
);
// (login sessions survive a server restart, so connected players rejoin by themselves: sessions.json)
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

  // true when accounts.json existed but could not be loaded; saving is then refused
  public loadFailed = false;
  private writing = false;
  private pendingSave = false;
  private syncEpoch = 0;
  private idle: Promise<void> = Promise.resolve();
  private dataDir: string;
  private accountsFile: string;
  private sessionsFile: string;

  constructor(dataDir: string = DATA_DIR) {
    this.dataDir = dataDir;
    this.accountsFile = path.join(dataDir, 'accounts.json');
    this.sessionsFile = path.join(dataDir, 'sessions.json');
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
    this.saveSessions();
    return token;
  }

  usernameForToken(token?: string): string | null {
    const s = token && this.sessions.get(token);
    if (!s) return null;
    if (Date.now() > s.expiresAt) {
      this.sessions.delete(token);
      this.saveSessions();
      return null;
    }
    return this.accounts[s.key] ? this.accounts[s.key].username : null;
  }

  saveSessions(): void {
    try {
      const now = Date.now();
      for (const [token, s] of this.sessions) if (now > s.expiresAt) this.sessions.delete(token);
      const tmp = this.sessionsFile + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.sessions)), 'utf-8');
      fs.renameSync(tmp, this.sessionsFile); // atomic replace
    } catch (err) {
      console.error('[AccountManager] Error saving sessions:', err);
    }
  }

  loadSessions(): void {
    try {
      if (!fs.existsSync(this.sessionsFile)) return;
      const now = Date.now();
      const raw = JSON.parse(fs.readFileSync(this.sessionsFile, 'utf-8'));
      for (const [token, s] of Object.entries<any>(raw)) {
        if (s && typeof s.key === 'string' && s.expiresAt > now) this.sessions.set(token, { key: s.key, expiresAt: s.expiresAt });
      }
    } catch (err) {
      console.error('[AccountManager] Error loading sessions:', err);
    }
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
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (fs.existsSync(this.accountsFile)) {
        const raw = fs.readFileSync(this.accountsFile, 'utf-8');
        this.accounts = JSON.parse(raw);
        for (const acc of Object.values(this.accounts)) this.normalize(acc);
        console.log(`[AccountManager] Loaded ${Object.keys(this.accounts).length} accounts.`);
      } else {
        this.saveAccounts();
      }
      this.loadSessions();
    } catch (err) {
      console.error('[AccountManager] Error initializing accounts:', err);
      this.accounts = {};
      // The file exists but could not be read/parsed: keep a copy and refuse to
      // save, otherwise the next save would overwrite every real account with {}.
      try {
        if (fs.existsSync(this.accountsFile)) {
          const backup = path.join(this.dataDir, `accounts.corrupt-${Date.now()}.json`);
          fs.copyFileSync(this.accountsFile, backup);
          console.error(`[AccountManager] !!! accounts file unreadable. Copied to ${backup}. Saving is DISABLED until it is fixed and the server restarted.`);
        }
      } catch (copyErr) {
        console.error('[AccountManager] Could not back up the unreadable accounts file:', copyErr);
      }
      this.loadFailed = true;
    }
  }

  // Async save: the game loop is not blocked by the disk write. The file is written to
  // <file>.tmp and renamed over the real one, so a crash can never leave a half-written file.
  // Calls made while a write is running are coalesced into one follow-up write.
  saveAccounts(): void {
    if (this.loadFailed) {
      console.error('[AccountManager] Save skipped: accounts file failed to load earlier (see accounts.corrupt-*.json).');
      return;
    }
    if (this.writing) { this.pendingSave = true; return; }
    this.writing = true;
    this.idle = this.writeLoop();
  }

  // Resolves once every requested save has reached the disk (used by tests / graceful shutdown)
  flush(): Promise<void> {
    return this.idle;
  }

  // Blocking save with the same atomic tmp+rename; use it only on the shutdown path.
  saveAccountsSync(): void {
    if (this.loadFailed) return;
    try {
      this.syncEpoch++; // makes any in-flight async write discard its stale snapshot
      this.pendingSave = false;
      if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
      const tmp = this.accountsFile + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.accounts, null, 2), 'utf-8');
      fs.renameSync(tmp, this.accountsFile);
    } catch (err) {
      console.error('[AccountManager] Error saving accounts (sync):', err);
    }
  }

  private async writeLoop(): Promise<void> {
    try {
      do {
        this.pendingSave = false;
        try {
          const epoch = this.syncEpoch;
          const json = JSON.stringify(this.accounts, null, 2);
          await fs.promises.mkdir(this.dataDir, { recursive: true });
          const tmp = this.accountsFile + '.tmp';
          await fs.promises.writeFile(tmp, json, 'utf-8');
          if (epoch !== this.syncEpoch) { await fs.promises.rm(tmp, { force: true }); continue; }
          await this.renameWithRetry(tmp, this.accountsFile);
        } catch (err) {
          console.error('[AccountManager] Error saving accounts:', err);
        }
      } while (this.pendingSave);
    } finally {
      this.writing = false;
    }
  }

  // Windows can briefly refuse to replace a file that antivirus/indexers have open
  private async renameWithRetry(from: string, to: string): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.promises.rename(from, to);
        return;
      } catch (err: any) {
        if (attempt >= 4 || (err.code !== 'EPERM' && err.code !== 'EBUSY' && err.code !== 'EACCES')) throw err;
        await new Promise(r => setTimeout(r, 50 * (attempt + 1)));
      }
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

  // flush=false updates memory only; the caller must call saveAccounts() afterwards (used to batch autosaves)
  saveCharacter(username: string, characterData: any, slot: number = 0, flush: boolean = true): boolean {
    if (!username || !characterData) return false;
    const key = username.trim().toLowerCase();
    if (!this.accounts[key]) return false;
    const acc = this.normalize(this.accounts[key]);
    if (!acc.characters[slot]) return false;

    // Filter serializable fields to keep file clean
    acc.characters[slot] = toSavedCharacter(characterData);

    if (flush) this.saveAccounts();
    return true;
  }
}

const defaultAccountManager = new AccountManager();
export default defaultAccountManager;
module.exports = defaultAccountManager;

