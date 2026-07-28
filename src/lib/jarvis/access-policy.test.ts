import { describe, expect, it } from "vitest";
import { resolveJarvisAccessPolicyQuestion } from "@/lib/jarvis/access-policy";

describe("JARVIS access policy answers", () => {
  it.each([
    [
      "Darf ein normaler Mitarbeiter Lohndaten sehen?",
      "keine Lohn-, Gehalts- oder internen Mitarbeiterkostendaten",
    ],
    [
      "Welche Kundendaten darf eine Führungskraft sehen?",
      "Kontakt- und Kundendaten",
    ],
    [
      "Kann ein Mitarbeiter Termine für andere anlegen?",
      "nicht für andere Personen verwalten",
    ],
    [
      "Welche private Telefonnummer hat Mitarbeiter Müller?",
      "gebe ich in JARVIS-Antworten nicht aus",
    ],
  ])("answers %s without reading a concrete record", (question, excerpt) => {
    expect(resolveJarvisAccessPolicyQuestion(question)).toMatchObject({
      type: "answer",
      topicId: "security.access-policy",
      message: expect.stringContaining(excerpt),
      deterministic: true,
    });
  });

  it("does not turn a concrete salary lookup into a generic policy answer", () => {
    expect(
      resolveJarvisAccessPolicyQuestion("Was verdient Mitarbeiter Müller?")
    ).toBeUndefined();
  });
});
