# WorkPilot360 Audit-Checkpoint: Auth- und Sessionbindung

Stand: 2026-06-23

## Ziel

Der Auth-/Sessionblock wurde abgeschlossen. Ziel war, alte direkte Actor- und User-Pruefungen zu entfernen oder zu bewerten, damit API-Aktionen nicht mehr nur einem frei uebergebenen `actorId` vertrauen.

## Ergebnis

- Schreibende Aktionen sind an eine gueltige Sitzung gebunden.
- Explizit falsche Actor/User liefern kontrolliert `401` oder bei fehlender Berechtigung `403`.
- Ungefaehrliche Fallback-Leseaufrufe crashen nicht und liefern leer/`200`, wo dies fuer die UI noetig ist.
- Mitarbeiter-Stempelung, PWA-Stempelung und manuelle Zeiteintraege bleiben fachlich erhalten.
- Mitarbeiter-Emulation bleibt fuer berechtigte Rollen erhalten.

## Umgestellte Bereiche

- Katalog/Stammdaten, Kontakte, Dokumente, Reports, Sales, Marketing, Inhalte, Ideen.
- Aufgaben, Statusregeln, Eskalationen, News/Notifications.
- Abwesenheiten, Planung, Projektzeiten, Stempelung.
- Hero-/Winterdienst-/Rauchmelder-Sonderrouten.
- Benutzer- und Teamaktionen.
- Mail-OAuth-Start.

## Bewusst bewertete Spezialfaelle

- `project-time-entries`: `getRequestUser` bleibt, weil es den Ziel-Mitarbeiter fuer manuelle Zeiteintraege validiert. Die Actor-Pruefung ist bereits sessiongebunden.
- `stamp-session`: bleibt fachlich `userId`-basiert, weil Mitarbeiter gestempelt werden. Schreibaktionen sind jetzt sessiongebunden.
- `mail/oauth/callback`: arbeitet mit OAuth-State-Cookie und wurde nicht pauschal umgebaut. Der Startpunkt ist sessiongebunden.
- Feedback-Vertriebsnutzer (`salesUser`) sind fachliche Zielnutzer, keine Login-Actor-Pruefung.

## Wichtige Commits

- `9fece3d auth: bind catalog items to session actor`
- `41d7ccc auth: bind customer feedback to session actor`
- `461d97e auth: bind document settings to session actor`
- `8f728ad auth: bind master data routes to session actor`
- `2d3682c auth: bind business area targets to session actor`
- `ca224ee auth: bind sales targets and potentials to session actor`
- `ac57748 auth: bind content and ideas to session actor`
- `162da4f auth: bind absences to session actor`
- `6adec4b auth: bind task actions to session actor`
- `48fe8c2 auth: bind status automation to session actor`
- `22add87 auth: bind news notifications to session actor`
- `5a43b43 auth: bind sales marketing to session actor`
- `e1742e2 auth: bind reports to session actor`
- `b169bfb auth: bind hero and winter routes to session actor`
- `52ae10c auth: bind user team actions to session actor`
- `73a9912 auth: bind stamp writes to session user`
- `b6bf8f3 auth: bind mail oauth start to session actor`

## Abschlusschecks

Formale Checks:

- `git diff --check`: bestanden
- `npm.cmd run check:mojibake`: bestanden
- `npm.cmd run check:regressions`: bestanden
- `npx.cmd tsc --noEmit --pretty false`: bestanden

Live-Smokes mit echter lokaler Login-Session:

- `/api/auth/session`: `200`
- `/api/users`: `200`
- `/api/teams`: `200`
- `/api/stamp-session?userId=...`: `200`
- `/api/planning-entries?actorUserId=...`: `200`
- `/api/project-time-entries?actorUserId=...`: `200`
- `/api/tasks`: `200`
- `/api/notifications?userId=...`: `200`
- `/api/hero/projects?actorId=...`: `200`
- `/api/contacts?actorId=...`: `200`
- `/api/absences?actorId=...`: `200`

Negative Smokes:

- Ungueltiger Actor/User: `401`
- Keine Sitzung bei schreibenden Aktionen: `401`
- Fremdes Mailkonto ohne Benutzerverwaltungsrecht: `403`

## Naechster sinnvoller Auditblock

Nach diesem Checkpoint kann die Weiterentwicklung auf dem Auth-/Sessionstand aufsetzen. Fuer das Audit bieten sich als naechste Bloecke an:

- UI-/Ladeverhalten nach Auth-Umstellung.
- Fachlogik Projektzeiten, Planung und automatische Abrechnung.
- Datenqualitaet/Altlasten: verwaiste Referenzen, inaktive Nutzer, alte Projekt-/Dokumentstatus.
