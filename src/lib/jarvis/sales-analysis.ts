import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import type { JarvisRecordResult } from "@/lib/jarvis/read-model";
import type { JarvisAccessProfile } from "@/lib/jarvis/security";

type JarvisSalesSignalKind =
  | "viewed_offer"
  | "completed_project"
  | "prior_year_service";

export type JarvisSalesSignal = {
  kind: JarvisSalesSignalKind;
  sourceId: string;
  projectId: string;
  offerId?: string;
  contactId: string;
  customerName: string;
  projectNumber: string;
  projectTitle: string;
  occurredAt: Date;
  evidence: string;
};

export type JarvisSalesAnalysisResponse = {
  type: "answer" | "refusal" | "unknown";
  message: string;
  topicId: string;
  records?: JarvisRecordResult[];
  deterministic: true;
};

type JarvisSalesAnalysisSource = {
  loadSignals(input: {
    organizationId: string;
    now: Date;
  }): Promise<JarvisSalesSignal[]>;
};

type SalesSignalRow = {
  kind: JarvisSalesSignalKind;
  sourceId: string;
  projectId: string;
  offerId: string | null;
  contactId: string;
  customerName: string;
  projectNumber: string;
  projectTitle: string;
  occurredAt: Date;
  evidence: string;
};

function normalizeAnalysisText(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const ANALYSIS_PATTERNS = [
  /\bwen\b.*\bnachfass/i,
  /\bwo\b.*\bnachfass/i,
  /\bwelche\b.*\b(?:kunde|kunden|projekt|projekte)\b.*\b(?:nachfass|kontaktier|ansprech)/i,
  /\b(?:vertriebschance|vertriebschancen|verkaufschance|verkaufschancen)\b/i,
  /\b(?:zusatzverkauf|cross.?sell|upsell)\w*\b/i,
  /\b(?:wiederholungsauftrag|wiederholungsauftrage|folgeauftrag|folgeauftrage)\b/i,
  /\b(?:vorjahresleistung|vorjahresleistungen|letztes jahr)\b.*\b(?:kunde|kunden|leistung|leistungen|projekt|projekte)\b/i,
  /\b(?:analysiere|prufe|checke|check)\b.*\b(?:vertrieb|kunden|projekte)\b/i,
  /\bwelche\b.*\b(?:kunde|kunden|angebot|angebote)\b.*\baktiv angehen\b/i,
];

const ACTIVE_TASK_STATUSES = [
  "OFFEN",
  "IN_BEARBEITUNG",
  "WARTET_AUF_RUECKMELDUNG",
  "UEBERFAELLIG",
];

const ACTIVE_POTENTIAL_STATUSES = ["open", "follow_up", "offered"];
const ACTIVE_OPPORTUNITY_STAGES = ["lead", "qualified", "first_contact", "offer", "negotiation"];

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(value);
}

function isManagementActor(profile: JarvisAccessProfile) {
  return (
    profile.sessionActor.role === Role.GESCHAEFTSFUEHRER &&
    profile.effectiveActor.role === Role.GESCHAEFTSFUEHRER
  );
}

export function resolveJarvisSalesAnalysisIntent(question: string) {
  const normalized = normalizeAnalysisText(question);
  return ANALYSIS_PATTERNS.some((pattern) => pattern.test(normalized));
}

function getPriority(signal: JarvisSalesSignal, now: Date) {
  const ageDays = Math.max(
    0,
    Math.floor((startOfUtcDay(now).getTime() - startOfUtcDay(signal.occurredAt).getTime()) / 86_400_000)
  );
  if (signal.kind === "viewed_offer") {
    return ageDays <= 14
      ? { score: 300 - ageDays, label: "Hohe Priorität" }
      : { score: 220 - Math.min(ageDays, 120), label: "Prüfen" };
  }
  if (signal.kind === "prior_year_service") {
    return { score: 180 - Math.min(Math.abs(ageDays - 365), 90), label: "Saisonale Chance" };
  }
  return { score: 140 - Math.min(ageDays, 120), label: "Nachfassen prüfen" };
}

function getSignalTitle(signal: JarvisSalesSignal) {
  if (signal.kind === "viewed_offer") return `Angesehenes Angebot · ${signal.customerName}`;
  if (signal.kind === "prior_year_service") return `Vorjahresleistung · ${signal.customerName}`;
  return `Abgeschlossenes Projekt · ${signal.customerName}`;
}

