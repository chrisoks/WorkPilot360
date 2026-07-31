import type { JarvisIntentDecision } from "@/lib/jarvis/intent-decision";
import {
  findJarvisExactHelpTopicId,
  JARVIS_HELP_TOPIC_CATALOG,
  type JarvisSurfaceContext,
} from "@/lib/jarvis/knowledge";
import {
  readJarvisModelUsage,
  recordJarvisModelTelemetry,
  resolveJarvisModelPolicy,
} from "@/lib/jarvis/model-policy";

export type JarvisAiIntentKind =
  | "how_to"
  | "read"
  | "explain"
  | "diagnose"
  | "analyze"
  | "prepare_action"
  | "unclear";

export type JarvisAiIntentEntity =
  | "none"
  | "project"
  | "customer"
  | "employee"
  | "task"
  | "offer"
  | "invoice"
  | "catalog"
  | "planning"
  | "organization";

export type JarvisAiIntentScope =
  | "none"
  | "explicit_record"
  | "current_record"
  | "organization"
  | "current_user"
  | "collection";

export type JarvisAiIntentClassification = {
  intent: JarvisAiIntentKind;
  domain: "system" | "sales" | "management";
  entity: JarvisAiIntentEntity;
  scope: JarvisAiIntentScope;
  helpTopicId: string;
  confidence: "low" | "medium" | "high";
  needsClarification: boolean;
  usesCurrentContext: boolean;
  actionKind:
    | "none"
    | "appointment.create"
    | "task.create"
    | "project_logbook.create"
    | "task_comment.create"
    | "email.send"
    | "project.create"
    | "customer.create"
    | "offer.create"
    | "invoice.create"
    | "invoice.cancel"
    | "time_entry.create"
    | "stamp.delete"
    | "record.delete"
    | "catalog.change"
    | "record.change";
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

const SECRET_OR_PERSONNEL_SIGNAL =
  /\b(passw(?:ort|örter)|kennw(?:ort|örter)|api[-_ ]?keys?|secrets?|tokens?|private keys?|system[-_ ]?prompts?|developer[-_ ]?messages?|gehalt|lohn|verdien|personalakte)\b/iu;
const WORKPILOT_SIGNAL =
  /\b(workpilot|jarvis|projekt|kunde|kontakt|angebot|rechnung|aufgabe|termin|planung|stempel|zeiteintrag|mitarbeiter|reiter|logbuch|dokument|leistung|artikel|kalkulation|dashboard|auswertung)\w*\b/iu;
const HELP_TOPIC_IDS = new Set(
  JARVIS_HELP_TOPIC_CATALOG.map((topic) => topic.id)
);
const AI_INTENT_ENTITIES = new Set<JarvisAiIntentEntity>([
  "none",
  "project",
  "customer",
  "employee",
  "task",
  "offer",
  "invoice",
  "catalog",
  "planning",
  "organization",
]);
const AI_INTENT_SCOPES = new Set<JarvisAiIntentScope>([
  "none",
  "explicit_record",
  "current_record",
  "organization",
  "current_user",
  "collection",
]);

const NON_PERSON_WORDS =
  /^(?:wie|was|warum|wer|wo|wann|welch\w*|zeig\w*|find\w*|such\w*|öffn\w*|offen\w*|aktuell\w*|nächst\w*|letzt\w*|unser\w*|mein\w*|dies\w*|projekt\w*|rechnung\w*|angebot\w*|aufgabe\w*|kund\w*|kontakt\w*|mitarbeiter\w*|planung\w*|termin\w*|stempel\w*|artikel\w*|leistung\w*|workpilot\w*|jarvis\w*)$/iu;

function maskLikelyPersonOrRecordNames(value: string) {
  const targeted = value.replace(
    /(\b(?:über|von|bei|für|kund(?:e|en|in)|kontakt|mitarbeiter(?:in)?|ansprechpartner)\s+)([\p{Lu}][\p{Ll}ß-]{2,}\s+[\p{Lu}][\p{Ll}ß-]{2,})\b/giu,
    "$1[PERSON_ODER_DATENSATZ]"
  );
  return targeted.replace(
    /\b([\p{Lu}][\p{Ll}ß-]{2,})\s+([\p{Lu}][\p{Ll}ß-]{2,})\b/gu,
    (match, first: string, second: string) =>
      NON_PERSON_WORDS.test(first) || NON_PERSON_WORDS.test(second)
        ? match
        : "[PERSON_ODER_DATENSATZ]"
  );
}

function cleanQuestionForIntent(value: string) {
  return maskLikelyPersonOrRecordNames(
    value
    .trim()
    .slice(0, 600)
    .replace(
      /\b[A-ZÄÖÜ]{2,}[- ]?\d{1,8}\b/gu,
      "[PROJEKTREFERENZ]"
    )
    .replace(
      /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/gu,
      "[E-MAIL]"
    )
    .replace(/\+?\d[\d\s()/-]{6,}\d/gu, "[TELEFON]")
    .replace(/\b\d{5,}\b/gu, "[NUMMER]")
  );
}

function extractResponseText(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const response = value as {
    output_text?: unknown;
    output?: Array<{
      content?: Array<{ type?: unknown; text?: unknown }>;
    }>;
  };
  if (typeof response.output_text === "string") return response.output_text;
  const text =
    response.output
      ?.flatMap((item) => item.content ?? [])
      .find(
        (item) =>
          item?.type === "output_text" && typeof item.text === "string"
      )?.text;
  return typeof text === "string" ? text : "";
}

function sanitizeClassification(
  value: unknown
): JarvisAiIntentClassification | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const intents = new Set<JarvisAiIntentKind>([
    "how_to",
    "read",
    "explain",
    "diagnose",
    "analyze",
    "prepare_action",
    "unclear",
  ]);
  const domains = new Set(["system", "sales", "management"]);
  const confidences = new Set(["low", "medium", "high"]);
  const actionKinds = new Set([
    "none",
    "appointment.create",
    "task.create",
    "project_logbook.create",
    "task_comment.create",
    "email.send",
    "project.create",
    "customer.create",
    "offer.create",
    "invoice.create",
    "invoice.cancel",
    "time_entry.create",
    "stamp.delete",
    "record.delete",
    "catalog.change",
    "record.change",
  ]);
  if (
    !intents.has(source.intent as JarvisAiIntentKind) ||
    !domains.has(String(source.domain)) ||
    !AI_INTENT_ENTITIES.has(source.entity as JarvisAiIntentEntity) ||
    !AI_INTENT_SCOPES.has(source.scope as JarvisAiIntentScope) ||
    !confidences.has(String(source.confidence)) ||
    typeof source.needsClarification !== "boolean" ||
    typeof source.usesCurrentContext !== "boolean" ||
    !actionKinds.has(String(source.actionKind))
  ) {
    return undefined;
  }
  const helpTopicId =
    typeof source.helpTopicId === "string" ? source.helpTopicId : "none";
  if (helpTopicId !== "none" && !HELP_TOPIC_IDS.has(helpTopicId)) {
    return undefined;
  }
  return {
    intent: source.intent as JarvisAiIntentKind,
    domain: source.domain as JarvisAiIntentClassification["domain"],
    entity: source.entity as JarvisAiIntentEntity,
    scope: source.scope as JarvisAiIntentScope,
    helpTopicId,
    confidence:
      source.confidence as JarvisAiIntentClassification["confidence"],
    needsClarification: source.needsClarification,
    usesCurrentContext: source.usesCurrentContext,
    actionKind:
      source.actionKind as JarvisAiIntentClassification["actionKind"],
  };
}

