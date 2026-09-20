/**
 * Protokoll der App: eine Zeile JSON je Eintrag, Ereignisse auf stdout,
 * Fehler auf stderr. Der Betreiber liest sie mit `docker compose logs`.
 *
 * Es werden nur Kennungen (Ids) und fachliche Eckdaten protokolliert, nie
 * Namen, Beschreibungen oder Belege – das Log soll niemandem verraten, was
 * jemand gekauft hat.
 *
 * `LOG=aus` schaltet das Protokoll ab (Tests).
 */

export type Felder = Record<string, unknown>;

/** Bei jedem Eintrag geprüft, damit Tests das Protokoll abschalten können. */
const abgeschaltet = () => Deno.env.get("LOG") === "aus";

function schreibe(
  stufe: "info" | "fehler",
  name: string,
  felder: Felder,
): void {
  if (abgeschaltet()) return;
  const zeile = JSON.stringify({
    zeit: new Date().toISOString(),
    stufe,
    ereignis: name,
    ...felder,
  });
  if (stufe === "fehler") console.error(zeile);
  else console.log(zeile);
}

/** Beschreibt den Grund eines Fehlers, ohne Aufrufliste (die steht separat). */
function grund(ursache: unknown): Felder {
  if (ursache instanceof Error) {
    return {
      grund: `${ursache.name}: ${ursache.message}`,
      stack: ursache.stack,
    };
  }
  return { grund: String(ursache) };
}

export const log = {
  /** Ein fachliches Ereignis, z. B. dass eine Ausgabe erfasst wurde. */
  ereignis(name: string, felder: Felder = {}): void {
    schreibe("info", name, felder);
  },

  /** Ein Fehler samt Ursache; `ursache` darf alles sein, was geworfen wurde. */
  fehler(name: string, ursache: unknown, felder: Felder = {}): void {
    schreibe("fehler", name, { ...felder, ...grund(ursache) });
  },
};