function getSignalSummary(signal: JarvisSalesSignal) {
  if (signal.kind === "viewed_offer") {
    return `${signal.evidence} Empfohlen: persönlich nachfassen und offene Fragen klären.`;
  }
  if (signal.kind === "prior_year_service") {
    return `${signal.evidence} Empfohlen: Wiederholungsbedarf prüfen, nicht ungeprüft als Auftrag annehmen.`;
  }
  return `${signal.evidence} Empfohlen: Zufriedenheit und möglichen Folgebedarf prüfen.`;
}

export function buildJarvisSalesAnalysisRecords(
  signals: JarvisSalesSignal[],
  now = new Date()
): JarvisRecordResult[] {
  const uniqueSignals = new Map<string, JarvisSalesSignal>();
  signals.forEach((signal) => {
    const key =
      signal.kind === "viewed_offer"
        ? `offer:${signal.offerId || signal.sourceId}`
        : `${signal.kind}:project:${signal.projectId}`;
    const current = uniqueSignals.get(key);
    if (!current || current.occurredAt < signal.occurredAt) {
      uniqueSignals.set(key, signal);
    }
  });

  return [...uniqueSignals.values()]
    .sort((first, second) => {
      const priorityDifference =
        getPriority(second, now).score - getPriority(first, now).score;
      return priorityDifference || second.occurredAt.getTime() - first.occurredAt.getTime();
    })
    .slice(0, 5)
    .map((signal) => {
      const priority = getPriority(signal, now);
      const isOffer = signal.kind === "viewed_offer" && Boolean(signal.offerId);
      return {
        id: `sales-analysis-${signal.kind}-${signal.sourceId}`,
        kind: isOffer ? "offer" : "project",
        title: getSignalTitle(signal),
        subtitle: [
          signal.projectNumber,
          signal.projectTitle,
          `Quelle vom ${formatDate(signal.occurredAt)}`,
        ].filter(Boolean).join(" · "),
        summary: getSignalSummary(signal),
        status: `${priority.label} · Dry-Run`,
        target: isOffer
          ? {
              kind: "offer",
              id: signal.offerId!,
              projectId: signal.projectId,
            }
          : {
              kind: "project",
              id: signal.projectId,
            },
      };
    });
}

