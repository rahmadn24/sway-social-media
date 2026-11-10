import fs from 'node:fs';
import path from 'node:path';
import { createSeedDatabase } from './seed';
import type { Database } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

const globalForStore = globalThis as unknown as {
  __swayDb?: Database;
  __swayLastWrite?: number;
};

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/** Bring older single-account workspaces into the multi-account model. */
function migrateDb(db: Database): { db: Database; changed: boolean } {
  let changed = false;

  if (!Array.isArray(db.accounts)) {
    db.accounts = [];
    changed = true;
  }

  const usedIds = new Set<string>();
  const firstByPlatform = new Map<string, string>();

  db.accounts.forEach((account, index) => {
    if (!account.id) {
      account.id = `acct_${account.platform}_${index + 1}`;
      changed = true;
    }
    if (usedIds.has(account.id)) {
      account.id = `${account.id}_${index + 1}`;
      changed = true;
    }
    usedIds.add(account.id);
    if (!firstByPlatform.has(account.platform)) {
      firstByPlatform.set(account.platform, account.id);
    }
    if (!account.isPrimary && firstByPlatform.get(account.platform) === account.id) {
      account.isPrimary = true;
      changed = true;
    }
  });

  const primaryFor = (platform: string): string | undefined => {
    const account = db.accounts.find(
      (candidate) => candidate.platform === platform && candidate.isPrimary,
    );
    return account?.id ?? firstByPlatform.get(platform);
  };

  db.posts = Array.isArray(db.posts) ? db.posts : [];
  db.posts.forEach((post) => {
    if (!Array.isArray(post.platforms)) {
      post.platforms = [];
      changed = true;
    }
    if (!Array.isArray(post.accountIds) || post.accountIds.length === 0) {
      post.accountIds = [
        ...new Set(
          post.platforms
            .map((platform) => primaryFor(platform))
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      changed = true;
    }
  });

  db.conversations = Array.isArray(db.conversations) ? db.conversations : [];
  db.conversations.forEach((conversation) => {
    if (!conversation.accountId) {
      const accountId = primaryFor(conversation.platform);
      if (accountId) {
        conversation.accountId = accountId;
        changed = true;
      }
    }
  });

  if (db.version !== 2) {
    db.version = 2;
    changed = true;
  }

  return { db, changed };
}

export function writeDb(db: Database): void {
  ensureDataDir();
  const temporary = `${DB_FILE}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(temporary, DB_FILE);
  globalForStore.__swayDb = db;
  globalForStore.__swayLastWrite = Date.now();
}

export function readDb(): Database {
  if (globalForStore.__swayDb) return globalForStore.__swayDb;

  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const seeded = createSeedDatabase();
    writeDb(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Database;
    const { db, changed } = migrateDb(parsed);
    globalForStore.__swayDb = db;
    if (changed) writeDb(db);
    return db;
  } catch {
    const seeded = createSeedDatabase();
    writeDb(seeded);
    return seeded;
  }
}
