# WorkPilot360 Audit-Protokoll

Stand: 2026-06-18

## Ziel

Vollumfaengliches Audit von WorkPilot360 auf Funktionen, Verknuepfungen, Fachlogik, Datenkonsistenz, Rollen/Rechte, Meldungen, Design und UX.

Dieses Dokument sammelt Befunde und Pruefschritte. Reparaturen werden erst nach Priorisierung umgesetzt.

## Schweregrade

- Kritisch: Datenverlust, falsche Geldwerte, falsche Rechte, produktiver Crash.
- Hoch: falsche Fachlogik, fehlerhafte Verknuepfung, falsche Auswertung, fehlende Storno-/Archivlogik.
- Mittel: Bedienfehler wahrscheinlich, unklare Datenherkunft, Sonderfall nicht sauber behandelt.
- Niedrig: Text, Optik, kleine UX-Verbesserung.

## Audit-Bereiche

### 1. Artikel / Leistungen / Pakete

Pruefen:
- Artikel, Leistung, Paket anlegen/bearbeiten/deaktivieren.
- Paketbestandteile: Preisuebernahme, Mengen, aktive/inaktive Bestandteile.
- Auswirkungen auf Angebote, Rechnungen, Planung, Sollzeiten, Kosten.
- Historie: was wird protokolliert?
- Preis-/Kosten-Snapshots: bestehende Belege duerfen sich nach Stammdatenänderung nicht still veraendern.

Erste Beobachtungen:
- Paketbestandteile werden bei jeder Paketbearbeitung voll geloescht und neu geschrieben.
- Katalogdaten werden per API zur Laufzeit mit Tabellen-/Spaltensicherung gepflegt.

### 2. Kundenakte

Pruefen:
- Kontaktanlage, Bearbeitung, Loeschung.
- Verknuepfte Projekte, Angebote, Rechnungen, Dokumente, Ansprechpartner, Hinweise.
- Zähler in Navigation.
- E-Rechnung-Felder: Leitweg-ID, Empfaengerart, Pflichtstatus.
- Verhalten beim Loeschen eines Kunden mit verknuepften Projekten.

Erste Beobachtung:
- Kontaktloeschung loescht den Kontakt hart aus der Tabelle. Verknuepfte Projekte/Dokumente muessen separat gegen verwaiste Referenzen geprueft werden.

### 3. Projektakte

Pruefen:
- Projektanlage und Statuslogik.
- Monatsschiene, Prozessleiste, Angebote/Rechnungen/Forecast.
- Bilder/PWA, Logbuch, Dokumente, Hinweise, Marketing-Kontingente.
- Zeitkontingente, Vorgabezeiten, Gewinn/DB, automatische Abrechnung.
- Verknuepfung zu Kunde, Ansprechpartner, Adresse, Rechnung, Stempelung.

Erste Beobachtungen:
- Projektmodell hat viele JSON-/Textfelder fuer Budgets, Auto-Abrechnung, Vorlagen.
- Projekt-API pflegt Schema ebenfalls zur Laufzeit.

### 4. Auswertungen

Pruefen:
- Forecast & OP, Umsatzdetails, Monatsbericht, Sales, SVS, Projekte, Kunden, KuZu, Artikel, Mitarbeitende, Übersicht, Karte.
- Storno, Entwurf, geloescht, bezahlt, Altrechnungen.
- Rollen: Buchhaltung darf nur freigegebene Auswertungen sehen.
- Monats-/Jahres-/Geschaeftsjahrfilter.
- Verknuepfung zu Rechnungen, Angeboten, Projekten, Stempelungen, Kosten.

Erste Beobachtungen:
- Gemeinsame Logik fuer finanziell aktive Rechnungen wurde begonnen.
- Monatsbericht nutzt Rechnungen automatisch und manuelle Werte mit Gueltig-ab-Monat.
- Alle Auswertungen muessen gegen dieselbe Rechnungsklassifikation geprueft werden.

### 5. Mitarbeiterverwaltung

Pruefen:
- Rollen/Rechte, Aktiv/Inaktiv, Team-/Gewerkzuordnung.
- Lohnkosten, Stundensätze, Planungskapazitaet.
- Mitarbeiterakte, Entwicklung, Zielsystem, Signatur, Mailkonto.
- Inaktive Mitarbeitende in Planung, Auswertungen, Stempelung.

### 6. Buchhaltung

Pruefen:
- Angebote, Rechnungen, Storno, Mahnung, PDF, E-Mail-Versand.
- XRechnung/KoSIT-Konfiguration, Validierung, Anhanglogik.
- Rechnungshistorie und Dokumentenarchiv.
- Zahlungsstatus und offene Posten.
- Automatische Abrechnung und Stapelabrechnung.

Erste Beobachtung:
- Storno erstellt eigene Stornorechnung und setzt Ursprungsrechnung auf `Storniert`.
- Zusaetzlich werden Zeitbuchungen von der stornierten Rechnung entkoppelt.

### 7. Meldungen / Notifications

Pruefen:
- Empfaengerlogik, Erinnerungen, Eskalationen.
- Lesestatus, Historie, Verlinkung.
- Rechte: Benutzer duerfen keine fremden Meldungen lesen/als gelesen markieren.
- Duplikatvermeidung und Eskalationsrhythmus.

Erstes Finding:
- `GET /api/notifications` nimmt `userId` aus Query und waehlt damit den aktiven Benutzer. Das muss als Rechte-/Sicherheitsrisiko geprueft werden.

### 8. Design / UX

Pruefen:
- Navigation, aktive Reiter, Unterreiter, Zähler.
- Modale vs. Inline-Formulare.
- Leere Zustaende, Fehlermeldungen, Erfolgsmeldungen.
- Mobile/PWA, Bildlogik, Lade-/Refreshverhalten.
- Riskante Aktionen: Loeschen, Storno, Archivieren, Statuswechsel.

## Querschnittsrisiken

### A. Laufzeit-Schemaaenderungen in APIs

Viele Routen fuehren `CREATE TABLE IF NOT EXISTS` oder `ALTER TABLE` beim API-Aufruf aus.

Risiko:
- Prisma-Schema, lokale DB und produktive DB koennen auseinanderlaufen.
- `prisma db push` kann dadurch unerwartete Loeschwarnungen erzeugen.
- Serverrechte/Deployments koennen fehlschlagen, wenn Runtime-DDL nicht erlaubt ist.

Bewertung: Hoch

### B. UI-Rechte vs. API-Rechte

Viele Rechte werden im Dashboard-UI entschieden. Das Audit muss pruefen, ob die APIs dieselben Regeln serverseitig durchsetzen.

Risiko:
- Benutzer koennen Aktionen per API ausfuehren, obwohl die UI sie versteckt.

Bewertung: Kritisch bis Hoch

### C. Harte Loeschungen vs. Verknuepfungen

Einige Bereiche loeschen hart, andere deaktivieren/archivieren.

Risiko:
- Verwaiste Projekt-/Beleg-/Dokumentreferenzen.
- Auswertungen oder Akten zeigen fehlende Namen oder falsche Zaehler.

Bewertung: Hoch

## Pruefmatrix

| Bereich | Daten schreiben | Verknuepfungen | Rechte | Auswertung | UX | Prioritaet |
|---|---:|---:|---:|---:|---:|---:|
| Buchhaltung | Ja | Sehr hoch | Sehr hoch | Sehr hoch | Mittel | 1 |
| Auswertungen | Nein/teilweise | Sehr hoch | Hoch | Sehr hoch | Mittel | 1 |
| Artikel/Leistungen/Pakete | Ja | Hoch | Mittel | Hoch | Mittel | 1 |
| Kundenakte | Ja | Sehr hoch | Hoch | Mittel | Hoch | 2 |
| Projektakte | Ja | Sehr hoch | Hoch | Sehr hoch | Hoch | 2 |
| Mitarbeiterverwaltung | Ja | Hoch | Sehr hoch | Hoch | Mittel | 2 |
| Meldungen/Notifications | Ja | Mittel | Sehr hoch | Niedrig | Hoch | 3 |
| Design/UX | Nein | Mittel | Mittel | Niedrig | Sehr hoch | 3 |

## Naechste Audit-Schritte

1. Buchhaltung/Auswertungen: Rechnungsklassifikation, Storno, Entwurf, bezahlt, geloescht.
2. Artikel/Leistungen/Pakete: Snapshot-Logik und Paketbestandteile.
3. Kundenakte/Projektakte: harte Loeschungen, verwaiste Referenzen, Zaehler, Dokumente.
4. API-Rechte: alle kritischen POST/PATCH/DELETE-Routen gegen Rollenregeln pruefen.
5. Notifications: fremde Meldungen, Lesestatus, Eskalationen.
6. Design/UX: Navigationskonsistenz, Modalstandard, mobile/PWA.

## Erste Findings

### F-001: Notifications koennen potenziell fuer fremde User geladen/markiert werden

Bereich: Meldungen / Notifications, Rechte

Dateien:
- `src/app/api/notifications/route.ts`

Beobachtung:
- `GET` liest `userId` aus der Query und nimmt dann den passenden Benutzer aus der Userliste.
- `PATCH` nutzt ebenfalls `body.userId`, um offene Meldungen als gelesen zu markieren.

Risiko:
- Wenn ein Benutzer eine fremde User-ID kennt oder erraten kann, koennte er fremde Meldungen lesen oder als gelesen markieren.

Schweregrad: Hoch bis Kritisch

Pruefung:
- Server muss echte Session/Authentifizierung oder mindestens Actor-vs-Target-Regel erzwingen.
- UI-Only-Rechte reichen hier nicht.

Status: Offen

### F-002: Kontaktloeschung ist hart und kann Verknuepfungen verwaisen lassen

Bereich: Kundenakte, Projektakte, Dokumente

Dateien:
- `src/app/api/contacts/route.ts`

Beobachtung:
- `DELETE` entfernt Kontakte direkt aus `Contact`.
- Projekte, Rechnungen, Dokumente, Ansprechpartner-/Adressreferenzen werden nicht sichtbar vorab geprueft oder umgehangen.

Risiko:
- Kundenakte/Projektakte koennen Referenzen auf nicht mehr vorhandene Kontakte enthalten.
- Zaehler, Filter und Aktenansichten koennen inkonsistent werden.

Schweregrad: Hoch

Pruefung:
- Loeschen sollte entweder blockieren, wenn Verknuepfungen existieren, oder als Archivierung/Deaktivierung umgesetzt werden.
- Vor dem Loeschen braucht es eine Verknuepfungsanzeige.

Status: Offen

### F-003: Paketbestandteile werden bei jeder Paketbearbeitung geloescht und neu geschrieben

Bereich: Artikel / Leistungen / Pakete

Dateien:
- `src/app/api/catalog-items/route.ts`

Beobachtung:
- `replacePackageItems` loescht alle Bestandteile eines Pakets und legt sie neu an.

Risiko:
- Historie einzelner Paketbestandteile ist nur grob nachvollziehbar.
- Bei Fehler waehrend des Neuschreibens koennen Paketbestandteile teilweise fehlen, falls keine Transaktion genutzt wird.

Schweregrad: Mittel bis Hoch

Pruefung:
- Transaktion pruefen.
- Historie auf Komponentenebene pruefen.
- Wirkung auf bestehende Angebote/Rechnungen gegen Snapshot-Logik pruefen.

Status: Offen

Zwischenstand 2026-06-18:
- Die Bestandteile werden ohne sichtbare Transaktion zuerst geloescht und danach einzeln neu eingefuegt.
- Die Historie bekommt nur einen groben Eintrag `package_items_updated`, aber keine echte Vorher-/Nachher-Liste der Komponenten.
- Komponentenpreise werden beim Laden des Pakets aus aktuellen Katalogdaten mitgelesen; Preis-Overrides werden separat gespeichert.

### F-008: Angebotspositionen werden bei Bearbeitung geloescht und neu geschrieben

Bereich: Artikel / Leistungen / Pakete, Angebote

Dateien:
- `src/app/api/offers/route.ts`

Beobachtung:
- Beim Bearbeiten eines Angebots werden alle `OfferLine`-Positionen geloescht und anschliessend neu eingefuegt.
- Das gleiche gilt fuer zugehoerige Arbeits-/Planungspositionen ueber `OfferLineLabor`.
- Verkaufspreis, Titel, Beschreibung und Mengen werden zwar in der Angebotsposition gespeichert, aber eine positionsgenaue Aenderungshistorie gibt es dadurch nicht.

Risiko:
- Nachtraegliche Pruefung, welche einzelne Angebotsposition wann geaendert wurde, ist kaum moeglich.
- Bei Fehlern zwischen Loeschen und Neuschreiben koennen Positionen verloren gehen, falls der Ablauf nicht in einer Datenbank-Transaktion abgesichert ist.
- Verknuepfte Planungsdaten koennen schwer nachvollziehbar werden, wenn Position-IDs bei jeder Bearbeitung wechseln.

Schweregrad: Mittel bis Hoch

Pruefung:
- Transaktion fuer Angebotskopf + Positionen + Arbeitspositionen sicherstellen.
- Pruefen, ob externe Verknuepfungen auf `OfferLine.id` existieren und durch neue IDs gebrochen werden.
- Fuer wichtige Belege optional Positionshistorie oder Versionsstand einfuehren.

Status: Offen

### F-009: Katalog-API hat keine sichtbare serverseitige Rollenpruefung

Bereich: Artikel / Leistungen / Pakete, Rechte

Dateien:
- `src/app/api/catalog-items/route.ts`

Beobachtung:
- `POST`, `PATCH` und `DELETE` schreiben Katalogdaten.
- Actor-Name und Actor-ID werden fuer Historie uebernommen, aber im geprueften Code nicht als Berechtigungspruefung genutzt.

Risiko:
- Wenn ein Benutzer die API direkt anspricht, koennte er Artikel, Leistungen oder Pakete anlegen, aendern oder deaktivieren, obwohl die UI das ggf. nicht erlauben wuerde.
- Falsche Stammdaten wirken auf neue Angebote/Rechnungen und koennen Kalkulationen verfaelschen.

Schweregrad: Hoch

Pruefung:
- Rollenregel serverseitig erzwingen, z. B. nur Admin/Geschaeftsfuehrung/Berechtigte fuer Katalogpflege.
- Audit-Log nur als Protokoll nutzen, nicht als Rechteersatz.

Status: Offen

### F-010: Benutzer-API faellt bei fehlender/ungueltiger Actor-ID auf Demo-Admin zurueck

Bereich: Mitarbeiterverwaltung / Rechte / API

Dateien:
- `src/app/api/users/route.ts`
- `src/lib/demo/context.ts`

Beobachtung:
- `getDemoContext()` liefert als `user` standardmaessig einen Admin-Benutzer.
- In der Benutzer-API wird der Actor an mehreren Stellen so bestimmt: Actor aus `body.actorId`, sonst Fallback auf `user`.
- Wenn `actorId` fehlt oder ungueltig ist, kann dadurch der Admin-Fallback greifen.

Risiko:
- Kritische Mitarbeiteraktionen koennen serverseitig als Admin bewertet werden, obwohl kein echter angemeldeter Admin nachgewiesen wurde.
- Das betrifft Benutzeranlage, Rollen-/Profilpflege und Deaktivierung besonders stark.

Schweregrad: Kritisch

Pruefung:
- Kein Fallback auf Demo-Admin fuer produktive Schreibaktionen.
- Actor muss aus echter Session/Authentifizierung kommen.
- Wenn noch Demo-Modus gebraucht wird, muss er klar getrennt und produktiv deaktivierbar sein.

Status: Offen

### F-011: Mitarbeiterbeurteilungen haben Rollenlogik, aber Actor-ID ist weiterhin request-basiert

Bereich: Mitarbeiterverwaltung / Beurteilungen / Rechte

Dateien:
- `src/app/api/employee-assessments/route.ts`

Beobachtung:
- Die Route prueft fachlich sauberer als andere APIs:
  - Mitarbeiter duerfen eigene Selbsteinschaetzung/DISG bearbeiten.
  - Admin/Geschaeftsfuehrung duerfen Managerbereiche bearbeiten.
