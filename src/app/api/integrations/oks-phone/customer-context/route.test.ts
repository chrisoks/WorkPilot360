import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  contact: { findFirst: vi.fn(), findMany: vi.fn() },
  workPilotProject: { findMany: vi.fn() },
  customerProjectNote: { findMany: vi.fn() },
  offer: { findMany: vi.fn() },
  invoice: { findMany: vi.fn() },
  customerLogbookEntry: { findMany: vi.fn() },
  auditLog: { findMany: vi.fn() },
  projectLogbookEntry: { findMany: vi.fn() },
}));
const authMock = vi.hoisted(() => ({ authenticate: vi.fn(), audit: vi.fn() }));

vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/oks-phone/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations/oks-phone/auth")>();
  return {
    ...actual,
    authenticateOksPhoneRequest: authMock.authenticate,
    auditOksPhoneRequest: authMock.audit,
  };
});

import { GET } from "./route";

const actor = {
  credentialId: "credential-1",
  credentialName: "OKS Phone",
  organizationId: "organization-a",
  keyId: "key-a",
  scopes: ["customer-context:read"],
};

function contact(id: string, phoneNormalized: string) {
  return {
    id,
    category: "customer",
    type: "company",
    customerNumber: `K-${id}`,
    companyName: `Kunde ${id}`,
    firstName: "",
    lastName: "",
    position: "",
    email: "",
    phone: phoneNormalized,
    phoneNormalized,
    mobile: "",
    mobileNormalized: "",
    fax: "",
    faxNormalized: "",
    street: "Testweg 1",
    postalCode: "74722",
    city: "Buchen",
    country: "Deutschland",
    parentCompanyId: null,
    parentCompanyName: null,
    isMainContact: true,
    updatedAt: new Date("2026-07-20T10:00:00Z"),
  };
}

describe("OKS Phone customer context endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.authenticate.mockResolvedValue(actor);
    authMock.audit.mockResolvedValue(undefined);
    prismaMock.workPilotProject.findMany.mockResolvedValue([]);
    prismaMock.customerProjectNote.findMany.mockResolvedValue([]);
    prismaMock.customerLogbookEntry.findMany.mockResolvedValue([]);
    prismaMock.auditLog.findMany.mockResolvedValue([]);
  });

  it("keeps contact-id lookup inside the credential tenant", async () => {
    prismaMock.contact.findFirst.mockResolvedValue(null);

    const response = await GET(new Request(
      "http://localhost/api/integrations/oks-phone/customer-context?contactId=foreign-contact"
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ matchCount: 0, candidates: [] });
    expect(prismaMock.contact.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "organization-a", id: "foreign-contact" },
    }));
  });

  it("returns all exact phone matches as candidates without coaching or audio data", async () => {
    const first = contact("customer-1", "+49628112345");
    const second = contact("customer-2", "+49628112345");
    prismaMock.contact.findMany.mockImplementation(async (args) => {
      if (args.where.OR.some((entry: Record<string, unknown>) => "phoneNormalized" in entry)) {
        return [first, second];
      }
      const requestedId = args.where.OR[0]?.id;
      return requestedId === first.id ? [first] : [second];
    });

    const response = await GET(new Request(
      "http://localhost/api/integrations/oks-phone/customer-context?phone=06281%2012345"
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ matchCount: 2, multipleMatches: true });
    expect(payload.candidates).toHaveLength(2);
    expect(payload.candidates[0]).toEqual(expect.objectContaining({
      customer: expect.objectContaining({ id: "customer-1" }),
      projects: [],
      offers: [],
      invoices: [],
      activeCustomerNotes: [],
      activeProjectNotes: [],
    }));
    expect(JSON.stringify(payload)).not.toMatch(/coaching|audio|recording/i);
  });

  it("removes the imported company duplicate and returns people only as contacts", async () => {
    const phone = "+496281557912";
    const company = {
      ...contact("company-1", phone),
      companyName: "Familienheim",
      firstName: "Eva",
      lastName: "Hilbert",
    };
    const person = {
      ...contact("person-1", phone),
      type: "person",
      companyName: null,
      firstName: "Eva",
      lastName: "Hilbert",
      parentCompanyId: company.id,
      parentCompanyName: company.companyName,
    };
    prismaMock.contact.findFirst.mockResolvedValue(company);
    prismaMock.contact.findMany.mockImplementation(async (args) => {
      if (args.where.OR.some((entry: Record<string, unknown>) => "phoneNormalized" in entry)) {
        return [company, person];
      }
      return [company, person];
    });

    const response = await GET(new Request(
      "http://localhost/api/integrations/oks-phone/customer-context?phone=06281%20557912"
    ));
    const payload = await response.json();

    expect(payload).toMatchObject({ matchCount: 1, multipleMatches: false });
    expect(payload.candidates[0].matchedContact).toMatchObject({ id: person.id, phone });
    expect(payload.candidates[0].customer).toMatchObject({ id: company.id, phone: null, phoneNormalized: null });
    expect(payload.candidates[0].contacts).toEqual([
      expect.objectContaining({ id: person.id, phone }),
    ]);
  });
});
