# JARVIS Entwicklungsplan

Stand: 24.07.2026

## Aktueller Umsetzungsstand

Stand 26.07.2026:

- Der Entwicklungsplan ist als eigener Git-Commit gesichert.
- Der JARVIS-Sicherheitskern klassifiziert interne, Kunden-, Finanz-,
  Personal-, Lohn- und geheime Daten.
- Passwörter, API-Schlüssel, Tokens und technische Secrets sind für alle
  Rollen gesperrt.
- Rechte werden bei Mitarbeiteremulation als Schnittmenge aus echter Sitzung
  und emulierter Rolle geprüft. Emulation kann Rechte nur einschränken.
- Bekannte Bedienhilfen sind mit den bestehenden
  WorkPilot-Aktionsberechtigungen verbunden.
- Die zentrale Action Registry enthält die geplanten Aktionsarten,
  Risikostufen, Bestätigungsstufen und Datenklassen.
- Die erste rein lesende Aktion `navigation.open` ist verfügbar. Alle
  schreibenden Aktionen stehen weiterhin auf `planned`.
- Die erste maschinenlesbare Systemlandkarte erfasst 88 geprüfte Bereiche aus
  Hauptnavigation, Aufgaben, Zielen, Mitarbeitern, Prozessen, Buchhaltung,
  Katalog, Auswertungen, Firmeneinstellungen, Kalkulationen sowie Projekt- und
  Kundenakte. Details und bewusste Lücken stehen in
  `docs/JARVIS_SYSTEMLANDKARTE.md`.
- JARVIS kann bekannte Bereiche und den aktuellen UI-Kontext deterministisch
  erklären und ein rollenberechtigtes, clientseitig nochmals validiertes
  Sprungziel anbieten.
- Die ersten sicheren Live-Datenadapter finden und erklären Projekte,
  Kunden/Kontakte, Aufgaben, Angebote und Rechnungen. Eindeutige Such-,
  Öffnungs- und Zusammenfassungsabsichten laufen vollständig deterministisch
  und verursachen keinen OpenAI-Aufruf.
- Jede Abfrage ist organisationsgebunden. Aufgaben werden zusätzlich nach
  Eigentümer, Beteiligung und Team für echte Sitzung und emulierten Benutzer
  gefiltert; die UI öffnet nur Datensätze aus ihren bereits erlaubten Listen.
- Der nächste Ausbau vertieft die Zusammenfassungen um verbundene Daten,
  Zeitraum- und Statusfilter sowie weitere Kernabläufe. Schreibende Aktionen
  bleiben bis zu ihren eigenen Vorschau-, Audit- und Idempotenzpaketen
  `planned`.
- Das nächste fachliche Ziel ist ein proaktiver Vertriebs-, Projekt- und
  BWL-Analyst: JARVIS soll historische und aktuelle Projekte verstehen,
  Wiederholungs-, Nachfass- und Cross-Selling-Chancen erkennen und daraus
  nachvollziehbare Empfehlungen, Aufgaben und kontrollierte Mailentwürfe
  vorbereiten.
- Der erste Vertriebsanalyse-Dry-Run ist umgesetzt. Er läuft im Reiter
  `Vertrieb` vor dem freien KI-Pfad, liest bei jeder Anfrage die aktuellen
  organisationsgebundenen Daten und nimmt dadurch neue Kunden, Projekte,
  Angebote und Rechnungen automatisch auf. Für die erste Abnahme ist er nur
  bei einer echten Geschäftsführungs-Sitzung verfügbar. Belegte Signale sind
  angesehene, nicht angenommene Angebote, kürzlich abgeschlossene Projekte
  ohne erkannte Nachfassspur und Rechnungsleistungen im vergleichbaren
  Vorjahreszeitraum. Vorhandene aktive Projektpotenziale, Verkaufschancen und
  erkennbare Nachfassaufgaben werden zur Deduplizierung berücksichtigt.
  Treffer enthalten Quelle, Datum, Priorität und vorsichtige Empfehlung. Der
  Dry-Run erzeugt keine Aufgabe, keine Mail, keine Datenänderung und keinen
  OpenAI-Aufruf.
- Freie Personenfragen wie `Was weißt du über Klaus Testmann?` besitzen eine
  sichere, deterministische Gesamtsicht. JARVIS ordnet erlaubte
  Kundenkontakte und Mitarbeitende eindeutig zu, fragt bei Mehrdeutigkeit nach
  und verbindet Kunden über stabile Kontakt-IDs mit Projekten, Angeboten,
  Rechnungen, erlaubten Aufgaben und der letzten Logbuchaktivität. Gelöschte
  oder stornierte Dokumente werden nicht als relevante Historie gezählt.
  Kunden-, Finanz-, Aufgaben- und Personaldetails bleiben rollengebunden;
  Emulation kann die Sicht nur einschränken. Mitarbeiterübersichten enthalten
  keine Lohnwerte, Personalakten oder Geheimnisse. Die Antwort benötigt keinen
  OpenAI-Aufruf und schreibt keine Daten.

## 1. Zielbild

JARVIS wird die gemeinsame, rollengerechte Assistenz- und Bedienebene von
WorkPilot360. Er soll:

- das aktuelle WorkPilot360-System fachlich und technisch belastbar kennen,
- freie Sprache und Umgangssprache verstehen,
- den aktuellen UI- und Datensatzkontext berücksichtigen,
- Bedienfragen konkret und ohne erfundene Schritte beantworten,
- erlaubte Live-Daten erklären und zusammenfassen,
- Arbeitsschritte vorbereiten und kontrolliert ausführen,
- Vertrieb und Geschäftsführung bei Analyse und Priorisierung unterstützen,
- immer dieselben Rollen-, Mandanten- und Datenschutzregeln wie WorkPilot360
  einhalten,
- Tokenverbrauch und Betriebskosten transparent und begrenzt halten.

JARVIS ist nicht die Quelle für Systemzustände, Berechnungen oder
Berechtigungen. WorkPilot360 bleibt die führende und ausführende Instanz. Die
KI versteht, verbindet, priorisiert und formuliert.

## 2. Verbindliche Sicherheitsgrundsätze

