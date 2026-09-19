const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(
    /"/g,
    "&quot;",
  );

/** Setzt den CSP-Nonce der Antwort in das Inline-Skript der Seite. */
export const mitNonce = (
  html: string,
  c: { get(key: "secureHeadersNonce"): string | undefined },
) =>
  html.replace("<script>", `<script nonce="${c.get("secureHeadersNonce")}">`);

// Pixel-Rahmen: 2px-Linie mit ausgesparten Ecken, optional mit hartem Versatzschatten.
const px = (rahmen: string, schatten?: string, versatz = 4) =>
  `0 -2px 0 0 ${rahmen},0 2px 0 0 ${rahmen},-2px 0 0 0 ${rahmen},2px 0 0 0 ${rahmen}${
    schatten ? `,${versatz}px ${versatz}px 0 0 ${schatten}` : ""
  }`;

// Farben aus dem App-Symbol (Calico-Katze mit Yen): Tinte, Papier, Cyan, Rost.
const STIL = `
@font-face{font-family:"DotGothic16";src:url(/schriften/dotgothic16.woff2) format("woff2");font-display:swap}
@font-face{font-family:"Silkscreen";src:url(/schriften/silkscreen.woff2) format("woff2");font-display:swap}
:root{
  --papier:#fcf0e4;--flaeche:#fff9f1;--tinte:#0c0c48;--text-2:#4a4668;--muted:#6b6581;--linie:#d8c9ba;
  --akzent:#a8432f;--cyan:#54f0fc;--schatten:#54f0fc;--auf-tinte:#fcf0e4;
  --plus:#0b6e66;--minus:#a8324f;--fokus:#0c0c48;
  --p0:#604860;--p1:#a8432f;--p2:#b03a5e;--p3:#16697f;--p4:#7a5a12;
  --raster:radial-gradient(#ead9c8 1px,transparent 1px);
  --pixel:"DotGothic16",ui-monospace,monospace;--label:"Silkscreen","DotGothic16",ui-monospace,monospace;
}
@media (prefers-color-scheme:dark){:root{
  --papier:#0a0a2e;--flaeche:#13134a;--tinte:#fcf0e4;--text-2:#c4bedb;--muted:#9d97ba;--linie:#2c2c6a;
  --akzent:#f4a07a;--schatten:#e49054;--auf-tinte:#0a0a2e;
  --plus:#54f0fc;--minus:#f58aa0;--fokus:#54f0fc;
  --p0:#cc9cc0;--p1:#e49054;--p2:#f07884;--p3:#54f0fc;--p4:#e8c872;
  --raster:linear-gradient(#15154a 1px,transparent 1px),linear-gradient(90deg,#15154a 1px,transparent 1px);
}}
*{box-sizing:border-box}
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%}
body{margin:0;font:1rem/1.5 var(--pixel);color:var(--tinte);background-color:var(--papier);background-image:var(--raster);background-size:10px 10px;min-height:100vh;font-variant-numeric:tabular-nums}
a{color:var(--akzent)}
h1,h2,h3{margin:0;font-weight:400}
h1{font-size:1.5rem;line-height:1.2}
h2{font:.8rem var(--label);letter-spacing:.06em;text-transform:uppercase;color:var(--akzent)}
p{margin:.25rem 0;color:var(--text-2)}
small,.muted{color:var(--muted);font-size:.85rem}
:focus-visible{outline:2px dashed var(--fokus);outline-offset:4px}

/* Kopf */
.kopf{padding:1.25rem 1rem .9rem;border-bottom:2px solid var(--tinte);background:var(--papier)}
.kopfzeile{max-width:40rem;margin:0 auto;display:flex;align-items:center;gap:.8rem}
.kopf h1{overflow-wrap:anywhere}
.logo{flex:none;width:44px;height:44px}
.rueck{flex:none;display:grid;place-items:center;width:2.75rem;height:2.75rem;color:var(--tinte);text-decoration:none}
.rueck svg{width:1.25rem;height:1.25rem}
.unter{max-width:40rem;margin:.35rem auto 0;font:.75rem var(--label);letter-spacing:.06em;text-transform:uppercase;color:var(--akzent)}

main{max-width:40rem;margin:0 auto;padding:1.5rem 1rem 9rem;display:grid;gap:1.5rem}
.karte{background:var(--flaeche);box-shadow:${
  px("var(--tinte)", "var(--schatten)")
};padding:1.1rem 1.1rem;margin:2px 6px 6px 2px}
.karte>h2{margin-bottom:.6rem}
.leer{text-align:center;color:var(--text-2);padding:1.5rem 1rem}
.leer strong{display:block;color:var(--tinte);font-size:1.1rem;font-weight:400;margin-bottom:.35rem}

/* Formulare */
label,legend{font-size:.95rem;color:var(--text-2);display:block}
.feld{display:grid;gap:.4rem;margin:1rem 0}
input,select,button{font:inherit;color:inherit}
input:not([type=checkbox]),select{width:100%;min-height:2.75rem;padding:.55rem .75rem;border:0;border-radius:0;background:var(--flaeche);color:var(--tinte);box-shadow:${
  px("var(--tinte)")
};margin:2px}
input:not([type=checkbox]):focus,select:focus{outline:none;box-shadow:${
  px("var(--tinte)", "var(--cyan)", 3)
}}
input[type=file]{box-shadow:none!important;padding:.4rem 0}
input::file-selector-button{font:.75rem var(--label);text-transform:uppercase;border:0;padding:.55rem .8rem;margin-right:.75rem;background:var(--tinte);color:var(--auf-tinte);cursor:pointer}
fieldset{border:0;padding:0;margin:1rem 0}
legend{margin-bottom:.5rem}
.zeile{display:grid;grid-template-columns:1fr 5.5rem;gap:1rem}
.checks{display:flex;flex-wrap:wrap;gap:.75rem}
.check{display:flex;align-items:center;gap:.6rem;padding:.45rem .8rem;min-height:2.75rem;cursor:pointer;color:var(--tinte);box-shadow:${
  px("var(--tinte)")
};margin:2px}
.check:has(input:checked){background:var(--tinte);color:var(--auf-tinte)}
.check:has(input:focus-visible){outline:2px dashed var(--fokus);outline-offset:4px}
input[type=checkbox]{appearance:none;margin:0;width:1rem;height:1rem;flex:none;cursor:pointer;border:2px solid currentColor;background:transparent}
input[type=checkbox]:checked{background:currentColor;box-shadow:inset 0 0 0 2px var(--tinte)}
input[type=checkbox]:focus-visible{outline:none}
.hilfe{color:var(--muted);font-size:.85rem;min-height:1.3rem}

/* Buttons */
.btn{min-height:2.75rem;padding:.6rem 1.1rem;margin:2px 6px 6px 2px;border:0;border-radius:0;background:var(--tinte);color:var(--auf-tinte);font:.8rem var(--label);letter-spacing:.04em;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;text-decoration:none;box-shadow:${
  px("var(--tinte)", "var(--schatten)")
};transition:transform .08s steps(2),box-shadow .08s steps(2)}
.btn:active{transform:translate(3px,3px);box-shadow:${
  px("var(--tinte)", "var(--schatten)", 1)
}}
.btn.sek{background:var(--flaeche);color:var(--tinte);box-shadow:${
  px("var(--tinte)")
}}
.btn.sek:active{transform:translate(1px,1px)}
.btn.gefahr{background:var(--flaeche);color:var(--minus);box-shadow:${
  px("var(--minus)")
}}
.btn.gefahr-voll{background:var(--minus);color:var(--auf-tinte);box-shadow:${
  px("var(--minus)", "var(--tinte)")
}}
.btn.klein{min-height:2.25rem;padding:.35rem .7rem;font-size:.7rem}
.btn.voll{width:calc(100% - 8px);min-height:3.25rem;font-size:.9rem}
.aktionen{display:flex;gap:.75rem;justify-content:flex-end;margin-top:1.5rem;flex-wrap:wrap}
input[type=file].versteckt{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
label.btn:has(input:focus-visible){outline:2px dashed var(--fokus);outline-offset:4px}

/* Stempel (Avatare), Listen */
.avatar{flex:none;display:grid;place-items:center;width:2.25rem;height:2.25rem;margin:2px;font-size:1rem;color:var(--p0);box-shadow:${
  px("currentColor")
};background:var(--flaeche)}
.c0{color:var(--p0);transform:rotate(-4deg)}.c1{color:var(--p1);transform:rotate(3deg)}.c2{color:var(--p2);transform:rotate(-2deg)}
.c3{color:var(--p3);transform:rotate(4deg)}.c4{color:var(--p4);transform:rotate(-3deg)}
.liste{list-style:none;margin:0;padding:0}
.karte.liste{padding:.6rem 1.1rem}
.liste>li{display:flex;gap:.9rem;align-items:center;padding:.8rem 0;border-top:2px dotted var(--linie)}
.liste>li:first-child{border-top:0;padding-top:.2rem}
.liste>li:last-child{padding-bottom:.2rem}
.liste .text{flex:1;min-width:0}
.liste .text strong,.liste .text small{display:block;overflow-wrap:anywhere}
.liste .text strong{font-weight:400}
.betrag{text-align:right;white-space:nowrap;font-size:1.05rem}
.betrag small{display:block;font-size:.85rem}
.gruppenkarte{display:flex;gap:.9rem;align-items:center;text-decoration:none;color:inherit;width:100%;min-height:2.75rem}
.gruppenkarte .name{font-size:1.1rem}
.gruppenkarte:hover .name{text-decoration:underline;text-decoration-thickness:2px}
.pfeil{color:var(--akzent)}
.pfeil svg{width:1rem;height:1rem;display:block}
.zeile-knopf{display:flex;gap:.9rem;align-items:center;width:100%;min-height:2.75rem;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.zeile-knopf:hover strong{text-decoration:underline;text-decoration-thickness:2px}
.leiste{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.stempel{display:flex;flex-wrap:wrap;gap:.4rem}
.stempel .avatar{width:1.9rem;height:1.9rem;font-size:.85rem}
.kartenkopf{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.6rem}
.kartenkopf h2{margin:0}
.detail-titel{font-size:1.25rem;color:var(--tinte);margin:.2rem 0 .6rem;overflow-wrap:anywhere}
.detail-betrag{font-size:2rem;line-height:1.2;color:var(--tinte)}
.detail-betrag small{font-size:1rem;margin-left:.5rem}
.beleg-gross{display:block;margin:1rem 2px}
.beleg-gross img{display:block;width:100%;max-height:45vh;object-fit:contain;background:var(--flaeche);box-shadow:${
  px("var(--tinte)")
}}
.aktionen.links{justify-content:flex-start;margin-top:1rem}
.stand{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem}
.stand .gross{font-size:1.6rem;line-height:1.25}
.stand small{font-size:.9rem}
.stand.plus .gross{color:var(--plus)}
.stand.minus .gross{color:var(--minus)}

/* Tabs */
[role=tablist]{display:flex;gap:.5rem;margin:0 0 -.25rem;overflow-x:auto}
[role=tab]{min-height:2.75rem;padding:.4rem .75rem;border:0;border-radius:0;background:transparent;font:.75rem var(--label);letter-spacing:.05em;text-transform:uppercase;color:var(--text-2);cursor:pointer}
[role=tab]:hover{color:var(--tinte)}
[role=tab][aria-selected=true]{background:var(--tinte);color:var(--auf-tinte)}
[role=tabpanel]{display:grid;gap:1.5rem}

/* Untere Navigation und Aktionsknopf */
.nav{position:fixed;left:0;right:0;bottom:0;z-index:20;background:var(--papier);border-top:2px solid var(--tinte);padding:.5rem .5rem calc(.5rem + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:.5rem}
.nav a{flex:1;max-width:12rem;display:grid;justify-items:center;gap:.3rem;padding:.45rem;text-decoration:none;color:var(--text-2);font:.65rem var(--label);letter-spacing:.05em;text-transform:uppercase;min-height:3.25rem}
.nav a[aria-current=page]{color:var(--tinte);background:var(--flaeche);box-shadow:${
  px("var(--tinte)")
}}
.nav svg{width:1.5rem;height:1.5rem;fill:currentColor;shape-rendering:crispEdges}
.fab{position:fixed;right:1.25rem;bottom:calc(5.5rem + env(safe-area-inset-bottom));z-index:15;min-height:3.25rem;font-size:.85rem}

/* Dialoge */
dialog.dlg{border:0;border-radius:0;padding:1.5rem;width:min(30rem,calc(100% - 2.5rem));max-height:90vh;background:var(--papier);color:var(--tinte);box-shadow:${
  px("var(--tinte)", "var(--schatten)", 6)
};animation:auf .18s steps(3)}
dialog.dlg::backdrop{background:rgba(12,12,72,.55)}
dialog.dlg h2{margin-bottom:.75rem}
@keyframes auf{from{opacity:0;transform:translateY(1.5rem)}to{opacity:1;transform:none}}
@media (max-width:599px){dialog.dlg{margin:auto auto 0;width:100%;max-width:100%;padding:1.25rem 1rem calc(1.25rem + env(safe-area-inset-bottom));box-shadow:0 -3px 0 0 var(--tinte)}}

/* Hinweise */
#toasts{position:fixed;left:0;right:0;top:1rem;z-index:50;display:grid;justify-items:center;gap:.75rem;pointer-events:none;padding:0 1rem;max-height:80vh;overflow-y:auto}
.toast{pointer-events:auto;background:var(--flaeche);color:var(--tinte);padding:.75rem 1rem;max-width:36rem;margin:2px 6px 6px 2px;box-shadow:${
  px("var(--tinte)", "var(--schatten)")
};animation:ab .18s steps(3)}
.toast.fehler{color:var(--minus);box-shadow:${
  px("var(--minus)", "var(--minus)")
}}
@keyframes ab{from{opacity:0;transform:translateY(-1rem)}to{opacity:1;transform:none}}
.skel{height:4rem;margin:2px;background:var(--flaeche);box-shadow:${
  px("var(--linie)")
};animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.4}}
#link{word-break:break-all;background:var(--papier);padding:.75rem;display:block;margin:.75rem 2px;box-shadow:${
  px("var(--linie)")
}}
.mitte{text-align:center}
.mitte .logo{width:88px;height:88px;margin:0 auto .75rem;display:block}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

/** Pixel-Symbol aus einem Raster: "#" ist ein gefülltes Pixel. */
const pixelSymbol = (zeilen: string[]) => {
  const rects = zeilen.flatMap((z, y) =>
    [...z.matchAll(/#+/g)].map((m) =>
      `<rect x="${m.index}" y="${y}" width="${m[0].length}" height="1"/>`
    )
  );
  return `<svg viewBox="0 0 ${
    zeilen[0].length
  } ${zeilen.length}" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${
    rects.join("")
  }</svg>`;
};

const ICONS = {
  gruppen: pixelSymbol([
    "............",
    "..###.......",
    ".#####..##..",
    ".#####.####.",
    "..###..####.",
    "........##..",
    ".#####......",
    "#######.###.",
    "#######.####",
    "#######.####",
    "............",
    "............",
  ]),
  profil: pixelSymbol([
    "............",
    "....####....",
    "...######...",
    "...######...",
    "...######...",
    "....####....",
    "............",
    "..########..",
    ".##########.",
    ".##########.",
    ".##########.",
    "............",
  ]),
  zurueck: pixelSymbol([
    "...#....",
    "..##....",
    ".#######",
    "########",
    ".#######",
    "..##....",
    "...#....",
    "........",
  ]),
  weiter: pixelSymbol([
    "..#.....",
    "..##....",
    "...##...",
    "....##..",
    "...##...",
    "..##....",
    "..#.....",
    "........",
  ]),
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
<meta name="theme-color" content="#fcf0e4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0a0a2e" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<link rel="preload" href="/schriften/dotgothic16.woff2" as="font" type="font/woff2" crossorigin>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/png" href="/logo.png">
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
      ? `<a class="rueck" href="/" aria-label="Zurück zu allen Gruppen">${ICONS.zurueck}</a>`
      : '<img class="logo" src="/logo.png" alt="" width="44" height="44">'
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
const avatar = (n, id) => h("span", { class: "avatar c" + (id % 5), "aria-hidden": "true" }, initialen(n));
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
  <img class="logo" src="/logo.png" alt="" width="88" height="88">
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
      Object.assign(h("span", { class: "pfeil" }), { innerHTML: ${
      JSON.stringify(ICONS.weiter)
    } }))))));
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
      untertitel: `おかえり · Hallo ${esc(user.name)}`,
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
    {
      titel: "Profil",
      untertitel: `プロフィール · ${esc(user.name)}`,
      nav: "profil",
    },
  );
}

export function gruppenseite(gruppeId: number): string {
  return seite(
    `<div class="leiste">
  <div class="stempel" id="stempel" role="img"></div>
  <button class="btn sek klein" id="plus-mitglied" type="button"><span aria-hidden="true">＋</span> Mitglied</button>
