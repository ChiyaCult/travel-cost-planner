import { assertEquals } from "@std/assert";
import { betragAusPositionen, waehlePositionen } from "./positionen.ts";

Deno.test("Positionen ohne Zwischensumme, Summe und Zahlung", () => {
  const text = `ファミリーマート
コーヒー ¥150
おにぎり ¥130
小計 ¥280
合計 ¥280
お預り ¥1,000
お釣り ¥720`;
  assertEquals(waehlePositionen(text), [
    { bezeichnung: "コーヒー", betragYen: 150 },
    { bezeichnung: "おにぎり", betragYen: 130 },
  ]);
});

Deno.test("Rabatt wird von der Position darüber abgezogen", () => {
  const text = `牛乳 ¥1,200
割引 -¥200
パン ¥300
合計 ¥1,300`;
  assertEquals(waehlePositionen(text), [
    { bezeichnung: "牛乳", betragYen: 1000 },
    { bezeichnung: "パン", betragYen: 300 },
  ]);
});

Deno.test("Mengenzeile ist eine Position mit dem Zeilenbetrag", () => {
  assertEquals(waehlePositionen("おにぎり 2個 × @150 ¥300\n合計 ¥300"), [
    { bezeichnung: "おにぎり 2個", betragYen: 300 },
  ]);
});

Deno.test("Tesseract-Text: Kopfzeilen, Backslash als Yen, 言十 als 合計", () => {
  const text = `毎度ありがとうごさいます。
 2018年 6有21晶(本) 12:21 No:0001
2015009000805
0801書籍 文庫本       \\831
小。 計                  331
内税対象額                \\831
言十                  \\831
還詳雪お預り       \\1.001`;
  assertEquals(waehlePositionen(text), [
    { bezeichnung: "0801書籍 文庫本", betragYen: 831 },
  ]);
});

Deno.test("Steuerzeilen nach der Zwischensumme sind keine Positionen", () => {
  const text = `弁当 ¥540
ビール ¥220
小計 ¥760
8%対象 ¥540 (税込)
10%対象 ¥220 (税込)
内消費税 ¥56
お会計 ¥760`;
  assertEquals(waehlePositionen(text), [
    { bezeichnung: "弁当", betragYen: 540 },
    { bezeichnung: "ビール", betragYen: 220 },
  ]);
});

Deno.test("Betrag: aufgeschlagene Steuer verteilt sich anteilig auf die Auswahl", () => {
  // 小計 1.000 ¥ + 外税 80 ¥ = 1.080 ¥; 600 ¥ davon gehören zur Ausgabe.
  assertEquals(
    betragAusPositionen({
      gewaehltYen: [400, 200],
      allePositionenYen: 1000,
      rechnungssummeYen: 1080,
    }),
    648,
  );
});

Deno.test("Betrag wird auf ganze Yen gerundet", () => {
  assertEquals(
    betragAusPositionen({
      gewaehltYen: [100],
      allePositionenYen: 300,
      rechnungssummeYen: 308,
    }),
    103,
  );
});
