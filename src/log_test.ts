import { assertEquals, assertStringIncludes } from "@std/assert";
import { log } from "./log.ts";

/** Fängt eine Protokollzeile ab; das Protokoll ist dabei eingeschaltet. */
function protokolliere(f: () => void): { aus: string[]; fehler: string[] } {
  const vorher = Deno.env.get("LOG");
  Deno.env.set("LOG", "an");
  const aus: string[] = [];
  const fehler: string[] = [];
  const log_ = console.log;
  const error_ = console.error;
  console.log = (z: string) => aus.push(z);
  console.error = (z: string) => fehler.push(z);
  try {
    f();
  } finally {
    console.log = log_;
    console.error = error_;
    if (vorher === undefined) Deno.env.delete("LOG");
    else Deno.env.set("LOG", vorher);
  }
  return { aus, fehler };
}

Deno.test("Ereignis: eine Zeile JSON auf stdout", () => {
  const { aus, fehler } = protokolliere(() =>
    log.ereignis("ausgabe.erfasst", { gruppeId: 3, betragCent: 1250 })
  );
  assertEquals(fehler, []);
  assertEquals(aus.length, 1);
  const { zeit, ...rest } = JSON.parse(aus[0]);
  assertEquals(rest, {
    stufe: "info",
    ereignis: "ausgabe.erfasst",
    gruppeId: 3,
    betragCent: 1250,
  });
  assertEquals(typeof zeit, "string");
});

Deno.test("Fehler: Grund auf stderr, ohne Aufrufliste", () => {
  const { aus, fehler } = protokolliere(() =>
    log.fehler("kurs.nicht-abrufbar", new Error("kaputt"), {
      datum: "2026-01-02",
    })
  );
  assertEquals(aus, []);
  const eintrag = JSON.parse(fehler[0]);
  assertEquals(eintrag.stufe, "fehler");
  assertEquals(eintrag.datum, "2026-01-02");
  assertEquals(eintrag.grund, "Error: kaputt");
  assertEquals(eintrag.stack, undefined);
});

Deno.test("Ausnahme: zusätzlich mit Aufrufliste", () => {
  const { fehler } = protokolliere(() =>
    log.ausnahme("anfrage.fehlgeschlagen", new Error("kaputt"), { pfad: "/x" })
  );
  const eintrag = JSON.parse(fehler[0]);
  assertEquals(eintrag.pfad, "/x");
  assertEquals(eintrag.grund, "Error: kaputt");
  assertStringIncludes(eintrag.stack, "Error: kaputt");
});

Deno.test("Geworfene Nicht-Fehler bekommen auch einen Grund", () => {
  const { fehler } = protokolliere(() => log.fehler("test", "nur ein Text"));
  assertEquals(JSON.parse(fehler[0]).grund, "nur ein Text");
});

Deno.test("LOG=aus schweigt", () => {
  const vorher = Deno.env.get("LOG");
  Deno.env.set("LOG", "aus");
  const zeilen: string[] = [];
  const log_ = console.log;
  console.log = (z: string) => zeilen.push(z);
  try {
    log.ereignis("start");
  } finally {
    console.log = log_;
    if (vorher === undefined) Deno.env.delete("LOG");
    else Deno.env.set("LOG", vorher);
  }
  assertEquals(zeilen, []);
});
