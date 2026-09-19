const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(
    /"/g,
    "&quot;",
  );

const STIL = `
:root{
  --bg:#fafafa;--surface:#ffffff;--text:#1a1a1a;--text-secondary:#666666;--muted:#999999;--border:#e0e0e0;
  --accent:#2d2d2d;--accent-soft:#f5f5f5;
  --focus:#1a1a1a;--danger:#d32f2f;--ok:#388e3c;
  --grad:linear-gradient(135deg,#2d2d2d 0%,#1a1a1a 100%);
  --radius:8px;--radius-lg:12px;--radius-full:999px;
  --shadow-sm:0 1px 2px rgba(0,0,0,0.04);
  --shadow:0 2px 8px rgba(0,0,0,0.08);
  --shadow-lg:0 4px 16px rgba(0,0,0,0.12);
}
@media (prefers-color-scheme:dark){:root{
  --bg:#121212;--surface:#1e1e1e;--text:#e0e0e0;--text-secondary:#999999;--muted:#666666;--border:#333333;
  --accent:#e0e0e0;--accent-soft:#2a2a2a;
  --focus:#e0e0e0;--danger:#f44336;--ok:#66bb6a;
  --shadow-sm:0 1px 2px rgba(0,0,0,0.3);
  --shadow:0 2px 8px rgba(0,0,0,0.4);
  --shadow-lg:0 4px 16px rgba(0,0,0,0.5);
}}
*{box-sizing:border-box}
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%}
body{margin:0;font:1rem/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;color:var(--text);background:var(--bg);min-height:100vh;transition:background-color .3s,color .3s}
a{color:var(--accent);text-decoration:none;transition:color .2s}a:hover{opacity:.7}
h1,h2,h3{margin:0;font-weight:700}
h1{font-size:1.75rem;letter-spacing:-.02em}
h2{font-size:1.125rem;color:var(--accent)}
p{margin:.25rem 0;color:var(--text-secondary)}
small,.muted{color:var(--muted);font-size:.875rem}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}

/* Kopf */
.kopf{background:var(--grad);color:#fff;padding:2rem 1rem 3.75rem;box-shadow:var(--shadow-lg)}
.kopfzeile{max-width:48rem;margin:0 auto;display:flex;align-items:center;gap:1rem}
.kopf h1{font-size:1.5rem;letter-spacing:-.03em;overflow-wrap:anywhere}
.logo{border-radius:10px;background:rgba(255,255,255,.95);flex:none;padding:4px;width:44px;height:44px;display:grid;place-items:center}
.rueck{flex:none;display:grid;place-items:center;width:2.75rem;height:2.75rem;border-radius:50%;color:#fff;text-decoration:none;font-size:1.3rem;background:rgba(255,255,255,.15);transition:background .2s}
.rueck:hover{background:rgba(255,255,255,.25)}
.unter{max-width:48rem;margin:0.5rem auto 0;opacity:.95;font-size:.95rem}

main{max-width:48rem;margin:-2rem auto 0;padding:0 1rem 9rem;display:grid;gap:1.25rem}
.karte{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow);padding:1.5rem;transition:box-shadow .2s,border-color .2s}
.karte>h2{margin-bottom:1rem}
.karte:hover{box-shadow:var(--shadow-lg);border-color:var(--purple-soft)}
.leer{text-align:center;color:var(--text-secondary);padding:2.5rem 1.5rem}
.leer strong{display:block;color:var(--text);font-size:1.1rem;margin-bottom:.5rem;font-weight:600}

/* Formulare */
label,legend{font-weight:600;font-size:.95rem;color:var(--text);display:block}
.feld{display:grid;gap:.5rem;margin:1rem 0}
input,select,button{font:inherit;color:inherit}
input:not([type=checkbox]),select{width:100%;min-height:2.75rem;padding:.65rem 1rem;border:1.5px solid var(--border);border-radius:var(--radius);background:var(--surface);accent-color:var(--accent);transition:border-color .2s,box-shadow .2s}
input:not([type=checkbox]):hover,select:hover{border-color:var(--accent);opacity:.8}
input:not([type=checkbox]):focus,select:focus{border-color:var(--accent);outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
input[type=checkbox]{width:1.25rem;height:1.25rem;accent-color:var(--accent);flex:none;cursor:pointer}
fieldset{border:0;padding:0;margin:1rem 0}
.zeile{display:grid;grid-template-columns:1fr 6rem;gap:.75rem}
.checks{display:flex;flex-wrap:wrap;gap:.75rem}
.check{display:flex;align-items:center;gap:.75rem;font-weight:500;padding:.6rem 1rem;border:1.5px solid var(--border);border-radius:var(--radius-full);min-height:2.75rem;cursor:pointer;background:var(--surface);transition:all .2s}
.check:hover{border-color:var(--accent);background:var(--accent-soft)}
.check:has(input:checked){background:var(--accent);border-color:var(--accent);color:var(--surface)}
.hilfe{color:var(--muted);font-size:.875rem;min-height:1.3rem}

/* Buttons */
.btn{min-height:2.75rem;padding:.65rem 1.5rem;border:none;border-radius:var(--radius);background:var(--accent);color:var(--surface);font-weight:600;font-size:.95rem;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;text-decoration:none;box-shadow:var(--shadow-sm)}
.btn:hover{opacity:.9;transform:translateY(-1px);box-shadow:var(--shadow)}
.btn:active{transform:translateY(0);box-shadow:var(--shadow-sm)}
.btn.sek{background:var(--accent-soft);color:var(--accent);border:1.5px solid var(--accent);box-shadow:none}
.btn.sek:hover{background:var(--accent);color:var(--surface);box-shadow:var(--shadow-sm)}
.btn.gefahr{background:var(--surface);color:var(--danger);border:1.5px solid var(--danger);box-shadow:none}
.btn.gefahr:hover{background:var(--danger);color:var(--surface)}
.btn.gefahr-voll{background:var(--danger);color:var(--surface);box-shadow:var(--shadow-sm)}
.btn.gefahr-voll:hover{opacity:.9;box-shadow:var(--shadow)}
.btn.klein{min-height:2.25rem;padding:.4rem 1rem;font-size:.875rem}
.btn.voll{width:100%;min-height:3.25rem;font-size:1rem}
.aktionen{display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;flex-wrap:wrap}
input[type=file].versteckt{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
label.btn:has(input:focus-visible){outline:2px solid var(--focus);outline-offset:2px}

/* Avatare, Listen */
.avatar{flex:none;display:grid;place-items:center;width:2.8rem;height:2.8rem;border-radius:50%;font-weight:600;font-size:.9rem;color:var(--surface);background:var(--accent)}
.c0{background:#4a4a4a}.c1{background:#666666}.c2{background:#808080}
@media (prefers-color-scheme:dark){
  .c0{background:#888888}.c1{background:#a0a0a0}.c2{background:#b8b8b8}
}
.liste{list-style:none;margin:0;padding:0}
.liste>li{display:flex;gap:1rem;align-items:flex-start;padding:1rem 0;border-top:1px solid var(--border);transition:background .2s}
.liste>li:hover{background:var(--bg)}
.liste>li:first-child{border-top:0}
.liste .text{flex:1;min-width:0}
.liste .text strong,.liste .text small{display:block;overflow-wrap:anywhere}
.liste .text strong{font-weight:600}
.liste .text small{color:var(--text-secondary);margin-top:.25rem}
.betrag{font-weight:700;text-align:right;white-space:nowrap;font-size:1.1rem}
.betrag small{display:block;font-weight:500;font-size:.875rem;color:var(--text-secondary)}
.gruppenkarte{display:flex;gap:1rem;align-items:center;text-decoration:none;color:inherit;width:100%;min-height:2.75rem;transition:all .2s}
.gruppenkarte:hover{opacity:.7}
.gruppenkarte:hover .name{text-decoration:underline}
.gruppenkarte .name{color:var(--accent);font-weight:600;font-size:1.05rem}
.gruppenkarte .text small{color:var(--text-secondary)}
.pfeil{color:var(--muted);font-size:1.3rem}
.ausgabe{flex-wrap:wrap}
.ausgabe .extras{flex-basis:100%;display:flex;gap:.75rem;flex-wrap:wrap;align-items:center;padding-left:3.8rem;margin-top:.5rem}
.ausgabe img{height:2.75rem;width:2.75rem;object-fit:cover;border-radius:var(--radius);border:1px solid var(--border)}
.stand{display:flex;gap:1.5rem;align-items:flex-start;padding:1.5rem;border-radius:var(--radius-lg);background:var(--accent-soft);border-left:4px solid var(--accent)}
.stand .gross{font-size:1.5rem;font-weight:800;color:var(--accent)}
.stand>div>small{color:var(--text-secondary);font-weight:500}
.stand.plus{border-left-color:var(--ok);background:var(--accent-soft)}
.stand.plus .gross{color:var(--ok)}
.stand.minus{border-left-color:var(--danger);background:var(--accent-soft)}
.stand.minus .gross{color:var(--danger)}
.stand.null{border-left-color:var(--accent)}

/* Tabs */
[role=tablist]{display:flex;gap:.5rem;background:transparent;border:0;border-bottom:1px solid var(--border);padding:0;box-shadow:none;margin-bottom:1rem}
[role=tab]{flex:1;min-height:3rem;border:none;border-bottom:2px solid transparent;border-radius:0;background:transparent;font-weight:600;color:var(--text-secondary);cursor:pointer;transition:all .2s;padding-bottom:.75rem}
[role=tab]:hover{color:var(--text)}
[role=tab][aria-selected=true]{color:var(--text);border-bottom-color:var(--accent)}
[role=tabpanel]{display:grid;gap:1rem;animation:fadeIn .2s}@keyframes fadeIn{from{opacity:.8}to{opacity:1}}

/* Untere Navigation und Aktionsknopf */
.nav{position:fixed;left:0;right:0;bottom:0;z-index:20;background:var(--surface);border-top:1px solid var(--border);padding:.75rem .5rem calc(.75rem + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:.5rem;box-shadow:var(--shadow-lg)}
.nav a{flex:1;max-width:14rem;display:grid;justify-items:center;gap:.35rem;padding:.5rem;border-radius:var(--radius);text-decoration:none;color:var(--text-secondary);font-size:.75rem;font-weight:600;min-height:3.25rem;transition:all .2s}
.nav a:hover{color:var(--accent);background:var(--accent-soft)}
.nav a[aria-current=page]{color:var(--accent);background:var(--accent-soft)}
.nav svg{width:1.75rem;height:1.75rem;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.fab{position:fixed;right:1.5rem;bottom:calc(5.5rem + env(safe-area-inset-bottom));z-index:15;min-height:3.75rem;padding:.75rem 1.5rem;box-shadow:var(--shadow-lg);border-radius:var(--radius-full);font-weight:600;transition:all .2s}
.fab:hover{transform:scale(1.05);box-shadow:var(--shadow-lg)}

/* Dialoge */
dialog.dlg{border:none;border-radius:var(--radius-lg);padding:2rem;width:min(32rem,calc(100% - 2rem));max-height:90vh;background:var(--surface);color:var(--text);box-shadow:var(--shadow-lg);animation:slideUp .3s ease-out}
dialog.dlg::backdrop{background:rgba(0,0,0,.4);backdrop-filter:blur(4px)}
dialog.dlg h2{margin-bottom:1rem}
@keyframes slideUp{from{opacity:0;transform:translateY(2rem)}to{opacity:1;transform:translateY(0)}}
@media (max-width:599px){dialog.dlg{margin:auto auto 0;width:100%;border-radius:var(--radius-lg) var(--radius-lg) 0 0;padding:1.5rem}}

/* Hinweise */
#toasts{position:fixed;left:0;right:0;top:1rem;z-index:50;display:grid;justify-items:center;gap:.75rem;pointer-events:none;padding:0 1rem;max-height:80vh;overflow-y:auto}
.toast{pointer-events:auto;background:var(--surface);border:1.5px solid var(--ok);color:var(--text);border-radius:var(--radius);padding:1rem 1.25rem;font-weight:500;box-shadow:var(--shadow);max-width:36rem;animation:slideDown .3s ease-out}
.toast.fehler{border-color:var(--danger);background:var(--surface);color:var(--danger)}
@keyframes slideDown{from{opacity:0;transform:translateY(-1rem)}to{opacity:1;transform:translateY(0)}}
.skel{height:4rem;border-radius:var(--radius);background:linear-gradient(90deg,var(--purple-soft),var(--blue-soft),var(--purple-soft));background-size:200% 100%;animation:skel 1.5s infinite linear}
@keyframes skel{0%{background-position:200% 0}to{background-position:-200% 0}}
#link{word-break:break-all;font-family:"Fira Code",ui-monospace,monospace;background:var(--bg);padding:.75rem;border-radius:var(--radius);border:1px solid var(--border);display:block;margin:.75rem 0}
.mitte{text-align:center}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

const ICONS = {
  gruppen:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14c2.7 0 4.5 1.9 4.5 4.5"/></svg>',
  profil:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>',
};

interface Optionen {
  /** Kopfzeile: Titel (Standard: App-Name mit Logo). */
  titel?: string;
  untertitel?: string;
  /** Zurück-Pfeil statt Logo (Unterseiten). */
  zurueck?: boolean;
  /** Untere Navigation mit dieser aktiven Seite. */
  nav?: "gruppen" | "profil";
}

const seite = (body: string, script = "", o: Optionen = {}) =>
  `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#2d2d2d">
