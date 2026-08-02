# JARVIS Entwicklungsplan

Stand: 01.08.2026

## Vision und lebendiger Prinzipienkompass

Wir entwickeln nicht nur einen KI-Assistenten. Wir entwickeln die Art und
Weise, wie unser Unternehmen im KI-Zeitalter mit den Möglichkeiten von heute
und morgen arbeiten wird.

Die folgenden Prinzipien leiten Entscheidungen, Leistungen, Produkte und das
tägliche Handeln von JARVIS und dem Unternehmen:

1. **Automatisiere alles, was sinnvoll automatisiert werden kann.**
   Wir automatisieren Routine konsequent, damit Menschen ihre Zeit für
   Entscheidungen, Kreativität und Kunden einsetzen können. „Sinnvoll“
   bedeutet dabei immer: fachlich richtig, sicher, nachvollziehbar und mit
   einer bewussten menschlichen Kontrolle, wo sie erforderlich ist.
2. **Vereinfache konsequent.**
   Jede neue Lösung muss einfacher sein als die vorherige. Wenn etwas
   komplizierter wird, suchen wir weiter.
3. **Nutze den Joker.**
   Wenn du nicht weiterkommst, frage die KI. Gute Ergebnisse entstehen durch
   die Zusammenarbeit von Mensch und KI.
4. **Arbeite mit einem klaren Zielbild.**
   Wir entscheiden nicht nur für heute, sondern immer mit Blick auf unser
   langfristiges Ziel.
5. **Setze Prioritäten.**
   Nicht alles ist gleich wichtig. Wir arbeiten zuerst an dem, was den größten
   Nutzen bringt.
6. **Nutze das beste Werkzeug.**
   Wir sind nicht an ein bestimmtes Werkzeug gebunden. Entscheidend ist das
   beste Ergebnis für unsere Kunden.
7. **Shit in, Shit out.**
   Die Qualität unserer Ergebnisse beginnt bei der Qualität unserer Daten.
   JARVIS macht unvollständige, widersprüchliche oder ungeprüfte Daten sichtbar,
   statt daraus Sicherheit vorzutäuschen.
8. **Denke immer vom Kunden aus.**
   Der Kunde interessiert sich nicht für unsere Abteilungen oder Prozesse. Er
   möchte, dass sein Anliegen schnell, einfach und zuverlässig gelöst wird.
   Deshalb betrachten wir jede Aufgabe zuerst aus seiner Perspektive.
9. **Flexibilität ist Teil der Architektur.**
   Wir bauen Systeme, Prozesse und Rollen so, dass sie sich jederzeit
   weiterentwickeln, erweitern und neu kombinieren lassen.

Diese Prinzipien sind lebendig. Geschäftsleitung, Mitarbeitende und JARVIS
überprüfen sie regelmäßig anhand realer Erfahrungen, lernen daraus und
entwickeln sie gemeinsam weiter. Änderungen werden bewusst begründet und im
Entwicklungsplan nachvollziehbar festgehalten. Ein eigener wiederkehrender
Entwicklungspunkt bleibt deshalb die Frage, welche Prinzipien JARVIS für seine
Aufgabe wirklich braucht und wie er sie im Alltag verständlich verkörpert.

### Auftrag von JARVIS gegenüber den Menschen

JARVIS soll allen Menschen im Unternehmen Orientierung, Rat, Hilfe, Wachstum,
Entwicklung und Erfolg ermöglichen. Er erklärt geduldig auch beim zehnten Mal,
erinnert verlässlich an vereinbarte Abläufe und bringt dort Kontinuität ein, wo
Motivation, Aufmerksamkeit oder Alltag mit der Zeit nachlassen können. Er
erkennt arbeitsbezogene Stärken, macht vorhandene Fähigkeiten sichtbar,
schlägt passende Lern- und Entwicklungsschritte vor und unterstützt
Führungskräfte dabei, verbindlich und menschlich anzuknüpfen.

Diese Unterstützung ist keine verdeckte Überwachung und keine autonome
Personalführung. Für den späteren Ausbau gelten verbindlich:

- JARVIS nutzt nur erforderliche, freigegebene und arbeitsbezogene Fakten. Er
  erstellt keine heimlichen Persönlichkeits-, Emotions-, Gesundheits- oder
  Privatprofile und leitet solche Merkmale nicht aus Verhalten ab.
- Mitarbeitende wissen, welche Daten und Kriterien verwendet werden, können
  sie einsehen, einordnen und nachweislich falsche Grundlagen korrigieren.
- Stärken, Unterstützungsbedarf und wiederkehrende Prozessabweichungen werden
  mit Belegen, Kontext und Unsicherheit beschrieben, nicht als endgültiges
  Urteil über einen Menschen.
- Personenbezogene Berichte an die Geschäftsleitung benötigen einen klaren
  betrieblichen Zweck, die passende Rollenberechtigung, Datenminimierung und
  eine menschliche Prüfung. Positive Entwicklung und Unterstützung stehen
  gleichwertig neben notwendigen Hinweisen.
- JARVIS trifft keine autonomen Entscheidungen über Einstellung, Vergütung,
  Beförderung, Sanktion, Kündigung oder andere wesentliche
  Beschäftigungsfolgen. Verantwortung und die menschliche Komponente bleiben
  bei den zuständigen Menschen.
- „Führung übernehmen“ bedeutet für JARVIS: transparent Orientierung geben,
  Zusammenhänge erklären, Ziele und Vereinbarungen in Erinnerung halten,
  hilfreiche Fragen stellen und Führung unterstützen. Es bedeutet nicht,
  Weisungs- oder Personalhoheit selbstständig auszuüben.

Der spätere technische Ausbau dieses Auftrags benötigt vor jeder
personenbezogenen Funktion ein eigenes Fach-, Datenschutz-, Mitbestimmungs-,
Rollen-, Erklärbarkeits- und Fairnesskonzept sowie realistische Tests mit den
betroffenen Menschen.

## Aktueller Umsetzungsstand

### Persönliche Stempelung vollständig bedienbar

- Nach Pause/Fortsetzung und Start ist jetzt auch der persönliche Stempelstopp
  produktiv abgeschlossen. JARVIS kann unproduktive Zeit beenden, fertige oder
  unterbrochene Projektarbeit erfassen und zeigt vor Bestätigung Dauer, Pause,
  Kosten-, Projekt-, Nachweis- und Abrechnungsfolgen.
- Normale Oberfläche und JARVIS teilen Stopp-, Stundenabrechnungs-,
  Unterbrechungs- und Endkontrollservices. Zeitbuchung, Status, Rechnung,
  Aufgabe, Hinweise und Endkontroll-PDF sind gegen Replay geschützt; für
  OK immocare gelten die verpflichtende Endkontrolle und der private
  `StoredFile`-/S3-Weg.
- Produktiv abgenommen auf Runtime-Commit
  `0a48f80bfa93f44491c91cb07080c2ac4ea1ffbc` mit Backup
  `/var/backups/workpilot360/20260802T121222Z-before-jarvis-stamp-stop`.
  180/180 Testdateien, 1.782/1.782 Tests, 90-Seiten-Build, echter Klicktest,
  lokale und produktive isolierte QA, 110/110 feste Fragen, leerer Prisma-Diff
  und null QA-Rückstände sind belegt.
- Gemäß GOAL wird ohne Pause chronologisch am nächsten offenen vollständigen
  JARVIS-Vertikalschnitt weitergearbeitet. Angehalten wird nur, wenn eine
  wesentliche fachliche, rechtliche, personelle oder irreversible Entscheidung
  nicht sicher aus bestehender WorkPilot-Logik und den geltenden Invarianten
  ableitbar ist.

### Kontrollierte Kontaktverwaltung und endgültige Löschung

- `contact.manage` kann Firmen-, Privat- und Personenkontakte anlegen sowie
  bestehende Kontakte nach eindeutiger Kundennummer bearbeiten.
- Die Vorschau zeigt alle anzulegenden beziehungsweise geänderten Werte,
  normalisiert Telefonnummern kanonisch und prüft organisationsgebunden auf
  mögliche Dubletten über Namen, E-Mail und Telefon.
- Anlage und Änderung benötigen eine exakte, fallunterscheidende
  Bestätigungsphrase. Persistente signierte Entwürfe, Rollenpaar,
  Mandantentrennung, Fachfingerprint, Ablaufzeit, Revision, serialisierbare
  Transaktion, Advisory-Lock, Audit und Integrationsereignis verhindern
  unbemerkte Änderungen und Doppelausführung.
- JARVIS ordnet einen neuen Kontakt niemals automatisch einem Projekt, einer
  Objektadresse oder Online-Anfrage zu. Die bewusste Kunden- und
  Projektzuordnung bleibt ein eigener Fachschritt.
- Der Vertikalschnitt ist auf Commit
  `5502776d50c03ca5b13f6e6938332c4e5cd563bd` produktiv abgenommen. Lokale
  und produktive isolierte QA, 110/110 permanente Fragen, echter UI-Klicktest,
  vollständiger Testsatz, 90-Seiten-Build, leerer Prisma-Diff und
  rückstandsfreie Bereinigung sind belegt. Backup:
  `/var/backups/workpilot360/20260802T015913Z-before-jarvis-contact-management`.
- `contact.delete` ist als eigener irreversibler Vertikalschnitt produktiv
  abgenommen. Eine eindeutige organisationsgebundene Kundennummer, ein
  dokumentierter Grund und die exakte Phrase `KONTAKT ENDGÜLTIG LÖSCHEN
  <Kundennummer>` sind Pflicht. JARVIS und normale Kontaktmaske verwenden
  denselben Fachservice und prüfen vor der Löschung vollständig 17
  Referenzfamilien einschließlich Projekten, Unterkontakten, Objektadressen,
  Online-Anfragen, Kundenlogbuch und -hinweisen, Sales-/Feedbackdaten,
  Angebotsannahmen, Lagerbewegungen und Kalkulationen. Schon ein verbleibender
  Bezug blockiert fail-closed; für normale Bestandsbereinigung bleibt
  Archivierung die bevorzugte Lösung.
- Der Löschentwurf ist an Sitzung, Organisation, Rollenpaar, Impersonation,
  TTL, Revision, signierte Nutzlast und den aktuellen Fachfingerprint
  gebunden. Serialisierbare Transaktion, Advisory-Lock, optimistisches
  Löschen, Audit, Integrationsereignis und Aktionshistorie sichern Exactly-once
  und verhindern eine Ausführung veralteter Vorschauen.
- Produktiv abgenommen auf Runtime-Commit
  `9f4d352268fe1c4b2f7c040530e58838ef02af0b`; Backup:
  `/var/backups/workpilot360/20260802T023504Z-before-jarvis-contact-deletion`.
  Lokal sind 159/159 Testdateien mit 1.628/1.628 Tests, TypeScript,
  Qualitätschecks, Prisma mit leerem Diff und der 90-Seiten-Build grün.
  Isolierte lokale und produktive QA, echter JARVIS-Klicktest und der
  permanente Korpus mit 110/110 Fragen sind bestanden; produktiv wurden 22
  Aktionen ausschließlich vorbereitet und keine ausgeführt. Alle QA-
  Rückstände sind null, Dashboard und öffentliches Formular liefern HTTP 200,
  WorkPilot läuft mit PID `714991`, KlinikNavigator unverändert mit PID
  `398228`.
- Chronologisch folgt jetzt `catalog.manage`; bei früherem Abschluss wird ohne
  Pause am nächsten offenen JARVIS-Vertikalschnitt weitergearbeitet, sofern
  keine wesentliche fachliche oder irreversible Entscheidung geklärt werden
  muss.

### Phase 3b – sichere Browser-Sprachbasis

- Der gemeinsame JARVIS-Composer besitzt einen ersten rein browserseitigen
  Push-to-talk-Einstieg. Das Mikrofon ist nur während des bewussten Drückens
  aktiv; verweigerte Berechtigungen und fehlende Browserunterstützung fallen
  ohne Beeinträchtigung des Textchats zurück.
- Das erkannte Transkript landet ausschließlich im editierbaren Textfeld.
  Es wird nicht automatisch abgesendet. Dadurch können Nutzer Fehler vor dem
  bewussten Senden korrigieren; anschließend gelten unverändert dieselben
  serverseitigen Rollen-, Datenschutz-, Dialog- und Aktionssperren wie für
  getippte Eingaben.
- Neue Antworten können optional mit der lokalen Browser-Sprachsynthese
  vorgelesen werden. Vorlesen ist standardmäßig deaktiviert, lässt sich
  stoppen beziehungsweise stummschalten und wird beim Schließen des Dialogs
  beendet.
- WorkPilot360 lädt in diesem Baustein kein Roh-Audio hoch und speichert kein
  Audio. Realtime-Audio, serverseitige Transkription, Audio-Kostenmessung und
  Sitzungsbudgets bleiben bewusst späteren Paketen vorbehalten.
- Die technische Browserfähigkeit wird defensiv erkannt. Push-to-talk wurde
  mit freigegebenem Mikrofon in Google Chrome real geprüft. Der eingebettete
  Codex-Browser reicht die Mikrofonfreigabe nicht an die Seite durch; der
  Textchat bleibt dort unverändert nutzbar.
- Stille, verweigerte Berechtigung, fehlendes Mikrofon, Abbruch, Netzwerkfehler
  und nicht unterstützte Sprache führen zu eigenen verständlichen Zuständen.
  Nur nach einem tatsächlich erkannten Transkript fordert JARVIS zur Prüfung
  und zum bewussten Senden auf. Start, Stop und Komponenten-Cleanup sind gegen
  schnelle Browserereignisse und verspätete Callbacks abgesichert.
- Der anschließende 110-Fragen-Live-Lauf wurde zusätzlich als
  Qualitätsrückkopplung genutzt: häufige natürliche Navigationsformulierungen
  sowie kurze Fragen nach Projektnummer, Kunde, Projektadresse und
  Verantwortlichkeit werden nun deterministisch statt über unnötige
  Rückfrage-Fallbacks beantwortet. Diese Korrektur verändert keine Rollen-,
  Geheimnis- oder Aktionssperre.
- Sichere exakte Bedienhilfen werden vor der optionalen KI-Klassifikation
  beantwortet. Dadurch benötigen häufige Navigation und Projektübersicht
  keinen Modellaufruf. Der damalige Live-Vergleich nach der Nachhärtung
  lieferte 110/110 technisch vollständige Antworten; schreibende Befehle
  blieben blockiert und Geheimnisse wurden nicht ausgegeben. Die strengere
  qualitative Neubewertung vom 29.07.2026 hat gezeigt, dass technische
  Vollständigkeit allein Wiederholungen, zu allgemeine Rückfragen und
  einzelne Fehlzuordnungen nicht zuverlässig erkennt. Frühere technische
  Grünwerte gelten deshalb nicht als qualitative Freigabe.

### Intent-Orchestrator V4 – Live-Härtung

Qualitative Live-Härtung 29.07.2026:

- Jede Antwort wird zusätzlich auf inhaltliche Richtigkeit, konkrete
  Fragerelevanz, Verständlichkeit, Angemessenheit und Handlungsnutzen
  bewertet. Eine technisch vorhandene Antwort ist allein kein bestandener
  Test.
- Ganze Fragenserien werden auf identische oder inhaltlich repetitive
  Antworten, Widersprüche, Ausweichantworten und unnötige Textmenge geprüft.
  Eine allgemeine Prinzipienfrage erhält die Übersicht; Fragen zu einem
  einzelnen Prinzip, einer Sicherheitsgrenze oder einem Entwicklungsaspekt
  erhalten eine fokussierte Erklärung und praktische Konsequenz.
- Der erste nach diesem Maßstab bewertete 100er-Lauf war technisch 100/100,
  qualitativ jedoch nur 77/100. Dieser Befund ist ausdrücklich
  entwicklungsrelevant und löst eine erneute vollständige Live-Abnahme nach
  der Korrektur aus.

Geplanter hybrider Ausbau der Sinnerkennung:

- Sehr eindeutige Navigation, Secrets, Rollen-, Organisations- und
  Aktionsgrenzen bleiben deterministisch, schnell und fail-closed.
- Für alle nicht eindeutig auflösbaren Fragen erweitert die Intent-KI ihr
  strukturiertes Schema um die Aussageabsicht `erklären`, `begründen`,
  `anwenden`, `Beispiel`, `vergleichen` oder `abwägen`. Bei verbleibender
  Mehrdeutigkeit fragt JARVIS gezielt nach.
- Eine spätere, getrennte Antwortkomposition darf aus freigegebenen
  Prinzipien, Systemwissen und rollenberechtigten Live-Daten natürlich
  formulieren. Sie erhält keine Befugnis für Datenzugriff, Rechte oder
  Aktionen und muss Fakten, Ableitungen und Unsicherheiten sichtbar trennen.
- Ein Qualitätsprüfer bewertet Antwortserien semantisch gegen Frage,
  freigegebene Quellen und vorherige Antworten. Er ergänzt, ersetzt aber
  nicht die deterministischen Sicherheits-, Rollen-, Mandanten- und
  Speicherprüfungen.

- Ein vollständiger Live-Basislauf mit 110 natürlich formulierten Fragen
  prüft Bedienung, Lesen, Diagnose, Analyse, Kontextwechsel, Aktionswünsche,
  Rollen, Datenschutz und Geheimnisanfragen. Schreibende JARVIS-Aktionen
  blieben vollständig gesperrt.
- Eindeutige Navigationsfragen wie `Wo sehe ich ...?` oder
  `Wie erkenne ich ...?` behalten jetzt Vorrang vor einer probabilistischen
  Lese-Klassifikation. Der sichere Angebotsversand ist als eigene
  Bedienhilfe dokumentiert.
- Deterministisch erkannte Personenübersichten werden nicht mehr durch eine
  unsichere KI-Rückfrage verdrängt. Ausdrücklich genannte Projekte haben
  auch dann Vorrang, wenn die Frage innerhalb des Projekts Angebote oder
  Rechnungen nennt.
- Projektwechsel und kurze Projektfragen erkennen nun zusätzlich
  Formulierungen wie `gesund`, `wo hakt es`, `schief`, `Überblick` und
  `zuletzt gespeichert`.
- Bereichsprüfungen ohne fachliche Datenbasis erhalten keinen irreführenden
  100-von-100-Wert. Bei fehlenden Stempelungen, Aufgaben oder ausdrücklich
  abgefragten Angebots-/Rechnungsdaten weist JARVIS den Bereich als nicht
  bewertbar aus.
- Allgemeine Rollenfragen zu Lohn-, Kunden- und Planungsrechten werden ohne
  KI und ohne Datensatzabruf aus der WorkPilot-Berechtigungsmatrix erklärt.
  Private Kontakt- und Adressdaten von Mitarbeitenden werden in
  JARVIS-Antworten nicht ausgegeben.
- Der deterministische Projekt-Prüfbestand und eindeutig erkannte
  Personenfragen haben Vorrang vor schwankenden KI-Einstufungen. Varianten
  für Projektanzahl, Kontaktdaten, letzte Aktivität und leichte Tippfehler
  laufen dadurch über denselben geprüften Personenadapter.
- Breite Formulierungen wie `gesund`, `schief`, `wo hakt es`, `Überblick`
  oder `korrekt abschließen` wählen bei eindeutigem Projekt direkt den
  vollständigen Prüfbereich. Noch nicht angebundene Organisationsauswertungen
  zu Offenen Posten, älteren Angeboten und Auslastung nennen stattdessen
  ausdrücklich die Adaptergrenze.
- Eindeutige Projektfakten und aktuelle Datensatzbezüge wie `diese
  Stempelung` werden vor einer KI-Rückfrage aufgelöst. Ein bloßes
  `Prüfe HAS-1` startet den sicheren vollständigen Projektcheck; Frageformen
  wie `Warum wurde ... erstellt?` gelten dabei nicht als schreibende Aktion.
- Ein offener Projektkontext überstimmt dabei weder eindeutig erkannte
  Personenfragen noch unternehmensweite Analysefragen. Diese stabileren
  Deterministiken behalten Vorrang vor einer allgemeinen Projektklärung.
- Referentielle Prüf-Folgefragen übernehmen den eindeutig geklärten
  Projektdatensatz sicher. Mehrzahlfragen zu Projekten bleiben
  projektübergreifend; klare Zusatzverkaufsfragen nutzen den lesenden
  Vertriebs-Dry-Run statt einer probabilistischen Rückfrage.
- Die Projektprüfung akzeptiert diese kurzen Folgefragen auch an ihrer
  internen Adaptergrenze; die Orchestrierung allein gilt nicht als
  ausreichender Nachweis für einen funktionierenden Folgeturn.
- Offene Posten besitzen jetzt eine deterministische, organisationsgebundene
  Stichtagsauswertung. Sie trennt offene, überfällige, heute fällige und wegen
  fehlendem Fälligkeitsdatum nicht sicher bewertbare Rechnungen, schließt
  Entwürfe, gelöschte, stornierte und bezahlte Belege aus und weist Beträge
  ausdrücklich netto aus. Mahnstufen werden ausschließlich gelesen; der
  Adapter löst keine Mahnung und keine Datenänderung aus.
- Offene Angebote besitzen eine eigene organisationsgebundene Nachfasssicht.
  Sie schließt Entwürfe, gelöschte, verlorene, gewonnene und bereits
  fakturierte Angebote aus, berücksichtigt frei formulierte Altersgrenzen
  und verwendet vorrangig den ersten dokumentierten E-Mail-Versand als
  Altersbasis. Fehlt dieser, wird das Erstellungsdatum ausdrücklich als
  Ersatzbasis gekennzeichnet. JARVIS ändert dabei weder Status noch Aufgaben
  oder Nachrichten.

### Intent-Orchestrator V4

- Die semantische Klassifikation läuft nach Sicherheits- und Rollenprüfung,
  aber vor Projekt-, Personen-, Such- und Analyseadaptern. Dadurch kann eine
  spätere Spezialroute nicht mehr zuerst eine fachlich fremde Antwort
  erzeugen.
- Das KI-Schema liefert nur Absicht, Domäne, Fachobjekt, Umfang,
  Kontextnutzung und eine fest definierte vorbereitete Aktionsart. Es
  beantwortet keine Fachfrage und erhält keine Live-Daten, Rechte,
  Datenbankwerkzeuge oder ausführbaren Aktionen.
- Kontextpriorität: ausdrückliche Referenz vor ausdrücklich genanntem
  Umfang, danach semantische Absicht, Gesprächskontext und zuletzt
  Bildschirmkontext. Eine globale Rechnungs-, Aufgaben-, Angebots- oder
  Kundenfrage darf deshalb nicht mehr in den Gesundheitscheck des geöffneten
  Projekts abbiegen.
- Eine Antwort-Fit-Prüfung vergleicht das erkannte Fachobjekt mit der
  gewählten Spezialantwort. Nicht passende Projekt-, Personen-, Such-,
  Vertriebs- oder Managementantworten werden nicht ausgegeben.
- Projektkennungen, Namen, E-Mail-Adressen, Telefonnummern, lange Nummern
  und interne IDs werden vor der Intent-KI maskiert. Technische Geheimnisse,
  Personal- und Lohndaten erreichen die Intent-KI weiterhin überhaupt nicht.
- Eindeutige bekannte Bedienfragen bleiben deterministisch. Für natürliche
  Such-, Diagnose-, Analyse- und Aktionsformulierungen darf der kleine
  Intent-Aufruf häufiger eingesetzt werden, um die bisherige
  Schlüsselwort-Konkurrenz zu beenden. Modell, Eingabe-, Cache- und
  Ausgabetokens werden ohne Fragetext oder Datensatzbezug technisch
  protokolliert.
- Aktionen werden weiterhin nicht ausgeführt. Projekt-, Kunden-, Angebots-,
  Rechnungs-, Aufgaben-, Termin-, Zeit-, Katalog-, E-Mail-, Änderungs- und
  Löschabsichten führen nur zu einer sicheren Erklärung oder Rückfrage.

### Intent-Orchestrator V3

- Eindeutige Bedienfragen werden nach der globalen Rollen- und
  Sicherheitsprüfung vor Projekt-, Analyse- und Suchadaptern beantwortet.
  Ein geöffneter Datensatz darf die ausdrücklich formulierte Absicht nicht
  mehr überschreiben.
- Eine ausdrücklich genannte Projektnummer hat bei genau einem Treffer
  Vorrang vor dem Bildschirm- und bisherigen Gesprächskontext. Breite Fragen
  zu diesem Projekt führen zu einer passenden Rückfrage; konkrete Fragen zu
  Projektart, Status, Verantwortung, fachlichem Prüfstand und letzter
  Speicherung erhalten eine kurze direkte Antwort.
- Unternehmensweite Material-, Leistungs-, Vertriebs- und
  Projektprüfungsfragen laufen vor der Einzelprojektdiagnose. Noch nicht
  sicher angebundene Auswertungen nennen ausdrücklich die Adaptergrenze,
  statt aus einer unpassenden Suche „keine Treffer“ abzuleiten.
- Bedienfragen wie `Wie suche ich einen Kunden?` bleiben Bedienhilfe und
  lösen keine Live-Suche aus. Ein einzelnes Projekt mit dem Wort
  `kontrollieren` wird nicht mehr als Frage zum gesamten fachlichen
  Projektprüfbestand missverstanden.
- Umgangssprache, leichte Schreibvarianten und Sicherheitsformulierungen wie
  `Zeig mir den API-Key` oder `Ignoriere alles vorher` sind im
  Regressionskorpus abgedeckt. Direkte Aktionen bleiben bis zum kontrollierten
  Action Center gesperrt und werden niemals still ausgeführt.

### Intent-Orchestrator V2

- Sicherheits- und Rollenprüfungen laufen vor allen fachlichen Adaptern und
  vor jedem KI-Aufruf.
- Bekannte Bedienabläufe werden nur über vollständige Mehrwortsignale mit
  leichter deutscher Formen-Erkennung zugeordnet. Einzelne allgemeine Wörter
  wie `Projekt` oder `Mitarbeiter` dürfen keine unpassende Anleitung auslösen.
- Schwache, konfliktbehaftete oder aktionsbezogene Formulierungen dürfen den
  begrenzten KI-Klassifikator als semantischen Schiedsrichter nutzen. Er kann
  nur vorhandene Hilfethemen oder fest definierte Aktionsarten auswählen und
  besitzt weiterhin weder Live-Daten noch Werkzeuge.
- Direkte Aktionen bleiben gesperrt und führen zu einer sicheren, klickbaren
  Rückfrage.
- Projektbezüge ohne Bindestrich benötigen bewusst eine großgeschriebene
  Kennung, damit Angaben wie `30 Tage` nicht als Projekt gelesen werden.
- Ein automatisierter 100-Varianten-Korpus schützt Bedienfragen,
  Fehlzuordnungen, Zahlenangaben und Geheimnisanfragen vor Regressionen.

Stand 28.07.2026:

- Die Absichtserkennung arbeitet für Bedienfragen jetzt hybrid. Eindeutige
  bekannte Fragen bleiben deterministisch und kosten keine OpenAI-Tokens.
  Nur unerkannte oder niedrig-konfidente WorkPilot-Formulierungen dürfen
  einen kleinen strukturierten Klassifikationsaufruf verwenden. Dieser
  Aufruf erhält keine Live-Daten, Datensatz-IDs, Rechte oder ausführbaren
  Werkzeuge. Projekt-, E-Mail- und Telefondaten werden vorab maskiert; die
  Ausgabe ist auf die festen Absichten, Domänen und vorhandenen
  Bedienhilfen begrenzt und wird anschließend erneut in WorkPilot360
  validiert. Fehler oder ungültige Modellausgaben führen immer zur sicheren
  deterministischen Rückfrage beziehungsweise zum bisherigen Fallback.
