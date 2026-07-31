import { createHmac, randomInt, randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = (
  process.argv.find((argument) => argument.startsWith("--base-url="))?.split("=")[1] ||
  "http://localhost:3001"
).replace(/\/$/, "");
const sessionSecret = process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
if (!sessionSecret) throw new Error("WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET fehlt.");

function createSessionToken(sessionId, version) {
  const value = `v2.${sessionId}.${version}`;
  const signature = createHmac("sha256", sessionSecret).update(value).digest("base64url");
  return `${value}.${signature}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function requestJson(pathname, cookie, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
      Cookie: cookie,
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

async function unusedOfferNumber(organizationId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const offerNumber = `ANG-${randomInt(900000, 999999)}`;
    if (!(await prisma.offer.count({ where: { organizationId, offerNumber } }))) return offerNumber;
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
  if (!project) throw new Error("Kein geeignetes QA-Projekt gefunden.");

  const startedAt = new Date();
  const sessionId = randomUUID();
  const offerId = randomUUID();
  const offerNumber = await unusedOfferNumber(actor.organizationId);
  const draftIds = new Set();
  let result = null;

  await prisma.authSession.create({
    data: {
      id: sessionId, userId: actor.id, tokenVersion: 1,
      createdAt: startedAt, lastSeenAt: startedAt, lastRotatedAt: startedAt,
      idleExpiresAt: new Date(startedAt.getTime() + 60 * 60 * 1000),
      absoluteExpiresAt: new Date(startedAt.getTime() + 60 * 60 * 1000),
    },
  });
  const cookie = `workpilot_session=${createSessionToken(sessionId, 1)}`;

  await prisma.offer.create({
    data: {
      id: offerId,
      organizationId: actor.organizationId,
      projectId: project.id,
      projectNumber: project.projectNumber,
      projectTitle: project.title,
      company: "OK solutions",
      offerNumber,
      status: "Entwurf",
      customerName: project.customer || "QA Kunde",
      plannedExecutionMonth: "2026-11",
      introText: "QA Angebotsfinalisierung",
      closingText: "QA Abschluss",
      netTotal: 100,
      vatRate: 19,
      grossTotal: 119,
      lines: {
        create: {
          id: randomUUID(),
          organizationId: actor.organizationId,
          position: 1,
          quantity: 2,
          unit: "Std",
          title: "QA Angebotsleistung",
          description: "Kontrollierte JARVIS-Finalisierung",
          unitPrice: 50,
          vatRate: 19,
          totalNet: 100,
        },
      },
    },
  });

  try {
    const before = await prisma.offer.findUniqueOrThrow({
      where: { id: offerId },
      select: { status: true, pdfData: true, wonAt: true, lostAt: true, updatedAt: true },
    });
    const dispatchBefore = await prisma.documentMailDispatch.count({
      where: { organizationId: actor.organizationId, createdAt: { gte: startedAt } },
    });
    const tasksBefore = await prisma.task.count({
      where: { organizationId: actor.organizationId, projectId: project.id, createdAt: { gte: startedAt } },
    });

    const chat = await requestJson("/api/jarvis/chat", cookie, {
      method: "POST",
      body: JSON.stringify({
        actorId: actor.id,
        message: `Finalisiere Angebot ${offerNumber} kontrolliert.`,
        context: { activeTab: "dashboard", activeMainView: "dashboard" },
      }),
    });
    assert(chat.response.ok, `Angebotsvorschau fehlgeschlagen (${chat.response.status}).`);
    const draft = chat.payload?.actionDraft;
    assert(draft?.actionId === "offer.finalize", "JARVIS hat keine offer.finalize-Vorschau erzeugt.");
    assert(draft.state === "awaiting_confirmation", "Die Finalisierung ist nicht bestätigungsbereit.");
    assert(draft.confirmation?.enabled === true, "Die kritische Bestätigung ist nicht freigeschaltet.");
    assert(draft.blockingIssues?.length === 0, "Die gültige Vorschau ist unerwartet blockiert.");
    assert(draft.confirmation.requiredText === `ANGEBOT FINALISIEREN ${offerNumber}`, "Die Bestätigungsphrase ist falsch.");
    draftIds.add(draft.previewId);

    const wrong = await requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, {
      method: "POST",
      headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
      body: JSON.stringify({
        actorId: actor.id, actionId: "offer.finalize", command: "confirm",
        revision: draft.revision, confirmationText: draft.confirmation.requiredText.toLowerCase(),
      }),
    });
    assert(wrong.response.status === 400, "Eine falsche Bestätigungsphrase wurde nicht abgewiesen.");
    const afterWrong = await prisma.offer.findUniqueOrThrow({ where: { id: offerId } });
    assert(afterWrong.status === "Entwurf" && !afterWrong.pdfData, "Die falsche Phrase hat das Angebot verändert.");

    const confirmed = await requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, {
      method: "POST",
      headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
      body: JSON.stringify({
        actorId: actor.id, actionId: "offer.finalize", command: "confirm",
        revision: draft.revision, confirmationText: draft.confirmation.requiredText,
      }),
    });
    assert(confirmed.response.ok, `Angebotsfinalisierung fehlgeschlagen (${confirmed.response.status}): ${confirmed.payload?.error || ""}`);
    assert(confirmed.payload?.actionDraft?.state === "executed", "Die Angebotsvorschau wurde nicht ausgeführt.");
    assert(confirmed.payload.actionDraft.result?.entityId === offerId, "Die Ergebnis-ID ist falsch.");

    const replay = await requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, {
      method: "POST",
      headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
      body: JSON.stringify({
        actorId: actor.id, actionId: "offer.finalize", command: "confirm",
        revision: draft.revision, confirmationText: draft.confirmation.requiredText,
      }),
    });
    assert(replay.response.ok, `Idempotenter Replay fehlgeschlagen (${replay.response.status}).`);
    assert(replay.payload?.actionDraft?.result?.entityId === offerId, "Der Replay verweist nicht auf dasselbe Angebot.");

    const [after, histories, dispatchAfter, tasksAfter, projectAfter] = await Promise.all([
      prisma.offer.findUniqueOrThrow({
        where: { id: offerId },
        select: { status: true, pdfData: true, wonAt: true, lostAt: true, netTotal: true, grossTotal: true },
      }),
      prisma.offerHistory.findMany({
        where: { organizationId: actor.organizationId, offerId, createdAt: { gte: startedAt } },
      }),
      prisma.documentMailDispatch.count({
        where: { organizationId: actor.organizationId, createdAt: { gte: startedAt } },
      }),
      prisma.task.count({
        where: { organizationId: actor.organizationId, projectId: project.id, createdAt: { gte: startedAt } },
      }),
      prisma.workPilotProject.findUnique({ where: { id: project.id }, select: { status: true, updatedAt: true } }),
    ]);
    assert(after.status === "Erstellt", "Der Angebotsstatus wurde nicht finalisiert.");
    assert(after.pdfData?.length > 100, "Das finale Angebots-PDF fehlt.");
    assert(after.netTotal === 100 && after.grossTotal === 119, "Die Angebotssummen wurden verändert.");
    assert(after.wonAt?.toISOString() === before.wonAt?.toISOString(), "Das Angebot wurde unerwartet gewonnen markiert.");
    assert(after.lostAt?.toISOString() === before.lostAt?.toISOString(), "Das Angebot wurde unerwartet verloren markiert.");
    assert(histories.length === 1 && histories[0].eventType === "finalized", "Die eindeutige Finalisierungshistorie fehlt.");
    assert(dispatchAfter === dispatchBefore, "Die Finalisierung hat einen Versand ausgelöst.");
    assert(tasksAfter === tasksBefore, "Die Finalisierung hat eine Aufgabe angelegt.");
    assert(projectAfter?.status === project.status && projectAfter.updatedAt.toISOString() === project.updatedAt.toISOString(), "Die Finalisierung hat den Projektstatus verändert.");

    result = {
      baseUrl,
      offerNumber,
      exactPhraseRequired: true,
      wrongPhraseRejected: true,
      exactlyOnce: true,
      status: after.status,
      pdfBytesBase64: after.pdfData.length,
      historyEvents: histories.map((item) => item.eventType),
      dispatchesCreated: dispatchAfter - dispatchBefore,
      tasksCreated: tasksAfter - tasksBefore,
      projectUnchanged: true,
      wonLostUnchanged: true,
    };
  } finally {
    await prisma.$transaction([
      prisma.jarvisActionDraft.deleteMany({ where: { organizationId: actor.organizationId, id: { in: [...draftIds] } } }),
      prisma.offerHistory.deleteMany({ where: { organizationId: actor.organizationId, offerId } }),
      prisma.offer.deleteMany({ where: { organizationId: actor.organizationId, id: offerId } }),
      prisma.authSession.deleteMany({ where: { id: sessionId } }),
    ]);
  }

  const residue = {
    offers: await prisma.offer.count({ where: { id: offerId } }),
    histories: await prisma.offerHistory.count({ where: { offerId } }),
    drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }),
    sessions: await prisma.authSession.count({ where: { id: sessionId } }),
  };
  assert(Object.values(residue).every((count) => count === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
