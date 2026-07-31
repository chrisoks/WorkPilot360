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
    const value = `RE-${randomInt(900000, 999999)}`;
    if (!(await prisma.invoice.count({ where: { organizationId, invoiceNumber: value } }))) return value;
  }
  throw new Error("Keine freie QA-Rechnungsnummer gefunden.");
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
  const invoiceId = randomUUID();
  const finalizedInvoiceId = randomUUID();
  const invoiceNumber = await unusedNumber(actor.organizationId);
  const finalizedInvoiceNumber = await unusedNumber(actor.organizationId);
  const pdfData = Buffer.from("qa-invoice-lifecycle-draft").toString("base64");
  const lineId = randomUUID();
  const draftIds = new Set();
  let result;
  await prisma.authSession.create({ data: {
    id: sessionId, userId: actor.id, tokenVersion: 1, createdAt: startedAt, lastSeenAt: startedAt,
    lastRotatedAt: startedAt, idleExpiresAt: new Date(startedAt.getTime() + 3_600_000),
    absoluteExpiresAt: new Date(startedAt.getTime() + 3_600_000),
  } });
  await prisma.invoice.create({ data: {
    id: invoiceId, organizationId: actor.organizationId, projectId: project.id,
    projectNumber: project.projectNumber, projectTitle: project.title, company: "OK solutions",
    invoiceNumber, status: "Entwurf", customerName: project.customer || "QA Kunde",
    plannedExecutionMonth: "2026-07", serviceDate: "2026-07-31",
    netTotal: 100, vatRate: 19, grossTotal: 119, pdfData,
    lines: { create: { id: lineId, organizationId: actor.organizationId, position: 1, quantity: 1, unit: "Pauschal", title: "QA Entwurfsleistung", unitPrice: 100, vatRate: 19, totalNet: 100 } },
  } });
  await prisma.invoice.create({ data: {
    id: finalizedInvoiceId, organizationId: actor.organizationId, projectId: project.id,
    projectNumber: project.projectNumber, projectTitle: project.title, company: "OK solutions",
    invoiceNumber: finalizedInvoiceNumber, status: "Fakturiert", customerName: project.customer || "QA Kunde",
    plannedExecutionMonth: "2026-07", serviceDate: "2026-07-31",
    netTotal: 50, vatRate: 19, grossTotal: 59.5, pdfData: Buffer.from("qa-finalized-invoice").toString("base64"),
  } });
  const cookie = `workpilot_session=${token(sessionId)}`;

  try {
    const createDraft = async (message) => {
      const response = await requestJson("/api/jarvis/chat", cookie, { method: "POST", body: JSON.stringify({
        actorId: actor.id, message, context: { activeTab: "dashboard", activeMainView: "dashboard" },
      }) });
      assert(response.response.ok, `Vorschau fehlgeschlagen (${response.response.status}): ${response.payload?.error || response.payload?.message || ""}`);
      assert(response.payload?.actionDraft?.actionId === "invoice.delete", `Keine invoice.delete-Vorschau: ${JSON.stringify(response.payload)}`);
      draftIds.add(response.payload.actionDraft.previewId);
      return response.payload.actionDraft;
    };
    const command = async (draft, commandName, phrase = "") => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, {
      method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
      body: JSON.stringify({ actorId: actor.id, actionId: "invoice.delete", command: commandName, revision: draft.revision, confirmationText: phrase }),
    });

    const blockedFinalized = await createDraft(`Lösche Rechnung ${finalizedInvoiceNumber}. Grund: QA darf nicht gelöscht werden.`);
    assert(blockedFinalized.state === "awaiting_input" && blockedFinalized.confirmation.enabled === false, "Fakturierte Rechnung wurde nicht fail-closed blockiert.");
    assert(blockedFinalized.blockingIssues.some((issue) => issue.includes("Nur Rechnungsentwürfe")), "Storno-/Korrekturhinweis fehlt.");

    const deleteDraft = await createDraft(`Lösche Rechnungsentwurf ${invoiceNumber} kontrolliert. Grund: QA-Doppelanlage.`);
    assert(deleteDraft.confirmation.requiredText === `RECHNUNG LÖSCHEN ${invoiceNumber}`, "Löschphrase ist falsch.");
    const wrong = await command(deleteDraft, "confirm", deleteDraft.confirmation.requiredText.toLowerCase());
    assert(wrong.response.status === 400, "Falsche Löschphrase wurde nicht abgewiesen.");
    assert((await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).status === "Entwurf", "Falsche Phrase hat die Rechnung verändert.");
    const deleted = await command(deleteDraft, "confirm", deleteDraft.confirmation.requiredText);
    assert(deleted.response.ok && deleted.payload?.actionDraft?.state === "executed", "Löschung wurde nicht ausgeführt.");
    const replay = await command(deleteDraft, "confirm", deleteDraft.confirmation.requiredText);
    assert(replay.response.ok && replay.payload?.actionDraft?.result?.entityId === invoiceId, "Lösch-Replay ist nicht idempotent.");
    assert((await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).status === "Gelöscht", "Soft-Delete fehlt.");

    const cancelledRestore = await createDraft(`Stelle Rechnung ${invoiceNumber} wieder her. Grund: QA-Kontrollierter Abbruch.`);
    const cancelled = await command(cancelledRestore, "cancel");
    assert(cancelled.response.ok && cancelled.payload?.actionDraft?.state === "cancelled", "Wiederherstellungsabbruch fehlt.");
    assert((await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).status === "Gelöscht", "Abbruch hat die Rechnung verändert.");
    const restoreDraft = await createDraft(`Stelle Rechnung ${invoiceNumber} wieder her. Grund: QA-Irrtum korrigiert.`);
    assert(restoreDraft.confirmation.requiredText === `RECHNUNG WIEDERHERSTELLEN ${invoiceNumber}`, "Wiederherstellungsphrase ist falsch.");
    const restored = await command(restoreDraft, "confirm", restoreDraft.confirmation.requiredText);
    assert(restored.response.ok && restored.payload?.actionDraft?.state === "executed", "Wiederherstellung wurde nicht ausgeführt.");

    const [invoice, histories, logs, linkedTimes, inventory, dispatches, derived, projectAfter] = await Promise.all([
      prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { lines: true } }),
      prisma.invoiceHistory.findMany({ where: { organizationId: actor.organizationId, invoiceId, createdAt: { gte: startedAt } } }),
      prisma.projectLogbookEntry.findMany({ where: { organizationId: actor.organizationId, projectId: project.id, source: "jarvis", createdAt: { gte: startedAt }, body: { contains: invoiceNumber } } }),
      prisma.projectTimeEntry.count({ where: { organizationId: actor.organizationId, OR: [{ invoiceId }, { invoiceNumber }] } }),
      prisma.catalogInventoryMovement.count({ where: { organizationId: actor.organizationId, referenceType: "invoice", referenceId: invoiceId } }),
      prisma.documentMailDispatch.count({ where: { organizationId: actor.organizationId, documentKind: "invoice", documentId: invoiceId } }),
      prisma.invoice.count({ where: { organizationId: actor.organizationId, sourceInvoiceId: invoiceId } }),
      prisma.workPilotProject.findUniqueOrThrow({ where: { id: project.id }, select: { status: true, updatedAt: true } }),
    ]);
    assert(invoice.status === "Entwurf" && invoice.pdfData === pdfData && invoice.lines.length === 1 && invoice.lines[0].id === lineId, "Entwurfsinhalt wurde nicht vollständig bewahrt.");
    assert(invoice.isPaid === false && invoice.paidAt === null && invoice.reminderLevel === 0, "Zahlungs- oder Mahnstatus wurde verändert.");
    assert(histories.length === 2 && histories.some((item) => item.eventType === "deleted") && histories.some((item) => item.eventType === "restored"), "Historie ist nicht exactly-once.");
    assert(logs.length === 2, "Projektlogbuch ist nicht exactly-once.");
    assert(linkedTimes === 0 && inventory === 0 && dispatches === 0 && derived === 0, "Unzulässige Nebenwirkungen wurden erzeugt.");
    assert(projectAfter.status === project.status && projectAfter.updatedAt.toISOString() === project.updatedAt.toISOString(), "Projekt wurde verändert.");
    assert((await prisma.invoice.findUniqueOrThrow({ where: { id: finalizedInvoiceId } })).status === "Fakturiert", "Blockierte fakturierte Rechnung wurde verändert.");
    result = {
      baseUrl, finalizedDeletionBlocked: true, deleteSafe: true, restoreSafe: true, cancelSafe: true,
      wrongPhraseRejected: true, replayExactlyOnce: true, histories: histories.length,
      logbookEntries: logs.length, draftContentPreserved: true, projectUnchanged: true,
      linkedTimesCreated: linkedTimes, inventoryMovementsCreated: inventory,
      dispatchesCreated: dispatches, derivedInvoicesCreated: derived,
    };
  } finally {
    const logs = await prisma.projectLogbookEntry.findMany({ where: { organizationId: actor.organizationId, projectId: project.id, createdAt: { gte: startedAt }, body: { contains: invoiceNumber } }, select: { id: true } });
    await prisma.$transaction([
      prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } }),
      prisma.invoiceHistory.deleteMany({ where: { invoiceId: { in: [invoiceId, finalizedInvoiceId] } } }),
      prisma.projectLogbookEntry.deleteMany({ where: { id: { in: logs.map((item) => item.id) } } }),
      prisma.invoice.deleteMany({ where: { id: { in: [invoiceId, finalizedInvoiceId] } } }),
      prisma.authSession.deleteMany({ where: { id: sessionId } }),
    ]);
  }
  const residue = {
    invoices: await prisma.invoice.count({ where: { id: { in: [invoiceId, finalizedInvoiceId] } } }),
    histories: await prisma.invoiceHistory.count({ where: { invoiceId: { in: [invoiceId, finalizedInvoiceId] } } }),
    drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }),
    sessions: await prisma.authSession.count({ where: { id: sessionId } }),
  };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
