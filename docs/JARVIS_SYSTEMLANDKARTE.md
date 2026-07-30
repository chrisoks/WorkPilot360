# JARVIS Systemlandkarte

Stand: 30.07.2026

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
- verbundene und fachlich tiefere Live-Zusammenfassungen über die erste
  rollenberechtigte Suche für Projekte, Kunden/Kontakte, Aufgaben, Angebote
  und Rechnungen hinaus,
- vollständige Dialogvarianten und Umgangssprache je Workflow,
- weitere schreibende Aktionen außerhalb der bereits vollständigen Aufgaben-
  und projektartgerechten Termin-/Terminwunsch-Vertikalschnitte,
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
- Manuelle Zeiterfassung bleibt auf der typisierten Vorschaugrundlage und ist
  noch kein produktiver Schreib-Vertikalschnitt.

Ein JARVIS-Entwurf darf weder Organisation, Projektart, Projektstand,
Mitarbeiterzugehörigkeit noch Kontingent aus seinem eigenen Payload bestimmen.
Diese Werte werden bei Vorprüfung und Bestätigung aus WorkPilot360 neu geladen.

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
- Die Originalanfrage wird als Projektlogbuch-Eintrag `Online-Anfrage`
  übernommen. Sicher normalisierte Bilder landen in `Anfragebilder`;
  Termin- und Rückrufwünsche werden als verknüpfte Aufgaben angelegt.
- JARVIS darf diesen Ablauf erklären und den Posteingang öffnen, aber keine
  Kundenentscheidung oder Projektumwandlung autonom ausführen.

Verifizierte Quellen sind
`src/components/online-requests/online-requests-workspace.tsx`,
`src/app/api/online-requests/route.ts`,
`src/app/api/online-requests/[requestId]/convert/route.ts` und
`src/lib/online-requests/conversion.ts`.
