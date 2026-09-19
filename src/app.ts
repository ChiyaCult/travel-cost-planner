import { Hono } from "@hono/hono";
import { getCookie } from "@hono/hono/cookie";
import type { DatabaseSync } from "node:sqlite";
import { registerAuthRoutes } from "./auth.ts";
import { registerExpenseRoutes } from "./expenses.ts";
import { registerGroupRoutes } from "./groups.ts";
import { frankfurter, type Kursdienst } from "./kurs.ts";
import { anmeldeseite, startseite } from "./pages.ts";

export const SESSION_COOKIE = "session";

export interface Config {
  /** Feste Domain; Passkeys sind an sie gebunden. */
  domain: string;
  /** Vollständiger Ursprung (z. B. https://ausgaben.example.de); WebAuthn prüft ihn. */
  origin: string;
}

export interface SessionUser {
  id: number;
  name: string;
  is_admin: number;
}

export type Env = { Variables: { user: SessionUser | null } };

export function createApp(
  db: DatabaseSync,
  config: Config,
  kursdienst: Kursdienst = frankfurter,
): Hono<Env> {
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

  registerAuthRoutes(app, db, config);
  registerGroupRoutes(app, db);
  registerExpenseRoutes(app, db, kursdienst);

  app.get("/", (c) => {
    const user = c.get("user");
    if (!user) return c.html(anmeldeseite(config.domain));
    const nutzer = user.is_admin === 1
      ? db.prepare("SELECT id, name FROM users ORDER BY name").all() as {
        id: number;
        name: string;
      }[]
      : [];
    return c.html(startseite(user, nutzer));
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/me", (c) => {
    const user = c.get("user");
    if (!user) return c.json({ fehler: "Nicht angemeldet" }, 401);
    return c.json({
      id: user.id,
      name: user.name,
      istAdmin: user.is_admin === 1,
    });
  });

  return app;
}
