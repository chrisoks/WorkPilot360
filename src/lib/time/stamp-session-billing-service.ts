import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getDeadlineSettings } from "@/lib/company-settings/deadlines";
import { prisma } from "@/lib/db/client";
import type { StampSessionStopEntry } from "@/lib/time/stamp-session-stop-service";

type ProjectRow = {
  id: string; projectNumber: string; title: string; customer: string | null;
  contactId: string | null; addressContactId: string | null; address: string | null;
  projectType: string | null; branch: string | null; responsibleName: string | null;
  projectKind: string | null; recurringBillingMode: string | null;
};
type ContactRow = {
  companyName: string | null; firstName: string | null; lastName: string | null;
  mainContactName: string | null; street: string | null; addressLine1: string | null;
  addressLine2: string | null; postalCode: string | null; city: string | null; paymentTermDays: number | null;
};
type CatalogRow = {
  id: string; type: string; number: string; name: string; unit: string;
  salesPrice: number; vatRate: number;
};

function clean(value: unknown, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function stableId(...parts: string[]) {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 32);
}

function roundingHours(durationMs: number, factorValue: number) {
  const hours = Number(durationMs || 0) / 3_600_000;
  if (hours <= 0) return 0;
  const factor = [0.25, 0.5, 1].includes(factorValue) ? factorValue : 0.5;
  return Math.ceil(hours / factor) * factor;
}

function paymentDays(value: unknown) {
  const parsed = Math.round(Number(value ?? 14));
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 365) : 14;
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (!year || !month || !day || Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + paymentDays(days));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function invoiceCompany(project: ProjectRow) {
  const value = `${project.projectType || ""} ${project.branch || ""} ${project.projectNumber || ""}`.toLocaleLowerCase("de-DE");
  return value.includes("immocare") || clean(project.projectNumber).toLocaleLowerCase("de-DE").startsWith("oki")
    ? "OK immocare"
    : "OK solutions";
}

