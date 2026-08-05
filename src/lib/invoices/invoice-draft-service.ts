import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getBillingAddressSnapshot } from "@/lib/contacts/invoice-routing";
import {
  addInvoiceDays,
  calculateInvoiceDraftTotals,
  calculateInvoiceLineNet,
  clampInvoicePercent,
  cleanInvoiceNumber,
  cleanInvoiceText,
  normalizeInvoiceCompany,
  normalizeInvoiceDate,
  normalizeInvoiceMonth,
  normalizeInvoicePaymentTermDays,
  normalizeInvoiceUnit,
  validateInvoiceDraft,
  type CanonicalInvoiceDraftLine,
  type InvoiceCompany,
  type InvoiceDraftLineInput,
  type InvoiceDraftTotals,
} from "@/lib/invoices/invoice-core";

type InvoiceDb = Prisma.TransactionClient | typeof prisma;

export type InvoiceDraftInput = {
  projectId?: string;
  company?: InvoiceCompany;
  serviceDate?: string;
  plannedExecutionMonth?: string;
  sourceOfferId?: string;
  introText?: string;
  closingText?: string;
  vatRate?: number;
  discountPercent?: number;
  paymentTermDays?: number;
  dueDate?: string;
  lines?: InvoiceDraftLineInput[];
};

export type InvoiceDraftWorkspace = {
  projectOptions: Array<{
    id: string;
    label: string;
    customerLabel: string;
    projectKind: string;
    defaultCompany: InvoiceCompany;
    updatedAt: string;
  }>;
  catalogOptions: Array<{
    id: string;
    label: string;
    type: string;
    unit: string;
    description: string;
    salesPrice: number;
    vatRate: number;
    updatedAt: string;
  }>;
  offerOptions: Array<{
    id: string;
    label: string;
    projectId: string;
    executionMonth: string;
    updatedAt: string;
  }>;
};

export type EvaluatedInvoiceDraft = {
  input: {
    projectId: string;
    company: InvoiceCompany;
    serviceDate: string;
    plannedExecutionMonth: string;
    sourceOfferId: string;
    introText: string;
    closingText: string;
    vatRate: number;
    discountPercent: number;
    paymentTermDays: number;
    dueDate: string;
    lines: CanonicalInvoiceDraftLine[];
  };
  project: null | {
    id: string;
    projectNumber: string;
    projectTitle: string;
    customerName: string;
    customerStreet: string;
    customerCity: string;
    contactName: string;
    projectKind: string;
    projectType: string;
    updatedAt: string;
  };
  sourceOffer: null | {
    id: string;
    offerNumber: string;
    updatedAt: string;
  };
  catalogVersions: Array<{ id: string; updatedAt: string }>;
  totals: InvoiceDraftTotals;
  missingFields: string[];
  errors: string[];
  warnings: string[];
  preflight: Array<{ key: string; label: string; status: "ok" | "warning" | "blocked"; detail: string }>;
};

export class InvoiceDraftServiceError extends Error {
  constructor(
    public readonly code: "invalid_input" | "not_found" | "scope_mismatch" | "stale_context" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "InvoiceDraftServiceError";
  }
}

const DEFAULT_INTRO = "wir stellen Ihnen folgende Leistungen in Rechnung.";
const DEFAULT_CLOSING = "Bitte überweisen Sie den Rechnungsbetrag innerhalb der vereinbarten Zahlungsfrist.";
const INACTIVE_STATUSES = ["Gelöscht", "Geloescht", "Archiviert", "Storniert", "Stornorechnung", "Gutschrift"];

function isArchived(status: string | null | undefined) {
  const value = (status ?? "").toLocaleLowerCase("de-DE");
  return value.includes("archiv") || value.includes("gelösch") || value.includes("geloesch");
}

function isImmocare(project: { projectType: string | null; projectNumber: string }) {
  return (project.projectType ?? "").toLocaleLowerCase("de-DE").includes("immocare") ||
    project.projectNumber.toLocaleLowerCase("de-DE").startsWith("oki");
}

function contactName(contact: { companyName: string | null; firstName: string | null; lastName: string | null } | null) {
  if (!contact) return "";
  return cleanInvoiceText(contact.companyName, 300) ||
    [contact.firstName, contact.lastName].map((value) => cleanInvoiceText(value, 150)).filter(Boolean).join(" ");
}