- Terminfragen unterscheiden verbindlich zwischen Bedienung, Diagnose und
  späterer Aktion. `Wie buche ich hier einen Termin?` erklärt im aktuellen
  Projektkontext den vorhandenen Ablauf. `Wie buche ich bei HAS-1 einen
  Termin?` priorisiert die ausdrücklich genannte Projektreferenz. Eine Frage
  nach Fehlern oder fehlender Planung bleibt Diagnose. Eine
  Ausführungsaufforderung wird in Phase 3a nicht gespeichert, sondern
  transparent auf Erklärung oder Prüfung begrenzt; die echte
  Terminvorbereitung folgt erst im Action Center der Phase 4.
- Projektbezogene Material- und Stundenverrechnungssatzfragen berücksichtigen
  einen ausdrücklich genannten Monat. Andere Rechnungs- und Stempelmonate
  werden aus dieser fokussierten Auswertung ausgeschlossen. Verbrauchsfragen
  benennen offen, dass Rechnungsmenge und automatische Lagerentnahme keinen
  tatsächlichen physischen Einsatz beweisen. Die Erklärung unterscheidet
  Einmalprojekt, Monatspauschale und Stunden-Dauerläufer; eine ungeklärte
  Projektart bleibt sichtbar und führt zu keiner erfundenen Sollannahme.
  Natürliche Unternehmensfragen zu auffälligem Verbrauch, effektiv erzielten
  Stundensätzen und wirtschaftlichen Stundenleistungen werden ohne
  zusätzlichen KI-Aufruf den vorhandenen sicheren Analyseadaptern zugeordnet.
- Projektbezogene Stundensatzfragen unterscheiden jetzt die Abrechnung der
  Projektart: Stunden-Dauerläufer verwenden tatsächlich abgerechnete
  Stundenleistungen, Einmalprojekte nur ausdrücklich vorhandene
  Stundenpositionen. Bei einer Monatspauschale wird ein rechnerischer Erlös je
  Arbeitsstunde nicht als vertraglicher Kunden-Stundensatz bezeichnet. Eine
  unklare Projektart verhindert eine bestätigte projektartgerechte Einordnung.
- Die projektbezogene Stundenverrechnungssatzanalyse trennt den aus
  Rechnungen und Stempelungen belegten Ist-Zustand jetzt ausdrücklich von
  einer fachlichen Preisempfehlung. Nur fachlich freigegebene Leistungen
  können die Mindestdatenbasis für eine Empfehlung erfüllen. Zusätzlich zeigt
  die fokussierte Projektantwort, ob das Projekt selbst und wie viele der
  ausgewerteten Stundenleistungen fachlich freigegeben sind. Ungeprüfte
  Stammdatenpreise bleiben sichtbare Prüfhinweise, werden aber nicht als
  bestätigte Sollwerte behandelt.
- Der explizite Prüf-/Freigabestatus für Artikel, Leistungen und Pakete ist
  umgesetzt. GF/Admin können Katalogstammdaten als ungeprüft, prüfbedürftig
  oder fachlich freigegeben kennzeichnen; Freigabebenutzer, Zeitpunkt,
  Prüfnotiz und Statuswechsel werden nachvollziehbar gespeichert.
  Fachlich relevante spätere Änderungen einschließlich Paketbestandteilen
  entziehen die Freigabe automatisch. Bestehende Angebote, Rechnungen und
  historische Kostenstände bleiben unverändert.
- Der LK-Satz-Abgleich zeigt gespeicherten und aktuell korrekt gewichteten
  Wert nebeneinander. Eine Übernahme erfolgt ausschließlich in den
  bearbeiteten Entwurf und benötigt Speichern plus erneute fachliche
  Freigabe. JARVIS verwendet nur freigegebene Katalogwerte als Grundlage für
  Preis- und Stundensatzempfehlungen; ungeprüfte Werte bleiben ausschließlich
  Diagnose- und Prüfgrundlage.
- Der aktuelle Systembestand ist noch ein Vor-Live-/Prüfbestand. Projekte
  müssen teilweise noch Projektart, Abrechnungsweg und richtigem Status
  zugeordnet werden; Artikel und Leistungen sind ebenfalls noch nicht
  vollständig überarbeitet und fachlich freigegeben. JARVIS darf technisch
  plausible Werte daher nicht automatisch als fachlich bestätigt behandeln.
  Der explizite Projekt-Prüfstatus ist umgesetzt: Projekte sind ungeprüft,
  prüfbedürftig oder fachlich freigegeben. Die Freigabe verlangt eine
  eindeutige Projektart, passende Abrechnungslogik, stabile Kundenverknüpfung,
  bei Dauerläufern eine vollständige Laufzeit, Gewerk, Niederlassung,
  Verantwortung und mindestens ein gültiges Angebot.
  Prüfrelevante spätere Änderungen entziehen die Freigabe automatisch;
  normale Pipeline-Statuswechsel tun dies bewusst nicht. JARVIS weist
  ungeprüfte Projektdaten als unsichere Datenbasis aus und darf sie nicht als
  bestätigte Sollwahrheit behandeln.
  Die Freigabematrix ist für einmalige Projekte, Dauerläufer mit
  Monatspauschale und Dauerläufer mit Stundenabrechnung deterministisch
  getestet. Im aktuellen lokalen Datenbestand existiert noch kein fachlich
  gepflegtes Stundenabrechnungs-Dauerläuferprojekt; deshalb wurde für diese
  Variante bewusst kein künstlicher Echtdatensatz angelegt.
- Die LK-Satz-Grundlage wurde vor dem Vollkostenausbau korrigiert.
  Niederlassungs- und Planungsgruppenmittel verwenden jetzt den gewichteten
  Kostensatz geteilt durch die Summe der tatsächlichen Mitarbeiteranteile.
  Geteilte Niederlassungsanteile reduzieren Kosten und Kapazität gemeinsam
  und dürfen deshalb den Kostensatz je tatsächlicher Stunde nicht künstlich
  absenken. Bestehende Katalogleistungen, Angebotspositionen und historische
  Kostensnapshots werden nicht automatisch verändert.
- Der erste unternehmensweite Material- und Artikelvergleich ist als
  deterministischer Managementadapter umgesetzt. Er wertet standardmäßig die
  letzten zwölf Monate aus und verbindet fertige Rechnungspositionen,
  historische Paketbestandteile, systemseitige Lagerbewegungen sowie aktuelle
  Artikel-Verkaufspreise.
- Freie Rechnungspositionen ohne stabile Artikel-ID werden nicht mit dem Lager
  verglichen. Abgerechnete Menge, automatische Lagerentnahme und tatsächlicher
  physischer Verbrauch bleiben fachlich getrennt. Einkaufs- und historische
  Materialkosten sind ausschließlich GF/Admin zugänglich.
- Eine wiederholte Preisbasis verlangt mindestens drei fertige Rechnungen je
  Materialart. Die freigegebene Standardrichtlinie verwendet 18 %
  Mindestmarge und 30 % Zielmarge. JARVIS berechnet daraus nur für GF/Admin
  und nur bei vollständig gespeicherten historischen Kosten eine ausdrücklich
  vorläufige Teilkostenspanne. Beschaffung, Lager, Verwaltung, Fahrzeuge und
  weitere Gemeinkosten bleiben bis zur Vollkostenkonfiguration offen. JARVIS
  ändert keine Stammdaten.
- Der erste unternehmensweite Leistungs- und
  Stundenverrechnungssatz-Vergleich ist als eigener Managementadapter
  umgesetzt. Er vergleicht standardmäßig die letzten zwölf Monate über alle
  Projekte hinweg, ohne eine ausdrücklich genannte Projektfrage zu
  übernehmen.
- Der Vergleich sortiert belegte Preis-, Stunden- und Zuordnungsabweichungen.
  Finanzberechtigte Rollen sehen die freigegebenen Rechnungs- und
  Leistungswerte; historische Mitarbeiterkosten bleiben ausschließlich
  GF/Admin vorbehalten. Nicht berechtigte Rollen werden vor dem Laden der
  Unternehmensdaten abgewiesen.
- Die erste projektbezogene Leistungs- und
  Stundenverrechnungssatz-Analyse ist umgesetzt. Sie verbindet fertige
  Rechnungspositionen mit eindeutig über stabile Leistungs-IDs zugeordneten
  Stempelstunden und dem aktuellen Leistungspreis. JARVIS unterscheidet den
  tatsächlich berechneten Netto-Stundensatz vom Nettoerlös je eingesetzter
  Stunde.
- Stundenleistungen aus Paketen werden nur aus der zum Rechnungszeitpunkt
  gespeicherten Paketzusammensetzung übernommen. Entwürfe, Stornos,
  Stornorechnungen und gelöschte Belege werden nicht gewertet.
- Interne Mitarbeiterkosten und Kostenabdeckung erscheinen ausschließlich
  für GF/Admin und nur auf Basis gespeicherter historischer Kostenstände.
  Material-, Fahrzeug- und Gemeinkosten werden ausdrücklich als zusätzlich
  erforderliche Betrachtung genannt.
- Konkrete Preisempfehlungen werden bei dünner Datenbasis bewusst
  zurückgehalten. Die erste belastbare Schwelle verlangt je Leistung
  mindestens drei fertige Rechnungen, zehn abgerechnete und zehn eindeutig
  zugeordnete gestempelte Stunden. Bei vollständigen historischen
  Mitarbeiterkosten berechnet JARVIS für GF/Admin mit 18 % Mindest- und 30 %
  Zielmarge eine vorläufige Teilkostenspanne. Material-, Fahrzeug-, Werkzeug-,
  Verwaltungs- und weitere Gemeinkosten werden ausdrücklich nicht als
  enthalten ausgegeben. JARVIS ändert keine Stammdaten und stellt eine reine
  Kostendeckungsgrenze nicht als fertigen Verkaufspreis dar.

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
- Personen- und Kundenübersichten liefern zusätzlich ein typisiertes,
  clientseitig nochmals validiertes Antwortmodell aus Überschrift,
  Kurzkontext, Kennzahlen und erklärenden Abschnitten. Dadurch erscheinen
  belegte Daten übersichtlich statt als langer Fließtext; der normale
  Nachrichtentext bleibt als Fallback erhalten.
- Die erste deterministische Systemdiagnose vergleicht bei abweichenden
  Projektzahlen die stabile JARVIS-ID-Verknüpfung mit der tatsächlichen
  Kundenakten-Zählung. Reine Namenszuordnungen, abweichende
  Ansprechpartner-/Adressverknüpfungen und inzwischen behobene Unterschiede
  werden nachvollziehbar erklärt. Betroffene Projekte können als erlaubte
  Sprungkarten geöffnet werden. Die Diagnose ist rollen- und
  organisationsgebunden, rein lesend und verursacht keinen OpenAI-Aufruf.
- Das JARVIS-Panel gibt seine Transform-Ebene nach der Einfluganimation
  vollständig frei. Damit bleibt Text insbesondere bei reduziertem
  Browserzoom schärfer, ohne die gewünschte Öffnungsanimation zu entfernen.

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

Das Zielbild umfasst ausdrücklich auch:

- neue Kunden, Projekte, Artikel, Leistungen und Prozessdaten automatisch
  über aktuelle, organisationsgebundene Adapter zu berücksichtigen,
- Materialverbräuche, Artikel, Leistungen, Pakete, Einkaufspreise,
  Stundenverrechnungssätze, tatsächlich erzielte Erlöse, Kosten und Margen
  gemeinsam zu bewerten,
- nachvollziehbare Preis- und Prozessanpassungen vorzuschlagen, ohne
  Stammdaten ungeprüft zu verändern,
- Verbesserungspotenziale in Systembedienung, Datenqualität, Wertschöpfung,
  Vertrieb, Kalkulation und Organisation proaktiv sichtbar zu machen,
- Mitarbeitende bei Nachfassen, Neukundengewinnung, Potenzialausschöpfung und
  Zusatzverkauf konkret zu unterstützen.

### 1.1 Kontrolliertes Lernen

JARVIS darf lernen, aber nicht unkontrolliert sein eigenes Systemwissen
umschreiben. Der verbindliche Lernkreislauf lautet:

1. JARVIS erkennt wiederkehrende Rückfragen, Prozessabweichungen,
   Datenqualitätsprobleme oder Verbesserungspotenziale.
2. Er formuliert einen belegten Lern- oder Optimierungsvorschlag mit Quelle,
   betroffenen Rollen, Risiken und erwarteter Wirkung.
3. Ein fachlich berechtigter Verantwortlicher prüft, ändert oder verwirft den
   Vorschlag.
4. Nur freigegebenes Wissen wird versioniert mit geprüftem Commit,
   Gültigkeitsdatum und Regressionstest in Wissensbasis oder Systemlogik
   übernommen.
5. Veraltete Regeln werden nachvollziehbar ersetzt, nicht still überlagert.

Gesprächsinhalte, einzelne Nutzerbehauptungen und Modellantworten sind niemals
alleinige fachliche Wahrheit. Rollen, Datenschutz, Berechnungen und
Kernprozesse bleiben durch WorkPilot360 und freigegebene Regeln bestimmt.

### 1.2 Umgang mit neuen Ideen während der Entwicklung

Neue JARVIS-Ideen werden sofort fachlich eingeordnet und an der passenden
Stelle dieses Entwicklungsplans ergänzt. Sie verändern jedoch nicht
automatisch das gerade aktive Entwicklungspaket. Vorgezogen wird ein Thema
nur nach einer bewussten gemeinsamen Prioritätsentscheidung. Dadurch bleiben
Abhängigkeiten, Sicherheitsfundament und chronologische Abnahme erhalten,
ohne neue Ideen zu verlieren.

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
- berechnete Mitarbeiter-, Planungsgruppen- und Board-Auslastungen
  rollengerecht einordnen und begründete Kapazitätsempfehlungen formulieren,
- Prioritäten und mögliche nächste Schritte begründen,
- individuelle E-Mail-, Aufgaben- und Beschreibungstexte formulieren,
- einen natürlich fortlaufenden Dialog führen.

Keine KI ist erforderlich für:

- Navigation und Öffnen vorhandener Ansichten,
- Rollen-, Mandanten- und Rechteprüfung,
- Datenbankabfragen über freigegebene Adapter,
- Zahlen, Summen, Margen, Fristen und Statusberechnungen,
- verfügbare Kapazität, geplante Stunden, Auslastungsquote und Überbuchung
  anhand von Arbeitszeit, Planung, Feiertagen und Abwesenheiten berechnen,
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

### 5.2.1 Erweiterte Dialog- und Klärungslogik

JARVIS darf unterschiedliche Nutzerformulierungen nicht über einzelne
Sonderfälle oder starre Satzmuster behandeln. Vor jeder Antwort trennt die
Dialogsteuerung mindestens:

1. Welcher Datensatz oder Fachbereich ist gemeint?
2. Welche Absicht verfolgt der Nutzer?
3. Welche Angaben fehlen für eine belastbare Antwort oder Aktion?
4. Welche Antworten und Folgeaktionen sind für die echte Rolle erlaubt?
5. Ist die Absicht eindeutig, mehrdeutig oder noch unbekannt?

Verbindliches Dialogverhalten:

- Eine fachlich eindeutige Frage wird direkt beantwortet. JARVIS stellt keine
  unnötige Rückfrage und zeigt nicht ersatzweise eine allgemeine Prüfauswahl.
- Die Antworttiefe folgt der Nutzerabsicht: Eine konkrete Warum-, Status- oder
  Monatsfrage erhält eine kurze Antwort mit Ursache beziehungsweise sicher
  festgestelltem Zustand und nächstem Schritt. Ein vollständiger Prüfwert,
  sämtliche Nebenbefunde und der Diagnoseumfang erscheinen nur bei einem
  ausdrücklichen Prüf- oder Analyseauftrag. Nicht beweisbare Ursachen werden
  klar als mögliche Ursache gekennzeichnet und niemals erfunden.
- Ursache-Wirkungs-Fragen über verbundene WorkPilot-Bereiche bleiben ein
  gemeinsamer Prüfpfad. Beispielsweise wird die Frage, warum Stempelungen
  keinen Rechnungsentwurf erzeugt haben, nicht künstlich in eine Stempel- und
  eine Rechnungsprüfung aufgeteilt.
- Wenn mehrere fachlich unterschiedliche Absichten plausibel sind, fragt
  JARVIS gezielt nach dem Ziel und erklärt knapp, welche Unterscheidung fehlt.
- Rückfragen verwenden typisierte, klickbare Auswahlflächen mit stabiler ID,
  sichtbarem Kurztext und vollständigem Folge-Prompt. Freie Texteingabe bleibt
  immer möglich.
- Auswahlmöglichkeiten werden vor ihrer Anzeige nach Sitzung, Rolle,
  Berechtigung, Mandant, Team-/Eigentümerscope und Datenklasse gefiltert.
- JARVIS fragt nur die tatsächlich fehlende Information ab und wiederholt
  bereits eindeutig geklärte Angaben nicht.
- Datensatzauflösung und Nutzerabsicht werden getrennt behandelt. Ein sicher
  gefundenes Projekt bedeutet noch nicht automatisch, dass der Nutzer einen
  vollständigen Projektcheck verlangt.
- Ausdrückliche Nutzerangaben haben Vorrang vor Bildschirmkontext. Der
  Bildschirmkontext bleibt ein Hinweis und darf einen erkennbaren
  Gesprächswechsel nicht überschreiben.
- Der Gesprächskontext hält den zuletzt eindeutig gewählten Datensatz,
  Fachbereich, Zeitraum und Prüfumfang. Kurze Folgefragen und Pronomen werden
  darauf bezogen, solange der Nutzer nicht erkennbar wechselt.
- Bei einem Datensatzwechsel werden alte, nicht mehr passende Auswahl- und
  Prüfkontexte verworfen. JARVIS darf Ergebnisse eines vorherigen Projekts
  nicht auf das neue Projekt übertragen.
- Rückfragen und Sicherheitsbestätigungen sind getrennte Dialogzustände. Eine
  fachliche Auswahl ersetzt niemals die vorgeschriebene Vorschau und
  Bestätigung einer schreibenden oder kritischen Aktion.
- Verschachtelte Rückfragen bleiben begrenzt und bieten einen verständlichen
  Ausstieg. Nach wiederholt fehlendem Kontext nennt JARVIS konkret, welche
  Angabe benötigt wird, statt in eine allgemeine Sackgassenmeldung zu fallen.
- Erst wenn weder deterministische Regeln noch eine sichere semantische
  Einordnung eine belastbare Absicht ergeben, wird eine Wissenslücke
  ausgewiesen. Ein erkennbarer WorkPilot-Bezug darf nicht vorschnell als
  unbekanntes Fremdthema abgewiesen werden.

Die Dialogsteuerung verwendet eine nachvollziehbare Konfidenz- und
Kandidatenlogik. Deterministische bekannte Absichten, Datensatz-IDs und
Projekt-/Abrechnungsvarianten haben Vorrang. Ein KI-Modell darf bei freier
Sprache Kandidaten bilden und Rückfragen formulieren, aber keine Rechte,
Systemzustände oder Fachregeln erfinden. Häufige Klärungsdialoge sollen ohne
großen Modellaufruf funktionieren.

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
- Rechnung nach vollständiger Zahlungsprüfung und exakter Phrase als bezahlt
  markieren (Vertikalschnitt in Releaseabnahme),
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
- Auslastung einzelner Mitarbeitender, Planungsgruppen und Planungsboards für
  frei wählbare Zeiträume vergleichen,
- Unterauslastung, Überlastung, freie Kapazität und wiederkehrende Engpässe
  anhand nachvollziehbarer Systemwerte erkennen,
- Kapazitätsausgleich, Umplanung oder Vertriebsaktivität als begründete
  Empfehlung vorschlagen,
- Handlungsempfehlungen als Aufgaben vorbereiten,
- Monatsberichte vorbereiten,
- Berichte und Arbeitslisten exportieren.

### 7.12 Mitarbeiter und Personal

- Mitarbeiter und Teams suchen,
- eigene bzw. berechtigte Planungs- und Abwesenheitsdaten anzeigen,
- Übergabeaufgaben vorbereiten,
- Planungseinstellungen öffnen,
- Teamaufgaben und Auslastung zusammenfassen,
- Geschäftsführung und Admin dürfen die freigegebene Auslastung aller
  Mitarbeitenden, Planungsgruppen und Boards abfragen,
- Führungskräfte dürfen ausschließlich die ihnen zugeordneten
  Planungsgruppen beziehungsweise Planungsboards und deren Mitarbeitende
  auswerten,
- normale Mitarbeitende erhalten höchstens ihre eigene freigegebene
  Auslastung, niemals fremde Personal-, Lohn- oder Kostendaten,
- Auslastung wird deterministisch aus verfügbarer Arbeitskapazität,
  Feiertagen, Abwesenheiten und bestätigter Planung berechnet; ein KI-Modell
  darf den Zahlenwert nicht erfinden oder verändern,
- Zielkorridore, Mindestvorlauf und Überlastungsgrenzen werden fachlich
  konfigurierbar festgelegt und nicht pauschal im KI-Prompt versteckt,
- KI wird erst für Trenddeutung, Ursachenhypothesen und verständliche
  Handlungsempfehlungen verwendet; die Antwort nennt Datenbasis, Zeitraum und
  Unsicherheit,
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

### 7.15 Kalkulations-Rechner

JARVIS muss die vorhandenen Kalkulations-Rechner nicht nur finden und
erklären, sondern rollenberechtigt vollständig dialoggeführt bedienen können.
Ein Mitarbeiter soll beispielsweise schreiben können: „Kalkuliere mir diese
Winterdienstleistung“ oder „Was kostet die Fahrt mit Fahrzeug X über 180
Kilometer?“. JARVIS wählt den fachlich passenden Rechner, fragt ausschließlich
die noch fehlenden Eingaben ab und verwendet für das Ergebnis zwingend
dieselben zentralen Berechnungsfunktionen wie die normale WorkPilot-Oberfläche.
Das Sprachmodell darf keine eigene Ersatzformel erfinden oder fehlende Werte
unbemerkt schätzen.

Der vollständige Vertikalschnitt umfasst:

- Winterdienst-, Fahrten- und freigegebene Fahrzeugkalkulationen erkennen,
- vorhandene aktive Fahrzeuge und erlaubte Kalkulationsgrundlagen
  rollen- und organisationsgebunden auswählen,
- Einheiten, Strecke, Verbrauch, Kraftstoffpreis, Einsatzhäufigkeit,
  Bereitschaft, Arbeitszeit, Streugut, Zuschläge und weitere fachlich
  erforderliche Eingaben validieren,
- fehlende Werte einzeln und verständlich nachfragen,
- Eingaben, Annahmen, Preisquelle und Berechnungszeitpunkt sichtbar
  zusammenfassen,
- Varianten, Selbstkosten, Verkaufspreis, Gewinn, Aufschlag und echte Marge
  nachvollziehbar erklären,
- klar kennzeichnen, dass der Fahrtenrechner bewusst keine Personalkosten
  enthält,
- die Kalkulation zunächst nur als überprüfbare Vorschau ausgeben,
- Speichern oder Übernehmen erst nach ausdrücklicher menschlicher Bestätigung
  und der normalen WorkPilot-Rollenprüfung ausführen,
- bestehende Kalkulationen niemals überschreiben, sondern entsprechend der
  jeweiligen Fachlogik eine unveränderliche neue Snapshot-Version erzeugen,
- erforderliche Kunden-, Projekt-, Angebots- oder Paketzuordnungen
  serverseitig erneut prüfen und keine Zuordnung erfinden,
- Replay, Doppelklick und parallele Bestätigung idempotent behandeln sowie
  Vorschau, Bestätigung, Speicherung und Ergebnis revisionsgebunden
  auditieren.

Mitarbeitende dürfen die für ihre Rolle freigegebenen Rechner benutzen und
Kalkulationen vorbereiten. Das Bearbeiten von Fahrzeugstammdaten,
Katalogpreisen, Angeboten oder Paketen bleibt bei den jeweils vorhandenen
WorkPilot-Berechtigungen und ist keine stillschweigende Nebenwirkung einer
Kalkulation. Winterdienst darf ohne Projektzuordnung berechnet, aber nur nach
der bestehenden Fachregel mit einem eindeutig zugeordneten Kundenprojekt
gespeichert oder weiterverarbeitet werden. Der Vermietungsbereich bleibt für
JARVIS fail-closed, solange seine Fachlogik in WorkPilot selbst nur als
vorbereiteter beziehungsweise eingeschränkt geprüfter Bereich geführt wird.

Abnahmekriterium: Ein berechtigter Mitarbeiter kann eine Kalkulation vom
freien Sprachwunsch über vollständige Rückfragen bis zur nachvollziehbaren
Vorschau durchführen. Eine Speicherung verwendet nach erneuter Prüfung exakt
die normale Rechen- und Speicherlogik, erzeugt keine ungeprüften
Stammdatenänderungen und hält Doppelklick-, Replay-, Rollen-, Organisations-
und Auditprüfungen ein.

Umsetzungsstand 30.07.2026:

- Der Winterdienst-Vertikalschnitt ist umgesetzt. Eine natürliche
  Startaufforderung erzeugt einen persistenten Action-Center-Entwurf ohne
  stillschweigende Ausgangswerte.
- Die Berechnung nutzt ausschließlich
  `src/lib/winter-service/calculation.ts`; Bereitschaft und alle drei
  vorhandenen Winterdienstvarianten werden aus derselben Rechenlogik wie in
  der normalen Oberfläche erzeugt.
- Alle aktiven internen Rollen dürfen rechnen. Die dauerhafte Zuordnung und
  Speicherung bleibt an `canManageProjects` für Sitzungs- und effektive Rolle
  sowie an ein bewusst gewähltes, aktuelles Kundenprojekt gebunden.
- Bestätigung, erneute Serverberechnung, unveränderlicher Snapshot,
  Transaktion, Audit, Revision, Ablaufzeit, Exactly-once und Replay-Schutz
  sind Bestandteil des produktiven Vertrags.
- Der Fahrten- und Fahrzeugkosten-Vertikalschnitt ist ebenfalls umgesetzt.
  Natürliche Startaufforderungen zu Fahrten-, Fahrtkosten- und
  Fahrzeugkostenkalkulation führen in denselben fachlich freigegebenen
  aktiven-fahrzeuggebundenen Rechner. Eine weitere Fahrzeugformel ist in
  WorkPilot nicht freigegeben und wird nicht erfunden.
- Der Entwurf startet ohne Fahrzeug, Strecke oder Preisannahme. Aktive
  Fahrzeuge, Verbrauch, Selbstkosten/km, Verkauf/km und Änderungsstand werden
  organisationsgebunden geladen. Die Kraftstoffpreisquelle ist entweder der
  zentrale Livepreis aus Tankerkönig/MTS-K oder eine bewusste manuelle
  Eingabe; Quelle und Abrufzeitpunkt bleiben sichtbar und im Snapshot.
- Die Berechnung nutzt ausschließlich `src/lib/vehicle-calculation.ts` und
  weist ausdrücklich aus, dass Personalkosten nicht enthalten sind.
  Mitarbeitende dürfen rechnen; dauerhaftes Speichern bleibt an
  `canManageProjects` für Sitzungs- und effektive Rolle gebunden.
