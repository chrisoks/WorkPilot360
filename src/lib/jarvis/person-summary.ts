import { Prisma, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import {
  canAccessJarvisTask,
  type JarvisReadResponse,
  type JarvisRecordResult,
} from "@/lib/jarvis/read-model";
import {
  authorizeJarvisQuestion,
  type JarvisAccessProfile,
} from "@/lib/jarvis/security";

type JarvisPersonIntent = {
  query: string;
};

type ContactCandidate = {
  kind: "customer";
  id: string;
  displayName: string;
  customerNumber: string;
  category: string;
  type: string;
  companyName: string;
  firstName: string;
  lastName: string;
  parentCompanyId: string;
  parentCompanyName: string;
  email: string;
  phone: string;
  mobile: string;
  street: string;
  postalCode: string;
  city: string;
};

type EmployeeCandidate = {
  kind: "employee";
  id: string;
  displayName: string;
  email: string;
  role: string;
  isActive: boolean;
  teamName: string;
  departmentName: string;
  planningBoard: string;
  planningGroup: string;
};

type PersonCandidate = ContactCandidate | EmployeeCandidate;

type ProjectRow = {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
  projectKind: string | null;
  projectType: string | null;
  trade: string | null;
  updatedAt: Date;
};

const PERSON_QUESTION_PATTERNS = [
  /was\s+(?:weisst|weiss)\s+du(?:\s+denn)?(?:\s+alles)?\s+uber\s+(.+)/i,
  /was\s+ist\s+dir(?:\s+alles)?\s+uber\s+(.+)\s+bekannt/i,
  /erzahl\s+mir(?:\s+bitte)?(?:\s+etwas|\s+alles)?\s+uber\s+(.+)/i,
];

const GENERIC_SUBJECTS = new Set([
  "das system",
  "workpilot",
  "workpilot360",
  "projekte",
  "kunden",
  "angebote",
  "rechnungen",
  "aufgaben",
  "jarvis",
]);

function normalize(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}\s&+./-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanQuery(value: string) {
  return value
    .replace(/[?!.:,;]+$/g, "")
    .replace(/^(?:herrn?|frau|firma)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(date);
}

function formatRole(value: string) {
  const labels: Record<string, string> = {
    ADMIN: "Administration",
    GESCHAEFTSFUEHRER: "Geschäftsführung",
    FUEHRUNGSKRAFT: "Führungskraft",
    VERTRIEB: "Vertrieb",
    BUCHHALTUNG: "Buchhaltung",
    MITARBEITER: "Mitarbeiter",
    GAST: "Gast",
  };
  return labels[value] ?? value;
}

function isOpenProjectStatus(value: string) {
  const status = normalize(value);
  return !status.includes("abgeschlossen") && !status.includes("archiviert");
}

function isOpenOfferStatus(value: string, wonAt: Date | null) {
  if (wonAt) return false;
  const status = normalize(value);
  return !status.includes("verloren") && !status.includes("geloscht");
}

function joinParts(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part?.trim())).join(" · ");
}

export function resolveJarvisPersonIntent(question: string): JarvisPersonIntent | undefined {
  const normalizedQuestion = normalize(question);
  for (const pattern of PERSON_QUESTION_PATTERNS) {
    const match = normalizedQuestion.match(pattern);
    const query = cleanQuery(match?.[1] ?? "");
    if (!query || query.length < 3 || GENERIC_SUBJECTS.has(normalize(query))) continue;
    return { query };
  }
  return undefined;
}

function scoreCandidate(candidate: PersonCandidate, query: string) {
  const normalizedQuery = normalize(query);
  const normalizedName = normalize(candidate.displayName);
  if (normalizedName === normalizedQuery) return 100;
  if (normalizedName.startsWith(normalizedQuery)) return 80;
  if (normalizedName.includes(normalizedQuery)) return 60;
  const terms = normalizedQuery.split(" ").filter(Boolean);
  return terms.every((term) => normalizedName.includes(term)) ? 40 : 0;
}

