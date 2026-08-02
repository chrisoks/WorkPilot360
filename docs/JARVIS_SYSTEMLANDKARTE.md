# JARVIS Systemlandkarte

Stand: 01.08.2026

## Zweck

Die Systemlandkarte ist die geprüfte, maschinenlesbare Grundlage dafür, dass
JARVIS Bereiche von WorkPilot360 erklären und sicher öffnen kann. Die
verbindliche Registry liegt in `src/lib/jarvis/system-map.ts`.

Diese Dokumentation beschreibt Abdeckung, Prüfstatus und bewusste Grenzen. Sie
ersetzt nicht die Registry.

## Aktuelle Abdeckung

Die Registry enthält 90 Einträge:

- 18 aktive Hauptbereiche,
- 3 Aufgabenansichten,
- 2 Zielansichten,
- 4 Mitarbeiteransichten,
- 3 Prozess-/Automationsansichten,
- 2 Buchhaltungsansichten,
- 3 Katalogansichten,
- 12 Auswertungsreiter,
- 10 Bereiche der Firmeneinstellungen,
- 4 Kalkulationsbereiche,
- 17 Reiter der Projektakte,
- 11 Reiter der Kundenakte,
- 1 nicht navigierbaren, aber verifizierten Systemdienst für den privaten
  Datei- und Objektspeicher.

Jeder Eintrag enthält:

- stabile ID und sichtbare Bezeichnung,
- Zweck und typische Kernschritte,
- erlaubte Rollen,
- ein allowlist-basiertes Navigationsziel,
- Prüfdatum, Prüfstatus und Quellverweise,
- Kennzeichnung, wenn ein Bereich nur eingeschränkt ausgebaut ist.

Der Vermietungsbereich ist bewusst als `limited` und `needs_review`
gekennzeichnet. JARVIS darf dort keine noch nicht fertiggestellte
Mietvertragslogik versprechen.

## Sicherheits- und Rollenmodell

- Die echte Sitzung und eine gegebenenfalls emulierte Rolle müssen beide auf
  den Bereich zugreifen dürfen.
- Emulation kann die Reichweite nur einschränken.
- Nicht freigegebene Bereiche werden weder als Sprungziel noch als
  Bedienvorschlag ausgegeben.
- Die Oberfläche validiert jedes vom Server gelieferte Navigationsziel erneut
  gegen ihre aktuelle Rollen-Allowlist.
- Projekt- und Kundenreiter lassen sich nur öffnen, wenn bereits eine passende
  Projekt- beziehungsweise Kundenakte aktiv ist.
- Navigation verändert keine Fachdaten und benötigt keine KI.

## Bewusst nicht als vollständig behauptet

Die Systemlandkarte bildet die sichtbare Struktur und die wichtigsten
Kernabläufe ab. Folgende Tiefenarbeit bleibt offen:

- einzelne Modale und jede Feldvariante je Fachprozess,
- verbundene und fachlich tiefere Live-Zusammenfassungen über die erste
  rollenberechtigte Suche für Projekte, Kunden/Kontakte, Aufgaben, Angebote
  und Rechnungen hinaus,
- vollständige Dialogvarianten und Umgangssprache je Workflow,
- weitere schreibende Aktionen außerhalb der bereits vollständigen Aufgaben-,
  Projekt-, Kontakt-, projektartgerechten Termin-/Terminwunsch-, manuellen
  Zeit-, Text- und Angebotsvertikalschnitte,
- Sprachsteuerung,
- der fachlich noch nicht abgeschlossene Ausbau der Fahrzeugvermietung.

Das derzeit abgeschaltete Content-Management wird nicht als produktiv
verfügbarer Hauptbereich gezählt. Vor einer Aktivierung muss es in der Registry
und in den Abdeckungstests ergänzt beziehungsweise freigegeben werden.

## Automatische Prüfungen

`src/lib/jarvis/system-map.test.ts` prüft:

- vollständige Liste der aktiven Hauptbereiche,
- vollständige Liste der sichtbaren Auswertungsreiter,
- eindeutige IDs,
- Zweck, Workflows, Rollen und Quellen jedes Eintrags,
- natürliche Bereichssuche,
- Auflösung des aktuellen UI-Kontexts,
- Rollen- und Emulationsgrenzen.

`src/lib/jarvis/knowledge.test.ts` prüft zusätzlich, dass:

- JARVIS den aktuellen Bereich konkret erklärt,
- eine bekannte Navigationsfrage ein sicheres Ziel liefert,
- eine gesperrte Rolle kein Navigationsziel erhält,
- JARVIS Speicherarchitektur, Dateiumfang, PWA/API, Codefluss, Versand,
  Auswertungen, Performance, Ausfall, Lebenszyklus und Migration getrennt und
  ohne Preisgabe von Secrets erklärt.

## Pflegepflicht

Bei jedem neuen oder umbenannten produktiven Bereich muss gleichzeitig:

1. die Systemlandkarte angepasst werden,
2. Zweck, Kernabläufe, Rollen und Quelle geprüft werden,
3. der Abdeckungstest aktualisiert werden,
4. bei geänderter Navigation ein echter Browserklick erfolgen.

Ohne diese vier Schritte gilt ein neuer WorkPilot-Bereich für JARVIS nicht als
vollständig eingeführt.

## Action Center: produktive Vertikalschnitte

Die Systemlandkarte erklärt weiterhin Bereiche und Navigation. Schreibende
Aktionen werden getrennt über das Action Center abgesichert:

- Aufgaben: persistenter Entwurf, Recheck, bewusste Bestätigung, Audit und
  Exactly-once sind produktiv.
- Termine und Terminwünsche: Einmalprojekt, Stunden-Dauerläufer und
  Monatspauschale verwenden denselben serverseitigen Planungs-Batch wie die
  normale Maske. Mehrfachmitarbeiter, Serien, Angebot/Monatskontingent,
  begründete Überplanung, Rollen, Abwesenheit, Deduplizierung und Exactly-once
  sind Bestandteil des gemeinsamen Vertrags.
- Winterdienst-Kalkulation: Der persistente Entwurf erfasst alle zwölf
  fachlichen Eingaben ohne erfundene Defaults und berechnet Bereitschaft,
  Pauschalpreis, Streuen sowie Streuen und Schieben ausschließlich über die
  zentrale Winterdienst-Rechenfunktion. Interne Mitarbeitende dürfen rechnen.
  Eine unveränderliche Projektversion darf nur eine projektberechtigte
  Sitzungs-/Effektivrollenkombination nach bewusster Bestätigung erzeugen;
  Projekt-, Kunden- und Rollenstand werden in derselben Transaktion erneut
  geprüft. Audit, Revision, Ablaufzeit und Exactly-once sind verbindlich.
