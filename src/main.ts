import { createApp } from "./app.ts";
import { openDatabase } from "./db.ts";

const domain = Deno.env.get("APP_DOMAIN");
if (!domain) {
  console.error("APP_DOMAIN ist nicht gesetzt (feste Domain, siehe README).");
  Deno.exit(1);
}
const dbPath = Deno.env.get("DB_PATH") ?? "./data/app.sqlite";
const port = Number(Deno.env.get("PORT") ?? "8000");

const app = createApp(openDatabase(dbPath), { domain });
Deno.serve({ port, hostname: "0.0.0.0" }, app.fetch);
