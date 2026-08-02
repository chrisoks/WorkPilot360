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
  const foreignExisting = await prisma.organization.findFirst({ where: { id: { not: actor.organizationId } }, select: { id: true } });
  const foreignOrganization = foreignExisting || await prisma.organization.create({ data: { id: randomUUID(), name: "QA JARVIS Fremdmandant Planung", slug: `qa-planning-${randomUUID().replace(/-/g, "").slice(0, 12)}` }, select: { id: true } });
  const ownsForeignOrganization = !foreignExisting;
  const now = new Date(); const suffix = Date.now().toString().slice(-9);
  const ids = {
    project: randomUUID(), foreignProject: randomUUID(), session: randomUUID(), secondSession: randomUUID(), employeeSession: randomUUID(),
    main: randomUUID(), cancel: randomUUID(), series: randomUUID(), api: randomUUID(), bypass: randomUUID(), foreign: randomUUID(),
  };
  const entryIds = [ids.main, ids.cancel, ids.series, ids.api, ids.bypass, ids.foreign];
  const sessionIds = [ids.session, ids.secondSession, ids.employeeSession];
  const projectIds = [ids.project, ids.foreignProject];
  const draftIds = new Set();
  const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
  const employeeId = employee?.id || actor.id;
  let result;

  await prisma.authSession.createMany({ data: [sessionData(ids.session, actor.id, now), sessionData(ids.secondSession, actor.id, now), ...(employee ? [sessionData(ids.employeeSession, employee.id, now)] : [])] });
  await prisma.workPilotProject.create({ data: {
    id: ids.project, organizationId: actor.organizationId, projectNumber: `QPM-${suffix}`, title: "QA JARVIS Terminverschiebung",
    customer: "QA intern", status: "Umsetzung", projectType: "Hausmeisterservice", projectKind: "Dauerprojekt",
    recurringBillingMode: "hourly", trade: "Hausmeisterservice", branch: "OK immocare", responsibleName: actorName,
    source: "qa-jarvis-planning-move",
  } });
  await prisma.workPilotProject.create({ data: {
    id: ids.foreignProject, organizationId: foreignOrganization.id, projectNumber: `QPF-${suffix}`, title: "QA Fremdmandant Planung",
    customer: "QA fremd", status: "Umsetzung", projectType: "Hausmeisterservice", projectKind: "Dauerprojekt",
    recurringBillingMode: "hourly", trade: "Hausmeisterservice", source: "qa-jarvis-planning-move",
  } });
  const baseEntry = {
    organizationId: actor.organizationId, source: "manual", board: "OK immocare", groupName: "QA",
    userId: employeeId, employeeName: "QA Mitarbeitend", startTime: "08:00", endTime: "09:00", durationMinutes: 60,
    title: "QA Terminverschiebung", description: "QA Ausgangstermin", projectId: ids.project,
    projectLabel: `QPM-${suffix} | QA JARVIS Terminverschiebung`, planningTrade: "Hausmeisterservice", approvalStatus: "confirmed",
    approvedByUserId: actor.id, approvedAt: now,
  };
  await prisma.planningEntry.createMany({ data: [
    { ...baseEntry, id: ids.main, date: "2026-08-10" },
    { ...baseEntry, id: ids.cancel, date: "2026-08-11", title: "QA Abbruch" },
    { ...baseEntry, id: ids.series, date: "2026-08-12", title: "QA Serie", recurrenceId: `series-${suffix}`, recurrenceRule: "weekly" },
    { ...baseEntry, id: ids.api, date: "2026-08-13", title: "QA API" },
    { ...baseEntry, id: ids.bypass, date: "2026-08-14", title: "QA Bypass" },
    { ...baseEntry, id: ids.foreign, organizationId: foreignOrganization.id, projectId: ids.foreignProject, projectLabel: `QPF-${suffix} | QA Fremdmandant`, userId: null, date: "2026-08-15", title: "QA Fremdmandant" },
  ] });

  const cookie = `workpilot_session=${token(ids.session)}`;
  const secondCookie = `workpilot_session=${token(ids.secondSession)}`;
  const chat = async (message, requestCookie = cookie, actorId = actor.id) => {
    const value = await requestJson("/api/jarvis/chat", requestCookie, { method: "POST", body: JSON.stringify({ actorId, message, context: { activeTab: "planning", activeMainView: "planning" } }) });
    if (value.payload?.actionDraft?.previewId) draftIds.add(value.payload.actionDraft.previewId);
    return value;
  };
  const command = (draft, name, phrase = "", requestCookie = cookie) => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, requestCookie, {
    method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
    body: JSON.stringify({ actorId: actor.id, actionId: "planning.move", command: name, revision: draft.revision, confirmationText: phrase }),
  });

  try {
    if (employee) {
      const denied = await chat(`Verschiebe Termin ${ids.main} auf 16.08.2026 von 09:00 bis 10:00. Grund: QA Rollenprüfung.`, `workpilot_session=${token(ids.employeeSession)}`, employee.id);
      assert(denied.response.ok && !denied.payload?.actionDraft, `Mitarbeitende erhielten JARVIS-Terminverwaltung: ${JSON.stringify(denied.payload)}`);
    }
    const foreign = await chat(`Verschiebe Termin ${ids.foreign} auf 16.08.2026 von 09:00 bis 10:00. Grund: QA Mandantenprüfung.`);
    assert(!foreign.payload?.actionDraft, "Fremdmandanten-Termin war über JARVIS erreichbar.");

    const cancellableResponse = await chat(`Verschiebe Termin ${ids.cancel} auf 17.08.2026 von 09:00 bis 10:00. Grund: QA Abbruchprüfung.`);
    const cancellable = cancellableResponse.payload?.actionDraft;
    assert(cancellable?.actionId === "planning.move", `Keine Verschiebevorschau für Abbruch: ${JSON.stringify(cancellableResponse.payload)}`);
    const cancelled = await command(cancellable, "cancel");
    assert(cancelled.response.ok && cancelled.payload?.actionDraft?.state === "cancelled", "Terminverschiebung konnte nicht abgebrochen werden.");
    assert((await prisma.planningEntry.findUniqueOrThrow({ where: { id: ids.cancel } })).date === "2026-08-11", "Abbruch hat den Termin verändert.");

    const mainResponse = await chat(`Verschiebe Termin ${ids.main} auf 18.08.2026 von 09:15 bis 10:30. Grund: Kunde kann erst später.`);
    const draft = mainResponse.payload?.actionDraft;
    assert(draft?.actionId === "planning.move" && draft.confirmation?.enabled, `JARVIS-Verschiebevorschau fehlt: ${JSON.stringify(mainResponse.payload)}`);
    assert(draft.confirmation.requiredText === `TERMIN VERSCHIEBEN ${ids.main}`, "Exakte Terminphrase ist falsch.");
    for (const label of ["Termin-ID", "Terminart", "Titel", "Projekt", "Mitarbeitend", "Bisher", "Neu", "Grund"]) assert(draft.fields?.some((field) => field.label === label), `Vorschaufeld ${label} fehlt.`);
    const wrong = await command(draft, "confirm", draft.confirmation.requiredText.toLowerCase());
    assert(wrong.response.status === 400, "Ungenaue Terminphrase wurde akzeptiert.");
    const crossSession = await command(draft, "confirm", draft.confirmation.requiredText, secondCookie);
    assert(crossSession.response.status === 403, "Terminverschiebung war nicht sitzungsgebunden.");
    const moved = await command(draft, "confirm", draft.confirmation.requiredText);
    assert(moved.response.ok && moved.payload?.actionDraft?.state === "executed", `JARVIS-Terminverschiebung fehlgeschlagen: ${JSON.stringify(moved.payload)}`);
    const replay = await command(draft, "confirm", draft.confirmation.requiredText);
    assert(replay.response.ok && replay.payload?.actionDraft?.state === "executed", "JARVIS-Replay ist nicht idempotent.");
    const saved = await prisma.planningEntry.findUniqueOrThrow({ where: { id: ids.main } });
    assert(saved.date === "2026-08-18" && saved.startTime === "09:15" && saved.endTime === "10:30" && saved.durationMinutes === 75, "Termin wurde fachlich falsch verschoben.");
    assert(await prisma.planningEntryHistory.count({ where: { planningEntryId: ids.main, eventType: "moved" } }) === 1, "Verschiebehistorie ist nicht exactly-once.");
    assert(await prisma.projectLogbookEntry.count({ where: { projectId: ids.project, source: "planning-entry-move", callReference: draft.previewId } }) === 1, "Projektlogbuch ist nicht exactly-once.");

    const seriesResponse = await chat(`Verschiebe Termin ${ids.series} auf 19.08.2026 von 10:00 bis 11:00. Grund: Einzelner Serientermin kollidiert.`);
    const seriesDraft = seriesResponse.payload?.actionDraft;
    assert(seriesDraft?.warnings?.some((warning) => warning.toLowerCase().includes("serie")), "Serienkontext wurde nicht sichtbar gewarnt.");
    const seriesMoved = await command(seriesDraft, "confirm", seriesDraft.confirmation.requiredText);
    assert(seriesMoved.response.ok, "Einzelner Serientermin wurde nicht verschoben.");
    const savedSeries = await prisma.planningEntry.findUniqueOrThrow({ where: { id: ids.series } });
    assert(savedSeries.date === "2026-08-19" && savedSeries.recurrenceId === `series-${suffix}` && savedSeries.recurrenceRule === "weekly", "Serienzuordnung wurde verändert.");

    const preflight = await requestJson("/api/planning-entries", cookie, { method: "PATCH", body: JSON.stringify({ command: "preflight", actorUserId: actor.id, entryId: ids.api, date: "2026-08-20", startTime: "11:00", endTime: "12:00", reason: "QA normale Oberfläche" }) });
    assert(preflight.response.ok && preflight.payload?.evaluation?.fingerprint, `Normale API-Vorprüfung fehlgeschlagen: ${JSON.stringify(preflight.payload)}`);
    const apiMoved = await requestJson("/api/planning-entries", cookie, { method: "PATCH", body: JSON.stringify({ command: "execute", actorUserId: actor.id, entryId: ids.api, date: "2026-08-20", startTime: "11:00", endTime: "12:00", reason: "QA normale Oberfläche", requestId: randomUUID(), expectedFingerprint: preflight.payload.evaluation.fingerprint }) });
    assert(apiMoved.response.ok && apiMoved.payload?.entry?.date === "2026-08-20", `Normale API-Verschiebung fehlgeschlagen: ${JSON.stringify(apiMoved.payload)}`);
    const bypass = await requestJson("/api/planning-entries", cookie, { method: "POST", body: JSON.stringify({ id: ids.bypass, actorUserId: actor.id, date: "2026-08-21", startTime: "12:00", endTime: "13:00" }) });
    assert(bypass.response.status === 409, "Direkte Zeitänderung über die alte Speicherroute wurde nicht blockiert.");
    assert((await prisma.planningEntry.findUniqueOrThrow({ where: { id: ids.bypass } })).date === "2026-08-14", "Bypass hat den Termin verändert.");

    const executions = await prisma.jarvisActionDraftAuditEvent.count({ where: { draftId: { in: [...draftIds] }, eventType: "draft_confirmed_and_executed" } });
    assert(executions === 2, `JARVIS-Ausführungsaudit ist nicht exactly-once: ${executions}`);
    const notifications = await prisma.notification.count({ where: { linkTarget: "planning-entry", linkTargetId: { in: [ids.main, ids.series, ids.api] }, userId: employeeId } });
    assert(employee ? notifications === 3 : notifications === 0, `Verknüpfte Verschiebungsbenachrichtigungen sind unvollständig oder doppelt: ${notifications}`);
    result = { baseUrl, actorRole: actor.role, roleBoundary: employee ? "verified" : "no-active-employee", tenantBoundary: "verified", cancellation: true, exactPhrase: true, sessionBinding: true, exactlyOnce: true, seriesPreserved: true, normalApiSharedService: true, employeeNotifications: notifications, oldRouteBypassBlocked: true, executions };
  } finally {
    await prisma.notification.deleteMany({ where: { linkTarget: "planning-entry", linkTargetId: { in: entryIds } } });
    await prisma.projectLogbookEntry.deleteMany({ where: { projectId: { in: projectIds }, source: "planning-entry-move" } });
    await prisma.planningEntryHistory.deleteMany({ where: { planningEntryId: { in: entryIds } } });
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    await prisma.planningEntry.deleteMany({ where: { id: { in: entryIds } } });
    await prisma.workPilotProject.deleteMany({ where: { id: { in: projectIds } } });
    await prisma.authSession.deleteMany({ where: { id: { in: sessionIds } } });
    if (ownsForeignOrganization) await prisma.organization.deleteMany({ where: { id: foreignOrganization.id } });
  }
  const residue = {
    drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }),
    entries: await prisma.planningEntry.count({ where: { id: { in: entryIds } } }),
    histories: await prisma.planningEntryHistory.count({ where: { planningEntryId: { in: entryIds } } }),
    logbook: await prisma.projectLogbookEntry.count({ where: { projectId: { in: projectIds }, source: "planning-entry-move" } }),
    projects: await prisma.workPilotProject.count({ where: { id: { in: projectIds } } }),
    sessions: await prisma.authSession.count({ where: { id: { in: sessionIds } } }),
    organizations: ownsForeignOrganization ? await prisma.organization.count({ where: { id: foreignOrganization.id } }) : 0,
  };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ok: true, ...result, residue }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
