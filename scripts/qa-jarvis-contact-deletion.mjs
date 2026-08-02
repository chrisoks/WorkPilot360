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
  const suffix = Date.now().toString().slice(-8);
  const ids = {
    session: randomUUID(), employeeSession: randomUUID(), deletable: randomUUID(), cancellable: randomUUID(), stale: randomUUID(),
    blocked: randomUUID(), blockerChild: randomUUID(), foreignContact: randomUUID(),
  };
  const numbers = { deletable: `88${suffix}1`, cancellable: `88${suffix}2`, stale: `88${suffix}3`, blocked: `88${suffix}4`, foreign: `88${suffix}5` };
  const draftIds = new Set();
  const createdContactIds = [ids.deletable, ids.cancellable, ids.stale, ids.blocked, ids.blockerChild, ids.foreignContact];
  let result;

  await prisma.authSession.create({ data: sessionData(ids.session, actor.id, now) });
  if (employee) await prisma.authSession.create({ data: sessionData(ids.employeeSession, employee.id, now) });
  await prisma.contact.createMany({ data: [
    { id: ids.deletable, organizationId: actor.organizationId, customerNumber: numbers.deletable, type: "company", category: "Kunde", companyName: `QA Löschbar ${suffix}` },
    { id: ids.cancellable, organizationId: actor.organizationId, customerNumber: numbers.cancellable, type: "company", category: "Kunde", companyName: `QA Abbruch ${suffix}` },
    { id: ids.stale, organizationId: actor.organizationId, customerNumber: numbers.stale, type: "company", category: "Kunde", companyName: `QA Veraltet ${suffix}` },
    { id: ids.blocked, organizationId: actor.organizationId, customerNumber: numbers.blocked, type: "company", category: "Kunde", companyName: `QA Blockiert ${suffix}` },
    { id: ids.blockerChild, organizationId: actor.organizationId, customerNumber: `88${suffix}6`, type: "person", category: "Ansprechpartner", firstName: "QA", lastName: "Unterkontakt", parentCompanyId: ids.blocked },
  ] });
  if (foreignOrganization) await prisma.contact.create({ data: { id: ids.foreignContact, organizationId: foreignOrganization.id, customerNumber: numbers.foreign, type: "company", category: "Kunde", companyName: `QA Fremdkontakt ${suffix}` } });
  const cookie = `workpilot_session=${token(ids.session)}`;

  try {
    const createDraft = async (number, reason = "Versehentliche Doppelanlage", requestCookie = cookie, actorId = actor.id) => {
      const response = await requestJson("/api/jarvis/chat", requestCookie, { method: "POST", body: JSON.stringify({ actorId, message: `Lösche Kontakt ${number} endgültig. Grund: ${reason}.`, context: { activeTab: "dashboard", activeMainView: "dashboard" } }) });
      if (response.payload?.actionDraft?.previewId) draftIds.add(response.payload.actionDraft.previewId);
      return response;
    };
    const command = async (draft, name, phrase = "") => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, {
      method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
      body: JSON.stringify({ actorId: actor.id, actionId: "contact.delete", command: name, revision: draft.revision, confirmationText: phrase }),
    });

    const noNumber = await requestJson("/api/jarvis/chat", cookie, { method: "POST", body: JSON.stringify({ actorId: actor.id, message: "Lösche den Kontakt endgültig." }) });
    assert(noNumber.payload?.topicId === "action.contact-deletion.number-required" && !noNumber.payload?.actionDraft, "Fehlende Kundennummer wurde nicht geklärt.");
    const noReason = await requestJson("/api/jarvis/chat", cookie, { method: "POST", body: JSON.stringify({ actorId: actor.id, message: `Lösche Kontakt ${numbers.deletable} endgültig.` }) });
    assert(noReason.payload?.topicId === "action.contact-deletion.reason-required" && !noReason.payload?.actionDraft, `Fehlender Grund wurde nicht geklärt: ${JSON.stringify(noReason.payload)}`);

    if (employee) {
      const denied = await createDraft(numbers.deletable, "Nicht autorisierter QA-Versuch", `workpilot_session=${token(ids.employeeSession)}`, employee.id);
      assert(denied.response.ok && !denied.payload?.actionDraft, `Mitarbeiterrolle erhielt Kontaktlöschaktion: ${JSON.stringify(denied.payload)}`);
    }
    if (foreignOrganization) {
      const isolated = await createDraft(numbers.foreign);
      assert(isolated.response.ok && isolated.payload?.type === "refusal" && !isolated.payload?.actionDraft, "Fremdmandanten-Kontakt war sichtbar.");
    }

    const blockedResponse = await createDraft(numbers.blocked);
    const blocked = blockedResponse.payload?.actionDraft;
    assert(blocked?.actionId === "contact.delete" && blocked.state === "awaiting_input" && blocked.confirmation?.enabled === false, `Referenzblockade fehlt: ${JSON.stringify(blockedResponse.payload)}`);
    assert(blocked.references?.some((reference) => reference.key === "childContacts" && reference.count === 1), "Unterkontakt wurde nicht als Löschblocker ausgewiesen.");

    const cancellableResponse = await createDraft(numbers.cancellable);
    const cancellable = cancellableResponse.payload?.actionDraft;
    assert(cancellable?.state === "awaiting_confirmation", "Keine abbrechbare Löschvorschau erzeugt.");
    const cancelled = await command(cancellable, "cancel");
    assert(cancelled.payload?.actionDraft?.state === "cancelled", "Kontaktlöschung ließ sich nicht sicher abbrechen.");
    assert(await prisma.contact.count({ where: { id: ids.cancellable } }) === 1, "Abbruch hat den Kontakt gelöscht.");

    const staleResponse = await createDraft(numbers.stale);
    const stale = staleResponse.payload?.actionDraft;
    assert(stale?.state === "awaiting_confirmation", "Keine Vorschau für Stale-Context-Test erzeugt.");
    await prisma.contact.update({ where: { id: ids.stale }, data: { source: "Parallele Änderung", updatedAt: new Date() } });
    assert((await command(stale, "confirm", stale.confirmation.requiredText)).response.status === 409, "Veraltete Löschvorschau wurde ausgeführt.");
    assert(await prisma.contact.count({ where: { id: ids.stale } }) === 1, "Stale-Context-Test löschte den Kontakt.");

    const prepared = await createDraft(numbers.deletable);
    const draft = prepared.payload?.actionDraft;
    assert(draft?.actionId === "contact.delete" && draft.state === "awaiting_confirmation" && draft.confirmation?.enabled && !draft.blockingIssues?.length, `Löschvorschau nicht bereit: ${JSON.stringify(prepared.payload)}`);
    assert(draft.references?.length === 17 && draft.references.every((reference) => reference.count === 0), "Nicht alle 17 Referenzfamilien wurden frei geprüft.");
    assert(draft.confirmation.requiredText === `KONTAKT ENDGÜLTIG LÖSCHEN ${numbers.deletable}`, "Kritische Bestätigungsphrase ist falsch.");
    assert((await command(draft, "confirm", draft.confirmation.requiredText.toLowerCase())).response.status === 400, "Ungenaue Phrase wurde akzeptiert.");
    const executed = await command(draft, "confirm", draft.confirmation.requiredText);
    assert(executed.response.ok && executed.payload?.actionDraft?.state === "executed", `Kontaktlöschung fehlgeschlagen: ${JSON.stringify(executed.payload)}`);
    assert(await prisma.contact.count({ where: { id: ids.deletable } }) === 0, "Kontakt blieb nach bestätigter Löschung bestehen.");
    const replay = await command(draft, "confirm", draft.confirmation.requiredText);
    assert(replay.response.ok && replay.payload?.actionDraft?.state === "executed", "Exactly-once-Replay schlug fehl.");

    const [events, audits] = await Promise.all([
      prisma.contactIntegrationEvent.count({ where: { organizationId: actor.organizationId, contactId: ids.deletable, eventType: "deleted", occurredAt: { gte: now } } }),
      prisma.auditLog.count({ where: { organizationId: actor.organizationId, entityType: "contact", entityId: ids.deletable, action: "contact.deleted", createdAt: { gte: now } } }),
    ]);
    assert(events === 1 && audits === 1, `Löschereignis/Audit nicht exactly-once: Events ${events}, Audits ${audits}`);
    result = { baseUrl, roleBoundary: employee ? "verified" : "no-active-employee", tenantBoundary: foreignOrganization ? "verified" : "single-tenant", missingFieldsClarified: true, allReferenceFamilies: 17, referencedContactBlocked: true, exactPhrase: true, cancelSafe: true, staleContextBlocked: true, replayExactlyOnce: true, deletionEvents: events, deletionAudits: audits };
  } finally {
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    await prisma.contactIntegrationEvent.deleteMany({ where: { contactId: { in: createdContactIds } } });
    await prisma.auditLog.deleteMany({ where: { entityType: "contact", entityId: { in: createdContactIds } } });
    await prisma.contact.deleteMany({ where: { id: ids.blockerChild } });
    await prisma.contact.deleteMany({ where: { id: { in: createdContactIds } } });
    await prisma.authSession.deleteMany({ where: { id: { in: [ids.session, ids.employeeSession] } } });
  }

  const residue = {
    contacts: await prisma.contact.count({ where: { id: { in: createdContactIds } } }),
    drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }),
    sessions: await prisma.authSession.count({ where: { id: { in: [ids.session, ids.employeeSession] } } }),
    events: await prisma.contactIntegrationEvent.count({ where: { contactId: { in: createdContactIds } } }),
    audits: await prisma.auditLog.count({ where: { entityType: "contact", entityId: { in: createdContactIds } } }),
  };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
