import type { TaskEscalationPreviewItem, TaskEscalationStage } from "./escalation-preview";

export type PersistedTaskEscalationEpisode = {
  id: string;
  userId: string;
  episode: number;
  highestStage: string;
  observedStage: string;
  notifiedStage: string;
  warningSince: Date;
  leadershipDueAt: Date | null;
  managementDueAt: Date | null;
  leadershipRecipientId: string | null;
  leadershipRequired: boolean;
  resolvedAt: Date | null;
};

export type TaskEscalationStateOperation =
  | {
      type: "create";
      userId: string;
      episode: number;
      item: TaskEscalationPreviewItem;
    }
  | {
      type: "update";
      id: string;
      highestStage: TaskEscalationStage;
      item: TaskEscalationPreviewItem;
    }
  | {
      type: "resolve";
      id: string;
      userId: string;
    };

const STAGE_RANK: Record<TaskEscalationStage, number> = {
  none: 0,
  employee: 1,
  leadership: 2,
  management: 3,
};

function normalizedStage(value: string): TaskEscalationStage {
  return value === "employee" || value === "leadership" || value === "management"
    ? value
    : "none";
}

function higherStage(left: string, right: TaskEscalationStage) {
  const normalizedLeft = normalizedStage(left);
  return STAGE_RANK[right] > STAGE_RANK[normalizedLeft] ? right : normalizedLeft;
}

export function planTaskEscalationState(input: {
  items: readonly TaskEscalationPreviewItem[];
  episodes: readonly PersistedTaskEscalationEpisode[];
}) {
  const activeByUser = new Map(
    input.episodes
      .filter((episode) => !episode.resolvedAt)
      .map((episode) => [episode.userId, episode] as const)
  );
  const latestEpisodeByUser = new Map<string, number>();
  for (const episode of input.episodes) {
    latestEpisodeByUser.set(
      episode.userId,
      Math.max(latestEpisodeByUser.get(episode.userId) ?? 0, episode.episode)
    );
  }

  const operations: TaskEscalationStateOperation[] = [];
  const observedUsers = new Set<string>();

  for (const item of input.items) {
    if (item.stage === "none" || !item.warningSince) continue;
    observedUsers.add(item.userId);
    const activeEpisode = activeByUser.get(item.userId);
    if (!activeEpisode) {
      operations.push({
        type: "create",
        userId: item.userId,
        episode: (latestEpisodeByUser.get(item.userId) ?? 0) + 1,
        item,
      });
      continue;
    }

    operations.push({
      type: "update",
      id: activeEpisode.id,
      highestStage: higherStage(activeEpisode.highestStage, item.stage),
      item,
    });
  }

  for (const episode of activeByUser.values()) {
    if (!observedUsers.has(episode.userId)) {
      operations.push({ type: "resolve", id: episode.id, userId: episode.userId });
    }
  }

  return operations;
}

