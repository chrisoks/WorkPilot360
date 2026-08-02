import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = (process.argv.find((item) => item.startsWith("--base-url="))?.split("=")[1] || "http://localhost:3001").replace(/\/$/, "");
const secret = process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
if (!secret) throw new Error("WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET fehlt.");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const token = (sessionId) => { const value = `v2.${sessionId}.1`; return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`; };
const sessionData = (id, userId, at) => ({ id, userId, tokenVersion: 1, createdAt: at, lastSeenAt: at, lastRotatedAt: at, idleExpiresAt: new Date(at.getTime() + 3_600_000), absoluteExpiresAt: new Date(at.getTime() + 3_600_000) });
const requestJson = async (path, cookie, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", Origin: baseUrl, Cookie: cookie, ...(init.headers || {}) } });
  return { response, payload: await response.json().catch(() => null) };
};

async function main() {
  const actor = await prisma.user.findFirst({ where: { role: Role.GESCHAEFTSFUEHRER, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, organizationId: true } });
  if (!actor) throw new Error("Kein aktiver Geschäftsführungs-Testakteur gefunden.");
  const employee = await prisma.user.findFirst({ where: { organizationId: actor.organizationId, role: Role.MITARBEITER, isActive: true, OR: [{ salesRoleEnabled: false }, { salesRoleEnabled: null }] }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const foreignOrganization = await prisma.organization.findFirst({ where: { id: { not: actor.organizationId } }, select: { id: true } });
  const now = new Date();
  const suffix = Date.now().toString().slice(-9);
  const ids = { project: randomUUID(), blockedProject: randomUUID(), foreignProject: randomUUID(), session: randomUUID(), employeeSession: randomUUID(), offer: randomUUID(), invoice: randomUUID(), file: randomUUID(), task: randomUUID(), stamp: randomUUID(), planning: randomUUID() };
  const projectNumber = `QPA-${suffix}`;
  const blockedNumber = `QPB-${suffix}`;
  const foreignNumber = `QPF-${suffix}`;
  const draftIds = new Set();
  let result;

  await prisma.workPilotProject.createMany({ data: [
    { id: ids.project, organizationId: actor.organizationId, projectNumber, title: "QA JARVIS Projektarchiv", customer: "QA Kunde", status: "Abgeschlossen", description: "Unveränderlicher QA-Fachinhalt", projectType: "Glasreinigung", projectKind: "Einmalprojekt", responsibleName: "QA Verantwortung", source: "qa-jarvis-project-lifecycle", address: "QA Straße 1, 74722 Buchen" },
    { id: ids.blockedProject, organizationId: actor.organizationId, projectNumber: blockedNumber, title: "QA blockierte Archivierung", customer: "QA Kunde", status: "Umsetzung", projectType: "Glasreinigung", projectKind: "Einmalprojekt", source: "qa-jarvis-project-lifecycle" },
  ] });
  if (foreignOrganization) await prisma.workPilotProject.create({ data: { id: ids.foreignProject, organizationId: foreignOrganization.id, projectNumber: foreignNumber, title: "QA Fremdmandant Archiv", customer: "Fremdkunde", status: "Abgeschlossen", projectType: "Glasreinigung", projectKind: "Einmalprojekt", source: "qa-jarvis-project-lifecycle" } });
  await prisma.offer.create({ data: { id: ids.offer, organizationId: actor.organizationId, projectId: ids.project, projectNumber, projectTitle: "QA JARVIS Projektarchiv", offerNumber: `QA-ANG-${suffix}`, status: "Angenommen", customerName: "QA Kunde", netTotal: 100, grossTotal: 119 } });
  await prisma.invoice.create({ data: { id: ids.invoice, organizationId: actor.organizationId, projectId: ids.project, projectNumber, projectTitle: "QA JARVIS Projektarchiv", invoiceNumber: `QA-RE-${suffix}`, status: "Bezahlt", customerName: "QA Kunde", netTotal: 100, grossTotal: 119, isPaid: true, paidAt: now } });
  await prisma.storedFile.create({ data: { id: ids.file, organizationId: actor.organizationId, storageProvider: "qa", storageBucket: "qa", objectKey: `qa/${ids.file}`, ownerType: "project", ownerId: ids.project, sourceType: "qa", sourceEntityId: ids.file, category: "QA", originalName: "qa.txt", contentType: "text/plain", sizeBytes: 2, sha256: "0".repeat(64), status: "available", createdByUserId: actor.id, availableAt: now } });
  await prisma.task.create({ data: { id: ids.task, organizationId: actor.organizationId, title: "QA offene Aufgabe", description: "Blockiert Archivierung", status: "OFFEN", priority: "NORMAL", deadline: new Date(now.getTime() + 86_400_000), projectId: ids.blockedProject, ownerId: actor.id, createdById: actor.id } });
  await prisma.planningEntry.create({ data: { id: ids.planning, organizationId: actor.organizationId, board: "OK solutions", groupName: "QA", userId: actor.id, date: new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10), startTime: "09:00", endTime: "10:00", durationMinutes: 60, title: "QA zukünftige Planung", projectId: ids.blockedProject, approvalStatus: "confirmed" } });
  await prisma.activeStampSession.create({ data: { id: ids.stamp, organizationId: actor.organizationId, userId: actor.id, mode: "project", projectId: ids.blockedProject, startedAt: now } });
  await prisma.authSession.create({ data: sessionData(ids.session, actor.id, now) });
  if (employee) await prisma.authSession.create({ data: sessionData(ids.employeeSession, employee.id, now) });
  const cookie = `workpilot_session=${token(ids.session)}`;

  try {
    const createDraft = async (message, requestCookie = cookie, actorId = actor.id) => {
      const response = await requestJson("/api/jarvis/chat", requestCookie, { method: "POST", body: JSON.stringify({ actorId, message, context: { activeTab: "dashboard", activeMainView: "dashboard" } }) });
      if (response.payload?.actionDraft?.previewId) draftIds.add(response.payload.actionDraft.previewId);
      return response;
    };
    const command = async (draft, name, phrase = "") => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, { method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" }, body: JSON.stringify({ actorId: actor.id, actionId: "project.archive", command: name, revision: draft.revision, confirmationText: phrase }) });

    if (employee) {
      const denied = await createDraft(`Archiviere Projekt ${projectNumber}. Grund: QA Rollenprüfung.`, `workpilot_session=${token(ids.employeeSession)}`, employee.id);
      assert(denied.response.ok && !denied.payload?.actionDraft, `Mitarbeiterrolle erhielt Archivierungsaktion: ${JSON.stringify(denied.payload)}`);
    }
    if (foreignOrganization) {
      const isolated = await createDraft(`Archiviere Projekt ${foreignNumber}. Grund: QA Mandantenprüfung.`);
      assert(isolated.response.ok && isolated.payload?.type === "refusal" && !isolated.payload?.actionDraft, "Fremdmandanten-Projekt war sichtbar.");
    }

    const blocked = await createDraft(`Archiviere Projekt ${blockedNumber}. Grund: QA Blockerprüfung.`);
    assert(blocked.payload?.actionDraft?.actionId === "project.archive" && blocked.payload.actionDraft.state === "awaiting_input", "Blockierte Archivierung erzeugte keine Prüfkarte.");
    const blockedText = blocked.payload.actionDraft.blockingIssues?.join(" ") || "";
    assert(blockedText.includes("Stempelung") && blockedText.includes("Planung") && blockedText.includes("Aufgabe"), "Kritische Beziehungen wurden nicht fail-closed blockiert.");

    const cancellableResponse = await createDraft(`Archiviere Projekt ${projectNumber}. Grund: QA Abbruchprüfung.`);
    const cancellable = cancellableResponse.payload?.actionDraft;
    assert(cancellable?.actionId === "project.archive", "Keine Abbruchvorschau erzeugt.");
    assert((await command(cancellable, "cancel")).payload?.actionDraft?.state === "cancelled", "Abbruch fehlgeschlagen.");
    assert((await prisma.workPilotProject.findUniqueOrThrow({ where: { id: ids.project } })).status === "Abgeschlossen", "Abbruch hat Projekt verändert.");

    const prepared = await createDraft(`Archiviere Projekt ${projectNumber}. Grund: Auftrag abgeschlossen und revisionssicher geprüft.`);
    const archiveDraft = prepared.payload?.actionDraft;
    assert(archiveDraft?.actionId === "project.archive" && archiveDraft.state === "awaiting_confirmation" && archiveDraft.confirmation?.enabled && !archiveDraft.blockingIssues?.length, `Archivierungsvorschau nicht bereit: ${JSON.stringify(prepared.payload)}`);
    assert(archiveDraft.confirmation.requiredText === `PROJEKT ARCHIVIEREN ${projectNumber}`, "Archivierungsphrase falsch.");
    for (const label of ["Projekt", "Aktueller Status", "Zielstatus", "Grund", "Angebote", "Rechnungen", "Planungen", "Projektzeiten", "Laufende Stempelungen", "Offene Aufgaben", "Dateien", "Online-Anfragen"]) assert(archiveDraft.fields?.some((field) => field.label === label), `Vorschaufeld „${label}“ fehlt.`);
    assert((await command(archiveDraft, "confirm", archiveDraft.confirmation.requiredText.toLowerCase())).response.status === 400, "Ungenaue Phrase wurde akzeptiert.");
    const archived = await command(archiveDraft, "confirm", archiveDraft.confirmation.requiredText);
    assert(archived.response.ok && archived.payload?.actionDraft?.state === "executed", "Archivierung fehlgeschlagen.");
    assert((await command(archiveDraft, "confirm", archiveDraft.confirmation.requiredText)).payload?.actionDraft?.result?.entityId === ids.project, "Archivierungs-Replay nicht idempotent.");

    const restorePrepared = await createDraft(`Stelle Projekt ${projectNumber} wieder her. Grund: Projekt wird kontrolliert fortgeführt.`);
    const restoreDraft = restorePrepared.payload?.actionDraft;
    assert(restoreDraft?.lifecycleAction === "restore" && restoreDraft.targetStatus === "Abgeschlossen", "Vorheriger Status wurde nicht zuverlässig wiederhergestellt.");
    assert(restoreDraft.confirmation.requiredText === `PROJEKT WIEDERHERSTELLEN ${projectNumber}`, "Wiederherstellungsphrase falsch.");
    const restored = await command(restoreDraft, "confirm", restoreDraft.confirmation.requiredText);
    assert(restored.response.ok && restored.payload?.actionDraft?.state === "executed", "Wiederherstellung fehlgeschlagen.");

    const [project, timelines, logbook, audits, offer, invoice, file] = await Promise.all([
      prisma.workPilotProject.findUniqueOrThrow({ where: { id: ids.project } }),
      prisma.statusTimelineEntry.findMany({ where: { organizationId: actor.organizationId, entityType: "project", entityId: ids.project, startedAt: { gte: now } }, orderBy: { startedAt: "asc" } }),
      prisma.projectLogbookEntry.findMany({ where: { organizationId: actor.organizationId, projectId: ids.project, source: { in: ["project-archive", "project-restore"] }, createdAt: { gte: now } } }),
      prisma.auditLog.findMany({ where: { organizationId: actor.organizationId, entityType: "project", entityId: ids.project, action: { in: ["project.archived", "project.restored"] }, createdAt: { gte: now } } }),
      prisma.offer.findUnique({ where: { id: ids.offer } }), prisma.invoice.findUnique({ where: { id: ids.invoice } }), prisma.storedFile.findUnique({ where: { id: ids.file } }),
    ]);
    assert(project.status === "Abgeschlossen" && project.description === "Unveränderlicher QA-Fachinhalt" && project.address === "QA Straße 1, 74722 Buchen", "Projekt wurde nicht exakt wiederhergestellt oder Nebenfelder verändert.");
    assert(timelines.length === 2 && timelines[0].fromStatus === "Abgeschlossen" && timelines[0].toStatus === "Archiviert" && timelines[1].fromStatus === "Archiviert" && timelines[1].toStatus === "Abgeschlossen", "Timeline ist nicht exactly-once/reversibel.");
    assert(logbook.length === 2 && audits.length === 2, "Logbuch oder Audit sind nicht exactly-once.");
    assert(offer?.status === "Angenommen" && invoice?.status === "Bezahlt" && file?.deletedAt === null, "Verknüpfte Fachdaten wurden verändert.");
    result = { baseUrl, roleBoundary: employee ? "verified" : "no-active-employee", tenantBoundary: foreignOrganization ? "verified" : "single-tenant", blockersFailClosed: true, exactPhrase: true, cancelSafe: true, archiveReplayExactlyOnce: true, restorePreviousStatus: project.status, timelineEntries: timelines.length, logbookEntries: logbook.length, auditEntries: audits.length, relationsPreserved: true };
  } finally {
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    await prisma.activeStampSession.deleteMany({ where: { id: ids.stamp } });
    await prisma.planningEntry.deleteMany({ where: { id: ids.planning } });
    await prisma.task.deleteMany({ where: { id: ids.task } });
    await prisma.statusTimelineEntry.deleteMany({ where: { entityType: "project", entityId: { in: [ids.project, ids.blockedProject, ids.foreignProject] } } });
    await prisma.statusEscalationEvent.deleteMany({ where: { entityType: "project", entityId: { in: [ids.project, ids.blockedProject, ids.foreignProject] } } });
    await prisma.projectLogbookEntry.deleteMany({ where: { projectId: { in: [ids.project, ids.blockedProject, ids.foreignProject] } } });
    await prisma.auditLog.deleteMany({ where: { entityType: "project", entityId: { in: [ids.project, ids.blockedProject, ids.foreignProject] } } });
    await prisma.storedFile.deleteMany({ where: { id: ids.file } });
    await prisma.invoice.deleteMany({ where: { id: ids.invoice } });
    await prisma.offer.deleteMany({ where: { id: ids.offer } });
    await prisma.workPilotProject.deleteMany({ where: { id: { in: [ids.project, ids.blockedProject, ids.foreignProject] } } });
    await prisma.authSession.deleteMany({ where: { id: { in: [ids.session, ids.employeeSession] } } });
  }
  const residue = { projects: await prisma.workPilotProject.count({ where: { id: { in: [ids.project, ids.blockedProject, ids.foreignProject] } } }), drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }), sessions: await prisma.authSession.count({ where: { id: { in: [ids.session, ids.employeeSession] } } }), files: await prisma.storedFile.count({ where: { id: ids.file } }) };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
