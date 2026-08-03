import { Role, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getJarvisActionDecision } from "@/lib/jarvis/actions";
import { normalizeJarvisIntentText } from "@/lib/jarvis/intent-text";
import type { JarvisReadResponse, JarvisRecordResult } from "@/lib/jarvis/read-model";
import type { JarvisAccessProfile } from "@/lib/jarvis/security";
import {
  resolveJarvisOrganizationOperationsIntent,
  type JarvisOrganizationOperationsIntent,
} from "@/lib/jarvis/organization-operations-intent";

export { resolveJarvisOrganizationOperationsIntent } from "@/lib/jarvis/organization-operations-intent";

export type OrganizationOperationsSnapshot = {
  users: Array<{ id: string; firstName: string; lastName: string; planningBoard: string | null; planningGroup: string | null; weeklyCapacity: unknown; leadershipManagerId: string | null; leadershipDeputyId: string | null }>;
  absences: Array<{ userId: string; date: Date; dayPart: string; status: string; deletedAt: Date | null }>;
  planningEntries: Array<{ userId: string | null; date: string; durationMinutes: number; approvalStatus: string; deletedAt: Date | null }>;
  projects: Array<{ id: string; projectNumber: string; title: string; customer: string | null; contactId: string | null; status: string; projectType: string | null; projectKind: string | null; recurringBillingMode: string | null; timeBudgetEnabled: boolean; autoBillingEnabled: boolean; updatedAt: Date }>;
  offers: Array<{ id: string; projectId: string; offerNumber: string; status: string; customerName: string; netTotal: number; updatedAt: Date }>;
  invoices: Array<{ id: string; projectId: string; invoiceNumber: string; status: string; customerName: string; netTotal: number; serviceDate: string; plannedExecutionMonth: string; dueDate: string; isPaid: boolean; createdAt: Date; updatedAt: Date }>;
  timeEntries: Array<{ id: string; projectId: string; durationMs: bigint; invoiceId: string | null; deletedAt: Date | null; createdAt: Date }>;
  contacts: Array<{ id: string; customerNumber: string; companyName: string | null; firstName: string | null; lastName: string | null; updatedAt: Date }>;
  projectLogbookEntries: Array<{ projectId: string; createdAt: Date }>;
  customerLogbookEntries: Array<{ customerId: string; occurredAt: Date }>;
  tasks: Array<{ projectId: string | null; updatedAt: Date }>;
  offerAcceptanceRequests: Array<{ offerId: string; sentAt: Date | null; firstViewedAt: Date | null; acceptedAt: Date | null; revokedAt: Date | null }>;
};

export type OrganizationOperationsSource = {
  load(input: { organizationId: string; intent: JarvisOrganizationOperationsIntent; accessProfile: JarvisAccessProfile }): Promise<OrganizationOperationsSnapshot>;
};

function emptySnapshot(): OrganizationOperationsSnapshot {
  return { users: [], absences: [], planningEntries: [], projects: [], offers: [], invoices: [], timeEntries: [], contacts: [], projectLogbookEntries: [], customerLogbookEntries: [], tasks: [], offerAcceptanceRequests: [] };
}

function userVisibilityWhere(actor: JarvisAccessProfile["effectiveActor"]): Prisma.UserWhereInput {
  if (actor.role === Role.ADMIN || actor.role === Role.GESCHAEFTSFUEHRER) return {};
  if (actor.role === Role.FUEHRUNGSKRAFT) {
    return { OR: [{ id: actor.id }, { leadershipManagerId: actor.id }, { leadershipDeputyId: actor.id }] };
  }
  return { id: actor.id };
}

