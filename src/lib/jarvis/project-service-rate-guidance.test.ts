import { describe, expect, it } from "vitest";
import { getJarvisProjectServiceRateGuidance } from "@/lib/jarvis/project-service-rate-guidance";

describe("JARVIS project-specific service-rate guidance", () => {
  it("recognizes hourly recurring billing as a contractual hourly comparison", () => {
    expect(
      getJarvisProjectServiceRateGuidance({
        projectKind: "Dauerläufer-Projekt",
        recurringBillingMode: "hourly",
      })
    ).toMatchObject({
      projectTypeLabel: "Dauerläufer mit Stundenabrechnung",
      projectTypeConfigured: true,
      hasContractualHourlyBilling: true,
    });
  });

  it("does not present a monthly flat fee as a contractual hourly rate", () => {
    const result = getJarvisProjectServiceRateGuidance({
      projectKind: "Dauerläufer-Projekt",
      recurringBillingMode: "monthlyFlat",
    });

    expect(result.hasContractualHourlyBilling).toBe(false);
    expect(result.explanation).toContain("keinen vertraglich berechneten");
    expect(result.explanation).toContain("Wirtschaftlichkeitskennzahl");
  });

  it("limits one-time projects to explicit hourly invoice positions", () => {
    const result = getJarvisProjectServiceRateGuidance({
      projectKind: "Einmaliges Projekt",
      recurringBillingMode: null,
    });

    expect(result.hasContractualHourlyBilling).toBe(true);
    expect(result.explanation).toContain("ausdrücklich als Stundenleistung");
    expect(result.explanation).toContain("Pauschale");
  });

  it("withholds confirmation for an unclear project type", () => {
    const result = getJarvisProjectServiceRateGuidance({
      projectKind: null,
      recurringBillingMode: null,
    });

    expect(result).toMatchObject({
      projectTypeConfigured: false,
      hasContractualHourlyBilling: false,
    });
    expect(result.explanation).toContain("keinen projektartgerechten");
  });
});