</div>

<div role="tablist" aria-label="Bereiche der Gruppe">
  <button role="tab" id="tab-ausgaben" data-tab="ausgaben" aria-controls="p-ausgaben" aria-selected="true">Ausgaben</button>
  <button role="tab" id="tab-schulden" data-tab="schulden" aria-controls="p-schulden" aria-selected="false" tabindex="-1">Schulden</button>
  <button role="tab" id="tab-mitglieder" data-tab="mitglieder" aria-controls="p-mitglieder" aria-selected="false" tabindex="-1">Mitglieder</button>
</div>

<section role="tabpanel" id="p-ausgaben" aria-labelledby="tab-ausgaben">
  <div class="karte leer" id="allein" hidden>
    <strong>Noch allein hier</strong>
    Füge Freunde hinzu, damit ihr Ausgaben teilen könnt.
    <p style="margin-top:1rem"><button class="btn" id="allein-knopf" type="button"><span aria-hidden="true">＋</span> Mitglieder hinzufügen</button></p>
  </div>
  <div id="stand"></div>
  <div id="ausgaben" aria-live="polite"><div class="skel"></div></div>
</section>
<section role="tabpanel" id="p-schulden" aria-labelledby="tab-schulden" hidden>
  <div class="karte"><h2>Offene Schulden</h2><div id="schulden"></div></div>
  <div class="karte"><h2>Zahlungen</h2><div id="zahlungen"></div></div>
