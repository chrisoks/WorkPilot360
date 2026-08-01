# WorkPilot360 Datei- und Objektspeicher

Stand: 1. August 2026

## Kurz erklaert

WorkPilot360 trennt Fachinformationen und schwere Dateiinhalte. PostgreSQL bleibt
die verbindliche Quelle fuer Organisation, Berechtigungen, Projekt- und
Kundenzuordnung, Belegstatus, Auswertungen, Audit und Dateimetadaten. Die
eigentlichen Bytes neuer geeigneter Bilder, PDFs und E-Rechnungen liegen nach
erfolgreicher Pruefung im privaten S3-kompatiblen STRATO-HiDrive-Objektspeicher.

Fuer einen Anwender aendert sich der Arbeitsablauf nicht: Ein Bild wird weiterhin
im Projekt angezeigt, eine Rechnung weiterhin im Projekt oder in der Buchhaltung
geoeffnet und eine PWA weiterhin ausschliesslich ueber die WorkPilot-API bedient.
Der physische Speicherort ist ein internes Infrastrukturdetail.

Der Bucket ist niemals oeffentlich. Browser, PWA und JARVIS erhalten weder
Zugangsschluessel noch direkte S3-Objektadressen.

## Verbindliche Systemgrenzen

- PostgreSQL ist die fachliche Wahrheit. Ohne gueltigen Fachdatensatz und
  Berechtigung darf auch ein vorhandenes Objekt nicht ausgeliefert werden.
- Der Objektspeicher ist die Byte-Ablage fuer erfolgreich ausgelagerte Dateien.
- `StoredFile` verbindet beide Welten ueber Organisation, Besitzer, Quelle,
  Kategorie, Dateiname, Inhaltstyp, Groesse, SHA-256, Status und ETag.
- Eine Datei wird erst als `available` referenziert, nachdem Upload, Groesse und
  Pruefsumme verifiziert wurden.
- Der zentrale Code spricht nur mit der internen `StorageProvider`-Schnittstelle.
  STRATO HiDrive ist der aktuelle S3-kompatible Provider, aber nicht in die
  Fachlogik eingebrannt.
- Zugangsdaten existieren ausschliesslich als geschuetzte Server-Secrets. Sie
  gehoeren nicht in Quellcode, Dokumentation, Browser, PWA, Logs oder JARVIS.

## Schreibweg vom Upload bis zur Fachreferenz

1. Die zustaendige Fachroute prueft Sitzung, Organisation, Rolle, Zieldatensatz,
   Archivstatus, Dateigroesse und erlaubten Inhaltstyp.
2. `src/lib/storage/file-pilot.ts` dekodiert die Datei und prueft Magic Bytes.
   Eine Dateiendung oder ein vom Client behaupteter MIME-Typ allein genuegt nicht.
3. WorkPilot berechnet SHA-256 und erzeugt einen nicht erratbaren, fachneutralen
   Objektschluessel. Namen, Kundenanschriften und Originaldateinamen werden nicht
   Bestandteil des Schluessels.
4. Die Datei wird privat hochgeladen. Anschliessend liest WorkPilot die
   Objektmetadaten erneut und vergleicht Groesse und SHA-256.
5. Erst danach werden `StoredFile` und die Fachreferenz gemeinsam gespeichert.
   Projektanhaenge erhalten eine geschuetzte WorkPilot-Datei-URL; PDF-Felder von
   Angeboten und Rechnungen erhalten eine interne Referenz `stored-file:<id>`.
6. Scheitert die Fachdatenbank-Transaktion nach einem neuen Upload, wird genau das
   in diesem Versuch erzeugte Objekt wieder entfernt. Bereits bestaetigte Objekte
   werden nicht angetastet.
7. Gleiche Quelle und gleiche gepruefte Datei koennen idempotent wiederverwendet
   werden. Eine geaenderte Belegversion erhaelt ueber ihren neuen Hash eine neue
   unveraenderliche Speicherreferenz.

## Fehler- und Fallbackverhalten

- Ist der Provider beim Erstellen eines kompatiblen Fachdatensatzes nicht
  erreichbar oder nicht aktiv, bleibt fuer dafuer vorgesehene Wege die bisherige
  Base64-/ByteA-Ablage als Fail-safe erhalten. Der Fachvorgang stuerzt nicht nur
  wegen des externen Speichers ab.
- Ein vorhandener `stored-file:`-Verweis wird beim Lesen nicht still durch eine
  andere Datei ersetzt. Fehlt das Objekt oder stimmen Groesse beziehungsweise
  Pruefsumme nicht, liefert WorkPilot einen kontrollierten Fehler.