- Die Identitaet kommt aber weiterhin ueber `actorId` aus Query/Body.

Risiko:
- Ohne echte Session kann eine fremde Actor-ID missbraucht werden.
- Fachliche Rollenlogik ist vorhanden, aber die Identitaetsquelle ist zu schwach.

Schweregrad: Hoch

Pruefung:
- Actor aus Session ableiten.
- `actorId` aus Request hoechstens fuer Audit-Anzeige verwenden, nicht fuer Berechtigung.

Status: Offen

### F-012: Lohnkosten-Zugriff ist serverseitig geschuetzt, aber ueber feste Namen

Bereich: Mitarbeiterverwaltung / Lohnkosten / Rechte

Dateien:
- `src/app/api/employee-costs/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Zugriff auf Lohnkosten ist serverseitig auf `Ramona Eid` und `Christian Eid` begrenzt.
- Die UI nutzt dieselbe Namenslogik.
- Rollen wie `GESCHAEFTSFUEHRER` oder ein explizites Recht werden nicht verwendet.

Risiko:
- Namensaenderung, Schreibweise oder neuer berechtigter Benutzer brechen den Zugriff.
- Rechte sind schwer administrierbar und nicht transparent.

Schweregrad: Mittel bis Hoch

Pruefung:
- In echte Berechtigung ueberfuehren, z. B. Rolle plus explizites Feature-Recht `canViewEmployeeCosts`.
- Zugriff weiterhin serverseitig erzwingen.

Status: Offen

### F-013: Kontakt-API schreibt und loescht ohne sichtbare serverseitige Rollenpruefung

Bereich: Kundenakte / Rechte / API

Dateien:
- `src/app/api/contacts/route.ts`

Beobachtung:
- `POST`, `PATCH` und `DELETE` fuer Kontakte pruefen im geprueften Code keine Rolle und keinen Actor.
- `DELETE` entfernt Kontakte hart aus der Tabelle.

Risiko:
- Kontakte koennen per API angelegt, geaendert oder geloescht werden, auch wenn die UI das fuer einen Nutzer nicht erlauben wuerde.
- Durch hartes Loeschen koennen Projekte, Angebote, Rechnungen, Hinweise, Dokumente und Ansprechpartner-Bezuege verwaisen.

Schweregrad: Kritisch

Pruefung:
- Serverrolle fuer Kontaktanlage/-bearbeitung/-loeschung erzwingen.
- Kontaktloeschung nur archivieren/deaktivieren oder vorab alle Verknuepfungen pruefen und Loeschung blockieren.

Status: Offen

### F-014: Projekt-API nutzt Upsert fuer Anlage und Bearbeitung ohne sichtbare Rollenpruefung

Bereich: Projektakte / Rechte / Datenkonsistenz

Dateien:
- `src/app/api/hero/projects/route.ts`

Beobachtung:
- `POST` legt Projekte an oder aktualisiert sie per `ON CONFLICT`.
- `PATCH` ruft direkt `POST` auf.
- Rollen-/Actor-Pruefung ist im geprueften Code nicht sichtbar.
- `contactId`, `contactPersonId` und `addressContactId` werden gespeichert, aber nicht sichtbar gegen vorhandene Kontakte validiert.

Risiko:
- Projekte koennen per API von unberechtigten Nutzern angelegt/geaendert werden.
- Falsche oder geloeschte Kontakt-IDs koennen Kunden-/Projektakte, Dokumente und Auswertungen inkonsistent machen.
- Upsert macht Anlage und Bearbeitung fachlich schwerer unterscheidbar.

Schweregrad: Kritisch

Pruefung:
- Rollen fuer Projektanlage und Projektbearbeitung serverseitig erzwingen.
- Kontakt-/Ansprechpartner-/Adressreferenzen gegen `Contact` validieren.
- Anlage und Bearbeitung fachlich trennen oder im Audit-Log eindeutig protokollieren.

Status: Offen

### F-015: Projekt-Logbuch/Bilder/Dokumente koennen per API ohne Rollenpruefung geschrieben und veraendert werden

Bereich: Projektakte / Bilder / Dokumente / PWA / Rechte

Dateien:
- `src/app/api/project-logbook-entries/route.ts`

Beobachtung:
- `POST` legt Logbucheintraege inklusive Anhaengen an.
- `PATCH` kann Anhaenge loeschen oder Bilder zwischen Kategorien verschieben.
- Im geprueften Code ist keine Rollen-/Actor-Pruefung sichtbar.
- Anhaenge werden als Data-URL in JSON gespeichert.

Risiko:
- Bilder und Dokumente koennen per API unberechtigt hinzugefuegt, verschoben oder geloescht werden.
- Data-URLs in der Datenbank koennen bei vielen Bildern grosse Datensaetze und Ladezeiten verursachen.
- Kein echtes Dateispeicher-/Berechtigungskonzept fuer einzelne Anhaenge sichtbar.

Schweregrad: Hoch bis Kritisch

Pruefung:
- Serverseitige Rechte fuer Upload, Verschieben und Loeschen.
- Langfristig Dateispeicher/Objektspeicher statt grosse Base64-Data-URLs in JSON pruefen.
- Bestehende 15-Sekunden-Synchronisation ist funktional, sollte aber bei grossen Bildmengen weiter auf Last getestet werden.

Status: Offen

### F-016: CRM-Hinweise sind fachlich angebunden, aber API-Rechte und Bestaetigungsidentitaet sind schwach

Bereich: Kundenakte / Projektakte / Hinweise / Stempelung / Projektanlage

Dateien:
- `src/app/api/customer-project-notes/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Hinweise koennen fuer Kunde und Projekt angelegt werden.
- Pflichtbestaetigung vor Stempelung ist angebunden und blockiert den Start bis zur Bestaetigung.
- Pflichtbestaetigung bei Projektanlage wird nach dem Speichern des Projekts angezeigt und zurueckgeschrieben.
- `POST`/`PATCH` der Hinweis-API haben im geprueften Code keine sichtbare Rollenpruefung.
- Bestaetigungen speichern `userId` und `userName` aus dem Request.

Risiko:
- Hinweise koennen per API unberechtigt angelegt, geaendert, archiviert oder bestaetigt werden.
- Bestaetigungsnachweise sind angreifbar, wenn User-ID/Name aus dem Request statt aus einer echten Session kommen.
- Projektanlage wird nicht vor dem Speichern blockiert; die Bestaetigung ist aktuell eine Nachlauf-Bestaetigung.

Schweregrad: Hoch

Pruefung:
- Hinweisanlage/-archivierung auf berechtigte Rollen begrenzen.
- Bestaetigungen aus echter Session schreiben.
- Fachlich entscheiden, ob Projektanlage vor dem Speichern blockiert werden muss oder ob Nachlauf-Bestaetigung reicht.

Status: Offen

### F-017: Hinweis-Zaehlungen fehlen in Kunden- und Projektakten-Navigation

Bereich: Kundenakte / Projektakte / UX

Dateien:
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Kundenakte und Projektakte haben den Reiter `Hinweise`.
- Fuer Bilder, Dokumente, Ansprechpartner, Zusatzverkaeufe, Aufgaben und Projekte gibt es Zaehler.
- Fuer Hinweise ist im geprueften Navigationscode kein eigener Zaehler sichtbar.

Risiko:
- Nutzer sehen nicht sofort, dass wichtige CRM-Hinweise vorhanden sind.
- Pflicht-/kritische Hinweise koennen uebersehen werden, wenn der Reiter nicht aktiv geoeffnet wird.

Schweregrad: Mittel

Pruefung:
- Aktive Hinweise zaehlen.
- Optional kritische/Pflicht-Hinweise separat hervorheben.

Status: Offen

### F-018: Notification-Lesen und Lesestatus sind ueber frei uebergebene User-ID steuerbar

Bereich: Meldungen / Notifications / Rechte

Dateien:
- `src/app/api/notifications/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- `GET /api/notifications?userId=...` laedt Meldungen fuer die uebergebene User-ID.
- `PATCH /api/notifications` markiert alle offenen Meldungen der uebergebenen `body.userId` als gelesen.
- Wenn die User-ID fehlt oder nicht gefunden wird, greift der Demo-User-Fallback.

Risiko:
- Ein Nutzer koennte fremde Meldungen lesen oder als gelesen markieren, wenn er eine fremde User-ID kennt.
- Meldungen koennen handlungsrelevante Informationen enthalten: Abrechnung, Aufgaben, Abwesenheiten, Zusatzverkauf, Eskalationen.

Schweregrad: Kritisch

Pruefung:
- Aktiven Nutzer aus echter Session bestimmen.
- `userId` aus Query/Body nicht fuer Berechtigung verwenden.
- `PATCH` optional auf einzelne Notification-IDs beschraenken statt pauschal alle offenen Meldungen zu markieren.

Status: Offen

### F-019: Notification-Erzeugung ist uneinheitlich dedupliziert

Bereich: Meldungen / Notifications / Eskalationen

Dateien:
- `src/app/api/notifications/route.ts`
- `src/app/api/tasks/route.ts`
- `src/app/api/absences/route.ts`
- `src/app/api/unbilled-time-alerts/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Der zentrale Notification-Endpunkt dedupliziert nach Empfaenger, Betreff und Linkziel.
- Aufgaben-Feedback prueft ebenfalls auf vorhandene Notification.
- Unberechnete-Zeiten-Warnungen deduplizieren ueber `UnbilledTimeAlert`.
- Abwesenheitsmeldungen schreiben an mehreren Stellen direkt in `Notification`, ohne sichtbare allgemeine Deduplikation.

Risiko:
- Manche Meldungen werden sauber verhindert, andere koennen bei wiederholten Aktionen mehrfach entstehen.
- Nutzer verlieren Vertrauen in die Glocke, wenn sie gleiche Hinweise mehrfach erhalten.

Schweregrad: Mittel bis Hoch

Pruefung:
- Zentrale Helper-Funktion fuer Notifications einfuehren.
- Deduplikationsschluessel definieren: Empfaenger + Typ + Ziel + Zeitraum.
- Direkte Inserts in `Notification` schrittweise ersetzen.

Status: Offen

### F-020: Notification-Historie wird in der UI nicht wirklich serverseitig geladen

Bereich: Meldungen / Notifications / UX

Dateien:
- `src/app/api/notifications/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Die API unterstuetzt `history=true`, `limit`, `offset` und Suche.
- Die UI laedt aktuell nur `/api/notifications?userId=...` ohne History-Parameter.
- Der Historie-Tab filtert damit nur den bereits im Client vorhandenen Notification-State.
- Nach `Alle gelesen` laedt die UI erneut nur offene Meldungen; gelesene Meldungen verschwinden dadurch aus dem lokalen State.

Risiko:
- Der Historie-Tab kann leer oder unvollstaendig wirken, obwohl gelesene Meldungen in der Datenbank vorhanden sind.
- Nutzer koennen alte Meldungen nicht verlaesslich nachvollziehen.

Schweregrad: Mittel

Pruefung:
- Beim Umschalten auf Historie serverseitig `history=true` laden.
- Suche/Pagination der API nutzen.
- Neue und gelesene Meldungen getrennt im Client halten.

Status: Offen

### F-021: Notification-Zieloeffnung markiert Meldung nicht einzeln als gelesen

Bereich: Meldungen / Notifications / UX

Dateien:
- `src/components/dashboard/dashboard-page.tsx`
- `src/app/api/notifications/route.ts`

Beobachtung:
- Klick auf eine Meldung oeffnet das Ziel, setzt aber nicht sichtbar genau diese Meldung auf gelesen.
- Stattdessen gibt es nur `Alle gelesen`.
- Die API bietet ebenfalls nur pauschales Markieren aller offenen Meldungen eines Users.

Risiko:
- Nutzer bearbeiten eine Meldung, sie bleibt aber als neu stehen.
- Oder Nutzer muessen alle Meldungen auf einmal als gelesen markieren und verlieren offene To-dos.

Schweregrad: Mittel

Pruefung:
- Einzelnes `mark-read` mit Notification-ID einfuehren.
- Optional Zieloeffnung automatisch als gelesen markieren.

Status: Offen

### F-022: Design-/UX-System ist verbessert, aber aktive Unterebenen und Zaehler sind noch uneinheitlich

Bereich: Design / UX / Navigation

Dateien:
- `src/components/dashboard/dashboard-page.tsx`
- `src/components/dashboard/dashboard.module.css`

Beobachtung:
- Hauptnavigation und Aktennavigation haben aktive Zustandsstile.
- Unterreiter in Kunden-/Projektakten sind verbessert, nutzen aber andere Muster als Hauptnavigation, Report-Tabs und Modal-Tabs.
- Zaehler sind teilweise vorhanden, z. B. Dokumente, Bilder, Aufgaben, Ansprechpartner; Hinweise fehlen noch.
- Pflicht-/kritische Signale sind nicht ueberall als konsistentes Badge-System umgesetzt.

Risiko:
- Nutzer erkennen in tiefen Akten nicht immer eindeutig, wo sie sich befinden.
- Wichtige Inhalte koennen uebersehen werden, wenn einzelne Reiter keine Zaehler oder Warnsignale tragen.

Schweregrad: Mittel

Pruefung:
- Einheitliches Navigationsmuster definieren:
  - Hauptreiter
  - Aktenreiter
  - Unterreiter
  - Badges/Zaehler/Warnungen
- Hinweise, Pflichtnachweise und offene Aktionen als einheitliche Badge-Sprache abbilden.

Status: Offen

### F-004: Runtime-DDL in vielen API-Routen

Bereich: Architektur / Deployments / Datenbank

Dateien:
- `src/app/api/catalog-items/route.ts`
- `src/app/api/contacts/route.ts`
- `src/app/api/hero/projects/route.ts`
- `src/app/api/invoices/route.ts`
- `src/app/api/monthly-financial-report/route.ts`
- weitere API-Routen

Beobachtung:
- API-Routen fuehren `CREATE TABLE IF NOT EXISTS` und `ALTER TABLE` aus.

Risiko:
- Prisma-Schema und echte DB koennen auseinanderlaufen.
- Produktive DB-Berechtigungen koennen Runtime-DDL blockieren.
- `prisma db push` kann Datenverlust-Warnungen ausloesen, wenn Modelle fehlen.

Schweregrad: Hoch

Pruefung:
- Alle Runtime-DDL-Stellen erfassen.
- Abgleich mit Prisma-Schema.
- Entscheidung: DDL in Migrations-/Setup-Schicht verlagern oder bewusst dokumentieren.

Status: Offen

### F-005: Storno-Logik ist fachlich vorhanden, muss aber systemweit abgeglichen werden

Bereich: Buchhaltung / Auswertungen / Projektakte

Dateien:
- `src/app/api/invoices/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Storno erzeugt Stornorechnung, setzt Ursprungsrechnung auf `Storniert` und entkoppelt Zeitbuchungen.
- Dashboard nutzt inzwischen `isFinanciallyActiveInvoice` fuer wichtige Auswertungen.

Risiko:
- Einzelne Sonderbereiche koennen weiterhin direkt auf `invoices` zugreifen und Stornos anders zaehlen.

Schweregrad: Hoch

Pruefung:
- Alle Rechnungsberechnungen im Dashboard gegen `isFinanciallyActiveInvoice` oder bewusst andere Logik pruefen.
- Dokumentenlisten duerfen Stornos anzeigen, Umsatz-/DB-Auswertungen nicht.

Status: In Pruefung

Zwischenstand 2026-06-18:
- Die zentralen Auswertungen verwenden `reportInvoices`.
- `reportInvoices` geht ueber `isReportRevenueInvoice` -> `isForecastRelevantInvoice` -> `isFinanciallyActiveInvoice`.
- `isFinanciallyActiveInvoice` schliesst Entwuerfe, geloeschte Rechnungen, stornierte Rechnungen und Stornorechnungen aus.
- Forecast, Umsatzdetails, Monatsbericht, Projekt-/Kunden-/Uebersichts-Auswertungen bauen danach im Kern auf dieser gefilterten Liste auf.
- Kundenakte/Projektakte zeigen Rechnungen als Dokumente bewusst inklusive Storno/Storniert, aber ohne geloeschte Rechnungen. Das ist fuer Belegarchive fachlich plausibel.

