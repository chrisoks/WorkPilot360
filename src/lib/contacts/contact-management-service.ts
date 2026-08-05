import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { normalizePhoneNumber } from "@/lib/phone/normalize";

type ContactManagementDb = Prisma.TransactionClient | typeof prisma;

export const CONTACT_MANAGEMENT_FIELDS = [
  "companyName", "firstName", "lastName", "position", "email", "invoiceEmail",
  "activityReportEmail", "phone", "mobile", "website", "source", "reachability",
  "street", "addressLine1", "addressLine2", "postalCode", "city", "country",
] as const;

export type ContactManagementField = (typeof CONTACT_MANAGEMENT_FIELDS)[number];
export type ContactManagementChanges = Partial<Record<ContactManagementField, string>>;
type ContactManagementValues = Partial<Record<ContactManagementField, string | null>>;
export type ContactCreateInput = ContactManagementChanges & {
  type: "company" | "private" | "person";
  category?: string;
};

const FIELD_LABELS: Record<ContactManagementField, string> = {
  companyName: "Firma", firstName: "Vorname", lastName: "Nachname", position: "Position",
  email: "E-Mail", invoiceEmail: "Rechnungs-E-Mail", activityReportEmail: "Tätigkeitsbericht-E-Mail",
  phone: "Telefon", mobile: "Mobiltelefon", website: "Website", source: "Quelle",
  reachability: "Erreichbarkeit", street: "Straße", addressLine1: "Adresszeile 1",
  addressLine2: "Adresszeile 2", postalCode: "PLZ", city: "Ort", country: "Land",
};

const EMAIL_FIELDS = new Set<ContactManagementField>(["email", "invoiceEmail", "activityReportEmail"]);
const PHONE_FIELDS = new Set<ContactManagementField>(["phone", "mobile"]);

export class ContactManagementServiceError extends Error {
  constructor(
    public readonly code: "not_found" | "invalid_input" | "stale_context" | "conflict",
    message: string
  ) {
    super(message);
    this.name = "ContactManagementServiceError";
  }
}

function clean(value: unknown, maxLength = 500) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanField(field: ContactManagementField, value: unknown) {
  const cleaned = clean(value, field === "website" ? 1000 : 500);
  if (!PHONE_FIELDS.has(field) || !cleaned) return cleaned;
  const normalized = normalizePhoneNumber(cleaned);
  return normalized.kind === "valid" ? normalized.normalized : cleaned;
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizedChanges(input: ContactManagementChanges) {
  return Object.fromEntries(CONTACT_MANAGEMENT_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(input, field)
  ).map((field) => [field, cleanField(field, input[field])])) as ContactManagementChanges;
}

function validateFields(input: ContactManagementChanges) {
  for (const [field, raw] of Object.entries(input) as Array<[ContactManagementField, string]>) {
    const value = cleanField(field, raw);
    if (EMAIL_FIELDS.has(field) && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value)) {
      throw new ContactManagementServiceError("invalid_input", `${FIELD_LABELS[field]} ist keine gültige E-Mail-Adresse.`);
    }
    if (PHONE_FIELDS.has(field) && value) {
      const normalized = normalizePhoneNumber(value);
      if (normalized.kind === "invalid") {
        throw new ContactManagementServiceError("invalid_input", `${FIELD_LABELS[field]}: ${normalized.reason}`);
      }
    }
  }
}

function displayName(contact: { companyName?: string | null; firstName?: string | null; lastName?: string | null; customerNumber?: string }) {
  return clean(contact.companyName) || [clean(contact.firstName), clean(contact.lastName)].filter(Boolean).join(" ") || clean(contact.customerNumber) || "Kontakt";
}

function validateRequiredIdentity(type: ContactCreateInput["type"], values: ContactManagementValues) {
  if (type === "company" && !clean(values.companyName)) {
    throw new ContactManagementServiceError("invalid_input", "Für einen Firmenkontakt ist der Firmenname erforderlich.");
  }
  if (type !== "company" && !clean(values.firstName) && !clean(values.lastName)) {
    throw new ContactManagementServiceError("invalid_input", "Für einen Personen- oder Privatkontakt ist mindestens Vorname oder Nachname erforderlich.");
  }
}