function attachmentsCount(entries: Array<{ attachments: Prisma.JsonValue }>, type: string) {
  return entries.reduce((sum, entry) => {
    if (!Array.isArray(entry.attachments)) return sum;
    return sum + entry.attachments.filter((item) => item && typeof item === "object" && "type" in item && item.type === type).length;
  }, 0);
}

export async function loadInvoiceDraftWorkspace(organizationId: string, db: InvoiceDb = prisma): Promise<InvoiceDraftWorkspace> {
  const [projects, catalogItems, offers] = await Promise.all([
    db.workPilotProject.findMany({
      where: { organizationId },
      orderBy: [{ projectNumber: "asc" }, { title: "asc" }],
      select: { id: true, projectNumber: true, title: true, customer: true, status: true, projectKind: true, projectType: true, updatedAt: true },
    }),
    db.catalogItem.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ type: "asc" }, { number: "asc" }],
      select: { id: true, number: true, name: true, type: true, unit: true, description: true, salesPrice: true, vatRate: true, updatedAt: true },
    }),
    db.offer.findMany({
      where: { organizationId, status: { notIn: [...INACTIVE_STATUSES, "Verloren"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, offerNumber: true, projectId: true, projectTitle: true, status: true, plannedExecutionMonth: true, updatedAt: true },
    }),
  ]);
  return {
    projectOptions: projects.filter((project) => !isArchived(project.status)).map((project) => ({
      id: project.id,
      label: `${project.projectNumber || project.id} · ${project.title}`,
      customerLabel: project.customer || "",
      projectKind: project.projectKind || "",
      defaultCompany: isImmocare(project) ? "OK immocare" : "OK solutions",
      updatedAt: project.updatedAt.toISOString(),
    })),
    catalogOptions: catalogItems.map((item) => ({
      id: item.id,
      label: `${item.number} · ${item.name}`,
      type: item.type,
      unit: item.unit || "Stk",
      description: item.description || "",
      salesPrice: Number(item.salesPrice || 0),
      vatRate: Number(item.vatRate || 19),
      updatedAt: item.updatedAt.toISOString(),
    })),
    offerOptions: offers.map((offer) => ({
      id: offer.id,
      label: `${offer.offerNumber} · ${offer.projectTitle || "Angebot"} · ${offer.status}`,
      projectId: offer.projectId,
      executionMonth: offer.plannedExecutionMonth || "",
      updatedAt: offer.updatedAt.toISOString(),
    })),
  };
}

