import { createHmac, randomUUID } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { PrismaClient, Role } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const baseUrl = (
  process.argv.find((argument) => argument.startsWith("--base-url="))?.split(
    "="
  )[1] || "http://localhost:3001"
).replace(/\/$/, "");
const sessionSecret =
  process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET;

if (!sessionSecret) {
  throw new Error("WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET fehlt.");
}

async function loadCorpus() {
  const sourcePath = path.resolve(
    process.cwd(),
    "src/lib/jarvis/live-question-corpus.ts"
  );
  const source = await fs.readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
  });
  return module.exports.JARVIS_LIVE_QUESTION_CORPUS;
}

function createSessionToken(sessionId, version) {
  const value = `v2.${sessionId}.${version}`;
  const signature = createHmac("sha256", sessionSecret)
    .update(value)
    .digest("base64url");
  return `${value}.${signature}`;
}

function getBerlinDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Berlin",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

function formatGermanDate(dateKey) {
  const [year, month, day] = dateKey.split("-");
  return `${day}.${month}.${year}`;
}

async function main() {
  const corpus = await loadCorpus();
  if (!Array.isArray(corpus) || corpus.length !== 110) {
    throw new Error(`Der permanente Korpus enthält ${corpus?.length ?? 0} statt 110 Fragen.`);
  }
  const actor = await prisma.user.findFirst({
    where: {
      role: Role.GESCHAEFTSFUEHRER,
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, organizationId: true },
  });
  if (!actor) throw new Error("Kein aktiver Geschäftsführungs-Testakteur gefunden.");

  const now = new Date();
  const paymentInvoice = await prisma.invoice.findFirst({
    where: {
      organizationId: actor.organizationId,
      status: "Fakturiert",
      isPaid: false,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      isPaid: true,
      paidAt: true,
      updatedAt: true,
    },
  });
  const reminderInvoice = await prisma.invoice.findFirst({
    where: {
      organizationId: actor.organizationId,
      status: "Fakturiert",
      isPaid: false,
      reminderLevel: { lt: 3 },
      dueDate: { lt: getBerlinDateKey(now), not: "" },
      customerName: { not: "" },
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      invoiceNumber: true,
      reminderLevel: true,
      lastReminderAt: true,
      updatedAt: true,
    },
  });
  const cancellationInvoice = paymentInvoice;
  const creditInvoice = await prisma.invoice.findFirst({
    where: {
      organizationId: actor.organizationId,
      status: { in: ["Fakturiert", "Bezahlt"] },
      sourceInvoiceId: "",
      lines: { some: { totalNet: { gt: 20 } } },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      isPaid: true,
      updatedAt: true,
      lines: { orderBy: { position: "asc" }, select: { id: true, totalNet: true } },
    },
  });
  const sessionId = randomUUID();
  await prisma.authSession.create({
    data: {
      id: sessionId,
      userId: actor.id,
      tokenVersion: 1,
      createdAt: now,
      lastSeenAt: now,
      lastRotatedAt: now,
      idleExpiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      absoluteExpiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    },
  });
  const cookie = `workpilot_session=${createSessionToken(sessionId, 1)}`;
  const createdDraftIds = new Set();
  const failures = [];
  let actionDraftCount = 0;
  let invoicePaymentDraftPrepared = false;
  let invoiceReminderDraftPrepared = false;
  let invoiceCancellationDraftPrepared = false;
  let invoiceCreditDraftPrepared = false;

  try {
    for (const item of corpus) {
      try {
        const isPaymentCase = item.question.includes(
          "kontrolliert als bezahlt"
        );
        const paymentDate = getBerlinDateKey(now);
        const isReminderCase = item.question.includes("Erstelle eine Mahnung");
        const isCancellationCase = item.question.includes("Storniere Rechnung");
        const isCreditCase = item.question.includes("Teilgutschrift");
        const reminderDeadlineDate = new Date(`${paymentDate}T12:00:00.000Z`);
        reminderDeadlineDate.setUTCDate(reminderDeadlineDate.getUTCDate() + 7);
        const reminderDeadline = reminderDeadlineDate.toISOString().slice(0, 10);
        const question =
          isPaymentCase && paymentInvoice
            ? `Markiere Rechnung ${paymentInvoice.invoiceNumber} am ${formatGermanDate(
                paymentDate
              )} kontrolliert als bezahlt.`
            : isReminderCase && reminderInvoice
              ? `Erstelle eine Mahnung für Rechnung ${reminderInvoice.invoiceNumber} mit Zahlungsfrist bis ${formatGermanDate(reminderDeadline)}.`
            : isCancellationCase && cancellationInvoice
              ? `Storniere Rechnung ${cancellationInvoice.invoiceNumber} vollständig wegen QA-Doppelberechnung.`
            : isCreditCase && creditInvoice
              ? `Erstelle eine Teilgutschrift zu Rechnung ${creditInvoice.invoiceNumber} über 20 Euro netto wegen QA-Preisnachlass.`
            : item.question;
        const response = await fetch(`${baseUrl}/api/jarvis/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookie,
          },
          body: JSON.stringify({
            actorId: actor.id,
            message: question,
            context: {
              activeTab: "dashboard",
              activeMainView: "dashboard",
            },
          }),
        });
        const payload = await response.json().catch(() => null);
        if (
          !response.ok ||
          !payload ||
          typeof payload.type !== "string" ||
          typeof payload.message !== "string" ||
          !payload.message.trim()
        ) {
          failures.push({
            id: item.id,
            status: response.status,
            error: payload?.error || "unvollständige Antwort",
          });
          continue;
        }
        if (payload.actionDraft?.previewId) {
          actionDraftCount += 1;
          createdDraftIds.add(payload.actionDraft.previewId);
          if (payload.actionDraft.state === "executed") {
            failures.push({
              id: item.id,
              status: response.status,
              error: "Eine Korpusfrage hat unerwartet eine Aktion ausgeführt.",
            });
          }
        }
        if (isPaymentCase && paymentInvoice) {
          if (payload.actionDraft?.actionId !== "invoice.mark-paid") {
            failures.push({
              id: item.id,
              status: response.status,
              error:
                "Die Bezahlt-Frage hat keine kontrollierte invoice.mark-paid-Vorschau erzeugt.",
            });
          } else {
            invoicePaymentDraftPrepared = true;
          }
        }
        if (isReminderCase && reminderInvoice) {
          if (payload.actionDraft?.actionId !== "invoice.remind") {
            failures.push({
              id: item.id,
              status: response.status,
              error:
                "Die Mahnfrage hat keine kontrollierte invoice.remind-Vorschau erzeugt.",
            });
          } else if (
            payload.actionDraft.state !== "awaiting_confirmation" ||
            payload.actionDraft.confirmation?.enabled !== true ||
            payload.actionDraft.blockingIssues?.length
          ) {
            failures.push({
              id: item.id,
              status: response.status,
              error:
                "Die Mahnfrage hat keine vollständig prüfbare, unblockierte Bestätigungsvorschau erzeugt.",
            });
          } else {
            invoiceReminderDraftPrepared = true;
          }
        }
        if (isCancellationCase && cancellationInvoice) {
          if (payload.actionDraft?.actionId !== "invoice.cancel") {
            failures.push({
              id: item.id,
              status: response.status,
              error: "Die Stornofrage hat keine kontrollierte invoice.cancel-Vorschau erzeugt.",
            });
          } else if (
            payload.actionDraft.state !== "awaiting_confirmation" ||
            payload.actionDraft.confirmation?.enabled !== true ||
            payload.actionDraft.blockingIssues?.length
          ) {
            failures.push({
              id: item.id,
              status: response.status,
              error: "Die Stornofrage hat keine vollständig prüfbare, unblockierte Bestätigungsvorschau erzeugt.",
            });
          } else {
            invoiceCancellationDraftPrepared = true;
          }
        }
        if (isCreditCase && creditInvoice) {
          if (payload.actionDraft?.actionId !== "invoice.credit") {
            failures.push({
              id: item.id,
              status: response.status,
              error: "Die Gutschriftfrage hat keine kontrollierte invoice.credit-Vorschau erzeugt.",
            });
          } else {
            invoiceCreditDraftPrepared = true;
          }
        }
      } catch (error) {
        failures.push({
          id: item.id,
          status: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const dispatchCount = await prisma.documentMailDispatch.count({
      where: {
        organizationId: actor.organizationId,
        createdAt: { gte: now },
      },
    });
    if (dispatchCount !== 0) {
      failures.push({
        id: "side-effect-dispatch",
        status: 0,
        error: `${dispatchCount} unerwartete Versanddatensätze seit Testbeginn.`,
      });
    }
    if (paymentInvoice) {
      const [currentPaymentInvoice, paymentHistoryCount] = await Promise.all([
        prisma.invoice.findUnique({
          where: { id: paymentInvoice.id },
          select: {
            status: true,
            isPaid: true,
            paidAt: true,
            updatedAt: true,
          },
        }),
        prisma.invoiceHistory.count({
          where: {
            organizationId: actor.organizationId,
            invoiceId: paymentInvoice.id,
            eventType: "paid",
            createdAt: { gte: now },
          },
        }),
      ]);
      if (
        !currentPaymentInvoice ||
        currentPaymentInvoice.status !== paymentInvoice.status ||
        currentPaymentInvoice.isPaid !== paymentInvoice.isPaid ||
        currentPaymentInvoice.paidAt?.toISOString() !==
          paymentInvoice.paidAt?.toISOString() ||
        currentPaymentInvoice.updatedAt.toISOString() !==
          paymentInvoice.updatedAt.toISOString() ||
        paymentHistoryCount !== 0
      ) {
        failures.push({
          id: "side-effect-invoice-payment",
          status: 0,
          error:
            "Die 110-Fragen-Prüfung hat unerwartet Rechnung oder Zahlungshistorie verändert.",
        });
      }
    }
    if (reminderInvoice) {
      const [currentReminderInvoice, reminderHistoryCount, reminderLogbookCount] =
        await Promise.all([
          prisma.invoice.findUnique({
            where: { id: reminderInvoice.id },
            select: {
              reminderLevel: true,
              lastReminderAt: true,
              updatedAt: true,
            },
          }),
          prisma.invoiceHistory.count({
            where: {
              organizationId: actor.organizationId,
              invoiceId: reminderInvoice.id,
              eventType: "reminder-document",
              createdAt: { gte: now },
            },
          }),
          prisma.projectLogbookEntry.count({
            where: {
              organizationId: actor.organizationId,
              projectId: { not: "" },
              title: "Dokumente: Mahnung",
              createdAt: { gte: now },
            },
          }),
        ]);
      if (
        !currentReminderInvoice ||
        currentReminderInvoice.reminderLevel !== reminderInvoice.reminderLevel ||
        currentReminderInvoice.lastReminderAt?.toISOString() !==
          reminderInvoice.lastReminderAt?.toISOString() ||
        currentReminderInvoice.updatedAt.toISOString() !==
          reminderInvoice.updatedAt.toISOString() ||
        reminderHistoryCount !== 0 ||
        reminderLogbookCount !== 0
      ) {
        failures.push({
          id: "side-effect-invoice-reminder",
          status: 0,
          error:
            "Die 110-Fragen-Prüfung hat unerwartet Mahnstufe, Mahnhistorie oder Projektakte verändert.",
        });
      }
    }
    if (cancellationInvoice) {
      const [currentInvoice, cancellationHistoryCount, cancellationRecordCount] = await Promise.all([
        prisma.invoice.findUnique({
          where: { id: cancellationInvoice.id },
          select: { status: true, isPaid: true, updatedAt: true },
        }),
        prisma.invoiceHistory.count({
          where: {
            organizationId: actor.organizationId,
            invoiceId: cancellationInvoice.id,
            eventType: "cancelled",
            createdAt: { gte: now },
          },
        }),
        prisma.invoice.count({
          where: {
            organizationId: actor.organizationId,
            status: "Stornorechnung",
            createdAt: { gte: now },
          },
        }),
      ]);
      if (
        !currentInvoice ||
        currentInvoice.status !== cancellationInvoice.status ||
        currentInvoice.isPaid !== cancellationInvoice.isPaid ||
        currentInvoice.updatedAt.toISOString() !== cancellationInvoice.updatedAt.toISOString() ||
        cancellationHistoryCount !== 0 ||
        cancellationRecordCount !== 0
      ) {
        failures.push({
          id: "side-effect-invoice-cancellation",
          status: 0,
          error: "Die 110-Fragen-Prüfung hat unerwartet eine Rechnung storniert oder eine Stornorechnung erzeugt.",
        });
      }
    }
    if (creditInvoice) {
      const [currentInvoice, creditHistoryCount, creditRecordCount] = await Promise.all([
        prisma.invoice.findUnique({
          where: { id: creditInvoice.id },
          select: { status: true, isPaid: true, updatedAt: true },
        }),
        prisma.invoiceHistory.count({
          where: {
            organizationId: actor.organizationId,
            invoiceId: creditInvoice.id,
            eventType: "credit-created",
            createdAt: { gte: now },
          },
        }),
        prisma.invoice.count({
          where: {
            organizationId: actor.organizationId,
            status: "Gutschrift",
            createdAt: { gte: now },
          },
        }),
      ]);
      if (
        !currentInvoice ||
        currentInvoice.status !== creditInvoice.status ||
        currentInvoice.isPaid !== creditInvoice.isPaid ||
        currentInvoice.updatedAt.toISOString() !== creditInvoice.updatedAt.toISOString() ||
        creditHistoryCount !== 0 ||
        creditRecordCount !== 0
      ) {
        failures.push({
          id: "side-effect-invoice-credit",
          status: 0,
          error: "Die 110-Fragen-Prüfung hat unerwartet eine Teilgutschrift oder Gutschrifthistorie erzeugt.",
        });
      }
    }
  } finally {
    if (createdDraftIds.size) {
      await prisma.jarvisActionDraft.deleteMany({
        where: {
          id: { in: [...createdDraftIds] },
          organizationId: actor.organizationId,
          executedAt: null,
        },
      });
    }
    await prisma.authSession.deleteMany({ where: { id: sessionId } });
  }

  const remainingDrafts = createdDraftIds.size
    ? await prisma.jarvisActionDraft.count({
        where: { id: { in: [...createdDraftIds] } },
      })
    : 0;
  const result = {
    baseUrl,
    passed: corpus.length - failures.length,
    total: corpus.length,
    actionDraftsPrepared: actionDraftCount,
    invoicePaymentDraftPrepared,
    invoiceReminderDraftPrepared,
    invoiceCancellationDraftPrepared,
    invoiceCreditDraftPrepared,
    executedActions: 0,
    failures,
    qaDraftsRemaining: remainingDrafts,
    qaSessionsRemaining: await prisma.authSession.count({
      where: { id: sessionId },
    }),
  };
  console.log(JSON.stringify(result, null, 2));
  if (failures.length || remainingDrafts) process.exitCode = 1;
}

await main().finally(() => prisma.$disconnect());