const liveSource: OrganizationOperationsSource = {
  async load({ organizationId, intent, accessProfile }) {
    const base = emptySnapshot();
    if (intent === "utilization") {
      const users = await prisma.user.findMany({
        where: {
          organizationId,
          isActive: true,
          sellableCapacityEnabled: { not: false },
          AND: [userVisibilityWhere(accessProfile.sessionActor), userVisibilityWhere(accessProfile.effectiveActor)],
        },
        select: { id: true, firstName: true, lastName: true, planningBoard: true, planningGroup: true, weeklyCapacity: true, leadershipManagerId: true, leadershipDeputyId: true },
      });
      const userIds = users.map((user) => user.id);
      const [absences, planningEntries] = userIds.length ? await Promise.all([
        prisma.absence.findMany({ where: { organizationId, userId: { in: userIds } }, select: { userId: true, date: true, dayPart: true, status: true, deletedAt: true } }),
        prisma.planningEntry.findMany({ where: { organizationId, userId: { in: userIds } }, select: { userId: true, date: true, durationMinutes: true, approvalStatus: true, deletedAt: true } }),
      ]) : [[], []];
      return { ...base, users, absences, planningEntries };
    }
    if (intent === "invoice_drafts" || intent === "revenue") {
      const invoices = await prisma.invoice.findMany({ where: { organizationId }, select: { id: true, projectId: true, invoiceNumber: true, status: true, customerName: true, netTotal: true, serviceDate: true, plannedExecutionMonth: true, dueDate: true, isPaid: true, createdAt: true, updatedAt: true } });
      return { ...base, invoices };
    }
    if (intent === "customer_revenue") {
      const [projects, contacts, invoices] = await Promise.all([
        prisma.workPilotProject.findMany({ where: { organizationId }, select: { id: true, projectNumber: true, title: true, customer: true, contactId: true, status: true, projectType: true, projectKind: true, recurringBillingMode: true, timeBudgetEnabled: true, autoBillingEnabled: true, updatedAt: true } }),
        prisma.contact.findMany({ where: { organizationId }, select: { id: true, customerNumber: true, companyName: true, firstName: true, lastName: true, updatedAt: true } }),
        prisma.invoice.findMany({ where: { organizationId }, select: { id: true, projectId: true, invoiceNumber: true, status: true, customerName: true, netTotal: true, serviceDate: true, plannedExecutionMonth: true, dueDate: true, isPaid: true, createdAt: true, updatedAt: true } }),
      ]);
      return { ...base, projects, contacts, invoices };
    }
    if (intent === "offer_rates") {
      const offerAcceptanceRequests = await prisma.offerAcceptanceRequest.findMany({ where: { organizationId }, select: { offerId: true, sentAt: true, firstViewedAt: true, acceptedAt: true, revokedAt: true } });
      return { ...base, offerAcceptanceRequests };
    }
    const projects = await prisma.workPilotProject.findMany({ where: { organizationId }, select: { id: true, projectNumber: true, title: true, customer: true, contactId: true, status: true, projectType: true, projectKind: true, recurringBillingMode: true, timeBudgetEnabled: true, autoBillingEnabled: true, updatedAt: true } });
    const needsOffers = intent === "missing_offer_projects" || intent === "critical_projects" || intent === "inactive_customers";
    const needsInvoices = intent === "critical_projects" || intent === "inactive_customers";
    const needsTimes = intent === "unbilled_projects" || intent === "critical_projects" || intent === "inactive_customers";
    const [offers, invoices, timeEntries] = await Promise.all([
      needsOffers ? prisma.offer.findMany({ where: { organizationId }, select: { id: true, projectId: true, offerNumber: true, status: true, customerName: true, netTotal: true, updatedAt: true } }) : Promise.resolve([]),
      needsInvoices ? prisma.invoice.findMany({ where: { organizationId }, select: { id: true, projectId: true, invoiceNumber: true, status: true, customerName: true, netTotal: true, serviceDate: true, plannedExecutionMonth: true, dueDate: true, isPaid: true, createdAt: true, updatedAt: true } }) : Promise.resolve([]),
      needsTimes ? prisma.projectTimeEntry.findMany({ where: { organizationId }, select: { id: true, projectId: true, durationMs: true, invoiceId: true, deletedAt: true, createdAt: true } }) : Promise.resolve([]),
    ]);
    if (intent !== "inactive_customers") return { ...base, projects, offers, invoices, timeEntries };
    const [contacts, projectLogbookEntries, customerLogbookEntries, tasks] = await Promise.all([
      prisma.contact.findMany({ where: { organizationId }, select: { id: true, customerNumber: true, companyName: true, firstName: true, lastName: true, updatedAt: true } }),
      prisma.projectLogbookEntry.findMany({ where: { organizationId }, select: { projectId: true, createdAt: true } }),
      prisma.customerLogbookEntry.findMany({ where: { organizationId }, select: { customerId: true, occurredAt: true } }),
      prisma.task.findMany({ where: { organizationId }, select: { projectId: true, updatedAt: true } }),
    ]);
    return { ...base, projects, offers, invoices, timeEntries, contacts, projectLogbookEntries, customerLogbookEntries, tasks };
  },
};

