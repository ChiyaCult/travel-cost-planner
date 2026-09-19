# Ausgaben teilen (selbst gehostet)

Eine einfache, selbst gehostete Alternative zu Splitwise für einen bekannten
Freundeskreis.

## Language

**Nutzer**: Eine Person mit eigenem Zugang zur App. Kommt nur per Einladung
hinein. _Avoid_: Account, User

**Admin**: Der Betreiber der App. Nur der Admin lädt neue Nutzer in die App ein.
Bestehende Nutzer legen Gruppen selbst an und fügen dort andere bestehende
Nutzer als Mitglieder hinzu.

**Gruppe**: Ein abgegrenzter Kreis von Nutzern, in dem Ausgaben geteilt werden,
z. B. eine Reise. Ein Nutzer kann in mehreren Gruppen sein. _Avoid_: Reise,
Projekt

**Mitglied**: Ein Nutzer innerhalb einer bestimmten Gruppe.

**Ausgabe**: Ein Betrag, den ein Mitglied für andere bezahlt hat, in Yen oder
Euro erfasst. Wird auf betroffene Mitglieder aufgeteilt.

**Beleg**: Das Foto der Rechnung, das mit einer Ausgabe gespeichert wird und für
alle Mitglieder der Gruppe sichtbar ist.

**Zahler**: Das Mitglied, das eine Ausgabe bezahlt hat. Immer der Nutzer, der
sie einträgt; niemand trägt Ausgaben für andere ein. Nur der Zahler kann seine
Ausgabe ändern oder löschen.

**Aufteilung**: Die gleichmäßige Verteilung einer Ausgabe auf eine frei wählbare
Auswahl von Mitgliedern (Standard: alle). Der Zahler zählt mit, wenn er in der
Auswahl steht, schuldet aber nie sich selbst etwas. Ist der Zahler nicht in der
Auswahl, schulden die Ausgewählten ihm den vollen Betrag.

**Wechselkurs**: Der Yen-in-Euro-Kurs, der beim Erfassen einer Yen-Ausgabe mit
dieser gespeichert wird und danach unverändert bleibt. Kann manuell
überschrieben werden.

**Schuld**: Der Euro-Betrag, den ein Mitglied einem anderen Mitglied innerhalb
einer Gruppe schuldet. Zwischen zwei Mitgliedern gibt es immer nur eine Schuld:
Ausgaben in beide Richtungen werden zum Saldo verrechnet, sodass höchstens einer
dem anderen etwas schuldet. Schulden werden nie gruppenübergreifend und nie über
Dritte hinweg verrechnet.

**Begleichung**: Die Angabe eines Schuldners, dass er einen Betrag (ganz oder
teilweise) an ein anderes Mitglied außerhalb der App bezahlt hat. Mindert die
Schuld sofort und ohne Bestätigung des Empfängers. Nur das Mitglied, das sie
eingetragen hat, kann sie nachträglich ändern oder zurücknehmen; niemand sonst,
auch nicht der Empfänger.

## Relationships

- Eine **Gruppe** hat mehrere **Mitglieder**; ein **Nutzer** kann **Mitglied**
  in mehreren **Gruppen** sein.
