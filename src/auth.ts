import type { Hono } from "@hono/hono";
import { deleteCookie, setCookie } from "@hono/hono/cookie";
import type { DatabaseSync } from "node:sqlite";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransport,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { SESSION_COOKIE, SITZUNG_GUELTIG_S } from "./app.ts";
import type { Config, Env } from "./app.ts";
import { einladungsseite, mitNonce, ungueltigeEinladung } from "./pages.ts";

const EINLADUNG_GUELTIG_MS = 7 * 24 * 3600 * 1000;
const CHALLENGE_GUELTIG_MS = 5 * 60 * 1000;
/** Obergrenze offener Challenges, damit anonyme Aufrufe die DB nicht füllen. */
export const CHALLENGES_MAX = 500;

/** Legt einen Einladungslink an; für einen neuen Nutzer wird dieser mit angelegt. */
export function createInvite(
  db: DatabaseSync,
  target: { name: string; isAdmin?: boolean } | { userId: number },
): string {
  let userId: number;
  if ("userId" in target) {
    userId = target.userId;
  } else {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO users (name, is_admin) VALUES (?, ?)")
      .run(target.name, target.isAdmin ? 1 : 0);
    userId = Number(lastInsertRowid);
  }
  const token = crypto.randomUUID();
  db.prepare(
    "INSERT INTO invites (token, user_id, expires_at) VALUES (?, ?, ?)",
  )
    .run(token, userId, Date.now() + EINLADUNG_GUELTIG_MS);
  return token;
}

/**
 * Start: solange der Admin noch keinen Passkey hat (fehlt er ganz, wird er angelegt),
 * wird ein frischer Einladungslink erzeugt. Liefert den Token oder null.
 */
export function ensureAdminInvite(
  db: DatabaseSync,
  name: string,
): string | null {
  const admin = db
    .prepare("SELECT id FROM users WHERE is_admin = 1 LIMIT 1")
    .get() as { id: number } | undefined;
  if (!admin) return createInvite(db, { name, isAdmin: true });
  const hatPasskey = db.prepare("SELECT 1 FROM credentials WHERE user_id = ?")
    .get(admin.id);
  return hatPasskey ? null : createInvite(db, { userId: admin.id });
}

interface Invite {
  token: string;
  user_id: number;
  name: string;
}