- Fahrten- und Fahrzeugkostenkalkulation: Natürliche Fahrten-, Fahrtkosten-
  und Fahrzeugkostenwünsche verwenden denselben fachlich freigegebenen
  aktiven-fahrzeuggebundenen Rechner. Der persistente Entwurf startet ohne
  Annahmen, lädt Fahrzeug-, Verbrauchs-, Selbstkosten-, Verkaufs- und
  Änderungsdaten organisationsgebunden und verwendet transparent den zentralen
  Live-Kraftstoffpreis oder eine bewusste manuelle Eingabe. Die einzige
  Rechenquelle ist `src/lib/vehicle-calculation.ts`; Personalkosten sind
  ausdrücklich nicht enthalten. Interne Mitarbeitende dürfen rechnen,
  dauerhaftes Speichern verlangt die bestehende Projektberechtigung beider
  Akteure sowie bewusste Bestätigung. Fahrzeugstand und Rolle werden in der
  Transaktion erneut geprüft; unveränderlicher `VehicleCalculation`-Snapshot,
  Audit, Revision, Ablauf und Exactly-once sind verbindlich.
- Fahrzeugstammdatenänderungen gehören nicht zu diesem Kalkulationsschnitt.
  Vermietungs-, Mietpreis-, Vertrags- und Rückgabeaktionen bleiben
  `limited/needs_review` und für JARVIS fail-closed.
- Manuelle Zeiterfassung: Natürliche Wünsche wie `Zeiteintrag erfassen`,
  `Projektzeit buchen` oder `Stempelung nachtragen` öffnen einen persistenten
  Entwurf. Die Maske unterscheidet Projektzeit und unproduktive Zeit, eigene
  Einträge und rollenberechtigte Einträge für andere sowie Einmalprojekt,
  Stunden-Dauerläufer und Monatspauschale. Datum, Beginn, Ende, Pause,
  Kommentar, Abschluss- und Überstundenstatus werden sichtbar geprüft.
  Einmalprojekte verlangen ein aktives finales Angebot oder eine ausdrücklich
  begründete Buchung ohne Angebotszuweisung. Stunden-Dauerläufer verlangen
  Gewerk und eine aktive, preislich belegte Stundenleistung desselben Gewerks;
  Monatspauschalen benötigen keinen künstlichen Angebots- oder
  Leistungskontext. Normale manuelle Maske und JARVIS verwenden
  `src/lib/time/project-time-entry-service.ts` als gemeinsame serverseitige
  Schreib- und Validierungsquelle. Bestätigung lädt Organisation, Rolle,
  Person, Projekt, Angebot und Abrechnungsleistung neu, schreibt Zeit und
  JARVIS-Logbuchnachweis in einer serialisierbaren Transaktion und schützt
  Revision, Ablauf, Abbruch, Doppelklick und Replay. Persönliches Starten,
  Pausieren, Fortsetzen und Stoppen einer laufenden Stempelung bleibt bewusst
  eine direkte Benutzeraktion außerhalb dieses Vertikalschnitts.
- Projektlogbuch und Aufgabenkommentare: Natürliche Schreibwünsche erzeugen
  einen 15 Minuten gültigen, sitzungs- und identitätsgebundenen Entwurf.
  Projekt beziehungsweise berechtigte Aufgabe, Titel, Text und optional ein
  beteiligter Kommentarempfänger bleiben sichtbar editierbar. Die Bestätigung
  lädt Organisation, beide Rollen, Ziel, Archivstatus und Beteiligung erneut.
  Der normale UI-Weg und JARVIS verwenden dieselben zentralen Services.
  Logbucheintrag beziehungsweise Aufgabenkommentar, bestehende
  Benachrichtigungen, Aufgabenhistorie, Audit und Entwurfsabschluss werden
  transaktional erzeugt; Doppelklick und Replay schreiben nicht ein zweites
  Mal. Dieser Schnitt ist absichtlich textbasiert: Anhänge und autonome
  E-Mail-Aktionen werden weder vorbereitet noch ausgeführt.
- Kontrollierter Rechnungsversand: Nur bereits fakturierte Rechnungen dürfen
  einen Versandentwurf erzeugen. Empfänger, CC/BCC, Betreff, Nachricht,
  Dokumentformat, konkrete Anhänge, Hashes und technische E-Rechnungsprüfung
  werden serverseitig angezeigt und an Sitzung, beide Rollen, Organisation,
  Rechnung, Absenderkonto, Revision, TTL und HMAC gebunden. Die exakte
  Bestätigungsphrase enthält Rechnungsnummer und erste Empfängeradresse.
  Normale Versandmaske und JARVIS beanspruchen den Versand vor Microsoft Graph
  über denselben advisory-lock-geschützten Dispatch-Service. Ein bestätigter
  Versand wird nur als Replay zurückgegeben; laufende, fehlgeschlagene oder
  technisch unklare Versuche werden niemals automatisch wiederholt.
- Kontrollierte Bezahlt-Markierung: Nur offene Rechnungen im Status
  `Fakturiert` dürfen vorbereitet werden. JARVIS zeigt den vollständigen
  Bruttobetrag und ein editierbares Zahlungsdatum; jede Änderung wird erneut
  serverseitig geprüft. Die exakte Phrase `BEZAHLT RE-... AM TT.MM.JJJJ`
  bestätigt die vollständige Zahlung genau einmal. Normale Rechnungsmaske und
  JARVIS verwenden denselben transaktionalen Payment-Service mit
  organisationsgebundenem Advisory Lock, Rechnungsfingerprint und genau einem
  Historienereignis. Teilzahlungen, Mahnung, Versand und Storno sind nicht
  Bestandteil dieser Aktion.
- Kontrollierte Mahnung: Nur überfällige, unbezahlte Rechnungen im Status
  `Fakturiert` dürfen einen Entwurf für die nächste Mahnstufe erzeugen. JARVIS
  zeigt Betrag, Fälligkeit, aktuelle und nächste Stufe, Empfängeranschrift,
  Mahndatum und neue Zahlungsfrist; jede Datumsänderung wird serverseitig neu
  geprüft. Die exakte Phrase `MAHNUNG MA-RE-...-<Stufe> BIS TT.MM.JJJJ`
  bestätigt die Erstellung genau einmal. Normale Rechnungsmaske und JARVIS
  verwenden denselben advisory-lock-geschützten Reminder-Service. Mahnstufe,
  Zeitstempel, PDF im Projektlogbuch und genau ein Historienereignis werden
  transaktional geschrieben. Bezahlte, nicht fällige, nicht fakturierte,
  bereits für denselben oder einen späteren Tag gemahnte Rechnungen und Stufe 3
  bleiben blockiert. Die Aktion sendet keine E-Mail und löst weder Zahlung
  noch Storno aus.

Ein JARVIS-Entwurf darf weder Organisation, Projektart, Projektstand,
Mitarbeiterzugehörigkeit noch Kontingent aus seinem eigenen Payload bestimmen.
Diese Werte werden bei Vorprüfung und Bestätigung aus WorkPilot360 neu geladen.

## Modellrichtlinie und Kostenkontrolle

