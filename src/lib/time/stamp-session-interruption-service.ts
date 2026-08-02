import { createHash } from "node:crypto";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { sendNotificationMailSafely } from "@/lib/mail/notifications";
import type { StampSessionStopEntry } from "@/lib/time/stamp-session-stop-service";

function clean(value: unknown, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeName(value: unknown) {
  return clean(value, 500).toLocaleLowerCase("de-DE").replace(/\s+/g, " ");
}

function userName(user: { firstName: string; lastName: string; email: string }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

function stableId(...parts: string[]) {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 32);
}

function dueAt(now: Date) {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(12, 0, 0, 0);
  return date;
}

export async function ensureStampInterruptionFollowup(input: {
  organizationId: string;
  entry: StampSessionStopEntry;
  interruptionReason: string;
  now?: Date;
}) {
  if (input.entry.mode !== "project" || input.entry.completionStatus !== "interrupted") {
    return null;
  }
  const organizationId = clean(input.organizationId, 120);
  const reason = clean(input.interruptionReason);
  if (!organizationId || !reason) throw new Error("Unterbrechungsorganisation oder -grund fehlt.");
  const [users, project] = await Promise.all([
    prisma.user.findMany({ where: { organizationId, isActive: true } }),
    prisma.workPilotProject.findFirst({ where: { organizationId, id: input.entry.projectId } }),
  ]);
  const responsible = normalizeName(project?.responsibleName);
  const owner = users.find((user) => responsible && normalizeName(userName(user)) === responsible)
    ?? users.find((user) => user.role === Role.GESCHAEFTSFUEHRER)
    ?? users.find((user) => user.role === Role.ADMIN)
    ?? users[0];
  if (!owner) throw new Error("Für die Unterbrechungsaufgabe wurde kein aktiver Verantwortlicher gefunden.");
  const excluded = new Set([owner.id, input.entry.userId].filter(Boolean));
  let participants = users.filter((user) => user.role === Role.FUEHRUNGSKRAFT && !excluded.has(user.id));
  if (!participants.length) participants = users.filter((user) => user.role === Role.GESCHAEFTSFUEHRER && !excluded.has(user.id));
  const management = users.filter((user) => user.role === Role.GESCHAEFTSFUEHRER || user.role === Role.ADMIN);
  const recipientIds = [...new Set([owner.id, ...participants.map((user) => user.id), ...management.map((user) => user.id)])];
  const projectLabel = project
    ? [project.projectNumber, project.title].filter(Boolean).join(" | ")
    : input.entry.projectLabel || input.entry.projectId;
  const marker = `Stempelung: ${input.entry.id}`;
  const description = [
    "Quelle: Unterbrochene Arbeit",
    "Eine Projektarbeit wurde als unterbrochen gestempelt.",
    `Projekt: ${projectLabel}`,
    `Mitarbeiter: ${input.entry.employee || "-"}`,
    `Datum: ${input.entry.date} ${input.entry.startTime}-${input.entry.endTime}`,
    `Kommentar: ${reason}`,
    marker,
  ].join("\n");
  const subject = "Kritisch: Unterbrochene Arbeit klären";
  const body = [
    "Eine Projektarbeit wurde als unterbrochen gestempelt und braucht aktive Klärung.",
    `Projekt: ${projectLabel}`,
    `Mitarbeiter: ${input.entry.employee || "-"}`,
    `Datum: ${input.entry.date} ${input.entry.startTime}-${input.entry.endTime}`,
    `Kommentar: ${reason}`,
    "Bitte Ursache klären, weitere Planung entscheiden und die Aufgabe erst danach abschließen.",
  ].join("\n");
  const createdNotifications: Array<{ id: string; userId: string }> = [];
  const now = input.now ?? new Date();
  const task = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`stamp-interruption:${organizationId}:${input.entry.id}`}, 0))`;
    let found = await tx.task.findFirst({ where: { organizationId, projectId: input.entry.projectId, description: { contains: marker } } });
    if (!found) {
      found = await tx.task.create({
        data: {
          id: stableId("stamp-interruption-task", organizationId, input.entry.id),
          organizationId,
          title: `Unterbrochene Arbeit klären: ${projectLabel}`,
          description,
          status: "OFFEN",
          priority: "HOCH",
          deadline: dueAt(now),
          customer: project?.customer || null,
          projectId: input.entry.projectId,
          ownerId: owner.id,
          teamId: owner.teamId,
          createdById: owner.id,
          acceptanceStatus: "accepted",
        },
      });
    }
    for (const participant of participants) {
      await tx.taskParticipant.upsert({
        where: { taskId_userId: { taskId: found.id, userId: participant.id } },
        create: { id: stableId("stamp-interruption-participant", found.id, participant.id), organizationId, taskId: found.id, userId: participant.id, acceptanceStatus: "pending" },
        update: {},
      });
    }
    for (const userId of recipientIds) {
      const id = stableId("stamp-interruption-notification", found.id, userId);
      const existing = await tx.notification.findUnique({ where: { id }, select: { id: true } });
      if (!existing) {
        await tx.notification.create({ data: { id, organizationId, taskId: found.id, userId, channel: "app", subject, body, linkTarget: "task", linkTargetId: found.id, linkLabel: "Aufgabe öffnen" } });
        createdNotifications.push({ id, userId });
      }
    }
    return found;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  for (const notification of createdNotifications) {
    await sendNotificationMailSafely({ notificationId: notification.id, userId: notification.userId, subject, body });
  }
  return { taskId: task.id, notificationCount: recipientIds.length, replayed: createdNotifications.length === 0 };
}
