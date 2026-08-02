# WorkPilot360 Agent Handover

- JARVIS persönlicher Stempelstopp 2026-08-02: `time.session.manage` beendet
  ausschließlich die eigene laufende Stempelung des angemeldeten internen
  Benutzers; Vertretung, Impersonation und Fremdstempelung sind ausgeschlossen.
  Projektzeit verlangt `fertig` oder `unterbrochen`, bei Unterbrechung zusätzlich
  einen Grund. Die kritischen Phrasen lauten `STEMPELUNG STOPPEN`,
  `STEMPELUNG BEENDEN FERTIG <PROJEKTNUMMER>` und
  `STEMPELUNG BEENDEN UNTERBROCHEN <PROJEKTNUMMER>`. Normale Stempelroute und
  JARVIS verwenden denselben serialisierbaren Fachservice
  `src/lib/time/stamp-session-stop-service.ts`; Zeitbuchung und Entfernen der
  Sitzung sind atomar und exactly-once. Stunden-Dauerläufer erhalten über den
  gemeinsamen Billing-Service genau eine Rechnungsentwurfsposition.
  Unterbrechungen verwenden den gemeinsamen Projektstatus-, Aufgaben- und
  Benachrichtigungsweg. Fertige OK-immocare-Projekte erzwingen eine selbst
  bestätigte Sechs-Punkte-Endkontrolle oder Kollegenkontrolle; das PDF wird
  über `StoredFile` im privaten S3-Speicher abgelegt und der Nachweis steuert
  den gemeinsamen Abrechnungsstatus. Runtime-Commit
  `0a48f80bfa93f44491c91cb07080c2ac4ea1ffbc`; verifiziertes Backup:
  `/var/backups/workpilot360/20260802T121222Z-before-jarvis-stamp-stop`.
  Lokal bestanden 180/180 Testdateien mit 1.782/1.782 Tests, TypeScript,
  Mojibake-/Regressionschecks, Prisma, 90-Seiten-Build, 110/110 Fragen,
  isolierte QA und ein echter JARVIS-Klicktest. Produktiv bestanden
  unproduktiver, Stunden- und Immocare-Stopp samt Exactly-once-Replay, privatem
  S3-PDF, 110/110 Fragen und null QA-Rückständen; Live-Prisma-Diff leer,
  Dashboard/Formular HTTP 200. WorkPilot PID `765199`, KlinikNavigator
  unverändert PID `398228`.

- JARVIS persönlicher Stempelstart 2026-08-02: `time.session.manage` kann die
  eigene Stempelung des angemeldeten internen Benutzers jetzt auf ein
  eindeutiges Projekt oder eine konkret benannte unproduktive Tätigkeit
  starten. Vertretung, Impersonation und Fremdstempelung sind ausgeschlossen.
  Bei Stunden-Dauerläufern sind Gewerk und eine aktive Stunden-
  Abrechnungsleistung mit positivem Verkaufspreis Pflicht; bestätigte
  Tagesplanung darf den Kontext liefern. Ein Projektstatuswechsel auf
  `Umsetzung` erfolgt nur nach ausdrücklichem Auftrag. Normale Stempelroute und
  JARVIS verwenden denselben serialisierbaren Fachservice
  `src/lib/time/stamp-session-start-service.ts`; bestehender Marketing-/
  Kampagnenkontext der Normalmaske bleibt erhalten. JARVIS bindet Entwurf,
  HMAC, Fingerprint, Revision, Organisation, Sitzung, Identitäten und Rollen
  und verlangt exakt `STEMPELUNG STARTEN <PROJEKTNUMMER>` oder
  `STEMPELUNG STARTEN UNPRODUKTIV`. Runtime-Commit
  `76bd2e8e830c1e78467ff68cb0c6477fde5d55cb`; verifiziertes Backup:
  `/var/backups/workpilot360/20260802T105835Z-before-jarvis-stamp-start`.
  Lokal bestanden 177/177 Testdateien mit 1.768/1.768 Tests, TypeScript,
  Mojibake-/Regressionschecks, Prisma, 90-Seiten-Build, isolierte QA und ein
  echter JARVIS-Klicktest. Produktiv bestanden Rollen-, Sitzungs-, Phrasen-,
  Stale-Context- und Exactly-once-QA sowie 110/110 feste Fragen; null
  QA-Rückstände, Live-Prisma-Diff leer, Dashboard/Formular HTTP 200. WorkPilot
  PID `760146`, KlinikNavigator unverändert PID `398228`.

- JARVIS persönliche Stempelpause/-fortsetzung 2026-08-02: Die neue Aktion
  `time.session.manage` kann ausschließlich die eigene laufende Stempelung des
  angemeldeten internen Benutzers pausieren oder fortsetzen. Keine Vertretung,
  kein fremder Mitarbeiter und kein Start/Stop über diesen Aktionsweg. Normale
  Stempelroute und JARVIS verwenden denselben serialisierbaren, gesperrten
  Fachservice `src/lib/time/stamp-session-service.ts`; JARVIS bindet Entwurf,
  HMAC, Kontext, Revision, Organisation, Sitzung, Identitäten und Rollen und
  verlangt exakt `STEMPELUNG PAUSIEREN` beziehungsweise
  `STEMPELUNG FORTSETZEN`. Runtime-Commit
  `a35cd90d7f7d2bbbe03ae20b745acb6b4bdf151d`; verifiziertes Backup:
  `/var/backups/workpilot360/20260802T101258Z-before-jarvis-stamp-session`.
  Lokal bestanden 176/176 Testdateien mit 1.760/1.760 Tests, TypeScript,
  Mojibake-/Regressionschecks, Prisma, 90-Seiten-Build, isolierte QA und echte
  Klicktests für Pause/Fortsetzung. Produktiv bestanden isolierte Rollen-,
  Sitzungs-, Phrasen-, Stale-Context- und Exactly-once-QA sowie 110/110 feste
  Fragen; null QA-Rückstände, Live-Prisma-Diff leer, Dashboard/Formular HTTP
  200. WorkPilot PID `755744`, KlinikNavigator unverändert PID `398228`.

- Projektstatus-Empfängerauflösung fail-closed 2026-08-02: Die gemeinsame
  Fachlogik `resolveProjectResponsibleUser` liefert eine verantwortliche Person
  nur noch bei genau einem aktiven, normalisierten Namens-Treffer. Leere,
  unbekannte oder ausschließlich inaktive Treffer gelten als `missing`; zwei
  oder mehr aktive Namens-Treffer als `ambiguous`. In beiden Fällen wird kein
  Verantwortlichen-Hinweis an einen geratenen Benutzer zugestellt. Auf der
  Managementstufe bleiben alle aktiven Admins/Geschäftsführer zusätzliche
  Empfänger. Preview und JARVIS führen Auflösungsstatus und Trefferzahl mit;
  JARVIS erklärt bei Mehrdeutigkeit ausdrücklich die fail-closed-Sperre.
  Runtime-Commit `3da93965bba7f0c466563c8e8b752458552b2ac5`;
  verifiziertes Backup:
  `/var/backups/workpilot360/20260802T074500Z-before-jarvis-recipient-failclosed`.
  Lokal bestanden 172/172 Testdateien mit 1.722/1.722 Tests, TypeScript,
  Mojibake-/Regressionschecks, Prisma und 90-Seiten-Build. Lokale sowie
  produktive aktive Doppel-Namen: 0. Echter Klicktest zeigte 0 mehrdeutige
  aktuelle Treffer, korrekte Empfängerdiagnose und Navigation; keine
  Nebenwirkung. Lokaler/produktiver 110er-Korpus grün; produktiv 28 Aktionen
  nur vorbereitet, null ausgeführt und null Rückstände. Dashboard/Formular
  HTTP 200, Live-Prisma-Diff leer. WorkPilot PID `743239`, KlinikNavigator
  unverändert PID `398228`.

- JARVIS Projektstatus-Zustellbarkeitsdiagnose 2026-08-02: `automation.read`
  erklärt nun rein lesend, wer bei jeder aktuell fälligen Projektstatus-Schwelle
  einen neuen In-App-Hinweis erhalten würde, welcher Empfänger bereits durch
  ein offenes Exactly-once-Ereignis abgedeckt ist und welche Zuordnungs- oder
  Betriebsbarriere eine Zustellung verhindert. Sichtbar getrennt werden
  Organisationsschalter, Scheduler, Zustell-Kill-Switch und optionaler
  Systemmailkanal. JARVIS zeigt aktive Administration/Geschäftsführung,
  fehlende Verantwortliche, völlig empfängerlose Schwellen sowie mehrdeutige
  Namenszuordnungen. Systemmail wird korrekt als zusätzlicher Best-Effort-Kanal
  beschrieben; ein persistentes Zustellereignis belegt zunächst den erzeugten
  In-App-Hinweis. Die Diagnose versendet und schreibt nichts. Runtime-Commit
  `ed1d56578c58cd93958395b02ccf623818ae26db`; verifiziertes Backup:
  `/var/backups/workpilot360/20260802T073000Z-before-jarvis-automation-delivery-diagnosis`.
  Lokal bestanden 171/171 Testdateien mit 1.719/1.719 Tests, TypeScript,
  Mojibake-/Regressionschecks, Prisma und 90-Seiten-Build. Echter Klicktest:
  131 überwachte Projekte, 104 fällige Management-Schwellen, 208 neue
  Empfänger-Hinweise, zwei aktive Managementempfänger und 94 fehlende
  Verantwortlichen-Zuordnungen; null Datenänderungen. Lokaler und produktiver
  110er-Korpus grün, produktiv 28 nur vorbereitete Aktionen, null Ausführungen
  und Rückstände. Dashboard/Formular HTTP 200, Live-Prisma-Diff leer.
  WorkPilot PID `741649`, KlinikNavigator unverändert PID `398228`.

- JARVIS Projektstatus-Ausführungsprotokoll 2026-08-02: Die rein lesende
  Aktion `automation.read` trennt nun dauerhaft Konfigurationsänderungen von
  tatsächlich erzeugten Projektstatus-Zustellereignissen. Natürliche Fragen
  nach Protokoll, Historie oder Audit zeigen organisationsgebundene Summen und
  jeweils die letzten zehn Einträge. Konfigurationsänderungen enthalten
  Zeitpunkt, Akteur, Ziel sowie Alt-/Neuzustand; Zustellereignisse enthalten
  Projekt, Status, Eskalationsstufe, Empfänger und offen/erledigt. Leere
  Protokolle werden ausdrücklich als leer erklärt. Administration oder
  Geschäftsführung sind auf Sitzungs- und Effektivebene erforderlich; die
  Abfrage startet keinen Scheduler und schreibt nichts. Runtime-Commit
  `74e20506eb1612c339ea322415906bd4510f7baa`; verifiziertes Backup:
  `/var/backups/workpilot360/20260802T072000Z-before-jarvis-automation-history`.
  Lokal bestanden 171/171 Testdateien mit 1.717/1.717 Tests, TypeScript,
  Mojibake-/Regressionschecks, Prisma, leerer Schema-Diff und 90-Seiten-Build.
  Echter UI-Klicktest sowie lokaler und produktiver 110er-Korpus sind grün;
  produktiv 28 Schreibentwürfe nur vorbereitet, null Ausführungen und null
  Rückstände. Dashboard und Anfrageformular HTTP 200, Live-Prisma-Diff leer.
  WorkPilot PID `739270`, KlinikNavigator unverändert PID `398228`.

- JARVIS Projektstatus-Automationsdiagnose 2026-08-02: Die neue rein lesende
  Aktion `automation.read` beantwortet organisationsweit, ob die
  Projektstatus-Automation tatsächlich betriebsbereit ist. Sie trennt sichtbar
  den fachlichen Organisationsschalter, den serverseitigen Scheduler-/
  Kill-Switch und den Zustell-Kill-Switch. Zusätzlich zeigt sie alle Regeln,
  aktuelle Dry-Run-Treffer, fehlende Zuständigkeiten, den letzten flüchtigen
  Schedulerstatus sowie offene und letzte persistente Zustellereignisse.
  Administration/Geschäftsführung sind auf Sitzungs- und Effektivebene
  erforderlich; Führungskraft wird vor dem Datenzugriff abgelehnt. Die
  Diagnose startet keinen Scheduler, versendet nichts und ändert weder
  Einstellung noch Projektstatus. Fachadapter:
  `src/lib/jarvis/automation-status-analysis.ts`. Runtime-Commit
  `c7223a7edc3981c662941d270dcd17fd833200cc`; verifiziertes Backup:
  `/var/backups/workpilot360/20260802T065000Z-before-jarvis-automation-status`.
  Lokal bestanden 171/171 Testdateien mit 1.715/1.715 Tests, TypeScript,
  Mojibake-/Regressionschecks, Prisma, leerer Schema-Diff und 90-Seiten-Build.
  Echter UI-Klicktest und lokaler/produktiver 110er-Korpus sind grün; die
  Diagnose wurde ausdrücklich erkannt, produktiv 28 Schreibentwürfe nur
  vorbereitet, null Ausführungen und null Rückstände. Dashboard und
  Anfrageformular HTTP 200, Live-Prisma-Diff leer. WorkPilot PID `736895`,
  KlinikNavigator unverändert PID `398228`. Prisma-, Storage- und
  Online-Anfragen-Invarianten blieben unverändert.

- JARVIS Projektstatus-Regelverwaltung 2026-08-02: `automation.manage`
  bearbeitet zusätzlich zum bereits freigegebenen Hauptschalter genau eine
  ausdrücklich benannte bestehende Projektstatus-Regel je Entwurf. Aktivität,
  Verantwortlichen-Schwelle und Geschäftsführungs-Schwelle werden mit
  vollständigem Alt-/Neuwert und separatem Vorher-/Nachher-Dry-Run gezeigt.
  Verantwortliche Person: 1 bis 180 Tage; Geschäftsführung: 1 bis 365 Tage
  und niemals früher als die verantwortliche Person. Unbekannte Regeln,
  wirkungslose oder unplausible Änderungen blockieren fail-closed. Exakte
  Phrase: `PROJEKTSTATUS-REGEL ÄNDERN <STATUS>`. Es gibt weiterhin keinen
  Schedulerlauf, keine Zustellung, keine E-Mail und keinen Statuswechsel.
  Berechtigung, Organisation, Sitzung, Rollenpaar, Impersonation, TTL,
  Revision, HMAC, Payload-/Kontexthash, vollständiger Einstellungsfingerprint,
  serialisierbare Transaktion, Advisory-Lock, `FOR UPDATE`, Stale Context und
  Exactly-once gelten unverändert; Audit `automation.project-status.changed`
  enthält Operation und Regelstand vor/nach der Änderung. Runtime-Commit
  `4b6140ffd30decbd0e4f15338c877f864dbcc0e9`; verifiziertes Backup:
  `/var/backups/workpilot360/20260802T063000Z-before-jarvis-automation-rules`.
  Lokal bestanden 170/170 Testdateien mit 1.702/1.702 Tests, TypeScript,
  Mojibake-/Regressionschecks, Prisma, leerer Schema-Diff und 90-Seiten-Build.
  Echter UI-Klicktest, lokale und produktive isolierte QA sowie 110/110
  Produktionsfragen sind grün; produktiv 28 nur vorbereitete Aktionen, null
  Ausführungen und null Rückstände. Dashboard und Anfrageformular HTTP 200,
  Live-Prisma-Diff leer. WorkPilot PID `734753`, KlinikNavigator unverändert
  PID `398228`. Prisma-, Storage- und Online-Anfragen-Invarianten blieben
  unverändert.

- JARVIS Projektstatus-Automationsschalter 2026-08-02: `automation.manage`
  aktiviert oder deaktiviert ausschließlich die bestehende
  Projektstatus-Frühwarnung. Vorher zeigt JARVIS einen rein lesenden Dry-Run
  mit überwachten Projekten, aktueller Verantwortlichen-/Geschäftsführungsstufe
  und fehlenden Zuständigkeiten. Dieser Schritt startet keinen Scheduler,
  versendet keine Meldung oder E-Mail und ändert keinen Projektstatus oder
  Schwellenwert. Sitzung und effektiver Akteur benötigen beide
  Stammdatenrecht, damit nur Administration/Geschäftsführung konfigurieren
  darf; Führungskraft ist bewusst ausgeschlossen. Exakte Phrasen:
  `PROJEKTSTATUS-AUTOMATION AKTIVIEREN` und
  `PROJEKTSTATUS-AUTOMATION DEAKTIVIEREN`. Organisation, Sitzung, Rollenpaar,
  Impersonation, TTL, Revision, HMAC, Payload-/Kontexthash, vollständiger
  Einstellungsfingerprint, serialisierbare Transaktion,
  PostgreSQL-Advisory-Lock und `FOR UPDATE` sichern Stale Context und
  Exactly-once. Audit: `automation.project-status.changed`; Fachservice:
  `src/lib/automation/project-status-automation-management-service.ts`;
  isolierte QA: `scripts/qa-jarvis-automation-management.mjs`.
  Runtime-Commit `f7130b75f39fb846ac84323d32b1facdfbb5d5fd`; verifiziertes
  Backup: `/var/backups/workpilot360/20260802T055638Z-before-jarvis-automation-management`.
  Lokal bestanden 170/170 Testdateien mit 1.698/1.698 Tests, TypeScript,
  Mojibake-/Regressionschecks, Prisma, leerer Schema-Diff und 90-Seiten-Build.
  Echter UI-Klicktest, lokale und produktive isolierte QA sowie 110/110
  Produktionsfragen sind grün; produktiv 27 nur vorbereitete Aktionen, null
  Ausführungen und null Rückstände. Dashboard und Anfrageformular HTTP 200,
  Live-Prisma-Diff leer. WorkPilot PID `732182`, KlinikNavigator unverändert
  PID `398228`. Prisma-, Storage- und Online-Anfragen-Invarianten blieben
  unverändert.

- JARVIS kontrollierte Kontakt-Massenänderung 2026-08-02: `bulk.update` ist
  für die gemeinsame Änderung der Kontaktkategorie von 2 bis höchstens 25
  ausdrücklich per Kundennummer genannten Kontakten produktiv freigegeben.
  Freie oder dynamische Filter bleiben gesperrt. JARVIS und die normale
  Kontaktmaske verwenden denselben Fachservice
  `src/lib/contacts/contact-bulk-category-service.ts` und zeigen vorab die
  vollständige Trefferliste, jeden Alt-/Neuwert sowie Ausschlüsse. Sitzung und
  effektiver Akteur benötigen zugleich Benutzer- und Kontaktverwaltungsrecht.
  Die Ausführung läuft serialisierbar vollständig oder gar nicht; HMAC,
  Payload-/Kontexthash, SHA-256-Fachfingerprint, PostgreSQL-Advisory-Lock,
  optimistisches `updatedAt` und Exactly-once-Historie blockieren Replay und
  veraltete Vorschauen. Exakte Phrase: `MASSENÄNDERUNG AUSFÜHREN <Anzahl>
  KONTAKTE`. Der protokollierte Ausgangsstand kann nur gemeinsam und nur bei
  unverändertem Folgezustand mit `MASSENÄNDERUNG ZURÜCKROLLEN <ID>`
  wiederhergestellt werden. Audits: `contact.bulk-category.changed` und
  `contact.bulk-category.rolled-back`; Integrationsereignisse werden je Kontakt
  erzeugt. Isolierte QA: `scripts/qa-jarvis-bulk-update.mjs`. Runtime-Commit
  `bf5a367dd8d3f6299446417c3ab1124ce73c6faf`; verifiziertes Backup:
  `/var/backups/workpilot360/20260802T051315Z-before-jarvis-bulk-update`.
  Lokal bestanden 169/169 Testdateien mit 1.687/1.687 Tests, TypeScript,
  Mojibake-/Regressionschecks, Prisma, leerer Schema-Diff und 90-Seiten-Build.
  Der echte UI-Klicktest deckte Dry-Run, Ausführung, Kontakt-Navigation und
  exakte Rückrollung ab. Lokale und produktive isolierte QA sowie der feste
  Korpus (110/110; produktiv 26 nur vorbereitete Aktionen) sind grün; alle
  QA-Rückstände null. Dashboard und Anfrageformular HTTP 200, Live-Prisma-Diff
  leer. WorkPilot PID `728456`, KlinikNavigator unverändert PID `398228`.
  Prisma-, Storage- und Online-Anfragen-Invarianten blieben unverändert.

- JARVIS Lohnkostenverwaltung 2026-08-02: `payroll.manage` ist für die
  kontrollierte Änderung bestehender aktiver Mitarbeiterkosten produktiv
  freigegeben. Änderbar sind Monatsgehalt, Vollkostenfaktor, Jahresstunden,
  Urlaubs-, Fortbildungs- und Krankheitstage sowie Stunden pro Arbeitstag.
  JARVIS löst das Ziel organisationsgebunden und eindeutig über die
  dienstliche E-Mail auf, zeigt Alt-/Neuwerte, Vollkosten, Abzüge, verkaufbare
  Stunden und Stundensatz sowie Auswirkungen auf historische und noch nicht
  bewertete Zeiten und laufende Stempelungen. Historische Kostensnapshots
  bleiben unverändert. Unplausible, wirkungslose oder nicht mehr tragfähige
  Kalkulationen sowie inaktive Ziele blockieren fail-closed. Sitzung und
  effektiver Akteur benötigen zugleich Benutzer- und Kostenverwaltungsrecht;
  Ablehnungen geben keine vertraulichen Werte preis. Exakte Phrase:
  `LOHNKOSTEN ÄNDERN <dienstliche E-Mail>`. Revision, TTL, HMAC, Payload-/
  Kontexthash, SHA-256-Fachfingerprint, serialisierbare Transaktion,
  PostgreSQL-Advisory-Lock und optimistisches `updatedAt` sichern Stale Context
  und Exactly-once; Auditaktion `employee-cost.changed`. Gemeinsamer
  Fachservice für JARVIS und Mitarbeiterkostenmaske:
  `src/lib/employee-costs/employee-cost-management-service.ts`; isolierte QA:
  `scripts/qa-jarvis-employee-cost-management.mjs`. Runtime-Commit
  `422777f7f0f0601ea881d2e0254c7e87477e8124`; verifiziertes Backup:
  `/var/backups/workpilot360/20260802T042845Z-before-jarvis-employee-cost-management`.
  Lokal bestanden 166/166 Testdateien mit 1.671/1.671 Tests, TypeScript,
  Mojibake-/Regressionschecks, Prisma, leerer Schema-Diff und der
  90-Seiten-Build. Lokale und produktive isolierte QA, echter UI-Klicktest bis
  in den Lohnkosten-Reiter sowie der permanente Korpus (110/110, produktiv 25
  nur vorbereitete Aktionen) sind grün; QA-Rückstände null. Dashboard und
  Anfrageformular HTTP 200, Live-Prisma-Diff leer. WorkPilot PID `724824`,
  KlinikNavigator unverändert PID `398228`. Prisma-, Storage- und
  Online-Anfragen-Invarianten blieben unverändert.

- JARVIS Personalstammdaten 2026-08-02: `personnel.manage` ist für die
  kontrollierte Änderung bestehender aktiver Mitarbeiter produktiv
  freigegeben. Zulässig sind ausschließlich Vor-/Nachname, dienstliche E-Mail,
  Rolle, Personalnummer, Telefon/Mobil, Anschrift sowie Planungsboard und
  Planungsgruppe. Passwort, Mailkonto, Lohn-/Kostendaten, Kapazitätsmodelle,
  Führungshierarchie, Aktivierung/Deaktivierung sowie Anlage/Löschung bleiben
  eigene spätere Aktionen. JARVIS löst den Mitarbeiter eindeutig und
  organisationsgebunden über die dienstliche E-Mail auf, zeigt Alt-/Neuwerte,
  Sitzungen, offene eigene Aufgaben, Planungen und Projektzeiten. Es werden
  keine operativen Zuordnungen umverteilt. Eigene Rollenänderung, Vergabe einer
  höheren Rolle als die des Akteurs, doppelte E-Mail/Personalnummer, Gastrolle,
  inaktive Mitarbeiter und das Entfernen der letzten aktiven Geschäftsführung
  blockieren fail-closed. Bei Rollenwechsel werden alle Zielsitzungen atomar
  beendet. Exakte Phrase: `MITARBEITER ÄNDERN <dienstliche E-Mail>`. Sitzung,
  Organisation, Rollenpaar, Impersonation, TTL, Revision, HMAC, Payload-/
  Kontexthash, SHA-256-Fachfingerprint, serialisierbare Transaktion,
  PostgreSQL-Advisory-Lock und optimistisches `updatedAt` sichern Stale-Context
  und Exactly-once; Auditaktion `personnel.changed`. Fachservice:
  `src/lib/users/personnel-management-service.ts`; isolierte QA:
  `scripts/qa-jarvis-personnel-management.mjs`. Runtime-Commit
  `f55fa4e4d4f2f6d42af3af81406820839c0f23cf`; verifiziertes Backup:
  `/var/backups/workpilot360/20260802T035012Z-before-jarvis-personnel-management`.
  Lokal bestanden 163/163 Testdateien mit 1.654/1.654 Tests, TypeScript,
  Mojibake-/Regressionschecks, Prisma, leerer Schema-Diff und der
  90-Seiten-Build. Lokale und produktive isolierte QA, echter UI-Klicktest mit
  Rücksprung in die Mitarbeiterakte sowie der permanente Korpus (110/110,
  produktiv 24 nur vorbereitete Aktionen) sind grün; QA-Rückstände null.
  Dashboard und Anfrageformular HTTP 200, Live-Prisma-Diff leer. WorkPilot PID
  `721496`, KlinikNavigator unverändert PID `398228`. Keine Prisma-, Storage-
  oder Online-Anfragen-Invariante wurde geändert.

- JARVIS Katalogverwaltung 2026-08-02: `catalog.manage` ist für die kontrollierte
  Anlage und Bearbeitung von Artikeln und Leistungen produktiv freigegeben.
  JARVIS zeigt Stammdaten, EK/Selbstkosten, VK, Umsatzsteuer, Rohertrag, Marge,
  Planungslogik und sämtliche bestehenden Verwendungszähler. Dubletten,
  ungültige/negative Werte, unpassende A-/L-Nummern und wirkungslose Änderungen
  blockieren fail-closed. Pakete und Komponenten bleiben in der Paketmaske;
  bestehende Paket-Snapshots werden sichtbar gewarnt und niemals automatisch
  geändert. Relevante Änderungen setzen eine fachliche Freigabe auf
  `needs_review`. Exakte Phrasen sind `KATALOGPOSITION ANLEGEN <Nummer>` und
  `KATALOGPOSITION ÄNDERN <Nummer>`. Sitzung, Organisation, Rollenpaar,
  Impersonation, TTL, Revision, HMAC, Payload-/Kontexthash, SHA-256-Fingerprint,
  serialisierbare Transaktion, PostgreSQL-Advisory-Lock und optimistisches
  Update sichern Exactly-once und Stale-Context. Fachservice:
  `src/lib/catalog/catalog-management-service.ts`; isolierte QA:
  `scripts/qa-jarvis-catalog-management.mjs`. Runtime-Commit
  `68898a07b5872f398f0d54f7e0d833554f136f75`; verifiziertes Backup:
  `/var/backups/workpilot360/20260802T031300Z-before-jarvis-catalog-management`.
  Lokal bestanden 161/161 Testdateien mit 1.643/1.643 Tests, TypeScript,
  Mojibake-/Regressionschecks, Prisma, leerer Schema-Diff und der
  90-Seiten-Build. Lokale und produktive isolierte QA, echter UI-Klicktest mit
  korrektem Rücksprung zu Leistungen und der permanente Korpus (110/110,
  produktiv 23 nur vorbereitete Aktionen) sind grün; QA-Rückstände null.
  Dashboard und Anfrageformular HTTP 200, Live-Prisma-Diff leer. WorkPilot PID
  `718512`, KlinikNavigator unverändert PID `398228`. Keine Prisma-, Storage-
  oder Online-Anfragen-Invariante wurde geändert.

- JARVIS endgültige Kontaktlöschung 2026-08-02: `contact.delete` ist als
  irreversibler, fail-closed gesicherter Vertikalschnitt produktiv
  freigegeben. JARVIS löst den Kontakt ausschließlich über eine eindeutige,
  organisationsgebundene Kundennummer auf und verlangt einen dokumentierten
  Grund sowie exakt `KONTAKT ENDGÜLTIG LÖSCHEN <Kundennummer>`. Vorschau und
  normale Kontaktmaske verwenden denselben Fachservice und zeigen beziehungsweise
  prüfen vollständig 17 Referenzfamilien: Projekte, Unterkontakte,
  Objektadressen, Online-Anfragen, Kundenlogbuch, Kundenhinweise samt Archiv,
  Hinweisbestätigungen, Potenziale, Verkaufschancen, Sales-Ziele,
  Feedback-Anfragen, Feedbacks, Angebotsannahmen, Lagerbewegungen,
  Winterdienst- und Fahrzeugkalkulationen sowie Winterdienstläufe. Schon ein
  Bezug blockiert die physische Löschung; für normale Bestandsbereinigung wird
  weiterhin Archivierung empfohlen. Sitzung, Organisation, Rollenpaar,
  Impersonation, TTL, Revision, HMAC, Payload-/Kontexthash,
  SHA-256-Fachfingerprint, serialisierbare Transaktion,
  PostgreSQL-Advisory-Lock, optimistisches Löschen und Exactly-once-Replay
  sichern die Ausführung. Kontakt, Integrationsereignis, Audit und persistente
  JARVIS-Aktionshistorie werden atomar behandelt; Event, Audit und
  Aktionshistorie bleiben nach der Löschung erhalten. Fachservice:
  `src/lib/contacts/contact-deletion-service.ts`; isolierte QA:
  `scripts/qa-jarvis-contact-deletion.mjs`. Produktiv auf Runtime-Commit
  `9f4d352268fe1c4b2f7c040530e58838ef02af0b`; verifiziertes Backup:
  `/var/backups/workpilot360/20260802T023504Z-before-jarvis-contact-deletion`.
  Lokal bestanden 159/159 Testdateien mit 1.628/1.628 Tests, TypeScript,
  Mojibake-/Regressionschecks, Prisma-Validierung, leerer Schema-Diff und der
  90-Seiten-Build. Isolierte lokale und produktive QA, echter JARVIS-UI-
  Klicktest und der permanente Korpus (110/110, produktiv 22 nur vorbereitete
  Aktionen) sind grün; sämtliche QA-Rückstände sind null. Dashboard und
  öffentliches Anfrageformular liefern HTTP 200, Live-Prisma-Diff leer.
  WorkPilot PID `714991`, KlinikNavigator unverändert PID `398228`.

- JARVIS Kontaktverwaltung 2026-08-02: `contact.manage` legt Firmen-, Privat-
  und Personenkontakte kontrolliert an oder bearbeitet bestehende Kontakte
  ausschließlich über eine eindeutige organisationsgebundene Kundennummer.
  Freigegeben sind Name/Firma, Position, E-Mail-Empfänger, Telefon/Mobil,
  Website, Quelle, Erreichbarkeit und Postadresse. Kundennummern werden unter
  PostgreSQL-Advisory-Lock serialisiert vergeben; Telefonnummern werden wie
  in der normalen Kontaktmaske kanonisch normalisiert. Vor jeder Aktion zeigt
  JARVIS sämtliche Alt-/Neuwerte und blockiert mögliche Dubletten über Name,
  E-Mail oder normalisierte Telefonnummer. Exakte Phrasen sind `KONTAKT
  ANLEGEN <Name>` und `KONTAKT ÄNDERN <Kundennummer>`. Sitzung, Organisation,
  Rollenpaar, Impersonation, TTL, Revision, HMAC, Payload-/Kontexthash,
  Fachfingerprint, serialisierbare Transaktion und Advisory-Locks sichern
  Vorschau und Exactly-once-Ausführung. Kontakt, IntegrationEvent, Audit und
  Aktionshistorie entstehen gemeinsam; Projekte, Objektadressen,
  Online-Anfragen und andere Fachdaten werden niemals automatisch angelegt
  oder zugeordnet. Fachservice:
  `src/lib/contacts/contact-management-service.ts`; isolierte QA:
  `scripts/qa-jarvis-contact-management.mjs`. Produktiv auf Runtime-Commit
  `5502776d50c03ca5b13f6e6938332c4e5cd563bd`; verifiziertes Backup:
  `/var/backups/workpilot360/20260802T015913Z-before-jarvis-contact-management`.
  Lokal bestanden 157/157 Testdateien mit 1.615/1.615 Tests, TypeScript,
  Mojibake-/Regressionschecks, Prisma, leerer Schema-Diff und der
  90-Seiten-Build. Isolierte lokale und produktive QA, echter UI-Klicktest
  mit Öffnen in der normalen Kontaktmaske sowie der produktive permanente
  Korpus (110/110, 21 nur vorbereitete Aktionen) blieben vollständig grün;
  null QA-Rückstände. Dashboard und öffentliches Anfrageformular liefern
  HTTP 200, Live-Prisma-Diff leer. WorkPilot PID `711359`, KlinikNavigator
  unverändert PID `398228`.

- JARVIS Projektstammdaten 2026-08-02: `project.manage` ist als kontrollierte
  Schreibaktion für bestehende, eindeutig per Projektnummer bestimmte Projekte
  freigegeben. Zulässig sind ausschließlich Titel, Beschreibung,
  Laufzeitmonate, Gewerk, Adresse, Beteiligte, Projektverantwortung und
  zeitlich begrenzte Vertretung. Projektanlage, Projektnummer, Kunde/Kontakte,
  Projektart, Geschäftsbereich, Status, Abrechnung und Budgets bleiben eigene
  spätere Fachschritte. Die Vorschau zeigt jeden Alt-/Neuwert; exakte Phrase:
  `PROJEKT ÄNDERN <Projektnummer>`. Archivierte Projekte, wirkungslose oder
  widersprüchliche Änderungen und veraltete Vorschauen bleiben gesperrt.
  Prüfungsrelevante Änderungen heben eine bestehende Freigabe atomar mit
  Review-Historie, Logbuch und Audit auf. Fachservice:
  `src/lib/projects/project-master-data-service.ts`; isolierte QA:
  `scripts/qa-jarvis-project-master-data.mjs`. Lokal 155 Testdateien/1.604
  Tests, 110/110 Korpusfragen, 90-Seiten-Build und echter UI-Klicktest grün;
  null QA-Rückstände. Produktiv auf Runtime-Commit
  `e7d635d2a38bf840a8b3de996641bf8b24411538` abgenommen; Sicherung
  `/var/backups/workpilot360/20260802T011132Z-before-jarvis-project-master-data`.
  Die produktive isolierte QA und der permanente Korpus bestanden ebenfalls
  vollständig (110/110, 20 vorbereitete und null ausgeführte Korpusaktionen,
  null Rückstände). Live-Prisma-Diff leer, Dashboard und Formular HTTP 200;
  WorkPilot PID `706450`, KlinikNavigator unverändert PID `398228`.