export async function evaluateInvoiceDraft(input: { organizationId: string; draft: InvoiceDraftInput; db?: InvoiceDb; restrictToCatalog?: boolean; excludeInvoiceId?: string }): Promise<EvaluatedInvoiceDraft> {
  const db = input.db ?? prisma;
  const projectId = cleanInvoiceText(input.draft.projectId, 120);
  const project = projectId ? await db.workPilotProject.findFirst({
    where: { id: projectId, organizationId: input.organizationId },
    select: { id: true, projectNumber: true, title: true, customer: true, address: true, status: true, projectKind: true, projectType: true, contactId: true, contactPersonId: true, updatedAt: true },
  }) : null;
  if (projectId && !project) {
    throw new InvoiceDraftServiceError(
      "not_found",
      "Das Projekt wurde in der aktuellen Organisation nicht gefunden."
    );
  }
  if (project && isArchived(project.status)) throw new InvoiceDraftServiceError("invalid_input", "Für ein archiviertes Projekt kann kein Rechnungsentwurf angelegt werden.");

  const [customer, person] = project ? await Promise.all([
    project.contactId ? db.contact.findFirst({ where: { id: project.contactId, organizationId: input.organizationId }, select: { type: true, companyName: true, firstName: true, lastName: true, addressLine1: true, addressLine2: true, street: true, postalCode: true, city: true, country: true, hasDifferentBillingAddress: true, billingName: true, billingStreet: true, billingAddressLine1: true, billingAddressLine2: true, billingPostalCode: true, billingCity: true, billingCountry: true, paymentTermDays: true } }) : null,
    project.contactPersonId ? db.contact.findFirst({ where: { id: project.contactPersonId, organizationId: input.organizationId }, select: { companyName: true, firstName: true, lastName: true } }) : null,
  ]) : [null, null];

  const requestedLines = Array.isArray(input.draft.lines) ? input.draft.lines.slice(0, 30) : [];
  const catalogIds = [...new Set(requestedLines.map((line) => cleanInvoiceText(line.catalogItemId, 120)).filter(Boolean))];
  const catalogItems = catalogIds.length ? await db.catalogItem.findMany({
    where: { organizationId: input.organizationId, id: { in: catalogIds }, isActive: true },
    select: { id: true, type: true, name: true, number: true, description: true, unit: true, salesPrice: true, vatRate: true, updatedAt: true },
  }) : [];
  const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
  const warnings: string[] = [];
  const errors: string[] = [];
  const lines = requestedLines.flatMap((line, index) => {
    const catalogItemId = cleanInvoiceText(line.catalogItemId, 120);
    const catalog = catalogItemId ? catalogById.get(catalogItemId) : undefined;
    if (catalogItemId && !catalog) {
      errors.push(`Position ${index + 1}: Die Katalogposition ist nicht mehr aktiv oder gehört nicht zur Organisation.`);
      return [];
    }
    if (input.restrictToCatalog && !catalogItemId) {
      errors.push(`Position ${index + 1}: JARVIS darf nur aktive Katalogpositionen verwenden.`);
      return [];
    }
    const quantity = Math.max(cleanInvoiceNumber(line.quantity, 1), 0);
    const unitPrice = cleanInvoiceNumber(line.unitPrice, Number(catalog?.salesPrice || 0));
    if (catalog && line.unitPrice !== undefined && Math.abs(unitPrice - Number(catalog.salesPrice || 0)) > 0.005) {
      warnings.push(`Position ${index + 1}: ${unitPrice.toFixed(2)} € weicht vom aktuellen Katalogpreis ${Number(catalog.salesPrice || 0).toFixed(2)} € ab.`);
    }
    const discountPercent = clampInvoicePercent(line.discountPercent);
    const vatRate = clampInvoicePercent(line.vatRate ?? catalog?.vatRate ?? input.draft.vatRate ?? 19);
    return [{
      catalogItemId,
      catalogType: cleanInvoiceText(catalog?.type || line.catalogType, 40),
      quantity,
      unit: normalizeInvoiceUnit(catalog?.unit || line.unit) || "Stk",
      title: cleanInvoiceText(catalog?.name || line.title, 500),
      description: cleanInvoiceText(line.description ?? catalog?.description, 4000),
      unitPrice,
      discountPercent,
      vatRate,
      totalNet: calculateInvoiceLineNet({ quantity, unitPrice, discountPercent }),
    }];
  });

  const serviceDate = normalizeInvoiceDate(input.draft.serviceDate);
  const plannedExecutionMonth = serviceDate.slice(0, 7) || normalizeInvoiceMonth(input.draft.plannedExecutionMonth);
  const sourceOfferId = cleanInvoiceText(input.draft.sourceOfferId, 120);
  const sourceOffer = sourceOfferId ? await db.offer.findFirst({
    where: { id: sourceOfferId, organizationId: input.organizationId, ...(projectId ? { projectId } : {}) },
    select: { id: true, offerNumber: true, status: true, plannedExecutionMonth: true, updatedAt: true },
  }) : null;
  if (sourceOfferId && !sourceOffer) errors.push("Das Bezugsangebot gehört nicht zum ausgewählten Projekt oder existiert nicht mehr.");
  if (sourceOffer && [...INACTIVE_STATUSES, "Verloren"].includes(sourceOffer.status)) errors.push("Das Bezugsangebot ist nicht mehr aktiv.");
  if (sourceOffer?.plannedExecutionMonth && plannedExecutionMonth && sourceOffer.plannedExecutionMonth !== plannedExecutionMonth) {
    warnings.push(`Leistungsmonat ${plannedExecutionMonth} weicht vom Angebots-Ausführungsmonat ${sourceOffer.plannedExecutionMonth} ab.`);
  }

  const paymentTermDays = normalizeInvoicePaymentTermDays(input.draft.paymentTermDays ?? customer?.paymentTermDays ?? 14);
  const dueDate = normalizeInvoiceDate(input.draft.dueDate) || addInvoiceDays(serviceDate, paymentTermDays);
  const vatRate = clampInvoicePercent(input.draft.vatRate ?? 19);
  const discountPercent = clampInvoicePercent(input.draft.discountPercent);
  const totals = calculateInvoiceDraftTotals(lines, discountPercent, vatRate);
  const validation = validateInvoiceDraft({ projectId, serviceDate, lines });
  errors.push(...validation.errors);

  const preflight: EvaluatedInvoiceDraft["preflight"] = [];
  if (project && plannedExecutionMonth) {
    const activeInvoices = await db.invoice.findMany({
      where: {
        organizationId: input.organizationId,
        projectId,
        status: { notIn: INACTIVE_STATUSES },
        ...(input.excludeInvoiceId ? { id: { not: input.excludeInvoiceId } } : {}),
      },
      select: { id: true, invoiceNumber: true, status: true, plannedExecutionMonth: true, serviceDate: true, sourceOfferId: true },
    });
    const sameMonth = activeInvoices.filter((invoice) => (invoice.serviceDate || "").slice(0, 7) === plannedExecutionMonth || invoice.plannedExecutionMonth === plannedExecutionMonth);
    const duplicateOffer = sourceOfferId ? activeInvoices.find((invoice) => invoice.sourceOfferId === sourceOfferId) : null;
    if (duplicateOffer) errors.push(`Das Angebot ist bereits mit ${duplicateOffer.invoiceNumber} verknüpft.`);
    preflight.push({ key: "duplicate", label: "Doppelrechnung", status: duplicateOffer ? "blocked" : sameMonth.length ? "warning" : "ok", detail: duplicateOffer ? `${duplicateOffer.invoiceNumber} nutzt dieses Angebot bereits.` : sameMonth.length ? `${sameMonth.length} weiterer Entwurf/Rechnung im Leistungsmonat vorhanden.` : "Keine Rechnung mit gleichem Angebot oder Leistungsmonat gefunden." });

    const entries = await db.projectLogbookEntry.findMany({
      where: { organizationId: input.organizationId, projectId, OR: [{ projectMonth: plannedExecutionMonth }, { projectMonth: null }] },
      select: { title: true, attachments: true },
    });
    const byTitle = (title: string) => entries.filter((entry) => entry.title === title);
    const finalInspection = attachmentsCount(byTitle("Dokumente: Endkontrolle"), "Dokument");
    const beforeImages = attachmentsCount(byTitle("Bilder: Vorherbilder"), "Bild");
    const afterImages = attachmentsCount(byTitle("Bilder: Nachherbilder"), "Bild");
    const reports = attachmentsCount(byTitle("Dokumente: Tätigkeitsberichte"), "Dokument");
    preflight.push({ key: "inspection", label: "Endkontrolle", status: finalInspection ? "ok" : "warning", detail: finalInspection ? `${finalInspection} Nachweis(e) vorhanden.` : "Endkontrolle fehlt; Fakturierung später nur nach bewusster Prüfung." });
    if (isImmocare(project)) {
      preflight.push({ key: "images", label: "Vorher-/Nachherbilder", status: beforeImages && afterImages ? "ok" : "warning", detail: `${beforeImages} Vorherbild(er), ${afterImages} Nachherbild(er).` });
      preflight.push({ key: "report", label: "Tätigkeitsbericht", status: reports ? "ok" : "warning", detail: reports ? `${reports} Bericht(e) vorhanden.` : "Tätigkeitsbericht fehlt." });
    }
    const unbilledTimes = await db.projectTimeEntry.findMany({
      where: { organizationId: input.organizationId, projectId, mode: "project", deletedAt: null, invoiceId: null, date: { startsWith: plannedExecutionMonth } },
      select: { durationMs: true, pauseMs: true },
    });
    const unbilledHours = unbilledTimes.reduce((sum, entry) => sum + Math.max(Number(entry.durationMs - entry.pauseMs), 0) / 3_600_000, 0);
    preflight.push({ key: "time", label: "Offene Arbeitszeiten", status: unbilledHours > 0.01 ? "warning" : "ok", detail: unbilledHours > 0.01 ? `${unbilledHours.toFixed(2)} Std. sind noch nicht mit einer Rechnung verknüpft.` : "Keine offenen Projektzeiten im Leistungsmonat." });
    if (!(project.projectKind || "").toLocaleLowerCase("de-DE").startsWith("dauer") && !sourceOfferId) {
      warnings.push("Für das Einmalprojekt ist noch kein Bezugsangebot ausgewählt.");
    }
  }

  const billingAddress = project ? getBillingAddressSnapshot(customer ? { id: project.contactId || "", ...customer } : null, {
    customerName: project.customer || "",
    customerStreet: cleanInvoiceText(project.address, 500).split(",")[0] || "",
    customerCity: cleanInvoiceText(project.address, 500).split(",").slice(1).join(",").trim(),
    customerCountry: "Deutschland",
  }) : null;

  return {
    input: { projectId, company: normalizeInvoiceCompany(input.draft.company ?? (project && isImmocare(project) ? "OK immocare" : "OK solutions")), serviceDate, plannedExecutionMonth, sourceOfferId, introText: cleanInvoiceText(input.draft.introText, 4000) || DEFAULT_INTRO, closingText: cleanInvoiceText(input.draft.closingText, 4000) || DEFAULT_CLOSING, vatRate, discountPercent, paymentTermDays, dueDate, lines },
    project: project && billingAddress ? { id: project.id, projectNumber: project.projectNumber, projectTitle: project.title, customerName: billingAddress.customerName, customerStreet: billingAddress.customerStreet, customerCity: billingAddress.customerCity, contactName: contactName(person), projectKind: project.projectKind || "", projectType: project.projectType || "", updatedAt: project.updatedAt.toISOString() } : null,
    sourceOffer: sourceOffer ? { id: sourceOffer.id, offerNumber: sourceOffer.offerNumber, updatedAt: sourceOffer.updatedAt.toISOString() } : null,
    catalogVersions: catalogItems.map((item) => ({ id: item.id, updatedAt: item.updatedAt.toISOString() })),
    totals,
    missingFields: validation.missingFields,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    preflight,
  };
}

