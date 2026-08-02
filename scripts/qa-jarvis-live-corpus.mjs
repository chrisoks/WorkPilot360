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
  let finalizableOffer = await prisma.offer.findFirst({
    where: {
      organizationId: actor.organizationId,
      status: "Entwurf",
      plannedExecutionMonth: { not: "" },
      lines: { some: {} },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, offerNumber: true, status: true, pdfData: true, updatedAt: true },
  });
  let qaFinalizableOfferId = "";
  if (!finalizableOffer) {
    const project = await prisma.workPilotProject.findFirst({
      where: { organizationId: actor.organizationId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, projectNumber: true, title: true, customer: true },
    });
    if (project) {
      const offerNumber = `ANG-${Date.now().toString().slice(-9)}`;
      const created = await prisma.offer.create({
        data: {
          id: randomUUID(), organizationId: actor.organizationId,
          projectId: project.id, projectNumber: project.projectNumber,
          projectTitle: project.title, company: "OK solutions", offerNumber,
          status: "Entwurf", customerName: project.customer || "QA Kunde",
          plannedExecutionMonth: "2026-11", netTotal: 100, vatRate: 19, grossTotal: 119,
          lines: { create: {
            id: randomUUID(), organizationId: actor.organizationId, position: 1,
            quantity: 1, unit: "Pauschal", title: "QA Korpusleistung",
            unitPrice: 100, vatRate: 19, totalNet: 100,
          } },
        },
        select: { id: true, offerNumber: true, status: true, pdfData: true, updatedAt: true },
      });
      finalizableOffer = created;
      qaFinalizableOfferId = created.id;
    }
  }
  let deliverableOffer = await prisma.offer.findFirst({
    where: {
      organizationId: actor.organizationId,
      status: "Erstellt",
      pdfData: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, offerNumber: true, status: true, pdfData: true, updatedAt: true },
  });
  let qaDeliverableOfferId = "";
  if (!deliverableOffer) {
    const project = await prisma.workPilotProject.findFirst({
      where: { organizationId: actor.organizationId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, projectNumber: true, title: true, customer: true },
    });
    if (project) {
      deliverableOffer = await prisma.offer.create({
        data: {
          id: randomUUID(), organizationId: actor.organizationId,
          projectId: project.id, projectNumber: project.projectNumber,
          projectTitle: project.title, company: "OK solutions",
          offerNumber: `ANG-${Date.now().toString().slice(-8)}1`,
          status: "Erstellt", customerName: project.customer || "QA Kunde",
          plannedExecutionMonth: "2026-11", netTotal: 100, vatRate: 19,
          grossTotal: 119, pdfData: Buffer.from("QA offer PDF").toString("base64"),
        },
        select: { id: true, offerNumber: true, status: true, pdfData: true, updatedAt: true },
      });
      qaDeliverableOfferId = deliverableOffer.id;
    }
  }
  const lifecycleProject = await prisma.workPilotProject.findFirst({
    where: { organizationId: actor.organizationId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, projectNumber: true, title: true, customer: true },
  });
  const lifecycleOffer = lifecycleProject
    ? await prisma.offer.create({
        data: {
          id: randomUUID(), organizationId: actor.organizationId,
          projectId: lifecycleProject.id, projectNumber: lifecycleProject.projectNumber,
          projectTitle: lifecycleProject.title, company: "OK solutions",
          offerNumber: `ANG-${Date.now().toString().slice(-7)}2`, status: "Erstellt",
          customerName: lifecycleProject.customer || "QA Kunde", plannedExecutionMonth: "2026-11",
          netTotal: 100, vatRate: 19, grossTotal: 119,
          pdfData: Buffer.from("QA lifecycle offer").toString("base64"),
        },
        select: { id: true, offerNumber: true, status: true, updatedAt: true },
      })
    : null;
  const lifecycleInvoice = lifecycleProject
    ? await prisma.invoice.create({
        data: {
          id: randomUUID(), organizationId: actor.organizationId,
          projectId: lifecycleProject.id, projectNumber: lifecycleProject.projectNumber,
          projectTitle: lifecycleProject.title, company: "OK solutions",
          invoiceNumber: `RE-${Date.now().toString().slice(-7)}3`, status: "Entwurf",
          customerName: lifecycleProject.customer || "QA Kunde", serviceDate: "2026-07-31",
          plannedExecutionMonth: "2026-07", netTotal: 100, vatRate: 19, grossTotal: 119,
          pdfData: Buffer.from("QA lifecycle invoice draft").toString("base64"),
        },
        select: { id: true, invoiceNumber: true, status: true, updatedAt: true },
      })
    : null;
  const lifecycleTask = await prisma.task.create({
    data: {
      id: randomUUID(),
      organizationId: actor.organizationId,
      title: `QA JARVIS Aufgaben-Lebenszyklus ${Date.now()}`,
      description: "Isolierte Vorschauprüfung des sicheren Aufgaben-Lebenszyklus.",
      status: "OFFEN",
      priority: "NORMAL",
      deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      customer: lifecycleProject?.customer || "QA Kunde",
      projectId: lifecycleProject?.id || null,
      ownerId: actor.id,
      createdById: actor.id,
    },
    select: { id: true, title: true, status: true, archiveReason: true, archivedAt: true, updatedAt: true },
  });
  const projectStatusProject = await prisma.workPilotProject.create({
    data: {
      id: randomUUID(),
      organizationId: actor.organizationId,
      projectNumber: `QAS-${Date.now().toString().slice(-9)}`,
      title: "QA JARVIS Projektstatus",
      customer: "QA Kunde",
      status: "Lead / Klärung",
      projectType: "Glasreinigung",
      projectKind: "Einmalprojekt",
      responsibleName: "QA Verantwortung",
      source: "qa-jarvis-live-corpus",
    },
    select: { id: true, projectNumber: true, status: true, updatedAt: true },
  });
  const contactDeletionContact = await prisma.contact.create({
    data: {
      id: randomUUID(),
      organizationId: actor.organizationId,
      customerNumber: `87${Date.now().toString().slice(-8)}`,
      type: "company",
      category: "Kunde",
      companyName: `QA JARVIS Löschvorschau ${Date.now()}`,
    },
    select: { id: true, customerNumber: true },
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
  let offerFinalizationDraftPrepared = false;
  let offerDeliveryDraftPrepared = false;
  let offerLifecycleDraftPrepared = false;
  let invoiceLifecycleDraftPrepared = false;
  let taskLifecycleDraftPrepared = false;
  let projectMasterDataDraftPrepared = false;
  let contactManagementDraftPrepared = false;
  let contactDeletionDraftPrepared = false;
  let projectStatusDraftPrepared = false;
  let projectLifecycleDraftPrepared = false;

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
        const isOfferFinalizationCase = item.question.includes("Finalisiere Angebot");
        const isOfferDeliveryCase = item.question.includes("Versende Angebot");
        const isOfferLifecycleCase = item.question.includes("Lösche Angebot");
        const isInvoiceLifecycleCase = item.question.includes("Lösche Rechnungsentwurf");
        const isTaskLifecycleCase = item.question.includes("QA JARVIS Aufgaben-Lebenszyklus");
        const isProjectStatusCase = item.question.includes("QA-100");
        const isProjectLifecycleCase = item.question.includes("QA-200");
        const isProjectMasterDataCase = item.question.includes("QAM-300");
        const isContactManagementCase = item.question.includes("QAC-400");
        const isContactDeletionCase = item.question.includes("QAD-500");
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
            : isOfferFinalizationCase && finalizableOffer
              ? `Finalisiere Angebot ${finalizableOffer.offerNumber} kontrolliert.`
            : isOfferDeliveryCase && deliverableOffer
              ? `Versende Angebot ${deliverableOffer.offerNumber} kontrolliert.`
            : isOfferLifecycleCase && lifecycleOffer
              ? `Lösche Angebot ${lifecycleOffer.offerNumber} kontrolliert. Grund: Irrtümlich doppelt angelegt.`
            : isInvoiceLifecycleCase && lifecycleInvoice
              ? `Lösche Rechnungsentwurf ${lifecycleInvoice.invoiceNumber} kontrolliert. Grund: Irrtümlich doppelt angelegt.`
            : isTaskLifecycleCase
              ? `Archiviere die Aufgabe „${lifecycleTask.title}“ kontrolliert. Grund: Irrtümlich doppelt angelegt.`
            : isProjectStatusCase
              ? `Setze Projekt ${projectStatusProject.projectNumber} auf Angebot. Grund: Der Angebotsprozess wurde fachlich eröffnet.`
            : isProjectLifecycleCase
              ? `Archiviere Projekt ${projectStatusProject.projectNumber}. Grund: Auftrag abgeschlossen und revisionssicher geprüft.`
            : isProjectMasterDataCase
              ? `Ändere Projekt ${projectStatusProject.projectNumber}: Titel: QA JARVIS Projektdaten geprüft; Laufzeit bis: 2026-11.`
            : isContactManagementCase
              ? `Lege einen neuen Firmenkontakt an: Firma: QA JARVIS Kontakt ${now.getTime()}; E-Mail: jarvis-kontakt-${now.getTime()}@example.test; Telefon: +49 511 123456.`
            : isContactDeletionCase
              ? `Lösche Kontakt ${contactDeletionContact.customerNumber} endgültig. Grund: Versehentliche Doppelanlage.`
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
        if (isProjectStatusCase) {
          if (payload.actionDraft?.actionId !== "project.status.change") {
            failures.push({
              id: item.id,
              status: response.status,
              error: "Die Projektstatusfrage hat keine kontrollierte project.status.change-Vorschau erzeugt.",
            });
          } else if (
            payload.actionDraft.state !== "awaiting_confirmation" ||
            payload.actionDraft.confirmation?.enabled !== true ||
            payload.actionDraft.blockingIssues?.length ||
            payload.actionDraft.targetStatus !== "Angebot"
          ) {
            failures.push({
              id: item.id,
              status: response.status,
              error: "Die Projektstatusfrage hat keine vollständig prüfbare, unblockierte Bestätigungsvorschau erzeugt.",
            });
          } else {
            projectStatusDraftPrepared = true;
          }
        }
        if (isProjectMasterDataCase) {
          if (payload.actionDraft?.actionId !== "project.manage") {
            failures.push({ id: item.id, status: response.status, error: "Die Projektdatenfrage hat keine kontrollierte project.manage-Vorschau erzeugt." });
          } else if (payload.actionDraft.state !== "awaiting_confirmation" || payload.actionDraft.confirmation?.enabled !== true || payload.actionDraft.blockingIssues?.length || payload.actionDraft.changes?.length !== 2) {
            failures.push({ id: item.id, status: response.status, error: "Die Projektdatenfrage hat keine vollständig prüfbare, unblockierte Änderungsvorschau erzeugt." });
          } else {
            projectMasterDataDraftPrepared = true;
          }
        }
        if (isContactManagementCase) {
          if (payload.actionDraft?.actionId !== "contact.manage") {
            failures.push({ id: item.id, status: response.status, error: "Die Kontaktfrage hat keine kontrollierte contact.manage-Vorschau erzeugt." });
          } else if (payload.actionDraft.state !== "awaiting_confirmation" || payload.actionDraft.confirmation?.enabled !== true || payload.actionDraft.blockingIssues?.length || payload.actionDraft.mode !== "create") {
            failures.push({ id: item.id, status: response.status, error: "Die Kontaktfrage hat keine vollständig prüfbare, unblockierte Anlagevorschau erzeugt." });
          } else {
            contactManagementDraftPrepared = true;
          }
        }
        if (isContactDeletionCase) {
          if (payload.actionDraft?.actionId !== "contact.delete") {
            failures.push({ id: item.id, status: response.status, error: "Die Kontaktlöschfrage hat keine kontrollierte contact.delete-Vorschau erzeugt." });
          } else if (payload.actionDraft.state !== "awaiting_confirmation" || payload.actionDraft.confirmation?.enabled !== true || payload.actionDraft.blockingIssues?.length || payload.actionDraft.contactId !== contactDeletionContact.id || payload.actionDraft.references?.some((reference) => reference.count !== 0)) {
            failures.push({ id: item.id, status: response.status, error: "Die Kontaktlöschfrage hat keine vollständig prüfbare, referenzfreie Bestätigungsvorschau erzeugt." });
          } else {
            contactDeletionDraftPrepared = true;
          }
        }
        if (isProjectLifecycleCase) {
          if (payload.actionDraft?.actionId !== "project.archive") {
            failures.push({ id: item.id, status: response.status, error: "Die Archivierungsfrage hat keine kontrollierte project.archive-Vorschau erzeugt." });
          } else if (payload.actionDraft.state !== "awaiting_confirmation" || payload.actionDraft.confirmation?.enabled !== true || payload.actionDraft.blockingIssues?.length || payload.actionDraft.lifecycleAction !== "archive") {
            failures.push({ id: item.id, status: response.status, error: "Die Archivierungsfrage hat keine vollständig prüfbare, unblockierte Bestätigungsvorschau erzeugt." });
          } else {
            projectLifecycleDraftPrepared = true;
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
        if (isOfferFinalizationCase && finalizableOffer) {
          if (payload.actionDraft?.actionId !== "offer.finalize") {
            failures.push({
              id: item.id,
              status: response.status,
              error: "Die Angebotsfrage hat keine kontrollierte offer.finalize-Vorschau erzeugt.",
            });
          } else if (
            payload.actionDraft.state !== "awaiting_confirmation" ||
            payload.actionDraft.confirmation?.enabled !== true ||
            payload.actionDraft.blockingIssues?.length
          ) {
            failures.push({
              id: item.id,
              status: response.status,
              error: "Die Angebotsfrage hat keine vollständig prüfbare, unblockierte Bestätigungsvorschau erzeugt.",
            });
          } else {
            offerFinalizationDraftPrepared = true;
          }
        }
        if (isOfferDeliveryCase && deliverableOffer) {
          if (payload.actionDraft?.actionId !== "offer.send") {
            failures.push({
              id: item.id,
              status: response.status,
              error: "Die Angebotsversandfrage hat keine kontrollierte offer.send-Vorschau erzeugt.",
            });
          } else {
            offerDeliveryDraftPrepared = true;
          }
        }
        if (isOfferLifecycleCase && lifecycleOffer) {
          if (payload.actionDraft?.actionId !== "offer.delete") {
            failures.push({
              id: item.id,
              status: response.status,
              error: "Die Angebotslöschfrage hat keine kontrollierte offer.delete-Vorschau erzeugt.",
            });
          } else if (
            payload.actionDraft.state !== "awaiting_confirmation" ||
            payload.actionDraft.confirmation?.enabled !== true ||
            payload.actionDraft.blockingIssues?.length
          ) {
            failures.push({
              id: item.id,
              status: response.status,
              error: "Die Angebotslöschfrage hat keine vollständig prüfbare, unblockierte Bestätigungsvorschau erzeugt.",
            });
          } else {
            offerLifecycleDraftPrepared = true;
          }
        }
        if (isInvoiceLifecycleCase && lifecycleInvoice) {
          if (payload.actionDraft?.actionId !== "invoice.delete") {
            failures.push({
              id: item.id,
              status: response.status,
              error: "Die Rechnungsentwurf-Löschfrage hat keine kontrollierte invoice.delete-Vorschau erzeugt.",
            });
          } else if (
            payload.actionDraft.state !== "awaiting_confirmation" ||
            payload.actionDraft.confirmation?.enabled !== true ||
            payload.actionDraft.blockingIssues?.length
          ) {
            failures.push({
              id: item.id,
              status: response.status,
              error: "Die Rechnungsentwurf-Löschfrage hat keine vollständig prüfbare, unblockierte Bestätigungsvorschau erzeugt.",
            });
          } else {
            invoiceLifecycleDraftPrepared = true;
          }
        }
        if (isTaskLifecycleCase) {
          if (payload.actionDraft?.actionId !== "task.delete") {
            failures.push({
              id: item.id,
              status: response.status,
              error: "Die Aufgabenfrage hat keine kontrollierte task.delete-Vorschau erzeugt.",
            });
          } else if (
            payload.actionDraft.state !== "awaiting_confirmation" ||
            payload.actionDraft.confirmation?.enabled !== true ||
            payload.actionDraft.blockingIssues?.length
          ) {
            failures.push({
              id: item.id,
              status: response.status,
              error: "Die Aufgabenfrage hat keine vollständig prüfbare, unblockierte Bestätigungsvorschau erzeugt.",
            });
          } else {
            taskLifecycleDraftPrepared = true;
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
    if (finalizableOffer) {
      const [currentOffer, finalizationHistoryCount] = await Promise.all([
        prisma.offer.findUnique({
          where: { id: finalizableOffer.id },
          select: { status: true, pdfData: true, updatedAt: true },
        }),
        prisma.offerHistory.count({
          where: {
            organizationId: actor.organizationId,
            offerId: finalizableOffer.id,
            eventType: "finalized",
            createdAt: { gte: now },
          },
        }),
      ]);
      if (
        !currentOffer ||
        currentOffer.status !== finalizableOffer.status ||
        currentOffer.pdfData !== finalizableOffer.pdfData ||
        currentOffer.updatedAt.toISOString() !== finalizableOffer.updatedAt.toISOString() ||
        finalizationHistoryCount !== 0
      ) {
        failures.push({
          id: "side-effect-offer-finalization",
          status: 0,
          error: "Die 110-Fragen-Prüfung hat unerwartet ein Angebot finalisiert oder ein PDF erzeugt.",
        });
      }
    }
    if (lifecycleInvoice) {
      const [currentInvoice, lifecycleHistoryCount] = await Promise.all([
        prisma.invoice.findUnique({ where: { id: lifecycleInvoice.id }, select: { status: true, updatedAt: true } }),
        prisma.invoiceHistory.count({
          where: { organizationId: actor.organizationId, invoiceId: lifecycleInvoice.id, eventType: { in: ["deleted", "restored"] }, createdAt: { gte: now } },
        }),
      ]);
      if (
        !currentInvoice ||
        currentInvoice.status !== lifecycleInvoice.status ||
        currentInvoice.updatedAt.toISOString() !== lifecycleInvoice.updatedAt.toISOString() ||
        lifecycleHistoryCount !== 0
      ) {
        failures.push({
          id: "side-effect-invoice-lifecycle",
          status: 0,
          error: "Die 110-Fragen-Prüfung hat unerwartet einen Rechnungsentwurf gelöscht oder wiederhergestellt.",
        });
      }
    }
    const currentTask = await prisma.task.findUnique({
      where: { id: lifecycleTask.id },
      select: { status: true, archiveReason: true, archivedAt: true, updatedAt: true },
    });
    if (
      !currentTask ||
      currentTask.status !== lifecycleTask.status ||
      currentTask.archiveReason !== lifecycleTask.archiveReason ||
      currentTask.archivedAt?.toISOString() !== lifecycleTask.archivedAt?.toISOString() ||
      currentTask.updatedAt.toISOString() !== lifecycleTask.updatedAt.toISOString()
    ) {
      failures.push({
        id: "side-effect-task-lifecycle",
        status: 0,
        error: "Die 110-Fragen-Prüfung hat unerwartet eine Aufgabe archiviert oder wiederhergestellt.",
      });
    }
    const [currentStatusProject, statusTimelineWrites, statusLogbookWrites, statusAuditWrites] = await Promise.all([
      prisma.workPilotProject.findUnique({
        where: { id: projectStatusProject.id },
        select: { status: true, updatedAt: true },
      }),
      prisma.statusTimelineEntry.count({
        where: { organizationId: actor.organizationId, entityType: "project", entityId: projectStatusProject.id, createdAt: { gte: now } },
      }),
      prisma.projectLogbookEntry.count({
        where: { organizationId: actor.organizationId, projectId: projectStatusProject.id, source: { in: ["project-master-data", "project-status", "project-archive", "project-restore"] }, createdAt: { gte: now } },
      }),
      prisma.auditLog.count({
        where: { organizationId: actor.organizationId, entityType: "project", entityId: projectStatusProject.id, action: { in: ["project.master-data.changed", "project.status.changed", "project.archived", "project.restored"] }, createdAt: { gte: now } },
      }),
    ]);
    if (
      !currentStatusProject ||
      currentStatusProject.status !== projectStatusProject.status ||
      currentStatusProject.updatedAt.toISOString() !== projectStatusProject.updatedAt.toISOString() ||
      statusTimelineWrites !== 0 || statusLogbookWrites !== 0 || statusAuditWrites !== 0
    ) {
      failures.push({
        id: "side-effect-project-status",
        status: 0,
        error: "Die 110-Fragen-Prüfung hat unerwartet Projektstatus, Timeline, Logbuch oder Audit verändert.",
      });
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
    if (qaFinalizableOfferId) {
      await prisma.offer.deleteMany({
        where: { id: qaFinalizableOfferId, organizationId: actor.organizationId },
      });
    }
    if (qaDeliverableOfferId) {
      await prisma.offer.deleteMany({
        where: { id: qaDeliverableOfferId, organizationId: actor.organizationId },
      });
    }
    if (lifecycleOffer) {
      await prisma.offer.deleteMany({ where: { id: lifecycleOffer.id, organizationId: actor.organizationId } });
    }
    if (lifecycleInvoice) {
      await prisma.invoice.deleteMany({ where: { id: lifecycleInvoice.id, organizationId: actor.organizationId } });
    }
    await prisma.task.deleteMany({ where: { id: lifecycleTask.id, organizationId: actor.organizationId } });
    await prisma.statusTimelineEntry.deleteMany({ where: { organizationId: actor.organizationId, entityType: "project", entityId: projectStatusProject.id } });
    await prisma.projectLogbookEntry.deleteMany({ where: { organizationId: actor.organizationId, projectId: projectStatusProject.id } });
    await prisma.auditLog.deleteMany({ where: { organizationId: actor.organizationId, entityType: "project", entityId: projectStatusProject.id } });
    await prisma.workPilotProject.deleteMany({ where: { id: projectStatusProject.id, organizationId: actor.organizationId } });
    await prisma.contactIntegrationEvent.deleteMany({ where: { contactId: contactDeletionContact.id } });
    await prisma.auditLog.deleteMany({ where: { entityType: "contact", entityId: contactDeletionContact.id } });
    await prisma.contact.deleteMany({ where: { id: contactDeletionContact.id, organizationId: actor.organizationId } });
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
    offerFinalizationDraftPrepared,
    offerDeliveryDraftPrepared,
    offerLifecycleDraftPrepared,
    invoiceLifecycleDraftPrepared,
    taskLifecycleDraftPrepared,
    projectMasterDataDraftPrepared,
    contactManagementDraftPrepared,
    contactDeletionDraftPrepared,
    projectStatusDraftPrepared,
    projectLifecycleDraftPrepared,
    qaFinalizableOfferRemaining: qaFinalizableOfferId
      ? await prisma.offer.count({ where: { id: qaFinalizableOfferId } })
      : 0,
    qaDeliverableOfferRemaining: qaDeliverableOfferId
      ? await prisma.offer.count({ where: { id: qaDeliverableOfferId } })
      : 0,
    qaLifecycleOfferRemaining: lifecycleOffer
      ? await prisma.offer.count({ where: { id: lifecycleOffer.id } })
      : 0,
    qaLifecycleInvoiceRemaining: lifecycleInvoice
      ? await prisma.invoice.count({ where: { id: lifecycleInvoice.id } })
      : 0,
    qaLifecycleTaskRemaining: await prisma.task.count({ where: { id: lifecycleTask.id } }),
    qaProjectStatusProjectRemaining: await prisma.workPilotProject.count({ where: { id: projectStatusProject.id } }),
    qaContactDeletionContactRemaining: await prisma.contact.count({ where: { id: contactDeletionContact.id } }),
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
