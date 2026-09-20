import { assertEquals, assertStringIncludes } from "@std/assert";

// Tests laufen still; das Protokoll wird in log_test.ts eigens geprüft.
Deno.env.set("LOG", "aus");

import { createApp } from "./app.ts";
import { CHALLENGES_MAX } from "./auth.ts";
import { openDatabase } from "./db.ts";
import { createTestSession } from "./testing.ts";

/** Fake-Kursdienst: Kurs pro Datum steuerbar, zählt Abrufe. */
function fakeKurs(kurse: Record<string, number> = {}) {
  const dienst = {
    abrufe: 0,
    kurse,
    yenInEuro(datum: string): Promise<number> {
      dienst.abrufe++;
      const k = dienst.kurse[datum];
      return k === undefined
        ? Promise.reject(new Error("kein Kurs"))
        : Promise.resolve(k);
    },
  };
  return dienst;
}

function frischeApp(kurs = fakeKurs()) {
  const db = openDatabase(":memory:");
  return {
    db,
    kurs,
    app: createApp(db, {
      domain: "ausgaben.example.de",
      origin: "https://ausgaben.example.de",
    }, kurs),
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
  // Die Detailansicht zeigt, auf wen aufgeteilt wurde.
  assertEquals(liste[0].beteiligte, [
    { id: anna.userId, name: "Anna", anteilCent: 501 },
    { id: ben.userId, name: "Ben", anteilCent: 500 },
  ]);
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

const begleichung = (
  app: ReturnType<typeof frischeApp>["app"],
  id: number,
  headers: Record<string, string>,
  body: unknown,
  method = "POST",
  bid?: number,
) =>
  app.request(
    `/api/gruppen/${id}/begleichungen${bid ? `/${bid}` : ""}`,
    { ...json(headers, body), method },
  );

Deno.test("Begleichung (auch Teilbetrag) mindert die Schuld sofort", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna, ben] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
  ]);
  await ausgabe(app, id, anna.headers, { betragCent: 2000, beschreibung: "A" });
  const res = await begleichung(app, id, ben.headers, {
    anId: anna.userId,
    betragCent: 300,
  });
  assertEquals(res.status, 201);
  assertEquals(await schulden(app, id, ben.headers), [["Ben", "Anna", 700]]);
  // Der Empfänger sieht die Begleichung.
  const liste = await (await app.request(`/api/gruppen/${id}/begleichungen`, {
    headers: anna.headers,
  })).json();
  assertEquals(liste.length, 1);
  assertEquals(liste[0].von.name, "Ben");
  assertEquals(liste[0].an.name, "Anna");
  assertEquals(liste[0].betragCent, 300);
});

Deno.test("Begleichung: volle Zahlung, ungültige Eingaben", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna, ben] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
  ]);
  const fremd = createTestSession(db, { name: "Fremd" });
  await ausgabe(app, id, anna.headers, { betragCent: 2000, beschreibung: "A" });
  const ok = { anId: anna.userId, betragCent: 1000 };
  for (
    const schlecht of [
      { ...ok, betragCent: 0 },
      { ...ok, betragCent: 1.5 },
      { ...ok, anId: ben.userId },
      { ...ok, anId: fremd.userId },
      { ...ok, datum: "gestern" },
    ]
  ) {
    assertEquals(
      (await begleichung(app, id, ben.headers, schlecht)).status,
      400,
    );
  }
  assertEquals((await begleichung(app, id, fremd.headers, ok)).status, 404);
  assertEquals((await begleichung(app, id, ben.headers, ok)).status, 201);
  assertEquals(await schulden(app, id, ben.headers), []);
});

