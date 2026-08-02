import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

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
  idleExpiresAt: new Date(at.getTime() + 3_600_000), absoluteExpiresAt: new Date(at.getTime() + 3_600_000),
});
const requestJson = async (path, cookie, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", Origin: baseUrl, Cookie: cookie, ...(init.headers || {}) } });
  return { response, payload: await response.json().catch(() => null) };
};

async function main() {
  const occupied = new Set((await prisma.activeStampSession.findMany({ select: { userId: true } })).map((row) => row.userId));
  const candidates = await prisma.user.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, organizationId: true, firstName: true, lastName: true, role: true } });
  const actor = candidates.find((candidate) => !occupied.has(candidate.id));
  if (!actor) throw new Error("Kein aktiver Benutzer ohne laufende Stempelung für die Start-QA verfügbar.");
  const represented = candidates.find((candidate) => candidate.organizationId === actor.organizationId && candidate.id !== actor.id);
  const now = new Date();
  const ids = { session: randomUUID(), secondSession: randomUUID(), competingStamp: randomUUID() };
  const draftIds = new Set();
  const createdStampIds = new Set();
  const cookie = `workpilot_session=${token(ids.session)}`;
  const secondCookie = `workpilot_session=${token(ids.secondSession)}`;
  let result;
  await prisma.authSession.createMany({ data: [sessionData(ids.session, actor.id, now), sessionData(ids.secondSession, actor.id, now)] });
  try {
    const createDraft = async (requestCookie = cookie, actorId = actor.id) => {
      const response = await requestJson("/api/jarvis/chat", requestCookie, { method: "POST", body: JSON.stringify({ actorId, message: "Starte meine Stempelung unproduktiv. Unproduktive Tätigkeit: QA Büroorganisation; Tätigkeit: QA Ablage prüfen", context: { activeTab: "dashboard", activeMainView: "dashboard" } }) });
      if (response.payload?.actionDraft?.previewId) draftIds.add(response.payload.actionDraft.previewId);
      return response;
    };
    const command = async (draft, commandName, phrase = "", requestCookie = cookie) => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, requestCookie, {
      method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
      body: JSON.stringify({ actorId: actor.id, actionId: "time.session.manage", command: commandName, revision: draft.revision, confirmationText: phrase }),
    });

    if (represented) {
      const denied = await createDraft(cookie, represented.id);
      assert((denied.response.status === 403 || denied.response.ok) && !denied.payload?.actionDraft, `Vertretung erhielt eine persönliche Startaktion: ${JSON.stringify(denied.payload)}`);
    }

    const cancelPrepared = await createDraft();
    const cancelDraft = cancelPrepared.payload?.actionDraft;
    assert(cancelDraft?.operation === "start" && cancelDraft.confirmation?.enabled === true, "Keine abbrechbare Startvorschau erzeugt.");
    const cancelled = await command(cancelDraft, "cancel");
    assert(cancelled.response.ok && cancelled.payload?.actionDraft?.state === "cancelled", "Abbruch der Startaktion fehlgeschlagen.");
    assert(!(await prisma.activeStampSession.findUnique({ where: { organizationId_userId: { organizationId: actor.organizationId, userId: actor.id } } })), "Abbruch hat eine Stempelung gestartet.");

    const stalePrepared = await createDraft();
    const staleDraft = stalePrepared.payload?.actionDraft;
    await prisma.activeStampSession.create({ data: { id: ids.competingStamp, organizationId: actor.organizationId, userId: actor.id, employee: "QA Konkurrenz", mode: "unproductive", projectId: "__unproductive__", projectLabel: "QA Konkurrenz", comment: "Konkurrierender Start", startedAt: now } });
    const stale = await command(staleDraft, "confirm", staleDraft.confirmation.requiredText);
    assert(stale.response.status === 409, "Konkurrierender Start wurde nicht als veralteter Kontext gesperrt.");
    await prisma.activeStampSession.delete({ where: { id: ids.competingStamp } });

    const prepared = await createDraft();
    const draft = prepared.payload?.actionDraft;
    assert(draft?.actionId === "time.session.manage" && draft.operation === "start", "Keine eindeutige Startvorschau erzeugt.");
    assert(draft.state === "awaiting_confirmation" && draft.confirmation?.enabled === true && !draft.blockingIssues?.length, "Startvorschau ist nicht ausführbar.");
    assert(draft.confirmation.requiredText === "STEMPELUNG STARTEN UNPRODUKTIV", "Start-Bestätigungsphrase ist falsch.");
    assert(draft.fields?.some((field) => field.label === "Tätigkeit" && field.value === "QA Ablage prüfen"), "Tätigkeit fehlt in der Startvorschau.");
    const wrong = await command(draft, "confirm", "Stempelung starten unproduktiv");
    assert(wrong.response.status === 400, "Ungenaue Startphrase wurde nicht abgewiesen.");
    const crossSession = await command(draft, "confirm", draft.confirmation.requiredText, secondCookie);
    assert(crossSession.response.status === 403, "Startentwurf war nicht an die erzeugende Sitzung gebunden.");
    const started = await command(draft, "confirm", draft.confirmation.requiredText);
    assert(started.response.ok && started.payload?.actionDraft?.state === "executed", "Persönliche Stempelung wurde nicht gestartet.");
    const stampId = started.payload?.actionDraft?.result?.entityId;
    assert(stampId, "Startaktion lieferte keine aktive Stempelung zurück.");
    createdStampIds.add(stampId);
    const row = await prisma.activeStampSession.findUniqueOrThrow({ where: { id: stampId } });
    assert(row.userId === actor.id && row.mode === "unproductive" && row.projectLabel === "QA Büroorganisation" && row.comment === "QA Ablage prüfen", "Gestartete Stempelung enthält nicht den bestätigten Kontext.");
    const replay = await command(draft, "confirm", draft.confirmation.requiredText);
    assert(replay.response.ok && replay.payload?.actionDraft?.result?.entityId === stampId, "Start-Replay ist nicht idempotent.");
    assert(await prisma.activeStampSession.count({ where: { organizationId: actor.organizationId, userId: actor.id } }) === 1, "Start-Replay hat eine zweite Sitzung erzeugt.");
    const audits = await prisma.jarvisActionDraftAuditEvent.count({ where: { draftId: draft.previewId, eventType: "draft_confirmed_and_executed" } });
    assert(audits === 1, "Start-Audit ist nicht exactly-once.");
    result = { baseUrl, actorRole: actor.role, representationBoundary: represented ? "verified" : "single-user-organization", sessionBinding: true, cancelSafe: true, wrongPhraseRejected: true, staleContextRejected: true, startExactlyOnce: true, auditExecutions: audits };
  } finally {
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    await prisma.activeStampSession.deleteMany({ where: { id: { in: [ids.competingStamp, ...createdStampIds] } } });
    await prisma.authSession.deleteMany({ where: { id: { in: [ids.session, ids.secondSession] } } });
  }
  const residue = { drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }), stampSessions: await prisma.activeStampSession.count({ where: { id: { in: [ids.competingStamp, ...createdStampIds] } } }), sessions: await prisma.authSession.count({ where: { id: { in: [ids.session, ids.secondSession] } } }) };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
