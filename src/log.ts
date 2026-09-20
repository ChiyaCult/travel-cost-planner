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

/** Beschreibt den Grund eines Fehlers; `ursache` darf alles sein, was geworfen wurde. */
function grund(ursache: unknown): string {
  return ursache instanceof Error
    ? `${ursache.name}: ${ursache.message}`
    : String(ursache);
}

export const log = {
  /** Ein fachliches Ereignis, z. B. dass eine Ausgabe erfasst wurde. */
  ereignis(name: string, felder: Felder = {}): void {
    schreibe("info", name, felder);
  },

  /** Ein vorhergesehener Fehler, z. B. ein Dienst, der nicht antwortet. */
  fehler(name: string, ursache: unknown, felder: Felder = {}): void {
    schreibe("fehler", name, { ...felder, grund: grund(ursache) });
  },

  /**
   * Eine unerwartete Ausnahme: wie `fehler`, aber mit Aufrufliste – die braucht
   * man nur dort, wo der Fehler ein Fehler im Programm sein kann.
   */
  ausnahme(name: string, ursache: unknown, felder: Felder = {}): void {
    schreibe("fehler", name, {
      ...felder,
      grund: grund(ursache),
      stack: ursache instanceof Error ? ursache.stack : undefined,
    });
  },
};