function phoneValue(value: unknown) {
  const result = normalizePhoneNumber(clean(value));
  return result.kind === "valid" ? result.normalized : null;
}

export function getContactCreateConfirmationText(name: string) {
  return `KONTAKT ANLEGEN ${clean(name, 120)}`;
}

export function getContactChangeConfirmationText(customerNumber: string) {
  return `KONTAKT ÄNDERN ${clean(customerNumber, 120)}`;
}

export type ContactManagementEvaluation = {
  mode: "create" | "update";
  contact: { id: string; customerNumber: string; displayName: string; type: string; category: string; updatedAt: string };
  values: ContactCreateInput | ContactManagementChanges;
  changes: Array<{ field: ContactManagementField; label: string; before: string; after: string }>;
  checks: Array<{ key: string; label: string; status: "ok" | "warning" | "blocked"; detail: string }>;
  warnings: string[];
  blockingIssues: string[];
  fingerprint: string;
};

async function duplicateMatches(db: ContactManagementDb, organizationId: string, values: ContactManagementValues, excludeId?: string) {
  const email = clean(values.email).toLowerCase();
  const phoneNormalized = phoneValue(values.phone);
  const mobileNormalized = phoneValue(values.mobile);
  const companyName = clean(values.companyName).toLowerCase();
  const firstName = clean(values.firstName).toLowerCase();
  const lastName = clean(values.lastName).toLowerCase();
  if (!email && !phoneNormalized && !mobileNormalized && !companyName && !firstName && !lastName) return [];
  return db.contact.findMany({
    where: {
      organizationId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
        ...(phoneNormalized ? [{ phoneNormalized }] : []),
        ...(mobileNormalized ? [{ mobileNormalized }] : []),
        ...(companyName ? [{ companyName: { equals: companyName, mode: "insensitive" as const } }] : []),
        ...(firstName || lastName ? [{
          firstName: firstName ? { equals: firstName, mode: "insensitive" as const } : null,
          lastName: lastName ? { equals: lastName, mode: "insensitive" as const } : null,
        }] : []),
      ],
    },
    select: { id: true, customerNumber: true, companyName: true, firstName: true, lastName: true },
    take: 5,
  });
}

export async function evaluateContactCreation(input: { organizationId: string; values: ContactCreateInput; db?: ContactManagementDb }): Promise<ContactManagementEvaluation> {
  const db = input.db ?? prisma;
  const type = input.values.type;
  const category = clean(input.values.category) || (type === "person" ? "Ansprechpartner" : type === "private" ? "Privatkunde" : "Kunde");
  const values = { ...normalizedChanges(input.values), type, category } as ContactCreateInput;
  validateFields(values);
  validateRequiredIdentity(type, values);
  const duplicates = await duplicateMatches(db, input.organizationId, values);
  const name = displayName(values);
  const blockingIssues = duplicates.length
    ? [`Es gibt bereits ${duplicates.length} möglichen Dubletten-Treffer. Bitte prüfe zuerst: ${duplicates.map((item) => `${item.customerNumber} · ${displayName(item)}`).join(", ")}.`]
    : [];
  const checks: ContactManagementEvaluation["checks"] = [
    { key: "identity", label: "Kontaktidentität", status: "ok", detail: `${name} wird als ${type === "company" ? "Firma" : type === "private" ? "Privatkunde" : "Ansprechpartner"} angelegt.` },
    { key: "duplicate", label: "Dublettenprüfung", status: duplicates.length ? "blocked" : "ok", detail: duplicates.length ? "Mögliche Dublette gefunden; keine Anlage zulässig." : "Kein Treffer über Name, E-Mail oder Telefonnummer." },
  ];
  return {
    mode: "create",
    contact: { id: "", customerNumber: "wird automatisch vergeben", displayName: name, type, category, updatedAt: "" },
    values,
    changes: CONTACT_MANAGEMENT_FIELDS.flatMap((field) => values[field] ? [{ field, label: FIELD_LABELS[field], before: "", after: cleanField(field, values[field]) }] : []),
    checks,
    warnings: ["Kundennummer und technische Kontakt-ID werden erst bei Bestätigung serialisiert vergeben.", "Projekte, Objektadressen, Angebote, Rechnungen, Aufgaben und Online-Anfragen werden nicht automatisch angelegt oder zugeordnet."],
    blockingIssues,
    fingerprint: stableHash({ organizationId: input.organizationId, values, duplicates: duplicates.map((item) => item.id) }),
  };
}