- JARVIS Projektarchivierung 2026-08-02: Der reversible kritische
  `project.archive`-Vertikalschnitt ist produktiv auf Commit
  `781899aac894025833367b56086b724088c3f8ae`. Verifiziertes Code-, DB-,
  Konfigurations- und Runtime-Backup:
  `/var/backups/workpilot360/20260802T003136Z-before-jarvis-project-lifecycle`.
  Lokal sind 153 Testdateien mit 1.593 Tests, TypeScript, Prisma,
  Mojibake-/Regressionschecks und der 90-Seiten-Build grün. Isolierte lokale
  und produktive QA bestätigten Rollen-/Mandantengrenzen, Blocker,
  Exact-Phrase, sicheren Abbruch, Exactly-once, exakten Vorstatus und
  Relationserhalt. Der produktive permanente Korpus bestand 110/110 mit 19
  nur vorbereiteten Entwürfen und null Rückständen. Echte Klicktests in
  JARVIS und normaler Projektmaske blieben fehlerfrei. WorkPilot PID `700433`;
  KlinikNavigator unverändert PID `398228`.

- JARVIS kontrollierter Aufgaben-Lebenszyklus 2026-08-01: JARVIS und die
  normale Aufgabenoberfläche verwenden jetzt denselben organisationsgebundenen
  Fachservice zum reversiblen Archivieren und Wiederherstellen. Physisches
  Löschen ist gesperrt. Ein Grund mit mindestens drei Zeichen und die exakte
  Phrase `AUFGABE ARCHIVIEREN <Titel>` beziehungsweise
  `AUFGABE WIEDERHERSTELLEN <Titel>` sind Pflicht; gleichnamige Aufgaben werden
  nur über ihre sichtbare Aufgaben-ID aufgelöst. Laufende Zeiterfassung oder
  ein nicht belegbarer Vorstatus blockieren fail-closed. Kommentare,
  Beteiligte, Links, Zeiten, Folgeaufgaben, Projekt und Benachrichtigungen
  bleiben erhalten. Organisation, Sitzung, Rollenpaar, Impersonation,
  Revision, TTL, HMAC, Payload-/Kontexthash, SHA-256-Fachfingerprint,
  serialisierbare Transaktion, PostgreSQL-Advisory-Lock, bedingtes Update,
  Historie, Status-Timeline und Exactly-once-Replay sichern die Aktion.
  Produktiv auf Commit `991dbb8ef935a425f8a301a4900d108f3375483f`;
  Backup: `/var/backups/workpilot360/20260801-210641-jarvis-task-lifecycle-v3`.
  Lokal und produktiv sind 147 Testdateien mit 1.549 Tests, TypeScript,
  Mojibake-/Regressionschecks, Prisma-Validierung, Schema-Synchronität und der
  90-Seiten-Build grün. Der produktive permanente Korpus bestand 110/110 und
  bereitete 17 Entwürfe ohne Ausführung oder Rückstände vor. Die isolierte
  Produktions-QA bestand Rollenprüfung, falsche Phrase, Archivierung,
  Wiederherstellung, Abbruch, Exactly-once-Replay, Beweiserhalt und das Verbot
  physischen Löschens mit null Rückständen. Der echte sichtbare Klicktest
  bestätigte vollständige Vorschau, exakte Phrase, deaktivierte Ausführung bei
  falscher Phrase und sicheren Abbruch. WorkPilot läuft unter PID `681938`;
  KlinikNavigator blieb unverändert unter PID `398228`.

- JARVIS-Wissen privater Datei- und Objektspeicher 2026-08-01: Die bisherige
  Pilotnotiz wurde durch die verbindliche Gesamtarchitektur in
  `docs/STORAGE_ARCHITEKTUR.md` ersetzt. JARVIS kennt den nicht navigierbaren,
  verifizierten Systemdienst `system.objectStorage` und beantwortet getrennt
  Normalnutzer-Erklärung, aktuelle Dateifamilien, Codefluss, PWA/API,
  Microsoft-365-/XRechnung-/ZUGFeRD-Versand, Auswertungen, Performance,
  Providerfehler/Fallback, Lebenszyklus/Aufbewahrung und Altdateimigration.
  Verbindlich sind PostgreSQL als Fachquelle, `StoredFile` als Metadatenbrücke,
  privater S3-kompatibler STRATO-HiDrive-Speicher für verifizierte Bytes,
  Magic-Byte-/Größen-/SHA-256-Prüfung, organisations- und besitzergebundener
  Abruf, transaktionaler Upload-Rollback sowie die Trennung von Fachstatus und
  physischem Objekt. PWA und Browser bleiben ausschließlich an die WorkPilot-
  API angebunden; Auswertungen verwenden weiterhin strukturierte Fachdaten.
  Zugangsschlüssel, Tokens, Passwörter, Bucket-Schlüssel und andere Secrets
  bleiben ausdrücklich aus JARVIS-Wissen, Antworten und Telemetrie ausgeschlossen.

- JARVIS kontrolliertes Löschen/Wiederherstellen von Rechnungsentwürfen
  2026-08-01: JARVIS und die normale Rechnungsmaske verwenden jetzt denselben
  organisationsgebundenen Soft-Delete-Fachservice. Nur ein unverarbeiteter
  Status `Entwurf` darf mit dokumentiertem Grund gelöscht und anschließend
  wiederhergestellt werden. Fakturierte, versendete, bezahlte, gemahnte,
  zeit- oder lagerverknüpfte Rechnungen und Belege mit Folgebelegen bleiben
  gesperrt und müssen über Storno oder Korrektur berichtigt werden. Die exakte
  Phrase `RECHNUNG LÖSCHEN RE-...` beziehungsweise
  `RECHNUNG WIEDERHERSTELLEN RE-...` ist Pflicht. Positionen, Entwurfs-PDF,
  Zahlungen, Mahnungen, Stempelungen, Lager, Versand, Angebote und
  Projektstatus bleiben unverändert; Historie und Projektlogbuch werden
  atomar geschrieben. Sitzung, Organisation, Rollenpaar, Impersonation,
  Revision, TTL, HMAC, SHA-256-Fachfingerprint, serialisierbare Transaktion,
  PostgreSQL-Advisory-Lock, bedingtes Update und Exactly-once-Replay sichern
  die Aktion. Produktiv auf Code-Commit
  `8b23799f1cab1844c5d56a459b04f23c2e7bd073`; Backup:
  `/var/backups/workpilot360/20260801-002500-jarvis-invoice-lifecycle`.
  Lokal und produktiv sind 140 Testdateien mit 1.491 Tests, TypeScript,
  Regression, Mojibake, Prisma-Validierung, leerer Live-Diff und der
  90-Seiten-Build grün. Der permanente Korpus bestand 110/110, bereitete 16
  Action-Center-Entwürfe einschließlich `invoice.delete` vor und führte keine
  Aktion aus. Die isolierte Produktions-QA bestand Sperre fakturierter
  Rechnungen, Löschen, Wiederherstellen, Abbruch, falsche Phrase,
  Exactly-once-Replay, Historie, Logbuch und Nebenwirkungsgrenzen ohne
  Rückstände. Der echte sichtbare Klicktest bestätigte kritische Karten,
  exakte Phrasen, Projektakte, Archiv, Wiederherstellung, die fehlende
  Löschaktion bei fakturierten Rechnungen und eine fehlerfreie Browserkonsole.
  Alle UI-QA-Daten wurden bereinigt. WorkPilot läuft unter PID `541979`;
  KlinikNavigator blieb unverändert unter PID `398228`.

- JARVIS kontrolliertes Löschen/Wiederherstellen von Angeboten 2026-07-31:
  JARVIS und die normale Angebotsmaske verwenden jetzt denselben
  organisationsgebundenen Soft-Delete-Fachservice. Ein dokumentierter Grund
  mit mindestens drei Zeichen und die exakte Phrase `ANGEBOT LÖSCHEN ANG-...`
  beziehungsweise `ANGEBOT WIEDERHERSTELLEN ANG-...` sind Pflicht. Aktive
  Rechnungen oder ein digital angenommenes Angebot blockieren die Löschung;
  noch nicht angenommene Annahmelinks werden beim Löschen widerrufen und beim
  Wiederherstellen bewusst nicht reaktiviert. Vorstatus, Angebotshistorie und
  Projektlogbuch werden atomar gesichert. Projektstatus, Termine, Aufgaben,
  Rechnungen und Versand bleiben unverändert. Sitzung, Organisation,
  Rollenpaar, Impersonation, Revision, TTL, HMAC, Fachfingerprint,
  serialisierbare Transaktion, PostgreSQL-Advisory-Lock, bedingtes Update und
  Exactly-once-Replay schützen die Aktion. Produktiv auf Code-Commit
  `3fce1276f856153f21cb15124ad1d5a5d885f391`; Backup:
  `/var/backups/workpilot360/20260731-234000-jarvis-offer-lifecycle`.
  Lokal und produktiv sind 139 Testdateien mit 1.481 Tests, TypeScript,
  Prisma-Validierung, leerer Live-Diff und der 90-Seiten-Build grün. Der
  permanente Korpus bestand 110/110, bereitete 15 Entwürfe einschließlich
  `offer.delete` vor und führte keine Aktion aus. Isolierte Produktions-QA
  bestand Löschen, Wiederherstellen, Abbruch, falsche Phrase,
  Exactly-once-Replay, Historie, Logbuch und Nebenwirkungsgrenzen. Der echte
  produktive Klicktest bestätigte Lösch- und Wiederherstellungskarten,
  exakte Phrasen, das sichtbare Archiv samt Wiederherstellen-Aktion sowie eine
  fehlerfreie Browserkonsole. Der dabei gefundene Fehlgriff auf das Wort
  `Listen` innerhalb der Begründung ist behoben und regressionstestgesichert.
  Alle QA-Daten wurden bereinigt. WorkPilot läuft unter PID `534394`;
  KlinikNavigator blieb unverändert unter PID `398228`.

- JARVIS kontrollierte Angebotsentscheidung und klare OKW-Leersuche 2026-07-31:
  JARVIS erkennt jetzt Gewonnen-/Verloren-Wünsche für ein konkretes Angebot
  getrennt von Suche, Finalisierung, Versand, Löschung, Aufgaben und
  Projektstatus. Beide Entscheidungen verlangen einen Grund; bei `Verloren`
  ist zusätzlich ein Kommentar Pflicht. Angebot, Projekt, Kunde, Summen,
  Entscheidung, Begründung, Prüfungen und ausdrücklich ausgeschlossene
  Nebenwirkungen werden vor der Ausführung sichtbar. Erst die exakte,
  groß-/kleinschreibungssensitive Phrase `ANGEBOT GEWINNEN ANG-...` oder
  `ANGEBOT VERLIEREN ANG-...` darf genau einmal ausführen. Aktive verknüpfte
  Rechnungen blockieren eine Verlustentscheidung. Der gemeinsame Fachservice
  verwendet Mandantenbindung, Sitzung, Rollenpaar, Impersonation, Revision,
  TTL, HMAC, SHA-256-Fachfingerprint, serialisierbare Transaktion,
  PostgreSQL-Advisory-Lock, bedingtes Update, Audit und Exactly-once-Replay.
  Gemeinsam werden ausschließlich Angebot, Angebotshistorie und
  Projektlogbuch geändert; Projektstatus, Termine, Aufgaben, Rechnungen und
  Versand bleiben unverändert. Die natürliche Frage `zeig mal alle oKW
  Angebote` entfernt nun korrekt das Füllwort `mal`, löst den bekannten
  Kontakt auf und antwortet bei leerem Ergebnis verständlich: `Für OKW GmbH
  sind aktuell keine Angebote in WorkPilot360 vorhanden.`
  Produktiv auf Code-Commit `f74a8d0` mit Serverbackup
  `/var/backups/workpilot360/20260731-230000-jarvis-offer-decision`.
  Lokal und produktiv sind 138 Testdateien mit 1.473 Tests, TypeScript,
  Prisma-Validierung, leerer Live-Diff und der 90-Seiten-Build grün. Der
  permanente Korpus bestand 110/110 und bereitete 14 Entwürfe vor, ohne eine
  Aktion auszuführen oder QA-Rückstände zu hinterlassen. Die isolierte
  Produktions-QA bestand Gewonnen, Verloren, Abbruch, falsche Phrase,
  Exactly-once-Replay, Historie und Logbuch. Der sichtbare produktive
  Klicktest bestätigte die klare OKW-Antwort, vollständige kritische
  Angebotskarte, exakte Phrase, sicheren Abbruch und eine fehlerfreie
  Browserkonsole; alle UI-QA-Daten wurden bereinigt. WorkPilot läuft unter
  PID `526336`; KlinikNavigator blieb unverändert unter PID `398228`.

- JARVIS kontrollierter Angebotsversand 2026-07-31:
  Der dreizehnte Action-Center-Vertikalschnitt versendet ausschließlich ein
  finalisiertes Angebot im Status `Erstellt` mit gespeichertem PDF. JARVIS
  erkennt den Versandwunsch getrennt von Finalisierung, Gewonnen/Verloren,
  Aufgaben und Projektstatus und zeigt Angebot, Projekt, Kunde, Absender,
  Summen, Empfänger, CC/BCC, Betreff, Nachricht, finales PDF samt Größe und
  SHA-256 sowie den optionalen 30-Tage-Link zur digitalen Angebotsannahme.
  Jede Änderung erzwingt eine neue serverseitige Prüfung. Erst die exakte,
  groß-/kleinschreibungssensitive Phrase `SENDEN ANG-... AN <Empfänger>` darf
  die E-Mail einmalig an Microsoft 365 übergeben.
  Normale Angebotsmaske und JARVIS verwenden denselben bestehenden
  `/api/document-mail`-Fachweg einschließlich Angebots-PDF, optionaler
  Widerrufsunterlagen für Privatkunden, Annahmelink, Versandprotokoll und
  `email_sent`-Angebotshistorie. Versand-ID, Organisation, Sitzung,
  Rollenpaar, Impersonation, Revision, TTL, HMAC, Fachfingerprint und
  Exactly-once-Claim schützen vor Fremdzugriff, Doppelklick und Replay. Ein
  laufender, bereits zugestellter oder nach der Übergabe technisch unklarer
  Vorgang wird nicht automatisch erneut gesendet. Gewonnen/Verloren,
  Aufgaben und Projektstatus bleiben unverändert.
  Produktiv auf Code-Commit `9f24eff` mit Serverbackup
  `/var/backups/workpilot360/20260731-223000-jarvis-offer-delivery`.
  Lokal und produktiv sind 137 Testdateien mit 1.463 Tests, TypeScript,
  Prisma-Validierung, leerer Live-Diff und der 90-Seiten-Build grün. Der
  permanente Korpus bestand jeweils 110/110 und bereitete `offer.send` real
  vor, ohne eine E-Mail oder andere Aktion auszuführen und ohne QA-Rückstände.
  Der echte lokale Klicktest prüfte vollständige Vorschau, Betreffänderung,
  Annahmelink-Umschaltung, erneute Prüfung, sicheren Abbruch und eine
  fehlerfreie Browserkonsole. Da aktuell kein Führungs-/GF-Benutzer ein
  verbundenes Microsoft-365-Konto besitzt, blieb eine echte externe
  Testzustellung erwartungsgemäß blockiert; der Zustelladapter ist mit
  Microsoft-Graph-/Dispatch-Mocks einschließlich Erfolgs-, Stale- und
  Uncertain-Fällen abgenommen. WorkPilot läuft unter PID `519994`;
  KlinikNavigator blieb unverändert unter PID `398228`.

- JARVIS kontrollierte Angebotsfinalisierung 2026-07-31:
  Der zwÃ¶lfte Action-Center-Vertikalschnitt finalisiert einen vorhandenen
  Angebots- oder Nachtragsentwurf kontrolliert. JARVIS erkennt den Wunsch
  getrennt von Entwurfserstellung, Versand, Gewonnen/Verloren, LÃ¶schung und
  Statusfragen, lÃ¤dt Angebot, Projekt, Bezugsangebot, Positionen,
  KatalogstÃ¤nde, AusfÃ¼hrungszeitraum und Summen im Mandanten neu und zeigt
  alle PrÃ¼fungen sichtbar an. Fehlende Pflichtdaten, inkonsistente Summen,
  anderer Status und veralteter Kontext blockieren fail-closed. Erst die
  exakte, groÃŸ-/kleinschreibungssensitive Phrase
  `ANGEBOT FINALISIEREN ANG-...` darf ausfÃ¼hren.
  Normale Angebotsmaske und JARVIS verwenden dieselbe Angebotsvalidierung,
  Kalkulation und PDF-Erzeugung. In einer serialisierbaren Transaktion unter
  organisations- und angebotsgebundenem PostgreSQL-Advisory-Lock wechselt
  genau ein unverÃ¤nderter Entwurf bedingt auf `Erstellt`, erhÃ¤lt sein finales
  PDF und genau ein `finalized`-Historienereignis. Organisation, Sitzung,
  Rollenpaar, Impersonation, Revision, TTL, HMAC, SHA-256-Fachfingerprint,
  Audit und Exactly-once-Replay sichern die Aktion. Versand,
  Gewonnen/Verloren, Aufgaben und automatische ProjektstatusÃ¤nderung werden
  ausdrÃ¼cklich nicht ausgelÃ¶st.
  Produktiv abgenommen auf Code-Commit `89d1d38` mit Serverbackup
  `/var/backups/workpilot360/20260731-194809-jarvis-offer-finalization`.
  Lokal und produktiv sind 136 Testdateien mit 1.454 Tests, TypeScript,
  Regressionscheck, Prisma-Validierung, leerer Live-Diff und der
  90-Seiten-Build grÃ¼n. Der permanente Korpus bestand jeweils 110/110 und
  bereitete `offer.finalize` real vor, ohne eine Aktion auszufÃ¼hren oder
  QA-Daten zu hinterlassen. Die isolierte echte Produktions-QA lehnte die
  falsche Phrase ab, finalisierte danach genau `ANG-955424`, erzeugte ein
  vollstÃ¤ndiges PDF und genau eine Historie und lieferte beim Replay dieselbe
  EntitÃ¤t. Versand, Aufgaben, Projektstatus und Gewonnen/Verloren blieben
  unverÃ¤ndert; alle QA-Daten wurden bereinigt. Dashboard, Online-Formular und
  Angebots-API liefern HTTP 200. WorkPilot lÃ¤uft unter PID `510873`;
  KlinikNavigator blieb unverÃ¤ndert unter PID `398228`.

- JARVIS kontrollierte Teilgutschrift / Rechnungskorrektur 2026-07-31:
  Der elfte Action-Center-Vertikalschnitt erstellt eine finanzielle
  Teilgutschrift zu einer Rechnung im Status `Fakturiert` oder `Bezahlt` als
  eigenständigen negativen Beleg im Nummernkreis `GU-...`. Jede GU-Rechnung
  verweist dauerhaft über `sourceInvoiceId` und `sourceInvoiceNumber` auf die
  Ursprungsrechnung; jede GU-Position ist über `sourceInvoiceLineId` an genau
  eine ursprüngliche Rechnungsposition gebunden. Der gemeinsame Service
  summiert frühere aktive Gutschriften positionsgenau und gibt nur den
  verbleibenden Nettobetrag frei. Überkorrektur, fremde Positionen, leere
  Auswahl und eine vollständige Aufhebung des noch offenen Rechnungswertes
  bleiben blockiert. Für eine vollständige Aufhebung ohne frühere
  Teilgutschrift bleibt der separate Vollstorno zuständig.
  JARVIS zeigt Referenzrechnung, vorgesehene GU-Nummer, Projekt, Kunde,
  Rechnungsstatus, Restkontingent sowie Netto-/Bruttosumme. In der Maske
  werden der verbindliche Grund und der Nettobetrag je Ursprungsposition
  bearbeitet; jede Änderung erzwingt eine neue serverseitige Prüfung. Erst
  die exakte, groß-/kleinschreibungssensitive Phrase
  `GUTSCHRIFT GU-... ZU RE-... ÜBER ...,.. EUR` darf ausführen. Die Erstellung
  ist organisations-, sitzungs-, rollen-, revisions-, TTL-, HMAC- und
  fingerprintgebunden, serialisierbar und unter Advisory Locks exactly-once.
  Gemeinsam entstehen negative GU-Rechnung samt PDF, zwei
  Historienereignisse und genau ein Projektlogbucheintrag. Die
  Ursprungsrechnung bleibt unverändert fakturiert beziehungsweise bezahlt.
  Eine Teilgutschrift löst bewusst keine Auszahlung, Zahlungsbuchung,
  Zeitfreigabe, Materialrückgabe oder E-Mail aus. Existiert bereits eine
  aktive Teilgutschrift, blockiert nun auch der Vollstorno, damit keine
  doppelte Gegenbuchung entstehen kann.
  Produktiv abgenommen auf Code-Commit `af01f03` mit Serverbackup
  `/var/backups/workpilot360/20260731-161405-jarvis-invoice-credit`.
  Lokal und produktiv sind 1.446 Tests, TypeScript, Mojibake-/
  Regressionschecks, Prisma-Validierung, leerer Live-Diff und der
  90-Seiten-Build grün. Der permanente Korpus bestand jeweils 110/110; auf
  Produktion wurden zwölf kontrollierte Entwürfe vorbereitet, keine Aktion
  ausgeführt und keine QA-Daten hinterlassen. Die isolierte echte
  Produktions-QA lehnte eine falsch geschriebene Phrase mit HTTP 400 ab,
  erstellte anschließend genau `GU-10100` über -20 EUR netto / -23,80 EUR
  brutto samt PDF, zwei Historienereignissen und einem Logbucheintrag und gab
  beim Replay dieselbe Entität zurück. Originalrechnung, Zahlungsstatus,
  Zeiten und Lager blieben unverändert; Überkorrektur und nachfolgender
  Vollstorno waren blockiert. Alle QA-Rechnungen, Historien, Logbücher,
  Entwürfe und Sitzungen wurden bereinigt. Zusätzlich ist die beim vorherigen
  Storno-Umbau verlorene lesende Rechnungsroute wiederhergestellt und durch
  den Regressionscheck geschützt; die produktive Rechnungsliste liefert
  wieder HTTP 200 inklusive der neuen Referenzfelder. WorkPilot läuft unter
  PID `494621`; KlinikNavigator blieb unverändert unter PID `398228`.

- JARVIS kontrolliertes Rechnungs-Vollstorno 2026-07-31:
  Der zehnte Action-Center-Vertikalschnitt storniert ausschließlich Rechnungen
  im Status `Fakturiert` oder `Bezahlt` vollständig. JARVIS zeigt Original- und
  vorgesehene ST-Nummer, Projekt, Kunde, Status, vollständige negative
  Gegenbuchung, freizugebende Zeiteinträge, Prüfungen und Warnungen. Ein
  nachvollziehbarer Grund mit 3 bis 500 Zeichen ist Pflicht und jede Änderung
  daran erzwingt eine neue serverseitige Prüfung. Erst die exakte,
  groß-/kleinschreibungssensitive Phrase
  `STORNIEREN RE-... MIT ST-...` darf ausführen. Bezahlte Rechnungen weisen
  ausdrücklich darauf hin, dass weder Rückzahlung noch separate
  Zahlungsbuchung ausgelöst werden. Teilgutschrift und Rechnungskorrektur
  laufen ausschließlich über den separaten `invoice.credit`-Fachprozess und
  werden niemals ersatzweise als Vollstorno ausgeführt.
  Normale Rechnungsmaske und JARVIS verwenden gemeinsam
  `src/lib/invoices/invoice-cancellation-service.ts`. Der Service lädt
  Organisation, Rechnung, Positionen, Kosten-/Arbeitszeilen und verknüpfte
  Zeiten neu, bindet sie zusammen mit der vorgesehenen ST-Nummer in einen
  Fingerprint und verwendet organisationsgebundene PostgreSQL-Advisory-Locks.
  In derselben serialisierbaren Transaktion entstehen negative ST-Rechnung
  samt PDF und Positionen, beide Historienereignisse und genau ein
  Projektlogbucheintrag; das Original wechselt bedingt zu `Storniert`, Zeiten
  werden freigegeben und Materialbewegungen gegengebucht. Rollenpaar,
  Impersonation, Sitzung, Revision, TTL, HMAC, Mandant, Doppelklick und Replay
  bleiben fail-closed beziehungsweise exactly-once.
  Lokal sind 1.435 Tests, TypeScript, Mojibake-/Regressionschecks,
  Prisma-Validierung, leerer Prisma-Diff und der 90-Seiten-Build grün. Der
  permanente Korpus bestand 110/110 mit vorbereiteter `invoice.cancel`-
  Vorschau, null Ausführungen und null Rückständen. Der echte lokale Klicktest
  prüfte sichtbare Gegenbuchung, drei Zeitfreigaben, Grundänderung, falsche
  Phrase und Abbruch. Eine isolierte Ausführungs-QA erzeugte genau eine
  ST-Rechnung samt 623-KB-PDF, zwei Historienereignissen und einem Logbuchbeleg;
  Replay lieferte dieselbe Entität. Sämtliche QA-Rechnungen, Historien,
  Logbücher, Entwürfe und Sitzungen wurden vollständig bereinigt.
  Produktiv abgenommen auf Code-Commit `36898b7` mit Serverbackup
  `/var/backups/workpilot360/before-jarvis-cancellation-20260731T164000Z`.
  Der Produktionsserver bestand erneut Prisma-Synchronität, 90-Seiten-Build,
  HTTP-Smokes und den authentifizierten Korpus mit 110/110 Fragen, elf
  vorbereiteten Action-Center-Entwürfen, null Ausführungen und null
  Rückständen. Der isolierte echte Produktionsfall blockierte die falsche
  Phrase mit HTTP 400, lehnte die Teilgutschrift ohne ausführbaren Entwurf ab
  und erzeugte nach exakter Bestätigung genau `ST-10101` mit -100 EUR netto,
  -119 EUR brutto, PDF, beiden Historienereignissen und einem Logbucheintrag.
  Replay blieb exactly-once; anschließend wurden Rechnung, Stornorechnung,
  Historien, Logbuch, Entwurf und Sitzung vollständig entfernt. WorkPilot
  läuft seit der Abnahme unter PID `479268`; KlinikNavigator blieb
  unverändert unter PID `398228`.

- JARVIS kontrollierte Mahnung 2026-07-31:
  Der neunte Action-Center-Vertikalschnitt erstellt für eine überfällige,
  unbezahlte Rechnung im Status `Fakturiert` kontrolliert die nächste Mahnung.
  JARVIS zeigt Rechnung, Projekt, Kunde, offenen Bruttobetrag, Fälligkeit,
  aktuelle und nächste Mahnstufe, Mahndatum, neue Zahlungsfrist, Anschrift,
  Warnungen und Blockaden. Änderungen an den beiden Datumsfeldern erfordern
  eine neue serverseitige Prüfung. Erst die exakte,
  groß-/kleinschreibungssensitive Phrase
  `MAHNUNG MA-RE-...-<Stufe> BIS TT.MM.JJJJ` darf erstellen. Die normale
  Rechnungsmaske und JARVIS verwenden gemeinsam
  `src/lib/invoices/invoice-reminder-service.ts`; Organisation, Rechnung,
  Fälligkeit, Zahlungsstatus, Mahnstufe und Anschrift werden neu geladen und
  in einen Fingerprint gebunden. Ein organisationsgebundener Advisory Lock,
  bedingtes Update und serialisierbare Transaktion schützen Parallelzugriff,
  Doppelklick und Replay. PDF, Mahnstufe, Zeitstempel, genau ein
  Historienereignis und genau ein Projektlogbucheintrag entstehen gemeinsam.
  Bezahlte, nicht fakturierte, nicht fällige, bereits am selben oder späteren
  Tag gemahnte Rechnungen und Mahnstufe 3 bleiben blockiert. Die Aktion
  versendet keine E-Mail und löst weder Zahlung noch Storno aus; der bestehende
  kontrollierte Rechnungsversand bleibt ein separater, erneut zu bestätigender
  Schritt.
  Produktiv abgenommen auf Code-Commit `965de20` mit Serverbackup
  `/var/backups/workpilot360/before-jarvis-reminder-20260731T140442Z`.
  Lokal sind 1.425 Tests, TypeScript, Mojibake-/Regressionschecks, Prisma-
  Validierung, leerer Prisma-Diff und der Build mit 90 Seiten grün. Der
  authentifizierte permanente Korpus bestand lokal und produktiv jeweils
  110/110 Fragen; `invoice.remind` war eine unblockierte Vorschau und keine
  Aktion wurde ausgeführt. Die echten lokalen und produktiven Klicktests
  prüften sichtbare Rechnungsdaten, ungültige Frist, falsche exakte Phrase und
  Abbruch. RE-10119 blieb produktiv `Fakturiert`, unbezahlt, auf Mahnstufe 0
  und ohne Mahnhistorie oder Mahn-Logbuch; alle QA-Entwürfe und Sitzungen sind
  bereinigt. WorkPilot läuft seit der Abnahme unter PID `469803`;
  KlinikNavigator blieb unverändert unter PID `398228`.

- JARVIS kontrollierte Bezahlt-Markierung 2026-07-31:
  Der achte Action-Center-Vertikalschnitt markiert ausschließlich offene,
  fakturierte Rechnungen vollständig als bezahlt. JARVIS zeigt Rechnung,
  Projekt, Kunde, Bruttobetrag, Fälligkeit, Zahlungsdatum, Warnungen und
  Blockaden; ein geändertes Datum muss serverseitig erneut geprüft werden.
  Erst die exakte, groß-/kleinschreibungssensitive Phrase
  `BEZAHLT RE-... AM TT.MM.JJJJ` darf buchen. Normale Rechnungsmaske und
  JARVIS verwenden gemeinsam
  `src/lib/invoices/invoice-payment-service.ts`. Der Service bindet den
  aktuellen Rechnungsstand in einen Fingerprint, verwendet einen
  organisationsgebundenen PostgreSQL-Advisory-Lock und schreibt Status,
  Zahlungsdatum und genau ein Historienereignis in derselben serialisierbaren
  Transaktion. Entwurf, Sitzung, Session- und Effektivrolle, Impersonation,
  Revision, TTL, HMAC, Mandant, Doppelklick und Replay bleiben fail-closed.
  Teilzahlungen sind im aktuellen Datenmodell ausdrücklich nicht enthalten;
  Mahnung, Versand und Storno werden nicht ausgelöst.
  Produktiv abgenommen auf Code-Commit `5ed8f4e` mit Serverbackup
  `/var/backups/workpilot360/before-jarvis-paid-status-20260731T124740Z`.
  Lokal sind 1.413 Tests, TypeScript, Mojibake-/Regressionschecks, Prisma-
  Validierung, leerer Prisma-Diff und der Build mit 90 Seiten grün. Der
  authentifizierte permanente Korpus bestand lokal und produktiv jeweils
  110/110 Fragen; `invoice.mark-paid` wurde als Vorschau erkannt und keine
  Aktion ausgeführt. Der echte produktive Klicktest prüfte vollständigen
  Betrag, leeres und erneut gültiges Zahlungsdatum, falsche Bestätigungsphrase
  und Abbruch. RE-10119 blieb `Fakturiert`, unbezahlt und ohne
  Zahlungshistorie; der einzige QA-Entwurf wurde vollständig bereinigt.
  WorkPilot läuft seit der Abnahme unter PID `453840`; KlinikNavigator blieb
  unverändert unter PID `398228`.

- JARVIS kontrollierter Rechnungsversand 2026-07-31:
  Der siebte Action-Center-Vertikalschnitt versendet ausschließlich bereits
  fakturierte Rechnungen. JARVIS zeigt Absender, Empfänger, CC/BCC, Betreff,
  Nachricht, PDF-/XRechnung-/PDF+XRechnung-/ZUGFeRD-Format, die tatsächlich
  erzeugten Anhänge samt Hash, technische Validierung, Warnungen und
  Blockaden. Änderungen lösen eine neue serverseitige Paketprüfung aus.
  Erst die exakte Phrase `SENDEN RE-... AN <erste Empfängeradresse>` darf den
  gebundenen Versand einmalig an Microsoft 365 übergeben. Organisation,
  Sitzung, Session- und Effektivrolle, Impersonation, Revision, TTL, HMAC,
  Rechnungs-/Dokument-/Absenderfingerprint und Audit bleiben verbindlich.
  Normale Versandmaske und JARVIS verwenden den gemeinsamen Microsoft-Graph-
  Adapter und den gemeinsamen, advisory-lock-geschützten
  `claimDocumentMailDispatch` aus
  `src/lib/invoices/invoice-delivery-service.ts`. Der Versandauftrag wird vor
  dem externen Aufruf mit Status `sending` gespeichert. `sent` wird sicher
  wiederholt beantwortet; `sending`, fehlgeschlagen oder technisch unklar
  wird niemals automatisch erneut gesendet. Fakturierung und Versand bleiben
  zwei getrennte kritische Aktionen.
  Produktiv abgenommen auf Code-Commit `75cc998` mit Serverbackup
  `/var/backups/workpilot360/before-jarvis-invoice-delivery-20260731-121001`.
  Der Produktionsbuild mit 90 Seiten, Prisma-Synchronität und HTTP-Smokes ist
  grün. Der permanente produktive Korpus bestand 110/110 Fragen, bereitete
  acht Vorschauen vor und führte null Aktionen aus; QA-Sitzungen und
  QA-Entwürfe wurden vollständig bereinigt. Der echte produktive Klicktest
  prüfte PDF plus XRechnung, gültiges XML, bestandene KoSIT-Validierung, eine
  falsche Bestätigungsphrase und den Abbruch. Es entstand kein
  Versanddatensatz und keine E-Mail. Lokal sind 1.401 Tests, TypeScript,
  Mojibake-/Regressionschecks, Build und Prisma-Diff grün. WorkPilot läuft
  seit der Abnahme unter PID `446799`; KlinikNavigator blieb unverändert
  unter PID `398228`.

- JARVIS kontrollierte Rechnungsfinalisierung 2026-07-31:
  Der sechste Action-Center-Vertikalschnitt fakturiert einen vorhandenen
  Rechnungsentwurf erst nach erneuter serverseitiger Fakturavorprüfung und
  exakter kritischer Phrase `FAKTURIEREN RE-...`. JARVIS zeigt Rechnung,
  Projekt, Kunde, Leistungsdatum, Netto/Brutto, Prüfstatus, Warnungen und
  Blockaden. Harte Abweichungen wie veränderte Summen oder ein veralteter
  Fachstand sperren die Aktion; Warnungen benötigen die bewusste Bestätigung.
  Organisation, Sitzung, Session- und Effektivrolle, Impersonation, Revision,
  TTL, HMAC, Fachfingerprint, PostgreSQL-Advisory-Lock, bedingter
  Statuswechsel, serialisierbare Transaktion, Audit und Exactly-once-Replay
  bleiben verbindlich. Normale Rechnungsmaske und JARVIS verwenden
  `src/lib/invoices/invoice-finalization-service.ts`. Fakturierung löst
  ausdrücklich keinen Versand, keine Mahnung, keine Bezahlt-Markierung und
  kein Storno aus. Der lokale echte Oberflächentest prüfte falsche und exakte
  Phrase sowie einen Doppelklick; Datenbank und Oberfläche bestätigten genau
  ein Fakturaereignis. Der authentifizierte permanente Korpus bestand 110/110
  Fragen mit null ausgeführten Entwurfsaktionen; alle QA-Daten wurden
  rückstandsfrei bereinigt. Produktiv abgenommen auf Code-Commit `5f1eb85`
  mit Serverbackup
  `/var/backups/workpilot360/before-jarvis-invoice-finalization-20260731T111839Z`.
  Produktionsbuild mit 90 Seiten und leerer Prisma-Live-Differenz ist grün.
  Der produktive echte Oberflächentest bestätigte dieselben Phrasen-,
  Doppelklick-, Audit- und Nebenwirkungssperren; der produktive Korpus bestand
  erneut 110/110 mit null Ausführungen. QA-Rückstände sind null. WorkPilot
  läuft seit der Abnahme unter PID `441648`; KlinikNavigator blieb
  unverändert unter PID `398228`.

