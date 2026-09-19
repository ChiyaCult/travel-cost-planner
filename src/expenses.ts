import type { Hono } from "@hono/hono";
import type { DatabaseSync } from "node:sqlite";
import type { Env } from "./app.ts";
import { istMitglied, mitglieder } from "./groups.ts";

/** Gleichmäßig in ganzen Cent; der Restcent geht einzeln an die ersten Mitglieder. */
export function teile(betragCent: number, anzahl: number): number[] {
  const basis = Math.floor(betragCent / anzahl);
  const rest = betragCent - basis * anzahl;
  return Array.from({ length: anzahl }, (_, i) => basis + (i < rest ? 1 : 0));
}

const heute = () => new Date().toISOString().slice(0, 10);

function gueltigesDatum(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(d + "T00:00:00Z");
  return !isNaN(t.getTime()) && t.toISOString().startsWith(d);
}

export function registerExpenseRoutes(app: Hono<Env>, db: DatabaseSync) {
  const nichtGefunden = { fehler: "Gruppe nicht gefunden" };

  app.post("/api/gruppen/:id/ausgaben", async (c) => {
    const user = c.get("user")!;
    const gruppeId = Number(c.req.param("id"));
    if (!istMitglied(db, gruppeId, user.id)) return c.json(nichtGefunden, 404);
    const body = await c.req.json().catch(() => ({})) as {
      betragCent?: unknown;
      beschreibung?: unknown;
      datum?: unknown;
      teilnehmerIds?: unknown;
    };
    const { betragCent } = body;
    if (
      typeof betragCent !== "number" || !Number.isSafeInteger(betragCent) ||
      betragCent <= 0
    ) {
      return c.json({ fehler: "Betrag ungültig" }, 400);
    }
    const beschreibung = typeof body.beschreibung === "string"
      ? body.beschreibung.trim()
      : "";
    if (!beschreibung) return c.json({ fehler: "Beschreibung fehlt" }, 400);
    const datum = body.datum === undefined ? heute() : body.datum;
    if (typeof datum !== "string" || !gueltigesDatum(datum)) {
      return c.json({ fehler: "Datum ungültig" }, 400);
    }

    const alle = mitglieder(db, gruppeId);
    // Standard alle; sonst die gewählten Mitglieder in Beitrittsreihenfolge.
    let betroffene = alle;
    if (body.teilnehmerIds !== undefined) {
      const ids = body.teilnehmerIds;
      if (
        !Array.isArray(ids) || ids.length === 0 ||
        new Set(ids).size !== ids.length ||
        !ids.every((i) => alle.some((m) => m.id === i))
      ) {
        return c.json({ fehler: "Auswahl ungültig" }, 400);
      }
      betroffene = alle.filter((m) => ids.includes(m.id));
    }
    const anteile = teile(betragCent, betroffene.length);
    db.exec("BEGIN");
    try {
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO expenses (group_id, payer_id, amount_cents, description, date)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(gruppeId, user.id, betragCent, beschreibung, datum);
      const id = Number(lastInsertRowid);
      const ins = db.prepare(
        "INSERT INTO expense_shares (expense_id, user_id, share_cents) VALUES (?, ?, ?)",
      );
      betroffene.forEach((m, i) => ins.run(id, m.id, anteile[i]));
      db.exec("COMMIT");
      return c.json({
        id,
        zahler: { id: user.id, name: user.name },
        betragCent,
        beschreibung,
        datum,
      }, 201);
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  });

  app.get("/api/gruppen/:id/ausgaben", (c) => {
    const user = c.get("user")!;
    const gruppeId = Number(c.req.param("id"));
    if (!istMitglied(db, gruppeId, user.id)) return c.json(nichtGefunden, 404);
    const zeilen = db
      .prepare(
        `SELECT e.id, e.amount_cents AS betragCent, e.description AS beschreibung,
                e.date AS datum, u.id AS zahlerId, u.name AS zahlerName
         FROM expenses e JOIN users u ON u.id = e.payer_id
         WHERE e.group_id = ? ORDER BY e.date DESC, e.id DESC`,
      )
      .all(gruppeId) as unknown as {
        id: number;
        betragCent: number;
        beschreibung: string;
        datum: string;
        zahlerId: number;
        zahlerName: string;
      }[];
    return c.json(zeilen.map(({ zahlerId, zahlerName, ...rest }) => ({
      ...rest,
      zahler: { id: zahlerId, name: zahlerName },
    })));
  });

  // Je Paar nur eine Schuld: Ausgaben in beide Richtungen werden verrechnet.
  app.get("/api/gruppen/:id/schulden", (c) => {
    const user = c.get("user")!;
    const gruppeId = Number(c.req.param("id"));
    if (!istMitglied(db, gruppeId, user.id)) return c.json(nichtGefunden, 404);
    const anteile = db
      .prepare(
        `SELECT e.payer_id AS zahler, s.user_id AS schuldner, s.share_cents AS cent
         FROM expenses e JOIN expense_shares s ON s.expense_id = e.id
         WHERE e.group_id = ? AND s.user_id != e.payer_id`,
      )
      .all(gruppeId) as unknown as {
        zahler: number;
        schuldner: number;
        cent: number;
      }[];
    const saldo = new Map<string, number>(); // "kleinereId:größereId" → Betrag, den die kleinere Id der größeren schuldet
    for (const { zahler, schuldner, cent } of anteile) {
      const [a, b] = schuldner < zahler
        ? [schuldner, zahler]
        : [zahler, schuldner];
      const key = `${a}:${b}`;
      saldo.set(key, (saldo.get(key) ?? 0) + (schuldner === a ? cent : -cent));
    }
    const namen = new Map(mitglieder(db, gruppeId).map((m) => [m.id, m]));
    const schulden = [];
    for (const [key, wert] of saldo) {
      if (wert === 0) continue;
      const [a, b] = key.split(":").map(Number);
      const [von, an] = wert > 0 ? [a, b] : [b, a];
      schulden.push({
        von: namen.get(von),
        an: namen.get(an),
        betragCent: Math.abs(wert),
      });
    }
    return c.json(schulden);
  });
}
