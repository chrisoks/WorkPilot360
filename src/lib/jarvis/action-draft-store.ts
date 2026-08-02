import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  Prisma,
  Role,
  type JarvisActionDraft,
  type User,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { externalizePdfPayload } from "@/lib/storage/document-file";
import {
  createJarvisActionPreview,
  type JarvisActionPreview,
  type JarvisActionPreviewPayloadMap,
  type JarvisCommunicationActionDraftView,
  type JarvisPlanningActionDraftCheck,
  type JarvisPlanningActionDraftView,
  type JarvisOfferDraftView,
  type JarvisOfferFinalizationDraftView,
  type JarvisOfferDeliveryDraftView,
  type JarvisOfferDecisionDraftView,
  type JarvisOfferLifecycleDraftView,
  type JarvisInvoiceLifecycleDraftView,
  type JarvisTaskLifecycleDraftView,
  type JarvisProjectMasterDataDraftView,
  type JarvisProjectStatusDraftView,
  type JarvisProjectLifecycleDraftView,
  type JarvisStampSessionTransitionDraftView,
  type JarvisOnlineRequestConversionDraftView,
  type JarvisContactManagementDraftView,
  type JarvisContactDeletionDraftView,
  type JarvisCatalogManagementDraftView,
  type JarvisPersonnelManagementDraftView,
  type JarvisEmployeeCostManagementDraftView,
  type JarvisBulkUpdateDraftView,
  type JarvisAutomationManagementDraftView,
  type JarvisInvoiceDraftView,
  type JarvisInvoiceFinalizationDraftView,
  type JarvisInvoicePaymentDraftView,
  type JarvisInvoiceReminderDraftView,
  type JarvisInvoiceCancellationDraftView,
  type JarvisInvoiceCreditDraftView,
  type JarvisInvoiceDeliveryDraftView,
  type JarvisTaskActionDraftState,
  type JarvisTaskActionDraftView,
  type JarvisTimeActionDraftCheck,
  type JarvisTimeActionDraftView,
  type JarvisVehicleTripCalculationDraftView,
  type JarvisWinterCalculationDraftView,
} from "@/lib/jarvis/action-center";

import {
  authorizeJarvisQuestion,
  type JarvisAccessProfile,
} from "@/lib/jarvis/security";
import {
  canAssignTasksToOthers,
  canApproveProjectOvertime,
  canArchiveProjects,
  canConvertOnlineRequests,
  canManagePlanningEntries,
  canManageProjectTimeEntries,
  canManageProjects,
  canManageContacts,
  canDeleteContacts,
  canManageCatalogItems,
  canManageUsers,
  canAccessEmployeeCosts,
  canManageStatusRules,
  canManageOffers,
  canDeleteOffers,
  canDeleteInvoices,
  canDeleteTasks,
  canManageInvoices,
  canSendInvoiceDocuments,
  canSendOfferDocuments,
} from "@/lib/permissions";
import {
  evaluateProjectStatusAutomationManagement,
  executeProjectStatusAutomationManagement,
  getProjectStatusAutomationConfirmationText,
  ProjectStatusAutomationManagementServiceError,
  type ProjectStatusAutomationManagementRequest,
} from "@/lib/automation/project-status-automation-management-service";
import {
  createProjectLogbookEntry,
  ProjectLogbookServiceError,
} from "@/lib/services/project-logbook-service";
import {
  createTaskComment,
  deliverTaskCommentNotificationMails,
  TaskCommentServiceError,
  type TaskCommentMailNotification,
} from "@/lib/services/task-comment-service";
import {
  evaluatePlanningBatch,
  type PlanningBatchEvaluation,
} from "@/lib/planning/planning-batch-service";
import {
  resolvePlanningActionVariant,
  sharedPlanningRequestSchema,
  type SharedPlanningRequest,
} from "@/lib/planning/shared-planning";
import {
  createJarvisConfirmedTask,
} from "@/lib/services/task-service";
import {
  getGermanHoliday,
  normalizeGermanState,
} from "@/lib/planning/german-holidays";
import {
  calculateWinterService,
  WinterServiceCalculationValidationError,
  type WinterServiceCalculationInput,
  type WinterServiceCalculationResult,
} from "@/lib/winter-service/calculation";
import {
  calculateVehicleTrip,
  VehicleTripCalculationValidationError,
  type VehicleTripCalculationInput,
  type VehicleTripCalculationResult,
} from "@/lib/vehicle-calculation";
import {
  fuelPriceForVehicleType,
  loadVehicleFuelPrices,
} from "@/lib/vehicle-fuel-prices";
import {
  ensureProjectTimeEntryTable,
  ProjectTimeEntryServiceError,
  saveProjectTimeEntry,
  WITHOUT_OFFER_ASSIGNMENT,
} from "@/lib/time/project-time-entry-service";
import {
  evaluateStampSessionTransition,
  executeStampSessionTransition,
  getStampSessionTransitionConfirmationText,
  matchesStampSessionTransitionConfirmation,
  StampSessionServiceError,
  type StampSessionTransition,
} from "@/lib/time/stamp-session-service";
import {
  evaluateStampSessionStart,
  executeStampSessionStart,
  getStampSessionStartConfirmationText,
  matchesStampSessionStartConfirmation,
  type StampSessionStartInput,
} from "@/lib/time/stamp-session-start-service";
import {
  evaluateStampSessionStop,
  executeStampSessionStop,
  getStampSessionStopConfirmationText,
  matchesStampSessionStopConfirmation,
  type StampSessionStopInput,
} from "@/lib/time/stamp-session-stop-service";
import {
  evaluateStampSessionSwitch,
  executeStampSessionSwitch,
  getStampSessionSwitchConfirmationText,
  matchesStampSessionSwitchConfirmation,
  type StampSessionSwitchInput,
} from "@/lib/time/stamp-session-switch-service";
import {
  createFinalInspection,
  applyFinalInspectionBillingStatus,
  FinalInspectionServiceError,
} from "@/lib/projects/final-inspection-service";
import { ensureStampInterruptionFollowup } from "@/lib/time/stamp-session-interruption-service";
import { attachStampEntryToHourlyInvoiceDraft } from "@/lib/time/stamp-session-billing-service";
import {
  createConfirmedOfferDraft,
  evaluateOfferDraft,
  loadOfferDraftWorkspace,
  OfferDraftServiceError,
  type OfferDraftInput,
} from "@/lib/offers/offer-draft-service";
import {
  evaluateOfferFinalization,
  finalizeOfferDraft,
  getOfferFinalizationConfirmationText,
  matchesOfferFinalizationConfirmation,
  OfferFinalizationServiceError,
} from "@/lib/offers/offer-finalization-service";
import {
  evaluateOfferDelivery,
  getOfferDeliveryConfirmationText,
  matchesOfferDeliveryConfirmation,
  normalizeOfferDeliveryPayload,
  offerDeliveryPayloadSchema,
  OfferDeliveryServiceError,
  sendOfferDelivery,
  type OfferDeliveryEvaluation,
} from "@/lib/offers/offer-delivery-service";
import {
  evaluateOfferDecision,
  executeOfferDecision,
  getOfferDecisionConfirmationText,
  matchesOfferDecisionConfirmation,
  OfferDecisionServiceError,
} from "@/lib/offers/offer-decision-service";
import {
  evaluateOfferLifecycle,
  executeOfferLifecycle,
  getOfferLifecycleConfirmationText,
  matchesOfferLifecycleConfirmation,
  OfferLifecycleServiceError,
} from "@/lib/offers/offer-lifecycle-service";
import {
  evaluateInvoiceLifecycle,
  executeInvoiceLifecycle,
  getInvoiceLifecycleConfirmationText,
  matchesInvoiceLifecycleConfirmation,
  InvoiceLifecycleServiceError,
} from "@/lib/invoices/invoice-lifecycle-service";
import {
  evaluateTaskLifecycle,
  executeTaskLifecycle,
  getTaskLifecycleConfirmationText,
  matchesTaskLifecycleConfirmation,
  TaskLifecycleServiceError,
} from "@/lib/tasks/task-lifecycle-service";
import {
  evaluateProjectMasterDataChange,
  executeProjectMasterDataChange,
  getProjectMasterDataConfirmationText,
  matchesProjectMasterDataConfirmation,
  ProjectMasterDataServiceError,
} from "@/lib/projects/project-master-data-service";
import {
  evaluateProjectStatusChange,
  executeProjectStatusChange,
  getProjectStatusConfirmationText,
  matchesProjectStatusConfirmation,
  ProjectStatusServiceError,
} from "@/lib/projects/project-status-service";
import {
  evaluateProjectLifecycle,
  executeProjectLifecycle,
  getProjectLifecycleConfirmationText,
  matchesProjectLifecycleConfirmation,
  ProjectLifecycleServiceError,
} from "@/lib/projects/project-lifecycle-service";
import {
  convertOnlineRequest,
  evaluateOnlineRequestConversion,
  getOnlineRequestConversionConfirmationText,
  matchesOnlineRequestConversionConfirmation,
  OnlineRequestConversionError,
} from "@/lib/online-requests/conversion-service";
import {
  ContactManagementServiceError,
  evaluateContactChange,
  evaluateContactCreation,
  executeContactChange,
  executeContactCreation,
  getContactChangeConfirmationText,
  getContactCreateConfirmationText,
  type ContactCreateInput,
  type ContactManagementChanges,
} from "@/lib/contacts/contact-management-service";
import {
  ContactDeletionServiceError,
  evaluateContactDeletion,
  executeContactDeletion,
  getContactDeletionConfirmationText,
} from "@/lib/contacts/contact-deletion-service";
import {
  CatalogManagementServiceError,
  evaluateCatalogChange,
  evaluateCatalogCreation,
  executeCatalogManagement,
  getCatalogManagementConfirmationText,
  type CatalogManagementValues,
} from "@/lib/catalog/catalog-management-service";
import {
  evaluatePersonnelChange,
  executePersonnelChange,
  getPersonnelManagementConfirmationText,
  PersonnelManagementServiceError,
  type PersonnelManagementValues,
} from "@/lib/users/personnel-management-service";
import {
  EmployeeCostManagementServiceError,
  evaluateEmployeeCostChange,
  executeEmployeeCostChange,
  getEmployeeCostConfirmationText,
  type EmployeeCostValues,
} from "@/lib/employee-costs/employee-cost-management-service";
import {
  ContactBulkCategoryServiceError,
  evaluateContactBulkCategory,
  executeContactBulkCategory,
  getContactBulkCategoryConfirmationText,
  type ContactBulkCategoryRequest,
} from "@/lib/contacts/contact-bulk-category-service";
import {
  createConfirmedInvoiceDraft,
  evaluateInvoiceDraft,
  loadInvoiceDraftWorkspace,
  InvoiceDraftServiceError,
  type InvoiceDraftInput,
} from "@/lib/invoices/invoice-draft-service";
import {
  evaluateInvoiceFinalization,
  finalizeInvoiceDraft,
  getInvoiceFinalizationConfirmationText,
  InvoiceFinalizationServiceError,
  matchesInvoiceFinalizationConfirmation,
} from "@/lib/invoices/invoice-finalization-service";
import {
  evaluateInvoicePayment,
  formatInvoicePaymentDate,
  getInvoicePaymentConfirmationText,
  InvoicePaymentServiceError,
  markInvoicePaid,
  matchesInvoicePaymentConfirmation,
  normalizeInvoicePaymentDate,
  type InvoicePaymentEvaluation,
} from "@/lib/invoices/invoice-payment-service";
import {
  createInvoiceReminder,
  evaluateInvoiceReminder,
  getInvoiceReminderConfirmationText,
  InvoiceReminderServiceError,
  matchesInvoiceReminderConfirmation,
  type InvoiceReminderEvaluation,
} from "@/lib/invoices/invoice-reminder-service";
import {
  createInvoiceCancellation,
  evaluateInvoiceCancellation,
  getInvoiceCancellationConfirmationText,
  InvoiceCancellationServiceError,
  matchesInvoiceCancellationConfirmation,
  type InvoiceCancellationEvaluation,
} from "@/lib/invoices/invoice-cancellation-service";
import {
  createInvoiceCredit,
  evaluateInvoiceCredit,
  getInvoiceCreditConfirmationText,
  InvoiceCreditServiceError,
  matchesInvoiceCreditConfirmation,
  type InvoiceCreditEvaluation,
} from "@/lib/invoices/invoice-credit-service";
import { syncInvoiceInventoryMovements } from "@/lib/inventory/catalog-inventory";
import {
  evaluateInvoiceDelivery,
  getInvoiceDeliveryConfirmationText,
  invoiceDeliveryPayloadSchema,
  InvoiceDeliveryServiceError,
  matchesInvoiceDeliveryConfirmation,
  normalizeInvoiceDeliveryPayload,
  sendInvoiceDelivery,
  type InvoiceDeliveryEvaluation,
} from "@/lib/invoices/invoice-delivery-service";

async function externalizeJarvisDocumentPdf(input: {
  organizationId: string;
  kind: "offer" | "invoice";
  entityId: string | null;
  actorUserId: string;
}) {
  if (!input.entityId) return;
  try {
    if (input.kind === "offer") {
      const offer = await prisma.offer?.findFirst({
        where: { id: input.entityId, organizationId: input.organizationId },
        select: { id: true, offerNumber: true, pdfData: true },
      });
      if (!offer?.pdfData) return;
      await externalizePdfPayload({
        organizationId: input.organizationId,
        ownerType: "offer",
        ownerId: offer.id,
        sourceType: "offer-pdf",
        category: "offers",
        originalName: `${offer.offerNumber}.pdf`,
        pdfBase64: offer.pdfData,
        createdByUserId: input.actorUserId,
        writeReference: (tx, reference) =>
          tx.offer.update({ where: { id: offer.id }, data: { pdfData: reference } }),
      });
      return;
    }
    const invoice = await prisma.invoice?.findFirst({
      where: { id: input.entityId, organizationId: input.organizationId },
      select: { id: true, invoiceNumber: true, pdfData: true },
    });
    if (!invoice?.pdfData) return;
    await externalizePdfPayload({
      organizationId: input.organizationId,
      ownerType: "invoice",
      ownerId: invoice.id,
      sourceType: "invoice-pdf",
      category: "invoices",
      originalName: `${invoice.invoiceNumber}.pdf`,
      pdfBase64: invoice.pdfData,
      createdByUserId: input.actorUserId,
      writeReference: (tx, reference) =>
        tx.invoice.update({ where: { id: invoice.id }, data: { pdfData: reference } }),
    });
  } catch (error) {
    // Die fachliche Aktion bleibt gueltig; das PDF liegt bei einem Speicherfehler
    // weiterhin vollstaendig in der Datenbank und kann spaeter migriert werden.
    console.error("JARVIS document PDF externalization deferred", error);
  }
}

const JARVIS_TASK_DRAFT_TTL_MS = 15 * 60 * 1000;
const JARVIS_TASK_DRAFT_MAX_FUTURE_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const JARVIS_PLANNING_DRAFT_TTL_MS = 15 * 60 * 1000;
const JARVIS_PLANNING_DRAFT_MAX_FUTURE_MS =
  2 * 365 * 24 * 60 * 60 * 1000;
const JARVIS_TIME_DRAFT_TTL_MS = 15 * 60 * 1000;
const JARVIS_WINTER_CALCULATION_DRAFT_TTL_MS = 15 * 60 * 1000;
const JARVIS_VEHICLE_TRIP_DRAFT_TTL_MS = 15 * 60 * 1000;
const JARVIS_COMMUNICATION_DRAFT_TTL_MS = 15 * 60 * 1000;
const JARVIS_OFFER_DRAFT_TTL_MS = 15 * 60 * 1000;
const JARVIS_INVOICE_DRAFT_TTL_MS = 15 * 60 * 1000;
const OPEN_DRAFT_STATES = ["awaiting_input", "awaiting_confirmation"] as const;

const taskPayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(180),
    description: z.string().trim().max(4000).optional(),
    assigneeId: z.string().trim().min(1).max(120).optional(),
    dueAt: z.string().datetime({ offset: true }).optional(),
    projectId: z.string().trim().min(1).max(120).optional(),
    customerId: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

const taskContextSchema = z
  .object({
    recordType: z.literal("project").optional(),
    recordId: z.string().trim().min(1).max(120).optional(),
    recordLabel: z.string().trim().max(240).optional(),
    recordUpdatedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

const communicationPayloadSchema = z
  .object({
    targetId: z.string().trim().max(120).optional(),
    title: z.string().trim().max(240).optional(),
    text: z.string().trim().max(12_000).optional(),
    recipientUserId: z.string().trim().max(120).optional(),
  })
  .strict();

const communicationContextSchema = z
  .object({
    targetId: z.string().trim().min(1).max(120).optional(),
    targetUpdatedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

const completeCommunicationDraftSchema = communicationPayloadSchema.extend({
  revision: z.number().int().min(1),
});

const completeDraftSchema = z
  .object({
    revision: z.number().int().min(1),
    description: z.string().trim().max(4000).optional(),
    assigneeId: z.string().trim().min(1).max(120),
    dueAt: z.string().datetime({ offset: true }),
  })
  .strict();

const planningPayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(180),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    projectId: z.string().trim().min(1).max(120),
    assigneeIds: z.array(z.string().trim().min(1).max(120)).min(1).max(50),
    approvalStatus: z.enum(["confirmed", "requested"]).default("confirmed"),
    location: z.string().trim().max(500).optional(),
    note: z.string().trim().max(4000).optional(),
    offerId: z.string().trim().min(1).max(120).optional(),
    planningTrade: z.string().trim().max(180).optional(),
    billingCatalogItemId: z.string().trim().min(1).max(120).optional(),
    recurrence: z
      .object({
        type: z.enum(["once", "weekly", "biweekly", "monthly"]),
        until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        weekdays: z.array(z.number().int().min(0).max(6)).max(7),
      })
      .strict()
      .default({ type: "once", weekdays: [] }),
    overbookingApproval: z
      .object({
        fingerprint: z.string().trim().min(16).max(180),
        reason: z.string().trim().min(10).max(1000),
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

const completePlanningDraftSchema = z
  .object({
    revision: z.number().int().min(1),
    title: z.string().trim().min(1).max(180),
    note: z.string().trim().max(4000),
    assigneeIds: z.array(z.string().trim().min(1).max(120)).min(1).max(50),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    approvalStatus: z.enum(["confirmed", "requested"]),
    offerId: z.string().trim().max(120).optional(),
    planningTrade: z.string().trim().max(180).optional(),
    billingCatalogItemId: z.string().trim().max(120).optional(),
    recurrence: z
      .object({
        type: z.enum(["once", "weekly", "biweekly", "monthly"]),
        until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        weekdays: z.array(z.number().int().min(0).max(6)).max(7),
      })
      .strict(),
    overbookingReason: z.string().trim().max(1000).optional(),
    overbookingFingerprint: z.string().trim().max(180).optional(),
  })
  .strict();

const timePayloadSchema = z
  .object({
    mode: z.enum(["project", "unproductive"]),
    projectId: z.string().trim().max(120).optional(),
    unproductiveLabel: z.string().trim().max(240).optional(),
    employeeId: z.string().trim().max(120).optional(),
    date: z.string().trim().max(10).optional(),
    startTime: z.string().trim().max(5).optional(),
    endTime: z.string().trim().max(5).optional(),
    pauseMinutes: z.number().int().min(0).max(1440).default(0),
    comment: z.string().trim().max(2000).optional(),
    offerId: z.string().trim().max(120).optional(),
    trade: z.string().trim().max(180).optional(),
    billingCatalogItemId: z.string().trim().max(120).optional(),
    completionStatus: z
      .enum(["", "finished", "interrupted"])
      .default(""),
    overtimeApprovalStatus: z
      .enum(["not_required", "pending", "approved"])
      .default("not_required"),
  })
  .strict();

const completeTimeDraftSchema = timePayloadSchema.extend({
  revision: z.number().int().min(1),
});

const timeContextSchema = z
  .object({
    projectId: z.string().trim().min(1).max(120).optional(),
    projectUpdatedAt: z.string().datetime({ offset: true }).optional(),
    employeeId: z.string().trim().min(1).max(120).optional(),
    employeeUpdatedAt: z.string().datetime({ offset: true }).optional(),
    offerId: z.string().trim().min(1).max(120).optional(),
    offerUpdatedAt: z.string().datetime({ offset: true }).optional(),
    billingCatalogItemId: z.string().trim().min(1).max(120).optional(),
    billingCatalogItemUpdatedAt: z
      .string()
      .datetime({ offset: true })
      .optional(),
  })
  .strict();

const stampSessionTransitionPayloadSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["pause", "resume"]) }).strict(),
  z.object({
    action: z.literal("stop"),
    completionStatus: z.enum(["finished", "interrupted", ""]),
    comment: z.string().trim().max(2000).optional(),
    interruptionReason: z.string().trim().max(2000).optional(),
    finalInspectionMode: z.enum(["", "self", "colleague"]).default(""),
    allInspectionChecksDone: z.boolean().default(false),
    upsellNotes: z.string().trim().max(2000).optional(),
  }).strict(),
  z.object({
    action: z.literal("start"),
    mode: z.enum(["project", "unproductive"]),
    projectId: z.string().trim().min(1).max(120).optional(),
    unproductiveLabel: z.string().trim().max(240).optional(),
    comment: z.string().trim().min(1).max(2000),
    trade: z.string().trim().max(240).optional(),
    planningEntryId: z.string().trim().max(120).optional(),
    planningBillingGroupId: z.string().trim().max(120).optional(),
    billingCatalogItemId: z.string().trim().max(120).optional(),
    confirmImplementationStatus: z.boolean().default(false),
  }).strict(),
  z.object({
    action: z.literal("switch"),
    stop: z.object({
      completionStatus: z.enum(["finished", "interrupted", ""]),
      comment: z.string().trim().max(2000).optional(),
      interruptionReason: z.string().trim().max(2000).optional(),
      finalInspectionMode: z.enum(["", "self", "colleague"]).default(""),
      allInspectionChecksDone: z.boolean().default(false),
      upsellNotes: z.string().trim().max(2000).optional(),
    }).strict(),
    start: z.object({
      mode: z.enum(["project", "unproductive"]),
      projectId: z.string().trim().min(1).max(120).optional(),
      unproductiveLabel: z.string().trim().max(240).optional(),
      comment: z.string().trim().min(1).max(2000),
      trade: z.string().trim().max(240).optional(),
      planningEntryId: z.string().trim().max(120).optional(),
      planningBillingGroupId: z.string().trim().max(120).optional(),
      billingCatalogItemId: z.string().trim().max(120).optional(),
      confirmImplementationStatus: z.boolean().default(false),
    }).strict(),
  }).strict(),
]);

const stampSessionSnapshotSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    organizationId: z.string().trim().min(1).max(120),
    userId: z.string().trim().min(1).max(120),
    employee: z.string().max(500),
    mode: z.enum(["project", "unproductive"]),
    projectId: z.string().max(120),
    projectLabel: z.string().max(1000),
    trade: z.string().max(500),
    planningEntryId: z.string().max(120),
    planningBillingGroupId: z.string().max(120),
    billingCatalogItemId: z.string().max(120),
    billingCatalogItemLabel: z.string().max(1000),
    marketingContentItemId: z.string().max(120),
    marketingContentTitle: z.string().max(1000),
    marketingContentType: z.string().max(240),
    comment: z.string().max(2000),
    startedAt: z.string().datetime({ offset: true }),
    accumulatedMs: z.number().int().nonnegative(),
    pauseStartedAt: z.string().datetime({ offset: true }).nullable(),
    pauseMs: z.number().int().nonnegative(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

const stampSessionTransitionContextSchema = z
  .object({
    action: z.enum(["pause", "resume"]),
    session: stampSessionSnapshotSchema.nullable(),
    currentState: z.enum(["running", "paused", "missing"]),
    targetState: z.enum(["running", "paused"]),
    displayElapsedMs: z.number().int().nonnegative(),
    displayPauseMs: z.number().int().nonnegative(),
    fingerprint: z.string().length(64),
    warnings: z.array(z.string().max(1000)),
    blockingIssues: z.array(z.string().max(1000)),
  })
  .strict();

const stampSessionStartInputSchema = z.object({
  mode: z.enum(["project", "unproductive"]),
  projectId: z.string().max(120).optional(),
  unproductiveLabel: z.string().max(240).optional(),
  comment: z.string().max(2000),
  trade: z.string().max(240).optional(),
  planningEntryId: z.string().max(120).optional(),
  planningBillingGroupId: z.string().max(120).optional(),
  billingCatalogItemId: z.string().max(120).optional(),
  marketingContentItemId: z.string().max(120).optional(),
  marketingContentTitle: z.string().max(500).optional(),
  marketingContentType: z.string().max(120).optional(),
  confirmImplementationStatus: z.boolean().optional(),
}).strict();

const stampSessionStartContextSchema = z.object({
  action: z.literal("start"),
  requested: stampSessionStartInputSchema,
  effective: z.object({
    mode: z.enum(["project", "unproductive"]), projectId: z.string().max(120),
    projectLabel: z.string().max(1000), comment: z.string().max(2000), trade: z.string().max(240),
    planningEntryId: z.string().max(120), planningBillingGroupId: z.string().max(120),
    billingCatalogItemId: z.string().max(120), billingCatalogItemLabel: z.string().max(1000),
    marketingContentItemId: z.string().max(120).default(""), marketingContentTitle: z.string().max(500).default(""),
    marketingContentType: z.string().max(120).default(""),
    confirmImplementationStatus: z.boolean(),
  }).strict(),
  project: z.object({
    id: z.string().max(120), projectNumber: z.string().max(120), title: z.string().max(1000),
    customer: z.string().max(1000), status: z.string().max(240), projectKind: z.string().max(240),
    recurringBillingMode: z.string().max(120), trade: z.string().max(240),
    updatedAt: z.string().datetime({ offset: true }),
  }).strict().nullable(),
  billingCatalogItem: z.object({
    id: z.string().max(120), number: z.string().max(240), name: z.string().max(1000),
    trade: z.string().max(240), unit: z.string().max(120), salesPrice: z.number(),
    updatedAt: z.string().datetime({ offset: true }),
  }).strict().nullable(),
  planningSource: z.object({
    id: z.string().max(120), date: z.string().max(20), startTime: z.string().max(20),
    endTime: z.string().max(20), updatedAt: z.string().datetime({ offset: true }),
  }).strict().nullable(),
  existingSession: stampSessionSnapshotSchema.nullable(),
  isHourlyRecurring: z.boolean(),
  statusTransition: z.object({
    fromStatus: z.string().max(240), toStatus: z.literal("Umsetzung"), fingerprint: z.string().length(64),
  }).strict().nullable(),
  fingerprint: z.string().length(64), warnings: z.array(z.string().max(1000)),
  blockingIssues: z.array(z.string().max(2000)),
}).strict();

const stampSessionStopInputSchema = z.object({
  completionStatus: z.enum(["finished", "interrupted", ""]).optional(),
  comment: z.string().max(2000).optional(),
  interruptionReason: z.string().max(2000).optional(),
}).strict();

const stampSessionStopContextSchema = z.object({
  action: z.literal("stop"),
  requested: stampSessionStopInputSchema,
  effective: z.object({
    completionStatus: z.enum(["finished", "interrupted", ""]),
    comment: z.string().max(5000),
    interruptionReason: z.string().max(2000),
    date: z.string().max(20),
    startTime: z.string().max(20),
    endTime: z.string().max(20),
    durationMs: z.number().int().nonnegative(),
    pauseMs: z.number().int().nonnegative(),
  }).strict(),
  session: stampSessionSnapshotSchema.nullable(),
  project: z.object({
    id: z.string().max(120), projectNumber: z.string().max(120), title: z.string().max(1000),
    customer: z.string().max(1000), status: z.string().max(240), projectKind: z.string().max(240),
    recurringBillingMode: z.string().max(120), branch: z.string().max(240), projectType: z.string().max(240),
    responsibleName: z.string().max(500), updatedAt: z.string().datetime({ offset: true }),
  }).strict().nullable(),
  isHourlyRecurring: z.boolean(),
  requiresFinalInspection: z.boolean(),
  willAttachHourlyInvoiceDraft: z.boolean(),
  willCreateInterruptionTask: z.boolean(),
  willTransitionProjectToInterrupted: z.boolean(),
  fingerprint: z.string().length(64),
  warnings: z.array(z.string().max(1000)),
  blockingIssues: z.array(z.string().max(2000)),
}).strict();

const stampSessionSwitchContextSchema = z.object({
  action: z.literal("switch"),
  stop: stampSessionStopContextSchema,
  start: stampSessionStartContextSchema,
  fingerprint: z.string().length(64),
  warnings: z.array(z.string().max(1000)),
  blockingIssues: z.array(z.string().max(2000)),
}).strict();

const stampSessionContextSchema = z.union([
  stampSessionTransitionContextSchema,
  stampSessionStartContextSchema,
  stampSessionStopContextSchema,
  stampSessionSwitchContextSchema,
]);

const winterCalculationInputSchema = z
  .object({
    areaSqm: z.number(),
    readinessPricePerSqmPerMonth: z.number(),
    seasonMonths: z.number(),
    expectedDeployments: z.number(),
    baseServiceMinutes: z.number(),
    laborSalesRatePerHour: z.number(),
    saltGramsPerSqm: z.number(),
    saltSalesPricePerKg: z.number(),
    plowTimeIncreasePercent: z.number(),
    plowSaltIncreasePercent: z.number(),
    mixedSpreadingPercent: z.number(),
    mixedPlowingPercent: z.number(),
  })
  .strict();

const WINTER_CALCULATION_INPUT_KEYS = [
  "areaSqm",
  "readinessPricePerSqmPerMonth",
  "seasonMonths",
  "expectedDeployments",
  "baseServiceMinutes",
  "laborSalesRatePerHour",
  "saltGramsPerSqm",
  "saltSalesPricePerKg",
  "plowTimeIncreasePercent",
  "plowSaltIncreasePercent",
  "mixedSpreadingPercent",
  "mixedPlowingPercent",
] as const satisfies readonly (keyof WinterServiceCalculationInput)[];

const winterCalculationProvidedFieldSchema = z.enum(
  WINTER_CALCULATION_INPUT_KEYS
);

const winterCalculationPayloadSchema = z
  .object({
    input: winterCalculationInputSchema,
    providedFields: z
      .array(winterCalculationProvidedFieldSchema)
      .max(WINTER_CALCULATION_INPUT_KEYS.length)
      .optional(),
    projectId: z.string().trim().max(120).optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

const completeWinterCalculationDraftSchema = z
  .object({
    revision: z.number().int().min(1),
    input: winterCalculationInputSchema,
    providedFields: z
      .array(winterCalculationProvidedFieldSchema)
      .max(WINTER_CALCULATION_INPUT_KEYS.length)
      .optional(),
    projectId: z.string().trim().max(120),
    note: z.string().trim().max(2000),
  })
  .strict();

const winterCalculationContextSchema = z
  .object({
    projectId: z.string().trim().min(1).max(120).optional(),
    projectUpdatedAt: z.string().datetime({ offset: true }).optional(),
    customerId: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

const EMPTY_WINTER_CALCULATION_INPUT: WinterServiceCalculationInput = {
  areaSqm: 0,
  readinessPricePerSqmPerMonth: 0,
  seasonMonths: 0,
  expectedDeployments: 0,
  baseServiceMinutes: 0,
  laborSalesRatePerHour: 0,
  saltGramsPerSqm: 0,
  saltSalesPricePerKg: 0,
  plowTimeIncreasePercent: 0,
  plowSaltIncreasePercent: 0,
  mixedSpreadingPercent: 0,
  mixedPlowingPercent: 0,
};

const vehicleTripInputSchema = z
  .object({
    distanceKm: z.number(),
    consumptionLitersPer100Km: z.number(),
    fuelPricePerLiter: z.number(),
    selfCostPerKm: z.number(),
    salesPricePerKm: z.number(),
  })
  .strict();

const vehicleTripCalculationSchema = z
  .object({
    input: vehicleTripInputSchema,
    priceSource: z.string().trim().min(1).max(500),
    priceFetchedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

const vehicleTripPayloadSchema = z
  .object({
    vehicleId: z.string().trim().max(120).optional(),
    distanceKm: z.number(),
    fuelPriceMode: z.enum(["live", "manual"]),
    manualFuelPricePerLiter: z.number(),
    note: z.string().trim().max(2000).optional(),
    calculation: vehicleTripCalculationSchema.optional(),
  })
  .strict();

const completeVehicleTripDraftSchema = z
  .object({
    revision: z.number().int().min(1),
    vehicleId: z.string().trim().max(120),
    distanceKm: z.number(),
    fuelPriceMode: z.enum(["live", "manual"]),
    manualFuelPricePerLiter: z.number(),
    note: z.string().trim().max(2000),
  })
  .strict();

const vehicleTripContextSchema = z
  .object({
    vehicleId: z.string().trim().min(1).max(120).optional(),
    vehicleUpdatedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

const offerDraftLineSchema = z
  .object({
    catalogItemId: z.string().trim().max(120).default(""),
    catalogType: z.string().trim().max(40).default(""),
    quantity: z.number(),
    unit: z.string().trim().max(30).default("Stk"),
    title: z.string().trim().max(500).default(""),
    description: z.string().trim().max(4000).default(""),
    unitPrice: z.number(),
    discountPercent: z.number(),
    vatRate: z.number(),
    totalNet: z.number(),
  })
  .strict();

const offerDraftPayloadSchema = z
  .object({
    projectId: z.string().trim().max(120).default(""),
    company: z.enum(["OK solutions", "OK immocare"]),
    offerType: z.enum(["base", "addendum"]),
    addendumMode: z.enum(["addition", "replacement", "reduction"]),
    parentOfferId: z.string().trim().max(120).default(""),
    plannedExecutionMonth: z.string().trim().max(7).default(""),
    plannedExecutionEndMonth: z.string().trim().max(7).default(""),
    introText: z.string().trim().max(4000).default(""),
    closingText: z.string().trim().max(4000).default(""),
    vatRate: z.number().min(0).max(100),
    discountPercent: z.number().min(0).max(100),
    lines: z.array(offerDraftLineSchema).max(30),
  })
  .strict();

const completeOfferDraftSchema = offerDraftPayloadSchema
  .omit({ lines: true })
  .extend({
    revision: z.number().int().min(1),
    lines: z
      .array(
        z
          .object({
            catalogItemId: z.string().trim().max(120).default(""),
            quantity: z.number(),
            unitPrice: z.number(),
            discountPercent: z.number(),
            description: z.string().trim().max(4000).default(""),
          })
          .strict()
      )
      .max(30),
  })
  .strict();

const offerDraftContextSchema = z
  .object({
    projectId: z.string().trim().min(1).max(120).optional(),
    projectUpdatedAt: z.string().datetime({ offset: true }).optional(),
    parentOfferId: z.string().trim().min(1).max(120).optional(),
    parentOfferUpdatedAt: z.string().datetime({ offset: true }).optional(),
    catalogVersions: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(120),
            updatedAt: z.string().datetime({ offset: true }),
          })
          .strict()
      )
      .max(30)
      .default([]),
  })
  .strict();

const invoiceDraftPayloadSchema = z
  .object({
    projectId: z.string().trim().max(120).default(""),
    company: z.enum(["OK solutions", "OK immocare"]),
    serviceDate: z.string().trim().max(10).default(""),
    plannedExecutionMonth: z.string().trim().max(7).default(""),
    sourceOfferId: z.string().trim().max(120).default(""),
    introText: z.string().trim().max(4000).default(""),
    closingText: z.string().trim().max(4000).default(""),
    vatRate: z.number().min(0).max(100),
    discountPercent: z.number().min(0).max(100),
    paymentTermDays: z.number().int().min(0).max(365),
    dueDate: z.string().trim().max(10).default(""),
    lines: z.array(offerDraftLineSchema).max(30),
  })
  .strict();

const completeInvoiceDraftSchema = invoiceDraftPayloadSchema
  .omit({ lines: true, plannedExecutionMonth: true })
  .extend({
    revision: z.number().int().min(1),
    lines: z.array(z.object({
      catalogItemId: z.string().trim().max(120).default(""),
      quantity: z.number(),
      unitPrice: z.number(),
      discountPercent: z.number(),
      description: z.string().trim().max(4000).default(""),
    }).strict()).max(30),
  })
  .strict();

const invoiceDraftContextSchema = z.object({
  projectId: z.string().trim().min(1).max(120).optional(),
  projectUpdatedAt: z.string().datetime({ offset: true }).optional(),
  sourceOfferId: z.string().trim().min(1).max(120).optional(),
  sourceOfferUpdatedAt: z.string().datetime({ offset: true }).optional(),
  catalogVersions: z.array(z.object({ id: z.string().trim().min(1).max(120), updatedAt: z.string().datetime({ offset: true }) }).strict()).max(30).default([]),
}).strict();

const invoiceFinalizationPayloadSchema = z
  .object({ invoiceId: z.string().trim().min(1).max(120) })
  .strict();

const offerFinalizationPayloadSchema = z
  .object({ offerId: z.string().trim().min(1).max(120) })
  .strict();

const offerFinalizationContextSchema = z
  .object({
    offer: z.object({
      id: z.string(), offerNumber: z.string(), status: z.string(),
      projectId: z.string(), projectNumber: z.string(), projectTitle: z.string(),
      customerName: z.string(), company: z.string(), offerType: z.string(),
      plannedExecutionMonth: z.string(), plannedExecutionEndMonth: z.string(),
      netTotal: z.number(), vatRate: z.number(), grossTotal: z.number(),
      lineCount: z.number().int().nonnegative(),
      updatedAt: z.string().datetime({ offset: true }),
    }).strict(),
    checks: z.array(z.object({
      key: z.string(), label: z.string(),
      status: z.enum(["ok", "warning", "blocked"]), detail: z.string(),
    }).strict()),
    warnings: z.array(z.string()),
    blockingIssues: z.array(z.string()),
    fingerprint: z.string().length(64),
  })
  .strict();

const offerDecisionPayloadSchema = z.object({
  offerId: z.string().trim().min(1).max(120),
  decision: z.enum(["won", "lost"]),
  reason: z.string().trim().min(1).max(500),
  note: z.string().trim().max(2000).default(""),
}).strict();

const offerDecisionContextSchema = z.object({
  decision: z.enum(["won", "lost"]),
  reason: z.string(),
  note: z.string(),
  offer: z.object({
    id: z.string(), offerNumber: z.string(), status: z.string(), projectId: z.string(),
    projectNumber: z.string(), projectTitle: z.string(), customerName: z.string(),
    netTotal: z.number(), grossTotal: z.number(), updatedAt: z.string().datetime({ offset: true }),
  }).strict(),
  checks: z.array(z.object({
    key: z.string(), label: z.string(), status: z.enum(["ok", "warning", "blocked"]), detail: z.string(),
  }).strict()),
  warnings: z.array(z.string()),
  blockingIssues: z.array(z.string()),
  fingerprint: z.string().length(64),
}).strict();

const offerLifecyclePayloadSchema = z.object({
  offerId: z.string().trim().min(1).max(120),
  action: z.enum(["delete", "restore"]),
  reason: z.string().trim().min(1).max(500),
}).strict();

const offerLifecycleContextSchema = z.object({
  action: z.enum(["delete", "restore"]),
  reason: z.string(),
  previousStatus: z.string(),
  offer: z.object({
    id: z.string(), offerNumber: z.string(), status: z.string(), projectId: z.string(),
    projectNumber: z.string(), projectTitle: z.string(), customerName: z.string(),
    netTotal: z.number(), grossTotal: z.number(), updatedAt: z.string().datetime({ offset: true }),
  }).strict(),
  linkedInvoices: z.array(z.object({ id: z.string(), invoiceNumber: z.string(), status: z.string() }).strict()),
  acceptanceLinksToRevoke: z.number().int().min(0),
  checks: z.array(z.object({
    key: z.string(), label: z.string(), status: z.enum(["ok", "warning", "blocked"]), detail: z.string(),
  }).strict()),
  warnings: z.array(z.string()),
  blockingIssues: z.array(z.string()),
  fingerprint: z.string().length(64),
}).strict();

const invoiceLifecyclePayloadSchema = z.object({
  invoiceId: z.string().trim().min(1).max(120),
  action: z.enum(["delete", "restore"]),
  reason: z.string().trim().min(1).max(500),
}).strict();

const taskLifecyclePayloadSchema = z.object({
  taskId: z.string().trim().min(1).max(120),
  action: z.enum(["archive", "restore"]),
  reason: z.string().trim().min(1).max(500),
}).strict();

const taskLifecycleContextSchema = z.object({
  action: z.enum(["archive", "restore"]),
  reason: z.string(),
  previousStatus: z.string(),
  task: z.object({
    id: z.string(), title: z.string(), description: z.string(), status: z.string(), priority: z.string(),
    deadline: z.string().datetime({ offset: true }), customer: z.string(), projectId: z.string(), projectLabel: z.string(),
    ownerId: z.string(), ownerName: z.string(), updatedAt: z.string().datetime({ offset: true }),
  }).strict(),
  comments: z.number().int().min(0),
  participants: z.number().int().min(0),
  links: z.number().int().min(0),
  timeEntries: z.number().int().min(0),
  runningTimeEntries: z.number().int().min(0),
  childTasks: z.number().int().min(0),
  checks: z.array(z.object({
    key: z.string(), label: z.string(), status: z.enum(["ok", "warning", "blocked"]), detail: z.string(),
  }).strict()),
  warnings: z.array(z.string()),
  blockingIssues: z.array(z.string()),
  fingerprint: z.string().length(64),
}).strict();

const projectStatusPayloadSchema = z.object({
  projectId: z.string().trim().min(1).max(120),
  targetStatus: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(1).max(500),
}).strict();

const projectMasterDataChangesSchema = z.object({
  title: z.string().max(180).optional(),
  description: z.string().max(4000).optional(),
  projectRuntimeFrom: z.string().max(7).optional(),
  projectRuntimeUntil: z.string().max(7).optional(),
  trade: z.string().max(180).optional(),
  address: z.string().max(500).optional(),
  participants: z.string().max(500).optional(),
  responsibleName: z.string().max(180).optional(),
  deputyName: z.string().max(180).optional(),
  deputyFrom: z.string().max(7).optional(),
  deputyUntil: z.string().max(7).optional(),
}).strict().refine((changes) => Object.keys(changes).length > 0);

const projectMasterDataPayloadSchema = z.object({
  projectId: z.string().trim().min(1).max(120),
  changes: projectMasterDataChangesSchema,
}).strict();

const projectMasterDataContextSchema = z.object({
  project: z.object({
    id: z.string(), projectNumber: z.string(), title: z.string(), customer: z.string(),
    status: z.string(), reviewStatus: z.string(), updatedAt: z.string().datetime({ offset: true }),
  }).strict(),
  changes: z.array(z.object({
    field: z.string(), label: z.string(), before: z.string(), after: z.string(),
  }).strict()),
  reviewWillBeInvalidated: z.boolean(),
  checks: z.array(z.object({
    key: z.string(), label: z.string(), status: z.enum(["ok", "warning", "blocked"]), detail: z.string(),
  }).strict()),
  warnings: z.array(z.string()),
  blockingIssues: z.array(z.string()),
  fingerprint: z.string().length(64),
}).strict();

const contactManagementValuesSchema = z.object({
  type: z.enum(["company", "private", "person"]).optional(),
  category: z.string().max(80).optional(),
  companyName: z.string().max(500).optional(), firstName: z.string().max(500).optional(),
  lastName: z.string().max(500).optional(), position: z.string().max(500).optional(),
  email: z.string().max(500).optional(), invoiceEmail: z.string().max(500).optional(),
  activityReportEmail: z.string().max(500).optional(), phone: z.string().max(500).optional(),
  mobile: z.string().max(500).optional(), website: z.string().max(1000).optional(),
  source: z.string().max(500).optional(), reachability: z.string().max(500).optional(),
  street: z.string().max(500).optional(), addressLine1: z.string().max(500).optional(),
  addressLine2: z.string().max(500).optional(), postalCode: z.string().max(500).optional(),
  city: z.string().max(500).optional(), country: z.string().max(500).optional(),
}).strict();

const contactManagementPayloadSchema = z.object({
  mode: z.enum(["create", "update"]),
  contactId: z.string().trim().min(1).max(120).optional(),
  values: contactManagementValuesSchema,
}).strict();

const contactManagementContextSchema = z.object({
  mode: z.enum(["create", "update"]),
  contact: z.object({
    id: z.string(), customerNumber: z.string(), displayName: z.string(), type: z.string(),
    category: z.string(), updatedAt: z.string(),
  }).strict(),
  values: contactManagementValuesSchema,
  changes: z.array(z.object({ field: z.string(), label: z.string(), before: z.string(), after: z.string() }).strict()),
  checks: z.array(z.object({ key: z.string(), label: z.string(), status: z.enum(["ok", "warning", "blocked"]), detail: z.string() }).strict()),
  warnings: z.array(z.string()),
  blockingIssues: z.array(z.string()),
  fingerprint: z.string().length(64),
}).strict();

const contactDeletionPayloadSchema = z.object({
  contactId: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(3).max(1000),
}).strict();

const contactDeletionContextSchema = z.object({
  contact: z.object({ id: z.string(), customerNumber: z.string(), displayName: z.string(), type: z.string(), category: z.string(), updatedAt: z.string() }).strict(),
  reason: z.string().min(3).max(1000),
  references: z.array(z.object({ key: z.string(), label: z.string(), count: z.number().int().min(0) }).strict()),
  checks: z.array(z.object({ key: z.string(), label: z.string(), status: z.enum(["ok", "blocked"]), detail: z.string() }).strict()),
  warnings: z.array(z.string()),
  blockingIssues: z.array(z.string()),
  fingerprint: z.string().length(64),
}).strict();

const catalogManagementValuesSchema = z.object({
  type: z.enum(["article", "service"]).optional(), number: z.string().max(120).optional(), name: z.string().max(500).optional(),
  category: z.string().max(500).optional(), trade: z.string().max(500).optional(), unit: z.string().max(120).optional(), description: z.string().max(4000).optional(),
  purchasePrice: z.number().optional(), salesPrice: z.number().optional(), vatRate: z.number().optional(), laborCostRateKey: z.string().max(500).optional(),
  isLaborPosition: z.boolean().optional(), isPlanningRelevant: z.boolean().optional(), planningMinutesPerUnit: z.number().int().min(0).optional(),
  defaultPlanningBoard: z.string().max(500).optional(), defaultPlanningGroup: z.string().max(500).optional(),
}).strict();
const catalogManagementPayloadSchema = z.object({ mode: z.enum(["create", "update"]), catalogItemId: z.string().trim().min(1).max(120).optional(), values: catalogManagementValuesSchema }).strict();
const catalogCanonicalValuesSchema = catalogManagementValuesSchema.extend({ type: z.enum(["article", "service"]), number: z.string().min(1).max(120), name: z.string(), purchasePrice: z.number(), salesPrice: z.number(), vatRate: z.number(), planningMinutesPerUnit: z.number().int() }).strict();
const catalogManagementContextSchema = z.object({
  mode: z.enum(["create", "update"]),
  item: z.object({ id: z.string(), type: z.enum(["article", "service"]), number: z.string(), name: z.string(), reviewStatus: z.string(), updatedAt: z.string() }).strict(),
  values: catalogCanonicalValuesSchema,
  changes: z.array(z.object({ field: z.string(), label: z.string(), before: z.string(), after: z.string() }).strict()),
  impacts: z.array(z.object({ key: z.string(), label: z.string(), count: z.number().int().min(0) }).strict()),
  calculation: z.object({ purchasePrice: z.number(), salesPrice: z.number(), grossProfit: z.number(), marginPercent: z.number().nullable(), vatRate: z.number() }).strict(),
  reviewWillBeInvalidated: z.boolean(),
  checks: z.array(z.object({ key: z.string(), label: z.string(), status: z.enum(["ok", "warning", "blocked"]), detail: z.string() }).strict()),
  warnings: z.array(z.string()), blockingIssues: z.array(z.string()), fingerprint: z.string().length(64),
}).strict();

const personnelManagementValuesSchema = z.object({
  firstName: z.string().max(500).optional(), lastName: z.string().max(500).optional(), email: z.string().max(320).optional(),
  role: z.enum(["ADMIN", "GESCHAEFTSFUEHRER", "FUEHRUNGSKRAFT", "VERTRIEB", "BUCHHALTUNG", "MITARBEITER", "GAST"]).optional(),
  personalNumber: z.string().max(500).optional(), phone: z.string().max(500).optional(), mobile: z.string().max(500).optional(),
  street: z.string().max(500).optional(), postalCode: z.string().max(500).optional(), city: z.string().max(500).optional(),
  planningBoard: z.string().max(500).optional(), planningGroup: z.string().max(500).optional(),
}).strict();
const personnelManagementPayloadSchema = z.object({ employeeId: z.string().trim().min(1).max(120), values: personnelManagementValuesSchema }).strict();
const personnelManagementContextSchema = z.object({
  employee: z.object({ id: z.string(), label: z.string(), email: z.string(), role: z.nativeEnum(Role), isActive: z.boolean(), updatedAt: z.string() }).strict(),
  values: personnelManagementValuesSchema.required(),
  changes: z.array(z.object({ field: z.string(), label: z.string(), before: z.string(), after: z.string() }).strict()),
  impacts: z.array(z.object({ key: z.string(), label: z.string(), count: z.number().int().min(0) }).strict()),
  roleSessionsWillBeRevoked: z.boolean(),
  checks: z.array(z.object({ key: z.string(), label: z.string(), status: z.enum(["ok", "warning", "blocked"]), detail: z.string() }).strict()),
  warnings: z.array(z.string()), blockingIssues: z.array(z.string()), fingerprint: z.string().length(64),
}).strict();

const employeeCostValuesSchema = z.object({
  monthlySalary: z.number().optional(), fullCostFactor: z.number().optional(), annualHours: z.number().optional(),
  vacationDays: z.number().optional(), trainingDays: z.number().optional(), sickDays: z.number().optional(), hoursPerDay: z.number().optional(),
}).strict();
const employeeCostPayloadSchema = z.object({ userId: z.string().trim().min(1).max(120), values: employeeCostValuesSchema }).strict();
const employeeCostContextSchema = z.object({
  employee: z.object({ id: z.string(), label: z.string(), email: z.string(), isActive: z.boolean() }).strict(),
  cost: z.object({ id: z.string(), updatedAt: z.string(), exists: z.boolean() }).strict(),
  values: employeeCostValuesSchema.required(),
  changes: z.array(z.object({ field: z.string(), label: z.string(), before: z.number(), after: z.number() }).strict()),
  metrics: z.object({ annualFullCost: z.number(), monthlyFullCost: z.number(), deductionDays: z.number(), deductionHours: z.number(), sellableAnnualHours: z.number(), sellableMonthlyHours: z.number(), hourlyCost: z.number() }).strict(),
  impacts: z.array(z.object({ key: z.string(), label: z.string(), count: z.number().int().min(0) }).strict()),
  checks: z.array(z.object({ key: z.string(), label: z.string(), status: z.enum(["ok", "warning", "blocked"]), detail: z.string() }).strict()),
  warnings: z.array(z.string()), blockingIssues: z.array(z.string()), fingerprint: z.string().length(64),
}).strict();

const bulkUpdatePayloadSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("apply"), customerNumbers: z.array(z.string().min(1).max(40)).min(2).max(25), targetCategory: z.enum(["Kunde", "Privatkunde", "Lieferant", "Partner", "Ansprechpartner", "Archiv"]) }).strict(),
  z.object({ mode: z.literal("rollback"), sourceRequestId: z.string().min(8).max(120) }).strict(),
]);
const bulkUpdateItemSchema = z.object({ id: z.string(), customerNumber: z.string(), label: z.string(), before: z.string(), after: z.string(), updatedAt: z.string() }).strict();
const bulkUpdateContextSchema = z.object({
  mode: z.enum(["apply", "rollback"]), sourceRequestId: z.string().optional(), targetCategory: z.string(),
  items: z.array(bulkUpdateItemSchema).max(25),
  excluded: z.array(z.object({ customerNumber: z.string(), reason: z.string() }).strict()),
  checks: z.array(z.object({ key: z.string(), label: z.string(), status: z.enum(["ok", "warning", "blocked"]), detail: z.string() }).strict()),
  warnings: z.array(z.string()), blockingIssues: z.array(z.string()), fingerprint: z.string().length(64),
}).strict();

const automationManagementPayloadSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("switch"), enabled: z.boolean() }).strict(),
  z.object({ operation: z.literal("rule"), status: z.string().min(1).max(80), enabled: z.boolean().optional(), responsibleAfterDays: z.number().int().min(1).max(180).optional(), managementAfterDays: z.number().int().min(1).max(365).optional() }).strict(),
]);
const automationImpactSchema = z.object({ monitoredProjects: z.number().int().min(0), responsibleNotices: z.number().int().min(0), managementNotices: z.number().int().min(0), missingResponsible: z.number().int().min(0) }).strict();
const automationRuleValueSchema = z.object({ enabled: z.boolean(), responsibleAfterDays: z.number().int().min(1), managementAfterDays: z.number().int().min(1) }).strict();
const automationManagementContextSchema = z.object({
  operation: z.enum(["switch", "rule"]),
  currentEnabled: z.boolean(),
  targetEnabled: z.boolean(),
  rule: z.object({ status: z.string(), before: automationRuleValueSchema, after: automationRuleValueSchema }).strict().optional(),
  currentImpact: automationImpactSchema,
  targetImpact: automationImpactSchema,
  monitoredProjects: z.number().int().min(0),
  responsibleNotices: z.number().int().min(0),
  managementNotices: z.number().int().min(0),
  missingResponsible: z.number().int().min(0),
  items: z.array(z.object({
    projectId: z.string(), projectNumber: z.string(), projectTitle: z.string(), customer: z.string(),
    status: z.string(), elapsedDays: z.number().int().min(0), stage: z.enum(["responsible", "management"]), responsibleName: z.string(),
  }).strict()).max(100),
  checks: z.array(z.object({ key: z.string(), label: z.string(), status: z.enum(["ok", "warning", "blocked"]), detail: z.string() }).strict()),
  warnings: z.array(z.string()), blockingIssues: z.array(z.string()), fingerprint: z.string().length(64),
}).strict();

const projectStatusContextSchema = z.object({
  reason: z.string(),
  targetStatus: z.string(),
  project: z.object({
    id: z.string(), projectNumber: z.string(), title: z.string(), customer: z.string(),
    currentStatus: z.string(), projectKind: z.string(), projectType: z.string(), runtimeUntil: z.string(),
    responsibleName: z.string(), updatedAt: z.string().datetime({ offset: true }),
  }).strict(),
  evidence: z.object({
    activeOffers: z.number().int().min(0),
    confirmedPlanningEntries: z.number().int().min(0),
    projectTimeEntries: z.number().int().min(0),
    runningStampSessions: z.number().int().min(0),
    finalInspections: z.number().int().min(0),
    activeFinalInvoices: z.number().int().min(0),
    openTasks: z.number().int().min(0),
  }).strict(),
  checks: z.array(z.object({
    key: z.string(), label: z.string(), status: z.enum(["ok", "warning", "blocked"]), detail: z.string(),
  }).strict()),
  warnings: z.array(z.string()),
  blockingIssues: z.array(z.string()),
  fingerprint: z.string().length(64),
}).strict();

const projectLifecyclePayloadSchema = z.object({
  projectId: z.string().trim().min(1).max(120),
  lifecycleAction: z.enum(["archive", "restore"]),
  reason: z.string().trim().min(1).max(500),
}).strict();

const projectLifecycleContextSchema = z.object({
  lifecycleAction: z.enum(["archive", "restore"]),
  reason: z.string(),
  project: z.object({
    id: z.string(), projectNumber: z.string(), title: z.string(), customer: z.string(),
    currentStatus: z.string(), projectKind: z.string(), responsibleName: z.string(), restoreStatus: z.string(), updatedAt: z.string().datetime({ offset: true }),
  }).strict(),
  evidence: z.object({
    offers: z.number().int().min(0), activeOffers: z.number().int().min(0),
    invoices: z.number().int().min(0), unpaidInvoices: z.number().int().min(0),
    planningEntries: z.number().int().min(0), futureConfirmedPlanningEntries: z.number().int().min(0),
    projectTimeEntries: z.number().int().min(0), runningStampSessions: z.number().int().min(0),
    openTasks: z.number().int().min(0), storedFiles: z.number().int().min(0), onlineRequests: z.number().int().min(0),
  }).strict(),
  checks: z.array(z.object({ key: z.string(), label: z.string(), status: z.enum(["ok", "warning", "blocked"]), detail: z.string() }).strict()),
  warnings: z.array(z.string()), blockingIssues: z.array(z.string()), fingerprint: z.string().length(64),
}).strict();

const onlineRequestConversionPayloadSchema = z
  .object({
    requestId: z.string().trim().min(1).max(120),
  })
  .strict();

const onlineRequestConversionContextSchema = z
  .object({
    fingerprint: z.string().length(64),
    blockingIssues: z.array(z.string()),
    warnings: z.array(z.string()),
    request: z
      .object({
        id: z.string(),
        referenceNumber: z.string(),
        status: z.string(),
        requestType: z.string(),
        tradeName: z.string(),
        customerDecision: z.string(),
        customerName: z.string(),
        photoCount: z.number().int().min(0),
        updatedAt: z.string().datetime({ offset: true }),
      })
      .strict(),
    contact: z
      .object({ id: z.string(), customerNumber: z.string(), name: z.string() })
      .strict()
      .nullable(),
    responsibility: z
      .object({
        userId: z.string(),
        name: z.string(),
        fallback: z.boolean(),
      })
      .strict(),
    project: z
      .object({ id: z.string(), projectNumber: z.string(), title: z.string() })
      .strict()
      .nullable(),
    projectPrefix: z.string(),
    tasks: z.array(z.object({ title: z.string() }).strict()),
  })
  .strict();

const invoiceLifecycleContextSchema = z.object({
  action: z.enum(["delete", "restore"]),
  reason: z.string(),
  previousStatus: z.string(),
  invoice: z.object({
    id: z.string(), invoiceNumber: z.string(), status: z.string(), projectId: z.string(),
    projectNumber: z.string(), projectTitle: z.string(), customerName: z.string(),
    netTotal: z.number(), grossTotal: z.number(), updatedAt: z.string().datetime({ offset: true }),
  }).strict(),
  linkedTimeEntries: z.number().int().min(0),
  inventoryMovements: z.number().int().min(0),
  deliveryDispatches: z.number().int().min(0),
  derivedInvoices: z.array(z.object({ id: z.string(), invoiceNumber: z.string(), status: z.string() }).strict()),
  checks: z.array(z.object({
    key: z.string(), label: z.string(), status: z.enum(["ok", "warning", "blocked"]), detail: z.string(),
  }).strict()),
  warnings: z.array(z.string()),
  blockingIssues: z.array(z.string()),
  fingerprint: z.string().length(64),
}).strict();

const invoiceFinalizationContextSchema = z
  .object({
    invoice: z
      .object({
        id: z.string(),
        invoiceNumber: z.string(),
        status: z.string(),
        projectId: z.string(),
        projectNumber: z.string(),
        projectTitle: z.string(),
        customerName: z.string(),
        company: z.string(),
        serviceDate: z.string(),
        dueDate: z.string(),
        netTotal: z.number(),
        vatRate: z.number(),
        grossTotal: z.number(),
        updatedAt: z.string().datetime({ offset: true }),
      })
      .strict(),
    preflight: z.array(
      z
        .object({
          key: z.string(),
          label: z.string(),
          status: z.enum(["ok", "warning", "blocked"]),
          detail: z.string(),
        })
        .strict()
    ),
    warnings: z.array(z.string()),
    blockingIssues: z.array(z.string()),
    fingerprint: z.string().length(64),
  })
  .strict();

const invoicePaymentPayloadSchema = z
  .object({
    invoiceId: z.string().trim().min(1).max(120),
    paymentDate: z.string().trim().max(10),
  })
  .strict();

const completeInvoicePaymentSchema = z
  .object({
    revision: z.number().int().min(1),
    paymentDate: z.string().trim().max(10),
  })
  .strict();

const invoicePaymentContextSchema = z
  .object({
    invoice: z
      .object({
        id: z.string(),
        invoiceNumber: z.string(),
        status: z.string(),
        projectId: z.string(),
        projectNumber: z.string(),
        projectTitle: z.string(),
        customerName: z.string(),
        serviceDate: z.string(),
        dueDate: z.string(),
        grossTotal: z.number(),
        isPaid: z.boolean(),
        paidAt: z.string(),
        updatedAt: z.string().datetime({ offset: true }),
      })
      .strict(),
    paymentDate: z.string(),
    checks: z.array(
      z
        .object({
          key: z.string(),
          label: z.string(),
          status: z.enum(["ok", "warning", "blocked"]),
          detail: z.string(),
        })
        .strict()
    ),
    warnings: z.array(z.string()),
    blockingIssues: z.array(z.string()),
    fingerprint: z.string().length(64),
  })
  .strict();

const invoiceReminderPayloadSchema = z
  .object({
    invoiceId: z.string().trim().min(1).max(120),
    reminderDate: z.string().trim().max(10),
    paymentDeadline: z.string().trim().max(10),
  })
  .strict();

const completeInvoiceReminderSchema = z
  .object({
    revision: z.number().int().min(1),
    reminderDate: z.string().trim().max(10),
    paymentDeadline: z.string().trim().max(10),
  })
  .strict();

const invoiceReminderContextSchema = z
  .object({
    invoice: z
      .object({
        id: z.string(),
        invoiceNumber: z.string(),
        status: z.string(),
        projectId: z.string(),
        projectNumber: z.string(),
        projectTitle: z.string(),
        customerName: z.string(),
        customerStreet: z.string(),
        customerCity: z.string(),
        contactName: z.string(),
        internalContactName: z.string(),
        company: z.string(),
        dueDate: z.string(),
        grossTotal: z.number(),
        reminderLevel: z.number(),
        lastReminderAt: z.string(),
        updatedAt: z.string().datetime({ offset: true }),
      })
      .strict(),
    reminderDate: z.string(),
    paymentDeadline: z.string(),
    nextReminderLevel: z.number().int().min(1).max(3),
    documentNumber: z.string(),
    checks: z.array(
      z
        .object({
          key: z.string(),
          label: z.string(),
          status: z.enum(["ok", "warning", "blocked"]),
          detail: z.string(),
        })
        .strict()
    ),
    warnings: z.array(z.string()),
    blockingIssues: z.array(z.string()),
    fingerprint: z.string().length(64),
  })
  .strict();

const invoiceCancellationPayloadSchema = z
  .object({
    invoiceId: z.string().trim().min(1).max(120),
    reason: z.string().trim().max(500),
  })
  .strict();

const completeInvoiceCancellationSchema = z
  .object({
    revision: z.number().int().min(1),
    reason: z.string().trim().max(500),
  })
  .strict();

const invoiceCancellationContextSchema = z
  .object({
    invoice: z.object({
      id: z.string(), invoiceNumber: z.string(), status: z.string(), projectId: z.string(),
      projectNumber: z.string(), projectTitle: z.string(), company: z.string(), customerName: z.string(),
      customerStreet: z.string(), customerCity: z.string(), contactName: z.string(), internalContactName: z.string(),
      serviceDate: z.string(), netTotal: z.number(), vatRate: z.number(), grossTotal: z.number(), isPaid: z.boolean(),
      updatedAt: z.string().datetime({ offset: true }),
    }).strict(),
    cancellationNumber: z.string(),
    lineCount: z.number().int().min(0),
    releasedTimeEntryCount: z.number().int().min(0),
    activeCreditCount: z.number().int().min(0),
    creditedGrossTotal: z.number().min(0),
    checks: z.array(z.object({
      key: z.string(), label: z.string(), status: z.enum(["ok", "warning", "blocked"]), detail: z.string(),
    }).strict()),
    warnings: z.array(z.string()),
    blockingIssues: z.array(z.string()),
    fingerprint: z.string().length(64),
  })
  .strict();

const invoiceCreditItemSchema = z
  .object({
    sourceInvoiceLineId: z.string().trim().min(1).max(120),
    netAmount: z.number().min(0).max(10_000_000),
  })
  .strict();

const invoiceCreditPayloadSchema = z
  .object({
    invoiceId: z.string().trim().min(1).max(120),
    reason: z.string().trim().max(500),
    items: z.array(invoiceCreditItemSchema).max(30),
  })
  .strict();

const completeInvoiceCreditSchema = z
  .object({
    revision: z.number().int().min(1),
    reason: z.string().trim().max(500),
    items: z.array(invoiceCreditItemSchema).max(30),
  })
  .strict();

const invoiceCreditContextSchema = z
  .object({
    invoice: z
      .object({
        id: z.string(), invoiceNumber: z.string(), status: z.string(), projectId: z.string(),
        projectNumber: z.string(), projectTitle: z.string(), company: z.string(), customerName: z.string(),
        customerStreet: z.string(), customerCity: z.string(), contactName: z.string(), serviceDate: z.string(),
        netTotal: z.number(), grossTotal: z.number(), isPaid: z.boolean(), updatedAt: z.string().datetime({ offset: true }),
      })
      .strict(),
    creditNumber: z.string(),
    lines: z.array(z.object({
      id: z.string(), position: z.number().int(), title: z.string(), vatRate: z.number(),
      originalNet: z.number(), alreadyCreditedNet: z.number(), remainingNet: z.number(),
      creditNet: z.number(), creditGross: z.number(),
    }).strict()),
    totalCreditNet: z.number(),
    totalCreditGross: z.number(),
    remainingInvoiceNet: z.number(),
    remainingInvoiceGross: z.number(),
    checks: z.array(z.object({
      key: z.string(), label: z.string(), status: z.enum(["ok", "warning", "blocked"]), detail: z.string(),
    }).strict()),
    warnings: z.array(z.string()),
    blockingIssues: z.array(z.string()),
    fingerprint: z.string().length(64),
  })
  .strict();

const invoiceDeliveryContextSchema = z
  .object({
    invoice: z
      .object({
        id: z.string(),
        invoiceNumber: z.string(),
        status: z.string(),
        projectId: z.string(),
        projectNumber: z.string(),
        projectTitle: z.string(),
        customerName: z.string(),
        company: z.string(),
        serviceDate: z.string(),
        dueDate: z.string(),
        netTotal: z.number(),
        grossTotal: z.number(),
        updatedAt: z.string().datetime({ offset: true }),
      })
      .strict(),
    sender: z
      .object({
        userId: z.string(),
        name: z.string(),
        email: z.string(),
        connected: z.boolean(),
      })
      .strict(),
    payload: invoiceDeliveryPayloadSchema,
    attachments: z.array(
      z
        .object({
          name: z.string(),
          contentType: z.string(),
          size: z.number().int().nonnegative(),
          sha256: z.string().length(64),
        })
        .strict()
    ),
    validation: z
      .object({
        technical: z
          .object({
            valid: z.boolean(),
            issues: z.array(
              z
                .object({
                  severity: z.enum(["error", "warning", "info"]),
                  code: z.string(),
                  message: z.string(),
                })
                .strict()
            ),
          })
          .strict()
          .nullable(),
        kosit: z
          .object({
            available: z.boolean(),
            valid: z.boolean(),
            status: z.enum([
              "not-configured",
              "accepted",
              "rejected",
              "failed",
            ]),
            message: z.string(),
            issues: z.array(
              z
                .object({
                  severity: z.enum(["error", "warning", "info"]),
                  message: z.string(),
                })
                .strict()
            ),
          })
          .strict()
          .nullable(),
        zugferd: z
          .object({
            converted: z.boolean(),
            conversionMessage: z.string(),
            validated: z.boolean(),
            validationMessage: z.string(),
          })
          .strict()
          .nullable(),
      })
      .strict(),
    warnings: z.array(z.string()),
    blockingIssues: z.array(z.string()),
    fingerprint: z.string().length(64),
  })
  .strict();

const offerDeliveryContextSchema = z
  .object({
    offer: z
      .object({
        id: z.string(),
        offerNumber: z.string(),
        status: z.string(),
        projectId: z.string(),
        projectNumber: z.string(),
        projectTitle: z.string(),
        customerName: z.string(),
        company: z.string(),
        netTotal: z.number(),
        grossTotal: z.number(),
        updatedAt: z.string().datetime({ offset: true }),
      })
      .strict(),
    sender: z
      .object({
        userId: z.string(),
        name: z.string(),
        email: z.string(),
        connected: z.boolean(),
      })
      .strict(),
    payload: offerDeliveryPayloadSchema,
    attachments: z.array(
      z
        .object({
          name: z.string(),
          contentType: z.string(),
          size: z.number().int().nonnegative(),
          sha256: z.string().length(64),
        })
        .strict()
    ),
    checks: z.array(
      z
        .object({
          key: z.string(),
          label: z.string(),
          status: z.enum(["ok", "warning", "blocked"]),
          detail: z.string(),
        })
        .strict()
    ),
    warnings: z.array(z.string()),
    blockingIssues: z.array(z.string()),
    fingerprint: z.string().length(64),
  })
  .strict();

export type JarvisTaskDraftBinding = {
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
};

export type CreateJarvisTaskDraftInput = JarvisTaskDraftBinding & {
  preview: JarvisActionPreview<"task.prepare">;
  context: {
    recordType?: string;
    recordId?: string;
  };
  now?: Date;
};

export type CreateJarvisPlanningDraftInput = JarvisTaskDraftBinding & {
  preview: JarvisActionPreview<"planning.prepare">;
  context: {
    recordType?: string;
    recordId?: string;
  };
  now?: Date;
};

export type CreateJarvisCommunicationDraftInput = JarvisTaskDraftBinding & {
  preview: JarvisActionPreview<
    "project-logbook.prepare" | "task-comment.prepare"
  >;
  now?: Date;
};

export type JarvisPlanningExecutionInput = {
  actorUserId: string;
  planning: SharedPlanningRequest;
};

export class JarvisActionDraftError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "session_required"
      | "scope_mismatch"
      | "role_changed"
      | "integrity_failed"
      | "expired"
      | "invalid_state"
      | "invalid_input"
      | "assignee_forbidden"
      | "stale_context"
      | "conflict"
      | "execution_failed",
    message: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 410 | 500
  ) {
    super(message);
    this.name = "JarvisActionDraftError";
  }
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
    .join(",")}}`;
}

function hashJson(value: unknown) {
  return createHash("sha256").update(canonicalize(value)).digest("base64url");
}

function getIntegritySecret() {
  const secret =
    process.env.JARVIS_ACTION_INTEGRITY_SECRET ||
    process.env.WORKPILOT_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JARVIS_ACTION_INTEGRITY_SECRET_MISSING");
    }
    return "workpilot-local-jarvis-action-integrity-secret";
  }
  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error("JARVIS_ACTION_INTEGRITY_SECRET_TOO_SHORT");
  }
  return secret;
}

function getActorIds(profile: JarvisAccessProfile) {
  const sessionActorId = profile.sessionActor.id?.trim();
  const effectiveActorId = profile.effectiveActor.id?.trim();
  if (!sessionActorId || !effectiveActorId) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Angemeldeter und wirksamer Benutzer müssen eindeutig feststehen.",
      403
    );
  }
  return { sessionActorId, effectiveActorId };
}

type DraftIntegrityData = {
  id: string;
  organizationId: string;
  sessionId: string;
  sessionActorId: string;
  sessionActorRole: string;
  effectiveActorId: string;
  effectiveActorRole: string;
  impersonating: boolean;
  actionId: string;
  state: string;
  revision: number;
  payloadHash: string;
  contextHash: string;
  expiresAt: Date;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  executedAt: Date | null;
  resultEntityType: string | null;
  resultEntityId: string | null;
  lastErrorCode: string | null;
};

function createIntegrityTag(draft: DraftIntegrityData) {
  const material = canonicalize({
    version: 1,
    id: draft.id,
    organizationId: draft.organizationId,
    sessionId: draft.sessionId,
    sessionActorId: draft.sessionActorId,
    sessionActorRole: draft.sessionActorRole,
    effectiveActorId: draft.effectiveActorId,
    effectiveActorRole: draft.effectiveActorRole,
    impersonating: draft.impersonating,
    actionId: draft.actionId,
    state: draft.state,
    revision: draft.revision,
    payloadHash: draft.payloadHash,
    contextHash: draft.contextHash,
    expiresAt: draft.expiresAt.toISOString(),
    confirmedAt: draft.confirmedAt?.toISOString() ?? null,
    cancelledAt: draft.cancelledAt?.toISOString() ?? null,
    executedAt: draft.executedAt?.toISOString() ?? null,
    resultEntityType: draft.resultEntityType,
    resultEntityId: draft.resultEntityId,
    lastErrorCode: draft.lastErrorCode,
  });
  return createHmac("sha256", getIntegritySecret())
    .update(`jarvis-action-draft-v1:${material}`)
    .digest("base64url");
}

function integrityMatches(draft: JarvisActionDraft) {
  const expected = Buffer.from(createIntegrityTag(draft));
  const actual = Buffer.from(draft.integrityTag);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function validateBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Dieser Entwurf gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.",
      403
    );
  }
  if (
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role
  ) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Die Rolle hat sich seit Erstellung des Entwurfs geändert. Bitte erstelle eine neue Vorschau.",
      409
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Integritätsnachweis des Entwurfs ist ungültig. Es wurde nichts ausgeführt.",
      409
    );
  }
  const payload = taskPayloadSchema.safeParse(draft.payload);
  const context = taskContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "task.prepare" ||
    !payload.success ||
    !context.success ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Payload oder Kontext des Entwurfs stimmen nicht mit dem gespeicherten Nachweis überein.",
      409
    );
  }
  return { payload: payload.data, context: context.data };
}

async function appendAuditEvent(
  tx: Prisma.TransactionClient,
  input: {
    draft: JarvisActionDraft;
    eventType: string;
    reasonCode?: string;
    result?: {
      id: string;
      entityType?:
        | "task"
         | "planning"
         | "projectTimeEntry"
         | "winterServiceCalculation"
        | "vehicleCalculation"
        | "offer"
        | "invoice"
        | "documentMailDispatch"
        | "projectLogbookEntry"
        | "taskComment"
        | "project"
        | "contact"
         | "catalogItem"
         | "user"
         | "activeStampSession";
    };
  }
) {
  const last = await tx.jarvisActionDraftAuditEvent.findFirst({
    where: { draftId: input.draft.id },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });
  await tx.jarvisActionDraftAuditEvent.create({
    data: {
      id: randomUUID(),
      organizationId: input.draft.organizationId,
      draftId: input.draft.id,
      sequence: (last?.sequence ?? 0) + 1,
      eventType: input.eventType,
      revision: input.draft.revision,
      sessionId: input.draft.sessionId,
      sessionActorId: input.draft.sessionActorId,
      effectiveActorId: input.draft.effectiveActorId,
      payloadHash: input.draft.payloadHash,
      contextHash: input.draft.contextHash,
      reasonCode: input.reasonCode,
      resultEntityType: input.result
        ? input.result.entityType ?? "task"
        : undefined,
      resultEntityId: input.result?.id,
    },
  });
}

function validateStampSessionTransitionBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating ||
    binding.profile.isImpersonating ||
    actorIds.sessionActorId !== actorIds.effectiveActorId
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Persönliche Live-Stempelungen dürfen nur in der eigenen, nicht vertretenen Sitzung bedient werden.",
      403
    );
  }
  if (
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role
  ) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Die Rolle hat sich seit der Stempelprüfung geändert. Bitte beginne neu.",
      409
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Integritätsnachweis der Stempelaktion ist ungültig.",
      409
    );
  }
  const payload = stampSessionTransitionPayloadSchema.safeParse(draft.payload);
  const context = stampSessionContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "time.session.manage" ||
    !payload.success ||
    !context.success ||
    payload.data.action !== context.data.action ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Stempelaktion oder Fachkontext stimmen nicht mit dem gespeicherten Nachweis überein.",
      409
    );
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundStampSessionTransitionDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({
    where: { id: previewId },
  });
  if (!found) {
    throw new JarvisActionDraftError(
      "not_found",
      "Die persönliche Stempelaktion wurde nicht gefunden.",
      404
    );
  }
  const parsed = validateStampSessionTransitionBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  return {
    draft: current,
    ...validateStampSessionTransitionBinding(current, binding),
    originalContext: parsed.context,
  };
}

function stampTransitionStateLabel(state: string, operation: "start" | "stop" | "switch" | StampSessionTransition) {
  if (state === "executed") return operation === "start" ? "Gestartet" : operation === "pause" ? "Pausiert" : operation === "resume" ? "Fortgesetzt" : operation === "switch" ? "Gewechselt" : "Beendet";
  if (state === "executing") return "Wird geändert";
  if (state === "cancelled") return "Abgebrochen";
  if (state === "expired") return "Abgelaufen";
  return state === "awaiting_confirmation" ? "Bereit" : "Prüfung";
}

function toJarvisStampSessionTransitionDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): JarvisStampSessionTransitionDraftView {
  const { payload, context } = validateStampSessionTransitionBinding(draft, binding);
  const state = draft.state as JarvisStampSessionTransitionDraftView["state"];
  if (payload.action === "switch" && context.action === "switch") {
    const permitted = !binding.profile.isImpersonating &&
      binding.profile.sessionActor.id === binding.profile.effectiveActor.id;
    const ready = permitted && state === "awaiting_confirmation" && context.blockingIssues.length === 0;
    const reason: JarvisStampSessionTransitionDraftView["confirmation"]["reason"] =
      state === "expired" ? "expired" : state === "cancelled" ? "cancelled" :
      state === "executed" ? "executed" : state === "executing" ? "executing" :
      !permitted ? "not_permitted" : ready ? "ready" : "blocked";
    const elapsedMinutes = Math.round(context.stop.effective.durationMs / 60_000);
    const pauseMinutes = Math.round(context.stop.effective.pauseMs / 60_000);
    const previousLabel = context.stop.session?.projectLabel ||
      (context.stop.session?.mode === "unproductive" ? "Unproduktiv" : "Keine aktive Stempelung");
    const nextLabel = context.start.effective.projectLabel ||
      (context.start.effective.mode === "unproductive" ? "Unproduktiv" : "Kein Projekt");
    return {
      version: 2,
      previewId: draft.id,
      actionId: "time.session.manage",
      title: "Eigene Stempelung kontrolliert bedienen",
      badge: stampTransitionStateLabel(state, "switch") as JarvisStampSessionTransitionDraftView["badge"],
      state,
      revision: draft.revision,
      expiresAt: draft.expiresAt.toISOString(),
      operation: "switch",
      sessionId: state === "executed" ? draft.resultEntityId ?? "" : context.stop.session?.id ?? "",
      currentState: context.stop.session ? (context.stop.session.pauseStartedAt ? "paused" : "running") : "missing",
      targetState: "running",
      fields: [
        { label: "Aktion", value: "Zur Folgetätigkeit wechseln" },
        { label: "Bisheriger Arbeitsbezug", value: previousLabel },
        { label: "Bisheriger Abschluss", value: context.stop.effective.completionStatus === "finished" ? "Arbeit fertig" : context.stop.effective.completionStatus === "interrupted" ? "Arbeit unterbrochen" : "Nicht erforderlich" },
        ...(context.stop.effective.interruptionReason ? [{ label: "Unterbrechungsgrund", value: context.stop.effective.interruptionReason }] : []),
        { label: "Bisherige Arbeitszeit", value: `${elapsedMinutes} Minuten` },
        { label: "Bisherige Pause", value: `${pauseMinutes} Minuten` },
        { label: "Neuer Arbeitsbezug", value: nextLabel },
        { label: "Neue Tätigkeit", value: context.start.effective.comment || "-" },
        ...(context.start.isHourlyRecurring ? [
          { label: "Neues Gewerk", value: context.start.effective.trade || "Fehlt" },
          { label: "Neue Abrechnungsleistung", value: context.start.effective.billingCatalogItemLabel || "Fehlt" },
        ] : []),
        ...(context.stop.willAttachHourlyInvoiceDraft ? [{ label: "Bisherige Abrechnung", value: "Die beendete Zeit wird einem passenden Stunden-Rechnungsentwurf zugeordnet." }] : []),
        ...(context.stop.willCreateInterruptionTask ? [{ label: "Unterbrechungsfolge", value: "Aufgabe und Benachrichtigungen werden für die Klärung erzeugt." }] : []),
      ],
      checks: [
        { key: "personal-session", label: "Persönliche Sitzung", status: permitted ? "ok" : "blocked", detail: permitted ? "Der Wechsel betrifft ausschließlich deine eigene laufende Stempelung." : "Vertretung und Fremdstempelung sind ausgeschlossen." },
        { key: "atomic-switch", label: "Atomarer Wechsel", status: context.stop.session ? "ok" : "blocked", detail: context.stop.session ? "Bisherige Zeitbuchung und Folgestart werden in einem genau-einmal-geschützten Wechsel ausgeführt." : "Es gibt keine eindeutig gebundene Ausgangsstempelung." },
        { key: "completion", label: "Bisheriger Abschluss", status: context.stop.blockingIssues.length ? "blocked" : "ok", detail: context.stop.effective.completionStatus === "interrupted" ? "Unterbrechungsstatus und Grund sind dokumentiert." : context.stop.effective.completionStatus === "finished" ? "Die bisherige Projektarbeit ist als fertig angegeben." : "Für unproduktive Zeit ist kein Projektabschluss erforderlich." },
        { key: "next-billing-context", label: "Folge-Abrechnungskontext", status: context.start.isHourlyRecurring && !context.start.billingCatalogItem ? "blocked" : "ok", detail: context.start.isHourlyRecurring ? (context.start.billingCatalogItem ? "Gewerk und aktive Stunden-Abrechnungsleistung sind eindeutig gebunden." : "Gewerk oder aktive Stunden-Abrechnungsleistung fehlen.") : "Für die Folgetätigkeit ist keine Stunden-Abrechnungsleistung erforderlich." },
        { key: "final-inspection", label: "Endkontrolle", status: context.stop.requiresFinalInspection && !payload.stop.finalInspectionMode ? "blocked" : context.stop.requiresFinalInspection ? "warning" : "ok", detail: context.stop.requiresFinalInspection ? (payload.stop.finalInspectionMode ? "Die verpflichtende Endkontrolle ist für den Abschluss vorgemerkt." : "Vor dem Wechsel muss die Endkontrolle festgelegt werden.") : "Für diesen Abschluss ist keine verpflichtende Endkontrolle erforderlich." },
      ],
      warnings: context.warnings,
      blockingIssues: [...context.blockingIssues, ...(!permitted ? ["Persönliche Live-Stempelungen können nicht in Vertretung ausgeführt werden."] : [])],
      confirmation: { enabled: ready, reason, requiredText: getStampSessionSwitchConfirmationText(context) },
      cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
      ...(state === "executed" && draft.resultEntityId ? { result: { entityType: "activeStampSession" as const, entityId: draft.resultEntityId, label: "Laufende Folgestempelung" } } : {}),
    };
  }
  if (payload.action === "switch" || context.action === "switch") {
    throw new JarvisActionDraftError("integrity_failed", "Wechselaktion und Stempelkontext passen nicht zusammen.", 409);
  }
  if (payload.action === "start" && context.action === "start") {
    const permitted = !binding.profile.isImpersonating &&
      binding.profile.sessionActor.id === binding.profile.effectiveActor.id;
    const ready = permitted && state === "awaiting_confirmation" && context.blockingIssues.length === 0;
    const reason: JarvisStampSessionTransitionDraftView["confirmation"]["reason"] =
      state === "expired" ? "expired" : state === "cancelled" ? "cancelled" :
      state === "executed" ? "executed" : state === "executing" ? "executing" :
      !permitted ? "not_permitted" : ready ? "ready" : "blocked";
    const projectLabel = context.effective.projectLabel ||
      (context.effective.mode === "unproductive" ? "Unproduktiv" : "Kein Projekt");
    return {
      version: 2,
      previewId: draft.id,
      actionId: "time.session.manage",
      title: "Eigene Stempelung kontrolliert bedienen",
      badge: stampTransitionStateLabel(state, "start") as JarvisStampSessionTransitionDraftView["badge"],
      state,
      revision: draft.revision,
      expiresAt: draft.expiresAt.toISOString(),
      operation: "start",
      sessionId: state === "executed" ? draft.resultEntityId ?? "" : "",
      currentState: state === "executed" ? "running" : context.existingSession ? (context.existingSession.pauseStartedAt ? "paused" : "running") : "missing",
      targetState: "running",
      fields: [
        { label: "Aktion", value: "Persönliche Stempelung starten" },
        { label: "Arbeitsbezug", value: projectLabel },
        { label: "Tätigkeit", value: context.effective.comment || "-" },
        ...(context.isHourlyRecurring ? [
          { label: "Gewerk", value: context.effective.trade || "Fehlt" },
          { label: "Abrechnungsleistung", value: context.effective.billingCatalogItemLabel || "Fehlt" },
        ] : []),
        { label: "Projektstatus", value: context.statusTransition ? `${context.statusTransition.fromStatus} → Umsetzung` : context.project?.status || "Bleibt unverändert" },
      ],
      checks: [
        { key: "personal-session", label: "Persönliche Sitzung", status: permitted ? "ok" : "blocked", detail: permitted ? "Die Stempelung wird ausschließlich für dich selbst gestartet." : "Vertretung und Fremdstempelung sind ausgeschlossen." },
        { key: "active-session", label: state === "executed" ? "Geprüfter Ausgangszustand" : "Laufende Stempelung", status: context.existingSession ? "blocked" : "ok", detail: context.existingSession ? "Es lief bereits eine persönliche Stempelung." : state === "executed" ? "Vor der Ausführung lief keine persönliche Stempelung; die neue Stempelung ist jetzt aktiv." : "Es läuft noch keine persönliche Stempelung." },
        { key: "billing-context", label: "Abrechnungskontext", status: context.isHourlyRecurring && !context.billingCatalogItem ? "blocked" : "ok", detail: context.isHourlyRecurring ? (context.billingCatalogItem ? "Gewerk und aktive Stunden-Abrechnungsleistung sind eindeutig gebunden." : "Gewerk oder aktive Stunden-Abrechnungsleistung fehlen.") : "Für diesen Arbeitsbezug ist keine Stunden-Abrechnungsleistung erforderlich." },
      ],
      warnings: context.warnings,
      blockingIssues: [...context.blockingIssues, ...(!permitted ? ["Persönliche Live-Stempelungen können nicht in Vertretung ausgeführt werden."] : [])],
      confirmation: { enabled: ready, reason, requiredText: getStampSessionStartConfirmationText(context) },
      cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
      ...(state === "executed" && draft.resultEntityId ? { result: { entityType: "activeStampSession" as const, entityId: draft.resultEntityId, label: "Laufende Stempelung" } } : {}),
    };
  }
  if (payload.action === "start" || context.action === "start") {
    throw new JarvisActionDraftError("integrity_failed", "Startaktion und Stempelkontext passen nicht zusammen.", 409);
  }
  if (payload.action === "stop" && context.action === "stop") {
    const permitted = !binding.profile.isImpersonating &&
      binding.profile.sessionActor.id === binding.profile.effectiveActor.id;
    const ready = permitted && state === "awaiting_confirmation" && context.blockingIssues.length === 0;
    const reason: JarvisStampSessionTransitionDraftView["confirmation"]["reason"] =
      state === "expired" ? "expired" : state === "cancelled" ? "cancelled" :
      state === "executed" ? "executed" : state === "executing" ? "executing" :
      !permitted ? "not_permitted" : ready ? "ready" : "blocked";
    const elapsedMinutes = Math.round(context.effective.durationMs / 60_000);
    const pauseMinutes = Math.round(context.effective.pauseMs / 60_000);
    return {
      version: 2,
      previewId: draft.id,
      actionId: "time.session.manage",
      title: "Eigene Stempelung kontrolliert bedienen",
      badge: stampTransitionStateLabel(state, "stop") as JarvisStampSessionTransitionDraftView["badge"],
      state,
      revision: draft.revision,
      expiresAt: draft.expiresAt.toISOString(),
      operation: "stop",
      sessionId: context.session?.id ?? "",
      currentState: state === "executed" ? "missing" : context.session ? (context.session.pauseStartedAt ? "paused" : "running") : "missing",
      targetState: "missing",
      fields: [
        { label: "Aktion", value: "Persönliche Stempelung beenden" },
        { label: "Arbeitsbezug", value: context.session?.projectLabel || (context.session?.mode === "unproductive" ? "Unproduktiv" : "Keine aktive Stempelung") },
        { label: "Abschluss", value: context.effective.completionStatus === "finished" ? "Arbeit fertig" : context.effective.completionStatus === "interrupted" ? "Arbeit unterbrochen" : "Nicht erforderlich" },
        ...(context.effective.interruptionReason ? [{ label: "Unterbrechungsgrund", value: context.effective.interruptionReason }] : []),
        { label: "Erfasste Arbeitszeit", value: `${elapsedMinutes} Minuten` },
        { label: "Pause", value: `${pauseMinutes} Minuten` },
        ...(context.willAttachHourlyInvoiceDraft ? [{ label: "Abrechnung", value: "Zeit wird einem passenden Stunden-Rechnungsentwurf zugeordnet oder als neuer Entwurf vorbereitet." }] : []),
        ...(context.willCreateInterruptionTask ? [{ label: "Unterbrechung", value: "Aufgabe und Benachrichtigungen werden für die Klärung vorbereitet." }] : []),
      ],
      checks: [
        { key: "personal-session", label: "Persönliche Sitzung", status: permitted ? "ok" : "blocked", detail: permitted ? "Die Aktion betrifft ausschließlich deine eigene laufende Stempelung." : "Vertretung und Fremdstempelung sind ausgeschlossen." },
        { key: "active-session", label: state === "executed" ? "Ausgeführter Zustand" : "Laufende Stempelung", status: context.session || state === "executed" ? "ok" : "blocked", detail: state === "executed" ? "Die Stempelung wurde beendet und als Zeitbuchung gespeichert." : context.session ? "Die laufende Stempelung ist eindeutig gebunden." : "Es gibt keine aktive Stempelung." },
        { key: "completion", label: "Abschlussangaben", status: context.blockingIssues.some((issue) => /fertig|unterbrochen|begründen/i.test(issue)) ? "blocked" : "ok", detail: context.effective.completionStatus === "interrupted" ? "Unterbrechungsstatus und Grund sind dokumentiert." : context.effective.completionStatus === "finished" ? "Der Projektabschluss ist als fertig angegeben." : "Für unproduktive Zeit ist kein Projektabschluss erforderlich." },
        { key: "final-inspection", label: "Endkontrolle", status: context.requiresFinalInspection && !payload.finalInspectionMode ? "blocked" : context.requiresFinalInspection ? "warning" : "ok", detail: context.requiresFinalInspection ? (payload.finalInspectionMode ? "Die verpflichtende OK-immocare-Endkontrolle ist für die Ausführung vorgemerkt." : "Vor dem fertigen Abschluss muss die OK-immocare-Endkontrolle festgelegt werden.") : "Für diesen Abschluss ist keine verpflichtende OK-immocare-Endkontrolle erforderlich." },
      ],
      warnings: context.warnings,
      blockingIssues: [
        ...context.blockingIssues,
        ...(context.requiresFinalInspection && !payload.finalInspectionMode ? ["Bitte festlegen, ob du die Endkontrolle selbst dokumentierst oder ein Kollege sie übernimmt."] : []),
        ...(!permitted ? ["Persönliche Live-Stempelungen können nicht in Vertretung ausgeführt werden."] : []),
      ],
      confirmation: { enabled: ready && (!context.requiresFinalInspection || Boolean(payload.finalInspectionMode)), reason: ready && context.requiresFinalInspection && !payload.finalInspectionMode ? "blocked" : reason, requiredText: getStampSessionStopConfirmationText(context) },
      cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
      ...(state === "executed" && draft.resultEntityId ? { result: { entityType: "projectTimeEntry" as const, entityId: draft.resultEntityId, label: "Gespeicherte Zeitbuchung" } } : {}),
    };
  }
  if (payload.action === "stop" || context.action === "stop") {
    throw new JarvisActionDraftError("integrity_failed", "Stoppaktion und Stempelkontext passen nicht zusammen.", 409);
  }
  const displayedState = state === "executed" ? context.targetState : context.currentState;
  const permitted =
    !binding.profile.isImpersonating &&
    binding.profile.sessionActor.id === binding.profile.effectiveActor.id;
  const ready =
    permitted &&
    state === "awaiting_confirmation" &&
    context.blockingIssues.length === 0;
  const reason: JarvisStampSessionTransitionDraftView["confirmation"]["reason"] =
    state === "expired"
      ? "expired"
      : state === "cancelled"
        ? "cancelled"
        : state === "executed"
          ? "executed"
          : state === "executing"
            ? "executing"
            : !permitted
              ? "not_permitted"
              : ready
                ? "ready"
                : "blocked";
  const session = context.session;
  const elapsedMinutes = Math.round(context.displayElapsedMs / 60_000);
  const pauseMinutes = Math.round(context.displayPauseMs / 60_000);
  return {
    version: 2,
    previewId: draft.id,
    actionId: "time.session.manage",
    title: "Eigene Stempelung kontrolliert bedienen",
    badge: stampTransitionStateLabel(state, payload.action) as JarvisStampSessionTransitionDraftView["badge"],
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    operation: payload.action,
    sessionId: session?.id ?? "",
    currentState: displayedState,
    targetState: context.targetState,
    fields: [
      {
        label: "Aktion",
        value: payload.action === "pause" ? "Persönliche Stempelung pausieren" : "Persönliche Stempelung fortsetzen",
      },
      {
        label: "Arbeitsbezug",
        value: session?.projectLabel || (session?.mode === "unproductive" ? "Unproduktiv" : "Keine aktive Stempelung"),
      },
      { label: "Tätigkeit", value: session?.comment || "-" },
      { label: "Erfasste Arbeitszeit", value: `${elapsedMinutes} Minuten` },
      { label: "Bisherige Pause", value: `${pauseMinutes} Minuten` },
    ],
    checks: [
      {
        key: "personal-session",
        label: "Persönliche Sitzung",
        status: permitted ? "ok" : "blocked",
        detail: permitted
          ? "Die Aktion betrifft ausschließlich deine eigene laufende Stempelung."
          : "Vertretung und Fremdstempelung sind für diesen JARVIS-Weg ausgeschlossen.",
      },
      {
        key: "current-state",
        label: state === "executed" ? "Ausgeführter Zustand" : "Aktueller Zustand",
        status: context.blockingIssues.length ? "blocked" : "ok",
        detail:
          displayedState === "running"
            ? "Die Stempelung läuft."
            : displayedState === "paused"
              ? "Die Stempelung ist pausiert."
              : "Es gibt keine aktive Stempelung.",
      },
    ],
    warnings: context.warnings,
    blockingIssues: [
      ...context.blockingIssues,
      ...(!permitted
        ? ["Persönliche Live-Stempelungen können nicht in Vertretung ausgeführt werden."]
        : []),
    ],
    confirmation: {
      enabled: ready,
      reason,
      requiredText: getStampSessionTransitionConfirmationText(payload.action),
    },
    cancellation: {
      enabled: state === "awaiting_input" || state === "awaiting_confirmation",
    },
    ...(state === "executed" && draft.resultEntityId
      ? {
          result: {
            entityType: "activeStampSession" as const,
            entityId: draft.resultEntityId,
            label: "Stempelstatus aktualisiert",
          },
        }
      : {}),
  };
}

export async function createPersistedJarvisStampSessionTransitionDraft(input: {
  preview: JarvisActionPreview<"time.session.manage">;
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  now?: Date;
}) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für eine persönliche Stempelaktion ist eine aktuelle serverseitige Sitzung erforderlich.",
      401
    );
  }
  const actorIds = getActorIds(input.profile);
  if (
    input.profile.isImpersonating ||
    actorIds.sessionActorId !== actorIds.effectiveActorId
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Persönliche Live-Stempelungen dürfen nicht in Vertretung bedient werden.",
      403
    );
  }
  const payload = stampSessionTransitionPayloadSchema.parse(input.preview.payload);
  const actor = await prisma.user.findFirst({
    where: {
      id: actorIds.effectiveActorId,
      organizationId: input.organizationId,
      isActive: true,
    },
  });
  if (!actor) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Der angemeldete Benutzer ist nicht mehr aktiv.",
      409
    );
  }
  const context = payload.action === "switch"
    ? await evaluateStampSessionSwitch({
        organizationId: input.organizationId,
        userId: actor.id,
        change: {
          stop: {
            completionStatus: payload.stop.completionStatus,
            comment: payload.stop.comment,
            interruptionReason: payload.stop.interruptionReason,
          },
          start: payload.start,
        },
        now: input.now,
      }).then((evaluation) => stampSessionSwitchContextSchema.parse({
        ...evaluation,
        blockingIssues: [
          ...evaluation.blockingIssues,
          ...(evaluation.stop.requiresFinalInspection && !payload.stop.finalInspectionMode
            ? ["Bitte festlegen, ob du die Endkontrolle selbst dokumentierst oder ein Kollege sie übernimmt."]
            : []),
          ...(evaluation.stop.requiresFinalInspection && payload.stop.finalInspectionMode === "self" && !payload.stop.allInspectionChecksDone
            ? ["Für die eigene Endkontrolle müssen alle sechs Prüfpunkte ausdrücklich bestätigt sein."]
            : []),
        ],
      }))
    : payload.action === "start"
    ? stampSessionStartContextSchema.parse(await evaluateStampSessionStart({
        organizationId: input.organizationId,
        userId: actor.id,
        start: {
          mode: payload.mode,
          projectId: payload.projectId,
          unproductiveLabel: payload.unproductiveLabel,
          comment: payload.comment,
          trade: payload.trade,
          planningEntryId: payload.planningEntryId,
          planningBillingGroupId: payload.planningBillingGroupId,
          billingCatalogItemId: payload.billingCatalogItemId,
          confirmImplementationStatus: payload.confirmImplementationStatus,
        },
        now: input.now,
      }))
    : payload.action === "stop"
      ? await (() => evaluateStampSessionStop({
            organizationId: input.organizationId,
            userId: actor.id,
            stop: {
              completionStatus: payload.completionStatus,
              comment: payload.comment,
              interruptionReason: payload.interruptionReason,
            },
            now: input.now,
          }).then((evaluation) => stampSessionStopContextSchema.parse({
            ...evaluation,
            blockingIssues: [
              ...evaluation.blockingIssues,
              ...(evaluation.requiresFinalInspection && !payload.finalInspectionMode
                ? ["Bitte festlegen, ob du die Endkontrolle selbst dokumentierst oder ein Kollege sie übernimmt."]
                : []),
              ...(evaluation.requiresFinalInspection && payload.finalInspectionMode === "self" && !payload.allInspectionChecksDone
                ? ["Für die eigene Endkontrolle müssen alle sechs Prüfpunkte ausdrücklich bestätigt sein."]
                : []),
            ],
          })))()
    : stampSessionTransitionContextSchema.parse(await evaluateStampSessionTransition({
        organizationId: input.organizationId,
        userId: actor.id,
        action: payload.action,
        now: input.now,
      }));
  const now = input.now ?? new Date();
  const state = context.blockingIssues.length
    ? "awaiting_input"
    : "awaiting_confirmation";
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId,
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: false,
    actionId: "time.session.manage",
    state,
    revision: 1,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS),
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode: context.blockingIssues.length ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag: createIntegrityTag(draftData),
      },
    });
    await appendAuditEvent(tx, {
      draft,
      eventType: context.blockingIssues.length
        ? "draft_created_blocked"
        : "draft_created_ready",
    });
    return draft;
  });
  return toJarvisStampSessionTransitionDraftView(created, input);
}

export async function getJarvisStampSessionTransitionDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundStampSessionTransitionDraft(
    previewId,
    binding,
    now
  );
  return toJarvisStampSessionTransitionDraftView(draft, binding);
}

export async function cancelJarvisStampSessionTransitionDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const { draft } = await loadBoundStampSessionTransitionDraft(
    previewId,
    binding,
    now
  );
  if (draft.state === "cancelled") {
    return toJarvisStampSessionTransitionDraftView(draft, binding);
  }
  if (
    !OPEN_DRAFT_STATES.includes(draft.state as never) ||
    draft.revision !== expectedRevision
  ) {
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "conflict",
      "Die Stempelaktion ist nicht mehr abbrechbar oder wurde verändert.",
      draft.state === "expired" ? 410 : 409
    );
  }
  const nextData: DraftIntegrityData = {
    ...draft,
    state: "cancelled",
    cancelledAt: now,
    lastErrorCode: null,
  };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "cancelled",
        cancelledAt: now,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Die Stempelaktion wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_cancelled",
      reasonCode: "user_cancelled",
    });
    return current;
  });
  return toJarvisStampSessionTransitionDraftView(cancelled, binding);
}

export async function confirmJarvisStampSessionTransitionDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  confirmationText: string,
  now = new Date()
) {
  const loaded = await loadBoundStampSessionTransitionDraft(
    previewId,
    binding,
    now
  );
  if (loaded.draft.state === "executed") {
    return toJarvisStampSessionTransitionDraftView(loaded.draft, binding);
  }
  const validConfirmation = loaded.payload.action === "switch" && loaded.context.action === "switch"
    ? matchesStampSessionSwitchConfirmation(loaded.context, confirmationText)
    : loaded.payload.action === "start" && loaded.context.action === "start"
    ? matchesStampSessionStartConfirmation(loaded.context, confirmationText)
    : loaded.payload.action === "stop" && loaded.context.action === "stop"
      ? matchesStampSessionStopConfirmation(loaded.context, confirmationText)
    : loaded.payload.action !== "start" && loaded.context.action !== "start"
      && loaded.payload.action !== "stop" && loaded.context.action !== "stop"
      && loaded.payload.action !== "switch" && loaded.context.action !== "switch"
      ? matchesStampSessionTransitionConfirmation(loaded.payload.action, confirmationText)
      : false;
  if (!validConfirmation) {
    const requiredText = loaded.payload.action === "switch" && loaded.context.action === "switch"
      ? getStampSessionSwitchConfirmationText(loaded.context)
      : loaded.payload.action === "start" && loaded.context.action === "start"
      ? getStampSessionStartConfirmationText(loaded.context)
      : loaded.payload.action === "stop" && loaded.context.action === "stop"
        ? getStampSessionStopConfirmationText(loaded.context)
      : loaded.payload.action !== "start"
        && loaded.payload.action !== "stop"
        && loaded.payload.action !== "switch"
        ? getStampSessionTransitionConfirmationText(loaded.payload.action)
        : "STEMPELAKTION NEU PRÜFEN";
    throw new JarvisActionDraftError(
      "invalid_input",
      `Gib zur Bestätigung exakt „${requiredText}“ ein.`,
      400
    );
  }
  if (
    loaded.draft.state !== "awaiting_confirmation" ||
    loaded.draft.revision !== expectedRevision
  ) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "conflict",
      "Die Stempelaktion ist nicht mehr aktuell oder ausführbar.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  if (loaded.payload.action === "switch" && loaded.context.action === "switch") {
    try {
      const actor = await prisma.user.findFirst({
        where: {
          id: loaded.draft.effectiveActorId,
          organizationId: binding.organizationId,
          isActive: true,
        },
      });
      if (!actor || actor.id !== loaded.draft.sessionActorId) {
        throw new JarvisActionDraftError("role_changed", "Der persönliche Benutzerkontext ist nicht mehr aktuell.", 409);
      }
      const switched = await executeStampSessionSwitch({
        organizationId: binding.organizationId,
        userId: actor.id,
        actorName: [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email,
        change: {
          stop: loaded.context.stop.requested as StampSessionStopInput,
          start: loaded.context.start.requested as StampSessionStartInput,
        },
        expectedFingerprint: loaded.context.fingerprint,
        requestId: loaded.draft.id,
        source: "jarvis",
        now,
      });
      if (loaded.context.stop.requiresFinalInspection) {
        if (!loaded.payload.stop.finalInspectionMode) {
          throw new JarvisActionDraftError("invalid_input", "Die verpflichtende Endkontrolle ist noch nicht festgelegt.", 400);
        }
        const inspection = await createFinalInspection({
          organizationId: binding.organizationId,
          actorUserId: actor.id,
          actorName: [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email,
          inspection: {
            projectId: switched.stopped.projectId,
            projectLabel: switched.stopped.projectLabel,
            mode: loaded.payload.stop.finalInspectionMode,
            allChecksDone: loaded.payload.stop.allInspectionChecksDone,
            comment: loaded.payload.stop.comment,
            upsellNotes: loaded.payload.stop.upsellNotes,
          },
          requestId: `${loaded.draft.id}:final-inspection`,
          source: "jarvis",
          now,
        });
        await applyFinalInspectionBillingStatus({
          organizationId: binding.organizationId,
          projectId: switched.stopped.projectId,
          projectMonth: inspection.projectMonth,
          actorUserId: actor.id,
          actorName: [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email,
          requestId: `${loaded.draft.id}:billing-status`,
          source: "jarvis",
        });
      }
      if (loaded.context.stop.willAttachHourlyInvoiceDraft) {
        const attached = await attachStampEntryToHourlyInvoiceDraft({
          organizationId: binding.organizationId,
          entry: switched.stopped,
        });
        if (!attached) {
          throw new JarvisActionDraftError("conflict", "Die bisherige Stundenstempelung wurde gespeichert, konnte aber keinem sicheren Rechnungsentwurf zugeordnet werden. Der Wechsel kann gefahrlos erneut bestätigt werden.", 409);
        }
      }
      if (switched.stopped.completionStatus === "interrupted") {
        await ensureStampInterruptionFollowup({
          organizationId: binding.organizationId,
          entry: switched.stopped,
          interruptionReason: loaded.context.stop.effective.interruptionReason,
          now,
        });
      }
      const executed = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`jarvis-draft:${loaded.draft.id}`}, 0))`;
        const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } });
        if (!current) throw new JarvisActionDraftError("not_found", "Die Stempelaktion wurde nicht gefunden.", 404);
        validateStampSessionTransitionBinding(current, binding);
        if (current.state === "executed") return current;
        if (current.state !== "awaiting_confirmation" || current.revision !== expectedRevision) {
          throw new JarvisActionDraftError("conflict", "Die Stempelaktion ist nicht mehr ausführbar.", 409);
        }
        const executedData: DraftIntegrityData = {
          ...current,
          state: "executed",
          confirmedAt: now,
          executedAt: now,
          resultEntityType: "activeStampSession",
          resultEntityId: switched.started.id,
          lastErrorCode: null,
        };
        const finalDraft = await tx.jarvisActionDraft.update({
          where: { id: current.id },
          data: {
            state: "executed",
            confirmedAt: now,
            executedAt: now,
            resultEntityType: "activeStampSession",
            resultEntityId: switched.started.id,
            lastErrorCode: null,
            integrityTag: createIntegrityTag(executedData),
          },
        });
        await appendAuditEvent(tx, {
          draft: finalDraft,
          eventType: "draft_confirmed_and_executed",
          result: { id: switched.started.id, entityType: "activeStampSession" },
        });
        return finalDraft;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return toJarvisStampSessionTransitionDraftView(executed, binding);
    } catch (error) {
      if (error instanceof JarvisActionDraftError) throw error;
      if (error instanceof StampSessionServiceError || error instanceof FinalInspectionServiceError) {
        throw new JarvisActionDraftError(
          error.code === "stale_context" ? "stale_context" : error.code === "not_found" ? "not_found" : "conflict",
          error.message,
          error.status === 404 ? 404 : error.status === 400 ? 400 : 409,
        );
      }
      throw new JarvisActionDraftError("execution_failed", "Der Wechsel oder eine seiner sicheren Folgeaktionen konnte nicht vollständig verarbeitet werden. Eine Wiederholung ist gefahrlos möglich.", 500);
    }
  }
  if (loaded.payload.action === "stop" && loaded.context.action === "stop") {
    try {
      const actor = await prisma.user.findFirst({
        where: {
          id: loaded.draft.effectiveActorId,
          organizationId: binding.organizationId,
          isActive: true,
        },
      });
      if (!actor || actor.id !== loaded.draft.sessionActorId) {
        throw new JarvisActionDraftError(
          "role_changed",
          "Der persönliche Benutzerkontext ist nicht mehr aktuell.",
          409,
        );
      }
      const stopped = await executeStampSessionStop({
        organizationId: binding.organizationId,
        userId: actor.id,
        actorName: [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email,
        stop: loaded.context.requested as StampSessionStopInput,
        expectedFingerprint: loaded.context.fingerprint,
        requestId: loaded.draft.id,
        source: "jarvis",
        now,
      });
      if (loaded.context.requiresFinalInspection) {
        if (!loaded.payload.finalInspectionMode) {
          throw new JarvisActionDraftError("invalid_input", "Die verpflichtende Endkontrolle ist noch nicht festgelegt.", 400);
        }
        const inspection = await createFinalInspection({
          organizationId: binding.organizationId,
          actorUserId: actor.id,
          actorName: [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email,
          inspection: {
            projectId: stopped.entry.projectId,
            projectLabel: stopped.entry.projectLabel,
            mode: loaded.payload.finalInspectionMode,
            allChecksDone: loaded.payload.allInspectionChecksDone,
            comment: loaded.payload.comment,
            upsellNotes: loaded.payload.upsellNotes,
          },
          requestId: `${loaded.draft.id}:final-inspection`,
          source: "jarvis",
          now,
        });
        await applyFinalInspectionBillingStatus({
          organizationId: binding.organizationId,
          projectId: stopped.entry.projectId,
          projectMonth: inspection.projectMonth,
          actorUserId: actor.id,
          actorName: [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email,
          requestId: `${loaded.draft.id}:billing-status`,
          source: "jarvis",
        });
      }
      if (loaded.context.willAttachHourlyInvoiceDraft) {
        const attached = await attachStampEntryToHourlyInvoiceDraft({
          organizationId: binding.organizationId,
          entry: stopped.entry,
        });
        if (!attached) {
          throw new JarvisActionDraftError(
            "conflict",
            "Die Stundenstempelung wurde gespeichert, konnte aber keinem sicheren Rechnungsentwurf zugeordnet werden. Die Aktion kann gefahrlos erneut bestätigt werden.",
            409,
          );
        }
      }
      if (stopped.entry.completionStatus === "interrupted") {
        await ensureStampInterruptionFollowup({
          organizationId: binding.organizationId,
          entry: stopped.entry,
          interruptionReason: loaded.context.effective.interruptionReason,
          now,
        });
      }
      const executed = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`jarvis-draft:${loaded.draft.id}`}, 0))`;
        const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } });
        if (!current) throw new JarvisActionDraftError("not_found", "Die Stempelaktion wurde nicht gefunden.", 404);
        validateStampSessionTransitionBinding(current, binding);
        if (current.state === "executed") return current;
        if (current.state !== "awaiting_confirmation" || current.revision !== expectedRevision) {
          throw new JarvisActionDraftError("conflict", "Die Stempelaktion ist nicht mehr ausführbar.", 409);
        }
        const executedData: DraftIntegrityData = {
          ...current,
          state: "executed",
          confirmedAt: now,
          executedAt: now,
          resultEntityType: "projectTimeEntry",
          resultEntityId: stopped.entry.id,
          lastErrorCode: null,
        };
        const finalDraft = await tx.jarvisActionDraft.update({
          where: { id: current.id },
          data: {
            state: "executed",
            confirmedAt: now,
            executedAt: now,
            resultEntityType: "projectTimeEntry",
            resultEntityId: stopped.entry.id,
            lastErrorCode: null,
            integrityTag: createIntegrityTag(executedData),
          },
        });
        await appendAuditEvent(tx, {
          draft: finalDraft,
          eventType: "draft_confirmed_and_executed",
          result: { id: stopped.entry.id, entityType: "projectTimeEntry" },
        });
        return finalDraft;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return toJarvisStampSessionTransitionDraftView(executed, binding);
    } catch (error) {
      if (error instanceof JarvisActionDraftError) throw error;
      if (error instanceof StampSessionServiceError || error instanceof FinalInspectionServiceError) {
        throw new JarvisActionDraftError(
          error.code === "stale_context" ? "stale_context" : error.code === "not_found" ? "not_found" : "conflict",
          error.message,
          error.status === 404 ? 404 : error.status === 400 ? 400 : 409,
        );
      }
      throw new JarvisActionDraftError(
        "execution_failed",
        "Die Stempelung oder ihre Endkontrolle konnte nicht vollständig verarbeitet werden. Eine sichere Wiederholung ist möglich.",
        500,
      );
    }
  }
  try {
    const executed = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`jarvis-draft:${loaded.draft.id}`}, 0)
          )
        `;
        const current = await tx.jarvisActionDraft.findUnique({
          where: { id: loaded.draft.id },
        });
        if (!current) {
          throw new JarvisActionDraftError(
            "not_found",
            "Die Stempelaktion wurde nicht gefunden.",
            404
          );
        }
        const parsed = validateStampSessionTransitionBinding(current, binding);
        if (current.state === "executed") return current;
        if (
          current.state !== "awaiting_confirmation" ||
          current.revision !== expectedRevision ||
          current.expiresAt.getTime() <= now.getTime()
        ) {
          throw new JarvisActionDraftError(
            current.expiresAt.getTime() <= now.getTime()
              ? "expired"
              : "conflict",
            "Die Stempelaktion ist nicht mehr ausführbar.",
            current.expiresAt.getTime() <= now.getTime() ? 410 : 409
          );
        }
        const actor = await tx.user.findFirst({
          where: {
            id: current.effectiveActorId,
            organizationId: binding.organizationId,
            isActive: true,
          },
        });
        if (!actor || actor.id !== current.sessionActorId) {
          throw new JarvisActionDraftError(
            "role_changed",
            "Der persönliche Benutzerkontext ist nicht mehr aktuell.",
            409
          );
        }
        const result = parsed.payload.action === "start" && parsed.context.action === "start"
          ? { entityType: "activeStampSession" as const, entity: (await executeStampSessionStart({
              db: tx,
              organizationId: binding.organizationId,
              userId: actor.id,
              actorName: [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email,
              start: parsed.context.requested as StampSessionStartInput,
              expectedFingerprint: parsed.context.fingerprint,
              requestId: current.id,
              source: "jarvis",
              now,
            })).session }
          : parsed.payload.action === "stop" && parsed.context.action === "stop"
            ? { entityType: "projectTimeEntry" as const, entity: (await executeStampSessionStop({
                db: tx,
                organizationId: binding.organizationId,
                userId: actor.id,
                actorName: [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email,
                stop: parsed.context.requested as StampSessionStopInput,
                expectedFingerprint: parsed.context.fingerprint,
                requestId: current.id,
                source: "jarvis",
                now,
              })).entry }
          : (parsed.payload.action === "pause" || parsed.payload.action === "resume")
            && (parsed.context.action === "pause" || parsed.context.action === "resume")
            ? { entityType: "activeStampSession" as const, entity: await executeStampSessionTransition({
                db: tx,
                organizationId: binding.organizationId,
                userId: actor.id,
                action: parsed.payload.action,
                expectedFingerprint: parsed.context.fingerprint,
                now,
              }) }
            : (() => {
                throw new JarvisActionDraftError(
                  "integrity_failed",
                  "Stempelaktion und Fachkontext passen nicht zusammen.",
                  409
                );
              })();
        const executedData: DraftIntegrityData = {
          ...current,
          state: "executed",
          confirmedAt: now,
          executedAt: now,
          resultEntityType: result.entityType,
          resultEntityId: result.entity.id,
          lastErrorCode: null,
        };
        const finalDraft = await tx.jarvisActionDraft.update({
          where: { id: current.id },
          data: {
            state: "executed",
            confirmedAt: now,
            executedAt: now,
            resultEntityType: result.entityType,
            resultEntityId: result.entity.id,
            lastErrorCode: null,
            integrityTag: createIntegrityTag(executedData),
          },
        });
        await appendAuditEvent(tx, {
          draft: finalDraft,
          eventType: "draft_confirmed_and_executed",
          result: { id: result.entity.id, entityType: result.entityType },
        });
        return finalDraft;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return toJarvisStampSessionTransitionDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof StampSessionServiceError) {
      throw new JarvisActionDraftError(
        error.code === "stale_context" ? "stale_context" : error.code === "not_found" ? "not_found" : "conflict",
        error.message,
        error.status
      );
    }
    throw new JarvisActionDraftError(
      "execution_failed",
      "Die persönliche Stempelung wurde nicht verändert. Bitte den aktuellen Zustand neu prüfen.",
      500
    );
  }
}

async function expireDraftIfNeeded(
  draft: JarvisActionDraft,
  now: Date
): Promise<JarvisActionDraft> {
  if (
    !OPEN_DRAFT_STATES.includes(
      draft.state as (typeof OPEN_DRAFT_STATES)[number]
    ) ||
    draft.expiresAt.getTime() > now.getTime()
  ) {
    return draft;
  }
  return prisma.$transaction(async (tx) => {
    const nextData: DraftIntegrityData = {
      ...draft,
      state: "expired",
      lastErrorCode: "expired",
    };
    const integrityTag = createIntegrityTag(nextData);
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "expired",
        lastErrorCode: "expired",
        integrityTag,
      },
    });
    const current = await tx.jarvisActionDraft.findUnique({
      where: { id: draft.id },
    });
    if (!current) {
      throw new JarvisActionDraftError(
        "not_found",
        "Der Entwurf wurde nicht gefunden.",
        404
      );
    }
    if (changed.count === 1) {
      await appendAuditEvent(tx, {
        draft: current,
        eventType: "draft_expired",
        reasonCode: "ttl_elapsed",
      });
    }
    return current;
  });
}

async function loadBoundDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({
    where: { id: previewId },
  });
  if (!found) {
    throw new JarvisActionDraftError(
      "not_found",
      "Der Aufgabenentwurf wurde nicht gefunden.",
      404
    );
  }
  validateBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateBinding(current, binding);
  return { draft: current, ...parsed };
}

function validatePlanningBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Dieser Entwurf gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.",
      403
    );
  }
  if (
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role
  ) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Die Rolle hat sich seit Erstellung des Entwurfs geändert. Bitte erstelle eine neue Vorschau.",
      409
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Integritätsnachweis des Entwurfs ist ungültig. Es wurde nichts ausgeführt.",
      409
    );
  }
  const payload = planningPayloadSchema.safeParse(draft.payload);
  const context = taskContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "planning.prepare" ||
    !payload.success ||
    !context.success ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Termin-Payload oder Kontext stimmen nicht mit dem gespeicherten Nachweis überein.",
      409
    );
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundPlanningDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({
    where: { id: previewId },
  });
  if (!found) {
    throw new JarvisActionDraftError(
      "not_found",
      "Der Terminentwurf wurde nicht gefunden.",
      404
    );
  }
  validatePlanningBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validatePlanningBinding(current, binding);
  return { draft: current, ...parsed };
}

type PlanningAssigneeOption = {
  id: string;
  label: string;
  board: string;
  groupName: string;
};

async function getPlanningAssigneeOptions(
  binding: JarvisTaskDraftBinding
): Promise<PlanningAssigneeOption[]> {
  const actorId = getActorIds(binding.profile).effectiveActorId;
  const mayManage = canManagePlanningEntries(binding.profile.effectiveActor);
  const users = await prisma.user.findMany({
    where: {
      organizationId: binding.organizationId,
      isActive: true,
      ...(mayManage ? {} : { id: actorId }),
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      planningBoard: true,
      planningGroup: true,
    },
  });
  return users.map((user) => ({
    id: user.id,
    label: `${user.firstName} ${user.lastName}`.trim() || user.email,
    board: user.planningBoard?.trim() || "OK solutions",
    groupName: user.planningGroup?.trim() || "",
  }));
}

function berlinDateTimeParts(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    weekday: get("weekday"),
  };
}

function planningCheck(
  code: string,
  label: string,
  status: JarvisPlanningActionDraftCheck["status"],
  detail: string
): JarvisPlanningActionDraftCheck {
  return { code, label, status, detail };
}

async function evaluatePlanningDraft(
  payload: z.infer<typeof planningPayloadSchema>,
  context: z.infer<typeof taskContextSchema>,
  binding: JarvisTaskDraftBinding,
  draftId: string,
  now = new Date()
) {
  const checks: JarvisPlanningActionDraftCheck[] = [];
  const start = new Date(payload.startAt);
  const end = new Date(payload.endAt);
  const startParts = berlinDateTimeParts(payload.startAt);
  const endParts = berlinDateTimeParts(payload.endAt);
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  const timeValid =
    Number.isFinite(start.getTime()) &&
    Number.isFinite(end.getTime()) &&
    startParts.date === endParts.date &&
    durationMinutes > 0 &&
    durationMinutes <= 24 * 60 &&
    start.getTime() > now.getTime() &&
    start.getTime() <= now.getTime() + JARVIS_PLANNING_DRAFT_MAX_FUTURE_MS;
  checks.push(
    planningCheck(
      "date_time",
      "Datum und Zeit (Berlin)",
      timeValid ? "ok" : "blocked",
      timeValid
        ? `${startParts.date}, ${startParts.time}–${endParts.time} Uhr (${durationMinutes} Minuten).`
        : "Beginn und Ende müssen am selben Berliner Kalendertag, in der Zukunft und innerhalb von zwei Jahren liegen."
    )
  );

  const options = await getPlanningAssigneeOptions(binding);
  const assignees = payload.assigneeIds
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is PlanningAssigneeOption => Boolean(option));
  const assignee = assignees[0];
  const allAssigneesValid =
    assignees.length === payload.assigneeIds.length &&
    new Set(payload.assigneeIds).size === payload.assigneeIds.length;
  checks.push(
    planningCheck(
      "active_assignee",
      "Aktiver Mitarbeitender",
      allAssigneesValid ? "ok" : "blocked",
      allAssigneesValid
        ? `${assignees.map((entry) => entry.label).join(", ")} sind aktiv und mit der aktuellen Rolle auswählbar.`
        : "Mindestens eine gewählte Person ist in dieser Organisation nicht aktiv, doppelt oder mit der aktuellen Rolle nicht zulässig."
    )
  );
  const boardGroupValid =
    allAssigneesValid &&
    assignees.every((entry) => Boolean(entry.board && entry.groupName));
  checks.push(
    planningCheck(
      "board_group",
      "Planungsboard und -gruppe",
      boardGroupValid ? "ok" : "blocked",
      boardGroupValid
        ? assignees.map((entry) => `${entry.label}: ${entry.board} · ${entry.groupName}`).join("; ")
        : "Für mindestens eine gewählte Person fehlt eine eindeutige Planungsgruppe."
    )
  );

  const mayManage = canManagePlanningEntries(binding.profile.effectiveActor);
  const actorId = getActorIds(binding.profile).effectiveActorId;
  const roleValid =
    mayManage ||
    (payload.approvalStatus === "requested" &&
      payload.assigneeIds.length === 1 &&
      payload.assigneeIds[0] === actorId);
  checks.push(
    planningCheck(
      "role",
      payload.approvalStatus === "requested" ? "Terminwunsch" : "Bestätigter Termin",
      roleValid ? "ok" : "blocked",
      roleValid
        ? mayManage
          ? "Die aktuelle Rolle darf diesen Planungsstatus anlegen."
          : "Eigener Terminwunsch; eine Führungskraft muss ihn später bestätigen."
        : "Diese Rolle darf ausschließlich einen eigenen Terminwunsch anlegen."
    )
  );

  const project = await prisma.workPilotProject.findFirst({
    where: {
      id: payload.projectId,
      organizationId: binding.organizationId,
    },
    select: {
      id: true,
      projectNumber: true,
      title: true,
      updatedAt: true,
      projectKind: true,
      recurringBillingMode: true,
    },
  });
  const contextValid =
    Boolean(project) &&
    context.recordType === "project" &&
    context.recordId === project?.id &&
    context.recordUpdatedAt === project?.updatedAt.toISOString();
  checks.push(
    planningCheck(
      "project_context",
      "Projektbezug",
      contextValid ? "ok" : "blocked",
      contextValid && project
        ? `${project.projectNumber} · ${project.title}`
        : "Das Projekt fehlt, gehört nicht zur Organisation oder wurde seit der Vorschau verändert."
    )
  );

  let duplicate = false;
  let overlap = false;
  let absence: { type: string; dayPart: string } | null = null;
  if (assignee && timeValid) {
    const entries = await prisma.planningEntry.findMany({
      where: {
        organizationId: binding.organizationId,
        userId: assignee.id,
        date: startParts.date,
        deletedAt: null,
        id: { not: draftId },
      },
      select: {
        projectId: true,
        startTime: true,
        endTime: true,
        title: true,
      },
    });
    duplicate = entries.some((entry) => entry.projectId === payload.projectId);
    overlap = entries.some(
      (entry) =>
        entry.startTime < endParts.time && entry.endTime > startParts.time
    );
    absence = await prisma.absence.findFirst({
      where: {
        organizationId: binding.organizationId,
        userId: assignee.id,
        date: new Date(`${startParts.date}T00:00:00.000Z`),
        deletedAt: null,
        status: "genehmigt",
        type: { in: ["urlaub", "krank", "ueberstundenabbau"] },
        OR: [
          { dayPart: "full" },
          ...(startParts.time < "12:00" ? [{ dayPart: "first-half" }] : []),
          ...(endParts.time > "12:00" ? [{ dayPart: "second-half" }] : []),
        ],
      },
      select: { type: true, dayPart: true },
    });
  }
  checks.push(
    planningCheck(
      "duplicate",
      "Vorhandene Projektplanung",
      duplicate ? "blocked" : "ok",
      duplicate
        ? "Diese Person ist an diesem Tag bereits auf dieses Projekt geplant. Bitte den vorhandenen Termin bearbeiten."
        : "Keine gleichartige Projektplanung für diese Person an diesem Tag gefunden."
    )
  );
  checks.push(
    planningCheck(
      "overlap",
      "Zeitliche Überschneidung",
      overlap ? "warning" : "ok",
      overlap
        ? "Es gibt eine andere Planung im selben Zeitfenster. Der bestehende Planning-Service kennzeichnet dies als Warnung."
        : "Keine zeitliche Überschneidung gefunden."
    )
  );
  checks.push(
    planningCheck(
      "absence",
      "Genehmigte Abwesenheit",
      absence ? "blocked" : "ok",
      absence
        ? `Blockiert durch ${absence.type} (${absence.dayPart}).`
        : "Keine blockierende genehmigte Abwesenheit gefunden."
    )
  );

  const holidaySetting = await prisma.organizationSetting.findUnique({
    where: {
      organizationId_key: {
        organizationId: binding.organizationId,
        key: "holiday-state",
      },
    },
    select: { value: true },
  });
  const settingValue = holidaySetting?.value;
  const holidayState = normalizeGermanState(
    settingValue &&
      typeof settingValue === "object" &&
      !Array.isArray(settingValue) &&
      "state" in settingValue
      ? settingValue.state
      : undefined
  );
  const holiday = timeValid
    ? getGermanHoliday(startParts.date, holidayState)
    : null;
  checks.push(
    planningCheck(
      "holiday",
      `Feiertag (${holidayState})`,
      holiday ? "warning" : "ok",
      holiday ? `${holiday}; bewusste Planung erforderlich.` : "Kein gesetzlicher Feiertag."
    )
  );
  const weekend = startParts.weekday === "Sat" || startParts.weekday === "Sun";
  checks.push(
    planningCheck(
      "weekend",
      "Wochenende",
      weekend ? "warning" : "ok",
      weekend ? "Der Termin liegt am Wochenende." : "Der Termin liegt an einem Werktag."
    )
  );
  const variant = resolvePlanningActionVariant(project ?? {});
  const variantFieldsValid =
    Boolean(payload.note?.trim()) &&
    (variant !== "single" || Boolean(payload.offerId)) &&
    (variant !== "recurring_hourly" ||
      Boolean(payload.planningTrade?.trim() && payload.billingCatalogItemId)) &&
    (variant !== "single" || payload.recurrence.type === "once");
  checks.push(
    planningCheck(
      "project_variant_fields",
      "Projektartgerechte Terminmaske",
      variantFieldsValid ? "ok" : "blocked",
      variant === "single"
        ? variantFieldsValid
          ? "Beschreibung, finales Angebot, Ausführungsmonat und Angebotskontingent werden gemeinsam geprüft."
          : "Beschreibung und finales Angebot sind Pflicht; Einmalprojekte werden ohne Terminserie geplant."
        : variant === "recurring_hourly"
          ? variantFieldsValid
            ? "Beschreibung, Termin-Gewerk, Abrechnungsleistung, Mitarbeitende und Serienkontext sind vollständig."
            : "Beschreibung, Termin-Gewerk und Abrechnungsleistung sind für Stunden-Dauerläufer Pflicht."
          : variantFieldsValid
            ? "Beschreibung, Mitarbeitende sowie Monats- und Serienkontext werden gegen das Monatskontingent geprüft."
            : "Für die Monatspauschale ist eine Terminbeschreibung erforderlich."
    )
  );

  let batchEvaluation: PlanningBatchEvaluation | null = null;
  let sharedRequest: SharedPlanningRequest | null = null;
  if (project && context.recordUpdatedAt && variantFieldsValid && timeValid && allAssigneesValid) {
    const parsedRequest = sharedPlanningRequestSchema.safeParse({
      requestId: draftId,
      projectId: project.id,
      expectedProjectUpdatedAt: context.recordUpdatedAt,
      approvalStatus: payload.approvalStatus,
      assigneeIds: payload.assigneeIds,
      title: payload.title,
      description: payload.note,
      startAt: payload.startAt,
      endAt: payload.endAt,
      recurrence: payload.recurrence,
      ...(payload.offerId ? { offerId: payload.offerId } : {}),
      ...(payload.planningTrade ? { planningTrade: payload.planningTrade } : {}),
      ...(payload.billingCatalogItemId
        ? { billingCatalogItemId: payload.billingCatalogItemId }
        : {}),
      ...(payload.overbookingApproval
        ? { overbookingApproval: payload.overbookingApproval }
        : {}),
    });
    if (parsedRequest.success) {
      sharedRequest = parsedRequest.data;
      try {
        const [actor, organizationUsers] = await Promise.all([
          prisma.user.findFirst({
            where: { id: actorId, organizationId: binding.organizationId, isActive: true },
          }),
          prisma.user.findMany({
            where: { organizationId: binding.organizationId, isActive: true },
          }),
        ]);
        if (!actor) throw new Error("Aktiver JARVIS-Akteur nicht gefunden.");
        batchEvaluation = await evaluatePlanningBatch({
          organizationId: binding.organizationId,
          timezone: "Europe/Berlin",
          actor,
          users: organizationUsers,
          request: parsedRequest.data,
        });
        checks.push(
          planningCheck(
            "shared_planning_preflight",
            "Gemeinsamer Planning-Service",
            "ok",
            `${batchEvaluation.entryCount} Eintrag/Einträge für ${batchEvaluation.assignees.length} Mitarbeitende wurden serverseitig geprüft.`
          )
        );
      } catch (error) {
        checks.push(
          planningCheck(
            "shared_planning_preflight",
            "Gemeinsamer Planning-Service",
            "blocked",
            error instanceof Error ? error.message : "Die gemeinsame Planungsprüfung ist fehlgeschlagen."
          )
        );
      }
    }
  }

  if (batchEvaluation?.overbooking.required) {
    const approvalMatches =
      payload.overbookingApproval?.fingerprint ===
        batchEvaluation.overbooking.fingerprint &&
      (payload.overbookingApproval?.reason.trim().length ?? 0) >= 10;
    checks.push(
      planningCheck(
        "overbooking_confirmation",
        "Überplanung bewusst bestätigen",
        approvalMatches ? "warning" : "blocked",
        approvalMatches
          ? `Überplanung ist begründet: ${payload.overbookingApproval?.reason}`
          : batchEvaluation.overbooking.details
              .map(
                (detail) =>
                  `${detail.month}: ${detail.requestedMinutes} Min. geplant, ${detail.availableMinutes} Min. frei.`
              )
              .join(" ")
      )
    );
  } else if (batchEvaluation) {
    checks.push(
      planningCheck(
        "overbooking_confirmation",
        "Verfügbares Kontingent",
        "ok",
        "Die Planung bleibt innerhalb des aktuell verfügbaren Kontingents."
      )
    );
  }
  const [offerOptions, billingCatalogItemOptions] = project
    ? await Promise.all([
        prisma.offer?.findMany({
          where: {
            organizationId: binding.organizationId,
            projectId: project.id,
            status: {
              notIn: [
                "Entwurf",
                "Verloren",
                "Angebot verloren",
                "Gelöscht",
              ],
            },
            lines: { some: { laborItems: { some: { plannedHours: { gt: 0 } } } } },
          },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            offerNumber: true,
            plannedExecutionMonth: true,
          },
        }) ?? Promise.resolve([]),
        prisma.catalogItem?.findMany({
          where: {
            organizationId: binding.organizationId,
            isActive: true,
            isPlanningRelevant: true,
          },
          orderBy: { name: "asc" },
          select: { id: true, number: true, name: true },
        }) ?? Promise.resolve([]),
      ])
    : [[], []];

  return {
    checks,
    options,
    assignee,
    project,
    variant,
    batchEvaluation,
    offerOptions: offerOptions.map((offer) => ({
      id: offer.id,
      label: offer.offerNumber,
      executionMonth: offer.plannedExecutionMonth,
    })),
    billingCatalogItemOptions: billingCatalogItemOptions.map((item) => ({
      id: item.id,
      label: `${item.number} · ${item.name}`,
    })),
    executable: checks.every((check) => check.status !== "blocked"),
    executionInput:
      sharedRequest && batchEvaluation
        ? ({
            actorUserId: actorId,
            planning: sharedRequest,
          } satisfies JarvisPlanningExecutionInput)
        : null,
  };
}

async function getAssigneeOptions(
  binding: JarvisTaskDraftBinding
): Promise<Array<{ id: string; label: string }>> {
  const effectiveActorId = getActorIds(binding.profile).effectiveActorId;
  const mayAssignOthers = canAssignTasksToOthers(
    binding.profile.effectiveActor
  );
  const users = await prisma.user.findMany({
    where: {
      organizationId: binding.organizationId,
      isActive: true,
      ...(mayAssignOthers ? {} : { id: effectiveActorId }),
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });
  return users.map((user) => ({
    id: user.id,
    label:
      `${user.firstName} ${user.lastName}`.trim() ||
      user.email,
  }));
}

function formatDueAt(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export async function toJarvisTaskActionDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): Promise<JarvisTaskActionDraftView> {
  const { payload, context } = validateBinding(draft, binding);
  const assigneeOptions = await getAssigneeOptions(binding);
  const assignee = assigneeOptions.find(
    (option) => option.id === payload.assigneeId
  );
  const missingFields: string[] = [];
  if (!payload.assigneeId || !assignee) {
    missingFields.push("Verantwortliche Person");
  }
  if (!payload.dueAt) {
    missingFields.push("Fälligkeit");
  }

  const fields: JarvisTaskActionDraftView["fields"] = [
    { label: "Titel", value: payload.title },
  ];
  if (payload.description) {
    fields.push({ label: "Beschreibung", value: payload.description });
  }
  if (assignee) {
    fields.push({ label: "Verantwortlich", value: assignee.label });
  }
  if (payload.dueAt) {
    fields.push({ label: "Fällig", value: formatDueAt(payload.dueAt) });
  }
  if (context.recordLabel) {
    fields.push({ label: "Projektbezug", value: context.recordLabel });
  }

  const state = draft.state as JarvisTaskActionDraftView["state"];
  const isOpen =
    state === "awaiting_input" || state === "awaiting_confirmation";
  const isReady =
    state === "awaiting_confirmation" && missingFields.length === 0;
  const reason: JarvisTaskActionDraftView["confirmation"]["reason"] =
    state === "expired"
      ? "expired"
      : state === "cancelled"
        ? "cancelled"
        : state === "executed"
          ? "executed"
          : state === "executing"
            ? "executing"
          : isReady
            ? "ready"
            : "missing_fields";
  const badge: JarvisTaskActionDraftView["badge"] =
    state === "executed"
      ? "Angelegt"
      : state === "cancelled"
        ? "Abgebrochen"
      : state === "expired"
          ? "Abgelaufen"
          : state === "executing"
            ? "Wird angelegt"
          : isReady
            ? "Bereit"
            : "Entwurf";

  return {
    version: 2,
    previewId: draft.id,
    actionId: "task.prepare",
    title: "Aufgabe vorbereiten",
    badge,
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    fields,
    missingFields,
    editor: {
      description: payload.description ?? "",
      assigneeId: payload.assigneeId ?? "",
      dueAt: payload.dueAt ?? "",
      assigneeOptions,
    },
    confirmation: {
      enabled: isReady,
      reason,
    },
    cancellation: {
      enabled: isOpen,
    },
    execution: {
      enabled: false,
      reason: state === "executed" ? "finalized" : "requires_confirmation",
    },
    ...(state === "executed" &&
    draft.resultEntityType === "task" &&
    draft.resultEntityId
      ? {
          result: {
            entityType: "task" as const,
            entityId: draft.resultEntityId,
            label: "Angelegte Aufgabe öffnen",
          },
        }
      : {}),
  };
}

export async function createPersistedJarvisTaskDraft(
  input: CreateJarvisTaskDraftInput
) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für bestätigbare Aktionen ist eine aktuelle serverseitige Sitzung erforderlich.",
      401
    );
  }
  const now = input.now ?? new Date();
  const actorIds = getActorIds(input.profile);
  const payload = taskPayloadSchema.parse(input.preview.payload);
  let context: z.infer<typeof taskContextSchema> = {};
  if (
    input.context.recordType === "project" &&
    input.context.recordId &&
    payload.projectId === input.context.recordId
  ) {
    const project = await prisma.workPilotProject.findFirst({
      where: {
        id: input.context.recordId,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
        projectNumber: true,
        title: true,
        updatedAt: true,
      },
    });
    if (!project) {
      throw new JarvisActionDraftError(
        "stale_context",
        "Das verknüpfte Projekt ist nicht mehr eindeutig verfügbar.",
        409
      );
    }
    context = {
      recordType: "project",
      recordId: project.id,
      recordLabel: `${project.projectNumber} · ${project.title}`.slice(0, 240),
      recordUpdatedAt: project.updatedAt.toISOString(),
    };
  }

  const payloadHash = hashJson(payload);
  const contextHash = hashJson(context);
  const expiresAt = new Date(now.getTime() + JARVIS_TASK_DRAFT_TTL_MS);
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId,
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId: "task.prepare",
    state: "awaiting_input",
    revision: 1,
    payloadHash,
    contextHash,
    expiresAt,
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode: null,
  };
  const integrityTag = createIntegrityTag(draftData);

  const draft = await prisma.$transaction(async (tx) => {
    const created = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag,
      },
    });
    await appendAuditEvent(tx, {
      draft: created,
      eventType: "draft_created",
    });
    return created;
  });
  return toJarvisTaskActionDraftView(draft, input);
}

export async function getJarvisTaskDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundDraft(previewId, binding, now);
  return toJarvisTaskActionDraftView(draft, binding);
}

export async function completeJarvisTaskDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  rawInput: unknown,
  now = new Date()
) {
  const completed = completeDraftSchema.safeParse(rawInput);
  if (!completed.success) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Verantwortliche Person und gültige Fälligkeit sind erforderlich.",
      400
    );
  }
  const dueAt = new Date(completed.data.dueAt);
  if (
    dueAt.getTime() <= now.getTime() ||
    dueAt.getTime() > now.getTime() + JARVIS_TASK_DRAFT_MAX_FUTURE_MS
  ) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Die Fälligkeit muss in der Zukunft und innerhalb von fünf Jahren liegen.",
      400
    );
  }

  const { draft, payload, context } = await loadBoundDraft(
    previewId,
    binding,
    now
  );
  if (draft.revision !== completed.data.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Dieser Entwurf wurde zwischenzeitlich verändert. Bitte verwende den aktuellen Stand.",
      409
    );
  }
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) {
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "invalid_state",
      "Dieser Entwurf kann nicht mehr ergänzt werden.",
      draft.state === "expired" ? 410 : 409
    );
  }

  const options = await getAssigneeOptions(binding);
  if (!options.some((option) => option.id === completed.data.assigneeId)) {
    throw new JarvisActionDraftError(
      "assignee_forbidden",
      "Diese Person darf mit der aktuellen Rolle nicht als verantwortlich gewählt werden.",
      403
    );
  }
  const { description: _previousDescription, ...payloadWithoutDescription } =
    payload;
  const nextPayload = taskPayloadSchema.parse({
    ...payloadWithoutDescription,
    ...(completed.data.description
      ? { description: completed.data.description }
      : {}),
    assigneeId: completed.data.assigneeId,
    dueAt: dueAt.toISOString(),
  });
  const validation = createJarvisActionPreview({
    previewId: draft.id,
    actionId: "task.prepare",
    payload: nextPayload,
    organizationId: binding.organizationId,
    profile: binding.profile,
    createdAt: now.toISOString(),
  });
  if (!validation.ok) {
    throw new JarvisActionDraftError(
      "invalid_input",
      validation.message,
      400
    );
  }

  const payloadHash = hashJson(nextPayload);
  const revision = draft.revision + 1;
  const nextData: DraftIntegrityData = {
    ...draft,
    state: "awaiting_confirmation",
    revision,
    payloadHash,
    lastErrorCode: null,
  };
  const integrityTag = createIntegrityTag(nextData);
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "awaiting_confirmation",
        revision,
        payload: nextPayload as Prisma.InputJsonValue,
        payloadHash,
        integrityTag,
        lastErrorCode: null,
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Entwurf wurde zwischenzeitlich verändert. Bitte lade ihn neu.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_completed",
    });
    return current;
  });
  taskContextSchema.parse(context);
  return toJarvisTaskActionDraftView(updated, binding);
}

export async function cancelJarvisTaskDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const { draft } = await loadBoundDraft(previewId, binding, now);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) {
    if (draft.state === "cancelled") {
      return toJarvisTaskActionDraftView(draft, binding);
    }
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "invalid_state",
      "Dieser Entwurf kann nicht mehr abgebrochen werden.",
      draft.state === "expired" ? 410 : 409
    );
  }
  if (
    !Number.isSafeInteger(expectedRevision) ||
    draft.revision !== expectedRevision
  ) {
    throw new JarvisActionDraftError(
      "conflict",
      "Dieser Entwurf wurde zwischenzeitlich verändert. Bitte verwende den aktuellen Stand.",
      409
    );
  }
  const nextData: DraftIntegrityData = {
    ...draft,
    state: "cancelled",
    cancelledAt: now,
    lastErrorCode: null,
  };
  const integrityTag = createIntegrityTag(nextData);
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "cancelled",
        cancelledAt: now,
        lastErrorCode: null,
        integrityTag,
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Entwurf wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_cancelled",
      reasonCode: "user_cancelled",
    });
    return current;
  });
  return toJarvisTaskActionDraftView(cancelled, binding);
}

async function verifyCurrentProjectContext(
  tx: Prisma.TransactionClient,
  organizationId: string,
  context: z.infer<typeof taskContextSchema>
) {
  if (!context.recordId || !context.recordUpdatedAt) return;
  const project = await tx.workPilotProject.findFirst({
    where: {
      id: context.recordId,
      organizationId,
    },
    select: { updatedAt: true },
  });
  if (
    !project ||
    project.updatedAt.toISOString() !== context.recordUpdatedAt
  ) {
    throw new JarvisActionDraftError(
      "stale_context",
      "Das verknüpfte Projekt wurde seit der Vorschau geändert. Bitte erstelle den Entwurf neu.",
      409
    );
  }
}

function executionErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "JARVIS_ACTOR_STALE") return "actor_stale";
  if (message === "JARVIS_OWNER_INVALID") return "owner_invalid";
  if (message === "JARVIS_OWNER_FORBIDDEN") return "owner_forbidden";
  if (message === "JARVIS_PROJECT_STALE") return "project_stale";
  if (message === "JARVIS_DEADLINE_INVALID") return "deadline_invalid";
  if (message === "JARVIS_TITLE_INVALID") return "title_invalid";
  return "task_creation_failed";
}

async function recordExecutionFailure(
  draft: JarvisActionDraft,
  code: string
) {
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({
        where: { id: draft.id },
      });
      if (
        !current ||
        current.state !== "awaiting_confirmation" ||
        !integrityMatches(current)
      ) {
        return;
      }
      const nextData: DraftIntegrityData = {
        ...current,
        lastErrorCode: code,
      };
      const integrityTag = createIntegrityTag(nextData);
      const changed = await tx.jarvisActionDraft.updateMany({
        where: {
          id: current.id,
          revision: current.revision,
          state: "awaiting_confirmation",
          integrityTag: current.integrityTag,
        },
        data: {
          lastErrorCode: code,
          integrityTag,
        },
      });
      if (changed.count !== 1) return;
      const updated = await tx.jarvisActionDraft.findUniqueOrThrow({
        where: { id: current.id },
      });
      await appendAuditEvent(tx, {
        draft: updated,
        eventType: "execution_failed",
        reasonCode: code,
      });
    });
  } catch {
    // The original failure remains authoritative. Audit failure must not turn a
    // failed write into a reported success.
  }
}

export async function confirmJarvisTaskDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const loaded = await loadBoundDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") {
    return toJarvisTaskActionDraftView(loaded.draft, binding);
  }
  if (
    !Number.isSafeInteger(expectedRevision) ||
    loaded.draft.revision !== expectedRevision
  ) {
    throw new JarvisActionDraftError(
      "conflict",
      "Dieser Entwurf wurde zwischenzeitlich verändert. Bitte verwende den aktuellen Stand.",
      409
    );
  }
  if (loaded.draft.state !== "awaiting_confirmation") {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "invalid_state",
      "Nur ein vollständiger, offener Entwurf darf bestätigt werden.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  if (!loaded.payload.assigneeId || !loaded.payload.dueAt) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Verantwortliche Person und Fälligkeit fehlen.",
      400
    );
  }

  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({
        where: { id: loaded.draft.id },
      });
      if (!current) {
        throw new JarvisActionDraftError(
          "not_found",
          "Der Entwurf wurde nicht gefunden.",
          404
        );
      }
      const parsed = validateBinding(current, binding);
      if (current.state === "executed") return current;
      if (
        current.state !== "awaiting_confirmation" ||
        current.expiresAt.getTime() <= now.getTime()
      ) {
        throw new JarvisActionDraftError(
          current.expiresAt.getTime() <= now.getTime()
            ? "expired"
            : "conflict",
          "Der Entwurf ist nicht mehr ausführbar.",
          current.expiresAt.getTime() <= now.getTime() ? 410 : 409
        );
      }
      if (!parsed.payload.assigneeId || !parsed.payload.dueAt) {
        throw new JarvisActionDraftError(
          "invalid_input",
          "Der Entwurf ist unvollständig.",
          400
        );
      }
      await verifyCurrentProjectContext(
        tx,
        binding.organizationId,
        parsed.context
      );

      const confirmedData: DraftIntegrityData = {
        ...current,
        state: "executing",
        confirmedAt: now,
        lastErrorCode: null,
      };
      const confirmedTag = createIntegrityTag(confirmedData);
      const claimed = await tx.jarvisActionDraft.updateMany({
        where: {
          id: current.id,
          revision: current.revision,
          state: "awaiting_confirmation",
          integrityTag: current.integrityTag,
        },
        data: {
          state: "executing",
          confirmedAt: now,
          lastErrorCode: null,
          integrityTag: confirmedTag,
        },
      });
      if (claimed.count !== 1) {
        throw new JarvisActionDraftError(
          "conflict",
          "Der Entwurf wird bereits verarbeitet.",
          409
        );
      }

      const result = await createJarvisConfirmedTask(tx, {
        organizationId: binding.organizationId,
        previewId: current.id,
        payloadHash: current.payloadHash,
        actor: {
          id: current.effectiveActorId,
          role: current.effectiveActorRole as Role,
        },
        title: parsed.payload.title,
        description: parsed.payload.description,
        ownerId: parsed.payload.assigneeId,
        deadline: new Date(parsed.payload.dueAt),
        projectId: parsed.payload.projectId,
      });

      const executedAt = new Date();
      const executedData: DraftIntegrityData = {
        ...confirmedData,
        state: "executed",
        executedAt,
        resultEntityType: "task",
        resultEntityId: result.id,
      };
      const executedTag = createIntegrityTag(executedData);
      const finalDraft = await tx.jarvisActionDraft.update({
        where: { id: current.id },
        data: {
          state: "executed",
          executedAt,
          resultEntityType: "task",
          resultEntityId: result.id,
          integrityTag: executedTag,
        },
      });
      await appendAuditEvent(tx, {
        draft: finalDraft,
        eventType: "draft_confirmed_and_executed",
        result,
      });
      return finalDraft;
    });
    return toJarvisTaskActionDraftView(executed, binding);
  } catch (error) {
    if (
      error instanceof JarvisActionDraftError &&
      error.code === "conflict"
    ) {
      const latest = await loadBoundDraft(previewId, binding, now);
      if (latest.draft.state === "executed") {
        return toJarvisTaskActionDraftView(latest.draft, binding);
      }
    }
    await recordExecutionFailure(
      loaded.draft,
      executionErrorCode(error)
    );
    if (error instanceof JarvisActionDraftError) throw error;
    throw new JarvisActionDraftError(
      "execution_failed",
      "Die Aufgabe wurde nicht angelegt. Der Entwurf bleibt zur Prüfung erhalten.",
      500
    );
  }
}

export async function toJarvisPlanningActionDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding,
  now = new Date()
): Promise<JarvisPlanningActionDraftView> {
  const { payload, context } = validatePlanningBinding(draft, binding);
  const evaluation = await evaluatePlanningDraft(
    payload,
    context,
    binding,
    draft.id,
    now
  );
  const assignees = payload.assigneeIds
    .map((id) => evaluation.options.find((option) => option.id === id))
    .filter((option): option is PlanningAssigneeOption => Boolean(option));
  const missingFields = evaluation.checks
    .filter((check) => check.status === "blocked")
    .map((check) => check.label);
  const state = draft.state as JarvisPlanningActionDraftView["state"];
  const isOpen =
    state === "awaiting_input" || state === "awaiting_confirmation";
  const isReady =
    state === "awaiting_confirmation" && evaluation.executable;
  const reason: JarvisPlanningActionDraftView["confirmation"]["reason"] =
    state === "expired"
      ? "expired"
      : state === "cancelled"
        ? "cancelled"
        : state === "executed"
          ? "executed"
          : state === "executing"
            ? "executing"
            : isReady
              ? "ready"
              : "missing_fields";
  const badge: JarvisPlanningActionDraftView["badge"] =
    state === "executed"
      ? "Angelegt"
      : state === "executing"
        ? "Wird angelegt"
        : state === "cancelled"
          ? "Abgebrochen"
          : state === "expired"
            ? "Abgelaufen"
            : isReady
              ? "Bereit"
              : "Entwurf";
  const fields: JarvisPlanningActionDraftView["fields"] = [
    { label: "Titel", value: payload.title },
    {
      label:
        payload.approvalStatus === "requested" ? "Art" : "Status",
      value:
        payload.approvalStatus === "requested"
          ? "Terminwunsch"
          : "Bestätigter Termin",
    },
    {
      label: "Zeitfenster",
      value: `${formatDueAt(payload.startAt)} bis ${new Intl.DateTimeFormat(
        "de-DE",
        {
          timeZone: "Europe/Berlin",
          timeStyle: "short",
        }
      ).format(new Date(payload.endAt))} Uhr`,
    },
  ];
  if (assignees.length > 0) {
    fields.push({
      label: assignees.length === 1 ? "Mitarbeitend" : "Mitarbeitende",
      value: assignees.map((entry) => entry.label).join(", "),
    });
  }
  if (context.recordLabel) {
    fields.push({ label: "Projektbezug", value: context.recordLabel });
  }
  if (payload.note) fields.push({ label: "Beschreibung", value: payload.note });
  fields.push({
    label: "Projektart",
    value:
      evaluation.variant === "single"
        ? "Einmalprojekt"
        : evaluation.variant === "recurring_hourly"
          ? "Stunden-Dauerläufer"
          : "Monatspauschale",
  });
  if (evaluation.batchEvaluation?.offer) {
    fields.push({
      label: "Finales Angebot / Ausführung",
      value: `${evaluation.batchEvaluation.offer.label} · ${evaluation.batchEvaluation.offer.executionMonth}`,
    });
  }

  return {
    version: 2,
    previewId: draft.id,
    actionId: "planning.prepare",
    title:
      payload.approvalStatus === "requested"
        ? "Terminwunsch vorbereiten"
        : "Termin vorbereiten",
    badge,
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    fields,
    missingFields,
    checks: evaluation.checks,
    editor: {
      title: payload.title,
      note: payload.note ?? "",
      assigneeIds: payload.assigneeIds,
      startAt: payload.startAt,
      endAt: payload.endAt,
      approvalStatus: payload.approvalStatus,
      variant: evaluation.variant,
      offerId: payload.offerId ?? "",
      planningTrade: payload.planningTrade ?? "",
      billingCatalogItemId: payload.billingCatalogItemId ?? "",
      recurrence: {
        type: payload.recurrence.type,
        until: payload.recurrence.until ?? "",
        weekdays: payload.recurrence.weekdays,
      },
      overbooking: {
        required: Boolean(evaluation.batchEvaluation?.overbooking.required),
        fingerprint:
          evaluation.batchEvaluation?.overbooking.fingerprint ?? "",
        reason: payload.overbookingApproval?.reason ?? "",
        detail:
          evaluation.batchEvaluation?.overbooking.details
            .map(
              (detail) =>
                `${detail.month}: ${detail.requestedMinutes} Min. geplant, ${detail.availableMinutes} Min. frei`
            )
            .join("; ") ?? "",
      },
      approvalStatusOptions: canManagePlanningEntries(
        binding.profile.effectiveActor
      )
        ? [
            { value: "confirmed", label: "Bestätigter Termin" },
            { value: "requested", label: "Terminwunsch" },
          ]
        : [{ value: "requested", label: "Terminwunsch" }],
      assigneeOptions: evaluation.options.map(({ id, label }) => ({
        id,
        label,
      })),
      offerOptions: evaluation.offerOptions,
      billingCatalogItemOptions: evaluation.billingCatalogItemOptions,
    },
    confirmation: { enabled: isReady, reason },
    cancellation: { enabled: isOpen },
    execution: {
      enabled: false,
      reason: state === "executed" ? "finalized" : "requires_confirmation",
    },
    ...(state === "executed" &&
    draft.resultEntityType === "planning" &&
    draft.resultEntityId
      ? {
          result: {
            entityType: "planning" as const,
            entityId: draft.resultEntityId,
            label: "Angelegten Termin öffnen",
          },
        }
      : {}),
  };
}

export async function createPersistedJarvisPlanningDraft(
  input: CreateJarvisPlanningDraftInput
) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für bestätigbare Aktionen ist eine aktuelle serverseitige Sitzung erforderlich.",
      401
    );
  }
  const now = input.now ?? new Date();
  const actorIds = getActorIds(input.profile);
  const payload = planningPayloadSchema.parse(input.preview.payload);
  const project = await prisma.workPilotProject.findFirst({
    where: {
      id: payload.projectId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      projectNumber: true,
      title: true,
      updatedAt: true,
    },
  });
  if (!project) {
    throw new JarvisActionDraftError(
      "stale_context",
      "Das verknüpfte Projekt ist nicht mehr eindeutig verfügbar.",
      409
    );
  }
  if (
    input.context.recordType !== "project" ||
    input.context.recordId !== project.id
  ) {
    throw new JarvisActionDraftError(
      "stale_context",
      "Ein Terminentwurf benötigt den eindeutigen aktuellen Projektkontext.",
      409
    );
  }
  const context = taskContextSchema.parse({
    recordType: "project",
    recordId: project.id,
    recordLabel: `${project.projectNumber} · ${project.title}`.slice(0, 240),
    recordUpdatedAt: project.updatedAt.toISOString(),
  });
  const payloadHash = hashJson(payload);
  const contextHash = hashJson(context);
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId,
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId: "planning.prepare",
    state: "awaiting_confirmation",
    revision: 1,
    payloadHash,
    contextHash,
    expiresAt: new Date(now.getTime() + JARVIS_PLANNING_DRAFT_TTL_MS),
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode: null,
  };
  const draft = await prisma.$transaction(async (tx) => {
    const created = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag: createIntegrityTag(draftData),
      },
    });
    await appendAuditEvent(tx, {
      draft: created,
      eventType: "draft_created",
    });
    return created;
  });
  return toJarvisPlanningActionDraftView(draft, input, now);
}

export async function getJarvisPlanningDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundPlanningDraft(previewId, binding, now);
  return toJarvisPlanningActionDraftView(draft, binding, now);
}

type CommunicationActionId =
  | "project-logbook.prepare"
  | "task-comment.prepare";

function validateCommunicationBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Dieser Entwurf gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.",
      403
    );
  }
  if (
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role
  ) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Die Rolle hat sich seit Erstellung des Entwurfs geändert. Bitte erstelle eine neue Vorschau.",
      409
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Integritätsnachweis des Entwurfs ist ungültig. Es wurde nichts ausgeführt.",
      409
    );
  }
  const payload = communicationPayloadSchema.safeParse(draft.payload);
  const context = communicationContextSchema.safeParse(draft.context);
  if (
    !["project-logbook.prepare", "task-comment.prepare"].includes(
      draft.actionId
    ) ||
    !payload.success ||
    !context.success ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Logbuch-/Kommentar-Payload oder Kontext stimmen nicht mit dem gespeicherten Nachweis überein.",
      409
    );
  }
  return {
    actionId: draft.actionId as CommunicationActionId,
    payload: payload.data,
    context: context.data,
  };
}

async function loadBoundCommunicationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({
    where: { id: previewId },
  });
  if (!found) {
    throw new JarvisActionDraftError(
      "not_found",
      "Der Logbuch-/Kommentarentwurf wurde nicht gefunden.",
      404
    );
  }
  validateCommunicationBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateCommunicationBinding(current, binding);
  return { draft: current, ...parsed };
}

function communicationAuthorities(binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  const values = [
    {
      id: actorIds.sessionActorId,
      role: binding.profile.sessionActor.role,
    },
    {
      id: actorIds.effectiveActorId,
      role: binding.profile.effectiveActor.role,
    },
  ];
  return values.filter(
    (actor, index) =>
      values.findIndex((candidate) => candidate.id === actor.id) === index
  );
}

async function getCommunicationTargetOptions(
  actionId: CommunicationActionId,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = communicationAuthorities(binding).map((actor) => actor.id);
  if (actionId === "project-logbook.prepare") {
    const projects = await prisma.workPilotProject.findMany({
      where: { organizationId: binding.organizationId },
      orderBy: [{ projectNumber: "asc" }, { title: "asc" }],
      select: {
        id: true,
        projectNumber: true,
        title: true,
        status: true,
        updatedAt: true,
      },
      take: 1000,
    });
    const allMayArchive = communicationAuthorities(binding).every((actor) =>
      canArchiveProjects(actor)
    );
    return projects
      .filter(
        (project) =>
          allMayArchive ||
          !project.status.toLocaleLowerCase("de-DE").includes("archiviert")
      )
      .map((project) => ({
        id: project.id,
        label:
          [project.projectNumber, project.title].filter(Boolean).join(" · ") ||
          "Projekt",
        updatedAt: project.updatedAt.toISOString(),
      }));
  }

  const tasks = await prisma.task.findMany({
    where: {
      organizationId: binding.organizationId,
      status: { not: "ARCHIVIERT" },
    },
    include: {
      participants: {
        select: { userId: true },
      },
    },
    orderBy: [{ deadline: "asc" }, { title: "asc" }],
    take: 1000,
  });
  return tasks
    .filter((task) => {
      const participantIds = task.participants.map(
        (participant) => participant.userId
      );
      return actorIds.every(
        (actorId) =>
          task.ownerId === actorId ||
          task.createdById === actorId ||
          participantIds.includes(actorId)
      );
    })
    .map((task) => ({
      id: task.id,
      label: task.title,
      updatedAt: task.updatedAt.toISOString(),
    }));
}

async function getCommunicationRecipientOptions(
  taskId: string | undefined,
  binding: JarvisTaskDraftBinding
) {
  if (!taskId) return [];
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      organizationId: binding.organizationId,
    },
    select: {
      participants: {
        select: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              isActive: true,
            },
          },
        },
      },
    },
  });
  return (task?.participants ?? [])
    .map((participant) => participant.user)
    .filter((user) => user.isActive)
    .map((user) => ({
      id: user.id,
      label: `${user.firstName} ${user.lastName}`.trim() || user.email,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "de"));
}

function communicationReady(
  actionId: CommunicationActionId,
  payload: z.infer<typeof communicationPayloadSchema>
) {
  return Boolean(
    payload.targetId &&
      payload.text &&
      (actionId === "task-comment.prepare" || payload.title)
  );
}

export async function toJarvisCommunicationActionDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): Promise<JarvisCommunicationActionDraftView> {
  const { actionId, payload } = validateCommunicationBinding(draft, binding);
  const targetOptions = await getCommunicationTargetOptions(actionId, binding);
  const selectedTarget = targetOptions.find(
    (option) => option.id === payload.targetId
  );
  const recipientOptions =
    actionId === "task-comment.prepare"
      ? await getCommunicationRecipientOptions(payload.targetId, binding)
      : [];
  const selectedRecipient = recipientOptions.find(
    (option) => option.id === payload.recipientUserId
  );
  const missingFields: string[] = [];
  if (!selectedTarget) {
    missingFields.push(actionId === "project-logbook.prepare" ? "Projekt" : "Aufgabe");
  }
  if (!payload.text) missingFields.push("Text");
  if (actionId === "project-logbook.prepare" && !payload.title) {
    missingFields.push("Titel");
  }
  if (payload.recipientUserId && !selectedRecipient) {
    missingFields.push("Gültige empfangende Person");
  }

  const state = draft.state as JarvisCommunicationActionDraftView["state"];
  const isOpen =
    state === "awaiting_input" || state === "awaiting_confirmation";
  const isReady =
    state === "awaiting_confirmation" && missingFields.length === 0;
  const reason: JarvisCommunicationActionDraftView["confirmation"]["reason"] =
    state === "expired"
      ? "expired"
      : state === "cancelled"
        ? "cancelled"
        : state === "executed"
          ? "executed"
          : state === "executing"
            ? "executing"
            : isReady
              ? "ready"
              : "missing_fields";
  const badge: JarvisCommunicationActionDraftView["badge"] =
    state === "executed"
      ? "Gespeichert"
      : state === "cancelled"
        ? "Abgebrochen"
        : state === "expired"
          ? "Abgelaufen"
          : state === "executing"
            ? "Wird gespeichert"
            : isReady
              ? "Bereit"
              : "Entwurf";
  const fields: JarvisCommunicationActionDraftView["fields"] = [];
  if (selectedTarget) {
    fields.push({
      label: actionId === "project-logbook.prepare" ? "Projekt" : "Aufgabe",
      value: selectedTarget.label,
    });
  }
  if (actionId === "project-logbook.prepare" && payload.title) {
    fields.push({ label: "Titel", value: payload.title });
  }
  if (payload.text) fields.push({ label: "Text", value: payload.text });
  if (selectedRecipient) {
    fields.push({ label: "Gerichtet an", value: selectedRecipient.label });
  }

  return {
    version: 2,
    previewId: draft.id,
    actionId,
    title:
      actionId === "project-logbook.prepare"
        ? "Projektlogbuch-Eintrag vorbereiten"
        : "Aufgabenkommentar vorbereiten",
    badge,
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    fields,
    missingFields,
    editor: {
      targetId: payload.targetId ?? "",
      title: payload.title ?? "",
      text: payload.text ?? "",
      recipientUserId: payload.recipientUserId ?? "",
      targetOptions: targetOptions.map(({ id, label }) => ({ id, label })),
      recipientOptions,
    },
    confirmation: { enabled: isReady, reason },
    cancellation: { enabled: isOpen },
    execution: {
      enabled: false,
      reason: state === "executed" ? "finalized" : "requires_confirmation",
    },
    ...(state === "executed" &&
    draft.resultEntityId &&
    payload.targetId &&
    (draft.resultEntityType === "projectLogbookEntry" ||
      draft.resultEntityType === "taskComment")
      ? {
          result: {
            entityType: draft.resultEntityType,
            entityId: draft.resultEntityId,
            targetId: payload.targetId,
            label:
              draft.resultEntityType === "projectLogbookEntry"
                ? "Projektlogbuch öffnen"
                : "Aufgabe öffnen",
          },
        }
      : {}),
  };
}

export async function createPersistedJarvisCommunicationDraft(
  input: CreateJarvisCommunicationDraftInput
) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für bestätigbare Aktionen ist eine aktuelle serverseitige Sitzung erforderlich.",
      401
    );
  }
  const now = input.now ?? new Date();
  const actorIds = getActorIds(input.profile);
  const actionId = input.preview.actionId;
  const payload = communicationPayloadSchema.parse(
    actionId === "project-logbook.prepare"
      ? {
          targetId: (
            input.preview
              .payload as JarvisActionPreviewPayloadMap["project-logbook.prepare"]
          ).projectId,
          title:
            (
              input.preview
                .payload as JarvisActionPreviewPayloadMap["project-logbook.prepare"]
            ).title || "JARVIS-Eintrag",
          text: (
            input.preview
              .payload as JarvisActionPreviewPayloadMap["project-logbook.prepare"]
          ).text,
        }
      : {
          targetId: (
            input.preview
              .payload as JarvisActionPreviewPayloadMap["task-comment.prepare"]
          ).taskId,
          text: (
            input.preview
              .payload as JarvisActionPreviewPayloadMap["task-comment.prepare"]
          ).text,
          recipientUserId: (
            input.preview
              .payload as JarvisActionPreviewPayloadMap["task-comment.prepare"]
          ).recipientUserId,
        }
  );
  const options = await getCommunicationTargetOptions(actionId, input);
  const selected = options.find((option) => option.id === payload.targetId);
  if (payload.targetId && !selected) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Das angegebene Ziel ist mit der aktuellen Rollenkombination nicht kommentierbar.",
      403
    );
  }
  const context: z.infer<typeof communicationContextSchema> = selected
    ? { targetId: selected.id, targetUpdatedAt: selected.updatedAt }
    : {};
  const payloadHash = hashJson(payload);
  const contextHash = hashJson(context);
  const expiresAt = new Date(
    now.getTime() + JARVIS_COMMUNICATION_DRAFT_TTL_MS
  );
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId,
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId,
    state: communicationReady(actionId, payload)
      ? "awaiting_confirmation"
      : "awaiting_input",
    revision: 1,
    payloadHash,
    contextHash,
    expiresAt,
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode: null,
  };
  const draft = await prisma.$transaction(async (tx) => {
    const created = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag: createIntegrityTag(draftData),
      },
    });
    await appendAuditEvent(tx, {
      draft: created,
      eventType: "draft_created",
    });
    return created;
  });
  return toJarvisCommunicationActionDraftView(draft, input);
}

export async function getJarvisCommunicationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundCommunicationDraft(
    previewId,
    binding,
    now
  );
  return toJarvisCommunicationActionDraftView(draft, binding);
}

export async function completeJarvisCommunicationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  rawInput: unknown,
  now = new Date()
) {
  const completed = completeCommunicationDraftSchema.safeParse(rawInput);
  if (!completed.success) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Die Logbuch-/Kommentarangaben sind ungültig oder zu lang.",
      400
    );
  }
  const loaded = await loadBoundCommunicationDraft(previewId, binding, now);
  if (!OPEN_DRAFT_STATES.includes(loaded.draft.state as typeof OPEN_DRAFT_STATES[number])) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "invalid_state",
      "Dieser Entwurf kann nicht mehr bearbeitet werden.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  if (loaded.draft.revision !== completed.data.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Dieser Entwurf wurde zwischenzeitlich geändert. Bitte verwende den aktuellen Stand.",
      409
    );
  }
  const payload = communicationPayloadSchema.parse({
    targetId: completed.data.targetId,
    title:
      loaded.actionId === "project-logbook.prepare"
        ? completed.data.title || "JARVIS-Eintrag"
        : undefined,
    text: completed.data.text,
    recipientUserId:
      loaded.actionId === "task-comment.prepare"
        ? completed.data.recipientUserId
        : undefined,
  });
  const options = await getCommunicationTargetOptions(
    loaded.actionId,
    binding
  );
  const selected = options.find((option) => option.id === payload.targetId);
  if (payload.targetId && !selected) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Das ausgewählte Ziel ist nicht mehr kommentierbar.",
      403
    );
  }
  if (payload.recipientUserId) {
    const recipients = await getCommunicationRecipientOptions(
      payload.targetId,
      binding
    );
    if (!recipients.some((recipient) => recipient.id === payload.recipientUserId)) {
      throw new JarvisActionDraftError(
        "invalid_input",
        "Die ausgewählte empfangende Person ist nicht an dieser Aufgabe beteiligt.",
        400
      );
    }
  }
  const context: z.infer<typeof communicationContextSchema> = selected
    ? { targetId: selected.id, targetUpdatedAt: selected.updatedAt }
    : {};
  const state = communicationReady(loaded.actionId, payload)
    ? "awaiting_confirmation"
    : "awaiting_input";
  const nextData: DraftIntegrityData = {
    ...loaded.draft,
    state,
    revision: loaded.draft.revision + 1,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    confirmedAt: null,
    lastErrorCode: null,
  };
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: loaded.draft.id,
        revision: loaded.draft.revision,
        state: loaded.draft.state,
        integrityTag: loaded.draft.integrityTag,
      },
      data: {
        state,
        revision: nextData.revision,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        payloadHash: nextData.payloadHash,
        contextHash: nextData.contextHash,
        confirmedAt: null,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Entwurf wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: loaded.draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_completed",
    });
    return current;
  });
  return toJarvisCommunicationActionDraftView(updated, binding);
}

export async function cancelJarvisCommunicationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const loaded = await loadBoundCommunicationDraft(previewId, binding, now);
  if (loaded.draft.state === "cancelled") {
    return toJarvisCommunicationActionDraftView(loaded.draft, binding);
  }
  if (
    !OPEN_DRAFT_STATES.includes(
      loaded.draft.state as typeof OPEN_DRAFT_STATES[number]
    ) ||
    loaded.draft.revision !== expectedRevision
  ) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "conflict",
      "Dieser Entwurf kann nicht mehr abgebrochen werden.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  const nextData: DraftIntegrityData = {
    ...loaded.draft,
    state: "cancelled",
    cancelledAt: now,
    lastErrorCode: null,
  };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: loaded.draft.id,
        revision: loaded.draft.revision,
        state: loaded.draft.state,
        integrityTag: loaded.draft.integrityTag,
      },
      data: {
        state: "cancelled",
        cancelledAt: now,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Entwurf wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: loaded.draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_cancelled",
      reasonCode: "user_cancelled",
    });
    return current;
  });
  return toJarvisCommunicationActionDraftView(cancelled, binding);
}

function communicationExecutionErrorCode(error: unknown) {
  if (error instanceof ProjectLogbookServiceError) return error.code;
  if (error instanceof TaskCommentServiceError) return error.code;
  return "communication_write_failed";
}

export async function confirmJarvisCommunicationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const loaded = await loadBoundCommunicationDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") {
    return toJarvisCommunicationActionDraftView(loaded.draft, binding);
  }
  if (
    loaded.draft.state !== "awaiting_confirmation" ||
    loaded.draft.revision !== expectedRevision ||
    !communicationReady(loaded.actionId, loaded.payload)
  ) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "conflict",
      "Nur ein vollständiger, aktueller Entwurf darf bestätigt werden.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }

  try {
    const execution = await prisma.$transaction(
      async (tx) => {
        const current = await tx.jarvisActionDraft.findUnique({
          where: { id: loaded.draft.id },
        });
        if (!current) {
          throw new JarvisActionDraftError(
            "not_found",
            "Der Entwurf wurde nicht gefunden.",
            404
          );
        }
        const parsed = validateCommunicationBinding(current, binding);
        if (current.state === "executed") {
          return {
            draft: current,
            mailNotifications: [] as TaskCommentMailNotification[],
          };
        }
        if (
          current.state !== "awaiting_confirmation" ||
          current.revision !== expectedRevision ||
          current.expiresAt.getTime() <= now.getTime() ||
          !parsed.payload.targetId ||
          !parsed.payload.text
        ) {
          throw new JarvisActionDraftError(
            current.expiresAt.getTime() <= now.getTime()
              ? "expired"
              : "conflict",
            "Der Entwurf ist nicht mehr ausführbar.",
            current.expiresAt.getTime() <= now.getTime() ? 410 : 409
          );
        }

        const target =
          parsed.actionId === "project-logbook.prepare"
            ? await tx.workPilotProject.findFirst({
                where: {
                  id: parsed.payload.targetId,
                  organizationId: binding.organizationId,
                },
                select: { updatedAt: true },
              })
            : await tx.task.findFirst({
                where: {
                  id: parsed.payload.targetId,
                  organizationId: binding.organizationId,
                },
                select: { updatedAt: true },
              });
        if (
          !target ||
          !parsed.context.targetUpdatedAt ||
          target.updatedAt.toISOString() !== parsed.context.targetUpdatedAt
        ) {
          throw new JarvisActionDraftError(
            "stale_context",
            "Das Ziel wurde seit der letzten Prüfung geändert. Bitte prüfe den Entwurf erneut.",
            409
          );
        }

        const claimedData: DraftIntegrityData = {
          ...current,
          state: "executing",
          confirmedAt: now,
          lastErrorCode: null,
        };
        const claimed = await tx.jarvisActionDraft.updateMany({
          where: {
            id: current.id,
            revision: current.revision,
            state: "awaiting_confirmation",
            integrityTag: current.integrityTag,
          },
          data: {
            state: "executing",
            confirmedAt: now,
            lastErrorCode: null,
            integrityTag: createIntegrityTag(claimedData),
          },
        });
        if (claimed.count !== 1) {
          throw new JarvisActionDraftError(
            "conflict",
            "Der Entwurf wird bereits verarbeitet.",
            409
          );
        }

        const authorities = communicationAuthorities(binding);
        let result: {
          id: string;
          entityType: "projectLogbookEntry" | "taskComment";
        };
        let mailNotifications: TaskCommentMailNotification[] = [];
        if (parsed.actionId === "project-logbook.prepare") {
          if (!parsed.payload.title) {
            throw new JarvisActionDraftError(
              "invalid_input",
              "Der Titel des Logbucheintrags fehlt.",
              400
            );
          }
          const created = await createProjectLogbookEntry(tx, {
            organizationId: binding.organizationId,
            projectId: parsed.payload.targetId,
            authority: authorities,
            authorUserId: current.effectiveActorId,
            title: parsed.payload.title,
            body: parsed.payload.text,
            source: "jarvis",
            callReference: current.id,
            confirmedByUserId: current.sessionActorId,
            confirmationTimestamp: now,
          });
          result = {
            id: created.entry.id,
            entityType: "projectLogbookEntry",
          };
        } else {
          const created = await createTaskComment(tx, {
            organizationId: binding.organizationId,
            taskId: parsed.payload.targetId,
            authority: authorities,
            authorUserId: current.effectiveActorId,
            text: parsed.payload.text,
            recipientUserId: parsed.payload.recipientUserId,
            source: "jarvis",
            previewId: current.id,
            payloadHash: current.payloadHash,
          });
          result = { id: created.comment.id, entityType: "taskComment" };
          mailNotifications = created.mailNotifications;
        }

        const executedAt = new Date();
        const executedData: DraftIntegrityData = {
          ...claimedData,
          state: "executed",
          executedAt,
          resultEntityType: result.entityType,
          resultEntityId: result.id,
        };
        const finalDraft = await tx.jarvisActionDraft.update({
          where: { id: current.id },
          data: {
            state: "executed",
            executedAt,
            resultEntityType: result.entityType,
            resultEntityId: result.id,
            integrityTag: createIntegrityTag(executedData),
          },
        });
        await appendAuditEvent(tx, {
          draft: finalDraft,
          eventType: "draft_confirmed_and_executed",
          result,
        });
        return { draft: finalDraft, mailNotifications };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    if (execution.mailNotifications.length) {
      await deliverTaskCommentNotificationMails(execution.mailNotifications);
    }
    return toJarvisCommunicationActionDraftView(execution.draft, binding);
  } catch (error) {
    if (
      error instanceof JarvisActionDraftError &&
      error.code === "conflict"
    ) {
      const latest = await loadBoundCommunicationDraft(
        previewId,
        binding,
        now
      );
      if (latest.draft.state === "executed") {
        return toJarvisCommunicationActionDraftView(latest.draft, binding);
      }
    }
    await recordExecutionFailure(
      loaded.draft,
      communicationExecutionErrorCode(error)
    );
    if (error instanceof JarvisActionDraftError) throw error;
    if (
      error instanceof ProjectLogbookServiceError ||
      error instanceof TaskCommentServiceError
    ) {
      throw new JarvisActionDraftError(
        error.code === "actor_stale" ? "role_changed" : "execution_failed",
        `${error.message} Es wurde nichts gespeichert.`,
        error.code === "actor_stale" ? 409 : 403
      );
    }
    throw new JarvisActionDraftError(
      "execution_failed",
      "Der Logbuch-/Kommentarentwurf wurde nicht gespeichert und bleibt zur Prüfung erhalten.",
      500
    );
  }
}

export async function getJarvisActionDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const draft = await prisma.jarvisActionDraft.findUnique({
    where: { id: previewId },
    select: { actionId: true },
  });
  if (draft?.actionId === "planning.prepare") {
    return getJarvisPlanningDraft(previewId, binding, now);
  }
  if (draft?.actionId === "time.prepare") {
    return getJarvisTimeDraft(previewId, binding, now);
  }
  if (draft?.actionId === "time.session.manage") {
    return getJarvisStampSessionTransitionDraft(previewId, binding, now);
  }
  if (draft?.actionId === "winter-calculation.prepare") {
    return getJarvisWinterCalculationDraft(previewId, binding, now);
  }
  if (draft?.actionId === "vehicle-trip-calculation.prepare") {
    return getJarvisVehicleTripCalculationDraft(
      previewId,
      binding,
      now
    );
  }
  if (draft?.actionId === "offer.prepare") {
    return getJarvisOfferDraft(previewId, binding, now);
  }
  if (draft?.actionId === "invoice.prepare") {
    return getJarvisInvoiceDraft(previewId, binding, now);
  }
  if (draft?.actionId === "offer.finalize") {
    return getJarvisOfferFinalizationDraft(previewId, binding, now);
  }
  if (draft?.actionId === "offer.send") {
    return getJarvisOfferDeliveryDraft(previewId, binding, now);
  }
  if (draft?.actionId === "offer.manage") {
    return getJarvisOfferDecisionDraft(previewId, binding, now);
  }
  if (draft?.actionId === "offer.delete") {
    return getJarvisOfferLifecycleDraft(previewId, binding, now);
  }
  if (draft?.actionId === "invoice.delete") {
    return getJarvisInvoiceLifecycleDraft(previewId, binding, now);
  }
  if (draft?.actionId === "task.delete") {
    return getJarvisTaskLifecycleDraft(previewId, binding, now);
  }
  if (draft?.actionId === "project.manage") {
    return getJarvisProjectMasterDataDraft(previewId, binding, now);
  }
  if (draft?.actionId === "contact.manage") {
    return getJarvisContactManagementDraft(previewId, binding, now);
  }
  if (draft?.actionId === "contact.delete") {
    return getJarvisContactDeletionDraft(previewId, binding, now);
  }
  if (draft?.actionId === "catalog.manage") {
    return getJarvisCatalogManagementDraft(previewId, binding, now);
  }
  if (draft?.actionId === "personnel.manage") {
    return getJarvisPersonnelManagementDraft(previewId, binding, now);
  }
  if (draft?.actionId === "payroll.manage") {
    return getJarvisEmployeeCostManagementDraft(previewId, binding, now);
  }
  if (draft?.actionId === "bulk.update") {
    return getJarvisBulkUpdateDraft(previewId, binding, now);
  }
  if (draft?.actionId === "automation.manage") {
    return getJarvisAutomationManagementDraft(previewId, binding, now);
  }
  if (draft?.actionId === "project.status.change") {
    return getJarvisProjectStatusDraft(previewId, binding, now);
  }
  if (draft?.actionId === "project.archive") {
    return getJarvisProjectLifecycleDraft(previewId, binding, now);
  }
  if (draft?.actionId === "online-request.convert") {
    return getJarvisOnlineRequestConversionDraft(previewId, binding, now);
  }
  if (draft?.actionId === "invoice.finalize") {
    return getJarvisInvoiceFinalizationDraft(previewId, binding, now);
  }
  if (draft?.actionId === "invoice.mark-paid") {
    return getJarvisInvoicePaymentDraft(previewId, binding, now);
  }
  if (draft?.actionId === "invoice.remind") {
    return getJarvisInvoiceReminderDraft(previewId, binding, now);
  }
  if (draft?.actionId === "invoice.cancel") {
    return getJarvisInvoiceCancellationDraft(previewId, binding, now);
  }
  if (draft?.actionId === "invoice.credit") {
    return getJarvisInvoiceCreditDraft(previewId, binding, now);
  }
  if (draft?.actionId === "document.send") {
    return getJarvisInvoiceDeliveryDraft(previewId, binding, now);
  }
  if (
    draft?.actionId === "project-logbook.prepare" ||
    draft?.actionId === "task-comment.prepare"
  ) {
    return getJarvisCommunicationDraft(previewId, binding, now);
  }
  return getJarvisTaskDraft(previewId, binding, now);
}

export async function completeJarvisPlanningDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  rawInput: unknown,
  now = new Date()
) {
  const completed = completePlanningDraftSchema.safeParse(rawInput);
  if (!completed.success) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Titel, Person, Terminart sowie ein gültiger Beginn und ein gültiges Ende sind erforderlich.",
      400
    );
  }
  const parsedPayload = planningPayloadSchema.safeParse({
    title: completed.data.title,
    note: completed.data.note,
    assigneeIds: completed.data.assigneeIds,
    startAt: completed.data.startAt,
    endAt: completed.data.endAt,
    approvalStatus: completed.data.approvalStatus,
    recurrence: completed.data.recurrence,
    ...(completed.data.offerId ? { offerId: completed.data.offerId } : {}),
    ...(completed.data.planningTrade
      ? { planningTrade: completed.data.planningTrade }
      : {}),
    ...(completed.data.billingCatalogItemId
      ? { billingCatalogItemId: completed.data.billingCatalogItemId }
      : {}),
    projectId: "temporary",
  });
  if (!parsedPayload.success) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Das Terminende muss nach dem Beginn liegen; beide Werte benötigen eine eindeutige Zeitzone.",
      400
    );
  }
  const loaded = await loadBoundPlanningDraft(previewId, binding, now);
  if (loaded.draft.revision !== completed.data.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Dieser Entwurf wurde zwischenzeitlich verändert. Bitte verwende den aktuellen Stand.",
      409
    );
  }
  if (!OPEN_DRAFT_STATES.includes(loaded.draft.state as never)) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "invalid_state",
      "Dieser Terminentwurf kann nicht mehr bearbeitet werden.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  const nextPayload = planningPayloadSchema.parse({
    ...loaded.payload,
    title: completed.data.title,
    note: completed.data.note || undefined,
    assigneeIds: completed.data.assigneeIds,
    startAt: completed.data.startAt,
    endAt: completed.data.endAt,
    approvalStatus: completed.data.approvalStatus,
    offerId: completed.data.offerId || undefined,
    planningTrade: completed.data.planningTrade || undefined,
    billingCatalogItemId: completed.data.billingCatalogItemId || undefined,
    recurrence: completed.data.recurrence,
    overbookingApproval:
      completed.data.overbookingFingerprint &&
      completed.data.overbookingReason
        ? {
            fingerprint: completed.data.overbookingFingerprint,
            reason: completed.data.overbookingReason,
          }
        : undefined,
  });
  const previewValidation = createJarvisActionPreview({
    previewId: loaded.draft.id,
    actionId: "planning.prepare",
    payload: nextPayload,
    organizationId: binding.organizationId,
    profile: binding.profile,
    createdAt: now.toISOString(),
  });
  if (!previewValidation.ok) {
    throw new JarvisActionDraftError(
      "invalid_input",
      previewValidation.message,
      400
    );
  }
  const evaluation = await evaluatePlanningDraft(
    nextPayload,
    loaded.context,
    binding,
    loaded.draft.id,
    now
  );
  const revision = loaded.draft.revision + 1;
  const payloadHash = hashJson(nextPayload);
  const nextData: DraftIntegrityData = {
    ...loaded.draft,
    state: "awaiting_confirmation",
    revision,
    payloadHash,
    lastErrorCode: evaluation.executable ? null : "preflight_blocked",
  };
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: loaded.draft.id,
        revision: loaded.draft.revision,
        state: loaded.draft.state,
        integrityTag: loaded.draft.integrityTag,
      },
      data: {
        state: "awaiting_confirmation",
        revision,
        payload: nextPayload as Prisma.InputJsonValue,
        payloadHash,
        lastErrorCode: nextData.lastErrorCode,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Entwurf wurde zwischenzeitlich verändert. Bitte lade ihn neu.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: loaded.draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_rechecked",
      reasonCode: evaluation.executable ? "ready" : "preflight_blocked",
    });
    return current;
  });
  return toJarvisPlanningActionDraftView(updated, binding, now);
}

export async function cancelJarvisPlanningDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const { draft } = await loadBoundPlanningDraft(previewId, binding, now);
  if (draft.state === "cancelled") {
    return toJarvisPlanningActionDraftView(draft, binding, now);
  }
  if (
    !OPEN_DRAFT_STATES.includes(draft.state as never) ||
    draft.revision !== expectedRevision
  ) {
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "conflict",
      "Dieser Terminentwurf ist nicht mehr abbrechbar oder wurde zwischenzeitlich verändert.",
      draft.state === "expired" ? 410 : 409
    );
  }
  const nextData: DraftIntegrityData = {
    ...draft,
    state: "cancelled",
    cancelledAt: now,
    lastErrorCode: null,
  };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "cancelled",
        cancelledAt: now,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Entwurf wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_cancelled",
      reasonCode: "user_cancelled",
    });
    return current;
  });
  return toJarvisPlanningActionDraftView(cancelled, binding, now);
}

async function finalizePlanningDraft(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding,
  resultId: string,
  now: Date
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    validatePlanningBinding(current, binding);
    if (current.state === "executed") return current;
    if (current.state !== "executing") {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Terminentwurf befindet sich nicht mehr in Ausführung.",
        409
      );
    }
    const executedData: DraftIntegrityData = {
      ...current,
      state: "executed",
      executedAt: now,
      resultEntityType: "planning",
      resultEntityId: resultId,
      lastErrorCode: null,
    };
    const executed = await tx.jarvisActionDraft.update({
      where: { id: current.id },
      data: {
        state: "executed",
        executedAt: now,
        resultEntityType: "planning",
        resultEntityId: resultId,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(executedData),
      },
    });
    await appendAuditEvent(tx, {
      draft: executed,
      eventType: "draft_executed",
      result: { id: resultId, entityType: "planning" },
    });
    return executed;
  });
}

export async function confirmJarvisPlanningDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  execute: (input: JarvisPlanningExecutionInput) => Promise<{ id: string }>,
  now = new Date()
) {
  const loaded = await loadBoundPlanningDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") {
    return toJarvisPlanningActionDraftView(loaded.draft, binding, now);
  }
  if (loaded.draft.state === "executing") {
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "PlanningBatch"
      WHERE "organizationId" = ${binding.organizationId}
        AND "requestId" = ${loaded.draft.id}
        AND "status" = 'completed'
      LIMIT 1
    `;
    const legacyEntry =
      existing.length === 0
        ? await prisma.planningEntry.findFirst({
            where: {
              id: loaded.draft.id,
              organizationId: binding.organizationId,
              deletedAt: null,
            },
            select: { id: true },
          })
        : null;
    const existingResultId = existing[0]?.id ?? legacyEntry?.id;
    if (existingResultId) {
      const finalized = await finalizePlanningDraft(
        loaded.draft,
        binding,
        existingResultId,
        now
      );
      return toJarvisPlanningActionDraftView(finalized, binding, now);
    }
    throw new JarvisActionDraftError(
      "conflict",
      "Der Termin wird bereits verarbeitet. Es wurde kein zweiter Schreibvorgang gestartet.",
      409
    );
  }
  if (
    loaded.draft.state !== "awaiting_confirmation" ||
    loaded.draft.revision !== expectedRevision
  ) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "conflict",
      "Der Terminentwurf ist nicht mehr aktuell oder nicht bestätigbar.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  const evaluation = await evaluatePlanningDraft(
    loaded.payload,
    loaded.context,
    binding,
    loaded.draft.id,
    now
  );
  if (!evaluation.executable || !evaluation.executionInput) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Die fachliche Vorprüfung blockiert das Speichern. Bitte bearbeite und prüfe den Entwurf erneut.",
      409
    );
  }

  const executing = await prisma.$transaction(async (tx) => {
    await verifyCurrentProjectContext(
      tx,
      binding.organizationId,
      loaded.context
    );
    const nextData: DraftIntegrityData = {
      ...loaded.draft,
      state: "executing",
      confirmedAt: now,
      lastErrorCode: null,
    };
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: loaded.draft.id,
        revision: loaded.draft.revision,
        state: "awaiting_confirmation",
        integrityTag: loaded.draft.integrityTag,
      },
      data: {
        state: "executing",
        confirmedAt: now,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Termin wird bereits verarbeitet.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: loaded.draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_confirmed",
    });
    return current;
  });

  try {
    const result = await execute(evaluation.executionInput);
    const finalized = await finalizePlanningDraft(
      executing,
      binding,
      result.id,
      new Date()
    );
    return toJarvisPlanningActionDraftView(finalized, binding, now);
  } catch (error) {
    if (error instanceof JarvisActionDraftError) throw error;
    await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({
        where: { id: executing.id },
      });
      if (!current || current.state !== "executing" || !integrityMatches(current)) {
        return;
      }
      const nextData: DraftIntegrityData = {
        ...current,
        state: "awaiting_confirmation",
        lastErrorCode: "planning_service_failed",
      };
      const changed = await tx.jarvisActionDraft.updateMany({
        where: {
          id: current.id,
          state: "executing",
          revision: current.revision,
          integrityTag: current.integrityTag,
        },
        data: {
          state: "awaiting_confirmation",
          lastErrorCode: "planning_service_failed",
          integrityTag: createIntegrityTag(nextData),
        },
      });
      if (changed.count === 1) {
        const reverted = await tx.jarvisActionDraft.findUniqueOrThrow({
          where: { id: current.id },
        });
        await appendAuditEvent(tx, {
          draft: reverted,
          eventType: "execution_failed",
          reasonCode: "planning_service_failed",
        });
      }
    });
    throw new JarvisActionDraftError(
      "execution_failed",
      error instanceof Error
        ? `Der Planning-Service hat den Termin nicht angelegt: ${error.message}`
        : "Der Planning-Service hat den Termin nicht angelegt.",
      500
    );
  }
}

type TimePayload = z.infer<typeof timePayloadSchema>;
type TimeContext = z.infer<typeof timeContextSchema>;

function validateTimeBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Dieser Zeitentwurf gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.",
      403
    );
  }
  if (
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role
  ) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Die Rolle hat sich seit Erstellung des Zeitentwurfs geändert. Bitte beginne neu.",
      409
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Integritätsnachweis des Zeitentwurfs ist ungültig.",
      409
    );
  }
  const payload = timePayloadSchema.safeParse(draft.payload);
  const context = timeContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "time.prepare" ||
    !payload.success ||
    !context.success ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Zeit-Payload oder Fachkontext stimmen nicht mit dem gespeicherten Nachweis überein.",
      409
    );
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundTimeDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({
    where: { id: previewId },
  });
  if (!found) {
    throw new JarvisActionDraftError(
      "not_found",
      "Der manuelle Zeitentwurf wurde nicht gefunden.",
      404
    );
  }
  validateTimeBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateTimeBinding(current, binding);
  return { draft: current, ...parsed };
}

function normalizeTimeText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function timeMinutes(value?: string) {
  const match = value?.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function isValidDateKey(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function timeProjectVariant(project?: {
  projectKind: string | null;
  recurringBillingMode: string | null;
} | null): JarvisTimeActionDraftView["editor"]["projectVariant"] {
  if (!project) return "unproductive";
  const recurring = normalizeTimeText(project.projectKind ?? "").includes(
    "dauerlaufer"
  );
  if (!recurring) return "single";
  return project.recurringBillingMode === "hourly"
    ? "recurring_hourly"
    : "recurring_flat";
}

function canonicalizeTimePayload(
  payload: TimePayload,
  project?: {
    projectKind: string | null;
    recurringBillingMode: string | null;
  } | null
): TimePayload {
  const variant =
    payload.mode === "unproductive"
      ? "unproductive"
      : timeProjectVariant(project);
  return timePayloadSchema.parse({
    mode: payload.mode,
    ...(payload.mode === "project" && payload.projectId
      ? { projectId: payload.projectId }
      : {}),
    ...(payload.mode === "unproductive" && payload.unproductiveLabel
      ? { unproductiveLabel: payload.unproductiveLabel }
      : {}),
    ...(payload.employeeId ? { employeeId: payload.employeeId } : {}),
    ...(payload.date ? { date: payload.date } : {}),
    ...(payload.startTime ? { startTime: payload.startTime } : {}),
    ...(payload.endTime ? { endTime: payload.endTime } : {}),
    pauseMinutes: payload.pauseMinutes,
    ...(payload.comment ? { comment: payload.comment } : {}),
    ...(variant === "single" && payload.offerId
      ? { offerId: payload.offerId }
      : {}),
    ...(variant === "recurring_hourly" && payload.trade
      ? { trade: payload.trade }
      : {}),
    ...(variant === "recurring_hourly" && payload.billingCatalogItemId
      ? { billingCatalogItemId: payload.billingCatalogItemId }
      : {}),
    completionStatus:
      payload.mode === "project" ? payload.completionStatus : "",
    overtimeApprovalStatus: payload.overtimeApprovalStatus,
  });
}

function timeCheck(
  code: string,
  label: string,
  status: JarvisTimeActionDraftCheck["status"],
  detail: string
): JarvisTimeActionDraftCheck {
  return { code, label, status, detail };
}

function mayManageTimeForOthers(binding: JarvisTaskDraftBinding) {
  return (
    canManageProjectTimeEntries(binding.profile.sessionActor) &&
    canManageProjectTimeEntries(binding.profile.effectiveActor)
  );
}

function mayApproveTimeOvertime(binding: JarvisTaskDraftBinding) {
  return (
    canApproveProjectOvertime(binding.profile.sessionActor) &&
    canApproveProjectOvertime(binding.profile.effectiveActor)
  );
}

async function getTimeDraftResources(
  payload: TimePayload,
  binding: JarvisTaskDraftBinding
) {
  const effectiveActorId = getActorIds(binding.profile).effectiveActorId;
  const manageOthers = mayManageTimeForOthers(binding);
  const [employees, projects, catalogItems] = await Promise.all([
    prisma.user.findMany({
      where: {
        organizationId: binding.organizationId,
        isActive: true,
        ...(manageOthers ? {} : { id: effectiveActorId }),
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        updatedAt: true,
      },
    }),
    prisma.workPilotProject.findMany({
      where: {
        organizationId: binding.organizationId,
        status: { notIn: ["Gelöscht", "Gel\u00c3\u00b6scht", "Archiviert"] },
      },
      orderBy: [{ projectNumber: "asc" }],
      take: 1000,
      select: {
        id: true,
        projectNumber: true,
        title: true,
        trade: true,
        projectKind: true,
        recurringBillingMode: true,
        updatedAt: true,
      },
    }),
    prisma.catalogItem.findMany({
      where: {
        organizationId: binding.organizationId,
        isActive: true,
        type: "service",
        isLaborPosition: true,
      },
      orderBy: [{ trade: "asc" }, { name: "asc" }],
      take: 1000,
      select: {
        id: true,
        number: true,
        name: true,
        trade: true,
        unit: true,
        salesPrice: true,
        updatedAt: true,
      },
    }),
  ]);
  const project =
    payload.mode === "project" && payload.projectId
      ? projects.find((entry) => entry.id === payload.projectId)
      : undefined;
  const employee = payload.employeeId
    ? employees.find((entry) => entry.id === payload.employeeId)
    : undefined;
  const offers = project
    ? await prisma.offer.findMany({
        where: {
          organizationId: binding.organizationId,
          projectId: project.id,
        },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          offerNumber: true,
          offerType: true,
          status: true,
          updatedAt: true,
        },
      })
    : [];
  const activeOffers = offers.filter((offer) => {
    const status = normalizeTimeText(offer.status);
    return (
      status !== "entwurf" &&
      !status.includes("verloren") &&
      !status.includes("geloscht")
    );
  });
  const offer =
    payload.offerId && payload.offerId !== WITHOUT_OFFER_ASSIGNMENT
      ? activeOffers.find((entry) => entry.id === payload.offerId)
      : undefined;
  const hourlyItems = catalogItems.filter(
    (item) =>
      normalizeTimeText(item.unit ?? "").replace(/\./g, "") === "std" &&
      Number(item.salesPrice || 0) > 0
  );
  const billingItem = payload.billingCatalogItemId
    ? hourlyItems.find((entry) => entry.id === payload.billingCatalogItemId)
    : undefined;
  return {
    employees,
    projects,
    project,
    employee,
    activeOffers,
    offer,
    hourlyItems,
    billingItem,
    manageOthers,
    effectiveActorId,
  };
}

function buildTimeContext(
  resources: Awaited<ReturnType<typeof getTimeDraftResources>>
): TimeContext {
  return {
    ...(resources.project
      ? {
          projectId: resources.project.id,
          projectUpdatedAt: resources.project.updatedAt.toISOString(),
        }
      : {}),
    ...(resources.employee
      ? {
          employeeId: resources.employee.id,
          employeeUpdatedAt: resources.employee.updatedAt.toISOString(),
        }
      : {}),
    ...(resources.offer
      ? {
          offerId: resources.offer.id,
          offerUpdatedAt: resources.offer.updatedAt.toISOString(),
        }
      : {}),
    ...(resources.billingItem
      ? {
          billingCatalogItemId: resources.billingItem.id,
          billingCatalogItemUpdatedAt:
            resources.billingItem.updatedAt.toISOString(),
        }
      : {}),
  };
}

async function evaluateTimeDraft(
  payload: TimePayload,
  context: TimeContext,
  binding: JarvisTaskDraftBinding
) {
  const resources = await getTimeDraftResources(payload, binding);
  const checks: JarvisTimeActionDraftCheck[] = [];
  const variant =
    payload.mode === "unproductive"
      ? "unproductive"
      : timeProjectVariant(resources.project);
  const currentContext = buildTimeContext(resources);
  const contextMatches =
    canonicalize(currentContext) === canonicalize(context);
  checks.push(
    timeCheck(
      "scope",
      "Organisation, Sitzung und Rolle",
      "ok",
      "Entwurf und wirksame Identität sind serverseitig gebunden."
    )
  );
  const employeeAllowed =
    Boolean(resources.employee) &&
    (resources.manageOthers ||
      resources.employee?.id === resources.effectiveActorId);
  checks.push(
    timeCheck(
      "employee",
      "Aktiver Mitarbeitender",
      employeeAllowed ? "ok" : "blocked",
      employeeAllowed
        ? `${resources.employee?.firstName} ${resources.employee?.lastName}`.trim()
        : "Die Person fehlt, ist inaktiv oder darf mit dieser Rollenkombination nicht bebucht werden."
    )
  );
  const projectValid =
    payload.mode === "unproductive"
      ? Boolean(payload.unproductiveLabel?.trim())
      : Boolean(resources.project);
  checks.push(
    timeCheck(
      "work_context",
      payload.mode === "unproductive"
        ? "Unproduktive Tätigkeit"
        : "Projektbezug",
      projectValid ? "ok" : "blocked",
      payload.mode === "unproductive"
        ? payload.unproductiveLabel?.trim() ||
            "Eine eindeutige Tätigkeitsbezeichnung fehlt."
        : resources.project
          ? `${resources.project.projectNumber} · ${resources.project.title}`
          : "Das Projekt fehlt oder gehört nicht zur Organisation."
    )
  );
  const start = timeMinutes(payload.startTime);
  const end = timeMinutes(payload.endTime);
  const durationMinutes =
    start !== null && end !== null
      ? end - start - payload.pauseMinutes
      : 0;
  const timeValid =
    isValidDateKey(payload.date) &&
    start !== null &&
    end !== null &&
    durationMinutes > 0;
  checks.push(
    timeCheck(
      "date_time",
      "Datum, Zeit und Pause",
      timeValid ? "ok" : "blocked",
      timeValid
        ? `${payload.date}, ${payload.startTime}–${payload.endTime} Uhr, ${payload.pauseMinutes} Min. Pause, ${durationMinutes} Min. Arbeitszeit.`
        : "Datum muss gültig sein; Ende muss nach Beginn liegen und die Pause kleiner als das Zeitfenster sein."
    )
  );
  const offerValid =
    variant !== "single" ||
    Boolean(resources.offer) ||
    (payload.offerId === WITHOUT_OFFER_ASSIGNMENT &&
      Boolean(payload.comment?.trim()));
  checks.push(
    timeCheck(
      "offer",
      "Auftragsgrundlage",
      offerValid ? "ok" : "blocked",
      variant !== "single"
        ? "Für diese Projektart ist keine Angebotszuordnung Pflicht."
        : resources.offer
          ? `${resources.offer.offerNumber} · ${resources.offer.status}`
          : payload.offerId === WITHOUT_OFFER_ASSIGNMENT
            ? payload.comment?.trim()
              ? "Ohne Angebotszuweisung; die Begründung ist dokumentiert."
              : "Ohne Angebotszuweisung ist eine Begründung im Kommentar erforderlich."
            : "Für ein Einmalprojekt muss ein aktives finales Angebot oder bewusst „ohne Angebot“ gewählt werden."
    )
  );
  const billingItemFits =
    Boolean(resources.billingItem) &&
    normalizeTimeText(resources.billingItem?.trade ?? "") ===
      normalizeTimeText(payload.trade ?? "");
  const billingValid =
    variant !== "recurring_hourly" ||
    Boolean(payload.trade?.trim() && billingItemFits);
  checks.push(
    timeCheck(
      "billing",
      "Gewerk und Abrechnungsleistung",
      billingValid ? "ok" : "blocked",
      variant !== "recurring_hourly"
        ? "Für diese Projektart ist keine Stunden-Abrechnungsleistung Pflicht."
        : billingItemFits
          ? `${payload.trade} · ${resources.billingItem?.number} | ${resources.billingItem?.name}`
          : "Für den Stunden-Dauerläufer fehlen ein Gewerk oder eine aktive, passende Stundenleistung."
    )
  );
  const completionValid =
    payload.mode === "unproductive" ||
    payload.completionStatus !== "interrupted" ||
    Boolean(payload.comment?.trim());
  checks.push(
    timeCheck(
      "completion",
      "Abschlussstatus",
      completionValid ? "ok" : "blocked",
      payload.mode === "unproductive"
        ? "Für unproduktive Zeit wird kein Projektabschlussstatus gesetzt."
        : payload.completionStatus === "finished"
          ? "Arbeit als erledigt gekennzeichnet."
          : payload.completionStatus === "interrupted"
            ? completionValid
              ? "Unterbrechung ist mit Kommentar dokumentiert."
              : "Eine Unterbrechung benötigt einen Kommentar."
            : "Kein Abschlussstatus; der Zeiteintrag verändert den Projektstatus nicht."
    )
  );
  const overtimeValid =
    payload.overtimeApprovalStatus === "not_required" ||
    mayApproveTimeOvertime(binding);
  checks.push(
    timeCheck(
      "overtime",
      "Überstundenstatus",
      overtimeValid ? "ok" : "blocked",
      overtimeValid
        ? payload.overtimeApprovalStatus === "approved"
          ? "Überstunden werden durch die aktuell berechtigte Person freigegeben."
          : payload.overtimeApprovalStatus === "pending"
            ? "Überstunden werden als zu prüfen gespeichert."
            : "Keine Überstundenfreigabe angefordert."
        : "Diese Rollenkombination darf keinen Überstundenstatus setzen."
    )
  );
  checks.push(
    timeCheck(
      "freshness",
      "Aktueller Fachstand",
      contextMatches ? "ok" : "blocked",
      contextMatches
        ? "Projekt, Person, Angebot und Abrechnungsleistung entsprechen dem zuletzt geprüften Serverstand."
        : "Mindestens ein gebundener Datensatz wurde verändert. Bitte den Entwurf erneut prüfen."
    )
  );
  return {
    ...resources,
    checks,
    variant,
    currentContext,
    durationMinutes,
    executable: checks.every((check) => check.status !== "blocked"),
  };
}

export async function toJarvisTimeActionDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): Promise<JarvisTimeActionDraftView> {
  const { payload, context } = validateTimeBinding(draft, binding);
  const evaluation = await evaluateTimeDraft(payload, context, binding);
  const state = draft.state as JarvisTimeActionDraftView["state"];
  const isOpen =
    state === "awaiting_input" || state === "awaiting_confirmation";
  const ready =
    state === "awaiting_confirmation" && evaluation.executable;
  const reason: JarvisTimeActionDraftView["confirmation"]["reason"] =
    state === "expired"
      ? "expired"
      : state === "cancelled"
        ? "cancelled"
        : state === "executed"
          ? "executed"
          : state === "executing"
            ? "executing"
            : ready
              ? "ready"
              : "missing_fields";
  const badge: JarvisTimeActionDraftView["badge"] =
    state === "executed"
      ? "Gespeichert"
      : state === "executing"
        ? "Wird gespeichert"
        : state === "cancelled"
          ? "Abgebrochen"
          : state === "expired"
            ? "Abgelaufen"
            : ready
              ? "Bereit"
              : "Entwurf";
  const employeeLabel = evaluation.employee
    ? `${evaluation.employee.firstName} ${evaluation.employee.lastName}`.trim() ||
      evaluation.employee.email
    : "Noch nicht ausgewählt";
  const fields: JarvisTimeActionDraftView["fields"] = [
    {
      label: "Art",
      value:
        payload.mode === "project"
          ? "Manuelle Projektzeit"
          : "Manuelle unproduktive Zeit",
    },
    { label: "Mitarbeitend", value: employeeLabel },
    {
      label: "Arbeitsbezug",
      value:
        payload.mode === "project"
          ? evaluation.project
            ? `${evaluation.project.projectNumber} · ${evaluation.project.title}`
            : "Noch kein Projekt ausgewählt"
          : payload.unproductiveLabel || "Noch nicht angegeben",
    },
  ];
  if (isValidDateKey(payload.date) && payload.startTime && payload.endTime) {
    fields.push({
      label: "Zeitfenster",
      value: `${payload.date} · ${payload.startTime}–${payload.endTime} Uhr · ${payload.pauseMinutes} Min. Pause`,
    });
  }
  if (payload.comment) {
    fields.push({ label: "Kommentar", value: payload.comment });
  }
  const trades = Array.from(
    new Set(
      evaluation.hourlyItems
        .map((item) => item.trade?.trim() ?? "")
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right, "de"));
  return {
    version: 2,
    previewId: draft.id,
    actionId: "time.prepare",
    title: "Manuellen Zeiteintrag vorbereiten",
    badge,
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    fields,
    missingFields: evaluation.checks
      .filter((check) => check.status === "blocked")
      .map((check) => check.label),
    checks: evaluation.checks,
    editor: {
      mode: payload.mode,
      projectId: payload.projectId ?? "",
      unproductiveLabel: payload.unproductiveLabel ?? "",
      employeeId: payload.employeeId ?? "",
      date: payload.date ?? "",
      startTime: payload.startTime ?? "",
      endTime: payload.endTime ?? "",
      pauseMinutes: payload.pauseMinutes,
      comment: payload.comment ?? "",
      offerId: payload.offerId ?? "",
      trade: payload.trade ?? "",
      billingCatalogItemId: payload.billingCatalogItemId ?? "",
      completionStatus: payload.completionStatus,
      overtimeApprovalStatus: payload.overtimeApprovalStatus,
      projectVariant: evaluation.variant,
      employeeOptions: evaluation.employees.map((employee) => ({
        id: employee.id,
        label:
          `${employee.firstName} ${employee.lastName}`.trim() ||
          employee.email,
      })),
      projectOptions: evaluation.projects.map((project) => ({
        id: project.id,
        label: `${project.projectNumber} · ${project.title}`,
      })),
      offerOptions:
        evaluation.variant === "single"
          ? [
              ...evaluation.activeOffers.map((offer) => ({
                id: offer.id,
                label: `${offer.offerNumber} · ${offer.offerType === "addendum" ? "Nachtrag" : "Angebot"} · ${offer.status}`,
              })),
              {
                id: WITHOUT_OFFER_ASSIGNMENT,
                label: "Ohne Angebotszuweisung",
              },
            ]
          : [],
      tradeOptions: trades,
      billingCatalogItemOptions: evaluation.hourlyItems.map((item) => ({
        id: item.id,
        label: `${item.number} | ${item.name}`,
        trade: item.trade ?? "",
      })),
      completionStatusOptions:
        payload.mode === "project"
          ? [
              { value: "", label: "Kein Abschlussstatus" },
              { value: "finished", label: "Arbeit erledigt" },
              { value: "interrupted", label: "Arbeit unterbrochen" },
            ]
          : [{ value: "", label: "Kein Abschlussstatus" }],
      overtimeApprovalStatusOptions: mayApproveTimeOvertime(binding)
        ? [
            { value: "not_required", label: "Nicht erforderlich" },
            { value: "pending", label: "Zu prüfen" },
            { value: "approved", label: "Freigegeben" },
          ]
        : [{ value: "not_required", label: "Nicht erforderlich" }],
    },
    confirmation: { enabled: ready, reason },
    cancellation: { enabled: isOpen },
    execution: {
      enabled: false,
      reason: state === "executed" ? "finalized" : "requires_confirmation",
    },
    ...(state === "executed" &&
    draft.resultEntityType === "projectTimeEntry" &&
    draft.resultEntityId
      ? {
          result: {
            entityType: "projectTimeEntry" as const,
            entityId: draft.resultEntityId,
            label: "Gespeicherten Zeiteintrag öffnen",
          },
        }
      : {}),
  };
}

export async function createPersistedJarvisTimeDraft(input: {
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  initial?: Partial<TimePayload>;
  projectId?: string;
  now?: Date;
}) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für einen bestätigbaren Zeitentwurf ist eine aktuelle Sitzung erforderlich.",
      401
    );
  }
  if (
    input.profile.sessionActor.role === Role.GAST ||
    input.profile.effectiveActor.role === Role.GAST
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Gäste dürfen keine internen Zeiteinträge vorbereiten.",
      403
    );
  }
  const now = input.now ?? new Date();
  const actorIds = getActorIds(input.profile);
  const requestedPayload = timePayloadSchema.parse({
    mode: input.initial?.mode ?? (input.projectId ? "project" : "project"),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    employeeId: input.initial?.employeeId ?? actorIds.effectiveActorId,
    pauseMinutes: input.initial?.pauseMinutes ?? 0,
    completionStatus: input.initial?.completionStatus ?? "",
    overtimeApprovalStatus:
      input.initial?.overtimeApprovalStatus ?? "not_required",
    ...input.initial,
  });
  const binding = {
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    profile: input.profile,
  };
  const requestedResources = await getTimeDraftResources(
    requestedPayload,
    binding
  );
  const payload = canonicalizeTimePayload(
    requestedPayload,
    requestedResources.project
  );
  const resources =
    payload === requestedPayload
      ? requestedResources
      : await getTimeDraftResources(payload, binding);
  const context = buildTimeContext(resources);
  const draftData: DraftIntegrityData = {
    id: randomUUID(),
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId: "time.prepare",
    state: "awaiting_input",
    revision: 1,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_TIME_DRAFT_TTL_MS),
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode: null,
  };
  const draft = await prisma.$transaction(async (tx) => {
    const created = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag: createIntegrityTag(draftData),
      },
    });
    await appendAuditEvent(tx, {
      draft: created,
      eventType: "draft_created",
    });
    return created;
  });
  return toJarvisTimeActionDraftView(draft, {
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    profile: input.profile,
  });
}

export async function getJarvisTimeDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundTimeDraft(previewId, binding, now);
  return toJarvisTimeActionDraftView(draft, binding);
}

export async function completeJarvisTimeDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  rawInput: unknown,
  now = new Date()
) {
  const completed = completeTimeDraftSchema.safeParse(rawInput);
  if (!completed.success) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Die Angaben des manuellen Zeiteintrags sind unvollständig oder ungültig.",
      400
    );
  }
  const loaded = await loadBoundTimeDraft(previewId, binding, now);
  if (
    loaded.draft.revision !== completed.data.revision ||
    !OPEN_DRAFT_STATES.includes(loaded.draft.state as never)
  ) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "conflict",
      "Der Zeitentwurf ist nicht mehr aktuell oder bearbeitbar.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  for (const value of [
    completed.data.comment,
    completed.data.unproductiveLabel,
  ]) {
    if (!value) continue;
    const authorization = authorizeJarvisQuestion(value, binding.profile);
    if (
      authorization.reason === "prompt_injection" ||
      authorization.reason === "secret"
    ) {
      throw new JarvisActionDraftError(
        "invalid_input",
        "Kommentar oder Tätigkeitsbezeichnung enthalten gesperrte technische Inhalte.",
        400
      );
    }
  }
  const { revision: _revision, ...payloadInput } = completed.data;
  const requestedPayload = timePayloadSchema.parse(payloadInput);
  const requestedResources = await getTimeDraftResources(
    requestedPayload,
    binding
  );
  const nextPayload = canonicalizeTimePayload(
    requestedPayload,
    requestedResources.project
  );
  const resources = await getTimeDraftResources(nextPayload, binding);
  const nextContext = buildTimeContext(resources);
  const evaluation = await evaluateTimeDraft(
    nextPayload,
    nextContext,
    binding
  );
  const revision = loaded.draft.revision + 1;
  const nextData: DraftIntegrityData = {
    ...loaded.draft,
    state: "awaiting_confirmation",
    revision,
    payloadHash: hashJson(nextPayload),
    contextHash: hashJson(nextContext),
    lastErrorCode: evaluation.executable ? null : "preflight_blocked",
  };
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: loaded.draft.id,
        revision: loaded.draft.revision,
        state: loaded.draft.state,
        integrityTag: loaded.draft.integrityTag,
      },
      data: {
        state: "awaiting_confirmation",
        revision,
        payload: nextPayload as Prisma.InputJsonValue,
        context: nextContext as Prisma.InputJsonValue,
        payloadHash: nextData.payloadHash,
        contextHash: nextData.contextHash,
        lastErrorCode: nextData.lastErrorCode,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Zeitentwurf wurde zwischenzeitlich verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: loaded.draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_rechecked",
      reasonCode: evaluation.executable ? "ready" : "preflight_blocked",
    });
    return current;
  });
  return toJarvisTimeActionDraftView(updated, binding);
}

export async function cancelJarvisTimeDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const { draft } = await loadBoundTimeDraft(previewId, binding, now);
  if (draft.state === "cancelled") {
    return toJarvisTimeActionDraftView(draft, binding);
  }
  if (
    !OPEN_DRAFT_STATES.includes(draft.state as never) ||
    draft.revision !== expectedRevision
  ) {
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "conflict",
      "Der Zeitentwurf ist nicht mehr abbrechbar oder wurde verändert.",
      draft.state === "expired" ? 410 : 409
    );
  }
  const nextData: DraftIntegrityData = {
    ...draft,
    state: "cancelled",
    cancelledAt: now,
    lastErrorCode: null,
  };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "cancelled",
        cancelledAt: now,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Zeitentwurf wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_cancelled",
      reasonCode: "user_cancelled",
    });
    return current;
  });
  return toJarvisTimeActionDraftView(cancelled, binding);
}

async function verifyTimeContext(
  tx: Prisma.TransactionClient,
  organizationId: string,
  context: TimeContext
) {
  const [project, employee, offer, item] = await Promise.all([
    context.projectId
      ? tx.workPilotProject.findFirst({
          where: { id: context.projectId, organizationId },
          select: { updatedAt: true },
        })
      : null,
    context.employeeId
      ? tx.user.findFirst({
          where: {
            id: context.employeeId,
            organizationId,
            isActive: true,
          },
          select: { updatedAt: true },
        })
      : null,
    context.offerId
      ? tx.offer.findFirst({
          where: { id: context.offerId, organizationId },
          select: { updatedAt: true },
        })
      : null,
    context.billingCatalogItemId
      ? tx.catalogItem.findFirst({
          where: { id: context.billingCatalogItemId, organizationId },
          select: { updatedAt: true },
        })
      : null,
  ]);
  const matches =
    (!context.projectId ||
      project?.updatedAt.toISOString() === context.projectUpdatedAt) &&
    (!context.employeeId ||
      employee?.updatedAt.toISOString() === context.employeeUpdatedAt) &&
    (!context.offerId ||
      offer?.updatedAt.toISOString() === context.offerUpdatedAt) &&
    (!context.billingCatalogItemId ||
      item?.updatedAt.toISOString() ===
        context.billingCatalogItemUpdatedAt);
  if (!matches) {
    throw new JarvisActionDraftError(
      "stale_context",
      "Projekt, Person, Angebot oder Abrechnungsleistung wurden seit der Prüfung verändert.",
      409
    );
  }
}

async function finalizeExistingTimeDraft(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding,
  now: Date
) {
  return prisma.$transaction(
    async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({
        where: { id: draft.id },
      });
      if (!current) {
        throw new JarvisActionDraftError(
          "not_found",
          "Der Zeitentwurf wurde nicht gefunden.",
          404
        );
      }
      validateTimeBinding(current, binding);
      if (current.state === "executed") return current;
      if (current.state !== "executing") {
        throw new JarvisActionDraftError(
          "conflict",
          "Der Zeitentwurf befindet sich nicht mehr in Ausführung.",
          409
        );
      }
      const existing = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "ProjectTimeEntry"
        WHERE "id" = ${current.id}
          AND "organizationId" = ${binding.organizationId}
        LIMIT 1
      `;
      if (!existing[0]) {
        throw new JarvisActionDraftError(
          "conflict",
          "Der Zeiteintrag wird bereits verarbeitet. Es wurde kein zweiter Schreibvorgang gestartet.",
          409
        );
      }
      const executedData: DraftIntegrityData = {
        ...current,
        state: "executed",
        executedAt: now,
        resultEntityType: "projectTimeEntry",
        resultEntityId: current.id,
        lastErrorCode: null,
      };
      const executed = await tx.jarvisActionDraft.update({
        where: { id: current.id },
        data: {
          state: "executed",
          executedAt: now,
          resultEntityType: "projectTimeEntry",
          resultEntityId: current.id,
          lastErrorCode: null,
          integrityTag: createIntegrityTag(executedData),
        },
      });
      await appendAuditEvent(tx, {
        draft: executed,
        eventType: "draft_executed",
        reasonCode: "existing_result_recovered",
        result: { id: current.id, entityType: "projectTimeEntry" },
      });
      return executed;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function confirmJarvisTimeDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  await ensureProjectTimeEntryTable();
  const loaded = await loadBoundTimeDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") {
    return toJarvisTimeActionDraftView(loaded.draft, binding);
  }
  if (loaded.draft.state === "executing") {
    const finalized = await finalizeExistingTimeDraft(
      loaded.draft,
      binding,
      now
    );
    return toJarvisTimeActionDraftView(finalized, binding);
  }
  if (
    loaded.draft.state !== "awaiting_confirmation" ||
    loaded.draft.revision !== expectedRevision
  ) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "conflict",
      "Der Zeitentwurf ist nicht mehr aktuell oder nicht bestätigbar.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  const evaluation = await evaluateTimeDraft(
    loaded.payload,
    loaded.context,
    binding
  );
  if (!evaluation.executable) {
    if (
      evaluation.checks.some(
        (check) => check.code === "freshness" && check.status === "blocked"
      )
    ) {
      throw new JarvisActionDraftError(
        "stale_context",
        "Projekt, Person, Angebot oder Abrechnungsleistung wurden seit der letzten Prüfung verändert.",
        409
      );
    }
    throw new JarvisActionDraftError(
      "invalid_input",
      "Die fachliche Vorprüfung blockiert das Speichern. Bitte bearbeite und prüfe den Entwurf erneut.",
      409
    );
  }
  try {
    const executed = await prisma.$transaction(
      async (tx) => {
        const current = await tx.jarvisActionDraft.findUnique({
          where: { id: loaded.draft.id },
        });
        if (!current) {
          throw new JarvisActionDraftError(
            "not_found",
            "Der Zeitentwurf wurde nicht gefunden.",
            404
          );
        }
        const parsed = validateTimeBinding(current, binding);
        if (current.state === "executed") return current;
        if (
          current.state !== "awaiting_confirmation" ||
          current.revision !== expectedRevision ||
          current.expiresAt.getTime() <= now.getTime()
        ) {
          throw new JarvisActionDraftError(
            current.expiresAt.getTime() <= now.getTime()
              ? "expired"
              : "conflict",
            "Der Zeitentwurf ist nicht mehr ausführbar.",
            current.expiresAt.getTime() <= now.getTime() ? 410 : 409
          );
        }
        await verifyTimeContext(tx, binding.organizationId, parsed.context);
        const [actor, users] = await Promise.all([
          tx.user.findFirst({
            where: {
              id: current.effectiveActorId,
              organizationId: binding.organizationId,
              isActive: true,
            },
          }),
          tx.user.findMany({
            where: { organizationId: binding.organizationId, isActive: true },
          }),
        ]);
        if (!actor) {
          throw new JarvisActionDraftError(
            "role_changed",
            "Der wirksame Benutzer ist nicht mehr aktiv.",
            409
          );
        }
        const confirmedData: DraftIntegrityData = {
          ...current,
          state: "executing",
          confirmedAt: now,
          lastErrorCode: null,
        };
        const claimed = await tx.jarvisActionDraft.updateMany({
          where: {
            id: current.id,
            revision: current.revision,
            state: "awaiting_confirmation",
            integrityTag: current.integrityTag,
          },
          data: {
            state: "executing",
            confirmedAt: now,
            lastErrorCode: null,
            integrityTag: createIntegrityTag(confirmedData),
          },
        });
        if (claimed.count !== 1) {
          throw new JarvisActionDraftError(
            "conflict",
            "Der Zeiteintrag wird bereits gespeichert.",
            409
          );
        }
        try {
          await saveProjectTimeEntry({
            db: tx,
            organizationId: binding.organizationId,
            actor,
            users,
            createOnly: true,
            createLogbookEntry: true,
            payload: {
              id: current.id,
              mode: parsed.payload.mode,
              projectId: parsed.payload.projectId,
              unproductiveLabel: parsed.payload.unproductiveLabel,
              userId: parsed.payload.employeeId,
              entrySource: "manual",
              date: parsed.payload.date,
              startTime: parsed.payload.startTime,
              endTime: parsed.payload.endTime,
              pauseMs: parsed.payload.pauseMinutes * 60_000,
              comment: parsed.payload.comment,
              offerId: parsed.payload.offerId,
              trade: parsed.payload.trade,
              billingCatalogItemId:
                parsed.payload.billingCatalogItemId,
              completionStatus: parsed.payload.completionStatus,
              overtimeApprovalStatus:
                parsed.payload.overtimeApprovalStatus,
            },
          });
        } catch (error) {
          if (error instanceof ProjectTimeEntryServiceError) {
            throw new JarvisActionDraftError(
              error.code === "forbidden"
                ? "role_changed"
                : error.code === "conflict"
                  ? "conflict"
                  : "invalid_input",
              error.message,
              error.status === 404 ? 409 : error.status
            );
          }
          throw error;
        }
        const executedAt = new Date();
        const executedData: DraftIntegrityData = {
          ...confirmedData,
          state: "executed",
          executedAt,
          resultEntityType: "projectTimeEntry",
          resultEntityId: current.id,
        };
        const finalDraft = await tx.jarvisActionDraft.update({
          where: { id: current.id },
          data: {
            state: "executed",
            executedAt,
            resultEntityType: "projectTimeEntry",
            resultEntityId: current.id,
            integrityTag: createIntegrityTag(executedData),
          },
        });
        await appendAuditEvent(tx, {
          draft: finalDraft,
          eventType: "draft_confirmed_and_executed",
          result: {
            id: current.id,
            entityType: "projectTimeEntry",
          },
        });
        return finalDraft;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return toJarvisTimeActionDraftView(executed, binding);
  } catch (error) {
    if (
      error instanceof JarvisActionDraftError &&
      error.code === "conflict"
    ) {
      const latest = await loadBoundTimeDraft(previewId, binding, now);
      if (latest.draft.state === "executed") {
        return toJarvisTimeActionDraftView(latest.draft, binding);
      }
    }
    if (error instanceof JarvisActionDraftError) throw error;
    throw new JarvisActionDraftError(
      "execution_failed",
      "Der manuelle Zeiteintrag wurde nicht gespeichert. Der Entwurf bleibt erhalten.",
      500
    );
  }
}

type WinterCalculationPayload = z.infer<
  typeof winterCalculationPayloadSchema
>;
type WinterCalculationContext = z.infer<
  typeof winterCalculationContextSchema
>;

const WINTER_INPUT_LABELS: Record<
  keyof WinterServiceCalculationInput | "mixedShares",
  string
> = {
  areaSqm: "Fläche",
  readinessPricePerSqmPerMonth: "Bereitschaftspreis",
  seasonMonths: "Saisonmonate",
  expectedDeployments: "Erwartete Einsätze",
  baseServiceMinutes: "Einsatzzeit",
  laborSalesRatePerHour: "Stundenverrechnungssatz",
  saltGramsPerSqm: "Streugutmenge",
  saltSalesPricePerKg: "Streugutpreis",
  plowTimeIncreasePercent: "Zeitaufschlag Räumen",
  plowSaltIncreasePercent: "Streugutaufschlag Räumen",
  mixedSpreadingPercent: "Mischanteil Streuen",
  mixedPlowingPercent: "Mischanteil Räumen",
  mixedShares: "Mischanteile",
};

function validateWinterCalculationBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Kalkulation gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.",
      403
    );
  }
  if (
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role
  ) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Die Rolle hat sich seit Erstellung der Kalkulation geändert. Bitte starte eine neue Kalkulation.",
      409
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Integritätsnachweis der Kalkulation ist ungültig. Es wurde nichts gespeichert.",
      409
    );
  }
  const payload = winterCalculationPayloadSchema.safeParse(draft.payload);
  const context = winterCalculationContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "winter-calculation.prepare" ||
    !payload.success ||
    !context.success ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Kalkulationswerte oder Projektkontext stimmen nicht mit dem gespeicherten Nachweis überein.",
      409
    );
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundWinterCalculationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({
    where: { id: previewId },
  });
  if (!found) {
    throw new JarvisActionDraftError(
      "not_found",
      "Der Winterdienst-Kalkulationsentwurf wurde nicht gefunden.",
      404
    );
  }
  validateWinterCalculationBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateWinterCalculationBinding(current, binding);
  return { draft: current, ...parsed };
}

function maySaveWinterCalculation(binding: JarvisTaskDraftBinding) {
  return (
    canManageProjects(binding.profile.sessionActor) &&
    canManageProjects(binding.profile.effectiveActor)
  );
}

function evaluateWinterCalculation(
  input: WinterServiceCalculationInput,
  providedFields: readonly (keyof WinterServiceCalculationInput)[] =
    WINTER_CALCULATION_INPUT_KEYS
) {
  const provided = new Set(providedFields);
  const omittedFields = WINTER_CALCULATION_INPUT_KEYS.filter(
    (field) => !provided.has(field)
  ).map((field) => WINTER_INPUT_LABELS[field]);
  if (omittedFields.length > 0) {
    return {
      result: undefined,
      invalidFields: omittedFields,
    };
  }
  try {
    return {
      result: calculateWinterService(input),
      invalidFields: [] as string[],
    };
  } catch (error) {
    if (error instanceof WinterServiceCalculationValidationError) {
      return {
        result: undefined,
        invalidFields: Object.keys(error.fields).map(
          (field) =>
            WINTER_INPUT_LABELS[
              field as keyof typeof WINTER_INPUT_LABELS
            ] || field
        ),
      };
    }
    throw error;
  }
}

async function getWinterCalculationProjectOptions(
  binding: JarvisTaskDraftBinding
) {
  if (!maySaveWinterCalculation(binding)) return [];
  const projects = await prisma.workPilotProject.findMany({
    where: {
      organizationId: binding.organizationId,
      contactId: { not: null },
    },
    orderBy: [{ projectNumber: "asc" }],
    take: 500,
    select: {
      id: true,
      projectNumber: true,
      title: true,
      customer: true,
      contactId: true,
    },
  });
  const contactIds = Array.from(
    new Set(
      projects
        .map((project) => project.contactId)
        .filter((id): id is string => Boolean(id))
    )
  );
  const contacts =
    contactIds.length === 0
      ? []
      : await prisma.contact.findMany({
          where: {
            organizationId: binding.organizationId,
            id: { in: contactIds },
          },
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            customerNumber: true,
          },
        });
  const contactLabels = new Map(
    contacts.map((contact) => [
      contact.id,
      contact.companyName?.trim() ||
        [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
        contact.customerNumber,
    ])
  );
  return projects.map((project) => ({
    id: project.id,
    label: `${project.projectNumber} · ${project.title}`.slice(0, 240),
    customerLabel:
      (project.contactId && contactLabels.get(project.contactId)) ||
      project.customer?.trim() ||
      "Kunde nicht benannt",
    contactId: project.contactId!,
  }));
}

function winterResultView(
  result: WinterServiceCalculationResult
): NonNullable<JarvisWinterCalculationDraftView["calculation"]> {
  const labels = {
    mixed: "Pauschalpreis pro Einsatz",
    spreading: "Winterdienst – Streuen",
    spreadingAndPlowing: "Winterdienst – Streuen und Schieben",
  } as const;
  return {
    readiness: result.readiness,
    variants: (
      ["mixed", "spreading", "spreadingAndPlowing"] as const
    ).map((key) => {
      const variant = result.variants[key];
      return {
        key,
        label: labels[key],
        serviceMinutes: variant.serviceMinutes,
        laborHours: variant.laborHours,
        laborAmount: variant.laborAmount,
        saltKg: variant.saltKg,
        saltAmount: variant.saltAmount,
        readinessAmountPerDeployment:
          variant.readinessAmountPerDeployment,
        effortAmountPerDeployment: variant.effortAmountPerDeployment,
        pricePerDeployment: variant.pricePerDeployment,
        plannedSeasonRevenue: variant.plannedSeasonRevenue,
        monthlyReadinessRevenue:
          variant.monthlyReadinessModel.plannedSeasonRevenue,
      };
    }),
  };
}

function formatWinterCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export async function toJarvisWinterCalculationDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): Promise<JarvisWinterCalculationDraftView> {
  const { payload } = validateWinterCalculationBinding(draft, binding);
  const evaluation = evaluateWinterCalculation(
    payload.input as WinterServiceCalculationInput,
    payload.providedFields ?? WINTER_CALCULATION_INPUT_KEYS
  );
  const projectOptions = await getWinterCalculationProjectOptions(binding);
  const selectedProject = payload.projectId
    ? projectOptions.find((project) => project.id === payload.projectId)
    : undefined;
  const savePermitted = maySaveWinterCalculation(binding);
  const missingFields = [
    ...evaluation.invalidFields,
    ...(evaluation.result && savePermitted && !selectedProject
      ? ["Projekt zum dauerhaften Speichern"]
      : []),
    ...(evaluation.result && !savePermitted
      ? ["Dauerhaftes Speichern ist für diese Rolle nicht freigegeben"]
      : []),
  ];
  const state = draft.state as JarvisWinterCalculationDraftView["state"];
  const isOpen =
    state === "awaiting_input" || state === "awaiting_confirmation";
  const isReady =
    state === "awaiting_confirmation" &&
    Boolean(evaluation.result) &&
    Boolean(selectedProject) &&
    savePermitted;
  const reason: JarvisWinterCalculationDraftView["confirmation"]["reason"] =
    state === "expired"
      ? "expired"
      : state === "cancelled"
        ? "cancelled"
        : state === "executed"
          ? "executed"
          : state === "executing"
            ? "executing"
            : !savePermitted
              ? "not_permitted"
              : isReady
                ? "ready"
                : "missing_fields";
  const badge: JarvisWinterCalculationDraftView["badge"] =
    state === "executed"
      ? "Gespeichert"
      : state === "executing"
        ? "Wird gespeichert"
        : state === "cancelled"
          ? "Abgebrochen"
          : state === "expired"
            ? "Abgelaufen"
            : evaluation.result
              ? "Berechnet"
              : "Entwurf";
  const fields: JarvisWinterCalculationDraftView["fields"] = [
    {
      label: "Rechenlogik",
      value: "Zentraler WorkPilot-Winterdienstrechner",
    },
    {
      label: "Projekt",
      value: selectedProject?.label || "Noch nicht zugeordnet",
    },
    ...(evaluation.result
      ? [
          {
            label: "Bereitschaft pro Saison",
            value: formatWinterCurrency(
              evaluation.result.readiness.seasonFee
            ),
          },
          {
            label: "Pauschalpreis je Einsatz",
            value: formatWinterCurrency(
              evaluation.result.variants.mixed.pricePerDeployment
            ),
          },
        ]
      : []),
  ];
  return {
    version: 2,
    previewId: draft.id,
    actionId: "winter-calculation.prepare",
    title: "Winterdienst kalkulieren",
    badge,
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    fields,
    missingFields,
    editor: {
      input: payload.input as WinterServiceCalculationInput,
      projectId: payload.projectId ?? "",
      note: payload.note ?? "",
      projectOptions: projectOptions.map(
        ({ id, label, customerLabel }) => ({
          id,
          label,
          customerLabel,
        })
      ),
    },
    ...(evaluation.result
      ? { calculation: winterResultView(evaluation.result) }
      : {}),
    confirmation: { enabled: isReady, reason },
    cancellation: { enabled: isOpen },
    execution: {
      enabled: false,
      reason: state === "executed" ? "finalized" : "requires_confirmation",
    },
    ...(state === "executed" &&
    draft.resultEntityType === "winterServiceCalculation" &&
    draft.resultEntityId
      ? {
          result: {
            entityType: "winterServiceCalculation" as const,
            entityId: draft.resultEntityId,
            label: "Gespeicherte Kalkulation öffnen",
          },
        }
      : {}),
  };
}

export async function createPersistedJarvisWinterCalculationDraft(input: {
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  context: { recordType?: string; recordId?: string };
  now?: Date;
}) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für eine JARVIS-Kalkulation ist eine aktuelle serverseitige Sitzung erforderlich.",
      401
    );
  }
  if (
    input.profile.sessionActor.role === Role.GAST ||
    input.profile.effectiveActor.role === Role.GAST
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Rollenkombination darf keine interne Kalkulation vorbereiten.",
      403
    );
  }
  const now = input.now ?? new Date();
  const actorIds = getActorIds(input.profile);
  let context: WinterCalculationContext = {};
  let projectId = "";
  if (
    maySaveWinterCalculation({
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      profile: input.profile,
    }) &&
    input.context.recordType === "project" &&
    input.context.recordId
  ) {
    const project = await prisma.workPilotProject.findFirst({
      where: {
        id: input.context.recordId,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
        contactId: true,
        updatedAt: true,
      },
    });
    if (project?.contactId) {
      projectId = project.id;
      context = {
        projectId: project.id,
        projectUpdatedAt: project.updatedAt.toISOString(),
        customerId: project.contactId,
      };
    }
  }
  const payload = winterCalculationPayloadSchema.parse({
    input: EMPTY_WINTER_CALCULATION_INPUT,
    providedFields: [],
    ...(projectId ? { projectId } : {}),
  });
  const payloadHash = hashJson(payload);
  const contextHash = hashJson(context);
  const draftData: DraftIntegrityData = {
    id: randomUUID(),
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId: "winter-calculation.prepare",
    state: "awaiting_input",
    revision: 1,
    payloadHash,
    contextHash,
    expiresAt: new Date(
      now.getTime() + JARVIS_WINTER_CALCULATION_DRAFT_TTL_MS
    ),
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode: null,
  };
  const draft = await prisma.$transaction(async (tx) => {
    const created = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag: createIntegrityTag(draftData),
      },
    });
    await appendAuditEvent(tx, {
      draft: created,
      eventType: "draft_created",
    });
    return created;
  });
  return toJarvisWinterCalculationDraftView(draft, {
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    profile: input.profile,
  });
}

export async function getJarvisWinterCalculationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundWinterCalculationDraft(
    previewId,
    binding,
    now
  );
  return toJarvisWinterCalculationDraftView(draft, binding);
}

export async function completeJarvisWinterCalculationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  rawInput: unknown,
  now = new Date()
) {
  const completed = completeWinterCalculationDraftSchema.safeParse(rawInput);
  if (!completed.success) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Die Winterdienst-Eingaben sind unvollständig oder ungültig.",
      400
    );
  }
  const loaded = await loadBoundWinterCalculationDraft(
    previewId,
    binding,
    now
  );
  if (loaded.draft.revision !== completed.data.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Die Kalkulation wurde zwischenzeitlich verändert. Bitte verwende den aktuellen Stand.",
      409
    );
  }
  if (!OPEN_DRAFT_STATES.includes(loaded.draft.state as never)) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "invalid_state",
      "Diese Kalkulation kann nicht mehr bearbeitet werden.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  if (completed.data.note) {
    const noteAuthorization = authorizeJarvisQuestion(
      completed.data.note,
      binding.profile
    );
    if (
      noteAuthorization.reason === "prompt_injection" ||
      noteAuthorization.reason === "secret"
    ) {
      throw new JarvisActionDraftError(
        "invalid_input",
        "Die Notiz enthält eine gesperrte technische Anweisung oder ein Geheimnis und wurde nicht gespeichert.",
        400
      );
    }
  }
  const calculation = evaluateWinterCalculation(
    completed.data.input as WinterServiceCalculationInput,
    completed.data.providedFields ?? WINTER_CALCULATION_INPUT_KEYS
  );
  const savePermitted = maySaveWinterCalculation(binding);
  let context: WinterCalculationContext = {};
  if (savePermitted && completed.data.projectId) {
    const project = await prisma.workPilotProject.findFirst({
      where: {
        id: completed.data.projectId,
        organizationId: binding.organizationId,
        contactId: { not: null },
      },
      select: { id: true, contactId: true, updatedAt: true },
    });
    if (!project?.contactId) {
      throw new JarvisActionDraftError(
        "stale_context",
        "Das ausgewählte Projekt ist nicht mehr eindeutig mit einem Kunden verknüpft.",
        409
      );
    }
    context = {
      projectId: project.id,
      projectUpdatedAt: project.updatedAt.toISOString(),
      customerId: project.contactId,
    };
  }
  const nextPayload = winterCalculationPayloadSchema.parse({
    input: completed.data.input,
    providedFields: Array.from(
      new Set(
        completed.data.providedFields ?? WINTER_CALCULATION_INPUT_KEYS
      )
    ),
    ...(savePermitted && completed.data.projectId
      ? { projectId: completed.data.projectId }
      : {}),
    ...(completed.data.note ? { note: completed.data.note } : {}),
  });
  const payloadHash = hashJson(nextPayload);
  const contextHash = hashJson(context);
  const revision = loaded.draft.revision + 1;
  const nextData: DraftIntegrityData = {
    ...loaded.draft,
    state: calculation.result
      ? "awaiting_confirmation"
      : "awaiting_input",
    revision,
    payloadHash,
    contextHash,
    lastErrorCode: calculation.result ? null : "invalid_input",
  };
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: loaded.draft.id,
        revision: loaded.draft.revision,
        state: loaded.draft.state,
        integrityTag: loaded.draft.integrityTag,
      },
      data: {
        state: nextData.state,
        revision,
        payload: nextPayload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        payloadHash,
        contextHash,
        lastErrorCode: nextData.lastErrorCode,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Die Kalkulation wurde zwischenzeitlich verändert. Bitte lade sie neu.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: loaded.draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: calculation.result
        ? "draft_calculated"
        : "draft_validation_failed",
      ...(!calculation.result ? { reasonCode: "invalid_input" } : {}),
    });
    return current;
  });
  return toJarvisWinterCalculationDraftView(updated, binding);
}

export async function cancelJarvisWinterCalculationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const { draft } = await loadBoundWinterCalculationDraft(
    previewId,
    binding,
    now
  );
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) {
    if (draft.state === "cancelled") {
      return toJarvisWinterCalculationDraftView(draft, binding);
    }
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "invalid_state",
      "Diese Kalkulation kann nicht mehr abgebrochen werden.",
      draft.state === "expired" ? 410 : 409
    );
  }
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision !== draft.revision
  ) {
    throw new JarvisActionDraftError(
      "conflict",
      "Die Kalkulation wurde zwischenzeitlich verändert.",
      409
    );
  }
  const nextData: DraftIntegrityData = {
    ...draft,
    state: "cancelled",
    cancelledAt: now,
    lastErrorCode: null,
  };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "cancelled",
        cancelledAt: now,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Die Kalkulation wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_cancelled",
      reasonCode: "user_cancelled",
    });
    return current;
  });
  return toJarvisWinterCalculationDraftView(cancelled, binding);
}

export async function confirmJarvisWinterCalculationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const loaded = await loadBoundWinterCalculationDraft(
    previewId,
    binding,
    now
  );
  if (loaded.draft.state === "executed") {
    return toJarvisWinterCalculationDraftView(loaded.draft, binding);
  }
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision !== loaded.draft.revision
  ) {
    throw new JarvisActionDraftError(
      "conflict",
      "Die Kalkulation wurde zwischenzeitlich verändert.",
      409
    );
  }
  if (loaded.draft.state !== "awaiting_confirmation") {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "invalid_state",
      "Nur eine vollständig berechnete Kalkulation darf gespeichert werden.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  if (!maySaveWinterCalculation(binding)) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Deine aktuelle Rollenkombination darf Kalkulationen berechnen, aber nicht dauerhaft einem Projekt zuordnen.",
      403
    );
  }
  if (
    !loaded.payload.projectId ||
    !loaded.context.projectId ||
    !loaded.context.customerId ||
    !loaded.context.projectUpdatedAt
  ) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Zum Speichern muss ein aktuelles Kundenprojekt ausgewählt sein.",
      400
    );
  }
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({
        where: { id: loaded.draft.id },
      });
      if (!current) {
        throw new JarvisActionDraftError(
          "not_found",
          "Die Kalkulation wurde nicht gefunden.",
          404
        );
      }
      const parsed = validateWinterCalculationBinding(current, binding);
      const contextCustomerId = parsed.context.customerId;
      const contextProjectId = parsed.context.projectId;
      const contextProjectUpdatedAt =
        parsed.context.projectUpdatedAt;
      if (
        !contextCustomerId ||
        !contextProjectId ||
        !contextProjectUpdatedAt
      ) {
        throw new JarvisActionDraftError(
          "invalid_input",
          "Der bestätigte Projektkontext ist unvollständig.",
          400
        );
      }
      const calculated = calculateWinterService(
        parsed.payload.input as WinterServiceCalculationInput
      );
      if (current.state === "executed") return current;
      if (
        current.state !== "awaiting_confirmation" ||
        current.expiresAt.getTime() <= now.getTime()
      ) {
        throw new JarvisActionDraftError(
          current.expiresAt.getTime() <= now.getTime()
            ? "expired"
            : "conflict",
          "Die Kalkulation ist nicht mehr ausführbar.",
          current.expiresAt.getTime() <= now.getTime() ? 410 : 409
        );
      }
      const project = await tx.workPilotProject.findFirst({
        where: {
          id: contextProjectId,
          organizationId: binding.organizationId,
          contactId: contextCustomerId,
        },
        select: {
          id: true,
          projectNumber: true,
          title: true,
          customer: true,
          contactId: true,
          updatedAt: true,
        },
      });
      if (
        !project ||
        project.updatedAt.toISOString() !==
          contextProjectUpdatedAt
      ) {
        throw new JarvisActionDraftError(
          "stale_context",
          "Das Projekt wurde seit der Berechnung geändert. Bitte rechne mit dem aktuellen Stand erneut.",
          409
        );
      }
      const [customer, actor] = await Promise.all([
        tx.contact.findFirst({
          where: {
            id: contextCustomerId,
            organizationId: binding.organizationId,
          },
          select: {
            companyName: true,
            firstName: true,
            lastName: true,
            customerNumber: true,
          },
        }),
        tx.user.findFirst({
          where: {
            id: current.effectiveActorId,
            organizationId: binding.organizationId,
            isActive: true,
          },
          select: {
            id: true,
            role: true,
            firstName: true,
            lastName: true,
            email: true,
            salesRoleEnabled: true,
          },
        }),
      ]);
      if (!customer || !actor || !canManageProjects(actor)) {
        throw new JarvisActionDraftError(
          "role_changed",
          "Kunde, Projekt oder Berechtigung sind nicht mehr aktuell. Es wurde nichts gespeichert.",
          409
        );
      }
      const confirmedData: DraftIntegrityData = {
        ...current,
        state: "executing",
        confirmedAt: now,
        lastErrorCode: null,
      };
      const claimed = await tx.jarvisActionDraft.updateMany({
        where: {
          id: current.id,
          revision: current.revision,
          state: "awaiting_confirmation",
          integrityTag: current.integrityTag,
        },
        data: {
          state: "executing",
          confirmedAt: now,
          lastErrorCode: null,
          integrityTag: createIntegrityTag(confirmedData),
        },
      });
      if (claimed.count !== 1) {
        throw new JarvisActionDraftError(
          "conflict",
          "Die Kalkulation wird bereits gespeichert.",
          409
        );
      }
      const customerName =
        customer.companyName?.trim() ||
        [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
        customer.customerNumber;
      const actorName =
        [actor.firstName, actor.lastName].filter(Boolean).join(" ") ||
        actor.email;
      const calculationId = randomUUID();
      await tx.winterServiceCalculation.create({
        data: {
          id: calculationId,
          organizationId: binding.organizationId,
          seriesId: current.id,
          version: 1,
          customerId: contextCustomerId,
          projectId: project.id,
          customerName,
          projectNumber: project.projectNumber,
          projectTitle: project.title,
          createdById: actor.id,
          createdByName: actorName,
          inputSnapshot: {
            schemaVersion: 2,
            ...(parsed.payload
              .input as WinterServiceCalculationInput),
          },
          resultSnapshot: {
            schemaVersion: 2,
            ...calculated,
          },
          generatedPackageIds: [],
          note: parsed.payload.note ?? "",
        },
      });
      const executedAt = new Date();
      const executedData: DraftIntegrityData = {
        ...confirmedData,
        state: "executed",
        executedAt,
        resultEntityType: "winterServiceCalculation",
        resultEntityId: calculationId,
      };
      const finalDraft = await tx.jarvisActionDraft.update({
        where: { id: current.id },
        data: {
          state: "executed",
          executedAt,
          resultEntityType: "winterServiceCalculation",
          resultEntityId: calculationId,
          integrityTag: createIntegrityTag(executedData),
        },
      });
      await appendAuditEvent(tx, {
        draft: finalDraft,
        eventType: "draft_confirmed_and_executed",
        result: {
          id: calculationId,
          entityType: "winterServiceCalculation",
        },
      });
      return finalDraft;
    });
    return toJarvisWinterCalculationDraftView(executed, binding);
  } catch (error) {
    if (
      error instanceof JarvisActionDraftError &&
      error.code === "conflict"
    ) {
      const latest = await loadBoundWinterCalculationDraft(
        previewId,
        binding,
        now
      );
      if (latest.draft.state === "executed") {
        return toJarvisWinterCalculationDraftView(
          latest.draft,
          binding
        );
      }
    }
    if (error instanceof JarvisActionDraftError) throw error;
    throw new JarvisActionDraftError(
      "execution_failed",
      "Die Winterdienst-Kalkulation wurde nicht gespeichert. Der Entwurf bleibt zur Prüfung erhalten.",
      500
    );
  }
}

type VehicleTripPayload = z.infer<typeof vehicleTripPayloadSchema>;
type VehicleTripContext = z.infer<typeof vehicleTripContextSchema>;

function validateVehicleTripBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Der Fahrtenentwurf gehört nicht zu dieser Sitzung, Organisation oder Rollenkombination.",
      403
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Fahrtenentwurf stimmt nicht mit seinem Integritätsnachweis überein.",
      409
    );
  }
  const payload = vehicleTripPayloadSchema.safeParse(draft.payload);
  const context = vehicleTripContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "vehicle-trip-calculation.prepare" ||
    !payload.success ||
    !context.success ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Payload oder Fahrzeugkontext wurden verändert.",
      409
    );
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundVehicleTripDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({
    where: { id: previewId },
  });
  if (!found) {
    throw new JarvisActionDraftError(
      "not_found",
      "Der Fahrtenkalkulationsentwurf wurde nicht gefunden.",
      404
    );
  }
  validateVehicleTripBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateVehicleTripBinding(current, binding);
  return { draft: current, ...parsed };
}

function maySaveVehicleTrip(binding: JarvisTaskDraftBinding) {
  return (
    canManageProjects(binding.profile.sessionActor) &&
    canManageProjects(binding.profile.effectiveActor)
  );
}

async function getVehicleTripOptions(binding: JarvisTaskDraftBinding) {
  const [vehicles, fuelPrice] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        organizationId: binding.organizationId,
        isActive: true,
      },
      orderBy: [{ name: "asc" }, { vehicleNumber: "asc" }],
      take: 500,
      select: {
        id: true,
        vehicleNumber: true,
        name: true,
        licensePlate: true,
        fuelType: true,
        consumptionLitersPer100Km: true,
        selfCostPerKm: true,
        salesPricePerKm: true,
        updatedAt: true,
      },
    }),
    loadVehicleFuelPrices(),
  ]);
  return {
    fuelPrice,
    vehicles: vehicles.map((vehicle) => ({
      ...vehicle,
      label: `${vehicle.vehicleNumber} · ${vehicle.name}${
        vehicle.licensePlate ? ` · ${vehicle.licensePlate}` : ""
      }`,
      liveFuelPrice: fuelPriceForVehicleType(
        vehicle.fuelType,
        fuelPrice
      ),
    })),
  };
}

function evaluateVehicleTrip(
  calculation: VehicleTripPayload["calculation"]
) {
  if (!calculation) return undefined;
  try {
    return calculateVehicleTrip(
      calculation.input as VehicleTripCalculationInput
    );
  } catch (error) {
    if (error instanceof VehicleTripCalculationValidationError) {
      return undefined;
    }
    throw error;
  }
}

export async function toJarvisVehicleTripCalculationDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): Promise<JarvisVehicleTripCalculationDraftView> {
  const { payload } = validateVehicleTripBinding(draft, binding);
  const { vehicles, fuelPrice } = await getVehicleTripOptions(binding);
  const selectedVehicle = payload.vehicleId
    ? vehicles.find((vehicle) => vehicle.id === payload.vehicleId)
    : undefined;
  const calculated = evaluateVehicleTrip(payload.calculation);
  const savePermitted = maySaveVehicleTrip(binding);
  const missingFields = [
    ...(!selectedVehicle ? ["Aktives Fahrzeug"] : []),
    ...(!(payload.distanceKm > 0) ? ["Gesamtstrecke"] : []),
    ...(!calculated &&
    selectedVehicle &&
    selectedVehicle.fuelType !== "ELECTRIC" &&
    payload.fuelPriceMode === "live" &&
    selectedVehicle.liveFuelPrice === null
      ? ["Live-Kraftstoffpreis oder manueller Preis"]
      : []),
    ...(selectedVehicle &&
    selectedVehicle.fuelType !== "ELECTRIC" &&
    payload.fuelPriceMode === "manual" &&
    !(payload.manualFuelPricePerLiter >= 0)
      ? ["Manueller Kraftstoffpreis"]
      : []),
    ...(calculated && !savePermitted
      ? ["Dauerhaftes Speichern ist für diese Rolle nicht freigegeben"]
      : []),
  ];
  const state =
    draft.state as JarvisVehicleTripCalculationDraftView["state"];
  const isOpen =
    state === "awaiting_input" || state === "awaiting_confirmation";
  const ready =
    state === "awaiting_confirmation" &&
    Boolean(calculated) &&
    Boolean(selectedVehicle) &&
    savePermitted;
  const reason: JarvisVehicleTripCalculationDraftView["confirmation"]["reason"] =
    state === "expired"
      ? "expired"
      : state === "cancelled"
        ? "cancelled"
        : state === "executed"
          ? "executed"
          : state === "executing"
            ? "executing"
            : !savePermitted
              ? "not_permitted"
              : ready
                ? "ready"
                : "missing_fields";
  const badge: JarvisVehicleTripCalculationDraftView["badge"] =
    state === "executed"
      ? "Gespeichert"
      : state === "executing"
        ? "Wird gespeichert"
        : state === "cancelled"
          ? "Abgebrochen"
          : state === "expired"
            ? "Abgelaufen"
            : calculated
              ? "Berechnet"
              : "Entwurf";
  const currency = (value: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  return {
    version: 2,
    previewId: draft.id,
    actionId: "vehicle-trip-calculation.prepare",
    title: "Fahrt und Fahrzeugkosten kalkulieren",
    badge,
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    fields: [
      {
        label: "Rechenlogik",
        value: "Zentraler WorkPilot-Fahrtenrechner ohne Personalkosten",
      },
      {
        label: "Fahrzeug",
        value: selectedVehicle?.label || "Noch nicht ausgewählt",
      },
      {
        label: "Preisquelle",
        value:
          payload.calculation?.priceSource ||
          (payload.fuelPriceMode === "live"
            ? fuelPrice.source
            : "Manuelle Eingabe"),
      },
      ...(calculated
        ? [
            {
              label: "Gesamte Selbstkosten",
              value: currency(calculated.totalSelfCost),
            },
            {
              label: "Verkaufspreis Fahrt",
              value: currency(calculated.totalSales),
            },
          ]
        : []),
    ],
    missingFields,
    editor: {
      vehicleId: payload.vehicleId ?? "",
      distanceKm: payload.distanceKm,
      fuelPriceMode: payload.fuelPriceMode,
      manualFuelPricePerLiter: payload.manualFuelPricePerLiter,
      note: payload.note ?? "",
      vehicleOptions: vehicles.map((vehicle) => ({
        id: vehicle.id,
        label: vehicle.label,
        fuelType: vehicle.fuelType,
        consumptionLitersPer100Km:
          vehicle.consumptionLitersPer100Km,
        selfCostPerKm: vehicle.selfCostPerKm,
        salesPricePerKm: vehicle.salesPricePerKm,
        updatedAt: vehicle.updatedAt.toISOString(),
        liveFuelPrice: vehicle.liveFuelPrice,
      })),
      fuelPrice: {
        status: fuelPrice.status,
        source: fuelPrice.source,
        stationLabel: `${fuelPrice.station.name} · ${fuelPrice.station.address}`,
        fetchedAt: fuelPrice.fetchedAt,
        message: fuelPrice.message,
      },
    },
    ...(calculated && payload.calculation
      ? {
          calculation: {
            input:
              payload.calculation.input as VehicleTripCalculationInput,
            result: calculated,
            priceSource: payload.calculation.priceSource,
            priceFetchedAt: payload.calculation.priceFetchedAt,
            includesPersonnelCosts: false as const,
          },
        }
      : {}),
    confirmation: { enabled: ready, reason },
    cancellation: { enabled: isOpen },
    execution: {
      enabled: false,
      reason:
        state === "executed" ? "finalized" : "requires_confirmation",
    },
    ...(state === "executed" &&
    draft.resultEntityType === "vehicleCalculation" &&
    draft.resultEntityId
      ? {
          result: {
            entityType: "vehicleCalculation" as const,
            entityId: draft.resultEntityId,
            label: "Gespeicherte Fahrtenkalkulation öffnen",
          },
        }
      : {}),
  };
}

export async function createPersistedJarvisVehicleTripCalculationDraft(
  input: {
    organizationId: string;
    sessionId: string;
    profile: JarvisAccessProfile;
    now?: Date;
  }
) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für eine JARVIS-Fahrtenkalkulation ist eine aktuelle Sitzung erforderlich.",
      401
    );
  }
  if (
    input.profile.sessionActor.role === Role.GAST ||
    input.profile.effectiveActor.role === Role.GAST
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Rollenkombination darf keine interne Fahrzeugkalkulation vorbereiten.",
      403
    );
  }
  const now = input.now ?? new Date();
  const actorIds = getActorIds(input.profile);
  const payload = vehicleTripPayloadSchema.parse({
    distanceKm: 0,
    fuelPriceMode: "live",
    manualFuelPricePerLiter: 0,
  });
  const context: VehicleTripContext = {};
  const draftData: DraftIntegrityData = {
    id: randomUUID(),
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId: "vehicle-trip-calculation.prepare",
    state: "awaiting_input",
    revision: 1,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    expiresAt: new Date(
      now.getTime() + JARVIS_VEHICLE_TRIP_DRAFT_TTL_MS
    ),
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode: null,
  };
  const draft = await prisma.$transaction(async (tx) => {
    const created = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag: createIntegrityTag(draftData),
      },
    });
    await appendAuditEvent(tx, {
      draft: created,
      eventType: "draft_created",
    });
    return created;
  });
  return toJarvisVehicleTripCalculationDraftView(draft, {
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    profile: input.profile,
  });
}

export async function getJarvisVehicleTripCalculationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundVehicleTripDraft(
    previewId,
    binding,
    now
  );
  return toJarvisVehicleTripCalculationDraftView(draft, binding);
}

export async function completeJarvisVehicleTripCalculationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  rawInput: unknown,
  now = new Date()
) {
  const completed = completeVehicleTripDraftSchema.safeParse(rawInput);
  if (!completed.success) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Die Fahrteneingaben sind unvollständig oder ungültig.",
      400
    );
  }
  const loaded = await loadBoundVehicleTripDraft(
    previewId,
    binding,
    now
  );
  if (loaded.draft.revision !== completed.data.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Die Fahrtenkalkulation wurde zwischenzeitlich verändert.",
      409
    );
  }
  if (!OPEN_DRAFT_STATES.includes(loaded.draft.state as never)) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "invalid_state",
      "Diese Fahrtenkalkulation kann nicht mehr bearbeitet werden.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  if (completed.data.note) {
    const authorization = authorizeJarvisQuestion(
      completed.data.note,
      binding.profile
    );
    if (
      authorization.reason === "prompt_injection" ||
      authorization.reason === "secret"
    ) {
      throw new JarvisActionDraftError(
        "invalid_input",
        "Die Notiz enthält eine gesperrte technische Anweisung oder ein Geheimnis.",
        400
      );
    }
  }
  const vehicle = completed.data.vehicleId
    ? await prisma.vehicle.findFirst({
        where: {
          id: completed.data.vehicleId,
          organizationId: binding.organizationId,
          isActive: true,
        },
        select: {
          id: true,
          fuelType: true,
          consumptionLitersPer100Km: true,
          selfCostPerKm: true,
          salesPricePerKm: true,
          updatedAt: true,
        },
      })
    : null;
  const fuelPayload = await loadVehicleFuelPrices();
  let calculation: VehicleTripPayload["calculation"];
  let validationFailed = false;
  if (vehicle && completed.data.distanceKm > 0) {
    const liveFuelPrice = fuelPriceForVehicleType(
      vehicle.fuelType,
      fuelPayload
    );
    const isElectric = vehicle.fuelType === "ELECTRIC";
    const fuelPricePerLiter = isElectric
      ? 0
      : completed.data.fuelPriceMode === "live"
        ? liveFuelPrice
        : completed.data.manualFuelPricePerLiter;
    if (
      typeof fuelPricePerLiter === "number" &&
      Number.isFinite(fuelPricePerLiter) &&
      fuelPricePerLiter >= 0
    ) {
      const normalizedInput: VehicleTripCalculationInput = {
        distanceKm: completed.data.distanceKm,
        consumptionLitersPer100Km:
          vehicle.consumptionLitersPer100Km,
        fuelPricePerLiter,
        selfCostPerKm: vehicle.selfCostPerKm,
        salesPricePerKm: vehicle.salesPricePerKm,
      };
      try {
        calculateVehicleTrip(normalizedInput);
        calculation = {
          input: normalizedInput,
          priceSource: isElectric
            ? "Elektrisches Fahrzeug · kein Literpreis"
            : completed.data.fuelPriceMode === "live"
              ? `${fuelPayload.source} · ${fuelPayload.station.name}`
              : "Manuelle Eingabe",
          priceFetchedAt:
            !isElectric && completed.data.fuelPriceMode === "live"
              ? fuelPayload.fetchedAt
              : null,
        };
      } catch (error) {
        if (error instanceof VehicleTripCalculationValidationError) {
          validationFailed = true;
        } else {
          throw error;
        }
      }
    } else {
      validationFailed = true;
    }
  } else {
    validationFailed = true;
  }
  const nextPayload = vehicleTripPayloadSchema.parse({
    ...(vehicle ? { vehicleId: vehicle.id } : {}),
    distanceKm: completed.data.distanceKm,
    fuelPriceMode: completed.data.fuelPriceMode,
    manualFuelPricePerLiter: completed.data.manualFuelPricePerLiter,
    ...(completed.data.note ? { note: completed.data.note } : {}),
    ...(calculation ? { calculation } : {}),
  });
  const context: VehicleTripContext = vehicle
    ? {
        vehicleId: vehicle.id,
        vehicleUpdatedAt: vehicle.updatedAt.toISOString(),
      }
    : {};
  const revision = loaded.draft.revision + 1;
  const nextData: DraftIntegrityData = {
    ...loaded.draft,
    state: calculation
      ? "awaiting_confirmation"
      : "awaiting_input",
    revision,
    payloadHash: hashJson(nextPayload),
    contextHash: hashJson(context),
    lastErrorCode: validationFailed ? "invalid_input" : null,
  };
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: loaded.draft.id,
        revision: loaded.draft.revision,
        state: loaded.draft.state,
        integrityTag: loaded.draft.integrityTag,
      },
      data: {
        state: nextData.state,
        revision,
        payload: nextPayload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        payloadHash: nextData.payloadHash,
        contextHash: nextData.contextHash,
        lastErrorCode: nextData.lastErrorCode,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Die Fahrtenkalkulation wurde zwischenzeitlich verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: loaded.draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: calculation
        ? "draft_calculated"
        : "draft_validation_failed",
      ...(!calculation ? { reasonCode: "invalid_input" } : {}),
    });
    return current;
  });
  return toJarvisVehicleTripCalculationDraftView(updated, binding);
}

export async function cancelJarvisVehicleTripCalculationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const { draft } = await loadBoundVehicleTripDraft(
    previewId,
    binding,
    now
  );
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) {
    if (draft.state === "cancelled") {
      return toJarvisVehicleTripCalculationDraftView(draft, binding);
    }
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "invalid_state",
      "Diese Fahrtenkalkulation kann nicht mehr abgebrochen werden.",
      draft.state === "expired" ? 410 : 409
    );
  }
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision !== draft.revision
  ) {
    throw new JarvisActionDraftError(
      "conflict",
      "Die Fahrtenkalkulation wurde zwischenzeitlich verändert.",
      409
    );
  }
  const nextData: DraftIntegrityData = {
    ...draft,
    state: "cancelled",
    cancelledAt: now,
    lastErrorCode: null,
  };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "cancelled",
        cancelledAt: now,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Die Fahrtenkalkulation wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_cancelled",
      reasonCode: "user_cancelled",
    });
    return current;
  });
  return toJarvisVehicleTripCalculationDraftView(cancelled, binding);
}

export async function confirmJarvisVehicleTripCalculationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const loaded = await loadBoundVehicleTripDraft(
    previewId,
    binding,
    now
  );
  if (loaded.draft.state === "executed") {
    return toJarvisVehicleTripCalculationDraftView(
      loaded.draft,
      binding
    );
  }
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision !== loaded.draft.revision
  ) {
    throw new JarvisActionDraftError(
      "conflict",
      "Die Fahrtenkalkulation wurde zwischenzeitlich verändert.",
      409
    );
  }
  if (
    loaded.draft.state !== "awaiting_confirmation" ||
    !loaded.payload.calculation ||
    !loaded.context.vehicleId ||
    !loaded.context.vehicleUpdatedAt
  ) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "invalid_input",
      "Nur eine vollständig berechnete Fahrt darf gespeichert werden.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  if (!maySaveVehicleTrip(binding)) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Deine aktuelle Rollenkombination darf rechnen, aber keine Fahrtenkalkulation dauerhaft speichern.",
      403
    );
  }
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({
        where: { id: loaded.draft.id },
      });
      if (!current) {
        throw new JarvisActionDraftError(
          "not_found",
          "Die Fahrtenkalkulation wurde nicht gefunden.",
          404
        );
      }
      const parsed = validateVehicleTripBinding(current, binding);
      if (current.state === "executed") return current;
      if (
        current.state !== "awaiting_confirmation" ||
        current.expiresAt.getTime() <= now.getTime() ||
        !parsed.payload.calculation ||
        !parsed.context.vehicleId ||
        !parsed.context.vehicleUpdatedAt
      ) {
        throw new JarvisActionDraftError(
          current.expiresAt.getTime() <= now.getTime()
            ? "expired"
            : "conflict",
          "Die Fahrtenkalkulation ist nicht mehr ausführbar.",
          current.expiresAt.getTime() <= now.getTime() ? 410 : 409
        );
      }
      const [vehicle, actor] = await Promise.all([
        tx.vehicle.findFirst({
          where: {
            id: parsed.context.vehicleId,
            organizationId: binding.organizationId,
            isActive: true,
          },
        }),
        tx.user.findFirst({
          where: {
            id: current.effectiveActorId,
            organizationId: binding.organizationId,
            isActive: true,
          },
          select: {
            id: true,
            role: true,
            firstName: true,
            lastName: true,
            email: true,
            salesRoleEnabled: true,
          },
        }),
      ]);
      if (
        !vehicle ||
        vehicle.updatedAt.toISOString() !==
          parsed.context.vehicleUpdatedAt
      ) {
        throw new JarvisActionDraftError(
          "stale_context",
          "Das Fahrzeug wurde seit der Berechnung verändert. Bitte rechne erneut.",
          409
        );
      }
      if (!actor || !canManageProjects(actor)) {
        throw new JarvisActionDraftError(
          "role_changed",
          "Akteur oder Speicherberechtigung sind nicht mehr aktuell.",
          409
        );
      }
      const normalizedInput =
        parsed.payload.calculation.input as VehicleTripCalculationInput;
      if (
        normalizedInput.consumptionLitersPer100Km !==
          vehicle.consumptionLitersPer100Km ||
        normalizedInput.selfCostPerKm !== vehicle.selfCostPerKm ||
        normalizedInput.salesPricePerKm !== vehicle.salesPricePerKm
      ) {
        throw new JarvisActionDraftError(
          "stale_context",
          "Die gespeicherten Fahrzeugwerte stimmen nicht mehr mit dem Fahrzeugstamm überein.",
          409
        );
      }
      const calculated: VehicleTripCalculationResult =
        calculateVehicleTrip(normalizedInput);
      const confirmedData: DraftIntegrityData = {
        ...current,
        state: "executing",
        confirmedAt: now,
        lastErrorCode: null,
      };
      const claimed = await tx.jarvisActionDraft.updateMany({
        where: {
          id: current.id,
          revision: current.revision,
          state: "awaiting_confirmation",
          integrityTag: current.integrityTag,
        },
        data: {
          state: "executing",
          confirmedAt: now,
          lastErrorCode: null,
          integrityTag: createIntegrityTag(confirmedData),
        },
      });
      if (claimed.count !== 1) {
        throw new JarvisActionDraftError(
          "conflict",
          "Die Fahrtenkalkulation wird bereits gespeichert.",
          409
        );
      }
      const calculationId = randomUUID();
      const actorName =
        [actor.firstName, actor.lastName].filter(Boolean).join(" ") ||
        actor.email;
      await tx.vehicleCalculation.create({
        data: {
          id: calculationId,
          organizationId: binding.organizationId,
          vehicleId: vehicle.id,
          vehicleNumber: vehicle.vehicleNumber,
          vehicleName: vehicle.name,
          customerId: "",
          projectId: "",
          createdById: actor.id,
          createdByName: actorName,
          inputSnapshot: {
            schemaVersion: 2,
            ...normalizedInput,
            vehicle: {
              id: vehicle.id,
              vehicleNumber: vehicle.vehicleNumber,
              name: vehicle.name,
              licensePlate: vehicle.licensePlate,
              fuelType: vehicle.fuelType,
              updatedAt: vehicle.updatedAt.toISOString(),
            },
          },
          resultSnapshot: {
            schemaVersion: 2,
            ...calculated,
          },
          fuelPriceSource:
            parsed.payload.calculation.priceSource,
          fuelPriceFetchedAt:
            parsed.payload.calculation.priceFetchedAt
              ? new Date(
                  parsed.payload.calculation.priceFetchedAt
                )
              : null,
          note: parsed.payload.note ?? "",
        },
      });
      const executedAt = new Date();
      const executedData: DraftIntegrityData = {
        ...confirmedData,
        state: "executed",
        executedAt,
        resultEntityType: "vehicleCalculation",
        resultEntityId: calculationId,
      };
      const finalDraft = await tx.jarvisActionDraft.update({
        where: { id: current.id },
        data: {
          state: "executed",
          executedAt,
          resultEntityType: "vehicleCalculation",
          resultEntityId: calculationId,
          integrityTag: createIntegrityTag(executedData),
        },
      });
      await appendAuditEvent(tx, {
        draft: finalDraft,
        eventType: "draft_confirmed_and_executed",
        result: {
          id: calculationId,
          entityType: "vehicleCalculation",
        },
      });
      return finalDraft;
    });
    return toJarvisVehicleTripCalculationDraftView(executed, binding);
  } catch (error) {
    if (
      error instanceof JarvisActionDraftError &&
      error.code === "conflict"
    ) {
      const latest = await loadBoundVehicleTripDraft(
        previewId,
        binding,
        now
      );
      if (latest.draft.state === "executed") {
        return toJarvisVehicleTripCalculationDraftView(
          latest.draft,
          binding
        );
      }
    }
    if (error instanceof JarvisActionDraftError) throw error;
    throw new JarvisActionDraftError(
      "execution_failed",
      "Die Fahrtenkalkulation wurde nicht gespeichert. Der Entwurf bleibt erhalten.",
      500
    );
  }
}

type OfferPayload = z.infer<typeof offerDraftPayloadSchema>;
type OfferContext = z.infer<typeof offerDraftContextSchema>;

function mayManageOfferDraft(binding: JarvisTaskDraftBinding) {
  return (
    canManageOffers(binding.profile.sessionActor) &&
    canManageOffers(binding.profile.effectiveActor)
  );
}

function validateOfferDraftBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Dieser Angebotsentwurf gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.",
      403
    );
  }
  if (
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role
  ) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Die Rolle hat sich seit Erstellung des Angebotsentwurfs geändert. Bitte erstelle eine neue Vorschau.",
      409
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Integritätsnachweis des Angebotsentwurfs ist ungültig. Es wurde nichts ausgeführt.",
      409
    );
  }
  const payload = offerDraftPayloadSchema.safeParse(draft.payload);
  const context = offerDraftContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "offer.prepare" ||
    !payload.success ||
    !context.success ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Angebotsentwurf oder sein Fachkontext stimmt nicht mit dem Integritätsnachweis überein.",
      409
    );
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundOfferDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({
    where: { id: previewId },
  });
  if (!found) {
    throw new JarvisActionDraftError(
      "not_found",
      "Der Angebotsentwurf wurde nicht gefunden.",
      404
    );
  }
  validateOfferDraftBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateOfferDraftBinding(current, binding);
  return { draft: current, ...parsed };
}

function offerContextFromEvaluation(evaluated: Awaited<ReturnType<typeof evaluateOfferDraft>>) {
  return offerDraftContextSchema.parse({
    ...(evaluated.project
      ? {
          projectId: evaluated.project.id,
          projectUpdatedAt: evaluated.project.updatedAt,
        }
      : {}),
    ...(evaluated.parentOffer
      ? {
          parentOfferId: evaluated.parentOffer.id,
          parentOfferUpdatedAt: evaluated.parentOffer.updatedAt,
        }
      : {}),
    catalogVersions: evaluated.catalogVersions,
  });
}

function offerPayloadFromEvaluation(
  evaluated: Awaited<ReturnType<typeof evaluateOfferDraft>>
) {
  return offerDraftPayloadSchema.parse(evaluated.input);
}

function offerDraftIsReady(
  evaluated: Awaited<ReturnType<typeof evaluateOfferDraft>>,
  binding: JarvisTaskDraftBinding
) {
  return (
    mayManageOfferDraft(binding) &&
    evaluated.missingFields.length === 0 &&
    evaluated.errors.length === 0 &&
    Boolean(evaluated.project)
  );
}

function offerBadge(
  state: JarvisTaskActionDraftState
): JarvisOfferDraftView["badge"] {
  if (state === "executed") return "Gespeichert";
  if (state === "executing") return "Wird gespeichert";
  if (state === "cancelled") return "Abgebrochen";
  if (state === "expired") return "Abgelaufen";
  if (state === "awaiting_confirmation") return "Bereit";
  return "Entwurf";
}

export async function toJarvisOfferDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): Promise<JarvisOfferDraftView> {
  const { payload } = validateOfferDraftBinding(draft, binding);
  const [evaluated, workspace] = await Promise.all([
    evaluateOfferDraft({
      organizationId: binding.organizationId,
      draft: payload,
      restrictToCatalog: true,
    }),
    loadOfferDraftWorkspace(binding.organizationId),
  ]);
  const state = draft.state as JarvisTaskActionDraftState;
  const ready =
    state === "awaiting_confirmation" &&
    offerDraftIsReady(evaluated, binding);
  const permitted = mayManageOfferDraft(binding);
  const reason: JarvisOfferDraftView["confirmation"]["reason"] =
    state === "expired"
      ? "expired"
      : state === "cancelled"
        ? "cancelled"
        : state === "executed"
          ? "executed"
          : state === "executing"
            ? "executing"
            : !permitted
              ? "not_permitted"
              : evaluated.errors.length > 0
                ? "invalid_input"
                : ready
                  ? "ready"
                  : "missing_fields";
  const currency = (value: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  const isOpen =
    state === "awaiting_input" || state === "awaiting_confirmation";
  return {
    version: 2,
    previewId: draft.id,
    actionId: "offer.prepare",
    title: "Angebot oder Nachtrag vorbereiten",
    badge: offerBadge(state),
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    fields: [
      {
        label: "Dokumentart",
        value:
          payload.offerType === "addendum"
            ? "Nachtragsentwurf"
            : "Angebotsentwurf",
      },
      {
        label: "Projekt",
        value: evaluated.project
          ? `${evaluated.project.projectNumber} · ${evaluated.project.projectTitle}`
          : "Noch nicht ausgewählt",
      },
      {
        label: "Kunde",
        value: evaluated.project?.customerName || "Noch nicht bestimmt",
      },
      {
        label: "Netto",
        value: currency(evaluated.totals.netTotal),
      },
      {
        label: "Brutto",
        value: currency(evaluated.totals.grossTotal),
      },
    ],
    missingFields: [
      ...evaluated.missingFields,
      ...(!permitted
        ? ["Speichern ist für diese Rollenkombination nicht freigegeben"]
        : []),
    ],
    errors: evaluated.errors,
    warnings: evaluated.warnings,
    editor: {
      ...evaluated.input,
      projectOptions: workspace.projectOptions,
      catalogOptions: workspace.catalogOptions,
      parentOfferOptions: workspace.parentOfferOptions.filter(
        (offer) => !evaluated.input.projectId || offer.projectId === evaluated.input.projectId
      ),
    },
    calculation: evaluated.totals,
    confirmation: { enabled: ready, reason },
    cancellation: { enabled: isOpen },
    execution: {
      enabled: false,
      reason: state === "executed" ? "finalized" : "requires_confirmation",
    },
    ...(state === "executed" &&
    draft.resultEntityType === "offer" &&
    draft.resultEntityId
      ? {
          result: {
            entityType: "offer" as const,
            entityId: draft.resultEntityId,
            label: "Gespeicherten Angebotsentwurf öffnen",
          },
        }
      : {}),
  };
}

export async function createPersistedJarvisOfferDraft(input: {
  preview: JarvisActionPreview<"offer.prepare">;
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  now?: Date;
}) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für einen bestätigbaren Angebotsentwurf ist eine aktuelle Sitzung erforderlich.",
      401
    );
  }
  if (!mayManageOfferDraft(input)) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Rollenkombination darf keine Angebote oder Nachträge vorbereiten.",
      403
    );
  }
  const now = input.now ?? new Date();
  const evaluated = await evaluateOfferDraft({
    organizationId: input.organizationId,
    draft: input.preview.payload,
    restrictToCatalog: true,
  });
  const payload = offerPayloadFromEvaluation(evaluated);
  const context = offerContextFromEvaluation(evaluated);
  const actorIds = getActorIds(input.profile);
  const state = offerDraftIsReady(evaluated, input)
    ? "awaiting_confirmation"
    : "awaiting_input";
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId,
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId: "offer.prepare",
    state,
    revision: 1,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_OFFER_DRAFT_TTL_MS),
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode: evaluated.errors.length ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag: createIntegrityTag(draftData),
      },
    });
    await appendAuditEvent(tx, {
      draft,
      eventType: state === "awaiting_confirmation"
        ? "draft_created_ready"
        : "draft_created",
    });
    return draft;
  });
  return toJarvisOfferDraftView(created, input);
}

export async function getJarvisOfferDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundOfferDraft(previewId, binding, now);
  return toJarvisOfferDraftView(draft, binding);
}

export async function completeJarvisOfferDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  rawInput: unknown,
  now = new Date()
) {
  const completed = completeOfferDraftSchema.safeParse(rawInput);
  if (!completed.success) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Die Angebotsangaben sind unvollständig oder ungültig.",
      400
    );
  }
  const loaded = await loadBoundOfferDraft(previewId, binding, now);
  if (loaded.draft.revision !== completed.data.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Der Angebotsentwurf wurde zwischenzeitlich verändert.",
      409
    );
  }
  if (!OPEN_DRAFT_STATES.includes(loaded.draft.state as never)) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "invalid_state",
      "Dieser Angebotsentwurf kann nicht mehr bearbeitet werden.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  const protectedText = [
    completed.data.introText,
    completed.data.closingText,
    ...completed.data.lines.map((line) => line.description),
  ]
    .filter(Boolean)
    .join("\n");
  if (protectedText) {
    const authorization = authorizeJarvisQuestion(
      protectedText,
      binding.profile
    );
    if (
      authorization.reason === "prompt_injection" ||
      authorization.reason === "secret"
    ) {
      throw new JarvisActionDraftError(
        "invalid_input",
        "Der Angebotstext enthält eine gesperrte technische Anweisung oder ein Geheimnis.",
        400
      );
    }
  }
  const evaluated = await evaluateOfferDraft({
    organizationId: binding.organizationId,
    draft: completed.data,
    restrictToCatalog: true,
  });
  const payload = offerPayloadFromEvaluation(evaluated);
  const context = offerContextFromEvaluation(evaluated);
  const ready = offerDraftIsReady(evaluated, binding);
  const revision = loaded.draft.revision + 1;
  const nextData: DraftIntegrityData = {
    ...loaded.draft,
    state: ready ? "awaiting_confirmation" : "awaiting_input",
    revision,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    lastErrorCode: evaluated.errors.length ? "invalid_input" : null,
  };
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: loaded.draft.id,
        revision: loaded.draft.revision,
        state: loaded.draft.state,
        integrityTag: loaded.draft.integrityTag,
      },
      data: {
        state: nextData.state,
        revision,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        payloadHash: nextData.payloadHash,
        contextHash: nextData.contextHash,
        lastErrorCode: nextData.lastErrorCode,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Angebotsentwurf wurde zwischenzeitlich verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: loaded.draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: ready ? "draft_recalculated" : "draft_validation_failed",
      ...(!ready ? { reasonCode: "invalid_input" } : {}),
    });
    return current;
  });
  return toJarvisOfferDraftView(updated, binding);
}

export async function cancelJarvisOfferDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const { draft } = await loadBoundOfferDraft(previewId, binding, now);
  if (draft.state === "cancelled") {
    return toJarvisOfferDraftView(draft, binding);
  }
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) {
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "invalid_state",
      "Dieser Angebotsentwurf kann nicht mehr abgebrochen werden.",
      draft.state === "expired" ? 410 : 409
    );
  }
  if (expectedRevision !== draft.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Der Angebotsentwurf wurde zwischenzeitlich verändert.",
      409
    );
  }
  const nextData: DraftIntegrityData = {
    ...draft,
    state: "cancelled",
    cancelledAt: now,
    lastErrorCode: null,
  };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "cancelled",
        cancelledAt: now,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Der Angebotsentwurf wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_cancelled",
      reasonCode: "user_cancelled",
    });
    return current;
  });
  return toJarvisOfferDraftView(cancelled, binding);
}

export async function confirmJarvisOfferDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const loaded = await loadBoundOfferDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") {
    return toJarvisOfferDraftView(loaded.draft, binding);
  }
  if (
    expectedRevision !== loaded.draft.revision ||
    loaded.draft.state !== "awaiting_confirmation"
  ) {
    throw new JarvisActionDraftError(
      "conflict",
      "Nur die aktuelle, vollständig geprüfte Angebotsvorschau darf gespeichert werden.",
      409
    );
  }
  if (!mayManageOfferDraft(binding)) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Rollenkombination darf keinen Angebotsentwurf speichern.",
      403
    );
  }
  try {
    const executed = await prisma.$transaction(
      async (tx) => {
        const current = await tx.jarvisActionDraft.findUnique({
          where: { id: loaded.draft.id },
        });
        if (!current) {
          throw new JarvisActionDraftError(
            "not_found",
            "Der Angebotsentwurf wurde nicht gefunden.",
            404
          );
        }
        const parsed = validateOfferDraftBinding(current, binding);
        if (current.state === "executed") return current;
        if (
          current.state !== "awaiting_confirmation" ||
          current.expiresAt.getTime() <= now.getTime()
        ) {
          throw new JarvisActionDraftError(
            current.expiresAt.getTime() <= now.getTime()
              ? "expired"
              : "conflict",
            "Der Angebotsentwurf ist nicht mehr ausführbar.",
            current.expiresAt.getTime() <= now.getTime() ? 410 : 409
          );
        }
        const actor = await tx.user.findFirst({
          where: {
            id: current.effectiveActorId,
            organizationId: binding.organizationId,
            isActive: true,
          },
          select: {
            id: true,
            role: true,
            firstName: true,
            lastName: true,
            email: true,
            salesRoleEnabled: true,
          },
        });
        if (!actor || !canManageOffers(actor)) {
          throw new JarvisActionDraftError(
            "role_changed",
            "Akteur oder Angebotsberechtigung sind nicht mehr aktuell.",
            409
          );
        }
        const reevaluated = await evaluateOfferDraft({
          organizationId: binding.organizationId,
          draft: parsed.payload,
          db: tx,
          restrictToCatalog: true,
        });
        const currentContext = offerContextFromEvaluation(reevaluated);
        if (
          hashJson(currentContext) !== hashJson(parsed.context) ||
          !offerDraftIsReady(reevaluated, binding)
        ) {
          throw new JarvisActionDraftError(
            "stale_context",
            "Projekt, Bezugsangebot oder Katalogdaten haben sich geändert. Bitte prüfe und berechne den Entwurf erneut.",
            409
          );
        }
        const claimedData: DraftIntegrityData = {
          ...current,
          state: "executing",
          confirmedAt: now,
          lastErrorCode: null,
        };
        const claimed = await tx.jarvisActionDraft.updateMany({
          where: {
            id: current.id,
            revision: current.revision,
            state: "awaiting_confirmation",
            integrityTag: current.integrityTag,
          },
          data: {
            state: "executing",
            confirmedAt: now,
            lastErrorCode: null,
            integrityTag: createIntegrityTag(claimedData),
          },
        });
        if (claimed.count !== 1) {
          throw new JarvisActionDraftError(
            "conflict",
            "Der Angebotsentwurf wird bereits gespeichert.",
            409
          );
        }
        const actorName =
          [actor.firstName, actor.lastName].filter(Boolean).join(" ") ||
          actor.email;
        const offer = await createConfirmedOfferDraft({
          tx,
          organizationId: binding.organizationId,
          actorName,
          draft: parsed.payload,
          source: "jarvis",
        });
        const executedAt = new Date();
        const executedData: DraftIntegrityData = {
          ...claimedData,
          state: "executed",
          executedAt,
          resultEntityType: "offer",
          resultEntityId: offer.id,
        };
        const finalDraft = await tx.jarvisActionDraft.update({
          where: { id: current.id },
          data: {
            state: "executed",
            executedAt,
            resultEntityType: "offer",
            resultEntityId: offer.id,
            integrityTag: createIntegrityTag(executedData),
          },
        });
        await appendAuditEvent(tx, {
          draft: finalDraft,
          eventType: "draft_confirmed_and_executed",
          result: { id: offer.id, entityType: "offer" },
        });
        return finalDraft;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return toJarvisOfferDraftView(executed, binding);
  } catch (error) {
    if (
      error instanceof JarvisActionDraftError &&
      error.code === "conflict"
    ) {
      const latest = await loadBoundOfferDraft(previewId, binding, now);
      if (latest.draft.state === "executed") {
        return toJarvisOfferDraftView(latest.draft, binding);
      }
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof OfferDraftServiceError) {
      throw new JarvisActionDraftError(
        error.code === "stale_context" ? "stale_context" : "invalid_input",
        error.message,
        409
      );
    }
    throw new JarvisActionDraftError(
      "execution_failed",
      "Der Angebotsentwurf wurde nicht gespeichert und bleibt zur Prüfung erhalten.",
      500
    );
  }
}

type InvoicePayload = z.infer<typeof invoiceDraftPayloadSchema>;

function mayManageInvoiceDraft(binding: JarvisTaskDraftBinding) {
  return canManageInvoices(binding.profile.sessionActor) && canManageInvoices(binding.profile.effectiveActor);
}

function validateInvoiceDraftBinding(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError("scope_mismatch", "Dieser Rechnungsentwurf gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.", 403);
  }
  if (draft.sessionActorRole !== binding.profile.sessionActor.role || draft.effectiveActorRole !== binding.profile.effectiveActor.role) {
    throw new JarvisActionDraftError("role_changed", "Die Rolle hat sich seit Erstellung des Rechnungsentwurfs geändert. Bitte erstelle eine neue Vorschau.", 409);
  }
  if (!integrityMatches(draft)) throw new JarvisActionDraftError("integrity_failed", "Der Integritätsnachweis des Rechnungsentwurfs ist ungültig. Es wurde nichts ausgeführt.", 409);
  const payload = invoiceDraftPayloadSchema.safeParse(draft.payload);
  const context = invoiceDraftContextSchema.safeParse(draft.context);
  if (draft.actionId !== "invoice.prepare" || !payload.success || !context.success || hashJson(payload.data) !== draft.payloadHash || hashJson(context.data) !== draft.contextHash) {
    throw new JarvisActionDraftError("integrity_failed", "Rechnungsentwurf oder Fakturakontext stimmen nicht mit dem Integritätsnachweis überein.", 409);
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundInvoiceDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) throw new JarvisActionDraftError("not_found", "Der Rechnungsentwurf wurde nicht gefunden.", 404);
  validateInvoiceDraftBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateInvoiceDraftBinding(current, binding);
  return { draft: current, ...parsed };
}

function invoiceContextFromEvaluation(evaluated: Awaited<ReturnType<typeof evaluateInvoiceDraft>>) {
  return invoiceDraftContextSchema.parse({
    ...(evaluated.project ? { projectId: evaluated.project.id, projectUpdatedAt: evaluated.project.updatedAt } : {}),
    ...(evaluated.sourceOffer ? { sourceOfferId: evaluated.sourceOffer.id, sourceOfferUpdatedAt: evaluated.sourceOffer.updatedAt } : {}),
    catalogVersions: evaluated.catalogVersions,
  });
}

function invoicePayloadFromEvaluation(evaluated: Awaited<ReturnType<typeof evaluateInvoiceDraft>>) {
  return invoiceDraftPayloadSchema.parse(evaluated.input);
}

function invoiceDraftIsReady(evaluated: Awaited<ReturnType<typeof evaluateInvoiceDraft>>, binding: JarvisTaskDraftBinding) {
  return mayManageInvoiceDraft(binding) && evaluated.missingFields.length === 0 && evaluated.errors.length === 0 && Boolean(evaluated.project);
}

export async function toJarvisInvoiceDraftView(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding): Promise<JarvisInvoiceDraftView> {
  const { payload } = validateInvoiceDraftBinding(draft, binding);
  const [evaluated, workspace] = await Promise.all([
    evaluateInvoiceDraft({ organizationId: binding.organizationId, draft: payload, restrictToCatalog: true }),
    loadInvoiceDraftWorkspace(binding.organizationId),
  ]);
  const state = draft.state as JarvisTaskActionDraftState;
  const ready = state === "awaiting_confirmation" && invoiceDraftIsReady(evaluated, binding);
  const permitted = mayManageInvoiceDraft(binding);
  const reason: JarvisInvoiceDraftView["confirmation"]["reason"] =
    state === "expired" ? "expired" : state === "cancelled" ? "cancelled" : state === "executed" ? "executed" : state === "executing" ? "executing" : !permitted ? "not_permitted" : evaluated.errors.length ? "invalid_input" : ready ? "ready" : "missing_fields";
  const currency = (value: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
  return {
    version: 2,
    previewId: draft.id,
    actionId: "invoice.prepare",
    title: "Rechnungsentwurf mit Fakturavorprüfung",
    badge: state === "executed" ? "Gespeichert" : state === "executing" ? "Wird gespeichert" : state === "cancelled" ? "Abgebrochen" : state === "expired" ? "Abgelaufen" : state === "awaiting_confirmation" ? "Bereit" : "Entwurf",
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    fields: [
      { label: "Projekt", value: evaluated.project ? `${evaluated.project.projectNumber} · ${evaluated.project.projectTitle}` : "Noch nicht ausgewählt" },
      { label: "Kunde", value: evaluated.project?.customerName || "Noch nicht bestimmt" },
      { label: "Leistungsdatum", value: evaluated.input.serviceDate || "Noch nicht gesetzt" },
      { label: "Netto", value: currency(evaluated.totals.netTotal) },
      { label: "Brutto", value: currency(evaluated.totals.grossTotal) },
    ],
    missingFields: [...evaluated.missingFields, ...(!permitted ? ["Speichern ist für diese Rollenkombination nicht freigegeben"] : [])],
    errors: evaluated.errors,
    warnings: evaluated.warnings,
    preflight: evaluated.preflight,
    editor: {
      ...evaluated.input,
      projectOptions: workspace.projectOptions,
      catalogOptions: workspace.catalogOptions,
      offerOptions: workspace.offerOptions.filter((offer) => !evaluated.input.projectId || offer.projectId === evaluated.input.projectId),
    },
    calculation: evaluated.totals,
    confirmation: { enabled: ready, reason },
    cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
    execution: { enabled: false, reason: state === "executed" ? "finalized" : "requires_confirmation" },
    ...(state === "executed" && draft.resultEntityType === "invoice" && draft.resultEntityId ? { result: { entityType: "invoice" as const, entityId: draft.resultEntityId, label: "Gespeicherten Rechnungsentwurf öffnen" } } : {}),
  };
}

export async function createPersistedJarvisInvoiceDraft(input: { preview: JarvisActionPreview<"invoice.prepare">; organizationId: string; sessionId: string; profile: JarvisAccessProfile; now?: Date }) {
  if (!input.sessionId) throw new JarvisActionDraftError("session_required", "Für einen bestätigbaren Rechnungsentwurf ist eine aktuelle Sitzung erforderlich.", 401);
  if (!mayManageInvoiceDraft(input)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf keine Rechnungsentwürfe vorbereiten.", 403);
  const now = input.now ?? new Date();
  const evaluated = await evaluateInvoiceDraft({ organizationId: input.organizationId, draft: input.preview.payload, restrictToCatalog: true });
  const payload = invoicePayloadFromEvaluation(evaluated);
  const context = invoiceContextFromEvaluation(evaluated);
  const actorIds = getActorIds(input.profile);
  const state = invoiceDraftIsReady(evaluated, input) ? "awaiting_confirmation" : "awaiting_input";
  const draftData: DraftIntegrityData = { id: input.preview.previewId, organizationId: input.organizationId, sessionId: input.sessionId, sessionActorId: actorIds.sessionActorId, sessionActorRole: input.profile.sessionActor.role, effectiveActorId: actorIds.effectiveActorId, effectiveActorRole: input.profile.effectiveActor.role, impersonating: input.profile.isImpersonating, actionId: "invoice.prepare", state, revision: 1, payloadHash: hashJson(payload), contextHash: hashJson(context), expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS), confirmedAt: null, cancelledAt: null, executedAt: null, resultEntityType: null, resultEntityId: null, lastErrorCode: evaluated.errors.length ? "invalid_input" : null };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({ data: { ...draftData, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue, integrityTag: createIntegrityTag(draftData) } });
    await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created" });
    return draft;
  });
  return toJarvisInvoiceDraftView(created, input);
}

export async function getJarvisInvoiceDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const { draft } = await loadBoundInvoiceDraft(previewId, binding, now);
  return toJarvisInvoiceDraftView(draft, binding);
}

export async function completeJarvisInvoiceDraft(previewId: string, binding: JarvisTaskDraftBinding, rawInput: unknown, now = new Date()) {
  const completed = completeInvoiceDraftSchema.safeParse(rawInput);
  if (!completed.success) throw new JarvisActionDraftError("invalid_input", "Die Rechnungsangaben sind unvollständig oder ungültig.", 400);
  const loaded = await loadBoundInvoiceDraft(previewId, binding, now);
  if (loaded.draft.revision !== completed.data.revision) throw new JarvisActionDraftError("conflict", "Der Rechnungsentwurf wurde zwischenzeitlich verändert.", 409);
  if (!OPEN_DRAFT_STATES.includes(loaded.draft.state as never)) throw new JarvisActionDraftError(loaded.draft.state === "expired" ? "expired" : "invalid_state", "Dieser Rechnungsentwurf kann nicht mehr bearbeitet werden.", loaded.draft.state === "expired" ? 410 : 409);
  const protectedText = [completed.data.introText, completed.data.closingText, ...completed.data.lines.map((line) => line.description)].filter(Boolean).join("\n");
  if (protectedText) {
    const authorization = authorizeJarvisQuestion(protectedText, binding.profile);
    if (authorization.reason === "prompt_injection" || authorization.reason === "secret") throw new JarvisActionDraftError("invalid_input", "Der Rechnungstext enthält eine gesperrte technische Anweisung oder ein Geheimnis.", 400);
  }
  const evaluated = await evaluateInvoiceDraft({ organizationId: binding.organizationId, draft: completed.data, restrictToCatalog: true });
  const payload = invoicePayloadFromEvaluation(evaluated);
  const context = invoiceContextFromEvaluation(evaluated);
  const ready = invoiceDraftIsReady(evaluated, binding);
  const revision = loaded.draft.revision + 1;
  const nextData: DraftIntegrityData = { ...loaded.draft, state: ready ? "awaiting_confirmation" : "awaiting_input", revision, payloadHash: hashJson(payload), contextHash: hashJson(context), lastErrorCode: evaluated.errors.length ? "invalid_input" : null };
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({ where: { id: loaded.draft.id, revision: loaded.draft.revision, state: loaded.draft.state, integrityTag: loaded.draft.integrityTag }, data: { state: nextData.state, revision, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue, payloadHash: nextData.payloadHash, contextHash: nextData.contextHash, lastErrorCode: nextData.lastErrorCode, integrityTag: createIntegrityTag(nextData) } });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Der Rechnungsentwurf wurde zwischenzeitlich verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: loaded.draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: ready ? "draft_recalculated" : "draft_validation_failed", ...(!ready ? { reasonCode: "invalid_input" } : {}) });
    return current;
  });
  return toJarvisInvoiceDraftView(updated, binding);
}

export async function cancelJarvisInvoiceDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()) {
  const { draft } = await loadBoundInvoiceDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisInvoiceDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Dieser Rechnungsentwurf kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Der Rechnungsentwurf wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({ where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag }, data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) } });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Der Rechnungsentwurf wurde bereits verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" });
    return current;
  });
  return toJarvisInvoiceDraftView(cancelled, binding);
}

export async function confirmJarvisInvoiceDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()) {
  const loaded = await loadBoundInvoiceDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisInvoiceDraftView(loaded.draft, binding);
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") throw new JarvisActionDraftError("conflict", "Nur die aktuelle, vollständig geprüfte Rechnungsvorschau darf gespeichert werden.", 409);
  if (!mayManageInvoiceDraft(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf keinen Rechnungsentwurf speichern.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } });
      if (!current) throw new JarvisActionDraftError("not_found", "Der Rechnungsentwurf wurde nicht gefunden.", 404);
      const parsed = validateInvoiceDraftBinding(current, binding);
      if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Der Rechnungsentwurf ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      const actor = await tx.user.findFirst({ where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true }, select: { id: true, role: true, firstName: true, lastName: true, email: true } });
      if (!actor || !canManageInvoices(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Rechnungsberechtigung sind nicht mehr aktuell.", 409);
      const reevaluated = await evaluateInvoiceDraft({ organizationId: binding.organizationId, draft: parsed.payload, db: tx, restrictToCatalog: true });
      if (hashJson(invoiceContextFromEvaluation(reevaluated)) !== hashJson(parsed.context) || !invoiceDraftIsReady(reevaluated, binding)) throw new JarvisActionDraftError("stale_context", "Projekt, Angebot, Katalog oder Fakturavorprüfung haben sich geändert. Bitte prüfe und berechne den Entwurf erneut.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null };
      const claimed = await tx.jarvisActionDraft.updateMany({ where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag }, data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) } });
      if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Der Rechnungsentwurf wird bereits gespeichert.", 409);
      const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
      const invoice = await createConfirmedInvoiceDraft({ tx, organizationId: binding.organizationId, actorName, draft: parsed.payload as InvoiceDraftInput, source: "jarvis" });
      const executedAt = new Date();
      const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "invoice", resultEntityId: invoice.id };
      const finalDraft = await tx.jarvisActionDraft.update({ where: { id: current.id }, data: { state: "executed", executedAt, resultEntityType: "invoice", resultEntityId: invoice.id, integrityTag: createIntegrityTag(executedData) } });
      await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed", result: { id: invoice.id, entityType: "invoice" } });
      return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return toJarvisInvoiceDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") {
      const latest = await loadBoundInvoiceDraft(previewId, binding, now);
      if (latest.draft.state === "executed") return toJarvisInvoiceDraftView(latest.draft, binding);
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof InvoiceDraftServiceError) throw new JarvisActionDraftError(error.code === "stale_context" ? "stale_context" : "invalid_input", error.message, 409);
    throw new JarvisActionDraftError("execution_failed", "Der Rechnungsentwurf wurde nicht gespeichert und bleibt zur Prüfung erhalten.", 500);
  }
}

function mayFinalizeOffer(binding: JarvisTaskDraftBinding) {
  return (
    canManageOffers(binding.profile.sessionActor) &&
    canManageOffers(binding.profile.effectiveActor)
  );
}

function validateOfferFinalizationBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Angebotsvorschau gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.",
      403
    );
  }
  if (
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role
  ) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Die Rolle hat sich seit der Angebotsprüfung geändert. Bitte erstelle eine neue Vorschau.",
      409
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Integritätsnachweis der Angebotsvorschau ist ungültig.",
      409
    );
  }
  const payload = offerFinalizationPayloadSchema.safeParse(draft.payload);
  const context = offerFinalizationContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "offer.finalize" ||
    !payload.success ||
    !context.success ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Angebotsvorschau oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.",
      409
    );
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundOfferFinalizationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) {
    throw new JarvisActionDraftError("not_found", "Die Angebotsvorschau wurde nicht gefunden.", 404);
  }
  validateOfferFinalizationBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateOfferFinalizationBinding(current, binding);
  return { draft: current, ...parsed };
}

function toJarvisOfferFinalizationDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): JarvisOfferFinalizationDraftView {
  const { context } = validateOfferFinalizationBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayFinalizeOffer(binding);
  const ready = state === "awaiting_confirmation" && permitted && context.blockingIssues.length === 0;
  const reason: JarvisOfferFinalizationDraftView["confirmation"]["reason"] =
    state === "expired" ? "expired"
    : state === "cancelled" ? "cancelled"
    : state === "executed" ? "executed"
    : state === "executing" ? "executing"
    : !permitted ? "not_permitted"
    : context.blockingIssues.length ? "blocked"
    : "ready";
  const currency = (value: number) => new Intl.NumberFormat("de-DE", {
    style: "currency", currency: "EUR",
  }).format(value);
  return {
    version: 2,
    previewId: draft.id,
    actionId: "offer.finalize",
    title: "Angebot kontrolliert finalisieren",
    badge:
      state === "executed" ? "Finalisiert"
      : state === "executing" ? "Wird finalisiert"
      : state === "cancelled" ? "Abgebrochen"
      : state === "expired" ? "Abgelaufen"
      : ready ? "Bereit" : "Prüfung",
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    offerId: context.offer.id,
    projectId: context.offer.projectId,
    fields: [
      { label: "Angebot", value: context.offer.offerNumber },
      { label: "Projekt", value: `${context.offer.projectNumber} · ${context.offer.projectTitle}` },
      { label: "Kunde", value: context.offer.customerName || "–" },
      { label: "Ausführung", value: context.offer.plannedExecutionEndMonth ? `${context.offer.plannedExecutionMonth} bis ${context.offer.plannedExecutionEndMonth}` : context.offer.plannedExecutionMonth },
      { label: "Positionen", value: String(context.offer.lineCount) },
      { label: "Netto", value: currency(context.offer.netTotal) },
      { label: "Brutto", value: currency(context.offer.grossTotal) },
    ],
    checks: context.checks,
    warnings: context.warnings,
    blockingIssues: [
      ...context.blockingIssues,
      ...(!permitted ? ["Angebotsfinalisierung ist für diese Rollenkombination nicht freigegeben."] : []),
    ],
    confirmation: {
      enabled: ready,
      reason,
      requiredText: getOfferFinalizationConfirmationText(context.offer.offerNumber),
    },
    cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
    ...(state === "executed" && draft.resultEntityId ? {
      result: { entityType: "offer" as const, entityId: draft.resultEntityId, label: "Finales Angebot öffnen" },
    } : {}),
  };
}

export async function createPersistedJarvisOfferFinalizationDraft(input: {
  preview: JarvisActionPreview<"offer.finalize">;
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  now?: Date;
}) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError("session_required", "Für eine Angebotsfinalisierung ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  }
  if (!mayFinalizeOffer(input)) {
    throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf kein Angebot finalisieren.", 403);
  }
  const now = input.now ?? new Date();
  const evaluation = await evaluateOfferFinalization({
    organizationId: input.organizationId,
    offerId: input.preview.payload.offerId,
  });
  const payload = offerFinalizationPayloadSchema.parse(input.preview.payload);
  const context = offerFinalizationContextSchema.parse(evaluation);
  const actorIds = getActorIds(input.profile);
  const state = context.blockingIssues.length === 0 ? "awaiting_confirmation" : "awaiting_input";
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId,
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId: "offer.finalize",
    state,
    revision: 1,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_OFFER_DRAFT_TTL_MS),
    confirmedAt: null, cancelledAt: null, executedAt: null,
    resultEntityType: null, resultEntityId: null,
    lastErrorCode: context.blockingIssues.length ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag: createIntegrityTag(draftData),
      },
    });
    await appendAuditEvent(tx, {
      draft,
      eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked",
    });
    return draft;
  });
  return toJarvisOfferFinalizationDraftView(created, input);
}

export async function getJarvisOfferFinalizationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundOfferFinalizationDraft(previewId, binding, now);
  return toJarvisOfferFinalizationDraftView(draft, binding);
}

export async function cancelJarvisOfferFinalizationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const { draft } = await loadBoundOfferFinalizationDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisOfferFinalizationDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) {
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "invalid_state",
      "Diese Angebotsvorschau kann nicht mehr abgebrochen werden.",
      draft.state === "expired" ? 410 : 409
    );
  }
  if (expectedRevision !== draft.revision) {
    throw new JarvisActionDraftError("conflict", "Die Angebotsvorschau wurde zwischenzeitlich verändert.", 409);
  }
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag },
      data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) },
    });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Angebotsvorschau wurde bereits verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" });
    return current;
  });
  return toJarvisOfferFinalizationDraftView(cancelled, binding);
}

export async function confirmJarvisOfferFinalizationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  confirmationText: string,
  now = new Date()
) {
  const loaded = await loadBoundOfferFinalizationDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisOfferFinalizationDraftView(loaded.draft, binding);
  const requiredText = getOfferFinalizationConfirmationText(loaded.context.offer.offerNumber);
  if (!matchesOfferFinalizationConfirmation(loaded.context.offer.offerNumber, confirmationText)) {
    throw new JarvisActionDraftError("invalid_input", `Gib zur kritischen Bestätigung exakt „${requiredText}“ ein.`, 400);
  }
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") {
    throw new JarvisActionDraftError("conflict", "Nur die aktuelle, vollständig geprüfte Angebotsvorschau darf bestätigt werden.", 409);
  }
  if (!mayFinalizeOffer(binding)) {
    throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf kein Angebot finalisieren.", 403);
  }
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } });
      if (!current) throw new JarvisActionDraftError("not_found", "Die Angebotsvorschau wurde nicht gefunden.", 404);
      const parsed = validateOfferFinalizationBinding(current, binding);
      if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) {
        throw new JarvisActionDraftError(
          current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict",
          "Die Angebotsvorschau ist nicht mehr ausführbar.",
          current.expiresAt.getTime() <= now.getTime() ? 410 : 409
        );
      }
      const actor = await tx.user.findFirst({
        where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true },
        select: { id: true, role: true, firstName: true, lastName: true, email: true },
      });
      if (!actor || !canManageOffers(actor)) {
        throw new JarvisActionDraftError("role_changed", "Akteur oder Angebotsberechtigung sind nicht mehr aktuell.", 409);
      }
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null };
      const claimed = await tx.jarvisActionDraft.updateMany({
        where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag },
        data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) },
      });
      if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Das Angebot wird bereits finalisiert.", 409);
      const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
      const offer = await finalizeOfferDraft({
        tx,
        organizationId: binding.organizationId,
        offerId: parsed.payload.offerId,
        actorName,
        expectedFingerprint: parsed.context.fingerprint,
        source: "jarvis",
      });
      const executedAt = new Date();
      const executedData: DraftIntegrityData = {
        ...claimedData, state: "executed", executedAt,
        resultEntityType: "offer", resultEntityId: offer.id,
      };
      const finalDraft = await tx.jarvisActionDraft.update({
        where: { id: current.id },
        data: {
          state: "executed", executedAt, resultEntityType: "offer", resultEntityId: offer.id,
          integrityTag: createIntegrityTag(executedData),
        },
      });
      await appendAuditEvent(tx, {
        draft: finalDraft,
        eventType: "draft_confirmed_and_executed",
        result: { id: offer.id, entityType: "offer" },
      });
      return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await externalizeJarvisDocumentPdf({
      organizationId: binding.organizationId,
      kind: "offer",
      entityId: executed.resultEntityId,
      actorUserId: executed.effectiveActorId,
    });
    return toJarvisOfferFinalizationDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") {
      const latest = await loadBoundOfferFinalizationDraft(previewId, binding, now);
      if (latest.draft.state === "executed") return toJarvisOfferFinalizationDraftView(latest.draft, binding);
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof OfferFinalizationServiceError) {
      throw new JarvisActionDraftError(
        error.code === "stale_context" ? "stale_context" : "invalid_input",
        error.message,
        409
      );
    }
    throw new JarvisActionDraftError(
      "execution_failed",
      "Das Angebot wurde nicht finalisiert und die Vorschau bleibt zur Prüfung erhalten.",
      500
    );
  }
}

function mayDecideOffer(binding: JarvisTaskDraftBinding) {
  return canManageOffers(binding.profile.sessionActor) && canManageOffers(binding.profile.effectiveActor);
}

function validateOfferDecisionBinding(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId || draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId || draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError("scope_mismatch", "Diese Angebotsentscheidung gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.", 403);
  }
  if (draft.sessionActorRole !== binding.profile.sessionActor.role || draft.effectiveActorRole !== binding.profile.effectiveActor.role) {
    throw new JarvisActionDraftError("role_changed", "Die Rolle hat sich seit der Angebotsprüfung geändert. Bitte erstelle eine neue Vorschau.", 409);
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError("integrity_failed", "Der Integritätsnachweis der Angebotsentscheidung ist ungültig.", 409);
  }
  const payload = offerDecisionPayloadSchema.safeParse(draft.payload);
  const context = offerDecisionContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "offer.manage" || !payload.success || !context.success ||
    hashJson(payload.data) !== draft.payloadHash || hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError("integrity_failed", "Angebotsentscheidung oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.", 409);
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundOfferDecisionDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) throw new JarvisActionDraftError("not_found", "Die Angebotsentscheidung wurde nicht gefunden.", 404);
  validateOfferDecisionBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateOfferDecisionBinding(current, binding);
  return { draft: current, ...parsed };
}

function toJarvisOfferDecisionDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): JarvisOfferDecisionDraftView {
  const { context } = validateOfferDecisionBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayDecideOffer(binding);
  const ready = state === "awaiting_confirmation" && permitted && context.blockingIssues.length === 0;
  const reason: JarvisOfferDecisionDraftView["confirmation"]["reason"] =
    state === "expired" ? "expired" : state === "cancelled" ? "cancelled" :
    state === "executed" ? "executed" : state === "executing" ? "executing" :
    !permitted ? "not_permitted" : context.blockingIssues.length ? "blocked" : "ready";
  const currency = (value: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
  return {
    version: 2,
    previewId: draft.id,
    actionId: "offer.manage",
    title: "Angebot kontrolliert entscheiden",
    badge: state === "executed" ? "Entschieden" : state === "executing" ? "Wird entschieden" :
      state === "cancelled" ? "Abgebrochen" : state === "expired" ? "Abgelaufen" : ready ? "Bereit" : "Prüfung",
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    offerId: context.offer.id,
    projectId: context.offer.projectId,
    decision: context.decision,
    fields: [
      { label: "Entscheidung", value: context.decision === "won" ? "Gewonnen" : "Verloren" },
      { label: "Angebot", value: context.offer.offerNumber },
      { label: "Projekt", value: `${context.offer.projectNumber} · ${context.offer.projectTitle}` },
      { label: "Kunde", value: context.offer.customerName || "–" },
      { label: "Netto", value: currency(context.offer.netTotal) },
      { label: "Brutto", value: currency(context.offer.grossTotal) },
      { label: "Grund", value: context.reason },
      ...(context.decision === "lost" ? [{ label: "Kommentar", value: context.note }] : []),
    ],
    checks: context.checks,
    warnings: context.warnings,
    blockingIssues: [...context.blockingIssues, ...(!permitted ? ["Angebotsentscheidungen sind für diese Rollenkombination nicht freigegeben."] : [])],
    confirmation: {
      enabled: ready,
      reason,
      requiredText: getOfferDecisionConfirmationText(context.offer.offerNumber, context.decision),
    },
    cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
    ...(state === "executed" && draft.resultEntityId ? {
      result: { entityType: "offer" as const, entityId: draft.resultEntityId, label: "Entschiedenes Angebot öffnen" },
    } : {}),
  };
}

export async function createPersistedJarvisOfferDecisionDraft(input: {
  preview: JarvisActionPreview<"offer.manage">;
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  now?: Date;
}) {
  if (!input.sessionId) throw new JarvisActionDraftError("session_required", "Für eine Angebotsentscheidung ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  if (!mayDecideOffer(input)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf keine Angebote entscheiden.", 403);
  const now = input.now ?? new Date();
  const payload = offerDecisionPayloadSchema.parse({ ...input.preview.payload, note: input.preview.payload.note || "" });
  const evaluation = await evaluateOfferDecision({ organizationId: input.organizationId, ...payload });
  const context = offerDecisionContextSchema.parse(evaluation);
  const actorIds = getActorIds(input.profile);
  const state = context.blockingIssues.length ? "awaiting_input" : "awaiting_confirmation";
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId, organizationId: input.organizationId, sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId, sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId, effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating, actionId: "offer.manage", state, revision: 1,
    payloadHash: hashJson(payload), contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_OFFER_DRAFT_TTL_MS),
    confirmedAt: null, cancelledAt: null, executedAt: null, resultEntityType: null, resultEntityId: null,
    lastErrorCode: context.blockingIssues.length ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({ data: {
      ...draftData, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue,
      integrityTag: createIntegrityTag(draftData),
    } });
    await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked" });
    return draft;
  });
  return toJarvisOfferDecisionDraftView(created, input);
}

export async function getJarvisOfferDecisionDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const { draft } = await loadBoundOfferDecisionDraft(previewId, binding, now);
  return toJarvisOfferDecisionDraftView(draft, binding);
}

export async function cancelJarvisOfferDecisionDraft(
  previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()
) {
  const { draft } = await loadBoundOfferDecisionDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisOfferDecisionDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Diese Angebotsentscheidung kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Die Angebotsentscheidung wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag },
      data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) },
    });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Angebotsentscheidung wurde bereits verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" });
    return current;
  });
  return toJarvisOfferDecisionDraftView(cancelled, binding);
}

export async function confirmJarvisOfferDecisionDraft(
  previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number,
  confirmationText: string, now = new Date()
) {
  const loaded = await loadBoundOfferDecisionDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisOfferDecisionDraftView(loaded.draft, binding);
  const requiredText = getOfferDecisionConfirmationText(loaded.context.offer.offerNumber, loaded.context.decision);
  if (!matchesOfferDecisionConfirmation(loaded.context.offer.offerNumber, loaded.context.decision, confirmationText)) {
    throw new JarvisActionDraftError("invalid_input", `Gib zur kritischen Bestätigung exakt „${requiredText}“ ein.`, 400);
  }
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") {
    throw new JarvisActionDraftError("conflict", "Nur die aktuelle, vollständig geprüfte Angebotsentscheidung darf bestätigt werden.", 409);
  }
  if (!mayDecideOffer(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf keine Angebote entscheiden.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } });
      if (!current) throw new JarvisActionDraftError("not_found", "Die Angebotsentscheidung wurde nicht gefunden.", 404);
      const parsed = validateOfferDecisionBinding(current, binding);
      if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) {
        throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Die Angebotsentscheidung ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      }
      const actor = await tx.user.findFirst({ where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true }, select: { id: true, role: true, firstName: true, lastName: true, email: true } });
      if (!actor || !canManageOffers(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Angebotsberechtigung sind nicht mehr aktuell.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null };
      const claimed = await tx.jarvisActionDraft.updateMany({
        where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag },
        data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) },
      });
      if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Das Angebot wird bereits entschieden.", 409);
      const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
      const offer = await executeOfferDecision({
        tx, organizationId: binding.organizationId, offerId: parsed.payload.offerId,
        decision: parsed.payload.decision, reason: parsed.payload.reason, note: parsed.payload.note,
        actorId: actor.id, actorName, expectedFingerprint: parsed.context.fingerprint, source: "jarvis",
      });
      const executedAt = new Date();
      const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "offer", resultEntityId: offer.id };
      const finalDraft = await tx.jarvisActionDraft.update({ where: { id: current.id }, data: {
        state: "executed", executedAt, resultEntityType: "offer", resultEntityId: offer.id, integrityTag: createIntegrityTag(executedData),
      } });
      await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed", result: { id: offer.id, entityType: "offer" } });
      return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return toJarvisOfferDecisionDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") {
      const latest = await loadBoundOfferDecisionDraft(previewId, binding, now);
      if (latest.draft.state === "executed") return toJarvisOfferDecisionDraftView(latest.draft, binding);
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof OfferDecisionServiceError) throw new JarvisActionDraftError(error.code === "stale_context" ? "stale_context" : "invalid_input", error.message, 409);
    throw new JarvisActionDraftError("execution_failed", "Das Angebot wurde nicht entschieden und die Vorschau bleibt zur Prüfung erhalten.", 500);
  }
}

function mayChangeOfferLifecycle(binding: JarvisTaskDraftBinding) {
  return canDeleteOffers(binding.profile.sessionActor) && canDeleteOffers(binding.profile.effectiveActor);
}

function validateOfferLifecycleBinding(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId || draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId || draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError("scope_mismatch", "Diese Angebotsänderung gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.", 403);
  }
  if (draft.sessionActorRole !== binding.profile.sessionActor.role || draft.effectiveActorRole !== binding.profile.effectiveActor.role) {
    throw new JarvisActionDraftError("role_changed", "Die Rolle hat sich seit der Angebotsprüfung geändert. Bitte erstelle eine neue Vorschau.", 409);
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError("integrity_failed", "Der Integritätsnachweis der Angebotsänderung ist ungültig.", 409);
  }
  const payload = offerLifecyclePayloadSchema.safeParse(draft.payload);
  const context = offerLifecycleContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "offer.delete" || !payload.success || !context.success ||
    hashJson(payload.data) !== draft.payloadHash || hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError("integrity_failed", "Angebotsänderung oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.", 409);
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundOfferLifecycleDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) throw new JarvisActionDraftError("not_found", "Die Angebotsänderung wurde nicht gefunden.", 404);
  validateOfferLifecycleBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateOfferLifecycleBinding(current, binding);
  return { draft: current, ...parsed };
}

function toJarvisOfferLifecycleDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): JarvisOfferLifecycleDraftView {
  const { context } = validateOfferLifecycleBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayChangeOfferLifecycle(binding);
  const ready = state === "awaiting_confirmation" && permitted && context.blockingIssues.length === 0;
  const reason: JarvisOfferLifecycleDraftView["confirmation"]["reason"] =
    state === "expired" ? "expired" : state === "cancelled" ? "cancelled" :
    state === "executed" ? "executed" : state === "executing" ? "executing" :
    !permitted ? "not_permitted" : context.blockingIssues.length ? "blocked" : "ready";
  const currency = (value: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
  return {
    version: 2,
    previewId: draft.id,
    actionId: "offer.delete",
    title: "Angebot kontrolliert löschen oder wiederherstellen",
    badge: state === "executed" ? "Ausgeführt" : state === "executing" ? "Wird geändert" :
      state === "cancelled" ? "Abgebrochen" : state === "expired" ? "Abgelaufen" : ready ? "Bereit" : "Prüfung",
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    offerId: context.offer.id,
    projectId: context.offer.projectId,
    lifecycleAction: context.action,
    fields: [
      { label: "Aktion", value: context.action === "delete" ? "Löschen" : "Wiederherstellen" },
      { label: "Angebot", value: context.offer.offerNumber },
      { label: "Projekt", value: `${context.offer.projectNumber} · ${context.offer.projectTitle}` },
      { label: "Kunde", value: context.offer.customerName || "–" },
      { label: "Aktueller Status", value: context.offer.status },
      ...(context.action === "restore" ? [{ label: "Wiederhergestellter Status", value: context.previousStatus }] : []),
      { label: "Netto", value: currency(context.offer.netTotal) },
      { label: "Brutto", value: currency(context.offer.grossTotal) },
      { label: "Grund", value: context.reason },
      ...(context.acceptanceLinksToRevoke ? [{ label: "Widerrufene Annahmelinks", value: String(context.acceptanceLinksToRevoke) }] : []),
    ],
    checks: context.checks,
    warnings: context.warnings,
    blockingIssues: [...context.blockingIssues, ...(!permitted ? ["Löschen und Wiederherstellen von Angeboten sind für diese Rollenkombination nicht freigegeben."] : [])],
    confirmation: {
      enabled: ready,
      reason,
      requiredText: getOfferLifecycleConfirmationText(context.offer.offerNumber, context.action),
    },
    cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
    ...(state === "executed" && draft.resultEntityId ? {
      result: { entityType: "offer" as const, entityId: draft.resultEntityId, label: "Geändertes Angebot öffnen" },
    } : {}),
  };
}

export async function createPersistedJarvisOfferLifecycleDraft(input: {
  preview: JarvisActionPreview<"offer.delete">;
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  now?: Date;
}) {
  if (!input.sessionId) throw new JarvisActionDraftError("session_required", "Für Löschen oder Wiederherstellen ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  if (!mayChangeOfferLifecycle(input)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Angebote nicht löschen oder wiederherstellen.", 403);
  const now = input.now ?? new Date();
  const payload = offerLifecyclePayloadSchema.parse(input.preview.payload);
  const evaluation = await evaluateOfferLifecycle({ organizationId: input.organizationId, ...payload });
  const context = offerLifecycleContextSchema.parse(evaluation);
  const actorIds = getActorIds(input.profile);
  const state = context.blockingIssues.length ? "awaiting_input" : "awaiting_confirmation";
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId, organizationId: input.organizationId, sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId, sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId, effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating, actionId: "offer.delete", state, revision: 1,
    payloadHash: hashJson(payload), contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_OFFER_DRAFT_TTL_MS),
    confirmedAt: null, cancelledAt: null, executedAt: null, resultEntityType: null, resultEntityId: null,
    lastErrorCode: context.blockingIssues.length ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({ data: {
      ...draftData, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue,
      integrityTag: createIntegrityTag(draftData),
    } });
    await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked" });
    return draft;
  });
  return toJarvisOfferLifecycleDraftView(created, input);
}

export async function getJarvisOfferLifecycleDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const { draft } = await loadBoundOfferLifecycleDraft(previewId, binding, now);
  return toJarvisOfferLifecycleDraftView(draft, binding);
}

export async function cancelJarvisOfferLifecycleDraft(
  previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()
) {
  const { draft } = await loadBoundOfferLifecycleDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisOfferLifecycleDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Diese Angebotsänderung kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Die Angebotsänderung wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag },
      data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) },
    });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Angebotsänderung wurde bereits verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" });
    return current;
  });
  return toJarvisOfferLifecycleDraftView(cancelled, binding);
}

export async function confirmJarvisOfferLifecycleDraft(
  previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number,
  confirmationText: string, now = new Date()
) {
  const loaded = await loadBoundOfferLifecycleDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisOfferLifecycleDraftView(loaded.draft, binding);
  const requiredText = getOfferLifecycleConfirmationText(loaded.context.offer.offerNumber, loaded.context.action);
  if (!matchesOfferLifecycleConfirmation(loaded.context.offer.offerNumber, loaded.context.action, confirmationText)) {
    throw new JarvisActionDraftError("invalid_input", `Gib zur kritischen Bestätigung exakt „${requiredText}“ ein.`, 400);
  }
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") {
    throw new JarvisActionDraftError("conflict", "Nur die aktuelle, vollständig geprüfte Angebotsänderung darf bestätigt werden.", 409);
  }
  if (!mayChangeOfferLifecycle(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Angebote nicht löschen oder wiederherstellen.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } });
      if (!current) throw new JarvisActionDraftError("not_found", "Die Angebotsänderung wurde nicht gefunden.", 404);
      const parsed = validateOfferLifecycleBinding(current, binding);
      if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) {
        throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Die Angebotsänderung ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      }
      const actor = await tx.user.findFirst({ where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true }, select: { id: true, role: true, firstName: true, lastName: true, email: true } });
      if (!actor || !canDeleteOffers(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Löschberechtigung sind nicht mehr aktuell.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null };
      const claimed = await tx.jarvisActionDraft.updateMany({
        where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag },
        data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) },
      });
      if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Das Angebot wird bereits geändert.", 409);
      const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
      const offer = await executeOfferLifecycle({
        tx, organizationId: binding.organizationId, offerId: parsed.payload.offerId,
        action: parsed.payload.action, reason: parsed.payload.reason,
        actorId: actor.id, actorName, expectedFingerprint: parsed.context.fingerprint, source: "jarvis",
      });
      const executedAt = new Date();
      const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "offer", resultEntityId: offer.id };
      const finalDraft = await tx.jarvisActionDraft.update({ where: { id: current.id }, data: {
        state: "executed", executedAt, resultEntityType: "offer", resultEntityId: offer.id, integrityTag: createIntegrityTag(executedData),
      } });
      await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed", result: { id: offer.id, entityType: "offer" } });
      return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return toJarvisOfferLifecycleDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") {
      const latest = await loadBoundOfferLifecycleDraft(previewId, binding, now);
      if (latest.draft.state === "executed") return toJarvisOfferLifecycleDraftView(latest.draft, binding);
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof OfferLifecycleServiceError) throw new JarvisActionDraftError(error.code === "stale_context" ? "stale_context" : "invalid_input", error.message, 409);
    throw new JarvisActionDraftError("execution_failed", "Das Angebot wurde nicht geändert und die Vorschau bleibt zur Prüfung erhalten.", 500);
  }
}

function mayChangeTaskLifecycle(binding: JarvisTaskDraftBinding) {
  return canDeleteTasks(binding.profile.sessionActor) && canDeleteTasks(binding.profile.effectiveActor);
}

function validateTaskLifecycleBinding(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId || draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId || draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError("scope_mismatch", "Diese Aufgabenänderung gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.", 403);
  }
  if (draft.sessionActorRole !== binding.profile.sessionActor.role || draft.effectiveActorRole !== binding.profile.effectiveActor.role) {
    throw new JarvisActionDraftError("role_changed", "Die Rolle hat sich seit der Aufgabenprüfung geändert. Bitte erstelle eine neue Vorschau.", 409);
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError("integrity_failed", "Der Integritätsnachweis der Aufgabenänderung ist ungültig.", 409);
  }
  const payload = taskLifecyclePayloadSchema.safeParse(draft.payload);
  const context = taskLifecycleContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "task.delete" || !payload.success || !context.success ||
    hashJson(payload.data) !== draft.payloadHash || hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError("integrity_failed", "Aufgabenänderung oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.", 409);
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundTaskLifecycleDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) throw new JarvisActionDraftError("not_found", "Die Aufgabenänderung wurde nicht gefunden.", 404);
  validateTaskLifecycleBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateTaskLifecycleBinding(current, binding);
  return { draft: current, ...parsed };
}

function toJarvisTaskLifecycleDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): JarvisTaskLifecycleDraftView {
  const { context } = validateTaskLifecycleBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayChangeTaskLifecycle(binding);
  const ready = state === "awaiting_confirmation" && permitted && context.blockingIssues.length === 0;
  const reason: JarvisTaskLifecycleDraftView["confirmation"]["reason"] =
    state === "expired" ? "expired" : state === "cancelled" ? "cancelled" :
    state === "executed" ? "executed" : state === "executing" ? "executing" :
    !permitted ? "not_permitted" : context.blockingIssues.length ? "blocked" : "ready";
  return {
    version: 2,
    previewId: draft.id,
    actionId: "task.delete",
    title: "Aufgabe kontrolliert archivieren oder wiederherstellen",
    badge: state === "executed" ? "Ausgeführt" : state === "executing" ? "Wird geändert" :
      state === "cancelled" ? "Abgebrochen" : state === "expired" ? "Abgelaufen" : ready ? "Bereit" : "Prüfung",
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    taskId: context.task.id,
    projectId: context.task.projectId,
    lifecycleAction: context.action,
    fields: [
      { label: "Aktion", value: context.action === "archive" ? "Archivieren" : "Wiederherstellen" },
      { label: "Aufgabe", value: context.task.title },
      { label: "Projekt", value: context.task.projectLabel },
      { label: "Kunde", value: context.task.customer || "–" },
      { label: "Verantwortlich", value: context.task.ownerName || "–" },
      { label: "Aktueller Status", value: context.task.status },
      ...(context.action === "restore" ? [{ label: "Wiederhergestellter Status", value: context.previousStatus || "Manuelle Prüfung" }] : []),
      { label: "Grund", value: context.reason },
      { label: "Kommentare", value: String(context.comments) },
      { label: "Beteiligte", value: String(context.participants) },
      { label: "Links", value: String(context.links) },
      { label: "Zeiteinträge", value: String(context.timeEntries) },
      { label: "Aktive Folgeaufgaben", value: String(context.childTasks) },
    ],
    checks: context.checks,
    warnings: context.warnings,
    blockingIssues: [...context.blockingIssues, ...(!permitted ? ["Archivieren und Wiederherstellen von Aufgaben sind für diese Rollenkombination nicht freigegeben."] : [])],
    confirmation: {
      enabled: ready,
      reason,
      requiredText: getTaskLifecycleConfirmationText(context.task.title, context.action),
    },
    cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
    ...(state === "executed" && draft.resultEntityId ? {
      result: { entityType: "task" as const, entityId: draft.resultEntityId, label: "Geänderte Aufgabe öffnen" },
    } : {}),
  };
}

export async function createPersistedJarvisTaskLifecycleDraft(input: {
  preview: JarvisActionPreview<"task.delete">;
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  now?: Date;
}) {
  if (!input.sessionId) throw new JarvisActionDraftError("session_required", "Für Archivieren oder Wiederherstellen ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  if (!mayChangeTaskLifecycle(input)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Aufgaben nicht archivieren oder wiederherstellen.", 403);
  const now = input.now ?? new Date();
  const payload = taskLifecyclePayloadSchema.parse(input.preview.payload);
  const evaluation = await evaluateTaskLifecycle({ organizationId: input.organizationId, ...payload });
  const context = taskLifecycleContextSchema.parse(evaluation);
  const actorIds = getActorIds(input.profile);
  const state = context.blockingIssues.length ? "awaiting_input" : "awaiting_confirmation";
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId, organizationId: input.organizationId, sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId, sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId, effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating, actionId: "task.delete", state, revision: 1,
    payloadHash: hashJson(payload), contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS),
    confirmedAt: null, cancelledAt: null, executedAt: null, resultEntityType: null, resultEntityId: null,
    lastErrorCode: context.blockingIssues.length ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({ data: {
      ...draftData, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue,
      integrityTag: createIntegrityTag(draftData),
    } });
    await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked" });
    return draft;
  });
  return toJarvisTaskLifecycleDraftView(created, input);
}

export async function getJarvisTaskLifecycleDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const { draft } = await loadBoundTaskLifecycleDraft(previewId, binding, now);
  return toJarvisTaskLifecycleDraftView(draft, binding);
}

export async function cancelJarvisTaskLifecycleDraft(
  previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()
) {
  const { draft } = await loadBoundTaskLifecycleDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisTaskLifecycleDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Diese Aufgabenänderung kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Die Aufgabenänderung wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag },
      data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) },
    });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Aufgabenänderung wurde bereits verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" });
    return current;
  });
  return toJarvisTaskLifecycleDraftView(cancelled, binding);
}

export async function confirmJarvisTaskLifecycleDraft(
  previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number,
  confirmationText: string, now = new Date()
) {
  const loaded = await loadBoundTaskLifecycleDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisTaskLifecycleDraftView(loaded.draft, binding);
  const requiredText = getTaskLifecycleConfirmationText(loaded.context.task.title, loaded.context.action);
  if (!matchesTaskLifecycleConfirmation(loaded.context.task.title, loaded.context.action, confirmationText)) {
    throw new JarvisActionDraftError("invalid_input", `Gib zur kritischen Bestätigung exakt „${requiredText}“ ein.`, 400);
  }
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") {
    throw new JarvisActionDraftError("conflict", "Nur die aktuelle, vollständig geprüfte Aufgabenänderung darf bestätigt werden.", 409);
  }
  if (!mayChangeTaskLifecycle(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Aufgaben nicht archivieren oder wiederherstellen.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } });
      if (!current) throw new JarvisActionDraftError("not_found", "Die Aufgabenänderung wurde nicht gefunden.", 404);
      const parsed = validateTaskLifecycleBinding(current, binding);
      if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) {
        throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Die Aufgabenänderung ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      }
      const actor = await tx.user.findFirst({ where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true }, select: { id: true, role: true, firstName: true, lastName: true, email: true } });
      if (!actor || !canDeleteTasks(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Aufgabenberechtigung sind nicht mehr aktuell.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null };
      const claimed = await tx.jarvisActionDraft.updateMany({
        where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag },
        data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) },
      });
      if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Aufgabe wird bereits geändert.", 409);
      const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
      const task = await executeTaskLifecycle({
        tx, organizationId: binding.organizationId, taskId: parsed.payload.taskId,
        action: parsed.payload.action, reason: parsed.payload.reason,
        actorId: actor.id, actorName, expectedFingerprint: parsed.context.fingerprint, source: "jarvis",
      });
      const executedAt = new Date();
      const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "task", resultEntityId: task.id };
      const finalDraft = await tx.jarvisActionDraft.update({ where: { id: current.id }, data: {
        state: "executed", executedAt, resultEntityType: "task", resultEntityId: task.id, integrityTag: createIntegrityTag(executedData),
      } });
      await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed", result: { id: task.id, entityType: "task" } });
      return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return toJarvisTaskLifecycleDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") {
      const latest = await loadBoundTaskLifecycleDraft(previewId, binding, now);
      if (latest.draft.state === "executed") return toJarvisTaskLifecycleDraftView(latest.draft, binding);
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof TaskLifecycleServiceError) throw new JarvisActionDraftError(error.code === "stale_context" ? "stale_context" : "invalid_input", error.message, 409);
    throw new JarvisActionDraftError("execution_failed", "Die Aufgabe wurde nicht geändert und die Vorschau bleibt zur Prüfung erhalten.", 500);
  }
}

function mayChangeProjectMasterData(binding: JarvisTaskDraftBinding) {
  return canManageProjects(binding.profile.sessionActor) && canManageProjects(binding.profile.effectiveActor);
}

function validateProjectMasterDataBinding(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId || draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId || draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError("scope_mismatch", "Diese Projektdatenänderung gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.", 403);
  }
  if (draft.sessionActorRole !== binding.profile.sessionActor.role || draft.effectiveActorRole !== binding.profile.effectiveActor.role) {
    throw new JarvisActionDraftError("role_changed", "Die Rolle hat sich seit der Projektdatenprüfung geändert. Bitte erstelle eine neue Vorschau.", 409);
  }
  if (!integrityMatches(draft)) throw new JarvisActionDraftError("integrity_failed", "Der Integritätsnachweis der Projektdatenänderung ist ungültig.", 409);
  const payload = projectMasterDataPayloadSchema.safeParse(draft.payload);
  const context = projectMasterDataContextSchema.safeParse(draft.context);
  if (draft.actionId !== "project.manage" || !payload.success || !context.success || hashJson(payload.data) !== draft.payloadHash || hashJson(context.data) !== draft.contextHash) {
    throw new JarvisActionDraftError("integrity_failed", "Projektdatenänderung oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.", 409);
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundProjectMasterDataDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) throw new JarvisActionDraftError("not_found", "Die Projektdatenänderung wurde nicht gefunden.", 404);
  validateProjectMasterDataBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  return { draft: current, ...validateProjectMasterDataBinding(current, binding) };
}

function toJarvisProjectMasterDataDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): JarvisProjectMasterDataDraftView {
  const { context } = validateProjectMasterDataBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayChangeProjectMasterData(binding);
  const ready = state === "awaiting_confirmation" && permitted && context.blockingIssues.length === 0;
  const reason: JarvisProjectMasterDataDraftView["confirmation"]["reason"] =
    state === "expired" ? "expired" : state === "cancelled" ? "cancelled" : state === "executed" ? "executed" :
    state === "executing" ? "executing" : !permitted ? "not_permitted" : context.blockingIssues.length ? "blocked" : "ready";
  return {
    version: 2,
    previewId: draft.id,
    actionId: "project.manage",
    title: "Projektstammdaten kontrolliert ändern",
    badge: state === "executed" ? "Ausgeführt" : state === "executing" ? "Wird geändert" : state === "cancelled" ? "Abgebrochen" : state === "expired" ? "Abgelaufen" : ready ? "Bereit" : "Prüfung",
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    projectId: context.project.id,
    fields: [
      { label: "Projekt", value: `${context.project.projectNumber} · ${context.project.title}` },
      { label: "Kunde", value: context.project.customer || "–" },
      { label: "Status", value: context.project.status },
      { label: "Prüfstatus", value: context.project.reviewStatus },
      { label: "Änderungen", value: String(context.changes.length) },
    ],
    changes: context.changes,
    reviewWillBeInvalidated: context.reviewWillBeInvalidated,
    checks: context.checks,
    warnings: context.warnings,
    blockingIssues: [...context.blockingIssues, ...(!permitted ? ["Projektdatenänderungen sind für diese Rollenkombination nicht freigegeben."] : [])],
    confirmation: { enabled: ready, reason, requiredText: getProjectMasterDataConfirmationText(context.project.projectNumber) },
    cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
    ...(state === "executed" && draft.resultEntityId ? { result: { entityType: "project" as const, entityId: draft.resultEntityId, label: "Projekt öffnen" } } : {}),
  };
}

export async function createPersistedJarvisProjectMasterDataDraft(input: {
  preview: JarvisActionPreview<"project.manage">;
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  now?: Date;
}) {
  if (!input.sessionId) throw new JarvisActionDraftError("session_required", "Für eine Projektdatenänderung ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  if (!mayChangeProjectMasterData(input)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Projektdaten nicht ändern.", 403);
  const now = input.now ?? new Date();
  const payload = projectMasterDataPayloadSchema.parse(input.preview.payload);
  const context = projectMasterDataContextSchema.parse(await evaluateProjectMasterDataChange({ organizationId: input.organizationId, ...payload }));
  const actorIds = getActorIds(input.profile);
  const state = context.blockingIssues.length ? "awaiting_input" : "awaiting_confirmation";
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId,
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId: "project.manage",
    state,
    revision: 1,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS),
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode: context.blockingIssues.length ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({ data: { ...draftData, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue, integrityTag: createIntegrityTag(draftData) } });
    await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked" });
    return draft;
  });
  return toJarvisProjectMasterDataDraftView(created, input);
}

export async function getJarvisProjectMasterDataDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const { draft } = await loadBoundProjectMasterDataDraft(previewId, binding, now);
  return toJarvisProjectMasterDataDraftView(draft, binding);
}

export async function cancelJarvisProjectMasterDataDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()) {
  const { draft } = await loadBoundProjectMasterDataDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisProjectMasterDataDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Diese Projektdatenänderung kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Die Projektdatenänderung wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({ where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag }, data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) } });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Projektdatenänderung wurde bereits verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" });
    return current;
  });
  return toJarvisProjectMasterDataDraftView(cancelled, binding);
}

export async function confirmJarvisProjectMasterDataDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  confirmationText: string,
  now = new Date()
) {
  const loaded = await loadBoundProjectMasterDataDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisProjectMasterDataDraftView(loaded.draft, binding);
  const requiredText = getProjectMasterDataConfirmationText(loaded.context.project.projectNumber);
  if (!matchesProjectMasterDataConfirmation(loaded.context.project.projectNumber, confirmationText)) throw new JarvisActionDraftError("invalid_input", `Gib zur Bestätigung exakt „${requiredText}“ ein.`, 400);
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") throw new JarvisActionDraftError("conflict", "Nur die aktuelle, vollständig geprüfte Projektdatenänderung darf bestätigt werden.", 409);
  if (!mayChangeProjectMasterData(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Projektdaten nicht ändern.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } });
      if (!current) throw new JarvisActionDraftError("not_found", "Die Projektdatenänderung wurde nicht gefunden.", 404);
      const parsed = validateProjectMasterDataBinding(current, binding);
      if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Die Projektdatenänderung ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      const actor = await tx.user.findFirst({ where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true }, select: { id: true, role: true, firstName: true, lastName: true, email: true } });
      if (!actor || !canManageProjects(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Projektberechtigung sind nicht mehr aktuell.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null };
      const claimed = await tx.jarvisActionDraft.updateMany({ where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag }, data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) } });
      if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Das Projekt wird bereits geändert.", 409);
      const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
      const changed = await executeProjectMasterDataChange({ tx, organizationId: binding.organizationId, projectId: parsed.payload.projectId, changes: parsed.payload.changes, actorId: actor.id, actorName, requestId: current.id, expectedFingerprint: parsed.context.fingerprint, source: "jarvis" });
      const executedAt = new Date();
      const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "project", resultEntityId: changed.project.id };
      const finalDraft = await tx.jarvisActionDraft.update({ where: { id: current.id }, data: { state: "executed", executedAt, resultEntityType: "project", resultEntityId: changed.project.id, integrityTag: createIntegrityTag(executedData) } });
      await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed", result: { id: changed.project.id, entityType: "project" } });
      return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return toJarvisProjectMasterDataDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") {
      const latest = await loadBoundProjectMasterDataDraft(previewId, binding, now);
      if (latest.draft.state === "executed") return toJarvisProjectMasterDataDraftView(latest.draft, binding);
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof ProjectMasterDataServiceError) throw new JarvisActionDraftError(error.code === "stale_context" ? "stale_context" : "invalid_input", error.message, 409);
    throw new JarvisActionDraftError("execution_failed", "Die Projektdaten wurden nicht geändert und die Vorschau bleibt zur Prüfung erhalten.", 500);
  }
}

function mayManageContacts(binding: JarvisTaskDraftBinding) {
  return canManageContacts(binding.profile.sessionActor) && canManageContacts(binding.profile.effectiveActor);
}

function validateContactManagementBinding(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId || draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId || draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) throw new JarvisActionDraftError("scope_mismatch", "Diese Kontaktaktion gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.", 403);
  if (draft.sessionActorRole !== binding.profile.sessionActor.role || draft.effectiveActorRole !== binding.profile.effectiveActor.role) {
    throw new JarvisActionDraftError("role_changed", "Die Rolle hat sich seit der Kontaktprüfung geändert. Bitte erstelle eine neue Vorschau.", 409);
  }
  if (!integrityMatches(draft)) throw new JarvisActionDraftError("integrity_failed", "Der Integritätsnachweis der Kontaktaktion ist ungültig.", 409);
  const payload = contactManagementPayloadSchema.safeParse(draft.payload);
  const context = contactManagementContextSchema.safeParse(draft.context);
  if (draft.actionId !== "contact.manage" || !payload.success || !context.success || hashJson(payload.data) !== draft.payloadHash || hashJson(context.data) !== draft.contextHash) {
    throw new JarvisActionDraftError("integrity_failed", "Kontaktaktion oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.", 409);
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundContactManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) throw new JarvisActionDraftError("not_found", "Die Kontaktaktion wurde nicht gefunden.", 404);
  validateContactManagementBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  return { draft: current, ...validateContactManagementBinding(current, binding) };
}

function toJarvisContactManagementDraftView(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding): JarvisContactManagementDraftView {
  const { context } = validateContactManagementBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayManageContacts(binding);
  const ready = state === "awaiting_confirmation" && permitted && context.blockingIssues.length === 0;
  const reason: JarvisContactManagementDraftView["confirmation"]["reason"] =
    state === "expired" ? "expired" : state === "cancelled" ? "cancelled" : state === "executed" ? "executed" :
    state === "executing" ? "executing" : !permitted ? "not_permitted" : context.blockingIssues.length ? "blocked" : "ready";
  return {
    version: 2, previewId: draft.id, actionId: "contact.manage", title: "Kontakt kontrolliert anlegen oder bearbeiten",
    badge: state === "executed" ? "Ausgeführt" : state === "executing" ? "Wird geändert" : state === "cancelled" ? "Abgebrochen" : state === "expired" ? "Abgelaufen" : ready ? "Bereit" : "Prüfung",
    state, revision: draft.revision, expiresAt: draft.expiresAt.toISOString(), mode: context.mode,
    contactId: draft.resultEntityId || context.contact.id, customerNumber: context.contact.customerNumber,
    fields: [
      { label: "Aktion", value: context.mode === "create" ? "Kontakt anlegen" : "Kontakt bearbeiten" },
      { label: "Kontakt", value: context.contact.displayName },
      { label: "Kundennummer", value: context.contact.customerNumber },
      { label: "Typ", value: context.contact.type },
      { label: "Kategorie", value: context.contact.category },
      { label: "Felder", value: String(context.changes.length) },
    ],
    changes: context.changes, checks: context.checks, warnings: context.warnings,
    blockingIssues: [...context.blockingIssues, ...(!permitted ? ["Kontaktverwaltung ist für diese Rollenkombination nicht freigegeben."] : [])],
    confirmation: {
      enabled: ready, reason,
      requiredText: context.mode === "create" ? getContactCreateConfirmationText(context.contact.displayName) : getContactChangeConfirmationText(context.contact.customerNumber),
    },
    cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
    ...(state === "executed" && draft.resultEntityId ? { result: { entityType: "contact" as const, entityId: draft.resultEntityId, label: "Kontakt öffnen" } } : {}),
  };
}

export async function createPersistedJarvisContactManagementDraft(input: {
  preview: JarvisActionPreview<"contact.manage">; organizationId: string; sessionId: string;
  profile: JarvisAccessProfile; now?: Date;
}) {
  if (!input.sessionId) throw new JarvisActionDraftError("session_required", "Für eine Kontaktaktion ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  if (!mayManageContacts(input)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Kontakte nicht verwalten.", 403);
  const now = input.now ?? new Date();
  const payload = contactManagementPayloadSchema.parse(input.preview.payload);
  const evaluation = payload.mode === "create"
    ? await evaluateContactCreation({ organizationId: input.organizationId, values: payload.values as ContactCreateInput })
    : await evaluateContactChange({ organizationId: input.organizationId, contactId: payload.contactId || "", changes: payload.values as ContactManagementChanges });
  const context = contactManagementContextSchema.parse(evaluation);
  const actorIds = getActorIds(input.profile);
  const state = context.blockingIssues.length ? "awaiting_input" : "awaiting_confirmation";
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId, organizationId: input.organizationId, sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId, sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId, effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating, actionId: "contact.manage", state, revision: 1,
    payloadHash: hashJson(payload), contextHash: hashJson(context), expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS),
    confirmedAt: null, cancelledAt: null, executedAt: null, resultEntityType: null, resultEntityId: null,
    lastErrorCode: context.blockingIssues.length ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({ data: { ...draftData, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue, integrityTag: createIntegrityTag(draftData) } });
    await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked" });
    return draft;
  });
  return toJarvisContactManagementDraftView(created, input);
}

export async function getJarvisContactManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const { draft } = await loadBoundContactManagementDraft(previewId, binding, now);
  return toJarvisContactManagementDraftView(draft, binding);
}

export async function cancelJarvisContactManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()) {
  const { draft } = await loadBoundContactManagementDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisContactManagementDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Diese Kontaktaktion kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Die Kontaktaktion wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({ where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag }, data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) } });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Kontaktaktion wurde bereits verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" });
    return current;
  });
  return toJarvisContactManagementDraftView(cancelled, binding);
}

export async function confirmJarvisContactManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, confirmationText: string, now = new Date()) {
  const loaded = await loadBoundContactManagementDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisContactManagementDraftView(loaded.draft, binding);
  const requiredText = loaded.context.mode === "create" ? getContactCreateConfirmationText(loaded.context.contact.displayName) : getContactChangeConfirmationText(loaded.context.contact.customerNumber);
  if (confirmationText.trim() !== requiredText) throw new JarvisActionDraftError("invalid_input", `Gib zur Bestätigung exakt „${requiredText}“ ein.`, 400);
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") throw new JarvisActionDraftError("conflict", "Nur die aktuelle, vollständig geprüfte Kontaktaktion darf bestätigt werden.", 409);
  if (!mayManageContacts(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Kontakte nicht verwalten.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } });
      if (!current) throw new JarvisActionDraftError("not_found", "Die Kontaktaktion wurde nicht gefunden.", 404);
      const parsed = validateContactManagementBinding(current, binding);
      if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Die Kontaktaktion ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      const actor = await tx.user.findFirst({ where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true }, select: { id: true, role: true, firstName: true, lastName: true, email: true } });
      if (!actor || !canManageContacts(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Kontaktberechtigung sind nicht mehr aktuell.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null };
      const claimed = await tx.jarvisActionDraft.updateMany({ where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag }, data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) } });
      if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Der Kontakt wird bereits verarbeitet.", 409);
      const contact = parsed.payload.mode === "create"
        ? await executeContactCreation({ tx, organizationId: binding.organizationId, values: parsed.payload.values as ContactCreateInput, actorId: actor.id, requestId: current.id, expectedFingerprint: parsed.context.fingerprint })
        : await executeContactChange({ tx, organizationId: binding.organizationId, contactId: parsed.payload.contactId || "", changes: parsed.payload.values as ContactManagementChanges, actorId: actor.id, requestId: current.id, expectedFingerprint: parsed.context.fingerprint });
      const executedAt = new Date();
      const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "contact", resultEntityId: contact.id };
      const finalDraft = await tx.jarvisActionDraft.update({ where: { id: current.id }, data: { state: "executed", executedAt, resultEntityType: "contact", resultEntityId: contact.id, integrityTag: createIntegrityTag(executedData) } });
      await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed", result: { id: contact.id, entityType: "contact" } });
      return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return toJarvisContactManagementDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") {
      const latest = await loadBoundContactManagementDraft(previewId, binding, now);
      if (latest.draft.state === "executed") return toJarvisContactManagementDraftView(latest.draft, binding);
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof ContactManagementServiceError) throw new JarvisActionDraftError(error.code === "stale_context" ? "stale_context" : "invalid_input", error.message, 409);
    throw new JarvisActionDraftError("execution_failed", "Der Kontakt wurde nicht angelegt oder geändert; die Vorschau bleibt zur Prüfung erhalten.", 500);
  }
}

function mayDeleteContacts(binding: JarvisTaskDraftBinding) {
  return canDeleteContacts(binding.profile.sessionActor) && canDeleteContacts(binding.profile.effectiveActor);
}

function validateContactDeletionBinding(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId || draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId || draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) throw new JarvisActionDraftError("scope_mismatch", "Diese Kontaktlöschung gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.", 403);
  if (draft.sessionActorRole !== binding.profile.sessionActor.role || draft.effectiveActorRole !== binding.profile.effectiveActor.role) {
    throw new JarvisActionDraftError("role_changed", "Die Rolle hat sich seit der Löschprüfung geändert. Bitte erstelle eine neue Vorschau.", 409);
  }
  if (!integrityMatches(draft)) throw new JarvisActionDraftError("integrity_failed", "Der Integritätsnachweis der Kontaktlöschung ist ungültig.", 409);
  const payload = contactDeletionPayloadSchema.safeParse(draft.payload);
  const context = contactDeletionContextSchema.safeParse(draft.context);
  if (draft.actionId !== "contact.delete" || !payload.success || !context.success || hashJson(payload.data) !== draft.payloadHash || hashJson(context.data) !== draft.contextHash) {
    throw new JarvisActionDraftError("integrity_failed", "Kontaktlöschung oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.", 409);
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundContactDeletionDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) throw new JarvisActionDraftError("not_found", "Die Kontaktlöschung wurde nicht gefunden.", 404);
  validateContactDeletionBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  return { draft: current, ...validateContactDeletionBinding(current, binding) };
}

function toJarvisContactDeletionDraftView(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding): JarvisContactDeletionDraftView {
  const { context } = validateContactDeletionBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayDeleteContacts(binding);
  const ready = state === "awaiting_confirmation" && permitted && context.blockingIssues.length === 0;
  const reason: JarvisContactDeletionDraftView["confirmation"]["reason"] =
    state === "expired" ? "expired" : state === "cancelled" ? "cancelled" : state === "executed" ? "executed" :
    state === "executing" ? "executing" : !permitted ? "not_permitted" : context.blockingIssues.length ? "blocked" : "ready";
  return {
    version: 2, previewId: draft.id, actionId: "contact.delete", title: "Kontakt kontrolliert endgültig löschen",
    badge: state === "executed" ? "Ausgeführt" : state === "executing" ? "Wird geändert" : state === "cancelled" ? "Abgebrochen" : state === "expired" ? "Abgelaufen" : ready ? "Bereit" : "Prüfung",
    state, revision: draft.revision, expiresAt: draft.expiresAt.toISOString(), contactId: context.contact.id,
    customerNumber: context.contact.customerNumber, reason: context.reason, references: context.references,
    fields: [
      { label: "Aktion", value: "Kontakt endgültig löschen" },
      { label: "Kontakt", value: context.contact.displayName },
      { label: "Kundennummer", value: context.contact.customerNumber },
      { label: "Typ", value: context.contact.type },
      { label: "Kategorie", value: context.contact.category },
      { label: "Grund", value: context.reason },
    ],
    checks: context.checks, warnings: context.warnings,
    blockingIssues: [...context.blockingIssues, ...(!permitted ? ["Die endgültige Kontaktlöschung ist für diese Rollenkombination nicht freigegeben."] : [])],
    confirmation: { enabled: ready, reason, requiredText: getContactDeletionConfirmationText(context.contact.customerNumber) },
    cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
  };
}

export async function createPersistedJarvisContactDeletionDraft(input: {
  preview: JarvisActionPreview<"contact.delete">; organizationId: string; sessionId: string;
  profile: JarvisAccessProfile; now?: Date;
}) {
  if (!input.sessionId) throw new JarvisActionDraftError("session_required", "Für eine Kontaktlöschung ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  if (!mayDeleteContacts(input)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Kontakte nicht endgültig löschen.", 403);
  const now = input.now ?? new Date();
  const payload = contactDeletionPayloadSchema.parse(input.preview.payload);
  const context = contactDeletionContextSchema.parse(await evaluateContactDeletion({ organizationId: input.organizationId, contactId: payload.contactId, reason: payload.reason }));
  const actorIds = getActorIds(input.profile);
  const state = context.blockingIssues.length ? "awaiting_input" : "awaiting_confirmation";
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId, organizationId: input.organizationId, sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId, sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId, effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating, actionId: "contact.delete", state, revision: 1,
    payloadHash: hashJson(payload), contextHash: hashJson(context), expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS),
    confirmedAt: null, cancelledAt: null, executedAt: null, resultEntityType: null, resultEntityId: null,
    lastErrorCode: context.blockingIssues.length ? "linked_records" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({ data: { ...draftData, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue, integrityTag: createIntegrityTag(draftData) } });
    await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked", reasonCode: context.blockingIssues.length ? "linked_records" : undefined });
    return draft;
  });
  return toJarvisContactDeletionDraftView(created, input);
}

export async function getJarvisContactDeletionDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const { draft } = await loadBoundContactDeletionDraft(previewId, binding, now);
  return toJarvisContactDeletionDraftView(draft, binding);
}

export async function cancelJarvisContactDeletionDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()) {
  const { draft } = await loadBoundContactDeletionDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisContactDeletionDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Diese Kontaktlöschung kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Die Kontaktlöschung wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({ where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag }, data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) } });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Kontaktlöschung wurde bereits verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" });
    return current;
  });
  return toJarvisContactDeletionDraftView(cancelled, binding);
}

export async function confirmJarvisContactDeletionDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, confirmationText: string, now = new Date()) {
  const loaded = await loadBoundContactDeletionDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisContactDeletionDraftView(loaded.draft, binding);
  const requiredText = getContactDeletionConfirmationText(loaded.context.contact.customerNumber);
  if (confirmationText.trim() !== requiredText) throw new JarvisActionDraftError("invalid_input", `Gib zur endgültigen Löschung exakt „${requiredText}“ ein.`, 400);
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") throw new JarvisActionDraftError("conflict", "Nur die aktuelle, vollständig freie Löschprüfung darf bestätigt werden.", 409);
  if (!mayDeleteContacts(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Kontakte nicht endgültig löschen.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } });
      if (!current) throw new JarvisActionDraftError("not_found", "Die Kontaktlöschung wurde nicht gefunden.", 404);
      const parsed = validateContactDeletionBinding(current, binding);
      if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Die Kontaktlöschung ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      const actor = await tx.user.findFirst({ where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true }, select: { id: true, role: true, firstName: true, lastName: true, email: true } });
      if (!actor || !canDeleteContacts(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Löschberechtigung sind nicht mehr aktuell.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null };
      const claimed = await tx.jarvisActionDraft.updateMany({ where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag }, data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) } });
      if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Der Kontakt wird bereits gelöscht.", 409);
      const deleted = await executeContactDeletion({ tx, organizationId: binding.organizationId, contactId: parsed.payload.contactId, reason: parsed.payload.reason, actorId: actor.id, requestId: current.id, expectedFingerprint: parsed.context.fingerprint });
      const executedAt = new Date();
      const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "contact", resultEntityId: deleted.id };
      const finalDraft = await tx.jarvisActionDraft.update({ where: { id: current.id }, data: { state: "executed", executedAt, resultEntityType: "contact", resultEntityId: deleted.id, integrityTag: createIntegrityTag(executedData) } });
      await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed", result: { id: deleted.id, entityType: "contact" } });
      return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return toJarvisContactDeletionDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") {
      const latest = await loadBoundContactDeletionDraft(previewId, binding, now);
      if (latest.draft.state === "executed") return toJarvisContactDeletionDraftView(latest.draft, binding);
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof ContactDeletionServiceError) throw new JarvisActionDraftError(error.code === "stale_context" ? "stale_context" : error.code === "conflict" ? "conflict" : "invalid_input", error.message, error.code === "invalid_input" ? 400 : 409);
    throw new JarvisActionDraftError("execution_failed", "Der Kontakt wurde nicht gelöscht; die Vorschau bleibt zur Prüfung erhalten.", 500);
  }
}

function mayManageCatalog(binding: JarvisTaskDraftBinding) {
  return canManageCatalogItems(binding.profile.sessionActor) && canManageCatalogItems(binding.profile.effectiveActor);
}

function validateCatalogManagementBinding(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  if (draft.organizationId !== binding.organizationId || draft.sessionId !== binding.sessionId || draft.sessionActorId !== actorIds.sessionActorId || draft.effectiveActorId !== actorIds.effectiveActorId || draft.impersonating !== binding.profile.isImpersonating) {
    throw new JarvisActionDraftError("scope_mismatch", "Diese Katalogaktion gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.", 403);
  }
  if (draft.sessionActorRole !== binding.profile.sessionActor.role || draft.effectiveActorRole !== binding.profile.effectiveActor.role) throw new JarvisActionDraftError("role_changed", "Die Rolle hat sich seit der Katalogprüfung geändert. Bitte erstelle eine neue Vorschau.", 409);
  if (!integrityMatches(draft)) throw new JarvisActionDraftError("integrity_failed", "Der Integritätsnachweis der Katalogaktion ist ungültig.", 409);
  const payload = catalogManagementPayloadSchema.safeParse(draft.payload);
  const context = catalogManagementContextSchema.safeParse(draft.context);
  if (draft.actionId !== "catalog.manage" || !payload.success || !context.success || hashJson(payload.data) !== draft.payloadHash || hashJson(context.data) !== draft.contextHash) {
    throw new JarvisActionDraftError("integrity_failed", "Katalogänderung oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.", 409);
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundCatalogManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) throw new JarvisActionDraftError("not_found", "Die Katalogaktion wurde nicht gefunden.", 404);
  validateCatalogManagementBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  return { draft: current, ...validateCatalogManagementBinding(current, binding) };
}

function toJarvisCatalogManagementDraftView(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding): JarvisCatalogManagementDraftView {
  const { context } = validateCatalogManagementBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayManageCatalog(binding);
  const ready = state === "awaiting_confirmation" && permitted && context.blockingIssues.length === 0;
  const reason: JarvisCatalogManagementDraftView["confirmation"]["reason"] = state === "expired" ? "expired" : state === "cancelled" ? "cancelled" : state === "executed" ? "executed" : state === "executing" ? "executing" : !permitted ? "not_permitted" : context.blockingIssues.length ? "blocked" : "ready";
  return {
    version: 2, previewId: draft.id, actionId: "catalog.manage", title: "Katalogposition kontrolliert anlegen oder bearbeiten",
    badge: state === "executed" ? "Ausgeführt" : state === "executing" ? "Wird geändert" : state === "cancelled" ? "Abgebrochen" : state === "expired" ? "Abgelaufen" : ready ? "Bereit" : "Prüfung",
    state, revision: draft.revision, expiresAt: draft.expiresAt.toISOString(), mode: context.mode, catalogItemId: context.item.id, catalogNumber: context.item.number,
    fields: [
      { label: "Aktion", value: context.mode === "create" ? "Artikel/Leistung anlegen" : "Artikel/Leistung bearbeiten" },
      { label: "Art", value: context.item.type === "service" ? "Leistung" : "Artikel" }, { label: "Nummer", value: context.item.number },
      { label: "Bezeichnung", value: context.values.name || "fehlt" }, { label: "Rohertrag", value: `${context.calculation.grossProfit.toFixed(2).replace(".", ",")} €` },
      { label: "Marge", value: context.calculation.marginPercent === null ? "nicht berechenbar" : `${context.calculation.marginPercent.toFixed(2).replace(".", ",")} %` },
    ],
    changes: context.changes, impacts: context.impacts, calculation: context.calculation, reviewWillBeInvalidated: context.reviewWillBeInvalidated,
    checks: context.checks, warnings: context.warnings,
    blockingIssues: [...context.blockingIssues, ...(!permitted ? ["Diese Rollenkombination darf Katalogstammdaten nicht verwalten."] : [])],
    confirmation: { enabled: ready, reason, requiredText: getCatalogManagementConfirmationText(context.mode, context.item.number) }, cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
    ...(state === "executed" && draft.resultEntityId ? { result: { entityType: "catalogItem" as const, entityId: draft.resultEntityId, label: "Katalogposition öffnen" } } : {}),
  };
}

export async function createPersistedJarvisCatalogManagementDraft(input: { preview: JarvisActionPreview<"catalog.manage">; organizationId: string; sessionId: string; profile: JarvisAccessProfile; now?: Date }) {
  if (!input.sessionId) throw new JarvisActionDraftError("session_required", "Für eine Katalogaktion ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  if (!mayManageCatalog(input)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Katalogstammdaten nicht verwalten.", 403);
  const now = input.now ?? new Date(); const payload = catalogManagementPayloadSchema.parse(input.preview.payload);
  const evaluation = payload.mode === "create" ? await evaluateCatalogCreation({ organizationId: input.organizationId, values: payload.values as CatalogManagementValues }) : await evaluateCatalogChange({ organizationId: input.organizationId, catalogItemId: payload.catalogItemId || "", changes: payload.values as CatalogManagementValues });
  const context = catalogManagementContextSchema.parse(evaluation); const actorIds = getActorIds(input.profile); const state = context.blockingIssues.length ? "awaiting_input" : "awaiting_confirmation";
  const draftData: DraftIntegrityData = { id: input.preview.previewId, organizationId: input.organizationId, sessionId: input.sessionId, sessionActorId: actorIds.sessionActorId, sessionActorRole: input.profile.sessionActor.role, effectiveActorId: actorIds.effectiveActorId, effectiveActorRole: input.profile.effectiveActor.role, impersonating: input.profile.isImpersonating, actionId: "catalog.manage", state, revision: 1, payloadHash: hashJson(payload), contextHash: hashJson(context), expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS), confirmedAt: null, cancelledAt: null, executedAt: null, resultEntityType: null, resultEntityId: null, lastErrorCode: context.blockingIssues.length ? "catalog_validation" : null };
  const created = await prisma.$transaction(async (tx) => { const draft = await tx.jarvisActionDraft.create({ data: { ...draftData, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue, integrityTag: createIntegrityTag(draftData) } }); await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked", reasonCode: context.blockingIssues.length ? "catalog_validation" : undefined }); return draft; });
  return toJarvisCatalogManagementDraftView(created, input);
}

export async function getJarvisCatalogManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) { const { draft } = await loadBoundCatalogManagementDraft(previewId, binding, now); return toJarvisCatalogManagementDraftView(draft, binding); }

export async function cancelJarvisCatalogManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()) {
  const { draft } = await loadBoundCatalogManagementDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisCatalogManagementDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Diese Katalogaktion kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Die Katalogaktion wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => { const changed = await tx.jarvisActionDraft.updateMany({ where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag }, data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) } }); if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Katalogaktion wurde bereits verändert.", 409); const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } }); await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" }); return current; });
  return toJarvisCatalogManagementDraftView(cancelled, binding);
}

export async function confirmJarvisCatalogManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, confirmationText: string, now = new Date()) {
  const loaded = await loadBoundCatalogManagementDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisCatalogManagementDraftView(loaded.draft, binding);
  const requiredText = getCatalogManagementConfirmationText(loaded.context.mode, loaded.context.item.number);
  if (confirmationText.trim() !== requiredText) throw new JarvisActionDraftError("invalid_input", `Gib zur Bestätigung exakt „${requiredText}“ ein.`, 400);
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") throw new JarvisActionDraftError("conflict", "Nur die aktuelle, vollständig geprüfte Katalogvorschau darf bestätigt werden.", 409);
  if (!mayManageCatalog(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Katalogstammdaten nicht verwalten.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } }); if (!current) throw new JarvisActionDraftError("not_found", "Die Katalogaktion wurde nicht gefunden.", 404);
      const parsed = validateCatalogManagementBinding(current, binding); if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Die Katalogaktion ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      const actor = await tx.user.findFirst({ where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true }, select: { id: true, role: true, firstName: true, lastName: true, email: true } });
      if (!actor || !canManageCatalogItems(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Katalogberechtigung sind nicht mehr aktuell.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null }; const claimed = await tx.jarvisActionDraft.updateMany({ where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag }, data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) } }); if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Katalogposition wird bereits verarbeitet.", 409);
      const actorName = [actor.firstName, actor.lastName].map((value) => String(value ?? "").trim()).filter(Boolean).join(" ") || actor.email;
      const item = await executeCatalogManagement({ tx, organizationId: binding.organizationId, mode: parsed.payload.mode, catalogItemId: parsed.payload.catalogItemId, values: parsed.payload.values as CatalogManagementValues, actorId: actor.id, actorName, requestId: current.id, expectedFingerprint: parsed.context.fingerprint });
      const executedAt = new Date(); const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "catalogItem", resultEntityId: item.id }; const finalDraft = await tx.jarvisActionDraft.update({ where: { id: current.id }, data: { state: "executed", executedAt, resultEntityType: "catalogItem", resultEntityId: item.id, integrityTag: createIntegrityTag(executedData) } }); await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed", result: { id: item.id, entityType: "catalogItem" } }); return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return toJarvisCatalogManagementDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") { const latest = await loadBoundCatalogManagementDraft(previewId, binding, now); if (latest.draft.state === "executed") return toJarvisCatalogManagementDraftView(latest.draft, binding); }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof CatalogManagementServiceError) throw new JarvisActionDraftError(error.code === "stale_context" ? "stale_context" : error.code === "conflict" ? "conflict" : "invalid_input", error.message, error.code === "invalid_input" ? 400 : 409);
    throw new JarvisActionDraftError("execution_failed", "Die Katalogposition wurde nicht angelegt oder geändert; die Vorschau bleibt zur Prüfung erhalten.", 500);
  }
}

function mayManagePersonnel(binding: JarvisTaskDraftBinding) {
  return canManageUsers(binding.profile.sessionActor) && canManageUsers(binding.profile.effectiveActor);
}

function getPersonnelRoleLabel(role: Role) {
  return ({ ADMIN: "Admin", GESCHAEFTSFUEHRER: "Geschäftsführung", FUEHRUNGSKRAFT: "Führungskraft", VERTRIEB: "Vertrieb", BUCHHALTUNG: "Buchhaltung", MITARBEITER: "Mitarbeiter", GAST: "Gast" } as Record<Role, string>)[role];
}

function validatePersonnelManagementBinding(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  if (draft.organizationId !== binding.organizationId || draft.sessionId !== binding.sessionId || draft.sessionActorId !== actorIds.sessionActorId || draft.effectiveActorId !== actorIds.effectiveActorId || draft.impersonating !== binding.profile.isImpersonating) {
    throw new JarvisActionDraftError("scope_mismatch", "Diese Personaländerung gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.", 403);
  }
  if (draft.sessionActorRole !== binding.profile.sessionActor.role || draft.effectiveActorRole !== binding.profile.effectiveActor.role) throw new JarvisActionDraftError("role_changed", "Die Rolle hat sich seit der Personalprüfung geändert. Bitte erstelle eine neue Vorschau.", 409);
  if (!integrityMatches(draft)) throw new JarvisActionDraftError("integrity_failed", "Der Integritätsnachweis der Personaländerung ist ungültig.", 409);
  const payload = personnelManagementPayloadSchema.safeParse(draft.payload);
  const context = personnelManagementContextSchema.safeParse(draft.context);
  if (draft.actionId !== "personnel.manage" || !payload.success || !context.success || hashJson(payload.data) !== draft.payloadHash || hashJson(context.data) !== draft.contextHash) {
    throw new JarvisActionDraftError("integrity_failed", "Personaländerung oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.", 409);
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundPersonnelManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) throw new JarvisActionDraftError("not_found", "Die Personaländerung wurde nicht gefunden.", 404);
  validatePersonnelManagementBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  return { draft: current, ...validatePersonnelManagementBinding(current, binding) };
}

function toJarvisPersonnelManagementDraftView(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding): JarvisPersonnelManagementDraftView {
  const { context } = validatePersonnelManagementBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayManagePersonnel(binding);
  const ready = state === "awaiting_confirmation" && permitted && context.blockingIssues.length === 0;
  const reason: JarvisPersonnelManagementDraftView["confirmation"]["reason"] = state === "expired" ? "expired" : state === "cancelled" ? "cancelled" : state === "executed" ? "executed" : state === "executing" ? "executing" : !permitted ? "not_permitted" : context.blockingIssues.length ? "blocked" : "ready";
  return {
    version: 2, previewId: draft.id, actionId: "personnel.manage", title: "Personalstammdaten kontrolliert ändern",
    badge: state === "executed" ? "Ausgeführt" : state === "executing" ? "Wird geändert" : state === "cancelled" ? "Abgebrochen" : state === "expired" ? "Abgelaufen" : ready ? "Bereit" : "Prüfung",
    state, revision: draft.revision, expiresAt: draft.expiresAt.toISOString(), employeeId: context.employee.id, employeeEmail: context.employee.email,
    fields: [{ label: "Mitarbeiter", value: context.employee.label }, { label: "Dienstliche E-Mail", value: context.employee.email }, { label: "Rolle bisher", value: getPersonnelRoleLabel(context.employee.role) }],
    changes: context.changes, impacts: context.impacts, roleSessionsWillBeRevoked: context.roleSessionsWillBeRevoked,
    checks: context.checks, warnings: context.warnings,
    blockingIssues: [...context.blockingIssues, ...(!permitted ? ["Diese Rollenkombination darf Personalstammdaten nicht verwalten."] : [])],
    confirmation: { enabled: ready, reason, requiredText: getPersonnelManagementConfirmationText(context.employee.email) },
    cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
    ...(state === "executed" && draft.resultEntityId ? { result: { entityType: "user" as const, entityId: draft.resultEntityId, label: "Mitarbeiter öffnen" } } : {}),
  };
}

export async function createPersistedJarvisPersonnelManagementDraft(input: { preview: JarvisActionPreview<"personnel.manage">; organizationId: string; sessionId: string; profile: JarvisAccessProfile; now?: Date }) {
  if (!input.sessionId) throw new JarvisActionDraftError("session_required", "Für eine Personaländerung ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  if (!mayManagePersonnel(input)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Personalstammdaten nicht verwalten.", 403);
  const now = input.now ?? new Date(); const payload = personnelManagementPayloadSchema.parse(input.preview.payload); const actorIds = getActorIds(input.profile);
  const evaluation = await evaluatePersonnelChange({ organizationId: input.organizationId, employeeId: payload.employeeId, actorId: actorIds.effectiveActorId, actorRole: input.profile.effectiveActor.role, changes: payload.values as PersonnelManagementValues });
  const context = personnelManagementContextSchema.parse(evaluation); const state = context.blockingIssues.length ? "awaiting_input" : "awaiting_confirmation";
  const draftData: DraftIntegrityData = { id: input.preview.previewId, organizationId: input.organizationId, sessionId: input.sessionId, sessionActorId: actorIds.sessionActorId, sessionActorRole: input.profile.sessionActor.role, effectiveActorId: actorIds.effectiveActorId, effectiveActorRole: input.profile.effectiveActor.role, impersonating: input.profile.isImpersonating, actionId: "personnel.manage", state, revision: 1, payloadHash: hashJson(payload), contextHash: hashJson(context), expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS), confirmedAt: null, cancelledAt: null, executedAt: null, resultEntityType: null, resultEntityId: null, lastErrorCode: context.blockingIssues.length ? "personnel_validation" : null };
  const created = await prisma.$transaction(async (tx) => { const draft = await tx.jarvisActionDraft.create({ data: { ...draftData, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue, integrityTag: createIntegrityTag(draftData) } }); await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked", reasonCode: context.blockingIssues.length ? "personnel_validation" : undefined }); return draft; });
  return toJarvisPersonnelManagementDraftView(created, input);
}

export async function getJarvisPersonnelManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) { const { draft } = await loadBoundPersonnelManagementDraft(previewId, binding, now); return toJarvisPersonnelManagementDraftView(draft, binding); }

export async function cancelJarvisPersonnelManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()) {
  const { draft } = await loadBoundPersonnelManagementDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisPersonnelManagementDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Diese Personaländerung kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Die Personaländerung wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => { const changed = await tx.jarvisActionDraft.updateMany({ where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag }, data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) } }); if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Personaländerung wurde bereits verändert.", 409); const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } }); await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" }); return current; });
  return toJarvisPersonnelManagementDraftView(cancelled, binding);
}

export async function confirmJarvisPersonnelManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, confirmationText: string, now = new Date()) {
  const loaded = await loadBoundPersonnelManagementDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisPersonnelManagementDraftView(loaded.draft, binding);
  const requiredText = getPersonnelManagementConfirmationText(loaded.context.employee.email);
  if (confirmationText.trim() !== requiredText) throw new JarvisActionDraftError("invalid_input", `Gib zur Bestätigung exakt „${requiredText}“ ein.`, 400);
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") throw new JarvisActionDraftError("conflict", "Nur die aktuelle, vollständig geprüfte Personalvorschau darf bestätigt werden.", 409);
  if (!mayManagePersonnel(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Personalstammdaten nicht verwalten.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } }); if (!current) throw new JarvisActionDraftError("not_found", "Die Personaländerung wurde nicht gefunden.", 404);
      const parsed = validatePersonnelManagementBinding(current, binding); if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Die Personaländerung ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      const actor = await tx.user.findFirst({ where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true }, select: { id: true, role: true } });
      if (!actor || !canManageUsers(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Personalberechtigung sind nicht mehr aktuell.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null }; const claimed = await tx.jarvisActionDraft.updateMany({ where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag }, data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) } }); if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Personaländerung wird bereits verarbeitet.", 409);
      const employee = await executePersonnelChange({ tx, organizationId: binding.organizationId, employeeId: parsed.payload.employeeId, actorId: actor.id, actorRole: actor.role, changes: parsed.payload.values as PersonnelManagementValues, requestId: current.id, expectedFingerprint: parsed.context.fingerprint });
      const executedAt = new Date(); const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "user", resultEntityId: employee.id }; const finalDraft = await tx.jarvisActionDraft.update({ where: { id: current.id }, data: { state: "executed", executedAt, resultEntityType: "user", resultEntityId: employee.id, integrityTag: createIntegrityTag(executedData) } }); await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed", result: { id: employee.id, entityType: "user" } }); return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return toJarvisPersonnelManagementDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") { const latest = await loadBoundPersonnelManagementDraft(previewId, binding, now); if (latest.draft.state === "executed") return toJarvisPersonnelManagementDraftView(latest.draft, binding); }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof PersonnelManagementServiceError) throw new JarvisActionDraftError(error.code === "stale_context" ? "stale_context" : error.code === "conflict" ? "conflict" : "invalid_input", error.message, error.code === "invalid_input" ? 400 : 409);
    throw new JarvisActionDraftError("execution_failed", "Die Personalstammdaten wurden nicht geändert; die Vorschau bleibt zur Prüfung erhalten.", 500);
  }
}

function mayManageEmployeeCosts(binding: JarvisTaskDraftBinding) {
  return canManageUsers(binding.profile.sessionActor) && canAccessEmployeeCosts(binding.profile.sessionActor) && canManageUsers(binding.profile.effectiveActor) && canAccessEmployeeCosts(binding.profile.effectiveActor);
}

function validateEmployeeCostManagementBinding(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  if (draft.organizationId !== binding.organizationId || draft.sessionId !== binding.sessionId || draft.sessionActorId !== actorIds.sessionActorId || draft.effectiveActorId !== actorIds.effectiveActorId || draft.impersonating !== binding.profile.isImpersonating) {
    throw new JarvisActionDraftError("scope_mismatch", "Diese Lohnkostenänderung gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.", 403);
  }
  if (draft.sessionActorRole !== binding.profile.sessionActor.role || draft.effectiveActorRole !== binding.profile.effectiveActor.role) throw new JarvisActionDraftError("role_changed", "Die Rolle hat sich seit der Lohnkostenprüfung geändert. Bitte erstelle eine neue Vorschau.", 409);
  if (!integrityMatches(draft)) throw new JarvisActionDraftError("integrity_failed", "Der Integritätsnachweis der Lohnkostenänderung ist ungültig.", 409);
  const payload = employeeCostPayloadSchema.safeParse(draft.payload);
  const context = employeeCostContextSchema.safeParse(draft.context);
  if (draft.actionId !== "payroll.manage" || !payload.success || !context.success || hashJson(payload.data) !== draft.payloadHash || hashJson(context.data) !== draft.contextHash) throw new JarvisActionDraftError("integrity_failed", "Lohnkostenänderung oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.", 409);
  return { payload: payload.data, context: context.data };
}

async function loadBoundEmployeeCostManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) throw new JarvisActionDraftError("not_found", "Die Lohnkostenänderung wurde nicht gefunden.", 404);
  validateEmployeeCostManagementBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  return { draft: current, ...validateEmployeeCostManagementBinding(current, binding) };
}

function toJarvisEmployeeCostManagementDraftView(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding): JarvisEmployeeCostManagementDraftView {
  const { context } = validateEmployeeCostManagementBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayManageEmployeeCosts(binding);
  const ready = state === "awaiting_confirmation" && permitted && context.blockingIssues.length === 0;
  const reason: JarvisEmployeeCostManagementDraftView["confirmation"]["reason"] = state === "expired" ? "expired" : state === "cancelled" ? "cancelled" : state === "executed" ? "executed" : state === "executing" ? "executing" : !permitted ? "not_permitted" : context.blockingIssues.length ? "blocked" : "ready";
  return {
    version: 2, previewId: draft.id, actionId: "payroll.manage", title: "Lohn- und Mitarbeiterkosten kontrolliert ändern",
    badge: state === "executed" ? "Ausgeführt" : state === "executing" ? "Wird geändert" : state === "cancelled" ? "Abgebrochen" : state === "expired" ? "Abgelaufen" : ready ? "Bereit" : "Prüfung",
    state, revision: draft.revision, expiresAt: draft.expiresAt.toISOString(), employeeId: context.employee.id, employeeEmail: context.employee.email,
    fields: [{ label: "Mitarbeiter", value: context.employee.label }, { label: "Dienstliche E-Mail", value: context.employee.email }, { label: "Kostenstand", value: context.cost.exists ? "vorhanden" : "Standardwerte" }],
    changes: context.changes, metrics: context.metrics, impacts: context.impacts, checks: context.checks, warnings: context.warnings,
    blockingIssues: [...context.blockingIssues, ...(!permitted ? ["Diese Rollenkombination darf Lohn- und Mitarbeiterkosten nicht verwalten."] : [])],
    confirmation: { enabled: ready, reason, requiredText: getEmployeeCostConfirmationText(context.employee.email) },
    cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
    ...(state === "executed" && draft.resultEntityId ? { result: { entityType: "user" as const, entityId: draft.resultEntityId, label: "Mitarbeiterkosten öffnen" } } : {}),
  };
}

export async function createPersistedJarvisEmployeeCostManagementDraft(input: { preview: JarvisActionPreview<"payroll.manage">; organizationId: string; sessionId: string; profile: JarvisAccessProfile; now?: Date }) {
  if (!input.sessionId) throw new JarvisActionDraftError("session_required", "Für eine Lohnkostenänderung ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  if (!mayManageEmployeeCosts(input)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Lohn- und Mitarbeiterkosten nicht verwalten.", 403);
  const now = input.now ?? new Date(); const payload = employeeCostPayloadSchema.parse(input.preview.payload); const actorIds = getActorIds(input.profile);
  const evaluation = await evaluateEmployeeCostChange({ organizationId: input.organizationId, userId: payload.userId, changes: payload.values as EmployeeCostValues });
  const context = employeeCostContextSchema.parse(evaluation); const state = context.blockingIssues.length ? "awaiting_input" : "awaiting_confirmation";
  const draftData: DraftIntegrityData = { id: input.preview.previewId, organizationId: input.organizationId, sessionId: input.sessionId, sessionActorId: actorIds.sessionActorId, sessionActorRole: input.profile.sessionActor.role, effectiveActorId: actorIds.effectiveActorId, effectiveActorRole: input.profile.effectiveActor.role, impersonating: input.profile.isImpersonating, actionId: "payroll.manage", state, revision: 1, payloadHash: hashJson(payload), contextHash: hashJson(context), expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS), confirmedAt: null, cancelledAt: null, executedAt: null, resultEntityType: null, resultEntityId: null, lastErrorCode: context.blockingIssues.length ? "employee_cost_validation" : null };
  const created = await prisma.$transaction(async (tx) => { const draft = await tx.jarvisActionDraft.create({ data: { ...draftData, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue, integrityTag: createIntegrityTag(draftData) } }); await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked", reasonCode: context.blockingIssues.length ? "employee_cost_validation" : undefined }); return draft; });
  return toJarvisEmployeeCostManagementDraftView(created, input);
}

export async function getJarvisEmployeeCostManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) { const { draft } = await loadBoundEmployeeCostManagementDraft(previewId, binding, now); return toJarvisEmployeeCostManagementDraftView(draft, binding); }

export async function cancelJarvisEmployeeCostManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()) {
  const { draft } = await loadBoundEmployeeCostManagementDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisEmployeeCostManagementDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Diese Lohnkostenänderung kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Die Lohnkostenänderung wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => { const changed = await tx.jarvisActionDraft.updateMany({ where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag }, data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) } }); if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Lohnkostenänderung wurde bereits verändert.", 409); const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } }); await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" }); return current; });
  return toJarvisEmployeeCostManagementDraftView(cancelled, binding);
}

export async function confirmJarvisEmployeeCostManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, confirmationText: string, now = new Date()) {
  const loaded = await loadBoundEmployeeCostManagementDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisEmployeeCostManagementDraftView(loaded.draft, binding);
  const requiredText = getEmployeeCostConfirmationText(loaded.context.employee.email);
  if (confirmationText.trim() !== requiredText) throw new JarvisActionDraftError("invalid_input", `Gib zur Bestätigung exakt „${requiredText}“ ein.`, 400);
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") throw new JarvisActionDraftError("conflict", "Nur die aktuelle, vollständig geprüfte Lohnkostenvorschau darf bestätigt werden.", 409);
  if (!mayManageEmployeeCosts(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Lohn- und Mitarbeiterkosten nicht verwalten.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } }); if (!current) throw new JarvisActionDraftError("not_found", "Die Lohnkostenänderung wurde nicht gefunden.", 404);
      const parsed = validateEmployeeCostManagementBinding(current, binding); if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Die Lohnkostenänderung ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      const actor = await tx.user.findFirst({ where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true }, select: { id: true, role: true, firstName: true, lastName: true, email: true } });
      if (!actor || !canManageUsers(actor) || !canAccessEmployeeCosts(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Lohnkostenberechtigung sind nicht mehr aktuell.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null }; const claimed = await tx.jarvisActionDraft.updateMany({ where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag }, data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) } }); if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Lohnkostenänderung wird bereits verarbeitet.", 409);
      const actorName = [actor.firstName, actor.lastName].map((value) => String(value ?? "").trim()).filter(Boolean).join(" ") || actor.email;
      await executeEmployeeCostChange({ tx, organizationId: binding.organizationId, userId: parsed.payload.userId, actorId: actor.id, actorName, changes: parsed.payload.values as EmployeeCostValues, requestId: current.id, expectedFingerprint: parsed.context.fingerprint, source: "jarvis" });
      const executedAt = new Date(); const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "user", resultEntityId: parsed.payload.userId }; const finalDraft = await tx.jarvisActionDraft.update({ where: { id: current.id }, data: { state: "executed", executedAt, resultEntityType: "user", resultEntityId: parsed.payload.userId, integrityTag: createIntegrityTag(executedData) } }); await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed", result: { id: parsed.payload.userId, entityType: "user" } }); return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return toJarvisEmployeeCostManagementDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") { const latest = await loadBoundEmployeeCostManagementDraft(previewId, binding, now); if (latest.draft.state === "executed") return toJarvisEmployeeCostManagementDraftView(latest.draft, binding); }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof EmployeeCostManagementServiceError) throw new JarvisActionDraftError(error.code === "stale_context" ? "stale_context" : error.code === "conflict" ? "conflict" : "invalid_input", error.message, error.code === "invalid_input" ? 400 : 409);
    throw new JarvisActionDraftError("execution_failed", "Die Lohn- und Mitarbeiterkosten wurden nicht geändert; die Vorschau bleibt zur Prüfung erhalten.", 500);
  }
}

function mayRunBulkUpdate(binding: JarvisTaskDraftBinding) {
  return canManageUsers(binding.profile.sessionActor) && canManageContacts(binding.profile.sessionActor) && canManageUsers(binding.profile.effectiveActor) && canManageContacts(binding.profile.effectiveActor);
}

function validateBulkUpdateBinding(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  if (draft.organizationId !== binding.organizationId || draft.sessionId !== binding.sessionId || draft.sessionActorId !== actorIds.sessionActorId || draft.effectiveActorId !== actorIds.effectiveActorId || draft.impersonating !== binding.profile.isImpersonating) {
    throw new JarvisActionDraftError("scope_mismatch", "Diese Massenänderung gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.", 403);
  }
  if (draft.sessionActorRole !== binding.profile.sessionActor.role || draft.effectiveActorRole !== binding.profile.effectiveActor.role) throw new JarvisActionDraftError("role_changed", "Die Rolle hat sich seit dem Dry-Run geändert. Bitte erstelle eine neue Vorschau.", 409);
  if (!integrityMatches(draft)) throw new JarvisActionDraftError("integrity_failed", "Der Integritätsnachweis der Massenänderung ist ungültig.", 409);
  const payload = bulkUpdatePayloadSchema.safeParse(draft.payload);
  const context = bulkUpdateContextSchema.safeParse(draft.context);
  if (draft.actionId !== "bulk.update" || !payload.success || !context.success || hashJson(payload.data) !== draft.payloadHash || hashJson(context.data) !== draft.contextHash) throw new JarvisActionDraftError("integrity_failed", "Massenänderung oder Dry-Run stimmen nicht mit dem Integritätsnachweis überein.", 409);
  return { payload: payload.data, context: context.data };
}

async function loadBoundBulkUpdateDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) throw new JarvisActionDraftError("not_found", "Die Massenänderung wurde nicht gefunden.", 404);
  validateBulkUpdateBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  return { draft: current, ...validateBulkUpdateBinding(current, binding) };
}

function toJarvisBulkUpdateDraftView(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding): JarvisBulkUpdateDraftView {
  const { context } = validateBulkUpdateBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayRunBulkUpdate(binding);
  const ready = state === "awaiting_confirmation" && permitted && context.blockingIssues.length === 0;
  const reason: JarvisBulkUpdateDraftView["confirmation"]["reason"] = state === "expired" ? "expired" : state === "cancelled" ? "cancelled" : state === "executed" ? "executed" : state === "executing" ? "executing" : !permitted ? "not_permitted" : context.blockingIssues.length ? "blocked" : "ready";
  return {
    version: 2, previewId: draft.id, actionId: "bulk.update", title: "Kontaktkategorien kontrolliert massenhaft ändern",
    badge: state === "executed" ? "Ausgeführt" : state === "executing" ? "Wird geändert" : state === "cancelled" ? "Abgebrochen" : state === "expired" ? "Abgelaufen" : ready ? "Bereit" : "Prüfung",
    state, revision: draft.revision, expiresAt: draft.expiresAt.toISOString(), mode: context.mode, sourceRequestId: context.sourceRequestId,
    targetCategory: context.targetCategory,
    fields: [
      { label: "Aktion", value: context.mode === "rollback" ? "Exakte Rückrollung" : "Kontaktkategorie ändern" },
      { label: "Ziel", value: context.targetCategory },
      { label: "Treffer", value: `${context.items.length} Kontakt(e)` },
    ],
    items: context.items, excluded: context.excluded, checks: context.checks, warnings: context.warnings,
    blockingIssues: [...context.blockingIssues, ...(!permitted ? ["Diese Rollenkombination darf Kontakt-Massenänderungen nicht ausführen."] : [])],
    confirmation: { enabled: ready, reason, requiredText: getContactBulkCategoryConfirmationText(context) },
    cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
    ...(state === "executed" && draft.resultEntityId ? { result: { entityType: "contact" as const, entityId: draft.resultEntityId, label: "Kontakte öffnen" } } : {}),
  };
}

export async function createPersistedJarvisBulkUpdateDraft(input: { preview: JarvisActionPreview<"bulk.update">; organizationId: string; sessionId: string; profile: JarvisAccessProfile; now?: Date }) {
  if (!input.sessionId) throw new JarvisActionDraftError("session_required", "Für eine Massenänderung ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  if (!mayRunBulkUpdate(input)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Kontakt-Massenänderungen nicht ausführen.", 403);
  const now = input.now ?? new Date(); const payload = bulkUpdatePayloadSchema.parse(input.preview.payload); const actorIds = getActorIds(input.profile);
  const evaluation = await evaluateContactBulkCategory({ organizationId: input.organizationId, request: payload as ContactBulkCategoryRequest });
  const context = bulkUpdateContextSchema.parse(evaluation); const state = context.blockingIssues.length ? "awaiting_input" : "awaiting_confirmation";
  const draftData: DraftIntegrityData = { id: input.preview.previewId, organizationId: input.organizationId, sessionId: input.sessionId, sessionActorId: actorIds.sessionActorId, sessionActorRole: input.profile.sessionActor.role, effectiveActorId: actorIds.effectiveActorId, effectiveActorRole: input.profile.effectiveActor.role, impersonating: input.profile.isImpersonating, actionId: "bulk.update", state, revision: 1, payloadHash: hashJson(payload), contextHash: hashJson(context), expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS), confirmedAt: null, cancelledAt: null, executedAt: null, resultEntityType: null, resultEntityId: null, lastErrorCode: context.blockingIssues.length ? "bulk_validation" : null };
  const created = await prisma.$transaction(async (tx) => { const draft = await tx.jarvisActionDraft.create({ data: { ...draftData, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue, integrityTag: createIntegrityTag(draftData) } }); await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked", reasonCode: context.blockingIssues.length ? "bulk_validation" : undefined }); return draft; });
  return toJarvisBulkUpdateDraftView(created, input);
}

export async function getJarvisBulkUpdateDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) { const { draft } = await loadBoundBulkUpdateDraft(previewId, binding, now); return toJarvisBulkUpdateDraftView(draft, binding); }

export async function cancelJarvisBulkUpdateDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()) {
  const { draft } = await loadBoundBulkUpdateDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisBulkUpdateDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Diese Massenänderung kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Die Massenänderung wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => { const changed = await tx.jarvisActionDraft.updateMany({ where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag }, data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) } }); if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Massenänderung wurde bereits verändert.", 409); const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } }); await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" }); return current; });
  return toJarvisBulkUpdateDraftView(cancelled, binding);
}

export async function confirmJarvisBulkUpdateDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, confirmationText: string, now = new Date()) {
  const loaded = await loadBoundBulkUpdateDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisBulkUpdateDraftView(loaded.draft, binding);
  const requiredText = getContactBulkCategoryConfirmationText(loaded.context);
  if (confirmationText.trim() !== requiredText) throw new JarvisActionDraftError("invalid_input", `Gib zur Bestätigung exakt „${requiredText}“ ein.`, 400);
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") throw new JarvisActionDraftError("conflict", "Nur der aktuelle, vollständig geprüfte Dry-Run darf bestätigt werden.", 409);
  if (!mayRunBulkUpdate(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Kontakt-Massenänderungen nicht ausführen.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } }); if (!current) throw new JarvisActionDraftError("not_found", "Die Massenänderung wurde nicht gefunden.", 404);
      const parsed = validateBulkUpdateBinding(current, binding); if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Die Massenänderung ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      const actor = await tx.user.findFirst({ where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true }, select: { id: true, role: true } });
      if (!actor || !canManageUsers(actor) || !canManageContacts(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Massenänderungsberechtigung sind nicht mehr aktuell.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null }; const claimed = await tx.jarvisActionDraft.updateMany({ where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag }, data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) } }); if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Massenänderung wird bereits verarbeitet.", 409);
      const result = await executeContactBulkCategory({ tx, organizationId: binding.organizationId, actorId: actor.id, requestId: current.id, request: parsed.payload as ContactBulkCategoryRequest, expectedFingerprint: parsed.context.fingerprint });
      const resultContactId = parsed.context.items[0]?.id ?? result.sourceRequestId;
      const executedAt = new Date(); const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "contact", resultEntityId: resultContactId }; const finalDraft = await tx.jarvisActionDraft.update({ where: { id: current.id }, data: { state: "executed", executedAt, resultEntityType: "contact", resultEntityId: resultContactId, integrityTag: createIntegrityTag(executedData) } }); await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed", result: { id: resultContactId, entityType: "contact" } }); return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return toJarvisBulkUpdateDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") { const latest = await loadBoundBulkUpdateDraft(previewId, binding, now); if (latest.draft.state === "executed") return toJarvisBulkUpdateDraftView(latest.draft, binding); }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof ContactBulkCategoryServiceError) throw new JarvisActionDraftError(error.code === "stale_context" ? "stale_context" : error.code === "conflict" ? "conflict" : "invalid_input", error.message, error.code === "invalid_input" ? 400 : 409);
    throw new JarvisActionDraftError("execution_failed", "Die Massenänderung wurde nicht ausgeführt; alle Kontakte blieben unverändert.", 500);
  }
}

function mayManageProjectStatusAutomation(binding: JarvisTaskDraftBinding) {
  return canManageStatusRules(binding.profile.sessionActor) && canManageStatusRules(binding.profile.effectiveActor);
}

function validateAutomationManagementBinding(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  if (draft.organizationId !== binding.organizationId || draft.sessionId !== binding.sessionId || draft.sessionActorId !== actorIds.sessionActorId || draft.effectiveActorId !== actorIds.effectiveActorId || draft.impersonating !== binding.profile.isImpersonating) {
    throw new JarvisActionDraftError("scope_mismatch", "Diese Automationsänderung gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.", 403);
  }
  if (draft.sessionActorRole !== binding.profile.sessionActor.role || draft.effectiveActorRole !== binding.profile.effectiveActor.role) throw new JarvisActionDraftError("role_changed", "Die Rolle hat sich seit dem Automations-Dry-Run geändert. Bitte prüfe erneut.", 409);
  if (!integrityMatches(draft)) throw new JarvisActionDraftError("integrity_failed", "Der Integritätsnachweis der Automationsänderung ist ungültig.", 409);
  const payload = automationManagementPayloadSchema.safeParse(draft.payload);
  const context = automationManagementContextSchema.safeParse(draft.context);
  if (draft.actionId !== "automation.manage" || !payload.success || !context.success || hashJson(payload.data) !== draft.payloadHash || hashJson(context.data) !== draft.contextHash) throw new JarvisActionDraftError("integrity_failed", "Automationsänderung oder Dry-Run stimmen nicht mit dem Integritätsnachweis überein.", 409);
  return { payload: payload.data, context: context.data };
}

async function loadBoundAutomationManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) throw new JarvisActionDraftError("not_found", "Die Automationsänderung wurde nicht gefunden.", 404);
  validateAutomationManagementBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  return { draft: current, ...validateAutomationManagementBinding(current, binding) };
}

function toJarvisAutomationManagementDraftView(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding): JarvisAutomationManagementDraftView {
  const { payload, context } = validateAutomationManagementBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayManageProjectStatusAutomation(binding);
  const ready = state === "awaiting_confirmation" && permitted && context.blockingIssues.length === 0;
  const reason: JarvisAutomationManagementDraftView["confirmation"]["reason"] = state === "expired" ? "expired" : state === "cancelled" ? "cancelled" : state === "executed" ? "executed" : state === "executing" ? "executing" : !permitted ? "not_permitted" : context.blockingIssues.length ? "blocked" : "ready";
  return {
    version: 2, previewId: draft.id, actionId: "automation.manage", title: "Projektstatus-Automation kontrolliert ändern",
    badge: state === "executed" ? "Ausgeführt" : state === "executing" ? "Wird geändert" : state === "cancelled" ? "Abgebrochen" : state === "expired" ? "Abgelaufen" : ready ? "Bereit" : "Prüfung",
    state, revision: draft.revision, expiresAt: draft.expiresAt.toISOString(), operation: context.operation, currentEnabled: context.currentEnabled, targetEnabled: context.targetEnabled,
    ...(context.rule ? { rule: context.rule } : {}), currentImpact: context.currentImpact, targetImpact: context.targetImpact,
    monitoredProjects: context.monitoredProjects, responsibleNotices: context.responsibleNotices, managementNotices: context.managementNotices, missingResponsible: context.missingResponsible,
    fields: [
      { label: context.operation === "rule" ? "Projektstatus-Regel" : "Automation", value: context.rule?.status ?? "Projektstatus-Frühwarnung" },
      ...(context.rule ? [
        { label: "Aktuell", value: `${context.rule.before.enabled ? "Aktiv" : "Inaktiv"} · verantwortlich ${context.rule.before.responsibleAfterDays} T. · Geschäftsführung ${context.rule.before.managementAfterDays} T.` },
        { label: "Nach Ausführung", value: `${context.rule.after.enabled ? "Aktiv" : "Inaktiv"} · verantwortlich ${context.rule.after.responsibleAfterDays} T. · Geschäftsführung ${context.rule.after.managementAfterDays} T.` },
      ] : [
        { label: "Aktuell", value: context.currentEnabled ? "Aktiv" : "Inaktiv" },
        { label: "Nach Ausführung", value: context.targetEnabled ? "Aktiv" : "Inaktiv" },
      ]),
    ],
    items: context.items, checks: context.checks, warnings: context.warnings,
    blockingIssues: [...context.blockingIssues, ...(!permitted ? ["Diese Rollenkombination darf Automationen nicht konfigurieren."] : [])],
    confirmation: { enabled: ready, reason, requiredText: getProjectStatusAutomationConfirmationText(payload as ProjectStatusAutomationManagementRequest) },
    cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
    ...(state === "executed" ? { result: { entityType: "organization-setting" as const, entityId: `${draft.organizationId}:deadlines`, label: "Status-Automation öffnen" } } : {}),
  };
}

export async function createPersistedJarvisAutomationManagementDraft(input: { preview: JarvisActionPreview<"automation.manage">; organizationId: string; sessionId: string; profile: JarvisAccessProfile; users: readonly User[]; now?: Date }) {
  if (!input.sessionId) throw new JarvisActionDraftError("session_required", "Für eine Automationsänderung ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  if (!mayManageProjectStatusAutomation(input)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Automationen nicht konfigurieren.", 403);
  const now = input.now ?? new Date(); const payload = automationManagementPayloadSchema.parse(input.preview.payload); const actorIds = getActorIds(input.profile);
  const evaluation = await evaluateProjectStatusAutomationManagement({ organizationId: input.organizationId, users: input.users, request: payload });
  const context = automationManagementContextSchema.parse(evaluation); const state = context.blockingIssues.length ? "awaiting_input" : "awaiting_confirmation";
  const draftData: DraftIntegrityData = { id: input.preview.previewId, organizationId: input.organizationId, sessionId: input.sessionId, sessionActorId: actorIds.sessionActorId, sessionActorRole: input.profile.sessionActor.role, effectiveActorId: actorIds.effectiveActorId, effectiveActorRole: input.profile.effectiveActor.role, impersonating: input.profile.isImpersonating, actionId: "automation.manage", state, revision: 1, payloadHash: hashJson(payload), contextHash: hashJson(context), expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS), confirmedAt: null, cancelledAt: null, executedAt: null, resultEntityType: null, resultEntityId: null, lastErrorCode: context.blockingIssues.length ? "automation_validation" : null };
  const created = await prisma.$transaction(async (tx) => { const draft = await tx.jarvisActionDraft.create({ data: { ...draftData, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue, integrityTag: createIntegrityTag(draftData) } }); await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked", reasonCode: context.blockingIssues.length ? "automation_validation" : undefined }); return draft; });
  return toJarvisAutomationManagementDraftView(created, input);
}

export async function getJarvisAutomationManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) { const { draft } = await loadBoundAutomationManagementDraft(previewId, binding, now); return toJarvisAutomationManagementDraftView(draft, binding); }

export async function cancelJarvisAutomationManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()) {
  const { draft } = await loadBoundAutomationManagementDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisAutomationManagementDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Diese Automationsänderung kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Die Automationsänderung wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => { const changed = await tx.jarvisActionDraft.updateMany({ where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag }, data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) } }); if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Automationsänderung wurde bereits verändert.", 409); const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } }); await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" }); return current; });
  return toJarvisAutomationManagementDraftView(cancelled, binding);
}

export async function confirmJarvisAutomationManagementDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, confirmationText: string, now = new Date()) {
  const loaded = await loadBoundAutomationManagementDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisAutomationManagementDraftView(loaded.draft, binding);
  const requiredText = getProjectStatusAutomationConfirmationText(loaded.payload as ProjectStatusAutomationManagementRequest);
  if (confirmationText.trim() !== requiredText) throw new JarvisActionDraftError("invalid_input", `Gib zur Bestätigung exakt „${requiredText}“ ein.`, 400);
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") throw new JarvisActionDraftError("conflict", "Nur der aktuelle, vollständig geprüfte Automations-Dry-Run darf bestätigt werden.", 409);
  if (!mayManageProjectStatusAutomation(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Automationen nicht konfigurieren.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } }); if (!current) throw new JarvisActionDraftError("not_found", "Die Automationsänderung wurde nicht gefunden.", 404);
      const parsed = validateAutomationManagementBinding(current, binding); if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Die Automationsänderung ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      const actor = await tx.user.findFirst({ where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true }, select: { id: true, role: true } });
      if (!actor || !canManageStatusRules(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Automationsberechtigung sind nicht mehr aktuell.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null }; const claimed = await tx.jarvisActionDraft.updateMany({ where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag }, data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) } }); if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Automationsänderung wird bereits verarbeitet.", 409);
      await executeProjectStatusAutomationManagement({ tx, organizationId: binding.organizationId, actorId: actor.id, requestId: current.id, request: parsed.payload as ProjectStatusAutomationManagementRequest, expectedFingerprint: parsed.context.fingerprint });
      const resultId = `${binding.organizationId}:deadlines`; const executedAt = new Date(); const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "organization-setting", resultEntityId: resultId }; const finalDraft = await tx.jarvisActionDraft.update({ where: { id: current.id }, data: { state: "executed", executedAt, resultEntityType: "organization-setting", resultEntityId: resultId, integrityTag: createIntegrityTag(executedData) } }); await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed" }); return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return toJarvisAutomationManagementDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") { const latest = await loadBoundAutomationManagementDraft(previewId, binding, now); if (latest.draft.state === "executed") return toJarvisAutomationManagementDraftView(latest.draft, binding); }
    if (error instanceof JarvisActionDraftError) throw error;
    const automationErrorCode = error instanceof ProjectStatusAutomationManagementServiceError
      ? error.code
      : error && typeof error === "object" && "code" in error && ["invalid_input", "stale_context", "conflict"].includes(String(error.code))
        ? String(error.code) as "invalid_input" | "stale_context" | "conflict"
        : null;
    if (automationErrorCode) {
      throw new JarvisActionDraftError(
        automationErrorCode,
        error instanceof Error ? error.message : "Die Automationseinstellungen haben sich seit dem Dry-Run verändert.",
        automationErrorCode === "invalid_input" ? 400 : 409
      );
    }
    throw new JarvisActionDraftError("execution_failed", "Die Projektstatus-Automation wurde nicht geändert; alle Einstellungen blieben unverändert.", 500);
  }
}

function mayChangeProjectStatus(binding: JarvisTaskDraftBinding) {
  return canManageProjects(binding.profile.sessionActor) && canManageProjects(binding.profile.effectiveActor);
}

function validateProjectStatusBinding(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId || draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId || draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError("scope_mismatch", "Diese Projektstatusänderung gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.", 403);
  }
  if (draft.sessionActorRole !== binding.profile.sessionActor.role || draft.effectiveActorRole !== binding.profile.effectiveActor.role) {
    throw new JarvisActionDraftError("role_changed", "Die Rolle hat sich seit der Projektstatusprüfung geändert. Bitte erstelle eine neue Vorschau.", 409);
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError("integrity_failed", "Der Integritätsnachweis der Projektstatusänderung ist ungültig.", 409);
  }
  const payload = projectStatusPayloadSchema.safeParse(draft.payload);
  const context = projectStatusContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "project.status.change" || !payload.success || !context.success ||
    hashJson(payload.data) !== draft.payloadHash || hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError("integrity_failed", "Projektstatusänderung oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.", 409);
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundProjectStatusDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) throw new JarvisActionDraftError("not_found", "Die Projektstatusänderung wurde nicht gefunden.", 404);
  validateProjectStatusBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateProjectStatusBinding(current, binding);
  return { draft: current, ...parsed };
}

function toJarvisProjectStatusDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): JarvisProjectStatusDraftView {
  const { context } = validateProjectStatusBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayChangeProjectStatus(binding);
  const ready = state === "awaiting_confirmation" && permitted && context.blockingIssues.length === 0;
  const reason: JarvisProjectStatusDraftView["confirmation"]["reason"] =
    state === "expired" ? "expired" : state === "cancelled" ? "cancelled" :
    state === "executed" ? "executed" : state === "executing" ? "executing" :
    !permitted ? "not_permitted" : context.blockingIssues.length ? "blocked" : "ready";
  return {
    version: 2,
    previewId: draft.id,
    actionId: "project.status.change",
    title: "Projektstatus kontrolliert ändern",
    badge: state === "executed" ? "Ausgeführt" : state === "executing" ? "Wird geändert" :
      state === "cancelled" ? "Abgebrochen" : state === "expired" ? "Abgelaufen" : ready ? "Bereit" : "Prüfung",
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    projectId: context.project.id,
    targetStatus: context.targetStatus,
    fields: [
      { label: "Projekt", value: `${context.project.projectNumber} · ${context.project.title}` },
      { label: "Kunde", value: context.project.customer || "–" },
      { label: "Projektart", value: context.project.projectKind || "–" },
      { label: "Verantwortlich", value: context.project.responsibleName || "–" },
      { label: "Projektart", value: context.project.projectKind || "–" },
      { label: "Verantwortlich", value: context.project.responsibleName || "–" },
      { label: "Aktueller Status", value: context.project.currentStatus },
      { label: "Neuer Status", value: context.targetStatus },
      { label: "Grund", value: context.reason },
      { label: "Aktive Angebote", value: String(context.evidence.activeOffers) },
      { label: "Bestätigte Planungen", value: String(context.evidence.confirmedPlanningEntries) },
      { label: "Projektzeiten", value: String(context.evidence.projectTimeEntries) },
      { label: "Endkontrollen", value: String(context.evidence.finalInspections) },
      { label: "Abschlussrechnungen", value: String(context.evidence.activeFinalInvoices) },
      { label: "Offene Aufgaben", value: String(context.evidence.openTasks) },
    ],
    checks: context.checks,
    warnings: context.warnings,
    blockingIssues: [...context.blockingIssues, ...(!permitted ? ["Projektstatusänderungen sind für diese Rollenkombination nicht freigegeben."] : [])],
    confirmation: {
      enabled: ready,
      reason,
      requiredText: getProjectStatusConfirmationText(
        context.project.projectNumber,
        context.targetStatus as Parameters<typeof getProjectStatusConfirmationText>[1]
      ),
    },
    cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
    ...(state === "executed" && draft.resultEntityId ? {
      result: { entityType: "project" as const, entityId: draft.resultEntityId, label: "Geändertes Projekt öffnen" },
    } : {}),
  };
}

export async function createPersistedJarvisProjectStatusDraft(input: {
  preview: JarvisActionPreview<"project.status.change">;
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  now?: Date;
}) {
  if (!input.sessionId) throw new JarvisActionDraftError("session_required", "Für eine Projektstatusänderung ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  if (!mayChangeProjectStatus(input)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Projektstatus nicht ändern.", 403);
  const now = input.now ?? new Date();
  const payload = projectStatusPayloadSchema.parse(input.preview.payload);
  const evaluation = await evaluateProjectStatusChange({ organizationId: input.organizationId, ...payload });
  const context = projectStatusContextSchema.parse(evaluation);
  const actorIds = getActorIds(input.profile);
  const state = context.blockingIssues.length ? "awaiting_input" : "awaiting_confirmation";
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId, organizationId: input.organizationId, sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId, sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId, effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating, actionId: "project.status.change", state, revision: 1,
    payloadHash: hashJson(payload), contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS),
    confirmedAt: null, cancelledAt: null, executedAt: null, resultEntityType: null, resultEntityId: null,
    lastErrorCode: context.blockingIssues.length ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({ data: {
      ...draftData, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue,
      integrityTag: createIntegrityTag(draftData),
    } });
    await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked" });
    return draft;
  });
  return toJarvisProjectStatusDraftView(created, input);
}

export async function getJarvisProjectStatusDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const { draft } = await loadBoundProjectStatusDraft(previewId, binding, now);
  return toJarvisProjectStatusDraftView(draft, binding);
}

export async function cancelJarvisProjectStatusDraft(
  previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()
) {
  const { draft } = await loadBoundProjectStatusDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisProjectStatusDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Diese Projektstatusänderung kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Die Projektstatusänderung wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag },
      data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) },
    });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Projektstatusänderung wurde bereits verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" });
    return current;
  });
  return toJarvisProjectStatusDraftView(cancelled, binding);
}

export async function confirmJarvisProjectStatusDraft(
  previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number,
  confirmationText: string, now = new Date()
) {
  const loaded = await loadBoundProjectStatusDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisProjectStatusDraftView(loaded.draft, binding);
  const targetStatus = loaded.context.targetStatus as Parameters<typeof getProjectStatusConfirmationText>[1];
  const requiredText = getProjectStatusConfirmationText(loaded.context.project.projectNumber, targetStatus);
  if (!matchesProjectStatusConfirmation(loaded.context.project.projectNumber, targetStatus, confirmationText)) {
    throw new JarvisActionDraftError("invalid_input", `Gib zur kritischen Bestätigung exakt „${requiredText}“ ein.`, 400);
  }
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") {
    throw new JarvisActionDraftError("conflict", "Nur die aktuelle, vollständig geprüfte Projektstatusänderung darf bestätigt werden.", 409);
  }
  if (!mayChangeProjectStatus(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Projektstatus nicht ändern.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } });
      if (!current) throw new JarvisActionDraftError("not_found", "Die Projektstatusänderung wurde nicht gefunden.", 404);
      const parsed = validateProjectStatusBinding(current, binding);
      if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) {
        throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Die Projektstatusänderung ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      }
      const actor = await tx.user.findFirst({ where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true }, select: { id: true, role: true, firstName: true, lastName: true, email: true } });
      if (!actor || !canManageProjects(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Projektberechtigung sind nicht mehr aktuell.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null };
      const claimed = await tx.jarvisActionDraft.updateMany({
        where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag },
        data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) },
      });
      if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Der Projektstatus wird bereits geändert.", 409);
      const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
      const changed = await executeProjectStatusChange({
        tx, organizationId: binding.organizationId, projectId: parsed.payload.projectId,
        targetStatus: parsed.payload.targetStatus, reason: parsed.payload.reason,
        actorId: actor.id, actorName, requestId: current.id,
        expectedFingerprint: parsed.context.fingerprint, source: "jarvis",
      });
      const executedAt = new Date();
      const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "project", resultEntityId: changed.project.id };
      const finalDraft = await tx.jarvisActionDraft.update({ where: { id: current.id }, data: {
        state: "executed", executedAt, resultEntityType: "project", resultEntityId: changed.project.id, integrityTag: createIntegrityTag(executedData),
      } });
      await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed", result: { id: changed.project.id, entityType: "project" } });
      return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return toJarvisProjectStatusDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") {
      const latest = await loadBoundProjectStatusDraft(previewId, binding, now);
      if (latest.draft.state === "executed") return toJarvisProjectStatusDraftView(latest.draft, binding);
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof ProjectStatusServiceError) throw new JarvisActionDraftError(error.code === "stale_context" ? "stale_context" : "invalid_input", error.message, 409);
    throw new JarvisActionDraftError("execution_failed", "Der Projektstatus wurde nicht geändert und die Vorschau bleibt zur Prüfung erhalten.", 500);
  }
}

function mayChangeProjectLifecycle(binding: JarvisTaskDraftBinding) {
  return canArchiveProjects(binding.profile.sessionActor) && canArchiveProjects(binding.profile.effectiveActor);
}

function validateProjectLifecycleBinding(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  if (draft.organizationId !== binding.organizationId || draft.sessionId !== binding.sessionId ||
      draft.sessionActorId !== actorIds.sessionActorId || draft.effectiveActorId !== actorIds.effectiveActorId ||
      draft.impersonating !== binding.profile.isImpersonating) {
    throw new JarvisActionDraftError("scope_mismatch", "Diese Projektarchivierung gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.", 403);
  }
  if (draft.sessionActorRole !== binding.profile.sessionActor.role || draft.effectiveActorRole !== binding.profile.effectiveActor.role) {
    throw new JarvisActionDraftError("role_changed", "Die Rolle hat sich seit der Archivierungsprüfung geändert. Bitte erstelle eine neue Vorschau.", 409);
  }
  if (!integrityMatches(draft)) throw new JarvisActionDraftError("integrity_failed", "Der Integritätsnachweis der Projektarchivierung ist ungültig.", 409);
  const payload = projectLifecyclePayloadSchema.safeParse(draft.payload);
  const context = projectLifecycleContextSchema.safeParse(draft.context);
  if (draft.actionId !== "project.archive" || !payload.success || !context.success || hashJson(payload.data) !== draft.payloadHash || hashJson(context.data) !== draft.contextHash) {
    throw new JarvisActionDraftError("integrity_failed", "Projektarchivierung oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.", 409);
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundProjectLifecycleDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) throw new JarvisActionDraftError("not_found", "Die Projektarchivierung wurde nicht gefunden.", 404);
  validateProjectLifecycleBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  return { draft: current, ...validateProjectLifecycleBinding(current, binding) };
}

function toJarvisProjectLifecycleDraftView(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding): JarvisProjectLifecycleDraftView {
  const { context } = validateProjectLifecycleBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayChangeProjectLifecycle(binding);
  const ready = state === "awaiting_confirmation" && permitted && context.blockingIssues.length === 0;
  const reason: JarvisProjectLifecycleDraftView["confirmation"]["reason"] =
    state === "expired" ? "expired" : state === "cancelled" ? "cancelled" : state === "executed" ? "executed" :
    state === "executing" ? "executing" : !permitted ? "not_permitted" : context.blockingIssues.length ? "blocked" : "ready";
  const targetStatus = context.lifecycleAction === "archive" ? "Archiviert" : context.project.restoreStatus;
  return {
    version: 2, previewId: draft.id, actionId: "project.archive", title: "Projekt kontrolliert archivieren oder wiederherstellen",
    badge: state === "executed" ? "Ausgeführt" : state === "executing" ? "Wird geändert" : state === "cancelled" ? "Abgebrochen" : state === "expired" ? "Abgelaufen" : ready ? "Bereit" : "Prüfung",
    state, revision: draft.revision, expiresAt: draft.expiresAt.toISOString(), projectId: context.project.id,
    lifecycleAction: context.lifecycleAction, targetStatus,
    fields: [
      { label: "Projekt", value: `${context.project.projectNumber} · ${context.project.title}` },
      { label: "Kunde", value: context.project.customer || "–" },
      { label: "Aktion", value: context.lifecycleAction === "archive" ? "Archivieren" : "Wiederherstellen" },
      { label: "Aktueller Status", value: context.project.currentStatus },
      { label: "Zielstatus", value: targetStatus || "Nicht sicher belegt" },
      { label: "Grund", value: context.reason },
      { label: "Angebote", value: `${context.evidence.offers} (${context.evidence.activeOffers} aktiv)` },
      { label: "Rechnungen", value: `${context.evidence.invoices} (${context.evidence.unpaidInvoices} unbezahlt)` },
      { label: "Planungen", value: `${context.evidence.planningEntries} (${context.evidence.futureConfirmedPlanningEntries} zukünftig bestätigt)` },
      { label: "Projektzeiten", value: String(context.evidence.projectTimeEntries) },
      { label: "Laufende Stempelungen", value: String(context.evidence.runningStampSessions) },
      { label: "Offene Aufgaben", value: String(context.evidence.openTasks) },
      { label: "Dateien", value: String(context.evidence.storedFiles) },
      { label: "Online-Anfragen", value: String(context.evidence.onlineRequests) },
    ],
    checks: context.checks, warnings: context.warnings,
    blockingIssues: [...context.blockingIssues, ...(!permitted ? ["Projektarchivierungen sind für diese Rollenkombination nicht freigegeben."] : [])],
    confirmation: { enabled: ready, reason, requiredText: getProjectLifecycleConfirmationText(context.project.projectNumber, context.lifecycleAction) },
    cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
    ...(state === "executed" && draft.resultEntityId ? { result: { entityType: "project" as const, entityId: draft.resultEntityId, label: "Projekt öffnen" } } : {}),
  };
}

export async function createPersistedJarvisProjectLifecycleDraft(input: {
  preview: JarvisActionPreview<"project.archive">; organizationId: string; sessionId: string; profile: JarvisAccessProfile; now?: Date;
}) {
  if (!input.sessionId) throw new JarvisActionDraftError("session_required", "Für eine Projektarchivierung ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  if (!mayChangeProjectLifecycle(input)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Projekte nicht archivieren oder wiederherstellen.", 403);
  const now = input.now ?? new Date();
  const payload = projectLifecyclePayloadSchema.parse(input.preview.payload);
  const context = projectLifecycleContextSchema.parse(await evaluateProjectLifecycle({ organizationId: input.organizationId, ...payload }));
  const actorIds = getActorIds(input.profile);
  const state = context.blockingIssues.length ? "awaiting_input" : "awaiting_confirmation";
  const draftData: DraftIntegrityData = { id: input.preview.previewId, organizationId: input.organizationId, sessionId: input.sessionId, sessionActorId: actorIds.sessionActorId, sessionActorRole: input.profile.sessionActor.role, effectiveActorId: actorIds.effectiveActorId, effectiveActorRole: input.profile.effectiveActor.role, impersonating: input.profile.isImpersonating, actionId: "project.archive", state, revision: 1, payloadHash: hashJson(payload), contextHash: hashJson(context), expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS), confirmedAt: null, cancelledAt: null, executedAt: null, resultEntityType: null, resultEntityId: null, lastErrorCode: context.blockingIssues.length ? "invalid_input" : null };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({ data: { ...draftData, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue, integrityTag: createIntegrityTag(draftData) } });
    await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked" });
    return draft;
  });
  return toJarvisProjectLifecycleDraftView(created, input);
}

export async function getJarvisProjectLifecycleDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const { draft } = await loadBoundProjectLifecycleDraft(previewId, binding, now);
  return toJarvisProjectLifecycleDraftView(draft, binding);
}

export async function cancelJarvisProjectLifecycleDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()) {
  const { draft } = await loadBoundProjectLifecycleDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisProjectLifecycleDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Diese Projektarchivierung kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Die Projektarchivierung wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({ where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag }, data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) } });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Projektarchivierung wurde bereits verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" });
    return current;
  });
  return toJarvisProjectLifecycleDraftView(cancelled, binding);
}

export async function confirmJarvisProjectLifecycleDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, confirmationText: string, now = new Date()) {
  const loaded = await loadBoundProjectLifecycleDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisProjectLifecycleDraftView(loaded.draft, binding);
  const requiredText = getProjectLifecycleConfirmationText(loaded.context.project.projectNumber, loaded.context.lifecycleAction);
  if (!matchesProjectLifecycleConfirmation(loaded.context.project.projectNumber, loaded.context.lifecycleAction, confirmationText)) throw new JarvisActionDraftError("invalid_input", `Gib zur kritischen Bestätigung exakt „${requiredText}“ ein.`, 400);
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") throw new JarvisActionDraftError("conflict", "Nur die aktuelle, vollständig geprüfte Projektarchivierung darf bestätigt werden.", 409);
  if (!mayChangeProjectLifecycle(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Projekte nicht archivieren oder wiederherstellen.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } });
      if (!current) throw new JarvisActionDraftError("not_found", "Die Projektarchivierung wurde nicht gefunden.", 404);
      const parsed = validateProjectLifecycleBinding(current, binding);
      if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Die Projektarchivierung ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      const actor = await tx.user.findFirst({ where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true }, select: { id: true, role: true, firstName: true, lastName: true, email: true } });
      if (!actor || !canArchiveProjects(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Archivierungsberechtigung sind nicht mehr aktuell.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null };
      const claimed = await tx.jarvisActionDraft.updateMany({ where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag }, data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) } });
      if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Das Projekt wird bereits verarbeitet.", 409);
      const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
      const changed = await executeProjectLifecycle({ tx, organizationId: binding.organizationId, projectId: parsed.payload.projectId, lifecycleAction: parsed.payload.lifecycleAction, reason: parsed.payload.reason, actorId: actor.id, actorName, requestId: current.id, expectedFingerprint: parsed.context.fingerprint, source: "jarvis" });
      const executedAt = new Date();
      const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "project", resultEntityId: changed.project.id };
      const finalDraft = await tx.jarvisActionDraft.update({ where: { id: current.id }, data: { state: "executed", executedAt, resultEntityType: "project", resultEntityId: changed.project.id, integrityTag: createIntegrityTag(executedData) } });
      await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed", result: { id: changed.project.id, entityType: "project" } });
      return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return toJarvisProjectLifecycleDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") {
      const latest = await loadBoundProjectLifecycleDraft(previewId, binding, now);
      if (latest.draft.state === "executed") return toJarvisProjectLifecycleDraftView(latest.draft, binding);
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof ProjectLifecycleServiceError) throw new JarvisActionDraftError(error.code === "stale_context" ? "stale_context" : "invalid_input", error.message, 409);
    throw new JarvisActionDraftError("execution_failed", "Das Projekt wurde nicht archiviert oder wiederhergestellt und die Vorschau bleibt zur Prüfung erhalten.", 500);
  }
}

function mayConvertOnlineRequest(binding: JarvisTaskDraftBinding) {
  return (
    canConvertOnlineRequests(binding.profile.sessionActor) &&
    canConvertOnlineRequests(binding.profile.effectiveActor)
  );
}

function validateOnlineRequestConversionBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Online-Anfragen-Umwandlung gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.",
      403
    );
  }
  if (
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role
  ) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Die Rolle hat sich seit der Übernahmeprüfung geändert. Bitte erstelle eine neue Vorschau.",
      409
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Integritätsnachweis der Online-Anfragen-Umwandlung ist ungültig.",
      409
    );
  }
  const payload = onlineRequestConversionPayloadSchema.safeParse(draft.payload);
  const context = onlineRequestConversionContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "online-request.convert" ||
    !payload.success ||
    !context.success ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Online-Anfrage oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.",
      409
    );
  }
  return { payload: payload.data, context: context.data };
}

async function reconcileOnlineRequestConversionDraft(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  if (draft.state !== "executing") return draft;
  const { context } = validateOnlineRequestConversionBinding(draft, binding);
  const [request, audit] = await Promise.all([
    prisma.onlineRequest.findFirst({
      where: {
        id: context.request.id,
        organizationId: binding.organizationId,
      },
      select: { convertedProjectId: true },
    }),
    prisma.onlineRequestAuditEvent.findFirst({
      where: {
        organizationId: binding.organizationId,
        onlineRequestId: context.request.id,
        eventType: "converted",
      },
      orderBy: { createdAt: "desc" },
      select: { payload: true },
    }),
  ]);
  const auditPayload =
    audit?.payload && typeof audit.payload === "object" && !Array.isArray(audit.payload)
      ? audit.payload
      : null;
  if (
    !request?.convertedProjectId ||
    auditPayload?.executionRequestId !== draft.id
  ) {
    return draft;
  }
  const convertedProjectId = request.convertedProjectId;
  return prisma.$transaction(async (tx) => {
    const current = await tx.jarvisActionDraft.findUnique({ where: { id: draft.id } });
    if (!current || current.state === "executed") return current ?? draft;
    if (current.state !== "executing") return current;
    const executedAt = new Date();
    const executedData: DraftIntegrityData = {
      ...current,
      state: "executed",
      executedAt,
      resultEntityType: "project",
      resultEntityId: convertedProjectId,
      lastErrorCode: null,
    };
    const executed = await tx.jarvisActionDraft.update({
      where: { id: current.id },
      data: {
        state: "executed",
        executedAt,
        resultEntityType: "project",
        resultEntityId: convertedProjectId,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(executedData),
      },
    });
    await appendAuditEvent(tx, {
      draft: executed,
      eventType: "draft_execution_reconciled",
      result: { id: convertedProjectId, entityType: "project" },
    });
    return executed;
  });
}

async function loadBoundOnlineRequestConversionDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) {
    throw new JarvisActionDraftError(
      "not_found",
      "Die Online-Anfragen-Umwandlung wurde nicht gefunden.",
      404
    );
  }
  validateOnlineRequestConversionBinding(found, binding);
  const reconciled = await reconcileOnlineRequestConversionDraft(found, binding);
  const current = await expireDraftIfNeeded(reconciled, now);
  return {
    draft: current,
    ...validateOnlineRequestConversionBinding(current, binding),
  };
}

function toJarvisOnlineRequestConversionDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): JarvisOnlineRequestConversionDraftView {
  const { context } = validateOnlineRequestConversionBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayConvertOnlineRequest(binding);
  const ready =
    state === "awaiting_confirmation" &&
    permitted &&
    context.blockingIssues.length === 0;
  const reason: JarvisOnlineRequestConversionDraftView["confirmation"]["reason"] =
    state === "expired"
      ? "expired"
      : state === "cancelled"
        ? "cancelled"
        : state === "executed"
          ? "executed"
          : state === "executing"
            ? "executing"
            : !permitted
              ? "not_permitted"
              : context.blockingIssues.length
                ? "blocked"
                : "ready";
  const customerPath =
    context.request.customerDecision === "new"
      ? "Neuen Kontakt anlegen"
      : context.contact
        ? `${context.contact.customerNumber} · ${context.contact.name}`
        : "Nicht eindeutig";
  return {
    version: 2,
    previewId: draft.id,
    actionId: "online-request.convert",
    title: "Online-Anfrage kontrolliert umwandeln",
    badge:
      state === "executed"
        ? "Ausgeführt"
        : state === "executing"
          ? "Wird geändert"
          : state === "cancelled"
            ? "Abgebrochen"
            : state === "expired"
              ? "Abgelaufen"
              : ready
                ? "Bereit"
                : "Prüfung",
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    requestId: context.request.id,
    referenceNumber: context.request.referenceNumber,
    taskTitles: context.tasks.map((task) => task.title),
    fields: [
      { label: "Online-Anfrage", value: context.request.referenceNumber },
      { label: "Anfragender", value: context.request.customerName },
      { label: "Gewerk", value: context.request.tradeName },
      { label: "Kundenweg", value: customerPath },
      { label: "Verantwortung", value: context.responsibility.name },
      { label: "Projektziel", value: "OK immocare · Lead / Klärung" },
      { label: "Projektnummer", value: `${context.projectPrefix}-<nächste globale Nummer>` },
      { label: "Folgeaufgaben", value: String(context.tasks.length) },
      { label: "Anfragebilder", value: String(context.request.photoCount) },
    ],
    checks: [
      {
        key: "customer-path",
        label: "Kundenprüfung",
        status: context.blockingIssues.length ? "blocked" : "ok",
        detail: customerPath,
      },
      {
        key: "new-project-only",
        label: "Projektzuordnung",
        status: "ok",
        detail:
          "Es entsteht immer ein neues Projekt; kein Bestandsprojekt wird automatisch verwendet.",
      },
      {
        key: "responsibility",
        label: "Verantwortung",
        status: context.responsibility.fallback ? "warning" : "ok",
        detail: context.responsibility.name,
      },
    ],
    warnings: context.warnings,
    blockingIssues: [
      ...context.blockingIssues,
      ...(!permitted
        ? ["Online-Anfragen-Umwandlungen sind für diese Rollenkombination nicht freigegeben."]
        : []),
    ],
    confirmation: {
      enabled: ready,
      reason,
      requiredText: getOnlineRequestConversionConfirmationText(
        context.request.referenceNumber
      ),
    },
    cancellation: {
      enabled: state === "awaiting_input" || state === "awaiting_confirmation",
    },
    ...(state === "executed" && draft.resultEntityId
      ? {
          result: {
            entityType: "project" as const,
            entityId: draft.resultEntityId,
            label: "Neues Projekt öffnen",
          },
        }
      : {}),
  };
}

export async function createPersistedJarvisOnlineRequestConversionDraft(input: {
  preview: JarvisActionPreview<"online-request.convert">;
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  now?: Date;
}) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für die Umwandlung ist eine aktuelle serverseitige Sitzung erforderlich.",
      401
    );
  }
  if (!mayConvertOnlineRequest(input)) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Rollenkombination darf Online-Anfragen nicht umwandeln.",
      403
    );
  }
  const payload = onlineRequestConversionPayloadSchema.parse(input.preview.payload);
  const actorIds = getActorIds(input.profile);
  const [actor, users] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: actorIds.effectiveActorId,
        organizationId: input.organizationId,
        isActive: true,
      },
    }),
    prisma.user.findMany({ where: { organizationId: input.organizationId } }),
  ]);
  if (!actor || !canConvertOnlineRequests(actor)) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Akteur oder Umwandlungsberechtigung sind nicht mehr aktuell.",
      409
    );
  }
  const context = onlineRequestConversionContextSchema.parse(
    await evaluateOnlineRequestConversion({
      organizationId: input.organizationId,
      requestId: payload.requestId,
      actor,
      users,
    })
  );
  const now = input.now ?? new Date();
  const state = context.blockingIssues.length
    ? "awaiting_input"
    : "awaiting_confirmation";
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId,
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId: "online-request.convert",
    state,
    revision: 1,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS),
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode: context.blockingIssues.length ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag: createIntegrityTag(draftData),
      },
    });
    await appendAuditEvent(tx, {
      draft,
      eventType:
        state === "awaiting_confirmation"
          ? "draft_created_ready"
          : "draft_created_blocked",
    });
    return draft;
  });
  return toJarvisOnlineRequestConversionDraftView(created, input);
}

export async function getJarvisOnlineRequestConversionDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundOnlineRequestConversionDraft(
    previewId,
    binding,
    now
  );
  return toJarvisOnlineRequestConversionDraftView(draft, binding);
}

export async function cancelJarvisOnlineRequestConversionDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const { draft } = await loadBoundOnlineRequestConversionDraft(
    previewId,
    binding,
    now
  );
  if (draft.state === "cancelled") {
    return toJarvisOnlineRequestConversionDraftView(draft, binding);
  }
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) {
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "invalid_state",
      "Diese Online-Anfragen-Umwandlung kann nicht mehr abgebrochen werden.",
      draft.state === "expired" ? 410 : 409
    );
  }
  if (expectedRevision !== draft.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Die Umwandlung wurde zwischenzeitlich verändert.",
      409
    );
  }
  const nextData: DraftIntegrityData = {
    ...draft,
    state: "cancelled",
    cancelledAt: now,
    lastErrorCode: null,
  };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "cancelled",
        cancelledAt: now,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Die Umwandlung wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_cancelled",
      reasonCode: "user_cancelled",
    });
    return current;
  });
  return toJarvisOnlineRequestConversionDraftView(cancelled, binding);
}

async function markOnlineRequestConversionExecutionFailed(
  draftId: string,
  reasonCode: string,
  now = new Date()
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.jarvisActionDraft.findUnique({
      where: { id: draftId },
    });
    if (!current || current.state !== "executing") return current;
    const cancelledData: DraftIntegrityData = {
      ...current,
      state: "cancelled",
      cancelledAt: now,
      lastErrorCode: reasonCode,
    };
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: current.id,
        state: "executing",
        integrityTag: current.integrityTag,
      },
      data: {
        state: "cancelled",
        cancelledAt: now,
        lastErrorCode: reasonCode,
        integrityTag: createIntegrityTag(cancelledData),
      },
    });
    if (changed.count !== 1) return current;
    const cancelled = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: current.id },
    });
    await appendAuditEvent(tx, {
      draft: cancelled,
      eventType: "draft_execution_failed",
      reasonCode,
    });
    return cancelled;
  });
}

export async function confirmJarvisOnlineRequestConversionDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  confirmationText: string,
  now = new Date()
) {
  const loaded = await loadBoundOnlineRequestConversionDraft(
    previewId,
    binding,
    now
  );
  if (loaded.draft.state === "executed") {
    return toJarvisOnlineRequestConversionDraftView(loaded.draft, binding);
  }
  const requiredText = getOnlineRequestConversionConfirmationText(
    loaded.context.request.referenceNumber
  );
  if (
    !matchesOnlineRequestConversionConfirmation(
      loaded.context.request.referenceNumber,
      confirmationText
    )
  ) {
    throw new JarvisActionDraftError(
      "invalid_input",
      `Gib zur kritischen Bestätigung exakt „${requiredText}“ ein.`,
      400
    );
  }
  if (
    expectedRevision !== loaded.draft.revision ||
    loaded.draft.state !== "awaiting_confirmation"
  ) {
    throw new JarvisActionDraftError(
      "conflict",
      "Nur die aktuelle, vollständig geprüfte Umwandlung darf bestätigt werden.",
      409
    );
  }
  if (!mayConvertOnlineRequest(binding)) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Rollenkombination darf Online-Anfragen nicht umwandeln.",
      403
    );
  }

  let claimed: JarvisActionDraft | undefined;
  try {
    claimed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({
        where: { id: loaded.draft.id },
      });
      if (!current) {
        throw new JarvisActionDraftError(
          "not_found",
          "Die Umwandlung wurde nicht gefunden.",
          404
        );
      }
      validateOnlineRequestConversionBinding(current, binding);
      if (
        current.state !== "awaiting_confirmation" ||
        current.expiresAt.getTime() <= now.getTime()
      ) {
        throw new JarvisActionDraftError(
          current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict",
          "Die Umwandlung ist nicht mehr ausführbar.",
          current.expiresAt.getTime() <= now.getTime() ? 410 : 409
        );
      }
      const claimedData: DraftIntegrityData = {
        ...current,
        state: "executing",
        confirmedAt: now,
        lastErrorCode: null,
      };
      const changed = await tx.jarvisActionDraft.updateMany({
        where: {
          id: current.id,
          revision: current.revision,
          state: "awaiting_confirmation",
          integrityTag: current.integrityTag,
        },
        data: {
          state: "executing",
          confirmedAt: now,
          lastErrorCode: null,
          integrityTag: createIntegrityTag(claimedData),
        },
      });
      if (changed.count !== 1) {
        throw new JarvisActionDraftError(
          "conflict",
          "Die Online-Anfrage wird bereits verarbeitet.",
          409
        );
      }
      const next = await tx.jarvisActionDraft.findUniqueOrThrow({
        where: { id: current.id },
      });
      await appendAuditEvent(tx, {
        draft: next,
        eventType: "draft_execution_started",
      });
      return next;
    });
    const claimedDraft = claimed;

    const [actor, users] = await Promise.all([
      prisma.user.findFirst({
        where: {
          id: claimedDraft.effectiveActorId,
          organizationId: binding.organizationId,
          isActive: true,
        },
      }),
      prisma.user.findMany({ where: { organizationId: binding.organizationId } }),
    ]);
    if (!actor || !canConvertOnlineRequests(actor)) {
      throw new JarvisActionDraftError(
        "role_changed",
        "Akteur oder Umwandlungsberechtigung sind nicht mehr aktuell.",
        409
      );
    }
    const result = await convertOnlineRequest({
      organizationId: binding.organizationId,
      requestId: loaded.context.request.id,
      actor,
      users,
      expectedFingerprint: loaded.context.fingerprint,
      executionRequestId: claimedDraft.id,
      source: "jarvis",
    });
    if (result.duplicate && !result.executionRequestMatched) {
      throw new JarvisActionDraftError(
        "stale_context",
        "Die Online-Anfrage wurde außerhalb dieses JARVIS-Entwurfs umgewandelt.",
        409
      );
    }
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUniqueOrThrow({
        where: { id: claimedDraft.id },
      });
      if (current.state === "executed") return current;
      if (current.state !== "executing") {
        throw new JarvisActionDraftError(
          "conflict",
          "Der Ausführungszustand der Umwandlung ist nicht mehr aktuell.",
          409
        );
      }
      const executedAt = new Date();
      const executedData: DraftIntegrityData = {
        ...current,
        state: "executed",
        executedAt,
        resultEntityType: "project",
        resultEntityId: result.projectId,
        lastErrorCode: null,
      };
      const finalDraft = await tx.jarvisActionDraft.update({
        where: { id: current.id },
        data: {
          state: "executed",
          executedAt,
          resultEntityType: "project",
          resultEntityId: result.projectId,
          lastErrorCode: null,
          integrityTag: createIntegrityTag(executedData),
        },
      });
      await appendAuditEvent(tx, {
        draft: finalDraft,
        eventType: "draft_confirmed_and_executed",
        result: { id: result.projectId, entityType: "project" },
      });
      return finalDraft;
    });
    return toJarvisOnlineRequestConversionDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") {
      const latest = await loadBoundOnlineRequestConversionDraft(
        previewId,
        binding,
        now
      );
      if (latest.draft.state === "executed") {
        return toJarvisOnlineRequestConversionDraftView(latest.draft, binding);
      }
    }
    if (error instanceof JarvisActionDraftError) {
      if (claimed && error.code !== "conflict") {
        await markOnlineRequestConversionExecutionFailed(
          claimed.id,
          error.code,
          now
        );
      }
      throw error;
    }
    if (error instanceof OnlineRequestConversionError) {
      const status =
        error.status === 400 ||
        error.status === 401 ||
        error.status === 403 ||
        error.status === 404 ||
        error.status === 409 ||
        error.status === 410 ||
        error.status === 500
          ? error.status
          : 409;
      if (claimed) {
        await markOnlineRequestConversionExecutionFailed(
          claimed.id,
          error.code,
          now
        );
      }
      throw new JarvisActionDraftError(
        error.code === "stale_context" ? "stale_context" : "invalid_input",
        error.message,
        status
      );
    }
    if (claimed) {
      const latest = await loadBoundOnlineRequestConversionDraft(
        previewId,
        binding,
        now
      );
      if (latest.draft.state === "executed") {
        return toJarvisOnlineRequestConversionDraftView(latest.draft, binding);
      }
      await markOnlineRequestConversionExecutionFailed(
        claimed.id,
        "execution_failed",
        now
      );
    }
    throw new JarvisActionDraftError(
      "execution_failed",
      "Die Online-Anfrage wurde nicht umgewandelt. Der Ausführungsnachweis bleibt zur sicheren Prüfung erhalten.",
      500
    );
  }
}

function mayChangeInvoiceLifecycle(binding: JarvisTaskDraftBinding) {
  return canDeleteInvoices(binding.profile.sessionActor) && canDeleteInvoices(binding.profile.effectiveActor);
}

function validateInvoiceLifecycleBinding(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId || draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId || draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError("scope_mismatch", "Diese Rechnungsänderung gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.", 403);
  }
  if (draft.sessionActorRole !== binding.profile.sessionActor.role || draft.effectiveActorRole !== binding.profile.effectiveActor.role) {
    throw new JarvisActionDraftError("role_changed", "Die Rolle hat sich seit der Rechnungsprüfung geändert. Bitte erstelle eine neue Vorschau.", 409);
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError("integrity_failed", "Der Integritätsnachweis der Rechnungsänderung ist ungültig.", 409);
  }
  const payload = invoiceLifecyclePayloadSchema.safeParse(draft.payload);
  const context = invoiceLifecycleContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "invoice.delete" || !payload.success || !context.success ||
    hashJson(payload.data) !== draft.payloadHash || hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError("integrity_failed", "Rechnungsänderung oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.", 409);
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundInvoiceLifecycleDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) throw new JarvisActionDraftError("not_found", "Die Rechnungsänderung wurde nicht gefunden.", 404);
  validateInvoiceLifecycleBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateInvoiceLifecycleBinding(current, binding);
  return { draft: current, ...parsed };
}

function toJarvisInvoiceLifecycleDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): JarvisInvoiceLifecycleDraftView {
  const { context } = validateInvoiceLifecycleBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayChangeInvoiceLifecycle(binding);
  const ready = state === "awaiting_confirmation" && permitted && context.blockingIssues.length === 0;
  const reason: JarvisInvoiceLifecycleDraftView["confirmation"]["reason"] =
    state === "expired" ? "expired" : state === "cancelled" ? "cancelled" :
    state === "executed" ? "executed" : state === "executing" ? "executing" :
    !permitted ? "not_permitted" : context.blockingIssues.length ? "blocked" : "ready";
  const currency = (value: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
  return {
    version: 2,
    previewId: draft.id,
    actionId: "invoice.delete",
    title: "Rechnungsentwurf kontrolliert löschen oder wiederherstellen",
    badge: state === "executed" ? "Ausgeführt" : state === "executing" ? "Wird geändert" :
      state === "cancelled" ? "Abgebrochen" : state === "expired" ? "Abgelaufen" : ready ? "Bereit" : "Prüfung",
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    invoiceId: context.invoice.id,
    projectId: context.invoice.projectId,
    lifecycleAction: context.action,
    fields: [
      { label: "Aktion", value: context.action === "delete" ? "Löschen" : "Wiederherstellen" },
      { label: "Rechnung", value: context.invoice.invoiceNumber },
      { label: "Projekt", value: `${context.invoice.projectNumber} · ${context.invoice.projectTitle}` },
      { label: "Kunde", value: context.invoice.customerName || "–" },
      { label: "Aktueller Status", value: context.invoice.status },
      ...(context.action === "restore" ? [{ label: "Wiederhergestellter Status", value: context.previousStatus || "Manuelle Prüfung" }] : []),
      { label: "Netto", value: currency(context.invoice.netTotal) },
      { label: "Brutto", value: currency(context.invoice.grossTotal) },
      { label: "Grund", value: context.reason },
      { label: "Verknüpfte Stempelungen", value: String(context.linkedTimeEntries) },
      { label: "Lagerbewegungen", value: String(context.inventoryMovements) },
      { label: "Versandprotokolle", value: String(context.deliveryDispatches) },
    ],
    checks: context.checks,
    warnings: context.warnings,
    blockingIssues: [...context.blockingIssues, ...(!permitted ? ["Löschen und Wiederherstellen von Rechnungsentwürfen sind für diese Rollenkombination nicht freigegeben."] : [])],
    confirmation: {
      enabled: ready,
      reason,
      requiredText: getInvoiceLifecycleConfirmationText(context.invoice.invoiceNumber, context.action),
    },
    cancellation: { enabled: state === "awaiting_input" || state === "awaiting_confirmation" },
    ...(state === "executed" && draft.resultEntityId ? {
      result: { entityType: "invoice" as const, entityId: draft.resultEntityId, label: "Geänderten Rechnungsentwurf öffnen" },
    } : {}),
  };
}

export async function createPersistedJarvisInvoiceLifecycleDraft(input: {
  preview: JarvisActionPreview<"invoice.delete">;
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  now?: Date;
}) {
  if (!input.sessionId) throw new JarvisActionDraftError("session_required", "Für Löschen oder Wiederherstellen ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  if (!mayChangeInvoiceLifecycle(input)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Rechnungsentwürfe nicht löschen oder wiederherstellen.", 403);
  const now = input.now ?? new Date();
  const payload = invoiceLifecyclePayloadSchema.parse(input.preview.payload);
  const evaluation = await evaluateInvoiceLifecycle({ organizationId: input.organizationId, ...payload });
  const context = invoiceLifecycleContextSchema.parse(evaluation);
  const actorIds = getActorIds(input.profile);
  const state = context.blockingIssues.length ? "awaiting_input" : "awaiting_confirmation";
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId, organizationId: input.organizationId, sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId, sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId, effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating, actionId: "invoice.delete", state, revision: 1,
    payloadHash: hashJson(payload), contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS),
    confirmedAt: null, cancelledAt: null, executedAt: null, resultEntityType: null, resultEntityId: null,
    lastErrorCode: context.blockingIssues.length ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({ data: {
      ...draftData, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue,
      integrityTag: createIntegrityTag(draftData),
    } });
    await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked" });
    return draft;
  });
  return toJarvisInvoiceLifecycleDraftView(created, input);
}

export async function getJarvisInvoiceLifecycleDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const { draft } = await loadBoundInvoiceLifecycleDraft(previewId, binding, now);
  return toJarvisInvoiceLifecycleDraftView(draft, binding);
}

export async function cancelJarvisInvoiceLifecycleDraft(
  previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()
) {
  const { draft } = await loadBoundInvoiceLifecycleDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisInvoiceLifecycleDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Diese Rechnungsänderung kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Die Rechnungsänderung wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag },
      data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) },
    });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Rechnungsänderung wurde bereits verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" });
    return current;
  });
  return toJarvisInvoiceLifecycleDraftView(cancelled, binding);
}

export async function confirmJarvisInvoiceLifecycleDraft(
  previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number,
  confirmationText: string, now = new Date()
) {
  const loaded = await loadBoundInvoiceLifecycleDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisInvoiceLifecycleDraftView(loaded.draft, binding);
  const requiredText = getInvoiceLifecycleConfirmationText(loaded.context.invoice.invoiceNumber, loaded.context.action);
  if (!matchesInvoiceLifecycleConfirmation(loaded.context.invoice.invoiceNumber, loaded.context.action, confirmationText)) {
    throw new JarvisActionDraftError("invalid_input", `Gib zur kritischen Bestätigung exakt „${requiredText}“ ein.`, 400);
  }
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") {
    throw new JarvisActionDraftError("conflict", "Nur die aktuelle, vollständig geprüfte Rechnungsänderung darf bestätigt werden.", 409);
  }
  if (!mayChangeInvoiceLifecycle(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf Rechnungsentwürfe nicht löschen oder wiederherstellen.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } });
      if (!current) throw new JarvisActionDraftError("not_found", "Die Rechnungsänderung wurde nicht gefunden.", 404);
      const parsed = validateInvoiceLifecycleBinding(current, binding);
      if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) {
        throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Die Rechnungsänderung ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      }
      const actor = await tx.user.findFirst({ where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true }, select: { id: true, role: true, firstName: true, lastName: true, email: true } });
      if (!actor || !canDeleteInvoices(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Löschberechtigung sind nicht mehr aktuell.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null };
      const claimed = await tx.jarvisActionDraft.updateMany({
        where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag },
        data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) },
      });
      if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Rechnung wird bereits geändert.", 409);
      const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
      const invoice = await executeInvoiceLifecycle({
        tx, organizationId: binding.organizationId, invoiceId: parsed.payload.invoiceId,
        action: parsed.payload.action, reason: parsed.payload.reason,
        actorId: actor.id, actorName, expectedFingerprint: parsed.context.fingerprint, source: "jarvis",
      });
      const executedAt = new Date();
      const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "invoice", resultEntityId: invoice.id };
      const finalDraft = await tx.jarvisActionDraft.update({ where: { id: current.id }, data: {
        state: "executed", executedAt, resultEntityType: "invoice", resultEntityId: invoice.id, integrityTag: createIntegrityTag(executedData),
      } });
      await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed", result: { id: invoice.id, entityType: "invoice" } });
      return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return toJarvisInvoiceLifecycleDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") {
      const latest = await loadBoundInvoiceLifecycleDraft(previewId, binding, now);
      if (latest.draft.state === "executed") return toJarvisInvoiceLifecycleDraftView(latest.draft, binding);
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof InvoiceLifecycleServiceError) throw new JarvisActionDraftError(error.code === "stale_context" ? "stale_context" : "invalid_input", error.message, 409);
    throw new JarvisActionDraftError("execution_failed", "Die Rechnung wurde nicht geändert und die Vorschau bleibt zur Prüfung erhalten.", 500);
  }
}

function mayFinalizeInvoice(binding: JarvisTaskDraftBinding) {
  return (
    canManageInvoices(binding.profile.sessionActor) &&
    canManageInvoices(binding.profile.effectiveActor)
  );
}

function validateInvoiceFinalizationBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Fakturavorschau gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.",
      403
    );
  }
  if (
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role
  ) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Die Rolle hat sich seit der Fakturavorprüfung geändert. Bitte erstelle eine neue Vorschau.",
      409
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Integritätsnachweis der Fakturavorschau ist ungültig.",
      409
    );
  }
  const payload = invoiceFinalizationPayloadSchema.safeParse(draft.payload);
  const context = invoiceFinalizationContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "invoice.finalize" ||
    !payload.success ||
    !context.success ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Fakturavorschau oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.",
      409
    );
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundInvoiceFinalizationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({
    where: { id: previewId },
  });
  if (!found) {
    throw new JarvisActionDraftError(
      "not_found",
      "Die Fakturavorschau wurde nicht gefunden.",
      404
    );
  }
  validateInvoiceFinalizationBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateInvoiceFinalizationBinding(current, binding);
  return { draft: current, ...parsed };
}

function toJarvisInvoiceFinalizationDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): JarvisInvoiceFinalizationDraftView {
  const { context } = validateInvoiceFinalizationBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayFinalizeInvoice(binding);
  const ready =
    state === "awaiting_confirmation" &&
    permitted &&
    context.blockingIssues.length === 0;
  const reason: JarvisInvoiceFinalizationDraftView["confirmation"]["reason"] =
    state === "expired"
      ? "expired"
      : state === "cancelled"
        ? "cancelled"
        : state === "executed"
          ? "executed"
          : state === "executing"
            ? "executing"
            : !permitted
              ? "not_permitted"
              : context.blockingIssues.length
                ? "blocked"
                : "ready";
  const currency = (value: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  return {
    version: 2,
    previewId: draft.id,
    actionId: "invoice.finalize",
    title: "Rechnung kontrolliert fakturieren",
    badge:
      state === "executed"
        ? "Fakturiert"
        : state === "executing"
          ? "Wird fakturiert"
          : state === "cancelled"
            ? "Abgebrochen"
            : state === "expired"
              ? "Abgelaufen"
              : ready
                ? "Bereit"
                : "Prüfung",
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    invoiceId: context.invoice.id,
    projectId: context.invoice.projectId,
    fields: [
      { label: "Rechnung", value: context.invoice.invoiceNumber },
      {
        label: "Projekt",
        value: `${context.invoice.projectNumber} · ${context.invoice.projectTitle}`,
      },
      { label: "Kunde", value: context.invoice.customerName || "–" },
      { label: "Leistungsdatum", value: context.invoice.serviceDate || "–" },
      { label: "Netto", value: currency(context.invoice.netTotal) },
      { label: "Brutto", value: currency(context.invoice.grossTotal) },
    ],
    preflight: context.preflight,
    warnings: context.warnings,
    blockingIssues: [
      ...context.blockingIssues,
      ...(!permitted
        ? ["Fakturierung ist für diese Rollenkombination nicht freigegeben."]
        : []),
    ],
    confirmation: {
      enabled: ready,
      reason,
      requiredText: getInvoiceFinalizationConfirmationText(
        context.invoice.invoiceNumber
      ),
    },
    cancellation: {
      enabled:
        state === "awaiting_input" || state === "awaiting_confirmation",
    },
    ...(state === "executed" && draft.resultEntityId
      ? {
          result: {
            entityType: "invoice" as const,
            entityId: draft.resultEntityId,
            label: "Fakturierte Rechnung öffnen",
          },
        }
      : {}),
  };
}

export async function createPersistedJarvisInvoiceFinalizationDraft(input: {
  preview: JarvisActionPreview<"invoice.finalize">;
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  now?: Date;
}) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für eine Fakturierung ist eine aktuelle serverseitige Sitzung erforderlich.",
      401
    );
  }
  if (!mayFinalizeInvoice(input)) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Rollenkombination darf keine Rechnung fakturieren.",
      403
    );
  }
  const now = input.now ?? new Date();
  const evaluation = await evaluateInvoiceFinalization({
    organizationId: input.organizationId,
    invoiceId: input.preview.payload.invoiceId,
  });
  const payload = invoiceFinalizationPayloadSchema.parse(input.preview.payload);
  const context = invoiceFinalizationContextSchema.parse(evaluation);
  const actorIds = getActorIds(input.profile);
  const state =
    context.blockingIssues.length === 0
      ? "awaiting_confirmation"
      : "awaiting_input";
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId,
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId: "invoice.finalize",
    state,
    revision: 1,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS),
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode:
      context.blockingIssues.length > 0 ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag: createIntegrityTag(draftData),
      },
    });
    await appendAuditEvent(tx, {
      draft,
      eventType:
        state === "awaiting_confirmation"
          ? "draft_created_ready"
          : "draft_created_blocked",
    });
    return draft;
  });
  return toJarvisInvoiceFinalizationDraftView(created, input);
}

export async function getJarvisInvoiceFinalizationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundInvoiceFinalizationDraft(
    previewId,
    binding,
    now
  );
  return toJarvisInvoiceFinalizationDraftView(draft, binding);
}

export async function cancelJarvisInvoiceFinalizationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const { draft } = await loadBoundInvoiceFinalizationDraft(
    previewId,
    binding,
    now
  );
  if (draft.state === "cancelled") {
    return toJarvisInvoiceFinalizationDraftView(draft, binding);
  }
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) {
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "invalid_state",
      "Diese Fakturavorschau kann nicht mehr abgebrochen werden.",
      draft.state === "expired" ? 410 : 409
    );
  }
  if (expectedRevision !== draft.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Die Fakturavorschau wurde zwischenzeitlich verändert.",
      409
    );
  }
  const nextData: DraftIntegrityData = {
    ...draft,
    state: "cancelled",
    cancelledAt: now,
    lastErrorCode: null,
  };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "cancelled",
        cancelledAt: now,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Die Fakturavorschau wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_cancelled",
      reasonCode: "user_cancelled",
    });
    return current;
  });
  return toJarvisInvoiceFinalizationDraftView(cancelled, binding);
}

export async function confirmJarvisInvoiceFinalizationDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  confirmationText: string,
  now = new Date()
) {
  const loaded = await loadBoundInvoiceFinalizationDraft(
    previewId,
    binding,
    now
  );
  if (loaded.draft.state === "executed") {
    return toJarvisInvoiceFinalizationDraftView(loaded.draft, binding);
  }
  const requiredText = getInvoiceFinalizationConfirmationText(
    loaded.context.invoice.invoiceNumber
  );
  if (
    !matchesInvoiceFinalizationConfirmation(
      loaded.context.invoice.invoiceNumber,
      confirmationText
    )
  ) {
    throw new JarvisActionDraftError(
      "invalid_input",
      `Gib zur kritischen Bestätigung exakt „${requiredText}“ ein.`,
      400
    );
  }
  if (
    expectedRevision !== loaded.draft.revision ||
    loaded.draft.state !== "awaiting_confirmation"
  ) {
    throw new JarvisActionDraftError(
      "conflict",
      "Nur die aktuelle, vollständig geprüfte Fakturavorschau darf bestätigt werden.",
      409
    );
  }
  if (!mayFinalizeInvoice(binding)) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Rollenkombination darf keine Rechnung fakturieren.",
      403
    );
  }
  try {
    const executed = await prisma.$transaction(
      async (tx) => {
        const current = await tx.jarvisActionDraft.findUnique({
          where: { id: loaded.draft.id },
        });
        if (!current) {
          throw new JarvisActionDraftError(
            "not_found",
            "Die Fakturavorschau wurde nicht gefunden.",
            404
          );
        }
        const parsed = validateInvoiceFinalizationBinding(current, binding);
        if (current.state === "executed") return current;
        if (
          current.state !== "awaiting_confirmation" ||
          current.expiresAt.getTime() <= now.getTime()
        ) {
          throw new JarvisActionDraftError(
            current.expiresAt.getTime() <= now.getTime()
              ? "expired"
              : "conflict",
            "Die Fakturavorschau ist nicht mehr ausführbar.",
            current.expiresAt.getTime() <= now.getTime() ? 410 : 409
          );
        }
        const actor = await tx.user.findFirst({
          where: {
            id: current.effectiveActorId,
            organizationId: binding.organizationId,
            isActive: true,
          },
          select: {
            id: true,
            role: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        });
        if (!actor || !canManageInvoices(actor)) {
          throw new JarvisActionDraftError(
            "role_changed",
            "Akteur oder Rechnungsberechtigung sind nicht mehr aktuell.",
            409
          );
        }
        const claimedData: DraftIntegrityData = {
          ...current,
          state: "executing",
          confirmedAt: now,
          lastErrorCode: null,
        };
        const claimed = await tx.jarvisActionDraft.updateMany({
          where: {
            id: current.id,
            revision: current.revision,
            state: "awaiting_confirmation",
            integrityTag: current.integrityTag,
          },
          data: {
            state: "executing",
            confirmedAt: now,
            lastErrorCode: null,
            integrityTag: createIntegrityTag(claimedData),
          },
        });
        if (claimed.count !== 1) {
          throw new JarvisActionDraftError(
            "conflict",
            "Die Rechnung wird bereits fakturiert.",
            409
          );
        }
        const actorName =
          [actor.firstName, actor.lastName].filter(Boolean).join(" ") ||
          actor.email;
        const invoice = await finalizeInvoiceDraft({
          tx,
          organizationId: binding.organizationId,
          invoiceId: parsed.payload.invoiceId,
          actorName,
          expectedFingerprint: parsed.context.fingerprint,
          source: "jarvis",
        });
        const executedAt = new Date();
        const executedData: DraftIntegrityData = {
          ...claimedData,
          state: "executed",
          executedAt,
          resultEntityType: "invoice",
          resultEntityId: invoice.id,
        };
        const finalDraft = await tx.jarvisActionDraft.update({
          where: { id: current.id },
          data: {
            state: "executed",
            executedAt,
            resultEntityType: "invoice",
            resultEntityId: invoice.id,
            integrityTag: createIntegrityTag(executedData),
          },
        });
        await appendAuditEvent(tx, {
          draft: finalDraft,
          eventType: "draft_confirmed_and_executed",
          result: { id: invoice.id, entityType: "invoice" },
        });
        return finalDraft;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    if (executed.resultEntityId) {
      await externalizeJarvisDocumentPdf({
        organizationId: binding.organizationId,
        kind: "invoice",
        entityId: executed.resultEntityId,
        actorUserId: executed.effectiveActorId,
      });
      try {
        await syncInvoiceInventoryMovements({
          db: prisma,
          organizationId: binding.organizationId,
          invoiceId: executed.resultEntityId,
          actorUserId: executed.effectiveActorId,
          actorName: "JARVIS",
        });
      } catch (inventoryError) {
        console.error(
          "JARVIS invoice inventory synchronization failed after finalization",
          inventoryError
        );
      }
    }
    return toJarvisInvoiceFinalizationDraftView(executed, binding);
  } catch (error) {
    if (
      error instanceof JarvisActionDraftError &&
      error.code === "conflict"
    ) {
      const latest = await loadBoundInvoiceFinalizationDraft(
        previewId,
        binding,
        now
      );
      if (latest.draft.state === "executed") {
        return toJarvisInvoiceFinalizationDraftView(latest.draft, binding);
      }
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof InvoiceFinalizationServiceError) {
      throw new JarvisActionDraftError(
        error.code === "stale_context" ? "stale_context" : "invalid_input",
        error.message,
        409
      );
    }
    throw new JarvisActionDraftError(
      "execution_failed",
      "Die Rechnung wurde nicht fakturiert und die Vorschau bleibt zur Prüfung erhalten.",
      500
    );
  }
}

function mayMarkInvoicePaid(binding: JarvisTaskDraftBinding) {
  return (
    canManageInvoices(binding.profile.sessionActor) &&
    canManageInvoices(binding.profile.effectiveActor)
  );
}

function validateInvoicePaymentBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Zahlungsvorschau gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.",
      403
    );
  }
  if (
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role
  ) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Die Rolle hat sich seit der Zahlungsprüfung geändert. Bitte erstelle eine neue Vorschau.",
      409
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Integritätsnachweis der Zahlungsvorschau ist ungültig.",
      409
    );
  }
  const payload = invoicePaymentPayloadSchema.safeParse(draft.payload);
  const context = invoicePaymentContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "invoice.mark-paid" ||
    !payload.success ||
    !context.success ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Zahlungsvorschau oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.",
      409
    );
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundInvoicePaymentDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) {
    throw new JarvisActionDraftError("not_found", "Die Zahlungsvorschau wurde nicht gefunden.", 404);
  }
  validateInvoicePaymentBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateInvoicePaymentBinding(current, binding);
  return { draft: current, ...parsed };
}

function toJarvisInvoicePaymentDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): JarvisInvoicePaymentDraftView {
  const { payload, context } = validateInvoicePaymentBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayMarkInvoicePaid(binding);
  const ready =
    state === "awaiting_confirmation" &&
    permitted &&
    context.blockingIssues.length === 0;
  const reason: JarvisInvoicePaymentDraftView["confirmation"]["reason"] =
    state === "expired"
      ? "expired"
      : state === "cancelled"
        ? "cancelled"
        : state === "executed"
          ? "executed"
          : state === "executing"
            ? "executing"
            : !permitted
              ? "not_permitted"
              : context.blockingIssues.length
                ? "blocked"
                : "ready";
  const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
  return {
    version: 2,
    previewId: draft.id,
    actionId: "invoice.mark-paid",
    title: "Zahlungseingang kontrolliert bestätigen",
    badge:
      state === "executed"
        ? "Bezahlt"
        : state === "executing"
          ? "Wird gebucht"
          : state === "cancelled"
            ? "Abgebrochen"
            : state === "expired"
              ? "Abgelaufen"
              : ready
                ? "Bereit"
                : "Prüfung",
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    invoiceId: context.invoice.id,
    projectId: context.invoice.projectId,
    fields: [
      { label: "Rechnung", value: context.invoice.invoiceNumber },
      { label: "Projekt", value: `${context.invoice.projectNumber} · ${context.invoice.projectTitle}` },
      { label: "Kunde", value: context.invoice.customerName || "–" },
      { label: "Fällig am", value: context.invoice.dueDate ? formatInvoicePaymentDate(context.invoice.dueDate) : "–" },
      { label: "Vollständiger Betrag", value: currency.format(context.invoice.grossTotal) },
    ],
    editor: { paymentDate: payload.paymentDate },
    checks: context.checks,
    warnings: context.warnings,
    blockingIssues: [
      ...context.blockingIssues,
      ...(!permitted ? ["Die Bezahlt-Markierung ist für diese Rollenkombination nicht freigegeben."] : []),
    ],
    confirmation: {
      enabled: ready,
      reason,
      requiredText: getInvoicePaymentConfirmationText(
        context.invoice.invoiceNumber,
        payload.paymentDate
      ),
    },
    cancellation: { enabled: OPEN_DRAFT_STATES.includes(state as never) },
    ...(state === "executed" && draft.resultEntityId
      ? { result: { entityType: "invoice" as const, entityId: draft.resultEntityId, label: "Bezahlte Rechnung öffnen" } }
      : {}),
  };
}

export async function createPersistedJarvisInvoicePaymentDraft(input: {
  preview: JarvisActionPreview<"invoice.mark-paid">;
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  now?: Date;
}) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError("session_required", "Für eine Bezahlt-Markierung ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  }
  if (!mayMarkInvoicePaid(input)) {
    throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf keine Rechnung als bezahlt markieren.", 403);
  }
  const now = input.now ?? new Date();
  const evaluation = await evaluateInvoicePayment({
    organizationId: input.organizationId,
    invoiceId: input.preview.payload.invoiceId,
    paymentDate: input.preview.payload.paymentDate,
    now,
  });
  const payload = invoicePaymentPayloadSchema.parse({
    invoiceId: input.preview.payload.invoiceId,
    paymentDate: evaluation.paymentDate,
  });
  const context = invoicePaymentContextSchema.parse(evaluation);
  const actorIds = getActorIds(input.profile);
  const state = context.blockingIssues.length ? "awaiting_input" : "awaiting_confirmation";
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId,
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId: "invoice.mark-paid",
    state,
    revision: 1,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS),
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode: context.blockingIssues.length ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag: createIntegrityTag(draftData),
      },
    });
    await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked" });
    return draft;
  });
  return toJarvisInvoicePaymentDraftView(created, input);
}

export async function getJarvisInvoicePaymentDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundInvoicePaymentDraft(previewId, binding, now);
  return toJarvisInvoicePaymentDraftView(draft, binding);
}

export async function completeJarvisInvoicePaymentDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  rawInput: unknown,
  now = new Date()
) {
  const completed = completeInvoicePaymentSchema.safeParse(rawInput);
  if (!completed.success) {
    throw new JarvisActionDraftError("invalid_input", "Zahlungsdatum oder Entwurfsrevision sind ungültig.", 400);
  }
  const loaded = await loadBoundInvoicePaymentDraft(previewId, binding, now);
  if (!OPEN_DRAFT_STATES.includes(loaded.draft.state as never)) {
    throw new JarvisActionDraftError(loaded.draft.state === "expired" ? "expired" : "invalid_state", "Diese Zahlungsvorschau kann nicht mehr geändert werden.", loaded.draft.state === "expired" ? 410 : 409);
  }
  if (completed.data.revision !== loaded.draft.revision) {
    throw new JarvisActionDraftError("conflict", "Die Zahlungsvorschau wurde zwischenzeitlich verändert.", 409);
  }
  const paymentDate = normalizeInvoicePaymentDate(completed.data.paymentDate);
  const evaluation: InvoicePaymentEvaluation = await evaluateInvoicePayment({
    organizationId: binding.organizationId,
    invoiceId: loaded.payload.invoiceId,
    paymentDate,
    now,
  });
  const payload = invoicePaymentPayloadSchema.parse({ invoiceId: loaded.payload.invoiceId, paymentDate: evaluation.paymentDate });
  const context = invoicePaymentContextSchema.parse(evaluation);
  const state = context.blockingIssues.length ? "awaiting_input" : "awaiting_confirmation";
  const nextData: DraftIntegrityData = {
    ...loaded.draft,
    state,
    revision: loaded.draft.revision + 1,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    confirmedAt: null,
    lastErrorCode: context.blockingIssues.length ? "invalid_input" : null,
  };
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: { id: loaded.draft.id, revision: loaded.draft.revision, state: loaded.draft.state, integrityTag: loaded.draft.integrityTag },
      data: {
        state,
        revision: nextData.revision,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        payloadHash: nextData.payloadHash,
        contextHash: nextData.contextHash,
        confirmedAt: null,
        lastErrorCode: nextData.lastErrorCode,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Zahlungsvorschau wurde bereits verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: loaded.draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: state === "awaiting_confirmation" ? "draft_completed_ready" : "draft_completed_blocked" });
    return current;
  });
  return toJarvisInvoicePaymentDraftView(updated, binding);
}

export async function cancelJarvisInvoicePaymentDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const { draft } = await loadBoundInvoicePaymentDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisInvoicePaymentDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) {
    throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Diese Zahlungsvorschau kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  }
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Die Zahlungsvorschau wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag },
      data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) },
    });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Zahlungsvorschau wurde bereits verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" });
    return current;
  });
  return toJarvisInvoicePaymentDraftView(cancelled, binding);
}

export async function confirmJarvisInvoicePaymentDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  confirmationText: string,
  now = new Date()
) {
  const loaded = await loadBoundInvoicePaymentDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisInvoicePaymentDraftView(loaded.draft, binding);
  const requiredText = getInvoicePaymentConfirmationText(loaded.context.invoice.invoiceNumber, loaded.payload.paymentDate);
  if (!matchesInvoicePaymentConfirmation(loaded.context.invoice.invoiceNumber, loaded.payload.paymentDate, confirmationText)) {
    throw new JarvisActionDraftError("invalid_input", `Gib zur kritischen Bestätigung exakt „${requiredText}“ ein.`, 400);
  }
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") {
    throw new JarvisActionDraftError("conflict", "Nur die aktuelle, vollständig geprüfte Zahlungsvorschau darf bestätigt werden.", 409);
  }
  if (!mayMarkInvoicePaid(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf keine Rechnung als bezahlt markieren.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } });
      if (!current) throw new JarvisActionDraftError("not_found", "Die Zahlungsvorschau wurde nicht gefunden.", 404);
      const parsed = validateInvoicePaymentBinding(current, binding);
      if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) {
        throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Die Zahlungsvorschau ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      }
      const actor = await tx.user.findFirst({
        where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true },
        select: { id: true, role: true, firstName: true, lastName: true, email: true },
      });
      if (!actor || !canManageInvoices(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Rechnungsberechtigung sind nicht mehr aktuell.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null };
      const claimed = await tx.jarvisActionDraft.updateMany({
        where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag },
        data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) },
      });
      if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Der Zahlungseingang wird bereits gebucht.", 409);
      const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
      const invoice = await markInvoicePaid({
        tx,
        organizationId: binding.organizationId,
        invoiceId: parsed.payload.invoiceId,
        paymentDate: parsed.payload.paymentDate,
        actorName,
        expectedFingerprint: parsed.context.fingerprint,
        source: "jarvis",
      });
      const executedAt = new Date();
      const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "invoice", resultEntityId: invoice.id };
      const finalDraft = await tx.jarvisActionDraft.update({
        where: { id: current.id },
        data: { state: "executed", executedAt, resultEntityType: "invoice", resultEntityId: invoice.id, integrityTag: createIntegrityTag(executedData) },
      });
      await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed", result: { id: invoice.id, entityType: "invoice" } });
      return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return toJarvisInvoicePaymentDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") {
      const latest = await loadBoundInvoicePaymentDraft(previewId, binding, now);
      if (latest.draft.state === "executed") return toJarvisInvoicePaymentDraftView(latest.draft, binding);
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof InvoicePaymentServiceError) {
      throw new JarvisActionDraftError(error.code === "stale_context" ? "stale_context" : "invalid_input", error.message, 409);
    }
    throw new JarvisActionDraftError("execution_failed", "Die Rechnung wurde nicht als bezahlt markiert und die Vorschau bleibt zur Prüfung erhalten.", 500);
  }
}

function mayCreateInvoiceReminder(binding: JarvisTaskDraftBinding) {
  return (
    canManageInvoices(binding.profile.sessionActor) &&
    canManageInvoices(binding.profile.effectiveActor)
  );
}

function validateInvoiceReminderBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Mahnvorschau gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.",
      403
    );
  }
  if (
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role
  ) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Die Rolle hat sich seit der Mahnprüfung geändert. Bitte erstelle eine neue Vorschau.",
      409
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Integritätsnachweis der Mahnvorschau ist ungültig.",
      409
    );
  }
  const payload = invoiceReminderPayloadSchema.safeParse(draft.payload);
  const context = invoiceReminderContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "invoice.remind" ||
    !payload.success ||
    !context.success ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Mahnvorschau oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.",
      409
    );
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundInvoiceReminderDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) {
    throw new JarvisActionDraftError("not_found", "Die Mahnvorschau wurde nicht gefunden.", 404);
  }
  validateInvoiceReminderBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateInvoiceReminderBinding(current, binding);
  return { draft: current, ...parsed };
}

function toJarvisInvoiceReminderDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): JarvisInvoiceReminderDraftView {
  const { payload, context } = validateInvoiceReminderBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayCreateInvoiceReminder(binding);
  const ready =
    state === "awaiting_confirmation" &&
    permitted &&
    context.blockingIssues.length === 0;
  const reason: JarvisInvoiceReminderDraftView["confirmation"]["reason"] =
    state === "expired"
      ? "expired"
      : state === "cancelled"
        ? "cancelled"
        : state === "executed"
          ? "executed"
          : state === "executing"
            ? "executing"
            : !permitted
              ? "not_permitted"
              : context.blockingIssues.length
                ? "blocked"
                : "ready";
  const currency = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  });
  return {
    version: 2,
    previewId: draft.id,
    actionId: "invoice.remind",
    title: "Mahnung kontrolliert erzeugen",
    badge:
      state === "executed"
        ? "Erstellt"
        : state === "executing"
          ? "Wird erstellt"
          : state === "cancelled"
            ? "Abgebrochen"
            : state === "expired"
              ? "Abgelaufen"
              : ready
                ? "Bereit"
                : "Prüfung",
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    invoiceId: context.invoice.id,
    projectId: context.invoice.projectId,
    fields: [
      { label: "Mahnung", value: context.documentNumber },
      { label: "Rechnung", value: context.invoice.invoiceNumber },
      {
        label: "Projekt",
        value: `${context.invoice.projectNumber} · ${context.invoice.projectTitle}`,
      },
      { label: "Kunde", value: context.invoice.customerName || "–" },
      {
        label: "Fällig am",
        value: context.invoice.dueDate
          ? formatInvoicePaymentDate(context.invoice.dueDate)
          : "–",
      },
      { label: "Offener Betrag", value: currency.format(context.invoice.grossTotal) },
      { label: "Nächste Mahnstufe", value: String(context.nextReminderLevel) },
    ],
    editor: {
      reminderDate: payload.reminderDate,
      paymentDeadline: payload.paymentDeadline,
    },
    checks: context.checks,
    warnings: context.warnings,
    blockingIssues: [
      ...context.blockingIssues,
      ...(!permitted
        ? ["Die Mahnung ist für diese Rollenkombination nicht freigegeben."]
        : []),
    ],
    confirmation: {
      enabled: ready,
      reason,
      requiredText: getInvoiceReminderConfirmationText(
        context.documentNumber,
        payload.paymentDeadline
      ),
    },
    cancellation: { enabled: OPEN_DRAFT_STATES.includes(state as never) },
    ...(state === "executed" && draft.resultEntityId
      ? {
          result: {
            entityType: "invoice" as const,
            entityId: draft.resultEntityId,
            label: "Gemahnte Rechnung öffnen",
          },
        }
      : {}),
  };
}

export async function createPersistedJarvisInvoiceReminderDraft(input: {
  preview: JarvisActionPreview<"invoice.remind">;
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  now?: Date;
}) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für eine Mahnung ist eine aktuelle serverseitige Sitzung erforderlich.",
      401
    );
  }
  if (!mayCreateInvoiceReminder(input)) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Rollenkombination darf keine Mahnung erzeugen.",
      403
    );
  }
  const now = input.now ?? new Date();
  const evaluation = await evaluateInvoiceReminder({
    organizationId: input.organizationId,
    invoiceId: input.preview.payload.invoiceId,
    reminderDate: input.preview.payload.reminderDate,
    paymentDeadline: input.preview.payload.paymentDeadline,
    now,
  });
  const payload = invoiceReminderPayloadSchema.parse({
    invoiceId: input.preview.payload.invoiceId,
    reminderDate: evaluation.reminderDate,
    paymentDeadline: evaluation.paymentDeadline,
  });
  const context = invoiceReminderContextSchema.parse(evaluation);
  const actorIds = getActorIds(input.profile);
  const state = context.blockingIssues.length
    ? "awaiting_input"
    : "awaiting_confirmation";
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId,
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId: "invoice.remind",
    state,
    revision: 1,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS),
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode: context.blockingIssues.length ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag: createIntegrityTag(draftData),
      },
    });
    await appendAuditEvent(tx, {
      draft,
      eventType:
        state === "awaiting_confirmation"
          ? "draft_created_ready"
          : "draft_created_blocked",
    });
    return draft;
  });
  return toJarvisInvoiceReminderDraftView(created, input);
}

export async function getJarvisInvoiceReminderDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundInvoiceReminderDraft(previewId, binding, now);
  return toJarvisInvoiceReminderDraftView(draft, binding);
}

export async function completeJarvisInvoiceReminderDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  rawInput: unknown,
  now = new Date()
) {
  const completed = completeInvoiceReminderSchema.safeParse(rawInput);
  if (!completed.success) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Mahndatum, Zahlungsfrist oder Entwurfsrevision sind ungültig.",
      400
    );
  }
  const loaded = await loadBoundInvoiceReminderDraft(previewId, binding, now);
  if (!OPEN_DRAFT_STATES.includes(loaded.draft.state as never)) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "invalid_state",
      "Diese Mahnvorschau kann nicht mehr geändert werden.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  if (completed.data.revision !== loaded.draft.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Die Mahnvorschau wurde zwischenzeitlich verändert.",
      409
    );
  }
  const evaluation: InvoiceReminderEvaluation = await evaluateInvoiceReminder({
    organizationId: binding.organizationId,
    invoiceId: loaded.payload.invoiceId,
    reminderDate: normalizeInvoicePaymentDate(completed.data.reminderDate),
    paymentDeadline: normalizeInvoicePaymentDate(completed.data.paymentDeadline),
    now,
  });
  const payload = invoiceReminderPayloadSchema.parse({
    invoiceId: loaded.payload.invoiceId,
    reminderDate: evaluation.reminderDate,
    paymentDeadline: evaluation.paymentDeadline,
  });
  const context = invoiceReminderContextSchema.parse(evaluation);
  const state = context.blockingIssues.length
    ? "awaiting_input"
    : "awaiting_confirmation";
  const nextData: DraftIntegrityData = {
    ...loaded.draft,
    state,
    revision: loaded.draft.revision + 1,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    confirmedAt: null,
    lastErrorCode: context.blockingIssues.length ? "invalid_input" : null,
  };
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: loaded.draft.id,
        revision: loaded.draft.revision,
        state: loaded.draft.state,
        integrityTag: loaded.draft.integrityTag,
      },
      data: {
        state,
        revision: nextData.revision,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        payloadHash: nextData.payloadHash,
        contextHash: nextData.contextHash,
        confirmedAt: null,
        lastErrorCode: nextData.lastErrorCode,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Die Mahnvorschau wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: loaded.draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType:
        state === "awaiting_confirmation"
          ? "draft_completed_ready"
          : "draft_completed_blocked",
    });
    return current;
  });
  return toJarvisInvoiceReminderDraftView(updated, binding);
}

export async function cancelJarvisInvoiceReminderDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const { draft } = await loadBoundInvoiceReminderDraft(previewId, binding, now);
  if (draft.state === "cancelled") {
    return toJarvisInvoiceReminderDraftView(draft, binding);
  }
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) {
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "invalid_state",
      "Diese Mahnvorschau kann nicht mehr abgebrochen werden.",
      draft.state === "expired" ? 410 : 409
    );
  }
  if (expectedRevision !== draft.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Die Mahnvorschau wurde zwischenzeitlich verändert.",
      409
    );
  }
  const nextData: DraftIntegrityData = {
    ...draft,
    state: "cancelled",
    cancelledAt: now,
    lastErrorCode: null,
  };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "cancelled",
        cancelledAt: now,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Die Mahnvorschau wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_cancelled",
      reasonCode: "user_cancelled",
    });
    return current;
  });
  return toJarvisInvoiceReminderDraftView(cancelled, binding);
}

export async function confirmJarvisInvoiceReminderDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  confirmationText: string,
  now = new Date()
) {
  const loaded = await loadBoundInvoiceReminderDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") {
    return toJarvisInvoiceReminderDraftView(loaded.draft, binding);
  }
  const requiredText = getInvoiceReminderConfirmationText(
    loaded.context.documentNumber,
    loaded.payload.paymentDeadline
  );
  if (
    !matchesInvoiceReminderConfirmation(
      loaded.context.documentNumber,
      loaded.payload.paymentDeadline,
      confirmationText
    )
  ) {
    throw new JarvisActionDraftError(
      "invalid_input",
      `Gib zur kritischen Bestätigung exakt „${requiredText}“ ein.`,
      400
    );
  }
  if (
    expectedRevision !== loaded.draft.revision ||
    loaded.draft.state !== "awaiting_confirmation"
  ) {
    throw new JarvisActionDraftError(
      "conflict",
      "Nur die aktuelle, vollständig geprüfte Mahnvorschau darf bestätigt werden.",
      409
    );
  }
  if (!mayCreateInvoiceReminder(binding)) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Rollenkombination darf keine Mahnung erzeugen.",
      403
    );
  }
  try {
    const executed = await prisma.$transaction(
      async (tx) => {
        const current = await tx.jarvisActionDraft.findUnique({
          where: { id: loaded.draft.id },
        });
        if (!current) {
          throw new JarvisActionDraftError(
            "not_found",
            "Die Mahnvorschau wurde nicht gefunden.",
            404
          );
        }
        const parsed = validateInvoiceReminderBinding(current, binding);
        if (current.state === "executed") return current;
        if (
          current.state !== "awaiting_confirmation" ||
          current.expiresAt.getTime() <= now.getTime()
        ) {
          throw new JarvisActionDraftError(
            current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict",
            "Die Mahnvorschau ist nicht mehr ausführbar.",
            current.expiresAt.getTime() <= now.getTime() ? 410 : 409
          );
        }
        const actor = await tx.user.findFirst({
          where: {
            id: current.effectiveActorId,
            organizationId: binding.organizationId,
            isActive: true,
          },
          select: {
            id: true,
            role: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        });
        if (!actor || !canManageInvoices(actor)) {
          throw new JarvisActionDraftError(
            "role_changed",
            "Akteur oder Rechnungsberechtigung sind nicht mehr aktuell.",
            409
          );
        }
        const claimedData: DraftIntegrityData = {
          ...current,
          state: "executing",
          confirmedAt: now,
          lastErrorCode: null,
        };
        const claimed = await tx.jarvisActionDraft.updateMany({
          where: {
            id: current.id,
            revision: current.revision,
            state: "awaiting_confirmation",
            integrityTag: current.integrityTag,
          },
          data: {
            state: "executing",
            confirmedAt: now,
            lastErrorCode: null,
            integrityTag: createIntegrityTag(claimedData),
          },
        });
        if (claimed.count !== 1) {
          throw new JarvisActionDraftError(
            "conflict",
            "Die Mahnung wird bereits erstellt.",
            409
          );
        }
        const actorName =
          [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
        const result = await createInvoiceReminder({
          tx,
          organizationId: binding.organizationId,
          invoiceId: parsed.payload.invoiceId,
          reminderDate: parsed.payload.reminderDate,
          paymentDeadline: parsed.payload.paymentDeadline,
          actorName,
          actorUserId: actor.id,
          expectedFingerprint: parsed.context.fingerprint,
          source: "jarvis",
        });
        const executedAt = new Date();
        const executedData: DraftIntegrityData = {
          ...claimedData,
          state: "executed",
          executedAt,
          resultEntityType: "invoice",
          resultEntityId: result.invoice.id,
        };
        const finalDraft = await tx.jarvisActionDraft.update({
          where: { id: current.id },
          data: {
            state: "executed",
            executedAt,
            resultEntityType: "invoice",
            resultEntityId: result.invoice.id,
            integrityTag: createIntegrityTag(executedData),
          },
        });
        await appendAuditEvent(tx, {
          draft: finalDraft,
          eventType: "draft_confirmed_and_executed",
          result: { id: result.invoice.id, entityType: "invoice" },
        });
        return finalDraft;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return toJarvisInvoiceReminderDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") {
      const latest = await loadBoundInvoiceReminderDraft(previewId, binding, now);
      if (latest.draft.state === "executed") {
        return toJarvisInvoiceReminderDraftView(latest.draft, binding);
      }
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof InvoiceReminderServiceError) {
      throw new JarvisActionDraftError(
        error.code === "stale_context" ? "stale_context" : "invalid_input",
        error.message,
        409
      );
    }
    throw new JarvisActionDraftError(
      "execution_failed",
      "Die Mahnung wurde nicht erstellt und die Vorschau bleibt zur Prüfung erhalten.",
      500
    );
  }
}

function mayCreateInvoiceCancellation(binding: JarvisTaskDraftBinding) {
  return canManageInvoices(binding.profile.sessionActor) && canManageInvoices(binding.profile.effectiveActor);
}

function validateInvoiceCancellationBinding(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId || draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId || draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError("scope_mismatch", "Diese Stornovorschau gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.", 403);
  }
  if (draft.sessionActorRole !== binding.profile.sessionActor.role || draft.effectiveActorRole !== binding.profile.effectiveActor.role) {
    throw new JarvisActionDraftError("role_changed", "Die Rolle hat sich seit der Stornoprüfung geändert. Bitte erstelle eine neue Vorschau.", 409);
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError("integrity_failed", "Der Integritätsnachweis der Stornovorschau ist ungültig.", 409);
  }
  const payload = invoiceCancellationPayloadSchema.safeParse(draft.payload);
  const context = invoiceCancellationContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "invoice.cancel" || !payload.success || !context.success ||
    hashJson(payload.data) !== draft.payloadHash || hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError("integrity_failed", "Stornovorschau oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.", 409);
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundInvoiceCancellationDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) throw new JarvisActionDraftError("not_found", "Die Stornovorschau wurde nicht gefunden.", 404);
  validateInvoiceCancellationBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  return { draft: current, ...validateInvoiceCancellationBinding(current, binding) };
}

function toJarvisInvoiceCancellationDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): JarvisInvoiceCancellationDraftView {
  const { payload, context } = validateInvoiceCancellationBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayCreateInvoiceCancellation(binding);
  const ready = state === "awaiting_confirmation" && permitted && !context.blockingIssues.length && payload.reason.length >= 3;
  const reason: JarvisInvoiceCancellationDraftView["confirmation"]["reason"] =
    state === "expired" ? "expired" : state === "cancelled" ? "cancelled" : state === "executed" ? "executed" :
    state === "executing" ? "executing" : !permitted ? "not_permitted" : context.blockingIssues.length || payload.reason.length < 3 ? "blocked" : "ready";
  const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
  return {
    version: 2,
    previewId: draft.id,
    actionId: "invoice.cancel",
    title: "Rechnung kontrolliert vollständig stornieren",
    badge: state === "executed" ? "Storniert" : state === "executing" ? "Wird storniert" : state === "cancelled" ? "Abgebrochen" : state === "expired" ? "Abgelaufen" : ready ? "Bereit" : "Prüfung",
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    invoiceId: context.invoice.id,
    projectId: context.invoice.projectId,
    fields: [
      { label: "Rechnung", value: context.invoice.invoiceNumber },
      { label: "Stornorechnung", value: context.cancellationNumber },
      { label: "Projekt", value: `${context.invoice.projectNumber} · ${context.invoice.projectTitle}` },
      { label: "Kunde", value: context.invoice.customerName || "–" },
      { label: "Status", value: context.invoice.status },
      { label: "Vollständige Gegenbuchung", value: currency.format(-Math.abs(context.invoice.grossTotal)) },
      { label: "Freizugebende Zeiten", value: String(context.releasedTimeEntryCount) },
      { label: "Bestehende Teilgutschriften", value: context.activeCreditCount ? `${context.activeCreditCount} · ${currency.format(context.creditedGrossTotal)}` : "Keine" },
    ],
    editor: { reason: payload.reason },
    checks: context.checks,
    warnings: context.warnings,
    blockingIssues: [
      ...context.blockingIssues,
      ...(payload.reason.length < 3 ? ["Ein nachvollziehbarer Stornogrund mit mindestens 3 Zeichen ist erforderlich."] : []),
      ...(!permitted ? ["Das Vollstorno ist für diese Rollenkombination nicht freigegeben."] : []),
    ],
    confirmation: {
      enabled: ready,
      reason,
      requiredText: getInvoiceCancellationConfirmationText(context.invoice.invoiceNumber, context.cancellationNumber),
    },
    cancellation: { enabled: OPEN_DRAFT_STATES.includes(state as never) },
    ...(state === "executed" && draft.resultEntityId ? {
      result: { entityType: "invoice" as const, entityId: draft.resultEntityId, label: "Stornorechnung öffnen" },
    } : {}),
  };
}

export async function createPersistedJarvisInvoiceCancellationDraft(input: {
  preview: JarvisActionPreview<"invoice.cancel">;
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  now?: Date;
}) {
  if (!input.sessionId) throw new JarvisActionDraftError("session_required", "Für ein Vollstorno ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  if (!mayCreateInvoiceCancellation(input)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf keine Rechnung stornieren.", 403);
  const now = input.now ?? new Date();
  const evaluation = await evaluateInvoiceCancellation({ organizationId: input.organizationId, invoiceId: input.preview.payload.invoiceId });
  const payload = invoiceCancellationPayloadSchema.parse({ invoiceId: input.preview.payload.invoiceId, reason: input.preview.payload.reason ?? "" });
  const context = invoiceCancellationContextSchema.parse(evaluation);
  const state = context.blockingIssues.length || payload.reason.length < 3 ? "awaiting_input" : "awaiting_confirmation";
  const actorIds = getActorIds(input.profile);
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId, organizationId: input.organizationId, sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId, sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId, effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating, actionId: "invoice.cancel", state, revision: 1,
    payloadHash: hashJson(payload), contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS), confirmedAt: null, cancelledAt: null,
    executedAt: null, resultEntityType: null, resultEntityId: null,
    lastErrorCode: state === "awaiting_input" ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({ data: { ...draftData, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue, integrityTag: createIntegrityTag(draftData) } });
    await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked" });
    return draft;
  });
  return toJarvisInvoiceCancellationDraftView(created, input);
}

export async function getJarvisInvoiceCancellationDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const { draft } = await loadBoundInvoiceCancellationDraft(previewId, binding, now);
  return toJarvisInvoiceCancellationDraftView(draft, binding);
}

export async function completeJarvisInvoiceCancellationDraft(previewId: string, binding: JarvisTaskDraftBinding, rawInput: unknown, now = new Date()) {
  const completed = completeInvoiceCancellationSchema.safeParse(rawInput);
  if (!completed.success) throw new JarvisActionDraftError("invalid_input", "Stornogrund oder Entwurfsrevision sind ungültig.", 400);
  const loaded = await loadBoundInvoiceCancellationDraft(previewId, binding, now);
  if (!OPEN_DRAFT_STATES.includes(loaded.draft.state as never)) throw new JarvisActionDraftError(loaded.draft.state === "expired" ? "expired" : "invalid_state", "Diese Stornovorschau kann nicht mehr geändert werden.", loaded.draft.state === "expired" ? 410 : 409);
  if (completed.data.revision !== loaded.draft.revision) throw new JarvisActionDraftError("conflict", "Die Stornovorschau wurde zwischenzeitlich verändert.", 409);
  const evaluation: InvoiceCancellationEvaluation = await evaluateInvoiceCancellation({ organizationId: binding.organizationId, invoiceId: loaded.payload.invoiceId });
  const payload = invoiceCancellationPayloadSchema.parse({ invoiceId: loaded.payload.invoiceId, reason: completed.data.reason });
  const context = invoiceCancellationContextSchema.parse(evaluation);
  const state = context.blockingIssues.length || payload.reason.length < 3 ? "awaiting_input" : "awaiting_confirmation";
  const nextData: DraftIntegrityData = { ...loaded.draft, state, revision: loaded.draft.revision + 1, payloadHash: hashJson(payload), contextHash: hashJson(context), confirmedAt: null, lastErrorCode: state === "awaiting_input" ? "invalid_input" : null };
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: { id: loaded.draft.id, revision: loaded.draft.revision, state: loaded.draft.state, integrityTag: loaded.draft.integrityTag },
      data: { state, revision: nextData.revision, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue, payloadHash: nextData.payloadHash, contextHash: nextData.contextHash, confirmedAt: null, lastErrorCode: nextData.lastErrorCode, integrityTag: createIntegrityTag(nextData) },
    });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Stornovorschau wurde bereits verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: loaded.draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: state === "awaiting_confirmation" ? "draft_completed_ready" : "draft_completed_blocked" });
    return current;
  });
  return toJarvisInvoiceCancellationDraftView(updated, binding);
}

export async function cancelJarvisInvoiceCancellationDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()) {
  const { draft } = await loadBoundInvoiceCancellationDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisInvoiceCancellationDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Diese Stornovorschau kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Die Stornovorschau wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag },
      data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) },
    });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Stornovorschau wurde bereits verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" });
    return current;
  });
  return toJarvisInvoiceCancellationDraftView(cancelled, binding);
}

export async function confirmJarvisInvoiceCancellationDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, confirmationText: string, now = new Date()) {
  const loaded = await loadBoundInvoiceCancellationDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisInvoiceCancellationDraftView(loaded.draft, binding);
  const requiredText = getInvoiceCancellationConfirmationText(loaded.context.invoice.invoiceNumber, loaded.context.cancellationNumber);
  if (!matchesInvoiceCancellationConfirmation(loaded.context.invoice.invoiceNumber, loaded.context.cancellationNumber, confirmationText)) {
    throw new JarvisActionDraftError("invalid_input", `Gib zur kritischen Bestätigung exakt „${requiredText}“ ein.`, 400);
  }
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") throw new JarvisActionDraftError("conflict", "Nur die aktuelle, vollständig geprüfte Stornovorschau darf bestätigt werden.", 409);
  if (!mayCreateInvoiceCancellation(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf keine Rechnung stornieren.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } });
      if (!current) throw new JarvisActionDraftError("not_found", "Die Stornovorschau wurde nicht gefunden.", 404);
      const parsed = validateInvoiceCancellationBinding(current, binding);
      if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Die Stornovorschau ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      const actor = await tx.user.findFirst({ where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true }, select: { id: true, role: true, firstName: true, lastName: true, email: true } });
      if (!actor || !canManageInvoices(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Rechnungsberechtigung sind nicht mehr aktuell.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null };
      const claimed = await tx.jarvisActionDraft.updateMany({ where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag }, data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) } });
      if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Rechnung wird bereits storniert.", 409);
      const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
      const result = await createInvoiceCancellation({
        tx, organizationId: binding.organizationId, invoiceId: parsed.payload.invoiceId,
        actorName, actorUserId: actor.id, reason: parsed.payload.reason,
        expectedFingerprint: parsed.context.fingerprint, source: "jarvis",
      });
      const executedAt = new Date();
      const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "invoice", resultEntityId: result.cancellationInvoice.id };
      const finalDraft = await tx.jarvisActionDraft.update({ where: { id: current.id }, data: { state: "executed", executedAt, resultEntityType: "invoice", resultEntityId: result.cancellationInvoice.id, integrityTag: createIntegrityTag(executedData) } });
      await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed", result: { id: result.cancellationInvoice.id, entityType: "invoice" } });
      return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await externalizeJarvisDocumentPdf({
      organizationId: binding.organizationId,
      kind: "invoice",
      entityId: executed.resultEntityId,
      actorUserId: executed.effectiveActorId,
    });
    return toJarvisInvoiceCancellationDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") {
      const latest = await loadBoundInvoiceCancellationDraft(previewId, binding, now);
      if (latest.draft.state === "executed") return toJarvisInvoiceCancellationDraftView(latest.draft, binding);
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof InvoiceCancellationServiceError) throw new JarvisActionDraftError(error.code === "stale_context" ? "stale_context" : "invalid_input", error.message, 409);
    throw new JarvisActionDraftError("execution_failed", "Die Rechnung wurde nicht storniert und die Vorschau bleibt zur Prüfung erhalten.", 500);
  }
}

function mayCreateInvoiceCredit(binding: JarvisTaskDraftBinding) {
  return canManageInvoices(binding.profile.sessionActor) && canManageInvoices(binding.profile.effectiveActor);
}

function validateInvoiceCreditBinding(draft: JarvisActionDraft, binding: JarvisTaskDraftBinding) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId || draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId || draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError("scope_mismatch", "Diese Gutschriftvorschau gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.", 403);
  }
  if (draft.sessionActorRole !== binding.profile.sessionActor.role || draft.effectiveActorRole !== binding.profile.effectiveActor.role) {
    throw new JarvisActionDraftError("role_changed", "Die Rolle hat sich seit der Gutschriftprüfung geändert. Bitte erstelle eine neue Vorschau.", 409);
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError("integrity_failed", "Der Integritätsnachweis der Gutschriftvorschau ist ungültig.", 409);
  }
  const payload = invoiceCreditPayloadSchema.safeParse(draft.payload);
  const context = invoiceCreditContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "invoice.credit" || !payload.success || !context.success ||
    hashJson(payload.data) !== draft.payloadHash || hashJson(context.data) !== draft.contextHash
  ) {
    throw new JarvisActionDraftError("integrity_failed", "Gutschriftdaten oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.", 409);
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundInvoiceCreditDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const found = await prisma.jarvisActionDraft.findUnique({ where: { id: previewId } });
  if (!found) throw new JarvisActionDraftError("not_found", "Die Gutschriftvorschau wurde nicht gefunden.", 404);
  validateInvoiceCreditBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  return { draft: current, ...validateInvoiceCreditBinding(current, binding) };
}

function toJarvisInvoiceCreditDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): JarvisInvoiceCreditDraftView {
  const { payload, context } = validateInvoiceCreditBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = mayCreateInvoiceCredit(binding);
  const ready = state === "awaiting_confirmation" && permitted && !context.blockingIssues.length && payload.reason.length >= 3 && context.totalCreditNet > 0;
  const confirmationReason: JarvisInvoiceCreditDraftView["confirmation"]["reason"] =
    state === "expired" ? "expired" : state === "cancelled" ? "cancelled" : state === "executed" ? "executed" :
    state === "executing" ? "executing" : !permitted ? "not_permitted" : !ready ? "blocked" : "ready";
  const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
  return {
    version: 2,
    previewId: draft.id,
    actionId: "invoice.credit",
    title: "Teilgutschrift kontrolliert erstellen",
    badge: state === "executed" ? "Erstellt" : state === "executing" ? "Wird erstellt" : state === "cancelled" ? "Abgebrochen" : state === "expired" ? "Abgelaufen" : ready ? "Bereit" : "Prüfung",
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    invoiceId: context.invoice.id,
    projectId: context.invoice.projectId,
    fields: [
      { label: "Referenzrechnung", value: context.invoice.invoiceNumber },
      { label: "Gutschrift", value: context.creditNumber },
      { label: "Projekt", value: `${context.invoice.projectNumber} · ${context.invoice.projectTitle}` },
      { label: "Kunde", value: context.invoice.customerName || "–" },
      { label: "Rechnungsstatus", value: context.invoice.status },
      { label: "Ausgewählt", value: `${currency.format(context.totalCreditNet)} netto / ${currency.format(context.totalCreditGross)} brutto` },
      { label: "Vorher noch gutschreibbar", value: `${currency.format(context.remainingInvoiceNet)} netto` },
    ],
    editor: {
      reason: payload.reason,
      items: context.lines.map((line) => ({
        sourceInvoiceLineId: line.id,
        label: `${String(line.position).padStart(3, "0")} · ${line.title}`,
        vatRate: line.vatRate,
        originalNet: line.originalNet,
        alreadyCreditedNet: line.alreadyCreditedNet,
        remainingNet: line.remainingNet,
        netAmount: line.creditNet,
      })),
    },
    checks: context.checks,
    warnings: context.warnings,
    blockingIssues: [
      ...context.blockingIssues,
      ...(payload.reason.length < 3 ? ["Ein nachvollziehbarer Korrekturgrund mit mindestens 3 Zeichen ist erforderlich."] : []),
      ...(!permitted ? ["Diese Rollenkombination darf keine Teilgutschrift erstellen."] : []),
    ],
    confirmation: {
      enabled: ready,
      reason: confirmationReason,
      requiredText: getInvoiceCreditConfirmationText(context.invoice.invoiceNumber, context.creditNumber, context.totalCreditGross),
    },
    cancellation: { enabled: OPEN_DRAFT_STATES.includes(state as never) },
    ...(state === "executed" && draft.resultEntityId ? {
      result: { entityType: "invoice" as const, entityId: draft.resultEntityId, label: "Gutschrift öffnen" },
    } : {}),
  };
}

export async function createPersistedJarvisInvoiceCreditDraft(input: {
  preview: JarvisActionPreview<"invoice.credit">;
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  now?: Date;
}) {
  if (!input.sessionId) throw new JarvisActionDraftError("session_required", "Für eine Teilgutschrift ist eine aktuelle serverseitige Sitzung erforderlich.", 401);
  if (!mayCreateInvoiceCredit(input)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf keine Teilgutschrift erstellen.", 403);
  const now = input.now ?? new Date();
  const payload = invoiceCreditPayloadSchema.parse({
    invoiceId: input.preview.payload.invoiceId,
    reason: input.preview.payload.reason ?? "",
    items: input.preview.payload.items ?? [],
  });
  const evaluation = await evaluateInvoiceCredit({ organizationId: input.organizationId, invoiceId: payload.invoiceId, items: payload.items });
  const context = invoiceCreditContextSchema.parse(evaluation);
  const state = context.blockingIssues.length || payload.reason.length < 3 ? "awaiting_input" : "awaiting_confirmation";
  const actorIds = getActorIds(input.profile);
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId, organizationId: input.organizationId, sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId, sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId, effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating, actionId: "invoice.credit", state, revision: 1,
    payloadHash: hashJson(payload), contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS), confirmedAt: null, cancelledAt: null,
    executedAt: null, resultEntityType: null, resultEntityId: null,
    lastErrorCode: state === "awaiting_input" ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({ data: { ...draftData, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue, integrityTag: createIntegrityTag(draftData) } });
    await appendAuditEvent(tx, { draft, eventType: state === "awaiting_confirmation" ? "draft_created_ready" : "draft_created_blocked" });
    return draft;
  });
  return toJarvisInvoiceCreditDraftView(created, input);
}

export async function getJarvisInvoiceCreditDraft(previewId: string, binding: JarvisTaskDraftBinding, now = new Date()) {
  const { draft } = await loadBoundInvoiceCreditDraft(previewId, binding, now);
  return toJarvisInvoiceCreditDraftView(draft, binding);
}

export async function completeJarvisInvoiceCreditDraft(previewId: string, binding: JarvisTaskDraftBinding, rawInput: unknown, now = new Date()) {
  const completed = completeInvoiceCreditSchema.safeParse(rawInput);
  if (!completed.success) throw new JarvisActionDraftError("invalid_input", "Korrekturgrund, Positionsbeträge oder Entwurfsrevision sind ungültig.", 400);
  const loaded = await loadBoundInvoiceCreditDraft(previewId, binding, now);
  if (!OPEN_DRAFT_STATES.includes(loaded.draft.state as never)) throw new JarvisActionDraftError(loaded.draft.state === "expired" ? "expired" : "invalid_state", "Diese Gutschriftvorschau kann nicht mehr geändert werden.", loaded.draft.state === "expired" ? 410 : 409);
  if (completed.data.revision !== loaded.draft.revision) throw new JarvisActionDraftError("conflict", "Die Gutschriftvorschau wurde zwischenzeitlich verändert.", 409);
  const payload = invoiceCreditPayloadSchema.parse({ invoiceId: loaded.payload.invoiceId, reason: completed.data.reason, items: completed.data.items });
  const evaluation: InvoiceCreditEvaluation = await evaluateInvoiceCredit({ organizationId: binding.organizationId, invoiceId: payload.invoiceId, items: payload.items });
  const context = invoiceCreditContextSchema.parse(evaluation);
  const state = context.blockingIssues.length || payload.reason.length < 3 ? "awaiting_input" : "awaiting_confirmation";
  const nextData: DraftIntegrityData = { ...loaded.draft, state, revision: loaded.draft.revision + 1, payloadHash: hashJson(payload), contextHash: hashJson(context), confirmedAt: null, lastErrorCode: state === "awaiting_input" ? "invalid_input" : null };
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: { id: loaded.draft.id, revision: loaded.draft.revision, state: loaded.draft.state, integrityTag: loaded.draft.integrityTag },
      data: { state, revision: nextData.revision, payload: payload as Prisma.InputJsonValue, context: context as Prisma.InputJsonValue, payloadHash: nextData.payloadHash, contextHash: nextData.contextHash, confirmedAt: null, lastErrorCode: nextData.lastErrorCode, integrityTag: createIntegrityTag(nextData) },
    });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Gutschriftvorschau wurde bereits verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: loaded.draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: state === "awaiting_confirmation" ? "draft_completed_ready" : "draft_completed_blocked" });
    return current;
  });
  return toJarvisInvoiceCreditDraftView(updated, binding);
}

export async function cancelJarvisInvoiceCreditDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, now = new Date()) {
  const { draft } = await loadBoundInvoiceCreditDraft(previewId, binding, now);
  if (draft.state === "cancelled") return toJarvisInvoiceCreditDraftView(draft, binding);
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) throw new JarvisActionDraftError(draft.state === "expired" ? "expired" : "invalid_state", "Diese Gutschriftvorschau kann nicht mehr abgebrochen werden.", draft.state === "expired" ? 410 : 409);
  if (expectedRevision !== draft.revision) throw new JarvisActionDraftError("conflict", "Die Gutschriftvorschau wurde zwischenzeitlich verändert.", 409);
  const nextData: DraftIntegrityData = { ...draft, state: "cancelled", cancelledAt: now, lastErrorCode: null };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: { id: draft.id, revision: draft.revision, state: draft.state, integrityTag: draft.integrityTag },
      data: { state: "cancelled", cancelledAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(nextData) },
    });
    if (changed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Gutschriftvorschau wurde bereits verändert.", 409);
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({ where: { id: draft.id } });
    await appendAuditEvent(tx, { draft: current, eventType: "draft_cancelled", reasonCode: "user_cancelled" });
    return current;
  });
  return toJarvisInvoiceCreditDraftView(cancelled, binding);
}

export async function confirmJarvisInvoiceCreditDraft(previewId: string, binding: JarvisTaskDraftBinding, expectedRevision: number, confirmationText: string, now = new Date()) {
  const loaded = await loadBoundInvoiceCreditDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") return toJarvisInvoiceCreditDraftView(loaded.draft, binding);
  const requiredText = getInvoiceCreditConfirmationText(loaded.context.invoice.invoiceNumber, loaded.context.creditNumber, loaded.context.totalCreditGross);
  if (!matchesInvoiceCreditConfirmation(loaded.context.invoice.invoiceNumber, loaded.context.creditNumber, loaded.context.totalCreditGross, confirmationText)) {
    throw new JarvisActionDraftError("invalid_input", `Gib zur kritischen Bestätigung exakt „${requiredText}“ ein.`, 400);
  }
  if (expectedRevision !== loaded.draft.revision || loaded.draft.state !== "awaiting_confirmation") throw new JarvisActionDraftError("conflict", "Nur die aktuelle, vollständig geprüfte Gutschriftvorschau darf bestätigt werden.", 409);
  if (!mayCreateInvoiceCredit(binding)) throw new JarvisActionDraftError("scope_mismatch", "Diese Rollenkombination darf keine Teilgutschrift erstellen.", 403);
  try {
    const executed = await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({ where: { id: loaded.draft.id } });
      if (!current) throw new JarvisActionDraftError("not_found", "Die Gutschriftvorschau wurde nicht gefunden.", 404);
      const parsed = validateInvoiceCreditBinding(current, binding);
      if (current.state === "executed") return current;
      if (current.state !== "awaiting_confirmation" || current.expiresAt.getTime() <= now.getTime()) throw new JarvisActionDraftError(current.expiresAt.getTime() <= now.getTime() ? "expired" : "conflict", "Die Gutschriftvorschau ist nicht mehr ausführbar.", current.expiresAt.getTime() <= now.getTime() ? 410 : 409);
      const actor = await tx.user.findFirst({ where: { id: current.effectiveActorId, organizationId: binding.organizationId, isActive: true }, select: { id: true, role: true, firstName: true, lastName: true, email: true } });
      if (!actor || !canManageInvoices(actor)) throw new JarvisActionDraftError("role_changed", "Akteur oder Rechnungsberechtigung sind nicht mehr aktuell.", 409);
      const claimedData: DraftIntegrityData = { ...current, state: "executing", confirmedAt: now, lastErrorCode: null };
      const claimed = await tx.jarvisActionDraft.updateMany({ where: { id: current.id, revision: current.revision, state: "awaiting_confirmation", integrityTag: current.integrityTag }, data: { state: "executing", confirmedAt: now, lastErrorCode: null, integrityTag: createIntegrityTag(claimedData) } });
      if (claimed.count !== 1) throw new JarvisActionDraftError("conflict", "Die Gutschrift wird bereits erstellt.", 409);
      const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
      const result = await createInvoiceCredit({
        tx, organizationId: binding.organizationId, invoiceId: parsed.payload.invoiceId,
        actorName, actorUserId: actor.id, reason: parsed.payload.reason, items: parsed.payload.items,
        expectedFingerprint: parsed.context.fingerprint, source: "jarvis",
      });
      const executedAt = new Date();
      const executedData: DraftIntegrityData = { ...claimedData, state: "executed", executedAt, resultEntityType: "invoice", resultEntityId: result.creditInvoice.id };
      const finalDraft = await tx.jarvisActionDraft.update({ where: { id: current.id }, data: { state: "executed", executedAt, resultEntityType: "invoice", resultEntityId: result.creditInvoice.id, integrityTag: createIntegrityTag(executedData) } });
      await appendAuditEvent(tx, { draft: finalDraft, eventType: "draft_confirmed_and_executed", result: { id: result.creditInvoice.id, entityType: "invoice" } });
      return finalDraft;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await externalizeJarvisDocumentPdf({
      organizationId: binding.organizationId,
      kind: "invoice",
      entityId: executed.resultEntityId,
      actorUserId: executed.effectiveActorId,
    });
    return toJarvisInvoiceCreditDraftView(executed, binding);
  } catch (error) {
    if (error instanceof JarvisActionDraftError && error.code === "conflict") {
      const latest = await loadBoundInvoiceCreditDraft(previewId, binding, now);
      if (latest.draft.state === "executed") return toJarvisInvoiceCreditDraftView(latest.draft, binding);
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof InvoiceCreditServiceError) throw new JarvisActionDraftError(error.code === "stale_context" ? "stale_context" : "invalid_input", error.message, 409);
    throw new JarvisActionDraftError("execution_failed", "Die Teilgutschrift wurde nicht erstellt und die Vorschau bleibt zur Prüfung erhalten.", 500);
  }
}

function maySendOfferDelivery(binding: JarvisTaskDraftBinding) {
  return (
    canSendOfferDocuments(binding.profile.sessionActor) &&
    canSendOfferDocuments(binding.profile.effectiveActor)
  );
}

function validateOfferDeliveryBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Angebotsversandfreigabe gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.",
      403
    );
  }
  if (
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role
  ) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Die Rolle hat sich seit der Angebotsprüfung geändert. Bitte erstelle eine neue Versandfreigabe.",
      409
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Integritätsnachweis der Angebotsversandfreigabe ist ungültig.",
      409
    );
  }
  const payload = offerDeliveryPayloadSchema.safeParse(draft.payload);
  const context = offerDeliveryContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "offer.send" ||
    !payload.success ||
    !context.success ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash ||
    hashJson(payload.data) !== hashJson(context.data.payload)
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Angebotsversanddaten oder Prüfkontext stimmen nicht mit dem Integritätsnachweis überein.",
      409
    );
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundOfferDeliveryDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({
    where: { id: previewId },
  });
  if (!found) {
    throw new JarvisActionDraftError(
      "not_found",
      "Die Angebotsversandfreigabe wurde nicht gefunden.",
      404
    );
  }
  validateOfferDeliveryBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateOfferDeliveryBinding(current, binding);
  return { draft: current, ...parsed };
}

function toJarvisOfferDeliveryDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): JarvisOfferDeliveryDraftView {
  const { payload, context } = validateOfferDeliveryBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = maySendOfferDelivery(binding);
  const uncertain =
    state === "executing" && draft.lastErrorCode === "delivery_uncertain";
  const ready =
    state === "awaiting_confirmation" &&
    permitted &&
    context.blockingIssues.length === 0;
  const reason: JarvisOfferDeliveryDraftView["confirmation"]["reason"] =
    state === "expired"
      ? "expired"
      : state === "cancelled"
        ? "cancelled"
        : state === "executed"
          ? "executed"
          : uncertain
            ? "uncertain"
            : state === "executing"
              ? "executing"
              : !permitted
                ? "not_permitted"
                : context.blockingIssues.length
                  ? "blocked"
                  : "ready";
  const currency = (value: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  return {
    version: 2,
    previewId: draft.id,
    actionId: "offer.send",
    title: "Angebot kontrolliert versenden",
    badge:
      state === "executed"
        ? "Versendet"
        : uncertain
          ? "Versand unklar"
          : state === "executing"
            ? "Wird versendet"
            : state === "cancelled"
              ? "Abgebrochen"
              : state === "expired"
                ? "Abgelaufen"
                : ready
                  ? "Bereit"
                  : "Prüfung",
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    offerId: context.offer.id,
    projectId: context.offer.projectId,
    fields: [
      { label: "Angebot", value: context.offer.offerNumber },
      {
        label: "Projekt",
        value: `${context.offer.projectNumber} · ${context.offer.projectTitle}`,
      },
      { label: "Kunde", value: context.offer.customerName || "–" },
      { label: "Absender", value: context.sender.email || "–" },
      { label: "Netto", value: currency(context.offer.netTotal) },
      { label: "Brutto", value: currency(context.offer.grossTotal) },
    ],
    editor: {
      to: payload.to.join(", "),
      cc: payload.cc.join(", "),
      bcc: payload.bcc.join(", "),
      subject: payload.subject,
      body: payload.body,
      includeAcceptanceLink: payload.includeAcceptanceLink,
    },
    attachments: context.attachments,
    checks: context.checks,
    warnings: context.warnings,
    blockingIssues: [
      ...context.blockingIssues,
      ...(!permitted
        ? ["Angebotsversand ist für diese Rollenkombination nicht freigegeben."]
        : []),
      ...(uncertain
        ? [
            "Der Zustellstatus ist technisch unklar. Nicht automatisch erneut senden; zuerst Microsoft 365 und Versandprotokoll prüfen.",
          ]
        : []),
    ],
    confirmation: {
      enabled: ready,
      reason,
      requiredText: getOfferDeliveryConfirmationText(
        context.offer.offerNumber,
        payload.to[0] || ""
      ),
    },
    cancellation: {
      enabled:
        state === "awaiting_input" || state === "awaiting_confirmation",
    },
    ...(state === "executed" && draft.resultEntityId
      ? {
          result: {
            entityType: "documentMailDispatch" as const,
            entityId: draft.resultEntityId,
            label: "Versand protokolliert",
          },
        }
      : {}),
  };
}

export async function createPersistedJarvisOfferDeliveryDraft(input: {
  preview: JarvisActionPreview<"offer.send">;
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  now?: Date;
}) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für einen Angebotsversand ist eine aktuelle serverseitige Sitzung erforderlich.",
      401
    );
  }
  if (!maySendOfferDelivery(input)) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Rollenkombination darf kein Angebot versenden.",
      403
    );
  }
  const actorUserId = input.profile.effectiveActor.id;
  if (!actorUserId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für einen Angebotsversand ist eine eindeutig zugeordnete Sitzung erforderlich.",
      401
    );
  }
  let evaluation: OfferDeliveryEvaluation;
  try {
    evaluation = await evaluateOfferDelivery({
      organizationId: input.organizationId,
      actorUserId,
      offerId: input.preview.payload.offerId,
    });
  } catch (error) {
    if (error instanceof OfferDeliveryServiceError) {
      throw new JarvisActionDraftError(
        error.code === "not_found" ? "not_found" : "invalid_input",
        error.message,
        error.code === "not_found" ? 404 : 409
      );
    }
    throw error;
  }
  const payload = offerDeliveryPayloadSchema.parse(evaluation.payload);
  const context = offerDeliveryContextSchema.parse(evaluation);
  const actorIds = getActorIds(input.profile);
  const now = input.now ?? new Date();
  const state = context.blockingIssues.length
    ? "awaiting_input"
    : "awaiting_confirmation";
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId,
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId: "offer.send",
    state,
    revision: 1,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_OFFER_DRAFT_TTL_MS),
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode: context.blockingIssues.length ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag: createIntegrityTag(draftData),
      },
    });
    await appendAuditEvent(tx, {
      draft,
      eventType: context.blockingIssues.length
        ? "draft_created_blocked"
        : "draft_created_ready",
    });
    return draft;
  });
  return toJarvisOfferDeliveryDraftView(created, input);
}

export async function getJarvisOfferDeliveryDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundOfferDeliveryDraft(previewId, binding, now);
  return toJarvisOfferDeliveryDraftView(draft, binding);
}

export async function completeJarvisOfferDeliveryDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  rawInput: unknown,
  now = new Date()
) {
  const completed = z
    .object({
      revision: z.number().int().min(1),
      to: z.union([z.string(), z.array(z.string())]),
      cc: z.union([z.string(), z.array(z.string())]).optional(),
      bcc: z.union([z.string(), z.array(z.string())]).optional(),
      subject: z.string(),
      body: z.string(),
      includeAcceptanceLink: z.boolean(),
    })
    .strict()
    .safeParse(rawInput);
  if (!completed.success) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Empfänger, Betreff, Nachricht und Annahmelink-Entscheidung müssen vollständig angegeben werden.",
      400
    );
  }
  const loaded = await loadBoundOfferDeliveryDraft(previewId, binding, now);
  if (!OPEN_DRAFT_STATES.includes(loaded.draft.state as never)) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "invalid_state",
      "Diese Angebotsversandfreigabe kann nicht mehr bearbeitet werden.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  if (completed.data.revision !== loaded.draft.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Die Angebotsversandfreigabe wurde zwischenzeitlich verändert.",
      409
    );
  }
  let payload;
  let evaluation;
  try {
    payload = normalizeOfferDeliveryPayload({
      offerId: loaded.payload.offerId,
      ...completed.data,
    });
    evaluation = await evaluateOfferDelivery({
      organizationId: binding.organizationId,
      actorUserId: loaded.draft.effectiveActorId,
      offerId: loaded.payload.offerId,
      payload,
    });
  } catch (error) {
    if (error instanceof OfferDeliveryServiceError) {
      throw new JarvisActionDraftError(
        error.code === "not_found" ? "not_found" : "invalid_input",
        error.message,
        error.code === "not_found" ? 404 : 409
      );
    }
    throw error;
  }
  const context = offerDeliveryContextSchema.parse(evaluation);
  const state = context.blockingIssues.length
    ? "awaiting_input"
    : "awaiting_confirmation";
  const revision = loaded.draft.revision + 1;
  const nextData: DraftIntegrityData = {
    ...loaded.draft,
    state,
    revision,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    lastErrorCode: context.blockingIssues.length ? "invalid_input" : null,
  };
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: loaded.draft.id,
        revision: loaded.draft.revision,
        state: loaded.draft.state,
        integrityTag: loaded.draft.integrityTag,
      },
      data: {
        state,
        revision,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        payloadHash: nextData.payloadHash,
        contextHash: nextData.contextHash,
        lastErrorCode: nextData.lastErrorCode,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Die Angebotsversandfreigabe wurde zwischenzeitlich verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: loaded.draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: context.blockingIssues.length
        ? "draft_validation_failed"
        : "draft_recalculated",
      ...(context.blockingIssues.length
        ? { reasonCode: "invalid_input" }
        : {}),
    });
    return current;
  });
  return toJarvisOfferDeliveryDraftView(updated, binding);
}

export async function cancelJarvisOfferDeliveryDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const { draft } = await loadBoundOfferDeliveryDraft(previewId, binding, now);
  if (draft.state === "cancelled") {
    return toJarvisOfferDeliveryDraftView(draft, binding);
  }
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) {
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "invalid_state",
      "Diese Angebotsversandfreigabe kann nicht mehr abgebrochen werden.",
      draft.state === "expired" ? 410 : 409
    );
  }
  if (expectedRevision !== draft.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Die Angebotsversandfreigabe wurde zwischenzeitlich verändert.",
      409
    );
  }
  const nextData: DraftIntegrityData = {
    ...draft,
    state: "cancelled",
    cancelledAt: now,
    lastErrorCode: null,
  };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "cancelled",
        cancelledAt: now,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Die Angebotsversandfreigabe wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_cancelled",
      reasonCode: "user_cancelled",
    });
    return current;
  });
  return toJarvisOfferDeliveryDraftView(cancelled, binding);
}

async function markOfferDeliveryDraftFailure(
  draftId: string,
  binding: JarvisTaskDraftBinding,
  code: string
) {
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({
        where: { id: draftId },
      });
      if (!current || current.state !== "executing" || !integrityMatches(current)) {
        return;
      }
      const nextData: DraftIntegrityData = { ...current, lastErrorCode: code };
      const changed = await tx.jarvisActionDraft.updateMany({
        where: {
          id: current.id,
          state: "executing",
          integrityTag: current.integrityTag,
        },
        data: {
          lastErrorCode: code,
          integrityTag: createIntegrityTag(nextData),
        },
      });
      if (changed.count !== 1) return;
      const updated = await tx.jarvisActionDraft.findUniqueOrThrow({
        where: { id: current.id },
      });
      validateOfferDeliveryBinding(updated, binding);
      await appendAuditEvent(tx, {
        draft: updated,
        eventType:
          code === "delivery_uncertain"
            ? "delivery_status_uncertain"
            : "execution_failed",
        reasonCode: code,
      });
    });
  } catch {
    // Der ursprüngliche Versandfehler bleibt maßgeblich.
  }
}

export async function confirmJarvisOfferDeliveryDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  confirmationText: string,
  request: Request,
  now = new Date()
) {
  const loaded = await loadBoundOfferDeliveryDraft(previewId, binding, now);
  if (loaded.draft.state === "executed") {
    return toJarvisOfferDeliveryDraftView(loaded.draft, binding);
  }
  if (
    !matchesOfferDeliveryConfirmation(
      loaded.context.offer.offerNumber,
      loaded.payload.to[0] || "",
      confirmationText
    )
  ) {
    throw new JarvisActionDraftError(
      "invalid_input",
      `Gib zur kritischen Bestätigung exakt „${getOfferDeliveryConfirmationText(
        loaded.context.offer.offerNumber,
        loaded.payload.to[0] || ""
      )}“ ein.`,
      400
    );
  }
  if (
    expectedRevision !== loaded.draft.revision ||
    loaded.draft.state !== "awaiting_confirmation"
  ) {
    throw new JarvisActionDraftError(
      "conflict",
      "Nur die aktuelle, vollständig geprüfte Angebotsversandfreigabe darf bestätigt werden.",
      409
    );
  }
  if (!maySendOfferDelivery(binding)) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Rollenkombination darf kein Angebot versenden.",
      403
    );
  }
  let claimed: JarvisActionDraft | undefined;
  try {
    claimed = await prisma.$transaction(
      async (tx) => {
        const current = await tx.jarvisActionDraft.findUnique({
          where: { id: loaded.draft.id },
        });
        if (!current) {
          throw new JarvisActionDraftError(
            "not_found",
            "Die Angebotsversandfreigabe wurde nicht gefunden.",
            404
          );
        }
        const parsed = validateOfferDeliveryBinding(current, binding);
        if (current.state === "executed") return current;
        if (
          current.state !== "awaiting_confirmation" ||
          current.expiresAt.getTime() <= now.getTime()
        ) {
          throw new JarvisActionDraftError(
            current.expiresAt.getTime() <= now.getTime()
              ? "expired"
              : "conflict",
            "Die Angebotsversandfreigabe ist nicht mehr ausführbar.",
            current.expiresAt.getTime() <= now.getTime() ? 410 : 409
          );
        }
        const actor = await tx.user.findFirst({
          where: {
            id: current.effectiveActorId,
            organizationId: binding.organizationId,
            isActive: true,
          },
        });
        if (!actor || !canSendOfferDocuments(actor)) {
          throw new JarvisActionDraftError(
            "role_changed",
            "Absender oder Angebotsversandberechtigung sind nicht mehr aktuell.",
            409
          );
        }
        if (parsed.context.blockingIssues.length) {
          throw new JarvisActionDraftError(
            "invalid_input",
            parsed.context.blockingIssues.join(" · "),
            409
          );
        }
        const claimedData: DraftIntegrityData = {
          ...current,
          state: "executing",
          confirmedAt: now,
          lastErrorCode: null,
        };
        const changed = await tx.jarvisActionDraft.updateMany({
          where: {
            id: current.id,
            revision: current.revision,
            state: "awaiting_confirmation",
            integrityTag: current.integrityTag,
          },
          data: {
            state: "executing",
            confirmedAt: now,
            lastErrorCode: null,
            integrityTag: createIntegrityTag(claimedData),
          },
        });
        if (changed.count !== 1) {
          throw new JarvisActionDraftError(
            "conflict",
            "Der Angebotsversand wird bereits ausgeführt.",
            409
          );
        }
        return tx.jarvisActionDraft.findUniqueOrThrow({
          where: { id: current.id },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    if (claimed.state === "executed") {
      return toJarvisOfferDeliveryDraftView(claimed, binding);
    }
    const parsed = validateOfferDeliveryBinding(claimed, binding);
    const delivery = await sendOfferDelivery({
      organizationId: binding.organizationId,
      actorUserId: claimed.effectiveActorId,
      dispatchId: claimed.id,
      offerId: parsed.payload.offerId,
      payload: parsed.payload,
      expectedFingerprint: parsed.context.fingerprint,
      request,
    });
    const executedAt = new Date();
    const executedData: DraftIntegrityData = {
      ...claimed,
      state: "executed",
      executedAt,
      resultEntityType: "documentMailDispatch",
      resultEntityId: delivery.dispatch.id,
      lastErrorCode: null,
    };
    const executed = await prisma.$transaction(async (tx) => {
      const changed = await tx.jarvisActionDraft.updateMany({
        where: {
          id: claimed!.id,
          state: "executing",
          integrityTag: claimed!.integrityTag,
        },
        data: {
          state: "executed",
          executedAt,
          resultEntityType: "documentMailDispatch",
          resultEntityId: delivery.dispatch.id,
          lastErrorCode: null,
          integrityTag: createIntegrityTag(executedData),
        },
      });
      if (changed.count !== 1) {
        throw new OfferDeliveryServiceError(
          "delivery_uncertain",
          "Microsoft 365 hat den Versand angenommen, aber der JARVIS-Abschlussstatus ist technisch unklar. Nicht erneut senden."
        );
      }
      const current = await tx.jarvisActionDraft.findUniqueOrThrow({
        where: { id: claimed!.id },
      });
      await appendAuditEvent(tx, {
        draft: current,
        eventType: "draft_confirmed_and_executed",
        result: {
          id: delivery.dispatch.id,
          entityType: "documentMailDispatch",
        },
      });
      return current;
    });
    return toJarvisOfferDeliveryDraftView(executed, binding);
  } catch (error) {
    const code =
      error instanceof OfferDeliveryServiceError
        ? error.code
        : "execution_failed";
    if (claimed) {
      await markOfferDeliveryDraftFailure(
        claimed.id,
        binding,
        code === "delivery_uncertain"
          ? "delivery_uncertain"
          : "delivery_failed"
      );
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof OfferDeliveryServiceError) {
      throw new JarvisActionDraftError(
        error.code === "delivery_uncertain"
          ? "conflict"
          : error.code === "stale_context"
            ? "stale_context"
            : "execution_failed",
        error.message,
        error.code === "delivery_uncertain" || error.code === "stale_context"
          ? 409
          : 500
      );
    }
    throw new JarvisActionDraftError(
      "execution_failed",
      "Das Angebot wurde nicht versendet. Der Entwurf bleibt zur technischen Prüfung gesperrt.",
      500
    );
  }
}

function maySendInvoiceDelivery(binding: JarvisTaskDraftBinding) {
  return (
    canSendInvoiceDocuments(binding.profile.sessionActor) &&
    canSendInvoiceDocuments(binding.profile.effectiveActor)
  );
}

function validateInvoiceDeliveryBinding(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
) {
  const actorIds = getActorIds(binding.profile);
  if (
    draft.organizationId !== binding.organizationId ||
    draft.sessionId !== binding.sessionId ||
    draft.sessionActorId !== actorIds.sessionActorId ||
    draft.effectiveActorId !== actorIds.effectiveActorId ||
    draft.impersonating !== binding.profile.isImpersonating
  ) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Versandfreigabe gehört nicht zur aktuellen Organisation, Sitzung oder wirksamen Identität.",
      403
    );
  }
  if (
    draft.sessionActorRole !== binding.profile.sessionActor.role ||
    draft.effectiveActorRole !== binding.profile.effectiveActor.role
  ) {
    throw new JarvisActionDraftError(
      "role_changed",
      "Die Rolle hat sich seit der Dokumentprüfung geändert. Bitte erstelle eine neue Versandfreigabe.",
      409
    );
  }
  if (!integrityMatches(draft)) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Der Integritätsnachweis der Versandfreigabe ist ungültig.",
      409
    );
  }
  const payload = invoiceDeliveryPayloadSchema.safeParse(draft.payload);
  const context = invoiceDeliveryContextSchema.safeParse(draft.context);
  if (
    draft.actionId !== "document.send" ||
    !payload.success ||
    !context.success ||
    hashJson(payload.data) !== draft.payloadHash ||
    hashJson(context.data) !== draft.contextHash ||
    hashJson(payload.data) !== hashJson(context.data.payload)
  ) {
    throw new JarvisActionDraftError(
      "integrity_failed",
      "Versanddaten oder Dokumentprüfkontext stimmen nicht mit dem Integritätsnachweis überein.",
      409
    );
  }
  return { payload: payload.data, context: context.data };
}

async function loadBoundInvoiceDeliveryDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const found = await prisma.jarvisActionDraft.findUnique({
    where: { id: previewId },
  });
  if (!found) {
    throw new JarvisActionDraftError(
      "not_found",
      "Die Versandfreigabe wurde nicht gefunden.",
      404
    );
  }
  validateInvoiceDeliveryBinding(found, binding);
  const current = await expireDraftIfNeeded(found, now);
  const parsed = validateInvoiceDeliveryBinding(current, binding);
  return { draft: current, ...parsed };
}

function toJarvisInvoiceDeliveryDraftView(
  draft: JarvisActionDraft,
  binding: JarvisTaskDraftBinding
): JarvisInvoiceDeliveryDraftView {
  const { payload, context } = validateInvoiceDeliveryBinding(draft, binding);
  const state = draft.state as JarvisTaskActionDraftState;
  const permitted = maySendInvoiceDelivery(binding);
  const uncertain =
    state === "executing" && draft.lastErrorCode === "delivery_uncertain";
  const ready =
    state === "awaiting_confirmation" &&
    permitted &&
    context.blockingIssues.length === 0;
  const reason: JarvisInvoiceDeliveryDraftView["confirmation"]["reason"] =
    state === "expired"
      ? "expired"
      : state === "cancelled"
        ? "cancelled"
        : state === "executed"
          ? "executed"
          : uncertain
            ? "uncertain"
            : state === "executing"
              ? "executing"
              : !permitted
                ? "not_permitted"
                : context.blockingIssues.length
                  ? "blocked"
                  : "ready";
  const currency = (value: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  return {
    version: 2,
    previewId: draft.id,
    actionId: "document.send",
    title: "Rechnung und Versand kontrolliert freigeben",
    badge:
      state === "executed"
        ? "Versendet"
        : uncertain
          ? "Versand unklar"
          : state === "executing"
            ? "Wird versendet"
            : state === "cancelled"
              ? "Abgebrochen"
              : state === "expired"
                ? "Abgelaufen"
                : ready
                  ? "Bereit"
                  : "Prüfung",
    state,
    revision: draft.revision,
    expiresAt: draft.expiresAt.toISOString(),
    invoiceId: context.invoice.id,
    projectId: context.invoice.projectId,
    fields: [
      { label: "Rechnung", value: context.invoice.invoiceNumber },
      {
        label: "Projekt",
        value: `${context.invoice.projectNumber} · ${context.invoice.projectTitle}`,
      },
      { label: "Kunde", value: context.invoice.customerName || "–" },
      { label: "Absender", value: context.sender.email || "–" },
      { label: "Netto", value: currency(context.invoice.netTotal) },
      { label: "Brutto", value: currency(context.invoice.grossTotal) },
    ],
    editor: {
      to: payload.to.join(", "),
      cc: payload.cc.join(", "),
      bcc: payload.bcc.join(", "),
      subject: payload.subject,
      body: payload.body,
      format: payload.format,
      formatOptions: [
        { value: "pdf", label: "PDF" },
        { value: "xrechnung", label: "XRechnung XML" },
        { value: "pdf-xrechnung", label: "PDF + XRechnung" },
        { value: "zugferd", label: "ZUGFeRD PDF" },
      ],
    },
    attachments: context.attachments,
    validation: {
      technical: context.validation.technical
        ? {
            valid: context.validation.technical.valid,
            issues: context.validation.technical.issues.map(
              (issue) => issue.message
            ),
          }
        : null,
      kosit: context.validation.kosit
        ? {
            available: context.validation.kosit.available,
            valid: context.validation.kosit.valid,
            message: context.validation.kosit.message,
          }
        : null,
      zugferd: context.validation.zugferd,
    },
    warnings: context.warnings,
    blockingIssues: [
      ...context.blockingIssues,
      ...(!permitted
        ? ["Rechnungsversand ist für diese Rollenkombination nicht freigegeben."]
        : []),
      ...(uncertain
        ? [
            "Der Zustellstatus ist technisch unklar. Nicht automatisch erneut senden; zuerst Microsoft 365 und Versandprotokoll prüfen.",
          ]
        : []),
    ],
    confirmation: {
      enabled: ready,
      reason,
      requiredText: getInvoiceDeliveryConfirmationText(
        context.invoice.invoiceNumber,
        payload.to[0] || ""
      ),
    },
    cancellation: {
      enabled:
        state === "awaiting_input" || state === "awaiting_confirmation",
    },
    ...(state === "executed" && draft.resultEntityId
      ? {
          result: {
            entityType: "documentMailDispatch" as const,
            entityId: draft.resultEntityId,
            label: "Versandprotokoll öffnen",
          },
        }
      : {}),
  };
}

export async function createPersistedJarvisInvoiceDeliveryDraft(input: {
  preview: JarvisActionPreview<"document.send">;
  organizationId: string;
  sessionId: string;
  profile: JarvisAccessProfile;
  now?: Date;
}) {
  if (!input.sessionId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für einen Rechnungsversand ist eine aktuelle serverseitige Sitzung erforderlich.",
      401
    );
  }
  if (!maySendInvoiceDelivery(input)) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Rollenkombination darf keine Rechnung versenden.",
      403
    );
  }
  const actorUserId = input.profile.effectiveActor.id;
  if (!actorUserId) {
    throw new JarvisActionDraftError(
      "session_required",
      "Für einen Rechnungsversand ist eine eindeutig zugeordnete Sitzung erforderlich.",
      401
    );
  }
  const now = input.now ?? new Date();
  let evaluation: InvoiceDeliveryEvaluation;
  try {
    evaluation = await evaluateInvoiceDelivery({
      organizationId: input.organizationId,
      actorUserId,
      invoiceId: input.preview.payload.invoiceId,
    });
  } catch (error) {
    if (error instanceof InvoiceDeliveryServiceError) {
      throw new JarvisActionDraftError(
        error.code === "not_found" ? "not_found" : "invalid_input",
        error.message,
        error.code === "not_found" ? 404 : 409
      );
    }
    throw error;
  }
  const payload = invoiceDeliveryPayloadSchema.parse(evaluation.payload);
  const context = invoiceDeliveryContextSchema.parse(evaluation);
  const actorIds = getActorIds(input.profile);
  const state =
    context.blockingIssues.length === 0
      ? "awaiting_confirmation"
      : "awaiting_input";
  const draftData: DraftIntegrityData = {
    id: input.preview.previewId,
    organizationId: input.organizationId,
    sessionId: input.sessionId,
    sessionActorId: actorIds.sessionActorId,
    sessionActorRole: input.profile.sessionActor.role,
    effectiveActorId: actorIds.effectiveActorId,
    effectiveActorRole: input.profile.effectiveActor.role,
    impersonating: input.profile.isImpersonating,
    actionId: "document.send",
    state,
    revision: 1,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    expiresAt: new Date(now.getTime() + JARVIS_INVOICE_DRAFT_TTL_MS),
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    lastErrorCode:
      context.blockingIssues.length > 0 ? "invalid_input" : null,
  };
  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.jarvisActionDraft.create({
      data: {
        ...draftData,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        integrityTag: createIntegrityTag(draftData),
      },
    });
    await appendAuditEvent(tx, {
      draft,
      eventType:
        state === "awaiting_confirmation"
          ? "draft_created_ready"
          : "draft_created_blocked",
    });
    return draft;
  });
  return toJarvisInvoiceDeliveryDraftView(created, input);
}

export async function getJarvisInvoiceDeliveryDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  now = new Date()
) {
  const { draft } = await loadBoundInvoiceDeliveryDraft(
    previewId,
    binding,
    now
  );
  return toJarvisInvoiceDeliveryDraftView(draft, binding);
}

export async function completeJarvisInvoiceDeliveryDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  rawInput: unknown,
  now = new Date()
) {
  const completed = z
    .object({
      revision: z.number().int().min(1),
      to: z.union([z.string(), z.array(z.string())]),
      cc: z.union([z.string(), z.array(z.string())]).optional(),
      bcc: z.union([z.string(), z.array(z.string())]).optional(),
      subject: z.string(),
      body: z.string(),
      format: z.enum(["pdf", "xrechnung", "pdf-xrechnung", "zugferd"]),
    })
    .strict()
    .safeParse(rawInput);
  if (!completed.success) {
    throw new JarvisActionDraftError(
      "invalid_input",
      "Empfänger, Betreff, Nachricht und Rechnungsformat müssen vollständig angegeben werden.",
      400
    );
  }
  const loaded = await loadBoundInvoiceDeliveryDraft(
    previewId,
    binding,
    now
  );
  if (!OPEN_DRAFT_STATES.includes(loaded.draft.state as never)) {
    throw new JarvisActionDraftError(
      loaded.draft.state === "expired" ? "expired" : "invalid_state",
      "Diese Versandfreigabe kann nicht mehr bearbeitet werden.",
      loaded.draft.state === "expired" ? 410 : 409
    );
  }
  if (completed.data.revision !== loaded.draft.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Die Versandfreigabe wurde zwischenzeitlich verändert.",
      409
    );
  }
  let payload;
  let evaluation;
  try {
    payload = normalizeInvoiceDeliveryPayload({
      invoiceId: loaded.payload.invoiceId,
      ...completed.data,
    });
    evaluation = await evaluateInvoiceDelivery({
      organizationId: binding.organizationId,
      actorUserId: loaded.draft.effectiveActorId,
      invoiceId: loaded.payload.invoiceId,
      payload,
    });
  } catch (error) {
    if (error instanceof InvoiceDeliveryServiceError) {
      throw new JarvisActionDraftError(
        error.code === "not_found" ? "not_found" : "invalid_input",
        error.message,
        error.code === "not_found" ? 404 : 409
      );
    }
    throw error;
  }
  const context = invoiceDeliveryContextSchema.parse(evaluation);
  const state =
    context.blockingIssues.length === 0
      ? "awaiting_confirmation"
      : "awaiting_input";
  const revision = loaded.draft.revision + 1;
  const nextData: DraftIntegrityData = {
    ...loaded.draft,
    state,
    revision,
    payloadHash: hashJson(payload),
    contextHash: hashJson(context),
    lastErrorCode:
      context.blockingIssues.length > 0 ? "invalid_input" : null,
  };
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: loaded.draft.id,
        revision: loaded.draft.revision,
        state: loaded.draft.state,
        integrityTag: loaded.draft.integrityTag,
      },
      data: {
        state,
        revision,
        payload: payload as Prisma.InputJsonValue,
        context: context as Prisma.InputJsonValue,
        payloadHash: nextData.payloadHash,
        contextHash: nextData.contextHash,
        lastErrorCode: nextData.lastErrorCode,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Die Versandfreigabe wurde zwischenzeitlich verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: loaded.draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType:
        state === "awaiting_confirmation"
          ? "draft_recalculated"
          : "draft_validation_failed",
      ...(state !== "awaiting_confirmation"
        ? { reasonCode: "invalid_input" }
        : {}),
    });
    return current;
  });
  return toJarvisInvoiceDeliveryDraftView(updated, binding);
}

export async function cancelJarvisInvoiceDeliveryDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  now = new Date()
) {
  const { draft } = await loadBoundInvoiceDeliveryDraft(
    previewId,
    binding,
    now
  );
  if (draft.state === "cancelled") {
    return toJarvisInvoiceDeliveryDraftView(draft, binding);
  }
  if (!OPEN_DRAFT_STATES.includes(draft.state as never)) {
    throw new JarvisActionDraftError(
      draft.state === "expired" ? "expired" : "invalid_state",
      "Diese Versandfreigabe kann nicht mehr abgebrochen werden.",
      draft.state === "expired" ? 410 : 409
    );
  }
  if (expectedRevision !== draft.revision) {
    throw new JarvisActionDraftError(
      "conflict",
      "Die Versandfreigabe wurde zwischenzeitlich verändert.",
      409
    );
  }
  const nextData: DraftIntegrityData = {
    ...draft,
    state: "cancelled",
    cancelledAt: now,
    lastErrorCode: null,
  };
  const cancelled = await prisma.$transaction(async (tx) => {
    const changed = await tx.jarvisActionDraft.updateMany({
      where: {
        id: draft.id,
        revision: draft.revision,
        state: draft.state,
        integrityTag: draft.integrityTag,
      },
      data: {
        state: "cancelled",
        cancelledAt: now,
        lastErrorCode: null,
        integrityTag: createIntegrityTag(nextData),
      },
    });
    if (changed.count !== 1) {
      throw new JarvisActionDraftError(
        "conflict",
        "Die Versandfreigabe wurde bereits verändert.",
        409
      );
    }
    const current = await tx.jarvisActionDraft.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await appendAuditEvent(tx, {
      draft: current,
      eventType: "draft_cancelled",
      reasonCode: "user_cancelled",
    });
    return current;
  });
  return toJarvisInvoiceDeliveryDraftView(cancelled, binding);
}

async function markInvoiceDeliveryDraftFailure(
  draftId: string,
  binding: JarvisTaskDraftBinding,
  code: string
) {
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.jarvisActionDraft.findUnique({
        where: { id: draftId },
      });
      if (
        !current ||
        current.state !== "executing" ||
        !integrityMatches(current)
      ) {
        return;
      }
      const nextData: DraftIntegrityData = {
        ...current,
        lastErrorCode: code,
      };
      const changed = await tx.jarvisActionDraft.updateMany({
        where: {
          id: current.id,
          state: "executing",
          integrityTag: current.integrityTag,
        },
        data: {
          lastErrorCode: code,
          integrityTag: createIntegrityTag(nextData),
        },
      });
      if (changed.count !== 1) return;
      const updated = await tx.jarvisActionDraft.findUniqueOrThrow({
        where: { id: current.id },
      });
      validateInvoiceDeliveryBinding(updated, binding);
      await appendAuditEvent(tx, {
        draft: updated,
        eventType:
          code === "delivery_uncertain"
            ? "delivery_status_uncertain"
            : "execution_failed",
        reasonCode: code,
      });
    });
  } catch {
    // Der ursprüngliche Versandfehler bleibt maßgeblich.
  }
}

export async function confirmJarvisInvoiceDeliveryDraft(
  previewId: string,
  binding: JarvisTaskDraftBinding,
  expectedRevision: number,
  confirmationText: string,
  request?: Request,
  now = new Date()
) {
  const loaded = await loadBoundInvoiceDeliveryDraft(
    previewId,
    binding,
    now
  );
  if (loaded.draft.state === "executed") {
    return toJarvisInvoiceDeliveryDraftView(loaded.draft, binding);
  }
  if (
    !matchesInvoiceDeliveryConfirmation(
      loaded.context.invoice.invoiceNumber,
      loaded.payload.to[0] || "",
      confirmationText
    )
  ) {
    throw new JarvisActionDraftError(
      "invalid_input",
      `Gib zur kritischen Bestätigung exakt „${getInvoiceDeliveryConfirmationText(
        loaded.context.invoice.invoiceNumber,
        loaded.payload.to[0] || ""
      )}“ ein.`,
      400
    );
  }
  if (
    expectedRevision !== loaded.draft.revision ||
    loaded.draft.state !== "awaiting_confirmation"
  ) {
    throw new JarvisActionDraftError(
      "conflict",
      "Nur die aktuelle, vollständig geprüfte Versandfreigabe darf bestätigt werden.",
      409
    );
  }
  if (!maySendInvoiceDelivery(binding)) {
    throw new JarvisActionDraftError(
      "scope_mismatch",
      "Diese Rollenkombination darf keine Rechnung versenden.",
      403
    );
  }
  let claimed: JarvisActionDraft | undefined;
  try {
    claimed = await prisma.$transaction(
      async (tx) => {
        const current = await tx.jarvisActionDraft.findUnique({
          where: { id: loaded.draft.id },
        });
        if (!current) {
          throw new JarvisActionDraftError(
            "not_found",
            "Die Versandfreigabe wurde nicht gefunden.",
            404
          );
        }
        const parsed = validateInvoiceDeliveryBinding(current, binding);
        if (current.state === "executed") return current;
        if (
          current.state !== "awaiting_confirmation" ||
          current.expiresAt.getTime() <= now.getTime()
        ) {
          throw new JarvisActionDraftError(
            current.expiresAt.getTime() <= now.getTime()
              ? "expired"
              : "conflict",
            "Die Versandfreigabe ist nicht mehr ausführbar.",
            current.expiresAt.getTime() <= now.getTime() ? 410 : 409
          );
        }
        const actor = await tx.user.findFirst({
          where: {
            id: current.effectiveActorId,
            organizationId: binding.organizationId,
            isActive: true,
          },
        });
        if (!actor || !canSendInvoiceDocuments(actor)) {
          throw new JarvisActionDraftError(
            "role_changed",
            "Absender oder Rechnungsversandberechtigung sind nicht mehr aktuell.",
            409
          );
        }
        if (parsed.context.blockingIssues.length) {
          throw new JarvisActionDraftError(
            "invalid_input",
            parsed.context.blockingIssues.join(" · "),
            409
          );
        }
        const claimedData: DraftIntegrityData = {
          ...current,
          state: "executing",
          confirmedAt: now,
          lastErrorCode: null,
        };
        const changed = await tx.jarvisActionDraft.updateMany({
          where: {
            id: current.id,
            revision: current.revision,
            state: "awaiting_confirmation",
            integrityTag: current.integrityTag,
          },
          data: {
            state: "executing",
            confirmedAt: now,
            lastErrorCode: null,
            integrityTag: createIntegrityTag(claimedData),
          },
        });
        if (changed.count !== 1) {
          throw new JarvisActionDraftError(
            "conflict",
            "Der Rechnungsversand wird bereits ausgeführt.",
            409
          );
        }
        return tx.jarvisActionDraft.findUniqueOrThrow({
          where: { id: current.id },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    const claimedDraft = claimed;
    if (claimedDraft.state === "executed") {
      return toJarvisInvoiceDeliveryDraftView(claimedDraft, binding);
    }
    const parsed = validateInvoiceDeliveryBinding(claimedDraft, binding);
    const actorName = parsed.context.sender.name || "JARVIS";
    const delivery = await sendInvoiceDelivery({
      organizationId: binding.organizationId,
      actorUserId: claimedDraft.effectiveActorId,
      actorName,
      dispatchId: claimedDraft.id,
      invoiceId: parsed.payload.invoiceId,
      payload: parsed.payload,
      expectedFingerprint: parsed.context.fingerprint,
      request,
      source: "jarvis",
    });
    const executedAt = new Date();
    const executedData: DraftIntegrityData = {
      ...claimedDraft,
      state: "executed",
      executedAt,
      resultEntityType: "documentMailDispatch",
      resultEntityId: delivery.dispatch.id,
      lastErrorCode: null,
    };
    const executed = await prisma.$transaction(async (tx) => {
      const changed = await tx.jarvisActionDraft.updateMany({
        where: {
          id: claimedDraft.id,
          state: "executing",
          integrityTag: claimedDraft.integrityTag,
        },
        data: {
          state: "executed",
          executedAt,
          resultEntityType: "documentMailDispatch",
          resultEntityId: delivery.dispatch.id,
          lastErrorCode: null,
          integrityTag: createIntegrityTag(executedData),
        },
      });
      if (changed.count !== 1) {
        throw new InvoiceDeliveryServiceError(
          "delivery_uncertain",
          "Microsoft 365 hat den Versand angenommen, aber der JARVIS-Abschlussstatus ist technisch unklar. Nicht erneut senden."
        );
      }
      const current = await tx.jarvisActionDraft.findUniqueOrThrow({
        where: { id: claimedDraft.id },
      });
      await appendAuditEvent(tx, {
        draft: current,
        eventType: "draft_confirmed_and_executed",
        result: {
          id: delivery.dispatch.id,
          entityType: "documentMailDispatch",
        },
      });
      return current;
    });
    return toJarvisInvoiceDeliveryDraftView(executed, binding);
  } catch (error) {
    const code =
      error instanceof InvoiceDeliveryServiceError
        ? error.code
        : "execution_failed";
    if (typeof claimed !== "undefined") {
      await markInvoiceDeliveryDraftFailure(
        claimed.id,
        binding,
        code === "delivery_uncertain"
          ? "delivery_uncertain"
          : "delivery_failed"
      );
    }
    if (error instanceof JarvisActionDraftError) throw error;
    if (error instanceof InvoiceDeliveryServiceError) {
      throw new JarvisActionDraftError(
        error.code === "delivery_uncertain"
          ? "conflict"
          : error.code === "stale_context"
            ? "stale_context"
            : "execution_failed",
        error.message,
        error.code === "delivery_uncertain" ||
          error.code === "stale_context"
          ? 409
          : 500
      );
    }
    throw new JarvisActionDraftError(
      "execution_failed",
      "Die Rechnung wurde nicht versendet. Der Entwurf bleibt zur technischen Prüfung gesperrt.",
      500
    );
  }
}
