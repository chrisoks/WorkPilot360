import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDemoContext: vi.fn(),
  getSessionBoundActor: vi.fn(),
  sessionBoundActorResponse: vi.fn(),
  createJarvisAccessProfile: vi.fn(),
  getJarvisActionDraft: vi.fn(),
  completeJarvisTaskDraft: vi.fn(),
  cancelJarvisTaskDraft: vi.fn(),
  confirmJarvisTaskDraft: vi.fn(),
  cancelJarvisTimeManagementDraft: vi.fn(),
  confirmJarvisTimeManagementDraft: vi.fn(),
  cancelJarvisPlanningMoveDraft: vi.fn(),
  confirmJarvisPlanningMoveDraft: vi.fn(),
  cancelJarvisPlanningRequestDecisionDraft: vi.fn(),
  confirmJarvisPlanningRequestDecisionDraft: vi.fn(),
  cancelJarvisProjectMasterDataDraft: vi.fn(),
  confirmJarvisProjectMasterDataDraft: vi.fn(),
  cancelJarvisProjectStatusDraft: vi.fn(),
  confirmJarvisProjectStatusDraft: vi.fn(),
  cancelJarvisProjectLifecycleDraft: vi.fn(),
  confirmJarvisProjectLifecycleDraft: vi.fn(),
  cancelJarvisOnlineRequestConversionDraft: vi.fn(),
  confirmJarvisOnlineRequestConversionDraft: vi.fn(),
  cancelJarvisStampSessionTransitionDraft: vi.fn(),
  confirmJarvisStampSessionTransitionDraft: vi.fn(),
  cancelJarvisContactManagementDraft: vi.fn(),
  confirmJarvisContactManagementDraft: vi.fn(),
  cancelJarvisContactDeletionDraft: vi.fn(),
  confirmJarvisContactDeletionDraft: vi.fn(),
  cancelJarvisCatalogManagementDraft: vi.fn(),
  confirmJarvisCatalogManagementDraft: vi.fn(),
  cancelJarvisPersonnelManagementDraft: vi.fn(),
  confirmJarvisPersonnelManagementDraft: vi.fn(),
  cancelJarvisEmployeeCostManagementDraft: vi.fn(),
  confirmJarvisEmployeeCostManagementDraft: vi.fn(),
  cancelJarvisBulkUpdateDraft: vi.fn(),
  confirmJarvisBulkUpdateDraft: vi.fn(),
  cancelJarvisAutomationManagementDraft: vi.fn(),
  confirmJarvisAutomationManagementDraft: vi.fn(),
  completeJarvisPlanningDraft: vi.fn(),
  cancelJarvisPlanningDraft: vi.fn(),
  confirmJarvisPlanningDraft: vi.fn(),
  completeJarvisOfferDraft: vi.fn(),
  cancelJarvisOfferDraft: vi.fn(),
  confirmJarvisOfferDraft: vi.fn(),
  completeJarvisOfferDeliveryDraft: vi.fn(),
  cancelJarvisOfferDeliveryDraft: vi.fn(),
  confirmJarvisOfferDeliveryDraft: vi.fn(),
  completeJarvisInvoiceDraft: vi.fn(),
  cancelJarvisInvoiceDraft: vi.fn(),
  confirmJarvisInvoiceDraft: vi.fn(),
  cancelJarvisInvoiceFinalizationDraft: vi.fn(),
  confirmJarvisInvoiceFinalizationDraft: vi.fn(),
  completeJarvisInvoicePaymentDraft: vi.fn(),
  cancelJarvisInvoicePaymentDraft: vi.fn(),
  confirmJarvisInvoicePaymentDraft: vi.fn(),
  completeJarvisInvoiceReminderDraft: vi.fn(),
  cancelJarvisInvoiceReminderDraft: vi.fn(),
  confirmJarvisInvoiceReminderDraft: vi.fn(),
  completeJarvisInvoiceCancellationDraft: vi.fn(),
  cancelJarvisInvoiceCancellationDraft: vi.fn(),
  confirmJarvisInvoiceCancellationDraft: vi.fn(),
  completeJarvisInvoiceCreditDraft: vi.fn(),
  cancelJarvisInvoiceCreditDraft: vi.fn(),
  confirmJarvisInvoiceCreditDraft: vi.fn(),
  cancelJarvisInvoiceLifecycleDraft: vi.fn(),
  confirmJarvisInvoiceLifecycleDraft: vi.fn(),
  completeJarvisInvoiceDeliveryDraft: vi.fn(),
  cancelJarvisInvoiceDeliveryDraft: vi.fn(),
  confirmJarvisInvoiceDeliveryDraft: vi.fn(),
  completeJarvisTimeDraft: vi.fn(),
  cancelJarvisTimeDraft: vi.fn(),
  confirmJarvisTimeDraft: vi.fn(),
  completeJarvisWinterCalculationDraft: vi.fn(),
  cancelJarvisWinterCalculationDraft: vi.fn(),
  confirmJarvisWinterCalculationDraft: vi.fn(),
  completeJarvisVehicleTripCalculationDraft: vi.fn(),
  cancelJarvisVehicleTripCalculationDraft: vi.fn(),
  confirmJarvisVehicleTripCalculationDraft: vi.fn(),
  executePlanningBatch: vi.fn(),
}));

