import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

type BulkDb = Prisma.TransactionClient | typeof prisma;

export const CONTACT_BULK_MAX_TARGETS = 25;
export const CONTACT_BULK_CATEGORIES = [
  "Kunde",
  "Privatkunde",
  "Lieferant",
  "Partner",
  "Ansprechpartner",
  "Archiv",
] as const;

export type ContactBulkCategory = (typeof CONTACT_BULK_CATEGORIES)[number];
export type ContactBulkCategoryRequest =
  | { mode: "apply"; customerNumbers: string[]; targetCategory: ContactBulkCategory }
  | { mode: "rollback"; sourceRequestId: string };

type BulkItem = {
  id: string;
  customerNumber: string;
  label: string;
  before: string;
  after: string;
  updatedAt: string;
};

type StoredBulkItem = BulkItem & { afterUpdatedAt: string };

export type ContactBulkCategoryEvaluation = {
  mode: "apply" | "rollback";
  sourceRequestId?: string;
  targetCategory: string;
  items: BulkItem[];
  excluded: Array<{ customerNumber: string; reason: string }>;
  checks: Array<{ key: string; label: string; status: "ok" | "warning" | "blocked"; detail: string }>;
  warnings: string[];
  blockingIssues: string[];
  fingerprint: string;
};

export class ContactBulkCategoryServiceError extends Error {
  constructor(
    public readonly code: "not_found" | "invalid_input" | "stale_context" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "ContactBulkCategoryServiceError";
  }
}

function clean(value: unknown, maxLength = 500) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function label(contact: { companyName: string | null; firstName: string | null; lastName: string | null; customerNumber: string }) {
  return clean(contact.companyName) || [clean(contact.firstName), clean(contact.lastName)].filter(Boolean).join(" ") || contact.customerNumber;
}

function normalizedNumbers(values: string[]) {
  return [...new Set(values.map((value) => clean(value, 40)).filter(Boolean))];
}

function isCategory(value: string): value is ContactBulkCategory {
  return CONTACT_BULK_CATEGORIES.includes(value as ContactBulkCategory);
}

function parseStoredItems(payload: Prisma.JsonValue | null | undefined): StoredBulkItem[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const items = (payload as Record<string, unknown>).items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const parsed = {
      id: clean(row.id, 200), customerNumber: clean(row.customerNumber, 40), label: clean(row.label, 500),
      before: clean(row.before, 100), after: clean(row.after, 100), updatedAt: clean(row.updatedAt, 100),
      afterUpdatedAt: clean(row.afterUpdatedAt, 100),
    };
    return parsed.id && parsed.customerNumber && parsed.before && parsed.after && parsed.updatedAt && parsed.afterUpdatedAt ? [parsed] : [];
  });
}

export function getContactBulkCategoryConfirmationText(evaluation: Pick<ContactBulkCategoryEvaluation, "mode" | "items" | "sourceRequestId">) {
  return evaluation.mode === "rollback"
    ? `MASSENÄNDERUNG ZURÜCKROLLEN ${clean(evaluation.sourceRequestId, 120)}`
    : `MASSENÄNDERUNG AUSFÜHREN ${evaluation.items.length} KONTAKTE`;
}