async function loadLiveSignals(input: {
  organizationId: string;
  now: Date;
}): Promise<JarvisSalesSignal[]> {
  const today = startOfUtcDay(input.now);
  const recentOfferStart = addUtcDays(today, -120);
  const completedStart = addUtcDays(today, -180);
  const completedEnd = addUtcDays(today, -14);
  const priorYearCenter = new Date(today);
  priorYearCenter.setUTCFullYear(priorYearCenter.getUTCFullYear() - 1);
  const priorYearStart = addUtcDays(priorYearCenter, -60);
  const priorYearEnd = addUtcDays(priorYearCenter, 60);
  const currentComparisonStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));

  const rows = await prisma.$queryRaw<SalesSignalRow[]>(Prisma.sql`
    WITH "activeProjectFollowUp" AS (
      SELECT DISTINCT "projectId"
      FROM "ProjectPotential"
      WHERE "organizationId" = ${input.organizationId}
        AND "status" IN (${Prisma.join(ACTIVE_POTENTIAL_STATUSES)})
      UNION
      SELECT DISTINCT "projectId"
      FROM "SalesOpportunity"
      WHERE "organizationId" = ${input.organizationId}
        AND "projectId" IS NOT NULL
        AND "stage" IN (${Prisma.join(ACTIVE_OPPORTUNITY_STAGES)})
      UNION
      SELECT DISTINCT "projectId"
      FROM "Task"
      WHERE "organizationId" = ${input.organizationId}
        AND "projectId" IS NOT NULL
        AND "status"::text IN (${Prisma.join(ACTIVE_TASK_STATUSES)})
        AND (
          "title" ILIKE '%nachfass%'
          OR "description" ILIKE '%nachfass%'
          OR "title" ILIKE '%folgeauftrag%'
          OR "description" ILIKE '%folgeauftrag%'
        )
    ),
    "activeContactFollowUp" AS (
      SELECT DISTINCT project."contactId"
      FROM "ProjectPotential" potential
      INNER JOIN "WorkPilotProject" project
        ON project."organizationId" = potential."organizationId"
       AND project."id" = potential."projectId"
      WHERE potential."organizationId" = ${input.organizationId}
        AND potential."status" IN (${Prisma.join(ACTIVE_POTENTIAL_STATUSES)})
        AND NULLIF(project."contactId", '') IS NOT NULL
      UNION
      SELECT DISTINCT opportunity."contactId"
      FROM "SalesOpportunity" opportunity
      WHERE opportunity."organizationId" = ${input.organizationId}
        AND opportunity."stage" IN (${Prisma.join(ACTIVE_OPPORTUNITY_STAGES)})
        AND NULLIF(opportunity."contactId", '') IS NOT NULL
      UNION
      SELECT DISTINCT project."contactId"
      FROM "Task" task
      INNER JOIN "WorkPilotProject" project
        ON project."organizationId" = task."organizationId"
       AND project."id" = task."projectId"
      WHERE task."organizationId" = ${input.organizationId}
        AND task."status"::text IN (${Prisma.join(ACTIVE_TASK_STATUSES)})
        AND NULLIF(project."contactId", '') IS NOT NULL
        AND (
          task."title" ILIKE '%nachfass%'
          OR task."description" ILIKE '%nachfass%'
          OR task."title" ILIKE '%folgeauftrag%'
          OR task."description" ILIKE '%folgeauftrag%'
        )
    ),
    "viewedOffers" AS (
      SELECT
        'viewed_offer'::text AS "kind",
        request."id" AS "sourceId",
        request."projectId",
        request."offerId",
        COALESCE(NULLIF(project."contactId", ''), NULLIF(request."customerId", '')) AS "contactId",
        COALESCE(NULLIF(offer."customerName", ''), NULLIF(project."customer", ''), 'Kunde ohne Namen') AS "customerName",
        COALESCE(project."projectNumber", offer."projectNumber", '') AS "projectNumber",
        COALESCE(project."title", offer."projectTitle", '') AS "projectTitle",
        request."lastViewedAt" AS "occurredAt",
        ('Angebot ' || request."offerNumber" || ' wurde '
          || request."viewCount"::text || '-mal geöffnet; zuletzt am '
          || to_char(request."lastViewedAt", 'DD.MM.YYYY') || '.') AS "evidence"
      FROM "OfferAcceptanceRequest" request
      INNER JOIN "Offer" offer
        ON offer."organizationId" = request."organizationId"
       AND offer."id" = request."offerId"
      LEFT JOIN "WorkPilotProject" project
        ON project."organizationId" = request."organizationId"
       AND project."id" = request."projectId"
      WHERE request."organizationId" = ${input.organizationId}
        AND request."lastViewedAt" >= ${recentOfferStart}
        AND request."acceptedAt" IS NULL
        AND request."revokedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "SalesOpportunity" opportunity
          WHERE opportunity."organizationId" = request."organizationId"
            AND opportunity."offerId" = request."offerId"
            AND opportunity."stage" IN (${Prisma.join(ACTIVE_OPPORTUNITY_STAGES)})
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "activeProjectFollowUp" followup
          WHERE followup."projectId" = request."projectId"
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "activeContactFollowUp" followup
          WHERE followup."contactId" = COALESCE(NULLIF(project."contactId", ''), NULLIF(request."customerId", ''))
        )
    ),
    "completedProjects" AS (
      SELECT
        'completed_project'::text AS "kind",
        project."id" AS "sourceId",
        project."id" AS "projectId",
        NULL::text AS "offerId",
        project."contactId" AS "contactId",
        COALESCE(NULLIF(project."customer", ''), 'Kunde ohne Namen') AS "customerName",
        project."projectNumber",
        project."title" AS "projectTitle",
        project."updatedAt" AS "occurredAt",
        ('Projektstatus "' || project."status" || '" seit '
          || to_char(project."updatedAt", 'DD.MM.YYYY')
          || '; keine aktive Nachfassspur gefunden.') AS "evidence"
      FROM "WorkPilotProject" project
      WHERE project."organizationId" = ${input.organizationId}
        AND NULLIF(project."contactId", '') IS NOT NULL
        AND LOWER(project."status") LIKE '%abgeschlossen%'
        AND project."updatedAt" BETWEEN ${completedStart} AND ${completedEnd}
        AND NOT EXISTS (
          SELECT 1
          FROM "activeProjectFollowUp" followup
          WHERE followup."projectId" = project."id"
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "activeContactFollowUp" followup
          WHERE followup."contactId" = project."contactId"
        )
    ),
    "priorYearServices" AS (
      SELECT DISTINCT ON (project."contactId")
        'prior_year_service'::text AS "kind",
        invoice."id" AS "sourceId",
        project."id" AS "projectId",
        NULL::text AS "offerId",
        project."contactId" AS "contactId",
        COALESCE(NULLIF(invoice."customerName", ''), NULLIF(project."customer", ''), 'Kunde ohne Namen') AS "customerName",
        project."projectNumber",
        project."title" AS "projectTitle",
        invoice."createdAt" AS "occurredAt",
        ('Rechnung ' || invoice."invoiceNumber" || ' belegt eine Leistung im vergleichbaren Vorjahreszeitraum ('
          || to_char(invoice."createdAt", 'DD.MM.YYYY') || ').') AS "evidence"
      FROM "Invoice" invoice
      INNER JOIN "WorkPilotProject" project
        ON project."organizationId" = invoice."organizationId"
       AND project."id" = invoice."projectId"
      WHERE invoice."organizationId" = ${input.organizationId}
        AND NULLIF(project."contactId", '') IS NOT NULL
        AND invoice."createdAt" BETWEEN ${priorYearStart} AND ${priorYearEnd}
        AND LOWER(invoice."status") NOT LIKE '%gelösch%'
        AND LOWER(invoice."status") NOT LIKE '%storn%'
        AND NOT EXISTS (
          SELECT 1
          FROM "Invoice" currentInvoice
          INNER JOIN "WorkPilotProject" currentProject
            ON currentProject."organizationId" = currentInvoice."organizationId"
           AND currentProject."id" = currentInvoice."projectId"
          WHERE currentInvoice."organizationId" = invoice."organizationId"
            AND currentProject."contactId" = project."contactId"
            AND currentInvoice."createdAt" >= ${currentComparisonStart}
            AND LOWER(currentInvoice."status") NOT LIKE '%gelösch%'
            AND LOWER(currentInvoice."status") NOT LIKE '%storn%'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "activeProjectFollowUp" followup
          WHERE followup."projectId" = project."id"
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "activeContactFollowUp" followup
          WHERE followup."contactId" = project."contactId"
        )
      ORDER BY project."contactId", invoice."createdAt" DESC
    )
    SELECT * FROM "viewedOffers"
    UNION ALL
    SELECT * FROM "completedProjects"
    UNION ALL
    SELECT * FROM "priorYearServices"
    ORDER BY "occurredAt" DESC
    LIMIT 100
  `);

  return rows.map((row) => ({
    ...row,
    offerId: row.offerId || undefined,
  }));
}