export function registerAuthRoutes(
  app: Hono<Env>,
  db: DatabaseSync,
  config: Config,
) {
  const rpID = config.domain;
  const zuVieleVersuche = { fehler: "Zu viele Versuche, bitte gleich nochmal" };
  const secure = config.origin.startsWith("https://");

  const findInvite = (token: string): Invite | null =>
    (db
      .prepare(
        `SELECT i.token, i.user_id, u.name FROM invites i JOIN users u ON u.id = i.user_id
         WHERE i.token = ? AND i.used_at IS NULL AND i.expires_at > ?`,
      )
      .get(token, Date.now()) as Invite | undefined) ?? null;

  /** Speichert die Challenge; null, wenn zu viele offen sind. */
  const saveChallenge = (
    challenge: string,
    inviteToken: string | null,
  ): string | null => {
    db.prepare("DELETE FROM challenges WHERE expires_at < ?").run(Date.now());
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM challenges").get() as {
      n: number;
    };
    if (n >= CHALLENGES_MAX) return null;
    const id = crypto.randomUUID();
    db.prepare(
      "INSERT INTO challenges (id, challenge, invite_token, expires_at) VALUES (?, ?, ?, ?)",
    )
      .run(id, challenge, inviteToken, Date.now() + CHALLENGE_GUELTIG_MS);
    return id;
  };

  /** Löst eine Challenge genau einmal ein. */
  const takeChallenge = (
    id: unknown,
    inviteToken: string | null,
  ): string | null => {
    if (typeof id !== "string") return null;
    const row = db
      .prepare(
        "DELETE FROM challenges WHERE id = ? RETURNING challenge, invite_token, expires_at",
      )
      .get(id) as {
        challenge: string;
        invite_token: string | null;
        expires_at: number;
      } | undefined;
    if (
      !row || row.expires_at < Date.now() || row.invite_token !== inviteToken
    ) return null;
    return row.challenge;
  };

  const startSession = (c: Parameters<typeof setCookie>[0], userId: number) => {
    db.prepare("DELETE FROM sessions WHERE created_at <= datetime('now', ?)")
      .run(`-${SITZUNG_GUELTIG_S} seconds`);
    const sessionId = crypto.randomUUID();
    db.prepare("INSERT INTO sessions (id, user_id) VALUES (?, ?)").run(
      sessionId,
      userId,
    );
    setCookie(c, SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure,
      sameSite: "Lax",
      path: "/",
      maxAge: SITZUNG_GUELTIG_S,
    });
  };

  // Ohne Anmeldung ist die API (bis auf Anmeldung/Einladung) nicht nutzbar.
  app.use("/api/*", async (c, next) => {
    const p = c.req.path;
    const oeffentlich = p === "/api/health" || p.startsWith("/api/login") ||
      p.startsWith("/api/einladung/");
    if (!oeffentlich && !c.get("user")) {
      return c.json({ fehler: "Nicht angemeldet" }, 401);
    }
    await next();
  });

  // --- Admin: Einladungen und Nutzerliste ---

  app.get("/api/nutzer", (c) => {
    if (c.get("user")?.is_admin !== 1) {
      return c.json({ fehler: "Nur für den Admin" }, 403);
    }
    return c.json(db.prepare("SELECT id, name FROM users ORDER BY name").all());
  });

  app.post("/api/einladungen", async (c) => {
    if (c.get("user")?.is_admin !== 1) {
      return c.json({ fehler: "Nur der Admin darf einladen" }, 403);
    }
    const body = await c.req.json().catch(() => ({})) as {
      name?: unknown;
      nutzerId?: unknown;
    };
    let token: string;
    if (body.nutzerId !== undefined) {
      const exists = typeof body.nutzerId === "number" &&
        db.prepare("SELECT 1 FROM users WHERE id = ?").get(body.nutzerId);
      if (!exists) return c.json({ fehler: "Nutzer nicht gefunden" }, 404);
      token = createInvite(db, { userId: body.nutzerId as number });
    } else {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return c.json({ fehler: "Name fehlt" }, 400);
      token = createInvite(db, { name });
    }
    return c.json({ url: `${config.origin}/einladung/${token}` }, 201);
  });

  // --- Registrierung per Einladungslink ---

  app.get("/einladung/:token", (c) => {
    const invite = findInvite(c.req.param("token"));
    return invite
      ? c.html(mitNonce(einladungsseite(invite.token, invite.name), c))
      : c.html(mitNonce(ungueltigeEinladung(), c), 410);
  });

  app.post("/api/einladung/:token/optionen", async (c) => {
    const invite = findInvite(c.req.param("token"));
    if (!invite) {
      return c.json({ fehler: "Einladung ungültig oder verbraucht" }, 410);
    }
    const existing = db
      .prepare("SELECT id, transports FROM credentials WHERE user_id = ?")
      .all(invite.user_id) as { id: string; transports: string | null }[];
    const optionen = await generateRegistrationOptions({
      rpName: "Ausgaben teilen",
      rpID,
      userName: invite.name,
      userID: new TextEncoder().encode(String(invite.user_id)),
      attestationType: "none",
      excludeCredentials: existing.map((e) => ({
        id: e.id,
        transports: e.transports ? JSON.parse(e.transports) : undefined,
      })),
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred",
      },
    });
    const challengeId = saveChallenge(optionen.challenge, invite.token);
    if (!challengeId) return c.json(zuVieleVersuche, 429);
    return c.json({ optionen, challengeId });
  });

  app.post("/api/einladung/:token/registrieren", async (c) => {
    const invite = findInvite(c.req.param("token"));
    if (!invite) {
      return c.json({ fehler: "Einladung ungültig oder verbraucht" }, 410);
    }
    const body = await c.req.json().catch(() => ({})) as {
      challengeId?: unknown;
      antwort?: RegistrationResponseJSON;
    };
    const challenge = takeChallenge(body.challengeId, invite.token);
    if (!challenge || !body.antwort) {
      return c.json({ fehler: "Ungültige Anfrage" }, 400);
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.antwort,
        expectedChallenge: challenge,
        expectedOrigin: config.origin,
        expectedRPID: rpID,
      });
    } catch {
      return c.json({ fehler: "Passkey konnte nicht geprüft werden" }, 400);
    }
    if (!verification.verified) {
      return c.json({ fehler: "Passkey abgelehnt" }, 400);
    }

    // Einladung atomar verbrauchen: nur ein Aufruf kann gewinnen.
    const used = db
      .prepare(
        "UPDATE invites SET used_at = ? WHERE token = ? AND used_at IS NULL",
      )
      .run(Date.now(), invite.token);
    if (used.changes !== 1) {
      return c.json({ fehler: "Einladung ungültig oder verbraucht" }, 410);
    }

    const { credential } = verification.registrationInfo!;
    db.prepare(
      "INSERT INTO credentials (id, user_id, public_key, counter, transports) VALUES (?, ?, ?, ?, ?)",
    ).run(
      credential.id,
      invite.user_id,
      credential.publicKey,
      credential.counter,
      JSON.stringify(credential.transports ?? []),
    );
    startSession(c, invite.user_id);
    return c.json({ ok: true });
  });

  // --- Login / Logout ---

  app.post("/api/login/optionen", async (c) => {
    const optionen = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
    });
    const challengeId = saveChallenge(optionen.challenge, null);
    if (!challengeId) return c.json(zuVieleVersuche, 429);
    return c.json({ optionen, challengeId });
  });

  app.post("/api/login", async (c) => {
    const body = await c.req.json().catch(() => ({})) as {
      challengeId?: unknown;
      antwort?: AuthenticationResponseJSON;
    };
    const challenge = takeChallenge(body.challengeId, null);
    if (!challenge || !body.antwort) {
      return c.json({ fehler: "Ungültige Anfrage" }, 400);
    }

    const cred = db
      .prepare(
        "SELECT id, user_id, public_key, counter, transports FROM credentials WHERE id = ?",
      )
      .get(body.antwort.id) as
        | {
          id: string;
          user_id: number;
          public_key: Uint8Array;
          counter: number;
          transports: string | null;
        }
        | undefined;
    if (!cred) return c.json({ fehler: "Unbekannter Passkey" }, 401);

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body.antwort,
        expectedChallenge: challenge,
        expectedOrigin: config.origin,
        expectedRPID: rpID,
        credential: {
          id: cred.id,
          publicKey: new Uint8Array(cred.public_key),
          counter: cred.counter,
          transports: cred.transports
            ? (JSON.parse(cred.transports) as AuthenticatorTransport[])
            : undefined,
        },
      });
    } catch {
      return c.json({ fehler: "Anmeldung abgelehnt" }, 401);
    }
    if (!verification.verified) {
      return c.json({ fehler: "Anmeldung abgelehnt" }, 401);
    }

    db.prepare("UPDATE credentials SET counter = ? WHERE id = ?")
      .run(verification.authenticationInfo.newCounter, cred.id);
    startSession(c, cred.user_id);
    return c.json({ ok: true });
  });

  app.post("/api/logout", (c) => {
    const user = c.get("user");
    if (user) {
      const sid = c.req.header("cookie")?.match(
        new RegExp(`${SESSION_COOKIE}=([^;]+)`),
      )?.[1];
      if (sid) db.prepare("DELETE FROM sessions WHERE id = ?").run(sid);
    }
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });
}