function normalize(value: string | null | undefined) {
  return normalizeJarvisIntentText(value ?? "").replace(/\s+/g, " ").trim();
}

function actionFor(intent: JarvisOrganizationOperationsIntent) {
  if (intent === "invoice_drafts" || intent === "revenue" || intent === "customer_revenue") return "invoice.read";
  if (intent === "offer_rates") return "offer.read";
  if (intent === "inactive_customers") return "contact.read";
  if (intent === "utilization") return "planning.analysis.read";
  return "project.read";
}

function actorCanViewUtilizationUser(actor: JarvisAccessProfile["effectiveActor"], user: OrganizationOperationsSnapshot["users"][number]) {
  if (actor.role === Role.ADMIN || actor.role === Role.GESCHAEFTSFUEHRER) return true;
  if (actor.role === Role.FUEHRUNGSKRAFT) return user.id === actor.id || user.leadershipManagerId === actor.id || user.leadershipDeputyId === actor.id;
  return user.id === actor.id;
}

function visibleUtilizationUsers(profile: JarvisAccessProfile, users: OrganizationOperationsSnapshot["users"]) {
  return users.filter((user) => actorCanViewUtilizationUser(profile.sessionActor, user) && actorCanViewUtilizationUser(profile.effectiveActor, user));
}

function utilizationScopeLabel(profile: JarvisAccessProfile) {
  const roles = [profile.sessionActor.role, profile.effectiveActor.role];
  if (roles.every((role) => role === Role.ADMIN || role === Role.GESCHAEFTSFUEHRER)) return "das gesamte Unternehmen";
  if (roles.every((role) => role === Role.ADMIN || role === Role.GESCHAEFTSFUEHRER || role === Role.FUEHRUNGSKRAFT)) return "deinen zugeordneten Führungs- und Vertretungsbereich einschließlich dir";
  return "deine eigene Auslastung";
}

function isInactiveProject(status: string) {
  const value = normalize(status);
  return value.includes("archiviert") || value.includes("abgeschlossen") || value.includes("geloscht");
}

function isOperationalProject(status: string) {
  if (isInactiveProject(status)) return false;
  const value = normalize(status);
  return !["lead", "klarung", "angebotserstellung", "angebot erstellen", "entscheidung offen"].some((marker) => value.includes(marker));
}

function isValidOffer(status: string) {
  const value = normalize(status);
  return !["entwurf", "verlor", "abgelehnt", "storn", "geloscht", "deleted"].some((marker) => value.includes(marker));
}

function isOpenOffer(status: string) {
  const value = normalize(status);
  return isValidOffer(status) && !["gewonnen", "angenommen", "akzeptiert"].some((marker) => value.includes(marker));
}

function isFinancialInvoice(status: string) {
  const value = normalize(status);
  return value !== "entwurf" && !["storn", "geloscht", "deleted"].some((marker) => value.includes(marker));
}

function money(value: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}

function dateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function projectRecord(project: OrganizationOperationsSnapshot["projects"][number], status: string, summary: string): JarvisRecordResult {
  return { id: `organization-operations-${project.id}`, kind: "project", title: `${project.projectNumber} · ${project.title}`, subtitle: project.customer ?? "Ohne Kunde", summary, status, target: { kind: "project", id: project.id } };
}