const liveSource: JarvisSalesAnalysisSource = {
  loadSignals: loadLiveSignals,
};

export async function resolveJarvisSalesAnalysisRequest(
  input: {
    question: string;
    organizationId: string;
    accessProfile: JarvisAccessProfile;
    now?: Date;
  },
  source: JarvisSalesAnalysisSource = liveSource
): Promise<JarvisSalesAnalysisResponse | undefined> {
  if (!resolveJarvisSalesAnalysisIntent(input.question)) return undefined;

  const actionDecision = getJarvisActionDecision(
    "sales.analysis.read",
    input.accessProfile
  );
  if (
    !isManagementActor(input.accessProfile) ||
    !actionDecision.permitted ||
    !actionDecision.executable
  ) {
    return {
      type: "refusal",
      topicId: "sales.analysis.refused",
      message:
        "Der neue JARVIS-Vertriebscheck befindet sich im geschützten Dry-Run und ist derzeit nur für die Geschäftsführung freigegeben.",
      deterministic: true,
    };
  }

  const now = input.now ?? new Date();
  const signals = await source.loadSignals({
    organizationId: input.organizationId,
    now,
  });
  const records = buildJarvisSalesAnalysisRecords(signals, now);
  if (records.length === 0) {
    return {
      type: "unknown",
      topicId: "sales.analysis.empty",
      message:
        "Der aktuelle Live-Dry-Run hat keine ausreichend belegte, noch nicht nachverfolgte Vertriebschance gefunden. Es wurden keine Daten geändert und keine Mail oder Aufgabe erzeugt.",
      deterministic: true,
    };
  }

  return {
    type: "answer",
    topicId: "sales.analysis.dry-run",
    message:
      `Der Live-Dry-Run zeigt ${records.length} priorisierte Hinweis${records.length === 1 ? "" : "e"}. ` +
      "Jeder Treffer nennt seine Datenquelle; vorhandene aktive Nachfassspuren werden unterdrückt. Es wurden keine Daten geändert, keine Aufgabe angelegt und keine Mail versendet.",
    records,
    deterministic: true,
  };
}
