import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import {
  findJarvisExactHelpTopicId,
  resolveJarvisDirectNavigationHelp,
  resolveJarvisOperationalGuidance,
  resolveJarvisProjectTypeOverview,
  resolveJarvisSystemHelp,
  resolveJarvisSystemHelpTopic,
  sanitizeJarvisSurfaceContext,
} from "@/lib/jarvis/knowledge";
import {
  classifyJarvisIntentWithAi,
  type JarvisAiIntentClassification,
} from "@/lib/jarvis/ai-intent-fallback";
import {
  resolveJarvisPersonDiagnosticIntent,
  resolveJarvisPersonDiagnosticRequest,
  resolveJarvisPersonIntent,
  resolveJarvisPersonSummaryRequest,
} from "@/lib/jarvis/person-summary";
import { resolveJarvisReadRequest } from "@/lib/jarvis/read-model";
import {
  resolveJarvisSalesAnalysisIntent,
  resolveJarvisSalesAnalysisRequest,
} from "@/lib/jarvis/sales-analysis";
import {
  resolveJarvisOrganizationMaterialIntent,
  resolveJarvisOrganizationMaterialRequest,
} from "@/lib/jarvis/organization-material-analysis";
import { resolveJarvisOrganizationServiceRateRequest } from "@/lib/jarvis/organization-service-rate-analysis";
import { resolveJarvisOnlineRequestAnalysis } from "@/lib/jarvis/online-request-analysis";
import {
  resolveJarvisOrganizationReceivablesIntent,
  resolveJarvisOrganizationReceivablesRequest,
} from "@/lib/jarvis/organization-receivables-analysis";
import {
  resolveJarvisOrganizationOfferAgingIntent,
  resolveJarvisOrganizationOfferAgingRequest,
} from "@/lib/jarvis/organization-offer-aging-analysis";
import {
  resolveJarvisProjectReviewInventoryIntent,
  resolveJarvisProjectReviewInventoryRequest,
} from "@/lib/jarvis/organization-project-review-analysis";
import { resolveJarvisProjectHealthRequest } from "@/lib/jarvis/project-health";
import {
  authorizeJarvisQuestion,
  createJarvisAccessProfile,
  getJarvisAuthorizationRefusalMessage,
} from "@/lib/jarvis/security";
import { applyJarvisAnswerPolicy } from "@/lib/jarvis/answer-policy";
import { resolveJarvisAccessPolicyQuestion } from "@/lib/jarvis/access-policy";
import { resolveJarvisCapabilityGap } from "@/lib/jarvis/capability-gap";
import {
  resolveJarvisIntentDecision,
  type JarvisIntentDecision,
} from "@/lib/jarvis/intent-decision";
import {
  doesJarvisResponseFitRoute,
  getJarvisReadHint,
  resolveJarvisRoutePlan,
} from "@/lib/jarvis/intent-orchestrator";
import {
  buildJarvisIntentClarification,
  buildJarvisProjectMatrixClarification,
  buildJarvisProjectScopeSequenceClarification,
  buildJarvisProjectSequenceClarification,
  buildJarvisProjectSequenceContinuation,
  resolveJarvisGuidedSequenceContinuation,
  resolveJarvisIntentSequenceContinuation,
} from "@/lib/jarvis/intent-clarification";
import {
  buildJarvisDialogState,
  extractJarvisProjectReferences,
  getJarvisDialogConversationContext,
  isJarvisReferentialFollowUp,
  sanitizeJarvisDialogState,
  shouldCarryJarvisActiveRecord,
} from "@/lib/jarvis/dialog-state";
import { createJarvisDialogChoice } from "@/lib/jarvis/dialog";
import { resolveJarvisProjectDialogIntent } from "@/lib/jarvis/project-dialog-intent";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import { analyzeJarvisQuestion } from "@/lib/jarvis/question-semantics";
import {
  createJarvisActionPreview,
  extractJarvisPlanningPreviewDetails,
  extractJarvisTaskPreviewTitle,
} from "@/lib/jarvis/action-center";
import {
  completeJarvisVehicleTripCalculationDraft,
  completeJarvisWinterCalculationDraft,
  createPersistedJarvisPlanningDraft,
  createPersistedJarvisOfferDraft,
  createPersistedJarvisInvoiceDraft,
  createPersistedJarvisInvoiceFinalizationDraft,
  createPersistedJarvisInvoiceDeliveryDraft,
  createPersistedJarvisCommunicationDraft,
  createPersistedJarvisTaskDraft,
  createPersistedJarvisTimeDraft,
  createPersistedJarvisVehicleTripCalculationDraft,
  createPersistedJarvisWinterCalculationDraft,
  JarvisActionDraftError,
} from "@/lib/jarvis/action-draft-store";
import {
  extractJarvisVehicleCalculationIntake,
  extractJarvisWinterCalculationIntake,
  looksLikeGenericJarvisCalculatorStart,
  matchJarvisVehicleOption,
} from "@/lib/jarvis/calculator-intake";
import {
  extractOfferDraftKind,
  extractOfferExecutionMonth,
  looksLikeOfferDraftRequest,
} from "@/lib/jarvis/offer-intake";
import {
  extractInvoiceCompany,
  extractInvoiceNumber,
  extractInvoiceServiceDate,
  looksLikeInvoiceDraftRequest,
  looksLikeInvoiceDeliveryRequest,
  looksLikeInvoiceFinalizationRequest,
} from "@/lib/jarvis/invoice-intake";

export const dynamic = "force-dynamic";

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function buildJarvisOfferDraft(input: {
  question: string;
  organizationId: string;
  sessionId: string | null;
  accessProfile: ReturnType<typeof createJarvisAccessProfile>;
  context: ReturnType<typeof sanitizeJarvisSurfaceContext>;
}) {
  if (!input.sessionId) {
    return {
      type: "refusal" as const,
      topicId: "action.draft.session-required",
      message:
        "Für einen bestätigbaren Angebotsentwurf ist eine aktuelle serverseitige Sitzung erforderlich. Bitte melde dich neu an; es wurde nichts gespeichert.",
    };
  }
  const projectReferences = extractJarvisProjectReferences(input.question);
  const explicitProject =
    input.context.recordType === "project" && input.context.recordId
      ? { id: input.context.recordId }
      : projectReferences.length === 1
        ? await prisma.workPilotProject.findFirst({
            where: {
              organizationId: input.organizationId,
              projectNumber: {
                equals: projectReferences[0],
                mode: "insensitive",
              },
            },
            select: { id: true },
          })
        : null;
  const kind = extractOfferDraftKind(input.question);
  const preview = createJarvisActionPreview({
    previewId: randomUUID(),
    actionId: "offer.prepare",
    payload: {
      ...(explicitProject?.id ? { projectId: explicitProject.id } : {}),
      ...(kind.company ? { company: kind.company } : {}),
      offerType: kind.offerType,
      ...(extractOfferExecutionMonth(input.question)
        ? {
            plannedExecutionMonth:
              extractOfferExecutionMonth(input.question),
          }
        : {}),
    },
    organizationId: input.organizationId,
    profile: input.accessProfile,
    createdAt: new Date().toISOString(),
  });
  if (!preview.ok) {
    return {
      type: "refusal" as const,
      topicId: "action.draft.offer.refused",
      message: `${preview.message} Es wurde kein Angebot angelegt.`,
    };
  }
  try {
    const actionDraft = await createPersistedJarvisOfferDraft({
      preview: preview.value,
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      profile: input.accessProfile,
    });
    return {
      type: "answer" as const,
      topicId: "action.draft.offer",
      message:
        "Ich habe einen sicheren Angebotsentwurf vorbereitet. Wähle Projekt und Katalogpositionen, prüfe Mengen, Preise, Nachlass, Umsatzsteuer und Ausführungsmonat. Erst deine ausdrückliche Bestätigung legt genau einen Entwurf an; JARVIS finalisiert oder versendet ihn nicht.",
      actionDraft,
    };
  } catch (error) {
    return {
      type: "refusal" as const,
      topicId: "action.draft.unavailable",
      message: `${
        error instanceof JarvisActionDraftError
          ? error.message
          : "Der Angebotsentwurf konnte nicht sicher vorbereitet werden."
      } Es wurde kein Angebot angelegt.`,
    };
  }
}

async function buildJarvisInvoiceDraft(input: {
  question: string;
  organizationId: string;
  sessionId: string | null;
  accessProfile: ReturnType<typeof createJarvisAccessProfile>;
  context: ReturnType<typeof sanitizeJarvisSurfaceContext>;
}) {
  if (!input.sessionId) {
    return {
      type: "refusal" as const,
      topicId: "action.draft.session-required",
      message:
        "Für einen bestätigbaren Rechnungsentwurf ist eine aktuelle serverseitige Sitzung erforderlich. Bitte melde dich neu an; es wurde nichts gespeichert.",
    };
  }
  const projectReferences = extractJarvisProjectReferences(input.question);
  const explicitProject =
    input.context.recordType === "project" && input.context.recordId
      ? { id: input.context.recordId }
      : projectReferences.length === 1
        ? await prisma.workPilotProject.findFirst({
            where: {
              organizationId: input.organizationId,
              projectNumber: {
                equals: projectReferences[0],
                mode: "insensitive",
              },
            },
            select: { id: true },
          })
        : null;
  const serviceDate = extractInvoiceServiceDate(input.question);
  const company = extractInvoiceCompany(input.question);
  const preview = createJarvisActionPreview({
    previewId: randomUUID(),
    actionId: "invoice.prepare",
    payload: {
      ...(explicitProject?.id ? { projectId: explicitProject.id } : {}),
      ...(company ? { company } : {}),
      ...(serviceDate ? { serviceDate } : {}),
    },
    organizationId: input.organizationId,
    profile: input.accessProfile,
    createdAt: new Date().toISOString(),
  });
  if (!preview.ok) {
    return {
      type: "refusal" as const,
      topicId: "action.draft.invoice.refused",
      message: `${preview.message} Es wurde keine Rechnung angelegt.`,
    };
  }
  try {
    const actionDraft = await createPersistedJarvisInvoiceDraft({
      preview: preview.value,
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      profile: input.accessProfile,
    });
    return {
      type: "answer" as const,
      topicId: "action.draft.invoice",
      message:
        "Ich habe einen sicheren Rechnungsentwurf mit Fakturavorprüfung vorbereitet. Prüfe Projekt, Leistungsdatum, Angebot, Positionen, Nachlass, Umsatzsteuer, Zahlungsziel und alle Warnungen. Erst deine ausdrückliche Bestätigung legt genau einen Entwurf an; JARVIS fakturiert oder versendet ihn nicht.",
      actionDraft,
    };
  } catch (error) {
    return {
      type: "refusal" as const,
      topicId: "action.draft.unavailable",
      message: `${
        error instanceof JarvisActionDraftError
          ? error.message
          : "Der Rechnungsentwurf konnte nicht sicher vorbereitet werden."
      } Es wurde keine Rechnung angelegt.`,
    };
  }
}

