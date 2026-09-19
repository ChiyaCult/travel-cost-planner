// Aufruf: deno run --allow-net --allow-write=src scripts/schriften.ts
// Lädt DotGothic16 und Silkscreen (SIL OFL 1.1) einmalig von Google Fonts,
// reduziert auf die Zeichen, die die App braucht, und schreibt src/schriften.ts.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const bereich = (von: number, bis: number) =>
  Array.from({ length: bis - von + 1 }, (_, i) => String.fromCodePoint(von + i))
    .join("");
const LATEIN = bereich(0x20, 0x7e) + bereich(0xa0, 0xff) +
  bereich(0x100, 0x17f) + "€–—‘’‚“”„•…‹›→←✓×÷−＋";
const JAPANISCH = "おかえり財布プロフィール旅ー・";
const schriften = {
  "dotgothic16": ["DotGothic16", LATEIN + JAPANISCH],
  "silkscreen": ["Silkscreen", LATEIN],
} as const;

const b64 = (u: Uint8Array) => {
  let s = "";
  for (const c of u) s += String.fromCharCode(c);
  return btoa(s);
};
let ts =
  `// Selbst gehostete Schriften (WOFF2, base64), auf die genutzten Zeichen reduziert,
// damit keine Anfragen an Google Fonts gehen. Beide unter der SIL Open Font License 1.1:
// DotGothic16 © 2020 The DotGothic16 Project Authors, Silkscreen © 2001 Jason Kottke.
// Erzeugt von scripts/schriften.ts – neue Zeichen (z. B. Kanji) dort ergänzen.
const dekodiere = (b64: string) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export const SCHRIFTEN: Record<string, Uint8Array<ArrayBuffer>> = {
`;
for (const [datei, [familie, zeichen]] of Object.entries(schriften)) {
  const css = await (await fetch(
    `https://fonts.googleapis.com/css2?family=${familie}&text=${
      encodeURIComponent(zeichen)
    }`,
    { headers: { "user-agent": UA } },
  )).text();
  const url = css.match(/url\((https:[^)]+)\) format\('woff2'\)/)?.[1];
  if (!url) throw new Error("Keine woff2-URL für " + familie + ":\n" + css);
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  console.log(datei, bytes.length, "Bytes");
  ts += `  "${datei}.woff2": dekodiere(\n    "${b64(bytes)}",\n  ),\n`;
}
Deno.writeTextFileSync(
  new URL("../src/schriften.ts", import.meta.url),
  ts + "};\n",
);