- Bestätigung, erneute Serverberechnung, aktueller Fahrzeugstamm,
  unveränderlicher `VehicleCalculation`-Snapshot, Transaktion, Audit,
  Revision, Ablaufzeit, Exactly-once und Replay-Schutz sind Bestandteil des
  Vertrags. Der direkte Speicherweg übernimmt ebenfalls keine angelieferten
  Kilometerstammdaten, sondern lädt sie vor dem Schreiben erneut.
- Fahrzeugstammdatenpflege ist weiterhin eine getrennte berechtigte Funktion
  und keine Nebenwirkung der Kalkulation. Vermietung bleibt weiterhin
  fail-closed und wird erst nach eigener fachlicher Freigabe chronologisch
  fortgesetzt.

Fortschreibung 31.07.2026:

- Das vollständige Rechnerinventar ist in
  `docs/JARVIS_KALKULATIONSRECHNER_INVENTAR.md` festgeschrieben. Produktiv
  freigegebene Fachrechner sind Winterdienst und Fahrt/Fahrzeugkosten.
  Fahrzeuge sind Stammdaten, keine weitere Formel; Vermietung bleibt
  eingeschränkt. Katalog- und Mitarbeiterkostenmasken werden nicht als
  freigegebene Snapshot-Rechner umgedeutet.
- JARVIS übernimmt nun eindeutige Rechengrundlagen aus natürlicher Sprache.
  Ein allgemeiner Startwunsch fragt zunächst nach dem gewünschten Rechner.
  Ein konkreter Wunsch kann Fläche, Einsätze, Zeiten, Preise, Zuschläge und
  Mischanteile beziehungsweise Fahrzeug, Strecke und Preisquelle vorbelegen.
  Nur tatsächlich fehlende Angaben bleiben sichtbar offen.
- Winterdienst-Nulleingaben besitzen einen expliziten Eingabenachweis.
  Fachlich zulässige `0` ist weiterhin möglich, eine aus dem leeren Entwurf
  stammende Null kann aber nicht mehr unbemerkt als Benutzerannahme in eine
  berechenbare Vorschau gelangen.

### 7.16 Firmeneinstellungen

- passende Einstellung öffnen,
- aktuelle Konfiguration erklären,
- fehlende Werte erkennen,
- Status-, Frist- und Eskalationsregeln vorbereiten,
- Dry-Run-Ergebnisse erklären,
- Planungsgruppen-SVS und Mailvorlagen öffnen,
- Feiertage und Zeitfristen vorbereiten,
- globale Änderungen nur für berechtigte Rollen nach Vorher-/Nachhervergleich
  ausführen.

### 7.17 Massenänderungen

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

### 7.18 Automationen ohne Einzelbestätigung

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

### 7.19 Proaktiver Vertriebs-, Projekt- und BWL-Analyst

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
- Ausführen bereits strukturierter Aktionen,
- Validierung, Berechnung und Rechteprüfung,
- Scheduler- und Automationsläufen,
- bereits eindeutig validierten internen Systemereignissen ohne
  Nutzersprache.

### 10.2 Kleiner KI-Aufruf

Ein kompakter Aufruf bei:

- natürlicher Such-, Lese-, Diagnose-, Analyse- oder Aktionsformulierung,
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

- JARVIS bleibt ein globaler, einheitlicher Slide-out. Systemhilfe, Vertrieb
  und BWL werden intern automatisch geroutet und nicht als getrennte sichtbare
  Chats geführt.
- Aktueller Bereich und Datensatzkontext werden sichtbar angezeigt.
- Direkte Antworten und Klärungsdialoge werden sichtbar unterschieden.
- Klickbare Rückfragen zeigen nur wenige, konkrete und rollengerechte
  Möglichkeiten; sie dürfen über mehrere Dialogschritte wiederverwendet
  werden.
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

### Phase 3a: Erweiterte Dialog- und Intent-Logik

- zentrale Intent-Kandidaten mit nachvollziehbarer Konfidenz,
- Datensatz-, Absichts-, Zeitraum- und Aktionsklärung getrennt behandeln,
- direkte Antwort bei eindeutiger Frage,
- gezielte Rückfrage bei mehreren plausiblen Bedeutungen,
- typisierte klickbare und rollengerecht gefilterte Antwortmöglichkeiten,
- stabiler Gesprächskontext über Folgefragen und Datensatzwechsel,
- Auflösung umgangssprachlicher, verkürzter und fehlerhafter Formulierungen,
- sichere Behandlung kombinierter Fragen mit mehreren Teilabsichten,
- klare Trennung zwischen Rückfrage, Vorschau und Aktionsbestätigung,
- begrenzte Rückfrageschleifen mit verständlichem Ausstieg,
- deterministische Standarddialoge ohne unnötige OpenAI-Kosten,
- systematische Sammlung und kontrollierte Freigabe neuer Synonyme und
  Absichtsvarianten,
- Dialogtests über Projekt-, Kunden-, Aufgaben-, Dokument-, Vertriebs- und
  BWL-Fragen.

Abnahmekriterium: Eindeutige Fragen werden ohne unnötige Auswahl direkt
beantwortet. Mehrdeutige WorkPilot-Fragen führen zu einer konkreten,
rollengerechten Rückfrage und können danach ohne Verlust von Datensatz,
Zeitraum oder Nutzerziel fortgesetzt werden.

Umsetzungsstand 28.07.2026: Der zentrale, deterministische Intent-Entscheider
ist als vorgeschaltete Ebene aktiv. Er bewertet Domäne, Nutzerziel,
Fachobjekte, Zeiträume und getrennte Satzteile mit nachvollziehbarer
Konfidenz. Kombinierte Domänen, mehrere nicht sicher gemeinsam lesbare
Datensatzarten und widersprüchliche Zeiträume führen vor jeder Datenabfrage
zu rollengerecht gefilterten, klickbaren Rückfragen. Sicherheits- und
Lohnsignale haben absolute Priorität.

Der Chat führt inzwischen einen typisierten, streng validierten
Dialogzustand für Fachdomäne, Ziel, Fachobjekte, Zeitraum, aktiven
Projekt-/Kundenbezug und Klärungstiefe. Eindeutige kurze Auswahlantworten
werden in den vollständigen Folge-Prompt übersetzt. Referenzielle
Folgefragen behalten den gültigen Gesprächsbezug; eigenständige Fragen und
ausdrückliche Datensatzwechsel setzen ihn kontrolliert neu. Identische
Rückfrageschleifen sind auf zwei Stufen begrenzt. Mehrere ausdrücklich
genannte Projekte werden als geführte, rollengeschützte Prüffolge behandelt,
damit kein Projekt still verloren geht. Die Dialogmetadaten verleihen keine
Rechte und jede Folgefrage wird serverseitig erneut geprüft.

Als nächste Ausbaustufe folgen weitere gleichzeitige Teilabsichten innerhalb
derselben Fachdomäne, insbesondere gemischte Prüfziele für einen Datensatz
und geführte Folgen über unterschiedliche Datensatzarten.

Umsetzungsstand 28.07.2026 – Teilanliegen-Orchestrierung: Gleichzeitige
Lese- und Prüfziele innerhalb derselben Fachdomäne werden als typisierte
Arbeitsfolge mit höchstens fünf Teilaufträgen geführt. JARVIS fragt nach dem
Startpunkt, merkt die übrigen erlaubten Teile vor und bietet nach jedem
Ergebnis den nächsten noch offenen Schritt klickbar an. Für ein ausdrücklich
genanntes Projekt bleiben Projektreferenz und Prüfumfang getrennt erhalten;
damit können beispielsweise Planung, Stempelungen, Aufgaben,
Abrechnung und Automatik nacheinander geprüft werden, ohne dass der zweite
Teil still verloren geht. Auch mehrere Datensatzarten wie Angebote und
Rechnungen werden in dieser Folge behandelt. Jeder Teil wird bei seiner
Ausführung erneut über Sitzung, effektive Rolle, Organisation, Action
Registry und Datenklasse geprüft. Entfallene Rechte entfernen einen
Folgeschritt, ohne andere erlaubte Teile zu blockieren. Die Sequenz ist
deterministisch, rein lesend und verursacht weder zusätzliche
OpenAI-Aufrufe noch Prisma-/Datenbankänderungen.

Als nächster Dialogbaustein folgen komplexere Folgen über mehrere
Fachdomänen und mehrdimensionale Kombinationen aus mehreren Projekten,
Prüfumfängen und Zeiträumen. Solche großen Aufträge müssen bewusst begrenzt,
verständlich priorisiert und ohne stilles Weglassen zerlegt werden.

Umsetzungsstand 28.07.2026 – mehrdimensionale Dialogfolgen: Mehrere erlaubte
Fachdomänen und mehrere Zeiträume bleiben nach der ersten Auswahl als
typisierte Folge erhalten. Diese Folge wird auch über den technisch getrennten
Vertriebs-/BWL-Antwortpfad weitergegeben und bei jedem Schritt erneut gegen
Sitzung und effektive Rolle geprüft. Kombinationen aus mehreren Projekten und
mehreren Prüfumfängen werden bis zu fünf Einzelprüfungen vollständig
vorgemerkt. Größere Matrizen werden mit ihrer tatsächlichen Anzahl transparent
begrenzt und verlangen zuerst die Auswahl eines Prüfumfangs; es wird kein
Projekt und kein Prüfschritt still abgeschnitten. Clientseitig zurückgesendete
Folgemetadaten werden streng validiert, verleihen keine Rechte und werden nie
als Aktionsfreigabe gewertet.

Damit ist der sichere Orchestrierungskern von Phase 3a für die derzeit
freigegebenen Lese- und Prüfanliegen geschlossen. Als nächster fachlicher
Ausbau folgt die tiefere, projektartabhängige Diagnose von Projekt,
Abrechnung, Automatiken, Materialverbrauch und wirtschaftlichen
Zusammenhängen. Schreibende JARVIS-Aktionen bleiben weiterhin einer späteren
Phase mit Vorschau und ausdrücklicher Bestätigung vorbehalten.

Qualitätsschicht 28.07.2026: Die bis dahin verteilte Erkennung von
Projektreferenzen, Monatsangaben, Projektprüfumfang, verbundenen
Ursache-Wirkungs-Fragen und Antworttiefe wurde in eine zentrale, typisierte
Fragesemantik überführt. Dialogrouter und Projektdiagnose verwenden damit
dieselbe Auswertung. Monatsnamen mit Jahreszahl können nicht mehr als
Projektnummer in den Mehrprojektpfad gelangen; Formulierungen wie
`vollständig geplant` werden von einem vollständigen Projektcheck getrennt;
Stempelung-zu-Rechnungsentwurf bleibt eine gemeinsame Abrechnungskette.
Monatsangaben ohne Jahreszahl werden im laufenden Arbeitskontext dem aktuellen
Kalenderjahr zugeordnet; ein bloßer Angebotsentwurf bleibt davon abgegrenzt.

Eine globale Antworttiefen-Regel kürzt fokussierte Warum-, Status- und
Monatsfragen auf höchstens die wesentlichen Befunde sowie den sicheren
nächsten Schritt. Prüfwert, Bereichsbewertung und vollständiger
Diagnoseumfang bleiben ausdrücklichen Prüf- und Analyseaufträgen vorbehalten.
Die automatisch erzeugte Evaluationsmatrix variiert Projekte, sämtliche
deutschen Monatsnamen, Synonyme, verbundene Fachbereiche und typische
Schreibfehler. Neue Fachadapter müssen künftig nicht nur Beispielsätze,
sondern ganze Fragefamilien und ihre verbindlichen Routing- und
Antwortinvarianten ergänzen.

Hybride Intent-Ergänzung 28.07.2026: Die regelbasierte Absichtsschicht bleibt
für bekannte, eindeutige Fragen führend. Ein strukturierter KI-Fallback darf
ausschließlich bei unerkannter oder niedriger Konfidenz ergänzen. Das Modell
klassifiziert nur Bedienung, Lesen, Diagnose, Analyse, spätere
Aktionsvorbereitung oder Unklarheit und kann nur IDs aus dem vorhandenen
Bedienhilfekatalog auswählen. Rechte, Datenzugriffe, Datensatzauflösung und
Ausführung werden davon nicht abgeleitet. Direkte Termin-Bedienfragen werden
vor dem Projekt-Diagnosepfad geschützt; unklare Terminabsichten führen zu
einer klickbaren Auswahl zwischen Erklärung und Projektprüfung.
Terminaktionen selbst bleiben Phase 4.

Projekt-Materialanalyse 28.07.2026: Der erste Baustein der tieferen
wirtschaftlichen Projektdiagnose wertet fertige Rechnungspositionen eines
Projekts positionsweise aus. Identische Positionen werden addiert und nicht
anhand ihres Namens entfernt. Artikel in Paketen zählen ausschließlich über
die auf der Rechnung gespeicherte historische Paketzusammensetzung.
Abgerechnete Materialmengen werden mit den zugehörigen automatischen
Lagerentnahmen und Gegenbuchungen verglichen. JARVIS erklärt dabei
verbindlich, dass Rechnung und Lagerbewegung keinen tatsächlich physischen
Baustellenverbrauch beweisen. Fehlende historische Paket- oder
Materialkostenstände werden als Datenlücke ausgewiesen und nicht mit heutigen
Stammdatenwerten erfunden. Der Adapter bleibt organisationsgebunden,
rollengerecht und rein lesend.

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

Umsetzungsstand 29.07.2026 – gehärteter Browser-Standardsprachmodus: Push-to-talk,
Transkriptkorrektur sowie opt-in Vorlesen mit Stop/Stumm sind im gemeinsamen
Composer umgesetzt. Gesprochene Eingaben werden nie automatisch gesendet,
sondern erst nach sichtbarer Korrekturmöglichkeit bewusst bestätigt und danach
wie Texteingaben serverseitig geprüft. Roh-Audio wird nicht an WorkPilot360
übertragen oder dort gespeichert. Browser ohne die erforderlichen Web-Speech-
Funktionen behalten einen vollständig funktionsfähigen Textchat. Der reale
Push-to-talk-Basislauf mit freigegebenem Mikrofon in Google Chrome ist
bestanden. Fehler-, Stille-, Ende- und Cleanup-Zustände sind zusätzlich
automatisiert abgesichert. Noch offen bleiben bewusst weiterführende
Sprechbeginn-/Sprechende-Automatik, Audio-Kosten- und Sitzungsgrenzen sowie ein
späterer ausdrücklich gewählter Realtime-Modus.

### Phase 4: Starkes Action Center 1.0

Stand 30.07.2026: Der erste vollständige Vertikalschnitt für Aufgaben ist
produktiv technisch, fachlich und sicherheitlich abgenommen. Eine eindeutig formulierte
Aufgabenanlage erzeugt zunächst ausschließlich einen 15 Minuten gültigen,
serverseitig persistierten Entwurf. Er ist an Organisation, serverseitige
Sitzung, Sitzungs- und effektiven Akteur, beide Rollen und einen möglichen
Impersonationszustand gebunden. Payload und Kontext werden gehasht und mit
einem serverseitigen HMAC-Integritätstag geschützt. Der gespeicherte
Projektstand wird vor der Ausführung erneut geprüft.

Verantwortlichkeit und Fälligkeit bleiben Pflichtfelder. Nach ihrer Ergänzung
muss der sichtbare Stand erneut geprüft werden; ungeprüfte lokale Änderungen
sperren die Bestätigung. Alle Mutationen sind revisionsgebunden, sodass ein
veralteter Tab keinen neueren Entwurf ändern, abbrechen oder ausführen kann.
Erst der bewusste Klick auf `Aufgabe jetzt anlegen` beansprucht den Entwurf
atomar in derselben Datenbanktransaktion und ruft den bestehenden
rollengeprüften Task-Service auf. Der Service lädt Akteur, Verantwortlichen und
Projekt unmittelbar vor dem Schreiben im richtigen Mandanten neu. Doppelklick,
Wiederholung und Replay geben das bereits gespeicherte Ergebnis zurück und
erzeugen keine zweite Aufgabe. Erfolg wird erst nach bestätigtem
Datenbankzustand angezeigt; der neue Datensatz kann ohne Reload geöffnet
werden.

Abbruch, Ablauf, Rollen-/Session-/Organisationswechsel, manipulierte Payloads,
veralteter Projektkontext, unzulässige Zuweisung und parallele Änderung laufen
fail-closed. Die Auditfolge dokumentiert Erstellung, Vervollständigung,
Abbruch/Ablauf, Fehler sowie bestätigte Ausführung. Der additive Prisma-Diff
enthält ausschließlich die beiden Entwurfs-/Auditmodelle, deren Indizes und
Fremdschlüssel. Nach verifiziertem Serverbackup und kontrolliertem
WorkPilot360-Deployment bestanden 110/110 menschennahe Fragen mit zusätzlicher
qualitativer Bewertung sowie zehn weitere Aufgaben-Aktionsfälle. Der
produktive Browser-/Datenbanklauf bestätigte Abbruch ohne Aufgabe,
Recheck-Sperre nach einer Änderung und bestätigten Doppelklick mit exakt einer
Aufgabe und genau einem Ausführungs-Audit. Fehlerlog, Mandant, Fremdprozess
und HTTP-Health blieben sauber.

Der zweite vollständige Vertikalschnitt ist der persistente Termin- und
Terminwunsch-Entwurf. Er übernimmt Organisation, Sitzung, beide Akteure,
Rollenpaar, Impersonationsstatus, 15-Minuten-TTL, Revision,
Payload-/Kontexthashes, HMAC-Integrität, Audit, Abbruch und Replay-Schutz vom
Aufgabenentwurf. Nach jeder sichtbaren Bearbeitung ist eine neue serverseitige
Prüfung Pflicht; ein veralteter Stand kann weder abbrechen noch bestätigen.

Die Oberfläche weist Berliner Datum/Zeit, aktive Person, Rolle und Terminart,
Projektstand, Board/Gruppe, vorhandene gleichartige Projektplanung,
Überschneidung, genehmigte Abwesenheit, Bundesland-Feiertag, Wochenende,
Projektart und Abrechnungsweg einzeln als bestanden, Warnung oder Blockade
aus. Gleichartige Projektplanung, Abwesenheit, ungültige Zeit, fehlender oder
veränderter Projektkontext, inaktive Person, fehlende Planungsgruppe und
unzulässige Rolle blockieren fail-closed. Überschneidung, Feiertag und
Wochenende sind bewusst sichtbare Warnungen, weil auch der vorhandene
Planning-Service diese Fälle nicht pauschal verbietet.

Der erste echte Live-Doppelklicktest bestätigte Exactly-once, zeigte aber
zugleich, dass die damalige allgemeine JARVIS-Maske fachlich zu klein war.
Diese Lücke ist am 30.07.2026 geschlossen worden. Normale Planung,
Terminwunsch und JARVIS verwenden nun denselben serverseitigen
Planungs-Batch. Einmalprojekte verlangen Beschreibung, aktives finales
Angebot, dessen Stundenkontingent und den im Angebot gespeicherten
Ausführungsmonat. Stunden-Dauerläufer verlangen Beschreibung, Termin-Gewerk
und eine aktive planungsrelevante Abrechnungsleistung desselben Gewerks.
Monatspauschalen prüfen für jeden betroffenen Serienmonat das freie
Monatskontingent. Alle Varianten können mehrere Mitarbeitende buchen;
Terminserien sind auf Dauerläufer begrenzt.

Mitarbeitende können nur einen eigenen Terminwunsch anlegen. Führung,
Geschäftsführung und Admin können Termin oder Terminwunsch für aktive
Personen vorbereiten. Die spätere bewusste Bestätigung beansprucht den Entwurf,
prüft den Projektstand nochmals und delegiert genau einen Aufruf an den
gemeinsamen Batch-Service. Die Entwurfs-ID ist zugleich der idempotente
Planungsschlüssel. Eine serialisierbare Transaktion schreibt Batch, alle
Mitarbeiter-/Serientermine, Historien und Meldungen vollständig oder gar
nicht. Deterministische Termin-IDs, Payload-Hash und gespeichertes Ergebnis
sichern Doppelklick, Wiederholung und Replay ab.

Übersteigt die Planung das Angebots- oder Monatskontingent, ist der
Bestätigungsbutton gesperrt, bis der aktuelle serverseitige
Überplanungs-Fingerprint und eine Begründung ab zehn Zeichen gemeinsam erneut
geprüft wurden. Der Fingerprint bindet Projektstand, Angebot, Personen,
Termine, Serie und Kontingent. Grund und Art werden am Batch und an den
Terminen gespeichert, im Planungsaudit dokumentiert und dedupliziert an
Führung/Geschäftsführung/Admin gemeldet.

Finaler Produktionsstand dieses Vertikalschnitts ist `93fd70f`. Vor dem
Deployment wurde das separate Backup
`/var/backups/workpilot360/before-jarvis-tailored-planning-clarifications-20260730T100824Z`
mit Git-Bundle, Archiv der getrackten Dateien, PostgreSQL-Dump und
SHA-256-Prüfung vollständig verifiziert. 102 Testdateien mit 1.173/1.173
Unit-/Integrationstests, TypeScript, Regressions-/Mojibake-Checks,
Prisma-Validierung, leerer Schema-vs.-Datenbank-Diff, `git diff --check` und
Produktionsbuild waren grün. Das Deployment betraf ausschließlich
WorkPilot360; der Klinikprozess blieb unverändert.

Direkt danach wurde über die sichtbare Produktionsoberfläche ein vollständig
neuer 110er-Lauf ausgeführt. 110/110 Antworten wurden ausgeliefert, ohne
technischen Fehler oder leere Antwort. Entscheidend war nicht nur die
Antwortexistenz: Jede Antwort wurde manuell nach konkreter Fragerelevanz,
fachlicher Richtigkeit, Angemessenheit, Datenbasis, Handlungsnutzen und
Sicherheitsverhalten bewertet. Mehrere vorher technisch grüne Läufe wurden
wegen pauschaler oder wiederholter Antworten verworfen. Im finalen Stand
antworten Prinzipien-, Datenschutz-, Führungs-, Priorisierungs-,
Planungskonflikt- und Sicherheitsfragen fokussiert; unvollständige
Terminangaben nennen nur die tatsächlich noch fehlenden Pflichtangaben. Der
UI-Lauf benötigte im Mittel 4,95 Sekunden und p95 5,44 Sekunden. 50
öffentliche Dashboard-Aufrufe lagen bei durchschnittlich 70,8 ms und p95
159,9 ms.

Die damalige Abnahme des Entwurfslebenszyklus bleibt als Sicherheitsnachweis
gültig; die dabei noch aktive Blockade `Projektartgerechte Terminmaske` ist
entfernt. Die vollständige Produktionsabnahme des Planungscodes `92fbbd2`
ist abgeschlossen. Das Sicherheitsbundle
`.codex-safety/before-jarvis-project-planning-masks-20260730-135215.bundle`,
das Serverbackup
`/var/backups/workpilot360/before-jarvis-project-planning-20260730T123317Z`
und der exakte Vor-Cleanup-Nachweis
`/var/backups/workpilot360/qa-release-0d23d19-before-cleanup-20260730T1414Z.json`
mit SHA-256
`c19ff1ca3e57315a4cfb8c4b871bd2e03ab44ed67c61de38f983d8c2fba7be8d`
sind vorhanden.

105 Testdateien mit 1.219/1.219 Tests, TypeScript, Regression, Mojibake,
Prisma-Validierung, leerer Schema-/Datenbank-Diff, Diff-Check und
Produktionsbuild mit 89 Seiten sind grün. Der vollständige sichtbare
JARVIS-Lauf bestand 110/110 Fragen. Die zusätzliche finale Live-Abnahme
bestätigte die projektbezogene Maskenantwort für Einmalprojekt und
Monatspauschale sowie den produktiven Fachdialog für
Stunden-Dauerläufer-Felder, Mehrmitarbeiter-Serie, Überplanung und identische
Termin-/Terminwunsch-Fachregeln. Mangels eines tatsächlich als
Stundenabrechnung konfigurierten produktiven Dauerläufers wurde kein
Bestandsprojekt dafür umgedeutet; die Variante bleibt durch deterministische
Produktionsantwort und Variantentests belegt.

Der kontrollierte Mehrpersonen-Überplanungs-Terminwunsch und die kontrollierte
Mehrpersonen-Monatsserie bestanden jeweils Exactly-once-Replay,
Payload-Konflikt mit HTTP 409, Batch-, Historien- und
Benachrichtigungsprüfung. Der exakte Cleanup stellte Projekt und Angebot
wieder her; danach verblieben keine QA-Termine, -Historien, -Meldungen oder
-Batches. 50 öffentliche Dashboard-Aufrufe lagen zuletzt bei 169 ms im
Mittel und 192,1 ms p95. HTTP war 200, das Fehlerlog blieb seit
13:57:40 UTC unverändert bei 146.549 Zeilen. WorkPilot360 wurde ausschließlich
allein deployed; `kliniknavigator` blieb mit PID 242528 unangetastet.

Produktive Terminanlage und projektartgerechte JARVIS-Masken sind damit
fachlich, technisch und sicherheitlich freigegeben.

Der dritte vollständige Action-Center-Vertikalschnitt ist die manuelle
Zeiterfassung. Eine natürlich formulierte Erfassung oder rückwirkend
nachzutragende Stempelung erzeugt einen 15 Minuten gültigen, persistenten
Entwurf; Starten, Pausieren, Fortsetzen und Stoppen einer laufenden
persönlichen Stempelung bleiben ausdrücklich außerhalb dieses Schritts.
Projektzeit und unproduktive Zeit, eigener Mitarbeitender und rollenberechtigte
Erfassung für andere, Datum, Beginn, Ende, Pause, Kommentar, Abschlussstatus
und Überstundenstatus werden serverseitig geprüft. Die Arbeitsdauer wird
ausschließlich aus dem bestätigten Zeitfenster abzüglich Pause berechnet.

Die fachliche Maske folgt dem tatsächlichen Projekt: Einmalprojekte verlangen
ein aktives finales Angebot oder eine bewusst begründete Erfassung ohne
Angebotszuweisung. Stunden-Dauerläufer verlangen Gewerk und eine aktive,
positive, planungsrelevante Stundenleistung desselben Gewerks.
Monatspauschalen benötigen keinen erfundenen Angebots- oder Leistungskontext.
Irrelevante, manipulativ mitgesendete Felder werden vor der Bestätigung
kanonisch entfernt. Mitarbeitende dürfen ausschließlich eigene explizit
manuelle Zeiten erzeugen; die bestehende WorkPilot-Berechtigung entscheidet
über Einträge für andere und Überstundenfreigaben.

Normale manuelle Zeitmaske und JARVIS delegieren an denselben zentralen
`project-time-entry-service`. Er lädt Person, Projekt, finales Angebot,
Abrechnungsleistung und Kostenbasis organisationsgebunden neu, schützt
fremdmandantlich gebundene Ausführungs-IDs und bewahrt den bestehenden
Stempelungsweg. Die Bestätigung prüft Sitzung, Organisationsbindung,
Sitzungs-/Effektivrolle, Impersonation, Revision, TTL, Integrität und den
aktuellen Fachstand erneut. Zeitdatensatz, genau ein deduplizierter
Projektlogbuchnachweis, Entwurfsstatus und Audit werden in derselben
serialisierbaren Transaktion gespeichert. Doppelklick und Replay liefern den
bereits erzeugten Datensatz zurück.

Für alle weiteren Action-Center-Schritte gilt verbindlich: Die Formulierung
`noch nicht freigegeben` ersetzt keine Entwicklung. Jede gesperrte Fähigkeit
wird als eine der folgenden Klassen geführt:

1. Die WorkPilot-Funktion existiert, besitzt aber noch keinen sicheren
   JARVIS-Adapter. Dann wird der vollständige Vertikalschnitt geplant und
   gebaut.