Deno.test("Nur der Eintragende ändert oder nimmt die Begleichung zurück", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna, ben] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
  ]);
  const fremd = createTestSession(db, { name: "Fremd" });
  await ausgabe(app, id, anna.headers, { betragCent: 2000, beschreibung: "A" });
  const { id: bid } = await (await begleichung(app, id, ben.headers, {
    anId: anna.userId,
    betragCent: 300,
  })).json();
  const neu = { anId: anna.userId, betragCent: 500 };
  const del = (headers: Record<string, string>) =>
    app.request(`/api/gruppen/${id}/begleichungen/${bid}`, {
      method: "DELETE",
      headers,
    });
  // Empfänger und Fremde bekommen einen Fehler.
  assertEquals(
    (await begleichung(app, id, anna.headers, neu, "PUT", bid)).status,
    403,
  );
  assertEquals((await del(anna.headers)).status, 403);
  assertEquals(
    (await begleichung(app, id, fremd.headers, neu, "PUT", bid)).status,
    404,
  );
  assertEquals((await del(fremd.headers)).status, 404);
  assertEquals(await schulden(app, id, ben.headers), [["Ben", "Anna", 700]]);
  // Der Eintragende ändert, dann nimmt er zurück.
  assertEquals(
    (await begleichung(app, id, ben.headers, neu, "PUT", bid)).status,
    200,
  );
  assertEquals(await schulden(app, id, ben.headers), [["Ben", "Anna", 500]]);
  assertEquals((await del(ben.headers)).status, 204);
  assertEquals(await schulden(app, id, ben.headers), [["Ben", "Anna", 1000]]);
  assertEquals((await del(ben.headers)).status, 404);
});

Deno.test("Begleichungen wirken je Gruppe getrennt", async () => {
  const { app, db } = frischeApp();
  const g1 = await gruppeMit(app, db, ["Anna", "Ben"]);
  const [anna, ben] = g1.sessions;
  // Zweite Gruppe mit denselben Nutzern.
  const g2 = (await (await app.request(
    "/api/gruppen",
    json(anna.headers, { name: "Zwei" }),
  )).json()).id;
  await app.request(
    `/api/gruppen/${g2}/mitglieder`,
    json(anna.headers, { nutzerId: ben.userId }),
  );
  await ausgabe(app, g1.id, anna.headers, {
    betragCent: 2000,
    beschreibung: "A",
  });
  await ausgabe(app, g2, anna.headers, { betragCent: 2000, beschreibung: "B" });
  await begleichung(app, g1.id, ben.headers, {
    anId: anna.userId,
    betragCent: 1000,
  });
  assertEquals(await schulden(app, g1.id, ben.headers), []);
  assertEquals(await schulden(app, g2, ben.headers), [["Ben", "Anna", 1000]]);
});

Deno.test("Yen-Ausgabe: Tageskurs wird geholt, gespeichert und bleibt fix", async () => {
  const { app, db, kurs } = frischeApp(fakeKurs({ "2026-05-01": 0.0061 }));
  const { id, sessions: [anna, ben] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
  ]);
  const res = await ausgabe(app, id, anna.headers, {
    waehrung: "JPY",
    betragYen: 5001,
    beschreibung: "Ramen",
    datum: "2026-05-01",
  });
  assertEquals(res.status, 201);
  const neu = await res.json();
  // 5001 * 0,0061 = 30,5061 € → 3051 Cent; halbiert 1526 / 1525.
  assertEquals(neu.betragCent, 3051);
  assertEquals(neu.kurs, 0.0061);
  assertEquals(await schulden(app, id, ben.headers), [["Ben", "Anna", 1525]]);
  // Kurs ändert sich später: gespeicherter Wert bleibt.
  kurs.kurse["2026-05-01"] = 0.01;
  const liste = await (await app.request(`/api/gruppen/${id}/ausgaben`, {
    headers: ben.headers,
  })).json();
  assertEquals(liste[0].waehrung, "JPY");
  assertEquals(liste[0].betragYen, 5001);
  assertEquals(liste[0].kurs, 0.0061);
  // Ändern (ohne Kurs) behält den gespeicherten Kurs und ruft nicht neu ab.
  const abrufe = kurs.abrufe;
  const put = await app.request(`/api/gruppen/${id}/ausgaben/${neu.id}`, {
    method: "PUT",
    headers: { ...anna.headers, "content-type": "application/json" },
    body: JSON.stringify({
      waehrung: "JPY",
      betragYen: 10000,
      beschreibung: "Ramen",
      datum: "2026-05-01",
    }),
  });
  assertEquals(put.status, 200);
  const geaendert = await put.json();
  assertEquals(geaendert.kurs, 0.0061);
  assertEquals(geaendert.betragCent, 6100);
  assertEquals(kurs.abrufe, abrufe);
});

