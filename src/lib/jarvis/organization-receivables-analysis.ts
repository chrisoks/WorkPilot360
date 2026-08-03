import { prisma } from "@/lib/db/client";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import { extractJarvisProjectReferences } from "@/lib/jarvis/dialog-state";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type {
  JarvisReadResponse,
  JarvisRecordResult,
} from "@/lib/jarvis/read-model";
import type { JarvisAccessProfile } from "@/lib/jarvis/security";

export type OrganizationReceivableInvoice = {
  id: string;
  projectId: string;
  projectNumber: string;
  projectTitle: string;
  invoiceNumber: string;
  customerName: string;
  status: string;
  netTotal: number;
  dueDate: string;
  reminderLevel: number;
  isPaid: boolean;
  createdAt: Date;
};

export type OrganizationReceivablesSource = {
  load(input: {
    organizationId: string;
  }): Promise<OrganizationReceivableInvoice[]>;
};

type OrganizationReceivablesIntent = {
  presentation: "summary" | "list";
  scope: "all_open" | "overdue";
};

const liveSource: OrganizationReceivablesSource = {
  async load({ organizationId }) {
    return prisma.invoice.findMany({
      where: { organizationId },
      select: {
        id: true,
        projectId: true,
        projectNumber: true,
        projectTitle: true,
        invoiceNumber: true,
        customerName: true,
        status: true,
        netTotal: true,
        dueDate: true,
        reminderLevel: true,
        isPaid: true,
        createdAt: true,
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });
  },
};

function normalize(value: string) {
  return normalizeJarvisIntentText(value).replace(/\s+/g, " ").trim();
}

export function resolveJarvisOrganizationReceivablesIntent(
  question: string
): OrganizationReceivablesIntent | undefined {
  if (extractJarvisProjectReferences(question).length > 0) return undefined;
  const value = normalize(question);
  const mentionsReceivables =
    /\b(?:offen|offn)\w*\s+posten\b/.test(value) ||
    /\b(?:offen|offn|uberfallig)\w*\s+forderung\w*\b/.test(value) ||
    /\bwelch\w*\s+forderung\w*\b.*\buberfallig\w*\b/.test(value) ||
    /\b(?:offen|offn)\w*\s+rechnung\w*\b/.test(value) ||
    /\brechnung\w*\b.*\buberfallig\w*\b/.test(value);
  if (!mentionsReceivables) return undefined;

  return {
    scope: /\buberfallig\w*\b/.test(value) ? "overdue" : "all_open",
    presentation: /\b(?:welche|zeig|liste|nenn)\w*\b/.test(value)
      ? "list"
      : "summary",
  };
}

function isFinanciallyActive(invoice: OrganizationReceivableInvoice) {
  const status = normalize(invoice.status);
  return (
    status !== "entwurf" &&
    !status.includes("geloscht") &&
    !status.includes("storniert") &&
    !status.includes("storno")
  );
}

function isPaid(invoice: OrganizationReceivableInvoice) {
  return invoice.isPaid || normalize(invoice.status).includes("bezahlt");
}

function getBerlinDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function validDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : "";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function invoiceCountAfterFrom(count: number) {
  return count === 1 ? "einer Rechnung" : `${count} Rechnungen`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : "Fälligkeit fehlt";
}

function toRecord(invoice: OrganizationReceivableInvoice): JarvisRecordResult {
  return {
    id: `receivable-${invoice.id}`,
    kind: "invoice",
    title: invoice.invoiceNumber || "Rechnung ohne Nummer",
    subtitle: [
      invoice.customerName || "Ohne Kunde",
      invoice.projectNumber || invoice.projectTitle,
    ]
      .filter(Boolean)
      .join(" · "),
    summary: `${formatMoney(invoice.netTotal)} netto · ${
      invoice.dueDate
        ? `Fällig: ${formatDate(invoice.dueDate)}`
        : "Fälligkeit fehlt"
    }${
      invoice.reminderLevel > 0
        ? ` · Mahnstufe ${invoice.reminderLevel}`
        : ""
    }`,
    status: invoice.status,
    target: {
      kind: "invoice",
      id: invoice.id,
      ...(invoice.projectId ? { projectId: invoice.projectId } : {}),
    },
  };
}

export async function resolveJarvisOrganizationReceivablesRequest(
  input: {
    question: string;
    organizationId: string;
    accessProfile: JarvisAccessProfile;
    now?: Date;
    source?: OrganizationReceivablesSource;
  }
): Promise<JarvisReadResponse | undefined> {
  const intent = resolveJarvisOrganizationReceivablesIntent(input.question);
  if (!intent) return undefined;

  const decision = getJarvisActionDecision(
    "invoice.read",
    input.accessProfile
  );
  if (!decision.executable) {
    return {
      type: "refusal",
      topicId: "management.receivables",
      message:
        "Deine aktuelle WorkPilot-Rolle darf offene Forderungen nicht über JARVIS auswerten.",
      deterministic: true,
    };
  }

  const invoices = await (input.source ?? liveSource).load({
    organizationId: input.organizationId,
  });
  const todayKey = getBerlinDateKey(input.now ?? new Date());
  const openInvoices = invoices.filter(
    (invoice) => isFinanciallyActive(invoice) && !isPaid(invoice)
  );
  const overdueInvoices = openInvoices.filter((invoice) => {
    const dueDate = validDateKey(invoice.dueDate);
    return dueDate !== "" && dueDate < todayKey;
  });
  const dueTodayInvoices = openInvoices.filter(
    (invoice) => validDateKey(invoice.dueDate) === todayKey
  );
  const missingDueDateInvoices = openInvoices.filter(
    (invoice) => validDateKey(invoice.dueDate) === ""
  );
  const overdueWithoutReminder = overdueInvoices.filter(
    (invoice) => Number(invoice.reminderLevel) <= 0
  );
  const openTotal = openInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.netTotal || 0),
    0
  );
  const overdueTotal = overdueInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.netTotal || 0),
    0
  );
  const selected =
    intent.scope === "overdue" ? overdueInvoices : openInvoices;
  const message =
    openInvoices.length === 0
      ? "Aktuell gibt es keine unbezahlte, finanziell aktive Rechnung."
      : intent.scope === "overdue"
        ? overdueInvoices.length === 0
          ? `Aktuell ist von ${formatMoney(openTotal)} offenen Nettoforderungen keine überfällig.`
          : `${formatMoney(overdueTotal)} aus ${invoiceCountAfterFrom(overdueInvoices.length)} sind überfällig. Insgesamt sind ${formatMoney(openTotal)} netto offen.`
        : `Aktuell sind ${formatMoney(openTotal)} netto aus ${invoiceCountAfterFrom(openInvoices.length)} offen. Davon sind ${formatMoney(overdueTotal)} aus ${invoiceCountAfterFrom(overdueInvoices.length)} überfällig.`;

  return {
    type: "answer",
    topicId: "management.receivables",
    message,
    ...(intent.presentation === "list"
      ? { records: selected.slice(0, 20).map(toRecord) }
      : {}),
    structured: {
      title: "Offene Posten · Unternehmen",
      summary:
        intent.presentation === "list" && selected.length > 20
          ? `${selected.length} passende offene Rechnungen gefunden. Die 20 zuerst fälligen werden angezeigt.`
          : message,
      facts: [
        {
          label: "Insgesamt offen",
          value: formatMoney(openTotal),
          tone: openTotal > 0 ? "warning" : "positive",
        },
        {
          label: "Überfällig",
          value: formatMoney(overdueTotal),
          tone: overdueTotal > 0 ? "warning" : "positive",
        },
        {
          label: "Offene Rechnungen",
          value: String(openInvoices.length),
        },
        {
          label: "Überfällige Rechnungen",
          value: String(overdueInvoices.length),
          tone: overdueInvoices.length > 0 ? "warning" : "positive",
        },
      ],
      sections: [
        {
          title: "Prüfhinweise",
          items: [
            dueTodayInvoices.length === 1
              ? "Eine offene Rechnung ist heute fällig."
              : `${dueTodayInvoices.length} offene Rechnungen sind heute fällig.`,
            missingDueDateInvoices.length === 1
              ? "Eine offene Rechnung hat kein belastbares Fälligkeitsdatum."
              : `${missingDueDateInvoices.length} offene Rechnungen haben kein belastbares Fälligkeitsdatum.`,
            overdueWithoutReminder.length === 1
              ? "Eine überfällige Rechnung hat noch keine Mahnstufe."
              : `${overdueWithoutReminder.length} überfällige Rechnungen haben noch keine Mahnstufe.`,
            "Die Stichtagssicht berücksichtigt nur unbezahlte, finanziell aktive Rechnungen. Entwürfe, gelöschte und stornierte Belege sind ausgeschlossen; Beträge werden netto ausgewiesen.",
          ],
          tone:
            missingDueDateInvoices.length > 0 ||
            overdueWithoutReminder.length > 0
              ? "warning"
              : "neutral",
        },
      ],
    },
    deterministic: true,
  };
}