- Bekannte Hilfe, Navigation, Fachprüfung und Schreibvalidierung bleiben
  deterministisch und benötigen keinen Modellaufruf.
- Der optionale Intent-Fallback verwendet standardmäßig `gpt-5.6-luna` mit
  niedriger Denkleistung, engem strukturiertem Schema, Tokenlimit und kurzem
  Timeout.
- Freigegebene Vertriebs- und Managementformulierungen verwenden
  standardmäßig `gpt-5.6-terra`.
- `gpt-5.6-sol` ist nur als ausdrücklich gewähltes Modell für spätere komplexe
  Analysen vorgesehen. Fast Mode ist standardmäßig ausgeschaltet und kann nur
  für diesen expliziten Sol-Pfad aktiviert werden.
- Die zentrale Richtlinie protokolliert ausschließlich Modell, Arbeitsklasse,
  Service-Tier, Laufzeit, Status, Tokenmengen und geschätzte Kosten. Fragen,
  Prompts und Fachkontext werden nicht in der Modelltelemetrie gespeichert.

## Online-Anfragen und Lead-Übernahme

Der produktive Hauptbereich `onlineRequests` gehört zur vertrieblichen
Systemlandkarte. JARVIS kennt dabei folgenden verbindlichen Prozess:

- Neue öffentliche Formularanfragen erscheinen auf dem Dashboard und im
  Sidebar-Bereich `Online-Anfragen`.
- Zugriff, Bearbeitung, Bilder und Umwandlung sind an Vertriebs- beziehungsweise
  Projektpipeline-Rechte sowie an die aktuelle Organisation gebunden.
- Vor einer Umwandlung muss ein Mensch ausdrücklich `vorhandener Kunde` oder
  `neuer Kunde` entscheiden; ein vorhandener Kunde muss organisationsgebunden
  ausgewählt werden.
- Die Umwandlung erzeugt immer ein neues Projekt unter
  `OK immocare → Lead / Klärung`. Ein beliebiges bestehendes Kundenprojekt wird
  niemals automatisch verwendet.
- Die `OKI-...`-Referenz bleibt Anfrage-, Quellen-, Audit- und
  Logbuchreferenz. Innerhalb der serialisierbaren Umwandlung wird unter einem
  organisationsgebundenen Advisory-Lock die nächste globale Projektnummer mit
  dem `projectPrefix` des gewählten Gewerks vergeben. Der Titel folgt
  `Projekt <Nummer> - <Gewerk>`. `Sonstige / Andere Leistung` bleibt
  `tradeId=null`, behält den lesbaren Namen und verwendet das neutrale Präfix
  `SON`.
- Im öffentlichen Formular stehen in Schritt 2 zunächst Grünpflege,
  Objektbetreuung und Hausmeisterservice sichtbar bereit. 13 weitere
  freigegebene Optionen einschließlich `Sonstige / Andere Leistung` liegen
  hinter dem beschrifteten Aufklapper.
- Die Originalanfrage wird als Projektlogbuch-Eintrag `Online-Anfrage`
  übernommen. Sicher normalisierte Bilder landen in `Anfragebilder`;
  Termin- und Rückrufwünsche werden als verknüpfte Aufgaben angelegt.
- JARVIS darf diesen Ablauf erklären, den Posteingang öffnen und
  rollenberechtigt Live-Bestände, Statuslisten und eine exakte
  `OKI-...`-Anfrage zusammenfassen. Dafür werden keine Netzwerk-Hashes,
  Sicherheitssignale oder Bild-Binärdaten geladen.
- JARVIS darf keine Kundenentscheidung oder Projektumwandlung autonom
  ausführen. Auch aus einer Detailzusammenfassung entsteht keine automatische
  Bestandsprojekt-Zuordnung.

Verifizierte Quellen sind
`src/components/online-requests/online-requests-workspace.tsx`,
`src/app/api/online-requests/route.ts`,
`src/app/api/online-requests/[requestId]/convert/route.ts` und
`src/lib/online-requests/conversion.ts`. Der JARVIS-Liveadapter liegt in
`src/lib/jarvis/online-request-analysis.ts`.

## Privater Datei- und Objektspeicher

Der Systemdienst `system.objectStorage` ist kein eigener sichtbarer Reiter und
liefert deshalb bewusst kein Navigationsziel. Er ist die verifizierte
Zusammenhangsschicht für alle angebundenen Dateiwege. JARVIS kennt und erklärt
dabei verbindlich:

- PostgreSQL bleibt die fachliche Quelle für Organisation, Rollen,
  Zuordnungen, Belegstatus, Auswertungen, Audit und `StoredFile`-Metadaten;
  der private S3-kompatible STRATO-HiDrive-Speicher trägt die verifizierten
  schweren Datei-Bytes.
- Der Schreibweg prüft Fachrecht, Dateigröße, Magic Bytes, MIME-Typ, SHA-256,
  Upload und anschließende Provider-Metadaten. Erst danach wird die
  Fachreferenz gespeichert. Ein fehlgeschlagener Fach-Commit entfernt nur das
  in diesem Versuch neu erzeugte, noch nicht bestätigte Objekt.
- Projekt- und Anfrageanhänge werden organisations- und besitzergebunden über
  `/api/files/[fileId]` gestreamt. Angebote und Rechnungen verwenden ihre
  bestehenden Fachrouten und lösen `stored-file:<id>` serverseitig auf.
  Mitarbeiterdokumente bleiben in ihrer eigenen strengeren Personalroute.
- PWA und Browser sprechen weiterhin ausschließlich mit WorkPilot. Sie kennen
  weder Bucket noch Objektschlüssel oder Zugangsdaten.
- Mailversand lädt die echten Bytes serverseitig. Microsoft 365 erhält die
  Anlage, keinen S3-Link. XRechnung und ZUGFeRD behalten ihre fachlichen
  Validierungen und werden als exakte unveränderliche Artefakte archiviert.
- Auswertungen verwenden strukturierte Fachfelder und verlieren deshalb durch
  den physischen Speicherwechsel keine Angebote, Rechnungen, Summen, Status,
  Storno- oder Gutschriftwirkungen.
- ETag, privater Kurzzeit-Cache, bedarfsgerechtes Laden und sichtbare
  Lademasken schützen die Bedienperformance. Ein gezielter Objektabruf wird
  nicht linear mit der Gesamtzahl der Bucket-Objekte langsamer.
- Providerfehler, Inkonsistenz und fehlende Berechtigung werden getrennt und
  kontrolliert behandelt. Geeignete neue Fachwege behalten die bisherige
  Datenbankablage als Fallback, solange keine verifizierte Speicherreferenz
  geschrieben wurde.
- Fachliches Löschen, Storno, Aufbewahrung und physisches Objektlöschen sind
  getrennt. Bereits versendete oder fakturierte Belege und ihre Gegenbelege
  bleiben revisionsfähig nachvollziehbar.
