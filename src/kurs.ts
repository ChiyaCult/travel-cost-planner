import { log } from "./log.ts";

/** Fremdwährungen, die in ganzen Einheiten (ohne Untereinheit) erfasst werden. */
export const FREMDWAEHRUNGEN = ["JPY", "TWD"] as const;
export type Fremdwaehrung = typeof FREMDWAEHRUNGEN[number];

/** Grenze zum externen Kursdienst; Tests setzen einen Fake ein. */
export interface Kursdienst {
  /** Euro pro 1 Einheit der Währung am Datum (YYYY-MM-DD). Wirft, wenn der Kurs nicht zu holen ist. */
  inEuro(waehrung: Fremdwaehrung, datum: string): Promise<number>;
}

/**
 * Frankfurter: kostenlos, ohne API-Key. Yen kommt aus den EZB-Referenzkursen (v1,
 * Wochenenden liefern den letzten Handelstag); TWD führt die EZB nicht, daher v2,
 * das weitere Zentralbanken einbezieht.
 */
export const frankfurter: Kursdienst = {
  async inEuro(waehrung, datum) {
    try {
      let kurs: unknown;
      if (waehrung === "JPY") {
        const res = await fetch(
          `https://api.frankfurter.dev/v1/${datum}?base=JPY&symbols=EUR`,
        );
        if (!res.ok) throw new Error(`Kursdienst antwortet mit ${res.status}`);
        kurs = (await res.json()).rates?.EUR;
      } else {
        const res = await fetch(
          `https://api.frankfurter.dev/v2/rates?base=${waehrung}&quotes=EUR&date=${datum}`,
        );
        if (!res.ok) throw new Error(`Kursdienst antwortet mit ${res.status}`);
        kurs = (await res.json())[0]?.rate;
      }
      if (typeof kurs !== "number" || !(kurs > 0)) {
        throw new Error("Kursdienst lieferte keinen Kurs");
      }
      return kurs;
    } catch (e) {
      log.fehler("kurs.nicht-abrufbar", e, { waehrung, datum });
      throw e;
    }
  },
};
