# Handoff: WorkPilot360-Schnittstelle fuer OKS Phone

Stand: 20.07.2026. Die Implementierung ist lokal und noch nicht deployt. Die lokale Bestandsmigration wurde nach Sicherung und Dry-Run erfolgreich ausgefuehrt.

## Grenzen und Verantwortlichkeit

- WorkPilot360 bleibt die fuehrende Quelle fuer Kontakte, Projekte, kaufmaennische Dokumente, Hinweise und Logbuecher.
- OKS Phone greift ausschliesslich serverseitig mit einem mandantenfesten Service-Credential zu.
- Die Schnittstelle liefert keine Coachings, Leistungsbewertungen, internen Kosten, Audioaufzeichnungen, Passwoerter oder Secrets.
- An OKS Phone, Asterisk, WebRTC, easybell, Fonio und der produktiven Telefonieroute wurde nichts geaendert.

## Datenmodelle

- `Contact`: zusaetzliche E.164-Felder `phoneNormalized`, `mobileNormalized`, `faxNormalized` mit mandantenbezogenen Indizes. Neue und bearbeitete Rufnummern werden beim Speichern einheitlich als E.164 gespeichert und angezeigt.
- `CustomerLogbookEntry`: persistente Telefonzusammenfassungen mit Quelle, Call-Referenz, Teilnehmernummern, optionaler Transkriptreferenz und Projektverknuepfungen.
- `ProjectLogbookEntry`: optionale, ausdruecklich bestaetigte Telefonzusammenfassung mit idempotenter Call-/Projekt-Kombination.
- `OksPhoneIntegrationCredential` und `OksPhoneRateLimitBucket`: gehashte Service-Credentials, Scopes und persistentes Minutenlimit.
- `ContactIntegrationEvent`: schmale Delta-Ereignisse fuer angelegte, geaenderte, geloeschte und normalisierte Kontakte.

## Telefonnummernstandard und Bestandsmigration

Vergleichsformat ist E.164. Deutsche nationale Schreibweisen muessen mit `0` beginnen; internationale Nummern mit `+` oder `00`. Eine Nummer ohne Laenderkontext und ohne nationale `0` wird als mehrdeutig abgelehnt und erhaelt nicht stillschweigend `+49`.

```powershell
npm run oks-phone:phones:dry-run
npm run oks-phone:phones:apply
```

Der Dry-Run gibt ausschliesslich Summen fuer leer, gueltig, ungueltig, mehrdeutig, geaendert und doppelte Gruppen aus. Er zeigt keine Rufnummern oder Kontakt-IDs. `apply` darf erst nach geprueftem Dry-Run und Datenbanksicherung ausgefuehrt werden. Gemeinsame Zentralnummern werden nicht zusammengefuehrt.

Lokaler Migrationsstand vom 20.07.2026: 291 Kontakte geprueft, 236 Kontakte aktualisiert, keine ungueltigen oder inkonsistenten Rufnummern. Die Sicherung liegt ausserhalb des Repositorys unter `C:\Users\vagte\AppData\Local\Temp\workpilot360-contact-phones-before-e164-20260720-214807.json`. Vor der produktiven Migration ist eine separate produktive Datenbanksicherung und ein erneuter Dry-Run verbindlich.

## Authentisierung

Authorization-Header: `Bearer <keyId>.<secret>`. Gespeichert wird nur der SHA-256-Hash des Secrets. Die Organisation wird durch das Credential festgelegt und kann nicht per Request ueberschrieben werden.

Scopes:

- `customer-context:read`
- `customer-logbook:write`
- `project-logbook:write`
- `contacts-delta:read`

Provisionierung erfolgt nur serverseitig ueber Umgebungsvariablen:

```powershell
npm run oks-phone:credential:provision
```

Erforderliche Konfiguration steht ohne echte Werte in `.env.example`. Bestehende Credentials werden nur mit dem bewussten Skriptparameter `--rotate` ersetzt. Das Secret wird nie ausgegeben.

## Endpunkte

### GET `/api/integrations/oks-phone/customer-context`

Genau einer der Parameter `phone` (beliebiges sicher normalisierbares Format) oder `contactId` ist erforderlich. Die Antwort enthaelt Kandidaten statt einer willkuerlichen Auswahl, wenn dieselbe E.164-Nummer mehreren Kontakten zugeordnet ist. Pro Kandidat werden Kunde, Ansprechpartner, aktive Hinweise, offene Projekte, Angebote/Nachtragsangebote, letzte Rechnungen sowie Kunden- und Projektlogbuch geliefert.

Als offen gelten alle vorhandenen strukturierten Projektstatus ausser Statuscode `10`/`11`; als Sicherheitsnetz gelten auch die Namen `abgeschlossen` und `archiviert` als geschlossen. Projektlinks verwenden die bestehende strukturierte Geschaeftsbereichszuordnung.

Die Antwort enthaelt exakte Direktlinks fuer Kundenakte, Kundenlogbuch, Hinweise, Projekte, Angebote und Rechnungen. Die URL-IDs sind nur Auswahlhinweise: Das Dashboard oeffnet ein Ziel ausschliesslich, wenn es bereits ueber die angemeldete Sitzung und die mandantengefilterten APIs geladen wurde. Ein Login ueber einen Direktlink kehrt anschliessend zum angeforderten Ziel zurueck.