- Geschuetzte allgemeine Dateiabrufe antworten bei einem voruebergehenden
  Providerfehler mit HTTP 503 und `Retry-After: 30`, bei inkonsistenten Objekten
  mit HTTP 502 und bei fehlender Berechtigung mit HTTP 403.
- Mitarbeiterdokumente koennen beim Lesen auf vorhandene DB-Bytes zurueckfallen.
  Sind weder verifizierter Objektspeicher noch DB-Bytes verfuegbar, wird die Datei
  nicht vorgetaeuscht.
- Versandwege laden den tatsaechlichen gespeicherten Beleg vor dem Versand neu.
  Eine fehlende oder unlesbare Datei blockiert den Versand, statt eine leere oder
  falsche Anlage zu versenden.

## Aktuell angebundene Dateifamilien

| Fachbereich | Neue Dateien im Objektspeicher | Fachliche Referenz und Abruf |
| --- | --- | --- |
| Online-Anfragen | Beim Umwandeln uebernommene, serverseitig neu codierte Anfragebilder | Projektlogbuch, Bildgruppe `Anfragebilder`, Abruf ueber `/api/files/<id>` |
| Projektlogbuch | Neue Bilder sowie PDF-/XML-Anhaenge aus manuellen Uploads | Logbuchanhaenge enthalten geschuetzte WorkPilot-Datei-URLs |
| Winterdienst | Vorher-/Nachherbilder und erzeugter Taetigkeitsbericht als PDF | Projektgebundene Metadaten; Bericht und Bilder werden fuer Ansicht und Versand wieder aufgeloest |
| Taetigkeitsberichte | Erzeugtes Bericht-PDF | Projektlogbuch und geschuetzte Speicherreferenz |
| Rauchmelderberichte | Erzeugtes Bericht-PDF | Projektlogbuch und geschuetzte Speicherreferenz |
| Endkontrollen | Erzeugtes Endkontroll-PDF | Projektlogbuch und geschuetzte Speicherreferenz |
| Angebote | Entwurfs- und finale PDFs, auch aus bestaetigten JARVIS-Aktionen | `Offer.pdfData` enthaelt nach erfolgreicher Auslagerung nur `stored-file:<id>` |
| Rechnungen | Entwurfs-, finale, Storno-, Gutschrift- und weitere erzeugte Rechnungs-PDFs | `Invoice.pdfData` enthaelt nach erfolgreicher Auslagerung nur `stored-file:<id>` |
| Mahnungen | Erzeugte Mahnungs-PDFs | Projektgebundene unveraenderliche Speicherdatei |
| E-Rechnungen | Versandte oder explizit erzeugte XRechnung-XML und ZUGFeRD-PDF | Unveraenderliches Rechnungsartefakt mit eigenem Hash und Speicherobjekt |
| Mitarbeiterdokumente | Neue PDF-, JPG- und PNG-Dateien | Eigenes rollenbegrenztes Mitarbeiterdokument-API; nicht ueber die allgemeine Projektdateiroute |

Nicht jede historische Altdatei wurde automatisch umgeschaltet. Bestehende
Base64-/ByteA-Dateien bleiben lesbar. Die Migration erfolgt kontrolliert mit
`scripts/migrate-object-storage.mjs` in getrennten Phasen: erst Dry-run, dann
Mirror, danach verifizierter Switch. Alte Nutzlasten duerfen erst nach
Restore-Test und vereinbarter Karenz entfernt werden.

## Lesen, Berechtigungen und Routen

### Projekt- und Anfrageanhaenge

`GET /api/files/[fileId]` verlangt eine gueltige WorkPilot-Sitzung. Die Route
laedt den `StoredFile` ausschliesslich innerhalb der aktiven Organisation und
prueft danach den fachlichen Besitzer:

- `ownerType=project`: Das Projekt muss in derselben Organisation existieren.
- `ownerType=online-request`: Die Anfrage muss zur Organisation gehoeren; vor
  der Umwandlung gelten die Rollen des Online-Anfragen-Posteingangs, danach der
  Projektbezug.

Der Browser erhaelt nur den Stream mit sicherem `Content-Type`,
`Content-Disposition`, `nosniff`, privatem Cache und ETag. Bucket und
Objektschluessel bleiben verborgen.

### Angebote und Rechnungen

