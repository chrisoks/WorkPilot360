import { describe, expect, it } from "vitest";
import {
  diagnoseJarvisProjectLogic,
  resolveJarvisProjectLogic,
  type JarvisProjectLogicInput,
} from "@/lib/jarvis/project-logic";

const base: JarvisProjectLogicInput = {
  projectKind: "einmaliges Projekt",
  recurringBillingMode: null,
  projectRuntimeFrom: "2026-07-01",
  projectRuntimeUntil: null,
  billingInterval: null,
  autoBillingEnabled: false,
  autoBillingStartMonth: null,
  autoBillingEndMonth: null,
};

describe("JARVIS project logic matrix", () => {
  it.each([
    ["einmaliges Projekt", null, "oneTime"],
    ["Einmalig", null, "oneTime"],
    ["Dauerläufer-Projekt", "monthlyFlat", "recurringMonthlyFlat"],
    ["Dauerl\u00c3\u00a4ufer-Projekt", "hourly", "recurringHourly"],
    ["Dauerläufer-Projekt", null, "recurringUnknown"],
    [null, "hourly", "unknown"],
  ])(
    "classifies %s / %s as %s",
    (projectKind, recurringBillingMode, expected) => {
      expect(
        resolveJarvisProjectLogic({ projectKind, recurringBillingMode }).variant
      ).toBe(expected);
    }
  );

  it("describes distinct end-to-end processes for all three valid variants", () => {
    const oneTime = diagnoseJarvisProjectLogic(base);
    const monthlyFlat = diagnoseJarvisProjectLogic({
      ...base,
      projectKind: "Dauerläufer-Projekt",
      recurringBillingMode: "monthlyFlat",
      projectRuntimeUntil: "2026-12-31",
      billingInterval: "monatlich",
    });
    const hourly = diagnoseJarvisProjectLogic({
      ...base,
      projectKind: "Dauerläufer-Projekt",
      recurringBillingMode: "hourly",
      projectRuntimeUntil: "2026-12-31",
      billingInterval: "monatlich",
    });

    expect(oneTime.profile.processSummary.join(" ")).toContain("Schlussrechnung");
    expect(monthlyFlat.profile.processSummary.join(" ")).toContain(
      "Vormonats"
    );
    expect(hourly.profile.processSummary.join(" ")).toContain(
      "genau einen Rechnungsentwurf"
    );
  });

  it("finds dangerous crossovers between project type and billing automation", () => {
    const oneTime = diagnoseJarvisProjectLogic({
      ...base,
      recurringBillingMode: "monthlyFlat",
      autoBillingEnabled: true,
    });
    const hourly = diagnoseJarvisProjectLogic({
      ...base,
      projectKind: "Dauerläufer-Projekt",
      recurringBillingMode: "hourly",
      projectRuntimeUntil: "2026-12-31",
      billingInterval: "monatlich",
      autoBillingEnabled: true,
    });

    expect(oneTime.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "one-time-recurring-mode-conflict",
        "one-time-flat-auto-billing-conflict",
      ])
    );
    expect(hourly.issues.map((issue) => issue.id)).toContain(
      "hourly-flat-auto-billing-conflict"
    );
  });

  it("checks recurring runtime, interval and automatic billing boundaries", () => {
    const result = diagnoseJarvisProjectLogic({
      ...base,
      projectKind: "Dauerläufer-Projekt",
      recurringBillingMode: "monthlyFlat",
      projectRuntimeFrom: "2026-07-01",
      projectRuntimeUntil: "2026-05-31",
      billingInterval: null,
      autoBillingEnabled: true,
      autoBillingStartMonth: "2026-04",
      autoBillingEndMonth: "2026-08",
    });

    expect(result.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "recurring-runtime-reversed",
        "recurring-billing-interval-missing",
        "auto-billing-start-before-runtime",
        "auto-billing-end-after-runtime",
      ])
    );
  });
});
