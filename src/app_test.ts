import { assertEquals, assertStringIncludes } from "@std/assert";
import { createApp } from "./app.ts";
import { openDatabase } from "./db.ts";
import { createTestSession } from "./testing.ts";

function frischeApp() {
  const db = openDatabase(":memory:");
  return {
    db,
    app: createApp(db, {
      domain: "ausgaben.example.de",
      origin: "https://ausgaben.example.de",
    }),
  };
}

Deno.test("Startseite (ohne Anmeldung) ist deutsch", async () => {
  const { app } = frischeApp();
  const res = await app.request("/");
  assertEquals(res.status, 200);
  assertStringIncludes(await res.text(), 'lang="de"');
});

Deno.test("/api/me ohne Sitzung: 401", async () => {
  const { app } = frischeApp();
  assertEquals((await app.request("/api/me")).status, 401);
});

Deno.test("/api/me mit Test-Sitzung liefert den Nutzer", async () => {
  const { app, db } = frischeApp();
  const { userId, headers } = createTestSession(db, {
    name: "Anna",
    isAdmin: true,
  });
  const res = await app.request("/api/me", { headers });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { id: userId, name: "Anna", istAdmin: true });
});

const json = (headers: Record<string, string>, body: unknown) => ({
  method: "POST",
  headers: { ...headers, "content-type": "application/json" },
  body: JSON.stringify(body),
});

Deno.test("Admin erzeugt Einladungslink", async () => {
  const { app, db } = frischeApp();
  const { headers } = createTestSession(db, { isAdmin: true });
  const res = await app.request(
    "/api/einladungen",
    json(headers, { name: "Ben" }),
  );
  assertEquals(res.status, 201);
  const { url } = await res.json();
  assertStringIncludes(url, "https://ausgaben.example.de/einladung/");
  assertEquals(db.prepare("SELECT COUNT(*) AS n FROM invites").get(), { n: 1 });
});

Deno.test("Nicht-Admin kann nicht einladen", async () => {
  const { app, db } = frischeApp();
  const { headers } = createTestSession(db, { isAdmin: false });
  const res = await app.request(
    "/api/einladungen",
    json(headers, { name: "Ben" }),
  );
  assertEquals(res.status, 403);
  assertEquals(db.prepare("SELECT COUNT(*) AS n FROM invites").get(), { n: 0 });
  assertEquals((await app.request("/api/nutzer", { headers })).status, 403);
});

Deno.test("Ohne Anmeldung kann niemand einladen; API ist gesperrt", async () => {
  const { app } = frischeApp();
  assertEquals(
    (await app.request("/api/einladungen", json({}, { name: "Ben" }))).status,
    401,
  );
  assertEquals((await app.request("/api/nutzer")).status, 401);
  assertEquals((await app.request("/api/health")).status, 200);
});

Deno.test("Neuer Einladungslink für bestehenden Nutzer", async () => {
  const { app, db } = frischeApp();
  const { headers } = createTestSession(db, { isAdmin: true });
  const { userId } = createTestSession(db, { name: "Cara" });
  const res = await app.request(
    "/api/einladungen",
    json(headers, { nutzerId: userId }),
  );
  assertEquals(res.status, 201);
  assertEquals(db.prepare("SELECT user_id FROM invites").get(), {
    user_id: userId,
  });
  assertEquals(
    (await app.request("/api/einladungen", json(headers, { nutzerId: 999 })))
      .status,
    404,
  );
});

Deno.test("Einladung: gültig liefert Optionen, verbraucht/abgelaufen nicht", async () => {
  const { app, db } = frischeApp();
  const { headers } = createTestSession(db, { isAdmin: true });
  const { url } = await (await app.request(
    "/api/einladungen",
    json(headers, { name: "Ben" }),
  )).json();
  const token = url.split("/").pop();

  const ok = await app.request(
    `/api/einladung/${token}/optionen`,
    json({}, {}),
  );
  assertEquals(ok.status, 200);
  assertEquals((await ok.json()).optionen.rp.id, "ausgaben.example.de");
  assertEquals((await app.request(`/einladung/${token}`)).status, 200);

  db.prepare("UPDATE invites SET used_at = 1 WHERE token = ?").run(token);
  assertEquals(
    (await app.request(`/api/einladung/${token}/optionen`, json({}, {})))
      .status,
    410,
  );
  assertEquals(
    (await app.request(`/api/einladung/${token}/registrieren`, json({}, {})))
      .status,
    410,
  );
  assertEquals((await app.request(`/einladung/${token}`)).status, 410);
});