Angebots- und Rechnungs-PDFs werden weiterhin ueber ihre bestehenden
Fachrouten geladen. `src/lib/storage/document-file.ts` erkennt transparent, ob
im bisherigen Feld Base64 oder `stored-file:<id>` steht. Bei einer
Speicherreferenz werden Organisation, `ownerType` und `ownerId` erneut geprueft,
bevor Bytes zurueckgegeben werden.

### Mitarbeiterdokumente

Mitarbeiterdokumente verwenden `/api/employee-documents` und
`/api/employee-documents/[id]`. Sichtbarkeit, Upload und Loeschung bleiben an
die bereits vorhandenen Personalrollen und den betroffenen Mitarbeiter
gebunden. Die allgemeine Projektdateiroute kann diese Dokumente nicht lesen.

## PWA- und API-Kompatibilitaet

Die PWA muss STRATO, S3, Bucket und Zugangsdaten nicht kennen. Sie sendet und
laedt weiterhin ueber WorkPilot. WorkPilot erledigt serverseitig:

- Authentifizierung und Mandantentrennung,
- fachliche Projekt- und Dateizuordnung,
- Validierung und Upload,
- Aufloesung der Speicherreferenz,
- geschuetztes Streaming und Fehlerbehandlung.

Bestehende API-Vertraege bleiben waehrend der Migration kompatibel. Wo ein
alter Client eingebettete Data-URLs erwartet, bleibt der Kompatibilitaetsweg
erhalten. Ein spaeterer Wechsel auf reine Datei-IDs oder Downloadrouten darf
erst mit einem gemeinsam getesteten PWA-Release erfolgen. Die PWA darf niemals
direkte, dauerhaft signierte S3-URLs oder Server-Secrets erhalten.

## Angebote, Rechnungen, E-Rechnung und E-Mail

Die Auslagerung aendert keinen Fachstatus und keine kaufmaennische Logik:

- Angebot, Rechnung, Positionen, Kunde, Projekt, Summen, Zahlungsstatus,
  Versandhistorie und Audit bleiben in PostgreSQL.
- PDF-Erzeugung geschieht im Fachworkflow. Danach wird die erzeugte Datei
  verifiziert ausgelagert und das Belegfeld atomar auf `stored-file:<id>`
  umgestellt.
- Die normale Maske und JARVIS benutzen dieselben Speicher- und Fachservices.
- Vor Vorschau, Download oder Mailversand wird die Referenz serverseitig wieder
  in die echten Bytes aufgeloest.
- Microsoft 365 erhaelt die Anlage von WorkPilot; es bekommt keinen S3-Link und
  keine Zugangsdaten.
- Beim Versand einer XRechnung oder ZUGFeRD-Datei wird exakt das erzeugte
  Artefakt archiviert. XRechnung-XML wird weiterhin fachlich validiert; der
  Objektspeicher ersetzt keine E-Rechnungspruefung.
- Storno und Gutschrift erzeugen eigene negative Belege und eigene
  unveraenderliche PDFs. Das Original bleibt aus Auditgruenden erhalten.

## Auswertungen und Datenlogik

Auswertungen arbeiten mit den strukturierten Fachdatensaetzen in PostgreSQL,
nicht mit dem physischen Speicherort der PDF- oder Bildbytes. Deshalb bleiben
Umsatz, offene Posten, Angebotswerte, Status, Kunden- und Projektzuordnung sowie
Storno-/Gutschriftwirkung unveraendert auswertbar. Eine ausgelagerte Datei ist
ein Nachweis zum Fachdatensatz, nicht die Quelle der Kennzahl.

Eine defekte Datei darf den zugehoerigen Fachdatensatz nicht unsichtbar machen.
Sie ist ein Speicher- oder Nachweisproblem und muss getrennt vom kaufmaennischen
Status behandelt werden.

## Lebenszyklus, Loeschen und Aufbewahrung

- Das Loeschen eines fachlichen Datensatzes und das physische Entfernen eines
  Objekts sind getrennte Entscheidungen.
- `deletedAt` sperrt einen `StoredFile` fuer normale Abrufe, ohne Auditspuren
  unkontrolliert zu vernichten.
- Bereits versendete, fakturierte, stornierte oder gutgeschriebene Belege
  bleiben entsprechend dem Fach- und Aufbewahrungsprozess erhalten.
- Ein Rechnungsstorno loescht die Originalrechnung nicht. Es erzeugt einen
  Gegenbeleg; beide Dateien bleiben nachvollziehbar.