Deno.test("Yen-Ausgabe: Kurs manuell überschreiben, fehlender Kurs, Validierung", async () => {
  const { app, db, kurs } = frischeApp();
  const { id, sessions: [anna] } = await gruppeMit(app, db, ["Anna", "Ben"]);
  const yen = { waehrung: "JPY", beschreibung: "Zug", datum: "2026-05-02" };
  const ok = await ausgabe(app, id, anna.headers, {
    ...yen,
    betragYen: 1000,
    kurs: 0.007,
  });
  assertEquals(ok.status, 201);
  assertEquals((await ok.json()).betragCent, 700);
  assertEquals(kurs.abrufe, 0);
  // Kein Kurs verfügbar und keiner angegeben: 502.
  assertEquals(
    (await ausgabe(app, id, anna.headers, { ...yen, betragYen: 1000 })).status,
    502,
  );
  for (
    const kaputt of [
      { betragYen: 0 },
      { betragYen: 10.5 },
      { betragYen: 1000, kurs: -1 },
      { betragYen: 1000, kurs: "x" },
      { betragCent: 1000 },
    ]
  ) {
    assertEquals(
      (await ausgabe(app, id, anna.headers, { ...yen, kurs: 0.007, ...kaputt }))
        .status,
      400,
    );
  }
  assertEquals(
    (await ausgabe(app, id, anna.headers, {
      waehrung: "USD",
      betragCent: 100,
      beschreibung: "x",
    })).status,
    400,
  );
});

const belegPfad = (g: number, a: number) =>
  `/api/gruppen/${g}/ausgaben/${a}/beleg`;
const belegHoch = (
  app: ReturnType<typeof frischeApp>["app"],
  pfad: string,
  headers: Record<string, string>,
  daten: Uint8Array,
  typ = "image/jpeg",
) =>
  app.request(pfad, {
    method: "PUT",
    headers: { ...headers, "content-type": typ },
    body: daten as Uint8Array<ArrayBuffer>,
  });

Deno.test("Beleg: Zahler lädt hoch, alle Mitglieder rufen ihn ab", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna, ben] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
  ]);
  const { id: a } = await (await ausgabe(app, id, anna.headers, {
    betragCent: 1000,
    beschreibung: "Essen",
  })).json();
  const bild = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
  assertEquals(
    (await belegHoch(app, belegPfad(id, a), anna.headers, bild)).status,
    204,
  );
  for (const s of [anna, ben]) {
    const res = await app.request(belegPfad(id, a), { headers: s.headers });
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-type"), "image/jpeg");
    assertEquals(new Uint8Array(await res.arrayBuffer()), bild);
  }
  const liste = await (await app.request(`/api/gruppen/${id}/ausgaben`, {
    headers: ben.headers,
  })).json();
  assertEquals(liste[0].hatBeleg, true);
});

Deno.test("Beleg: Nicht-Mitglieder erhalten 404, ohne Anmeldung 401", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna] } = await gruppeMit(app, db, ["Anna"]);
  const fremd = createTestSession(db, { name: "Fremd" });
  const { id: a } = await (await ausgabe(app, id, anna.headers, {
    betragCent: 1000,
    beschreibung: "Essen",
  })).json();
  await belegHoch(app, belegPfad(id, a), anna.headers, new Uint8Array([1]));
  assertEquals(
    (await app.request(belegPfad(id, a), { headers: fremd.headers })).status,
    404,
  );
  assertEquals(
    (await belegHoch(app, belegPfad(id, a), fremd.headers, new Uint8Array([1])))
      .status,
    404,
  );
  assertEquals((await app.request(belegPfad(id, a))).status, 401);
});