vi.mock("@/lib/demo/context", () => ({
  getDemoContext: mocks.getDemoContext,
}));
vi.mock("@/lib/auth/actor", () => ({
  getSessionBoundActor: mocks.getSessionBoundActor,
  sessionBoundActorResponse: mocks.sessionBoundActorResponse,
}));
vi.mock("@/lib/jarvis/security", () => ({
  createJarvisAccessProfile: mocks.createJarvisAccessProfile,
}));
vi.mock("@/lib/jarvis/action-draft-store", () => ({
  getJarvisActionDraft: mocks.getJarvisActionDraft,
  completeJarvisTaskDraft: mocks.completeJarvisTaskDraft,
  cancelJarvisTaskDraft: mocks.cancelJarvisTaskDraft,
  confirmJarvisTaskDraft: mocks.confirmJarvisTaskDraft,
  cancelJarvisTimeManagementDraft: mocks.cancelJarvisTimeManagementDraft,
  confirmJarvisTimeManagementDraft: mocks.confirmJarvisTimeManagementDraft,
  cancelJarvisPlanningMoveDraft: mocks.cancelJarvisPlanningMoveDraft,
  confirmJarvisPlanningMoveDraft: mocks.confirmJarvisPlanningMoveDraft,
  cancelJarvisPlanningRequestDecisionDraft: mocks.cancelJarvisPlanningRequestDecisionDraft,
  confirmJarvisPlanningRequestDecisionDraft: mocks.confirmJarvisPlanningRequestDecisionDraft,
  cancelJarvisProjectMasterDataDraft: mocks.cancelJarvisProjectMasterDataDraft,
  confirmJarvisProjectMasterDataDraft: mocks.confirmJarvisProjectMasterDataDraft,
  cancelJarvisProjectStatusDraft: mocks.cancelJarvisProjectStatusDraft,
  confirmJarvisProjectStatusDraft: mocks.confirmJarvisProjectStatusDraft,
  cancelJarvisProjectLifecycleDraft: mocks.cancelJarvisProjectLifecycleDraft,
  confirmJarvisProjectLifecycleDraft: mocks.confirmJarvisProjectLifecycleDraft,
  cancelJarvisOnlineRequestConversionDraft:
    mocks.cancelJarvisOnlineRequestConversionDraft,
  confirmJarvisOnlineRequestConversionDraft:
    mocks.confirmJarvisOnlineRequestConversionDraft,
  cancelJarvisStampSessionTransitionDraft:
    mocks.cancelJarvisStampSessionTransitionDraft,
  confirmJarvisStampSessionTransitionDraft:
    mocks.confirmJarvisStampSessionTransitionDraft,
  cancelJarvisContactManagementDraft: mocks.cancelJarvisContactManagementDraft,
  confirmJarvisContactManagementDraft: mocks.confirmJarvisContactManagementDraft,
  cancelJarvisContactDeletionDraft: mocks.cancelJarvisContactDeletionDraft,
  confirmJarvisContactDeletionDraft: mocks.confirmJarvisContactDeletionDraft,
  cancelJarvisCatalogManagementDraft: mocks.cancelJarvisCatalogManagementDraft,
  confirmJarvisCatalogManagementDraft: mocks.confirmJarvisCatalogManagementDraft,
  cancelJarvisPersonnelManagementDraft: mocks.cancelJarvisPersonnelManagementDraft,
  confirmJarvisPersonnelManagementDraft: mocks.confirmJarvisPersonnelManagementDraft,
  cancelJarvisEmployeeCostManagementDraft: mocks.cancelJarvisEmployeeCostManagementDraft,
  confirmJarvisEmployeeCostManagementDraft: mocks.confirmJarvisEmployeeCostManagementDraft,
  cancelJarvisBulkUpdateDraft: mocks.cancelJarvisBulkUpdateDraft,
  confirmJarvisBulkUpdateDraft: mocks.confirmJarvisBulkUpdateDraft,
  cancelJarvisAutomationManagementDraft: mocks.cancelJarvisAutomationManagementDraft,
  confirmJarvisAutomationManagementDraft: mocks.confirmJarvisAutomationManagementDraft,
  completeJarvisPlanningDraft: mocks.completeJarvisPlanningDraft,
  cancelJarvisPlanningDraft: mocks.cancelJarvisPlanningDraft,
  confirmJarvisPlanningDraft: mocks.confirmJarvisPlanningDraft,
  completeJarvisOfferDraft: mocks.completeJarvisOfferDraft,
  cancelJarvisOfferDraft: mocks.cancelJarvisOfferDraft,
  confirmJarvisOfferDraft: mocks.confirmJarvisOfferDraft,
  completeJarvisOfferDeliveryDraft: mocks.completeJarvisOfferDeliveryDraft,
  cancelJarvisOfferDeliveryDraft: mocks.cancelJarvisOfferDeliveryDraft,
  confirmJarvisOfferDeliveryDraft: mocks.confirmJarvisOfferDeliveryDraft,
  completeJarvisInvoiceDraft: mocks.completeJarvisInvoiceDraft,
  cancelJarvisInvoiceDraft: mocks.cancelJarvisInvoiceDraft,
  confirmJarvisInvoiceDraft: mocks.confirmJarvisInvoiceDraft,
  cancelJarvisInvoiceFinalizationDraft:
    mocks.cancelJarvisInvoiceFinalizationDraft,
  confirmJarvisInvoiceFinalizationDraft:
    mocks.confirmJarvisInvoiceFinalizationDraft,
  completeJarvisInvoicePaymentDraft:
    mocks.completeJarvisInvoicePaymentDraft,
  cancelJarvisInvoicePaymentDraft:
    mocks.cancelJarvisInvoicePaymentDraft,
  confirmJarvisInvoicePaymentDraft:
    mocks.confirmJarvisInvoicePaymentDraft,
  completeJarvisInvoiceReminderDraft:
    mocks.completeJarvisInvoiceReminderDraft,
  cancelJarvisInvoiceReminderDraft:
    mocks.cancelJarvisInvoiceReminderDraft,
  confirmJarvisInvoiceReminderDraft:
    mocks.confirmJarvisInvoiceReminderDraft,
  completeJarvisInvoiceCancellationDraft:
    mocks.completeJarvisInvoiceCancellationDraft,
  cancelJarvisInvoiceCancellationDraft:
    mocks.cancelJarvisInvoiceCancellationDraft,
  confirmJarvisInvoiceCancellationDraft:
    mocks.confirmJarvisInvoiceCancellationDraft,
  completeJarvisInvoiceCreditDraft:
    mocks.completeJarvisInvoiceCreditDraft,
  cancelJarvisInvoiceCreditDraft:
    mocks.cancelJarvisInvoiceCreditDraft,
  confirmJarvisInvoiceCreditDraft:
    mocks.confirmJarvisInvoiceCreditDraft,
  cancelJarvisInvoiceLifecycleDraft:
    mocks.cancelJarvisInvoiceLifecycleDraft,
  confirmJarvisInvoiceLifecycleDraft:
    mocks.confirmJarvisInvoiceLifecycleDraft,
  completeJarvisInvoiceDeliveryDraft:
    mocks.completeJarvisInvoiceDeliveryDraft,
  cancelJarvisInvoiceDeliveryDraft:
    mocks.cancelJarvisInvoiceDeliveryDraft,
  confirmJarvisInvoiceDeliveryDraft:
    mocks.confirmJarvisInvoiceDeliveryDraft,
  completeJarvisTimeDraft: mocks.completeJarvisTimeDraft,
  cancelJarvisTimeDraft: mocks.cancelJarvisTimeDraft,
  confirmJarvisTimeDraft: mocks.confirmJarvisTimeDraft,
  completeJarvisWinterCalculationDraft:
    mocks.completeJarvisWinterCalculationDraft,
  cancelJarvisWinterCalculationDraft:
    mocks.cancelJarvisWinterCalculationDraft,
  confirmJarvisWinterCalculationDraft:
    mocks.confirmJarvisWinterCalculationDraft,
  completeJarvisVehicleTripCalculationDraft:
    mocks.completeJarvisVehicleTripCalculationDraft,
  cancelJarvisVehicleTripCalculationDraft:
    mocks.cancelJarvisVehicleTripCalculationDraft,
  confirmJarvisVehicleTripCalculationDraft:
    mocks.confirmJarvisVehicleTripCalculationDraft,
  JarvisActionDraftError: class JarvisActionDraftError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly status: number
    ) {
      super(message);
    }
  },
}));
vi.mock("@/lib/planning/planning-batch-service", () => ({
  executePlanningBatch: mocks.executePlanningBatch,
}));

import {
  GET,
  PATCH,
  POST,
} from "@/app/api/jarvis/action-drafts/[previewId]/route";

const context = { params: Promise.resolve({ previewId: "preview-1" }) };
const actor = { id: "user-1", role: "GESCHAEFTSFUEHRER", isActive: true };
const draft = {
  version: 2,
  previewId: "preview-1",
  state: "awaiting_confirmation",
};

