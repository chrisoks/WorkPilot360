# WorkPilot360 / PWA: Session-Vertrag

Stand: 15.07.2026

## Ursache des bisherigen Folgetag-Fehlers

Die bisherige Anmeldung bestand ausschliesslich aus einem signierten
`workpilot_session`-Cookie mit einer festen Laufzeit von 12 Stunden. Es gab
keinen serverseitigen Sitzungsdatensatz, keine kontrollierte Verlaengerung und
keinen serverseitigen Widerruf. Die PWA konnte den Benutzer lokal weiterhin
kennen, waehrend die echte API-Sitzung bereits abgelaufen war. Dadurch war die
Antwort `401` fachlich korrekt, wurde in der PWA aber irrefuehrend als
Verbindungsfehler dargestellt.

## Neue Session-Strategie

- Cookie: `workpilot_session`
- Inhalt: signierte, nicht personenbezogene Sitzungs-ID mit Token-Version
- Cookie-Schutz: `HttpOnly`, in Produktion `Secure`, `SameSite=Lax`, `Path=/`
- Serverseitige Tabelle: `AuthSession`
- Inaktivitaetsgrenze: 7 Tage
- Absolute Hoechstlaufzeit: 30 Tage
- Rotation: nach 12 Stunden beim Aufruf der Session-API
- Parallelzugriff: die vorherige Token-Version bleibt 30 Sekunden gueltig
- Aktivitaet wird hoechstens alle 15 Minuten serverseitig fortgeschrieben
- Logout setzt `revokedAt` und loescht danach das Cookie
- Alte gueltige 12-Stunden-Cookies werden beim Aufruf der Session-API einmalig
  in eine serverseitige Sitzung ueberfuehrt.

Das Cookie bleibt hostgebunden. Die PWA muss weiterhin ihre bestehenden
relativen `/api/...`-Aufrufe ueber den fuer `wp360app.oks-cloudservices.com`
eingerichteten Reverse Proxy senden. Es wird bewusst keine Cookie-Domain fuer
alle `*.oks-cloudservices.com` gesetzt. Ein direkter Cross-Origin-Aufruf von
der PWA an `workpilot360.oks-cloudservices.com` ist nicht Teil dieses Vertrags.

## API-Vertrag fuer die PWA

### Projektbereich

`GET /api/hero/projects?actorId=<Benutzer-ID>` liefert je Projekt zusaetzlich
das stabile Feld `businessAreaCode`:

- `OK_IMMOCARE`: Vorher-/Nachherbilder sind fachlich zulaessig.
- `OK_SOLUTIONS`: keine Immocare-Vorher-/Nachhergalerie.

Die Zuordnung verwendet ausschliesslich `projectType`, `branch` und fuer alte
Importe den bereits im Hauptprogramm verwendeten historischen
`OKI-`-Projektnummernpraefix. Titel, Kundenname und sonstige sichtbare Texte
werden nicht ausgewertet. Alte Importprojekte ohne diese Merkmale bleiben wie
bisher der Solutions-Pipeline zugeordnet. Es findet keine Datenmigration oder
stille Neuzuordnung statt.

### Anmeldung

`POST /api/auth/login`

Request:

```json
{
  "email": "benutzer@unternehmen.de",
  "password": "..."
}
```

Erfolg: `200`, bestehende Benutzerdaten im Response und Setzen des
HttpOnly-Cookies. Fehler: `401` mit `error`, wenn die Zugangsdaten nicht
stimmen.

### Sitzung laden und erneuern

`GET /api/auth/session`

Die PWA ruft diesen Endpunkt beim Start auf. Eine noch zulaessige Sitzung wird
serverseitig fortgeschrieben und bei faelliger Rotation durch ein neues
HttpOnly-Cookie ersetzt.

Erfolg:

```json
{
  "authenticated": true,
  "user": {
    "id": "...",
    "name": "...",
    "email": "...",
    "role": "MITARBEITER",
    "roleLabel": "Mitarbeiter",
    "teamId": null,
    "teamIds": [],
    "dailyWorkHours": 8,
    "profileImageDataUrl": "",
    "personalNumber": ""
  }
}
```

Abgelaufen oder widerrufen:

```json
{
  "authenticated": false,
  "code": "SESSION_EXPIRED",
  "error": "Sitzung ist abgelaufen oder wurde beendet."
}
```

Status: `401`. Die PWA muss dann lokale Benutzer-/Stempelansichten sperren und
den Login zeigen. Dieser Fall ist kein allgemeiner Netzwerkfehler.

### Abmeldung

`POST /api/auth/logout`

Erfolg:

```json
{ "success": true }
```

Der Endpunkt widerruft die Sitzung serverseitig und entfernt das Cookie. Die
PWA entfernt anschliessend nur ihre lokale UI-Auswahl, Benutzermetadaten und
benutzerbezogene Cache-Eintraege. Passwoerter oder Sitzungstoken duerfen weder
in Local Storage noch im Service Worker gespeichert werden.

## Fetch- und Fehlerregeln

- Relative URLs wie `/api/auth/session` verwenden.
- `credentials: "include"` verwenden. Beim vorhandenen Same-Origin-Proxy ist
  auch der Browserstandard ausreichend; `include` macht die Absicht eindeutig.
- Auth-/API-Responses niemals im Service Worker cachen.
- `401`: keine gueltige Sitzung oder Sitzung abgelaufen; bei
  `/api/auth/session` anhand `code: SESSION_EXPIRED` erkennbar.
- `403`: Benutzer ist angemeldet, besitzt fuer die konkrete Aktion aber nicht
  die erforderliche Berechtigung.
- Netzwerkfehler: Request hat keine HTTP-Antwort erhalten. Nur dieser Fall darf
  als fehlende Verbindung bezeichnet werden.
- Nach einem `401` eines Fachendpunkts einmal `GET /api/auth/session` ausfuehren.
  Bei `200` darf der Fachrequest einmal wiederholt werden; bei `401` zum Login
  wechseln. Keine Endlosschleife.

## Sicherheitsgrenzen

- Keine langlebigen Tokens sind fuer JavaScript lesbar.
- Rotation und Widerruf werden serverseitig kontrolliert.
- Deaktivierte Benutzer koennen auch mit bestehender Sitzung nicht weiterarbeiten.
- Die 30-Tage-Grenze wird durch Aktivitaet nicht verlaengert.
- Die CSRF-Pruefung fuer diesen Vertrag ergab: Das hostgebundene
  `SameSite=Lax`-Cookie wird nur ueber relative Same-Origin-Proxy-Aufrufe
  verwendet; Auth-Endpunkte geben keine JavaScript-lesbaren Tokens aus und
  Zustandsaenderungen verwenden POST/PATCH/DELETE. Der Session-Umbau oeffnet
  daher keinen neuen Cross-Site-Schreibweg.
- Ein kompromittierter Server-Session-Secret bleibt ein kritisches Risiko. In
  Produktion muss `WORKPILOT_SESSION_SECRET` oder `NEXTAUTH_SECRET` sicher
  gesetzt sein; ohne einen dieser Werte verweigert die Sessionlogik den
  Betrieb. Der Wert muss mindestens 32 Zeichen lang und zufaellig erzeugt sein.
  Kein Secret darf in PWA-Code oder Dokumentation stehen.
- Vor jedem Produktionsstart prueft `npm run check:session-secret`, dass einer
  der beiden erlaubten Secret-Namen gesetzt und mindestens 32 Zeichen lang
  ist. Der Wert selbst wird dabei niemals ausgegeben.
