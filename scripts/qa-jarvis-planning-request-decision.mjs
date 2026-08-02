import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";

process.loadEnvFile?.(".env");
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
  const actor = await prisma.user.findFirst({
    where: { role: { in: [Role.GESCHAEFTSFUEHRER, Role.ADMIN, Role.FUEHRUNGSKRAFT] }, isActive: true },
    orderBy: { createdAt: "asc" }, select: { id: true, organizationId: true, firstName: true, lastName: true, email: true, role: true },
  });
  if (!actor) throw new Error("Kein aktiver Planungsverantwortlicher gefunden.");
  const employee = await prisma.user.findFirst({ where: { organizationId: actor.organizationId, role: Role.MITARBEITER, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!employee) throw new Error("Kein aktiver Mitarbeiter für die Terminwunsch-QA gefunden.");
  const foreignExisting = await prisma.organization.findFirst({ where: { id: { not: actor.organizationId } }, select: { id: true } });
  const foreignOrganization = foreignExisting || await prisma.organization.create({ data: { id: randomUUID(), name: "QA Fremdmandant Terminwunsch", slug: `qa-request-${randomUUID().replace(/-/g, "").slice(0, 12)}` }, select: { id: true } });
  const ownsForeignOrganization = !foreignExisting;
  const now = new Date(); const suffix = Date.now().toString().slice(-9);
  const ids = {
    project: randomUUID(), foreignProject: randomUUID(), session: randomUUID(), employeeSession: randomUUID(),
    approve: randomUUID(), reject: randomUUID(), normal: randomUUID(), cancel: randomUUID(), cancelNormal: randomUUID(), withdraw: randomUUID(), withdrawNormal: randomUUID(), withdrawBypass: randomUUID(), deleteBypass: randomUUID(), bypass: randomUUID(), foreign: randomUUID(),
  };
  const entryIds = [ids.approve, ids.reject, ids.normal, ids.cancel, ids.cancelNormal, ids.withdraw, ids.withdrawNormal, ids.withdrawBypass, ids.deleteBypass, ids.bypass, ids.foreign];
  const sessionIds = [ids.session, ids.employeeSession];
  const projectIds = [ids.project, ids.foreignProject];
  const draftIds = new Set();
  let result;
  const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;

  try {
    await prisma.authSession.createMany({ data: [sessionData(ids.session, actor.id, now), sessionData(ids.employeeSession, employee.id, now)] });
    await prisma.workPilotProject.create({ data: { id: ids.project, organizationId: actor.organizationId, projectNumber: `QPR-${suffix}`, title: "QA Terminwunsch", customer: "QA intern", status: "Umsetzung", projectType: "Hausmeisterservice", projectKind: "Dauerprojekt", recurringBillingMode: "hourly", trade: "Hausmeisterservice", branch: "OK immocare", responsibleName: actorName, source: "qa-jarvis-planning-request-decision" } });
    await prisma.workPilotProject.create({ data: { id: ids.foreignProject, organizationId: foreignOrganization.id, projectNumber: `QPF-${suffix}`, title: "QA fremder Terminwunsch", customer: "QA fremd", status: "Umsetzung", projectType: "Hausmeisterservice", projectKind: "Dauerprojekt", recurringBillingMode: "hourly", trade: "Hausmeisterservice", source: "qa-jarvis-planning-request-decision" } });
    const baseEntry = { organizationId: actor.organizationId, source: "manual", board: "OK immocare", groupName: "QA", userId: employee.id, employeeName: "QA Mitarbeitend", date: "2026-08-12", startTime: "08:00", endTime: "09:00", durationMinutes: 60, title: "QA Terminwunsch", description: "QA Entscheidung", projectId: ids.project, projectLabel: `QPR-${suffix} | QA Terminwunsch`, planningTrade: "Hausmeisterservice", approvalStatus: "requested", requestedByUserId: employee.id, requestedByName: "QA Mitarbeitend" };
    await prisma.planningEntry.createMany({ data: [
      { ...baseEntry, id: ids.approve, title: "QA Freigabe" },
      { ...baseEntry, id: ids.reject, title: "QA Ablehnung", startTime: "09:00", endTime: "10:00" },
      { ...baseEntry, id: ids.normal, title: "QA Normalroute", startTime: "10:00", endTime: "11:00" },
      { ...baseEntry, id: ids.cancel, title: "QA Terminabsage", approvalStatus: "confirmed", startTime: "12:00", endTime: "13:00", recurrenceId: `qa-series-${suffix}`, recurrenceRule: "weekly" },
      { ...baseEntry, id: ids.cancelNormal, title: "QA Terminabsage Normalroute", approvalStatus: "confirmed", startTime: "13:00", endTime: "14:00" },
      { ...baseEntry, id: ids.withdraw, title: "QA Terminwunsch zurückziehen", startTime: "15:00", endTime: "16:00", recurrenceId: `qa-withdraw-series-${suffix}`, recurrenceRule: "weekly" },
      { ...baseEntry, id: ids.withdrawNormal, title: "QA Terminwunsch zurückziehen Normalroute", startTime: "16:00", endTime: "17:00" },
      { ...baseEntry, id: ids.withdrawBypass, title: "QA Terminwunsch zurückziehen Altroute", startTime: "17:00", endTime: "18:00" },
      { ...baseEntry, id: ids.deleteBypass, title: "QA Terminabsage Altroute", approvalStatus: "confirmed", startTime: "14:00", endTime: "15:00" },
      { ...baseEntry, id: ids.bypass, title: "QA Altroute", startTime: "11:00", endTime: "12:00" },
      { ...baseEntry, id: ids.foreign, organizationId: foreignOrganization.id, projectId: ids.foreignProject, projectLabel: `QPF-${suffix} | QA fremd`, userId: null, requestedByUserId: null, title: "QA Fremdmandant" },
    ] });
    await prisma.notification.create({ data: { id: randomUUID(), organizationId: actor.organizationId, userId: actor.id, channel: "app", subject: "Terminwunsch freigeben", body: "QA offener Freigabehinweis", linkTarget: "planning-entry", linkTargetId: ids.withdraw, linkLabel: "Termin öffnen" } });

    const managerCookie = `workpilot_session=${token(ids.session)}`;
    const employeeCookie = `workpilot_session=${token(ids.employeeSession)}`;
    const employeeAttempt = await requestJson("/api/jarvis/chat", employeeCookie, { method: "POST", body: JSON.stringify({ actorId: employee.id, message: `Terminwunsch-ID ${ids.approve} freigeben` }) });
    assert(employeeAttempt.response.status === 200 && employeeAttempt.payload?.type === "refusal", "Mitarbeiter-Rollengrenze wurde nicht eingehalten.");
    const foreignAttempt = await requestJson("/api/jarvis/chat", managerCookie, { method: "POST", body: JSON.stringify({ actorId: actor.id, message: `Terminwunsch-ID ${ids.foreign} freigeben` }) });
    assert(foreignAttempt.payload?.type === "refusal", "Mandantengrenze wurde nicht eingehalten.");

    const prepared = await requestJson("/api/jarvis/chat", managerCookie, { method: "POST", body: JSON.stringify({ actorId: actor.id, message: `Terminwunsch-ID ${ids.approve} freigeben` }) });
    assert(prepared.response.ok && prepared.payload?.actionDraft?.actionId === "planning.request.manage", `Freigabeentwurf wurde nicht erzeugt: ${JSON.stringify(prepared.payload)}`);
    const approveDraft = prepared.payload.actionDraft; draftIds.add(approveDraft.previewId);
    const wrong = await requestJson(`/api/jarvis/action-drafts/${approveDraft.previewId}`, managerCookie, { method: "POST", headers: { "X-Jarvis-Action": "jarvis-action-draft-v2" }, body: JSON.stringify({ actorId: actor.id, actionId: "planning.request.manage", command: "confirm", revision: approveDraft.revision, confirmationText: "terminwunsch freigeben" }) });
    assert(wrong.response.status === 400, "Ungenaue Freigabephrase wurde nicht gesperrt.");
    const confirmed = await requestJson(`/api/jarvis/action-drafts/${approveDraft.previewId}`, managerCookie, { method: "POST", headers: { "X-Jarvis-Action": "jarvis-action-draft-v2" }, body: JSON.stringify({ actorId: actor.id, actionId: "planning.request.manage", command: "confirm", revision: approveDraft.revision, confirmationText: approveDraft.confirmation.requiredText }) });
    assert(confirmed.response.ok && confirmed.payload?.actionDraft?.state === "executed", "Terminwunsch wurde nicht freigegeben.");
    const replay = await requestJson(`/api/jarvis/action-drafts/${approveDraft.previewId}`, managerCookie, { method: "POST", headers: { "X-Jarvis-Action": "jarvis-action-draft-v2" }, body: JSON.stringify({ actorId: actor.id, actionId: "planning.request.manage", command: "confirm", revision: approveDraft.revision, confirmationText: approveDraft.confirmation.requiredText }) });
    assert(replay.response.ok && replay.payload?.actionDraft?.state === "executed", "Exactly-once-Replay der Freigabe fehlgeschlagen.");

    const rejectedPrepared = await requestJson("/api/jarvis/chat", managerCookie, { method: "POST", body: JSON.stringify({ actorId: actor.id, message: `Terminwunsch-ID ${ids.reject} ablehnen. Grund: Mitarbeiter bereits anderweitig eingeplant` }) });
    assert(rejectedPrepared.response.ok && rejectedPrepared.payload?.actionDraft?.decision === "reject", "Ablehnungsentwurf wurde nicht erzeugt.");
    const rejectDraft = rejectedPrepared.payload.actionDraft; draftIds.add(rejectDraft.previewId);
    const rejected = await requestJson(`/api/jarvis/action-drafts/${rejectDraft.previewId}`, managerCookie, { method: "POST", headers: { "X-Jarvis-Action": "jarvis-action-draft-v2" }, body: JSON.stringify({ actorId: actor.id, actionId: "planning.request.manage", command: "confirm", revision: rejectDraft.revision, confirmationText: rejectDraft.confirmation.requiredText }) });
    assert(rejected.response.ok && rejected.payload?.actionDraft?.state === "executed", "Terminwunsch wurde nicht abgelehnt.");

    const cancelPrepared = await requestJson("/api/jarvis/chat", managerCookie, { method: "POST", body: JSON.stringify({ actorId: actor.id, message: `Termin-ID ${ids.cancel} absagen. Grund: Kunde hat den Einsatz abgesagt` }) });
    assert(cancelPrepared.response.ok && cancelPrepared.payload?.actionDraft?.decision === "cancel", `Terminabsageentwurf wurde nicht erzeugt: ${JSON.stringify(cancelPrepared.payload)}`);
    const cancelDraft = cancelPrepared.payload.actionDraft; draftIds.add(cancelDraft.previewId);
    assert(cancelDraft.confirmation.requiredText === `TERMIN ABSAGEN ${ids.cancel}`, "Exakte Absagephrase ist falsch.");
    assert(cancelDraft.warnings?.some((warning) => warning.includes("nur für diesen")), "Serien-Einzelterminwarnung fehlt.");
    const cancelled = await requestJson(`/api/jarvis/action-drafts/${cancelDraft.previewId}`, managerCookie, { method: "POST", headers: { "X-Jarvis-Action": "jarvis-action-draft-v2" }, body: JSON.stringify({ actorId: actor.id, actionId: "planning.request.manage", command: "confirm", revision: cancelDraft.revision, confirmationText: cancelDraft.confirmation.requiredText }) });
    assert(cancelled.response.ok && cancelled.payload?.actionDraft?.state === "executed", "Bestätigter Termin wurde nicht abgesagt.");
    const cancelReplay = await requestJson(`/api/jarvis/action-drafts/${cancelDraft.previewId}`, managerCookie, { method: "POST", headers: { "X-Jarvis-Action": "jarvis-action-draft-v2" }, body: JSON.stringify({ actorId: actor.id, actionId: "planning.request.manage", command: "confirm", revision: cancelDraft.revision, confirmationText: cancelDraft.confirmation.requiredText }) });
    assert(cancelReplay.response.ok && cancelReplay.payload?.actionDraft?.state === "executed", "Exactly-once-Replay der Terminabsage fehlgeschlagen.");

    const withdrawPrepared = await requestJson("/api/jarvis/chat", employeeCookie, { method: "POST", body: JSON.stringify({ actorId: employee.id, message: `Terminwunsch-ID ${ids.withdraw} zurückziehen. Grund: Eigener Einsatz ist nicht mehr möglich` }) });
    assert(withdrawPrepared.response.ok && withdrawPrepared.payload?.actionDraft?.decision === "withdraw", `Rückzugsentwurf wurde nicht erzeugt: ${JSON.stringify(withdrawPrepared.payload)}`);
    const withdrawDraft = withdrawPrepared.payload.actionDraft; draftIds.add(withdrawDraft.previewId);
    assert(withdrawDraft.confirmation.requiredText === `TERMINWUNSCH ZURÜCKZIEHEN ${ids.withdraw}`, "Exakte Rückzugsphrase ist falsch.");
    const withdrawn = await requestJson(`/api/jarvis/action-drafts/${withdrawDraft.previewId}`, employeeCookie, { method: "POST", headers: { "X-Jarvis-Action": "jarvis-action-draft-v2" }, body: JSON.stringify({ actorId: employee.id, actionId: "planning.request.manage", command: "confirm", revision: withdrawDraft.revision, confirmationText: withdrawDraft.confirmation.requiredText }) });
    assert(withdrawn.response.ok && withdrawn.payload?.actionDraft?.state === "executed", "Eigener Terminwunsch wurde nicht zurückgezogen.");
    const withdrawReplay = await requestJson(`/api/jarvis/action-drafts/${withdrawDraft.previewId}`, employeeCookie, { method: "POST", headers: { "X-Jarvis-Action": "jarvis-action-draft-v2" }, body: JSON.stringify({ actorId: employee.id, actionId: "planning.request.manage", command: "confirm", revision: withdrawDraft.revision, confirmationText: withdrawDraft.confirmation.requiredText }) });
    assert(withdrawReplay.response.ok && withdrawReplay.payload?.actionDraft?.state === "executed", "Exactly-once-Replay des Rückzugs fehlgeschlagen.");

    const bypass = await requestJson("/api/planning-entries", managerCookie, { method: "POST", body: JSON.stringify({ actorUserId: actor.id, id: ids.bypass, approvalStatus: "confirmed" }) });
    assert(bypass.response.status === 409, "Der alte POST-Weg konnte einen Terminwunsch bestätigen.");
    const preflight = await requestJson("/api/planning-entries", managerCookie, { method: "PATCH", body: JSON.stringify({ command: "decision-preflight", actorUserId: actor.id, entryId: ids.normal, decision: "approve" }) });
    assert(preflight.response.ok && preflight.payload?.evaluation?.fingerprint, "Normalrouten-Prüfung fehlgeschlagen.");
    const normalRequestId = randomUUID();
    const normal = await requestJson("/api/planning-entries", managerCookie, { method: "PATCH", body: JSON.stringify({ command: "decision-execute", requestId: normalRequestId, expectedFingerprint: preflight.payload.evaluation.fingerprint, actorUserId: actor.id, entryId: ids.normal, decision: "approve" }) });
    assert(normal.response.ok && normal.payload?.result?.approvalStatus === "confirmed", "Gemeinsame Normalroute hat nicht freigegeben.");
    const cancelPreflight = await requestJson("/api/planning-entries", managerCookie, { method: "PATCH", body: JSON.stringify({ command: "decision-preflight", actorUserId: actor.id, entryId: ids.cancelNormal, decision: "cancel", reason: "Kunde hat den Einsatz abgesagt" }) });
    assert(cancelPreflight.response.ok && cancelPreflight.payload?.evaluation?.fingerprint, "Normalrouten-Absageprüfung fehlgeschlagen.");
    const cancelNormalRequestId = randomUUID();
    const cancelNormal = await requestJson("/api/planning-entries", managerCookie, { method: "PATCH", body: JSON.stringify({ command: "decision-execute", requestId: cancelNormalRequestId, expectedFingerprint: cancelPreflight.payload.evaluation.fingerprint, actorUserId: actor.id, entryId: ids.cancelNormal, decision: "cancel", reason: "Kunde hat den Einsatz abgesagt" }) });
    assert(cancelNormal.response.ok && cancelNormal.payload?.result?.approvalStatus === "cancelled", "Gemeinsame Normalroute hat den Termin nicht abgesagt.");
    const deleteBypass = await requestJson(`/api/planning-entries?id=${encodeURIComponent(ids.deleteBypass)}&actorUserId=${encodeURIComponent(actor.id)}`, managerCookie, { method: "DELETE" });
    assert(deleteBypass.response.status === 409, "Der alte DELETE-Weg konnte einen bestätigten Termin absagen.");
    const withdrawPreflight = await requestJson("/api/planning-entries", employeeCookie, { method: "PATCH", body: JSON.stringify({ command: "decision-preflight", actorUserId: employee.id, entryId: ids.withdrawNormal, decision: "withdraw", reason: "Eigener Einsatz ist nicht mehr möglich" }) });
    assert(withdrawPreflight.response.ok && withdrawPreflight.payload?.evaluation?.fingerprint, "Normalrouten-Rückzugsprüfung fehlgeschlagen.");
    const withdrawNormalRequestId = randomUUID();
    const withdrawNormal = await requestJson("/api/planning-entries", employeeCookie, { method: "PATCH", body: JSON.stringify({ command: "decision-execute", requestId: withdrawNormalRequestId, expectedFingerprint: withdrawPreflight.payload.evaluation.fingerprint, actorUserId: employee.id, entryId: ids.withdrawNormal, decision: "withdraw", reason: "Eigener Einsatz ist nicht mehr möglich" }) });
    assert(withdrawNormal.response.ok && withdrawNormal.payload?.result?.approvalStatus === "withdrawn", "Gemeinsame Normalroute hat den Terminwunsch nicht zurückgezogen.");
    const withdrawDeleteBypass = await requestJson(`/api/planning-entries?id=${encodeURIComponent(ids.withdrawBypass)}&actorUserId=${encodeURIComponent(employee.id)}`, employeeCookie, { method: "DELETE" });
    assert(withdrawDeleteBypass.response.status === 409, "Der alte DELETE-Weg konnte einen offenen Terminwunsch zurückziehen.");

    const rows = await prisma.planningEntry.findMany({ where: { id: { in: entryIds } }, select: { id: true, approvalStatus: true, deletedAt: true } });
    assert(rows.find((row) => row.id === ids.approve)?.approvalStatus === "confirmed", "Freigabestatus fehlt.");
    assert(Boolean(rows.find((row) => row.id === ids.reject)?.deletedAt), "Ablehnung wurde nicht logisch markiert.");
    assert(Boolean(rows.find((row) => row.id === ids.cancel)?.deletedAt), "JARVIS-Terminabsage wurde nicht logisch markiert.");
    assert(Boolean(rows.find((row) => row.id === ids.cancelNormal)?.deletedAt), "Normalrouten-Terminabsage wurde nicht logisch markiert.");
    assert(!rows.find((row) => row.id === ids.deleteBypass)?.deletedAt, "Alte DELETE-Route hat den bestätigten Termin verändert.");
    assert(Boolean(rows.find((row) => row.id === ids.withdraw)?.deletedAt), "JARVIS-Rückzug wurde nicht logisch markiert.");
    assert(Boolean(rows.find((row) => row.id === ids.withdrawNormal)?.deletedAt), "Normalrouten-Rückzug wurde nicht logisch markiert.");
    assert(!rows.find((row) => row.id === ids.withdrawBypass)?.deletedAt, "Alte DELETE-Route hat den offenen Wunsch verändert.");
    assert(rows.find((row) => row.id === ids.bypass)?.approvalStatus === "requested", "Altrouten-Sperre hat den Wunsch verändert.");
    const histories = await prisma.planningEntryHistory.findMany({ where: { planningEntryId: { in: [ids.approve, ids.reject, ids.normal, ids.cancel, ids.cancelNormal, ids.withdraw, ids.withdrawNormal] } } });
    assert(histories.filter((item) => item.planningEntryId === ids.approve && item.eventType === "approved").length === 1, "Freigabehistorie ist nicht exactly-once.");
    assert(histories.filter((item) => item.planningEntryId === ids.reject && item.eventType === "rejected").length === 1, "Ablehnungshistorie ist nicht exactly-once.");
    assert(histories.filter((item) => item.planningEntryId === ids.cancel && item.eventType === "cancelled").length === 1, `JARVIS-Absagehistorie ist nicht exactly-once: ${JSON.stringify(histories.filter((item) => item.planningEntryId === ids.cancel))}`);
    assert(histories.filter((item) => item.planningEntryId === ids.cancelNormal && item.eventType === "cancelled").length === 1, `Normalrouten-Absagehistorie fehlt: ${JSON.stringify(histories.filter((item) => item.planningEntryId === ids.cancelNormal))}`);
    assert(histories.filter((item) => item.planningEntryId === ids.withdraw && item.eventType === "withdrawn").length === 1, "JARVIS-Rückzugshistorie ist nicht exactly-once.");
    assert(histories.filter((item) => item.planningEntryId === ids.withdrawNormal && item.eventType === "withdrawn").length === 1, "Normalrouten-Rückzugshistorie fehlt.");
    const resolvedRequestNotice = await prisma.notification.findFirst({ where: { linkTargetId: ids.withdraw, subject: "Terminwunsch freigeben" }, select: { resolvedAt: true } });
    assert(Boolean(resolvedRequestNotice?.resolvedAt), "Offener Freigabehinweis wurde beim Rückzug nicht aufgelöst.");
    const notificationCount = await prisma.notification.count({ where: { linkTargetId: { in: [ids.approve, ids.reject, ids.normal, ids.cancel, ids.cancelNormal] }, subject: { in: ["Terminwunsch bestätigt", "Terminwunsch abgelehnt", "Planungstermin abgesagt"] } } });
    assert(notificationCount >= 5, "Mitarbeiterhinweise fehlen.");
    result = { ok: true, baseUrl, actorRole: actor.role, roleBoundary: "verified", tenantBoundary: "verified", selfWithdrawal: true, exactPhrase: true, exactlyOnce: true, normalApiSharedService: true, oldRouteBypassBlocked: true, oldDeleteBypassBlocked: true, employeeNotifications: notificationCount, executions: histories.length };
  } finally {
    await prisma.notification.deleteMany({ where: { linkTargetId: { in: entryIds } } });
    await prisma.projectLogbookEntry.deleteMany({ where: { projectId: { in: projectIds }, source: "planning-request-decision" } });
    await prisma.jarvisActionDraftAuditEvent.deleteMany({ where: { draftId: { in: Array.from(draftIds) } } });
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: Array.from(draftIds) } } });
    await prisma.planningEntryHistory.deleteMany({ where: { planningEntryId: { in: entryIds } } });
    await prisma.planningEntry.deleteMany({ where: { id: { in: entryIds } } });
    await prisma.authSession.deleteMany({ where: { id: { in: sessionIds } } });
    await prisma.workPilotProject.deleteMany({ where: { id: { in: projectIds } } });
    if (ownsForeignOrganization) await prisma.organization.deleteMany({ where: { id: foreignOrganization.id } });
  }
  const residue = {
    drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: Array.from(draftIds) } } }),
    entries: await prisma.planningEntry.count({ where: { id: { in: entryIds } } }),
    histories: await prisma.planningEntryHistory.count({ where: { planningEntryId: { in: entryIds } } }),
    projects: await prisma.workPilotProject.count({ where: { id: { in: projectIds } } }),
    sessions: await prisma.authSession.count({ where: { id: { in: sessionIds } } }),
  };
  console.log(JSON.stringify({ ...result, residue }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
