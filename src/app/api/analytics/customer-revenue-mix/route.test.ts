import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  getDemoContext: vi.fn(),
  getSessionBoundActor: vi.fn(),
  invoiceFindMany: vi.fn(),
  projectFindMany: vi.fn(),
  contactFindMany: vi.fn(),
  offerFindMany: vi.fn(),
  potentialFindMany: vi.fn(),
  taskLinkFindMany: vi.fn(),
  legacyInvoiceCount: vi.fn(),
}));

vi.mock("@/lib/demo/context", () => ({ getDemoContext: mocks.getDemoContext }));
vi.mock("@/lib/auth/actor", () => ({
  getSessionBoundActor: mocks.getSessionBoundActor,
  sessionBoundActorResponse: vi.fn(() => new Response(null, { status: 401 })),
}));
vi.mock("@/lib/db/client", () => ({
  prisma: {
    invoice: { findMany: mocks.invoiceFindMany },
    workPilotProject: { findMany: mocks.projectFindMany },
    contact: { findMany: mocks.contactFindMany },
    offer: { findMany: mocks.offerFindMany },
    projectPotential: { findMany: mocks.potentialFindMany },
    taskLink: { findMany: mocks.taskLinkFindMany },
    legacyInvoice: { count: mocks.legacyInvoiceCount },
  },
}));

import { GET } from "./route";

const request = () => new Request(
  "http://localhost/api/analytics/customer-revenue-mix?actorId=user-1&from=2026-01-01&to=2026-12-31&previousFrom=2025-01-01&previousTo=2025-12-31"
);

describe("customer revenue analytics route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDemoContext.mockResolvedValue({ organization: { id: "org-a" }, users: [] });
    mocks.getSessionBoundActor.mockResolvedValue({
      ok: true,
      actor: { id: "user-1", organizationId: "org-a", role: Role.MITARBEITER },
    });
    mocks.invoiceFindMany.mockResolvedValue([]);
    mocks.projectFindMany.mockResolvedValue([]);
    mocks.contactFindMany.mockResolvedValue([]);
    mocks.offerFindMany.mockResolvedValue([]);
    mocks.potentialFindMany.mockResolvedValue([]);
    mocks.taskLinkFindMany.mockResolvedValue([]);
    mocks.legacyInvoiceCount.mockResolvedValueOnce(12).mockResolvedValueOnce(10);
  });

  it("returns safe aggregates to employees and filters every source by organization", async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.current.customerRevenue.totalRevenue).toBe(0);
    expect(body.details).toBeNull();
    expect(body.dataQuality).toEqual({
      legacyInvoiceCount: 12,
      evaluableLegacyInvoiceCount: 10,
      legacyInvoicesIncluded: false,
      manualOverrideCount: 0,
    });
    for (const query of [
      mocks.invoiceFindMany,
      mocks.projectFindMany,
      mocks.contactFindMany,
      mocks.offerFindMany,
      mocks.potentialFindMany,
      mocks.taskLinkFindMany,
    ]) {
      expect(query).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org-a" } }));
    }
    expect(mocks.legacyInvoiceCount).toHaveBeenNthCalledWith(1, { where: { organizationId: "org-a" } });
    expect(mocks.legacyInvoiceCount).toHaveBeenNthCalledWith(2, {
      where: { organizationId: "org-a", isEvaluable: true },
    });
  });

  it("returns current-period invoice explanations only to authorized detail roles", async () => {
    mocks.getSessionBoundActor.mockResolvedValue({
      ok: true,
      actor: { id: "manager-1", organizationId: "org-a", role: Role.GESCHAEFTSFUEHRER },
    });
    mocks.invoiceFindMany.mockResolvedValue([{
      id: "invoice-1",
      projectId: "project-1",
      projectNumber: "P-1",
      projectTitle: "Projekt Eins",
      invoiceNumber: "RE-1",
      customerName: "Kunde Eins",
      status: "Fakturiert",
      netTotal: 500,
      serviceDate: "2026-05-10",
      createdAt: new Date("2026-05-10T12:00:00.000Z"),
      sourceOfferId: "",
      sourceOfferNumber: "",
    }]);
    mocks.projectFindMany.mockResolvedValue([{ id: "project-1", contactId: "contact-1" }]);
    mocks.contactFindMany.mockResolvedValue([{ id: "contact-1", customerStatusOverride: "automatic" }]);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.details.customerRevenue).toEqual([
      expect.objectContaining({
        invoiceId: "invoice-1",
        invoiceNumber: "RE-1",
        bucket: "newCustomers",
        reason: "first_revenue_in_period",
      }),
    ]);
    expect(body.details.additionalSales).toEqual([
      expect.objectContaining({ invoiceId: "invoice-1", proofStatus: "missing_source_offer" }),
    ]);
  });

  it("rejects guests before reading analytics data", async () => {
    mocks.getSessionBoundActor.mockResolvedValue({
      ok: true,
      actor: { id: "guest-1", organizationId: "org-a", role: Role.GAST },
    });

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(mocks.invoiceFindMany).not.toHaveBeenCalled();
  });

  it("rejects malformed reporting periods", async () => {
    const response = await GET(new Request(
      "http://localhost/api/analytics/customer-revenue-mix?actorId=user-1&from=2026-12-31&to=2026-01-01&previousFrom=2025-01-01&previousTo=2025-12-31"
    ));

    expect(response.status).toBe(400);
    expect(mocks.invoiceFindMany).not.toHaveBeenCalled();
  });
});
