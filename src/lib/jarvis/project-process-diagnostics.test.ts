import { describe, expect, it } from "vitest";
import { diagnoseProjectProcess } from "@/lib/jarvis/project-process-diagnostics";

const baseProject = {
  projectNumber: "MKG-209",
  projectType: "Projekt OK solutions",
  projectKind: "einmaliges Projekt",
  recurringBillingMode: null,
  projectRuntimeFrom: null,
  projectRuntimeUntil: null,
  billingInterval: null,
  autoBillingEnabled: false,
  autoBillingStartMonth: null,
  autoBillingEndMonth: null,
  status: "Umsetzung",
};

describe("JARVIS project process diagnostics", () => {
  it("explains the mandatory offer basis in plain language", () => {
    const result = diagnoseProjectProcess({
      project: baseProject,
      evaluationDateKey: "2026-07-28",
      offers: [{ id: "draft", status: "Entwurf" }],
      invoices: [],
      logbookEntries: [],
      timeEntryDates: [],
    });

    expect(result.issues.map((issue) => issue.id)).toContain(
      "project-valid-offer-missing"
    );
    expect(result.issues[0]).toMatchObject({
      title: "Gültiges Angebot fehlt",
    });
    expect(result.issues[0].evidence).toContain(
      "welche Leistungen der Kunde beauftragt hat"
    );
    expect(result.issues[0].recommendation).toContain(
      "verpflichtende Grundbaustein jedes Projekts"
    );
  });

  it("requires a valid offer for recurring projects as well", () => {
    const result = diagnoseProjectProcess({
      project: {
        ...baseProject,
        projectKind: "Dauerläufer-Projekt",
        recurringBillingMode: "monthlyFlat",
        projectRuntimeFrom: "2026-05-01",
        projectRuntimeUntil: "2026-12-31",
      },
      evaluationDateKey: "2026-07-28",
      offers: [{ id: "draft", status: "Entwurf" }],
      invoices: [],
      logbookEntries: [],
      timeEntryDates: [],
    });

    expect(result.issues.map((issue) => issue.id)).toContain(
      "project-valid-offer-missing"
    );
  });

  it("already points out the mandatory offer during an early project phase", () => {
    const result = diagnoseProjectProcess({
      project: { ...baseProject, status: "Lead / Klärung" },
      evaluationDateKey: "2026-07-28",
      offers: [],
      invoices: [],
      logbookEntries: [],
      timeEntryDates: [],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "project-valid-offer-missing",
          severity: "warning",
        }),
      ])
    );
  });

  it("connects final invoice, closing status and final inspection", () => {
    const result = diagnoseProjectProcess({
      project: { ...baseProject, status: "Abrechnungsprüfung" },
      evaluationDateKey: "2026-07-28",
      offers: [{ id: "offer", status: "Versendet" }],
      invoices: [{
        id: "invoice",
        status: "Fakturiert",
        billingSource: "manual",
        plannedExecutionMonth: "2026-07",
        serviceDate: "2026-07-28",
        createdAt: new Date("2026-07-28T10:00:00.000Z"),
      }],
      logbookEntries: [],
      timeEntryDates: [],
    });

    expect(result.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "one-time-final-invoice-status-open",
        "process-final-inspection-missing",
      ])
    );
    const statusIssue = result.issues.find(
      (issue) => issue.id === "one-time-final-invoice-status-open"
    );
    expect(statusIssue?.evidence).toContain(
      "Rechnung wurde bereits fertiggestellt"
    );
    expect(statusIssue?.recommendation).toContain(
      "Endkontrolle"
    );
  });

  it("checks recurring immocare evidence month by month", () => {
    const result = diagnoseProjectProcess({
      project: {
        ...baseProject,
        projectNumber: "OKI-100",
        projectType: "Projekt OK immocare",
        projectKind: "Dauerläufer-Projekt",
        recurringBillingMode: "monthlyFlat",
        projectRuntimeFrom: "2026-05-01",
        projectRuntimeUntil: "2026-12-31",
      },
      evaluationDateKey: "2026-07-28",
      offers: [{ id: "offer", status: "Versendet" }],
      invoices: [{
        id: "invoice",
        status: "Fakturiert",
        billingSource: "batch",
        plannedExecutionMonth: "2026-06",
        serviceDate: "2026-06-30",
        createdAt: new Date("2026-06-30T10:00:00.000Z"),
      }],
      logbookEntries: [{
        title: "Dokumente: Endkontrolle",
        projectMonth: "2026-06",
        attachments: [{ type: "Dokument" }],
        createdAt: new Date("2026-06-30T09:00:00.000Z"),
      }],
      timeEntryDates: ["2026-06-10"],
    });

    expect(result.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "immocare-image-evidence-missing",
        "immocare-activity-report-missing",
      ])
    );
    expect(result.issues.map((issue) => issue.id)).not.toContain(
      "process-final-inspection-missing"
    );
  });

  it("rejects invoice automation from the wrong project type", () => {
    const result = diagnoseProjectProcess({
      project: {
        ...baseProject,
        projectKind: "Dauerläufer-Projekt",
        recurringBillingMode: "hourly",
        projectRuntimeFrom: "2026-05-01",
        projectRuntimeUntil: "2026-12-31",
      },
      evaluationDateKey: "2026-07-28",
      offers: [{ id: "offer", status: "Versendet" }],
      invoices: [{
        id: "invoice",
        status: "Entwurf",
        billingSource: "batch",
        plannedExecutionMonth: "2026-07",
        serviceDate: "2026-07-31",
        createdAt: new Date("2026-07-28T10:00:00.000Z"),
      }],
      logbookEntries: [],
      timeEntryDates: [],
    });

    expect(result.issues.map((issue) => issue.id)).toContain(
      "invoice-source-project-type-conflict"
    );
  });

  it("does not infer commercial findings when that role scope was not loaded", () => {
    const result = diagnoseProjectProcess({
      project: { ...baseProject, status: "Abgeschlossen" },
      evaluationDateKey: "2026-07-28",
      logbookEntries: [],
      timeEntryDates: [],
    });

    expect(result.issues.map((issue) => issue.id)).not.toContain(
      "one-time-closed-without-final-invoice"
    );
    expect(result.summary).toContain(
      "Angebote und Rechnungen waren für die aktuelle Rolle nicht prüfbar."
    );
  });
});
