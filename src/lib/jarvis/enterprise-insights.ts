import { prisma } from "@/lib/db/client";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import { createJarvisDialogChoice } from "@/lib/jarvis/dialog";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type { JarvisReadResponse, JarvisRecordResult } from "@/lib/jarvis/read-model";
import type { JarvisAccessProfile } from "@/lib/jarvis/security";
import type { JarvisDialogState } from "@/lib/jarvis/dialog-state";

export type JarvisEnterpriseInsightIntent =
  | "overview"
  | "revenue_trend"
  | "margin_trend"
  | "customer_concentration"
  | "sales_pipeline"
  | "proactive_sales"
  | "offer_conversion_scenario"
  | "price_increase_scenario"
  | "target_gap";

type InsightInvoice = {
  id: string;
  invoiceNumber: string;
  projectId: string;
  projectNumber: string;
  customerName: string;
  status: string;
  netTotal: number;
  grossTotal: number;
  serviceDate: string;
  plannedExecutionMonth: string;
  createdAt: Date;
  lines: Array<{
    totalNet: number;
    materialCostSnapshot: number;
    laborCostSnapshot: number;
  }>;
};

type InsightOffer = {
  id: string;
  offerNumber: string;
  projectId: string;
  projectNumber: string;
  projectTitle: string;
  customerName: string;
  status: string;
  netTotal: number;
  createdAt: Date;
  updatedAt: Date;
  acceptanceRequests: Array<{
    sentAt: Date | null;
    firstViewedAt: Date | null;
    acceptedAt: Date | null;
    revokedAt: Date | null;
  }>;
};

type InsightOpportunity = {
  id: string;
  title: string;
  customerName: string;
  contactId: string | null;
  projectId: string | null;
  offerId: string | null;
  ownerName: string;
  stage: string;
  estimatedValue: number;
  probability: number;
  nextAction: string;
  nextActionAt: Date | null;
  updatedAt: Date;
};

type InsightTarget = {
  id: string;
  title: string;
  metricKey: string;
  targetValue: number;
  targetMonth: string;
  periodStart: string;
  periodEnd: string;
  status: string;
};

export type JarvisEnterpriseInsightSnapshot = {
  invoices: InsightInvoice[];
  offers: InsightOffer[];
  opportunities: InsightOpportunity[];
  targets: InsightTarget[];
};

export type JarvisEnterpriseInsightSource = {
  load(input: { organizationId: string }): Promise<JarvisEnterpriseInsightSnapshot>;
};

export const jarvisEnterpriseInsightLiveSource: JarvisEnterpriseInsightSource = {
  async load({ organizationId }) {
    const [invoices, offerRows, acceptanceRequests, opportunities, targets] = await Promise.all([
      prisma.invoice.findMany({
        where: { organizationId },
        select: {
          id: true,
          invoiceNumber: true,
          projectId: true,
          projectNumber: true,
          customerName: true,
          status: true,
          netTotal: true,
          grossTotal: true,
          serviceDate: true,
          plannedExecutionMonth: true,
          createdAt: true,
          lines: {
            select: {
              totalNet: true,
              materialCostSnapshot: true,
              laborCostSnapshot: true,
            },
          },
        },
      }),
      prisma.offer.findMany({
        where: { organizationId },
        select: {
          id: true,
          offerNumber: true,
          projectId: true,
          projectNumber: true,
          projectTitle: true,
          customerName: true,
          status: true,
          netTotal: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.offerAcceptanceRequest.findMany({
        where: { organizationId },
        select: {
          offerId: true,
          sentAt: true,
          firstViewedAt: true,
          acceptedAt: true,
          revokedAt: true,
        },
      }),
      prisma.salesOpportunity.findMany({
        where: { organizationId },
        select: {
          id: true,
          title: true,
          customerName: true,
          contactId: true,
          projectId: true,
          offerId: true,
          ownerName: true,
          stage: true,
          estimatedValue: true,
          probability: true,
          nextAction: true,
          nextActionAt: true,
          updatedAt: true,
        },
      }),
      prisma.salesTarget.findMany({
        where: { organizationId },
        select: {
          id: true,
          title: true,
          metricKey: true,
          targetValue: true,
          targetMonth: true,
          periodStart: true,
          periodEnd: true,
          status: true,
        },
      }),
    ]);
    const requestsByOffer = new Map<string, InsightOffer["acceptanceRequests"]>();
    acceptanceRequests.forEach((request) => {
      const current = requestsByOffer.get(request.offerId) ?? [];
      current.push(request);
      requestsByOffer.set(request.offerId, current);
    });
    const offers: InsightOffer[] = offerRows.map((offer) => ({
      ...offer,
      acceptanceRequests: requestsByOffer.get(offer.id) ?? [],
    }));
    return { invoices, offers, opportunities, targets };
  },
};

const OPEN_OFFER_MARKERS = ["offen", "versendet", "gesendet", "betrachtet", "viewed"];
const DRAFT_OFFER_MARKERS = ["entwurf", "draft"];
const WON_OFFER_MARKERS = ["gewonnen", "angenommen", "akzeptiert"];
const LOST_OFFER_MARKERS = ["verlor", "abgelehnt", "storn", "geloscht", "deleted"];
const CLOSED_OPPORTUNITY_STAGES = ["won", "lost", "closed", "gewonnen", "verloren"];

function normalize(value: string | null | undefined) {
  return normalizeJarvisIntentText(value ?? "").replace(/\s+/g, " ").trim();
}

function hasMarker(value: string, markers: string[]) {
  const normalized = normalize(value);
  return markers.some((marker) => normalized.includes(marker));
}

function isFinancialInvoice(invoice: InsightInvoice) {
  const status = normalize(invoice.status);
  return status !== "entwurf" && !["storn", "geloscht", "deleted"].some((marker) => status.includes(marker));
}

function isOpenOffer(offer: InsightOffer) {
  if (
    hasMarker(offer.status, DRAFT_OFFER_MARKERS)
    || hasMarker(offer.status, LOST_OFFER_MARKERS)
    || hasMarker(offer.status, WON_OFFER_MARKERS)
  ) return false;
  return hasMarker(offer.status, OPEN_OFFER_MARKERS) || !normalize(offer.status);
}

function isWonOffer(offer: InsightOffer) {
  return hasMarker(offer.status, WON_OFFER_MARKERS);
}

function isLostOffer(offer: InsightOffer) {
  return hasMarker(offer.status, LOST_OFFER_MARKERS);
}

function berlinDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function invoiceMonth(invoice: InsightInvoice) {
  const candidates = [invoice.plannedExecutionMonth, invoice.serviceDate];
  for (const candidate of candidates) {
    const match = candidate?.match(/^(20\d{2})-(0[1-9]|1[0-2])/);
    if (match) return `${match[1]}-${match[2]}`;
  }
  return berlinDateKey(invoice.createdAt).slice(0, 7);
}

function monthSequence(endMonth: string, count: number) {
  const [year, month] = endMonth.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - count + index, 1));
    return date.toISOString().slice(0, 7);
  });
}

