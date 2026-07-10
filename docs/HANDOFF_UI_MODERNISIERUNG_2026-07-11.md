# WorkPilot360: Uebergabe UI-Modernisierung

Stand: 11.07.2026

## Ziel des naechsten Tasks

WorkPilot360 soll systemweit moderner, ruhiger und hochwertiger gestaltet werden,
ohne Fachlogik, Rollen, Berechnungen, API-Verhalten oder produktive Workflows zu
veraendern. Vor der Umsetzung ist mit dem Nutzer ein zusammenhaengendes
Designkonzept abzustimmen. Nicht direkt mit einem grossen CSS-Umbau beginnen.

## Repository und Betrieb

- Repository: `C:\Users\vagte\Downloads\Dokumenteauslastungdashboardhero\WorkPilot360`
- Branch: `main`
- GitHub: `https://github.com/chrisoks/WorkPilot360.git`
- Lokale App: `http://localhost:3001`
- Produktiver Serverpfad: `/var/www/WorkPilot360`
- PM2-Prozess: `workpilot360`
- Letzter gepushter Commit: `bc7852f KuZu-Hot-Alerts per Systemmail eskalieren`

Keine Zugangsdaten, API-Keys oder Inhalte aus `.env` in Code, Dokumentation oder
Chat-Ausgaben uebernehmen.

## Was im bisherigen Go-Live-Review erledigt wurde

- Tiefer Code-, API-, Rollen-, Prisma- und UI-Rundgang ueber die wesentlichen Module.
- Echte Klicktests fuer Stempeln, Aufgaben, Zusatzverkaeufe, Projekte, Planung,
  Angebote, Rechnungen, Termine und Terminwuensche.
- Rollen- und KI-Schutz fuer Geschaeftsfuehrung und Vertrieb geschaerft.
- Dauerlaeufer- und Einmalprojekt-Auswertungen fachlich getrennt.
- Dashboard- und Auswertungs-KPIs, Trends sowie Sales-Performance erweitert.
- Kritische Notifications und Systemmails geprueft und ergaenzt.
- KuZu-Hot-Alerts werden nun an Geschaeftsfuehrung und zustaendigen Vertriebler
  auch per Systemmail versendet.
- Testdaten des Rundgangs wurden am 11.07.2026 lokal kontrolliert bereinigt.
  Echte Projekte `MKG-400` und `HAS-1` blieben erhalten. Diese DB-Bereinigung ist
  keine Git-Aenderung und muss nicht auf dem Server ausgefuehrt werden.

## Verifikation des letzten Codepakets

- 22 Tests bestanden.
- `npx tsc --noEmit` bestanden.
- Mojibake-Check bestanden.
- Regressionscheck bestanden.
- `npx prisma validate` bestanden.
- `npx prisma db push --skip-generate` ohne Warnung; Schema war synchron.
- `npm run build` bestanden.

## Verbindliche Arbeitsweise

- Bestehende Fachlogik zuerst lesen und nicht stillschweigend veraendern.
- Echte Klickpruefung immer mit Code- und API-Pruefung kombinieren.
- Kleine, fachlich geschlossene Fixpakete bilden.
- Vor jedem Push Tests, TypeScript, Prisma Validate, Prisma DB-Push-Check und Build.
- Nur eigene Dateien stagen. Ungetrackte `.codex-safety/*`, `backup.sql` und
  temporaere Screenshots weder loeschen noch committen.
- Nach einem Push die Serverbefehle mit echtem Pfad `/var/www/WorkPilot360` liefern.
- Kritische Notifications: Geschaeftsfuehrung immer, zusaetzlich fachlich
  Verantwortlicher, Projektverantwortlicher oder Fuehrungskraft.
- Keine pauschalen Systemmails fuer normale Feed-, Kommentar- oder
  Freigabeaktivitaeten erzeugen.

## UI-Anforderungen des Nutzers

