import { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  evaluatePlanningEntryMove,
  getPlanningEntryMoveConfirmationText,
  matchesPlanningEntryMoveConfirmation,
  PlanningEntryMoveError,
} from "@/lib/planning/planning-entry-move-service";

const actor = {
  id: "manager-1", email: "manager@example.test", firstName: "Mara", lastName: "Plan",
  role: Role.FUEHRUNGSKRAFT, organizationId: "org-1",
};

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: "planning-1", organizationId: "org-1", source: "manual", board: "Planung", groupName: "Team",
    userId: "employee-1", employeeName: "Erika Einsatz", date: "2026-08-03", startTime: "08:00",
    endTime: "09:00", durationMinutes: 60, title: "Objektpflege", description: "Beschreibung",
    customer: "OKW", projectId: "project-1", projectLabel: "Projekt GLR-449", objectAddressId: null,
    objectAddressLabel: null, planningTrade: "Glasreinigung", billingCatalogItemId: null,
    billingCatalogItemLabel: null, billingGroupId: null, offerId: null, offerLineId: null,
    offerLabel: null, offerTotalMinutes: null, offerPlannedMinutes: null, batchId: null,
    overbookingKind: null, overbookingReason: null, marketingContentItemId: null,
    marketingContentScheduleId: null, recurrenceId: null, recurrenceRule: null,
    approvalStatus: "confirmed", requestedByUserId: null, requestedByName: null,
    approvedByUserId: "manager-1", approvedAt: new Date("2026-08-01T10:00:00Z"), deletedAt: null,
    createdAt: new Date("2026-08-01T10:00:00Z"), updatedAt: new Date("2026-08-01T10:00:00Z"),
    ...overrides,
  };
}

const user = {
  id: "employee-1", firstName: "Erika", lastName: "Einsatz", email: "erika@example.test",
  isActive: true, planningBoard: "Planung", planningGroup: "Team", planningBreakWindows: {},
};

function fakeDb(...results: unknown[]) {
  return { $queryRaw: vi.fn().mockImplementation(() => Promise.resolve(results.shift() ?? [])) };
}

describe("planning entry move service", () => {
  it("requires the exact entry-bound confirmation phrase", () => {
    expect(getPlanningEntryMoveConfirmationText(" planning-1 ")).toBe("TERMIN VERSCHIEBEN planning-1");
    expect(matchesPlanningEntryMoveConfirmation("planning-1", "TERMIN VERSCHIEBEN planning-1")).toBe(true);
    expect(matchesPlanningEntryMoveConfirmation("planning-1", "termin verschieben planning-1")).toBe(false);
    expect(matchesPlanningEntryMoveConfirmation("planning-1", "TERMIN VERSCHIEBEN planning-2")).toBe(false);
  });

  it("evaluates a single recurring appointment and reports overlap and series warnings", async () => {
    const db = fakeDb(
      [entry({ recurrenceId: "series-1", recurrenceRule: "weekly" })], [user], [], [],
      [{ id: "planning-2", title: "Kontrolle", startTime: "09:30", endTime: "10:30" }],
      [{ id: "project-1", projectNumber: "GLR-449", title: "Glasreinigung", status: "Aktiv", projectKind: "Dauerprojekt", recurringBillingMode: "hourly", timeBudgetAllocations: [], updatedAt: new Date("2026-08-01T10:00:00Z") }],
    );
    const evaluation = await evaluatePlanningEntryMove({
      db: db as never, organizationId: "org-1", actor, entryId: "planning-1",
      date: "2026-08-04", startTime: "09:00", endTime: "10:00", reason: "Kunde kann erst später", requireManagement: true,
    });
    expect(evaluation.to.durationMinutes).toBe(60);
    expect(evaluation.overbooking.required).toBe(false);
    expect(evaluation.warnings.map((warning) => warning.code)).toEqual(["single_occurrence", "overlap"]);
    expect(evaluation.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("requires a current overbooking approval for an exhausted monthly quota", async () => {
    const db = fakeDb(
      [entry()], [user], [], [], [],
      [{ id: "project-1", projectNumber: "HMS-450", title: "Hausmeister", status: "Aktiv", projectKind: "Dauerprojekt", recurringBillingMode: "flat", timeBudgetAllocations: [{ month: "2026-08", hours: 1 }], updatedAt: new Date("2026-08-01T10:00:00Z") }],
      [{ total: 30 }],
    );
    const evaluation = await evaluatePlanningEntryMove({
      db: db as never, organizationId: "org-1", actor, entryId: "planning-1",
      date: "2026-08-04", startTime: "09:00", endTime: "11:00", reason: "Zusatztermin laut Kundenauftrag", requireManagement: true,
    });
    expect(evaluation.overbooking).toMatchObject({
      required: true, kind: "monthly", availableMinutes: 30, requestedMinutes: 120, exceededMinutes: 90,
    });
    expect(evaluation.overbooking.fingerprint).toBe(evaluation.fingerprint);
  });

  it("fails closed for a non-manager in the JARVIS management path", async () => {
    const db = fakeDb([entry({ approvalStatus: "requested", requestedByUserId: "employee-1" })]);
    await expect(evaluatePlanningEntryMove({
      db: db as never, organizationId: "org-1", actor: { ...actor, id: "employee-1", role: Role.MITARBEITER },
      entryId: "planning-1", date: "2026-08-04", startTime: "09:00", endTime: "10:00",
      reason: "Persönliche Abstimmung", requireManagement: true,
    })).rejects.toMatchObject({ code: "forbidden", status: 403 } satisfies Partial<PlanningEntryMoveError>);
  });

  it("blocks a target window covered by an approved absence", async () => {
    const db = fakeDb([entry()], [user], [{ id: "absence-1" }]);
    await expect(evaluatePlanningEntryMove({
      db: db as never, organizationId: "org-1", actor, entryId: "planning-1",
      date: "2026-08-04", startTime: "09:00", endTime: "10:00", reason: "Kunde kann erst später", requireManagement: true,
    })).rejects.toMatchObject({ code: "absence_conflict", status: 409 } satisfies Partial<PlanningEntryMoveError>);
  });
});
