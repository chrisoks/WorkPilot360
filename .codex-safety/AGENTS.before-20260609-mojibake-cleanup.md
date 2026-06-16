# WorkPilot360 Agent Handover

Diese Datei ist die zentrale Uebergabe fuer neue Codex-/Agenten-Chats im Projekt
WorkPilot360. Sie soll verhindern, dass fachliche Entscheidungen, technische
Details oder Entwicklungsstand verloren gehen.

Stand dieser Uebergabe: 2026-06-04

## Projekt

- Name: WorkPilot360
- Ziel: Eigenes, modernes Handwerker-/Auftragsmanagement-System mit wichtigen
  HERO-aehnlichen Kernfunktionen, aber nicht als 1:1-Klon.
- Lokaler Projektordner:
  `C:\Users\vagte\Downloads\Dokumenteauslastungdashboardhero\WorkPilot360`
- Sprache der Zusammenarbeit: Deutsch.
- Nutzer prueft UI oft selbst visuell. Browser-/Screenshot-Pruefungen sind
  sinnvoll, aber nicht bei jeder kleinen TypeScript-Aenderung noetig.
- Devserver lief wiederholt auf `http://localhost:3001/dashboard`.
- Port 3000 ist haeufig durch andere Projekte belegt.
- PowerShell: fuer npm bevorzugt `npm.cmd ...`, nicht `npm ...`.

## Grundregeln fuer weitere Agenten

- Nie produktive Daten, Tabellen oder Felder loeschen.
- Keine destruktiven Git-/DB-Befehle wie `git reset --hard`, `git checkout --`
  oder riskante Prisma-Pushes mit Datenverlustwarnung.
- Der Worktree ist haeufig stark geaendert. Vor Aenderungen immer gezielt
  relevante Dateien lesen und fremde Aenderungen nicht zurueckdrehen.
