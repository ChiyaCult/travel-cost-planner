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