async function loadProject(tx: Prisma.TransactionClient, organizationId: string, projectId: string) {
  const rows = await tx.$queryRaw<ProjectRow[]>`
    SELECT id, "projectNumber", title, customer, "contactId", "addressContactId", address,
           "projectType", branch, "responsibleName", "projectKind", "recurringBillingMode"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organizationId} AND id = ${projectId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function loadContact(tx: Prisma.TransactionClient, organizationId: string, project: ProjectRow) {
  const contactId = clean(project.contactId, 120);
  const addressContactId = clean(project.addressContactId, 120);
  if (!contactId && !addressContactId) return null;
  const rows = await tx.$queryRaw<ContactRow[]>`
    SELECT "companyName", "firstName", "lastName", "mainContactName", street,
           "addressLine1", "addressLine2", "postalCode", city, "paymentTermDays"
    FROM "Contact"
    WHERE "organizationId" = ${organizationId}
      AND id IN (${contactId || "__none__"}, ${addressContactId || "__none__"})
    ORDER BY CASE WHEN id = ${addressContactId || "__none__"} THEN 0 ELSE 1 END,
             "isInvoiceRecipient" DESC, "isMainContact" DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function nextInvoiceNumber(tx: Prisma.TransactionClient, organizationId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invoice-number:${organizationId}`}, 0))`;
  const rows = await tx.$queryRaw<Array<{ invoiceNumber: string }>>`
    SELECT "invoiceNumber" FROM "Invoice"
    WHERE "organizationId" = ${organizationId} AND "invoiceNumber" LIKE 'RE-%'
  `;
  const highest = rows.map((row) => Number(clean(row.invoiceNumber).match(/^RE-(\d+)$/)?.[1] ?? "10099"))
    .filter(Number.isFinite).reduce((maximum, value) => Math.max(maximum, value), 10099);
  return `RE-${highest + 1}`;
}

export async function attachStampEntryToHourlyInvoiceDraft(input: {
  organizationId: string;
  entry: StampSessionStopEntry;
}) {
  if (
    input.entry.mode !== "project" ||
    !input.entry.projectId ||
    !input.entry.billingCatalogItemId ||
    !input.entry.billingCatalogItemLabel
  ) return null;
  if (clean(input.entry.invoiceId)) return { invoiceId: clean(input.entry.invoiceId), invoiceNumber: clean(input.entry.invoiceNumber), replayed: true };
  const monthKey = clean(input.entry.date).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const settings = await getDeadlineSettings(input.organizationId);
  const hours = roundingHours(input.entry.durationMs, settings.hourlyBillingRoundingFactorHours);
  if (hours <= 0) return null;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`hourly-invoice:${input.organizationId}:${input.entry.projectId}:${monthKey}`}, 0))`;
    const currentEntries = await tx.$queryRaw<Array<{ invoiceId: string | null; invoiceNumber: string | null }>>`
      SELECT "invoiceId", "invoiceNumber" FROM "ProjectTimeEntry"
      WHERE "organizationId" = ${input.organizationId} AND id = ${input.entry.id} AND "deletedAt" IS NULL
      LIMIT 1
    `;
    if (!currentEntries[0]) throw new Error("Die gespeicherte Stempelzeit wurde nicht gefunden.");
    if (clean(currentEntries[0].invoiceId)) {
      return { invoiceId: clean(currentEntries[0].invoiceId), invoiceNumber: clean(currentEntries[0].invoiceNumber), replayed: true };
    }
    const project = await loadProject(tx, input.organizationId, input.entry.projectId);
    if (!project || project.recurringBillingMode !== "hourly" || !clean(project.projectKind).toLocaleLowerCase("de-DE").includes("dauerl")) return null;
    const catalogRows = await tx.$queryRaw<CatalogRow[]>`
      SELECT id, type, number, name, unit, "salesPrice", "vatRate"
      FROM "CatalogItem"
      WHERE "organizationId" = ${input.organizationId} AND id = ${input.entry.billingCatalogItemId} AND "isActive" = true
      LIMIT 1
    `;
    const catalog = catalogRows[0];
    if (!catalog) return null;
    let drafts = await tx.$queryRaw<Array<{ id: string; invoiceNumber: string }>>`
      SELECT id, "invoiceNumber" FROM "Invoice"
      WHERE "organizationId" = ${input.organizationId} AND "projectId" = ${project.id}
        AND status = 'Entwurf' AND "billingSource" = 'hourly-recurring'
        AND "plannedExecutionMonth" = ${monthKey}
      ORDER BY "createdAt" ASC LIMIT 1
    `;
    let draft = drafts[0];
    if (!draft) {
      const contact = await loadContact(tx, input.organizationId, project);
      const person = [contact?.firstName, contact?.lastName].map(clean).filter(Boolean).join(" ");
      const customerName = clean(contact?.companyName) || clean(project.customer) || person;
      const customerStreet = [contact?.street, contact?.addressLine1, contact?.addressLine2].map(clean).filter((value, index, values) => value && values.indexOf(value) === index).join(", ") || clean(project.address).split(",")[0] || "";
      const customerCity = [contact?.postalCode, contact?.city].map(clean).filter(Boolean).join(" ") || clean(project.address).split(",").slice(1).join(",").trim();
      const terms = paymentDays(contact?.paymentTermDays);
      draft = { id: randomUUID(), invoiceNumber: await nextInvoiceNumber(tx, input.organizationId) };
      await tx.$executeRaw`
        INSERT INTO "Invoice" (
          id, "organizationId", "projectId", "projectNumber", "projectTitle", company,
          "invoiceNumber", status, "billingSource", "customerName", "customerStreet", "customerCity",
          "contactName", "internalContactName", "plannedExecutionMonth", "serviceDate", "introText", "closingText",
          "discountPercent", "paymentTermDays", "dueDate", "netTotal", "vatRate", "grossTotal", "pdfData", "updatedAt"
        ) VALUES (
          ${draft.id}, ${input.organizationId}, ${project.id}, ${project.projectNumber || project.id}, ${project.title}, ${invoiceCompany(project)},
          ${draft.invoiceNumber}, 'Entwurf', 'hourly-recurring', ${customerName}, ${customerStreet}, ${customerCity},
          ${clean(contact?.mainContactName) || person}, ${clean(project.responsibleName)}, ${monthKey}, ${input.entry.date},
          'wir stellen Ihnen folgende Leistungen in Rechnung.', '', 0, ${terms}, ${addDays(input.entry.date, terms)}, 0, 19, 0, NULL, CURRENT_TIMESTAMP
        )
      `;
      await tx.$executeRaw`
        INSERT INTO "InvoiceHistory" (id, "organizationId", "invoiceId", "projectId", "invoiceNumber", "eventType", title, note, "actorName")
        VALUES (${randomUUID()}, ${input.organizationId}, ${draft.id}, ${project.id}, ${draft.invoiceNumber}, 'created',
          'Rechnungsentwurf automatisch angelegt',
          'Automatisch aus der ersten Stempelung eines Dauerläufers mit Stundenabrechnung erzeugt.', 'System')
      `;
    }
    const title = `${catalog.number} | ${catalog.name}`;
    const lines = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "InvoiceLine"
      WHERE "organizationId" = ${input.organizationId} AND "invoiceId" = ${draft.id}
        AND "catalogItemId" = ${catalog.id} AND title = ${title}
      ORDER BY position ASC LIMIT 1
    `;
    const lineId = lines[0]?.id || stableId("hourly-invoice-line", draft.id, catalog.id, title);
    if (!lines[0]) {
      const positions = await tx.$queryRaw<Array<{ position: number }>>`
        SELECT COALESCE(MAX(position), 0)::int AS position FROM "InvoiceLine"
        WHERE "organizationId" = ${input.organizationId} AND "invoiceId" = ${draft.id}
      `;
      await tx.$executeRaw`
        INSERT INTO "InvoiceLine" (id, "organizationId", "invoiceId", "catalogItemId", "catalogType", "isLaborPosition", position,
          quantity, unit, title, description, "unitPrice", "discountPercent", "materialUnitCostSnapshot", "materialCostSnapshot", "costSnapshotAt", "vatRate", "totalNet", "updatedAt")
        VALUES (${lineId}, ${input.organizationId}, ${draft.id}, ${catalog.id}, ${catalog.type}, true, ${Number(positions[0]?.position || 0) + 1},
          0, ${catalog.unit || "Std"}, ${title}, '', ${Number(catalog.salesPrice || 0)}, 0, 0, 0, CURRENT_TIMESTAMP, ${Number(catalog.vatRate || 19)}, 0, CURRENT_TIMESTAMP)
      `;
    }
    const laborId = stableId("stamp-invoice-labor", input.organizationId, input.entry.id);
    await tx.$executeRaw`
      INSERT INTO "InvoiceLineLabor" (id, "organizationId", "invoiceId", "invoiceLineId", "userId", "employeeName", "plannedHours", "hourlyCostRate", "totalCost", position, "updatedAt")
      VALUES (${laborId}, ${input.organizationId}, ${draft.id}, ${lineId}, ${input.entry.userId || ""}, ${input.entry.employee || "Mitarbeiter"},
        ${hours}, ${Number(input.entry.laborCostRateSnapshot || 0)}, ${roundMoney(hours * Number(input.entry.laborCostRateSnapshot || 0))}, 0, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO NOTHING
    `;
    const aggregate = await tx.$queryRaw<Array<{ hours: number; cost: number }>>`
      SELECT COALESCE(SUM("plannedHours"), 0)::float AS hours, COALESCE(SUM("totalCost"), 0)::float AS cost
      FROM "InvoiceLineLabor" WHERE "organizationId" = ${input.organizationId} AND "invoiceLineId" = ${lineId}
    `;
    const quantity = Number(aggregate[0]?.hours || 0);
    await tx.$executeRaw`
      UPDATE "InvoiceLine" SET quantity = ${quantity}, "materialCostSnapshot" = ${roundMoney(Number(aggregate[0]?.cost || 0))},
        "totalNet" = ${roundMoney(quantity * Number(catalog.salesPrice || 0))}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = ${input.organizationId} AND id = ${lineId}
    `;
    const totals = await tx.$queryRaw<Array<{ netTotal: number; vatRate: number }>>`
      SELECT COALESCE(SUM("totalNet"), 0)::float AS "netTotal", COALESCE(MAX("vatRate"), 19)::float AS "vatRate"
      FROM "InvoiceLine" WHERE "organizationId" = ${input.organizationId} AND "invoiceId" = ${draft.id}
    `;
    const net = roundMoney(Number(totals[0]?.netTotal || 0));
    const vat = Number(totals[0]?.vatRate || 19);
    await tx.$executeRaw`
      UPDATE "Invoice" SET "netTotal" = ${net}, "vatRate" = ${vat}, "grossTotal" = ${roundMoney(net * (1 + vat / 100))},
        "pdfData" = NULL, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = ${input.organizationId} AND id = ${draft.id}
    `;
    await tx.$executeRaw`
      UPDATE "ProjectTimeEntry" SET "invoiceId" = ${draft.id}, "invoiceNumber" = ${draft.invoiceNumber}, "invoicedAt" = NULL
      WHERE "organizationId" = ${input.organizationId} AND id = ${input.entry.id} AND COALESCE("invoiceId", '') = ''
    `;
    return { invoiceId: draft.id, invoiceNumber: draft.invoiceNumber, replayed: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
