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
      '<form><input name="betrag" inputmode="decimal" placeholder="Betrag" required> ' +
      '<select name="waehrung"><option value="EUR">€</option><option value="JPY">¥</option></select> ' +
      '<input name="beschreibung" placeholder="Beschreibung" required> ' +
      '<input name="datum" type="date"> ' +
      '<label>Beleg <input name="beleg" type="file" accept="image/*" capture="environment"></label> ' +
      '<span class="erkennung" role="status"></span> ' +
      '<button>Eintragen</button>' +
      '<div class="auswahl">Aufteilen auf: ' + g.mitglieder.map((m) =>
        '<label><input type="checkbox" name="teilnehmer" value="' + m.id + '" checked> ' +
        m.name.replace(/[&<>"]/g, (ch) => "&#" + ch.charCodeAt(0) + ";") + "</label> ").join("") + "</div></form>" +
      '<div class="schulden"></div><ul class="ausgaben"></ul>';
    const eur = (c) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
    const laden = async () => {
      const [a, s, ich] = await Promise.all([
        fetch("/api/gruppen/" + g.id + "/ausgaben").then((r) => r.json()),
        fetch("/api/gruppen/" + g.id + "/schulden").then((r) => r.json()),
        fetch("/api/me").then((r) => r.json()),
      ]);
      d.querySelector(".schulden").textContent = s.length
        ? s.map((x) => x.von.name + " schuldet " + x.an.name + " " + eur(x.betragCent)).join("; ")
        : "Keine Schulden.";
      d.querySelector(".ausgaben").replaceChildren(...a.map((x) => {
        const e = document.createElement("li");
        e.textContent = x.datum + " · " + x.zahler.name + " · " + eur(x.betragCent) + " · " + x.beschreibung + " ";
        const url = "/api/gruppen/" + g.id + "/ausgaben/" + x.id + "/beleg";
        if (x.hatBeleg) {
          const l = document.createElement("a");
          l.href = url;
          l.target = "_blank";
          const img = document.createElement("img");
          img.src = url;
          img.alt = "Beleg";
          img.style.cssText = "height:3rem;vertical-align:middle;border-radius:4px";
          l.append(img);
          e.append(l, " ");
        }
        if (x.zahler.id === ich.id) {
          const l = document.createElement("label");
          l.append(x.hatBeleg ? "Beleg ersetzen " : "Beleg hinzufügen ");
          const inp = document.createElement("input");
          inp.type = "file";
          inp.accept = "image/*";
          inp.onchange = async () => {
            const beleg = inp.files[0];
            if (!beleg) return;
            const r = await fetch(url, { method: "PUT", headers: { "content-type": beleg.type }, body: beleg });
            if (!r.ok) meldung("Beleg nicht gespeichert: " + ((await r.json().catch(() => ({}))).fehler ?? r.status));
            laden();
          };
          l.append(inp);
          e.append(l);
          if (x.hatBeleg) {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = "Beleg entfernen";
            b.onclick = async () => {
              const r = await fetch(url, { method: "DELETE" });
              if (!r.ok) meldung("Beleg nicht entfernt: " + ((await r.json().catch(() => ({}))).fehler ?? r.status));
              laden();
            };
            e.append(" ", b);
          }
        }
        return e;
      }));
    };
    const form = d.querySelector("form");
    const status = form.querySelector(".erkennung");
    form.elements.beleg.onchange = async () => {
      const bild = form.elements.beleg.files[0];
      status.textContent = "";
      if (!bild) return;
      status.textContent = "Summe wird gelesen …";
      try {
        const r = await fetch("/api/erkennung/summe", { method: "POST", headers: { "content-type": bild.type }, body: bild });
        const { summeYen } = r.ok ? await r.json() : {};
        if (summeYen && !form.elements.betrag.value) {
          form.elements.betrag.value = summeYen;
          form.elements.waehrung.value = "JPY";
          status.textContent = "Vorschlag aus dem Foto – bitte prüfen.";
        } else {
          status.textContent = summeYen ? "" : "Keine Summe erkannt – bitte Betrag eintippen.";
        }
      } catch { status.textContent = "Keine Summe erkannt – bitte Betrag eintippen."; }
    };
    d.addEventListener("toggle", () => { if (d.open) laden(); });
    d.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const zahl = Number(String(f.get("betrag")).replace(",", "."));
      const body = { beschreibung: f.get("beschreibung") };
      if (f.get("waehrung") === "JPY") { body.waehrung = "JPY"; body.betragYen = zahl; }
      else body.betragCent = Math.round(zahl * 100);
      if (f.get("datum")) body.datum = f.get("datum");
      body.teilnehmerIds = f.getAll("teilnehmer").map(Number);
      const beleg = f.get("beleg");
      try {
        const neu = await post("/api/gruppen/" + g.id + "/ausgaben", body);
        if (beleg && beleg.size) {
          const r = await fetch("/api/gruppen/" + g.id + "/ausgaben/" + neu.id + "/beleg", {
            method: "PUT", headers: { "content-type": beleg.type }, body: beleg,
          });
          if (!r.ok) meldung("Ausgabe gespeichert, Beleg nicht: " + ((await r.json()).fehler ?? r.status));
        }
        e.target.reset(); laden();
      }
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
