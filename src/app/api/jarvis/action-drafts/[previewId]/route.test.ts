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
  completeJarvisPlanningDraft: vi.fn(),
  cancelJarvisPlanningDraft: vi.fn(),
  confirmJarvisPlanningDraft: vi.fn(),
  completeJarvisOfferDraft: vi.fn(),
  cancelJarvisOfferDraft: vi.fn(),
  confirmJarvisOfferDraft: vi.fn(),
  completeJarvisInvoiceDraft: vi.fn(),
  cancelJarvisInvoiceDraft: vi.fn(),
  confirmJarvisInvoiceDraft: vi.fn(),
  cancelJarvisInvoiceFinalizationDraft: vi.fn(),
  confirmJarvisInvoiceFinalizationDraft: vi.fn(),
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
  completeJarvisPlanningDraft: mocks.completeJarvisPlanningDraft,
  cancelJarvisPlanningDraft: mocks.cancelJarvisPlanningDraft,
  confirmJarvisPlanningDraft: mocks.confirmJarvisPlanningDraft,
  completeJarvisOfferDraft: mocks.completeJarvisOfferDraft,
  cancelJarvisOfferDraft: mocks.cancelJarvisOfferDraft,
  confirmJarvisOfferDraft: mocks.confirmJarvisOfferDraft,
  completeJarvisInvoiceDraft: mocks.completeJarvisInvoiceDraft,
  cancelJarvisInvoiceDraft: mocks.cancelJarvisInvoiceDraft,
  confirmJarvisInvoiceDraft: mocks.confirmJarvisInvoiceDraft,
  cancelJarvisInvoiceFinalizationDraft:
    mocks.cancelJarvisInvoiceFinalizationDraft,
  confirmJarvisInvoiceFinalizationDraft:
    mocks.confirmJarvisInvoiceFinalizationDraft,
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
