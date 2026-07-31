import { createHmac, randomInt, randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = (process.argv.find((item) => item.startsWith("--base-url="))?.split("=")[1] || "http://localhost:3001").replace(/\/$/, "");
const secret = process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
if (!secret) throw new Error("WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET fehlt.");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const token = (sessionId) => {
  const value = `v2.${sessionId}.1`;
  return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`;
};
const requestJson = async (path, cookie, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Origin: baseUrl, Cookie: cookie, ...(init.headers || {}) },
  });
  return { response, payload: await response.json().catch(() => null) };
};

async function unusedNumber(organizationId) {
  for (let index = 0; index < 30; index += 1) {
    const value = `ANG-${randomInt(900000, 999999)}`;
    if (!(await prisma.offer.count({ where: { organizationId, offerNumber: value } }))) return value;
  }
  throw new Error("Keine freie QA-Angebotsnummer gefunden.");
}

async function main() {
  const actor = await prisma.user.findFirst({
    where: { role: Role.GESCHAEFTSFUEHRER, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, organizationId: true },
  });
  if (!actor) throw new Error("Kein aktiver Geschäftsführungs-Testakteur gefunden.");
  const project = await prisma.workPilotProject.findFirst({
    where: { organizationId: actor.organizationId, status: { notIn: ["Archiviert", "Gelöscht"] } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, projectNumber: true, title: true, customer: true, status: true, updatedAt: true },
  });
  if (!project) throw new Error("Kein QA-Projekt gefunden.");

  const startedAt = new Date();
  const sessionId = randomUUID();
  const offerId = randomUUID();
  const offerNumber = await unusedNumber(actor.organizationId);
  const draftIds = new Set();
  let result;
  await prisma.authSession.create({ data: {
    id: sessionId, userId: actor.id, tokenVersion: 1, createdAt: startedAt, lastSeenAt: startedAt,
    lastRotatedAt: startedAt, idleExpiresAt: new Date(startedAt.getTime() + 3_600_000),
    absoluteExpiresAt: new Date(startedAt.getTime() + 3_600_000),
  } });
  await prisma.offer.create({ data: {
    id: offerId, organizationId: actor.organizationId, projectId: project.id,
    projectNumber: project.projectNumber, projectTitle: project.title, company: "OK solutions",
    offerNumber, status: "Erstellt", customerName: project.customer || "QA Kunde",
    plannedExecutionMonth: "2026-11", netTotal: 100, vatRate: 19, grossTotal: 119,
    pdfData: Buffer.from("qa-lifecycle").toString("base64"),
  } });
  const cookie = `workpilot_session=${token(sessionId)}`;

  try {
    const createDraft = async (message) => {
      const response = await requestJson("/api/jarvis/chat", cookie, { method: "POST", body: JSON.stringify({
        actorId: actor.id, message, context: { activeTab: "dashboard", activeMainView: "dashboard" },
      }) });
      assert(response.response.ok, `Vorschau fehlgeschlagen (${response.response.status}): ${response.payload?.error || response.payload?.message || ""}`);
      assert(response.payload?.actionDraft?.actionId === "offer.delete", `Keine offer.delete-Vorschau: ${JSON.stringify(response.payload)}`);
      draftIds.add(response.payload.actionDraft.previewId);
      return response.payload.actionDraft;
    };
    const command = async (draft, commandName, phrase = "") => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, {
      method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
      body: JSON.stringify({ actorId: actor.id, actionId: "offer.delete", command: commandName, revision: draft.revision, confirmationText: phrase }),
    });

    const deleteDraft = await createDraft(`Lösche Angebot ${offerNumber} kontrolliert. Grund: QA-Doppelanlage.`);
    assert(deleteDraft.confirmation.requiredText === `ANGEBOT LÖSCHEN ${offerNumber}`, "Löschphrase ist falsch.");
    const wrong = await command(deleteDraft, "confirm", deleteDraft.confirmation.requiredText.toLowerCase());
    assert(wrong.response.status === 400, "Falsche Löschphrase wurde nicht abgewiesen.");
    assert((await prisma.offer.findUniqueOrThrow({ where: { id: offerId } })).status === "Erstellt", "Falsche Phrase hat das Angebot verändert.");
    const deleted = await command(deleteDraft, "confirm", deleteDraft.confirmation.requiredText);
    assert(deleted.response.ok && deleted.payload?.actionDraft?.state === "executed", "Löschung wurde nicht ausgeführt.");
    const replay = await command(deleteDraft, "confirm", deleteDraft.confirmation.requiredText);
    assert(replay.response.ok && replay.payload?.actionDraft?.result?.entityId === offerId, "Lösch-Replay ist nicht idempotent.");
    assert((await prisma.offer.findUniqueOrThrow({ where: { id: offerId } })).status === "Gelöscht", "Soft-Delete fehlt.");

    const cancelledRestore = await createDraft(`Stelle Angebot ${offerNumber} wieder her. Grund: QA-Kontrollierter Abbruch.`);
    const cancelled = await command(cancelledRestore, "cancel");
    assert(cancelled.response.ok && cancelled.payload?.actionDraft?.state === "cancelled", "Wiederherstellungsabbruch fehlt.");
    assert((await prisma.offer.findUniqueOrThrow({ where: { id: offerId } })).status === "Gelöscht", "Abbruch hat das Angebot verändert.");
    const restoreDraft = await createDraft(`Stelle Angebot ${offerNumber} wieder her. Grund: QA-Irrtum korrigiert.`);
    assert(restoreDraft.confirmation.requiredText === `ANGEBOT WIEDERHERSTELLEN ${offerNumber}`, "Wiederherstellungsphrase ist falsch.");
    const restored = await command(restoreDraft, "confirm", restoreDraft.confirmation.requiredText);
    assert(restored.response.ok && restored.payload?.actionDraft?.state === "executed", "Wiederherstellung wurde nicht ausgeführt.");

    const [offer, histories, logs, tasks, invoices, dispatches, projectAfter] = await Promise.all([
      prisma.offer.findUniqueOrThrow({ where: { id: offerId } }),
      prisma.offerHistory.findMany({ where: { organizationId: actor.organizationId, offerId, createdAt: { gte: startedAt } } }),
      prisma.projectLogbookEntry.findMany({ where: { organizationId: actor.organizationId, projectId: project.id, source: "jarvis", createdAt: { gte: startedAt }, body: { contains: offerNumber } } }),
      prisma.task.count({ where: { organizationId: actor.organizationId, projectId: project.id, createdAt: { gte: startedAt } } }),
      prisma.invoice.count({ where: { organizationId: actor.organizationId, projectId: project.id, createdAt: { gte: startedAt } } }),
      prisma.documentMailDispatch.count({ where: { organizationId: actor.organizationId, projectId: project.id, createdAt: { gte: startedAt } } }),
      prisma.workPilotProject.findUniqueOrThrow({ where: { id: project.id }, select: { status: true, updatedAt: true } }),
    ]);
    assert(offer.status === "Erstellt", `Falscher Wiederherstellungsstatus: ${offer.status}`);
    assert(histories.length === 2 && histories.some((item) => item.eventType === "deleted") && histories.some((item) => item.eventType === "restored"), "Historie ist nicht exactly-once.");
    assert(logs.length === 2, "Projektlogbuch ist nicht exactly-once.");
    assert(tasks === 0 && invoices === 0 && dispatches === 0, "Unzulässige Nebenwirkungen wurden erzeugt.");
    assert(projectAfter.status === project.status && projectAfter.updatedAt.toISOString() === project.updatedAt.toISOString(), "Projekt wurde verändert.");
    result = { baseUrl, deleteSafe: true, restoreSafe: true, cancelSafe: true, wrongPhraseRejected: true, replayExactlyOnce: true, histories: histories.length, logbookEntries: logs.length, projectUnchanged: true, tasksCreated: tasks, invoicesCreated: invoices, dispatchesCreated: dispatches };
  } finally {
    const logs = await prisma.projectLogbookEntry.findMany({ where: { organizationId: actor.organizationId, projectId: project.id, createdAt: { gte: startedAt }, body: { contains: offerNumber } }, select: { id: true } });
    await prisma.$transaction([
      prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } }),
      prisma.offerHistory.deleteMany({ where: { offerId } }),
      prisma.projectLogbookEntry.deleteMany({ where: { id: { in: logs.map((item) => item.id) } } }),
      prisma.offer.deleteMany({ where: { id: offerId } }),
      prisma.authSession.deleteMany({ where: { id: sessionId } }),
    ]);
  }
  const residue = {
    offers: await prisma.offer.count({ where: { id: offerId } }),
    histories: await prisma.offerHistory.count({ where: { offerId } }),
    drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }),
    sessions: await prisma.authSession.count({ where: { id: sessionId } }),
  };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