export async function evaluateContactChange(input: { organizationId: string; contactId: string; changes: ContactManagementChanges; db?: ContactManagementDb }): Promise<ContactManagementEvaluation> {
  const db = input.db ?? prisma;
  const requested = normalizedChanges(input.changes);
  if (!Object.keys(requested).length) throw new ContactManagementServiceError("invalid_input", "Es wurde kein freigegebenes Kontaktfeld zur Änderung angegeben.");
  validateFields(requested);
  const contact = await db.contact.findFirst({ where: { id: input.contactId, organizationId: input.organizationId } });
  if (!contact) throw new ContactManagementServiceError("not_found", "Der Kontakt wurde in der aktuellen Organisation nicht gefunden.");
  const merged = { ...contact, ...requested };
  validateRequiredIdentity(contact.type === "company" || contact.type === "private" ? contact.type : "person", merged);
  const changes = (Object.entries(requested) as Array<[ContactManagementField, string]>).flatMap(([field, after]) => {
    const before = cleanField(field, contact[field]);
    return before === after ? [] : [{ field, label: FIELD_LABELS[field], before, after }];
  });
  const duplicates = await duplicateMatches(db, input.organizationId, merged, contact.id);
  const blockingIssues = [
    ...(!changes.length ? ["Die gewünschten Werte entsprechen bereits dem aktuellen Kontaktstand."] : []),
    ...(duplicates.length ? [`Die Änderung würde eine mögliche Dublette erzeugen: ${duplicates.map((item) => `${item.customerNumber} · ${displayName(item)}`).join(", ")}.`] : []),
  ];
  return {
    mode: "update",
    contact: { id: contact.id, customerNumber: contact.customerNumber, displayName: displayName(contact), type: contact.type, category: contact.category, updatedAt: contact.updatedAt.toISOString() },
    values: requested,
    changes,
    checks: [
      { key: "changes", label: "Änderungsumfang", status: changes.length ? "ok" : "blocked", detail: changes.length ? `${changes.length} Feld(er) werden genau wie angezeigt geändert.` : blockingIssues[0] },
      { key: "duplicate", label: "Dublettenprüfung", status: duplicates.length ? "blocked" : "ok", detail: duplicates.length ? "Mögliche Dublette gefunden." : "Kein weiterer Kontakt mit den geänderten Identitätsmerkmalen gefunden." },
    ],
    warnings: ["Kundennummer, Kontakttyp, Kategorie, Kundenstatus, Zahlungs-/Steuerdaten und bestehende Verknüpfungen bleiben unverändert."],
    blockingIssues,
    fingerprint: stableHash({ contact: { id: contact.id, customerNumber: contact.customerNumber, type: contact.type, category: contact.category, updatedAt: contact.updatedAt.toISOString(), ...Object.fromEntries(CONTACT_MANAGEMENT_FIELDS.map((field) => [field, cleanField(field, contact[field])])) }, requested, duplicates: duplicates.map((item) => item.id) }),
  };
}

async function nextCustomerNumber(tx: Prisma.TransactionClient, organizationId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workpilot:contact-number:${organizationId}`}))`;
  const rows = await tx.$queryRaw<Array<{ nextNumber: bigint | number | string }>>`
    SELECT (COALESCE(MAX(CASE WHEN "customerNumber" ~ '^[0-9]{1,18}$' THEN "customerNumber"::BIGINT END), 7000048) + 1) AS "nextNumber"
    FROM "Contact" WHERE "organizationId" = ${organizationId}
  `;
  return String(rows[0]?.nextNumber ?? 7000049);
}