- Historische Altdateien können noch in Base64-/ByteA-Feldern liegen. Ihre
  Migration erfolgt ausschließlich über Dry-run, Mirror, Verifikation,
  Switch, Restore-Test und Karenz.

Die vollständige verbindliche Beschreibung und Code-Landkarte steht in
`docs/STORAGE_ARCHITEKTUR.md`. Secrets sind aus JARVIS-Wissen, Systemlandkarte,
Prompts, Antworten und Telemetrie ausgeschlossen.

## Aufgaben archivieren und wiederherstellen

- Kritische JARVIS-Aktion: `task.delete`; fachlich ausschließlich
  `archive | restore`, niemals physisches Löschen.
- Gemeinsamer Fachservice für JARVIS und Aufgabenoberfläche:
  `src/lib/tasks/task-lifecycle-service.ts`.
- Natürliche Sprache und sichere Zielauflösung:
  `src/lib/jarvis/task-lifecycle-intake.ts` und
  `src/app/api/jarvis/chat/route.ts`.
- Persistente, sitzungs-/rollen-/organisationsgebundene Vorschau mit
  Integritätsnachweis, TTL, exakter Phrase, Advisory-Lock und Exactly-once:
  `src/lib/jarvis/action-draft-store.ts` sowie
  `/api/jarvis/action-drafts/[previewId]`.
- Normaler Oberflächenweg: `/api/tasks`; Grund ist Pflicht, physisches Löschen
  liefert `physical_delete_disabled`, Wiederherstellung setzt den belegten
  früheren Status.
- Erhaltene Nachweise: `Task.history`, `StatusTimelineEntry`, Kommentare,
  Beteiligte, Links, Zeiteinträge, Folgeaufgaben, Benachrichtigungen und
  Auditbezüge. Laufende Zeiterfassung oder nicht belegbarer früherer Status
  blockieren fail-closed.
- Permanente Abnahme: exakt 110 Fragen in
  `src/lib/jarvis/live-question-corpus.ts`; isolierter Ausführungstest in
  `scripts/qa-jarvis-task-lifecycle.mjs`.

## Projektstatus kontrolliert ändern

- Kritische JARVIS-Aktion: `project.status.change`; nur ausdrücklich
  angegebene operative Statuswerte, niemals automatische Entscheidung und
  niemals Archivierung.
- Gemeinsamer Fachservice für JARVIS und normale Projektoberfläche:
  `src/lib/projects/project-status-service.ts`.
- Natürliche Sprache und eindeutige organisationsgebundene Zielauflösung:
  `src/lib/jarvis/project-status-intake.ts` und
  `src/app/api/jarvis/chat/route.ts`.
- Persistente Vorschau, Rollen-/Sitzungsbindung, Integritätsnachweis, TTL,
  exakte Phrase, Advisory-Lock und Exactly-once-Ausführung:
  `src/lib/jarvis/action-draft-store.ts` sowie
  `/api/jarvis/action-drafts/[previewId]`.
- Normaler Oberflächenweg: `/api/hero/projects/status`; Vorschau und
  Ausführung verwenden denselben Fachservice und dieselben Nachweisregeln.
- Atomare Wirkungen: ausschließlich `WorkPilotProject.status`, geschlossene
  und neue `StatusTimelineEntry`, `ProjectLogbookEntry`, `AuditLog` und die
  Auflösung überholter `StatusEscalationEvent`-Einträge. Angebote,
  Rechnungen, Aufgaben, Planung, Zeiten, Dateien und Kundenbezüge bleiben
  unverändert.
- Permanente Abnahme: exakt 110 Fragen in
  `src/lib/jarvis/live-question-corpus.ts`; isolierter Ausführungstest in
  `scripts/qa-jarvis-project-status.mjs`.
- Produktiv abgenommen auf Commit
  `ae296c4fd97f7bc14bb680130aa2760e982811ed`; verifiziertes Code-, DB-,
  Konfigurations- und Runtime-Backup:
  `/var/backups/workpilot360/20260801T221053Z-before-jarvis-project-status`.
  110/110 Produktionsfragen, isolierte Exactly-once-QA, echter Klicktest in
  Projektmaske und JARVIS, leerer Live-Prisma-Diff und null QA-Rückstände.

## Projekte archivieren und wiederherstellen

- Kritische JARVIS-Aktion: `project.archive`; fachlich ausschließlich
  `archive | restore`, niemals physisches Löschen und niemals ein frei
  gewählter Wiederherstellungsstatus.
- Gemeinsamer Fachservice für JARVIS und normale Projektmaske:
  `src/lib/projects/project-lifecycle-service.ts`; gemeinsamer UI-Endpunkt:
  `/api/hero/projects/lifecycle`.
- Die Archivierung ist fail-closed gesperrt, solange eine Stempelung läuft,
  eine zukünftige bestätigte Planung oder eine offene Aufgabe besteht. Die
  Vorschau zeigt zusätzlich Angebote, Rechnungen, Projektzeiten,
  `StoredFile`-Dateien und über `convertedProjectId` verknüpfte
  Online-Anfragen. Keine dieser Relationen wird gelöscht oder umgehängt.
- Wiederherstellung ist nur aus `Archiviert` möglich und verwendet exakt den
  operativen `fromStatus` des offenen Archiv-Timeline-Eintrags. Legacy-Daten
  ohne revisionssicheren Nachweis bleiben gesperrt.
- Exakte, groß-/kleinschreibungssensitive Phrasen:
  `PROJEKT ARCHIVIEREN <Projektnummer>` und
  `PROJEKT WIEDERHERSTELLEN <Projektnummer>`.
- Organisation, Sitzung, Session-/Effektivrolle, Impersonation, Revision,
  TTL, HMAC, Payload-/Kontexthash und Beziehungsfingerprint werden erneut
  geprüft. Advisory-Lock, serialisierbare Transaktion, bedingtes Update und
  Logbuch-Idempotenz schützen Parallelzugriff und Replay.
- Atomar ändern sich ausschließlich Projektstatus, Status-Timeline,
  Projektlogbuch, Audit und überholte Statuseskalationen. Das allgemeine
  Projektspeichern lehnt Archiv-/Restore-Übergänge mit
  `lifecycle_required` ab, sodass kein Nebenweg die Fachprüfung umgeht.
- Permanente Abnahme: exakt 110 Fragen in
  `src/lib/jarvis/live-question-corpus.ts`; isolierte Ausführungs-QA in
  `scripts/qa-jarvis-project-lifecycle.mjs`.
- Produktivabnahme 2026-08-02: Commit
  `781899aac894025833367b56086b724088c3f8ae`, verifiziertes Backup
  `/var/backups/workpilot360/20260802T003136Z-before-jarvis-project-lifecycle`,
  isolierte Live-QA vollständig grün, permanenter Korpus 110/110 mit 19 nur
  vorbereiteten Entwürfen und null Rückständen. WorkPilot PID `700433`,
  KlinikNavigator unverändert PID `398228`.