2. Der JARVIS-Weg ist begonnen, aber fachlich unvollständig. Dann bleibt er
   fail-closed und die fehlenden Masken, Pflichtfelder und Prüfungen sind der
   konkrete nächste Entwicklungsschritt. Die Terminmasken sind seit
   30.07.2026 nicht mehr in dieser Klasse; die manuelle Zeiterfassung ist
   ebenfalls als vollständiger Vertikalschnitt umgesetzt.
3. Die Aktion ist wegen hoher rechtlicher, finanzieller, personeller oder
   irreversibler Wirkung bewusst gesperrt. Eine spätere Freigabe benötigt
   einen eigenen Beschluss und den vollständigen Sicherheitsnachweis; ein
   Konfigurationsschalter allein genügt nie.
4. Die Fähigkeit liegt außerhalb des aktuell beschlossenen Umfangs. JARVIS
   benennt das konkret, ohne vorzutäuschen, die Funktion sei technisch bereits
   fertig.

Eine pauschale Nichtfreigabe trotz vorhandener sicherer Hilfe oder aufgrund
eines Routingfehlers gilt in menschenähnlichen Tests als Qualitätsfehler.
Roadmap und Abnahmebericht sollen deshalb künftig pro gesperrter Fähigkeit
Grundklasse, fehlende Bausteine, nächsten Entwicklungsschritt und
Freigabekriterium ausweisen.

Projektlogbuch- und Aufgabenkommentar-Schreibwege sind seit 31.07.2026 als
vollständige textbasierte Vertikalschnitte umgesetzt. Natürliche Wünsche
führen in einen persistenten Entwurf mit eindeutiger Zielauswahl, sichtbarem
Text, optionalem Aufgabenbeteiligten und bewusster Bestätigung. Sitzung,
Organisation, Session- und Effektivrolle, Archivstatus, Aufgabenbeteiligung,
Revision, Ablauf und aktueller Zielstand werden vor dem Schreiben erneut
geprüft. Normale Masken und JARVIS verwenden gemeinsame Fachservices.
Exactly-once, Entwurfsaudit, Aufgabenhistorie, vorhandene Benachrichtigungen
und UI-Refresh sind Bestandteil des Vertrags. Datei-/Bildanhänge und autonome
Mailaktionen sind ausdrücklich nicht Teil dieses Schnitts.

Der vierte Action-Center-Vertikalschnitt für Angebote und Nachträge ist am
31.07.2026 technisch umgesetzt und auf Code-Commit `5864a1c` produktiv
abgenommen.
Natürliche Erstellungswünsche öffnen einen persistenten, bearbeitbaren
Entwurf; reine Fragen, Suchen, Statusabfragen sowie Versand-, Lösch- und
Archivbefehle werden nicht als Entwurfsanlage umgedeutet. Projekt,
Absenderfirma, Dokument- und Nachtragsart, Bezugsangebot,
Ausführungszeitraum, Katalogpositionen, Mengen, Einzelpreise,
Positions-/Gesamtnachlass, Umsatzsteuer und Texte bleiben vor der
Bestätigung sichtbar. Fehlende Angaben blockieren; Preisabweichungen vom
aktuellen Katalog werden ausdrücklich ausgewiesen.

Normale Angebotsmaske und JARVIS verwenden dieselbe zentrale Normalisierungs-
und Rechenlogik. Der JARVIS-Speicherdienst lädt Projekt, Kontakte,
Katalogpositionen und Bezugsangebot im Mandanten neu und erzeugt
ausschließlich den Status `Entwurf` samt Historie. Die globale
Angebotsnummer wird innerhalb der serialisierbaren Bestätigung durch einen
organisationsgebundenen PostgreSQL-Advisory-Lock geschützt. Rollenpaar,
Impersonation, Sitzung, Organisation, Revision, TTL, HMAC,
Kontext-Fingerprint, Audit und atomare Exactly-once-Beanspruchung sind
Bestandteil des Vertrags. Versand, Gewonnen/Verloren und Löschung bleiben
getrennte, nicht durch diesen Entwurfs-Vertikalschnitt freigegebene Aktionen.

Die kontrollierte Finalisierung eines vorhandenen Angebotsentwurfs ist seit
31.07.2026 als eigener kritischer Vertikalschnitt umgesetzt. JARVIS trennt
`finalisieren` strikt von Entwurfserstellung, Versand, Gewonnen/Verloren,
Löschung und bloßen Statusfragen. Die Vorschau lädt Angebot, Projekt,
Bezugsangebot, Positionen, Katalogstände, Ausführungszeitraum und Summen im
Mandanten neu, zeigt die Prüfung sichtbar an und bindet den vollständigen
Fachstand in einen SHA-256-Fingerprint. Fehlende Pflichtdaten, inkonsistente
Summen, ein anderer Status oder ein veralteter Kontext blockieren fail-closed.
Erst die exakt sichtbare, groß-/kleinschreibungssensitive Phrase
`ANGEBOT FINALISIEREN ANG-...` darf ausführen.

Normale Angebotsmaske und JARVIS nutzen dieselbe zentrale Angebotsvalidierung,
Kalkulation und PDF-Erzeugung. In einer serialisierbaren Transaktion unter
organisations- und angebotsgebundenem PostgreSQL-Advisory-Lock wechselt genau
ein unveränderter Entwurf bedingt auf `Erstellt`, erhält sein finales PDF und
genau ein Historienereignis. Organisation, Sitzung, Rollenpaar, Impersonation,
Revision, TTL, HMAC, Fingerprint, Audit und Exactly-once-Replay sichern die
Aktion. Sie löst bewusst keinen Versand, keine Gewonnen-/Verloren-Markierung,
keine Aufgabe und keine automatische Projektstatusänderung aus.

Die lokale Abnahme bestand 136 Testdateien mit 1.454 Tests, TypeScript,
Regressionscheck, Prisma-Validierung und den 90-Seiten-Produktionsbuild. Der
permanente Korpus bestand 110/110 und bereitete die neue
`offer.finalize`-Vorschau real vor, ohne eine Aktion auszuführen oder QA-Daten
zu hinterlassen. Die isolierte Ausführungs-QA wies eine falsche Phrase mit
HTTP 400 ab, finalisierte danach genau ein Angebot, erzeugte ein vollständiges
PDF und ein Historienereignis und bestätigte beim Replay dieselbe Entität.
Versand, Aufgaben, Projektstatus und Gewonnen/Verloren blieben unverändert;
der echte sichtbare Klicktest bestätigte denselben Ablauf ohne Browserfehler.

Der kontrollierte Versand eines finalisierten Angebots ist seit 31.07.2026
als eigener kritischer Vertikalschnitt umgesetzt. JARVIS akzeptiert nur
Angebote im Status `Erstellt` mit gespeichertem finalem PDF und trennt den
Versand strikt von Finalisierung, Gewonnen/Verloren, Aufgaben und
Projektstatus. Die Vorschau zeigt Angebot, Projekt, Kunde, Absender, Summen,
Empfänger, CC/BCC, Betreff, Nachricht, PDF-Datei mit Größe und SHA-256 sowie
die bewusste Entscheidung, ob ein 30 Tage gültiger digitaler Annahmelink
enthalten sein soll. Jede Änderung muss serverseitig neu geprüft werden.
Erst die exakte, groß-/kleinschreibungssensitive Phrase
`SENDEN ANG-... AN <Empfänger>` darf den Versand auslösen.

JARVIS verwendet denselben `/api/document-mail`-Fachweg wie die normale
Angebotsmaske. Damit bleiben Microsoft 365, PDF-Anhang, optionaler
Annahmelink, Privatkunden-Widerrufsunterlagen, Versandprotokoll und
`email_sent`-Angebotshistorie identisch. Organisation, Sitzung, Rollenpaar,
Impersonation, Revision, TTL, HMAC, Angebot/PDF/Empfänger/Absender-Fingerprint
und die eindeutige Dispatch-ID sichern Vorschau und Ausführung. Replay liefert
keinen zweiten Versand; laufende, bereits zugestellte oder technisch unklare
Zustände werden fail-closed zur manuellen Prüfung gesperrt. Der Versand setzt
weder Gewonnen/Verloren noch Aufgaben oder Projektstatus.

Die lokale und produktive Abnahme bestand 137 Testdateien mit 1.463 Tests,
TypeScript, Prisma-Validierung, leerem Live-Diff, dem 90-Seiten-Build und
jeweils 110/110 permanenten Livefragen. `offer.send` wurde dabei real als
persistente Vorschau vorbereitet, aber nicht bestätigt; es entstanden keine
E-Mail und keine QA-Rückstände. Der sichtbare Klicktest prüfte vollständige
Felder, PDF-Bindung, Betreffänderung, Umschaltung des Annahmelinks, erneute
Prüfung und Abbruch ohne Browserfehler. Eine echte externe Testzustellung war
nicht möglich, weil aktuell kein Führungs-/GF-Benutzer ein verbundenes
Microsoft-365-Konto besitzt; dieser bestehende betriebliche
Konfigurationsblocker wird sichtbar und sicher ausgewiesen. Der
Zustelladapter selbst ist mit Erfolgs-, Stale-, Fehler- und Uncertain-Fällen
gegen den gemeinsamen Versandweg getestet.

Die kontrollierte Gewonnen-/Verloren-Entscheidung eines finalisierten Angebots
ist seit 31.07.2026 als eigener kritischer Vertikalschnitt umgesetzt. JARVIS
trennt sie strikt von Angebotssuche, Finalisierung, Versand, Löschung,
Aufgaben und Projektstatus. Beide Entscheidungen verlangen einen Grund; bei
`Verloren` ist zusätzlich ein Kommentar Pflicht. Die Vorschau zeigt Angebot,
Projekt, Kunde, Netto/Brutto, Entscheidung, Begründung, aktuelle Prüfungen und
die ausdrücklich abgegrenzten Folgen. Aktive verknüpfte Rechnungen blockieren
eine Verlustentscheidung. Erst die exakte, groß-/kleinschreibungssensitive
Phrase `ANGEBOT GEWINNEN ANG-...` beziehungsweise `ANGEBOT VERLIEREN ANG-...`
darf ausführen.

Der gemeinsame Angebotsentscheidungsdienst lädt den vollständigen Fachstand
mandantengebunden neu und bindet ihn in einen SHA-256-Fingerprint. Sitzung,
Organisation, Rollenpaar, Impersonation, Revision, TTL, HMAC, Audit,
serialisierbare Transaktion, organisations- und angebotsgebundener
PostgreSQL-Advisory-Lock, bedingtes Exactly-once-Update und Replay sichern die
Aktion. In derselben Transaktion ändern sich ausschließlich Angebot,
Angebotshistorie und Projektlogbuch. Projektstatus, Termine, Aufgaben,
Rechnungen und Versand bleiben unverändert.

Zusätzlich behandelt die Angebotsleselogik Füllwörter wie `mal` korrekt und
löst bekannte Kontakte organisationsgebunden auf. Für die natürliche Frage
`zeig mal alle oKW Angebote` lautet die belegte leere Antwort nun verständlich:
`Für OKW GmbH sind aktuell keine Angebote in WorkPilot360 vorhanden.`

Die lokale und produktive Abnahme auf Code-Commit `f74a8d0` bestand 138
Testdateien mit 1.473 Tests, TypeScript, Prisma-Validierung, leerem Live-Diff,
dem 90-Seiten-Build und dem permanenten Korpus mit 110/110 Fragen. Vierzehn
Action-Center-Entwürfe wurden vorbereitet, aber keine Korpusaktion ausgeführt;
QA-Rückstände blieben null. Die isolierte Produktions-QA bestand Gewinn,
Verlust, sicheren Abbruch, falsche Phrase, Exactly-once-Replay, je zwei
Historien- und Logbucheinträge sowie die Abwesenheit unerlaubter
Nebenwirkungen. Der sichtbare produktive Klicktest bestätigte die klare
OKW-Antwort, vollständige kritische Angebotskarte, exakte Phrase und sicheren
Abbruch ohne Browserfehler; alle UI-QA-Daten wurden bereinigt. Das Backup liegt
unter `/var/backups/workpilot360/20260731-230000-jarvis-offer-decision`.

Das kontrollierte Löschen und Wiederherstellen eines Angebots ist seit
31.07.2026 als eigener kritischer Vertikalschnitt umgesetzt. JARVIS trennt
beide Wünsche strikt von Suche, Finalisierung, Versand, Gewonnen/Verloren,
Aufgaben und Projektstatus. Die Vorschau zeigt Angebot, Projekt, Kunde,
Status, Summen, Begründung und die ausdrücklich abgegrenzten Folgen. Ein
dokumentierter Grund mit mindestens drei Zeichen ist Pflicht. Erst die exakt
sichtbare, groß-/kleinschreibungssensitive Phrase `ANGEBOT LÖSCHEN ANG-...`
beziehungsweise `ANGEBOT WIEDERHERSTELLEN ANG-...` darf ausführen.

Die normale Angebotsmaske und JARVIS verwenden denselben
organisationsgebundenen Soft-Delete-Fachservice. Aktive verknüpfte Rechnungen
und digital angenommene Angebote blockieren eine Löschung. Noch nicht
angenommene Annahmelinks werden beim Löschen widerrufen und beim
Wiederherstellen nicht heimlich reaktiviert. Der vorherige Angebotsstatus
wird in der Historie gesichert; Altdaten erhalten eine nachvollziehbare
Statusableitung. Angebot, Historie und Projektlogbuch ändern sich gemeinsam
oder gar nicht. Projektstatus, Termine, Aufgaben, Rechnungen und Versand
bleiben unverändert.

Sitzung, Organisation, Rollenpaar, Impersonation, Revision, TTL, HMAC,
Fachfingerprint, serialisierbare Transaktion, organisations- und
angebotsgebundener PostgreSQL-Advisory-Lock, bedingtes Update, Audit und
Exactly-once-Replay sichern den Vorgang. Die lokale und produktive Abnahme auf
Code-Commit `3fce1276f856153f21cb15124ad1d5a5d885f391` bestand 139 Testdateien
mit 1.481 Tests, TypeScript, Prisma-Validierung, leerem Live-Diff, dem
90-Seiten-Build und dem permanenten Korpus mit 110/110 Fragen. Fünfzehn
Action-Center-Entwürfe einschließlich `offer.delete` wurden vorbereitet, aber
keine Korpusaktion ausgeführt. Die isolierte Produktions-QA bestand Löschen,
Wiederherstellen, Abbruch, falsche Phrase, Exactly-once-Replay, Historie,
Logbuch und die Abwesenheit unerlaubter Nebenwirkungen. Der echte produktive
Klicktest bestätigte vollständige kritische Karten, exakte Phrasen und das
sichtbare Archiv mit Wiederherstellen-Aktion ohne Browserfehler. Ein im
Klicktest entdeckter Fehlgriff auf `Listen` innerhalb der Begründung wurde
behoben und mit einem Regressionstest abgesichert; sämtliche QA-Daten wurden
danach bereinigt. Das Backup liegt unter
`/var/backups/workpilot360/20260731-234000-jarvis-offer-lifecycle`.

Das kontrollierte Löschen und Wiederherstellen von Rechnungsentwürfen ist seit
01.08.2026 als eigener kritischer Vertikalschnitt umgesetzt. JARVIS trennt
beide Wünsche strikt von Rechnungssuche, Entwurfserstellung, Fakturierung,
Versand, Mahnung, Bezahlt-Markierung, Storno und Korrektur. Die Vorschau zeigt
Rechnung, Projekt, Kunde, Status, Summen, Grund, Stempel-, Lager- und
Versandverknüpfungen sowie die abgegrenzten Folgen. Erst die exakt sichtbare,
groß-/kleinschreibungssensitive Phrase `RECHNUNG LÖSCHEN RE-...`
beziehungsweise `RECHNUNG WIEDERHERSTELLEN RE-...` darf ausführen.

Nur ein unverarbeiteter Status `Entwurf` darf soft-gelöscht werden. Bezahlte,
versendete, gemahnte, fakturierte, zeit- oder lagerverknüpfte Rechnungen sowie
Belege mit Folgebelegen bleiben fail-closed und werden über Storno oder
Korrektur berichtigt. Eine Altlöschung ohne zuverlässig dokumentierten
Vorstatus wird nicht automatisch wiederhergestellt. Normale Rechnungsmaske und
JARVIS verwenden denselben Fachservice; das sichtbare Projektarchiv bietet die
kontrollierte Wiederherstellung an. Positionen, Entwurfs-PDF, Zahlungen,
Mahnungen, Stempelungen, Lager, Versand, Angebote und Projektstatus bleiben
unverändert. Rechnungshistorie und Projektlogbuch werden gemeinsam oder gar
nicht geschrieben.

Sitzung, Organisation, Rollenpaar, Impersonation, Revision, TTL, HMAC,
SHA-256-Fachfingerprint, serialisierbare Transaktion, organisations- und
rechnungsgebundener PostgreSQL-Advisory-Lock, bedingtes Update, Audit und
Exactly-once-Replay sichern den Vorgang. Die lokale und produktive Abnahme auf
Code-Commit `8b23799f1cab1844c5d56a459b04f23c2e7bd073` bestand 140 Testdateien
mit 1.491 Tests, TypeScript, Regression, Mojibake, Prisma-Validierung, leerem
Live-Diff, dem 90-Seiten-Build und dem permanenten Korpus mit 110/110 Fragen.
Sechzehn Action-Center-Entwürfe einschließlich `invoice.delete` wurden
vorbereitet, aber keine Korpusaktion ausgeführt. Die isolierte Produktions-QA
bestand Sperre fakturierter Rechnungen, Löschen, Wiederherstellen, Abbruch,
falsche Phrase, Exactly-once-Replay, Historie, Logbuch und die Abwesenheit
unerlaubter Nebenwirkungen; alle Rückstände blieben null. Der echte sichtbare
Klicktest bestätigte die vollständigen kritischen Karten, exakten Phrasen,
Projektakte, Archiv, Wiederherstellung und die fehlende Löschaktion bei einer
fakturierten Rechnung ohne Browserfehler. Das Backup liegt unter
`/var/backups/workpilot360/20260801-002500-jarvis-invoice-lifecycle`.

Der fünfte Action-Center-Vertikalschnitt für Rechnungsentwürfe und die
Fakturavorprüfung ist am 31.07.2026 umgesetzt. Natürliche Erstellungswünsche
öffnen einen persistenten, bearbeitbaren Entwurf; reine Rechnungsfragen sowie
Fakturieren, Versand, Mahnung, Bezahlt-Markierung, Storno, Löschung und Suche
werden nicht als Entwurfsanlage umgedeutet. Projekt, Absenderfirma,
Leistungsdatum, Bezugsangebot, Katalogpositionen, Mengen, Einzelpreise,
Positions-/Gesamtnachlass, Umsatzsteuer, Zahlungsziel, Fälligkeit und Texte
bleiben vor der Bestätigung sichtbar.

Die Vorprüfung weist Doppelabrechnungen zum Bezugsangebot, weitere Rechnungen
im Leistungsmonat, Endkontrolle, offene Arbeitszeiten und bei OK immocare
Vorher-/Nachherbilder sowie Tätigkeitsbericht aus. Fehlende Pflichtangaben,
inaktive oder organisationsfremde Katalogpositionen und bereits abgerechnete
Bezugsangebote blockieren. Hinweise bleiben sichtbar, werden aber nicht als
heimliche Fakturafreigabe interpretiert. Normale Rechnungsmaske und JARVIS
verwenden gemeinsame Kernregeln für Datum, Zahlungsziel, Prozente,
Positionsnetto und Rundung.

JARVIS erzeugt ausschließlich eine Rechnung mit Status `Entwurf` samt
Rechnungshistorie. Die nächste globale `RE-...`-Nummer wird innerhalb der
serialisierbaren Bestätigung durch einen organisationsgebundenen
PostgreSQL-Advisory-Lock geschützt. Rollenpaar, Impersonation, Sitzung,
Organisation, Revision, TTL, HMAC, Kontext-Fingerprint, Audit, atomare
Beanspruchung und Exactly-once-Replay entsprechen mindestens dem
Angebotsvertrag. Fakturierung, PDF-/E-Rechnungsfreigabe, Versand, Mahnung,
Bezahlt-Markierung und Storno bleiben eigene kritische Phase-5-Aktionen.

Der sechste Action-Center-Vertikalschnitt setzt die kritische
Rechnungsfinalisierung um. Ein eindeutiger Fakturierungswunsch wird strikt von
Entwurfserstellung, Suche, Versand, Mahnung, Bezahlt-Markierung, Storno und
Löschung getrennt. JARVIS lädt die Entwurfsrechnung organisationsgebunden neu,
führt dieselbe zentrale Fakturavorprüfung erneut aus und zeigt Rechnung,
Projekt, Kunde, Leistungsdatum, Netto/Brutto, Prüfstatus, Warnungen und harte
Blockaden. Der eigene Datensatz wird bei der Doppelrechnungsprüfung korrekt
ausgenommen; veränderte Summen, ein nicht mehr aktueller Fachfingerprint oder
ein anderer Rechnungsstatus sperren fail-closed.

Die Bestätigung benötigt die exakt sichtbare, groß-/kleinschreibungssensitive
Phrase `FAKTURIEREN RE-...`. Organisation, Sitzung, beide Rollen,
Impersonation, Revision, TTL, HMAC, unveränderter Fachkontext,
PostgreSQL-Advisory-Lock, bedingter Statuswechsel von `Entwurf` zu
`Fakturiert`, serialisierbare Transaktion, Audit und Exactly-once-Replay
schützen auch Doppelklick und Wiederholung. Die normale Rechnungsmaske und
JARVIS verwenden dafür denselben `invoice-finalization-service`; eine
erfolgreiche Fakturierung schreibt genau ein Historienereignis. Sie versendet
keine Rechnung, startet keine Mahnung, setzt keine Bezahlt-Markierung und
storniert nichts. Die normale Maske behält ihre bestehende PDF-Erzeugung;
PDF-/E-Rechnungsfreigabe und Versand bleiben getrennte Folgeschritte.

Die lokale echte UI-Abnahme prüfte eine falsche Phrase, die exakte Phrase und
einen Doppelklick. Oberfläche und Datenbank bestätigten genau eine
Fakturierung, null Versand-/Mahn-/Bezahlt-Nebenwirkungen und eine vollständige
Auditspur. Der anschließende authentifizierte Live-Korpus bestand 110/110
Fragen; sieben sichere Entwurfsvorschauen wurden erzeugt, keine Aktion
ausgeführt und alle QA-Daten vollständig bereinigt.

Die produktive Wiederholung auf Code-Commit `5f1eb85` bestätigte die kritische
Phrase und Exactly-once-Sperre im echten Browser sowie genau ein
Fakturaereignis in der Datenbank. Der produktive 110-Fragen-Lauf bestand
110/110 mit null ausgeführten Aktionen; Prisma-Diff und QA-Rückstände sind
leer. Das zugehörige Server- und Datenbankbackup liegt unter
`/var/backups/workpilot360/before-jarvis-invoice-finalization-20260731T111839Z`.

Die bisher nur laufbezogen dokumentierten 110 menschenähnlichen Fragen sind
nun als exakt 110 eindeutige, versionierte Fälle dauerhaft im Repository
verankert. Sie decken Navigation, Projekte, Kunden, Aufgaben, Planung, Zeit,
Kalkulationsrechner, Angebote, Rechnungen, Online-Anfragen und Sicherheit ab.
Jeder weitere JARVIS-Release muss diesen Korpus automatisiert und als
authentifizierten Live-Lauf ausführen; neu erzeugte, unbestätigte QA-Entwürfe
werden anschließend vollständig bereinigt.

Die Modellwahl ist ebenfalls zentralisiert: Luna bleibt der kleine
strukturierte Intent-Fallback, Terra das normale Vertriebs-/Managementmodell.
Sol ist nur für ausdrücklich klassifizierte spätere Komplexanalysen
vorgesehen; Sol Fast ist fail-closed und standardmäßig deaktiviert. Laufzeit,
Status, Token und geschätzte Kosten werden ohne Prompt- oder Fachinhalte
telemetriert.

- Aufgaben und Nachfassaufgaben,
- Termine und Terminwünsche,
- manuelle Zeiteinträge (produktiver Vertikalschnitt; laufende persönliche
  Stempelsteuerung bleibt bewusst separat),
- Kalkulations-Rechner dialoggeführt bedienen, Ergebnisse erklären und
  kontrolliert als unveränderliche Version speichern,
- Logbuch- und Kommentaraktionen (produktiver textbasierter Vertikalschnitt;
  Anhänge bleiben ein eigener Sicherheitsblock),
- Angebote/Nachträge als Entwurf (produktiv abgenommen),
- Angebotsentwürfe kontrolliert finalisieren und als PDF erzeugen,
- Rechnungsentwurf und Fakturavorprüfung (produktiver Vertikalschnitt),
- kontrollierte Rechnungsfinalisierung mit exakter kritischer Phrase,
- kontrollierte Bezahlt-Markierung mit Zahlungsdatum, vollständigem
  Bruttobetrag und exakter kritischer Phrase,
- Dokument-/Mailvorbereitung,
- Vertriebsaktionslisten in Aufgaben überführen,
- UI-Refresh, Audit und Fehlerbehandlung.

Abnahmekriterium: Die häufigsten täglichen Arbeitsvorgänge lassen sich aus dem
Chat vollständig vorbereiten und kontrolliert speichern.

### Phase 5: Kritische Aktionen

- direkter Mailversand nach Vorschau,
- Fakturieren (kontrollierte Einzelrechnung als erster produktiver
  Vertikalschnitt umgesetzt; PDF-/E-Rechnung und Versand bleiben getrennt),
- Bezahlt-Markierung (vollständiger Vertikalschnitt in Releaseabnahme;
  Teilzahlungen bleiben ein eigener späterer Datenmodellschritt),
- Mahnung,
- Stornieren,
- Archivieren/Löschen/Wiederherstellen (Rechnungsentwürfe als erster
  produktiver Vertikalschnitt umgesetzt; fakturierte Belege bleiben bei
  Storno/Korrektur),
- Rollen- und Rechteänderungen,
- berechtigte Personalstammdatenänderungen,
- Massenänderungen mit Dry-Run und Rollback.

Abnahmekriterium: Jede kritische Aktion besitzt dieselben oder stärkere
Sicherheitskontrollen wie die normale UI.

### Phase 6: Vertrieb und BWL

- sichere Vertriebs- und Managementadapter,
- erster rein lesender Unternehmensvergleich für Materialien, Artikelpreise,
  historische Paketbestandteile und Lagerabweichungen über einen festen
  Zwölfmonatszeitraum umgesetzt; physischer Verbrauch bleibt ohne separate
  Erfassung ausdrücklich unbelegt,
- erster rein lesender Unternehmensvergleich für Leistungen und
  Stundenverrechnungssätze über einen festen Zwölfmonatszeitraum umgesetzt;
  die fachlich freigegebenen Standardwerte 18 % Mindest- und 30 % Zielmarge
  erzeugen bei vollständiger historischer Kostenbasis ausschließlich eine
  klar gekennzeichnete vorläufige Teilkostenspanne; weitere Zeiträume und die
  Vollkostenkonfiguration bleiben auszubauen,
- verbundene Kunden-, Projekt-, Angebots-, Rechnungs- und Leistungsansichten,
- Material- und Artikelverbräuche einschließlich Paketbestandteilen
  positionsweise auswerten,
- Leistungen und Stundenverrechnungssätze mit fakturiertem Umsatz,
  zugeordneten Stempelstunden und rollengerecht freigegebenen Kosten
  analysieren,
