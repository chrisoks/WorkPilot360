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
  const actor = await prisma.user.findFirst({ where: { role: Role.GESCHAEFTSFUEHRER, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, organizationId: true, email: true } });
  if (!actor) throw new Error("Kein aktiver Geschäftsführungs-Testakteur gefunden.");
  const employeeActor = await prisma.user.findFirst({ where: { organizationId: actor.organizationId, role: Role.MITARBEITER, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const foreignOrganization = await prisma.organization.findFirst({ where: { id: { not: actor.organizationId } }, select: { id: true } });
  const now = new Date(); const suffix = Date.now().toString().slice(-9);
  const ids = { actorSession: randomUUID(), employeeSession: randomUUID(), target: randomUUID(), targetSession: randomUUID(), staleTarget: randomUUID(), foreignTarget: randomUUID() };
  const draftIds = new Set();
  let result;
  const targetEmail = `qa-personnel-${suffix}@example.test`; const staleEmail = `qa-personnel-stale-${suffix}@example.test`; const foreignEmail = `qa-personnel-foreign-${suffix}@example.test`;
  await prisma.user.createMany({ data: [
    { id: ids.target, organizationId: actor.organizationId, firstName: "QA", lastName: "Personal", email: targetEmail, passwordHash: "qa-not-used", role: Role.MITARBEITER, isActive: true, personalNumber: `QAP-${suffix}`, planningBoard: "OK solutions", planningGroup: "Marketing" },
    { id: ids.staleTarget, organizationId: actor.organizationId, firstName: "QA", lastName: "Stale", email: staleEmail, passwordHash: "qa-not-used", role: Role.MITARBEITER, isActive: true, personalNumber: `QAS-${suffix}`, planningBoard: "OK solutions", planningGroup: "Marketing" },
    ...(foreignOrganization ? [{ id: ids.foreignTarget, organizationId: foreignOrganization.id, firstName: "QA", lastName: "Fremd", email: foreignEmail, passwordHash: "qa-not-used", role: Role.MITARBEITER, isActive: true }] : []),
  ] });
  await prisma.authSession.createMany({ data: [sessionData(ids.actorSession, actor.id, now), sessionData(ids.targetSession, ids.target, now), ...(employeeActor ? [sessionData(ids.employeeSession, employeeActor.id, now)] : [])] });
  const cookie = `workpilot_session=${token(ids.actorSession)}`;
  try {
    const createDraft = async (message, requestCookie = cookie, actorId = actor.id) => { const response = await requestJson("/api/jarvis/chat", requestCookie, { method: "POST", body: JSON.stringify({ actorId, message, context: { activeTab: "dashboard", activeMainView: "dashboard" } }) }); if (response.payload?.actionDraft?.previewId) draftIds.add(response.payload.actionDraft.previewId); return response; };
    const command = async (draft, name, phrase = "") => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, { method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" }, body: JSON.stringify({ actorId: actor.id, actionId: "personnel.manage", command: name, revision: draft.revision, confirmationText: phrase }) });

    if (employeeActor) {
      const denied = await createDraft(`Ändere Mitarbeiter ${targetEmail}: Mobil: +49 171 111111.`, `workpilot_session=${token(ids.employeeSession)}`, employeeActor.id);
      assert(denied.response.ok && !denied.payload?.actionDraft, `Mitarbeiterrolle erhielt Personalaktion: ${JSON.stringify(denied.payload)}`);
    }
    if (foreignOrganization) {
      const isolated = await createDraft(`Ändere Mitarbeiter ${foreignEmail}: Mobil: +49 171 111111.`);
      assert(isolated.response.ok && isolated.payload?.type === "refusal" && !isolated.payload?.actionDraft, "Fremdmandanten-Mitarbeiter war sichtbar.");
    }
    const restricted = await createDraft(`Deaktiviere Mitarbeiter ${targetEmail}.`);
    assert(restricted.payload?.type === "refusal" && !restricted.payload?.actionDraft, "Deaktivierung wurde nicht deterministisch abgegrenzt.");
    const selfRole = await createDraft(`Ändere Mitarbeiter ${actor.email}: Rolle: Mitarbeiter.`);
    assert(selfRole.payload?.actionDraft?.state === "awaiting_input" && selfRole.payload.actionDraft.confirmation?.enabled === false, "Eigene Rollenänderung wurde nicht fail-closed blockiert.");

    const cancelPrepared = await createDraft(`Ändere Mitarbeiter ${targetEmail}: Telefon: +49 511 123456.`);
    const cancellable = cancelPrepared.payload?.actionDraft;
    assert(cancellable?.actionId === "personnel.manage", "Keine Personal-Abbruchvorschau erzeugt.");
    assert((await command(cancellable, "cancel")).payload?.actionDraft?.state === "cancelled", "Personalabbruch fehlgeschlagen.");

    const prepared = await createDraft(`Ändere Mitarbeiter ${targetEmail}: Vorname: QA-Geprüft; Rolle: Führungskraft; Mobil: +49 171 1234567.`);
    const draft = prepared.payload?.actionDraft;
    assert(draft?.actionId === "personnel.manage" && draft.state === "awaiting_confirmation" && draft.confirmation?.enabled && draft.roleSessionsWillBeRevoked && !draft.blockingIssues?.length, `Personalvorschau nicht bereit: ${JSON.stringify(prepared.payload)}`);
    assert((await command(draft, "confirm", draft.confirmation.requiredText.toLowerCase())).response.status === 400, "Ungenaue Phrase wurde akzeptiert.");
    const executed = await command(draft, "confirm", draft.confirmation.requiredText);
    assert(executed.response.ok && executed.payload?.actionDraft?.state === "executed", `Personaländerung fehlgeschlagen: ${JSON.stringify(executed.payload)}`);
    assert((await command(draft, "confirm", draft.confirmation.requiredText)).payload?.actionDraft?.result?.entityId === ids.target, "Replay war nicht idempotent.");
    const changed = await prisma.user.findUniqueOrThrow({ where: { id: ids.target }, select: { firstName: true, role: true, mobile: true } });
    assert(changed.firstName === "QA-Geprüft" && changed.role === Role.FUEHRUNGSKRAFT && changed.mobile === "+491711234567", "Personalwerte wurden nicht korrekt normalisiert oder gespeichert.");
    assert(await prisma.authSession.count({ where: { id: ids.targetSession } }) === 0, "Rollenwechsel hat die Zielsitzung nicht beendet.");
    assert(await prisma.auditLog.count({ where: { organizationId: actor.organizationId, entityType: "user", entityId: ids.target, action: "personnel.changed", createdAt: { gte: now } } }) === 1, "Personal-Audit ist nicht exactly-once.");

    const stalePrepared = await createDraft(`Ändere Mitarbeiter ${staleEmail}: Telefon: +49 511 999999.`); const staleDraft = stalePrepared.payload?.actionDraft;
    assert(staleDraft?.state === "awaiting_confirmation", "Keine Personalvorschau für Stale-Context-Test erzeugt.");
    await prisma.user.update({ where: { id: ids.staleTarget }, data: { city: `Parallel ${suffix}` } });
    assert((await command(staleDraft, "confirm", staleDraft.confirmation.requiredText)).response.status === 409, "Veraltete Personalvorschau wurde ausgeführt.");

    const duplicate = await createDraft(`Ändere Mitarbeiter ${staleEmail}: E-Mail: ${targetEmail}.`);
    assert(duplicate.payload?.actionDraft?.state === "awaiting_input" && duplicate.payload.actionDraft.confirmation?.enabled === false, "Doppelte dienstliche E-Mail wurde nicht blockiert.");
    result = { baseUrl, roleBoundary: employeeActor ? "verified" : "no-active-employee", tenantBoundary: foreignOrganization ? "verified" : "single-tenant", restrictedOperationsRefused: true, selfRoleBlocked: true, exactPhrase: true, cancelSafe: true, staleContextBlocked: true, duplicateBlocked: true, replayExactlyOnce: true, roleSessionRevoked: true, auditExactlyOnce: true };
  } finally {
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: actor.organizationId, entityType: "user", entityId: { in: [ids.target, ids.staleTarget] } } });
    await prisma.authSession.deleteMany({ where: { id: { in: [ids.actorSession, ids.employeeSession, ids.targetSession] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.target, ids.staleTarget, ids.foreignTarget] } } });
  }
  const residue = { users: await prisma.user.count({ where: { id: { in: [ids.target, ids.staleTarget, ids.foreignTarget] } } }), drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }), sessions: await prisma.authSession.count({ where: { id: { in: [ids.actorSession, ids.employeeSession, ids.targetSession] } } }) };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
