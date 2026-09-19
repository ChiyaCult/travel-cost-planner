import { Hono } from "@hono/hono";
import { getCookie } from "@hono/hono/cookie";
import type { DatabaseSync } from "node:sqlite";

export const SESSION_COOKIE = "session";

export interface Config {
  /** Feste Domain; Passkeys sind an sie gebunden. */
  domain: string;
}

export interface SessionUser {
  id: number;
  name: string;
  is_admin: number;
}

type Env = { Variables: { user: SessionUser | null } };

const startseite = (domain: string) => `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ausgaben teilen</title>
</head>
<body>
<h1>Ausgaben teilen</h1>
<p>Willkommen! Diese App teilt Ausgaben im Freundeskreis.</p>
<p><small>${domain}</small></p>
</body>
</html>`;

export function createApp(db: DatabaseSync, config: Config): Hono<Env> {
  const app = new Hono<Env>();

  app.use("*", async (c, next) => {
    const sessionId = getCookie(c, SESSION_COOKIE);
    const user = sessionId
      ? (db
        .prepare(
          "SELECT u.id, u.name, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?",
        )
        .get(sessionId) as SessionUser | undefined) ?? null
      : null;
    c.set("user", user);
    await next();
  });

  app.get("/", (c) => c.html(startseite(config.domain)));

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/me", (c) => {
    const user = c.get("user");
    if (!user) return c.json({ fehler: "Nicht angemeldet" }, 401);
    return c.json({ id: user.id, name: user.name, istAdmin: user.is_admin === 1 });
  });

  return app;
}
