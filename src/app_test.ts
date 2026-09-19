import { assertEquals, assertStringIncludes } from "@std/assert";
import { createApp } from "./app.ts";
import { openDatabase } from "./db.ts";
import { createTestSession } from "./testing.ts";

function frischeApp() {
  const db = openDatabase(":memory:");
  return { db, app: createApp(db, { domain: "ausgaben.example.de" }) };
}

Deno.test("Startseite ist deutsch", async () => {
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
  const { userId, headers } = createTestSession(db, { name: "Anna", isAdmin: true });
  const res = await app.request("/api/me", { headers });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { id: userId, name: "Anna", istAdmin: true });
});
