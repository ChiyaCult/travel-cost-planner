import type { DatabaseSync } from "node:sqlite";
import { SESSION_COOKIE } from "./app.ts";

/**
 * Test-Seam: legt einen Nutzer samt Sitzung direkt in der Datenbank an,
 * ohne echten Passkey. Nur für Tests; nicht über HTTP erreichbar.
 */
export function createTestSession(
  db: DatabaseSync,
  opts: { name?: string; isAdmin?: boolean } = {},
): { userId: number; headers: Record<string, string> } {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO users (name, is_admin) VALUES (?, ?)")
    .run(opts.name ?? "Testnutzer", opts.isAdmin ? 1 : 0);
  const userId = Number(lastInsertRowid);
  const sessionId = crypto.randomUUID();
  db.prepare("INSERT INTO sessions (id, user_id) VALUES (?, ?)").run(
    sessionId,
    userId,
  );
  return { userId, headers: { Cookie: `${SESSION_COOKIE}=${sessionId}` } };
}
