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
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Origin: baseUrl, Cookie: cookie, ...(init.headers || {}) },
  });
  return { response, payload: await response.json().catch(() => null) };
};

async function main() {
  const occupiedUsers = new Set((await prisma.activeStampSession.findMany({ select: { userId: true } })).map((row) => row.userId));
  const candidates = await prisma.user.findMany({
    where: { isActive: true }, orderBy: { createdAt: "asc" },
    select: { id: true, organizationId: true, firstName: true, lastName: true, role: true },
  });
  const actor = candidates.find((candidate) => !occupiedUsers.has(candidate.id));
  if (!actor) throw new Error("Kein aktiver Benutzer ohne laufende Stempelung für die isolierte QA verfügbar.");
  const represented = candidates.find((candidate) => candidate.organizationId === actor.organizationId && candidate.id !== actor.id);
  const now = new Date();
  const ids = { session: randomUUID(), secondSession: randomUUID(), stamp: randomUUID() };
  const draftIds = new Set();
  const cookie = `workpilot_session=${token(ids.session)}`;
  const secondCookie = `workpilot_session=${token(ids.secondSession)}`;
  let result;

  await prisma.authSession.createMany({ data: [sessionData(ids.session, actor.id, now), sessionData(ids.secondSession, actor.id, now)] });
  await prisma.activeStampSession.create({ data: {
    id: ids.stamp, organizationId: actor.organizationId, userId: actor.id,
    employee: `${actor.firstName} ${actor.lastName}`.trim(), mode: "unproductive", projectId: "",
    projectLabel: "QA JARVIS interne Tätigkeit", trade: "", comment: "QA JARVIS persönliche Stempelung",
    startedAt: new Date(now.getTime() - 3_600_000), accumulatedMs: 0n, pauseStartedAt: null, pauseMs: 0n,
  } });

  try {
    const createDraft = async (message, requestCookie = cookie, actorId = actor.id) => {
      const response = await requestJson("/api/jarvis/chat", requestCookie, {
        method: "POST", body: JSON.stringify({ actorId, message, context: { activeTab: "dashboard", activeMainView: "dashboard" } }),
      });
      if (response.payload?.actionDraft?.previewId) draftIds.add(response.payload.actionDraft.previewId);
      return response;
    };
    const command = async (draft, commandName, phrase = "", requestCookie = cookie) => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, requestCookie, {
      method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
      body: JSON.stringify({ actorId: actor.id, actionId: "time.session.manage", command: commandName, revision: draft.revision, confirmationText: phrase }),
    });
    const loadStamp = () => prisma.activeStampSession.findUniqueOrThrow({ where: { id: ids.stamp } });

    if (represented) {
      const denied = await createDraft("Pausiere meine laufende Stempelung.", cookie, represented.id);
      assert((denied.response.status === 403 || denied.response.ok) && !denied.payload?.actionDraft, `Vertretung erhielt eine persönliche Stempelaktion: ${JSON.stringify(denied.payload)}`);
    }

    const cancelPrepared = await createDraft("Pausiere meine laufende Stempelung.");
    const cancelDraft = cancelPrepared.payload?.actionDraft;
    assert(cancelDraft?.actionId === "time.session.manage", "Keine Stempel-Abbruchvorschau erzeugt.");
    const cancelled = await command(cancelDraft, "cancel");
    assert(cancelled.response.ok && cancelled.payload?.actionDraft?.state === "cancelled", "Abbruch der Stempelaktion fehlgeschlagen.");
    assert((await loadStamp()).pauseStartedAt === null, "Abbruch hat die Stempelung verändert.");

    const stalePrepared = await createDraft("Pausiere meine laufende Stempelung.");
    const staleDraft = stalePrepared.payload?.actionDraft;
    assert(staleDraft?.confirmation?.enabled === true, "Keine ausführbare Stale-Context-Vorschau erzeugt.");
    await prisma.activeStampSession.update({ where: { id: ids.stamp }, data: { comment: "QA JARVIS Zustand nach Vorschau geändert" } });
    const stale = await command(staleDraft, "confirm", staleDraft.confirmation.requiredText);
    assert(stale.response.status === 409, "Veraltete Stempelvorschau wurde nicht gesperrt.");
    assert((await loadStamp()).pauseStartedAt === null, "Stale-Context-Sperre hat die Stempelung verändert.");

    const pausePrepared = await createDraft("Pausiere meine laufende Stempelung.");
    const pauseDraft = pausePrepared.payload?.actionDraft;
    assert(pauseDraft?.actionId === "time.session.manage" && pauseDraft.operation === "pause", "Keine eindeutige Pausenvorschau erzeugt.");
    assert(pauseDraft.state === "awaiting_confirmation" && pauseDraft.confirmation?.enabled === true && !pauseDraft.blockingIssues?.length, "Pausenvorschau ist nicht ausführbar.");
    assert(pauseDraft.confirmation.requiredText === "STEMPELUNG PAUSIEREN", "Pause-Bestätigungsphrase ist falsch.");
    assert(pauseDraft.checks?.some((check) => check.key === "personal-session" && check.status === "ok"), "Persönliche Sitzungsprüfung fehlt.");
    const wrong = await command(pauseDraft, "confirm", "stempelung pausieren");
    assert(wrong.response.status === 400 && (await loadStamp()).pauseStartedAt === null, "Ungenaue Pause-Phrase wurde nicht sicher abgewiesen.");
    const crossSession = await command(pauseDraft, "confirm", pauseDraft.confirmation.requiredText, secondCookie);
    assert(crossSession.response.status === 403 && (await loadStamp()).pauseStartedAt === null, "Entwurf war nicht an die erzeugende Sitzung gebunden.");
    const paused = await command(pauseDraft, "confirm", pauseDraft.confirmation.requiredText);
    assert(paused.response.ok && paused.payload?.actionDraft?.state === "executed", "Persönliche Stempelung wurde nicht pausiert.");
    const afterPause = await loadStamp();
    assert(afterPause.pauseStartedAt instanceof Date && Number(afterPause.accumulatedMs) >= 3_500_000, "Pausenzustand oder Arbeitszeit wurde nicht korrekt fortgeschrieben.");
    const pausedReplay = await command(pauseDraft, "confirm", pauseDraft.confirmation.requiredText);
    assert(pausedReplay.response.ok && pausedReplay.payload?.actionDraft?.result?.entityId === ids.stamp, "Pause-Replay ist nicht idempotent.");
    const afterPauseReplay = await loadStamp();
    assert(afterPauseReplay.pauseStartedAt?.getTime() === afterPause.pauseStartedAt?.getTime() && afterPauseReplay.accumulatedMs === afterPause.accumulatedMs, "Pause-Replay hat den Zustand erneut verändert.");

    const resumePrepared = await createDraft("Setze meine Stempelung fort.");
    const resumeDraft = resumePrepared.payload?.actionDraft;
    assert(resumeDraft?.operation === "resume" && resumeDraft.confirmation?.requiredText === "STEMPELUNG FORTSETZEN", "Keine eindeutige Fortsetzen-Vorschau erzeugt.");
    const resumed = await command(resumeDraft, "confirm", resumeDraft.confirmation.requiredText);
    assert(resumed.response.ok && resumed.payload?.actionDraft?.state === "executed", "Persönliche Stempelung wurde nicht fortgesetzt.");
    const afterResume = await loadStamp();
    assert(afterResume.pauseStartedAt === null && Number(afterResume.pauseMs) >= 0, "Fortsetzen-Zustand wurde nicht korrekt gespeichert.");
    const resumeReplay = await command(resumeDraft, "confirm", resumeDraft.confirmation.requiredText);
    assert(resumeReplay.response.ok && resumeReplay.payload?.actionDraft?.result?.entityId === ids.stamp, "Fortsetzen-Replay ist nicht idempotent.");

    const audits = await prisma.jarvisActionDraftAuditEvent.findMany({ where: { draftId: { in: [pauseDraft.previewId, resumeDraft.previewId] } } });
    assert(audits.filter((entry) => entry.eventType === "draft_confirmed_and_executed").length === 2, "Stempel-Audit ist nicht exactly-once.");
    result = {
      baseUrl, actorRole: actor.role, representationBoundary: represented ? "verified" : "single-user-organization",
      sessionBinding: true, cancelSafe: true, wrongPhraseRejected: true, staleContextRejected: true,
      pauseExactlyOnce: true, resumeExactlyOnce: true, auditExecutions: 2,
    };
  } finally {
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    await prisma.activeStampSession.deleteMany({ where: { id: ids.stamp } });
    await prisma.authSession.deleteMany({ where: { id: { in: [ids.session, ids.secondSession] } } });
  }

  const residue = {
    drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }),
    stampSessions: await prisma.activeStampSession.count({ where: { id: ids.stamp } }),
    sessions: await prisma.authSession.count({ where: { id: { in: [ids.session, ids.secondSession] } } }),
  };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
