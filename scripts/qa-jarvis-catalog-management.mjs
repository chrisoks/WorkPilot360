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
  const employee = await prisma.user.findFirst({ where: { organizationId: actor.organizationId, role: Role.MITARBEITER, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const foreignOrganization = await prisma.organization.findFirst({ where: { id: { not: actor.organizationId } }, select: { id: true } });
  const now = new Date();
  const suffix = Date.now().toString().slice(-9);
  const ids = { session: randomUUID(), employeeSession: randomUUID(), foreignItem: randomUUID(), package: randomUUID(), packageItem: randomUUID() };
  const draftIds = new Set();
  let createdItemId = "";
  let result;
  await prisma.authSession.create({ data: sessionData(ids.session, actor.id, now) });
  if (employee) await prisma.authSession.create({ data: sessionData(ids.employeeSession, employee.id, now) });
  if (foreignOrganization) await prisma.catalogItem.create({ data: { id: ids.foreignItem, organizationId: foreignOrganization.id, type: "service", number: `L9${suffix}`, name: `QA Fremdleistung ${suffix}`, unit: "Std" } });
  const cookie = `workpilot_session=${token(ids.session)}`;

  try {
    const createDraft = async (message, requestCookie = cookie, actorId = actor.id) => {
      const response = await requestJson("/api/jarvis/chat", requestCookie, { method: "POST", body: JSON.stringify({ actorId, message, context: { activeTab: "dashboard", activeMainView: "dashboard" } }) });
      if (response.payload?.actionDraft?.previewId) draftIds.add(response.payload.actionDraft.previewId);
      return response;
    };
    const command = async (draft, name, phrase = "") => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, {
      method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
      body: JSON.stringify({ actorId: actor.id, actionId: "catalog.manage", command: name, revision: draft.revision, confirmationText: phrase }),
    });

    if (employee) {
      const denied = await createDraft(`Lege eine neue Leistung an: Bezeichnung: QA Nicht erlaubt ${suffix}; Verkaufspreis: 100.`, `workpilot_session=${token(ids.employeeSession)}`, employee.id);
      assert(denied.response.ok && !denied.payload?.actionDraft, `Mitarbeiterrolle erhielt Katalogaktion: ${JSON.stringify(denied.payload)}`);
    }
    if (foreignOrganization) {
      const isolated = await createDraft(`Ändere Katalogposition L9${suffix}: Verkaufspreis: 200.`);
      assert(isolated.response.ok && isolated.payload?.type === "refusal" && !isolated.payload?.actionDraft, "Fremdmandanten-Katalogposition war sichtbar.");
    }

    const cancelResponse = await createDraft(`Lege eine neue Leistung an: Bezeichnung: QA Abbruch ${suffix}; Einkaufspreis: 50; Verkaufspreis: 100; Einheit: Std.`);
    const cancellable = cancelResponse.payload?.actionDraft;
    assert(cancellable?.actionId === "catalog.manage", "Keine Katalog-Abbruchvorschau erzeugt.");
    assert((await command(cancellable, "cancel")).payload?.actionDraft?.state === "cancelled", "Katalogabbruch fehlgeschlagen.");
    assert(await prisma.catalogItem.count({ where: { organizationId: actor.organizationId, name: `QA Abbruch ${suffix}` } }) === 0, "Abbruch hat Katalogposition angelegt.");

    const prepared = await createDraft(`Lege eine neue Leistung an: Bezeichnung: QA JARVIS Katalogleistung ${suffix}; Kategorie: QA; Gewerk: Glasreinigung; Einkaufspreis: 50; Verkaufspreis: 100; Umsatzsteuer: 19; Einheit: Std; Lohnposition: ja; Planungsrelevant: ja; Planminuten je Einheit: 60.`);
    const draft = prepared.payload?.actionDraft;
    assert(draft?.actionId === "catalog.manage" && draft.mode === "create" && draft.state === "awaiting_confirmation" && draft.confirmation?.enabled && !draft.blockingIssues?.length, `Katalogvorschau nicht bereit: ${JSON.stringify(prepared.payload)}`);
    assert(draft.calculation?.grossProfit === 50 && draft.calculation?.marginPercent === 50, "Rohertrag oder Marge sind falsch.");
    assert((await command(draft, "confirm", draft.confirmation.requiredText.toLowerCase())).response.status === 400, "Ungenaue Phrase wurde akzeptiert.");
    const created = await command(draft, "confirm", draft.confirmation.requiredText);
    assert(created.response.ok && created.payload?.actionDraft?.state === "executed", `Kataloganlage fehlgeschlagen: ${JSON.stringify(created.payload)}`);
    createdItemId = created.payload.actionDraft.result?.entityId || "";
    assert(createdItemId, "Katalogpositions-ID fehlt im Ergebnis.");
    assert((await command(draft, "confirm", draft.confirmation.requiredText)).payload?.actionDraft?.result?.entityId === createdItemId, "Replay war nicht idempotent.");

    await prisma.catalogItem.update({ where: { id: createdItemId }, data: { reviewStatus: "approved", reviewedAt: new Date(), reviewedByUserId: actor.id, reviewedByName: "QA Freigabe" } });
    await prisma.catalogItem.create({ data: { id: ids.package, organizationId: actor.organizationId, type: "package", number: `P${suffix}`, name: `QA Paket ${suffix}`, unit: "Pauschal", purchasePrice: 50, salesPrice: 100 } });
    await prisma.catalogPackageItem.create({ data: { id: ids.packageItem, organizationId: actor.organizationId, packageId: ids.package, componentItemId: createdItemId, quantity: 2, position: 1, purchasePriceSnapshot: 50, salesPriceSnapshot: 100 } });
    const number = created.payload.actionDraft.catalogNumber;
    const updatePrepared = await createDraft(`Ändere Katalogposition ${number}: Verkaufspreis: 125; Planminuten je Einheit: 75.`);
    const updateDraft = updatePrepared.payload?.actionDraft;
    assert(updateDraft?.mode === "update" && updateDraft.impacts?.some((impact) => impact.key === "packages" && impact.count === 1), "Paketwirkung fehlt in der Änderungsvorschau.");
    assert(updateDraft.reviewWillBeInvalidated === true && updateDraft.confirmation.requiredText === `KATALOGPOSITION ÄNDERN ${number}`, "Freigabe-Rücksetzung oder Bestätigungsphrase fehlt.");
    assert((await command(updateDraft, "confirm", updateDraft.confirmation.requiredText)).payload?.actionDraft?.state === "executed", "Katalogänderung fehlgeschlagen.");

    const stalePrepared = await createDraft(`Ändere Katalogposition ${number}: Beschreibung: QA Stale-Kontext.`);
    const staleDraft = stalePrepared.payload?.actionDraft;
    assert(staleDraft?.state === "awaiting_confirmation", "Keine Vorschau für Stale-Context-Test erzeugt.");
    await prisma.catalogItem.update({ where: { id: createdItemId }, data: { matchcode: `parallel-${suffix}` } });
    assert((await command(staleDraft, "confirm", staleDraft.confirmation.requiredText)).response.status === 409, "Veraltete Katalogvorschau wurde ausgeführt.");

    const duplicate = await createDraft(`Lege eine neue Leistung an: Bezeichnung: QA JARVIS Katalogleistung ${suffix}; Verkaufspreis: 100.`);
    assert(duplicate.payload?.actionDraft?.actionId === "catalog.manage" && duplicate.payload.actionDraft.state === "awaiting_input" && duplicate.payload.actionDraft.confirmation?.enabled === false, "Dublette wurde nicht fail-closed blockiert.");
    const [item, packageItem, history] = await Promise.all([
      prisma.catalogItem.findUniqueOrThrow({ where: { id: createdItemId } }), prisma.catalogPackageItem.findUniqueOrThrow({ where: { id: ids.packageItem } }),
      prisma.catalogItemHistory.findMany({ where: { organizationId: actor.organizationId, catalogItemId: createdItemId, createdAt: { gte: now } } }),
    ]);
    assert(item.salesPrice === 125 && item.planningMinutesPerUnit === 75 && item.reviewStatus === "needs_review", "Katalogwerte oder Freigabe-Rücksetzung sind falsch.");
    assert(packageItem.purchasePriceSnapshot === 50 && packageItem.salesPriceSnapshot === 100, "Paket-Snapshots wurden unerwartet verändert.");
    const createdHistoryCount = history.filter((entry) => entry.eventType === "created").length;
    const changedHistory = history.filter((entry) => entry.eventType === "field_changed");
    assert(createdHistoryCount === 1 && changedHistory.length >= 2 && changedHistory.every((entry, index, rows) => rows.findIndex((candidate) => candidate.fieldName === entry.fieldName && candidate.oldValue === entry.oldValue && candidate.newValue === entry.newValue) === index), `Kataloghistorie ist nicht exactly-once: created=${createdHistoryCount}, changed=${changedHistory.length}.`);
    result = { baseUrl, roleBoundary: employee ? "verified" : "no-active-employee", tenantBoundary: foreignOrganization ? "verified" : "single-tenant", exactPhrase: true, cancelSafe: true, duplicateBlocked: true, staleContextBlocked: true, replayExactlyOnce: true, createAndUpdate: true, marginVerified: true, reviewInvalidated: true, packageSnapshotsPreserved: true, historyEntries: history.length };
  } finally {
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    await prisma.catalogPackageItem.deleteMany({ where: { id: ids.packageItem } });
    await prisma.catalogItem.deleteMany({ where: { id: { in: [ids.package, createdItemId, ids.foreignItem].filter(Boolean) } } });
    await prisma.authSession.deleteMany({ where: { id: { in: [ids.session, ids.employeeSession] } } });
  }
  const residue = { items: await prisma.catalogItem.count({ where: { id: { in: [ids.package, createdItemId, ids.foreignItem].filter(Boolean) } } }), drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }), sessions: await prisma.authSession.count({ where: { id: { in: [ids.session, ids.employeeSession] } } }) };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
