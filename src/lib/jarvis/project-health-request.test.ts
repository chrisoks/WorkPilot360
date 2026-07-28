import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";

const dbMocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  projectTimeEntryFindMany: vi.fn(),
  activeStampSessionFindMany: vi.fn(),
  planningEntryCount: vi.fn(),
  planningEntryFindMany: vi.fn(),
  projectLogbookEntryCount: vi.fn(),
  projectLogbookEntryFindMany: vi.fn(),
  offerFindMany: vi.fn(),
  invoiceFindMany: vi.fn(),
  invoiceLineFindMany: vi.fn(),
  invoiceLineLaborFindMany: vi.fn(),
  catalogInventoryMovementFindMany: vi.fn(),
  catalogItemFindMany: vi.fn(),
  taskFindMany: vi.fn(),
  contactCount: vi.fn(),
  getDeadlineSettings: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    $queryRaw: dbMocks.queryRaw,
    projectTimeEntry: { findMany: dbMocks.projectTimeEntryFindMany },
    activeStampSession: { findMany: dbMocks.activeStampSessionFindMany },
    planningEntry: {
      count: dbMocks.planningEntryCount,
      findMany: dbMocks.planningEntryFindMany,
    },
    projectLogbookEntry: {
      count: dbMocks.projectLogbookEntryCount,
      findMany: dbMocks.projectLogbookEntryFindMany,
    },
    offer: { findMany: dbMocks.offerFindMany },
    invoice: { findMany: dbMocks.invoiceFindMany },
    invoiceLine: { findMany: dbMocks.invoiceLineFindMany },
    invoiceLineLabor: { findMany: dbMocks.invoiceLineLaborFindMany },
    catalogInventoryMovement: {
      findMany: dbMocks.catalogInventoryMovementFindMany,
    },
    catalogItem: { findMany: dbMocks.catalogItemFindMany },
    task: { findMany: dbMocks.taskFindMany },
    contact: { count: dbMocks.contactCount },
  },
}));

vi.mock("@/lib/company-settings/deadlines", () => ({
  getDeadlineSettings: dbMocks.getDeadlineSettings,
}));

import { resolveJarvisProjectHealthRequest } from "@/lib/jarvis/project-health";

const project = {
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
};

describe("resolveJarvisProjectHealthRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.queryRaw.mockResolvedValue([project]);
    dbMocks.projectTimeEntryFindMany.mockResolvedValue([]);
    dbMocks.activeStampSessionFindMany.mockResolvedValue([]);
    dbMocks.planningEntryCount.mockResolvedValue(0);
    dbMocks.planningEntryFindMany.mockResolvedValue([]);
    dbMocks.projectLogbookEntryCount.mockResolvedValue(3);
    dbMocks.projectLogbookEntryFindMany.mockResolvedValue([]);
    dbMocks.offerFindMany.mockResolvedValue([
      { id: "offer-1", projectId: "project-1", status: "Gewonnen" },
    ]);
    dbMocks.invoiceFindMany.mockResolvedValue([]);
    dbMocks.invoiceLineFindMany.mockResolvedValue([]);
    dbMocks.invoiceLineLaborFindMany.mockResolvedValue([]);
    dbMocks.catalogInventoryMovementFindMany.mockResolvedValue([]);
    dbMocks.catalogItemFindMany.mockResolvedValue([]);
    dbMocks.taskFindMany.mockResolvedValue([]);
    dbMocks.contactCount.mockResolvedValue(1);
    dbMocks.getDeadlineSettings.mockResolvedValue({
      hourlyBillingRoundingFactorHours: 0.5,
    });
  });

  it("builds a structured, read-only health report for management", async () => {
    const response = await resolveJarvisProjectHealthRequest({
      question: "Führe den vollständigen Projekt-Gesundheitscheck aus.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager-1",
        role: Role.GESCHAEFTSFUEHRER,
      }),
      context: { recordType: "project", recordId: "project-1" },
    });

    expect(response).toMatchObject({
      type: "answer",
      topicId: "project.health",
      structured: {
        title: "Vollständiger Projektcheck · MKG-209",
        facts: [
          { label: "Prüfwert", value: "100 / 100", tone: "positive" },
          { label: "Einordnung", value: "Stabil", tone: "positive" },
          { label: "Datenbasis", value: "Fachlich freigegeben", tone: "positive" },
          { label: "Prüfumfang", value: "8 / 8 Bereiche" },
          { label: "Stempelungen", value: "0 · 0 Std." },
        ],
      },
      records: [{
        kind: "project",
        target: { kind: "project", id: "project-1" },
      }],
      deterministic: true,
    });
    expect(dbMocks.offerFindMany).toHaveBeenCalled();
    expect(dbMocks.invoiceFindMany).toHaveBeenCalled();
  });

  it("does not load or expose financial and payroll checks for employees", async () => {
    const response = await resolveJarvisProjectHealthRequest({
      question: "Führe den vollständigen Projekt-Gesundheitscheck aus.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "employee-1",
        role: Role.MITARBEITER,
      }),
      context: { recordType: "project", recordId: "project-1" },
    });

    expect(response?.topicId).toBe("project.health");
    expect(dbMocks.offerFindMany).not.toHaveBeenCalled();
    expect(dbMocks.invoiceFindMany).not.toHaveBeenCalled();
    expect(response?.structured?.sections?.at(-1)).toMatchObject({
      title: "Rollenbedingter Prüfumfang",
    });
    expect(JSON.stringify(response)).not.toContain("Kostensatz-Snapshot");
    expect(dbMocks.projectTimeEntryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ userId: "employee-1" }]),
        }),
      })
    );
    expect(dbMocks.activeStampSessionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ userId: "employee-1" }]),
        }),
      })
    );
  });

  it("asks what to inspect for a broad project reference and offers role-aware choices", async () => {
    dbMocks.queryRaw.mockResolvedValueOnce([{
      ...project,
      id: "project-has-1",
      projectNumber: "HAS-1",
      title: "Hausmeisterservice",
    }]);

    const response = await resolveJarvisProjectHealthRequest({
      question: "Und HAS-1?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "employee-1",
        role: Role.MITARBEITER,
      }),
      context: { recordType: "project", recordId: "project-dar-399" },
      conversationContext: {
        recordType: "project",
        recordId: "older-conversation-project",
      },
    });

    expect(response).toMatchObject({
      type: "clarification",
      topicId: "project.health.clarification",
      message: "Ich habe HAS-1 eindeutig gefunden. Was möchtest du zu diesem Projekt wissen oder prüfen?",
      records: [{
        target: { kind: "project", id: "project-has-1" },
      }],
    });
    expect(response?.choices?.map((choice) => choice.label)).toEqual([
      "Projektart & Abrechnung",
      "Vollständiger Projektcheck",
      "Stempelungen & Arbeitszeiten",
      "Planung & Termine",
      "Aufgaben & offene Punkte",
      "Automatik & Zusammenhänge",
      "Auffälligkeiten & Verbesserungen",
    ]);
    expect(JSON.stringify(response?.choices)).not.toContain("Rechnungen");
    expect(dbMocks.projectTimeEntryFindMany).not.toHaveBeenCalled();
  });

  it("runs the full check immediately when the open project is explicitly requested completely", async () => {
    const response = await resolveJarvisProjectHealthRequest({
      question: "Prüfe dieses Projekt vollständig.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager-1",
        role: Role.GESCHAEFTSFUEHRER,
      }),
      context: { recordType: "project", recordId: "project-1" },
    });

    expect(response).toMatchObject({
      type: "answer",
      topicId: "project.health",
      structured: {
        title: "Vollständiger Projektcheck · MKG-209",
      },
    });
    expect(dbMocks.projectTimeEntryFindMany).toHaveBeenCalled();
  });

  it("answers a clear project-type question directly without running a health check", async () => {
    dbMocks.queryRaw.mockResolvedValueOnce([{
      ...project,
      id: "project-has-1",
      projectNumber: "HAS-1",
      title: "Hausmeisterservice",
      projectKind: "Dauerläufer-Projekt",
      recurringBillingMode: "monthlyFlat",
      projectRuntimeFrom: "2026-05-01",
      projectRuntimeUntil: "2026-12-31",
      billingInterval: "monatlich",
    }]);

    const response = await resolveJarvisProjectHealthRequest({
      question: "Was ist HAS-1 für ein Projekt?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "employee-1",
        role: Role.MITARBEITER,
      }),
      context: { recordType: "project", recordId: "different-project" },
    });

    expect(response).toMatchObject({
      type: "answer",
      topicId: "project.logic.explanation",
      structured: {
        title: "Projektart · HAS-1",
        facts: [
          {
            label: "Projektart",
            value: "Dauerläufer mit Monatspauschale",
            tone: "positive",
          },
          { label: "Abrechnung", value: "Monatspauschale" },
          { label: "Bewertung", value: "Monatsbezogen" },
          { label: "Status", value: "Umsetzung" },
        ],
      },
      records: [{
        target: { kind: "project", id: "project-has-1" },
      }],
    });
    expect(JSON.stringify(response)).toContain("Vormonats");
    expect(dbMocks.projectTimeEntryFindMany).not.toHaveBeenCalled();
    expect(dbMocks.invoiceFindMany).not.toHaveBeenCalled();
  });

  it("answers the same clear project-type question despite a transposed word", async () => {
    dbMocks.queryRaw.mockResolvedValueOnce([{
      ...project,
      id: "project-has-1",
      projectNumber: "HAS-1",
      title: "Hausmeisterservice",
      projectKind: "Dauerläufer-Projekt",
      recurringBillingMode: "monthlyFlat",
      projectRuntimeFrom: "2026-05-01",
      projectRuntimeUntil: "2026-12-31",
      billingInterval: "monatlich",
    }]);

    const response = await resolveJarvisProjectHealthRequest({
      question: "Was ist HAS-1 für ein Proejkt?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "employee-1",
        role: Role.MITARBEITER,
      }),
    });

    expect(response).toMatchObject({
      type: "answer",
      topicId: "project.logic.explanation",
      structured: {
        title: "Projektart · HAS-1",
      },
    });
    expect(JSON.stringify(response)).toContain(
      "Dauerläufer mit Monatspauschale"
    );
    expect(dbMocks.projectTimeEntryFindMany).not.toHaveBeenCalled();
  });

  it("answers a colloquial project-type question instead of falling back to the current tab", async () => {
    dbMocks.queryRaw.mockResolvedValueOnce([{
      ...project,
      id: "project-has-1",
      projectNumber: "HAS-1",
      title: "Hausmeisterservice",
      projectKind: "Dauerläufer-Projekt",
      recurringBillingMode: "monthlyFlat",
      projectRuntimeFrom: "2026-05-01",
      projectRuntimeUntil: "2026-12-31",
      billingInterval: "monatlich",
    }]);

    const response = await resolveJarvisProjectHealthRequest({
      question: "Und was ist HAS-1 für en Projekt?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "employee-1",
        role: Role.MITARBEITER,
      }),
      context: { recordType: "project", recordId: "different-project" },
    });

    expect(response).toMatchObject({
      type: "answer",
      topicId: "project.logic.explanation",
      structured: {
        title: "Projektart · HAS-1",
      },
    });
    expect(JSON.stringify(response)).toContain(
      "Dauerläufer mit Monatspauschale"
    );
    expect(dbMocks.projectTimeEntryFindMany).not.toHaveBeenCalled();
    expect(dbMocks.invoiceFindMany).not.toHaveBeenCalled();
  });

  it("explains hourly billing directly and does not mistake it for a flat rate", async () => {
    dbMocks.queryRaw.mockResolvedValueOnce([{
      ...project,
      id: "project-hourly-1",
      projectNumber: "DL-42",
      title: "Regiearbeiten",
      projectKind: "Dauerläufer-Projekt",
      recurringBillingMode: "hourly",
      projectRuntimeFrom: "2026-01-01",
      projectRuntimeUntil: "2026-12-31",
      billingInterval: "monatlich",
    }]);

    const response = await resolveJarvisProjectHealthRequest({
      question: "Wie wird DL-42 abgerechnet?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager-1",
        role: Role.GESCHAEFTSFUEHRER,
      }),
    });

    expect(response).toMatchObject({
      type: "answer",
      topicId: "project.logic.explanation",
      structured: {
        title: "Abrechnung · DL-42",
      },
    });
    expect(JSON.stringify(response)).toContain("Stundenabrechnung");
    expect(JSON.stringify(response)).toContain("genau einen Rechnungsentwurf");
    expect(JSON.stringify(response)).not.toContain(
      "abgerechnet wird die vereinbarte Monatspauschale"
    );
    expect(dbMocks.projectTimeEntryFindMany).not.toHaveBeenCalled();
  });

  it("uses the stable conversation project for a clear process follow-up", async () => {
    dbMocks.queryRaw.mockResolvedValueOnce([{
      ...project,
      id: "project-conversation",
      projectNumber: "MKG-209",
    }]);

    const response = await resolveJarvisProjectHealthRequest({
      question: "Und welche Logik gilt dort?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager-1",
        role: Role.GESCHAEFTSFUEHRER,
      }),
      conversationContext: {
        recordType: "project",
        recordId: "project-conversation",
      },
      context: {
        recordType: "project",
        recordId: "project-screen",
      },
    });

    expect(response).toMatchObject({
      type: "answer",
      structured: {
        title: "Sollprozess · MKG-209",
      },
      records: [{
        target: { kind: "project", id: "project-conversation" },
      }],
    });
    expect(JSON.stringify(response)).toContain("Gesamtprojekt");
  });

  it("runs a named full project check directly for an authorized management role", async () => {
    dbMocks.queryRaw.mockResolvedValueOnce([{
      ...project,
      id: "project-has-1",
      projectNumber: "HAS-1",
    }]);

    const response = await resolveJarvisProjectHealthRequest({
      question: "Prüfe HAS-1 vollständig.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager-1",
        role: Role.GESCHAEFTSFUEHRER,
      }),
      context: { recordType: "project", recordId: "project-dar-399" },
    });

    expect(response?.type).toBe("answer");
    expect(response?.structured?.title).toBe(
      "Vollständiger Projektcheck · HAS-1"
    );
    expect(response?.records?.[0]?.target).toEqual({
      kind: "project",
      id: "project-has-1",
    });
    expect(dbMocks.offerFindMany).toHaveBeenCalled();
    expect(dbMocks.invoiceFindMany).toHaveBeenCalled();
  });

  it("continues with the selected project scope instead of asking again", async () => {
    const response = await resolveJarvisProjectHealthRequest({
      question: "Prüfe Planung und Termine für MKG-209.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager-1",
        role: Role.GESCHAEFTSFUEHRER,
      }),
      context: { recordType: "project", recordId: "different-project" },
    });

    expect(response).toMatchObject({
      type: "answer",
      topicId: "project.health",
      structured: {
        title: "Planung & Termine · MKG-209",
      },
    });
    expect(response?.structured?.facts?.map((fact) => fact.label)).toEqual([
      "Teilprüfwert",
      "Einordnung",
      "Datenbasis",
      "Auswahl",
    ]);
    expect(response?.structured?.sections?.at(-1)).toMatchObject({
      title: "Abgrenzung",
    });
  });

  it("uses the stable conversation project before the open screen project", async () => {
    dbMocks.queryRaw.mockResolvedValueOnce([{
      ...project,
      id: "project-has-1",
      projectNumber: "HAS-1",
      title: "Hausmeisterservice",
    }]);

    const response = await resolveJarvisProjectHealthRequest({
      question: "Und wie sieht die Planung aus?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager-1",
        role: Role.GESCHAEFTSFUEHRER,
      }),
      conversationContext: {
        recordType: "project",
        recordId: "project-has-1",
      },
      context: {
        recordType: "project",
        recordId: "project-mkg-209",
      },
    });

    expect(response).toMatchObject({
      type: "answer",
      structured: {
        title: "Planung & Termine · HAS-1",
      },
      records: [{
        target: { kind: "project", id: "project-has-1" },
      }],
    });
  });

  it("does not reduce a combined project-planning-time choice to a stamp-only check", async () => {
    dbMocks.queryRaw.mockResolvedValueOnce([{
      ...project,
      id: "project-has-1",
      projectNumber: "HAS-1",
      title: "Hausmeisterservice",
    }]);

    const response = await resolveJarvisProjectHealthRequest({
      question:
        "Wie finde ich ein Projekt und wo prüfe ich Planung, Termine und Stempelungen?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager-1",
        role: Role.GESCHAEFTSFUEHRER,
      }),
      conversationContext: {
        recordType: "project",
        recordId: "project-has-1",
      },
      context: {
        recordType: "project",
        recordId: "project-mkg-209",
      },
    });

    expect(response).toMatchObject({
      type: "clarification",
      topicId: "project.health.clarification",
      records: [{
        target: { kind: "project", id: "project-has-1" },
      }],
    });
    expect(dbMocks.projectTimeEntryFindMany).not.toHaveBeenCalled();
  });

  it("lets an explicit reference to this project use the open screen again", async () => {
    dbMocks.queryRaw.mockResolvedValueOnce([{
      ...project,
      id: "project-mkg-209",
      projectNumber: "MKG-209",
    }]);

    const response = await resolveJarvisProjectHealthRequest({
      question: "Prüfe dieses Projekt vollständig.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager-1",
        role: Role.GESCHAEFTSFUEHRER,
      }),
      conversationContext: {
        recordType: "project",
        recordId: "project-has-1",
      },
      context: {
        recordType: "project",
        recordId: "project-mkg-209",
      },
    });

    expect(response).toMatchObject({
      type: "answer",
      topicId: "project.health",
      structured: {
        title: "Vollständiger Projektcheck · MKG-209",
      },
      records: [{
        target: { kind: "project", id: "project-mkg-209" },
      }],
    });
  });

  it("finds the missing future planning of a live recurring project", async () => {
    dbMocks.queryRaw.mockResolvedValueOnce([{
      ...project,
      id: "project-has-1",
      projectNumber: "HAS-1",
      title: "Hausmeisterservice",
      status: "Arbeit unterbrochen",
      projectKind: "Dauerläufer-Projekt",
      projectRuntimeFrom: "2026-05-11",
      projectRuntimeUntil: "2026-12-31",
      recurringBillingMode: "monthlyFlat",
    }]);

    const response = await resolveJarvisProjectHealthRequest({
      question: "Prüfe Planung und Termine für HAS-1.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager-1",
        role: Role.GESCHAEFTSFUEHRER,
      }),
      context: { recordType: "project", recordId: "project-mkg-209" },
    });

    expect(response).toMatchObject({
      type: "answer",
      structured: {
        title: "Planung & Termine · HAS-1",
        facts: [
          { label: "Teilprüfwert", value: "85 / 100" },
          { label: "Einordnung", value: "Prüfen" },
          { label: "Datenbasis", value: "Fachlich freigegeben" },
          { label: "Auswahl", value: "Planung & Termine" },
        ],
      },
    });
    expect(JSON.stringify(response)).toContain(
      "Für den nächsten Monat der Pauschalleistung ist noch kein Termin geplant"
    );
  });

  it("answers a natural why-question about incomplete recurring planning directly", async () => {
    dbMocks.queryRaw.mockResolvedValueOnce([{
      ...project,
      id: "project-has-1",
      projectNumber: "HAS-1",
      title: "Hausmeisterservice",
      status: "Umsetzung",
      projectKind: "Dauerläufer-Projekt",
      projectRuntimeFrom: "2026-05-11",
      projectRuntimeUntil: "2026-12-31",
      recurringBillingMode: "monthlyFlat",
    }]);

    const response = await resolveJarvisProjectHealthRequest({
      question:
        "Warum ist der nächste Monat bei HAS-1 noch nicht vollständig geplant?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager-1",
        role: Role.GESCHAEFTSFUEHRER,
      }),
      context: { recordType: "customer", recordId: "customer-1" },
    });

    expect(response).toMatchObject({
      type: "answer",
      topicId: "project.health",
      structured: {
        title: "Planung & Termine · HAS-1",
      },
    });
    expect(JSON.stringify(response)).toContain(
      "Für den nächsten Monat der Pauschalleistung ist noch kein Termin geplant"
    );
  });

  it("carries a missing recurring invoice month into the commercial project check", async () => {
    dbMocks.queryRaw.mockResolvedValueOnce([{
      ...project,
      id: "project-has-1",
      projectNumber: "HAS-1",
      title: "Hausmeisterservice",
      status: "Umsetzung",
      projectKind: "Dauerläufer-Projekt",
      projectRuntimeFrom: "2026-05-11",
      projectRuntimeUntil: "2026-12-31",
      recurringBillingMode: "monthlyFlat",
      timeBudgetEnabled: true,
      timeBudgetHours: "8",
      timeBudgetAllocations: [
        { month: "2026-05", hours: "8" },
        { month: "2026-06", hours: "8" },
      ],
    }]);
    dbMocks.planningEntryFindMany
      .mockResolvedValueOnce([
        {
          id: "planning-may",
          projectId: "project-has-1",
          userId: "employee-1",
          date: "2026-05-12",
          durationMinutes: 480,
          approvalStatus: "confirmed",
          deletedAt: null,
        },
        {
          id: "planning-june",
          projectId: "project-has-1",
          userId: "employee-1",
          date: "2026-06-12",
          durationMinutes: 480,
          approvalStatus: "confirmed",
          deletedAt: null,
        },
      ])
      .mockResolvedValueOnce([]);
    dbMocks.invoiceFindMany.mockResolvedValueOnce([
      {
        id: "invoice-may",
        projectId: "project-has-1",
        status: "Fakturiert",
        billingSource: "batch",
        plannedExecutionMonth: "2026-05",
        serviceDate: "2026-05-31",
        netTotal: 800,
        createdAt: new Date("2026-05-31T12:00:00.000Z"),
      },
    ]);

    const response = await resolveJarvisProjectHealthRequest({
      question: "Prüfe Angebote und Rechnungen für HAS-1.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager-1",
        role: Role.GESCHAEFTSFUEHRER,
      }),
    });

    expect(response).toMatchObject({
      type: "answer",
      structured: {
        title: "Angebote & Rechnungen · HAS-1",
      },
    });
    expect(JSON.stringify(response)).toContain(
      "Für vergangene Leistungsmonate wurde keine fertige Rechnung gefunden"
    );
    expect(JSON.stringify(response)).toContain("Juni 2026");
  });

  it("answers a focused invoice-month question briefly without a full diagnosis", async () => {
    dbMocks.queryRaw.mockResolvedValueOnce([{
      ...project,
      id: "project-has-1",
      projectNumber: "HAS-1",
      title: "Hausmeisterservice",
      status: "Umsetzung",
      projectKind: "Dauerläufer-Projekt",
      projectRuntimeFrom: "2026-05-11",
      projectRuntimeUntil: "2026-12-31",
      recurringBillingMode: "monthlyFlat",
      autoBillingEnabled: true,
      autoBillingStartMonth: null,
      autoBillingEndMonth: null,
    }]);
    dbMocks.invoiceFindMany.mockResolvedValueOnce([
      {
        id: "invoice-may",
        projectId: "project-has-1",
        status: "Fakturiert",
        billingSource: "manual",
        plannedExecutionMonth: "2026-05",
        serviceDate: "2026-05-31",
        netTotal: 800,
        createdAt: new Date("2026-06-27T12:00:00.000Z"),
      },
      {
        id: "invoice-june-draft",
        projectId: "project-has-1",
        status: "Entwurf",
        billingSource: "hourly-recurring",
        plannedExecutionMonth: "2026-06",
        serviceDate: "",
        netTotal: 800,
        createdAt: new Date("2026-06-25T12:00:00.000Z"),
      },
    ]);

    const response = await resolveJarvisProjectHealthRequest({
      question: "Was verhindert die Juni-Abrechnung bei HAS-1?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager-1",
        role: Role.GESCHAEFTSFUEHRER,
      }),
    });

    expect(response).toMatchObject({
      type: "answer",
      topicId: "project.invoice.month",
      structured: {
        title: "Rechnung Juni 2026 · HAS-1",
        summary:
          "Für Juni 2026 wurde bereits eine Rechnung angelegt, aber sie ist noch nicht fertiggestellt.",
        facts: [
          { label: "Rechnungsmonat", value: "Juni 2026" },
          { label: "Stand", value: "Entwurf vorhanden" },
        ],
      },
    });
    const serialized = JSON.stringify(response);
    expect(serialized).toContain("Stundenabrechnung");
    expect(serialized).toContain("Monatspauschale");
    expect(serialized).toContain("keine zweite Rechnung");
    expect(serialized).not.toContain("Teilprüfwert");
    expect(serialized).not.toContain("Bewertung nach Bereichen");
    expect(response?.structured?.sections).toHaveLength(2);
  });

  it("explains a missing time-based draft as one causal chain", async () => {
    const response = await resolveJarvisProjectHealthRequest({
      question:
        "Weshalb erzeugen die Arbeitszeiten bei MKG-209 keinen Juli-Entwurf?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager-1",
        role: Role.GESCHAEFTSFUEHRER,
      }),
    });

    expect(response).toMatchObject({
      type: "answer",
      topicId: "project.invoice.from-time",
      structured: {
        title: "Stempelungen & Rechnung Juli 2026 · MKG-209",
        facts: [
          { label: "Stempelungen", value: "0 · 0 Std." },
          {
            label: "Stand",
            value: "Keine Stunden-Dauerläufer-Abrechnung",
          },
        ],
      },
    });
    const serialized = JSON.stringify(response);
    expect(serialized).toContain(
      "nicht als Dauerläufer mit Stundenabrechnung eingerichtet"
    );
    expect(serialized).toContain(
      "Für Juli 2026 wurden außerdem keine Stempelungen gefunden"
    );
    expect(serialized).toContain("Ändere die Projektart nicht");
    expect(serialized).not.toContain("Teilprüfwert");
    expect(serialized).not.toContain("Bewertung nach Bereichen");
  });

  it("answers a physical-consumption question for the requested project month without inventing usage", async () => {
    dbMocks.invoiceFindMany.mockResolvedValueOnce([
      {
        id: "invoice-material",
        projectId: "project-1",
        invoiceNumber: "RE-MAT-1",
        projectNumber: "MKG-209",
        projectTitle: "Marketing",
        customerName: "Klaus Testmann",
        status: "Fakturiert",
        billingSource: "manual",
        plannedExecutionMonth: "2026-07",
        serviceDate: "2026-07-15",
        netTotal: 30,
        createdAt: new Date("2026-07-15T12:00:00.000Z"),
      },
      {
        id: "invoice-material-june",
        projectId: "project-1",
        invoiceNumber: "RE-MAT-0",
        projectNumber: "MKG-209",
        projectTitle: "Marketing",
        customerName: "Klaus Testmann",
        status: "Fakturiert",
        billingSource: "manual",
        plannedExecutionMonth: "2026-06",
        serviceDate: "2026-06-15",
        netTotal: 200,
        createdAt: new Date("2026-06-15T12:00:00.000Z"),
      },
    ]);
    dbMocks.invoiceLineFindMany.mockResolvedValueOnce([
      {
        id: "line-1",
        invoiceId: "invoice-material",
        catalogItemId: "salt-1",
        catalogType: "article",
        position: 1,
        quantity: 10,
        unit: "kg",
        title: "Streusalz",
        unitPrice: 2,
        discountPercent: 0,
        materialCostSnapshot: 8,
        laborCostSnapshot: 0,
        packageComponentsSnapshot: [],
        catalogCostSnapshotVersion: 1,
        costSnapshotAt: new Date("2026-07-15T12:00:00.000Z"),
        totalNet: 20,
      },
      {
        id: "line-2",
        invoiceId: "invoice-material",
        catalogItemId: "salt-1",
        catalogType: "article",
        position: 2,
        quantity: 5,
        unit: "kg",
        title: "Streusalz",
        unitPrice: 2,
        discountPercent: 0,
        materialCostSnapshot: 4,
        laborCostSnapshot: 0,
        packageComponentsSnapshot: [],
        catalogCostSnapshotVersion: 1,
        costSnapshotAt: new Date("2026-07-15T12:00:00.000Z"),
        totalNet: 10,
      },
      {
        id: "line-june",
        invoiceId: "invoice-material-june",
        catalogItemId: "salt-1",
        catalogType: "article",
        position: 1,
        quantity: 100,
        unit: "kg",
        title: "Streusalz",
        unitPrice: 2,
        discountPercent: 0,
        materialCostSnapshot: 80,
        laborCostSnapshot: 0,
        packageComponentsSnapshot: [],
        catalogCostSnapshotVersion: 1,
        costSnapshotAt: new Date("2026-06-15T12:00:00.000Z"),
        totalNet: 200,
      },
    ]);
    dbMocks.catalogInventoryMovementFindMany.mockResolvedValueOnce([
      {
        catalogItemId: "salt-1",
        movementType: "sale",
        quantityDelta: -15,
        invoiceId: "invoice-material",
      },
      {
        catalogItemId: "salt-1",
        movementType: "sale",
        quantityDelta: -100,
        invoiceId: "invoice-material-june",
      },
    ]);

    const response = await resolveJarvisProjectHealthRequest({
      question: "Wie viel Material wurde bei MKG-209 im Juli 2026 tatsächlich verbraucht?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager-1",
        role: Role.GESCHAEFTSFUEHRER,
      }),
    });

    expect(response).toMatchObject({
      type: "answer",
      topicId: "project.materials",
      structured: {
        title: "Materialanalyse · MKG-209",
        facts: [
          { label: "Zeitraum", value: "Juli 2026" },
          {
            label: "Projektart",
            value: "Einmaliges Projekt",
            tone: "neutral",
          },
          {
            label: "Projektdaten",
            value: "Fachlich freigegeben",
            tone: "positive",
          },
          {
            label: "Physischer Verbrauch",
            value: "Nicht separat belegt",
            tone: "warning",
          },
          { label: "Fertige Rechnungen", value: "1" },
          { label: "Materialpositionen", value: "2" },
          {
            label: "Lagerabgleich",
            value: "Abgerechnete Mengen und Lagerbuchungen stimmen überein",
            tone: "positive",
          },
        ],
      },
    });
    const serialized = JSON.stringify(response);
    expect(serialized).toContain("Streusalz: 15 kg");
    expect(serialized).not.toContain("115 kg");
    expect(serialized).toContain(
      "tatsächliche physische Materialverbrauch"
    );
    expect(serialized).toContain("keinen tatsächlichen physischen Verbrauch");
    expect(serialized).not.toContain("Prüfwert");
  });

  it("does not load invoice material data for an unauthorized employee", async () => {
    const response = await resolveJarvisProjectHealthRequest({
      question: "Welche Materialien wurden bei MKG-209 abgerechnet?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "employee-1",
        role: Role.MITARBEITER,
      }),
    });

    expect(response).toMatchObject({
      type: "refusal",
      topicId: "project.materials.refused",
    });
    expect(dbMocks.invoiceLineFindMany).not.toHaveBeenCalled();
    expect(dbMocks.catalogInventoryMovementFindMany).not.toHaveBeenCalled();
  });

  it("answers a project service-rate question from finished invoices and stable time links", async () => {
    dbMocks.projectTimeEntryFindMany.mockResolvedValue([{
      id: "time-1",
      mode: "project",
      projectId: "project-1",
      trade: "Hausmeister",
      planningEntryId: null,
      billingCatalogItemId: "service-1",
      billingCatalogItemLabel: "Hausmeisterstunde",
      offerId: "offer-1",
      userId: "manager-1",
      employee: "Christian Eid",
      entrySource: "stamped",
      date: "2026-07-15",
      startTime: "08:00",
      endTime: "20:00",
      pauseMs: 0,
      invoiceId: "invoice-service",
      durationMs: BigInt(12 * 3_600_000),
      laborCostRateSnapshot: 30,
      laborCostSnapshot: 360,
      costSnapshotAt: new Date("2026-07-15T20:00:00.000Z"),
      comment: null,
      completionStatus: "completed",
      overtimeApprovalStatus: "not_required",
      overtimeApprovedByUserId: null,
      overtimeApprovedByName: null,
      overtimeApprovedAt: null,
    }, {
      id: "time-june",
      mode: "project",
      projectId: "project-1",
      trade: "Hausmeister",
      planningEntryId: null,
      billingCatalogItemId: "service-1",
      billingCatalogItemLabel: "Hausmeisterstunde",
      offerId: "offer-1",
      userId: "manager-1",
      employee: "Christian Eid",
      entrySource: "stamped",
      date: "2026-06-15",
      startTime: "08:00",
      endTime: "18:00",
      pauseMs: 0,
      invoiceId: "invoice-service-june",
      durationMs: BigInt(10 * 3_600_000),
      laborCostRateSnapshot: 30,
      laborCostSnapshot: 300,
      costSnapshotAt: new Date("2026-06-15T18:00:00.000Z"),
      comment: null,
      completionStatus: "completed",
      overtimeApprovalStatus: "not_required",
      overtimeApprovedByUserId: null,
      overtimeApprovedByName: null,
      overtimeApprovedAt: null,
    }]);
    dbMocks.invoiceFindMany.mockResolvedValueOnce([{
      id: "invoice-service",
      projectId: "project-1",
      invoiceNumber: "RE-SVS-1",
      projectNumber: "MKG-209",
      projectTitle: "Marketing",
      customerName: "Klaus Testmann",
      status: "Fakturiert",
      billingSource: "manual",
      plannedExecutionMonth: "2026-07",
      serviceDate: "2026-07-15",
      netTotal: 600,
      createdAt: new Date("2026-07-15T12:00:00.000Z"),
    }, {
      id: "invoice-service-june",
      projectId: "project-1",
      invoiceNumber: "RE-SVS-0",
      projectNumber: "MKG-209",
      projectTitle: "Marketing",
      customerName: "Klaus Testmann",
      status: "Fakturiert",
      billingSource: "manual",
      plannedExecutionMonth: "2026-06",
      serviceDate: "2026-06-15",
      netTotal: 1_000,
      createdAt: new Date("2026-06-15T12:00:00.000Z"),
    }]);
    dbMocks.invoiceLineFindMany.mockResolvedValueOnce([{
      id: "line-service",
      invoiceId: "invoice-service",
      catalogItemId: "service-1",
      catalogType: "service",
      position: 1,
      quantity: 10,
      unit: "Std.",
      title: "Hausmeisterstunde",
      unitPrice: 60,
      discountPercent: 0,
      materialCostSnapshot: 0,
      laborCostSnapshot: 300,
      packageComponentsSnapshot: [],
      catalogCostSnapshotVersion: 1,
      costSnapshotAt: new Date("2026-07-15T12:00:00.000Z"),
      totalNet: 600,
    }, {
      id: "line-service-june",
      invoiceId: "invoice-service-june",
      catalogItemId: "service-1",
      catalogType: "service",
      position: 1,
      quantity: 10,
      unit: "Std.",
      title: "Hausmeisterstunde",
      unitPrice: 100,
      discountPercent: 0,
      materialCostSnapshot: 0,
      laborCostSnapshot: 300,
      packageComponentsSnapshot: [],
      catalogCostSnapshotVersion: 1,
      costSnapshotAt: new Date("2026-06-15T12:00:00.000Z"),
      totalNet: 1_000,
    }]);
    dbMocks.catalogItemFindMany.mockResolvedValueOnce([{
      id: "service-1",
      number: "L-1",
      name: "Hausmeisterstunde",
      unit: "Std.",
      salesPrice: 60,
      isActive: true,
      reviewStatus: "approved",
    }]);

    const response = await resolveJarvisProjectHealthRequest({
      question:
        "Wie hoch ist der tatsächlich erzielte Stundenverrechnungssatz bei MKG-209 im Juli 2026?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager-1",
        role: Role.GESCHAEFTSFUEHRER,
      }),
    });

    expect(response).toMatchObject({
      type: "answer",
      topicId: "project.service-rates",
      structured: {
        title: "Leistungen & Stundenverrechnungssätze · MKG-209",
        facts: [
          { label: "Zeitraum", value: "Juli 2026" },
          {
            label: "Projektart",
            value: "Einmaliges Projekt",
            tone: "neutral",
          },
          { label: "Fertige Rechnungen", value: "1" },
          { label: "Abgerechnete Stunden", value: "10 Std." },
          { label: "Zugeordnete Stempelstunden", value: "12 Std." },
          {
            label: "Projektdaten",
            value: "Fachlich freigegeben",
            tone: "positive",
          },
          {
            label: "Freigegebene Leistungen",
            value: "1 von 1",
            tone: "positive",
          },
        ],
      },
    });
    const serialized = JSON.stringify(response);
    expect(serialized).toContain(
      "60,00 € tatsächlich je abgerechneter Stunde"
    );
    expect(serialized).toContain("50,00 € Nettoerlös je gestempelter Stunde");
    expect(serialized).toContain("30,00 € gespeicherte Mitarbeiterkosten");
    expect(serialized).toContain("weniger Stunden abgerechnet als gestempelt");
    expect(serialized).toContain("keinen erfundenen neuen Stundensatz");
    expect(serialized).not.toContain("Prüfwert");
  });

  it("does not load service-rate financial data for an unauthorized employee", async () => {
    const response = await resolveJarvisProjectHealthRequest({
      question: "Analysiere die Stundensätze bei MKG-209.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "employee-1",
        role: Role.MITARBEITER,
      }),
    });

    expect(response).toMatchObject({
      type: "refusal",
      topicId: "project.service-rates.refused",
    });
    expect(dbMocks.invoiceLineFindMany).not.toHaveBeenCalled();
    expect(dbMocks.catalogItemFindMany).not.toHaveBeenCalled();
  });

  it("offers a safe next step when an explicit project number is not found", async () => {
    dbMocks.queryRaw.mockResolvedValueOnce([]);

    const response = await resolveJarvisProjectHealthRequest({
      question: "Prüfe FALSCH-1 vollständig.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "manager-1",
        role: Role.GESCHAEFTSFUEHRER,
      }),
      context: { recordType: "project", recordId: "project-1" },
    });

    expect(response).toMatchObject({
      type: "clarification",
      topicId: "project.health.project-not-found",
    });
    expect(response?.choices?.map((choice) => choice.label)).toEqual([
      "Geöffnetes Projekt verwenden",
      "Projekt suchen",
    ]);
    expect(dbMocks.projectTimeEntryFindMany).not.toHaveBeenCalled();
  });

  it("refuses guest access before reading project data", async () => {
    const response = await resolveJarvisProjectHealthRequest({
      question: "Prüfe dieses Projekt.",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "guest-1",
        role: Role.GAST,
      }),
      context: { recordType: "project", recordId: "project-1" },
    });

    expect(response).toMatchObject({
      type: "refusal",
      topicId: "project.health.refused",
    });
    expect(dbMocks.queryRaw).not.toHaveBeenCalled();
  });
});
