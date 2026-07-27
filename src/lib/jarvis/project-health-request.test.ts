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
  offerFindMany: vi.fn(),
  invoiceFindMany: vi.fn(),
  invoiceLineFindMany: vi.fn(),
  invoiceLineLaborFindMany: vi.fn(),
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
    projectLogbookEntry: { count: dbMocks.projectLogbookEntryCount },
    offer: { findMany: dbMocks.offerFindMany },
    invoice: { findMany: dbMocks.invoiceFindMany },
    invoiceLine: { findMany: dbMocks.invoiceLineFindMany },
    invoiceLineLabor: { findMany: dbMocks.invoiceLineLaborFindMany },
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
    dbMocks.offerFindMany.mockResolvedValue([
      { id: "offer-1", projectId: "project-1", status: "Gewonnen" },
    ]);
    dbMocks.invoiceFindMany.mockResolvedValue([]);
    dbMocks.invoiceLineFindMany.mockResolvedValue([]);
    dbMocks.invoiceLineLaborFindMany.mockResolvedValue([]);
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
          { label: "Prüfumfang", value: "7 / 7 Bereiche" },
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
      message: "Ich habe HAS-1 eindeutig gefunden. Was soll ich für dieses Projekt prüfen?",
      records: [{
        target: { kind: "project", id: "project-has-1" },
      }],
    });
    expect(response?.choices?.map((choice) => choice.label)).toEqual([
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

  it("asks the same guided follow-up for a broad request about the open project", async () => {
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
      type: "clarification",
      topicId: "project.health.clarification",
      message: "Ich habe MKG-209 eindeutig gefunden. Was soll ich für dieses Projekt prüfen?",
    });
    expect(dbMocks.projectTimeEntryFindMany).not.toHaveBeenCalled();
  });

  it("offers commercial project checks only to an authorized management role", async () => {
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

    expect(response?.type).toBe("clarification");
    expect(response?.choices?.map((choice) => choice.label)).toContain(
      "Angebote & Rechnungen"
    );
    expect(response?.records?.[0]?.target).toEqual({
      kind: "project",
      id: "project-has-1",
    });
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
      type: "clarification",
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
          { label: "Teilprüfwert", value: "92 / 100" },
          { label: "Einordnung", value: "Prüfen" },
          { label: "Auswahl", value: "Planung & Termine" },
        ],
      },
    });
    expect(JSON.stringify(response)).toContain(
      "Dauerläufer hat keine zukünftige Planung"
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
      "Für abgeschlossene Leistungsmonate fehlt eine Rechnung"
    );
    expect(JSON.stringify(response)).toContain("Juni 2026");
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