1. Der Benutzer wird ausschließlich aus der echten serverseitigen Sitzung
   bestimmt. Eine mitgesendete `actorId` oder Rolle ist niemals allein
   vertrauenswürdig.
2. Jede Datenabfrage und Aktion wird serverseitig erneut auf Rolle, Mandant,
   Datensatz und konkretes Recht geprüft.
3. JARVIS erhält nur die Daten, die für die aktuelle Frage erforderlich und
   für den Benutzer freigegeben sind.
4. Keine ungefilterten Datenbanktabellen, vollständigen Personallisten,
   Geheimnisse oder `.env`-Inhalte an ein KI-Modell übertragen.
5. Passwörter, Passwort-Hashes, API-Schlüssel, Sitzungstoken, OAuth-Secrets,
   private Schlüssel und technische Zugangsdaten sind für alle Rollen
   einschließlich Geschäftsführung gesperrt.
6. Lohn-, Gehalts-, Kosten- und persönliche Personaldaten werden nur geladen,
   wenn die echte Rolle und die bestehende WorkPilot-Berechtigung dies erlauben.
7. Eine geprüfte Systemantwort darf niemals durch eine freie Modellantwort
   widersprochen oder ersetzt werden.
8. Schreibende Aktionen verwenden ausschließlich geprüfte WorkPilot-Services
   und APIs, niemals direkten KI-generierten SQL-Zugriff.
9. Kritische Aktionen benötigen Vorschau, Bestätigung, Doppelausführungsschutz
   und Audit-Historie.
10. Löschungen sind bevorzugt reversibel. Harte Löschungen bleiben eng
    begrenzt und besonders geschützt.
11. Fehler dürfen keine halbfertigen oder widersprüchlichen Datensätze
    hinterlassen. Wo mehrere Änderungen zusammengehören, ist eine
    Datenbanktransaktion erforderlich.
12. Automationen ohne Einzelbestätigung dürfen nur auf vorher ausdrücklich
    freigegebenen, eng begrenzten Regeln beruhen.

## 3. JARVIS-Modi

### 3.1 Systemhilfe

- Bedienung aller erlaubten WorkPilot-Bereiche erklären.
- Aktuellen UI-Kontext berücksichtigen, aber die Nutzerabsicht priorisieren.
- Projektart, Abrechnungsmodell, Projektmonat und Rolle berücksichtigen.
- Bei fehlenden Angaben gezielt nachfragen.
- Keine Abläufe, Reiter, Felder oder Schaltflächen erfinden.
- Bekannte, freigegebene Abläufe möglichst deterministisch beantworten.

### 3.2 Vertrieb

- offene Angebote, Nachfasspunkte und Verkaufschancen priorisieren,
- betrachtete, aber nicht angenommene Angebote erkennen,
- Abschlussquote, Verlustgründe und Kundenbewegungen erklären,
- Dauerläufer mit Nachverhandlungsbedarf bewerten,
- nächste Vertriebsaktionen vorschlagen und vorbereiten,
- ausschließlich rollen- und verantwortungsbezogene Daten verwenden.

### 3.3 BWL und Unternehmenssteuerung

- Umsatz, Marge, Liquidität, offene Posten, Projektfluss, Kapazität und
  Datenqualität zusammenführen,
- Ursachen, Zusammenhänge und Wachstumsbremsen erklären,
- Szenarien und Handlungsmöglichkeiten darstellen,
- Ergebnisse in konkrete Aufgaben oder Prüfaufträge überführen,
- sensible Kennzahlen nur für berechtigte Rollen bereitstellen.

## 4. Wo KI eingesetzt wird

KI wird gezielt eingesetzt für:

- freie Sprache und Umgangssprache verstehen,
- Absicht, Fachobjekte, Zeitraum und gewünschte Aktion erkennen,
- mehrteilige Fragen strukturieren,
- fehlenden Kontext erkennen und Rückfragen formulieren,
- komplexe Systeminformationen verständlich erklären,
- Vertriebs- und BWL-Zusammenhänge analysieren,
- Prioritäten und mögliche nächste Schritte begründen,
- individuelle E-Mail-, Aufgaben- und Beschreibungstexte formulieren,
- einen natürlich fortlaufenden Dialog führen.

Keine KI ist erforderlich für:

- Navigation und Öffnen vorhandener Ansichten,
- Rollen-, Mandanten- und Rechteprüfung,
- Datenbankabfragen über freigegebene Adapter,
- Zahlen, Summen, Margen, Fristen und Statusberechnungen,
- Validierung und Pflichtfeldprüfung,
- Speichern, Fakturieren, Stornieren und Mailversand,
- Automationszeitpläne und Deduplizierung,
- Audit-Historien und Wiederherstellung,
- exakt bekannte Bedienfragen mit freigegebener Antwort.

## 5. Zielarchitektur

### 5.1 Identitäts- und Rollenebene

- Sessiongebundenen Benutzer laden.
- Aktive Organisation und Rolle bestimmen.
- Bestehende zentrale WorkPilot-Berechtigungen wiederverwenden.
- Team-, Verantwortungs- und Eigendatenscope berücksichtigen.
- Keine eigene parallele JARVIS-Rollenmatrix mit abweichenden Regeln schaffen.

### 5.2 Intent-Router

Der Router erkennt:

- Modus: Systemhilfe, Vertrieb oder BWL,
- Frage, Suche, Navigation, Analyse oder Aktion,
- betroffene Fachobjekte,
- erforderlichen Zeitraum,
- aktuellen UI-Kontext,
- mögliche Risikostufe,
- fehlende Pflichtinformationen.

Eindeutige häufige Absichten werden lokal/deterministisch erkannt. Nur
mehrdeutige oder komplexe Fragen benötigen einen KI-Aufruf.

### 5.3 Wissens-Retrieval

- Strukturierte, versionierte Wissenseinträge statt langer unstrukturierter
  Gesamtprompts.
- Suche zunächst per Schlüsselwort, Synonym, Modul, Oberfläche und Kontext.
- Optional später semantische Suche für natürliche Formulierungen.
- Nur wenige relevante Einträge in den Modellkontext aufnehmen.
- Häufige Antworten cachen.

### 5.4 Sichere Live-Datenadapter

Jeder Adapter liefert nur eine freigegebene, schmale Sicht, zum Beispiel:

- Projektzusammenfassung,
- Kundenstatus,
- Angebotsstatus,
- Rechnungs- und OP-Status,
- Planungs- und Kapazitätsstatus,
- Aufgabenübersicht,
- Vertriebsaktionsliste,
- Management-KPI-Zusammenfassung.

Kein Adapter gibt vollständige Rohdatensätze oder unnötige personenbezogene
Felder aus.

### 5.5 Action Registry

Jede JARVIS-Aktion wird zentral registriert mit:

- eindeutiger Action-ID,
- Beschreibung und erlaubten Formulierungen,
- benötigten Eingaben,
- erlaubten Rollen/Berechtigungen,
- Team-/Eigentümer-/Mandantenscope,
- Risikostufe,
- Validierungsfunktion,
- Vorschaufunktion,
- Ausführungsfunktion,
- Idempotency-Key,
- Audit-Ereignis,
- Refresh-/Navigationsergebnis,
- möglicher Wiederherstellungsaktion.

### 5.6 Antwortprüfung

Vor der Ausgabe wird geprüft:

- Widerspricht die Antwort dem freigegebenen Systemwissen?
- Enthält sie erfundene Funktionen?
- Enthält sie Daten außerhalb des erlaubten Scopes?
- Behauptet sie eine nicht ausgeführte Aktion?
- Stimmen Zahlen und Status mit dem strukturierten Kontext überein?
- Benötigt die Aktion eine Bestätigung?

Bei Unsicherheit wird die geprüfte Standardantwort oder eine sichere Rückfrage
verwendet.

## 6. Wissensbasis

Jeder Wissenseintrag enthält mindestens:

- ID, Modul und Unterbereich,
- Titel und Nutzerabsichten,
- Synonyme und typische Umgangssprache,
- Voraussetzungen,
- genaue Arbeitsschritte,
- Projektart-/Abrechnungsvarianten,
- Rollen- und Datenschutzanforderungen,
- typische Fehler und Warnungen,
- passende Rückfragen,
- mögliche Sprungziele,
- verbundene Wissenseinträge,
- fachliche Quelle,
- zuletzt geprüfter Commit und Prüfdatum.

Quellen:

- aktueller Anwendungscode,
- Navigation und sichtbare UI,
- API- und Serviceimplementierung,
- Berechtigungsmatrix,
- Tests,
- Prisma-Schema und Datenbeziehungen,
- aktuelle fachliche Entscheidungen aus `AGENTS.md` und Handoff-Dateien.

Historische Dokumentation wird nur übernommen, wenn sie noch mit dem aktuellen
Code und der aktuellen Fachentscheidung übereinstimmt.

## 7. Aktions- und Fähigkeitskatalog

### 7.1 Navigation und Suche

- erlaubte Hauptbereiche und Unterreiter öffnen,
- Kunden-, Projekt-, Aufgaben-, Angebots- und Rechnungsakten suchen,
- Projektmonat und Dokumentordner öffnen,
- passende Filter und Auswertungszeiträume einstellen,
- zwischen verbundenen Kunde-, Projekt-, Angebot- und Rechnungsdaten springen,
- zuletzt bearbeitete oder aktuell relevante Vorgänge anzeigen.

### 7.2 Projekte

- Projektanlage vorbereiten,
- Kunde, Arbeitsort, Projektart und Abrechnung zuordnen,
- Verantwortliche und Beteiligte vorschlagen,
- Projektstatus und nächste Voraussetzungen erklären,
- Statuswechsel vorbereiten und nach Bestätigung ausführen,
- Projektfortschritt und fehlende Nachweise zusammenfassen,
- Logbuch durchsuchen und Eintrag vorbereiten,
- Arbeitsunterbrechungen und Vormonatsprobleme erklären,
- Projektabschluss prüfen,
- Verkaufschance aus Projektkontext vorbereiten,
- Projekte archivieren oder berechtigt löschen.

### 7.3 Planung

- verfügbare Mitarbeitende und Kapazitäten finden,
- Abwesenheiten, Feiertage und bestehende Termine berücksichtigen,
- Termin oder Terminwunsch vorbereiten und speichern,
- Board, Gruppe, Mitarbeiter, Datum und Zeitraum vorbelegen,
- Gewerk, Abrechnungsleistung oder Angebot zuordnen,
- Serienplanung vorbereiten,
- Termine verschieben,
- Terminwünsche prüfen,
- Unter-, Voll- und Überplanung erklären,
- Restkontingente und früheste Planungsmöglichkeiten ermitteln.

### 7.4 Stempelungen und Zeiten

- aktive Stempelung anzeigen und passenden Projektkontext öffnen,
- manuelle Zeiteinträge vorbereiten und speichern,
- fehlende Angebots-, Gewerk- oder Abrechnungszuordnung erkennen,
- nicht fakturierte Zeiten suchen,
- Zeiten ohne Kostensatz oder mit auffälliger Dauer erklären,
- Korrekturen vorbereiten,
- fakturierte und offene Zeiten zusammenfassen.

Persönliches Starten, Pausieren und Stoppen einer Stempelung bleibt eine
bewusste Aktion der betroffenen Person.

### 7.5 Aufgaben

- Aufgaben anlegen und bearbeiten,
- Kunde, Projekt, Verantwortliche und Beteiligte zuordnen,
- Priorität und Deadline vorschlagen,
- Nachfass-, Übergabe- und Prüfaufgaben erstellen,
- Kommentare vorbereiten und speichern,
- Statuswechsel ausführen,
- überfällige Aufgaben priorisieren,
- doppelte Aufgaben erkennen,
- Tages- und Wochenlisten zusammenstellen,
- mehrere vorbereitete Aufgaben gesammelt bestätigen.

### 7.6 Kontakte und Kunden

- Kontakte und Ansprechpartner suchen,
- Firmen-, Privatkunden- und Ansprechpartneranlage vorbereiten,
- Ansprechpartner korrekt zuordnen,
- Rufnummern plausibilisieren,
- Dubletten anzeigen,
- Kundendaten und Arbeitsorte vervollständigen,
- offene Projekte, Angebote, Rechnungen und Hinweise zusammenfassen,
- Kundenlogbuch durchsuchen und Eintrag vorbereiten,
- Kundenstatus, Zahlungsstatus und KuZu-Auffälligkeiten erklären,
- Kontakte berechtigt deaktivieren oder löschen.