Deno.test("Beleg: nur der Zahler lädt hoch; Typ und Größe werden geprüft", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna, ben] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
  ]);
  const { id: a } = await (await ausgabe(app, id, anna.headers, {
    betragCent: 1000,
    beschreibung: "Essen",
  })).json();
  const p = belegPfad(id, a);
  assertEquals(
    (await belegHoch(app, p, ben.headers, new Uint8Array([1]))).status,
    403,
  );
  assertEquals(
    (await belegHoch(app, p, anna.headers, new Uint8Array([1]), "text/html"))
      .status,
    400,
  );
  assertEquals(
    (await belegHoch(app, p, anna.headers, new Uint8Array(0))).status,
    400,
  );
  assertEquals(
    (await belegHoch(
      app,
      p,
      anna.headers,
      new Uint8Array(10 * 1024 * 1024 + 1),
    )).status,
    413,
  );
  // ohne Beleg: 404 und hatBeleg false
  assertEquals((await app.request(p, { headers: ben.headers })).status, 404);
  const liste = await (await app.request(`/api/gruppen/${id}/ausgaben`, {
    headers: ben.headers,
  })).json();
  assertEquals(liste[0].hatBeleg, false);
});

Deno.test("Beleg: Löschen der Ausgabe entfernt den Beleg", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna] } = await gruppeMit(app, db, ["Anna"]);
  const { id: a } = await (await ausgabe(app, id, anna.headers, {
    betragCent: 1000,
    beschreibung: "Essen",
  })).json();
  await belegHoch(app, belegPfad(id, a), anna.headers, new Uint8Array([1]));
  const res = await app.request(`/api/gruppen/${id}/ausgaben/${a}`, {
    method: "DELETE",
    headers: anna.headers,
  });
  assertEquals(res.status, 204);
  assertEquals(db.prepare("SELECT COUNT(*) AS n FROM receipts").get(), {
    n: 0,
  });
});

Deno.test("Beleg: nur der Zahler kann ihn entfernen", async () => {
  const { app, db } = frischeApp();
  const { id, sessions: [anna, ben] } = await gruppeMit(app, db, [
    "Anna",
    "Ben",
  ]);
  const { id: a } = await (await ausgabe(app, id, anna.headers, {
    betragCent: 1000,
    beschreibung: "Essen",
  })).json();
  const p = belegPfad(id, a);
  await belegHoch(app, p, anna.headers, new Uint8Array([1]));
  const del = (h: Record<string, string>) =>
    app.request(p, { method: "DELETE", headers: h });
  assertEquals((await del(ben.headers)).status, 403);
  assertEquals((await del(anna.headers)).status, 204);
  assertEquals((await app.request(p, { headers: ben.headers })).status, 404);
  assertEquals((await del(anna.headers)).status, 404);
});

Deno.test("Gruppenseite bietet Beleg hinzufügen und entfernen; Fremde werden umgeleitet", async () => {
  const { app, db } = frischeApp();
  const { headers } = createTestSession(db, { name: "Anna" });
  const ben = createTestSession(db, { name: "Ben" });
  const g = await (await app.request("/api/gruppen", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ name: "Japan" }),
  })).json();
  const fremd = await app.request(`/gruppen/${g.id}`, { headers: ben.headers });
  assertEquals(fremd.status, 302);
  const html = await (await app.request(`/gruppen/${g.id}`, { headers }))
    .text();
  assertStringIncludes(html, "Beleg hinzufügen");
  assertStringIncludes(html, "Beleg entfernen");
  assertStringIncludes(html, 'method: "DELETE"');
  assertStringIncludes(html, 'id="plus-mitglied"');
  assertStringIncludes(html, 'url("/kandidaten")');
});

Deno.test("Summenvorschlag: liefert Yen aus der Erkennung, ohne Anmeldung 401", async () => {
  const db = openDatabase(":memory:");
  const app = createApp(
    db,
    {
      domain: "ausgaben.example.de",
      origin: "https://ausgaben.example.de",
    },
    fakeKurs(),
    { lies: () => Promise.resolve("合計 ¥1,280\nお預り ¥2,000") },
  );
  const { headers } = createTestSession(db, { name: "Anna" });
  const senden = (h: Record<string, string>, typ = "image/jpeg") =>
    app.request("/api/erkennung/summe", {
      method: "POST",
      headers: { ...h, "content-type": typ },
      body: new Uint8Array([1, 2, 3]),
    });
  assertEquals((await senden({})).status, 401);
  assertEquals((await senden(headers, "text/plain")).status, 400);
  assertEquals(await (await senden(headers)).json(), { summeYen: 1280 });
});

