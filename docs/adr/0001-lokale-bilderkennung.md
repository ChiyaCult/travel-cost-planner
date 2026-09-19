# Rechnungsfotos werden ausschließlich lokal ausgelesen

Die Erkennung der Rechnungssumme (später auch der Positionen) läuft auf dem
eigenen Server, es geht kein Foto an einen Cloud-Dienst. Grund: Die App soll
wirklich selbst gehostet sein, ohne API-Key, laufende Kosten oder Abfluss von
Daten. Cloud-KI wäre bei japanischen Bons zuverlässiger gewesen, das nehmen wir
bewusst in Kauf; deshalb ist die erkannte Summe nur ein Vorschlag, den der
Nutzer vor dem Speichern prüft und korrigiert.

## Consequences

- Die Summe wird über Schlüsselwörter (z. B. 合計, 税込) gesucht, nicht als
  größter Betrag, weil お預り (gegeben) bei Barzahlung höher sein kann.
- Für das spätere Übersetzen der Positionen ins Deutsche wird ebenfalls eine
  lokale Lösung gebraucht.
- Die Erkennung braucht ausreichend Serverleistung (kleiner VPS oder Mini-PC,
  kein schwacher Raspberry Pi).
