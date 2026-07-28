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

  it("answers a supported offer workflow", () => {
    const result = resolveJarvisSystemHelp("Wie lege ich ein Angebot an?", {}, salesAccess);
    expect(result.type).toBe("answer");
    expect(result.topicId).toBe("offer.create");
    expect(result.message).toContain("„+ Angebot“");
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

  it("does not select employee planning from an unrelated personnel question", () => {
    const result = resolveJarvisSystemHelp(
      "Wie lautet die private Telefonnummer von Mitarbeiter Müller?",
      { module: "Mitarbeiter" },
      leadershipAccess
    );
    expect(result.topicId).not.toBe("planning.assignEmployees");
  });

  it("does not explain appointment management to a role without planning permission", () => {
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
      type: "refusal",
      topicId: "appointment.create",
    });
    expect(result.message).toContain("aktuelle WorkPilot-Rolle");
    expect(result.message).not.toContain("+ Termin");
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
