import { prisma } from "@/lib/db/client";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import { extractJarvisProjectReferences } from "@/lib/jarvis/dialog-state";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type {
  JarvisReadResponse,
  JarvisRecordResult,
} from "@/lib/jarvis/read-model";
import type { JarvisAccessProfile } from "@/lib/jarvis/security";

export type OrganizationOfferAgingOffer = {
  id: string;
  projectId: string;
  projectNumber: string;
  projectTitle: string;
  offerNumber: string;
  status: string;
  customerName: string;
  netTotal: number;
  plannedExecutionMonth: string;
  wonAt: Date | null;
  lostAt: Date | null;
  createdAt: Date;
};

export type OrganizationOfferAgingSource = {
  load(input: { organizationId: string }): Promise<{
    offers: OrganizationOfferAgingOffer[];
    linkedInvoices: Array<{
      sourceOfferId: string;
      sourceOfferNumber: string;
      status: string;
    }>;
    sentDispatches: Array<{
      documentId: string;
      documentNumber: string;
      createdAt: Date;
    }>;
  }>;
};

type OrganizationOfferAgingIntent = {
  minimumAgeDays: number | null;
};

const liveSource: OrganizationOfferAgingSource = {
  async load({ organizationId }) {
    const [offers, linkedInvoices, sentDispatches] = await Promise.all([
      prisma.offer.findMany({
        where: { organizationId },
        select: {
          id: true,
          projectId: true,
          projectNumber: true,
          projectTitle: true,
          offerNumber: true,
          status: true,
          customerName: true,
          netTotal: true,
          plannedExecutionMonth: true,
          wonAt: true,
          lostAt: true,
          createdAt: true,
        },
      }),
      prisma.invoice.findMany({
        where: { organizationId },
        select: {
          sourceOfferId: true,
          sourceOfferNumber: true,
          status: true,
        },
      }),
      prisma.documentMailDispatch.findMany({
        where: {
          organizationId,
          documentKind: "offer",
          status: "sent",
        },
        select: {
          documentId: true,
          documentNumber: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return { offers, linkedInvoices, sentDispatches };
  },
};

function normalize(value: string) {
  return normalizeJarvisIntentText(value).replace(/\s+/g, " ").trim();
}

export function resolveJarvisOrganizationOfferAgingIntent(
  question: string
): OrganizationOfferAgingIntent | undefined {
  if (extractJarvisProjectReferences(question).length > 0) return undefined;
  const value = normalize(question);
  const asksForOpenOffers =
    /\boffen\w*\s+angebot\w*\b/.test(value) ||
    /\bangebot\w*\b.*\b(?:offen|unentschieden|nachfass)\w*\b/.test(value);
  if (!asksForOpenOffers) return undefined;
  const explicitAge = value.match(
    /\b(?:mehr als|alter als|seit)\s+(\d{1,3})\s+tag\w*\b/
  );
  const minimumAgeDays = explicitAge
    ? Math.min(365, Math.max(1, Number(explicitAge[1])))
    : /\b(?:alt|alter|lange|nachfass)\w*\b/.test(value)
      ? 14
      : null;
  return { minimumAgeDays };
}

function isDeletedStatus(status: string) {
  return normalize(status).includes("geloscht");
}

function isLostOffer(offer: OrganizationOfferAgingOffer) {
  const status = normalize(offer.status);
  return (
    Boolean(offer.lostAt) ||
    status === "verloren" ||
    status === "angebot verloren"
  );
}

function isDraft(offer: OrganizationOfferAgingOffer) {
  return normalize(offer.status) === "entwurf";
}

function isFinanciallyActiveInvoice(status: string) {
  const value = normalize(status);
  return (
    value !== "entwurf" &&
    !value.includes("geloscht") &&
    !value.includes("storniert") &&
    !value.includes("storno")
  );
}

function startOfUtcDay(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );
}

function ageInDays(issueDate: Date, now: Date) {
  return Math.max(
    0,
    Math.floor(
      (startOfUtcDay(now).getTime() - startOfUtcDay(issueDate).getTime()) /
        86_400_000
    )
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(value);
}

type OpenOffer = OrganizationOfferAgingOffer & {
  issueDate: Date;
  issueBasis: "sent" | "created";
  ageDays: number;
};

function toRecord(offer: OpenOffer): JarvisRecordResult {
  return {
    id: `offer-aging-${offer.id}`,
    kind: "offer",
    title: `${offer.offerNumber || "Angebot ohne Nummer"} · ${
      offer.customerName || offer.projectTitle || "Ohne Kunde"
    }`,
    subtitle: [offer.projectNumber, offer.projectTitle]
      .filter(Boolean)
      .join(" · "),
    summary: `${formatMoney(offer.netTotal)} netto · ${offer.ageDays} Tage offen · ${
      offer.issueBasis === "sent" ? "versendet" : "erstellt"
    } am ${formatDate(offer.issueDate)}${
      offer.plannedExecutionMonth
        ? ` · Ausführung ${offer.plannedExecutionMonth}`
        : ""
    }`,
    status: offer.status,
    target: {
      kind: "offer",
      id: offer.id,
      ...(offer.projectId ? { projectId: offer.projectId } : {}),
    },
  };
}

export async function resolveJarvisOrganizationOfferAgingRequest(input: {
  question: string;
  organizationId: string;
  accessProfile: JarvisAccessProfile;
  now?: Date;
  source?: OrganizationOfferAgingSource;
}): Promise<JarvisReadResponse | undefined> {
  const intent = resolveJarvisOrganizationOfferAgingIntent(input.question);
  if (!intent) return undefined;

  const decision = getJarvisActionDecision("offer.read", input.accessProfile);
  if (!decision.executable) {
    return {
      type: "refusal",
      topicId: "management.offer-aging",
      message:
        "Deine aktuelle WorkPilot-Rolle darf offene Angebote nicht über JARVIS auswerten.",
      deterministic: true,
    };
  }

  const now = input.now ?? new Date();
  const data = await (input.source ?? liveSource).load({
    organizationId: input.organizationId,
  });
  const activeLinkedInvoices = data.linkedInvoices.filter((invoice) =>
    isFinanciallyActiveInvoice(invoice.status)
  );
  const linkedOfferIds = new Set(
    activeLinkedInvoices.map((invoice) => invoice.sourceOfferId).filter(Boolean)
  );
  const linkedOfferNumbers = new Set(
    activeLinkedInvoices
      .map((invoice) => invoice.sourceOfferNumber)
      .filter(Boolean)
  );
  const firstDispatchByOffer = new Map<string, Date>();
  for (const dispatch of data.sentDispatches) {
    for (const key of [dispatch.documentId, dispatch.documentNumber]) {
      if (!key || firstDispatchByOffer.has(key)) continue;
      firstDispatchByOffer.set(key, dispatch.createdAt);
    }
  }

  const openOffers: OpenOffer[] = data.offers
    .filter(
      (offer) =>
        !isDraft(offer) &&
        !isDeletedStatus(offer.status) &&
        !isLostOffer(offer) &&
        !offer.wonAt &&
        !linkedOfferIds.has(offer.id) &&
        !linkedOfferNumbers.has(offer.offerNumber)
    )
    .map((offer) => {
      const sentAt =
        firstDispatchByOffer.get(offer.id) ??
        firstDispatchByOffer.get(offer.offerNumber);
      const issueDate = sentAt ?? offer.createdAt;
      return {
        ...offer,
        issueDate,
        issueBasis: sentAt ? ("sent" as const) : ("created" as const),
        ageDays: ageInDays(issueDate, now),
      };
    })
    .sort(
      (left, right) =>
        right.ageDays - left.ageDays ||
        right.netTotal - left.netTotal ||
        left.offerNumber.localeCompare(right.offerNumber)
    );
  const selected =
    intent.minimumAgeDays === null
      ? openOffers
      : openOffers.filter(
          (offer) => offer.ageDays >= intent.minimumAgeDays!
        );
  const openValue = openOffers.reduce(
    (sum, offer) => sum + Number(offer.netTotal || 0),
    0
  );
  const selectedValue = selected.reduce(
    (sum, offer) => sum + Number(offer.netTotal || 0),
    0
  );
  const customerCount = new Set(
    selected.map((offer) => normalize(offer.customerName)).filter(Boolean)
  ).size;
  const unsentBasisCount = selected.filter(
    (offer) => offer.issueBasis === "created"
  ).length;
  const scopeLabel =
    intent.minimumAgeDays === null
      ? "offene Angebote"
      : `seit mindestens ${intent.minimumAgeDays} Tagen offene Angebote`;
  const selectedDescription =
    intent.minimumAgeDays === null
      ? selected.length === 1
        ? "ein offenes Angebot"
        : `${selected.length} offene Angebote`
      : selected.length === 1
        ? `ein seit mindestens ${intent.minimumAgeDays} Tagen offenes Angebot`
        : `${selected.length} seit mindestens ${intent.minimumAgeDays} Tagen offene Angebote`;
  const customerDescription =
    customerCount === 1 ? "einem Kunden" : `${customerCount} Kunden`;
  const message =
    selected.length === 0
      ? `Aktuell wurden keine ${scopeLabel} gefunden.`
      : `Aktuell gibt es ${selectedDescription} von ${customerDescription} mit zusammen ${formatMoney(selectedValue)} netto. Insgesamt sind ${openOffers.length} Angebote mit ${formatMoney(openValue)} netto offen.`;

  return {
    type: "answer",
    topicId: "management.offer-aging",
    message,
    records: selected.slice(0, 20).map(toRecord),
    structured: {
      title: "Offene Angebote · Nachfassbestand",
      summary:
        selected.length > 20
          ? `${selected.length} passende Angebote gefunden. Die 20 ältesten werden angezeigt.`
          : message,
      facts: [
        {
          label: "Passende Angebote",
          value: String(selected.length),
          tone: selected.length > 0 ? "warning" : "positive",
        },
        {
          label: "Passender Nettowert",
          value: formatMoney(selectedValue),
        },
        {
          label: "Betroffene Kunden",
          value: String(customerCount),
        },
        {
          label: "Insgesamt offen",
          value: `${openOffers.length} · ${formatMoney(openValue)}`,
        },
      ],
      sections: [
        {
          title: "Datenbasis",
          items: [
            "Offen bedeutet: kein Entwurf, nicht gelöscht, nicht verloren und weder als gewonnen markiert noch bereits einer Rechnung zugeordnet.",
            intent.minimumAgeDays === null
              ? "Die Liste ist nicht auf einen Zeitraum begrenzt."
              : `Die Altersgrenze beträgt mindestens ${intent.minimumAgeDays} Tage.`,
            unsentBasisCount === 0
              ? "Das Alter aller Treffer basiert auf dem ersten dokumentierten E-Mail-Versand."
              : `Bei ${unsentBasisCount} Treffer${unsentBasisCount === 1 ? "" : "n"} fehlt ein dokumentierter E-Mail-Versand; dort wird das Erstellungsdatum transparent als Altersbasis verwendet.`,
            "JARVIS ändert keinen Angebotsstatus, legt keine Aufgabe an und versendet keine Nachricht.",
          ],
          tone: unsentBasisCount > 0 ? "warning" : "neutral",
        },
      ],
    },
    deterministic: true,
  };
}
