import { Prisma, Role, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import {
  authorizeJarvisQuestion,
  JarvisAccessProfile,
  JarvisQuestionAuthorization,
} from "@/lib/jarvis/security";
import {
  JarvisReadIntent,
  JarvisRecordKind,
  resolveJarvisReadIntent,
} from "@/lib/jarvis/read-intent";
import type { JarvisSurfaceContext } from "@/lib/jarvis/knowledge";
import { canReadTask } from "@/lib/permissions";

export type JarvisRecordTarget = {
  kind: JarvisRecordKind;
  id: string;
  projectId?: string;
};

export type JarvisRecordResult = {
  id: string;
  kind: JarvisRecordKind;
  title: string;
  subtitle: string;
  summary: string;
  status: string;
  target: JarvisRecordTarget;
};

export type JarvisAnswerTone = "neutral" | "positive" | "warning";

export type JarvisStructuredAnswer = {
  title: string;
  subtitle?: string;
  summary?: string;
  facts?: Array<{
    label: string;
    value: string;
    tone?: JarvisAnswerTone;
  }>;
  sections?: Array<{
    title: string;
    items: string[];
    tone?: JarvisAnswerTone;
  }>;
};

export type JarvisReadResponse = {
  type: "answer" | "refusal" | "unknown";
  message: string;
  topicId: string;
  records?: JarvisRecordResult[];
  structured?: JarvisStructuredAnswer;
  deterministic: true;
};

type ProjectRow = {
  id: string;
  projectNumber: string;
  title: string;
  customer: string | null;
  status: string;
  projectType: string | null;
  projectKind: string | null;
  recurringBillingMode: string | null;
  trade: string | null;
  responsibleName: string | null;
  updatedAt: Date;
};

const READ_ACTION_BY_KIND: Record<JarvisRecordKind, string> = {
  project: "project.read",
  customer: "contact.read",
  task: "task.read",
  offer: "offer.read",
  invoice: "invoice.read",
};

const KIND_LABELS: Record<JarvisRecordKind, { singular: string; plural: string }> = {
  project: { singular: "Projekt", plural: "Projekte" },
  customer: { singular: "Kunde oder Kontakt", plural: "Kunden und Kontakte" },
  task: { singular: "Aufgabe", plural: "Aufgaben" },
  offer: { singular: "Angebot", plural: "Angebote" },
  invoice: { singular: "Rechnung", plural: "Rechnungen" },
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "ohne Datum";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getBerlinDateKey(value = new Date()) {
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

function getAuthorizationRefusal(authorization: JarvisQuestionAuthorization) {
  if (authorization.reason === "prompt_injection") {
    return "Diese Anweisung kann ich nicht befolgen. Ich bleibe bei freigegebenen WorkPilot-Funktionen.";
  }
  if (authorization.reason === "secret") {
    return "Passwörter, API-Schlüssel, Tokens und technische Geheimnisse sind für alle Rollen gesperrt.";
  }
  return "Deine aktuelle WorkPilot-Rolle darf diese Daten nicht über JARVIS abrufen.";
}

function bothActorsPass(
  profile: JarvisAccessProfile,
  predicate: (actor: JarvisAccessProfile["sessionActor"]) => boolean
) {
  return predicate(profile.sessionActor) && predicate(profile.effectiveActor);
}

export function getJarvisReadAccessDecision(kind: JarvisRecordKind, profile: JarvisAccessProfile) {
  return getJarvisActionDecision(READ_ACTION_BY_KIND[kind], profile);
}

export function canAccessJarvisTask(
  profile: JarvisAccessProfile,
  target: {
    ownerId: string;
    teamId?: string | null;
    createdById?: string | null;
    participantUserIds?: string[];
  }
) {
  return bothActorsPass(profile, (actor) => {
    if (!actor.id) return false;
    return canReadTask(
      {
        id: actor.id,
        role: actor.role,
        teamId: actor.teamId,
      },
      target
    );
  });
}

function getTaskActorWhere(
  actor: JarvisAccessProfile["sessionActor"]
): Prisma.TaskWhereInput {
  if (actor.role === Role.ADMIN || actor.role === Role.GESCHAEFTSFUEHRER) {
    return {};
  }
  if (actor.role === Role.FUEHRUNGSKRAFT) {
    return actor.teamId
      ? { teamId: actor.teamId }
      : { id: "__jarvis_no_permitted_task__" };
  }
  if (!actor.id) {
    return { id: "__jarvis_no_permitted_task__" };
  }
  return {
    OR: [
      { ownerId: actor.id },
      { createdById: actor.id },
      { participants: { some: { userId: actor.id } } },
    ],
  };
}

async function findProjects(
  organizationId: string,
  intent: JarvisReadIntent
): Promise<JarvisRecordResult[]> {
  const searchPattern = `%${intent.query}%`;
  const queryCondition = intent.contextRecordId
    ? Prisma.sql`AND "id" = ${intent.contextRecordId}`
    : intent.query
      ? Prisma.sql`AND (
          "projectNumber" ILIKE ${searchPattern}
          OR "title" ILIKE ${searchPattern}
          OR COALESCE("customer", '') ILIKE ${searchPattern}
          OR COALESCE("description", '') ILIKE ${searchPattern}
          OR COALESCE("responsibleName", '') ILIKE ${searchPattern}
        )`
      : Prisma.empty;
  const statusCondition =
    intent.filter === "open"
      ? Prisma.sql`AND LOWER("status") NOT LIKE '%abgeschlossen%' AND LOWER("status") NOT LIKE '%archiviert%'`
      : Prisma.empty;
  const rows = await prisma.$queryRaw<ProjectRow[]>(Prisma.sql`
    SELECT "id", "projectNumber", "title", "customer", "status", "projectType",
           "projectKind", "recurringBillingMode", "trade", "responsibleName", "updatedAt"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organizationId}
      ${queryCondition}
      ${statusCondition}
    ORDER BY "updatedAt" DESC
    LIMIT 20
  `);

  return rows.map((project) => {
    const projectKind = project.projectKind || project.projectType || "Projektart nicht gepflegt";
    const billing =
      project.recurringBillingMode === "hourly"
        ? "Stundenabrechnung"
        : project.recurringBillingMode === "monthlyFlat"
          ? "Monatspauschale"
          : "";
    return {
      id: `project-${project.id}`,
      kind: "project",
      title: `${project.projectNumber || "Ohne Nummer"} · ${project.title}`,
      subtitle: [project.customer, project.status].filter(Boolean).join(" · "),
      summary: [
        projectKind,
        billing,
        project.trade,
        project.responsibleName ? `Verantwortlich: ${project.responsibleName}` : "",
      ].filter(Boolean).join(" · "),
      status: project.status,
      target: { kind: "project", id: project.id },
    };
  });
}

async function findCustomers(
  organizationId: string,
  intent: JarvisReadIntent
): Promise<JarvisRecordResult[]> {
  const contacts = await prisma.contact.findMany({
    where: {
      organizationId,
      ...(intent.contextRecordId
        ? { id: intent.contextRecordId }
        : intent.query
          ? {
              OR: [
                { customerNumber: { contains: intent.query, mode: "insensitive" } },
                { companyName: { contains: intent.query, mode: "insensitive" } },
                { firstName: { contains: intent.query, mode: "insensitive" } },
                { lastName: { contains: intent.query, mode: "insensitive" } },
                { city: { contains: intent.query, mode: "insensitive" } },
              ],
            }
          : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      customerNumber: true,
      category: true,
      type: true,
      companyName: true,
      firstName: true,
      lastName: true,
      city: true,
      parentCompanyName: true,
    },
  });

  return contacts.map((contact) => {
    const personName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
    const title = contact.companyName || personName || contact.parentCompanyName || "Kontakt ohne Namen";
    return {
      id: `customer-${contact.id}`,
      kind: "customer",
      title,
      subtitle: [contact.customerNumber, contact.category, contact.city].filter(Boolean).join(" · "),
      summary:
        contact.type === "company"
          ? "Firmenkontakt"
          : contact.type === "private"
            ? "Privatkunde"
            : contact.parentCompanyName
              ? `Ansprechpartner bei ${contact.parentCompanyName}`
              : "Ansprechpartner",
      status: contact.category,
      target: { kind: "customer", id: contact.id },
    };
  });
}

async function findTasks(
  organizationId: string,
  intent: JarvisReadIntent,
  profile: JarvisAccessProfile
): Promise<JarvisRecordResult[]> {
  const tasks = await prisma.task.findMany({
    where: {
      organizationId,
      AND: [
        getTaskActorWhere(profile.sessionActor),
        getTaskActorWhere(profile.effectiveActor),
      ],
      ...(intent.query
        ? {
            OR: [
              { title: { contains: intent.query, mode: "insensitive" } },
              { description: { contains: intent.query, mode: "insensitive" } },
              { customer: { contains: intent.query, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(intent.filter === "open" || intent.filter === "today"
        ? { status: { notIn: [TaskStatus.ERLEDIGT, TaskStatus.ABGELEHNT, TaskStatus.ARCHIVIERT] } }
        : {}),
    },
    orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
    take: 60,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      deadline: true,
      customer: true,
      projectId: true,
      ownerId: true,
      teamId: true,
      createdById: true,
      owner: { select: { firstName: true, lastName: true } },
      participants: { select: { userId: true } },
    },
  });
  const todayKey = getBerlinDateKey();

  return tasks
    .filter((task) => {
      const accessTarget = {
        ownerId: task.ownerId,
        teamId: task.teamId,
        createdById: task.createdById,
        participantUserIds: task.participants.map((participant) => participant.userId),
      };
      return canAccessJarvisTask(profile, accessTarget);
    })
    .filter((task) => intent.filter !== "today" || getBerlinDateKey(task.deadline) === todayKey)
    .map((task) => {
      const ownerName = [task.owner.firstName, task.owner.lastName].filter(Boolean).join(" ");
      return {
        id: `task-${task.id}`,
        kind: "task" as const,
        title: task.title,
        subtitle: [task.customer, ownerName ? `Zuständig: ${ownerName}` : ""].filter(Boolean).join(" · "),
        summary: `Fällig: ${formatDate(task.deadline)} · Priorität: ${task.priority}`,
        status: task.status,
        target: { kind: "task" as const, id: task.id, projectId: task.projectId || undefined },
      };
    });
}

async function findOffers(
  organizationId: string,
  intent: JarvisReadIntent
): Promise<JarvisRecordResult[]> {
  const offers = await prisma.offer.findMany({
    where: {
      organizationId,
      status: { notIn: ["Gelöscht", "Gel\u00c3\u00b6scht"] },
      ...(intent.query
        ? {
            OR: [
              { offerNumber: { contains: intent.query, mode: "insensitive" } },
              { customerName: { contains: intent.query, mode: "insensitive" } },
              { projectNumber: { contains: intent.query, mode: "insensitive" } },
              { projectTitle: { contains: intent.query, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(intent.filter === "open"
        ? {
            status: { notIn: ["Gelöscht", "Gel\u00c3\u00b6scht", "Verloren", "Angebot verloren"] },
            wonAt: null,
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
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
    },
  });

  return offers.map((offer) => ({
    id: `offer-${offer.id}`,
    kind: "offer",
    title: `${offer.offerNumber} · ${offer.customerName || offer.projectTitle}`,
    subtitle: [offer.projectNumber, offer.projectTitle].filter(Boolean).join(" · "),
    summary: `${formatMoney(offer.netTotal)} netto${
      offer.plannedExecutionMonth ? ` · Ausführung ${offer.plannedExecutionMonth}` : ""
    }`,
    status: offer.wonAt ? "Gewonnen" : offer.status,
    target: { kind: "offer", id: offer.id, projectId: offer.projectId },
  }));
}

async function findInvoices(
  organizationId: string,
  intent: JarvisReadIntent
): Promise<JarvisRecordResult[]> {
  const todayKey = getBerlinDateKey();
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      status: { notIn: ["Gelöscht", "Gel\u00c3\u00b6scht", "Storniert", "Stornorechnung"] },
      ...(intent.query
        ? {
            OR: [
              { invoiceNumber: { contains: intent.query, mode: "insensitive" } },
              { customerName: { contains: intent.query, mode: "insensitive" } },
              { projectNumber: { contains: intent.query, mode: "insensitive" } },
              { projectTitle: { contains: intent.query, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(intent.filter === "open" ? { isPaid: false } : {}),
      ...(intent.filter === "overdue" ? { isPaid: false, dueDate: { lt: todayKey, not: "" } } : {}),
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    take: 20,
    select: {
      id: true,
      projectId: true,
      projectNumber: true,
      projectTitle: true,
      invoiceNumber: true,
      status: true,
      customerName: true,
      netTotal: true,
      grossTotal: true,
      dueDate: true,
      isPaid: true,
      reminderLevel: true,
    },
  });

  return invoices.map((invoice) => ({
    id: `invoice-${invoice.id}`,
    kind: "invoice",
    title: `${invoice.invoiceNumber} · ${invoice.customerName || invoice.projectTitle}`,
    subtitle: [invoice.projectNumber, invoice.projectTitle].filter(Boolean).join(" · "),
    summary: `${formatMoney(invoice.grossTotal)} brutto · Fällig: ${formatDate(invoice.dueDate)}${
      invoice.reminderLevel > 0 ? ` · Mahnstufe ${invoice.reminderLevel}` : ""
    }`,
    status: invoice.isPaid ? "Bezahlt" : invoice.status,
    target: { kind: "invoice", id: invoice.id, projectId: invoice.projectId },
  }));
}

async function loadRecords(
  organizationId: string,
  intent: JarvisReadIntent,
  profile: JarvisAccessProfile
) {
  switch (intent.kind) {
    case "project":
      return findProjects(organizationId, intent);
    case "customer":
      return findCustomers(organizationId, intent);
    case "task":
      return findTasks(organizationId, intent, profile);
    case "offer":
      return findOffers(organizationId, intent);
    case "invoice":
      return findInvoices(organizationId, intent);
  }
}

export async function resolveJarvisReadRequest(input: {
  question: string;
  context?: JarvisSurfaceContext;
  organizationId: string;
  accessProfile: JarvisAccessProfile;
}): Promise<JarvisReadResponse | undefined> {
  const intent = resolveJarvisReadIntent(input.question, input.context);
  if (!intent) return undefined;

  const authorization = authorizeJarvisQuestion(input.question, input.accessProfile);
  if (!authorization.allowed) {
    return {
      type: "refusal",
      topicId: `records.${intent.kind}.refused`,
      message: getAuthorizationRefusal(authorization),
      deterministic: true,
    };
  }

  const actionDecision = getJarvisReadAccessDecision(intent.kind, input.accessProfile);
  if (!actionDecision.permitted || !actionDecision.executable) {
    return {
      type: "refusal",
      topicId: `records.${intent.kind}.refused`,
      message: "Deine aktuelle WorkPilot-Rolle darf diese Daten nicht über JARVIS suchen oder öffnen.",
      deterministic: true,
    };
  }

  const allRecords = await loadRecords(input.organizationId, intent, input.accessProfile);
  const records = allRecords.slice(0, 5);
  const labels = KIND_LABELS[intent.kind];
  if (records.length === 0) {
    const filterLabel =
      intent.filter === "overdue"
        ? "überfälligen "
        : intent.filter === "open"
          ? "offenen "
          : intent.filter === "today"
            ? "heutigen "
            : "";
    return {
      type: "unknown",
      topicId: `records.${intent.kind}.empty`,
      message: `Ich habe keine passenden ${filterLabel}${labels.plural} in deinem erlaubten Bereich gefunden.`,
      deterministic: true,
    };
  }

  const hasMore = allRecords.length > records.length;
  const message =
    records.length === 1
      ? `${labels.singular} gefunden: ${records[0].title}. ${records[0].subtitle}. ${records[0].summary}. Status: ${records[0].status}.`
      : `Ich habe ${records.length}${hasMore ? " von mehreren" : ""} passende ${labels.plural} in deinem erlaubten Bereich gefunden.`;

  return {
    type: "answer",
    topicId: `records.${intent.kind}.${intent.summarize ? "summary" : "search"}`,
    message: message.replace(/\s+\./g, "."),
    records,
    deterministic: true,
  };
}
