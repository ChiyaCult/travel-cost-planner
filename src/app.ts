import { Hono } from "@hono/hono";
import { SYMBOLE } from "./symbole.ts";
import { getCookie } from "@hono/hono/cookie";
import type { DatabaseSync } from "node:sqlite";
import { registerAuthRoutes } from "./auth.ts";
import { BELEG_MAX, BELEG_TYPEN, registerExpenseRoutes } from "./expenses.ts";
import { istMitglied, registerGroupRoutes } from "./groups.ts";
import { erkenneSumme, tesseract, type Texterkennung } from "./erkennung.ts";
import { frankfurter, type Kursdienst } from "./kurs.ts";
import {
  anmeldeseite,
  gruppenseite,
  profilseite,
  startseite,
} from "./pages.ts";

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
  erkennung: Texterkennung = tesseract,
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

  // Summenvorschlag für ein Foto vor dem Speichern; das Foto bleibt auf dem Server.
  app.post("/api/erkennung/summe", async (c) => {
    if (!c.get("user")) return c.json({ fehler: "Nicht angemeldet" }, 401);
    const mime = (c.req.header("content-type") ?? "").split(";")[0].trim();
    if (!BELEG_TYPEN.includes(mime)) {
      return c.json({ fehler: "Beleg muss ein Bild sein" }, 400);
    }
    const bild = new Uint8Array(await c.req.arrayBuffer());
    if (bild.length === 0) return c.json({ fehler: "Beleg ist leer" }, 400);
    if (bild.length > BELEG_MAX) {
      return c.json({ fehler: "Beleg ist zu groß (max. 10 MB)" }, 413);
    }
    return c.json({ summeYen: await erkenneSumme(erkennung, bild) });
  });

  app.get("/manifest.webmanifest", (c) =>
    c.body(
      JSON.stringify({
        name: "Ausgaben teilen",
        short_name: "Ausgaben",
        lang: "de",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#fcf0e4",
        theme_color: "#fcf0e4",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      }),
      200,
      { "content-type": "application/manifest+json" },
    ));

  app.get(
    "/:symbol{(icon-192|icon-512|apple-touch-icon|logo)\\.png}",
    (c) =>
      c.body(SYMBOLE[c.req.param("symbol")], 200, {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400",
      }),
  );

  // Favicon: Browser fragen oft direkt /favicon.ico.
  app.get("/favicon.ico", (c) =>
    c.body(SYMBOLE["icon-192.png"], 200, {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400",
    }));

  app.get("/gruppen/:id{[0-9]+}", (c) => {
    const user = c.get("user");
    if (!user) return c.redirect("/");
    const id = Number(c.req.param("id"));
    if (!istMitglied(db, id, user.id)) return c.redirect("/");
    return c.html(gruppenseite(id));
  });

  app.patch("/api/me", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ fehler: "Nicht angemeldet" }, 401);
    const body = await c.req.json().catch(() => ({})) as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return c.json({ fehler: "Name fehlt" }, 400);
    if (name.length > 60) return c.json({ fehler: "Name ist zu lang" }, 400);
    db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, user.id);
    return c.json({ id: user.id, name });
  });

  app.get("/", (c) => {
    const user = c.get("user");
    if (!user) return c.html(anmeldeseite(config.domain));
    return c.html(startseite(user));
  });

  app.get("/profil", (c) => {
    const user = c.get("user");
    if (!user) return c.redirect("/");
    const nutzer = user.is_admin === 1
      ? db.prepare("SELECT id, name FROM users ORDER BY name").all() as {
        id: number;
        name: string;
      }[]
      : [];
    return c.html(profilseite(user, nutzer));
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