### 7.7 Angebote

- Angebote und Nachtragsangebote vorbereiten,
- Katalogpositionen, Leistungen und Pakete suchen,
- Mengen, Beschreibungen und Zuordnungen vorbelegen,
- Pflichtfelder, Ausführungsmonat und Kalkulationsbasis prüfen,
- Preise, Rabatte, Kosten und Marge rollengerecht erklären,
- Angebotsvorschau öffnen,
- Angebote vergleichen oder duplizieren,
- Nachfassaufgabe erzeugen,
- digitale Annahme vorbereiten,
- Angebot nach Bestätigung versenden,
- gewonnen/verloren setzen,
- Angebote berechtigt löschen oder wiederherstellen.

### 7.8 Rechnungen und Buchhaltung

- Rechnungsentwurf vorbereiten,
- abrechenbare Zeiten und Monatsentwürfe erkennen,
- Fakturavoraussetzungen und Nachweise prüfen,
- Positionen, Summen, Steuer und Zahlungsziel prüfen,
- Rechnung nach eindeutiger Vorschau fakturieren,
- offene Posten und Mahnfähigkeit prüfen,
- Mahnung vorbereiten und erzeugen,
- Rechnung als bezahlt markieren,
- Storno vorbereiten und transaktional ausführen,
- Rechnungsversand vorbereiten und bestätigen,
- Rechnungen berechtigt löschen oder wiederherstellen,
- Massenfaktura nur nach Dry-Run und Gesamtliste ausführen.

### 7.9 Dokumente, PDF und E-Mail

- Dokumente suchen und öffnen,
- Tätigkeitsberichte und Nachweise vorbereiten,
- passende Bilder und Anhänge auswählen,
- PDF-Vorschauen öffnen,
- Empfänger und persönliche Signatur ermitteln,
- Mailtext bei Bedarf formulieren,
- Mailvorlage ohne KI verwenden,
- Versandvorschau anzeigen,
- nach Bestätigung direkt versenden,
- Versandhistorie und Fehler erklären,
- Dokumente dem richtigen Projektmonat zuordnen,
- Dokumente berechtigt löschen oder verschieben.

### 7.10 Vertrieb und Verkaufschancen

- heutige Vertriebsaktionen priorisieren,
- alte offene oder betrachtete Angebote erkennen,
- Nachfassaufgaben vorbereiten und speichern,
- Verkaufschancen anlegen und bearbeiten,
- Wert, Verantwortliche und Projektbezug pflegen,
- Dauerläufer mit Nachverhandlungsbedarf erkennen,
- Abschlussquote und Verlustgründe erklären,
- Kunden ohne Aktivität oder mit Potenzial anzeigen,
- KuZu-Hot-Alerts erklären,
- Gesprächsvorbereitung und nächste Aktionen erstellen,
- mehrere Vertriebsaufgaben gesammelt vorbereiten.

### 7.11 Auswertungen und BWL

- Zeitraum und Filter setzen,
- passende Auswertung öffnen,
- Kennzahlen und Trends erklären,
- Umsatz, Marge, Liquidität, Kapazität und Projektfluss analysieren,
- Datenqualitätsprobleme erkennen,
- auffällige Projekte, Kunden und Rechnungen öffnen,
- Szenarien berechnen und vergleichen,
- Management-Zusammenfassungen erstellen,
- Handlungsempfehlungen als Aufgaben vorbereiten,
- Monatsberichte vorbereiten,
- Berichte und Arbeitslisten exportieren.

### 7.12 Mitarbeiter und Personal

- Mitarbeiter und Teams suchen,
- eigene bzw. berechtigte Planungs- und Abwesenheitsdaten anzeigen,
- Übergabeaufgaben vorbereiten,
- Planungseinstellungen öffnen,
- Teamaufgaben und Auslastung zusammenfassen,
- fehlende Kostensätze berechtigten Rollen anzeigen,
- Personal- und Lohndaten ausschließlich rollengerecht erklären,
- für Geschäftsführung berechtigte Personalstammdatenänderungen vorbereiten,
- Personaländerungen mit Vorher-/Nachhervergleich und Audit ausführen,
- Mitarbeiter deaktivieren,
- Rollen und Berechtigungen mit zusätzlicher Bestätigung ändern.

Passwörter und technische Secrets werden niemals angezeigt oder durch JARVIS
gesetzt.

### 7.13 Winterdienst

- Kalkulation vorbereiten,
- Varianten, Einsatzhäufigkeit, Salz- und Zeitannahmen erklären,
- bestehende Kundenpakete und Duplikate erkennen,
- Kalkulation Projekt und Angebot zuordnen,
- Paket- und Angebotsentwurf vorbereiten,
- Einsätze und fehlende Berichte prüfen,
- Monatsentwurf öffnen,
- Salzlager, Einkauf, Verkauf und Verbrauch analysieren.

### 7.14 Fahrzeuge, Fahrten und Vermietung

- Fahrzeug und Kraftstoffart auswählen,
- Fahrtkostenkalkulation vorbereiten,
- Livepreis oder manuellen Preis verwenden,
- Selbstkosten, Verkauf und Marge erklären,
- Kalkulation speichern oder öffnen,
- Fahrzeugstammdaten prüfen und berechtigt ändern,
- Mietangebot, Verfügbarkeit, Vertrag und Rückgabecheckliste vorbereiten,
- Mietaktionen erst nach Abschluss der fachlichen Mietlogik aktivieren.

### 7.15 Firmeneinstellungen

- passende Einstellung öffnen,
- aktuelle Konfiguration erklären,
- fehlende Werte erkennen,
- Status-, Frist- und Eskalationsregeln vorbereiten,
- Dry-Run-Ergebnisse erklären,
- Planungsgruppen-SVS und Mailvorlagen öffnen,
- Feiertage und Zeitfristen vorbereiten,
- globale Änderungen nur für berechtigte Rollen nach Vorher-/Nachhervergleich
  ausführen.

### 7.16 Massenänderungen

Jede Massenänderung benötigt:

- klare Filter-/Zieldefinition,
- rein lesenden Dry-Run,
- genaue Trefferzahl und Trefferliste,
- Ausschluss- und Fehlerliste,
- Vergleich der alten und neuen Werte,
- festes maximales Trefferlimit,
- Bestätigung durch eine berechtigte Rolle,
- Idempotency-Key,
- Transaktion oder kontrollierte Teilbatches,
- Audit und Wiederherstellungsplan.

### 7.17 Automationen ohne Einzelbestätigung

Zulässige Beispiele:

- Nachfassaufgaben nach Angebotsversand,
- Planungs- und Fristerinnerungen,
- Statuseskalationen,
- Dauerläufer-Stundenentwurf bei erster Monatsstempelung,
- Datenqualitätsprüfungen,
- geplante Berichte und Management-Zusammenfassungen.

Kritische Automationen wie Faktura, Storno, Löschen oder Rollenänderungen
benötigen eine vorher eingerichtete, eng begrenzte Unternehmensregel mit:

- zuständiger freigebender Rolle,
- Gültigkeitsbereich,
- Bedingungen und Ausschlüssen,
- Wert- und Mengenlimits,
- Dry-Run/Testmodus,
- Audit und Benachrichtigung,
- sofortigem Ausschalter,
- automatischem Stopp bei Abweichungen oder Fehlern.

Eine frei handelnde KI darf keine kritische Aktion selbstständig beschließen.

### 7.18 Proaktiver Vertriebs-, Projekt- und BWL-Analyst

JARVIS soll Chancen und Risiken nicht nur auf Nachfrage erklären, sondern in
einem festgelegten Turnus kontrolliert erkennen. Beispiele:

- Im Vorjahreszeitraum wurde beim Kunden dieselbe oder eine verwandte Leistung
  ausgeführt, aber aktuell gibt es noch keinen Folgekontakt oder Auftrag.
- Ähnliche Kunden erhielten im vergleichbaren Zeitraum eine passende Leistung.
- Ein Angebot wurde angesehen, aber noch nicht angenommen.
- Ein abgeschlossenes Projekt besitzt trotz sinnvoller Wiederholung noch keine
  Nachfassaufgabe.
- Bei Dauerläufern oder wiederkehrenden Projekten bestehen Hinweise auf
  Neuverhandlung, Cross-Selling, Kapazitäts- oder Margenbedarf.
- Projektverlauf, Aufgaben, Planung, Dokumentation und Abrechnung zeigen
  nachvollziehbare vertriebliche oder betriebswirtschaftliche Signale.
- Inaktive Kunden eignen sich anhand belastbarer Historie für Rückgewinnung.

Die Architektur bleibt bewusst zweistufig:

1. WorkPilot-Systemlogik ermittelt organisations- und rollengebunden mögliche
   Treffer, Zeiträume, Muster, Ausschlüsse, Limits, Turnus und
   Deduplizierung. Zahlen, Status und Datensätze werden niemals durch die KI
   erfunden.
2. Die KI verbindet ausschließlich die erlaubten Signale, priorisiert und
   erklärt sie, weist auf Unsicherheit hin und formuliert den nächsten
   sinnvollen Schritt.

Jede Empfehlung zeigt mindestens:

- Kunde und gegebenenfalls Projekt,
- Auslöser und überprüfbare Datenquelle,
- Datum der letzten Leistung oder Aktivität,
- empfohlene Aktion und Priorität,
- Unsicherheit oder fehlende Daten,
- bereits vorhandene Aufgabe, Wiedervorlage oder Kontaktaktivität zur
  Vermeidung von Dubletten.

Mögliche Ausgaben sind ein JARVIS-Cockpit, eine interne Systemmail an
Mitarbeitende, eine vorbereitete Nachfassaufgabe, Gesprächsleitfäden,
Kundenmailentwürfe und eine verdichtete Management-Zusammenfassung.

Für E-Mails gelten feste Grenzen:

- Interne Mails dürfen den Anzeigenamen `JARVIS` tragen. Technischer Absender
  bleibt ein freigegebenes Unternehmens-Systempostfach; Empfänger sind
  ausschließlich Mitarbeitende.
- Kundenmails werden nur mit Empfänger, Betreff, Text und Anhängen vorbereitet.
  Versand erfolgt erst nach sichtbarer Prüfung und ausdrücklicher Freigabe
  eines berechtigten Mitarbeiters über dessen freigegebenes Unternehmens- oder
  Personenkonto, niemals unter einer scheinbaren JARVIS-Identität.
- Vorschau, Freigabe, ausführende Person, Zeitpunkt, Empfänger, Ergebnis und
  Fehler werden auditierbar protokolliert.

Der Start erfolgt ausschließlich als Dry-Run für die Geschäftsführung.
Gemessen werden Empfehlungsqualität, Fehlalarme, Dubletten, Rollenumfang,
Mailhäufigkeit und Tokenverbrauch. Die KI entscheidet oder versendet niemals
eigenständig Kundenansprachen.

Umgesetzter erster Stand:

- dynamische Live-Abfrage statt statischer Kunden-/Projektliste,
- organisationsgebundene Auswahl bei jeder Anfrage,
- echte Geschäftsführungs-Sitzung als erste Freigabestufe,
- Signale aus Angebotsöffnung, Projektabschluss und Vorjahresrechnung,
- Unterdrückung erkennbarer aktiver Nachfassspuren,
- klickbare Projekt- und Angebotskarten mit Quelle und Datum,
- rein deterministischer Dry-Run ohne Tokenkosten und ohne Schreibzugriff.

Noch offen bleiben insbesondere fachlich feinere Leistungsähnlichkeit,
Kontaktaktivitäten über alle Kanäle, konfigurierbarer Turnus, gespeicherte
Empfehlungshistorie, Cockpit, interne JARVIS-Mail, Aufgabenentwurf und
kontrollierter Kundenmailentwurf.

## 8. Risikostufen und Bestätigung

### Stufe 1: Lesen und Navigieren

- keine Datenänderung,
- sofort erlaubt, sofern Benutzer den Inhalt sehen darf.

### Stufe 2: Vorbereiten

- JARVIS befüllt vorhandene Maske oder Entwurf,
- Nutzer sieht alle Eingaben vor dem Speichern.

### Stufe 3: Kontrolliert schreiben