Bewertung Zwischenstand:
- Fuer Umsatz-/DB-Auswertungen aktuell kein direkter Storno-Doppeltzaehlungsfehler gefunden.
- Weiter offen: Spezialbereiche wie Stapelabrechnung, OP-Aktionen, Legacy-Rechnungen und Zahlungsstatus noch im Detail testen.

### F-006: Rechnungs-PATCH erlaubt kritische Aktionen ohne serverseitige Rollenpruefung

Bereich: Buchhaltung / Rechte / API

Dateien:
- `src/app/api/invoices/route.ts`

Beobachtung:
- `PATCH /api/invoices` verarbeitet u. a. `cancel`, `mark-paid`, `record-reminder`, `create-reminder-document`, `mark-printed` und normales Bearbeiten/Fakturieren.
- Fuer diese PATCH-Aktionen ist im geprueften Code keine harte Rollenpruefung sichtbar.
- Lediglich `DELETE /api/invoices` prueft serverseitig, ob der Actor `GESCHAEFTSFUEHRER` ist.

Risiko:
- Wenn jemand die API direkt anspricht, koennte er Rechnungen stornieren, als bezahlt markieren, Mahnungen erzeugen oder Rechnungen bearbeiten, obwohl die UI diese Aktion ggf. nicht erlauben wuerde.

Schweregrad: Kritisch

Pruefung:
- Server muss fuer jede Rechnungsaktion Actor/Session und Rolle pruefen.
- Mindestens: Storno, Zahlung, Mahnung, Fakturierung und Bearbeitung brauchen klare Rollenregeln.
- UI-Rechte wie `canDeleteInvoices` reichen nicht.

Status: Offen

### F-007: Rechnungs-Gegenwerte werden in Akten als Dokumentliste gezeigt, nicht als Auswertung

Bereich: Kundenakte / Projektakte / Buchhaltung

Dateien:
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Kundenakte und Projektakte listen Rechnungen dokumentarisch.
- Geloeschte Rechnungen werden dort ausgeblendet.
- Stornierte Rechnungen und Stornorechnungen bleiben sichtbar, mit Status und Aktionen.

Risiko:
- Fachlich sinnvoll fuer ein Archiv, aber UX muss deutlich machen, dass diese Listen kein Umsatz-/Deckungsbeitragswert sind.
- Sonst koennen Nutzer die sichtbaren Netto-/Brutto-Werte gedanklich falsch addieren.

Schweregrad: Mittel

Pruefung:
- In Beleglisten Storno/Storierte optisch klarer kennzeichnen.
- Summen in Akten nur aus `isFinanciallyActiveInvoice` bilden, falls dort zukuenftig Summen angezeigt werden.

Status: Offen

### F-023: E-Rechnungsformat ist in der UI vorbereitet, wird beim E-Mail-Versand aber nicht als XML/ZUGFeRD angehaengt

Bereich: Buchhaltung / E-Rechnung / E-Mail-Versand

Dateien:
- `src/components/dashboard/dashboard-page.tsx`
- `src/app/api/document-mail/route.ts`
- `src/app/api/invoices/route.ts`

Beobachtung:
- Der Versanddialog kennt `PDF`, `XRechnung XML`, `ZUGFeRD PDF` und `PDF + XRechnung`.
- Die UI zeigt selbst den Hinweis, dass XML-/ZUGFeRD-Datei erst im naechsten Ausbauschritt angebunden wird und der Versand beim PDF bleibt.
- `document-mail` verarbeitet beim Versand nur PDF/Data-URL/ActivityReport/manuelle Anhaenge.
- `eInvoiceFormat` wird beim eigentlichen Mailversand nicht ausgewertet.
- XRechnung kann separat validiert und als XML heruntergeladen werden, ist aber nicht automatisch Mail-Anhang.

Risiko:
- Nutzer koennen fachlich glauben, eine XRechnung oder PDF+XRechnung versendet zu haben, obwohl tatsaechlich nur PDF und sonstige Anlagen gesendet wurden.
- Das ist bei E-Rechnungspflicht ein hohes Compliance-Risiko.

Schweregrad: Hoch

Pruefung:
- Vor Freigabe des echten E-Rechnungsversands muss `document-mail` je nach `eInvoiceFormat` XML erzeugen, KoSIT-validieren und als Anhang mitsenden.
- ZUGFeRD darf erst auswaehlbar sein, wenn PDF/A-3-Einbettung wirklich umgesetzt und geprueft ist.
- UI-Status sollte bis dahin klar `Noch nicht fuer Versand aktiv` statt nur `Vorbereitet` kommunizieren.

Status: Offen

### F-024: Dokument-Mail-Versand nutzt request-basierte Actor-ID und hat keine harte Rollenpruefung

Bereich: Buchhaltung / Dokumentenversand / Rechte

Dateien:
- `src/app/api/document-mail/route.ts`

Beobachtung:
- `POST /api/document-mail` sucht den Absender ueber `body.actorId`.
- Wird kein passender Nutzer gefunden, faellt die Route auf den Demo-/Kontextnutzer zurueck.
- Danach wird dessen Microsoft-365-Konto zum Versand genutzt.
- Eine sichtbare serverseitige Rollenpruefung fuer Rechnungs-, Angebots- oder Mahnungsversand ist in der Route nicht vorhanden.

Risiko:
- Bei direktem API-Aufruf koennte ein falscher Absender oder ein unberechtigter Versand ausgeloest werden.
- Gerade Rechnungen, Stornos und Mahnungen brauchen serverseitig klare Berechtigungen und eine verlaessliche Benutzeridentitaet.

Schweregrad: Kritisch

Pruefung:
- Actor aus echter Session ableiten, nicht aus frei uebergebenem Request-Feld.
- Rollenregeln fuer Angebot, Rechnung, Storno, Mahnung und Dokumente serverseitig erzwingen.
- Versand nur erlauben, wenn der Nutzer das Dokument sehen und in diesem Kontext versenden darf.

Status: Offen

### F-025: Versandprotokoll speichert nur PDF-Anhang, aber keinen E-Rechnungsstatus

Bereich: Buchhaltung / E-Rechnung / Audittrail

Dateien:
- `src/app/api/document-mail/route.ts`

Beobachtung:
- `DocumentMailDispatch` speichert `attachPdf`, Status, Empfaenger, Betreff und Absender.
- Es gibt keine sichtbaren Felder fuer `eInvoiceFormat`, `xrechnungAttached`, `zugferdAttached`, KoSIT-Status oder Validierungszeitpunkt.
- Beim Verlauf wird nur allgemein protokolliert, dass ein Dokument per E-Mail versendet wurde.

Risiko:
- Spaeter laesst sich nicht sauber nachweisen, ob wirklich PDF, XRechnung, PDF+XRechnung oder ZUGFeRD versendet wurde.
- Bei Kunden- oder Behoerdenrueckfragen fehlt ein belastbarer Versandnachweis zum E-Rechnungsformat.

Schweregrad: Hoch

Pruefung:
- Versandprotokoll um E-Rechnungsformat, konkrete Anhangsliste und Validierungsstatus erweitern.
- Rechnungsverlauf mit Ereignissen wie `XRechnung erzeugt`, `XRechnung validiert`, `XRechnung versendet`, `ZUGFeRD versendet` ergaenzen.

Status: Offen

### F-026: XRechnung-Verkaeuferdaten sind noch hart im Generator hinterlegt

Bereich: Buchhaltung / E-Rechnung / Stammdaten

Dateien:
- `src/app/api/invoices/route.ts`

Beobachtung:
- `getXRechnungSellerProfile` liefert feste Werte fuer OK solutions GmbH, Adresse, E-Mail, USt-ID, IBAN, BIC und Bank.
- Der Funktionsparameter `company` wird fuer diese Daten aktuell nicht genutzt.
- Das passt zwar zur fachlichen Klarstellung, dass OK immocare nur Marke und OK solutions GmbH Verkaeufer ist, aber die Daten sind nicht als pflegbare Stammdaten modelliert.

Risiko:
- Aenderungen an Adresse, Bank, USt-ID, E-Mail oder Gesellschaftsdaten erfordern Codeaenderungen.
- Bei weiteren Marken/Gesellschaften oder abweichenden Rechnungsstellern wird die XRechnung schnell falsch.

Schweregrad: Hoch

Pruefung:
- Firmen-/Verkaeuferdaten in pflegbare Stammdaten ueberfuehren.
- XRechnung-Generator nur aus validierten Stammdaten speisen.
- Pflichtfelder vor Rechnungsversand pruefen und bei fehlenden Angaben blockieren.

Status: Offen

### F-027: KoSIT-Validierung ist eingebaut, aber stark von Server-Umgebung abhaengig

Bereich: Buchhaltung / E-Rechnung / Deployment

Dateien:
- `src/lib/e-invoice/kosit-validator.ts`
- `src/app/api/invoices/route.ts`

Beobachtung:
- KoSIT wird ueber Umgebungsvariablen fuer Java, Validator-JAR, Repository und Szenario-Datei gestartet.
- Wenn JAR oder Repository fehlen, meldet die Validierung `not-configured`.
- Auf dem Server wurde Java/KoSIT manuell eingerichtet und der Smoke-Test bestand.

Risiko:
- Bei Serverwechsel, Neuinstallation oder Deployment ohne diese Dateien ist XRechnung-Validierung technisch nicht verfuegbar.
- Ohne klaren Healthcheck kann der Fehler erst im Versandprozess auffallen.

Schweregrad: Mittel

Pruefung:
- Deployment-Check fuer KoSIT in Start-/Admin-Status aufnehmen.
- XRechnung-Versand blockieren, wenn KoSIT nicht konfiguriert oder nicht erfolgreich ist.
- Pfad-/Java-Abhaengigkeiten dokumentieren und automatisiert pruefen.

Status: Offen

### F-028: Mitarbeiterliste liefert sensible Mitarbeiterdetails ohne sichtbare serverseitige Zugriffsbeschraenkung

Bereich: Mitarbeiterverwaltung / Datenschutz / API

Dateien:
- `src/app/api/users/route.ts`

Beobachtung:
- `GET /api/users` liefert alle Nutzer der Organisation.
- Enthalten sind neben Name, E-Mail und Rolle auch Personalnummer, Geburtsdatum, Telefon, Mobilnummer, Adresse, Signatur, Planungsdaten, Kostenrelevanz und Mailkonto-Statusdaten.
- Microsoft-Token werden in der Rueckgabe sichtbar nicht ausgegeben, das ist positiv.
- Es gibt in der Route aber keine sichtbare Rollen-/Sessionpruefung, wer diese vollstaendige Mitarbeiterliste lesen darf.

Risiko:
- Mitarbeiter koennen potenziell personenbezogene Daten anderer Mitarbeiter sehen, wenn sie die Route direkt aufrufen koennen.
- Das ist Datenschutz- und Rollenmodell-relevant.

Schweregrad: Hoch

Pruefung:
- `GET /api/users` nach Rollen aufteilen: allgemeines Mitarbeiterverzeichnis vs. Personal-/Adminansicht.
- Sensible Felder nur fuer Admin/Geschaeftsfuehrung oder klar berechtigte Rollen ausliefern.
- Aktiven Nutzer serverseitig aus Session ableiten, nicht nur aus Frontend-Kontext.

Status: Offen

### F-029: Projektzeit-Eintraege koennen serverseitig ohne Actor- und Rollenpruefung angelegt, ueberschrieben und geloescht werden

Bereich: Stempelzeiten / Projektakte / Kostenlogik / API

Dateien:
- `src/app/api/project-time-entries/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- `GET /api/project-time-entries` liefert alle Projektzeit-Eintraege der Organisation.
- `POST /api/project-time-entries` nimmt `id`, `userId`, `employee`, Zeiten, Modus, Quelle, Ueberstundenstatus und Historie direkt aus dem Request.
- Durch `ON CONFLICT ("id") DO UPDATE` kann ein vorhandener Eintrag mit derselben ID ueberschrieben werden.
- `DELETE /api/project-time-entries` markiert Eintraege als geloescht, nimmt `actorUserId` und `actorName` aber aus Query-Parametern.
- Die UI blendet Bearbeitung nur fuer berechtigte Rollen ein, die API erzwingt diese Rolle aber nicht.

Risiko:
- Direkte API-Aufrufe koennen Arbeitszeiten, Mitarbeiterzuordnung, Projektbezug, Ueberstundenstatus und Kosten-Snapshots manipulieren.
- Das betrifft Projektgewinn, Abrechnung, Auswertungen und Mitarbeiterzeitkonto.

Schweregrad: Kritisch

Pruefung:
- Server muss echten Actor ermitteln und Rollen fuer Lesen, manuelles Anlegen, Bearbeiten, Loeschen und Ueberstundenfreigabe pruefen.
- Normale Mitarbeiter duerfen nur eigene Stempelungen erstellen und nicht beliebige `userId` setzen.
- Manuelle Zeitbuchungen, Korrekturen und Loeschungen brauchen serverseitige Historie mit echtem Actor.

Status: Offen

### F-030: Aktive Stempelung ist ueber frei uebergebene User-ID steuerbar

Bereich: Stempelung / Zeiterfassung / API

Dateien:
- `src/app/api/stamp-session/route.ts`

Beobachtung:
- `GET /api/stamp-session` liefert ohne `userId` alle aktiven Stempelungen der Organisation.
- `POST`, `PATCH` und `DELETE`/`stop` verwenden `body.userId`, um Start, Pause, Fortsetzen und Stop zu steuern.
- Es ist keine sichtbare serverseitige Pruefung vorhanden, ob der Aufrufer dieser Mitarbeiter ist oder eine Leitungsrolle hat.
- Beim Start werden `employee`, `projectId`, `projectLabel` und Kommentar aus dem Request uebernommen.

Risiko:
- Eine Person koennte fuer andere Mitarbeiter Stempelungen starten, pausieren oder beenden.
- Falsche Projektzeiten koennen entstehen und spaeter in Abrechnung/Kosten/Auswertungen einfliessen.

Schweregrad: Kritisch

Pruefung:
- Stempeln fuer sich selbst: `userId` serverseitig aus Session.
- Stempeln/Korrigieren fuer andere: nur klar berechtigte Rollen und mit Protokoll.
- Projekt-ID gegen echte Projekte der Organisation pruefen.
- `GET` fuer alle aktiven Sessions nur fuer Fuehrung/Admin freigeben.

Status: Offen

### F-031: Aufgaben-Zeiteintraege haben keine konsistente Bearbeitungs- und Loeschberechtigung

Bereich: Aufgaben / Zeitbuchung / API

Dateien:
- `src/app/api/tasks/[taskId]/time-entries/route.ts`

Beobachtung:
- Neue Aufgaben-Zeiteintraege werden dem Kontextnutzer zugeordnet.
- `PATCH` kann einen vorhandenen Zeiteintrag anhand `entryId` bearbeiten, ohne sichtbare Pruefung, ob der Aufrufer Eigentuemer, Aufgabenverantwortlicher oder Fuehrungskraft ist.
- `DELETE` loescht den Zeiteintrag hart aus der Datenbank.
- Der Loesch-Actor wird ueber `body.actorId` ermittelt und faellt bei fehlendem/ungueltigem Wert auf den Kontextnutzer zurueck.
- Es wird zwar eine Benachrichtigung an Admin/Geschaeftsfuehrung erzeugt, aber der Originaleintrag ist danach geloescht.

Risiko:
- Aufgabenzeiten koennen nachtraeglich veraendert oder geloescht werden, ohne belastbare serverseitige Berechtigung und ohne revisionssichere Historie.
- Harte Loeschung erschwert Nachvollziehbarkeit.

Schweregrad: Hoch

Pruefung:
- Bearbeiten/Loeschen nur fuer Eigentuemer oder berechtigte Rollen.
- Loeschung als Soft-Delete mit Actor, Grund, Zeitpunkt und alter Dauer speichern.
- Actor aus Session ableiten.

Status: Offen

### F-032: Lohnkosten-Zugriff ist fachlich eingeschraenkt, aber ueber feste Namen und request-basierte Actor-ID geloest

Bereich: Mitarbeiterverwaltung / Lohnkosten / Rechte

Dateien:
- `src/app/api/employee-costs/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Zugriff auf Lohnkosten ist serverseitig auf die Namen `Ramona Eid` und `Christian Eid` begrenzt.
- Die Identitaet wird ueber `actorId` aus Query oder Body bestimmt.
- Die UI nutzt dieselbe Namensliste fuer Sichtbarkeit.
- Es gibt keine rollenbasierte Berechtigung wie `GESCHAEFTSFUEHRER`, `ADMIN` oder eine eigene Permission.