## Projektstammdaten kontrolliert ändern

- JARVIS-Aktion `project.manage` ist als kontrollierte Schreibaktion für
  bestehende, eindeutig per Projektnummer bestimmte Projekte freigegeben.
- Freigegebene Felder: Titel, Beschreibung, Laufzeit von/bis, Gewerk, Adresse,
  Beteiligte, Projektverantwortung sowie Vertretung mit Zeitraum. Nicht umfasst
  sind Projektanlage, Projektnummer, Kunde/Kontakte, Projektart,
  Geschäftsbereich, Status, Abrechnung und Budgets.
- Fachservice: `src/lib/projects/project-master-data-service.ts`; Intake:
  `src/lib/jarvis/project-master-data-intake.ts`; persistenter Entwurf und
  Ausführung über `src/lib/jarvis/action-draft-store.ts` und
  `/api/jarvis/action-drafts/[previewId]`.
- Exakte Phrase: `PROJEKT ÄNDERN <Projektnummer>`. Organisation, Sitzung,
  Rollenpaar, Impersonation, Revision, TTL, HMAC, Payload-/Kontexthash,
  Projektfingerprint, Advisory-Lock, serialisierbare Transaktion, bedingtes
  Update und Logbuch-Idempotenz gelten fail-closed.
- Atomare Wirkung: nur angezeigte Projektfelder, gegebenenfalls Aufhebung der
  fachlichen Freigabe, `WorkPilotProjectReviewHistory`, Projektlogbuch und
  Audit. Alle übrigen Projekt- und Fachdaten bleiben unverändert.
- Permanente Abnahme bleibt exakt 110 Fragen; isolierte Ausführungs-QA:
  `scripts/qa-jarvis-project-master-data.mjs`.
- Produktiver Runtime-Stand:
  `e7d635d2a38bf840a8b3de996641bf8b24411538`; verifizierte Sicherung:
  `/var/backups/workpilot360/20260802T011132Z-before-jarvis-project-master-data`.
  Produktive isolierte QA und 110/110-Korpus bestanden ohne Rückstände;
  Live-Prisma-Diff leer, WorkPilot PID `706450`, KlinikNavigator PID `398228`.

## Personalstammdaten kontrolliert ändern

- JARVIS-Aktion `personnel.manage`; Ziel ist genau ein bestehender aktiver,
  organisationsgebunden über die dienstliche E-Mail aufgelöster Mitarbeiter.
- Freigegeben: Name, dienstliche E-Mail, Rolle, Personalnummer, Telefon/Mobil,
  Anschrift, Planungsboard und Planungsgruppe. Passwort, Mailkonto, Lohn/Kosten,
  Kapazität, Führungshierarchie, Aktivierung, Anlage und Löschung sind getrennt.
- Vorschau: Alt-/Neuwerte, Sitzungen, offene eigene Aufgaben, Planungen und
  Projektzeiten. Operative Zuordnungen bleiben unverändert; Rollenwechsel
  beendet die Zielsitzungen atomar.
- Fail-closed: eigene Rollenänderung, höhere Zielrolle, Gastrolle, inaktives
  Ziel, Dublette, wirkungslose Änderung und letzte aktive Geschäftsführung.
- Exakte Phrase: `MITARBEITER ÄNDERN <dienstliche E-Mail>`. Fachservice:
  `src/lib/users/personnel-management-service.ts`; isolierte QA:
  `scripts/qa-jarvis-personnel-management.mjs`.
- Produktivabnahme: Runtime
  `f55fa4e4d4f2f6d42af3af81406820839c0f23cf`, Backup
  `/var/backups/workpilot360/20260802T035012Z-before-jarvis-personnel-management`,
  163/163 Testdateien, 1.654/1.654 Tests, 110/110 Produktionsfragen, 24 nur
  vorbereitete Aktionen, null Rückstände, Live-Prisma-Diff leer. WorkPilot PID
  `721496`, KlinikNavigator PID `398228`.

## Lohnkosten kontrolliert ändern

- JARVIS-Aktion `payroll.manage`; Ziel ist genau ein bestehender aktiver,
  organisationsgebunden über die dienstliche E-Mail aufgelöster Mitarbeiter
  mit vorhandenem Mitarbeiterkosten-Datensatz.
- Freigegeben: Monatsgehalt, Vollkostenfaktor, Jahresstunden, Urlaubs-,
  Fortbildungs- und Krankheitstage sowie Stunden pro Arbeitstag.
- Vorschau: Alt-/Neuwerte, Jahres-/Monatsvollkosten, Abzugstage, verkaufbare
  Stunden, Stundensatz, historische Zeiten mit Snapshot, unbewertete Zeiten
  und laufende Stempelungen. Historische Snapshots bleiben unverändert.
- Fail-closed: fehlende Doppelberechtigung für Benutzer und Mitarbeiterkosten,
  inaktives Ziel, ungültige oder wirtschaftlich unmögliche Werte, wirkungslose
  Änderung, Stale Context und Replay. Ablehnungen leaken keine Kostendaten.
- Exakte Phrase: `LOHNKOSTEN ÄNDERN <dienstliche E-Mail>`. Gemeinsamer
  Fachservice für JARVIS und Kostenmaske:
  `src/lib/employee-costs/employee-cost-management-service.ts`; isolierte QA:
  `scripts/qa-jarvis-employee-cost-management.mjs`.
- Produktivabnahme: Runtime
  `422777f7f0f0601ea881d2e0254c7e87477e8124`, Backup
  `/var/backups/workpilot360/20260802T042845Z-before-jarvis-employee-cost-management`,
  166/166 Testdateien, 1.671/1.671 Tests, echter UI-Klicktest, 110/110
  Produktionsfragen, 25 nur vorbereitete Aktionen, null Rückstände,
  Live-Prisma-Diff leer. WorkPilot PID `724824`, KlinikNavigator PID `398228`.

## Kontaktkategorien kontrolliert massenhaft ändern

- Kritische JARVIS-Aktion `bulk.update`; Zielmenge sind 2 bis maximal 25
  ausdrücklich genannte organisationsgebundene Kundennummern. Dynamische oder
  offene Filter sind nicht freigegeben.
- Gemeinsamer Fachservice für JARVIS und normale Kontaktmaske:
  `src/lib/contacts/contact-bulk-category-service.ts`; gemeinsamer UI-Endpunkt:
  `/api/contacts/bulk-category`; Intake:
  `src/lib/jarvis/bulk-update-intake.ts`.
- Dry-Run und Aktionskarte zeigen vollständige Treffer, Alt-/Neuwerte und
  Ausschlüsse. Nur Akteure mit Benutzer- und Kontaktverwaltungsrecht auf
  Sitzungs- und Effektivebene dürfen vorbereiten oder ausführen.
- Exakte Phrasen: `MASSENÄNDERUNG AUSFÜHREN <Anzahl> KONTAKTE` und für den
  unveränderten protokollierten Folgezustand `MASSENÄNDERUNG ZURÜCKROLLEN
  <Ausgangs-ID>`.