function shiftMonth(month: string, offset: number) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}

function formatMonth(month: string) {
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, number - 1, 1))
  );
}

function money(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function percent(value: number) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value) + " %";
}

function parseMonths(question: string) {
  const normalized = normalize(question);
  const match = normalized.match(/\b(3|6|12|18|24)\s+monat/);
  if (match) return Number(match[1]);
  if (/quartal/.test(normalized)) return 3;
  return 12;
}

function parseScenarioPercent(question: string) {
  const normalized = question.replace(",", ".");
  const match = normalized.match(/\b(\d{1,3}(?:\.\d+)?)\s*(?:%|prozent)\b/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : undefined;
}

function ageDays(value: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - value.getTime()) / 86_400_000));
}

function costSummary(invoices: InsightInvoice[]) {
  let revenue = 0;
  let costs = 0;
  let coveredRevenue = 0;
  invoices.forEach((invoice) => {
    revenue += invoice.netTotal;
    const lineRevenue = invoice.lines.reduce((sum, line) => sum + line.totalNet, 0);
    const lineCosts = invoice.lines.reduce(
      (sum, line) => sum + line.materialCostSnapshot + line.laborCostSnapshot,
      0
    );
    if (invoice.lines.length && lineRevenue > 0 && lineCosts > 0) {
      coveredRevenue += lineRevenue;
      costs += lineCosts;
    }
  });
  const coverage = revenue > 0 ? (coveredRevenue / revenue) * 100 : 0;
  return { revenue, costs, coveredRevenue, coverage, contribution: coveredRevenue - costs };
}

function requiredAction(intent: JarvisEnterpriseInsightIntent) {
  return intent === "proactive_sales" || intent === "sales_pipeline" || intent === "offer_conversion_scenario"
    ? "offer.read"
    : "invoice.read";
}

