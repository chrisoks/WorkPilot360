import { z } from "zod";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import {
  authorizeJarvisQuestion,
  classifyJarvisQuestion,
  JarvisAccessProfile,
} from "@/lib/jarvis/security";

export const JARVIS_PREVIEW_ACTION_IDS = [
  "task.prepare",
  "task.delete",
  "project.status.change",
  "project.archive",
  "planning.prepare",
  "time.prepare",
  "project-logbook.prepare",
  "task-comment.prepare",
  "offer.prepare",
  "offer.finalize",
  "offer.send",
  "offer.manage",
  "offer.delete",
  "invoice.prepare",
  "invoice.finalize",
  "invoice.mark-paid",
  "invoice.remind",
  "invoice.cancel",
  "invoice.credit",
  "invoice.delete",
  "document.send",
] as const;

export type JarvisPreviewActionId = (typeof JARVIS_PREVIEW_ACTION_IDS)[number];
export type JarvisActionPreviewState =
  | "awaiting_confirmation"
  | "confirmed"
  | "cancelled";
export type JarvisActionPreviewAuditEventType =
  | "preview_created"
  | "preview_confirmed"
  | "preview_cancelled";
export const JARVIS_PREVIEW_CANCELLATION_REASONS = [
  "user_cancelled",
  "data_incomplete",
  "wrong_context",
  "needs_review",
] as const;
export type JarvisActionPreviewCancellationReason =
  (typeof JARVIS_PREVIEW_CANCELLATION_REASONS)[number];

const boundedId = z.string().trim().min(1).max(120);
const boundedText = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength);
const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => value || undefined)
    .optional();
const isoDateTime = z
  .string()
  .datetime({ offset: true })
  .refine((value) => Number.isFinite(Date.parse(value)), "Ungültiger Zeitstempel");

const taskPreviewPayloadSchema = z
  .object({
    title: boundedText(180),
    description: optionalText(4000),
    assigneeId: boundedId.optional(),
    dueAt: isoDateTime.optional(),
    projectId: boundedId.optional(),
    customerId: boundedId.optional(),
  })
  .strict();

