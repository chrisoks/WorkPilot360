# WorkPilot360 Agent Handover

- Aktueller Arbeitsstand 2026-06-26: Der richtige Projektordner bleibt
  `C:\Users\vagte\Downloads\Dokumenteauslastungdashboardhero\WorkPilot360`.
  Nicht in den OneDrive-/SafeDesk360-Ordner wechseln. Der Nutzer will
  vorsichtiges, gezieltes Vorgehen: so viel wie noetig, so wenig wie
  moeglich, vor/nach Logikbloecken sichern, danach Checks laufen lassen und
  Aenderungen in dieser `AGENTS.md` dokumentieren. Kleine reine UI-Fixes
  duerfen schlank bleiben, aber groessere Logikbloecke brauchen Sicherung,
  Checks und Handover-Notiz.
- Laufender Funktionsblock 2026-06-26: Dauerlaeufer wurden fachlich in
  Monatspauschale und Stundenabrechnung getrennt. Bei Dauerlaeufer-Projekten
  muss das Abrechnungsmodell aktiv gewaehlt werden; Stundenabrechnung nutzt
  Termin-Gewerk und konkrete Abrechnungsleistung in der Planung/Stempelung.
  Manuelle Projektstempelungen fuer Dauerlaeufer mit Stundenabrechnung
  verlangen ebenfalls Gewerk und Abrechnungsleistung. Die Haupt-Stempellogik
  fuer Mitarbeiter/Planung/PWA wurde nicht grundsaetzlich umgeworfen.
- Planung und Kontingente 2026-06-26: Bei einmaligen Projekten ist Planung
  ohne finale Angebotsgrundlage blockiert; in der Projektakte sind `+ Termin`
  und `+ Terminwunsch` dann deaktiviert und verweisen auf das zuerst
  anzulegende Angebot. Der Reiter `Projektzeitkontingente` erscheint nur noch
  bei Dauerlaeufern. Bei Dauerlaeufern mit Stundenabrechnung ist die
  Kontingentsteuerung standardmaessig deaktiviert und kann nur bewusst mit
  Warnhinweis aktiviert werden.
- Rechnungsblock Stundenabrechnung 2026-06-26: Fuer Dauerlaeufer mit
  Stundenabrechnung werden Stempelungen positionsbezogen als interne
  Abrechnungsgrundlage in der Rechnungsmaske angezeigt. Die alte globale Box
  offener Zeiteintraege wird fuer diesen Fall nicht mehr genutzt. Stempelungen
  koennen je Position uebernommen werden; bestehende Verknuepfungen werden
  beim Oeffnen des Entwurfs vorselektiert. Abrechnungspositionen werden fuer
  die Rechnung ohne Preiszusatz wie `(60,50 EUR / Std.)` dargestellt.
  Gestempelte Zeiten werden fuer die fakturierbare Menge aufgerundet
  beruecksichtigt. Der Kommentar bleibt intern sichtbar, aber nicht als
  eigener Rechnungsbestandteil.
- PDF-/Dokumentdarstellung 2026-06-26: Rechnungs- und Angebotstexte brechen
  lange Woerter und Beschreibungstexte jetzt sauber um. Die Textspalte wurde
  begrenzt, damit Beschreibungen nicht in Preis-/Summenbereiche laufen.
  Geschaeftspapier in Rechnungen richtet sich bei Stundenabrechnung nach der
  Projekt-Niederlassung; `Bearbeiter/in` wird beim Oeffnen/Erstellen mit dem
  aktiven Benutzer vorbelegt. Neue Endkontrollen werden nicht mehr als TXT,
  sondern als PDF-Nachweis auf dem passenden OK-Briefpapier im Projektlogbuch
  abgelegt; der Logbuchtext ist dabei nur noch eine kurze Zusammenfassung.
- E-Rechnung 2026-06-27: Fuer Rechnungen kann die XRechnung-XML im
  Dokumentversand jetzt wirklich als Anhang erzeugt werden. Die Auswahl
  `XRechnung XML` haengt die XML an; `PDF + XRechnung` erzwingt zusaetzlich
  den PDF-Anhang. Vor dem Versand wird die vorhandene technische
  XRechnung-Mindestpruefung ausgefuehrt; falls der KoSIT-Validator in der
  Umgebung konfiguriert ist, blockiert auch eine KoSIT-Ablehnung den Versand.
  `ZUGFeRD PDF` bleibt bewusst gesperrt und meldet, dass dieser technische
  Schritt noch nicht angebunden ist. Verkaeufer ist fuer alle Marken immer
  OK solutions GmbH, da OK immocare nur als Marke genutzt wird. Sicherungen:
  `.codex-safety/document-mail-route-before-xrechnung-mail-20260627.ts`,
  `.codex-safety/dashboard-page-before-xrechnung-mail-20260627.tsx`,
  `.codex-safety/AGENTS-before-xrechnung-mail-20260627.md`. Checks bestanden:
  `npx.cmd tsc --noEmit`, `npm.cmd run check:mojibake`,
  `npm.cmd run check:regressions`.
- Rechnungs-/Stempelzeit-Freigabe 2026-06-27: Geloeschte oder stornierte
  Rechnungen geben verknuepfte Projekt-Stempelzeiten wieder frei. Die
  Freigabe nutzt jetzt zentral `releaseStampedHoursFromInvoice` und setzt
  `invoiceId`, `invoiceNumber` und `invoicedAt` konsequent auf `NULL`, sowohl
  ueber Rechnungs-ID als auch ueber Rechnungsnummer. Bereits entstandene leere
  Platzhalter (`''`) in `ProjectTimeEntry` wurden auf `NULL` normalisiert,
  damit die Zeiten erneut verknuepft werden koennen. Sicherungen:
  `.codex-safety/invoices-route-before-release-time-on-delete-20260627.ts`,
  `.codex-safety/AGENTS-before-release-time-on-delete-20260627.md`. Checks
  bestanden: `npx.cmd tsc --noEmit`, `npm.cmd run check:mojibake`,
  `npm.cmd run check:regressions`.
- Aufgaben-/Kommentar-UI 2026-06-26: Kommentare in Aufgaben wurden optisch in
  eine Chat-Darstellung umgebaut. Eigene Kommentare stehen rechts/blau,
  fremde Kommentare links/weiss. Profilbilder werden im runden Avatar
  angezeigt, sofern vorhanden; sonst bleiben Initialen als Fallback. Das
  Schreibfeld steht jetzt unterhalb des Kommentarverlaufs.
- Stempelungs-/Planungsuebersichten 2026-06-26: Erwartete Stempelungen wurden
  kompakter und auswertbarer gemacht, inklusive Datum/Zeit Plan, Datum/Zeit
  Ist, Sollzeit, Istzeit, Differenz, Leistungsgrad, Status, Puenktlichkeit,
  Rechnung, Kommentar und Aktion. Puenktlichkeit nutzt einstellbare Start- und
  Ende-Toleranzen in den Firmeneinstellungen. Unplausible Leistungsgrade
  werden sichtbar markiert und sollen in Auswertungen nicht als normale KPI
  gewertet werden.
- Auswertungen/KPI 2026-06-26: Mitarbeiter- und Team-KPIs wurden um
  Puenktlichkeits-Tendenzen erweitert. KPI-Kacheln in Mitarbeiterkarten
  koennen Detailmodale oeffnen; diese Modale haben Suche, Statusfilter und
  Zeitraumlogik. Puenktlichkeit wird als Tendenz statt nur als Prozentwert
  dargestellt.
- Unterbrechung/Nachfasslogik 2026-06-26: Bei unterbrochener Arbeit ist ein
  Kommentar Pflicht. Unterbrochene Stempelungen werden in Projektuebersichten
  sichtbar. Es gibt zentrale Fristen in den Firmeneinstellungen fuer
  Nachfass-/Eskalationsmeldungen bei unterbrochener Arbeit: Standard 2 Tage
  an Projektverantwortliche/Fuehrungskraft und 7 Tage an Geschaeftsfuehrung.
  Offene Punkte fuer spaetere Pruefung: Benachrichtigungs-/Aufgabenlauf fuer
  diese Eskalation noch einmal fachlich komplett gegen echte Daten testen.
- Historie und Loeschsicherheit 2026-06-26: Abwesenheiten werden nicht mehr
  hart geloescht, sondern mit `deletedAt` markiert und mit Historieneintrag
  `Abwesenheit geloescht` versehen. Die Team-Kalender-Historie laedt auch
  geloeschte Abwesenheiten und zeigt sie als `Geloescht`. Termin- und
  Stempelungs-Historieneintraege in der Projektakte koennen nur von
  Geschaeftsfuehrung ueber ein kleines `x` geloescht werden; Backend schuetzt
  dies ebenfalls mit 403 fuer andere Rollen. Systemweit bleiben echte
  Loeschpfade in einzelnen Alt-/Stammdatenbereichen ein separater Folgeblock.
- Letzte Checks 2026-06-26: Nach den juengsten UI-/Rechnungs-/PDF-Aenderungen
  bestanden `npx.cmd tsc --noEmit`, `npm.cmd run check:mojibake`,
  `npm.cmd run check:regressions` und `npm.cmd run build`. Ein erster Build
  zeigte einmal einen Next-Zwischenfehler bei `/api/content-items`; der direkte
  Wiederholungslauf war erfolgreich.

- Phase-2-Dokumentversandrechte 2026-06-20: Als elfter kleiner Schritt der
  Rollen-/Berechtigungsmatrix wurden Dokumentversandrechte in
  `src/lib/permissions/index.ts` zentralisiert und in
  `src/app/api/document-mail/route.ts` genutzt. Einfach gesagt: Angebote per
  Mail versenden duerfen die Angebotsrollen Admin, Geschaeftsfuehrung,
  Fuehrungskraft und Vertrieb; Rechnungen, Stornos und Mahnungen versenden
  duerfen Admin, Geschaeftsfuehrung, Fuehrungskraft und Buchhaltung;
  allgemeine Dokumente/Taetigkeitsberichte versenden duerfen Admin,
  Geschaeftsfuehrung, Fuehrungskraft, Vertrieb und Buchhaltung. Vor dem
  Versand prueft die API jetzt, ob das Dokument bzw. Projekt zur
  Demo-Organisation gehoert. Versandhistorie (`GET /api/document-mail`) verlangt
  jetzt ebenfalls einen aktiven Actor; der Dashboard-Loader sendet dafuer
  `activeUserId` als `actorId` mit. Mail-OAuth-Start/Callback wurden in diesem
  Block nicht umgebaut, weil sie bereits im Phase-1-OAuth-Block abgesichert
  wurden. Sicherungen:
  `.codex-safety/*_before_phase2_document_mail_permissions_20260620_*.ts`
  und `.codex-safety/AGENTS_before_phase2_document_mail_permissions_20260620_*.md`.
  Checks bestanden: `git diff --check -- src/lib/permissions/index.ts src/app/api/document-mail/route.ts src/components/dashboard/dashboard-page.tsx`,
  `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`.
- Phase-2-Dokumentkonfigurationsrechte 2026-06-20: Als zehnter kleiner
  Schritt der Rollen-/Berechtigungsmatrix wurden Dokumentkonfigurationsrechte
  in `src/lib/permissions/index.ts` zentralisiert und in
  `src/app/api/document-types/route.ts` sowie
  `src/app/api/document-texts/route.ts` genutzt. Einfach gesagt:
  Dokumenttypen sowie Dokumenttexte/Titel lesen duerfen aktive Benutzer weiter
  wie bisher; anlegen, bearbeiten, archivieren oder loeschen duerfen nur Admin
  und Geschaeftsfuehrung. `src/app/api/document-position-search/route.ts`
  blieb bewusst unveraendert, weil es eine Lesesuche ist.
  `src/app/api/document-mail/route.ts` wurde in diesem Block ebenfalls nicht
  umgebaut, weil das Dokumentversand und nicht Text-/Typ-Konfiguration ist.
  Sicherungen:
  `.codex-safety/*_before_phase2_document_config_permissions_20260620_*.ts`
  und `.codex-safety/AGENTS_before_phase2_document_config_permissions_20260620_*.md`.
  Checks bestanden: `git diff --check -- src/lib/permissions/index.ts src/app/api/document-types/route.ts src/app/api/document-texts/route.ts`,
  `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`.
- Phase-2-Salesrechte 2026-06-20: Als neunter kleiner Schritt der
  Rollen-/Berechtigungsmatrix wurden Sales-/Vertriebsrechte in
  `src/lib/permissions/index.ts` zentralisiert und in
  `src/app/api/potentials/route.ts`, `src/app/api/sales-targets/route.ts`,
  `src/app/api/sales-opportunities/route.ts` sowie
  `src/app/api/sales-opportunities/activities/route.ts` genutzt. Einfach
  gesagt: Sales-Ziele, Verkaufschancen und Verkaufschancen-Aktivitaeten
  bearbeiten duerfen Admin, Geschaeftsfuehrung, Fuehrungskraft und Vertrieb;
  Vertrieb darf dabei eigene Datensaetze bearbeiten, Admin/GF/Fuehrungskraft
  duerfen uebergreifend steuern und anderen Personen zuweisen. Potenziale
  anlegen bleibt fuer aktive Nicht-Gast-Benutzer moeglich, damit operative
  Zusatzverkaufs-Hinweise aus Projekten/Abnahmen nicht verloren gehen.
  Potenziale bearbeiten duerfen Sales-Rollen uebergreifend bzw. der
  zustaendige Sales-Owner. Aktivitaeten zu Verkaufschancen pruefen jetzt auch,
  ob die Chance in derselben Organisation existiert. Sicherungen:
  `.codex-safety/*_before_phase2_sales_permissions_20260620_*.ts` und
  `.codex-safety/AGENTS_before_phase2_sales_permissions_20260620_*.md`.
  Checks bestanden: `git diff --check -- src/lib/permissions/index.ts src/app/api/potentials/route.ts src/app/api/sales-targets/route.ts src/app/api/sales-opportunities/route.ts src/app/api/sales-opportunities/activities/route.ts`,
  `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`.
- Phase-2-Projekt-Planungsregeln 2026-06-20: Als achter kleiner Schritt der
  Rollen-/Berechtigungsmatrix wurden Projekt-/Planungsregel-Rechte in
  `src/lib/permissions/index.ts` zentralisiert und in
  `src/app/api/business-area-targets/route.ts`,
  `src/app/api/project-marketing-quotas/route.ts`,
  `src/app/api/planning-entries/route.ts`,
  `src/app/api/status-rules/route.ts`,
  `src/app/api/escalation-rules/route.ts`,
  `src/app/api/status-escalations/route.ts` und
  `src/app/api/status-timeline/route.ts` genutzt. Einfach gesagt:
  Geschaeftsbereich-Sollwerte, Marketing-Kontingent-Konfiguration,
  Status-Regeln und Eskalationsregeln duerfen serverseitig nur Admin und
  Geschaeftsfuehrung pflegen. Planungsverwaltung, Status-Eskalationslauf und
  Status-Zeitlinie neu aufbauen duerfen Admin, Geschaeftsfuehrung und
  Fuehrungskraft. Das operative Abhaken/Zuruecksetzen von
  Projekt-Marketing-Kontingenten blieb fachlich unveraendert; gebremst wurde
  nur die Konfiguration der Kontingent-Stammdaten. Sicherungen:
  `.codex-safety/*_before_phase2_project_planning_permissions_20260620_*.ts`
  und `.codex-safety/AGENTS_before_phase2_project_planning_permissions_20260620_*.md`.
  Checks bestanden: `git diff --check -- src/lib/permissions/index.ts src/app/api/business-area-targets/route.ts src/app/api/project-marketing-quotas/route.ts src/app/api/planning-entries/route.ts src/app/api/status-rules/route.ts src/app/api/escalation-rules/route.ts src/app/api/status-escalations/route.ts src/app/api/status-timeline/route.ts`,
  `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`.
- Phase-2-Stammdatenrechte 2026-06-20: Als siebter kleiner Schritt der
  Rollen-/Berechtigungsmatrix wurden Stammdatenrechte in
  `src/lib/permissions/index.ts` zentralisiert und in
  `src/app/api/catalog-items/route.ts`, `src/app/api/units/route.ts` sowie
  `src/app/api/trades/route.ts` genutzt. Einfach gesagt: Katalogartikel,
  Einheiten und Gewerke lesen duerfen aktive Benutzer weiter wie bisher; diese
  Stammdaten anlegen, bearbeiten oder deaktivieren duerfen serverseitig nur
  Admin und Geschaeftsfuehrung. Besonders wichtig: Katalogartikel hatten vor
  diesem Block bereits eine Actor-Pruefung, aber noch keine Rollenbremse fuer
  Schreibaktionen. Einheiten und Gewerke hatten die gleiche Regel bereits
  lokal; sie wurde nur in die zentrale Matrix gezogen. Sicherungen:
  `.codex-safety/permissions_index_before_phase2_masterdata_permissions_20260620_*.ts`,
  `.codex-safety/catalog_items_route_before_phase2_masterdata_permissions_20260620_*.ts`,
  `.codex-safety/units_route_before_phase2_masterdata_permissions_20260620_*.ts`,
  `.codex-safety/trades_route_before_phase2_masterdata_permissions_20260620_*.ts`,
  `.codex-safety/AGENTS_before_phase2_masterdata_permissions_20260620_*.md`.
  Checks bestanden: `git diff --check -- src/lib/permissions/index.ts src/app/api/catalog-items/route.ts src/app/api/units/route.ts src/app/api/trades/route.ts`,
  `npm.cmd run build`, `npx.cmd prisma validate`.
- Phase-2-Aufgabenrechte 2026-06-20: Als sechster kleiner Schritt der
  Rollen-/Berechtigungsmatrix wurden Aufgabenrechte in
  `src/lib/permissions/index.ts` zentralisiert und in
  `src/app/api/tasks/route.ts` sowie
  `src/app/api/tasks/[taskId]/time-entries/route.ts` genutzt. Einfach gesagt:
  Aufgaben anderen Personen zuweisen duerfen weiter Admin,
  Geschaeftsfuehrung und Fuehrungskraft; Aufgaben loeschen oder
  wiederherstellen duerfen Admin und Geschaeftsfuehrung; Aufgabenzeiten
  verwalten duerfen Admin, Geschaeftsfuehrung und Fuehrungskraft. Eigene bzw.
  beteiligte Aufgabenzeiten, Aufgabenannahme/-ablehnung und Kommentare fuer
  Owner/Ersteller/Beteiligte blieben fachlich erhalten. Sicherungen:
  `.codex-safety/permissions_index_before_phase2_task_permissions_20260620_170453.ts`,
  `.codex-safety/tasks_route_before_phase2_task_permissions_20260620_170453.ts`,
  `.codex-safety/task_time_entries_route_before_phase2_task_permissions_20260620_170453.ts`,
  `.codex-safety/AGENTS_before_phase2_task_permissions_20260620_170453.md`.
  Checks bestanden: `git diff --check -- src/lib/permissions/index.ts src/app/api/tasks/route.ts src/app/api/tasks/[taskId]/time-entries/route.ts src/app/api/tasks/[taskId]/comments/route.ts src/app/api/tasks/respond/route.ts`,
  `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`.
- Phase-2-Zeitrechte 2026-06-20: Als fuenfter kleiner Schritt der
  Rollen-/Berechtigungsmatrix wurden Projektzeit- und
  Ueberstundenfreigabe-Rechte in `src/lib/permissions/index.ts`
  zentralisiert und in `src/app/api/project-time-entries/route.ts` genutzt.
  Einfach gesagt: Projektzeiten fuer andere Personen bzw. verwaltete
  Korrekturen duerfen weiter Admin, Geschaeftsfuehrung, Fuehrungskraft und
  Buchhaltung bearbeiten; Ueberstundenfreigaben duerfen Admin,
  Geschaeftsfuehrung und Fuehrungskraft. Normale Nutzer duerfen weiterhin nur
  eigene manuelle Zeiteintraege anlegen, bearbeiten oder loeschen. Die
  eigentliche Stempel-Start/Pause/Stop-Logik in `src/app/api/stamp-session/route.ts`
  wurde in diesem Block nicht fachlich veraendert. Sicherungen:
  `.codex-safety/permissions_index_before_phase2_time_permissions_20260620_145925.ts`,
  `.codex-safety/project_time_entries_route_before_phase2_time_permissions_20260620_145925.ts`,
  `.codex-safety/AGENTS_before_phase2_time_permissions_20260620_145925.md`.
  Checks bestanden: `git diff --check -- src/lib/permissions/index.ts src/app/api/project-time-entries/route.ts src/app/api/stamp-session/route.ts`,
  `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`.
- Phase-2-Sensible-Personaldaten 2026-06-20: Als vierter kleiner Schritt der
  Rollen-/Berechtigungsmatrix wurden die Rechte fuer
  `src/app/api/employee-assessments/route.ts` und
  `src/app/api/employee-costs/route.ts` in `src/lib/permissions/index.ts`
  zentralisiert. Einfach gesagt: Mitarbeiterbeurteilungen nutzen jetzt die
  zentrale Managerregel `canManageEmployeeAssessments` fuer Admin und
  Geschaeftsfuehrung. Lohnkosten nutzen jetzt zentral
  `canAccessEmployeeCosts`; die bisherige enge Namensfreigabe fuer Ramona Eid
  und Christian Eid wurde bewusst beibehalten und nicht auf weitere Rollen
  ausgeweitet, damit Gehaltsdaten nicht versehentlich breiter sichtbar werden.
  Die vorhandenen Selbstbearbeitungsregeln fuer Selbsteinschaetzung und DISG
  blieben erhalten. Sicherungen:
  `.codex-safety/permissions_index_before_phase2_employee_sensitive_20260620_145517.ts`,
  `.codex-safety/employee_costs_route_before_phase2_employee_sensitive_20260620_145517.ts`,
  `.codex-safety/employee_assessments_route_before_phase2_employee_sensitive_20260620_145517.ts`,
  `.codex-safety/AGENTS_before_phase2_employee_sensitive_20260620_145517.md`.
  Checks bestanden: `git diff --check -- src/lib/permissions/index.ts src/app/api/employee-costs/route.ts src/app/api/employee-assessments/route.ts`,
  `npx.cmd prisma validate`, `npm.cmd run check:mojibake` und
  `npm.cmd run build`. Der erste Buildlauf brach einmal ohne konkrete
  Codezeile mit einem Next/Jest-Worker-Fehler ab; der direkte Wiederholungslauf
  bestand vollstaendig.
- Phase-2-Benutzer-Team-Rechte 2026-06-20: Als dritter kleiner Schritt der
  Rollen-/Berechtigungsmatrix wurden die bereits vorhandenen Regeln fuer
  Benutzer, Teams und Personalnummern in `src/lib/permissions/index.ts`
  zentralisiert und in `src/app/api/users/route.ts` sowie
  `src/app/api/teams/route.ts` genutzt. Einfach gesagt: Benutzer und Teams
  verwalten duerfen weiterhin nur Admin und Geschaeftsfuehrung; die
  Personalnummer darf weiterhin nur Geschaeftsfuehrung aendern. Die
  Selbstbearbeitung eigener Einstellungen bleibt erhalten, und die
  Mitarbeiter-Emulation im Dashboard wurde nicht veraendert. Der Block ist
  bewusst kein UI-Umbau und keine Erweiterung der Rechte, sondern zieht die
  bestehenden Serverregeln in die zentrale Rollenmatrix. Sicherungen:
  `.codex-safety/permissions_index_before_phase2_user_team_permissions_20260620_145056.ts`,
  `.codex-safety/users_route_before_phase2_user_team_permissions_20260620_145056.ts`,
  `.codex-safety/teams_route_before_phase2_user_team_permissions_20260620_145056.ts`,
  `.codex-safety/AGENTS_before_phase2_user_team_permissions_20260620_145056.md`.
  Checks bestanden: `git diff --check -- src/lib/permissions/index.ts src/app/api/users/route.ts src/app/api/teams/route.ts`,
  `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`.
- Phase-2-Rechnungsrechte 2026-06-20: Als zweiter kleiner Schritt der
  Rollen-/Berechtigungsmatrix wurden zentrale Rechnungsrechte in
  `src/lib/permissions/index.ts` ergaenzt und in
  `src/app/api/invoices/route.ts` fuer schreibende Rechnungsaktionen genutzt.
  Einfach gesagt: Rechnungen anlegen, bearbeiten, fakturieren, stornieren,
  als bezahlt markieren, Mahnungen erfassen/erstellen und Druckhistorie
  schreiben duerfen serverseitig nur Admin, Geschaeftsfuehrung,
  Fuehrungskraft und Buchhaltung. Vertrieb, normale Mitarbeitende und Gast
  werden bei diesen Finanzaktionen mit `403` geblockt. Die bestehende
  Loeschregel wurde nicht gelockert: Rechnungen loeschen darf weiterhin nur
  Geschaeftsfuehrung. Lesen, PDF-Oeffnen, XRechnung-Download und
  Vorschau-PDF wurden nicht umgebaut. Die Historie nutzt jetzt auch bei
  Rechnungen konsequent den geprueften Actor-Namen statt frei mitgesendeter
  Namen. Sicherungen:
  `.codex-safety/permissions_index_before_phase2_invoice_permissions_20260620_144358.ts`,
  `.codex-safety/invoices_route_before_phase2_invoice_permissions_20260620_144358.ts`,
  `.codex-safety/AGENTS_before_phase2_invoice_permissions_20260620_144358.md`.
  Checks bestanden: `git diff --check -- src/lib/permissions/index.ts src/app/api/invoices/route.ts`,
  `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`.
- Phase-2-Angebotsrechte 2026-06-20: Als erster kleiner Schritt der
  Rollen-/Berechtigungsmatrix wurden zentrale Angebotsrechte in
  `src/lib/permissions/index.ts` ergaenzt und in
  `src/app/api/offers/route.ts` fuer schreibende Aktionen genutzt. Einfach
  gesagt: Angebote anlegen, bearbeiten, gewinnen/verloren setzen und
  wiederherstellen duerfen jetzt serverseitig nur noch Admin,
  Geschaeftsfuehrung, Fuehrungskraft und Vertrieb; Angebote loeschen duerfen
  nur Admin und Geschaeftsfuehrung. Lesen und PDF-/Vorschauwege wurden nicht
  umgebaut. Die UI sendet bei den betroffenen Schreibaktionen bereits
  `actorId: activeUserId`, deshalb bleibt die normale Bedienung fuer
  berechtigte Rollen erhalten; unberechtigte Rollen erhalten sauber `403`
  statt unkontrollierter Aenderung. Sicherungen:
  `.codex-safety/permissions_index_before_phase2_accounting_20260620_143748.ts`,
  `.codex-safety/offers_route_before_phase2_accounting_20260620_143748.ts`,
  `.codex-safety/AGENTS_before_phase2_offers_permissions_20260620_144032.md`.
  Checks bestanden: `git diff --check -- src/lib/permissions/index.ts src/app/api/offers/route.ts`,
  `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`.
- Phase-1-Abschlusscheck 2026-06-20: Die Rechte-/Actor-ID-Roadmap wurde nach
  den Einzelbloecken technisch gegengeprueft. Restmuster-Suchen ueber
  `src/app/api` zeigen keine weitere aktive produktive Route, die im Rahmen
  dieser Phase noch ungesteuert auf einen Demo-User-Fallback setzen muss. Die
  verbleibenden auffaelligen Treffer sind entweder bereits abgesicherte
  `getRequestActor`-/`getRequestUser`-Hilfsfunktionen, bewusst behandelte
  Sonderfaelle (`auth/login`, `public-feedback/[token]`, Mail-OAuth) oder der
  deaktivierte Content-Management-Legacybereich (`content-items`,
  `idea-store`, `marketing-content`). Abschlusschecks bestanden:
  `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake` und `git diff --check`. `prisma db push` wurde
  im Abschluss nicht ausgefuehrt, weil keine neue Schemaaenderung Teil dieses
  Abschlussvermerks war. Sicherung:
  `.codex-safety/AGENTS_before_phase1_completion_note_20260620.md`.
- Phase-1-Auth-Public-Feedback-Sonderfaelle 2026-06-20: `src/app/api/auth/login/route.ts`
  und `src/app/api/public-feedback/[token]/route.ts` wurden als bewusste
  Sonderfaelle der Rechte-/Actor-ID-Roadmap behandelt. Einfach gesagt: Login
  kann vor der Anmeldung noch keinen Actor haben, und oeffentliches
  Kundenfeedback muss weiter per Token ohne internen Actor funktionieren.
  Deshalb wurde keine Actor-Pflicht eingebaut. Stattdessen wurde nur die
  defensive JSON-Behandlung nachgezogen: kaputtes JSON im Login wird wie
  fehlende/falsche Zugangsdaten behandelt, kaputtes JSON im oeffentlichen
  Feedback laesst die bestehende Token- und Statuspruefung sauber greifen.
  Bestehende Login-Regeln fuer aktive Benutzer, Passwortvergleich,
  Team-/Profilrueckgabe, Feedback-Tokenpruefung, Einmalbeantwortung,
  Rating-Normalisierung, Hot-Alert-Erzeugung und Request-Statusupdate blieben
  fachlich erhalten. Sicherungen:
  `.codex-safety/auth_login_route_20260620_phase1_special_before.ts`,
  `.codex-safety/public_feedback_token_route_20260620_phase1_special_before.ts`
  und `.codex-safety/AGENTS_before_auth_public_feedback_special_cases_20260620.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/auth/login/route.ts src/app/api/public-feedback/[token]/route.ts`.
  Gezielter lokaler HTTP-Test ueber separaten Server auf Port 3210:
  Login-`POST` mit kaputtem JSON 401 und Public-Feedback-`POST` mit kaputtem
  JSON plus ungueltigem Token 404. Es wurden keine Login-Daten, Feedbackdaten
  oder Benachrichtigungen erzeugt.
- Phase-1-Mail-OAuth-API 2026-06-20: Als achtundvierzigster kleiner Fix aus
  der Rechte-/Actor-ID-Roadmap wurden
  `src/app/api/mail/oauth/start/route.ts` und
  `src/app/api/mail/oauth/callback/route.ts` abgesichert. Einfach gesagt
  betrifft das die Microsoft-365-Verbindung eines Mitarbeiter-Mailkontos. Der
  OAuth-Start verlangt jetzt neben dem Ziel-`userId` auch einen aktiven
  `actorId`; Zielbenutzer und Actor muessen in der Demo-Organisation aktiv
  sein. Der OAuth-State enthaelt jetzt `userId` und `actorId`, und der Callback
  prueft beide erneut, bevor Token getauscht oder ein Mailkonto in den
  Benutzer geschrieben wird. Das abschliessende `UPDATE "User"` ist zusaetzlich
  auf aktive Benutzer begrenzt. Bestehende OAuth-Konfiguration,
  State-Cookie-Pruefung, ReturnTo-Redirect, Microsoft-Tokenaustausch,
  Graph-Profilabruf und Cookie-Cleanup blieben fachlich erhalten. In
  `src/components/dashboard/dashboard-page.tsx` sendet die Oberflaeche beim
  Start der Microsoft-365-Verbindung nun `activeUserId` als `actorId` mit; ohne
  aktiven Benutzer oder ohne gespeicherten Zielmitarbeiter wird lokal gestoppt.
  Sicherungen:
  `.codex-safety/mail_oauth_start_route_20260620_phase1_before.ts`,
  `.codex-safety/mail_oauth_callback_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_mail_oauth_phase1_20260620.tsx` und
  `.codex-safety/AGENTS_before_mail_oauth_phase1_20260620.md`. Checks
  bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/mail/oauth/start/route.ts src/app/api/mail/oauth/callback/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter lokaler HTTP-Test ueber
  separaten Server auf Port 3210: OAuth-Start ohne Zielbenutzer 400, ohne
  Actor 401, mit ungueltigem Actor 401, mit aktivem Zielbenutzer und aktivem
  Actor 307 zu Microsoft, sowie Callback mit ungueltigem State 307 zur App mit
  `mailOAuth=error&reason=ungueltiger_status`. Es wurde kein externer
  Microsoft-Login ausgefuehrt, kein Token getauscht und kein Mailkonto
  geschrieben.
