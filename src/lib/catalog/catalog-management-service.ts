import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  getCatalogReviewStatusAfterEdit,
  hasCatalogReviewRelevantChange,
  normalizeCatalogReviewStatus,
} from "@/lib/catalog/review-status";
import { getImpliedCatalogSalesRatePerHour } from "@/lib/catalog/pricing";

type CatalogManagementDb = Prisma.TransactionClient | typeof prisma;
export type ManagedCatalogType = "article" | "service";
export type CatalogManagementField =
  | "name" | "category" | "trade" | "unit" | "description"
  | "purchasePrice" | "salesPrice" | "vatRate" | "laborCostRateKey"
  | "isLaborPosition" | "isPlanningRelevant" | "planningMinutesPerUnit"
  | "defaultPlanningBoard" | "defaultPlanningGroup";
export type CatalogManagementValues = Partial<Record<CatalogManagementField, string | number | boolean>> & {
  type?: ManagedCatalogType;
  number?: string;
};

export type CatalogManagementImpact = { key: string; label: string; count: number };
export type CatalogManagementChange = { field: CatalogManagementField | "type" | "number"; label: string; before: string; after: string };
export type CatalogManagementEvaluation = {
  mode: "create" | "update";
  item: { id: string; type: ManagedCatalogType; number: string; name: string; reviewStatus: string; updatedAt: string };
  values: Required<Pick<CatalogManagementValues, "type" | "number">> & CatalogManagementValues;
  changes: CatalogManagementChange[];
  impacts: CatalogManagementImpact[];
  calculation: { purchasePrice: number; salesPrice: number; grossProfit: number; marginPercent: number | null; vatRate: number };
  reviewWillBeInvalidated: boolean;
  checks: Array<{ key: string; label: string; status: "ok" | "warning" | "blocked"; detail: string }>;
  warnings: string[];
  blockingIssues: string[];
  fingerprint: string;
};

export class CatalogManagementServiceError extends Error {
  constructor(public readonly code: "not_found" | "invalid_input" | "stale_context" | "conflict", message: string) {
    super(message);
    this.name = "CatalogManagementServiceError";
  }
}

const fieldLabels: Record<CatalogManagementField | "type" | "number", string> = {
  type: "Art", number: "Nummer", name: "Bezeichnung", category: "Kategorie", trade: "Gewerk", unit: "Einheit",
  description: "Beschreibung", purchasePrice: "Einkauf/Selbstkosten", salesPrice: "Verkaufspreis", vatRate: "Umsatzsteuer",
  laborCostRateKey: "Lohnkostensatz", isLaborPosition: "Lohnposition", isPlanningRelevant: "Planungsrelevant",
  planningMinutesPerUnit: "Planminuten je Einheit", defaultPlanningBoard: "Standard-Planungsboard", defaultPlanningGroup: "Standard-Planungsgruppe",
};

function clean(value: unknown, maxLength = 1000) { return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength); }
function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function money(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : NaN; }
function integer(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : NaN; }
function boolean(value: unknown) { return value === true || String(value).toLowerCase() === "true" || String(value).toLowerCase() === "ja"; }
function display(value: unknown) {
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (typeof value === "number") return Number.isFinite(value) ? String(value).replace(".", ",") : "";
  return clean(value);
}
function normalizeType(value: unknown): ManagedCatalogType | "" { const type = clean(value).toLowerCase(); return type === "article" || type === "artikel" ? "article" : type === "service" || type === "leistung" ? "service" : ""; }
function defaultUnit(type: ManagedCatalogType) { return type === "service" ? "Std" : "Stk"; }
function prefix(type: ManagedCatalogType) { return type === "service" ? "L" : "A"; }
function confirmation(mode: "create" | "update", number: string) { return `KATALOGPOSITION ${mode === "create" ? "ANLEGEN" : "ÄNDERN"} ${number}`; }
export function getCatalogManagementConfirmationText(mode: "create" | "update", number: string) { return confirmation(mode, clean(number, 120)); }

