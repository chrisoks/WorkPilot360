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
const settingWhere = (organizationId) => ({ organizationId_key: { organizationId, key: "deadlines" } });
const jsonText = (value) => JSON.stringify(value ?? null);

async function main() {
  const actor = await prisma.user.findFirst({ where: { role: Role.GESCHAEFTSFUEHRER, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, organizationId: true } });
  if (!actor) throw new Error("Kein aktiver Geschäftsführungs-Testakteur gefunden.");
  const restrictedActor = await prisma.user.findFirst({ where: { organizationId: actor.organizationId, role: { notIn: [Role.ADMIN, Role.GESCHAEFTSFUEHRER] }, isActive: true }, orderBy: [{ role: "asc" }, { createdAt: "asc" }], select: { id: true, role: true } });
  if (!restrictedActor) throw new Error("Kein aktiver Akteur ohne Stammdatenberechtigung gefunden.");
  const foreignOrganization = await prisma.organization.findFirst({ where: { id: { not: actor.organizationId } }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const originalSetting = await prisma.organizationSetting.findUnique({ where: settingWhere(actor.organizationId), select: { id: true, value: true, createdAt: true, updatedAt: true } });
  const foreignSetting = foreignOrganization ? await prisma.organizationSetting.findUnique({ where: settingWhere(foreignOrganization.id), select: { id: true, value: true, createdAt: true, updatedAt: true } }) : null;
  const originalValue = originalSetting?.value && typeof originalSetting.value === "object" && !Array.isArray(originalSetting.value) ? originalSetting.value : {};
  const originalEnabled = originalValue.projectStatusEscalationEnabled === true;
  const storedRule = Array.isArray(originalValue.projectStatusRules) ? originalValue.projectStatusRules.find((rule) => rule?.status === "Umsetzung") : null;
  const originalRule = {
    status: "Umsetzung",
    enabled: storedRule?.enabled !== false,
    responsibleAfterDays: Number.isInteger(storedRule?.responsibleAfterDays) ? storedRule.responsibleAfterDays : 14,
    managementAfterDays: Number.isInteger(storedRule?.managementAfterDays) ? storedRule.managementAfterDays : 28,
  };
  const targetRule = originalRule.responsibleAfterDays === 10 && originalRule.managementAfterDays === 20
    ? { ...originalRule, responsibleAfterDays: 11, managementAfterDays: 21 }
    : { ...originalRule, responsibleAfterDays: 10, managementAfterDays: 20 };
  const now = new Date();
  const sessionIds = { actor: randomUUID(), restricted: randomUUID() };
  const draftIds = new Set();
  let result;

  const restoreOriginalSetting = async () => {
    if (originalSetting) {
      await prisma.organizationSetting.update({
        where: settingWhere(actor.organizationId),
        data: { value: originalSetting.value, updatedAt: originalSetting.updatedAt },
      });
    } else {
      await prisma.organizationSetting.deleteMany({ where: { organizationId: actor.organizationId, key: "deadlines" } });
    }
  };

  await prisma.authSession.createMany({ data: [sessionData(sessionIds.actor, actor.id, now), sessionData(sessionIds.restricted, restrictedActor.id, now)] });
  const actorCookie = `workpilot_session=${token(sessionIds.actor)}`;
  const restrictedCookie = `workpilot_session=${token(sessionIds.restricted)}`;
  const createDraft = async (message, cookie = actorCookie, actorId = actor.id) => {
    const response = await requestJson("/api/jarvis/chat", cookie, { method: "POST", body: JSON.stringify({ actorId, message, context: { activeTab: "dashboard", activeMainView: "dashboard" } }) });
    if (response.payload?.actionDraft?.previewId) draftIds.add(response.payload.actionDraft.previewId);
    return response;
  };
  const command = (draft, commandName, confirmationText = "") => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, actorCookie, { method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" }, body: JSON.stringify({ actorId: actor.id, actionId: "automation.manage", command: commandName, revision: draft.revision, confirmationText }) });
  const changeCommand = originalEnabled ? "Deaktiviere die Projektstatus-Frühwarnung." : "Aktiviere die Projektstatus-Frühwarnung.";
  const restoreCommand = originalEnabled ? "Aktiviere die Projektstatus-Frühwarnung." : "Deaktiviere die Projektstatus-Frühwarnung.";
  const ruleCommand = `Ändere die Projektstatus-Regel Umsetzung: verantwortliche Person nach ${targetRule.responsibleAfterDays} Tagen, Geschäftsführung nach ${targetRule.managementAfterDays} Tagen.`;

  try {
    const denied = await createDraft(changeCommand, restrictedCookie, restrictedActor.id);
    assert(!denied.payload?.actionDraft, `${restrictedActor.role} erhielt eine Automationsänderung: ${denied.response.status} ${JSON.stringify(denied.payload)}`);

    const cancelPrepared = await createDraft(changeCommand); const cancelDraft = cancelPrepared.payload?.actionDraft;
    assert(cancelPrepared.response.ok && cancelDraft?.actionId === "automation.manage" && cancelDraft.state === "awaiting_confirmation" && cancelDraft.currentEnabled === originalEnabled && cancelDraft.targetEnabled === !originalEnabled && cancelDraft.confirmation?.enabled === true && cancelDraft.checks?.some((check) => check.key === "delivery" && check.status === "ok"), `Der Automations-Dry-Run ist unvollständig: ${JSON.stringify(cancelPrepared.payload)}`);
    const wrongPhrase = await command(cancelDraft, "confirm", cancelDraft.confirmation.requiredText.toLowerCase());
    assert(wrongPhrase.response.status === 400, "Eine ungenaue Bestätigungsphrase wurde akzeptiert.");
    const afterWrongPhrase = await prisma.organizationSetting.findUnique({ where: settingWhere(actor.organizationId), select: { value: true, updatedAt: true } });
    assert(jsonText(afterWrongPhrase?.value) === jsonText(originalSetting?.value) && (afterWrongPhrase?.updatedAt?.toISOString() ?? null) === (originalSetting?.updatedAt.toISOString() ?? null), "Dry-Run oder Fehlversuch haben die Einstellung verändert.");
    assert((await command(cancelDraft, "cancel")).payload?.actionDraft?.state === "cancelled", "Der sichere Abbruch schlug fehl.");

    const stalePrepared = await createDraft(changeCommand); const staleDraft = stalePrepared.payload?.actionDraft;
    assert(staleDraft?.state === "awaiting_confirmation", "Für den Stale-Context-Test wurde kein ausführbarer Dry-Run erzeugt.");
    if (originalSetting) {
      await prisma.organizationSetting.update({ where: settingWhere(actor.organizationId), data: { value: { ...originalValue, qaAutomationContextNonce: randomUUID() } } });
    } else {
      await prisma.organizationSetting.create({ data: { id: randomUUID(), organizationId: actor.organizationId, key: "deadlines", value: { projectStatusEscalationEnabled: false, qaAutomationContextNonce: randomUUID() } } });
    }
    const staleResult = await command(staleDraft, "confirm", staleDraft.confirmation.requiredText);
    assert(staleResult.response.status === 409, `Ein veralteter Automations-Dry-Run wurde ausgeführt: ${staleResult.response.status} ${JSON.stringify(staleResult.payload)}`);
    await restoreOriginalSetting();

    const notificationsBefore = await prisma.notification.count({ where: { organizationId: actor.organizationId } });
    const eventsBefore = await prisma.statusEscalationEvent.count({ where: { organizationId: actor.organizationId } });
    const changedPrepared = await createDraft(changeCommand); const changedDraft = changedPrepared.payload?.actionDraft;
    assert(changedDraft?.state === "awaiting_confirmation" && changedDraft.currentEnabled === originalEnabled && changedDraft.targetEnabled === !originalEnabled, `Änderung wurde nicht korrekt vorbereitet: ${JSON.stringify(changedPrepared.payload)}`);
    const changed = await command(changedDraft, "confirm", changedDraft.confirmation.requiredText);
    assert(changed.response.ok && changed.payload?.actionDraft?.state === "executed", `Schalteränderung fehlgeschlagen: ${JSON.stringify(changed.payload)}`);
    assert((await command(changedDraft, "confirm", changedDraft.confirmation.requiredText)).payload?.actionDraft?.state === "executed", "Replay war nicht idempotent.");
    const changedSetting = await prisma.organizationSetting.findUnique({ where: settingWhere(actor.organizationId) });
    assert(changedSetting?.value?.projectStatusEscalationEnabled === !originalEnabled, "Der geprüfte Zielzustand wurde nicht gespeichert.");
    assert(await prisma.auditLog.count({ where: { organizationId: actor.organizationId, action: "automation.project-status.changed", entityType: "organization-setting", payload: { path: ["requestId"], equals: changedDraft.previewId } } }) === 1, "Die Änderung wurde nicht exactly-once auditiert.");

    const restoredPrepared = await createDraft(restoreCommand); const restoredDraft = restoredPrepared.payload?.actionDraft;
    assert(restoredDraft?.state === "awaiting_confirmation" && restoredDraft.targetEnabled === originalEnabled, `Wiederherstellung wurde nicht korrekt vorbereitet: ${JSON.stringify(restoredPrepared.payload)}`);
    const restored = await command(restoredDraft, "confirm", restoredDraft.confirmation.requiredText);
    assert(restored.response.ok && restored.payload?.actionDraft?.state === "executed", `Wiederherstellung fehlgeschlagen: ${JSON.stringify(restored.payload)}`);

    const beforeRuleSetting = await prisma.organizationSetting.findUnique({ where: settingWhere(actor.organizationId), select: { value: true } });
    const beforeRuleValue = beforeRuleSetting?.value && typeof beforeRuleSetting.value === "object" && !Array.isArray(beforeRuleSetting.value) ? beforeRuleSetting.value : {};
    const beforeRuleRules = Array.isArray(beforeRuleValue.projectStatusRules) ? beforeRuleValue.projectStatusRules : [];
    const preparedRule = await createDraft(ruleCommand); const ruleDraft = preparedRule.payload?.actionDraft;
    assert(
      preparedRule.response.ok &&
      ruleDraft?.actionId === "automation.manage" &&
      ruleDraft.state === "awaiting_confirmation" &&
      ruleDraft.operation === "rule" &&
      ruleDraft.rule?.status === "Umsetzung" &&
      ruleDraft.rule?.before?.enabled === originalRule.enabled &&
      ruleDraft.rule?.before?.responsibleAfterDays === originalRule.responsibleAfterDays &&
      ruleDraft.rule?.before?.managementAfterDays === originalRule.managementAfterDays &&
      ruleDraft.rule?.after?.enabled === originalRule.enabled &&
      ruleDraft.rule?.after?.responsibleAfterDays === targetRule.responsibleAfterDays &&
      ruleDraft.rule?.after?.managementAfterDays === targetRule.managementAfterDays &&
      typeof ruleDraft.currentImpact?.monitoredProjects === "number" &&
      typeof ruleDraft.targetImpact?.monitoredProjects === "number" &&
      ruleDraft.confirmation?.requiredText === "PROJEKTSTATUS-REGEL ÄNDERN UMSETZUNG",
      `Der Regel-Dry-Run ist unvollständig: ${JSON.stringify(preparedRule.payload)}`,
    );
    const changedRule = await command(ruleDraft, "confirm", ruleDraft.confirmation.requiredText);
    assert(changedRule.response.ok && changedRule.payload?.actionDraft?.state === "executed", `Regeländerung fehlgeschlagen: ${JSON.stringify(changedRule.payload)}`);
    assert((await command(ruleDraft, "confirm", ruleDraft.confirmation.requiredText)).payload?.actionDraft?.state === "executed", "Regel-Replay war nicht idempotent.");
    const afterRuleSetting = await prisma.organizationSetting.findUnique({ where: settingWhere(actor.organizationId), select: { value: true } });
    const afterRuleValue = afterRuleSetting?.value && typeof afterRuleSetting.value === "object" && !Array.isArray(afterRuleSetting.value) ? afterRuleSetting.value : {};
    const afterRuleRules = Array.isArray(afterRuleValue.projectStatusRules) ? afterRuleValue.projectStatusRules : [];
    const savedRule = afterRuleRules.find((rule) => rule?.status === "Umsetzung");
    assert(savedRule?.enabled === originalRule.enabled && savedRule?.responsibleAfterDays === targetRule.responsibleAfterDays && savedRule?.managementAfterDays === targetRule.managementAfterDays, "Die geprüfte Zielregel wurde nicht exakt gespeichert.");
    assert(
      jsonText(beforeRuleRules.filter((rule) => rule?.status !== "Umsetzung")) === jsonText(afterRuleRules.filter((rule) => rule?.status !== "Umsetzung")),
      "Die Regeländerung hat andere Projektstatus-Regeln verändert.",
    );
    assert(
      jsonText({ ...beforeRuleValue, projectStatusRules: undefined }) === jsonText({ ...afterRuleValue, projectStatusRules: undefined }),
      "Die Regeländerung hat Einstellungen außerhalb der Projektstatus-Regeln verändert.",
    );
    assert(await prisma.auditLog.count({ where: { organizationId: actor.organizationId, action: "automation.project-status.changed", entityType: "organization-setting", payload: { path: ["requestId"], equals: ruleDraft.previewId } } }) === 1, "Die Regeländerung wurde nicht exactly-once auditiert.");
    await restoreOriginalSetting();
    assert(await prisma.notification.count({ where: { organizationId: actor.organizationId } }) === notificationsBefore, "Die Schalteränderung hat unerwartet Benachrichtigungen erzeugt.");
    assert(await prisma.statusEscalationEvent.count({ where: { organizationId: actor.organizationId } }) === eventsBefore, "Die Schalteränderung hat unerwartet einen Eskalationslauf ausgelöst.");
    if (foreignOrganization) {
      const currentForeignSetting = await prisma.organizationSetting.findUnique({ where: settingWhere(foreignOrganization.id), select: { id: true, value: true, createdAt: true, updatedAt: true } });
      assert(jsonText(currentForeignSetting) === jsonText(foreignSetting), "Eine fremde Organisationseinstellung wurde verändert.");
    }
    result = { baseUrl, originalEnabled, roleBoundary: restrictedActor.role, tenantBoundary: foreignOrganization ? "verified" : "single-tenant", exactDryRun: true, ruleBeforeAfterDryRun: true, oneNamedRuleOnly: true, noImmediateDelivery: true, exactPhrase: true, cancelSafe: true, staleContextBlocked: true, changedAndRestored: true, replayExactlyOnce: true, auditExactlyOnce: true };
  } finally {
    await restoreOriginalSetting();
    for (const draftId of draftIds) {
      await prisma.auditLog.deleteMany({ where: { organizationId: actor.organizationId, action: "automation.project-status.changed", entityType: "organization-setting", payload: { path: ["requestId"], equals: draftId } } });
    }
    if (draftIds.size) await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] }, organizationId: actor.organizationId } });
    await prisma.authSession.deleteMany({ where: { id: { in: [sessionIds.actor, sessionIds.restricted] } } });
  }

  const restoredSetting = await prisma.organizationSetting.findUnique({ where: settingWhere(actor.organizationId), select: { id: true, value: true, createdAt: true, updatedAt: true } });
  const residue = {
    settingRestored: jsonText(restoredSetting) === jsonText(originalSetting),
    drafts: draftIds.size ? await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }) : 0,
    sessions: await prisma.authSession.count({ where: { id: { in: [sessionIds.actor, sessionIds.restricted] } } }),
    automationAudits: draftIds.size ? await prisma.auditLog.count({ where: { organizationId: actor.organizationId, action: "automation.project-status.changed", entityType: "organization-setting", OR: [...draftIds].map((draftId) => ({ payload: { path: ["requestId"], equals: draftId } })) } }) : 0,
  };
  assert(residue.settingRestored && residue.drafts === 0 && residue.sessions === 0 && residue.automationAudits === 0, `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
