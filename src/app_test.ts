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

async function gruppeMit(
  app: ReturnType<typeof frischeApp>["app"],
  db: ReturnType<typeof frischeApp>["db"],
  namen: string[],
) {
  const sessions = namen.map((name) => createTestSession(db, { name }));
  const res = await app.request(
    "/api/gruppen",
    json(sessions[0].headers, { name: "Reise" }),
  );
  const { id } = await res.json();
  for (const s of sessions.slice(1)) {
    await app.request(
      `/api/gruppen/${id}/mitglieder`,
      json(sessions[0].headers, { nutzerId: s.userId }),
    );
  }
  return { id: id as number, sessions };
}

const ausgabe = (
  app: ReturnType<typeof frischeApp>["app"],
  id: number,
  headers: Record<string, string>,
  body: unknown,
) => app.request(`/api/gruppen/${id}/ausgaben`, json(headers, body));

const schulden = async (
  app: ReturnType<typeof frischeApp>["app"],
  id: number,
  headers: Record<string, string>,
) =>
  (await (await app.request(`/api/gruppen/${id}/schulden`, { headers })).json())
    .map((
      s: { von: { name: string }; an: { name: string }; betragCent: number },
    ) => [s.von.name, s.an.name, s.betragCent]);

Deno.test("Ausgabe zu zweit: Zahler zählt mit, Gegenüber schuldet die Hälfte", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna, ben] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
  ]);
  const res = await ausgabe(app, id, anna.headers, {
    betragCent: 1001,
    beschreibung: "Essen",
    datum: "2026-05-01",
  });
  assertEquals(res.status, 201);
  // 1001 / 2: Restcent an das erste Mitglied (Anna, Zahlerin) – Ben schuldet 500.
  assertEquals(await schulden(app, id, ben.headers), [["Ben", "Anna", 500]]);
  const liste = await (await app.request(`/api/gruppen/${id}/ausgaben`, {
    headers: ben.headers,
  })).json();
  assertEquals(liste.length, 1);
  assertEquals(liste[0].zahler.name, "Anna");
  assertEquals(liste[0].betragCent, 1001);
  assertEquals(liste[0].datum, "2026-05-01");
  assertEquals(liste[0].beschreibung, "Essen");
});

Deno.test("Ausgabe zu dritt: 1000 Cent, Restcent in Beitrittsreihenfolge", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna, ben, cem] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
    "Cem",
  ]);
  await ausgabe(app, id, cem.headers, {
    betragCent: 1000,
    beschreibung: "Taxi",
  });
  // Anteile: Anna 334, Ben 333, Cem 333 (Zahler).
  assertEquals(await schulden(app, id, anna.headers), [
    ["Anna", "Cem", 334],
    ["Ben", "Cem", 333],
  ]);
  const summe = db.prepare("SELECT SUM(share_cents) AS s FROM expense_shares")
    .get();
  assertEquals(summe, { s: 1000 });
});

Deno.test("Schulden in beide Richtungen werden verrechnet", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna, ben] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
  ]);
  await ausgabe(app, id, anna.headers, { betragCent: 2000, beschreibung: "A" });
  await ausgabe(app, id, ben.headers, { betragCent: 600, beschreibung: "B" });
  assertEquals(await schulden(app, id, anna.headers), [["Ben", "Anna", 700]]);
  await ausgabe(app, id, ben.headers, { betragCent: 1400, beschreibung: "C" });
  assertEquals(await schulden(app, id, anna.headers), []);
});

Deno.test("Ausgabe: Standarddatum heute, Validierung, Nicht-Mitglied 404", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna] } = await gruppeMit(app, db, ["Anna"]);
  const res = await ausgabe(app, id, anna.headers, {
    betragCent: 500,
    beschreibung: "Kaffee",
  });
  assertEquals((await res.json()).datum, new Date().toISOString().slice(0, 10));
  for (
    const kaputt of [
      { betragCent: 0, beschreibung: "x" },
      { betragCent: 1.5, beschreibung: "x" },
      { betragCent: "5", beschreibung: "x" },
      { betragCent: 5, beschreibung: " " },
      { betragCent: 5, beschreibung: "x", datum: "2026-02-30" },
    ]
  ) {
    assertEquals((await ausgabe(app, id, anna.headers, kaputt)).status, 400);
  }
  const fremd = createTestSession(db, { name: "Fremd" });
  assertEquals(
    (await ausgabe(app, id, fremd.headers, {
      betragCent: 5,
      beschreibung: "x",
    }))
      .status,
    404,
  );
  for (const pfad of ["ausgaben", "schulden"]) {
    const r = await app.request(`/api/gruppen/${id}/${pfad}`, {
      headers: fremd.headers,
    });
    assertEquals(r.status, 404);
  }
});

Deno.test("Auswahl mit einem anderen Mitglied: volle Schuld an den Zahler", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna, ben, cem] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
    "Cem",
  ]);
  const res = await ausgabe(app, id, anna.headers, {
    betragCent: 1000,
    beschreibung: "Buch",
    teilnehmerIds: [ben.userId],
  });
  assertEquals(res.status, 201);
  assertEquals(await schulden(app, id, cem.headers), [["Ben", "Anna", 1000]]);
});

