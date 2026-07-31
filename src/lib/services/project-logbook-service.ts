import { randomUUID } from "node:crypto";
import { Prisma, Role } from "@prisma/client";
import {
  canArchiveProjects,
  canCreateProjectLogbookEntries,
} from "@/lib/permissions";

type ProjectLogbookTransaction = Prisma.TransactionClient;

export type ProjectLogbookAuthority = {
  id: string;
  role: Role;
};

export type CreateProjectLogbookEntryInput = {
  organizationId: string;
  projectId: string;
  authority: ProjectLogbookAuthority[];
  authorUserId: string;
  title: string;
  body: string;
  colleague?: string;
  visibleFor?: string[];
  attachments?: Prisma.InputJsonValue;
  projectMonth?: string;
  createdAt?: Date;
  source?: string;
  callReference?: string;
  confirmedByUserId?: string;
  confirmedByName?: string;
  confirmationTimestamp?: Date;
  id?: string;
};

export class ProjectLogbookServiceError extends Error {
  constructor(
    public readonly code:
      | "actor_stale"
      | "forbidden"
      | "project_not_found"
      | "project_archived"
      | "invalid_input",
    message: string
  ) {
    super(message);
    this.name = "ProjectLogbookServiceError";
  }
}

function isArchivedStatus(status: string) {
  return status.trim().toLocaleLowerCase("de-DE").includes("archiviert");
}

function actorName(actor: {
  firstName: string;
  lastName: string;
  email: string;
}) {
  return `${actor.firstName} ${actor.lastName}`.trim() || actor.email;
}

export async function createProjectLogbookEntry(
  tx: ProjectLogbookTransaction,
  input: CreateProjectLogbookEntryInput
) {
  const title = input.title.trim().slice(0, 240) || "Eintrag";
  const body = input.body.trim().slice(0, 12_000);
  if (!input.organizationId || !input.projectId || !body) {
    throw new ProjectLogbookServiceError(
      "invalid_input",
      "Projekt und Logbuchtext müssen vollständig angegeben sein."
    );
  }
  const authorityIds = [...new Set(input.authority.map((actor) => actor.id))];
  if (!authorityIds.length || !authorityIds.includes(input.authorUserId)) {
    throw new ProjectLogbookServiceError(
      "forbidden",
      "Der schreibende Benutzer ist nicht eindeutig autorisiert."
    );
  }

  const [actors, project] = await Promise.all([
    tx.user.findMany({
      where: {
        id: { in: authorityIds },
        organizationId: input.organizationId,
        isActive: true,
      },
      select: {
        id: true,
        role: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    }),
    tx.workPilotProject.findFirst({
      where: {
        id: input.projectId,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
        status: true,
        projectNumber: true,
        title: true,
      },
    }),
  ]);

  if (
    actors.length !== authorityIds.length ||
    input.authority.some(
      (authority) =>
        actors.find((actor) => actor.id === authority.id)?.role !==
        authority.role
    )
  ) {
    throw new ProjectLogbookServiceError(
      "actor_stale",
      "Mindestens eine gebundene Identität ist nicht mehr aktiv oder ihre Rolle hat sich geändert."
    );
  }
  if (
    actors.some((actor) => !canCreateProjectLogbookEntries(actor))
  ) {
    throw new ProjectLogbookServiceError(
      "forbidden",
      "Die aktuelle Rollenkombination darf keine Projektlogbuch-Einträge erstellen."
    );
  }
  if (!project) {
    throw new ProjectLogbookServiceError(
      "project_not_found",
      "Das Projekt wurde nicht gefunden."
    );
  }
  if (
    isArchivedStatus(project.status) &&
    actors.some((actor) => !canArchiveProjects(actor))
  ) {
    throw new ProjectLogbookServiceError(
      "project_archived",
      "Das archivierte Projekt darf mit der aktuellen Rollenkombination nicht verändert werden."
    );
  }

  const author = actors.find((actor) => actor.id === input.authorUserId);
  if (!author) {
    throw new ProjectLogbookServiceError(
      "actor_stale",
      "Der schreibende Benutzer ist nicht mehr aktiv."
    );
  }
  const confirmer = input.confirmedByUserId
    ? actors.find((actor) => actor.id === input.confirmedByUserId)
    : null;

  const entry = await tx.projectLogbookEntry.create({
    data: {
      id: input.id || randomUUID(),
      organizationId: input.organizationId,
      projectId: project.id,
      title,
      body,
      author: actorName(author),
      authorUserId: author.id,
      colleague: input.colleague?.trim().slice(0, 240) || null,
      visibleFor: input.visibleFor ?? [],
      attachments: input.attachments ?? [],
      projectMonth: input.projectMonth?.trim().slice(0, 7) || null,
      source: input.source?.trim().slice(0, 80) || "manual",
      callReference: input.callReference?.trim().slice(0, 180) || null,
      confirmedByUserId:
        input.confirmedByUserId?.trim().slice(0, 120) || null,
      confirmedByName:
        input.confirmedByName?.trim().slice(0, 240) ||
        (confirmer ? actorName(confirmer) : null),
      confirmationTimestamp: input.confirmationTimestamp ?? null,
      createdAt: input.createdAt ?? new Date(),
    },
  });

  return {
    entry,
    project: {
      id: project.id,
      label:
        [project.projectNumber, project.title].filter(Boolean).join(" · ") ||
        "Projekt",
    },
  };
}