export function shouldUseJarvisAiIntentFallback(input: {
  question: string;
  decision: JarvisIntentDecision;
  context?: JarvisSurfaceContext;
}) {
  const question = input.question.trim();
  if (
    question.length < 4 ||
    SECRET_OR_PERSONNEL_SIGNAL.test(question)
  ) {
    return false;
  }
  const asksForAction =
    !/^\s*wie\b/iu.test(question) &&
    (input.decision.goals.includes("change") ||
      /^\s*(?:leg|lege|mach|mache|schick|sende|stornier|losch|lösch|ander|ändere|setz|markier|erstell|trag)\w*\b/iu.test(
        question
      ));
  const isUnambiguousHowTo =
    input.decision.goals.includes("how_to") &&
    !input.decision.goals.includes("read") &&
    !input.decision.goals.includes("diagnose") &&
    !asksForAction;
  if (
    findJarvisExactHelpTopicId(question, input.context) &&
    isUnambiguousHowTo
  ) {
    return false;
  }
  const hasContext =
    Boolean(input.context?.module) ||
    input.context?.recordType === "project" ||
    input.context?.recordType === "customer";
  if (!hasContext && !WORKPILOT_SIGNAL.test(question)) return false;
  return true;
}

export async function classifyJarvisIntentWithAi(
  input: {
    question: string;
    decision: JarvisIntentDecision;
    context?: JarvisSurfaceContext;
  },
  fetchImpl: FetchLike = fetch
): Promise<JarvisAiIntentClassification | undefined> {
  if (
    process.env.OPENAI_JARVIS_INTENT_ENABLED === "false" ||
    !process.env.OPENAI_API_KEY ||
    !shouldUseJarvisAiIntentFallback(input)
  ) {
    return undefined;
  }

  const topics = JARVIS_HELP_TOPIC_CATALOG.map(
    (topic) => `${topic.id}: ${topic.title}`
  ).join("\n");
  const policy = resolveJarvisModelPolicy("intent");
  const model = policy.model;
  const topicEnum = [
    "none",
    ...JARVIS_HELP_TOPIC_CATALOG.map((topic) => topic.id),
  ];
  const context = {
    module: input.context?.module || "none",
    subview: input.context?.subview || "none",
    recordType: input.context?.recordType || "none",
    projectKind: input.context?.projectKind || "unknown",
    billingMode: input.context?.billingMode || "unknown",
    hasRecord: Boolean(input.context?.recordId),
  };

  const startedAt = Date.now();
  try {
    const response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(policy.timeoutMs),
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: policy.reasoningEffort },
        max_output_tokens: policy.maxOutputTokens,
        input: [
          {
            role: "system",
            content: [
              "Ordne ausschließlich die Absicht einer WorkPilot360-Frage ein. Antworte nicht auf die Fachfrage.",
              "Rechte, Datenzugriff und Aktionen werden später ausschließlich von WorkPilot360 geprüft.",
              "how_to bedeutet: Der Nutzer fragt, wie er etwas selbst bedient.",
              "prepare_action bedeutet: Der Nutzer fordert JARVIS auf, etwas auszuführen oder vorzubereiten.",
              "read bedeutet: Der Nutzer will vorhandene Datensätze, Listen oder Werte sehen. explain bedeutet: Der Nutzer will Bedeutung, Status, Verantwortung oder Logik eines Objekts verstehen.",
              "diagnose bedeutet: Der Nutzer fragt nach Fehler, Ursache, Abweichung oder Prüfung.",
              "Entscheide entity nach dem ausdrücklich erfragten Fachobjekt und niemals nur nach dem geöffneten Bildschirm.",
              "scope=explicit_record bei einer ausdrücklichen Referenz, current_record nur bei Wörtern wie hier/dieses Projekt, organization bei wir/unser/alle/insgesamt, collection bei einer Liste oder Mehrzahl.",
              "Priorität: ausdrückliche Referenz vor ausdrücklichem Umfang, dann Absicht, dann aktueller Datensatz, zuletzt Bildschirmkontext.",
              "Wenn mehrere Bedeutungen plausibel bleiben, setze needsClarification=true.",
              "Wähle helpTopicId nur bei einer klar passenden Bedienhilfe, sonst none.",
              "Verfügbare Bedienhilfen:",
              "actionKind ist nur bei prepare_action gesetzt, sonst none. Nutze appointment.create für Termin, task.create für Aufgabe, project_logbook.create für einen neuen Projektlogbuch-Eintrag, task_comment.create für einen Kommentar an einer bestehenden Aufgabe, email.send für Mail, project.create für Projekt, customer.create für Kunde/Kontakt, offer.create für Angebot, invoice.create für Rechnungsentwurf, invoice.cancel für Storno, time_entry.create für Zeiteintrag, stamp.delete für Stempelung löschen, record.delete für sonstiges Löschen, catalog.change für Artikel/Leistung und record.change für sonstige Änderungen.",
              topics,
            ].join("\n"),
          },
          {
            role: "user",
            content: JSON.stringify({
              question: cleanQuestionForIntent(input.question),
              context,
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "jarvis_intent_classification",
            strict: true,
            schema: {
              type: "object",
              properties: {
                intent: {
                  type: "string",
                  enum: [
                    "how_to",
                    "read",
                    "explain",
                    "diagnose",
                    "analyze",
                    "prepare_action",
                    "unclear",
                  ],
                },
                domain: {
                  type: "string",
                  enum: ["system", "sales", "management"],
                },
                entity: {
                  type: "string",
                  enum: [
                    "none",
                    "project",
                    "customer",
                    "employee",
                    "task",
                    "offer",
                    "invoice",
                    "catalog",
                    "planning",
                    "organization",
                  ],
                },
                scope: {
                  type: "string",
                  enum: [
                    "none",
                    "explicit_record",
                    "current_record",
                    "organization",
                    "current_user",
                    "collection",
                  ],
                },
                helpTopicId: { type: "string", enum: topicEnum },
                confidence: {
                  type: "string",
                  enum: ["low", "medium", "high"],
                },
                needsClarification: { type: "boolean" },
                usesCurrentContext: { type: "boolean" },
                actionKind: {
                  type: "string",
                  enum: [
                    "none",
                    "appointment.create",
                    "task.create",
                    "project_logbook.create",
                    "task_comment.create",
                    "email.send",
                    "project.create",
                    "customer.create",
                    "offer.create",
                    "invoice.create",
                    "invoice.cancel",
                    "time_entry.create",
                    "stamp.delete",
                    "record.delete",
                    "catalog.change",
                    "record.change",
                  ],
                },
              },
              required: [
                "intent",
                "domain",
                "entity",
                "scope",
                "helpTopicId",
                "confidence",
                "needsClarification",
                "usesCurrentContext",
                "actionKind",
              ],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!response.ok) {
      recordJarvisModelTelemetry({
        policy,
        startedAt,
        ok: false,
        status: response.status,
        errorCode: "http_error",
      });
      console.warn(
        `JARVIS intent fallback unavailable (status ${response.status}).`
      );
      return undefined;
    }
    const responseBody = await response.json();
    const usage = readJarvisModelUsage(responseBody);
    const parsed = JSON.parse(extractResponseText(responseBody));
    const classification = sanitizeClassification(parsed);
    recordJarvisModelTelemetry({
      policy,
      startedAt,
      ok: true,
      status: response.status,
      usage,
    });
    return classification;
  } catch {
    recordJarvisModelTelemetry({
      policy,
      startedAt,
      ok: false,
      errorCode: "request_or_parse_failed",
    });
    return undefined;
  }
}
