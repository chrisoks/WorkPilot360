import type { TaskEscalationStage } from "./escalation-preview";

export type TaskEscalationDeliveryUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  isActive: boolean;
};

export type TaskEscalationDeliveryEpisode = {
  id: string;
  userId: string;
  episode: number;
  observedStage: string;
  notifiedStage: string;
  leadershipRecipientId: string | null;
  leadershipRequired: boolean;
  activeCount: number;
  overdueCount: number;
  staleCount: number;
  waitingFeedbackCount: number;
  reasons: readonly string[];
  taskIds: readonly string[];
};

export type TaskEscalationDelivery = {
  episodeId: string;
  episode: number;
  stage: Exclude<TaskEscalationStage, "none">;
  recipientId: string;
  employeeId: string;
  taskId: string | null;
  subject: string;
  body: string;
};

export type TaskEscalationDeliveryPlan = {
  deliveries: TaskEscalationDelivery[];
  blockedLeadershipEpisodeIds: string[];
};

const STAGE_RANK: Record<TaskEscalationStage, number> = {
  none: 0,
  employee: 1,
  leadership: 2,
  management: 3,
};

function normalizeStage(value: string): TaskEscalationStage {
  return value === "employee" || value === "leadership" || value === "management"
    ? value
    : "none";
}

function userName(user: TaskEscalationDeliveryUser | undefined) {
  if (!user) return "Unbekannter Mitarbeiter";
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

function summaryLines(episode: TaskEscalationDeliveryEpisode) {
  const lines = [
    `Aktive Aufgaben: ${episode.activeCount}`,
    `Davon überfällig: ${episode.overdueCount}`,
    `Länger unverändert: ${episode.staleCount}`,
    `Warten auf Rückmeldung: ${episode.waitingFeedbackCount}`,
  ];
  if (episode.reasons.length > 0) lines.push(`Auslöser: ${episode.reasons.join(", ")}`);
  return lines.join("\n");
}

function messageFor(input: {
  episode: TaskEscalationDeliveryEpisode;
  stage: Exclude<TaskEscalationStage, "none">;
  employeeName: string;
}) {
  const details = summaryLines(input.episode);
  if (input.stage === "employee") {
    return {
      subject: "Aufgabenhinweis: Bitte Arbeitsbestand prüfen",
      body: `Dein Aufgabenbestand benötigt Aufmerksamkeit. Bitte prüfe Prioritäten, Fristen und nächste Schritte.\n\n${details}`,
    };
  }
  if (input.stage === "leadership") {
    return {
      subject: `Aufgabeneskalation: Unterstützung für ${input.employeeName} erforderlich`,
      body: `Der Aufgabenbestand von ${input.employeeName} benötigt Unterstützung durch die zuständige Führungskraft. Bitte prüfe Prioritäten, Blockaden und Entlastungsmöglichkeiten.\n\n${details}`,
    };
  }
  return {
    subject: `Aufgabeneskalation: Entscheidung für ${input.employeeName} erforderlich`,
    body: `Der Aufgabenbestand von ${input.employeeName} hat die Eskalationsstufe Geschäftsführung erreicht. Bitte prüfe gemeinsam mit der zuständigen Führungskraft die notwendigen Maßnahmen.\n\n${details}`,
  };
}

export function planTaskEscalationDeliveries(input: {
  episodes: readonly TaskEscalationDeliveryEpisode[];
  users: readonly TaskEscalationDeliveryUser[];
}): TaskEscalationDeliveryPlan {
  const activeUsers = new Map(
    input.users.filter((user) => user.isActive).map((user) => [user.id, user] as const)
  );
  const managementIds = input.users
    .filter((user) => user.isActive && user.role === "GESCHAEFTSFUEHRER")
    .map((user) => user.id);
  const deliveries: TaskEscalationDelivery[] = [];
  const blockedLeadershipEpisodeIds: string[] = [];

  for (const episode of input.episodes) {
    const stage = normalizeStage(episode.observedStage);
    const notifiedStage = normalizeStage(episode.notifiedStage);
    if (stage === "none" || STAGE_RANK[stage] <= STAGE_RANK[notifiedStage]) continue;

    const employee = activeUsers.get(episode.userId);
    if (!employee) continue;

    let recipientIds: string[] = [];
    if (stage === "employee") {
      recipientIds = [episode.userId];
    } else if (stage === "leadership") {
      if (!episode.leadershipRecipientId || !activeUsers.has(episode.leadershipRecipientId)) {
        if (episode.leadershipRequired) blockedLeadershipEpisodeIds.push(episode.id);
        continue;
      }
      recipientIds = [episode.leadershipRecipientId];
    } else {
      recipientIds = [
        ...(episode.leadershipRecipientId && activeUsers.has(episode.leadershipRecipientId)
          ? [episode.leadershipRecipientId]
          : []),
        ...managementIds,
      ];
    }

    const message = messageFor({ episode, stage, employeeName: userName(employee) });
    for (const recipientId of new Set(recipientIds)) {
      deliveries.push({
        episodeId: episode.id,
        episode: episode.episode,
        stage,
        recipientId,
        employeeId: episode.userId,
        taskId: episode.taskIds[0] ?? null,
        ...message,
      });
    }
  }

  return { deliveries, blockedLeadershipEpisodeIds };
}
