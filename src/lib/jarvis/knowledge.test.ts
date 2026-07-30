import { describe, expect, it } from "vitest";
import {
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

  it.each([
    "Was sind deine Unternehmensprinzipien?",
  ])("recognizes principle wording from natural conversations: %s", (question) => {
    expect(resolveJarvisSystemHelp(question, {}, employeeAccess)).toMatchObject({
      type: "answer",
      topicId: "jarvis.principles",
    });
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
