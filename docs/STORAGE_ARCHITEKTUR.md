# WorkPilot360 Datei- und Objektspeicher

## Zielbild

PostgreSQL bleibt die verbindliche Quelle fuer Organisation, Berechtigungen,
Projektzuordnung, Dateimetadaten und Audit. Bilder, PDFs und sonstige binaere
Dateien werden schrittweise aus grossen `Bytes`-/Base64-Feldern in einen
privaten S3-kompatiblen Objektspeicher ausgelagert.

Der erste vorgesehene Provider ist STRATO HiDrive Objektspeicher. WorkPilot
spricht jedoch nur mit der internen `StorageProvider`-Schnittstelle, damit der
Provider ohne Aenderung der Fachlogik austauschbar bleibt.

## PWA- und API-Kompatibilitaet

Angeschlossene PWA- und Mobile-Clients greifen weiterhin ausschliesslich auf
die WorkPilot-API zu. Sie erhalten niemals S3-Zugangsdaten und muessen weder
Bucket noch Provider kennen. WorkPilot uebernimmt Upload, Berechtigungspruefung
und geschuetzte Auslieferung.

Bestehende API-Vertraege bleiben waehrend der Migration kompatibel. Wo ein
Client heute eingebettete Data-URLs erwartet, stellt WorkPilot zunaechst einen
Kompatibilitaetspfad bereit. Das langfristige API-Ziel ist eine stabile
Datei-ID mit einer WorkPilot-Downloadroute. Ein Wechsel auf diese Darstellung
erfolgt erst nach einem gemeinsam getesteten Client-Release.

## Verbindliche Sicherheitsregeln

- Buckets und Objekte sind niemals oeffentlich.
- Ein Abruf wird immer zuerst durch WorkPilot authentifiziert und autorisiert.
- Objektschluessel enthalten keine Namen, Anschriften oder Originaldateinamen.
- Zugangsschluessel werden ausschliesslich als Server-Secrets gespeichert.
- Uploads werden vor Freigabe nach Dateigroesse, Magic Bytes und erlaubtem
  Inhaltstyp geprueft; fuer Fremddateien ist ein Malware-Scan vorgesehen.
- SHA-256, Groesse und Inhaltstyp werden mit den Metadaten gespeichert und nach
  dem Upload verifiziert.
- Fehler im Objektspeicher duerfen die Fachanwendung nicht zum Absturz bringen.
  Neue Uploads erhalten einen nachvollziehbaren Status und Retry-Pfad.
- Produktivdateien und Backups verwenden getrennte Zugangsdaten und moeglichst
  getrennte Konten.

## Vorgesehene Konfiguration

```dotenv
WORKPILOT_STORAGE_PROVIDER=s3
WORKPILOT_S3_ENDPOINT=https://s3.hidrive.strato.com
WORKPILOT_S3_REGION=eu-central-1
WORKPILOT_S3_BUCKET=workpilot360-prod-assets
WORKPILOT_S3_ACCESS_KEY_ID=
WORKPILOT_S3_SECRET_ACCESS_KEY=
WORKPILOT_S3_FORCE_PATH_STYLE=true
```

Die Variablen werden erst produktiv aktiviert, wenn Bucket, Berechtigungen,
Upload, Download, Loeschschutz und Wiederherstellung separat abgenommen sind.

## Einfuehrungsreihenfolge

1. Provideradapter und isolierter Verbindungstest.
2. Additives Dateimetadatenmodell mit Status, Pruefsumme und Auditbezug.
3. Online-Anfragebilder als erster Dual-Write-/Fallback-Pilot.
4. Projektbilder und allgemeine Projektdokumente.
5. Angebote, Rechnungen und Taetigkeitsberichte mit unveraenderlichen Versionen.
6. Mitarbeiterdokumente mit zusaetzlicher Zugriffskontrolle.
7. Verifizierte Hintergrundmigration vorhandener Datenbankdateien.
8. Entfernen alter Binaerfelder erst nach Restore-Test und vereinbarter Karenz.

## Noch nicht Bestandteil des Fundaments

Die erste isolierte Ausbaustufe veraendert weder Prisma noch bestehende Upload-
oder Downloadrouten. Sie leitet keine produktive Datei um und benoetigt noch
keinen echten STRATO-Schluessel. Der S3-Adapter ist implementiert, bleibt aber
bei `WORKPILOT_STORAGE_PROVIDER=disabled` inaktiv. Metadatenmodell und
Online-Anfrage-Pilot folgen erst nach separater Abnahme des echten Buckets.