export function resolveJarvisEnterpriseInsightIntent(
  question: string
): JarvisEnterpriseInsightIntent | undefined {
  const value = normalize(question);
  if (/\b(?:was ware wenn|was passiert wenn|szenario|simulier)\w*\b.*(?:\bangebot\w*\b.*\b(?:angenommen|gewonnen|abschluss|quote)\w*\b|\b(?:annahme|abschluss|conversion)\w*\b.*\bangebot\w*\b)|\bangebot\w*\b.*\b(?:annahme|abschluss|conversion)\w*\b.*\b(?:szenario|prozent)\w*\b/.test(value)) return "offer_conversion_scenario";
  if (/\b(?:was ware wenn|was passiert wenn|szenario|simulier)\w*\b.*\b(?:preis|preise|preiserhohung)\w*\b|\b(?:preis|preise)\w*\b.*\b(?:erhoh|steiger)\w*\b.*\b(?:szenario|prozent|umsatz|marge|deckungsbeitrag)\w*\b/.test(value)) return "price_increase_scenario";
  if (/\b(?:umsatzziel|vertriebsziel|zielumsatz|zielerreichung|ziel lucke|ziel fehlt|bis zum ziel)\w*\b/.test(value)) return "target_gap";
  if (/\b(?:proaktiv\w*.*vertrieb|vertriebsimpuls\w*|vertriebsprioritat\w*|was soll\w*.*vertrieb|was muss\w*.*vertrieb|welche kunden.*(?:anrufen|kontaktieren|angehen)|wen sollen wir.*(?:anrufen|kontaktieren|angehen)|nachste vertriebsaktion\w*)\b/.test(value)) return "proactive_sales";
  if (/\b(?:pipeline|vertriebspipeline|vertriebstrichter|vertriebsbestand)\w*\b.*\b(?:analys|trend|entwicklung|status|wert|chance)\w*\b|\b(?:analys|trend|wert)\w*\b.*\b(?:pipeline|vertriebspipeline|vertriebstrichter)\w*\b|\bwie (?:sieht|schaut) es\b.*\bangebot\w*\b|\bwie lauft es\b.*\bvertrieb\w*\b/.test(value)) return "sales_pipeline";
  if (/\b(?:kundenkonzentration|umsatzkonzentration|kundenanteil|abhangig\w*.*kunde|top kunden.*umsatz|umsatz.*top kunden)\b/.test(value)) return "customer_concentration";
  if (/\b(?:margenentwicklung|margentrend|marge\w*.*entwick\w*|deckungsbeitrag\w*.*trend|trend\w*.*(?:marge|deckungsbeitrag)|rentabilitat\w*.*entwicklung|wie (?:sieht|schaut) es\b.*\bmarge\w*)\b/.test(value)) return "margin_trend";
  if (/\b(?:umsatzentwicklung|umsatztrend|umsatz\w*.*entwick\w*|trend\w*.*umsatz|umsatz\w*.*trend|vorjahr\w*.*umsatz|umsatz\w*.*vorjahr|wie (?:sieht|schaut) es\b.*\bumsatz\w*)\b/.test(value)) return "revenue_trend";
  if (/\b(?:unternehmensanalyse|unternehmenskennzahl\w*|bwa(?:\s+ahnlich\w*)?|bwl analyse|geschaftsanalyse|wichtigste\w* zahlen|gesamtbild|analysier\w*.*(?:unternehmen|firma|betrieb)|wie steht\w*.*(?:unternehmen|firma|betrieb)|wie lauft es\b.*(?:bei uns|unternehmen|firma|betrieb)|wirtschaftlich\w*.*(?:unternehmen|firma|betrieb)|gesamtanalyse)\b/.test(value)) return "overview";
  return undefined;
}

const ENTERPRISE_FOLLOW_UP_TOPICS: Record<string, string> = {
  "enterprise.overview": "Analysiere unser Unternehmen",
  "enterprise.revenue-trend": "Zeige den Umsatztrend",
  "enterprise.margin-trend": "Zeige den Margentrend",
  "enterprise.customer-concentration": "Analysiere die Kundenkonzentration",
  "enterprise.sales-pipeline": "Analysiere die Vertriebspipeline",
  "enterprise.proactive-sales": "Gib mir proaktive Vertriebsimpulse",
  "enterprise.offer-conversion-scenario": "Simuliere die Annahmequote der offenen Angebote",
  "enterprise.price-increase-scenario": "Simuliere eine Preiserhöhung",
  "enterprise.target-gap": "Zeige die Lücke bis zum Umsatzziel",
};

export function resolveJarvisEnterpriseFollowUpQuestion(
  question: string,
  previousState?: Pick<JarvisDialogState, "topicId">
) {
  if (resolveJarvisEnterpriseInsightIntent(question)) return question;
  const canonical = previousState?.topicId ? ENTERPRISE_FOLLOW_UP_TOPICS[previousState.topicId] : undefined;
  if (!canonical) return question;
  const value = normalize(question);
  const looksLikeFollowUp =
    /^(?:und|davon|dann|jetzt|nur|auch|im|fur|gegenuber)\b/.test(value)
    || /\b(?:vorjahr|letztes jahr|monat\w*|prozent|genauer|warum)\b/.test(value);
  return looksLikeFollowUp ? `${canonical}. Ergänzung des Nutzers: ${question}` : question;
}

function invoiceRecord(invoice: InsightInvoice, summary: string, status: string): JarvisRecordResult {
  return {
    id: `enterprise-invoice-${invoice.id}`,
    kind: "invoice",
    title: `${invoice.invoiceNumber} · ${invoice.customerName || "Ohne Kunde"}`,
    subtitle: invoice.projectNumber || "Ohne Projektnummer",
    summary,
    status,
    target: { kind: "invoice", id: invoice.id, projectId: invoice.projectId },
  };
}

function offerRecord(offer: InsightOffer, summary: string, status: string): JarvisRecordResult {
  return {
    id: `enterprise-offer-${offer.id}`,
    kind: "offer",
    title: `${offer.offerNumber} · ${offer.customerName || "Ohne Kunde"}`,
    subtitle: [offer.projectNumber, offer.projectTitle].filter(Boolean).join(" · "),
    summary,
    status,
    target: { kind: "offer", id: offer.id, projectId: offer.projectId },
  };
}