export async function createConfirmedInvoiceDraft(input: { tx: Prisma.TransactionClient; organizationId: string; actorName: string; draft: InvoiceDraftInput; source?: "jarvis" | "ui" }) {
  const evaluated = await evaluateInvoiceDraft({ organizationId: input.organizationId, draft: input.draft, db: input.tx, restrictToCatalog: input.source === "jarvis" });
  if (!evaluated.project || evaluated.missingFields.length || evaluated.errors.length) throw new InvoiceDraftServiceError("invalid_input", [...evaluated.missingFields, ...evaluated.errors].join(" · ") || "Der Rechnungsentwurf ist unvollständig.");
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workpilot:invoice-number:${input.organizationId}:RE`}))`;
  const numbers = await input.tx.invoice.findMany({ where: { organizationId: input.organizationId, invoiceNumber: { startsWith: "RE-" } }, select: { invoiceNumber: true } });
  const highest = numbers.reduce((max, row) => Math.max(max, Number(row.invoiceNumber.match(/^RE-(\d+)$/)?.[1] || 10099)), 10099);
  const invoiceNumber = `RE-${highest + 1}`;
  const invoice = await input.tx.invoice.create({
    data: {
      organizationId: input.organizationId,
      projectId: evaluated.project.id,
      projectNumber: evaluated.project.projectNumber,
      projectTitle: evaluated.project.projectTitle,
      company: evaluated.input.company,
      invoiceNumber,
      status: "Entwurf",
      billingSource: "manual",
      customerName: evaluated.project.customerName,
      customerStreet: evaluated.project.customerStreet,
      customerCity: evaluated.project.customerCity,
      contactName: evaluated.project.contactName,
      internalContactName: cleanInvoiceText(input.actorName, 300),
      plannedExecutionMonth: evaluated.input.plannedExecutionMonth,
      serviceDate: evaluated.input.serviceDate,
      sourceOfferId: evaluated.sourceOffer?.id || "",
      sourceOfferNumber: evaluated.sourceOffer?.offerNumber || "",
      introText: evaluated.input.introText,
      closingText: evaluated.input.closingText,
      netTotal: evaluated.totals.netTotal,
      vatRate: evaluated.totals.vatRate,
      grossTotal: evaluated.totals.grossTotal,
      discountPercent: evaluated.input.discountPercent,
      paymentTermDays: evaluated.input.paymentTermDays,
      dueDate: evaluated.input.dueDate,
      lines: { create: evaluated.input.lines.map((line, index) => ({ organizationId: input.organizationId, position: index + 1, ...line })) },
    },
  });
  await input.tx.invoiceHistory.create({ data: { organizationId: input.organizationId, invoiceId: invoice.id, projectId: invoice.projectId, invoiceNumber, eventType: "created", title: "Rechnungsentwurf gespeichert", note: `${invoiceNumber} wurde durch ${input.source === "jarvis" ? "JARVIS " : ""}als Entwurf gespeichert.`, actorName: cleanInvoiceText(input.actorName, 300) } });
  return invoice;
}
