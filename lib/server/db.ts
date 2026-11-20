import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import Database from "better-sqlite3";
import { getEnv, type AppEnv } from "./env";
import { assertStrongPassword, hashPassword } from "./password";

type DB = InstanceType<typeof Database>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER,
  ip_hash TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL COLLATE NOCASE,
  webhook_ciphertext TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_tested_at INTEGER,
  UNIQUE(category_id, name)
);
CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(category_id);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL,
  discord_markdown TEXT NOT NULL,
  plain_text TEXT NOT NULL DEFAULT '',
  embed_json TEXT,
  channel_id TEXT REFERENCES channels(id) ON DELETE SET NULL,
  channel_name_snapshot TEXT NOT NULL,
  category_name_snapshot TEXT,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name_snapshot TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'published', 'failed')),
  discord_message_id TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  published_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_channel ON announcements(channel_id);

CREATE TABLE IF NOT EXISTS rate_limit_hits (
  id TEXT PRIMARY KEY,
  bucket_key TEXT NOT NULL,
  occurred_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket_time ON rate_limit_hits(bucket_key, occurred_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_time ON rate_limit_hits(occurred_at);
`;

function bootstrap(db: DB, env: AppEnv) {
  const now = Date.now();
  const userCount = (db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count;

  if (userCount === 0) {
    if (!env.adminPassword) {
      throw new Error("First run requires ADMIN_PASSWORD in .env.local. No public registration is available.");
    }
    assertStrongPassword(env.adminPassword);
    db.prepare(
      `INSERT INTO users (id, username, password_hash, display_name, role, created_at)
       VALUES (?, ?, ?, ?, 'admin', ?)`
    ).run(randomUUID(), env.adminUsername, hashPassword(env.adminPassword), env.adminDisplayName, now);
  }

  const firstAdmin = db.prepare("SELECT id FROM users ORDER BY created_at ASC LIMIT 1").get() as { id: string } | undefined;
  const createdBy = firstAdmin?.id ?? null;
  const categoryCount = (db.prepare("SELECT COUNT(*) AS count FROM categories").get() as { count: number }).count;

  if (categoryCount === 0) {
    const categories = [
      { id: randomUUID(), name: "Community", description: "Public community broadcasts", sortOrder: 10 },
      { id: randomUUID(), name: "Operations", description: "Service and release communication", sortOrder: 20 },
      { id: randomUUID(), name: "Staff", description: "Internal administrative notices", sortOrder: 30 }
    ];
    const insertCategory = db.prepare(
      "INSERT INTO categories (id, name, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    const insertChannel = db.prepare(
      `INSERT INTO channels
       (id, category_id, name, webhook_ciphertext, enabled, created_by, created_at, updated_at, last_tested_at)
       VALUES (?, ?, ?, NULL, 1, ?, ?, ?, NULL)`
    );
    const channels: Record<string, string[]> = {
      Community: ["announcements", "community-updates"],
      Operations: ["service-status", "release-notes"],
      Staff: ["staff-briefings"]
    };
    db.transaction(() => {
      categories.forEach((category) => {
        insertCategory.run(category.id, category.name, category.description, category.sortOrder, now);
      });
      categories.forEach((category) => {
        (channels[category.name] ?? []).forEach((name) => {
          insertChannel.run(randomUUID(), category.id, name, createdBy, now, now);
        });
      });
    })();
  }
}

function openDatabase(): DB {
  const env = getEnv();
  const dbPath = isAbsolute(env.databasePath) ? env.databasePath : resolve(process.cwd(), env.databasePath);
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA);
  bootstrap(db, env);
  return db;
}

const globalStore = globalThis as typeof globalThis & { __atlasiaDb?: DB };

export function getDb(): DB {
  if (!globalStore.__atlasiaDb) {
    globalStore.__atlasiaDb = openDatabase();
  }
  return globalStore.__atlasiaDb;
}
