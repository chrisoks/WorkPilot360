import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma, type User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type AutomationRunInput = {
  projectId?: string;
  projectNumber?: string;
  projectTitle?: string;
  customerName?: string;
  monthKey?: string;
  dateKey?: string;
  contextKey?: string;
  recipientEmail?: string;
  beforeImageKeys?: string[];
  afterImageKeys?: string[];
};

type ProjectRow = {
  id: string;
  projectNumber: string;
  title: string;
  customer: string | null;
  contactId: string | null;
  contactPersonId: string | null;
  addressContactId: string | null;
  trade: string | null;
};

type TimeEntryRow = {
  projectId: string;
  date: string;
};

type ProjectLogbookEntryRow = {
  id: string;
  projectId: string;
  title: string | null;
  body: string;
  attachments: unknown;
  projectMonth: string | null;
  createdAt: Date;
};

type ContactRow = {
  id: string;
  email: string | null;
  parentCompanyId: string | null;
  parentCompanyName: string | null;
  companyName: string | null;
  isActivityReportRecipient: boolean | null;
  isInvoiceRecipient: boolean | null;
  isMainContact: boolean | null;
};

type LogbookAttachment = {
  name: string;
  type: "Bild" | "Dokument";
  dataUrl?: string;
};

type SchedulerState = {
  timer?: ReturnType<typeof setInterval>;
  baseUrl?: string;
  isRunning?: boolean;
};

const WINTER_SERVICE_SCHEDULER_KEY = "__workpilot360WinterServiceScheduler";
const schedulerState = (globalThis as typeof globalThis & { [WINTER_SERVICE_SCHEDULER_KEY]?: SchedulerState })[
  WINTER_SERVICE_SCHEDULER_KEY
] ??= {};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getRequestActor(users: User[], actorId: unknown) {
  const cleanActorId = cleanText(actorId);
  if (!cleanActorId) return null;
  const actor = users.find((candidate) => candidate.id === cleanActorId);
  return actor?.isActive ? actor : null;
}

function unauthorizedActorResponse() {
  return NextResponse.json({ error: "Aktiver Benutzer erforderlich." }, { status: 401 });
}

function cleanStringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => cleanText(item)).filter(Boolean) : [];
}

function cleanAttachments(value: unknown): LogbookAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<LogbookAttachment[]>((attachments, item) => {
    if (!item || typeof item !== "object") return attachments;
    const candidate = item as Partial<LogbookAttachment>;
    const name = cleanText(candidate.name);
    const dataUrl = cleanText(candidate.dataUrl);
    const type = candidate.type === "Bild" ? "Bild" : candidate.type === "Dokument" ? "Dokument" : "";
    if (!name || !type) return attachments;
    attachments.push({ name, type, dataUrl });
    return attachments;
  }, []);
}

function getMonthKey(dateKey: string) {
  return /^\d{4}-\d{2}/.test(dateKey) ? dateKey.slice(0, 7) : "";
}

function getLogEntryDay(entry: ProjectLogbookEntryRow) {
  return entry.createdAt.toISOString().slice(0, 10);
}

function getAttachmentKeys(entries: ProjectLogbookEntryRow[], projectId: string, category: string, dateKey: string) {
  return entries
    .filter((entry) => entry.projectId === projectId && entry.title === `Bilder: ${category}`)
    .filter((entry) => getLogEntryDay(entry) === dateKey)
    .flatMap((entry) =>
      cleanAttachments(entry.attachments)
        .map((attachment, index) => ({ attachment, key: `${entry.id}:${index}:${attachment.name}` }))
        .filter((item) => item.attachment.type === "Bild" && item.attachment.dataUrl)
    );
}

function getLatestAttachmentDate(entries: ProjectLogbookEntryRow[], projectId: string, category: string, dateKey: string) {
  return entries
    .filter((entry) => entry.projectId === projectId && entry.title === `Bilder: ${category}`)
    .filter((entry) => getLogEntryDay(entry) === dateKey)
    .reduce<Date | null>((latest, entry) => (!latest || entry.createdAt > latest ? entry.createdAt : latest), null);
}

