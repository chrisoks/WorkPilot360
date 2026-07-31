# JARVIS Kalkulationsrechner-Inventar

Stand: 31.07.2026

## Produktiv freigegebene Fachrechner

| Rechner | Zentrale Fachlogik | Normale Speicherung | JARVIS-Vertrag |
| --- | --- | --- | --- |
| Winterdienst | `src/lib/winter-service/calculation.ts` | unveränderliche `WinterServiceCalculation`-Version; Rechnen ohne Projekt, Speichern nur mit aktuellem Kundenprojekt | interne aktive Rollen rechnen; `canManageProjects` für Sitzungs- und effektive Rolle zum Speichern; Sitzung, Organisation, Impersonation, Revision, HMAC, TTL, Projektstand, Audit und Exactly-once werden geprüft |
| Fahrt/Fahrzeugkosten | `src/lib/vehicle-calculation.ts` sowie zentrale Kraftstoffpreisquelle | unveränderlicher `VehicleCalculation`-Snapshot | interne aktive Rollen rechnen; Fahrzeugwerte werden serverseitig aktuell geladen; `canManageProjects` für Sitzungs- und effektive Rolle zum Speichern; kein Personalkostenanteil; Fahrzeugstand, Preisquelle, Audit und Exactly-once werden geprüft |

JARVIS erkennt beide Rechner aus freier Sprache, übernimmt ausschließlich
ausdrücklich genannte Werte und weist die noch fehlenden Pflichtangaben aus.
Auch fachlich zulässige Nullwerte gelten nur dann als Eingabe, wenn der
Benutzer sie ausdrücklich angegeben oder die vollständige Maske bewusst zur
Berechnung abgesendet hat. Ein allgemeiner Kalkulationswunsch führt zuerst zur
Auswahl des Rechners.

## Verwandte Bereiche, aber keine weiteren freigegebenen JARVIS-Rechner

- `Fahrzeuge` ist der Stammdatenbereich des Fahrtenrechners, keine zweite
  Fahrzeugformel. Änderungen sind keine Nebenwirkung einer Kalkulation.
- `Vermietung` ist in WorkPilot selbst ein vorbereiteter Ausbauplatz. JARVIS
  bleibt dort fail-closed und erfindet weder Mietpreis noch Verfügbarkeit,
  Vertrag oder Rückgabeprozess.
- Die Kalkulationsreiter in `Artikel & Leistungen` bearbeiten Artikel-,
  Leistungs- und Paketstammdaten. Das ist derzeit kein unveränderlicher
  Fachrechner-Snapshot und `catalog.manage` bleibt für JARVIS geplant.
- Die Lohnkostenmaske unter `Mitarbeiter` speichert besonders geschützte
  Mitarbeiterkostengrundlagen. Zugriff haben nur Admin und Geschäftsführung;
  `payroll.manage` bleibt eine gesonderte kritische, noch nicht freigegebene
  JARVIS-Aktion. Werte werden nicht in den allgemeinen Rechnerdialog geladen.
- Angebotsmargen, Preisleitplanken und Managementanalysen sind vorhandene
  Fachauswertungen, aber keine zusätzlichen Rechner im Bereich
  `Kalkulations-Rechner`.

## Verbindliche Sicherheits- und Rechenregeln

1. Keine KI-Ersatzformel und keine stillschweigende Schätzung.
2. Natürliche Sprache füllt nur eindeutig erkannte Angaben; Mehrdeutiges bleibt
   offen.
3. Die Vorschau rechnet ausschließlich mit zentraler Fachlogik und aktuellen,
   organisationsgebundenen Stammdaten.
4. Rechenweg, Annahmen, Preisquelle, Selbstkosten, Verkauf, Gewinn, Aufschlag,
   Marge und fachliche Einschränkungen bleiben sichtbar.
5. Speichern erfolgt ausschließlich nach bewusster Bestätigung, erneuter
   Serverberechnung und erneuter Rollen- und Kontextprüfung.
6. Bestehende Kalkulationen und Stammdaten werden nicht überschrieben.
7. Mandantenwechsel, Sitzungswechsel, Rollenwechsel, Impersonation,
   Payload-Manipulation, veralteter Fachstand, Doppelklick und Replay sind
   fail-closed beziehungsweise exactly-once.