- aktuelle Einkaufs-/Verkaufspreise mit historischen Kosten-Snapshots,
  tatsächlich erzielten Preisen und Margen vergleichen,
- fundierte Preis- und Anpassungskorridore nur bei ausreichender Datenbasis
  vorschlagen; keine automatische Preisänderung,
- historische Wiederholungs-, Nachfass- und Cross-Selling-Signale,
- regelmäßiger Chancen- und Projektrisiko-Check zunächst im Dry-Run,
- JARVIS-Cockpit und interne Hinweise an berechtigte Mitarbeitende,
- Aufgaben und Kundenmailentwürfe mit verpflichtender menschlicher Prüfung,
- priorisierte Vertriebsaktionen,
- Ursachen- und Trendanalysen,
- deterministischer Kapazitätsadapter für Mitarbeiter, Planungsgruppen und
  Planungsboards mit Zeitraum-, Abwesenheits- und Feiertagsbezug,
- rollengerechte Auslastungsanalyse: Geschäftsführung organisationsweit,
  Führungskräfte nur für ihre zugeordneten Gruppen und Boards,
- konfigurierbare Zielkorridore für Unterauslastung, gesunde Auslastung und
  Überlastung sowie daraus abgeleitete, nachvollziehbare Empfehlungen,
- Verbindung freier Kapazität mit Projektpipeline und Vertriebsbedarf, ohne
  Beschäftigungs-, Leistungs- oder Personalentscheidungen autonom zu treffen,
- Szenarien,
- Handlungsempfehlungen,
- Aufgabenübergabe aus Analysen,
- Modellrouting nach Komplexität und Budget.

### Phase 7: Fachmodule

- Winterdienst vollständig,
- Fahrzeuge und Fahrten,
- Vermietung nach fachlicher Freigabe,
- Dokumente, Checklisten und Tätigkeitsberichte,
- Personal-, Planungs- und Einstellungstiefe einschließlich Detaildiagnose
  einzelner Tage, Mitarbeitender, Planungsgruppen und Planungsboards,
- menschenzentrierte Entwicklungsunterstützung mit sichtbaren Kriterien:
  eigene Stärken- und Lernhinweise für Mitarbeitende, geduldige
  Wiederholungshilfen und Kontinuitätsimpulse sowie sachlich belegte,
  rollengeschützte Führungsunterstützung erst nach separater Datenschutz-,
  Fairness-, Mitbestimmungs- und Fachabnahme.

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
- Dialog: direkte Antwort, gezielte Rückfrage, klickbare Auswahl, freie
  Antwort, Abbruch und erneute Formulierung,
- Fortsetzung: Pronomen, verkürzte Folgefrage, Fachbereichswechsel,
  Datensatzwechsel, Zeitraumwechsel und Rückkehr zum vorherigen Thema,
- Mehrdeutigkeit: mehrere Datensatztreffer, mehrere plausible Absichten,
  kombinierte Teilfragen und wiederholt fehlende Pflichtangaben,
- Datenschutz: Lohn, Personal, Kontakt, Kunde, Finanzdaten, Secrets,
- Menschenentwicklung: Transparenz der Kriterien, Einsicht und Korrektur,
  positive wie kritische Hinweise, Kontext und Unsicherheit, keine
  Persönlichkeitsinferenz und keine autonome Beschäftigungsentscheidung,
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
- Wissensabdeckungsbericht in Regression/CI integrieren,
- Zielmargen, Mindestdatenbasis, Vergleichszeiträume und Freigaberollen für
  Material-, Leistungs-, SVS- und Preisempfehlungen fachlich festlegen,
- gemeinsamen Prüfturnus, Beteiligte und Änderungsnachweis für den lebendigen
  JARVIS-Prinzipienkompass festlegen,
- vor personenbezogener Entwicklungsunterstützung Zweck, zulässige Fakten,
  Einsichts- und Korrekturweg, Aufbewahrung, Empfängerkreis, Mitbestimmung und
  menschliche Entscheidungsverantwortung verbindlich festlegen.

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

## 18. Integrierter Online-Anfragen-Vertikalschnitt

Mit dem OK-immocare-Online-Anfragenportal kennt JARVIS nun zusätzlich den
Hauptbereich `onlineRequests` und dessen sichere Übergabe in die Projektpipeline.
Deterministische Systemhilfe beantwortet, wo Formularanfragen erscheinen, wie
die Kundenentscheidung erfolgt und welche Daten bei einer bewussten Umwandlung
übernommen werden. Das Navigationsziel ist rollenbegrenzt und führt ausschließlich
in den geschützten Posteingang.

Der organisationsgebundene Live-Read-Adapter beantwortet zusätzlich Zählungen
nach Status, Listen offener, neuer oder auf Rückmeldung wartender Anfragen,
die älteste passende Anfrage und Detailzusammenfassungen für eine exakte
`OKI-...`-Referenz. Die Detailansicht erklärt Anliegen, Gewerk, Beschreibung,
Verantwortung, Kundenprüfung, Kontaktpräferenz, Wunschdatum,
Zusatzinteressen, Fotoanzahl und Auditstand. Netzwerk-Hashes,
Sicherheitssignale und Bild-Binärdaten werden nicht geladen. Zugriff ist als
eigene verfügbare Aktion `online-request.read` registriert; Sitzungs- und
effektive Rolle müssen beide die vorhandene WorkPilot-Berechtigung besitzen.
Eine Managementrolle in Mitarbeiter-Impersonation erhält daher keinen
erweiterten Zugriff.

JARVIS bleibt bei Änderungen in diesem Prozess erklärend und rein lesend: Es darf weder eigenständig einen
Kunden auswählen noch eine Anfrage umwandeln. Der serverseitige Fachprozess
erzeugt nach menschlicher Prüfung immer ein neues Projekt unter
`OK immocare → Lead / Klärung`, schreibt die Originalbeschreibung ins Logbuch,
ordnet Bilder der Kategorie `Anfragebilder` zu und erzeugt erforderliche
Termin-/Rückrufaufgaben. Systemlandkarte, natürliche Fragen, Rollenabdeckung und
Browsernavigation besitzen eigene Regressionstests. Live-Intent, Statusfilter,
Mandantengrenze, fehlende Referenz, Rollenverweigerung, Impersonation und die
Bestandsprojekt-Invariante sind zusätzlich automatisiert abgesichert.

Die `OKI-...`-Referenz bleibt dabei ausschließlich Anfrage-, Quellen-, Audit-
und Logbuchreferenz. JARVIS erklärt und liest für bereits umgewandelte Anfragen
die tatsächliche organisationsgebundene Projektnummer: Die Umwandlung vergibt
unter einem organisationsgebundenen Advisory-Lock die nächste globale Nummer
mit dem `projectPrefix` des gewählten Gewerks und bildet den Titel als
`Projekt <Nummer> - <Gewerk>`. Für `Sonstige / Andere Leistung` bleibt
`tradeId=null`, der lesbare Leistungsname erhalten und das Präfix neutral
`SON`. Die öffentliche Leistungsauswahl zeigt zuerst Grünpflege,
Objektbetreuung und Hausmeisterservice; 13 weitere freigegebene Optionen liegen
hinter einem deutlichen Aufklapper.

## 19. Kontrollierte Rechnungszustellung

Rechnungsfakturierung und Rechnungsversand sind zwei getrennte kritische
Aktionen. Ein Versandwunsch kann nur für eine bereits fakturierte
organisationsgebundene Rechnung eine persistente Vorschau erzeugen. Die
Vorschau zeigt und bindet:

- wirksamen Absender und verbundenes Microsoft-365-Konto,
- Empfänger, CC, BCC, Betreff und Nachricht,
- PDF, XRechnung, PDF plus XRechnung oder validiertes ZUGFeRD,
- konkrete Anhangsnamen, Größen und SHA-256-Hashes,
- technische XRechnungs-, optionale KoSIT- und ZUGFeRD/PDF-A-3-Prüfung,
- Rechnung, Projekt, Kunde, Betrag, Status und aktuellen Änderungsstand.

Nach jeder Bearbeitung wird das gesamte Paket serverseitig neu erzeugt und
geprüft. Erst die exakt angezeigte Phrase
`SENDEN <Rechnungsnummer> AN <erste Empfängeradresse>` gibt den gebundenen
Stand frei. Vor Microsoft Graph wird ein Versanddatensatz unter globalem
Advisory-Lock mit `sending` beansprucht. Ein bereits als `sent` bestätigter
Auftrag ist ein sicherer Replay ohne zweite Mail. `sending`, `failed` oder ein
nach externer Annahme nicht eindeutig speicherbarer Status werden niemals
automatisch wiederholt. Die normale Versandmaske verwendet denselben
Versand-Claim und denselben Microsoft-Graph-Adapter.

Der Vertikalschnitt übernimmt keine Mahnung, Bezahlt-Markierung, Stornierung
oder Projektänderung. Kombinierte kritische Aktionsketten bleiben fail-closed.
Der permanente Korpus behält exakt 110 Fälle und enthält nun zusätzlich den
kontrollierten Rechnungsversand mit sichtbarer Empfänger- und
Dokumentvorschau.

## 20. Kontrollierte Bezahlt-Markierung

Die Bezahlt-Markierung ist eine eigenständige kritische Finanzaktion und wird
nicht mit Fakturierung, Versand, Mahnung oder Storno verkettet. Ein eindeutiger
Wunsch erzeugt ausschließlich für eine offene Rechnung im Status
`Fakturiert` einen 15 Minuten gültigen serverseitigen Entwurf. Rechnung,
Projekt, Kunde, Fälligkeit, vollständiger Bruttobetrag und Zahlungsdatum sind
sichtbar; ein geändertes Datum benötigt eine neue serverseitige Prüfung. Ein
Datum in der Zukunft blockiert, ein Datum vor dem Leistungsdatum bleibt als
bewusster Warnhinweis sichtbar.

Erst die exakt angezeigte, groß-/kleinschreibungssensitive Phrase
`BEZAHLT RE-... AM TT.MM.JJJJ` darf die Aktion ausführen. Organisation,
Sitzung, Session- und Effektivrolle, Impersonation, Revision, TTL, HMAC,
Payload-/Kontexthash und der aktuelle Rechnungsfingerprint werden vor dem
Schreiben neu geprüft. Ein organisationsgebundener PostgreSQL-Advisory-Lock,
der bedingte Statuswechsel und die serialisierbare Transaktion schützen
Doppelklick und Parallelzugriffe. Status `Bezahlt`, Zahlungsdatum und genau ein
Historienereignis entstehen gemeinsam oder gar nicht; Replay liefert nur das
bereits gespeicherte Ergebnis zurück.

Die normale Rechnungsmaske und JARVIS delegieren beide an
`src/lib/invoices/invoice-payment-service.ts`. Das heutige Rechnungsmodell
kennt nur vollständige Zahlungen. Deshalb nennt die Vorschau ausdrücklich den
gesamten Bruttobetrag und nimmt keine Teilzahlung entgegen. Mahnung, Versand
und Storno werden durch diese Aktion nicht ausgelöst. Teilzahlungen benötigen
später ein eigenes fachliches Datenmodell mit offenen Restbeträgen,
Zahlungsereignissen und eigener Abnahme.

## 21. Kontrollierte Mahnung

Eine Mahnung ist eine eigenständige kritische Finanzaktion. Ein eindeutiger
Wunsch erzeugt nur für eine überfällige, unbezahlte Rechnung im Status
`Fakturiert` einen 15 Minuten gültigen serverseitigen Entwurf. Sichtbar sind
Rechnung, Projekt, Kunde, offener Bruttobetrag, Fälligkeit, aktuelle und nächste
Mahnstufe, Mahndatum, neue Zahlungsfrist und Empfängeranschrift. Änderungen an
Mahndatum oder Frist müssen vor der Bestätigung serverseitig neu geprüft
werden. Die Frist muss nach dem Mahndatum liegen.

Erst die exakt angezeigte, groß-/kleinschreibungssensitive Phrase
`MAHNUNG MA-RE-...-<Stufe> BIS TT.MM.JJJJ` darf die nächste Mahnung erstellen.
Organisation, Sitzung, Session- und Effektivrolle, Impersonation, Revision,
TTL, HMAC, Payload-/Kontexthash und Rechnungsfingerprint werden neu geprüft.
Ein organisationsgebundener PostgreSQL-Advisory-Lock, ein bedingtes Update und
die serialisierbare Transaktion schützen Parallelzugriffe, Doppelklick und
Replay. Mahnstufe, Zeitstempel, PDF im Projektlogbuch und genau ein
Historienereignis entstehen gemeinsam oder gar nicht.

Die normale Rechnungsmaske und JARVIS delegieren beide an
`src/lib/invoices/invoice-reminder-service.ts`. Bezahlte, nicht fakturierte,
nicht überfällige, bereits am selben oder einem späteren Tag gemahnte
Rechnungen und Mahnstufe 3 bleiben blockiert. Diese Aktion erstellt das
Mahndokument, versendet aber keine E-Mail. Versand, Bezahlt-Markierung und
Storno bleiben getrennte, erneut zu bestätigende Vorgänge. Der permanente
Korpus bleibt exakt 110 Fälle groß und prüft die Mahnung als reine Vorschau
ohne fachliche Nebenwirkung.

# Aktueller Ausbau: Projektbestand und fachlicher Prüfstatus

- Der organisationsgebundene Projektbestandsadapter beantwortet Zähl-,
  Listen-, Gruppierungs- und Filterfragen zum fachlichen Prüfstatus.
- `Noch nie geprüft`, `nach Änderungen erneut prüfen` und `fachlich
  freigegeben` werden getrennt ausgewiesen; Werte werden live gelesen und
  niemals als feste Anzahl hinterlegt.
- Natürliche Formulierungen, Synonyme und typische Schreibfehler werden als
  Fragefamilie getestet. Echte Einzelprojekt-Diagnosen bleiben getrennt.
- Listen liefern klickbare Projekte. Rollenprüfung erfolgt vor der
  Datenabfrage; die Organisationsgrenze ist in der Quelle verpflichtend.
- Unbekannte Prüfzustände werden nicht als Freigabe interpretiert, sondern
  transparent als Datenproblem und prüfbedürftig ausgewiesen.
- Browserprüfung ergänzt: Statusfilter bleiben auch bei typischen
  Schreibfehlern erhalten. Explizite Mehrzahlfragen haben Vorrang vor einem
  alten Einzelprojektkontext. Bis zu 20 Projektkarten werden übernommen,
  zunächst fünf angezeigt und kontrolliert ausklappbar gemacht. Der
  sichtbare Dashboardkontext darf nicht durch gespeicherte Projekt- oder
  Kundenauswahlen verfälscht werden.
### Kontrolliertes Rechnungs-Vollstorno (umgesetzt 2026-07-31)

JARVIS kann eine fakturierte oder bezahlte Rechnung nach vollständiger
Vorprüfung kontrolliert stornieren. Die Vorschau zeigt Original- und ST-Nummer,
Projekt, Kunde, Zahlungsstatus, vollständige Gegenbuchung, Positionen und
freizugebende Zeiteinträge. Ein dokumentierter Grund ist Pflicht; erst
`STORNIEREN RE-... MIT ST-...` führt die Aktion aus. Der gemeinsame
Fachservice schützt ST-Nummer und Rechnung mit organisationsgebundenen
Advisory Locks und schreibt ST-PDF, negative Positionen, Originalstatus,
Zeit-/Lagerfreigabe, Historie und Logbuch in einer serialisierbaren
Transaktion. Bezahlte Rechnungen lösen keine Rückzahlung aus. Teilgutschrift
und Rechnungskorrektur werden ausschließlich über den nachfolgend
dokumentierten `invoice.credit`-Prozess ausgeführt und nie als Vollstorno
umgedeutet.

Release-Abnahme: Code-Commit `36898b7`, Backup
`/var/backups/workpilot360/before-jarvis-cancellation-20260731T164000Z`,
lokal und produktiv jeweils 110/110 permanente Testfragen. Die produktive
Ausführungs-QA bestätigte zusätzlich falsche-Phrase-Blockade, fail-closed
Teilgutschrift, genau eine negative ST-Rechnung samt PDF, zwei
Historienereignisse, einen Logbucheintrag und idempotentes Replay. Alle
isolierten QA-Daten wurden anschließend vollständig bereinigt.

### Kontrollierte Teilgutschrift / Rechnungskorrektur (umgesetzt 2026-07-31)

JARVIS kann eine finanzielle Teilgutschrift zu einer fakturierten oder
bezahlten Rechnung vorbereiten. Der GU-Beleg und jede GU-Position tragen eine
dauerhafte Referenz auf Ursprungsrechnung und Ursprungsposition. Frühere
aktive Gutschriften werden positionsgenau vom gutschreibbaren Rest abgezogen;
Überkorrekturen und die versehentliche vollständige Aufhebung über den
Teilprozess bleiben gesperrt. Die Maske zeigt alle Positionen mit ursprünglichem,
bereits gutgeschriebenem und verbleibendem Nettobetrag und berechnet die
Bruttosumme mit dem jeweiligen Positionssteuersatz.

Der kritische Ausführungssatz lautet
`GUTSCHRIFT GU-... ZU RE-... ÜBER ...,.. EUR`. Nach Bestätigung entstehen in
einer serialisierbaren, advisory-lock-geschützten Transaktion genau ein
negativer GU-Beleg samt PDF, zwei Historienereignisse und ein
Projektlogbucheintrag. Auszahlung, Zahlungsstatus, Zeiten, Lager und Versand
bleiben getrennt. Der Vollstorno prüft aktive Teilgutschriften und blockiert
eine sonst mögliche doppelte Gegenbuchung.

Der Baustein ist auf Code-Commit `af01f03` produktiv abgenommen. Das geprüfte
Rollback-Paket liegt unter
`/var/backups/workpilot360/20260731-161405-jarvis-invoice-credit` und enthält
Repository-Bundle, vorherigen `.next`-Build, Datenbankdump und SHA-256-
Prüfsummen. Lokal und produktiv bestanden 1.446 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, leerer Live-Diff und der
90-Seiten-Build. Der permanente Korpus bestand jeweils 110/110; produktiv
wurden zwölf kontrollierte Entwürfe und keine Ausführung erzeugt.

Die isolierte produktive Ausführungs-QA bestätigte: falsche
Groß-/Kleinschreibung wird mit HTTP 400 abgelehnt, die exakte Phrase erzeugt
genau einen GU-Beleg über -20 EUR netto / -23,80 EUR brutto, Replay bleibt
exactly-once, Überkorrektur sowie ein anschließender Vollstorno sind gesperrt
und Originalrechnung, Zahlung, Zeiten, Lager und Versand bleiben unverändert.
PDF, zwei Historienereignisse und genau ein Logbucheintrag wurden gemeinsam
erzeugt; anschließend blieben null QA-Rückstände. Die beim vorherigen
Storno-Umbau versehentlich entfernte lesende Rechnungsroute wurde ebenfalls
wiederhergestellt und mit einem dauerhaften Regressionsmarker abgesichert.
Produktiv liefert sie HTTP 200 und alle GU-Referenzfelder. WorkPilot läuft
unter PID `494621`, KlinikNavigator unverändert unter PID `398228`.

## 22. Verifiziertes Wissen zum privaten Datei- und Objektspeicher

JARVIS kennt den produktiven Objektspeicher nicht nur als Infrastrukturwort,
sondern als geprüften Zusammenhang zwischen Fachdatensatz, Dateimetadaten,
privaten Bytes, API, PWA, Versand, Auswertung, Aufbewahrung und Fehlerfall.
Die maschinenlesbare Systemlandkarte enthält dafür den nicht navigierbaren
Systemdienst `system.objectStorage` mit verifizierten Quellreferenzen.

Die deterministische Systemhilfe unterscheidet eigene Fragefamilien für:

- eine einfache Erklärung für Normalnutzer,
- aktuell angebundene und noch historische Dateifamilien,
- den technischen Codefluss von Validierung bis Rollback,
- PWA- und API-Kompatibilität,
- Angebots-, Rechnungs-, XRechnungs-, ZUGFeRD- und Microsoft-365-Versand,
- unveränderte kaufmännische Auswertungen,
- Lazy Loading, ETag, privaten Cache und Skalierungsverhalten,
- Providerfehler, Datenbank-Fallback, Prüfsummen und kontrollierte HTTP-Fehler,
- fachliches Löschen, Storno, Audit und Aufbewahrung,
- Dry-run-/Mirror-/Switch-Migration historischer Altdateien,
- konsequente Verweigerung jeder Ausgabe von Access Keys, Secret Keys,
  Passwörtern, Tokens oder anderen Geheimnissen.

Verbindliche Detailquelle ist `docs/STORAGE_ARCHITEKTUR.md`. Normale Maske,
PWA und JARVIS bleiben über dieselben Fach- und Speicherservices gekoppelt;
JARVIS erfindet keinen Speicherzustand und darf ein technisches Speicherproblem
nicht in einen anderen Belegstatus oder eine falsche kaufmännische Kennzahl
umdeuten.

## 23. Kontrollierter Aufgaben-Lebenszyklus

JARVIS kann eine eindeutig bestimmte Aufgabe kontrolliert archivieren oder
wiederherstellen. „Löschen“ wird dabei bewusst als reversible Archivierung
verstanden; physisches Löschen ist weder über JARVIS noch über die normale
Aufgaben-API zulässig. Bei gleichnamigen Aufgaben fragt JARVIS fail-closed nach
der sichtbaren Aufgaben-ID. Ein nachvollziehbarer Grund mit mindestens drei
Zeichen ist Pflicht.

Die Vorschau zeigt Aktion, Titel, Projekt, Kunde, Verantwortlichkeit,
Ausgangsstatus, Grund sowie die Anzahl der Kommentare, Beteiligten, Links,
Zeiteinträge und aktiven Folgeaufgaben. Laufende Zeiterfassungen blockieren die
Änderung. Kommentare, Beteiligte, Links, Zeiten, Folgeaufgaben,
Benachrichtigungen und Auditnachweise bleiben erhalten. Für eine
Wiederherstellung muss der frühere Status aus dem Archivgrund oder der
Status-Timeline belastbar nachweisbar sein; Altbestand ohne Nachweis bleibt
gesperrt. Wiederhergestellt wird exakt dieser Status und nicht pauschal
`OFFEN`.

Erst die exakte, groß-/kleinschreibungssensitive Phrase
`AUFGABE ARCHIVIEREN <Titel>` beziehungsweise
`AUFGABE WIEDERHERSTELLEN <Titel>` darf schreiben. Organisation, Sitzung,
Session- und Effektivrolle, Impersonation, Revision, TTL, HMAC,
Payload-/Kontexthash und Aufgabenfingerprint werden geprüft. Ein
organisationsgebundener PostgreSQL-Advisory-Lock, eine serialisierbare
Transaktion und ein bedingter Statuswechsel schützen Doppelklick,
Parallelzugriff und Replay. Status, Archivgrund, Aufgabenhistorie und
Status-Timeline entstehen gemeinsam oder gar nicht.

Normale Aufgabenoberfläche und JARVIS verwenden
`src/lib/tasks/task-lifecycle-service.ts`. Die Oberfläche verlangt ebenfalls
einen Grund und bietet im Archiv kein „Endgültig löschen“ mehr an. Der
permanente Korpus bleibt exakt 110 Fälle groß und enthält den kontrollierten
Aufgaben-Lebenszyklus. Die isolierte lokale QA bestätigte Rollen- und
Organisationsgrenzen, falsche Phrase, Abbruch, Exactly-once-Replay,
Archivieren/Wiederherstellen, unverändertes Projekt, vollständig erhaltene
Nachweise und null Rückstände; der echte Oberflächen-Klicktest bestätigte die
sichtbare Vorschau und den deaktivierten Ausführen-Button bei falscher Phrase.

Produktiv ist der Vertikalschnitt auf Commit
`991dbb8ef935a425f8a301a4900d108f3375483f` abgenommen. Das verifizierte
Code-, Datenbank- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260801-210641-jarvis-task-lifecycle-v3`. Der
permanente Produktionskorpus bestand 110/110 Fragen, bereitete 17 kritische
Entwürfe vor und führte keine Aktion aus. Die isolierte Produktions-QA
bestätigte Rollenprüfung, falsche Phrase, Archivierung, Wiederherstellung,
Abbruch, Exactly-once-Replay, unverändertes Projekt, erhaltene Kommentare,
Beteiligte, Links, Zeiten und Folgeaufgaben sowie das Verbot physischen
Löschens; Aufgaben, Entwürfe, Sitzungen und Timeline-Rückstände standen danach
jeweils auf null. Lokal sind 147 Testdateien mit 1.549 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma und der 90-Seiten-Build grün. WorkPilot
läuft unter PID `681938`, KlinikNavigator blieb unter PID `398228`.

## 24. Kontrollierte Projektstatusänderung

JARVIS kann einen eindeutig über die Projektnummer bestimmten operativen
Projektstatus als kritische Aktion `project.status.change` vorbereiten. Er
entscheidet den Zielstatus niemals selbst und archiviert keine Projekte über
diesen Pfad. Pflicht sind Projektnummer, ausdrücklich genannter Zielstatus und
ein nachvollziehbarer Grund. Die Vorschau zeigt Projekt, Kunde, Projektart,
Verantwortlichkeit, bisherigen und neuen Status sowie Angebote, bestätigte
Planungen, Projektzeiten, laufende Stempelungen, Endkontrollen,
Abschlussrechnungen und offene Aufgaben. Angebote, Rechnungen, Aufgaben,
Termine, Zeiten, Dateien und Kundenbezüge werden ausdrücklich als unverändert
ausgewiesen.

`src/lib/projects/project-status-service.ts` ist der gemeinsame Fachservice
für JARVIS und die normale Projektoberfläche. Er bindet alle Abfragen an die
Organisation und prüft den aktuellen Status, die Zielstatus-Freigabe sowie die
fachlichen Mindestnachweise fail-closed. Insbesondere benötigt `Geplant` eine
bestätigte Planung, `Abrechnungsprüfung` einen Arbeits- oder
Endkontrollnachweis, `Zur Abrechnung bereit` eine Endkontrolle und
`Abgeschlossen` eine aktive fakturierte oder bezahlte Abschlussrechnung;
Dauerläufer mit zukünftiger Laufzeit dürfen nicht abgeschlossen werden.

Erst die exakte, groß-/kleinschreibungssensitive Phrase
`PROJEKTSTATUS <Projektnummer> AUF <Zielstatus>` darf ausführen. Organisation,
Sitzung, Session- und Effektivrolle, Impersonation, Revision, TTL, HMAC,
Payload-/Kontexthash und ein Fingerprint der Projekt- und Fachnachweise werden
erneut geprüft. Ein organisations- und projektgebundener PostgreSQL-Advisory-
Lock, eine serialisierbare Transaktion und ein bedingtes Update schützen
Doppelklick, Parallelzugriff und Replay. Ausschließlich Projektstatus,
Status-Timeline, Projektlogbuch, Audit und die Auflösung überholter
Statuseskalationen entstehen gemeinsam oder gar nicht.

Die normale Projektmaske verwendet `/api/hero/projects/status` und zeigt vor
der Bestätigung dieselben Fachprüfungen und ausgeschlossenen Nebenwirkungen.
Der permanente Korpus bleibt exakt 110 Fälle groß und enthält nun die reine
Projektstatusvorschau. Der isolierte Rollen-, Mandanten-, Abbruch-,
Bestätigungs-, Exactly-once- und Bereinigungstest liegt in
`scripts/qa-jarvis-project-status.mjs`. Der separate Archivierungsprozess
`project.archive` bleibt ein späterer eigener kritischer Vertikalschnitt.

Produktiv ist dieser Vertikalschnitt auf Commit
`ae296c4fd97f7bc14bb680130aa2760e982811ed` abgenommen. Das verifizierte
Code-, Datenbank-, Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260801T221053Z-before-jarvis-project-status`.
Lokal bestanden 150 Testdateien mit 1.573 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, DB-Synchronität und der
90-Seiten-Build. Lokal und produktiv bestand der permanente Korpus 110/110
Fragen; die isolierte Status-QA bestätigte Rollenbindung, vollständige
Vorschau, falsche und exakte Phrase, sicheren Abbruch, atomare Exactly-once-
Ausführung und unveränderte Nebenfelder. Der echte Produktions-Klicktest
bestätigte dieselbe Vorschau in Projektmaske und JARVIS, deaktivierte
Ausführung bei falscher Phrase, Freigabe bei exakter Phrase, sicheren Abbruch
und null Browserfehler. Sämtliche QA-Daten wurden auf null bereinigt; der
Live-Prisma-Diff ist leer. WorkPilot läuft unter PID `687327`,
KlinikNavigator blieb unverändert unter PID `398228`.