- Phase-1-Content-Management-Legacy-Notiz 2026-06-20: Die Routen
  `src/app/api/content-items/route.ts`, `src/app/api/idea-store/route.ts` und
  `src/app/api/marketing-content/route.ts` wurden im Rahmen der
  Rechte-/Actor-ID-Roadmap bewusst nicht weiter angefasst. Einfach gesagt ist
  das der alte/deaktivierte Content-Management-Bereich. In
  `src/components/dashboard/dashboard-page.tsx` steht
  `CONTENT_MANAGEMENT_ENABLED = false`; die Content-Management-Tabs werden
  ueber `isContentManagementTab` ausgefiltert, Benachrichtigungsnavigation zum
  Ideen-Feed wird bei deaktiviertem Content-Management abgefangen, und das
  initiale Laden der Content-/Ideen-Daten laeuft nur innerhalb des
  Feature-Flags. Deshalb gibt es aktuell keinen produktiven UI-Pfad, der diese
  Routen regulaer nutzt. Diese Routen zaehlen fuer Phase 1 nicht als fertig
  abgesicherter produktiver Bereich, sondern als Legacy-/Reaktivierungsblock.
  Falls Content-Management spaeter wieder aktiviert werden soll, muss es vor
  Freischaltung als eigener Block behandelt werden: UI-Pfade pruefen,
  Datenmodell/Tabellenmigration pruefen, Actor-ID-Pflicht in den betroffenen
  APIs nachziehen, bestehende Benachrichtigungen/Ideenplanung pruefen und
  End-to-End testen. Sicherung:
  `.codex-safety/AGENTS_before_content_management_legacy_note_20260620.md`.
  Checks: lokale Codepruefung der Feature-Flag-Stellen und
  `git diff --check -- AGENTS.md`. Es wurden keine Routen- oder UI-
  Verhaltensaenderungen vorgenommen.
- Phase-1-Smoke-Detector-Reports-API 2026-06-20: Als siebenundvierzigster
  kleiner Fix aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/smoke-detector-reports/route.ts` abgesichert. Einfach gesagt
  betrifft das den Rauchmelder-Installationsnachweis, der ein PDF erzeugt und
  im Projektlogbuch unter Checklisten ablegt. `POST` verlangt jetzt einen
  aktiven Actor aus der Demo-Organisation; fehlender, ungueltiger oder
  inaktiver `actorId` fuehrt kontrolliert zu 401. Fehlerhaftes JSON wird
  defensiv wie fehlende Daten behandelt. Der Autor des Logbucheintrags wird
  jetzt serverseitig aus dem geprueften Actor gesetzt; frei mitgesendete
  Installer-/Browserwerte koennen den Autor nicht mehr ersetzen. Bestehende
  Projekt-/Kontaktabfrage, Pflichtpruefungen, Seriennummern-Abweichungsregel,
  PDF-Template-Erzeugung, Bildverarbeitung, Dublettenpruefung nach Dateiname
  und Logbuchablage blieben fachlich erhalten. In
  `src/components/dashboard/dashboard-page.tsx` sendet die Oberflaeche beim
  Erstellen des Rauchmelder-Nachweises nun `activeUserId` als `actorId` mit;
  ohne aktiven Benutzer wird lokal gestoppt. Sicherungen:
  `.codex-safety/smoke_detector_reports_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_smoke_detector_reports_phase1_20260620.tsx`
  und `.codex-safety/AGENTS_before_smoke_detector_reports_phase1_20260620.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/smoke-detector-reports/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender Actor bei `POST` 401, ungueltiger
  Actor bei `POST` 401 und aktiver Actor mit bewusst unvollstaendigen
  Fachdaten 400. Es wurde bewusst kein PDF erzeugt und kein Logbucheintrag
  geschrieben.
- Phase-1-Labor-Hour-Metrics-API 2026-06-20: Als sechsundvierzigster kleiner
  Fix aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/labor-hour-metrics/route.ts` abgesichert. Einfach gesagt
  betrifft das interne Stundenkennzahlen aus Stempelungen, Angebotspositionen,
  Planungseintraegen und Rechnungspositionen. `GET` verlangt jetzt einen
  aktiven Actor aus der Demo-Organisation; fehlender, ungueltiger oder
  inaktiver `actorId` fuehrt kontrolliert zu 401. Bestehende
  Tabellen-/Spaltenabsicherung, Organisationsfilter, Zusammenfuehrung nach
  Projekt/Mitarbeiter, Quellenzaehler, Rundung und Summenbildung blieben
  fachlich erhalten. Es wurde kein aktiver Dashboard-Fetch auf
  `/api/labor-hour-metrics` gefunden; deshalb war keine UI-Aenderung noetig.
  Sicherungen:
  `.codex-safety/labor_hour_metrics_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_labor_hour_metrics_phase1_20260620.tsx`
  und `.codex-safety/AGENTS_before_labor_hour_metrics_phase1_20260620.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/labor-hour-metrics/route.ts`. `prisma db
  push` wurde bewusst nicht ausgefuehrt, weil keine Schemaaenderung Teil dieses
  Fixes war. Gezielter HTTP-Test ueber separaten lokalen Server auf Port 3210:
  fehlender Actor bei `GET` 401, ungueltiger Actor bei `GET` 401 und aktiver
  Actor bei `GET` 200 mit 14 Auswertungszeilen. Es wurden keine Daten
  veraendert.
- Phase-1-Legacy-Invoices-API 2026-06-20: Als fuenfundvierzigster kleiner
  Fix aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/legacy-invoices/route.ts` abgesichert. Einfach gesagt betrifft
  das importierte HERO-Altrechnungen und die Route zum Zuruecksetzen dieser
  Importdaten. `GET` und `DELETE` verlangen jetzt einen aktiven Actor aus der
  Demo-Organisation; fehlender, ungueltiger oder inaktiver `actorId` fuehrt
  kontrolliert zu 401. Bestehende Tabellenabsicherung, Seed der HERO-
  Altrechnungen, Quellenfilter, Storno-Klassifizierung und Serialisierung
  blieben fachlich erhalten. In `src/components/dashboard/dashboard-page.tsx`
  sendet die Oberflaeche beim Laden der Altrechnungen nun `activeUserId` als
  `actorId` mit; ohne aktiven Benutzer wird lokal gestoppt. Sicherungen:
  `.codex-safety/legacy_invoices_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_legacy_invoices_phase1_20260620.tsx`
  und `.codex-safety/AGENTS_before_legacy_invoices_phase1_20260620.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/legacy-invoices/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender Actor bei `GET` 401, ungueltiger
  Actor bei `GET` 401, aktiver Actor bei `GET` 200 mit 596 Zeilen,
  fehlender Actor bei `DELETE` 401 und ungueltiger Actor bei `DELETE` 401.
  Ein erfolgreicher `DELETE` wurde bewusst nicht getestet, damit keine
  echten Altrechnungsdaten geloescht werden.
- Phase-1-Monthly-Financial-Report-API 2026-06-20: Als vierundvierzigster
  kleiner Fix aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/monthly-financial-report/route.ts` abgesichert. Einfach gesagt
  betrifft das Monatsbericht-/BWA-Ergaenzungswerte wie sonstige Ertraege,
  Kosten, Steuern, Gewinnvortrag, Ausschuettung und Ruecklagen. `GET` und
  `POST` verlangen jetzt einen aktiven Actor aus der Demo-Organisation;
  fehlender, ungueltiger oder inaktiver `actorId` fuehrt kontrolliert zu 401.
  Beim Speichern werden `updatedByUserId` und `updatedByName` jetzt
  serverseitig aus dem geprueften Actor gesetzt; frei mitgesendete Namen oder
  Benutzer-IDs aus der Oberflaeche werden nicht mehr uebernommen.
  Fehlerhaftes JSON wird defensiv wie fehlende Daten behandelt. Bestehende
  Tabellenabsicherung, Zeilenschluessel-Whitelist, Monatsvalidierung,
  Betragsnormalisierung und Upsert je Organisation/Zeile/Monat blieben
  fachlich erhalten. In `src/components/dashboard/dashboard-page.tsx` sendet
  die Oberflaeche beim Laden und Speichern der Monatsberichtswerte nun
  `activeUserId` als `actorId` mit; ohne aktiven Benutzer wird lokal gestoppt.
  Sicherungen:
  `.codex-safety/monthly_financial_report_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_monthly_financial_report_phase1_20260620.tsx`
  und `.codex-safety/AGENTS_before_monthly_financial_report_phase1_20260620.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/monthly-financial-report/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender Actor bei `GET` 401, ungueltiger
  Actor bei `GET` 401, aktiver Actor bei `GET` 200, ungueltiger Actor bei
  `POST` 401 und aktiver Actor bei `POST` 200; der Test bestaetigte, dass
  gefaelschte `updatedBy...`-Werte nicht uebernommen werden. Der temporaere
  Testwert fuer `other_operating_income` im Monat `2099-12` wurde bereinigt.
- Phase-1-Winter-Service-Runs-API 2026-06-20: Als dreiundvierzigster kleiner
  Fix aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/winter-service-runs/route.ts` abgesichert. Einfach gesagt
  betrifft das Winterdienst-Einsaetze, PDF-Abruf, Einsatzanlage und
  Statuswechsel wie versendet oder abgerechnet. `GET`, `POST` und `PATCH`
  verlangen jetzt einen aktiven Actor aus der Demo-Organisation; fehlender,
  ungueltiger oder inaktiver `actorId` fuehrt kontrolliert zu 401. Fehlerhaftes
  JSON wird defensiv wie fehlende Daten behandelt. Bestehende
  Tabellenabsicherung, Monatsfilter, PDF-Rueckgabe, PDF-Erzeugung,
  Bildnormalisierung, Reportnummernvergabe, Statuswechsel und
  Logbuchablage blieben fachlich erhalten. Es wurde kein direkter
  Dashboard-Aufruf auf `/api/winter-service-runs` gefunden; deshalb war keine
  UI-Aenderung noetig. Sicherungen:
  `.codex-safety/winter_service_runs_route_20260620_phase1_before.ts` und
  `.codex-safety/AGENTS_before_winter_service_runs_phase1_20260620.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/winter-service-runs/route.ts`. `prisma db
  push` wurde bewusst nicht ausgefuehrt, weil keine Schemaaenderung Teil dieses
  Fixes war. Gezielter HTTP-Test ueber separaten lokalen Server auf Port 3210:
  fehlender Actor bei `GET` 401, ungueltiger Actor bei `GET` 401, aktiver Actor
  bei `GET` 200, ungueltiger Actor bei `POST` 401, aktiver Actor mit
  temporaerem Einsatz 201, ungueltiger Actor bei `PATCH` 401,
  `PATCH mark-sent` mit aktivem Actor 200 und `PATCH mark-billed` mit aktivem
  Actor 200; der temporaere Einsatz wurde bereinigt. Es wurde bewusst keine
  PDF-Erzeugung und kein Mailversand angestossen.
- Phase-1-Winter-Service-Automation-API 2026-06-20: Als zweiundvierzigster
  kleiner Fix aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/winter-service-automation/route.ts` abgesichert. Einfach gesagt
  betrifft das die Winterdienst-Automatik-Einstellungen und den automatischen
  Versandlauf fuer Taetigkeitsberichte. `GET` und `PUT` verlangen jetzt einen
  aktiven Actor aus der Demo-Organisation; fehlender, ungueltiger oder
  inaktiver `actorId` fuehrt kontrolliert zu 401. Der Versandlauf verwendet
  bei aktiver Automatik den gespeicherten aktiven Absender oder, falls kein
  gueltiger Absender gespeichert ist, den mitgesendeten aktiven Actor; der
  bisherige Demo-User-Fallback wurde entfernt. Ein deaktivierter Automatiklauf
  darf weiter ohne Actor sauber mit `skipped: "disabled"` enden, damit der
  Hintergrund-Timer im ausgeschalteten Zustand keine Fehlermeldungen erzeugt.
  Bestehende Tabellenabsicherung, Lauf-Erkennung, PDF-Erstellung ueber
  Activity-Reports, Versand ueber Document-Mail, Fehlerbenachrichtigungen und
  Scheduler-Synchronisierung blieben fachlich erhalten. In
  `src/components/dashboard/dashboard-page.tsx` sendet die Oberflaeche beim
  Laden und Speichern der Winterdienst-Automatik nun `activeUserId` als
  `actorId` mit; ohne aktiven Benutzer wird lokal gestoppt. Sicherungen:
  `.codex-safety/winter_service_automation_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_winter_service_automation_phase1_20260620.tsx`
  und `.codex-safety/AGENTS_before_winter_service_automation_phase1_20260620.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/winter-service-automation/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender Actor bei `GET` 401, ungueltiger
  Actor bei `GET` 401, aktiver Actor bei `GET` 200, ungueltiger Actor bei
  `PUT` 401, aktiver Actor bei `PUT` 200 und deaktivierter `POST`-Trockenlauf
  ohne Actor 200; die vorherigen Einstellungen wurden wiederhergestellt und es
  wurde kein echter Versandlauf gestartet.
- Phase-1-News-Feed-API 2026-06-20: Als einundvierzigster kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurden `src/app/api/news-feed/route.ts`,
  `src/app/api/news-feed/comments/route.ts`,
  `src/app/api/news-feed/reactions/route.ts` und
  `src/app/api/news-feed/votes/route.ts` abgesichert. Einfach gesagt betrifft
  das News-Beitraege, Lesen/als gelesen markieren, Kommentare, Reaktionen und
  Abstimmungen. Die Routen verlangen jetzt einen aktiven Actor aus der
  Demo-Organisation; fehlender, ungueltiger oder inaktiver `actorId` fuehrt
  kontrolliert zu 401. Der bisherige Demo-User-Fallback wurde entfernt.
  Reaktionen, Abstimmungen und Gelesen-Markierungen akzeptieren aus
  Kompatibilitaetsgruenden weiterhin `userId`, pruefen ihn aber serverseitig
  wie einen Actor. Fehlerhaftes JSON wird defensiv wie fehlende Daten
  behandelt. Bestehende Tabellenabsicherung, Organisationsfilter,
  Sichtbarkeitslogik, Attachment-/Poll-Normalisierung, Reaktionswechsel,
  Vote-Ersetzung und Lesestatus-Upsert blieben fachlich erhalten. In
  `src/components/dashboard/dashboard-page.tsx` wurde bewusst nichts geaendert,
  weil fuer `/api/news-feed` kein aktiver Dashboard-Aufruf gefunden wurde; die
  abgeschalteten Content-Management-Bereiche wurden ebenfalls nicht breit
  angefasst. Sicherungen:
  `.codex-safety/news_feed_route_20260620_phase1_before.ts`,
  `.codex-safety/news_feed_comments_route_20260620_phase1_before.ts`,
  `.codex-safety/news_feed_reactions_route_20260620_phase1_before.ts`,
  `.codex-safety/news_feed_votes_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_news_feed_phase1_20260620.tsx` und
  `.codex-safety/AGENTS_before_news_feed_phase1_20260620.md`. Checks
  bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/news-feed/route.ts src/app/api/news-feed/comments/route.ts src/app/api/news-feed/reactions/route.ts src/app/api/news-feed/votes/route.ts`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender/ungueltiger Actor bei News-`GET`
  401, aktiver Actor bei News-`GET` 200, ungueltiger Actor bei News-`POST`
  401, aktiver Actor mit temporaerem Beitrag 201, Lesestatus-`PATCH` 200,
  Kommentar mit ungueltigem Actor 401, Kommentar mit aktivem Actor 201,
  Reaktion mit ungueltigem Actor 401, Reaktion mit aktivem Actor 200,
  Abstimmung mit ungueltigem Actor 401 und Abstimmung mit aktivem Actor 200;
  temporaerer Beitrag samt Kommentar, Reaktion, Vote und Lesestatus wurde
  bereinigt.
- Phase-1-Customer-Feedback-APIs 2026-06-20: Als vierzigster kleiner Fix aus
  der Rechte-/Actor-ID-Roadmap wurden die internen Feedback-Routen
  `src/app/api/customer-feedback/route.ts` und
  `src/app/api/customer-feedback-requests/route.ts` abgesichert. Einfach
  gesagt betrifft das interne KuZu-Bewertungen, Feedback-Anfragen, Hot-Alerts
  und das Loeschen von Bewertungen. Interne `GET`-/`POST`-Aufrufe und
  Feedback-`DELETE` verlangen jetzt einen aktiven Actor aus der
  Demo-Organisation; fehlender, ungueltiger oder inaktiver `actorId` fuehrt
  kontrolliert zu 401. Der Demo-User-Fallback beim internen Anlegen wurde
  entfernt; Sales-User-Fallback ist jetzt der serverseitig gepruefte Actor.
  Die bestehende Geschaeftsfuehrungsregel beim Loeschen bleibt erhalten:
  nicht berechtigte aktive Benutzer erhalten weiter 403. Fehlerhaftes JSON wird
  defensiv wie fehlende Daten behandelt. Bestehende Sales-Hub-
  Tabellenabsicherung, Organisationsfilter, Rating-Normalisierung, Hot-Alert-
  Empfaenger, Token-/URL-Erzeugung fuer Feedback-Anfragen, vorhandene
  Anfrage-Wiederverwendung je Rechnung und Ruecksetzung einer Anfrage nach
  geloeschtem Feedback blieben fachlich erhalten. Die oeffentliche
  Kundenbewertung `src/app/api/public-feedback/[token]/route.ts` wurde bewusst
  nicht mit Actor-Pflicht versehen, damit externe Kunden weiterhin ueber Token
  bewerten koennen. In `src/components/dashboard/dashboard-page.tsx` sendet die
  Oberflaeche beim Laden interner Feedbacks und Feedback-Anfragen nun
  `activeUserId` als `actorId` mit; ohne aktiven Benutzer wird lokal gestoppt.
  Sicherungen:
  `.codex-safety/customer_feedback_route_20260620_phase1_before.ts`,
  `.codex-safety/customer_feedback_requests_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_customer_feedback_phase1_20260620.tsx`
  und `.codex-safety/AGENTS_before_customer_feedback_phase1_20260620.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/customer-feedback/route.ts src/app/api/customer-feedback-requests/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender/ungueltiger Actor bei beiden
  internen `GET`-Routen 401, aktiver Actor bei beiden `GET`-Routen 200,
  ungueltiger Actor bei Feedback-Request-`POST` 401, aktiver Actor mit
  temporaerer Feedback-Anfrage 201, ungueltiger Actor bei Feedback-`POST` 401,
  aktiver Actor mit temporaerem Feedback 201 und Feedback-`DELETE` mit
  ungueltigem Actor 401; temporaere Feedback-Anfrage und temporaeres Feedback
  wurden bereinigt und der Testserver beendet.
- Phase-1-Sales-Opportunities-API 2026-06-20: Als neununddreissigster
  kleiner Fix aus der Rechte-/Actor-ID-Roadmap wurden
  `src/app/api/sales-opportunities/route.ts` und
  `src/app/api/sales-opportunities/activities/route.ts` abgesichert. Einfach
  gesagt betrifft das Verkaufschancen und deren Aktivitaeten/Notizen. `GET`,
  `POST` und `PATCH` der Chancen sowie `POST` der Aktivitaeten verlangen jetzt
  einen aktiven Actor aus der Demo-Organisation; fehlender, ungueltiger oder
  inaktiver `actorId` fuehrt kontrolliert zu 401. Der bisherige Demo-User-
  Fallback wurde entfernt, damit History und Aktivitaeten immer den
  serverseitig geprueften Actor verwenden. Fehlerhaftes JSON wird defensiv wie
  fehlende Daten behandelt. Bestehende Sales-Hub-Tabellenabsicherung,
  Organisationsfilter, Owner-Zuordnung, Stage-/Wert-/Wahrscheinlichkeits-
  Normalisierung, Aktivitaetsrueckgabe je Chance, Created-/Updated-History und
  Aktualisierung des Opportunity-Zeitstempels durch Aktivitaeten blieben
  fachlich erhalten. Es gab keinen sichtbaren Dashboard-Aufrufer fuer diese
  Routen, daher war keine UI-Aenderung noetig. Sicherungen:
  `.codex-safety/sales_opportunities_route_20260620_phase1_before.ts`,
  `.codex-safety/sales_opportunities_activities_route_20260620_phase1_before.ts`
  und `.codex-safety/AGENTS_before_sales_opportunities_phase1_20260620.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/sales-opportunities/route.ts src/app/api/sales-opportunities/activities/route.ts`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender Actor bei `GET` 401, ungueltiger
  Actor bei `GET` 401, aktiver Actor bei `GET` 200, ungueltiger Actor bei
  `POST` 401, aktiver Actor mit temporaerer Chance 201, `PATCH` 200,
  Aktivitaet mit ungueltigem Actor 401 und Aktivitaet mit aktivem Actor 201;
  temporaere Chance und drei erzeugte Aktivitaeten wurden bereinigt und der
  Testserver beendet.
- Phase-1-Sales-Targets-API 2026-06-20: Als achtunddreissigster kleiner Fix
  aus der Rechte-/Actor-ID-Roadmap wurde `src/app/api/sales-targets/route.ts`
  abgesichert. Einfach gesagt betrifft das Vertriebs-/Kennzahlenziele,
  Zielanlage, Zielbearbeitung, Zielstatus und Status-Historie. `GET`, `POST`
  und `PATCH` verlangen jetzt einen aktiven Actor aus der Demo-Organisation;
  fehlender, ungueltiger oder inaktiver `actorId` fuehrt kontrolliert zu 401.
  History und Status-Timeline verwenden jetzt den serverseitig geprueften Actor
  statt Demo-User-Fallback. Fehlerhaftes JSON wird defensiv wie fehlende Daten
  behandelt. Bestehende Sales-Hub-Tabellenabsicherung, Organisationsfilter,
  Owner-Zuordnung, Pflichtfeld Titel, Status-/Prioritaetsnormalisierung,
  Zielwertnormalisierung, Periodenfelder, Follow-up-Datum, Timeline-Seeding und
  Statuswechsel-Protokollierung blieben fachlich erhalten. In
  `src/components/dashboard/dashboard-page.tsx` sendet die Oberflaeche beim
  Laden und Speichern von Zielen nun `activeUserId` als `actorId` mit; ohne
  aktiven Benutzer wird lokal gestoppt. Sicherungen:
  `.codex-safety/sales_targets_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_sales_targets_phase1_20260620.tsx` und
  `.codex-safety/AGENTS_before_sales_targets_phase1_20260620.md`. Checks
  bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/sales-targets/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender Actor bei `GET` 401, ungueltiger
  Actor bei `GET` 401, aktiver Actor bei `GET` 200, ungueltiger Actor bei
  `POST` 401, aktiver Actor mit temporaerem Ziel 201 und anschliessendes
  `PATCH done` 200; temporaeres Ziel und zwei Status-Timeline-Eintraege wurden
  bereinigt und der Testserver beendet.
- Phase-1-Potentials-API 2026-06-20: Als siebenunddreissigster kleiner Fix
  aus der Rechte-/Actor-ID-Roadmap wurde `src/app/api/potentials/route.ts`
  abgesichert. Einfach gesagt betrifft das Zusatzverkaufspotenziale aus
  Endkontrollen, manuell angelegte Zusatzverkaeufe, Nachfass-Status,
  Angebot-/Verloren-Status und Status-Historie. `GET`, `POST` und `PATCH`
  verlangen jetzt einen aktiven Actor aus der Demo-Organisation; fehlender,
  ungueltiger oder inaktiver `actorId` fuehrt kontrolliert zu 401. Historie
  und Status-Timeline verwenden jetzt den serverseitig geprueften Actor statt
  frei aus der Oberflaeche gelieferter Namen bzw. Demo-User-Fallback. Fehlerhaftes
  JSON wird defensiv wie fehlende Daten behandelt. Bestehende Tabellenanlage,
  Organisationsfilter, Migration alter Logbuch-Potenziale, Nummernvergabe
  `VC-####`, Ausschluss von "kein/nein"-Beschreibungen, Pflichtfelder,
  Status-/Prioritaetsnormalisierung, Wertnormalisierung, Follow-up-/Offered-/
  Lost-Zeitpunkte und Timeline-Seeding blieben fachlich erhalten. In
  `src/components/dashboard/dashboard-page.tsx` sendet die Oberflaeche beim
  Laden, automatischen Anlegen aus Endkontrollen, manuellen Anlegen und
  Aktualisieren von Zusatzverkaeufen nun `activeUserId` als `actorId` mit;
  ohne aktiven Benutzer wird lokal gestoppt. Sicherungen:
  `.codex-safety/potentials_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_potentials_phase1_20260620.tsx` und
  `.codex-safety/AGENTS_before_potentials_phase1_20260620.md`. Checks
  bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/potentials/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender Actor bei `GET` 401, ungueltiger
  Actor bei `GET` 401, aktiver Actor bei `GET` 200, ungueltiger Actor bei
  `POST` 401, aktiver Actor mit temporaerem Zusatzverkauf 201 und
  anschliessendes `PATCH follow_up` 200; temporaerer Zusatzverkauf und zwei
  Status-Timeline-Eintraege wurden bereinigt und der Testserver beendet.
- Phase-1-Final-Inspections-API 2026-06-20: Als sechsunddreissigster kleiner
  Fix aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/final-inspections/route.ts` abgesichert. Einfach gesagt
  betrifft das Endkontroll-Dokumente, die als Projektlogbuch-Eintrag abgelegt
  werden, sowie optionale Zusatzverkauf-Benachrichtigungen. `POST` verlangt
  jetzt einen aktiven Actor aus der Demo-Organisation; fehlender, ungueltiger
  oder inaktiver `actorId` fuehrt kontrolliert zu 401. Der Autor und
  `authorUserId` des erzeugten Projektlogbuch-Eintrags werden jetzt
  serverseitig aus dem geprueften Actor gesetzt statt aus frei uebergebenem
  Mitarbeitertext. Fehlerhaftes JSON wird defensiv wie fehlende Daten
  behandelt. Die lokale Tabellenabsicherung fuer `ProjectLogbookEntry` wurde
  um `authorUserId`, `projectMonth` und `updatedAt` ergaenzt, damit frische
  Datenbanken zur bestehenden Logbuchstruktur passen. Bestehende
  Projektpflichtpruefung, Checklisten-Textgenerierung, Kollegen-Status,
  Endkontroll-Anhang, Sichtbarkeitsliste und Upsell-Benachrichtigungen an
  `notifyUpsell`-Empfaenger blieben fachlich erhalten. In
  `src/components/dashboard/dashboard-page.tsx` sendet die Oberflaeche beim
  Speichern der Endkontrolle nun `activeUserId` als `actorId` mit; ohne
  aktiven Benutzer wird die Aktion lokal gestoppt. Sicherungen:
  `.codex-safety/final_inspections_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_final_inspections_phase1_20260620.tsx`
  und `.codex-safety/AGENTS_before_final_inspections_phase1_20260620.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/final-inspections/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender Actor bei `POST` 401, ungueltiger
  Actor bei `POST` 401 und aktiver Actor mit temporaerem Endkontroll-
  Logbucheintrag 201; temporaerer Logbucheintrag wurde bereinigt und der
  Testserver beendet.
- Phase-1-Customer-Project-Notes-API 2026-06-20: Als fuenfunddreissigster
  kleiner Fix aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/customer-project-notes/route.ts` abgesichert. Einfach gesagt
  betrifft das Kunden- und Projekthinweise inklusive Anzeige vor Stempelung,
  Anzeige bei Projektanlage, Archivieren und Bestaetigungen. `GET`, `POST` und
  `PATCH` verlangen jetzt einen aktiven Actor aus der Demo-Organisation;
  fehlender, ungueltiger oder inaktiver `actorId` fuehrt kontrolliert zu 401.
  Beim Anlegen und Bestaetigen werden `createdByUserId`/`createdByName` bzw.
  `userId`/`userName` jetzt aus dem serverseitig geprueften Actor gebildet,
  statt frei aus der Oberflaeche geliefert zu werden. Fehlerhaftes JSON wird
  defensiv wie fehlende Daten behandelt. Bestehende Tabellenanlage,
  Organisationsfilter, Kunden-/Projektfilter, Aktiv-/Archivlogik,
  Gueltigkeitszeitraeume, Prioritaeten, Bestätigungshaeufigkeiten
  `always`/`once_per_user`/`daily`, Kontextfilter fuer `stamp` und
  `projectCreate` sowie Acknowledgement-Protokollierung blieben fachlich
  erhalten. In `src/components/dashboard/dashboard-page.tsx` sendet die
  Oberflaeche beim Laden, Speichern, Archivieren und Bestaetigen von
  Kunden-/Projekthinweisen nun `activeUserId` als `actorId` mit; ohne aktiven
  Benutzer wird lokal gestoppt. Die Mitarbeiter-Emulation bleibt erhalten,
  weil `activeUserId` weiterhin der aktive bzw. emulierte Benutzer ist.
  Sicherungen:
  `.codex-safety/customer_project_notes_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_customer_project_notes_phase1_20260620.tsx`
  und `.codex-safety/AGENTS_before_customer_project_notes_phase1_20260620.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/customer-project-notes/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210 mit temporaerem Hinweis: fehlender Actor bei
  `GET` 401, ungueltiger Actor bei `GET` 401, aktiver Actor bei `GET` 200,
  ungueltiger Actor bei `POST` 401, aktiver Actor mit temporaerem Hinweis 201,
  `PATCH acknowledge` 200 und `PATCH archive` 200; temporaerer Hinweis und
  Bestaetigung wurden bereinigt und der Testserver beendet.
- Phase-1-Project-Marketing-Quotas-API 2026-06-20: Als vierunddreissigster
  kleiner Fix aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/project-marketing-quotas/route.ts` abgesichert. Einfach gesagt
  betrifft das monatliche Marketing-Kontingente in Marketing-Projekten,
  inklusive Anlegen/Bearbeiten von Marketingstuecken, Erledigt-Markierung,
  Zuruecksetzen und automatisch erzeugten Logbucheintraegen. `GET`, `POST` und
  `PATCH` verlangen jetzt einen aktiven Actor aus der Demo-Organisation;
  fehlender, ungueltiger oder inaktiver `actorId` fuehrt kontrolliert zu 401.
  Erledigt- und Zurueckgesetzt-Historie sowie die dazugehoerigen
  Projektlogbuch-Eintraege verwenden jetzt den serverseitig geprueften Actor
  statt frei aus der Oberflaeche gelieferter Namen. Fehlerhaftes JSON wird
  defensiv wie fehlende Daten behandelt. Bestehende Tabellenanlage,
  Organisationsfilter, Projektfilter, Marketing-Gewerk-Pruefung,
  Monatsvalidierung, Mengenlimit, Aktiv/Inaktiv-Status,
  `ON CONFLICT`-Update fuer Kontingent-Stammdaten, Monatskontingent-Grenze,
  Revert des letzten offenen Erledigt-Eintrags und Logbuch-Protokollierung
  blieben fachlich erhalten. In
  `src/components/dashboard/dashboard-page.tsx` sendet die Oberflaeche beim
  Laden, Speichern, Erledigen und Zuruecksetzen von Marketing-Kontingenten nun
  `activeUserId` als `actorId` mit; ohne aktiven Benutzer wird die Aktion lokal
  gestoppt. Sicherungen:
  `.codex-safety/project_marketing_quotas_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_project_marketing_quotas_phase1_20260620.tsx`
  und `.codex-safety/AGENTS_before_project_marketing_quotas_phase1_20260620.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/project-marketing-quotas/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210 mit temporaerem Marketing-Projekt: fehlender
  Actor bei `GET` 401, ungueltiger Actor bei `GET` 401, aktiver Actor bei
  `GET` 200, ungueltiger Actor bei `POST` 401, aktiver Actor mit temporaerem
  Marketingstueck 201, `PATCH complete` 200 und `PATCH revert-latest` 200;
  temporaeres Projekt, Marketingstueck, Completion und zwei erzeugte
  Logbucheintraege wurden bereinigt und der Testserver beendet.
