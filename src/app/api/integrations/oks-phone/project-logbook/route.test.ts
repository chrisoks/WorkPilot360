import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
  customerLogbookEntry: { findFirst: vi.fn() },
  projectLogbookEntry: { findUnique: vi.fn() },
}));
const transactionMock = vi.hoisted(() => ({
  projectLogbookEntry: { create: vi.fn() },
  customerLogbookEntry: { update: vi.fn() },
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

import { POST } from "./route";

const actor = {
  credentialId: "credential-1",
  credentialName: "OKS Phone",
  organizationId: "organization-a",
  keyId: "key-a",
  scopes: ["project-logbook:write"],
};

const validBody = {
  callReference: "call-1",
  customerLogbookEntryId: "customer-entry-1",
  customerId: "customer-1",
  projectId: "project-1",
  occurredAt: "2026-07-20T10:00:00+02:00",
  summary: "Projekttermin wurde telefonisch abgestimmt.",
  source: "oks-phone",
  confirmedByUserId: "user-1",
  confirmedByName: "Agent Eins",
  confirmationTimestamp: "2026-07-20T10:05:00+02:00",
  agentConfirmed: true,
} as const;

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/integrations/oks-phone/project-logbook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("OKS Phone project logbook endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.authenticate.mockResolvedValue(actor);
    authMock.audit.mockResolvedValue(undefined);
    prismaMock.customerLogbookEntry.findFirst.mockResolvedValue({
      id: "customer-entry-1",
      linkedProjectIds: [],
    });
    prismaMock.$queryRaw.mockResolvedValue([{
      id: "project-1",
      contactId: "customer-1",
      status: "In Umsetzung",
      statusCode: "6",
    }]);
    prismaMock.projectLogbookEntry.findUnique.mockResolvedValue(null);
    transactionMock.projectLogbookEntry.create.mockResolvedValue({ id: "project-entry-1" });
    transactionMock.customerLogbookEntry.update.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation((callback) => callback(transactionMock));
  });

  it("does not create a project entry without explicit agent confirmation", async () => {
    const response = await POST(request({ ...validBody, agentConfirmed: false }));

    expect(response.status).toBe(400);
    expect(prismaMock.customerLogbookEntry.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a project assigned to another customer", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{
      id: "project-1",
      contactId: "customer-2",
      status: "In Umsetzung",
      statusCode: "6",
    }]);

    const response = await POST(request(validBody));

    expect(response.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("creates the confirmed project entry and links it to the customer entry", async () => {
    const response = await POST(request(validBody));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: "project-entry-1", duplicate: false });
    expect(transactionMock.projectLogbookEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: "organization-a",
        projectId: "project-1",
        customerLogbookEntryId: "customer-entry-1",
        callReference: "call-1",
      }),
    }));
    expect(transactionMock.customerLogbookEntry.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { linkedProjectIds: ["project-1"] },
    }));
  });

  it("returns an existing call/project combination idempotently", async () => {
    prismaMock.projectLogbookEntry.findUnique.mockResolvedValue({ id: "project-entry-existing" });

    const response = await POST(request(validBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "project-entry-existing", duplicate: true });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
