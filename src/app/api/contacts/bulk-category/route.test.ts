import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDemoContext: vi.fn(), getSessionBoundActor: vi.fn(), sessionBoundActorResponse: vi.fn(),
  evaluate: vi.fn(), execute: vi.fn(), transaction: vi.fn(),
}));

vi.mock("@/lib/demo/context", () => ({ getDemoContext: mocks.getDemoContext }));
vi.mock("@/lib/auth/actor", () => ({ getSessionBoundActor: mocks.getSessionBoundActor, sessionBoundActorResponse: mocks.sessionBoundActorResponse }));
vi.mock("@/lib/db/client", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/contacts/contact-bulk-category-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/contacts/contact-bulk-category-service")>();
  return { ...original, evaluateContactBulkCategory: mocks.evaluate, executeContactBulkCategory: mocks.execute };
});

import { PATCH, POST } from "./route";

const evaluation = {
  mode: "apply", targetCategory: "Archiv", sourceRequestId: undefined,
  items: [{ id: "c1", customerNumber: "7001", label: "A", before: "Kunde", after: "Archiv", updatedAt: "2026-08-02T05:00:00.000Z" }, { id: "c2", customerNumber: "7002", label: "B", before: "Partner", after: "Archiv", updatedAt: "2026-08-02T05:00:00.000Z" }],
  excluded: [], checks: [], warnings: [], blockingIssues: [], fingerprint: "a".repeat(64),
};

describe("contact bulk category route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const actor = { id: "u1", role: "GESCHAEFTSFUEHRER", isActive: true };
    mocks.getDemoContext.mockResolvedValue({ organization: { id: "org-1" }, users: [actor] });
    mocks.getSessionBoundActor.mockResolvedValue({ ok: true, actor, sessionUserId: "u1" });
    mocks.evaluate.mockResolvedValue(evaluation);
    mocks.execute.mockResolvedValue({ requestId: "req-1", sourceRequestId: "req-1", count: 2 });
    mocks.transaction.mockImplementation(async (callback) => callback({}));
  });

  it("returns a read-only dry-run with exact phrase", async () => {
    const response = (await POST(new Request("http://localhost/api/contacts/bulk-category", { method: "POST", body: JSON.stringify({ actorId: "u1", mode: "apply", customerNumbers: ["7001", "7002"], targetCategory: "Archiv" }) })))!;
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ evaluation: { fingerprint: "a".repeat(64), items: [{ customerNumber: "7001" }, { customerNumber: "7002" }] }, confirmationText: "MASSENÄNDERUNG AUSFÜHREN 2 KONTAKTE" });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("rejects stale or missing confirmation before the transaction", async () => {
    const response = (await PATCH(new Request("http://localhost/api/contacts/bulk-category", { method: "PATCH", body: JSON.stringify({ actorId: "u1", mode: "apply", customerNumbers: ["7001", "7002"], targetCategory: "Archiv", expectedFingerprint: evaluation.fingerprint, confirmationText: "falsch" }) })))!;
    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("executes the exact current dry-run through the shared service", async () => {
    const response = (await PATCH(new Request("http://localhost/api/contacts/bulk-category", { method: "PATCH", body: JSON.stringify({ actorId: "u1", mode: "apply", customerNumbers: ["7001", "7002"], targetCategory: "Archiv", expectedFingerprint: evaluation.fingerprint, confirmationText: "MASSENÄNDERUNG AUSFÜHREN 2 KONTAKTE" }) })))!;
    expect(response.status).toBe(200);
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1", actorId: "u1", expectedFingerprint: evaluation.fingerprint, source: "contact-bulk-ui" }));
  });
});