- Phase-1-Project-Logbook-Entries-API 2026-06-20: Als dreiunddreissigster
  kleiner Fix aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/project-logbook-entries/route.ts` abgesichert. Einfach gesagt
  betrifft das Projekttagebuch-Eintraege, Projektbilder, Projektdokumente,
  Anhang-Loeschungen und Bildverschiebungen innerhalb der Projektakte. `GET`,
  `POST` und `PATCH` verlangen jetzt einen aktiven Actor aus der
  Demo-Organisation; fehlender, ungueltiger oder inaktiver `actorId` fuehrt
  kontrolliert zu 401. Neue Logbucheintraege und automatisch erzeugte
  Historieneintraege fuer geloeschte/verschobene Anhaenge verwenden jetzt den
  serverseitig geprueften Actor fuer `author`/`authorUserId` statt frei aus der
  Oberflaeche gelieferter Namen. Fehlerhaftes JSON wird defensiv wie fehlende
  Daten behandelt und verursacht keinen ungefangenen 500er. Bestehende
  Organisationsfilter, Projektfilter, `updatedAfter`-Synchronisation,
  Summary-Modus, Sichtbarkeitslisten, Anhang-Normalisierung, Monatsbezug fuer
  Dauerprojekte, Bild-Zielordner-Pruefung und Historieneintraege fuer
  geloeschte Taetigkeitsberichte/Projektanhaenge blieben fachlich erhalten. In
  `src/components/dashboard/dashboard-page.tsx` sendet die Oberflaeche beim
  Laden, Nachladen, Synchronisieren, manuellen Speichern, Bild-/Dokumentupload
  sowie beim Loeschen/Verschieben von Anhaengen nun `activeUserId` als
  `actorId` mit; ohne aktiven Benutzer wird die Aktion lokal gestoppt.
  Sicherungen:
  `.codex-safety/project_logbook_entries_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_project_logbook_entries_phase1_20260620.tsx`
  und `.codex-safety/AGENTS_before_project_logbook_entries_phase1_20260620.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/project-logbook-entries/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender Actor bei `GET` 401, ungueltiger
  Actor bei `GET` 401, aktiver Actor bei `GET` 200, ungueltiger Actor bei
  `POST` 401, aktiver Actor mit temporaerem Logbucheintrag 201 und
  anschliessendes `PATCH` zum Loeschen eines temporaeren Anhangs 200;
  temporaerer Logbucheintrag und zugehoeriger Historieneintrag wurden geloescht
  und der Testserver beendet.
- Phase-1-Hero-Import-Projects-API 2026-06-20: Als zweiunddreissigster
  kleiner Fix aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/hero/import-projects/route.ts` abgesichert. Einfach gesagt
  betrifft das den Import alter Hero-Projekte in die lokale
  WorkPilot-Projektliste. `POST` verlangt jetzt einen aktiven Actor aus der
  Demo-Organisation; fehlender, ungueltiger oder inaktiver `actorId` fuehrt
  kontrolliert zu 401, bevor Projektimport, Tabellenanlage oder externe
  Hero-Projektabfrage starten. Bestehende Importlogik, Organisationsbindung,
  Projektstatus-Normalisierung, `ON CONFLICT DO NOTHING` gegen doppelte
  Projekt-IDs und die Rueckgabe von `imported`, `skipped` und `total` blieben
  fachlich unveraendert. Es gab keinen sichtbaren Dashboard-Aufrufer fuer diese
  Route, daher war keine UI-Aenderung noetig. Sicherungen:
  `.codex-safety/hero_import_projects_route_20260620_phase1_before.ts` und
  `.codex-safety/AGENTS_before_hero_import_projects_phase1_20260620.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/hero/import-projects/route.ts`. `prisma db
  push` wurde bewusst nicht ausgefuehrt, weil keine Schemaaenderung Teil
  dieses Fixes war. Gezielter HTTP-Test ueber separaten lokalen Server auf
  Port 3210: fehlender Actor 401 und ungueltiger Actor 401; ein echter Import
  mit aktivem Actor wurde bewusst nicht gestartet, damit keine Projektdaten
  angelegt oder veraendert werden. Testserver wurde beendet.
- Phase-1-Hero-Projects-API 2026-06-20: Als einunddreissigster kleiner Fix
  aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/hero/projects/route.ts` abgesichert. Einfach gesagt betrifft
  das lokale WorkPilot-Projekte inklusive Projektstatus, Laufzeit,
  Kontaktverknuepfung, Budgetfeldern, Auto-Fakturierung und Winterdienst-
  Paketfeldern. `GET`, `POST` und `PATCH` verlangen jetzt einen aktiven Actor
  aus der Demo-Organisation; fehlender, ungueltiger oder inaktiver `actorId`
  fuehrt kontrolliert zu 401. Die Status-Historie bei Projektstatuswechseln
  nutzt jetzt den serverseitig geprueften Actor statt des Demo-Users. Bestehende
  Organisationsfilter, Projektformatierung, Upsert per Projekt-ID,
  Pflichtfelder Projektnummer/Projektname, Statusnormalisierung,
  Budget-History/Budget-Allokationen und das Seed-Verhalten fuer neue
  Status-Timelines blieben fachlich erhalten. In
  `src/components/dashboard/dashboard-page.tsx` sendet die Oberflaeche beim
  Laden und Speichern von Projekten nun `activeUserId` mit; nach gesetztem
  aktivem Benutzer werden Projekte erneut geladen. Sicherungen:
  `.codex-safety/hero_projects_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_hero_projects_phase1_20260620.tsx` und
  `.codex-safety/AGENTS_before_hero_projects_phase1_20260620.md`. Checks
  bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/hero/projects/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender Actor 401, ungueltiger Actor 401,
  aktiver Actor bei `GET` 200, ungueltiger Actor bei `POST` 401, aktiver Actor
  ohne Titel 400, aktiver Actor mit temporaerem Projekt 201 und anschliessendes
  `PATCH` 201; temporaeres Projekt und zugehoerige Status-Historie wurden
  bereinigt und der Testserver beendet.
- Phase-1-Contacts-API 2026-06-20: Als dreissigster kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurde `src/app/api/contacts/route.ts` abgesichert.
  Einfach gesagt betrifft das Kunden, Firmen, Ansprechpartner, Privatkunden,
  Lieferanten und Zahlungs-/Adressdaten. `GET`, `POST`, `PATCH` und `DELETE`
  verlangen jetzt einen aktiven Actor aus der Demo-Organisation; fehlender,
  ungueltiger oder inaktiver `actorId` fuehrt kontrolliert zu 401, bevor
  Kontakte gelesen, angelegt, bearbeitet oder geloescht werden. Es wurden
  bewusst keine neuen Rollenregeln eingefuehrt, damit bestehende CRM-Workflows
  nicht eingeschraenkt werden. Bestehende Organisationsfilter,
  Kontaktformatierung, Kundennummernlogik, E-Rechnungsfelder,
  Ansprechpartner/Firmen-Zuordnung, Zahlungsbedingungen und echtes Loeschen
  blieben fachlich erhalten. In
  `src/components/dashboard/dashboard-page.tsx` sendet die Oberflaeche beim
  Laden, Speichern, Loeschen und bei der Sammelaktion Archivieren nun
  `activeUserId` mit; nach gesetztem aktivem Benutzer werden Kontakte erneut
  geladen. Sicherungen:
  `.codex-safety/contacts_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_contacts_phase1_20260620.tsx` und
  `.codex-safety/AGENTS_before_contacts_phase1_20260620.md`. Checks
  bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/contacts/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender Actor 401, ungueltiger Actor 401,
  aktiver Actor bei `GET` 200, ungueltiger Actor bei `POST` 401, aktiver Actor
  mit temporaerem Kontakt 200, anschliessendes `PATCH` 200 und `DELETE` 200;
  temporaerer Kontakt wurde bereinigt und der Testserver beendet.
- Phase-1-Business-Area-Targets-API 2026-06-20: Als neunundzwanzigster
  kleiner Fix aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/business-area-targets/route.ts` abgesichert. Einfach gesagt
  betrifft das monatliche Sollwerte je Geschaeftsbereich. `GET` und `PUT`
  verlangen jetzt einen aktiven Actor aus der Demo-Organisation; fehlender,
  ungueltiger oder inaktiver `actorId` fuehrt kontrolliert zu 401. Der
  bisherige Fallback auf den Demo-Admin bei fehlendem/falschem Actor in `PUT`
  wurde entfernt, damit niemand versehentlich Admin-/Geschaeftsfuehrungsrechte
  erhaelt. Die bestehende Rollenregel blieb erhalten: nur Admins und
  Geschaeftsfuehrung duerfen Sollwerte speichern; normale Mitarbeitende
  erhalten 403. Bestehende Default-Geschaeftsbereiche, Monatsvalidierung,
  Jahresziel-Migration auf wiederkehrende Monate, Organisationsfilter,
  Betragsnormalisierung und Upsert je Geschaeftsbereich/Monat blieben fachlich
  erhalten. In `src/components/dashboard/dashboard-page.tsx` sendet die
  Oberflaeche beim Laden der Sollwerte nun `activeUserId` mit; nach gesetztem
  aktivem Benutzer werden Sollwerte erneut geladen. Sicherungen:
  `.codex-safety/business_area_targets_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_business_area_targets_phase1_20260620.tsx`
  und `.codex-safety/AGENTS_before_business_area_targets_phase1_20260620.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/business-area-targets/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender Actor 401, ungueltiger Actor 401,
  aktiver Actor bei `GET` 200, aktiver Mitarbeiter bei `PUT` 403, ungueltiger
  Actor bei `PUT` 401 und aktiver Admin/GF bei `PUT` 200 mit unveraendertem
  Zielwert; Testserver wurde beendet.
- Phase-1-Trades-API 2026-06-20: Als achtundzwanzigster kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurde `src/app/api/trades/route.ts` abgesichert.
  Einfach gesagt betrifft das Gewerke, Projektkuerzel und die Zuordnung zu
  Geschaeftsbereichen. `GET`, `POST`, `PATCH` und `DELETE` verlangen jetzt
  einen aktiven Actor aus der Demo-Organisation; fehlender, ungueltiger oder
  inaktiver `actorId` fuehrt kontrolliert zu 401. Der bisherige Fallback auf
  den Demo-Admin bei fehlendem/falschem Actor wurde entfernt, damit niemand
  versehentlich Admin-/Geschaeftsfuehrungsrechte erhaelt. Die bestehende
  Rollenregel blieb erhalten: nur Admins und Geschaeftsfuehrung duerfen
  Gewerke anlegen, bearbeiten oder loeschen; normale Mitarbeitende erhalten
  403. Bestehende Default-Gewerke, Default-Geschaeftsbereiche,
  Projektkuerzel-Normalisierung, Organisationsfilter, Dublettenpruefung,
  Geschaeftsbereichsvalidierung und das Entfernen der Gewerkzuordnung aus
  Aufgaben vor dem Loeschen blieben fachlich erhalten. In
  `src/components/dashboard/dashboard-page.tsx` sendet die Oberflaeche beim
  Laden der Gewerke und Geschaeftsbereiche nun `activeUserId` mit; nach
  gesetztem aktivem Benutzer werden Gewerke erneut geladen. Sicherungen:
  `.codex-safety/trades_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_trades_phase1_20260620.tsx` und
  `.codex-safety/AGENTS_before_trades_phase1_20260620.md`. Checks bestanden:
  `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/trades/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender Actor 401, ungueltiger Actor 401,
  aktiver Actor bei `GET` 200, Geschaeftsbereiche bei aktivem Actor 200,
  aktiver Mitarbeiter bei `POST` 403, ungueltiger Actor bei `POST` 401,
  aktiver Admin/GF mit leerem Namen 400, aktiver Admin/GF mit temporaerem
  Gewerk 201 und anschliessendes `DELETE` 200; temporaeres Gewerk wurde
  geloescht und der Testserver beendet.
- Phase-1-Units-API 2026-06-20: Als siebenundzwanzigster kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurde `src/app/api/units/route.ts` abgesichert.
  Einfach gesagt betrifft das die Einheiten-Stammdaten wie Std, Stk, Pauschal,
  Meter oder Liter. `GET`, `POST`, `PATCH` und `DELETE` verlangen jetzt einen
  aktiven Actor aus der Demo-Organisation; fehlender, ungueltiger oder
  inaktiver `actorId` fuehrt kontrolliert zu 401. Der bisherige Fallback auf
  den Demo-Admin bei fehlendem/falschem Actor wurde entfernt, damit niemand
  versehentlich Admin-/Geschaeftsfuehrungsrechte erhaelt. Die bestehende
  Rollenregel blieb erhalten: nur Admins und Geschaeftsfuehrung duerfen
  Einheiten anlegen, bearbeiten oder deaktivieren; normale Mitarbeitende
  erhalten 403. Bestehende Standard-Einheiten, Alias-Normalisierung,
  Organisationsfilter, Reaktivierung per `ON CONFLICT` und Soft-Delete ueber
  `isActive = false` blieben fachlich erhalten. In
  `src/components/dashboard/dashboard-page.tsx` sendet die Oberflaeche beim
  Laden der Einheiten nun `activeUserId` mit; nach gesetztem aktivem Benutzer
  werden Einheiten erneut geladen. Sicherungen:
  `.codex-safety/units_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_units_phase1_20260620.tsx` und
  `.codex-safety/AGENTS_before_units_phase1_20260620.md`. Checks bestanden:
  `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/units/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender Actor 401, ungueltiger Actor 401,
  aktiver Actor bei `GET` 200, aktiver Mitarbeiter bei `POST` 403,
  ungueltiger Actor bei `POST` 401, aktiver Admin/GF mit leerem Namen 400,
  aktiver Admin/GF mit temporaerer Einheit 201 und anschliessendes `DELETE`
  200; temporaere Einheit wurde deaktiviert und der Testserver beendet.
- Phase-1-Catalog-Items-API 2026-06-20: Als sechsundzwanzigster kleiner Fix
  aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/catalog-items/route.ts` abgesichert. Einfach gesagt betrifft
  das Artikel, Leistungen und Pakete im Katalog inklusive Katalog-Historie.
  `GET`, `POST`, `PATCH` und `DELETE` verlangen jetzt einen aktiven Actor aus
  der Demo-Organisation; fehlender, ungueltiger oder inaktiver `actorId`
  fuehrt kontrolliert zu 401, bevor Katalogdaten gelesen oder veraendert
  werden. Die Historie nutzt beim Anlegen, Bearbeiten, Paketbestandteil-Update
  und Deaktivieren jetzt den serverseitig geprueften Benutzer statt frei aus
  dem Browser gelieferter Namen. Doppelte Katalognummern werden gezielt als
  409 behandelt; unerwartete Datenbankfehler werden nicht mehr faelschlich als
  Nummernkonflikt ausgegeben. Beim Anlegen wird `updatedAt` explizit gesetzt,
  wodurch ein vorhandener 500er bei aelteren Tabellenstaenden behoben wurde.
  Bestehende Organisationsfilter, Katalognummernlogik, Paketbestandteile,
  Aktiv/Inaktiv-Soft-Delete, Preis-/Planungsfelder und History-Felder blieben
  fachlich erhalten. In `src/components/dashboard/dashboard-page.tsx` sendet
  die Oberflaeche beim Laden, Speichern und Deaktivieren der Katalogpositionen
  nun `activeUserId` als `actorId` mit; nach gesetztem aktivem Benutzer werden
  Katalogdaten erneut geladen. Sicherungen:
  `.codex-safety/catalog_items_route_20260620_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_catalog_items_phase1_20260620.tsx` und
  `.codex-safety/AGENTS_before_catalog_items_phase1_20260620.md`. Checks
  bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/catalog-items/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender Actor 401, ungueltiger Actor 401,
  aktiver Actor bei `GET` 200, ungueltiger Actor bei `POST` 401, aktiver Actor
  mit leerem Namen 400, aktiver Actor mit temporaerem Katalogartikel 201 und
  anschliessendes `DELETE` 200; temporaerer Artikel wurde deaktiviert und der
  Testserver beendet. Der Test deckte zunaechst einen alten 500er beim Anlegen
  wegen fehlendem `updatedAt` auf; dieser wurde in diesem Schritt behoben und
  anschliessend erfolgreich erneut getestet.
- Phase-1-Document-Types-API 2026-06-19: Als fuenfundzwanzigster kleiner
  Fix aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/document-types/route.ts` abgesichert. Einfach gesagt betrifft
  das Dokumentarten und deren Layout-/Konfigurationsvorlagen. `GET`, `POST`,
  `PATCH` und `DELETE` verlangen jetzt einen aktiven Actor aus der
  Demo-Organisation; fehlender, ungueltiger oder inaktiver `actorId` fuehrt
  kontrolliert zu 401, bevor Dokumenttypen gelesen, gespeichert oder
  archiviert werden. Doppelte Namen werden auch beim Bearbeiten kontrolliert
  als 409 behandelt, und Archivieren ohne Dokumenttyp-ID liefert 400 statt
  stiller No-Op. Die bestehende Standard-Angebotsvorlage, Organisationsbindung,
  Sortierung nach Name, Archivierung per Status/`archivedAt` und
  Layout-Konfiguration blieben fachlich unveraendert. In
  `src/components/dashboard/dashboard-page.tsx` sendet die Oberflaeche beim
  Laden, Speichern und Archivieren der Dokumenttypen nun `activeUserId` mit;
  nach gesetztem aktivem Benutzer werden Dokumenttypen erneut geladen.
  Sicherungen:
  `.codex-safety/document_types_route_20260619_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_document_types_phase1_20260619.tsx` und
  `.codex-safety/AGENTS_before_document_types_phase1_20260619.md`. Checks
  bestanden: `npm.cmd run build` im zweiten Lauf, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/document-types/route.ts src/components/dashboard/dashboard-page.tsx`.
  Der erste Build-Lauf scheiterte beim Page-Data-Sammeln mit einem
  transienten Next-Fehler zu `/api/activity-reports`; der direkte zweite Lauf
  war vollstaendig gruen, daher kein Codefehler aus diesem Schritt. `prisma db
  push` wurde bewusst nicht ausgefuehrt, weil keine Schemaaenderung Teil
  dieses Fixes war. Gezielter HTTP-Test ueber separaten lokalen Server auf
  Port 3210: fehlender Actor 401, ungueltiger Actor 401, aktiver Actor bei
  `GET` 200, ungueltiger Actor bei `POST` 401, aktiver Actor mit leerem Namen
  400, aktiver Actor mit temporaerem Dokumenttyp 200 und anschliessendes
  `DELETE` 200; temporaerer Dokumenttyp wurde archiviert und der Testserver
  beendet.
- Phase-1-Document-Texts-API 2026-06-19: Als vierundzwanzigster kleiner Fix
  aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/document-texts/route.ts` abgesichert. Einfach gesagt betrifft
  das die Textbausteine/Vorlagen fuer Dokumente. `GET`, `POST`, `PATCH` und
  `DELETE` verlangen jetzt einen aktiven Actor aus der Demo-Organisation;
  fehlender, ungueltiger oder inaktiver `actorId` fuehrt kontrolliert zu 401,
  bevor Vorlagen gelesen, gespeichert oder geloescht werden. Die bestehende
  Seed-Logik, Organisationsbindung, Sortierung nach Titel, Pflichtfelder
  Titel/Text und die Unique-Title-Pruefung blieben fachlich unveraendert. In
  `src/components/dashboard/dashboard-page.tsx` sendet die Oberflaeche beim
  Laden, Speichern und Loeschen der Dokumenttexte nun `activeUserId` mit; nach
  gesetztem aktivem Benutzer werden die Vorlagen erneut geladen, damit der
  erste sichere Aufruf nicht ins Leere laeuft. Sicherungen:
  `.codex-safety/document_texts_route_20260619_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_document_texts_phase1_20260619.tsx` und
  `.codex-safety/AGENTS_before_document_texts_phase1_20260619.md`. Checks
  bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/document-texts/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210: fehlender Actor 401, ungueltiger Actor 401,
  aktiver Actor bei `GET` 200, ungueltiger Actor bei `POST` 401, aktiver Actor
  mit leerem Inhalt 400, aktiver Actor mit temporaerem Text 200 und
  anschliessendes `DELETE` 200; temporaerer Text wurde bereinigt und der
  Testserver beendet.
- Phase-1-Document-Position-Search-API 2026-06-19: Als dreiundzwanzigster
  kleiner Fix aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/document-position-search/route.ts` abgesichert. Einfach gesagt
  betrifft das die Suche ueber Angebots- und Rechnungspositionen inklusive
  Dokumentnummer, Kunde, Projekt, Positionstext und Netto-Werten. Die
  lesende `GET`-Route verlangt jetzt einen aktiven Actor aus der
  Demo-Organisation per `actorId`; fehlender, ungueltiger oder inaktiver
  Actor fuehrt zu 401, bevor Dokumentpositionen ausgegeben werden. Es gab
  keine sichtbaren Dashboard-Aufrufer fuer diese Route, daher war keine
  UI-Aenderung noetig. Der bestehende Organisationsfilter blieb erhalten.
  Zusaetzlich werden geloeschte Angebote/Rechnungen jetzt sowohl mit aktueller
  als auch mit alter Status-Schreibweise ausgeschlossen. Bestehende
  Suchlogik, Mindestlaenge 3, Ergebnislimit 50, PDF-Links und Sortierung nach
  Erstellzeit blieben erhalten. Sicherungen:
  `.codex-safety/document_position_search_route_20260619_phase1_before.ts`
  und `.codex-safety/AGENTS_before_document_position_search_phase1_20260619.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/document-position-search/route.ts`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210 mit temporaerem inaktivem Testnutzer: fehlender
  Actor 401, inaktiver Actor 401, aktiver Actor mit zu kurzer Suche 200/leer,
  aktiver Actor mit normaler Suche 200; Testnutzer wurde bereinigt und der
  Testserver beendet.
- Phase-1-Invoices-API 2026-06-19: Als zweiundzwanzigster kleiner Fix aus
  der Rechte-/Actor-ID-Roadmap wurde `src/app/api/invoices/route.ts`
  abgesichert. Einfach gesagt betrifft das Rechnungen, Rechnungsentwuerfe,
  Fakturierung, Bezahlt-Markierung, Mahnungen, Druck-Historie, Storno,
  Stapelabrechnung und Rechnungsloeschung. `POST`, `PATCH` und `DELETE`
  verlangen jetzt einen aktiven Actor aus der Demo-Organisation; fehlender,
  ungueltiger oder inaktiver `actorId` fuehrt zu 401 statt Protokollierung
  ueber Formularnamen oder `System`. Der Actor-Name fuer Invoice-History,
  Mahnungsdokumente und Storno-Historie wird serverseitig aus dem geprueften
  Benutzer gebildet. Die bestehende Sonderregel fuer `DELETE` blieb erhalten:
  nur aktive Geschaeftsfuehrung darf Rechnungen loeschen. Die PDF-Vorschau per
  `PUT`, PDF-/XRechnung-Abrufe per `GET`, Rechnungsberechnung,
  Stempelzeit-Verknuepfung, Unterfakturierungswarnung, Materialkosten-Snapshots
  und Stornoerzeugung blieben fachlich unveraendert. In
  `src/components/dashboard/dashboard-page.tsx` senden Bezahlt-Markierung,
  Mahnungserzeugung, Rechnung speichern/bearbeiten/fakturieren, Storno,
  Loeschung, Druck-Historie sowie Stapelentwurf und Stapelfaktura nun
  `actorId: activeUserId` mit. Sicherungen:
  `.codex-safety/invoices_route_20260619_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_invoices_phase1_20260619.tsx` und
  `.codex-safety/AGENTS_before_invoices_phase1_20260619.md`. Checks
  bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/invoices/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210 mit temporaerem inaktivem Testnutzer:
  ungueltiger Actor bei `POST` 401, inaktiver Actor bei `PATCH` 401, aktiver
  Actor bei `POST` ohne Projekt erreicht normale Fachvalidierung 400, aktiver
  Actor bei `PATCH` ohne Rechnungs-ID erreicht normale Fachvalidierung 400,
  aktiver Nicht-GF-Actor bei `DELETE` 403, aktive Geschaeftsfuehrung bei
  `DELETE` ohne Rechnungs-ID erreicht normale Fachvalidierung 400; Testnutzer
  wurde bereinigt und der Testserver beendet.
- Phase-1-Offers-API 2026-06-19: Als einundzwanzigster kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurde `src/app/api/offers/route.ts` abgesichert.
  Einfach gesagt betrifft das Angebote, Angebotsentwuerfe, Statuswechsel
  gewonnen/verloren/wieder aktiv und Angebotsloeschungen. `POST`, `PATCH` und
  `DELETE` verlangen jetzt einen aktiven Actor aus der Demo-Organisation;
  fehlender, ungueltiger oder inaktiver `actorId` fuehrt zu 401 statt
  Protokollierung ueber Formularnamen oder `System`. Der Actor-Name fuer
  Offer-History und `wonByName` wird serverseitig aus dem geprueften Benutzer
  gebildet. Die PDF-Vorschau per `PUT` blieb bewusst unveraendert, weil sie
  nichts speichert. In `src/components/dashboard/dashboard-page.tsx` senden
  Angebot erstellen/bearbeiten, loeschen, verloren markieren, gewonnen
  markieren, wieder aktivieren und die Planungs-Korrektur des
  Ausfuehrungsmonats nun `actorId: activeUserId` mit. Bestehende
  Angebotsvalidierung, PDF-Erzeugung, Positions-/Mitarbeiterzeilen,
  Organisationsfilter und History-Texte blieben erhalten. Sicherungen:
  `.codex-safety/offers_route_20260619_phase1_before.ts`,
  `.codex-safety/dashboard_page_before_offers_phase1_20260619.tsx` und
  `.codex-safety/AGENTS_before_offers_phase1_20260619.md`. Checks bestanden:
  `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/offers/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210 mit temporaerem inaktivem Testnutzer:
  ungueltiger Actor bei `POST` 401, inaktiver Actor bei `POST` 401, aktiver
  Actor bei `POST` erreicht normale Projektvalidierung 400, aktiver Actor bei
  `PATCH`/`DELETE` ohne Angebots-ID erreicht normale Fachvalidierung 400;
  Testnutzer wurde bereinigt und der Testserver beendet.
- Phase-1-Document-Mail-API 2026-06-19: Als zwanzigster kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurde `src/app/api/document-mail/route.ts`
  abgesichert. Einfach gesagt betrifft das den Versand und die Protokollierung
  von Angeboten, Rechnungen, Stornos, Mahnungen, Taetigkeitsberichten und
  allgemeinen Dokumenten. Der schreibende `POST` nutzt jetzt einen lokalen
  `getRequestActor`-Helper und bricht bei fehlendem, ungueltigem oder
  inaktivem `actorId` mit 401 ab, statt auf den Demo-User aus
  `getDemoContext()` zurueckzufallen. Der gepruefte Actor bleibt Senderbasis
  fuer Microsoft-Account, Signatur, Versandprotokoll, Feedback-Link und
  Angebots-/Rechnungshistorie. Die sichtbaren Dashboard-Aufrufer und die
  Winterdienst-Automation senden bereits `actorId`; daher war keine UI-Aenderung
  noetig. Bestehende Fachlogik blieb erhalten: Empfaengerpruefung,
  Dokumenttypvalidierung, Microsoft-365-Verbindungspruefung, PDF-/Zusatzanhang-
  Logik, Feedback-Request-Link bei Rechnungen, Versand via Graph,
  `DocumentMailDispatch`-Eintraege, separate Activity-Report-Dispatches fuer
  Rechnungsanhaenge und Offer-/Invoice-History. Sicherungen:
  `.codex-safety/document_mail_route_20260619_225254.ts` und
  `.codex-safety/AGENTS_before_document_mail_phase1_20260619_225537.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/document-mail/route.ts`. `prisma db push`
  wurde bewusst nicht ausgefuehrt, weil keine Schemaaenderung Teil dieses
  Fixes war. Gezielter HTTP-Test ueber separaten lokalen Server auf Port 3210
  mit temporaeren Testnutzern ohne echten Mailversand: ungueltiger Actor bei
  `POST` 401, inaktiver Actor bei `POST` 401, aktiver Actor erreicht die
  normale Empfaenger-Validierung 400; Testnutzer wurden bereinigt und der
  Testserver beendet.
- Phase-1-Activity-Reports-API 2026-06-19: Als neunzehnter kleiner Fix aus
  der Rechte-/Actor-ID-Roadmap wurde `src/app/api/activity-reports/route.ts`
  abgesichert. Einfach gesagt betrifft das die Erzeugung von
  Taetigkeitsbericht-PDFs und deren Ablage im Projekt-Logbuch. Der
  schreibende `POST` verlangt jetzt einen aktiven Actor aus der Demo-
  Organisation; fehlender, ungueltiger oder inaktiver `actorId` fuehrt zu
  401. Es wurde bewusst keine neue Rollenbeschraenkung eingefuehrt, damit die
  bestehende Bedienlogik fuer normale Erstellung, Rechnungsvorbereitung und
  Winterdienst-Automation erhalten bleibt. Bei Erstellung und Aktualisierung
  wird der Logbuch-Autor jetzt aus dem geprueften Actor serverseitig gesetzt
  statt pauschal `System`. Die bestehenden PDF-, Bildauswahl-, Monats-,
  Kontext- und Upsert-Regeln blieben erhalten. In
  `src/components/dashboard/dashboard-page.tsx` senden beide
  Activity-Report-Aufrufe nun `actorId: activeUserId` mit. In
  `src/app/api/winter-service-automation/route.ts` wird der bereits ermittelte
  `actorId` an `/api/activity-reports` weitergereicht, damit die Automation
  nicht anonym laeuft. Sicherungen:
  `.codex-safety/activity_reports_route_20260619_224438.ts` und
  `.codex-safety/AGENTS_before_activity_reports_phase1_20260619_224935.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/activity-reports/route.ts src/components/dashboard/dashboard-page.tsx src/app/api/winter-service-automation/route.ts`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210 mit temporaeren Testnutzern: ungueltiger Actor
  bei `POST` 401, inaktiver Actor bei `POST` 401, aktiver Actor erreicht die
  normale Projektvalidierung 404; Testnutzer wurden bereinigt und der
  Testserver beendet. Ein direkter PDF-/Bild-Erzeugungstest wurde nicht
  erzwungen, weil die PDF-Logik selbst unveraendert blieb und Build/Typcheck
  die Integration prueften.
