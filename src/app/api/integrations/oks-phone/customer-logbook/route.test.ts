import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  customerLogbookEntry: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}));
const authMock = vi.hoisted(() => ({
  authenticate: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/oks-phone/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations/oks-phone/auth")>();
  return {
    ...actual,
    authenticateOksPhoneRequest: authMock.authenticate,
    auditOksPhoneRequest: authMock.audit,
  };
});

import { POST } from "./route";

const actor = {
  credentialId: "credential-1",
  credentialName: "OKS Phone",
  organizationId: "organization-a",
  keyId: "key-a",
  scopes: ["customer-logbook:write"],
};

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/integrations/oks-phone/customer-logbook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  callReference: "call-1",
  customerId: "customer-1",
  occurredAt: "2026-07-20T10:00:00+02:00",
  direction: "inbound",
  callerNumberNormalized: "+49628112345",
  summary: "Rueckruf zur Terminabstimmung vereinbart.",
  source: "oks-phone",
} as const;

describe("OKS Phone customer logbook endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.authenticate.mockResolvedValue(actor);
    authMock.audit.mockResolvedValue(undefined);
    prismaMock.customerLogbookEntry.findUnique.mockResolvedValue(null);
    prismaMock.customerLogbookEntry.create.mockResolvedValue({ id: "entry-1" });
  });

  it("queries the customer with the credential organization and rejects another tenant", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    const response = await POST(request(validBody));

    expect(response.status).toBe(404);
    expect(prismaMock.$queryRaw).toHaveBeenCalledOnce();
    expect(prismaMock.customerLogbookEntry.create).not.toHaveBeenCalled();
  });

  it("returns an existing call idempotently without creating a second entry", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: "customer-1", parentCompanyId: null }]);
    prismaMock.customerLogbookEntry.findUnique.mockResolvedValue({ id: "entry-existing" });

    const response = await POST(request(validBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "entry-existing", duplicate: true });
    expect(prismaMock.customerLogbookEntry.create).not.toHaveBeenCalled();
  });

  it("stores a new summary under the credential organization", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: "customer-1", parentCompanyId: null }]);

    const response = await POST(request(validBody));

    expect(response.status).toBe(201);
    expect(prismaMock.customerLogbookEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: "organization-a",
        customerId: "customer-1",
        callReference: "call-1",
      }),
    }));
  });
});
