import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  actor: { id: "employee-1", firstName: "Erika", lastName: "Vertrieb", email: "erika@example.test", role: "VERTRIEB", isActive: true },
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $queryRaw: vi.fn(),
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/db/client", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/demo/context", () => ({
  getDemoContext: vi.fn().mockResolvedValue({
    organization: { id: "org-1" },
    users: [
      mocks.actor,
      { id: "employee-2", firstName: "Max", lastName: "Muster", email: "max@example.test", role: "MITARBEITER", isActive: true },
    ],
  }),
}));
vi.mock("@/lib/auth/actor", () => ({
  getSessionBoundActor: vi.fn(async () => ({ ok: true, actor: mocks.actor })),
  sessionBoundActorResponse: vi.fn(),
}));

import { GET, POST } from "./route";

describe("sales journal route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$queryRawUnsafe.mockReset();
    mocks.prisma.$queryRaw.mockReset();
    Object.assign(mocks.actor, { id: "employee-1", role: Role.VERTRIEB, firstName: "Erika", lastName: "Vertrieb" });
    mocks.prisma.$queryRawUnsafe.mockResolvedValueOnce([
      {
        id: "audit-own", entityId: "customer-1", actorId: "employee-1",
        payload: { text: "Kunde angerufen.", author: "Erika Vertrieb", authorUserId: "employee-1", salesActivityType: "call" },
        createdAt: new Date("2026-08-05T08:00:00.000Z"), customerName: "Beispiel GmbH",
      },
      {
        id: "audit-foreign", entityId: "customer-2", actorId: "employee-2",
        payload: { text: "E-Mail gesendet.", author: "Max Muster", authorUserId: "employee-2", salesActivityType: "email" },
        createdAt: new Date("2026-08-05T09:00:00.000Z"), customerName: "Andere GmbH",
      },
    ]).mockResolvedValueOnce([]);
    mocks.prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  });

  it("returns only the current employee's activities even when another owner is requested", async () => {
    const response = await GET(new Request("http://localhost/api/sales-journal?actorId=employee-1&employeeId=employee-2"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.scope).toBe("own");
    expect(payload.canReadAll).toBe(false);
    expect(payload.entries).toHaveLength(1);
    expect(payload.entries[0]).toMatchObject({ actorUserId: "employee-1", activityType: "call" });
  });

  it("allows Geschäftsführung to read the team and filter an employee", async () => {
    Object.assign(mocks.actor, { id: "executive-1", role: Role.GESCHAEFTSFUEHRER, firstName: "Gina", lastName: "Führung" });
    const response = await GET(new Request("http://localhost/api/sales-journal?actorId=executive-1&employeeId=employee-2"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.scope).toBe("all");
    expect(payload.canReadAll).toBe(true);
    expect(payload.entries).toHaveLength(1);
    expect(payload.entries[0].actorUserId).toBe("employee-2");
  });

  it("stores a manual activity in the existing customer logbook", async () => {
    vi.clearAllMocks();
    mocks.prisma.$queryRaw.mockReset();
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ id: "customer-1" }]);
    mocks.prisma.auditLog.create.mockResolvedValue({ id: "journal-1", createdAt: new Date("2026-08-05T10:00:00.000Z") });

    const response = await POST(new Request("http://localhost/api/sales-journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: "employee-1", customerId: "customer-1", activityType: "call", note: "Rückruf besprochen." }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: "sales_journal_entry_created",
      entityType: "contact-logbook",
      entityId: "customer-1",
      actorId: "employee-1",
      payload: expect.objectContaining({ salesJournal: true, salesActivityType: "call", text: "Rückruf besprochen." }),
    }), select: { id: true, createdAt: true } });
  });

  it("rejects task, follow-up and time-tracking fields as activity types", async () => {
    vi.clearAllMocks();
    mocks.prisma.$queryRaw.mockReset();
    const response = await POST(new Request("http://localhost/api/sales-journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: "employee-1", customerId: "customer-1", activityType: "follow_up_task", note: "Nicht zulässig." }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