## 25. Kontrollierter Projektarchivierungs-Lebenszyklus

JARVIS kann ein eindeutig über die Projektnummer bestimmtes Projekt als
kritische Aktion `project.archive` kontrolliert archivieren oder
wiederherstellen. Ein Grund ist Pflicht. Physisches Löschen ist nicht Teil des
Vertikalschnitts. Archivieren und Wiederherstellen laufen in JARVIS und der
normalen Projektmaske über
`src/lib/projects/project-lifecycle-service.ts`; das allgemeine
Projektspeichern verweigert entsprechende Statusübergänge als Nebenweg.

Die vollständige Vorschau umfasst Projekt und Kunde, Ausgangs- und Zielstatus,
Grund, Angebote, Rechnungen, Planungen, Projektzeiten, laufende Stempelungen,
offene Aufgaben, private `StoredFile`-Dateien und verknüpfte Online-Anfragen.
Laufende Stempelungen, zukünftige bestätigte Planung oder offene Aufgaben
blockieren die Archivierung fail-closed. Alle Fachbelege und Verknüpfungen
bleiben erhalten. Bei der Wiederherstellung wird ausschließlich der durch den
offenen Archiv-Timeline-Eintrag belegte frühere operative Status verwendet;
Altarchive ohne eindeutigen Nachweis bleiben gesperrt.

Erst `PROJEKT ARCHIVIEREN <Projektnummer>` beziehungsweise
`PROJEKT WIEDERHERSTELLEN <Projektnummer>` darf exakt und
groß-/kleinschreibungssensitiv schreiben. Organisations-, Sitzungs-, Rollen-,
Impersonation-, Revisions-, TTL-, Integritäts- und Fingerprintprüfung,
PostgreSQL-Advisory-Lock, serialisierbare Transaktion, bedingtes Update und
Exactly-once-Logbuch verhindern Mandantenüberschreitung, Doppelklick,
Parallelzugriff und Replay. Status, Timeline, Logbuch, Audit und
Eskalationsauflösung entstehen gemeinsam oder gar nicht.

Lokal bestanden 153 Testdateien mit 1.593 Tests, TypeScript und der
90-Seiten-Build. Der permanente Korpus blieb exakt 110 Fälle groß und bestand
110/110 mit einer Archivierungsvorschau und null ausgeführten Aktionen. Die
isolierte QA bestätigte Rollenbindung, Blocker, falsche Phrase, Abbruch,
Archivierung, Replay, exakte Wiederherstellung des Status `Abgeschlossen`, je
zwei Timeline-/Logbuch-/Audit-Einträge, erhaltene Angebote, Rechnungen und
Dateien sowie null QA-Rückstände. Echte Klicktests bestätigten JARVIS und die
normale Projektmaske, deaktivierte Ausführung bei falscher Phrase, Archivieren,
Wiederherstellen und die sichtbare Erfolgsmeldung ohne Fehler auf einem
frischen Dashboard-Lauf. Produktiv ist der Vertikalschnitt auf Commit
`781899aac894025833367b56086b724088c3f8ae`; das verifizierte Code-, DB-,
Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260802T003136Z-before-jarvis-project-lifecycle`.
Die isolierte Produktions-QA und der permanente Live-Korpus bestanden erneut
vollständig (110/110, 19 vorbereitete Entwürfe, keine Ausführung und null
QA-Rückstände). Prisma blieb live synchron, der externe Dashboard- und
Formularzugriff antwortete fehlerfrei. WorkPilot läuft unter PID `700433`,
KlinikNavigator blieb unverändert unter PID `398228`.

## 26. Kontrollierte Projektstammdatenänderung

Der erste freigegebene `project.manage`-Vertikalschnitt bearbeitet bestehende,
eindeutig über ihre Projektnummer bestimmte Projekte. JARVIS darf ausschließlich
Projekttitel, Beschreibung, Laufzeitmonate, Gewerk, Projektadresse, Beteiligte,
Projektverantwortung und zeitlich begrenzte Vertretung vorbereiten. Anlage neuer
Projekte sowie Änderungen an Projektnummer, Kunde, Kontakten, Projektart,
Geschäftsbereich, Status, Abrechnung und Budgets bleiben bewusst außerhalb
dieses Änderungskanals und folgen in eigenen fachlichen Schritten.

Die Vorschau zeigt jeden alten und neuen Wert. Archivierte Projekte, leere oder
wirkungslose Änderungen und widersprüchliche Laufzeit-/Vertretungszeiträume
werden fail-closed blockiert. Prüfungsrelevante Änderungen an einem bereits
freigegebenen Projekt heben die Freigabe nachvollziehbar auf und erzeugen genau
einen Eintrag in `WorkPilotProjectReviewHistory`. Erst die exakte Phrase
`PROJEKT ÄNDERN <Projektnummer>` darf schreiben.

`src/lib/projects/project-master-data-service.ts` bindet Organisation,
Projektstand und Änderungssatz über einen SHA-256-Fingerprint. Sitzung,
Session-/Effektivrolle, Impersonation, Revision, TTL, HMAC, Payload- und
Kontexthash werden erneut geprüft. PostgreSQL-Advisory-Lock, serialisierbare
Transaktion, bedingtes `updatedAt`-Update und Logbuch-Idempotenz verhindern
Doppelklick, Parallelzugriff und Replay. Projektänderung, gegebenenfalls
Freigabeaufhebung, Review-Historie, Projektlogbuch und Audit entstehen gemeinsam
oder gar nicht.

Lokal bestanden 155 Testdateien mit 1.604 Tests, TypeScript, Prisma,
Mojibake-/Regressionschecks und der 90-Seiten-Build. Die isolierte QA bestätigte
Rollen- und Mandantengrenze, sicheren Abbruch, falsche/exakte Phrase,
Stale-Context-Sperre, Exactly-once, zwei exakt geänderte Felder, unveränderte
Kern- und Fachdaten, Freigabeaufhebung sowie null Rückstände. Der permanente
Korpus blieb exakt 110 Fälle groß und bestand 110/110 einschließlich einer
unverändert bleibenden `project.manage`-Vorschau. Der echte UI-Klicktest zeigte
Alt-/Neuwertvergleich, deaktivierte Ausführung bei falscher Phrase, erfolgreiche
Ausführung bei exakter Phrase, korrekte Erfolgsmeldung und das geänderte Projekt
ohne Browserfehler.

Produktiv abgenommen auf Runtime-Commit
`e7d635d2a38bf840a8b3de996641bf8b24411538` mit der verifizierten Code-,
Konfigurations- und Datenbanksicherung
`/var/backups/workpilot360/20260802T011132Z-before-jarvis-project-master-data`.
Die produktive isolierte QA bestand alle Rollen-, Sicherheits-, Replay- und
Datenintegritätsfälle mit null Rückständen. Der produktive permanente Korpus
bestand 110/110 mit 20 vorbereiteten, null ausgeführten Aktionen und null
Rückständen. Live-Prisma-Diff leer, Dashboard und öffentliches Formular HTTP
200; WorkPilot PID `706450`, KlinikNavigator unverändert PID `398228`.

## 27. Kontrollierte Katalogverwaltung

`catalog.manage` legt Artikel und Leistungen kontrolliert an oder bearbeitet
eine eindeutig organisationsgebunden aufgelöste A-/L-Katalognummer. Die
Vorschau zeigt alte und neue Stammdaten, Einkauf/Selbstkosten, Verkaufspreis,
Umsatzsteuer, Rohertrag, Marge, Planungsrelevanz, Planminuten und bestehende
Verwendungen in Paketen, Angeboten, Rechnungen, Planung, Zeiten, Lager und
Marketing. Pakete, Komponenten und Paket-Snapshots bleiben bewusst in der
normalen Paketmaske und werden niemals automatisch verändert.

Dubletten nach Nummer oder Bezeichnung, unpassende Nummernpräfixe, ungültige
oder negative Werte, fehlende Planminuten und wirkungslose Änderungen
blockieren fail-closed. Eine relevante Änderung an einer fachlich freigegebenen
Position setzt den Prüfstatus nachvollziehbar auf `needs_review`. Erst die
exakte Phrase `KATALOGPOSITION ANLEGEN <Nummer>` beziehungsweise
`KATALOGPOSITION ÄNDERN <Nummer>` darf schreiben. Organisation, Sitzung,
Session-/Effektivrolle, Impersonation, TTL, Revision, HMAC, Payload- und
Kontexthash, SHA-256-Fachfingerprint, serialisierbare Transaktion,
PostgreSQL-Advisory-Lock und optimistisches `updatedAt`-Update sichern die
Ausführung und Exactly-once-Historie.

Der Fachservice liegt in `src/lib/catalog/catalog-management-service.ts`, der
isolierte Rollen-, Mandanten-, Dubletten-, Abbruch-, Stale-Context-, Replay-,
Freigabe- und Paket-Snapshot-Test in
`scripts/qa-jarvis-catalog-management.mjs`. Lokal bestanden 161 Testdateien
mit 1.643 Tests, TypeScript, Mojibake-/Regressionschecks, Prisma-Validierung,
leerer Schema-Diff und der 90-Seiten-Build. Der echte UI-Klicktest bestätigte
Wirtschaftlichkeitsvorschau, exakte Bestätigung, Exactly-once-Anlage, sichtbare
Katalogzeile und den korrekten Rücksprung in `Leistungen`; Rückstände null.
Lokal und produktiv bestand der permanente Korpus 110/110, produktiv mit 23
nur vorbereiteten und null ausgeführten Aktionen.

Produktiv abgenommen auf Runtime-Commit
`68898a07b5872f398f0d54f7e0d833554f136f75`. Das verifizierte Datenbank- und
Git-Backup liegt unter
`/var/backups/workpilot360/20260802T031300Z-before-jarvis-catalog-management`.
Live-Prisma-Diff leer, Dashboard und öffentliches Anfrageformular HTTP 200;
WorkPilot PID `718512`, KlinikNavigator unverändert PID `398228`. Prisma,
`StoredFile`, privater S3-Speicher und Online-Anfragen-Invarianten blieben
unverändert.

## 29. Lohnkosten kontrolliert ändern

`payroll.manage` ändert ausschließlich einen bestehenden aktiven
Mitarbeiterkosten-Datensatz, dessen Mitarbeiter innerhalb der aktuellen
Organisation eindeutig über die dienstliche E-Mail aufgelöst wurde. Zulässig
sind Monatsgehalt, Vollkostenfaktor, Jahresstunden, Urlaubs-, Fortbildungs- und
Krankheitstage sowie Stunden pro Arbeitstag. Mitarbeiterstammdaten,
Zeitbuchungen, Stempelungen und historische Kostensnapshots werden nicht
umgeschrieben.

Die Vorschau zeigt Alt-/Neuwerte, Jahres- und Monatsvollkosten, Abzugstage,
verkaufbare Jahres- und Monatsstunden und den resultierenden Stundensatz. Sie
weist zusätzlich historische Zeiten mit Snapshot, noch nicht bewertete Zeiten
und laufende Stempelungen aus. Negative Werte, Faktor außerhalb `(0, 5]`,
Jahresstunden außerhalb `(0, 8760]`, mehr als 24 Stunden pro Tag, mehr als 366
Tage je Abzugskategorie, keine verbleibenden verkaufbaren Stunden,
wirkungslose Änderungen und inaktive Ziele blockieren fail-closed. Erst
`LOHNKOSTEN ÄNDERN <dienstliche E-Mail>` darf ausführen.

Sowohl die Sitzung als auch der effektive Akteur benötigen Benutzer- und
Mitarbeiterkosten-Verwaltungsrecht; unberechtigte Rollen werden vor der
Zielauflösung ohne Preisgabe vertraulicher Werte abgelehnt. Der gemeinsame
Fachservice `src/lib/employee-costs/employee-cost-management-service.ts` wird
von JARVIS und `/api/employee-costs` verwendet. Organisation, Mitarbeiter,
Kostenstand, Änderungen, Kennzahlen und Wirkungszähler bindet ein
SHA-256-Fachfingerprint. Revision, TTL, HMAC, Payload-/Kontexthash,
PostgreSQL-Advisory-Lock, serialisierbare Transaktion und optimistisches
`updatedAt` sichern Parallelzugriff, Stale Context und Exactly-once; Audit
`employee-cost.changed` unterscheidet JARVIS und normale Kostenmaske.

Lokal bestanden 166 Testdateien mit 1.671 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, leerer Schema-Diff und der
90-Seiten-Build. Die isolierte lokale und produktive QA bestätigte UI-/
Service-Parität, Rollen- und Mandantengrenze, unmögliche Kalkulation, Abbruch,
falsche/exakte Phrase, Stale Context, Replay, unveränderte historische
Snapshots und laufende Stempelung, exakt einen Audit je Schreibvorgang und
null Rückstände. Der echte UI-Klicktest führte von der natürlichen Anfrage
über Vorschau und exakte Bestätigung bis zum aktualisierten Lohnkosten-Reiter.
Der permanente Korpus blieb exakt 110 Fälle groß und bestand lokal sowie
produktiv 110/110; produktiv 25 vorbereitete, null ausgeführte Aktionen und
null Rückstände.

Produktiv abgenommen auf Runtime-Commit
`422777f7f0f0601ea881d2e0254c7e87477e8124`. Das verifizierte Datenbank-, Git-
und Konfigurationsbackup liegt unter
`/var/backups/workpilot360/20260802T042845Z-before-jarvis-employee-cost-management`.
Live-Prisma-Diff leer, Dashboard und öffentliches Anfrageformular HTTP 200;
WorkPilot PID `724824`, KlinikNavigator unverändert PID `398228`. Prisma,
`StoredFile`, privater S3-Speicher und Online-Anfragen-Invarianten blieben
unverändert.

## 28. Personalstammdaten kontrolliert ändern

`personnel.manage` bearbeitet ausschließlich bestehende aktive Mitarbeiter,
die innerhalb der aktuellen Organisation eindeutig über ihre dienstliche
E-Mail aufgelöst wurden. Freigegeben sind Vor-/Nachname, dienstliche E-Mail,
Rolle, Personalnummer, Telefon/Mobiltelefon, Anschrift, Planungsboard und
Planungsgruppe. Passwort, Mailkonto, Lohn- und Kostendaten, Kapazitätsmodelle,
Führungshierarchie, Aktivierung/Deaktivierung sowie Mitarbeiteranlage und
-löschung bleiben bewusst getrennte spätere Vertikalschnitte.

Die Vorschau zeigt jeden Alt-/Neuwert sowie aktive Anmeldesitzungen, offene
eigene Aufgaben, Planungseinträge und Projektzeiten. Diese operativen
Zuordnungen werden nicht umverteilt oder verändert. Ein Rollenwechsel beendet
atomar alle Anmeldesitzungen des Zielmitarbeiters. Eigene Rollenänderungen,
Rollen oberhalb des handelnden Akteurs, Gastrolle, inaktive Mitarbeiter,
doppelte dienstliche E-Mail oder Personalnummer, eine wirkungslose Änderung
und das Herabstufen der letzten aktiven Geschäftsführung bleiben fail-closed
gesperrt. Erst `MITARBEITER ÄNDERN <dienstliche E-Mail>` darf ausführen.

Der Fachservice `src/lib/users/personnel-management-service.ts` bindet
Organisation, Mitarbeiterstand, Änderungen, Rollenlage und Wirkungszähler per
SHA-256. Sitzung, Rollenpaar, Impersonation, TTL, Revision, HMAC, Payload- und
Kontexthash werden erneut geprüft. Advisory-Lock, serialisierbare Transaktion,
optimistisches `updatedAt`, atomarer Sitzungsentzug und Audit
`personnel.changed` sichern Parallelzugriff und Exactly-once. Die Oberfläche
zeigt eine eigene Personalkarte und öffnet nach Ausführung die normale
Mitarbeiterakte.

Lokal bestanden 163 Testdateien mit 1.654 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, leerer Schema-Diff und der
90-Seiten-Build. Die isolierte lokale und produktive QA bestätigte Rollen- und
Mandantengrenze, Abgrenzung gesperrter Vorgänge, Selbstrollenschutz, Abbruch,
falsche/exakte Phrase, Dublette, Stale-Context, Sitzungsentzug, Audit und
Exactly-once-Replay mit null Rückständen. Der echte UI-Klicktest bestätigte
Alt-/Neuwertanzeige, Normalisierung, exakte Bestätigung, Ausführung und
Rücksprung in die Mitarbeiterakte. Der permanente Korpus blieb exakt 110 Fälle
groß und bestand lokal sowie produktiv 110/110; produktiv 24 vorbereitete,
null ausgeführte Aktionen und null Rückstände.

Produktiv abgenommen auf Runtime-Commit
`f55fa4e4d4f2f6d42af3af81406820839c0f23cf`. Das verifizierte Datenbank-,
Git- und Konfigurationsbackup liegt unter
`/var/backups/workpilot360/20260802T035012Z-before-jarvis-personnel-management`.
Live-Prisma-Diff leer, Dashboard und öffentliches Anfrageformular HTTP 200;
WorkPilot PID `721496`, KlinikNavigator unverändert PID `398228`. Prisma,
`StoredFile`, privater S3-Speicher und Online-Anfragen-Invarianten blieben
unverändert.

## 30. Kontaktkategorien kontrolliert massenhaft ändern

`bulk.update` ändert die Kontaktkategorie für 2 bis höchstens 25 ausdrücklich
per Kundennummer genannte, organisationsgebundene Kontakte. Der freigegebene
erste Vertikalschnitt unterstützt `Kunde`, `Privatkunde`, `Lieferant`,
`Partner`, `Ansprechpartner` und `Archiv`. Freie Texte wie „alle alten
Kontakte“ oder dynamische Filter bleiben bewusst gesperrt, bis Auswahl,
Folgewirkung und Rückrollung dafür gleichwertig beweisbar sind.

JARVIS und die normale Kontakt-Massenmaske nutzen
`src/lib/contacts/contact-bulk-category-service.ts`. Der reine Dry-Run zeigt
die vollständige Trefferliste, Kundennummer, Bezeichnung und jeden
Alt-/Neuwert; fehlende, fremde, doppelte oder bereits im Zielzustand befindliche
Kontakte werden als Ausschluss ausgewiesen. Erst
`MASSENÄNDERUNG AUSFÜHREN <Anzahl> KONTAKTE` darf schreiben. Sitzung und
effektiver Akteur benötigen jeweils Benutzer- und Kontaktverwaltungsrecht,
womit dieser kritische Weg auf Administration und Geschäftsführung begrenzt
ist.

Alle Kontaktänderungen, `ContactIntegrationEvent`-Einträge, Audit und
JARVIS-Historie entstehen in einer serialisierbaren Transaktion oder gar nicht.
Organisation, Modus, Zielmenge, Kundennummern, Kategorien und exakte
`updatedAt`-Stände sind per SHA-256 gebunden. HMAC, Payload-/Kontexthash,
Revision, TTL, PostgreSQL-Advisory-Lock, optimistische Updates und
Exactly-once-Replay schützen vor Doppelklick, Parallelzugriff und Stale
Context. Der Audit speichert den vollständigen Ausgangs- und Folgezustand. Eine
Rückrollung mit `MASSENÄNDERUNG ZURÜCKROLLEN <Ausgangs-ID>` wird nur angeboten,
wenn noch jeder Zielkontakt exakt im protokollierten Folgezustand steht; sie
stellt alle Ausgangskategorien gemeinsam oder keine wieder her.

Lokal bestanden 169 Testdateien mit 1.687 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, `db push`, leerer Schema-Diff
und der 90-Seiten-Build. Die isolierte lokale und produktive QA bestätigte
UI-/Service-Parität, Rollen- und Mandantengrenze, 25er-Limit,
Alles-oder-nichts, Abbruch, falsche/exakte Phrase, Stale Context,
Exactly-once-Replay, exakte Rückrollung und null Rückstände. Der echte
UI-Klicktest führte von der natürlichen Anfrage über vollständigen Dry-Run,
Ausführung und normale Kontaktansicht bis zur sichtbaren exakten Rückrollung.
Der permanente Korpus blieb exakt 110 Fälle groß und bestand lokal sowie
produktiv 110/110; produktiv wurden 26 Aktionsentwürfe nur vorbereitet und 0
ausgeführt.

Produktiv abgenommen auf Runtime-Commit
`bf5a367dd8d3f6299446417c3ab1124ce73c6faf`. Das verifizierte Datenbank-, Git-,
Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260802T051315Z-before-jarvis-bulk-update`.
Live-Prisma-Diff leer, Dashboard und öffentliches Anfrageformular HTTP 200;
WorkPilot PID `728456`, KlinikNavigator unverändert PID `398228`. Prisma,
`StoredFile`, privater S3-Speicher und Online-Anfragen-Invarianten blieben
unverändert.

## 31. Projektstatus-Frühwarnung kontrolliert schalten

`automation.manage` schaltet ausschließlich die bereits vorhandene
Projektstatus-Frühwarnung ein oder aus. Der erste bewusst schmale
Vertikalschnitt verändert weder die sechs bestehenden Statusregeln noch deren
Schwellen. Er startet keinen Scheduler, versendet keine Meldung oder E-Mail und
ändert keinen Projektstatus. Regelbearbeitung und weitere Automationsfamilien
bleiben nachfolgende, getrennt abzusichernde Vertikalschnitte.

Vor jedem Schaltvorgang wertet JARVIS den aktuellen Regelstand rein lesend aus
und zeigt die Zahl der überwachten Projekte, aktuelle Treffer für
Verantwortliche und Geschäftsführung sowie fehlende eindeutige
Zuständigkeiten. Ein bereits vorhandener Zielzustand blockiert als wirkungslose
Aktion. Sitzung und effektiver Akteur benötigen beide Stammdatenrecht; damit
dürfen nur Administration und Geschäftsführung vorbereiten und ausführen,
Führungskräfte bewusst nicht. Erst `PROJEKTSTATUS-AUTOMATION AKTIVIEREN` oder
`PROJEKTSTATUS-AUTOMATION DEAKTIVIEREN` darf den Schalter ändern.

Der Fachservice
`src/lib/automation/project-status-automation-management-service.ts` bindet
Organisation, exakten `updatedAt`-Stand und die vollständigen aktuellen sowie
vorgeschlagenen Einstellungen per SHA-256. Sitzung, Rollenpaar, Impersonation,
TTL, Revision, HMAC, Payload- und Kontexthash werden erneut geprüft.
Serialisierbare Transaktion, organisationsgebundener PostgreSQL-Advisory-Lock,
`FOR UPDATE`, unveränderte Vollkonfiguration und Audit
`automation.project-status.changed` sichern Parallelzugriff und Exactly-once.
Nach Ausführung öffnet die Karte die bestehende Status-Automationsansicht.

Lokal bestanden 170 Testdateien mit 1.698 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, `db push`, leerer Schema-Diff
und der 90-Seiten-Build. Die isolierte lokale und produktive QA bestätigte die
Führungskraft-Sperre, exakten Dry-Run, Abbruch, falsche/exakte Phrase, Stale
Context, Änderung und exakte Wiederherstellung, Exactly-once-Audit sowie das
Ausbleiben unmittelbarer Benachrichtigungen und Eskalationsereignisse mit null
Rückständen. Der echte UI-Klicktest bestätigte Karte, reale Auswirkungszahlen,
gesperrten/freigegebenen Button, Aktivierung, Navigation und Deaktivierung; der
ursprüngliche Einstellungsstand wurde anschließend exakt wiederhergestellt.
Der permanente Korpus blieb exakt 110 Fälle groß und bestand lokal sowie
produktiv 110/110; produktiv wurden 27 Aktionsentwürfe nur vorbereitet und 0
ausgeführt.

Produktiv abgenommen auf Runtime-Commit
`f7130b75f39fb846ac84323d32b1facdfbb5d5fd`. Das verifizierte Datenbank-, Git-,
Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260802T055638Z-before-jarvis-automation-management`.
Live-Prisma-Diff leer, Dashboard und öffentliches Anfrageformular HTTP 200;
WorkPilot PID `732182`, KlinikNavigator unverändert PID `398228`. Prisma,
`StoredFile`, privater S3-Speicher und Online-Anfragen-Invarianten blieben
unverändert.

## 32. Einzelne Projektstatus-Regel kontrolliert ändern

`automation.manage` bearbeitet jetzt zusätzlich zum Hauptschalter genau eine
ausdrücklich benannte bestehende Projektstatus-Regel je Entwurf. Änderbar sind
Aktivität, Schwelle der verantwortlichen Person und Schwelle der
Geschäftsführung. JARVIS zeigt die Regelwerte vollständig vorher/nachher sowie
für beide Regelstände die Zahl überwachter Projekte, Verantwortlichen- und
Geschäftsführungsstufen und fehlender eindeutiger Zuständigkeiten. Eine
Verantwortlichen-Schwelle ist nur von 1 bis 180 Tagen, eine
Geschäftsführungs-Schwelle nur von 1 bis 365 Tagen zulässig; die zweite darf
nicht vor der ersten liegen. Unbekannte, wirkungslose oder unplausible
Änderungen bleiben gesperrt.

Erst `PROJEKTSTATUS-REGEL ÄNDERN <STATUS>` darf schreiben. Sitzung und
effektiver Akteur benötigen beide Stammdatenrecht; Führungskraft bleibt
bewusst ausgeschlossen. Der Schritt ändert nur die eine Regel im bestehenden
`deadlines`-Dokument. Er startet keinen Scheduler, versendet keine Meldung oder
E-Mail und verändert keinen Projektstatus. Der bestehende Fachservice bindet
Organisation, `updatedAt`, Vollkonfiguration und Zielzustand per SHA-256;
HMAC, Rollenpaar, Impersonation, TTL, Revision, Payload-/Kontexthash,
serialisierbare Transaktion, PostgreSQL-Advisory-Lock, `FOR UPDATE`, Stale
Context und Exactly-once bleiben zwingend. Audit
`automation.project-status.changed` protokolliert Regel und Alt-/Neuzustand.

Lokal bestanden 170 Testdateien mit 1.702 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, leerer Schema-Diff und der
90-Seiten-Build. Der echte UI-Klicktest bestätigte den bei falscher Phrase
gesperrten Button, die exakte Freigabe, sichtbare Alt-/Neuwerte 14/28 auf
10/20, genau eine Ausführung, genau einen Fach-Audit, keine Benachrichtigung
und keine Browserfehler. Der Originalstand einschließlich `updatedAt` wurde
exakt wiederhergestellt. Die isolierte lokale und produktive QA bestätigte
Rollen- und Mandantengrenze, Abbruch, Stale Context, genau eine benannte Regel,
Replay, Audit, fehlende unmittelbare Zustellung und null Rückstände. Der feste
Korpus blieb exakt 110 Fälle groß und bestand lokal sowie produktiv 110/110;
produktiv 28 nur vorbereitete und null ausgeführte Aktionen.

Produktiv abgenommen auf Runtime-Commit
`4b6140ffd30decbd0e4f15338c877f864dbcc0e9`. Das verifizierte Datenbank-, Git-,
Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260802T063000Z-before-jarvis-automation-rules`.
Live-Prisma-Diff leer, Dashboard und öffentliches Anfrageformular HTTP 200;
WorkPilot PID `734753`, KlinikNavigator unverändert PID `398228`. Prisma,
`StoredFile`, privater S3-Speicher und Online-Anfragen-Invarianten blieben
unverändert.