</section>
<section role="tabpanel" id="p-mitglieder" aria-labelledby="tab-mitglieder" hidden>
  <div class="karte">
    <div class="kartenkopf"><h2>Mitglieder</h2>
    <button class="btn klein" id="mitglied-neu" type="button"><span aria-hidden="true">＋</span> Hinzufügen</button></div>
    <ul class="liste" id="mitglieder"></ul>
  </div>
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
</dialog>

<dialog class="dlg" id="dlg-mitglied" aria-labelledby="dlg-mitglied-titel">
  <form id="mitgliedform">
    <h2 id="dlg-mitglied-titel">Mitglieder hinzufügen</h2>
    <p id="kandidaten-leer" hidden>Alle Nutzer sind schon in dieser Gruppe. Neue Personen lädt der Admin unter „Profil“ in die App ein.</p>
    <fieldset id="kandidaten-feld"><legend>Wer soll dazu?</legend><div class="checks" id="kandidaten"></div></fieldset>
    <div class="aktionen">
      <button class="btn sek" type="button" id="mitglied-abbrechen">Abbrechen</button>
      <button class="btn" id="mitglied-ok">Hinzufügen</button>
    </div>
  </form>
</dialog>

<dialog class="dlg" id="dlg-detail" aria-labelledby="detail-titel"><div id="detail"></div></dialog>`,
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
  $("stempel").replaceChildren(...g.mitglieder.map((m) => avatar(m.name, m.id)));
  $("stempel").setAttribute("aria-label", "Mitglieder: " + g.mitglieder.map((m) => m.name).join(", "));
  $("allein").hidden = g.mitglieder.length > 1;
}
// Bestehende Nutzer zur Gruppe hinzufügen (mehrere auf einmal).
const dlgMitglied = $("dlg-mitglied");
async function mitgliedDialog() {
  let kandidaten;
  try { kandidaten = await api(url("/kandidaten")); } catch (err) { meldung(err.message); return; }
  $("kandidaten").replaceChildren(...kandidaten.map((n) =>
    h("label", { class: "check" }, h("input", { type: "checkbox", name: "kandidat", value: n.id }), n.name)));
  $("kandidaten-leer").hidden = kandidaten.length > 0;
  $("kandidaten-feld").hidden = !kandidaten.length;
  $("mitglied-ok").hidden = !kandidaten.length;
  $("mitglied-abbrechen").textContent = kandidaten.length ? "Abbrechen" : "Schließen";
  dlgMitglied.showModal();
}
for (const id of ["plus-mitglied", "mitglied-neu", "allein-knopf"]) $(id).onclick = mitgliedDialog;
$("mitglied-abbrechen").onclick = () => dlgMitglied.close();
$("mitgliedform").onsubmit = async (e) => {
  e.preventDefault();
  const ids = new FormData(e.target).getAll("kandidat").map(Number);
  if (!ids.length) { meldung("Wähle mindestens eine Person aus."); return; }
  try {
    for (const nutzerId of ids) await post(url("/mitglieder"), { nutzerId });
    dlgMitglied.close();
    meldung(ids.length === 1 ? "Mitglied hinzugefügt" : ids.length + " Mitglieder hinzugefügt", false);
  } catch (err) { meldung(err.message); }
  try { g = await api("/api/gruppen/" + GID); mitgliederZeigen(); } catch {}
};

const betragFeld = (x) => x.waehrung === "JPY"
  ? h("span", { class: "betrag" }, x.betragYen.toLocaleString("de-DE") + " ¥", h("small", {}, eur(x.betragCent)))
  : h("span", { class: "betrag" }, eur(x.betragCent));

function ausgabeZeile(x) {
  const meine = x.zahler.id === ich.id;
  return h("li", {},
    h("button", { type: "button", class: "zeile-knopf", "aria-haspopup": "dialog", onclick: () => detailZeigen(x) },
      avatar(x.zahler.name, x.zahler.id),
      h("span", { class: "text" }, h("strong", {}, x.beschreibung),
        h("small", {}, (meine ? "Du" : x.zahler.name) + " · " + datumKurz(x.datum) + (x.hatBeleg ? " · Beleg" : ""))),
      betragFeld(x)));
}

// Detailansicht: Beleg groß, Aktionen nur für den Zahler.
const dlgDetail = $("dlg-detail");
function detailZeigen(x) {
  const meine = x.zahler.id === ich.id;
  const beleg = url("/ausgaben/" + x.id + "/beleg");
  const fertig = () => { dlgDetail.close(); laden(); };
  const aktionen = [];
  if (meine) {
    const inp = h("input", { type: "file", accept: "image/*", class: "versteckt", onchange: async () => {
      const datei = inp.files[0];
      if (!datei) return;
      try {
        await api(beleg, { method: "PUT", headers: { "content-type": datei.type }, body: datei });
        meldung("Beleg gespeichert", false);
      } catch (err) { meldung("Beleg nicht gespeichert: " + err.message); }
      fertig();
    } });
    aktionen.push(h("label", { class: "btn sek klein" }, x.hatBeleg ? "Beleg ersetzen" : "Beleg hinzufügen", inp));
    if (x.hatBeleg) {
      aktionen.push(h("button", { class: "btn sek klein", type: "button", onclick: async () => {
        try { await api(beleg, { method: "DELETE" }); meldung("Beleg entfernt", false); }
        catch (err) { meldung("Beleg nicht entfernt: " + err.message); }
        fertig();
      } }, "Beleg entfernen"));
    }
    aktionen.push(h("button", { class: "btn gefahr klein", type: "button", onclick: async () => {
      if (!await bestaetigen("„" + x.beschreibung + "“ löschen?")) return;
      try { await api(url("/ausgaben/" + x.id), { method: "DELETE" }); meldung("Ausgabe gelöscht", false); }
      catch (err) { meldung(err.message); }
      fertig();
    } }, "Löschen"));
  }
  const yen = x.waehrung === "JPY";
  $("detail").replaceChildren(
    h("h2", {}, "Ausgabe"),
    h("p", { class: "detail-titel", id: "detail-titel" }, x.beschreibung),
    h("div", { class: "detail-betrag" },
      yen ? x.betragYen.toLocaleString("de-DE") + " ¥" : eur(x.betragCent),
      yen ? h("small", {}, "= " + eur(x.betragCent)) : null),
    yen && x.kurs ? h("small", {}, "Kurs: 1 € = " + (1 / x.kurs).toLocaleString("de-DE", { maximumFractionDigits: 2 }) + " ¥") : null,
    h("p", {}, "Bezahlt von " + (meine ? "dir" : x.zahler.name) + " am " + datumKurz(x.datum)),
    x.hatBeleg
      ? h("a", { class: "beleg-gross", href: beleg, target: "_blank", "aria-label": "Beleg in voller Größe öffnen" },
        h("img", { src: beleg, alt: "Beleg zu " + x.beschreibung }))
      : h("p", {}, h("small", {}, "Kein Beleg")),
    aktionen.length ? h("div", { class: "aktionen links" }, aktionen) : null,
    h("div", { class: "aktionen" }, h("button", { class: "btn sek", type: "button", onclick: () => dlgDetail.close() }, "Schließen")));
  dlgDetail.showModal();
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
  zeige(["ausgaben", "schulden", "mitglieder"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "ausgaben");
  laden();
})();`,
    {
      zurueck: true,
      titel: "Gruppe",
      untertitel: "財布 · Gruppenkasse",
      nav: "gruppen",
    },
  );
}

export function einladungsseite(token: string, name: string): string {
  return seite(
    `<section class="karte mitte">
  <img class="logo" src="/logo.png" alt="" width="88" height="88">
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