Risiko:
- Namensaenderungen, Dubletten oder falsch gesetzte Namen koennen Zugriff blockieren oder ungewollt erlauben.
- Request-basierte Actor-ID bleibt ein strukturelles Risiko.
- Lohnkosten sind besonders sensible Daten und sollten nicht an Anzeigenamen haengen.

Schweregrad: Hoch

Pruefung:
- Eigene Permission oder Rollenregel fuer Lohnkosten einfuehren.
- Actor aus Session ableiten.
- Aenderungen an Lohnkosten mit echtem Actor und Zeitstempel protokollieren.

Status: Offen

### F-033: Kunden-Logbuch ist nicht wie Projekt-Logbuch dauerhaft gespeichert

Bereich: Kundenakte / Logbuch / Datenpersistenz

Dateien:
- `src/components/dashboard/dashboard-page.tsx`
- `src/app/api/project-logbook-entries/route.ts`

Beobachtung:
- Projekt-Logbucheintraege werden ueber `/api/project-logbook-entries` dauerhaft gespeichert.
- Kunden-Logbucheintraege werden im geprueften UI-Code nur in `customerLogbookEntries` im Frontend-State ergaenzt.
- Fuer Kunden-Logbuch wurde keine vergleichbare persistente API-Schreibroute gefunden.
- In der Kundenakte werden zusaetzlich feste Beispiel-/Alt-Eintraege in die Logbuchliste gemischt.

Risiko:
- Kunden-Logbucheintraege koennen nach Reload, neuem Browser oder Serverwechsel verschwinden.
- Feste Beispiel-Eintraege koennen wie echte Historie wirken und die Akte fachlich verfaelschen.

Schweregrad: Hoch

Pruefung:
- Kunden-Logbuch als echte Tabelle/API analog zum Projekt-Logbuch umsetzen.
- Harte Beispiel-Eintraege aus der produktiven Kundenakte entfernen.
- Kunden- und Projekt-Logbuch klar trennen, aber in der Kundenakte zusammenfuehren.

Status: Offen

### F-034: Kunden-/Projekt-Hinweisbestaetigungen sind request-basiert und nicht eindeutig

Bereich: CRM-Hinweise / Stempelung / Projektanlage / Audittrail

Dateien:
- `src/app/api/customer-project-notes/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Hinweise koennen fuer Kunde oder Projekt geladen und vor Stempelung oder Projektanlage bestaetigt werden.
- Die Bestaetigung schreibt `userId`, `userName`, `customerId`, `projectId` und `context` aus dem Request.
- Es gibt keine sichtbare serverseitige Pruefung, ob der bestaetigende Nutzer wirklich dieser Nutzer ist.
- Es gibt keine eindeutige Sperre gegen doppelte Bestaetigungen fuer denselben Hinweis/Nutzer/Kontext/Tag.
- Archivieren von Hinweisen erfolgt ebenfalls ohne sichtbare Rollenpruefung.

Risiko:
- Bestaetigungen koennen fachlich falsch oder mehrfach geschrieben werden.
- Ein Nutzer koennte Hinweise fuer andere Mitarbeiter bestaetigen.
- Der Audittrail fuer Pflicht-Hinweise vor Stempelung oder Projektanlage ist damit nicht belastbar genug.

Schweregrad: Hoch

Pruefung:
- Actor aus echter Session ableiten.
- Unique-Regel fuer Hinweis/Nutzer/Kontext/Frequenz-Zeitraum einfuehren.
- Archivieren/Bearbeiten nur fuer berechtigte Rollen erlauben.
- Beim Laden von Pflicht-Hinweisen nur relevante Acknowledgements lesen, nicht pauschal alle zur Organisation.

Status: Offen

### F-035: Kunden- und Projektverknuepfung nutzt teils ID, teils Namen als Fallback

Bereich: Kundenakte / Projektakte / CRM-Verknuepfungen

Dateien:
- `src/components/dashboard/dashboard-page.tsx`
- `src/app/api/hero/projects/route.ts`
- `src/app/api/contacts/route.ts`

Beobachtung:
- Projekte speichern `contactId`, `contactPersonId`, `addressContactId`, aber auch kopierte Textwerte wie `customer` und `address`.
- Die UI sucht Kundenbezug teilweise ueber `contactId`, teilweise ueber `getContactLabel`, `getContactDisplayName`, `companyName` oder Textvergleich.
- Kundenakte zaehlt Projekte, Potenziale und Aufgaben teils ueber IDs, teils ueber Namens- oder Textsuche.
- Kontakte koennen hart geloescht werden; verknuepfte Projekte behalten dann nur noch alte Textwerte.

Risiko:
- Nach Umbenennung, Dubletten, Kontaktloeschung oder aehnlichen Kundennamen koennen Projekte in falschen Kundenakten auftauchen oder fehlen.
- Zaehler und Akteninhalte koennen vom eigentlichen Datenmodell abweichen.

Schweregrad: Hoch

Pruefung:
- Kunden-/Projektverknuepfung primaer ueber stabile IDs fuehren.
- Textwerte nur als Snapshot fuer Belege/Anzeige verwenden, nicht fuer Aktenlogik.
- Kontaktloeschung nur als Archivierung oder mit Verknuepfungspruefung erlauben.
- Nach Kontaktumbenennung definieren, welche Snapshots bewusst unveraendert bleiben und welche Aktenansichten dynamisch aktualisieren.

Status: Offen

### F-036: Projektanhaenge werden ueber Logbuch-JSON verwaltet und per Name/Index veraendert

Bereich: Projektakte / Bilder / Dokumente / Logbuch

Dateien:
- `src/app/api/project-logbook-entries/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Bilder und Dokumente liegen als Attachments im JSON-Feld eines Logbucheintrags.
- Attachment-Aktionen `delete` und `move` identifizieren den Anhang ueber `attachmentIndex` und optional `attachmentName`.
- Der Actor fuer Historieneintraege wird aus `actorUserId` und `actorName` im Request uebernommen.
- Eine harte Rollenpruefung fuer Verschieben/Loeschen ist in der Route nicht sichtbar.
- Uploads speichern Data-URLs im Logbuch-JSON; das ist bei vielen/grossen Bildern strukturell schwergewichtig.

Risiko:
- Bei gleichen Dateinamen oder veraenderter Reihenfolge kann der falsche Anhang betroffen sein.
- Direkte API-Aufrufe koennen Anhaenge entfernen oder verschieben.
- Grosse Bildmengen belasten Datenbank, API-Antworten und Browser.

Schweregrad: Hoch

Pruefung:
- Anhaenge als eigene Datensaetze mit stabiler Attachment-ID speichern.
- Dateiinhalt in Dateispeicher/Object Storage, Datenbank nur Metadaten und Verweis.
- Loeschen/Verschieben serverseitig rollenpruefen und echten Actor protokollieren.
- Bildlisten paginieren oder nach Monat/Kategorie gezielt laden.

Status: Offen

### F-037: Akten-Zaehler sind ueberwiegend clientseitige Heuristik und nicht serverseitig verbindlich

Bereich: Kundenakte / Projektakte / UX / Datenkonsistenz

Dateien:
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Dokument-, Bild-, Aufgaben-, Projekt- und Zusatzverkaufszaehler werden in der UI aus bereits geladenen Arrays berechnet.
- In der Kundenakte werden Aufgaben teilweise ueber Textsuche in Kunde/Titel/Beschreibung dem Kunden zugeordnet.
- Projekt- und Kundenakte nutzen nicht durchgehend denselben Zaehlmechanismus.
- Wenn Daten noch nicht geladen, umbenannt oder nur ueber Text-Snapshot verknuepft sind, koennen Zaehler abweichen.

Risiko:
- Nutzer sehen falsche oder unvollstaendige Zahlen in der Akte.
- Gerade Dokumente/Bilder/Hinweise wirken dann unzuverlaessig, obwohl Daten vorhanden sein koennen.

Schweregrad: Mittel

Pruefung:
- Serverseitige Count-Endpunkte oder konsolidierte Akten-API fuer Kunden- und Projektakte bauen.
- Zaehlungen nur ueber stabile IDs vornehmen.
- Hinweise, Dokumente, Bilder, Aufgaben, Angebote, Rechnungen, Zusatzverkaeufe und Ansprechpartner einheitlich zaehlen.

Status: Offen

### F-038: Artikel-/Leistungsstammdaten koennen ohne sichtbare serverseitige Rollenpruefung geaendert werden

Bereich: Artikel & Leistungen / Stammdaten / Rechte

Dateien:
- `src/app/api/catalog-items/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- `GET`, `POST`, `PATCH` und `DELETE /api/catalog-items` haben keine sichtbare harte Rollenpruefung.
- Actor-Daten fuer die Historie (`actorUserId`, `actorName`) kommen aus dem Request.
- Die UI zeigt Erstellen/Bearbeiten/Deaktivieren im Katalog ohne erkennbare Rollenbegrenzung wie bei Mitarbeiterdaten.

Risiko:
- Artikel, Leistungen, Pakete, Preise, Einkaufskosten, MwSt.-Saetze und Paketbestandteile koennen per direktem API-Aufruf manipuliert werden.
- Die Historie kann dabei einen falschen Bearbeiter enthalten.

Schweregrad: Kritisch

Pruefung:
- Stammdatenpflege serverseitig auf berechtigte Rollen/Permissions begrenzen.
- Actor aus Session ableiten.
- Preis-/Kosten-/MwSt.-Aenderungen besonders protokollieren.

Status: Offen

### F-039: `usedCount` fuer Artikel/Pakete wird angezeigt, aber nicht gepflegt

Bereich: Artikel & Leistungen / Nutzung / UX

Dateien:
- `src/app/api/catalog-items/route.ts`
- `src/components/dashboard/dashboard-page.tsx`
- `prisma/schema.prisma`

Beobachtung:
- `CatalogItem.usedCount` existiert im Modell und wird in der Katalogtabelle angezeigt.
- Im geprueften Code wurde keine Stelle gefunden, die `usedCount` bei Angeboten, Rechnungen oder Paketverwendung hochzaehlt.
- Deaktivierung ist daher nicht erkennbar an echte Nutzung gekoppelt.

Risiko:
- Nutzer sehen bei benutzten Artikeln/Paketen weiterhin `0`.
- Entscheidungen zu Deaktivierung, Dublettenbereinigung oder Stammdatenpflege basieren auf falschen Nutzungszahlen.

Schweregrad: Mittel

Pruefung:
- `usedCount` entweder dynamisch aus OfferLine/InvoiceLine/CatalogPackageItem berechnen oder beim Speichern konsistent pflegen.
- Bei Deaktivierung genutzter Artikel klare Warnung anzeigen.

Status: Offen

### F-040: Paketbestandteile werden ersetzt, aber nicht als belastbarer Snapshot in Angeboten/Rechnungen gespeichert

Bereich: Pakete / Angebote / Rechnungen / Nachkalkulation

Dateien:
- `src/app/api/catalog-items/route.ts`
- `src/app/api/offers/route.ts`
- `src/app/api/invoices/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Paketbestandteile werden bei jeder Paketbearbeitung geloescht und neu geschrieben.
- Angebots- und Rechnungspositionen speichern die Paketposition als eine Zeile mit `catalogItemId`, Text, Menge, Preis und Typ.
- Die konkrete Paketzusammensetzung zum Zeitpunkt des Angebots wird nicht als eigene Positionsstruktur gespeichert.
- Auswertungen und Aufteilungen greifen fuer Paketanteile teils wieder auf aktuelle `catalogItems.packageItems` zurueck.

Risiko:
- Wenn ein Paket spaeter geaendert wird, koennen historische Angebote/Rechnungen in Auswertungen anders interpretiert werden als zum Zeitpunkt der Erstellung.
- Material-/Leistungsanteile, Margen und Nachkalkulation koennen nachtraeglich kippen.

Schweregrad: Hoch

Pruefung:
- Beim Einfuegen eines Pakets in Angebot/Rechnung die damaligen Bestandteile als Snapshot speichern.
- Auswertungen fuer historische Belege aus Beleg-Snapshots berechnen, nicht aus aktuellen Paketstammdaten.
- Paketbearbeitung weiterhin erlauben, aber nur fuer zukuenftige Belege wirksam machen.

Status: Offen

### F-041: Angebotskalkulation nutzt aktuelle Stammdaten statt gespeicherter Kosten-Snapshots

Bereich: Angebote / Deckungsbeitrag / Kalkulation

Dateien:
- `src/app/api/offers/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- OfferLine speichert Verkaufspreis, Rabatt, Text, Typ und optionale Arbeitskosten.
- Materialkosten-Snapshots wie bei Rechnungen gibt es fuer Angebotspositionen nicht.
- Die Angebotsmarge in der UI wird aus aktuellen Katalogdaten (`catalogItems`) berechnet.

Risiko:
- Aendert sich der EK im Katalog, kann die angezeigte Marge eines alten Angebots nachtraeglich anders aussehen.
- Damit ist nicht mehr klar, welche Kalkulation bei Angebotsabgabe wirklich galt.

Schweregrad: Hoch

Pruefung:
- Material- und Paketkosten beim Speichern des Angebots als Snapshot auf OfferLine speichern.
- Angebotsauswertungen und Margen aus diesen Snapshots berechnen.
- Bei Angebotsbearbeitung bewusst entscheiden: alte Kalkulation behalten oder mit neuem Snapshot neu kalkulieren und protokollieren.

Status: Offen

### F-042: Rechnungs-Kostensnapshots werden bei jeder Rechnungsbearbeitung neu aus aktuellen Stammdaten berechnet

Bereich: Rechnungen / Nachkalkulation / Kosten-Snapshots

Dateien:
- `src/app/api/invoices/route.ts`

Beobachtung:
- Rechnungspositionen speichern `materialUnitCostSnapshot`, `materialCostSnapshot` und `costSnapshotAt`.
- Beim Speichern/Bearbeiten einer Rechnung ruft die Route erneut `withInvoiceLineCostSnapshots` auf.
- Diese Funktion liest aktuelle Katalog- und Paketdaten und ueberschreibt die Positionszeilen.
- Parallel ist bekannt, dass Rechnungs-PATCH-Aktionen noch nicht hart rollenbeschraenkt sind.

Risiko:
- Eine bereits fakturierte Rechnung kann bei Bearbeitung neue Kosten-Snapshots aus heutigen Stammdaten bekommen.
- Dadurch kann sich die historische Nachkalkulation veraendern, obwohl die Rechnung fachlich alt ist.

Schweregrad: Hoch

Pruefung:
- Bei finalisierten Rechnungen bestehende Kosten-Snapshots erhalten.
- Neue Snapshots nur bei Entwurf/Fakturierung oder bewusster Neukalkulation mit Protokoll schreiben.
- Bearbeitung fakturierter Rechnungen fachlich stark begrenzen.

Status: Offen

### F-043: Arbeitszeit-/Mitarbeiterverplanung fuer Angebotspositionen ist faktisch deaktiviert

Bereich: Angebote / Planung / Leistungskalkulation

Dateien:
- `src/app/api/offers/route.ts`

Beobachtung:
- `getOfferLaborValidationMessage` gibt sofort `""` zurueck.
- Der darunterliegende Code, der pruefen wuerde, ob Leistungs-/Paketpositionen vollstaendig auf Mitarbeiter verplant sind, wird dadurch nie erreicht.
- Angebote koennen dadurch ohne vollstaendige Mitarbeiter-/Stundenplanung gespeichert werden.

Risiko:
- Planstunden, Mitarbeiterauslastung und Angebotskalkulation koennen unvollstaendig sein.
- Spaetere Planungs- und Kapazitaetsauswertungen wirken vollstaendiger, als sie tatsaechlich sind.

Schweregrad: Mittel

Pruefung:
- Entscheiden, ob vollstaendige Mitarbeiterverplanung wirklich Pflicht sein soll.
- Falls ja: fruehen `return ""` entfernen und die Validierung aktivieren.
- Falls nein: UI und Auswertungen muessen klar zwischen kalkulierter Menge und verplanter Mitarbeiterzeit unterscheiden.

Status: Offen

### F-044: Rechnungsaktionen sind serverseitig nicht konsequent rollenbeschraenkt

Bereich: Buchhaltung / Rechnungen / Rechte

Dateien:
- `src/app/api/invoices/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- `PATCH /api/invoices` fuehrt sensible Aktionen wie `cancel`, `mark-paid`, `record-reminder` und `create-reminder-document` aus.
- Die Route nutzt `getDemoContext`, aber keine harte serverseitige Rollenpruefung fuer diese Aktionen.
- `actorName` wird aus dem Request uebernommen.
- Die UI prueft teilweise Leserechte/Schreibrechte, aber die API selbst vertraut diesen Client-Grenzen.