- Bei Prisma-Aenderungen immer beides beachten:
  - `prisma/schema.prisma`
  - defensive API-Ensure-Logik mit `CREATE TABLE IF NOT EXISTS` und
    `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- Viele API-Routen nutzen Raw SQL. Nicht nur Prisma Schema pflegen.
- UI soll modern, ruhig, funktional und fuer normale Mitarbeitende einfach sein.
- Statusanzeigen bevorzugt als Chips/Clips mit klarer Farbe, nicht als harte
  Tabellenflaechen.
- Buttons sollen einheitliche Groesse, klare Abstaende und erkennbare Funktion
  haben.
- Keine grossen Refactorings ohne Anlass. Erst fachlich stabil halten.
- Encoding nicht breit/global reparieren, ausser ausdruecklich beauftragt.
  Nach UI-Textaenderungen optional pruefen:
  `rg -n -P "\\x{00C3}|\\x{00C2}|\\x{FFFD}" src/app src/components -g "*.ts" -g "*.tsx" -g "*.css"`

## Standard-Pruefungen

Nach Codeaenderungen mindestens:

```powershell
npx.cmd tsc --noEmit
git diff --check
```

Bei Prisma-Aenderungen:

```powershell
npx.cmd prisma validate
npx.cmd prisma db push --skip-generate
```

`prisma db push` darf keine Datenverlustwarnung zeigen. Wenn doch: abbrechen
und Schema/Modelle/Felder wiederherstellen.

Build:

```powershell
npm.cmd run build
```

Bekannter Next-/Cache-Sonderfall: Build kann gelegentlich beim ersten Lauf mit
`PageNotFoundError: Cannot find module for page: /api/...` scheitern. Nicht
sofort als Codefehler werten, wenn TypeScript sauber ist. Zweiter Lauf klappt
oft. Nur bei Bedarf lokalen `.next`-Ordner im Projekt entfernen und Build
wiederholen.

## Wichtige Dateien

- Haupt-UI: `src/components/dashboard/dashboard-page.tsx`
- Haupt-CSS: `src/components/dashboard/dashboard.module.css`
- Prisma: `prisma/schema.prisma`
- Projekt-API: `src/app/api/hero/projects/route.ts`
- Kontakte: `src/app/api/contacts/route.ts`
- Nutzer/Mitarbeiter: `src/app/api/users/route.ts`
- Rechnungen: `src/app/api/invoices/route.ts`
- Angebote: `src/app/api/offers/route.ts`
- Katalog: `src/app/api/catalog-items/route.ts`
- Planung: `src/app/api/planning-entries/route.ts`
- Stempelsession: `src/app/api/stamp-session/route.ts`
- Projektzeiten: `src/app/api/project-time-entries/route.ts`
- Mailversand: `src/app/api/document-mail/route.ts`
- MS365 OAuth:
  - `src/lib/mail/microsoft.ts`
  - `src/app/api/mail/oauth/start/route.ts`
  - `src/app/api/mail/oauth/callback/route.ts`
- Winterdienst: `src/app/api/winter-service-runs/route.ts`

## Technischer Rahmen

- Next.js / React / TypeScript
- Prisma / PostgreSQL
- Viel UI-Logik liegt aktuell in `dashboard-page.tsx`.
- `.env` lokal vorhanden, nicht committen.
- Remote/GitHub wurde frueher vorbereitet; keine Annahmen ueber aktuellen
  Push-Stand treffen, erst `git status` und ggf. `git remote -v` pruefen.

## Historische Quellen

Diese Uebergabe basiert auf:

- `C:\Users\vagte\OneDrive\Dokumente\Coding\Verlauf\Bisheriger Chat_1.docx`
- `C:\Users\vagte\OneDrive\Dokumente\Coding\Verlauf\Bisheriger_Chat_2.docx`
- `C:\Users\vagte\OneDrive\Dokumente\Coding\Verlauf\Bisheriger_Chat_3.docx`
- `C:\Users\vagte\OneDrive\Dokumente\Coding\Verlauf\Bisheriger_Chat_4.docx`
- `C:\Users\vagte\OneDrive\Dokumente\Coding\Verlauf\Bisheriger_Chat_5.docx`
- `C:\Users\vagte\OneDrive\Dokumente\Coding\Verlauf\Bisheriger_Chat_6.docx`
- `C:\Users\vagte\OneDrive\Dokumente\Coding\Verlauf\Bisheriger_Chat_7.docx`
- dem aktuellen Chatverlauf bis 2026-06-03.

Die Word-Dateien enthalten den historischen Verlauf. Diese `AGENTS.md` ist eine
verdichtete, arbeitsfaehige Zusammenfassung mit den wichtigsten Entscheidungen.

## Produktvision

WorkPilot360 soll ein eigenes System fuer:

- Kontakte/Kunden/Ansprechpartner
- Projekte und Projektpipelines
- Aufgaben, Kanban, Archiv
- Planungsboard und Kalenderuebersicht
- Mitarbeiterverwaltung, Abwesenheiten, Berechtigungen
- Zeiterfassung/Stempelung
- Angebote, Rechnungen, Storno, Entwuerfe
- Dokumente, Mailversand, PDF-Templates
- Forecast, OP, SVS, Mitarbeiterauswertung
- Winterdienst-Automation
- Content-Management / Richtlinien
- spaeter ggf. PWA/Hybrid-Nutzung

Wichtig: Ziel ist pragmatische Nutzbarkeit, nicht perfekte Architektur.

## Navigation / Hauptmodule

Die linke Sidebar wurde stark an HERO angelehnt, aber moderner strukturiert.
Wichtige Punkte:

- Dashboard
- Auswertungen
- Kontakte
- News-Feed
- Sales-Hub
  - Uebersicht
  - Lead-Projekte
  - Potenziale
  - KuZu / Kundenzufriedenheit
  - Sales-Ziele
- Projekte OK solutions
- Projekte OK immocare
- Content-Management
- Artikel & Leistungen
- Aufgaben
  - Kalenderuebersicht
  - Kanban
  - Archiv
- Planungsboard
- Prozess/Automation
  - Winterdienst
- Buchhaltung
  - Stapelabrechnung
  - Rechnungen (ALT)
  - Dokumente
  - Ausschreibungen (GAEB)
- Persoenliche Daten
- Mitarbeiter
- Firmeneinstellungen

Dokumente wurden von der Hauptnavigation unter Buchhaltung verschoben.
Texte & Titel liegt/lag sinnvoller unter Firmeneinstellungen. Konfigurator
wurde als fraglich eingestuft, nur behalten wenn echte Nutzung existiert.

Dashboard-Entscheidung:

- Dashboard ist kein generischer Modul-Launcher mehr, sondern ein rollenbasiertes
  operatives Cockpit.
- `Aktuelle Stempelungen` bleibt fuer alle Rollen sichtbar. Geschaeftsfuehrung,
  Fuehrungskraft und Admin sehen die Team-/Fuehrungssicht; normale Mitarbeitende
  sehen ihre eigene Arbeits-/Stempelperspektive.
- Geschaeftsfuehrung sieht zusaetzlich Finanz-, Faktura-, Risiko- und
  Projektsteuerungskennzahlen, z.B. offene Arbeitszeiten, Rechnungsentwuerfe,
  kritische Projektstatus, ueberfaellige Aufgaben, Forecast/Umsatz und
  abrechnungsreife Themen.
- Nicht-GF-Rollen sehen keine GF-Finanzkennzahlen. Sie bekommen persoenliche
  Aufgaben, heutige Planung, eigene Eskalationen; Fuehrungskraft/Admin zusaetzlich
  Team-Aufgaben, Team-Stempelstatus und Terminwuensche/Freigaben.
- Die fruehere Ausbaupfad-Box wurde entfernt. Dashboard-Karten sollen immer
  konkrete Aktionen anbieten, z.B. Projekt oeffnen, Aufgabe oeffnen,
  Rechnung vorbereiten oder Terminwunsch pruefen.
- Update Dashboard 2026-06-05: Das Dashboard bleibt kachelbasiert und ruhig.
  Umsatz und Forecast sind fuer alle Rollen sichtbar. Leistungsgrade werden
  gebuendelt in einer Kachel mit Chips angezeigt, nicht als mehrere einzelne
  Kacheln. Die Rolle `VERTRIEB`/`Vertrieb` ist eine echte Mitarbeiterrolle fuer
  vertriebsnahe Dashboard-Sichten; sie darf keine GF-/Admin-Rechte implizieren.
  `Aktuelle Stempelungen` bleibt fuer alle Rollen als fester Block sichtbar.
- Folgeentscheidung 2026-06-05: Das Dashboard nutzt dauerhaft vier feste
  Hauptkacheln: `Finanzen`, `Leistung`, `Aufgaben`, `Projekte & Planung`.
  Innerhalb dieser Kacheln rotieren zugehoerige Kennzahlen ca. alle 10 Sekunden.
  Nutzer koennen manuell per Pfeil/Punkt wechseln; Hover/Fokus pausiert den
  Wechsel. Neue Dashboard-Kennzahlen sollen bevorzugt als Slide in einer dieser
  vier Kacheln landen, nicht als weitere Hauptkachel.

## Kontakte

Umgesetzt/entschieden:

- HERO-nahe Kontaktliste mit:
  - 25 Eintraegen Standard
  - umstellbar auf 50/100/250
  - Paginierung oben/unten
  - Spaltenfilter
  - Spaltenauswahl
  - Export CSV/Excel fuer gefilterte/sichtbare Spalten
  - Gruppenaktion
- Kontakt-Typen:
  - Firma
  - Privatkunde
  - Ansprechpartner
  - Partner
  - Lieferant
- Standardtyp ist Firma.
- Ansprechpartner koennen Firmen zugeordnet werden.
- Kategorie wurde als redundant erkannt, weil Typ die fachliche Funktion traegt.
- Kontaktmaske optisch vereinheitlicht.
- Neues Feld fuer Winterdienst:
  - `Contact.isActivityReportRecipient`
  - UI: "Empfaenger fuer Taetigkeitsberichte"

## Projekte / Pipelines

Es gibt zwei getrennte Projektbereiche:

- OK solutions
- OK immocare

Projektstatus/Pipeline wurde mehrfach angepasst. Wichtige Entscheidungen:

- `Endkontrolle` ist echter Status, nicht nur Anzeige von `Abnahme`.
- Alte Werte `Abnahme` werden beim Laden als `Endkontrolle` normalisiert.
- Projekt-Haken/Rechnungsstatus darf nur gruen sein, wenn echte, nicht
  geloeschte Rechnung existiert.
- Projektansicht hat viele Reiter:
  - Logbuch
  - Bilder
  - Dokumente
  - Termine & Stempelungen
  - Projektzeitkontingente
  - Automatische Abrechnung
  - Aufgaben
  - Material
  - Projektbeteiligte
  - Checklisten
  - Ausschreibungen (GAEB)
- Projektakten-Sidebar 2026-06-08: Aufklappbare Gruppen wie `Dokumente` und
  `Aufgaben` haben wieder einen eigenen Offen-/Geschlossen-Zustand. Klick auf
  dieselbe Gruppe klappt sie zu, Klick auf einen anderen Hauptreiter schliesst
  offene Gruppen. Der aktive Projektakten-Reiter bleibt davon getrennt, damit
  z.B. die Dokumentansicht sichtbar bleiben kann, waehrend die Unterpunkte
  eingeklappt sind.
- Rauchmelder-Installationsnachweise werden nicht als eigener Projektakten-
  Hauptreiter gefuehrt, sondern als spezialisierte Checkliste unter
  `Checklisten`. Grund: Die Projektakte soll nicht fuer jeden Sondernachweis
  weitere Hauptpunkte bekommen, und Monteure sollen solche fachlichen
  Checklisten spaeter auch in der PWA ausfuellen koennen. Der erzeugte PDF-
  Nachweis wird unter dem Sammelordner `Dokumente: Checklisten` abgelegt,
  damit nicht fuer jede neue Checklistenart ein eigener Dokumenten-Unterpunkt
  entsteht. Bereits alte `Dokumente: Rauchmelder-Nachweise`-Eintraege muessen
  weiter in diesem Sammelordner mit angezeigt werden.
- Der Reiter `Checklisten` soll als Cockpit/uebersichtliche Vorlagenliste
  funktionieren, nicht als lange Aneinanderreihung aller Spezialformulare.
  Fachliche Checklisten wie Rauchmelder werden zuerst als Karte/Zeile
  angeboten und oeffnen ihr Detailformular erst nach Auswahl. Dieses Muster
  beibehalten, wenn weitere Checklisten hinzukommen.
- Eigene Felder / Datenerfassungsbogen wurden unten aus Projekt entfernt.
- Projektdaten rechts weiss hinterlegt.
- Projekt-Header:
  - Zurueck zur Pipeline
  - Projektdaten links
  - rechts kompakte Aktionsbuttons
  - Projektverantwortlicher ist direkt im Projektkopf aenderbar, aber nur auf
    angelegte aktive Mitarbeitende. Freitext ist bewusst nicht erlaubt, damit
    keine Phantom-Verantwortlichen oder Tippfehler entstehen. Aenderungen werden
    im Projektlogbuch dokumentiert.
  - Erinnerung anlegen wurde entfernt, Aufgabenmodul ist qualifizierte
    Erinnerung.

## Projektzeitkontingente / Termine & Stempelungen

Alte Vorgabezeiten-aus-Angebot-Logik wurde fachlich verworfen.

Aktuelle Entscheidung:

- Wenn Projektzeitkontingente vorhanden sind, ist Monatskontingent die Soll-Zeit.
- Wenn keine Kontingente vorhanden sind, bilden geplante Termine die Soll-Zeit.
- Dauerlaeufer-Planungsstatus in Projektakte/Pipeline muss gegen Monatskontingent
  plus geplante Termine rechnen. Alte Angebotsstunden duerfen dort nicht mehr als
  offene Planungsbasis erscheinen, sobald ein Monatskontingent vorhanden ist.
- Dauerlaeufer haben in der Projektakte eine Monatsakte:
  - Standard ist der aktuelle Monat.
  - Sichtbar sind aktueller Monat, 3 Monate davor und 9 Monate danach.
  - Der 13-Monats-Ausschnitt ist mit Vor-/Zurueck-Buttons verschiebbar, damit
    auch weiter entfernte Monate erreichbar bleiben.
  - Angebote und Nachtragsangebote bleiben projektweit sichtbar.
  - TerWu/Terminstatus, Planung, Stempelungen, Vorher-/Nachherbilder, Dokumentationsmarker,
    Endkontrolle, Rechnungen und monatsbezogene Kontingentwerte richten sich
    nach dem ausgewaehlten Monat.
  - Dokumente in Dauerlaeufer-Monatsakten: Nur `Angebote` und
    `Angebote: Nachtragsangebote` duerfen in alle Monate mitwandern. Andere
    Dokumentarten wie Rechnungen, Endkontrolle, Checklisten,
    Taetigkeitsberichte und sonstige Uploads gehoeren wirklich in den Monat,
    in dem sie abgelegt/erzeugt wurden. Fortschritts-Haken fuer `Endkontrolle`
    und `Rechnung` duerfen bei Dauerlaeufern daher nur aus dem ausgewaehlten
    Projektmonat kommen, nicht aus anderen Monaten.
  - Bilder in Dauerlaeufer-Monatsakten sind ebenfalls monatsbezogen. Vorher-
    und Nachherbilder duerfen bei Dauerlaeufern nur im ausgewaehlten
    Projektmonat zaehlen/sichtbar sein; die Fortschritts-Haken `V-Bilder` und
    `N-Bilder` muessen diesen Monatsfilter nutzen. Bei Einmalprojekten bleiben
    Bilder projektweit sichtbar, weil dort keine Monatsakte existiert.
  - Historienansichten in der normalen Monatsakte sind ebenfalls monatsbezogen.
  - Zusaetzlich gibt es eine projektweite Inhaltssuche innerhalb der Projektakte:
    Sie durchsucht ueber alle Monate nur das ausgewaehlte Projekt, u.a. Logbuch,
    Historien, Termine, Stempelungen, Rechnungen, Angebote, Dokumente/Bilder und
    Aufgaben. Treffer zeigen Typ und Monat und springen beim Klick in den
    passenden Bereich/Monat.
- Summe der Monatskontingente darf Gesamtprojektkontingent nicht ueberschreiten.
- Modi:
  - Gesamtprojektkontingent gleichmaessig verteilen
  - benutzerdefiniert je Monat

Termine & Stempelungen:

- Obere Tabelle: Planungstermine, kein Leistungsgrad dort.
- Unten: erwartete Stempelungen je geplantem Mitarbeiter.
- Dort Soll/Ist/Differenz/Leistungsgrad pro Mitarbeiter.
- Sichtbare Datumswerte in Stempelungen, Historien, Rechnungsmaske und
  Benachrichtigungen duerfen nicht roh als `YYYY-MM-DD` erscheinen. Interne
  Keys/Inputs bleiben ISO, aber UI-/Historientexte nutzen deutsches Format wie
  `18.05.2026` bzw. `18.05.2026, 08:00`.
- Kommentare an Stempelungen muessen in Projektakte, Rechnungsmaske und
  Stempelungslisten sofort sichtbar sein. Die Tabellenzelle bleibt kompakt:
  Clip `Kommentar` oder `Kein Kommentar`, Volltext nur per Klick im kleinen
  Detailfenster, damit Buchhaltung/Projektleitung die Rechnung fachlich gegen
  die Monteurangabe pruefen kann.
- Manuelle Stempelungen werden ueber `entrySource = manual` und den separaten
  Clip `Manuelle Stempelung` gekennzeichnet. `Manuell hinzugefuegt` darf nicht
  mehr als Ersatz-Kommentar gespeichert werden; alte solche Kommentare werden
  nur in der Anzeige als "kein echter Kommentar" behandelt.
- Leistungsgrad ist pro Mitarbeiter, nicht pro Projekt.
- Fakturierte Stempelungen zeigen gruenen Haken und Rechnungsnummer.
- Historie zweispaltig:
  - Termine
  - Stempelungen
  - standardmaessig letzte drei Eintraege, ausklappbar.

## Planungsboard

Planungsboard:

- Bereiche OK solutions und OK immocare.
- Planungsgruppen:
  - OK solutions: Marketing, Arb.Sich., HR
  - OK immocare: VZK, TZK
- Ansicht ab aktuellem Tag plus ca. 4 Wochen.
- Tagesplanung 06:00-20:00 in 15-Minuten-Raster.
- Wochenende/Feiertage optisch gekennzeichnet.
- Mitarbeitende kommen aus Planungseinstellungen, nicht mehr Dummy-Daten.
- Tageskapazitaet, planbare Zeit und Auslastung werden aus Mitarbeitereinstellungen berechnet.
- + Planung und + Terminwunsch existieren.
- Terminwunsch:
  - gelb
  - muss vom Planungsverantwortlichen freigegeben werden
  - Notification/E-Mail an Verantwortliche geplant/teilweise umgesetzt
  - Klick aus Notification soll passenden Planungstag oeffnen.
- Planungen koennen aus Projekt/Angebot-Kontext geoeffnet werden.
- Keine Planung speichern, wenn kein Mitarbeiter zugewiesen ist.
- Kein zweiter Eintrag fuer denselben Mitarbeiter am selben Tag auf demselben
  Projekt.
- Warn-Popups bei Unter-/Ueberplanung von Kontingenten.
- Das Planungsboard zeigt weiterhin einen ca. vierwoechigen/29-taegigen
  Ausschnitt, aber der Start ist steuerbar. Im Board-Kopf gibt es Navigation
  fuer `< 4 Wochen`, `Heute` und `4 Wochen >`. Neue Logik im Planungsboard
  muss den steuerbaren Start (`planningBoardStartDate`) verwenden und darf
  nicht wieder hart ab `new Date()` rendern.

## Mitarbeiter / Login / Rollen

Mitarbeiterverwaltung:

- Mitarbeiterliste mit Aktiv/Inaktiv, Suche, Tabelle.
- Mitarbeiterakte mit Reitern:
  - Uebersicht
  - Urlaub und Abwesenheiten
  - Zeiterfassung / Stempelungen
  - Stundenausgleich
  - Dokumente
  - Planungseinstellungen
  - Berechtigungen
  - Passwort aendern
  - Mailserver / MS365
  - ggf. Entwicklung/Einschaetzung/DISG
- Mitarbeiter werden nicht hart geloescht, sondern aktiv/inaktiv gesetzt.
- Login:
  - gegen `User.email` + `User.passwordHash`
  - nur aktive Mitarbeiter
  - Passwort in Mitarbeiterakte setzbar/generierbar
- Geschaeftsfuehrer koennen Mitarbeiteremulation ueber User-Dropdown nutzen.
- Aufgabenmodul soll in Emulation/echt nur eigene/eskalierte Aufgaben zeigen.

Planungseinstellungen:

- Planungsboard und Planungsgruppe je Mitarbeiter.
- Wochenarbeitszeiten und Tageskapazitaet.
- Planbare Zeitbereiche; ausserhalb kann trotzdem geplant werden, aber grau.

Berechtigungen / Niederlassungsverteilung / LK:

- BranchAllocations:
  - `okSolutions`
  - `okImmocare`
  - `okImmocareVzk`
  - `okImmocareTzk`
- Sichtbare Summe:
  - OK solutions + OK immocare VZK + OK immocare TZK = 100
  - `okImmocare = okImmocareVzk + okImmocareTzk`
- Alte Daten mit nur `okImmocare` werden auf VZK normalisiert.
- `includeInLaborCostRate === false`:
  - Mitarbeiter bleibt fuer Planung/Berechtigungen erhalten
  - fliesst aber nicht in LK-Satz ein.
- Nicht wieder Planungsgruppe fuer LK-Verteilung verwenden.

## LK-Satz / Katalog / Angebote

LK-Satz:

- Sidebar > Mitarbeiter > LK-Satz
- Bereiche:
  - OK solutions
  - OK immocare VZK
  - OK immocare TZK
- Wirksamer Anteil = interner Kostensatz * Anteil.
- Wichtig: Kachelwert wurde bewusst auf durchschnittlichen wirksamen Anteil pro
  beruecksichtigter Person gesetzt, nicht `total / allocationTotal`.
- Nicht auf alte Logik zurueckstellen.

Artikel & Leistungen:

- Zentrales Stammdatenmodul fuer Artikel, Leistungen, Pakete.
- API: `/api/catalog-items`
- Artikel:
  - Einkaufspreis/Material
- Leistungen:
  - nutzen LK-Satz als Kostenwert
  - `CatalogItem.laborCostRateKey`
  - `CatalogItem.isLaborPosition`
- Pakete:
  - Kombination aus Artikeln/Leistungen
  - kein eigener LK-Satz
  - Kosten aus Bestandteilen
- Arbeitsposition-Logik:
  - `CatalogItem.isLaborPosition`
  - `OfferLine.isLaborPosition`
  - `InvoiceLine.isLaborPosition`
  - bestehende `type = service` sollen `isLaborPosition = true` haben
  - Artikel standardmaessig false
  - Pakete nur bewusst true
  - Snapshot wird in Angebots-/Rechnungsposition uebernommen.
- Arbeitskennzahlen/SVS/Leistungsgrad duerfen kuenftig nur Arbeitspositionen
  nutzen, damit Materialumsatz Kennzahlen nicht verfaelscht.

Angebote:

- Angebots-PDF nutzt echte PDF-Vorschau statt HTML-Nachbau.
- Vorschau aktualisieren erzeugt temp. PDF mit derselben Logik wie final.
- Gross oeffnen fuer PDF.
- Positionen koennen aus Katalog gesucht/gefiltert werden.
- Preise/Beschreibung/Kosten werden als Snapshot gespeichert.
- LK-Satz und laborCostRate werden je Position gesnapshottet.
- Bei Einmalprojekten ist geplanter Ausfuehrungsmonat Pflicht.
- Bei Dauerlaeufern gibt es Zeitraum von/bis.
- Monatspicker mit Jahr/Monat.
- Nachtragsangebote ersetzen Begriff Sonderangebote.
- Rabatt pro Position und Gesamtrabatt fuer Angebot/Rechnung, im PDF sichtbar.
- Entwurf speichern fuer Angebot und Rechnung existiert.

Wichtige fachliche Korrektur:

- Angebots-Mitarbeiter-/Vorgabezeiten waren zeitweise angedacht, wurden spaeter
  fachlich verworfen bzw. durch Projektzeitkontingente/Planung ersetzt.
- Kalkulatorische Annahmen im Angebot duerfen nicht automatisch Soll/Ist der
  spaeter tatsaechlich ausfuehrenden Mitarbeiter verzerren.

## Rechnungen / Storno / Entwuerfe

Rechnungen:

- API: `src/app/api/invoices/route.ts`
- Normale Rechnungen: Nummernkreis `RE-...`
- Stornorechnungen: Nummernkreis `ST-...`
- Storno:
  - Originalrechnung wird `Storniert`
  - neue negative Stornorechnung mit eigener ST-Nummer
  - PDF negativ
  - Logbuch/Historie
  - verknuepfte Zeiteintraege werden freigegeben
- Loeschen von Rechnungen nur Geschaeftsfuehrung.
- Geloeschte Rechnungen aus Uebersichten ausblenden.

Entwurfslogik:

- Entwurf ist klar von Fakturiert getrennt.
- Intern bekommen Entwuerfe aktuell noch RE-Nummer, aber nach aussen Anzeige
  `Entwurf` und PDF ohne echte Rechnungsnummer.
- Buchhalterisch sauberer waere spaeter eigener Entwurfsnummernkreis; aktuell
  nicht umgesetzt.
- Entwurfs-PDF: "Rechnungsentwurf".
- Status-Chips:
  - Entwurf gelb
  - Fakturiert/Bezahlt gruen
  - Storniert/Geloescht rot
- E-Mail bei Entwurf fragt vorher nach Bestaetigung.
- Entwuerfe haben pulsierenden Button `Fakturieren`.
- Vor Fakturierung Ja/Nein-Dialog: "Wurde alles verrechnet? Moechten Sie das
  Projekt jetzt abrechnen?"
- Nach finaler Fakturierung PDF wieder echte Rechnung mit RE-Nummer.
- Reparaturlogik darf finalisierte Entwuerfe nicht wieder auf Entwurf setzen.
  `"Rechnung fakturiert"` muss in Ausnahmeliste bleiben.
- `Invoice.plannedExecutionMonth` ist wichtig fuer Forecast/Stapelabrechnung.

Stempelzeiten und Rechnungen:

- Bei finaler Fakturierung muessen verknuepfte Stempelungen als fakturiert
  markiert werden.
- Entwurf speichern darf Stempelungen nicht als abgerechnet markieren.
- Fakturieren ohne Ist-Zeiten soll Warnung werfen:
  "ACHTUNG: Sie moechten ohne verknuepfte Stempelzeiten abrechnen. Moechten Sie
  fortfahren?"
- Offene produktive Stempelzeiten duerfen nicht erst beim Fakturieren auffallen.
  Unter Buchhaltung > Offene Arbeitszeiten gibt es einen vorgelagerten Monitor:
  Einmalige Projekte werden ab 3 Tagen nach Stempeldatum kritisch, Dauerlaeufer
  ab Monatsende + 3 Tage. Erst Projektverantwortliche benachrichtigen, bei
  weiterer Ueberschreitung zusaetzlich GF; Duplikate ueber Alert-Historie
  verhindern.

Dokumenten-/Positionssuche:

- Unter Buchhaltung > Dokumente gibt es eine Positionssuche ueber Angebote,
  Rechnungen und Stornorechnungen. Sie sucht auf Belegnummer, Kunde, Projekt,
  Positionstitel, Beschreibung und Artikel-/Leistungsart; Stornos zaehlen als
  Rechnungen mit Status `Stornorechnung`.
- Die Positionssuche ist ein Suchwerkzeug, keine Voll-Liste: Ohne Suchbegriff
  keine Positionen anzeigen, erst ab 3 Zeichen suchen, maximal 50
  Positionstreffer liefern und Treffer nach Dokument gruppieren.

## Stapelabrechnung

Unter Buchhaltung > Stapelabrechnung.

Zweistufig:

1. Entwuerfe erstellen
2. Entwuerfe pruefen, markieren und `Faktura durchfuehren`

Projekt > Automatische Abrechnung:

- Automatische monatliche Abrechnung aktiv
- Monatlicher Rechnungsbetrag netto
- MwSt.
- Ab Monat
- Bis Monat
- Vorlage:
  - Vormonatsrechnung verwenden
  - Projektvorlage verwenden
- Projektvorlage kann aus letzter Rechnung uebernommen werden.
- Weniger als 3 Vergleichsrechnungen ist Hinweis, kein Blocker.
- Blocker:
  - Vorlage fehlt
  - Betrag fehlt
  - bereits Rechnung/Entwurf fuer Monat vorhanden
- Status "Bereits fakturiert"/"Schon vorhanden" soll als gruener Clip mit
  Haken dargestellt werden, nicht rot.
- Hinweis soll zeigen, ob manuell oder Stapelabrechnung fakturiert wurde.
- Bereits vorhandene/fakturierte Rechnung erkennt Fakturierungsquelle ueber
  History/Quelle.

Monatsfelder:

- Intern `YYYY-MM`
- Sichtbar Monat/Jahr
- Aktueller Monat Standard.
- Alte Werte wie `April`/`Oktober` duerfen nicht in Dropdowns/Pickern erscheinen.
- Zuletzt wurde statt langer Dropdownliste ein Monats-Picker wie in der
  Angebotsmaske eingesetzt.

## Forecast, OP, SVS, Mitarbeiterauswertung

Auswertungen:

- Reiter u.a.:
  - Forecast & OP Kontrolle
  - Umsaetze - Details
  - SVS Analyse
  - Projekte
  - Kunden
  - Artikel & Leistungen
  - Mitarbeitende
  - Umsatz- und Projektuebersicht
  - Projektkarte

Forecast & OP:

- Ersetzt Excel-Forecast.
- Dauerlaeufer monatlich bis Projektende.
- Einmalprojekte ueber Angebot/Rechnung.
- `plannedExecutionMonth` bevorzugen.
- Kopfboxen:
  - Sicherer Forecast
  - Chancen
  - Gesamtpotenzial
  - Fakturiert
  - Bezahlt
  - Offene Posten
- Offene Posten = fakturiert, aber nicht bezahlt.
- Bezahlt mit gruenem Haken/Zahldatum.
- Geschaeftsbereich-Soll:
  - Marketing
  - Arbeitssicherheit
  - HR
  - immocare
- "interne Arbeiten" aus Forecast/Sollwerten entfernt.
- Diagramme wurden eingebaut:
  - Gesamtpotenzial nach Monat
  - Verteilung nach Geschaeftsbereich
- Nutzer ist bei Diagrammen sehr sensibel auf Ausrichtung, Achsen, Leerraeume,
  Lesbarkeit und Zoom-Verhalten. Visuelle Rueckmeldung ernst nehmen.

Mitarbeitende-Auswertung:

- Verkaufte Std. werden aus finalisierten Rechnungen anhand verknuepfter
  Stempelzeiten berechnet.
- Zuordnung ueber `invoiceId` oder `invoiceNumber`.
- Fallback auf alte laborItems-Logik nur, wenn keine verknuepften Stempelzeiten
  vorhanden sind.
- Begriffe:
  - `Produktive Std.` = produktiv gestempelte Zeiten auf Projekte.
  - `Unproduktive Std.` = intern/unproduktiv gestempelte Zeiten ohne Projektbezug.
- Formeln:
  - Leistungsgrad = Verkaufte Std. / Produktive Std. * 100
  - Produktivitaet = Verkaufte Std. / (Produktive Std. + Unproduktive Std.) * 100
  - Anwesenheit = (Produktive Std. + Unproduktive Std.) / Soll-Anwesenheit * 100
- Gesamtwerte werden aus Summen berechnet, nicht aus Durchschnitts-Prozenten.
- Planungsgruppen werden als separate Karten gezeigt.
- Statusfelder in Planungsgruppen sollen auf einer gemeinsamen horizontalen
  Linie ausgerichtet sein.

SVS:

- Pro fakturierter Rechnung:
  - Netto-Rechnungswert / verknuepfte Stempelstunden = SVS
- Rechnungen ohne verknuepfte Stempelzeiten:
  - anzeigen
  - roter Clip "nicht auswertbar"
- Rechnungen mit Zeiten:
  - gruener Clip "auswertung i.O."
- Material/Artikel duerfen Arbeitskennzahlen nicht verfaelschen; Basis dafuer
  ist `isLaborPosition`.

## Aufgaben

Aufgabenmodul:

- Timer entfernt, da Projektzeiterfassung zentral ueber Stempelung laeuft.
- Tabelle:
  - Nr
  - Aufgabe
  - Status
  - Prioritaet
  - Zustaendig
  - Deadline
  - Aktion
- Sidebar Aufgaben-Badges:
  - gelb = offen
  - rot = ueberfaellig
  - gruen pulsierend = in Bearbeitung
- Aufgabenannahme:
  - Aufgabe muss angenommen werden, bevor sie bearbeitet werden darf.
  - Nicht angenommene Aufgabenfelder ausgegraut.
  - Klick in Maske zeigt Popup:
    "Sie muessen zuerst die Aufgabe annehmen, bevor Sie die Aufgabe bearbeiten."
  - Klick auf "Aufgabe annehmen" schliesst Maske nicht.
- Aufgaben sehen:
  - Zustaendige
  - Aufgabenbeteiligte
  - Projektbeteiligte bei Eskalation
  - immer Geschaeftsfuehrer
  - nicht alle Mitarbeiter.
- Aufgabenhistorie:
  - Annahmen
  - Statusaenderungen
  - Beteiligte hinzugefuegt
  - Kommentare
  - standardmaessig eingeklappt.
- Kommentare koennen an Aufgabenbeteiligte gerichtet werden.
- Empfaenger soll Notification erhalten.
- Beim Speichern gewuenscht:
  - Popup "Ist der derzeitige Aufgabenstatus noch aktuell?"
  - Ja bestaetigen oder Status direkt aendern.

## Stempelung / Zeiterfassung / PWA

Zentrale API:

- `/api/stamp-session`
- Tabelle `ActiveStampSession`
- Pro Mitarbeiter genau eine aktive Session.
- Hauptprogramm und PWA sollen dieselbe Session sehen.
- Aktionen:
  - GET aktive Session pro User / alle aktiven Sessions
  - POST start
  - PATCH pause/resume
  - DELETE oder POST stop
- Stop erzeugt `ProjectTimeEntry`.
- Pause/Wechsel nutzen dieselbe zentrale Session.
- Zeitproblem abgesichert:
  - Start serverseitig `new Date()`
  - Frontend korrigiert Sessions, deren startedAt mehr als 60 Sekunden in der
    Zukunft liegt.
- Bei unproduktiver Stempelung keine "Arbeit fertig/unterbrochen"-Abfrage.
- Bei produktivem Stop/Wechsel:
  - Kommentar Pflicht
  - Arbeit fertig / Arbeit unterbrochen
  - Endkontrolle bei Arbeit fertig
  - Zusatzverkauf-Frage.

Bekannte lokale DB-Fehler frueher:

- Prisma P2010 Duplicate Key fuer `ActiveStampSession`.
- Regclass-Deserialisierung bei `/api/stamp-session`.
- Diese Fehler duerfen nicht durch Zurueckbau der Stempellogik geloest werden;
  zentrale Session muss erhalten bleiben.

PWA:

- Es gibt separaten PWA-Chat.
- Hauptprogramm nicht mit PWA verwechselt bearbeiten.
- PWA soll dieselbe `/api/stamp-session` verwenden.
- Endkontrolle/Abstempellogik perspektivisch auch in PWA.

## Endkontrolle / Zusatzverkauf / Potenziale

Endkontrolle:

- Beim Stop/Wechsel "Arbeit fertig" kann Endkontrolle ausloesen.
- Checkliste:
  - Auftrag vollstaendig erledigt
  - Ergebnis sauber und ordentlich
  - Keine sichtbaren Maengel
  - Arbeitsbereich sicher und sauber hinterlassen
  - Material/Geraete mitgenommen
  - Besonderheiten/Schaeden gemeldet
- Option: Endkontrolle wird vom Kollegen durchgefuehrt.
- Endkontrollen liegen unter Projekt > Dokumente > Endkontrolle.
- Projektpipeline zeigt gruenen Haken bei vorhandener Endkontrolle.

Zusatzverkauf:

- Aus Endkontrolle koennen Zusatzverkaeufe entstehen.
- Projekt bekommt auffaelligen Button:
  - Orange pulsierend: Zusatzverkauf erkannt
  - Gelb: Hinterlegtes Potenzial
  - Gruen: Zusatzverkauf angeboten
- Gruen nur, wenn wirklich Angebot gespeichert wurde.
- Aktionen:
  - Notiz ansehen
  - Angebot erstellen
  - Kunde wuenscht aktuell nicht
  - Kunde wuenscht gar nicht / Kein Interesse
- "Kunde wuenscht aktuell nicht" nutzt Aufgabenmodul zum Nachfassen.
- "Kein Interesse" schliesst Potenzial.

Potenziale:

- Eigener Unterpunkt unter Projekte.
- Eigene Tabelle, nicht normale Projektpipeline.
- Statusfilter:
  - Alle
  - Offen
  - Wiedervorlage
  - Faellig
  - Angeboten
  - Kein Interesse

## News-Feed / Ideen-Feed / Sales-Hub

Wichtige fachliche Trennung:

- Der bestehende Ideen-Feed bleibt Marketing-/Content-intern, z.B. fuer Reel-
  Ideen und Content-Abstimmung.
- Der neue News-Feed ist ein allgemeiner Unternehmensfeed.
- Der neue Sales-Hub ist der Arbeitsbereich fuer Vertriebler.

News-Feed:

- Eigener Hauptreiter in der Sidebar.
- Manuelle Beitraege mit Kommentaren und Reaktionen.
- Bilder koennen direkt am Beitrag hochgeladen werden; Speicherung erfolgt als
  JSON-Anhang am `NewsPost`.
- Bilder im Composer und im Feed werden als kompakte Thumbnails angezeigt.
  Grosse Darstellung nur per Klick/Lightbox, nicht in Originalgroesse direkt
  in der Timeline oder Maske.
- Feed-Beitraege sollen nicht vollbreit wie Tabellen wirken, sondern als
  zentrierte Social-Media-aehnliche Karten mit ruhiger Bilddarstellung.
- Reaktionen laufen als Emoji-Leiste; ein Benutzer hat jeweils eine aktive
  Reaktion, kann sie wechseln oder durch erneuten Klick entfernen.
- Abstimmungen sind direkt im Feed-Beitrag moeglich:
  - Frage
  - mehrere Antwortoptionen
  - Standard: eine Stimme pro Benutzer
  - optional: Mehrfachauswahl durch Ersteller
  - Stimmen liegen in `NewsPollVote`, damit jeder Benutzer kontrolliert nur
    passend abstimmen kann.
- Sichtbarkeit:
  - alle
  - Teams
  - einzelne Personen
  - Datenmodell ist auch fuer Abteilungen vorbereitet.
- Lesestatus pro Benutzer ist vorhanden.
- News-Feed ersetzt nicht die Notifications:
  - Notifications = konkrete Handlung/Alarm
  - News-Feed = Information/Timeline.
- API:
  - `/api/news-feed`
  - `/api/news-feed/comments`
  - `/api/news-feed/reactions`
  - `/api/news-feed/votes`
- Datenmodelle:
  - `NewsPost`
  - `NewsComment`
  - `NewsReaction`
  - `NewsReadState`
  - `NewsPollVote`

Sales-Hub:

- Eigener Hauptreiter in der Sidebar mit Unterreitern:
  - Uebersicht
  - Lead-Projekte
  - Potenziale
  - KuZu
  - Sales-Ziele
- Wichtige Entscheidung: Sales-Hub ist projektbasiert, keine zweite CRM-
  Pipeline neben den Projekten.
- Angebote benoetigen weiterhin immer ein Projekt.
- Lead-Projekte sind echte `WorkPilotProject`-Datensaetze mit Status
  `Lead / Klaerung` bzw. `statusCode = lead`.
- Zusatzverkauf laeuft ueber `ProjectPotential`.
- Sales-Ziele sind eine leichte Arbeitsliste fuer Vertriebler:
  Kunde/Projekt, Ziel/Grund, Zustaendigkeit, Prioritaet, Zielmonat,
  Wiedervorlage, Status und Historie.
- Die alte `SalesOpportunity`-Struktur bleibt defensiv im Schema/API, wird aber
  nicht mehr als Hauptprozess in der UI angeboten.
- APIs:
  - `/api/sales-targets`
  - `/api/sales-opportunities`
  - `/api/sales-opportunities/activities`
- Datenmodelle:
  - `SalesTarget`
  - `SalesOpportunity`
  - `SalesActivity`

KuZu:

- KuZu bedeutet Kundenzufriedenheit, nicht Kunden-Zusatzverkauf.
- Manuelle Bewertung ist im Sales-Hub moeglich:
  - Kunde
  - Rechnung
  - 1 bis 5 Sterne
  - Kommentar
  - Kontaktwunsch
  - Vertriebler
- Automatische Bewertungsanfrage:
  - Beim Rechnungsversand wird ein eindeutiger Bewertungslink erzeugt und in
    den Mailtext aufgenommen.
  - Oeffentliche Seite: `/feedback/[token]`
  - Formular ohne Login:
    - 5 anklickbare Sterne
    - Kommentar
    - Kontaktwunsch
- Hot-Alert:
  - bei 4 Sternen oder weniger
  - oder wenn Kontaktwunsch aktiv ist
  - erzeugt Notification fuer Admin/Geschaeftsfuehrung und den zustaendigen
    Vertriebler.
- APIs:
  - `/api/customer-feedback`
  - `/api/customer-feedback-requests`
  - `/api/public-feedback/[token]`
- Datenmodelle:
  - `CustomerFeedback`
  - `CustomerFeedbackRequest`

Zusatzverkauf:

- Bleibt fachlich getrennt von KuZu.
- Bestehendes `ProjectPotential` bleibt die Basis fuer Zusatzverkauf.
- Im Sales-Hub gibt es eine Potenzialansicht auf diese bestehenden Daten.
- Historie wird gespeichert.
- Kundenakte soll Reiter Potenziale haben.
- Spaeter: Bei neuer Projektanlage Warnung, wenn offenes Potenzial fuer Kunden
  existiert.

## Abwesenheiten / Uebergabe

- Abwesenheitsantraege mit Vertreterlogik.
- Bei neuen Urlaubsantraegen ist "Offene Aufgaben zu uebergeben" standardmaessig
  angehakt.
- Uebergabe-Aufgaben aus Urlaubsantraegen werden als echte Aufgaben angelegt.
- Ablehnung mit Grund soll fuer Antragsteller sichtbar/kommuniziert sein.
- Abwesenheiten wurden mit Feldern wie `dayPart`, `handoverTaskIds`,
  `requestGroupId` wiederhergestellt.

## Content-Management

Content-Management wurde als eigener Bereich aufgebaut:

- Richtlinien
- Ideen/Content
- Entwicklung/Einschaetzung/DISG je nach aktuellem UI-Stand

Produktive Modelle wiederhergestellt:

- `IdeaPost`
- `IdeaComment`
- `IdeaLike`
- `User.employeeAssessment`

Nicht loeschen, auch wenn UI im Moment nicht intensiv genutzt wird.

## Marketing-Modul / Projektkontingente

Update 2026-06-05:

- Marketing ist nicht gleich Social Media. Social Media ist nur eine Kategorie
  innerhalb allgemeiner Marketing-Arbeiten.
- Marketing-Arbeitsarten werden nicht hart codiert, sondern aus
  `Artikel & Leistungen` abgeleitet. Relevant sind aktive Leistungen/Pakete mit
  `isPlanningRelevant = true`, `defaultPlanningBoard = OK solutions` und
  `defaultPlanningGroup = Marketing`. Kategorien wie Social Media, Design,
  Print, Web und Sonstiges kommen aus dem Katalog.
- Praxis-Korrektur: Importierte Marketing-Leistungen koennen Board/Gruppe noch
  leer haben. Das Marketing-Modul darf sie trotzdem anbieten, wenn Kategorie
  `Marketing` enthalten ist oder der Katalog-Nummernkreis mit `OKM` beginnt.
  Das macht die Bedienung robuster, ohne jede Altleistung erst perfekt
  nachzupflegen.
- Projekte im Gewerk `Marketing` haben in der Projektakte einen eigenen Reiter
  `Marketing`. Dort werden Monatskontingente je Leistung gepflegt, daraus
  Arbeitsstuecke erzeugt und nach Kategorie gruppiert ausgewertet.
- Der normale Projektaktenpunkt `Projektzeitkontingente` wird bei Marketing-
  Projekten ausgeblendet. Grund: Das Marketing-Monatskontingent ersetzt dort
  die allgemeine Stundenkontingent-Logik und ist fachlich genauer.
- Beispiele fuer Arbeitsstuecke: Reel, Instagram-Beitrag, Story, Logo-Design,
  Flyer-Design, Landingpage, Anzeige oder sonstige Marketing-Aufgabe.
- Jedes Arbeitsstueck hat Status, Verantwortlichen, Format-/Plattformdetails,
  Ergebnislink, Zusatzleistungskennzeichen und Istzeit.
- Arbeitsstuecke werden fuer Nutzer als einfache Karten dargestellt, gruppiert
  nach Leistung wie Reels, Beitraege, Storys, Design usw. Klick auf die Karte
  oeffnet die Detailmaske; Play/Pause/Stopp starten bzw. steuern direkt die
  Stempelung auf dieses Arbeitsstueck. Keine langen Bearbeitungstabellen als
  primaere Bedienoberflaeche verwenden.
- Marketing-Termine werden im Marketing-Reiter geplant. Jeder Termin erzeugt
  bzw. aktualisiert einen Planungsboard-Eintrag mit Quelle
  `marketingContent`, Board `OK solutions` und Gruppe `Marketing`, damit die
  Auslastung der Marketingabteilung im Planungsboard sichtbar bleibt.
- Stempelungen koennen optional auf ein Marketing-Arbeitsstueck gebucht werden.
  `ProjectTimeEntry` und `ActiveStampSession` haben dafuer optionale
  Marketing-Bezuege. Die bestehende Rechnungs-/Stempelverknuepfung bleibt
  fuehrend.
- Content-Management bleibt die uebergeordnete Marketing-Planung/Ideen- und
  Richtlinienebene. Konkrete Kundenkontingente und Soll/Ist-Erfuellung liegen
  fuehrend am Projektmonat im Marketing-Projekt.
- Neue Marketing-Erweiterungen sollen zuerst dieses Muster verwenden, statt
  fuer jede Marketing-Art eigene Reiter oder Tabellen zu bauen.

## Dokumente / PDF / Mail / MS365

Dokumente:

- Dokumente liegen unter Buchhaltung und Projekt-Dokumenten.
- PDF-Renderer fuer Angebote/Rechnungen nutzt Briefpapier/Hintergrund-PDFs.
- Dokumente sollen Outfit als CI-Schrift verwenden.
- PDF-Vorschau soll echte PDF sein, keine HTML-Naeherung.
- In Dokumentkoepfen ist `projectNumber` fachlich die Projektnummer. Diese
  darf in Angeboten, Rechnungen, Stornos und Taetigkeitsberichten nicht als
  `Kundennummer` beschriftet werden. Echte Kundennummern kommen aus Kontakten.

Mail:

- Zentrale Mailmaske wie HERO.
- Dokumenttypen:
  - Angebot
  - Rechnung
  - Stornorechnung
  - Taetigkeitsbericht
  - allgemeines Projektdokument
- Mailversand ueber Microsoft Graph `/me/sendMail`.
- `saveToSentItems: true`
- Versand wird in `DocumentMailDispatch` protokolliert.
- Angebot/Rechnung/Storno-Historie und Projektlogbuch werden ergaenzt.
- Signatur:
  - in Mitarbeitereinstellungen als HTML-Quellcode
  - Vorschau vorhanden
  - Mailmaske zieht Signatur des sendenden Benutzers
  - Wenn "Keine Signatur anzeigen" aktiv: keine Signatur.

MS365 OAuth:

- OAuth Start/Callback vorhanden.
- Benoetigte ENV-Werte:
  - `NEXT_PUBLIC_APP_URL`
  - `MS365_TENANT_ID`
  - `MS365_CLIENT_ID`
  - `MS365_CLIENT_SECRET`
  - `MS365_REDIRECT_URI`
- Berechtigungen:
  - Microsoft Graph Delegated `Mail.Send`
  - `offline_access`
  - `User.Read`
- Client Secret wurde historisch im Chat geteilt und lokal eingetragen. Spaeter
  sicherheitshalber rotieren.

## Buchhaltung > Dokumente / Rechnungen ALT

- Buchhaltung hat Unterpunkt Dokumente als zentrale Uebersicht fuer:
  - Rechnungen
  - Angebote
  - Stornos
  - Entwuerfe
  - ALT/HERO-Rechnungen
- HERO ALT Rechnungen aus Excel-Import wurden besprochen/teilweise gebaut.
- Unterpunkt `Rechnungen (ALT)`.
- ALT-Zahlen sollen in Auswertungen dort einfliessen, wo sinnvoll.

## Winterdienst-Automation

Neuer Bereich:

- Sidebar: Prozess/Automation > Winterdienst

Datenmodell:

- `WinterServiceRun`
- `Contact.isActivityReportRecipient`
- `WorkPilotProject.winterGritPackageItemId`
- `WorkPilotProject.winterGritPushPackageItemId`

API:

- `src/app/api/winter-service-runs/route.ts`

Funktion:

- Jeder Winterdienst-Einsatz wird separat erfasst.
- Felder:
  - Projekt
  - Kunde
  - Einsatzdatum
  - Monat
  - Einsatzart
  - Vorherbilder
  - Nachherbilder
  - Berichtstatus
  - Versandstatus
  - Rechnung/Entwurf-Verknuepfung
- Berichtsfahig nur mit mindestens 1 Vorher- und 1 Nachherbild.
- `Taetigkeitsberichte erstellen` erzeugt PDF je Einsatz.
- Bericht wird beim Projekt unter Dokumente > Taetigkeitsberichte abgelegt.
- `Taetigkeitsberichte versenden` sendet fertige Berichte per Mail.
- Dokument-Mail wurde fuer `activityReport` erweitert.
- Empfaenger:
  - markierter Taetigkeitsbericht-Empfaenger am Kontakt
  - sonst Projektansprechpartner
  - sonst Hinweis/Fehler.
- Allgemeine Projekt-Taetigkeitsberichte:
  - API: `/api/activity-reports`
  - Taetigkeitsberichte sind nicht mehr nur Winterdienst-spezifisch, sondern
    koennen in der Projektakte unter Dokumente > Taetigkeitsberichte erzeugt
    werden.
  - Quelle sind vorhandene Projektbilder aus `Bilder: Vorherbilder` und
    `Bilder: Nachherbilder`; bei Dauerlaeufern gilt der aktuell gewaehlte
    Projektmonat, bei Einmalprojekten alle Projektbilder.
  - In der Projektakte werden Taetigkeitsberichte im Dokumentordner
    projektweit gelistet, damit erstellte PDFs unabhaengig vom aktuell
    ausgewaehlten Projektmonat auffindbar bleiben. Der Inhalt neu erzeugter
    Dauerlaeufer-Berichte bleibt trotzdem auf den gewaehlten Monat begrenzt.
  - PDF wird ohne neue Tabelle als `ProjectLogbookEntry` mit Titel
    `Dokumente: Taetigkeitsberichte` und PDF-Anhang gespeichert.
  - Nummernkreis: `DOK-####`, fortlaufend aus vorhandenen
    Taetigkeitsbericht-Anhaengen abgeleitet.
  - PDF-Layout ist HERO-nah: Briefbogen-Template aus
    `public/offer-templates`, Titelseite mit Empfaenger/Dokumentdaten/Betreff
    und Folgeseiten auf Template-Seite 2. Vorher- und Nachherbilder sind
    getrennte Abschnitte mit sichtbaren Clips `VORHER` und `NACHHER`.
    Taetigkeitsberichte verwenden die CI-Schrift Outfit. Bildseiten sollen wie
    im HERO-Bericht moeglichst grossflaechig sein: ein Bild pro Seite innerhalb
    der Briefbogen-Raender, keine kleinen Rasterbilder.
  - Allgemeine Projekt-Taetigkeitsberichte verwenden keinen DOK-Nummernkreis
    mehr als sichtbare Bezeichnung. Dateiname/Bezeichnung folgen dem Muster
    `Taetigkeitsbericht_{Projektnummer}_{Monat}_{Jahr}`, z.B.
    `Taetigkeitsbericht_HAS-1_Mai_2026.pdf`.
  - Smartphone-JPEGs koennen eine EXIF-Ausrichtung enthalten. Der
    Taetigkeitsbericht-Generator muss diese Orientierung beim Einbetten
    beruecksichtigen, damit hochkant hochgeladene Bilder im PDF nicht quer
    erscheinen.
  - Winterdienst behaelt einen eigenen Taetigkeitsbericht-Flow. Im
    Winterdienst-Monat koennen fehlende Berichte gesammelt fuer alle Einsaetze
    mit Vorher- und Nachherbildern erstellt werden; bestehende Berichte duerfen
    nicht erneut erzeugt werden.
  - Bei Dauerlaeufer-Faktura wird fuer den Abrechnungsmonat automatisch ein
    passender Taetigkeitsbericht vorbereitet, sofern Vorher- und Nachherbilder
    vorhanden sind. In der Rechnungsmail wird der Taetigkeitsbericht als
    zusaetzlicher Anhang angeboten und standardmaessig aktiviert, wenn er
    vorhanden bzw. erzeugbar ist.
  - Projektbilder werden beim Upload fuer PDF-Berichte nur dann auf JPEG
    normalisiert, wenn sie nicht direkt PDF-tauglich sind. JPG und PNG bleiben
    im Original erhalten, damit die Bildqualitaet in Taetigkeitsberichten nicht
    unnoetig durch erneute Komprimierung leidet. Browser-taugliche, aber
    pdf-lib-ungeeignete Formate wie WebP/HEIC werden defensiv konvertiert. Wenn
    ein altes Bild nicht einbettbar ist, muss die Berichtserstellung mit klarer
    Fehlermeldung abbrechen statt ein PDF mit Platzhalterfehler zu speichern.
  - Projektbilder und Taetigkeitsbericht-PDFs werden in der Projektakte ueber
    die Logbuch-Anhaenge geloescht, nicht ueber neue Tabellen. Beim Loeschen
    wird zusaetzlich ein sichtbarer Historieneintrag geschrieben, damit im
    Ordner Taetigkeitsberichte nachvollziehbar bleibt, welcher Bericht entfernt
    wurde.
  - Manuelle Uploads in einer Dauerlaeufer-Monatsakte muessen im ausgewaehlten
    Projektmonat abgelegt werden, nicht automatisch im aktuellen Kalendermonat.
    Uploadwege ohne expliziten Monatskontext bleiben beim echten Uploaddatum.
    Konkret: Projektakte > Bilder und Projektakte > Dokumente senden bei
    Dauerlaeufern den ausgewaehlten Projektmonat als `createdAt` an
    `/api/project-logbook-entries`, damit hochgeladene Bilder/Dokumente nach
    dem Speichern im aktiven Monat sichtbar bleiben. Bei Einmalprojekten bleibt
    der Upload projektweit und nutzt den echten Uploadzeitpunkt.
  - Bild-Uploads in der Projektakte muessen vor dem Speichern webtauglich
    verkleinert/normalisiert werden, damit grosse Handyfotos nicht als zu
    grosser Base64-JSON-Request scheitern. Uploadfehler duerfen nicht still
    verschwinden; im Bilderbereich muss eine sichtbare Fehlermeldung erscheinen.
  - Der bestehende Winterdienst-Bericht bleibt funktional, soll aber spaeter
    perspektivisch denselben Generator nutzen.

