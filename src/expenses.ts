import type { Context, Hono } from "@hono/hono";
import type { DatabaseSync } from "node:sqlite";
import type { Env } from "./app.ts";
import type { Kursdienst } from "./kurs.ts";
import { istMitglied, mitglieder } from "./groups.ts";

/** Gleichmäßig in ganzen Cent; der Restcent geht einzeln an die ersten Mitglieder. */
export function teile(betragCent: number, anzahl: number): number[] {
  const basis = Math.floor(betragCent / anzahl);
  const rest = betragCent - basis * anzahl;
  return Array.from({ length: anzahl }, (_, i) => basis + (i < rest ? 1 : 0));
}

export const BELEG_TYPEN = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];
export const BELEG_MAX = 10 * 1024 * 1024;

const heute = () => new Date().toISOString().slice(0, 10);

function gueltigesDatum(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(d + "T00:00:00Z");
  return !isNaN(t.getTime()) && t.toISOString().startsWith(d);
}

export function registerExpenseRoutes(
  app: Hono<Env>,
  db: DatabaseSync,
  kursdienst: Kursdienst,
) {
  const nichtGefunden = { fehler: "Gruppe nicht gefunden" };

  /** Prüft Betrag, Beschreibung, Datum und Auswahl; gemeinsam für Anlegen und Ändern. */
  async function pruefeEingabe(
    c: Context<Env>,
    gruppeId: number,
    bisherKurs: number | null = null,
  ): Promise<
    | { fehler: { fehler: string }; status?: 400 | 502 }
    | {
      betragCent: number;
      yen: number | null;
      kurs: number | null;
      beschreibung: string;
      datum: string;
      betroffene: { id: number }[];
    }
  > {
    const body = await c.req.json().catch(() => ({})) as {
      betragCent?: unknown;
      betragYen?: unknown;
      waehrung?: unknown;
      kurs?: unknown;
      beschreibung?: unknown;
      datum?: unknown;
      teilnehmerIds?: unknown;
    };
    const waehrung = body.waehrung ?? "EUR";
    if (waehrung !== "EUR" && waehrung !== "JPY") {
      return { fehler: { fehler: "Währung ungültig" } };
    }
    const ganzePositive = (n: unknown): n is number =>
      typeof n === "number" && Number.isSafeInteger(n) && n > 0;
    const beschreibung = typeof body.beschreibung === "string"
      ? body.beschreibung.trim()
      : "";
    if (!beschreibung) return { fehler: { fehler: "Beschreibung fehlt" } };
    const datum = body.datum === undefined ? heute() : body.datum;
    if (typeof datum !== "string" || !gueltigesDatum(datum)) {
      return { fehler: { fehler: "Datum ungültig" } };
    }
    let betragCent: number;
    let yen: number | null = null;
    let kurs: number | null = null;
    if (waehrung === "EUR") {
      if (!ganzePositive(body.betragCent)) {
        return { fehler: { fehler: "Betrag ungültig" } };
      }
      betragCent = body.betragCent;
    } else {
      if (!ganzePositive(body.betragYen)) {
        return { fehler: { fehler: "Betrag ungültig" } };
      }
      yen = body.betragYen;
      if (body.kurs !== undefined) {
        if (
          typeof body.kurs !== "number" || !Number.isFinite(body.kurs) ||
          body.kurs <= 0
        ) {
          return { fehler: { fehler: "Kurs ungültig" } };
        }
        kurs = body.kurs;
      } else if (bisherKurs !== null) {
        kurs = bisherKurs; // gespeicherter Kurs bleibt beim Ändern fix
      } else {
        try {
          kurs = await kursdienst.yenInEuro(datum);
        } catch {
          return {
            fehler: {
              fehler: "Kurs nicht abrufbar; bitte Kurs manuell angeben",
            },
            status: 502,
          };
        }
      }
      // Erst der Gesamtbetrag in Euro-Cent gerundet, dann in Cent geteilt.
      betragCent = Math.round(yen * kurs * 100);
      if (betragCent <= 0) return { fehler: { fehler: "Betrag ungültig" } };
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
        return { fehler: { fehler: "Auswahl ungültig" } };
      }
      betroffene = alle.filter((m) => ids.includes(m.id));
    }
    return { betragCent, yen, kurs, beschreibung, datum, betroffene };
  }

  const waehrungsfelder = (yen: number | null, kurs: number | null) =>
    yen === null
      ? { waehrung: "EUR" }
      : { waehrung: "JPY", betragYen: yen, kurs };

  app.post("/api/gruppen/:id/ausgaben", async (c) => {
    const user = c.get("user")!;
    const gruppeId = Number(c.req.param("id"));
    if (!istMitglied(db, gruppeId, user.id)) return c.json(nichtGefunden, 404);
    const eingabe = await pruefeEingabe(c, gruppeId);
    if ("fehler" in eingabe) {
      return c.json(eingabe.fehler, eingabe.status ?? 400);
    }
    const { betragCent, yen, kurs, beschreibung, datum, betroffene } = eingabe;
    const anteile = teile(betragCent, betroffene.length);
    db.exec("BEGIN");
    try {
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO expenses (group_id, payer_id, amount_cents, description, date, original_yen, exchange_rate)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(gruppeId, user.id, betragCent, beschreibung, datum, yen, kurs);
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
        ...waehrungsfelder(yen, kurs),
        beschreibung,
        datum,
      }, 201);
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  });

  /** Lädt die Ausgabe für Ändern/Löschen: 404 für Fremde, 403 für Nicht-Zahler. */
  function eigeneAusgabe(c: Context<Env>) {
    const user = c.get("user")!;
    const gruppeId = Number(c.req.param("id"));
    if (!istMitglied(db, gruppeId, user.id)) {
      return { antwort: c.json(nichtGefunden, 404) };
    }
    const zeile = db
      .prepare(
        "SELECT payer_id, exchange_rate FROM expenses WHERE id = ? AND group_id = ?",
      )
      .get(Number(c.req.param("ausgabeId")), gruppeId) as
        | { payer_id: number; exchange_rate: number | null }
        | undefined;
    if (!zeile) {
      return { antwort: c.json({ fehler: "Ausgabe nicht gefunden" }, 404) };
    }
    if (zeile.payer_id !== user.id) {
      return {
        antwort: c.json(
          { fehler: "Nur der Zahler darf die Ausgabe ändern" },
          403,
        ),
      };
    }
    return {
      antwort: undefined,
      gruppeId,
      id: Number(c.req.param("ausgabeId")),
      user,
      bisherKurs: zeile.exchange_rate,
    };
  }

  app.put("/api/gruppen/:id/ausgaben/:ausgabeId", async (c) => {
    const r = eigeneAusgabe(c);
    if (r.antwort) return r.antwort;
    const eingabe = await pruefeEingabe(c, r.gruppeId, r.bisherKurs);
    if ("fehler" in eingabe) {
      return c.json(eingabe.fehler, eingabe.status ?? 400);
    }
    const { betragCent, yen, kurs, beschreibung, datum, betroffene } = eingabe;
    const anteile = teile(betragCent, betroffene.length);
    db.exec("BEGIN");
    try {
      db.prepare(
        "UPDATE expenses SET amount_cents = ?, description = ?, date = ?, original_yen = ?, exchange_rate = ? WHERE id = ?",
      ).run(betragCent, beschreibung, datum, yen, kurs, r.id);
      db.prepare("DELETE FROM expense_shares WHERE expense_id = ?").run(r.id);
      const ins = db.prepare(
        "INSERT INTO expense_shares (expense_id, user_id, share_cents) VALUES (?, ?, ?)",
      );
      betroffene.forEach((m, i) => ins.run(r.id, m.id, anteile[i]));
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return c.json({
      id: r.id,
      zahler: { id: r.user.id, name: r.user.name },
      betragCent,
      ...waehrungsfelder(yen, kurs),
      beschreibung,
      datum,
    });
  });

  // Beleg: nur der Zahler lädt hoch, alle Mitglieder der Gruppe rufen ab.
  app.put("/api/gruppen/:id/ausgaben/:ausgabeId/beleg", async (c) => {
    const r = eigeneAusgabe(c);
    if (r.antwort) return r.antwort;
    const mime = (c.req.header("content-type") ?? "").split(";")[0].trim();
    if (!BELEG_TYPEN.includes(mime)) {
      return c.json({ fehler: "Beleg muss ein Bild sein" }, 400);
    }
    const daten = new Uint8Array(await c.req.arrayBuffer());
    if (daten.length === 0) return c.json({ fehler: "Beleg ist leer" }, 400);
    if (daten.length > BELEG_MAX) {
      return c.json({ fehler: "Beleg ist zu groß (max. 10 MB)" }, 413);
    }
    db.prepare(
      "INSERT OR REPLACE INTO receipts (expense_id, mime, data) VALUES (?, ?, ?)",
    ).run(r.id, mime, daten);
    return c.body(null, 204);
  });

  app.delete("/api/gruppen/:id/ausgaben/:ausgabeId/beleg", (c) => {
    const r = eigeneAusgabe(c);
    if (r.antwort) return r.antwort;
    const { changes } = db
      .prepare("DELETE FROM receipts WHERE expense_id = ?")
      .run(r.id);
    if (changes === 0) return c.json({ fehler: "Beleg nicht gefunden" }, 404);
    return c.body(null, 204);
  });

  app.get("/api/gruppen/:id/ausgaben/:ausgabeId/beleg", (c) => {
    const user = c.get("user")!;
    const gruppeId = Number(c.req.param("id"));
    if (!istMitglied(db, gruppeId, user.id)) return c.json(nichtGefunden, 404);
    const z = db
      .prepare(
        `SELECT r.mime, r.data FROM receipts r JOIN expenses e ON e.id = r.expense_id
         WHERE e.id = ? AND e.group_id = ?`,
      )
      .get(Number(c.req.param("ausgabeId")), gruppeId) as
        | { mime: string; data: Uint8Array }
        | undefined;
    if (!z) return c.json({ fehler: "Beleg nicht gefunden" }, 404);
    return c.body(z.data as Uint8Array<ArrayBuffer>, 200, {
      "content-type": z.mime,
      "cache-control": "private",
      "x-content-type-options": "nosniff",
    });
  });

  app.delete("/api/gruppen/:id/ausgaben/:ausgabeId", (c) => {
    const r = eigeneAusgabe(c);
    if (r.antwort) return r.antwort;
    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM receipts WHERE expense_id = ?").run(r.id);
      db.prepare("DELETE FROM expense_shares WHERE expense_id = ?").run(r.id);
      db.prepare("DELETE FROM expenses WHERE id = ?").run(r.id);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return c.body(null, 204);
  });

  app.get("/api/gruppen/:id/ausgaben", (c) => {
    const user = c.get("user")!;
    const gruppeId = Number(c.req.param("id"));
    if (!istMitglied(db, gruppeId, user.id)) return c.json(nichtGefunden, 404);
    const zeilen = db
      .prepare(
        `SELECT e.id, e.amount_cents AS betragCent, e.description AS beschreibung,
                e.date AS datum, e.original_yen AS yen, e.exchange_rate AS kurs,
                u.id AS zahlerId, u.name AS zahlerName,
                EXISTS (SELECT 1 FROM receipts r WHERE r.expense_id = e.id) AS hatBeleg
         FROM expenses e JOIN users u ON u.id = e.payer_id
         WHERE e.group_id = ? ORDER BY e.date DESC, e.id DESC`,
      )
      .all(gruppeId) as unknown as {
        id: number;
        betragCent: number;
        beschreibung: string;
        datum: string;
        yen: number | null;
        kurs: number | null;
        zahlerId: number;
        zahlerName: string;
        hatBeleg: number;
      }[];
    // Anteile aller Ausgaben auf einmal, damit die Detailansicht sie zeigen kann.
    const anteilszeilen = db
      .prepare(
        `SELECT s.expense_id AS ausgabeId, s.share_cents AS anteilCent,
                u.id AS nutzerId, u.name AS name
         FROM expense_shares s
         JOIN expenses e ON e.id = s.expense_id
         JOIN users u ON u.id = s.user_id
         WHERE e.group_id = ? ORDER BY s.rowid`,
      )
      .all(gruppeId) as unknown as {
        ausgabeId: number;
        anteilCent: number;
        nutzerId: number;
        name: string;
      }[];
    const anteileJeAusgabe = new Map<
      number,
      { id: number; name: string; anteilCent: number }[]
    >();
    for (const a of anteilszeilen) {
      const liste = anteileJeAusgabe.get(a.ausgabeId) ?? [];
      liste.push({ id: a.nutzerId, name: a.name, anteilCent: a.anteilCent });
      anteileJeAusgabe.set(a.ausgabeId, liste);
    }
    return c.json(
      zeilen.map(({ zahlerId, zahlerName, yen, kurs, hatBeleg, ...rest }) => ({
        ...rest,
        hatBeleg: hatBeleg === 1,
        ...waehrungsfelder(yen, kurs),
        zahler: { id: zahlerId, name: zahlerName },
        beteiligte: anteileJeAusgabe.get(rest.id) ?? [],
      })),
    );
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
         WHERE e.group_id = ? AND s.user_id != e.payer_id
         UNION ALL
         -- Eine Begleichung wirkt wie ein Anteil in Gegenrichtung.
         SELECT from_id, to_id, amount_cents FROM settlements WHERE group_id = ?`,
      )
      .all(gruppeId, gruppeId) as unknown as {
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

  /** Prüft Empfänger, Betrag und Datum einer Begleichung. */
  async function pruefeBegleichung(
    c: Context<Env>,
    gruppeId: number,
    selbst: number,
  ) {
    const body = await c.req.json().catch(() => ({})) as {
      anId?: unknown;
      betragCent?: unknown;
      datum?: unknown;
    };
    const { anId, betragCent } = body;
    if (
      typeof betragCent !== "number" || !Number.isSafeInteger(betragCent) ||
      betragCent <= 0
    ) {
      return { fehler: "Betrag ungültig" };
    }
    if (
      typeof anId !== "number" || anId === selbst ||
      !istMitglied(db, gruppeId, anId)
    ) {
      return { fehler: "Empfänger ungültig" };
    }
    const datum = body.datum === undefined ? heute() : body.datum;
    if (typeof datum !== "string" || !gueltigesDatum(datum)) {
      return { fehler: "Datum ungültig" };
    }
    return { anId, betragCent, datum };
  }

  const zeigeBegleichung = (
    gruppeId: number,
    id: number,
  ) => {
    const z = db
      .prepare(
        `SELECT s.id, s.amount_cents AS betragCent, s.date AS datum,
                s.from_id AS vonId, uf.name AS vonName,
                s.to_id AS anId, ut.name AS anName
         FROM settlements s
         JOIN users uf ON uf.id = s.from_id JOIN users ut ON ut.id = s.to_id
         WHERE s.id = ? AND s.group_id = ?`,
      )
      .get(id, gruppeId) as unknown as {
        id: number;
        betragCent: number;
        datum: string;
        vonId: number;
        vonName: string;
        anId: number;
        anName: string;
      };
    return {
      id: z.id,
      von: { id: z.vonId, name: z.vonName },
      an: { id: z.anId, name: z.anName },
      betragCent: z.betragCent,
      datum: z.datum,
    };
  };

  app.post("/api/gruppen/:id/begleichungen", async (c) => {
    const user = c.get("user")!;
    const gruppeId = Number(c.req.param("id"));
    if (!istMitglied(db, gruppeId, user.id)) return c.json(nichtGefunden, 404);
    const e = await pruefeBegleichung(c, gruppeId, user.id);
    if ("fehler" in e) return c.json({ fehler: e.fehler }, 400);
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO settlements (group_id, from_id, to_id, amount_cents, date)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(gruppeId, user.id, e.anId, e.betragCent, e.datum);
    return c.json(zeigeBegleichung(gruppeId, Number(lastInsertRowid)), 201);
  });

  /** Lädt die Begleichung: 404 für Fremde, 403 für alle außer dem Eintragenden. */
  function eigeneBegleichung(c: Context<Env>) {
    const user = c.get("user")!;
    const gruppeId = Number(c.req.param("id"));
    if (!istMitglied(db, gruppeId, user.id)) {
      return { antwort: c.json(nichtGefunden, 404) };
    }
    const id = Number(c.req.param("begleichungId"));
    const zeile = db
      .prepare("SELECT from_id FROM settlements WHERE id = ? AND group_id = ?")
      .get(id, gruppeId) as { from_id: number } | undefined;
    if (!zeile) {
      return { antwort: c.json({ fehler: "Begleichung nicht gefunden" }, 404) };
    }
    if (zeile.from_id !== user.id) {
      return {
        antwort: c.json(
          { fehler: "Nur der Eintragende darf die Begleichung ändern" },
          403,
        ),
      };
    }
    return { antwort: undefined, gruppeId, id, user };
  }

  app.put("/api/gruppen/:id/begleichungen/:begleichungId", async (c) => {
    const r = eigeneBegleichung(c);
    if (r.antwort) return r.antwort;
    const e = await pruefeBegleichung(c, r.gruppeId, r.user.id);
    if ("fehler" in e) return c.json({ fehler: e.fehler }, 400);
    db.prepare(
      "UPDATE settlements SET to_id = ?, amount_cents = ?, date = ? WHERE id = ?",
    ).run(e.anId, e.betragCent, e.datum, r.id);
    return c.json(zeigeBegleichung(r.gruppeId, r.id));
  });

  app.delete("/api/gruppen/:id/begleichungen/:begleichungId", (c) => {
    const r = eigeneBegleichung(c);
    if (r.antwort) return r.antwort;
    db.prepare("DELETE FROM settlements WHERE id = ?").run(r.id);
    return c.body(null, 204);
  });

  // Alle Mitglieder der Gruppe sehen alle Begleichungen, auch der Empfänger.
  app.get("/api/gruppen/:id/begleichungen", (c) => {
    const user = c.get("user")!;
    const gruppeId = Number(c.req.param("id"));
    if (!istMitglied(db, gruppeId, user.id)) return c.json(nichtGefunden, 404);
    const ids = db
      .prepare(
        "SELECT id FROM settlements WHERE group_id = ? ORDER BY date DESC, id DESC",
      )
      .all(gruppeId) as unknown as { id: number }[];
    return c.json(ids.map(({ id }) => zeigeBegleichung(gruppeId, id)));
  });
}