Risiko:
- Rechnungen koennen technisch von unberechtigten Clients als bezahlt markiert, gemahnt oder storniert werden.
- Buchhaltungsstatus, Mahnstufen und Audit-Historie koennen dadurch unzuverlaessig werden.

Schweregrad: Kritisch

Pruefung:
- Fuer jede Rechnungsaktion serverseitig echte Rollen pruefen.
- `actorId`/Benutzer aus einer vertrauenswuerdigen Session ableiten, nicht aus dem Request-Body.
- UI-Rechte nur als Komfort nutzen, nicht als Sicherheit.

Status: Offen

### F-045: Storno einer Rechnung ist nicht atomar abgesichert

Bereich: Buchhaltung / Rechnungen / Storno

Dateien:
- `src/app/api/invoices/route.ts`

Beobachtung:
- `cancelInvoice` erstellt eine Stornorechnung, fuegt Positionen ein, fuegt Arbeitszeilen ein, setzt die Originalrechnung auf `Storniert`, loest Stempelzeiten und schreibt Historie.
- Diese Schritte laufen nacheinander, aber nicht sichtbar in einer Datenbank-Transaktion.
- Bei einem Fehler nach einigen Schreibvorgaengen kann ein teilweise geschriebener Zustand entstehen.

Risiko:
- Es kann eine Stornorechnung ohne vollstaendige Positionen entstehen.
- Oder das Original bleibt aktiv, obwohl bereits eine Stornorechnung existiert.
- Umsatz, Projektgewinn, SVS und Rechnungsarchiv koennen dadurch widerspruechlich werden.

Schweregrad: Hoch

Pruefung:
- Storno komplett in eine Datenbank-Transaktion legen.
- Nach Storno automatisch pruefen: Original `Storniert`, Stornorechnung vorhanden, Summen gegengleich, Stempelzeiten geloest, Historie vollstaendig.
- Fehlerfall mit Rollback und sauberer Fehlermeldung absichern.

Status: Offen

### F-046: Storno ist fachlich nicht auf finalisierte Rechnungen begrenzt

Bereich: Buchhaltung / Rechnungen / Storno

Dateien:
- `src/app/api/invoices/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Die UI zeigt den Storno-Button nur fuer nicht-Entwuerfe.
- Die API blockiert aber nur `Storniert`, `Stornorechnung` und geloeschte Status.
- `Entwurf` wird in `cancelInvoice` nicht serverseitig ausgeschlossen.

Risiko:
- Ein direkter API-Aufruf koennte eine Stornorechnung zu einem Rechnungsentwurf erzeugen.
- Dadurch entstehen formale Dokumente ohne fachlich finalisierte Ausgangsrechnung.

Schweregrad: Hoch

Pruefung:
- Storno serverseitig nur fuer finalisierte, nicht geloeschte und nicht bereits stornierte Rechnungen erlauben.
- Fuer Entwuerfe nur Loeschen/Verwerfen anbieten.
- Statuswechsel fachlich als erlaubte Zustandsmaschine modellieren.

Status: Offen

### F-047: Bezahlt-Markierung kann serverseitig fuer unpassende Rechnungsstatus gesetzt werden

Bereich: Buchhaltung / Zahlungseingang

Dateien:
- `src/app/api/invoices/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- `mark-paid` setzt `isPaid = true` und `paidAt`, ohne serverseitig Status wie `Entwurf`, `Storniert` oder `Stornorechnung` auszuschliessen.
- Nur bei Status `Fakturiert` wird der Status auf `Bezahlt` geaendert.
- `isInvoicePaid` in der UI wertet `isPaid` als bezahlt, unabhaengig vom Rechnungsstatus.

Risiko:
- Entwuerfe oder Stornos koennen technisch als bezahlt gelten.
- Offene-Posten-, Forecast- und Zahlungsauswertungen koennen dadurch falsche Werte anzeigen.

Schweregrad: Hoch

Pruefung:
- `mark-paid` nur fuer offene, finalisierte Rechnungen erlauben.
- Storno, Stornorechnung, Entwurf und geloeschte Rechnungen serverseitig ausschliessen.
- Optional Gegenaktion `Zahlung zuruecknehmen` mit Historie ergaenzen.

Status: Offen

### F-048: Rechnungsloeschung prueft Rolle ueber requestbasierten actorId

Bereich: Buchhaltung / Rechnungen / Loeschen

Dateien:
- `src/app/api/invoices/route.ts`

Beobachtung:
- `DELETE /api/invoices` prueft zwar, ob der uebergebene `actorId` zu einem aktiven Geschaeftsfuehrer gehoert.
- Der `actorId` kommt aber aus dem Request-Body.
- Es ist keine Kopplung an eine echte angemeldete Session sichtbar.

Risiko:
- Wenn ein Client eine fremde Geschaeftsfuehrer-ID kennt oder erraten kann, kann die Pruefung technisch umgangen werden.
- Rechnungen werden zwar nur weich geloescht, aber das beeinflusst Archiv, Auswertungen und Stempelzeitverknuepfungen.

Schweregrad: Hoch

Pruefung:
- Loeschrechte aus der echten Session ableiten.
- Request-Body nicht fuer Identitaet oder Rolle verwenden.
- Loeschaktion mit Grund, User-ID und Zeitstempel revisionssicher protokollieren.

Status: Offen

### F-049: Mitarbeiter-/Stunden-Auswertung zaehlt Rechnungsentwuerfe als verkaufte Stunden

Bereich: Auswertungen / Mitarbeiter / SVS / Rechnungsstunden

Dateien:
- `src/app/api/labor-hour-metrics/route.ts`

Beobachtung:
- Die Abfrage fuer verkaufte Stunden aus `InvoiceLineLabor` schliesst `Storniert`, `Stornorechnung` und `Geloescht` aus.
- `Entwurf` wird nicht ausgeschlossen.

Risiko:
- Geplante Arbeitszeiten aus Rechnungsentwuerfen koennen als verkaufte Stunden in Mitarbeiter-/Projektmetriken erscheinen.
- Kapazitaets- und Leistungskennzahlen koennen dadurch zu positiv wirken.

Schweregrad: Mittel

Pruefung:
- `Entwurf` in der Abfrage ausschliessen.
- Alternativ nur explizit finalisierte Rechnungsstatus einschliessen, z.B. `Fakturiert` und `Bezahlt`.
- Bestehende Auswertungen mit Testdaten fuer Entwurf, Fakturiert, Bezahlt, Storno pruefen.

Status: Offen

### F-050: Altrechnungen koennen ohne Rollenpruefung geloescht und werden nur heuristisch als Storno erkannt

Bereich: Buchhaltung / HERO-Altrechnungen / Importdaten

Dateien:
- `src/app/api/legacy-invoices/route.ts`

Beobachtung:
- `DELETE /api/legacy-invoices` loescht alle HERO-Altrechnungen der Organisation ohne sichtbare Rollenpruefung.
- Die Storno-Erkennung fuer Altrechnungen ordnet negative Betraege heuristisch positiven Rechnungen mit gleichem Betrag und gleichem Kundennamen zu.
- Eine eindeutige Referenz auf die Originalrechnung wird nicht gespeichert.

Risiko:
- Importdaten koennen unbeabsichtigt oder unberechtigt entfernt werden.
- Bei gleichen Betrags-/Kundenkombinationen kann eine falsche Ursprungsrechnung als storniert markiert werden.
- Historische Umsatzvergleiche koennen dadurch unzuverlaessig werden.

Schweregrad: Mittel

Pruefung:
- DELETE serverseitig rollenbeschraenken oder entfernen.
- Stornozuordnung mit Originalnummer/Referenz speichern, sobald verfuegbar.
- Heuristische Treffer als `Storno vermutet` kennzeichnen statt als belastbaren Fakt.

Status: Offen

### F-051: Notifications koennen ueber requestbasierte User-ID fuer fremde Benutzer geladen und gelesen markiert werden

Bereich: Meldungen / Notifications / Rechte

Dateien:
- `src/app/api/notifications/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Die UI laedt Meldungen mit `/api/notifications?userId=${activeUserId}`.
- Die API nimmt `requestedUserId` aus der Query und setzt diesen Benutzer als `activeUser`, wenn er existiert.
- `PATCH /api/notifications` nimmt `body.userId` und markiert alle ungelesenen Meldungen dieses Benutzers als gelesen.

Risiko:
- Wenn ein Client eine fremde User-ID uebergibt, koennen fremde Meldungen sichtbar werden oder als gelesen markiert werden.
- Gerade bei Eskalationen, Abwesenheiten, Aufgaben und Buchhaltungs-/Projektmeldungen ist das ein Rechteproblem.

Schweregrad: Kritisch

Pruefung:
- Zielbenutzer serverseitig aus echter Session ableiten.
- Query-/Body-User-ID nur fuer Admin-Vertretungsfunktionen erlauben und dann explizit rollenpruefen.
- Einzelnes Gelesen-Markieren per Notification-ID ergaenzen, pauschales `alle` nur fuer eigene Meldungen.

Status: Offen

### F-052: Zentrale Benachrichtigungserstellung erlaubt beliebige Empfaenger ohne Rollenpruefung

Bereich: Meldungen / Notifications / Empfaengerlogik

Dateien:
- `src/app/api/notifications/route.ts`

Beobachtung:
- `POST /api/notifications` akzeptiert `body.userIds`, `subject`, `body`, `linkTarget` und Eskalationen.
- Die Route prueft aktive Benutzer, aber keine Rolle oder Berechtigung des aufrufenden Benutzers.
- Es ist keine Begrenzung sichtbar, wer Meldungen an wen senden darf.

Risiko:
- Ein Client kann technisch Meldungen an beliebige aktive Benutzer erzeugen.
- Das kann zu Spam, falschen Eskalationen oder manipulierten Arbeitsanweisungen fuehren.

Schweregrad: Hoch

Pruefung:
- Notification-Erstellung auf definierte Systemquellen oder berechtigte Rollen begrenzen.
- Actor aus Session ableiten und protokollieren.
- Fuer fachliche Systemmeldungen eigene interne Funktionen statt offene Universal-API verwenden.

Status: Offen

### F-053: Status-Regeln und alte Eskalationsregeln pruefen Adminrechte ueber requestbasierten actorId

Bereich: Eskalationsregeln / Status-Regeln / Rechte

Dateien:
- `src/app/api/status-rules/route.ts`
- `src/app/api/escalation-rules/route.ts`

Beobachtung:
- Beide Routen lesen `actorId` aus dem Request-Body.
- Danach wird der Benutzer aus der Demo-Userliste gesucht und dessen Rolle fuer Admin/Geschaeftsfuehrung geprueft.
- Eine echte Session-Kopplung ist in diesen Routen nicht sichtbar.

Risiko:
- Wer eine Admin-/GF-User-ID kennt, kann Regeln technisch anlegen, bearbeiten oder loeschen.
- Falsch konfigurierte Regeln koennen Meldungen, Eskalationen und Prioritaeten im gesamten System beeinflussen.

Schweregrad: Hoch

Pruefung:
- Actor serverseitig aus Session ableiten.
- Request-Body-Actor nicht fuer Rechte verwenden.
- Aenderungen an Eskalationsregeln mit Historie/Protokoll erfassen.

Status: Offen

### F-054: Status-Eskalationen erzeugen App- und E-Mail-Notifications, ohne echten Versandstatus zu unterscheiden

Bereich: Status-Eskalationen / Notifications / E-Mail

Dateien:
- `src/app/api/status-escalations/route.ts`

Beobachtung:
- Bei aktiver `dailyReportEnabled` wird eine Notification mit Channel `app_daily_report` erzeugt.
- Danach wird zusaetzlich eine Notification mit Channel `email` erzeugt.
- Es ist in dieser Route kein echter E-Mail-Versand und kein Versandstatus sichtbar.

Risiko:
- Die Historie kann so wirken, als waere eine E-Mail entstanden, obwohl nur ein Notification-Datensatz geschrieben wurde.
- Empfaenger und Management koennen sich auf eine Eskalation verlassen, die technisch nie als Mail zugestellt wurde.

Schweregrad: Mittel

Pruefung:
- Channel `email` nur verwenden, wenn wirklich Versand angestossen oder dokumentiert wurde.
- Alternativ klar zwischen `email_queued`, `email_sent`, `email_failed` und reiner App-Meldung unterscheiden.
- Versandfehler protokollieren und sichtbar machen.

Status: Offen

### F-055: Status-Eskalationen speichern nur eine Notification-ID fuer mehrere Empfaenger

Bereich: Status-Eskalationen / Nachvollziehbarkeit

Dateien:
- `src/app/api/status-escalations/route.ts`
- `prisma/schema.prisma`

Beobachtung:
- `StatusEscalationEvent` hat Felder `recipientUserId` und `notificationId`.
- Die Route erstellt Meldungen fuer mehrere Empfaenger, speichert im Event aber nur `firstNotificationId`.
- `recipientUserId` wird beim Insert nicht gefuellt.

Risiko:
- Spaeter ist nicht belastbar nachvollziehbar, welche konkreten Benutzer die Eskalation erhalten haben.
- Gelesen-/Nicht-gelesen-Auswertungen pro Empfaenger sind nicht sauber moeglich.

Schweregrad: Mittel

Pruefung:
- Entweder ein Event pro Empfaenger speichern oder eine Empfaengerliste/Notification-IDs strukturiert ablegen.
- `recipientUserId` korrekt befuellen oder entfernen, wenn es nicht genutzt werden soll.
- Eskalationshistorie fuer Audit und Nachverfolgung erweitern.

Status: Offen

### F-056: Offene-Arbeitszeiten-Warnungen werden nicht sichtbar aufgeloest

Bereich: Offene Zeiten / Abrechnungshinweise / Notifications

Dateien:
- `src/app/api/unbilled-time-alerts/route.ts`

Beobachtung:
- Die Route legt `UnbilledTimeAlert` fuer Warnung/Eskalation an und verhindert Duplikate ueber `alertKey` und `stage`.
- `getGroups` liest nur Alerts mit `resolvedAt IS NULL`.
- Im geprueften Code ist kein Update sichtbar, das Alerts auf `resolvedAt` setzt, wenn die Zeiten spaeter fakturiert werden.

Risiko:
- Alte Warnungen koennen als offen gespeichert bleiben, obwohl die Ursache erledigt ist.
- Neue Warnlogik kann dadurch falsche Historie oder keine erneute saubere Warnung erzeugen.

Schweregrad: Mittel

Pruefung:
- Beim Fakturieren/Storno/Loesen von Zeiten passende offene Alerts abschliessen.
- In der UI zwischen offen, erledigt und historisch unterscheiden.
- Optional automatische Bereinigung fuer Alerts ohne offene Zeitbasis ergaenzen.

Status: Offen

### F-057: Gerichtete Aufgabenkommentare benachrichtigen trotzdem alle Beteiligten

Bereich: Aufgaben / Kommentare / Notifications

Dateien:
- `src/app/api/tasks/[taskId]/comments/route.ts`

Beobachtung:
- Ein Kommentar kann `recipientUserId` bekommen und wird dann als an diesen Beteiligten gerichtet gespeichert.
- Die Notification-Empfaenger bestehen trotzdem aus Aufgaben-Owner plus allen TaskParticipants minus Actor.
- Der eigentliche Empfaenger wird im Meldungstext genannt, aber nicht exklusiv benachrichtigt.

Risiko:
- Direkt gemeinte Rueckfragen oder sensible Kommentare gehen an mehr Personen als erwartet.
- Nutzer koennen die Funktion als private/gerichtete Nachricht missverstehen.

Schweregrad: Mittel

Pruefung:
- Fachlich entscheiden: gerichteter Kommentar bedeutet nur ein Empfaenger oder sichtbare @Erwaehnung fuer alle.
- UI-Text entsprechend klar machen.
- Falls exklusiv: Notification-Empfaenger bei gesetztem `recipientUserId` begrenzen.

Status: Offen

### F-058: Mitarbeiter- und Teamverwaltung verlassen sich weiter auf request-basierte Actor-IDs

Bereich: Mitarbeiterverwaltung / Rollen / Teams / Rechte

Dateien:
- `src/app/api/users/route.ts`
- `src/app/api/teams/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Benutzeranlage, Benutzerbearbeitung, Aktiv/Inaktiv, Entfernen und Teamverwaltung bestimmen den Actor ueber `body.actorId`.
- Das Frontend sendet dafuer `activeUserId`; dieser Wert kann im Client gewechselt oder per direktem API-Aufruf beliebig gesetzt werden.
- Die Rollenpruefung ist fachlich vorhanden, aber nicht an eine echte serverseitige Session gebunden.

