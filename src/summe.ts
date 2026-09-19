/**
 * Wählt aus dem erkannten Text eines japanischen Kassenbons die Rechnungssumme.
 * Liefert Yen als ganze Zahl oder null, wenn nichts Eindeutiges zu finden ist.
 */

/** Zeilen, deren Beträge nie die Rechnungssumme sind. */
const IGNORIERT =
  /預り|預かり|お釣|おつり|釣銭|釣り|現金|対象|消費税|内税|外税|割引|値引|ポイント|小計/;

/** Schlüsselwörter, stärkste Gruppe zuerst. */
const SCHLUESSEL = [/お?会計|総合計|税込合計/, /合計/, /税込/];

const BETRAG =
  /([¥￥]\s*)?(\d{1,3}(?:,\d{3})+|\d+)(\s*円)?(?!\d)(\s*(?:点|個|%|％|コ))?/g;

function normalisiere(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/，/g, ",")
    .replace(/[％]/g, "%");
}

interface Betrag {
  wert: number;
  /** Mit ¥, 円 oder Tausendertrenner – sonst könnte es eine Menge oder Nummer sein. */
  eindeutig: boolean;
}

function betraege(zeile: string): Betrag[] {
  const treffer: Betrag[] = [];
  for (const m of zeile.matchAll(BETRAG)) {
    if (m[4]) continue; // Stückzahl oder Prozentsatz
    const wert = Number(m[2].replaceAll(",", ""));
    if (wert <= 0) continue;
    treffer.push({
      wert,
      eindeutig: Boolean(m[1] || m[3] || m[2].includes(",")),
    });
  }
  return treffer;
}

export function waehleSumme(text: string): number | null {
  const zeilen = normalisiere(text).split(/\r?\n/).map((z) => z.trim());
  const brauchbar = (i: number) =>
    zeilen[i] !== undefined && !IGNORIERT.test(zeilen[i]);

  for (const schluessel of SCHLUESSEL) {
    let gefunden: number | null = null;
    zeilen.forEach((zeile, i) => {
      if (!schluessel.test(zeile) || IGNORIERT.test(zeile)) return;
      const hinter = zeile.slice(zeile.search(schluessel));
      let treffer = betraege(hinter);
      // OCR trennt Bezeichnung und Betrag oft in zwei Zeilen.
      if (
        !treffer.length && brauchbar(i + 1) && !schluessel.test(zeilen[i + 1])
      ) {
        treffer = betraege(zeilen[i + 1]);
      }
      if (treffer.length) gefunden = treffer[treffer.length - 1].wert;
    });
    if (gefunden !== null) return gefunden;
  }

  // Rückfall: größter eindeutiger Betrag.
  let groesster: number | null = null;
  zeilen.forEach((zeile, i) => {
    if (!brauchbar(i)) return;
    for (const b of betraege(zeile)) {
      if (b.eindeutig && (groesster === null || b.wert > groesster)) {
        groesster = b.wert;
      }
    }
  });
  return groesster;
}
