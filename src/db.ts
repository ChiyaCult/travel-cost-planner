import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL,
  transports TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS invites (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- position (AUTOINCREMENT) hält die Beitrittsreihenfolge fest, z. B. für den Restcent.
CREATE TABLE IF NOT EXISTS group_members (
  position INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (group_id, user_id)
);
-- Beträge sind ganze Cent. Anteile werden beim Eintragen festgeschrieben.
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  payer_id INTEGER NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL,
  description TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
  -- Yen-Ausgaben: original_yen und exchange_rate (Euro pro Yen) sind fest; amount_cents ist immer Euro.
);
CREATE TABLE IF NOT EXISTS expense_shares (
  expense_id INTEGER NOT NULL REFERENCES expenses(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  share_cents INTEGER NOT NULL,
  PRIMARY KEY (expense_id, user_id)
);
-- Begleichung: from_id (der Eintragende) hat to_id außerhalb der App bezahlt.
CREATE TABLE IF NOT EXISTS settlements (
  id INTEGER PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  from_id INTEGER NOT NULL REFERENCES users(id),
  to_id INTEGER NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Beleg: Foto der Rechnung, lokal in der DB; höchstens einer je Ausgabe.
CREATE TABLE IF NOT EXISTS receipts (
  expense_id INTEGER PRIMARY KEY REFERENCES expenses(id),
  mime TEXT NOT NULL,
  data BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  invite_token TEXT,
  expires_at INTEGER NOT NULL
);
`;

/** Öffnet die einzige SQLite-Datei der App (":memory:" für Tests) und legt das Schema an. */
export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  const spalten = db.prepare("PRAGMA table_info(expenses)")
    .all() as unknown as {
      name: string;
    }[];
  if (!spalten.some((s) => s.name === "exchange_rate")) {
    db.exec(
      "ALTER TABLE expenses ADD COLUMN original_yen INTEGER; ALTER TABLE expenses ADD COLUMN exchange_rate REAL;",
    );
  }
  return db;
}