async function nextNumber(organizationId: string, type: ManagedCatalogType, db: CatalogManagementDb) {
  const rows = await db.catalogItem.findMany({ where: { organizationId, number: { startsWith: prefix(type) } }, select: { number: true } });
  const highest = rows.map((row) => Number(row.number.replace(/\D/g, ""))).filter(Number.isFinite).reduce((max, value) => Math.max(max, value), 1000);
  return `${prefix(type)}${String(highest + 1).padStart(4, "0")}`;
}

function canonicalValues(type: ManagedCatalogType, number: string, input: CatalogManagementValues, base?: Record<string, unknown>) {
  const text = (field: CatalogManagementField, fallback = "") => Object.prototype.hasOwnProperty.call(input, field) ? clean(input[field], field === "description" ? 4000 : 500) : clean(base?.[field] ?? fallback, field === "description" ? 4000 : 500);
  const numeric = (field: "purchasePrice" | "salesPrice" | "vatRate", fallback: number) => Object.prototype.hasOwnProperty.call(input, field) ? money(input[field]) : money(base?.[field] ?? fallback);
  const flag = (field: "isLaborPosition" | "isPlanningRelevant", fallback: boolean) => Object.prototype.hasOwnProperty.call(input, field) ? boolean(input[field]) : Boolean(base?.[field] ?? fallback);
  const minutes = Object.prototype.hasOwnProperty.call(input, "planningMinutesPerUnit") ? integer(input.planningMinutesPerUnit) : integer(base?.planningMinutesPerUnit ?? (type === "service" ? 60 : 0));
  return {
    type, number, name: text("name"), category: text("category"), trade: text("trade"), unit: text("unit", defaultUnit(type)) || defaultUnit(type), description: text("description"),
    purchasePrice: numeric("purchasePrice", 0), salesPrice: numeric("salesPrice", 0), vatRate: numeric("vatRate", 19), laborCostRateKey: text("laborCostRateKey"),
    isLaborPosition: flag("isLaborPosition", type === "service"), isPlanningRelevant: flag("isPlanningRelevant", type === "service"), planningMinutesPerUnit: minutes,
    defaultPlanningBoard: text("defaultPlanningBoard"), defaultPlanningGroup: text("defaultPlanningGroup"),
  };
}

async function impacts(organizationId: string, catalogItemId: string, db: CatalogManagementDb): Promise<CatalogManagementImpact[]> {
  if (!catalogItemId) return [];
  const counts = await Promise.all([
    db.catalogPackageItem.count({ where: { organizationId, componentItemId: catalogItemId } }),
    db.offerLine.count({ where: { organizationId, catalogItemId } }), db.invoiceLine.count({ where: { organizationId, catalogItemId } }),
    db.planningEntry.count({ where: { organizationId, billingCatalogItemId: catalogItemId } }), db.projectTimeEntry.count({ where: { organizationId, billingCatalogItemId: catalogItemId } }),
    db.catalogInventoryMovement.count({ where: { organizationId, catalogItemId } }), db.marketingContentQuota.count({ where: { organizationId, catalogItemId } }),
    db.marketingContentItem.count({ where: { organizationId, catalogItemId } }),
  ]);
  const labels = [["packages", "verwendende Pakete"], ["offers", "Angebotspositionen"], ["invoices", "Rechnungspositionen"], ["planning", "Planungseinträge"], ["times", "Zeiteinträge"], ["inventory", "Lagerbewegungen"], ["quotas", "Marketing-Kontingente"], ["content", "Marketing-Inhalte"]] as const;
  return labels.map(([key, label], index) => ({ key, label, count: Number(counts[index] ?? 0) }));
}