Winterdienst-Abrechnung:

- Winterdienstpakete werden am Projekt gepflegt:
  - Paket fuer Streueinsatz
  - Paket fuer Streuen und Schieben
- Zuordnung in Projekt > Automatische Abrechnung sichtbar, wenn Projekt als
  Winterdienst erkannt wird.
- Erkennung ist robuster als nur `trade === "Winterdienst"`:
  Titel/Beschreibung/Projekttext werden mit geprueft.
- Button `Streueinsatz` bucht Paket auf Monatsentwurf.
- Button `Streuen und Schieben` bucht zweites Paket auf Monatsentwurf.
- Doppelbuchung desselben Einsatzes wird verhindert.
- Monatsentwurf wird vorbereitet/ergaenzt, nicht fakturiert.

Monatspicker:

- Winterdienst Monat nutzt Monat/Jahr-Picker.
- Projekt-Automatische-Abrechnung `Ab Monat` und `Bis Monat` nutzen denselben
  Picker.
- Aktueller Monat ist Standard.
- Alte Werte wie `April`/`Oktober` werden ausgefiltert.
- Zuletzt wurde am CSS gearbeitet, weil darunterliegende Buttons durchschienen.
  Der Header `.topline` wurde mit hoeherem z-index versehen, wenn Picker offen.
  Bei weiterer UI-Pruefung auf Layering achten.

