export type OnlineRequestConversionSource = {
  referenceNumber: string;
  requestType: string;
  tradeName: string;
  recommendationNames: string[];
  desiredDate: string | null;
  desiredTimeWindow: string | null;
  callbackTimeWindow: string | null;
  urgency: string | null;
  street: string;
  postalCode: string;
  city: string;
  objectHint: string | null;
  description: string;
  company: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  preferredContact: string;
};

export type OnlineRequestConversionTask = {
  kind: "callback" | "desired_date" | "follow_up";
  title: string;
  description: string;
  deadline: Date;
  priority: "NORMAL" | "HOCH" | "KRITISCH";
};

const requestTypeLabels: Record<string, string> = {
  offer: "Angebotsanfrage",
  callback: "Rückruf & Beratung",
  execution: "Durchführungsanfrage",
  issue: "Mangel oder Problem",
  general: "Allgemeine Anfrage",
};

const contactLabels: Record<string, string> = {
  email: "E-Mail",
  phone: "Telefon",
  either: "E-Mail oder Telefon",
};

function compact(value: string | null | undefined) {
  return (value ?? "").trim();
}

function oneLine(value: string | null | undefined) {
  return compact(value).replace(/\s+/g, " ");
}

export function getOnlineRequestCustomerName(
  request: Pick<
    OnlineRequestConversionSource,
    "company" | "firstName" | "lastName"
  >
) {
  return (
    compact(request.company) ||
    [compact(request.firstName), compact(request.lastName)]
      .filter(Boolean)
      .join(" ") ||
    "Kunde aus Online-Anfrage"
  );
}

export function createOnlineRequestProjectNumber(
  projectPrefix: string,
  sequence: number
) {
  const normalizedPrefix = oneLine(projectPrefix)
    .toLocaleUpperCase("de-DE")
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 12);
  const normalizedSequence =
    Number.isSafeInteger(sequence) && sequence > 0 ? sequence : 1;
  return `${normalizedPrefix || "SON"}-${normalizedSequence}`;
}

export function createOnlineRequestProjectTitle(
  projectNumber: string,
  tradeName: string
) {
  return `Projekt ${oneLine(projectNumber)} - ${
    oneLine(tradeName) || "Sonstige Leistung"
  }`.slice(0, 180);
}

export function buildOnlineRequestLogbookBody(
  request: OnlineRequestConversionSource
) {
  const rows = [
    ["Referenz", request.referenceNumber],
    [
      "Anliegenart",
      requestTypeLabels[request.requestType] || request.requestType,
    ],
    ["Gewerk", request.tradeName],
    [
      "Zusatzinteressen",
      request.recommendationNames.length
        ? request.recommendationNames.join(", ")
        : "Keine ausgewählt",
    ],
    ["Wunschdatum", request.desiredDate || "Nicht angegeben"],
    [
      "Wunschzeit",
      getOnlineRequestTimeWindowLabel(request.desiredTimeWindow) ||
        "Nicht angegeben",
    ],
    [
      "Rückrufzeit",
      getOnlineRequestTimeWindowLabel(request.callbackTimeWindow) ||
        "Nicht angegeben",
    ],
    [
      "Dringlichkeit",
      getOnlineRequestUrgencyLabel(request.urgency) || "Normal",
    ],
    [
      "Einsatzort",
      [request.street, request.postalCode, request.city]
        .map(oneLine)
        .filter(Boolean)
        .join(", "),
    ],
    ["Objekthinweis", request.objectHint || "Nicht angegeben"],
    ["Kontakt", getOnlineRequestCustomerName(request)],
    [
      "Erreichbarkeit",
      [
        request.email,
        request.phone,
        contactLabels[request.preferredContact] || request.preferredContact,
      ]
        .map(oneLine)
        .filter(Boolean)
        .join(" · "),
    ],
  ];

  return [
    "Originalanfrage aus dem OK-immocare-Onlineformular",
    "",
    ...rows.map(([label, value]) => `${label}: ${oneLine(value) || "–"}`),
    "",
    "Beschreibung:",
    compact(request.description),
  ].join("\n");
}

function fallbackDeadline(now: Date, urgent: boolean) {
  const hours = urgent ? 4 : 24;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

function desiredDateDeadline(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const deadline = new Date(`${value}T10:00:00.000Z`);
  return Number.isFinite(deadline.getTime()) ? deadline : null;
}

function earliestDeadline(...values: Date[]) {
  return new Date(Math.min(...values.map((value) => value.getTime())));
}

function baseTaskDescription(request: OnlineRequestConversionSource) {
  return [
    `Online-Anfrage ${request.referenceNumber}`,
    `${getOnlineRequestCustomerName(request)} · ${request.tradeName}`,
    [request.street, request.postalCode, request.city]
      .map(oneLine)
      .filter(Boolean)
      .join(", "),
    request.description,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildOnlineRequestConversionTasks(
  request: OnlineRequestConversionSource,
  now = new Date()
): OnlineRequestConversionTask[] {
  const tasks: OnlineRequestConversionTask[] = [];
  const urgent =
    request.requestType === "issue" &&
    !["", "normal"].includes(compact(request.urgency).toLowerCase());
  const priority = urgent ? "KRITISCH" : request.requestType === "issue" ? "HOCH" : "NORMAL";
  const description = baseTaskDescription(request);

  if (request.requestType === "callback" || compact(request.callbackTimeWindow)) {
    tasks.push({
      kind: "callback",
      title: `Rückruf zu ${request.referenceNumber}`,
      description: [
        description,
        `Gewünschte Rückrufzeit: ${
          getOnlineRequestTimeWindowLabel(request.callbackTimeWindow) ||
          "Zeitlich flexibel"
        }`,
      ].join("\n\n"),
      deadline: fallbackDeadline(now, urgent),
      priority,
    });
  }

  if (compact(request.desiredDate)) {
    tasks.push({
      kind: "desired_date",
      title: `Wunschdatum prüfen · ${request.referenceNumber}`,
      description: [
        description,
        `Unverbindlicher Kundenwunsch: ${request.desiredDate}${
          compact(request.desiredTimeWindow)
            ? ` · ${getOnlineRequestTimeWindowLabel(
                request.desiredTimeWindow
              )}`
            : ""
        }`,
        "Das Wunschdatum ist noch kein bestätigter Termin.",
      ].join("\n\n"),
      deadline: earliestDeadline(
        fallbackDeadline(now, urgent),
        desiredDateDeadline(compact(request.desiredDate)) ??
          fallbackDeadline(now, urgent)
      ),
      priority,
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      kind: "follow_up",
      title: `Online-Anfrage beantworten · ${request.referenceNumber}`,
      description,
      deadline: fallbackDeadline(now, urgent),
      priority,
    });
  }

  return tasks;
}
import {
  getOnlineRequestTimeWindowLabel,
  getOnlineRequestUrgencyLabel,
} from "./form-config";
