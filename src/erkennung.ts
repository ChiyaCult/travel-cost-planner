import { log } from "./log.ts";
import { waehleSumme } from "./summe.ts";

/** Grenze zur lokalen Texterkennung; Tests setzen einen Fake ein. */
export interface Texterkennung {
  /** Liest den Text eines Fotos. Wirft, wenn die Erkennung fehlschlägt oder zu lange dauert. */
  lies(bild: Uint8Array): Promise<string>;
}

const ZEITLIMIT_MS = 30_000;

/** Tesseract mit Japanisch, läuft lokal als Kindprozess – kein Netzwerkaufruf (ADR 0001). */
export const tesseract: Texterkennung = {
  async lies(bild) {
    const prozess = new Deno.Command("tesseract", {
      args: ["stdin", "stdout", "-l", "jpn", "--psm", "6"],
      stdin: "piped",
      stdout: "piped",
      stderr: "null",
      signal: AbortSignal.timeout(ZEITLIMIT_MS),
    }).spawn();
    const schreiber = prozess.stdin.getWriter();
    schreiber.write(bild).then(() => schreiber.close()).catch(() => {});
    const { success, stdout } = await prozess.output();
    if (!success) throw new Error("Texterkennung fehlgeschlagen");
    return new TextDecoder().decode(stdout);
  },
};

/** Summe in Yen oder null, wenn nichts erkannt wurde – Fehler und Zeitüberschreitung eingeschlossen. */
export async function erkenneSumme(
  erkennung: Texterkennung,
  bild: Uint8Array,
): Promise<number | null> {
  try {
    return waehleSumme(await erkennung.lies(bild));
  } catch (e) {
    // Der Nutzer sieht nur "kein Vorschlag"; der Betreiber soll den Grund sehen
    // (z. B. fehlendes Tesseract oder Zeitüberschreitung).
    log.fehler("erkennung.fehlgeschlagen", e, { bytes: bild.length });
    return null;
  }
}