function proactiveSalesRecords(snapshot: JarvisEnterpriseInsightSnapshot, now: Date) {
  const offerSignals = snapshot.offers
    .filter(isOpenOffer)
    .map((offer) => {
      const viewedAt = offer.acceptanceRequests
        .filter((request) => request.firstViewedAt && !request.acceptedAt && !request.revokedAt)
        .map((request) => request.firstViewedAt!)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const days = ageDays(viewedAt ?? offer.updatedAt, now);
      const score = (viewedAt ? 320 : 220) + Math.min(offer.netTotal / 1000, 100) - Math.min(days, 120);
      return {
        score,
        record: offerRecord(
          offer,
          viewedAt
            ? `Digital angesehen, noch nicht angenommen. ${money(offer.netTotal)} netto; letzter relevanter Stand vor ${days} Tagen. Persönlich nachfassen und offene Fragen klären.`
            : `Offenes Angebot über ${money(offer.netTotal)} netto; seit ${days} Tagen ohne belegten Abschluss. Nächsten Schritt und Verantwortlichkeit prüfen.`,
          viewedAt ? "Hohe Vertriebspriorität · Dry-Run" : "Nachfassen prüfen · Dry-Run"
        ),
      };
    });

  const opportunitySignals = snapshot.opportunities
    .filter((item) => !CLOSED_OPPORTUNITY_STAGES.includes(normalize(item.stage)))
    .filter((item) => item.offerId || item.projectId || item.contactId)
    .map((item) => {
      const overdueDays = item.nextActionAt ? ageDays(item.nextActionAt, now) : 0;
      const weightedValue = item.estimatedValue * Math.max(0, Math.min(item.probability, 100)) / 100;
      const score = (item.nextActionAt && item.nextActionAt <= now ? 280 : 160) + Math.min(weightedValue / 1000, 100) + (item.nextAction ? 0 : 30);
      const kind = item.offerId ? "offer" : item.projectId ? "project" : "customer";
      const id = item.offerId ?? item.projectId ?? item.contactId!;
      const record: JarvisRecordResult = {
        id: `enterprise-opportunity-${item.id}`,
        kind,
        title: `${item.title} · ${item.customerName || "Ohne Kunde"}`,
        subtitle: [item.ownerName || "Ohne Verantwortlichen", `Gewichtet ${money(weightedValue)}`].join(" · "),
        summary: item.nextAction
          ? `${item.nextAction}${item.nextActionAt ? `; ${overdueDays > 0 ? `${overdueDays} Tage überfällig` : "terminiert"}` : ""}.`
          : "Es ist keine konkrete nächste Vertriebsaktion hinterlegt; Verantwortlichkeit und Termin ergänzen.",
        status: item.nextActionAt && item.nextActionAt <= now ? "Fällig · Dry-Run" : "Pipeline prüfen · Dry-Run",
        target: { kind, id, projectId: item.projectId ?? undefined },
      };
      return { score, record };
    });

  return [...offerSignals, ...opportunitySignals]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((entry) => entry.record);
}

