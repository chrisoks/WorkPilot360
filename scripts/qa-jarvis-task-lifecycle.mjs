import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = (process.argv.find((item) => item.startsWith("--base-url="))?.split("=")[1] || "http://localhost:3001").replace(/\/$/, "");
const secret = process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
if (!secret) throw new Error("WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET fehlt.");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const token = (sessionId) => {
  const value = `v2.${sessionId}.1`;
  return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`;
};
const requestJson = async (path, cookie, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Origin: baseUrl, Cookie: cookie, ...(init.headers || {}) },
  });
  return { response, payload: await response.json().catch(() => null) };
};
const sessionData = (id, userId, at) => ({
  id, userId, tokenVersion: 1, createdAt: at, lastSeenAt: at, lastRotatedAt: at,
  idleExpiresAt: new Date(at.getTime() + 3_600_000), absoluteExpiresAt: new Date(at.getTime() + 3_600_000),
});

async function main() {
  const actor = await prisma.user.findFirst({
    where: { role: Role.GESCHAEFTSFUEHRER, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, organizationId: true },
  });
  if (!actor) throw new Error("Kein aktiver Geschäftsführungs-Testakteur gefunden.");
  const employee = await prisma.user.findFirst({
    where: { organizationId: actor.organizationId, role: Role.MITARBEITER, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const project = await prisma.workPilotProject.findFirst({
    where: { organizationId: actor.organizationId, status: { notIn: ["Archiviert", "Gelöscht"] } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, customer: true, status: true, updatedAt: true },
  });
  if (!project) throw new Error("Kein QA-Projekt gefunden.");
  const foreignOrganization = await prisma.organization.findFirst({ where: { id: { not: actor.organizationId } }, select: { id: true } });
  const foreignOwner = foreignOrganization ? await prisma.user.findFirst({ where: { organizationId: foreignOrganization.id, isActive: true }, select: { id: true } }) : null;

  const startedAt = new Date();
  const ids = {
    task: randomUUID(), child: randomUUID(), comment: randomUUID(), participant: randomUUID(), link: randomUUID(), time: randomUUID(),
    session: randomUUID(), employeeSession: randomUUID(), foreignTask: randomUUID(),
  };
  const title = `QA JARVIS Aufgaben-Lebenszyklus ${Date.now()}`;
  const foreignTitle = `${title} fremd`;
  const draftIds = new Set();
  let result;

  await prisma.authSession.create({ data: sessionData(ids.session, actor.id, startedAt) });
  if (employee) await prisma.authSession.create({ data: sessionData(ids.employeeSession, employee.id, startedAt) });
  await prisma.task.create({ data: {
    id: ids.task, organizationId: actor.organizationId, title, description: "QA sichere Archivierung",
    status: "IN_BEARBEITUNG", priority: "NORMAL", deadline: new Date(startedAt.getTime() + 7 * 86_400_000),
    customer: project.customer || "QA Kunde", projectId: project.id, ownerId: actor.id, createdById: actor.id,
  } });
  await prisma.task.create({ data: {
    id: ids.child, organizationId: actor.organizationId, title: `${title} Folgeaufgabe`, description: "QA Folgeaufgabe",
    status: "OFFEN", priority: "NORMAL", deadline: new Date(startedAt.getTime() + 8 * 86_400_000),
    customer: project.customer || "QA Kunde", projectId: project.id, ownerId: actor.id, createdById: actor.id,
    recurrenceParentTaskId: ids.task,
  } });
  await prisma.taskComment.create({ data: { id: ids.comment, organizationId: actor.organizationId, taskId: ids.task, authorId: actor.id, body: "QA Nachweis" } });
  if (employee) await prisma.taskParticipant.create({ data: { id: ids.participant, organizationId: actor.organizationId, taskId: ids.task, userId: employee.id, acceptanceStatus: "accepted" } });
  await prisma.taskLink.create({ data: { id: ids.link, organizationId: actor.organizationId, taskId: ids.task, label: "QA Link", url: "https://example.invalid/qa" } });
  await prisma.timeEntry.create({ data: { id: ids.time, organizationId: actor.organizationId, taskId: ids.task, userId: actor.id, startedAt: new Date(startedAt.getTime() - 3_600_000), stoppedAt: startedAt, durationMinutes: 60, note: "QA Zeit" } });
  if (foreignOrganization && foreignOwner) {
    await prisma.task.create({ data: {
      id: ids.foreignTask, organizationId: foreignOrganization.id, title: foreignTitle, description: "Fremdorganisation",
      status: "OFFEN", priority: "NORMAL", deadline: new Date(startedAt.getTime() + 7 * 86_400_000), ownerId: foreignOwner.id, createdById: foreignOwner.id,
    } });
  }
  const cookie = `workpilot_session=${token(ids.session)}`;

  try {
    const createDraft = async (message, requestCookie = cookie, actorId = actor.id) => {
      const response = await requestJson("/api/jarvis/chat", requestCookie, { method: "POST", body: JSON.stringify({
        actorId, message, context: { activeTab: "dashboard", activeMainView: "dashboard" },
      }) });
      if (response.payload?.actionDraft?.previewId) draftIds.add(response.payload.actionDraft.previewId);
      return response;
    };
    const command = async (draft, commandName, phrase = "") => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, {
      method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
      body: JSON.stringify({ actorId: actor.id, actionId: "task.delete", command: commandName, revision: draft.revision, confirmationText: phrase }),
    });

    if (employee) {
      const denied = await createDraft(`Archiviere die Aufgabe „${title}“. Grund: QA Rollenprüfung.`, `workpilot_session=${token(ids.employeeSession)}`, employee.id);
      assert(denied.response.ok && denied.payload?.type === "refusal" && !denied.payload?.actionDraft, "Mitarbeiterrolle erhielt eine kritische Aufgabenaktion.");
    }
    if (foreignOrganization && foreignOwner) {
      const isolated = await createDraft(`Archiviere die Aufgabe „${foreignTitle}“. Grund: QA Mandantenprüfung.`);
      assert(isolated.response.ok && isolated.payload?.type === "refusal" && !isolated.payload?.actionDraft, "Fremdmandanten-Aufgabe war sichtbar.");
    }

    const archiveResponse = await createDraft(`Archiviere die Aufgabe „${title}“ kontrolliert. Grund: QA-Doppelanlage.`);
    assert(archiveResponse.response.ok, `Archivvorschau fehlgeschlagen: ${archiveResponse.payload?.error || archiveResponse.payload?.message || ""}`);
    const archiveDraft = archiveResponse.payload?.actionDraft;
    assert(archiveDraft?.actionId === "task.delete" && archiveDraft.lifecycleAction === "archive", "Keine task.delete-Archivvorschau.");
    assert(archiveDraft.state === "awaiting_confirmation" && archiveDraft.confirmation.enabled === true, "Archivvorschau ist nicht ausführbar.");
    assert(archiveDraft.confirmation.requiredText === `AUFGABE ARCHIVIEREN ${title}`, "Archivphrase ist falsch.");
    assert(archiveDraft.fields.some((field) => field.label === "Kommentare" && field.value === "1"), "Kommentar-Nachweis fehlt in der Vorschau.");
    assert(archiveDraft.fields.some((field) => field.label === "Zeiteinträge" && field.value === "1"), "Zeit-Nachweis fehlt in der Vorschau.");
    const wrong = await command(archiveDraft, "confirm", archiveDraft.confirmation.requiredText.toLowerCase());
    assert(wrong.response.status === 400, "Falsche Archivphrase wurde nicht abgewiesen.");
    assert((await prisma.task.findUniqueOrThrow({ where: { id: ids.task } })).status === "IN_BEARBEITUNG", "Falsche Phrase hat die Aufgabe verändert.");
    const archived = await command(archiveDraft, "confirm", archiveDraft.confirmation.requiredText);
    assert(archived.response.ok && archived.payload?.actionDraft?.state === "executed", "Archivierung wurde nicht ausgeführt.");
    const replay = await command(archiveDraft, "confirm", archiveDraft.confirmation.requiredText);
    assert(replay.response.ok && replay.payload?.actionDraft?.result?.entityId === ids.task, "Archiv-Replay ist nicht idempotent.");
    const archivedTask = await prisma.task.findUniqueOrThrow({ where: { id: ids.task } });
    assert(archivedTask.status === "ARCHIVIERT" && archivedTask.archiveReason?.includes("Vorheriger Status: IN_BEARBEITUNG"), "Statusherkunft wurde nicht dokumentiert.");

    const cancelledResponse = await createDraft(`Stelle die Aufgabe „${title}“ wieder her. Grund: QA-Abbruchprüfung.`);
    const cancelled = await command(cancelledResponse.payload.actionDraft, "cancel");
    assert(cancelled.response.ok && cancelled.payload?.actionDraft?.state === "cancelled", "Wiederherstellungsabbruch fehlt.");
    assert((await prisma.task.findUniqueOrThrow({ where: { id: ids.task } })).status === "ARCHIVIERT", "Abbruch hat die Aufgabe verändert.");
    const restoreResponse = await createDraft(`Stelle die Aufgabe „${title}“ wieder her. Grund: QA-Irrtum korrigiert.`);
    const restoreDraft = restoreResponse.payload?.actionDraft;
    assert(restoreDraft?.confirmation.requiredText === `AUFGABE WIEDERHERSTELLEN ${title}`, "Wiederherstellungsphrase ist falsch.");
    const restored = await command(restoreDraft, "confirm", restoreDraft.confirmation.requiredText);
    assert(restored.response.ok && restored.payload?.actionDraft?.state === "executed", "Wiederherstellung wurde nicht ausgeführt.");

    const [task, comments, participants, links, times, child, histories, timelines, projectAfter] = await Promise.all([
      prisma.task.findUniqueOrThrow({ where: { id: ids.task } }),
      prisma.taskComment.count({ where: { taskId: ids.task } }),
      prisma.taskParticipant.count({ where: { taskId: ids.task } }),
      prisma.taskLink.count({ where: { taskId: ids.task } }),
      prisma.timeEntry.count({ where: { taskId: ids.task } }),
      prisma.task.findUniqueOrThrow({ where: { id: ids.child } }),
      prisma.task.findUniqueOrThrow({ where: { id: ids.task }, select: { history: true } }),
      prisma.statusTimelineEntry.findMany({ where: { organizationId: actor.organizationId, entityType: "task", entityId: ids.task, startedAt: { gte: startedAt } } }),
      prisma.workPilotProject.findUniqueOrThrow({ where: { id: project.id }, select: { status: true, updatedAt: true } }),
    ]);
    const lifecycleHistory = Array.isArray(histories.history) ? histories.history.filter((item) => item?.event === "Aufgabe archiviert" || item?.event === "Aufgabe wiederhergestellt") : [];
    assert(task.status === "IN_BEARBEITUNG" && task.archiveReason === null && task.archivedAt === null, "Ursprungsstatus wurde nicht korrekt wiederhergestellt.");
    assert(comments === 1 && participants === (employee ? 1 : 0) && links === 1 && times === 1, "Verknüpfte Nachweise wurden nicht vollständig erhalten.");
    assert(child.status === "OFFEN" && child.recurrenceParentTaskId === ids.task, "Folgeaufgabe wurde verändert.");
    assert(lifecycleHistory.length === 2 && timelines.length === 2, "Historie oder Status-Timeline ist nicht exactly-once.");
    assert(projectAfter.status === project.status && projectAfter.updatedAt.toISOString() === project.updatedAt.toISOString(), "Projekt wurde verändert.");

    const physical = await requestJson("/api/tasks", cookie, { method: "DELETE", body: JSON.stringify({ id: ids.task, actorId: actor.id, permanent: true, reason: "QA" }) });
    assert(physical.response.status === 400 && physical.payload?.code === "physical_delete_disabled", "Physisches Löschen wurde nicht explizit blockiert.");
    assert(await prisma.task.count({ where: { id: ids.task } }) === 1, "Physische Löschanfrage hat die Aufgabe entfernt.");
    result = {
      baseUrl, roleBoundary: employee ? "verified" : "no-active-employee", tenantBoundary: foreignOrganization && foreignOwner ? "verified" : "single-tenant",
      wrongPhraseRejected: true, archiveSafe: true, restoreSafe: true, cancelSafe: true, replayExactlyOnce: true,
      physicalDeleteDisabled: true, evidencePreserved: { comments, participants, links, times, childTasks: 1 },
      lifecycleHistory: lifecycleHistory.length, statusTimelineEntries: timelines.length, projectUnchanged: true,
    };
  } finally {
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    await prisma.statusTimelineEntry.deleteMany({ where: { entityType: "task", entityId: { in: [ids.task, ids.child, ids.foreignTask] } } });
    await prisma.statusEscalationEvent.deleteMany({ where: { entityType: "task", entityId: { in: [ids.task, ids.child, ids.foreignTask] } } });
    await prisma.task.deleteMany({ where: { id: { in: [ids.child, ids.task, ids.foreignTask] } } });
    await prisma.authSession.deleteMany({ where: { id: { in: [ids.session, ids.employeeSession] } } });
  }
  const residue = {
    tasks: await prisma.task.count({ where: { id: { in: [ids.task, ids.child, ids.foreignTask] } } }),
    drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }),
    sessions: await prisma.authSession.count({ where: { id: { in: [ids.session, ids.employeeSession] } } }),
    timelines: await prisma.statusTimelineEntry.count({ where: { entityType: "task", entityId: { in: [ids.task, ids.child, ids.foreignTask] } } }),
  };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
