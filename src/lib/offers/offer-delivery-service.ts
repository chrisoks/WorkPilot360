import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getDocumentMailTemplates } from "@/lib/company-settings/mail-templates";
import { parseStoredMailAccount } from "@/lib/mail/microsoft";
import { POST as sendDocumentMailRequest } from "@/app/api/document-mail/route";
import { resolveStorageBackedBytes } from "@/lib/storage/document-file";

const emailSchema = z.string().trim().email().max(320);
const recipientListSchema = z.array(emailSchema).max(20);

export const offerDeliveryPayloadSchema = z
  .object({
    offerId: z.string().trim().min(1).max(120),
    to: recipientListSchema,
    cc: recipientListSchema.default([]),
    bcc: recipientListSchema.default([]),
    subject: z.string().trim().min(1).max(240),
    body: z.string().trim().min(1).max(12_000),
    includeAcceptanceLink: z.boolean().default(true),
  })
  .strict();

export type OfferDeliveryPayload = z.infer<typeof offerDeliveryPayloadSchema>;

export class OfferDeliveryServiceError extends Error {
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
    this.name = "OfferDeliveryServiceError";
  }
}

export type OfferDeliveryEvaluation = {
  offer: {
    id: string;
    offerNumber: string;
    status: string;
    projectId: string;
    projectNumber: string;
    projectTitle: string;
    customerName: string;
    company: string;
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
  payload: OfferDeliveryPayload;
  attachments: Array<{
    name: string;
    contentType: "application/pdf";
    size: number;
    sha256: string;
  }>;
  checks: Array<{
    key: string;
    label: string;
    status: "ok" | "warning" | "blocked";
    detail: string;
  }>;
  warnings: string[];
  blockingIssues: string[];
  fingerprint: string;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function parseRecipients(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : cleanText(value)
        .split(/[;,]/)
        .map((entry) => entry.trim());
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function applyNumber(template: string, offerNumber: string) {
  return template.replaceAll("{{number}}", offerNumber);
}

export function normalizeOfferDeliveryPayload(input: {
  offerId: string;
  to: unknown;
  cc?: unknown;
  bcc?: unknown;
  subject: unknown;
  body: unknown;
  includeAcceptanceLink?: unknown;
}) {
  const parsed = offerDeliveryPayloadSchema.safeParse({
    offerId: cleanText(input.offerId),
    to: parseRecipients(input.to),
    cc: parseRecipients(input.cc),
    bcc: parseRecipients(input.bcc),
    subject: cleanText(input.subject),
    body: cleanText(input.body),
    includeAcceptanceLink: input.includeAcceptanceLink !== false,
  });
  if (!parsed.success) {
    throw new OfferDeliveryServiceError(
      "invalid_input",
      parsed.error.issues[0]?.message ||
        "Empfänger, Betreff oder Nachricht sind ungültig."
    );
  }
  return parsed.data;
}

async function findOfferRecipient(input: {
  organizationId: string;
  projectId: string;
  customerName: string;
}) {
  const projects = await prisma.$queryRaw<
    Array<{
      contactId: string | null;
      contactPersonId: string | null;
      addressContactId: string | null;
    }>
  >`
    SELECT "contactId", "contactPersonId", "addressContactId"
    FROM "WorkPilotProject"
    WHERE id = ${input.projectId} AND "organizationId" = ${input.organizationId}
    LIMIT 1
  `;
  const project = projects[0];
  const directIds = [
    project?.contactId,
    project?.contactPersonId,
    project?.addressContactId,
  ].filter((value): value is string => Boolean(value));
  const contacts = await prisma.contact.findMany({
    where: {
      organizationId: input.organizationId,
      OR: [
        ...(directIds.length ? [{ id: { in: directIds } }] : []),
        ...(project?.contactId ? [{ parentCompanyId: project.contactId }] : []),
        ...(input.customerName
          ? [
              { companyName: input.customerName },
              {
                AND: [
                  { firstName: { not: null } },
                  { lastName: { not: null } },
                ],
              },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      parentCompanyId: true,
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
      invoiceEmail: true,
      isInvoiceRecipient: true,
      isMainContact: true,
    },
  });
  const relevant = contacts.filter((contact) => {
    if (directIds.includes(contact.id)) return true;
    if (project?.contactId && contact.parentCompanyId === project.contactId) return true;
    if (contact.companyName === input.customerName) return true;
    return `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() === input.customerName;
  });
  const selected =
    relevant.find((contact) => cleanText(contact.invoiceEmail)) ??
    relevant.find((contact) => contact.isInvoiceRecipient) ??
    relevant.find((contact) => contact.isMainContact) ??
    relevant[0];
  return cleanText(selected?.invoiceEmail) || cleanText(selected?.email);
}

export async function evaluateOfferDelivery(input: {
  organizationId: string;
  actorUserId: string;
  offerId: string;
  payload?: Partial<OfferDeliveryPayload>;
}): Promise<OfferDeliveryEvaluation> {
  const [offer, actor, templates] = await Promise.all([
    prisma.offer.findFirst({
      where: { id: input.offerId, organizationId: input.organizationId },
    }),
    prisma.user.findFirst({
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
    }),
    getDocumentMailTemplates(input.organizationId),
  ]);
  if (!offer) {
    throw new OfferDeliveryServiceError(
      "not_found",
      "Das Angebot wurde in der aktuellen Organisation nicht gefunden."
    );
  }
  if (!actor) {
    throw new OfferDeliveryServiceError(
      "not_found",
      "Der Absender wurde in der aktuellen Organisation nicht gefunden."
    );
  }
  const account = parseStoredMailAccount(actor.mailAccount);
  const recipient = await findOfferRecipient({
    organizationId: input.organizationId,
    projectId: offer.projectId,
    customerName: offer.customerName,
  });
  const defaults = {
    offerId: offer.id,
    to: recipient ? [recipient] : [],
    cc: [] as string[],
    bcc: parseRecipients(account.bcc),
    subject: applyNumber(templates.offer.subject, offer.offerNumber),
    body: applyNumber(templates.offer.body, offer.offerNumber),
    includeAcceptanceLink: true,
  };
  const payload = normalizeOfferDeliveryPayload({
    ...defaults,
    ...input.payload,
    offerId: offer.id,
  });
  let pdfBytes: Buffer | null = null;
  let pdfLoadFailed = false;
  if (offer.pdfData) {
    try {
      pdfBytes = await resolveStorageBackedBytes({
        organizationId: input.organizationId,
        payload: offer.pdfData,
        expectedOwnerType: "offer",
        expectedOwnerId: offer.id,
      });
      if (!pdfBytes) pdfLoadFailed = true;
    } catch (error) {
      pdfLoadFailed = true;
      console.error("Offer delivery PDF could not be loaded", error);
    }
  }
  const blockingIssues = [
    ...(offer.status !== "Erstellt"
      ? [`${offer.offerNumber} ist im Status ${offer.status} nicht versandbereit.`]
      : []),
    ...(!offer.pdfData ? ["Das finale Angebots-PDF fehlt."] : []),
    ...(pdfLoadFailed
      ? ["Das finale Angebots-PDF ist vorübergehend nicht verfügbar. Bitte den Versand später erneut versuchen."]
      : []),
    ...(payload.to.length === 0 ? ["Mindestens ein Empfänger fehlt."] : []),
    ...(account.status !== "connected"
      ? ["Das Microsoft-365-Konto des Absenders ist nicht verbunden."]
      : []),
  ];
  const warnings = payload.includeAcceptanceLink
    ? [
        "Der Versand erzeugt einen 30 Tage gültigen Link zur digitalen Angebotsannahme; ältere offene Links dieser Angebotsversion werden widerrufen.",
      ]
    : ["Der Versand enthält bewusst keinen Link zur digitalen Angebotsannahme."];
  const attachments = pdfBytes
    ? [
        {
          name: `${offer.offerNumber}.pdf`,
          contentType: "application/pdf" as const,
          size: pdfBytes.byteLength,
          sha256: createHash("sha256").update(pdfBytes).digest("hex"),
        },
      ]
    : [];
  const checks: OfferDeliveryEvaluation["checks"] = [
    {
      key: "offer",
      label: "Finales Angebot",
      status: offer.status === "Erstellt" && Boolean(pdfBytes) ? "ok" : "blocked",
      detail:
        offer.status === "Erstellt" && pdfBytes
          ? `${offer.offerNumber} ist finalisiert; das gespeicherte PDF wird angehängt.`
          : blockingIssues.slice(0, 2).join(" · "),
    },
    {
      key: "recipient",
      label: "Empfänger und Nachricht",
      status: payload.to.length ? "ok" : "blocked",
      detail: payload.to.length
        ? `${payload.to.join(", ")} · ${payload.subject}`
        : "Empfänger fehlt.",
    },
    {
      key: "mail-account",
      label: "Microsoft-365-Absender",
      status: account.status === "connected" ? "ok" : "blocked",
      detail:
        account.status === "connected"
          ? cleanText(account.email) || actor.email
          : "Konto nicht verbunden.",
    },
    {
      key: "side-effects",
      label: "Getrennte Folgeschritte",
      status: "warning",
      detail:
        "Versand und Angebotshistorie werden protokolliert. Gewonnen/Verloren, Aufgaben und Projektstatus bleiben unverändert.",
    },
  ];
  const canonicalBlockingIssues = [...new Set(blockingIssues)];
  const senderName = `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim() || actor.email;
  const fingerprint = stableHash({
    offer: {
      id: offer.id,
      status: offer.status,
      updatedAt: offer.updatedAt.toISOString(),
      pdfSha256: attachments[0]?.sha256 ?? "",
      netTotal: offer.netTotal,
      grossTotal: offer.grossTotal,
    },
    sender: {
      id: actor.id,
      email: cleanText(account.email) || actor.email,
      connected: account.status === "connected",
    },
    payload,
    checks,
    warnings,
    blockingIssues: canonicalBlockingIssues,
  });
  return {
    offer: {
      id: offer.id,
      offerNumber: offer.offerNumber,
      status: offer.status,
      projectId: offer.projectId,
      projectNumber: offer.projectNumber,
      projectTitle: offer.projectTitle,
      customerName: offer.customerName,
      company: offer.company,
      netTotal: offer.netTotal,
      grossTotal: offer.grossTotal,
      updatedAt: offer.updatedAt.toISOString(),
    },
    sender: {
      userId: actor.id,
      name: senderName,
      email: cleanText(account.email) || actor.email,
      connected: account.status === "connected",
    },
    payload,
    attachments,
    checks,
    warnings,
    blockingIssues: canonicalBlockingIssues,
    fingerprint,
  };
}

export function getOfferDeliveryConfirmationText(
  offerNumber: string,
  recipient: string
) {
  return `SENDEN ${offerNumber.trim()} AN ${recipient.trim()}`;
}

export function matchesOfferDeliveryConfirmation(
  offerNumber: string,
  recipient: string,
  confirmationText: string
) {
  return (
    confirmationText.trim() ===
    getOfferDeliveryConfirmationText(offerNumber, recipient)
  );
}

export async function sendOfferDelivery(input: {
  organizationId: string;
  actorUserId: string;
  dispatchId: string;
  offerId: string;
  payload: OfferDeliveryPayload;
  expectedFingerprint: string;
  request: Request;
}) {
  const evaluation = await evaluateOfferDelivery({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    offerId: input.offerId,
    payload: input.payload,
  });
  if (evaluation.fingerprint !== input.expectedFingerprint) {
    throw new OfferDeliveryServiceError(
      "stale_context",
      "Angebot, PDF, Empfänger, Nachricht oder Versandkonto haben sich geändert. Bitte öffne eine neue Vorschau."
    );
  }
  if (evaluation.blockingIssues.length) {
    throw new OfferDeliveryServiceError(
      "blocked",
      evaluation.blockingIssues.join(" · ")
    );
  }
  const requestUrl = new URL("/api/document-mail", input.request.url);
  const response = await sendDocumentMailRequest(
    new Request(requestUrl, {
      method: "POST",
      headers: input.request.headers,
      body: JSON.stringify({
        actorId: input.actorUserId,
        dispatchKey: input.dispatchId,
        kind: "offer",
        documentId: evaluation.offer.id,
        documentNumber: evaluation.offer.offerNumber,
        projectId: evaluation.offer.projectId,
        projectNumber: evaluation.offer.projectNumber,
        projectTitle: evaluation.offer.projectTitle,
        customerName: evaluation.offer.customerName,
        to: input.payload.to.join(", "),
        cc: input.payload.cc.join(", "),
        bcc: input.payload.bcc.join(", "),
        subject: input.payload.subject,
        body: input.payload.body,
        attachPdf: true,
        includeAcceptanceLink: input.payload.includeAcceptanceLink,
      }),
    })
  );
  const result = (await response.json().catch(() => null)) as
    | { id?: string; status?: string; error?: string; code?: string }
    | null;
  if (!response.ok || result?.status !== "sent" || result.id !== input.dispatchId) {
    const recorded = await prisma.documentMailDispatch.findFirst({
      where: {
        id: input.dispatchId,
        organizationId: input.organizationId,
        documentKind: "offer",
        documentId: input.offerId,
      },
      select: { status: true },
    });
    const uncertain =
      recorded?.status === "sending" ||
      recorded?.status === "sent" ||
      result?.code === "delivery_uncertain" ||
      response.status === 409;
    throw new OfferDeliveryServiceError(
      uncertain ? "delivery_uncertain" : "delivery_failed",
      result?.error ||
        (uncertain
          ? "Der Angebotsversand wurde bereits gestartet oder sein Zustand ist unklar. Nicht erneut senden."
          : "Microsoft 365 konnte das Angebot nicht senden.")
    );
  }
  const dispatch = await prisma.documentMailDispatch.findFirst({
    where: {
      id: input.dispatchId,
      organizationId: input.organizationId,
      documentKind: "offer",
      documentId: input.offerId,
      status: "sent",
    },
  });
  if (!dispatch) {
    throw new OfferDeliveryServiceError(
      "delivery_uncertain",
      "Microsoft 365 hat den Versand angenommen, aber das Versandprotokoll ist nicht eindeutig. Nicht erneut senden."
    );
  }
  return { dispatch, evaluation, replay: Boolean((result as { replayed?: boolean })?.replayed) };
}