- Die Oberflaeche wirkt aktuell zu altbacken, grob und ueberfuellt.
- Gewuenscht ist eine moderne, ruhige, professionelle Operations- und BI-Optik.
- Inhalte und bestehende Struktur duerfen nicht aus fremden Vorlagen kopiert werden.
- Die bereitgestellten Jobie-Screenshots dienen nur als Qualitaets- und Stilrichtung.
- WorkPilot360 muss dichter und arbeitsorientierter bleiben als die grosszuegigen
  Recruiting-Layouts der Referenzen.
- Keine einfarbig violette Optik und keine dekorativen Marketing-Layouts.
- Keine Karten in Karten, keine uebermaessigen Pill-Elemente und keine unnoetigen
  Erklaertexte in der laufenden UI.
- Icons bevorzugt aus der vorhandenen Icon-Bibliothek; keine improvisierten SVGs.
- Tabellen muessen scanbar, kompakt und auch bei vielen Spalten verstaendlich sein.
- Modale, Formulare und Bestaetigungen muessen einheitlich werden.
- Browser-`alert`/`confirm`-Dialoge spaeter durch eigene sichere Modale ersetzen.
- Mobile und kleine Desktop-Viewports muessen ohne Ueberlappungen funktionieren.

## Technischer UI-Befund

- `src/components/dashboard/dashboard.module.css` hat rund 22.800 Zeilen.
- Sehr viele hart codierte Farben, Schatten und Radien.
- Mindestens 168 Vorkommen von `border-radius: 999px`.
- Kartenradien reichen uneinheitlich etwa von 8 bis 30 Pixeln.
- Hauptkomponente `dashboard-page.tsx` ist sehr gross und enthaelt zahlreiche
  unterschiedliche Oberflaechenstile.
- Globale Typografie ist Outfit; die oeffentliche Feedback-Seite nutzt abweichend Arial.
- Die Notification-Zentrale funktioniert, ist aber bei vielen gleichartigen Meldungen
  visuell zu wenig priorisiert und sollte spaeter gruppieren/buendeln.

## Empfohlene Reihenfolge

1. Aktuellen UI-Bestand auf Desktop und kleinem Viewport dokumentieren.
2. Design-Tokens definieren: Farbe, Typografie, Abstand, Radius, Schatten, Status.
3. Mit dem Nutzer ein konkretes Designkonzept und zwei bis drei visuelle Richtungen
   abstimmen. Noch keine systemweite Umstellung vor dieser Freigabe.
4. Grundlayout als Pilot modernisieren: Sidebar, Topbar, Seitentitel, Suche,
   Standardbuttons und Oberflaechenhintergrund.
5. Dashboard und Auswertungen als erste echte Module modernisieren.
6. Tabellen, Formulare, Modale und Statusanzeigen als wiederverwendbare Muster
   vereinheitlichen.
7. Danach Projekte, Aufgaben, Planung, Buchhaltung und Einstellungen modulweise
   migrieren und jeweils per Klicktest sowie Screenshots pruefen.

## Referenzbilder

Die Referenzbilder liegen lokal unter `C:\Users\vagte\Downloads\`:

- `14_Dashboard (dark).jpg`
- `13_TalentPage.jpg`
- `12_Messages.jpg`
- `11_ApplicationForm.jpg`
- `10_DetailedAnalytics.jpg`
- `09_HomeNewsFeed.jpg`
- `08_JobDetails.jpg`
- `07_Statistics.jpg`
- `06_Companies.jpg`
- `05_Profile.jpg`
- `04_Applications.jpg`
- `03_SearchJob.jpg`

## Erster Auftrag im neuen Task

Repository, diese Uebergabe, `AGENTS.md`, zentrale Dashboard-Komponente und CSS
lesen. Danach den aktuellen Zustand im Browser auf Desktop und kleinem Viewport
pruefen. Dem Nutzer ein konkretes systemweites Modernisierungskonzept mit
Design-Tokens, Pilotumfang, Risiken und Migrationsreihenfolge vorlegen. Vor der
Freigabe keine UI-Dateien veraendern.
