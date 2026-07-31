import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import {
  cancelJarvisPlanningDraft,
  cancelJarvisOfferDraft,
  cancelJarvisOfferFinalizationDraft,
  cancelJarvisOfferDeliveryDraft,
  cancelJarvisOfferDecisionDraft,
  cancelJarvisOfferLifecycleDraft,
  cancelJarvisInvoiceDraft,
  cancelJarvisInvoiceFinalizationDraft,
  cancelJarvisInvoicePaymentDraft,
  cancelJarvisInvoiceReminderDraft,
  cancelJarvisInvoiceCancellationDraft,
  cancelJarvisInvoiceCreditDraft,
  cancelJarvisInvoiceDeliveryDraft,
  cancelJarvisCommunicationDraft,
  cancelJarvisTaskDraft,
  cancelJarvisTimeDraft,
  cancelJarvisVehicleTripCalculationDraft,
  cancelJarvisWinterCalculationDraft,
  completeJarvisPlanningDraft,
  completeJarvisOfferDraft,
  completeJarvisOfferDeliveryDraft,
  completeJarvisInvoiceDraft,
  completeJarvisInvoicePaymentDraft,
  completeJarvisInvoiceReminderDraft,
  completeJarvisInvoiceCancellationDraft,
  completeJarvisInvoiceCreditDraft,
  completeJarvisInvoiceDeliveryDraft,
  completeJarvisCommunicationDraft,
  completeJarvisTaskDraft,
  completeJarvisTimeDraft,
  completeJarvisVehicleTripCalculationDraft,
  completeJarvisWinterCalculationDraft,
  confirmJarvisPlanningDraft,
  confirmJarvisOfferDraft,
  confirmJarvisOfferFinalizationDraft,
  confirmJarvisOfferDeliveryDraft,
  confirmJarvisOfferDecisionDraft,
  confirmJarvisOfferLifecycleDraft,
  confirmJarvisInvoiceDraft,
  confirmJarvisInvoiceFinalizationDraft,
  confirmJarvisInvoicePaymentDraft,
  confirmJarvisInvoiceReminderDraft,
  confirmJarvisInvoiceCancellationDraft,
  confirmJarvisInvoiceCreditDraft,
  confirmJarvisInvoiceDeliveryDraft,
  confirmJarvisCommunicationDraft,
  confirmJarvisTaskDraft,
  confirmJarvisTimeDraft,
  confirmJarvisVehicleTripCalculationDraft,
  confirmJarvisWinterCalculationDraft,
  getJarvisActionDraft,
  JarvisActionDraftError,
  type JarvisTaskDraftBinding,
} from "@/lib/jarvis/action-draft-store";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";
import { getPublicAppOrigin } from "@/lib/http/public-app-origin";
import {
  executePlanningBatch,
} from "@/lib/planning/planning-batch-service";

export const dynamic = "force-dynamic";

function draftErrorResponse(error: unknown) {
  if (error instanceof JarvisActionDraftError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }
  return NextResponse.json(
    {
      error:
        "Der Aufgabenentwurf konnte nicht sicher verarbeitet werden. Es wurde nichts ausgeführt.",
      code: "execution_failed",
    },
    { status: 500 }
  );
}

function mutationIsSameOrigin(req: Request) {
  const marker = req.headers.get("x-jarvis-action");
  if (
    marker !== "task-draft-v1" &&
    marker !== "jarvis-action-draft-v2"
  ) {
    return false;
  }
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(req.url);
    if (originUrl.origin === requestUrl.origin) return true;
    // Next.js can see the internal upstream URL behind the reverse proxy.
    // Reuse the application's validated public-origin resolver instead of
    // trusting any payload value.
    return originUrl.origin === getPublicAppOrigin(req);
  } catch {
    return false;
  }
}