function contactName(contact: OrganizationOperationsSnapshot["contacts"][number]) {
  return contact.companyName?.trim() || [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() || contact.customerNumber;
}

function startOfWeek(now: Date, offsetWeeks = 0) {
  const today = new Date(`${dateKey(now)}T12:00:00Z`);
  const day = today.getUTCDay() || 7;
  today.setUTCDate(today.getUTCDate() - day + 1 + offsetWeeks * 7);
  return today;
}

function rangeDateKeys(start: Date, days: number) {
  return Array.from({ length: days }, (_, index) => {
    const current = new Date(start);
    current.setUTCDate(current.getUTCDate() + index);
    return current.toISOString().slice(0, 10);
  });
}

const WEEKDAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function capacityForDate(weeklyCapacity: unknown, date: string) {
  const value = weeklyCapacity && typeof weeklyCapacity === "object" ? weeklyCapacity as Record<string, unknown> : {};
  const weekday = WEEKDAY_KEYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const hours = Number(value[weekday] ?? 0);
  return Number.isFinite(hours) && hours > 0 ? hours : 0;
}

function parseRequestedRange(question: string, now: Date) {
  const value = normalize(question);
  const nextWeek = /\bnachste woche\b/.test(value);
  const monthNames = ["januar", "februar", "marz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
  const monthIndex = monthNames.findIndex((name) => value.includes(name));
  if (monthIndex >= 0) {
    const yearMatch = value.match(/\b(20\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : Number(dateKey(now).slice(0, 4));
    const start = new Date(Date.UTC(year, monthIndex, 1, 12));
    const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    return { keys: rangeDateKeys(start, days), label: `${monthNames[monthIndex][0].toUpperCase()}${monthNames[monthIndex].slice(1)} ${year}` };
  }
  const start = startOfWeek(now, nextWeek ? 1 : 0);
  return { keys: rangeDateKeys(start, 7), label: nextWeek ? "nächste Woche" : "aktuelle Woche" };
}

function latest(current: Date | undefined, candidate: Date) {
  return !current || candidate > current ? candidate : current;
}

export async function resolveJarvisOrganizationOperationsRequest(input: { question: string; organizationId: string; accessProfile: JarvisAccessProfile; now?: Date; source?: OrganizationOperationsSource }): Promise<JarvisReadResponse | undefined> {
  const intent = resolveJarvisOrganizationOperationsIntent(input.question);
  if (!intent) return undefined;
  const decision = getJarvisActionDecision(actionFor(intent), input.accessProfile);
  if (!decision.executable) return { type: "refusal", topicId: `management.operations.${intent}`, message: "Deine aktuelle WorkPilot-Rolle darf diese organisationsweite Auswertung nicht über JARVIS abrufen.", deterministic: true };

  const snapshot = await (input.source ?? liveSource).load({ organizationId: input.organizationId, intent, accessProfile: input.accessProfile });
  const now = input.now ?? new Date();
  const activeProjects = snapshot.projects.filter((project) => !isInactiveProject(project.status));
  const operationalProjects = activeProjects.filter((project) => isOperationalProject(project.status));
  const offersByProject = new Map<string, typeof snapshot.offers>();
  snapshot.offers.forEach((offer) => offersByProject.set(offer.projectId, [...(offersByProject.get(offer.projectId) ?? []), offer]));
  const invoicesByProject = new Map<string, typeof snapshot.invoices>();
  snapshot.invoices.forEach((invoice) => invoicesByProject.set(invoice.projectId, [...(invoicesByProject.get(invoice.projectId) ?? []), invoice]));
  const unbilledByProject = new Map<string, typeof snapshot.timeEntries>();
  snapshot.timeEntries.filter((entry) => !entry.deletedAt && !entry.invoiceId && entry.durationMs > 0n).forEach((entry) => unbilledByProject.set(entry.projectId, [...(unbilledByProject.get(entry.projectId) ?? []), entry]));

  if (intent === "invoice_drafts") {
    const drafts = snapshot.invoices.filter((invoice) => normalize(invoice.status) === "entwurf").sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const records: JarvisRecordResult[] = drafts.slice(0, 20).map((invoice) => ({ id: `invoice-draft-${invoice.id}`, kind: "invoice", title: invoice.invoiceNumber, subtitle: invoice.customerName || "Ohne Kunde", summary: `${money(invoice.netTotal)} netto`, status: "Entwurf", target: { kind: "invoice", id: invoice.id, projectId: invoice.projectId } }));
    return { type: "answer", topicId: "management.operations.invoice-drafts", message: drafts.length ? `${drafts.length === 1 ? "Ein aktiver Rechnungsentwurf ist" : `${drafts.length} aktive Rechnungsentwürfe sind`} organisationsweit vorhanden.${drafts.length > 20 ? " Die 20 zuletzt geladenen Treffer werden angezeigt." : ""}` : "Aktuell sind organisationsweit keine aktiven Rechnungsentwürfe vorhanden.", records, structured: { title: "Rechnungsentwürfe · Unternehmen", facts: [{ label: "Aktive Entwürfe", value: String(drafts.length), tone: drafts.length ? "warning" : "positive" }, { label: "Netto gesamt", value: money(drafts.reduce((sum, item) => sum + item.netTotal, 0)) }] }, deterministic: true };
  }

  if (intent === "utilization") {
    const range = parseRequestedRange(input.question, now);
    const keySet = new Set(range.keys);
    const scopedUsers = visibleUtilizationUsers(input.accessProfile, snapshot.users);
    const scopedUserIds = new Set(scopedUsers.map((user) => user.id));
    const approvedAbsences = snapshot.absences.filter((absence) => scopedUserIds.has(absence.userId) && !absence.deletedAt && normalize(absence.status) === "genehmigt");
    const rows = scopedUsers.map((user) => {
      let capacity = range.keys.reduce((sum, key) => sum + capacityForDate(user.weeklyCapacity, key), 0);
      approvedAbsences.filter((absence) => absence.userId === user.id && keySet.has(dateKey(absence.date))).forEach((absence) => { const base = capacityForDate(user.weeklyCapacity, dateKey(absence.date)); capacity -= absence.dayPart === "full" ? base : base / 2; });
      const planned = snapshot.planningEntries.filter((entry) => scopedUserIds.has(entry.userId ?? "") && entry.userId === user.id && keySet.has(entry.date) && !entry.deletedAt && normalize(entry.approvalStatus) === "confirmed").reduce((sum, entry) => sum + entry.durationMinutes / 60, 0);
      return { ...user, capacity: Math.max(0, capacity), planned, percent: capacity > 0 ? planned / capacity * 100 : planned > 0 ? 999 : 0 };
    });
    const value = normalize(input.question);
    const selected = rows.filter((row) => /zu wenig arbeit/.test(value) ? row.percent < 70 : /uberlastet/.test(value) ? row.percent > 100 : true).sort((a, b) => /zu wenig arbeit/.test(value) ? a.percent - b.percent : b.percent - a.percent);
    const groupMode = /planungsgruppe/.test(value);
    const items = groupMode ? [...selected.reduce((groups, row) => { const key = row.planningGroup || "Ohne Planungsgruppe"; const current = groups.get(key) ?? { capacity: 0, planned: 0 }; current.capacity += row.capacity; current.planned += row.planned; groups.set(key, current); return groups; }, new Map<string, { capacity: number; planned: number }>())].map(([name, row]) => `${name}: ${row.planned.toFixed(1)} von ${row.capacity.toFixed(1)} Std. geplant (${row.capacity > 0 ? Math.round(row.planned / row.capacity * 100) : 0} %).`) : selected.map((row) => `${row.firstName} ${row.lastName}: ${row.planned.toFixed(1)} von ${row.capacity.toFixed(1)} Std. geplant (${Math.round(row.percent)} %)${row.planningGroup ? ` · ${row.planningGroup}` : ""}.`);
    return { type: "answer", topicId: "management.operations.utilization", message: `Die Auslastung für ${range.label} wurde für ${utilizationScopeLabel(input.accessProfile)} aus bestätigten, nicht gelöschten Planungen gegen die persönliche Wochenkapazität abzüglich genehmigter Abwesenheiten berechnet. ${selected.length} passende ${groupMode ? "Planungsgruppen" : "Mitarbeiter"} gefunden.`, structured: { title: `Auslastung · ${range.label}`, sections: [{ title: "Sichtbarer Bereich", items: [`Ausgewertet wird ausschließlich ${utilizationScopeLabel(input.accessProfile)}.`] }, { title: "Planungsstand", items: items.slice(0, 30), tone: selected.some((row) => row.percent > 100) ? "warning" : "neutral" }, { title: "Datenbasis", items: ["Bestätigte Planungen; Terminwünsche sind bis zur Freigabe nicht als feste Auslastung enthalten.", "Kapazität aus dem Mitarbeiterprofil; genehmigte Ganz- und Halbtagsabwesenheiten reduzieren sie."] }] }, deterministic: true };
  }

  if (intent === "unbilled_projects") {
    const projects = activeProjects.filter((project) => (unbilledByProject.get(project.id)?.length ?? 0) > 0);
    const records = projects.slice(0, 20).map((project) => { const entries = unbilledByProject.get(project.id) ?? []; const hours = entries.reduce((sum, entry) => sum + Number(entry.durationMs) / 3_600_000, 0); return projectRecord(project, "Abrechnung prüfen", `${entries.length} unberechnete Zeiteinträge · ${hours.toFixed(2)} Std.`); });
    return { type: "answer", topicId: "management.operations.unbilled-projects", message: projects.length ? `${projects.length} aktive Projekte enthalten erfasste, nicht gelöschte Zeiten ohne Rechnungszuordnung.` : "Aktuell wurden keine aktiven Projekte mit erfassten Zeiten ohne Rechnungszuordnung gefunden.", records, deterministic: true };
  }

  if (intent === "missing_offer_projects") {
    const projects = operationalProjects.filter((project) => !project.timeBudgetEnabled && !project.autoBillingEnabled && !(offersByProject.get(project.id) ?? []).some((offer) => isValidOffer(offer.status)));
    return { type: "answer", topicId: "management.operations.missing-offer-projects", message: projects.length ? `${projects.length} aktive Projekte haben weder ein gültiges Angebot noch eine dokumentierte Zeitbudget- oder Autoabrechnungsbasis.` : "Aktuell wurden keine aktiven Projekte ohne gültige Angebots- oder dokumentierte Abrechnungsbasis gefunden.", records: projects.slice(0, 20).map((project) => projectRecord(project, "Angebotsbasis fehlt", "Kein gültiges Angebot; kein Zeitbudget und keine Autoabrechnung hinterlegt.")), deterministic: true };
  }

  if (intent === "inactive_customers") {
    const threshold = new Date(now.getTime() - 30 * 86_400_000);
    const projectById = new Map(snapshot.projects.map((project) => [project.id, project]));
    const contactActivity = new Map(snapshot.contacts.map((contact) => [contact.id, contact.updatedAt]));
    snapshot.projects.forEach((project) => { if (project.contactId) contactActivity.set(project.contactId, latest(contactActivity.get(project.contactId), project.updatedAt)); });
    snapshot.offers.forEach((offer) => { const contactId = projectById.get(offer.projectId)?.contactId; if (contactId) contactActivity.set(contactId, latest(contactActivity.get(contactId), offer.updatedAt)); });
    snapshot.invoices.forEach((invoice) => { const contactId = projectById.get(invoice.projectId)?.contactId; if (contactId) contactActivity.set(contactId, latest(contactActivity.get(contactId), invoice.updatedAt)); });
    snapshot.timeEntries.forEach((entry) => { const contactId = projectById.get(entry.projectId)?.contactId; if (contactId) contactActivity.set(contactId, latest(contactActivity.get(contactId), entry.createdAt)); });
    snapshot.projectLogbookEntries.forEach((entry) => { const contactId = projectById.get(entry.projectId)?.contactId; if (contactId) contactActivity.set(contactId, latest(contactActivity.get(contactId), entry.createdAt)); });
    snapshot.customerLogbookEntries.forEach((entry) => contactActivity.set(entry.customerId, latest(contactActivity.get(entry.customerId), entry.occurredAt)));
    snapshot.tasks.forEach((task) => { const contactId = task.projectId ? projectById.get(task.projectId)?.contactId : undefined; if (contactId) contactActivity.set(contactId, latest(contactActivity.get(contactId), task.updatedAt)); });
    const openOfferContactIds = new Set(snapshot.offers.filter((offer) => isOpenOffer(offer.status)).map((offer) => projectById.get(offer.projectId)?.contactId).filter(Boolean));
    const contacts = snapshot.contacts.filter((contact) => openOfferContactIds.has(contact.id) && (contactActivity.get(contact.id) ?? new Date(0)) < threshold).sort((a, b) => (contactActivity.get(a.id)?.getTime() ?? 0) - (contactActivity.get(b.id)?.getTime() ?? 0));
    const records: JarvisRecordResult[] = contacts.slice(0, 20).map((contact) => ({ id: `inactive-customer-${contact.id}`, kind: "customer", title: contactName(contact), subtitle: contact.customerNumber, summary: `Letzte belegte WorkPilot-Aktivität: ${dateKey(contactActivity.get(contact.id) ?? new Date(0))}`, status: "Offenes Angebot · >30 Tage ohne Aktivität", target: { kind: "customer", id: contact.id } }));
    return { type: "answer", topicId: "management.operations.inactive-customers", message: contacts.length ? `${contacts.length} Kunden haben mindestens ein offenes Angebot, aber seit mehr als 30 Tagen keine belegte WorkPilot-Aktivität.` : "Aktuell gibt es keinen Kunden mit offenem Angebot und mehr als 30 Tagen ohne belegte WorkPilot-Aktivität.", records, structured: contacts.length ? { title: "Offene Angebote ohne Aktivität", sections: [{ title: "Berücksichtigte Aktivität", items: ["Kontakt- und Projektänderungen, Angebote, Rechnungen, Projektzeiten, Aufgaben sowie Kunden- und Projektlogbuch.", "Die Aussage bezieht sich auf WorkPilot-Aktivität; externe Telefonate oder E-Mails ohne Protokoll sind nicht ableitbar."] }] } : undefined, deterministic: true };
  }

  if (intent === "offer_rates") {
    const sent = snapshot.offerAcceptanceRequests.filter((request) => request.sentAt && !request.revokedAt);
    const viewed = sent.filter((request) => request.firstViewedAt || request.acceptedAt);
    const accepted = sent.filter((request) => request.acceptedAt);
    const percent = (count: number) => sent.length ? `${(count / sent.length * 100).toFixed(1)} %` : "nicht berechenbar";
    return { type: "answer", topicId: "management.operations.offer-rates", message: sent.length ? `Von ${sent.length} aktiven versendeten Angebotsfreigaben wurden ${viewed.length} geöffnet und ${accepted.length} angenommen.` : "Es sind keine aktiven versendeten Angebotsfreigaben vorhanden; Öffnungs- und Annahmequote sind deshalb nicht belastbar berechenbar.", structured: { title: "Angebotsquoten", facts: [{ label: "Versendet", value: String(sent.length) }, { label: "Öffnungsquote", value: percent(viewed.length) }, { label: "Annahmequote", value: percent(accepted.length) }], sections: [{ title: "Datenbasis", items: ["Nur über den WorkPilot-Angebotsfreigabelink versendete, nicht widerrufene Vorgänge sind enthalten."] }] }, deterministic: true };
  }

  if (intent === "customer_revenue") {
    const projectById = new Map(snapshot.projects.map((project) => [project.id, project]));
    const contactById = new Map(snapshot.contacts.map((contact) => [contact.id, contact]));
    const rows = new Map<string, { name: string; contactId: string | null; customerNumber: string; netTotal: number; invoiceCount: number }>();
    snapshot.invoices.filter((invoice) => isFinancialInvoice(invoice.status)).forEach((invoice) => {
      const contactId = projectById.get(invoice.projectId)?.contactId ?? null;
      const contact = contactId ? contactById.get(contactId) : undefined;
      const fallbackName = invoice.customerName.trim() || "Kunde ohne Bezeichnung";
      const key = contact ? `contact:${contact.id}` : `name:${normalize(fallbackName)}`;
      const current = rows.get(key) ?? { name: contact ? contactName(contact) : fallbackName, contactId: contact?.id ?? null, customerNumber: contact?.customerNumber ?? "Ohne Kundennummer", netTotal: 0, invoiceCount: 0 };
      current.netTotal += invoice.netTotal;
      current.invoiceCount += 1;
      rows.set(key, current);
    });
    const ranking = [...rows.values()].sort((a, b) => b.netTotal - a.netTotal || a.name.localeCompare(b.name, "de"));
    const records: JarvisRecordResult[] = ranking.filter((row) => row.contactId).slice(0, 20).map((row, index) => ({ id: `customer-revenue-${row.contactId}`, kind: "customer", title: `${index + 1}. ${row.name}`, subtitle: row.customerNumber, summary: `${money(row.netTotal)} netto aus ${row.invoiceCount} finanziell aktiven ${row.invoiceCount === 1 ? "Rechnung" : "Rechnungen"}`, status: "Umsatz · Gesamt", target: { kind: "customer", id: row.contactId! } }));
    return { type: "answer", topicId: "management.operations.customer-revenue", message: ranking.length ? `Die umsatzstärksten Kunden wurden aus allen finanziell aktiven Rechnungen organisationsweit ermittelt. ${ranking.length} Kunden mit ${snapshot.invoices.filter((invoice) => isFinancialInvoice(invoice.status)).length} berücksichtigten Rechnungen sind enthalten; Entwürfe, gelöschte und stornierte Belege sind ausgeschlossen.` : "Es sind aktuell keine finanziell aktiven Rechnungen vorhanden; deshalb gibt es keine belastbare Kunden-Umsatzrangfolge.", records, structured: { title: "Kundenumsatz · Gesamt", sections: [{ title: "Rangfolge", items: ranking.slice(0, 20).map((row, index) => `${index + 1}. ${row.name}: ${money(row.netTotal)} netto aus ${row.invoiceCount} ${row.invoiceCount === 1 ? "Rechnung" : "Rechnungen"}.`) }, { title: "Datenbasis", items: ["Alle finanziell aktiven Rechnungen; Entwürfe, gelöschte und stornierte Belege sind ausgeschlossen.", "Die Rangfolge ist nach Netto-Umsatz absteigend sortiert und verwendet die stabile Projekt-Kunden-Zuordnung, soweit vorhanden."] }] }, deterministic: true };
  }

  if (intent === "revenue") {
    const value = normalize(input.question);
    const currentMonth = dateKey(now).slice(0, 7);
    const allTime = /\b(?:insgesamt|gesamt|aller zeiten)\b/.test(value);
    const invoices = snapshot.invoices.filter((invoice) => isFinancialInvoice(invoice.status) && (allTime || (invoice.serviceDate.slice(0, 7) || invoice.plannedExecutionMonth || dateKey(invoice.createdAt).slice(0, 7)) === currentMonth));
    const total = invoices.reduce((sum, invoice) => sum + invoice.netTotal, 0);
    const invoiceBasis = invoices.length === 1 ? "einer finanziell aktiven Rechnung" : `${invoices.length} finanziell aktiven Rechnungen`;
    return { type: "answer", topicId: "management.operations.revenue", message: `${allTime ? "Der gesamte" : `Der Umsatz im aktuellen Leistungsmonat ${currentMonth}`} beträgt ${money(total)} netto aus ${invoiceBasis}. Entwürfe, gelöschte und stornierte Belege sind ausgeschlossen.`, structured: { title: allTime ? "Umsatz · Gesamt" : `Umsatz · ${currentMonth}`, facts: [{ label: "Netto-Umsatz", value: money(total) }, { label: "Berücksichtigte Rechnungen", value: String(invoices.length) }] }, deterministic: true };
  }

  const critical = activeProjects.map((project) => {
    const reasons: string[] = [];
    if (isOperationalProject(project.status) && !project.timeBudgetEnabled && !project.autoBillingEnabled && !(offersByProject.get(project.id) ?? []).some((offer) => isValidOffer(offer.status))) reasons.push("keine gültige Angebots- oder Abrechnungsbasis");
    if ((unbilledByProject.get(project.id)?.length ?? 0) > 0) reasons.push("erfasste Zeiten ohne Rechnungszuordnung");
    if ((invoicesByProject.get(project.id) ?? []).some((invoice) => isFinancialInvoice(invoice.status) && !invoice.isPaid && Boolean(invoice.dueDate) && invoice.dueDate < dateKey(now))) reasons.push("überfällige offene Rechnung");
    return { project, reasons };
  }).filter((item) => item.reasons.length > 0).sort((a, b) => b.reasons.length - a.reasons.length);
  return { type: "answer", topicId: "management.operations.critical-projects", message: critical.length ? `${critical.length} aktive Projekte haben mindestens einen belastbaren kaufmännischen oder abrechnungsbezogenen Risikohinweis. Die Ursachen werden je Projekt genannt.` : "Aktuell wurden anhand der angebundenen Angebots-, Rechnungs- und Zeitprüfungen keine kritischen aktiven Projekte gefunden.", records: critical.slice(0, 20).map(({ project, reasons }) => projectRecord(project, `${reasons.length} Risikohinweis${reasons.length === 1 ? "" : "e"}`, reasons.join(" · "))), structured: { title: "Kritische Projekte · belegte Prüfsignale", sections: [{ title: "Abgrenzung", items: ["Kritisch bedeutet hier: fehlende Angebots-/Abrechnungsbasis, unberechnete Zeiten oder eine überfällige offene Rechnung.", "Eine automatische Behauptung zu Wirtschaftlichkeit oder Verlust erfolgt ohne vollständige Kosten- und Erlösbasis ausdrücklich nicht."] }] }, deterministic: true };
}