- JARVIS Angebots-/Nachtragsentwurf 2026-07-31:
  Der nächste Action-Center-Vertikalschnitt verwendet für normale
  Angebotsmasken und JARVIS die gemeinsame Rechenbasis
  `src/lib/offers/offer-core.ts`. JARVIS erzeugt aus einem eindeutigen
  Angebots- oder Nachtragswunsch zunächst ausschließlich einen
  sitzungsgebundenen Entwurf. Die bearbeitbare Karte umfasst Projekt,
  Absenderfirma, Angebot/Nachtrag samt Bezugsangebot und Nachtragsart,
  Ausführungsmonat beziehungsweise Zeitraum, aktive Katalogpositionen,
  Mengen, Einzelpreise, Positions- und Gesamtnachlass, Umsatzsteuer,
  Einleitungs-/Schlusstext sowie Netto-/Bruttosummen. Katalogzugehörigkeit,
  aktuelle Preise, Projekt-/Kontaktstand und Nachtragsbezug werden
  organisationsgebunden neu geladen; Preisabweichungen bleiben sichtbar.
  Erst eine ausdrückliche Bestätigung darf über
  `src/lib/offers/offer-draft-service.ts` genau ein Angebot mit Status
  `Entwurf` und Historie speichern. Die Angebotsnummer wird innerhalb der
  serialisierbaren Bestätigung unter einem organisationsgebundenen
  PostgreSQL-Advisory-Lock vergeben. JARVIS finalisiert, druckt oder
  versendet das Angebot nicht. Rollenpaar, Impersonation, Sitzung,
  Organisation, Revision, TTL, HMAC, Fachkontext, Audit und Exactly-once
  bleiben verbindlich.
  Produktiv abgenommen auf Code-Commit `5864a1c` mit Serverbackup
  `/var/backups/workpilot360/before-jarvis-offer-drafts-20260731T081326Z`.
  Der Produktionsbuild mit 90 Seiten, Schemaabgleich und HTTP-Smokes ist
  grün. Der echte Oberflächentest erzeugte trotz Doppelbestätigung genau
  einen Entwurf samt einer Historie und einem Ausführungsereignis, prüfte
  Preisabweichung, Nachtragsabbruch und Mitarbeiter-Rollensperre und
  bereinigte anschließend alle eindeutig zugeordneten QA-Daten. WorkPilot
  läuft seit der Abnahme unter PID `422034`; KlinikNavigator blieb
  unverändert unter PID `398228`.

- JARVIS Kalkulationsrechner-Dialog 2026-07-31:
  Das verbindliche Inventar in
  `docs/JARVIS_KALKULATIONSRECHNER_INVENTAR.md` grenzt die zwei produktiv
  freigegebenen Rechner Winterdienst und Fahrt/Fahrzeugkosten von
  Fahrzeugstammdaten, vorbereiteter Vermietung, Katalog-Stammdatenkalkulation,
  geschützten Mitarbeiterkosten und reinen Analysen ab. JARVIS erkennt
  konkrete freie Sprachwünsche, übernimmt nur eindeutig genannte Werte und
  zeigt die verbleibenden Pflichtangaben; ein allgemeiner Kalkulationsstart
  bietet zuerst die beiden freigegebenen Rechner an. Winterdienst führt
  zusätzlich einen expliziten Nachweis der vom Benutzer angegebenen Felder,
  damit fachlich erlaubte Nullwerte möglich bleiben, leere Entwurfsnullen aber
  niemals als stillschweigende Annahme berechnet werden. Fahrten lösen ein
  eindeutig benanntes aktives Fahrzeug auf, übernehmen Strecke sowie
  ausdrücklichen manuellen Preis oder Livepreiswunsch und verwenden weiterhin
  ausschließlich aktuellen Fahrzeugstamm und zentrale Kraftstoffquelle.
  Rechen-, Rollen-, Organisations-, Sitzungs-, Impersonations-, Revisions-,
  HMAC-, TTL-, Snapshot-, Audit- und Exactly-once-Vertrag bleiben
  unverändert. Fahrzeugvermietung, Katalogpreisänderungen und
  Mitarbeiterkostendaten bleiben fail-closed beziehungsweise getrennte,
  noch nicht freigegebene Hochrisikoaktionen.

- JARVIS manuelle Zeiterfassung 2026-07-30:
  Der dritte produktive Action-Center-Vertikalschnitt bereitet natürliche
  Wünsche für manuelle Projektzeit, unproduktive Zeit und rückwirkend
  nachzutragende Stempelungen als persistenten, 15 Minuten gültigen Entwurf
  vor. Die sichtbare Maske erfasst Mitarbeitenden, Projekt oder unproduktive
  Tätigkeit, Datum, Beginn, Ende, Pause, Kommentar, Abschluss- und
  Überstundenstatus. Einmalprojekte verlangen ein aktives finales Angebot
  oder eine begründete Buchung ohne Angebotszuweisung; Stunden-Dauerläufer
  verlangen Gewerk plus aktive positive Stundenleistung desselben Gewerks;
  Monatspauschalen bleiben frei von künstlichen Angebotsfeldern. Mitarbeitende
  dürfen nur eigene explizit manuelle Einträge anlegen, berechtigte Rollen
  auch Einträge für andere. Normale manuelle Maske und JARVIS schreiben über
  `src/lib/time/project-time-entry-service.ts`; dieser berechnet die Dauer
  aus Zeitfenster minus Pause, lädt alle Fachobjekte organisationsgebunden neu
  und blockiert auch fremdmandantlich belegte Ausführungs-IDs. Bestätigung
  bindet Organisation, Sitzung, beide Rollen, Impersonation, Revision, TTL,
  Integrität und Fachstand. Zeitdatensatz, deduplizierter Projektlogbuchbeleg,
  Entwurfsstatus und Audit entstehen gemeinsam in einer serialisierbaren
  Transaktion; Doppelklick und Replay bleiben exactly-once. Starten, Pausieren,
  Fortsetzen und Stoppen einer persönlichen Live-Stempelung ist ausdrücklich
  nicht Teil dieses Schnitts.

- Persönlicher Servicezugang und späteres Kundenportal 2026-07-30:
  Das öffentliche OK-immocare-Anfrageformular bleibt ohne vorgeschaltete
  Auswahl unmittelbar nutzbar. In der Kopfzeile ergänzt ein eigenständiger
  Button `Ich bin bereits Kunde` den normalen Einstieg. Er öffnet einen
  smartphoneoptimierten Dialog für `Kundennummer oder Service-ID` plus
  sechsstelligen Service-PIN. Die aktuell umgesetzte Oberfläche ist bewusst
  nur das sichtbare Fundament: Kundenerkennung, PIN-Ausgabe und -Hashing,
  Fehlversuchs-/Sperrlogik, widerrufbare Sitzung, organisationsgebundene
  Projektfreigabe, Formularvorbelegung und die eindeutige Quellenverknüpfung
  einer Anfrage müssen vor Aktivierung vollständig serverseitig umgesetzt
  und sicherheitsgeprüft werden. Ein kurzer PIN darf niemals allein
  organisationsfremde oder sensible Projekt-, Dokument- oder Rechnungsdaten
  offenlegen. Die vorhandene Invariante bleibt bestehen: kein erstbestes
  offenes Projekt automatisch wählen; entweder wählt der verifizierte Kunde
  ein freigegebenes Projekt bewusst oder die Anfrage bleibt ohne
  Projektbindung im Online-Posteingang.
  Ein späteres echtes Kundenportal mit Status, Terminen, Dokumenten und
  Kommunikation ist ausdrücklich als wertvolle Ausbaustufe vorgemerkt, aber
  nicht Teil des jetzigen Formularfundaments. Dieser Vertikalschnitt muss
  separat und bewusst fachlich, rollenbezogen, datenschutzrechtlich und
  sicherheitstechnisch konzipiert werden.

- Online-Anfragen Projektstandard und mobile Leistungsauswahl 2026-07-30:
  Die kontrollierte Umwandlung einer Online-Anfrage verwendet keine
  `ONL-...`-Projektnummer mehr. Innerhalb der serialisierbaren
  Umwandlungstransaktion schützt ein organisationsgebundener PostgreSQL-
  Advisory-Lock die Ermittlung der nächsten globalen Projektnummer. Das
  Präfix stammt aus dem ausgewählten WorkPilot-Gewerk; der Titel folgt dem
  normalen Muster `Projekt <Nummer> - <Gewerk>`. Die `OKI-...`-Referenz bleibt
  ausschließlich als Anfrage-, Quellen-, Audit- und Logbuchreferenz erhalten.
  Für `Sonstige / Andere Leistung` wird kein bestehendes Gewerk vorgetäuscht;
  die Anfrage speichert `tradeId=null`, den lesbaren Leistungsnamen und erhält
  bei Umwandlung das neutrale Präfix `SON`.
  Das öffentliche Formular zeigt in Schritt 2 zuerst ausschließlich
  `Grünpflege`, `Objektbetreuung` und `Hausmeisterservice`. Alle weiteren
  freigegebenen WorkPilot-Gewerke sowie `Sonstige / Andere Leistung` liegen
  hinter einem auffälligen, barrierefrei beschrifteten Aufklapper mit
  sichtbarer Anzahl. Cross-Selling bleibt nur im Angebotsmodus und verwendet
  weiterhin ausschließlich tatsächlich freigegebene Gewerke.

- JARVIS Online-Anfragen-Liveadapter 2026-07-30:
  JARVIS kennt den produktiven Posteingang nicht mehr nur als
  Navigationshilfe. Der organisationsgebundene Read-only-Adapter
  `src/lib/jarvis/online-request-analysis.ts` beantwortet für berechtigte
  Vertriebs-/Projektpipeline-Rollen Live-Zählungen und Statuslisten, findet
  eine exakte `OKI-...`-Referenz und fasst Inhalt, Anliegen, Gewerk,
  Verantwortung, Kundenprüfung, Kontaktpräferenz, Wunschdatum,
  Zusatzinteressen, Fotoanzahl und Auditstand zusammen. Netzwerk-Hashes,
  Sicherheitssignale und Bild-Binärdaten werden dafür nicht geladen.
  Sitzungs- und effektive Rolle müssen beide `online-request.read` erlauben;
  Mitarbeitende und eine Managementrolle in Mitarbeiter-Impersonation werden
  vor der Datenabfrage abgewiesen. Reine Bedien-, Foto-, Sicherheits-,
  Anliegenarten- und Umwandlungsfragen bleiben im deterministischen
  Wissenspfad. Jede Live-Antwort bewahrt die Invariante: niemals automatische
  Zuordnung zu einem Bestandsprojekt; bewusste Umwandlung erzeugt immer ein
  neues Projekt unter `OK immocare → Lead / Klärung`. Der Adapter ist
  ausschließlich lesend und führt weder Kundenentscheidung noch Umwandlung
  aus. Seit der Projektstandard-Fortschreibung liest JARVIS bei einer bereits
  umgewandelten Anfrage zusätzlich organisationsgebunden die tatsächliche
  Projektnummer und den Titel. Die `OKI-...`-Referenz wird niemals als
  Projektnummer dargestellt; erklärt werden Gewerk-Präfix, globale Sequenz und
  das neutrale Präfix `SON` für `Sonstige / Andere Leistung`.

- Verbindlicher JARVIS-Kalkulationsausbau 2026-07-30:
  JARVIS soll die vorhandenen Kalkulations-Rechner nicht nur öffnen und
  erklären, sondern als eigenen sicheren Action-Center-Vertikalschnitt
  dialoggeführt bedienen. Berechtigte Mitarbeitende können eine Winterdienst-,
  Fahrten- oder freigegebene Fahrzeugkalkulation in natürlicher Sprache
  beginnen. JARVIS fragt fehlende Eingaben ab und verwendet ausschließlich
  dieselben zentralen Rechenfunktionen wie die normale WorkPilot-Oberfläche;
  eigene KI-Ersatzformeln oder unbemerkte Schätzwerte sind verboten.
  Eingaben, Annahmen, Preisquelle, Varianten, Selbstkosten, Verkaufspreis,
  Gewinn, Aufschlag und Marge werden vor einer Folgeaktion sichtbar erklärt.
  Speichern oder Übernehmen benötigt die vorhandene Rollenberechtigung,
  ausdrückliche Bestätigung, erneute serverseitige Prüfung, unveränderlichen
  Snapshot, Audit und Idempotenz. Kunden-, Projekt-, Angebots- oder
  Paketzuordnungen werden nie erfunden. Fahrzeugstammdaten, Katalogpreise,
  Angebote oder Pakete werden nicht als Nebenwirkung verändert. Winterdienst
  darf ohne Projekt gerechnet, aber nur entsprechend der bestehenden
  Projektzuordnungsregel gespeichert werden. Vermietung bleibt bis zur
  vollständigen Fachfreigabe fail-closed. Die vollständige Definition of Done
  steht in `docs/JARVIS_ENTWICKLUNGSPLAN.md`, Abschnitt 7.15.

- JARVIS Winterdienst-Kalkulationsvertikalschnitt 2026-07-30:
  Der erste Rechner aus Abschnitt 7.15 ist als persistenter Action-Center-
  Ablauf umgesetzt. Eine eindeutige Aufforderung wie `Starte eine
  Winterdienst-Kalkulation` öffnet einen organisations-, sitzungs-, rollen-
  und revisionsgebundenen Entwurf. Alle zwölf Eingaben beginnen bewusst leer
  beziehungsweise mit `0`; JARVIS darf keine Werte aus UI-Defaults erfinden.
  Die Vorschau verwendet ausschließlich
  `src/lib/winter-service/calculation.ts` und zeigt Bereitschaft sowie die
  drei vorhandenen Varianten. Aktive interne Mitarbeitende einschließlich
  `MITARBEITER` dürfen rechnen; `GAST` bleibt gesperrt. Ein dauerhaftes
  Speichern ist nur möglich, wenn sowohl Sitzungs- als auch effektive Rolle
  `canManageProjects` erfüllen und ein aktuelles, organisationsgebundenes
  Kundenprojekt bewusst ausgewählt wurde. Die Bestätigung lädt Projekt,
  Kunde, Akteur, Rollen und Projektstand erneut, rechnet serverseitig neu und
  erzeugt transaktional genau eine unveränderliche
  `WinterServiceCalculation`-Version samt Audit. Replay, Doppelklick,
  fremde Sitzung, Rollenwechsel, Payload-Manipulation und veralteter
  Projektstand sind fail-closed. Kalkulieren verändert weder Projekt,
  Katalog, Angebot, Paket noch Fahrzeugstammdaten. Fahrten- und
  Fahrzeugkalkulationen bleiben die chronologisch nächsten Rechnerblöcke;
  Vermietung bleibt fail-closed.

- JARVIS Fahrten-/Fahrzeugkosten-Vertikalschnitt 2026-07-30:
  Der zweite freigegebene Rechner aus Abschnitt 7.15 ist ein persistenter
  Action-Center-Ablauf für `Fahrtenkalkulation`, `Fahrtkosten` und
  `Fahrzeugkostenkalkulation`. Diese Begriffe bezeichnen fachlich denselben
  aktiven-fahrzeuggebundenen WorkPilot-Rechner; es existiert keine zweite
  freigegebene Fahrzeugformel, und JARVIS darf keine erfinden. Der Entwurf
  beginnt ohne Fahrzeug, Strecke oder geschätzte Preise. Fahrzeug,
  Verbrauch, Selbstkosten/km, Verkauf/km und Änderungsstand werden
  organisationsgebunden aus dem aktiven Fahrzeugstamm geladen. Kraftstoff
  stammt transparent aus der zentralen Tankerkönig/MTS-K-Quelle oder aus
  einer bewusst gewählten manuellen Eingabe; Elektrofahrzeuge verwenden
  kraftstoffseitig `0`. Berechnet wird ausschließlich über
  `src/lib/vehicle-calculation.ts`, ausdrücklich ohne Personalkosten.
  Interne Rollen dürfen rechnen, `GAST` nicht. Dauerhaftes Speichern verlangt
  `canManageProjects` für Sitzungs- und effektive Rolle, ausdrückliche
  Bestätigung, aktuellen Fahrzeugstand und erzeugt transaktional genau eine
  unveränderliche `VehicleCalculation` mit Eingabe-, Ergebnis-, Fahrzeug-
  und Preisquellen-Snapshot sowie Audit. Replay, Doppelklick, fremde Sitzung,
  Rollenwechsel, Payload-/Notizmanipulation und veraltete Stammdaten sind
  fail-closed. Auch der vorhandene direkte Speicherweg ersetzt angelieferte
  Kilometerwerte vor dem Schreiben erneut durch aktuelle Fahrzeugstammdaten.
  Fahrzeugstammdaten-Bearbeitung ist keine Kalkulationsnebenwirkung.
  Vermietung, Mietpreise, Verfügbarkeit, Vertrag und Rückgabe bleiben bis zur
  separaten Fachfreigabe fail-closed.

- JARVIS projektartgerechte Terminplanung 2026-07-30:
  Die bisherige harte Blockade `Projektartgerechte Terminmaske` ist technisch
  ersetzt. Normale Planung, Terminwunsch und JARVIS verwenden für neue
  Projekttermine denselben serverseitigen Planungs-Batch. Der Kern leitet die
  Variante ausschließlich aus dem aktuellen Projekt ab und prüft unmittelbar
  vor dem Schreiben erneut Organisation, wirksamen Akteur, Rolle,
  Projektstand, aktive Mitarbeitende, Board/Gruppe, Abwesenheiten,
  Projektdubletten, Serie und Kontingent.
  Einmalprojekte verlangen Beschreibung und ein aktives finales Angebot mit
  Stundenkontingent; der Termin muss im Ausführungsmonat des Angebots liegen.
  Stunden-Dauerläufer verlangen Beschreibung, Termin-Gewerk und eine aktive,
  planungsrelevante Abrechnungsleistung desselben Gewerks. Monatspauschalen
  zeigen und prüfen das freie Kontingent für jeden betroffenen Serienmonat.
  Alle drei Masken erlauben mehrere Mitarbeitende. Serien gibt es nur für
  Dauerläufer. Termin und Terminwunsch bleiben dieselbe Maske; der
  Terminwunsch unterscheidet sich ausschließlich durch
  `approvalStatus=requested` und die spätere Freigabe.

  Überschreitet ein Einmalprojekt das Angebotskontingent oder eine
  Monatspauschale ihr Monatskontingent, liefert die Vorprüfung einen an
  Projektstand, Angebot, Personen, Zeiten, Serie und Kontingent gebundenen
  SHA-256-Fingerprint. Ausführung ist erst mit genau diesem Prüfstand und
  einer Begründung ab zehn Zeichen möglich. Grund und Überplanungsart werden
  am Batch und an jedem Termin gespeichert, die Historie enthält den Grund,
  und Führung/Geschäftsführung/Admin erhalten je Batch höchstens eine sichtbare
  App-Meldung. Terminwunsch-Verantwortliche und eingeplante Mitarbeitende
  werden weiterhin passend informiert.

  Mehrfachmitarbeiter und Serien werden nicht mehr nacheinander aus dem Client
  geschrieben. Eine serialisierbare Datenbanktransaktion legt Batch,
  sämtliche `PlanningEntry`-Zeilen, Historien und Meldungen vollständig oder
  gar nicht an. `organizationId + requestId`, kanonischer Payload-Hash,
  deterministische Termin-IDs, Ergebnisnachweis und bis zu drei
  Serialisierungswiederholungen sichern Exactly-once, Doppelklick, Replay und
  parallele Kontingentnutzung ab. JARVIS nutzt denselben Kern mit der
  Entwurfs-ID als `requestId`; der bestehende Sitzungs-, HMAC-, TTL-,
  Revisions-, Kontext- und Auditvertrag bleibt erhalten. Neue additive
  Speicherung: `PlanningBatch` sowie `PlanningEntry.batchId`,
  `overbookingKind`, `overbookingReason`; defensive Runtime-DDL und additive
  Migration sind beide vorhanden.

  Vollständige Releaseabnahme: Sicherheitsbundle
  `.codex-safety/before-jarvis-project-planning-masks-20260730-135215.bundle`,
  Serverbackup
  `/var/backups/workpilot360/before-jarvis-project-planning-20260730T123317Z`
  sowie exakter Vor-Cleanup-Nachweis
  `/var/backups/workpilot360/qa-release-0d23d19-before-cleanup-20260730T1414Z.json`
  mit SHA-256
  `c19ff1ca3e57315a4cfb8c4b871bd2e03ab44ed67c61de38f983d8c2fba7be8d`.
  Der finale Planungscode ist auf `92fbbd2` produktiv. 105 Testdateien mit
  1.219/1.219 Tests, TypeScript, Regression, Mojibake, Prisma-Validierung,
  leerer Schema-/Datenbank-Diff, `git diff --check` und Produktionsbuild mit
  89 Seiten sind grün.

  Die echte Produktionsoberfläche bestätigte für `MKG-209` die
  Einmalprojekt-Maske mit mehreren Mitarbeitenden, finalem Angebot,
  Ausführungsmonat, freiem Angebotskontingent, begründeter Überplanung und
  ohne Serie. Für `MKG-400` wurden Monatspauschale, Mehrmitarbeiter-Serie,
  Monatskontingent und lesbare Serienregel bestätigt. Ein realer
  Stunden-Dauerläufer ist in den produktiven Stammdaten derzeit nicht
  konfiguriert; dessen Fachdialog und Variante sind durch produktive
  deterministische JARVIS-Antworten und Variantentests belegt, ohne
  Geschäftsdaten umzudeuten.

  Die kontrollierten Schreibnachweise umfassten einen überplanten
  Mehrpersonen-Terminwunsch sowie eine Mehrpersonen-Monatsserie. Beide
  Vorgänge bestanden Replay ohne Doppelanlage, Payload-Konflikt mit HTTP 409,
  Batch-/Historien-/Meldungsprüfung und exakten Cleanup. Danach blieben
  0 QA-Termine, 0 QA-Historien, 0 QA-Meldungen und 0 QA-Batches; der
  ursprüngliche Projekt- und Angebotsstand wurde exakt wiederhergestellt.
  Der vollständige sichtbare JARVIS-Lauf bestand 110/110 Fragen; die finale
  gezielte Abnahme bestätigte zusätzlich projektbezogene Terminmasken,
  Stunden-Dauerläufer-Felder, Mehrmitarbeiter-Serie, Überplanung und
  Termin-/Terminwunsch-Gleichheit. 50 öffentliche Dashboard-Aufrufe lagen
  zuletzt bei 169 ms im Mittel und 192,1 ms p95. HTTP war 200, das
  Produktionsfehlerlog blieb seit 13:57:40 UTC unverändert bei 146.549
  Zeilen. WorkPilot360 lief dabei separat; `kliniknavigator` blieb mit PID
  242528 unangetastet.

- JARVIS Action Center Termin-/Terminwunsch-Vertikalschnitt 2026-07-30:
  Produktionsstand `93fd70f`: Der persistente 15-Minuten-Entwurf übernimmt die vollständige
  Organisations-, Sitzungs-, Akteurs-, Rollen-, Impersonations-, Revisions-,
  Hash-, HMAC-, TTL- und Auditbindung des Aufgabenwegs. Jede Änderung sperrt
  die Bestätigung bis zur erneuten serverseitigen Prüfung. Sichtbar geprüft
  werden Berliner Datum/Zeit, aktive Person, Rolle und Terminart,
  Projektkontext, Board/Gruppe, gleichartige Projektplanung,
  Überschneidung, genehmigte Abwesenheit, landesspezifischer Feiertag,
  Wochenende sowie Projektart und Abrechnungsweg. Blockaden verhindern
  technisch das Schreiben;
  Überschneidung, Feiertag und Wochenende bleiben entsprechend dem bestehenden
  Planning-Verhalten bewusst sichtbare Warnungen.
  Mitarbeitende dürfen ausschließlich einen eigenen Terminwunsch vorbereiten;
  bestätigte Termine und fremde Personen bleiben Führung, Geschäftsführung
  oder Admin vorbehalten. Eine spätere ausdrückliche Bestätigung würde den
  Entwurf atomar beanspruchen und ausschließlich den unveränderten,
  rollengeprüften `POST /api/planning-entries` mit der Entwurfs-ID als
  idempotentem Schlüssel aufrufen. Die allgemeine JARVIS-Maske bildet die drei
  vorhandenen Terminvarianten jedoch noch nicht vollständig ab:
  Einmalprojekte benötigen Angebotszuordnung, Kontingent und gegebenenfalls
  Ausführungsmonat; Stunden-Dauerläufer Gewerk, Abrechnungsleistung und die
  Entscheidung zu weiteren Mitarbeitenden; Monatspauschalen ihren Monats- und
  Serienkontext. Beschreibung ist in der normalen Maske Pflicht. Deshalb
  setzt der Server für alle drei Varianten weiterhin fail-closed die Blockade
  `Projektartgerechte Terminmaske`; es gibt im JARVIS-UI keinen produktiven
  Anlageknopf.

  Die finale Produktionsabnahme erfolgte auf `93fd70f` nach einem separaten,
  vollständig geprüften 322-MB-Backup unter
  `/var/backups/workpilot360/before-jarvis-tailored-planning-clarifications-20260730T100824Z`.
  102 Testdateien mit 1.173/1.173 Tests, TypeScript, Regression, Mojibake,
  Prisma-Validierung, leerer Schema-/Datenbank-Diff, `git diff --check` und
  Produktionsbuild sind grün. Der anschließend von Grund auf ausgeführte
  sichtbare 110er-Lauf beantwortete 110/110 Fälle ohne technischen Fehler,
  leere Antwort oder kritischen Qualitätsbefund. Jede Antwort wurde zusätzlich
  auf Relevanz, fachliche Richtigkeit, Angemessenheit, Konkretheit,
  Datenbasis und Sicherheitsverhalten geprüft. Der UI-Lauf lag bei 4,95 s im
  Mittel und 5,44 s p95; 50 öffentliche Dashboard-Aufrufe lagen bei 70,8 ms
  im Mittel und 159,9 ms p95.

  Der Live-Terminwunsch `Live-Abnahme` wurde gespeichert, sichtbar in
  `Live-Abnahme geändert` bearbeitet, serverseitig erneut geprüft und wegen
  der Projektartmaske weiterhin gesperrt. Der bewusste Abbruch führte zu
  `state=cancelled`, Revision 2 und der Auditfolge
  `draft_created → draft_rechecked(preflight_blocked) →
  draft_cancelled(user_cancelled)`. Die Datenbank enthält dafür null
  `PlanningEntry`-Datensätze. Browserkonsole und neue JARVIS-Fehler blieben
  leer; der Produktionsfehlerlog blieb während des finalen Laufs stabil bei
  146.513 Zeilen. WorkPilot360 ist online; `kliniknavigator` blieb mit PID
  242528 unangetastet.

  Nach außen bleibt JARVIS ein einziger Assistent. Systemhilfe, Management,
  Vertrieb, Projektprüfung und sichere Aktionen werden intern als
  spezialisierte Fähigkeiten geroutet; getrennte sichtbare KI-Chats werden
  nicht weitergeführt.

  `Noch nicht freigegeben` ist kein pauschaler Endzustand. Jeder solche Fall
  muss fachlich einer von vier Klassen zugeordnet werden: vorhandene
  WorkPilot-Funktion noch nicht sicher an JARVIS angebunden; JARVIS-
  Vertikalschnitt fachlich unvollständig; bewusst sicherheitsgesperrte
  Hochrisikoaktion; oder außerhalb des aktuell beschlossenen
  Entwicklungsumfangs. Für die ersten beiden Klassen gehört ein konkreter
  nächster Ausbauschritt in den Entwicklungsplan. Behauptet JARVIS eine
  fehlende Freigabe, obwohl die vorhandene Funktion sicher erklärt oder
  genutzt werden könnte, ist das ein Routing-/Qualitätsfehler und kein
  bestandener Sicherheitstest. Aktiviert wird niemals nur ein Schalter:
  Rollen, Fachprüfung, Vorschau, bewusste Bestätigung, Audit, Exactly-once,
  Browser- und Live-Abnahme müssen für den jeweiligen Vertikalschnitt
  vollständig nachgewiesen sein.

- JARVIS Action Center Aufgabenabschluss und Termin-Vorschau 2026-07-30:
  Der Aufgaben-Vertikalschnitt ist auf Produktion vollständig freigegeben.
  Entwurf, Pflichtfelder, erneute Prüfung nach Änderungen, Abbruch, Ablauf,
  Rollen-/Session-/Organisationsbindung, Integritätsnachweis, Doppelklick,
  Replay und Exactly-once-Ausführung wurden über die echte Oberfläche und
  direkt in der Datenbank abgenommen. Der finale Stand `fff308f` beantwortete
  110/110 menschennahe Fragen qualitativ passend; anschließend bestanden zehn
  weitere Aufgaben-Aktionsfälle. Ein Doppelklick erzeugte exakt eine Aufgabe
  und genau ein `draft_confirmed_and_executed`-Ereignis, der Abbruch keine
  Aufgabe. Der Produktionsfehlerlog blieb unverändert.
  Die erste Termin-Vorschau ist ebenfalls produktiv, speichert aber bewusst
  noch nichts. Sie verlangt geöffnetes Projekt, gültiges Berliner
  Datum/Zeitfenster, Titel und eine eindeutig aktive Person, zeigt
  menschenlesbare Werte ohne interne IDs und besitzt keine Bestätigen- oder
  Speichern-Schaltfläche. Wiederholte ungültige Angaben behalten eine
  konkrete Feld- beziehungsweise Plausibilitätsrückfrage.
  Nächster Phase-4-Vertikalschnitt ist der serverseitig persistente Termin-
  und Terminwunsch-Entwurf. Er muss die Sicherheitsinvarianten des
  Aufgabenentwurfs übernehmen und zusätzlich Planungskonflikte,
  Abwesenheiten, Feiertage, Board/Gruppe sowie Projekt- und gegebenenfalls
  Angebots-/Kontingentbezug vor einer möglichen Ausführung prüfen. Eine echte
  Planungsanlage bleibt bis zur vollständigen Fach-, Sicherheits-, Browser-
  und Live-Abnahme gesperrt.

- JARVIS Rechnungsentwurf und permanente 110er-Suite 2026-07-31:
  `invoice.prepare` ist als vollständiger sicherer Action-Center-
  Vertikalschnitt verfügbar. JARVIS erkennt natürliche Erstellungswünsche,
  öffnet eine bearbeitbare Rechnungskarte und zeigt Projekt, Firma,
  Leistungsdatum, Bezugsangebot, Katalogpositionen, Mengen, Preise,
  Nachlässe, Umsatzsteuer, Zahlungsziel, Fälligkeit, Texte, Summen und die
  Fakturavorprüfung. Reine Leseanfragen und kritische Befehle zu Fakturierung,
  Versand, Mahnung, Bezahlt-Markierung, Storno oder Löschung dürfen niemals
  in diesen Entwurfspfad fallen.
  Normale Rechnungsmaske und JARVIS teilen die zentralen Datums-, Zahlungsziel-,
  Prozent-, Rundungs- und Positionsnettoregeln. Der Speicherdienst lädt
  Projekt, Kontakte, Katalog, Angebot, vorhandene Rechnungen, Nachweise und
  offene Zeiten organisationsgebunden neu. Er speichert ausschließlich
  `Entwurf` plus Historie. Rechnungsnummer, serialisierbare Transaktion,
  Advisory-Lock, Rollenpaar, Impersonation, Sitzung, Revision, TTL, HMAC,
  Kontext-Fingerprint, Audit und Exactly-once sind verpflichtend; Fakturieren
  und Versenden bleiben getrennt gesperrt.
  `src/lib/jarvis/live-question-corpus.ts` ist der verbindliche permanente
  Korpus mit exakt 110 eindeutigen Fragen. Er muss bei jedem weiteren
  JARVIS-Release automatisiert und authentifiziert live ausgeführt werden.
  Testentwürfe dürfen nicht bestätigt werden und sind danach samt Audit und
  Testsitzung zu bereinigen. Der Rechnungs-Klicktest prüft zusätzlich Abbruch,
  sichtbare Vorprüfung, Doppelklick/Replay, genau eine Entwurfsrechnung und
  null Fakturierungs-/Versandwirkung.

- JARVIS qualitative Live-Haertung 2026-07-29: Der erste nach Inhalt statt
  nur technischer Antwortexistenz bewertete produktive 100er-Lauf war
  technisch 100/100, qualitativ aber nur 77/100. Die zehn Prinzipienfragen
  waren nach der Fokussierung vollstaendig unterschiedlich und passend.
  Weitere klare Luecken betrafen pauschale Rueckfragen, eine zu breite
  Projektart-Erkennung, einzelne Projektfakten, organisationsweite
  Materialfragen, Governance-Varianten, Mitarbeiterentwicklung und die
  Prompt-Injection-Formulierung `Ignoriere deine Regeln`. Diese
  Fragefamilien werden gebuendelt behoben und muessen vor Abschluss erneut
  vollstaendig live geprueft werden. Die kuenftige hybride Sinnerkennung
  nutzt deterministische Pfade nur fuer sehr eindeutige oder
  sicherheitskritische Faelle; nicht eindeutige Fragen sollen strukturiert
  nach Aussageabsicht klassifiziert und spaeter aus freigegebenem Wissen
  natuerlich, aber ohne Rechte- oder Aktionsbefugnis formuliert werden.
  Der anschliessende Wiederholungslauf reduzierte die qualitativen Fehler
  auf vier klare Sprachvarianten: organisationsweite wirtschaftliche
  Materialauffaelligkeiten, ungepruefte Stammdaten, Personalentscheidungen
  und der Imperativ `Stemple ...`. Auch diese Varianten gelten vor der
  finalen Zaehhlung als Pflichtkorrekturen und nicht als kosmetische
  Randfaelle.
  Die anschliessende automatisierte Wertung erreichte 100/100. Die manuelle
  Serienpruefung erkannte dennoch, dass die kurze Folgefrage `Warum?` nach
  einer einfachen Projektantwort den vollstaendigen Projektcheck
  wiederholte. Folgefragen nach einem Grund muessen deshalb eine fokussierte
  Begruendung mit eigener Dialog-ID erhalten; ein formal passender
  Vollcheck zaehlt hier nicht als qualitative Antwort.
  Eine reine API-Nachhaertung genuegt dabei nicht: Solange die Antwort noch
  eine strukturierte Vollcheck-Karte enthaelt, rendert die echte Oberflaeche
  diese Karte statt der kurzen Begruendung. Die `Warum?`-Antwort muss daher
  bewusst ohne `structured`- und `records`-Vollcheck ausgeliefert und am
  sichtbaren UI-Text abgenommen werden.