function getRecipient(project: ProjectRow, contacts: ContactRow[]) {
  const projectContact = contacts.find((contact) => contact.id === project.contactId);
  const relatedContacts = contacts.filter((contact) => {
    if ([project.contactId, project.contactPersonId, project.addressContactId].includes(contact.id)) return true;
    if (projectContact?.companyName && contact.parentCompanyName === projectContact.companyName) return true;
    if (project.contactId && contact.parentCompanyId === project.contactId) return true;
    return false;
  });
  return [
    ...relatedContacts.filter((contact) => contact.isActivityReportRecipient),
    ...relatedContacts.filter((contact) => contact.isInvoiceRecipient),
    ...relatedContacts.filter((contact) => contact.isMainContact),
    contacts.find((contact) => contact.id === project.contactPersonId),
    contacts.find((contact) => contact.id === project.addressContactId),
    projectContact,
  ].find((contact) => cleanText(contact?.email))?.email ?? "";
}

async function ensureWinterServiceAutomationTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "WinterServiceAutomationSetting" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL UNIQUE,
      "enabled" BOOLEAN NOT NULL DEFAULT false,
      "senderUserId" TEXT NOT NULL DEFAULT '',
      "notificationUserIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function ensureAutomationReadTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "DocumentMailDispatch" (
      "id" TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "documentKind" TEXT NOT NULL,
      "documentId" TEXT NOT NULL,
      "documentNumber" TEXT NOT NULL,
      "projectId" TEXT NOT NULL DEFAULT '',
      "projectNumber" TEXT NOT NULL DEFAULT '',
      "projectTitle" TEXT NOT NULL DEFAULT '',
      "customerName" TEXT NOT NULL DEFAULT '',
      "senderUserId" TEXT NOT NULL,
      "senderName" TEXT NOT NULL,
      "senderEmail" TEXT NOT NULL,
      "toRecipients" TEXT NOT NULL,
      "ccRecipients" TEXT NOT NULL DEFAULT '',
      "bccRecipients" TEXT NOT NULL DEFAULT '',
      "subject" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "attachPdf" BOOLEAN NOT NULL DEFAULT true,
      "provider" TEXT NOT NULL DEFAULT 'microsoft365',
      "status" TEXT NOT NULL DEFAULT 'queued',
      "providerMessageId" TEXT NOT NULL DEFAULT '',
      "errorMessage" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function getSettings(organizationId: string) {
  await ensureWinterServiceAutomationTable();
  const rows = await prisma.$queryRaw<Array<{
    enabled: boolean;
    senderUserId: string;
    notificationUserIds: unknown;
  }>>`
    SELECT "enabled", "senderUserId", "notificationUserIds"
    FROM "WinterServiceAutomationSetting"
    WHERE "organizationId" = ${organizationId}
    LIMIT 1
  `;
  return {
    enabled: Boolean(rows[0]?.enabled),
    senderUserId: cleanText(rows[0]?.senderUserId),
    notificationUserIds: cleanStringList(rows[0]?.notificationUserIds),
  };
}

async function upsertSettings(organizationId: string, input: Record<string, unknown>) {
  await ensureWinterServiceAutomationTable();
  const enabled = Boolean(input.enabled);
  const senderUserId = cleanText(input.senderUserId);
  const notificationUserIds = cleanStringList(input.notificationUserIds);

  await prisma.$executeRaw`
    INSERT INTO "WinterServiceAutomationSetting" (
      "id", "organizationId", "enabled", "senderUserId", "notificationUserIds", "updatedAt"
    ) VALUES (
      ${randomUUID()}, ${organizationId}, ${enabled}, ${senderUserId}, ${JSON.stringify(notificationUserIds)}::jsonb, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("organizationId") DO UPDATE SET
      "enabled" = EXCLUDED."enabled",
      "senderUserId" = EXCLUDED."senderUserId",
      "notificationUserIds" = EXCLUDED."notificationUserIds",
      "updatedAt" = CURRENT_TIMESTAMP
  `;

  return getSettings(organizationId);
}

async function ensureNotificationLinkColumns() {
  await prisma.$executeRaw`
    ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "linkTarget" TEXT,
    ADD COLUMN IF NOT EXISTS "linkTargetId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkLabel" TEXT
  `;
}