## UI Lab / Design

- Unter Firmeneinstellungen wurde/ist ein UI-Lab vorgesehen.
- Ziel: Designrichtungen testen, ohne System global umzustellen.
- Moderne, ruhige Bedienoberflaeche.
- Login-Seite:
  - Outfit
  - grosse Card Radius ca. 30px
  - Inputs/Buttons 14-16px Radius
  - weiche Shadows `0 20px 60px rgba(15, 23, 42, 0.08)`
- Keine unnoetigen Marketingseiten; direkt nutzbare Arbeitsoberflaechen.

## Prisma / Datenmodell: kritische Wiederherstellungen

Mehrfach war `schema.prisma` unvollstaendig und `db push` wollte produktive
Tabellen/Felder loeschen. Das darf nicht passieren.

Wiederhergestellte/zu schuetzende Modelle/Felder u.a.:

- `Contact`
- `WorkPilotProject`
- `ProjectLogbookEntry`
- `ProjectTimeEntry`
- `DocumentTypeConfig`
- `DocumentTextTemplate`
- `Absence`
- `Invoice`
- `InvoiceLine`
- `InvoiceHistory`
- `InvoiceLineLabor`
- `LegacyInvoice`
- `ProjectPotential`
- `SchemaDataPatch`
- `IdeaPost`
- `IdeaComment`
- `IdeaLike`
- `WinterServiceRun`
- `User.notifyUpsell`
- `User.employeeAssessment`
- `User.profileImageDataUrl`
- `User.signature`
- `User.signatureHidden`
- `Absence.dayPart`
- `Absence.handoverTaskIds`
- `Absence.requestGroupId`
- Arbeitsposition-Felder:
  - `CatalogItem.isLaborPosition`
  - `OfferLine.isLaborPosition`
  - `InvoiceLine.isLaborPosition`

Bei jedem Prisma-Thema:

1. `npx.cmd prisma validate`
2. Wenn moeglich `npx.cmd prisma db push --skip-generate`
3. Keine Datenverlustwarnung akzeptieren.

## Bekannte technische Risiken

- Build-Cache / `.next` kann stoeren.
- Encoding-Altreste koennen vorkommen.
- Viele Tabellen werden defensiv in APIs angelegt; Prisma allein reicht nicht.
- UI ist stark in einer Datei konzentriert; gezielt arbeiten.
- Es gibt untracked/changed Dateien aus vorherigen Arbeiten. Nicht bereinigen,
  wenn nicht ausdruecklich beauftragt.
- Devserver nicht unnoetig neu starten, wenn er stabil laeuft.

## Update 2026-06-04: News-Feed, Sales-Hub, KuZu, Potenziale

Nach der urspruenglichen Uebergabe wurden weitere wichtige Funktionen
umgesetzt/entschieden. Diese Punkte sind fuer naechste Chats besonders wichtig.

### News-Feed

- Neuer Hauptreiter `News-Feed`.
- Unternehmensfeed getrennt vom Marketing-Ideenfeed.
- Beitragsanlage ueber Button `+ Neuer Beitrag`, nicht mehr als feste grosse
  Eingabemaske im Kopfbereich.
- Modal soll dem Standarddesign folgen:
  - dunkler Header
  - X-Schliessen-Button
  - saubere Abstaende
  - Footer-Aktionen rechts
- Bilder koennen hochgeladen werden.
- Bilder duerfen nicht in Originalgroesse die Maske sprengen:
  - Vorschau klein/gekachelt bzw. Social-Media-artig
  - grosse Ansicht nur bei Klick.
- Abstimmungen sind vorgesehen/teilweise umgesetzt:
  - eine Stimme pro User
  - Mehrfachauswahl nur wenn Ersteller es zulaesst.
- Feed-Optik wurde Richtung Instagram-Post entwickelt:
  - kompakter Beitrag
  - Autorzeile oben
  - Bildbereich
  - Reaktionen/Kommentare unten
  - keinen Weiterleiten-Button.
- Reaktionen sollen eher Daumen/Emoji-Sammlung sein, nicht nur Text
  `Reagieren`.

### Sales-Hub Grundsatz

- Sales-Hub bleibt projektbasiert, keine parallele Akquise-/Chancen-Pipeline.
- Sichtbare Reiter:
  - Uebersicht
  - Lead-Projekte
  - Potenziale
  - KuZu
  - Sales-Ziele
- `Akquise` und `+ Chance` wurden ausgeblendet/werden nicht als Hauptprozess
  genutzt.
- Angebote brauchen weiterhin ein Projekt.
- `SalesOpportunity` bleibt technisch erhalten, aber nicht als fuehrender
  Prozess verwenden.

### Lead-Projekte

- Lead-Projekte zeigen Projekte im Status `Lead / Klaerung`.
- Wenn fertige/aktive Projekte dort auftauchen, Statuslogik pruefen.
- Beispiel: HAS-1 darf nicht nur wegen eines Potenzials als Lead-Projekt gelten.

### Zusatzverkaufspotenziale

- Fachbegriffe:
  - `Wiedervorlage` wurde in der UI zu `Nachfassen`.
  - Statusclips deutsch anzeigen:
    - Offen
    - Nachfassen geplant
    - Nachfassen ohne Datum
    - Angeboten
    - Kein Interesse
- Status `lost`, `open`, `follow_up` koennen intern weiterhin existieren,
  duerfen in der UI aber nicht englisch erscheinen.
- `Nachfassen setzen` ist fachlich eigentlich eine Aufgabe. Entscheidung:
  - Keine zweite abgespeckte Aufgabenlogik bauen.
  - Nachfassen legt/oeffnet eine echte Aufgabe.
  - Nachfass-Aufgaben starten direkt mit Status `in Bearbeitung`.
- Die Potenzial-Historie:
  - sortiert neu nach alt, neustes Ereignis oben
  - Modal hat X-Schliessen-Button statt Fragezeichen.
- Potenzial-Tabellen:
  - Die fuehrende Optik/Inhalte sind die Tabellen aus Projektpipeline >
    Potenziale.
  - Sales-Hub > Potenziale nutzt dieselbe Render-Logik/Tabelle.
  - Projektpipeline zeigt je Bereich gefiltert.
  - Sales-Hub zeigt beide Bereiche zusammen: OK solutions und OK immocare.
  - Im Sales-Hub soll die Herkunft/Bereich erkennbar bleiben.
- Tabelleninhalt der fuehrenden Potenzialtabelle:
  - Status
  - Potenzial
  - Kunde
  - Projekt
  - Erkannt am
  - Nachfassen
  - Zuständig
  - Statusdauer
  - Letzte Aktion
  - Aktion
- Aktionen in der Potenzialtabelle sollen platzsparend als Dropdown
  `Aktion auswählen` erscheinen.
- Statusdauer als Clip anzeigen, nicht als gequetschter Fliesstext.
- Zeitformat beachten:
  - Gespeicherte ISO-/UTC-Zeiten mit `Z` muessen als Berliner Lokalzeit
    angezeigt werden.
  - Fehlerbeispiel: `2026-06-03T22:30Z` muss als `04.06.2026, 00:30`
    angezeigt werden, nicht als `03.06.2026, 22:30`.
  - Zentraler Parser `parseAppDateTime` darf UTC-Zeiten nicht kuenstlich als
    lokale Wandzeit interpretieren.

### Statusdauer und Eskalationen

- Statusdauer wird systemweit messbar:
  - Projekte
  - Aufgaben
  - Potenziale
  - Sales-Ziele
- Modelle/Logik:
  - `StatusTimelineEntry`
  - `StatusEscalationRule`
  - `StatusEscalationEvent`
- Regeln gehoeren in Firmeneinstellungen > Status-Regeln.
- Warnclips wie `seit 3 Tg.` oder `Toleranz überschritten`.
- Keine Meldungsflut: Eskalationsereignisse deduplizieren.

- Update 2026-06-04:
  - Default-Statusregeln werden fuer alle bekannten Projektstatus angelegt:
    `Lead / Klaerung`, `Angebot`, `Warten auf Kunde`, `Zur Planung bereit`,
    `Umsetzung`, `Endkontrolle`, `Zur Abrechnung bereit`, `Abgeschlossen`.
  - Default-Statusregeln werden fuer alle Aufgabenstatus angelegt:
    `offen`, `in Bearbeitung`, `wartet auf Rueckmeldung`, `ueberfaellig`,
    `erledigt`, `abgelehnt`, `archiviert`.
  - Normale Statuswechsel von Projekten/Aufgaben/Potenzialen/Sales-Zielen
    schreiben in `StatusTimelineEntry`.
  - Aufgaben-Sonderwege wie manuelles Archivieren, Wiederherstellen,
    automatische Archivierung und Annehmen/Ablehnen muessen ebenfalls
    `recordStatusTransition` nutzen.
  - Status-Eskalationen erzeugen deduplizierte App-Notifications und bei
    aktivem Daily-Report zusaetzlich einen Notification-Eintrag mit
    `channel = email`. Ein echter externer Mailversand laeuft weiterhin nur
    ueber vorhandene Mail-/Notification-Verarbeitung; nicht direkt aus der
    Status-Eskalationsroute Microsoft Graph aufrufen.
  - Statusdauer fuer Projekte ist in der Projekt-Pipeline als eigene Spalte
    neben `Status` sichtbar und zusaetzlich im Projektstatus-Menue.
  - Projekt-Pipeline-Tabellen nutzen eine feste, gemeinsame Spaltenbreite und
    eine gemeinsame Spaltenauswahl fuer OK solutions und OK immocare sowie
    Dauerlaeufer/Einmalig. Nicht pro Niederlassung trennen, solange beide
    fachlich dieselbe Projektliste verwenden.
  - Fuer historisierte Objekte wie Potenziale und Sales-Ziele darf die
    Statusdauer nicht ab API-Ladezeit oder letzter Bearbeitung zaehlen. Beim
    Seed/Korrigieren der offenen Timeline wird der Beginn der zusammenhaengenden
    Phase im aktuellen Status aus der Fachhistorie abgeleitet.
  - Projektstatus-Timeline darf beim Laden nicht auf `WorkPilotProject.createdAt`
    zurueckdatiert werden, wenn bereits ein echter Statuswechsel existiert.
    Sonst bleibt nach einem Statuswechsel die alte Projektdauer sichtbar.
    Rueckdatierung ueber `correctOpenStartedAt` nur fuer fachhistorische
    Objekte wie Potenziale/Sales-Ziele verwenden.
  - Auswertungen > Projekte nutzt fuer Projekt-Performance statusbasierte
    Prozesszeiten statt grober Laufzeit von Erzeugung bis Projektende.
    Dauerlaeufer und Einmalprojekte werden ueber einen Projektartfilter
    getrennt auswertbar. `Angebotsdurchlauf` misst bevorzugt
    `OfferHistory.eventType = email_sent` bis `Zur Planung bereit`; falls kein
    Versandereignis existiert, gilt Status `Angebot` bis `Zur Planung bereit`.
    Dauerlaeufer duerfen nicht ueber Gesamtlaufzeit bis Laufzeitende bewertet
    werden.
  - Auswertungen nutzen ausser Forecast & OP genau einen sichtbaren
    Zeitraumfilter in der oberen Filterzeile. Die fruehere Monatsleiste unter
    den Filtern wurde fuer Mitarbeitende und andere Reiter entfernt, weil sie
    die Logik doppelte. Forecast & OP behaelt seine Monats-/12-Monats-Navigation.
    Mitarbeitenden-Kennzahlen verwenden direkt den oberen Auswertungszeitraum.
    Der zweite prominente Projekt-Erstellungszeitraum wird nicht mehr sichtbar
    angeboten; falls interne Projektfilter ihn noch brauchen, wird er mit dem
    Hauptzeitraum synchron gehalten.
  - Normale Auswertungsreiter nutzen als Zeitraum-Presets nur noch:
    aktueller Monat, Vormonat, aktuelles Jahr, letzte 12 Monate inkl. aktuell
    und individueller Zeitraum. `Vorjahr` und `letzte 24 Monate` sind nicht
    mehr Standardoptionen. Forecast & OP bleibt eine rollierende 12-Monats-
    Ansicht, hat aber einen frei steuerbaren Startmonat inklusive Zurueck-/
    Vorwaerts-Navigation, damit auch vergangene Forecast-Monate inspizierbar
    sind.