async function buildJarvisInvoiceFinalizationDraft(input: {
  question: string;
  organizationId: string;
  sessionId: string | null;
  accessProfile: ReturnType<typeof createJarvisAccessProfile>;
  context: ReturnType<typeof sanitizeJarvisSurfaceContext>;
}) {
  if (!input.sessionId) {
    return {
      type: "refusal" as const,
      topicId: "action.invoice-finalize.session-required",
      message:
        "Für eine kritische Fakturierung ist eine aktuelle serverseitige Sitzung erforderlich. Es wurde nichts verändert.",
    };
  }
  const invoiceNumber = extractInvoiceNumber(input.question);
  const invoice = invoiceNumber
    ? await prisma.invoice.findFirst({
        where: {
          invoiceNumber: {
            equals: invoiceNumber,
            mode: "insensitive",
          },
          organizationId: input.organizationId,
        },
        select: { id: true, invoiceNumber: true, status: true },
      })
    : null;
  if (!invoice) {
    const drafts = await prisma.invoice.findMany({
      where: {
        organizationId: input.organizationId,
        status: "Entwurf",
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { invoiceNumber: true, customerName: true },
    });
    return {
      type: "clarification" as const,
      topicId: "action.invoice-finalize.choose",
      message:
        drafts.length > 0
          ? "Welche Rechnungsnummer soll kontrolliert fakturiert werden? Es wurde noch nichts verändert."
          : "Es gibt aktuell keinen Rechnungsentwurf, den JARVIS fakturieren könnte.",
      choices: drafts.map((draft) =>
        createJarvisDialogChoice(
          `invoice-finalize-${draft.invoiceNumber}`,
          `${draft.invoiceNumber} · ${draft.customerName || "ohne Kunde"}`,
          `Fakturiere Rechnung ${draft.invoiceNumber}`
        )
      ),
    };
  }
  if (invoice.status !== "Entwurf") {
    return {
      type: "refusal" as const,
      topicId: "action.invoice-finalize.invalid-state",
      message: `${invoice.invoiceNumber} ist keine fakturierbare Entwurfsrechnung. Es wurde nichts verändert.`,
    };
  }
  const preview = createJarvisActionPreview({
    previewId: randomUUID(),
    actionId: "invoice.finalize",
    payload: { invoiceId: invoice.id },
    organizationId: input.organizationId,
    profile: input.accessProfile,
    createdAt: new Date().toISOString(),
  });
  if (!preview.ok) {
    return {
      type: "refusal" as const,
      topicId: "action.invoice-finalize.refused",
      message: `${preview.message} Es wurde nichts fakturiert.`,
    };
  }
  try {
    const actionDraft =
      await createPersistedJarvisInvoiceFinalizationDraft({
        preview: preview.value,
        organizationId: input.organizationId,
        sessionId: input.sessionId,
        profile: input.accessProfile,
      });
    return {
      type: "answer" as const,
      topicId: "action.invoice-finalize",
      message:
        "Ich habe den aktuellen Rechnungsentwurf erneut serverseitig geprüft. Kontrolliere Betrag, Nachweise und Warnungen. Zur Fakturierung musst du die angezeigte kritische Bestätigungsphrase exakt eingeben. Versand, Mahnung und Bezahlt-Markierung werden nicht ausgelöst.",
      actionDraft,
    };
  } catch (error) {
    return {
      type: "refusal" as const,
      topicId: "action.invoice-finalize.unavailable",
      message: `${
        error instanceof JarvisActionDraftError
          ? error.message
          : "Die Fakturavorschau konnte nicht sicher vorbereitet werden."
      } Es wurde nichts fakturiert.`,
    };
  }
}

async function buildJarvisInvoiceDeliveryDraft(input: {
  question: string;
  organizationId: string;
  sessionId: string | null;
  accessProfile: ReturnType<typeof createJarvisAccessProfile>;
  context: ReturnType<typeof sanitizeJarvisSurfaceContext>;
}) {
  if (!input.sessionId) {
    return {
      type: "refusal" as const,
      topicId: "action.invoice-send.session-required",
      message:
        "Für einen kontrollierten Rechnungsversand ist eine aktuelle serverseitige Sitzung erforderlich. Es wurde nichts versendet.",
    };
  }
  const invoiceNumber = extractInvoiceNumber(input.question);
  const invoice = invoiceNumber
    ? await prisma.invoice.findFirst({
        where: {
          invoiceNumber: {
            equals: invoiceNumber,
            mode: "insensitive",
          },
          organizationId: input.organizationId,
        },
        select: {
          id: true,
          invoiceNumber: true,
          customerName: true,
          status: true,
          isPaid: true,
        },
      })
    : null;
  if (!invoice) {
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: input.organizationId,
        OR: [
          { status: "Fakturiert" },
          { status: "Bezahlt" },
          { isPaid: true },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { invoiceNumber: true, customerName: true },
    });
    return {
      type: "clarification" as const,
      topicId: "action.invoice-send.choose",
      message:
        invoices.length > 0
          ? "Welche fakturierte Rechnung soll kontrolliert versendet werden? Es wurde noch nichts versendet."
          : "Es gibt aktuell keine fakturierte Rechnung, die JARVIS versenden könnte.",
      choices: invoices.map((candidate) =>
        createJarvisDialogChoice(
          `invoice-send-${candidate.invoiceNumber}`,
          `${candidate.invoiceNumber} · ${candidate.customerName || "ohne Kunde"}`,
          `Sende Rechnung ${candidate.invoiceNumber}`
        )
      ),
    };
  }
  if (
    invoice.status !== "Fakturiert" &&
    invoice.status !== "Bezahlt" &&
    !invoice.isPaid
  ) {
    return {
      type: "refusal" as const,
      topicId: "action.invoice-send.invalid-state",
      message: `${invoice.invoiceNumber} ist noch nicht fakturiert und darf deshalb nicht versendet werden. Es wurde nichts versendet.`,
    };
  }
  const preview = createJarvisActionPreview({
    previewId: randomUUID(),
    actionId: "document.send",
    payload: { invoiceId: invoice.id },
    organizationId: input.organizationId,
    profile: input.accessProfile,
    createdAt: new Date().toISOString(),
  });
  if (!preview.ok) {
    return {
      type: "refusal" as const,
      topicId: "action.invoice-send.refused",
      message: `${preview.message} Es wurde nichts versendet.`,
    };
  }
  try {
    const actionDraft = await createPersistedJarvisInvoiceDeliveryDraft({
      preview: preview.value,
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      profile: input.accessProfile,
    });
    return {
      type: "answer" as const,
      topicId: "action.invoice-send",
      message:
        "Ich habe eine kontrollierte Versandvorschau vorbereitet. Prüfe Empfänger, Betreff, Nachricht, Dokumentformat, Anhänge und technische Validierung. Erst die exakt angezeigte kritische Bestätigungsphrase übergibt diese Rechnung einmalig an Microsoft 365.",
      actionDraft,
    };
  } catch (error) {
    return {
      type: "refusal" as const,
      topicId: "action.invoice-send.unavailable",
      message: `${
        error instanceof JarvisActionDraftError
          ? error.message
          : "Die Versandvorschau konnte nicht sicher vorbereitet werden."
      } Es wurde nichts versendet.`,
    };
  }
}

async function buildJarvisTaskPreview(input: {
  question: string;
  organizationId: string;
  sessionId: string | null;
  accessProfile: ReturnType<typeof createJarvisAccessProfile>;
  context: ReturnType<typeof sanitizeJarvisSurfaceContext>;
}) {
  const title = extractJarvisTaskPreviewTitle(input.question);
  if (!title) return undefined;
  const preview = createJarvisActionPreview({
    previewId: randomUUID(),
    actionId: "task.prepare",
    payload: {
      title,
      ...(input.context.recordType === "project" && input.context.recordId
        ? { projectId: input.context.recordId }
        : {}),
    },
    organizationId: input.organizationId,
    profile: input.accessProfile,
    createdAt: new Date().toISOString(),
  });
  if (!preview.ok) return undefined;

  if (!input.sessionId) {
    return {
      type: "refusal" as const,
      topicId: "action.draft.session-required",
      message:
        "Für bestätigbare JARVIS-Aktionen ist eine aktuelle serverseitige Sitzung erforderlich. Bitte melde dich neu an; es wurde nichts gespeichert oder ausgeführt.",
    };
  }

  try {
    const actionDraft = await createPersistedJarvisTaskDraft({
      preview: preview.value,
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      profile: input.accessProfile,
      context: input.context,
    });
    return {
      type: "answer" as const,
      topicId: "action.draft.task",
      message:
        "Ich habe einen sicheren Aufgabenentwurf vorbereitet. Ergänze Verantwortlichkeit und Fälligkeit und prüfe anschließend alle Angaben. Erst deine ausdrückliche Bestätigung darf genau eine Aufgabe anlegen.",
      actionDraft,
    };
  } catch (error) {
    const message =
      error instanceof JarvisActionDraftError
        ? error.message
        : "Der Aufgabenentwurf konnte nicht sicher gespeichert werden.";
    return {
      type: "refusal" as const,
      topicId: "action.draft.unavailable",
      message: `${message} Es wurde nichts ausgeführt.`,
    };
  }
}

function looksLikeProjectLogbookWriteRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    /\b(?:logbuch|projektlogbuch|projektakte)\w*\b/.test(value) &&
    /\b(?:schreib|trage|trag|dokumentier|notier|erganz|fug|hinzufug|speicher|erstell|anleg|verfass)\w*\b/.test(
      value
    ) &&
    !/\b(?:such|zeig|lies|lese|was|welch|warum)\w*\b/.test(value)
  );
}

function looksLikeTaskCommentWriteRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    /\baufgabe\w*\b/.test(value) &&
    /\bkommentar\w*\b/.test(value) &&
    /\b(?:kommentier|schreib|trage|trag|notier|erganz|fug|hinzufug|speicher)\w*\b/.test(
      value
    ) &&
    !/\b(?:such|zeig|lies|lese|was|welch|warum)\w*\b/.test(value)
  );
}