async function addProjectLogbookEntry(input: {
  organizationId: string;
  projectId: string;
  title: string;
  body: string;
}) {
  await prisma.$executeRaw`
    INSERT INTO "ProjectLogbookEntry" (
      "id", "organizationId", "projectId", "title", "body", "author", "colleague", "visibleFor", "attachments"
    ) VALUES (
      ${randomUUID()}, ${input.organizationId}, ${input.projectId}, ${input.title}, ${input.body},
      ${"System"}, ${""}, ${JSON.stringify(["Geschaeftsfuehrer", "Vertriebler", "Niederlassungsleiter", "Buchhaltung"])}::jsonb,
      ${JSON.stringify([])}::jsonb
    )
  `;
}

async function notifyAutomationFailure(input: {
  organizationId: string;
  userIds: string[];
  subject: string;
  body: string;
}) {
  await ensureNotificationLinkColumns();
  for (const userId of input.userIds) {
    await prisma.$executeRaw`
      INSERT INTO "Notification" (
        "id", "organizationId", "userId", "channel", "subject", "body", "linkTarget", "linkLabel"
      ) VALUES (
        ${randomUUID()}, ${input.organizationId}, ${userId}, ${"system"},
        ${input.subject}, ${input.body}, ${"winterService"}, ${"Winterdienst öffnen"}
      )
    `;
  }
}

async function getUserEmails(userIds: string[]) {
  if (userIds.length === 0) return [];
  const rows = await prisma.$queryRaw<Array<{ email: string }>>`
    SELECT email
    FROM "User"
    WHERE id IN (${Prisma.join(userIds)})
      AND "isActive" = true
  `;
  return rows.map((row) => cleanText(row.email)).filter(Boolean);
}