- Phase-1-Employee-Assessments-API 2026-06-19: Als achtzehnter kleiner Fix
  aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/employee-assessments/route.ts` abgesichert. Einfach gesagt
  betrifft das personenbezogene Mitarbeiterbewertungen inklusive
  Selbsteinschaetzung, Fuehrungskraftbewertung, Massnahmen, Gespraechsnotizen
  und DISG-Fragebogen. Die bestehende Emulations-/Managerlogik blieb erhalten:
  Mitarbeiter koennen eigene Bewertungen laden/speichern, Admin und
  Geschaeftsfuehrung koennen fremde Bewertungen laden und Managerbereiche
  bearbeiten/entsperren, normale Mitarbeiter koennen fremde Bewertungen nicht
  lesen oder schreiben. Neu ist die konsistente Actor-Pruefung: `GET` und
  `POST` laden den Actor jetzt inklusive `isActive`; fehlender, ungueltiger,
  organisationsfremder oder inaktiver Actor fuehrt zu 401 statt unscharfem
  404. Nicht gefundene Zielnutzer bleiben 404, fehlende Fachberechtigung
  bleibt 403. Bestehende Sanitizing-Regeln fuer Mitarbeitersicht,
  History-Reduktion, Self-Lock, DISG-Lock/Unlock/Reset/Complete und
  Fall-History blieben erhalten. Sicherungen:
  `.codex-safety/employee_assessments_route_20260619_223823.ts` und
  `.codex-safety/AGENTS_before_employee_assessments_phase1_20260619_224222.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/employee-assessments/route.ts`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210 mit temporaeren Testnutzern: ungueltiger Actor
  bei `GET`/`POST` 401, Mitarbeiter eigene Bewertung `GET` 200, Mitarbeiter
  fremde Bewertung `GET` 403, Admin fremde Bewertung `GET` 200, Mitarbeiter
  fremde Self-Speicherung 403, Mitarbeiter eigene Self-Speicherung 200, Admin
  Unlock 200; Testnutzer wurden bereinigt und der Testserver beendet.
- Phase-1-Employee-Costs-API 2026-06-19: Als siebzehnter kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurde `src/app/api/employee-costs/route.ts`
  abgesichert. Einfach gesagt betrifft das die sensiblen Lohn-/Kostenwerte
  pro Mitarbeiter. Die bestehende enge Fachberechtigung wurde bewusst nicht
  erweitert: Zugriff bleibt auf die namentlich freigegebenen Nutzer
  Ramona Eid und Christian Eid begrenzt. `GET` und `PUT` pruefen jetzt zuerst
  einen aktiven Actor in der Organisation; fehlender, ungueltiger oder
  inaktiver `actorId` fuehrt zu 401. Aktive, aber nicht namentlich
  freigegebene Nutzer erhalten 403. Fehlende Ziel-Mitarbeiter-ID bleibt 400,
  nicht gefundene Ziel-Mitarbeiter bleiben 404. `PUT` nutzt denselben
  geprueften Actor fuer `updatedByUserId` und `updatedByName`; die bestehende
  Upsert-/Default-/Zahlenlogik fuer Monatsgehalt, Vollkostenfaktor,
  Jahresstunden, Urlaub, Schulung, Krankheit und Tagesstunden blieb erhalten.
  Sicherungen: `.codex-safety/employee_costs_route_20260619_161044.ts` und
  `.codex-safety/AGENTS_before_employee_costs_phase1_20260619_161312.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/employee-costs/route.ts`. `prisma db push`
  wurde bewusst nicht ausgefuehrt, weil keine Schemaaenderung Teil dieses
  Fixes war. Gezielter HTTP-Test ueber separaten lokalen Server auf Port 3210
  mit temporaeren Testnutzern/Testkosten: ungueltiger Actor bei `GET`/`PUT`
  401, aktiver aber nicht berechtigter Actor bei `GET`/`PUT` 403,
  erlaubter Actor `GET` 200 und `PUT` 200, `updatedByUserId` wurde korrekt
  gespeichert; Testkosten/Testnutzer wurden bereinigt und der Testserver
  beendet.
- Phase-1-Unbilled-Time-Alerts-API 2026-06-19: Als sechzehnter kleiner Fix
  aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/unbilled-time-alerts/route.ts` abgesichert. Einfach gesagt
  betrifft das die Warnungen/Eskalationen fuer offene, noch nicht abgerechnete
  Projektzeiten. `GET` blieb bewusst unveraendert lesbar, damit die Auswertung
  weiter ohne UI-Umbau laden kann. Der schreibende `POST`, der Notifications
  und `UnbilledTimeAlert`-Eintraege erzeugt, nutzt jetzt einen lokalen
  `getRequestActor`-Helper und bricht bei fehlendem, ungueltigem oder
  inaktivem `actorId` mit 401 ab, statt anonym ueber den Demo-Kontext zu
  laufen. Ausloesen duerfen Admin, Geschaeftsfuehrung, Fuehrungskraft und
  Buchhaltung; normale Mitarbeiter erhalten 403. Buchhaltung wurde bewusst
  zugelassen, weil es sich um einen Abrechnungs-/Kontrolllauf fuer offene
  Zeiten handelt. Bestehende Fachlogik blieb erhalten: offene Projektzeiten
  werden nach Projekt/Monat gruppiert, Warn-/Eskalationsschwellen fuer
  Einmalprojekte und Dauerlaeufer werden berechnet, verantwortliche Nutzer und
  Management werden als Empfaenger ermittelt, doppelte offene Alerts werden
  verhindert und Notifications behalten ihren Projekt-Link. Sicherungen:
  `.codex-safety/unbilled_time_alerts_route_20260619_160632.ts` und
  `.codex-safety/AGENTS_before_unbilled_time_alerts_phase1_20260619_160842.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/unbilled-time-alerts/route.ts`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210 mit temporaeren Testnutzern: `GET` bleibt 200,
  ungueltiger Actor bei `POST` 401, Mitarbeiter-`POST` 403,
  Buchhaltung-`POST` 200; Testnutzer wurden bereinigt und der Testserver
  beendet.
- Phase-1-Escalation-Rules-API 2026-06-19: Als fuenfzehnter kleiner Fix aus
  der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/escalation-rules/route.ts` abgesichert. Einfach gesagt
  betrifft das die klassische Eskalationsstufen-Verwaltung fuer
  Aufgaben-/Fristenregeln. `GET` blieb bewusst unveraendert lesbar, damit die
  bestehende Einstellungsansicht weiter ohne UI-Umbau laden kann. `POST`,
  `PATCH` und `DELETE` nutzen jetzt einen lokalen `getRequestActor`-Helper
  und brechen bei fehlendem, ungueltigem oder inaktivem `actorId` mit 401 ab,
  statt auf den Demo-Admin aus `getDemoContext()` zurueckzufallen. Die
  bestehende Fachberechtigung wurde bewusst nicht erweitert: Verwalten
  duerfen weiterhin nur Admin und Geschaeftsfuehrung; normale Mitarbeiter
  erhalten 403. `PATCH` laedt die Zielregel jetzt vor dem Schreiben
  organisationsgebunden per `ruleId` plus `organizationId`; `DELETE` nutzt
  ebenfalls bereinigte `ruleId`-Pruefung. Bestehende Logik fuer
  E-Mail-Spalten, Rollenlabels, Stundenvalidierung, Aktiv-Flag und
  E-Mail-Empfaenger blieb erhalten. Sicherungen:
  `.codex-safety/escalation_rules_route_20260619_155820.ts` und
  `.codex-safety/AGENTS_before_escalation_rules_phase1_20260619_160315.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/escalation-rules/route.ts`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210 mit temporaeren Testnutzern/Testregel:
  `GET` bleibt 200, ungueltiger Actor bei `POST`/`DELETE` 401,
  Mitarbeiter-`POST`/`PATCH` 403, Admin-`POST` 201, Admin-`PATCH` 200,
  Admin-`DELETE` 200; Testregel/Testnutzer wurden bereinigt und der
  Testserver beendet.
- Phase-1-Status-Rules-API 2026-06-19: Als vierzehnter kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurde `src/app/api/status-rules/route.ts`
  abgesichert. Einfach gesagt betrifft das die Regeln, nach denen
  Status-Eskalationen und Benachrichtigungen ausgeloest werden. `GET` blieb
  bewusst unveraendert lesbar, damit bestehende Auswertungen weiterhin ohne
  UI-Umbau laden. `POST`, `PATCH` und `DELETE` nutzen jetzt einen lokalen
  `getRequestActor`-Helper und brechen bei fehlendem, ungueltigem oder
  inaktivem `actorId` mit 401 ab, statt auf den Demo-Admin aus
  `getDemoContext()` zurueckzufallen. Die bestehende Fachberechtigung wurde
  bewusst nicht erweitert: Status-Regeln duerfen weiterhin nur Admin und
  Geschaeftsfuehrung verwalten; normale Mitarbeiter erhalten 403.
  Bestehende Regel-Logik blieb erhalten: Default-/Tracking-Tabellen werden
  sichergestellt, Entity-Type/Status/Name/Schwellwert/Empfaengerflags werden
  wie vorher normalisiert, Regeln werden organisationsgebunden angelegt,
  aktualisiert und geloescht. Sicherungen:
  `.codex-safety/status_rules_route_20260619_155332.ts` und
  `.codex-safety/AGENTS_before_status_rules_phase1_20260619_155603.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/status-rules/route.ts`. `prisma db push`
  wurde bewusst nicht ausgefuehrt, weil keine Schemaaenderung Teil dieses
  Fixes war. Gezielter HTTP-Test ueber separaten lokalen Server auf Port 3210
  mit temporaeren Testnutzern/Testregel: `GET` bleibt 200, ungueltiger Actor
  bei `POST`/`DELETE` 401, Mitarbeiter-`POST`/`PATCH` 403, Admin-`POST` 201,
  Admin-`PATCH` 200, Admin-`DELETE` 200; Testregel/Testnutzer wurden
  bereinigt und der Testserver beendet.
- Phase-1-Status-Escalations-API 2026-06-19: Als dreizehnter kleiner Fix
  aus der Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/status-escalations/route.ts` abgesichert. Einfach gesagt
  betrifft das den Lauf, der Status-Toleranzen prueft und daraus
  Benachrichtigungen/Eskalationsereignisse erzeugt. `GET` blieb bewusst
  unveraendert lesbar, damit bestehende Auswertungen weiterhin ohne UI-Umbau
  laden. Der schreibende `POST` nutzt jetzt einen lokalen
  `getRequestActor`-Helper und bricht bei fehlendem, ungueltigem oder
  inaktivem `actorId` mit 401 ab, statt anonym ueber den Demo-Kontext zu
  laufen. Ausloesen duerfen nur Admin, Geschaeftsfuehrung und Fuehrungskraft;
  normale Mitarbeiter erhalten 403. Bestehende Fachlogik blieb erhalten:
  Default-Regeln werden sichergestellt, offene Status werden gegen aktive
  Regeln geprueft, Verantwortliche/Projektverantwortliche/Management werden
  als Empfaenger ermittelt, App-/Daily-Report-/E-Mail-Notifications und
  StatusEscalationEvent-Eintraege werden wie vorher erzeugt und doppelte
  offene Events verhindert. Sicherungen:
  `.codex-safety/status_escalations_route_20260619_154405.ts` und
  `.codex-safety/AGENTS_before_status_escalations_phase1_20260619_154614.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/status-escalations/route.ts`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210 mit temporaeren Testnutzern: `GET` bleibt 200,
  ungueltiger Actor bei `POST` 401, Mitarbeiter-`POST` 403,
  Fuehrungskraft-`POST` 200; Testnutzer wurden bereinigt und der Testserver
  beendet.
- Phase-1-Status-Timeline-API 2026-06-19: Als zwoelfter kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurde `src/app/api/status-timeline/route.ts`
  abgesichert. Einfach gesagt betrifft das die Status-Verlaufsanzeige und den
  Wartungs-/Neuaufbau-Endpunkt fuer Statusmessung. `GET` blieb bewusst
  unveraendert lesbar, damit die bestehende Auswertung im Dashboard weiter
  ohne neuen UI-Umbau geladen werden kann. Der schreibende `POST` nutzt jetzt
  einen lokalen `getRequestActor`-Helper und bricht bei fehlendem,
  ungueltigem oder inaktivem `actorId` mit 401 ab, statt anonym ueber den
  Demo-Kontext zu laufen. Den Neuaufbau duerfen nur Admin,
  Geschaeftsfuehrung und Fuehrungskraft ausloesen; normale Mitarbeiter
  erhalten 403. Die bestehende Seed-/Korrekturlogik fuer Projekte, Aufgaben,
  Potenziale und Sales-Ziele blieb erhalten. Sicherungen:
  `.codex-safety/status_timeline_route_20260619_153511.ts` und
  `.codex-safety/AGENTS_before_status_timeline_phase1_20260619_153836.md`.
  Checks bestanden: `npm.cmd run build` nach einmaliger Wiederholung wegen
  transientem Next-PageData/ENOENT-Cachefehler ohne TypeScript-Fehlerstelle,
  `npx.cmd prisma validate`, `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/status-timeline/route.ts`. `prisma db push`
  wurde bewusst nicht ausgefuehrt, weil keine Schemaaenderung Teil dieses
  Fixes war. Gezielter HTTP-Test ueber separaten lokalen Server auf Port 3210
  mit temporaeren Testnutzern: `GET` bleibt 200, ungueltiger Actor bei `POST`
  401, Mitarbeiter-`POST` 403, Fuehrungskraft-`POST` 200; Testnutzer wurden
  bereinigt und der Testserver beendet.
- Phase-1-Task-Time-Entries-API 2026-06-19: Als elfter kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/tasks/[taskId]/time-entries/route.ts` abgesichert. Einfach
  gesagt betrifft das Zeiteintraege direkt in der Aufgabenmaske. `POST`,
  `PATCH` und `DELETE` nutzen jetzt einen lokalen `getRequestActor`-Helper
  und brechen bei fehlendem, ungueltigem oder inaktivem `actorId` mit 401 ab,
  statt auf den Demo-User aus `getDemoContext()` zurueckzufallen.
  Zeiterfassung ist fuer Aufgaben-Owner, Ersteller, Beteiligte sowie Admin,
  Geschaeftsfuehrung und Fuehrungskraft erlaubt; fremde normale Nutzer
  erhalten 403. Bearbeiten/Loeschen eigener Eintraege bleibt fuer normale
  Nutzer moeglich, Admin/Geschaeftsfuehrung/Fuehrungskraft koennen
  verwalten. Beim Bearbeiten bleibt der vorhandene Startzeitpunkt erhalten,
  wenn kein neuer Startzeitpunkt uebergeben wird. Loesch-Benachrichtigungen
  verwenden jetzt den serverseitig geprueften Actor-Namen und gehen nur an
  aktive Admin-/Geschaeftsfuehrungsnutzer. In
  `src/components/dashboard/dashboard-page.tsx` sendet der Speichern-Klick
  fuer Aufgaben-Zeiteintraege jetzt `actorId: activeUserId` mit; die
  bestehende Loesch-UI hatte das bereits. Sicherungen:
  `.codex-safety/task_time_entries_route_20260619_152554.ts` und
  `.codex-safety/AGENTS_before_task_time_entries_phase1_20260619_153115.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/tasks/[taskId]/time-entries/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber separaten
  lokalen Server auf Port 3210 mit temporaeren Testnutzern/Testaufgabe:
  ungueltiger Actor bei POST 401, unbeteiligter Nutzer bei POST 403, Owner
  POST 200, unbeteiligter Nutzer bei PATCH/DELETE 403, Owner PATCH 200,
  Admin DELETE 200; Testdaten wurden bereinigt und der Testserver beendet.
- Phase-1-Tasks-Respond-API 2026-06-19: Als zehnter kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurde `src/app/api/tasks/respond/route.ts`
  abgesichert. Einfach gesagt betrifft das den Klick auf Aufgabe annehmen oder
  ablehnen. `POST` nutzt jetzt einen lokalen `getRequestActor`-Helper und
  bricht bei fehlendem, ungueltigem oder inaktivem `actorId` mit 401 ab,
  statt auf den Demo-User aus `getDemoContext()` zurueckzufallen. Die Aufgabe
  wird jetzt zusaetzlich organisationsgebunden per `taskId` plus
  `organizationId` geladen. Actor-Name fuer Task-History,
  Status-Timeline, Abwesenheits-History und Notifications wird serverseitig
  aus dem geprueften Actor abgeleitet. Bestehende Fachlogik blieb erhalten:
  Owner kann Aufgabe annehmen/ablehnen, Beteiligte koennen ihre Beteiligung
  annehmen/ablehnen, unbeteiligte Nutzer erhalten 403, Ablehnung braucht Grund,
  Vertreter-Sonderfall fuer Abwesenheitsuebergaben kann weiterhin Owner
  uebernehmen, Abwesenheitsstatus/History und Notifications laufen weiter.
  Sicherungen: `.codex-safety/tasks_respond_route_20260619_115223.ts` und
  `.codex-safety/AGENTS_before_tasks_respond_phase1_20260619_115509.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/tasks/respond/route.ts`. `prisma db push`
  wurde bewusst nicht ausgefuehrt, weil keine Schemaaenderung Teil dieses
  Fixes war. Gezielter HTTP-Test ueber lokalen Server mit temporaeren
  Testnutzern/Testaufgaben: ungueltiger Actor 401, unbeteiligter Nutzer 403,
  Ablehnung ohne Grund 400, Owner-Annahme 200, Beteiligten-Ablehnung 200;
  Testdaten wurden bereinigt.
- Phase-1-Task-Comments-API 2026-06-19: Als neunter kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurde
  `src/app/api/tasks/[taskId]/comments/route.ts` abgesichert. `POST` nutzt
  jetzt einen lokalen `getRequestActor`-Helper und bricht bei fehlendem,
  ungueltigem oder inaktivem `actorId` mit 401 ab, statt auf den Demo-User aus
  `getDemoContext()` zurueckzufallen. Kommentieren duerfen nur noch
  Aufgaben-Owner, Task-Ersteller oder Aufgabenbeteiligte; andere aktive Nutzer
  erhalten 403. Die bestehende Empfaengerpruefung bleibt erhalten:
  `recipientUserId` muss zu einem Aufgabenbeteiligten gehoeren. Author-ID,
  Notification-Text, History-Actor und Rueckgabe-Autor werden aus dem
  geprueften Actor serverseitig abgeleitet. Tabellen-/Spaltensicherung fuer
  `Task.history` und `TaskComment.recipientUserId`, Kommentarerzeugung,
  Notifications an Owner/Beteiligte ohne Autor und lokale History-Ergaenzung
  blieben erhalten. Sicherungen:
  `.codex-safety/task_comments_route_20260619_114555.ts` und
  `.codex-safety/AGENTS_before_task_comments_phase1_20260619_114935.md`.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/tasks/[taskId]/comments/route.ts`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber lokalen
  Server mit temporaeren Testnutzern/Testaufgabe: ungueltiger Actor 401,
  unbeteiligter Nutzer 403, ungueltiger Empfaenger 400, Owner-Kommentar 201,
  Beteiligten-Kommentar mit Empfaenger 201, zwei Kommentare gespeichert,
  Notifications nur an Owner/Beteiligte; Testdaten wurden bereinigt.
- Phase-1-Tasks-API 2026-06-19: Als achter kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurde `src/app/api/tasks/route.ts` abgesichert.
  `POST`, `PATCH` und `DELETE` nutzen jetzt einen lokalen
  `getRequestActor`-Helper und brechen bei fehlendem, ungueltigem oder
  inaktivem `actorId` mit 401 ab, statt auf den Demo-User aus
  `getDemoContext()` zurueckzufallen. Restore, Teilnehmer-Hinzufuegen,
  normale Bearbeitung und Loeschen laden Aufgaben jetzt organisationsgebunden
  per `id` plus `organizationId`, bevor geschrieben wird. Bestehende
  Fachregeln blieben erhalten: Mitarbeiter duerfen beim Anlegen nicht
  wirksam fremd zuweisen, Fremdzuweisung beim Bearbeiten bleibt auf Admin,
  Geschaeftsfuehrung und Fuehrungskraft begrenzt, Loeschen/Archivieren bleibt
  auf Admin/Geschaeftsfuehrung begrenzt. History- und Status-Timeline-Actor
  werden aus dem geprueften Actor serverseitig benannt. `GET`, Formatierung,
  Kommentare/Zeiteintraege im Task, Teilnehmerlogik, Akzeptanzstatus,
  Planning-Allocations, Auto-Feedback, Recurrence, Status-Tracking,
  Benachrichtigungen und Auto-Archivierung blieben erhalten. Sicherungen:
  `.codex-safety/tasks_route_20260619_113346.ts` und
  `.codex-safety/AGENTS_before_tasks_phase1_20260619_113917.md`.
  Checks bestanden: `npm.cmd run build` nach einmaliger Wiederholung wegen
  transientem Next/Jest-Worker-Fehler ohne TypeScript-Fehlerstelle,
  `npx.cmd prisma validate`, `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/tasks/route.ts`. `prisma db push` wurde
  bewusst nicht ausgefuehrt, weil keine Schemaaenderung Teil dieses Fixes war.
  Gezielter HTTP-Test ueber lokalen Server mit temporaeren Testnutzern:
  ungueltiger Actor bei POST/PATCH/DELETE 401, eigener Mitarbeiter-Task 200,
  Mitarbeiter-Fremdzuweisung bei POST blieb Self-Fallback, Fuehrungskraft
  konnte fremd zuweisen, Mitarbeiter-Fremdzuweisung bei PATCH 403,
  Fuehrungskraft-PATCH 200, Mitarbeiter-DELETE 403,
  Geschaeftsfuehrung-DELETE 200; Testnutzer, Testaufgaben,
  Teilnehmer/Notifications/Status-Timeline wurden bereinigt.
- Phase-1-Project-Time-Entries-API 2026-06-19: Als siebter kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurde `src/app/api/project-time-entries/route.ts`
  abgesichert. `POST` und `DELETE` trennen jetzt serverseitig zwischen Actor
  und Zielnutzer: `actorUserId` muss zu einem aktiven Organisationsnutzer
  gehoeren, der Zielnutzer fuer den Zeiteintrag muss ebenfalls aktiv sein.
  `employee`, `overtimeApprovedByUserId`, `overtimeApprovedByName` und der
  neue oberste `editHistory`-Actor werden serverseitig aus aktiven Nutzern
  abgeleitet, statt frei aus dem Request uebernommen zu werden. Normale
  Mitarbeiter duerfen nur eigene manuelle Eintraege anlegen/bearbeiten/
  loeschen und koennen keine `stamped`-Eintraege vortaeuschen. Admin,
  Geschaeftsfuehrung, Fuehrungskraft und Buchhaltung duerfen fremde
  Projektzeiten fachlich nachtragen/bearbeiten; Ueberstundenfreigabe bleibt
  auf Admin/Geschaeftsfuehrung/Fuehrungskraft begrenzt. Im zentralen
  Frontend-Speicherhelper in `src/components/dashboard/dashboard-page.tsx`
  wird `actorUserId`/`actorName` mitgesendet; Buchhaltung ist dort fuer
  Projektzeit-Bearbeitung sichtbar freigeschaltet. `GET`, Tabellen-/
  Spaltensicherung, Kosten-Snapshot, Marketing-Felder, Completion-Status,
  Soft-Delete und bestehende Stempelzeit-Erzeugung aus `stamp-session` blieben
  erhalten. Sicherungen:
  `.codex-safety/project_time_entries_route_20260619_111956.ts` und
  `.codex-safety/AGENTS_before_project_time_entries_phase1_20260619_112829.md`.
  Before/After-Snapshot bestaetigte Exporte, Helper, entfernten Employee-/
  ActorName-Trust, erhaltene ProjectTimeEntry-Erzeugung und Soft-Delete.
  Checks bestanden: `npm.cmd run build` nach TypeScript-Typkorrektur fuer
  `editHistory`, `npx.cmd prisma validate`, `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/project-time-entries/route.ts src/components/dashboard/dashboard-page.tsx`.
  `prisma db push` wurde bewusst nicht ausgefuehrt, weil keine
  Schemaaenderung Teil dieses Fixes war. Gezielter HTTP-Test ueber lokalen
  Server mit temporaeren Testnutzern: ungueltiger Actor 401, Mitarbeiter
  eigener manueller Eintrag 201, Mitarbeiter eigener `stamped`-Eintrag 403,
  Mitarbeiter fuer anderen 403, Buchhaltung fuer anderen 201, Buchhaltung kann
  keine Ueberstundenfreigabe setzen, Fuehrungskraft setzt Freigabe serverseitig
  korrekt, Mitarbeiter-Fremdloeschung 403, eigene manuelle Loeschung 200,
  Buchhaltung-Loeschung 200; Testnutzer und Testzeiten wurden bereinigt.
- Phase-1-Stamp-Session-API 2026-06-19: Als sechster kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurde `src/app/api/stamp-session/route.ts`
  abgesichert. Start, Pause, Resume und Stop pruefen jetzt per lokalem
  `getRequestUser`-Helper, ob die uebergebene `userId` zu einem aktiven
  Organisationsnutzer gehoert; fehlt dieser Nutzer oder ist er ungueltig/
  inaktiv, antwortet die Route mit 401 statt eine Stempelung fuer eine
  beliebige ID zu starten, zu pausieren oder abzuschliessen. Beim Start wird
  `employee` serverseitig aus dem aktiven Nutzer abgeleitet, statt frei aus
  dem Request uebernommen zu werden. Die Dashboard-Uebersicht `GET` ohne
  `userId`, Einzel-GET, Tabellen-/Spaltensicherung, Pausenrechnung,
  Abschlussstatus `finished`/`interrupted`, Projektzeit-Erzeugung inklusive
  Kosten-Snapshot, Marketing-Felder und Loeschen der aktiven Session nach Stop
  blieben erhalten. Manuelle Zeiteintraege bleiben bewusst Aufgabe von
  `src/app/api/project-time-entries/route.ts` und wurden hier nicht
  eingeschraenkt. Sicherungen:
  `.codex-safety/stamp_session_route_20260619_110646.ts` und
  `.codex-safety/AGENTS_before_stamp_session_phase1_20260619_110941.md`.
  Before/After-Snapshot bestaetigte Exporte, Helper, entfernten Employee-Trust
  beim Start und erhaltene Stop-/ProjectTimeEntry-Nebenlogik. Checks bestanden:
  `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/stamp-session/route.ts`. `prisma db push`
  wurde bewusst nicht ausgefuehrt, weil keine Schemaaenderung Teil dieses
  Fixes war. Gezielter HTTP-Test ueber lokalen Server mit temporaerem
  Testnutzer: ungueltiger Start 401, Start 201 mit serverseitigem Employee,
  doppelter Start 409, ungueltiges Pause/Resume 401, Pause 200, Resume 200,
  ungueltiger Stop 401, Stop 201 mit gestempeltem ProjectTimeEntry; Testnutzer,
  aktive Session und Testzeit wurden bereinigt.
- Phase-1-Planning-Entries-API 2026-06-19: Als fuenfter kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurde `src/app/api/planning-entries/route.ts`
  abgesichert. `POST` und `DELETE` nutzen jetzt einen lokalen
  `getRequestActor`-Helper und brechen bei fehlendem, ungueltigem oder
  inaktivem `actorUserId` mit 401 ab. `actorName`, `requestedByName`,
  `requestedByUserId`, `approvedByUserId` und `employeeName` werden fuer
  Schreiboperationen serverseitig aus aktiven Organisationsnutzern abgeleitet,
  statt frei aus dem Request uebernommen zu werden. Nicht-Fuehrungsrollen
  duerfen nur eigene Terminwuensche im Status `requested` anlegen/bearbeiten
  und nur eigene offene Terminwuensche loeschen; Admin, Geschaeftsfuehrung und
  Fuehrungskraft duerfen weiterhin bestaetigte/fremde Planung fachlich
  verwalten. `GET`, `formatEntry`, Tabellen-/Spaltensicherung,
  Duplicate-Check, History-Erzeugung, Verantwortlichen-Notification,
  Overlap-Notification, Angebots-/Marketing-/Recurrence-Felder und Soft-Delete
  blieben erhalten. Sicherungen:
  `.codex-safety/planning_entries_route_20260619_105008.ts` und
  `.codex-safety/AGENTS_before_planning_entries_phase1_20260619_105343.md`.
  Before/After-Snapshot bestaetigte Route, Exporte, Helper, entfernten
  Actor-Name-Trust aus Body/Query und erhaltene Planungsnebenfunktionen.
  Checks bestanden: `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/planning-entries/route.ts`. `prisma db push`
  wurde bewusst nicht ausgefuehrt, weil keine Schemaaenderung Teil dieses
  Fixes war. Gezielter HTTP-Test ueber lokalen Server: ungueltiger Actor 401,
  Mitarbeiter-bestaetigt 403, Mitarbeiter-fuer-anderen 403, eigener
  Terminwunsch 201 mit serverseitigem Namen/Requester/History-Actor, eigener
  Wunsch-DELETE 200, Manager-bestaetigt 201, Manager-DELETE 200 und Testdaten
  wurden bereinigt.
- Phase-1-Abwesenheits-API 2026-06-19: Als vierter kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurde `src/app/api/absences/route.ts` abgesichert.
  `POST`, `PATCH` und `DELETE` nutzen jetzt einen lokalen `getRequestActor`-
  Helper und brechen bei fehlender, ungueltiger oder inaktiver `actorId` mit
  401 ab, statt auf den Demo-User/Admin aus `getDemoContext()` zurueckzufallen.
  Zielnutzer und Vertreter muessen bei Anlage/Bearbeitung aktiv sein. Beim
  normalen Bearbeiten bleibt fuer Nicht-Fuehrungsrollen der urspruengliche
  Antragsteller fest auf `existingAbsence.userId`, sodass ein eigener Antrag
  nicht durch geaendertes `userId`-Feld auf einen anderen Mitarbeiter
  umgeschrieben werden kann; Fuehrung/Admin darf weiter fachlich fremde
  Abwesenheiten bearbeiten. `GET`, `formatAbsence`, `canManageAbsences`,
  `notifyAbsenceChange`, `ensureAbsenceTable`, Aktionsfluss fuer
  Vertretungsannahme/finale Freigabe/Ablehnung und DELETE-SQL blieben erhalten.
  Sicherungen: `.codex-safety/absences_route_20260619_103005.ts` und
  `.codex-safety/AGENTS_before_absences_phase1_20260619_103506.md`.
  Before/After-Snapshot bestaetigte Route, Exporte, Helper, entfernten
  Actor-Fallback, erhaltenen Aktionsfluss und DELETE-Pfad. Checks bestanden:
  `npm.cmd run build` nach einmaliger Wiederholung wegen temporaerem
  Next-Cache/Page-Data-Fehler bei `/api/contacts`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/absences/route.ts`. `prisma db push` wurde
  bewusst nicht ausgefuehrt, weil keine Schemaaenderung Teil dieses Fixes war.
  Gezielter HTTP-Test ueber lokalen Server: ungueltiger Actor bei POST/PATCH/
  DELETE 401, Mitarbeiter-Fremdanlage 403, Selbstanlage 201, eigener
  Umhaengeversuch blieb beim Originalnutzer, DELETE 200 und Testdaten wurden
  bereinigt.
- Phase-1-Notifications-API 2026-06-19: Als dritter kleiner Fix aus der
  Rechte-/Actor-ID-Roadmap wurde `src/app/api/notifications/route.ts`
  abgesichert. `GET` und `PATCH` nutzen jetzt einen lokalen `getRequestUser`-
  Helper und brechen bei fehlender, ungueltiger oder inaktiver `userId` mit
  401 ab, statt auf den Demo-User aus `getDemoContext()` zurueckzufallen.
  Damit kann ein fehlender/falscher Request-User nicht mehr versehentlich
  offene Meldungen des Demo-Users laden oder als gelesen markieren. Die
  bestehende POST-Erzeugung, Linkspalten-Sicherung, Historien-/Suchlogik und
  das Markieren offener Meldungen per `readAt IS NULL` blieben erhalten.
  Sicherungen: `.codex-safety/notifications_route_20260619_102407.ts` und
  `.codex-safety/AGENTS_before_notifications_phase1_20260619_102651.md`.
  Before/After-Snapshot bestaetigte Route, Exporte, Helper, entfernten
  User-Fallback und erhaltene POST-Erzeugung. Checks bestanden:
  `npm.cmd run build`, `npx.cmd prisma validate`,
  `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/notifications/route.ts`. `prisma db push`
  wurde bewusst nicht ausgefuehrt, weil keine Schemaaenderung Teil dieses Fixes
  war. Gezielter HTTP-Test ueber lokalen Server: ungueltige `userId` bei GET
  401, gueltige `userId` 200, ungueltige `userId` bei PATCH 401 ohne
  Aenderung offener Meldungen.
