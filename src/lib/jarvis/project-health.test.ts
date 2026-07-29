import { describe, expect, it } from "vitest";
import {
  evaluateProjectHealth,
  resolveJarvisProjectHealthIntent,
  type ProjectHealthSnapshot,
} from "@/lib/jarvis/project-health";

function healthySnapshot(
  overrides: Partial<ProjectHealthSnapshot> = {}
): ProjectHealthSnapshot {
  return {
    project: {
      id: "project-1",
      projectNumber: "MKG-209",
      title: "Marketing",
      customer: "Klaus Testmann",
      status: "Umsetzung",
      description: "Laufendes Projekt",
      contactId: "contact-1",
      contactPersonId: null,
      addressContactId: null,
      objectAddressId: "address-1",
      projectType: "Projekt OK solutions",
      projectKind: "einmaliges Projekt",
      projectRuntimeFrom: "2026-07",
      projectRuntimeUntil: "2026-08",
      billingInterval: null,
      recurringBillingMode: null,
      forecastBillingType: null,
      forecastNetAmount: null,
      trade: "Marketing",
      branch: "OK solutions",
      address: null,
      responsibleName: "Christian Eid",
      timeBudgetEnabled: false,
      timeBudgetHours: null,
      timeBudgetAllocations: [],
      autoBillingEnabled: false,
      autoBillingNetAmount: null,
      autoBillingStartMonth: null,
      autoBillingEndMonth: null,
      reviewStatus: "approved",
      reviewedAt: new Date("2026-07-27T08:00:00.000Z"),
      reviewedByName: "Christian Eid",
      reviewedProjectStatus: "Umsetzung",
      updatedAt: new Date("2026-07-27T08:00:00.000Z"),
    },
    stableCustomerReferenceValid: true,
    timeEntryCount: 1,
    manualOneTimeEntriesWithoutOffer: 0,
    timeEntriesWithoutCostSnapshot: 0,
    futurePlanningCount: 1,
    visibleOpenTaskCount: 0,
    visibleOverdueTaskCount: 0,
    offerCount: 1,
    invoiceCount: 0,
    draftInvoiceCount: 0,
    logbookEntryCount: 2,
    evaluationDateKey: "2026-07-27",
    checkedAreas: [
      "Stammdaten & Verantwortung",
      "Planung & Terminverknüpfungen",
      "Stempelungen, Zeitmathematik & Status",
    ],
    restrictedAreas: [],
    ...overrides,
  };
}

describe("resolveJarvisProjectHealthIntent", () => {
  it.each([
    "Prüfe dieses Projekt vollständig",
    "Mach einen Projekt-Gesundheitscheck",
    "Was fehlt bei diesem Projekt?",
    "Wie können wir dieses Projekt verbessern?",
    "Und jetzt prüfe HAS-1 vollständig",
    "Warum ist der nächste Monat bei HAS-1 noch nicht vollständig geplant?",
  ])("recognizes project health questions: %s", (question) => {
    expect(resolveJarvisProjectHealthIntent(question)).toBe(true);
  });

  it.each([
    "Warum fehlen Stunden auf der Rechnung?",
    "Was stimmt bei den Stempelungen nicht?",
    "Prüfe die Zeiteinträge auf Fehler.",
  ])("recognizes stamp diagnostics in a project context: %s", (question) => {
    expect(resolveJarvisProjectHealthIntent(question, {
      recordType: "project",
      recordId: "project-1",
    })).toBe(true);
  });

  it("recognizes a short explicit project switch", () => {
    expect(resolveJarvisProjectHealthIntent("Und HAS-1?")).toBe(true);
  });

  it("recognizes a follow-up from the stable conversation project", () => {
    expect(resolveJarvisProjectHealthIntent(
      "Und wie sieht die Planung aus?",
      { recordType: "project", recordId: "screen-project" },
      { recordType: "project", recordId: "conversation-project" }
    )).toBe(true);
  });

  it("recognizes a short referential diagnostic in project context", () => {
    expect(
      resolveJarvisProjectHealthIntent(
        "Prüf das mal.",
        { recordType: "project", recordId: "screen-project" },
        { recordType: "project", recordId: "conversation-project" }
      )
    ).toBe(true);
  });

  it.each([
    "Wie lege ich ein Projekt an?",
    "Was weißt du über Klaus Testmann?",
    "Welche Kunden sollte ich nachfassen?",
  ])("does not catch unrelated questions: %s", (question) => {
    expect(resolveJarvisProjectHealthIntent(question)).toBe(false);
  });
});