async function evaluate(input: { organizationId: string; mode: "create" | "update"; catalogItemId?: string; values: CatalogManagementValues; db?: CatalogManagementDb }): Promise<CatalogManagementEvaluation> {
  const db = input.db ?? prisma;
  const existing = input.mode === "update" ? await db.catalogItem.findFirst({ where: { id: clean(input.catalogItemId), organizationId: input.organizationId } }) : null;
  if (input.mode === "update" && !existing) throw new CatalogManagementServiceError("not_found", "Die Katalogposition wurde in der aktuellen Organisation nicht gefunden.");
  const requestedType = normalizeType(input.values.type ?? existing?.type);
  if (!requestedType) throw new CatalogManagementServiceError("invalid_input", "JARVIS verwaltet in diesem Schritt ausschließlich Artikel oder Leistungen; Pakete bleiben in der Paketmaske.");
  if (existing && existing.type === "package") throw new CatalogManagementServiceError("invalid_input", "Pakete und ihre Bestandteile bleiben in diesem Schritt bewusst in der Paketmaske.");
  if (existing && requestedType !== existing.type) throw new CatalogManagementServiceError("invalid_input", "Die Art einer bestehenden Katalogposition kann JARVIS nicht ändern. Lege stattdessen eine neue Position an.");
  const number = input.mode === "create" ? (clean(input.values.number, 120) || await nextNumber(input.organizationId, requestedType, db)) : existing!.number;
  const values = canonicalValues(requestedType, number, input.values, existing as unknown as Record<string, unknown> | undefined);
  const blockingIssues: string[] = [];
  if (!values.name) blockingIssues.push("Eine eindeutige Bezeichnung ist erforderlich.");
  if (!values.number) blockingIssues.push("Eine Katalognummer ist erforderlich.");
  if (input.mode === "create" && !new RegExp(`^${prefix(requestedType)}\\d{3,12}$`, "i").test(values.number)) blockingIssues.push(`Die Katalognummer muss zur Art passen und dem Format ${prefix(requestedType)} plus 3 bis 12 Ziffern entsprechen.`);
  if (![values.purchasePrice, values.salesPrice, values.vatRate, values.planningMinutesPerUnit].every(Number.isFinite)) blockingIssues.push("Preise, Umsatzsteuer und Planminuten müssen gültige Zahlen sein.");
  if (values.purchasePrice < 0 || values.salesPrice < 0) blockingIssues.push("Preise dürfen nicht negativ sein.");
  if (values.vatRate < 0 || values.vatRate > 100) blockingIssues.push("Der Umsatzsteuersatz muss zwischen 0 und 100 liegen.");
  if (values.isPlanningRelevant && values.planningMinutesPerUnit <= 0) blockingIssues.push("Für eine planungsrelevante Position sind positive Planminuten je Einheit erforderlich.");
  const duplicates = values.name && values.number ? await db.catalogItem.findMany({ where: { organizationId: input.organizationId, id: existing ? { not: existing.id } : undefined, OR: [{ number: { equals: values.number, mode: "insensitive" } }, { name: { equals: values.name, mode: "insensitive" } }] }, select: { id: true, number: true, name: true }, take: 5 }) : [];
  if (duplicates.length) blockingIssues.push(`Mögliche Dublette: ${duplicates.map((row) => `${row.number} · ${row.name}`).join(", ")}.`);
  const current = existing ? canonicalValues(requestedType, existing.number, {}, existing as unknown as Record<string, unknown>) : null;
  const allFields = Object.keys(values) as Array<keyof typeof values>;
  const changes = allFields.filter((field) => !current || display(current[field]) !== display(values[field])).map((field) => ({ field: field as CatalogManagementChange["field"], label: fieldLabels[field as keyof typeof fieldLabels], before: current ? display(current[field]) : "", after: display(values[field]) }));
  if (input.mode === "update" && !changes.length) blockingIssues.push("Es wurde keine wirksame Änderung erkannt.");
  const impactRows = await impacts(input.organizationId, existing?.id ?? "", db);
  const purchasePrice = values.purchasePrice; const salesPrice = values.salesPrice; const grossProfit = Math.round((salesPrice - purchasePrice) * 100) / 100;
  const marginPercent = salesPrice > 0 ? Math.round((grossProfit / salesPrice) * 10000) / 100 : null;
  const reviewWillBeInvalidated = Boolean(existing && normalizeCatalogReviewStatus(existing.reviewStatus) === "approved" && hasCatalogReviewRelevantChange(existing as unknown as Record<string, unknown>, values as unknown as Record<string, unknown>));
  const warnings = [
    ...(salesPrice < purchasePrice ? ["Der Verkaufspreis liegt unter Einkauf/Selbstkosten. Prüfe die beabsichtigte negative Marge."] : []),
    ...(salesPrice === 0 ? ["Der Verkaufspreis beträgt 0,00 €. Die Position wäre ohne weiteren Preisansatz nicht abrechenbar."] : []),
    ...(impactRows.find((item) => item.key === "packages")?.count ? ["Verwendende Pakete behalten ihre Preis- und Minuten-Snapshots; JARVIS aktualisiert sie nicht automatisch."] : []),
    ...(reviewWillBeInvalidated ? ["Die bestehende fachliche Freigabe wird durch diese relevante Änderung aufgehoben und auf prüfbedürftig gesetzt."] : []),
  ];
  const checks: CatalogManagementEvaluation["checks"] = [
    { key: "identity", label: "Eindeutige Position", status: duplicates.length ? "blocked" : "ok", detail: duplicates.length ? `${duplicates.length} mögliche Dublette(n).` : `${values.number} · ${values.name || "Bezeichnung fehlt"}` },
    { key: "economics", label: "Preis und Marge", status: salesPrice < purchasePrice || salesPrice === 0 ? "warning" : "ok", detail: `EK/Selbstkosten ${purchasePrice.toFixed(2)} € · Verkauf ${salesPrice.toFixed(2)} € · Rohertrag ${grossProfit.toFixed(2)} €${marginPercent === null ? "" : ` · Marge ${marginPercent.toFixed(2)} %`}` },
    { key: "planning", label: "Planungslogik", status: values.isPlanningRelevant && values.planningMinutesPerUnit <= 0 ? "blocked" : "ok", detail: values.isPlanningRelevant ? `${values.planningMinutesPerUnit} Minuten je ${values.unit}` : "Nicht planungsrelevant." },
    { key: "impacts", label: "Bestehende Verwendungen", status: impactRows.some((row) => row.count > 0) ? "warning" : "ok", detail: impactRows.filter((row) => row.count > 0).map((row) => `${row.label}: ${row.count}`).join(", ") || "Keine bestehenden Verwendungen." },
  ];
  const item = existing ? { id: existing.id, type: requestedType, number: existing.number, name: existing.name, reviewStatus: normalizeCatalogReviewStatus(existing.reviewStatus), updatedAt: existing.updatedAt.toISOString() } : { id: "", type: requestedType, number: values.number, name: values.name, reviewStatus: "unreviewed", updatedAt: "" };
  return { mode: input.mode, item, values, changes, impacts: impactRows, calculation: { purchasePrice, salesPrice, grossProfit, marginPercent, vatRate: values.vatRate }, reviewWillBeInvalidated, checks, warnings, blockingIssues, fingerprint: hash({ organizationId: input.organizationId, mode: input.mode, item, values, changes, impacts: impactRows }) };
}

