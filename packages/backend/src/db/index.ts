import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

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

    CREATE INDEX IF NOT EXISTS idx_wt_user_origin
      ON walkthroughs(user_id, origin);
  `);

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