describe("evaluateProjectHealth", () => {
  it("returns a healthy deterministic result for a coherent one-time project", () => {
    const result = evaluateProjectHealth(healthySnapshot());

    expect(result).toMatchObject({
      score: 100,
      status: "healthy",
      issues: [],
    });
    expect(result.automationSummary.join(" ")).toContain("Angebotszuweisung");
  });

  it("does not call an unreviewed migration project fully healthy", () => {
    const base = healthySnapshot();
    const result = evaluateProjectHealth(healthySnapshot({
      project: {
        ...base.project,
        reviewStatus: "unreviewed",
        reviewedAt: null,
        reviewedByName: null,
        reviewedProjectStatus: null,
      },
    }));

    expect(result.score).toBeLessThan(100);
    expect(result.status).toBe("attention");
    expect(result.issues.map((issue) => issue.id)).toContain("project-review-pending");
  });

  it("finds the configuration blockers of an hourly recurring project", () => {
    const base = healthySnapshot();
    const result = evaluateProjectHealth(healthySnapshot({
      project: {
        ...base.project,
        projectKind: "Dauerläufer-Projekt",
        recurringBillingMode: "hourly",
        projectRuntimeFrom: null,
        projectRuntimeUntil: null,
      },
    }));

    expect(result.status).toBe("attention");
    expect(result.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "recurring-runtime-missing",
      ])
    );
    expect(result.automationSummary.join(" ")).toContain(
      "genau einen Rechnungsentwurf"
    );
  });

  it("keeps hourly recurring and monthly-flat automation strictly separated", () => {
    const base = healthySnapshot();
    const result = evaluateProjectHealth(healthySnapshot({
      project: {
        ...base.project,
        projectKind: "Dauerläufer-Projekt",
        recurringBillingMode: "hourly",
        projectRuntimeFrom: "2026-05-01",
        projectRuntimeUntil: "2026-12-31",
        billingInterval: "monatlich",
        autoBillingEnabled: true,
      },
    }));

    expect(result.issues.map((issue) => issue.id)).toContain(
      "hourly-flat-auto-billing-conflict"
    );
    expect(result.automationSummary.join(" ")).toContain(
      "tatsächlich zugeordneten und geprüften Stunden"
    );
    expect(result.automationSummary.join(" ")).not.toContain(
      "vereinbarte Monatspauschale"
    );
  });

  it("recognizes contradictory legacy settings on a one-time project", () => {
    const base = healthySnapshot();
    const result = evaluateProjectHealth(healthySnapshot({
      project: {
        ...base.project,
        recurringBillingMode: "monthlyFlat",
        autoBillingEnabled: true,
      },
    }));

    expect(result.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "one-time-recurring-mode-conflict",
        "one-time-flat-auto-billing-conflict",
      ])
    );
    expect(result.automationSummary.join(" ")).toContain(
      "Gesamtprojekt abgeschlossen"
    );
  });

  it("reports invalid stable links and missing project master data", () => {
    const base = healthySnapshot();
    const result = evaluateProjectHealth(healthySnapshot({
      project: {
        ...base.project,
        projectType: null,
        branch: null,
        projectKind: null,
        responsibleName: null,
        trade: null,
        objectAddressId: null,
        address: null,
      },
      stableCustomerReferenceValid: false,
    }));

    expect(result.status).toBe("critical");
    expect(result.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "customer-reference-invalid",
        "project-kind-missing",
        "project-company-type-missing",
        "responsible-missing",
        "trade-missing",
        "address-missing",
      ])
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.areaAssessments).toHaveLength(3);
    expect(
      result.areaAssessments.find(
        (assessment) => assessment.area === "Stammdaten & Verantwortung"
      )
    ).toMatchObject({
      status: "critical",
    });
  });

  it("uses zero points only when every released checked area is critical", () => {
    const base = healthySnapshot();
    const result = evaluateProjectHealth(healthySnapshot({
      project: {
        ...base.project,
        projectKind: null,
      },
      checkedAreas: ["Stammdaten & Verantwortung"],
    }));

    expect(result).toMatchObject({
      score: 0,
      status: "critical",
      areaAssessments: [{
        area: "Stammdaten & Verantwortung",
        status: "critical",
      }],
    });
  });

  it("checks status-dependent planning, invoicing and visible tasks", () => {
    const base = healthySnapshot();
    const planned = evaluateProjectHealth(healthySnapshot({
      project: { ...base.project, status: "Geplant" },
      futurePlanningCount: 0,
      visibleOverdueTaskCount: 2,
    }));
    expect(planned.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining(["planned-without-planning", "overdue-visible-tasks"])
    );

    const billing = evaluateProjectHealth(healthySnapshot({
      project: { ...base.project, status: "Abrechnungsprüfung" },
      invoiceCount: 0,
      draftInvoiceCount: 0,
    }));
    expect(billing.issues.map((issue) => issue.id)).toContain(
      "billing-check-without-draft"
    );
  });

  it("flags an active recurring project without any future planning", () => {
    const base = healthySnapshot();
    const result = evaluateProjectHealth(healthySnapshot({
      project: {
        ...base.project,
        projectKind: "Dauerläufer-Projekt",
        recurringBillingMode: "monthlyFlat",
        projectRuntimeFrom: "2026-05-11",
        projectRuntimeUntil: "2026-12-31",
      },
      futurePlanningCount: 0,
    }));

    expect(result.issues.map((issue) => issue.id)).toContain(
      "recurring-without-future-planning"
    );
    const planningIssue = result.issues.find(
      (issue) => issue.id === "recurring-without-future-planning"
    );
    expect(planningIssue?.evidence).toContain(
      "wann die nächste vereinbarte Leistung ausgeführt wird"
    );
    expect(planningIssue?.recommendation).toContain(
      "„Termine & Stempelungen“"
    );
  });

  it("does not invent restricted cost findings when that metric was not loaded", () => {
    const result = evaluateProjectHealth(healthySnapshot({
      timeEntriesWithoutCostSnapshot: undefined,
    }));

    expect(result.issues.map((issue) => issue.id)).not.toContain(
      "cost-snapshot-missing"
    );
  });
});
