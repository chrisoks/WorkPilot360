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
import type { JarvisSurfaceContext } from "@/lib/jarvis/knowledge";
import {
  createJarvisDialogChoice,
  type JarvisDialogChoice,
} from "@/lib/jarvis/dialog";

type JarvisPersonIntent = {
  query: string;
  scope?: JarvisPersonScope;
};

type JarvisPersonScope =
  | "overview"
  | "projects"
  | "commercial"
  | "tasks"
  | "activities"
  | "contact";

type JarvisPersonDiagnosticIntent = {
  query?: string;
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

type DiagnosticProjectRow = ProjectRow & {
  customer: string | null;
  contactId: string | null;
  contactPersonId: string | null;
  addressContactId: string | null;
};

const PERSON_QUESTION_PATTERNS = [
  /was\s+(?:weisst|weiss)\s+du(?:\s+denn)?(?:\s+alles)?\s+uber\s+(.+)/i,
  /was\s+ist\s+dir(?:\s+alles)?\s+uber\s+(.+)\s+bekannt/i,
  /erzahl\s+mir(?:\s+bitte)?(?:\s+etwas|\s+alles)?\s+uber\s+(.+)/i,
  /sag\s+mir(?:\s+bitte)?(?:\s+etwas|\s+alles)?\s+uber\s+(.+)/i,
  /was\s+kannst\s+du\s+mir\s+(?:uber|zu)\s+(.+?)\s+sagen/i,
  /(?:gib|zeig|zeige|nenn)\s+mir\s+.+?\s+(?:uber|zu|von|bei)\s+(.+)/i,
  /welche\s+projekte\s+hat\s+(.+)/i,
  /wie\s+ist\s+der\s+stand\s+bei\s+(.+)/i,
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

function resolvePersonScope(normalizedQuestion: string): JarvisPersonScope | undefined {
  if (/\b(gesamtuberblick|kompakter uberblick|kurzer uberblick)\b/.test(normalizedQuestion)) {
    return "overview";
  }
  if (/\b(angebot|angebote|rechnung|rechnungen|dokumente)\b/.test(normalizedQuestion)) {
    return "commercial";
  }
  if (/\b(aufgabe|aufgaben|offene punkte|to dos?)\b/.test(normalizedQuestion)) {
    return "tasks";
  }
  if (/\b(aktivitat|aktivitaten|logbuch|letzte kontakte|kontaktverlauf)\b/.test(normalizedQuestion)) {
    return "activities";
  }
  if (/\b(kontaktdaten|telefon|telefonnummer|e mail|email|adresse)\b/.test(normalizedQuestion)) {
    return "contact";
  }
  if (/\b(projekt|projekte|projektstatus|projektstand)\b/.test(normalizedQuestion)) {
    return "projects";
  }
  return undefined;
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

function mapContactCandidate(contact: {
  id: string;
  customerNumber: string;
  category: string;
  type: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  parentCompanyId: string | null;
  parentCompanyName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
}): ContactCandidate {
  const personName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
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
}

export function resolveJarvisPersonIntent(question: string): JarvisPersonIntent | undefined {
  const normalizedQuestion = normalize(question);
  for (const pattern of PERSON_QUESTION_PATTERNS) {
    const match = normalizedQuestion.match(pattern);
    const query = cleanQuery(match?.[1] ?? "");
    if (!query || query.length < 3 || GENERIC_SUBJECTS.has(normalize(query))) continue;
    const scope = resolvePersonScope(normalizedQuestion);
    return scope ? { query, scope } : { query };
  }
  return undefined;
}

export function resolveJarvisPersonDiagnosticIntent(
  question: string
): JarvisPersonDiagnosticIntent | undefined {
  const normalizedQuestion = normalize(question);
  const referencesProjects = /\bprojekt(?:e|zahl|zahlen)?\b/.test(normalizedQuestion);
  const asksForCause =
    /\bwarum\b/.test(normalizedQuestion) ||
    /\bworan\b/.test(normalizedQuestion) ||
    /\bursache\b/.test(normalizedQuestion) ||
    /\babweichung\b/.test(normalizedQuestion) ||
    /\bunterschied\b/.test(normalizedQuestion);
  const comparesViews =
    /\b(?:anzeig|zeig|find|sag|zahl|kundenakte|jarvis|stimm|unterschied|abweichung)\w*\b/.test(normalizedQuestion) ||
    /\b\d+\b/.test(normalizedQuestion);
  if (!referencesProjects || !asksForCause || !comparesViews) return undefined;

  const queryPatterns = [
    /\bbei\s+(.+?)\s+(?:nur\s+)?\d+\s+projekte?\b/,
    /\bfur\s+(.+?)\s+(?:nur\s+)?\d+\s+projekte?\b/,
    /\bvon\s+(.+?)\s+(?:nur\s+)?\d+\s+projekte?\b/,
    /\bbei\s+(.+?)\s+(?:moglicherweise\s+)?unterschiedliche\s+projektzahlen\b/,
    /\bprojektzahlen\s+(?:von|bei)\s+(.+)$/,
  ];
  for (const pattern of queryPatterns) {
    const match = normalizedQuestion.match(pattern);
    const query = cleanQuery(match?.[1] ?? "");
    if (query.length >= 3) return { query };
  }
  return {};
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

async function findContactCandidateById(
  organizationId: string,
  contactId: string
): Promise<ContactCandidate | undefined> {
  const contact = await prisma.contact.findFirst({
    where: { organizationId, id: contactId },
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
  return contact ? mapContactCandidate(contact) : undefined;
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

function projectRecord(project: ProjectRow): JarvisRecordResult {
  return {
    id: `person-summary-project-${project.id}`,
    kind: "project",
    title: `${project.projectNumber || "Ohne Nummer"} · ${project.title}`,
    subtitle: joinParts([project.status, project.trade]),
    summary: joinParts([
      project.projectKind || project.projectType || "Projektart nicht gepflegt",
      `Aktualisiert: ${formatDate(project.updatedAt)}`,
    ]),
    status: project.status,
    target: { kind: "project", id: project.id },
  };
}

function buildPersonClarification(
  candidate: PersonCandidate,
  accessProfile: JarvisAccessProfile
): JarvisReadResponse {
  const choices: JarvisDialogChoice[] = [
    createJarvisDialogChoice(
      `person-overview-${candidate.id}`,
      "Gesamtüberblick",
      `Gib mir einen kompakten Gesamtüberblick zu ${candidate.displayName}.`
    ),
  ];

  if (candidate.kind === "customer") {
    if (getJarvisActionDecision("project.read", accessProfile).executable) {
      choices.push(
        createJarvisDialogChoice(
          `person-projects-${candidate.id}`,
          "Projekte & Status",
          `Zeige mir die Projekte und Projektstatus von ${candidate.displayName}.`
        )
      );
    }
    const canReadOffers = getJarvisActionDecision("offer.read", accessProfile).executable;
    const canReadInvoices = getJarvisActionDecision("invoice.read", accessProfile).executable;
    if (canReadOffers || canReadInvoices) {
      choices.push(
        createJarvisDialogChoice(
          `person-commercial-${candidate.id}`,
          "Angebote & Rechnungen",
          `Zeige mir Angebote und Rechnungen von ${candidate.displayName}.`
        )
      );
    }
    if (getJarvisActionDecision("task.read", accessProfile).executable) {
      choices.push(
        createJarvisDialogChoice(
          `person-tasks-${candidate.id}`,
          "Offene Aufgaben",
          `Zeige mir offene Aufgaben und offene Punkte zu ${candidate.displayName}.`
        )
      );
    }
    choices.push(
      createJarvisDialogChoice(
        `person-activities-${candidate.id}`,
        "Letzte Aktivitäten",
        `Zeige mir die letzten Aktivitäten zu ${candidate.displayName}.`
      ),
      createJarvisDialogChoice(
        `person-contact-${candidate.id}`,
        "Kontaktdaten",
        `Zeige mir die Kontaktdaten von ${candidate.displayName}.`
      )
    );
    if (getJarvisActionDecision("project.read", accessProfile).executable) {
      choices.push(
        createJarvisDialogChoice(
          `person-diagnostic-${candidate.id}`,
          "Auffälligkeiten prüfen",
          `Warum gibt es bei ${candidate.displayName} möglicherweise unterschiedliche Projektzahlen?`
        )
      );
    }
  } else {
    choices.push(
      createJarvisDialogChoice(
        `employee-contact-${candidate.id}`,
        "Dienstliche Kontaktdaten",
        `Zeige mir die dienstlichen Kontaktdaten von ${candidate.displayName}.`
      )
    );
  }

  return {
    type: "clarification",
    topicId: "person.summary.clarification",
    message: `Ich habe ${candidate.displayName} eindeutig gefunden. Was möchtest du konkret wissen?`,
    choices,
    records: candidate.kind === "customer" ? [contactRecord(candidate)] : undefined,
    deterministic: true,
  };
}

async function buildCustomerSummary(input: {
  organizationId: string;
  contact: ContactCandidate;
  accessProfile: JarvisAccessProfile;
  scope: JarvisPersonScope;
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

  const needsProjects = ["overview", "projects", "commercial", "tasks"].includes(input.scope);
  const projects = needsProjects && linkedContactIds.length
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
    ["overview", "commercial"].includes(input.scope) &&
    offerDecision.executable &&
    projectIds.length
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
    ["overview", "commercial"].includes(input.scope) &&
    invoiceDecision.executable &&
    projectIds.length
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
    ["overview", "tasks"].includes(input.scope) && projectIds.length
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
            title: true,
            status: true,
            deadline: true,
            updatedAt: true,
            ownerId: true,
            teamId: true,
            createdById: true,
            projectId: true,
            participants: { select: { userId: true } },
          },
        })
      : Promise.resolve([]),
    ["overview", "activities"].includes(input.scope)
      ? prisma.customerLogbookEntry.findMany({
          where: {
            organizationId: input.organizationId,
            OR: [
              { customerId: { in: linkedContactIds } },
              { contactId: { in: linkedContactIds } },
            ],
          },
          orderBy: { occurredAt: "desc" },
          take: 8,
          select: {
            title: true,
            eventType: true,
            occurredAt: true,
          },
        })
      : Promise.resolve([]),
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
  const projectRecords = projects.map(projectRecord);
  const offerRecords: JarvisRecordResult[] = offers.map((offer) => ({
    id: `person-summary-offer-${offer.id}`,
    kind: "offer",
    title: `${offer.offerNumber} · ${offer.customerName || offer.projectTitle}`,
    subtitle: joinParts([offer.projectNumber, offer.projectTitle]),
    summary: `Zuletzt aktualisiert: ${formatDate(offer.updatedAt)}`,
    status: offer.wonAt ? "Gewonnen" : offer.status,
    target: { kind: "offer", id: offer.id, projectId: offer.projectId },
  }));
  const invoiceRecords: JarvisRecordResult[] = invoices.map((invoice) => ({
    id: `person-summary-invoice-${invoice.id}`,
    kind: "invoice",
    title: invoice.invoiceNumber,
    subtitle: invoice.dueDate ? `Fällig: ${formatDate(invoice.dueDate)}` : "Ohne Fälligkeit",
    summary: `Zuletzt aktualisiert: ${formatDate(invoice.updatedAt)}`,
    status: invoice.isPaid ? "Bezahlt" : invoice.status,
    target: { kind: "invoice", id: invoice.id, projectId: invoice.projectId },
  }));
  const taskRecords: JarvisRecordResult[] = visibleTasks.map((task) => ({
    id: `person-summary-task-${task.id}`,
    kind: "task",
    title: task.title,
    subtitle: task.deadline ? `Fällig: ${formatDate(task.deadline)}` : "Ohne Frist",
    summary: `Zuletzt aktualisiert: ${formatDate(task.updatedAt)}`,
    status: task.status,
    target: { kind: "task", id: task.id, projectId: task.projectId || undefined },
  }));

  if (input.scope === "projects") {
    return {
      type: "answer",
      topicId: "person.customer.projects",
      message:
        `${input.contact.displayName} hat ${projects.length} verknüpfte Projekte, ` +
        `davon sind ${openProjects.length} nicht abgeschlossen.`,
      records: [contactRecord(input.contact), ...projectRecords.slice(0, 4)],
      structured: {
        title: `Projekte · ${input.contact.displayName}`,
        subtitle: joinParts([contactType, input.contact.customerNumber]),
        summary: "Aktueller Projektstand aus stabil verknüpften WorkPilot-Daten.",
        facts: [
          { label: "Projekte", value: `${projects.length} verknüpft` },
          { label: "Offen", value: `${openProjects.length} nicht abgeschlossen` },
        ],
        sections: [{
          title: "Aktueller Stand",
          items: projects.length
            ? projects.slice(0, 6).map(
                (project) =>
                  `${project.projectNumber || "Ohne Nummer"} · ${project.title}: ${project.status}`
              )
            : ["Keine stabil verknüpften Projekte gefunden."],
          tone: projects.length ? "neutral" : "warning",
        }],
      },
      deterministic: true,
    };
  }

  if (input.scope === "commercial") {
    const commercialRecords = [...offerRecords, ...invoiceRecords].slice(0, 5);
    return {
      type: "answer",
      topicId: "person.customer.commercial",
      message: [
        offerDecision.executable
          ? `${offers.length} Angebote, davon ${openOffers.length} offen.`
          : "",
        invoiceDecision.executable
          ? `${invoices.length} Rechnungen, davon ${openInvoices.length} offen.`
          : "",
      ].filter(Boolean).join(" "),
      records: [contactRecord(input.contact), ...commercialRecords].slice(0, 6),
      structured: {
        title: `Angebote & Rechnungen · ${input.contact.displayName}`,
        subtitle: joinParts([contactType, input.contact.customerNumber]),
        summary: "Es werden nur Dokumente angezeigt, die für deine Rolle freigegeben sind.",
        facts: [
          ...(offerDecision.executable
            ? [{ label: "Angebote", value: `${offers.length} gesamt · ${openOffers.length} offen` }]
            : []),
          ...(invoiceDecision.executable
            ? [{ label: "Rechnungen", value: `${invoices.length} gesamt · ${openInvoices.length} offen` }]
            : []),
        ],
      },
      deterministic: true,
    };
  }

  if (input.scope === "tasks") {
    return {
      type: "answer",
      topicId: "person.customer.tasks",
      message:
        visibleTasks.length > 0
          ? `Zu ${input.contact.displayName} sind ${visibleTasks.length} offene, für dich sichtbare Aufgaben vorhanden.`
          : `Zu ${input.contact.displayName} wurde keine offene, für dich sichtbare Aufgabe gefunden.`,
      records: [contactRecord(input.contact), ...taskRecords.slice(0, 5)],
      structured: {
        title: `Offene Aufgaben · ${input.contact.displayName}`,
        subtitle: "Rollenbasiert gefiltert",
        summary:
          visibleTasks.length > 0
            ? "Diese offenen Punkte sind für deine aktuelle Rolle sichtbar."
            : "Aktuell besteht kein sichtbarer offener Aufgabenpunkt.",
        facts: [{ label: "Aufgaben", value: `${visibleTasks.length} offen und sichtbar` }],
      },
      deterministic: true,
    };
  }

  if (input.scope === "activities") {
    return {
      type: "answer",
      topicId: "person.customer.activities",
      message: lastActivity
        ? `Letzte dokumentierte Kundenaktivität: ${lastActivity.title || lastActivity.eventType} am ${formatDate(lastActivity.occurredAt)}.`
        : `Zu ${input.contact.displayName} ist keine Kundenaktivität im Logbuch dokumentiert.`,
      records: [contactRecord(input.contact)],
      structured: {
        title: `Letzte Aktivitäten · ${input.contact.displayName}`,
        subtitle: "Kundenlogbuch",
        sections: [{
          title: "Verlauf",
          items: logbookEntries.length
            ? logbookEntries.slice(0, 6).map(
                (entry) =>
                  `${formatDate(entry.occurredAt)} · ${entry.title || entry.eventType}`
              )
            : ["Keine Kundenaktivität im Logbuch dokumentiert."],
          tone: logbookEntries.length ? "neutral" : "warning",
        }],
      },
      deterministic: true,
    };
  }

  if (input.scope === "contact") {
    return {
      type: "answer",
      topicId: "person.customer.contact",
      message: contactDetails
        ? `Kontaktdaten von ${input.contact.displayName}: ${contactDetails}.`
        : `Für ${input.contact.displayName} sind keine direkten Kontaktdaten gepflegt.`,
      records: [contactRecord(input.contact)],
      structured: {
        title: `Kontaktdaten · ${input.contact.displayName}`,
        subtitle: joinParts([contactType, input.contact.customerNumber]),
        sections: [{
          title: "Erreichbarkeit",
          items: contactDetails
            ? [contactDetails]
            : ["Keine direkten Kontaktdaten gepflegt."],
          tone: contactDetails ? "neutral" : "warning",
        }],
      },
      deterministic: true,
    };
  }

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
    ...projectRecords.slice(0, 2),
    ...offerRecords.slice(0, Math.max(0, 5 - Math.min(3, 1 + projects.length))),
  ].slice(0, 5);

  return {
    type: "answer",
    topicId: "person.customer.summary",
    message: summaryParts.join(" "),
    records,
    structured: {
      title: input.contact.displayName,
      subtitle: joinParts([
        contactType,
        input.contact.customerNumber ? `Kundennummer ${input.contact.customerNumber}` : "",
        input.contact.city,
      ]),
      summary: "Aktueller, rollenbasierter Überblick aus den verknüpften WorkPilot-Daten.",
      facts: [
        {
          label: "Projekte",
          value: `${projects.length} verknüpft · ${openProjects.length} offen`,
        },
        ...(offerDecision.executable
          ? [{
              label: "Angebote",
              value: `${offers.length} gesamt · ${openOffers.length} offen`,
            }]
          : []),
        ...(invoiceDecision.executable
          ? [{
              label: "Rechnungen",
              value: `${invoices.length} gesamt · ${openInvoices.length} offen`,
            }]
          : []),
        {
          label: "Aufgaben",
          value: `${visibleTasks.length} offen und sichtbar`,
        },
      ],
      sections: [
        {
          title: "Kontaktdaten",
          items: contactDetails
            ? [contactDetails]
            : ["Keine direkten Kontaktdaten gepflegt."],
        },
        {
          title: "Einordnung",
          items: [
            lastActivity
              ? `Letzte dokumentierte Kundenaktivität: ${lastActivity.title || lastActivity.eventType} am ${formatDate(lastActivity.occurredAt)}.`
              : "Keine Kundenaktivität im Logbuch dokumentiert.",
          ],
          tone: lastActivity ? "neutral" : "warning",
        },
      ],
    },
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
    structured: {
      title: employee.displayName,
      subtitle: `${formatRole(employee.role)} · ${employee.isActive ? "Aktiv" : "Inaktiv"}`,
      facts: [
        { label: "E-Mail", value: employee.email },
        ...(employee.departmentName
          ? [{ label: "Abteilung", value: employee.departmentName }]
          : []),
        ...(employee.teamName
          ? [{ label: "Team", value: employee.teamName }]
          : []),
        ...(employee.planningGroup
          ? [{ label: "Planungsgruppe", value: employee.planningGroup }]
          : []),
      ],
      sections: [{
        title: "Datenschutz",
        items: [
          "Lohn-, Gehalts-, Personalakten- und technische Geheimdaten werden in dieser Übersicht nicht ausgegeben.",
        ],
      }],
    },
    deterministic: true,
  };
}

function diagnosticProjectRecord(
  project: DiagnosticProjectRow,
  status: string
): JarvisRecordResult {
  return {
    id: `person-diagnostic-project-${project.id}`,
    kind: "project",
    title: `${project.projectNumber || "Ohne Nummer"} · ${project.title}`,
    subtitle: joinParts([project.status, project.trade]),
    summary: project.customer
      ? `Gespeicherter Kundenname: ${project.customer}`
      : "Kein Kundenname gespeichert.",
    status,
    target: { kind: "project", id: project.id },
  };
}

async function resolveDiagnosticContact(input: {
  intent: JarvisPersonDiagnosticIntent;
  organizationId: string;
  context?: JarvisSurfaceContext;
}): Promise<ContactCandidate | undefined> {
  if (input.intent.query) {
    const candidates = await findContactCandidates(input.organizationId, input.intent.query);
    const exact = candidates.filter(
      (candidate) => normalize(candidate.displayName) === normalize(input.intent.query ?? "")
    );
    return exact.length === 1
      ? exact[0]
      : candidates.length === 1
        ? candidates[0]
        : undefined;
  }

  if (input.context?.recordType === "customer" && input.context.recordId) {
    return findContactCandidateById(input.organizationId, input.context.recordId);
  }

  if (input.context?.recordType === "project" && input.context.recordId) {
    const projects = await prisma.$queryRaw<Array<{
      contactId: string | null;
      contactPersonId: string | null;
      addressContactId: string | null;
      customer: string | null;
    }>>(Prisma.sql`
      SELECT "contactId", "contactPersonId", "addressContactId", "customer"
      FROM "WorkPilotProject"
      WHERE "organizationId" = ${input.organizationId}
        AND "id" = ${input.context.recordId}
      LIMIT 1
    `);
    const project = projects[0];
    const stableContactId =
      project?.contactId || project?.contactPersonId || project?.addressContactId;
    if (stableContactId) {
      const contact = await findContactCandidateById(input.organizationId, stableContactId);
      if (contact) return contact;
    }
    if (project?.customer) {
      const candidates = await findContactCandidates(input.organizationId, project.customer);
      const exact = candidates.filter((candidate) => {
        const contactLabel = [
          candidate.companyName,
          candidate.firstName,
          candidate.lastName,
        ].filter(Boolean).join(" - ");
        return [candidate.displayName, contactLabel, candidate.companyName]
          .filter(Boolean)
          .some((label) => normalize(label) === normalize(project.customer ?? ""));
      });
      return exact.length === 1 ? exact[0] : undefined;
    }
  }

  return undefined;
}

export async function resolveJarvisPersonDiagnosticRequest(input: {
  question: string;
  organizationId: string;
  accessProfile: JarvisAccessProfile;
  context?: JarvisSurfaceContext;
}): Promise<JarvisReadResponse | undefined> {
  const intent = resolveJarvisPersonDiagnosticIntent(input.question);
  if (!intent) return undefined;

  const authorization = authorizeJarvisQuestion(input.question, input.accessProfile);
  if (!authorization.allowed) {
    return {
      type: "refusal",
      topicId: "person.project-diagnostic.refused",
      message: "Diese Diagnose ist für deine aktuelle WorkPilot-Rolle nicht freigegeben.",
      deterministic: true,
    };
  }

  const contactDecision = getJarvisActionDecision("contact.read", input.accessProfile);
  const projectDecision = getJarvisActionDecision("project.read", input.accessProfile);
  if (!contactDecision.executable || !projectDecision.executable) {
    return {
      type: "refusal",
      topicId: "person.project-diagnostic.refused",
      message:
        "Deine aktuelle WorkPilot-Rolle darf Kunden- und Projektzuordnungen nicht gemeinsam prüfen.",
      deterministic: true,
    };
  }

  const contact = await resolveDiagnosticContact({
    intent,
    organizationId: input.organizationId,
    context: input.context,
  });
  if (!contact) {
    return {
      type: "unknown",
      topicId: "person.project-diagnostic.context-required",
      message:
        "Für die Diagnose brauche ich einen eindeutigen Kunden. Öffne die Kunden- oder Projektakte und stelle die Frage dort erneut oder nenne den vollständigen Kundennamen.",
      structured: {
        title: "Projektabweichung prüfen",
        summary: "Der betroffene Kunde konnte nicht eindeutig bestimmt werden.",
        sections: [{
          title: "Nächster Schritt",
          items: [
            "Öffne die betroffene Kunden- oder Projektakte und stelle die Frage erneut.",
          ],
        }],
      },
      deterministic: true,
    };
  }

  const childContacts = await prisma.contact.findMany({
    where: {
      organizationId: input.organizationId,
      parentCompanyId: contact.id,
    },
    select: { id: true },
  });
  const linkedContactIds = [
    contact.id,
    contact.parentCompanyId,
    ...childContacts.map((child) => child.id),
  ].filter(Boolean);
  const projects = await prisma.$queryRaw<DiagnosticProjectRow[]>(Prisma.sql`
    SELECT "id", "projectNumber", "title", "status", "projectKind",
           "projectType", "trade", "updatedAt", "customer",
           "contactId", "contactPersonId", "addressContactId"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${input.organizationId}
    ORDER BY "updatedAt" DESC
    LIMIT 1000
  `);
  const customerFileNames = [
    contact.displayName,
    [contact.companyName, contact.firstName, contact.lastName].filter(Boolean).join(" - "),
    contact.companyName,
  ].filter(Boolean).map(normalize);
  const jarvisProjects = projects.filter((project) =>
    [project.contactId, project.contactPersonId, project.addressContactId]
      .filter(Boolean)
      .some((contactId) => linkedContactIds.includes(contactId ?? ""))
  );
  const customerFileProjects = projects.filter((project) => {
    const stableCustomerMatch =
      project.contactId === contact.id || project.contactPersonId === contact.id;
    const nameMatch =
      Boolean(project.customer) &&
      customerFileNames.includes(normalize(project.customer ?? ""));
    return stableCustomerMatch || nameMatch;
  });
  const jarvisIds = new Set(jarvisProjects.map((project) => project.id));
  const customerFileIds = new Set(customerFileProjects.map((project) => project.id));
  const nameOnlyProjects = customerFileProjects.filter(
    (project) => !jarvisIds.has(project.id)
  );
  const stableOnlyProjects = jarvisProjects.filter(
    (project) => !customerFileIds.has(project.id)
  );
  const sameCount =
    jarvisProjects.length === customerFileProjects.length &&
    nameOnlyProjects.length === 0 &&
    stableOnlyProjects.length === 0;

  const causeItems = [
    ...nameOnlyProjects.map(
      (project) =>
        `${project.projectNumber || project.title} wird in der Kundenakte nur über den gespeicherten Kundennamen „${project.customer || contact.displayName}“ gefunden. Eine stabile Kunden-ID zu ${contact.displayName} fehlt.`
    ),
    ...stableOnlyProjects.map(
      (project) =>
        `${project.projectNumber || project.title} besitzt eine stabile Verknüpfung über Ansprechpartner oder Adresse, wird von der aktuellen Kundenakten-Zählung aber nicht erfasst.`
    ),
  ];
  if (sameCount) {
    causeItems.push(
      "Aktuell verwenden beide Auswertungen dieselbe Projektmenge. Eine frühere Abweichung kann nach einer korrigierten Kundenzuordnung oder durch eine noch angezeigte ältere Chatantwort entstanden sein."
    );
  }

  const message =
    `Ich habe die Zuordnung für ${contact.displayName} geprüft. ` +
    `JARVIS findet ${jarvisProjects.length} stabil verknüpfte Projekte; die Kundenakte zählt ${customerFileProjects.length}. ` +
    causeItems.join(" ");

  return {
    type: "answer",
    topicId: "person.project-diagnostic",
    message,
    structured: {
      title: `Projektabweichung · ${contact.displayName}`,
      subtitle: "Stabile Kunden-ID und Kundenakten-Zählung verglichen",
      summary: sameCount
        ? "Aktuell besteht keine Abweichung."
        : "Die Abweichung wurde anhand der gespeicherten Zuordnungen nachvollzogen.",
      facts: [
        {
          label: "JARVIS",
          value: `${jarvisProjects.length} stabil verknüpft`,
          tone: sameCount ? "positive" : "neutral",
        },
        {
          label: "Kundenakte",
          value: `${customerFileProjects.length} angezeigt`,
          tone: sameCount ? "positive" : "warning",
        },
      ],
      sections: [{
        title: sameCount ? "Ergebnis" : "Gefundene Ursache",
        items: causeItems,
        tone: sameCount ? "positive" : "warning",
      }],
    },
    records: [
      ...nameOnlyProjects.map((project) =>
        diagnosticProjectRecord(project, "Kundenzuordnung fehlt")
      ),
      ...stableOnlyProjects.map((project) =>
        diagnosticProjectRecord(project, "Nur stabile Verknüpfung")
      ),
    ].slice(0, 5),
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

  if (!intent.scope) {
    return buildPersonClarification(selected, input.accessProfile);
  }

  if (selected.kind === "employee") {
    return buildEmployeeSummary(selected);
  }
  if (
    intent.scope === "projects" &&
    !getJarvisActionDecision("project.read", input.accessProfile).executable
  ) {
    return {
      type: "refusal",
      topicId: "person.customer.projects.refused",
      message: "Deine aktuelle WorkPilot-Rolle darf die Projekte dieses Kunden nicht über JARVIS lesen.",
      deterministic: true,
    };
  }
  if (
    intent.scope === "tasks" &&
    !getJarvisActionDecision("task.read", input.accessProfile).executable
  ) {
    return {
      type: "refusal",
      topicId: "person.customer.tasks.refused",
      message: "Deine aktuelle WorkPilot-Rolle darf diese Kundenaufgaben nicht über JARVIS lesen.",
      deterministic: true,
    };
  }
  if (
    intent.scope === "commercial" &&
    !getJarvisActionDecision("offer.read", input.accessProfile).executable &&
    !getJarvisActionDecision("invoice.read", input.accessProfile).executable
  ) {
    return {
      type: "refusal",
      topicId: "person.customer.commercial.refused",
      message: "Deine aktuelle WorkPilot-Rolle darf Angebote oder Rechnungen dieses Kunden nicht über JARVIS lesen.",
      deterministic: true,
    };
  }
  return buildCustomerSummary({
    organizationId: input.organizationId,
    contact: selected,
    accessProfile: input.accessProfile,
    scope: intent.scope,
  });
}
