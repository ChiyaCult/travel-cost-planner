# Spätere Features (bewusst nicht im ersten Wurf)

- **Live-Umrechnung:** Ausgaben bleiben in Yen, die Euro-Schuld wird bei jedem Aufruf mit dem aktuellen Kurs neu berechnet. Verworfen für v1, weil sich Schulden dann täglich ändern und nicht nachvollziehbar sind. Aktuell gilt: Kurs wird beim Erfassen fixiert.
- **Rechnungspositionen:** Alle Positionen einer Rechnung auslesen, ins Deutsche übersetzen und einzeln auf Mitglieder verteilen (v1 liest nur die Summe).
- **Ungleiche Anteile:** Pro Mitglied einen eigenen Betrag angeben (z. B. „Anna 30 €, Tom 20 €"). Wird ohnehin für die Verteilung einzelner Rechnungspositionen gebraucht. In v1 gibt es nur gleichmäßige Aufteilung.
- **Platzhalter-Mitglieder:** Ein Mitglied ohne Zugang (z. B. jemand, der die App nicht nutzen will), für das andere Nutzer Ausgaben und Begleichungen eintragen. Kann später mit einem echten Konto verknüpft werden. Für v1 verworfen: Jedes Mitglied muss ein Nutzer mit Passkey sein.
- **Gruppe verlassen und abschließen:** Ein Mitglied kann eine Gruppe nur verlassen, wenn sein Saldo zu allen anderen 0 ist. Jedes Mitglied kann eine Gruppe als abgeschlossen markieren (keine neuen Ausgaben, Begleichungen weiter möglich) und wieder öffnen. In v1 bleiben Gruppen einfach bestehen.
- **Gruppenübergreifende Übersicht:** Reine Aufsummierung „Gesamt mit Person X" über alle Gruppen, ohne Verrechnung.
