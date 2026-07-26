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

  it("asks which project kind applies to a manual time entry", () => {
    const result = resolveJarvisSystemHelp("Wie trage ich einen Zeiteintrag ein?", {}, employeeAccess);
    expect(result.type).toBe("clarification");
    expect(result.choices).toHaveLength(3);
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
      projectKind: "secret",
      billingMode: "salary",
      customerName: "Darf nicht übernommen werden",
    });
    expect(result).toEqual({
      module: "Kontakte",
      subview: undefined,
      modal: undefined,
      recordType: "customer",
      projectKind: "unknown",
      billingMode: "unknown",
    });
    expect(result).not.toHaveProperty("customerName");
  });
});
