import { DatabaseSync } from 'node:sqlite';
import LibsqlDatabase from 'libsql';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function openDatabase(filename) {
  // Explicit filenames keep tests isolated from configured production databases.
  const remote = filename === undefined && Boolean(process.env.TURSO_DATABASE_URL);
  const location =
    filename || process.env.TURSO_DATABASE_URL || process.env.DATABASE_PATH || './data/retain.db';
  if (remote && (!location.startsWith('libsql://') || !process.env.TURSO_AUTH_TOKEN)) {
    throw new Error('Turso requires a libsql:// database URL and TURSO_AUTH_TOKEN.');
  }
  if (!remote && location !== ':memory:')
    mkdirSync(dirname(resolve(location)), { recursive: true });
  const useLibsql = remote || process.env.DATABASE_DRIVER === 'libsql';
  const db = useLibsql
    ? new LibsqlDatabase(location, remote ? { authToken: process.env.TURSO_AUTH_TOKEN } : {})
    : new DatabaseSync(location);
  db.exec('PRAGMA foreign_keys = ON;');
  if (!remote) db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  // Hosted SQLite disallows assigning PRAGMA user_version. Keep migration state in SQL.
  const legacyVersion = remote ? 0 : db.prepare('PRAGMA user_version').get().user_version;
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)');
  const schemaVersion =
    db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version ||
    legacyVersion;
  db.exec('BEGIN IMMEDIATE');
  try {
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

  `);
    const seed = db.prepare(
      'INSERT OR IGNORE INTO categories (id, name, color, is_default, created_at) VALUES (?, ?, ?, ?, ?)',
    );
    const categories = [
      ['uncategorized', 'Uncategorized', '#6b7280', 1],
      ['food', 'Food & groceries', '#d49b49', 0],
      ['transport', 'Transport', '#5e8b91', 0],
      ['housing', 'Housing & bills', '#9673a6', 0],
      ['health', 'Health', '#cf7a6f', 0],
      ['learning', 'Learning', '#6e8b55', 0],
      ['leisure', 'Leisure', '#7c83bc', 0],
    ];
    if (schemaVersion === 0) {
      for (const category of categories) seed.run(...category, new Date().toISOString());
    }
    db.prepare('INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)').run(1);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    db.close();
    throw error;
  }
  return db;
}