- JARVIS fokussierte Prinzipienantworten 2026-07-29: Eine allgemeine
  Prinzipienfrage darf weiterhin die vollstaendige Uebersicht liefern. Fragt
  ein Mensch nach einem einzelnen Prinzip, muss JARVIS genau dieses Prinzip
  verstaendlich erklaeren, auf praktisches Verhalten uebertragen und darf
  nicht erneut die identische Gesamtliste ausgeben. Die Abnahme prueft deshalb
  nicht nur Themenrouting und technische Gueltigkeit, sondern auch
  Antwortspezifitaet und Wiederholungen ueber die gesamte Fragenserie.
  Eine technisch vorhandene Antwort gilt nicht als bestanden: Jede
  Live-Antwort wird zusaetzlich auf inhaltliche Richtigkeit, konkrete
  Fragerelevanz, Verstaendlichkeit, Angemessenheit und Handlungsnutzen
  bewertet. Serien werden ausserdem auf Wiederholung, Widerspruch,
  Ausweichantworten und unnoetige Textmenge geprueft.

- JARVIS Prinzipien- und Kontext-Haertung 2026-07-29: Natuerliche
  Fragen zu den neun Unternehmensprinzipien, Sicherheitsgrenzen,
  menschlicher Verantwortung, Mitarbeiterentwicklung, Kontinuitaet und
  Fuehrungsunterstuetzung werden deterministisch beantwortet. JARVIS
  kennzeichnet unsichere Daten, erfindet nichts, erstellt keine heimlichen
  Persoenlichkeitsprofile und laesst fachliche Entscheidungen beim Menschen.
  Passwort- und Session-Token-Anfragen sind auch in natuerlicher
  Pluralform ausdruecklich gesperrt. Haeufige Aufgaben-, Rechnungs- und
  Fakturierungs-Hilfefragen wurden ergaenzt. Material-, Stundensatz-,
  Wirtschaftlichkeits-, Abrechnungs- und Naechster-Schritt-Fragen bleiben bei
  geoeffneter Projektakte im Projektkontext statt in eine
  Unternehmensauswertung abzurutschen.
  Der produktive 100er-Lauf hat weitere natuerliche Varianten fuer sichere
  Faehigkeiten, noch gesperrte Aktionen, personenbezogene und ungepruefte
  Stammdaten sowie Onboarding und wiederkehrende Aufgaben geliefert; auch
  diese Formulierungen sind jetzt abgedeckt. Governance-Fragen haben Vorrang
  vor dem zufaellig geoeffneten Projektkontext. Die Tippfehler `kome` und
  `Projecktnummer`, projektbezogene Naechster-Schritt-Fragen sowie der
  Anschluss `ohne Fachbegriffe` nach einer Projektpruefung werden im
  bestehenden Dialogkontext weitergefuehrt. Direkte Stempelbefehle werden
  sicher als nicht freigegebene Schreibaktion erkannt.
  Der erneute Live-Lauf fuehrte ausserdem `Pruef mal das Projekt hier` sicher
  in den Vollcheck, haelt globale Fragen wie `bei uns offene Rechnungen`
  weiterhin ausserhalb der geoeffneten Projektakte und beantwortet
  `Wie kome ich zur Buchhaltung?` deterministisch. Ein rueckwirkender
  Stempelbefehl erhaelt eine ausdrueckliche Nichtausfuehrungs-Meldung.

- JARVIS Action-Center Proxy-Origin 2026-07-29: Schreibende
  Aufgabenentwurf-Anfragen akzeptieren den vom Browser gesendeten
  oeffentlichen HTTPS-Origin nun auch dann, wenn Next.js hinter dem
  Reverse-Proxy intern eine localhost-URL sieht. Die Pruefung verwendet den
  zentralen validierten Public-Origin-Resolver; ein fremder Origin bleibt mit
  403 gesperrt. Der TTL-Test des persistenten Entwurfs nutzt eine explizite
  Testzeit und ist damit unabhaengig von der realen Uhrzeit.

- JARVIS persistenter Aufgabenentwurf 2026-07-29: Der erste produktiv
  schreibende Action-Center-Vertikalschnitt ist umgesetzt. Ein erkannter
  Aufgabenwunsch erzeugt zunächst ausschließlich einen 15 Minuten gültigen,
  serverseitig gespeicherten Entwurf. Er ist an Organisation, echte
  serverseitige Sitzung, Sitzungsakteur, wirksamen Akteur, Rollenpaar und
  Impersonationsstatus gebunden. Payload und Projektkontext besitzen
  SHA-256-Nachweise sowie einen serverseitigen HMAC-Integritätstag; ein seit
  der Vorschau geändertes Projekt sperrt die Anlage. Verantwortlichkeit und
  Fälligkeit müssen sichtbar ergänzt und serverseitig geprüft werden. Jede
  Änderung, Bestätigung und jeder Abbruch ist revisionsgebunden, sodass ein
  älterer Tab keinen neueren Stand überschreiben oder bestätigen kann.
  Ungeprüfte lokale Feldänderungen deaktivieren den Bestätigungsbutton.
  Erst `Aufgabe jetzt anlegen` darf innerhalb derselben Datenbanktransaktion
  den Entwurf atomar beanspruchen und genau eine Aufgabe über den
  rollengeprüften Task-Service erzeugen. Wiederholung, Doppelklick und Replay
  liefern das bereits gespeicherte Ergebnis statt einer Dublette. Abbruch,
  Ablauf, Integritätsfehler, Rollen-/Session-/Mandantenwechsel und verbotene
  Zuweisungen bleiben fail-closed. Erfolg wird erst nach bestätigtem
  Datenbankzustand angezeigt; die neue Aufgabe lässt sich ohne Seitenreload
  öffnen. Entwurfsereignisse werden fortlaufend und getrennt vom normalen
  Aufgaben-Audit protokolliert. Der additive Prisma-Diff enthält nur
  `JarvisActionDraft`, `JarvisActionDraftAuditEvent`, Indizes und
  Fremdschlüssel. 1025/1025 Tests, TypeScript, Prisma-Validierung,
  Regression, Mojibake, Diff-Check und Produktionsbuild sind lokal grün.
  Ein echter lokaler Browser-/Datenbanklauf bestätigte Abbruch ohne Aufgabe
  sowie Doppelklick mit exakt einer Aufgabe und vollständiger
  `created → completed → confirmed_and_executed`-Auditfolge; die eindeutig
  markierten lokalen E2E-Daten wurden anschließend vollständig bereinigt.

- JARVIS Live-Intent-Nachhärtung 2026-07-29: Der nach dem ersten
  Sprachdeployment verpflichtend ausgeführte 110-Fragen-Lauf zeigte keine
  technischen Ausfälle, aber wiederkehrende Rückfrage-Fallbacks bei natürlicher
  Hauptnavigation und kurzen Projektstammdatenfragen. Formulierungen wie
  `Wie komme ich zur Buchhaltung?`, `Wie gelange ich zu den Auswertungen?`,
  Projektübersicht und Benachrichtigungen werden nun deterministisch vor dem
  KI-Router beantwortet. Im geöffneten Projekt liefern Projektnummer, Kunde,
  Projektadresse und umgangssprachliche Verantwortungsfragen direkte,
  organisations- und rollengeprüfte Fakten. Exakte Dokument-, Rechnungs- und
  sonstige Fachhilfen behalten Vorrang vor der allgemeineren Systemlandkarte.
  Exakte sichere Bedienhilfen werden jetzt vor der optionalen
  KI-Klassifikation beantwortet; insbesondere `alle Projekte` und
  `Projektübersicht` führen direkt zur Projektübersichts-Hilfe. Das spart bei
  wiederkehrenden Bedienfragen Modellaufrufe, Antwortzeit und Kosten. Der
  zweite vollständige Live-Vergleichslauf beantwortete 110/110 Fragen ohne
  leere Antwort oder UI-Wiederholung; Mittelwert 3,68 Sekunden, Maximum 10,44
  Sekunden. Alle fünf schreibenden Befehle blieben blockiert und es wurde
  kein technisches Geheimnis ausgegeben.

- JARVIS Sprachmodus-Härtung 2026-07-29: Der browserseitige
  Standard-Sprachmodus unterscheidet jetzt zuverlässig zwischen erkanntem
  Transkript, Stille, Berechtigungsfehler, fehlendem Mikrofon, Abbruch,
  Netzwerkfehler und nicht unterstützter Sprache. Nach einem Fehler bleibt
  die interne Erkennung bis zum tatsächlichen Browser-Ende gegen einen
  verfrühten Neustart gesperrt; Start, Stop und Komponenten-Cleanup sind
  defensiv abgesichert. Nur ein tatsächlich erkanntes, weiterhin editierbares
  Transkript führt zur Aufforderung, es bewusst zu prüfen und zu senden.
  Ein realer Push-to-talk-Basislauf mit freigegebenem Mikrofon wurde in Google
  Chrome erfolgreich durchgeführt. Der eingebettete Codex-Browser stellt
  dagegen keine nutzbare Mikrofonfreigabe bereit; das ist eine Einschränkung
  der Testumgebung, der Textchat bleibt dort vollständig nutzbar.

- Dashboard-Hintergrundpolling 2026-07-29: Die bestehenden Intervalle fuer
  Projektzeiten (5 Sekunden) und das offene Projekt-Logbuch (15 Sekunden)
  fragen nur noch bei einem sichtbaren Browser-Tab beim Server an. Beim
  Zurueckkehren beziehungsweise Fokussieren werden beide Projektbereiche
  sofort synchronisiert. Die Intervalle, Ladewege und Schreiblogik fuer
  Stempelungen bleiben unveraendert. Notifications laufen ausdruecklich auch
  bei unsichtbarem Tab weiter, damit die daran gekoppelte
  Desktopbenachrichtigung nicht durch diese Optimierung eingeschraenkt wird.
  Keine API-, Rollen-, Prisma- oder Datenbankaenderung.

- JARVIS Browser-Sprachbasis 2026-07-29: Der erste sichere Baustein aus
  Phase 3b ergänzt den gemeinsamen JARVIS-Composer um browserseitiges
  Push-to-talk und opt-in Sprachausgabe. Erkannte Sprache wird ausschließlich
  als editierbarer Text in das vorhandene Eingabefeld übernommen und niemals
  automatisch abgesendet. Erst der bewusste Klick auf `Senden` führt den Text
  durch exakt dieselbe serverseitige Sicherheits-, Rollen-, Dialog- und
  Aktionsprüfung wie eine getippte Frage. WorkPilot360 lädt oder speichert
  dabei kein Roh-Audio. Vorlesen verwendet nur die lokale Browser-
  Sprachsynthese, ist standardmäßig aus, kann jederzeit gestoppt werden und
  endet beim Schließen des Dialogs. Fehlende Browserunterstützung oder
  verweigerte Mikrofonberechtigung deaktivieren die jeweilige Funktion ohne
  Auswirkung auf den Textchat. Der Push-to-talk-Basislauf wurde mit
  freigegebenem Mikrofon in Google Chrome real geprüft. Insbesondere
  Realtime-Audio, serverseitige Transkription und Audio-Budgets sind nicht
  Bestandteil dieses Pakets.

- JARVIS Intent-Orchestrator V4 2026-07-28: Nach der globalen Sicherheits-
  und Rollenprüfung klassifiziert ein begrenzter KI-Aufruf natürliche
  WorkPilot-Fragen vor den fachlichen Datenadaptern. Das strikt validierte
  Schema trennt Absicht, Domäne, Fachobjekt, Umfang, Kontextnutzung und
  vorbereitete Aktionsart. Verbindliche Priorität:
  ausdrückliche Datensatzreferenz vor ausdrücklich genanntem Umfang, danach
  semantische Absicht, aktiver Gesprächsdatensatz und zuletzt
  Bildschirmkontext. Eindeutige bekannte Bedienfragen dürfen weiterhin
  deterministisch ohne Tokenkosten laufen. Namen, Projektkennungen,
  E-Mail-Adressen, Telefonnummern, lange Nummern und interne Datensatz-IDs
  werden nicht an die Intent-KI übermittelt. Sie erhält keine Live-Daten,
  Rollenrechte, Datenbank oder Werkzeuge. Daten, Berechnungen und Aktionen
  bleiben ausschließlich deterministisch und rollengeprüft. Eine
  Antwort-Fit-Prüfung verwirft fachlich unpassende Spezialantworten, statt
  sie trotz abweichender Absicht auszugeben. Modellfehler und Timeout fallen
  ohne Crash auf die deterministische Logik zurück. Tokenverbrauch wird nur
  als technische Summen ohne Fragetext oder Datensatz protokolliert.
  Schreibende Aktionen bleiben gesperrt; auch neu erkannte Projekt-, Kunden-,
  Angebots-, Rechnungs-, Zeit-, Katalog- und Löschabsichten führen nur zu
  einer sicheren Erklärung beziehungsweise Rückfrage.

- JARVIS Intent-Orchestrator V3 2026-07-28: Nach globaler Sicherheits- und
  Rollenprüfung haben eindeutige Bedienfragen und organisationsweite
  Fachadapter Vorrang vor einem geöffneten Einzelprojekt. Genau eine
  ausdrücklich genannte Projektnummer ersetzt den alten Bildschirm- oder
  Gesprächskontext; mehrere Projektnummern bleiben eine geführte
  Mehrfachauswahl. Projektart, Status, Verantwortung, fachlicher Prüfstand und
  letzter Speicherzeitpunkt werden kurz und deterministisch beantwortet.
  Bedienformulierungen wie `Wie suche ich einen Kunden?` dürfen keine
  Live-Suche auslösen. Fehlende organisationsweite Datenadapter müssen ihre
  Grenze ehrlich benennen und dürfen niemals ein falsches Nullergebnis
  ausgeben. Einzelprojektfragen mit `kontrollieren` dürfen nicht in die
  Projektbestandsprüfung abbiegen. Umgangssprache und weitere
  Geheimnis-/Prompt-Injection-Varianten sind regressionspflichtig.

- JARVIS Intent-Orchestrator V2 2026-07-28: Sicherheits- und Rollenprüfungen
  müssen global vor Datenadaptern, Diagnose, Systemhilfe und KI-Klassifikation
  erfolgen. Deterministische Bedienhilfen dürfen nur über vollständige
  Mehrwortsignale mit leichter deutscher Formen-Erkennung gewählt werden;
  einzelne allgemeine Wörter reichen nicht. Schwache, konfliktbehaftete und
  aktionsbezogene Fragen dürfen einen streng strukturierten KI-Klassifikator
  ohne Live-Daten, IDs oder Werkzeuge nutzen. Dessen Ergebnis darf
  ausschließlich vorhandene Hilfethemen oder fest definierte Aktionsarten
  auswählen. Aktionen werden weiterhin nicht ausgeführt, sondern sicher
  zurückgefragt. Projektkennungen ohne Bindestrich werden nur als
  großgeschriebene Kennung erkannt, damit Zeitangaben wie `30 Tage` nicht als
  Projekt gelten. Der 100-Varianten-Regressionskorpus ist bei künftigen
  Intent-Änderungen verpflichtend mitzuführen.

- JARVIS hybride Absichtserkennung 2026-07-28: Eindeutige Bedienfragen wie
  `Wie buche ich hier einen Termin?` und `Wie buche ich bei HAS-1 einen
  Termin?` bleiben auch in einer geöffneten Projektakte Bedienfragen und
  dürfen nicht allein wegen `Termin` oder des Projektkontexts in den
  Projekt-Gesundheitscheck umgedeutet werden. Eine ausdrücklich genannte
  Projektnummer hat Vorrang vor einem anderen geöffneten Projekt; `hier`
  verwendet nur bei fehlender ausdrücklicher Referenz den aktuellen
  Projektkontext. Bekannte Bedienfragen bleiben vollständig deterministisch
  und verursachen keinen OpenAI-Aufruf. Nur bei einer noch nicht sicher
  erkannten WorkPilot-Absicht darf ein kleiner, zeitlich und in der Ausgabe
  begrenzter OpenAI-Klassifikationsaufruf einspringen. Er erhält eine
  gekürzte Frage mit maskierten Projekt-, E-Mail- und Telefondaten sowie nur
  abstrakten Oberflächenkontext, liefert ausschließlich ein strikt
  validiertes JSON-Schema und darf nur eine vorhandene Bedienhilfe auswählen
  oder eine Rückfrage auslösen. Er besitzt keinen Datenbank-, Rollen- oder
  Aktionszugriff. Ungültige Ausgaben, API-Fehler, Timeout, fehlender Key oder
  deaktivierter Fallback fallen ohne Crash auf die bestehende
  deterministische Logik zurück. Eine als Aktion verstandene Terminbitte
  wird in Phase 3a nicht ausgeführt; die kontrollierte Terminvorbereitung mit
  Vorschau, Bestätigung, Audit und Doppelausführungsschutz bleibt Phase 4.
- JARVIS Projektbestands-Browserkorrekturen 2026-07-28: Typische
  Schreibfehler dürfen nicht nur die Projektfrage erkennen, sondern müssen
  auch den gewünschten Prüfstatus erhalten. `Welche Porjekte wurden noch
  nicht geprfüt?` bleibt deshalb auf `Noch nie fachlich geprüft` begrenzt und
  darf Projekte mit `Prüfung notwendig` nicht zusätzlich einmischen.
  Ausdrückliche Mehrzahlfragen wie `Welche Projekte sind noch offen?`
  überstimmen einen geöffneten oder aus dem Dialog gemerkten
  Einzelprojektkontext. Der JARVIS-Bildschirmkontext gilt nur dann als
  Projekt- beziehungsweise Kundenakte, wenn der zugehörige Hauptbereich
  tatsächlich geöffnet ist; alte localStorage-Auswahlen dürfen den
  Dashboardkontext nicht verfälschen. Ergebnislisten übernehmen bis zu
  20 sichere Datensätze, zeigen zunächst fünf und bieten die restlichen
  Einträge über `Weitere … anzeigen` an. Projektkarten nennen den
  Prüfstatus nicht doppelt. Nullfälle werden verständlich mit `kein` oder
  `bei keinem Projekt` formuliert. Reine Lese- und UI-Logik ohne Projekt-,
  Prisma- oder Datenbankänderung.
- JARVIS Projektbestands- und Prüfstatusadapter 2026-07-28: Fragen wie
  `Wie viele Projekte müssen noch überarbeitet werden?`, `Welche Projekte
  müssen noch geprüft werden?`, `Wie viele Projekte sind noch nicht
  freigegeben?` und typische Schreibfehler werden als eine gemeinsame
  Fragefamilie erkannt. JARVIS verwendet dafür ausschließlich den
  organisationsgebundenen, gespeicherten Projekt-Prüfstatus und trennt
  `Noch nie fachlich geprüft`, `Nach Änderungen erneut prüfen` und
  `Fachlich freigegeben`. Unbekannte Altdatenzustände gelten sicherheitshalber
  als prüfbedürftig und niemals als freigegeben. Zählfragen erhalten eine
  kurze gruppierte Antwort; Listenfragen zusätzlich klickbare Projektkarten.
  Filter nach Prüfstatus, Projektart/Abrechnungsweg und Niederlassung sind
  vorbereitet. Explizit genannte Einzelprojekte bleiben bei der bestehenden
  Projektdiagnose. Der Adapter läuft vor allgemeiner Projektsuche und
  Systemhilfe, damit Wörter wie `geprüft werden` nicht als Projektname
  gesucht werden. Bestehende Rollen- und Organisationsgrenzen bleiben
  verbindlich; keine Projekt-, Prisma- oder Datenbankänderung.
- JARVIS projektart- und monatsgerechte Verbrauchsanalyse 2026-07-28:
  Explizite Monatsangaben begrenzen projektbezogene Material- und
  Stundenverrechnungssatzfragen jetzt auf genau diesen Leistungsmonat;
  andere Projektmonate dürfen das Ergebnis nicht mehr verfälschen.
  Rechnungen werden dafür über Leistungsdatum, geplanten Ausführungsmonat
  oder ersatzweise Erstellungsdatum zugeordnet, Stempelungen über ihr
  Leistungsdatum. Bei Verbrauchsfragen trennt JARVIS weiterhin strikt
  abgerechnete Menge, automatische Lagerbuchung und tatsächlich physisch
  eingesetztes Material. Einmalprojekte, Dauerläufer mit Monatspauschale und
  Dauerläufer mit Stundenabrechnung erhalten jeweils eine eigene
  verständliche Einordnung; bei unklarer Projektart wird kein Sollprozess
  erfunden. Natürliche Unternehmensfragen wie `Wie hoch ist unser
  Materialverbrauch?`, `Wo verbrauchen wir auffällig viel Material?`,
  `Welchen Stundensatz erzielen wir tatsächlich?` oder `Wie wirtschaftlich
  sind unsere Stundenleistungen?` werden deterministisch denselben sicheren
  Managementadaptern zugeordnet und benötigen keinen zusätzlichen
  OpenAI-Aufruf. Reine Lese- und Diagnoselogik ohne Rechnungs-, Lager-,
  Stempel-, Prisma- oder Datenbankänderung.
- JARVIS projektartgerechte Stundensatz-Einordnung 2026-07-28:
  Stunden-Dauerläufer, Monatspauschalen und Einmalprojekte werden bei
  projektbezogenen SVS-Fragen fachlich getrennt. Nur beim
  Stunden-Dauerläufer sowie bei ausdrücklich als Stundenleistung
  abgerechneten Positionen eines Einmalprojekts kann von einem tatsächlich
  berechneten Kunden-Stundensatz gesprochen werden. Eine Monatspauschale
  besitzt keinen vertraglichen Kunden-Stundensatz; ein daraus rechnerisch
  abgeleiteter Erlös je eingesetzter Stunde ist ausschließlich eine
  Wirtschaftlichkeitskennzahl und benötigt vollständigen Monatsnettoerlös,
  Arbeitszeit und freigegebene Kosten. Bei unklarer Projektart bestätigt
  JARVIS keinen projektartgerechten Satz.
- JARVIS projektbezogene Stundensatz-Freigabe 2026-07-28: Die rein lesende
  Projektanalyse darf Rechnungs-, Leistungs- und Stempelwerte weiterhin als
  Ist-Zustand und Prüfhinweis auswerten. Eine allgemeine Preis- oder
  Stundensatzempfehlung gilt jedoch nur noch dann als belastbar, wenn die
  verknüpfte Leistung fachlich freigegeben ist. Die fokussierte Projektantwort
  zeigt deshalb den Freigabestand des Projekts und der ausgewerteten
  Stundenleistungen ausdrücklich an. Bei ungeprüften beziehungsweise
  prüfbedürftigen Projekten oder Leistungen nennt JARVIS zuerst den
  notwendigen Prüfschritt und verwendet aktuelle Stammdatenpreise nicht als
  bestätigte Sollwahrheit. Keine Preis-, Projekt-, Rechnungs-, Stempel-,
  Prisma- oder Datenbankänderung.
- Katalog-Prüf- und Freigabeworkflow 2026-07-28: Artikel, Leistungen und
  Pakete besitzen die drei expliziten Zustände `Noch ungeprüft`,
  `Prüfung notwendig` und `Fachlich freigegeben`. Die Freigabe wird mit
  Benutzer, Zeitpunkt und optionaler Prüfnotiz protokolliert. Änderungen an
  fachlich relevanten Stamm-, Kalkulations-, Planungs-, Preis- oder
  Paketbestandteilsdaten setzen eine bestehende Freigabe automatisch auf
  `Prüfung notwendig` zurück; Lagerbewegungen beziehungsweise reine
  Bestandsänderungen tun dies nicht. Für Leistungen zeigt die Prüfung den
  gespeicherten LK-Satz und den aktuell korrekt gewichteten LK-Satz getrennt.
  Eine Übernahme ändert nur den geöffneten Entwurf und muss anschließend
  ausdrücklich gespeichert und erneut freigegeben werden. Bestehende
  Angebote, Rechnungen, historische Positionswerte und Kostensnapshots
  werden nicht verändert. JARVIS darf ungeprüfte Katalogwerte weiterhin zur
  Diagnose und zum Aufzeigen von Datenlücken verwenden, aber erst fachlich
  freigegebene Artikel oder Leistungen als Grundlage einer Preis- oder
  Stundensatzempfehlung behandeln.
- Vor-Live-Datenstatus 2026-07-28: WorkPilot360 ist fachlich noch nicht im
  Livebetrieb. Importierte beziehungsweise vorhandene Projekte müssen noch
  den richtigen Projektarten, Abrechnungswegen und Status zugewiesen und
  geprüft werden; auch Artikel und Leistungen sind noch nicht vollständig
  überarbeitet oder fachlich freigegeben. Ein technisch gefülltes oder
  widerspruchsfreies Feld ist deshalb kein Beweis für fachliche Richtigkeit.
  JARVIS darf den aktuellen Bestand als Prüf- und Migrationsgrundlage
  verwenden, aber ungeprüfte Stammdaten nicht als bestätigte Sollwahrheit
  darstellen und daraus keine endgültige Preis-, Prozess- oder
  Vollkostenempfehlung ableiten. Für Artikel, Leistungen und Pakete ist der
  explizite Prüf-/Freigabestatus umgesetzt. Projekte besitzen ebenfalls die
  Zustände ungeprüft, Prüfung notwendig und fachlich freigegeben. Eine
  Projektfreigabe verlangt eine eindeutige Projektart, die dazu passende
  Abrechnung, stabile Kundenverknüpfung, Gewerk, Niederlassung,
  Verantwortlichkeit, bei Dauerläufern eine vollständige Laufzeit und
  mindestens ein gültiges Angebot; ein Entwurf reicht nicht. Änderungen an
  diesen prüfrelevanten Daten heben die Freigabe
  automatisch auf. Routine-Statuswechsel der Projektpipeline werden
  protokolliert, lösen aber keine erneute Stammdatenprüfung aus. JARVIS zeigt
  den Prüfstand als Datenbasis und darf ungeprüfte Projekte nicht als
  abschließend richtig bewerten.
  Alle drei Projektvarianten sind über reine Fachlogiktests abgesichert.
  Mangels eines vorhandenen Stundenabrechnungs-Dauerläufers im lokalen
  Bestand darf für Tests kein künstliches Echtdatenprojekt angelegt werden.
- LK-Satz Gewichtungskorrektur 2026-07-28: Der durchschnittliche
  Niederlassungs-/Planungsgruppen-LK-Satz teilt die Summe aus individuellem
  Mitarbeiterkostensatz mal Niederlassungsanteil jetzt durch die Summe der
  tatsächlichen Mitarbeiteranteile und nicht mehr durch die bloße Anzahl der
  Personen. Ein Mitarbeiter mit 50 % Anteil und 50 EUR individuellem
  Stundensatz erzeugt dadurch weiterhin 50 EUR je tatsächlich zugeordneter
  Arbeitsstunde, nicht fälschlich 25 EUR. Die reine Fachfunktion liegt in
  `src/lib/employee-costs/labor-cost-rate.ts` und ist separat getestet.
  Bestehende Katalogleistungen und Angebotspositionen werden nicht still
  umgeschrieben. Historische Stempel-Kostensnapshots bleiben unverändert und
  sind von der Korrektur fachlich nicht betroffen, weil sie direkt aus dem
  individuellen Mitarbeiterkostensatz gebildet werden. Vor einer
  kontrollierten Aktualisierung gespeicherter Katalog-LK-Sätze ist eine
  Vorschau mit expliziter Bestätigung erforderlich.
- JARVIS sichere Preisrichtlinie und Teilkostenkorridore 2026-07-28: Die
  freigegebene Standardrichtlinie verwendet 18 % Mindestmarge und 30 %
  Zielmarge, jeweils korrekt als Anteil am Verkaufspreis berechnet
  (`Kosten / (1 - Marge)`). Organisationsbezogene Abweichungen sind über den
  vorhandenen `OrganizationSetting`-Schlüssel `jarvis.pricing-policy.v1`
  vorbereitet; ungültige, fehlende oder vertauschte Werte fallen sicher auf
  18/30 zurück. Der unternehmensweite Material- und
  Stundenverrechnungssatzvergleich zeigt einen numerischen Korridor nur für
  GF/Admin, nur bei der bereits festgelegten Mindestdatenbasis und nur bei
  vollständig gespeicherten historischen Kostenständen. Materialkorridore
  beruhen vorläufig ausschließlich auf belegten Materialkosten,
  Leistungskorridore ausschließlich auf gespeicherten Mitarbeiterkosten.
  Beschaffung, Lager, Fahrzeuge, Werkzeuge, Verwaltung und weitere
  Gemeinkosten sind noch nicht vollständig enthalten und werden deshalb
  ausdrücklich als vorläufige Teilkostenberechnung bezeichnet. JARVIS ändert
  keine Preise oder Stammdaten automatisch.
- JARVIS unternehmensweiter Material- und Artikelvergleich 2026-07-28:
  Fragen wie `Analysiere unsere Materialien und Artikel`, `Welche Artikel
  verkaufen wir zu günstig?` oder `Wo stimmen Materialmenge und
  Lagerentnahme nicht überein?` laufen über einen organisationsgebundenen,
  rein lesenden Managementadapter. Standardzeitraum sind die letzten zwölf
  Monate. Gewertet werden ausschließlich fertige Rechnungen; jede
  Rechnungsposition zählt einzeln und identische Positionen werden über ihre
  stabile Artikel-ID addiert, nicht anhand des Namens dedupliziert.
  Materialbestandteile aus Paketen stammen ausschließlich aus der
  historischen Paketzusammensetzung der Rechnung. Freie Materialpositionen
  ohne stabile Artikel-ID werden nicht fälschlich mit dem Lager verglichen.
  JARVIS trennt abgerechnete Menge, systemseitige Lagerentnahme und
  tatsächlichen physischen Verbrauch. Aktuelle Einkaufs- sowie belegte
  historische Materialkosten bleiben strikt GF/Admin vorbehalten;
  Führungskräfte und Buchhaltung erhalten nur ihre freigegebenen Rechnungs-,
  Mengen-, Lager- und Verkaufspreisinformationen. Eine allgemeine
  Preisbewertung gilt erst ab mindestens drei fertigen Rechnungen je
  Materialart als hinreichend wiederholt. Auch dann wird ohne fachlich
  freigegebene Zielmarge kein neuer Verkaufspreis erfunden und kein
  Artikelstamm automatisch geändert. Explizite Projektfragen bleiben beim
  Projektadapter. Keine Lager-, Rechnungs-, Preis-, Prisma- oder
  Datenbankänderung.
- JARVIS unternehmensweiter Leistungs- und SVS-Vergleich 2026-07-28: Fragen
  wie `Analysiere unsere Stundenverrechnungssätze` laufen über einen eigenen,
  organisationsgebundenen und rein lesenden Managementadapter. Er vergleicht
  standardmäßig die letzten zwölf Monate und verwendet dieselbe abgesicherte
  Datenbasis wie die Projektanalyse: ausschließlich fertige Rechnungen,
  Rechnungspositionen beziehungsweise historische Paketbestandteile,
  eindeutige Leistungs-IDs, zugeordnete Stempelstunden und aktuelle
  Stammdatenpreise. Führungskräfte und Buchhaltung dürfen die für ihre
  Finanzberechtigung freigegebenen Leistungs- und Rechnungswerte sehen;
  gespeicherte Mitarbeiterkosten bleiben auch in diesem Vergleich strikt
  GF/Admin vorbehalten. Beschäftigte ohne Rechnungsberechtigung werden vor
  jeder Datenabfrage abgewiesen. JARVIS sortiert Auffälligkeiten, trennt
  nachgewiesene Abweichungen von Datenlücken und nennt keinen neuen
  allgemeinen Stundensatz, solange je Leistung nicht mindestens drei fertige
  Rechnungen, zehn abgerechnete sowie zehn eindeutig zugeordnete gestempelte
  Stunden vorliegen. Selbst bei ausreichender Basis bleibt eine
  Preisentscheidung manuell und muss Material-, Fahrzeug-, Gemeinkosten und
  ein freigegebenes Margenziel zusätzlich berücksichtigen. Explizite
  Projektfragen werden weiterhin vom Projektadapter beantwortet. Keine
  Preis-, Rechnungs-, Stempel-, Prisma- oder Datenbankänderung.
- JARVIS projektbezogene Leistungs- und SVS-Analyse 2026-07-28: Fragen wie
  `Wie hoch ist der tatsächlich erzielte Stundenverrechnungssatz bei HAS-1?`
  laufen über den gesicherten, rein lesenden Projektadapter. Ausgewertet
  werden ausschließlich fertige Rechnungen. JARVIS trennt abgerechnete
  Stunden, eindeutig über die stabile Leistungs-ID zugeordnete
  Stempelstunden, tatsächlich berechneten Netto-Stundensatz, Nettoerlös je
  eingesetzter Stunde und aktuellen Stammdatenpreis. Stundenleistungen aus
  Paketen zählen nur aus der historischen Paketzusammensetzung der Rechnung.
  Stempelungen ohne stabile Abrechnungsleistungs-ID werden nicht anhand
  ähnlicher Namen geraten, sondern als Datenlücke ausgewiesen. Historische
  Mitarbeiterkosten und Kostenabdeckung sind ausschließlich für GF/Admin
  sichtbar und stammen nur aus gespeicherten Kostenständen. Eine
  Preisempfehlung gilt erst ab mindestens drei fertigen Rechnungen sowie zehn
  abgerechneten und zehn eindeutig zugeordneten gestempelten Stunden als
  hinreichend belegt. Auch dann ändert JARVIS keinen Preis automatisch und
  stellt eine reine Kostendeckungsgrenze niemals als sinnvollen Verkaufspreis
  dar. Keine Rechnungs-, Preis-, Stempel-, Prisma- oder Datenbankänderung.
- JARVIS projektbezogene Materialanalyse 2026-07-28: Fragen wie `Welche
  Materialien wurden bei HAS-1 abgerechnet?` laufen über einen
  organisations- und rollengebundenen, rein lesenden Projektadapter. Die
  Auswertung berücksichtigt ausschließlich fertige Rechnungen, zählt jede
  Rechnungsposition einzeln und addiert identische Positionen, ohne sie über
  Namen zu deduplizieren. Materialbestandteile aus Paketen werden nur aus der
  zum Rechnungszeitpunkt gespeicherten Paketzusammensetzung übernommen;
  fehlt dieser historische Snapshot, darf die heutige Paketzusammensetzung
  nicht als damaliger Verbrauch ausgegeben werden. Abgerechnete Mengen werden
  mit den automatischen `sale`-/`reversal`-Lagerbewegungen des Projekts
  verglichen. JARVIS trennt ausdrücklich abgerechnete Menge, systemseitige
  Lagerentnahme und tatsächlich physischen Verbrauch. Historische
  Materialkosten werden nur für GF/Admin und nur aus gespeicherten
  Kostenständen bewertet. Keine Bestands-, Rechnungs-, Prisma- oder
  Datenbankänderung.
