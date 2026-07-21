import { afterEach, describe, expect, it } from "vitest";
import { isTaskEscalationAutomationEnabled } from "./task-escalation-scheduler";

const originalValue = process.env.WORKPILOT_TASK_ESCALATION_AUTOMATION_ENABLED;

afterEach(() => {
  if (originalValue === undefined) {
    delete process.env.WORKPILOT_TASK_ESCALATION_AUTOMATION_ENABLED;
  } else {
    process.env.WORKPILOT_TASK_ESCALATION_AUTOMATION_ENABLED = originalValue;
  }
});

describe("isTaskEscalationAutomationEnabled", () => {
  it("bleibt standardmäßig und bei abweichenden Werten deaktiviert", () => {
    delete process.env.WORKPILOT_TASK_ESCALATION_AUTOMATION_ENABLED;
    expect(isTaskEscalationAutomationEnabled()).toBe(false);

    process.env.WORKPILOT_TASK_ESCALATION_AUTOMATION_ENABLED = "TRUE";
    expect(isTaskEscalationAutomationEnabled()).toBe(false);
  });

  it("wird ausschließlich durch den exakten Wert true aktiviert", () => {
    process.env.WORKPILOT_TASK_ESCALATION_AUTOMATION_ENABLED = "true";
    expect(isTaskEscalationAutomationEnabled()).toBe(true);
  });
});
