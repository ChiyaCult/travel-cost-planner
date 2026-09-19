/** Grenze zum externen Kursdienst; Tests setzen einen Fake ein. */
export interface Kursdienst {
  /** Euro pro 1 Yen am Datum (YYYY-MM-DD). Wirft, wenn der Kurs nicht zu holen ist. */
  yenInEuro(datum: string): Promise<number>;
}

/** Frankfurter (EZB-Referenzkurse): kostenlos, ohne API-Key. Wochenenden liefern den letzten Handelstag. */
export const frankfurter: Kursdienst = {
  async yenInEuro(datum) {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/${datum}?base=JPY&symbols=EUR`,
    );
    if (!res.ok) throw new Error(`Kursdienst antwortet mit ${res.status}`);
    const kurs = (await res.json()).rates?.EUR;
    if (typeof kurs !== "number" || !(kurs > 0)) {
      throw new Error("Kursdienst lieferte keinen Kurs");
    }
    return kurs;
  },
};