function request(
  method: string,
  body?: Record<string, unknown>,
  headers: Record<string, string> = {}
) {
  return new Request("https://workpilot.example/api/jarvis/action-drafts/preview-1", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("JARVIS action-draft API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDemoContext.mockResolvedValue({
      organization: { id: "org-1" },
      users: [actor],
    });
    mocks.getSessionBoundActor.mockResolvedValue({
      ok: true,
      sessionId: "session-1",
      sessionUserId: "user-1",
      actor,
    });
    mocks.createJarvisAccessProfile.mockReturnValue({
      sessionActor: actor,
      effectiveActor: actor,
      isImpersonating: false,
    });
    mocks.getJarvisActionDraft.mockResolvedValue(draft);
    mocks.completeJarvisTaskDraft.mockResolvedValue(draft);
    mocks.cancelJarvisTaskDraft.mockResolvedValue({
      ...draft,
      state: "cancelled",
    });
    mocks.confirmJarvisTaskDraft.mockResolvedValue({
      ...draft,
      state: "executed",
      result: { entityType: "task", entityId: "task-1", label: "Öffnen" },
    });
    mocks.cancelJarvisTimeManagementDraft.mockResolvedValue({
      ...draft,
      actionId: "time.manage",
      state: "cancelled",
    });
    mocks.confirmJarvisTimeManagementDraft.mockResolvedValue({
      ...draft,
      actionId: "time.manage",
      state: "executed",
      result: { entityType: "projectTimeEntry", entityId: "entry-1", label: "Zeiteintrag öffnen" },
    });
    mocks.cancelJarvisPlanningMoveDraft.mockResolvedValue({
      ...draft, actionId: "planning.move", state: "cancelled",
    });
    mocks.confirmJarvisPlanningMoveDraft.mockResolvedValue({
      ...draft, actionId: "planning.move", state: "executed",
      result: { entityType: "planning", entityId: "planning-1", label: "Termin öffnen" },
    });
    mocks.cancelJarvisPlanningRequestDecisionDraft.mockResolvedValue({
      ...draft, actionId: "planning.request.manage", decision: "approve", state: "cancelled",
    });
    mocks.confirmJarvisPlanningRequestDecisionDraft.mockResolvedValue({
      ...draft, actionId: "planning.request.manage", decision: "approve", state: "executed",
      result: { entityType: "planning", entityId: "request-1", label: "Planung öffnen" },
    });
    mocks.confirmJarvisPlanningDraft.mockImplementation(
      async (
        _previewId: string,
        _binding: unknown,
        _revision: number,
        execute: (input: Record<string, unknown>) => Promise<{ id: string }>
      ) => {
        await execute({
          actorUserId: "user-1",
          planning: {
            requestId: "planning-preview-1",
            projectId: "project-1",
          },
        });
        return {
          ...draft,
          actionId: "planning.prepare",
          state: "executed",
          result: {
            entityType: "planning",
            entityId: "planning-preview-1",
            label: "Öffnen",
          },
        };
      }
    );
    mocks.executePlanningBatch.mockResolvedValue({
      batchId: "planning-preview-1",
    });
    mocks.completeJarvisOfferDraft.mockResolvedValue({
      ...draft,
      actionId: "offer.prepare",
    });
    mocks.cancelJarvisOfferDraft.mockResolvedValue({
      ...draft,
      actionId: "offer.prepare",
      state: "cancelled",
    });
    mocks.confirmJarvisOfferDraft.mockResolvedValue({
      ...draft,
      actionId: "offer.prepare",
      state: "executed",
      result: {
        entityType: "offer",
        entityId: "offer-1",
        label: "Öffnen",
      },
    });
    mocks.completeJarvisInvoiceDraft.mockResolvedValue({
      ...draft,
      actionId: "invoice.prepare",
    });
    mocks.cancelJarvisInvoiceDraft.mockResolvedValue({
      ...draft,
      actionId: "invoice.prepare",
      state: "cancelled",
    });
    mocks.confirmJarvisInvoiceDraft.mockResolvedValue({
      ...draft,
      actionId: "invoice.prepare",
      state: "executed",
      result: {
        entityType: "invoice",
        entityId: "invoice-1",
        label: "Öffnen",
      },
    });
    mocks.cancelJarvisInvoiceFinalizationDraft.mockResolvedValue({
      ...draft,
      actionId: "invoice.finalize",
      state: "cancelled",
    });
    mocks.confirmJarvisInvoiceFinalizationDraft.mockResolvedValue({
      ...draft,
      actionId: "invoice.finalize",
      state: "executed",
      result: {
        entityType: "invoice",
        entityId: "invoice-1",
        label: "Öffnen",
      },
    });
    mocks.cancelJarvisInvoiceLifecycleDraft.mockResolvedValue({
      ...draft,
      actionId: "invoice.delete",
      state: "cancelled",
    });
    mocks.confirmJarvisInvoiceLifecycleDraft.mockResolvedValue({
      ...draft,
      actionId: "invoice.delete",
      state: "executed",
      result: { entityType: "invoice", entityId: "invoice-1", label: "Öffnen" },
    });
    mocks.cancelJarvisProjectMasterDataDraft.mockResolvedValue({
      ...draft,
      actionId: "project.manage",
      state: "cancelled",
    });
    mocks.confirmJarvisProjectMasterDataDraft.mockResolvedValue({
      ...draft,
      actionId: "project.manage",
      state: "executed",
      result: { entityType: "project", entityId: "project-1", label: "Projekt öffnen" },
    });
    mocks.cancelJarvisProjectStatusDraft.mockResolvedValue({
      ...draft,
      actionId: "project.status.change",
      state: "cancelled",
    });
    mocks.confirmJarvisProjectStatusDraft.mockResolvedValue({
      ...draft,
      actionId: "project.status.change",
      state: "executed",
      result: { entityType: "project", entityId: "project-1", label: "Geändertes Projekt öffnen" },
    });
    mocks.cancelJarvisProjectLifecycleDraft.mockResolvedValue({ ...draft, actionId: "project.archive", state: "cancelled" });
    mocks.confirmJarvisProjectLifecycleDraft.mockResolvedValue({ ...draft, actionId: "project.archive", state: "executed", result: { entityType: "project", entityId: "project-1", label: "Projekt öffnen" } });
    mocks.cancelJarvisOnlineRequestConversionDraft.mockResolvedValue({ ...draft, actionId: "online-request.convert", state: "cancelled" });
    mocks.confirmJarvisOnlineRequestConversionDraft.mockResolvedValue({ ...draft, actionId: "online-request.convert", state: "executed", result: { entityType: "project", entityId: "project-online-1", label: "Neues Projekt öffnen" } });
    mocks.cancelJarvisStampSessionTransitionDraft.mockResolvedValue({ ...draft, actionId: "time.session.manage", state: "cancelled" });
    mocks.confirmJarvisStampSessionTransitionDraft.mockResolvedValue({ ...draft, actionId: "time.session.manage", state: "executed", operation: "pause", result: { entityType: "activeStampSession", entityId: "stamp-1", label: "Stempelstatus aktualisiert" } });
    mocks.completeJarvisInvoiceDeliveryDraft.mockResolvedValue({
      ...draft,
      actionId: "document.send",
    });
    mocks.cancelJarvisInvoiceDeliveryDraft.mockResolvedValue({
      ...draft,
      actionId: "document.send",
      state: "cancelled",
    });
    mocks.confirmJarvisInvoiceDeliveryDraft.mockResolvedValue({
      ...draft,
      actionId: "document.send",
      state: "executed",
      result: {
        entityType: "documentMailDispatch",
        entityId: "dispatch-1",
        label: "Versandprotokoll öffnen",
      },
    });
    mocks.completeJarvisTimeDraft.mockResolvedValue({
      ...draft,
      actionId: "time.prepare",
    });
    mocks.cancelJarvisTimeDraft.mockResolvedValue({
      ...draft,
      actionId: "time.prepare",
      state: "cancelled",
    });
    mocks.confirmJarvisTimeDraft.mockResolvedValue({
      ...draft,
      actionId: "time.prepare",
      state: "executed",
      result: {
        entityType: "projectTimeEntry",
        entityId: "time-entry-1",
        label: "Öffnen",
      },
    });
    mocks.completeJarvisWinterCalculationDraft.mockResolvedValue({
      ...draft,
      actionId: "winter-calculation.prepare",
    });
    mocks.cancelJarvisWinterCalculationDraft.mockResolvedValue({
      ...draft,
      actionId: "winter-calculation.prepare",
      state: "cancelled",
    });
    mocks.confirmJarvisWinterCalculationDraft.mockResolvedValue({
      ...draft,
      actionId: "winter-calculation.prepare",
      state: "executed",
      result: {
        entityType: "winterServiceCalculation",
        entityId: "winter-1",
        label: "Öffnen",
      },
    });
    mocks.completeJarvisVehicleTripCalculationDraft.mockResolvedValue({
      ...draft,
      actionId: "vehicle-trip-calculation.prepare",
    });
    mocks.cancelJarvisVehicleTripCalculationDraft.mockResolvedValue({
      ...draft,
      actionId: "vehicle-trip-calculation.prepare",
      state: "cancelled",
    });
    mocks.confirmJarvisVehicleTripCalculationDraft.mockResolvedValue({
      ...draft,
      actionId: "vehicle-trip-calculation.prepare",
      state: "executed",
      result: {
        entityType: "vehicleCalculation",
        entityId: "vehicle-calculation-1",
        label: "Öffnen",
      },
    });
  });

  it("binds reads to the server session and effective actor", async () => {
    const response = (await GET(
      request("GET") as never,
      context
    ))!;
    expect(response.status).toBe(200);
    expect(mocks.getJarvisActionDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.objectContaining({
        organizationId: "org-1",
        sessionId: "session-1",
      })
    );
  });

  it.each([
    ["missing marker", {}, 403],
    [
      "foreign origin",
      {
        "x-jarvis-action": "task-draft-v1",
        origin: "https://evil.example",
      },
      403,
    ],
  ])("rejects mutation with %s", async (_label, headers, status) => {
    const response = (await POST(
      request("POST", { actorId: "user-1", command: "confirm" }, headers) as never,
      context
    ))!;
    expect(response.status).toBe(status);
    expect(mocks.confirmJarvisTaskDraft).not.toHaveBeenCalled();
  });

  it("accepts the public HTTPS origin behind the trusted reverse proxy", async () => {
    const response = (await POST(
      new Request(
        "http://127.0.0.1:3000/api/jarvis/action-drafts/preview-1",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-jarvis-action": "task-draft-v1",
            origin: "https://workpilot360.oks-cloudservices.com",
            host: "127.0.0.1:3000",
            "x-forwarded-host": "workpilot360.oks-cloudservices.com",
            "x-forwarded-proto": "https",
          },
          body: JSON.stringify({
            actorId: "user-1",
            command: "confirm",
            revision: 2,
          }),
        }
      ),
      context
    ))!;

    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisTaskDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.anything(),
      2
    );
  });

  it("rejects a foreign origin even when the app is behind a proxy", async () => {
    const response = (await POST(
      new Request(
        "http://127.0.0.1:3000/api/jarvis/action-drafts/preview-1",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-jarvis-action": "task-draft-v1",
            origin: "https://evil.example",
            "x-forwarded-host": "workpilot360.oks-cloudservices.com",
            "x-forwarded-proto": "https",
          },
          body: JSON.stringify({
            actorId: "user-1",
            command: "confirm",
            revision: 2,
          }),
        }
      ),
      context
    ))!;

    expect(response.status).toBe(403);
    expect(mocks.confirmJarvisTaskDraft).not.toHaveBeenCalled();
  });

  it("rejects legacy requests without a real session", async () => {
    mocks.getSessionBoundActor.mockResolvedValue({
      ok: true,
      sessionId: null,
      sessionUserId: "user-1",
      actor,
    });
    const response = (await POST(
      request(
        "POST",
        { actorId: "user-1", command: "confirm" },
        { "x-jarvis-action": "task-draft-v1" }
      ) as never,
      context
    ))!;
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "session_required" });
  });

  it("passes only the allowed completion fields to the store", async () => {
    await PATCH(
      request(
        "PATCH",
        {
          actorId: "user-1",
          revision: 1,
          description: "Beschreibung",
          assigneeId: "user-1",
          dueAt: "2026-07-31T08:00:00.000Z",
          organizationId: "evil-org",
          title: "Manipulierter Titel",
        },
        {
          "x-jarvis-action": "task-draft-v1",
          origin: "https://workpilot.example",
        }
      ) as never,
      context
    );

    expect(mocks.completeJarvisTaskDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.objectContaining({
        organizationId: "org-1",
        sessionId: "session-1",
      }),
      {
        revision: 1,
        description: "Beschreibung",
        assigneeId: "user-1",
        dueAt: "2026-07-31T08:00:00.000Z",
      }
    );
  });

  it("separates cancel and explicit confirm commands", async () => {
    const headers = { "x-jarvis-action": "task-draft-v1" };
    const cancelled = (await POST(
      request(
        "POST",
        { actorId: "user-1", command: "cancel", revision: 2 },
        headers
      ) as never,
      context
    ))!;
    expect(cancelled.status).toBe(200);
    expect(mocks.cancelJarvisTaskDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.anything(),
      2
    );
    expect(mocks.confirmJarvisTaskDraft).not.toHaveBeenCalled();

    const confirmed = (await POST(
      request(
        "POST",
        { actorId: "user-1", command: "confirm", revision: 2 },
        headers
      ) as never,
      context
    ))!;
    expect(confirmed.status).toBe(200);
    expect(await confirmed.json()).toMatchObject({
      actionDraft: { state: "executed" },
    });
    expect(mocks.confirmJarvisTaskDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.anything(),
      2
    );
  });

  it("routes invoice lifecycle confirmation only with the exact submitted phrase", async () => {
    const response = (await POST(
      request(
        "POST",
        {
          actorId: "user-1",
          actionId: "invoice.delete",
          command: "confirm",
          revision: 3,
          confirmationText: "RECHNUNG LÖSCHEN RE-10119",
        },
        { "x-jarvis-action": "jarvis-action-draft-v2" }
      ) as never,
      context
    ))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisInvoiceLifecycleDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.objectContaining({ organizationId: "org-1", sessionId: "session-1" }),
      3,
      "RECHNUNG LÖSCHEN RE-10119"
    );
    expect(mocks.confirmJarvisInvoiceCancellationDraft).not.toHaveBeenCalled();
  });

  it("executes planning confirmation only through the existing planning service", async () => {
    const response = (await POST(
      request(
        "POST",
        {
          actorId: "user-1",
          actionId: "planning.prepare",
          command: "confirm",
          revision: 1,
          organizationId: "evil-org",
          board: "Manipulated board",
        },
        {
          "x-jarvis-action": "jarvis-action-draft-v2",
          origin: "https://workpilot.example",
          cookie: "workpilot_session=signed",
        }
      ) as never,
      context
    ))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisPlanningDraft).toHaveBeenCalledTimes(1);
    expect(mocks.executePlanningBatch).toHaveBeenCalledTimes(1);
    expect(mocks.executePlanningBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        source: "jarvis",
        request: expect.objectContaining({
          requestId: "planning-preview-1",
        }),
      })
    );
  });

  it("routes offer edits and explicit confirmation through an allowlisted payload", async () => {
    const headers = {
      "x-jarvis-action": "jarvis-action-draft-v2",
      origin: "https://workpilot.example",
    };
    const lines = [
      {
        catalogItemId: "catalog-1",
        quantity: 2,
        description: "Glasflächen reinigen",
        unitPrice: 50,
        discountPercent: 0,
      },
    ];
    const edited = (await PATCH(
      request(
        "PATCH",
        {
          actorId: "user-1",
          actionId: "offer.prepare",
          revision: 1,
          projectId: "project-1",
          company: "OK solutions",
          offerType: "base",
          addendumMode: "addition",
          parentOfferId: "",
          plannedExecutionMonth: "2026-11",
          plannedExecutionEndMonth: "",
          introText: "Einleitung",
          closingText: "Schlusstext",
          vatRate: 19,
          discountPercent: 5,
          lines,
          organizationId: "evil-org",
          status: "Versendet",
          pdfData: "forbidden",
        },
        headers
      ) as never,
      context
    ))!;

    expect(edited.status).toBe(200);
    expect(mocks.completeJarvisOfferDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.objectContaining({
        organizationId: "org-1",
        sessionId: "session-1",
      }),
      {
        revision: 1,
        projectId: "project-1",
        company: "OK solutions",
        offerType: "base",
        addendumMode: "addition",
        parentOfferId: "",
        plannedExecutionMonth: "2026-11",
        plannedExecutionEndMonth: "",
        introText: "Einleitung",
        closingText: "Schlusstext",
        vatRate: 19,
        discountPercent: 5,
        lines,
      }
    );

    const confirmed = (await POST(
      request(
        "POST",
        {
          actorId: "user-1",
          actionId: "offer.prepare",
          command: "confirm",
          revision: 2,
        },
        headers
      ) as never,
      context
    ))!;
    expect(confirmed.status).toBe(200);
    expect(mocks.confirmJarvisOfferDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.anything(),
      2
    );
    expect(mocks.confirmJarvisTaskDraft).not.toHaveBeenCalled();
  });

  it("routes time edits, cancellation and confirmation with an allowlisted payload", async () => {
    const headers = {
      "x-jarvis-action": "jarvis-action-draft-v2",
      origin: "https://workpilot.example",
    };
    const edited = (await PATCH(
      request(
        "PATCH",
        {
          actorId: "user-1",
          actionId: "time.prepare",
          revision: 1,
          mode: "project",
          projectId: "project-1",
          unproductiveLabel: "",
          employeeId: "employee-1",
          date: "2026-07-31",
          startTime: "08:00",
          endTime: "10:00",
          pauseMinutes: 15,
          comment: "Fenster gereinigt",
          offerId: "offer-1",
          trade: "",
          billingCatalogItemId: "",
          completionStatus: "finished",
          overtimeApprovalStatus: "approved",
          organizationId: "evil-org",
          durationMs: 1,
          entrySource: "stamped",
        },
        headers
      ) as never,
      context
    ))!;

    expect(edited.status).toBe(200);
    expect(mocks.completeJarvisTimeDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.objectContaining({
        organizationId: "org-1",
        sessionId: "session-1",
      }),
      {
        revision: 1,
        mode: "project",
        projectId: "project-1",
        unproductiveLabel: "",
        employeeId: "employee-1",
        date: "2026-07-31",
        startTime: "08:00",
        endTime: "10:00",
        pauseMinutes: 15,
        comment: "Fenster gereinigt",
        offerId: "offer-1",
        trade: "",
        billingCatalogItemId: "",
        completionStatus: "finished",
        overtimeApprovalStatus: "approved",
      }
    );
    expect(mocks.completeJarvisTaskDraft).not.toHaveBeenCalled();

    const cancelled = (await POST(
      request(
        "POST",
        {
          actorId: "user-1",
          actionId: "time.prepare",
          command: "cancel",
          revision: 2,
        },
        headers
      ) as never,
      context
    ))!;
    expect(cancelled.status).toBe(200);
    expect(mocks.cancelJarvisTimeDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.anything(),
      2
    );

    const confirmed = (await POST(
      request(
        "POST",
        {
          actorId: "user-1",
          actionId: "time.prepare",
          command: "confirm",
          revision: 2,
        },
        headers
      ) as never,
      context
    ))!;
    expect(confirmed.status).toBe(200);
    expect(mocks.confirmJarvisTimeDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.anything(),
      2
    );
    expect(mocks.executePlanningBatch).not.toHaveBeenCalled();
  });

  it("routes winter calculation edits and explicit confirmation only to the winter draft store", async () => {
    const headers = {
      "x-jarvis-action": "jarvis-action-draft-v2",
      origin: "https://workpilot.example",
    };
    const input = {
      areaSqm: 1000,
      readinessPricePerSqmPerMonth: 0.2,
      seasonMonths: 5,
      expectedDeployments: 20,
      baseServiceMinutes: 60,
      laborSalesRatePerHour: 45,
      saltGramsPerSqm: 15,
      saltSalesPricePerKg: 0.8,
      plowTimeIncreasePercent: 30,
      plowSaltIncreasePercent: 10,
      mixedSpreadingPercent: 70,
      mixedPlowingPercent: 30,
    };
    const edited = (await PATCH(
      request(
        "PATCH",
        {
          actorId: "user-1",
          actionId: "winter-calculation.prepare",
          revision: 1,
          input,
          projectId: "project-1",
          note: "Freigabe laut Ortstermin",
          organizationId: "evil-org",
        },
        headers
      ) as never,
      context
    ))!;
    expect(edited.status).toBe(200);
    expect(mocks.completeJarvisWinterCalculationDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.objectContaining({
        organizationId: "org-1",
        sessionId: "session-1",
      }),
      {
        revision: 1,
        input,
        projectId: "project-1",
        note: "Freigabe laut Ortstermin",
      }
    );
    expect(mocks.completeJarvisTaskDraft).not.toHaveBeenCalled();

    const confirmed = (await POST(
      request(
        "POST",
        {
          actorId: "user-1",
          actionId: "winter-calculation.prepare",
          command: "confirm",
          revision: 2,
        },
        headers
      ) as never,
      context
    ))!;
    expect(confirmed.status).toBe(200);
    expect(mocks.confirmJarvisWinterCalculationDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.anything(),
      2
    );
    expect(mocks.executePlanningBatch).not.toHaveBeenCalled();
  });

  it("routes vehicle trip edits and confirmation only with allowed fields", async () => {
    const headers = {
      "x-jarvis-action": "jarvis-action-draft-v2",
      origin: "https://workpilot.example",
    };
    const edited = (await PATCH(
      request(
        "PATCH",
        {
          actorId: "user-1",
          actionId: "vehicle-trip-calculation.prepare",
          revision: 1,
          vehicleId: "vehicle-1",
          distanceKm: 125,
          fuelPriceMode: "manual",
          manualFuelPricePerLiter: 1.95,
          note: "Kundenfahrt",
          selfCostPerKm: 0,
          organizationId: "evil-org",
        },
        headers
      ) as never,
      context
    ))!;
    expect(edited.status).toBe(200);
    expect(
      mocks.completeJarvisVehicleTripCalculationDraft
    ).toHaveBeenCalledWith(
      "preview-1",
      expect.objectContaining({
        organizationId: "org-1",
        sessionId: "session-1",
      }),
      {
        revision: 1,
        vehicleId: "vehicle-1",
        distanceKm: 125,
        fuelPriceMode: "manual",
        manualFuelPricePerLiter: 1.95,
        note: "Kundenfahrt",
      }
    );
    expect(mocks.completeJarvisTaskDraft).not.toHaveBeenCalled();

    const confirmed = (await POST(
      request(
        "POST",
        {
          actorId: "user-1",
          actionId: "vehicle-trip-calculation.prepare",
          command: "confirm",
          revision: 2,
        },
        headers
      ) as never,
      context
    ))!;
    expect(confirmed.status).toBe(200);
    expect(
      mocks.confirmJarvisVehicleTripCalculationDraft
    ).toHaveBeenCalledWith("preview-1", expect.anything(), 2);
    expect(mocks.executePlanningBatch).not.toHaveBeenCalled();
  });

  it("routes invoice drafts through the allowlist and never through task execution", async () => {
    const headers = {
      "x-jarvis-action": "jarvis-action-draft-v2",
      origin: "https://workpilot.example",
    };
    const edited = (await PATCH(
      request("PATCH", {
        actorId: "user-1",
        actionId: "invoice.prepare",
        revision: 3,
        projectId: "project-1",
        company: "OK solutions",
        serviceDate: "2026-07-31",
        sourceOfferId: "offer-1",
        introText: "Einleitung",
        closingText: "Schluss",
        vatRate: 19,
        discountPercent: 2,
        paymentTermDays: 14,
        dueDate: "2026-08-14",
        lines: [{ catalogItemId: "service-1", quantity: 2 }],
        status: "Fakturiert",
        sendNow: true,
        organizationId: "evil-org",
      }, headers) as never,
      context
    ))!;
    expect(edited.status).toBe(200);
    expect(mocks.completeJarvisInvoiceDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.objectContaining({ organizationId: "org-1", sessionId: "session-1" }),
      {
        revision: 3,
        projectId: "project-1",
        company: "OK solutions",
        serviceDate: "2026-07-31",
        sourceOfferId: "offer-1",
        introText: "Einleitung",
        closingText: "Schluss",
        vatRate: 19,
        discountPercent: 2,
        paymentTermDays: 14,
        dueDate: "2026-08-14",
        lines: [{ catalogItemId: "service-1", quantity: 2 }],
      }
    );
    expect(mocks.completeJarvisTaskDraft).not.toHaveBeenCalled();

    const confirmed = (await POST(
      request("POST", { actorId: "user-1", actionId: "invoice.prepare", command: "confirm", revision: 4 }, headers) as never,
      context
    ))!;
    expect(confirmed.status).toBe(200);
    expect(mocks.confirmJarvisInvoiceDraft).toHaveBeenCalledWith("preview-1", expect.anything(), 4);
    expect(mocks.executePlanningBatch).not.toHaveBeenCalled();
  });

  it("passes the critical invoice phrase only to finalization", async () => {
    const response = (await POST(
      request(
        "POST",
        {
          actorId: "user-1",
          actionId: "invoice.finalize",
          command: "confirm",
          revision: 2,
          confirmationText: "FAKTURIEREN RE-10124",
          sendNow: true,
          markPaid: true,
        },
        {
          "x-jarvis-action": "jarvis-action-draft-v2",
          origin: "https://workpilot.example",
        }
      ) as never,
      context
    ))!;

    expect(response.status).toBe(200);
    expect(
      mocks.confirmJarvisInvoiceFinalizationDraft
    ).toHaveBeenCalledWith(
      "preview-1",
      expect.anything(),
      2,
      "FAKTURIEREN RE-10124"
    );
    expect(mocks.confirmJarvisInvoiceDraft).not.toHaveBeenCalled();
    expect(mocks.confirmJarvisTaskDraft).not.toHaveBeenCalled();
  });

  it("passes only the bound phrase and request to invoice delivery", async () => {
    const requestValue = request(
      "POST",
      {
        actorId: "user-1",
        actionId: "document.send",
        command: "confirm",
        revision: 3,
        confirmationText: "SENDEN RE-10124 AN rechnung@kunde.de",
        replaceRecipientAfterConfirmation: "attacker@example.com",
      },
      {
        "x-jarvis-action": "jarvis-action-draft-v2",
        origin: "https://workpilot.example",
      }
    ) as never;
    const response = (await POST(requestValue, context))!;

    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisInvoiceDeliveryDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.anything(),
      3,
      "SENDEN RE-10124 AN rechnung@kunde.de",
      requestValue
    );
    expect(
      mocks.confirmJarvisInvoiceFinalizationDraft
    ).not.toHaveBeenCalled();
    expect(mocks.confirmJarvisInvoiceDraft).not.toHaveBeenCalled();
  });

  it("passes only the bound critical phrase to the paid-status action", async () => {
    mocks.confirmJarvisInvoicePaymentDraft.mockResolvedValue({
      state: "executed",
      actionId: "invoice.mark-paid",
    });
    const response = (await POST(
      request(
        "POST",
        {
          actorId: "user-1",
          actionId: "invoice.mark-paid",
          command: "confirm",
          revision: 4,
          confirmationText: "BEZAHLT RE-10119 AM 31.07.2026",
          paymentDateAfterConfirmation: "2026-08-01",
          sendReminder: true,
        },
        {
          "x-jarvis-action": "jarvis-action-draft-v2",
          origin: "https://workpilot.example",
        }
      ) as never,
      context
    ))!;

    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisInvoicePaymentDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.anything(),
      4,
      "BEZAHLT RE-10119 AM 31.07.2026"
    );
    expect(mocks.confirmJarvisInvoiceDeliveryDraft).not.toHaveBeenCalled();
    expect(mocks.confirmJarvisInvoiceFinalizationDraft).not.toHaveBeenCalled();
  });

  it("passes only the bound critical phrase to reminder creation", async () => {
    mocks.confirmJarvisInvoiceReminderDraft.mockResolvedValue({
      state: "executed",
      actionId: "invoice.remind",
    });
    const response = (await POST(
      request(
        "POST",
        {
          actorId: "user-1",
          actionId: "invoice.remind",
          command: "confirm",
          revision: 5,
          confirmationText: "MAHNUNG MA-RE-10119-1 BIS 07.08.2026",
          paymentDeadlineAfterConfirmation: "2026-08-20",
          sendMail: true,
        },
        {
          "x-jarvis-action": "jarvis-action-draft-v2",
          origin: "https://workpilot.example",
        }
      ) as never,
      context
    ))!;

    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisInvoiceReminderDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.anything(),
      5,
      "MAHNUNG MA-RE-10119-1 BIS 07.08.2026"
    );
    expect(mocks.confirmJarvisInvoiceDeliveryDraft).not.toHaveBeenCalled();
    expect(mocks.confirmJarvisInvoicePaymentDraft).not.toHaveBeenCalled();
  });

  it("passes only the bound critical phrase to full invoice cancellation", async () => {
    mocks.confirmJarvisInvoiceCancellationDraft.mockResolvedValue({ state: "executed", actionId: "invoice.cancel" });
    const response = (await POST(
      request("POST", {
        actorId: "user-1",
        actionId: "invoice.cancel",
        command: "confirm",
        revision: 6,
        confirmationText: "STORNIEREN RE-10119 MIT ST-10100",
        refundPayment: true,
        sendMail: true,
      }, {
        "x-jarvis-action": "jarvis-action-draft-v2",
        origin: "https://workpilot.example",
      }) as never,
      context
    ))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisInvoiceCancellationDraft).toHaveBeenCalledWith(
      "preview-1", expect.anything(), 6, "STORNIEREN RE-10119 MIT ST-10100"
    );
    expect(mocks.confirmJarvisInvoicePaymentDraft).not.toHaveBeenCalled();
    expect(mocks.confirmJarvisInvoiceDeliveryDraft).not.toHaveBeenCalled();
  });

  it("passes only the bound critical phrase to partial credit creation", async () => {
    mocks.confirmJarvisInvoiceCreditDraft.mockResolvedValue({ state: "executed", actionId: "invoice.credit" });
    const response = (await POST(
      request("POST", {
        actorId: "user-1",
        actionId: "invoice.credit",
        command: "confirm",
        revision: 7,
        confirmationText: "GUTSCHRIFT GU-10100 ZU RE-10119 ÜBER 23,80 EUR",
        refundPayment: true,
        releaseTime: true,
      }, {
        "x-jarvis-action": "jarvis-action-draft-v2",
        origin: "https://workpilot.example",
      }) as never,
      context
    ))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisInvoiceCreditDraft).toHaveBeenCalledWith(
      "preview-1", expect.anything(), 7, "GUTSCHRIFT GU-10100 ZU RE-10119 ÜBER 23,80 EUR"
    );
    expect(mocks.confirmJarvisInvoiceCancellationDraft).not.toHaveBeenCalled();
    expect(mocks.confirmJarvisInvoicePaymentDraft).not.toHaveBeenCalled();
  });

  it("passes only the exact project-data phrase to the bound project draft", async () => {
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "project.manage", command: "confirm", revision: 5,
      confirmationText: "PROJEKT ÄNDERN GLR-449", changes: { title: "Manipuliert" },
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisProjectMasterDataDraft).toHaveBeenCalledWith("preview-1", expect.anything(), 5, "PROJEKT ÄNDERN GLR-449");
    expect(mocks.confirmJarvisProjectStatusDraft).not.toHaveBeenCalled();
  });

  it("passes only the exact time-entry phrase to the bound management draft", async () => {
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "time.manage", command: "confirm", revision: 6,
      confirmationText: "ZEITEINTRAG KORRIGIEREN entry-1",
      changes: { startTime: "00:00" },
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisTimeManagementDraft).toHaveBeenCalledWith(
      "preview-1", expect.anything(), 6, "ZEITEINTRAG KORRIGIEREN entry-1"
    );
    expect(mocks.confirmJarvisTimeDraft).not.toHaveBeenCalled();
  });

  it("passes only the exact appointment-move phrase to the bound planning draft", async () => {
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "planning.move", command: "confirm", revision: 6,
      confirmationText: "TERMIN VERSCHIEBEN planning-1",
      targetDate: "2099-01-01", targetStartTime: "00:00", targetEndTime: "00:01",
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisPlanningMoveDraft).toHaveBeenCalledWith(
      "preview-1", expect.anything(), 6, "TERMIN VERSCHIEBEN planning-1"
    );
    expect(mocks.confirmJarvisPlanningDraft).not.toHaveBeenCalled();
  });

  it("passes only the exact appointment-request decision phrase to its bound draft", async () => {
    mocks.confirmJarvisPlanningRequestDecisionDraft.mockResolvedValueOnce({
      actionId: "planning.request.manage", state: "executed", decision: "reject",
    });
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "planning.request.manage", command: "confirm", revision: 7,
      confirmationText: "TERMINWUNSCH ABLEHNEN request-1", reason: "Manipuliert",
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisPlanningRequestDecisionDraft).toHaveBeenCalledWith(
      "preview-1", expect.anything(), 7, "TERMINWUNSCH ABLEHNEN request-1"
    );
    expect((await response.json()).message).toContain("begründet abgelehnt");
    expect(mocks.confirmJarvisPlanningMoveDraft).not.toHaveBeenCalled();
  });

  it("reports execution of a complete appointment series without an incorrect single-entry claim", async () => {
    mocks.confirmJarvisPlanningRequestDecisionDraft.mockResolvedValueOnce({
      actionId: "planning.request.manage", state: "executed", decision: "cancel_series",
    });
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "planning.request.manage", command: "confirm", revision: 8,
      confirmationText: "TERMIN-SERIE ABSAGEN request-1",
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.message).toContain("vollständig angezeigte bestätigte Terminserie");
    expect(payload.message).not.toContain("weitere Serieneinträge blieben unverändert");
  });

  it.each([
    ["approve_series", "TERMINWUNSCH-SERIE FREIGEBEN request-1", "genau einmal freigegeben"],
    ["reject_series", "TERMINWUNSCH-SERIE ABLEHNEN request-1", "genau einmal begründet abgelehnt"],
  ] as const)("reports the complete appointment-request series result for %s", async (decision, confirmationText, resultText) => {
    mocks.confirmJarvisPlanningRequestDecisionDraft.mockResolvedValueOnce({
      actionId: "planning.request.manage", state: "executed", decision,
    });
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "planning.request.manage", command: "confirm", revision: 9,
      confirmationText,
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.message).toContain("vollständig angezeigte offene Terminwunschserie");
    expect(payload.message).toContain(resultText);
    expect(payload.message).not.toContain("weitere Serieneinträge blieben unverändert");
  });

  it("passes only the exact contact phrase to the bound contact draft", async () => {
    mocks.confirmJarvisContactManagementDraft.mockResolvedValueOnce({
      actionId: "contact.manage", state: "executed", result: { entityType: "contact", entityId: "contact-1", label: "Kontakt öffnen" },
    });
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "contact.manage", command: "confirm", revision: 4,
      confirmationText: "KONTAKT ANLEGEN Neue GmbH", values: { companyName: "Manipuliert" },
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisContactManagementDraft).toHaveBeenCalledWith("preview-1", expect.anything(), 4, "KONTAKT ANLEGEN Neue GmbH");
    expect(mocks.confirmJarvisProjectMasterDataDraft).not.toHaveBeenCalled();
  });

  it("passes only the exact irreversible phrase to the bound contact deletion draft", async () => {
    mocks.confirmJarvisContactDeletionDraft.mockResolvedValueOnce({
      actionId: "contact.delete", state: "executed", contactId: "contact-1", customerNumber: "7000049",
    });
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "contact.delete", command: "confirm", revision: 6,
      confirmationText: "KONTAKT ENDGÜLTIG LÖSCHEN 7000049", contactId: "other-contact", reason: "Manipuliert",
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisContactDeletionDraft).toHaveBeenCalledWith(
      "preview-1", expect.anything(), 6, "KONTAKT ENDGÜLTIG LÖSCHEN 7000049"
    );
    expect(mocks.confirmJarvisContactManagementDraft).not.toHaveBeenCalled();
  });

  it("cancels contact deletion without confirming it", async () => {
    mocks.cancelJarvisContactDeletionDraft.mockResolvedValueOnce({ actionId: "contact.delete", state: "cancelled" });
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "contact.delete", command: "cancel", revision: 3,
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.cancelJarvisContactDeletionDraft).toHaveBeenCalledWith("preview-1", expect.anything(), 3);
    expect(mocks.confirmJarvisContactDeletionDraft).not.toHaveBeenCalled();
  });

  it("passes only the exact catalog phrase to the bound catalog draft", async () => {
    mocks.confirmJarvisCatalogManagementDraft.mockResolvedValueOnce({
      actionId: "catalog.manage", state: "executed", result: { entityType: "catalogItem", entityId: "catalog-1", label: "Katalogposition öffnen" },
    });
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "catalog.manage", command: "confirm", revision: 8,
      confirmationText: "KATALOGPOSITION ANLEGEN L1001", values: { salesPrice: 1 },
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisCatalogManagementDraft).toHaveBeenCalledWith("preview-1", expect.anything(), 8, "KATALOGPOSITION ANLEGEN L1001");
    expect(mocks.confirmJarvisContactManagementDraft).not.toHaveBeenCalled();
  });

  it("cancels catalog management without confirming it", async () => {
    mocks.cancelJarvisCatalogManagementDraft.mockResolvedValueOnce({ actionId: "catalog.manage", state: "cancelled" });
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "catalog.manage", command: "cancel", revision: 4,
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.cancelJarvisCatalogManagementDraft).toHaveBeenCalledWith("preview-1", expect.anything(), 4);
    expect(mocks.confirmJarvisCatalogManagementDraft).not.toHaveBeenCalled();
  });

  it("passes only the exact personnel phrase to the bound personnel draft", async () => {
    mocks.confirmJarvisPersonnelManagementDraft.mockResolvedValueOnce({
      actionId: "personnel.manage", state: "executed", result: { entityType: "user", entityId: "employee-2", label: "Mitarbeiter öffnen" },
    });
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "personnel.manage", command: "confirm", revision: 9,
      confirmationText: "MITARBEITER ÄNDERN max@example.test", employeeId: "other-user", values: { role: "ADMIN" },
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisPersonnelManagementDraft).toHaveBeenCalledWith("preview-1", expect.anything(), 9, "MITARBEITER ÄNDERN max@example.test");
    expect(mocks.confirmJarvisCatalogManagementDraft).not.toHaveBeenCalled();
  });

  it("cancels personnel management without confirming it", async () => {
    mocks.cancelJarvisPersonnelManagementDraft.mockResolvedValueOnce({ actionId: "personnel.manage", state: "cancelled" });
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "personnel.manage", command: "cancel", revision: 5,
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.cancelJarvisPersonnelManagementDraft).toHaveBeenCalledWith("preview-1", expect.anything(), 5);
    expect(mocks.confirmJarvisPersonnelManagementDraft).not.toHaveBeenCalled();
  });

  it("passes only the exact employee-cost phrase to the bound draft", async () => {
    mocks.confirmJarvisEmployeeCostManagementDraft.mockResolvedValueOnce({ actionId: "payroll.manage", state: "executed", result: { entityType: "user", entityId: "employee-2", label: "Mitarbeiterkosten öffnen" } });
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "payroll.manage", command: "confirm", revision: 10,
      confirmationText: "LOHNKOSTEN ÄNDERN max@example.test", userId: "other-user", values: { monthlySalary: 1 },
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisEmployeeCostManagementDraft).toHaveBeenCalledWith("preview-1", expect.anything(), 10, "LOHNKOSTEN ÄNDERN max@example.test");
  });

  it("cancels employee-cost management without confirming it", async () => {
    mocks.cancelJarvisEmployeeCostManagementDraft.mockResolvedValueOnce({ actionId: "payroll.manage", state: "cancelled" });
    const response = (await POST(request("POST", { actorId: "user-1", actionId: "payroll.manage", command: "cancel", revision: 6 }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.cancelJarvisEmployeeCostManagementDraft).toHaveBeenCalledWith("preview-1", expect.anything(), 6);
  });

  it("passes only the exact bulk confirmation phrase to the bound dry-run", async () => {
    mocks.confirmJarvisBulkUpdateDraft.mockResolvedValueOnce({ actionId: "bulk.update", state: "executed", result: { entityType: "contact", entityId: "contact-1", label: "Kontakte öffnen" } });
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "bulk.update", command: "confirm", revision: 4,
      confirmationText: "MASSENÄNDERUNG AUSFÜHREN 2 KONTAKTE", customerNumbers: ["fremd"], targetCategory: "Kunde",
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisBulkUpdateDraft).toHaveBeenCalledWith("preview-1", expect.anything(), 4, "MASSENÄNDERUNG AUSFÜHREN 2 KONTAKTE");
  });

  it("cancels a bulk dry-run without executing it", async () => {
    mocks.cancelJarvisBulkUpdateDraft.mockResolvedValueOnce({ actionId: "bulk.update", state: "cancelled" });
    const response = (await POST(request("POST", { actorId: "user-1", actionId: "bulk.update", command: "cancel", revision: 3 }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.cancelJarvisBulkUpdateDraft).toHaveBeenCalledWith("preview-1", expect.anything(), 3);
    expect(mocks.confirmJarvisBulkUpdateDraft).not.toHaveBeenCalled();
  });

  it("passes only the exact automation phrase to the bound dry-run", async () => {
    mocks.confirmJarvisAutomationManagementDraft.mockResolvedValueOnce({ actionId: "automation.manage", state: "executed", targetEnabled: true });
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "automation.manage", command: "confirm", revision: 2,
      confirmationText: "PROJEKTSTATUS-AUTOMATION AKTIVIEREN", enabled: false,
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisAutomationManagementDraft).toHaveBeenCalledWith("preview-1", expect.anything(), 2, "PROJEKTSTATUS-AUTOMATION AKTIVIEREN");
  });

  it("cancels an automation dry-run without changing the switch", async () => {
    mocks.cancelJarvisAutomationManagementDraft.mockResolvedValueOnce({ actionId: "automation.manage", state: "cancelled" });
    const response = (await POST(request("POST", { actorId: "user-1", actionId: "automation.manage", command: "cancel", revision: 3 }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.cancelJarvisAutomationManagementDraft).toHaveBeenCalledWith("preview-1", expect.anything(), 3);
    expect(mocks.confirmJarvisAutomationManagementDraft).not.toHaveBeenCalled();
  });

  it("passes only the exact project-status phrase to the bound status draft", async () => {
    const response = (await POST(
      request("POST", {
        actorId: "user-1",
        actionId: "project.status.change",
        command: "confirm",
        revision: 3,
        confirmationText: "PROJEKTSTATUS GLR-449 AUF Angebot",
        projectId: "other-project",
        targetStatus: "Abgeschlossen",
      }, {
        "x-jarvis-action": "jarvis-action-draft-v2",
        origin: "https://workpilot.example",
      }) as never,
      context
    ))!;

    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisProjectStatusDraft).toHaveBeenCalledWith(
      "preview-1",
      expect.anything(),
      3,
      "PROJEKTSTATUS GLR-449 AUF Angebot"
    );
    expect(mocks.confirmJarvisInvoiceLifecycleDraft).not.toHaveBeenCalled();
  });

  it("cancels a project-status draft without confirming it", async () => {
    const response = (await POST(
      request("POST", {
        actorId: "user-1",
        actionId: "project.status.change",
        command: "cancel",
        revision: 2,
      }, {
        "x-jarvis-action": "jarvis-action-draft-v2",
        origin: "https://workpilot.example",
      }) as never,
      context
    ))!;

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.message).toContain("sämtliche Fachdaten blieben unverändert");
    expect(mocks.cancelJarvisProjectStatusDraft).toHaveBeenCalledWith("preview-1", expect.anything(), 2);
    expect(mocks.confirmJarvisProjectStatusDraft).not.toHaveBeenCalled();
  });

  it("passes only the exact project archive phrase to the bound lifecycle draft", async () => {
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "project.archive", command: "confirm", revision: 4,
      confirmationText: "PROJEKT ARCHIVIEREN GLR-449", projectId: "other-project", deleteFiles: true,
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisProjectLifecycleDraft).toHaveBeenCalledWith("preview-1", expect.anything(), 4, "PROJEKT ARCHIVIEREN GLR-449");
    expect(mocks.confirmJarvisProjectStatusDraft).not.toHaveBeenCalled();
  });

  it("passes only the exact online request phrase to the dedicated conversion draft", async () => {
    const response = (await POST(
      request(
        "POST",
        {
          actorId: "user-1",
          actionId: "online-request.convert",
          command: "confirm",
          revision: 3,
          confirmationText:
            "ONLINE-ANFRAGE UMWANDELN OKI-20260802-A1B2C3",
          projectId: "forbidden-existing-project",
        },
        {
          "x-jarvis-action": "jarvis-action-draft-v2",
          origin: "https://workpilot.example",
        }
      ) as never,
      context
    ))!;

    expect(response.status).toBe(200);
    expect(
      mocks.confirmJarvisOnlineRequestConversionDraft
    ).toHaveBeenCalledWith(
      "preview-1",
      expect.anything(),
      3,
      "ONLINE-ANFRAGE UMWANDELN OKI-20260802-A1B2C3"
    );
    expect(mocks.confirmJarvisProjectLifecycleDraft).not.toHaveBeenCalled();
  });

  it("passes only the exact personal stamp phrase to the session-bound draft", async () => {
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "time.session.manage", command: "confirm", revision: 5,
      confirmationText: "STEMPELUNG PAUSIEREN", userId: "other-user", action: "stop",
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    expect(mocks.confirmJarvisStampSessionTransitionDraft).toHaveBeenCalledWith(
      "preview-1", expect.anything(), 5, "STEMPELUNG PAUSIEREN"
    );
    expect(mocks.confirmJarvisProjectLifecycleDraft).not.toHaveBeenCalled();
  });

  it("describes an executed personal stamp stop as ended", async () => {
    mocks.confirmJarvisStampSessionTransitionDraft.mockResolvedValueOnce({
      ...draft,
      actionId: "time.session.manage",
      state: "executed",
      operation: "stop",
      result: { entityType: "projectTimeEntry", entityId: "time-1", label: "Zeitbuchung gespeichert" },
    });
    const response = (await POST(request("POST", {
      actorId: "user-1", actionId: "time.session.manage", command: "confirm", revision: 5,
      confirmationText: "STEMPELUNG STOPPEN",
    }, { "x-jarvis-action": "jarvis-action-draft-v2", origin: "https://workpilot.example" }) as never, context))!;
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toContain("genau einmal beendet");
    expect(body.message).not.toContain("fortgesetzt");
  });

  it("rejects unknown commands without touching draft state", async () => {
    const response = (await POST(
      request(
        "POST",
        { actorId: "user-1", command: "execute-anything" },
        { "x-jarvis-action": "task-draft-v1" }
      ) as never,
      context
    ))!;
    expect(response.status).toBe(400);
    expect(mocks.cancelJarvisTaskDraft).not.toHaveBeenCalled();
    expect(mocks.confirmJarvisTaskDraft).not.toHaveBeenCalled();
  });
});
