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
  const offerIds = [randomUUID(), randomUUID()];
  const offerNumbers = [await unusedNumber(actor.organizationId), await unusedNumber(actor.organizationId)];
  const draftIds = new Set();
  let result;
  await prisma.authSession.create({ data: {
    id: sessionId, userId: actor.id, tokenVersion: 1, createdAt: startedAt, lastSeenAt: startedAt,
    lastRotatedAt: startedAt, idleExpiresAt: new Date(startedAt.getTime() + 3_600_000),
    absoluteExpiresAt: new Date(startedAt.getTime() + 3_600_000),
  } });
  const cookie = `workpilot_session=${token(sessionId)}`;
  for (let index = 0; index < offerIds.length; index += 1) {
    await prisma.offer.create({ data: {
      id: offerIds[index], organizationId: actor.organizationId, projectId: project.id,
      projectNumber: project.projectNumber, projectTitle: project.title, company: "OK solutions",
      offerNumber: offerNumbers[index], status: "Erstellt", customerName: project.customer || "QA Kunde",
      plannedExecutionMonth: "2026-11", netTotal: 100 + index, vatRate: 19, grossTotal: 119 + index * 1.19,
      pdfData: Buffer.from(`qa-${index}`).toString("base64"),
    } });
  }

  try {
    const okw = await requestJson("/api/jarvis/chat", cookie, { method: "POST", body: JSON.stringify({
      actorId: actor.id, message: "zeig mal alle oKW Angebote", context: { activeTab: "dashboard", activeMainView: "dashboard" },
    }) });
    assert(okw.response.ok, `OKW-Frage fehlgeschlagen (${okw.response.status}).`);
    assert(okw.payload?.message === "Für OKW GmbH sind aktuell keine Angebote in WorkPilot360 vorhanden.", `OKW-Antwort unklar: ${okw.payload?.message}`);

    const createDecision = async (message) => {
      const response = await requestJson("/api/jarvis/chat", cookie, { method: "POST", body: JSON.stringify({
        actorId: actor.id, message, context: { activeTab: "dashboard", activeMainView: "dashboard" },
      }) });
      assert(response.response.ok, `Entscheidungsvorschau fehlgeschlagen (${response.response.status}): ${response.payload?.error || response.payload?.message || ""}`);
      assert(response.payload?.actionDraft?.actionId === "offer.manage", "JARVIS hat keine offer.manage-Vorschau erzeugt.");
      draftIds.add(response.payload.actionDraft.previewId);
      return response.payload.actionDraft;
    };
    const command = async (draft, commandName, phrase = "") => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, {
      method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
      body: JSON.stringify({ actorId: actor.id, actionId: "offer.manage", command: commandName, revision: draft.revision, confirmationText: phrase }),
    });

    const wonDraft = await createDecision(`Markiere Angebot ${offerNumbers[0]} als gewonnen. Grund: Schriftliche Kundenzusage.`);
    assert(wonDraft.confirmation.requiredText === `ANGEBOT GEWINNEN ${offerNumbers[0]}`, "Gewinnphrase ist falsch.");
    const wrong = await command(wonDraft, "confirm", wonDraft.confirmation.requiredText.toLowerCase());
    assert(wrong.response.status === 400, "Falsche Gewinnphrase wurde nicht abgewiesen.");
    assert(!(await prisma.offer.findUniqueOrThrow({ where: { id: offerIds[0] } })).wonAt, "Falsche Phrase hat das Angebot verändert.");
    const won = await command(wonDraft, "confirm", wonDraft.confirmation.requiredText);
    assert(won.response.ok && won.payload?.actionDraft?.state === "executed", "Gewinnentscheidung wurde nicht ausgeführt.");
    const replay = await command(wonDraft, "confirm", wonDraft.confirmation.requiredText);
    assert(replay.response.ok && replay.payload?.actionDraft?.result?.entityId === offerIds[0], "Gewinn-Replay ist nicht idempotent.");

    const cancelledDraft = await createDecision(`Markiere Angebot ${offerNumbers[1]} als verloren. Grund: Preis. Kommentar: Kunde hat abgesagt.`);
    assert(cancelledDraft.confirmation.requiredText === `ANGEBOT VERLIEREN ${offerNumbers[1]}`, "Verlustphrase ist falsch.");
    const cancelled = await command(cancelledDraft, "cancel");
    assert(cancelled.response.ok && cancelled.payload?.actionDraft?.state === "cancelled", "Abbruch wurde nicht gespeichert.");
    assert(!(await prisma.offer.findUniqueOrThrow({ where: { id: offerIds[1] } })).lostAt, "Abbruch hat das Angebot verändert.");
    const lostDraft = await createDecision(`Markiere Angebot ${offerNumbers[1]} als verloren. Grund: Preis. Kommentar: Kunde hat abgesagt.`);
    const lost = await command(lostDraft, "confirm", lostDraft.confirmation.requiredText);
    assert(lost.response.ok && lost.payload?.actionDraft?.state === "executed", "Verlustentscheidung wurde nicht ausgeführt.");

    const [wonOffer, lostOffer, histories, logs, tasks, invoices, dispatches, projectAfter] = await Promise.all([
      prisma.offer.findUniqueOrThrow({ where: { id: offerIds[0] } }),
      prisma.offer.findUniqueOrThrow({ where: { id: offerIds[1] } }),
      prisma.offerHistory.findMany({ where: { organizationId: actor.organizationId, offerId: { in: offerIds }, createdAt: { gte: startedAt } } }),
      prisma.projectLogbookEntry.findMany({ where: { organizationId: actor.organizationId, projectId: project.id, source: "jarvis", createdAt: { gte: startedAt }, OR: offerNumbers.map((number) => ({ body: { contains: number } })) } }),
      prisma.task.count({ where: { organizationId: actor.organizationId, projectId: project.id, createdAt: { gte: startedAt } } }),
      prisma.invoice.count({ where: { organizationId: actor.organizationId, projectId: project.id, createdAt: { gte: startedAt } } }),
      prisma.documentMailDispatch.count({ where: { organizationId: actor.organizationId, projectId: project.id, createdAt: { gte: startedAt } } }),
      prisma.workPilotProject.findUniqueOrThrow({ where: { id: project.id }, select: { status: true, updatedAt: true } }),
    ]);
    assert(Boolean(wonOffer.wonAt) && wonOffer.wonReason === "Schriftliche Kundenzusage", "Gewinnstatus oder Grund fehlt.");
    assert(lostOffer.status === "Verloren" && Boolean(lostOffer.lostAt) && lostOffer.lostReason === "Preis" && lostOffer.lostNote === "Kunde hat abgesagt", "Verluststatus oder Dokumentation fehlt.");
    assert(histories.length === 2 && logs.length === 2, "Historie oder Projektlogbuch ist nicht exactly-once.");
    assert(tasks === 0 && invoices === 0 && dispatches === 0, "Die Entscheidung hat unzulässige Nebenwirkungen erzeugt.");
    assert(projectAfter.status === project.status && projectAfter.updatedAt.toISOString() === project.updatedAt.toISOString(), "Der Projektstatus wurde verändert.");
    result = { baseUrl, okwMessage: okw.payload.message, won: true, lost: true, cancelSafe: true, wrongPhraseRejected: true, replayExactlyOnce: true, histories: histories.length, logbookEntries: logs.length, projectUnchanged: true, tasksCreated: tasks, invoicesCreated: invoices, dispatchesCreated: dispatches };
  } finally {
    const logs = await prisma.projectLogbookEntry.findMany({ where: { organizationId: actor.organizationId, projectId: project.id, source: "jarvis", createdAt: { gte: startedAt }, OR: offerNumbers.map((number) => ({ body: { contains: number } })) }, select: { id: true } });
    await prisma.$transaction([
      prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } }),
      prisma.offerHistory.deleteMany({ where: { offerId: { in: offerIds } } }),
      prisma.projectLogbookEntry.deleteMany({ where: { id: { in: logs.map((item) => item.id) } } }),
      prisma.offer.deleteMany({ where: { id: { in: offerIds } } }),
      prisma.authSession.deleteMany({ where: { id: sessionId } }),
    ]);
  }
  const residue = {
    offers: await prisma.offer.count({ where: { id: { in: offerIds } } }),
    histories: await prisma.offerHistory.count({ where: { offerId: { in: offerIds } } }),
    drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }),
    sessions: await prisma.authSession.count({ where: { id: sessionId } }),
  };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