- Phase-1-Users-API 2026-06-19: Im zweiten kleinen Fix aus der
  Rechte-/Actor-ID-Roadmap wurde `src/app/api/users/route.ts` abgesichert.
  `POST`, `PATCH` und `DELETE` nutzen jetzt einen lokalen `getRequestActor`-
  Helper und brechen bei fehlender oder ungueltiger `actorId` mit 401 ab,
  statt auf den Demo-Admin aus `getDemoContext()` zurueckzufallen. Das normale
  `PATCH` laedt den Zielbenutzer jetzt vor dem Schreiben per `id` plus
  `organizationId`; `set-active` und `DELETE` hatten dieses Muster bereits.
  Bei `POST` und `PATCH` werden uebergebene `teamIds` jetzt gegen Teams der
  aktuellen Organisation geprueft, damit keine fremden oder ungueltigen
  Team-IDs in `User.teamId` oder `UserTeamMembership` landen. `GET`,
  `formatUser`, `canManageUsers`, `canManagePersonalNumber`, `setUserTeams`
  und der Soft-Delete ueber `isActive: false` blieben erhalten. Sicherungen:
  `.codex-safety/users_route_20260619_100839.ts` und
  `.codex-safety/AGENTS_before_users_phase1_20260619_101418.md`. Before/After-
  Snapshot bestaetigte Route, Exporte, Helper, entfernten Admin-Fallback,
  vorgeschalteten Organisations-Lookup, Team-ID-Validierung und erhaltenen
  Soft-Delete. Checks bestanden: `npm.cmd run build`,
  `npx.cmd prisma validate`, `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/users/route.ts`. `prisma db push` wurde
  bewusst nicht ausgefuehrt, weil keine Schemaaenderung Teil dieses Fixes war.
  Gezielter HTTP-Test ueber lokalen Server: ungueltiger Actor 401,
  Mitarbeiter bei Anlage/Bearbeitung/Entfernung 403, ungueltige Team-ID 400,
  Geschaeftsfuehrung 201/200/200 fuer Anlegen/Bearbeiten/Soft-Delete; der
  Testbenutzer wurde anschliessend bereinigt.
- Phase-1-Teams-API 2026-06-19: Als erster kleiner Fix aus der Audit-Roadmap
  wurde `src/app/api/teams/route.ts` abgesichert. `POST`, `PATCH` und
  `DELETE` nutzen jetzt einen lokalen `getRequestActor`-Helper und brechen bei
  fehlender oder ungueltiger `actorId` mit 401 ab, statt auf den Demo-Admin
  aus `getDemoContext()` zurueckzufallen. `PATCH` laedt das Team jetzt vor dem
  Schreiben per `id` plus `organizationId`; eine falsche Team-ID schreibt
  nichts. `GET`, `formatTeam`, `canManageTeams` und die DELETE-Loeschfolge
  fuer `UserTeamMembership`, `User.teamId`, `Task.teamId` und `Team` blieben
  erhalten. Sicherungen: `.codex-safety/teams_route_20260619_094736.ts` und
  `.codex-safety/AGENTS_before_teams_phase1_20260619_095308.md`. Before/After-
  Snapshot bestaetigte Route, Exporte, Helper, entfernten Admin-Fallback und
  erhaltene Loeschfolge. Checks bestanden: `npm.cmd run build`,
  `npx.cmd prisma validate`, `npm.cmd run check:mojibake`,
  `git diff --check -- src/app/api/teams/route.ts`. `prisma db push` wurde
  bewusst nicht ausgefuehrt, weil keine Schemaaenderung Teil dieses Fixes war.
  Gezielter HTTP-Test ueber lokalen Server: ungueltiger Actor 401, Mitarbeiter
  403, Geschaeftsfuehrung 201/200/200 fuer Anlegen/Bearbeiten/Loeschen,
  falsche Team-ID 404 ohne Schreibeffekt.
- Planungsboard-Zeitleistenklick 2026-06-15: In der Tagesansicht des
  Planungsboards oeffnet ein Klick in eine freie Zeitleistenstelle wieder eine
  Vorschaltmaske. Dort wird zwischen `+ Termin` und `+ Terminwunsch`
  gewaehlt, danach ein Projekt ausgewaehlt oder bewusst `Ohne Projekt
  fortfahren` genutzt. Datum, angeklickte 15-Minuten-Uhrzeit, Mitarbeiter,
  Planungsgruppe und Board werden in die bestehende Planungsmaske
  uebernommen. Bei Einmalprojekten mit planbaren Angebotsstunden erzwingt die
  bestehende Maske weiter die Angebotszuordnung; ohne Projekt bleibt es eine
  manuelle Planung fuer interne Arbeiten, Wartungen oder Objektbesichtigungen.
- Aufgabenbeteiligte/Kommentare 2026-06-15: Aufgabenbeteiligte bleiben
  Beteiligte und ersetzen nicht die zustaendige Person. Aufgaben bleiben fuer
  den Ersteller sichtbar, auch wenn er nicht zustaendig oder beteiligt ist.
  Neue Aufgabenkommentare erzeugen App-Notifications an die zustaendige Person
  und alle Aufgabenbeteiligten; der Kommentar-Autor wird dabei bewusst
  ausgeschlossen.
- Pflichtkommentar Stempelung 2026-06-15: Beim Start einer Stempelung ist ein
  kurzer Kommentar Pflicht und wird direkt an der aktiven `ActiveStampSession`
  gespeichert. Die Team-Live-Ansicht zeigt Projekt/Unproduktiv plus
  Startkommentar. Beim Stoppen oder Wechseln wird die Startnotiz angezeigt; die
  Abschluss-Ergaenzung ist optional und wird nur bei Eingabe an den Kommentar
  angehaengt.
- Stempelung Wechsel-Reihenfolge 2026-06-15: Beim Wechseln einer produktiven
  Projektstempelung muss zuerst entschieden werden, ob die bisherige Arbeit
  fertig oder unterbrochen ist. Erst danach werden Tagesplanung, anderes
  Projekt, unproduktive Taetigkeit und der Pflichtkommentar fuer die
  Folgetaetigkeit angezeigt. Unproduktive Stempelungen haben weiterhin keine
  Arbeit-fertig/unterbrochen-Abfrage.
- Stempelung Abschlussstatus 2026-06-15: `ProjectTimeEntry.completionStatus`
  speichert bei produktiven Projektstempelungen dauerhaft `finished` oder
  `interrupted`. Der Status wird beim Stoppen/Wechseln aus der Auswahl
  `Arbeit fertig`/`Arbeit unterbrochen` an `/api/stamp-session` uebergeben und
  nicht fuer unproduktive Stempelungen gesetzt. `finished` bleibt der Trigger
  fuer Endkontrolle; `interrupted` schliesst nur die aktuelle Stempelung.
- Stempelung Prozessschutz 2026-06-15: Eine aktive Stempelung darf serverseitig
  nicht durch einen neuen direkten Start ueberschrieben werden. Erst muss der
  bestehende Lauf ueber Wechsel oder Stop beendet werden. Projektstempelungen
  duerfen zudem nicht ohne `completionStatus` beendet werden; direkte Stop-
  oder Delete-Aufrufe ohne `finished`/`interrupted` werden abgelehnt.
- Stempelung Endkontrolle nach Projekttyp 2026-06-15: Bei `Arbeit fertig`
  bleibt die Endkontrolle fuer OK-immocare-Projekte direkt sichtbar. Bei
  OK-solutions-Projekten ist sie in der Stempelmaske nur optional und
  standardmaessig geschlossen; ohne bewusstes Oeffnen wird keine
  Endkontrolle gespeichert.
- Planungsboard aktiver Zeitbalken 2026-06-15: Eine laufende Stempelung bleibt
  im Tagesplan auch nach Ende des geplanten Terminfensters am zuletzt passenden
  Termin sichtbar. Bei mehreren Terminen desselben Projekts gewinnt der Termin,
  dessen Zeitfenster aktuell beruehrt wird; danach der letzte passende
  vergangene Termin. So wird nicht jeder Termin desselben Projekts markiert.
- Meine Ziele 2026-06-14: Der bisherige Sidebar-Bereich `Sales-Hub` heisst in
  der UI jetzt `Meine Ziele`. Die interne Tab-ID bleibt `salesHub`, damit alte
  Links/gespeicherte Tabs nicht brechen. Die bestehende `SalesTarget`-Tabelle
  wurde um `metricKey`, `targetValue`, `periodStart` und `periodEnd`
  erweitert. Geschaeftsfuehrung/Admin kann Ziele fuer aktive Mitarbeiter aus
  einem KPI-Katalog anlegen; Mitarbeiter sehen ihre eigenen Zielkarten mit
  Soll/Ist-Fortschritt. Ist-Werte werden clientseitig aus Angeboten,
  Rechnungen, Aufgaben, Verkaufschancen und KuZu-Bewertungen berechnet.
- Meine-Ziele-KPI-Erweiterung 2026-06-14: Der KPI-Katalog umfasst jetzt
  Vertrieb, Angebote, verlorene/gewonnene Angebote, Angebotswerte nach
  Leistung/Material/Paket, Rechnungen, bezahlte Rechnungen, fakturierte
  Leistung/Material/Paket-Werte, Aufgaben, Stempelstunden, Leistungsgrad,
  Produktivitaet, Logbucheintraege, Taetigkeitsberichte und KuZu. Die
  Zielanlage nutzt sichtbare deutsche Datumsfelder (`TT.MM.JJJJ`) und speichert
  intern normalisierte Datumswerte, damit alte Monatsziele weiter lesbar sind.
- Projektverantwortung/Vertretung 2026-06-14: Projekte haben neben
  `responsibleName` jetzt `deputyName`, `deputyFrom` und `deputyUntil`. Im
  Projektdaten-Dialog sind Projektverantwortlicher und Vertretung als aktive
  Mitarbeiter auswaehlbar; die Vertretung hat einen Zeitraum. Die
  Kopf-Pille oeffnet den Projektdaten-Dialog und zeigt bei aktivem
  Vertretungszeitraum `Vertretung aktiv: Name`, sonst
  `Projektverantwortlicher: Name`. Das Freitextfeld fuer Projektbeteiligte ist
  aus der UI entfernt, bleibt technisch nur zur Bestandssicherung erhalten.
  Bei Abrechnungsbereit-Hinweisen wird die aktuell fachlich zustaendige Person
  benachrichtigt. Wenn Hauptverantwortlicher und Vertretung identisch wuerden,
  wird die Vertretung inkl. Zeitraum geleert.
- Abwesenheitsvertretung in Projekten 2026-06-14: Eine genehmigte
  Abwesenheit des Projektverantwortlichen mit Vertreter hat Vorrang vor der
  projektbezogenen Vertretung. Die Projektkopf-Pille zeigt dann
  `Abwesenheitsvertretung aktiv: Name`; Abrechnungsbereit-Hinweise gehen an
  diesen Vertreter statt an den abwesenden Projektverantwortlichen. In der
  Abwesenheitsmaske steht am Vertreterfeld ein Hinweis auf diese Verknuepfung.
- Eskalation Abrechnungsbereit 2026-06-14: Die Erstmitteilung geht an die
  aktuell zustaendige Person: Abwesenheitsvertretung, sonst aktive
  Projektvertretung, sonst Projektverantwortlicher. Bleibt der fachliche
  Hinweis 1,5 Arbeitstage bestehen, erzeugt der Notification-Endpunkt eine
  `Fuehrungskraft:`-Eskalation an aktive Fuehrungskraefte der Planungsgruppe.
  Gibt es keine passende Fuehrungskraft, geht diese Stufe an
  Geschaeftsfuehrung/Admin. Nach insgesamt 2,5 Arbeitstagen erzeugt er eine
  `Geschaeftsfuehrung:`-Eskalation. Gelesene Hinweise setzen die Eskalation
  nicht zurueck; massgeblich ist, ob das Projekt weiterhin abrechnungsbereit
  und nicht fakturiert ist.
- Abrechnungsbereit-Erinnerung 2026-06-14: Beim Laden/Arbeiten scannt die UI
  aktuelle abrechnungsbereite Projekte im aktuellen Monat und ruft die
  deduplizierte Notification-Erzeugung auf. Das ist ein App-interner Scan,
  kein externer Cronjob.
- Dauerlaeufer-Abrechnungsbereit-Notification 2026-06-14:
  Normale Dauerlaeufer erzeugen monatsbezogene App-Notifications, sobald fuer
  den Monat noch keine finale Rechnung existiert und die Pflichtnachweise
  vollstaendig sind. OK immocare verlangt Endkontrolle und
  Taetigkeitsbericht; OK solutions verlangt die Endkontrolle. Winterdienst ist
  bewusst ausgeschlossen, weil er einsatzbezogen ueber
  `Prozess/Automation > Winterdienst` laeuft. Empfaenger ist die aktuell
  fachlich zustaendige Person, nicht die Buchhaltung. Deduplizierung erfolgt
  ueber Betreff inkl. Monat und Projekt-Link.
- Abrechnungsbereit-Notification 2026-06-14: Einmalprojekte erzeugen keinen
  Popup-Statuswechsel, sondern eine deduplizierte App-Notification `Projekt
  abrechnungsbereit`, sobald noch keine finale Rechnung existiert und die
  Pflichtnachweise vollstaendig sind. OK immocare verlangt Endkontrolle,
  Vorherbild, Nachherbild und Taetigkeitsbericht; OK solutions verlangt nur
  die Endkontrolle. Empfaenger ist die aktuell fachlich zustaendige Person,
  nicht die Buchhaltung. Der Notification-Endpunkt kann dafuer jetzt kleine
  Projekt-Hinweise per POST erzeugen; Klickziel `project` oeffnet die
  Projektakte bei Rechnungen.
- Bestaetigte Endkontrolle-Automatik 2026-06-14: Nach einer gespeicherten
  Endkontrolle fragt WorkPilot bei Einmalprojekten, ob der Projektstatus auf
  `Endkontrolle` gesetzt werden soll. Dauerlaeufer werden bewusst
  uebersprungen, weil Endkontrollen dort meist Monats-/Einsatznachweise sind.
  Ist der Status bereits passend, wird nicht erneut gefragt.
- Bestaetigte Umsetzung-Automatik 2026-06-14: Eine projektbezogene
  Stempelung und hochgeladene Vorher-/Nachherbilder gelten als echte
  Ausfuehrung. WorkPilot fragt dann rollenunabhaengig, ob der Projektstatus
  auf `Umsetzung`/In Umsetzung gesetzt werden soll. Ist der Status bereits
  passend, wird nicht erneut gefragt.
- Bestaetigte Projektstatus-Automatik 2026-06-14: Die ersten
  Pipeline-Regeln sind als bestaetigte Automatik aktiv und nicht auf
  Fuehrungskraefte beschraenkt. Nach einem gespeicherten Angebotsentwurf fragt
  WorkPilot, ob der Projektstatus auf `Angebot`/Angebotserstellung gesetzt
  werden soll. Nach einem neu finalisierten Angebot fragt WorkPilot nach
  `Warten auf Kunde`. Nach einem Terminwunsch fragt WorkPilot nach `Zur
  Planung bereit`; nach einem festen Termin nach `Geplant`. Bei Zustimmung
  wird der Projektstatus gespeichert und ein Logbucheintrag
  `Projektstatus per bestaetigter Automatik geaendert` geschrieben. Ist der
  Status bereits passend, wird nicht erneut gefragt.
- Prozess-Automation-Optik 2026-06-14: `Prozess/Automation >
  Status-Automatisierung` ist als erklaerende Arbeitsansicht aufgebaut, nicht
  mehr als fuehrende Roh-Tabelle. Oben stehen drei kurze Grundsaetze, danach
  die Status-Strecke, Kennzahlen zu Automatik/Vorschlag/Monatslogik,
  Regelkarten getrennt nach Einmalprojekt und Dauerlaeufer sowie eine separate
  Dauerlaeufer-Monatslogik. Die technische Tabelle bleibt nur als aufklappbare
  Detailuebersicht erhalten.
- Allgemeine Taetigkeitsberichte 2026-06-14: Unter `Prozess/Automation >
  Allg. T-Berichte` gibt es eine manuelle Kontroll- und Versandzentrale fuer
  OK-immocare-Dauerlaeufer ohne Winterdienst. Die Ansicht nutzt den gewaehlten
  Monatskontext, zeigt T-Berichte, Monatsrechnungen, Empfaenger und
  Versandstatus und kann versandbereite Berichte separat senden. Winterdienst
  bleibt bewusst ausgeschlossen, weil diese Berichte einsatzbezogen ueber
  `Prozess/Automation > Winterdienst` laufen. Als erledigt gelten
  Taetigkeitsberichte, wenn ein `activityReport`-Versandeintrag existiert;
  mit Rechnung versendete T-Berichte werden ueber den bestehenden
  Dokument-Mail-Zusatzanhang als eigener `activityReport` protokolliert.
- Winterdienst-Scheduler 2026-06-13: `/api/winter-service-automation` kann
  Kandidaten jetzt serverseitig selbst erkennen, wenn kein `runs`-Array
  uebergeben wird. Er prueft Winterdienst-Projekte mit Stempelung,
  tagesgenaue Vorher-/Nachherbilder, Nachherbild aelter als 1 Stunde,
  keinen vorhandenen Kontext-Bericht, keinen Kontext-Versand und vorhandenen
  Taetigkeitsbericht-Empfaenger. Bei aktivierter Einstellung startet im
  laufenden Next-Prozess ein 10-Minuten-Intervall. Das ist ein interner
  Scheduler, keine externe Cron-Infrastruktur; nach Serverneustart startet er
  wieder, sobald die Einstellung/Route geladen wird.
- Winterdienst-Automatiklauf 2026-06-13: `Prozess/Automation >
  Winterdienst` nutzt jetzt `/api/winter-service-automation` fuer zentrale
  Einstellungen und den echten Automatiklauf. Einstellungen: aktiv/inaktiv,
  Versandkonto und Benachrichtigungs-Mitarbeiter. Bei aktivierter Automatik
  kann die UI erkannte Kandidaten serverseitig verarbeiten lassen: Bericht
  erstellen, per Dokument-Mail als `activityReport` senden, Versand im
  Projektlogbuch protokollieren. Fehler erzeugen In-App-Notifications fuer die
  hinterlegten Mitarbeiter und versuchen zusaetzlich eine Fehler-E-Mail ueber
  das Versandkonto. Voraussetzung fuer echte E-Mail ist ein verbundenes
  Microsoft-365-Konto beim Versandkonto.
- Winterdienst-Automatik-Kandidaten 2026-06-13: Das Winterdienst-Modul zeigt
  `Automatik bereit`, wenn ein Einsatz eine Stempelung, mindestens ein
  Vorherbild, mindestens ein Nachherbild, kein Taetigkeitsbericht-PDF und ein
  Nachherbild aelter als 1 Stunde hat. Der Button im Kopf speichert lokal den
  Zustand `Automatischer Versand aktiviert/deaktiviert` und zeigt rot/gruen
  mit pulsierender Statusleuchte. In dieser Stufe wird dadurch noch kein
  Hintergrundversand gestartet.
- Winterdienst-Qualitaetspruefung 2026-06-13: In `Prozess/Automation >
  Winterdienst` zeigt eine reine Kontrollkarte offene Qualitaetspunkte:
  fehlende Vorher-/Nachherbilder, Berichte ohne Freigabe, Freigaben ohne
  Empfaenger, versandbereite Berichte aelter als 1 Tag und theoretisch
  versendete aber noch offene Eintraege. Die Pruefung veraendert keine Daten.
- Winterdienst-Mehrfachversand 2026-06-13: In `Prozess/Automation >
  Winterdienst` gibt es im Bereich `Versandbereit` den Button `Alle
  versandbereiten senden`. Er fragt vor dem Versand nach und versendet nur
  freigegebene Eintraege mit PDF und Empfaenger. Fehlgeschlagene Eintraege
  bleiben nachvollziehbar in der Fehlermeldung; erfolgreiche Eintraege werden
  wie beim Einzelversand im Projektlogbuch protokolliert.
- Winterdienst-Versandkontrolle 2026-06-13: In `Prozess/Automation >
  Winterdienst` sind die Einsaetze jetzt in `Versandbereit`, `Offene
  Pruefpunkte` und `Versendet / erledigt` getrennt. Vor dem Einzelversand
  zeigt die Liste den konkret genutzten Empfaenger und die PDF-Datei an, damit
  kein Bericht blind versendet wird.
- Winterdienst-Einzelversand 2026-06-13: In `Prozess/Automation >
  Winterdienst` wird ein freigegebener Bericht erst versandbereit, wenn ein
  Taetigkeitsberichtempfaenger mit E-Mail ermittelt werden kann. Reihenfolge:
  markierter Taetigkeitsberichtempfaenger, Rechnungsempfaenger, Hauptkontakt,
  Projekt-Ansprechpartner, Projektkontakt. Der Button `Senden` verschickt den
  einzelnen Bericht ueber den bestehenden Dokument-Mail-Endpunkt als
  `activityReport` und protokolliert den Versand. Kein Massenversand in dieser
  Stufe.
- Winterdienst-Freigabe 2026-06-13: In `Prozess/Automation > Winterdienst`
  kann ein vorhandener, noch nicht versendeter Taetigkeitsbericht pro Einsatz
  freigegeben werden. Die Freigabe wird als Projektlogbuch-Eintrag
  `Winterdienst: Taetigkeitsbericht freigegeben` mit demselben
  `Winterdienst:<ProjektId>:<YYYY-MM-DD>`-Kontext gespeichert. Die Liste zeigt
  danach `Freigegeben`; der Versand wird erst im naechsten Schritt angebunden.
- Winterdienst-Bericht manuell 2026-06-13: In `Prozess/Automation >
  Winterdienst` kann pro offenem Einsatz ein Taetigkeitsbericht manuell
  erstellt werden, wenn mindestens ein Vorherbild und ein Nachherbild fuer den
  Einsatztag vorhanden sind. Der Bericht nutzt den Kontext
  `Winterdienst:<ProjektId>:<YYYY-MM-DD>` und oeffnet danach die Projektakte
  im Reiter `Taetigkeitsberichte`. Kein Versand, kein Timer und keine
  Automatik in dieser Stufe.
- Winterdienst-Tageskopplung 2026-06-13: Projektbilder speichern ab jetzt
  wieder den echten Uploadzeitpunkt. Bei Dauerlaeufern bleibt `projectMonth`
  parallel als fachliche Monatszuordnung erhalten. Die Winterdienstliste
  prueft Bilder bevorzugt tagesgenau zum Stempeldatum und nutzt Monatsbilder
  nur als Fallback fuer Altbestand. Winterdienst-Taetigkeitsberichte sollen pro
  Einsatz den Kontext `Winterdienst:<ProjektId>:<YYYY-MM-DD>` tragen, damit ein
  Bericht nicht mehrere Einsatztage faelschlich abdeckt.

## Aktuelle Zusatznotizen

- Rechnungsprozess-VorprÃ¼fung 2026-06-13: Beim finalen Erstellen/Fakturieren
  von Rechnungen gibt es eine ProzessvorprÃ¼fung. EntwÃ¼rfe bleiben frei.
  TÃ¤tigkeitsberichte sind nur fÃ¼r `OK immocare` relevant; bei `OK solutions`
  werden Vorherbilder, Nachherbilder und T-Bericht in der Projektakte nicht als
  Prozesspflicht angezeigt. Endkontrolle bleibt als separater PrÃ¼fpunkt
  bestehen. Fehlen Voraussetzungen, zeigt die UI konkret, was fehlt, erlaubt
  aber eine bewusste Fortsetzung. Sind Vorher- und Nachherbilder vorhanden,
  kann vor der Rechnung ein TÃ¤tigkeitsbericht erzeugt werden. Winterdienst wird
  Ã¼ber das Gewerk erkannt und nutzt dieselbe Grundlage fÃ¼r den spÃ¤teren Ausbau
  unter `Prozess/Automation > Winterdienst`.
- TÃ¤tigkeitsbericht-Zuordnung 2026-06-13: Wird ein TÃ¤tigkeitsbericht aus der
  Rechnungs-VorprÃ¼fung fÃ¼r ein OK-immocare-Einmalprojekt erzeugt, wird der
  Angebotsbezug als interne Zuordnung `Angebot:<Angebotsnummer>` am
  Logbucheintrag gespeichert und im PDF als Zuordnung angezeigt. Die
  Rechnungs-VorprÃ¼fung bevorzugt diesen Angebotsbezug. Altbestand ohne
  Zuordnung bleibt als Fallback nutzbar, wenn im Projekt nur ein passender
  TÃ¤tigkeitsbericht vorhanden ist. DauerlÃ¤ufer bleiben vorerst monatsbezogen.
- Auswertungen Sales 2026-06-13: `Auswertungen > Sales` ist ein eigener
  Vertriebsreiter und bleibt fachlich von `Forecast & OP Kontrolle` getrennt.
  Er nutzt Angebote, Angebots-Gewinnmerkmale/Rechnungsverknuepfungen,
  verlorene Angebote und Verkaufschancen. Kennzahlen sind offene Angebote,
  gewonnene Angebote, verlorene Angebote, Abschlussquote, Verkaufschancen,
  faellige Nachfasspunkte, Sales-Verlauf, Verlustgruende und Chancenstatus.
  `VERTRIEB` darf diesen Reiter sehen; Buchhaltung nicht.
- Angebot gewonnen 2026-06-13: Ein Angebot gilt hart als gewonnen, wenn eine
  nicht geloeschte und nicht als Entwurf gefuehrte Rechnung ueber
  `sourceOfferId` oder `sourceOfferNumber` daran haengt. Zusaetzlich kann ein
  Angebot aktiv mit `wonAt`, `wonByName` und `wonReason` als gewonnen markiert
  werden. Die Planungsmaske fragt beim neuen Terminwunsch aus einem Angebot
  und bei der Bestaetigung eines Terminwunsches zum festen Termin nach, ob das
  Angebot als gewonnen markiert werden soll. Gewonnene und verlorene Angebote
  duerfen sich gegenseitig ausschliessen.
- Projektstatus-Automatisierung 2026-06-13: Die Projektpipeline enthaelt den
  Status `Geplant` zwischen `Zur Planung bereit` und `Umsetzung`. `Zur Planung
  bereit` bedeutet Terminwunsch/Planungsbedarf ohne festen Termin. `Geplant`
  bedeutet fester Planungstermin vorhanden, aber Ausfuehrung noch nicht
  gestartet. `Umsetzung` beginnt erst, wenn ein Termin erreicht wurde,
  gestempelt wurde oder ein Ausfuehrungsnachweis vorliegt. Bei Dauerlaeufern
  ist `Zur Abrechnung bereit` ein monatsbezogener Faktura-Zustand; nach
  Faktura soll ein weiterlaufender Dauerlaeufer wieder in `Umsetzung` stehen
  und nur bei Vertragsende/Kuendigung auf `Abgeschlossen` wechseln.
- Rollen/Auswertungen 2026-06-13: Die Rolle `BUCHHALTUNG` ist eine
  Auswertungsrolle. Sie darf in der Hauptnavigation nur `Auswertungen` sehen;
  gespeicherte oder direkte Reiterwechsel muessen fuer diese Rolle automatisch
  wieder auf `reports`/`Auswertungen` zurueckfallen. Die Rolle ist nicht als
  normale Mitarbeiter-/Fuehrungskraftrolle zu behandeln und darf keine
  Projekt-, Aufgaben-, Kontakt-, Planungsboard- oder Mitarbeiterverwaltungs-
  Navigation erhalten. Feingranulare Auswertungsreiter und Sprunglinks werden
  separat rollenbasiert nachgezogen.
- Auswertungsreiter-Rollenmatrix 2026-06-13: `ADMIN` und
  `GESCHAEFTSFUEHRER` sehen alle Auswertungsreiter. `BUCHHALTUNG` sieht nur
  `Forecast & OP Kontrolle`, `Umsaetze - Details`, `Kunden` und
  `Umsatz- und Projektuebersicht`. `FUEHRUNGSKRAFT` sieht `Umsatz- und
  Projektuebersicht`, `Projekte`, `SVS Analyse`, `KuZu`, `Mitarbeitende` und
  `Projektkarte`. `MITARBEITER` sieht vorerst `Umsatz- und Projektuebersicht`
  und `Mitarbeitende`; weitere Reiter erst freischalten, wenn deren Inhalte
  auf eigene/teambezogene Daten begrenzt sind. `VERTRIEB` sieht
  `Umsatz- und Projektuebersicht`, `Projekte`, `Kunden` und `KuZu`; `GAST`
  nur die Uebersicht. Wenn ein nicht erlaubter Reiter aktiv ist, muss die UI auf
  den ersten erlaubten Reiter zurueckfallen.
- Buchhaltung-Drilldowns 2026-06-13: `BUCHHALTUNG` bleibt im gesamten Programm
  auf `Auswertungen` begrenzt. Auswertungslisten duerfen fuer diese Rolle keine
  aktiven Spruenge in Projektakten, operative Projektbereiche, Kontakte,
  Aufgaben oder Mitarbeiterverwaltung anbieten. Forecast-Qualitaets-Treffer
  duerfen sichtbar bleiben, aber Projekt-/Angebots-/Rechnungs-/Mahnungs-
  Drilldowns muessen deaktiviert sein (`Nur Hinweis`) und `openProjectFile`
  muss fuer diese Rolle defensiv abbrechen.
- Buchhaltung-Leserechte 2026-06-13: `BUCHHALTUNG` hat in `Auswertungen` reine
  Leserechte. Schreibaktionen wie `Als bezahlt markieren` oder
  `Mahnung erstellen` duerfen fuer diese Rolle nicht sichtbar ausfuehrbar sein
  und muessen zusaetzlich in den Aktionsfunktionen defensiv abbrechen. Im
  Reiter `Umsaetze - Details` darf `BUCHHALTUNG` keine internen Kosten,
  Margen oder SVS-Kennzahlen sehen; diese Tiefe bleibt `ADMIN` und
  `GESCHAEFTSFUEHRER` vorbehalten.
- Auswertungen Mitarbeitende Rollentiefe 2026-06-13: Im Reiter
  `Mitarbeitende` muessen Kopfkennzahlen und Gruppenkarten dieselbe
  rollenabhaengige Datenbasis nutzen. `ADMIN` und `GESCHAEFTSFUEHRER` sehen
  alle aktiven Mitarbeitenden und alle Planungsgruppen. `FUEHRUNGSKRAFT` sieht
  nur die eigene Planungsgruppe inklusive aufklappbarer Einzelkarten.
  `MITARBEITER` sieht die eigene Planungsgruppe nur als Teamkennzahlen plus
  die eigene Kennzahlenkarte; fremde Mitarbeiter-Einzelkarten duerfen fuer
  normale Mitarbeitende nicht aufklappbar sein.
