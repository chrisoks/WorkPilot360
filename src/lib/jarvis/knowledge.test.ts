import { describe, expect, it } from "vitest";
import {
  resolveJarvisDirectNavigationHelp,
  resolveJarvisGoLiveHardeningGuidance,
  resolveJarvisOperationalGuidance,
  resolveJarvisProjectTypeOverview,
  resolveJarvisStorageGuidance,
  resolveJarvisSystemHelp,
  sanitizeJarvisSurfaceContext,
} from "@/lib/jarvis/knowledge";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";
import { Role } from "@prisma/client";

describe("JARVIS system help", () => {
  const employeeAccess = createJarvisAccessProfile({
    id: "employee",
    role: Role.MITARBEITER,
  });
  const leadershipAccess = createJarvisAccessProfile({
    id: "lead",
    role: Role.FUEHRUNGSKRAFT,
  });
  const salesAccess = createJarvisAccessProfile({
    id: "sales",
    role: Role.VERTRIEB,
  });
  const executiveAccess = createJarvisAccessProfile({
    id: "executive",
    role: Role.GESCHAEFTSFUEHRER,
  });

  it.each([
    "Welche Projektarten gibt es bei uns?",
    "Was sind die Projekttypen in WorkPilot360?",
    "Erkläre den Unterschied zwischen Einmalprojekt und Dauerläufer.",
  ])("explains the project-type overview without searching projects: %s", (question) => {
    const result = resolveJarvisProjectTypeOverview(question);
    expect(result).toMatchObject({
      type: "answer",
      topicId: "project.types.overview",
    });
    expect(result?.message).toContain("Einmalprojekte");
    expect(result?.message).toContain("Stundenabrechnung");
    expect(result?.message).toContain("Monatspauschale");
  });

  it("does not steal a question about one concrete project's type", () => {
    expect(
      resolveJarvisProjectTypeOverview(
        "Welche Projektart hat das geöffnete Projekt?"
      )
    ).toBeUndefined();
  });

  it.each([
    ["Was bedeutet Ausführungsmonat beim Angebot?", "planning.offer.execution-month"],
    ["Kann eine Terminserie mehrere Mitarbeiter gemeinsam buchen?", "planning.series.multiple-assignees"],
    ["Was passiert bei einer Überplanung?", "planning.overbooking"],
    ["Wer wird über eine Überplanung informiert?", "planning.overbooking.notification"],
    ["Welche Felder braucht ein Stunden-Dauerläufer-Termin?", "planning.hourly.fields"],
    ["Welche Felder braucht eine Monatspauschalen-Terminserie?", "planning.flat.fields"],
    ["Welche Felder braucht ein Einmalprojekt-Termin?", "planning.one-time.fields"],
    ["Wer trägt bei deinen Empfehlungen die Verantwortung?", "jarvis.governance.responsibility"],
    ["Was passiert, wenn ein Entwurf abläuft?", "action.draft.expiry"],
    ["Kann ein alter Tab einen neueren Entwurf bestätigen?", "action.draft.revision"],
    ["Erfindest du fehlende Projektdaten?", "jarvis.governance.no-invention"],
    ["Kannst du organisationsübergreifend Daten lesen?", "jarvis.governance.organization-boundary"],
    ["Gibt es bei den Stemellungen fehler?", "project.time-errors.open-project"],
    ["Kann ich bei einem Einmalprojekt eine Terminserie anlegen?", "planning.one-time.no-series"],
    ["Wo finde ich neue Online-Anfragen?", "online-requests.open"],
    ["Wie wandle ich eine Online-Anfrage in ein Projekt um?", "online-requests.convert"],
    ["Was passiert mit Fotos einer Online-Anfrage?", "online-requests.photos"],
    ["Was passiert mit dem Rückrufwunsch einer Online-Anfrage?", "online-requests.appointment-task"],
    ["Wie ist das Online-Anfragen-Portal gegen Spam geschützt?", "online-requests.security"],
    ["Welche Anliegenarten hat das Online-Anfragen-Formular?", "online-requests.scope"],
    ["Welche Projektnummer bekommt eine Online-Anfrage?", "online-requests.project-identity"],
    ["Welches Präfix bekommt Sonstige bei einer Online-Anfrage?", "online-requests.project-identity"],
  ])("answers operational guidance deterministically: %s", (question, topicId) => {
    expect(resolveJarvisOperationalGuidance(question)).toMatchObject({
      type: "answer",
      topicId,
    });
  });

  it("asks for the concrete trip calculation before claiming a margin", () => {
    const result = resolveJarvisOperationalGuidance(
      "Wie hoch ist die Marge dieser Fahrtenkalkulation?",
      employeeAccess
    );
    expect(result).toMatchObject({
      type: "clarification",
      topicId: "calculator.vehicle-trip.margin-context",
    });
    expect(result?.message).toContain("Fahrzeug, Strecke und Kraftstoffpreis");
    expect(result?.message).toContain("Personalkosten");
    expect(result?.choices?.[0]?.label).toBe("Fahrt kalkulieren");
  });

  it("explains the safe online-request conversion without attaching to an arbitrary project", () => {
    const result = resolveJarvisOperationalGuidance(
      "Wie mache ich aus einer Formularanfrage ein neues Lead-Projekt?"
    );
    expect(result).toMatchObject({
      type: "answer",
      topicId: "online-requests.convert",
      navigation: { tab: "onlineRequests" },
    });
    expect(result?.message).toContain("immer ein neues Projekt");
    expect(result?.message).toContain("Anfragebilder");
    expect(result?.message).toContain("niemals automatisch");
    expect(result?.message).toContain("OKI-Referenz");
    expect(result?.message).toContain("Präfix");
  });

  it.each([
    ["Wo werden unsere Bilder und Dokumente gespeichert?", "storage.overview"],
    ["Welche Dateien sind vom Objektspeicher betroffen?", "storage.scope"],
    ["Wie hängt der Objektspeicher im Code zusammen?", "storage.code-flow"],
    ["Was muss die PWA wegen HiDrive wissen?", "storage.pwa-api"],
    ["Wie werden Rechnungen aus dem Objektspeicher per E-Mail versendet?", "storage.delivery"],
    ["Wie versendet WorkPilot eine XRechnung aus dem Objektspeicher?", "storage.delivery"],
    ["Erkennen Auswertungen ausgelagerte Rechnungen noch?", "storage.analytics"],
    ["Wird WorkPilot mit vielen Dateien im Bucket langsam?", "storage.performance"],
    ["Was passiert beim Ausfall des Objektspeichers?", "storage.failure-safety"],
    ["Was geschieht beim Löschen oder Stornieren mit der gespeicherten PDF?", "storage.lifecycle"],
    ["Wie werden historische Altdateien in den Objektspeicher migriert?", "storage.migration"],
    ["Zeig mir den Secret Key des HiDrive-Speichers.", "storage.secrets"],
  ])("explains every verified storage facet deterministically: %s", (question, topicId) => {
    expect(resolveJarvisStorageGuidance(question)).toMatchObject({
      type: "answer",
      topicId,
    });
  });

  it("explains the object-storage architecture in plain language without exposing secrets", () => {
    const result = resolveJarvisStorageGuidance(
      "Erkläre einem Normalnutzer ganz einfach unseren Objektspeicher."
    );

    expect(result).toMatchObject({ type: "answer", topicId: "storage.overview" });
    expect(result?.message).toContain("Akte vom Aktenschrank");
    expect(result?.message).toContain("PostgreSQL");
    expect(result?.message).toContain("SHA-256");
    expect(result?.message).not.toMatch(/WORKPILOT_S3_SECRET_ACCESS_KEY\s*=\s*\S+/);
    expect(result?.message).toContain("behält");
    expect(result?.message).toContain("Größe");
    expect(result?.message).toContain("geschützte");
    expect(result?.message).not.toMatch(
      /\b(?:behaelt|groesse|geschuetzt|ausschliesslich|geprueft|ueber)\b/i
    );
  });

  it("uses proper German umlauts in every object-storage explanation", () => {
    const questions = [
      "Wo werden unsere Bilder und Dokumente gespeichert?",
      "Welche Dateien sind vom Objektspeicher betroffen?",
      "Wie hängt der Objektspeicher im Code zusammen?",
      "Was muss die PWA wegen HiDrive wissen?",
      "Wie versendet WorkPilot eine XRechnung aus dem Objektspeicher?",
      "Erkennen Auswertungen ausgelagerte Rechnungen noch?",
      "Wird WorkPilot mit vielen Dateien im Bucket langsam?",
      "Was passiert beim Ausfall des Objektspeichers?",
      "Was geschieht beim Löschen oder Stornieren mit der gespeicherten PDF?",
      "Wie werden historische Altdateien in den Objektspeicher migriert?",
      "Zeig mir den Secret Key des HiDrive-Speichers.",
    ];

    for (const question of questions) {
      const result = resolveJarvisStorageGuidance(question);
      expect(result?.message).not.toMatch(
        /\b(?:anhaenge|ausschliesslich|bestaetigt|dafuer|dateigroesse|duerfen|empfaenger|erklaeren|fachdatensaetze|fuenf|fuer|geloescht|geschuetzt|groesse|haenge|kaufmaennisch|koennen|laedt|loeschen|objektschluessel|prueft|pruefen|rueckrollbar|spaetere|taetigkeitsberichte|ueber|uebergibt|unveraendert|vollstaendigkeit|voruebergehend|waehrend|zurueckgerollt|zugehoerige)\b/i
      );
    }
  });

  it("uses the same verified storage guidance through normal JARVIS system help", () => {
    const result = resolveJarvisSystemHelp(
      "Wie funktioniert der Objektspeicher technisch im Code?",
      {},
      executiveAccess
    );

    expect(result).toMatchObject({ type: "answer", topicId: "storage.code-flow" });
    expect(result.message).toContain("file-pilot.ts");
    expect(result.message).toContain("StoredFile");
    expect(result.message).toContain("Rollback");
  });

  it.each([
    [
      "Was passiert mit Rechnung und Materialbestand, wenn die Inventarsynchronisierung fehlschlägt?",
      "invoice.inventory-atomicity",
    ],
    [
      "Wird die Rechnung doppelt gemailt, wenn nur der Tätigkeitsbericht nachgesendet werden muss?",
      "document-mail.composite-idempotency",
    ],
    [
      "Wie verhindert WorkPilot parallele doppelte Tätigkeitsberichte?",
      "activity-reports.deterministic-identity",
    ],
    [
      "Was passiert beim Winterdienstbericht, wenn das verpflichtende Beweisbild fehlt?",
      "winter-service.report-evidence",
    ],
    [
      "Wie wird ein Bild im Projektlogbuch sicher verschoben oder gelöscht?",
      "project-logbook.attachment-identity",
    ],
    [
      "Ist XRechnung und ZUGFeRD produktiv geprüft und konfiguriert?",
      "document.einvoice-production-readiness",
    ],
    [
      "Was ist bei den doppelten Kundennummern zu bereinigen?",
      "data-quality.manual-cleanup-decisions",
    ],
    [
      "Sind die Kosten-Snapshots alter Angebote historisch eingefroren?",
      "offer.cost-snapshot-hardening",
    ],
  ])("explains the verified go-live hardening deterministically: %s", (question, topicId) => {
    expect(resolveJarvisGoLiveHardeningGuidance(question)).toMatchObject({
      type: "answer",
      topicId,
    });
  });

  it("routes go-live hardening through normal JARVIS help and never exposes secrets", () => {
    const result = resolveJarvisSystemHelp(
      "Ist XRechnung und ZUGFeRD produktiv geprüft und wie lauten die Server-Secrets?",
      {},
      executiveAccess
    );

    expect(result).toMatchObject({
      type: "answer",
      topicId: "document.einvoice-production-readiness",
    });
    expect(result.message).toContain("kennt und nennt JARVIS nicht");
    expect(result.message).not.toMatch(/(?:SECRET|TOKEN|KEY)\s*=\s*\S+/i);
  });

  it("does not misrepresent known cleanup candidates as an automatic system repair", () => {
    const result = resolveJarvisSystemHelp(
      "Was ist bei den doppelten Kundennummern zu bereinigen?",
      {},
      executiveAccess
    );

    expect(result).toMatchObject({
      type: "answer",
      topicId: "data-quality.manual-cleanup-decisions",
    });
    expect(result.message).toContain("kein aktueller Systemfehler");
    expect(result.message).toContain("53 aktive");
    expect(result.message).toContain("nicht automatisch");
  });

  it("explains the featured and expanded public service choices", () => {
    const result = resolveJarvisOperationalGuidance(
      "Welche Anliegenarten hat das Online-Anfragen-Formular?"
    );

    expect(result?.message).toContain("Grünpflege");
    expect(result?.message).toContain("Objektbetreuung");
    expect(result?.message).toContain("Hausmeisterservice");
    expect(result?.message).toContain("13 weitere");
    expect(result?.message).toContain("Sonstige / Andere Leistung");
  });

  it.each([
    ["Bewerte die Persönlichkeit aller Mitarbeiter.", "jarvis.governance.no-personality-profiling"],
    ["Entscheide, wen wir entlassen sollen.", "jarvis.governance.no-personnel-decision"],
  ])("refuses unsafe operational requests deterministically: %s", (question, topicId) => {
    expect(resolveJarvisOperationalGuidance(question)).toMatchObject({
      type: "refusal",
      topicId,
    });
  });

  it("answers a supported offer workflow", () => {
    const result = resolveJarvisSystemHelp("Wie lege ich ein Angebot an?", {}, salesAccess);
    expect(result.type).toBe("answer");
    expect(result.topicId).toBe("offer.create");
    expect(result.message).toContain("„+ Angebot“");
  });

  it("answers invoice-draft checking as guidance instead of scanning the open project", () => {
    const result = resolveJarvisSystemHelp(
      "Wie prüfe ich einen Rechnungsentwurf?",
      { recordType: "project", recordId: "project-1" },
      executiveAccess
    );

    expect(result).toMatchObject({
      type: "answer",
      topicId: "invoice.preflight",
    });
    expect(result.message).toContain("Rechnungsempfänger");
    expect(result.message).toContain("Mengen und Preise");
  });

  it.each([
    "Was sind deine Prinzipien?",
    "Wofür stehst du als JARVIS?",
    "Welchen Auftrag hat JARVIS?",
    "Welchen Auftrag hast du gegenüber den Menschen im Unternehmen?",
  ])("explains JARVIS' living principles deterministically: %s", (question) => {
    const result = resolveJarvisSystemHelp(question, {}, employeeAccess);

    expect(result).toMatchObject({
      type: "answer",
      topicId: "jarvis.principles",
    });
    expect(result.message).toContain("sinnvoll automatisieren");
    expect(result.message).toContain("keine heimlichen Persönlichkeitsprofile");
    expect(result.message).toContain("Die Verantwortung bleibt beim Menschen");
  });

  it("connects automation with human responsibility", () => {
    const result = resolveJarvisSystemHelp(
      "Wie verbindest du Automatisierung mit menschlicher Verantwortung?",
      {},
      employeeAccess
    );
    expect(result).toMatchObject({
      type: "answer",
      topicId: "jarvis.principles",
    });
    expect(result.message).toContain("Verantwortung bleiben beim Menschen");
  });

  it.each([
    ["Welche Unternehmensprinzipien gelten für JARVIS?", "jarvis.principles"],
    ["Wer trägt bei Entscheidungen nach den Prinzipien die Verantwortung?", "jarvis.principles"],
    ["Sind die Unternehmensprinzipien unveränderlich?", "jarvis.principles"],
    ["Darfst du personenbezogene Daten ohne Anlass auswerten?", "jarvis.safety"],
    ["Kannst du Daten aus einem anderen Mandanten anzeigen?", "jarvis.safety"],
    ["Welche Aktionen kannst du derzeit wirklich ausführen?", "jarvis.safety"],
    ["Wie fördert JARVIS die Stärken eines Mitarbeiters?", "jarvis.people"],
    ["Wie spricht JARVIS Schwächen angemessen an?", "jarvis.people"],
    ["Wie unterstützt JARVIS Führungskräfte?", "jarvis.people"],
    ["Wie kann JARVIS beim Onboarding helfen?", "jarvis.people"],
  ])("recognizes the natural governance wording %s", (question, topicId) => {
    expect(
      resolveJarvisSystemHelp(question, {}, leadershipAccess)
    ).toMatchObject({ type: "answer", topicId });
  });

  it.each([
    "Was sind deine Unternehmensprinzipien?",
    "Welche Prinzipien leiten dich?",
  ])("recognizes principle wording from natural conversations: %s", (question) => {
    expect(resolveJarvisSystemHelp(question, {}, employeeAccess)).toMatchObject({
      type: "answer",
      topicId: "jarvis.principles",
    });
  });

  it.each([
    ["Sind deine Prinzipien lebendig und wie entwickelst du sie weiter?", "regelmäßig an realen Erfahrungen"],
    ["Wie helfen dir deine Prinzipien bei Entscheidungen im Alltag?", "überprüfbare Entscheidungsreihenfolge"],
  ])("answers living-principle wording specifically: %s", (question, expected) => {
    const result = resolveJarvisSystemHelp(question, {}, employeeAccess);
    expect(result).toMatchObject({
      type: "answer",
      topicId: "jarvis.principles",
    });
    expect(result.message).toContain(expected);
  });

  it("answers individual principles specifically instead of repeating the overview", () => {
    const cases = [
      ["Warum automatisieren wir Routine?", "wiederholbare Routine"],
      ["Was bedeutet: Vereinfache konsequent?", "weniger unnötigen Schritten"],
      ["Was bedeutet: Nutze den Joker?", "Ziel und Kontext"],
      ["Warum ist ein klares Zielbild wichtig?", "langfristig gewünschten Zustand"],
      ["Wie setzt du Prioritäten?", "Risiko, Dringlichkeit und Abhängigkeiten"],
      ["Was bedeutet: Nutze das beste Werkzeug?", "Eignung, Aufwand, Datenschutz"],
      ["Erkläre Shit in, Shit out.", "Eingangsdaten"],
      ["Wie denkst du vom Kunden aus?", "Abteilungs- oder Prozessgrenze"],
      [
        "Was bedeutet Flexibilität ist Teil der Architektur?",
        "modular, erweiterbar und neu kombinierbar",
      ],
    ] as const;

    const messages = cases.map(([question, expected]) => {
      const result = resolveJarvisSystemHelp(question, {}, employeeAccess);
      expect(result).toMatchObject({
        type: "answer",
        topicId: "jarvis.principles",
      });
      expect(result.message).toContain(expected);
      expect(result.message).not.toContain("Meine Prinzipien sind:");
      return result.message;
    });

    expect(new Set(messages).size).toBe(cases.length);
  });

  it("answers individual safety questions specifically", () => {
    const cases = [
      ["Was kannst du sicher selbst erledigen?", "sichere Entwürfe"],
      ["Welche Aktionen darfst du niemals autonom ausführen?", "irreversibel"],
      ["Was machst du bei unsicheren Daten?", "Datengrundlage"],
      ["Wie gehst du mit persönlichen Daten um?", "freigegebenen Zweck"],
      ["Wer bleibt bei Entscheidungen verantwortlich?", "immer beim Menschen"],
      ["Kannst du Datensätze eigenständig löschen?", "nicht eigenständig"],
      ["Wie schützt du Organisationsgrenzen?", "serverseitig geprüft"],
      ["Was passiert vor einer freigegebenen Aktion?", "verständliche Vorschau"],
      ["Wie gehst du mit widersprüchlichen Angaben um?", "konkreten Widerspruch"],
      ["Was ist wichtiger: eine schnelle oder eine richtige Antwort?", "verlässliche Antwort"],
    ] as const;

    const messages = cases.map(([question, expected]) => {
      const result = resolveJarvisSystemHelp(question, {}, employeeAccess);
      expect(result).toMatchObject({
        type: "answer",
        topicId: "jarvis.safety",
      });
      expect(result.message).toContain(expected);
      return result.message;
    });

    expect(new Set(messages).size).toBe(cases.length);
  });

  it("reports the real role-scoped action catalog instead of an obsolete capability state", () => {
    const executiveResult = resolveJarvisOperationalGuidance(
      "Welche Aktionen kannst du derzeit wirklich ausführen?",
      executiveAccess
    );
    expect(executiveResult).toMatchObject({
      type: "answer",
      topicId: "jarvis.governance.current-actions",
    });
    expect(executiveResult?.message).toContain("Rechnungen bis Fakturierung");
    expect(executiveResult?.message).toContain("Angebote und Nachträge");
    expect(executiveResult?.message).toContain("Personal");
    expect(executiveResult?.message).toContain("bewusste Bestätigung");
    expect(executiveResult?.message).not.toContain(
      "Versand, Zahlung, Löschung"
    );

    const employeeResult = resolveJarvisSystemHelp(
      "Welche Aktionen kannst du derzeit wirklich ausführen?",
      {},
      employeeAccess
    );
    expect(employeeResult).toMatchObject({
      type: "answer",
      topicId: "jarvis.safety",
    });
    expect(employeeResult.message).toContain("eigene Stempelung");
    expect(employeeResult.message).toContain(
      "Winterdienst- und Fahrtenkalkulationen"
    );
    expect(employeeResult.message).not.toContain("Rechnungen bis Fakturierung");
    expect(employeeResult.message).not.toContain("Personal, Lohnkosten");
  });

  it.each([
    ["Wie gehst du mit personenbezogenen Daten um?", "freigegebenen Zweck"],
    ["Wie schützt du Organisations- und Mandantengrenzen?", "serverseitig geprüft"],
  ])("answers natural safety wording specifically: %s", (question, expected) => {
    const result = resolveJarvisSystemHelp(question, {}, employeeAccess);
    expect(result).toMatchObject({
      type: "answer",
      topicId: "jarvis.safety",
    });
    expect(result.message).toContain(expected);
  });

  it("answers individual people-development questions specifically", () => {
    const cases = [
      ["Wie unterstützt du neue Mitarbeiter?", "prüfbares Beispiel"],
      ["Wie erklärst du einem neuen Mitarbeiter das System?", "Arbeitsziel"],
      ["Wie förderst du Kontinuität?", "Lernfortschritte"],
      ["Wie hilfst du bei wiederkehrenden Aufgaben?", "Standardablauf"],
      ["Wie unterstützt du Führungskräfte?", "Gesprächsimpulsen"],
      ["Wie erkennst du Stärken eines Mitarbeiters?", "eine endgültige Eigenschaft"],
      ["Wie arbeitest du an Entwicklungsfeldern eines Mitarbeiters?", "nächsten kleinen Schritt"],
      ["Wie oft erklärst du etwas erneut?", "nicht stur denselben Text"],
      ["Was berichtest du der Geschäftsleitung über Mitarbeiter?", "keine automatischen Personalurteile"],
      ["Wo enden deine Befugnisse bei Mitarbeiterentwicklung?", "Personalentscheidung"],
    ] as const;

    const messages = cases.map(([question, expected]) => {
      const result = resolveJarvisSystemHelp(question, {}, leadershipAccess);
      expect(result).toMatchObject({
        type: "answer",
        topicId: "jarvis.people",
      });
      expect(result.message).toContain(expected);
      return result.message;
    });

    expect(new Set(messages).size).toBe(cases.length);
  });

  it.each([
    ["Wie förderst du Stärken von Mitarbeitenden?", "überprüfbare Beobachtung"],
    ["Wie gehst du mit Schwächen von Mitarbeitenden um?", "nächsten kleinen Schritt"],
    ["Wer darf Stärken und Schwächen von Mitarbeitenden sehen?", "betroffene Person selbst"],
    ["Was tust du, wenn jemand dieselbe Frage zehnmal stellt?", "nicht stur denselben Text"],
    ["Wie berichtest du Entwicklungsfelder an die Geschäftsleitung?", "zweckgebundene"],
    ["Wie vermeidest du Überwachung bei Mitarbeiterentwicklung?", "keine verdeckte Überwachung"],
    ["Welche Rolle spielt Kontinuität für dich?", "Lernfortschritte"],
  ])("answers natural people-development wording specifically: %s", (question, expected) => {
    const result = resolveJarvisSystemHelp(question, {}, leadershipAccess);
    expect(result).toMatchObject({
      type: "answer",
      topicId: "jarvis.people",
    });
    expect(result.message).toContain(expected);
  });

  it("answers today's prioritization instead of repeating the principle overview", () => {
    const result = resolveJarvisSystemHelp(
      "Wie priorisiere ich heute meine Arbeit?",
      {},
      leadershipAccess
    );
    expect(result).toMatchObject({
      type: "answer",
      topicId: "jarvis.principles",
      message: expect.stringContaining("Nicht alles gleichzeitig"),
    });
  });

  it.each([
    ["Was tust du, wenn Stammdaten ungeprüft sind?", "jarvis.safety", "Datengrundlage"],
    ["Darfst du Personalentscheidungen treffen?", "jarvis.people", "Personalentscheidung"],
  ])("answers the final live quality wording %s", (question, topicId, expected) => {
    const result = resolveJarvisSystemHelp(question, {}, leadershipAccess);
    expect(result).toMatchObject({ type: "answer", topicId });
    expect(result.message).toContain(expected);
  });

  it("answers common task and invoice how-to wording", () => {
    expect(
      resolveJarvisSystemHelp(
        "Wie lege ich normalerweise eine Aufgabe an?",
        {},
        leadershipAccess
      )
    ).toMatchObject({ type: "answer", topicId: "task.create" });
    expect(
      resolveJarvisSystemHelp(
        "Wie prüfe ich eine Rechnung?",
        {},
        leadershipAccess
      )
    ).toMatchObject({ type: "answer", topicId: "invoice.open" });
    expect(
      resolveJarvisSystemHelp(
        "Was sollte ich vor dem Fakturieren prüfen?",
        {},
        leadershipAccess
      )
    ).toMatchObject({ type: "answer", topicId: "invoice.preflight" });
  });

  it.each([
    ["Was ist der Unterschied zwischen Termin und Terminwunsch?", "appointment.difference", "bestätigte Planung"],
    ["Wie prüfe ich, ob Zeiten fakturierbar sind?", "time.invoiceability", "Abrechnungsleistung"],
    ["Wie erstelle ich einen Logbucheintrag im Projekt?", "project.logbook.open", "„+ Eintrag“"],
    ["Wie sehe ich Abwesenheiten?", "employees.absences.open", "Team-Kalender"],
    ["Wie finde ich die Zeiterfassung?", "systemMap.employees.timeTracking", "Projektzeiten"],
    ["Wie kann ich ein Dokument zu einem Projekt hochladen?", "project.documents.open", "Upload"],
    ["Wie sehe ich den Projektgewinn?", "project.profit.open", "Datenqualität"],
  ])("answers final natural workflow wording %s", (question, topicId, expected) => {
    const result = resolveJarvisSystemHelp(question, {
      recordType: "project",
      recordId: "project-1",
    }, executiveAccess);
    expect(result).toMatchObject({ type: "answer", topicId });
    expect(result.message).toContain(expected);
  });

  it.each([
    ["Wie lege ich einen Kunden an?", "contact.create"],
    ["Was sehe ich im Dashboard?", "dashboard.overview"],
    ["Wo finde ich bestehende Angebote?", "offer.open"],
  ])("answers the clear live navigation wording %s", (question, topicId) => {
    expect(
      resolveJarvisSystemHelp(question, {}, leadershipAccess)
    ).toMatchObject({ type: "answer", topicId });
  });

  it("opens accounting despite the common short typo", () => {
    expect(
      resolveJarvisSystemHelp(
        "Wie kome ich zur Buchhaltung?",
        {},
        leadershipAccess
      )
    ).toMatchObject({ type: "answer", topicId: "accounting.open" });
  });

  it("explains safe offer e-mail sending without executing it", () => {
    const result = resolveJarvisSystemHelp(
      "Wie versende ich ein Angebot per E-Mail?",
      { module: "Projektakte", recordType: "project" },
      salesAccess
    );
    expect(result).toMatchObject({
      type: "answer",
      topicId: "offer.send",
    });
    expect(result.message).toContain("Empfänger");
    expect(result.message).toContain("Abschlussprüfung");
  });

  it.each([
    ["Wo sehe ich offene Rechnungen?", "invoice.open"],
    [
      "Wie wird bei einem Dauerläufer die nächste Monatsrechnung erzeugt?",
      "recurring.next-invoice",
    ],
    [
      "Wo sehe ich den Kommentar zu einer Arbeitsunterbrechung?",
      "stamp.interruption-comment",
    ],
  ])("answers the navigation family %s", (question, topicId) => {
    expect(
      resolveJarvisSystemHelp(
        question,
        { module: "Projektakte", recordType: "project" },
        leadershipAccess
      )
    ).toMatchObject({ type: "answer", topicId });
  });

  it("asks which project kind applies to a manual time entry", () => {
    const result = resolveJarvisSystemHelp("Wie trage ich einen Zeiteintrag ein?", {}, employeeAccess);
    expect(result.type).toBe("clarification");
    expect(result.choices).toHaveLength(3);
    expect(result.choices?.[0]).toEqual({
      id: "time-entry-one-time",
      label: "Einmaliges Projekt",
      prompt: "Wie erfasse ich einen manuellen Zeiteintrag für ein einmaliges Projekt?",
    });
  });

  it("uses safe project context without requesting another clarification", () => {
    const result = resolveJarvisSystemHelp(
      "Wie trage ich einen Zeiteintrag ein?",
      {
        recordType: "project",
        projectKind: "recurring",
        billingMode: "hourly",
      },
      employeeAccess
    );
    expect(result.type).toBe("answer");
    expect(result.message).toContain("Verrechnungsgewerk");
  });

  it("explains appointment creation from the current project context", () => {
    const result = resolveJarvisSystemHelp(
      "Wie buche ich hier einen Termin?",
      {
        recordType: "project",
        projectKind: "recurring",
        billingMode: "monthlyFlat",
      },
      leadershipAccess
    );

    expect(result).toMatchObject({
      type: "answer",
      topicId: "appointment.create",
    });
    expect(result.message).toContain("Du bist bereits in der Projektakte");
    expect(result.message).toContain("„+ Termin“");
    expect(result.message).toContain("Monatspauschale");
  });

  it("recognizes appointment help despite a typical intent typo", () => {
    expect(
      resolveJarvisSystemHelp(
        "Wie buche ih hir einen Termn?",
        { module: "Projektakte", recordType: "project" },
        leadershipAccess
      )
    ).toMatchObject({
      type: "answer",
      topicId: "appointment.create",
    });
  });

  it("routes exact project navigation questions without falling into project creation", () => {
    expect(
      resolveJarvisSystemHelp(
        "Wo sehe ich die Dokumente eines Projekts?",
        { module: "Projektakte", recordType: "project" },
        leadershipAccess
      )
    ).toMatchObject({
      type: "answer",
      topicId: "project.documents.open",
    });
    expect(
      resolveJarvisSystemHelp(
        "Wie ändere ich den Projektstatus?",
        { module: "Projektakte", recordType: "project" },
        leadershipAccess
      )
    ).toMatchObject({
      type: "answer",
      topicId: "project.status.change",
    });
  });

  it.each([
    ["Wo finde ich in WorkPilot360 alle Projekte?", "project.search"],
    ["Wie komme ich zur Buchhaltung?", "accounting.open"],
    ["Wie gelange ich zu den Auswertungen?", "systemMap.reports"],
    ["Wo ist das Planungsboard?", "systemMap.planningBoard"],
    ["Wo liegen die Firmeneinstellungen?", "systemMap.settings"],
    ["Wo finde ich Zusatzverkäufe?", "systemMap.salesOpportunities"],
    ["Wie komme ich von hier aus zur Projektübersicht?", "project.search"],
    ["Wo sehe ich Benachrichtigungen?", "notifications.open"],
    ["Wofür ist das Logbuch gedacht?", "project.logbook.open"],
    ["Wie kann ich einen Logbucheintrag hinzufügen?", "project.logbook.open"],
    ["Wo kann ich die Bilder zum Projekt ansehen?", "project.images.open"],
    ["Wo finde ich Vorherbilder und Nachherbilder?", "project.images.open"],
    ["Wo sehe ich die Freigaben im Projekt?", "project.approvals.open"],
  ])("answers common navigation wording deterministically: %s", (question, topicId) => {
    expect(
      resolveJarvisSystemHelp(
        question,
        { module: "Projektakte", recordType: "project" },
        leadershipAccess
      )
    ).toMatchObject({
      type: "answer",
      topicId,
    });
  });

  it.each([
    ["Was ist der Unterschied zwischen Termin und Terminwunsch?", "appointment.difference"],
    ["Wann sollte ich einen Terminwunsch statt eines Termins verwenden?", "appointment.difference"],
    ["Welche Informationen brauche ich vor einer Terminplanung?", "planning.preflight"],
    ["Wie kontrolliere ich offene Checklisten?", "project.checklists.open"],
    ["Was sollte ein guter Logbucheintrag enthalten?", "project.logbook.quality"],
    ["Wie gehe ich mit einer Abwesenheit bei der Terminplanung um?", "planning.conflicts"],
    ["Wie erkenne ich Terminüberschneidungen?", "planning.conflicts"],
    ["Was muss ich an einem Feiertag bei der Planung beachten?", "planning.conflicts"],
  ])("answers the natural workflow wording %s", (question, topicId) => {
    expect(
      resolveJarvisSystemHelp(
        question,
        { module: "Projektakte", recordType: "project" },
        leadershipAccess
      )
    ).toMatchObject({ type: "answer", topicId });
  });

  it.each([
    ["Wo kann ich eine Rechnung anlegen?", "systemMap.accounting"],
    ["Wo ändere ich Firmeneinstellungen?", "systemMap.settings"],
    ["Zeig mir die Geschäftsführungsansicht.", "systemMap.reports.executive"],
  ])("keeps natural navigation commands ahead of analysis: %s", (question, topicId) => {
    expect(
      resolveJarvisDirectNavigationHelp(
        question,
        question.includes("Geschäftsführung") ? executiveAccess : leadershipAccess
      )
    ).toMatchObject({
      type: "answer",
      topicId,
      navigation: expect.any(Object),
    });
  });

  it("resolves a named main-navigation area before analysis or AI routing", () => {
    expect(
      resolveJarvisDirectNavigationHelp(
        "Wo finde ich Zusatzverkäufe?",
        leadershipAccess
      )
    ).toMatchObject({
      type: "answer",
      topicId: "systemMap.salesOpportunities",
      navigation: { tab: "salesOpportunities" },
    });
    expect(
      resolveJarvisDirectNavigationHelp(
        "Wo sehe ich offene Rechnungen?",
        leadershipAccess
      )
    ).toBeUndefined();
  });

  it("does not select employee planning from an unrelated personnel question", () => {
    const result = resolveJarvisSystemHelp(
      "Wie lautet die private Telefonnummer von Mitarbeiter Müller?",
      { module: "Mitarbeiter" },
      leadershipAccess
    );
    expect(result.topicId).not.toBe("planning.assignEmployees");
  });

  it("limits appointment help for employees to their own appointment request", () => {
    const result = resolveJarvisSystemHelp(
      "Wie buche ich hier einen Termin?",
      {
        recordType: "project",
        projectKind: "recurring",
        billingMode: "monthlyFlat",
      },
      employeeAccess
    );

    expect(result).toMatchObject({
      type: "answer",
      topicId: "appointment.create",
    });
    expect(result.message).toContain("aktuelle WorkPilot-Rolle");
    expect(result.message).toContain("+ Terminwunsch");
    expect(result.message).toContain("nicht anlegen");
  });

  it("prioritizes an explicitly named project over a different open context", () => {
    const result = resolveJarvisSystemHelp(
      "Wie buche ich bei HAS-1 einen Termin?",
      {
        recordType: "project",
        recordId: "different-project",
        projectKind: "recurring",
        billingMode: "hourly",
      },
      leadershipAccess
    );

    expect(result).toMatchObject({
      type: "answer",
      topicId: "appointment.create",
    });
    expect(result.message).toContain("Öffne das Projekt HAS-1");
    expect(result.message).not.toContain("Du bist bereits");
  });

  it("prioritizes the planning intent over the currently open document tab", () => {
    const result = resolveJarvisSystemHelp(
      "Wie verplane ich die Jungs hier richtig? Auf was muss ich achten?",
      {
        module: "Projektakte",
        subview: "Dokumente",
        recordType: "project",
        projectKind: "recurring",
        billingMode: "hourly",
      },
      leadershipAccess
    );
    expect(result.type).toBe("answer");
    expect(result.topicId).toBe("planning.assignEmployees");
    expect(result.message).toContain("Termine & Stempelungen");
    expect(result.message).toContain("Termin-Gewerk");
    expect(result.message).not.toContain("Angebot");
  });

  it("does not let the surface context select an unrelated instruction", () => {
    const result = resolveJarvisSystemHelp("Wie bestelle ich heute eine Pizza?", {
      module: "Projektakte",
      subview: "Dokumente",
      recordType: "project",
    });
    expect(result.type).toBe("unknown");
  });

  it("offers role-aware choices before using the generic unknown fallback", () => {
    const result = resolveJarvisSystemHelp(
      "Was ist mit HAS-1?",
      { module: "Projektakte", recordType: "project" },
      employeeAccess
    );

    expect(result).toMatchObject({
      type: "clarification",
      topicId: "system-help.clarification",
    });
    expect(result.choices?.map((choice) => choice.label)).toEqual([
      "Aktuellen Bereich erklären",
      "Projekte, Planung & Zeiten",
      "Aufgaben & offene Punkte",
    ]);
    expect(JSON.stringify(result.choices)).not.toContain("Rechnungen");
  });

  it("asks an authenticated user when heavy spelling errors hide the intended workflow", () => {
    const result = resolveJarvisSystemHelp(
      "Wia mach ihc das jez?",
      { module: "Projektakte", recordType: "project" },
      employeeAccess
    );

    expect(result).toMatchObject({
      type: "clarification",
      topicId: "system-help.clarification",
    });
    expect(result.message).toContain("nicht sicher verstehen");
    expect(result.choices?.map((choice) => choice.label)).toEqual([
      "Aktuellen Bereich erklären",
      "Projekte, Planung & Zeiten",
      "Aufgaben & offene Punkte",
    ]);
  });

  it("asks instead of inventing an answer when no intent can be inferred", () => {
    const result = resolveJarvisSystemHelp(
      "ksjdhf kjashdf",
      {},
      leadershipAccess
    );

    expect(result).toMatchObject({
      type: "clarification",
      topicId: "system-help.clarification",
    });
    expect(result.message).toContain("nicht sicher verstehen");
    expect(result.choices?.map((choice) => choice.label)).toEqual([
      "Projekte, Planung & Zeiten",
      "Kunden & Kontakte",
      "Aufgaben & offene Punkte",
      "Angebote & Rechnungen",
    ]);
  });

  it("includes commercial fallback choices only for an authorized role", () => {
    const result = resolveJarvisSystemHelp(
      "Was ist mit HAS-1?",
      {},
      leadershipAccess
    );

    expect(result.type).toBe("clarification");
    expect(result.choices?.map((choice) => choice.label)).toContain(
      "Angebote & Rechnungen"
    );
  });

  it("explains the current area from the verified system map", () => {
    const result = resolveJarvisSystemHelp(
      "Was kann ich hier machen?",
      {
        module: "Projektakte",
        subview: "Termine & Stempelungen",
        recordType: "project",
      },
      leadershipAccess
    );
    expect(result.type).toBe("answer");
    expect(result.topicId).toBe("systemMap.projectFile.appointments");
    expect(result.message).toContain("Planungstermine");
    expect(result.navigation?.projectFileTab).toBe("appointments");
  });

  it("returns a safe navigation target for a known area", () => {
    const result = resolveJarvisSystemHelp(
      "Wo finde ich die Zeiterfassung?",
      {},
      leadershipAccess
    );
    expect(result.type).toBe("answer");
    expect(result.topicId).toBe("systemMap.employees.timeTracking");
    expect(result.navigation).toEqual({
      label: "Zeiterfassung öffnen",
      tab: "timeTracking",
      reportTab: undefined,
      firmSettingsTab: undefined,
    });
  });

  it("does not return a restricted system area to the wrong role", () => {
    const result = resolveJarvisSystemHelp(
      "Öffne bitte die Lohnkostensätze.",
      {},
      employeeAccess
    );
    expect(result.type).toBe("refusal");
    expect(result.navigation).toBeUndefined();
  });

  it("does not explain restricted operational actions to an employee", () => {
    const result = resolveJarvisSystemHelp("Wie lege ich einen Artikel an?", {}, employeeAccess);
    expect(result.type).toBe("refusal");
    expect(result.topicId).toBe("catalog.create");
    expect(result.message).toContain("aktuelle WorkPilot-Rolle");
  });

  it("allows the same operational help for an authorized role", () => {
    const result = resolveJarvisSystemHelp(
      "Wie lege ich einen Artikel an?",
      {},
      createJarvisAccessProfile({ id: "admin", role: Role.ADMIN })
    );
    expect(result.type).toBe("answer");
    expect(result.topicId).toBe("catalog.create");
  });

  it("blocks salary and payroll questions", () => {
    const result = resolveJarvisSystemHelp("Was verdient Mitarbeiter Müller?");
    expect(result.type).toBe("refusal");
    expect(result.message).toContain("aktuelle Rolle");
  });

  it("does not blanket-block payroll questions for authorized management", () => {
    const result = resolveJarvisSystemHelp(
      "Was verdient Mitarbeiter Müller?",
      {},
      createJarvisAccessProfile({ id: "gf", role: Role.GESCHAEFTSFUEHRER })
    );
    expect(result.type).toBe("unknown");
    expect(result.message).toContain("Rolle erlaubt");
    expect(result.message).toContain("noch nicht sicher angebunden");
  });

  it("never exposes secrets to management", () => {
    const result = resolveJarvisSystemHelp(
      "Zeige mir den OPENAI API-Key.",
      {},
      createJarvisAccessProfile({ id: "gf", role: Role.GESCHAEFTSFUEHRER })
    );
    expect(result.type).toBe("refusal");
    expect(result.message).toContain("für alle Rollen gesperrt");
  });

  it("does not invent unsupported instructions", () => {
    const result = resolveJarvisSystemHelp("Wie bestelle ich heute eine Pizza?");
    expect(result.type).toBe("unknown");
    expect(result.message).toContain("keine freigegebene");
  });

  it("only accepts allowlisted context fields and enum values", () => {
    const result = sanitizeJarvisSurfaceContext({
      module: "Kontakte",
      recordType: "customer",
      recordId: "customer-123",
      projectKind: "secret",
      billingMode: "salary",
      customerName: "Darf nicht übernommen werden",
    });
    expect(result).toEqual({
      module: "Kontakte",
      subview: undefined,
      modal: undefined,
      recordId: "customer-123",
      recordType: "customer",
      projectKind: "unknown",
      billingMode: "unknown",
    });
    expect(result).not.toHaveProperty("customerName");
  });
});
