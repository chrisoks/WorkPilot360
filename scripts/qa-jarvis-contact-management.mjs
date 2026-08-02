import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = (process.argv.find((item) => item.startsWith("--base-url="))?.split("=")[1] || "http://localhost:3001").replace(/\/$/, "");
const secret = process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
if (!secret) throw new Error("WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET fehlt.");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const token = (sessionId) => { const value = `v2.${sessionId}.1`; return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`; };
const sessionData = (id, userId, at) => ({ id, userId, tokenVersion: 1, createdAt: at, lastSeenAt: at, lastRotatedAt: at, idleExpiresAt: new Date(at.getTime() + 3_600_000), absoluteExpiresAt: new Date(at.getTime() + 3_600_000) });
const requestJson = async (path, cookie, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", Origin: baseUrl, Cookie: cookie, ...(init.headers || {}) } });
  return { response, payload: await response.json().catch(() => null) };
};

async function main() {
  const actor = await prisma.user.findFirst({ where: { role: Role.GESCHAEFTSFUEHRER, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, organizationId: true } });
  if (!actor) throw new Error("Kein aktiver Geschäftsführungs-Testakteur gefunden.");
  const employee = await prisma.user.findFirst({ where: { organizationId: actor.organizationId, role: Role.MITARBEITER, isActive: true, OR: [{ salesRoleEnabled: false }, { salesRoleEnabled: null }] }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const foreignOrganization = await prisma.organization.findFirst({ where: { id: { not: actor.organizationId } }, select: { id: true } });
  const now = new Date();
  const suffix = Date.now().toString().slice(-9);
  const ids = { session: randomUUID(), employeeSession: randomUUID(), foreignContact: randomUUID() };
  const draftIds = new Set();
  let createdContactId = "";
  let result;
  await prisma.authSession.create({ data: sessionData(ids.session, actor.id, now) });
  if (employee) await prisma.authSession.create({ data: sessionData(ids.employeeSession, employee.id, now) });
  if (foreignOrganization) await prisma.contact.create({ data: { id: ids.foreignContact, organizationId: foreignOrganization.id, customerNumber: `99${suffix}`, type: "company", category: "Kunde", companyName: `QA Fremdkontakt ${suffix}` } });
  const cookie = `workpilot_session=${token(ids.session)}`;

  try {
    const createDraft = async (message, requestCookie = cookie, actorId = actor.id) => {
      const response = await requestJson("/api/jarvis/chat", requestCookie, { method: "POST", body: JSON.stringify({ actorId, message, context: { activeTab: "dashboard", activeMainView: "dashboard" } }) });
      if (response.payload?.actionDraft?.previewId) draftIds.add(response.payload.actionDraft.previewId);
      return response;
    };
    const command = async (draft, name, phrase = "") => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, {
      method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
      body: JSON.stringify({ actorId: actor.id, actionId: "contact.manage", command: name, revision: draft.revision, confirmationText: phrase }),
    });

    if (employee) {
      const denied = await createDraft(`Lege einen neuen Firmenkontakt an: Firma: QA Nicht erlaubt ${suffix}; E-Mail: denied-${suffix}@example.test.`, `workpilot_session=${token(ids.employeeSession)}`, employee.id);
      assert(denied.response.ok && !denied.payload?.actionDraft, `Mitarbeiterrolle erhielt Kontaktaktion: ${JSON.stringify(denied.payload)}`);
    }
    if (foreignOrganization) {
      const isolated = await createDraft(`Ändere Kontakt Kundennummer 99${suffix}: E-Mail: fremd-${suffix}@example.test.`);
      assert(isolated.response.ok && isolated.payload?.type === "refusal" && !isolated.payload?.actionDraft, "Fremdmandanten-Kontakt war sichtbar.");
    }

    const cancellableResponse = await createDraft(`Lege einen neuen Firmenkontakt an: Firma: QA Abbruch ${suffix}; E-Mail: cancel-${suffix}@example.test.`);
    const cancellable = cancellableResponse.payload?.actionDraft;
    assert(cancellable?.actionId === "contact.manage", "Keine Kontakt-Abbruchvorschau erzeugt.");
    const cancelled = await command(cancellable, "cancel");
    assert(cancelled.payload?.actionDraft?.state === "cancelled", `Kontaktabbruch fehlgeschlagen: HTTP ${cancelled.response.status} ${JSON.stringify(cancelled.payload)}`);
    assert(await prisma.contact.count({ where: { organizationId: actor.organizationId, companyName: `QA Abbruch ${suffix}` } }) === 0, "Abbruch hat Kontakt angelegt.");

    const prepared = await createDraft(`Lege einen neuen Firmenkontakt an: Firma: QA JARVIS Kontakt ${suffix}; E-Mail: kontakt-${suffix}@example.test; Telefon: +49 511 123456; Ort: Hannover.`);
    const draft = prepared.payload?.actionDraft;
    assert(draft?.actionId === "contact.manage" && draft.mode === "create" && draft.state === "awaiting_confirmation" && draft.confirmation?.enabled && !draft.blockingIssues?.length, `Kontaktvorschau nicht bereit: ${JSON.stringify(prepared.payload)}`);
    assert(draft.confirmation.requiredText === `KONTAKT ANLEGEN QA JARVIS Kontakt ${suffix}`, "Bestätigungsphrase falsch.");
    assert(draft.checks?.some((check) => check.key === "duplicate" && check.status === "ok"), "Dublettenprüfung fehlt.");
    assert((await command(draft, "confirm", draft.confirmation.requiredText.toLowerCase())).response.status === 400, "Ungenaue Phrase wurde akzeptiert.");
    const created = await command(draft, "confirm", draft.confirmation.requiredText);
    assert(created.response.ok && created.payload?.actionDraft?.state === "executed", "Kontaktanlage fehlgeschlagen.");
    createdContactId = created.payload.actionDraft.result?.entityId || "";
    assert(createdContactId, "Kontakt-ID fehlt im Ergebnis.");
    assert((await command(draft, "confirm", draft.confirmation.requiredText)).payload?.actionDraft?.result?.entityId === createdContactId, "Replay war nicht idempotent.");

    const contact = await prisma.contact.findUniqueOrThrow({ where: { id: createdContactId } });
    const updatePrepared = await createDraft(`Ändere Kontakt Kundennummer ${contact.customerNumber}: E-Mail: kontakt-neu-${suffix}@example.test; Ort: Buchen.`);
    const updateDraft = updatePrepared.payload?.actionDraft;
    assert(updateDraft?.mode === "update" && updateDraft.changes?.length === 2 && updateDraft.confirmation.requiredText === `KONTAKT ÄNDERN ${contact.customerNumber}`, "Kontaktänderungsvorschau unvollständig.");
    assert((await command(updateDraft, "confirm", updateDraft.confirmation.requiredText)).payload?.actionDraft?.state === "executed", "Kontaktänderung fehlgeschlagen.");

    const stalePrepared = await createDraft(`Ändere Kontakt Kundennummer ${contact.customerNumber}: Position: QA Leitung.`);
    const staleDraft = stalePrepared.payload?.actionDraft;
    assert(staleDraft?.state === "awaiting_confirmation", "Keine Kontaktvorschau für Stale-Context-Test erzeugt.");
    await prisma.contact.update({ where: { id: createdContactId }, data: { source: "Parallele Änderung", updatedAt: new Date() } });
    assert((await command(staleDraft, "confirm", staleDraft.confirmation.requiredText)).response.status === 409, "Veraltete Kontaktvorschau wurde ausgeführt.");

    const [finalContact, events, audits, linkedProjects] = await Promise.all([
      prisma.contact.findUniqueOrThrow({ where: { id: createdContactId } }),
      prisma.contactIntegrationEvent.findMany({ where: { organizationId: actor.organizationId, contactId: createdContactId, occurredAt: { gte: now } } }),
      prisma.auditLog.findMany({ where: { organizationId: actor.organizationId, entityType: "contact", entityId: createdContactId, action: { in: ["contact.created", "contact.changed"] }, createdAt: { gte: now } } }),
      prisma.workPilotProject.count({ where: { organizationId: actor.organizationId, OR: [{ contactId: createdContactId }, { contactPersonId: createdContactId }, { addressContactId: createdContactId }] } }),
    ]);
    assert(finalContact.companyName === `QA JARVIS Kontakt ${suffix}` && finalContact.email === `kontakt-neu-${suffix}@example.test` && finalContact.city === "Buchen", "Kontaktwerte wurden nicht exakt gespeichert.");
    assert(finalContact.phone === "+49511123456" && finalContact.phoneNormalized === "+49511123456" && finalContact.source === "Parallele Änderung", "Normalisierung oder Paralleländerung ging verloren.");
    assert(events.length === 2 && audits.length === 2, "Integrationsereignisse oder Audit sind nicht exactly-once.");
    assert(linkedProjects === 0, "Kontakt wurde unerwartet einem Projekt zugeordnet.");
    result = { baseUrl, roleBoundary: employee ? "verified" : "no-active-employee", tenantBoundary: foreignOrganization ? "verified" : "single-tenant", exactPhrase: true, duplicateCheck: true, cancelSafe: true, staleContextBlocked: true, replayExactlyOnce: true, createAndUpdate: true, phoneNormalized: true, automaticProjectLinks: linkedProjects, integrationEvents: events.length, auditEntries: audits.length };
  } finally {
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    if (createdContactId) {
      await prisma.contactIntegrationEvent.deleteMany({ where: { contactId: createdContactId } });
      await prisma.auditLog.deleteMany({ where: { entityType: "contact", entityId: createdContactId } });
      await prisma.contact.deleteMany({ where: { id: createdContactId } });
    }
    await prisma.contactIntegrationEvent.deleteMany({ where: { contactId: ids.foreignContact } });
    await prisma.contact.deleteMany({ where: { id: ids.foreignContact } });
    await prisma.authSession.deleteMany({ where: { id: { in: [ids.session, ids.employeeSession] } } });
  }
  const residue = { contacts: await prisma.contact.count({ where: { id: { in: [createdContactId, ids.foreignContact].filter(Boolean) } } }), drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }), sessions: await prisma.authSession.count({ where: { id: { in: [ids.session, ids.employeeSession] } } }) };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