Verwendete Linkformate (jeweils relativ zur WorkPilot360-Basis-URL):

- Kundenlogbuch: `/dashboard?view=contacts&customer=<customerId>&customerTab=logbook`
- Kundenhinweise: `/dashboard?view=contacts&customer=<customerId>&customerTab=notes`
- Projektlogbuch: `/dashboard?view=<projectsSolutions|projectsImmocare>&project=<projectId>&projectTab=logbook`
- Projekthinweise: `/dashboard?view=<projectsSolutions|projectsImmocare>&project=<projectId>&projectTab=notes`
- Angebot/Nachtragsangebot: Projektlink plus `offer=<offerId>`
- Rechnung: Projektlink plus `invoice=<invoiceId>`

Die konkreten Projektansichten werden aus der strukturierten Projektzuordnung erzeugt, nicht aus frei formulierten Firmen- oder Markennamen.

### POST `/api/integrations/oks-phone/customer-logbook`

Speichert eine sachliche Telefonzusammenfassung persistent. `(organizationId, source, callReference)` ist eindeutig. Gleichzeitige Retries werden als `duplicate: true` beantwortet. Audio wird nicht gespeichert; `metadata` ist auf freigegebene Felder begrenzt.

### POST `/api/integrations/oks-phone/project-logbook`

Erfordert `agentConfirmed: true`, den bestehenden Kundenlogbucheintrag und ein offenes Projekt desselben Kunden/Mandanten. `(organizationId, source, callReference, projectId)` ist eindeutig. Eine Ablehnung in OKS Phone ruft diesen Endpunkt nicht auf und verhindert die Kundenlogbuchspeicherung nicht.

### GET `/api/integrations/oks-phone/contacts-delta`

Erster Aufruf mit `after=<ISO-Zeitstempel>`, Folgeaufrufe mit dem opaken `cursor`. `limit` liegt zwischen 1 und 200. Sortierung und Cursor verwenden `(occurredAt, id)`. Das Event enthaelt nur Event-ID, Kontakt-ID, Ereignistyp, geaenderte Feldnamen und Zeitstempel; Details werden anschliessend ueber `customer-context?contactId=...` geladen.

## Aufbewahrung und Loeschung

- Die Integration speichert keine Audiodateien und keine Coaching- oder Bewertungsdaten.
- Sachliche Telefonzusammenfassungen im Kunden- und optional im Projektlogbuch sind regulaere WorkPilot-Logbucheintraege. Sie haben keinen verdeckten automatischen Ablauf und unterliegen derselben fachlichen Aufbewahrung und berechtigten Loeschung wie die bestehenden Logbuecher.
- Die Integrations-POST-Endpunkte sind absichtlich append-only; sie bieten keine externe Loeschroute fuer OKS Phone. Eine Loeschung darf nur ueber einen ausdruecklich autorisierten WorkPilot-Prozess erfolgen.
- Delta-Ereignisse enthalten keine Rufnummern oder Kontaktinhalte. Ein produktiver Bereinigungszeitraum darf erst festgelegt werden, wenn das Checkpoint- und Reparaturkonzept von OKS Phone beschlossen ist; bis dahin duerfen fuer aktive Checkpoints benoetigte Ereignisse nicht automatisiert entfernt werden.
- Zur sofortigen technischen Sperre wird das zugehoerige Service-Credential deaktiviert. Bereits fachlich gespeicherte Logbucheintraege werden dadurch nicht geloescht.

## Fehlercodes

- `400`: ungueltiger Parameter oder Payload
- `401`: Credential fehlt oder ist ungueltig
- `403`: erforderlicher Scope fehlt
- `404`: Kunde/Projekt nicht im Credential-Mandanten vorhanden
- `409`: Projekt ist nicht mehr offen
- `429`: persistentes Rate-Limit erreicht
- `500`: neutraler Serverfehler ohne sensible Details

## Offene Entscheidungen fuer OKS Phone

- Auswahloberflaeche bei Mehrfachtreffern.
- Relevanzbewertung und ausdrueckliche Projektbestaetigung durch den Agenten.
- Sichere Speicherung des Service-Secrets und Retry-/Delta-Checkpointing.
- Periodischer Delta-Reparaturabgleich.
- Produktive Credential-Provisionierung, sichere Secret-Uebergabe und Festlegung des Delta-Checkpointings.
- Produktive Datenbanksicherung, Telefonnummern-Dry-Run und anschliessende kontrollierte Migration.
- Auswahloberflaeche und Bedienkonzept fuer Mehrfachtreffer in OKS Phone.

## Rollback

Vor `db push` und vor `oks-phone:phones:apply` Datenbank sichern. Code kann ueber den zugehoerigen Commit zurueckgenommen werden. Die additiven Spalten/Tabellen nicht entfernen, solange OKS Phone Requests oder Delta-Checkpoints existieren. Die Migration vereinheitlicht sowohl die sichtbaren Rufnummernfelder (`phone`, `mobile`, `fax`) als auch die zugehoerigen Normalisierungsfelder auf E.164. Ein Datenrollback muss deshalb die vor dem Lauf gesicherten Kontaktwerte wiederherstellen; das Leeren nur der Normalisierungsfelder waere kein vollstaendiger Rollback. Zum sofortigen funktionalen Integrations-Rollback kann das Service-Credential deaktiviert werden.