async function evaluateApply(input: { organizationId: string; request: Extract<ContactBulkCategoryRequest, { mode: "apply" }>; db: BulkDb }) {
  const numbers = normalizedNumbers(input.request.customerNumbers);
  if (numbers.length < 2) throw new ContactBulkCategoryServiceError("invalid_input", "Eine Massenänderung benötigt mindestens zwei ausdrücklich genannte Kundennummern.");
  if (numbers.length > CONTACT_BULK_MAX_TARGETS) throw new ContactBulkCategoryServiceError("invalid_input", `Pro Massenänderung sind höchstens ${CONTACT_BULK_MAX_TARGETS} Kontakte zulässig.`);
  if (!isCategory(input.request.targetCategory)) throw new ContactBulkCategoryServiceError("invalid_input", "Die gewünschte Kontaktkategorie ist nicht freigegeben.");
  const contacts = await input.db.contact.findMany({
    where: { organizationId: input.organizationId, customerNumber: { in: numbers } },
    select: { id: true, customerNumber: true, companyName: true, firstName: true, lastName: true, category: true, updatedAt: true },
    orderBy: { customerNumber: "asc" },
  });
  const found = new Set(contacts.map((contact) => contact.customerNumber));
  const missing = numbers.filter((number) => !found.has(number));
  const unchanged = contacts.filter((contact) => contact.category === input.request.targetCategory);
  const items = contacts.filter((contact) => contact.category !== input.request.targetCategory).map((contact) => ({
    id: contact.id, customerNumber: contact.customerNumber, label: label(contact), before: contact.category,
    after: input.request.targetCategory, updatedAt: contact.updatedAt.toISOString(),
  }));
  const excluded = [
    ...missing.map((customerNumber) => ({ customerNumber, reason: "In der aktuellen Organisation nicht gefunden." })),
    ...unchanged.map((contact) => ({ customerNumber: contact.customerNumber, reason: `Ist bereits in Kategorie ${input.request.targetCategory}.` })),
  ];
  const blockingIssues = [
    ...(missing.length ? [`${missing.length} Kundennummer(n) wurden nicht gefunden; Teilmengen werden nicht ausgeführt.`] : []),
    ...(unchanged.length ? [`${unchanged.length} Kontakt(e) haben bereits den Zielwert; wirkungslose Teiländerungen sind nicht zulässig.`] : []),
  ];
  return { mode: "apply" as const, targetCategory: input.request.targetCategory, items, excluded, blockingIssues };
}

async function evaluateRollback(input: { organizationId: string; request: Extract<ContactBulkCategoryRequest, { mode: "rollback" }>; db: BulkDb }) {
  const sourceRequestId = clean(input.request.sourceRequestId, 120);
  if (!sourceRequestId) throw new ContactBulkCategoryServiceError("invalid_input", "Für die Rückrollung fehlt die ursprüngliche Massenänderungs-ID.");
  const source = await input.db.auditLog.findFirst({
    where: { organizationId: input.organizationId, action: "contact.bulk-category.changed", entityType: "contact-bulk", entityId: sourceRequestId },
    orderBy: { createdAt: "desc" },
  });
  if (!source) throw new ContactBulkCategoryServiceError("not_found", "Die ursprüngliche Massenänderung wurde in dieser Organisation nicht gefunden.");
  const alreadyRolledBack = await input.db.auditLog.findFirst({
    where: { organizationId: input.organizationId, action: "contact.bulk-category.rolled-back", entityType: "contact-bulk", entityId: sourceRequestId },
    select: { id: true },
  });
  const stored = parseStoredItems(source.payload);
  if (!stored.length) throw new ContactBulkCategoryServiceError("conflict", "Der Wiederherstellungsnachweis ist unvollständig; es wird nichts geändert.");
  const contacts = await input.db.contact.findMany({
    where: { organizationId: input.organizationId, id: { in: stored.map((item) => item.id) } },
    select: { id: true, customerNumber: true, companyName: true, firstName: true, lastName: true, category: true, updatedAt: true },
  });
  const byId = new Map(contacts.map((contact) => [contact.id, contact]));
  const excluded: ContactBulkCategoryEvaluation["excluded"] = [];
  const items: BulkItem[] = [];
  for (const original of stored) {
    const contact = byId.get(original.id);
    if (!contact) { excluded.push({ customerNumber: original.customerNumber, reason: "Kontakt existiert nicht mehr." }); continue; }
    if (contact.category !== original.after || contact.updatedAt.toISOString() !== original.afterUpdatedAt) {
      excluded.push({ customerNumber: contact.customerNumber, reason: "Kontakt wurde seit der Massenänderung erneut bearbeitet." }); continue;
    }
    items.push({ id: contact.id, customerNumber: contact.customerNumber, label: label(contact), before: contact.category, after: original.before, updatedAt: contact.updatedAt.toISOString() });
  }
  const blockingIssues = [
    ...(alreadyRolledBack ? ["Diese Massenänderung wurde bereits zurückgerollt."] : []),
    ...(excluded.length ? [`${excluded.length} Kontakt(e) sind nicht mehr im exakt protokollierten Folgezustand; eine Teilrückrollung ist gesperrt.`] : []),
  ];
  return { mode: "rollback" as const, sourceRequestId, targetCategory: "ursprüngliche Kategorien", items, excluded, blockingIssues };
}