async function discoverAutomationRuns(organizationId: string): Promise<AutomationRunInput[]> {
  await ensureAutomationReadTables();
  const [projects, timeEntries, logEntries, contacts, dispatches] = await Promise.all([
    prisma.$queryRaw<ProjectRow[]>`
      SELECT id, "projectNumber", title, customer, "contactId", "contactPersonId", "addressContactId", trade
      FROM "WorkPilotProject"
      WHERE "organizationId" = ${organizationId}
        AND LOWER(COALESCE(trade, '')) LIKE '%winterdienst%'
    `,
    prisma.$queryRaw<TimeEntryRow[]>`
      SELECT DISTINCT "projectId", date
      FROM "ProjectTimeEntry"
      WHERE "organizationId" = ${organizationId}
        AND mode = 'project'
        AND "deletedAt" IS NULL
        AND "projectId" <> ''
    `,
    prisma.$queryRaw<ProjectLogbookEntryRow[]>`
      SELECT id, "projectId", title, body, attachments, "projectMonth", "createdAt"
      FROM "ProjectLogbookEntry"
      WHERE "organizationId" = ${organizationId}
        AND (
          title IN ('Bilder: Vorherbilder', 'Bilder: Nachherbilder', 'Dokumente: Tätigkeitsberichte')
          OR title LIKE 'Winterdienst:%'
        )
    `,
    prisma.$queryRaw<ContactRow[]>`
      SELECT id, email, "parentCompanyId", "parentCompanyName", "companyName",
             "isActivityReportRecipient", "isInvoiceRecipient", "isMainContact"
      FROM "Contact"
      WHERE "organizationId" = ${organizationId}
    `,
    prisma.$queryRaw<Array<{ documentId: string; status: string }>>`
      SELECT "documentId", status
      FROM "DocumentMailDispatch"
      WHERE "organizationId" = ${organizationId}
        AND "documentKind" = 'activityReport'
        AND status = 'sent'
    `,
  ]);

  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const sentDocumentIds = dispatches.map((dispatch) => cleanText(dispatch.documentId).toLowerCase());
  const now = Date.now();

  return timeEntries.reduce<AutomationRunInput[]>((runs, entry) => {
    const project = projectMap.get(entry.projectId);
    const dateKey = cleanText(entry.date);
    if (!project || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return runs;

    const contextKey = `Winterdienst:${project.id}:${dateKey}`;
    const contextNeedle = contextKey.toLowerCase();
    const monthKey = getMonthKey(dateKey);
    const beforeKeys = getAttachmentKeys(logEntries, project.id, "Vorherbilder", dateKey).map((item) => item.key);
    const afterItems = getAttachmentKeys(logEntries, project.id, "Nachherbilder", dateKey);
    const afterKeys = afterItems.map((item) => item.key);
    const latestAfterImageDate = getLatestAttachmentDate(logEntries, project.id, "Nachherbilder", dateKey);
    const hasExistingReport = logEntries.some((logEntry) => {
      if (logEntry.projectId !== project.id || logEntry.title !== "Dokumente: Tätigkeitsberichte") return false;
      if (!cleanText(logEntry.body).toLowerCase().includes(contextNeedle)) return false;
      return cleanAttachments(logEntry.attachments).some(
        (attachment) => attachment.type === "Dokument" && cleanText(attachment.dataUrl).startsWith("data:application/pdf")
      );
    });
    const wasSent = sentDocumentIds.some((documentId) => documentId.includes(contextNeedle));
    const recipientEmail = getRecipient(project, contacts);

    if (beforeKeys.length === 0 || afterKeys.length === 0) return runs;
    if (!latestAfterImageDate || now - latestAfterImageDate.getTime() < 60 * 60 * 1000) return runs;
    if (hasExistingReport || wasSent) return runs;
    if (!recipientEmail) return runs;

    runs.push({
      projectId: project.id,
      projectNumber: project.projectNumber,
      projectTitle: project.title,
      customerName: project.customer ?? "",
      monthKey,
      dateKey,
      contextKey,
      recipientEmail,
      beforeImageKeys: beforeKeys,
      afterImageKeys: afterKeys,
    });
    return runs;
  }, []);
}

function getBaseUrl(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

async function runScheduledAutomation(baseUrl: string) {
  if (schedulerState.isRunning) return;
  schedulerState.isRunning = true;
  try {
    await fetch(`${baseUrl}/api/winter-service-automation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "scheduler" }),
    });
  } catch {
    // The next interval can retry; failures inside the automation run create notifications.
  } finally {
    schedulerState.isRunning = false;
  }
}

function syncScheduler(settings: { enabled: boolean }, baseUrl: string) {
  schedulerState.baseUrl = baseUrl;
  if (!settings.enabled) {
    if (schedulerState.timer) {
      clearInterval(schedulerState.timer);
      schedulerState.timer = undefined;
    }
    return;
  }
  if (schedulerState.timer) return;
  schedulerState.timer = setInterval(() => {
    if (schedulerState.baseUrl) void runScheduledAutomation(schedulerState.baseUrl);
  }, 10 * 60 * 1000);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, searchParams.get("actorId"));
  if (!actor) {
    return unauthorizedActorResponse();
  }
  const settings = await getSettings(organization.id);
  syncScheduler(settings, getBaseUrl(req));
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }
  const settings = await upsertSettings(organization.id, body);
  syncScheduler(settings, getBaseUrl(req));
  return NextResponse.json(settings);
}

export async function POST(req: Request) {
  const { organization, users } = await getDemoContext();
  const settings = await getSettings(organization.id);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const submittedRuns = Array.isArray(body.runs) ? (body.runs as AutomationRunInput[]) : [];
  const runs = submittedRuns.length > 0 ? submittedRuns : await discoverAutomationRuns(organization.id);
  syncScheduler(settings, getBaseUrl(req));

  if (!settings.enabled) {
    return NextResponse.json({ processed: 0, sent: 0, failed: 0, failures: [], skipped: "disabled" });
  }

  const actor = getRequestActor(users, settings.senderUserId) ?? getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }
  const actorId = actor.id;

  const failures: string[] = [];
  let sent = 0;

  for (const run of runs) {
    const projectId = cleanText(run.projectId);
    const dateKey = cleanText(run.dateKey);
    const monthKey = cleanText(run.monthKey);
    const contextKey = cleanText(run.contextKey);
    const recipientEmail = cleanText(run.recipientEmail);
    const projectNumber = cleanText(run.projectNumber);

    if (!projectId || !dateKey || !monthKey || !contextKey || !recipientEmail) {
      failures.push(`${projectNumber || projectId || "Unbekannt"} ${dateKey || ""}: Daten unvollständig`);
      continue;
    }

    try {
      const reportResponse = await fetch(new URL("/api/activity-reports", req.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId,
          projectId,
          month: monthKey,
          reportContextKey: contextKey,
          reportContextLabel: `Winterdienst ${dateKey}`,
          beforeImageKeys: cleanStringList(run.beforeImageKeys),
          afterImageKeys: cleanStringList(run.afterImageKeys),
        }),
      });
      const reportData = await reportResponse.json().catch(() => null);
      if (!reportResponse.ok) {
        throw new Error(reportData?.error || "Tätigkeitsbericht konnte nicht erstellt werden.");
      }

      const reportAttachment = Array.isArray(reportData?.attachments)
        ? reportData.attachments.find((attachment: Record<string, unknown>) =>
            cleanText(attachment?.type) === "Dokument" && cleanText(attachment?.dataUrl)
          )
        : null;
      if (!reportAttachment) {
        throw new Error("Tätigkeitsbericht-PDF wurde nicht gefunden.");
      }

      const attachmentName = cleanText(reportAttachment.name);
      const documentNumber = attachmentName.replace(/\.pdf$/i, "") || `Winterdienst ${dateKey}`;
      const mailResponse = await fetch(new URL("/api/document-mail", req.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "activityReport",
          documentId: `${contextKey}:${attachmentName}`,
          documentNumber,
          projectId,
          projectNumber,
          projectTitle: cleanText(run.projectTitle),
          customerName: cleanText(run.customerName),
          to: recipientEmail,
          cc: "",
          bcc: "",
          subject: `Tätigkeitsbericht Winterdienst ${dateKey}`,
          body: `Hallo,\n\nanbei erhalten Sie den Tätigkeitsbericht zum Winterdiensteinsatz vom ${dateKey}.\n\nMit freundlichen Grüßen`,
          attachPdf: false,
          manualAttachments: [{ name: attachmentName, dataUrl: cleanText(reportAttachment.dataUrl) }],
          actorId,
        }),
      });
      const mailData = await mailResponse.json().catch(() => null);
      if (!mailResponse.ok) {
        throw new Error(mailData?.error || "Tätigkeitsbericht konnte nicht versendet werden.");
      }

      sent += 1;
      await addProjectLogbookEntry({
        organizationId: organization.id,
        projectId,
        title: "Winterdienst: Tätigkeitsbericht versendet",
        body: `Tätigkeitsbericht automatisch versendet. Zuordnung: ${contextKey}. Empfänger: ${recipientEmail}. Einsatzdatum: ${dateKey}.`,
      });
    } catch (error) {
      failures.push(
        `${projectNumber || projectId} ${dateKey}: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`
      );
    }
  }

  if (failures.length > 0 && settings.notificationUserIds.length > 0) {
    const subject = "Winterdienst-Automatik: Fehler beim Versand";
    const failureBody = failures.join("\n");
    await notifyAutomationFailure({
      organizationId: organization.id,
      userIds: settings.notificationUserIds,
      subject,
      body: failureBody,
    });
    const notificationEmails = await getUserEmails(settings.notificationUserIds);
    if (notificationEmails.length > 0) {
      await fetch(new URL("/api/document-mail", req.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "document",
          documentId: `winter-service-automation:${Date.now()}`,
          documentNumber: "Winterdienst-Automatik",
          projectId: "",
          projectNumber: "",
          projectTitle: "Winterdienst-Automatik",
          customerName: "",
          to: notificationEmails.join(", "),
          cc: "",
          bcc: "",
          subject,
          body: `Hallo,\n\nbei der Winterdienst-Automatik sind Fehler aufgetreten:\n\n${failureBody}\n\nBitte in WorkPilot360 unter Prozess/Automation > Winterdienst prüfen.`,
          attachPdf: false,
          manualAttachments: [],
          actorId,
        }),
      }).catch(() => null);
    }
  }

  return NextResponse.json({
    processed: runs.length,
    sent,
    failed: failures.length,
    failures,
  });
}
