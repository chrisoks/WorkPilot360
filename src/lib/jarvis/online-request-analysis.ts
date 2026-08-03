import { prisma } from "@/lib/db/client";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type { JarvisReadResponse } from "@/lib/jarvis/read-model";
import type { JarvisAccessProfile } from "@/lib/jarvis/security";
import { canConvertOnlineRequests } from "@/lib/permissions";
import { buildOnlineRequestConversionTasks } from "@/lib/online-requests/conversion";
import {
  getOnlineRequestTimeWindowLabel,
  getOnlineRequestUrgencyLabel,
} from "@/lib/online-requests/form-config";

const ACTIVE_STATUSES = ["new", "in_review", "waiting_customer"] as const;

type OnlineRequestStatus =
  | "new"
  | "in_review"
  | "waiting_customer"
  | "converted"
  | "closed";

export type JarvisOnlineRequestRow = {
  id: string;
  referenceNumber: string;
  status: string;
  requestType: string;
  tradeName: string;
  recommendationNames: unknown;
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
  assignedUserId: string | null;
  customerDecision: string;
  matchedContactId: string | null;
  convertedProjectId: string | null;
  createdAt: Date;
  updatedAt: Date;
  photoCount: number;
  auditEventCount: number;
};

export type JarvisOnlineRequestSource = {
  load(input: {
    organizationId: string;
    referenceNumber: string | null;
    statuses: OnlineRequestStatus[] | null;
    customerDecisions: string[] | null;
    oldestFirst: boolean;
  }): Promise<{
    statusCounts: Record<string, number>;
    requests: JarvisOnlineRequestRow[];
    assigneeNames: Record<string, string>;
    assigneeDetails: Record<
      string,
      { name: string; isActive: boolean; canConvert: boolean }
    >;
    matchedContacts: Record<
      string,
      { customerNumber: string; name: string }
    >;
    convertedProjects: Record<
      string,
      { projectNumber: string; title: string }
    >;
  }>;
};

export type JarvisOnlineRequestIntent = {
  referenceNumber: string | null;
  statuses: OnlineRequestStatus[] | null;
  presentation: "summary" | "list" | "detail";
  oldestFirst: boolean;
  readinessRequested: boolean;
  customerDecisions: string[] | null;
};