Risiko:
- Rollen, Teams, Planungszustaendigkeiten, Mitarbeiterprofile, Mailkonto-Daten, Signaturen und Aktivstatus koennen potenziell mit einer fremden Actor-ID geaendert werden.
- Audit- und Verantwortungslogik ist nicht belastbar, wenn der ausfuehrende Benutzer aus dem Request kommt.

Schweregrad: Kritisch

Pruefung:
- Aktiven Nutzer serverseitig aus echter Session/Auth ableiten.
- `actorId` fuer Rechteentscheidungen ignorieren oder nur noch als Anzeige-/Debugwert nutzen.
- Mitarbeiter- und Teamaktionen mit echtem Actor, Zeitstempel und Aenderungsart protokollieren.

Status: Offen

### F-059: Team-Bearbeitung schreibt vor der Organisationspruefung

Bereich: Mitarbeiterverwaltung / Teams / Mandantenschutz

Dateien:
- `src/app/api/teams/route.ts`

Beobachtung:
- `PATCH /api/teams` fuehrt `prisma.team.update({ where: { id: body.teamId } })` aus.
- Erst danach wird geprueft, ob `team.organizationId !== organization.id`.
- `DELETE` prueft die Organisation vor dem Loeschen, `PATCH` nicht.

Risiko:
- Falls eine fremde oder falsche Team-ID bekannt ist, kann der Teamname bereits geaendert sein, bevor die Route mit 403 antwortet.
- Das ist ein Mandanten-/Datenintegritaetsproblem und fuehrt zu schwer nachvollziehbaren Aenderungen.

Schweregrad: Hoch

Pruefung:
- Team vor dem Update per `findFirst({ id, organizationId })` laden.
- Erst nach erfolgreicher Organisationspruefung speichern.
- Einheitliches Muster wie bei `DELETE` verwenden.

Status: Offen

### F-060: Abwesenheitsantraege und Freigaben koennen ueber request-basierte Identitaet gefaelscht wirken

Bereich: Mitarbeiterverwaltung / Abwesenheiten / Vertretung / Freigabe

