import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = (process.argv.find((item) => item.startsWith("--base-url="))?.split("=")[1] || "http://localhost:3001").replace(/\/$/, "");
const allowProduction = process.argv.includes("--allow-production");
const secret = process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
if (!secret) throw new Error("WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET fehlt.");
if (!allowProduction && !/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(baseUrl)) throw new Error("Nicht-lokale QA benötigt --allow-production.");

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
  const [portal, employee] = await Promise.all([
    prisma.onlineRequestPortal.findFirst({ where: { organizationId: actor.organizationId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, allowedTradeIds: true } }),
    prisma.user.findFirst({ where: { organizationId: actor.organizationId, role: Role.MITARBEITER, isActive: true, OR: [{ salesRoleEnabled: false }, { salesRoleEnabled: null }] }, orderBy: { createdAt: "asc" }, select: { id: true } }),
  ]);
  if (!portal) throw new Error("Kein aktives Online-Anfragen-Portal gefunden.");
  const allowedTradeIds = Array.isArray(portal.allowedTradeIds) ? portal.allowedTradeIds.filter((id) => typeof id === "string") : [];
  const trade = await prisma.category.findFirst({ where: { organizationId: actor.organizationId, ...(allowedTradeIds.length ? { id: { in: allowedTradeIds } } : {}) }, orderBy: { name: "asc" }, select: { id: true, name: true, projectPrefix: true } });
  if (!trade) throw new Error("Kein geeignetes Gewerk gefunden.");

  const now = new Date();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
  const ids = { session: randomUUID(), employeeSession: randomUUID(), contact: randomUUID(), foreignOrganization: randomUUID(), foreignPortal: randomUUID() };
  const requestIds = [];
  const draftIds = new Set();
  const projectIds = new Set();
  const taskIds = new Set();
  const objectAddressIds = new Set();
  let result;

  const createRequest = async (marker, overrides = {}) => {
    const id = randomUUID();
    const referenceNumber = `OKI-${datePart}-${marker}${suffix.slice(marker.length)}`.slice(0, 19);
    await prisma.onlineRequest.create({ data: {
      id, organizationId: actor.organizationId, portalId: portal.id, referenceNumber,
      clientSubmissionId: randomUUID(), payloadHash: "a".repeat(64), status: "in_review", requestType: "execution",
      tradeId: trade.id, tradeName: trade.name, desiredDate: new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10), desiredTimeWindow: "morning",
      street: "QA JARVIS Weg 360", postalCode: "74722", city: "Buchen", description: `Isolierte JARVIS-Umwandlungs-QA ${marker}`,
      customerKind: "business", company: "QA JARVIS Online", firstName: "Qualität", lastName: "Sicherung", email: `qa-${marker.toLowerCase()}-${suffix.toLowerCase()}@example.test`, phone: "+49 6281 000000",
      preferredContact: "either", consentAt: now, submissionIpHash: "b".repeat(64), securitySignals: [], securityScore: 100,
      assignedUserId: actor.id, matchedContactId: ids.contact, customerDecision: "existing", ...overrides,
    } });
    requestIds.push(id);
    return { id, referenceNumber };
  };

  await prisma.contact.create({ data: { id: ids.contact, organizationId: actor.organizationId, customerNumber: `QA-${Date.now()}`, type: "company", category: "Kunde", companyName: "QA JARVIS Online", firstName: "Qualität", lastName: "Sicherung", email: `qa-${suffix.toLowerCase()}@example.test`, street: "QA JARVIS Weg 360", postalCode: "74722", city: "Buchen" } });
  await prisma.organization.create({ data: { id: ids.foreignOrganization, name: `QA JARVIS Fremdmandant ${suffix}`, slug: `qa-jarvis-foreign-${suffix.toLowerCase()}` } });
  await prisma.authSession.create({ data: sessionData(ids.session, actor.id, now) });
  if (employee) await prisma.authSession.create({ data: sessionData(ids.employeeSession, employee.id, now) });
  const cookie = `workpilot_session=${token(ids.session)}`;

  try {
    const createDraft = async (referenceNumber, requestCookie = cookie, actorId = actor.id) => {
      const response = await requestJson("/api/jarvis/chat", requestCookie, { method: "POST", body: JSON.stringify({ actorId, message: `Wandle ${referenceNumber} in ein Projekt um.`, context: { activeTab: "onlineRequests", activeMainView: "onlineRequests" } }) });
      if (response.payload?.actionDraft?.previewId) draftIds.add(response.payload.actionDraft.previewId);
      return response;
    };
    const command = async (draft, name, phrase = "") => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, { method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" }, body: JSON.stringify({ actorId: actor.id, actionId: "online-request.convert", command: name, revision: draft.revision, confirmationText: phrase }) });
    const snapshot = async () => ({ projects: await prisma.workPilotProject.count({ where: { organizationId: actor.organizationId } }), contacts: await prisma.contact.count({ where: { organizationId: actor.organizationId } }), tasks: await prisma.task.count({ where: { organizationId: actor.organizationId } }), logbook: await prisma.projectLogbookEntry.count({ where: { organizationId: actor.organizationId } }), addresses: await prisma.objectAddress.count({ where: { organizationId: actor.organizationId } }) });

    const mainRequest = await createRequest("A");
    if (employee) {
      const denied = await createDraft(mainRequest.referenceNumber, `workpilot_session=${token(ids.employeeSession)}`, employee.id);
      assert(denied.response.ok && !denied.payload?.actionDraft, `Mitarbeiterrolle erhielt Umwandlungsaktion: ${JSON.stringify(denied.payload)}`);
    }
    {
      await prisma.onlineRequestPortal.create({ data: { id: ids.foreignPortal, organizationId: ids.foreignOrganization, slug: `qa-jarvis-foreign-portal-${suffix.toLowerCase()}`, displayName: "QA Fremdportal" } });
      const foreignReference = `OKI-${datePart}-F${suffix.slice(1)}`;
      const foreignId = randomUUID();
      requestIds.push(foreignId);
      await prisma.onlineRequest.create({ data: { id: foreignId, organizationId: ids.foreignOrganization, portalId: ids.foreignPortal, referenceNumber: foreignReference, clientSubmissionId: randomUUID(), payloadHash: "c".repeat(64), status: "in_review", requestType: "general", tradeName: "Glasreinigung", street: "Fremdweg 1", postalCode: "00000", city: "Fremd", description: "Mandantentrennung", customerKind: "private", firstName: "Fremd", lastName: "Mandant", preferredContact: "either", consentAt: now, submissionIpHash: "d".repeat(64), customerDecision: "new" } });
      const isolated = await createDraft(foreignReference);
      assert(isolated.response.ok && !isolated.payload?.actionDraft, "Fremdmandanten-Anfrage war als Aktion sichtbar.");
      await prisma.onlineRequest.delete({ where: { id: foreignId } });
      requestIds.splice(requestIds.indexOf(foreignId), 1);
      await prisma.onlineRequestPortal.delete({ where: { id: ids.foreignPortal } });
    }

    const beforePreview = await snapshot();
    const prepared = await createDraft(mainRequest.referenceNumber);
    const draft = prepared.payload?.actionDraft;
    assert(draft?.actionId === "online-request.convert" && draft.state === "awaiting_confirmation", `Keine ausführbare Umwandlungsvorschau: ${JSON.stringify(prepared.payload)}`);
    assert(draft.confirmation.requiredText === `ONLINE-ANFRAGE UMWANDELN ${mainRequest.referenceNumber}`, "Kritische Bestätigungsphrase ist falsch.");
    assert(draft.checks?.some((check) => check.key === "new-project-only" && /immer ein neues Projekt/i.test(check.detail)), "Neues-Projekt-Invariante fehlt in der Vorschau.");
    assert(JSON.stringify(await snapshot()) === JSON.stringify(beforePreview), "Die Vorschau hat Fachdaten verändert.");
    assert((await command(draft, "confirm", draft.confirmation.requiredText.toLowerCase())).response.status === 400, "Ungenaue Phrase wurde akzeptiert.");
    assert(JSON.stringify(await snapshot()) === JSON.stringify(beforePreview), "Falsche Phrase hat Fachdaten verändert.");

    await prisma.onlineRequest.update({ where: { id: mainRequest.id }, data: { description: "Nach Vorschau bewusst geänderter Kontext" } });
    const stale = await command(draft, "confirm", draft.confirmation.requiredText);
    assert(stale.response.status === 409, `Veralteter Kontext wurde nicht abgewiesen: ${stale.response.status}`);
    assert(!(await prisma.onlineRequest.findUniqueOrThrow({ where: { id: mainRequest.id } })).convertedProjectId, "Veraltete Vorschau hat ein Projekt erzeugt.");

    const cancelRequest = await createRequest("B");
    const cancellable = (await createDraft(cancelRequest.referenceNumber)).payload?.actionDraft;
    assert(cancellable?.actionId === "online-request.convert", "Keine Abbruchvorschau erzeugt.");
    assert((await command(cancellable, "cancel")).payload?.actionDraft?.state === "cancelled", "Abbruch fehlgeschlagen.");
    assert(!(await prisma.onlineRequest.findUniqueOrThrow({ where: { id: cancelRequest.id } })).convertedProjectId, "Abbruch hat ein Projekt erzeugt.");

    const refreshed = (await createDraft(mainRequest.referenceNumber)).payload?.actionDraft;
    assert(refreshed?.state === "awaiting_confirmation", "Aktualisierte Vorschau ist nicht ausführbar.");
    const executedResponse = await command(refreshed, "confirm", refreshed.confirmation.requiredText);
    const executed = executedResponse.payload?.actionDraft;
    assert(executedResponse.response.ok && executed?.state === "executed" && executed.result?.entityType === "project", `Umwandlung fehlgeschlagen: ${JSON.stringify(executedResponse.payload)}`);
    projectIds.add(executed.result.entityId);
    const replay = await command(refreshed, "confirm", refreshed.confirmation.requiredText);
    assert(replay.response.ok && replay.payload?.actionDraft?.result?.entityId === executed.result.entityId, "Bestätigungs-Replay war nicht exactly-once.");

    const [convertedRequest, project, tasks, logbooks, projectTimeline, convertedAudits] = await Promise.all([
      prisma.onlineRequest.findUniqueOrThrow({ where: { id: mainRequest.id } }),
      prisma.workPilotProject.findUniqueOrThrow({ where: { id: executed.result.entityId } }),
      prisma.task.findMany({ where: { projectId: executed.result.entityId } }),
      prisma.projectLogbookEntry.findMany({ where: { projectId: executed.result.entityId } }),
      prisma.statusTimelineEntry.findMany({ where: { entityType: "project", entityId: executed.result.entityId } }),
      prisma.onlineRequestAuditEvent.findMany({ where: { onlineRequestId: mainRequest.id, eventType: "converted" } }),
    ]);
    tasks.forEach((task) => taskIds.add(task.id));
    if (project.objectAddressId) objectAddressIds.add(project.objectAddressId);
    assert(convertedRequest.status === "converted" && convertedRequest.convertedProjectId === project.id, "Anfrage wurde nicht korrekt verknüpft.");
    assert(project.contactId === ids.contact && project.source === `Online-Anfrage ${mainRequest.referenceNumber}` && project.title === `Projekt ${project.projectNumber} - ${trade.name}`, "Neues Projekt enthält falsche Stamm- oder Quellenwerte.");
    assert(tasks.length >= 1 && logbooks.some((entry) => entry.title === "Online-Anfrage") && projectTimeline.length === 1, "Aufgabe, Logbuch oder Projekt-Timeline fehlt.");
    assert(convertedAudits.length === 1 && convertedAudits[0].payload?.source === "jarvis" && convertedAudits[0].payload?.executionRequestId === refreshed.previewId, "Korrelierter JARVIS-Umwandlungsnachweis fehlt oder ist nicht exactly-once.");
    result = { baseUrl, roleBoundary: employee ? "verified" : "no-active-employee", tenantBoundary: "verified", previewReadOnly: true, exactPhrase: true, staleContextFailClosed: true, cancelSafe: true, newProjectInvariant: true, replayExactlyOnce: true, projectNumber: project.projectNumber, tasks: tasks.length, logbooks: logbooks.length, conversionAudits: convertedAudits.length };
  } finally {
    const linkedRequests = await prisma.onlineRequest.findMany({ where: { id: { in: requestIds } }, select: { convertedProjectId: true } });
    linkedRequests.forEach((request) => { if (request.convertedProjectId) projectIds.add(request.convertedProjectId); });
    const linkedTasks = await prisma.task.findMany({ where: { projectId: { in: [...projectIds] } }, select: { id: true } });
    linkedTasks.forEach((task) => taskIds.add(task.id));
    const linkedProjects = await prisma.workPilotProject.findMany({ where: { id: { in: [...projectIds] } }, select: { objectAddressId: true } });
    linkedProjects.forEach((project) => { if (project.objectAddressId) objectAddressIds.add(project.objectAddressId); });
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    await prisma.notification.deleteMany({ where: { OR: [{ taskId: { in: [...taskIds] } }, { linkTarget: "online-requests", linkTargetId: { in: requestIds } }] } });
    await prisma.statusTimelineEntry.deleteMany({ where: { OR: [{ entityType: "task", entityId: { in: [...taskIds] } }, { entityType: "project", entityId: { in: [...projectIds] } }] } });
    await prisma.task.deleteMany({ where: { id: { in: [...taskIds] } } });
    await prisma.projectLogbookEntry.deleteMany({ where: { projectId: { in: [...projectIds] } } });
    await prisma.storedFile.deleteMany({ where: { ownerType: "project", ownerId: { in: [...projectIds] } } });
    await prisma.workPilotProject.deleteMany({ where: { id: { in: [...projectIds] } } });
    await prisma.objectAddress.deleteMany({ where: { id: { in: [...objectAddressIds] } } });
    await prisma.onlineRequest.deleteMany({ where: { id: { in: requestIds } } });
    await prisma.contact.deleteMany({ where: { id: ids.contact } });
    await prisma.authSession.deleteMany({ where: { id: { in: [ids.session, ids.employeeSession] } } });
    await prisma.onlineRequestPortal.deleteMany({ where: { id: ids.foreignPortal } });
    await prisma.organization.deleteMany({ where: { id: ids.foreignOrganization } });
  }
  const residue = { requests: await prisma.onlineRequest.count({ where: { id: { in: requestIds } } }), projects: await prisma.workPilotProject.count({ where: { id: { in: [...projectIds] } } }), tasks: await prisma.task.count({ where: { id: { in: [...taskIds] } } }), drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }), contact: await prisma.contact.count({ where: { id: ids.contact } }), sessions: await prisma.authSession.count({ where: { id: { in: [ids.session, ids.employeeSession] } } }), foreignOrganization: await prisma.organization.count({ where: { id: ids.foreignOrganization } }) };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
