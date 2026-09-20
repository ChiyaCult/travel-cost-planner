import { Hono } from "@hono/hono";
import { SYMBOLE } from "./symbole.ts";
import { SCHRIFTEN } from "./schriften.ts";
import { getCookie } from "@hono/hono/cookie";
import { bodyLimit } from "@hono/hono/body-limit";
import { NONCE, secureHeaders } from "@hono/hono/secure-headers";
import type { DatabaseSync } from "node:sqlite";
import { registerAuthRoutes } from "./auth.ts";
import { BELEG_MAX, BELEG_TYPEN, registerExpenseRoutes } from "./expenses.ts";
import { istMitglied, registerGroupRoutes } from "./groups.ts";
import { erkenneSumme, tesseract, type Texterkennung } from "./erkennung.ts";
import { frankfurter, type Kursdienst } from "./kurs.ts";
import { log } from "./log.ts";
import {
  anmeldeseite,
  gruppenseite,
  mitNonce,
  profilseite,
  startseite,
} from "./pages.ts";

export const SESSION_COOKIE = "session";
/** Sitzungen enden nach dieser Zeit, auch serverseitig (nicht nur das Cookie). */
export const SITZUNG_GUELTIG_S = 30 * 24 * 3600;
/** JSON-Anfragen sind klein; nur Belegfotos dürfen groß sein. */
const ANFRAGE_MAX = 64 * 1024;
/** Höchstens so viele Texterkennungen gleichzeitig (Tesseract ist CPU-hungrig). */
const ERKENNUNG_PARALLEL = 2;

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

  // Jeder unerwartete Fehler landet im Protokoll, der Aufrufer bekommt nur 500.
  app.onError((err, c) => {
    log.ausnahme("anfrage.fehlgeschlagen", err, {
      methode: c.req.method,
      pfad: c.req.path,
      nutzerId: c.get("user")?.id ?? null,
    });
    return c.json({ fehler: "Unerwarteter Fehler" }, 500);
  });

  // Inline-Skripte laufen nur mit dem Nonce der jeweiligen Antwort.
  app.use(
    "*",
    secureHeaders({
      xFrameOptions: "DENY",
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: [NONCE],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    }),
  );

  // Größe vor dem Einlesen begrenzen; Belegfotos (Upload, Erkennung) bis BELEG_MAX.
  const zuGross = bodyLimit({
    maxSize: ANFRAGE_MAX,
    onError: (c) => c.json({ fehler: "Anfrage ist zu groß" }, 413),
  });
  const belegZuGross = bodyLimit({
    maxSize: BELEG_MAX,
    onError: (c) => c.json({ fehler: "Beleg ist zu groß (max. 10 MB)" }, 413),
  });
  app.use(
    "*",
    (c, next) =>
      c.req.path === "/api/erkennung/summe" || c.req.path.endsWith("/beleg")
        ? belegZuGross(c, next)
        : zuGross(c, next),
  );

  app.use("*", async (c, next) => {
    const sessionId = getCookie(c, SESSION_COOKIE);
    const user = sessionId
      ? (db
        .prepare(
          `SELECT u.id, u.name, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.id = ? AND s.created_at > datetime('now', ?)`,
        )
        .get(sessionId, `-${SITZUNG_GUELTIG_S} seconds`) as
          | SessionUser
          | undefined) ?? null
      : null;
    c.set("user", user);
    await next();
  });

  registerAuthRoutes(app, db, config);
  registerGroupRoutes(app, db);
  registerExpenseRoutes(app, db, kursdienst);

  // Summenvorschlag für ein Foto vor dem Speichern; das Foto bleibt auf dem Server.
  let erkennungLaeuft = 0;
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
    if (erkennungLaeuft >= ERKENNUNG_PARALLEL) {
      log.ereignis("erkennung.ausgelastet", { nutzerId: c.get("user")!.id });
      return c.json({ fehler: "Texterkennung ist gerade ausgelastet" }, 429);
    }
    erkennungLaeuft++;
    try {
      const summeYen = await erkenneSumme(erkennung, bild);
      log.ereignis("erkennung.gelaufen", {
        nutzerId: c.get("user")!.id,
        bytes: bild.length,
        erkannt: summeYen !== null,
      });
      return c.json({ summeYen });
    } finally {
      erkennungLaeuft--;
    }
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

  app.get(
    "/schriften/:datei{(dotgothic16|silkscreen)\\.woff2}",
    (c) =>
      c.body(SCHRIFTEN[c.req.param("datei")], 200, {
        "content-type": "font/woff2",
        "cache-control": "public, max-age=86400",
      }),
  );

  // Favicon: Browser fragen oft direkt /favicon.ico.
  app.get("/favicon.ico", (c) =>
    c.body(SYMBOLE["logo.png"], 200, {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400",
    }));

  app.get("/gruppen/:id{[0-9]+}", (c) => {
    const user = c.get("user");
    if (!user) return c.redirect("/");
    const id = Number(c.req.param("id"));
    if (!istMitglied(db, id, user.id)) return c.redirect("/");
    return c.html(mitNonce(gruppenseite(id), c));
  });

  app.patch("/api/me", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ fehler: "Nicht angemeldet" }, 401);
    const body = await c.req.json().catch(() => ({})) as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return c.json({ fehler: "Name fehlt" }, 400);
    if (name.length > 60) return c.json({ fehler: "Name ist zu lang" }, 400);
    db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, user.id);
    log.ereignis("nutzer.umbenannt", { nutzerId: user.id });
    return c.json({ id: user.id, name });
  });

  app.get("/", (c) => {
    const user = c.get("user");
    if (!user) return c.html(mitNonce(anmeldeseite(config.domain), c));
    return c.html(mitNonce(startseite(user), c));
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
    return c.html(mitNonce(profilseite(user, nutzer), c));
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