## 33. Projektstatus-Automation transparent diagnostizieren

Die rein lesende Registry-Aktion `automation.read` beantwortet natürliche
Statusfragen zur Projektstatus-Automation. JARVIS trennt dabei ausdrücklich
den fachlichen Schalter der aktuellen Organisation, den serverseitigen
Scheduler-/Kill-Switch und den Zustell-Kill-Switch. Damit wird ein scheinbar
„aktiver“ Teilzustand nicht länger mit vollständiger Betriebsbereitschaft
verwechselt. Die Antwort zeigt zusätzlich alle gespeicherten Regeln und
Schwellen, aktuelle rein lesende Treffer für verantwortliche Person und
Geschäftsführung, fehlende eindeutige Zuständigkeiten, den letzten flüchtigen
Schedulerversuch sowie Zahl und Zeitpunkt persistenter Zustellereignisse.

Administration oder Geschäftsführung sind sowohl für den Sitzungs- als auch
für den effektiven Akteur erforderlich. Führungskraft und darunter werden vor
dem organisationsweiten Datenzugriff abgelehnt. Der Adapter
`src/lib/jarvis/automation-status-analysis.ts` verwendet dieselben
normalisierten `deadlines`-Einstellungen und dieselbe Projektstatus-Auswertung
wie die normale Status-Automationsoberfläche. Er führt keine Synchronisation
aus, startet keinen Scheduler, erzeugt keine Notification, versendet keine
Mail und ändert keinen Projektstatus. Die Antwort verlinkt ausschließlich zur
normalen Status-Automation.

Lokal bestanden 171 Testdateien mit 1.715 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, leerer Schema-Diff und der
90-Seiten-Build. Der echte UI-Klicktest zeigte korrekt: Organisationsschalter,
Scheduler und Zustellung aus; dennoch 131 überwachte Projekte, 104 aktuelle
Schwellen, sechs Regeln und 94 fehlende Zuständigkeiten. Die Navigation öffnete
exakt `/dashboard?view=statusAutomation`; Browserfehler, neue Entwürfe, Audits,
Notifications und Eskalationsereignisse waren null. Der permanente Korpus
blieb exakt 110 Fälle groß und bestand lokal sowie produktiv 110/110; die neue
Betriebsdiagnose wurde ausdrücklich validiert, produktiv 28 Schreibentwürfe
nur vorbereitet, null ausgeführt und null Rückstände.

Produktiv abgenommen auf Runtime-Commit
`c7223a7edc3981c662941d270dcd17fd833200cc`. Das verifizierte Datenbank-, Git-,
Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260802T065000Z-before-jarvis-automation-status`.
Live-Prisma-Diff leer, Dashboard und öffentliches Anfrageformular HTTP 200;
WorkPilot PID `736895`, KlinikNavigator unverändert PID `398228`. Prisma,
`StoredFile`, privater S3-Speicher und Online-Anfragen-Invarianten blieben
unverändert.

## 34. Ausführungs- und Änderungsprotokoll der Projektstatus-Automation

`automation.read` beantwortet nun auch natürliche Fragen nach
Ausführungsprotokoll, Historie und Audit. JARVIS hält zwei fachlich
unterschiedliche Quellen sichtbar auseinander: `AuditLog` mit Aktion
`automation.project-status.changed` belegt eine Konfigurationsänderung;
`StatusEscalationEvent` mit Regelpräfix `project-status-v1:` belegt eine
tatsächlich erzeugte Zustellung. Ein Schalterwechsel darf daher niemals als
versendete Eskalation formuliert werden.

Die Antwort zeigt organisationsgebundene Gesamtzahlen und jeweils die letzten
zehn Einträge. Bei Konfiguration stehen Zeitpunkt, Akteur, Regel oder Schalter
und vollständiger Alt-/Neuzustand. Bei Zustellung stehen Zeitpunkt, Projekt,
Status, Verantwortlichen- oder Geschäftsführungsstufe, Empfänger sowie
offen/erledigt. Für beide Quellen gibt es verständliche Leerzustände. Zugriff
haben nur Administration oder Geschäftsführung auf Sitzungs- und
Effektivebene. Die Abfrage ist vollständig lesend: kein Schedulerlauf, keine
Zustellung, keine Einstellung, kein Projektstatus und kein Aktionsentwurf
werden verändert.

Lokal bestanden 171 Testdateien mit 1.717 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, synchroner Datenbankstand und
der 90-Seiten-Build. Der echte UI-Klicktest bestätigte Titel, beide getrennten
Protokollbereiche, verständliche Leerstände, die bestehende Betriebsdiagnose
und die Navigation zur Status-Automation ohne Browserfehler. Vorher/Nachher
blieben Entwürfe, Automations-Audits, Notifications, Zustellereignisse und die
Organisationseinstellung unverändert. Der feste Korpus blieb exakt 110 Fälle
groß und bestand lokal sowie produktiv 110/110; produktiv 28 Schreibentwürfe
nur vorbereitet, null ausgeführt und null Rückstände.

Produktiv abgenommen auf Runtime-Commit
`74e20506eb1612c339ea322415906bd4510f7baa`. Das verifizierte Datenbank-, Git-,
Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260802T072000Z-before-jarvis-automation-history`.
Live-Prisma-Diff leer, Dashboard und öffentliches Anfrageformular HTTP 200;
WorkPilot PID `739270`, KlinikNavigator unverändert PID `398228`. Prisma,
`StoredFile`, privater S3-Speicher und Online-Anfragen-Invarianten blieben
unverändert.

## 35. Zustellbarkeit und Empfängerkreis vorab erklären

Die rein lesende `automation.read`-Diagnose bildet jetzt dieselbe
Empfängerlogik ab wie die Projektstatus-Synchronisation. Für jede fällige
Schwelle zeigt JARVIS Projekt, Status und Eskalationsstufe, neue Empfänger,
bereits durch ein offenes Ereignis abgedeckte Empfänger sowie konkrete
Zuordnungsprobleme. Auf Verantwortlichen-Stufe ist die aktive, per Namen
aufgelöste Projektverantwortung maßgeblich; auf Geschäftsführungs-Stufe kommen
alle aktiven Benutzer mit Rolle Administration oder Geschäftsführung hinzu.
Die bestehende Set-Logik verhindert doppelte Empfänger innerhalb eines
Hinweises. Offene `project-status-v1`-Ereignisse verhindern erneut denselben
Hinweis für Projekt, Status, Stufe und Empfänger.

JARVIS trennt nun vier Zustellebenen: fachlicher Organisationsschalter,
laufender Serverscheduler, Zustell-Kill-Switch und Systemmailkonfiguration.
Systemmail ist ein zusätzlicher Best-Effort-Kanal; das persistente
`StatusEscalationEvent` belegt zunächst die erzeugte In-App-Notification und
nicht zwingend eine erfolgreich versandte E-Mail. Zusätzlich werden fehlende
Verantwortliche, vollständig empfängerlose Schwellen, der aktive
Management-Empfängerkreis und mehrfach passende Verantwortlichennamen
ausgewiesen. Die Abfrage bleibt organisationsgebunden, auf Administration/
Geschäftsführung beschränkt und vollständig nebenwirkungsfrei.

Lokal bestanden 171 Testdateien mit 1.719 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, synchroner Datenbankstand und
90-Seiten-Build. Der echte Klicktest zeigte auf aktuellen Daten 131 überwachte
Projekte, 104 fällige Management-Schwellen, 208 neue Empfänger-Hinweise, keine
bereits offenen Hinweise, zwei aktive Managementempfänger und 94 fehlende
Verantwortlichen-Zuordnungen. Trotz dieser 94 Lücken war keine der aktuellen
Management-Schwellen völlig empfängerlos. Navigation und API waren sauber;
Entwürfe, Automations-Audits, Notifications, Zustellereignisse und
Organisationseinstellung blieben unverändert. Der feste Korpus blieb exakt
110 Fälle und bestand lokal sowie produktiv 110/110; produktiv 28
Schreibentwürfe nur vorbereitet, null ausgeführt und null Rückstände.

Produktiv abgenommen auf Runtime-Commit
`ed1d56578c58cd93958395b02ccf623818ae26db`. Das verifizierte Datenbank-, Git-,
Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260802T073000Z-before-jarvis-automation-delivery-diagnosis`.
Live-Prisma-Diff leer, Dashboard und öffentliches Anfrageformular HTTP 200;
WorkPilot PID `741649`, KlinikNavigator unverändert PID `398228`. Prisma,
`StoredFile`, privater S3-Speicher und Online-Anfragen-Invarianten blieben
unverändert.

## 36. Mehrdeutige Projektverantwortung fail-closed behandeln

Die Empfängerdiagnose hat eine sicherheitsrelevante Altlogik sichtbar gemacht:
Bei mehreren aktiven Benutzern mit demselben Vor- und Nachnamen wählte die
Projektstatus-Auswertung zuvor den ersten Treffer. Die gemeinsame Fachfunktion
`resolveProjectResponsibleUser` verlangt nun genau einen aktiven Treffer nach
normalisierter Schreibweise und Leerzeichenbehandlung. Kein Name, kein aktiver
Treffer oder nur inaktive Treffer ergeben `missing`; mehr als ein aktiver
Treffer ergibt `ambiguous`. Nur `matched` enthält eine Benutzer-ID.

Damit kann die reale Synchronisation einen Verantwortlichen-Hinweis nicht mehr
an eine geratene Person senden. Auf Geschäftsführungs-Stufe bleiben die aktiven
Admins/Geschäftsführer unabhängig davon zusätzliche Empfänger. Preview,
Synchronisation und JARVIS verwenden dieselbe Auflösung. JARVIS zeigt bei
Mehrdeutigkeit Trefferzahl und den Hinweis, dass aus Sicherheitsgründen an
keinen dieser Benutzer zugestellt wird. Fehlend und mehrdeutig werden getrennt
gezählt. Die bestehende Exactly-once-Sperre pro Projekt, Status, Stufe und
Empfänger bleibt unverändert.

Lokal bestanden 172 Testdateien mit 1.722 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, synchroner Datenbankstand und
90-Seiten-Build. Permanente Tests decken eindeutigen, normalisierten,
fehlenden, inaktiven und doppelten Namen ab. In den aktuellen lokalen und
produktiven Daten gibt es 0 doppelte aktive Mitarbeiternamen. Der echte
Klicktest zeigte weiterhin 208 geplante Managementhinweise, zwei aktive
Managementempfänger und 0 aktuelle mehrdeutige Zuordnungen; Navigation und
Datenbank blieben sauber. Der feste Korpus blieb exakt 110 Fälle und bestand
lokal sowie produktiv 110/110; produktiv 28 Schreibentwürfe nur vorbereitet,
null ausgeführt und null Rückstände.

Produktiv abgenommen auf Runtime-Commit
`3da93965bba7f0c466563c8e8b752458552b2ac5`. Das verifizierte Datenbank-, Git-,
Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260802T074500Z-before-jarvis-recipient-failclosed`.
Live-Prisma-Diff leer, Dashboard und öffentliches Anfrageformular HTTP 200;
WorkPilot PID `743239`, KlinikNavigator unverändert PID `398228`. Prisma,
`StoredFile`, privater S3-Speicher und Online-Anfragen-Invarianten blieben
unverändert.

## 37. Übernahmebereitschaft von Online-Anfragen vorab prüfen

JARVIS beantwortet für eine exakt genannte `OKI-YYYYMMDD-XXXXXX`-Referenz nun
rein lesend, ob die bestehende kontrollierte Umwandlung ausführbar ist. Die
Prüfung zeigt Status, eindeutigen Kundenweg, organisationsgebunden aufgelösten
Bestandskontakt, geplante Verantwortung, Folgeaufgaben und Fotos. Als echte
Blocker gelten dieselben fachlichen Zustände wie im bestehenden Ablauf:
abgeschlossene Anfrage, nicht entschiedener Kundenweg, fehlender oder
organisationsfremder Bestandskontakt und ein nicht auflösbarer Nachweis einer
bereits erfolgten Umwandlung. Eine fehlende oder ungeeignete Vorab-Zuweisung
wird korrekt als automatischer Verantwortungs-Fallback auf die ausführende
berechtigte Person erklärt und nicht fälschlich als Blocker bezeichnet.

Die Folgen bleiben ausdrücklich Vorschau: immer ein neues Projekt unter
`OK immocare → Lead / Klärung`, globale Projektnummer mit Gewerk-Präfix,
OKI-Referenz ausschließlich als Quellenreferenz, geprüfter Bestandskontakt
oder neuer Kontakt, Originalanfrage im Logbuch, Bilder in `Anfragebilder` und
Termin-/Rückrufsignale nur als Aufgaben. Ein Wunschdatum wird nie als
bestätigter Termin ausgegeben. JARVIS erzeugt dabei keinen Aktionsentwurf,
ändert keine Anfrage und führt keine Umwandlung aus.

Lokal bestanden 172 Testdateien mit 1.727 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, synchroner Datenbankstand und
der 90-Seiten-Build. Der echte UI-Klicktest verwendete eine isolierte
QA-Anfrage, zeigte `Bereit`, Kundenkontakt, Verantwortung, Folgeaufgabe und die
korrekte Navigation nach `/dashboard?view=onlineRequests`. Danach waren
Anfrage, Audit und alle QA-Spuren vollständig entfernt; Entwürfe, Aufgaben,
Projekte und Logbucheinträge zur Referenz blieben null. Der feste Korpus blieb
exakt 110 Fälle und bestand lokal sowie produktiv 110/110; produktiv wurden 28
Schreibentwürfe nur vorbereitet, null Aktionen ausgeführt und null Rückstände
hinterlassen.

Produktiv abgenommen auf Runtime-Commit
`2b7d0e4ce1cccaf4ad4bf0b4144a6a2bef0d72d7`. Das verifizierte Datenbank-,
Git-, Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260802T081500Z-before-jarvis-online-readiness`.
Live-Prisma-Diff leer, Dashboard und öffentliches Anfrageformular HTTP 200;
WorkPilot PID `746049`, KlinikNavigator unverändert PID `398228`. Prisma,
`StoredFile`, privater S3-Speicher und die Invariante gegen automatische
Bestandsprojekt-Zuordnung blieben unverändert.

## 38. Online-Anfragen kontrolliert mit JARVIS umwandeln

JARVIS kann eine exakt genannte `OKI-YYYYMMDD-XXXXXX`-Anfrage nach einem
ausdrücklichen Umwandlungsbefehl nun als kritische Aktion vorbereiten und nach
bewusster Bestätigung ausführen. Die Aktionskarte zeigt Anfrage, Kundenweg,
organisationsgebundenen Bestandskontakt oder Neuanlage, Gewerk, Verantwortung,
Folgeaufgaben, Bilder, Zielbereich und die nächste globale Projektnummer mit
Gewerk-Präfix. Sie erklärt sichtbar die unverhandelbare Invariante: Es entsteht
immer genau ein neues Projekt unter `OK immocare → Lead / Klärung`; ein
Bestandsprojekt wird niemals automatisch ausgewählt oder angeboten.

Normale Oberfläche und JARVIS verwenden denselben Fachservice
`src/lib/online-requests/conversion-service.ts`. Der Vorschau-Fingerprint bindet
Anfragestatus, Kundenentscheidung, Kontaktstand, Gewerk, Verantwortung,
Termin-/Rückrufkontext und Bilder. Vor der Ausführung werden Rolle und aktueller
Fachstand erneut geprüft. Nur die exakte Phrase
`ONLINE-ANFRAGE UMWANDELN <OKI-Referenz>` ist gültig. Der Entwurf ist zusätzlich
an Organisation, Sitzung, Session- und Effektividentität, Rollen,
Impersonationszustand, Payload-/Kontexthashes und Integritätstag gebunden.

Die Umwandlung selbst bleibt serialisierbar und zeilengesperrt. Projekt,
Kontakt/Objektadresse, Logbuch `Online-Anfrage`, geschützte `Anfragebilder`,
Termin-/Rückrufaufgabe, Timeline, Umwandlungs-Audit und
Benachrichtigungsauflösung entstehen gemeinsam. Der JARVIS-Entwurf wechselt vor
dem Fachschreiben atomar nach `executing`; die korrelierte
`executionRequestId` im Online-Anfragen-Audit ermöglicht nach einem Prozessabbruch
eine sichere Wiederaufnahme. Wiederholte Bestätigungen liefern ausschließlich
das bereits von genau diesem Entwurf erzeugte Projekt und erzeugen keine
Duplikate. Eine zwischenzeitliche Änderung führt fail-closed zu
`stale_context`.

Lokal bestanden 174 Testdateien mit 1.740 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, leerer Prisma-Diff und der
90-Seiten-Build. Die isolierte QA prüfte Vorschau ohne Fachschreiben, falsche
Phrase, Abbruch, veralteten Kontext, Rollen, garantierte Mandantentrennung,
neues Projekt, Aufgabe, Logbuch, Timeline, korreliertes Audit, Replay und null
Rückstände. Der echte Klicktest öffnete die Karte, hielt die falsche Phrase
gesperrt, erzeugte `DAR-449` und öffnete die reale Projektakte. Der normale
Online-Anfragen-E2E-Lauf blieb einschließlich sicherer Fotos,
`Anfragebilder`, Storage-Fallback, Neukunde, Rate-Limits und Replay vollständig
grün. Der permanente Korpus blieb exakt 110 Fälle groß und enthält nun einen
echten, ausschließlich vorbereitenden Umwandlungsfall.

Produktiv abgenommen auf Runtime-Commit
`7777c77727d07c2d9fbb370b56f788f21127128f`. Das verifizierte Datenbank-, Git-,
Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260802T091757Z-before-jarvis-online-conversion`.
Produktiv bestanden die isolierte Umwandlungs-QA, der vollständige normale
Online-Anfragen-E2E-Lauf und 110/110 permanente Fragen mit 29 ausschließlich
vorbereiteten, null ausgeführten Aktionen und null Rückständen. Live-Prisma-Diff
leer, Dashboard und Formular HTTP 200; WorkPilot PID `750917`, KlinikNavigator
unverändert PID `398228`. Keine Prisma-Schemaänderung; `StoredFile`, privater
S3-Speicher und alle Online-Anfragen-Invarianten blieben erhalten.

## 39. Persönliche laufende Stempelung pausieren und fortsetzen

JARVIS kann die eigene laufende Stempelung des angemeldeten internen
Benutzers jetzt kontrolliert pausieren und fortsetzen. Die Aktion
`time.session.manage` ist strikt persönlich: Vertretung, Impersonation,
Bedienung eines anderen Mitarbeiters, Start, Stop und manuelle Zeiterfassung
sind über diesen Vertikalschnitt nicht möglich. Die Vorschau zeigt Projekt
oder unproduktiven Kontext, Startzeit, aktuellen Zustand, bisher erfasste
Arbeitszeit und Pause. Laufende Zeitsegmente werden bis zum Vorschauzeitpunkt
korrekt einbezogen.

Normale Oberfläche und JARVIS verwenden denselben Fachservice
`src/lib/time/stamp-session-service.ts`. Die Änderung läuft in einer
serialisierbaren Transaktion unter organisations-/benutzerbezogenem
PostgreSQL-Advisory-Lock und Zeilensperre. JARVIS bindet den persistenten
Entwurf an Organisation, Sitzung, Session- und Effektividentität, Rollen,
Impersonationszustand, Payload-/Kontexthashes, Stempelrevision, Ablaufzeit und
HMAC. Nur die exakten Phrasen `STEMPELUNG PAUSIEREN` und
`STEMPELUNG FORTSETZEN` führen aus. Ein zwischenzeitlich veränderter Zustand
endet fail-closed als `stale_context`; Wiederholungen erzeugen keine doppelte
Pause oder Fortsetzung. Die normale Stempelroute behält für bereits erreichte
Zielzustände ihre bisherige idempotente Antwort.

Lokal bestanden 176 Testdateien mit 1.760 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, synchroner Datenbankstand und
der 90-Seiten-Build. Die isolierte QA prüfte Vertretungsgrenze,
Sitzungsbindung, Abbruch, falsche Phrase, veralteten Kontext, Pause und
Fortsetzung exactly-once, zwei korrelierte Audit-Ausführungen und vollständige
Bereinigung. Echte Klicktests deckten die zunächst fehlende laufende
Arbeitsminute sowie die laufende Pausenminute auf; beide Berechnungen wurden
vor Release korrigiert. Die Oberfläche zeigte danach korrekte Vorschauwerte,
den ausgeführten Zustand und den passenden Stempelstatus im Dashboard ohne
Browserfehler.

Produktiv abgenommen auf Runtime-Commit
`a35cd90d7f7d2bbbe03ae20b745acb6b4bdf151d`. Das verifizierte Datenbank-, Git-,
Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260802T101258Z-before-jarvis-stamp-session`.
Produktiv bestanden Dashboard und Formular mit HTTP 200, die isolierte
Stempel-QA einschließlich Exactly-once und 110/110 permanente Fragen mit 30
ausschließlich vorbereiteten, null ausgeführten Aktionen. Sämtliche
QA-Entwürfe, Sitzungen und Stempelungen wurden entfernt; Live-Prisma-Diff
leer. WorkPilot PID `755744`, KlinikNavigator unverändert PID `398228`. Keine
Prisma-Schemaänderung; `StoredFile`, privater S3-Speicher und alle
Online-Anfragen-Invarianten blieben unverändert.

## 40. Eigene Stempelung kontrolliert starten

JARVIS kann die persönliche Stempelung des angemeldeten internen Benutzers nun
kontrolliert starten. Projektstarts verlangen eine eindeutige Projektnummer und
eine konkrete Tätigkeitsbeschreibung; unproduktive Starts zusätzlich eine
eindeutig benannte unproduktive Tätigkeit. Vertretung, Impersonation und die
Bedienung eines anderen Mitarbeiters sind ausgeschlossen. Die Vorschau zeigt
Arbeitsbezug, Tätigkeit, gegebenenfalls Gewerk und Abrechnungsleistung sowie
die ausdrücklich gewählte Projektstatuswirkung.

Normale Oberfläche und JARVIS verwenden denselben Fachservice
`src/lib/time/stamp-session-start-service.ts`. Bei Stunden-Dauerläufern müssen
Gewerk und eine aktive Katalogleistung vom Typ Leistung, Einheit Stunden,
positivem Verkaufspreis und passendem Gewerk feststehen. Eine bestätigte
Tagesplanung darf diesen Kontext liefern. Ein Projektstatus wird nur nach
ausdrücklichem Auftrag auf `Umsetzung` geändert; Status, Timeline, Logbuch und
Audit entstehen dann über den bestehenden Projektstatus-Fachservice atomar mit
der neuen Stempelung. Bereits laufende Stempelungen, abgeschlossene oder
archivierte Projekte, unvollständige Abrechnung und zwischenzeitlich geänderte
Kontexte sperren fail-closed.

Die Ausführung läuft serialisierbar unter einem organisations- und
benutzerbezogenen PostgreSQL-Advisory-Lock. Der persistente JARVIS-Entwurf ist
an Organisation, Sitzung, Session- und Effektividentität, Rollen,
Impersonationszustand, Payload-/Kontexthashes, Fachfingerprint, Revision,
Ablaufzeit und HMAC gebunden. Nur `STEMPELUNG STARTEN <PROJEKTNUMMER>` oder
`STEMPELUNG STARTEN UNPRODUKTIV` führen aus. Wiederholte Bestätigungen liefern
dieselbe aktive Sitzung und erzeugen keinen zweiten Start. Die optionalen
Marketing-/Kampagnenfelder der bestehenden Normalmaske bleiben im gemeinsamen
Service erhalten.

Lokal bestanden 177 Testdateien mit 1.768 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, synchroner Datenbankstand und
der 90-Seiten-Build. Die isolierte QA prüfte Vertretungsgrenze,
Sitzungsbindung, Abbruch, falsche Phrase, konkurrierenden Start,
`stale_context`, exactly-once, genau ein Ausführungs-Audit und vollständige
Bereinigung. Der echte Klicktest startete eine markierte unproduktive
Stempelung, zeigte Arbeitsbezug/Tätigkeit, exakte Phrase und anschließend den
aktiven Dashboardzustand; danach wurden Stempelung und Entwurf gezielt
entfernt und die Oberfläche zeigte wieder `Nicht eingestempelt`. Der feste
Korpus blieb exakt 110 Fälle groß.

Produktiv abgenommen auf Runtime-Commit
`76bd2e8e830c1e78467ff68cb0c6477fde5d55cb`. Das verifizierte Datenbank-, Git-,
Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260802T105835Z-before-jarvis-stamp-start`.
Produktiv bestanden die isolierte Start-QA und 110/110 permanente Fragen mit
31 ausschließlich vorbereiteten, null ausgeführten Aktionen und null
Rückständen. Live-Prisma-Diff leer, Dashboard und Formular HTTP 200; WorkPilot
PID `760146`, KlinikNavigator unverändert PID `398228`. Keine
Prisma-Schemaänderung; `StoredFile`, privater S3-Speicher und alle
Online-Anfragen-Invarianten blieben unverändert.

## 41. Eigene Stempelung atomar zur Folgetätigkeit wechseln

JARVIS kann einen laufenden persönlichen Arbeitsbezug jetzt in einem einzigen
kontrollierten Vorgang abschließen und die geprüfte Folgetätigkeit starten. Die
Vorschau vereint bisherigen Abschluss, Zeit/Pause, Endkontrolle, Abrechnung und
Unterbrechungsfolgen mit neuem Projekt oder unproduktiver Tätigkeit,
Tätigkeitsbeschreibung und gegebenenfalls Gewerk/Abrechnungsleistung. Die
kritische Phrase lautet `STEMPELUNG WECHSELN ZU <ZIEL>`; im Action Center heißt
der ausführende Schritt eindeutig `Jetzt zur Folgetätigkeit wechseln`.

`src/lib/time/stamp-session-switch-service.ts` komponiert die gemeinsamen
Start- und Stoppservices in einer serialisierbaren Transaktion unter demselben
persönlichen Advisory-Lock. Deterministische IDs machen Zeitbuchung und neue
aktive Sitzung zu einem exactly-once-Paar. Vollständige Replays werden
wiederverwendet, ein nur teilweise vorhandenes Paar sperrt. Die normale
Stempelmaske verwendet denselben Wechselvertrag statt der früheren getrennten
Stopp- und Startrequests und hält ihre Request-ID für sichere Wiederholungen
stabil.

