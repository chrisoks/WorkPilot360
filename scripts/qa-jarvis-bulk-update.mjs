import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = (process.argv.find((item) => item.startsWith("--base-url="))?.split("=")[1] || "http://localhost:3001").replace(/\/$/, "");
const secret = process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
if (!secret) throw new Error("WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET fehlt.");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const token = (sessionId) => { const value = `v2.${sessionId}.1`; return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`; };
const sessionData = (id, userId, at) => ({ id, userId, tokenVersion: 1, createdAt: at, lastSeenAt: at, lastRotatedAt: at, idleExpiresAt: new Date(at.getTime() + 3_600_000), absoluteExpiresAt: new Date(at.getTime() + 3_600_000) });
const requestJson = async (path, cookie, init = {}) => { const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", Origin: baseUrl, Cookie: cookie, ...(init.headers || {}) } }); return { response, payload: await response.json().catch(() => null) }; };

async function main() {
  const actor = await prisma.user.findFirst({ where: { role: Role.GESCHAEFTSFUEHRER, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, organizationId: true } });
  if (!actor) throw new Error("Kein aktiver Geschäftsführungs-Testakteur gefunden.");
  const employeeActor = await prisma.user.findFirst({ where: { organizationId: actor.organizationId, role: Role.MITARBEITER, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const foreignOrganization = await prisma.organization.findFirst({ where: { id: { not: actor.organizationId } }, select: { id: true } });
  const now = new Date(); const suffix = Date.now().toString().slice(-7);
  const sessionIds = { actor: randomUUID(), employee: randomUUID() };
  const draftIds = new Set(); const contactIds = []; let result;
  const categories = ["Kunde", "Partner", "Lieferant", "Kunde", "Partner", "Lieferant"];
  const contacts = await Promise.all(categories.map((category, index) => {
    const id = randomUUID(); contactIds.push(id);
    return prisma.contact.create({ data: { id, organizationId: actor.organizationId, customerNumber: `91${suffix}${index}`, type: "company", category, companyName: `QA Bulk ${suffix}-${index}` }, select: { id: true, customerNumber: true, category: true, updatedAt: true } });
  }));
  const foreignContacts = foreignOrganization ? await Promise.all([0, 1].map((index) => {
    const id = randomUUID(); contactIds.push(id);
    return prisma.contact.create({ data: { id, organizationId: foreignOrganization.id, customerNumber: `92${suffix}${index}`, type: "company", category: "Kunde", companyName: `QA Bulk Fremd ${suffix}-${index}` }, select: { id: true, customerNumber: true } });
  })) : [];
  await prisma.authSession.createMany({ data: [sessionData(sessionIds.actor, actor.id, now), ...(employeeActor ? [sessionData(sessionIds.employee, employeeActor.id, now)] : [])] });
  const cookie = `workpilot_session=${token(sessionIds.actor)}`;
  try {
    const createDraft = async (message, requestCookie = cookie, actorId = actor.id) => {
      const response = await requestJson("/api/jarvis/chat", requestCookie, { method: "POST", body: JSON.stringify({ actorId, message, context: { activeTab: "contacts", activeMainView: "contacts" } }) });
      if (response.payload?.actionDraft?.previewId) draftIds.add(response.payload.actionDraft.previewId);
      return response;
    };
    const command = async (draft, name, phrase = "") => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, { method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" }, body: JSON.stringify({ actorId: actor.id, actionId: "bulk.update", command: name, revision: draft.revision, confirmationText: phrase }) });

    if (employeeActor) {
      const denied = await createDraft(`Archiviere die Kontakte ${contacts[0].customerNumber}, ${contacts[1].customerNumber} als Gruppenaktion.`, `workpilot_session=${token(sessionIds.employee)}`, employeeActor.id);
      assert(!denied.payload?.actionDraft, `Mitarbeiterrolle erhielt eine Kontakt-Massenänderung: ${denied.response.status} ${JSON.stringify(denied.payload)}`);
    }
    if (foreignContacts.length) {
      const isolated = await createDraft(`Archiviere die Kontakte ${foreignContacts.map((contact) => contact.customerNumber).join(", ")} als Gruppenaktion.`);
      assert(isolated.payload?.actionDraft?.state === "awaiting_input" && isolated.payload.actionDraft.items?.length === 0, "Fremdmandanten-Kontakte waren im Dry-Run sichtbar oder ausführbar.");
    }

    const uiRequest = { actorId: actor.id, mode: "apply", customerNumbers: contacts.slice(0, 2).map((contact) => contact.customerNumber), targetCategory: "Archiv" };
    const uiPreview = await requestJson("/api/contacts/bulk-category", cookie, { method: "POST", body: JSON.stringify(uiRequest) });
    assert(uiPreview.response.ok && uiPreview.payload?.evaluation?.items?.length === 2 && uiPreview.payload?.confirmationText === "MASSENÄNDERUNG AUSFÜHREN 2 KONTAKTE", `Normale Gruppenaktion erzeugte keinen vollständigen Dry-Run: ${JSON.stringify(uiPreview.payload)}`);
    const uiExecuted = await requestJson("/api/contacts/bulk-category", cookie, { method: "PATCH", body: JSON.stringify({ ...uiRequest, expectedFingerprint: uiPreview.payload.evaluation.fingerprint, confirmationText: uiPreview.payload.confirmationText }) });
    assert(uiExecuted.response.ok && uiExecuted.payload?.result?.count === 2, `Normale Gruppenaktion nutzte den gemeinsamen Service nicht: ${JSON.stringify(uiExecuted.payload)}`);
    const rollbackPrepared = await createDraft(`Massenänderung ${uiExecuted.payload.requestId} zurückrollen.`); const rollbackDraft = rollbackPrepared.payload?.actionDraft;
    assert(rollbackDraft?.actionId === "bulk.update" && rollbackDraft.mode === "rollback" && rollbackDraft.items?.length === 2 && rollbackDraft.state === "awaiting_confirmation", `JARVIS konnte UI-Massenänderung nicht exakt zurückrollen: ${JSON.stringify(rollbackPrepared.payload)}`);
    assert((await command(rollbackDraft, "confirm", rollbackDraft.confirmation.requiredText)).payload?.actionDraft?.state === "executed", "Rückrollung der UI-Massenänderung fehlgeschlagen.");
    const restored = await prisma.contact.findMany({ where: { id: { in: contacts.slice(0, 2).map((contact) => contact.id) } }, select: { id: true, category: true } });
    assert(contacts.slice(0, 2).every((contact) => restored.find((row) => row.id === contact.id)?.category === contact.category), "Ausgangskategorien wurden nicht exakt wiederhergestellt.");

    const cancelPrepared = await createDraft(`Archiviere die Kontakte ${contacts[2].customerNumber}, ${contacts[3].customerNumber} als Gruppenaktion.`); const cancelDraft = cancelPrepared.payload?.actionDraft;
    assert(cancelDraft?.state === "awaiting_confirmation" && (await command(cancelDraft, "cancel")).payload?.actionDraft?.state === "cancelled", "Massenänderungsabbruch fehlgeschlagen.");

    const stalePrepared = await createDraft(`Archiviere die Kontakte ${contacts[4].customerNumber}, ${contacts[5].customerNumber} als Gruppenaktion.`); const staleDraft = stalePrepared.payload?.actionDraft;
    assert(staleDraft?.state === "awaiting_confirmation", "Kein Dry-Run für Stale-Context-Test erzeugt.");
    await prisma.contact.update({ where: { id: contacts[4].id }, data: { reachability: "QA Stale Context", category: "Privatkunde", updatedAt: new Date() } });
    assert((await command(staleDraft, "confirm", staleDraft.confirmation.requiredText)).response.status === 409, "Veralteter Massenänderungs-Dry-Run wurde ausgeführt.");

    const applyPrepared = await createDraft(`Setze die Kontakte ${contacts[2].customerNumber}, ${contacts[3].customerNumber} auf Kategorie Partner als Massenänderung.`); const applyDraft = applyPrepared.payload?.actionDraft;
    assert(applyDraft?.actionId === "bulk.update" && applyDraft.items?.length === 2 && applyDraft.excluded?.length === 0 && applyDraft.confirmation?.enabled, `JARVIS-Dry-Run unvollständig: ${JSON.stringify(applyPrepared.payload)}`);
    assert((await command(applyDraft, "confirm", applyDraft.confirmation.requiredText.toLowerCase())).response.status === 400, "Ungenaue Massenänderungsphrase wurde akzeptiert.");
    const applied = await command(applyDraft, "confirm", applyDraft.confirmation.requiredText);
    assert(applied.response.ok && applied.payload?.actionDraft?.state === "executed", `JARVIS-Massenänderung fehlgeschlagen: ${JSON.stringify(applied.payload)}`);
    assert((await command(applyDraft, "confirm", applyDraft.confirmation.requiredText)).payload?.actionDraft?.state === "executed", "Massenänderungs-Replay war nicht idempotent.");
    assert(await prisma.auditLog.count({ where: { organizationId: actor.organizationId, action: "contact.bulk-category.changed", entityType: "contact-bulk", entityId: applyDraft.previewId } }) === 1, "JARVIS-Massenänderung wurde nicht exactly-once auditiert.");
    assert(await prisma.contactIntegrationEvent.count({ where: { contactId: { in: contacts.slice(2, 4).map((contact) => contact.id) }, eventType: "updated", changedFields: { equals: ["category"] } } }) === 2, "Integrationsereignisse der Massenänderung fehlen.");
    result = { baseUrl, uiServiceParity: true, roleBoundary: employeeActor ? "verified" : "no-active-employee", tenantBoundary: foreignContacts.length ? "verified" : "single-tenant", exactDryRun: true, maxTargets: 25, allOrNothing: true, exactPhrase: true, cancelSafe: true, staleContextBlocked: true, replayExactlyOnce: true, rollbackExact: true };
  } finally {
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    await prisma.contactIntegrationEvent.deleteMany({ where: { contactId: { in: contactIds } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: actor.organizationId, entityType: "contact-bulk", createdAt: { gte: now } } });
    await prisma.contact.deleteMany({ where: { id: { in: contactIds } } });
    await prisma.authSession.deleteMany({ where: { id: { in: [sessionIds.actor, sessionIds.employee] } } });
  }
  const residue = { contacts: await prisma.contact.count({ where: { id: { in: contactIds } } }), drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }), sessions: await prisma.authSession.count({ where: { id: { in: [sessionIds.actor, sessionIds.employee] } } }), audits: await prisma.auditLog.count({ where: { organizationId: actor.organizationId, entityType: "contact-bulk", createdAt: { gte: now } } }), integrationEvents: await prisma.contactIntegrationEvent.count({ where: { contactId: { in: contactIds } } }) };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
