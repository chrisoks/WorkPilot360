import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  ensureTable: vi.fn(),
  saveEntry: vi.fn(),
  attachStoredEntry: vi.fn(),
  getContext: vi.fn(),
  getActor: vi.fn(),
}));

vi.mock("@/lib/demo/context", () => ({
  getDemoContext: mocks.getContext,
}));
vi.mock("@/lib/db/client", () => ({ prisma: {} }));
vi.mock("@/lib/auth/actor", () => ({
  getSessionBoundActor: mocks.getActor,
  sessionBoundActorResponse: vi.fn(),
}));
vi.mock("@/lib/permissions", () => ({
  canManageProjectTimeEntries: vi.fn(() => true),
  canViewInternalCostData: vi.fn(() => true),
}));
vi.mock("@/lib/time/project-time-entry-service", () => ({
  ensureProjectTimeEntryTable: mocks.ensureTable,
  ProjectTimeEntryServiceError: class ProjectTimeEntryServiceError extends Error {},
  saveProjectTimeEntry: mocks.saveEntry,
}));
vi.mock("@/lib/time/project-time-entry-management-service", () => ({
  evaluateProjectTimeEntryManagement: vi.fn(),
  executeProjectTimeEntryManagement: vi.fn(),
}));
vi.mock("@/lib/time/stamp-session-billing-service", () => ({
  attachStoredProjectTimeEntryToHourlyInvoiceDraft: mocks.attachStoredEntry,
}));

import { POST } from "./route";

const actor = {
  id: "manager-1",
  firstName: "Mara",
  lastName: "Leitung",
  email: "mara@example.test",
  role: Role.FUEHRUNGSKRAFT,
  isActive: true,
};

function savedEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "manual-time-1",
    mode: "project",
    projectId: "project-1",
    projectLabel: "OBJ-449 | Objektbetreuung",
    trade: "Grünpflege",
    billingCatalogItemId: "catalog-1",
    billingCatalogItemLabel: "OKI0204 | Grünpflege: Rasenpflege",
    userId: "employee-1",
    employee: "Mert Tozkular",
    entrySource: "manual",
    date: "2026-08-06",
    startTime: "08:00",
    endTime: "16:00",
    durationMs: 27_000_000,
    pauseMs: 1_800_000,
    comment: "Manuell hinzugefügt",
    invoiceId: "",
    invoiceNumber: "",
    ...overrides,
  };
}

function request() {
  return new Request("http://localhost/api/project-time-entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "manual-time-1",
      entrySource: "manual",
      actorUserId: actor.id,
    }),
  });
}

describe("manual hourly project time billing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getContext.mockResolvedValue({
      organization: { id: "org-1" },
      users: [actor],
    });
    mocks.getActor.mockResolvedValue({ ok: true, actor });
    mocks.saveEntry.mockResolvedValue(savedEntry());
  });

  it("adds a manual hourly entry to the protected monthly draft workflow", async () => {
    mocks.attachStoredEntry.mockResolvedValue({
      invoiceId: "invoice-1",
      invoiceNumber: "RE-10125",
      replayed: false,
    });

    const response = await POST(request());
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.attachStoredEntry).toHaveBeenCalledWith({
      organizationId: "org-1",
      entryId: "manual-time-1",
    });
    expect(result).toMatchObject({
      id: "manual-time-1",
      invoiceId: "invoice-1",
      invoiceNumber: "RE-10125",
      billingAutomation: {
        status: "attached",
        invoiceId: "invoice-1",
        invoiceNumber: "RE-10125",
      },
    });
  });

  it("keeps the saved time and reports a visible warning if draft attachment fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.attachStoredEntry.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(request());
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.id).toBe("manual-time-1");
    expect(result.billingAutomation).toEqual({
      status: "failed",
      message:
        "Der manuelle Zeiteintrag wurde gespeichert, konnte aber keinem Rechnungsentwurf zugeordnet werden. Bitte die Abrechnung prüfen.",
    });
  });

  it("does not start hourly billing for ordinary manual project time", async () => {
    mocks.saveEntry.mockResolvedValue(
      savedEntry({ billingCatalogItemId: "", billingCatalogItemLabel: "" })
    );

    const response = await POST(request());
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.attachStoredEntry).not.toHaveBeenCalled();
    expect(result.billingAutomation).toBeNull();
  });
});
