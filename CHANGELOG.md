# Changelog

Alle nennenswerten Änderungen an der App, neueste zuerst.

## 2026-10-24

### Neu

- „Rechnung aufteilen“: Positionen einer Yen-Rechnung aus dem Foto lesen,
  anhaken und nacheinander als eigene Ausgaben auf Mitglieder verteilen; Steuer
  wird anteilig verteilt, die Positionen stehen in der Detailansicht
- Taiwan-Dollar (TWD) als Währung mit Kursumrechnung
- Die Ausgabenliste zeigt, auf wen der Betrag verteilt wurde

### Behoben

- Beim Speichern einer Ausgabe ist der Knopf gesperrt und zeigt „Speichert …“,
  damit sie nicht mehrfach angelegt wird

## 2026-09-20

### Neu

- Ereignisse und Fehler werden protokolliert

### Geändert

- Belegfotos werden vor dem Hochladen im Browser verkleinert
- Das Protokoll enthält keine doppelten Fehlerzeilen mehr

### Behoben

- UI-Feinschliff: keine „null“-Texte mehr, Aufteilung sichtbar, Schulden lesbar

## 2026-09-19

### Neu

- Einladung und Passkey: Registrierung, Login, Wiederherstellung (#3)
- Gruppen anlegen, Mitglieder hinzufügen, Gruppenliste (#4)
- Euro-Ausgabe an alle und Schuldenansicht (#5)
- Auswahl der Mitglieder und paarweiser Saldo (#6)
- Ausgaben ändern und löschen (nur durch den Zahler) (#7)
- Begleichung eintragen, ändern und zurücknehmen (#8)
- Yen-Ausgaben mit fixiertem Tageskurs (#9)
- Beleg: Foto zur Ausgabe speichern, anzeigen und entfernen (#10)
- Summen-Auswahl aus dem OCR-Text (#11)
- Lokale OCR und Summenvorschlag im Ausgabeformular (#12)
- Als App installierbar (PWA) (#13)
- Mitglieder sichtbar hinzufügen, Detailansicht für Ausgaben, eigene Schriften
- Pixel-Reisekasse-Design passend zum neuen Katzen-Symbol (#15)

### Geändert

- Favicon ohne Hintergrund

### Behoben

- Docker: Rechte für `/data` werden beim Start gesetzt, damit SQLite schreiben
  kann

### Sicherheit

- Härtung: Sitzungsablauf, Security-Header, Größen- und Lastgrenzen (#16)
