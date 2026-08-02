import { describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import {
  evaluateProjectTimeEntryManagement,
  executeProjectTimeEntryManagement,
  getProjectTimeEntryManagementConfirmationText,
  matchesProjectTimeEntryManagementConfirmation,
} from "@/lib/time/project-time-entry-management-service";

const manager = {
  id: "manager-1",
  firstName: "Mara",
  lastName: "Leitung",
  email: "mara@example.test",
  role: Role.FUEHRUNGSKRAFT,
  isActive: true,
};

const employee = {
  id: "employee-1",
  firstName: "Emil",
  lastName: "Arbeit",
  email: "emil@example.test",
  role: Role.MITARBEITER,
  isActive: true,
};

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    organizationId: "org-1",
    mode: "project",
    projectId: "project-1",
    projectLabel: "Projekt Eins",
    trade: "Glasreinigung",
    planningEntryId: null,
    planningBillingGroupId: null,
    offerId: "offer-1",
    offerLabel: "ANG-1 · Angebot · Gewonnen",
    billingCatalogItemId: null,
    billingCatalogItemLabel: null,
    userId: "employee-1",
    employee: "Emil Arbeit",
    entrySource: "manual",
    date: "2026-08-01",
    startTime: "08:00",
    endTime: "10:00",
    durationMs: 6_300_000n,
    pauseMs: 900_000n,
    laborCostRateSnapshot: 28,
    laborCostSnapshot: 49,
    costSnapshotAt: new Date("2026-08-01T10:00:00.000Z"),
    comment: "Fenster gereinigt",
    invoiceId: null,
    invoiceNumber: null,
    invoicedAt: null,
    marketingContentItemId: null,
    marketingContentType: null,
    completionStatus: null,
    overtimeApprovalStatus: "not_required",
    overtimeApprovedByUserId: null,
    overtimeApprovedByName: null,
    overtimeApprovedAt: null,
    editHistory: [],
    deletedAt: null,
    createdAt: new Date("2026-08-01T10:00:00.000Z"),
    ...overrides,
  };
}

