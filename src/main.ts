import { createApp } from "./app.ts";
import { ensureAdminInvite } from "./auth.ts";
import { openDatabase } from "./db.ts";

const domain = Deno.env.get("APP_DOMAIN");
if (!domain) {
  console.error("APP_DOMAIN ist nicht gesetzt (feste Domain, siehe README).");
  Deno.exit(1);
}
const dbPath = Deno.env.get("DB_PATH") ?? "./data/app.sqlite";
const port = Number(Deno.env.get("PORT") ?? "8000");

const origin = domain === "localhost"
  ? `http://localhost:${port}`
  : `https://${domain}`;

const db = openDatabase(dbPath);
const adminToken = ensureAdminInvite(db, Deno.env.get("ADMIN_NAME") ?? "Admin");
if (adminToken) {
  console.log(
    `Erster Start: Admin-Einladung (7 Tage gültig): ${origin}/einladung/${adminToken}`,
  );
}

const app = createApp(db, { domain, origin });
Deno.serve({ port, hostname: "0.0.0.0" }, app.fetch);