- JARVIS semantische Qualitätsschicht 2026-07-28: Datums-/Monatsangaben,
  Projektreferenzen, Projektprüfumfang, Ursache-Wirkungs-Beziehung und
  gewünschte Antworttiefe werden zentral in
  `src/lib/jarvis/question-semantics.ts` ermittelt. Dialogrouter und
  Projektdiagnose dürfen dafür keine voneinander abweichenden
  Schlüsselwortregeln mehr aufbauen. `answer-policy.ts` begrenzt fokussierte
  Warum-, Status- und Monatsantworten global auf die wesentlichen Befunde und
  entfernt ungefragte Prüfwerte sowie Diagnoseanhänge; ausdrückliche
  Prüfaufträge bleiben vollständig. Die Evaluationsmatrix erzeugt Varianten
  über Projekte, alle deutschen Monatsnamen, Synonyme, Ursache-Wirkungs-
  Fragen und typische Schreibfehler. Neue Fragefamilien benötigen
  Semantik-, Routing- und Antworttiefen-Invarianten statt nur eines einzelnen
  Beispielsatztests.
- JARVIS angemessene Antworttiefe 2026-07-28: Eine konkrete, eng begrenzte
  Warum-, Status- oder Monatsfrage erhält zuerst eine kurze direkte Antwort
  mit festgestellter Ursache, höchstens den wichtigsten Zusatzbefunden und
  einem sicheren nächsten Schritt. Prüfwert, Bereichsbewertung und kompletter
  Diagnoseumfang erscheinen nur bei einem ausdrücklichen Prüf- oder
  Analyseauftrag. JARVIS darf aus einer einfachen Frage keinen ungefragten
  Vollcheck machen. Kann der genaue Grund nicht aus gespeicherten Daten
  bewiesen werden, trennt JARVIS sicher festgestellten Zustand und mögliche
  Ursache ausdrücklich, statt eine Ursache zu erfinden. Ursache-Wirkungs-
  Fragen über zusammengehörige Bereiche, etwa von einer Stempelung zum
  Rechnungsentwurf, bleiben eine gemeinsame Fachfrage und werden nicht in
  getrennte Prüfauswahlen zerlegt.
- JARVIS Auslastungsanalyse-Roadmap 2026-07-28: Der spätere Management- und
  Planungsadapter beantwortet Auslastungsfragen für einzelne Mitarbeitende,
  Planungsgruppen und Planungsboards. Geschäftsführung/Admin dürfen den
  organisationsweiten freigegebenen Umfang sehen; Führungskräfte nur ihre
  zugeordneten Gruppen beziehungsweise Boards, Mitarbeitende höchstens die
  eigene Sicht. Kapazität, Planstunden, Feiertage, Abwesenheiten und
  Auslastungsquote werden deterministisch in WorkPilot360 berechnet. KI dient
  nur der Trenddeutung, Ursachenhypothese und verständlichen Empfehlung.
  Zielkorridore für Unterauslastung und Überlastung müssen konfigurierbar sein.
  Der Ausbau ist in Phase 6, die spätere Planungsdetailtiefe in Phase 7 des
  JARVIS-Entwicklungsplans einsortiert und zieht den aktuellen
  Projekt-Diagnoseabschluss nicht vor.
- JARVIS bereichsbezogener Projektprüfwert 2026-07-28: Der Projektprüfwert
  wird nicht mehr durch pauschale Abzüge je Einzelbefund bis auf 0 gedrückt.
  Jeder freigegebene Prüfbereich wird mit seinem schlechtesten Zustand
  bewertet; mehrere zusammenhängende Befunde desselben Bereichs führen nur zu
  begrenzten Zusatzabzügen. Der Gesamtwert ist der nachvollziehbare Mittelwert
  der Bereichswerte, bei kritischen Befunden auf höchstens 69 begrenzt.
  0 Punkte gibt es nur, wenn sämtliche freigegebenen Prüfbereiche kritisch
  sind. `Kritisch` bleibt unabhängig vom Zahlenwert bestehen, sobald ein echter
  kritischer Befund vorliegt. JARVIS zeigt die Bewertung je Bereich in der
  strukturierten Antwort. Fehlende Klärungsaufgaben zu Unterbrechungen vor dem
  27.06.2026 werden als Altbestand vor Einführung der Aufgabenautomatik
  erklärt; sie bleiben prüfpflichtig und werden nicht still rückwirkend
  erzeugt.
- JARVIS verständliche Diagnosesprache 2026-07-28: Projekt-, Planungs-,
  Angebots-, Rechnungs-, Automatik- und Stempelbefunde erklären jetzt für
  normale Mitarbeitende zuerst den konkret festgestellten Zustand, danach die
  mögliche Auswirkung und schließlich den sicheren nächsten Prüfschritt mit
  dem passenden WorkPilot-Bereich. Interne Begriffe wie Snapshot, Faktura,
  Automatikweg oder Stapelabrechnung dürfen nicht unkommentiert als
  Anwendererklärung erscheinen. Fachliche Regeln, Schweregrade und
  Rollenfilter bleiben davon unberührt. Besonders bei Stunden-Dauerläufern
  nennt JARVIS verständlich das Risiko fehlender Gewerke,
  Abrechnungsleistungen, Monatsentwürfe und falscher
  Rechnungsverknüpfungen. Angebote bleiben der verpflichtende Grundbaustein
  jedes Projekts.
- JARVIS projektartabhängige Tiefendiagnose 2026-07-28: Der rein lesende
  Projektcheck verbindet die vorhandene Stempel- und Monatsdiagnose jetzt mit
  der vollständigen Sollkette der jeweiligen Projektart. Ein gültiges,
  finales und im Projekt hinterlegtes Angebot ist der verpflichtende
  Grundbaustein jedes Projekts, ausdrücklich auch bei Dauerläufern; ein reiner
  Angebotsentwurf genügt nicht. JARVIS erklärt diesen Befund in verständlicher
  Alltagssprache und verweist auf den Projektbereich `Angebote`, statt den im
  System nicht vorhandenen Bedienbegriff `Auftrag` zu verwenden.
  Einmalprojekte werden zusätzlich auf Endkontrolle, Schlussrechnung und
  Gesamtabschluss geprüft. Dauerläufer mit Monatspauschale und
  Stundenabrechnung bleiben in ihren Abrechnungswegen strikt getrennt;
  unpassende Stapel- oder Stundenrechnungsquellen werden als kritischer
  Widerspruch ausgewiesen. Für abgelaufene Dauerläufer wird nachvollzogen, ob
  letzter Rechnungsmonat und Projektabschluss zusammenpassen. Zusätzlich
  kontrolliert JARVIS Endkontrollen sowie bei OK-immocare-Projekten
  Vorherbilder, Nachherbilder und Tätigkeitsberichte je relevanter
  Leistungsperiode. Der nächste aktive Pauschalmonat wird ausdrücklich gegen
  bestätigte Planung beziehungsweise Monatskontingent geprüft, ohne
  bedarfsabhängige Stundenprojekte fälschlich zu einer festen Vorausplanung zu
  zwingen. Rollenbedingt gesperrte Angebote und Rechnungen werden weder
  geladen noch aus fehlenden Daten abgeleitet. Keine automatische Korrektur,
  keine Prisma- oder Datenbankänderung.

- JARVIS mehrdimensionale Dialogfolgen 2026-07-28: Mehrere erlaubte
  Fachthemen, Zeiträume sowie Kombinationen aus mehreren Projekten und
  Prüfumfängen werden nicht mehr nach der ersten Auswahl vergessen. JARVIS
  führt bis zu fünf streng typisierte Teilprüfungen als klickbare Folge und
  prüft jeden Schritt erneut gegen Sitzung, effektive Rolle, Fachdomäne,
  Action Registry und Sicherheitsregeln. Die Folge bleibt auch erhalten,
  wenn eine Auswahl technisch vom Systempfad in den Vertriebs- oder
  BWL-Antwortpfad wechselt. Projektmatrizen bis fünf Einzelprüfungen werden
  vollständig vorgemerkt; größere Kombinationen werden nicht abgeschnitten,
  sondern mit der tatsächlichen Anzahl transparent auf einen zuerst
  auszuwählenden Prüfumfang begrenzt. Manipulierte Client-Metadaten,
  Geheimnisanfragen und nachträglich entfallene Rechte können keine
  Folgeschritte freischalten. Rein lesend, ohne Prisma-, Datenbank- oder
  automatische Aktionsänderung.

- JARVIS Teilanliegen-Orchestrierung 2026-07-28: Mehrere zusammengehörige
  Lese- oder Prüfanliegen innerhalb derselben Fachdomäne werden nicht mehr
  nach der ersten Auswahl vergessen. JARVIS bildet eine streng typisierte,
  clientseitig erneut validierte Arbeitsfolge aus höchstens fünf erlaubten
  Teilaufträgen. Nach jedem Ergebnis wird der noch offene nächste Teil als
  klickbare Auswahl angeboten; erledigte Teile werden aus dem Dialogzustand
  entfernt. Bei mehreren Prüfumfängen für ein ausdrücklich genanntes Projekt
  bleiben Projektreferenz und Umfang getrennt erhalten, beispielsweise
  Planung und anschließende Rechnungsprüfung für `MKG-209`. Generische
  Kombinationen wie offene Angebote plus Rechnungen führen dieselbe
  Datensatzfolge fort. Jeder Teilauftrag durchläuft bei Ausführung erneut
  Sitzungs-, Rollen-, Organisations-, Action-Registry- und Datenklassenprüfung;
  eine zwischenzeitlich entfallene Berechtigung blendet den betreffenden
  Folgeschritt aus. Sicherheits-, Geheimnis- und bereichsübergreifende
  Mehrdeutigkeiten bleiben vor der Orchestrierung gesperrt beziehungsweise
  rückfragepflichtig. Rein lesend, deterministisch und ohne zusätzlichen
  OpenAI-, Prisma- oder Datenbankzugriff.

- JARVIS mehrstufiger Dialogkontext 2026-07-28: Der gemeinsame Chat führt
  Fachdomäne, letztes Ziel, Fachobjekte, Zeitraum, Datensatzbezug und
  Klärungstiefe jetzt als typisierten, clientseitig erneut streng
  validierten Dialogzustand fort. Kurze Antworten auf klickbare Rückfragen
  wie `nur Rechnungen` werden nur bei genau einer Übereinstimmung in den
  vollständigen, servergeprüften Folge-Prompt aufgelöst. Referenzielle
  Folgefragen wie `Und im Vormonat?` oder `Und wie sieht die Planung aus?`
  behalten Fachdomäne beziehungsweise den eindeutig gewählten Datensatz;
  eigenständige Bedienfragen und ausdrücklich genannte andere
  Projektnummern übernehmen keinen alten Datensatzbezug. Jede Folgefrage
  durchläuft unverändert die serverseitigen Rollen-, Organisations-,
  Datenklassen- und Sicherheitsprüfungen. Wiederholte identische
  Klärungsschleifen sind auf zwei Stufen begrenzt und verlangen danach eine
  bewusste Auswahl oder vollständige Neuformulierung. Mehrere ausdrücklich
  genannte Projekte werden nicht mehr still auf den ersten Treffer
  reduziert: JARVIS fragt nach der Reihenfolge, merkt sich bis zu fünf
  geprüfte Projektreferenzen und bietet nach jedem Ergebnis das nächste
  Projekt mit demselben Prüfumfang an. Rein lesend, ohne OpenAI-, Prisma-
  oder Datenbankänderung.

- JARVIS zentraler Intent-Entscheider 2026-07-28: Vor den spezialisierten
  Projekt-, Personen-, Vertriebs-, Lese- und Systemhilfe-Resolvern bewertet
  JARVIS eine Frage jetzt deterministisch nach Domäne, Nutzerziel,
  Fachobjekten, Zeitraum und getrennten Satzteilen. Die Entscheidung enthält
  eine nachvollziehbare Konfidenz und belegende Signale. Kombinierte Fragen
  aus System, Vertrieb und BWL, mehrere gleichzeitig angeforderte
  Datensatzarten sowie widersprüchliche Zeiträume werden vor jeder
  Datenabfrage mit typisierten klickbaren Optionen geklärt. Geheimnis-,
  Prompt-Injection- und Lohnsignale erzwingen weiterhin den abgesicherten
  Systempfad und können nicht durch ein zusätzliches BWL-Schlüsselwort
  umgangen werden. Klärungsoptionen verwenden die echte Action Registry und
  die Schnittmenge aus Sitzungs- und effektiver Rolle; die bestehende
  Vertriebsanalyse bleibt dadurch GF-exklusiv. Eindeutige Fragen laufen
  unverändert in die vorhandenen Fachresolver. Rein lesend, ohne OpenAI-,
  Prisma- oder Datenbankänderung.

- HERO-Aktivprojekt-Cutover 2026-07-27: Nach vollständigen, verifizierten
  Datenbank- und Quellbackups wurde der alte gemischte Fünfer-Pilot
  `cms3n6886000xw4g8vfe1voip` sicher zurückgenommen. Die Rücknahme wurde lokal
  durch einen vollständigen Import mit anschließendem Rollback praktisch
  geprüft. Maßgeblich für den finalen Abgleich war ausschließlich die
  normalisierte Projektnummer; unterschiedliche HERO- und WorkPilot-Pipelines
  wurden bewusst nicht gleichgesetzt. Von 138 aktiven HERO-Projekten waren im
  Live-System 111 bereits vorhanden. Der Live-Importlauf
  `cms3rvjqb0000jxhq8wy4dk8q` legte die übrigen 27 Projekte und exakt 8 fehlende
  Kontakte an und verknüpfte 16 vorhandene Kunden bzw. echte Ansprechpartner
  über stabile IDs. Alle neuen Projekte starten neutral in `Lead / Klärung`;
  Projektart und Abrechnungsmodell bleiben bewusst leer und werden manuell
  eingeordnet. Der HERO-Status ist nur als Quellenhinweis protokolliert.
  Angebote, Rechnungen, Positionen, Zahlungen und historische Belege wurden
  weder importiert noch verändert. Der Lauf enthält 27 Projekt-, 8
  Kontaktanlage- und 16 Kontaktverknüpfungsprotokolle, 0 Dokumentprotokolle und
  51 stabile HERO-Referenzen. Live-Nachherstand: 160 Projekte, 299 Kontakte,
  weiterhin 13 Angebote, 22 native Rechnungen und 596 Legacy-Rechnungen. Ein
  frischer Gegenabgleich meldet 138 von 138 aktiven Projektnummern vorhanden,
  keine Dublette und keinen Blocker. Der Import bleibt über seinen Lauf
  kontrolliert rücknehmbar; zusätzlich liegt das geprüfte Live-Datenbankbackup
  `/var/backups/workpilot360/workpilot360-before-hero-active-20260727-215407.dump`
  vor. Prisma-Schema und Live-Diff, Regression, Mojibake, 415 Tests,
  TypeScript, Diff-Check und Produktions-Build mit 88 Seiten bestanden. Commit
  `832c9ec15f217f7e225fa8507d73c6fcb8e896ce` wurde auf `main` gepusht und
  live deployed. WorkPilot360 antwortet intern und öffentlich mit HTTP 200;
  Kliniknavigator blieb unverändert online.

- JARVIS sicherer Unklarheits-Fallback 2026-07-27: Wenn eine Frage wegen
  starker Schreibfehler oder einer logisch unklaren Formulierung keinem
  freigegebenen Intent sicher zugeordnet werden kann, fragt JARVIS eine
  angemeldete Person jetzt nach dem gemeinten Ziel. Die klickbaren Vorschläge
  werden aus aktuellem Kontext und effektiven Rollenrechten gebildet;
  gesperrte Bereiche werden nicht angeboten. Sicherheitsablehnungen laufen
  weiterhin vor diesem Fallback, eindeutige Fragen bleiben direkte Antworten.
  JARVIS erfindet bei Unsicherheit keine Bedien- oder Fachantwort.

- JARVIS umgangssprachliche Projektartfrage 2026-07-27: Eindeutige Fragen
  wie `Und was ist HAS-1 für en Projekt?` werden trotz des verkürzten Artikels
  direkt als Frage nach der Projektart erkannt und nicht mehr fälschlich mit
  der Bedienhilfe des aktuell geöffneten Reiters beantwortet. Die Toleranz ist
  bewusst auf diese eindeutige Satzstruktur begrenzt; kurze freie Wörter
  werden weiterhin nicht global automatisch korrigiert. Rein lesend, ohne
  OpenAI-Aufruf und ohne Prisma-/Datenbankänderung.

- JARVIS Projekt-Dialogabsicht 2026-07-27: Projektfragen werden vor der
  Projektdiagnose nach Nutzerziel getrennt. Eindeutige Fragen nach Projektart,
  Abrechnungsmodell oder Sollprozess liefern sofort eine strukturierte,
  deterministische Antwort aus der zentralen Projektarten-Regelmatrix und
  laden keine Stempel-, Rechnungs-, Aufgaben- oder Kostendaten. Wirklich
  mehrdeutige Formulierungen wie `Was ist mit HAS-1?` führen dagegen zu einer
  gezielten klickbaren Rückfrage. Diese bietet zuerst `Projektart &
  Abrechnung` und anschließend nur die für Sitzung und effektive Rolle
  erlaubten Prüfumfänge an. Ausdrückliche Prüfaufträge bleiben im bestehenden
  Gesundheitscheck; Gesprächsprojekt, Bildschirmprojekt und ausdrücklich
  genannte Projektnummer folgen weiterhin ihrer festgelegten Priorität.
  Umgangssprachliche Projektart-, Abrechnungs- und Prozessfragen besitzen
  einen eigenen getesteten Intent-Baustein statt einer HAS-1-Sonderregel.
  Bekannte Intent- und Fachwörter werden bei einem eindeutigen leichten
  Tippfehler tolerant normalisiert: kurze Wörter höchstens mit einer
  Abweichung, lange Fachbegriffe mit höchstens zwei. Buchstabenvertauschungen
  wie `proejkt` werden dadurch erkannt. Tokens mit Ziffern, Bindestrich,
  E-Mail-/Pfadmerkmalen sowie Namen und unbekannte freie Datensatzwerte werden
  nicht automatisch umgeschrieben; mehrdeutige oder zu weit entfernte Wörter
  bleiben der sicheren Rückfrage vorbehalten.
  Rein lesend, ohne OpenAI-Aufruf und ohne Prisma-/Datenbankänderung.

- JARVIS Projektarten-Regelmatrix 2026-07-27: Die Projektdiagnose leitet
  ihren Sollprozess zentral aus Projektart und Abrechnungsmodell ab und trennt
  Einmalprojekte, Dauerläufer mit Monatspauschale und Dauerläufer mit
  Stundenabrechnung ausdrücklich. Einmalprojekte folgen Auftragsgrundlage,
  Planung, Ausführung, Endkontrolle, Schlussrechnung und Gesamtabschluss.
  Monatspauschalen werden monatsbezogen über Kontingent, Planung, Nachweise,
  Monatsrechnung und Folgemonat bewertet. Stunden-Dauerläufer benötigen
  Gewerk/Abrechnungsleistung und führen passende Zeiten in genau einem
  Monatsentwurf zusammen. Die Regelmatrix erkennt zusätzlich widersprüchliche
  Altstände wie Dauerläufer-Abrechnungsfelder an Einmalprojekten, aktivierte
  Pauschal-Stapelabrechnung bei Stundenprojekten, vertauschte Laufzeiten,
  fehlende Abrechnungsintervalle sowie Automatikzeiträume außerhalb der
  Projektlaufzeit. JARVIS ändert diese Konfigurationen nicht automatisch,
  sondern nennt Beleg und sicheren Korrekturschritt. Keine Prisma- oder
  Datenbankänderung.

- JARVIS Dauerläufer-Monatskette 2026-07-27: Der rein lesende
  Projekt-Gesundheitscheck prüft Dauerläufer innerhalb ihrer Laufzeit jetzt
  monatsweise statt nur als Momentaufnahme. Er vergleicht bestätigte
  Planung mit dem jeweiligen Monatskontingent, weist gestempelte Stunden aus
  und kontrolliert – nur bei vorhandener Rechnungsberechtigung – vergangene
  Leistungsmonate auf fehlende oder mehrere aktive Rechnungen. Bei
  Stundenabrechnung wird eine Rechnung nur erwartet, wenn im Monat tatsächlich
  Zeit gestempelt wurde; bei Monatspauschalen wird außerdem nachvollziehbar
  gemeldet, wenn die automatische Stapelabrechnung wegen einer fehlenden
  Vormonatsrechnung keine Vorlage besitzt. Gelöschte, historisch fehlkodierte
  gelöschte und stornierte Rechnungen werden nicht als aktive Belege gewertet.
  Die Diagnose betrachtet höchstens zwölf abgeschlossene Projektmonate,
  verändert weder Planung noch Zeiten oder Rechnungen und führt keine
  Prisma-/Datenbankänderung aus.

- JARVIS-Projekt-Gesundheitscheck 2026-07-27: In einer geöffneten
  Projektakte bietet JARVIS den direkten Einstieg `Projekt prüfen`. Fragen
  wie `Prüfe dieses Projekt vollständig`, `Was fehlt bei diesem Projekt?`
  oder `Wie können wir dieses Projekt verbessern?` werden vor allgemeiner
  Systemhilfe als deterministische Diagnose erkannt. Der Check verbindet
  Projektstammdaten, stabile Kundenzuordnung, Projektart, Verantwortlichkeit,
  Gewerk und Ausführungsort mit den tatsächlich einschlägigen
  Abrechnungsregeln: Dauerläufer-Abrechnungsmodell und Laufzeit,
  Stundenabrechnung mit Gewerk/Abrechnungsleistung/Rechnungsentwurf,
  Angebotszuweisung manueller Zeiten bei Einmalprojekten,
  Pauschalabrechnungs-Konfiguration, Zeitbudget, Planung, sichtbare Aufgaben
  und Projektgewinn-Datenqualität. Jeder Treffer enthält Beleg, Folge und
  konkreten nächsten Schritt; kritische Blocker werden vor weiteren
  Prüfhinweisen dargestellt. Das Ergebnis zeigt eine nachvollziehbare
  0-bis-100-Einordnung und die für die Projektart erkannte Automatik.
  Finanz-, Kontakt-, Aufgaben- und Kostensatzprüfungen werden nur ausgeführt,
  wenn sowohl echte Sitzung als auch wirksame Rolle sie erlauben. Gesperrte
  Daten werden nicht geladen. Der Check ist organisationsgebunden, rein
  lesend, deterministisch und verursacht keine OpenAI-Tokenkosten. Keine
  Prisma- oder Datenbankänderung; keine automatische Korrektur.

- Einheitlicher JARVIS-Dialog 2026-07-27: Die sichtbaren Modi `Systemhilfe`,
  `Vertrieb` und `BWL` wurden zu einem gemeinsamen Chat mit der Bezeichnung
  `JARVIS · Dein KI-Assistent für WorkPilot360` zusammengeführt. Die
  Fachgrenzen bleiben intern bestehen: Ein deterministischer Router ordnet
  Bedienfragen, Vertrieb und BWL automatisch zu; die bisherigen
  serverseitigen Rollen-, Sitzungs- und Datenklassenprüfungen werden dadurch
  nicht aufgeweicht. Der Chat besitzt nur noch einen Gesprächsverlauf.
  Auswahlantworten sind keine untypisierten Textstrings mehr, sondern
  validierte Objekte aus ID, sichtbarem Label und vollständigem Folge-Prompt.
  Dadurch funktionieren sowohl die bestehende Projektart-Rückfrage als auch
  neue geführte Dialoge ohne fest verdrahtete Sonderlogik im Frontend.
  Breite Personenfragen wie `Sag mir alles über Klaus Testmann` liefern nach
  eindeutiger, organisationsgebundener Suche zunächst klickbare,
  rollengerechte Bereiche für Überblick, Projekte, Dokumente, Aufgaben,
  Aktivitäten, Kontaktdaten und Projektdiagnose. Erst der gewählte Bereich
  lädt die dafür nötigen Daten; der sichtbare Klick bleibt kurz, während der
  interne Folge-Prompt den Personenbezug sicher mitführt. Eindeutige
  Detailfragen werden weiterhin direkt beantwortet. Deterministische
  Vertriebsanalysen können im gemeinsamen Systempfad antworten; freie
  Vertriebs- und BWL-Fragen werden intern zum bestehenden, weiterhin
  rollengeschützten KI-Pfad geleitet. Keine Prisma- oder
  Datenbankänderung.

- JARVIS-Chat-Autoscroll 2026-07-27: Der Nachrichtenbereich folgt nach dem
  Senden der eigenen Nachricht, beim Einblenden der Tippanimation und beim
  Eintreffen der Antwort automatisch der neuesten Konversation. Wächst eine
  strukturierte Antwort nach dem Rendern weiter, hält ein lokaler
  `ResizeObserver` die Ansicht nur dann unten, wenn der Nutzer bereits am
  Gesprächsende war. Bewusstes Hochscrollen wird respektiert und blendet
  stattdessen den kompakten Button `Neueste Nachricht` ein. Scrollzustand und
  Resize-Beobachtung liegen in einer kleinen Kindkomponente, damit
  Scrollereignisse nicht das sehr große Dashboard neu rendern. Bei
  `prefers-reduced-motion` wird ohne weiche Scrollanimation gesprungen. Keine
  API-, Rollen-, Datenbank- oder Fachlogikänderung.

- Login- und Ladeansicht 2026-07-27: Die späte globale `.shell`-Gestaltung
  zeichnet den dunklen Sidebar-Hintergrund nur noch im angemeldeten
  Dashboard. Login- und Boot-Shell überschreiben den Hintergrund nach dieser
  Regel ausdrücklich mit ihrem eigenen vollflächigen Hintergrund; dadurch
  erscheint links vor der Anmeldung und während des Ladens keine leere
  Sidebar mehr. Die eigentliche Dashboard-Sidebar und ihre Breite bleiben
  unverändert.

- Abhängigkeitssicherheit 2026-07-27: Next.js wurde als kontrolliertes
  Patchupdate von 16.2.10 auf 16.2.12 angehoben. Weil Next weiterhin
  verwundbare transitive Versionsbereiche mitführt, erzwingen npm-Overrides
  zusätzlich PostCSS 8.5.23 und Sharp 0.35.3. `npm audit` meldet damit 0
  bekannte Schwachstellen. Nach `npm ci` muss der Prisma-Client weiterhin
  ausdrücklich mit der lokalen Binary generiert werden, bevor TypeScript,
  Tests oder Build laufen. Prisma validate und der Live-Diff waren sauber
  beziehungsweise leer; TypeScript, Regression, Mojibake, 306 Tests,
  Produktions-Build mit 88 Seiten sowie ein angemeldeter Browserdurchlauf von
  Projektakte und strukturierter JARVIS-Kundenantwort bestanden. Keine
  Prisma-, Datenbank- oder Fachlogikänderung.

- JARVIS-Struktur und Projektdiagnose 2026-07-27: Deterministische
  Personen-/Kundenantworten können zusätzlich ein serverseitig typisiertes
  Antwortmodell mit Überschrift, Kurzkontext, Kennzahlen und erklärenden
  Abschnitten liefern. Die UI validiert Feldlängen, Tonwerte und Listen erneut
  und rendert diese Antworten strukturiert statt als langen Fließtext; der
  normale Nachrichtentext bleibt als sicherer Fallback erhalten. Fragen nach
  abweichenden Projektzahlen werden vor der allgemeinen Personen- und
  Systemhilfe als Diagnose erkannt. JARVIS vergleicht dafür die eigene stabile
  ID-Verknüpfung mit der tatsächlich verwendeten Kundenakten-Zählung, kann
  reine Namenszuordnungen und nur über Ansprechpartner/Adresse verknüpfte
  Projekte benennen und gibt betroffene Projekte als erlaubte Sprungkarten
  aus. Wenn eine frühere Abweichung inzwischen behoben ist, meldet er den
  aktuellen Gleichstand statt eine alte Ursache zu behaupten. Die Diagnose ist
  organisations- und rollenbeschränkt, rein lesend, deterministisch und ohne
  OpenAI-Aufruf. Das JARVIS-Panel wird nach seiner Einfluganimation nicht mehr
  dauerhaft auf einer Transform-Ebene gehalten; dadurch bleibt die Schrift
  insbesondere bei reduziertem Browserzoom schärfer.

- JARVIS-Personen- und Kundenübersicht 2026-07-26: Freie Fragen wie
  `Was weißt du über Klaus Testmann?` werden vor der allgemeinen Systemhilfe
  als sichere Personenabsicht erkannt. JARVIS sucht ausschließlich in der
  aktuellen Organisation, ordnet Kundenkontakte und – nur mit
  Personalberechtigung – Mitarbeitende getrennt zu und fordert bei mehreren
  Treffern Kundennummer, Firma oder Rolle nach. Kunden werden ausschließlich
  über stabile Kontakt-, Firmen- und Ansprechpartner-IDs mit Projekten,
  Angeboten, Rechnungen, erlaubten Aufgaben und Logbuchaktivitäten verbunden;
  keine fachliche Verknüpfung über bloße Namensähnlichkeit. Gelöschte und
  stornierte Dokumente einschließlich historisch fehlkodierter
  `Gelöscht`-Werte werden nicht als relevante Historie gezählt. Finanzangaben,
  Aufgaben und Mitarbeiterdaten folgen weiterhin der Schnittmenge aus echter
  Sitzung und emulierter Rolle. Mitarbeiterübersichten sind auf
  Geschäftsführung/Administration beschränkt und zeigen keine Lohnwerte,
  Personalakten oder technischen Geheimnisse. Geheimnisse bleiben für alle
  Rollen gesperrt. Rein lesend, ohne OpenAI-Aufruf und ohne
  Prisma-Schemaänderung.

- JARVIS-Vertriebsanalyse-Dry-Run 2026-07-26: Der JARVIS-Reiter `Vertrieb`
  erkennt konkrete Fragen nach Nachfass- und Verkaufschancen vor dem freien
  KI-Pfad und prüft sie bei jeder Anfrage neu gegen die aktuelle
  organisationsgebundene Datenbank. Dadurch fließen auch später angelegte
  Kunden, Projekte, Angebote und Rechnungen automatisch ein; ein statischer
  Wissensstand wird nicht verwendet. Der erste Dry-Run ist ausschließlich für
  eine echte Geschäftsführungs-Sitzung freigegeben und wird bei Emulation
  eingeschränkt. Er priorisiert belegte, noch nicht nachverfolgte Signale aus
  angesehenen, nicht angenommenen Angeboten, kürzlich abgeschlossenen
  Projekten und Leistungen im vergleichbaren Vorjahreszeitraum. Aktive
  Projektpotenziale, Verkaufschancen und erkennbare Nachfassaufgaben
  unterdrücken Dubletten. Jeder Treffer nennt Quelle, Datum und vorsichtige
  Empfehlung; es werden weder OpenAI-Tokens verbraucht noch Aufgaben, Mails
  oder andere Datensätze geschrieben. Die Systemhilfe verweist Analysefragen
  auf den rollengerechten Vertriebsreiter. Keine Prisma-Schemaänderung.

- JARVIS-Profi-Allrounder-Roadmap 2026-07-26: JARVIS soll zu einem
  rollengerechten Profi für Systembedienung, Vertrieb, Projektverständnis und
  Betriebswirtschaft ausgebaut werden. Geplant ist ein regelmäßiger,
  deterministisch gesteuerter Projekt- und Kundenchancen-Check: Er vergleicht
  belastbare historische Leistungen, Projektarten, Zeitabstände, offene
  Angebote, letzte Aktivitäten und ähnliche Kunden, erkennt mögliche
  Wiederholungs-, Nachfass- und Cross-Selling-Anlässe und liefert dafür
  nachvollziehbare Empfehlungen mit Datenquelle statt erfundener Behauptungen.
  KI priorisiert, erklärt und formuliert; WorkPilot-Systemlogik bestimmt
  Treffer, Rechte, Turnus, Limits und Deduplizierung. Aus Empfehlungen dürfen
  Aufgaben oder Mailentwürfe vorbereitet werden. Kundenmails benötigen immer
  eine sichtbare Vorschau und die bewusste Freigabe eines berechtigten
  Mitarbeiters und werden über dessen freigegebenes Unternehmenskonto
  versendet, niemals scheinbar von JARVIS. Interne Systemmails an Mitarbeitende
  dürfen den Anzeigenamen `JARVIS` tragen, bleiben technisch am
  Unternehmens-Systempostfach, rollenbezogen, auditierbar und werden nicht an
  Kunden versendet. Noch keine Ausführung oder Automation in diesem Block.

- JARVIS-Leseadapter 2026-07-26: Die Systemhilfe erkennt eindeutige
  Such-, Öffnungs- und Zusammenfassungsabsichten für Projekte, Kunden/Kontakte,
  Aufgaben, Angebote und Rechnungen deterministisch und ohne OpenAI-Aufruf.
  Alle Abfragen sind organisationsgebunden und geben nur schmale
  Trefferzusammenfassungen zurück. Kunden, Angebote und Rechnungen verwenden
  die bestehenden WorkPilot-Berechtigungen; Aufgaben werden zusätzlich für
  echte Sitzung und gegebenenfalls emulierten Benutzer nach Eigentümer,
  Beteiligung und Team gefiltert. Emulation kann die Reichweite weiterhin nur
  einschränken. Die Oberfläche validiert Serverantworten und öffnet nur
  Datensätze aus ihren bereits erlaubten, geladenen Listen. Normale
  Bedienfragen wie „Wie lege ich ein Angebot an?“ bleiben Systemhilfe und
  werden nicht als Datensuche missverstanden. Keine Prisma- oder
  Datenänderung; alle schreibenden Aktionen bleiben `planned`.

- JARVIS-Systemlandkarte 2026-07-26: Die maschinenlesbare Registry
  `src/lib/jarvis/system-map.ts` erfasst 88 Bereiche aus Hauptnavigation,
  Aufgaben, Zielen, Mitarbeitern, Prozessen, Buchhaltung, Katalog,
  Auswertungen, Firmeneinstellungen, Kalkulationen sowie Projekt- und
  Kundenakte mit Zweck, Kernabläufen, Rollen, Navigationsziel, Prüfstatus und
  Quellverweis. JARVIS beantwortet eindeutige Bereichs- und Kontextfragen
  deterministisch und kann als erste verfügbare, rein lesende Aktion einen
  erlaubten Bereich öffnen. Die UI validiert Serverziele erneut gegen ihre
  Rollen-Allowlist; Projekt-/Kundenreiter benötigen eine bereits geöffnete
  passende Akte. Alle schreibenden Aktionen bleiben `planned`. Der
  Vermietungsbereich ist bewusst `limited/needs_review`. Keine Prisma- oder
  Datenänderung. Abdeckung und Pflegepflicht stehen in
  `docs/JARVIS_SYSTEMLANDKARTE.md`.

