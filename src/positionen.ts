/**
 * Liest aus dem erkannten Text eines japanischen Kassenbons die Positionen.
 * Nur ein Vorschlag: Der Zahler prüft und bearbeitet die Liste vor dem Speichern.
 */
import {
  betraege,
  IGNORIERT,
  normalisiere,
  SCHLUESSEL,
  waehleSumme,
} from "./summe.ts";

/** Rabattzeilen gehören zur Position darüber. */
const RABATT = /割引|値引/;

/** Datum, Uhrzeit, Telefon, URL: Zahlen am Ende solcher Zeilen sind keine Preise. */
const KOPF = /\d[-:/]\d|年|TEL|電話|htt|www/i;

export interface Position {
  bezeichnung: string;
  betragYen: number;
}

/** Tesseract setzt Leerzeichen und Punkte in Wörter („お 預 り“, „小。 計“). */
const kompakt = (zeile: string) => zeile.replace(/[\s。、・.]/g, "");

/** Schriftzeichen einer Bezeichnung; OCR-Rauschen hat meist höchstens eines. */
const zeichen = (s: string) =>
  (s.match(/[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}A-Za-z]/gu) ?? []).length;

/**
 * Preis einer Zeile: mit ¥ irgendwo, sonst nur eine Zahl am Zeilenende –
 * ab 10 ¥, kleinere sind ohne ¥ meist Stückzahlen oder Rauschen.
 */
function betragDerZeile(zeile: string): number | null {
  const eindeutig = betraege(zeile).filter((b) => b.eindeutig);
  if (eindeutig.length) return eindeutig[eindeutig.length - 1].wert;
  if (KOPF.test(zeile)) return null;
  const m = zeile.match(/(?:^|\s)(\d{1,3}(?:,\d{3})+|\d+)$/);
  const wert = m ? Number(m[1].replaceAll(",", "")) : 0;
  return Number.isSafeInteger(wert) && wert >= 10 ? wert : null;
}

// Stückpreis und Betrag gehören nicht zur Bezeichnung, die Menge schon.
const bezeichnung = (zeile: string) =>
  zeile.replace(/[×＊*@¥].*$/, "").replace(/\s*\d[\d,]*$/, "").trim();

export function waehlePositionen(text: string): Position[] {
  const summe = waehleSumme(text);
  const positionen: Position[] = [];
  // Bezeichnung ohne Preis: OCR setzt den Preis oft in die nächste Zeile.
  let ohnePreis: string | null = null;
  for (const zeile of normalisiere(text).split(/\r?\n/).map((z) => z.trim())) {
    const k = kompakt(zeile);
    // Ab der Rechnungssumme folgen nur noch Zahlung und Werbung.
    if (SCHLUESSEL.some((s) => s.test(k))) break;
    const betrag = betragDerZeile(zeile);
    if (RABATT.test(k)) {
      const vorige = positionen[positionen.length - 1];
      if (vorige && betrag) {
        vorige.betragYen = Math.max(0, vorige.betragYen - betrag);
      }
      continue;
    }
    // Verlesene Summenzeile: derselbe Betrag wie die Summe nach Positionen.
    if (betrag !== null && positionen.length && betrag === summe) break;
    if (IGNORIERT.test(k)) {
      ohnePreis = null;
      continue;
    }
    if (betrag === null) {
      ohnePreis = zeichen(zeile) >= 2 && !KOPF.test(zeile) ? zeile : null;
      continue;
    }
    let name = bezeichnung(zeile);
    if (zeichen(name) < 2) {
      if (!ohnePreis) continue;
      name = ohnePreis;
    }
    ohnePreis = null;
    positionen.push({ bezeichnung: name, betragYen: betrag });
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