- klare Vorschau,
- einfache bewusste Bestätigung,
- Audit und Idempotency-Schutz.

### Stufe 4: Kritisch

- Faktura, Storno, Löschen, Mailversand, Rechte-, Personal- und
  Massenänderungen,
- zusätzliche Zusammenfassung der Folgen,
- erneute serverseitige Rechteprüfung,
- eindeutige Bestätigung,
- bei Bedarf Re-Authentifizierung oder Pflichtbegründung,
- Wiederherstellungs-/Rollback-Konzept.

## 9. Mitarbeitende im JARVIS-Dialog

Alle aktiven Mitarbeitenden dürfen mit JARVIS sprechen. Ihr Dialog ist
rollengerecht und kann besonders für folgende Themen genutzt werden:

- eigene Aufgaben und Prioritäten,
- eigene Planung und heutige Termine,
- erlaubte Projektinformationen,
- Stempelungs- und Zeiterfassungsfragen,
- Systembedienung,
- eigene Abwesenheiten und Übergaben,
- erlaubte Kunden-/Projektaktionen,
- Nachfragen zu Warnungen und nächsten Arbeitsschritten.

Normale Mitarbeitende sehen keine:

- fremden Lohn-, Gehalts- oder Kostendaten,
- Geschäftsführungs- oder Gesamtunternehmenskennzahlen,
- fremden Personalakten,
- nicht freigegebenen Kunden-, Projekt- oder Mitarbeiterdaten,
- administrativen Einstellungen oder technischen Geheimnisse.

Der Rollenfilter läuft vor jeder Wissens- und Datenbereitstellung und erneut
vor jeder Aktion.

## 10. Token- und Kostenstrategie

### 10.1 Kein KI-Aufruf

Kein OpenAI-Aufruf bei:

- bekannten, freigegebenen Bedienfragen,
- Navigation und Suche mit eindeutigen Filtern,
- Ausführen bereits strukturierter Aktionen,
- Validierung, Berechnung und Rechteprüfung,
- Scheduler- und Automationsläufen,
- Öffnen vorhandener Datensätze und Ansichten.

### 10.2 Kleiner KI-Aufruf

Ein kompakter Aufruf bei:

- freier oder mehrdeutiger Formulierung,
- Erkennung mehrteiliger Nutzerabsichten,
- Formulieren kurzer Aufgaben-, Beschreibungs- oder E-Mail-Texte,
- Rückfragen bei fehlenden Angaben.

### 10.3 Leistungsfähiger KI-Aufruf

Nur gezielt bei:

- komplexer BWL-Analyse,
- Vertriebsanalyse über mehrere Signale,
- Szenarien und Ursachenketten,
- umfangreicher Management-Zusammenfassung.

### 10.4 Kostenbremsen

- kein KI-Aufruf pro Tastendruck, Seitenwechsel oder Polling,
- nur wenige relevante Wissens- und Datenblöcke senden,
- kurze strukturierte Prompts und begrenzte Antwortlänge,
- bekannte Fragen und Antworten cachen,
- Dialoghistorie kompakt zusammenfassen,
- günstigeres Modell für Intent und Textformulierung,
- stärkeres Modell nur für freigegebene komplexe Analysen,
- Nutzer-, Rollen- und Organisationsbudgets,
- Tages-/Monatslimits und Warnschwellen,
- Kosten- und Aufrufübersicht für Geschäftsführung,
- sichere deterministische Antwort bei erreichtem Budget.

Mitarbeiterdialoge sind deshalb gut skalierbar. Die meisten täglichen Fragen
und Aktionen verursachen keinen oder nur einen sehr kleinen KI-Aufruf.

## 11. Dialog- und UI-Konzept

- JARVIS bleibt globaler Slide-out mit den Modi Systemhilfe, Vertrieb und BWL.
- Aktueller Bereich und Datensatzkontext werden sichtbar angezeigt.
- JARVIS zeigt bei Aktionen klar:
  - Verstanden,
  - Benötigte Angaben,
  - Vorschau,
  - Warnungen,
  - Ausführen/Abbrechen,
  - Ergebnis.
- Schreibende Aktionen besitzen keine versteckten Chatbefehle.
- Kritische Bestätigungen verwenden eigene WorkPilot-Modale oder klar
  abgegrenzte Bestätigungskarten.
- Nach erfolgreicher Aktion werden betroffene UI-Daten gezielt neu geladen.
- Jede Antwort kann passende sichere Sprungaktionen enthalten.
- Unbekannte Fragen können als Wissenslücke markiert werden, ohne sensible
  Inhalte unkontrolliert zu protokollieren.

### 11.1 Sprachmodus wie bei Siri

Mitarbeitende sollen mit JARVIS sprechen und eine gesprochene Antwort erhalten
können. Der Sprachmodus umfasst:

- Mikrofonbutton im JARVIS-Panel,
- Push-to-talk als sicherer und kostengünstiger Standard,
- sichtbare Anzeige, wenn das Mikrofon aktiv ist,
- automatische Erkennung von Sprechbeginn und Sprechende,
- Live-Transkript der verstandenen Frage,
- Möglichkeit, das Transkript vor einer kritischen Aktion zu prüfen,
- gestreamte gesprochene JARVIS-Antwort,
- JARVIS während der Antwort unterbrechen können,
- zwischen Text- und Spracheingabe wechseln,
- Antwort stummschalten oder erneut vorlesen,
- Auswahl einer geeigneten JARVIS-Stimme,
- Geräte- und Mikrofonwahl,
- klare Behandlung fehlender Mikrofonberechtigung,
- keine dauerhafte Speicherung von Roh-Audio im normalen Betrieb.

Empfohlene Betriebsarten:

1. `Standard Sprache`: Mikrofon nur während eines bewussten Tastendrucks bzw.
   einer aktiven Spracheingabe öffnen. Sprache wird in Text umgewandelt, danach
   arbeitet derselbe sichere JARVIS-Router wie bei Texteingaben. Die Antwort
   wird anschließend vorgelesen. Bekannte Systemfragen und Aktionen bleiben
   deterministisch und benötigen kein großes Sprachmodell.
2. `Live-Gespräch`: Eine bewusst gestartete Realtime-Sitzung ermöglicht
   natürliches Hin-und-her-Sprechen, automatische Sprecherwechsel und
   Unterbrechungen. Dieser Modus wird nur geöffnet, solange der Nutzer wirklich
   mit JARVIS spricht.
