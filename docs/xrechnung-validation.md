# XRechnung-Validierung

WorkPilot360 nutzt zwei Stufen:

1. Technische Mindestprüfung in TypeScript.
2. Echte KoSIT-Validierung, sobald Validator und XRechnung-Konfiguration lokal bereitstehen.

Die KoSIT-Stufe ist optional konfigurierbar. Ohne Konfiguration bleibt die technische Mindestprüfung aktiv und die UI zeigt `KoSIT: Nicht konfiguriert`.

## KoSIT-Konfiguration

Benötigte lokale Komponenten:

- Java Runtime
- KoSIT Validator JAR
- Validator-Konfiguration XRechnung

Die KoSIT-Artefakte können lokal ins Projekt geladen werden:

```text
npm.cmd run setup:kosit
```

Das Skript lädt die aktuellen offiziellen GitHub-Releases in `.codex-tools/kosit/`. Dieser Ordner ist ignoriert und wird nicht versioniert.

Umgebungsvariablen:

```text
KOSIT_JAVA_PATH=java
KOSIT_VALIDATOR_JAR=C:\Pfad\zum\validator.jar
KOSIT_VALIDATOR_REPOSITORY=C:\Pfad\zur\validator-configuration-xrechnung
KOSIT_VALIDATOR_SCENARIOS=scenarios.xml
```

`KOSIT_JAVA_PATH` und `KOSIT_VALIDATOR_SCENARIOS` sind optional. Wenn `KOSIT_JAVA_PATH` fehlt, wird `java` aus dem Systempfad verwendet. Wenn `KOSIT_VALIDATOR_SCENARIOS` fehlt, wird `scenarios.xml` angenommen.

Nach dem Setup erzeugt das Skript zusätzlich `.codex-tools/kosit/.env.kosit.local.example` mit konkreten lokalen Pfaden. Diese Werte können in die lokale `.env` übernommen werden.

Offizielle Quellen:

- https://github.com/itplr-kosit/validator
- https://github.com/itplr-kosit/validator-configuration-xrechnung
