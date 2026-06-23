# WorkPilot360 Audit-Checkpoint: UI-Ladeverhalten nach Auth-Umstellung

Stand: 2026-06-23

## Ziel

Nach Abschluss des Auth-/Sessionblocks wurde geprueft, ob die Dashboard-Oberflaeche noch alte Request-Muster nutzt, die beim Laden wiederkehrende `401`, `404` oder `500` ausloesen koennen.

## Ergebnis

- Keine alten Test-IDs wie `does-not-exist` im Dashboard-Code gefunden.
- Die fruehere Meldung `Projektzeiten konnten nicht geladen werden.` sitzt in `loadProjectTimeEntries`, wird aber nur bei einem echten fehlgeschlagenen Response gesetzt.
- Projektzeit-Polling ist bewusst auf eine geoeffnete Projektakte begrenzt.
- Stempelstatus wird alle 5 Sekunden synchronisiert; das ist fuer PWA/Hauptprogramm-Livezustand fachlich gewollt.
- Benachrichtigungen werden alle 15 Sekunden synchronisiert.
- Keine Codeaenderung noetig.

## Gepruefte UI-Bereiche

- Initialer Dashboard-Ladeeffekt nach Login.
- Projektzeiten-Laden und Projektzeiten-Polling.
- Stempelstatus-Laden und Stempelstatus-Polling.
- Benachrichtigungs-Polling.
- `userId`-basierte Spezialrouten: Idea Store, Notifications, Stamp Session.
- `actorId`-/`actorUserId`-basierte Routen nach Auth-Umstellung.

## Live-Smoke mit echter lokaler Login-Session

Alle folgenden Endpunkte lieferten `200`:

- `/api/auth/session`
- `/api/tasks`
- `/api/users`
- `/api/teams`
- `/api/trades?actorId=...`
- `/api/trades?businessAreas=1&actorId=...`
- `/api/business-area-targets?actorId=...`
- `/api/units?actorId=...`
- `/api/escalation-rules?actorId=...`
- `/api/absences?actorId=...`
- `/api/planning-entries?actorUserId=...`
- `/api/content-items?actorId=...`
- `/api/idea-store?userId=...`
- `/api/contacts?actorId=...`
- `/api/catalog-items?actorId=...`
- `/api/offers?actorId=...`
- `/api/invoices?actorId=...`
- `/api/legacy-invoices?actorId=...`
- `/api/monthly-financial-report?actorId=...`
- `/api/winter-service-automation?actorId=...`
- `/api/customer-feedback?actorId=...`
- `/api/customer-feedback-requests?actorId=...`
- `/api/hero/projects?actorId=...`
- `/api/project-time-entries?actorUserId=...`
- `/api/stamp-session?userId=...`
- `/api/stamp-session`
- `/api/project-logbook-entries?actorId=...&summary=1`
- `/api/potentials?actorId=...`
- `/api/sales-targets?actorId=...`
- `/api/status-timeline?entityType=project`
- `/api/notifications?userId=...`
- `/api/document-types?actorId=...`
- `/api/document-texts?actorId=...`

## Bewertung

Der UI-Ladeblock ist nach der Auth-Umstellung stabil. Die zuvor beobachteten wiederkehrenden Projektzeiten-Fehler sind in diesem Check nicht reproduzierbar. Fuer die weitere Auditstrecke ist der naechste sinnvolle Block die fachliche Pruefung von Projektzeiten, Planung und automatischer Abrechnung.