- JARVIS-Sicherheitskern 2026-07-26: Der verbindliche Gesamtplan liegt in
  `docs/JARVIS_ENTWICKLUNGSPLAN.md`. JARVIS klassifiziert Fragen jetzt nach
  internen, Kunden-, Finanz-, Personal-, Lohn- und geheimen Daten. Rechte
  werden bei Mitarbeiteremulation als Schnittmenge aus wirklich angemeldetem
  Benutzer und emulierter Rolle geprüft; Emulation kann JARVIS dadurch nur
  einschränken, niemals hochstufen. Passwörter, API-Schlüssel, Tokens und
  technische Secrets bleiben für alle Rollen gesperrt. Ein zentraler
  Aktionskatalog beschreibt Navigation, Aufgaben, Planung, Zeiten, Projekte,
  Kontakte, Angebote, Rechnungen, Mail, Personal, Massenänderungen und
  Automationen samt Risiko und Bestätigungsstufe. Alle Aktionen stehen in
  diesem Fundamentblock ausdrücklich auf `planned` und sind noch nicht
  ausführbar. Bekannte Bedienhilfen sind mit den bestehenden
  WorkPilot-Berechtigungen verbunden. Keine Prisma- oder UI-Änderung.

- JARVIS-Systemassistenz 2026-07-24: Die bisher getrennten Einstiege fuer
  Systemhilfe, Vertrieb und BWL laufen jetzt in einem gemeinsamen, global
  erreichbaren JARVIS-Slide-out zusammen. Die Systemhilfe ist fuer aktive
  Benutzer verfuegbar; Vertrieb und BWL bleiben an die bestehenden
  Rollenrechte gebunden. JARVIS kennt die aktuelle Oberflaeche nur ueber
  eine technische Allowlist ohne Kunden-, Projekt- oder Personenbezeichnungen.
  Die erste Wissensbasis beantwortet ausschliesslich Fragen zur Bedienung,
  stellt bei mehrdeutigen Ablaeufen Rueckfragen und lehnt insbesondere
  Lohn-/Gehaltsfragen sowie sachfremde Fragen ab. Ohne OpenAI-Key arbeitet
  die Systemhilfe weiterhin deterministisch; mit Key formuliert standardmaessig
  `gpt-5.6-luna`, waehrend Vertrieb/BWL `gpt-5.6-terra` verwenden. Keine
  Prisma-Schemaaenderung.

- Stempelstatus und Stundenentwurf gehaertet 2026-07-24: Der bestaetigte
  Wechsel eines Projekts auf `Umsetzung` erfolgt beim Stempelstart jetzt
  serverseitig in derselben Datenbanktransaktion wie die Anlage der aktiven
  Stempelung. Damit kann die Stempelung nicht mehr erfolgreich starten,
  waehrend der getrennte, rollenabhaengige Projekt-Speicheraufruf unbemerkt
  scheitert. Geschuetzte spaete Projektstatus werden nicht ueberschrieben.
  Auch `Arbeit unterbrochen` wird beim Abstempeln serverseitig gesetzt.
  Bei Dauerlaeufern mit Stundenabrechnung bleibt geleistete Zeit unabhaengig
  von `fertig` oder `unterbrochen` abrechenbar: Die erste passende Stempelung
  eines Monats erzeugt den Entwurf, weitere Stempelungen erweitern denselben
  Entwurf und werden nach Verrechnungsleistung zusammengefasst. Fehler dieser
  Abrechnungsautomatik werden nicht mehr nur geloggt, sondern im Hauptprogramm
  sichtbar gemeldet. Keine Prisma-Schemaaenderung.

- Projektstatus-Fruehwarnung 2026-07-24: Der zuvor nur vorbereitete Bereich
  `Firmeneinstellungen > Zeitfristen > Projektstatus & Eskalation` steuert
  jetzt sechs operative Projektphasen: Lead/Klaerung, Zur Planung bereit,
  Geplant, Umsetzung, Endkontrolle und Schlussrechnung. Angebot,
  Warten auf Kunde, Arbeit unterbrochen und Abgeschlossen bleiben bewusst in
  ihren eigenen Fachprozessen und werden durch die alte generische
  Status-Eskalation nicht mehr doppelt verarbeitet. Je Phase gelten eine
  erste Frist an die verantwortliche Person und eine zweite Frist an die
  Geschaeftsfuehrung; Projektstatus werden niemals automatisch geaendert.
  Vor der Aktivierung ist ein Dry-Run verpflichtend. Die globale Einstellung
  ist standardmaessig aus, ebenso die zusaetzlichen Serverfreigaben
  `WORKPILOT_PROJECT_STATUS_AUTOMATION_ENABLED` und
  `WORKPILOT_PROJECT_STATUS_DELIVERY_ENABLED`. Ein Bestands-Dry-Run am
  24.07.2026 fand 105 faellige Altprojekte, davon 95 ohne eindeutig auf einen
  aktiven Benutzer abbildbare verantwortliche Person; deshalb darf die
  Zustellung erst nach fachlicher Bereinigung und bewusster Freigabe
  eingeschaltet werden. Prisma-Schema und Projektstatusdaten wurden dafuer
  nicht migriert oder veraendert.

- Zeitfristen und Zeiteintrags-Zuordnung 2026-07-24: Die Firmenansicht
  `Zeitfristen` verwendet jetzt eine kompakte, horizontale Bereichsauswahl,
  klar getrennte Regelkarten und eine gemeinsame, am unteren Rand sichtbare
  Speicheraktion. Die fachlichen Fristen und Eskalationsregeln blieben
  unveraendert. Manuelle Zeiteintraege unterscheiden nun nach Projekttyp:
  Einmalige Projekte verlangen eine gueltige Auftragsgrundlage aus den aktiven
  Angeboten oder Nachtraegen des konkreten Projekts; eine ausdrueckliche
  Erfassung ohne Angebot benoetigt eine Begruendung. Stunden-Dauerlaeufer
  verlangen weiterhin Verrechnungsgewerk und passende aktive
  Stunden-Abrechnungsleistung, Monatspauschalen keine zusaetzliche Zuordnung.
  Die Zuordnung bleibt beim Bearbeiten sichtbar und wird in der
  Bearbeitungshistorie dokumentiert. `ProjectTimeEntry` wurde additiv um die
  optionalen Felder `offerId` und `offerLabel` erweitert; die API prueft
  organisations- und projektgenau, dass ein ausgewaehltes Angebot wirklich
  zum Zeiteintrag gehoert. Bestehende Eintraege bleiben lesbar.

- Kalkulations-Rechner Fahrzeuge 2026-07-23: Der Sidebar-Bereich
  `Kalkulations-Rechner` besitzt jetzt eine eigene Uebersicht und die
  Unterbereiche Winterdienst, Fahrten, Vermietung und Fahrzeuge. Der
  bestehende Winterdienstrechner blieb fachlich unveraendert. Fahrzeuge
  werden organisationsgebunden mit Verbrauch, Selbstkosten, Kilometer-VK
  sowie vorbereitenden Mietwerten verwaltet. Der Fahrtenrechner verwendet
  ausschliesslich Fahrzeug- und Kraftstoffkosten; Personalkosten aus der alten
  Crafter-Excel sind bewusst ausgeschlossen. Kraftstoff-, Fahrzeug-,
  Gesamt-Selbstkosten, Fahrt-VK, Gewinn, Aufschlag auf Selbstkosten und echte
  Marge vom Verkauf werden getrennt ausgewiesen. Gespeicherte Kalkulationen
  halten Fahrzeug-, Eingabe-, Ergebnis- und Kraftstoffpreis-Snapshots fest.
  Aktuelle Diesel-, E5- und E10-Preise koennen serverseitig ueber die
  Tankerkoenig-/MTS-K-API fuer HERM, In der vorderen Wanne 11, geladen und
  zehn Minuten zwischengespeichert werden; ohne API-Schluessel oder bei
  Ausfall bleibt der Kraftstoffpreis manuell editierbar. Das Prisma-Schema
  wurde ausschliesslich um `Vehicle` und `VehicleCalculation` erweitert.

- Kontakte-Reiter-Isolierung 2026-07-23: Die Kontakte-Uebersicht besitzt jetzt
  einen eigenen React-Komponenten- und Zustandsbereich fuer Suche, Kategorie,
  Spaltenfilter, Pagination, Zeilenauswahl und Export. Eingaben in der
  Kontaktsuche rendern dadurch nicht mehr die vollstaendige Dashboard-Seite;
  die eigentliche Filterberechnung laeuft nachrangig ueber den verzögerten
  Suchwert. Kundenakte, Kontaktmodal, Gruppenaktion, API- und Rechtevertrag
  blieben unveraendert. Der Kontakte-Reiter dient als gepruefter Pilot fuer die
  schrittweise Isolierung weiterer Reiter. TypeScript, 207 Tests, Regression,
  Mojibake, Prisma validate/db push, Produktions-Build und ein echter
  Browserdurchlauf von Suche, Kategorie, Kundenakte, Spaltenmenue und
  Gruppenaktions-Modal bestanden.
- Dashboard-Suchleistung 2026-07-23: Auch die gemeinsame
  Artikel-/Leistungen-/Pakete-Liste haelt Suche, Statusfilter und Pagination in
  einer eigenen Unterkomponente. Weitere grosse Volltextsuchen in Projekten,
  Projektkarte, Aufgaben, Mitarbeitern, Buchhaltung, Auswertungen, Dokumenten
  und umfangreichen Detailmodale puffern die Eingabe lokal und uebergeben den
  Filter erst nach einer kurzen Tipp-Pause an den fachlichen Elternzustand.
  Formulare und Auswahlfelder bleiben bewusst unmittelbar gesteuert. Keine
  API-, Daten- oder Prisma-Logik wurde geaendert.

- Stammdaten-Kalkulationsreiter 2026-07-23: Die Reiter `Informationen`,
  `Kalkulation` und `Historie` im Bearbeitungsmodal fuer Artikel, Leistungen
  und Pakete verwenden eine eigene stabile Reiterleiste. Sie behaelt auch in
  kleineren, intern scrollbar gewordenen Browserfenstern ihre Hoehe und bleibt
  beim Scrollen am oberen Rand sichtbar. Kalkulationslogik und Datenfelder
  blieben unveraendert.

- Rueckfallhinweis im Angebotsversand 2026-07-23: Der automatisch eingefuegte
  Freigabeblock weist Empfaenger jetzt darauf hin, bei einem blockierten oder
  nicht zu oeffnenden Button direkt auf die Angebotsmail zu antworten. Der
  normale Begleittext und dessen Vorlage bleiben weiterhin frei bearbeitbar;
  Button, Sicherheitsinformation und Rueckfallhinweis bleiben systemseitig.

- Persoenliche Signatur in Freigabemails 2026-07-22: Automatische
  Bestaetigungen einer Angebotsannahme und eines Widerrufs verwenden jetzt die
  im Absenderprofil hinterlegte, nicht ausgeblendete E-Mail-Signatur. HTML-
  Signaturen werden wie beim regulaeren Dokumentversand von ausfuehrbaren
  Inhalten bereinigt; ohne nutzbare Signatur bleibt die bisherige schlanke
  Grusszeile als Rueckfall erhalten.

- Angebotsfreigaben in Sales-Performance 2026-07-22: Projekt- und
  Kundenakten zeigen am Reiter `Freigaben` einen Vorgangszaehler, ohne dass
  der Reiter zuvor geoeffnet werden muss. Sales-Performance wertet je Angebot
  nur den neuesten Freigabevorgang im gewaehlten Versandzeitraum aus und zeigt
  Oeffnungs- sowie Annahmequote. Die gemeinsame Detailansicht erklaert die
  Bezugsbasis und listet angesehene, noch offene Angebote mit Versand,
  letztem Aufruf, Aufrufzahl, Nachfassalter, Wert und direkten Spruengen zu
  Angebot, Projekt und Kunde. Die Daten aktualisieren sich im Sales-Reiter
  alle 15 Sekunden sowie bei Fokus beziehungsweise Rueckkehr in den Browser.

- Verbraucher-Widerruf und Live-Freigaben 2026-07-22: Digitale
  Angebotsannahmen erkennen Privatkunden ueber den strukturierten Kontakt-Typ
  beziehungsweise die Kategorie `Privatkunde`. Nur fuer diese Empfaenger wird
  die Angebotsmail um eine Widerrufsbelehrung mit Musterformular ergaenzt. Die
  Annahmeseite verlangt deren Kenntnisnahme und bietet den vorzeitigen
  Leistungsbeginn bewusst nur optional mit gesonderter Bestaetigung an.
  Belehrung, Einwilligungen, Frist, Angebotsversion, Annahme und ein innerhalb
  der Frist online erklaerter Widerruf werden unveraenderlich protokolliert;
  Kunde und WorkPilot erhalten passende PDF-Nachweise und Statusmeldungen.
  Firmenkunden behalten den schlanken bisherigen Ablauf. Der Projekt- und
  Kundenreiter `Freigaben` aktualisiert sichtbare Vorgangsdaten alle fuenf
  Sekunden sowie bei Fokus/Rueckkehr in den Browser, ohne die ganze Seite neu
  zu laden. Prisma-Diff ist nach dem additiven Push leer. Prisma-Validierung,
  TypeScript, 184 Tests, Regression, Mojibake, Produktions-Build, PDF-Sichttest
  sowie ein echter Browserdurchlauf von Ansicht, Annahme, Widerruf und
  Live-Aktualisierung bestanden; alle QA-Daten wurden danach entfernt.

- Digitale Angebotsannahme 2026-07-22: Beim Angebotsversand kann standardmäßig
  ein 30 Tage gültiger, kryptografisch zufälliger Annahmelink mitgesendet
  werden. Die öffentliche Seite zeigt die unveränderlich gespeicherte
  Angebots-PDF und verlangt Name, Berechtigungsbestätigung sowie die explizite
  zahlungspflichtige Beauftragung. WorkPilot protokolliert Versand, echten
  Seitenaufruf, begonnenen Annahmeprozess, Zeitpunkt, Empfänger, Erklärenden,
  Funktion, IP, Browserkennung und SHA-256 der Angebotsversion. Die Annahme
  wird transaktional als gewonnenes Angebot gespeichert; parallele oder
  wiederholte Annahmen können den Vorgang nicht doppelt abschließen. Kunde und
  Absender erhalten Angebot beziehungsweise erzeugtes Freigabeprotokoll als
  PDF, wobei ein Fehler der Bestätigungsmail intern sichtbar bleibt. Projekt-
  und Kundenakte besitzen für berechtigte Rollen den Reiter `Freigaben` mit
  Statuschronik, Aufrufen, Nachfasshinweis und PDF-Zugriff. Ein neu versendeter
  Link ersetzt erst nach erfolgreichem E-Mail-Versand ältere offene Links.
  Prisma-Diff enthielt ausschließlich die additive Freigabetabelle; nach
  Anlage ist der Diff leer. TypeScript, 183 Tests, Regression, Mojibake,
  Produktions-Build und echter Browsertest der PDF-/Formularansicht sowie der
  verzögerten View-Erkennung bestanden. Der temporäre QA-Datensatz wurde
  anschließend vollständig entfernt.

- Artikel-/Leistungs-Auswertung 2026-07-22: Der Reiter verwendet jetzt fuenf
  klickbare KPI-Karten mit breiten, durchsuchbaren Detailmodals statt der
  dauernd sichtbaren Tabellen. Materialien und Leistungen aus verkauften
  Paketen werden anteilig mitgerechnet; Materialmengen folgen der Formel
  verkaufte Paketmenge mal Komponentenmenge. Positionsrabatte, gespeicherte
  Material-/Lohnkosten und Paketbestandteile werden bei neuen Rechnungen als
  historische Snapshots gesichert. Altdaten ohne Snapshot werden aus den
  verfuegbaren Stammdaten rekonstruiert und im Modal sichtbar als solche
  gekennzeichnet. Rechnungs-, Projekt- und Stammpositionsspruenge bleiben in
  den Tabellen erhalten. Prisma validate/db push, TypeScript, 175 Tests,
  Regression, Mojibake, Build und echter Browser-Klicktest bestanden.

- PWA-Projektbereichsvertrag 2026-07-15: `/api/hero/projects` liefert mit
  `businessAreaCode` nun explizit `OK_IMMOCARE` oder `OK_SOLUTIONS`. Die
  Ermittlung nutzt nur die strukturierten Projektfelder und fuer historische
  Importe den bereits etablierten `OKI-`-Projektnummernpraefix; sichtbare
  Titel/Kundentexte werden nicht ausgewertet. Nicht klassifizierte Altdaten
  bleiben ohne Migration wie bisher Solutions. Vor einem Produktionsstart
  prueft `npm run check:session-secret` die Existenz und Mindestlaenge des
  serverseitigen Session-Secrets, ohne dessen Inhalt auszugeben.

- Serverseitige erneuerbare Sitzung 2026-07-15: Die bisherige ausschliesslich
  signierte 12-Stunden-Anmeldung wird durch eine serverseitig widerrufbare
  Sliding-Session ersetzt. `AuthSession` begrenzt Sitzungen auf sieben Tage
  Inaktivitaet und absolut 30 Tage; die Cookie-Version rotiert nach zwoelf
  Stunden, wobei die vorherige Version 30 Sekunden fuer parallele Requests
  gueltig bleibt. `/api/auth/session` erneuert beziehungsweise migriert eine
  noch gueltige Altsitzung, liefert fuer abgelaufene Sitzungen den eindeutigen
  Code `SESSION_EXPIRED`, und Logout widerruft den Datensatz serverseitig.
  Das HttpOnly-/Secure-/SameSite-Lax-Cookie bleibt hostgebunden; die PWA nutzt
  weiterhin relative `/api`-Aufrufe ueber ihren bestehenden Reverse Proxy.
  Der genaue PWA-Vertrag steht in
  `docs/HANDOFF_PWA_SESSION_2026-07-15.md`. Keine PWA-Datei wurde geaendert.

- Zielsteuerung Rollen/UI 2026-07-15: `Meine Ziele` zeigt ausschliesslich die
  eigenen Zielkarten; `Zielverwaltung` zeigt Admin/Geschaeftsfuehrung alle
  Organisationsziele und Fuehrungskraeften nur Ziele des eigenen Teams.
  Dieselbe Reichweite wird nun bereits serverseitig in `/api/sales-targets`
  erzwungen; Anlegen, Aendern und Entfernen ist dort wie in der UI nur noch
  Admin/Geschaeftsfuehrung erlaubt. Die beiden Ansichten besitzen eigene
  Navy-Koepfe, moderne KPI-Karten und rollenpassende Texte. Teamgruppen zeigen
  Profilbilder; das Zielmodal gruppiert alle vorhandenen KPI-Optionen fachlich,
  ohne Kennzahlen zu entfernen. Zielwerte, Monats-/Quartals-/Jahres- und freie
  Zeitraeume, Fortschrittsberechnung, Historie und Detailinformationen bleiben
  erhalten.

- Aufgaben-Kalender Modernisierung 2026-07-14: Kalenderuebersicht, Wochen- und
  Tagesansicht verwenden jetzt denselben kompakten Navy-Modulkopf wie die
  uebrigen modernisierten Aufgabenansichten. Die Zeitraumsteuerung verbindet
  Heute-Sprung, Vor-/Zuruecknavigation, Zeitraumtitel und Ansichtswechsel in
  einer gemeinsamen Werkzeugzeile. In der Monatsansicht bleiben die Zellen
  bewusst ruhig: Aufgaben erscheinen kompakt mit Uhrzeit, Titel,
  Zustaendigkeit und schmalem Statusakzent; Ueberfaelligkeit wird als kleiner
  roter Warnhinweis statt als vollflaechiger roter Rahmen dargestellt. Pro Tag
  werden hoechstens drei Aufgaben direkt gezeigt, weitere bleiben ueber den
  Zaehler erreichbar. Eine feste Tagesuebersicht rechts zeigt weiterhin alle
  vollstaendigen Informationen inklusive A-Nummer, Kunde, Projekt,
  Beteiligten, geplanter Dauer und Deadline sowie die bestehenden Aktionen
  fuer Aufgabe und Abwesenheit. Aufgaben-, Abwesenheits-, Feiertags-,
  Benutzerfilter-, Rollen-, API- und Deadline-Logik blieb unveraendert. Monat,
  Woche, Tag, Tagesauswahl und Aufgabenmodal wurden echt geklickt; bei normaler
  Desktopbreite entstand kein globaler horizontaler Seitenueberlauf.
- Planungsboard Markenkoepfe 2026-07-13: Die beiden Boardkarten beginnen nicht
  mehr mit den ausgeschriebenen Titeln `OK solutions Planungsboard` und
  `OK immocare Planungsboard`. Stattdessen verwenden sie die vorhandenen
  OK-Logo-Assets gemeinsam mit der Funktionsbezeichnung `Planungsboard` in
  einem kompakten Navy-Badge. Der Badge sitzt in einer abgerundeten weissen
  Lasche, die dieselbe Flaeche und Randfarbe wie die Matrixkarte verwendet und
  deren obere Kante leicht ueberdeckt. Dadurch bilden Lasche und Matrix eine
  nahtlos verbundene Einheit. Der 208 Pixel breite Badge zeigt Logo und die
  vollstaendige Bezeichnung `Planungsboard` ohne Abschneiden.
  Matrix, Board-/Tagesklicks, Auslastungswerte und Fachlogik blieben
  unveraendert. Beide Boards wurden auf Desktop und im kleinen Viewport echt
  geprueft; Logos laden vollstaendig und erzeugen keinen globalen horizontalen
  Seitenueberlauf.
- Planungsboard Tageskopf 2026-07-13: Die normale und die projektbezogene
  Tagesansicht verwenden jetzt ueber ihre gemeinsamen Darstellungsklassen
  denselben kompakten Navy-Kopf wie der Planungsboard-Einstieg. Rueckweg,
  Datum, Board-/Gruppenkontext sowie Planung und Terminwunsch bleiben im Kopf;
  die vorhandene Gruppenumschaltung bildet darunter eine eigene weisse
  Werkzeugzeile. Klick-Handler, Board-/Gruppenzustand, Mitarbeiterauswahl,
  Eintraege, Rollen und APIs blieben unveraendert. Einzelgruppe und
  Gesamtansicht wurden auf Desktop sowie im kleinen Viewport echt geklickt;
  es entsteht kein globaler horizontaler Seitenueberlauf.
- Planungsboard Gesamtansicht/Header 2026-07-13: Der Planungsboard-Einstieg
  nutzt einen kompakten Navy-Kopf fuer Titel, Beschreibung und die beiden
  Anlageaktionen; Zeitraum-Navigation und Ansichtswechsel stehen getrennt in
  einer ruhigen weissen Werkzeugzeile. Ein Klick auf `Gesamt` oeffnet jetzt die
  echte Gesamtansicht des gewaehlten Boards statt dessen erster
  Planungsgruppe. Dort erscheinen alle aktiven Board-Mitarbeitenden, waehrend
  Kapazitaeten, bestehende Eintraege und neue Eintraege weiterhin mit der
  tatsaechlichen Planungsgruppe des jeweiligen Mitarbeiters arbeiten. Die
  Gruppenumschaltung zeigt nur die Gruppen des aktuellen Boards. Eine neue
  Planung aus `Gesamt` behaelt das Board bei, verlangt aber eine bewusste
  Gruppenauswahl; die bestehende serverseitige Board-/Gruppenpruefung bleibt
  unveraendert. Desktop und kleiner Viewport wurden echt geklickt.
- Kundenakte Logbuch/Bilder 2026-07-13: Das Kundenlogbuch nutzt bei alten und
  neuen Projekt-Logbucheintraegen die vorhandenen Benutzer-IDs, Namen oder
  Initialen zur Profilbildzuordnung; Systemereignisse erhalten weiterhin ein
  neutrales Systemicon. Eintraege sind absteigend nach Jahr und Monat
  gegliedert, der aktuelle Monat ist geoeffnet und aeltere Monate lassen sich
  aufklappen. Der Bilderzaehler und der Bilderreiter verwenden nun dieselben
  echten Bildanhaenge aus verknuepften Projekten. Immocare-Bilder bleiben pro
  Projekt in Objektbesichtigungen, Vorher- und Nachherbilder gegliedert;
  Solutions zeigt je Projekt eine einfache gemeinsame Bilderflaeche. Fehlende
  Vorschaudaten werden beim Oeffnen gezielt fuer die betroffenen Projekte
  nachgeladen. `Kontaktdaten bearbeiten` steht als einzelne blaue Primaeraktion
  direkt unter der rechten Kontaktdatenliste; im Objektadressen-Kopf bleibt nur
  `+ Weiterer Arbeitsort`. Der Kundenakten-Reiter `Aufgaben` zeigt echte, ueber
  Projekt-ID oder exakte Kundenbezeichnung verknuepfte Aufgaben mit Projekt,
  Status, Prioritaet, Zustaendigkeit, Deadline und direkter Oeffnen-Aktion. Der
  fachlich nicht verwendete Reiter `Auftraege` wurde entfernt. APIs, Rollen,
  Upload-, Dokument-, Aufgaben- und Projektlogik wurden nicht erweitert.
- Adresskompatibilitaet Kundenstamm/Projekt/Planung 2026-07-13: Die vollstaendige
  Hauptadresse eines Kunden gilt ohne Datenkopie als primaerer Arbeitsort.
  Zusaetzliche `ObjectAddress`-Eintraege bleiben fuer weitere Einsatzorte
  vorgesehen. Bei der Immocare-Projektanlage zaehlen Hauptadresse und weitere
  Arbeitsorte gemeinsam; genau eine Option wird automatisch gesetzt, mehrere
  verlangen eine bewusste Auswahl. Die Planung erbt anschliessend die im Projekt
  gespeicherte Adresse und fragt sie nicht erneut ab. Bestehende Projekte mit
  `addressContactId` und/oder Adress-Snapshot bleiben dadurch kompatibel. Die
  Planungs-API leitet die Adresse serverseitig aus Projekt, aktivem Zusatzort
  oder Adresskontakt ab und vertraut keinem frei gesendeten Adresslabel. In der
  Kundenakte wird die Hauptadresse im Reiter `Objektadressen` als Quelle aus den
  Kontaktdaten angezeigt. Fehlhinweise stellen ihre Aktion in jeder Breite in
  einer eigenen Zeile dar.
- Objektadressen in Kundenakte, Projekt und Planung 2026-07-13: Kunden mit
  mehreren Einsatzorten erhalten jetzt eigenstaendige, organisationsgebundene
  Objektadressen mit Bezeichnung, Anschrift und Aktivstatus. Die Kundenakte
  kann sie im Reiter `Objektadressen` anlegen, bearbeiten und deaktivieren.
  Immocare-Projekte muessen eine aktive Objektadresse ihres Projektkunden
  verwenden; bei genau einer Adresse wird sie automatisch gesetzt, bei
  mehreren bleibt die Auswahl bewusst verpflichtend. Dieselbe Regel gilt in
  der Immocare-Planung: keine Adresse erzeugt einen klaren Hinweis, eine wird
  automatisch uebernommen, mehrere verlangen eine Auswahl. Die Planung
  speichert ID und lesbare Anschrift als Zeitpunkt-Snapshot. Solutions bleibt
  von der Pflicht unberuehrt. Lese- und Schreibrechte der Kontakte werden
  serverseitig wiederverwendet; Projekt- und Planungs-APIs pruefen
  Organisation, Kundenbezug und Aktivstatus erneut. Desktop sowie kleiner
  Viewport wurden echt geklickt; der Planungsdialog erzeugt keinen globalen
  horizontalen Seitenueberlauf.
- Kundenakten-Korrekturen und Ausbau-Befund 2026-07-13: Das ungespeicherte
  Notizfeld in der rechten Kundenakten-Spalte wurde entfernt, weil die
  rollen- und auslöserfähigen Kunden-/Projekthinweise diese Aufgabe
  übernehmen. Der Dokumentenbaum lässt sich über seinen Pfeil ein- und
  ausklappen, ohne den ausgewählten Dokumentbereich zu verlassen. `+
  Ansprechpartner` öffnet die Kontaktmaske jetzt direkt mit Kontakttyp
  `Ansprechpartner` und der aktuellen Firma vorausgewählt. Bei der Prüfung
  der nächsten Kundenakten-Module zeigte sich: Bilder und Dokumente können
  bereits aus den verknüpften Projekt-Logbucheinträgen, Angeboten und
  Rechnungen gelesen werden, benötigen aber noch eine gruppierte Kundenakten-
  Darstellung. Objektadressen haben noch keine eigene fachliche Kennzeichnung
  und dürfen nicht als Ansprechpartner-Kontakte modelliert werden. Das
  Kundenlogbuch enthält derzeit zusätzlich fest im Frontend hinterlegte
  Beispielzeilen; manuelle Kundeneinträge werden nur im lokalen React-Zustand
  gehalten. Vor dessen Ausbau daher zuerst persistentes Kundenereignis-/
  Logbuchmodell, API, Rechte und Audit definieren. Projekt-, Kontakt-,
  Dokumenten- und Logik-APIs wurden in diesem Korrekturpaket nicht verändert.
- Hinweis-Wirkungsstufen 2026-07-13: Kunden-/Projekthinweise unterscheiden
  jetzt `Information` und `Bestätigung erforderlich`. Informationen lassen den
  Vorgang nach einfachem Fortfahren weiterlaufen; Pflichtbestätigungen
  verlangen eine aktive Checkbox und werden wie bisher serverseitig mit
  Benutzer, Zeitpunkt und Kontext protokolliert. Unterstützte manuelle
  Auslöser sind Stempelung, Projektanlage, Angebotsversand,
  Rechnungserstellung und Rechnungsversand. Bestehende Hinweise bleiben zur
  Rückwärtskompatibilität bestätigungspflichtig. `Kritische Sperre` ist im
  Editor als nächste Stufe erklärt, bleibt aber client- und serverseitig
  deaktiviert, bis Aufhebung, Freigaberollen und Audit vollständig definiert
  sind. Automatische Stapel-/Versandprozesse wurden nicht mit interaktiven
  Dialogen verändert.
- Kontaktakten-Objektkopf 2026-07-13: Die Kunden-/Kontaktakte nutzt als
  gestalterischen Pilot jetzt denselben ruhigen Navy-Objektkopf wie die
  Projektakte. Die Rückkehr zur Kontaktübersicht steht links oben, darunter
  folgen Kontaktname, Kundennummer und Adresse; die vorhandene Aktion zum
  Bearbeiten der Kontaktdaten steht rechts im Kopf statt doppelt in der
  Seitenkarte. Kontaktfelder, Aktenreiter, Handler, API und Rollenlogik bleiben
  unverändert. Im kleinen Viewport stapeln sich Identität und Aktion.
- Kontakte UI-Verdichtung 2026-07-13: Die Kontakte-Übersicht ist rein
  gestalterisch als kompakter CRM-Arbeitsbereich geschärft. Die sechs
  Kategorien bilden auf Desktop eine ruhige gemeinsame Statusleiste und
  wechseln im kleinen Viewport auf ein 3x2- beziehungsweise 2x3-Raster statt
  einer langen Einzelspalte. Suche, Kategorie und Werkzeuge, Tabellenrahmen,
  Filterzeile, Auswahlzustand sowie das Kontaktmodal nutzen eine einheitlichere
  Operations-Optik. Tabelle und Modal bleiben intern scrollbar; Filter,
  Auswahl, Pagination, Export, Spaltensteuerung, Datenfelder, Klick-Handler,
  API und Rollenlogik bleiben unverändert.
- Auswertungen KI-Werkzeugzeile 2026-07-13: Die rollenabhängigen Schaltflächen
  für BWL-KI und Vertriebs-KI sind in einem einzigen kompakten KI-Menü in der
  Filterzeile der Auswertungen gebündelt. Der Einstieg steht dort rechts neben
  den fachlichen Filtern und bleibt außerhalb der Auswertungen unsichtbar.
  Reiter und Filter behalten dadurch ihre klare fachliche Zuordnung. Die
  bisherige absolute Positionierung samt pauschal reservierter Reiterbreite
  entfällt, damit auch lange Reiterbezeichnungen nicht überlagert werden.
  Sichtbarkeitsregeln, Rollen, Klick-Handler, KI-Modi und APIs bleiben
  unverändert.
- Sales-Performance UI-Hierarchie 2026-07-13: Der Auswertungsreiter ist rein
  gestalterisch in `Steuerung`, `Pruefen & entscheiden`, `Analyse` und
  `Details` gegliedert. Die operativen Bereiche fuer heutige Aktionen,
  Dauerlaeufer und unterbrochene Arbeiten bleiben direkt sichtbar;
  wiederholende Steuerungssignale sowie Angebotsstatus, Verlustgruende und
  Nachfassdetails starten eingeklappt. Geoeffnete Detailtabellen scrollen auch
  im kleinen Viewport innerhalb ihrer eigenen Karte. Werte, Filter,
  Reihenfolgen, Rollen, Aktionen, APIs und Fachlogik blieben unveraendert.
- Planungsboard Heute-Spalte 2026-07-11: Der aktuelle Kalendertag ist in
  beiden Planungsboards nicht mehr nur ueber tuerkise Schrift markiert. Kopf
  und Tageszellen bilden eine sehr dezent getoente Spalte mit Seitenkontur,
  dunkler oberer Akzentlinie und kleinem `Heute`-Badge. Wochenend-, Feiertags-,
  Auswahl-, Kapazitaets- und Planungslogik blieben unveraendert. Desktop- und
  kleiner Viewport wurden echt geklickt; das Board bleibt intern horizontal
  scrollbar, ohne einen globalen Seitenueberlauf zu erzeugen. Die Kontur liegt
  als innerer Schatten innerhalb der Zellen und ueberlagert weder Schrift noch
  Balken; an Wochenenden/Feiertagen bleibt die graue Grundflaeche erhalten.
- Desktop-Push Timeout 2026-07-11: Die Aktivierung von Desktop-Push begrenzt
  jetzt jeden Browser-/Service-Worker-/API-Schritt auf 15 Sekunden und zeigt
  den aktuellen Fortschritt an. Ein nicht aufloesender Browserdialog oder
  Service Worker laesst den Button dadurch nicht mehr dauerhaft im Zustand
  `Desktop-Benachrichtigungen werden aktiviert...`; stattdessen wird der
  Button erneut freigegeben und eine konkrete Fehlermeldung angezeigt. Push-
  Endpunkte, VAPID-Konfiguration, Rollen- und Subscriptionlogik blieben
  unveraendert. Bei einer haengenden Browser-Subscription kann der Nutzer die
  alte WorkPilot-Service-Worker-/Push-Verbindung gezielt zuruecksetzen und
  sofort neu aufbauen. Der Statushinweis ist kompakt, schliessbar und mit
  Abstand von den fachlichen Benachrichtigungskarten getrennt.
