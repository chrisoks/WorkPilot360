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
  const employee = await prisma.user.findFirst({ where: { organizationId: actor.organizationId, role: Role.MITARBEITER, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, firstName: true, lastName: true } });
  const now = new Date();
  const suffix = Date.now().toString().slice(-9);
  const projectId = randomUUID();
  const sessionId = randomUUID();
  const employeeSessionId = randomUUID();
  const recurrenceId = `qa-series-move-${suffix}`;
  const apiRecurrenceId = `qa-series-api-${suffix}`;
  const conflictRecurrenceId = `qa-series-conflict-${suffix}`;
  const ids = {
    earlier: randomUUID(), anchor: randomUUID(), anchorSecond: randomUUID(), later: randomUUID(), laterSecond: randomUUID(),
    apiAnchor: randomUUID(), apiLater: randomUUID(), conflictAnchor: randomUUID(), conflictLater: randomUUID(), blocker: randomUUID(),
  };
  const entryIds = Object.values(ids);
  const createdEntryIds = [];
  const draftIds = new Set();
  const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
  const employeeId = employee?.id || actor.id;
  const employeeName = employee ? [employee.firstName, employee.lastName].filter(Boolean).join(" ") : actorName;
  const hasSecondEmployee = employeeId !== actor.id;
  let result;

  await prisma.authSession.createMany({ data: [sessionData(sessionId, actor.id, now), ...(employee ? [sessionData(employeeSessionId, employee.id, now)] : [])] });
  await prisma.workPilotProject.create({ data: {
    id: projectId, organizationId: actor.organizationId, projectNumber: `QPS-${suffix}`, title: "QA JARVIS Terminserienverschiebung",
    customer: "QA intern", status: "Umsetzung", projectType: "Hausmeisterservice", projectKind: "Dauerprojekt", recurringBillingMode: "hourly",
    trade: "Hausmeisterservice", branch: "OK immocare", responsibleName: actorName, source: "qa-jarvis-planning-series-move",
  } });
  const base = {
    organizationId: actor.organizationId, source: "manual", board: "OK immocare", groupName: "QA", userId: employeeId, employeeName,
    startTime: "08:00", endTime: "09:00", durationMinutes: 60, title: "QA Serienverschiebung", description: "QA Serienausgang",
    projectId, projectLabel: `QPS-${suffix} | QA JARVIS Terminserienverschiebung`, planningTrade: "Hausmeisterservice", approvalStatus: "confirmed",
    approvedByUserId: actor.id, approvedAt: now, recurrenceRule: "weekly",
  };
  const entries = [
    { ...base, id: ids.earlier, date: "2026-09-01", recurrenceId },
    { ...base, id: ids.anchor, date: "2026-09-08", recurrenceId },
    { ...base, id: ids.later, date: "2026-09-15", recurrenceId },
    { ...base, id: ids.apiAnchor, date: "2026-10-01", recurrenceId: apiRecurrenceId, title: "QA Serien-API" },
    { ...base, id: ids.apiLater, date: "2026-10-08", recurrenceId: apiRecurrenceId, title: "QA Serien-API" },
    { ...base, id: ids.conflictAnchor, date: "2026-11-01", recurrenceId: conflictRecurrenceId, title: "QA Serienkonflikt" },
    { ...base, id: ids.conflictLater, date: "2026-11-08", recurrenceId: conflictRecurrenceId, title: "QA Serienkonflikt" },
    { ...base, id: ids.blocker, date: "2026-11-09", recurrenceId: null, recurrenceRule: null, title: "QA Blocker" },
  ];
  if (hasSecondEmployee) {
    entries.push(
      { ...base, id: ids.anchorSecond, date: "2026-09-08", recurrenceId, userId: actor.id, employeeName: actorName },
      { ...base, id: ids.laterSecond, date: "2026-09-15", recurrenceId, userId: actor.id, employeeName: actorName },
    );
  }
  createdEntryIds.push(...entries.map((item) => item.id));
  await prisma.planningEntry.createMany({ data: entries });

  const cookie = `workpilot_session=${token(sessionId)}`;
  const chat = async (message, requestCookie = cookie, actorId = actor.id) => {
    const value = await requestJson("/api/jarvis/chat", requestCookie, { method: "POST", body: JSON.stringify({ actorId, message, context: { activeTab: "planning", activeMainView: "planning" } }) });
    if (value.payload?.actionDraft?.previewId) draftIds.add(value.payload.actionDraft.previewId);
    return value;
  };
  const command = (draft, phrase) => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, {
    method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
    body: JSON.stringify({ actorId: actor.id, actionId: "planning.move", command: "confirm", revision: draft.revision, confirmationText: phrase }),
  });

  try {
    if (employee) {
      const denied = await chat(`Verschiebe die komplette Terminserie ab Termin ${ids.anchor} auf 09.09.2026 von 09:00 bis 10:00. Grund: QA Rollenprüfung.`, `workpilot_session=${token(employeeSessionId)}`, employee.id);
      assert(denied.response.ok && !denied.payload?.actionDraft, `Mitarbeitende erhielten Serienverwaltung: ${JSON.stringify(denied.payload)}`);
    }

    const previewResponse = await chat(`Verschiebe die komplette Terminserie ab Termin ${ids.anchor} auf 09.09.2026 von 09:00 bis 10:00. Grund: Objektzugang dauerhaft geändert.`);
    const draft = previewResponse.payload?.actionDraft;
    assert(draft?.scope === "series_from_entry" && draft.confirmation?.enabled, `Serienvorschau fehlt: ${JSON.stringify(previewResponse.payload)}`);
    assert(draft.confirmation.requiredText === `TERMIN-SERIE VERSCHIEBEN ${ids.anchor}`, "Exakte Serienphrase ist falsch.");
    const expectedAffected = hasSecondEmployee ? 4 : 2;
    const scopeField = draft.fields?.find((field) => field.label === "Serienumfang")?.value;
    assert(scopeField?.includes(`${expectedAffected} Termine`), `Falscher Serienumfang in Vorschau: ${scopeField}`);
    assert(scopeField?.includes(`${hasSecondEmployee ? 2 : 1} Mitarbeitende`), "Mitarbeitendenumfang ist falsch.");
    assert(draft.warnings?.some((warning) => warning.toLowerCase().includes("frühere serien")), "Hinweis auf unveränderte frühere Termine fehlt.");
    const wrong = await command(draft, `TERMIN VERSCHIEBEN ${ids.anchor}`);
    assert(wrong.response.status === 400, "Einzelterminphrase hat die Serie freigegeben.");
    const executed = await command(draft, draft.confirmation.requiredText);
    assert(executed.response.ok && executed.payload?.actionDraft?.state === "executed", `Serienausführung fehlgeschlagen: ${JSON.stringify(executed.payload)}`);
    const replay = await command(draft, draft.confirmation.requiredText);
    assert(replay.response.ok && replay.payload?.actionDraft?.state === "executed", "Serien-Replay ist nicht idempotent.");
    const saved = await prisma.planningEntry.findMany({ where: { id: { in: createdEntryIds } }, orderBy: [{ date: "asc" }, { id: "asc" }] });
    const byId = new Map(saved.map((item) => [item.id, item]));
    assert(byId.get(ids.earlier)?.date === "2026-09-01" && byId.get(ids.earlier)?.startTime === "08:00", "Früherer Serientermin wurde verändert.");
    for (const id of [ids.anchor, ...(hasSecondEmployee ? [ids.anchorSecond] : [])]) assert(byId.get(id)?.date === "2026-09-09" && byId.get(id)?.startTime === "09:00" && byId.get(id)?.endTime === "10:00", `Anker ${id} wurde falsch verschoben.`);
    for (const id of [ids.later, ...(hasSecondEmployee ? [ids.laterSecond] : [])]) assert(byId.get(id)?.date === "2026-09-16" && byId.get(id)?.startTime === "09:00" && byId.get(id)?.endTime === "10:00", `Folgetermin ${id} wurde falsch verschoben.`);
    assert(await prisma.planningEntryHistory.count({ where: { planningEntryId: { in: createdEntryIds }, eventType: "series_moved" } }) === expectedAffected, "Serienhistorie ist nicht exactly-once.");

    const apiPreflight = await requestJson("/api/planning-entries", cookie, { method: "PATCH", body: JSON.stringify({ command: "preflight", scope: "series_from_entry", actorUserId: actor.id, entryId: ids.apiAnchor, date: "2026-10-03", startTime: "10:00", endTime: "11:00", reason: "QA normale Oberfläche Serie" }) });
    assert(apiPreflight.response.ok && apiPreflight.payload?.evaluation?.series?.count === 2, `Serien-API-Vorprüfung fehlgeschlagen: ${JSON.stringify(apiPreflight.payload)}`);
    const apiMoved = await requestJson("/api/planning-entries", cookie, { method: "PATCH", body: JSON.stringify({ command: "execute", scope: "series_from_entry", actorUserId: actor.id, entryId: ids.apiAnchor, date: "2026-10-03", startTime: "10:00", endTime: "11:00", reason: "QA normale Oberfläche Serie", requestId: randomUUID(), expectedFingerprint: apiPreflight.payload.evaluation.fingerprint }) });
    assert(apiMoved.response.ok && apiMoved.payload?.affectedEntryIds?.length === 2, `Serien-API-Ausführung fehlgeschlagen: ${JSON.stringify(apiMoved.payload)}`);

    const durationRejected = await requestJson("/api/planning-entries", cookie, { method: "PATCH", body: JSON.stringify({ command: "preflight", scope: "series_from_entry", actorUserId: actor.id, entryId: ids.conflictAnchor, date: "2026-11-02", startTime: "08:00", endTime: "10:00", reason: "QA Daueränderung" }) });
    assert(durationRejected.response.status === 409, "Daueränderung wurde als Serienverschiebung akzeptiert.");
    const conflictRejected = await requestJson("/api/planning-entries", cookie, { method: "PATCH", body: JSON.stringify({ command: "preflight", scope: "series_from_entry", actorUserId: actor.id, entryId: ids.conflictAnchor, date: "2026-11-02", startTime: "08:00", endTime: "09:00", reason: "QA Konflikt" }) });
    assert(conflictRejected.response.status === 409, `Konflikt in Folgetermin blockierte nicht atomar: ${JSON.stringify(conflictRejected.payload)}`);
    const unchangedConflict = await prisma.planningEntry.findMany({ where: { id: { in: [ids.conflictAnchor, ids.conflictLater] } }, orderBy: { date: "asc" } });
    assert(unchangedConflict.map((item) => item.date).join(",") === "2026-11-01,2026-11-08", "Blockierte Serie wurde teilweise verändert.");

    result = {
      baseUrl, actorRole: actor.role, roleBoundary: employee ? "verified" : "no-active-employee", exactPhrase: true,
      selectedAndFollowing: true, earlierUnchanged: true, employeeCount: hasSecondEmployee ? 2 : 1, affectedEntries: expectedAffected,
      atomicConflictRollback: true, durationChangeRejected: true, exactlyOnce: true, normalApiSharedService: true,
    };
  } finally {
    await prisma.notification.deleteMany({ where: { linkTarget: "planning-entry", linkTargetId: { in: createdEntryIds } } });
    await prisma.projectLogbookEntry.deleteMany({ where: { projectId, source: "planning-entry-move" } });
    await prisma.planningEntryHistory.deleteMany({ where: { planningEntryId: { in: createdEntryIds } } });
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    await prisma.planningEntry.deleteMany({ where: { id: { in: createdEntryIds } } });
    await prisma.workPilotProject.deleteMany({ where: { id: projectId } });
    await prisma.authSession.deleteMany({ where: { id: { in: [sessionId, employeeSessionId] } } });
  }
  const residue = {
    drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }),
    entries: await prisma.planningEntry.count({ where: { id: { in: createdEntryIds } } }),
    histories: await prisma.planningEntryHistory.count({ where: { planningEntryId: { in: createdEntryIds } } }),
    logbook: await prisma.projectLogbookEntry.count({ where: { projectId, source: "planning-entry-move" } }),
    projects: await prisma.workPilotProject.count({ where: { id: projectId } }),
    sessions: await prisma.authSession.count({ where: { id: { in: [sessionId, employeeSessionId] } } }),
  };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ok: true, ...result, residue }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