const planningPreviewPayloadSchema = z
  .object({
    title: boundedText(180),
    startAt: isoDateTime,
    endAt: isoDateTime,
    projectId: boundedId,
    assigneeIds: z.array(boundedId).min(1).max(50),
    approvalStatus: z.enum(["confirmed", "requested"]).optional(),
    location: optionalText(500),
    note: optionalText(4000),
    offerId: boundedId.optional(),
    planningTrade: optionalText(180),
    billingCatalogItemId: boundedId.optional(),
    recurrence: z
      .object({
        type: z.enum(["once", "weekly", "biweekly", "monthly"]),
        until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        weekdays: z.array(z.number().int().min(0).max(6)).max(7),
      })
      .strict()
      .optional(),
    overbookingApproval: z
      .object({
        fingerprint: boundedText(180),
        reason: boundedText(1000),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (payload) => Date.parse(payload.endAt) > Date.parse(payload.startAt),
    {
      message: "Das Terminende muss nach dem Terminbeginn liegen.",
      path: ["endAt"],
    }
  );

const timePreviewPayloadSchema = z
  .object({
    projectId: boundedId,
    employeeId: boundedId,
    startAt: isoDateTime,
    endAt: isoDateTime,
    pauseMinutes: z.number().int().min(0).max(1440),
    description: boundedText(2000),
  })
  .strict()
  .refine(
    (payload) => Date.parse(payload.endAt) > Date.parse(payload.startAt),
    {
      message: "Das Ende des Zeiteintrags muss nach dem Beginn liegen.",
      path: ["endAt"],
    }
  );

const projectLogbookPreviewPayloadSchema = z
  .object({
    projectId: boundedId.optional(),
    title: optionalText(240),
    text: optionalText(12_000),
  })
  .strict();

const taskCommentPreviewPayloadSchema = z
  .object({
    taskId: boundedId.optional(),
    text: optionalText(4000),
    recipientUserId: boundedId.optional(),
  })
  .strict();

const taskLifecyclePreviewPayloadSchema = z
  .object({
    taskId: boundedId,
    action: z.enum(["archive", "restore"]),
    reason: boundedText(500),
  })
  .strict();

const projectStatusPreviewPayloadSchema = z
  .object({
    projectId: boundedId,
    targetStatus: boundedText(80),
    reason: boundedText(500),
  })
  .strict();

const projectLifecyclePreviewPayloadSchema = z
  .object({
    projectId: boundedId,
    lifecycleAction: z.enum(["archive", "restore"]),
    reason: boundedText(500),
  })
  .strict();

const offerPreviewLineSchema = z
  .object({
    catalogItemId: boundedId.optional(),
    quantity: z.number().positive().max(1_000_000).optional(),
    unitPrice: z.number().min(0).max(100_000_000).optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    description: optionalText(4000),
  })
  .strict();

const offerPreviewPayloadSchema = z
  .object({
    projectId: boundedId.optional(),
    company: z.enum(["OK solutions", "OK immocare"]).optional(),
    offerType: z.enum(["base", "addendum"]).optional(),
    addendumMode: z
      .enum(["addition", "replacement", "reduction"])
      .optional(),
    parentOfferId: boundedId.optional(),
    plannedExecutionMonth: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional(),
    plannedExecutionEndMonth: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional(),
    introText: optionalText(4000),
    closingText: optionalText(4000),
    vatRate: z.number().min(0).max(100).optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    lines: z.array(offerPreviewLineSchema).max(30).optional(),
  })
  .strict();

const invoicePreviewPayloadSchema = z
  .object({
    projectId: boundedId.optional(),
    company: z.enum(["OK solutions", "OK immocare"]).optional(),
    serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    plannedExecutionMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
    sourceOfferId: boundedId.optional(),
    introText: optionalText(4000),
    closingText: optionalText(4000),
    vatRate: z.number().min(0).max(100).optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    paymentTermDays: z.number().int().min(0).max(365).optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    lines: z.array(offerPreviewLineSchema).max(30).optional(),
  })
  .strict();

const invoiceFinalizePreviewPayloadSchema = z
  .object({
    invoiceId: boundedId,
  })
  .strict();

const offerFinalizePreviewPayloadSchema = z
  .object({
    offerId: boundedId,
  })
  .strict();

const offerSendPreviewPayloadSchema = z
  .object({
    offerId: boundedId,
  })
  .strict();

const offerDecisionPreviewPayloadSchema = z
  .object({
    offerId: boundedId,
    decision: z.enum(["won", "lost"]),
    reason: boundedText(500),
    note: optionalText(2000),
  })
  .strict();

const offerLifecyclePreviewPayloadSchema = z
  .object({
    offerId: boundedId,
    action: z.enum(["delete", "restore"]),
    reason: boundedText(500),
  })
  .strict();

const invoiceLifecyclePreviewPayloadSchema = z
  .object({
    invoiceId: boundedId,
    action: z.enum(["delete", "restore"]),
    reason: boundedText(500),
  })
  .strict();

const invoiceMarkPaidPreviewPayloadSchema = z
  .object({
    invoiceId: boundedId,
    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict();

const invoiceReminderPreviewPayloadSchema = z
  .object({
    invoiceId: boundedId,
    reminderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    paymentDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict();

const invoiceCancellationPreviewPayloadSchema = z
  .object({
    invoiceId: boundedId,
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

const invoiceCreditPreviewPayloadSchema = z
  .object({
    invoiceId: boundedId,
    reason: z.string().trim().max(500).optional(),
    items: z
      .array(
        z
          .object({
            sourceInvoiceLineId: boundedId,
            netAmount: z.number().min(0).max(10_000_000),
          })
          .strict()
      )
      .max(30)
      .optional(),
  })
  .strict();

const documentSendPreviewPayloadSchema = z
  .object({
    invoiceId: boundedId,
  })
  .strict();

const PREVIEW_PAYLOAD_SCHEMAS = {
  "task.prepare": taskPreviewPayloadSchema,
  "task.delete": taskLifecyclePreviewPayloadSchema,
  "project.status.change": projectStatusPreviewPayloadSchema,
  "project.archive": projectLifecyclePreviewPayloadSchema,
  "planning.prepare": planningPreviewPayloadSchema,
  "time.prepare": timePreviewPayloadSchema,
  "project-logbook.prepare": projectLogbookPreviewPayloadSchema,
  "task-comment.prepare": taskCommentPreviewPayloadSchema,
  "offer.prepare": offerPreviewPayloadSchema,
  "offer.finalize": offerFinalizePreviewPayloadSchema,
  "offer.send": offerSendPreviewPayloadSchema,
  "offer.manage": offerDecisionPreviewPayloadSchema,
  "offer.delete": offerLifecyclePreviewPayloadSchema,
  "invoice.prepare": invoicePreviewPayloadSchema,
  "invoice.finalize": invoiceFinalizePreviewPayloadSchema,
  "invoice.mark-paid": invoiceMarkPaidPreviewPayloadSchema,
  "invoice.remind": invoiceReminderPreviewPayloadSchema,
  "invoice.cancel": invoiceCancellationPreviewPayloadSchema,
  "invoice.credit": invoiceCreditPreviewPayloadSchema,
  "invoice.delete": invoiceLifecyclePreviewPayloadSchema,
  "document.send": documentSendPreviewPayloadSchema,
} satisfies Record<JarvisPreviewActionId, z.ZodType>;

export type JarvisActionPreviewPayloadMap = {
  "task.prepare": z.infer<typeof taskPreviewPayloadSchema>;
  "task.delete": z.infer<typeof taskLifecyclePreviewPayloadSchema>;
  "project.status.change": z.infer<typeof projectStatusPreviewPayloadSchema>;
  "project.archive": z.infer<typeof projectLifecyclePreviewPayloadSchema>;
  "planning.prepare": z.infer<typeof planningPreviewPayloadSchema>;
  "time.prepare": z.infer<typeof timePreviewPayloadSchema>;
  "project-logbook.prepare": z.infer<
    typeof projectLogbookPreviewPayloadSchema
  >;
  "task-comment.prepare": z.infer<typeof taskCommentPreviewPayloadSchema>;
  "offer.prepare": z.infer<typeof offerPreviewPayloadSchema>;
  "offer.finalize": z.infer<typeof offerFinalizePreviewPayloadSchema>;
  "offer.send": z.infer<typeof offerSendPreviewPayloadSchema>;
  "offer.manage": z.infer<typeof offerDecisionPreviewPayloadSchema>;
  "offer.delete": z.infer<typeof offerLifecyclePreviewPayloadSchema>;
  "invoice.prepare": z.infer<typeof invoicePreviewPayloadSchema>;
  "invoice.finalize": z.infer<typeof invoiceFinalizePreviewPayloadSchema>;
  "invoice.mark-paid": z.infer<typeof invoiceMarkPaidPreviewPayloadSchema>;
  "invoice.remind": z.infer<typeof invoiceReminderPreviewPayloadSchema>;
  "invoice.cancel": z.infer<typeof invoiceCancellationPreviewPayloadSchema>;
  "invoice.credit": z.infer<typeof invoiceCreditPreviewPayloadSchema>;
  "invoice.delete": z.infer<typeof invoiceLifecyclePreviewPayloadSchema>;
  "document.send": z.infer<typeof documentSendPreviewPayloadSchema>;
};

export type JarvisActionPreviewAuditEvent = {
  sequence: number;
  type: JarvisActionPreviewAuditEventType;
  at: string;
  organizationId: string;
  sessionActorId: string;
  effectiveActorId: string;
  impersonating: boolean;
  reason?: JarvisActionPreviewCancellationReason;
};

export type JarvisActionPreview<
  TActionId extends JarvisPreviewActionId = JarvisPreviewActionId,
> = {
  version: 1;
  previewId: string;
  actionId: TActionId;
  actionTitle: string;
  state: JarvisActionPreviewState;
  organizationId: string;
  sessionActorId: string;
  effectiveActorId: string;
  impersonating: boolean;
  payload: JarvisActionPreviewPayloadMap[TActionId];
  execution: {
    enabled: false;
    reason: "preview_only";
  };
  audit: JarvisActionPreviewAuditEvent[];
};

export type JarvisActionPreviewView = {
  version: 1;
  previewId: string;
  actionId: JarvisPreviewActionId;
  title: string;
  badge: "Nur Vorschau";
  state: "awaiting_confirmation";
  fields: Array<{
    label: string;
    value: string;
  }>;
  missingFields: string[];
  confirmation: {
    enabled: false;
    reason: "not_released";
  };
  execution: {
    enabled: false;
    reason: "preview_only";
  };
};

export type JarvisTaskActionDraftState =
  | "awaiting_input"
  | "awaiting_confirmation"
  | "executing"
  | "cancelled"
  | "expired"
  | "executed";

export type JarvisTaskActionDraftView = {
  version: 2;
  previewId: string;
  actionId: "task.prepare";
  title: "Aufgabe vorbereiten";
  badge: "Entwurf" | "Bereit" | "Wird angelegt" | "Abgebrochen" | "Abgelaufen" | "Angelegt";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  fields: Array<{
    label: string;
    value: string;
  }>;
  missingFields: string[];
  editor: {
    description: string;
    assigneeId: string;
    dueAt: string;
    assigneeOptions: Array<{
      id: string;
      label: string;
    }>;
  };
  confirmation: {
    enabled: boolean;
    reason:
      | "ready"
      | "missing_fields"
      | "expired"
      | "cancelled"
      | "executing"
      | "executed";
  };
  cancellation: {
    enabled: boolean;
  };
  execution: {
    enabled: false;
    reason: "requires_confirmation" | "finalized";
  };
  result?: {
    entityType: "task";
    entityId: string;
    label: string;
  };
};

export type JarvisCommunicationActionDraftView = {
  version: 2;
  previewId: string;
  actionId: "project-logbook.prepare" | "task-comment.prepare";
  title: "Projektlogbuch-Eintrag vorbereiten" | "Aufgabenkommentar vorbereiten";
  badge:
    | "Entwurf"
    | "Bereit"
    | "Wird gespeichert"
    | "Abgebrochen"
    | "Abgelaufen"
    | "Gespeichert";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  fields: Array<{ label: string; value: string }>;
  missingFields: string[];
  editor: {
    targetId: string;
    title: string;
    text: string;
    recipientUserId: string;
    targetOptions: Array<{ id: string; label: string }>;
    recipientOptions: Array<{ id: string; label: string }>;
  };
  confirmation: JarvisTaskActionDraftView["confirmation"];
  cancellation: JarvisTaskActionDraftView["cancellation"];
  execution: JarvisTaskActionDraftView["execution"];
  result?: {
    entityType: "projectLogbookEntry" | "taskComment";
    entityId: string;
    targetId: string;
    label: string;
  };
};

export type JarvisPlanningActionDraftCheck = {
  code: string;
  label: string;
  status: "ok" | "warning" | "blocked";
  detail: string;
};

export type JarvisPlanningActionDraftView = {
  version: 2;
  previewId: string;
  actionId: "planning.prepare";
  title: "Termin vorbereiten" | "Terminwunsch vorbereiten";
  badge: "Entwurf" | "Bereit" | "Wird angelegt" | "Abgebrochen" | "Abgelaufen" | "Angelegt";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  fields: Array<{
    label: string;
    value: string;
  }>;
  missingFields: string[];
  checks: JarvisPlanningActionDraftCheck[];
  editor: {
    title: string;
    note: string;
    assigneeIds: string[];
    startAt: string;
    endAt: string;
    approvalStatus: "confirmed" | "requested";
    variant: "single" | "recurring_hourly" | "recurring_flat";
    offerId: string;
    planningTrade: string;
    billingCatalogItemId: string;
    recurrence: {
      type: "once" | "weekly" | "biweekly" | "monthly";
      until: string;
      weekdays: number[];
    };
    overbooking: {
      required: boolean;
      fingerprint: string;
      reason: string;
      detail: string;
    };
    approvalStatusOptions: Array<{
      value: "confirmed" | "requested";
      label: string;
    }>;
    assigneeOptions: Array<{
      id: string;
      label: string;
    }>;
    offerOptions: Array<{
      id: string;
      label: string;
      executionMonth: string;
    }>;
    billingCatalogItemOptions: Array<{
      id: string;
      label: string;
    }>;
  };
  confirmation: JarvisTaskActionDraftView["confirmation"];
  cancellation: JarvisTaskActionDraftView["cancellation"];
  execution: JarvisTaskActionDraftView["execution"];
  result?: {
    entityType: "planning";
    entityId: string;
    label: string;
  };
};

export type JarvisTimeActionDraftCheck = {
  code: string;
  label: string;
  status: "ok" | "warning" | "blocked";
  detail: string;
};

export type JarvisTimeActionDraftView = {
  version: 2;
  previewId: string;
  actionId: "time.prepare";
  title: "Manuellen Zeiteintrag vorbereiten";
  badge:
    | "Entwurf"
    | "Bereit"
    | "Wird gespeichert"
    | "Abgebrochen"
    | "Abgelaufen"
    | "Gespeichert";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  fields: Array<{ label: string; value: string }>;
  missingFields: string[];
  checks: JarvisTimeActionDraftCheck[];
  editor: {
    mode: "project" | "unproductive";
    projectId: string;
    unproductiveLabel: string;
    employeeId: string;
    date: string;
    startTime: string;
    endTime: string;
    pauseMinutes: number;
    comment: string;
    offerId: string;
    trade: string;
    billingCatalogItemId: string;
    completionStatus: "" | "finished" | "interrupted";
    overtimeApprovalStatus: "not_required" | "pending" | "approved";
    projectVariant: "single" | "recurring_hourly" | "recurring_flat" | "unproductive";
    employeeOptions: Array<{ id: string; label: string }>;
    projectOptions: Array<{ id: string; label: string }>;
    offerOptions: Array<{ id: string; label: string }>;
    tradeOptions: string[];
    billingCatalogItemOptions: Array<{
      id: string;
      label: string;
      trade: string;
    }>;
    completionStatusOptions: Array<{
      value: "" | "finished" | "interrupted";
      label: string;
    }>;
    overtimeApprovalStatusOptions: Array<{
      value: "not_required" | "pending" | "approved";
      label: string;
    }>;
  };
  confirmation: JarvisTaskActionDraftView["confirmation"];
  cancellation: JarvisTaskActionDraftView["cancellation"];
  execution: JarvisTaskActionDraftView["execution"];
  result?: {
    entityType: "projectTimeEntry";
    entityId: string;
    label: string;
  };
};

export type JarvisWinterCalculationInputView = {
  areaSqm: number;
  readinessPricePerSqmPerMonth: number;
  seasonMonths: number;
  expectedDeployments: number;
  baseServiceMinutes: number;
  laborSalesRatePerHour: number;
  saltGramsPerSqm: number;
  saltSalesPricePerKg: number;
  plowTimeIncreasePercent: number;
  plowSaltIncreasePercent: number;
  mixedSpreadingPercent: number;
  mixedPlowingPercent: number;
};

export type JarvisOfferDraftLineView = {
  catalogItemId: string;
  catalogType: string;
  quantity: number;
  unit: string;
  title: string;
  description: string;
  unitPrice: number;
  discountPercent: number;
  vatRate: number;
  totalNet: number;
};

export type JarvisOfferDraftView = {
  version: 2;
  previewId: string;
  actionId: "offer.prepare";
  title: "Angebot oder Nachtrag vorbereiten";
  badge:
    | "Entwurf"
    | "Bereit"
    | "Wird gespeichert"
    | "Abgebrochen"
    | "Abgelaufen"
    | "Gespeichert";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  fields: Array<{ label: string; value: string }>;
  missingFields: string[];
  errors: string[];
  warnings: string[];
  editor: {
    projectId: string;
    company: "OK solutions" | "OK immocare";
    offerType: "base" | "addendum";
    addendumMode: "addition" | "replacement" | "reduction";
    parentOfferId: string;
    plannedExecutionMonth: string;
    plannedExecutionEndMonth: string;
    introText: string;
    closingText: string;
    vatRate: number;
    discountPercent: number;
    lines: JarvisOfferDraftLineView[];
    projectOptions: Array<{
      id: string;
      label: string;
      customerLabel: string;
      projectKind: string;
      defaultCompany: "OK solutions" | "OK immocare";
      defaultExecutionMonth: string;
      defaultExecutionEndMonth: string;
      updatedAt: string;
    }>;
    catalogOptions: Array<{
      id: string;
      label: string;
      type: string;
      unit: string;
      description: string;
      salesPrice: number;
      vatRate: number;
      updatedAt: string;
    }>;
    parentOfferOptions: Array<{
      id: string;
      label: string;
      projectId: string;
      updatedAt: string;
    }>;
  };
  calculation: {
    lineNetBeforeOfferDiscount: number;
    offerDiscountAmount: number;
    netTotal: number;
    vatRate: number;
    vatAmount: number;
    grossTotal: number;
  };
  confirmation: {
    enabled: boolean;
    reason:
      | "ready"
      | "missing_fields"
      | "invalid_input"
      | "not_permitted"
      | "expired"
      | "cancelled"
      | "executing"
      | "executed";
  };
  cancellation: { enabled: boolean };
  execution: {
    enabled: false;
    reason: "requires_confirmation" | "finalized";
  };
  result?: {
    entityType: "offer";
    entityId: string;
    label: string;
  };
};

export type JarvisInvoiceDraftView = {
  version: 2;
  previewId: string;
  actionId: "invoice.prepare";
  title: "Rechnungsentwurf mit Fakturavorprüfung";
  badge: "Entwurf" | "Bereit" | "Wird gespeichert" | "Abgebrochen" | "Abgelaufen" | "Gespeichert";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  fields: Array<{ label: string; value: string }>;
  missingFields: string[];
  errors: string[];
  warnings: string[];
  preflight: Array<{ key: string; label: string; status: "ok" | "warning" | "blocked"; detail: string }>;
  editor: {
    projectId: string;
    company: "OK solutions" | "OK immocare";
    serviceDate: string;
    plannedExecutionMonth: string;
    sourceOfferId: string;
    introText: string;
    closingText: string;
    vatRate: number;
    discountPercent: number;
    paymentTermDays: number;
    dueDate: string;
    lines: JarvisOfferDraftLineView[];
    projectOptions: Array<{ id: string; label: string; customerLabel: string; projectKind: string; defaultCompany: "OK solutions" | "OK immocare"; updatedAt: string }>;
    catalogOptions: Array<{ id: string; label: string; type: string; unit: string; description: string; salesPrice: number; vatRate: number; updatedAt: string }>;
    offerOptions: Array<{ id: string; label: string; projectId: string; executionMonth: string; updatedAt: string }>;
  };
  calculation: {
    lineNetBeforeInvoiceDiscount: number;
    invoiceDiscountAmount: number;
    netTotal: number;
    vatRate: number;
    vatAmount: number;
    grossTotal: number;
  };
  confirmation: { enabled: boolean; reason: "ready" | "missing_fields" | "invalid_input" | "not_permitted" | "expired" | "cancelled" | "executing" | "executed" };
  cancellation: { enabled: boolean };
  execution: { enabled: false; reason: "requires_confirmation" | "finalized" };
  result?: { entityType: "invoice"; entityId: string; label: string };
};

export type JarvisInvoiceFinalizationDraftView = {
  version: 2;
  previewId: string;
  actionId: "invoice.finalize";
  title: "Rechnung kontrolliert fakturieren";
  badge:
    | "Prüfung"
    | "Bereit"
    | "Wird fakturiert"
    | "Abgebrochen"
    | "Abgelaufen"
    | "Fakturiert";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  invoiceId: string;
  projectId: string;
  fields: Array<{ label: string; value: string }>;
  preflight: Array<{
    key: string;
    label: string;
    status: "ok" | "warning" | "blocked";
    detail: string;
  }>;
  warnings: string[];
  blockingIssues: string[];
  confirmation: {
    enabled: boolean;
    reason:
      | "ready"
      | "blocked"
      | "not_permitted"
      | "expired"
      | "cancelled"
      | "executing"
      | "executed";
    requiredText: string;
  };
  cancellation: { enabled: boolean };
  result?: {
    entityType: "invoice";
    entityId: string;
    label: string;
  };
};

export type JarvisOfferFinalizationDraftView = {
  version: 2;
  previewId: string;
  actionId: "offer.finalize";
  title: "Angebot kontrolliert finalisieren";
  badge:
    | "Prüfung"
    | "Bereit"
    | "Wird finalisiert"
    | "Abgebrochen"
    | "Abgelaufen"
    | "Finalisiert";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  offerId: string;
  projectId: string;
  fields: Array<{ label: string; value: string }>;
  checks: Array<{
    key: string;
    label: string;
    status: "ok" | "warning" | "blocked";
    detail: string;
  }>;
  warnings: string[];
  blockingIssues: string[];
  confirmation: {
    enabled: boolean;
    reason:
      | "ready"
      | "blocked"
      | "not_permitted"
      | "expired"
      | "cancelled"
      | "executing"
      | "executed";
    requiredText: string;
  };
  cancellation: { enabled: boolean };
  result?: {
    entityType: "offer";
    entityId: string;
    label: string;
  };
};

export type JarvisOfferDeliveryDraftView = {
  version: 2;
  previewId: string;
  actionId: "offer.send";
  title: "Angebot kontrolliert versenden";
  badge:
    | "Prüfung"
    | "Bereit"
    | "Wird versendet"
    | "Versand unklar"
    | "Abgebrochen"
    | "Abgelaufen"
    | "Versendet";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  offerId: string;
  projectId: string;
  fields: Array<{ label: string; value: string }>;
  editor: {
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    body: string;
    includeAcceptanceLink: boolean;
  };
  attachments: Array<{
    name: string;
    contentType: string;
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
  confirmation: {
    enabled: boolean;
    reason:
      | "ready"
      | "blocked"
      | "not_permitted"
      | "expired"
      | "cancelled"
      | "executing"
      | "uncertain"
      | "executed";
    requiredText: string;
  };
  cancellation: { enabled: boolean };
  result?: {
    entityType: "documentMailDispatch";
    entityId: string;
    label: string;
  };
};

export type JarvisOfferDecisionDraftView = {
  version: 2;
  previewId: string;
  actionId: "offer.manage";
  title: "Angebot kontrolliert entscheiden";
  badge: "Prüfung" | "Bereit" | "Wird entschieden" | "Abgebrochen" | "Abgelaufen" | "Entschieden";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  offerId: string;
  projectId: string;
  decision: "won" | "lost";
  fields: Array<{ label: string; value: string }>;
  checks: Array<{
    key: string;
    label: string;
    status: "ok" | "warning" | "blocked";
    detail: string;
  }>;
  warnings: string[];
  blockingIssues: string[];
  confirmation: {
    enabled: boolean;
    reason: "ready" | "blocked" | "not_permitted" | "expired" | "cancelled" | "executing" | "executed";
    requiredText: string;
  };
  cancellation: { enabled: boolean };
  result?: { entityType: "offer"; entityId: string; label: string };
};

export type JarvisOfferLifecycleDraftView = {
  version: 2;
  previewId: string;
  actionId: "offer.delete";
  title: "Angebot kontrolliert löschen oder wiederherstellen";
  badge: "Prüfung" | "Bereit" | "Wird geändert" | "Abgebrochen" | "Abgelaufen" | "Ausgeführt";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  offerId: string;
  projectId: string;
  lifecycleAction: "delete" | "restore";
  fields: Array<{ label: string; value: string }>;
  checks: Array<{
    key: string;
    label: string;
    status: "ok" | "warning" | "blocked";
    detail: string;
  }>;
  warnings: string[];
  blockingIssues: string[];
  confirmation: {
    enabled: boolean;
    reason: "ready" | "blocked" | "not_permitted" | "expired" | "cancelled" | "executing" | "executed";
    requiredText: string;
  };
  cancellation: { enabled: boolean };
  result?: { entityType: "offer"; entityId: string; label: string };
};

export type JarvisInvoiceLifecycleDraftView = {
  version: 2;
  previewId: string;
  actionId: "invoice.delete";
  title: "Rechnungsentwurf kontrolliert löschen oder wiederherstellen";
  badge: "Prüfung" | "Bereit" | "Wird geändert" | "Abgebrochen" | "Abgelaufen" | "Ausgeführt";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  invoiceId: string;
  projectId: string;
  lifecycleAction: "delete" | "restore";
  fields: Array<{ label: string; value: string }>;
  checks: Array<{
    key: string;
    label: string;
    status: "ok" | "warning" | "blocked";
    detail: string;
  }>;
  warnings: string[];
  blockingIssues: string[];
  confirmation: {
    enabled: boolean;
    reason: "ready" | "blocked" | "not_permitted" | "expired" | "cancelled" | "executing" | "executed";
    requiredText: string;
  };
  cancellation: { enabled: boolean };
  result?: { entityType: "invoice"; entityId: string; label: string };
};

export type JarvisTaskLifecycleDraftView = {
  version: 2;
  previewId: string;
  actionId: "task.delete";
  title: "Aufgabe kontrolliert archivieren oder wiederherstellen";
  badge: "Prüfung" | "Bereit" | "Wird geändert" | "Abgebrochen" | "Abgelaufen" | "Ausgeführt";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  taskId: string;
  projectId: string;
  lifecycleAction: "archive" | "restore";
  fields: Array<{ label: string; value: string }>;
  checks: Array<{
    key: string;
    label: string;
    status: "ok" | "warning" | "blocked";
    detail: string;
  }>;
  warnings: string[];
  blockingIssues: string[];
  confirmation: {
    enabled: boolean;
    reason: "ready" | "blocked" | "not_permitted" | "expired" | "cancelled" | "executing" | "executed";
    requiredText: string;
  };
  cancellation: { enabled: boolean };
  result?: { entityType: "task"; entityId: string; label: string };
};

export type JarvisProjectStatusDraftView = {
  version: 2;
  previewId: string;
  actionId: "project.status.change";
  title: "Projektstatus kontrolliert ändern";
  badge: "Prüfung" | "Bereit" | "Wird geändert" | "Abgebrochen" | "Abgelaufen" | "Ausgeführt";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  projectId: string;
  targetStatus: string;
  fields: Array<{ label: string; value: string }>;
  checks: Array<{
    key: string;
    label: string;
    status: "ok" | "warning" | "blocked";
    detail: string;
  }>;
  warnings: string[];
  blockingIssues: string[];
  confirmation: {
    enabled: boolean;
    reason: "ready" | "blocked" | "not_permitted" | "expired" | "cancelled" | "executing" | "executed";
    requiredText: string;
  };
  cancellation: { enabled: boolean };
  result?: { entityType: "project"; entityId: string; label: string };
};

export type JarvisProjectLifecycleDraftView = Omit<JarvisProjectStatusDraftView, "actionId" | "title" | "targetStatus"> & {
  actionId: "project.archive";
  title: "Projekt kontrolliert archivieren oder wiederherstellen";
  lifecycleAction: "archive" | "restore";
  targetStatus: string;
};

export type JarvisInvoicePaymentDraftView = {
  version: 2;
  previewId: string;
  actionId: "invoice.mark-paid";
  title: "Zahlungseingang kontrolliert bestätigen";
  badge:
    | "Prüfung"
    | "Bereit"
    | "Wird gebucht"
    | "Abgebrochen"
    | "Abgelaufen"
    | "Bezahlt";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  invoiceId: string;
  projectId: string;
  fields: Array<{ label: string; value: string }>;
  editor: { paymentDate: string };
  checks: Array<{
    key: string;
    label: string;
    status: "ok" | "warning" | "blocked";
    detail: string;
  }>;
  warnings: string[];
  blockingIssues: string[];
  confirmation: {
    enabled: boolean;
    reason:
      | "ready"
      | "blocked"
      | "not_permitted"
      | "expired"
      | "cancelled"
      | "executing"
      | "executed";
    requiredText: string;
  };
  cancellation: { enabled: boolean };
  result?: {
    entityType: "invoice";
    entityId: string;
    label: string;
  };
};

export type JarvisInvoiceReminderDraftView = {
  version: 2;
  previewId: string;
  actionId: "invoice.remind";
  title: "Mahnung kontrolliert erzeugen";
  badge:
    | "Prüfung"
    | "Bereit"
    | "Wird erstellt"
    | "Abgebrochen"
    | "Abgelaufen"
    | "Erstellt";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  invoiceId: string;
  projectId: string;
  fields: Array<{ label: string; value: string }>;
  editor: { reminderDate: string; paymentDeadline: string };
  checks: Array<{
    key: string;
    label: string;
    status: "ok" | "warning" | "blocked";
    detail: string;
  }>;
  warnings: string[];
  blockingIssues: string[];
  confirmation: {
    enabled: boolean;
    reason:
      | "ready"
      | "blocked"
      | "not_permitted"
      | "expired"
      | "cancelled"
      | "executing"
      | "executed";
    requiredText: string;
  };
  cancellation: { enabled: boolean };
  result?: {
    entityType: "invoice";
    entityId: string;
    label: string;
  };
};

export type JarvisInvoiceCancellationDraftView = {
  version: 2;
  previewId: string;
  actionId: "invoice.cancel";
  title: "Rechnung kontrolliert vollständig stornieren";
  badge: "Prüfung" | "Bereit" | "Wird storniert" | "Abgebrochen" | "Abgelaufen" | "Storniert";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  invoiceId: string;
  projectId: string;
  fields: Array<{ label: string; value: string }>;
  editor: { reason: string };
  checks: Array<{ key: string; label: string; status: "ok" | "warning" | "blocked"; detail: string }>;
  warnings: string[];
  blockingIssues: string[];
  confirmation: {
    enabled: boolean;
    reason: "ready" | "blocked" | "not_permitted" | "expired" | "cancelled" | "executing" | "executed";
    requiredText: string;
  };
  cancellation: { enabled: boolean };
  result?: { entityType: "invoice"; entityId: string; label: string };
};

export type JarvisInvoiceCreditDraftView = {
  version: 2;
  previewId: string;
  actionId: "invoice.credit";
  title: "Teilgutschrift kontrolliert erstellen";
  badge: "Prüfung" | "Bereit" | "Wird erstellt" | "Abgebrochen" | "Abgelaufen" | "Erstellt";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  invoiceId: string;
  projectId: string;
  fields: Array<{ label: string; value: string }>;
  editor: {
    reason: string;
    items: Array<{
      sourceInvoiceLineId: string;
      label: string;
      vatRate: number;
      originalNet: number;
      alreadyCreditedNet: number;
      remainingNet: number;
      netAmount: number;
    }>;
  };
  checks: Array<{ key: string; label: string; status: "ok" | "warning" | "blocked"; detail: string }>;
  warnings: string[];
  blockingIssues: string[];
  confirmation: {
    enabled: boolean;
    reason: "ready" | "blocked" | "not_permitted" | "expired" | "cancelled" | "executing" | "executed";
    requiredText: string;
  };
  cancellation: { enabled: boolean };
  result?: { entityType: "invoice"; entityId: string; label: string };
};

export type JarvisInvoiceDeliveryDraftView = {
  version: 2;
  previewId: string;
  actionId: "document.send";
  title: "Rechnung und Versand kontrolliert freigeben";
  badge:
    | "Prüfung"
    | "Bereit"
    | "Wird versendet"
    | "Versand unklar"
    | "Abgebrochen"
    | "Abgelaufen"
    | "Versendet";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  invoiceId: string;
  projectId: string;
  fields: Array<{ label: string; value: string }>;
  editor: {
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    body: string;
    format: "pdf" | "xrechnung" | "pdf-xrechnung" | "zugferd";
    formatOptions: Array<{
      value: "pdf" | "xrechnung" | "pdf-xrechnung" | "zugferd";
      label: string;
    }>;
  };
  attachments: Array<{
    name: string;
    contentType: string;
    size: number;
    sha256: string;
  }>;
  validation: {
    technical: { valid: boolean; issues: string[] } | null;
    kosit: {
      available: boolean;
      valid: boolean;
      message: string;
    } | null;
    zugferd: {
      converted: boolean;
      conversionMessage: string;
      validated: boolean;
      validationMessage: string;
    } | null;
  };
  warnings: string[];
  blockingIssues: string[];
  confirmation: {
    enabled: boolean;
    reason:
      | "ready"
      | "blocked"
      | "not_permitted"
      | "expired"
      | "cancelled"
      | "executing"
      | "executed"
      | "uncertain";
    requiredText: string;
  };
  cancellation: { enabled: boolean };
  result?: {
    entityType: "documentMailDispatch";
    entityId: string;
    label: string;
  };
};

export type JarvisWinterCalculationResultView = {
  readiness: {
    monthlyFee: number;
    seasonFee: number;
    amountPerDeployment: number;
  };
  variants: Array<{
    key: "mixed" | "spreading" | "spreadingAndPlowing";
    label: string;
    serviceMinutes: number;
    laborHours: number;
    laborAmount: number;
    saltKg: number;
    saltAmount: number;
    readinessAmountPerDeployment: number;
    effortAmountPerDeployment: number;
    pricePerDeployment: number;
    plannedSeasonRevenue: number;
    monthlyReadinessRevenue: number;
  }>;
};

export type JarvisWinterCalculationDraftView = {
  version: 2;
  previewId: string;
  actionId: "winter-calculation.prepare";
  title: "Winterdienst kalkulieren";
  badge:
    | "Entwurf"
    | "Berechnet"
    | "Wird gespeichert"
    | "Abgebrochen"
    | "Abgelaufen"
    | "Gespeichert";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  fields: Array<{ label: string; value: string }>;
  missingFields: string[];
  editor: {
    input: JarvisWinterCalculationInputView;
    projectId: string;
    note: string;
    projectOptions: Array<{
      id: string;
      label: string;
      customerLabel: string;
    }>;
  };
  calculation?: JarvisWinterCalculationResultView;
  confirmation: {
    enabled: boolean;
    reason:
      | "ready"
      | "missing_fields"
      | "not_permitted"
      | "expired"
      | "cancelled"
      | "executing"
      | "executed";
  };
  cancellation: { enabled: boolean };
  execution: {
    enabled: false;
    reason: "requires_confirmation" | "finalized";
  };
  result?: {
    entityType: "winterServiceCalculation";
    entityId: string;
    label: string;
  };
};

export type JarvisVehicleTripCalculationDraftView = {
  version: 2;
  previewId: string;
  actionId: "vehicle-trip-calculation.prepare";
  title: "Fahrt und Fahrzeugkosten kalkulieren";
  badge:
    | "Entwurf"
    | "Berechnet"
    | "Wird gespeichert"
    | "Abgebrochen"
    | "Abgelaufen"
    | "Gespeichert";
  state: JarvisTaskActionDraftState;
  revision: number;
  expiresAt: string;
  fields: Array<{ label: string; value: string }>;
  missingFields: string[];
  editor: {
    vehicleId: string;
    distanceKm: number;
    fuelPriceMode: "live" | "manual";
    manualFuelPricePerLiter: number;
    note: string;
    vehicleOptions: Array<{
      id: string;
      label: string;
      fuelType: string;
      consumptionLitersPer100Km: number;
      selfCostPerKm: number;
      salesPricePerKm: number;
      updatedAt: string;
      liveFuelPrice: number | null;
    }>;
    fuelPrice: {
      status: "live" | "unavailable" | "not_configured";
      source: string;
      stationLabel: string;
      fetchedAt: string | null;
      message: string;
    };
  };
  calculation?: {
    input: {
      distanceKm: number;
      consumptionLitersPer100Km: number;
      fuelPricePerLiter: number;
      selfCostPerKm: number;
      salesPricePerKm: number;
    };
    result: {
      fuelLiters: number;
      fuelCost: number;
      vehicleSelfCost: number;
      totalSelfCost: number;
      vehicleSales: number;
      totalSales: number;
      profit: number;
      markupPercent: number;
      marginPercent: number;
    };
    priceSource: string;
    priceFetchedAt: string | null;
    includesPersonnelCosts: false;
  };
  confirmation: {
    enabled: boolean;
    reason:
      | "ready"
      | "missing_fields"
      | "not_permitted"
      | "expired"
      | "cancelled"
      | "executing"
      | "executed";
  };
  cancellation: { enabled: boolean };
  execution: {
    enabled: false;
    reason: "requires_confirmation" | "finalized";
  };
  result?: {
    entityType: "vehicleCalculation";
    entityId: string;
    label: string;
  };
};

export type JarvisActionPreviewFailureCode =
  | "invalid_request"
  | "invalid_payload"
  | "missing_actor"
  | "not_permitted"
  | "not_preview_action"
  | "sensitive_content"
  | "scope_mismatch"
  | "invalid_transition";

export type JarvisActionPreviewResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: JarvisActionPreviewFailureCode;
      message: string;
      issues?: string[];
    };

export function extractJarvisTaskPreviewTitle(question: string) {
  const cleaned = question.trim().replace(/\s+/g, " ").slice(0, 1800);
  const quotedTitle =
    cleaned.match(/\baufgabe\b[^„“"']*[„"']([^„“"']{3,180})[“"']/iu)?.[1] ??
    cleaned.match(/[„"']([^„“"']{3,180})[“"']/u)?.[1];
  if (quotedTitle) return quotedTitle.trim();

  const taskIndex = cleaned.search(/\baufgabe\b/iu);
  if (taskIndex < 0) return undefined;
  const afterTask = cleaned
    .slice(taskIndex)
    .replace(/^\baufgabe\b/iu, "")
    .replace(/^(?:\s*(?:mit dem titel|namens|zum thema)\s*)/iu, "")
    .replace(/\s+an[.!?]*$/iu, "")
    .replace(/^[\s:–—-]+|[\s.!?]+$/gu, "")
    .trim()
    .slice(0, 180);
  if (!afterTask || !/\p{L}/u.test(afterTask)) return undefined;
  const significantTerms = afterTask
    .toLocaleLowerCase("de-DE")
    .split(/\s+/)
    .filter(
      (term) =>
        term &&
        ![
          "bitte",
          "dazu",
          "dafür",
          "hier",
          "für",
          "morgen",
          "heute",
          "neu",
          "neue",
          "einen",
          "eine",
        ].includes(term)
    );
  return significantTerms.length >= 2 ? afterTask : undefined;
}

function berlinLocalDateTimeToIso(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}) {
  const utcGuess = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute
  );
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcGuess));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((candidate) => candidate.type === type)?.value);
  const representedAsUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute")
  );
  const value = new Date(utcGuess - (representedAsUtc - utcGuess));
  const validation = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const validatedPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(validation.find((candidate) => candidate.type === type)?.value);
  return validatedPart("year") === input.year &&
    validatedPart("month") === input.month &&
    validatedPart("day") === input.day &&
    validatedPart("hour") === input.hour &&
    validatedPart("minute") === input.minute
    ? value.toISOString()
    : undefined;
}

export function extractJarvisPlanningPreviewDetails(question: string) {
  const cleaned = question.trim().replace(/\s+/g, " ").slice(0, 1800);
  const title =
    cleaned.match(/[„"']([^„“"']{3,180})[“"']/u)?.[1]?.trim() ?? "";
  const dateMatch = cleaned.match(
    /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/
  );
  const timeMatch = cleaned.match(
    /\bvon\s+([01]?\d|2[0-3]):([0-5]\d)\s+(?:uhr\s+)?bis\s+([01]?\d|2[0-3]):([0-5]\d)\b/iu
  );
  if (!title || !dateMatch || !timeMatch) return undefined;
  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const startAt = berlinLocalDateTimeToIso({
    year,
    month,
    day,
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  });
  const endAt = berlinLocalDateTimeToIso({
    year,
    month,
    day,
    hour: Number(timeMatch[3]),
    minute: Number(timeMatch[4]),
  });
  if (
    !startAt ||
    !endAt ||
    Date.parse(endAt) <= Date.parse(startAt)
  ) {
    return undefined;
  }
  return { title, startAt, endAt };
}

function formatPreviewDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function toJarvisActionPreviewView(
  preview: JarvisActionPreview,
  options: { assigneeLabels?: string[] } = {}
): JarvisActionPreviewView {
  const fields: JarvisActionPreviewView["fields"] = [];
  const missingFields: string[] = [];

  if (preview.actionId === "task.prepare") {
    const payload = preview.payload as JarvisActionPreviewPayloadMap["task.prepare"];
    fields.push({ label: "Titel", value: payload.title });
    if (payload.description) {
      fields.push({ label: "Beschreibung", value: payload.description });
    }
    if (payload.projectId) {
      fields.push({ label: "Projektbezug", value: "Aktuelles Projekt verknüpft" });
    }
    if (!payload.assigneeId) missingFields.push("Verantwortliche Person");
    if (!payload.dueAt) missingFields.push("Fälligkeit");
  } else if (preview.actionId === "planning.prepare") {
    const payload =
      preview.payload as JarvisActionPreviewPayloadMap["planning.prepare"];
    fields.push(
      { label: "Titel", value: payload.title },
      { label: "Beginn", value: formatPreviewDateTime(payload.startAt) },
      { label: "Ende", value: formatPreviewDateTime(payload.endAt) },
      { label: "Projektbezug", value: "Aktuelles Projekt verknüpft" }
    );
    if (options.assigneeLabels?.length) {
      fields.push({
        label: "Mitarbeitende",
        value: options.assigneeLabels.join(", "),
      });
    }
  } else {
    const payload = preview.payload as JarvisActionPreviewPayloadMap["time.prepare"];
    fields.push(
      { label: "Beginn", value: payload.startAt },
      { label: "Ende", value: payload.endAt },
      { label: "Pause", value: `${payload.pauseMinutes} Minuten` },
      { label: "Beschreibung", value: payload.description }
    );
  }

  return {
    version: 1,
    previewId: preview.previewId,
    actionId: preview.actionId,
    title: preview.actionTitle,
    badge: "Nur Vorschau",
    state: "awaiting_confirmation",
    fields,
    missingFields,
    confirmation: {
      enabled: false,
      reason: "not_released",
    },
    execution: {
      enabled: false,
      reason: "preview_only",
    },
  };
}

function getActorIds(profile: JarvisAccessProfile) {
  const sessionActorId = profile.sessionActor.id?.trim();
  const effectiveActorId = profile.effectiveActor.id?.trim();
  if (!sessionActorId || !effectiveActorId) return undefined;
  return { sessionActorId, effectiveActorId };
}

function listTextValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(listTextValues);
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(listTextValues);
}

function containsBlockedContent(
  value: unknown,
  profile: JarvisAccessProfile
) {
  return listTextValues(value).some((text) => {
    if (classifyJarvisQuestion(text) === "secret") return true;
    const authorization = authorizeJarvisQuestion(text, profile);
    return authorization.reason === "prompt_injection";
  });
}

function createAuditEvent(input: {
  sequence: number;
  type: JarvisActionPreviewAuditEventType;
  at: string;
  organizationId: string;
  profile: JarvisAccessProfile;
  actorIds: { sessionActorId: string; effectiveActorId: string };
  reason?: JarvisActionPreviewCancellationReason;
}): JarvisActionPreviewAuditEvent {
  return {
    sequence: input.sequence,
    type: input.type,
    at: input.at,
    organizationId: input.organizationId,
    sessionActorId: input.actorIds.sessionActorId,
    effectiveActorId: input.actorIds.effectiveActorId,
    impersonating: input.profile.isImpersonating,
    ...(input.reason ? { reason: input.reason } : {}),
  };
}

export function createJarvisActionPreview<
  TActionId extends JarvisPreviewActionId,
>(input: {
  previewId: string;
  actionId: TActionId;
  payload: unknown;
  organizationId: string;
  profile: JarvisAccessProfile;
  createdAt: string;
}): JarvisActionPreviewResult<JarvisActionPreview<TActionId>> {
  const request = z
    .object({
      previewId: boundedId,
      organizationId: boundedId,
      createdAt: isoDateTime,
    })
    .safeParse({
      previewId: input.previewId,
      organizationId: input.organizationId,
      createdAt: input.createdAt,
    });
  if (!request.success) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Die Vorschau-Metadaten sind ungültig.",
      issues: request.error.issues.map((issue) => issue.message),
    };
  }

  const actorIds = getActorIds(input.profile);
  if (!actorIds) {
    return {
      ok: false,
      code: "missing_actor",
      message:
        "Eine Action-Center-Vorschau benötigt einen eindeutig angemeldeten und wirksamen Benutzer.",
    };
  }

  const decision = getJarvisActionDecision(input.actionId, input.profile);
  if (!decision.known || !decision.action) {
    return {
      ok: false,
      code: "not_preview_action",
      message: "Diese Aktion ist nicht als sichere Vorschau registriert.",
    };
  }
  if (!decision.permitted) {
    return {
      ok: false,
      code: "not_permitted",
      message: "Die aktuelle Rollenkombination darf diese Vorschau nicht vorbereiten.",
    };
  }
  const isReleasedPreviewContract =
    (decision.action.risk === "prepare" &&
      decision.action.confirmation === "preview") ||
    (decision.action.risk === "critical" &&
      decision.action.confirmation === "critical");
  if (
    !isReleasedPreviewContract ||
    !JARVIS_PREVIEW_ACTION_IDS.includes(input.actionId)
  ) {
    return {
      ok: false,
      code: "not_preview_action",
      message:
        "Nur ausdrücklich freigegebene Vorbereitungsaktionen dürfen im Action Center als Vorschau erscheinen.",
    };
  }

  const schema = PREVIEW_PAYLOAD_SCHEMAS[input.actionId];
  const payloadResult = schema.safeParse(input.payload);
  if (!payloadResult.success) {
    return {
      ok: false,
      code: "invalid_payload",
      message: "Die Aktionsvorschau ist unvollständig oder enthält unerlaubte Felder.",
      issues: payloadResult.error.issues.map((issue) => issue.message),
    };
  }
  if (containsBlockedContent(payloadResult.data, input.profile)) {
    return {
      ok: false,
      code: "sensitive_content",
      message:
        "Technische Geheimnisse oder Prompt-Manipulationen dürfen nicht in einer Aktionsvorschau gespeichert werden.",
    };
  }

  const createdAt = request.data.createdAt;
  const organizationId = request.data.organizationId;
  return {
    ok: true,
    value: {
      version: 1,
      previewId: request.data.previewId,
      actionId: input.actionId,
      actionTitle: decision.action.title,
      state: "awaiting_confirmation",
      organizationId,
      ...actorIds,
      impersonating: input.profile.isImpersonating,
      payload:
        payloadResult.data as JarvisActionPreviewPayloadMap[TActionId],
      execution: {
        enabled: false,
        reason: "preview_only",
      },
      audit: [
        createAuditEvent({
          sequence: 1,
          type: "preview_created",
          at: createdAt,
          organizationId,
          profile: input.profile,
          actorIds,
        }),
      ],
    },
  };
}

function verifyTransitionScope(input: {
  preview: JarvisActionPreview;
  organizationId: string;
  profile: JarvisAccessProfile;
  transitionAt: string;
}) {
  const actorIds = getActorIds(input.profile);
  const schema = PREVIEW_PAYLOAD_SCHEMAS[input.preview.actionId];
  const auditIsIntact =
    Array.isArray(input.preview.audit) &&
    input.preview.audit.length > 0 &&
    input.preview.audit[0]?.type === "preview_created" &&
    input.preview.audit.every(
      (event, index) =>
        event.sequence === index + 1 &&
        event.organizationId === input.preview.organizationId &&
        event.sessionActorId === input.preview.sessionActorId &&
        event.effectiveActorId === input.preview.effectiveActorId &&
        event.impersonating === input.preview.impersonating &&
        Number.isFinite(Date.parse(event.at))
    );
  const lastAuditAt = input.preview.audit.at(-1)?.at;
  if (
    !actorIds ||
    input.preview.version !== 1 ||
    !JARVIS_PREVIEW_ACTION_IDS.includes(input.preview.actionId) ||
    !schema ||
    !schema.safeParse(input.preview.payload).success ||
    containsBlockedContent(input.preview.payload, input.profile) ||
    input.preview.execution.enabled !== false ||
    input.preview.execution.reason !== "preview_only" ||
    !auditIsIntact ||
    !lastAuditAt ||
    Date.parse(input.transitionAt) < Date.parse(lastAuditAt) ||
    input.preview.organizationId !== input.organizationId ||
    input.preview.sessionActorId !== actorIds.sessionActorId ||
    input.preview.effectiveActorId !== actorIds.effectiveActorId ||
    input.preview.impersonating !== input.profile.isImpersonating
  ) {
    return undefined;
  }
  const decision = getJarvisActionDecision(
    input.preview.actionId,
    input.profile
  );
  if (!decision.permitted) return undefined;
  return actorIds;
}

export function transitionJarvisActionPreview(input: {
  preview: JarvisActionPreview;
  command:
    | { type: "confirm"; at: string }
    | {
        type: "cancel";
        at: string;
        reason: JarvisActionPreviewCancellationReason;
      };
  organizationId: string;
  profile: JarvisAccessProfile;
}): JarvisActionPreviewResult<JarvisActionPreview> {
  const timestamp = isoDateTime.safeParse(input.command.at);
  if (!timestamp.success) {
    return {
      ok: false,
      code: "invalid_request",
      message: "Der Zeitstempel der Vorschauaktion ist ungültig.",
    };
  }

  const actorIds = verifyTransitionScope({
    preview: input.preview,
    organizationId: input.organizationId,
    profile: input.profile,
    transitionAt: timestamp.data,
  });
  if (!actorIds) {
    return {
      ok: false,
      code: "scope_mismatch",
      message:
        "Organisation, Sitzung oder wirksamer Benutzer passen nicht zur ursprünglichen Vorschau.",
    };
  }
  if (input.preview.state !== "awaiting_confirmation") {
    return {
      ok: false,
      code: "invalid_transition",
      message:
        "Nur eine noch offene Vorschau darf bestätigt oder abgebrochen werden.",
    };
  }

  const isConfirmation = input.command.type === "confirm";
  const reason =
    input.command.type === "cancel"
      ? input.command.reason
      : undefined;
  if (
    reason &&
    !JARVIS_PREVIEW_CANCELLATION_REASONS.includes(reason)
  ) {
    return {
      ok: false,
      code: "invalid_request",
      message:
        "Der Abbruchgrund ist nicht für das datensparsame Audit freigegeben.",
    };
  }
  const event = createAuditEvent({
    sequence: input.preview.audit.length + 1,
    type: isConfirmation ? "preview_confirmed" : "preview_cancelled",
    at: timestamp.data,
    organizationId: input.organizationId,
    profile: input.profile,
    actorIds,
    reason,
  });

  return {
    ok: true,
    value: {
      ...input.preview,
      state: isConfirmation ? "confirmed" : "cancelled",
      execution: {
        enabled: false,
        reason: "preview_only",
      },
      audit: [...input.preview.audit, event],
    },
  };
}