- Next-16-Sicherheitsupgrade 2026-07-11: WorkPilot360 wurde auf dem separaten
  Branch `codex/next16-security-upgrade` von Next 14.2.5 auf Next 16.2.10,
  React/React DOM 19.2.7, next-intl 4.13.2 und Vitest 4.1.10 aktualisiert.
  Dynamische App-Router-Parameter verwenden die asynchrone Next-16-Signatur;
  `src/middleware.ts` wurde ohne Logikaenderung zu `src/proxy.ts` migriert.
  Mindestversion fuer Node ist 20.9.0. Der authentifizierte Browserrundgang
  pruefte Dashboard, KPI-/Team-Live-Daten, Benachrichtigungen samt Historie,
  Kontakte-Navigation sowie die mobile Navigation ohne Browserfehler oder
  horizontalen Seitenueberlauf. Der nur lokal angelegte Testbenutzer und seine
  Testmeldung wurden vollstaendig entfernt. Vor dem Serverdeployment zuerst
  Node-Version und weitere PM2-Prozesse pruefen; keine globale Node-Aktualisierung
  ohne Kompatibilitaetspruefung anderer Anwendungen.
- Uebergabe UI-Modernisierung 2026-07-11: Der abgeschlossene operative
  Go-Live-Rundgang und der Startpunkt fuer die naechste Designphase sind in
  `docs/HANDOFF_UI_MODERNISIERUNG_2026-07-11.md` zusammengefasst. Der naechste
  Agent muss diese Datei, diese `AGENTS.md`, die zentrale Dashboard-Komponente
  und das Dashboard-CSS lesen, bevor er UI-Dateien veraendert. Zuerst aktuelles
  UI per echter Klickpruefung auf Desktop und kleinem Viewport aufnehmen, dann
  dem Nutzer ein systemweites Designkonzept vorlegen. Keine grossflaechige
  UI-Aenderung vor Freigabe des Konzepts.
- Verbindliche Abschluss-Checks 2026-07-11: Echte Klickpruefung ersetzt keine
  Code-/API-Pruefung und umgekehrt. Vor jedem Code-Push mindestens betroffene
  Fachlogik und Rechte pruefen sowie `git diff --check`, Tests,
  `npx tsc --noEmit`, `npx prisma validate`,
  `npx prisma db push --skip-generate` und `npm run build` ausfuehren. Ein Push
  ist nur zulaessig, wenn der Prisma-DB-Check keine Datenverlust- oder
  Drop-Warnung zeigt. Nach dem Push Serverbefehle mit dem echten Pfad
  `/var/www/WorkPilot360` und PM2-Prozess `workpilot360` liefern. Ungetrackte
  `.codex-safety/*`, `backup.sql` und temporaere Screenshots nicht stagen,
  loeschen oder zuruecksetzen.
- Operativer Reviewabschluss 2026-07-11: Der strukturierte Modulrundgang
  kombinierte reale UI-Klicks mit Code-, API-, Rollen-, Notification- und
  Datenbankpruefungen. Getestet wurden unter anderem Stempeln/Unterbrechen,
  Aufgaben, Zusatzverkaeufe, Kontakte, Einmal- und Dauerlaeuferprojekte,
  Stundenabrechnung, Angebote, Rechnungen, Planung, Termine und
  Terminwuensche. Die dafuer lokal erzeugten Codex-Testprojekte, Rechnungen,
  Planungen, Zeiten, Benutzer, Meldungen, News-/Ideeneintraege und
  Folgeaufgaben wurden am 11.07.2026 kontrolliert und transaktional bereinigt.
  Echte Projekte `MKG-400` und `HAS-1` sowie ihre urspruenglichen Status blieben
  erhalten. Diese lokale Testdatenbereinigung ist keine Servermigration.
- Zusatzrolle Vertrieb 2026-07-10: `salesRoleEnabled` ist eine zusaetzliche
  Mitarbeiterrolle und keine Ersetzung der Hauptrolle. Aktivierte Vertriebler
  sehen Forecast & OP, Sales-Performance und die Vertriebs-KI. Sichtbarkeit im
  Client ist keine Sicherheitsgrenze; die zugehoerigen API- und KI-Routen
  muessen dieselbe Rolle serverseitig pruefen. Vertrieb darf insbesondere
  keine Gehaelter, internen Personalkosten, Arbeitgeberkosten oder indirekte
  Kostenvergleiche erhalten. Admin/Geschaeftsfuehrung behalten BWL- und
  Vertriebs-KI; BWL-Kontext darf Projekt-, Rechnungs-, Stempel- und Zeitdaten
  nur unter den bestehenden Managementrechten lesen.
- KI-Assistenten Sicherheitsstand 2026-07-10: BWL-KI und Vertriebs-KI sind
  fachlich getrennt. Beide muessen bei fehlenden Daten Unsicherheit benennen,
  duerfen keine Fakten erfinden und beantworten keine fachfremden Fragen.
  Vertriebs-KI blockiert auch Kombinations- und Umgehungsfragen zu Gehalt,
  internen Kosten, Personalaufwand, Arbeitgeberkosten und der Frage, welcher
  Mitarbeiter am billigsten/teuersten ist. Antworten sollen kurz starten,
  lesbar formatiert sein und eine weitere Management-/Vertriebskonversation
  ermoeglichen, statt den Nutzer mit unstrukturiertem Roh-Markdown zu
  ueberfahren.
- Taetigkeitsbericht-Automation 2026-07-10: Die automatische Zuordnung und der
  Versand von Taetigkeitsberichten wurden gegen die realen Projekt-/Empfaenger-
  und Automationsdaten geprueft. Fehler der Winterdienst-Automatik erzeugen
  In-App-Meldung und Mail an die konfigurierten Empfaenger; Versandfehler
  duerfen den Lauf nicht still als erfolgreich ausgeben.
- Stapelabrechnung Schutz 2026-07-10: Die automatische Stapelabrechnung darf
  nur automatisch erzeugte Entwuerfe mit `billingSource` `batch` oder
  `hourly-recurring` uebernehmen. Manuelle Einmalrechnungsentwuerfe duerfen
  weder in die Auswahl geraten noch per manipuliertem PATCH als Batchrechnung
  verarbeitet oder mit Stempelzeiten verknuepft werden. API lehnt diesen Fall
  mit Konfliktantwort ab.
- Notification-/Systemmail-Audit 2026-07-11: Kritische Ereignisse senden an
  die Geschaeftsfuehrung und zusaetzlich an den fachlich Verantwortlichen,
  Projektverantwortlichen oder die Fuehrungskraft. Abgedeckt sind unter
  anderem Statuseskalationen, Unterbrechungen, Unterfakturierung, Mahnungen,
  Kapazitaetsueberschreitungen, Endphasen, Abwesenheiten,
  Abrechnungsbereitschaft und KuZu-Hot-Alerts. KuZu-Hot-Alerts aus manueller
  Erfassung und oeffentlichem Feedback senden seit Commit `bc7852f` auch
  Systemmail an Geschaeftsfuehrung und zustaendigen Vertriebler. Normale
  Feed-, Ideen-, Kommentar- oder Content-Freigabeaktivitaeten bleiben bewusst
  In-App/Push, damit Pflichtmails nicht durch Meldungsrauschen entwertet werden.
- Letzter verifizierter Stand 2026-07-11: Commit `bc7852f` ist auf `main`
  gepusht. Danach bestanden 22 Tests, TypeScript, Mojibake-/Regressionscheck,
  Prisma Validate, `prisma db push --skip-generate` ohne Schemawarnung und der
  Produktionsbuild. Die anschliessende Dokumentationsuebergabe veraendert
  keine Fachlogik und kein Prisma-Schema.
- Aktueller Arbeitsstand 2026-06-26: Der richtige Projektordner bleibt
  `C:\Users\vagte\Downloads\Dokumenteauslastungdashboardhero\WorkPilot360`.
  Nicht in den OneDrive-/SafeDesk360-Ordner wechseln. Der Nutzer will
  vorsichtiges, gezieltes Vorgehen: so viel wie noetig, so wenig wie
  moeglich, vor/nach Logikbloecken sichern, danach Checks laufen lassen und
  Aenderungen in dieser `AGENTS.md` dokumentieren. Kleine reine UI-Fixes
  duerfen schlank bleiben, aber groessere Logikbloecke brauchen Sicherung,
  Checks und Handover-Notiz.
- Auswertungen Konsolidierung 2026-07-06: Der sichtbare Reiter
  `Umsaetze - Details` wurde aus der Auswertungsnavigation entfernt, weil
  seine Inhalte fachlich in Forecast/OP, Monatsbericht, Sales-Performance und
  SVS Analyse sauberer aufgehoben sind. Die bestehende Revenue-Logik blieb
  unangetastet. Im Forecast/OP-Bereich heisst die Rechnungskachel jetzt
  `Fakturierter Umsatz`, damit wirklich abgerechnete Umsaetze weiterhin klar
  sichtbar bleiben.
- Mitarbeiter-Auswertung 2026-07-06: Der Auswertungsreiter
  `Mitarbeitende` heisst jetzt `Mitarbeiter-Auswertung`. Normale Mitarbeiter
  sehen dort nur noch ihre eigenen Kennzahlen; Planungsgruppen- und
  Teamkarten werden fuer sie ausgeblendet. Fuehrungskraefte behalten die
  Auswertung fuer die eigene Planungsgruppe und duerfen weiterhin die
  `SVS Analyse` sehen. Geschaeftsfuehrung/Admin sehen wie bisher alle
  Mitarbeitenden.
- Forecast/OP 2026-07-06: Die Kachel `Fakturierter Umsatz` zeigt im
  Hauptwert jetzt den gesamten fakturierten Umsatz im gewaehlten Zeitraum.
  Zahlungseingang und offene Rechnungswerte stehen darunter als Details
  `Bezahlt` und `Offen`, damit Umsatz, Liquiditaet und OP nicht vermischt
  werden.
- Mitarbeiter-Umsatztransparenz 2026-07-06: Fuer normale Mitarbeiter und
  Fuehrungskraefte gibt es im Auswertungsbereich den reduzierten Reiter
  `Umsatz & Kunden`. Er zeigt fakturierten Umsatz, Umsatzentwicklung und die
  groessten Kunden im gewaehlten Zeitraum. Admin und Geschaeftsfuehrung sehen
  diesen Reiter bewusst nicht, weil sie die vollstaendigen Steuerungsreiter
  nutzen. Sensible Felder wie OP, Mahnungen, Zahlungsstatus, Forecast,
  Marge und Kundenrisiko bleiben in der Mitarbeitersicht ausgeblendet.
- Auswertungs-Reitermatrix 2026-07-07: Die sichtbaren Auswertungsreiter sind
  nach Rollen bereinigt. Admin/Geschaeftsfuehrung sehen die vollstaendigen
  Steuerungsreiter ohne den reduzierten Mitarbeiter-Reiter `Umsatz & Kunden`.
  Fuehrungskraefte sehen `Umsatz & Kunden`, Projekte, SVS, KuZu,
  Mitarbeiter-Auswertung und Projektkarte. Normale Mitarbeiter sehen nur
  `Umsatz & Kunden` und ihre eigene Mitarbeiter-Auswertung. Buchhaltung sieht
  Forecast/OP, Monatsbericht und Kunden; die alte interne Freigabe des nicht
  mehr sichtbaren Reiters `revenue` wurde entfernt.
- Dashboard-KPIs Geschaeftsfuehrung 2026-07-01: Die oberen KPI-Kacheln im
  Dashboard zeigen fuer die Rolle `GESCHAEFTSFUEHRER` jetzt ein 2x2-Set aus
  Umsatz & Forecast, Produktivitaet, Projektlage sowie Vertrieb & Kunde. Das
  Raster bleibt buendig mit dem darunterliegenden `Team live`-Bereich. Andere
  Rollen behalten vorerst die bisherige Team-Live-Zusammenfassung; ihre
  eigenen KPI-Sets sind in `OFFENE_PUNKTE.md` lokal vorgemerkt.
- Angebots-KPIs und Nachfassentscheidung 2026-07-03:
  Angebots-Nachfassaufgaben werden ueber vorhandene `TaskLink`-Eintraege mit
  `offer:<id>` an das Angebot gekoppelt; bestehende Aufgaben werden weiterhin
  ueber Angebotsnummer/Titel erkannt. Beim Erledigen einer Angebots-
  Nachfassaufgabe muss aktiv entschieden werden: Angebot gewonnen, Angebot
  verloren mit Grund/Kommentar oder weiter nachfassen mit neuem Datum. Neue
  Ziel-KPIs: Gewinnquote, Verlustquote, offene Angebote > 14 Tage sowie
  Durchschnittstage von Angebotsausgabe bis Gewinn, Verlust, Planung und
  erledigter Nachfassung. Keine Prisma-Migration noetig, weil `TaskLink`
  bereits existiert.
- Dauerlaeufer-Vormonatsmodal 2026-07-06: `Vormonat(e) unvollstaendig` ist
  bewusst keine reine Rechnungsliste. Das Modal zeigt abgeschlossene
  Vormonate mit offenen Punkten fuer Angebotsgrundlage, Planung, Rechnung,
  Endkontrolle, Vorher-/Nachherbilder und Taetigkeitsbericht. Die Eintraege
  springen je nach Punkt in den passenden Projektbereich. Das Modal darf
  vertikal scrollen, aber nicht horizontal.
- PWA-Web-Push Tageserinnerung/Terminwuensche 2026-06-28:
  Terminwuensche senden jetzt zusaetzlich zur bestehenden In-App-Notification
  einen Web-Push an dieselben Planungsverantwortlichen. Der Push haengt an der
  vorhandenen Terminwunsch-Deduplizierung, damit je Terminwunsch und
  Empfaenger keine mehrfachen Pushes entstehen. Neuer geschuetzter Tageslauf
  `POST /api/push/daily-planning-reminders`: Er bestimmt das Tagesdatum in
  Europe/Berlin, sucht aktive Benutzer mit bestaetigten heutigen
  Planungsterminen, schliesst Benutzer mit eingetragener Urlaub-/Krank-
  Abwesenheit fuer diesen Tag aus und erzeugt pro Benutzer/Datum hoechstens
  eine Erinnerung. Push-Text: `Sieh dir deine heutigen Termine an`; Ziel ist
  bewusst die Startseite, weil dort die heutigen Termine der PWA gelistet
  sind. Der Endpunkt verlangt `PUSH_REMINDER_CRON_SECRET` (Fallback
  `WORKPILOT_CRON_SECRET` oder `CRON_SECRET`) per `Authorization: Bearer ...`
  oder `x-cron-secret`. Checks bestanden: `npm.cmd run check:mojibake`,
  `npm.cmd run check:regressions`, `npx.cmd prisma validate`,
  `npx.cmd prisma db push --skip-generate` ohne Datenverlustwarnung,
  `npm.cmd run build` und `git diff --check`.
- Planungsboard Wochenende 2026-06-28: Wochenenden und Feiertage bleiben im
  Planungsboard optisch als arbeitsfreie Tage markiert. Wenn dort trotzdem
  Planungstermine vorhanden sind, werden sie nicht mehr in der Tagesansicht
  ausgeblendet. Die Board-Zelle zeigt dann eine pulsierende Warnmarke und die
  geplanten Stunden, damit Wochenendtermine nicht unsichtbar bleiben. Checks
  bestanden: `git diff --check`, `npm.cmd run check:mojibake`,
  `npm.cmd run check:regressions`, `npx.cmd prisma validate` und
  `npm.cmd run build` im zweiten Lauf. Der erste Buildlauf hatte einen
  transienten Next-Cache-Fehler `Cannot find module './1682.js'`, der direkte
  Wiederholungslauf war erfolgreich.
- Planung-Push-Texte 2026-06-28: In `src/app/api/planning-entries/route.ts`
  wurden die deutschen Texte fuer Terminwunsch-, Terminverschiebungs-,
  Konflikt- und Planungs-Historienmeldungen geprueft und korrigiert. Push und
  In-App-Notification fuer Terminwuensche nutzen jetzt denselben Body mit
  korrektem `Für`; Mojibake-/ASCII-Umschreibungen wie `Fuer`,
  `geÃ¤ndert`, `â€ž` oder `oeffnen` wurden in diesem Bereich bereinigt.
  Checks bestanden: `git diff --check`, `npm.cmd run check:mojibake`,
  `npm.cmd run check:regressions`, `npx.cmd prisma validate` und
  `npm.cmd run build`.
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
- Prisma Schema Guard 2026-06-27: `npm run check:regressions` prueft jetzt explizit, dass kritische Runtime-/Code-Felder im Prisma-Schema vorhanden bleiben. Aktuell geschuetzt: `WorkPilotProject.recurringBillingMode` und `WorkPilotProject.timeBudgetEnabled`. Fehlt eines dieser Felder wieder, wird der Regressionscheck rot, bevor ein `prisma db push` Loeschwarnungen fuer diese Spalten erzeugt.
- ZUGFeRD OutputIntent 2026-06-27: Die PDF/A-3-Konvertierung sucht nun automatisch ein sRGB-ICC-Profil aus typischen Ghostscript/Linux-Pfaden und uebergibt es an Ghostscript. Der Ghostscript-Parameter fuer das Prozessfarbmodell wurde auf `-sProcessColorModel=DeviceRGB` korrigiert. Ziel: veraPDF-Fehler `DeviceRGB ... without RGB output intent` vermeiden.
- ZUGFeRD PDF/A-Definition 2026-06-27: Ghostscript bekommt bei der PDF/A-3-Konvertierung nun zusaetzlich eine temporär erzeugte `PDFA_def.ps` mit sRGB-OutputIntent vor der Eingabe-PDF. Das folgt der Ghostscript-PDF/A-Logik und soll die serverseitige veraPDF-Ablehnung wegen fehlendem RGB-OutputIntent beheben.
- ZUGFeRD Ghostscript-Lesefreigabe 2026-06-27: Der PDF/A-3-Konverter erlaubt Ghostscript jetzt explizit das Lesen des ermittelten sRGB-ICC-Profils (`--permit-file-read=...`). Zudem werden bei Konvertierungsfehlern stdout, stderr und Fehlermeldung zusammen ausgegeben, damit Serverfehler nicht mehr nur als `Unrecoverable error` erscheinen.
- ZUGFeRD Einbettungsreihenfolge 2026-06-27: Die Rechnung wird nun zuerst in PDF/A-3 konvertiert; danach wird `factur-x.xml` eingebettet und erst dann mit veraPDF validiert. Grund: Ghostscript kann beim nachtraeglichen PDF-Neuaufbau die AF-Verknuepfung eingebetteter Dateien verlieren. Die normale Rechnungs-PDF-Erzeugung und XRechnung-XML bleiben davon unberuehrt.
- Systemmail Grundlage 2026-06-27: Fuer interne Systemmails wurde eine zentrale SMTP-Schicht unter `src/lib/mail/system.ts` vorbereitet. Standardziel ist STRATO SMTP mit `info@oks-cloudservices.com` als technischem Systempostfach und Absender `WorkPilot360 Benachrichtigungen`. Der geschuetzte Testpunkt `/api/system-mail/test` erlaubt Admin/Geschaeftsfuehrung einen Testversand, sobald die `SYSTEM_MAIL_*`-Variablen in `.env` gesetzt sind. Aufgaben, Eskalationen und Benachrichtigungen sind noch nicht auf echten SMTP-Versand umgestellt; das folgt erst nach bestandenem Testversand.
- Aufgaben-Systemmails 2026-06-27: Aufgabenbeteiligungen, Annahme/Ablehnung durch Beteiligte und Erledigt-Rueckmeldungen senden jetzt zusaetzlich zur bestehenden In-App-/E-Mail-Notification echte Systemmails ueber `src/lib/mail/task-notifications.ts`. Der Mailversand ist bewusst weich gekoppelt: Fehlt SMTP-Konfiguration oder scheitert der Versand, bleibt die Aufgabe gespeichert und der Fehler wird nur serverseitig protokolliert. SMTP hat feste Timeouts, damit Aufgabenaktionen nicht dauerhaft haengen bleiben. Erfolgreiche echte Mails setzen `Notification.sentAt`.
- Aufgabenkommentar-Systemmails 2026-06-27: Kommentare auf Aufgaben benachrichtigen die relevanten Aufgabenpersonen jetzt ebenfalls per echter Systemmail. Es wird weiterhin nur eine In-App-Notification erzeugt; die Mail haengt an derselben Notification und setzt bei Erfolg `Notification.sentAt`.
- Unterbrochene-Arbeit-Systemmails 2026-06-27: Nachfass- und Eskalationsmeldungen fuer automatisch erzeugte Aufgaben aus unterbrochenen Arbeiten senden jetzt zusaetzlich zur Glocke echte Systemmails. Die bestehende Duplikatpruefung bleibt erhalten, damit fuer dieselbe Stufe keine mehrfachen Mails entstehen.
- Abwesenheits-Systemmails 2026-06-27: Abwesenheitsmeldungen senden jetzt zusaetzlich zur bestehenden Glocke echte Systemmails ueber den allgemeinen Helfer `src/lib/mail/notifications.ts`. Abgedeckt sind neue Abwesenheiten, Vertretung pruefen, Genehmigung/Ablehnung, Bearbeitungen und Loeschhinweise an die bisherigen Empfaengergruppen. Der Mailversand ist weich gekoppelt; bei fehlender SMTP-Konfiguration oder Sendefehler bleibt die Abwesenheitsaktion gespeichert.
- Offene-Abrechnungszeiten-Systemmails 2026-06-27: Warnungen fuer offene, noch nicht fakturierte Projektzeiten senden jetzt zusaetzlich zur Glocke echte Systemmails. Dauerlaeufer werden am dritten Werktag des Folgemonats geprueft, Einmalprojekte drei Tage nach `Arbeit fertig`; fuer alte Daten ohne Abschlussstatus bleibt der aelteste offene Zeiteintrag als Rueckfall aktiv. Die bestehende `UnbilledTimeAlert`-Duplikatsperre bleibt erhalten, damit pro Projekt/Zeitraum/Stufe keine mehrfachen Mails entstehen.
- PWA-Web-Push Planung 2026-06-27: Web-Push fuer Planungsaenderungen ist serverseitig angebunden. Neue Endpunkte: `GET /api/push/public-key` liefert den VAPID Public Key, `POST /api/push/subscriptions` speichert PWA-Subscriptions eindeutig nach `userId + endpoint`, `DELETE /api/push/subscriptions` entfernt sie wieder. ENV: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, optional `VAPID_SUBJECT` (Fallback `WEB_PUSH_*`). Wenn ein bestehender Planungstermin durch Planungsrollen bei Datum, Start oder Ende geaendert wird, erhaelt der betroffene Mitarbeiter eine normale In-App-Notification plus Web-Push. Pushfehler blockieren das Speichern nicht; 404/410-Subscriptions werden automatisch entfernt.
- Abrechnungsbereit-Systemmails/Login-Start 2026-06-29: Die allgemeine Benachrichtigungs-API sendet beim Erzeugen jetzt zusaetzlich echte Systemmails ueber `src/lib/mail/notifications.ts`. Damit bekommen die Dashboard-Hinweise `Projekt abrechnungsbereit`, `Dauerlaeufer abrechnungsbereit` sowie deren Fuehrungskraft-/Geschaeftsfuehrung-Eskalationen neben der Glocke auch Mail; erfolgreiche Mails setzen `Notification.sentAt`. Der Mailversand bleibt weich gekoppelt. Beim erfolgreichen Login wird der gespeicherte letzte Bereich verworfen und das Hauptprogramm startet wieder auf `Dashboard` (`overview`); direkte URL-Ziele koennen weiterhin explizit oeffnen.
- Projektpipeline Abrechnungspruefung 2026-06-29: Der Projektstatus `Endkontrolle` wurde fachlich durch `Abrechnungspruefung` ersetzt; alte gespeicherte `Endkontrolle`-Werte werden weiter als `Abrechnungspruefung` normalisiert. `Endkontrolle` bleibt Dokument-/Nachweisart. Neuer Sonderstatus `Arbeit unterbrochen`: Bei unterbrochener Projektstempelung wird der Projektstatus automatisch entsprechend gesetzt. Nach gespeicherter Endkontrolle prueft das System Vorherbilder, Nachherbilder und Endkontrolle; wenn alles passt, wird automatisch `Zur Abrechnung bereit` gesetzt, sonst bleibt das Projekt in `Abrechnungspruefung`. Taetigkeitsberichte sind keine Voraussetzung fuer `Zur Abrechnung bereit`, sondern werden in der Faktura-Vorpruefung erzeugt. Nach finaler Rechnung werden Einmalprojekte `Abgeschlossen`; Dauerlaeufer gehen je nach bestaetigter Folgemonatsplanung bzw. voll verplantem Projektzeitkontingent in `Umsetzung` oder `Zur Planung bereit`. Keine Prisma-Schemaaenderung.
- Dashboard Tagesimpuls/KPIs 2026-07-01: Die Geschaeftsfuehrungs-KPIs stehen in den vier rechten Dashboard-Kacheln; Team Live links zeigt wieder nur die Team-Stempelwerte. Der untere dunkle Dashboard-Kasten zeigt jetzt einen Tagesimpuls aus 300 hinterlegten Texten, getrennt nach Rolle und Tageszeit, mit zyklischer Tagesrotation.
- Planungsboard Speichercheck 2026-07-01: Nach erfolgreichem Speichern eines Planungstermins werden die Planungseintraege frisch geladen und die vom Server zurueckgegebenen Eintrags-IDs gegen den Board-Datenbestand geprueft. Fehlt ein gespeicherter Termin nach dem Reload, erscheint eine konkrete Warnung mit Titel, Datum, Uhrzeit, Board und Planungsgruppe.
- Kontakte Uebersicht 2026-07-01: Die sechs Kontakt-Kennzahlen werden im Kopfbereich als ruhige 1x6-Leiste dargestellt. Die aktive Kategorie nutzt eine dezente dunkle Markierung statt tuerkiser Flaeche; Funktion und Filterlogik bleiben unveraendert.
- Kontakte Toolbar 2026-07-01: Gruppenaktion, Export und Spaltenauswahl nutzen einheitliche Iconbuttons mit Tooltip und Aria-Beschriftung. Dropdowns, Bulk-Aktion und Exportlogik bleiben unveraendert.
- News-Feed UI 2026-07-01: Der Hauptreiter `News-Feed` nutzt jetzt die vorhandene News-API statt des Aufbau-Platzhalters. Enthalten sind Laden, Kartenansicht, neues Beitragsmodal, Bildanhaenge, Reaktionen und Kommentare. Sichtbarkeitsauswahl und Abstimmungs-UI bleiben als naechste Ausbaustufe offen; Serverrouten wurden nicht umgebaut.
- News-Feed Kartenoptik 2026-07-01: Die Feed-Darstellung wurde optisch in Richtung kompakter Social-Post-Karten umgestellt. KPI-Kacheln im Feed entfallen; die Karte zeigt Autorzeile, quadratische Bildflaeche, Text, schlichte Reaktionen und Kommentare. Teilen-/Speichern-Aktionen wurden nicht eingefuehrt; Fachlogik bleibt unveraendert.
- News-Feed Feinschliff 2026-07-02: Feed-Karten sind breiter, Autoren verwenden vorhandene Benutzer-Profilbilder mit Initialen-Fallback, und die sichtbaren Reaktionen wurden auf einen einzelnen `Gefällt mir`-Button reduziert. Kommentare bleiben erhalten; API, Datenmodell und PWA-Dateien wurden nicht geaendert.
- News-Feed Ausbau 2026-07-02: Beitraege koennen vom Autor sowie Admin/Geschaeftsfuehrung bearbeitet werden. Der Beitragsdialog unterstuetzt Umfragen mit Antwortoptionen; vorhandene Vote-Route wird genutzt. Neue Firmenfeed-Beitraege erzeugen App-Benachrichtigung und PWA-Push fuer aktive sichtberechtigte Mitarbeiter, ohne Mailversand.
- Meine Ziele 2026-07-03: Zieluebersicht steht vor dem Formular, das Anlage-/Bearbeitungsformular wird nur bei Bedarf geoeffnet. Ziele koennen bearbeitet oder per bestaetigter Aktion entfernt werden; Entfernen setzt den Status auf `discarded` statt physisch zu loeschen.
- Meine Ziele Kopfbereich 2026-07-03: Die drei grossen KPI-Kacheln wurden durch eine kompakte Statuszeile ersetzt: Alle Ziele, Aktiv, Erreicht und Handlungsbedarf. Der Anlagebutton steht darunter mit mehr Abstand zur Zieluebersicht.
- Meine Ziele Buttonabstand 2026-07-03: Der Anlage-/Speicherbutton im Zielformular hat eigenen Abstand zum Notizfeld, damit er die Textarea nicht optisch schneidet. Zielkarten-Designvorschlaege liegen nur lokal unter `.codex-safety/goal-card-design-proposals-20260703.svg` und sind noch nicht umgesetzt.
- Meine Ziele Zielkarten 2026-07-03: Zielkarten nutzen jetzt eine Fortschrittsdarstellung mit Ist-Wert, Balken und Zielmarker. Normale Ziele gelten als erreicht, wenn Ist groesser/gleich Ziel ist; Grenzwert-Ziele wie unproduktive Stunden, offene/ueberfaellige Aufgaben und verlorene Angebote gelten als erreicht, solange Ist kleiner/gleich Ziel bleibt.
- Meine Ziele Zielmarker 2026-07-03: Die Zielmarke in Zielkarten ist optisch dezenter und wird bei Grenzwert-Zielen als `Grenze` statt `Ziel` beschriftet, damit Maximalwerte fachlich klarer wirken.
- Meine Ziele Zielmarker-Ausrichtung 2026-07-03: Zielstrich und Ziel-/Grenze-Beschriftung verwenden wieder dieselbe Position. Der Hilfspunkt wurde entfernt; Grenzwert-Ziele erhalten rechts einen Pufferbereich, damit die Grenze nicht am Balkenende klebt.
- Meine Ziele Zeitraum/Modal 2026-07-03: Zielanlage und Bearbeitung laufen jetzt im Modal. Ziele koennen als Monats-, Quartals-, Jahres- oder freier Zeitraum angelegt werden; gespeichert werden weiterhin nur `periodStart` und `periodEnd`. Quartals- und Jahresziele zeigen Monatsbalken plus Quartals-/Jahresschnitt bzw. Summe. Geschaeftsfuehrung/Admin und Fuehrungskraefte sehen Zielinhaber zunaechst eingeklappt, Mitarbeitende ihre eigenen Zielkarten direkt.
- Auswertungen Geschaeftsfuehrung 2026-07-07: Die Systeminterpretation im GF-Reiter benennt aktive Wachstumsbremsen bewusst direkt und ungeschoent. Es werden alle nicht-gruenen Engpaesse gezeigt, statt nur einen Schwerpunkt weich zusammenzufassen. Beruecksichtigt werden u.a. ueberfaellige und offene Posten, lange Pipeline-Statuslaufzeiten, Forecast-Datenqualitaet, Abrechnungspruefung, alte offene Angebote, faellige Zusatzverkaufs-Nachfasspunkte, niedrige Abschlussquote, offene Arbeitsunterbrechungen, kritische Kundenrueckmeldungen und Produktivitaet. Jede Zeile braucht ein klares Signal, eine harte Interpretation und einen konkreten naechsten Handlungsschritt. Das ist aktuell regelbasiert und braucht keine KI-Anbindung; KI kann spaeter optional fuer Textverdichtung oder Ursachenclustering ergaenzen, darf aber nicht die belastbare Zahlenlogik ersetzen.
- Planungsgruppen-SVS Fallback 2026-07-07: In den Firmeneinstellungen gibt es jetzt den Reiter `Planungsgruppen-SVS`. Dort kann pro Planungsboard/-gruppe ein manueller Ziel-SVS gepflegt werden, falls fuer die kuenftige Umsatzkapazitaetsrechnung noch keine belastbaren automatischen Werte aus Rechnungen, Leistungen oder Paketen ableitbar sind. Pro Gruppe ist steuerbar, ob der manuelle Wert automatische Werte uebersteuern darf oder ob automatische Werte den manuellen Wert uebersteuern. Die eigentliche GF-Kennzahl fuer Umsatzpotenzial nach Anwesenheiten/Abwesenheiten baut spaeter auf dieser Fallback-Konfiguration auf.
- GF Umsatzkapazitaet Planungsgruppen 2026-07-07: Der GF-Reiter der Auswertungen berechnet jetzt je Planungsgruppe die verfuegbaren Stunden im Auswertungszeitraum inklusive Wochenenden, Feiertagen und Abwesenheiten und bewertet sie mit einem SVS. Der SVS kommt zuerst aus echten Rechnungen mit verknuepften Stempelzeiten, danach aus aktiven Leistungen/Paketen und zuletzt aus dem manuellen Planungsgruppen-SVS. Die Systeminterpretation meldet ueberplante oder fast ausgelastete Gruppen als Wachstumsbremse und zeigt fehlende SVS-Grundlagen als Datenqualitaetsproblem. Keine DB-Schemaaenderung.
- Sales-Performance Handlungsliste 2026-07-07: Der Sales-Reiter der Auswertungen hat jetzt den Block `Heute vertrieblich handeln`. Er priorisiert ueberalterte offene Angebote, faellige Zusatzverkaufsnachfassungen, offene Angebote ohne Nachfassaufgabe und offene unterbrochene Arbeiten. Pro Zeile werden Kunde/Projekt, Verantwortlicher, Wert, Empfehlung und direkte Aktionen angezeigt. Gewonnene/verlorene Angebotsentscheidungen nutzen die bestehende Angebotslogik; Zusatzverkaeufe, Projekte und Aufgaben oeffnen die vorhandenen Masken. Keine DB-Schemaaenderung.
- Geschäftsführer-Umsatzkapazität 2026-07-07: Die Auswertung `Umsatzkapazität nach Planungsgruppe` zeigt jetzt je Planungsgruppe Mitarbeiteranzahl, verfügbare Stunden, SVS-Herkunft, präzisere Ursachenbewertung und direkte Aktionen zu Mitarbeiterprüfung, Planungsgruppen-SVS und Planungsboard. Keine DB-Schemaänderung.
- Verkaufbare Kapazitaet Mitarbeiter 2026-07-07: In den Mitarbeiter-Planungseinstellungen gibt es den Schalter `Als verkaufbare Kapazitaet beruecksichtigen`. Standard ist aktiv. Geschaeftsfuehrung/Admin koennen Mitarbeitende wie Geschaeftsfuehrung oder reine Overhead-Rollen deaktivieren, ohne Planungsboard oder Planungsgruppe zu entfernen. Die GF-Auswertung `Umsatzkapazitaet nach Planungsgruppe` rechnet nur aktivierte Mitarbeitende in die verfuegbaren verkaufbaren Stunden ein und zeigt nicht eingerechnete Personen separat.
- Paket-SVS Arbeitsanteil 2026-07-07: Der Stammdaten-Fallback fuer die GF-Auswertung `Umsatzkapazitaet nach Planungsgruppe` bewertet Pakete nur noch mit dem Verkaufswert der Leistungsbestandteile und deren Planungsstunden. Artikel-/Materialbestandteile im Paket duerfen den SVS der verkaufbaren Arbeitskapazitaet nicht erhoehen. Normale Leistungen bleiben als Arbeitspositionen automatisch relevant.
- Sales-Performance Cockpit 2026-07-07: Der Sales-Reiter startet jetzt mit verstaendlichen Cockpit-Karten statt reiner Kennzahlenwand: Heute handeln, Angebotsmotor, Neukundenbewegung, Abschlusskraft, Dauerlaeufer-Ausbau und Risiko im Bestand. Zusaetzlich prueft der Reiter aktive Dauerlaeufer auf Nachverhandlungsbedarf anhand letzter Angebots-/Nachtragsaktivitaet, Monatskontingenten, aktueller Kontingentueberschreitung, mindestens fuenfmaliger Folgeausschoepfung und Umsatz je gestempelter Stunde. Keine Prisma-Aenderung; die Logik nutzt vorhandene Angebote, Projekte, Rechnungen, Kontakte und Stempelzeiten.
- Auswertungs-KPI-Design 2026-07-07: Die bestehenden `renderReportMetric`-Kennzahlkarten und die komplexen Forecast-Zusammenfassungskarten wurden optisch an das neue Cockpit-Design angeglichen: runde Karten, Icon-Kopf, Statuschip, ruhigere Typografie und erhaltene Detailwerte. Keine Logikaenderung und keine Prisma-Aenderung.
- Dashboard Rollenkarten 2026-07-07: Die vier rechten Dashboard-Kacheln nutzen jetzt fuer alle Rollen eine einheitliche Cockpit-Optik mit Icon-Kopf und werden als 2x2-Block an die Hoehe von Team live gekoppelt. Geschaeftsfuehrung/Admin sehen Finanzen, Leistung, Projekte und Vertrieb; Vertrieb sieht Tagesaktionen, Angebotsmotor, Neukunden und Dauerlaeufer-Ausbau; Buchhaltung sieht offene Posten, Umsatz, Abrechnungspruefung und Forecast-Datenqualitaet; Fuehrungskraefte und Mitarbeitende erhalten operative Team-/Aufgaben-/Planungswerte. Keine Prisma-Aenderung.
- Dashboard Kachelinteraktion 2026-07-07: Die rechten Dashboard-Rollenkarten sind jetzt neutral ohne farbige Signallinien gestaltet, nutzen den freien Kartenraum fuer eine kurze Einordnung und sind klickbar. Karten springen direkt in den passenden Haupt- oder Auswertungsreiter, z. B. Forecast, Sales-Performance, Projekte, Mitarbeiter-Auswertung, Kontakte, Aufgaben oder Planungsboard. Keine Prisma-Aenderung.
- Dashboard 3x2-Raster 2026-07-08: Die rechten Dashboard-Rollenkarten wurden von 2x2 auf 3x2 erweitert und bleiben an die Hoehe von Team live gekoppelt. Pro Rolle werden jetzt sechs kompakte klickbare Steuerungskarten gezeigt; die bestehenden Datenquellen werden weiterverwendet. Keine Prisma-Aenderung.
- Dashboard KPI-Karten Vorlage 2026-07-08: Die 3x2-Dashboardkarten wurden naeher an die Referenz gebracht: grosser KPI-Wert im Kartenkoerper, kurzer Untertitel, runder Trendindikator rechts oben und Footer-Hinweis mit Trennlinie. Karten bleiben klickbar und rollenabhaengig. Keine Prisma-Aenderung.
- Dashboard Trendvergleich 2026-07-08: Die Trendpfeile der Dashboard-Karten sind jetzt auf Vormonatsvergleich ausgelegt, sofern fuer die Karte ein sauberer Monatswert vorhanden ist. Live-/Statuskarten ohne historischen Snapshot bleiben neutral, damit keine falschen Trends suggeriert werden. Footer-Hinweise in den Karten sind normalgewichtig statt fett. Keine Prisma-Aenderung.
- Dashboard Trendpfeile eindeutig 2026-07-08: Trendfarben sind jetzt strikt an den Trendtyp gebunden: gruen nur steigend, rot nur fallend, gelb nur gleichbleibend und grau nur kein belastbarer Vergleich. Kartenstatus und Pfeilfarbe sind entkoppelt, damit keine gruenen Abwaertspfeile oder grauen Aufwaertspfeile mehr entstehen. Keine Prisma-Aenderung.