### KuZu / Kundenzufriedenheit

- `KuZu` bedeutet Kundenzufriedenheit.
- Sales-Hub > KuZu:
  - keine grosse feste Erfassungsmaske auf der Seite.
  - Button `+ Bewertung` oeffnet Standardmodal.
  - Sterne als 5 anklickbare Sterne, kein schlichtes Select.
  - Feld `Vertriebler` wurde zu `Interviewer`.
  - Wenn Bewertung ueber Systemlink kommt: Interviewer = `WorkPilot`.
  - Kundenfeld hat Suchfunktion gegen Kontakte/Kunden aus der Datenbank.
  - Nach Kundenauswahl werden verfuegbare Rechnungen dieses Kunden angeboten.
  - Bewertungen sind getrennt darzustellen:
    - Manuell erfasste Bewertungen
    - Bewertungen aus Bewertungslink
    - Bewertungslinks
  - Tabellen mit gleichen Spalten muessen gleiche Spaltenbreiten haben.
  - Ueberschriften innerhalb Cards brauchen saubere Innenabstaende.
- Bewertung loeschen:
  - Rolle `GESCHAEFTSFUEHRER` darf Bewertungen loeschen.
  - Loeschen setzt verknuepfte Bewertungsanfrage wieder passend zurueck, wenn
    noetig.
- Kundenakte:
  - Bewertungen werden in einem separaten Reiter in der Kundenakte angezeigt.
- Auswertungen:
  - Unter Auswertungen gibt es/geben soll es einen Reiter `KuZu`.
  - Dort Durchschnitt/Sterneanzahl ueber alle Bewertungen und Detailliste.

### Bewertungslink beim Rechnungsversand

- Bewertungslink wird bei Rechnungen automatisch mitgesendet.
- Bei Angeboten/Stornos bleibt er raus.
- Nur Geschaeftsfuehrung darf den Haken fuer Mitsenden deaktivieren.
- Link soll in der Mail nicht als rohe URL erscheinen.
- Gewuenschte Darstellung:
  - optische Bewertungsbox/Karte
  - Sterne
  - Button `Jetzt bewerten`
  - Klick oeffnet Bewertungsformular.
- Mailvorschau darf nicht doppelt `Mit freundlichen Gruessen` enthalten.
- Wenn ueber den Link bewertet wird, muss Bewertung im System ankommen und in
  KuZu erscheinen.
- Bewertungslinks sind in KuZu sichtbar.

## Aktueller Stand direkt vor der Uebergabe vom 2026-06-03

Vor diesem Update war zuletzt umgesetzt:

- Winterdienst-Automation v1:
  - Datenmodell/API/UI
  - Taetigkeitsbericht-PDF
  - Versand ueber bestehende Maillogik
  - Projekt-Paketzuordnung
  - Sammelbuchung Streu-/Streu+Schieb-Paket
- Winterdienst-Paketzuordnung im Projekt optisch verbessert.
- Winterdienst-Monatsauswahl ersetzt:
  - erst Dropdown
  - dann Monat/Jahr-Picker
- Automatische Abrechnung `Ab Monat`/`Bis Monat` ebenfalls auf Monat/Jahr-Picker.
- Ungueltige Altwerte (`April`, `Oktober`) aus Monatsauswahl gefiltert.
- Picker-Layering mehrfach korrigiert:
  - Mindestbreite
  - Popover-Breite
  - hoeherer z-index
  - `.topline:has(.monthPickerPopover)` ueber darunterliegenden Inhalten.

Zuletzt erfolgreiche Pruefungen:

- `npx.cmd tsc --noEmit`
- `git diff --check`
- `npx.cmd prisma validate`
- `npx.cmd prisma db push --skip-generate` lief bei Winterdienst-Schema ohne
  Datenverlustwarnung.

## Naechste sinnvolle Pruefpunkte

1. UI visuell pruefen:
   - Winterdienst-Monatspicker, ob Button wirklich nicht mehr durchscheint.
   - Projekt > Automatische Abrechnung Monatspicker.
2. Winterdienst fachlich testen:
   - Einsatz ohne Bilder nicht berichtsfaehig.
   - Einsatz mit Vorher/Nachher erzeugt PDF.
   - PDF oeffnen.
   - Empfaenger fuer Taetigkeitsberichte am Kontakt setzen.
   - Versand pruefen.
   - Projekt ohne Paketzuordnung zeigt klare Fehlermeldung.
   - Streueinsatz / Streuen und Schieben bucht nur einmal.
3. Stapelabrechnung gegenpruefen:
   - Entwurfserstellung
   - Faktura durchfuehren
   - Stempelzeiten werden nur bei finaler Fakturierung verknuepft.
4. Auswertungen pruefen:
   - Mitarbeitende Verkaufte Std.
   - SVS nur Arbeitspositionen
   - Forecast/OP mit plannedExecutionMonth.
5. Prisma/DB synchron halten.

## Umgang mit historischen Word-Chats

Die Word-Dateien enthalten mehr Detailverlauf als diese kompakte Uebergabe.
Wenn ein neuer Chat Zweifel an einer alten Entscheidung hat, gezielt in den
DOCX-Dateien bzw. extrahiertem Text suchen. Nicht automatisch aus dem Kopf
gegen diese Uebergabe arbeiten.

Empfohlene Suchbegriffe:

- Stapelabrechnung
- Rechnungsentwurf
- Forecast
- SVS
- Arbeitsposition
- LK-Satz
- Planungsgruppe
- Projektzeitkontingent
- Stempelung
- Endkontrolle
- Potenzial
- Aufgabe annehmen
- MS365
- Winterdienst

## Dashboard-Layout-Entscheidung

- Die Dashboard-Startseite bleibt ein rollenbasiertes Kachel-Cockpit.
- Sichtbar bleiben vier Hauptkacheln: Finanzen, Leistung, Aufgaben,
  Projekte & Planung.
- Die Kacheln haben feste Hoehen und wechseln ihre Kennzahlen innerhalb der
  Kachel per Slider, damit neue Kennzahlen nicht zu immer mehr Kacheln fuehren.
- Der Kennzahlwechsel soll sichtbar animiert sein; der Slider-Footer mit
  Pfeilen und Dots bleibt unten in der Kachel immer sichtbar und muss eine
  eigene Bedienzone haben, die nicht von Chips/Text ueberdeckt wird.
- Die vier Kacheln werden hoehenmaessig am Block `Aktuelle Stempelungen`
  ausgerichtet.
- Farbige Kopfleisten in Dashboard-Kacheln werden vermieden; erlaubt ist eine
  einheitliche schwarze Kopflinie. Status und Dringlichkeit werden ueber
  ruhige Chips/Badges dargestellt.
- Waehrungswerte werden per `Intl.NumberFormat` formatiert, damit das
  Euro-Zeichen nicht durch Datei-Encoding beschaedigt wird.

## Update 2026-06-05: Letzter Arbeitsstand Dashboard/Auswertungen

Zuletzt wurde schwerpunktmaessig am Dashboard und angrenzenden Auswertungs-
und Statuslogiken gearbeitet.

Wichtig fuer naechste Chats:

- Dashboard:
  - Die fruehere Logik mit vielen einzelnen Kennzahl-/Modulkarten wurde in
    ein ruhiges Cockpit mit vier Hauptkacheln ueberfuehrt:
    `Finanzen`, `Leistung`, `Aufgaben`, `Projekte & Planung`.
  - Jede Hauptkachel enthaelt mehrere Slides/Kennzahlen. Diese wechseln
    automatisch ca. alle 10 Sekunden.
  - Nutzer koennen Slides manuell ueber Pfeile und Punkte wechseln.
  - Hover/Fokus auf einer Kachel pausiert den automatischen Wechsel.
  - Der Slider-Footer muss dauerhaft unten in der Kachel bedienbar bleiben;
    Chips/Text duerfen ihn nicht ueberdecken.
  - Neue Dashboard-Kennzahlen sollen bevorzugt als weiterer Slide in einer der
    vier Kacheln landen, nicht als zusaetzliche Hauptkachel.
  - Umsatz/Forecast bleiben sichtbar, aber GF-/Admin-sensible Details muessen
    weiterhin rollenbasiert begrenzt bleiben.
  - `Aktuelle Stempelungen` bleibt ein fester sichtbarer Block fuer alle
    Rollen und ist hoehenmaessig Referenz fuer das Kachel-Cockpit.
- Rollen:
  - `VERTRIEB` ist als eigene Rolle aufgenommen.
  - `VERTRIEB` darf vertriebsnahe Dashboard-/Sales-Hub-Sichten erhalten, aber
    keine Geschaeftsfuehrungs- oder Adminrechte implizieren.
  - Bei Rollenpruefungen immer explizit pruefen, ob `VERTRIEB` fachlich
    gemeint ist, statt sie versehentlich mit Fuehrung/Admin gleichzusetzen.
- Auswertungen:
  - Projekt-Auswertungen wurden fachlich Richtung Prozesszeiten statt grober
    Gesamtlaufzeit angepasst.
  - Einmalprojekte und Dauerlaeufer muessen getrennt auswertbar bleiben.
  - Angebotsdurchlauf misst bevorzugt Angebotsversand bis `Zur Planung bereit`;
    falls kein Versandereignis existiert, gilt Status `Angebot` bis
    `Zur Planung bereit`.
  - Normale Auswertungsreiter sollen nur einen oberen Zeitraumfilter nutzen.
    Forecast & OP behalten ihre eigene rollierende 12-Monats-Navigation.
- Statusdauer:
  - Statusdauer/Eskalationen sind fuer Projekte, Aufgaben, Potenziale und
    Sales-Ziele als dauerhaftes Konzept angelegt.
  - Statuswechsel muessen ueber `recordStatusTransition` laufen, auch bei
    Aufgaben-Sonderwegen wie Archivieren, Wiederherstellen, Annehmen/Ablehnen.
  - Keine Eskalations-Meldungsflut: Ereignisse deduplizieren.
- UI-/Encoding-Hinweis:
  - Waehrungswerte im Dashboard ueber `Intl.NumberFormat` ausgeben.
- Bei sichtbaren Textaenderungen auf alte Encoding-Reste achten, aber keine
  breite Encoding-Reparatur ohne Auftrag starten.
- Update 2026-06-05: Encoding-Reparaturen duerfen nicht mit breiten
  Fragezeichen-/Operator-Ersetzungen ueber ganze TSX-Dateien laufen. Das kann
  TypeScript-Operatoren wie `?`, `??`, `?.` und JSX-Ternaries beschaedigen.
  Stattdessen nur konkrete Mojibake-Sequenzen in sichtbaren Texten ersetzen
  und danach immer `npx.cmd tsc --noEmit` sowie eine gezielte `rg`-Suche auf
  `Ã|Â|â|�` in den betroffenen UI-Dateien laufen lassen.
- Incident 2026-06-05: Bei einer Encoding-Korrektur wurden uncommitted
  Dashboard-/Marketing-UI-Aenderungen in `dashboard-page.tsx` und
  `dashboard.module.css` durch Wiederherstellung aus dem Git-Stand
  ueberschrieben. Regel ab sofort: Niemals `git show HEAD:... > Datei`,
  `git checkout -- Datei` oder gleichwertige Wiederherstellungen auf geaenderte
  Arbeitsdateien anwenden, ohne vorher die konkrete Diff zu sichern und den
  Nutzer ausdruecklich freigeben zu lassen. Lokale Rettungs-Backups nie im
  selben Arbeitsgang wieder loeschen. Bei grossen UI-Dateien vor riskanten
  Reparaturen zusaetzlich eine Patch-/Kopiedatei ausserhalb des betroffenen
  Zielpfads anlegen.

Offene Pruefpunkte nach diesem Arbeitsstand:

1. Dashboard visuell im Browser pruefen:
   - vier Kacheln, gleiche ruhige Wirkung, keine ueberdeckten Slider-Controls.
   - Auto-Wechsel, manuelle Pfeile/Punkte, Hover-/Fokus-Pause.
   - Rollenansichten fuer Geschaeftsfuehrung, Fuehrungskraft, Vertrieb,
     Mitarbeiter.
2. Technisch nach Codeaenderungen mindestens laufen lassen:
   - `npx.cmd tsc --noEmit`
   - `git diff --check`
3. Falls Prisma-/Statusmodelle weiter beruehrt werden:
   - `npx.cmd prisma validate`
   - `npx.cmd prisma db push --skip-generate`
   - Keine Datenverlustwarnung akzeptieren.

## Update 2026-06-05: Letzter Arbeitsstand Marketingmodul

Nachkorrektur zur letzten Einordnung: Der unmittelbare letzte fachliche
Schwerpunkt war das Marketingmodul bzw. Content-Mgmt, nicht nur das Dashboard.
Die Dashboard-Notizen bleiben als relevante Entscheidung bestehen, aber fuer
den aktuellen Anschluss ist vor allem dieser Marketing-Stand wichtig.

Umgesetzt/angelegt:

- Neues API-Modul: `src/app/api/marketing-content/route.ts`
- Neue defensive Tabellen/Modelle:
  - `MarketingContentQuota`
  - `MarketingContentItem`
  - `MarketingContentSchedule`
- Defensive Zusatzfelder:
  - `PlanningEntry.marketingContentItemId`
  - `PlanningEntry.marketingContentScheduleId`
  - `ActiveStampSession.marketingContentItemId`
  - `ActiveStampSession.marketingContentTitle`
  - `ActiveStampSession.marketingContentType`
  - `ProjectTimeEntry.marketingContentItemId`
  - `ProjectTimeEntry.marketingContentType`
- `planning-entries`, `stamp-session` und `project-time-entries` wurden so
  erweitert, dass Marketing-Arbeitsstuecke durch Planung und Stempelung
  nachvollziehbar bleiben.

Fachliche Logik:

- Marketing arbeitet projektbezogen, nicht als komplett separate Pipeline.
- Marketing-Projekte werden ueber `trade`/Gewerk `Marketing` erkannt.
- Monatskontingente werden aus `Artikel & Leistungen` gepflegt.
- Als Marketing-Leistungen gelten aktive, planungsrelevante Leistungen/Pakete,
  wenn z.B. `defaultPlanningGroup = Marketing`, Kategorie Marketing oder eine
  passende Nummer wie `OKM...` verwendet wird.
- Aus einem Monatskontingent werden konkrete Marketing-Arbeitsstuecke erzeugt,
  z.B. Posts, Reels, Beitraege oder sonstige Content-Einheiten.
- Arbeitsstuecke haben Status wie:
  - `Offen`
  - `In Arbeit`
  - `Freigabe`
  - `Erledigt`
  - `Veroeffentlicht`
  - `Abgeschlossen`
- Arbeitsstuecke koennen Verantwortliche, Plattform, Formatdetails, geplantes
  Datum, Faelligkeit und Asset-Link tragen.
- Zusaetzliche Arbeitsstuecke sollen moeglich sein, ohne das urspruengliche
  Kontingent zu zerstoeren.

Planung/Stempelung:

- Marketing-Termine werden aus einem Marketing-Arbeitsstueck heraus geplant.
- Beim Speichern eines Marketing-Termins wird automatisch ein `PlanningEntry`
  mit `source = marketingContent`, Board `OK solutions` und Gruppe `Marketing`
  angelegt bzw. aktualisiert.
- Das Loeschen eines Marketing-Termins markiert auch den verknuepften
  Planungseintrag defensiv als geloescht.
- Stempelungen koennen direkt auf ein Marketing-Arbeitsstueck gestartet werden.
- Beim Stoppen der Stempelsession wird der Bezug zum Marketing-Arbeitsstueck in
  `ProjectTimeEntry` gespeichert, damit Soll/Ist je Arbeitsstueck auswertbar
  bleibt.

UI-Stand:

- Content-Mgmt wurde in der Navigation verkuerzt als `Content-Mgmt`.
- Unter Content/Marketing gibt es bzw. entsteht:
  - Redaktionsplan mit Monats-/Wochen-/Tagesansicht.
  - Content-Freigaben/Korrekturen.
  - Kontingentansicht.
  - Ideenbereich.
- In Projektakten gibt es einen Marketing-/Content-Kontext mit Suche und
  Zugriff auf Marketing-Arbeitsstuecke.
- Marketing-Arbeitsstuecke werden visuell als Kachel-/Boardansicht gruppiert
  nach Typen wie Reels, Beitraege/Posts usw.; die alte Listenansicht ist nicht
  fuehrend.
- Update UI 2026-06-05: Die Terminplanung fuer Marketing-Arbeitsstuecke wird
  ueber den Button `Planen` an der jeweiligen Arbeitsstueck-Karte gestartet.
  Der Button oeffnet die bestehende Content-/Redaktionsplan-Maske als Modal,
  damit Contentdaten, Arbeitszeitraum, Freigaben und Planungsboard-Buchung in
  einem Schritt gepflegt werden. Unterhalb der Karten bleibt nur die Liste der
  bereits geplanten Marketing-Termine.