- Serialisierbare Transaktion, Advisory-Lock, optimistisches `updatedAt`,
  SHA-256-Fachfingerprint, HMAC, Revision, TTL und Exactly-once verbinden alle
  Kontaktupdates, Integrationsereignisse, Audit und Aktionshistorie atomar.
- Permanente Abnahme: exakt 110 Fragen in
  `src/lib/jarvis/live-question-corpus.ts`; isolierte Ausführungs- und
  Rückrollungs-QA in `scripts/qa-jarvis-bulk-update.mjs`.
- Produktivabnahme: Runtime
  `bf5a367dd8d3f6299446417c3ab1124ce73c6faf`, Backup
  `/var/backups/workpilot360/20260802T051315Z-before-jarvis-bulk-update`,
  169/169 Testdateien, 1.687/1.687 Tests, echter UI-Klicktest, 110/110
  Produktionsfragen, 26 nur vorbereitete Aktionen, null Rückstände,
  Live-Prisma-Diff leer. WorkPilot PID `728456`, KlinikNavigator PID `398228`.

## Projektstatus-Frühwarnung kontrolliert schalten

- Kritische JARVIS-Aktion `automation.manage`; der erste Vertikalschnitt
  ändert nur `projectStatusEscalationEnabled` innerhalb der bestehenden
  organisationsgebundenen `deadlines`-Einstellung.
- Intake: `src/lib/jarvis/automation-management-intake.ts`; Fachservice:
  `src/lib/automation/project-status-automation-management-service.ts`;
  persistenter Entwurf und Ausführung über
  `src/lib/jarvis/action-draft-store.ts` und
  `/api/jarvis/action-drafts/[previewId]`.
- Dry-Run: überwachte Projekte, aktuelle Verantwortlichen- und
  Geschäftsführungsstufe, fehlende Zuständigkeiten und höchstens 100 konkrete
  Treffer. Die Oberfläche zeigt höchstens 25 Treffer kompakt an.
- Abgrenzung: kein Schedulerlauf, keine Zustellung, keine E-Mail, kein
  Projektstatuswechsel und keine Änderung der sechs Regel- oder Schwellenwerte.
- Berechtigung: Administration/Geschäftsführung auf Sitzungs- und Effektivebene;
  Führungskraft bleibt für Konfiguration gesperrt. Exakte Phrasen:
  `PROJEKTSTATUS-AUTOMATION AKTIVIEREN` und
  `PROJEKTSTATUS-AUTOMATION DEAKTIVIEREN`.
- Sicherheit: vollständiger SHA-256-Einstellungsfingerprint inklusive
  `updatedAt`, HMAC, Organisation, Sitzung, Rollenpaar, Impersonation, TTL,
  Revision, serialisierbare Transaktion, Advisory-Lock, `FOR UPDATE` und
  Exactly-once-Audit `automation.project-status.changed`.
- Permanente Abnahme: exakt 110 Fragen; isolierte Ausführungs-QA:
  `scripts/qa-jarvis-automation-management.mjs`.
- Produktivabnahme: Runtime
  `f7130b75f39fb846ac84323d32b1facdfbb5d5fd`, Backup
  `/var/backups/workpilot360/20260802T055638Z-before-jarvis-automation-management`,
  170/170 Testdateien, 1.698/1.698 Tests, echter UI-Klicktest, 110/110
  Produktionsfragen, 27 nur vorbereitete Aktionen, null Rückstände,
  Live-Prisma-Diff leer. WorkPilot PID `732182`, KlinikNavigator PID `398228`.

## Einzelne Projektstatus-Regel kontrolliert ändern

- `automation.manage` unterstützt neben dem Hauptschalter genau eine benannte
  bestehende Statusregel pro Entwurf: Aktivität, Verantwortlichen-Schwelle und
  Geschäftsführungs-Schwelle mit vollständigem Vorher-/Nachher-Dry-Run.
- Grenzen: verantwortlich 1–180 Tage, Geschäftsführung 1–365 Tage und nicht
  vor der Verantwortlichen-Stufe. Unbekannte, wirkungslose und unplausible
  Änderungen blockieren fail-closed.
- Exakte Phrase: `PROJEKTSTATUS-REGEL ÄNDERN <STATUS>`. Administration oder
  Geschäftsführung sind auf Sitzungs- und Effektivebene erforderlich;
  Führungskraft bleibt gesperrt.
- Die Ausführung ändert ausschließlich eine Regel im organisationsgebundenen
  `deadlines`-Dokument. Kein Scheduler, keine Zustellung, keine E-Mail und kein
  Projektstatuswechsel werden ausgelöst.
- Fachservice und Sicherheitskette:
  `src/lib/automation/project-status-automation-management-service.ts`,
  Vollkonfigurationsfingerprint, HMAC, Revision, TTL, Advisory-Lock,
  `FOR UPDATE`, serialisierbare Transaktion, Stale Context, Exactly-once und
  Audit `automation.project-status.changed` mit Alt-/Neuzustand.
- Produktivabnahme: Runtime
  `4b6140ffd30decbd0e4f15338c877f864dbcc0e9`, Backup
  `/var/backups/workpilot360/20260802T063000Z-before-jarvis-automation-rules`,
  170/170 Testdateien, 1.702/1.702 Tests, echter UI-Klicktest, 110/110
  Produktionsfragen, 28 nur vorbereitete Aktionen, null Rückstände und leerer
  Live-Prisma-Diff. WorkPilot PID `734753`, KlinikNavigator PID `398228`.

## Projektstatus-Automation transparent diagnostizieren

- Rein lesende Registry-Aktion `automation.read`; natürliche Statusfragen
  werden in `src/lib/jarvis/automation-status-analysis.ts` erkannt und
  deterministisch beantwortet.
- Sichtbare Trennung: fachlicher Organisationsschalter, serverseitiger
  Scheduler-/Kill-Switch und Zustell-Kill-Switch. Vollständige
  Betriebsbereitschaft setzt alle drei Ebenen sowie einen laufenden Scheduler
  voraus.
- Diagnoseumfang: alle Regeln/Schwellen, überwachte Projekte, aktuelle
  Verantwortlichen-/Geschäftsführungsstufe, fehlende Zuständigkeiten, letzter
  flüchtiger Schedulerstatus und persistente Zustellereignisse.
- Rollen: Administration/Geschäftsführung auf Sitzungs- und Effektivebene;
  Führungskraft wird vor dem organisationsweiten Lesezugriff abgelehnt.
- Rein lesend: kein Schedulerstart, keine Synchronisation, keine Notification,
  keine E-Mail und kein Projektstatuswechsel. Der einzige UI-Schritt ist die
  Navigation zur bestehenden Status-Automation.
