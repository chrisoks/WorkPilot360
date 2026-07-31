import { createHmac, randomInt, randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = (
  process.argv.find((argument) => argument.startsWith("--base-url="))?.split("=")[1] ||
  "http://localhost:3001"
).replace(/\/$/, "");
const sessionSecret =
  process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET;

if (!sessionSecret) {
  throw new Error("WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET fehlt.");
}

function createSessionToken(sessionId, version) {
  const value = `v2.${sessionId}.${version}`;
  const signature = createHmac("sha256", sessionSecret)
    .update(value)
    .digest("base64url");
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

async function createUnusedInvoiceNumber(organizationId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const invoiceNumber = `RE-${randomInt(900000, 999999)}`;
    const exists = await prisma.invoice.count({
      where: { organizationId, invoiceNumber },
    });
    if (!exists) return invoiceNumber;
  }
  throw new Error("Keine freie QA-Rechnungsnummer gefunden.");
}

async function main() {
  const actor = await prisma.user.findFirst({
    where: { role: Role.GESCHAEFTSFUEHRER, isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      organizationId: true,
      firstName: true,
      lastName: true,
    },
  });
  if (!actor) throw new Error("Kein aktiver Geschäftsführungs-Testakteur gefunden.");

  const startedAt = new Date();
  const sessionId = randomUUID();
  const projectId = `qa-jarvis-credit-${randomUUID()}`;
  const invoiceNumber = await createUnusedInvoiceNumber(actor.organizationId);
  const originalInvoiceId = randomUUID();
  const originalLineId = randomUUID();
  const draftIds = new Set();
  let creditInvoiceId = "";
  let executionResult = null;

  await prisma.authSession.create({
    data: {
      id: sessionId,
      userId: actor.id,
      tokenVersion: 1,
      createdAt: startedAt,
      lastSeenAt: startedAt,
      lastRotatedAt: startedAt,
      idleExpiresAt: new Date(startedAt.getTime() + 60 * 60 * 1000),
      absoluteExpiresAt: new Date(startedAt.getTime() + 60 * 60 * 1000),
    },
  });
  const cookie = `workpilot_session=${createSessionToken(sessionId, 1)}`;

  await prisma.invoice.create({
    data: {
      id: originalInvoiceId,
      organizationId: actor.organizationId,
      projectId,
      projectNumber: "QA-CREDIT",
      projectTitle: "JARVIS Teilgutschrift QA",
      company: "OK solutions",
      invoiceNumber,
      status: "Fakturiert",
      billingSource: "qa-jarvis-credit",
      customerName: "QA Teilgutschrift",
      serviceDate: "2026-07-31",
      netTotal: 100,
      vatRate: 19,
      grossTotal: 119,
      isPaid: false,
      lines: {
        create: {
          id: originalLineId,
          organizationId: actor.organizationId,
          position: 1,
          quantity: 1,
          unit: "Pauschal",
          title: "QA-Leistung",
          description: "Kontrollierte JARVIS-Teilgutschrift",
          unitPrice: 100,
          vatRate: 19,
          totalNet: 100,
        },
      },
    },
  });

  try {
    const originalBefore = await prisma.invoice.findUniqueOrThrow({
      where: { id: originalInvoiceId },
      select: {
        status: true,
        isPaid: true,
        paidAt: true,
        netTotal: true,
        grossTotal: true,
        updatedAt: true,
      },
    });

    const chat = await requestJson("/api/jarvis/chat", cookie, {
      method: "POST",
      body: JSON.stringify({
        actorId: actor.id,
        message: `Erstelle eine Teilgutschrift zu Rechnung ${invoiceNumber} über 20 Euro netto wegen QA-Preisnachlass.`,
        context: { activeTab: "dashboard", activeMainView: "dashboard" },
      }),
    });
    assert(chat.response.ok, `Gutschriftvorschau fehlgeschlagen (${chat.response.status}).`);
    const draft = chat.payload?.actionDraft;
    assert(draft?.actionId === "invoice.credit", "JARVIS hat keine invoice.credit-Vorschau erzeugt.");
    assert(draft.state === "awaiting_confirmation", "Die Teilgutschrift ist nicht bestätigungsbereit.");
    assert(draft.confirmation?.enabled === true, "Die kritische Bestätigung ist nicht freigeschaltet.");
    assert(draft.editor?.items?.[0]?.sourceInvoiceLineId === originalLineId, "Die Referenzposition fehlt.");
    assert(draft.editor.items[0].netAmount === 20, "Der Nettobetrag wurde nicht korrekt übernommen.");
    assert(draft.blockingIssues?.length === 0, "Die gültige Vorschau ist unerwartet blockiert.");
    assert(typeof draft.confirmation.requiredText === "string", "Die Bestätigungsphrase fehlt.");
    draftIds.add(draft.previewId);

    const wrongConfirmation = await requestJson(
      `/api/jarvis/action-drafts/${draft.previewId}`,
      cookie,
      {
        method: "POST",
        headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
        body: JSON.stringify({
          actorId: actor.id,
          actionId: "invoice.credit",
          command: "confirm",
          revision: draft.revision,
          confirmationText: draft.confirmation.requiredText.toLowerCase(),
        }),
      }
    );
    assert(wrongConfirmation.response.status === 400, "Eine falsche Groß-/Kleinschreibung wurde nicht abgewiesen.");
    assert(
      (await prisma.invoice.count({ where: { sourceInvoiceId: originalInvoiceId } })) === 0,
      "Die falsche Phrase hat eine Gutschrift erzeugt."
    );

    const confirmed = await requestJson(
      `/api/jarvis/action-drafts/${draft.previewId}`,
      cookie,
      {
        method: "POST",
        headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
        body: JSON.stringify({
          actorId: actor.id,
          actionId: "invoice.credit",
          command: "confirm",
          revision: draft.revision,
          confirmationText: draft.confirmation.requiredText,
        }),
      }
    );
    assert(confirmed.response.ok, `Gutschriftausführung fehlgeschlagen (${confirmed.response.status}).`);
    assert(confirmed.payload?.actionDraft?.state === "executed", "Der Gutschriftentwurf wurde nicht ausgeführt.");
    creditInvoiceId = confirmed.payload.actionDraft.result?.entityId || "";
    assert(creditInvoiceId, "Die ausgeführte Gutschrift enthält keine Ergebnis-ID.");

    const replay = await requestJson(
      `/api/jarvis/action-drafts/${draft.previewId}`,
      cookie,
      {
        method: "POST",
        headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
        body: JSON.stringify({
          actorId: actor.id,
          actionId: "invoice.credit",
          command: "confirm",
          revision: draft.revision,
          confirmationText: draft.confirmation.requiredText,
        }),
      }
    );
    assert(replay.response.ok, `Idempotenter Wiederholungsaufruf fehlgeschlagen (${replay.response.status}).`);
    assert(replay.payload?.actionDraft?.result?.entityId === creditInvoiceId, "Der Replay verweist nicht auf dieselbe Gutschrift.");

    const [originalAfter, credits, histories, logbooks, timeEntries, inventoryMovements] =
      await Promise.all([
        prisma.invoice.findUniqueOrThrow({
          where: { id: originalInvoiceId },
          select: {
            status: true,
            isPaid: true,
            paidAt: true,
            netTotal: true,
            grossTotal: true,
            updatedAt: true,
          },
        }),
        prisma.invoice.findMany({
          where: { sourceInvoiceId: originalInvoiceId },
          include: { lines: true },
        }),
        prisma.invoiceHistory.findMany({
          where: { organizationId: actor.organizationId, projectId },
          orderBy: { createdAt: "asc" },
        }),
        prisma.projectLogbookEntry.findMany({
          where: { organizationId: actor.organizationId, projectId },
        }),
        prisma.projectTimeEntry.count({
          where: { organizationId: actor.organizationId, projectId },
        }),
        prisma.catalogInventoryMovement.count({
          where: {
            organizationId: actor.organizationId,
            OR: [
              { invoiceId: originalInvoiceId },
              { invoiceId: creditInvoiceId },
              { projectId },
            ],
          },
        }),
      ]);

    assert(originalAfter.status === originalBefore.status, "Der Status der Originalrechnung wurde verändert.");
    assert(originalAfter.isPaid === originalBefore.isPaid, "Der Zahlungsstatus der Originalrechnung wurde verändert.");
    assert(originalAfter.paidAt?.toISOString() === originalBefore.paidAt?.toISOString(), "Das Zahlungsdatum wurde verändert.");
    assert(originalAfter.netTotal === originalBefore.netTotal && originalAfter.grossTotal === originalBefore.grossTotal, "Die Summen der Originalrechnung wurden verändert.");
    assert(originalAfter.updatedAt.toISOString() === originalBefore.updatedAt.toISOString(), "Die Originalrechnung wurde unerwartet aktualisiert.");
    assert(credits.length === 1, `Es wurden ${credits.length} statt genau einer Gutschrift erzeugt.`);
    const credit = credits[0];
    assert(credit.id === creditInvoiceId, "Die gespeicherte Gutschrift stimmt nicht mit dem JARVIS-Ergebnis überein.");
    assert(credit.status === "Gutschrift" && credit.billingSource === "credit-note", "Belegtyp oder Status der Gutschrift ist falsch.");
    assert(credit.sourceInvoiceNumber === invoiceNumber, "Die Referenz-Rechnungsnummer fehlt.");
    assert(credit.correctionReason === "QA-Preisnachlass.", "Der Korrekturgrund wurde nicht nachvollziehbar gespeichert.");
    assert(credit.netTotal === -20 && credit.grossTotal === -23.8, "Netto- oder Bruttosumme der Gutschrift ist falsch.");
    assert(credit.pdfData?.length > 100, "Der GU-PDF-Beleg fehlt.");
    assert(credit.lines.length === 1, "Die Gutschrift enthält nicht genau eine Position.");
    assert(credit.lines[0].sourceInvoiceLineId === originalLineId, "Die Positionsreferenz fehlt.");
    assert(credit.lines[0].totalNet === -20 && credit.lines[0].vatRate === 19, "Die Gutschriftposition ist rechnerisch falsch.");
    assert(histories.length === 2, `Es wurden ${histories.length} statt zwei Historieneinträgen geschrieben.`);
    assert(new Set(histories.map((item) => item.eventType)).size === 2, "Die beiden Historientypen sind nicht eindeutig.");
    assert(histories.some((item) => item.eventType === "credit-created" && item.invoiceId === originalInvoiceId), "Historie an der Originalrechnung fehlt.");
    assert(histories.some((item) => item.eventType === "created-from-invoice" && item.invoiceId === creditInvoiceId), "Historie an der Gutschrift fehlt.");
    assert(logbooks.length === 1 && logbooks[0].title === "Rechnungskorrektur / Teilgutschrift", "Der eindeutige Logbucheintrag fehlt.");
    assert(timeEntries === 0, "Die Teilgutschrift hat Zeitdaten verändert.");
    assert(inventoryMovements === 0, "Die Teilgutschrift hat Lagerbewegungen erzeugt.");

    const overCredit = await requestJson("/api/jarvis/chat", cookie, {
      method: "POST",
      body: JSON.stringify({
        actorId: actor.id,
        message: `Erstelle eine Teilgutschrift zu Rechnung ${invoiceNumber} über 90 Euro netto wegen QA-Überkorrektur.`,
        context: { activeTab: "dashboard", activeMainView: "dashboard" },
      }),
    });
    assert(overCredit.response.ok, `Überkorrektur-Vorschau fehlgeschlagen (${overCredit.response.status}).`);
    assert(overCredit.payload?.actionDraft?.actionId === "invoice.credit", "Die Überkorrektur wurde nicht als Gutschrift erkannt.");
    assert(overCredit.payload.actionDraft.state === "awaiting_input", "Die Überkorrektur ist nicht blockiert.");
    assert(overCredit.payload.actionDraft.confirmation?.enabled === false, "Die Überkorrektur kann bestätigt werden.");
    assert(overCredit.payload.actionDraft.blockingIssues?.length > 0, "Der Überkorrektur-Hinweis fehlt.");
    draftIds.add(overCredit.payload.actionDraft.previewId);

    const cancellation = await requestJson("/api/jarvis/chat", cookie, {
      method: "POST",
      body: JSON.stringify({
        actorId: actor.id,
        message: `Storniere Rechnung ${invoiceNumber} vollständig wegen QA-Doppelberechnung.`,
        context: { activeTab: "dashboard", activeMainView: "dashboard" },
      }),
    });
    assert(cancellation.response.ok, `Storno-Sperrprüfung fehlgeschlagen (${cancellation.response.status}).`);
    assert(cancellation.payload?.actionDraft?.actionId === "invoice.cancel", "Der Vollstorno wurde nicht erkannt.");
    assert(cancellation.payload.actionDraft.state === "awaiting_input", "Der Vollstorno trotz Teilgutschrift ist nicht blockiert.");
    assert(cancellation.payload.actionDraft.blockingIssues?.length > 0, "Der Hinweis auf die bestehende Teilgutschrift fehlt.");
    draftIds.add(cancellation.payload.actionDraft.previewId);

    executionResult = {
      baseUrl,
      invoiceNumber,
      creditInvoiceNumber: credit.invoiceNumber,
      exactPhraseRequired: true,
      wrongPhraseRejected: true,
      exactlyOnce: true,
      originalUnchanged: true,
      historyEvents: histories.map((item) => item.eventType).sort(),
      logbookEntries: logbooks.length,
      timeEntries,
      inventoryMovements,
      cumulativeOverCreditBlocked: true,
      fullCancellationAfterCreditBlocked: true,
    };
  } finally {
    const creditIds = await prisma.invoice
      .findMany({
        where: { organizationId: actor.organizationId, sourceInvoiceId: originalInvoiceId },
        select: { id: true },
      })
      .then((items) => items.map((item) => item.id));
    await prisma.$transaction([
      prisma.jarvisActionDraft.deleteMany({
        where: { organizationId: actor.organizationId, id: { in: [...draftIds] } },
      }),
      prisma.invoiceHistory.deleteMany({
        where: { organizationId: actor.organizationId, projectId },
      }),
      prisma.projectLogbookEntry.deleteMany({
        where: { organizationId: actor.organizationId, projectId },
      }),
      prisma.invoice.deleteMany({
        where: { organizationId: actor.organizationId, id: { in: creditIds } },
      }),
      prisma.invoice.deleteMany({
        where: { organizationId: actor.organizationId, id: originalInvoiceId },
      }),
      prisma.authSession.deleteMany({ where: { id: sessionId } }),
    ]);
  }

  const residue = {
    invoices: await prisma.invoice.count({
      where: {
        organizationId: actor.organizationId,
        OR: [{ id: originalInvoiceId }, { sourceInvoiceId: originalInvoiceId }],
      },
    }),
    histories: await prisma.invoiceHistory.count({
      where: { organizationId: actor.organizationId, projectId },
    }),
    logbooks: await prisma.projectLogbookEntry.count({
      where: { organizationId: actor.organizationId, projectId },
    }),
    drafts: await prisma.jarvisActionDraft.count({
      where: { organizationId: actor.organizationId, id: { in: [...draftIds] } },
    }),
    sessions: await prisma.authSession.count({ where: { id: sessionId } }),
  };
  assert(Object.values(residue).every((count) => count === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...executionResult, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