export async function executeContactCreation(input: { tx: Prisma.TransactionClient; organizationId: string; values: ContactCreateInput; actorId: string; requestId: string; expectedFingerprint?: string }) {
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workpilot:contact-number:${input.organizationId}`}))`;
  const evaluation = await evaluateContactCreation({ organizationId: input.organizationId, values: input.values, db: input.tx });
  if (input.expectedFingerprint && evaluation.fingerprint !== input.expectedFingerprint) throw new ContactManagementServiceError("stale_context", "Die Kontaktprüfung hat sich geändert. Bitte öffne eine neue Vorschau.");
  if (evaluation.blockingIssues.length) throw new ContactManagementServiceError("invalid_input", evaluation.blockingIssues.join(" · "));
  const customerNumber = await nextCustomerNumber(input.tx, input.organizationId);
  const values = evaluation.values as ContactCreateInput;
  const id = randomUUID();
  const contact = await input.tx.contact.create({ data: {
    id, organizationId: input.organizationId, customerNumber, type: values.type, category: values.category || "Kunde",
    ...Object.fromEntries(CONTACT_MANAGEMENT_FIELDS.map((field) => [field, values[field] || null])),
    phoneNormalized: phoneValue(values.phone), mobileNormalized: phoneValue(values.mobile),
    isInvoiceRecipient: false, isActivityReportRecipient: Boolean(values.activityReportEmail),
  } });
  await input.tx.contactIntegrationEvent.create({ data: { organizationId: input.organizationId, contactId: id, eventType: "created", changedFields: CONTACT_MANAGEMENT_FIELDS.filter((field) => Boolean(values[field])) } });
  await input.tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: input.actorId, action: "contact.created", entityType: "contact", entityId: id, payload: { source: "jarvis", requestId: clean(input.requestId, 120), customerNumber, fields: evaluation.changes.map((item) => item.field) } } });
  return contact;
}

export async function executeContactChange(input: { tx: Prisma.TransactionClient; organizationId: string; contactId: string; changes: ContactManagementChanges; actorId: string; requestId: string; expectedFingerprint?: string }) {
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workpilot:contact:${input.organizationId}:${input.contactId}`}))`;
  const evaluation = await evaluateContactChange({ organizationId: input.organizationId, contactId: input.contactId, changes: input.changes, db: input.tx });
  if (input.expectedFingerprint && evaluation.fingerprint !== input.expectedFingerprint) throw new ContactManagementServiceError("stale_context", "Die Kontaktdaten haben sich geändert. Bitte öffne eine neue Vorschau.");
  if (evaluation.blockingIssues.length) throw new ContactManagementServiceError("invalid_input", evaluation.blockingIssues.join(" · "));
  const values = evaluation.values as ContactManagementChanges;
  const data: Record<string, unknown> = { ...values, updatedAt: new Date() };
  if (Object.prototype.hasOwnProperty.call(values, "phone")) data.phoneNormalized = phoneValue(values.phone);
  if (Object.prototype.hasOwnProperty.call(values, "mobile")) data.mobileNormalized = phoneValue(values.mobile);
  if (Object.prototype.hasOwnProperty.call(values, "activityReportEmail")) data.isActivityReportRecipient = Boolean(values.activityReportEmail);
  const updated = await input.tx.contact.updateMany({ where: { id: input.contactId, organizationId: input.organizationId, updatedAt: new Date(evaluation.contact.updatedAt) }, data });
  if (updated.count !== 1) throw new ContactManagementServiceError("conflict", "Der Kontakt wurde zwischenzeitlich geändert.");
  await input.tx.contactIntegrationEvent.create({ data: { organizationId: input.organizationId, contactId: input.contactId, eventType: "updated", changedFields: evaluation.changes.map((item) => item.field) } });
  await input.tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: input.actorId, action: "contact.changed", entityType: "contact", entityId: input.contactId, payload: { source: "jarvis", requestId: clean(input.requestId, 120), changes: evaluation.changes } } });
  return input.tx.contact.findFirstOrThrow({ where: { id: input.contactId, organizationId: input.organizationId } });
}