export const evaluateCatalogCreation = (input: { organizationId: string; values: CatalogManagementValues; db?: CatalogManagementDb }) => evaluate({ ...input, mode: "create" });
export const evaluateCatalogChange = (input: { organizationId: string; catalogItemId: string; changes: CatalogManagementValues; db?: CatalogManagementDb }) => evaluate({ organizationId: input.organizationId, mode: "update", catalogItemId: input.catalogItemId, values: input.changes, db: input.db });

export async function executeCatalogManagement(input: { tx: Prisma.TransactionClient; organizationId: string; mode: "create" | "update"; catalogItemId?: string; values: CatalogManagementValues; actorId: string; actorName: string; requestId: string; expectedFingerprint: string }) {
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workpilot:catalog:${input.organizationId}:${input.mode === "create" ? normalizeType(input.values.type) : input.catalogItemId}`}))`;
  const evaluation = input.mode === "create" ? await evaluateCatalogCreation({ organizationId: input.organizationId, values: input.values, db: input.tx }) : await evaluateCatalogChange({ organizationId: input.organizationId, catalogItemId: input.catalogItemId || "", changes: input.values, db: input.tx });
  if (evaluation.fingerprint !== input.expectedFingerprint) throw new CatalogManagementServiceError("stale_context", "Katalogstand, Preiswirkung oder Verwendungen haben sich geändert. Bitte öffne eine neue Vorschau.");
  if (evaluation.blockingIssues.length) throw new CatalogManagementServiceError("conflict", evaluation.blockingIssues.join(" · "));
  const data = evaluation.values;
  if (input.mode === "create") {
    const created = await input.tx.catalogItem.create({ data: { organizationId: input.organizationId, type: data.type, number: data.number, name: clean(data.name), category: clean(data.category) || null, trade: clean(data.trade), unit: clean(data.unit) || defaultUnit(data.type), description: clean(data.description, 4000) || null, purchasePrice: money(data.purchasePrice), salesPrice: money(data.salesPrice), salesPriceCalculationMode: data.type === "service" ? "time_based" : "manual", salesRatePerHour: data.type === "service" ? getImpliedCatalogSalesRatePerHour({ salesPrice: money(data.salesPrice), planningMinutesPerUnit: integer(data.planningMinutesPerUnit) }) : null, vatRate: money(data.vatRate), laborCostRateKey: clean(data.laborCostRateKey), isLaborPosition: Boolean(data.isLaborPosition), isPlanningRelevant: Boolean(data.isPlanningRelevant), planningMinutesPerUnit: integer(data.planningMinutesPerUnit), defaultPlanningBoard: clean(data.defaultPlanningBoard) || null, defaultPlanningGroup: clean(data.defaultPlanningGroup) || null, reviewStatus: "unreviewed", isActive: true } });
    await input.tx.catalogItemHistory.create({ data: { organizationId: input.organizationId, catalogItemId: created.id, eventType: "created", actorUserId: input.actorId, actorName: clean(input.actorName), note: `JARVIS · ${clean(input.requestId, 120)}` } });
    return created;
  }
  const existing = await input.tx.catalogItem.findFirstOrThrow({ where: { id: input.catalogItemId, organizationId: input.organizationId } });
  const reviewStatus = getCatalogReviewStatusAfterEdit({ previousStatus: existing.reviewStatus, hasRelevantChange: hasCatalogReviewRelevantChange(existing as unknown as Record<string, unknown>, data as unknown as Record<string, unknown>) });
  const invalidated = normalizeCatalogReviewStatus(existing.reviewStatus) === "approved" && reviewStatus === "needs_review";
  const updated = await input.tx.catalogItem.updateMany({ where: { id: existing.id, organizationId: input.organizationId, updatedAt: existing.updatedAt }, data: { name: clean(data.name), category: clean(data.category) || null, trade: clean(data.trade), unit: clean(data.unit) || defaultUnit(data.type), description: clean(data.description, 4000) || null, purchasePrice: money(data.purchasePrice), salesPrice: money(data.salesPrice), vatRate: money(data.vatRate), laborCostRateKey: clean(data.laborCostRateKey), isLaborPosition: Boolean(data.isLaborPosition), isPlanningRelevant: Boolean(data.isPlanningRelevant), planningMinutesPerUnit: integer(data.planningMinutesPerUnit), defaultPlanningBoard: clean(data.defaultPlanningBoard) || null, defaultPlanningGroup: clean(data.defaultPlanningGroup) || null, reviewStatus, reviewedAt: invalidated ? null : existing.reviewedAt, reviewedByUserId: invalidated ? null : existing.reviewedByUserId, reviewedByName: invalidated ? null : existing.reviewedByName, lastSalesPriceChangedAt: money(existing.salesPrice) !== money(data.salesPrice) ? new Date() : existing.lastSalesPriceChangedAt, lastSalesPriceOldValue: money(existing.salesPrice) !== money(data.salesPrice) ? existing.salesPrice : existing.lastSalesPriceOldValue, lastSalesPriceNewValue: money(existing.salesPrice) !== money(data.salesPrice) ? money(data.salesPrice) : existing.lastSalesPriceNewValue } });
  if (updated.count !== 1) throw new CatalogManagementServiceError("conflict", "Die Katalogposition wurde zwischenzeitlich geändert.");
  const result = await input.tx.catalogItem.findUniqueOrThrow({ where: { id: existing.id } });
  for (const change of evaluation.changes) await input.tx.catalogItemHistory.create({ data: { organizationId: input.organizationId, catalogItemId: result.id, eventType: "field_changed", fieldName: change.label, oldValue: change.before, newValue: change.after, actorUserId: input.actorId, actorName: clean(input.actorName), note: `JARVIS · ${clean(input.requestId, 120)}` } });
  return result;
}