async function findContactCandidates(
  organizationId: string,
  query: string
): Promise<ContactCandidate[]> {
  const terms = normalize(query).split(" ").filter(Boolean).slice(0, 6);
  const contacts = await prisma.contact.findMany({
    where: {
      organizationId,
      AND: terms.map((term) => ({
        OR: [
          { customerNumber: { contains: term, mode: "insensitive" as const } },
          { companyName: { contains: term, mode: "insensitive" as const } },
          { firstName: { contains: term, mode: "insensitive" as const } },
          { lastName: { contains: term, mode: "insensitive" as const } },
          { parentCompanyName: { contains: term, mode: "insensitive" as const } },
        ],
      })),
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      customerNumber: true,
      category: true,
      type: true,
      companyName: true,
      firstName: true,
      lastName: true,
      parentCompanyId: true,
      parentCompanyName: true,
      email: true,
      phone: true,
      mobile: true,
      street: true,
      postalCode: true,
      city: true,
    },
  });

  return contacts.map((contact) => {
    const personName = joinParts([contact.firstName, contact.lastName]).replace(/ · /g, " ");
    return {
      kind: "customer",
      id: contact.id,
      displayName:
        contact.companyName ||
        personName ||
        contact.parentCompanyName ||
        "Kontakt ohne Namen",
      customerNumber: contact.customerNumber,
      category: contact.category,
      type: contact.type,
      companyName: contact.companyName ?? "",
      firstName: contact.firstName ?? "",
      lastName: contact.lastName ?? "",
      parentCompanyId: contact.parentCompanyId ?? "",
      parentCompanyName: contact.parentCompanyName ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      mobile: contact.mobile ?? "",
      street: contact.street ?? "",
      postalCode: contact.postalCode ?? "",
      city: contact.city ?? "",
    };
  });
}

async function findEmployeeCandidates(
  organizationId: string,
  query: string
): Promise<EmployeeCandidate[]> {
  const terms = normalize(query).split(" ").filter(Boolean).slice(0, 6);
  const users = await prisma.user.findMany({
    where: {
      organizationId,
      AND: terms.map((term) => ({
        OR: [
          { firstName: { contains: term, mode: "insensitive" as const } },
          { lastName: { contains: term, mode: "insensitive" as const } },
          { email: { contains: term, mode: "insensitive" as const } },
        ],
      })),
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      planningBoard: true,
      planningGroup: true,
      team: { select: { name: true } },
      department: { select: { name: true } },
    },
  });

  return users.map((user) => ({
    kind: "employee",
    id: user.id,
    displayName: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    teamName: user.team?.name ?? "",
    departmentName: user.department?.name ?? "",
    planningBoard: user.planningBoard ?? "",
    planningGroup: user.planningGroup ?? "",
  }));
}

function contactRecord(contact: ContactCandidate): JarvisRecordResult {
  const contactType =
    contact.type === "company"
      ? "Firmenkunde"
      : contact.type === "private"
        ? "Privatkunde"
        : contact.parentCompanyName
          ? `Ansprechpartner bei ${contact.parentCompanyName}`
          : "Ansprechpartner";
  return {
    id: `person-summary-contact-${contact.id}`,
    kind: "customer",
    title: contact.displayName,
    subtitle: joinParts([contact.customerNumber, contact.category, contact.city]),
    summary: contactType,
    status: contact.category,
    target: { kind: "customer", id: contact.id },
  };
}

