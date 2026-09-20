import type { Hono } from "@hono/hono";
import type { DatabaseSync } from "node:sqlite";
import type { Env } from "./app.ts";
import { log } from "./log.ts";

export interface Mitglied {
  id: number;
  name: string;
}

export function mitglieder(db: DatabaseSync, gruppeId: number): Mitglied[] {
  return db
    .prepare(
      `SELECT u.id, u.name FROM group_members m JOIN users u ON u.id = m.user_id
       WHERE m.group_id = ? ORDER BY m.position`,
    )
    .all(gruppeId) as unknown as Mitglied[];
}

export const istMitglied = (
  db: DatabaseSync,
  gruppeId: number,
  userId: number,
) =>
  !!db
    .prepare("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?")
    .get(gruppeId, userId);

export function registerGroupRoutes(app: Hono<Env>, db: DatabaseSync) {
  // Nicht-Mitglieder erfahren nichts über die Gruppe: überall 404.
  const nichtGefunden = { fehler: "Gruppe nicht gefunden" };

  app.get("/api/gruppen", (c) => {
    const user = c.get("user")!;
    const gruppen = db
      .prepare(
        `SELECT g.id, g.name FROM groups g JOIN group_members m ON m.group_id = g.id
         WHERE m.user_id = ? ORDER BY g.name, g.id`,
      )
      .all(user.id) as unknown as { id: number; name: string }[];
    return c.json(
      gruppen.map((g) => ({ ...g, mitglieder: mitglieder(db, g.id) })),
    );
  });

  app.post("/api/gruppen", async (c) => {
    const user = c.get("user")!;
    const body = await c.req.json().catch(() => ({})) as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return c.json({ fehler: "Name fehlt" }, 400);
    db.exec("BEGIN");
    try {
      const { lastInsertRowid } = db
        .prepare("INSERT INTO groups (name, created_by) VALUES (?, ?)")
        .run(name, user.id);
      const id = Number(lastInsertRowid);
      db.prepare("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)")
        .run(id, user.id);
      db.exec("COMMIT");
      log.ereignis("gruppe.angelegt", { gruppeId: id, nutzerId: user.id });
      return c.json({ id, name, mitglieder: mitglieder(db, id) }, 201);
    } catch (e) {
      db.exec("ROLLBACK");
      log.fehler("gruppe.anlegen-fehlgeschlagen", e, { nutzerId: user.id });
      throw e;
    }
  });

  app.get("/api/gruppen/:id", (c) => {
    const user = c.get("user")!;
    const id = Number(c.req.param("id"));
    if (!istMitglied(db, id, user.id)) return c.json(nichtGefunden, 404);
    const g = db.prepare("SELECT id, name FROM groups WHERE id = ?").get(id);
    return c.json({ ...g, mitglieder: mitglieder(db, id) });
  });

  // Bestehende Nutzer, die der Gruppe noch nicht angehören (nur für Mitglieder).
  app.get("/api/gruppen/:id/kandidaten", (c) => {
    const user = c.get("user")!;
    const id = Number(c.req.param("id"));
    if (!istMitglied(db, id, user.id)) return c.json(nichtGefunden, 404);
    return c.json(
      db
        .prepare(
          `SELECT id, name FROM users
           WHERE id NOT IN (SELECT user_id FROM group_members WHERE group_id = ?)
           ORDER BY name`,
        )
        .all(id),
    );
  });

  app.post("/api/gruppen/:id/mitglieder", async (c) => {
    const user = c.get("user")!;
    const id = Number(c.req.param("id"));
    if (!istMitglied(db, id, user.id)) return c.json(nichtGefunden, 404);
    const body = await c.req.json().catch(() => ({})) as { nutzerId?: unknown };
    const nutzerId = body.nutzerId;
    if (
      typeof nutzerId !== "number" ||
      !db.prepare("SELECT 1 FROM users WHERE id = ?").get(nutzerId)
    ) {
      return c.json({ fehler: "Nutzer nicht gefunden" }, 404);
    }
    if (istMitglied(db, id, nutzerId)) {
      return c.json({ fehler: "Bereits Mitglied" }, 409);
    }
    db.prepare("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)")
      .run(id, nutzerId);
    log.ereignis("mitglied.hinzugefuegt", {
      gruppeId: id,
      nutzerId,
      durchNutzerId: user.id,
    });
    return c.json({ id, mitglieder: mitglieder(db, id) }, 201);
  });
}
