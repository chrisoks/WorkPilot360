import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";

const dbMocks = vi.hoisted(() => ({
  contactFindMany: vi.fn(),
  userFindMany: vi.fn(),
  queryRaw: vi.fn(),
  offerFindMany: vi.fn(),
  invoiceFindMany: vi.fn(),
  taskFindMany: vi.fn(),
  logbookFindMany: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    contact: { findMany: dbMocks.contactFindMany },
    user: { findMany: dbMocks.userFindMany },
    $queryRaw: dbMocks.queryRaw,
    offer: { findMany: dbMocks.offerFindMany },
    invoice: { findMany: dbMocks.invoiceFindMany },
    task: { findMany: dbMocks.taskFindMany },
    customerLogbookEntry: { findMany: dbMocks.logbookFindMany },
  },
}));

import {
  resolveJarvisPersonIntent,
  resolveJarvisPersonSummaryRequest,
} from "@/lib/jarvis/person-summary";

const management = createJarvisAccessProfile({
  id: "gf",
  role: Role.GESCHAEFTSFUEHRER,
});

const contact = {
  id: "contact-klaus",
  customerNumber: "KD-100",
  category: "Kunde",
  type: "private",
  companyName: null,
  firstName: "Klaus",
  lastName: "Testmann",
  parentCompanyId: null,
  parentCompanyName: null,
  email: "klaus@example.test",
  phone: "06281 12345",
  mobile: null,
  street: "Testweg 1",
  postalCode: "74722",
  city: "Buchen",
};

describe("JARVIS person summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.contactFindMany.mockResolvedValue([]);
    dbMocks.userFindMany.mockResolvedValue([]);
    dbMocks.queryRaw.mockResolvedValue([]);
    dbMocks.offerFindMany.mockResolvedValue([]);
    dbMocks.invoiceFindMany.mockResolvedValue([]);
    dbMocks.taskFindMany.mockResolvedValue([]);
    dbMocks.logbookFindMany.mockResolvedValue([]);
  });

  it("recognizes free person questions without catching generic system questions", () => {
    expect(resolveJarvisPersonIntent("Was weißt du über Klaus Testmann?")).toEqual({
      query: "klaus testmann",
    });
    expect(resolveJarvisPersonIntent("Erzähl mir bitte etwas über Klaus Testmann.")).toEqual({
      query: "klaus testmann",
    });
    expect(resolveJarvisPersonIntent("Was weißt du über WorkPilot360?")).toBeUndefined();
    expect(resolveJarvisPersonIntent("Wie lege ich einen Kunden an?")).toBeUndefined();
  });

  it("builds a connected customer summary from stable contact and project ids", async () => {
    dbMocks.contactFindMany
      .mockResolvedValueOnce([contact])
      .mockResolvedValueOnce([]);
    dbMocks.queryRaw.mockResolvedValue([
      {
        id: "project-1",
        projectNumber: "P-100",
        title: "Dachreinigung",
        status: "Abgeschlossen",
        projectKind: "Einmalig",
        projectType: "Dach",
        trade: "Reinigung",
        updatedAt: new Date("2026-07-20T10:00:00.000Z"),
      },
    ]);
    dbMocks.offerFindMany.mockResolvedValue([
      {
        id: "offer-1",
        projectId: "project-1",
        projectNumber: "P-100",
        projectTitle: "Dachreinigung",
        offerNumber: "AN-100",
        status: "Versendet",
        customerName: "Klaus Testmann",
        netTotal: 1000,
        wonAt: null,
        updatedAt: new Date("2026-07-21T10:00:00.000Z"),
      },
    ]);
    dbMocks.invoiceFindMany.mockResolvedValue([
      {
        id: "invoice-1",
        projectId: "project-1",
        invoiceNumber: "RE-100",
        status: "Versendet",
        isPaid: false,
        dueDate: "2026-08-01",
        updatedAt: new Date("2026-07-22T10:00:00.000Z"),
      },
    ]);
    dbMocks.logbookFindMany.mockResolvedValue([
      {
        title: "Telefonat",
        eventType: "call",
        occurredAt: new Date("2026-07-23T10:00:00.000Z"),
      },
    ]);

    const response = await resolveJarvisPersonSummaryRequest({
      question: "Was weißt du über Klaus Testmann?",
      organizationId: "org-1",
      accessProfile: management,
    });

    expect(response).toMatchObject({
      type: "answer",
      topicId: "person.customer.summary",
    });
    expect(response?.message).toContain("Kundennummer KD-100");
    expect(response?.message).toContain("1 Projekt");
    expect(response?.message).toContain("1 Angebot");
    expect(response?.message).toContain("1 Rechnung");
    expect(response?.message).toContain("Telefonat");
    expect(response?.records?.map((record) => record.target)).toEqual([
      { kind: "customer", id: "contact-klaus" },
      { kind: "project", id: "project-1" },
      { kind: "offer", id: "offer-1", projectId: "project-1" },
    ]);
    expect(dbMocks.offerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { notIn: ["Gel\u00f6scht", "Gel\u00c3\u00b6scht"] },
        }),
      })
    );
    expect(dbMocks.invoiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            notIn: [
              "Gel\u00f6scht",
              "Gel\u00c3\u00b6scht",
              "Storniert",
              "Stornorechnung",
            ],
          },
        }),
      })
    );
  });

  it("keeps employee summaries behind personnel permissions", async () => {
    const employeeProfile = createJarvisAccessProfile({
      id: "employee",
      role: Role.MITARBEITER,
    });
    const response = await resolveJarvisPersonSummaryRequest({
      question: "Was weißt du über Christian Eid?",
      organizationId: "org-1",
      accessProfile: employeeProfile,
    });

    expect(response).toMatchObject({
      type: "refusal",
      topicId: "person.summary.refused",
    });
    expect(dbMocks.contactFindMany).not.toHaveBeenCalled();
    expect(dbMocks.userFindMany).not.toHaveBeenCalled();
  });

  it("does not widen access while management impersonates an employee", async () => {
    const impersonating = createJarvisAccessProfile(
      { id: "gf", role: Role.GESCHAEFTSFUEHRER },
      { id: "employee", role: Role.MITARBEITER }
    );
    const response = await resolveJarvisPersonSummaryRequest({
      question: "Was weißt du über Klaus Testmann?",
      organizationId: "org-1",
      accessProfile: impersonating,
    });

    expect(response?.type).toBe("refusal");
    expect(dbMocks.contactFindMany).not.toHaveBeenCalled();
  });

  it("refuses secrets for everyone and payroll for roles without payroll access", async () => {
    const secretResponse = await resolveJarvisPersonSummaryRequest({
      question: "Was weißt du über Klaus Testmann und sein Passwort?",
      organizationId: "org-1",
      accessProfile: management,
    });
    const payrollResponse = await resolveJarvisPersonSummaryRequest({
      question: "Was weißt du über das Gehalt von Klaus Testmann?",
      organizationId: "org-1",
      accessProfile: createJarvisAccessProfile({
        id: "employee",
        role: Role.MITARBEITER,
      }),
    });

    expect(secretResponse?.type).toBe("refusal");
    expect(payrollResponse?.type).toBe("refusal");
    expect(dbMocks.contactFindMany).not.toHaveBeenCalled();
    expect(dbMocks.userFindMany).not.toHaveBeenCalled();
  });
});