export async function resolveJarvisEnterpriseInsightRequest(input: {
  question: string;
  organizationId: string;
  accessProfile: JarvisAccessProfile;
  now?: Date;
  source?: JarvisEnterpriseInsightSource;
}): Promise<JarvisReadResponse | undefined> {
  const intent = resolveJarvisEnterpriseInsightIntent(input.question);
  if (!intent) return undefined;
  const decision = getJarvisActionDecision(requiredAction(intent), input.accessProfile);
  if (!decision.executable) {
    return {
      type: "refusal",
      topicId: `enterprise.${intent}.refused`,
      message: "Deine aktuelle WorkPilot-Rolle darf diese unternehmensweite Finanz- oder Vertriebsanalyse nicht über JARVIS abrufen.",
      deterministic: true,
    };
  }

  const snapshot = await (input.source ?? jarvisEnterpriseInsightLiveSource).load({ organizationId: input.organizationId });
  const now = input.now ?? new Date();
  const currentMonth = berlinDateKey(now).slice(0, 7);
  const months = parseMonths(input.question);
  const monthKeys = monthSequence(currentMonth, months);
  const financialInvoices = snapshot.invoices.filter(isFinancialInvoice);
  const rangedInvoices = financialInvoices.filter((invoice) => monthKeys.includes(invoiceMonth(invoice)));

  if (intent === "revenue_trend") {
    const byMonth = new Map(monthKeys.map((month) => [month, 0]));
    rangedInvoices.forEach((invoice) => byMonth.set(invoiceMonth(invoice), (byMonth.get(invoiceMonth(invoice)) ?? 0) + invoice.netTotal));
    const values = monthKeys.map((month) => byMonth.get(month) ?? 0);
    const current = values.at(-1) ?? 0;
    const previous = values.at(-2) ?? 0;
    const change = previous > 0 ? ((current - previous) / previous) * 100 : undefined;
    const priorYearKeys = monthKeys.map((month) => shiftMonth(month, -12));
    const priorYearTotal = financialInvoices
      .filter((invoice) => priorYearKeys.includes(invoiceMonth(invoice)))
      .reduce((sum, invoice) => sum + invoice.netTotal, 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    const priorYearChange = priorYearTotal > 0 ? ((total - priorYearTotal) / priorYearTotal) * 100 : undefined;
    const topInvoices = [...rangedInvoices].sort((a, b) => b.netTotal - a.netTotal).slice(0, 5);
    return {
      type: "answer",
      topicId: "enterprise.revenue-trend",
      message: `Der fakturierte Nettoumsatz der letzten ${months} Monate beträgt ${money(total)}. Der aktuelle Monat liegt bei ${money(current)}${change === undefined ? "; ein belastbarer Vormonatsvergleich ist nicht möglich" : ` und damit ${percent(Math.abs(change))} ${change >= 0 ? "über" : "unter"} dem Vormonat`}. ${priorYearChange === undefined ? "Für den entsprechenden Vorjahreszeitraum liegt keine belastbare Vergleichsbasis vor." : `Gegenüber dem entsprechenden Vorjahreszeitraum mit ${money(priorYearTotal)} sind das ${percent(Math.abs(priorYearChange))} ${priorYearChange >= 0 ? "mehr" : "weniger"}.`} Entwürfe, Stornos und gelöschte Rechnungen sind ausgeschlossen.`,
      structured: {
        title: `Umsatztrend · ${months} Monate`,
        subtitle: "Fakturierte Nettoumsätze nach Leistungsmonat",
        facts: [
          { label: "Zeitraum", value: `${formatMonth(monthKeys[0])} bis ${formatMonth(monthKeys.at(-1)!)}` },
          { label: "Gesamt", value: money(total) },
          { label: "Vorjahreszeitraum", value: priorYearTotal > 0 ? money(priorYearTotal) : "Keine Vergleichsbasis" },
          { label: "Veränderung zum Vorjahr", value: priorYearChange === undefined ? "Nicht belastbar" : `${priorYearChange >= 0 ? "+" : "-"}${percent(Math.abs(priorYearChange))}`, tone: priorYearChange !== undefined && priorYearChange < 0 ? "warning" : "neutral" },
          { label: "Aktueller Monat", value: money(current), tone: change !== undefined && change < 0 ? "warning" : "neutral" },
        ],
        sections: [{ title: "Monatswerte", items: monthKeys.map((month) => `${formatMonth(month)}: ${money(byMonth.get(month) ?? 0)}`) }],
      },
      records: topInvoices.map((invoice) => invoiceRecord(invoice, `${money(invoice.netTotal)} netto im betrachteten Zeitraum.`, "Umsatztreiber")),
      deterministic: true,
    };
  }

  if (intent === "margin_trend") {
    const summary = costSummary(rangedInvoices);
    const margin = summary.coveredRevenue > 0 ? (summary.contribution / summary.coveredRevenue) * 100 : undefined;
    return {
      type: "answer",
      topicId: "enterprise.margin-trend",
      message: summary.coveredRevenue > 0
        ? `Für ${money(summary.coveredRevenue)} Nettoumsatz mit vorhandenen Rechnungskosten-Snapshots ergibt sich ein belegter Teildeckungsbeitrag von ${money(summary.contribution)} beziehungsweise ${percent(margin!)}. Die Snapshot-Abdeckung am gesamten Umsatz des Zeitraums beträgt ${percent(summary.coverage)}; der Wert ist deshalb ${summary.coverage >= 95 ? "weitgehend belastbar" : "nur eine gekennzeichnete Teilkostenanalyse"}.`
        : `Für den gewählten Zeitraum fehlen verwertbare Rechnungskosten-Snapshots. Ich berechne deshalb keine erfundene Marge. Der Umsatz beträgt ${money(summary.revenue)}, aber Material- und Lohnkosten sind dafür nicht ausreichend historisch belegt.`,
      structured: {
        title: `Margen- und Deckungsbeitragsanalyse · ${months} Monate`,
        facts: [
          { label: "Gesamtumsatz", value: money(summary.revenue) },
          { label: "Umsatz mit Kostennachweis", value: money(summary.coveredRevenue) },
          { label: "Snapshot-Abdeckung", value: percent(summary.coverage), tone: summary.coverage < 95 ? "warning" : "positive" },
          { label: "Teil-Deckungsbeitrag", value: summary.coveredRevenue > 0 ? money(summary.contribution) : "Nicht belastbar" },
        ],
      },
      deterministic: true,
    };
  }

  if (intent === "customer_concentration") {
    const totals = new Map<string, { name: string; total: number }>();
    rangedInvoices.forEach((invoice) => {
      const name = invoice.customerName.trim() || "Ohne Kundenzuordnung";
      const key = normalize(name);
      const current = totals.get(key) ?? { name, total: 0 };
      current.total += invoice.netTotal;
      totals.set(key, current);
    });
    const overall = rangedInvoices.reduce((sum, invoice) => sum + invoice.netTotal, 0);
    const ranked = [...totals.values()].sort((a, b) => b.total - a.total);
    const topShare = overall > 0 ? ((ranked[0]?.total ?? 0) / overall) * 100 : 0;
    const topFiveShare = overall > 0 ? (ranked.slice(0, 5).reduce((sum, item) => sum + item.total, 0) / overall) * 100 : 0;
    return {
      type: "answer",
      topicId: "enterprise.customer-concentration",
      message: overall > 0
        ? `Der Nettoumsatz der letzten ${months} Monate verteilt sich auf ${ranked.length} Kundenbezeichnungen. Der größte Kunde trägt ${percent(topShare)}, die fünf größten zusammen ${percent(topFiveShare)}. ${topShare >= 30 ? "Damit besteht ein sichtbares Einzelkunden-Konzentrationsrisiko, das fachlich geprüft werden sollte." : "Es ist kein einzelner Kunde mit mindestens 30 % Umsatzanteil sichtbar."}`
        : `Im gewählten Zeitraum gibt es keinen fakturierten Nettoumsatz; eine Kundenkonzentration kann deshalb nicht bewertet werden.`,
      structured: {
        title: `Kundenkonzentration · ${months} Monate`,
        facts: [
          { label: "Nettoumsatz", value: money(overall) },
          { label: "Größter Kundenanteil", value: percent(topShare), tone: topShare >= 30 ? "warning" : "neutral" },
          { label: "Top-5-Anteil", value: percent(topFiveShare), tone: topFiveShare >= 70 ? "warning" : "neutral" },
        ],
        sections: [{ title: "Größte Umsatzanteile", items: ranked.slice(0, 10).map((item) => `${item.name}: ${money(item.total)} · ${percent(overall > 0 ? item.total / overall * 100 : 0)}`) }],
      },
      deterministic: true,
    };
  }

  if (intent === "sales_pipeline") {
    const activeOpportunities = snapshot.opportunities.filter((item) => !CLOSED_OPPORTUNITY_STAGES.includes(normalize(item.stage)));
    const weighted = activeOpportunities.reduce((sum, item) => sum + item.estimatedValue * Math.max(0, Math.min(item.probability, 100)) / 100, 0);
    const openOffers = snapshot.offers.filter(isOpenOffer);
    const won = snapshot.offers.filter(isWonOffer);
    const lost = snapshot.offers.filter(isLostOffer);
    const decided = won.length + lost.length;
    const conversion = decided > 0 ? won.length / decided * 100 : undefined;
    const dueActions = activeOpportunities.filter((item) => !item.nextAction || (item.nextActionAt && item.nextActionAt <= now));
    return {
      type: "answer",
      topicId: "enterprise.sales-pipeline",
      message: `Die aktive Vertriebspipeline enthält ${activeOpportunities.length} Chancen mit ${money(weighted)} wahrscheinlichkeitsgewichtetem Wert und ${openOffers.length} offene Angebote über ${money(openOffers.reduce((sum, offer) => sum + offer.netTotal, 0))}. ${conversion === undefined ? "Für eine Abschlussquote fehlen entschiedene Angebote." : `Die belegte Angebotsabschlussquote beträgt ${percent(conversion)}.`} ${dueActions.length} Chancen haben eine fällige oder fehlende nächste Aktion.`,
      structured: {
        title: "Vertriebspipeline",
        facts: [
          { label: "Aktive Chancen", value: String(activeOpportunities.length) },
          { label: "Gewichteter Pipelinewert", value: money(weighted) },
          { label: "Offene Angebote", value: `${openOffers.length} · ${money(openOffers.reduce((sum, offer) => sum + offer.netTotal, 0))}` },
          { label: "Fällige/fehlende Aktionen", value: String(dueActions.length), tone: dueActions.length ? "warning" : "positive" },
        ],
      },
      records: proactiveSalesRecords(snapshot, now).slice(0, 5),
      deterministic: true,
    };
  }

  if (intent === "proactive_sales") {
    const records = proactiveSalesRecords(snapshot, now);
    return {
      type: "answer",
      topicId: "enterprise.proactive-sales",
      message: records.length
        ? `Ich habe ${records.length} priorisierte Vertriebsimpulse aus offenen beziehungsweise angesehenen Angeboten und aktiven Verkaufschancen ermittelt. Die Reihenfolge basiert auf belegtem Status, Fälligkeit, Alter und finanziellem Gewicht. Das ist ein Dry-Run: Es wurde keine Aufgabe erzeugt und keine Nachricht versendet.`
        : "Aktuell ist aus offenen Angeboten und Verkaufschancen kein belastbarer proaktiver Vertriebsimpuls ableitbar. Ich erfinde deshalb keine Kontaktliste.",
      records,
      navigation: { label: "Vertrieb öffnen", tab: "salesHub" },
      deterministic: true,
    };
  }

  if (intent === "offer_conversion_scenario") {
    const scenarioPercent = parseScenarioPercent(input.question);
    if (scenarioPercent === undefined) {
      return {
        type: "clarification",
        topicId: "enterprise.offer-conversion-scenario.percentage-required",
        message: "Mit welcher Annahmequote soll ich die aktuell offenen Angebote simulieren? Die Rechnung verändert keine Angebote und übernimmt keinen Auftrag.",
        choices: [25, 50, 75].map((value) => createJarvisDialogChoice(`enterprise-offer-scenario-${value}`, `${value} % simulieren`, `Simuliere, dass ${value} % der offenen Angebote angenommen werden`)),
        deterministic: true,
      };
    }
    const openOffers = snapshot.offers.filter(isOpenOffer);
    const openValue = openOffers.reduce((sum, offer) => sum + offer.netTotal, 0);
    const scenarioValue = openValue * scenarioPercent / 100;
    return {
      type: "answer",
      topicId: "enterprise.offer-conversion-scenario",
      message: `Wenn ${percent(scenarioPercent)} des aktuell offenen Angebotsvolumens von ${money(openValue)} angenommen werden, entspricht das rechnerisch ${money(scenarioValue)} zusätzlichem Netto-Auftragsvolumen. Das ist eine lineare Szenarioannahme, kein Forecast und keine Zusage; Zeitpunkt, Ausführungskapazität, Angebotslaufzeit und tatsächliche Abschlusswahrscheinlichkeit sind darin nicht automatisch berücksichtigt.`,
      structured: {
        title: "Szenario · Angebotsannahme",
        facts: [
          { label: "Offene Angebote", value: String(openOffers.length) },
          { label: "Offenes Nettovolumen", value: money(openValue) },
          { label: "Annahme", value: percent(scenarioPercent) },
          { label: "Szenariowert", value: money(scenarioValue), tone: "positive" },
        ],
      },
      records: [...openOffers].sort((a, b) => b.netTotal - a.netTotal).slice(0, 5).map((offer) => offerRecord(offer, `${money(offer.netTotal)} offenes Nettovolumen.`, "Szenariobasis")),
      deterministic: true,
    };
  }

  if (intent === "price_increase_scenario") {
    const scenarioPercent = parseScenarioPercent(input.question);
    if (scenarioPercent === undefined) {
      return {
        type: "clarification",
        topicId: "enterprise.price-increase-scenario.percentage-required",
        message: "Um wie viel Prozent soll ich die Preise auf der fakturierten Nettoumsatzbasis der letzten zwölf Monate simulieren? Es werden keine Katalog-, Angebots- oder Rechnungspreise geändert.",
        choices: [3, 5, 10].map((value) => createJarvisDialogChoice(`enterprise-price-scenario-${value}`, `${value} % simulieren`, `Simuliere eine Preiserhöhung von ${value} %`)),
        deterministic: true,
      };
    }
    const summary = costSummary(rangedInvoices);
    const additionalRevenue = summary.revenue * scenarioPercent / 100;
    const scenarioContribution = summary.contribution + summary.coveredRevenue * scenarioPercent / 100;
    return {
      type: "answer",
      topicId: "enterprise.price-increase-scenario",
      message: `Eine rein lineare Preiserhöhung um ${percent(scenarioPercent)} auf den fakturierten Nettoumsatz der letzten ${months} Monate (${money(summary.revenue)}) ergäbe rechnerisch ${money(additionalRevenue)} Mehrumsatz, wenn Menge, Mix, Rabatte und Nachfrage unverändert bleiben. ${summary.coveredRevenue > 0 ? `Für den Umsatzanteil mit Kosten-Snapshots läge der Teildeckungsbeitrag rechnerisch bei ${money(scenarioContribution)}; die Kostenabdeckung beträgt ${percent(summary.coverage)}.` : "Mangels ausreichender Kosten-Snapshots berechne ich daraus keine Marge."} Es wurden keine Preise verändert.`,
      structured: {
        title: "Szenario · Preiserhöhung",
        facts: [
          { label: "Umsatzbasis", value: money(summary.revenue) },
          { label: "Preiserhöhung", value: percent(scenarioPercent) },
          { label: "Rechnerischer Mehrumsatz", value: money(additionalRevenue), tone: "positive" },
          { label: "Kostenabdeckung", value: percent(summary.coverage), tone: summary.coverage < 95 ? "warning" : "neutral" },
        ],
        sections: [{ title: "Annahmen", items: ["Menge und Leistungsmix unverändert", "Rabatte und Nachfrage unverändert", "keine automatische Preisänderung", "Kostenwirkung nur für belegte Rechnungssnapshots"] }],
      },
      deterministic: true,
    };
  }

  if (intent === "target_gap") {
    const activeTargets = snapshot.targets.filter((target) => !["completed", "closed", "deleted", "erledigt"].includes(normalize(target.status)) && /umsatz|revenue/.test(normalize(target.metricKey + " " + target.title)));
    const target = activeTargets.find((item) => {
      if (item.targetMonth === currentMonth) return true;
      const startMonth = item.periodStart?.slice(0, 7);
      const endMonth = item.periodEnd?.slice(0, 7);
      return Boolean(startMonth && endMonth && startMonth <= currentMonth && endMonth >= currentMonth);
    });
    if (!target) {
      return { type: "answer", topicId: "enterprise.target-gap.empty", message: "Es ist kein aktives Umsatz- oder Vertriebsziel hinterlegt. Deshalb berechne ich keine erfundene Ziellücke. Lege zuerst ein eindeutiges Ziel mit Zeitraum und Zielwert fest.", deterministic: true };
    }
    const start = target.periodStart || `${target.targetMonth || currentMonth}-01`;
    const end = target.periodEnd || `${target.targetMonth || currentMonth}-31`;
    const actual = financialInvoices.filter((invoice) => {
      const month = invoiceMonth(invoice);
      const invoiceDate = `${month}-01`;
      return invoiceDate >= start.slice(0, 7) + "-01" && invoiceDate <= end.slice(0, 7) + "-31";
    }).reduce((sum, invoice) => sum + invoice.netTotal, 0);
    const gap = Math.max(0, target.targetValue - actual);
    const achievement = target.targetValue > 0 ? actual / target.targetValue * 100 : 0;
    return {
      type: "answer",
      topicId: "enterprise.target-gap",
      message: `Für „${target.title}“ sind ${money(actual)} von ${money(target.targetValue)} fakturiert. Die Zielerreichung beträgt ${percent(achievement)}; ${gap > 0 ? `es fehlen noch ${money(gap)}` : "das Ziel ist rechnerisch erreicht oder überschritten"}. Datenbasis sind fakturierte, nicht stornierte Rechnungen im hinterlegten Zielzeitraum.`,
      structured: { title: "Umsatzziel", facts: [{ label: "Ziel", value: money(target.targetValue) }, { label: "Ist", value: money(actual) }, { label: "Erreichung", value: percent(achievement), tone: achievement >= 100 ? "positive" : "warning" }, { label: "Offene Lücke", value: money(gap) }] },
      deterministic: true,
    };
  }

  const revenue = rangedInvoices.reduce((sum, invoice) => sum + invoice.netTotal, 0);
  const cost = costSummary(rangedInvoices);
  const openOffers = snapshot.offers.filter(isOpenOffer);
  const proactive = proactiveSalesRecords(snapshot, now);
  const customerTotals = new Map<string, number>();
  rangedInvoices.forEach((invoice) => customerTotals.set(normalize(invoice.customerName) || "ohne kunde", (customerTotals.get(normalize(invoice.customerName) || "ohne kunde") ?? 0) + invoice.netTotal));
  const largestCustomer = [...customerTotals.values()].sort((a, b) => b - a)[0] ?? 0;
  return {
    type: "answer",
    topicId: "enterprise.overview",
    message: `Die Unternehmensanalyse für die letzten ${months} Monate basiert auf fakturierten Rechnungen, offenen Angeboten und aktiven Verkaufschancen. Der Nettoumsatz beträgt ${money(revenue)}, das offene Angebotsvolumen ${money(openOffers.reduce((sum, offer) => sum + offer.netTotal, 0))}. ${cost.coveredRevenue > 0 ? `Der belegte Teildeckungsbeitrag liegt bei ${money(cost.contribution)} bei ${percent(cost.coverage)} Kostenabdeckung.` : "Eine belastbare Marge ist wegen fehlender Rechnungskosten-Snapshots nicht berechenbar."} ${proactive.length} priorisierte Vertriebsimpulse sind aktuell ableitbar.`,
    structured: {
      title: `Unternehmensanalyse · ${months} Monate`,
      facts: [
        { label: "Fakturierter Nettoumsatz", value: money(revenue) },
        { label: "Offenes Angebotsvolumen", value: money(openOffers.reduce((sum, offer) => sum + offer.netTotal, 0)) },
        { label: "Kostenabdeckung", value: percent(cost.coverage), tone: cost.coverage < 95 ? "warning" : "positive" },
        { label: "Größter Kundenanteil", value: percent(revenue > 0 ? largestCustomer / revenue * 100 : 0) },
        { label: "Vertriebsimpulse", value: String(proactive.length) },
      ],
      sections: [{ title: "Nächste sichere Vertiefungen", items: ["Umsatztrend", "Margen- und Snapshot-Abdeckung", "Kundenkonzentration", "Vertriebspipeline", "Angebots- oder Preisszenario"] }],
    },
    records: proactive.slice(0, 5),
    choices: [
      createJarvisDialogChoice("enterprise-revenue-trend", "Umsatztrend vertiefen", "Zeige den Umsatztrend der letzten 12 Monate"),
      createJarvisDialogChoice("enterprise-margin-trend", "Marge vertiefen", "Zeige den Margentrend der letzten 12 Monate"),
      createJarvisDialogChoice("enterprise-proactive-sales", "Vertriebsimpulse öffnen", "Gib mir proaktive Vertriebsimpulse"),
    ],
    deterministic: true,
  };
}