3. `Aktivierungswort später`: Ein lokales Aktivierungswort wie
   `Hallo JARVIS` ist erst nach separater Datenschutz-, Browser-/PWA- und
   Betriebsprüfung vorgesehen. Die Erkennung muss möglichst lokal auf dem
   Gerät erfolgen, damit nicht dauerhaft Raum-Audio an einen externen Dienst
   übertragen wird.

Sicherheitsregeln für Sprache:

- Mikrofon niemals ohne sichtbare aktive Anzeige verwenden.
- Kritische Aktionen nicht allein aufgrund eines möglicherweise falsch
  verstandenen Sprachsatzes ausführen.
- Faktura, Storno, Löschen, Mailversand, Rechte-, Personal- und
  Massenänderungen benötigen eine sichtbare strukturierte Vorschau und
  Bestätigung.
- Rollen- und Datenschutzprüfung erfolgt nach der Transkription genauso wie bei
  Texteingaben.
- Roh-Audio standardmäßig nicht im JARVIS-Chat, Logbuch oder Audit speichern.
- Im Audit wird die bestätigte strukturierte Aktion dokumentiert, nicht eine
  unnötige Audioaufnahme.
- Persönliche oder sensible Antworten dürfen nicht ungefragt laut vorgelesen
  werden; bei sensiblen Inhalten ist eine Kopfhörer-/Privatsphäre-Warnung oder
  reine Textausgabe vorzusehen.

Kostensteuerung für Sprache:

- Realtime-Sitzung nur während aktivem Sprachmodus offen halten.
- Keine dauerhafte Audioübertragung im Hintergrund.
- Pausen und Stille automatisch erkennen und nicht unnötig verarbeiten.
- Eindeutige bekannte Befehle nach der Transkription ohne großen Modellaufruf
  ausführen.
- Kurze Antworten für Sprache verwenden; Details bleiben zusätzlich im Text.
- Optional Browser-/Geräte-Sprachausgabe für einfache Standardantworten nutzen.
- Hochwertige KI-Sprachausgabe und Realtime nur bei aktiv gewähltem Modus.
- separates Audio-Nutzungsbudget und Warnschwellen pro Organisation vorsehen.

## 12. Entwicklungsphasen

### Phase 0: Bereits erledigte Sofortabsicherung

- geprüfte Systemantworten deterministisch ausgeben,
- Modell darf freigegebene Antwort nicht mehr überschreiben,
- exakte Planungsfrage als Regressionstest.

### Phase 1: JARVIS-Sicherheitskern

- sessiongebundene Identität,
- zentrale Rollen-/Permission-Anbindung,
- Datenklassifizierung,
- Risikostufen,
- Action Registry Grundgerüst,
- Vorschau-/Bestätigungsprotokoll,
- Idempotency- und Audit-Grundlage,
- Tokenmessung und Budgetgrenzen,
- Sicherheits- und Rollentests.

Abnahmekriterium: Kein Wissen, keine Datenabfrage und keine Aktion kann den
normalen WorkPilot-Rechtescope erweitern.

### Phase 2: Vollständige Systemlandkarte

- alle Navigationseinträge, Reiter und Modale erfassen,
- alle Kernabläufe und Projektvarianten dokumentieren,
- Wissenslückenmatrix aufbauen,
- Wissenseinträge mit Commit/Prüfstatus versionieren,
- Tests für Absicht, Kontext und korrekte Rückfragen.

Abnahmekriterium: Jeder produktive sichtbare WorkPilot-Bereich ist mindestens
mit Navigation, Zweck, Rollen und Kernabläufen erfasst.

### Phase 3: Navigation, Suche und sichere Lesefunktionen

- globale Suche,
- Datensatzauflösung,
- Kontextsprünge,
- rollenberechtigte Zusammenfassungsadapter,
- Filter- und Zeitraumsteuerung,
- Projekt-, Kunden-, Aufgaben-, Angebots- und Rechnungszusammenfassungen.

Abnahmekriterium: JARVIS kann erlaubte Datensätze zuverlässig finden, öffnen
und erklären, ohne schreibende Änderungen vorzunehmen.

### Phase 3b: Spracheingabe und Sprachausgabe

- Mikrofon- und Berechtigungsoberfläche,
- Push-to-talk,
- Sprechbeginn-/Sprechende-Erkennung,
- Transkript und Korrekturmöglichkeit,
- gesprochene Antwort,
- Unterbrechen und Stummschalten,
- Text-/Sprachwechsel,
- keine Roh-Audio-Persistenz,
- Audio-Kostenmessung und Sitzungsgrenzen,
- Rollen- und Sicherheitstests für gesprochene Befehle,
- Realtime-Live-Gespräch nach erfolgreichem Standard-Sprachmodus.

Abnahmekriterium: Nutzer können eine Systemfrage vollständig sprechen und eine
gesprochene Antwort erhalten. Schreibende und kritische Sprachbefehle verwenden
dieselben Vorschau- und Bestätigungsregeln wie Texteingaben.

### Phase 4: Starkes Action Center 1.0

- Aufgaben und Nachfassaufgaben,
- Termine und Terminwünsche,
- manuelle Zeiteinträge,
- Logbuch- und Kommentaraktionen,
- Angebote/Nachträge als Entwurf,
- Rechnungsentwurf und Fakturavorprüfung,
- Dokument-/Mailvorbereitung,
- Vertriebsaktionslisten in Aufgaben überführen,
- UI-Refresh, Audit und Fehlerbehandlung.

Abnahmekriterium: Die häufigsten täglichen Arbeitsvorgänge lassen sich aus dem
Chat vollständig vorbereiten und kontrolliert speichern.

### Phase 5: Kritische Aktionen

- direkter Mailversand nach Vorschau,
- Fakturieren,
- Mahnung und Bezahlt-Markierung,
- Stornieren,
- Archivieren/Löschen/Wiederherstellen,
- Rollen- und Rechteänderungen,
- berechtigte Personalstammdatenänderungen,
- Massenänderungen mit Dry-Run und Rollback.