- Projektlage Dauerlaeufer 2026-07-08: Dauerlaeufer im Status Umsetzung werden nicht mehr als normale Projektfluss-Bremse oder Pipeline-Engpass bewertet, weil Umsetzung bei aktiven Dauerlaeufern der Sollzustand ist. Dauerlaeufer in Lead/Klaerung, Angebot, Warten auf Kunde, Zur Planung bereit, Geplant, Arbeit unterbrochen, Abrechnungspruefung und Zur Abrechnung bereit bleiben messbar. Vertriebliche Dauerlaeufer-Risiken laufen weiterhin ueber Sales-Performance/Nachverhandlungspruefung. Keine Prisma-Aenderung.

- Projekt-Auswertung Pipeline-Trennung 2026-07-08: Im Projekt-Reiter werden Pipeline-Engpaesse und Pipeline-Dauer getrennt fuer einmalige Projekte und Dauerlaeufer angezeigt. Dauerlaeufer in Umsetzung bleiben aus der Engpasswertung heraus und werden in der Dauer-Tabelle als laufender Dauerlaeufer kenntlich gemacht. Pipeline-Status werden vor der Gruppierung normalisiert, damit Lead/Klaerung nicht doppelt mit Zeichensatzfehler erscheint. Keine Prisma-Aenderung.

- Auswertungen Zeitraum und Pipeline-Trends 2026-07-08: Der Zeitraumfilter unter Auswertungen ist jetzt global fuer alle Reiter. Forecast & OP nutzt denselben Zeitraum, behaelt aber die separate Monatsauswahl innerhalb des Forecast-Zeitraums. Pipeline-Engpaesse bewerten Durchschnittsdauer und laengste Dauer nach Projektart/Phase und zeigen Trendpfeile gegen den direkt vorherigen gleich langen Zeitraum. Dauerlaeufer in Umsetzung bleiben aus der Engpasswertung heraus. Keine Prisma-Aenderung.

- Auswertungs-Trendlogik 2026-07-08: Trendpfeile zeigen fachliche Steuerungsrichtung, nicht blind mathematische Richtung. Gruen hoch bedeutet besser, rot runter schlechter, gelb seitwaerts stabil. Bei Durchlaufzeiten, offenen Posten und ueberfaelligen Werten ist niedriger besser; bei Umsatz, bezahlt, Angebotsvolumen und Marge ist hoeher besser. Weitere Trendpfeile nur bei eindeutig interpretierbaren KPIs einsetzen. Keine Prisma-Aenderung.

- Sales-Performance offene To-dos 2026-07-08: Offene Angebote und faellige Zusatzverkaufs-Nachfassungen bleiben im Sales-Reiter handlungsrelevant, auch wenn sie ausserhalb des gewaehlten Auswertungszeitraums angelegt wurden. Monats-/Abschlussauswertungen bleiben weiter an die Zeitraumwahl gekoppelt; geaendert wurde nur die To-do-Sicht, damit Vertrieb keine alten offenen Themen verliert. Keine Prisma-Aenderung.

- Dauerlaeufer-Pruefhistorie 2026-07-08: Sales-Performance kann aktive Dauerlaeufer jetzt mit eigener Historie pruefbar dokumentieren. Neue Tabelle/API RecurringProjectReview speichert Projekt, Pruefdatum, Benutzer, Ergebnis, naechsten Prueftermin, Notiz und damalige Signale. Die Nachverhandlungslogik nutzt die letzte dokumentierte Pruefung als echte letzte Pruefung; harte neue Signale wie Kontingentueberschreitung oder niedriger SVS bleiben weiter sichtbar. Prisma-Schema wurde zusaetzlich gegen vorhandene DB-Drift synchronisiert (PlanningGroupCapacitySetting, Absence.deletedAt, nullable User.sellableCapacityEnabled, Offer-updatedAt-Defaults), damit der DB-Diff keine Drop-Warnungen mehr zeigt.

- Prisma Server-Drift ProjectEndPhaseReminder 2026-07-08: Die serverseitig bereits vorhandene Tabelle `ProjectEndPhaseReminder` ist jetzt im Prisma-Schema abgebildet. Das ist eine reine Schema-Synchronisierung fuer bestehende Endphasen-Erinnerungen und verhindert, dass `prisma db push` diese Tabelle als zu loeschende Fremdtabelle meldet.

- Planungsgruppen-SVS Mindestbasis 2026-07-08: Manuelle SVS-Werte werden in der API nun auch korrekt akzeptiert, wenn das Frontend sie als Zahl sendet. Stammdaten-SVS aus Leistungen/Paketen gilt fuer Umsatzkapazitaet erst ab mindestens 5 aktiven Grundlagen als belastbar; darunter wird ein gepflegter manueller Planungsgruppen-SVS als Fallback genutzt oder die fehlende Basis gemeldet.

- BWL-KI Chat MVP 2026-07-08: Auswertungen koennen fuer Admin/Geschaeftsfuehrung ein rechtes Chat-Panel oeffnen. Die Serverroute /api/management-ai/chat nutzt OPENAI_API_KEY und optional OPENAI_MANAGEMENT_MODEL; ohne Key antwortet sie mit einer Konfigurationsmeldung. Der erste Kontext kommt kontrolliert aus den aktuell berechneten Management-Kennzahlen statt aus direktem DB-Zugriff.

- Forecast-Auswertung UI-Hierarchie 2026-07-11: Der Reiter `Forecast & OP Kontrolle` ist rein gestalterisch in `Steuerung`, `Analyse` und `Details` gegliedert. Offene-Posten-Detailkontrolle, Forecast-/OP-Liste und Logikerlaeuterung starten eingeklappt; Tabellen scrollen innerhalb ihres eigenen Containers. Werte, Filter, Rollen, Aktionen, APIs und Fachlogik bleiben unveraendert.
- Monatsbericht Kostenfortschreibung 2026-07-13: Manuelle GuV-Werte werden als Aenderungswerte gespeichert und gelten ab ihrem Monat bis zur naechsten ausdruecklichen Aenderung. Fruehere Monatswerte und spaetere manuelle Abweichungen bleiben erhalten; ein bewusst geleertes Feld stoppt die Fortschreibung ab diesem Monat. Deutsche und input-formatierte Dezimalwerte werden strikt geprueft, damit beispielsweise `651.00` nicht als `65100` gespeichert wird. Lesen und Schreiben der Monatsberichtswerte bleibt serverseitig an die bestehende Rechnungs-/Buchhaltungsberechtigung gebunden. Keine Prisma-Schemaaenderung.
- Monatsbericht Bearbeitungszugang 2026-07-13: Der Monatsbericht hat einen eigenen sichtbaren Wähler `Kostenmonat bearbeiten`. Die Auswahl stellt den globalen Auswertungszeitraum auf genau diesen Einzelmonat, wodurch ausschließlich die manuellen GuV-Zeilen editierbar werden; Rechnungswerte und berechnete Summen bleiben Systemfelder. Die globalen Von-/Bis-Felder sind direkt editierbar und wechseln bei manueller Änderung automatisch auf `Individuell`.
- Geschäftsführung Managementcockpit 2026-07-22: Der zuvor sehr lange GF-Reiter ist auf sechs klickbare Steuerungsbereiche und maximal fünf priorisierte Handlungsthemen verdichtet. Umsatz/Marge, Liquidität, Projektfluss, Vertrieb, Kundenlage und Kapazität öffnen breite, volltextdurchsuchbare Detailmodale mit verständlicher Einordnung und direkten Sprüngen zu Rechnung, Projekt, Kunde, Angebot, Zusatzverkauf, Planung, Mitarbeitern oder Planungsgruppen-SVS. Offene Posten sind bewusst eine heutige Stichtagssicht über alle aktiven unbezahlten Rechnungen; Zeitraumwerte bleiben separat gekennzeichnet. Deckungsbeitrag und Geschäftsbereiche verwenden dieselbe Snapshot-/Rekonstruktionsbasis wie Artikel & Leistungen, der SVS nur rechnungsverknüpfte Zeiten. Die Kapazitätsrechnung berücksichtigt bei Kapazität und Gegenplanung ausschließlich als verkaufbar aktivierte Mitarbeiter. Versteckte Projektart-, Forecast- und Suchfilter anderer Auswertungsreiter werden beim Öffnen der Geschäftsführung neutralisiert. Keine zusätzliche Prisma-Schemaänderung für diesen Cockpit-Umbau.
- Projektkarte 2026-07-22: Der Auswertungsreiter nutzt jetzt eine echte interaktive MapLibre-Karte mit OpenStreetMap-Basiskarte, Zoom, Clustern, Projekt-Popover, Umfang-/Projektartfilter und Volltextsuche. Nur Projekte mit lokal gespeicherten, sicher geprüften Koordinaten erscheinen als Kartenpunkte; fehlende, ungeprüfte oder unklare Adressen stehen transparent in einer separaten Prüfliste. Koordinaten und Geocodingstatus liegen am `WorkPilotProject`; Adressänderungen invalidieren den bisherigen Treffer. OpenCage wird ausschließlich nach einem bewussten UI-Klick verwendet, wenn `OPENCAGE_API_KEY` serverseitig gesetzt ist; ohne Key werden keine Adressen extern übertragen. Der additive Prisma-Diff wurde vor `db push` geprüft und enthielt nur die sieben neuen Kartenfelder.
- OKS-Phone Ansprechpartner-Dubletten 2026-07-22: Der Kundenkontext liefert im Feld `contacts` nur noch verknüpfte Personen und nicht zusätzlich den Firmenstamm. Wenn eine alte Import-Personendurchwahl identisch am Firmenstamm und am verknüpften Ansprechpartner liegt, bevorzugt die Rufnummernsuche den Ansprechpartner und unterdrückt die geerbte Firmennummer im OKS-Phone-Kontext; echte gemeinsam genutzte Nummern mehrerer Personen bleiben mehrdeutig. Die Kundenakte zeigt klar beschriftete Telefon-/Mobil-/E-Mail-Werte, einen sichtbaren Bearbeiten-Button und nur tatsächlich direkt zugeordnete Projekte statt fester Beispieldaten. Das Dry-run-/Apply-Script `oks-phone:legacy-duplicates:*` entfernt nur Altimport-Firmennummern, wenn Firmen-Importperson, verknüpfter Ansprechpartner und Nummer exakt übereinstimmen. Lokal wurden so drei eindeutige CSV-Dubletten bereinigt, darunter Familienheim/Eva Hilbert. Keine Prisma-Schemaänderung.
- Kundenakte Ansprechpartner-Karten 2026-07-22: Ansprechpartner werden als ruhige, responsive Karten mit Initialen, kompakten Statuskennzeichen und ausschließlich vorhandenen Telefon-, Mobil- und E-Mail-Werten dargestellt. Leere Mobilfelder sowie wiederholte Hinweise auf fehlende Projektzuordnungen entfallen; direkt zugeordnete Projekte erscheinen nur, wenn sie tatsächlich vorhanden sind. Der Hauptkontakt bleibt durch eine dezente Petrolkante erkennbar, Bearbeiten ist direkt an jeder Karte erreichbar und die interne Scrollfläche wurde entfernt. Keine Prisma-Schemaänderung.
- Winterdienst-Kalkulation Grundlage 2026-07-23: Die Excel-Logik für Bereitschaft, Arbeitszeit und Streugut liegt zentral in `src/lib/winter-service/calculation.ts`. Variante `Streuen` ist die Basis, `Streuen und Schieben` startet mit einstellbaren Zuschlägen von 25 % Arbeitszeit und 50 % Salz, die Pauschalvariante ist eine einstellbare Mischkalkulation mit Standard 65/35. Das alternative Modell aus monatlicher Bereitschaft plus Aufwand bleibt eine getrennte Vergleichsrechnung. Der eigene Sidebar-Reiter `Kalkulations-Rechner` zeigt alle Eingaben und drei Ergebnisvarianten; Kalkulationen können ohne Zuordnung berechnet, aber nur mit einem dem Kunden fest zugeordneten Projekt gespeichert werden. Jeder Speichervorgang erzeugt eine unveränderliche neue Version mit vollständigem Eingabe-/Ergebnis-Snapshot. Paketgenerierung sowie bedingte Projekt-/Kundenakten-Reiter folgen auf dieser geprüften Basis. Der additive Prisma-Diff enthält ausschließlich die neue Tabelle `WinterServiceCalculation` samt Indizes.
- Winterdienst-Einsatzhäufigkeit 2026-07-23: Die Kalkulation verwendet nur noch einen Planwert `Erwartete Einsätze`; der zweite Prognosewert und dessen Ergebnisfelder wurden entfernt (neue Snapshots: Schema-Version 2). Der Rechner zeigt als Entscheidungshilfe den historischen Durchschnitt je Kunde und Wintersaison Oktober bis April, systemweit als gewichteten Durchschnitt aller Kunden-Saisons sowie nach Kundenauswahl kundenspezifisch. Ein Einsatz ist ein eindeutiger Projekt-/Kalendertag, damit mehrere Mitarbeiterstempel nicht mehrfach zählen. `Nur Streuen` und `Streuen und Schieben` werden ausschließlich aus eindeutiger Leistungs-/Paketzuordnung oder dokumentierter Einsatzart gezählt; pauschale und alte unklare Einträge bleiben transparent nur in der Gesamthäufigkeit enthalten. Die Statistik liegt zentral in `src/lib/winter-service/analytics.ts` und wird über `/api/winter-service-analytics` organisations- und berechtigungsgebunden ausgeliefert.
- JARVIS Stempelungsdiagnose 2026-07-27: Der rein lesende Projekt-Gesundheitscheck prüft Projektzeiten jetzt deterministisch auf ungültige oder ungewöhnliche Zeitwerte, Pausenbesonderheiten, Doppelungen, rollenabhängig auch projektübergreifende Überschneidungen, Mitarbeiter-/Terminverknüpfungen, aktive Sitzungen, Abschlussstatus, Unterbrechungsaufgaben und Überstundenfreigaben. Bei Dauerläufern mit Stundenabrechnung werden zusätzlich Monatsentwürfe, Gewerk und Abrechnungsleistung, Rechnungsverknüpfungen, Rundung, Stundenzeilen, Positionsmengen und Rechnungssummen gegengeprüft. Pausierte Stempelungen werden wegen der bestehenden Speicherung des letzten Wiederaufnahmezeitpunkts nicht fälschlich anhand von Start/Ende automatisch korrigiert, sondern als nur eingeschränkt rekonstruierbar erklärt. Datenabfragen bleiben doppelt an Session- und effektive Rolle gebunden; gesperrte Finanz-, Aufgaben-, Lohn- und projektübergreifende Mitarbeiterdaten werden nicht geladen. Keine Prisma-Schemaänderung und keine automatische Datenänderung.
- JARVIS geführte Projektrückfragen 2026-07-27: Breite Projektanfragen wie `Prüfe HAS-1 vollständig` führen nicht mehr in den allgemeinen Unbekannt-Fallback. JARVIS erkennt auch kurze Projektnummern mit nur einer Ziffer, priorisiert eine ausdrücklich genannte Projektnummer vor dem geöffneten Datensatz und fragt mit klickbaren, rollengerecht gefilterten Prüfmöglichkeiten nach. Angeboten werden je nach Freigabe vollständiger Projektcheck, Stempelungen/Arbeitszeiten, Planung/Termine, Aufgaben, Angebote/Rechnungen, Automatik/Zusammenhänge und Verbesserungspotenzial. Auch der allgemeine Systemhilfe-Fallback bietet bei erkennbarem WorkPilot-Bezug passende Rollenoptionen statt einer Sackgassenmeldung; echte Fremdthemen bleiben unbekannt. Mitarbeitende laden bei Projektprüfungen nur eigene Zeit- und aktive Stempeldaten, Managementrollen dürfen gemäß bestehender Rechte weiter projektübergreifend prüfen.
- JARVIS stabiler Projekt-Gesprächskontext 2026-07-27: Projektkarten aus JARVIS-Antworten liefern ihre stabile Datensatz-ID als getrennten Gesprächskontext an die nächste Systemfrage. Die Priorität ist: ausdrücklich genannte Projektnummer, ausdrücklicher Bezug `dieses Projekt` auf die geöffnete Akte, zuletzt eindeutig gewähltes Gesprächsprojekt, danach Bildschirmkontext. Ein kurzer Wechsel wie `Und HAS-1?` öffnet deshalb die rollengerechte Projekt-Rückfrage und nachfolgende Fragen wie `Und die Planung?` bleiben bei HAS-1, auch wenn im Hintergrund MKG-209 geöffnet ist. Kombinierte Auswahltexte mit Planung und Stempelungen werden nicht mehr still auf einen Stempel-Teilcheck reduziert. Teilprüfungen heißen sichtbar `Teilprüfwert` und erklären, dass das Gesamtprojekt nicht bewertet wurde. Aktive Dauerläufer innerhalb ihrer Laufzeit erhalten unabhängig vom aktuellen Pipeline-Status einen Planungshinweis, wenn kein zukünftiger Planungseintrag existiert.
- Online-Anfragenportal 2026-07-30: Das smartphone-optimierte öffentliche Formular `/anfrage/ok-immocare` lädt ausschließlich freigegebene WorkPilot-Gewerke und unterstützt Angebots-, Rückruf-, Durchführungs-, Mangel- und allgemeine Anfragen, unverbindliches Wunschdatum, kontextbezogene Zusatzinteressen sowie maximal sechs serverseitig geprüfte und neu codierte Bilder. Schutzschichten sind signierte kurzlebige Sitzungen, Mindestfüllzeit, Honeypot, Proof-of-Work, optionales Turnstile, persistente IP-HMAC-Rate-Limits, Same-Origin-/Hostname-Prüfung, strikte Nutzlastvalidierung, einmalige Nonces und idempotente Übertragungs-IDs. Roh-IP und User-Agent werden nicht gespeichert.
- Online-Anfragen-Posteingang 2026-07-30: Berechtigte Vertriebs-/Projektpipeline-Rollen sehen Dashboard-Hinweis, Sidebar-Eintrag und den Organisations-gebundenen Posteingang `Online-Anfragen`. Vor der Umwandlung ist die ausdrückliche Kundenentscheidung `vorhanden` oder `neu` erforderlich. Die serialisierbare, replay-sichere Umwandlung erzeugt immer ein neues Projekt `OK immocare → Lead / Klärung`, übernimmt die Originalanfrage ins Projektlogbuch, Bilder in `Anfragebilder` und Termin-/Rückrufsignale in verknüpfte Aufgaben; initiale Benachrichtigungen werden aufgelöst. Kein bestehendes Projekt wird automatisch ausgewählt.
- Online-Anfragen-Abnahme 2026-07-30: `scripts/configure-online-request-portal.mjs` bietet Dry-run/Apply für Organisation, Hostnamen, Empfänger und operative Gewerke. `scripts/qa-online-requests.mjs` ist standardmäßig schreibgeschützt und prüft mit `--apply` öffentliche Sitzung, PoW, Bildnormalisierung, Hashing, Rollen, Mandantentrennung, Inbox/Audit, neue Kunden-/Projektanlage, Logbuch/Bildgruppe, Aufgaben, Benachrichtigungen, Replay und persistente Rate-Limits; kontrollierte QA-Daten werden im `finally`-Block vollständig bereinigt. JARVIS-Systemlandkarte und deterministische Hilfe kennen `onlineRequests`, bleiben dort aber erklärend und führen keine Kundenentscheidung oder Umwandlung autonom aus.
- JARVIS Logbuch und Kommentare 2026-07-31: Projektlogbuch-Einträge und Aufgabenkommentare besitzen jetzt einen vollständigen textbasierten Action-Center-Vertikalschnitt. Natürliche Schreibwünsche erzeugen persistente, 15 Minuten gültige und an Organisation, Sitzung, Session-/Effektivrolle sowie Impersonation gebundene Entwürfe. Ziel, Titel/Text und optionaler beteiligter Aufgabenempfänger werden sichtbar geprüft; Bestätigung lädt Rollen, Ziel, Archivstatus und Beteiligung erneut. Normale Masken und JARVIS delegieren an gemeinsame Fachservices. Exactly-once, Audit, Aufgabenhistorie, bestehende Benachrichtigungen und UI-Refresh sind enthalten; Anhänge und autonome Mailaktionen bleiben ausgeschlossen. Keine Prisma-Schemaänderung.
- JARVIS Modellrichtlinie 2026-07-31: `src/lib/jarvis/model-policy.ts` routet Intent standardmäßig auf `gpt-5.6-luna` und Vertrieb/Management auf `gpt-5.6-terra`; `gpt-5.6-sol` ist nur für einen ausdrücklichen späteren Komplexpfad vorgesehen. Sol Fast ist standardmäßig ausgeschaltet und nur dort explizit aktivierbar. Responses-Aufrufe nutzen zentrale Token-/Timeout-/Reasoning-Grenzen und protokollieren Modell, Tier, Laufzeit, Status, Token und geschätzte Kosten ohne Prompt- oder Fachinhalt.
- Privater Objektspeicher-Pilot 2026-08-01: Neue manuelle Projektlogbuch-Bilder sowie bei der Projektumwandlung übernommene Online-Anfragebilder werden über den zentralen Storage-Adapter in den privaten STRATO-HiDrive-S3-Bucket geschrieben, nach Upload anhand Größe und SHA-256-Metadaten verifiziert und nur über die organisations- und projektgebundene Route `/api/files/[fileId]` gestreamt. `StoredFile` speichert technische Referenz, Eigentümerkontext, Quelle, Kategorie, Prüfsumme, Größe und Status; Logbuch-JSON enthält nur die geschützte Datei-URL. ETag/304 und privates Kurzzeit-Caching begrenzen Nachladeaufwand. Bei Providerfehlern bleibt die bisherige DB-Base64/ByteA-Ablage als Fail-safe aktiv, und ein Transaktionsfehler entfernt neu hochgeladene Objekte. Zugangsdaten bleiben ausschließlich in geschützten Server-Secrets und dürfen niemals an PWA oder Browser ausgeliefert werden. Bestehende Altdateien werden noch nicht migriert.
- JARVIS Projektstatus 2026-08-01: `project.status.change` ist ein kritischer, organisations-, sitzungs-, rollen- und fingerprintgebundener Vertikalschnitt. JARVIS löst das Projekt ausschließlich über eine eindeutige Projektnummer auf, verlangt Zielstatus und Grund, zeigt Fachnachweise sowie ausgeschlossene Nebenwirkungen und schreibt erst nach der exakten Phrase `PROJEKTSTATUS <Nummer> AUF <Status>`. Normale Projektoberfläche und JARVIS verwenden `src/lib/projects/project-status-service.ts`; statusbezogenes Projektupdate, Timeline, Logbuch, Audit und Eskalationsauflösung sind serialisierbar, advisory-lock-geschützt und exactly-once. JARVIS entscheidet keinen Status automatisch; Archivierung bleibt separat. Der permanente Korpus bleibt exakt 110 Fälle groß, die isolierte QA liegt in `scripts/qa-jarvis-project-status.mjs`. Keine Prisma-Schemaänderung und keine Änderung an `StoredFile` oder privaten Storage-Pfaden.
- JARVIS Projektstatus Release 2026-08-01: Produktiv abgenommen auf Commit `ae296c4fd97f7bc14bb680130aa2760e982811ed` mit verifiziertem Backup `/var/backups/workpilot360/20260801T221053Z-before-jarvis-project-status`. Lokal 150/150 Testdateien und 1.573/1.573 Tests; lokal und produktiv 110/110 permanente Fragen. Isolierte Rollen-/Exactly-once-QA, echter Klicktest in normaler Projektmaske und JARVIS, falsche/exakte Phrase, sicherer Abbruch, leerer Live-Prisma-Diff, keine Browserfehler und null QA-Rückstände. WorkPilot PID `687327`; KlinikNavigator unverändert PID `398228`.
- JARVIS Projektarchivierung 2026-08-02: `project.archive` ist ausschließlich der reversible, kritische Projekt-Lebenszyklus `archive | restore`. Normale Projektmaske und JARVIS müssen `src/lib/projects/project-lifecycle-service.ts` verwenden; direkte Archiv-/Restore-Statuswechsel über das allgemeine Projektspeichern bleiben mit `lifecycle_required` gesperrt. Laufende Stempelungen, zukünftige bestätigte Planungen und offene Aufgaben blockieren Archivierung fail-closed. Wiederherstellung nimmt ausschließlich den im offenen Archiv-Timeline-Eintrag belegten vorherigen operativen Status; Legacy-Archive ohne Nachweis bleiben gesperrt. Angebote, Rechnungen, Planungen, Aufgaben, Zeiten, `StoredFile` und Online-Anfragen werden sichtbar geprüft, aber nie gelöscht oder umgehängt. Keine automatische Projektzuordnung von Online-Anfragen einführen und keine privaten Storage-Invarianten zurücksetzen. Exakte Phrasen sind `PROJEKT ARCHIVIEREN <Nummer>` und `PROJEKT WIEDERHERSTELLEN <Nummer>`; Status, Timeline, Logbuch, Audit und Eskalationsauflösung müssen serialisierbar, Advisory-Lock-geschützt und exactly-once gemeinsam entstehen.
- JARVIS Online-Anfragen-Übernahmeprüfung 2026-08-02: Für eine exakt genannte OKI-Referenz darf JARVIS Status, Kundenentscheidung, organisationsgebundenen Bestandskontakt, Verantwortung, Fotos und die aus `buildOnlineRequestConversionTasks` prognostizierten Folgeaufgaben rein lesend prüfen. Abgeschlossen, ungeklärter Kundenweg, fehlender/organisationsfremder Bestandskontakt und ein ungültiger Umwandlungsnachweis blockieren. Eine fehlende oder ungeeignete Zuweisung blockiert in der bestehenden Route nicht: Die ausführende berechtigte Person wird automatisch verantwortlich; JARVIS muss diesen Fallback sichtbar erklären. Niemals eine Bestandsprojekt-Zuordnung vorschlagen: Die bewusste Umwandlung erzeugt immer ein neues Projekt unter `OK immocare → Lead / Klärung`; die OKI-Referenz bleibt Quellenreferenz, Wunschdaten bleiben unbestätigte Aufgabenhinweise. Die Prüfung erzeugt keinen Aktionsentwurf und verändert keine Daten. Produktivabnahme Runtime `2b7d0e4ce1cccaf4ad4bf0b4144a6a2bef0d72d7`, Backup `/var/backups/workpilot360/20260802T081500Z-before-jarvis-online-readiness`, 172/172 Testdateien, 1.727/1.727 Tests, lokal/produktiv 110/110, leerer Live-Prisma-Diff, WorkPilot PID `746049`, KlinikNavigator PID `398228`.
- JARVIS Online-Anfragen-Umwandlung 2026-08-02: `online-request.convert` ist eine kritische, organisations-, sitzungs-, rollen-, revisions-, HMAC- und fingerprintgebundene Aktion für eine exakte OKI-Referenz. Normale Route und JARVIS verwenden ausschließlich `src/lib/online-requests/conversion-service.ts`. Die Vorschau bindet Kundenentscheidung, organisationsgebundenen Kontakt, Gewerk/Präfix, Verantwortung, Termin-/Rückrufkontext und Bildnachweise; jede Änderung vor Bestätigung sperrt mit `stale_context`. Nur `ONLINE-ANFRAGE UMWANDELN <OKI-Referenz>` führt aus. Es entsteht immer genau ein neues Projekt unter `OK immocare → Lead / Klärung`; eine Bestandsprojekt-Zuordnung darf weder angeboten noch automatisch vorgenommen werden. Projekt/Kontakt/Objektadresse, Logbuch, geschützte `Anfragebilder`, Aufgaben, Timeline, OnlineRequest-Audit und Benachrichtigungsauflösung bleiben serialisierbar und exactly-once. Der `executing`-Claim wird über die korrelierte `executionRequestId` nach einem Prozessabbruch sicher abgeglichen; Replay darf nur das vom selben Entwurf erzeugte Projekt liefern. Permanenter Korpus exakt 110 mit echtem Vorschaufall. Produktivabnahme Runtime `7777c77727d07c2d9fbb370b56f788f21127128f`, Backup `/var/backups/workpilot360/20260802T091757Z-before-jarvis-online-conversion`, 174/174 Testdateien, 1.740/1.740 Tests, 90-Seiten-Build, normaler und JARVIS-spezifischer Online-Anfragen-E2E-Lauf, echter Klicktest, 110/110, null Rückstände, leerer Prisma-Diff, WorkPilot PID `750917`, KlinikNavigator unverändert `398228`. Keine Prisma-Schemaänderung; `StoredFile` und privater S3-Speicher bleiben erhalten.
- JARVIS Folgetätigkeitswechsel 2026-08-02: `time.session.manage` mit Operation `switch` beendet ausschließlich die eigene aktive Stempelung und startet die geprüfte Folgetätigkeit als ein serialisierbares, Advisory-Lock-geschütztes Exactly-once-Paar. Normale Stempelmaske und JARVIS verwenden `src/lib/time/stamp-session-switch-service.ts`; die Normalmaske darf nicht wieder auf getrennte Stopp-/Startrequests zurückgebaut werden. Vorschau und exakte Phrase `STEMPELUNG WECHSELN ZU <ZIEL>` binden bisherigen Abschluss, Zeit/Pause, Endkontrolle, Stundenabrechnung/Unterbrechungsfolgen sowie neuen Arbeitsbezug, Tätigkeit, Gewerk und Abrechnungsleistung. Vertretung, Impersonation, Fremdstempelung, ein partielles Wechselpaar und der sofortige Neustart eines unterbrochenen identischen Projekts sperren fail-closed. Folgeaktionen verwenden korrelierte IDs und müssen vor dem ausgeführten Entwurfszustand vollständig idempotent verarbeitet sein. Permanenter Korpus bleibt exakt 110; isolierte QA ist `scripts/qa-jarvis-stamp-switch.mjs`. Keine Prisma-Schemaänderung; `StoredFile`, privater S3-Speicher und alle Online-Anfragen-Invarianten bleiben erhalten.
- JARVIS Folgetätigkeitswechsel Release 2026-08-02: Produktiv abgenommen auf Runtime `e778ba291a7d17e260c13efd65d292dd267d6af9`, Backup `/var/backups/workpilot360/20260802T125808Z-before-jarvis-stamp-switch`, 181/181 Testdateien, 1.791/1.791 Tests, 90-Seiten-Build, realer Normalmasken-Klicktest, lokale und produktive Exactly-once-Wechsel-QA, produktiv 110/110 mit 33 vorbereiteten und null ausgeführten Korpusaktionen, null Rückstände und leerer Prisma-Diff. Dashboard/Formular HTTP 200; WorkPilot PID `769535`, KlinikNavigator unverändert `398228`.