const liveSource: JarvisOnlineRequestSource = {
  async load({ organizationId, referenceNumber, statuses, customerDecisions, oldestFirst }) {
    const [groupedCounts, requests] = await Promise.all([
      prisma.onlineRequest.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: { _all: true },
      }),
      prisma.onlineRequest.findMany({
        where: {
          organizationId,
          ...(referenceNumber ? { referenceNumber } : {}),
          ...(statuses ? { status: { in: statuses } } : {}),
          ...(customerDecisions ? { customerDecision: { in: customerDecisions } } : {}),
        },
        orderBy: { createdAt: oldestFirst ? "asc" : "desc" },
        take: referenceNumber || oldestFirst ? 1 : 50,
        select: {
          id: true,
          referenceNumber: true,
          status: true,
          requestType: true,
          tradeName: true,
          recommendationNames: true,
          desiredDate: true,
          desiredTimeWindow: true,
          callbackTimeWindow: true,
          urgency: true,
          street: true,
          postalCode: true,
          city: true,
          objectHint: true,
          description: true,
          company: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          preferredContact: true,
          assignedUserId: true,
          customerDecision: true,
          matchedContactId: true,
          convertedProjectId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              photos: true,
              auditEvents: true,
            },
          },
        },
      }),
    ]);
    const assigneeIds = Array.from(
      new Set(
        requests
          .map((request) => request.assignedUserId)
          .filter((id): id is string => Boolean(id))
      )
    );
    const convertedProjectIds = Array.from(
      new Set(
        requests
          .map((request) => request.convertedProjectId)
          .filter((id): id is string => Boolean(id))
      )
    );
    const matchedContactIds = Array.from(
      new Set(
        requests
          .map((request) => request.matchedContactId)
          .filter((id): id is string => Boolean(id))
      )
    );
    const [assignees, matchedContacts, convertedProjects] = await Promise.all([
      assigneeIds.length === 0
        ? []
        : prisma.user.findMany({
            where: { organizationId, id: { in: assigneeIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              isActive: true,
              salesRoleEnabled: true,
            },
          }),
      matchedContactIds.length === 0
        ? []
        : prisma.contact.findMany({
            where: { organizationId, id: { in: matchedContactIds } },
            select: {
              id: true,
              customerNumber: true,
              companyName: true,
              firstName: true,
              lastName: true,
            },
          }),
      convertedProjectIds.length === 0
        ? []
        : prisma.workPilotProject.findMany({
            where: {
              organizationId,
              id: { in: convertedProjectIds },
            },
            select: {
              id: true,
              projectNumber: true,
              title: true,
            },
          }),
    ]);

    return {
      statusCounts: Object.fromEntries(
        groupedCounts.map((entry) => [entry.status, entry._count._all])
      ),
      requests: requests.map(({ _count, ...request }) => ({
        ...request,
        photoCount: _count.photos,
        auditEventCount: _count.auditEvents,
      })),
      assigneeNames: Object.fromEntries(
        assignees.map((user) => [
          user.id,
          [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            user.email ||
            "Zugewiesene Person",
        ])
      ),
      assigneeDetails: Object.fromEntries(
        assignees.map((user) => {
          const name =
            [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            user.email ||
            "Zugewiesene Person";
          return [
            user.id,
            {
              name,
              isActive: user.isActive,
              canConvert: canConvertOnlineRequests(user),
            },
          ];
        })
      ),
      matchedContacts: Object.fromEntries(
        matchedContacts.map((contact) => [
          contact.id,
          {
            customerNumber: contact.customerNumber,
            name:
              contact.companyName?.trim() ||
              [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
              contact.customerNumber,
          },
        ])
      ),
      convertedProjects: Object.fromEntries(
        convertedProjects.map((project) => [
          project.id,
          {
            projectNumber: project.projectNumber,
            title: project.title,
          },
        ])
      ),
    };
  },
};

function normalize(value: string) {
  return normalizeJarvisIntentText(value)
    .replace(/[\/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractReference(question: string) {
  return (
    question.match(/\bOKI-\d{8}-[A-F0-9]{6}\b/i)?.[0]?.toUpperCase() ?? null
  );
}

export function resolveJarvisOnlineRequestIntent(
  question: string
): JarvisOnlineRequestIntent | undefined {
  const value = normalize(question);
  const referenceNumber = extractReference(question);
  const mentionsOnlineRequest =
    /\bonline\s*anfrag\w*\b|\bformularanfrag\w*\b|\banfragenposteingang\b/.test(
      value
    ) || /\banfrag\w*\b.*\bkundenpruf\w*\b/.test(value);
  if (!mentionsOnlineRequest && !referenceNumber) return undefined;

  if (
    !referenceNumber &&
    (/\bwo\b.*\b(?:find|offn|seh)\w*\b/.test(value) ||
      /\bwie\b.*\b(?:umwandel|konvertier|projekt anleg)\w*\b/.test(value) ||
      /\bwie funktioniert\b/.test(value) ||
      /\b(?:anliegenart|anfrageart|formularfeld|foto|bild|spam|sicherheit|schutz|proof of work|turnstile|gewerk|projektnummer|projekttitel|projektname|praefix|oki referenz|sonstige|andere leistung)\w*\b/.test(
        value
      ))
  ) {
    return undefined;
  }

  const asksForLiveData =
    Boolean(referenceNumber) ||
    /\b(?:wie viele|anzahl|bestand|uberblick|ubersicht|zeig|list|welch|alteste|neueste|offen|aktiv|unbearbeitet|wartet|warten|status|fass|zusammen|details|wer bearbeitet|zugewiesen)\w*\b/.test(
      value
    );
  if (!asksForLiveData) return undefined;

  let statuses: OnlineRequestStatus[] | null = null;
  if (/\b(?:wartet|warten)\b.*\b(?:kunde|ruckmeldung)\b/.test(value)) {
    statuses = ["waiting_customer"];
  } else if (/\b(?:in bearbeitung|in prufung|gepruft)\b/.test(value)) {
    statuses = ["in_review"];
  } else if (/\b(?:umgewandelt|konvertiert)\b/.test(value)) {
    statuses = ["converted"];
  } else if (/\b(?:abgeschlossen|geschlossen)\b/.test(value)) {
    statuses = ["closed"];
  } else if (/\b(?:offen|aktiv|unbearbeitet)\w*\b/.test(value)) {
    statuses = [...ACTIVE_STATUSES];
  } else if (/\bneu\w*\b/.test(value)) {
    statuses = ["new"];
  }

  const oldestFirst = /\baltest\w*\b/.test(value);
  const customerDecisions = /\bkundenpruf\w*\b/.test(value)
    ? ["unreviewed", "unresolved"]
    : null;
  const readinessRequested =
    Boolean(referenceNumber) &&
    /\b(?:bereit|ubernehm|umwandel|konvertier|freigab|blockier|fehlt|voraussetzung)\w*\b/.test(
      value
    );
  const presentation = referenceNumber
    ? "detail"
    : /\b(?:wie viele|anzahl|bestand|uberblick|ubersicht)\b/.test(value)
      ? "summary"
      : "list";

  return {
    referenceNumber,
    statuses,
    presentation,
    oldestFirst,
    readinessRequested,
    customerDecisions,
  };
}

const STATUS_LABELS: Record<string, string> = {
  new: "Neu",
  in_review: "In Bearbeitung",
  waiting_customer: "Wartet auf Rückmeldung",
  converted: "In Projekt umgewandelt",
  closed: "Abgeschlossen",
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  offer: "Angebot",
  callback: "Rückruf & Beratung",
  execution: "Durchführung",
  issue: "Mangel oder Problem",
  general: "Allgemeine Anfrage",
};

const CUSTOMER_DECISION_LABELS: Record<string, string> = {
  unreviewed: "Noch nicht geprüft",
  existing: "Vorhandener Kunde",
  new: "Neuer Kunde",
  unresolved: "Noch nicht eindeutig",
};

function count(statusCounts: Record<string, number>, status: string) {
  return Number(statusCounts[status] ?? 0);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeZone: "Europe/Berlin",
  }).format(date);
}

function truncate(value: string, maximum = 800) {
  const clean = value.trim();
  return clean.length <= maximum
    ? clean
    : `${clean.slice(0, maximum - 1).trimEnd()}…`;
}

function customerName(request: JarvisOnlineRequestRow) {
  return (
    request.company?.trim() ||
    [request.firstName, request.lastName].filter(Boolean).join(" ") ||
    "Kontakt nicht benannt"
  );
}

function listLabel(
  request: JarvisOnlineRequestRow,
  assigneeNames: Record<string, string>
) {
  const assignee = request.assignedUserId
    ? assigneeNames[request.assignedUserId] || "Zugewiesen"
    : "Nicht zugewiesen";
  return `${request.referenceNumber} · ${
    STATUS_LABELS[request.status] || request.status
  } · ${REQUEST_TYPE_LABELS[request.requestType] || request.requestType} · ${
    request.tradeName
  } · ${customerName(request)} · ${assignee} · Eingang ${formatDateTime(
    request.createdAt
  )}`;
}

function detailResponse(
  request: JarvisOnlineRequestRow,
  assigneeNames: Record<string, string>,
  assigneeDetails: Record<
    string,
    { name: string; isActive: boolean; canConvert: boolean }
  >,
  matchedContacts: Record<
    string,
    { customerNumber: string; name: string }
  >,
  convertedProjects: Record<
    string,
    { projectNumber: string; title: string }
  >,
  readinessRequested: boolean
): JarvisReadResponse {
  const assignee = request.assignedUserId
    ? assigneeNames[request.assignedUserId] || "Zugewiesene Person"
    : "Nicht zugewiesen";
  const recommendations = Array.isArray(request.recommendationNames)
    ? request.recommendationNames.filter(
        (entry): entry is string => typeof entry === "string"
      )
    : [];
  const convertedProject = request.convertedProjectId
    ? convertedProjects[request.convertedProjectId]
    : undefined;
  const assigneeDetail = request.assignedUserId
    ? assigneeDetails[request.assignedUserId]
    : undefined;
  const matchedContact = request.matchedContactId
    ? matchedContacts[request.matchedContactId]
    : undefined;
  const conversionTasks = buildOnlineRequestConversionTasks({
    referenceNumber: request.referenceNumber,
    requestType: request.requestType,
    tradeName: request.tradeName,
    recommendationNames: recommendations,
    desiredDate: request.desiredDate,
    desiredTimeWindow: request.desiredTimeWindow,
    callbackTimeWindow: request.callbackTimeWindow,
    urgency: request.urgency,
    street: request.street,
    postalCode: request.postalCode,
    city: request.city,
    objectHint: request.objectHint,
    description: request.description,
    company: request.company,
    firstName: request.firstName,
    lastName: request.lastName,
    email: request.email,
    phone: request.phone,
    preferredContact: request.preferredContact,
  });
  const responsibilityPreview = assigneeDetail?.isActive && assigneeDetail.canConvert
    ? assigneeDetail.name
    : "Ausführende berechtigte Person (automatischer Fallback)";
  const conversionTaskPreview = conversionTasks.length
    ? conversionTasks.map((task) => task.title).join(" · ")
    : "Keine verknüpfte Folgeaufgabe aus den vorliegenden Termin- und Rückrufangaben";
  const readinessBlockers: string[] = [];
  if (!request.convertedProjectId) {
    if (request.status === "closed") {
      readinessBlockers.push(
        "Die Anfrage ist abgeschlossen und muss vor einer Übernahme bewusst wieder geöffnet werden."
      );
    }
    if (
      request.customerDecision !== "new" &&
      request.customerDecision !== "existing"
    ) {
      readinessBlockers.push(
        "Die Kundenprüfung muss eindeutig zwischen vorhandenem und neuem Kunden entscheiden."
      );
    } else if (request.customerDecision === "existing") {
      if (!request.matchedContactId) {
        readinessBlockers.push(
          "Für den vorhandenen Kunden ist noch kein Kontakt ausgewählt."
        );
      } else if (!matchedContact) {
        readinessBlockers.push(
          "Der ausgewählte Bestandskontakt ist in dieser Organisation nicht mehr gültig."
        );
      }
    }
    if (!request.tradeName.trim()) {
      readinessBlockers.push("Das Gewerk der Anfrage fehlt.");
    }
  } else if (!convertedProject) {
    readinessBlockers.push(
      "Der Umwandlungsnachweis verweist auf kein auflösbares Projekt."
    );
  }
  const conversionReady =
    !request.convertedProjectId && readinessBlockers.length === 0;
  const readinessLabel = request.convertedProjectId
    ? convertedProject
      ? "Bereits umgewandelt"
      : "Datenprüfung nötig"
    : conversionReady
      ? "Bereit"
      : "Nicht bereit";
  const contact = [
    request.email,
    request.phone,
    `bevorzugt: ${
      request.preferredContact === "phone"
        ? "Telefon"
        : request.preferredContact === "email"
          ? "E-Mail"
          : "E-Mail oder Telefon"
    }`,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    type: "answer",
    topicId: "online-requests.detail",
    message: readinessRequested
      ? conversionReady
        ? `${request.referenceNumber} ist für die kontrollierte Übernahme bereit. Kundenentscheidung, Bestandskontakt beziehungsweise Neuanlage, Verantwortung und Gewerk sind eindeutig.`
        : request.convertedProjectId && convertedProject
          ? `${request.referenceNumber} wurde bereits kontrolliert in ${convertedProject.projectNumber} umgewandelt.`
          : `${request.referenceNumber} ist noch nicht übernahmebereit. ${readinessBlockers.length} ${readinessBlockers.length === 1 ? "Voraussetzung fehlt" : "Voraussetzungen fehlen"}.`
      : `${request.referenceNumber} ist ${
          STATUS_LABELS[request.status] || request.status
        }. Die Anfrage betrifft ${request.tradeName} und stammt von ${customerName(
          request
        )}.`,
    navigation: {
      label: "Online-Anfragen öffnen",
      tab: "onlineRequests",
    },
    structured: {
      title: readinessRequested
        ? `Online-Anfrage · Übernahmeprüfung ${request.referenceNumber}`
        : `Online-Anfrage · ${request.referenceNumber}`,
      subtitle: `${customerName(request)} · ${request.tradeName}`,
      facts: readinessRequested
        ? [
            {
              label: "Übernahme",
              value: readinessLabel,
              tone: conversionReady
                ? ("positive" as const)
                : request.convertedProjectId && convertedProject
                  ? ("neutral" as const)
                  : ("warning" as const),
            },
            {
              label: "Kundenweg",
              value:
                request.customerDecision === "new"
                  ? "Neuen Kontakt anlegen"
                  : matchedContact
                    ? `${matchedContact.customerNumber} · ${matchedContact.name}`
                    : CUSTOMER_DECISION_LABELS[request.customerDecision] ||
                      request.customerDecision,
            },
            { label: "Verantwortung", value: responsibilityPreview },
            { label: "Folgeaufgaben", value: String(conversionTasks.length) },
            { label: "Fotos", value: String(request.photoCount) },
            {
              label: "Status",
              value: STATUS_LABELS[request.status] || request.status,
            },
          ]
        : [
        {
          label: "Status",
          value: STATUS_LABELS[request.status] || request.status,
          tone:
            request.status === "new" || request.status === "waiting_customer"
              ? "warning"
              : request.status === "converted" || request.status === "closed"
                ? "positive"
                : "neutral",
        },
        {
          label: "Anliegen",
          value: REQUEST_TYPE_LABELS[request.requestType] || request.requestType,
        },
        { label: "Verantwortung", value: assignee },
        {
          label: "Kundenprüfung",
          value:
            CUSTOMER_DECISION_LABELS[request.customerDecision] ||
            request.customerDecision,
        },
        { label: "Eingang", value: formatDateTime(request.createdAt) },
        { label: "Fotos", value: String(request.photoCount) },
          ],
      sections: [
        ...(readinessRequested
          ? [
              {
                title: conversionReady
                  ? "Übernahmebereit"
                  : request.convertedProjectId && convertedProject
                    ? "Bereits abgeschlossen"
                    : `Fehlende Voraussetzungen (${readinessBlockers.length})`,
                items: conversionReady
                  ? [
                      request.customerDecision === "new"
                        ? "Die geprüfte Entscheidung legt einen neuen Kontakt aus den Formulardaten an."
                        : `Der geprüfte Bestandskontakt ${matchedContact?.customerNumber} · ${matchedContact?.name} wird verwendet.`,
                      `Verantwortlich: ${responsibilityPreview}.`,
                      "Es wird immer ein neues Projekt unter OK immocare → Lead / Klärung angelegt; niemals ein Bestandsprojekt verwendet.",
                    ]
                  : request.convertedProjectId && convertedProject
                    ? [
                        `Zielprojekt: ${convertedProject.projectNumber} · ${convertedProject.title}.`,
                        "Eine erneute Umwandlung würde kein zweites Projekt erzeugen.",
                      ]
                    : readinessBlockers,
                tone: conversionReady
                  ? ("positive" as const)
                  : request.convertedProjectId && convertedProject
                    ? ("neutral" as const)
                    : ("warning" as const),
              },
              {
                title: "Folgen einer bewussten Umwandlung",
                items: [
                  `Projekt: neues OK-immocare-Projekt unter Lead / Klärung mit Gewerk „${request.tradeName}“ und globaler Projektnummer; die OKI-Referenz bleibt Quellenreferenz.`,
                  request.customerDecision === "new"
                    ? "Kunde: neuer Kontakt aus den geprüften Formulardaten."
                    : matchedContact
                      ? `Kunde: vorhandener Kontakt ${matchedContact.customerNumber} · ${matchedContact.name}.`
                      : "Kunde: noch nicht eindeutig festgelegt.",
                  `Logbuch: Originalanfrage und ${request.photoCount} ${request.photoCount === 1 ? "Anfragebild" : "Anfragebilder"} in der geschützten Bildgruppe „Anfragebilder“.`,
                  `Aufgaben: ${conversionTaskPreview}. Ein Wunschdatum bleibt unverbindlich und wird nicht als bestätigter Termin gespeichert.`,
                  "Audit, Timeline und Benachrichtigungen werden innerhalb des bestehenden kontrollierten Umwandlungsablaufs erzeugt.",
                ],
                tone: "neutral" as const,
              },
            ]
          : []),
        {
          title: "Anfrage",
          items: [
            truncate(request.description),
            `Objekt: ${request.street}, ${request.postalCode} ${request.city}${
              request.objectHint ? ` · ${request.objectHint}` : ""
            }`,
            contact || "Keine freigegebene Kontaktmöglichkeit hinterlegt",
            ...(request.desiredDate
              ? [
                  `Wunschdatum: ${formatDate(request.desiredDate)}${
                    request.desiredTimeWindow
                      ? ` · ${
                          getOnlineRequestTimeWindowLabel(
                            request.desiredTimeWindow
                          ) || request.desiredTimeWindow
                        }`
                      : ""
                  }`,
                ]
              : []),
            ...(request.callbackTimeWindow
              ? [
                  `Rückrufwunsch: ${
                    getOnlineRequestTimeWindowLabel(
                      request.callbackTimeWindow
                    ) || request.callbackTimeWindow
                  }`,
                ]
              : []),
            ...(request.urgency
              ? [
                  `Dringlichkeit: ${
                    getOnlineRequestUrgencyLabel(request.urgency) ||
                    request.urgency
                  }`,
                ]
              : []),
            ...(recommendations.length > 0
              ? [`Zusatzinteressen: ${recommendations.join(", ")}`]
              : []),
          ],
          tone: "neutral",
        },
        {
          title: "Sichere Weiterverarbeitung",
          items: [
            request.convertedProjectId
              ? convertedProject
                ? `Die Anfrage wurde kontrolliert in das neue Projekt ${convertedProject.projectNumber} („${convertedProject.title}“) umgewandelt.`
                : "Die Anfrage wurde bereits kontrolliert in ein neues Projekt umgewandelt."
              : "Vor einer Umwandlung müssen Kundenentscheidung und Verantwortung eindeutig geprüft werden.",
            "Eine Online-Anfrage wird niemals automatisch einem bestehenden Projekt zugeordnet.",
            "Die OKI-Referenz bleibt Anfrage-, Quellen-, Audit- und Logbuchreferenz; sie wird nicht als Projektnummer verwendet.",
            "Bei bewusster Umwandlung entsteht unter OK immocare → Lead / Klärung eine neue globale Projektnummer mit dem Präfix des gewählten Gewerks. Für „Sonstige / Andere Leistung“ gilt das neutrale Präfix SON.",
            "Originalbeschreibung, Anfragebilder und Termin- oder Rückrufwunsch werden strukturiert übernommen.",
            `${request.auditEventCount} Audit-Ereignisse dokumentieren den bisherigen Ablauf.`,
          ],
          tone:
            request.customerDecision === "unreviewed" ||
            request.customerDecision === "unresolved" ||
            !request.assignedUserId
              ? "warning"
              : "neutral",
        },
      ],
    },
    deterministic: true,
  };
}

export async function resolveJarvisOnlineRequestAnalysis(input: {
  question: string;
  organizationId: string;
  accessProfile: JarvisAccessProfile;
  source?: JarvisOnlineRequestSource;
}): Promise<JarvisReadResponse | undefined> {
  const intent = resolveJarvisOnlineRequestIntent(input.question);
  if (!intent) return undefined;

  const decision = getJarvisActionDecision(
    "online-request.read",
    input.accessProfile
  );
  if (!decision.executable) {
    return {
      type: "refusal",
      topicId: "online-requests.refused",
      message:
        "Deine aktuelle WorkPilot-Rolle darf Online-Anfragen nicht über JARVIS einsehen.",
      deterministic: true,
    };
  }

  const data = await (input.source ?? liveSource).load({
    organizationId: input.organizationId,
    referenceNumber: intent.referenceNumber,
    statuses: intent.statuses,
    customerDecisions: intent.customerDecisions,
    oldestFirst: intent.oldestFirst,
  });
  if (intent.referenceNumber) {
    const request = data.requests[0];
    if (!request) {
      return {
        type: "answer",
        topicId: "online-requests.detail",
        message: `Die Online-Anfrage ${intent.referenceNumber} wurde in deiner Organisation nicht gefunden.`,
        navigation: {
          label: "Online-Anfragen öffnen",
          tab: "onlineRequests",
        },
        deterministic: true,
      };
    }
    return detailResponse(
      request,
      data.assigneeNames,
      data.assigneeDetails,
      data.matchedContacts,
      data.convertedProjects,
      intent.readinessRequested
    );
  }

  const newCount = count(data.statusCounts, "new");
  const inReviewCount = count(data.statusCounts, "in_review");
  const waitingCount = count(data.statusCounts, "waiting_customer");
  const convertedCount = count(data.statusCounts, "converted");
  const closedCount = count(data.statusCounts, "closed");
  const activeCount = newCount + inReviewCount + waitingCount;
  const totalCount = activeCount + convertedCount + closedCount;
  const matchingCount =
    intent.statuses === null
      ? newCount + inReviewCount + waitingCount + convertedCount + closedCount
      : intent.statuses.reduce(
          (sum, status) => sum + count(data.statusCounts, status),
          0
        );
  const list = data.requests.slice(0, intent.oldestFirst ? 1 : 20);
  const message =
    intent.statuses === null
      ? totalCount === 0
        ? "Aktuell gibt es keine Online-Anfrage."
        : `Insgesamt gibt es ${totalCount} Online-Anfragen. Davon sind ${activeCount} aktiv: ${newCount} neu, ${inReviewCount} in Bearbeitung und ${waitingCount} warten auf Rückmeldung.`
      : intent.statuses.length === 1
        ? `Aktuell gibt es ${matchingCount} Online-${
            matchingCount === 1 ? "Anfrage" : "Anfragen"
          } mit dem Status „${
            STATUS_LABELS[intent.statuses[0]] || intent.statuses[0]
          }“.`
        : activeCount === 0
          ? "Aktuell gibt es keine aktive Online-Anfrage."
          : `Aktuell gibt es ${activeCount} aktive Online-Anfragen: ${newCount} neu, ${inReviewCount} in Bearbeitung und ${waitingCount} warten auf Rückmeldung.`;

  return {
    type: "answer",
    topicId: "online-requests.inventory",
    message,
    navigation: {
      label: "Online-Anfragen öffnen",
      tab: "onlineRequests",
    },
    structured: {
      title: "Online-Anfragen · OK immocare",
      summary:
        intent.oldestFirst && list[0]
          ? `Älteste passende Anfrage: ${list[0].referenceNumber} vom ${formatDateTime(
              list[0].createdAt
            )}.`
          : message,
      facts: [
        {
          label: "Neu",
          value: String(newCount),
          tone: newCount > 0 ? "warning" : "positive",
        },
        { label: "In Bearbeitung", value: String(inReviewCount) },
        {
          label: "Wartet auf Rückmeldung",
          value: String(waitingCount),
          tone: waitingCount > 0 ? "warning" : "neutral",
        },
        { label: "Aktiv gesamt", value: String(activeCount) },
        { label: "Insgesamt", value: String(totalCount) },
      ],
      sections: [
        ...(intent.presentation === "list" || intent.oldestFirst
          ? [
              {
                title:
                  matchingCount === 0
                    ? "Keine passenden Anfragen"
                    : intent.oldestFirst
                      ? "Älteste passende Anfrage"
                      : `Passende Anfragen (${matchingCount})`,
                items:
                  list.length > 0
                    ? list.map((request) =>
                        listLabel(request, data.assigneeNames)
                      )
                    : ["Für den gewählten Status wurde keine Anfrage gefunden."],
                tone:
                  matchingCount > 0 ? ("neutral" as const) : ("positive" as const),
              },
            ]
          : []),
        {
          title: "Verbindliche Bearbeitungsregel",
          items: [
            "Online-Anfragen werden niemals automatisch einem bestehenden Projekt zugeordnet.",
            "Erst nach manueller Kundenprüfung und bewusster Umwandlung entsteht ein neues Projekt unter OK immocare → Lead / Klärung.",
            "Die OKI-Referenz bleibt Quellenreferenz. Die Projektnummer verwendet die nächste globale Nummer mit dem Gewerk-Präfix; bei „Sonstige / Andere Leistung“ gilt SON.",
          ],
          tone: "neutral",
        },
      ],
    },
    deterministic: true,
  };
}
