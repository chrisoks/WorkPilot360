import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

type ContactDeletionDb = Prisma.TransactionClient | typeof prisma;

export type ContactDeletionReference = {
  key: string;
  label: string;
  count: number;
};

export type ContactDeletionEvaluation = {
  contact: {
    id: string;
    customerNumber: string;
    displayName: string;
    type: string;
    category: string;
    updatedAt: string;
    deletionMarkedAt: string;
  };
  reason: string;
  references: ContactDeletionReference[];
  checks: Array<{ key: string; label: string; status: "ok" | "blocked"; detail: string }>;
  warnings: string[];
  blockingIssues: string[];
  fingerprint: string;
};

export class ContactDeletionServiceError extends Error {
  constructor(
    public readonly code: "not_found" | "invalid_input" | "stale_context" | "conflict",
    message: string,
    public readonly references: ContactDeletionReference[] = []
  ) {
    super(message);
    this.name = "ContactDeletionServiceError";
  }
}

function clean(value: unknown, maxLength = 500) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function displayName(contact: { companyName?: string | null; firstName?: string | null; lastName?: string | null; customerNumber: string }) {
  return clean(contact.companyName) || [clean(contact.firstName), clean(contact.lastName)].filter(Boolean).join(" ") || contact.customerNumber;
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function getContactDeletionReferences(input: {
  organizationId: string;
  contactId: string;
  db?: ContactDeletionDb;
}): Promise<ContactDeletionReference[]> {
  const db = input.db ?? prisma;
  const { organizationId, contactId } = input;
  const counts = await Promise.all([
    db.workPilotProject.count({ where: { organizationId, OR: [{ contactId }, { contactPersonId: contactId }, { addressContactId: contactId }] } }),
    db.contact.count({ where: { organizationId, parentCompanyId: contactId } }),
    db.objectAddress.count({ where: { organizationId, customerId: contactId } }),
    db.onlineRequest.count({ where: { organizationId, matchedContactId: contactId } }),
    db.customerLogbookEntry.count({ where: { organizationId, OR: [{ customerId: contactId }, { contactId }] } }),
    db.customerProjectNote.count({ where: { organizationId, customerId: contactId } }),
    db.customerProjectNoteAcknowledgement.count({ where: { organizationId, customerId: contactId } }),
    db.projectPotential.count({ where: { organizationId, contactId } }),
    db.salesOpportunity.count({ where: { organizationId, contactId } }),
    db.salesTarget.count({ where: { organizationId, contactId } }),
    db.customerFeedbackRequest.count({ where: { organizationId, contactId } }),
    db.customerFeedback.count({ where: { organizationId, contactId } }),
    db.offerAcceptanceRequest.count({ where: { organizationId, customerId: contactId } }),
    db.catalogInventoryMovement.count({ where: { organizationId, customerId: contactId } }),
    db.winterServiceCalculation.count({ where: { organizationId, customerId: contactId } }),
    db.vehicleCalculation.count({ where: { organizationId, customerId: contactId } }),
    db.winterServiceRun.count({ where: { organizationId, OR: [{ contactId }, { contactPersonId: contactId }] } }),
  ]);
  const definitions = [
    ["projects", "Projekte"],
    ["childContacts", "Ansprechpartner/Unterkontakte"],
    ["objectAddresses", "Objektadressen"],
    ["onlineRequests", "zugeordnete Online-Anfragen"],
    ["customerLogbook", "Kundenlogbuch-Einträge"],
    ["customerNotes", "Kundenhinweise einschließlich Archiv"],
    ["customerNoteAcknowledgements", "Bestätigungen von Kundenhinweisen"],
    ["potentials", "Zusatzverkaufs-Potenziale"],
    ["salesOpportunities", "Verkaufschancen"],
    ["salesTargets", "Sales-Ziele"],
    ["feedbackRequests", "Feedback-Anfragen"],
    ["feedbacks", "Kundenfeedbacks"],
    ["offerAcceptances", "Angebotsannahme-Vorgänge"],
    ["inventoryMovements", "Lagerbewegungen"],
    ["winterCalculations", "Winterdienstkalkulationen"],
    ["vehicleCalculations", "Fahrzeugkalkulationen"],
    ["winterServiceRuns", "Winterdienstläufe"],
  ] as const;
  return definitions.map(([key, label], index) => ({ key, label, count: Number(counts[index] ?? 0) }));
}

export async function evaluateContactDeletion(input: {
  organizationId: string;
  contactId: string;
  reason: string;
  db?: ContactDeletionDb;
}): Promise<ContactDeletionEvaluation> {
  const db = input.db ?? prisma;
  const reason = clean(input.reason, 1000);
  if (reason.length < 3) throw new ContactDeletionServiceError("invalid_input", "Für die endgültige Kontaktlöschung ist ein nachvollziehbarer Grund mit mindestens drei Zeichen erforderlich.");
  const contact = await db.contact.findFirst({ where: { id: input.contactId, organizationId: input.organizationId } });
  if (!contact) throw new ContactDeletionServiceError("not_found", "Der Kontakt wurde in der aktuellen Organisation nicht gefunden.");
  const references = await getContactDeletionReferences({ organizationId: input.organizationId, contactId: contact.id, db });
  const activeReferences = references.filter((item) => item.count > 0);
  const blockingIssues = !contact.deletionMarkedAt
    ? ["Der Kontakt muss vor der endgültigen Löschung zuerst löschmarkiert werden."]
    : activeReferences.length
      ? [`Der Kontakt bleibt erhalten, weil ${activeReferences.map((item) => `${item.label}: ${item.count}`).join(", ")}. Bitte kläre zuerst sämtliche Bezüge.`]
      : [];
  const identity = displayName(contact);
  return {
    contact: { id: contact.id, customerNumber: contact.customerNumber, displayName: identity, type: contact.type, category: contact.category, updatedAt: contact.updatedAt.toISOString(), deletionMarkedAt: contact.deletionMarkedAt?.toISOString() ?? "" },
    reason,
    references,
    checks: [
      { key: "identity", label: "Kontaktidentität", status: "ok", detail: `${contact.customerNumber} · ${identity}` },
      { key: "references", label: "Fachliche Verknüpfungen", status: activeReferences.length ? "blocked" : "ok", detail: activeReferences.length ? `${activeReferences.length} Referenzfamilie(n) blockieren die Löschung.` : `Alle ${references.length} geprüften Referenzfamilien sind frei.` },
    ],
    warnings: [
      "Die physische Löschung ist endgültig und kann nicht wiederhergestellt werden. Nutze für normale Bestandsbereinigung bevorzugt die Kontaktkategorie Archiv.",
      "Integrationsereignis, JARVIS-Aktionshistorie und Auditnachweis bleiben ohne Kontaktdaten-Kopie erhalten.",
    ],
    blockingIssues,
    fingerprint: stableHash({ organizationId: input.organizationId, contact: { id: contact.id, customerNumber: contact.customerNumber, companyName: clean(contact.companyName), firstName: clean(contact.firstName), lastName: clean(contact.lastName), type: contact.type, category: contact.category, updatedAt: contact.updatedAt.toISOString(), deletionMarkedAt: contact.deletionMarkedAt?.toISOString() ?? "" }, reason, references }),
  };
}

export async function executeContactDeletion(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  contactId: string;
  reason: string;
  actorId: string;
  requestId: string;
  expectedFingerprint?: string;
}) {
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workpilot:contact:${input.organizationId}:${input.contactId}`}))`;
  const evaluation = await evaluateContactDeletion({ organizationId: input.organizationId, contactId: input.contactId, reason: input.reason, db: input.tx });
  if (input.expectedFingerprint && evaluation.fingerprint !== input.expectedFingerprint) {
    throw new ContactDeletionServiceError("stale_context", "Kontakt oder Verknüpfungsprüfung haben sich geändert. Bitte öffne eine neue Vorschau.", evaluation.references);
  }
  if (evaluation.blockingIssues.length) throw new ContactDeletionServiceError("conflict", evaluation.blockingIssues.join(" · "), evaluation.references);
  const deleted = await input.tx.contact.deleteMany({ where: { id: input.contactId, organizationId: input.organizationId, updatedAt: new Date(evaluation.contact.updatedAt) } });
  if (deleted.count !== 1) throw new ContactDeletionServiceError("conflict", "Der Kontakt wurde zwischenzeitlich geändert oder bereits gelöscht.");
  await input.tx.contactIntegrationEvent.create({ data: { organizationId: input.organizationId, contactId: input.contactId, eventType: "deleted", changedFields: [] } });
  await input.tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: input.actorId, action: "contact.deleted", entityType: "contact", entityId: input.contactId, payload: { source: "jarvis-or-contact-ui", requestId: clean(input.requestId, 120), customerNumber: evaluation.contact.customerNumber, reason: evaluation.reason, referenceFamiliesChecked: evaluation.references.length } } });
  return { id: input.contactId, customerNumber: evaluation.contact.customerNumber, displayName: evaluation.contact.displayName };
}