- Auswertungen Umsatz-/Projektuebersicht Rollentiefe 2026-06-13:
  `Umsatz- und Projektuebersicht` ist fuer mehrere Rollen sichtbar, muss aber
  abgestuft bleiben. Gesamtumsatz darf sichtbar bleiben. `ADMIN` und
  `GESCHAEFTSFUEHRER` sehen vollstaendige Steuerungsdaten inklusive Marge,
  SVS, Kundenrisiko, Top-Risiken, Projektstatus und Geschaeftsbereich-Marge.
  `BUCHHALTUNG` sieht Finanz-/OP-orientierte Lesedaten wie bezahlt, offen,
  ueberfaellig, Forecast, Kundenrisiko und Top-Risiken, aber keine Margen oder
  operative Projektsteuerung. `FUEHRUNGSKRAFT` sieht operative Projektzahlen,
  Status und Geschaeftsbereiche ohne Margen/Kundenrisiko. `MITARBEITER` sieht
  eine reduzierte Uebersicht mit Gesamtumsatz/Umsatztrend, aber keine Margen,
  Kundenrisiken, Top-Risiken oder fremde operative Projektsteuerungsdetails.
- Auswertungen Projekt/SVS/KuZu Rollenscope 2026-06-13: Die Reiter
  `Projekte`, `SVS Analyse`, `KuZu` und `Projektkarte` muessen fuer
  `FUEHRUNGSKRAFT` und `VERTRIEB` mit einer rollenbezogenen Projektbasis
  arbeiten. `ADMIN`, `GESCHAEFTSFUEHRER` und `BUCHHALTUNG` duerfen die
  technische Vollbasis behalten, soweit der jeweilige Reiter sichtbar ist.
  `FUEHRUNGSKRAFT` sieht Projekte, wenn sie selbst beteiligt/verantwortlich
  ist oder wenn aktive Mitarbeitende der eigenen Planungsgruppe im Projekt
  beteiligt sind bzw. darauf gestempelt haben. `VERTRIEB` sieht eigene
  verantwortete/beteiligte Projekte; KuZu-Bewertungen und Bewertungslinks
  bleiben zusaetzlich sichtbar, wenn sie dem aktiven Vertriebsmitarbeiter
  zugeordnet sind. Pipeline-Engpaesse muessen dieselbe Projektbasis nutzen wie
  die Projektliste.
- Auswertungen Projektkarte 2026-06-12: Der Reiter `Projektkarte` ist eine
  schematische Projektuebersicht ohne echtes Geocoding. Sie zeigt Kennzahlen zu
  Projekten mit/ohne Adresse, regionale PLZ-Cluster, Karten-Pins mit
  Projektnummern und eine Projektliste mit direktem Einstieg in die Projektakte.
  Pin-Positionen sind bewusst nur schematisch, bis echte Koordinaten/Geocoding
  vorhanden sind; die Ansicht darf keine exakte geografische Lage suggerieren.
- Auswertungen Umsatz-/Projektuebersicht 2026-06-12: Der Reiter
  `Umsatz- und Projektuebersicht` ist als Management-Uebersicht aufgebaut. Er
  zeigt Umsatz, bezahlt, offen, ueberfaellig, Forecast-Potenzial, Marge,
  Projektanzahl, Einmal-/Dauerlaeufer-Aufteilung, lange Projektstatusphasen,
  SVS, Kundenrisiko, Umsatztrend, Top-Risiken, Projektstatus-Verteilung und
  Geschaeftsbereiche. In `Top-Risiken` steht die Dauer/ÃœberfÃ¤lligkeit in einer
  eigenen Spalte `Tage`, nicht im Hinweistext. Die Ansicht verwendet vorhandene
  Auswertungsdaten und ist eine Steuerungs-/Anzeigeebene; sie darf keine
  Forecast-, Zahlungs-, Mahn- oder Projektstatuslogik veraendern.
- Auswertungen Kunden 2026-06-12: Der Reiter `Kunden` wertet Kunden im
  gewaehlten Auswertungszeitraum nicht mehr nur nach Rechnungsvolumen aus,
  sondern zeigt Umsatz, bezahlten Umsatz, offene Posten, ueberfaellige offene
  Posten, Projekt- und Rechnungsanzahl, durchschnittliche Zahlungsdauer,
  Mahnstufe/Risiko sowie KuZu-Bewertungen/Hot-Alerts je Kunde. Die
  Risikobewertung ist eine Anzeigehilfe aus OP, Ueberfaelligkeit, Mahnstufe
  und KuZu-Hot-Alerts; sie darf keine Zahlungs- oder Mahnlogik veraendern.
- Forecast-Zeitraumfilter 2026-06-12: `Auswertungen > Forecast & OP
  Kontrolle` hat einen eigenen Zeitraumfilter mit `Aktueller Monat`,
  `Vormonat`, `Aktuelles Jahr`, `Vorjahr`, `Letzte 12 Monate`,
  `Naechste 12 Monate` und `Individuell`. Der Monatsstrahl bleibt bestehen,
  zeigt aber die Monate des gewaehlten Forecast-Zeitraums; `Gesamt` bezieht
  sich immer auf genau diesen Zeitraum. Beim Wechsel des Forecast-Zeitraums
  wird automatisch wieder `Gesamt` gewaehlt, damit keine alte Monatsauswahl in
  einem neuen Zeitraum stehen bleibt.
- Projektakte Forecast-Reiter 2026-06-12: Dauerlaeufer-Projekte haben in der
  Projektakte einen eigenen Reiter `Forecast`. Dort werden die vorhandenen
  Projektfelder `forecastNetAmount` und `forecastBillingType` gepflegt. Der
  Reiter zeigt den daraus berechneten Monatswert und weist darauf hin, dass
  eine echte Monatsrechnung diesen Planwert im Forecast ersetzt. Einmalprojekte
  zeigen diesen Reiter nicht, weil sie weiterhin ueber Angebot/Rechnung in den
  Forecast laufen. Forecast-Aenderungen werden ueber die bestehende
  Projekt-API gespeichert und im Projektlogbuch protokolliert.
- Forecast-Qualitaetspruefung 2026-06-12: `Auswertungen > Forecast & OP
  Kontrolle` zeigt zusaetzlich eine kompakte Forecast-Qualitaetspruefung. Sie
  bewertet im gewaehlten Forecast-Zeitraum Dauerlaeufer ohne belastbare
  Forecast-Quelle, Angebote ohne Ausfuehrungsmonat, offene Posten ohne
  Faelligkeit, ueberfaellige offene Posten ohne Mahnstufe, Werte ohne
  Geschaeftsbereich, Forecast-Werte aus Rechnungshistorie und auffaellige
  Abweichungen zwischen gepflegtem Dauerlaeufer-Forecast und Monatsrechnung.
  Trefferzahlen groesser 0 oeffnen ein Modal mit kompakter Arbeitsliste und
  direktem Einstieg in Projektakte, Angebots-, Rechnungs- oder Mahnungsbereich;
  die Qualitaetskarten selbst bleiben kompakt und duerfen keine langen
  Inline-Listen rendern. Diese Pruefung ist eine Anzeige-/Kontrollschicht und darf
  die bestehenden Forecast- und OP-Summen nicht eigenstaendig veraendern.
- Mahnungsmail 2026-06-12: Mahnungen sind im Dokument-Mail-Versand ein eigener
  Typ `reminder` mit eigener Vorlage und Beschriftung. Mahnungs-PDFs aus der
  Projektakte > Dokumente > Mahnung werden beim Klick auf `Per E-Mail senden`
  als `Mahnung ... als PDF anhaengen` vorbereitet. Wenn die Datei dem Muster
  `MA-Rechnungsnummer-Stufe.pdf` folgt, wird der Versand in der Historie der
  Originalrechnung als `reminder_email_sent` protokolliert; andernfalls bleibt
  der Versand als Dokument-Mail-Dispatch erhalten, ohne eine falsche
  Rechnungshistorie zu schreiben.
- Auswertungen Forecast/OP Detailkontrolle 2026-06-12: Forecast & OP darf
  fuer `Fakturiert`, `Bezahlt` und `Offene Posten` keine Rechnungsentwuerfe,
  Stornos, Stornorechnungen oder geloeschte Rechnungen einrechnen. Offene
  Posten werden zusaetzlich als eigene Detailkontrolle mit Rechnung, Kunde,
  Projekt, Leistungsdatum, Status und offenem Nettobetrag gezeigt. Eintraege
  ohne gepflegten Geschaeftsbereich bleiben unter `Ohne Geschaeftsbereich` in
  Summen und Detailtabellen sichtbar, damit Forecast-/OP-Werte nicht leise aus
  den Kopfkennzahlen verschwinden.
- Auswertungen Dauerlaeufer-Forecastquelle 2026-06-12: Geplante
  Dauerlaeufer-Monate duerfen nicht mehr aus Projektvolumen oder
  Angebotsdurchschnitt erzeugt werden. Vorrang hat eine echte Monatsrechnung;
  danach ein gepflegter `forecastNetAmount` am Projekt; danach nur noch eine
  belastbare Rechnungshistorie aus vorherigen echten Rechnungen. Fehlt beides,
  erzeugt der Monat keinen kuenstlichen Forecastwert.
- Rechnungsfaelligkeit 2026-06-12: Rechnungen speichern ab jetzt
  `paymentTermDays` und `dueDate` direkt am Rechnungsdatensatz. Das
  Zahlungsziel wird beim Erstellen aus dem verknuepften Kunden/Kontakt
  vorbelegt und danach als Rechnungswert eingefroren, damit spaetere
  Aenderungen am Kundenstamm alte Rechnungen nicht rueckwirkend veraendern.
  Die OP-Detailkontrolle zeigt FÃ¤lligkeitsdatum und Status (`Noch nicht
  faellig`, `Heute faellig`, `Ueberfaellig`, `Faelligkeit fehlt`).
- OP-Auswertung FÃ¤lligkeitsgruppen 2026-06-12: Forecast & OP trennt offene
  Posten zusaetzlich nach `Noch nicht faellig`, `Heute faellig`,
  `Ueberfaellig` und `Faelligkeit fehlt`. Die Detailtabelle sortiert kritische
  Rechnungen zuerst: ueberfaellig, heute faellig, fehlende Faelligkeit, danach
  noch nicht faellige Rechnungen.
- Mahnwesen Grundlage 2026-06-12: Rechnungen fuehren `reminderLevel` und
  `lastReminderAt`. Eine Mahnstufe darf nur fuer nicht bezahlte, nicht
  stornierte und nicht geloeschte Rechnungen erfasst werden. Das Erfassen
  erhoeht die Mahnstufe maximal bis 3, setzt `lastReminderAt` und schreibt einen
  `InvoiceHistory`-Eintrag mit `eventType=reminder`. Mahnungs-PDF und
  Mahnungs-E-Mail sind bewusst noch nicht Teil dieser Stufe.
- Mahnungsdokument 2026-06-12: Ueberfaellige offene Rechnungen koennen in
  Forecast & OP ueber `Mahnung erstellen` ein Mahnungs-PDF erzeugen. Das PDF
  nutzt die bestehende Firmenvorlage, referenziert Originalrechnung,
  Faelligkeit, Mahnstufe und neue Zahlungsfrist und wird in der Projektakte als
  `Dokumente: Mahnung` abgelegt. Die Aktion erhoeht die Mahnstufe, setzt
  `lastReminderAt` und schreibt einen `InvoiceHistory`-Eintrag
  `eventType=reminder-document`. E-Mail-Versand fuer Mahnungen bleibt ein
  separater Folgeschritt.
- Projektakte Mahnungsreiter 2026-06-12: Im Dokumentenreiter `Mahnung` gibt es
  einen `+ Mahnung`-Einstieg. Er ist nur aktiv, wenn im aktuellen Projekt-/
  Monatskontext mindestens eine offene, ueberfaellige, mahnfaehige Rechnung
  existiert. Ohne mahnfaehige Rechnung bleibt der Button deaktiviert und zeigt
  `Keine Mahnung faellig`.
- Logbuch-Autoren/Personalnummer 2026-06-12: Projektlogbuch-Eintraege
  speichern neben dem sichtbaren Autorennamen optional `authorUserId`. Neue
  UI-Schreibstellen sollen die aktuelle Benutzer-ID mitsenden; Altbestand ohne
  ID faellt fuer die Anzeige auf den Autorennamen zurueck. Das Logbuch zeigt
  Mitarbeiter-Profilbilder, falls vorhanden, sonst Initialen; echte
  Systemeintraege bekommen ein System-Icon. Die Mitarbeiterverwaltung hat das
  Stammdatenfeld `Personalnummer`; aendern darf es nur die Rolle
  `GESCHAEFTSFUEHRER`. Die Personalnummer ist fachlich fuer Buchhaltung, nicht
  der technische Logbuch-Schluessel.
- Projektlogbuch-Fallback-Avatare 2026-06-12: Die automatisch angezeigten
  Projektbasis-Eintraege `Projekt zugewiesen`, `Projekt erstellt` und `Status`
  sind Anzeigehilfen, keine gespeicherten Logbuchdaten. Sie muessen trotzdem
  dieselbe Avatar-Logik wie gespeicherte Projektlogbucheintraege nutzen:
  Projektverantwortliche mit Profilbild/Initialen, Systemeintraege mit
  System-Icon. Keine alten Textkreise wie `System` oder feste Kuerzel mehr
  direkt in den Avatar rendern.
- Projektlogbuch-UI 2026-06-12: Die Projektakte > Logbuch soll als ruhige
  Chronik/Timeline wirken, nicht als einfache Liste. Eintraege nutzen flache
  helle Karten mit Avatar, dezenten Meta-Zeilen und Anhang-Pills; der
  Logbuchbereich bekommt eine zurueckhaltende Abschlusszeile, damit wenig Inhalt
  in der hohen Projektaktenflaeche nicht unfertig wirkt. Keine bunten grossen
  Kacheln oder harte Tabellenoptik fuer neue Logbuch-Elemente.
- KuZu/Auswertungen 2026-06-12: KuZu steht fachlich fuer
  Kundenzufriedenheit und soll nicht mehr im Sales-Hub weiter ausgebaut werden,
  weil dieser Bereich umbenannt/umfunktioniert werden soll. Die vorhandene
  Backend-Strecke mit `CustomerFeedback`, `CustomerFeedbackRequest`,
  `/feedback/[token]` und dem Bewertungslink in Rechnungsmails bleibt erhalten.
  Die sichtbare Wiedereinbindung erfolgt unter `Auswertungen > KuZu` mit
  Bewertungen, Bewertungslinks, Durchschnitt und Hot-Alerts.
- KuZu/Rechnungsmail 2026-06-12: Rechnungsmails zeigen im Versanddialog eine
  Bewertungsbox in der Vorschau. Der persoenliche Bewertungslink wird erst beim
  Versand erzeugt. Standard ist `Bewertungslink mitsenden`; deaktivieren darf
  das nur die Rolle `GESCHAEFTSFUEHRER`. Oeffentliche Bewertungslinks duerfen
  nur einmal beantwortet werden und die Feedback-Seite sperrt bereits
  beantwortete Links sichtbar gegen erneutes Absenden. In der Vorschau darf
  nur die Geschaeftsfuehrung ueber `Jetzt bewerten` eine reine Testansicht
  oeffnen; diese erzeugt keinen `CustomerFeedbackRequest` und speichert keine
  Kundenbewertung. Wenn eine Mitarbeitersignatur angehaengt wird, entfernen
  Vorschau und Versand eine abschliessende einfache Grussformel aus dem
  Nachrichtentext, damit `Mit freundlichen Gruessen` nicht doppelt erscheint.
  Der Versanddialog benennt Hauptanhaenge spezifisch, z.B. `Rechnung RE-... als
  PDF anhaengen`. Vorhandene Taetigkeitsberichte im passenden Projekt-/
  Monatskontext werden bei Rechnungsmails automatisch als vorausgewaehlte
  Zusatzanhaenge gezeigt, bleiben aber bewusst separat deaktivierbar. Zusaetzliche
  Dateien vom PC werden als manuelle Mailanhaenge nur fuer den aktuellen Versand
  aufgenommen und nicht automatisch in der Projektakte gespeichert. Zusaetzliche
  Anhaenge aus der Projektakte koennen aus vorhandenen Projektdokumenten mit
  Dateiinhalt sowie vorhandenen Projektbildern ausgewaehlt werden; sie werden
  nur kopiert mitgesendet und in der Projektakte nicht veraendert. Die Auswahl
  erfolgt ueber ein eigenes Mehrfachauswahl-Fenster; bereits ausgewaehlte
  Anhaenge werden darin ausgeblendet.
- Auswertungen Zeitraumfilter 2026-06-12: Normale Auswertungsreiter nutzen
  einen gemeinsamen oberen Zeitraumfilter mit `Aktueller Monat`, `Vormonat`,
  `Aktuelles Jahr`, `Letzte 12 Monate` und `Individuell`. Forecast & OP behaelt
  seine eigene 12-Monats-/Monatsnavigation und wird von diesem Filter nicht
  gesteuert.
- Auswertungen SVS 2026-06-12: `SVS Analyse` ist ein eigener Reiter. Basis ist
  pro Rechnung `Netto-Rechnungswert / verknuepfte Projekt-Stempelstunden`.
  Verknuepfung erfolgt ueber `StampTimeEntry.invoiceId` mit Fallback auf
  `invoiceNumber`. Rechnungen ohne verknuepfte Stempelzeiten bleiben sichtbar
  und bekommen den Status `nicht auswertbar`; auswertbare Rechnungen zeigen
  `auswertung i.O.`.
- Auswertungen SVS nach Gewerk 2026-06-12: Die SVS-Analyse zeigt zusaetzlich
  eine Zusammenfassung nach Projekt-Gewerk. Der Gewerk-SVS wird gewichtet
  berechnet: Summe auswertbarer Netto-Rechnungswerte / Summe verknuepfter
  Stempelstunden des Gewerks. Rechnungen ohne verknuepfte Stempelzeiten werden
  je Gewerk als `nicht auswertbar` gezaehlt, aber nicht in den SVS-Wert
  eingerechnet.
- Auswertungen SVS Filter/Datenbasis 2026-06-12: Der Reiter `SVS Analyse` hat
  einen eigenen Gewerkfilter. Dieser Filter wirkt nur auf die SVS-Kennzahlen,
  `SVS nach Gewerk` und `SVS je Rechnung`; die uebrigen Auswertungsreiter
  behalten ihre bestehende Suche/Zeitraumlogik. Die Datenbasis-Ampel bewertet
  den Anteil auswertbarer Rechnungen: ab 85% `Belastbar`, ab 60% `Pruefen`,
  darunter `Lueckenhaft`.
- Auswertungen Projekt-Pipeline-Dauer 2026-06-12: Der Reiter `Projekte` nutzt
  fuer die Tabelle `Pipeline-Dauer` die Statushistorie aus `/api/status-timeline`
  mit `entityType=project`. Echte aktuelle Statusdauer wird nur aus offenen
  Timeline-Eintraegen (`endedAt` leer) berechnet. Fehlt ein passender offener
  Eintrag, faellt die Anzeige sichtbar auf das Projekt-Erstellungsdatum zurueck
  und markiert die Basis als `Fallback: Erstellungsdatum`.
- Auswertungen Pipeline-Engpaesse 2026-06-12: Der Reiter `Projekte` zeigt
  zusaetzlich `Pipeline-Engpaesse`. Grundlage sind alle Projekt-
  Statushistorien aus `StatusTimelineEntry`, gruppiert nach `toStatus`.
  Abgeschlossene Phasen nutzen `durationMinutes`; offene Phasen werden von
  `startedAt` bis zum aktuellen Zeitpunkt gerechnet. Die Tabelle zeigt
  Projekte, Phasen, aktuell offene Phasen, Gesamtzeit, Durchschnitt, laengste
  Dauer und Anteil an der gesamten Pipelinezeit.
- Auswertungen Projektart-Filter Pipeline 2026-06-12: Im Reiter `Projekte`
  trennt ein eigener Projektart-Filter `Alle Projektarten`, `Einmalige
  Projekte` und `Dauerlaeufer`. Dieser Filter steuert die Pipeline-Kennzahlen,
  `Pipeline-Engpaesse` und `Pipeline-Dauer`, damit Dauerlaeufer die
  Prozesszeiten einmaliger Projekte nicht verfaelschen.
- Auswertungen Artikel/Leistungen Paketbestandteile 2026-06-12: Der Reiter
  `Artikel & Leistungen` muss verkaufte Leistungen und Materialien aus
  fakturierten Rechnungen auch dann auswerten, wenn sie Bestandteil eines
  Pakets sind. Paketpositionen werden fuer Top-Pakete separat gezeigt; fuer
  `Meistverkaufte Leistungen`, `Meistverkaufte Materialien` und die
  Komponentenuebersicht werden Paketbestandteile mit Rechnungsmenge *
  Bestandteilmenge aufgeloest. Umsatz/Kosten werden anteilig nach Paket-
  Bestandteilwerten verteilt, damit z.B. Streugut aus Winterdienst-Paketen als
  Materialmenge sichtbar wird und Pakete nicht doppelt gezaehlt werden.
- Auswertungen Mitarbeitende 2026-06-12: Der Reiter `Mitarbeitende` nutzt
  Karten statt Tabellen. Planungsgruppen zeigen Leistungsgrad, Produktivitaet,
  Anwesenheitsgrad und `Unproduktive Std.` als Stundenwert, nicht als Quote.
  Geschaeftsfuehrung sieht alle Planungsgruppen und kann Mitarbeiterkarten
  aufklappen. Fuehrungskraft und normale Mitarbeitende sehen die eigene
  Planungsgruppe als Teamaufschluesselung; normale Mitarbeitende sehen
  zusaetzlich immer die eigene Kennzahlenkarte. Keine Kostenwerte in diesen
  Karten anzeigen.
- Auswertungen Mitarbeitende Kartenoptik 2026-06-12: Einzelne
  Mitarbeiterkarten duerfen nicht auf volle Inhaltsbreite wachsen. Die
  Mitarbeiterkarten nutzen ein kompaktes Auto-Fill-Raster mit begrenzter
  Kartenbreite, KPI-Chips oben und Stundenwerte darunter. Keine einfache
  Listenoptik und keine gestreckten Einzelkarten.
- Auswertungen Mitarbeitende Gauges 2026-06-12: In Planungsgruppen-Karten
  werden Leistungsgrad, Produktivitaet und Anwesenheitsgrad als kompakte
  Half-Gauge-SVGs visualisiert. Die Mitarbeiter-Einzelkarten bleiben bei
  kompakten KPI-Chips, damit die Detailansicht ruhig bleibt. Keine neue
  Chart-Bibliothek fuer diese Gauges verwenden. Die Gauge-Nadel muss per SVG-
  `transform="rotate(angle 70 72)"` um den Hubpunkt rotiert werden; keine CSS-
  `transform-origin` auf der Linie verwenden, weil das die Nadel versetzen kann.
- Auswertungen aktive Mitarbeitende 2026-06-12: Mitarbeitendenbezogene
  Auswertungen und Planungsboard-Kapazitaeten duerfen nur aktive Mitarbeitende
  fuehren. Inaktive Mitarbeitende bleiben in historischen Daten erhalten, sollen
  aber nicht als aktuelle Mitarbeiter-/Team-/Planungsgruppenzeilen in
  Auswertungen oder Filteroptionen auftauchen.
- Taetigkeitsberichte 2026-06-12: In der Projektakte koennen
  Taetigkeitsbericht-PDFs im Dokumentordner `Taetigkeitsberichte` geloescht
  werden. Die Funktion nutzt die bestehende Logbuch-Anhang-API und schreibt
  einen eigenen Historieneintrag `Taetigkeitsbericht: geloescht`; bei
  Dauerlaeufern bleibt die Historie im jeweiligen Projektmonat. Im
  Taetigkeitsberichte-Reiter wird unter der Dokumentliste eine eigene
  Historie angezeigt, auch wenn nach einer Loeschung keine Datei mehr im
  Ordner liegt. Die Anhang-API validiert Bild-Verschiebungen vor dem Entfernen
  aus dem Ursprungseintrag.
- Taetigkeitsbericht-Namen 2026-06-12: Neue und aktualisierte
  Taetigkeitsbericht-PDFs verwenden keine abstrakten `DOK-0001`-Namen mehr,
  sondern suchbare Namen nach dem Muster
  `TB_Kundenname_Projektnummer_Leistungsdatum.pdf`, z.B.
  `TB_MÃ¼ller_Hausverwaltung_HAS-1_12.06.2026.pdf`. Woerter werden mit
  Unterstrichen getrennt; echte Umlaute bleiben im Dateinamen erhalten. Nur
  dateisystemkritische Zeichen wie `/ \ : * ? " < > |` und sonstige
  Sondertrennzeichen werden durch Unterstriche ersetzt. Bestehende alte
  `DOK-...`-Berichte muessen weiterhin als vorhandene Berichte erkannt werden,
  damit Aktualisierungen keine Duplikate erzeugen.
- Dokumente oeffnen 2026-06-12: Der `Oeffnen`-Button fuer hochgeladene
  Projektdokumente/Taetigkeitsberichte soll genau ein wiederverwendbares
  Browserfenster `workpilot-document-viewer` nutzen. Kein automatischer
  Download-Fallback, weil dieser je nach Windows-/Browser-Einstellung zusaetzlich
  Acrobat Reader starten kann.
- Taetigkeitsbericht-Fehler 2026-06-12: Fehler aus der
  Taetigkeitsbericht-Erstellung, z.B. fehlende Vorher-/Nachherbilder oder
  nicht einbettbare Bildformate, werden im Dokumente-/Taetigkeitsberichte-
  Bereich sichtbar als roter Hinweis direkt unter dem Kopfbereich angezeigt.
  Beim Wechsel von Projekt, Projektakten-Reiter, Dokumentordner oder
  Projektmonat wird dieser Hinweis zurueckgesetzt, damit eine Fehlermeldung
  aus einem anderen Monat nicht im neuen Kontext stehen bleibt.
- Projektfortschritt Taetigkeitsbericht 2026-06-12: Die obere
  Projektfortschrittsleiste enthaelt zwischen `Endkontr.` und `Rechnung` den
  Schritt `T-Bericht`. Dieser Schritt bekommt die Abschlussfarbe nur, wenn ein
  sichtbarer Taetigkeitsbericht im aktuellen Projekt-/Monatskontext tatsaechlich
  versendet wurde. Reines Erstellen/ Ablegen des PDFs reicht nicht. Versand
  zaehlt entweder als direkter `activityReport`-E-Mail-Versand oder als
  Taetigkeitsbericht-Anhang beim Rechnungsversand; in letzterem Fall wird
  zusaetzlich ein `activityReport`-Versandprotokoll geschrieben. Die
  Farbsegmente der Leiste sind auf acht Schritte abgestimmt.
- Projektfortschrittsleiste offene Schritte 2026-06-12: Unerfuellte und
  teilweise erfuellte Schritte (`open`/`partial`) sollen in der oberen
  Prozessleiste flach orange pulsieren, ohne Farbverlauf. Der Verlauf bleibt
  nur fuer abgeschlossene Schritte (`done`) erhalten.
- Projektzeitkontingente 2026-06-11: Die Monatszeilen zeigen im Status jetzt
  zusaetzlich Planungs-Chips (`voll verplant`, offene/ueberplante Stunden) und
  aktive Monatsrechnungen als `Fakturiert: RE-...`. Beruecksichtigt werden nur
  aktive Rechnungen des jeweiligen Projektmonats; Entwuerfe, Storno-,
  Stornorechnungen und geloeschte Rechnungen bleiben aus der Anzeige heraus.
  Die Soll-Zeit-/Kontingentlogik wurde nicht veraendert.
- UI-Designregel Clips 2026-06-11: Neue Status-/Hinweisclips sollen einheitlich
  als kompakte Pills gebaut werden: `border-radius: 999px`, ca. 26-28 px
  Mindesthoehe, kurze einzeilige Beschriftung, starke Schrift und ruhige
  Statusfarben. Gruen = erledigt/fakturiert/positiv, Gelb/Orange = offen oder
  Aufmerksamkeit, Rot = kritisch/Fehler/verloren, Blau = Info/Verknuepfung,
  Grau = inaktiv. Abgeschlossene Aussagen duerfen einen kleinen Haken links
  tragen; offene Hinweise nicht. Keine rechteckigen zweizeiligen Sonderclips
  mehr fuer neue UI-Ergaenzungen.
- Clip-Vereinheitlichung Paket 1 2026-06-11: In der Projektakte wurden
  `planningStatusPill`, `stampStatusPill` und `invoiceStatusDone` auf den
  gemeinsamen Pill-Standard gebracht. Das betrifft nur die Darstellung von
  Planungsstatus, Stempelstatus und `Fakturiert:`-Anzeige; Berechnung,
  Rechnungszuordnung und Stempelungslogik bleiben unveraendert.
- Clip-Vereinheitlichung Paket 2 2026-06-11: Aufgaben-Status- und
  Prioritaetsclips (`badge`, `status`, `priority`) wurden auf den gemeinsamen
  Pill-Grundstil mit Rahmen, Mindesthoehe und einheitlicher starker Schrift
  gebracht. Deadline-Pills bleiben bewusst eigenstaendige Komponenten, weil
  sie Fortschrittslogik und Zeitverlauf visualisieren.
- Projektakte Historie 2026-06-11: In `Termine & Stempelungen` muessen
  Historieneintraege deutsch formatierte Datumswerte anzeigen und lange
  Kommentare/Notizen innerhalb der Karten umbrechen. Historienkarten duerfen
  nicht ueber den Spalten- oder Modulrahmen hinausragen.
- Automatische Abrechnung 2026-06-11: Die Projektakten-Maske zeigt
  Abrechnungsmonate sichtbar als deutsche Monatswerte wie `Mai 2026`, speichert
  intern aber weiter die technischen Month-Keys `yyyy-mm`. Die Vorlage-Karte
  wurde optisch gekapselt; Stapelabrechnungslogik, API-Werte und gespeicherte
  Felder wurden nicht veraendert.
- Stapelabrechnung 2026-06-11: Die automatische Stapelabrechnung nutzt fachlich
  nur noch die aktive Rechnung aus dem direkten Vormonat als Vorlage. Eine
  gespeicherte Projektvorlage, `autoBillingTemplateMode`, `autoBillingTemplate`,
  `autoBillingNetAmount` und `autoBillingVatRate` bleiben aus Gruenden der
  Daten-/Altkompatibilitaet erhalten, werden aber in der Projektakten-Maske und
  bei neuen Stapelabrechnungsentwuerfen nicht mehr als Quelle verwendet. Fehlt
  die direkte Vormonatsrechnung, wird das Projekt in der Stapelabrechnung
  blockiert und zur Pruefung markiert.
- Projektgewinn EK/VK-Aufteilung 2026-06-11: Artikel-/Leistungspositionen
  reichen die vorhandene Arbeitspositions-Markierung `isLaborPosition` jetzt
  verlaesslich in neue Angebots-/Rechnungspositionen durch. Die zweite
  Projektgewinn-Tabelle zeigt keine rein technische Fallback-Pruefliste mehr,
  sondern eine fachliche Aufteilung nach Material VK/EK, Lohn VK/EK und nicht
  zugeordnetem Umsatz. Die UI-Spalte heisst `Nicht zugeordneter Umsatz`, wird
  nur bei einem Wert groesser 0 angezeigt und erklaert per Hilfe-Icon, dass
  dieser Umsatz keiner Lohn- oder Materialposition sicher zugeordnet werden
  kann. Pakete werden anteilig ueber ihre Artikel- und
  Leistungsbestandteile verteilt; Freitext oder nicht klassifizierte
  Rechnungspositionen bleiben sichtbar unter `Nicht zugeordnet`. Geldwerte in
  den Projektgewinn-Tabellen sollen nicht zwischen Betrag und Eurozeichen
  umbrechen; Prozentwerte wie Marge und Leistungsgrad werden sichtbar mit
  Prozentzeichen ausgegeben.

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
  - Checklisten
  - Ausschreibungen (GAEB)