Deno.test("Summenvorschlag: Fehler der Erkennung ergibt null statt Fehlerseite", async () => {
  const db = openDatabase(":memory:");
  const app = createApp(
    db,
    {
      domain: "ausgaben.example.de",
      origin: "https://ausgaben.example.de",
    },
    fakeKurs(),
    { lies: () => Promise.reject(new Error("Zeitlimit")) },
  );
  const { headers } = createTestSession(db, { name: "Anna" });
  const res = await app.request("/api/erkennung/summe", {
    method: "POST",
    headers: { ...headers, "content-type": "image/jpeg" },
    body: new Uint8Array([1]),
  });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { summeYen: null });
});

Deno.test("Web-App-Manifest und Symbole sind ohne Anmeldung abrufbar", async () => {
  const { app } = frischeApp();
  const m = await app.request("/manifest.webmanifest");
  assertEquals(m.status, 200);
  const j = await m.json();
  assertEquals(j.display, "standalone");
  assertEquals(j.start_url, "/");
  for (const i of j.icons) {
    const r = await app.request(i.src);
    assertEquals(r.status, 200);
    assertEquals(r.headers.get("content-type"), "image/png");
    await r.arrayBuffer();
  }
  const html = await (await app.request("/")).text();
  assertStringIncludes(html, 'rel="manifest"');
  assertStringIncludes(html, 'rel="icon"');
  assertEquals((await app.request("/favicon.ico")).status, 200);
});

Deno.test("Schriften kommen vom eigenen Server, nicht von Google", async () => {
  const { app } = frischeApp();
  const html = await (await app.request("/")).text();
  assertEquals(html.includes("fonts.googleapis.com"), false);
  for (const datei of ["dotgothic16", "silkscreen"]) {
    const r = await app.request(`/schriften/${datei}.woff2`);
    assertEquals(r.status, 200);
    assertEquals(r.headers.get("content-type"), "font/woff2");
    const kopf = new Uint8Array(await r.arrayBuffer()).slice(0, 4);
    assertEquals(new TextDecoder().decode(kopf), "wOF2");
  }
  assertEquals((await app.request("/schriften/fremd.woff2")).status, 404);
});