<meta name="color-scheme" content="light dark">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/png" href="/icon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Ausgaben">
<title>Ausgaben teilen</title>
<style>${STIL}</style>
</head>
<body>
<header class="kopf">
  <div class="kopfzeile">${
    o.zurueck
      ? '<a class="rueck" href="/" aria-label="Zurück zu allen Gruppen">←</a>'
      : '<img class="logo" src="/icon-192.png" alt="" width="40" height="40">'
  }<h1 id="titel">${o.titel ?? "Ausgaben teilen"}</h1></div>${
    o.untertitel ? `<p class="unter">${o.untertitel}</p>` : ""
  }
</header>
<main>
${body}
</main>
${
    o.nav
      ? `<nav class="nav" aria-label="Hauptnavigation">
  <a href="/"${
        o.nav === "gruppen" ? ' aria-current="page"' : ""
      }>${ICONS.gruppen}Gruppen</a>
  <a href="/profil"${
        o.nav === "profil" ? ' aria-current="page"' : ""
      }>${ICONS.profil}Profil</a>
</nav>`
      : ""
  }
<div id="toasts" role="status" aria-live="polite"></div>
<script>
const $ = (id) => document.getElementById(id);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e[k] = v;
    else if (v === true) e.setAttribute(k, "");
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  e.append(...kids.flat().filter((x) => x != null && x !== false));
  return e;
}
async function api(url, opt) {
  const r = await fetch(url, opt);
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.fehler || "Fehler " + r.status);
  }
  return r.status === 204 ? null : r.json();
}
const post = (url, body) => api(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body ?? {}),
});
function meldung(text, fehler = true) {
  const el = h("div", { class: "toast" + (fehler ? " fehler" : "") }, text);
  $("toasts").append(el);
  setTimeout(() => el.remove(), 5000);
}
const eur = (c) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const datumKurz = (d) => new Date(d + "T00:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
const initialen = (n) => n.trim().split(/ +/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const avatar = (n, id) => h("span", { class: "avatar c" + (id % 3), "aria-hidden": "true" }, initialen(n));
function bestaetigen(text, ok = "Löschen") {
  return new Promise((res) => {
    const d = h("dialog", { class: "dlg", "aria-labelledby": "bt" },
      h("form", { method: "dialog" },
        h("h2", { id: "bt" }, text),
        h("div", { class: "aktionen" },
          h("button", { class: "btn sek", value: "nein", autofocus: true }, "Abbrechen"),
          h("button", { class: "btn gefahr-voll", value: "ja" }, ok))));
    d.onclose = () => { res(d.returnValue === "ja"); d.remove(); };
    document.body.append(d);
    d.showModal();
  });
}
document.addEventListener("click", (e) => {
  if (e.target instanceof HTMLDialogElement && e.target.classList.contains("dlg")) e.target.close();
});
${script}
</script>
</body>
</html>`;

export function anmeldeseite(domain: string): string {
  return seite(
    `<section class="karte mitte">
  <h2>Willkommen!</h2>
  <p>Diese App teilt Ausgaben im Freundeskreis.</p>
  <p style="margin-top:1rem"><button class="btn voll" id="login">Mit Passkey anmelden</button></p>
  <p><small>${esc(domain)}</small></p>
</section>`,
    `$("login").onclick = async () => {
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

export function startseite(user: { name: string }): string {
  return seite(
    `<div id="gruppen" aria-live="polite"><div class="skel"></div></div>
<button class="btn fab" id="neu" type="button"><span aria-hidden="true">＋</span> Neue Gruppe</button>
<dialog class="dlg" id="dlg-gruppe" aria-labelledby="dlg-gruppe-titel">
  <form id="neuegruppe">
    <h2 id="dlg-gruppe-titel">Neue Gruppe</h2>
    <div class="feld"><label for="gruppenname">Name der Gruppe</label>
    <input id="gruppenname" name="name" required maxlength="80" placeholder="z. B. Japan-Reise" autocomplete="off"></div>
    <div class="aktionen">
      <button class="btn sek" type="button" id="abbrechen">Abbrechen</button>
      <button class="btn">Anlegen</button>
    </div>
  </form>
</dialog>`,
    `async function gruppenLaden() {
  let liste;
  try { liste = await api("/api/gruppen"); } catch (e) { meldung(e.message); return; }
  const box = $("gruppen");
  if (!liste.length) {
    box.replaceChildren(h("div", { class: "karte leer" },
      h("strong", {}, "Noch keine Gruppe"),
      "Lege deine erste Gruppe an und lade Freunde ein."));
    return;
  }
  box.replaceChildren(h("ul", { class: "karte liste" }, liste.map((g) =>
    h("li", {}, h("a", { class: "gruppenkarte", href: "/gruppen/" + g.id },
      avatar(g.name, g.id),
      h("span", { class: "text" },
        h("span", { class: "name" }, g.name),
        h("small", { style: "display:block" }, g.mitglieder.length + " Mitglieder · " + g.mitglieder.map((x) => x.name).join(", "))),
      h("span", { class: "pfeil", "aria-hidden": "true" }, "›"))))));
}
gruppenLaden();
const dlg = $("dlg-gruppe");
$("neu").onclick = () => { dlg.showModal(); $("gruppenname").focus(); };
$("abbrechen").onclick = () => dlg.close();
$("neuegruppe").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const g = await post("/api/gruppen", { name: new FormData(e.target).get("name") });
    location.href = "/gruppen/" + g.id;
  } catch (err) { meldung(err.message); }
};`,
    {
      untertitel: `Hallo ${esc(user.name)}!`,
      nav: "gruppen",
    },
  );
}

export function profilseite(
  user: { name: string; is_admin: number },
  nutzer: { id: number; name: string }[],
): string {
  const admin = user.is_admin === 1
    ? `<form class="karte" id="einladung">
  <h2>Freunde einladen</h2>
  <div class="feld"><label for="einl-name">Neuer Nutzer (Name)</label><input id="einl-name" name="name" autocomplete="off"></div>
  <div class="feld"><label for="einl-nutzer">oder neues Gerät für</label>
    <select id="einl-nutzer" name="nutzerId"><option value="">–</option>${
      nutzer.map((n) => `<option value="${n.id}">${esc(n.name)}</option>`).join(
        "",
      )
    }</select></div>
  <button class="btn">Einladungslink erzeugen</button>
  <p id="link" aria-live="polite"></p>
  <p><button class="btn sek klein" type="button" id="kopieren" hidden>Link kopieren</button></p>
</form>`
    : "";
  return seite(
    `<form class="karte" id="profil">
  <h2>Mein Profil</h2>
  <div class="feld"><label for="pname">Name</label>
  <input id="pname" name="name" value="${
      esc(user.name)
    }" required maxlength="60" autocomplete="name"></div>
  <button class="btn">Namen speichern</button>
</form>${admin}
<div class="karte"><button class="btn sek voll" id="logout" type="button">Abmelden</button></div>`,
    `$("logout").onclick = async () => { await post("/api/logout"); location.href = "/"; };
$("profil").onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: new FormData(e.target).get("name") }),
    });
    location.reload();
  } catch (err) { meldung(err.message); }
};
const form = $("einladung");
if (form) form.onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(form);
  try {
    const body = f.get("nutzerId") ? { nutzerId: Number(f.get("nutzerId")) } : { name: f.get("name") };
    const { url } = await post("/api/einladungen", body);
    $("link").textContent = url;
    $("kopieren").hidden = false;
    $("kopieren").onclick = async () => {
      try { await navigator.clipboard.writeText(url); meldung("Link kopiert", false); }
      catch { meldung("Kopieren nicht möglich – bitte den Link markieren."); }
    };
  } catch (err) { meldung(err.message); }
};`,
    { untertitel: esc(user.name), nav: "profil" },
  );
}

export function gruppenseite(gruppeId: number): string {
  return seite(
    `<div role="tablist" aria-label="Bereiche der Gruppe">
  <button role="tab" id="tab-ausgaben" data-tab="ausgaben" aria-controls="p-ausgaben" aria-selected="true">Ausgaben</button>
  <button role="tab" id="tab-schulden" data-tab="schulden" aria-controls="p-schulden" aria-selected="false" tabindex="-1">Schulden</button>
  <button role="tab" id="tab-mitglieder" data-tab="mitglieder" aria-controls="p-mitglieder" aria-selected="false" tabindex="-1">Mitglieder</button>
</div>

<section role="tabpanel" id="p-ausgaben" aria-labelledby="tab-ausgaben">
  <div id="stand"></div>
  <div id="ausgaben" aria-live="polite"><div class="skel"></div></div>
</section>
<section role="tabpanel" id="p-schulden" aria-labelledby="tab-schulden" hidden>
  <div class="karte"><h2>Offene Schulden</h2><div id="schulden"></div></div>
  <div class="karte"><h2>Zahlungen</h2><div id="zahlungen"></div></div>
</section>
<section role="tabpanel" id="p-mitglieder" aria-labelledby="tab-mitglieder" hidden>
  <div class="karte"><h2>Mitglieder</h2><ul class="liste" id="mitglieder"></ul></div>
  <form class="karte" id="mitgliedform">
    <h2>Mitglied hinzufügen</h2>
    <div class="feld"><label for="kandidat">Person</label><select id="kandidat"></select></div>
    <button class="btn">Hinzufügen</button>
  </form>
</section>

<button class="btn fab" id="fab" type="button"><span aria-hidden="true">＋</span> Ausgabe</button>

<dialog class="dlg" id="dlg-ausgabe" aria-labelledby="dlg-titel">
  <form id="ausgabeform">
    <h2 id="dlg-titel">Neue Ausgabe</h2>
    <div class="zeile">
      <div class="feld"><label for="betrag">Betrag</label>
      <input id="betrag" name="betrag" inputmode="decimal" required autocomplete="off"></div>
      <div class="feld"><label for="waehrung">Währung</label>
      <select id="waehrung" name="waehrung"><option value="EUR">€</option><option value="JPY">¥</option></select></div>
    </div>
    <div class="feld"><label for="beschreibung">Wofür?</label>
    <input id="beschreibung" name="beschreibung" required maxlength="120" autocomplete="off"></div>
    <div class="feld"><label for="datum">Datum</label><input id="datum" name="datum" type="date"></div>
    <div class="feld"><label for="beleg">Beleg (Foto, optional)</label>
    <input id="beleg" name="beleg" type="file" accept="image/*" capture="environment">
    <span class="hilfe" id="erkennung" role="status"></span></div>
    <fieldset><legend>Aufteilen auf</legend><div class="checks" id="teilnehmer"></div></fieldset>
    <div class="aktionen">
      <button class="btn sek" type="button" id="abbrechen">Abbrechen</button>
      <button class="btn">Eintragen</button>
    </div>
  </form>
</dialog>`,
    `const GID = ${gruppeId};
let ich, g;

const tabs = [...document.querySelectorAll("[role=tab]")];
function zeige(name) {
  for (const t of tabs) {
    const aktiv = t.dataset.tab === name;
    t.setAttribute("aria-selected", aktiv);
    t.tabIndex = aktiv ? 0 : -1;
    $("p-" + t.dataset.tab).hidden = !aktiv;
  }
  $("fab").hidden = name !== "ausgaben";
  history.replaceState(null, "", "#" + name);
}
tabs.forEach((t, i) => {
  t.onclick = () => zeige(t.dataset.tab);
  t.onkeydown = (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    const n = tabs[(i + d + tabs.length) % tabs.length];
    n.focus();
    zeige(n.dataset.tab);
  };
});

const leer = (titel, text) => h("div", { class: "leer" }, h("strong", {}, titel), text);
const url = (pfad) => "/api/gruppen/" + GID + pfad;

function mitgliederZeigen() {
  $("titel").textContent = g.name;
  document.title = g.name + " – Ausgaben teilen";
  $("mitglieder").replaceChildren(...g.mitglieder.map((m) =>
    h("li", {}, avatar(m.name, m.id), h("span", { class: "text" }, h("strong", {}, m.name + (m.id === ich.id ? " (du)" : ""))))));
  $("teilnehmer").replaceChildren(...g.mitglieder.map((m) =>
    h("label", { class: "check" }, h("input", { type: "checkbox", name: "teilnehmer", value: m.id, checked: true }), m.name)));
}
async function kandidatenLaden() {
  const k = await api(url("/kandidaten"));
  const sel = $("kandidat");
  sel.replaceChildren(...k.map((n) => new Option(n.name, n.id)));
  $("mitgliedform").hidden = !k.length;
}
$("mitgliedform").onsubmit = async (e) => {
  e.preventDefault();
  if (!$("kandidat").value) return;
  try {
    await post(url("/mitglieder"), { nutzerId: Number($("kandidat").value) });
    g = await api("/api/gruppen/" + GID);
    mitgliederZeigen();
    await kandidatenLaden();
    meldung("Mitglied hinzugefügt", false);
  } catch (err) { meldung(err.message); }
};

function ausgabeZeile(x) {
  const meine = x.zahler.id === ich.id;
  const beleg = url("/ausgaben/" + x.id + "/beleg");
  const extras = [];
  if (x.hatBeleg) {
    extras.push(h("a", { href: beleg, target: "_blank", "aria-label": "Beleg ansehen" }, h("img", { src: beleg, alt: "Beleg", loading: "lazy" })));
  }
  if (meine) {
    const inp = h("input", { type: "file", accept: "image/*", class: "versteckt", onchange: async () => {
      const datei = inp.files[0];
      if (!datei) return;
      try {
        await api(beleg, { method: "PUT", headers: { "content-type": datei.type }, body: datei });
        meldung("Beleg gespeichert", false);
      } catch (err) { meldung("Beleg nicht gespeichert: " + err.message); }
      laden();
    } });
    extras.push(h("label", { class: "btn sek klein" }, x.hatBeleg ? "Beleg ersetzen" : "Beleg hinzufügen", inp));
    if (x.hatBeleg) {
      extras.push(h("button", { class: "btn sek klein", type: "button", onclick: async () => {
        try { await api(beleg, { method: "DELETE" }); } catch (err) { meldung("Beleg nicht entfernt: " + err.message); }
        laden();
      } }, "Beleg entfernen"));
    }
    extras.push(h("button", { class: "btn gefahr klein", type: "button", onclick: async () => {
      if (!await bestaetigen("„" + x.beschreibung + "“ löschen?")) return;
      try { await api(url("/ausgaben/" + x.id), { method: "DELETE" }); meldung("Ausgabe gelöscht", false); }
      catch (err) { meldung(err.message); }
      laden();
    } }, "Löschen"));
  }
  return h("li", { class: "ausgabe" },
    avatar(x.zahler.name, x.zahler.id),
    h("span", { class: "text" }, h("strong", {}, x.beschreibung),
      h("small", {}, (meine ? "Du" : x.zahler.name) + " · " + datumKurz(x.datum))),
    h("span", { class: "betrag" }, eur(x.betragCent),
      x.waehrung === "JPY" ? h("small", {}, x.betragYen.toLocaleString("de-DE") + " ¥") : null),
    extras.length ? h("div", { class: "extras" }, extras) : null);
}

function standZeigen(s) {
  let plus = 0, minus = 0;
  for (const x of s) {
    if (x.an.id === ich.id) plus += x.betragCent;
    if (x.von.id === ich.id) minus += x.betragCent;
  }
  const saldo = plus - minus;
  const art = saldo > 0 ? "plus" : saldo < 0 ? "minus" : "null";
  const text = saldo > 0 ? "Du bekommst " + eur(saldo) : saldo < 0 ? "Du schuldest " + eur(-saldo) : "Alles beglichen";
  $("stand").replaceChildren(h("div", { class: "karte stand " + art },
    h("div", {}, h("small", {}, "Dein Stand"), h("div", { class: "gross" }, text))));
}

function schuldenZeigen(s, zahlungen) {
  $("schulden").replaceChildren(s.length
    ? h("ul", { class: "liste" }, s.map((x) => h("li", {},
      avatar(x.von.name, x.von.id),
      h("span", { class: "text" }, h("strong", {}, (x.von.id === ich.id ? "Du schuldest " : x.von.name + " schuldet ") + (x.an.id === ich.id ? "dir" : x.an.name))),
      h("span", { class: "betrag" }, eur(x.betragCent)),
      x.von.id === ich.id
        ? h("button", { class: "btn klein", type: "button", onclick: async () => {
          if (!await bestaetigen(eur(x.betragCent) + " an " + x.an.name + " als bezahlt eintragen?", "Eintragen")) return;
          try { await post(url("/begleichungen"), { anId: x.an.id, betragCent: x.betragCent }); meldung("Zahlung eingetragen", false); }
          catch (err) { meldung(err.message); }
          laden();
        } }, "Begleichen")
        : null)))
    : leer("Alles beglichen", "Niemand schuldet hier etwas."));
  $("zahlungen").replaceChildren(zahlungen.length
    ? h("ul", { class: "liste" }, zahlungen.map((z) => h("li", {},
      avatar(z.von.name, z.von.id),
      h("span", { class: "text" }, h("strong", {}, (z.von.id === ich.id ? "Du" : z.von.name) + " → " + (z.an.id === ich.id ? "dich" : z.an.name)), h("small", {}, datumKurz(z.datum))),
      h("span", { class: "betrag" }, eur(z.betragCent)),
      z.von.id === ich.id
        ? h("button", { class: "btn gefahr klein", type: "button", "aria-label": "Zahlung vom " + datumKurz(z.datum) + " löschen", onclick: async () => {
          if (!await bestaetigen("Zahlung löschen?")) return;
          try { await api(url("/begleichungen/" + z.id), { method: "DELETE" }); } catch (err) { meldung(err.message); }
          laden();
        } }, "Löschen")
        : null)))
    : leer("Noch keine Zahlungen", "Beglichene Schulden erscheinen hier."));
}

async function laden() {
  try {
    const [a, s, z] = await Promise.all([api(url("/ausgaben")), api(url("/schulden")), api(url("/begleichungen"))]);
    standZeigen(s);
    $("ausgaben").replaceChildren(a.length
      ? h("ul", { class: "karte liste" }, a.map(ausgabeZeile))
      : h("div", { class: "karte" }, leer("Noch keine Ausgaben", "Tippe auf „Ausgabe“, um die erste einzutragen.")));
    schuldenZeigen(s, z);
  } catch (err) { meldung(err.message); }
}

// Neue Ausgabe
const dlg = $("dlg-ausgabe");
const form = $("ausgabeform");
$("fab").onclick = () => {
  form.reset();
  form.elements.datum.value = new Date().toLocaleDateString("sv-SE");
  $("erkennung").textContent = "";
  dlg.showModal();
  form.elements.betrag.focus();
};
$("abbrechen").onclick = () => dlg.close();
form.elements.beleg.onchange = async () => {
  const bild = form.elements.beleg.files[0];
  const status = $("erkennung");
  status.textContent = "";
  if (!bild) return;
  status.textContent = "Summe wird gelesen …";
  try {
    const { summeYen } = await api("/api/erkennung/summe", { method: "POST", headers: { "content-type": bild.type }, body: bild });
    if (summeYen && !form.elements.betrag.value) {
      form.elements.betrag.value = summeYen;
      form.elements.waehrung.value = "JPY";
      status.textContent = "Vorschlag aus dem Foto – bitte prüfen.";
    } else {
      status.textContent = summeYen ? "" : "Keine Summe erkannt – bitte Betrag eintippen.";
    }
  } catch { status.textContent = "Keine Summe erkannt – bitte Betrag eintippen."; }
};
form.onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(form);
  const zahl = Number(String(f.get("betrag")).replace(",", "."));
  const body = { beschreibung: f.get("beschreibung") };
  if (f.get("waehrung") === "JPY") { body.waehrung = "JPY"; body.betragYen = zahl; }
  else body.betragCent = Math.round(zahl * 100);
  if (f.get("datum")) body.datum = f.get("datum");
  body.teilnehmerIds = f.getAll("teilnehmer").map(Number);
  const beleg = f.get("beleg");
  try {
    const neu = await post(url("/ausgaben"), body);
    if (beleg && beleg.size) {
      try { await api(url("/ausgaben/" + neu.id + "/beleg"), { method: "PUT", headers: { "content-type": beleg.type }, body: beleg }); }
      catch (err) { meldung("Ausgabe gespeichert, Beleg nicht: " + err.message); }
    }
    dlg.close();
    meldung("Ausgabe gespeichert", false);
    laden();
  } catch (err) { meldung(err.message); }
};

(async () => {
  try { [ich, g] = await Promise.all([api("/api/me"), api("/api/gruppen/" + GID)]); }
  catch (e) { meldung("Gruppe nicht gefunden."); return; }
  mitgliederZeigen();
  kandidatenLaden().catch(() => {});
  zeige(["ausgaben", "schulden", "mitglieder"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "ausgaben");
  laden();
})();`,
    { zurueck: true, titel: "Gruppe", nav: "gruppen" },
  );
}

export function einladungsseite(token: string, name: string): string {
  return seite(
    `<section class="karte mitte">
  <h2>Hallo ${esc(name)}!</h2>
  <p>Registriere einen Passkey, um die App zu nutzen.</p>
  <p style="margin-top:1rem"><button class="btn voll" id="reg">Passkey registrieren</button></p>
</section>`,
    `$("reg").onclick = async () => {
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
    `<section class="karte mitte"><h2>Link ungültig</h2><p>Dieser Einladungslink ist ungültig oder wurde bereits verwendet. Bitte den Admin um einen neuen.</p></section>`,
  );
}
