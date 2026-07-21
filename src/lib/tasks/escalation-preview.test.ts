import { describe, expect, it } from "vitest";
import { normalizeDeadlineSettings } from "@/lib/company-settings/deadlines";
import { evaluateTaskEscalationPreview } from "./escalation-preview";

const now = new Date("2026-07-21T12:00:00.000Z");
const users = [
  {
    id: "employee",
    firstName: "Mia",
    lastName: "Muster",
    email: "mia@example.test",
    role: "MITARBEITER",
    isActive: true,
    leadershipManagerId: "lead",
    leadershipDeputyId: null,
  },
  {
    id: "lead",
    firstName: "Lars",
    lastName: "Leitung",
    email: "lars@example.test",
    role: "FUEHRUNGSKRAFT",
    isActive: true,
    leadershipManagerId: null,
    leadershipDeputyId: null,
  },
];

function task(id: string, overrides: Partial<{
  status: string;
  deadline: Date;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id,
    title: `Aufgabe ${id}`,
    status: overrides.status ?? "OFFEN",
    ownerId: "employee",
    deadline: overrides.deadline ?? new Date("2026-07-30T12:00:00.000Z"),
    createdAt: overrides.createdAt ?? new Date("2026-07-20T12:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-07-20T12:00:00.000Z"),
  };
}

describe("task escalation preview", () => {
  it("does not report employees below every threshold", () => {
    const result = evaluateTaskEscalationPreview({
      tasks: [task("1")],
      users,
      settings: normalizeDeadlineSettings(undefined),
      now,
    });
    expect(result).toEqual([]);
  });

  it("reports the employee stage and assigned leadership without side effects", () => {
    const settings = normalizeDeadlineSettings({
      taskEmployeeActiveLimit: 2,
      taskLeadershipEscalationWorkdays: 5,
    });
    const result = evaluateTaskEscalationPreview({
      tasks: [task("1"), task("2")],
      users,
      settings,
      now,
    });
    expect(result[0]).toMatchObject({
      userId: "employee",
      stage: "employee",
      activeCount: 2,
      leadershipRecipientId: "lead",
      leadershipRecipientName: "Lars Leitung",
    });
  });

  it("raises the management stage at its immediate overdue threshold", () => {
    const settings = normalizeDeadlineSettings({
      taskEmployeeOverdueLimit: 1,
      taskLeadershipImmediateOverdueLimit: 2,
      taskManagementImmediateOverdueLimit: 3,
    });
    const overdue = {
      deadline: new Date("2026-07-01T12:00:00.000Z"),
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
      updatedAt: new Date("2026-07-20T12:00:00.000Z"),
    };
    const result = evaluateTaskEscalationPreview({
      tasks: [task("1", overdue), task("2", overdue), task("3", overdue)],
      users,
      settings,
      now,
    });
    expect(result[0]).toMatchObject({ stage: "management", overdueCount: 3 });
  });

  it("ignores completed and archived tasks", () => {
    const settings = normalizeDeadlineSettings({ taskEmployeeActiveLimit: 1 });
    const result = evaluateTaskEscalationPreview({
      tasks: [task("1", { status: "ERLEDIGT" }), task("2", { status: "ARCHIVIERT" })],
      users,
      settings,
      now,
    });
    expect(result).toEqual([]);
  });

  it("does not require a leadership assignment for management users", () => {
    const managementUser = {
      ...users[0],
      id: "management",
      role: "GESCHAEFTSFUEHRER",
      leadershipManagerId: null,
    };
    const settings = normalizeDeadlineSettings({ taskEmployeeActiveLimit: 1 });
    const result = evaluateTaskEscalationPreview({
      tasks: [{ ...task("1"), ownerId: managementUser.id }],
      users: [managementUser],
      settings,
      now,
    });
    expect(result[0]).toMatchObject({
      userId: managementUser.id,
      leadershipRequired: false,
      leadershipRecipientId: null,
    });
  });
});