Deno.test("Auswahl mit Zahler: Zahler zählt mit, Nichtgewählte schulden nichts", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna, ben] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
    "Cem",
  ]);
  await ausgabe(app, id, anna.headers, {
    betragCent: 1000,
    beschreibung: "Kino",
    teilnehmerIds: [anna.userId, ben.userId],
  });
  assertEquals(await schulden(app, id, anna.headers), [["Ben", "Anna", 500]]);
});

Deno.test("Verrechnung nur je Paar, nicht über Dritte", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna, ben, cem] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
    "Cem",
  ]);
  await ausgabe(app, id, anna.headers, {
    betragCent: 5000,
    beschreibung: "A",
    teilnehmerIds: [ben.userId],
  });
  await ausgabe(app, id, ben.headers, {
    betragCent: 2000,
    beschreibung: "B",
    teilnehmerIds: [anna.userId],
  });
  await ausgabe(app, id, ben.headers, {
    betragCent: 1000,
    beschreibung: "C",
    teilnehmerIds: [cem.userId],
  });
  // Ben→Anna 30 €, Cem→Ben 10 €: keine Kette Cem→Anna.
  assertEquals(await schulden(app, id, anna.headers), [
    ["Ben", "Anna", 3000],
    ["Cem", "Ben", 1000],
  ]);
});

Deno.test("Keine Verrechnung zwischen Gruppen", async () => {
  const { app, db } = frischeApp();
  const { id: g1, sessions: [anna, ben] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
  ]);
  const g2 = (await (await app.request(
    "/api/gruppen",
    json(anna.headers, { name: "Zweite" }),
  )).json()).id;
  await app.request(
    `/api/gruppen/${g2}/mitglieder`,
    json(anna.headers, { nutzerId: ben.userId }),
  );
  await ausgabe(app, g1, anna.headers, { betragCent: 2000, beschreibung: "A" });
  await ausgabe(app, g2, ben.headers, { betragCent: 2000, beschreibung: "B" });
  assertEquals(await schulden(app, g1, anna.headers), [["Ben", "Anna", 1000]]);
  assertEquals(await schulden(app, g2, anna.headers), [["Anna", "Ben", 1000]]);
});

Deno.test("Ungültige Auswahl wird abgelehnt", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna, ben] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
  ]);
  const fremd = createTestSession(db, { name: "Fremd" });
  for (
    const auswahl of [[], [fremd.userId], [ben.userId, ben.userId], "x", [null]]
  ) {
    const r = await ausgabe(app, id, anna.headers, {
      betragCent: 100,
      beschreibung: "x",
      teilnehmerIds: auswahl,
    });
    assertEquals(r.status, 400);
  }
});

const aendern = (
  app: ReturnType<typeof frischeApp>["app"],
  id: number,
  ausgabeId: number,
  headers: Record<string, string>,
  body: unknown,
) =>
  app.request(`/api/gruppen/${id}/ausgaben/${ausgabeId}`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test("Zahler ändert Ausgabe: Schulden werden neu berechnet", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna, ben, cem] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
    "Cem",
  ]);
  const { id: aid } = await (await ausgabe(app, id, anna.headers, {
    betragCent: 3000,
    beschreibung: "Essen",
  })).json();
  const r = await aendern(app, id, aid, anna.headers, {
    betragCent: 1000,
    beschreibung: "Kaffee",
    datum: "2026-01-02",
    teilnehmerIds: [anna.userId, cem.userId],
  });
  assertEquals(r.status, 200);
  assertEquals((await r.json()).beschreibung, "Kaffee");
  assertEquals(await schulden(app, id, ben.headers), [["Cem", "Anna", 500]]);
  const liste = await (await app.request(`/api/gruppen/${id}/ausgaben`, {
    headers: anna.headers,
  })).json();
  assertEquals(liste.length, 1);
  assertEquals(liste[0].datum, "2026-01-02");
  assertEquals(
    (await aendern(app, id, aid, anna.headers, {
      betragCent: 0,
      beschreibung: "x",
    }))
      .status,
    400,
  );
});

Deno.test("Nur der Zahler darf ändern oder löschen", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna, ben] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
  ]);
  const fremd = createTestSession(db, { name: "Fremd" });
  const { id: aid } = await (await ausgabe(app, id, anna.headers, {
    betragCent: 2000,
    beschreibung: "A",
  })).json();
  const neu = { betragCent: 1, beschreibung: "B" };
  assertEquals((await aendern(app, id, aid, ben.headers, neu)).status, 403);
  const del = (headers: Record<string, string>) =>
    app.request(`/api/gruppen/${id}/ausgaben/${aid}`, {
      method: "DELETE",
      headers,
    });
  assertEquals((await del(ben.headers)).status, 403);
  assertEquals((await aendern(app, id, aid, fremd.headers, neu)).status, 404);
  assertEquals((await del(fremd.headers)).status, 404);
  assertEquals(await schulden(app, id, anna.headers), [["Ben", "Anna", 1000]]);
});

Deno.test("Zahler löscht Ausgabe: Schulden verschwinden", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna, ben] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
  ]);
  const { id: aid } = await (await ausgabe(app, id, anna.headers, {
    betragCent: 2000,
    beschreibung: "A",
  })).json();
  const del = () =>
    app.request(`/api/gruppen/${id}/ausgaben/${aid}`, {
      method: "DELETE",
      headers: anna.headers,
    });
  assertEquals((await del()).status, 204);
  assertEquals(await schulden(app, id, ben.headers), []);
  assertEquals((await del()).status, 404);
});
