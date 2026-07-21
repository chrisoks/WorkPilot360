import { describe, expect, it } from "vitest";
import type { TaskEscalationPreviewItem } from "./escalation-preview";
import { planTaskEscalationState, type PersistedTaskEscalationEpisode } from "./escalation-state";

function item(overrides: Partial<TaskEscalationPreviewItem> = {}): TaskEscalationPreviewItem {
  return {
    userId: "employee",
    userName: "Mia Muster",
    stage: "employee",
    activeCount: 8,
    overdueCount: 1,
    staleCount: 0,
    waitingFeedbackCount: 0,
    warningSince: "2026-07-20T08:00:00.000Z",
    leadershipDueAt: "2026-07-22T08:00:00.000Z",
    managementDueAt: "2026-07-24T08:00:00.000Z",
    leadershipRecipientId: "lead",
    leadershipRecipientName: "Lars Leitung",
    leadershipRequired: true,
    reasons: ["8 aktive Aufgaben"],
    taskIds: ["task-1"],
    ...overrides,
  };
}

function episode(overrides: Partial<PersistedTaskEscalationEpisode> = {}): PersistedTaskEscalationEpisode {
  return {
    id: "episode-1",
    userId: "employee",
    episode: 1,
    highestStage: "employee",
    observedStage: "employee",
    notifiedStage: "none",
    warningSince: new Date("2026-07-20T08:00:00.000Z"),
    leadershipDueAt: new Date("2026-07-22T08:00:00.000Z"),
    managementDueAt: new Date("2026-07-24T08:00:00.000Z"),
    leadershipRecipientId: "lead",
    leadershipRequired: true,
    resolvedAt: null,
    ...overrides,
  };
}

describe("task escalation state planning", () => {
  it("creates exactly one first episode for a new warning", () => {
    expect(planTaskEscalationState({ items: [item()], episodes: [] })).toEqual([
      expect.objectContaining({ type: "create", userId: "employee", episode: 1 }),
    ]);
  });

  it("updates an active episode instead of creating a duplicate", () => {
    expect(planTaskEscalationState({ items: [item()], episodes: [episode()] })).toEqual([
      expect.objectContaining({ type: "update", id: "episode-1", highestStage: "employee" }),
    ]);
  });

  it("keeps the highest stage reached when the current signal becomes less severe", () => {
    const operations = planTaskEscalationState({
      items: [item({ stage: "employee" })],
      episodes: [episode({ highestStage: "management", observedStage: "management" })],
    });
    expect(operations[0]).toMatchObject({ type: "update", highestStage: "management" });
  });

  it("resolves an active episode when no warning remains", () => {
    expect(planTaskEscalationState({ items: [], episodes: [episode()] })).toEqual([
      { type: "resolve", id: "episode-1", userId: "employee" },
    ]);
  });

  it("starts a new numbered episode after a resolved warning", () => {
    const operations = planTaskEscalationState({
      items: [item()],
      episodes: [episode({ resolvedAt: new Date("2026-07-20T18:00:00.000Z"), episode: 3 })],
    });
    expect(operations[0]).toMatchObject({ type: "create", episode: 4 });
  });
});

