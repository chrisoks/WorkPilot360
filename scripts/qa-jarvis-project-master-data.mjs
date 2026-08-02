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
  const ids = { project: randomUUID(), foreignProject: randomUUID(), session: randomUUID(), employeeSession: randomUUID() };
  const projectNumber = `QPM-${suffix}`;
  const foreignNumber = `QPF-${suffix}`;
  const draftIds = new Set();
  let result;

  await prisma.workPilotProject.create({ data: {
    id: ids.project, organizationId: actor.organizationId, projectNumber,
    title: "QA JARVIS Projektdaten", customer: "QA Kunde", status: "Umsetzung",
    description: "Unveränderlicher Ausgangstext", projectType: "OK solutions",
    projectKind: "Einmalprojekt", projectRuntimeFrom: "2026-08", projectRuntimeUntil: "2026-10",
    trade: "Glasreinigung", address: "QA Straße 1, 74722 Buchen", responsibleName: "QA Verantwortung",
    reviewStatus: "approved", reviewedAt: now, reviewedByUserId: actor.id, reviewedByName: "QA Freigabe",
    reviewedProjectStatus: "Umsetzung", source: "qa-jarvis-project-master-data",
  } });
  if (foreignOrganization) await prisma.workPilotProject.create({ data: {
    id: ids.foreignProject, organizationId: foreignOrganization.id, projectNumber: foreignNumber,
    title: "QA Fremdmandant Projektdaten", status: "Umsetzung", projectType: "OK solutions", projectKind: "Einmalprojekt",
  } });
  await prisma.authSession.create({ data: sessionData(ids.session, actor.id, now) });
  if (employee) await prisma.authSession.create({ data: sessionData(ids.employeeSession, employee.id, now) });
  const cookie = `workpilot_session=${token(ids.session)}`;

  try {
    const createDraft = async (message, requestCookie = cookie, actorId = actor.id) => {
      const response = await requestJson("/api/jarvis/chat", requestCookie, { method: "POST", body: JSON.stringify({ actorId, message, context: { activeTab: "dashboard", activeMainView: "dashboard" } }) });
      if (response.payload?.actionDraft?.previewId) draftIds.add(response.payload.actionDraft.previewId);
      return response;
    };
    const command = async (draft, name, phrase = "") => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, {
      method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
      body: JSON.stringify({ actorId: actor.id, actionId: "project.manage", command: name, revision: draft.revision, confirmationText: phrase }),
    });

    if (employee) {
      const denied = await createDraft(`Ändere Projekt ${projectNumber}: Titel: Nicht erlaubt.`, `workpilot_session=${token(ids.employeeSession)}`, employee.id);
      assert(denied.response.ok && !denied.payload?.actionDraft, `Mitarbeiterrolle erhielt Projektdatenaktion: ${JSON.stringify(denied.payload)}`);
    }
    if (foreignOrganization) {
      const isolated = await createDraft(`Ändere Projekt ${foreignNumber}: Titel: Mandantengrenze.`);
      assert(isolated.response.ok && isolated.payload?.type === "refusal" && !isolated.payload?.actionDraft, "Fremdmandanten-Projekt war sichtbar.");
    }

    const cancellableResponse = await createDraft(`Ändere Projekt ${projectNumber}: Beschreibung: Abbruch muss unverändert bleiben.`);
    const cancellable = cancellableResponse.payload?.actionDraft;
    assert(cancellable?.actionId === "project.manage", "Keine Abbruchvorschau erzeugt.");
    assert((await command(cancellable, "cancel")).payload?.actionDraft?.state === "cancelled", "Abbruch fehlgeschlagen.");
    assert((await prisma.workPilotProject.findUniqueOrThrow({ where: { id: ids.project } })).description === "Unveränderlicher Ausgangstext", "Abbruch hat Projektdaten verändert.");

    const prepared = await createDraft(`Ändere Projekt ${projectNumber}: Titel: QA JARVIS Projektdaten geprüft; Laufzeit bis: 2026-11.`);
    const draft = prepared.payload?.actionDraft;
    assert(draft?.actionId === "project.manage" && draft.state === "awaiting_confirmation" && draft.confirmation?.enabled && !draft.blockingIssues?.length, `Projektdatenvorschau nicht bereit: ${JSON.stringify(prepared.payload)}`);
    assert(draft.confirmation.requiredText === `PROJEKT ÄNDERN ${projectNumber}`, "Bestätigungsphrase falsch.");
    assert(draft.changes?.length === 2 && draft.changes.some((change) => change.label === "Projekttitel" && change.before === "QA JARVIS Projektdaten" && change.after === "QA JARVIS Projektdaten geprüft"), "Alt-/Neuwertvorschau unvollständig.");
    assert(draft.reviewWillBeInvalidated === true, "Aufhebung der fachlichen Freigabe wurde nicht angezeigt.");
    assert((await command(draft, "confirm", draft.confirmation.requiredText.toLowerCase())).response.status === 400, "Ungenaue Phrase wurde akzeptiert.");
    const changed = await command(draft, "confirm", draft.confirmation.requiredText);
    assert(changed.response.ok && changed.payload?.actionDraft?.state === "executed", "Projektdatenänderung fehlgeschlagen.");
    assert((await command(draft, "confirm", draft.confirmation.requiredText)).payload?.actionDraft?.result?.entityId === ids.project, "Replay war nicht idempotent.");

    const stalePrepared = await createDraft(`Ändere Projekt ${projectNumber}: Beschreibung: Neuer JARVIS Text.`);
    const staleDraft = stalePrepared.payload?.actionDraft;
    assert(staleDraft?.state === "awaiting_confirmation", "Keine Vorschau für Stale-Context-Test erzeugt.");
    await prisma.workPilotProject.update({ where: { id: ids.project }, data: { participants: "Parallele Änderung", updatedAt: new Date() } });
    assert((await command(staleDraft, "confirm", staleDraft.confirmation.requiredText)).response.status === 409, "Veraltete Vorschau wurde trotz Paralleländerung ausgeführt.");

    const [project, history, logbook, audits] = await Promise.all([
      prisma.workPilotProject.findUniqueOrThrow({ where: { id: ids.project } }),
      prisma.workPilotProjectReviewHistory.findMany({ where: { organizationId: actor.organizationId, projectId: ids.project, createdAt: { gte: now } } }),
      prisma.projectLogbookEntry.findMany({ where: { organizationId: actor.organizationId, projectId: ids.project, source: "project-master-data", createdAt: { gte: now } } }),
      prisma.auditLog.findMany({ where: { organizationId: actor.organizationId, entityType: "project", entityId: ids.project, action: "project.master-data.changed", createdAt: { gte: now } } }),
    ]);
    assert(project.title === "QA JARVIS Projektdaten geprüft" && project.projectRuntimeUntil === "2026-11", "Bestätigte Felder wurden nicht exakt geändert.");
    assert(project.description === "Unveränderlicher Ausgangstext" && project.status === "Umsetzung" && project.customer === "QA Kunde" && project.projectNumber === projectNumber, "Nicht freigegebene Projektfelder wurden verändert.");
    assert(project.reviewStatus === "needs_review" && project.reviewedAt === null, "Fachliche Freigabe wurde nicht kontrolliert aufgehoben.");
    assert(history.length === 1 && logbook.length === 1 && audits.length === 1, "Historie, Logbuch oder Audit sind nicht exactly-once.");
    result = { baseUrl, roleBoundary: employee ? "verified" : "no-active-employee", tenantBoundary: foreignOrganization ? "verified" : "single-tenant", exactPhrase: true, cancelSafe: true, staleContextBlocked: true, replayExactlyOnce: true, changedFields: ["title", "projectRuntimeUntil"], reviewInvalidated: true, unchangedCoreFields: true, historyEntries: history.length, logbookEntries: logbook.length, auditEntries: audits.length };
  } finally {
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    await prisma.workPilotProjectReviewHistory.deleteMany({ where: { projectId: { in: [ids.project, ids.foreignProject] } } });
    await prisma.projectLogbookEntry.deleteMany({ where: { projectId: { in: [ids.project, ids.foreignProject] } } });
    await prisma.auditLog.deleteMany({ where: { entityType: "project", entityId: { in: [ids.project, ids.foreignProject] } } });
    await prisma.workPilotProject.deleteMany({ where: { id: { in: [ids.project, ids.foreignProject] } } });
    await prisma.authSession.deleteMany({ where: { id: { in: [ids.session, ids.employeeSession] } } });
  }
  const residue = {
    projects: await prisma.workPilotProject.count({ where: { id: { in: [ids.project, ids.foreignProject] } } }),
    drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }),
    sessions: await prisma.authSession.count({ where: { id: { in: [ids.session, ids.employeeSession] } } }),
  };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
