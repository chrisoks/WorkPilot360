import { describe, expect, it } from "vitest";
import {
  planTaskEscalationDeliveries,
  type TaskEscalationDeliveryEpisode,
  type TaskEscalationDeliveryUser,
} from "./escalation-delivery";

const users: TaskEscalationDeliveryUser[] = [
  {
    id: "employee",
    firstName: "Mia",
    lastName: "Muster",
    email: "mia@example.test",
    role: "MITARBEITER",
    isActive: true,
  },
  {
    id: "lead",
    firstName: "Lars",
    lastName: "Leitung",
    email: "lars@example.test",
    role: "FUEHRUNGSKRAFT",
    isActive: true,
  },
  {
    id: "management",
    firstName: "Gina",
    lastName: "Geschäftsführung",
    email: "gina@example.test",
    role: "GESCHAEFTSFUEHRER",
    isActive: true,
  },
];

function episode(
  overrides: Partial<TaskEscalationDeliveryEpisode> = {}
): TaskEscalationDeliveryEpisode {
  return {
    id: "episode-1",
    userId: "employee",
    episode: 1,
    observedStage: "employee",
    notifiedStage: "none",
    leadershipRecipientId: "lead",
    leadershipRequired: true,
    activeCount: 8,
    overdueCount: 2,
    staleCount: 1,
    waitingFeedbackCount: 0,
    reasons: ["8 aktive Aufgaben", "2 überfällige Aufgaben"],
    taskIds: ["task-1", "task-2"],
    ...overrides,
  };
}

describe("task escalation delivery planning", () => {
  it("warns the employee first", () => {
    const result = planTaskEscalationDeliveries({ episodes: [episode()], users });
    expect(result.deliveries).toEqual([
      expect.objectContaining({
        stage: "employee",
        recipientId: "employee",
        taskId: "task-1",
      }),
    ]);
  });

  it("sends the leadership stage only to the assigned leader", () => {
    const result = planTaskEscalationDeliveries({
      episodes: [episode({ observedStage: "leadership", notifiedStage: "employee" })],
      users,
    });
    expect(result.deliveries.map((delivery) => delivery.recipientId)).toEqual(["lead"]);
  });

  it("includes the responsible leader and all management users at management stage", () => {
    const result = planTaskEscalationDeliveries({
      episodes: [episode({ observedStage: "management", notifiedStage: "leadership" })],
      users: [...users, { ...users[2], id: "management-2", email: "gf2@example.test" }],
    });
    expect(result.deliveries.map((delivery) => delivery.recipientId)).toEqual([
      "lead",
      "management",
      "management-2",
    ]);
  });

  it("does not plan a stage that was already notified", () => {
    const result = planTaskEscalationDeliveries({
      episodes: [episode({ notifiedStage: "employee" })],
      users,
    });
    expect(result.deliveries).toEqual([]);
  });

  it("blocks leadership delivery when the required assignment is missing", () => {
    const result = planTaskEscalationDeliveries({
      episodes: [episode({ observedStage: "leadership", leadershipRecipientId: null })],
      users,
    });
    expect(result.deliveries).toEqual([]);
    expect(result.blockedLeadershipEpisodeIds).toEqual(["episode-1"]);
  });
});
