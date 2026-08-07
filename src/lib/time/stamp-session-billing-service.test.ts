import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDeadlineSettings: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/company-settings/deadlines", () => ({
  getDeadlineSettings: mocks.getDeadlineSettings,
}));

vi.mock("@/lib/db/client", () => ({
  prisma: { $transaction: mocks.transaction },
}));

import { attachStampEntryToHourlyInvoiceDraft } from "@/lib/time/stamp-session-billing-service";

describe("hourly recurring stamp billing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDeadlineSettings.mockResolvedValue({
      hourlyBillingRoundingFactorHours: 0.25,
    });
  });

  it("keeps the automatic invoice linkage and adds the same-day customer snapshot", async () => {
    const queryResults = [
      [{ invoiceId: null, invoiceNumber: null }],
      [{
        id: "project-1",
        projectNumber: "OBJ-449",
        title: "Objektbetreuung",
        customer: "Klaus Testmann",
        contactId: "contact-1",
        addressContactId: null,
        address: "Birkenweg 12, 74722 Buchen",
        projectType: "OK immocare",
        branch: "Buchen",
        responsibleName: "Christian Eid",
        projectKind: "Dauerläufer",
        recurringBillingMode: "hourly",
      }],
      [{
        id: "catalog-1",
        type: "service",
        number: "OKI0204",
        name: "Grünpflege: Rasenpflege",
        unit: "Std",
        salesPrice: 60.5,
        vatRate: 19,
      }],
      [{ id: "invoice-1", invoiceNumber: "RE-10125" }],
      [{ id: "line-1", hourlyBillingDetails: [] }],
      [{ hours: 1.25, cost: 37.5 }],
      [{ description: "Im Bereich 1, 2 und 3" }],
      [{ netTotal: 75.63, vatRate: 19 }],
    ];
    const executed: Array<{ sql: string; values: unknown[] }> = [];
    const tx = {
      $queryRaw: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
        expect(strings).toBeDefined();
        return Promise.resolve(queryResults.shift() ?? []);
      }),
      $executeRaw: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
        executed.push({ sql: strings.join("?"), values });
        return Promise.resolve(1);
      }),
    };
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    const result = await attachStampEntryToHourlyInvoiceDraft({
      organizationId: "org-1",
      entry: {
        id: "time-1",
        organizationId: "org-1",
        mode: "project",
        projectId: "project-1",
        projectLabel: "OBJ-449 | Objektbetreuung",
        trade: "Grünpflege",
        planningEntryId: "planning-1",
        planningBillingGroupId: "group-1",
        billingCatalogItemId: "catalog-1",
        billingCatalogItemLabel: "OKI0204 | Grünpflege: Rasenpflege",
        userId: "user-1",
        employee: "Hendrik Eid",
        entrySource: "stamped",
        date: "2026-08-03",
        startTime: "08:00",
        endTime: "09:06",
        durationMs: 66 * 60_000,
        pauseMs: 0,
        laborCostRateSnapshot: 30,
        laborCostSnapshot: 33,
        costSnapshotAt: "2026-08-03T09:06:00.000Z",
        comment: "Rasen gemäht",
        marketingContentItemId: "",
        marketingContentType: "",
        completionStatus: "finished",
        invoiceId: "",
        invoiceNumber: "",
        invoicedAt: "",
        overtimeApprovalStatus: "not_required",
        overtimeApprovedByUserId: "",
        overtimeApprovedByName: "",
        overtimeApprovedAt: "",
        editHistory: [],
        createdAt: "2026-08-03T09:06:00.000Z",
      },
    });

    expect(result).toEqual({
      invoiceId: "invoice-1",
      invoiceNumber: "RE-10125",
      replayed: false,
    });
    const lineUpdate = executed.find((statement) =>
      statement.sql.includes('UPDATE "InvoiceLine"')
    );
    expect(lineUpdate).toBeDefined();
    expect(lineUpdate?.values).toContain(1.25);
    expect(lineUpdate?.values.some((value) =>
      typeof value === "string" &&
      value.includes('"date":"2026-08-03"') &&
      value.includes('"customerText":"Im Bereich 1, 2 und 3"') &&
      value.includes('"employeeName":"Hendrik Eid"')
    )).toBe(true);
    expect(executed.some((statement) =>
      statement.sql.includes('UPDATE "ProjectTimeEntry"') &&
      statement.values.includes("invoice-1") &&
      statement.values.includes("RE-10125")
    )).toBe(true);
  });
});