async function buildCustomerSummary(input: {
  organizationId: string;
  contact: ContactCandidate;
  accessProfile: JarvisAccessProfile;
}): Promise<JarvisReadResponse> {
  const childContacts = await prisma.contact.findMany({
    where: {
      organizationId: input.organizationId,
      parentCompanyId: input.contact.id,
    },
    select: { id: true },
  });
  const linkedContactIds = [
    input.contact.id,
    input.contact.parentCompanyId,
    ...childContacts.map((contact) => contact.id),
  ].filter(Boolean);

  const projects = linkedContactIds.length
    ? await prisma.$queryRaw<ProjectRow[]>(Prisma.sql`
        SELECT "id", "projectNumber", "title", "status", "projectKind",
               "projectType", "trade", "updatedAt"
        FROM "WorkPilotProject"
        WHERE "organizationId" = ${input.organizationId}
          AND (
            "contactId" IN (${Prisma.join(linkedContactIds)})
            OR "contactPersonId" IN (${Prisma.join(linkedContactIds)})
            OR "addressContactId" IN (${Prisma.join(linkedContactIds)})
          )
        ORDER BY "updatedAt" DESC
        LIMIT 100
      `)
    : [];
  const projectIds = projects.map((project) => project.id);

  const offerDecision = getJarvisActionDecision("offer.read", input.accessProfile);
  const invoiceDecision = getJarvisActionDecision("invoice.read", input.accessProfile);
  const [offers, invoices, tasks, logbookEntries] = await Promise.all([
    offerDecision.executable && projectIds.length
      ? prisma.offer.findMany({
          where: {
            organizationId: input.organizationId,
            projectId: { in: projectIds },
            status: {
              notIn: ["Gel\u00f6scht", "Gel\u00c3\u00b6scht"],
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 100,
          select: {
            id: true,
            projectId: true,
            projectNumber: true,
            projectTitle: true,
            offerNumber: true,
            status: true,
            customerName: true,
            netTotal: true,
            wonAt: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
    invoiceDecision.executable && projectIds.length
      ? prisma.invoice.findMany({
          where: {
            organizationId: input.organizationId,
            projectId: { in: projectIds },
            status: {
              notIn: [
                "Gel\u00f6scht",
                "Gel\u00c3\u00b6scht",
                "Storniert",
                "Stornorechnung",
              ],
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 100,
          select: {
            id: true,
            projectId: true,
            invoiceNumber: true,
            status: true,
            isPaid: true,
            dueDate: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
    projectIds.length
      ? prisma.task.findMany({
          where: {
            organizationId: input.organizationId,
            projectId: { in: projectIds },
            status: {
              notIn: [
                TaskStatus.ERLEDIGT,
                TaskStatus.ABGELEHNT,
                TaskStatus.ARCHIVIERT,
              ],
            },
          },
          orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
          take: 100,
          select: {
            id: true,
            ownerId: true,
            teamId: true,
            createdById: true,
            projectId: true,
            participants: { select: { userId: true } },
          },
        })
      : Promise.resolve([]),
    prisma.customerLogbookEntry.findMany({
      where: {
        organizationId: input.organizationId,
        OR: [
          { customerId: { in: linkedContactIds } },
          { contactId: { in: linkedContactIds } },
        ],
      },
      orderBy: { occurredAt: "desc" },
      take: 1,
      select: {
        title: true,
        eventType: true,
        occurredAt: true,
      },
    }),
  ]);

  const visibleTasks = tasks.filter((task) =>
    canAccessJarvisTask(input.accessProfile, {
      ownerId: task.ownerId,
      teamId: task.teamId,
      createdById: task.createdById,
      participantUserIds: task.participants.map((participant) => participant.userId),
    })
  );
  const openProjects = projects.filter((project) => isOpenProjectStatus(project.status));
  const openOffers = offers.filter((offer) => isOpenOfferStatus(offer.status, offer.wonAt));
  const openInvoices = invoices.filter((invoice) => !invoice.isPaid);
  const lastActivity = logbookEntries[0];
  const contactType =
    input.contact.type === "company"
      ? "Firmenkunde"
      : input.contact.type === "private"
        ? "Privatkunde"
        : input.contact.parentCompanyName
          ? `Ansprechpartner bei ${input.contact.parentCompanyName}`
          : "Ansprechpartner";
  const contactDetails = joinParts([
    input.contact.email,
    input.contact.phone || input.contact.mobile,
    joinParts([input.contact.postalCode, input.contact.city]).replace(/ · /g, " "),
  ]);
  const summaryParts = [
    `${input.contact.displayName} ist als ${contactType}${
      input.contact.customerNumber ? ` mit der Kundennummer ${input.contact.customerNumber}` : ""
    } erfasst.`,
    contactDetails ? `Kontakt: ${contactDetails}.` : "Es sind keine direkten Kontaktdaten gepflegt.",
    `Verknüpft sind ${projects.length} Projekt${projects.length === 1 ? "" : "e"}${
      projects.length ? `, davon ${openProjects.length} nicht abgeschlossen` : ""
    }.`,
    offerDecision.executable
      ? `${offers.length} Angebot${offers.length === 1 ? "" : "e"}, davon ${openOffers.length} offen.`
      : "",
    invoiceDecision.executable
      ? `${invoices.length} Rechnung${invoices.length === 1 ? "" : "en"}, davon ${openInvoices.length} offen.`
      : "",
    visibleTasks.length
      ? `${visibleTasks.length} offene, für dich sichtbare Aufgabe${visibleTasks.length === 1 ? "" : "n"}.`
      : "Keine offene, für dich sichtbare Aufgabe gefunden.",
    lastActivity
      ? `Letzte dokumentierte Kundenaktivität: ${lastActivity.title || lastActivity.eventType} am ${formatDate(lastActivity.occurredAt)}.`
      : "Keine Kundenaktivität im Logbuch dokumentiert.",
  ].filter(Boolean);

  const records: JarvisRecordResult[] = [
    contactRecord(input.contact),
    ...projects.slice(0, 2).map((project) => ({
      id: `person-summary-project-${project.id}`,
      kind: "project" as const,
      title: `${project.projectNumber || "Ohne Nummer"} · ${project.title}`,
      subtitle: joinParts([project.status, project.trade]),
      summary: joinParts([
        project.projectKind || project.projectType || "Projektart nicht gepflegt",
        `Aktualisiert: ${formatDate(project.updatedAt)}`,
      ]),
      status: project.status,
      target: { kind: "project" as const, id: project.id },
    })),
    ...offers.slice(0, Math.max(0, 5 - Math.min(3, 1 + projects.length))).map((offer) => ({
      id: `person-summary-offer-${offer.id}`,
      kind: "offer" as const,
      title: `${offer.offerNumber} · ${offer.customerName || offer.projectTitle}`,
      subtitle: joinParts([offer.projectNumber, offer.projectTitle]),
      summary: `Zuletzt aktualisiert: ${formatDate(offer.updatedAt)}`,
      status: offer.wonAt ? "Gewonnen" : offer.status,
      target: { kind: "offer" as const, id: offer.id, projectId: offer.projectId },
    })),
  ].slice(0, 5);

  return {
    type: "answer",
    topicId: "person.customer.summary",
    message: summaryParts.join(" "),
    records,
    deterministic: true,
  };
}

function buildEmployeeSummary(employee: EmployeeCandidate): JarvisReadResponse {
  const workContext = joinParts([
    employee.departmentName ? `Abteilung: ${employee.departmentName}` : "",
    employee.teamName ? `Team: ${employee.teamName}` : "",
    employee.planningBoard ? `Planungsboard: ${employee.planningBoard}` : "",
    employee.planningGroup ? `Planungsgruppe: ${employee.planningGroup}` : "",
  ]);
  return {
    type: "answer",
    topicId: "person.employee.summary",
    message:
      `${employee.displayName} ist als ${formatRole(employee.role)} in WorkPilot360 erfasst und ` +
      `${employee.isActive ? "aktiv" : "inaktiv"}. Dienstliche E-Mail: ${employee.email}.` +
      `${workContext ? ` ${workContext}.` : ""} ` +
      "Lohn-, Gehalts-, Personalakten- und technische Geheimdaten werden in dieser Übersicht nicht ausgegeben.",
    deterministic: true,
  };
}

export async function resolveJarvisPersonSummaryRequest(input: {
  question: string;
  organizationId: string;
  accessProfile: JarvisAccessProfile;
}): Promise<JarvisReadResponse | undefined> {
  const intent = resolveJarvisPersonIntent(input.question);
  if (!intent) return undefined;

  const authorization = authorizeJarvisQuestion(input.question, input.accessProfile);
  if (!authorization.allowed) {
    return {
      type: "refusal",
      topicId: "person.summary.refused",
      message:
        authorization.reason === "secret"
          ? "Passwörter, API-Schlüssel, Tokens und technische Geheimnisse sind auch in Personenübersichten für alle Rollen gesperrt."
          : authorization.dataClass === "payroll"
            ? "Lohn-, Gehalts- und Mitarbeiterkostendaten werden in dieser Personenübersicht nicht ausgegeben."
            : "Diese Anfrage ist für deine aktuelle WorkPilot-Rolle nicht freigegeben.",
      deterministic: true,
    };
  }

  const contactDecision = getJarvisActionDecision("contact.read", input.accessProfile);
  const personnelDecision = getJarvisActionDecision("personnel.read", input.accessProfile);
  if (!contactDecision.executable && !personnelDecision.executable) {
    return {
      type: "refusal",
      topicId: "person.summary.refused",
      message:
        "Deine aktuelle WorkPilot-Rolle darf Kunden- oder Personaldaten nicht über JARVIS zusammenfassen.",
      deterministic: true,
    };
  }

  const [contacts, employees] = await Promise.all([
    contactDecision.executable
      ? findContactCandidates(input.organizationId, intent.query)
      : Promise.resolve([]),
    personnelDecision.executable
      ? findEmployeeCandidates(input.organizationId, intent.query)
      : Promise.resolve([]),
  ]);
  const candidates: PersonCandidate[] = [...contacts, ...employees]
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(candidate, intent.query),
    }))
    .filter((entry) => entry.score > 0)
    .sort((first, second) => second.score - first.score)
    .map((entry) => entry.candidate);
  const exactMatches = candidates.filter(
    (candidate) => normalize(candidate.displayName) === normalize(intent.query)
  );
  const selected =
    exactMatches.length === 1
      ? exactMatches[0]
      : exactMatches.length === 0 && candidates.length === 1
        ? candidates[0]
        : undefined;

  if (!selected && candidates.length > 0) {
    const labels = candidates.slice(0, 5).map((candidate) =>
      candidate.kind === "employee"
        ? `${candidate.displayName} (Mitarbeiter)`
        : `${candidate.displayName} (${candidate.category})`
    );
    return {
      type: "unknown",
      topicId: "person.summary.ambiguous",
      message:
        `Ich habe mehrere mögliche Treffer gefunden: ${labels.join(", ")}. ` +
        "Bitte nenne zusätzlich Kundennummer, Firma oder Rolle.",
      records: contacts.slice(0, 5).map(contactRecord),
      deterministic: true,
    };
  }

  if (!selected) {
    return {
      type: "unknown",
      topicId: "person.summary.empty",
      message:
        `Ich habe „${intent.query}“ weder als erlaubten Kundenkontakt noch als erlaubten Mitarbeiter eindeutig gefunden. ` +
        "Prüfe bitte die Schreibweise oder ergänze Firma, Kundennummer oder Rolle.",
      deterministic: true,
    };
  }

  if (selected.kind === "employee") {
    return buildEmployeeSummary(selected);
  }
  return buildCustomerSummary({
    organizationId: input.organizationId,
    contact: selected,
    accessProfile: input.accessProfile,
  });
}