- Sobald fuer ein Marketing-Arbeitsstueck mindestens ein Termin existiert,
  zeigt die Karte den Planungsbutton als ruhigen gruenen Zustand `Geplant`.
  Der Button bleibt klickbar, damit der Termin bzw. eine neue Planung geoeffnet
  werden kann. Auf zusaetzliche Icon-Kreise im Button verzichten, weil sie auf
  den kleinen Karten unruhig wirken.
- Beim Speichern eines Marketing-Termins soll der Termin sowohl im
  Planungsboard als auch im Redaktionsplan/Content-Kalender sichtbar werden.
  Aktuell wird dafuer zusaetzlich ein Content-Eintrag aus dem Marketing-
  Arbeitsstueck angelegt. Bei spaeterer Nacharbeit pruefen, ob wiederholtes
  Planen desselben Arbeitsstuecks bestehende Redaktionsplan-Eintraege
  aktualisieren statt Duplikate anzulegen.
- Update UI 2026-06-05: Das Anlegen/Aktualisieren eines Monatskontingents
  erzeugt fehlende Marketing-Arbeitsstuecke direkt mit. Ein separater Button
  `Arbeitsstuecke erzeugen` im Kopf des Marketingmoduls ist nicht fuehrend,
  weil er fuer Nutzer keinen klaren Zusatznutzen hat.
- Die rechte Projektseitenleiste darf bei Marketingprojekten nicht die normale
  Dauerlaeufer-/Projektzeitkontingent-Karte anzeigen. Stattdessen wird dort
  eine Marketing-Kontingent-Uebersicht fuer den Berichtsmonat angezeigt
  (Arbeitsstuecke, Sollzeit, gestempelte Zeit, geplante Zeit).
- Der Bereich `Content-Kontingente` zeigt aktuelle Marketing-Arbeiten des
  laufenden Monats und fuehrt per Aktion zur passenden Projektakte.
- Content-Mgmt > Kundenkontingente nutzt fuer aktuelle Marketing-Arbeiten
  ausschliesslich das Kartenboard und zeigt alle Arbeitsstuecke des laufenden
  Monats. Keine kuenstliche Kartenbegrenzung setzen, weil sonst z.B. Reels
  hinter Beitraegen/Storys verschwinden. Keine alte Listen-/Feldansicht unter
  dem Kartenboard anzeigen.
- Bei vielen Kunden darf Content-Mgmt > Kundenkontingente nicht als flaches
  Kartenmeer dargestellt werden. Fuehrende Struktur ist:
  Kunde > Projekt > Kartentypen/Karten. Zusaetzlich braucht die Ansicht
  kompakte Filter fuer Suche, Kunde, Projekt und Typ. Der Projektkontext ist
  fachlich wichtig, weil ein Kunde mehrere Marketingprojekte haben kann.
  Kundengruppen sind auf- und zuklappbar, damit die Liste bei vielen Kunden
  nicht endlos offen bleibt. Projektgruppen darunter bleiben einfache offene
  Projektbloecke ohne zweiten Collapse-Toggle, weil doppelte Aufklappung in der
  aktuellen Nutzung unruhig wirkt.
- Die drei oberen Kacheln in Content-Mgmt > Kundenkontingente sind Filter:
  alle Monatskontingente/Arbeiten, offene Arbeiten und geplante Arbeiten.
  Geplante Marketing-Karten muessen dort denselben ruhigen gruenen
  `Geplant`-Zustand zeigen wie in der Projektakte. Die Karten muessen in dieser
  Uebersicht ebenfalls direkt planbar bleiben; `Planen`/`Geplant` oeffnet die
  bestehende Content-/Redaktionsplan-Maske, nicht ein separates
  Marketing-Terminfenster. Beim Speichern dieser Maske werden Content-Eintrag
  und Planungsboard-Termin gemeinsam angelegt bzw. aktualisiert.
- Klick auf `Geplant` soll die bestehende Marketing-Planung laden und
  bearbeiten, nicht eine leere neue Planung vorbereiten. Dafuer die
  `MarketingContentSchedule.id` in der Maske halten und beim Speichern an
  `/api/marketing-content` mitgeben, damit `saveSchedule` den vorhandenen
  Termin plus Planungsboard-Eintrag aktualisiert.
- Redaktionsplan-Synchronisierung fuer Marketing: Der im Marketing-Termin
  geplante Zeitraum wird im Content-Eintrag als `Arbeitsstart`
  (`productionStartDate`/`productionStartTime`) bis `Fertigstellung`
  (`productionDueDate`/`productionDueTime`) gespeichert. Freigabe- und
  Veroeffentlichungsfelder bleiben separat fuer den Eskalations-/Freigabeprozess.
  Beim erneuten Planen desselben Marketing-Arbeitsstuecks soll ein vorhandener
  Redaktionsplan-Eintrag aktualisiert werden, statt Duplikate anzulegen.
- In der Content-/Redaktionsplan-Maske fuer Marketing-Karten sollen `Kanal` und
  `Format` nicht als sichtbare Felder erscheinen. Die Werte bleiben intern im
  Content-Draft/API-Payload erhalten und werden aus Kontext/Marketing-Karte
  gesetzt, damit bestehende Filter/Auswertungen nicht brechen.

Wichtige Regeln fuer Weiterentwicklung:

- Marketing-Kontingente nicht mit alten Angebots-Vorgabezeiten vermischen.
  Quelle fuer Marketing-Sollmengen sind Artikel/Leistungen und gespeicherte
  Monatskontingente.
- Planungsboard-Integration fuer Marketing ueber `source = marketingContent`
  erhalten.
- Marketing-Zeiten muessen ueber `marketingContentItemId` am Arbeitsstueck
  auswertbar bleiben.
- Keine harten Loeschungen von Terminen/Planungen, wenn ein defensives
  `deletedAt` reicht. Ausnahme aktuell: `deleteItem` entfernt das
  Marketing-Arbeitsstueck nach vorherigem Soft-Delete der verknuepften
  Termine/Planungen; hier vor produktiver Nutzung noch fachlich pruefen, ob
  Arbeitsstuecke ebenfalls soft-delete bekommen sollen.
- Bei Prisma-Aenderungen am Marketingmodul immer auch die defensive
  Ensure-Logik in `/api/marketing-content` und den betroffenen Zeit-/Planungs-
  APIs synchron halten.

Offene Pruefpunkte Marketing:

1. Marketingprojekt oeffnen und Monatskontingent aus Artikel & Leistungen
   speichern.
2. Arbeitsstuecke aus dem Kontingent erzeugen und pruefen, dass keine
   Duplikate entstehen.
3. Arbeitsstueck terminieren und pruefen, ob der Termin im Planungsboard als
   Marketing-Planung erscheint.
4. Termin loeschen und pruefen, ob der Planungsboard-Eintrag ausgeblendet wird.
5. Stempelung auf ein Marketing-Arbeitsstueck starten/stoppen und Soll/Ist je
   Arbeitsstueck pruefen.
6. Rolle/Rechte pruefen: Marketing darf keine ungewollten GF-/Adminrechte
   erhalten.
7. Encoding im Marketingbereich gezielt pruefen; sichtbare Umlaute duerfen
   nicht als Mojibake erscheinen.

## Incident-Audit 2026-06-05: Verlorene UI-Aenderungen nach Dashboard-Reset

Bei einer fehlerhaften Encoding-Reparatur wurden `src/components/dashboard/dashboard-page.tsx`
und `src/components/dashboard/dashboard.module.css` auf den Git-Stand
zurueckgesetzt. Dadurch gingen uncommitted UI-Aenderungen in diesen beiden
Dateien verloren. Backend-/API-/Prisma-Arbeiten sind nach aktueller Pruefung
weitgehend noch vorhanden.

Regel fuer Folgearbeiten:

- Zuerst verlorene UI-Bereiche einzeln wiederherstellen und nach jedem Block
  mit `npx.cmd tsc --noEmit` und `git diff --check` pruefen.
- Vor jedem Wiederaufbau-Block eine Patch-/Dateisicherung anlegen.
- Marketing kommt zuletzt. Wichtiger sind zuerst die bereits saubereren
  Projektakten-Funktionen fuer Checklisten, Taetigkeitsberichte und
  Stempelungs-Kommentare.
- Keine breiten Encoding-Reparaturen und keine Wiederherstellung aus Git ohne
  ausdrueckliche Freigabe.

Bestand nach Audit:

- Noch vorhanden:
  - `src/app/api/activity-reports/route.ts` fuer allgemeine
    Projekt-Taetigkeitsberichte.
  - `src/app/api/smoke-detector-reports/route.ts` fuer
    Rauchmelder-Installationsnachweise.
  - `src/app/api/winter-service-runs/route.ts` fuer Winterdienst-Einsaetze und
    Winterdienst-Taetigkeitsberichte.
  - `src/app/api/document-mail/route.ts` mit `activityReport`-Mailart und
    Logik fuer zusaetzliche Taetigkeitsbericht-Anhaenge.
  - `Contact.isActivityReportRecipient` in Prisma und Contacts-API.
  - Marketing-APIs, Prisma-Modelle und Content-Arbeitsstart-Felder.
- In der aktuellen UI verloren oder nicht mehr angeschlossen:
  - Projektakte > Checklisten als Cockpit/Vorlagenliste.
  - Rauchmelder-Checkliste/Formular inklusive PDF-Erzeugung ueber
    `/api/smoke-detector-reports`.
  - Projektakte > Dokumente > Taetigkeitsberichte: Erzeugen allgemeiner
    Projekt-Taetigkeitsberichte aus Vorher-/Nachherbildern.
  - Projektakte/Rechnungsmail-Workflow: sichtbare Bedienung zum Mitgeben
    vorhandener Taetigkeitsberichte, soweit sie vorher in der UI vorhanden war.
  - Projektakte > Termine & Stempelungen: kompakter Kommentar-Clip
    `Kommentar`/`Kein Kommentar` in `Erwartete Stempelungen` mit Detailansicht.
  - Anzeige-/Filterlogik fuer manuelle Stempelungen, soweit sie nur in der UI
    lag.
  - Dashboard-Cockpit mit vier Hauptkacheln `Finanzen`, `Leistung`,
    `Aufgaben`, `Projekte & Planung`; aktueller UI-Stand zeigt wieder den
    aelteren Modul-/Ausbaupfad-Block.
  - Content-Mgmt > Kundenkontingente und Marketing-Projektkartenboard laut
    Marketing-Abschnitt oben.
- Hinweisquelle:
  - `.next/static/webpack/app/dashboard/page.*.hot-update.js` enthaelt
    Treffer zu Rauchmelder, Taetigkeitsbericht, Kundenkontingente und
    Marketing. Diese Dateien koennen beim Wiederaufbau als Orientierung dienen,
    duerfen aber nicht blind als Quellcode uebernommen werden.

Empfohlene Wiederaufbau-Reihenfolge:

1. Projektakte > Termine & Stempelungen: Kommentar-Clip in erwarteten
   Stempelungen wiederherstellen.
2. Projektakte > Checklisten: Cockpit/Vorlagenliste und Rauchmelder-
   Installationsnachweis wieder anschliessen.
3. Projektakte > Taetigkeitsberichte: allgemeine Berichtserstellung und
   sichtbarer Versand-/Anhang-Workflow wiederherstellen.
4. Winterdienst-UI gegenpruefen und nur fehlende Anschluesse wiederherstellen,
   weil Backend noch vorhanden ist.
5. Dashboard-Cockpit/Auswertungsdetails wieder auf den dokumentierten Stand
   bringen.
6. Marketingmodul zuletzt wiederherstellen.

Vom Nutzer zusaetzlich konkret als verloren bemerkt:

- Sales-Hub.
- Unternehmens-Feed / News-Feed.
- KuZu: Kundenzufriedenheitstool inklusive Bewertungslink-/Versandlogik.
- Checkliste fuer Rauchmelder.
- Kommentar bei Stempelungen.
- Sidebar-Reiter `Prozess/Automation`.
- Dashboardkacheln.
- Buchhaltung > Dokumente.

Diese Punkte muessen vor dem Marketing-Wiederaufbau geprueft und priorisiert
werden. Wichtig: Bei jedem Punkt zuerst feststellen, ob Backend/API noch
vorhanden ist und nur der UI-Anschluss fehlt. Danach erst UI schrittweise
wiederherstellen. Keine zusammengefassten Grossreparaturen.

Wiederaufbau begonnen 2026-06-05:

- Vor Beginn wurde ein Sicherheitspatch unter `.codex-safety/` angelegt.
- Hauptnavigation wurde wieder um `News-Feed`, `Sales-Hub` und
  `Prozess/Automation` ergaenzt.
- `Sales-Hub` ist wieder als aufklappbare Gruppe angelegt mit:
  - `Uebersicht`
  - `Potenziale`
  - `KuZu`
  - `Sales-Ziele`
- `Prozess/Automation` ist wieder als aufklappbare Gruppe angelegt, zunaechst
  mit `Winterdienst`.
- Die Detailseiten dieser wiederhergestellten Einstiege zeigen vorerst den
  vorhandenen Modul-im-Aufbau-Bereich, bis die eigentlichen alten UI-Ansichten
  einzeln rekonstruiert werden.
- Projektakte > Termine & Stempelungen: In `Erwartete Stempelungen` wurde der
  Kommentar-Clip wiederhergestellt. Echte Stempelkommentare erscheinen als
  Clip `Kommentar`, leere/alte automatische Kommentare als `Kein Kommentar`.
  `Manuell hinzugefuegt` gilt weiterhin nicht als echter Kommentar.
- Nachtrag: Der separate Clip `Manuelle Stempelung` wurde ebenfalls
  wiederhergestellt. Er basiert auf `entrySource = manual` und steht bewusst
  neben dem Kommentar-Clip, damit manuelle Erfassung nicht als Kommentar
  missverstanden wird.
- Projektkopf-Fortschrittskreis `Planung` wurde wieder auf Monatslogik
  gestellt: Wenn fuer den ausgewaehlten Projektmonat ein Monatskontingent
  existiert und die geplanten Termine dieses Kontingent voll abdecken, ist der
  Kreis gruen. Bei Teilplanung bleibt er gelb/teilweise, ohne Planung offen.
  `TerWu`/Terminstatus prueft ebenfalls Termine/Terminwuensche im
  ausgewaehlten Monat statt irgendeinen Termin im Gesamtprojekt.
- Nachkorrektur: Bei Projekten mit Monats-/Projektzeitkontingenten nutzen
  `TerWu` und `Planung` dieselbe Kontingentlogik. Gruener Haken nur, wenn das
  Monatskontingent exakt durch Termine/Terminwuensche abgedeckt ist. Keine
  Planung, Teilplanung oder Ueberplanung zeigt einen gelben Warnkreis mit
  Ausrufezeichen. Projekte ohne Monatskontingente behalten die bisherige
  Angebots-/Planungslogik.
- Fachliche Schaerfung: Ein bestaetigter Termin uebersteuert einen
  Terminwunsch. Fuer `TerWu` und `Planung` zaehlt daher am Ende die Summe aller
  nicht geloeschten Termine/Terminwuensche im relevanten Monat gegen das
  gespeicherte Monatskontingent. Wenn z.B. 10,00 von 10,00 Std. verplant sind,
  muessen beide Kreise gruen sein, auch wenn die Eintraege bestaetigte Termine
  und keine offenen Terminwuensche mehr sind. Die zusaetzliche
  Projektlaufzeit-/Faelligkeitspruefung darf diesen gruenen Zustand nicht
  verhindern, sobald ein Monatskontingent fuer diesen Monat gespeichert ist.
- Die zentrale Monatsleiste in der Projektakte wurde wiederhergestellt. Sie
  sitzt unter dem Projektkopf und vor dem Fortschrittskreis, zeigt einen
  13-Monats-Ausschnitt mit drei Monaten davor und neun Monaten danach und kann
  per `Monat <` / `Monat >` verschoben werden. Der aktive Monat steuert die
  Monatsakte: Fortschrittskreis, Planungstermine, Stempelungen,
  Monatskontingentwerte und monatsbezogene Historien/Auswertungen muessen sich
  auf diesen sichtbaren Projektmonat beziehen. Keine versteckten Fallbacks auf
  andere Monate verwenden, sobald die Monatsleiste sichtbar ist.
- Einschraenkung: Diese Monatsleiste und der Monatsaktenfilter sind nur fuer
  Dauerlaeufer-Projekte relevant. Einmalige Projekte duerfen keine zentrale
  Monatsleiste anzeigen und die Projektakte dort nicht unsichtbar nach dem
  aktuellen Monat filtern; Termin-/Stempelungslisten bleiben bei Einmalprojekten
  projektweit.
- Projektzeitkontingente sind fachlich nur fuer Dauerlaeufer relevant. Bei
  einmaligen Projekten bildet die geplante Terminzeit die Soll-Zeit; die
  Stempelungen laufen gegen diese Planung. Deshalb darf der Projektaktenreiter
  `Projektzeitkontingente` bei Einmalprojekten nicht angezeigt werden. Wenn ein
  Einmalprojekt versehentlich mit aktivem Budget-Reiter geoeffnet wird, zur
  Ansicht `Termine & Stempelungen` wechseln.
- Rechte Projektseitenleiste bei Einmalprojekten: Die Karte `Verbrauchte
  Zeitkontingente` rechnet nicht gegen `timeBudgetHours` oder Monatsbudgets,
  sondern gegen die Summe der geplanten Terminzeiten im Projekt. `Gebucht
  (durch Stempelungen)` ist die gesamte gestempelte Projektzeit, `Rest` ist
  geplante Terminzeit minus gestempelte Projektzeit. Ohne geplante Termine
  bleibt `Rest` leer.
