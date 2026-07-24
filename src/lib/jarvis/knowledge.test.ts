import { describe, expect, it } from "vitest";
import {
  resolveJarvisSystemHelp,
  sanitizeJarvisSurfaceContext,
} from "@/lib/jarvis/knowledge";

describe("JARVIS system help", () => {
  it("answers a supported offer workflow", () => {
    const result = resolveJarvisSystemHelp("Wie lege ich ein Angebot an?");
    expect(result.type).toBe("answer");
    expect(result.topicId).toBe("offer.create");
    expect(result.message).toContain("„+ Angebot“");
  });

  it("asks which project kind applies to a manual time entry", () => {
    const result = resolveJarvisSystemHelp("Wie trage ich einen Zeiteintrag ein?");
    expect(result.type).toBe("clarification");
    expect(result.choices).toHaveLength(3);
  });

  it("uses safe project context without requesting another clarification", () => {
    const result = resolveJarvisSystemHelp("Wie trage ich einen Zeiteintrag ein?", {
      recordType: "project",
      projectKind: "recurring",
      billingMode: "hourly",
    });
    expect(result.type).toBe("answer");
    expect(result.message).toContain("Verrechnungsgewerk");
  });

  it("blocks salary and payroll questions", () => {
    const result = resolveJarvisSystemHelp("Was verdient Mitarbeiter Müller?");
    expect(result.type).toBe("refusal");
    expect(result.message).toContain("gesperrt");
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