Deno.test("Eigenen Namen ändern: PATCH /api/me", async () => {
  const { app, db } = frischeApp();
  const { headers } = createTestSession(db, { name: "admin" });
  const patch = (h: Record<string, string>, name: unknown) =>
    app.request("/api/me", {
      method: "PATCH",
      headers: { ...h, "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
  assertEquals((await patch({}, "X")).status, 401);
  assertEquals((await patch(headers, "  ")).status, 400);
  assertEquals((await patch(headers, " Chiya ")).status, 200);
  const me = await (await app.request("/api/me", { headers })).json();
  assertEquals(me.name, "Chiya");
});

Deno.test("Gruppenseite verkleinert Belegfotos vor dem Hochladen", async () => {
  const { app, db } = frischeApp();
  const { userId } = createTestSession(db, { name: "Anna" });
  db.prepare("INSERT INTO groups (id, name, created_by) VALUES (1, 'Japan', ?)")
    .run(userId);
  db.prepare("INSERT INTO group_members (group_id, user_id) VALUES (1, ?)")
    .run(userId);
  const { headers } = createTestSession(db, { name: "Anna" });
  db.prepare("INSERT INTO group_members (group_id, user_id) VALUES (1, ?)")
    .run(userId + 1);
  const html = await (await app.request("/gruppen/1", { headers })).text();
  // Verkleinert wird bei der Auswahl im Formular und beim Ersetzen; das
  // Speichern nimmt das dabei erzeugte Bild (Definition + 2 Aufrufe).
  assertStringIncludes(html, "BELEG_KANTE = 1600");
  assertStringIncludes(html, "belegBild = await verkleinern(datei)");
  assertStringIncludes(html, "belegSenden(beleg, await verkleinern(datei))");
  assertStringIncludes(html, 'const beleg = belegBild ?? f.get("beleg")');
  assertEquals(html.split("verkleinern(").length - 1, 3);
});

Deno.test("Sitzung läuft nach 30 Tagen auch serverseitig ab", async () => {
  const { app, db } = frischeApp();
  const { headers } = createTestSession(db);
  assertEquals((await app.request("/api/me", { headers })).status, 200);
  db.exec("UPDATE sessions SET created_at = datetime('now', '-31 days')");
  assertEquals((await app.request("/api/me", { headers })).status, 401);
});

Deno.test("Security-Header: CSP mit Nonce passend zum Inline-Skript, kein Framing", async () => {
  const { app } = frischeApp();
  const res = await app.request("/");
  const csp = res.headers.get("content-security-policy") ?? "";
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  assertEquals(typeof nonce, "string");
  assertStringIncludes(csp, "frame-ancestors 'none'");
  assertStringIncludes(await res.text(), `<script nonce="${nonce}">`);
  assertEquals(res.headers.get("x-frame-options"), "DENY");
  assertEquals(res.headers.get("x-content-type-options"), "nosniff");
  assertStringIncludes(
    res.headers.get("strict-transport-security") ?? "",
    "max-age=",
  );
});

Deno.test("Zu große Anfragen werden vor dem Einlesen abgelehnt", async () => {
  const { app, db } = frischeApp();
  const { headers } = createTestSession(db);
  const gross = json(headers, { name: "x".repeat(100 * 1024) });
  assertEquals((await app.request("/api/gruppen", gross)).status, 413);
  // Auch ohne Anmeldung, z. B. beim Login.
  assertEquals(
    (await app.request("/api/login", json({}, { x: "x".repeat(100 * 1024) })))
      .status,
    413,
  );
  // Belege dürfen größer als JSON sein.
  const { id } =
    await (await app.request("/api/gruppen", json(headers, { name: "Reise" })))
      .json();
  const ausgabe = await (await app.request(
    `/api/gruppen/${id}/ausgaben`,
    json(headers, { betragCent: 100, beschreibung: "Essen" }),
  )).json();
  const res = await app.request(
    `/api/gruppen/${id}/ausgaben/${ausgabe.id}/beleg`,
    {
      method: "PUT",
      headers: { ...headers, "content-type": "image/jpeg" },
      body: new Uint8Array(200 * 1024),
    },
  );
  assertEquals(res.status, 204);
});

Deno.test("Offene Challenges sind begrenzt", async () => {
  const { app, db } = frischeApp();
  const ins = db.prepare(
    "INSERT INTO challenges (id, challenge, expires_at) VALUES (?, 'c', ?)",
  );
  for (let i = 0; i < CHALLENGES_MAX; i++) {
    ins.run(String(i), Date.now() + 60_000);
  }
  const res = await app.request("/api/login/optionen", { method: "POST" });
  assertEquals(res.status, 429);
  // Abgelaufene zählen nicht.
  db.exec("UPDATE challenges SET expires_at = 0");
  assertEquals(
    (await app.request("/api/login/optionen", { method: "POST" })).status,
    200,
  );
});

Deno.test("Texterkennung: höchstens zwei gleichzeitig", async () => {
  const db = openDatabase(":memory:");
  let freigeben = () => {};
  const blockiert = new Promise<void>((r) => freigeben = r);
  const app = createApp(
    db,
    { domain: "ausgaben.example.de", origin: "https://ausgaben.example.de" },
    fakeKurs(),
    { lies: () => blockiert.then(() => "合計 ¥500") },
  );
  const { headers } = createTestSession(db);
  const senden = () =>
    app.request("/api/erkennung/summe", {
      method: "POST",
      headers: { ...headers, "content-type": "image/jpeg" },
      body: new Uint8Array([1]),
    });
  const laufend = [senden(), senden()];
  await new Promise((r) => setTimeout(r, 10));
  assertEquals((await senden()).status, 429);
  freigeben();
  for (const r of await Promise.all(laufend)) assertEquals(r.status, 200);
  assertEquals((await senden()).status, 200);
});
