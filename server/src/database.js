import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function openDatabase(filename = process.env.DATABASE_PATH || './data/retain.db') {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      color TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_default_category ON categories(is_default) WHERE is_default = 1;
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
      amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
      expense_date TEXT NOT NULL,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'mobile_money', 'card', 'bank_transfer')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS expenses_owner_date ON expenses(user_id, expense_date);
    CREATE INDEX IF NOT EXISTS expenses_category ON expenses(category_id);
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, month)
    );
    PRAGMA user_version = 1;
  `);
  const seed = db.prepare('INSERT OR IGNORE INTO categories (id, name, color, is_default, created_at) VALUES (?, ?, ?, ?, ?)');
  const categories = [
    ['uncategorized', 'Uncategorized', '#6b7280', 1],
    ['food', 'Food & groceries', '#d49b49', 0],
    ['transport', 'Transport', '#5e8b91', 0],
    ['housing', 'Housing & bills', '#9673a6', 0],
    ['health', 'Health', '#cf7a6f', 0],
    ['learning', 'Learning', '#6e8b55', 0],
    ['leisure', 'Leisure', '#7c83bc', 0],
  ];
  for (const category of categories) seed.run(...category, new Date().toISOString());
  return db;
}