function database(initial = entry(), savedUpdate?: ReturnType<typeof entry>) {
  let current: any = initial;
  const queryRaw = vi.fn(async (strings: TemplateStringsArray, ..._values: unknown[]) => {
    const sql = strings.join(" ");
    if (sql.includes('SELECT * FROM "ProjectTimeEntry"')) return current ? [current] : [];
    if (sql.includes('UPDATE "ProjectTimeEntry"') && sql.includes('"deletedAt"')) {
      current = {
        ...current!,
        deletedAt: new Date(),
        editHistory: [{ event: "Zeiteintrag gelöscht" }],
      };
      return [current];
    }
    if (sql.includes('INSERT INTO "ProjectTimeEntry"')) {
      current = savedUpdate ?? current;
      return current ? [current] : [];
    }
    if (sql.includes('FROM "EmployeeCostCalculation"')) return [];
    throw new Error(`Unerwartetes SQL: ${sql}`);
  });
  const tx = {
    $queryRaw: queryRaw,
    $executeRaw: vi.fn(async () => 1),
    workPilotProject: {
      findFirst: vi.fn(async () => ({
        id: "project-1", projectNumber: "GLR-1", title: "Projekt Eins",
        trade: "Glasreinigung", projectKind: "einmaliges Projekt", recurringBillingMode: null,
      })),
    },
    offer: {
      findFirst: vi.fn(async () => ({ id: "offer-1", offerNumber: "ANG-1", offerType: "main", status: "Gewonnen" })),
    },
    catalogItem: { findFirst: vi.fn(async () => null) },
    projectLogbookEntry: { upsert: vi.fn(async () => ({})) },
  };
  const db = {
    ...tx,
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { db, tx, getCurrent: () => current };
}

describe("project time-entry management service", () => {
  it("requires the exact case-sensitive confirmation phrase", () => {
    expect(getProjectTimeEntryManagementConfirmationText("entry-1", "update")).toBe("ZEITEINTRAG KORRIGIEREN entry-1");
    expect(getProjectTimeEntryManagementConfirmationText("entry-1", "delete")).toBe("ZEITEINTRAG LÖSCHEN entry-1");
    expect(matchesProjectTimeEntryManagementConfirmation("entry-1", "delete", "ZEITEINTRAG LÖSCHEN entry-1")).toBe(true);
    expect(matchesProjectTimeEntryManagementConfirmation("entry-1", "delete", "Zeiteintrag löschen entry-1")).toBe(false);
  });
  it("allows an employee to evaluate only their own manual entry", async () => {
    const own = database();
    await expect(
      evaluateProjectTimeEntryManagement({
        db: own.db as never,
        organizationId: "org-1",
        actor: employee,
        entryId: "entry-1",
        action: "update",
        reason: "Beginn korrigiert",
      })
    ).resolves.toMatchObject({ action: "update", fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) });

    const stamped = database(entry({ entrySource: "stamped" }));
    await expect(
      evaluateProjectTimeEntryManagement({
        db: stamped.db as never,
        organizationId: "org-1",
        actor: employee,
        entryId: "entry-1",
        action: "update",
        reason: "Beginn korrigiert",
      })
    ).rejects.toMatchObject({ code: "forbidden", status: 403 });
  });

  it("blocks invoiced entries and requires a meaningful reason", async () => {
    const invoiced = database(entry({ invoiceId: "invoice-1", invoiceNumber: "RE-10" }));
    await expect(
      evaluateProjectTimeEntryManagement({
        db: invoiced.db as never,
        organizationId: "org-1",
        actor: manager,
        entryId: "entry-1",
        action: "delete",
        reason: "Doppelt erfasst",
      })
    ).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("RE-10") });

    const valid = database();
    await expect(
      evaluateProjectTimeEntryManagement({
        db: valid.db as never,
        organizationId: "org-1",
        actor: manager,
        entryId: "entry-1",
        action: "delete",
        reason: "x",
      })
    ).rejects.toMatchObject({ code: "invalid_input", status: 400 });
  });

  it("soft-deletes exactly once under the checked fingerprint and writes server history", async () => {
    const state = database();
    const evaluation = await evaluateProjectTimeEntryManagement({
      db: state.db as never,
      organizationId: "org-1",
      actor: manager,
      entryId: "entry-1",
      action: "delete",
      reason: "Doppelt erfasst",
    });
    const result = await executeProjectTimeEntryManagement({
      db: state.db as never,
      organizationId: "org-1",
      actor: manager,
      users: [manager, employee],
      entryId: "entry-1",
      action: "delete",
      reason: evaluation.reason,
      expectedFingerprint: evaluation.fingerprint,
    });

    expect(result.deletedAt).not.toBe("");
    expect(state.tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(state.getCurrent().editHistory).toEqual([{ event: "Zeiteintrag gelöscht" }]);
  });

  it("fails closed when the entry changed after evaluation", async () => {
    const first = database();
    const evaluation = await evaluateProjectTimeEntryManagement({
      db: first.db as never,
      organizationId: "org-1",
      actor: manager,
      entryId: "entry-1",
      action: "delete",
      reason: "Doppelt erfasst",
    });
    const changed = database(entry({ comment: "Zwischenzeitlich geändert" }));
    await expect(
      executeProjectTimeEntryManagement({
        db: changed.db as never,
        organizationId: "org-1",
        actor: manager,
        users: [manager, employee],
        entryId: "entry-1",
        action: "delete",
        reason: evaluation.reason,
        expectedFingerprint: evaluation.fingerprint,
      })
    ).rejects.toMatchObject({ code: "conflict", status: 409 });
  });

  it("includes protected marketing metadata in the stale-context fingerprint", async () => {
    const first = database();
    const evaluation = await evaluateProjectTimeEntryManagement({
      db: first.db as never,
      organizationId: "org-1",
      actor: manager,
      entryId: "entry-1",
      action: "update",
      reason: "Beginn falsch erfasst",
    });
    const changed = database(entry({ marketingContentItemId: "content-2" }));
    await expect(
      executeProjectTimeEntryManagement({
        db: changed.db as never,
        organizationId: "org-1",
        actor: manager,
        users: [manager, employee],
        entryId: "entry-1",
        action: "update",
        reason: evaluation.reason,
        expectedFingerprint: evaluation.fingerprint,
        changes: { startTime: "08:15" },
      })
    ).rejects.toMatchObject({ code: "conflict", status: 409 });
  });

  it("rejects an update without an allowed field and ignores protected identity fields", async () => {
    const state = database();
    const evaluation = await evaluateProjectTimeEntryManagement({
      db: state.db as never,
      organizationId: "org-1",
      actor: manager,
      entryId: "entry-1",
      action: "update",
      reason: "Beginn falsch erfasst",
    });
    await expect(
      executeProjectTimeEntryManagement({
        db: state.db as never,
        organizationId: "org-1",
        actor: manager,
        users: [manager, employee],
        entryId: "entry-1",
        action: "update",
        reason: evaluation.reason,
        expectedFingerprint: evaluation.fingerprint,
        changes: { projectId: "foreign-project" } as never,
      })
    ).rejects.toMatchObject({ code: "invalid_input", status: 400 });
  });

  it("updates only through the managed transaction and creates server-owned history", async () => {
    const saved = entry({
      startTime: "08:15",
      durationMs: 5_400_000n,
      laborCostRateSnapshot: 28,
      laborCostSnapshot: 42,
      comment: "Korrigierter Beginn",
      editHistory: [{ event: "Zeiteintrag bearbeitet", actorUserId: "manager-1" }],
    });
    const state = database(entry(), saved);
    const evaluation = await evaluateProjectTimeEntryManagement({
      db: state.db as never,
      organizationId: "org-1",
      actor: manager,
      entryId: "entry-1",
      action: "update",
      reason: "Beginn falsch erfasst",
    });
    const result = await executeProjectTimeEntryManagement({
      db: state.db as never,
      organizationId: "org-1",
      actor: manager,
      users: [manager, employee],
      entryId: "entry-1",
      action: "update",
      reason: evaluation.reason,
      expectedFingerprint: evaluation.fingerprint,
      changes: { startTime: "08:15", comment: "Korrigierter Beginn" },
    });

    expect(result).toMatchObject({ startTime: "08:15" });
    expect(state.getCurrent().laborCostRateSnapshot).toBe(28);
    const insertCall = state.tx.$queryRaw.mock.calls.find(([strings]) =>
      strings.join(" ").includes('INSERT INTO "ProjectTimeEntry"')
    );
    expect(insertCall?.some((value) =>
      typeof value === "string" && value.includes("Zeiteintrag bearbeitet") && value.includes("manager-1")
    )).toBe(true);
  });
});
