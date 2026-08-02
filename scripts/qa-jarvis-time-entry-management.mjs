import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";

process.loadEnvFile?.(".env");

const prisma = new PrismaClient();
const baseUrl = (process.argv.find((item) => item.startsWith("--base-url="))?.split("=")[1] || "http://localhost:3001").replace(/\/$/, "");
const secret = process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
if (!secret) throw new Error("WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET fehlt.");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const token = (sessionId) => {
  const value = `v2.${sessionId}.1`;
  return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`;
};
const sessionData = (id, userId, at) => ({
  id, userId, tokenVersion: 1, createdAt: at, lastSeenAt: at, lastRotatedAt: at,
  idleExpiresAt: new Date(at.getTime() + 3_600_000),
  absoluteExpiresAt: new Date(at.getTime() + 3_600_000),
});
const requestJson = async (path, cookie, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Origin: baseUrl, Cookie: cookie, ...(init.headers || {}) },
  });
  return { response, payload: await response.json().catch(() => null) };
};

async function main() {
  const actor = await prisma.user.findFirst({
    where: { role: { in: [Role.GESCHAEFTSFUEHRER, Role.ADMIN, Role.FUEHRUNGSKRAFT] }, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, organizationId: true, firstName: true, lastName: true, email: true, role: true },
  });
  if (!actor) throw new Error("Kein aktiver Zeitverwaltungs-Testakteur gefunden.");
  const employee = await prisma.user.findFirst({
    where: { organizationId: actor.organizationId, role: Role.MITARBEITER, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const existingForeignOrganization = await prisma.organization.findFirst({
    where: { id: { not: actor.organizationId } },
    select: { id: true },
  });
  const foreignOrganization = existingForeignOrganization || await prisma.organization.create({
    data: {
      id: randomUUID(),
      name: "QA JARVIS Fremdmandant Zeit",
      slug: `qa-jarvis-time-${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    },
    select: { id: true },
  });
  const ownsForeignOrganization = !existingForeignOrganization;
  const now = new Date();
  const suffix = Date.now().toString().slice(-9);
  const ids = {
    project: randomUUID(), foreignProject: randomUUID(),
    session: randomUUID(), secondSession: randomUUID(), employeeSession: randomUUID(),
    correction: randomUUID(), deletion: randomUUID(), invoiced: randomUUID(),
    apiCorrection: randomUUID(), apiDeletion: randomUUID(), foreignEntry: randomUUID(),
  };
  const projectNumber = `QTM-${suffix}`;
  const foreignProjectNumber = `QTF-${suffix}`;
  const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
  const employeeId = employee?.id || actor.id;
  const draftIds = new Set();
  const entryIds = [ids.correction, ids.deletion, ids.invoiced, ids.apiCorrection, ids.apiDeletion, ids.foreignEntry];
  let result;

  await prisma.authSession.createMany({ data: [
    sessionData(ids.session, actor.id, now),
    sessionData(ids.secondSession, actor.id, now),
    ...(employee ? [sessionData(ids.employeeSession, employee.id, now)] : []),
  ] });
  await prisma.workPilotProject.create({ data: {
    id: ids.project, organizationId: actor.organizationId, projectNumber,
    title: "QA JARVIS Zeiteintragsverwaltung", customer: "QA intern", status: "Umsetzung",
    projectType: "Glasreinigung", projectKind: "Einmalprojekt", trade: "Glasreinigung",
    branch: "OK immocare", responsibleName: actorName, source: "qa-jarvis-time-entry-management",
  } });
  await prisma.workPilotProject.create({ data: {
    id: ids.foreignProject, organizationId: foreignOrganization.id, projectNumber: foreignProjectNumber,
    title: "QA Fremdmandant Zeit", customer: "QA fremd", status: "Umsetzung",
    projectType: "Glasreinigung", projectKind: "Einmalprojekt", trade: "Glasreinigung",
    source: "qa-jarvis-time-entry-management",
  } });
  const baseEntry = {
    organizationId: actor.organizationId, projectId: ids.project,
    projectLabel: `${projectNumber} | QA JARVIS Zeiteintragsverwaltung`, trade: "Glasreinigung",
    userId: employeeId, employee: "QA Mitarbeitend", entrySource: "stamped",
    date: "2026-08-01", startTime: "08:00", endTime: "10:00",
    durationMs: 6_300_000n, pauseMs: 900_000n,
    laborCostRateSnapshot: 28, laborCostSnapshot: 49, costSnapshotAt: now,
    comment: "QA Ausgangszeit", editHistory: [],
  };
  await prisma.projectTimeEntry.createMany({ data: [
    { ...baseEntry, id: ids.correction },
    { ...baseEntry, id: ids.deletion, comment: "QA doppelte Zeit" },
    { ...baseEntry, id: ids.invoiced, invoiceId: "qa-invoice-bound", invoiceNumber: `QA-RE-${suffix}`, invoicedAt: now },
    { ...baseEntry, id: ids.apiCorrection, comment: "QA Oberfläche Korrektur" },
    { ...baseEntry, id: ids.apiDeletion, comment: "QA Oberfläche Löschung" },
    {
      ...baseEntry, id: ids.foreignEntry, organizationId: foreignOrganization.id,
      projectId: ids.foreignProject, projectLabel: `${foreignProjectNumber} | QA Fremdmandant Zeit`,
    },
  ] });

  const cookie = `workpilot_session=${token(ids.session)}`;
  const secondCookie = `workpilot_session=${token(ids.secondSession)}`;
  const createDraft = async (message, requestCookie = cookie, actorId = actor.id) => {
    const response = await requestJson("/api/jarvis/chat", requestCookie, {
      method: "POST",
      body: JSON.stringify({ actorId, message, context: { activeTab: "dashboard", activeMainView: "dashboard" } }),
    });
    if (response.payload?.actionDraft?.previewId) draftIds.add(response.payload.actionDraft.previewId);
    return response;
  };
  const command = async (draft, name, phrase = "", requestCookie = cookie) => requestJson(
    `/api/jarvis/action-drafts/${draft.previewId}`,
    requestCookie,
    {
      method: "POST",
      headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
      body: JSON.stringify({ actorId: actor.id, actionId: "time.manage", command: name, revision: draft.revision, confirmationText: phrase }),
    }
  );

  try {
    if (employee) {
      const denied = await createDraft(
        `Korrigiere Zeiteintrag ${ids.correction}. Grund: QA Rollenprüfung. Beginn: 08:15`,
        `workpilot_session=${token(ids.employeeSession)}`,
        employee.id
      );
      assert(denied.response.ok && !denied.payload?.actionDraft, `Mitarbeiterrolle erhielt kritische Zeitverwaltung: ${JSON.stringify(denied.payload)}`);
    }
    const isolated = await createDraft(`Lösche Zeiteintrag ${ids.foreignEntry}. Grund: QA Mandantenprüfung.`);
    assert(!isolated.payload?.actionDraft, "Fremdmandanten-Zeiteintrag war für JARVIS ausführbar.");

    const invoiceBlocked = await createDraft(`Lösche Zeiteintrag ${ids.invoiced}. Grund: QA Rechnungsbindung.`);
    assert(!invoiceBlocked.payload?.actionDraft, "Abgerechneter Zeiteintrag war für JARVIS löschbar.");
    assert((invoiceBlocked.payload?.message || invoiceBlocked.payload?.text || invoiceBlocked.payload?.error || "").toLowerCase().includes("abgerechnet") || invoiceBlocked.response.status === 409, `Rechnungsblockade wurde nicht verständlich erklärt: ${JSON.stringify(invoiceBlocked.payload)}`);

    const cancellableResponse = await createDraft(`Lösche Zeiteintrag ${ids.deletion}. Grund: QA Abbruchprüfung.`);
    const cancellable = cancellableResponse.payload?.actionDraft;
    assert(cancellable?.actionId === "time.manage" && cancellable.lifecycleAction === "delete", `Keine Löschvorschau erzeugt: ${JSON.stringify(cancellableResponse.payload)}`);
    const cancelled = await command(cancellable, "cancel");
    assert(cancelled.response.ok && cancelled.payload?.actionDraft?.state === "cancelled", "Abbruch der Zeiteintragslöschung fehlgeschlagen.");
    assert((await prisma.projectTimeEntry.findUniqueOrThrow({ where: { id: ids.deletion } })).deletedAt === null, "Abbruch hat den Zeiteintrag verändert.");

    const correctionResponse = await createDraft(`Korrigiere Zeiteintrag ${ids.correction}. Grund: Uhrzeit in QA falsch erfasst. Beginn: 08:15`);
    const correctionDraft = correctionResponse.payload?.actionDraft;
    assert(correctionDraft?.actionId === "time.manage" && correctionDraft.lifecycleAction === "update" && correctionDraft.confirmation?.enabled, `Korrekturvorschau nicht bereit: ${JSON.stringify(correctionResponse.payload)}`);
    assert(correctionDraft.confirmation.requiredText === `ZEITEINTRAG KORRIGIEREN ${ids.correction}`, "Korrekturphrase falsch.");
    for (const label of ["Aktion", "Zeiteintrags-ID", "Projekt", "Mitarbeitend", "Bisherige Zeit", "Grund", "Beginn"]) {
      assert(correctionDraft.fields?.some((field) => field.label === label), `Korrektur-Vorschaufeld „${label}“ fehlt.`);
    }
    const wrong = await command(correctionDraft, "confirm", correctionDraft.confirmation.requiredText.toLowerCase());
    assert(wrong.response.status === 400, "Ungenaue Korrekturphrase wurde akzeptiert.");
    const crossSession = await command(correctionDraft, "confirm", correctionDraft.confirmation.requiredText, secondCookie);
    assert(crossSession.response.status === 403, "Zeiteintragsentwurf war nicht an die Sitzung gebunden.");
    const corrected = await command(correctionDraft, "confirm", correctionDraft.confirmation.requiredText);
    assert(corrected.response.ok && corrected.payload?.actionDraft?.state === "executed", `JARVIS-Korrektur fehlgeschlagen: ${JSON.stringify(corrected.payload)}`);
    const correctionReplay = await command(correctionDraft, "confirm", correctionDraft.confirmation.requiredText);
    assert(correctionReplay.response.ok && correctionReplay.payload?.actionDraft?.result?.entityId === ids.correction, "Korrektur-Replay war nicht idempotent.");
    const correctionEntry = await prisma.projectTimeEntry.findUniqueOrThrow({ where: { id: ids.correction } });
    const correctionHistory = Array.isArray(correctionEntry.editHistory) ? correctionEntry.editHistory : [];
    assert(correctionEntry.startTime === "08:15" && correctionEntry.durationMs === 5_400_000n, "Korrigierte Zeit oder Dauer ist falsch.");
    assert(correctionEntry.laborCostRateSnapshot === 28 && correctionEntry.laborCostSnapshot === 42, "Historischer Kostensatz wurde nicht korrekt bewahrt/neuberechnet.");
    assert(correctionHistory.length === 1 && correctionHistory[0]?.note === "Uhrzeit in QA falsch erfasst", "Serverseitige Korrekturhistorie ist nicht exactly-once.");

    const deletionResponse = await createDraft(`Lösche Zeiteintrag ${ids.deletion}. Grund: Doppelte QA-Buchung.`);
    const deletionDraft = deletionResponse.payload?.actionDraft;
    assert(deletionDraft?.lifecycleAction === "delete" && deletionDraft.confirmation?.requiredText === `ZEITEINTRAG LÖSCHEN ${ids.deletion}`, `Löschvorschau falsch: ${JSON.stringify(deletionResponse.payload)}`);
    const deleted = await command(deletionDraft, "confirm", deletionDraft.confirmation.requiredText);
    assert(deleted.response.ok && deleted.payload?.actionDraft?.state === "executed", "JARVIS-Löschung fehlgeschlagen.");
    await command(deletionDraft, "confirm", deletionDraft.confirmation.requiredText);
    const deletionEntry = await prisma.projectTimeEntry.findUniqueOrThrow({ where: { id: ids.deletion } });
    const deletionHistory = Array.isArray(deletionEntry.editHistory) ? deletionEntry.editHistory : [];
    assert(deletionEntry.deletedAt && deletionHistory.length === 1 && deletionHistory[0]?.note === "Doppelte QA-Buchung", "Soft-Delete oder Löschhistorie ist nicht exactly-once.");

    const apiCorrection = await requestJson("/api/project-time-entries", cookie, {
      method: "PATCH",
      body: JSON.stringify({ id: ids.apiCorrection, actorUserId: actor.id, editReason: "QA Oberfläche korrigiert", startTime: "08:30", projectId: "manipulated-project" }),
    });
    assert(apiCorrection.response.ok && apiCorrection.payload?.startTime === "08:30", `Normale API-Korrektur fehlgeschlagen: ${JSON.stringify(apiCorrection.payload)}`);
    const apiCorrectionEntry = await prisma.projectTimeEntry.findUniqueOrThrow({ where: { id: ids.apiCorrection } });
    assert(apiCorrectionEntry.projectId === ids.project && apiCorrectionEntry.startTime === "08:30", "Normale API änderte ein geschütztes Identitätsfeld.");

    const apiDelete = await requestJson(`/api/project-time-entries?id=${encodeURIComponent(ids.apiDeletion)}&actorUserId=${encodeURIComponent(actor.id)}&note=${encodeURIComponent("QA Oberfläche doppelt")}`, cookie, { method: "DELETE" });
    assert(apiDelete.response.ok && apiDelete.payload?.deletedAt, `Normale API-Löschung fehlgeschlagen: ${JSON.stringify(apiDelete.payload)}`);

    const auditExecutions = await prisma.jarvisActionDraftAuditEvent.count({
      where: { draftId: { in: [...draftIds] }, eventType: "draft_confirmed_and_executed" },
    });
    assert(auditExecutions === 2, `JARVIS-Ausführungsaudit ist nicht exactly-once: ${auditExecutions}`);
    result = {
      baseUrl, actorRole: actor.role,
      roleBoundary: employee ? "verified" : "no-active-employee",
      tenantBoundary: "verified",
      invoiceBindingFailClosed: true, exactPhrases: true, sessionBinding: true,
      correctionExactlyOnce: true, deletionExactlyOnce: true,
      historicalCostPreserved: true, normalApiUsesSharedService: true,
      protectedIdentityPreserved: true, auditExecutions,
    };
  } finally {
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    await prisma.projectTimeEntry.deleteMany({ where: { id: { in: entryIds } } });
    await prisma.workPilotProject.deleteMany({ where: { id: { in: [ids.project, ids.foreignProject] } } });
    await prisma.authSession.deleteMany({ where: { id: { in: [ids.session, ids.secondSession, ids.employeeSession] } } });
    if (ownsForeignOrganization) {
      await prisma.organization.deleteMany({ where: { id: foreignOrganization.id } });
    }
  }

  const residue = {
    drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }),
    entries: await prisma.projectTimeEntry.count({ where: { id: { in: entryIds } } }),
    projects: await prisma.workPilotProject.count({ where: { id: { in: [ids.project, ids.foreignProject] } } }),
    sessions: await prisma.authSession.count({ where: { id: { in: [ids.session, ids.secondSession, ids.employeeSession] } } }),
    organizations: ownsForeignOrganization ? await prisma.organization.count({ where: { id: foreignOrganization.id } }) : 0,
  };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
