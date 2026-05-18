import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

type DB = ReturnType<typeof drizzle<typeof schema>>;

let _sqlite: InstanceType<typeof Database> | null = null;
let _db: DB | null = null;

// Lazy so test env vars are set before first access
function getInstance(): { db: DB; sqlite: InstanceType<typeof Database> } {
  if (_db && _sqlite) return { db: _db, sqlite: _sqlite };

  const dbUrl = process.env.DATABASE_URL ?? './data/mini-apty.db';
  const isMemory = dbUrl === ':memory:';

  if (!isMemory) {
    const dir = path.dirname(path.resolve(dbUrl));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(isMemory ? ':memory:' : path.resolve(dbUrl));

  if (!isMemory) sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS walkthroughs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      origin TEXT NOT NULL,
      path_pattern TEXT NOT NULL,
      steps TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS walkthrough_assignments (
      id TEXT PRIMARY KEY,
      walkthrough_id TEXT NOT NULL REFERENCES walkthroughs(id) ON DELETE CASCADE,
      assignee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      UNIQUE(walkthrough_id, assignee_id)
    );

    CREATE INDEX IF NOT EXISTS idx_wt_user_origin
      ON walkthroughs(user_id, origin);

    CREATE INDEX IF NOT EXISTS idx_wa_assignee
      ON walkthrough_assignments(assignee_id);
  `);

  // Migration: add role and is_active columns to existing databases
  const cols = (sqlite.pragma('table_info(users)') as Array<{ name: string }>).map(c => c.name);
  if (!cols.includes('role')) {
    sqlite.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  }
  if (!cols.includes('is_active')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  }

  _sqlite = sqlite;
  _db = drizzle(sqlite, { schema });
  return { db: _db, sqlite: _sqlite };
}

export function getDb(): DB {
  return getInstance().db;
}

export function closeDb(): void {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
  }
}

export async function initDb(): Promise<void> {
  const db = getDb();
  const existing = db.select().from(schema.users).where(eq(schema.users.email, 'admin@example.com')).get();
  if (existing) return; // admin already exists

  const passwordHash = await bcrypt.hash('admin123', 12);
  const id = uuidv4();
  const now = new Date();

  db.insert(schema.users).values({
    id,
    email: 'admin@example.com',
    passwordHash,
    role: 'author',
    isActive: true,
    createdAt: now,
  }).run();
}
