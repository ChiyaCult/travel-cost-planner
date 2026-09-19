import { assertEquals } from "@std/assert";
import { waehleSumme } from "./summe.ts";

Deno.test("Barzahlung: Rechnungsbetrag statt お預り", () => {
  const text = `ファミリーマート
コーヒー ¥150
おにぎり ¥130
小計 ¥280
合計 ¥280
お預り ¥1,000
お釣り ¥720`;
  assertEquals(waehleSumme(text), 280);
});

Deno.test("Steuerzeilen 8 % und 10 % führen nicht in die Irre", () => {
  const text = `弁当 ¥540
ビール ¥220
小計 ¥760
8%対象 ¥540 (税込)
10%対象 ¥220 (税込)
内消費税 ¥56
お会計 ¥760
現金 ¥1,000
お釣り ¥240`;
  assertEquals(waehleSumme(text), 760);
});

Deno.test("Rabatt: die Summe nach dem Rabatt zählt", () => {
  const text = `牛乳 ¥1,200
割引 -¥200
合計 3点 ¥1,000
税込 ¥1,080
お預り ¥5,000`;
  assertEquals(waehleSumme(text), 1000);
});

Deno.test("Bezeichnung und Betrag in getrennten Zeilen, Vollbreite-Ziffern", () => {
  assertEquals(
    waehleSumme("税込合計\n￥１，２３４\nお預り\n￥２，０００"),
    1234,
  );
});

Deno.test("Rückfall auf den größten Betrag ohne Schlüsselwörter", () => {
  assertEquals(
    waehleSumme("パン ¥200\n茶 ¥1,300\nお預り ¥5,000\nTEL 03-1234-5678"),
    1300,
  );
});

Deno.test("nichts Eindeutiges: null", () => {
  assertEquals(waehleSumme(""), null);
  assertEquals(waehleSumme("ありがとうございました"), null);
});