export async function evaluateContactBulkCategory(input: { organizationId: string; request: ContactBulkCategoryRequest; db?: BulkDb }): Promise<ContactBulkCategoryEvaluation> {
  const db = input.db ?? prisma;
  const base = input.request.mode === "apply"
    ? await evaluateApply({ organizationId: input.organizationId, request: input.request, db })
    : await evaluateRollback({ organizationId: input.organizationId, request: input.request, db });
  const checks: ContactBulkCategoryEvaluation["checks"] = [
    { key: "scope", label: "Zielmenge", status: base.blockingIssues.length ? "blocked" : "ok", detail: `${base.items.length} Kontakt(e) sind eindeutig und organisationsgebunden geprüft.` },
    { key: "transaction", label: "Ausführung", status: "ok", detail: "Alle Änderungen laufen in einer serialisierbaren Transaktion; bei einem Konflikt wird nichts gespeichert." },
    { key: "rollback", label: "Wiederherstellung", status: "ok", detail: base.mode === "rollback" ? "Die exakt protokollierten Ausgangskategorien werden wiederhergestellt." : "Ausgangs- und Folgezustand werden für eine kontrollierte Rückrollung protokolliert." },
  ];
  const warnings = ["Nur die Kontaktkategorie ändert sich. Stammdaten, Projekte, Angebote, Rechnungen, Aufgaben, Online-Anfragen und Verknüpfungen bleiben unverändert."];
  const sourceRequestId = base.mode === "rollback" ? base.sourceRequestId : undefined;
  const fingerprint = stableHash({ organizationId: input.organizationId, mode: base.mode, sourceRequestId, targetCategory: base.targetCategory, items: base.items, excluded: base.excluded });
  return { ...base, checks, warnings, fingerprint };
}

export async function executeContactBulkCategory(input: {
  tx: Prisma.TransactionClient; organizationId: string; actorId: string; requestId: string;
  request: ContactBulkCategoryRequest; expectedFingerprint?: string; source?: "jarvis" | "contact-bulk-ui";
}) {
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workpilot:contact-bulk:${input.organizationId}`}))`;
  const evaluation = await evaluateContactBulkCategory({ organizationId: input.organizationId, request: input.request, db: input.tx });
  if (input.expectedFingerprint && evaluation.fingerprint !== input.expectedFingerprint) throw new ContactBulkCategoryServiceError("stale_context", "Die Kontaktmenge oder mindestens ein Kontaktstand hat sich geändert. Bitte öffne eine neue Vorschau.");
  if (evaluation.blockingIssues.length) throw new ContactBulkCategoryServiceError("invalid_input", evaluation.blockingIssues.join(" · "));
  const storedItems: StoredBulkItem[] = [];
  for (const item of evaluation.items) {
    const changed = await input.tx.contact.updateMany({
      where: { id: item.id, organizationId: input.organizationId, category: item.before, updatedAt: new Date(item.updatedAt) },
      data: { category: item.after, updatedAt: new Date() },
    });
    if (changed.count !== 1) throw new ContactBulkCategoryServiceError("conflict", `Kontakt ${item.customerNumber} wurde zwischenzeitlich geändert.`);
    const current = await input.tx.contact.findFirstOrThrow({ where: { id: item.id, organizationId: input.organizationId }, select: { updatedAt: true } });
    storedItems.push({ ...item, afterUpdatedAt: current.updatedAt.toISOString() });
  }
  await input.tx.contactIntegrationEvent.createMany({ data: evaluation.items.map((item) => ({ organizationId: input.organizationId, contactId: item.id, eventType: "updated", changedFields: ["category"] })) });
  const sourceRequestId = evaluation.mode === "rollback" ? evaluation.sourceRequestId! : input.requestId;
  await input.tx.auditLog.create({ data: {
    organizationId: input.organizationId, actorId: input.actorId,
    action: evaluation.mode === "rollback" ? "contact.bulk-category.rolled-back" : "contact.bulk-category.changed",
    entityType: "contact-bulk", entityId: sourceRequestId,
    payload: { source: input.source ?? "jarvis", requestId: input.requestId, sourceRequestId: evaluation.sourceRequestId ?? null, targetCategory: evaluation.targetCategory, count: storedItems.length, items: storedItems } as Prisma.InputJsonValue,
  } });
  return { requestId: input.requestId, sourceRequestId, count: storedItems.length, items: storedItems };
}
