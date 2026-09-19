const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(
    /"/g,
    "&quot;",
  );

const seite = (body: string, script = "") =>
  `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ausgaben teilen</title>
</head>
<body>
<h1>Ausgaben teilen</h1>
${body}
<p id="meldung" role="alert"></p>
<script>
async function post(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.fehler || "Fehler");
  return j;
}
function meldung(text) { document.getElementById("meldung").textContent = text; }
${script}
</script>
</body>
</html>`;

export function anmeldeseite(domain: string): string {
  return seite(
    `<p>Willkommen! Diese App teilt Ausgaben im Freundeskreis.</p>
<button id="login">Mit Passkey anmelden</button>
<p><small>${esc(domain)}</small></p>`,
    `document.getElementById("login").onclick = async () => {
  try {
    const { optionen, challengeId } = await post("/api/login/optionen");
    const antwort = await navigator.credentials.get({
      publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(optionen),
    });
    await post("/api/login", { challengeId, antwort: antwort.toJSON() });
    location.reload();
  } catch (e) { meldung("Anmeldung fehlgeschlagen: " + e.message); }
};`,
  );
}

export function startseite(
  user: { name: string; is_admin: number },
  nutzer: { id: number; name: string }[],
): string {
  const admin = user.is_admin === 1
    ? `<h2>Einladen</h2>
<form id="einladung">
  <label>Neuer Nutzer (Name) <input name="name"></label>
  <label>oder neues Gerät für
    <select name="nutzerId"><option value="">–</option>${
      nutzer.map((n) => `<option value="${n.id}">${esc(n.name)}</option>`).join(
        "",
      )
    }</select>
  </label>
  <button>Einladungslink erzeugen</button>
</form>
<p id="link"></p>`
    : "";
  return seite(
    `<p>Angemeldet als ${
      esc(user.name)
    }. <button id="logout">Abmelden</button></p>
<h2>Gruppen</h2>
<ul id="gruppen"></ul>
<form id="neuegruppe">
  <label>Neue Gruppe <input name="name" required></label>
  <button>Anlegen</button>
</form>${admin}`,
    `document.getElementById("logout").onclick = async () => { await post("/api/logout"); location.reload(); };
async function gruppenLaden() {
  const r = await fetch("/api/gruppen");
  const liste = await r.json();
  const ul = document.getElementById("gruppen");
  ul.replaceChildren(...liste.map((g) => {
    const li = document.createElement("li");
    li.textContent = g.name + " (" + g.mitglieder.map((m) => m.name).join(", ") + ") ";
    const sel = document.createElement("select");
    sel.innerHTML = '<option value="">Mitglied hinzufügen …</option>';
    fetch("/api/gruppen/" + g.id + "/kandidaten").then((k) => k.json()).then((k) => {
      for (const n of k) sel.add(new Option(n.name, n.id));
    });
    sel.onchange = async () => {
      if (!sel.value) return;
      try {
        await post("/api/gruppen/" + g.id + "/mitglieder", { nutzerId: Number(sel.value) });
        gruppenLaden();
      } catch (e) { meldung(e.message); }
    };
    li.append(sel);
    const d = document.createElement("details");
    d.innerHTML = "<summary>Ausgaben</summary>" +
      '<form><input name="betrag" inputmode="decimal" placeholder="Betrag in €" required> ' +
      '<input name="beschreibung" placeholder="Beschreibung" required> ' +
      '<input name="datum" type="date"><button>Eintragen</button></form>' +
      '<div class="schulden"></div><ul class="ausgaben"></ul>';
    const eur = (c) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
    const laden = async () => {
      const [a, s] = await Promise.all([
        fetch("/api/gruppen/" + g.id + "/ausgaben").then((r) => r.json()),
        fetch("/api/gruppen/" + g.id + "/schulden").then((r) => r.json()),
      ]);
      d.querySelector(".schulden").textContent = s.length
        ? s.map((x) => x.von.name + " schuldet " + x.an.name + " " + eur(x.betragCent)).join("; ")
        : "Keine Schulden.";
      d.querySelector(".ausgaben").replaceChildren(...a.map((x) => {
        const e = document.createElement("li");
        e.textContent = x.datum + " · " + x.zahler.name + " · " + eur(x.betragCent) + " · " + x.beschreibung;
        return e;
      }));
    };
    d.addEventListener("toggle", () => { if (d.open) laden(); });
    d.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const cent = Math.round(Number(String(f.get("betrag")).replace(",", ".")) * 100);
      const body = { betragCent: cent, beschreibung: f.get("beschreibung") };
      if (f.get("datum")) body.datum = f.get("datum");
      try { await post("/api/gruppen/" + g.id + "/ausgaben", body); e.target.reset(); laden(); }
      catch (err) { meldung(err.message); }
    };
    li.append(d);
    return li;
  }));
}
gruppenLaden();
document.getElementById("neuegruppe").onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try { await post("/api/gruppen", { name: f.get("name") }); e.target.reset(); gruppenLaden(); }
  catch (err) { meldung(err.message); }
};
const form = document.getElementById("einladung");
if (form) form.onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(form);
  try {
    const body = f.get("nutzerId") ? { nutzerId: Number(f.get("nutzerId")) } : { name: f.get("name") };
    const { url } = await post("/api/einladungen", body);
    document.getElementById("link").textContent = url;
  } catch (err) { meldung(err.message); }
};`,
  );
}

export function einladungsseite(token: string, name: string): string {
  return seite(
    `<p>Hallo ${esc(name)}! Registriere einen Passkey, um die App zu nutzen.</p>
<button id="reg">Passkey registrieren</button>`,
    `document.getElementById("reg").onclick = async () => {
  try {
    const { optionen, challengeId } = await post("/api/einladung/${
      encodeURIComponent(token)
    }/optionen");
    const antwort = await navigator.credentials.create({
      publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(optionen),
    });
    await post("/api/einladung/${
      encodeURIComponent(token)
    }/registrieren", { challengeId, antwort: antwort.toJSON() });
    location.href = "/";
  } catch (e) { meldung("Registrierung fehlgeschlagen: " + e.message); }
};`,
  );
}

export function ungueltigeEinladung(): string {
  return seite(
    `<p>Dieser Einladungslink ist ungültig oder wurde bereits verwendet. Bitte den Admin um einen neuen.</p>`,
  );
}
