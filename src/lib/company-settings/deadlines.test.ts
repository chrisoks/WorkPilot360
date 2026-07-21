import { describe, expect, it } from "vitest";
import { normalizeDeadlineSettings } from "./deadlines";

describe("deadline settings", () => {
  it("provides safe defaults for task workload thresholds", () => {
    const settings = normalizeDeadlineSettings(undefined);

    expect(settings).toMatchObject({
      completedTaskArchiveDays: 5,
      taskEmployeeActiveLimit: 8,
      taskEmployeeOverdueLimit: 2,
      taskEmployeeStaleWorkdays: 3,
      taskWaitingFeedbackWorkdays: 7,
      taskLeadershipEscalationWorkdays: 2,
      taskLeadershipImmediateActiveLimit: 12,
      taskLeadershipImmediateOverdueLimit: 4,
      taskManagementEscalationWorkdays: 3,
      taskManagementImmediateActiveLimit: 15,
      taskManagementImmediateOverdueLimit: 6,
    });
  });

  it("keeps valid individually configured values", () => {
    const settings = normalizeDeadlineSettings({
      taskEmployeeActiveLimit: 9,
      taskEmployeeOverdueLimit: 3,
      taskEmployeeStaleWorkdays: 4,
      taskWaitingFeedbackWorkdays: 8,
      taskLeadershipEscalationWorkdays: 3,
      taskLeadershipImmediateActiveLimit: 13,
      taskLeadershipImmediateOverdueLimit: 5,
      taskManagementEscalationWorkdays: 4,
      taskManagementImmediateActiveLimit: 18,
      taskManagementImmediateOverdueLimit: 7,
    });

    expect(settings).toMatchObject({
      taskEmployeeActiveLimit: 9,
      taskEmployeeOverdueLimit: 3,
      taskEmployeeStaleWorkdays: 4,
      taskWaitingFeedbackWorkdays: 8,
      taskLeadershipEscalationWorkdays: 3,
      taskLeadershipImmediateActiveLimit: 13,
      taskLeadershipImmediateOverdueLimit: 5,
      taskManagementEscalationWorkdays: 4,
      taskManagementImmediateActiveLimit: 18,
      taskManagementImmediateOverdueLimit: 7,
    });
  });

  it("clamps invalid values and preserves the escalation hierarchy", () => {
    const settings = normalizeDeadlineSettings({
      taskEmployeeActiveLimit: 20,
      taskEmployeeOverdueLimit: 7,
      taskEmployeeStaleWorkdays: 0,
      taskWaitingFeedbackWorkdays: 999,
      taskLeadershipImmediateActiveLimit: 10,
      taskLeadershipImmediateOverdueLimit: 2,
      taskManagementImmediateActiveLimit: 5,
      taskManagementImmediateOverdueLimit: 1,
    });

    expect(settings.taskEmployeeStaleWorkdays).toBe(1);
    expect(settings.taskWaitingFeedbackWorkdays).toBe(60);
    expect(settings.taskLeadershipImmediateActiveLimit).toBe(20);
    expect(settings.taskLeadershipImmediateOverdueLimit).toBe(7);
    expect(settings.taskManagementImmediateActiveLimit).toBe(20);
    expect(settings.taskManagementImmediateOverdueLimit).toBe(7);
  });
});
