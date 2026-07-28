import { describe, expect, it } from "vitest";
import { getJarvisProjectConsumptionGuidance } from "@/lib/jarvis/project-consumption-guidance";

describe("JARVIS project-specific material consumption guidance", () => {
  it.each([
    {
      projectKind: "Einmaliges Projekt",
      recurringBillingMode: null,
      label: "Einmaliges Projekt",
      expected: "Entnahmen, Rückgaben",
    },
    {
      projectKind: "Dauerläufer-Projekt",
      recurringBillingMode: "monthlyFlat",
      label: "Dauerläufer mit Monatspauschale",
      expected: "Pauschalrechnung",
    },
    {
      projectKind: "Dauerläufer-Projekt",
      recurringBillingMode: "hourly",
      label: "Dauerläufer mit Stundenabrechnung",
      expected: "Einsatznachweis",
    },
  ])("explains $label without equating billing with physical usage", (input) => {
    const result = getJarvisProjectConsumptionGuidance(input);

    expect(result).toMatchObject({
      projectTypeLabel: input.label,
      projectTypeVerified: true,
    });
    expect(result.explanation).toContain(input.expected);
    expect(result.explanation).not.toContain("beweist den Verbrauch");
  });

  it("does not invent a process for an unclear recurring billing model", () => {
    const result = getJarvisProjectConsumptionGuidance({
      projectKind: "Dauerläufer-Projekt",
      recurringBillingMode: null,
    });

    expect(result.projectTypeVerified).toBe(false);
    expect(result.explanation).toContain("noch nicht eindeutig");
    expect(result.explanation).toContain("keinen projektartspezifischen Sollprozess");
  });
});