- Fortschrittskreis fuer Einmalprojekte: `TerWu` und `Planung` duerfen bei
  Einmalprojekten nicht gegen `projectComparisonMonth` oder den aktuellen Monat
  rechnen, weil dort keine Monatsakte sichtbar/fuehrend ist. `TerWu` ist gruen,
  sobald ein nicht geloeschter Termin oder Terminwunsch im Projekt existiert.
  `Planung` nutzt weiter Angebots-/Planungsvergleich, wenn Angebotszeiten
  vorhanden sind; gibt es keine Angebots-/Kontingentbasis, aber Projekttermine,
  ist `Planung` ebenfalls gruen statt leer.
- Rechte Projektseitenleiste `Verbrauchte Zeitkontingente`: Dauerlaeufer zeigen
  die Monats-/Gesamt-Aufteilung (`Gestempelt Monat`, `Restliches Kontingent
  Monat`, `Gestempelt Gesamt`, `Restliches Kontingent Gesamt`). Einmalige
  Projekte zeigen die kompakte Gesamtprojekt-Ansicht mit `Gebucht (durch
  Stempelungen)`, `Rest` und einem Fortschrittsbalken. Bei Einmalprojekten
  keine Monats-/Gesamt-Dauerlaeuferkarte anzeigen.
- Projektakte > Termine & Stempelungen: Die obere Planungstermin-Tabelle zeigt
  bei Dauerlaeufern wieder nur Termine/Terminwuensche des ausgewaehlten
  Projektmonats. Leere Monate zeigen einen kompakten Leerhinweis statt einer
  leeren Tabelle. Bei Einmalprojekten bleibt die Tabelle projektweit.
- Projektakte > Termine & Stempelungen: Auch `Erwartete Stempelungen` ist
  bei Dauerlaeufern monatsbezogen. Erwartete Zeilen entstehen nur aus
  Planungsterminen des ausgewaehlten Projektmonats; ungeplante/manuelle
  Stempelungen werden nur aus Stempelungen dieses Monats ergaenzt. Stempelungen
  aus Mai duerfen z.B. nicht in Juni oder spaeteren Monaten sichtbar bleiben.
  Bei Einmalprojekten bleibt diese Tabelle projektweit.
- Projektakte > Termine & Stempelungen: Dauerlaeufer zeigen oberhalb der
  Planungstermine eine schlanke Planungsuebersicht fuer den ausgewaehlten
  Monat: geplant von Monatskontingent, noch planbare Stunden und
  Fortschrittsbalken. Keine gestempelten/restlichen Verbrauchswerte dort
  duplizieren; diese gehoeren in die rechte Karte `Verbrauchte
  Zeitkontingente`. Diese Ansicht bewusst nur fuer Dauerlaeufer anzeigen, weil
  bei Einmalprojekten die geplanten Termine selbst die Soll-Zeit bilden.
- Projektkopf-Button fuer Planung 2026-06-07: Bei Dauerlaeufern richtet sich
  der Button am ausgewaehlten Projektmonat aus. Keine Planung heisst `Alle
  Zeiten planen` und pulsiert tuerkis; Teilplanung heisst `Restliche Zeiten
  planen` und pulsiert orange; vollstaendig verplante Monatskontingente heissen
  `Alle Zeiten verplant` und sind gruen ohne Pulsieren. Ueberplanung wird als
  `Ueberplanung pruefen` rot pulsierend signalisiert. Wenn bereits mindestens
  ein Planungstermin existiert, springt der Button direkt in die Tagesplanung
  des fruehesten geplanten Tages im relevanten Monat. Bei Dauerlaeufern darf
  dieser Zieltermin ausschliesslich aus dem ausgewaehlten Projektmonat kommen;
  niemals auf aeltere oder spaetere Planungstermine anderer Monate
  zurueckfallen. Ohne vorhandene Planung im ausgewaehlten Monat bleibt der
  Klick in der Projektakte bei `Termine & Stempelungen`.
- Update Projektkopf-Button fuer Planung 2026-06-08: Wenn ein konkreter
  Planungstag vorhanden ist, oeffnet der Button die Tagesplanung als Overlay
  ueber der Projektakte statt komplett ins Planungsboard zu wechseln. Datum und
  Planungsgruppe werden weiterhin aus dem fruehesten Planungstermin des
  relevanten Monats gesetzt. Die Tagesplanung nutzt denselben Planungsblock wie
  das Planungsboard; die Projektakte bleibt im Hintergrund sichtbar.
- UI-Zeitbalken 2026-06-07: Die Balken fuer `Planbare Stunden` und
  `Verbrauchte Zeitkontingente` wurden rein visuell modernisiert: schlanker
  Track, Verlauf-Fill und kompaktes Prozentlabel im Balken. Die fachlichen
  Prozent-/Stundenberechnungen bleiben unveraendert. Keine kuenstliche
  Mindestfuellung fuer 0%-Werte verwenden, damit leere Balken nicht wie
  Teilfortschritt wirken.
- Die `Restlaufzeit bis Projektende`-Timeline nutzt dieselbe moderne
  Balkensprache, behaelt aber ihre Marker/Legende fuer Anlage, Start,
  Endphase und Ende. Markerpositionen und Laufzeitberechnung nicht an die
  Optik koppeln oder veraendern.
- Projektfortschritts-/Prozessbar 2026-06-07: Die Fortschrittsleiste in der
  Projektakte wurde rein optisch als Segment-Stepper in der modernen
  Zeitbalken-Farbwelt umgesetzt: freistehende weisse Kapsel, Labels direkt in
  den Segmenten, erledigte Segmente mit Tuerkis-Blau-Violett-Verlauf und
  weissem Kreis/Haken, offene Segmente hell, Warn-/Teilzustaende amberfarben.
  Keine Prozentzahl anzeigen. Die Schritte bleiben dynamisch aus
  `projectProgressSteps`; keine Schrittfolge hart verdrahten. Bestehende
  Schritt-/Statuslogik und Klickziele duerfen durch die Optik nicht veraendert
  werden.
- Projektakte Monatsleiste: Beim Oeffnen eines Dauerlaeufer-Projekts soll der
  aktuelle Kalendermonat fuehrend sein. In der Monatsleiste bleibt der
  ausgewaehlte Monat blau gefuellt; der echte aktuelle Kalendermonat erhaelt
  zusaetzlich dauerhaft einen blauen Rahmen, damit sichtbar bleibt, wenn man
  gerade in einem anderen Monat arbeitet.
- Fachliche Praezisierung 2026-06-07: `Oeffnen eines Dauerlaeufers` bedeutet
  aktive Neu-Navigation in eine Projektakte, z.B. aus Pipeline, Suche,
  Projektkarte oder aehnlichen Projektlinks. Dann muss der ausgewaehlte
  Projektmonat auf den aktuellen Kalendermonat gesetzt werden. Davon getrennt
  sind Browser-Zurueck/Vorwaerts und Refresh-Wiederherstellung: Wenn die URL
  bzw. der gespeicherte Zustand einen konkreten Monat enthaelt, darf dieser
  Verlauf-/Arbeitsmonat wiederhergestellt werden und soll nicht zwangsweise auf
  den aktuellen Monat springen.
- Browser-Refresh in der Dashboard-App darf nicht auf die Startseite
  zurueckspringen. Der aktuelle Hauptbereich, eine geoeffnete Projektakte, der
  Projektakten-Reiter, der Dokumentordner und der ausgewaehlte Projektmonat
  werden lokal gespeichert und beim Neuladen direkt als Initialzustand
  verwendet. Den alten Effekt, der erst `overview` speicherte und dadurch den
  letzten Bereich ueberschrieb, nicht wieder einbauen.
- Browser-Zurueck/Vorwaerts darf interne Dashboard-Navigation nicht aus der
  App werfen, sobald innerhalb von WorkPilot360 navigiert wurde. Die
  Dashboard-App schreibt deshalb die wichtigsten internen Zustandswerte in die
  URL/Browser-History: `view`, `project`, `projectTab`, `doc`, `month`.
  `popstate` muss diese Werte wieder in React-State uebernehmen. LocalStorage
  bleibt der Refresh-Fallback, aber die Browserbuttons muessen ueber die URL-
  History laufen.
- Header-Popover 2026-06-08: Die drei Kopfbereich-Menues `+ Neu`,
  Benutzer/Avatar und Benachrichtigungen schliessen wieder per Klick ausserhalb
  ihres jeweiligen Bereichs. Sie bleiben bewusst einzeln verdrahtet und sind
  gegenseitig exklusiv: Beim Oeffnen eines Menues werden die anderen
  Kopfbereich-Menues geschlossen, damit nie mehrere Popover parallel offen
  bleiben.
- Planungsboard-Wiederholung 2026-06-08: Die Terminmaske erzeugt Serien nicht
  mehr ueber einen monatlichen Kalendertag plus `Wochenenden ueberspringen`.
  Wiederholungen werden jetzt ueber Intervall (`woechentlich`, `alle 2 Wochen`,
  `monatlich`) und anklickbare Wochentage Montag bis Sonntag gesteuert. `Monatlich`
  ist bewusst kein 4-Wochen-Rhythmus, sondern nimmt den Starttermin als Muster
  (z.B. zweiter Montag im Monat) und plant diesen Wochentag je Monat einmal.
  Der Termintzaehler bleibt erhalten und berechnet die Anzahl aus Startdatum,
  Enddatum, Intervall und ausgewaehlten Wochentagen. Wochenenden werden nur
  geplant, wenn Samstag/Sonntag explizit ausgewaehlt sind. Der alte separate
  Schalter `Wochenenden ueberspringen` gehoert nicht mehr in die Maske, weil die
  Wochentagsauswahl diese Entscheidung direkt abbildet. Das UI-Wording lautet
  `Terminserie anlegen` und `Serienende`, nicht technisch `Wiederholung`.
- Planungsmaske Pflichtfelder 2026-06-08: Bei normaler Planung und
  Terminwunsch starten `Titel` und `Beschreibung` leer und sind Pflichtfelder.
  `Mitarbeiter` muss ein echter vorhandener Mitarbeiter sein; `Noch nicht
  zugewiesen` darf nicht speicherbar sein. Fehlende Pflichtfelder werden in der
  Maske mit dem bekannten orangefarbenen Pulsrahmen markiert. Angebots- oder
  Kontingentkontext darf nicht mehr als automatisch gespeicherter Ersatz-Titel
  oder Ersatz-Beschreibung dienen.
- Einmalprojekte Planungsbasis 2026-06-08: Einmalige Projekte haben weiterhin
  keine Monatsakte und keine Projektzeitkontingente. Planbare Stunden kommen
  projektweit aus den Arbeitspositionen finaler Angebote/Nachtragsangebote. In
  `Termine & Stempelungen` wird fuer jedes finale Angebot mit Arbeitsstunden
  eine eigene Leiste angezeigt: Angebotsnummer, Angebotsart, geplante Stunden,
  offene Stunden und geplanter Ausfuehrungsmonat. Planung fuer Einmalprojekte
  mit Angebotsstunden muss bewusst einem Angebot zugeordnet werden; freie
  Planung ohne Angebotsbezug ist dort nicht speicherbar. Wird ein Termin fuer
  ein Angebot in einem anderen Monat als dessen Ausfuehrungsmonat gespeichert,
  fragt die UI nach Bestaetigung und setzt dann genau dieses Angebot auf den
  neuen Ausfuehrungsmonat, damit der Forecast nicht im alten Monat stehen
  bleibt. Die Angebotsleisten sind reine Status-/Kontingentleisten ohne eigene
  Aktionsbuttons; neue Planung laeuft ueber `+ Termin` bzw. `+ Terminwunsch`
  und die Angebotszuordnung in der Terminmaske. Altbestand ohne gespeicherte
  `offerId` darf defensiv ueber Angebotsnummer im Text oder, wenn eindeutig,
  ueber den Ausfuehrungsmonat genau einem Angebot zugeordnet werden. Dauerlaeufer
  bleiben unveraendert monats-/kontingentbasiert.
- Nachkorrektur Planungsmaske Einmalprojekte 2026-06-09: In der Terminmaske
  werden bei Einmalprojekten mit Angebotszuordnung keine editierbaren Felder
  `Angebotsposition` oder `Angebotene Stunden` mehr angezeigt. Die Zuordnung
  laeuft bewusst auf Angebotsebene. Die Kontingentbox zeigt den Stand nach dem
  Speichern (`Bisher`, `Dieser Termin`, `Danach offen/ueberplant`) statt nur
  den Vorabstand, damit eine Ueberplanung sofort sichtbar ist.
- Nachkorrektur Einmalprojekt-Leisten 2026-06-09: Angebotsleisten fuer
  Einmalprojekte duerfen nicht mehr faktisch am ausgewaehlten Monat haengen.
  Sie zaehlen projektweit alle Planungseintraege mit Angebotsbezug; Altbestand
  ohne `source = offer`, aber mit eindeutiger Angebotszuordnung ueber
  Angebotsmonat, wird ebenfalls beruecksichtigt. Neue Einmalprojekt-Termine mit
  Angebotszuordnung werden auch dann als `source = offer` gespeichert, wenn sie
  ueber den allgemeinen `+ Termin` Einstieg angelegt wurden.
- Potenzialprozess 2026-06-08: Zusatzverkaufs-Potenziale entstehen weiterhin
  aus der Endkontrolle/Stempelung, wenn dort `Zusatzverkauf` erfasst wird.
  Daraus wird ein `ProjectPotential`. Der Projektkopf-Button
  `Hinterlegtes Potenzial` oeffnet jetzt eine echte Potenzial-Detailmaske statt
  nur loser Einzelaktionen. Die Maske fuehrt Beschreibung, Status,
  Verantwortlichen, geschaetzten Wert, Prioritaet, naechsten Schritt,
  Wiedervorlage, Verlustgrund und Historie. Die Potenzialuebersichten unter
  `Projekte > Potenziale` und in der Kundenakte oeffnen dieselbe Maske.
  Aktionen wie Angebot erstellen, Aufgabe/Wiedervorlage und Kein Interesse
  bleiben vorhanden, laufen aber fachlich aus der Potenzialakte heraus.
  Wichtig fuer Auswertungen: Potenziale duerfen den Forecast nicht speisen.
  Forecast bleibt bewusst angebots- und rechnungsbasiert, damit erkannte
  Zusatzchancen erst durch echte Angebote messbar und steuerbar werden.
- Navigation Potenziale 2026-06-08: `Potenziale` ist ein eigener Hauptpunkt in
  der linken Sidebar direkt oberhalb von `Aufgaben`. Die alten Einstiege unter
  den Projektpipelines OK solutions/OK immocare und unter `Sales-Hub` wurden aus
  der Navigation entfernt, damit Anwender Potenziale nicht an mehreren Stellen
  suchen muessen. Die Potenziale bleiben fachlich weiterhin mit Projekt und Kunde
  verknuepft und nutzen dieselbe Detailmaske. Der Forecast bleibt unveraendert:
  Potenziale speisen ihn nicht, erst Angebote und Rechnungen zaehlen.
- Potenziale-UI 2026-06-08: Die Potenzialuebersicht soll nicht mehr wie eine
  technische Pipeline-Tabelle mit vielen Schnellaktionen wirken. Sichtbar bleibt
  in der Liste nur `Bearbeiten`; dieser Button oeffnet die Potenzialakte. Aktionen
  wie Angebot erstellen, Nachfassen oder Kein Interesse gehoeren in die Maske,
  damit Entscheidungen nachvollziehbar aus der Potenzialakte heraus passieren.
- Potenziale-Status 2026-06-08: Statuswerte in der Potenzialuebersicht werden
  wie andere WorkPilot-Statusanzeigen als ruhige Clips/Pills dargestellt, nicht
  als reiner Tabellentext. Die Tabelle soll optisch als Arbeitsliste wirken:
  weisse Zeilenkarten, wenig harte Linien, rechts ein klarer Bearbeiten-Button.
  Der Tabellenkopf in dieser Ansicht ist bewusst hell und zurueckhaltend; der
  dunkle Standard-Tabellenkopf der Pipeline-/Datentabellen soll hier nicht
  greifen.
- Artikel & Leistungen UI 2026-06-08: Die Stammdatentabellen fuer Artikel,
  Leistungen, Pakete und Verkaufspreise gehoeren zur dichten WorkPilot-
  Tabellenfamilie wie Planungstermine/Stempelungen: kompakter dunkler
  Tabellenkopf, flache Zeilen mit klaren Trennlinien, ruhige Filterzeile,
  Status als Clip (`Aktiv`/`Inaktiv`) und Aktionen als beschriftete Buttons
  (`Bearbeiten`, `Duplizieren`, `Deaktivieren`), keine Fragezeichen-Buttons.
  Die Katalogansicht nutzt nur die obere Freitextsuche plus Statusfilter; keine
  zweite Spaltenfilterzeile im Tabellenkopf, damit Suche und Filterung nicht
  doppelt wirken oder unsichtbar alte Filter aktiv bleiben.
  Die Freitextsuche normalisiert Gross-/Kleinschreibung, Leerraeume und
  Akzent-/Umlautzeichen. Pagination-Buttons zeigen echte Pfeile statt
  Platzhalter-/Fragezeichen.
- Potenzialhistorie 2026-06-08: Historieneintraege in Potenzialmaske und
  separatem Historie-Dialog werden newest-first angezeigt. Beim Speichern der
  Potenzialakte darf nicht nur pauschal `Potenzial aktualisiert.` geschrieben
  werden; neue Historieneintraege sollen die geaenderten Felder nennen
  (z.B. Status, Verantwortlich, Wert, Prioritaet, Wiedervorlage, naechster
  Schritt, Verlustgrund oder freie Notiz).