- Produktivabnahme: Runtime
  `c7223a7edc3981c662941d270dcd17fd833200cc`, Backup
  `/var/backups/workpilot360/20260802T065000Z-before-jarvis-automation-status`,
  171/171 Testdateien, 1.715/1.715 Tests, echter UI-Klicktest, 110/110
  Produktionsfragen, null Ausführungen/Rückstände und leerer Live-Prisma-Diff.
  WorkPilot PID `736895`, KlinikNavigator PID `398228`.

## Projektstatus-Automation: Ausführung und Änderung getrennt protokollieren

- Rein lesende Erweiterung von `automation.read` in
  `src/lib/jarvis/automation-status-analysis.ts`; erkennt Protokoll-, Historie-
  und Auditfragen deterministisch.
- Konfigurationsquelle: organisationsgebundene `AuditLog`-Einträge mit Aktion
  `automation.project-status.changed`; zeigt Akteur, Ziel, Alt-/Neuzustand und
  Zeitpunkt.
- Zustellquelle: organisationsgebundene `StatusEscalationEvent`-Einträge mit
  Regelpräfix `project-status-v1:`; zeigt Projekt, Status, Stufe, Empfänger,
  offen/erledigt und Zeitpunkt.
- Es werden Gesamtzahlen und jeweils höchstens die letzten zehn Einträge
  ausgegeben. Leere Quellen erhalten einen ausdrücklichen, verständlichen
  Leerzustand. Eine Konfigurationsänderung wird nie als Zustellung bezeichnet.
- Rollen: Administration/Geschäftsführung auf Sitzungs- und Effektivebene;
  Führungskraft wird vor dem organisationsweiten Datenzugriff abgelehnt.
- Keine Nebenwirkung: kein Schedulerlauf, keine Synchronisation, kein Entwurf,
  keine Notification, keine E-Mail, keine Einstellung und kein Statuswechsel.
- Produktivabnahme: Runtime
  `74e20506eb1612c339ea322415906bd4510f7baa`, Backup
  `/var/backups/workpilot360/20260802T072000Z-before-jarvis-automation-history`,
  171/171 Testdateien, 1.717/1.717 Tests, echter UI-Klicktest, 110/110
  Produktionsfragen, 28 nur vorbereitete Aktionen, null Ausführungen/
  Rückstände und leerer Live-Prisma-Diff. WorkPilot PID `739270`,
  KlinikNavigator PID `398228`.

## Projektstatus-Automation: Empfänger und Zustellhindernisse diagnostizieren

- Rein lesende Erweiterung von `automation.read` in
  `src/lib/jarvis/automation-status-analysis.ts`; keine eigene Schreibroute.
- Empfängerplan je fälliger Schwelle: Projekt, Status, Verantwortlichen- oder
  Managementstufe, neue Empfänger, durch offene `project-status-v1`-Ereignisse
  abgedeckte Empfänger und Zuordnungshinweise.
- Managementstufe adressiert alle aktiven Admins/Geschäftsführer zusätzlich
  zur aufgelösten Projektverantwortung; Set-Semantik verhindert Dopplungen.
- Hindernisse werden getrennt ausgewiesen: Organisationsschalter, Scheduler/
  Prozesslauf, Zustell-Kill-Switch, Systemmailkonfiguration, fehlende oder
  mehrdeutige Verantwortlichen-Zuordnung und völlig empfängerlose Schwellen.
- Systemmail ist Best-Effort. `StatusEscalationEvent` weist die persistente
  In-App-Zustellung nach; ein erfolgreiches E-Mail-Ergebnis ist davon getrennt.
- Zugriff nur Administration/Geschäftsführung auf Sitzungs- und Effektivebene;
  kein Schedulerlauf, Entwurf, Audit, Ereignis, Hinweis, E-Mail oder Statuswert
  wird durch die Diagnose erzeugt oder verändert.
- Produktivabnahme: Runtime
  `ed1d56578c58cd93958395b02ccf623818ae26db`, Backup
  `/var/backups/workpilot360/20260802T073000Z-before-jarvis-automation-delivery-diagnosis`,
  171/171 Testdateien, 1.719/1.719 Tests, echter UI-Klicktest, 110/110
  Produktionsfragen, 28 nur vorbereitete Aktionen, null Ausführungen/
  Rückstände und leerer Live-Prisma-Diff. WorkPilot PID `741649`,
  KlinikNavigator PID `398228`.

## Projektstatus-Automation: Verantwortlichen-Empfänger fail-closed auflösen

- Gemeinsame Fachfunktion `resolveProjectResponsibleUser` in
  `src/lib/projects/status-escalation.ts`; wird von Preview und realer
  Synchronisation verwendet.
- Normalisierung: aktive Benutzer, Vor-/Nachname, deutsche Kleinschreibung und
  zusammengefasste Leerzeichen. Nur genau ein Treffer ergibt `matched` und
  eine `responsibleUserId`.
- Kein aktiver Treffer ergibt `missing`; mehrere aktive Treffer ergeben
  `ambiguous`. Beide liefern `responsibleUserId = null` und verhindern damit
  eine Verantwortlichen-Zustellung an eine geratene Person.
- Managementeskalationen behalten alle aktiven Admins/Geschäftsführer als
  zusätzliche Empfänger. Exactly-once und offene Ereignisse bleiben
  unverändert.
- JARVIS zeigt Auflösungsstatus, Trefferzahl, getrennte Missing-/Ambiguous-
  Summen und die fail-closed-Begründung.
- Permanente Tests: `src/lib/projects/status-escalation.test.ts` plus
  `src/lib/jarvis/automation-status-analysis.test.ts`. Aktuelle lokale und
  produktive aktive Doppel-Namen: 0.
- Produktivabnahme: Runtime
  `3da93965bba7f0c466563c8e8b752458552b2ac5`, Backup
  `/var/backups/workpilot360/20260802T074500Z-before-jarvis-recipient-failclosed`,
  172/172 Testdateien, 1.722/1.722 Tests, echter UI-Klicktest, 110/110
  Produktionsfragen, 28 nur vorbereitete Aktionen, null Ausführungen/
  Rückstände und leerer Live-Prisma-Diff. WorkPilot PID `743239`,
  KlinikNavigator PID `398228`.

## Online-Anfragen: Übernahmebereitschaft ohne Schreibwirkung

- `online-requests.inventory` erkennt bei einer exakten OKI-Referenz Fragen
  nach Bereitschaft, Voraussetzungen, Blockern und Umwandlung.
- Die organisationsgebundene Leseschicht lädt Anfrage, verantwortliche Person,
  Bestandskontakt und gegebenenfalls das bereits erzeugte Projekt. Rollen und
  Umwandlungsrecht der zugewiesenen Person werden mit derselben
  Berechtigungsfunktion wie in der normalen Umwandlungsroute bewertet.
- Blocker: abgeschlossener Vorgang, fehlende Kundenentscheidung, fehlender oder
  organisationsfremder Bestandskontakt sowie ein nicht auflösbarer
  Umwandlungsnachweis. Eine fehlende/ungeeignete Zuweisung führt wie in der
  produktiven Route zum sichtbaren Fallback auf die ausführende berechtigte
  Person und blockiert nicht fälschlich.