JARVIS markiert den Entwurf erst nach idempotenter Endkontrolle,
Stunden-Rechnungsbindung und Unterbrechungsfolge als ausgeführt. Organisation,
Benutzer, Sitzung, Rollenpaar, Impersonation, Payload, kombinierter
Fachfingerprint, Revision, Ablauf und HMAC bleiben gebunden. Ein unterbrochener
Arbeitsbezug kann nicht sofort als neues Teilstück desselben Projekts gestartet
werden; dafür ist Fortsetzen oder ein anderer Bezug erforderlich.

Lokal bestanden 181 Testdateien mit 1.791 Tests, TypeScript,
Mojibake-/Regressionschecks und der 90-Seiten-Build. Die isolierte QA prüfte
drei echte Fachfälle einschließlich Stunden-Rechnungsentwurf und
OK-immocare-Endkontrolle, falsche Phrase, Sitzungsbindung, drei
Exactly-once-Audits und vollständige Bereinigung. Der permanente Korpus bestand
110/110 mit 32 ausschließlich vorbereiteten und null ausgeführten Aktionen.
Der echte Oberflächenklick wechselte eine markierte unproduktive Tätigkeit,
zeigte sofort und nach Team-Auto-Update den neuen Arbeitsbezug und erzeugte
genau eine alte Zeitbuchung sowie eine neue aktive Sitzung; Browserfehler und
QA-Rückstände: null.

Produktiv abgenommen auf Runtime-Commit
`e778ba291a7d17e260c13efd65d292dd267d6af9`. Das verifizierte Quellen- und
Datenbankbackup liegt unter
`/var/backups/workpilot360/20260802T125808Z-before-jarvis-stamp-switch`.
Produktiv bestanden die isolierte Wechsel-QA mit drei genau einmal
ausgeführten Fachfällen sowie 110/110 permanente Fragen mit 33 ausschließlich
vorbereiteten und null ausgeführten Korpusaktionen. Live-Prisma-Diff und
QA-Rückstände sind leer, Dashboard und öffentliches Formular antworten mit
HTTP 200. WorkPilot PID `769535`, KlinikNavigator unverändert PID `398228`.
Keine Prisma-Schemaänderung; `StoredFile`, privater S3-Speicher und alle
Online-Anfragen-Invarianten blieben erhalten.

## 48. Vollständige offene Terminwunschserien kontrolliert entscheiden

JARVIS kann die vollständige aktive Terminwunschserie hinter der
`recurrenceId` eines über seine vollständige sichtbare ID eindeutig benannten
Serieneintrags freigeben oder begründet ablehnen. Entscheiden dürfen nur
Führungskraft, Geschäftsführung oder Admin. Die exakten Phrasen lauten
`TERMINWUNSCH-SERIE FREIGEBEN <ID>` und
`TERMINWUNSCH-SERIE ABLEHNEN <ID>`; die Ablehnung benötigt zusätzlich einen
nachvollziehbaren Grund.

Die Vorschau zeigt den vollständigen Serienumfang, Anzahl, Zeitraum und den
repräsentativen Wunsch. Alle aktiven Eintrag-IDs und jeder fachlich relevante
Serienstand sind fingerprintgebunden. Gemischte Freigabestatus, fehlende oder
inaktive Mitarbeitende sowie fehlende oder archivierte Projekte sperren
fail-closed. Vor einer Freigabe werden für jede einzelne Folge genehmigte
Abwesenheiten und Überschneidungen erneut geprüft. Ein Konflikt auch nur in
einem späteren Termin blockiert die gesamte Freigabe, sodass niemals eine
unbemerkte Teilserie entsteht.

Normale Planungsoberfläche und JARVIS verwenden denselben Fachservice
`src/lib/planning/planning-request-decision-service.ts`. Die serialisierbare
Ausführung sperrt die Serie per PostgreSQL-Advisory-Lock und jeden betroffenen
Eintrag per Zeilensperre. Freigabestatus beziehungsweise Soft-Delete,
Planungshistorie, Projektlogbuch, deterministische Mitarbeiterhinweise und der
Exactly-once-Replay-Marker entstehen atomar für alle Serieneinträge. Ein
zwischenzeitlich veränderter Umfang oder Fachstand endet mit `stale_context`.
Einzelentscheidungen, Serienabsage und eigener Serienrückzug bleiben getrennte
ausdrücklich gewählte Aktionen.

Lokal bestanden 187/187 Testdateien mit 1.860/1.860 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, leerer Schema-Diff und der
90-Seiten-Build. Die isolierte QA bestätigte Rollen- und Mandantengrenzen,
Freigabe und Ablehnung vollständiger Serien, gemischte Status, einen Konflikt
in einer späteren Folge, denselben Fachservice der normalen API, gesperrte
Altwege, exakt einmal geschriebene Historien sowie null Rückstände. Der feste
Korpus bestand lokal 110/110 mit 32 nur vorbereiteten und null ausgeführten
Aktionen. Der echte Klicktest zeigte zwei Termine, den vollständigen Zeitraum,
eine bei falscher Phrase gesperrte und bei exakter Phrase freigegebene
Ausführung sowie das korrekte Gesamtergebnis; die Daten wurden entfernt.

Produktiv abgenommen auf Runtime-Commit
`cb2bfc6a98f88afb53d674c24f5f5da99b6e927e`. Das verifizierte Datenbank-, Git-,
Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260802T170422Z-before-jarvis-planning-request-series-decision`.
Produktiv bestanden die erweiterte Serien-, Rollen-, Mandanten-, Konflikt-,
Shared-Service-, Bypass- und Exactly-once-QA mit 19 Fachhistorien sowie der
echte Zwei-Termine-JARVIS-Klicktest. Der permanente Korpus bestand 110/110 mit
33 nur vorbereiteten, null ausgeführten Aktionen. Testdatenrückstände und
Live-Prisma-Diff sind leer; Dashboard und öffentliches Formular antworten mit
HTTP 200. WorkPilot PID `791271`, KlinikNavigator unverändert PID `398228`.
Keine Prisma-Schemaänderung; `StoredFile`, privater S3-Speicher und alle
Online-Anfragen-Invarianten blieben erhalten.

## 47. Vollständige Terminserien kontrolliert absagen oder zurückziehen

JARVIS und die normale Planungsoberfläche können jetzt ausdrücklich eine
vollständige gespeicherte Terminserie verändern. `cancel_series` sagt eine
durchgehend bestätigte Serie ab; `withdraw_series` zieht eine durchgehend
offene Terminwunschserie zurück. Die Vorschau zeigt einen sichtbar benannten
Serieneintrag, Anzahl, ersten und letzten Termin, Mitarbeitende, Projekte und
Grund. Gemischte Freigabestatus sperren fail-closed. Mitarbeiter dürfen nur
eine vollständig eigene Wunschserie in ihrer unveränderten, nicht vertretenen
Sitzung zurückziehen; Serienabsagen bleiben Planungsverantwortlichen
vorbehalten.

Ausgeführt wird nur mit `TERMIN-SERIE ABSAGEN <Eintrag-ID>` beziehungsweise
`TERMINWUNSCH-SERIE ZURÜCKZIEHEN <Eintrag-ID>`. Der vollständige aktive
Serienumfang ist im Fingerprint gebunden. Die serialisierbare Transaktion
sperrt die Serie per PostgreSQL-Advisory-Lock und alle betroffenen Zeilen,
entfernt entweder alle geprüften Einträge oder keinen und schreibt je Termin
deterministische Historie, Projektlogbuch und Hinweise. Ein eigener
Replay-Marker erlaubt sichere Wiederholungen auch nach dem Soft-Delete und
liefert exakt die ursprünglich betroffenen Einträge. Direkte Altwege bleiben
gesperrt; Einzelterminaktionen verändern weiterhin niemals still die Serie.

Lokal bestanden 187/187 Testdateien mit 1.851/1.851 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, leerer Schema-Diff und der
90-Seiten-Build. Die isolierte QA prüfte komplette Termin- und Wunschserien,
Mitarbeiter- und Managementrollen, Mandantentrennung, Mischstatus-Sperre,
Normalroute, Altweg-Sperren, Benachrichtigungen, genau-einmal-Replay und null
Rückstände. Der echte Klicktest zeigte zwei Serientermine, Zeitraum, falsche
und exakte Phrase, atomare Ausführung sowie den korrekten Nachtext; alle
Testdaten wurden entfernt. Der permanente Korpus blieb exakt bei 110/110 und
führte keine Aktion aus.

Produktiv abgenommen auf Runtime-Commit
`1ee7e01d112396e2b98944fc6d2228139ed05e78`. Verifiziertes Quellen-,
Datenbank-, Konfigurations- und Runtimebackup:
`/var/backups/workpilot360/20260802T163736Z-before-jarvis-planning-series`.
Produktive isolierte QA und 110/110 Fragen bestanden ohne Rückstände;
Live-Prisma-Diff leer, Dashboard und Online-Formular HTTP 200. WorkPilot PID
`788731`, KlinikNavigator unverändert PID `398228`. Keine
Prisma-Schemaänderung; `StoredFile`, privater S3-Speicher und alle
Online-Anfragen-Invarianten blieben erhalten.

## 46. Eigenen offenen Terminwunsch kontrolliert zurückziehen

Ein Mitarbeiter kann mit JARVIS ausschließlich einen eigenen offenen
Terminwunsch zurückziehen. Er benötigt die vollständige sichtbare ID, einen
nachvollziehbaren Rückzugsgrund und exakt
`TERMINWUNSCH ZURÜCKZIEHEN <ID>`. Fremde Terminwünsche, bestätigte Termine,
Vertretung oder Impersonation werden abgewiesen. Führungskraft,
Geschäftsführung und Admin dürfen den organisationsgebundenen Planungsweg
weiterhin nutzen.

Normale Terminwunschmaske und JARVIS verwenden denselben Fachservice
`src/lib/planning/planning-request-decision-service.ts`. Auch die normale
Maske fragt den Grund ab, führt erst die aktuelle serverseitige Prüfung aus
und bestätigt danach den fingerprintgebundenen Ausführungsvertrag. Der alte
direkte DELETE-Weg ist für offene Wünsche gesperrt. Serien werden nicht still
mit verändert; nur der ausdrücklich bezeichnete Wunsch wird logisch entfernt.

Organisation, Sitzung, unveränderte eigene Session-/Effektividentität,
Nicht-Impersonation, Rollen, Payload, Wunsch-/Projekt-/Person-/Serienstand,
Revision, Ablauf und HMAC sind gebunden. Die serialisierbare Ausführung nutzt
Advisory- und Zeilensperre. Ein vorhandener offener Freigabehinweis an die
Planung wird atomar aufgelöst; Planungshistorie, Projektlogbuch und
deterministische neue Hinweise entstehen exactly-once. Mail und Push folgen
als sichere Zusatzkanäle.

Lokal bestanden 187/187 Testdateien mit 1.845/1.845 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma, leerer Schema-Diff und 90-Seiten-Build.
Die isolierte QA prüfte zusätzlich Eigen- und Fremdwunsch, Mitarbeiterrolle,
Normalroute, alten DELETE-Bypass, Freigabehinweis-Auflösung und
Exactly-once-Replay; sieben Fachfälle, null Rückstände. Der permanente Korpus
blieb exakt 110 Fragen groß. Der echte JARVIS-Klicktest bestätigte Vorschau,
Pflichtgrund, exakte Phrase, genau einen Rückzug und richtige
Projektnavigation; alle Testdaten wurden entfernt.

Produktiv abgenommen auf Runtime-Commit
`f49f1551374fe64001165b520521ff6c7d7014f8`. Verifiziertes Backup:
`/var/backups/workpilot360/20260802T160051Z-before-jarvis-planning-request-withdraw`.
Produktiv bestanden die erweiterte Eigen-/Fremdwunsch-, Rollen-, Mandanten-,
Shared-Service-, Bypass- und Exactly-once-QA sowie 110/110 permanente Fragen
mit 33 nur vorbereiteten und null ausgeführten Korpusaktionen. Rückstände und
Live-Prisma-Diff leer; Dashboard/Formular HTTP 200. WorkPilot PID `785414`,
KlinikNavigator unverändert PID `398228`. Keine Prisma-Schemaänderung;
`StoredFile`, privater S3-Speicher und alle Online-Anfragen-Invarianten blieben
erhalten.

## 45. Bestätigte Planungstermine kontrolliert absagen

JARVIS kann einen über seine vollständige sichtbare ID eindeutig bestimmten
bestätigten Planungstermin mit einem nachvollziehbaren Grund absagen. Die
exakte kritische Phrase lautet `TERMIN ABSAGEN <ID>`. Bei einem Serieneintrag
zeigt die Vorschau unübersehbar, dass nur dieser einzelne Termin betroffen ist;
die übrige Serie bleibt unverändert. Offene Terminwünsche werden nicht über
diesen Absageweg verändert.

Die normale Planungsoberfläche und JARVIS verwenden denselben Fachservice
`src/lib/planning/planning-request-decision-service.ts`. Die Normalmaske fragt
den Absagegrund ab, führt zuerst die serverseitige Prüfung aus und bestätigt
danach denselben fingerprintgebundenen Ausführungsvertrag. Der alte allgemeine
DELETE-Weg lehnt bestätigte Termine mit HTTP 409 ab und kann die kontrollierte
Absage nicht umgehen. Das Zurückziehen eigener offener Terminwünsche bleibt
als getrennte bestehende Berechtigung erhalten.

Nur Führungskraft, Geschäftsführung oder Admin dürfen bestätigte Termine
absagen. Organisation, Sitzung, Session-/Effektividentität, Rollen,
Impersonation, Payload, vollständiger Termin-, Projekt-, Personen- und
Serienstand, Revision, Ablaufzeit und HMAC sind gebunden. Die Ausführung läuft
serialisierbar unter organisations- und terminbezogenem Advisory-Lock sowie
Zeilensperre. Soft-Delete, Planungshistorie, Projektlogbuch und
deterministische In-App-Hinweise entstehen genau einmal; Mail und Push bleiben
sichere nachgelagerte Zusatzkanäle.

Lokal bestanden 187/187 Testdateien mit 1.841/1.841 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, leerer Schema-Diff und der
90-Seiten-Build. Die erweiterte isolierte QA prüfte zusätzlich JARVIS- und
Normalroutenabsage, exakte Phrase, Pflichtgrund, Einzelterminwarnung,
Exactly-once-Replay und die Sperre des alten DELETE-Wegs; fünf Fachfälle,
fünf Mitarbeiterhinweise und null Rückstände. Der permanente Korpus blieb
exakt 110 Fragen groß. Ein echter JARVIS-Klicktest bestätigte Vorschau,
Serienhinweis, Phrasensperre, genau eine Absage und Navigation ins richtige
Projekt; alle Testdaten wurden entfernt.

Produktiv abgenommen auf Runtime-Commit
`95def91426891069da93540d40f0df7191cd7450`. Das verifizierte Datenbank-, Git-,
Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260802T154313Z-before-jarvis-planning-cancel`.
Produktiv bestanden die erweiterte Rollen-, Mandanten-, Shared-Service-,
Bypass-, Serien- und Exactly-once-QA sowie 110/110 permanente Fragen mit 33
nur vorbereiteten, null ausgeführten Korpusaktionen. Rückstände und
Live-Prisma-Diff sind leer; Dashboard und öffentliches Formular antworten mit
HTTP 200. WorkPilot PID `782943`, KlinikNavigator unverändert PID `398228`.
Keine Prisma-Schemaänderung; `StoredFile`, privater S3-Speicher und alle
Online-Anfragen-Invarianten blieben erhalten.

## 42. Bestehende Zeiteinträge kontrolliert korrigieren und löschen

JARVIS kann einen über seine vollständige Zeiteintrags-ID eindeutig benannten
Eintrag als kritische Aktion zur Korrektur oder Löschung vorbereiten. Für eine
Korrektur müssen Grund und mindestens ein zulässiges Änderungsfeld feststehen;
für eine Löschung genügt ein nachvollziehbarer Grund. Die Vorschau zeigt
Aktion, Zeiteintrags-ID, Projekt, Mitarbeiter, bisherigen Zeitrahmen, Grund und
alle ausdrücklich geänderten Werte. Ausgeführt wird ausschließlich nach der
exakten Phrase `ZEITEINTRAG KORRIGIEREN <ID>` beziehungsweise
`ZEITEINTRAG LÖSCHEN <ID>`.

Normale Zeitoberfläche und JARVIS verwenden denselben Fachservice
`src/lib/time/project-time-entry-management-service.ts`. Bereits gelöschte
oder in irgendeiner Form rechnungsgebundene Zeiten sperren fail-closed.
Mitarbeitende dürfen im normalen Zeitbereich nur eigene manuelle Einträge
ändern; die kritische JARVIS-Verwaltung bleibt auf die vorhandenen
Zeitverwaltungsrollen begrenzt. Projekt, Mitarbeiter, Herkunft, Planung und
Marketingbezug können über diesen Vertrag nicht umgehängt werden. Zulässig
sind ausschließlich Datum, Beginn, Ende, Pause, Kommentar, Gewerk,
Auftragsgrundlage, Abrechnungsleistung, Abschluss- und Überstundenstatus.

Der vollständige fachlich relevante Zeilenstand einschließlich
Rechnungsbindung, Kosten-Snapshots, Marketingbezug, Freigabedaten,
Bearbeitungshistorie und Löschstatus ist per SHA-256 gebunden. Ausführung
erfolgt serialisierbar unter organisations-/zeiteintragsbezogenem
PostgreSQL-Advisory-Lock und Zeilensperre. Korrekturen bewahren den historischen
Stundenkostensatz und berechnen nur den Kostensnapshot für die korrigierte
Dauer neu; Löschungen sind logische Löschungen. Grund, Akteur, Vorher-/Nachher
und Zeitpunkt werden ausschließlich serverseitig in der Bearbeitungshistorie
ergänzt. Der persistente JARVIS-Entwurf bindet zusätzlich Organisation,
Sitzung, Session- und Effektividentität, Rollen, Impersonation, Revision,
Ablauf, Payload-/Kontexthashes und HMAC. Wiederholte Bestätigungen schreiben
genau einmal; ein zwischenzeitlich geänderter Eintrag endet als
`stale_context`.

Die isolierte End-to-End-QA liegt in
`scripts/qa-jarvis-time-entry-management.mjs` und deckt Rollen,
Mandantentrennung, Rechnungsbindung, Abbruch, falsche Phrase, Sitzungsbindung,
Korrektur und Soft-Delete exactly-once, Kosten-Snapshot, geschützte
Identitätsfelder, normale API und rückstandsfreie Bereinigung ab. Der
permanente Korpus bleibt exakt 110 Fragen groß und enthält einen
ausschließlich vorbereitenden Korrekturfall.

Lokal bestanden 183 Testdateien mit 1.811 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, leerer Schema-Diff und der
90-Seiten-Build. Die isolierte QA bestätigte Rollen- und Mandantengrenze,
Rechnungsbindung, Abbruch, falsche/exakte Phrase, Sitzungsbindung, Korrektur
und Soft-Delete exactly-once, unveränderten historischen Kostensatz,
geschützte Identitätsfelder, dieselbe normale API und null Rückstände. Der
permanente lokale Korpus bestand 110/110 mit 32 ausschließlich vorbereiteten
und null ausgeführten Aktionen. Der echte Klicktest bestätigte die gesperrte
Ausführung bei falscher Phrase, die Freigabe bei exakter Phrase, genau eine
Korrektur, den korrigierten Beginn 08:15 im geöffneten Zeiteintrag und null
Browserfehler; Klicktestdaten und Entwurf wurden vollständig entfernt.

Produktiv abgenommen auf Runtime-Commit
`4e8923252eaafd867b4e0c2daf7c77e4863f0786`. Das verifizierte Datenbank-, Git-,
Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260802T135901Z-before-jarvis-time-entry-management`.
Die isolierte Produktions-QA bestand vollständig mit zwei genau einmal
ausgeführten Fachfällen und null Entwurfs-, Zeit-, Projekt-, Sitzungs- oder
Mandantenrückständen. Der feste Live-Korpus bestand 110/110 mit 33 nur
vorbereiteten, 0 ausgeführten Aktionen und null Rückständen. Live-Prisma-Diff
leer, Dashboard und öffentliches Formular HTTP 200; WorkPilot PID `774010`,
KlinikNavigator unverändert PID `398228`. Keine Prisma-Schemaänderung;
`StoredFile`, privater S3-Speicher und alle Online-Anfragen-Invarianten blieben
erhalten.

## 43. Bestehende Termine und Terminwünsche kontrolliert verschieben

JARVIS kann einen über seine vollständige sichtbare ID eindeutig bestimmten
bestätigten Termin oder Terminwunsch auf ein neues Datum und Zeitfenster
verschieben. Titel, Beschreibung, Projekt, Mitarbeiter, Freigabestatus,
Gewerk, Abrechnungsleistung und Serienzuordnung bleiben unverändert. Bei einem
Serieneintrag erklärt die Vorschau ausdrücklich, dass nur dieser einzelne
Termin verschoben wird; ein unbestimmter Wunsch zur Verschiebung einer ganzen
Serie führt nicht zu einer stillen Massenänderung. Ausgeführt wird nur mit
`TERMIN VERSCHIEBEN <ID>`.

Normale Planungsmaske und JARVIS verwenden denselben Fachservice
`src/lib/planning/planning-entry-move-service.ts`. Der bisherige allgemeine
POST-Weg lehnt Datum-/Uhrzeitänderungen bestehender Einträge ab; die normale
Oberfläche nutzt stattdessen den gemeinsamen PATCH-Vertrag mit Prüfung und
Ausführung. Vor beiden Stufen werden aktive Mitarbeiterzuordnung,
Abwesenheiten, projektgleiche Tagesdubletten, Überschneidungen,
Projekt-/Archivstatus, Angebots-Ausführungsmonat und verfügbares Angebots- oder
Monatspauschalenkontingent geprüft. Eine bewusste Überplanung benötigt eine
nachvollziehbare Begründung, die zusammen mit dem Kontingentstand per
Fingerprint gebunden wird.

Die Ausführung läuft serialisierbar unter organisations- und
termingebundenem PostgreSQL-Advisory-Lock sowie Zeilensperre. Organisation,
Sitzung, Session-/Effektividentität, Rollen, Impersonation, Payload,
Fachkontext, Revision, Ablaufzeit und HMAC bleiben gebunden. Ein veränderter
Termin-, Abwesenheits-, Überschneidungs-, Projekt- oder Kontingentstand sperrt
als `stale_context`. Planungshistorie, Projektlogbuch und deterministische
In-App-Hinweise werden genau einmal angelegt; Mail und Push laufen danach als
sichere Zusatzkanäle. Wiederholte Ausführung liefert denselben Termin ohne
zweite Historie oder zweite Benachrichtigung.

Lokal bestanden 185 Testdateien mit 1.824 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, leerer Schema-Diff und der
90-Seiten-Build. Die isolierte QA prüfte Rollen, Mandantentrennung, Abbruch,
falsche/exakte Phrase, Sitzungsbindung, exactly-once, Serienerhalt, denselben
Fachservice der normalen API, Mitarbeiterhinweise und die Sperre des alten
Änderungswegs. Der feste Korpus bestand 110/110 mit 32 ausschließlich
vorbereiteten und null ausgeführten Aktionen. Ein echter JARVIS-Klicktest
deckte Vorschau, kritische Phrase, Ausführung und Navigation zum verschobenen
Termin ab; sämtliche Testdaten wurden entfernt.

Produktiv abgenommen auf Runtime-Commit
`c0d11743bc16ffb005f89c7ac0516d58f027625f`. Das verifizierte Datenbank-, Git-,
Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260802T144707Z-before-jarvis-planning-move`.
Produktiv bestanden die isolierte Terminverschiebe-QA und 110/110 permanente
Fragen mit 33 ausschließlich vorbereiteten, null ausgeführten Aktionen. Alle
QA-Rückstände und der Live-Prisma-Diff sind leer; Dashboard und öffentliches
Formular antworten mit HTTP 200. WorkPilot PID `777855`, KlinikNavigator
unverändert PID `398228`. Keine Prisma-Schemaänderung; `StoredFile`, privater
S3-Speicher und alle Online-Anfragen-Invarianten blieben erhalten.

## 44. Terminwünsche kontrolliert freigeben oder ablehnen

JARVIS kann einen über seine vollständige sichtbare ID eindeutig bestimmten
offenen Terminwunsch freigeben oder mit einer mindestens drei Zeichen langen
Begründung ablehnen. Entscheiden dürfen ausschließlich Führungskraft,
Geschäftsführung oder Admin. Bei Serienterminen bleibt die Entscheidung auf
den einzelnen Wunsch beschränkt und wird in der Vorschau ausdrücklich so
benannt. Die exakten Phrasen lauten `TERMINWUNSCH FREIGEBEN <ID>` und
`TERMINWUNSCH ABLEHNEN <ID>`.

Normale Planungsoberfläche und JARVIS verwenden denselben Fachservice
`src/lib/planning/planning-request-decision-service.ts`. Der frühere direkte
Wechsel von `requested` nach `confirmed` über den allgemeinen POST-Vertrag ist
gesperrt. Vor Freigabe und Ausführung werden offener Status, aktiver
Mitarbeiter, vorhandenes nicht archiviertes Projekt, genehmigte Abwesenheiten
und Überschneidungen mit bestätigten Einträgen erneut geprüft. Ablehnung wird
als Soft-Delete des Wunsches mit dauerhaft nachvollziehbarer Entscheidung
geführt.

Die Ausführung läuft serialisierbar unter organisations- und
terminwunschgebundenem PostgreSQL-Advisory-Lock sowie Zeilensperre.
Organisation, Sitzung, Session-/Effektividentität, Rollen, Impersonation,
Payload, Fachfingerprint, Revision, Ablaufzeit und HMAC sind gebunden.
Zwischenzeitliche fachliche Änderungen sperren als `stale_context`.
Planungshistorie, Projektlogbuch und deterministische In-App-Hinweise werden
genau einmal angelegt; Mail und Push laufen danach als sichere Zusatzkanäle.

Lokal bestanden 187 Testdateien mit 1.836 Tests, TypeScript,
Mojibake-/Regressionschecks, Prisma-Validierung, leerer Schema-Diff und der
90-Seiten-Build. Die isolierte QA prüfte Rollen, Mandantentrennung, Abbruch,
falsche/exakte Phrase, Sitzungsbindung, Freigabe und Ablehnung exactly-once,
denselben Fachservice der normalen API, die Sperre des alten Bypass-Wegs,
Mitarbeiterhinweise und vollständige Bereinigung. Der feste Korpus bestand
110/110 mit 32 ausschließlich vorbereiteten und null ausgeführten Aktionen.
Ein echter JARVIS-Klicktest bestätigte Vorschau, Phrasensperre, genau eine
Freigabe und die Ergebnisnavigation zur Planung; sämtliche Testdaten wurden
entfernt.

Produktiv abgenommen auf Runtime-Commit
`17a1bdc07f971c20945f59da3749821d3862144c`. Das verifizierte Datenbank-, Git-,
Konfigurations- und Runtime-Backup liegt unter
`/var/backups/workpilot360/20260802T152135Z-before-jarvis-planning-request-decision`.
Produktiv bestanden die isolierte Rollen-, Mandanten-, Shared-Service-,
Bypass- und Exactly-once-QA sowie 110/110 permanente Fragen mit 33 nur
vorbereiteten, null ausgeführten Aktionen. Alle QA-Rückstände und der
Live-Prisma-Diff sind leer; Dashboard und öffentliches Formular antworten mit
HTTP 200. WorkPilot PID `780832`, KlinikNavigator unverändert PID `398228`.
Keine Prisma-Schemaänderung; `StoredFile`, privater S3-Speicher und alle
Online-Anfragen-Invarianten blieben erhalten.