function extractCommunicationText(question: string) {
  const quoted = question.match(/[„“"]([^„“"]{2,4000})[“"]/u)?.[1]?.trim();
  if (quoted) return quoted;
  const explicitText = question.match(
    /\b(?:text|inhalt)\s+(.{2,4000})$/iu
  )?.[1]?.trim();
  if (explicitText) return explicitText;
  const marker = question.match(
    /(?:\bdass\b|:\s*)(.{2,4000})$/iu
  )?.[1]?.trim();
  return marker || undefined;
}

function extractProjectLogbookTitle(question: string) {
  return question
    .match(
      /\b(?:titel|überschrift|ueberschrift)\s+(.{2,160}?)(?=\s+und\s+(?:dem\s+)?(?:text|inhalt)\b|[.!?]?\s*$)/iu
    )?.[1]
    ?.trim();
}

async function buildJarvisCommunicationDraft(input: {
  question: string;
  actionId: "project-logbook.prepare" | "task-comment.prepare";
  organizationId: string;
  sessionId: string | null;
  accessProfile: ReturnType<typeof createJarvisAccessProfile>;
  context: ReturnType<typeof sanitizeJarvisSurfaceContext>;
}) {
  if (!input.sessionId) {
    return {
      type: "refusal" as const,
      topicId: "action.draft.session-required",
      message:
        "Für bestätigbare JARVIS-Aktionen ist eine aktuelle serverseitige Sitzung erforderlich. Bitte melde dich neu an; es wurde nichts gespeichert.",
    };
  }
  let targetId =
    input.actionId === "project-logbook.prepare" &&
    input.context.recordType === "project"
      ? input.context.recordId
      : undefined;
  if (input.actionId === "project-logbook.prepare") {
    const projectReference = extractJarvisProjectReferences(input.question)[0];
    if (projectReference) {
      const project = await prisma.workPilotProject.findFirst({
        where: {
          organizationId: input.organizationId,
          projectNumber: {
            equals: projectReference,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });
      targetId = project?.id;
    }
  }
  const text = extractCommunicationText(input.question);
  const projectLogbookTitle =
    input.actionId === "project-logbook.prepare"
      ? extractProjectLogbookTitle(input.question)
      : undefined;
  const preview = createJarvisActionPreview({
    previewId: randomUUID(),
    actionId: input.actionId,
    payload:
      input.actionId === "project-logbook.prepare"
        ? {
            projectId: targetId,
            title: projectLogbookTitle || "JARVIS-Eintrag",
            text,
          }
        : {
            taskId: targetId,
            text,
          },
    organizationId: input.organizationId,
    profile: input.accessProfile,
    createdAt: new Date().toISOString(),
  });
  if (!preview.ok) {
    return {
      type: "refusal" as const,
      topicId: "action.draft.unavailable",
      message: `${preview.message} Es wurde nichts gespeichert.`,
    };
  }
  try {
    const actionDraft = await createPersistedJarvisCommunicationDraft({
      preview: preview.value,
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      profile: input.accessProfile,
    });
    return {
      type: "answer" as const,
      topicId:
        input.actionId === "project-logbook.prepare"
          ? "action.draft.project-logbook"
          : "action.draft.task-comment",
      message:
        input.actionId === "project-logbook.prepare"
          ? "Ich habe einen sicheren Projektlogbuch-Entwurf vorbereitet. Prüfe Projekt, Titel und Text. Anhänge oder E-Mails werden nicht erzeugt; erst deine ausdrückliche Bestätigung speichert genau einen Eintrag."
          : "Ich habe einen sicheren Aufgabenkommentar vorbereitet. Prüfe Aufgabe, Text und bei Bedarf die empfangende beteiligte Person. Erst deine ausdrückliche Bestätigung speichert genau einen Kommentar und löst die bestehenden Benachrichtigungen aus.",
      actionDraft,
    };
  } catch (error) {
    const message =
      error instanceof JarvisActionDraftError
        ? error.message
        : "Der Logbuch-/Kommentarentwurf konnte nicht sicher vorbereitet werden.";
    return {
      type: "refusal" as const,
      topicId: "action.draft.unavailable",
      message: `${message} Es wurde nichts gespeichert.`,
    };
  }
}

function looksLikeWinterCalculationStartRequest(question: string) {
  const value = normalizePersonLabel(question);
  if (
    !/\bwinterdienst\w*\b/.test(value) ||
    !/\b(?:kalkulier|berechne|rechne|rechnung|kalkulation|rechner|kostet|kosten)\w*\b/.test(
      value
    )
  ) {
    return false;
  }
  return (
    /^\s*(?:starte|start|kalkulier|berechne|rechne|erstelle|mach|mache|offne)\w*\b/.test(
      value
    ) ||
    /\bich mochte\b.*\b(?:kalkulier|berechne|rechne)\w*\b/.test(value) ||
    /\bmit jarvis\b.*\b(?:kalkulier|berechne|rechne)\w*\b/.test(value) ||
    /^\s*was kostet\b/.test(value)
  );
}

function looksLikeManualTimeEntryRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  if (
    /\b(?:loschen|entfernen|korrigieren|bearbeiten)\w*\b/.test(value) ||
    looksLikeLiveStampRequest(question)
  ) {
    return false;
  }
  return (
    (/\b(?:zeiteintrag|projektzeit|arbeitszeit|stunden|stempelung)\w*\b/.test(
      value
    ) ||
      /\bunproduktiv\w*\s+zeit\b/.test(value)) &&
    /\b(?:erfass|trag|trage|buch|buche|speicher|leg|lege|nachtrag|nachtragen|hinzufug)\w*\b/.test(
      value
    )
  );
}

function looksLikeLiveStampRequest(question: string) {
  return /^\s*(?:stempel|stemple)\b/u.test(
    normalizeJarvisIntentText(question)
  );
}

function getRelativeBerlinDateKey(offsetDays: number, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((candidate) => candidate.type === type)?.value ?? 0);
  return new Date(
    Date.UTC(part("year"), part("month") - 1, part("day") + offsetDays, 12)
  )
    .toISOString()
    .slice(0, 10);
}

function extractManualTimeInitialValues(question: string) {
  const normalizedQuestion = normalizeJarvisIntentText(question);
  const dateMatch = question.match(
    /\b(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/u
  );
  const timeMatch = question.match(
    /\bvon\s+([01]?\d|2[0-3]):([0-5]\d)\s*(?:uhr\s*)?bis\s+([01]?\d|2[0-3]):([0-5]\d)\b/iu
  );
  const pauseMatch = question.match(
    /\bpause\s+(?:von\s+)?(\d{1,4})\s*(?:minuten?|min\.?)\b/iu
  );
  const commentMatch =
    question.match(
      /\b(?:kommentar|begr[uü]ndung|notiz)\s*[„"']([^„“"']{1,2000})[“"']/iu
    ) ??
    question.match(
      /\b(?:kommentar|begr[uü]ndung|notiz)\s*:\s*([^.;]{1,2000})/iu
    );
  const comment = commentMatch?.[1]?.trim() ?? "";
  const mode = /\bunproduktiv\w*\b/iu.test(question)
    ? ("unproductive" as const)
    : ("project" as const);
  let date: string | undefined;
  if (dateMatch) {
    const yearNumber = Number(dateMatch[3]);
    date = `${yearNumber < 100 ? 2000 + yearNumber : yearNumber}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
  } else if (/\bvorgestern\b/u.test(normalizedQuestion)) {
    date = getRelativeBerlinDateKey(-2);
  } else if (/\bgestern\b/u.test(normalizedQuestion)) {
    date = getRelativeBerlinDateKey(-1);
  } else if (/\bheute\b/u.test(normalizedQuestion)) {
    date = getRelativeBerlinDateKey(0);
  }
  return {
    ...(date ? { date } : {}),
    ...(timeMatch
      ? {
          startTime: `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`,
          endTime: `${timeMatch[3].padStart(2, "0")}:${timeMatch[4]}`,
        }
      : {}),
    pauseMinutes: pauseMatch ? Number(pauseMatch[1]) : 0,
    ...(comment ? { comment } : {}),
    ...(mode === "unproductive" && comment
      ? { unproductiveLabel: comment.slice(0, 240) }
      : {}),
    mode,
    ...(/\b(?:erledigt|fertig|abgeschlossen)\b/iu.test(question)
      ? { completionStatus: "finished" as const }
      : /\bunterbrochen\b/iu.test(question)
        ? { completionStatus: "interrupted" as const }
        : {}),
    ...(/\buberstunden?\b.*\bfreigegeben\b/u.test(normalizedQuestion)
      ? { overtimeApprovalStatus: "approved" as const }
      : /\buberstunden?\b.*\b(?:prufen|offen|ausstehend)\b/u.test(
            normalizedQuestion
          )
        ? { overtimeApprovalStatus: "pending" as const }
        : {}),
  };
}

async function buildJarvisTimeDraft(input: {
  question: string;
  organizationId: string;
  sessionId: string | null;
  accessProfile: ReturnType<typeof createJarvisAccessProfile>;
  context: ReturnType<typeof sanitizeJarvisSurfaceContext>;
  users: Array<{
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    isActive?: boolean;
  }>;
}) {
  if (!input.sessionId) {
    return {
      type: "refusal" as const,
      topicId: "action.draft.session-required",
      message:
        "Für einen bestätigbaren manuellen Zeiteintrag ist eine aktuelle serverseitige Sitzung erforderlich. Bitte melde dich neu an; es wurde nichts gespeichert.",
    };
  }
  const normalizedQuestion = normalizePersonLabel(input.question);
  const namedEmployee = input.users.find((user) => {
    if (!user.id || user.isActive === false) return false;
    const label = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    return (
      label.length >= 3 &&
      normalizedQuestion.includes(normalizePersonLabel(label))
    );
  });
  const initial = {
    ...extractManualTimeInitialValues(input.question),
    ...(namedEmployee ? { employeeId: namedEmployee.id } : {}),
  };
  try {
    const actionDraft = await createPersistedJarvisTimeDraft({
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      profile: input.accessProfile,
      projectId:
        initial.mode === "project" &&
        input.context.recordType === "project" &&
        input.context.recordId
          ? input.context.recordId
          : undefined,
      initial,
    });
    return {
      type: "answer" as const,
      topicId: "action.draft.time",
      message:
        "Ich habe einen sicheren Entwurf für einen manuellen Zeiteintrag angelegt. Ergänze die noch fehlenden Angaben und prüfe Projektart, Auftragsgrundlage beziehungsweise Gewerk und Abrechnungsleistung. Erst deine ausdrückliche Bestätigung darf genau einen Zeiteintrag speichern. Eine laufende Stempelung wird dadurch weder gestartet noch verändert.",
      actionDraft,
    };
  } catch (error) {
    const message =
      error instanceof JarvisActionDraftError
        ? error.message
        : "Der manuelle Zeitentwurf konnte nicht sicher vorbereitet werden.";
    return {
      type: "refusal" as const,
      topicId: "action.draft.unavailable",
      message: `${message} Es wurde kein Zeiteintrag gespeichert.`,
    };
  }
}

function looksLikeVehicleTripCalculationStartRequest(question: string) {
  const value = normalizePersonLabel(question);
  const hasCalculation =
    /\b\w*(?:kalkulier|berechne|rechne|rechnung|kalkulation|rechner|kostet)\w*\b/.test(
      value
    );
  const hasVehicleTripScope =
    /\b(?:fahrt(?:en)?(?:kosten)?|fahrzeug(?:kosten|kalkulation)?|kilometerkosten)\w*\b/.test(
      value
    );
  if (!hasCalculation || !hasVehicleTripScope) return false;
  if (/\b(?:vermiet|mietfahrzeug|mietpreis)\w*\b/.test(value)) return false;
  return (
    /^\s*(?:starte|start|kalkulier|berechne|rechne|erstelle|mach|mache|offne)\w*\b/.test(
      value
    ) ||
    /\bich mochte\b.*\b(?:kalkulier|berechne|rechne)\w*\b/.test(value) ||
    /\bmit jarvis\b.*\b(?:kalkulier|berechne|rechne)\w*\b/.test(value) ||
    /^\s*was kostet\b/.test(value)
  );
}

function looksLikeVehicleRentalRequest(question: string) {
  const value = normalizePersonLabel(question);
  return (
    /\b\w*(?:vermiet|mietfahrzeug|mietpreis|fahrzeugmiete)\w*\b/.test(
      value
    ) &&
    /\b\w*(?:kalkulier|berechne|rechne|erstelle|angebot|vertrag|verfugbarkeit|ruckgabe)\w*\b/.test(
      value
    )
  );
}

async function buildJarvisVehicleTripCalculationDraft(input: {
  question: string;
  organizationId: string;
  sessionId: string | null;
  accessProfile: ReturnType<typeof createJarvisAccessProfile>;
}) {
  if (!input.sessionId) {
    return {
      type: "refusal" as const,
      topicId: "action.draft.session-required",
      message:
        "Für eine bestätigbare JARVIS-Kalkulation ist eine aktuelle serverseitige Sitzung erforderlich. Bitte melde dich neu an; es wurde nichts gespeichert.",
    };
  }
  try {
    let actionDraft =
      await createPersistedJarvisVehicleTripCalculationDraft({
        organizationId: input.organizationId,
        sessionId: input.sessionId,
        profile: input.accessProfile,
      });
    const intake = extractJarvisVehicleCalculationIntake(input.question);
    const vehicle = matchJarvisVehicleOption(
      input.question,
      actionDraft.editor.vehicleOptions
    );
    if (vehicle || Object.keys(intake).length > 0) {
      actionDraft = await completeJarvisVehicleTripCalculationDraft(
        actionDraft.previewId,
        {
          organizationId: input.organizationId,
          sessionId: input.sessionId,
          profile: input.accessProfile,
        },
        {
          revision: actionDraft.revision,
          vehicleId: vehicle?.id ?? "",
          distanceKm: intake.distanceKm ?? 0,
          fuelPriceMode: intake.fuelPriceMode ?? "live",
          manualFuelPricePerLiter:
            intake.manualFuelPricePerLiter ?? 0,
          note: "",
        }
      );
    }
    const missing =
      actionDraft.missingFields.length > 0
        ? ` Noch offen: ${actionDraft.missingFields.join(", ")}.`
        : "";
    return {
      type: "answer" as const,
      topicId: "action.draft.vehicle-trip-calculation",
      message:
        `Ich habe die ausdrücklich genannten Angaben in eine sichere Fahrten- und Fahrzeugkostenkalkulation übernommen. JARVIS verwendet die aktuellen WorkPilot-Fahrzeugwerte und wahlweise den Live-Kraftstoffpreis oder einen transparenten manuellen Preis. Personalkosten sind in diesem Rechner ausdrücklich nicht enthalten.${missing} Erst deine ausdrückliche Bestätigung darf eine unveränderliche Kalkulationsversion speichern.`,
      actionDraft,
    };
  } catch (error) {
    const message =
      error instanceof JarvisActionDraftError
        ? error.message
        : "Die Fahrten- und Fahrzeugkostenkalkulation konnte nicht sicher vorbereitet werden.";
    return {
      type: "refusal" as const,
      topicId: "action.draft.unavailable",
      message: `${message} Es wurde nichts gespeichert.`,
    };
  }
}

async function buildJarvisWinterCalculationDraft(input: {
  question: string;
  organizationId: string;
  sessionId: string | null;
  accessProfile: ReturnType<typeof createJarvisAccessProfile>;
  context: ReturnType<typeof sanitizeJarvisSurfaceContext>;
}) {
  if (!input.sessionId) {
    return {
      type: "refusal" as const,
      topicId: "action.draft.session-required",
      message:
        "Für eine bestätigbare JARVIS-Kalkulation ist eine aktuelle serverseitige Sitzung erforderlich. Bitte melde dich neu an; es wurde nichts gespeichert.",
    };
  }
  try {
    let actionDraft =
      await createPersistedJarvisWinterCalculationDraft({
        organizationId: input.organizationId,
        sessionId: input.sessionId,
        profile: input.accessProfile,
        context: input.context,
      });
    const intake = extractJarvisWinterCalculationIntake(input.question);
    if (Object.keys(intake).length > 0) {
      actionDraft = await completeJarvisWinterCalculationDraft(
        actionDraft.previewId,
        {
          organizationId: input.organizationId,
          sessionId: input.sessionId,
          profile: input.accessProfile,
        },
        {
          revision: actionDraft.revision,
          input: {
            ...actionDraft.editor.input,
            ...intake,
          },
          providedFields: Object.keys(intake) as Array<
            keyof typeof actionDraft.editor.input
          >,
          projectId: actionDraft.editor.projectId,
          note: "",
        }
      );
    }
    const missing =
      actionDraft.missingFields.length > 0
        ? ` Noch offen: ${actionDraft.missingFields.join(", ")}.`
        : "";
    return {
      type: "answer" as const,
      topicId: "action.draft.winter-calculation",
      message:
        `Ich habe die ausdrücklich genannten Rechengrundlagen in eine sichere Winterdienst-Kalkulation übernommen; fehlende Werte wurden nicht geschätzt.${missing} Alle drei Varianten werden ausschließlich mit der zentralen WorkPilot-Logik berechnet. Die Vorschau verändert keine Geschäftsdaten; dauerhaftes Speichern benötigt ein passendes Kundenprojekt, die vorhandene Rollenberechtigung und deine ausdrückliche Bestätigung.`,
      actionDraft,
    };
  } catch (error) {
    const message =
      error instanceof JarvisActionDraftError
        ? error.message
        : "Die Winterdienst-Kalkulation konnte nicht sicher vorbereitet werden.";
    return {
      type: "refusal" as const,
      topicId: "action.draft.unavailable",
      message: `${message} Es wurde nichts gespeichert.`,
    };
  }
}

function normalizePersonLabel(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function buildJarvisPlanningPreview(input: {
  question: string;
  organizationId: string;
  sessionId: string | null;
  accessProfile: ReturnType<typeof createJarvisAccessProfile>;
  context: ReturnType<typeof sanitizeJarvisSurfaceContext>;
  users: Array<{
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    isActive?: boolean;
  }>;
}) {
  if (input.context.recordType !== "project" || !input.context.recordId) {
    return {
      type: "clarification" as const,
      topicId: "action.preview.planning.project-required",
      message:
        "Für eine sichere Termin-Vorschau brauche ich ein eindeutig geöffnetes Projekt. Öffne zuerst die Projektakte; es wurde nichts gespeichert.",
    };
  }
  const details = extractJarvisPlanningPreviewDetails(input.question);
  if (!details) {
    const hasQuotedTitle = /[„"'][^„“"']{3,180}[“"']/u.test(
      input.question
    );
    const hasExactDate = /\b\d{1,2}\.\d{1,2}\.\d{4}\b/u.test(
      input.question
    );
    const hasCompleteTimeWindow =
      /\bvon\s+(?:[01]?\d|2[0-3]):[0-5]\d\s+(?:uhr\s+)?bis\s+(?:[01]?\d|2[0-3]):[0-5]\d\b/iu.test(
        input.question
      );
    const normalizedQuestion = normalizePersonLabel(input.question);
    const hasUnambiguousAssignee = input.users.some((user) => {
      if (user.isActive === false || !user.id) return false;
      const label = [user.firstName, user.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      return (
        label.length >= 3 &&
        normalizedQuestion.includes(normalizePersonLabel(label))
      );
    });
    const hasCompleteShape =
      hasQuotedTitle && hasExactDate && hasCompleteTimeWindow;
    const missingDetails = [
      !hasQuotedTitle ? "einen eindeutigen Titel in Anführungszeichen" : "",
      !hasExactDate ? "ein konkretes Datum im Format TT.MM.JJJJ" : "",
      !hasCompleteTimeWindow ? "Beginn und Ende im Format HH:MM" : "",
      !hasUnambiguousAssignee
        ? "den vollständigen Namen einer aktiven Person"
        : "",
    ].filter(Boolean);
    const missingDetailsText =
      missingDetails.length <= 1
        ? missingDetails[0]
        : `${missingDetails.slice(0, -1).join(", ")} und ${
            missingDetails[missingDetails.length - 1]
          }`;
    return {
      type: "clarification" as const,
      topicId: "action.preview.planning.details-required",
      message: hasCompleteShape
        ? "Datum oder Zeitfenster sind unplausibel. Verwende ein gültiges Kalenderdatum und stelle sicher, dass das Ende nach dem Beginn liegt; es wurde nichts gespeichert."
        : `Für die Termin-Vorschau fehlen noch: ${missingDetailsText}. Beispiel: Plane am 03.08.2026 von 10:00 bis 11:00 den Termin „Vor-Ort-Prüfung“ für Christian Eid. Es wurde nichts gespeichert.`,
    };
  }
  const normalizedQuestion = normalizePersonLabel(input.question);
  const assignee = input.users.find((user) => {
    if (user.isActive === false || !user.id) return false;
    const label = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return label.length >= 3 &&
      normalizedQuestion.includes(normalizePersonLabel(label));
  });
  if (!assignee) {
    return {
      type: "clarification" as const,
      topicId: "action.preview.planning.assignee-required",
      message:
        "Ich konnte die verantwortliche Person nicht eindeutig zuordnen. Nenne bitte den vollständigen Namen einer aktiven Person; es wurde nichts gespeichert.",
    };
  }
  const approvalStatus = /\bterminwunsch\w*\b/iu.test(input.question)
    ? "requested"
    : "confirmed";
  const preview = createJarvisActionPreview({
    previewId: randomUUID(),
    actionId: "planning.prepare",
    payload: {
      title: details.title,
      startAt: details.startAt,
      endAt: details.endAt,
      projectId: input.context.recordId,
      assigneeIds: [assignee.id],
      approvalStatus,
    },
    organizationId: input.organizationId,
    profile: input.accessProfile,
    createdAt: new Date().toISOString(),
  });
  if (!preview.ok) {
    return {
      type: "refusal" as const,
      topicId: "action.preview.planning.refused",
      message: `${preview.message} Es wurde nichts gespeichert oder ausgeführt.`,
    };
  }
  if (!input.sessionId) {
    return {
      type: "refusal" as const,
      topicId: "action.draft.session-required",
      message:
        "Für bestätigbare JARVIS-Aktionen ist eine aktuelle serverseitige Sitzung erforderlich. Bitte melde dich neu an; es wurde nichts gespeichert oder ausgeführt.",
    };
  }
  try {
    const actionDraft = await createPersistedJarvisPlanningDraft({
      preview: preview.value,
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      profile: input.accessProfile,
      context: input.context,
    });
    return {
      type: "answer" as const,
      topicId: "action.draft.planning",
      message:
        "Ich habe einen sicheren Terminentwurf gespeichert und fachlich vorgeprüft. Prüfe die sichtbaren Ergebnisse und bearbeite die Angaben bei Bedarf. Erst deine ausdrückliche Bestätigung darf über den bestehenden Planning-Service genau einen Eintrag anlegen.",
      actionDraft,
    };
  } catch (error) {
    const message =
      error instanceof JarvisActionDraftError
        ? error.message
        : "Der Terminentwurf konnte nicht sicher gespeichert werden.";
    return {
      type: "refusal" as const,
      topicId: "action.draft.unavailable",
      message: `${message} Es wurde nichts ausgeführt.`,
    };
  }
}

function shouldUseProjectHealthPath(
  question: string,
  decision: JarvisIntentDecision
) {
  // Eindeutige Bedienfragen bleiben Bedienfragen. Der Projektkontext darf
  // Begriffe wie "Termin" nicht automatisch in eine Diagnose umdeuten.
  if (decision.goals.includes("how_to")) return false;
  const asksForProjectCollection =
    /\bprojekte\b/iu.test(question) &&
    extractJarvisProjectReferences(question).length === 0 &&
    !isJarvisReferentialFollowUp(question);
  if (asksForProjectCollection) return false;
  const asksForOrganizationScope =
    /\b(?:bei uns|unser(?:e|en|er|em)?|wir|unternehmen|insgesamt|alle kunden|welche kunden|welche mitarbeiter|durchschnittlich)\b/iu.test(
      question
    ) &&
    extractJarvisProjectReferences(question).length === 0 &&
    !/\b(?:dieses|diesem|diesen)\s+projekt\b|\bhier\b/iu.test(question);
  if (asksForOrganizationScope) return false;
  const asksForGenericRecords =
    decision.goals.includes("read") &&
    decision.entities.some((entity) =>
      ["customer", "task", "offer", "invoice"].includes(entity)
    );
  if (!asksForGenericRecords) return true;
  return (
    decision.entities.includes("project") ||
    extractJarvisProjectReferences(question).length > 0 ||
    isJarvisReferentialFollowUp(question)
  );
}

function looksLikeDirectActionRequest(
  question: string,
  decision: JarvisIntentDecision
) {
  if (
    /\b(?:wichtigste[rn]?|nächste[rn]?)\s+(?:sinnvolle[nr]?\s+)?schritt\b/iu.test(
      question
    )
  ) {
    return false;
  }
  const startsWithQuestion =
    /^\s*(?:warum|weshalb|wieso|wann|wo|wer|welch\w*|was|ist|sind|wurde|wurden|hat|haben|gibt|kann|können)\b/iu.test(
      question
    );
  return (
    !/^\s*wie\b/iu.test(question) &&
    ((!startsWithQuestion && decision.goals.includes("change")) ||
      /^\s*(?:leg|lege|mach|mache|schreib|kommentier|dokumentier|notier|ergänz|erganz|schick|sende|stornier|stemp(?:el|le)|lösch|losch|ändere|ander|setz|markier|erstell|trag|plane|buch|buche|überplan|uberplan|bestätig|bestatig)\w*\b/iu.test(
        question
      ))
  );
}

function resolveExplicitSafetyPolicyQuestion(question: string) {
  const value = normalizeJarvisIntentText(question);
  if (
    /\brechnung\w*\b/.test(value) &&
    /\b(?:send|sende|versend|schick)\w*\b/.test(value) &&
    /\bprojekt\w*\b/.test(value) &&
    /\b(?:losch|loesch|entfern)\w*\b/.test(value)
  ) {
    return {
      type: "refusal" as const,
      topicId: "jarvis.safety.combined-financial-delete",
      message:
        "Weder wurde eine Rechnung versendet noch ein Projekt gelöscht. Rechnungsversand hat finanzielle Außenwirkung und Projektlöschung ist irreversibel; beide Aktionen sind für JARVIS nicht autonom freigegeben und dürfen nicht zu einer kombinierten Ausführung verkettet werden. Nutze jeweils den berechtigten Fachablauf mit eindeutigem Ziel, sichtbarer Wirkung und bewusster menschlicher Bestätigung.",
      deterministic: true,
    };
  }
  if (
    /\b(?:darfst|kannst|wirst)\b.*\brechnung\w*\b.*\bversend\w*\b/.test(
      value
    )
  ) {
    return {
      type: "answer" as const,
      topicId: "jarvis.safety.invoice-send",
      message:
        "JARVIS versendet Rechnungen nicht eigenständig. Für eine bereits fakturierte Rechnung kann JARVIS jetzt eine kontrollierte Versandvorschau mit sichtbarem Empfänger, Dokumentformat, Anhängen und technischer Prüfung vorbereiten. Erst eine berechtigte Person kann den Versand mit der exakt angezeigten kritischen Phrase einmalig freigeben.",
      deterministic: true,
    };
  }
  if (
    /\b(?:darfst|kannst|sollst)\b.*\brolle\w*\b.*\b(?:ander|aender|wechsel|vergeb)\w*\b/.test(
      value
    )
  ) {
    return {
      type: "answer" as const,
      topicId: "jarvis.safety.role-change",
      message:
        "Nein. JARVIS ändert oder vergibt Rollen nicht eigenständig. Rollen steuern Zugriffe und müssen über den dafür berechtigten Verwaltungsweg mit sichtbarer Zielperson, neuer Rolle und bewusster menschlicher Bestätigung geändert werden.",
      deterministic: true,
    };
  }
  if (
    /\b(?:darfst|kannst|sollst)\b.*\bstempel\w*\b.*\b(?:ander|aender|losch|loesch|korrigier)\w*\b/.test(
      value
    )
  ) {
    return {
      type: "answer" as const,
      topicId: "jarvis.safety.stamp-change",
      message:
        "Nein. JARVIS ändert oder löscht Stempelungen nicht eigenständig. Zeitbuchungen bleiben eine nachvollziehbare Benutzer- beziehungsweise berechtigte Korrekturaktion; Ziel, Zeitraum, Begründung und Wirkung müssen vor der Bestätigung sichtbar sein.",
      deterministic: true,
    };
  }
  if (/\b(?:heimlich\w*\s+)?personlichkeitsprofil\w*\b/.test(value)) {
    return {
      type: "answer" as const,
      topicId: "jarvis.safety.people-profile",
      message:
        "Nein. JARVIS erstellt keine heimlichen Persönlichkeitsprofile. Zulässig sind nur transparente, zweckgebundene und rollenberechtigte Beobachtungen aus freigegebenen Arbeitsdaten; menschliche Einordnung, Feedback und Personalentscheidungen bleiben bei den Verantwortlichen.",
      deterministic: true,
    };
  }
  if (
    /^\s*(?:losch|loesch)\w*\b/.test(value) &&
    /\bprojekt\w*\b/.test(value)
  ) {
    return {
      type: "refusal" as const,
      topicId: "jarvis.safety.project-delete",
      message:
        "Das Projekt wurde nicht gelöscht. Eine Projektlöschung ist irreversibel und für JARVIS nicht freigegeben; sie darf nur über den berechtigten Verwaltungsweg mit eindeutigem Ziel, sichtbaren Folgen und bewusster menschlicher Bestätigung erfolgen.",
      deterministic: true,
    };
  }
  return undefined;
}

function looksLikeTaskCreationPreviewRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  const startsWithCreate =
    /^\s*(?:leg|lege|erstell|erstelle)\w*\b/.test(value);
  const startsWithLay =
    /^\s*(?:leg|lege)\w*\b/.test(value);
  const hasExplicitCreationMarker =
    !startsWithLay ||
    /\ban\s*[.!?]*$/iu.test(question) ||
    /\bneue\s+aufgabe\b/iu.test(question);
  return (
    startsWithCreate &&
    hasExplicitCreationMarker &&
    /\baufgabe\b/.test(value) &&
    !/\b(?:losch|loesch|ander|aender|archivier)\w*\b/.test(value)
  );
}

function looksLikePlanningPreviewRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  const startsWithPlanningCommand =
    /^\s*(?:plan|plane|leg|lege|erstell|erstelle|buch|buche|uberplan|bestatig)\w*\b/.test(
      value
    );
  return (
    startsWithPlanningCommand &&
    (
      /\b(?:termin|einsatztermin|planungstermin|uberplanung|monatskontingent|angebotskontingent)\w*\b/.test(
        value
      ) ||
      (
        /^\s*(?:plan|plane)\w*\b/.test(value) &&
        /\b(?:heute|morgen|ubermorgen|nachste\w*\s+woche|diese\w*\s+woche|am\s+\d{1,2}\.\d{1,2}\.\d{4}|um\s+\d{1,2}(?::\d{2})?)\b/.test(
          value
        )
      )
    )
  );
}

function looksLikeDeterministicHelpRequest(question: string) {
  const value = normalizeJarvisIntentText(question);
  return (
    (
      /^(?:wo|wie)\b/.test(value) &&
      (
      /\b(?:sehe|erkenne|finde|offne|oeffne)\s+ich\b/.test(value) ||
      /\bwo\b.*\b(?:sehe|erkenne|finde)\b/.test(value) ||
      /\bwie\b.*\b(?:versende|verschicke|sende)\b/.test(value) ||
      /\bwie\b.*\b(?:dokumentier|bereit)\w*\b/.test(value) ||
      /\bwie\b.*\bpruf\w*\b.*\brechnungsentwurf\b/.test(value) ||
      /\bwie\b.*\b(?:buch|leg|erfass|trag|plan|verplan)\w*\b/.test(value) ||
      /\bwie\b.*\bgeh\w*\b.*\b(?:abwesenheit|terminplanung)\b/.test(value) ||
      /\bwie\b.*\b(?:komme|gelange)\b/.test(value)
      )
    ) ||
    (
      /^(?:was|wann|welche)\b/.test(value) &&
      /\b(?:unterschied|statt|verwenden|brauche|enthalten|beachten|vor .+ pruf)\w*\b/.test(
        value
      )
    )
  );
}

function buildAiIntentClarification(
  classification: JarvisAiIntentClassification,
  context: ReturnType<typeof sanitizeJarvisSurfaceContext>
) {
  if (
    classification.intent !== "prepare_action" &&
    classification.intent !== "unclear" &&
    !classification.needsClarification
  ) {
    return undefined;
  }
  const actionChoices: Partial<
    Record<
      JarvisAiIntentClassification["actionKind"],
      ReturnType<typeof createJarvisDialogChoice>
    >
  > = {
    "appointment.create": createJarvisDialogChoice(
      "ai-intent-appointment-help",
      "Termin anlegen erklären",
      "Wie buche ich hier einen Termin?"
    ),
    "task.create": createJarvisDialogChoice(
      "ai-intent-task-help",
      "Aufgabe anlegen erklären",
      "Wie lege ich hier eine Aufgabe an?"
    ),
    "project_logbook.create": createJarvisDialogChoice(
      "ai-intent-project-logbook",
      "Logbucheintrag vorbereiten",
      "Schreibe einen Eintrag in das Projektlogbuch."
    ),
    "task_comment.create": createJarvisDialogChoice(
      "ai-intent-task-comment",
      "Aufgabenkommentar vorbereiten",
      "Schreibe einen Kommentar zu einer Aufgabe."
    ),
    "email.send": createJarvisDialogChoice(
      "ai-intent-email-help",
      "E-Mail-Vorgehen erklären",
      "Wie versende ich in WorkPilot360 eine E-Mail?"
    ),
    "project.create": createJarvisDialogChoice(
      "ai-intent-project-create-help",
      "Projektanlage erklären",
      "Wie lege ich in WorkPilot360 ein Projekt an?"
    ),
    "customer.create": createJarvisDialogChoice(
      "ai-intent-customer-create-help",
      "Kundenanlage erklären",
      "Wie lege ich in WorkPilot360 einen Kunden oder Kontakt an?"
    ),
    "offer.create": createJarvisDialogChoice(
      "ai-intent-offer-create-help",
      "Angebotserstellung erklären",
      "Wie lege ich in WorkPilot360 ein Angebot an?"
    ),
    "invoice.create": createJarvisDialogChoice(
      "ai-intent-invoice-create-help",
      "Rechnungsentwurf erklären",
      "Wie lege ich in WorkPilot360 einen Rechnungsentwurf an?"
    ),
    "invoice.cancel": createJarvisDialogChoice(
      "ai-intent-invoice-cancel-help",
      "Stornierung erklären",
      "Wie storniere ich in WorkPilot360 eine Rechnung?"
    ),
    "stamp.delete": createJarvisDialogChoice(
      "ai-intent-stamp-delete-help",
      "Löschen erklären",
      "Wie lösche ich in WorkPilot360 eine Stempelung?"
    ),
    "time_entry.create": createJarvisDialogChoice(
      "ai-intent-time-entry-create-help",
      "Zeiteintrag erklären",
      "Wie erfasse ich in WorkPilot360 einen manuellen Zeiteintrag?"
    ),
    "record.delete": createJarvisDialogChoice(
      "ai-intent-record-delete-help",
      "Sicheres Löschen erklären",
      "Wie lösche ich diesen Datensatz in WorkPilot360?"
    ),
    "catalog.change": createJarvisDialogChoice(
      "ai-intent-catalog-change-help",
      "Artikel oder Leistung ändern",
      "Wie bearbeite ich einen Artikel oder eine Leistung in WorkPilot360?"
    ),
    "record.change": createJarvisDialogChoice(
      "ai-intent-record-change-help",
      "Änderung erklären",
      "Wie ändere ich diesen Datensatz in WorkPilot360?"
    ),
  };
  const actionChoice = actionChoices[classification.actionKind];
  const choices = [
    ...(actionChoice ? [actionChoice] : []),
    ...(classification.actionKind === "appointment.create" &&
    context.recordType === "project"
      ? [
          createJarvisDialogChoice(
            "ai-intent-appointment-diagnose",
            "Planung & Termine prüfen",
            "Prüfe Planung und Termine für dieses Projekt."
          ),
        ]
      : []),
  ];
  return {
    type: "clarification" as const,
    topicId: "intent.ai.action-clarification",
    message:
      classification.intent === "prepare_action"
        ? "Ich habe verstanden, dass JARVIS hier direkt etwas ausführen soll. Diese Aktion ist in der aktuellen Entwicklungsphase noch nicht freigegeben und wurde nicht ausgeführt. Soll ich dir das sichere Vorgehen erklären?"
        : "Ich bin noch nicht sicher, ob du etwas nur erklärt, geprüft oder später direkt durch JARVIS erledigt haben möchtest. Bitte wähle das gewünschte Vorgehen.",
    choices,
  };
}

export async function POST(req: Request) {
  const { organization, users } = await getDemoContext();
  const body = await req.json().catch(() => ({}));
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  const sessionActor = users.find(
    (candidate) => candidate.id === actorResult.sessionUserId && candidate.isActive !== false
  );
  if (!sessionActor) {
    return NextResponse.json(
      { error: "Angemeldeter Benutzer konnte nicht eindeutig bestimmt werden." },
      { status: 401 }
    );
  }

  const message = cleanText(body.message, 1800);
  if (!message) {
    return NextResponse.json({ error: "Bitte eine Frage zur Bedienung von WorkPilot360 eingeben." }, { status: 400 });
  }

  const context = sanitizeJarvisSurfaceContext(body.context);
  const previousDialogState = sanitizeJarvisDialogState(body.dialogState);
  const suppliedConversationContext = body.conversationContext
    ? sanitizeJarvisSurfaceContext(body.conversationContext)
    : undefined;
  const accessProfile = createJarvisAccessProfile(sessionActor, actorResult.actor);
  const intentDecision = resolveJarvisIntentDecision(message);
  const conversationContext =
    getJarvisDialogConversationContext(previousDialogState, message) ??
    (shouldCarryJarvisActiveRecord(message)
      ? suppliedConversationContext
      : undefined);
  const respond = (
    payload: Record<string, unknown>,
    domain = intentDecision.state === "resolved"
      ? intentDecision.domain
      : previousDialogState?.domain ?? intentDecision.domain
  ) => {
    payload = applyJarvisAnswerPolicy(message, payload);
    const intentSequenceContinuation =
      payload.type === "answer" || payload.type === "refusal"
        ? resolveJarvisIntentSequenceContinuation(
            previousDialogState,
            message,
            accessProfile
          )
        : undefined;
    const guidedSequenceContinuation =
      payload.type === "answer" || payload.type === "refusal"
        ? resolveJarvisGuidedSequenceContinuation(
            previousDialogState,
            message,
            accessProfile
          )
        : undefined;
    const sequenceChoices =
      payload.type === "answer" || payload.type === "refusal"
        ? [
            ...buildJarvisProjectSequenceContinuation(
              previousDialogState,
              message,
              accessProfile
            ),
            ...(intentSequenceContinuation?.choices ?? []),
            ...(guidedSequenceContinuation?.choices ?? []),
          ]
        : [];
    const payloadWithIntentSequence: Record<string, unknown> = {
      ...payload,
      ...(intentSequenceContinuation
        ? {
            dialogIntentSequence: {
              remainingTasks: intentSequenceContinuation.remainingTasks,
            },
          }
        : {}),
      ...(guidedSequenceContinuation
        ? {
            dialogGuidedSequence: {
              remainingTasks: guidedSequenceContinuation.remainingTasks,
            },
          }
        : {}),
    };
    const sequencePayload =
      sequenceChoices.length > 0
        ? {
            ...payloadWithIntentSequence,
            choices: [
              ...(Array.isArray(payloadWithIntentSequence.choices)
                ? payloadWithIntentSequence.choices
                : []),
              ...sequenceChoices,
            ],
          }
        : payloadWithIntentSequence;
    const responsePayload =
      sequencePayload.type === "clarification" &&
      previousDialogState?.clarification?.topicId ===
        sequencePayload.topicId &&
      sequencePayload.topicId !== "intent.ai.action-clarification" &&
      Array.isArray(sequencePayload.choices) &&
      sequencePayload.choices.length > 0 &&
      (previousDialogState?.clarification?.depth ?? 0) >= 2
        ? {
            ...sequencePayload,
            message:
              "Ich möchte hier nicht raten. Bitte wähle eine der angebotenen Möglichkeiten oder formuliere Ziel und Datensatz einmal vollständig neu.",
          }
        : sequencePayload;
    const dialogState = buildJarvisDialogState({
        question: message,
        decision: intentDecision,
        domain,
        response: responsePayload,
        previousState: previousDialogState,
        conversationContext,
      });
    const {
      dialogSequence: _dialogSequence,
      dialogIntentSequence: _dialogIntentSequence,
      dialogGuidedSequence: _dialogGuidedSequence,
      ...publicPayload
    } = responsePayload;
    return NextResponse.json({
      ...publicPayload,
      dialogState,
    });
  };
  const authorization = authorizeJarvisQuestion(message, accessProfile);
  const accessPolicyResponse = resolveJarvisAccessPolicyQuestion(message);
  if (!authorization.allowed) {
    if (authorization.reason === "role" && accessPolicyResponse) {
      return respond(accessPolicyResponse);
    }
    return respond({
      type: "refusal",
      topicId: "security.refusal",
      message: getJarvisAuthorizationRefusalMessage(authorization, message),
    });
  }
  const onlineRequestResponse = await resolveJarvisOnlineRequestAnalysis({
    question: message,
    organizationId: organization.id,
    accessProfile,
  });
  if (onlineRequestResponse) {
    return respond(onlineRequestResponse, "sales");
  }
  const directNavigationHelp = resolveJarvisDirectNavigationHelp(
    message,
    accessProfile
  );
  if (directNavigationHelp) {
    return respond(directNavigationHelp, "system");
  }
  if (accessPolicyResponse) {
    return respond(accessPolicyResponse);
  }
  const explicitSafetyPolicyResponse =
    resolveExplicitSafetyPolicyQuestion(message);
  if (explicitSafetyPolicyResponse) {
    return respond(explicitSafetyPolicyResponse);
  }
  if (looksLikeInvoiceDeliveryRequest(message)) {
    return respond(
      await buildJarvisInvoiceDeliveryDraft({
        question: message,
        organizationId: organization.id,
        sessionId: actorResult.sessionId,
        accessProfile,
        context,
      }),
      "sales"
    );
  }
  if (looksLikeInvoiceFinalizationRequest(message)) {
    return respond(
      await buildJarvisInvoiceFinalizationDraft({
        question: message,
        organizationId: organization.id,
        sessionId: actorResult.sessionId,
        accessProfile,
        context,
      }),
      "sales"
    );
  }
  if (looksLikeInvoiceDraftRequest(message)) {
    return respond(
      await buildJarvisInvoiceDraft({
        question: message,
        organizationId: organization.id,
        sessionId: actorResult.sessionId,
        accessProfile,
        context,
      }),
      "sales"
    );
  }
  if (looksLikeOfferDraftRequest(message)) {
    return respond(
      await buildJarvisOfferDraft({
        question: message,
        organizationId: organization.id,
        sessionId: actorResult.sessionId,
        accessProfile,
        context,
      }),
      "sales"
    );
  }
  if (looksLikeWinterCalculationStartRequest(message)) {
    return respond(
      await buildJarvisWinterCalculationDraft({
        question: message,
        organizationId: organization.id,
        sessionId: actorResult.sessionId,
        accessProfile,
        context,
      }),
      "system"
    );
  }
  if (looksLikeVehicleTripCalculationStartRequest(message)) {
    return respond(
      await buildJarvisVehicleTripCalculationDraft({
        question: message,
        organizationId: organization.id,
        sessionId: actorResult.sessionId,
        accessProfile,
      }),
      "system"
    );
  }
  if (looksLikeVehicleRentalRequest(message)) {
    return respond({
      type: "refusal",
      topicId: "action.vehicle-rental-not-released",
      message:
        "Fahrzeugvermietung, Mietpreise, Verfügbarkeit, Verträge und Rückgabechecks sind für JARVIS noch nicht fachlich freigegeben. Ich habe deshalb weder eine Kalkulation gestartet noch Daten verändert. Der sichere Fahrten- und Fahrzeugkostenrechner ohne Personalkosten bleibt davon getrennt verfügbar.",
      deterministic: true,
    });
  }
  if (looksLikeGenericJarvisCalculatorStart(message)) {
    return respond({
      type: "answer",
      topicId: "action.calculator-choice",
      message:
        "Welchen freigegebenen Rechner soll ich verwenden? Winterdienst berechnet Bereitschaft, Einsatz-, Zeit- und Streugutvarianten. Fahrten/Fahrzeugkosten berechnet eine Strecke mit einem aktiven Fahrzeug und weist Fahrzeug- und Kraftstoffkosten ohne Personalkosten aus. Die Fahrzeugvermietung ist noch kein fachlich freigegebener Rechner.",
      choices: [
        createJarvisDialogChoice(
          "calculator-winter",
          "Winterdienst kalkulieren",
          "Starte eine Winterdienst-Kalkulation"
        ),
        createJarvisDialogChoice(
          "calculator-vehicle-trip",
          "Fahrt kalkulieren",
          "Starte eine Fahrtenkalkulation"
        ),
      ],
      deterministic: true,
    });
  }
  const projectTypeOverview = resolveJarvisProjectTypeOverview(message);
  if (projectTypeOverview) {
    return respond(projectTypeOverview, "system");
  }
  const operationalGuidance = resolveJarvisOperationalGuidance(message);
  if (operationalGuidance) {
    return respond(operationalGuidance, "system");
  }
  const projectReviewInventoryIntent =
    resolveJarvisProjectReviewInventoryIntent(message);
  if (projectReviewInventoryIntent) {
    const projectReviewInventoryResponse =
      await resolveJarvisProjectReviewInventoryRequest({
        question: message,
        organizationId: organization.id,
        accessProfile,
      });
    if (projectReviewInventoryResponse) {
      return respond(projectReviewInventoryResponse, "management");
    }
  }
  if (resolveJarvisOrganizationMaterialIntent(message)) {
    const organizationMaterialResponse =
      await resolveJarvisOrganizationMaterialRequest({
        question: message,
        organizationId: organization.id,
        accessProfile,
      });
    if (organizationMaterialResponse) {
      return respond(organizationMaterialResponse, "management");
    }
  }
  const organizationReceivablesIntent =
    resolveJarvisOrganizationReceivablesIntent(message);
  if (organizationReceivablesIntent) {
    const organizationReceivablesResponse =
      await resolveJarvisOrganizationReceivablesRequest({
        question: message,
        organizationId: organization.id,
        accessProfile,
      });
    if (organizationReceivablesResponse) {
      return respond(organizationReceivablesResponse, "management");
    }
  }
  const organizationOfferAgingIntent =
    resolveJarvisOrganizationOfferAgingIntent(message);
  if (organizationOfferAgingIntent) {
    const organizationOfferAgingResponse =
      await resolveJarvisOrganizationOfferAgingRequest({
        question: message,
        organizationId: organization.id,
        accessProfile,
      });
    if (organizationOfferAgingResponse) {
      return respond(organizationOfferAgingResponse, "management");
    }
  }
  const deterministicPersonIntent =
    resolveJarvisPersonIntent(message) ??
    resolveJarvisPersonDiagnosticIntent(message);
  const deterministicCapabilityGap = resolveJarvisCapabilityGap(message);
  const deterministicSalesIntent = resolveJarvisSalesAnalysisIntent(message);
  const exactHelpTopicId = findJarvisExactHelpTopicId(message, context);
  const exactWorkflowHelpRequest =
    Boolean(exactHelpTopicId) &&
    looksLikeDeterministicHelpRequest(message);
  if (exactHelpTopicId?.startsWith("jarvis.")) {
    return respond(
      resolveJarvisSystemHelpTopic(
        exactHelpTopicId,
        message,
        context,
        accessProfile
      )
    );
  }
  const plainLanguageProjectFollowUp =
    previousDialogState?.activeRecord?.kind === "project" &&
    previousDialogState.topicId?.startsWith("project.health") &&
    /\b(?:ohne fachbegriffe|einfach(?:er)? erkl[aä]r|leicht verst[aä]ndlich)\b/iu.test(
      message
    );
  if (plainLanguageProjectFollowUp) {
    const previousProjectResponse = await resolveJarvisProjectHealthRequest({
      question:
        previousDialogState.topicId === "project.health.why"
          ? "Was läuft beim zuletzt geprüften Projekt schief?"
          : previousDialogState.lastQuestion,
      organizationId: organization.id,
      accessProfile,
      context,
      ...(conversationContext ? { conversationContext } : {}),
    });
    if (previousProjectResponse) {
      return respond({
        type: "answer",
        topicId: "project.health.plain-language",
        message: `Einfach gesagt: ${previousProjectResponse.message}`,
        deterministic: true,
      });
    }
  }
  const deterministicProjectDialogIntent =
    resolveJarvisProjectDialogIntent({
      question: message,
      hasProjectContext:
        extractJarvisProjectReferences(message).length === 1 ||
        context.recordType === "project" ||
        conversationContext?.recordType === "project",
    });
  const deterministicQuestionSemantics = analyzeJarvisQuestion(message);
  const deterministicProjectDiagnosticIntent =
    !intentDecision.goals.includes("how_to") &&
    !looksLikeDeterministicHelpRequest(message) &&
    !looksLikeDirectActionRequest(message, intentDecision) &&
    (deterministicQuestionSemantics.projectReferences.length === 1 ||
      context.recordType === "project" ||
      conversationContext?.recordType === "project") &&
    shouldUseProjectHealthPath(message, intentDecision) &&
    deterministicQuestionSemantics.projectScopes.length === 1;
  const deterministicProjectDiagnosticFollowUp =
    (context.recordType === "project" ||
      conversationContext?.recordType === "project") &&
    isJarvisReferentialFollowUp(message) &&
    /^\s*(?:prüf|pruef|pruf|check|analysier|untersuch|kontrollier)\w*\s+(?:mal\s+)?(?:(?:das|dies)\s+)?(?:projekt\s+)?(?:dort|hier|das|dies)\b/iu.test(
      message
    );
  const deterministicProjectWhyFollowUp =
    conversationContext?.recordType === "project" &&
    previousDialogState?.topicId?.startsWith("project.health") &&
    /^\s*(?:warum|wieso|weshalb)\s*[?!.]*\s*$/iu.test(message);
  if (
    (deterministicProjectDialogIntent ||
      deterministicProjectDiagnosticIntent ||
      deterministicProjectDiagnosticFollowUp ||
      deterministicProjectWhyFollowUp) &&
    !deterministicPersonIntent &&
    !deterministicCapabilityGap &&
    !deterministicSalesIntent &&
    !exactWorkflowHelpRequest
  ) {
    const projectDialogResponse = await resolveJarvisProjectHealthRequest({
      question: deterministicProjectWhyFollowUp
        ? previousDialogState?.topicId === "project.health.plain-language"
          ? "Was ist der wichtigste nächste Schritt für dieses Projekt und warum?"
          : "Was läuft beim zuletzt geprüften Projekt schief?"
        : message,
      organizationId: organization.id,
      accessProfile,
      context,
      ...(conversationContext ? { conversationContext } : {}),
    });
    if (projectDialogResponse) {
      if (deterministicProjectWhyFollowUp) {
        return respond({
          type: "answer",
          topicId: "project.health.why",
          message: `Der Grund für diese Priorität: ${projectDialogResponse.message}`,
          deterministic: true,
        });
      }
      return respond(projectDialogResponse);
    }
  }
  const directActionRequest = looksLikeDirectActionRequest(
    message,
    intentDecision
  );
  if (looksLikeProjectLogbookWriteRequest(message)) {
    return respond(
      await buildJarvisCommunicationDraft({
        question: message,
        actionId: "project-logbook.prepare",
        organizationId: organization.id,
        sessionId: actorResult.sessionId,
        accessProfile,
        context,
      }),
      "system"
    );
  }
  if (looksLikeTaskCommentWriteRequest(message)) {
    return respond(
      await buildJarvisCommunicationDraft({
        question: message,
        actionId: "task-comment.prepare",
        organizationId: organization.id,
        sessionId: actorResult.sessionId,
        accessProfile,
        context,
      }),
      "system"
    );
  }
  if (looksLikeManualTimeEntryRequest(message)) {
    return respond(
      await buildJarvisTimeDraft({
        question: message,
        organizationId: organization.id,
        sessionId: actorResult.sessionId,
        accessProfile,
        context,
        users,
      }),
      "system"
    );
  }
  if (directActionRequest && looksLikeLiveStampRequest(message)) {
    return respond({
      type: "refusal",
      topicId: "action.time-write-not-released",
      message:
        "Diese Stempelaktion ist für JARVIS nicht freigegeben und wurde nicht ausgeführt. Stempelungen bleiben eine bewusste Benutzeraktion in der Zeiterfassung; rückwirkende Änderungen müssen zusätzlich über den dafür berechtigten WorkPilot360-Weg geprüft werden.",
      deterministic: true,
    });
  }
  const deterministicHelpRequest =
    Boolean(exactHelpTopicId) &&
    (
      looksLikeDeterministicHelpRequest(message) ||
      exactHelpTopicId?.startsWith("jarvis.")
    ) &&
    !directActionRequest;
  if (exactHelpTopicId && deterministicHelpRequest) {
    return respond(
      resolveJarvisSystemHelpTopic(
        exactHelpTopicId,
        message,
        context,
        accessProfile
      )
    );
  }
  if (
    !directActionRequest &&
    !exactHelpTopicId &&
    looksLikeDeterministicHelpRequest(message)
  ) {
    const deterministicHelp = resolveJarvisSystemHelp(
      message,
      context,
      accessProfile
    );
    if (deterministicHelp.type !== "unknown") {
      return respond(deterministicHelp);
    }
  }
  if (!directActionRequest) {
    const deterministicProjectClarification =
      buildJarvisProjectMatrixClarification(
        message,
        intentDecision,
        accessProfile
      ) ??
      buildJarvisProjectScopeSequenceClarification(
        message,
        intentDecision,
        accessProfile
      ) ??
      buildJarvisProjectSequenceClarification(
        message,
        intentDecision,
        accessProfile
      );
    if (deterministicProjectClarification) {
      return respond(deterministicProjectClarification);
    }
  }
  if (
    directActionRequest &&
    looksLikeTaskCreationPreviewRequest(message)
  ) {
    const taskPreview = await buildJarvisTaskPreview({
      question: message,
      organizationId: organization.id,
      sessionId: actorResult.sessionId,
      accessProfile,
      context,
    });
    if (taskPreview) {
      return respond(taskPreview);
    }
  }
  if (
    directActionRequest &&
    looksLikePlanningPreviewRequest(message)
  ) {
    return respond(
      await buildJarvisPlanningPreview({
        question: message,
        organizationId: organization.id,
        sessionId: actorResult.sessionId,
        accessProfile,
        context,
        users,
      })
    );
  }
  const routingContext = conversationContext ?? context;
  const aiIntentClassification = await classifyJarvisIntentWithAi({
    question: message,
    decision: intentDecision,
    context: routingContext,
  });
  const routePlan = resolveJarvisRoutePlan({
    question: message,
    decision: intentDecision,
    context: routingContext,
    ai: aiIntentClassification,
    hasDeterministicPersonIntent: Boolean(deterministicPersonIntent),
  });
  if (
    directActionRequest &&
    aiIntentClassification?.intent === "prepare_action" &&
    aiIntentClassification.actionKind === "task.create"
  ) {
    const taskPreview = await buildJarvisTaskPreview({
      question: message,
      organizationId: organization.id,
      sessionId: actorResult.sessionId,
      accessProfile,
      context,
    });
    if (taskPreview) {
      return respond(taskPreview);
    }
  }
  if (
    directActionRequest &&
    aiIntentClassification?.intent === "prepare_action" &&
    (aiIntentClassification.actionKind === "project_logbook.create" ||
      aiIntentClassification.actionKind === "task_comment.create")
  ) {
    return respond(
      await buildJarvisCommunicationDraft({
        question: message,
        actionId:
          aiIntentClassification.actionKind === "project_logbook.create"
            ? "project-logbook.prepare"
            : "task-comment.prepare",
        organizationId: organization.id,
        sessionId: actorResult.sessionId,
        accessProfile,
        context,
      }),
      "system"
    );
  }
  if (
    directActionRequest &&
    aiIntentClassification?.intent !== "prepare_action"
  ) {
    return respond({
      type: "clarification",
      topicId: "intent.action-not-executed",
      message:
        "Du möchtest, dass JARVIS direkt etwas ändert oder anlegt. Diese Aktion wurde nicht ausgeführt. Die ausführende Funktion ist noch nicht freigegeben; ich kann dir stattdessen den sicheren Ablauf in WorkPilot360 erklären.",
    });
  }
  if (
    aiIntentClassification &&
    (routePlan.prepareAction || routePlan.needsClarification) &&
    !deterministicHelpRequest &&
    !deterministicPersonIntent &&
    !deterministicCapabilityGap &&
    !deterministicSalesIntent
  ) {
    const aiClarification = buildAiIntentClarification(
      aiIntentClassification,
      routingContext
    );
    if (aiClarification) {
      return respond(aiClarification, routePlan.domain);
    }
  }
  if (
    exactHelpTopicId &&
    (routePlan.allowExactHelp || deterministicHelpRequest) &&
    !directActionRequest
  ) {
    return respond(
      resolveJarvisSystemHelpTopic(
        exactHelpTopicId,
        message,
        context,
        accessProfile
      )
    );
  }
  if (routePlan.needsClarification) {
    const intentClarification = buildJarvisIntentClarification(
      intentDecision,
      accessProfile
    );
    if (intentClarification) {
      return respond(intentClarification, routePlan.domain);
    }
  }
  const projectReviewInventoryResponse =
    await resolveJarvisProjectReviewInventoryRequest({
      question: message,
      organizationId: organization.id,
      accessProfile,
    });
  if (
    projectReviewInventoryResponse &&
    doesJarvisResponseFitRoute(routePlan, projectReviewInventoryResponse)
  ) {
    return respond(projectReviewInventoryResponse, "management");
  }
  const explicitlyOrganizationScoped =
    /\b(?:bei uns|unser(?:e|en|er|em)?|wir|unternehmen|insgesamt|organisationsweit)\b/iu.test(
      message
    ) &&
    extractJarvisProjectReferences(message).length === 0 &&
    !/\b(?:dieses|diesem|diesen)\s+projekt\b|\bhier\b/iu.test(message);
  const projectFocusedRelation =
    !explicitlyOrganizationScoped &&
    (context.recordType === "project" ||
      conversationContext?.recordType === "project") &&
    deterministicQuestionSemantics.relation;
  const organizationServiceRateResponse =
    projectFocusedRelation === "project_service_rates"
      ? undefined
      : await resolveJarvisOrganizationServiceRateRequest({
          question: message,
          organizationId: organization.id,
          accessProfile,
        });
  if (
    organizationServiceRateResponse &&
    (
      explicitlyOrganizationScoped ||
      doesJarvisResponseFitRoute(routePlan, organizationServiceRateResponse)
    )
  ) {
    return respond(organizationServiceRateResponse, "management");
  }
  const organizationMaterialResponse =
    projectFocusedRelation === "project_materials"
      ? undefined
      : await resolveJarvisOrganizationMaterialRequest({
          question: message,
          organizationId: organization.id,
          accessProfile,
        });
  if (
    organizationMaterialResponse &&
    (
      explicitlyOrganizationScoped ||
      doesJarvisResponseFitRoute(routePlan, organizationMaterialResponse)
    )
  ) {
    return respond(organizationMaterialResponse, "management");
  }
  if (deterministicSalesIntent) {
    const salesAnalysisResponse = await resolveJarvisSalesAnalysisRequest({
      question: message,
      organizationId: organization.id,
      accessProfile,
    });
    if (
      salesAnalysisResponse &&
      doesJarvisResponseFitRoute(routePlan, salesAnalysisResponse)
    ) {
      return respond(salesAnalysisResponse, "sales");
    }
  }
  if (deterministicCapabilityGap) {
    return respond(deterministicCapabilityGap, routePlan.domain);
  }
  if (routePlan.preferPerson) {
    const personDiagnosticResponse =
      await resolveJarvisPersonDiagnosticRequest({
        question: message,
        organizationId: organization.id,
        accessProfile,
        context,
      });
    if (
      personDiagnosticResponse &&
      doesJarvisResponseFitRoute(routePlan, personDiagnosticResponse)
    ) {
      return respond(personDiagnosticResponse, routePlan.domain);
    }
    const personSummaryResponse = await resolveJarvisPersonSummaryRequest({
      question: message,
      organizationId: organization.id,
      accessProfile,
    });
    if (
      personSummaryResponse &&
      doesJarvisResponseFitRoute(routePlan, personSummaryResponse)
    ) {
      return respond(personSummaryResponse, routePlan.domain);
    }
  }
  if (routePlan.preferRead) {
    const readResponse = await resolveJarvisReadRequest({
      question: message,
      context,
      organizationId: organization.id,
      accessProfile,
      intentHint: getJarvisReadHint(routePlan),
    });
    if (
      readResponse &&
      doesJarvisResponseFitRoute(routePlan, readResponse)
    ) {
      return respond(readResponse, routePlan.domain);
    }
  }
  const explicitProjectReferences = extractJarvisProjectReferences(message);
  if (
    explicitProjectReferences.length === 1 &&
    !directActionRequest &&
    routePlan.preferProjectHealth &&
    shouldUseProjectHealthPath(message, intentDecision)
  ) {
    const explicitProjectResponse = await resolveJarvisProjectHealthRequest({
      question: message,
      organizationId: organization.id,
      accessProfile,
      context,
      ...(conversationContext ? { conversationContext } : {}),
    });
    if (
      explicitProjectResponse &&
      doesJarvisResponseFitRoute(routePlan, explicitProjectResponse)
    ) {
      return respond(explicitProjectResponse);
    }
  }
  if (
    aiIntentClassification?.intent === "how_to" &&
    aiIntentClassification.helpTopicId !== "none" &&
    aiIntentClassification.confidence === "high" &&
    !aiIntentClassification.needsClarification
  ) {
    return respond(
      resolveJarvisSystemHelpTopic(
        aiIntentClassification.helpTopicId,
        message,
        context,
        accessProfile
      ),
      aiIntentClassification.domain
    );
  }
  if (!routePlan.needsClarification) {
    const intentClarification = buildJarvisIntentClarification(
      intentDecision,
      accessProfile
    );
    if (intentClarification) {
      return respond(intentClarification, routePlan.domain);
    }
  }
  const projectHealthResponse =
    routePlan.preferProjectHealth &&
    shouldUseProjectHealthPath(message, intentDecision)
    ? await resolveJarvisProjectHealthRequest({
        question: message,
        organizationId: organization.id,
        accessProfile,
        context,
        ...(conversationContext ? { conversationContext } : {}),
      })
    : undefined;
  if (
    projectHealthResponse &&
    doesJarvisResponseFitRoute(routePlan, projectHealthResponse)
  ) {
    return respond(projectHealthResponse);
  }
  const personDiagnosticResponse = await resolveJarvisPersonDiagnosticRequest({
    question: message,
    organizationId: organization.id,
    accessProfile,
    context,
  });
  if (
    personDiagnosticResponse &&
    doesJarvisResponseFitRoute(routePlan, personDiagnosticResponse)
  ) {
    return respond(personDiagnosticResponse);
  }
  const personSummaryResponse = await resolveJarvisPersonSummaryRequest({
    question: message,
    organizationId: organization.id,
    accessProfile,
  });
  if (
    personSummaryResponse &&
    doesJarvisResponseFitRoute(routePlan, personSummaryResponse)
  ) {
    return respond(personSummaryResponse);
  }
  const readResponse = await resolveJarvisReadRequest({
    question: message,
    context,
    organizationId: organization.id,
    accessProfile,
    ...(getJarvisReadHint(routePlan)
      ? { intentHint: getJarvisReadHint(routePlan) }
      : {}),
  });
  if (readResponse && doesJarvisResponseFitRoute(routePlan, readResponse)) {
    return respond(readResponse);
  }
  const resolved = resolveJarvisSystemHelp(message, context, accessProfile);
  return respond(resolved);
}
