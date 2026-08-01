import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import {
  generateXRechnungXml,
  type XRechnungInvoice,
  type XRechnungLine,
  type XRechnungSeller,
} from "@/lib/e-invoice/xrechnung";
import {
  validateXRechnungPayload,
  type XRechnungValidationIssue,
} from "@/lib/e-invoice/xrechnung-validation";
import {
  validateXRechnungWithKosit,
  type KositValidationResult,
} from "@/lib/e-invoice/kosit-validator";
import { buildValidatedZugferdPdf } from "@/lib/e-invoice/zugferd-pdf";
import {
  parseStoredMailAccount,
  refreshMicrosoftAccessToken,
  sendMicrosoftGraphMail,
  type MicrosoftGraphMailAttachment,
} from "@/lib/mail/microsoft";
import { resolveStorageBackedBytes } from "@/lib/storage/document-file";

type InvoiceDeliveryDb = Prisma.TransactionClient | typeof prisma;

export const invoiceDeliveryFormatSchema = z.enum([
  "pdf",
  "xrechnung",
  "pdf-xrechnung",
  "zugferd",
]);
export type InvoiceDeliveryFormat = z.infer<
  typeof invoiceDeliveryFormatSchema
>;

const emailSchema = z.string().trim().email().max(320);
const recipientListSchema = z.array(emailSchema).max(20);

export const invoiceDeliveryPayloadSchema = z
  .object({
    invoiceId: z.string().trim().min(1).max(120),
    to: recipientListSchema,
    cc: z.array(emailSchema).max(20).default([]),
    bcc: z.array(emailSchema).max(20).default([]),
    subject: z.string().trim().min(1).max(240),
    body: z.string().trim().min(1).max(12_000),
    format: invoiceDeliveryFormatSchema,
  })
  .strict();

export type InvoiceDeliveryPayload = z.infer<
  typeof invoiceDeliveryPayloadSchema
>;

export class InvoiceDeliveryServiceError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "invalid_input"
      | "invalid_state"
      | "blocked"
      | "stale_context"
      | "conflict"
      | "mail_unavailable"
      | "delivery_failed"
      | "delivery_uncertain",
    message: string
  ) {
    super(message);
    this.name = "InvoiceDeliveryServiceError";
  }
}

export type InvoiceDeliveryEvaluation = {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    projectId: string;
    projectNumber: string;
    projectTitle: string;
    customerName: string;
    company: string;
    serviceDate: string;
    dueDate: string;
    netTotal: number;
    grossTotal: number;
    updatedAt: string;
  };
  sender: {
    userId: string;
    name: string;
    email: string;
    connected: boolean;
  };
  payload: InvoiceDeliveryPayload;
  attachments: Array<{
    name: string;
    contentType: string;
    size: number;
    sha256: string;
  }>;
  validation: {
    technical:
      | {
          valid: boolean;
          issues: XRechnungValidationIssue[];
        }
      | null;
    kosit: KositValidationResult | null;
    zugferd:
      | {
          converted: boolean;
          conversionMessage: string;
          validated: boolean;
          validationMessage: string;
        }
      | null;
  };
  warnings: string[];
  blockingIssues: string[];
  fingerprint: string;
};

