# WorkPilot360 Offene Punkte

Stand: 2026-07-01

Diese Liste haelt Themen fest, die nach abgeschlossenen Zwischenarbeiten nicht verloren gehen sollen.

## Notifications, Push und Mail

- Planungs-/Terminwunsch-Hinweise pruefen:
  - Terminwunsch-Freigabe hat aktuell In-App + Web-Push.
  - Planungsaenderung hat aktuell In-App + Web-Push.
  - Noch entscheiden, ob diese Hinweise zusaetzlich echte Systemmails bekommen sollen.

- Content-/Status-Eskalationen pruefen:
  - Einige Bereiche nutzen Kanaele wie `app_email`, `email` oder `app_daily_report`.
  - Noch pruefen, wo das nur Datenbank-/Anzeige-Kanal ist und wo tatsaechlich SMTP-Mail fehlt.
  - Besonders Status-Eskalationen mit Tagesbericht sauber fachlich durchgehen.

- Allgemeine Notification-Logik weiter konsolidieren:
  - Aufgaben, Aufgabenkommentare, Abwesenheiten, offene Abrechnungszeiten und Abrechnungsbereit-Hinweise haben echte Systemmail.
  - Bei weiteren Benachrichtigungsarten jeweils bewusst entscheiden: nur Glocke, Glocke + Push, Glocke + Mail oder Kombination.

## Abrechnungsbereit / Abrechnung

- Pipeline-Status nach Umsetzung:
  - `Endkontrolle` ist als Projektstatus durch `Abrechnungspruefung` ersetzt.
  - `Endkontrolle` bleibt als Dokument-/Nachweisart erhalten.
  - Neuer Sonderstatus: `Arbeit unterbrochen`.
  - Nach gespeicherter Endkontrolle prueft das System automatisch Vorherbilder, Nachherbilder und Endkontrolle.
  - Taetigkeitsberichte sind keine Voraussetzung fuer `Abrechnungsbereit`; sie werden in der Faktura erzeugt.

- Dauerlaeufer nach Rechnung weiter beobachten:
  - Nach Rechnung geht ein Dauerlaeufer in `Umsetzung`, wenn der Folgemonat ausreichend bestaetigt geplant ist.
  - Ohne ausreichende bestaetigte Folgemonatsplanung geht er in `Zur Planung bereit`.
  - Bei Projektzeitkontingent zaehlt: bestaetigte Planungsstunden im Folgemonat >= Monatskontingent.

- Dauerlaeufer-Monatslogik nach Serverupdate pruefen:
  - HAS-1 und 1-2 weitere Dauerlaeufer in der Pipeline gegenpruefen.
  - Kontrollieren, ob die aktuelle Monatsposition korrekt aus Planung/Stempelung/Laufzeit entsteht.
  - Kontrollieren, ob `Vormonat(e) unvollstaendig` nur echte Altprobleme meldet.
  - Vormonatsdetails pruefen: Planung, Rechnung und Nachweise sollen fachlich passend angezeigt werden.

## Dashboard / Rollen-KPIs

- KPI-Kacheln je Rolle nachziehen:
  - Geschaeftsfuehrung zuerst: Umsatz & Forecast, Produktivitaet, Projektlage, Vertrieb & Kunde.
  - Danach fachlich eigene KPI-Sets fuer Fuehrungskraft, Buchhaltung, Vertrieb und Mitarbeiter definieren.
  - Layoutvorgabe: KPI-Kacheln im 2x2-Block lassen und mit `Team live` darunter sauber fluchten lassen.

- Benachrichtigungslogik weiter fachlich abgrenzen:
  - `Projekt abrechnungsbereit` und `Dauerlaeufer abrechnungsbereit` senden seit Commit `3b8cec0` zusaetzlich Systemmail.
  - Offene, nicht fakturierte Projektzeiten laufen ueber `/api/unbilled-time-alerts` mit eigener Deduplizierung.
  - Noch pruefen, ob beide Logiken fachlich klar getrennt sind oder ob Nutzer sie als ein gemeinsames Thema erwarten.

## Review naechste Ausbaustufe

- Sales-Performance auf Praxistauglichkeit pruefen:
  - Wirkt der Reiter fuer Vertrieb wirklich als aktives Steuerungsinstrument?
  - Neukundenimpulse, alte offene Angebote, Nachfassdisziplin und Dauerlaeufer-Nachverhandlung fachlich gegen echte Nutzung pruefen.
  - Besonders schauen, ob Hinweise konkret genug sind oder ob Vertriebler von Zahlen ueberrollt werden.

- Projekt-Auswertungen weiter veredeln:
  - Trennung Einmalprojekte/Dauerlaeufer nach dem Review fachlich bewerten.
  - Grenzwerte fuer durchschnittliche Dauer und laengste Dauer je Projektart/Phase nachschaerfen.
  - Top-Engpaesse und Handlungsempfehlungen noch verstaendlicher machen.

- Sicherheits-/Audit-Themen separat bewerten:
  - `npm audit`-Hinweise kontrolliert durchgehen.
  - Keine Schnellreparatur mit Breaking-Changes, sondern Risiko und Aufwand je Paket bewerten.

- Datenqualitaet pruefen:
  - Alte Statuswerte, Zeichensatzfehler und auffaellige Projekt-/Kontingentwerte systematisch suchen.
  - Entscheiden, ob ein kleiner Datenqualitaets-Check oder eigener Hinweisbereich sinnvoll ist.

## Login / Startverhalten

- Erneuter Login startet seit Commit `3b8cec0` wieder im Dashboard (`overview`).
- Direkte URL-/Push-Ziele sollen weiterhin explizit oeffnen. Bei zukuenftigen Login-Aenderungen darauf achten.

## Bekannte Arbeitsregel

- Vor Aenderungen Sicherheitskopie in `.codex-safety` anlegen, wenn bestehende Dateien geaendert werden.
- Nach Aenderungen mindestens ausfuehren: `git diff --check`, `npm run check:mojibake`, `npm run check:regressions`, `npx prisma validate`, bei Codeaenderungen `npm run build`.
- Erst nach erfolgreichen Checks committen und nach GitHub pushen.