Deno.test("Login ohne gültige Challenge/Passkey wird abgelehnt", async () => {
  const { app } = frischeApp();
  assertEquals(
    (await app.request("/api/login/optionen", json({}, {}))).status,
    200,
  );
  const res = await app.request(
    "/api/login",
    json({}, { challengeId: "x", antwort: { id: "y" } }),
  );
  assertEquals(res.status, 400);
});

Deno.test("Gruppe anlegen: Ersteller ist Mitglied; Mitglieder in Beitrittsreihenfolge", async () => {
  const { app, db } = frischeApp();
  const anna = createTestSession(db, { name: "Anna" });
  const ben = createTestSession(db, { name: "Ben" });
  const cara = createTestSession(db, { name: "Cara" });
  const res = await app.request(
    "/api/gruppen",
    json(anna.headers, { name: "Japan" }),
  );
  assertEquals(res.status, 201);
  const g = await res.json();
  assertEquals(g.mitglieder.map((m: { name: string }) => m.name), ["Anna"]);
  for (const u of [cara, ben]) {
    const r = await app.request(
      `/api/gruppen/${g.id}/mitglieder`,
      json(anna.headers, { nutzerId: u.userId }),
    );
    assertEquals(r.status, 201);
  }
  const detail =
    await (await app.request(`/api/gruppen/${g.id}`, { headers: anna.headers }))
      .json();
  assertEquals(detail.mitglieder.map((m: { name: string }) => m.name), [
    "Anna",
    "Cara",
    "Ben",
  ]);
  const pos = db.prepare(
    "SELECT user_id FROM group_members WHERE group_id = ? ORDER BY position",
  ).all(g.id);
  assertEquals(pos.map((p) => p.user_id), [
    anna.userId,
    cara.userId,
    ben.userId,
  ]);
});

Deno.test("Gruppenliste zeigt nur eigene Gruppen; Nicht-Mitglied sieht nichts", async () => {
  const { app, db } = frischeApp();
  const anna = createTestSession(db, { name: "Anna" });
  const ben = createTestSession(db, { name: "Ben" });
  const g1 = await (await app.request(
    "/api/gruppen",
    json(anna.headers, { name: "Japan" }),
  )).json();
  await app.request("/api/gruppen", json(anna.headers, { name: "WG" }));
  await app.request("/api/gruppen", json(ben.headers, { name: "Skat" }));
  const namen = async (h: Record<string, string>) =>
    (await (await app.request("/api/gruppen", { headers: h })).json()).map((
      g: { name: string },
    ) => g.name);
  assertEquals(await namen(anna.headers), ["Japan", "WG"]);
  assertEquals(await namen(ben.headers), ["Skat"]);
  assertEquals(
    (await app.request(`/api/gruppen/${g1.id}`, { headers: ben.headers }))
      .status,
    404,
  );
  assertEquals(
    (await app.request(
      `/api/gruppen/${g1.id}/mitglieder`,
      json(ben.headers, { nutzerId: ben.userId }),
    )).status,
    404,
  );
  assertEquals((await app.request("/api/gruppen")).status, 401);
});

Deno.test("Mitglied hinzufügen: nur bestehende Nutzer, keine Duplikate", async () => {
  const { app, db } = frischeApp();
  const anna = createTestSession(db, { name: "Anna" });
  const ben = createTestSession(db, { name: "Ben" });
  const g = await (await app.request(
    "/api/gruppen",
    json(anna.headers, { name: "Japan" }),
  )).json();
  const add = (body: unknown) =>
    app.request(`/api/gruppen/${g.id}/mitglieder`, json(anna.headers, body));
  assertEquals((await add({ nutzerId: 9999 })).status, 404);
  assertEquals((await add({ name: "Neu" })).status, 404);
  assertEquals((await add({ nutzerId: ben.userId })).status, 201);
  assertEquals((await add({ nutzerId: ben.userId })).status, 409);
  assertEquals(db.prepare("SELECT COUNT(*) AS n FROM users").get(), { n: 2 });
  assertEquals(
    (await app.request("/api/gruppen", json(anna.headers, { name: " " })))
      .status,
    400,
  );
});
