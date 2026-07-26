# JARVIS Systemlandkarte

Stand: 26.07.2026

## Zweck

Die Systemlandkarte ist die geprüfte, maschinenlesbare Grundlage dafür, dass
JARVIS Bereiche von WorkPilot360 erklären und sicher öffnen kann. Die
verbindliche Registry liegt in `src/lib/jarvis/system-map.ts`.

Diese Dokumentation beschreibt Abdeckung, Prüfstatus und bewusste Grenzen. Sie
ersetzt nicht die Registry.

## Aktuelle Abdeckung

Die Registry enthält 88 Einträge:

- 17 aktive Hauptbereiche,
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
- 11 Reiter der Kundenakte.

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
- dynamische Datensatzsuche und rollenberechtigte Live-Zusammenfassungen,
- vollständige Dialogvarianten und Umgangssprache je Workflow,
- schreibende Aktionen mit Vorschau, Bestätigung, Audit und Idempotenz,
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
- eine gesperrte Rolle kein Navigationsziel erhält.

## Pflegepflicht

Bei jedem neuen oder umbenannten produktiven Bereich muss gleichzeitig:

1. die Systemlandkarte angepasst werden,
2. Zweck, Kernabläufe, Rollen und Quelle geprüft werden,
3. der Abdeckungstest aktualisiert werden,
4. bei geänderter Navigation ein echter Browserklick erfolgen.

Ohne diese vier Schritte gilt ein neuer WorkPilot-Bereich für JARVIS nicht als
vollständig eingeführt.