type InvoiceDeliveryPackage = {
  evaluation: InvoiceDeliveryEvaluation;
  attachments: MicrosoftGraphMailAttachment[];
};

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function hashBytes(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function cleanDateKey(value: unknown) {
  const normalized = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function addDaysToDateKey(dateKey: string, days: number) {
  const cleanDate = cleanDateKey(dateKey);
  if (!cleanDate) return "";
  const [year, month, day] = cleanDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + Math.min(Math.max(days, 0), 365));
  return date.toISOString().slice(0, 10);
}

function cleanInvoiceLineTitle(value: unknown) {
  return cleanText(value).replace(
    /\s*\(\s*\d+(?:[,.]\d+)?\s*€\s*\/\s*Std\.\s*\)\s*$/i,
    ""
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textToHtml(value: string) {
  return escapeHtml(value.trimEnd())
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\r?\n/g, "<br>"))
    .map((paragraph) => `<p>${paragraph || "&nbsp;"}</p>`)
    .join("");
}

function getSellerProfile(_company: string): XRechnungSeller {
  return {
    name: "OK solutions GmbH",
    street: "Im Krötenteich 3/4",
    postalCode: "74722",
    city: "Buchen",
    country: "DE",
    endpoint: "rechnung@ok-solutions.com",
    vatId: "DE367346374",
    iban: "DE85674500480004369971",
    bic: "SOLADES1MOS",
    bankName: "Sparkasse Neckartal-Odenwald",
    contactName: "OK solutions GmbH",
    contactPhone: "+49 6281 5649990",
    contactEmail: "rechnung@ok-solutions.com",
  };
}

function parseRecipients(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : cleanText(value)
        .split(/[;,]/)
        .map((entry) => entry.trim());
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

export function normalizeInvoiceDeliveryPayload(input: {
  invoiceId: string;
  to: unknown;
  cc?: unknown;
  bcc?: unknown;
  subject: unknown;
  body: unknown;
  format?: unknown;
}) {
  const parsed = invoiceDeliveryPayloadSchema.safeParse({
    invoiceId: cleanText(input.invoiceId),
    to: parseRecipients(input.to),
    cc: parseRecipients(input.cc),
    bcc: parseRecipients(input.bcc),
    subject: cleanText(input.subject),
    body: cleanText(input.body),
    format: invoiceDeliveryFormatSchema.safeParse(input.format).success
      ? input.format
      : "pdf",
  });
  if (!parsed.success) {
    throw new InvoiceDeliveryServiceError(
      "invalid_input",
      "Empfänger, Betreff, Nachricht oder Rechnungsformat sind ungültig."
    );
  }
  return parsed.data;
}

async function getBuyerReference(
  db: InvoiceDeliveryDb,
  organizationId: string,
  project: {
    id: string;
    projectNumber: string;
    contactId: string | null;
    contactPersonId: string | null;
    addressContactId: string | null;
  }
) {
  const contactIds = [
    project.contactId,
    project.contactPersonId,
    project.addressContactId,
  ].filter((value): value is string => Boolean(value));
  if (!contactIds.length) return project.projectNumber;
  const contacts = await db.contact.findMany({
    where: {
      organizationId,
      OR: [
        { id: { in: contactIds } },
        { parentCompanyId: { in: contactIds } },
      ],
    },
    orderBy: [{ isInvoiceRecipient: "desc" }, { isMainContact: "desc" }],
    select: { leitwegId: true },
  });
  return (
    contacts.map((contact) => cleanText(contact.leitwegId)).find(Boolean) ||
    project.projectNumber
  );
}

async function getSuggestedRecipient(
  db: InvoiceDeliveryDb,
  organizationId: string,
  project: {
    contactId: string | null;
    contactPersonId: string | null;
    addressContactId: string | null;
  }
) {
  const contactIds = [
    project.contactId,
    project.contactPersonId,
    project.addressContactId,
  ].filter((value): value is string => Boolean(value));
  if (!contactIds.length) return "";
  const contacts = await db.contact.findMany({
    where: {
      organizationId,
      OR: [
        { id: { in: contactIds } },
        { parentCompanyId: { in: contactIds } },
      ],
    },
    orderBy: [{ isInvoiceRecipient: "desc" }, { isMainContact: "desc" }],
    select: { invoiceEmail: true, email: true },
  });
  return (
    contacts
      .flatMap((contact) => [contact.invoiceEmail, contact.email])
      .map(cleanText)
      .find((email) => emailSchema.safeParse(email).success) || ""
  );
}

function toMailAttachment(
  name: string,
  contentType: string,
  bytes: Buffer
): MicrosoftGraphMailAttachment {
  return {
    "@odata.type": "#microsoft.graph.fileAttachment",
    name,
    contentType,
    contentBytes: bytes.toString("base64"),
  };
}

function attachmentMetadata(attachment: MicrosoftGraphMailAttachment) {
  const bytes = Buffer.from(attachment.contentBytes, "base64");
  return {
    name: attachment.name,
    contentType: attachment.contentType,
    size: bytes.length,
    sha256: hashBytes(bytes),
  };
}

async function buildInvoiceDeliveryPackage(input: {
  organizationId: string;
  actorUserId: string;
  invoiceId: string;
  payload?: Partial<InvoiceDeliveryPayload>;
  db?: InvoiceDeliveryDb;
}): Promise<InvoiceDeliveryPackage> {
  const db = input.db ?? prisma;
  const invoice = await db.invoice.findFirst({
    where: {
      id: input.invoiceId,
      organizationId: input.organizationId,
    },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (!invoice) {
    throw new InvoiceDeliveryServiceError(
      "not_found",
      "Die Rechnung wurde in der aktuellen Organisation nicht gefunden."
    );
  }
  if (
    !(
      invoice.status === "Fakturiert" ||
      invoice.status === "Bezahlt" ||
      invoice.isPaid
    )
  ) {
    throw new InvoiceDeliveryServiceError(
      "invalid_state",
      invoice.status === "Entwurf"
        ? "Die Rechnung muss vor dem Versand kontrolliert fakturiert werden."
        : `Die Rechnung kann im Status ${invoice.status} nicht versendet werden.`
    );
  }
  const project = await db.workPilotProject.findFirst({
    where: {
      id: invoice.projectId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      projectNumber: true,
      contactId: true,
      contactPersonId: true,
      addressContactId: true,
    },
  });
  if (!project) {
    throw new InvoiceDeliveryServiceError(
      "blocked",
      "Das Rechnungsprojekt wurde in der aktuellen Organisation nicht gefunden."
    );
  }
  const actor = await db.user.findFirst({
    where: {
      id: input.actorUserId,
      organizationId: input.organizationId,
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      mailAccount: true,
    },
  });
  if (!actor) {
    throw new InvoiceDeliveryServiceError(
      "blocked",
      "Der wirksame Absender ist nicht mehr aktiv."
    );
  }
  const mailAccount = parseStoredMailAccount(actor.mailAccount);
  const suggestedRecipient = await getSuggestedRecipient(
    db,
    input.organizationId,
    project
  );
  const defaultBody = [
    "Guten Tag,",
    `anbei erhalten Sie unsere Rechnung ${invoice.invoiceNumber}.`,
    "Mit freundlichen Grüßen",
  ].join("\n\n");
  const payload = normalizeInvoiceDeliveryPayload({
    invoiceId: invoice.id,
    to: input.payload?.to ?? (suggestedRecipient ? [suggestedRecipient] : []),
    cc: input.payload?.cc ?? [],
    bcc: input.payload?.bcc ?? [],
    subject:
      input.payload?.subject ?? `Rechnung ${invoice.invoiceNumber}`,
    body: input.payload?.body ?? defaultBody,
    format: input.payload?.format ?? "pdf",
  });
  const warnings: string[] = [];
  const blockingIssues: string[] = [];
  const attachments: MicrosoftGraphMailAttachment[] = [];
  let technical:
    | {
        valid: boolean;
        issues: XRechnungValidationIssue[];
      }
    | null = null;
  let kosit: KositValidationResult | null = null;
  let zugferd: InvoiceDeliveryEvaluation["validation"]["zugferd"] = null;
  let invoicePdfBytes: Buffer | null = null;
  if (invoice.pdfData) {
    try {
      invoicePdfBytes = await resolveStorageBackedBytes({
        organizationId: input.organizationId,
        payload: invoice.pdfData,
        expectedOwnerType: "invoice",
        expectedOwnerId: invoice.id,
      });
      if (!invoicePdfBytes) {
        blockingIssues.push("Das freigegebene Rechnungs-PDF ist vorübergehend nicht verfügbar.");
      }
    } catch (error) {
      console.error("Invoice delivery PDF could not be loaded", error);
      blockingIssues.push(
        "Das freigegebene Rechnungs-PDF ist vorübergehend nicht verfügbar. Bitte den Versand später erneut versuchen."
      );
    }
  }

  if (!payload.to.length) {
    blockingIssues.push("Mindestens eine gültige Empfängeradresse fehlt.");
  }
  if (mailAccount.status !== "connected") {
    blockingIssues.push(
      "Für den wirksamen Absender ist kein verbundenes Microsoft-365-Konto verfügbar."
    );
  }

  const needsPdf =
    payload.format === "pdf" ||
    payload.format === "pdf-xrechnung" ||
    payload.format === "zugferd";
  if (needsPdf) {
    if (!invoice.pdfData) {
      blockingIssues.push("Das freigegebene Rechnungs-PDF fehlt.");
    } else if (invoicePdfBytes && payload.format !== "zugferd") {
      attachments.push(
        toMailAttachment(
          `${invoice.invoiceNumber}.pdf`,
          "application/pdf",
          invoicePdfBytes
        )
      );
    }
  }

  let xml = "";
  if (
    payload.format === "xrechnung" ||
    payload.format === "pdf-xrechnung" ||
    payload.format === "zugferd"
  ) {
    const paymentTermDays = Math.min(
      Math.max(Number(invoice.paymentTermDays) || 0, 0),
      365
    );
    const serviceDate = cleanDateKey(invoice.serviceDate);
    const dueDate =
      cleanDateKey(invoice.dueDate) ||
      addDaysToDateKey(serviceDate, paymentTermDays);
    const xrechnungInvoice: XRechnungInvoice = {
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.createdAt.toISOString().slice(0, 10),
      serviceDate,
      dueDate,
      seller: getSellerProfile(invoice.company),
      customerName: invoice.customerName,
      customerStreet: invoice.customerStreet,
      customerCity: invoice.customerCity,
      contactName: invoice.contactName,
      netTotal: invoice.netTotal,
      vatRate: invoice.vatRate,
      grossTotal: invoice.grossTotal,
      paymentTermDays,
      buyerReference: await getBuyerReference(
        db,
        input.organizationId,
        project
      ),
    };
    const xrechnungLines: XRechnungLine[] = invoice.lines.map(
      (line, index) => ({
        position: line.position || index + 1,
        quantity: line.quantity,
        unit: line.unit || "Stk",
        title: cleanInvoiceLineTitle(line.title) || "Position",
        description: line.description || "",
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
        vatRate: line.vatRate,
        totalNet: line.totalNet,
      })
    );
    const validation = validateXRechnungPayload(
      xrechnungInvoice,
      xrechnungLines
    );
    technical = { valid: validation.valid, issues: validation.issues };
    if (!validation.valid) {
      blockingIssues.push(
        ...validation.issues
          .filter((issue) => issue.severity === "error")
          .map((issue) => issue.message)
      );
    } else {
      xml = generateXRechnungXml(xrechnungInvoice, xrechnungLines);
      kosit = await validateXRechnungWithKosit(xml);
      if (kosit.available && !kosit.valid) {
        blockingIssues.push(kosit.message);
      } else if (!kosit.available) {
        warnings.push(
          "Der KoSIT-Validator ist nicht konfiguriert; die technische Mindestprüfung ist bestanden."
        );
      }
    }
  }

  if (
    xml &&
    (payload.format === "xrechnung" ||
      payload.format === "pdf-xrechnung")
  ) {
    attachments.push(
      toMailAttachment(
        `${invoice.invoiceNumber}-xrechnung.xml`,
        "application/xml",
        Buffer.from(xml, "utf8")
      )
    );
  }

  if (payload.format === "zugferd" && xml && invoicePdfBytes) {
    const result = await buildValidatedZugferdPdf({
      invoicePdfBytes,
      xrechnungXml: Buffer.from(xml, "utf8"),
    });
    zugferd = {
      converted: result.conversion.converted,
      conversionMessage: result.conversion.message,
      validated: Boolean(result.validation?.valid),
      validationMessage:
        result.validation?.message || "PDF/A-3-Validierung nicht verfügbar.",
    };
    if (!result.conversion.available || !result.conversion.converted) {
      blockingIssues.push(result.conversion.message);
    } else if (!result.validation?.available || !result.validation.valid) {
      blockingIssues.push(
        result.validation?.message ||
          "ZUGFeRD/PDF-A-3 konnte nicht validiert werden."
      );
    } else if (result.pdfBytes) {
      attachments.push(
        toMailAttachment(
          `${invoice.invoiceNumber}-zugferd.pdf`,
          "application/pdf",
          result.pdfBytes
        )
      );
    }
  }

  const attachmentViews = attachments.map(attachmentMetadata);
  if (!attachmentViews.length && blockingIssues.length === 0) {
    blockingIssues.push("Das gewählte Rechnungsformat erzeugt keinen Anhang.");
  }
  const canonicalWarnings = [...new Set(warnings)];
  const canonicalBlockingIssues = [...new Set(blockingIssues)];
  const senderName =
    [actor.firstName, actor.lastName].filter(Boolean).join(" ") ||
    actor.email;
  const fingerprint = stableHash({
    invoice: {
      id: invoice.id,
      status: invoice.status,
      updatedAt: invoice.updatedAt.toISOString(),
      pdfSha256: invoicePdfBytes ? hashBytes(invoicePdfBytes) : "",
      lines: invoice.lines.map((line) => ({
        id: line.id,
        updatedAt: line.updatedAt.toISOString(),
        totalNet: line.totalNet,
      })),
    },
    sender: {
      id: actor.id,
      email: cleanText(mailAccount.email) || actor.email,
      status: mailAccount.status,
    },
    payload,
    attachments: attachmentViews,
    validation: { technical, kosit, zugferd },
    warnings: canonicalWarnings,
    blockingIssues: canonicalBlockingIssues,
  });

  return {
    evaluation: {
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        projectId: invoice.projectId,
        projectNumber: invoice.projectNumber,
        projectTitle: invoice.projectTitle,
        customerName: invoice.customerName,
        company: invoice.company,
        serviceDate: invoice.serviceDate,
        dueDate: invoice.dueDate,
        netTotal: invoice.netTotal,
        grossTotal: invoice.grossTotal,
        updatedAt: invoice.updatedAt.toISOString(),
      },
      sender: {
        userId: actor.id,
        name: senderName,
        email: cleanText(mailAccount.email) || actor.email,
        connected: mailAccount.status === "connected",
      },
      payload,
      attachments: attachmentViews,
      validation: { technical, kosit, zugferd },
      warnings: canonicalWarnings,
      blockingIssues: canonicalBlockingIssues,
      fingerprint,
    },
    attachments,
  };
}

export async function evaluateInvoiceDelivery(input: {
  organizationId: string;
  actorUserId: string;
  invoiceId: string;
  payload?: Partial<InvoiceDeliveryPayload>;
  db?: InvoiceDeliveryDb;
}) {
  return (await buildInvoiceDeliveryPackage(input)).evaluation;
}

export function getInvoiceDeliveryConfirmationText(
  invoiceNumber: string,
  recipient: string
) {
  return `SENDEN ${invoiceNumber.trim()} AN ${recipient.trim()}`;
}

export function matchesInvoiceDeliveryConfirmation(
  invoiceNumber: string,
  recipient: string,
  confirmationText: string
) {
  return (
    confirmationText.trim() ===
    getInvoiceDeliveryConfirmationText(invoiceNumber, recipient)
  );
}

export type DocumentMailDispatchClaimInput = {
  id: string;
  organizationId: string;
  documentKind: string;
  documentId: string;
  documentNumber: string;
  projectId: string;
  projectNumber: string;
  projectTitle: string;
  customerName: string;
  senderUserId: string;
  senderName: string;
  senderEmail: string;
  toRecipients: string;
  ccRecipients: string;
  bccRecipients: string;
  subject: string;
  body: string;
  attachPdf: boolean;
};

export async function claimDocumentMailDispatch(
  input: DocumentMailDispatchClaimInput
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${`workpilot:document-mail:${input.id}`})
        )
      `;
      const existing = await tx.documentMailDispatch.findUnique({
        where: { id: input.id },
      });
      if (existing) {
        const sameRequest =
          existing.organizationId === input.organizationId &&
          existing.documentKind === input.documentKind &&
          existing.documentId === input.documentId &&
          existing.senderUserId === input.senderUserId;
        if (!sameRequest) {
          throw new InvoiceDeliveryServiceError(
            "conflict",
            "Der Versandauftrag kollidiert mit einem anderen Vorgang."
          );
        }
        if (existing.status === "sent") {
          return { replay: true as const, dispatch: existing };
        }
        throw new InvoiceDeliveryServiceError(
          existing.status === "sending"
            ? "delivery_uncertain"
            : "conflict",
          existing.status === "sending"
            ? "Für diesen Versand existiert bereits ein laufender oder technisch unklarer Zustellversuch. Er wird nicht automatisch wiederholt."
            : "Dieser Versandversuch ist bereits fehlgeschlagen. Bitte erstelle nach Prüfung einen neuen Versandauftrag."
        );
      }
      const dispatch = await tx.documentMailDispatch.create({
        data: {
          ...input,
          provider: "microsoft365",
          status: "sending",
          providerMessageId: "",
          errorMessage: "",
        },
      });
      return { replay: false as const, dispatch };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function sendInvoiceDelivery(input: {
  organizationId: string;
  actorUserId: string;
  actorName: string;
  dispatchId: string;
  invoiceId: string;
  payload: InvoiceDeliveryPayload;
  expectedFingerprint: string;
  request?: Request;
  source: "ui" | "jarvis";
}) {
  const packageResult = await buildInvoiceDeliveryPackage({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    invoiceId: input.invoiceId,
    payload: input.payload,
  });
  const evaluation = packageResult.evaluation;
  if (evaluation.fingerprint !== input.expectedFingerprint) {
    throw new InvoiceDeliveryServiceError(
      "stale_context",
      "Rechnung, Dokumentpaket, Empfänger oder Versandkonto haben sich geändert. Bitte öffne eine neue Vorschau."
    );
  }
  if (evaluation.blockingIssues.length) {
    throw new InvoiceDeliveryServiceError(
      "blocked",
      evaluation.blockingIssues.join(" · ")
    );
  }
  const account = await refreshMicrosoftAccessToken(
    input.actorUserId,
    await (async () => {
      const actor = await prisma.user.findFirst({
        where: {
          id: input.actorUserId,
          organizationId: input.organizationId,
          isActive: true,
        },
        select: { mailAccount: true },
      });
      return parseStoredMailAccount(actor?.mailAccount);
    })(),
    input.request
  );
  if (account.status !== "connected" || !account.accessToken) {
    throw new InvoiceDeliveryServiceError(
      "mail_unavailable",
      "Das Microsoft-365-Konto ist nicht verbunden oder die Anmeldung ist abgelaufen."
    );
  }

  const claimed = await claimDocumentMailDispatch({
    id: input.dispatchId,
    organizationId: input.organizationId,
    documentKind: "invoice",
    documentId: evaluation.invoice.id,
    documentNumber: evaluation.invoice.invoiceNumber,
    projectId: evaluation.invoice.projectId,
    projectNumber: evaluation.invoice.projectNumber,
    projectTitle: evaluation.invoice.projectTitle,
    customerName: evaluation.invoice.customerName,
    senderUserId: input.actorUserId,
    senderName: input.actorName,
    senderEmail: evaluation.sender.email,
    toRecipients: input.payload.to.join(", "),
    ccRecipients: input.payload.cc.join(", "),
    bccRecipients: input.payload.bcc.join(", "),
    subject: input.payload.subject,
    body: input.payload.body,
    attachPdf: input.payload.format !== "xrechnung",
  });
  if (claimed.replay) {
    return { dispatch: claimed.dispatch, evaluation, replay: true };
  }

  let delivered = false;
  try {
    await sendMicrosoftGraphMail({
      accessToken: account.accessToken,
      to: input.payload.to,
      cc: input.payload.cc,
      bcc: input.payload.bcc,
      subject: input.payload.subject,
      htmlBody: textToHtml(input.payload.body),
      attachments: packageResult.attachments,
    });
    delivered = true;
    const dispatch = await prisma.$transaction(async (tx) => {
      const updated = await tx.documentMailDispatch.updateMany({
        where: {
          id: input.dispatchId,
          organizationId: input.organizationId,
          status: "sending",
        },
        data: {
          status: "sent",
          providerMessageId: `ms365-${input.dispatchId}`,
          errorMessage: "",
        },
      });
      if (updated.count !== 1) {
        throw new InvoiceDeliveryServiceError(
          "delivery_uncertain",
          "Microsoft 365 hat den Versand angenommen, aber die lokale Zustellbestätigung konnte nicht eindeutig gespeichert werden."
        );
      }
      await tx.invoiceHistory.create({
        data: {
          organizationId: input.organizationId,
          invoiceId: evaluation.invoice.id,
          projectId: evaluation.invoice.projectId,
          invoiceNumber: evaluation.invoice.invoiceNumber,
          eventType: "email_sent",
          title: "Rechnung per E-Mail versendet",
          note: `${evaluation.invoice.invoiceNumber} wurde${
            input.source === "jarvis" ? " durch JARVIS" : ""
          } als ${input.payload.format} an ${input.payload.to.join(
            ", "
          )} versendet. Betreff: ${input.payload.subject}`,
          actorName: input.actorName,
        },
      });
      return tx.documentMailDispatch.findUniqueOrThrow({
        where: { id: input.dispatchId },
      });
    });
    return { dispatch, evaluation, replay: false };
  } catch (error) {
    if (!delivered) {
      await prisma.documentMailDispatch
        .updateMany({
          where: {
            id: input.dispatchId,
            organizationId: input.organizationId,
            status: "sending",
          },
          data: {
            status: "failed",
            errorMessage:
              error instanceof Error
                ? error.message.slice(0, 2000)
                : "Microsoft-365-Versand fehlgeschlagen.",
          },
        })
        .catch(() => undefined);
      throw new InvoiceDeliveryServiceError(
        "delivery_failed",
        error instanceof Error
          ? error.message
          : "Microsoft-365-Versand fehlgeschlagen."
      );
    }
    if (error instanceof InvoiceDeliveryServiceError) throw error;
    throw new InvoiceDeliveryServiceError(
      "delivery_uncertain",
      "Microsoft 365 hat den Versand angenommen, aber die lokale Zustellbestätigung ist technisch unklar. Nicht automatisch erneut senden."
    );
  }
}