- Folgeaufgaben werden mit `buildOnlineRequestConversionTasks` aus demselben
  Termin-/Rückrufkontext vorab berechnet. Ohne Signal wird ausdrücklich keine
  Folgeaufgabe angekündigt; Wunschdaten bleiben unverbindlich.
- Invarianten: immer neues OK-immocare-Projekt unter Lead / Klärung, niemals
  automatische Bestandsprojekt-Zuordnung, globale Projektnummer statt
  OKI-Referenz, Logbuch `Online-Anfrage`, geschützte `Anfragebilder`, Audit,
  Timeline und Benachrichtigungen nur im bestehenden bewussten
  Umwandlungsablauf.
- Diese Fähigkeit ist rein lesend und erzeugt keinen JARVIS-Entwurf. UI-Ziel:
  `/dashboard?view=onlineRequests`.
- Produktivabnahme: Runtime
  `2b7d0e4ce1cccaf4ad4bf0b4144a6a2bef0d72d7`, Backup
  `/var/backups/workpilot360/20260802T081500Z-before-jarvis-online-readiness`,
  172/172 Testdateien, 1.727/1.727 Tests, echter isolierter UI-Klicktest,
  lokal/produktiv 110/110 Fragen, null Ausführungen/Rückstände und leerer
  Live-Prisma-Diff. WorkPilot PID `746049`, KlinikNavigator PID `398228`.

## Online-Anfragen: kritische JARVIS-Umwandlung

- Aktions-ID `online-request.convert`; verfügbar nur bei doppelter
  Umwandlungsberechtigung von Sitzungs- und Effektivrolle.
- Natürlicher Einstieg verlangt einen ausdrücklichen Umwandlungsbefehl und eine
  exakte OKI-Referenz. Bereitschafts-, Blocker-, Erklär- und Zeigefragen bleiben
  im rein lesenden Online-Anfragen-Adapter.
- Vorschauquelle `evaluateOnlineRequestConversion` im gemeinsamen
  `src/lib/online-requests/conversion-service.ts`; normale Route und JARVIS
  verwenden für das Fachschreiben `convertOnlineRequest`.
- Kritische Phrase:
  `ONLINE-ANFRAGE UMWANDELN <OKI-YYYYMMDD-XXXXXX>`; Groß-/Kleinschreibung und
  Inhalt müssen exakt stimmen.
- Fingerprint: Anfrage-Update/Status, Kundenentscheidung, Bestandskontakt samt
  Änderungsstand, Gewerk/Präfix, Verantwortlicher, Termin-/Rückrufkontext,
  Umwandlungsnachweis und Bild-Hashes/-Reihenfolge.
- Persistenter Entwurf: Organisation, Sitzung, Session-/Effektividentität,
  Rollen, Impersonation, Payload-/Kontexthashes, HMAC-Integrität,
  Revisionsprüfung, Ablauf, `executing`-Claim und Auditfolge.
- Exactly-once: OnlineRequest-Zeilensperre, korrelierte `executionRequestId` im
  `converted`-Audit, Wiederanlauf aus `executing` und Replay nur auf das vom
  selben Entwurf erzeugte Projekt.
- Unverhandelbar: immer neues Projekt unter `OK immocare → Lead / Klärung`,
  niemals automatische oder auswählbare Bestandsprojekt-Zuordnung. OKI bleibt
  Quellen-/Auditreferenz; Projektnummer ist global fortlaufend mit
  Gewerk-Präfix.
- Permanenter QA-Lauf:
  `scripts/qa-jarvis-online-request-conversion.mjs`; reproduzierbare echte
  Klickfixture: `scripts/qa-jarvis-online-request-browser-fixture.mjs`.
- Produktivabnahme: Runtime
  `7777c77727d07c2d9fbb370b56f788f21127128f`, Backup
  `/var/backups/workpilot360/20260802T091757Z-before-jarvis-online-conversion`,
  174/174 Testdateien, 1.740/1.740 Tests, 90-Seiten-Build, normaler und
  JARVIS-spezifischer Online-Anfragen-E2E-Lauf, echter UI-Klicktest, 110/110
  Fragen, null QA-Rückstände und leerer Live-Prisma-Diff. WorkPilot PID
  `750917`, KlinikNavigator PID `398228`.

## Persönliche laufende Stempelung: pausieren und fortsetzen

- Aktions-ID `time.session.manage`; verfügbar für aktive interne Benutzer und
  ausschließlich für die eigene, aktuell laufende Stempelung.
- Natürliche Befehle für Pause und Fortsetzung werden erkannt. Start, Stop,
  manuelle Zeiten und fremde Mitarbeiter bleiben ausdrücklich außerhalb
  dieses Aktionswegs.
- Gemeinsamer Fachservice `src/lib/time/stamp-session-service.ts` für die
  normale Route `/api/stamp-session` und JARVIS. Der Service arbeitet
  serialisierbar, verwendet PostgreSQL-Advisory-Lock plus Zeilensperre und
  ändert Status, Pausenintervalle und JARVIS-Entwurf exactly-once in einer
  Transaktion.
- Kritische Phrasen: `STEMPELUNG PAUSIEREN` und
  `STEMPELUNG FORTSETZEN`. Der JARVIS-Weg lehnt einen bereits erreichten
  Zielzustand fail-closed ab; die normale Oberfläche behält ihre idempotente
  Antwort bei.
- Sicherheitsbindung: Organisation, Sitzung, Benutzer, Session-/Effektivrolle,
  Impersonationszustand, Payload, Kontext, Fingerprint, Revision, Ablaufzeit
  und HMAC-Integrität. Vertretung oder Bedienung einer fremden Stempelung ist
  nicht möglich.
- Die Vorschau berechnet den aktuell laufenden Arbeitsabschnitt und eine
  laufende Pause bis zum Vorschauzeitpunkt mit. Nach Ausführung zeigt die Karte
  den tatsächlich ausgeführten Zustand und nicht den alten Vorschauzustand.
- Permanente isolierte QA:
  `scripts/qa-jarvis-stamp-session.mjs`; der feste 110-Fragen-Korpus erzeugt
  zusätzlich eine isolierte persönliche Stempelung, bereitet genau einen
  Entwurf vor, führt ihn nicht aus und räumt alle Spuren auf.
- Produktivabnahme: Runtime
  `a35cd90d7f7d2bbbe03ae20b745acb6b4bdf151d`, Backup
  `/var/backups/workpilot360/20260802T101258Z-before-jarvis-stamp-session`,
  176/176 Testdateien, 1.760/1.760 Tests, 90-Seiten-Build, echte Klicktests,
  isolierte lokale und produktive Exactly-once-QA, 110/110 Fragen und null
  Rückstände. WorkPilot PID `755744`, KlinikNavigator PID `398228`.