- Neu hochgeladene Objekte werden nur dann sofort physisch geloescht, wenn der
  zugehoerige Speicherversuch noch nicht fachlich committed wurde.
- Eine spaetere Retention-/Bereinigungsautomation darf nur explizite,
  revisionssichere Regeln umsetzen und muss Backups getrennt behandeln.

## Performance und Bedienoberflaeche

- Projektlisten und Dashboard-Start laden keine schweren PDF-Bytes.
- Bilder und Dokumente werden erst bei Bedarf nachgeladen.
- ETag und `Cache-Control: private, max-age=300, stale-while-revalidate=60`
  vermeiden unnoetige Wiederholungsdownloads bei geschuetzten Projektdateien.
- UI-Lademasken, Platzhalter und Fehlerzustand zeigen dem Nutzer sichtbar, dass
  eine Datei geladen wird oder erneut versucht werden kann.
- Die Dateimenge im Bucket verlangsamt einen korrekt adressierten Einzelabruf
  nicht linear. Relevant sind Dateigroesse, Netzwerk, Providerlatenz und Anzahl
  gleichzeitig sichtbarer Dateien. Deshalb bleiben Lazy Loading, begrenzte
  Parallelitaet, private Caches und spaetere Vorschaubilder wichtige Regeln.

## Code-Landkarte

| Aufgabe | Verbindlicher Code |
| --- | --- |
| Konfiguration ohne Geheimnisweitergabe | `src/lib/storage/config.ts` |
| Providerabstraktion und S3-Implementierung | `src/lib/storage/provider.ts`, `src/lib/storage/s3-provider.ts`, `src/lib/storage/factory.ts` |
| Objektschluessel | `src/lib/storage/object-key.ts` |
| Pruefsummen | `src/lib/storage/checksum.ts` |
| Validieren, hochladen, verifizieren, Fallback, Rollback | `src/lib/storage/file-pilot.ts` |
| `stored-file:`-Referenzen und Byte-Aufloesung | `src/lib/storage/document-file.ts` |
| XRechnung-/ZUGFeRD-Archivierung | `src/lib/invoices/invoice-artifact-storage.ts` |
| Geschuetzter Projekt-/Anfrageabruf | `src/app/api/files/[fileId]/route.ts` |
| Projektlogbuch-Uploads | `src/app/api/project-logbook-entries/route.ts` |
| Online-Anfrage-Uebernahme | `src/app/api/online-requests/[requestId]/convert/route.ts` |
| Angebote | `src/app/api/offers/route.ts`, `src/lib/offers/offer-delivery-service.ts` |
| Rechnungen und E-Rechnungsdownload | `src/app/api/invoices/route.ts`, `src/lib/invoices/invoice-delivery-service.ts` |
| Dokumentversand | `src/app/api/document-mail/route.ts` |
| Mahnungen | `src/lib/invoices/invoice-reminder-service.ts` |
| Winterdienst | `src/app/api/winter-service-runs/route.ts` |
| Weitere Projektberichte | `src/app/api/activity-reports/route.ts`, `src/app/api/smoke-detector-reports/route.ts`, `src/app/api/final-inspections/route.ts` |
| Mitarbeiterdokumente | `src/app/api/employee-documents/route.ts`, `src/app/api/employee-documents/[id]/route.ts` |
| JARVIS-Belegaktionen | `src/lib/jarvis/action-draft-store.ts` |
| Kontrollierte Altdateimigration | `scripts/migrate-object-storage.mjs` |
| Metadatenmodell | `prisma/schema.prisma` (`StoredFile`) |

## Konfiguration und Geheimnisschutz

Die Implementierung erwartet ausschliesslich serverseitig gesetzte Variablen:

```dotenv
WORKPILOT_STORAGE_PROVIDER=s3
WORKPILOT_S3_ENDPOINT=<serverseitiger HTTPS-Endpunkt>
WORKPILOT_S3_REGION=<Region>
WORKPILOT_S3_BUCKET=<privater Bucket>
WORKPILOT_S3_ACCESS_KEY_ID=<Server-Secret>
WORKPILOT_S3_SECRET_ACCESS_KEY=<Server-Secret>
WORKPILOT_S3_FORCE_PATH_STYLE=true
```

JARVIS darf Existenz, Zweck, Sicherheitsmodell und Betriebszustand erklaeren,
aber niemals Werte von Zugangsschluesseln, Tokens, Passwoertern oder anderen
Secrets ausgeben. Logs enthalten nur technische Fehlerklasse und fachneutrale
IDs, keine Datei-Bytes und keine Zugangsdaten.
