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
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import {
  createJarvisActionPreview,
  type JarvisActionPreview,
  type JarvisActionPreviewPayloadMap,
  type JarvisCommunicationActionDraftView,
  type JarvisPlanningActionDraftCheck,
  type JarvisPlanningActionDraftView,
  type JarvisOfferDraftView,
  type JarvisInvoiceDraftView,
  type JarvisInvoiceFinalizationDraftView,
  type JarvisInvoicePaymentDraftView,
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
  canManagePlanningEntries,
  canManageProjectTimeEntries,
  canManageProjects,
  canManageOffers,
  canManageInvoices,
  canSendInvoiceDocuments,
} from "@/lib/permissions";
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
  createConfirmedOfferDraft,
  evaluateOfferDraft,
  loadOfferDraftWorkspace,
  OfferDraftServiceError,
  type OfferDraftInput,
} from "@/lib/offers/offer-draft-service";
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
        | "taskComment";
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
  if (draft?.actionId === "invoice.finalize") {
    return getJarvisInvoiceFinalizationDraft(previewId, binding, now);
  }
  if (draft?.actionId === "invoice.mark-paid") {
    return getJarvisInvoicePaymentDraft(previewId, binding, now);
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
