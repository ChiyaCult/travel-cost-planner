# Ausgaben teilen

Selbst gehostete Web-App zum Teilen von Ausgaben (siehe [CONTEXT.md](CONTEXT.md)).
Stack: Deno, Hono, SQLite (`node:sqlite`), TypeScript.

## Domain (fest!)

Die App läuft unter **einer festen Domain**, aktuell der Platzhalter `ausgaben.example.de`.
Passkeys (WebAuthn) sind an diese Domain gebunden: Wird sie später geändert, funktionieren alle
registrierten Passkeys nicht mehr. Die echte Domain daher vor der ersten Einladung festlegen
und in `.env` als `APP_DOMAIN` eintragen.

## Betrieb mit Docker

```bash
cp .env.example .env   # APP_DOMAIN anpassen
docker compose up -d --build
```

Der Container lauscht auf `127.0.0.1:8000`. **HTTPS** übernimmt der eigene Reverse-Proxy
(z. B. Caddy/nginx), der `APP_DOMAIN` auf diesen Port weiterleitet.

## Daten und Backup

Alle Daten liegen in **einer** SQLite-Datei: `./data/app.sqlite` (WAL-Modus, daneben ggf.
`-wal`/`-shm`). Backup z. B. konsistent per `sqlite3 data/app.sqlite ".backup backup.sqlite"`.

## Entwicklung und Tests

```bash
DB_PATH=./data/app.sqlite APP_DOMAIN=localhost deno task dev
deno task test
```

Tests rufen die HTTP-API (`app.request`) gegen eine frische In-Memory-Datenbank auf und melden
sich mit `createTestSession` ([src/testing.ts](src/testing.ts)) ohne echten Passkey an.

## Einladung und Anmeldung

Beim ersten Start ohne Admin legt die App einen an (Name aus `ADMIN_NAME`, Standard „Admin“)
und schreibt den Einladungslink ins Log (`docker compose logs`). Über diesen Link registriert der
Admin seinen Passkey. Danach erzeugt nur der Admin auf der Startseite weitere Einladungslinks
(7 Tage gültig, einmal verwendbar). Verliert jemand sein Gerät, erzeugt der Admin einen neuen
Link für den bestehenden Nutzer; er registriert damit einen zusätzlichen Passkey.
Lokal mit `APP_DOMAIN=localhost` läuft alles über `http://localhost:8000`.
