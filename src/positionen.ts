/**
 * Liest aus dem erkannten Text eines japanischen Kassenbons die Positionen.
 * Nur ein Vorschlag: Der Zahler prüft und bearbeitet die Liste vor dem Speichern.
 */
import { betraege, IGNORIERT, normalisiere, SCHLUESSEL } from "./summe.ts";

/** Rabattzeilen gehören zur Position darüber. */
const RABATT = /割引|値引/;

export interface Position {
  bezeichnung: string;
  betragYen: number;
}

export function waehlePositionen(text: string): Position[] {
  const positionen: Position[] = [];
  for (const zeile of normalisiere(text).split(/\r?\n/).map((z) => z.trim())) {
    // Ab der Rechnungssumme folgen nur noch Zahlung und Werbung.
    if (SCHLUESSEL.some((s) => s.test(zeile))) break;
    const treffer = betraege(zeile).filter((b) => b.eindeutig);
    if (RABATT.test(zeile)) {
      const vorige = positionen[positionen.length - 1];
      if (vorige && treffer.length) {
        vorige.betragYen = Math.max(
          0,
          vorige.betragYen - treffer[treffer.length - 1].wert,
        );
      }
      continue;
    }
    if (IGNORIERT.test(zeile) || !treffer.length) continue;
    // Stückpreis und Betrag gehören nicht zur Bezeichnung, die Menge schon.
    const bezeichnung = zeile.replace(/[×＊*@¥].*$/, "").trim();
    positionen.push({
      bezeichnung,
      betragYen: treffer[treffer.length - 1].wert,
    });
  }
  return positionen;
}

/**
 * Yen-Betrag einer Ausgabe aus den angehakten Positionen. Steuer und andere
 * Differenz zur Rechnungssumme verteilen sich anteilig auf alle Positionen.
 */
export function betragAusPositionen(e: {
  gewaehltYen: number[];
  allePositionenYen: number;
  rechnungssummeYen: number;
}): number {
  const gewaehlt = e.gewaehltYen.reduce((a, b) => a + b, 0);
  return Math.round(gewaehlt * e.rechnungssummeYen / e.allePositionenYen);
}
