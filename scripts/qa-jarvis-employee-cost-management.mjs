import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = (process.argv.find((item) => item.startsWith("--base-url="))?.split("=")[1] || "http://localhost:3001").replace(/\/$/, "");
const secret = process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
if (!secret) throw new Error("WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET fehlt.");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const token = (sessionId) => { const value = `v2.${sessionId}.1`; return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`; };
const sessionData = (id, userId, at) => ({ id, userId, tokenVersion: 1, createdAt: at, lastSeenAt: at, lastRotatedAt: at, idleExpiresAt: new Date(at.getTime() + 3_600_000), absoluteExpiresAt: new Date(at.getTime() + 3_600_000) });
const requestJson = async (path, cookie, init = {}) => { const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", Origin: baseUrl, Cookie: cookie, ...(init.headers || {}) } }); return { response, payload: await response.json().catch(() => null) }; };

async function main() {
  const actor = await prisma.user.findFirst({ where: { role: Role.GESCHAEFTSFUEHRER, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, organizationId: true } });
  if (!actor) throw new Error("Kein aktiver Geschäftsführungs-Testakteur gefunden.");
  const employeeActor = await prisma.user.findFirst({ where: { organizationId: actor.organizationId, role: Role.MITARBEITER, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const foreignOrganization = await prisma.organization.findFirst({ where: { id: { not: actor.organizationId } }, select: { id: true } });
  const now = new Date(); const suffix = Date.now().toString().slice(-9);
  const ids = { actorSession: randomUUID(), employeeSession: randomUUID(), target: randomUUID(), staleTarget: randomUUID(), foreignTarget: randomUUID(), history: randomUUID(), activeStamp: randomUUID() };
  const draftIds = new Set(); let result;
  const targetEmail = `qa-cost-${suffix}@example.test`; const staleEmail = `qa-cost-stale-${suffix}@example.test`; const foreignEmail = `qa-cost-foreign-${suffix}@example.test`;
  await prisma.user.createMany({ data: [
    { id: ids.target, organizationId: actor.organizationId, firstName: "QA", lastName: "Kosten", email: targetEmail, passwordHash: "qa-not-used", role: Role.MITARBEITER, isActive: true, personalNumber: `QAC-${suffix}` },
    { id: ids.staleTarget, organizationId: actor.organizationId, firstName: "QA", lastName: "Kosten-Stale", email: staleEmail, passwordHash: "qa-not-used", role: Role.MITARBEITER, isActive: true, personalNumber: `QACS-${suffix}` },
    ...(foreignOrganization ? [{ id: ids.foreignTarget, organizationId: foreignOrganization.id, firstName: "QA", lastName: "Kosten-Fremd", email: foreignEmail, passwordHash: "qa-not-used", role: Role.MITARBEITER, isActive: true }] : []),
  ] });
  await prisma.employeeCostCalculation.create({ data: { organizationId: actor.organizationId, userId: ids.staleTarget, monthlySalary: 3000, fullCostFactor: 1.35, annualHours: 2080, vacationDays: 30, trainingDays: 0, sickDays: 10, hoursPerDay: 8 } });
  await prisma.projectTimeEntry.create({ data: { id: ids.history, organizationId: actor.organizationId, projectId: `qa-cost-project-${suffix}`, userId: ids.target, employee: "QA Kosten", date: "2026-08-01", startTime: "08:00", endTime: "09:00", durationMs: 3_600_000n, laborCostRateSnapshot: 25, laborCostSnapshot: 25, costSnapshotAt: now } });
  await prisma.activeStampSession.create({ data: { id: ids.activeStamp, organizationId: actor.organizationId, userId: ids.target, employee: "QA Kosten", projectId: `qa-cost-project-${suffix}`, startedAt: now } });
  await prisma.authSession.createMany({ data: [sessionData(ids.actorSession, actor.id, now), ...(employeeActor ? [sessionData(ids.employeeSession, employeeActor.id, now)] : [])] });
  const cookie = `workpilot_session=${token(ids.actorSession)}`;
  try {
    const createDraft = async (message, requestCookie = cookie, actorId = actor.id) => { const response = await requestJson("/api/jarvis/chat", requestCookie, { method: "POST", body: JSON.stringify({ actorId, message, context: { activeTab: "dashboard", activeMainView: "dashboard" } }) }); if (response.payload?.actionDraft?.previewId) draftIds.add(response.payload.actionDraft.previewId); return response; };
    const command = async (draft, name, phrase = "") => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, { method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" }, body: JSON.stringify({ actorId: actor.id, actionId: "payroll.manage", command: name, revision: draft.revision, confirmationText: phrase }) });

    const uiWrite = await requestJson("/api/employee-costs", cookie, { method: "PUT", body: JSON.stringify({ actorId: actor.id, userId: ids.target, monthlySalary: 3000, fullCostFactor: 1.35, annualHours: 2080, vacationDays: 30, trainingDays: 0, sickDays: 10, hoursPerDay: 8 }) });
    assert(uiWrite.response.ok && uiWrite.payload?.monthlySalary === 3000, `Normale Kostenmaske nutzt den gemeinsamen Service nicht korrekt: ${JSON.stringify(uiWrite.payload)}`);

    if (employeeActor) {
      const denied = await createDraft(`Ändere Lohnkosten für ${targetEmail}: Monatsgehalt: 9.999.`, `workpilot_session=${token(ids.employeeSession)}`, employeeActor.id);
      assert(!denied.payload?.actionDraft && !String(denied.payload?.message ?? "").includes("9.999"), `Mitarbeiterrolle erhielt vertrauliche Lohnkostenaktion oder Wertespiegelung: ${denied.response.status} ${JSON.stringify(denied.payload)}`);
    }
    if (foreignOrganization) {
      const isolated = await createDraft(`Ändere Lohnkosten für ${foreignEmail}: Monatsgehalt: 3.200.`);
      assert(isolated.response.ok && isolated.payload?.type === "refusal" && !isolated.payload?.actionDraft, "Fremdmandanten-Mitarbeiter war in Lohnkosten sichtbar.");
    }
    const invalid = await createDraft(`Ändere Lohnkosten für ${targetEmail}: Jahresstunden: 100; Urlaubstage: 100; Stunden pro Arbeitstag: 8.`);
    assert(invalid.payload?.actionDraft?.state === "awaiting_input" && invalid.payload.actionDraft.confirmation?.enabled === false, "Nicht berechenbare Kapazität wurde nicht blockiert.");

    const cancelPrepared = await createDraft(`Ändere Lohnkosten für ${targetEmail}: Krankheitstage: 11.`); const cancellable = cancelPrepared.payload?.actionDraft;
    assert(cancellable?.actionId === "payroll.manage" && (await command(cancellable, "cancel")).payload?.actionDraft?.state === "cancelled", "Lohnkostenabbruch fehlgeschlagen.");

    const stalePrepared = await createDraft(`Ändere Lohnkosten für ${staleEmail}: Monatsgehalt: 3.200.`); const staleDraft = stalePrepared.payload?.actionDraft;
    assert(staleDraft?.state === "awaiting_confirmation", `Keine Lohnkostenvorschau für Stale-Context-Test erzeugt: ${JSON.stringify(stalePrepared.payload)}`);

    const prepared = await createDraft(`Ändere Lohnkosten für ${targetEmail}: Monatsgehalt: 3.200; Vollkostenfaktor: 1,4.`); const draft = prepared.payload?.actionDraft;
    assert(draft?.actionId === "payroll.manage" && draft.state === "awaiting_confirmation" && draft.confirmation?.enabled && draft.impacts?.some((impact) => impact.key === "historicalSnapshots" && impact.count === 1) && draft.impacts?.some((impact) => impact.key === "activeStamps" && impact.count === 1), `Lohnkostenvorschau nicht bereit oder Wirkung unvollständig: ${JSON.stringify(prepared.payload)}`);
    assert((await command(draft, "confirm", draft.confirmation.requiredText.toLowerCase())).response.status === 400, "Ungenaue Lohnkostenphrase wurde akzeptiert.");
    const executed = await command(draft, "confirm", draft.confirmation.requiredText);
    assert(executed.response.ok && executed.payload?.actionDraft?.state === "executed", `Lohnkostenänderung fehlgeschlagen: ${JSON.stringify(executed.payload)}`);
    assert((await command(draft, "confirm", draft.confirmation.requiredText)).payload?.actionDraft?.result?.entityId === ids.target, "Lohnkosten-Replay war nicht idempotent.");
    const changed = await prisma.employeeCostCalculation.findUniqueOrThrow({ where: { organizationId_userId: { organizationId: actor.organizationId, userId: ids.target } } });
    const historical = await prisma.projectTimeEntry.findUniqueOrThrow({ where: { id: ids.history } });
    assert(changed.monthlySalary === 3200 && changed.fullCostFactor === 1.4, "Lohnkostenwerte wurden nicht korrekt gespeichert.");
    assert(historical.laborCostRateSnapshot === 25 && historical.laborCostSnapshot === 25, "Historischer Kostensnapshot wurde rückwirkend verändert.");
    assert(await prisma.activeStampSession.count({ where: { id: ids.activeStamp } }) === 1, "Laufende Stempelung wurde verändert.");
    assert(await prisma.auditLog.count({ where: { organizationId: actor.organizationId, entityType: "employeeCostCalculation", entityId: changed.id, action: "employee-cost.changed", createdAt: { gte: now } } }) === 2, "UI- und JARVIS-Kostenaudit sind nicht jeweils exactly-once.");

    await prisma.employeeCostCalculation.update({ where: { organizationId_userId: { organizationId: actor.organizationId, userId: ids.staleTarget } }, data: { trainingDays: 1 } });
    assert((await command(staleDraft, "confirm", staleDraft.confirmation.requiredText)).response.status === 409, "Veraltete Lohnkostenvorschau wurde ausgeführt.");
    result = { baseUrl, uiServiceParity: true, roleBoundary: employeeActor ? "verified" : "no-active-employee", tenantBoundary: foreignOrganization ? "verified" : "single-tenant", impossibleCalculationBlocked: true, exactPhrase: true, cancelSafe: true, staleContextBlocked: true, replayExactlyOnce: true, historicalSnapshotPreserved: true, activeStampPreserved: true, auditExactlyOncePerWrite: true };
  } finally {
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    const costIds = (await prisma.employeeCostCalculation.findMany({ where: { userId: { in: [ids.target, ids.staleTarget] } }, select: { id: true } })).map((row) => row.id);
    if (costIds.length) await prisma.auditLog.deleteMany({ where: { entityType: "employeeCostCalculation", entityId: { in: costIds } } });
    await prisma.activeStampSession.deleteMany({ where: { id: ids.activeStamp } });
    await prisma.projectTimeEntry.deleteMany({ where: { id: ids.history } });
    await prisma.employeeCostCalculation.deleteMany({ where: { userId: { in: [ids.target, ids.staleTarget] } } });
    await prisma.authSession.deleteMany({ where: { id: { in: [ids.actorSession, ids.employeeSession] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.target, ids.staleTarget, ids.foreignTarget] } } });
  }
  const residue = { users: await prisma.user.count({ where: { id: { in: [ids.target, ids.staleTarget, ids.foreignTarget] } } }), drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }), sessions: await prisma.authSession.count({ where: { id: { in: [ids.actorSession, ids.employeeSession] } } }), times: await prisma.projectTimeEntry.count({ where: { id: ids.history } }), stamps: await prisma.activeStampSession.count({ where: { id: ids.activeStamp } }), costs: await prisma.employeeCostCalculation.count({ where: { userId: { in: [ids.target, ids.staleTarget] } } }) };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