Dateien:
- `src/app/api/absences/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- `POST`, `PATCH` und `DELETE` bestimmen den Actor ueber `body.actorId`.
- Die Route prueft fachlich Vertreter, Fuehrungsrolle und Eigen-/Fremdbearbeitung, aber auf Basis dieser request-basierten Identitaet.
- `GET /api/absences` liefert alle Abwesenheiten der Organisation im Zeitraum ohne sichtbare Rollenbegrenzung.

Risiko:
- Abwesenheiten, Vertreterannahmen, finale Genehmigungen, Ablehnungen und Loeschungen koennen im Audittrail unter falschem Namen erscheinen.
- Mitarbeiter koennen potenziell Abwesenheitsdaten anderer Mitarbeiter lesen, wenn sie die Route direkt aufrufen.
- Einsatzplanung, Vertretungslogik und Meldungen koennen dadurch fachlich falsch werden.

Schweregrad: Hoch

Pruefung:
- Actor aus echter Session bestimmen.
- Lesen nach Rolle begrenzen: eigene Abwesenheiten fuer Mitarbeiter, Team-/Gesamtansicht nur fuer berechtigte Rollen.
- Jede Genehmigungs-/Ablehnungsaktion mit echtem Actor und Statuswechsel protokollieren.

Status: Offen

### F-061: Bearbeiten einer Abwesenheit kann den betroffenen Mitarbeiter austauschen

Bereich: Mitarbeiterverwaltung / Abwesenheiten / Datenintegritaet

Dateien:
- `src/app/api/absences/route.ts`

Beobachtung:
- Beim Bearbeiten wird zuerst anhand der bestehenden Abwesenheit geprueft, ob der Actor diese bearbeiten darf.
- Danach werden die alten Abwesenheitszeilen geloescht und neue Zeilen mit `targetUserId` aus dem Request angelegt.
- Dadurch kann ein Antrag beim Bearbeiten auf einen anderen Mitarbeiter umgeschrieben werden.

Risiko:
- Abwesenheitskalender, Vertretungen, Historie und Benachrichtigungen koennen einem falschen Mitarbeiter zugeordnet werden.
- Fuer normale Bearbeitung ist ein Wechsel des betroffenen Mitarbeiters fachlich riskant und sollte mindestens explizit geschuetzt sein.

Schweregrad: Hoch

Pruefung:
- Bei normaler Bearbeitung `targetUserId` auf `existingAbsence.userId` fixieren.
- Falls Umhaengen fachlich erlaubt sein soll: nur Admin/Geschaeftsfuehrung, mit separater Aktion und Historieneintrag.
- Konfliktpruefung fuer Zielmitarbeiter und Zielzeitraum vor dem Loeschen alter Zeilen ausfuehren.

Status: Offen

### F-062: Planungsboard-Eintraege haben keine sichtbare serverseitige Rollen- und Mitarbeiterpruefung

Bereich: Mitarbeiterverwaltung / Planung / Kapazitaet / Notifications

Dateien:
- `src/app/api/planning-entries/route.ts`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- `POST /api/planning-entries` akzeptiert `userId`, `employeeName`, `approvalStatus`, `requestedByUserId`, `approvedByUserId`, `actorUserId` und `actorName` aus dem Request.
- Es ist keine sichtbare Rollenpruefung vorhanden, wer Planungseintraege fuer wen anlegen, bestaetigen, bearbeiten oder loeschen darf.
- `DELETE` schreibt Historie ebenfalls mit `actorUserId` und `actorName` aus Queryparametern.

Risiko:
- Mitarbeiter koennen potenziell fuer andere Personen Termine eintragen, bestaetigen oder loeschen.
- Planungsfreigaben und Konfliktmeldungen wirken offiziell, obwohl der Actor nicht serverseitig verifiziert wurde.
- Kapazitaet, Doppelverplanung, Projektplanung und Mitarbeiterberichte koennen aktiv verfaelscht werden.

Schweregrad: Kritisch

Pruefung:
- Planungsrechte serverseitig klaeren: eigene Terminwuensche vs. Planungsverantwortliche vs. Admin.
- `approvedByUserId`, `requestedByUserId` und Historien-Actor serverseitig setzen.
- Zielmitarbeiter gegen aktive Mitarbeiter der Organisation pruefen.
- Loeschen und Aendern nur fuer berechtigte Rollen oder eigene noch nicht freigegebene Terminwuensche erlauben.

Status: Offen

### F-063: Es gibt mehrere konkurrierende Modal-Systeme

Bereich: Design / UX / Modale

Dateien:
- `src/components/dashboard/dashboard.module.css`
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Es existieren alte Klassen wie `.overlay` und `.modal`, spaeter erneut ueberschrieben, plus neuere Klassen wie `.modalOverlay`, `.standardModal`, `.standardModalHeader`, `.standardModalBody` und `.standardModalFooter`.
- Einzelne neue Fachfunktionen nutzen bereits `standardModal`, andere Bereiche greifen weiter auf alte Modal- oder Overlay-Klassen zurueck.
- Dadurch koennen Abstaende, Header, Footer, Scrollverhalten, z-Index und Schliessen-Verhalten je nach Maske unterschiedlich sein.

Risiko:
- Masken wirken uneinheitlich und koennen bei langen Formularen, kleinen Bildschirmen oder gestapelten Modalen schwer bedienbar werden.
- Fehler- und Speichern-Hinweise erscheinen nicht immer an derselben Stelle.

Schweregrad: Mittel

Pruefung:
- Einen Modal-Standard festlegen und alte `.modal`/`.overlay`-Nutzung schrittweise ersetzen.
- Header, Body, Footer, Close-Button, Fehlerbereich und Scrollverhalten zentral vereinheitlichen.
- Kritische Modale auf kleiner Bildschirmhoehe testen.

Status: Offen

### F-064: Kritische Aktionen nutzen haeufig native Browser-Dialoge statt App-Modale

Bereich: Design / UX / Riskante Aktionen

Dateien:
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Viele Loesch-, Storno-, Versand- und Statusaktionen nutzen `window.confirm`, `window.alert` oder `window.prompt`.
- Betroffen sind unter anderem Inhalte loeschen, Mahnung, Angebot loeschen/wieder aktivieren, Rechnung/Storno, Dokumente/Bilder loeschen, Abwesenheit loeschen, Planung loeschen, Team/Gewerk/Mitarbeiter deaktivieren und Zeiteintraege loeschen.
- Die App hat parallel bereits eigene Modal-Strukturen.

Risiko:
- Browser-Dialoge sind optisch und fachlich nicht konsistent, koennen wichtige Details schlecht darstellen und sind fuer Nutzer schwerer nachvollziehbar.
- Kritische Aktionen bekommen keine einheitlichen Pflichtfelder wie Grund, Hinweistext oder zweite Sicherheitsabfrage.
- Fehler werden teils per `alert`, teils als Seitenmeldung angezeigt.

Schweregrad: Mittel

Pruefung:
- Kritische Aktionen in App-eigene Confirm-Modale ueberfuehren.
- Pro Aktion Titel, Auswirkung, betroffene Daten, optional Grundfeld und klare Primaer-/Abbruchaktion anzeigen.
- Fehler und Erfolgsmeldungen einheitlich im Modal/Footer oder als App-Hinweis anzeigen.

Status: Offen

### F-065: Alter Content-Management-Bereich ist weiterhin in Navigation und Rendering aktiv

Bereich: Design / UX / Produktstruktur

Dateien:
- `src/components/dashboard/dashboard-page.tsx`
- `src/components/dashboard/dashboard.module.css`

Beobachtung:
- `contentManagement`, `contentRound`, `editorialPlan`, `contentApprovals`, `contentCorrections`, `contentQuotas` und `ideaStore` sind weiter als `AppTab` vorhanden.
- Die Sidebar rendert weiterhin den Bereich `Content-Management` mit Unterpunkten.
- `renderContentManagement()` wird fuer diese Tabs weiterhin aufgerufen.

Risiko:
- Nutzer sehen oder erreichen Funktionen, die fachlich nicht mehr gewollt sind.
- Der neue Projektbereich `Marketing-Kontingente` und alte Content-Seiten koennen parallel existieren und unterschiedliche Arbeitsweisen suggerieren.
- Wartungsaufwand und Verwirrung steigen, wenn veraltete UI-Bereiche nicht konsequent entfernt oder umbenannt werden.

Schweregrad: Mittel

Pruefung:
- Fachlich entscheiden, welche Content-Funktionen wirklich bleiben sollen.
- Falls der Bereich raus soll: Tabs, Navigation, Rendering, State, API-Aufrufe und Styles sauber entfernen oder verstecken.
- Falls einzelne Teile bleiben sollen, klar in neue Marketing-/CRM-Logik einsortieren.

Status: Offen

### F-066: Bild- und Dokumentvorschau ist uneinheitlich angebunden

Bereich: Projektakte / Kundenakte / Bilder / Dokumente / UX

Dateien:
- `src/components/dashboard/dashboard-page.tsx`

Beobachtung:
- Projektbilder und manche Projektdokumente nutzen `openAttachmentDataUrl()` mit eigenem Vorschaufenster und Popup-Fehlerhinweis.
- Andere Dokumentlisten, z. B. in der Kunden-/Projekt-Dokumentansicht, oeffnen `attachment.dataUrl` direkt per `<a target="_blank">`.
- Dadurch gibt es unterschiedliche Vorschauwege fuer technisch gleiche Anhaenge.

Risiko:
- Nutzer koennen je nach Stelle ein leeres Browserfenster sehen, ohne hilfreiche Fehlermeldung.
- Popup-Blocker, sehr lange Data-URLs oder Browserverhalten werden nicht ueberall gleich behandelt.
- Supportfaelle sind schwerer nachzustellen, weil gleiche Dateiarten unterschiedlich geoeffnet werden.

Schweregrad: Mittel

Pruefung:
- Alle Bild-/Dokumentoeffnungen ueber eine gemeinsame Preview-Funktion fuehren.
- Bei Fehlern im Programm eine klare Meldung anzeigen.
- Optional spaeter eine echte In-App-Vorschau statt neuem Browserfenster nutzen.

Status: Offen

## Fix-Roadmap

Diese Roadmap schneidet die Auditbefunde in sichere Umsetzungspakete. Grundregel fuer jede Codephase:

- Vor jeder Codeaenderung werden die konkret betroffenen Dateien in `.codex-safety` gesichert.
- Vor der Aenderung wird `git status --short` geprueft, damit keine fremden Aenderungen versehentlich ueberschrieben werden.
- Es werden keine Tabellen, APIs, Verknuepfungen oder Funktionen geloescht, ohne dass der betroffene Zusammenhang vorher gelesen und benannt wurde.
- Nach jeder Phase laufen die passenden Checks: mindestens Build/Typecheck, je nach Bereich zusaetzlich Prisma-/DB-Warncheck oder gezielter Funktionstest.
- Jede Phase bleibt klein genug, damit ein Fehler eindeutig zugeordnet werden kann.

### Phase 1: Rechte- und Actor-ID-Basis

Ziel:
- Request-basierte `actorId`/`userId` nicht mehr fuer echte Berechtigungen verwenden.
- Aktiven Nutzer serverseitig eindeutig bestimmen.
- Kritische Schreibaktionen serverseitig nach Rollen absichern.

Primaere Findings:
- F-001, F-010, F-011, F-013, F-014, F-015, F-016, F-018, F-024, F-028, F-029, F-030, F-031, F-032, F-044, F-048, F-051, F-052, F-053, F-058, F-060, F-062

Empfohlene Reihenfolge:
1. Gemeinsamen Server-Helper fuer aktuellen Nutzer und Rollenpruefung definieren.
2. Notifications absichern, weil dort fremde Meldungen gelesen/markiert werden koennen.
3. Mitarbeiter/Teams absichern, weil Rollen und Aktivstatus daran haengen.
4. Stempelung, Projektzeiten und Planungsboard absichern, weil diese Daten Kosten, Auswertungen und Abrechnung beeinflussen.
5. Rechnungs- und Dokumentversand-Aktionen absichern.

Checks:
- `npm run build`
- gezielte API-Tests fuer erlaubte/verbotene Rollen
- manueller Test: normaler Mitarbeiter darf keine fremden Daten schreiben

### Phase 2: Finanz- und Datenintegritaet

Ziel:
- Rechnungen, Storno, Mahnungen, Auswertungen und Monatsbericht duerfen keine falschen Werte erzeugen.
- Stornierte/geloeschte/Entwurfsdaten werden in Kennzahlen einheitlich behandelt.

Primaere Findings:
- F-005, F-006, F-023, F-025, F-026, F-027, F-041, F-042, F-044, F-045, F-046, F-047, F-049, F-050

Empfohlene Reihenfolge:
1. Einheitliche Rechnungsstatus-Klassifikation zentralisieren.
2. Storno transaktional absichern.
3. Auswertungen auf dieselbe Rechnungslogik bringen.
4. E-Rechnung nur nach erfolgreicher KoSIT-Validierung fuer Versand freigeben.

Checks:
- `npm run build`
- Prisma/DB-Warncheck vor jedem Push
- Testfall: Rechnung fakturiert, storniert, neu erstellt; Auswertungen muessen korrekt reagieren
- KoSIT-Smoke-Test auf Serverumgebung

### Phase 3: Kundenakte, Projektakte und Dokumente

Ziel:
- Aktenverknuepfungen, Logbuch, Bilder, Dokumente und Hinweise belastbar machen.
- Keine verschwundenen Bilder/Dokumente, keine falschen Zaehler, keine uneinheitliche Vorschau.

Primaere Findings:
- F-002, F-007, F-017, F-033, F-034, F-035, F-036, F-037, F-061, F-066

Empfohlene Reihenfolge:
1. Kunden-/Projektverknuepfungen konsequent ueber IDs fuehren.
2. Logbuchanhaenge und Bilder/Dokumente robuster adressieren.
3. Vorschau fuer Bilder/Dokumente vereinheitlichen.
4. Hinweise und Zaehler serverseitig verlaesslicher machen.

Checks:
- `npm run build`
- Upload, Verschieben, Loeschen und Oeffnen von Bildern/Dokumenten
- PWA-Bildupload und automatische Aktualisierung im Hauptprogramm

### Phase 4: Artikel, Leistungen, Pakete und Kalkulation

Ziel:
- Stammdaten, Paketbestandteile und Kosten-Snapshots so absichern, dass bestehende Angebote/Rechnungen nachvollziehbar bleiben.

Primaere Findings:
- F-003, F-008, F-009, F-038, F-039, F-040, F-041, F-042, F-043

Empfohlene Reihenfolge:
1. Katalogrechte absichern.
2. Paket- und Angebotspositionen transaktional speichern.
3. Snapshots fuer Preise/Kosten sauber definieren.
4. Mitarbeiter-/Stundenplanung in Angeboten fachlich entscheiden.

Checks:
- `npm run build`
- Angebot aus Paket erstellen, Paket danach aendern, altes Angebot pruefen
- Rechnung aus Angebot erstellen, Kosten-/Preiswerte vergleichen

### Phase 5: UX-Aufraeumen

Ziel:
- Einheitliche Bedienung, weniger leere Fenster, weniger Browser-Dialoge, klare Navigation.

Primaere Findings:
- F-020, F-021, F-022, F-037, F-063, F-064, F-065, F-066

Empfohlene Reihenfolge:
1. Alten Content-Management-Bereich fachlich entscheiden und dann entfernen/verstecken oder sauber umhaengen.
2. Ein Standard-Modal fuer neue und kritische Aktionen durchsetzen.
3. Browser-Confirm/Alert/Prompt schrittweise durch App-Modale ersetzen.
4. Aktive Navigation, Zaehler und Leerzustaende vereinheitlichen.

Checks:
- `npm run build`
- manuelle Klickstrecke durch Kundenakte, Projektakte, Buchhaltung, Mitarbeiter und Auswertungen
- Sichtpruefung Desktop und kleine Bildschirmhoehe

## Phase-1-Uebergabe: Rechte- und Actor-ID-Absicherung

Stand: 2026-06-20

Ziel dieser Phase:
- Produktive API-Routen duerfen kritische Daten nicht mehr nur aufgrund frei mitgesendeter Benutzerwerte lesen, schreiben oder loeschen.
- Schreibende Aktionen und sensible Leseaktionen sollen einen aktiven Actor aus der Demo-Organisation verlangen.
- Historien-, Kommentar-, Status- und Bearbeitungswerte sollen soweit moeglich vom serverseitig geprueften Actor kommen, nicht aus frei editierbaren Request-Feldern.

Abgesichert:
- Meldungen, Aufgaben, Kommentare, Aufgabenzeiten, Status-Timeline, Status-Regeln, Eskalationen und offene-Zeit-Hinweise.
- Benutzer, Teams, Abwesenheiten, Planungseintraege, Stempel-Sessions, Projektzeit-Eintraege, Lohnkosten und Mitarbeiterbeurteilungen.
- Kontakte, Angebote, Rechnungen, Dokumentenmail, Dokumenttexte, Dokumenttypen, Positionssuche, Katalogartikel, Einheiten, Gewerke und Bereichsziele.
- Projektnahe Bereiche wie Hero-Projekte, Projektimport, Projektlogbuch, Projekt-Marketing-Kontingente, Kunden-Projektnotizen und Endabnahmen.
- Sales-Bereiche wie Potenziale, Sales-Ziele, Sales-Opportunities und Sales-Aktivitaeten.
- Interne Kundenfeedback-Routen, News-Feed inklusive Kommentare/Reaktionen/Abstimmungen, Winterdienst-Routen, Monatsbericht, Legacy-Rechnungen, Arbeitsstunden-Auswertung und Rauchmelderberichte.
- Mail-OAuth-Start und -Callback pruefen jetzt Actor und Zielbenutzer, bevor eine Verbindung vorbereitet oder gespeichert wird.

Bewusste Sonderfaelle:
- `src/app/api/auth/login/route.ts`: Login kann vor der Anmeldung noch keinen Actor haben. Deshalb keine Actor-Pflicht, nur robustere JSON-Behandlung.
- `src/app/api/public-feedback/[token]/route.ts`: Externes Kundenfeedback muss weiter per Token funktionieren. Deshalb keine interne Actor-Pflicht, nur robustere JSON-Behandlung.
- `src/app/api/content-items/route.ts`, `src/app/api/idea-store/route.ts`, `src/app/api/marketing-content/route.ts`: Diese Content-Management-Routen sind aktuell als deaktivierter Altbereich dokumentiert. Sie gelten nicht als produktiv fertig abgesichert und muessen bei Reaktivierung neu geplant werden.

Abschlusschecks:
- `npm.cmd run build` bestanden.
- `npx.cmd prisma validate` bestanden.
- `npm.cmd run check:mojibake` bestanden.
- `git diff --check` bestanden.
- Kein `prisma db push` im Abschluss, weil der letzte Abschlussvermerk keine neue Schemaaenderung eingefuehrt hat.

Wichtige Einordnung:
- Phase 1 reduziert das Risiko, dass ein Klick oder eine frei veraenderte Anfrage unkontrolliert Daten veraendert.
- Phase 1 ersetzt noch keine vollstaendige Rollenmatrix. Die naechste sinnvolle Phase ist daher: pro Bereich festlegen, welche Rolle welche Aktion ausfuehren darf, und diese Regeln serverseitig pruefen.
- Die vielen Dateien in `.codex-safety` bleiben als Rueckfall- und Vergleichspunkte erhalten.

Empfohlener naechster Schritt:
1. Phase 2 als Rollen-/Berechtigungsmatrix starten.
2. Zuerst die kritischsten Bereiche priorisieren: Rechnungen, Angebote, Benutzer/Teams, Lohnkosten, Projektzeiten, Stempelung und Auswertungen.
3. Danach UI-Sichtbarkeit und Serverrechte angleichen, damit Buttons nicht nur verschwinden, sondern Aktionen auch serverseitig sicher geblockt werden.

## Phase-2-Start: Angebotsrechte

Stand: 2026-06-20

Umgesetzt:
- Zentrale Angebotsrechte in `src/lib/permissions/index.ts` ergaenzt.
- `src/app/api/offers/route.ts` nutzt diese Rechte fuer schreibende Aktionen.
- Angebote anlegen, bearbeiten, gewinnen/verloren setzen und wiederherstellen: Admin, Geschaeftsfuehrung, Fuehrungskraft und Vertrieb.
- Angebote loeschen: Admin und Geschaeftsfuehrung.
- Lesen, PDF-Oeffnen und Vorschau wurden bewusst nicht veraendert.

Warum:
- Phase 1 hat sichergestellt, dass ein aktiver Actor mitgesendet und geprueft wird.
- Phase 2 legt jetzt fest, was dieser Actor fachlich darf.
- Bei Angeboten ist der erste sichere Schritt, normale Mitarbeitende, Gaeste und Buchhaltung von Angebots-Schreibaktionen auszuschliessen.

Checks:
- `git diff --check -- src/lib/permissions/index.ts src/app/api/offers/route.ts`
- `npm.cmd run build`
- `npx.cmd prisma validate`
- `npm.cmd run check:mojibake`

Naechster sinnvoller Schritt:
- Dieselbe Rollenlogik fuer Rechnungsaktionen sauber zentralisieren und dabei bestehende Regeln wie Geschaeftsfuehrung-only fuer Loeschungen erhalten.

## Phase-2-Fortsetzung: Rechnungsrechte

Stand: 2026-06-20

Umgesetzt:
- Zentrale Rechnungsrechte in `src/lib/permissions/index.ts` ergaenzt.
- `src/app/api/invoices/route.ts` nutzt diese Rechte fuer schreibende Rechnungsaktionen.
- Rechnungen anlegen, bearbeiten, fakturieren, stornieren, als bezahlt markieren, Mahnungen erfassen/erstellen und Druckhistorie schreiben: Admin, Geschaeftsfuehrung, Fuehrungskraft und Buchhaltung.
- Rechnungen loeschen: weiterhin nur Geschaeftsfuehrung.
- Lesen, PDF-Oeffnen, XRechnung-Download und Vorschau-PDF wurden bewusst nicht veraendert.

Warum:
- Rechnungen sind ein kritischer Finanzbereich. Phase 2 muss hier nicht nur einen aktiven Actor verlangen, sondern dessen Rolle fachlich begrenzen.
- Vertrieb, normale Mitarbeitende und Gast sollen keine Rechnungsdaten veraendern koennen, auch wenn technisch eine Anfrage ausgeloest wird.
- Die bestehende strengere Loeschregel bleibt erhalten, damit keine Berechtigung versehentlich erweitert wird.

Checks:
- `git diff --check -- src/lib/permissions/index.ts src/app/api/invoices/route.ts`
- `npm.cmd run build`
- `npx.cmd prisma validate`
- `npm.cmd run check:mojibake`

Naechster sinnvoller Schritt:
- Benutzer-/Teamverwaltung als naechsten kritischen Rollenbereich pruefen, weil dort Rollen, Aktivstatus, Teams und Mitarbeiterdaten geaendert werden.

## Phase-2-Fortsetzung: Benutzer- und Teamrechte

Stand: 2026-06-20

Umgesetzt:
- Vorhandene Benutzer-/Team-Rechte in `src/lib/permissions/index.ts` zentralisiert.
- `src/app/api/users/route.ts` nutzt die zentrale Regel fuer Benutzerverwaltung und Personalnummern.
- `src/app/api/teams/route.ts` nutzt die zentrale Regel fuer Teamverwaltung.
- Benutzer und Teams verwalten: Admin und Geschaeftsfuehrung.
- Personalnummer aendern: Geschaeftsfuehrung.
- Eigene Einstellungen bearbeiten: bleibt erhalten.
- Mitarbeiter-Emulation im Dashboard: bleibt unveraendert.

Warum:
- Rollen, Aktivstatus, Teamzuordnung und Personalnummern sind sicherheits- und abrechnungsrelevant.
- Die Regeln waren bereits vorhanden, aber lokal verteilt. Durch die Zentralisierung wird die Rollenmatrix nachvollziehbarer, ohne den fachlichen Umfang zu veraendern.

Checks:
- `git diff --check -- src/lib/permissions/index.ts src/app/api/users/route.ts src/app/api/teams/route.ts`
- `npm.cmd run build`
- `npx.cmd prisma validate`
- `npm.cmd run check:mojibake`

Naechster sinnvoller Schritt:
- Lohnkosten und Mitarbeiterbeurteilungen als naechsten Mitarbeiterverwaltungsblock pruefen, weil dort sensible Personaldaten betroffen sind.

## Phase-2-Fortsetzung: Sensible Personaldaten

Stand: 2026-06-20

Umgesetzt:
- Rechte fuer Mitarbeiterbeurteilungen in `src/lib/permissions/index.ts` zentralisiert.
- `src/app/api/employee-assessments/route.ts` nutzt die zentrale Managerregel.
- Rechte fuer Lohnkosten in `src/lib/permissions/index.ts` zentralisiert.
- `src/app/api/employee-costs/route.ts` nutzt die zentrale Lohnkostenregel.
- Beurteilungen verwalten: Admin und Geschaeftsfuehrung.
- Eigene Selbsteinschaetzung und eigener DISG-Fragebogen: bleiben fuer den jeweiligen Mitarbeiter erhalten.
- Lohnkosten: bisherige enge Freigabe fuer Ramona Eid und Christian Eid wurde bewusst beibehalten.

Warum:
- Beurteilungen und Lohnkosten sind sensible Personaldaten.
- Die Beurteilungslogik war bereits rollenbasiert, aber lokal in der API definiert.
- Die Lohnkostenlogik ist fachlich besonders kritisch. Deshalb wurde sie zuerst zentralisiert, aber nicht still auf weitere Rollen erweitert.

Checks:
- `git diff --check -- src/lib/permissions/index.ts src/app/api/employee-costs/route.ts src/app/api/employee-assessments/route.ts`
- `npx.cmd prisma validate`
- `npm.cmd run check:mojibake`
- `npm.cmd run build`

Hinweis:
- Der erste Buildlauf brach einmal ohne konkrete Codezeile mit einem Next/Jest-Worker-Fehler ab. Der direkte Wiederholungslauf bestand vollstaendig.

Naechster sinnvoller Schritt:
- Projektzeiten, Stempelung und manuelle Zeitkorrekturen als naechsten sensiblen operativen Block pruefen.

## Phase-2-Fortsetzung: Projektzeiten und Zeitkorrekturen

Stand: 2026-06-20

Umgesetzt:
- Projektzeitrechte in `src/lib/permissions/index.ts` zentralisiert.
- `src/app/api/project-time-entries/route.ts` nutzt die zentrale Regel fuer verwaltete Projektzeit-Korrekturen.
- Verwaltete Projektzeitaktionen fuer andere Personen: Admin, Geschaeftsfuehrung, Fuehrungskraft und Buchhaltung.
- Ueberstundenfreigabe: Admin, Geschaeftsfuehrung und Fuehrungskraft.
- Eigene manuelle Zeiteintraege: bleiben fuer normale Nutzer erlaubt.
- Stempel-Start/Pause/Stop in `src/app/api/stamp-session/route.ts`: in diesem Block nicht fachlich veraendert.

Warum:
- Projektzeiten wirken auf Abrechnung, Soll/Ist-Auswertung, SVS und interne Kosten.
- Manuelle Nachtraege muessen weiterhin moeglich sein, duerfen aber nicht zu einer freien Bearbeitung fremder Zeiten werden.
- Die vorhandene Fachregel war bereits sinnvoll und wurde deshalb zentralisiert statt veraendert.

Checks:
- `git diff --check -- src/lib/permissions/index.ts src/app/api/project-time-entries/route.ts src/app/api/stamp-session/route.ts`
- `npm.cmd run build`
- `npx.cmd prisma validate`
- `npm.cmd run check:mojibake`

Naechster sinnvoller Schritt:
- Aufgaben, Aufgabenzeiten und Aufgabenkommentare als naechsten Rollenblock pruefen, weil sie Projektsteuerung und Mitarbeiterzuordnung betreffen.

## Phase-2-Fortsetzung: Aufgaben und Aufgabenzeiten

Stand: 2026-06-20

Umgesetzt:
- Aufgabenrechte in `src/lib/permissions/index.ts` zentralisiert.
- `src/app/api/tasks/route.ts` nutzt die zentrale Regel fuer Fremdzuweisung, Loeschen und Wiederherstellen.
- `src/app/api/tasks/[taskId]/time-entries/route.ts` nutzt die zentrale Regel fuer verwaltete Aufgabenzeiten.
- Aufgaben anderen Personen zuweisen: Admin, Geschaeftsfuehrung und Fuehrungskraft.
- Aufgaben loeschen/wiederherstellen: Admin und Geschaeftsfuehrung.
- Aufgabenzeiten verwalten: Admin, Geschaeftsfuehrung und Fuehrungskraft.
- Kommentare und Annahme/Ablehnung blieben fachlich erhalten: Owner, Ersteller, Beteiligte bzw. berechtigte Uebergabe-/Teilnehmerlogik.

Warum:
- Aufgaben steuern Zuständigkeiten, Fristen, Vertreteruebergaben und Projektarbeit.
- Die bestehenden Regeln waren sinnvoll, aber lokal verteilt. Durch die Zentralisierung ist die Rollenmatrix nachvollziehbarer.

Checks:
- `git diff --check -- src/lib/permissions/index.ts src/app/api/tasks/route.ts src/app/api/tasks/[taskId]/time-entries/route.ts src/app/api/tasks/[taskId]/comments/route.ts src/app/api/tasks/respond/route.ts`
- `npm.cmd run build`
- `npx.cmd prisma validate`
- `npm.cmd run check:mojibake`

Naechster sinnvoller Schritt:
- Stammdatenrechte fuer Katalogartikel, Einheiten und Gewerke pruefen, weil diese Daten Angebote, Rechnungen und Kalkulation beeinflussen.

## Phase-2-Fortsetzung: Stammdatenrechte

Stand: 2026-06-20

Umgesetzt:
- Stammdatenrechte in `src/lib/permissions/index.ts` zentralisiert.
- `src/app/api/catalog-items/route.ts` nutzt jetzt eine zentrale Rollenregel fuer Katalog-Schreibaktionen.
- `src/app/api/units/route.ts` nutzt jetzt die zentrale Rollenregel fuer Einheiten.
- `src/app/api/trades/route.ts` nutzt jetzt die zentrale Rollenregel fuer Gewerke.
- Katalogartikel, Einheiten und Gewerke lesen: bleibt fuer aktive Benutzer moeglich.
- Katalogartikel, Einheiten und Gewerke anlegen, bearbeiten oder deaktivieren/loeschen: Admin und Geschaeftsfuehrung.

Warum:
- Katalogartikel wirken direkt in Angebote, Rechnungen, Pakete, Planung und Kalkulation.
- Einheiten und Gewerke beeinflussen Positionen, Projektstruktur und Auswertungen.
- Einheiten und Gewerke hatten die passende Regel bereits lokal. Katalogartikel hatten eine Actor-Pruefung, aber noch keine zentrale Rollenbremse fuer Schreibaktionen.

Checks:
- `git diff --check -- src/lib/permissions/index.ts src/app/api/catalog-items/route.ts src/app/api/units/route.ts src/app/api/trades/route.ts`
- `npm.cmd run build`
- `npx.cmd prisma validate`

Naechster sinnvoller Schritt:
- Projekt- und Planungsstammdaten pruefen, insbesondere Business-Area-Ziele, Projekt-Marketing-Quoten und Status-/Eskalationsregeln.

## Phase-2-Fortsetzung: Projekt- und Planungsregeln

Stand: 2026-06-20

Umgesetzt:
- Projekt-/Planungsregel-Rechte in `src/lib/permissions/index.ts` zentralisiert.
- `src/app/api/business-area-targets/route.ts` nutzt die zentrale Regel fuer Geschaeftsbereich-Sollwerte.
- `src/app/api/project-marketing-quotas/route.ts` nutzt die zentrale Regel fuer Marketing-Kontingent-Konfiguration.
- `src/app/api/planning-entries/route.ts` nutzt die zentrale Regel fuer Planungsverwaltung.
- `src/app/api/status-rules/route.ts` nutzt die zentrale Regel fuer Status-Regeln.
- `src/app/api/escalation-rules/route.ts` nutzt die zentrale Regel fuer Eskalationsregeln.
- `src/app/api/status-escalations/route.ts` nutzt die zentrale Regel fuer den Status-Eskalationslauf.
- `src/app/api/status-timeline/route.ts` nutzt die zentrale Regel fuer den Neuaufbau der Status-Zeitlinie.

Rollen:
- Geschaeftsbereich-Sollwerte pflegen: Admin und Geschaeftsfuehrung.
- Marketing-Kontingente konfigurieren: Admin und Geschaeftsfuehrung.
- Status-Regeln und Eskalationsregeln verwalten: Admin und Geschaeftsfuehrung.
- Planung verwalten, Status-Eskalationen ausloesen und Status-Zeitlinie neu aufbauen: Admin, Geschaeftsfuehrung und Fuehrungskraft.
- Marketing-Kontingente operativ abhaken/zuruecksetzen: fachlich unveraendert, weil das kein Stammdaten-Setup ist.

Warum:
- Diese Regeln beeinflussen Auswertungen, Planungsfreigaben, Sollwerte und automatische Eskalationen.
- Mehrere Regeln waren bereits sinnvoll, aber lokal in einzelnen APIs verteilt.
- Die Marketing-Kontingent-Konfiguration hatte Actor-Pruefung, aber noch keine Rollenbremse fuer das Aendern der Kontingent-Stammdaten.

Checks:
- `git diff --check -- src/lib/permissions/index.ts src/app/api/business-area-targets/route.ts src/app/api/project-marketing-quotas/route.ts src/app/api/planning-entries/route.ts src/app/api/status-rules/route.ts src/app/api/escalation-rules/route.ts src/app/api/status-escalations/route.ts src/app/api/status-timeline/route.ts`
- `npm.cmd run build`
- `npx.cmd prisma validate`
- `npm.cmd run check:mojibake`

Naechster sinnvoller Schritt:
- Vertriebs-/Sales-Bereich pruefen, insbesondere Potenziale, Sales-Ziele und Sales-Opportunities, weil diese Rechte Angebote, Pipeline und Verantwortlichkeiten beeinflussen.

## Phase-2-Fortsetzung: Sales- und Vertriebsrechte

Stand: 2026-06-20

Umgesetzt:
- Sales-/Vertriebsrechte in `src/lib/permissions/index.ts` zentralisiert.
- `src/app/api/sales-targets/route.ts` nutzt die zentrale Regel fuer Sales-Ziele.
- `src/app/api/sales-opportunities/route.ts` nutzt die zentrale Regel fuer Verkaufschancen.
- `src/app/api/sales-opportunities/activities/route.ts` nutzt die zentrale Regel fuer Verkaufschancen-Aktivitaeten.
- `src/app/api/potentials/route.ts` nutzt die zentrale Regel fuer Zusatzverkaufs-Potenziale.
- Verkaufschancen-Aktivitaeten pruefen jetzt, ob die Verkaufschance in derselben Organisation existiert.

Rollen:
- Sales-Ziele, Verkaufschancen und Verkaufschancen-Aktivitaeten bearbeiten: Admin, Geschaeftsfuehrung, Fuehrungskraft und Vertrieb.
- Vertrieb: eigene Sales-Datensaetze bearbeiten.
- Admin, Geschaeftsfuehrung und Fuehrungskraft: Sales-Datensaetze uebergreifend bearbeiten und anderen Personen zuweisen.
- Potenziale anlegen: bleibt fuer aktive Nicht-Gast-Benutzer moeglich, damit operative Zusatzverkaufs-Hinweise aus Projekten/Abnahmen nicht verloren gehen.
- Potenziale bearbeiten: Sales-Rollen uebergreifend bzw. der zustaendige Sales-Owner.

Warum:
- Sales-Ziele und Verkaufschancen beeinflussen Pipeline, Forecast, Nachfassaktionen und Verantwortlichkeiten.
- Potenziale entstehen teilweise direkt aus der operativen Projektarbeit. Deshalb wurde das Anlegen bewusst nicht auf reine Sales-Rollen verengt.
- Die bestehenden Routen hatten Actor-Pruefung, aber keine ausreichende fachliche Rollenbremse fuer Bearbeitung und Fremdzuweisung.

Checks:
- `git diff --check -- src/lib/permissions/index.ts src/app/api/potentials/route.ts src/app/api/sales-targets/route.ts src/app/api/sales-opportunities/route.ts src/app/api/sales-opportunities/activities/route.ts`
- `npm.cmd run build`
- `npx.cmd prisma validate`
- `npm.cmd run check:mojibake`

Naechster sinnvoller Schritt:
- Dokumenten-/Textkonfiguration pruefen, insbesondere Dokumenttypen, Dokumenttexte und Textbausteine, weil sie Angebote, Rechnungen und Dokumentausgabe beeinflussen.

## Phase-2-Fortsetzung: Dokumentkonfiguration

Stand: 2026-06-20

Umgesetzt:
- Dokumentkonfigurationsrechte in `src/lib/permissions/index.ts` zentralisiert.
- `src/app/api/document-types/route.ts` nutzt die zentrale Regel fuer Dokumenttypen.
- `src/app/api/document-texts/route.ts` nutzt die zentrale Regel fuer Dokumenttexte und Titel.
- Dokumenttypen, Dokumenttexte und Titel lesen: bleibt fuer aktive Benutzer moeglich.
- Dokumenttypen, Dokumenttexte und Titel anlegen, bearbeiten, archivieren oder loeschen: Admin und Geschaeftsfuehrung.

Bewusst nicht geaendert:
- `src/app/api/document-position-search/route.ts`: reine Lesesuche ueber vorhandene Dokumentpositionen.
- `src/app/api/document-mail/route.ts`: Dokumentversand, kein Konfigurationsbereich. Dieser Bereich sollte bei einem separaten Versand-/Kommunikationsblock geprueft werden.

Warum:
- Dokumenttypen steuern Layout, Briefpapier, Sichtbarkeit von Positionen, Zahlungs-/Korrekturverhalten und Dokumentausgabe.
- Dokumenttexte und Titel werden in Angeboten, Rechnungen, Mahnungen und Berichten wiederverwendet.
- Die Routen hatten Actor-Pruefung, aber noch keine zentrale Rollenbremse fuer Schreibaktionen.

Checks:
- `git diff --check -- src/lib/permissions/index.ts src/app/api/document-types/route.ts src/app/api/document-texts/route.ts`
- `npm.cmd run build`
- `npx.cmd prisma validate`
- `npm.cmd run check:mojibake`

Naechster sinnvoller Schritt:
- Dokumentversand und Kommunikationswege pruefen, insbesondere `document-mail`, Mail-OAuth-Folgewege und Versandhistorie.

## Phase-2-Fortsetzung: Dokumentversand und Versandhistorie

Stand: 2026-06-20

Umgesetzt:
- Dokumentversandrechte in `src/lib/permissions/index.ts` zentralisiert.
- `src/app/api/document-mail/route.ts` nutzt die zentrale Regel fuer Dokumentversand.
- Versandhistorie (`GET /api/document-mail`) verlangt jetzt einen aktiven Actor.
- `src/components/dashboard/dashboard-page.tsx` sendet beim Laden der Versandhistorie `activeUserId` als `actorId` mit.
- Vor dem Versand wird geprueft, ob Angebot, Rechnung, Storno, Mahnung, Taetigkeitsbericht oder Projekt zur Demo-Organisation gehoert.
- Historieneintraege fuer Angebote/Rechnungen werden nur noch geschrieben, wenn das betroffene Dokument zur Organisation gehoert.

Rollen:
- Angebote per E-Mail versenden: Admin, Geschaeftsfuehrung, Fuehrungskraft und Vertrieb.
- Rechnungen, Stornos und Mahnungen per E-Mail versenden: Admin, Geschaeftsfuehrung, Fuehrungskraft und Buchhaltung.
- Allgemeine Dokumente und Taetigkeitsberichte per E-Mail versenden: Admin, Geschaeftsfuehrung, Fuehrungskraft, Vertrieb und Buchhaltung.

Bewusst nicht geaendert:
- Mail-OAuth-Start und Callback wurden in diesem Block nicht erneut umgebaut, weil diese Wege bereits im Phase-1-Mail-OAuth-Block Actor-basiert abgesichert wurden.
- Der eigentliche Microsoft-Graph-Versand wurde fachlich nicht veraendert.

Warum:
- Dokumentversand erzeugt externe Kommunikation und schreibt Versandhistorie.
- Vorher war ein aktiver Actor fuer `POST` vorhanden, aber die Versandhistorie konnte ohne Actor gelesen werden.
- Zusaetzlich war die Rollenentscheidung noch nicht zentral nachvollziehbar und die Dokumentzuordnung wurde nicht konsequent vor dem Versand geprueft.

Checks:
- `git diff --check -- src/lib/permissions/index.ts src/app/api/document-mail/route.ts src/components/dashboard/dashboard-page.tsx`
- `npm.cmd run build`
- `npx.cmd prisma validate`
- `npm.cmd run check:mojibake`

Naechster sinnvoller Schritt:
- Kundenfeedback- und Feedback-Request-Wege pruefen, weil sie externe Links, Kundenantworten und Benachrichtigungen betreffen.

## Phase-2-Fortsetzung: Kundenfeedback und Feedback-Anfragen

Stand: 2026-06-20

Umgesetzt:
- Kundenfeedbackrechte in `src/lib/permissions/index.ts` zentralisiert.
- `src/app/api/customer-feedback/route.ts` nutzt zentrale Regeln fuer Lesen, manuelles Erfassen und Loeschen.
- `src/app/api/customer-feedback-requests/route.ts` nutzt zentrale Regeln fuer Lesen und Erzeugen interner Feedback-Anfragen.
- `src/app/api/document-mail/route.ts` begrenzt die automatische Feedback-Link-Suche und Aktualisierung beim Rechnungsversand auf die aktuelle Organisation.

Rollen:
- Kundenfeedback lesen, manuell erfassen und Feedback-Anfragen erzeugen: Admin, Geschaeftsfuehrung, Fuehrungskraft, Vertrieb und Buchhaltung.
- Kundenfeedback loeschen: weiterhin nur Geschaeftsfuehrung.

Bewusst nicht geaendert:
- `src/app/api/public-feedback/[token]/route.ts` bleibt ohne internen Actor. Dieser Weg ist der oeffentliche Kundenlink und darf nicht an eine interne Anmeldung gekoppelt werden.
- Hot-Alert-Erzeugung blieb fachlich unveraendert: Admin, Geschaeftsfuehrung und der zugeordnete Sales-Benutzer erhalten weiterhin die Benachrichtigung.

Warum:
- Feedback-Anfragen erzeugen externe Kundenlinks und Kundenfeedback kann Hot-Alerts ausloesen.
- Vorher wurden interne Feedback-Wege zwar teilweise mit Actor geladen, aber die fachliche Rollenregel war nicht zentral nachvollziehbar.
- Der oeffentliche Token-Weg muss separat bleiben, damit Kunden ohne WorkPilot-Anmeldung bewerten koennen.

Checks:
- `git diff --check -- src/lib/permissions/index.ts src/app/api/customer-feedback/route.ts src/app/api/customer-feedback-requests/route.ts src/app/api/document-mail/route.ts`
- `npm.cmd run build`
- `npx.cmd prisma validate`
- `npm.cmd run check:mojibake`

Naechster sinnvoller Schritt:
- Benachrichtigungen und News-/Interaktionswege pruefen, weil dort interne Sichtbarkeit, Reaktionen und personenbezogene Benachrichtigungen zusammenlaufen.