- Verkaufschancen-Begriff 2026-06-08: Der fuehrende sichtbare Begriff in der
  UI ist ab jetzt `Verkaufschance` bzw. `Verkaufschancen`, nicht mehr
  `Potenzial`. Das gilt fuer Sidebar, Uebersichten, Kundenakte, Projektkopf
  und Detailmaske. Technische Namen wie `ProjectPotential`, `/api/potentials`
  und Datenbankfelder bleiben bewusst unveraendert, damit keine Datenmigration
  oder API-Risiken entstehen.
- Verkaufschancen-Nachfassen 2026-06-08: Die Wiedervorlage ist fachlich keine
  zweite Erinnerungsebene in der Verkaufschance. Nachfassen gehoert ins
  Aufgabenmodul. Die Verkaufschance zeigt deshalb nur noch den Status bzw. die
  verknuepfte Nachfass-Aufgabe an. Wenn bereits eine Aufgabe verknuepft ist,
  oeffnet der Button diese Aufgabe; nur ohne verknuepfte Aufgabe wird eine neue
  Nachfass-Aufgabe angelegt. Alte `followUpAt`-Daten bleiben als Fallback
  erhalten, werden aber nicht mehr als eigenes Datumsfeld in der Maske gepflegt.
- Verkaufschancen-Tabelle 2026-06-08: Die Hauptuebersicht der Verkaufschancen
  nutzt wieder die dichte WorkPilot-Tabellenfamilie mit dunklem Kopf, flachen
  Zeilen, klaren Rasterlinien, Status-Clips und einem einzelnen
  Einstieg ueber die Verkaufschancen-Nummer. Eine separate Aktionsspalte mit
  `Bearbeiten` ist bewusst entfernt, weil die Nummer die Detailmaske oeffnet
  und die eigentlichen Aktionen in der Maske liegen.
- Verkaufschancen-Nummernkreis 2026-06-08: Verkaufschancen haben einen
  gespeicherten Nummernkreis im Format `VC-xxxx`. Technisch bleibt die Tabelle
  `ProjectPotential` bestehen; ergaenzt wurde das optionale Feld `number`.
  Die API `/api/potentials` fuehrt defensiv `ALTER TABLE ... ADD COLUMN IF NOT
  EXISTS` aus, setzt einen eindeutigen Index pro Organisation und vergibt neue
  Nummern fortlaufend ab `VC-1001`. Altbestand ohne Nummer wird beim Laden in
  Erstellreihenfolge nachnummeriert. Die UI nutzt die gespeicherte Nummer als
  Einstieg in die Verkaufschancen-Maske; nur falls Altbestand noch keine Nummer
  geliefert hat, bleibt ein Anzeige-Fallback aktiv.
- Verkaufschancen-Maske 2026-06-08: Die Maske soll bewusst einfach bleiben.
  Sichtbar bleiben Status, Verantwortlich, geschaetzter Wert, Nachfass-Aufgabe,
  Grund bei `Kein Interesse`, `Notiz fuer Historie` und Historie. Prioritaet,
  `Naechster Schritt` und der extra Button `Kein Interesse` wurden aus der
  Maske entfernt. `Kein Interesse` wird ueber den Status gesteuert; die
  fachlichen Aktionen laufen ueber `Angebot erstellen`, `Nachfass-Aufgabe`
  und `Speichern`.
- Nachkorrektur Verkaufschancen-Maske 2026-06-08: `Speichern` fragt vor dem
  Sichern kurz, ob der sichtbare Status korrekt ist, und schliesst die Maske
  danach. Ohne echte Feld-/Notizaenderung wird kein kuenstlicher Historieneintrag
  mehr geschrieben. Die verknuepfte Nachfass-Aufgabe ist direkt im Feld
  anklickbar und oeffnet die Aufgabenmaske. Verkaufschancen-Historienzeiten
  muessen als echte Zeitpunkte mit `formatInstantDateTime` angezeigt werden,
  nicht mit deadline-/app-datebasierter Formatierung, damit kein UTC-Versatz
  von zwei Stunden entsteht.
- Angebots-Nachfassen 2026-06-08: Finale Angebote erzeugen automatisch eine
  Nachfass-Aufgabe im Aufgabenmodul. Entwuerfe erzeugen keine Aufgabe; wird ein
  Entwurf spaeter finalisiert, wird die Aufgabe dann angelegt. Die Standardfrist
  ist `5 Werkstage` und wird unter `Firmeneinstellungen > Zeitfristen` gepflegt.
  Die automatisch erzeugte Aufgabe startet mit Status `in Bearbeitung`, ist mit
  Projekt/Kunde und Angebotsnummer vorbelegt und speist den Forecast nicht.
  Wird ein Angebot aus einer Verkaufschance erstellt, wird die Verkaufschance
  auf `Angeboten` gesetzt und mit der neuen Angebots-Nachfassaufgabe verknuepft.
  Eine alte eindeutig erkennbare Verkaufschance-/Potenzial-Nachfassaufgabe wird
  dabei erledigt, damit nicht zwei parallele Nachfassaufgaben fuer denselben
  Vorgang offen bleiben. Forecast bleibt weiterhin nur durch Angebote und
  Rechnungen gespeist, nicht durch Verkaufschancen oder Aufgaben.
- Nachkorrektur Aufgaben-API 2026-06-08: Neue Aufgaben duerfen beim POST den
  uebergebenen Status respektieren. Vorher setzte die API neue Aufgaben hart
  auf `offen`; dadurch wurden automatisch angelegte Angebots-Nachfassaufgaben
  trotz UI-Vorgabe nicht mit `in Bearbeitung` gespeichert. Ohne uebergebenen
  Status bleibt `offen` weiterhin der Fallback.
- Manuelle Verkaufschance 2026-06-08: Verkaufschancen koennen in der
  Verkaufschancen-Uebersicht manuell angelegt werden, aber nur mit vorhandenem
  Projekt als Pflichtgrundlage. Pflichtfelder sind Projekt und Beschreibung;
  geschaetzter Wert ist optional. Neue manuelle Verkaufschancen starten mit
  Status `Offen`, bekommen eine `VC-xxxx` Nummer, erzeugen einen Projektlogbuch-
  Eintrag und oeffnen danach die normale Verkaufschancen-Maske. Auch manuelle
  Verkaufschancen speisen den Forecast nicht; erst ein daraus erstelltes Angebot
  bzw. spaeter eine Rechnung zaehlt.
- Wenn nach einem Refresh eine Projektakte gespeichert ist, die Projektliste
  aber noch asynchron laedt, darf nicht kurz die Projektpipeline gerendert
  werden. In diesem Zwischenzustand einen Ladehinweis fuer die Projektakte
  zeigen; erst nach abgeschlossener Projektladung und weiterhin fehlendem
  Projekt darf auf die Pipeline zurueckgefallen werden. `hasLoadedHeroProjects`
  darf deshalb erst nach erfolgreich gesetzten Projektdaten auf true gesetzt
  werden, nicht schon zu Beginn von `loadHeroProjects()`. Fuer die Ladezeit
  der wiederherzustellenden Projektakte soll der bestehende Bootscreen
  (`Sitzung wird geprueft...` / `Projektakte wird geladen...`) stehen bleiben,
  statt eine zweite interne Zwischenansicht zu rendern.
- Bootscreen-Optik: Der Ladebildschirm nutzt eine gecroppte Version des
  freigestellten aktuellen WorkPilot360-Logos (`/wp360-boot-logo.png`) gross
  und mittig. Der Text lautet `Einen Moment, ich lade gerade...`; darunter
  laeuft eine dezente CSS-Wellenpunkt-Animation. Keine technische
  Statusmeldung wie `Sitzung wird geprueft...` anzeigen.
- Projektakte > Bilder: Bild-Uploads fuer Dauerlaeufer speichern den
  ausgewaehlten Projektmonat jetzt explizit als `ProjectLogbookEntry.projectMonth`.
  Die Anzeige und Taetigkeitsbericht-Erstellung lesen zuerst dieses Monatsfeld
  und nutzen `createdAt` nur noch als Altbestand-Fallback. Grund: Die vorherige
  Hilfsloesung ueber ein kuenstlich gesetztes `createdAt` war fragil und konnte
  dazu fuehren, dass Bilder nach dem Upload in der Monatsakte nicht sichtbar
  waren.
- Projektakte > Dokumente > Taetigkeitsberichte wurde wieder angeschlossen.
  Im Reiter gibt es wieder den Button `Taetigkeitsbericht erstellen`; er nutzt
  `/api/activity-reports`, nimmt die Vorher-/Nachherbilder des ausgewaehlten
  Monats und legt den erzeugten PDF-Bericht als `Dokumente:
  Taetigkeitsberichte` in derselben Monatsakte ab. Das PDF orientiert sich an
  der bereits nachgebauten WorkPilot-Version `DOK-0001-2.pdf`: Dokumentnummer
  `DOK-000x`, Betreff, kurze Einleitung, Projektzeile, Auswertungsmonat sowie
  separate Vorher-/Nachher-Bildseiten. Nicht auf lange HERO-Textseiten
  zurueckbauen.
- Nachkorrektur Taetigkeitsbericht: Der PDF-Generator nimmt zwar weiterhin die
  Vorher-/Nachherbilder des ausgewaehlten Monats, fasst doppelte Bild-Uploads
  aber nach Dateistamm zusammen (z.B. `IMG_8386.jpg` und `IMG_8386.jpeg` nur
  einmal). Ein vorhandener Monatsbericht wird mit derselben `DOK-000x`-Nummer
  aktualisiert, statt weitere PDF-Duplikate fuer denselben Monat anzulegen.
- Folgekorrektur Taetigkeitsbericht: Beim Erstellen aus der Projektakte
  uebergibt die UI die aktuell sichtbaren Vorher-/Nachher-Bildschluessel an
  `/api/activity-reports`. Die API darf dann nur diese sichtbaren Bildkarten in
  den PDF-Bericht uebernehmen. Hintergrund: In der Logbuch-/Datenbankquelle
  koennen durch alte Uploadversuche mehrere Bildanhaenge desselben Monats
  liegen, obwohl die UI nur je ein sichtbares Vorher-/Nachherbild zeigt.
- Nachkorrektur Projektakte > Dokumente: Der Unterpunkt `Taetigkeitsberichte`
  zeigt in der linken Dokumentnavigation einen Zaehler, sobald Berichte im
  ausgewaehlten Projektmonat vorhanden sind. Die Projekt-Dokumentanzeige nutzt
  fuer Taetigkeitsberichte und sonstige Dokumente ein Tabellenlayout mit
  Dokument, Datum, Typ und Aktionen statt der alten losen Dokumentkarten.
- Pruefung nach diesem Block:
  - `npx.cmd tsc --noEmit` erfolgreich.
  - `git diff --check` erfolgreich, nur bekannte LF/CRLF-Warnungen.

## Rechnungen / Leistungsdatum / Forecast-Ersetzung 2026-06-07

- Rechnungen fuehren ab jetzt fachlich ein echtes `Leistungsdatum`.
- Technisch wurde `Invoice.serviceDate` ergaenzt. Das bestehende
  `Invoice.plannedExecutionMonth` bleibt als Monats-/Altkompatibilitaetsfeld
  bestehen und wird bei neuen Rechnungen aus `serviceDate.slice(0, 7)`
  befuellt.
- Dauerlaeufer-Rechnungen nutzen automatisch den letzten Kalendertag des
  ausgewaehlten Projekt-/Abrechnungsmonats als Leistungsdatum.
- Einmalige Projekte schlagen das Leistungsdatum automatisch vor:
  1. Datum der letzten Projektstempelung.
  2. Falls keine Stempelung existiert: letzter Planungstermin im Projekt.
  3. Falls beides fehlt: heutiger Abrechnungstag.
- Das Leistungsdatum ist in der Rechnungsmaske sichtbar und aenderbar.
- Vor finaler Fakturierung muss das Leistungsdatum bestaetigt werden:
  neue Rechnung, Entwurf finalisieren und Stapelabrechnung zeigen das konkrete
  Leistungsdatum in der Bestaetigung.
- Rechnungs-PDFs zeigen `Leistungsdatum` in den Kopfdaten.
- Rechnungen aus Angeboten speichern ab jetzt `sourceOfferId` und
  `sourceOfferNumber`. Freie Rechnungen lassen diese Felder leer.
- Forecast-Regel:
  - Angebote steuern geplanten Umsatz ueber Ausfuehrungsmonat bzw. bei
    Dauerlaeufern ueber Ausfuehrungszeitraum von/bis.
  - Rechnungen steuern echten Umsatz ueber Leistungsdatum.
  - Einmalprojekte: eine verknuepfte Rechnung ersetzt das Angebot im Forecast,
    damit Angebot und Rechnung nicht doppelt zaehlen. Fuer Altbestand ohne
    Angebotsreferenz gilt projektbezogener Fallback.
  - Dauerlaeufer: eine Rechnung ersetzt den Angebots-/Forecastwert nur im
    jeweiligen Leistungsmonat. Andere Monate bleiben weiter als geplanter
    Forecast stehen.
  - Mehrere Rechnungen im selben Leistungsmonat werden summiert und ersetzen
    den Monatsforecast fuer genau diesen Monat.
- Stornorechnungen uebernehmen Leistungsdatum und Angebotsreferenz der
  Originalrechnung, damit der betroffene Monat nachvollziehbar bleibt.
- Update Rechnungsmaske 2026-06-07: Offene, noch nicht mit einer Rechnung
  verknuepfte Stempelungen werden in der Rechnungsmaske optisch hervorgehoben
  und pulsierend umrandet. Die Checkboxen im Stempelungsblock bleiben bewusst
  kompakt, damit die Tabelle nicht unruhig wirkt. Wenn beim finalen Abrechnen
  offene Stempelungen ganz oder teilweise unverknuepft bleiben, muss der Nutzer
  dies per Warn-Popup bestaetigen. Diese Logik gilt fuer Dauerlaeufer und
  Einmalprojekte gleich; relevant ist nur der fehlende Rechnungsbezug der
  Stempelung.
- Update Rechnungsdokumente 2026-06-07: In Projektakte > Dokumente >
  Rechnungen zeigt die Statusspalte zusaetzlich Clips fuer `E-Mail versendet`
  und `Gedruckt`. Grundlage ist die `InvoiceHistory`: Mailversand wird bereits
  ueber `/api/document-mail` als `email_sent` protokolliert; Drucken wird beim
  Klick auf `Drucken` als `printed` in der Rechnungshistorie vermerkt und
  zusaetzlich im Projektlogbuch dokumentiert. Unter der Rechnungstabelle wird
  eine kompakte Rechnungshistorie angezeigt, damit Versand-/Druckereignisse
  ohne Wechsel ins Logbuch nachvollziehbar bleiben.
- Nachkorrektur Rechnungsdokumente 2026-06-07: Die Rechnungshistorie nutzt in
  der Projektakte das bestehende Historien-Design (`planningHistorySection` /
  `planningHistoryList`) statt eines separaten Sonderkastens. Die Versand-/
  Druck-Clips in der Statusspalte wurden auf die gleiche ruhige Pillen-Sprache
  wie die Rechnungsstatus-Chips gebracht, sauber zentriert und in der
  Rechnungstabelle auf einheitliche Breite mit dem Status-Chip gesetzt. Alte
  mojibake-belastete Historientexte werden in der Anzeige normalisiert; neue
  Loesch-Historieneintraege der Rechnungs-API werden korrekt geschrieben.
- Nachkorrektur Rechnungsmaske 2026-06-07: Der Block `Offene Zeiteintraege`
  in der Rechnungsmaske zeigt jetzt drei Zustaende: ohne offene Stempelungen
  neutral, bei fehlender/teilweiser Verknuepfung orange pulsierend, bei
  vollstaendiger Verknuepfung gruener Rahmen mit Bestaetigungshinweis. Beim
  Loeschen einer Rechnung wird die Rechnungshistorie sofort neu geladen, damit
  die Historie inklusive Loesch-Eintrag sichtbar bleibt, obwohl die Rechnung
  aus der aktiven Rechnungsliste entfernt wird.
- Nachkorrektur Angebots-Nachfassaufgaben 2026-06-09: Automatisch erzeugte
  Nachfass-Aufgaben fuer finale Angebote speichern jetzt zusaetzlich
  `Task.sourceOfferId` und `Task.sourceOfferNumber`. Beim Loeschen eines
  Angebots wird eine aktive verknuepfte Angebots-Nachfassaufgabe nicht hart
  geloescht, sondern in das Aufgabenarchiv verschoben. Fuer Altbestand ohne
  technische Verknuepfung bleibt ein enger Fallback ueber Projekt-ID,
  Angebotsnummer und Titel `Angebot nachfassen` bestehen.
- Nachkorrektur Planung bearbeiten / Stempelungsrechnung 2026-06-09:
  `Planung bearbeiten` darf bei Einmalprojekten mit Angebotsstunden nicht
  pauschal als freie Planung behandelt werden. Vorhandene Angebotsreferenzen
  oder ein Einmalprojekt mit Angebots-Planungsbasis zeigen die
  Angebotszuordnung und nutzen dieselben Pflichtfeld-/Ausfuehrungsmonat-Regeln
  wie `+ Termin`. In der erwarteten Stempelungsanzeige darf `Fakturiert:` nicht
  pauschal alle Rechnungen des Monats listen; angezeigt wird nur die letzte
  wirklich mit der passenden Stempelung verknuepfte Rechnung.
- Nachkorrektur Projektkopf / Prozesspipeline 2026-06-09: Sichtbare
  Encoding-Reste im Projektkopf und in der Planungsmaske wurden nur gezielt
  korrigiert (`Zurueck`, `Status aendern`, `oeffnen`, `woechentlich`,
  `bestaetigen`). Die Prozesspipeline rendert abgeschlossene Schritte jetzt
  mit einer HTML-Entity fuer den Haken, damit das Symbol nicht erneut durch
  Encoding-Probleme zerfaellt.