async function getBinding(req: Request, requestedActorId: unknown) {
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(
    req,
    users,
    requestedActorId
  );
  if (!actorResult.ok) {
    return { response: sessionBoundActorResponse(actorResult) } as const;
  }
  if (!actorResult.sessionId) {
    return {
      response: NextResponse.json(
        {
          error:
            "Für bestätigbare JARVIS-Aktionen ist eine aktuelle serverseitige Sitzung erforderlich. Bitte melde dich neu an.",
          code: "session_required",
        },
        { status: 401 }
      ),
    } as const;
  }
  const sessionActor = users.find(
    (candidate) =>
      candidate.id === actorResult.sessionUserId &&
      candidate.isActive !== false
  );
  if (!sessionActor) {
    return {
      response: NextResponse.json(
        {
          error: "Angemeldeter Benutzer konnte nicht bestimmt werden.",
          code: "scope_mismatch",
        },
        { status: 401 }
      ),
    } as const;
  }
  const binding: JarvisTaskDraftBinding = {
    organizationId: organization.id,
    sessionId: actorResult.sessionId,
    profile: createJarvisAccessProfile(sessionActor, actorResult.actor),
  };
  return { binding } as const;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ previewId: string }> }
) {
  const { previewId } = await context.params;
  const actorId = new URL(req.url).searchParams.get("actorId");
  const resolved = await getBinding(req, actorId);
  if ("response" in resolved) return resolved.response;
  try {
    const actionDraft = await getJarvisActionDraft(
      previewId,
      resolved.binding
    );
    return NextResponse.json({ actionDraft });
  } catch (error) {
    return draftErrorResponse(error);
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ previewId: string }> }
) {
  if (!mutationIsSameOrigin(req)) {
    return NextResponse.json(
      {
        error: "Die Action-Center-Anfrage konnte nicht verifiziert werden.",
        code: "scope_mismatch",
      },
      { status: 403 }
    );
  }
  const { previewId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const resolved = await getBinding(req, body.actorId);
  if ("response" in resolved) return resolved.response;
  try {
    const isPlanning = body.actionId === "planning.prepare";
    const isOffer = body.actionId === "offer.prepare";
    const isOfferFinalization = body.actionId === "offer.finalize";
    const isOfferDelivery = body.actionId === "offer.send";
    const isOfferDecision = body.actionId === "offer.manage";
    const isOfferLifecycle = body.actionId === "offer.delete";
    const isInvoice = body.actionId === "invoice.prepare";
    const isInvoiceFinalization = body.actionId === "invoice.finalize";
    const isInvoicePayment = body.actionId === "invoice.mark-paid";
    const isInvoiceReminder = body.actionId === "invoice.remind";
    const isInvoiceCancellation = body.actionId === "invoice.cancel";
    const isInvoiceCredit = body.actionId === "invoice.credit";
    const isInvoiceDelivery = body.actionId === "document.send";
    const isTime = body.actionId === "time.prepare";
    const isWinterCalculation =
      body.actionId === "winter-calculation.prepare";
    const isVehicleTripCalculation =
      body.actionId === "vehicle-trip-calculation.prepare";
    const isCommunication =
      body.actionId === "project-logbook.prepare" ||
      body.actionId === "task-comment.prepare";
    const actionDraft = isOfferFinalization || isOfferDecision || isOfferLifecycle || isInvoiceFinalization
      ? await getJarvisActionDraft(previewId, resolved.binding)
      : isOfferDelivery
      ? await completeJarvisOfferDeliveryDraft(
          previewId,
          resolved.binding,
          {
            revision: body.revision,
            to: body.to,
            cc: body.cc,
            bcc: body.bcc,
            subject: body.subject,
            body: body.body,
            includeAcceptanceLink: body.includeAcceptanceLink,
          }
        )
      : isInvoicePayment
      ? await completeJarvisInvoicePaymentDraft(
          previewId,
          resolved.binding,
          { revision: body.revision, paymentDate: body.paymentDate }
        )
      : isInvoiceReminder
      ? await completeJarvisInvoiceReminderDraft(
          previewId,
          resolved.binding,
          {
            revision: body.revision,
            reminderDate: body.reminderDate,
            paymentDeadline: body.paymentDeadline,
          }
        )
      : isInvoiceCancellation
      ? await completeJarvisInvoiceCancellationDraft(
          previewId,
          resolved.binding,
          { revision: body.revision, reason: body.reason }
        )
      : isInvoiceCredit
      ? await completeJarvisInvoiceCreditDraft(
          previewId,
          resolved.binding,
          { revision: body.revision, reason: body.reason, items: body.items }
        )
      : isInvoiceDelivery
      ? await completeJarvisInvoiceDeliveryDraft(
          previewId,
          resolved.binding,
          {
            revision: body.revision,
            to: body.to,
            cc: body.cc,
            bcc: body.bcc,
            subject: body.subject,
            body: body.body,
            format: body.format,
          }
        )
      : isInvoice
      ? await completeJarvisInvoiceDraft(
          previewId,
          resolved.binding,
          {
            revision: body.revision,
            projectId: body.projectId,
            company: body.company,
            serviceDate: body.serviceDate,
            sourceOfferId: body.sourceOfferId,
            introText: body.introText,
            closingText: body.closingText,
            vatRate: body.vatRate,
            discountPercent: body.discountPercent,
            paymentTermDays: body.paymentTermDays,
            dueDate: body.dueDate,
            lines: body.lines,
          }
        )
      : isOffer
      ? await completeJarvisOfferDraft(
          previewId,
          resolved.binding,
          {
            revision: body.revision,
            projectId: body.projectId,
            company: body.company,
            offerType: body.offerType,
            addendumMode: body.addendumMode,
            parentOfferId: body.parentOfferId,
            plannedExecutionMonth: body.plannedExecutionMonth,
            plannedExecutionEndMonth: body.plannedExecutionEndMonth,
            introText: body.introText,
            closingText: body.closingText,
            vatRate: body.vatRate,
            discountPercent: body.discountPercent,
            lines: body.lines,
          }
        )
      : isCommunication
      ? await completeJarvisCommunicationDraft(
          previewId,
          resolved.binding,
          {
            revision: body.revision,
            targetId: body.targetId,
            title: body.title,
            text: body.text,
            recipientUserId: body.recipientUserId,
          }
        )
      : isVehicleTripCalculation
      ? await completeJarvisVehicleTripCalculationDraft(
          previewId,
          resolved.binding,
          {
            revision: body.revision,
            vehicleId: body.vehicleId,
            distanceKm: body.distanceKm,
            fuelPriceMode: body.fuelPriceMode,
            manualFuelPricePerLiter: body.manualFuelPricePerLiter,
            note: body.note,
          }
        )
      : isWinterCalculation
      ? await completeJarvisWinterCalculationDraft(
          previewId,
          resolved.binding,
          {
            revision: body.revision,
            input: body.input,
            projectId: body.projectId,
            note: body.note,
          }
        )
      : isTime
        ? await completeJarvisTimeDraft(
            previewId,
            resolved.binding,
            {
              revision: body.revision,
              mode: body.mode,
              projectId: body.projectId,
              unproductiveLabel: body.unproductiveLabel,
              employeeId: body.employeeId,
              date: body.date,
              startTime: body.startTime,
              endTime: body.endTime,
              pauseMinutes: body.pauseMinutes,
              comment: body.comment,
              offerId: body.offerId,
              trade: body.trade,
              billingCatalogItemId: body.billingCatalogItemId,
              completionStatus: body.completionStatus,
              overtimeApprovalStatus: body.overtimeApprovalStatus,
            }
          )
      : isPlanning
        ? await completeJarvisPlanningDraft(
          previewId,
          resolved.binding,
          {
            revision: body.revision,
            title: body.title,
            note: body.note,
            assigneeIds: body.assigneeIds,
            startAt: body.startAt,
            endAt: body.endAt,
            approvalStatus: body.approvalStatus,
            offerId: body.offerId,
            planningTrade: body.planningTrade,
            billingCatalogItemId: body.billingCatalogItemId,
            recurrence: body.recurrence,
            overbookingReason: body.overbookingReason,
            overbookingFingerprint: body.overbookingFingerprint,
          }
        )
        : await completeJarvisTaskDraft(
          previewId,
          resolved.binding,
          {
            revision: body.revision,
            description: body.description,
            assigneeId: body.assigneeId,
            dueAt: body.dueAt,
          }
        );
    return NextResponse.json({
      message:
        isOfferFinalization
          ? "Die Angebotsvorschau ist fest an den aktuellen Entwurfs- und Kalkulationsstand gebunden. Änderungen erfordern eine neue Vorschau."
          : isOfferDecision
          ? "Die Angebotsentscheidung ist fest an Angebot, Entscheidungsart und Dokumentation gebunden. Änderungen erfordern eine neue Vorschau."
          : isOfferLifecycle
          ? "Die Angebotsänderung ist fest an Status, Verknüpfungen und dokumentierten Grund gebunden. Änderungen erfordern eine neue Vorschau."
          : isInvoiceFinalization
          ? "Die Fakturavorschau ist fest an den aktuellen Rechnungs- und Prüfstand gebunden. Änderungen erfordern eine neue Vorschau."
          : isOfferDelivery
          ? "Die Angebotsversandvorschau wurde mit Empfängern, Nachricht, finalem PDF und Annahmelink neu geprüft. Versendet wird erst nach deiner exakten kritischen Bestätigung."
          : isInvoicePayment
          ? "Die Zahlungsvorschau wurde mit dem aktuellen Rechnungsstand und Zahlungsdatum neu geprüft. Gebucht wird erst nach deiner exakten kritischen Bestätigung."
          : isInvoiceReminder
          ? "Die Mahnvorschau wurde mit Rechnungsstand, Fälligkeit, Mahnstufe, Mahndatum und neuer Zahlungsfrist neu geprüft. Erst die exakte kritische Bestätigung erzeugt das Mahndokument."
          : isInvoiceCancellation
          ? "Die Stornovorschau wurde mit Rechnungsstand, Positionen, Gegenbuchung, Zeitverknüpfungen und Grund neu geprüft. Erst die exakte kritische Bestätigung führt das Vollstorno aus."
          : isInvoiceDelivery
          ? "Die Versandvorschau wurde mit Empfängern, Dokumentformat, Anhängen und aktuellem Rechnungsstand neu geprüft. Versendet wird erst nach deiner exakten kritischen Bestätigung."
          : isInvoice
          ? "Der Rechnungsentwurf wurde mit den aktuellen Projekt-, Angebots-, Leistungs- und Fakturadaten neu geprüft. Erst deine bewusste Bestätigung legt genau einen Entwurf an."
          : isOffer
          ? "Der Angebotsentwurf wurde mit den aktuellen Projekt-, Katalog-, Preis- und Nachtragsdaten neu berechnet. Erst deine bewusste Bestätigung legt genau einen Entwurf an."
          : isCommunication
          ? "Der Logbuch-/Kommentarentwurf wurde mit dem aktuellen Ziel-, Rollen- und Beteiligtenstand erneut geprüft. Erst deine bewusste Bestätigung darf genau einen Text speichern."
          : isVehicleTripCalculation
          ? "Die Fahrt wurde mit den aktuellen Fahrzeugwerten und der ausgewählten Kraftstoffpreisquelle neu berechnet. Prüfe Selbstkosten, Verkauf, Gewinn, Aufschlag und Marge; gespeichert wird erst nach deiner ausdrücklichen Bestätigung."
          : isWinterCalculation
          ? "Die Winterdienst-Kalkulation wurde mit der zentralen WorkPilot-Rechenlogik neu berechnet. Prüfe alle Varianten; nur ein freigegebener und ausdrücklich bestätigter Projektbezug darf dauerhaft gespeichert werden."
          : isTime
          ? "Der Zeitentwurf wurde mit den aktuellen Mitarbeiter-, Projekt-, Angebots- und Leistungsdaten erneut geprüft. Erst deine bewusste Bestätigung darf ihn speichern."
          : isPlanning
          ? "Der Terminentwurf wurde erneut fachlich geprüft. Nur wenn keine Prüfung blockiert, kannst du die Anlage bewusst bestätigen."
          : "Der Entwurf ist vollständig. Prüfe die Angaben und bestätige die Anlage bewusst.",
      actionDraft,
    });
  } catch (error) {
    return draftErrorResponse(error);
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ previewId: string }> }
) {
  if (!mutationIsSameOrigin(req)) {
    return NextResponse.json(
      {
        error: "Die Action-Center-Anfrage konnte nicht verifiziert werden.",
        code: "scope_mismatch",
      },
      { status: 403 }
    );
  }
  const { previewId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const resolved = await getBinding(req, body.actorId);
  if ("response" in resolved) return resolved.response;

  try {
    const isPlanning = body.actionId === "planning.prepare";
    const isOffer = body.actionId === "offer.prepare";
    const isOfferFinalization = body.actionId === "offer.finalize";
    const isOfferDelivery = body.actionId === "offer.send";
    const isOfferDecision = body.actionId === "offer.manage";
    const isOfferLifecycle = body.actionId === "offer.delete";
    const isInvoice = body.actionId === "invoice.prepare";
    const isInvoiceFinalization = body.actionId === "invoice.finalize";
    const isInvoicePayment = body.actionId === "invoice.mark-paid";
    const isInvoiceReminder = body.actionId === "invoice.remind";
    const isInvoiceCancellation = body.actionId === "invoice.cancel";
    const isInvoiceCredit = body.actionId === "invoice.credit";
    const isInvoiceDelivery = body.actionId === "document.send";
    const isTime = body.actionId === "time.prepare";
    const isWinterCalculation =
      body.actionId === "winter-calculation.prepare";
    const isVehicleTripCalculation =
      body.actionId === "vehicle-trip-calculation.prepare";
    const isCommunication =
      body.actionId === "project-logbook.prepare" ||
      body.actionId === "task-comment.prepare";
    if (body.command === "cancel") {
      const actionDraft = isOfferFinalization
        ? await cancelJarvisOfferFinalizationDraft(
            previewId,
            resolved.binding,
            body.revision
          )
        : isOfferDelivery
        ? await cancelJarvisOfferDeliveryDraft(
            previewId,
            resolved.binding,
            body.revision
          )
        : isOfferDecision
        ? await cancelJarvisOfferDecisionDraft(
            previewId,
            resolved.binding,
            body.revision
          )
        : isOfferLifecycle
        ? await cancelJarvisOfferLifecycleDraft(
            previewId,
            resolved.binding,
            body.revision
          )
        : isInvoiceFinalization
        ? await cancelJarvisInvoiceFinalizationDraft(
            previewId,
            resolved.binding,
            body.revision
          )
        : isInvoicePayment
        ? await cancelJarvisInvoicePaymentDraft(
            previewId,
            resolved.binding,
            body.revision
          )
        : isInvoiceReminder
        ? await cancelJarvisInvoiceReminderDraft(
            previewId,
            resolved.binding,
            body.revision
          )
        : isInvoiceCancellation
          ? await cancelJarvisInvoiceCancellationDraft(
            previewId,
            resolved.binding,
            body.revision
          )
        : isInvoiceDelivery
        ? await cancelJarvisInvoiceDeliveryDraft(
            previewId,
            resolved.binding,
            body.revision
          )
        : isInvoice
        ? await cancelJarvisInvoiceDraft(
            previewId,
            resolved.binding,
            body.revision
          )
        : isOffer
        ? await cancelJarvisOfferDraft(
            previewId,
            resolved.binding,
            body.revision
          )
        : isCommunication
        ? await cancelJarvisCommunicationDraft(
            previewId,
            resolved.binding,
            body.revision
          )
        : isVehicleTripCalculation
        ? await cancelJarvisVehicleTripCalculationDraft(
            previewId,
            resolved.binding,
            body.revision
          )
        : isWinterCalculation
        ? await cancelJarvisWinterCalculationDraft(
            previewId,
            resolved.binding,
            body.revision
          )
        : isTime
          ? await cancelJarvisTimeDraft(
              previewId,
              resolved.binding,
              body.revision
            )
        : isInvoiceCredit
          ? await cancelJarvisInvoiceCreditDraft(
              previewId,
              resolved.binding,
              body.revision
            )
        : isPlanning
          ? await cancelJarvisPlanningDraft(
            previewId,
            resolved.binding,
            body.revision
          )
          : await cancelJarvisTaskDraft(
            previewId,
            resolved.binding,
            body.revision
          );
      return NextResponse.json({
        message: isOfferFinalization
          ? "Die Angebotsfinalisierung wurde abgebrochen. Das Angebot blieb ein Entwurf."
          : isOfferDecision
          ? "Die Angebotsentscheidung wurde abgebrochen. Angebot und Projekt blieben unverändert."
          : isOfferLifecycle
          ? "Die Angebotsänderung wurde abgebrochen. Angebot und Verknüpfungen blieben unverändert."
          : isOfferDelivery
          ? "Der Angebotsversand wurde abgebrochen. Es wurde keine E-Mail versendet."
          : isInvoiceFinalization
          ? "Die Fakturierung wurde abgebrochen. Die Rechnung blieb ein Entwurf."
          : isInvoicePayment
          ? "Die Zahlungsvorschau wurde abgebrochen. Die Rechnung blieb unverändert offen."
          : isInvoiceReminder
          ? "Die Mahnvorschau wurde abgebrochen. Es wurde kein Mahndokument erzeugt und keine Mahnstufe verändert."
          : isInvoiceCancellation
          ? "Die Stornovorschau wurde abgebrochen. Rechnung, Zeiten und Lager blieben unverändert."
          : isInvoiceCredit
          ? "Die Gutschriftvorschau wurde abgebrochen. Rechnung, Zeiten, Lager und Zahlung blieben unverändert."
          : isInvoiceDelivery
          ? "Der Rechnungsversand wurde abgebrochen. Es wurde keine E-Mail versendet."
          : isInvoice
          ? "Der Rechnungsentwurf wurde abgebrochen. Es wurde keine Rechnung angelegt."
          : isOffer
          ? "Der Angebotsentwurf wurde abgebrochen. Es wurde kein Angebot angelegt."
          : isCommunication
          ? "Der Logbuch-/Kommentarentwurf wurde abgebrochen. Es wurde kein Text gespeichert."
          : isVehicleTripCalculation
          ? "Der Fahrtenentwurf wurde abgebrochen. Es wurde keine Fahrtenkalkulation gespeichert."
          : isWinterCalculation
          ? "Der Kalkulationsentwurf wurde abgebrochen. Es wurde keine Winterdienst-Kalkulation gespeichert."
          : isTime
          ? "Der Zeitentwurf wurde abgebrochen. Es wurde kein Zeiteintrag angelegt."
          : isPlanning
          ? "Der Terminentwurf wurde abgebrochen. Es wurden keine Planungsdaten angelegt."
          : "Der Aufgabenentwurf wurde abgebrochen. Es wurden keine Aufgabendaten angelegt.",
        actionDraft,
      });
    }
    if (body.command !== "confirm") {
      return NextResponse.json(
        {
          error: "Unbekannter Action-Center-Befehl.",
          code: "invalid_input",
        },
        { status: 400 }
      );
    }
    const actionDraft = isOfferFinalization
      ? await confirmJarvisOfferFinalizationDraft(
          previewId,
          resolved.binding,
          body.revision,
          typeof body.confirmationText === "string" ? body.confirmationText : ""
        )
      : isOfferDelivery
      ? await confirmJarvisOfferDeliveryDraft(
          previewId,
          resolved.binding,
          body.revision,
          typeof body.confirmationText === "string" ? body.confirmationText : "",
          req
        )
      : isOfferDecision
      ? await confirmJarvisOfferDecisionDraft(
          previewId,
          resolved.binding,
          body.revision,
          typeof body.confirmationText === "string" ? body.confirmationText : ""
        )
      : isOfferLifecycle
      ? await confirmJarvisOfferLifecycleDraft(
          previewId,
          resolved.binding,
          body.revision,
          typeof body.confirmationText === "string" ? body.confirmationText : ""
        )
      : isInvoiceFinalization
      ? await confirmJarvisInvoiceFinalizationDraft(
          previewId,
          resolved.binding,
          body.revision,
          typeof body.confirmationText === "string"
            ? body.confirmationText
            : ""
        )
      : isInvoicePayment
      ? await confirmJarvisInvoicePaymentDraft(
          previewId,
          resolved.binding,
          body.revision,
          typeof body.confirmationText === "string"
            ? body.confirmationText
            : ""
        )
      : isInvoiceReminder
      ? await confirmJarvisInvoiceReminderDraft(
          previewId,
          resolved.binding,
          body.revision,
          typeof body.confirmationText === "string"
            ? body.confirmationText
            : ""
        )
      : isInvoiceCancellation
      ? await confirmJarvisInvoiceCancellationDraft(
          previewId,
          resolved.binding,
          body.revision,
          typeof body.confirmationText === "string" ? body.confirmationText : ""
        )
      : isInvoiceCredit
      ? await confirmJarvisInvoiceCreditDraft(
          previewId,
          resolved.binding,
          body.revision,
          typeof body.confirmationText === "string" ? body.confirmationText : ""
        )
      : isInvoiceDelivery
      ? await confirmJarvisInvoiceDeliveryDraft(
          previewId,
          resolved.binding,
          body.revision,
          typeof body.confirmationText === "string"
            ? body.confirmationText
            : "",
          req
        )
      : isInvoice
      ? await confirmJarvisInvoiceDraft(
          previewId,
          resolved.binding,
          body.revision
        )
      : isOffer
      ? await confirmJarvisOfferDraft(
          previewId,
          resolved.binding,
          body.revision
        )
      : isCommunication
      ? await confirmJarvisCommunicationDraft(
          previewId,
          resolved.binding,
          body.revision
        )
      : isVehicleTripCalculation
      ? await confirmJarvisVehicleTripCalculationDraft(
          previewId,
          resolved.binding,
          body.revision
        )
      : isWinterCalculation
      ? await confirmJarvisWinterCalculationDraft(
          previewId,
          resolved.binding,
          body.revision
        )
      : isTime
        ? await confirmJarvisTimeDraft(
            previewId,
            resolved.binding,
            body.revision
          )
      : isPlanning
        ? await confirmJarvisPlanningDraft(
          previewId,
          resolved.binding,
          body.revision,
          async (planningInput) => {
            const { organization, users } = await getDemoContext();
            const actor = users.find(
              (user) => user.id === planningInput.actorUserId && user.isActive
            );
            if (!actor || organization.id !== resolved.binding.organizationId) {
              throw new Error("Der gebundene JARVIS-Akteur ist nicht mehr aktiv.");
            }
            const result = await executePlanningBatch({
              organizationId: organization.id,
              timezone: organization.timezone || "Europe/Berlin",
              actor,
              users,
              request: planningInput.planning,
              source: "jarvis",
            });
            return { id: result.batchId };
          }
        )
        : await confirmJarvisTaskDraft(
          previewId,
          resolved.binding,
          body.revision
        );
    return NextResponse.json({
      message:
        actionDraft.state === "executed"
          ? isOfferFinalization
            ? "Das Angebot wurde nach deiner kritischen Bestätigung genau einmal finalisiert und als PDF erzeugt. Versand, Gewonnen/Verloren und Projektstatus blieben unverändert."
            : isOfferDelivery
            ? "Das freigegebene Angebot wurde nach deiner kritischen Bestätigung genau einmal an Microsoft 365 übergeben. PDF, Annahmelink und Versand sind protokolliert; Gewonnen/Verloren und Projektstatus blieben unverändert."
            : isOfferDecision
            ? "Das Angebot wurde nach deiner exakten Bestätigung genau einmal entschieden. Angebotshistorie und Projektlogbuch wurden geschrieben; Projektstatus, Termine, Aufgaben, Rechnungen und Versand blieben unverändert."
            : isOfferLifecycle
            ? "Das Angebot wurde nach deiner exakten Bestätigung genau einmal gelöscht oder wiederhergestellt. Angebotshistorie und Projektlogbuch wurden geschrieben; Projektstatus, Termine, Aufgaben, Rechnungen und Versandprotokolle blieben unverändert."
            : isInvoiceFinalization
            ? "Die Rechnung wurde nach deiner kritischen Bestätigung genau einmal fakturiert. Sie wurde weder versendet noch gemahnt oder als bezahlt markiert."
            : isInvoicePayment
            ? "Der vollständige Zahlungseingang wurde nach deiner kritischen Bestätigung genau einmal gebucht. Es wurde keine Mahnung, kein Storno und kein Versand ausgelöst."
            : isInvoiceReminder
            ? "Die Mahnung wurde nach deiner kritischen Bestätigung genau einmal als PDF erzeugt, in der Projektakte abgelegt und mit der neuen Mahnstufe protokolliert. Es wurde keine E-Mail versendet."
            : isInvoiceCancellation
            ? "Die Rechnung wurde nach deiner kritischen Bestätigung genau einmal vollständig storniert. Stornorechnung, Historie, Logbuch sowie Zeit- und Lagerfreigaben wurden gemeinsam ausgeführt."
            : isInvoiceCredit
            ? "Die Teilgutschrift wurde nach deiner kritischen Bestätigung genau einmal erstellt. GU-Beleg, Historie und Logbuch wurden gemeinsam geschrieben; Zeit, Lager, Zahlung und Versand blieben unverändert."
            : isInvoiceDelivery
            ? "Die freigegebene Rechnung wurde nach deiner kritischen Bestätigung genau einmal an Microsoft 365 übergeben. Der Versand ist protokolliert."
            : isInvoice
            ? "Die Rechnung wurde nach deiner Bestätigung genau einmal als Entwurf angelegt. Sie wurde weder fakturiert noch versendet."
            : isOffer
            ? "Das Angebot wurde nach deiner Bestätigung genau einmal als Entwurf angelegt. Es wurde weder finalisiert noch versendet."
            : isCommunication
            ? "Der Text wurde nach deiner Bestätigung über den gemeinsamen WorkPilot-Service genau einmal gespeichert."
            : isVehicleTripCalculation
            ? "Die Fahrtenkalkulation wurde nach deiner Bestätigung genau einmal als unveränderlicher Snapshot gespeichert."
            : isWinterCalculation
            ? "Die Winterdienst-Kalkulation wurde nach deiner Bestätigung genau einmal als unveränderliche Version gespeichert."
            : isTime
            ? "Der manuelle Zeiteintrag wurde nach deiner Bestätigung genau einmal gespeichert."
            : isPlanning
            ? "Der Termin wurde nach deiner Bestätigung über den Planning-Service genau einmal angelegt."
            : "Die Aufgabe wurde nach deiner Bestätigung genau einmal angelegt."
          : isOfferFinalization
            ? "Das Angebot wurde nicht finalisiert."
            : isOfferDecision
            ? "Das Angebot wurde nicht entschieden."
            : isOfferLifecycle
            ? "Das Angebot wurde nicht gelöscht oder wiederhergestellt."
            : isOfferDelivery
            ? "Das Angebot wurde nicht versendet."
            : isInvoiceFinalization
            ? "Die Rechnung wurde nicht fakturiert."
            : isInvoicePayment
            ? "Der Zahlungseingang wurde nicht gebucht."
            : isInvoiceReminder
            ? "Die Mahnung wurde nicht erzeugt."
            : isInvoiceCancellation
            ? "Die Rechnung wurde nicht storniert."
            : isInvoiceCredit
            ? "Die Teilgutschrift wurde nicht erstellt."
            : isInvoiceDelivery
            ? "Die Rechnung wurde nicht versendet."
            : isInvoice
            ? "Der Rechnungsentwurf wurde nicht ausgeführt."
            : isOffer
            ? "Der Angebotsentwurf wurde nicht ausgeführt."
            : isCommunication
            ? "Der Logbuch-/Kommentarentwurf wurde nicht gespeichert."
            : isVehicleTripCalculation
            ? "Der Fahrtenentwurf wurde nicht gespeichert."
            : isWinterCalculation
            ? "Der Kalkulationsentwurf wurde nicht gespeichert."
            : isTime
            ? "Der Zeitentwurf wurde nicht ausgeführt."
            : isPlanning
            ? "Der Terminentwurf wurde nicht ausgeführt."
            : "Der Aufgabenentwurf wurde nicht ausgeführt.",
      actionDraft,
    });
  } catch (error) {
    return draftErrorResponse(error);
  }
}