- Projektakten-Reiter 2026-06-11: `Material` und `Projektbeteiligte` werden in
  der Projektakte nicht mehr als eigene Reiter angezeigt. Die zugrunde
  liegenden Projektdaten/Felder bleiben erhalten; nur die Navigation wird
  verschlankt, weil die Punkte operativ aktuell nicht benoetigt werden.
- Projektbild-Benennung / Taetigkeitsbericht 2026-06-11: Neue Projektbilder
  werden beim Upload sprechend benannt, z.B. `Vorherbild_1_11.06.2026.jpg`,
  `Nachherbild_1_11.06.2026.jpg` oder `Objektbild_1_11.06.2026.jpg`. Das gilt
  nur fuer neue Uploads; Altbilder werden nicht umbenannt. Die
  Taetigkeitsbericht-Erstellung hat zusaetzlich eine technische Doppelklick-
  Sperre per Ref, damit ein schneller zweiter Klick keinen weiteren
  Erstellvorgang ausloest.
- Projektbild-Korrektur 2026-06-11: Hochgeladene Projektbilder koennen in der
  Projektakte einzeln geloescht oder zwischen `Objektbesichtigungen`,
  `Vorherbilder` und `Nachherbilder` verschoben werden. Die Funktion nutzt die
  bestehende Logbuch-Anhang-API und schreibt bei Verschiebungen einen
  Projektlogbuch-Historieneintrag. Bei Dauerlaeufern bleibt der Zielordner im
  gleichen Projektmonat, damit Bilder nicht versehentlich monatsuebergreifend
  wandern. Der Projektakten-Reiter `Bilder` zeigt einen normalen Zaehler mit
  der Gesamtzahl sichtbarer Projektbilder; Bildkarten-Aktionen sollen kompakt,
  aber voll lesbar bleiben.
- Projektakten-Aufgaben 2026-06-11: Der Reiter `Aufgaben` wird nicht mehr in
  die Unterpunkte `Offene Aufgaben` und `Erledigte Aufgaben` aufgeteilt. Die
  Projektakte fuehrt alle Projektaufgaben gemeinsam im Reiter `Aufgaben`; ein
  normaler Zaehler am Reiter zeigt die Gesamtanzahl. Erledigte Aufgaben bleiben
  in der Tabelle sichtbar und verschwinden nicht in einer separaten Navigation.
- Projektakten-Sidebar 2026-06-08: Aufklappbare Gruppen wie `Dokumente` haben
  einen eigenen Offen-/Geschlossen-Zustand. Klick auf
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
- Checklisten Wiederanschluss 2026-06-12: Projektakte > Checklisten zeigt wieder
  ein Cockpit. `Rauchmelder-Installationsnachweis` nutzt den vorhandenen
  Endpunkt `/api/smoke-detector-reports`, erzeugt ein PDF und legt es unter
  `Dokumente: Checklisten` ab. Alte Eintraege `Dokumente:
  Rauchmelder-Nachweise` werden bei Checklisten-Dokumenten mit angezeigt.
  `Rauchmelderpruefung` bleibt fachlich separat und wird nicht mit dem
  Installationsnachweis vermischt.
- Checklisten-Fachbereiche 2026-06-12: Das Checklisten-Cockpit ist nach
  `Arbeitsschutz`, `Brandschutz` und `Gefahrstoffe` strukturiert. Unter
  `Brandschutz` ist `Rauchmelder` der erste aktive Fachbereich mit
  `Installation`; `Pruefung` und die gemeinsame Melderliste sollen separat
  folgen. Neue Checklisten sollen in diese Fachbereiche einsortiert werden,
  statt wieder einen flachen Kartenstapel zu bilden.
- Checklisten-UI 2026-06-12: Die Fachbereichsuebersicht soll ruhig und
  listenartig bleiben: Suchfeld oben, pro Fachbereich nur Kopfzeile mit
  `+ Checkliste`, danach kompakte Auswahlzeilen. Keine grossen
  unterschiedlich hohen Kartenstapel fuer jede vorbereitete Checkliste.
  Fachbereiche sind standardmaessig zugeklappt und zeigen im Kopf, ob fuer
  diesen Bereich bereits Checklistennachweise abgelegt sind.
- Eigene Felder / Datenerfassungsbogen wurden unten aus Projekt entfernt.
- Projektdaten rechts weiss hinterlegt.
- Projekt-Header:
  - Zurueck zur Pipeline
  - Projektdaten links
  - rechts kompakte Aktionsbuttons
  - Update 2026-06-12: Der Projektaktenkopf nutzt einen dunklen, ruhigen
    Identitaetsbereich. Projektverantwortlicher und Statushinweise stehen als
    kompakte Chips im Kopf, echte Aktionen bleiben rechts als helle Buttons mit
    unveraenderten Funktionen. Keine neuen Aktionsbuttons ohne fachliche
    Funktion nur fuer die Optik ergaenzen.
  - Planungs- und Verkaufschancen-Chips im Projektkopf sind die fuehrenden
    Einstiege fuer diese Funktionen. Sie muessen die bestehende Dauerlaeufer-/
    Einmalprojekt-Logik (`projectPlanningButtonState`, `openProjectPlanningAction`)
    und den deaktivierten `Keine Verkaufschance`-Platzhalter behalten.
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
  - ZustÃ¤ndig
  - Statusdauer
  - Letzte Aktion
  - Aktion
- Aktionen in der Potenzialtabelle sollen platzsparend als Dropdown
  `Aktion auswÃ¤hlen` erscheinen.
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
- Warnclips wie `seit 3 Tg.` oder `Toleranz Ã¼berschritten`.
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
- Auswertungen > KuZu, frueher Sales-Hub > KuZu:
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
  `Ãƒ|Ã‚|Ã¢|ï¿½` in den betroffenen UI-Dateien laufen lassen.
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
  Projekte mit Angebotsplanung zeigen je Angebot eine kompakte Verbrauchsbox:
  Angebotsstunden, verplante Stunden, gebuchte Stunden aus den zugeordneten
  Stempelungen und Rest aus der Planung. Die Stempelungen werden nicht
  projektweit pauschal verteilt, sondern ueber die zugeordneten
  Planungseintraege des Angebots ermittelt. Einmalprojekte ohne Angebotsplanung
  behalten als Fallback die kompakte Gesamtprojekt-Ansicht mit `Gebucht (durch
  Stempelungen)`, `Rest` und Fortschrittsbalken. Bei Einmalprojekten keine
  Monats-/Gesamt-Dauerlaeuferkarte anzeigen.
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
- Encoding-Schutz 2026-06-09: Es gibt jetzt `npm.cmd run check:mojibake`
  (`scripts/check-mojibake.js`). Der Check durchsucht aktive Quellbereiche
  `src` und `prisma` nach typischen kaputten UTF-8-/Mojibake-Zeichen wie
  `Ãƒ`, `Ã‚`, `Ã¢` und Replacement-Zeichen. Nach UI-Textaenderungen soll dieser
  Check zusaetzlich zu `npx.cmd tsc --noEmit` und `git diff --check` laufen.
  Korrekturen bleiben gezielt; keine globale Datei-Neukodierung oder
  blindes Umschreiben ganzer Dateien. Fuer notwendige Altkompatibilitaet mit
  historisch kaputten Datenwerten Unicode-Escapes verwenden, damit im
  Quelltext keine sichtbaren Mojibake-Zeichen stehen.
- Mojibake-Baseline 2026-06-11: Der Mojibake-Check arbeitet jetzt mit
  `scripts/mojibake-baseline.json`. Der aktuelle Altbestand von 815 bekannten
  Trefferstellen ist eingefroren; `npm.cmd run check:mojibake` schlaegt nur
  noch fehl, wenn neue Mojibake-/Icon-Platzhalter oberhalb dieser Baseline
  hinzukommen. Wird eine Altstelle gezielt bereinigt, darf die Baseline erst
  nach bestandenen Regressions-/TypeScript-/Diff-Checks mit
  `npm.cmd run check:mojibake -- --update-baseline` aktualisiert werden.
  Diese Baseline ist kein Freibrief fuer kaputte UI-Texte, sondern ein
  Schutzgitter gegen neue Encoding-Schaeden waehrend der weiteren Entwicklung.
- Mojibake-Korrektur Paket 1 Projektakte 2026-06-11: Gezielt bereinigt wurden
  sichtbare Texte in der Projektakte rund um Angebots-/Dokumentleerstaende,
  Planung, Aufgaben, Stempelungen, Vorgabezeiten, automatische Abrechnung und
  Projektzeitkontingente. Dabei wurden auch Fragezeichen-Platzhalter wie
  `?berplant`, `?ffnen`, `Gesch?ftspapier` korrigiert, die nicht verlaesslich
  als klassische Mojibake-Zeichen erkannt werden. Keine globale
  Datei-Rekodierung und keine funktionale Ruecksetzung vorgenommen.
- Der Mojibake-Check prueft zusaetzlich verdÃ¤chtige `iconButton`-Platzhalter,
  bei denen nur ein Fragezeichen gerendert wird. Schliessen-/Aktionsbuttons
  sollen semantisch beschriftet sein (`aria-label`) und ein echtes Icon oder
  eine stabile HTML-Entity wie `&times;` verwenden, nicht ein rohes
  Fragezeichen als Ersatz.
- Rueckfall Terminmaske 2026-06-09: Nach der Encoding-Rekonstruktion waren
  Teile der Planungsmaske wieder auf altem Stand (`Wiederholung`,
  `Wochenenden ueberspringen`, vorbefuellte Freitexte). Wiederhergestellt:
  `Terminserie anlegen`, Intervall plus anklickbare Wochentage,
  `Serienende`, leere Pflichtfelder fuer Titel/Beschreibung und echte
  Mitarbeiterauswahl mit orange pulsierendem Pflichtfeldrahmen. Diese Regeln
  gelten fuer normale Planung und Terminwunsch; bei Dauerlaeufern ist die
  Terminserie fachlich besonders relevant.
- Rueckfall-Reparatur Verkaufschancen / Angebotsplanung 2026-06-09:
  Nach der Mojibake-Rekonstruktion waren mehrere UI-/Logikstaende wieder
  aelter: `Verkaufschancen` hiess sichtbar wieder `Potenziale`, der
  `VC-xxxx` Nummernkreis fehlte technisch, die Verkaufschancen-Maske/
  Tabellenlogik war teilweise zurueckgefallen und die Einmalprojekt-
  Angebotsplanung verlor Marker wie `singleProjectOfferPlanningRows` und
  `planningEntryOfferId`. Wiederhergestellt wurden Verkaufschancen-Begriff,
  manuelle Verkaufschance, verknuepfte Nachfass-Aufgabe, VC-Nummer in
  Schema/API, projektweite Angebots-Planungsleisten fuer Einmalprojekte und
  das Respektieren des uebergebenen Aufgabenstatus beim Anlegen.
- Regressionsschutz 2026-06-09: Es gibt jetzt
  `npm.cmd run check:regressions` (`scripts/check-regressions.js`). Der Check
  prueft zentrale Entwicklungsmarker, die nicht unbemerkt verschwinden
  duerfen: Verkaufschancen-Begriff, manuelle Verkaufschance, VC-Nummer,
  Nachfass-Aufgaben-Verknuepfung, Einmalprojekt-Angebotsplanung,
  Terminserie/Pflichtfeld-Pulsierung, ProjectPotential-Nummer und Tasks-API-
  Status beim Anlegen. Wenn der Check fehlschlaegt, nicht einfach
  weiterarbeiten oder Marker entfernen. Erst mit dem Nutzer klaeren, ob der
  Verlust fachlich gewollt ist; nur mit ausdruecklicher Freigabe darf ein
  Marker angepasst oder entfernt werden.
- Nachkorrektur Regressionsschutz Planung 2026-06-09: Der erste
  Regressionscheck war fuer Einmalprojekt-Angebotsplanung zu grob. Er prueft
  jetzt zusaetzlich, dass `+ Termin`, `+ Terminwunsch` und
  `Planung bearbeiten` bei Einmalprojekten mit Angebotsstunden die
  Angebotszuordnung zeigen koennen. Technische Marker dafuer sind
  `shouldShowPlanningOfferAssignment`, `entryProjectHasOfferPlanning`,
  `Zuordnung Angebot` und `Kontingent vorbereitet`. Beim Bearbeiten eines
  vorhandenen Planungseintrags wird ein Einmalprojekt mit finalem Angebot und
  Arbeitsstunden wieder als Angebotsplanung behandelt, auch wenn der alte
  Eintrag noch keine gespeicherte Angebotsreferenz hatte.
- Nachkorrektur Planungsdatum 2026-06-09: Neue Planungstermine aus
  `+ Termin` und `+ Terminwunsch` starten ohne explizit uebergebenes Datum
  wieder mit dem aktuellen Tag, nicht mit dem zuletzt im Planungsboard
  ausgewaehlten `selectedPlanningDateKey`. Die bestehende Warn-/Bestaetigungs-
  logik fuer Einmalprojekte bleibt unveraendert: Weicht der Planungstermin vom
  Angebots-Ausfuehrungsmonat ab, muss der Nutzer bestaetigen; danach wird der
  Ausfuehrungsmonat am Angebot und damit die Forecast-Zuordnung aktualisiert.
- Nachkorrektur Planungsboard-Start 2026-06-09: Der normale Einstieg ins
  Planungsboard und der Button `Heute` setzen sowohl den sichtbaren
  Planungszeitraum als auch den ausgewaehlten Planungstag auf den aktuellen Tag.
  Gezielte Spruenge `Zur Planung` bleiben davon unberuehrt und duerfen weiterhin
  einen konkreten Termin-Tag oeffnen. Dadurch bleibt der 18.05. oder ein anderer
  alter Arbeitstag nicht mehr als Startdatum fuer neue normale Planungen haengen.
- Nachkorrektur Artikel-/Leistungstabelle 2026-06-09: Die Kataloglisten fuer
  Artikel, Leistungen und Pakete gehoeren optisch zur bestehenden
  Standard-Tabellenfamilie (`tableCard`/`table`) und nicht zur
  Kontakt-Sondertabelle. Der Kopf bleibt dunkel, Zeilen sind flach mit klaren
  Rasterlinien, Status wird als Clip angezeigt und Aktionsbuttons bleiben
  kompakt. Die Aktionsspalte muss breit genug fuer drei Buttons bleiben; Button-
  text wird mittig ausgerichtet und Header-Trennlinien bleiben hell sichtbar.
  Der Regressionscheck prueft diesen Marker, damit die Ansicht nicht unbemerkt
  wieder in ein abweichendes Tabellenlayout zurueckfaellt.
- Nachkorrektur Zeiteintrag-Datum 2026-06-09: In den Masken
  `Zeiteintrag bearbeiten` und `Zeiteintrag hinzufuegen` nutzt das Datum
  dasselbe native Tagesdatumsfeld wie die Planungsmaske (`type=date` mit
  Kalenderbutton). Intern bleibt die Speicherung unveraendert im normalisierten
  Date-Key `yyyy-mm-dd`; Logbuch und Bearbeitungshistorie formatieren die
  Anzeige wieder deutsch. Datums-/Uhrzeitfelder bleiben von dieser
  Vereinheitlichung bewusst ausgenommen.
- Nachkorrektur Einmalprojekt-Seitenleiste 2026-06-09: Die Box
  `Restlaufzeit bis Projektende` bleibt Dauerlaeufer-Projekten vorbehalten,
  weil sie auf Projektlaufzeit, Endphase und Projektende basiert. Einmalige
  Projekte zeigen stattdessen `Ausfuehrungsplanung` mit projektweiter Sicht auf
  Ausfuehrungsmonat(e), naechsten Planungstermin und Planungsstand. Stunden-
  und Restwerte nicht dort doppeln; diese gehoeren in die Angebotsleisten und
  die Verbrauchsboxen je Angebot. Diese Logik darf nicht an die Monatsakte
  gekoppelt werden; Einmalprojekte bleiben projektweit. Der Regressionscheck
  prueft den sichtbaren Marker `AusfÃ¼hrungsplanung`.
- Nachkorrektur Planungsleisten-Klick 2026-06-09: Die gruenen/orangen
  Planbar-Badges in den Planungsleisten sind bewusst klickbare Arbeits-
  Einstiege. Bei noch nicht geplanter Leiste oeffnet ein kleines Menue mit
  `+ Termin` und `+ Terminwunsch`; bei Einmalprojekten wird das jeweilige
  Angebot direkt vorbelegt. Sobald eine Leiste teilweise oder voll geplant ist,
  fuehrt der Klick in die bestehende Planung: ein einzelner Termin oeffnet
  direkt `Planung bearbeiten`, mehrere Termine zeigen zuerst eine kleine
  Terminauswahl. Klicks ausserhalb der kleinen Leistenmenues schliessen diese
  wieder. Dauerlaeufer nutzen dieselbe Bedienlogik auf den aktuell gewaehlten
  Projektmonat bezogen.
- Nachkorrektur Prozessleiste TerWu 2026-06-09: Bei Einmalprojekten mit
  mehreren Angeboten darf der Schritt `TerWu` nicht mehr erledigt sein, nur weil
  irgendwo im Projekt ein Termin oder Terminwunsch existiert. Der Schritt wird
  angebotsbezogen bewertet: Jedes finale Angebot mit Arbeitsstunden muss
  mindestens einen zugeordneten Termin/Terminwunsch haben. Sind nur einzelne
  Angebote bedient, bleibt `TerWu` teilweise/orange. Dauerlaeufer behalten die
  Monats-/Kontingentlogik des aktuell ausgewaehlten Projektmonats.
- Angebot verloren 2026-06-09: Angebote koennen mit Pflichtgrund als
  `Verloren` markiert werden. Der Grund, eine optionale Notiz und der Zeitpunkt
  werden am Angebot gespeichert und in der Angebotshistorie/Projektlogbuch
  dokumentiert. Verlorene Angebote bleiben als Dokument sichtbar, duerfen aber
  nicht mehr als aktive Planungsgrundlage, Rechnungsvorlage oder Forecast-Chance
  zaehlen. Die zentrale UI-Logik nutzt dafuer `isActiveFinalOffer`; diese Logik
  nicht durch pauschale Filter wie `status !== "Entwurf"` ersetzen. Bereits
  fakturierte/verknuepfte Angebote duerfen nicht nachtraeglich als verloren
  markiert werden, weil das Rechnung und Auswertung widerspruechlich machen
  wuerde. Versehentlich verlorene Angebote koennen ueber `Verlust
  zuruecknehmen` wieder als `Erstellt` aktiviert werden; dabei werden die
  Verlustfelder geleert und Historie/Projektlogbuch geschrieben. Diese
  Ruecknahme ist bewusst explizit, damit Planung und Forecast nachvollziehbar
  wieder auf das Angebot reagieren.
- Folgeentscheidung Angebot verloren 2026-06-09: Wenn in einem Einmalprojekt
  alle nicht geloeschten finalen Angebote als verloren markiert sind, darf die
  Projektakte nicht mehr so wirken, als seien TerWu/Planung erledigt. In diesem
  Zustand zeigt der Projektkopf `Kein aktives Angebot`, der Klick springt in
  den Angebotsordner, TerWu/Planung bleiben offen und die Terminansicht erklaert
  die fehlende aktive Angebotsgrundlage. Verlorene Angebote bleiben sichtbar,
  bekommen Status-Clip, Pflichtgrund und bei vorhandener Notiz einen kompakten
  Kommentar-Clip. Forecast, Planungsleisten und Verbrauchsboxen duerfen weiter
  nur aktive finale Angebote nutzen.
- Nachkorrektur Angebot verloren 2026-06-09: Der Kommentar zum verlorenen
  Angebot ist Pflicht, nicht optional. UI und Offers-API muessen beide
  verhindern, dass ein Angebot nur mit Grund, aber ohne Kommentar als verloren
  gespeichert wird. Ist ein Angebot technisch mit einer finalen Rechnung
  verknuepft, darf `Angebot verloren` weiterhin nicht angeboten/ausgefuehrt
  werden; in diesem Fall ist die Rechnung die belastbare kaufmaennische
  Entscheidung und der Verlust waere fachlich widerspruechlich.
- Projektkopf-Aktionsraster 2026-06-09: Der Verkaufschancen-/Zusatzverkauf-
  Button bleibt im Projektkopf immer als Rasterplatz erhalten. Wenn keine
  Verkaufschance vorhanden ist, zeigt er deaktiviert `Keine Verkaufschance`.
  Dadurch bleiben Dauerlaeufer- und Einmalprojekt-Koepfe in Hoehe und
  Button-Anordnung konsistent. Nur bei echtem `projectUpsellState` darf der
  Button aktiv sein und die Verkaufschancen-Aktion oeffnen.
- Nachkorrektur Rechnungshistorie 2026-06-09: Die Rechnungshistorie in der
  Projektakte darf nicht als einfache Inline-Span-Liste gerendert werden. Sie
  nutzt wie die Angebotshistorie das Standard-Historiendesign
  `planningHistorySection` / `planningHistoryList` mit separaten Eintraegen fuer
  Titel, Datum/Akteur und Notiz. Das gilt fuer Dauerlaeufer und Einmalprojekte.
- Projektgewinn 2026-06-10: Die Projektakte hat den Reiter `Projektgewinn`.
  Die fuehrende Bezeichnung in der UI ist `Finaler Projektgewinn`, aber mit
  einem eigenen Status pro Auswertung: `final`, wenn alle verwendeten
  Rechnungspositionen und Stempelungen gespeicherte Kostensnapshots haben,
  sonst `vorlaeufig`. Umsatz kommt aus finalen, nicht geloeschten Rechnungen;
  stornierte Rechnungen und Stornorechnungen zaehlen nicht in den
  Projektgewinn. Materialkosten werden beim Speichern/Fakturieren der
  Rechnungsposition als `materialUnitCostSnapshot` und `materialCostSnapshot`
  festgeschrieben. Lohnkosten werden beim Speichern/Stoppen von
  Projekt-Stempelungen als `laborCostRateSnapshot` und `laborCostSnapshot`
  festgeschrieben; beim Verknuepfen alter Stempelungen mit einer Rechnung wird
  ein fehlender Snapshot defensiv nachgefuellt. Einmalprojekte zeigen
  projektweit, Dauerlaeufer zeigen den ausgewaehlten Projektmonat plus
  Gesamtprojekt. Altbestand ohne Snapshot bleibt sichtbar und nutzt aktuelle
  Werte als Fallback, wird aber als `vorlaeufig` markiert.
- Projektgewinn-Stornohinweis 2026-06-10: Wenn ein betrachteter
  Projektgewinn-Bereich keine aktive Rechnung mehr hat, aber eine stornierte
  Rechnung oder Stornorechnung im selben Bereich existiert, zeigt der Status
  nicht nur pauschal `vorlaeufig`, sondern `vorlaeufig - Rechnung storniert /
  keine aktive Rechnung`. So bleibt nachvollziehbar, warum ein zuvor finaler
  Bereich nach Storno wieder offen ist.
- Projektgewinn-Dauerlaeufer 2026-06-10: Bei Dauerlaeuferprojekten darf der
  ausgewaehlte Monat eigenstaendig final werden, sobald Rechnung und
  Kostensnapshots vollstaendig sind. Das `Gesamtprojekt` darf aber erst nach
  erreichtem Projektlaufzeitende final werden. Vorher wird ein ansonsten
  snapshot-sauberer Gesamtwert als `vorlaeufig - Projektlaufzeit noch nicht
  abgeschlossen` markiert; fehlt das Projektende, als `vorlaeufig -
  Projektende nicht festgelegt`.
- Altbestand-Abgleich Projektgewinn 2026-06-10: Bereits mit Rechnungen
  verknuepfte Stempelungen ohne Lohnkosten-Snapshot wurden einmalig und
  kontrolliert nachbefuellt, sofern ein technischer Mitarbeiterbezug und ein
  Mitarbeitersatz vorhanden waren. Vorher-/Nachher-Daten wurden unter
  `.codex-safety/db-before-20260610-backfill-linked-stamp-cost-snapshots.json`
  und
  `.codex-safety/db-after-20260610-backfill-linked-stamp-cost-snapshots.json`
  gesichert. Nicht automatisch befuellt werden Altzeilen ohne `userId` oder
  ohne passenden `EmployeeCostCalculation`-Datensatz; diese bleiben bewusst
  `vorlaeufig`, bis ein Kostensatz fachlich geklaert ist.
- Regressionsschutz Taetigkeitsbericht 2026-06-10: Der Button
  `Taetigkeitsbericht erstellen` in Projektakte > Dokumente >
  Taetigkeitsberichte ist eine wiederhergestellte Projektakten-Funktion und
  darf nicht wieder unbemerkt verschwinden. `npm.cmd run check:regressions`
  prueft jetzt den Buttontext, den Dokumentordner `Taetigkeitsberichte` und
  die Anbindung an `/api/activity-reports`. Bei fehlgeschlagenem Marker nicht
  blind entfernen, sondern erst fachlich klaeren.
- Erweiterter Regressionsschutz 2026-06-10: Kritische rekonstruierte
  Funktionen sollen nach Aufbau oder Reparatur mit stabilen Markern in
  `scripts/check-regressions.js` geschuetzt werden. Der Check prueft jetzt
  zusaetzlich Dauerlaeufer-Monatsakte, monatsbezogene Planung/Stempelungen,
  Projektbild-Normalisierung und Monatsablage, Taetigkeitsbericht-Bildauswahl,
  Rauchmelder/Checklisten, Endkontrolle, Leistungsdatum, Rechnungs-
  Stempelungsverknuepfung und Storno-Entkopplung. Keine Marker entfernen oder
  abschwaechen, nur damit der Check gruen wird; erst fachlich klaeren, ob die
  betroffene Funktion bewusst geaendert wurde.
- Sichtbare Logbuch-Mojibake 2026-06-10: Projektlogbuch-Texte koennen aus
  Altbestand noch kaputte UTF-8-Folgen enthalten. Diese werden in der Anzeige
  eng normalisiert, ohne Datenbankeintraege breit umzuschreiben. Neue
  Projektdaten-Logbucheintraege muessen korrekt `geÃ¤ndert` schreiben; feste
  UI-Hinweise wie `Dokumente fÃ¼r ...` werden direkt im Quelltext korrigiert.
- Mojibake-Korrektur Paket 1 Projektakte 2026-06-10: Sichtbare Texte in der
  Projektakte wurden gezielt korrigiert: Projektakten-Hilfetexte,
  Dokument-/Angebots-/Rechnungsbereiche, Aufgabenblock, Stempelungs- und
  Planungsansichten, Budget-/Kontingenttexte sowie der Rechnungsdialog aus der
  Projektakte. Altkompatibilitaetsvergleiche wie alter Rechnungsstatus
  `GelÃƒÂ¶scht` bleiben bewusst erhalten, damit historische Daten weiter erkannt
  werden. Keine globale Datei-Rekodierung vorgenommen.
- Mojibake-Logikkompatibilitaet 2026-06-11: Sichtbare Begriffe duerfen
  korrigiert werden, aber fachliche Logik darf nicht nur an einer Schreibweise
  haengen. Alte mojibake-belastete Werte und neue saubere Werte werden deshalb
  parallel erkannt, u.a. fuer Dauerlaeufer-Projektart, geloeschte Statuswerte
  und Taetigkeitsbericht-Dokumenttitel. Neue Werte sollen sauber geschrieben
  werden; historische Daten bleiben lesbar. Der Regressionscheck prueft diese
  Schutzmarker.
- Mojibake-Korrektur Paket 2 aktive Masken 2026-06-11: Gezielt bereinigt
  wurden sichtbare UI-Texte in Planungsmaske, Projektmaske,
  Verkaufschancenmasken, Zeiteintrags-/Stempelmaske und Aufgabenmaske. Es
  wurden nur Labels, Platzhalter, Hinweistexte und stabile Schliessen-Icons
  korrigiert; fachliche Statuswerte und Altkompatibilitaetslogik wurden nicht
  breit umgeschrieben. Die Mojibake-Baseline wurde nach bestandenen
  Regressionspruefungen entsprechend reduziert.
- Mojibake-Korrektur Paket 3 Projektakte 2026-06-11: Gezielt bereinigt wurden
  weitere sichtbare Texte im Projektakten-Kontext, vor allem Planungsbasis-
  Hinweise, Angebots-/Rechnungsdialoge, Monatsauswahl, Geschaeftspapier,
  Strasse, Erloese und Vorschau-Aktionen. Der Projektgewinn- und
  Projektseitenleisten-Code wurde geprueft; die Geldformatierung `formatMoney`
  gibt im Code ein korrektes Eurozeichen aus. Keine breite Daten- oder
  Statuslogik wurde geaendert.
- Mojibake-Korrektur Paket 4 haeufige UI-Bereiche 2026-06-11: Gezielt
  bereinigt wurden sichtbare Texte in haeufig genutzten Bereichen ausserhalb
  der Projektakte, vor allem Artikel & Leistungen, Kontakte/Aufgaben,
  Benutzermenue, Kalender-/Dokumentenuebersicht, Mitarbeiter-/Gewerk-
  Hinweise und Dokument-Mail. Auch hier wurden nur UI-Labels, Hinweise,
  Platzhalter und Aria-Beschriftungen korrigiert; keine Funktionslogik und
  keine fachlichen Datenwerte wurden breit umgeschrieben.
- Mojibake-Korrektur Paket 5 Mitarbeiter/Firmeneinstellungen 2026-06-11:
  Gezielt bereinigt wurden sichtbare Texte in Mitarbeiterakte und
  Firmeneinstellungen, u.a. `Uebersicht`, Signatur-Hinweis, Abwesenheits-
  Hinweis, Firmenanschrift, Gruendung, Gruenflaechen, Geschaeftsbereiche,
  Einheiten, Entwuerfe, Projektarten, Nummernkreise, Bundeslaender,
  Mailserver und E-Mail-Vorlagen. Die Baseline wurde nach bestandenen
  Regressions- und Mojibake-Checks von 647 auf 591 bekannte Altlasten
  reduziert. Keine globale Datei-Rekodierung und keine fachliche Logik-
  Aenderung vorgenommen.
- Mojibake-Korrektur Paket 6 Persoenlicher Bereich/Abwesenheiten 2026-06-11:
  Gezielt bereinigt wurden sichtbare Texte im persoenlichen Bereich, in
  Abwesenheitsantraegen, Team-Kalender, Planungsboard-Hinweisen,
  Mitarbeiter-Stempelungsuebersicht und Lohnkostenhinweisen. Neben Umlauten
  wurden auch kaputte Trennerpunkte und der sichtbare Platzhalter bei
  `Ã˜ Stunden pro Stempeltag` korrigiert. Die Baseline wurde nach bestandenem
  Regressionscheck von 591 auf 514 bekannte Altlasten reduziert. Keine
  Aenderung an Abwesenheits-, Planungs-, Stempelungs- oder Kostenlogik.
- Mojibake-Korrektur Paket 7 Content/Marketing 2026-06-11: Gezielt bereinigt
  wurden sichtbare Texte im Content-Management/Marketingbereich, u.a.
  Wochenplaene, Ampel-/Freigabehinweise, Marketingkontingente, Ideen-Feed,
  Korrektur-/Freigabeansichten, Kalenderhinweise und Trennzeichen. Ein
  technischer Statusvergleich auf historische Content-Statuswerte wurde bewusst
  nicht geaendert, um keine Datenkompatibilitaet zu brechen. Die Baseline wurde
  nach bestandenen Checks von 514 auf 475 bekannte Altlasten reduziert.
