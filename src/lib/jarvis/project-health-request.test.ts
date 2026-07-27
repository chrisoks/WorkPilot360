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
        title: "Projekt-Gesundheitscheck · MKG-209",
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
      question: "Mach einen Projektcheck.",
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
