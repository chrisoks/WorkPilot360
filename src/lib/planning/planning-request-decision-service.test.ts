import { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  evaluatePlanningRequestDecision,
  getPlanningRequestDecisionConfirmationText,
  matchesPlanningRequestDecisionConfirmation,
  type PlanningRequestDecisionError,
} from "@/lib/planning/planning-request-decision-service";

const actor = {
  id: "manager-1",
  email: "manager@example.test",
  firstName: "Mara",
  lastName: "Plan",
  role: Role.FUEHRUNGSKRAFT,
  organizationId: "org-1",
};

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: "request-1",
    organizationId: "org-1",
    board: "OK immocare",
    groupName: "Hausmeisterservice",
    userId: "employee-1",
    employeeName: "Erika Einsatz",
    date: "2026-08-05",
    startTime: "08:00",
    endTime: "09:00",
    durationMinutes: 60,
    title: "Objektkontrolle",
    description: "Kontrollgang",
    projectId: "project-1",
    projectLabel: "HMS-450 | Objektbetreuung",
    approvalStatus: "requested",
    requestedByUserId: "employee-1",
    requestedByName: "Erika Einsatz",
    approvedByUserId: null,
    approvedAt: null,
    recurrenceId: null,
    recurrenceRule: null,
    deletedAt: null,
    createdAt: new Date("2026-08-01T10:00:00Z"),
    updatedAt: new Date("2026-08-01T10:00:00Z"),
    ...overrides,
  };
}

const assignee = {
  id: "employee-1",
  firstName: "Erika",
  lastName: "Einsatz",
  email: "erika@example.test",
  isActive: true,
};

const project = {
  id: "project-1",
  projectNumber: "HMS-450",
  title: "Objektbetreuung",
  status: "Umsetzung",
  updatedAt: new Date("2026-08-01T10:00:00Z"),
};

function fakeDb(...results: unknown[]) {
  return { $queryRaw: vi.fn().mockImplementation(() => Promise.resolve(results.shift() ?? [])) };
}

describe("planning request decision service", () => {
  it("binds approval, rejection and cancellation to exact entry-specific phrases", () => {
    expect(getPlanningRequestDecisionConfirmationText(" request-1 ", "approve")).toBe("TERMINWUNSCH FREIGEBEN request-1");
    expect(getPlanningRequestDecisionConfirmationText("request-1", "reject")).toBe("TERMINWUNSCH ABLEHNEN request-1");
    expect(getPlanningRequestDecisionConfirmationText("request-1", "cancel")).toBe("TERMIN ABSAGEN request-1");
    expect(matchesPlanningRequestDecisionConfirmation("request-1", "approve", "TERMINWUNSCH FREIGEBEN request-1")).toBe(true);
    expect(matchesPlanningRequestDecisionConfirmation("request-1", "approve", "terminwunsch freigeben request-1")).toBe(false);
  });

  it("evaluates cancellation of one confirmed recurring appointment with a bound reason", async () => {
    const db = fakeDb(
      [entry({ approvalStatus: "confirmed", recurrenceId: "series-1", recurrenceRule: "weekly" })],
      [assignee],
      [project],
    );
    const evaluation = await evaluatePlanningRequestDecision({
      db: db as never,
      organizationId: "org-1",
      actor,
      entryId: "request-1",
      decision: "cancel",
      reason: "Kundentermin wurde abgesagt",
    });
    expect(evaluation).toMatchObject({
      decision: "cancel",
      reason: "Kundentermin wurde abgesagt",
      entry: { approvalStatus: "confirmed" },
      warnings: [{ code: "single_occurrence" }],
    });
    expect(evaluation.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("requires a reason and a confirmed entry for cancellation", async () => {
    await expect(evaluatePlanningRequestDecision({
      db: fakeDb() as never,
      organizationId: "org-1",
      actor,
      entryId: "request-1",
      decision: "cancel",
      reason: "",
    })).rejects.toMatchObject({ code: "reason_required", status: 400 } satisfies Partial<PlanningRequestDecisionError>);
    await expect(evaluatePlanningRequestDecision({
      db: fakeDb([entry()]) as never,
      organizationId: "org-1",
      actor,
      entryId: "request-1",
      decision: "cancel",
      reason: "Kunde hat abgesagt",
    })).rejects.toMatchObject({ code: "not_confirmed", status: 409 } satisfies Partial<PlanningRequestDecisionError>);
  });

  it("evaluates an approvable recurring request without changing its series context", async () => {
    const db = fakeDb(
      [entry({ recurrenceId: "series-1", recurrenceRule: "weekly" })],
      [assignee],
      [project],
      [],
      [],
    );
    const evaluation = await evaluatePlanningRequestDecision({
      db: db as never,
      organizationId: "org-1",
      actor,
      entryId: "request-1",
      decision: "approve",
    });
    expect(evaluation.entry.employee).toBe("Erika Einsatz");
    expect(evaluation.warnings.map((item) => item.code)).toEqual(["single_occurrence"]);
    expect(evaluation.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("requires a reason for rejection", async () => {
    const db = fakeDb();
    await expect(evaluatePlanningRequestDecision({
      db: db as never,
      organizationId: "org-1",
      actor,
      entryId: "request-1",
      decision: "reject",
      reason: "",
    })).rejects.toMatchObject({ code: "reason_required", status: 400 } satisfies Partial<PlanningRequestDecisionError>);
  });

  it("fails closed for employees", async () => {
    const db = fakeDb();
    await expect(evaluatePlanningRequestDecision({
      db: db as never,
      organizationId: "org-1",
      actor: { ...actor, role: Role.MITARBEITER },
      entryId: "request-1",
      decision: "approve",
    })).rejects.toMatchObject({ code: "forbidden", status: 403 } satisfies Partial<PlanningRequestDecisionError>);
  });

  it("blocks approval when an approved absence covers the request", async () => {
    const db = fakeDb([entry()], [assignee], [project], [{ id: "absence-1" }]);
    await expect(evaluatePlanningRequestDecision({
      db: db as never,
      organizationId: "org-1",
      actor,
      entryId: "request-1",
      decision: "approve",
    })).rejects.toMatchObject({ code: "absence_conflict", status: 409 } satisfies Partial<PlanningRequestDecisionError>);
  });
});