- Mojibake-Korrektur Paket 8 Auswertungen/Forecast/Abrechnung 2026-06-11:
  Gezielt bereinigt wurden sichtbare Texte in Dashboard-Kacheln,
  Auswertungen, Forecast-Ansichten und automatischer Abrechnung, u.a.
  Umsatz-/Projektuebersicht, Geschaeftsbereich-Tabellen, Dauerlaeufer-
  Hinweise, Forecast-Erklaerungen, Rechnungsentwuerfe und Pruefhinweise.
  Fachliche Vergleichs-/Datenwerte wie historische Status- oder
  Abrechnungsintervall-Strings wurden bewusst nicht breit umgeschrieben, damit
  Altkompatibilitaet erhalten bleibt. Die Baseline wurde nach bestandenen
  Checks von 475 auf 423 bekannte Altlasten reduziert.
- Mojibake-Korrektur Paket 9 Login/Kundenakte 2026-06-11: Gezielt bereinigt
  wurden sichtbare Texte im Login-/Startbereich und in der Kundenakte,
  u.a. ZustÃ¤ndigkeiten, ProjektstÃ¤nde, Anmeldung lÃ¤uft, AuftrÃ¤ge,
  Kundenlogbuch, RechnungsempfÃ¤nger, verknÃ¼pfte Projekte, ZusatzverkÃ¤ufe,
  Ã–ffnen, FÃ¤llig, PrioritÃ¤t und ZustÃ¤ndig. Es wurden nur UI-Texte und
  Logbuch-Beispieltexte korrigiert; keine Kundenakten-, Kontakt- oder
  Aufgabenlogik wurde geÃ¤ndert. Die Baseline wurde nach bestandenen Checks von
  423 auf 398 bekannte Altlasten reduziert.
- Mojibake-Korrektur Paket 10 Admin/Aufgaben/Kalender 2026-06-11: Gezielt
  bereinigt wurden sichtbare Texte in Team-/Eskalationseinstellungen,
  Aufgabenlisten, KalenderÃ¼bersicht, Firmendaten-/Gewerkdialog,
  Kontakt-Gruppenaktion, RechnungsempfÃ¤nger-Feldern, Abwesenheits-Ãœbergabe
  und Passwortdialog. Technische KompatibilitÃ¤tswerte wie alte Rollen- oder
  Statusschreibweisen wurden nicht breit umgeschrieben. Die Baseline wurde
  nach bestandenen Checks von 398 auf 334 bekannte Altlasten reduziert.
- Mojibake-Korrektur Paket 11 Content-Endblock/DISG 2026-06-11: Gezielt
  bereinigt wurden sichtbare Texte im Content-Bearbeitungsdialog sowie im
  DISG-/Mitarbeiterentwicklungsbereich, u.a. nachtrÃ¤gliche Bearbeitung,
  VerÃ¶ffentlichung, Korrektur nÃ¶tig, kaufmÃ¤nnische Daten,
  SelbsteinschÃ¤tzung, FremdeinschÃ¤tzung, GesprÃ¤chspunkte,
  EntwicklungsmaÃŸnahmen, UnterstÃ¼tzung und ÃœberprÃ¼fungstermin. Der Statuswert
  `gruen` blieb als technischer Optionswert erhalten; korrigiert wurde nur die
  sichtbare Beschriftung. Die Baseline wurde nach bestandenen Checks von 334
  auf 260 bekannte Altlasten reduziert.
- Mojibake-Korrektur Paket 12 Konstanten/Fragebogen/Meldungen 2026-06-11:
  Gezielt bereinigt wurden sichtbare Standardtexte, E-Mail-Vorlagen,
  Katalogeinheiten, Feiertagsnamen, DISG-Fragen, Profilbeschreibungen,
  Mitarbeiter-EinschÃ¤tzungsfragen sowie Angebots-/Rechnungs-/Kontakt- und
  Dokument-Mail-Meldungen. Status-, Intervall- und Regex-KompatibilitÃ¤tswerte
  mit Alt-Mojibake wurden bewusst noch nicht breit geÃ¤ndert; sie werden nur in
  einem eigenen KompatibilitÃ¤tsblock angefasst, damit historische Daten und
  Filterlogiken nicht unbemerkt brechen. Die Baseline wurde nach bestandenen
  Checks von 260 auf 106 bekannte Altlasten reduziert.
- Mojibake-Korrektur Paket 13 Laufzeitmeldungen/Logtexte 2026-06-11:
  Gezielt bereinigt wurden sichtbare Laufzeitmeldungen, Warnungen,
  BestÃ¤tigungsdialoge, Logtexte und Hinweise in GeschÃ¤ftsbereichs-,
  Logbuch-, Abwesenheits-, Planungs-, Verkaufschancen-, Stempelungs-,
  Aufgaben-, Mitarbeiter-, Team-/Gewerk-, Druck-/PDF-, Forecast-,
  Import- und Dokument-Mail-Bereichen. Der lokal berechnete Anzeigenstatus
  `PrÃ¼fen` wurde inklusive Vergleichsstelle korrigiert. Verblieben sind nur
  Status-, Intervall- und Regex-KompatibilitÃ¤tswerte wie alte Content-,
  Pipeline- und Abrechnungswerte; diese dÃ¼rfen nur in einem eigenen
  KompatibilitÃ¤tsblock geÃ¤ndert werden. Die Baseline wurde nach bestandenen
  Checks von 106 auf 29 bekannte Altlasten reduziert.
- Mojibake-Korrektur Paket 14 KompatibilitÃ¤tswerte 2026-06-11:
  Die verbliebenen Status-, Intervall- und Regex-Mojibake-Stellen wurden
  bereinigt. Neue sichtbare und neu geschriebene Werte sind sauber, u.a.
  `Korrektur nÃ¶tig`, `VerÃ¶ffentlicht`, `Lead / KlÃ¤rung`, `DauerlÃ¤ufer-Faktura`,
  `jÃ¤hrlich` und `wÃ¶chentlich`. Alte gespeicherte Mojibake-Werte werden
  weiterhin Ã¼ber Normalisierer oder Unicode-Escape-KompatibilitÃ¤tsvergleiche
  erkannt, damit historische Content-, Pipeline-, Rollen- und Abrechnungsdaten
  nicht aus Filtern oder Auswertungen fallen. Der Mojibake-Check steht nach
  bestandenen Checks auf 0 bekannte Altlasten.
- Stempelungs-Suche 2026-06-15: In `Persoenliche Daten > Stempelungen` und
  `Mitarbeiter > Zeiterfassung` gibt es eine Projekt-/Kundensuche plus
  Volltextsuche ueber Stempelungsdaten, Projektbezug und Kommentare. Die
  Filter grenzen nur die Tabellenanzeige ein; Zeit-Summen und KPI-Karten
  bleiben auf Basis des gewaehlten Zeitraums berechnet. Die persoenliche
  Stempelungsansicht hat dafuer denselben Zeitraumkopf wie die Mitarbeiterakte
  und startet bewusst in der Jahresansicht.
- Unproduktive Stempelungen 2026-06-15: Unproduktive Zeiten sind nicht mehr nur Sammelwert Unproduktiv; beim Start oder Wechsel muss eine konkrete unproduktive Taetigkeit ausgewaehlt oder eingetragen werden. Die Bezeichnung wird ueber projectLabel gespeichert und in aktiver Stempelung, Team-Live und Zeittabellen angezeigt. Wechsel von unproduktiv zu unproduktiv ist erlaubt.
- Stempelung Tagesplanung 2026-06-15: Beim Starten oder Wechseln einer Stempelung wird die bestaetigte Tagesplanung des angemeldeten Mitarbeiters vorgeschlagen. Der naechste sinnvolle Termin wird hervorgehoben; Klick uebernimmt Projekt oder Taetigkeit, aber keinen Kommentar. Die Auswahl ist nur Vorschlag: anderes Projekt und unproduktive Taetigkeit bleiben jederzeit moeglich. Termine ohne Projekt werden als unproduktive Taetigkeit vorbelegt.
- Stempelmaske Aufraeumung 2026-06-15: Die Tagesplanung in der Stempelmaske zeigt nur den empfohlenen Termin direkt; weitere Termine sind einklappbar. Die Projektsuche wird erst nach Klick auf Anderes Projekt angezeigt. Unproduktiv bleibt als separater Weg sichtbar.
- Stempelung Kommentar 2026-06-15: Ein Klick auf einen geplanten Termin waehlt nur Projekt/Termin vor. Das Pflichtfeld Was machst du gerade? bzw. Was machst du als Naechstes? bleibt leer und muss vom Mitarbeiter selbst beschrieben werden.
- Planungsboard Stempel-Fortschritt 2026-06-15: Die Tagesplanung zeigt am aktuellen Datum keinen allgemeinen Live-Zeitbalken. Stattdessen bekommt nur der Terminbalken eine Fortschrittsfuellung, dessen Projekt/Taetigkeit zur aktiven Stempelung des Mitarbeiters passt. Der Fortschritt berechnet sich aus gestempelter Zeit im Verhaeltnis zur geplanten Terminlaenge; andere Termine bleiben unveraendert.
- Planungsboard aktive Mitarbeiter 2026-06-15: Tagesplanung und Terminanlage zeigen nur aktive Mitarbeiter. Inaktive Mitarbeiter werden nicht mehr als Zeile oder automatische Vorbelegung angeboten; bestehende historische Planungseintraege bleiben unveraendert in den Daten erhalten.
- Planungsboard Farblogik 2026-06-15: Feste bestaetigte Termine sind blau, Terminwuensche sind hellgrau mit gelbem pulsierendem Rand, Pausen grau, abgeschlossene Stempelungen auf einem Termin gruen, aktive Stempelungen zeigen den bekannten Verlauf innerhalb des passenden Terminbalkens. Abwesenheiten und Konflikte behalten ihre bestehende Sonderdarstellung.
- Stempelung Termin-Vorschlag 2026-06-15: Beim Starten/Wechseln wird nur ein aktuell laufender oder zukuenftiger offener bestaetigter Tagestermin vorgeschlagen. Sind alle heutigen Termine vorbei, gibt es keinen automatischen Vorschlag mehr; die Tagestermine bleiben aber einsehbar. In der Stempelmaske tragen Tagestermine Statuslabels `Aktiv`, `Erledigt`, `Offen` oder `Vorbei`. Bereits erledigte Termine werden nicht erneut als naechster Vorschlag genutzt.
- Phase-2-Audit Kundenfeedback 2026-06-20: Interne Kundenfeedback- und Feedback-Request-Wege wurden mit zentralen Rollenregeln abgesichert. Lesen, manuelles Erfassen und Feedback-Anfragen sind fuer Admin, Geschaeftsfuehrung, Fuehrungskraft, Vertrieb und Buchhaltung erlaubt; Loeschen bleibt Geschaeftsfuehrung. Der oeffentliche Token-Weg `public-feedback/[token]` bleibt bewusst ohne internen Actor, damit Kunden ohne Anmeldung antworten koennen. Beim Rechnungsversand wird die automatische Feedback-Link-Suche jetzt organisationsgebunden.
- Phase-2-Audit News/Benachrichtigungen 2026-06-20: News-Sichtbarkeit wurde in `src/lib/news-feed/visibility.ts` zentralisiert und fuer Laden, Gelesen-Markierung, Kommentare, Reaktionen und Abstimmungen genutzt. Interaktionen sind nur noch fuer Beitraege erlaubt, die der aktive Benutzer sehen darf. Der freie Notification-POST verlangt jetzt einen aktiven Actor; neue Benachrichtigungen erzeugen duerfen Admin, Geschaeftsfuehrung, Fuehrungskraft und Buchhaltung. Die automatische Abrechnungsbereit-Meldung sendet den Actor aus dem Dashboard mit.
- Phase-2-Audit Abwesenheiten/Planung 2026-06-20: Abwesenheits-Manager-Regel wurde zentralisiert. Abwesenheiten und Planungsboard verlangen jetzt auch beim Lesen einen aktiven Actor; Dashboard-Loads senden `activeUserId` mit. Abwesenheits-Schreibwege nutzen die zentrale Regel, Ziel-/Vertreter-/Benachrichtigungsempfaenger werden auf aktive Benutzer begrenzt. Planungsbenachrichtigungen pruefen vorhandene Duplikate organisationsgebunden. Fachliche Leseeinschraenkung nach Rolle wurde bewusst noch nicht eingefuehrt, um Kalender- und Board-Workflows nicht zu verengen.
- Phase-2-Audit Ideen/Content/Abrechnungswarnungen 2026-06-21: Ideen-Store, Content-Altbereich und offene Abrechnungszeit-Warnungen verlangen jetzt aktive Actors ohne Demo-Fallback. Ideen sind fuer Gaeste gesperrt; Anheften ist auf Admin, Geschaeftsfuehrung und Fuehrungskraft begrenzt. Content-Verwaltung ist auf Admin, Geschaeftsfuehrung und Fuehrungskraft begrenzt. Abrechnungszeit-Warnungen lesen/ausloesen duerfen Admin, Geschaeftsfuehrung, Fuehrungskraft und Buchhaltung. Dashboard-Aufrufe senden den Actor mit bzw. brechen ohne aktiven Benutzer sauber ab. Content bleibt bewusst als Legacy-/Altbereich dokumentiert.
- Phase-2-Abschluss Rechte-Quercheck 2026-06-21: Marketing-Content verlangt jetzt aktive Actors. Kontingent-Konfiguration ist auf Admin/Geschaeftsfuehrung begrenzt; operative Marketing-Content-/Planungsaktionen sind auf Admin/Geschaeftsfuehrung/Fuehrungskraft begrenzt. Monatsberichtswerte schreiben nutzt die bestehende Rechnungs-/Buchhaltungsberechtigung. Typische Demo-Fallback-Muster wurden erneut gesucht; keine neuen Treffer. Phase 2 gilt fuer die priorisierten Rechte-/Actor-Luecken als abgeschlossen; groessere Restthemen sind Architektur-/Produktentscheidungen.
- Phase-2-Stabilisierung 2026-06-21: Frischer Testserver auf Port 3002 lud `/` und `/dashboard` mit HTTP 200. API-Smoke-Tests fuer Ideen, Content, Abrechnungswarnungen, Marketing-Content und Monatsfinanzbericht lieferten erwartete Schutzantworten: 401 ohne Actor, 403 fuer unberechtigte Rollen, 400 fuer fachlich ungueltige berechtigte Eingaben. Der alte 500er auf Port 3001 lag am alten laufenden Serverprozess, nicht am aktuellen Code.
- Phase-3-Start Kontaktloeschung 2026-06-21: Kontaktanlage/-bearbeitung ist serverseitig auf Admin, Geschaeftsfuehrung, Fuehrungskraft, Vertrieb und Buchhaltung begrenzt. Endgueltiges Kontaktloeschen ist auf Admin/Geschaeftsfuehrung begrenzt und wird mit HTTP 409 blockiert, wenn Projekte, Unterkontakte, aktive Kundenhinweise, Potenziale, Verkaufschancen, Sales-Ziele, Feedbacks oder Winterdienstlaeufe auf den Kontakt zeigen. UI bricht Kontaktaktionen ohne aktiven Benutzer ab. API-Smoke-Test bestaetigte 401/403/409/200-Verhalten inklusive Cleanup.
- Phase-3 Projektpflege/Archivierung 2026-06-21: Projektanlage/-bearbeitung ist serverseitig auf Admin, Geschaeftsfuehrung, Fuehrungskraft und Vertrieb begrenzt; Archivierung ueber Status `Archiviert` ist auf Admin/Geschaeftsfuehrung/Fuehrungskraft begrenzt. Projekt-Kontakt-IDs werden gegen Kontakte derselben Organisation validiert, inklusive grober Hauptkontakt-Zuordnung fuer Ansprechpartner/Adresskontakt. Es gibt weiterhin keinen harten Projekt-DELETE; Archivierung erhaelt Belege, Zeiten, Aufgaben, Hinweise, Dokumente und Logbuchdaten.
- Phase-3 Projektlogbuch/Anhaenge 2026-06-21: Projektlogbuch-Schreibwege validieren jetzt Projekt/Organisation und Archivstatus. Normale Eintraege/Uploads bleiben fuer aktive Nicht-Gast-Benutzer moeglich. Anhang-Verschieben/-Loeschen ist auf Projektverwaltungsrollen oder den urspruenglichen Autor begrenzt. Archivierte Projekte blockieren normale Logbuch- und Anhangveraenderungen. API-Smoke-Test bestaetigte 401/201/403/200-Verhalten inklusive Testdaten-Cleanup.
- Phase-3 Anhanggroessen/Data-URL-Schutz 2026-06-21: Projektlogbuch-Anhaenge haben serverseitig 12 MB pro Datei und 48 MB pro Eintrag als Grenze. Erlaubt sind uebliche Bildformate sowie PDF, Word, Excel, CSV und TXT; ungueltige Data-URLs und unerlaubte Typen werden blockiert. Die Dashboard-Uploadwege pruefen dieselben Grenzen vor dem Senden. API-Smoke-Test bestaetigte 413 fuer zu grosse Datei, 400 fuer unerlaubten Typ und 201 fuer kleine erlaubte Datei inklusive Cleanup.
- Phase-3 Berichtsendpunkte/Data-URL-Direktpfade 2026-06-21: Taetigkeitsberichte und Rauchmelderberichte verlangen jetzt aktiven Actor, Logbuch-Schreibrecht und respektieren archivierte Projekte. Direkt erzeugte PDF-Anhaenge werden auf 12 MB begrenzt; Rauchmelderbilder werden vor der PDF-Erstellung auf Typ, Data-URL-Format, 12 MB pro Bild und 48 MB pro Nachweis begrenzt. API-Smoke-Test bestaetigte 401 ohne Actor, 413 fuer zu grosses Rauchmelderbild und 403 auf archiviertem Projekt inklusive Cleanup.
- Phase-3 Abschluss-Quercheck Logbuch/Data-URL 2026-06-21: Direkte Logbuch- und Data-URL-Speicherpfade wurden erneut gesucht. Winterdienst-Einsaetze waren der relevante Restpfad und verlangen jetzt aktiven Actor, Logbuch-Schreibrecht, gueltiges Projekt und Archivschutz. Winterdienstbilder sind auf erlaubte Bildtypen, gueltige Data-URLs, 12 MB pro Bild und 48 MB pro Einsatz begrenzt; erzeugte Winterdienst-PDFs auf 12 MB. API-Smoke-Test bestaetigte 401/413/201/403 inklusive Cleanup.
- Phase-3-Abschluss 2026-06-21: Phase 3 gilt fuer priorisierte Referenz-, Archiv-, Logbuch- und Anhangschutzrisiken als abgeschlossen. Komplettes Audit ca. 76-78%, kritische Rechte-/Crash-/Datenverlustschutzthemen ca. 90-92%. Offene Punkte sind jetzt vor allem Architektur-/Produktentscheidungen: echte Session statt request-basierter actorId, Datei-/Objektspeicher statt Data-URL-JSON, Migrationen statt Runtime-DDL, globales Archivierungs-/Loeschmodell und finaler Stabilitaets-/UI-Smoke.
- Stabilitaets-/Performanceblock Logbuch-Startladung 2026-06-21: Globale `project-logbook-entries?summary=1` liefert jetzt leichte Metadaten ohne `dataUrl`; Dashboard-Start nutzt diese Summary. Projektbezogene Detailabfragen laden weiterhin volle Anhaenge. Lokaler API-Smoke-Test mit 257 Eintraegen reduzierte die globale Antwort von ca. 32 MB auf ca. 117 KB, Summary ohne `dataUrl`; Build/Prisma/Mojibake/Regression bestanden.
- Stabilitaets-/Performanceblock Dokument-Mail-Uebersicht 2026-06-21: Globale Dokument-Mail-Historie wird beim Dashboard-Start mit `limit=500` geladen; die API erzwingt fuer globale Abfragen Standard 500/maximal 1000. Projektbezogene Historie bleibt vollstaendig. Build/Prisma/Mojibake/Regression bestanden; lokaler API-Smoke auf Port 3002 lieferte HTTP 200 bei leerer lokaler Historie.
- Stabilitaets-/Performanceblock Angebots-/Rechnungslisten 2026-06-21: Listenabfragen fuer Angebote und Rechnungen verwenden jetzt konkrete Spalten statt `SELECT *`; gespeicherte PDF-Base64-Daten werden dabei nicht mehr aus der DB mitgelesen. `pdfAvailable` bleibt erhalten, PDF-Abruf per `pdfId` unveraendert. Build/Prisma/Mojibake/Regression und lokaler API-Smoke auf Port 3002 bestanden.
- Stabilitaets-/Rechteblock Projektzeiten-Lesen 2026-06-21: `project-time-entries` GET verlangt jetzt `actorUserId`; ohne Actor 401, Managerrollen sehen alle Zeiten, normale Benutzer nur eigene Zeiten. Dashboard sendet den aktiven Benutzer mit und laedt beim aktiven Benutzerwechsel erneut. Mitarbeiter-Emulation bleibt dadurch als eingeschraenkte Mitarbeitersicht erhalten. Build/Prisma/Mojibake/Regression und API-Smoke auf Port 3002 bestanden.
- Stabilitaets-/Rechteblock Angebote/Rechnungen-Lesen 2026-06-21: `offers` und `invoices` GET verlangen jetzt `actorId`; ohne Actor 401, Lesen fuer Admin/Geschaeftsfuehrung/Fuehrungskraft/Vertrieb/Buchhaltung. Dashboard haengt Actor an Listen, Historien, PDF- und XRechnung-Links und laedt bei aktivem Benutzerwechsel neu. Build/Prisma/Mojibake/Regression und API-Smoke auf Port 3002 bestanden.
- Abschluss-Smoke Kernpfade 2026-06-21: Lokaler Testserver Port 3002 pruefte Dashboard, Projekte, Logbuch-Summary, Projektzeiten, Angebote, Rechnungen, Dokument-Mail, Kontakte, Kundenfeedback, PDF-Abrufe und XRechnung-Validierung. Alle relevanten Actor-Pfade HTTP 200, Schutzfaelle ohne Actor erwartbar 401, keine 500er im Smoke. Groesster verbleibender Startdatenblock: Kontakte ca. 291 KB bei 291 Eintraegen.
- Auditabschluss-Vorbereitung 2026-06-21: Operatives Audit steht bei ca. 88-90%, kritische Rechte-/Crash-/Datenverlust-/Startlastthemen ca. 94-95%. Keine bekannten akuten 500er-Blocker nach Abschluss-Smoke. Offene Themen sind vor allem Architektur-/Produktentscheidungen: echte Session/Auth, Datei-/Objektspeicher, Migrationen statt Runtime-DDL, globales Archiv-/Loeschmodell und spaetere Pagination/Summaries fuer Kontakte/Projekte.
- Operativer Auditabschluss 2026-06-21: Audit fuer priorisierten operativen Umfang als abgeschlossen markiert. Final bestanden: Prisma validate, Mojibake, Regression, diff-check und Build. Stand ca. 90% Gesamt-Audit, ca. 95% kritische Rechte-/Crash-/Datenverlust-/Startlastthemen. Weitere Arbeiten nur noch als eigene Folgeblocks: Auth/Session, Datei-/Objektspeicher, Runtime-DDL-Migrationen, Kontakte/Projekte-Performance, Archiv-/Loeschkonzept.
- Folgeblock Auth/Session Grundlage 2026-06-22: Login setzt nun ein signiertes httpOnly Session-Cookie, `/api/auth/session` liest den angemeldeten Benutzer, `/api/auth/logout` loescht die Session. Dashboard bevorzugt beim Laden die Server-Session, behaelt aber die bisherige Actor-/Emulationslogik fuer Kompatibilitaet. Naechster Auth-Schritt: Fach-APIs schrittweise auf Session pruefen und Emulation serverseitig modellieren.
- Folgeblock Auth/Session Actor-Bindung 2026-06-22: Neuer Helfer `src/lib/auth/actor.ts` bindet `actorId`/`actorUserId` an die echte Session. Angebote, Rechnungen, Projektzeiten und Dokumenten-Mail verlangen jetzt eine aktive Session; fremde Actor-Werte sind dort nur fuer Admin/Geschaeftsfuehrung als bewusste Emulation erlaubt. Dashboard akzeptiert alte lokale Benutzer-ID nicht mehr als Anmeldung ohne Server-Session.
- Folgeblock Auth/Session Mitarbeiter-Sensitivdaten 2026-06-22: `employee-costs` und `employee-assessments` nutzen jetzt ebenfalls die serverseitige Session-Actor-Bindung. Eigene Bewertungen bleiben auf den angemeldeten Benutzer bezogen; Lohnkosten und Managerbereiche behalten ihre bestehenden fachlichen Rollenregeln.
- Folgeblock Auth/Session Dashboard-Start 2026-06-22: Dashboard laedt Massendaten erst nach bestaetigter Session und aktivem Benutzer. Direkte Projektakten-Links blockieren den Login ohne gueltige Session nicht mehr; der Boot-Lader wartet nur noch bei angemeldeter Projektakten-Wiederherstellung.
- Stundenabrechnung manuelle Zeiteintraege 2026-06-27: Beim manuellen Zeiteintrag in einem Dauerlaeufer mit Stundenabrechnung werden jetzt Gewerk und Abrechnungsleistung als Pflichtangaben in der Maske erfasst. Die Auswahl nutzt dieselbe Stundenleistungslogik wie Planung/Stempelung und speichert `trade`, `billingCatalogItemId` und `billingCatalogItemLabel`, damit neue manuelle Zeiten spaeter positionsbezogen in Rechnungsentwuerfen landen koennen. Normale Projekte und Monatspauschalen bleiben unveraendert.
- E-Rechnung/XRechnung Schutz 2026-06-27: XRechnung-Pruefung, XML-Download und E-Mail-Versand blockieren jetzt geloeschte oder stornierte Rechnungen. Leere Faelligkeitsdaten werden fuer die XRechnung aus Leistungsdatum plus Zahlungsziel abgeleitet, damit alte Rechnungen mit leerem `dueDate` nicht unnoetig scheitern. KoSIT-Fehler werden nicht mehr als roher Java-Command angezeigt; bei technischer Ablehnung erscheint eine kurze lesbare Meldung, bei fachlicher Ablehnung werden Report-Fehler genutzt.
- XRechnung BuyerReference 2026-06-27: Die BuyerReference wird im UBL-XML nach DocumentCurrencyCode ausgegeben, damit KoSIT die Reihenfolge akzeptiert. Wenn beim Kunden keine Leitweg-ID gepflegt ist, wird fuer normale B2B-Rechnungen als sachlicher Fallback die Projektnummer, sonst die Rechnungsnummer genutzt. Echte Leitweg-IDs haben weiter Vorrang.
- XRechnung Seller Contact 2026-06-27: Der UBL-Verkaeuferblock enthaelt jetzt den von KoSIT geforderten Seller Contact mit Name, Telefon und E-Mail der OK solutions GmbH. Das gilt auch fuer OK-immocare-Rechnungen, weil OK immocare als Marke abrechnet und OK solutions rechtlicher Verkaeufer bleibt.
- XRechnung KoSIT-Anzeige 2026-06-27: Wenn KoSIT eine XRechnung akzeptiert, werden alte/technische Report-Issues nicht mehr als sichtbare Fehlerliste angezeigt. KoSIT-Issues erscheinen nur noch bei nicht bestandener KoSIT-Pruefung.
- Dokument-Mail-Maske 2026-06-27: Die Rechnungsversandmaske wurde optisch beruhigt. E-Rechnungs-Stammdaten und Versandformat bleiben getrennt, die XRechnung-Aktionen stehen kompakter nebeneinander, Format und Pruefstatus erscheinen als kleine Statuspillen. Versandlogik und E-Rechnungsvalidierung wurden dabei nicht fachlich geaendert.
- Dokument-Mail-Vorlagen 2026-06-27: Standardtexte fuer Angebot, Rechnung, Storno, Mahnung, Taetigkeitsbericht und allgemeine Dokumente enthalten keine eigene Grussformel mit Sender mehr. Die Grussformel kommt aus der Signatur, damit sie im Nachrichtentext und in der Vorschau nicht doppelt erscheint.
- ZUGFeRD Versand 2026-06-27: Im Dokument-Mail-Versand ist ZUGFeRD PDF jetzt aktiv. Der Server erzeugt dafuer aus dem gespeicherten Rechnungs-PDF ein PDF mit eingebetteter validierter XRechnung-XML als `factur-x.xml`; die gleiche XRechnung/KoSIT-Pruefung wie beim XML-Versand wird verwendet. Bei ZUGFeRD wird kein zweites normales PDF angehaengt, sondern das ZUGFeRD-PDF ersetzt den PDF-Anhang. Die separate E-Rechnungsdatenpruefungsbox erscheint nur noch bei echten blockierenden Stammdatenfehlern.
- ZUGFeRD PDF/A-3 Validierung 2026-06-27: ZUGFeRD-Versand ist jetzt zusaetzlich an eine echte PDF/A-3-Pruefung gekoppelt. Der Server erwartet `VERAPDF_PATH` oder `ZUGFERD_PDF_VALIDATOR_PATH` auf den veraPDF-CLI-Pfad. Ohne konfigurierten Validator oder bei abgelehnter PDF/A-3-Pruefung wird ZUGFeRD nicht versendet. Die XML bleibt weiterhin ueber XRechnung/KoSIT validiert.
- ZUGFeRD Test ohne E-Mail 2026-06-27: Die Rechnungs-API unterstuetzt jetzt `zugferdId`, um ein ZUGFeRD-PDF zu erzeugen, XRechnung/KoSIT und PDF/A-3 zu pruefen und die Datei herunterzuladen, ohne eine E-Mail zu versenden. In der Dokument-Mail-Maske erscheint bei gewaehltem `ZUGFeRD PDF` der Button `ZUGFeRD PDF testen`.
- veraPDF Setup 2026-06-27: veraPDF 1.30.2 wurde lokal unter `.codex-tools/verapdf/app/verapdf.bat` eingerichtet und in `.env` mit `VERAPDF_PATH` hinterlegt. Neue Scripts: `npm run setup:verapdf` laedt/ installiert den offiziellen veraPDF-Installer lokal ins Projekt, `npm run check:verapdf` prueft CLI und PDF/A-3b-Unterstuetzung. Nach Aenderungen an `VERAPDF_PATH` muss der Next-Server neu gestartet werden.
- ZUGFeRD PDF/A-3 Konverter 2026-06-27: ZUGFeRD erzeugt jetzt nicht mehr direkt aus dem normalen Rechnungs-PDF ein finales Ergebnis, sondern nutzt eine getrennte PDF/A-3-Konverterstufe vor der veraPDF-Pruefung. Der Server erwartet dafuer `PDFA3_CONVERTER_PATH`, `ZUGFERD_PDFA3_CONVERTER_PATH`, `GHOSTSCRIPT_PATH` oder `GS_PATH`; optional kann `PDFA3_ICC_PROFILE_PATH` gesetzt werden. Ohne Konverter wird ZUGFeRD bewusst blockiert. Neue Scripts: `npm run setup:pdfa3-converter` fuer lokales Windows-Ghostscript-Setup, `npm run check:pdfa3-converter` zur Pruefung. Online/Linux: Ghostscript serverseitig installieren und z. B. `GHOSTSCRIPT_PATH=/usr/bin/gs` setzen. Lokal ist der Konverter aktuell noch nicht installiert, veraPDF und KoSIT sind vorhanden.
- Prisma Schema Sync 2026-06-27: Im `WorkPilotProject`-Modell wurden die bestehenden DB-Felder `recurringBillingMode` und `timeBudgetEnabled` wiederhergestellt. Das ist nur eine Schema-Synchronisierung fuer vorhandene Spalten, keine Migration und kein Rueckbau. Ziel: `prisma db push` soll fuer diese Felder keine Loeschwarnung mehr erzeugen.