Abnahmekriterium: Jede kritische Aktion besitzt dieselben oder stärkere
Sicherheitskontrollen wie die normale UI.

### Phase 6: Vertrieb und BWL

- sichere Vertriebs- und Managementadapter,
- verbundene Kunden-, Projekt-, Angebots-, Rechnungs- und Leistungsansichten,
- historische Wiederholungs-, Nachfass- und Cross-Selling-Signale,
- regelmäßiger Chancen- und Projektrisiko-Check zunächst im Dry-Run,
- JARVIS-Cockpit und interne Hinweise an berechtigte Mitarbeitende,
- Aufgaben und Kundenmailentwürfe mit verpflichtender menschlicher Prüfung,
- priorisierte Vertriebsaktionen,
- Ursachen- und Trendanalysen,
- Szenarien,
- Handlungsempfehlungen,
- Aufgabenübergabe aus Analysen,
- Modellrouting nach Komplexität und Budget.

### Phase 7: Fachmodule

- Winterdienst vollständig,
- Fahrzeuge und Fahrten,
- Vermietung nach fachlicher Freigabe,
- Dokumente, Checklisten und Tätigkeitsberichte,
- Personal-, Planungs- und Einstellungstiefe.

### Phase 8: Freigegebene Automationen

- Regelverwaltung,
- Dry-Run,
- Scheduler,
- Limits und Kill-Switch,
- Ausführungsprotokoll,
- Benachrichtigungen,
- zunächst nichtkritische, später ausdrücklich freigegebene kritische Regeln.

## 13. Testmatrix

Für jede Wissensfunktion und Aktion:

- Rollen: Geschäftsführung, Admin, Führungskraft, Buchhaltung, Vertrieb,
  Mitarbeiter, Gast,
- Scope: eigener Datensatz, eigenes Team, fremdes Team, anderer Mandant,
- Kontext: richtiger Reiter, falscher Reiter, kein Datensatz, anderer Monat,
- Eingabe: eindeutig, umgangssprachlich, mehrdeutig, unvollständig,
- Datenschutz: Lohn, Personal, Kontakt, Kunde, Finanzdaten, Secrets,
- Aktion: Vorschau, Abbruch, Bestätigung, Doppelklick, Wiederholung,
- Fehler: API-Fehler, Teilfehler, veralteter Datensatz, fehlende Berechtigung,
- Audit: ausführender Benutzer, Zeitpunkt, Vorher/Nachher, Ergebnis,
- UI: sofortige Aktualisierung ohne Browserreload,
- Token: kein unnötiger Modellaufruf, Budgetlimit und Fallback.
- Sprache: Mikrofonstatus, Transkript, Unterbrechung, Stille, Audio-Budget,
  keine unbeabsichtigte Ausführung bei Transkriptionsfehlern.

## 14. Checks je Entwicklungspaket

Vor größeren Änderungen:

- getrackten und ungetrackten Status prüfen,
- betroffene Dateien und vorhandene Logik vollständig lesen,
- Sicherungen unter `.codex-safety` anlegen,
- Vorher-Diff und betroffene Funktionsmarker sichern.

Nach Änderungen mindestens:

- gezielte Unit-/Rollen-/Sicherheitstests,
- vollständige Testsuite,
- TypeScript,
- Regression,
- Mojibake,
- `git diff --check`,
- Prisma validate,
- Prisma-Live-Diff bei Schema-/Datenmodellbezug,
- Produktions-Build,
- echte Browser-/API-Klickprüfung proportional zum Risiko,
- Vorher-/Nachhervergleich von Funktionen, Feldern und Daten,
- erst danach Commit, Push und auf ausdrücklichen Auftrag Deploy.

## 15. Betriebs- und Rolloutkonzept

- neue Aktionsgruppen über Feature-Flags aktivieren,
- zunächst Geschäftsführung/Testbenutzer,
- danach ausgewählte Rollen,
- anschließend organisationsweit,
- kritische Aktionen separat freischalten,
- Automationen standardmäßig im Dry-Run,
- Fehler-, Kosten- und Nutzungsauswertung,
- schneller Kill-Switch für JARVIS-Aktionen,
- normale WorkPilot-Bedienung bleibt unabhängig von JARVIS vollständig
  funktionsfähig.

## 16. Nicht vergessen / offene Fachentscheidungen

- exakte bestehende Permission-Matrix je Aktion prüfen, nicht vermuten,
- festlegen, welche Personaländerungen Re-Authentifizierung benötigen,
- Aufbewahrungsdauer für JARVIS-Audit und Dialogkontext,
- UI für Massenänderungs-Dry-Runs,
- Grenzwerte und Freigaben für kritische Automationen,
- Kostenbudget und bevorzugte Modelle pro Modus,
- Turnus, Rückblickzeitraum und Mindestkonfidenz für Chancenprüfungen,
- interne Empfängergruppen und maximale Häufigkeit für JARVIS-Hinweise,
- fachliche Trennung wiederkehrender Leistungen von einmaligen Vorjahresfällen,
- Freigaberollen und Absenderkonto je Art einer externen Kundenmail,
- Deduplizierungszeitraum für Empfehlungen, Aufgaben und Kontaktversuche,
- fachlichen Ausbau des Mietmoduls vor JARVIS-Mietaktionen abschließen,
- Wissenspflege bei jeder neuen/änderten WorkPilot-Funktion verpflichtend
  machen,
- Wissensabdeckungsbericht in Regression/CI integrieren.

## 17. Definition „JARVIS kennt das System“

Das Ziel gilt als erreicht, wenn:

- jeder produktive Bereich in der Systemlandkarte enthalten ist,
- alle wesentlichen Arbeitsabläufe mit Varianten dokumentiert sind,
- JARVIS bekannte Fragen ohne erfundene Schritte beantwortet,
- unbekannte oder mehrdeutige Fragen sicher behandelt werden,
- Rollen- und Datenschutztests vollständig bestehen,
- aktuelle Daten ausschließlich über freigegebene Adapter einfließen,
- Aktionen nachvollziehbar, idempotent und sicher ausgeführt werden,
- Wissenslücken sichtbar gemessen und laufend geschlossen werden,
- neue WorkPilot-Funktionen ohne zugehörige JARVIS-Prüfung nicht als
  vollständig abgeschlossen gelten.
