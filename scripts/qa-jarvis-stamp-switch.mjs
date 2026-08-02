import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

process.loadEnvFile?.(".env");
const prisma = new PrismaClient();
const baseUrl = (process.argv.find((value) => value.startsWith("--base-url="))?.split("=")[1] || "http://localhost:3001").replace(/\/$/, "");
const secret = process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
if (!secret) throw new Error("WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET fehlt.");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const token = (sessionId) => {
  const value = `v2.${sessionId}.1`;
  return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`;
};
const sessionData = (id, userId, at) => ({ id, userId, tokenVersion: 1, createdAt: at, lastSeenAt: at, lastRotatedAt: at, idleExpiresAt: new Date(at.getTime() + 3_600_000), absoluteExpiresAt: new Date(at.getTime() + 3_600_000) });
const requestJson = async (path, cookie, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", Origin: baseUrl, Cookie: cookie, ...(init.headers || {}) } });
  return { response, payload: await response.json().catch(() => null) };
};

async function main() {
  const occupied = new Set((await prisma.activeStampSession.findMany({ select: { userId: true } })).map((row) => row.userId));
  const candidates = await prisma.user.findMany({
    where: { isActive: true, role: { in: [Role.GESCHAEFTSFUEHRER, Role.ADMIN, Role.FUEHRUNGSKRAFT] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, organizationId: true, firstName: true, lastName: true, email: true, role: true },
  });
  const actor = candidates.find((candidate) => !occupied.has(candidate.id));
  if (!actor) throw new Error("Kein geeigneter Benutzer ohne laufende Stempelung für die Wechsel-QA verfügbar.");
  const now = new Date();
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const ids = { session: randomUUID(), secondSession: randomUUID(), project: randomUUID(), immocareProject: randomUUID(), catalog: randomUUID(), stamp: randomUUID() };
  const projectNumber = `QAW-${Date.now().toString().slice(-8)}`;
  const immocareNumber = `OKI-QAW-${Date.now().toString().slice(-8)}`;
  const catalogNumber = `QAW-${suffix}`;
  const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
  const cookie = `workpilot_session=${token(ids.session)}`;
  const secondCookie = `workpilot_session=${token(ids.secondSession)}`;
  const draftIds = new Set();
  const timeIds = new Set();
  const invoiceIds = new Set();
  let result;

  const createDraft = async (message) => {
    const response = await requestJson("/api/jarvis/chat", cookie, { method: "POST", body: JSON.stringify({ actorId: actor.id, message, context: { activeTab: "dashboard", activeMainView: "dashboard" } }) });
    if (response.payload?.actionDraft?.previewId) draftIds.add(response.payload.actionDraft.previewId);
    if (!response.payload?.actionDraft) throw new Error(`JARVIS hat keinen Wechselentwurf erzeugt: HTTP ${response.response.status} ${JSON.stringify(response.payload)}`);
    return response.payload?.actionDraft;
  };
  const confirm = (draft, phrase, requestCookie = cookie) => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, requestCookie, {
    method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
    body: JSON.stringify({ actorId: actor.id, actionId: "time.session.manage", command: "confirm", revision: draft.revision, confirmationText: phrase }),
  });
  const createStamp = (data) => prisma.activeStampSession.create({ data: {
    id: ids.stamp, organizationId: actor.organizationId, userId: actor.id, employee: actorName,
    startedAt: new Date(now.getTime() - 3_600_000), accumulatedMs: 0n, pauseMs: 0n, ...data,
  } });

  await prisma.authSession.createMany({ data: [sessionData(ids.session, actor.id, now), sessionData(ids.secondSession, actor.id, now)] });
  await prisma.workPilotProject.createMany({ data: [
    { id: ids.project, organizationId: actor.organizationId, projectNumber, title: "QA JARVIS Stunden-Wechsel", customer: "QA intern", status: "Umsetzung", projectType: "Projekt OK solutions", projectKind: "Dauerläufer", recurringBillingMode: "hourly", trade: "QA Gewerk", branch: "OK solutions", responsibleName: actorName },
    { id: ids.immocareProject, organizationId: actor.organizationId, projectNumber: immocareNumber, title: "QA JARVIS Immocare-Wechsel", customer: "QA intern", status: "Umsetzung", projectType: "Projekt OK immocare", projectKind: "Einmalprojekt", trade: "QA Gewerk", branch: "OK immocare", responsibleName: actorName },
  ] });
  await prisma.catalogItem.create({ data: { id: ids.catalog, organizationId: actor.organizationId, type: "service", number: catalogNumber, name: "QA Facharbeiterstunde", trade: "QA Gewerk", unit: "Std", salesPrice: 100, vatRate: 19, isLaborPosition: true, isPlanningRelevant: true, reviewStatus: "reviewed" } });

  try {
    await createStamp({ mode: "unproductive", projectId: "__unproductive__", projectLabel: "QA Ausgang", comment: "QA Ausgangstätigkeit" });
    const simple = await createDraft("Wechsle meine Stempelung zur Folgetätigkeit unproduktiv. Unproduktive Tätigkeit: QA Büroorganisation; Neue Tätigkeit: QA Ablage prüfen");
    assert(simple?.operation === "switch" && simple.confirmation?.requiredText === "STEMPELUNG WECHSELN ZU QA BÜROORGANISATION", `Wechselvorschau ist nicht eindeutig: ${JSON.stringify(simple)}`);
    const wrong = await confirm(simple, "Stempelung wechseln zu QA Büroorganisation");
    assert(wrong.response.status === 400 && await prisma.activeStampSession.count({ where: { id: ids.stamp } }) === 1, "Ungenaue Wechselphrase wurde nicht fail-closed abgewiesen.");
    const crossSession = await confirm(simple, simple.confirmation.requiredText, secondCookie);
    assert(crossSession.response.status === 403 && await prisma.activeStampSession.count({ where: { id: ids.stamp } }) === 1, "Wechselentwurf war nicht an die Sitzung gebunden.");
    const switched = await confirm(simple, simple.confirmation.requiredText);
    assert(switched.response.ok && switched.payload?.actionDraft?.state === "executed", `Einfacher Wechsel fehlgeschlagen: ${JSON.stringify(switched.payload)}`);
    timeIds.add(`${simple.previewId}:stop`);
    assert(await prisma.projectTimeEntry.count({ where: { id: `${simple.previewId}:stop` } }) === 1, "Ausgangszeit des Wechsels fehlt.");
    assert(await prisma.activeStampSession.count({ where: { id: `${simple.previewId}:start`, comment: "QA Ablage prüfen" } }) === 1, "Folgestempelung fehlt.");
    const replay = await confirm(simple, simple.confirmation.requiredText);
    assert(replay.response.ok && await prisma.projectTimeEntry.count({ where: { id: `${simple.previewId}:stop` } }) === 1 && await prisma.activeStampSession.count({ where: { id: `${simple.previewId}:start` } }) === 1, "Wechsel-Replay war nicht exactly-once.");
    await prisma.activeStampSession.delete({ where: { id: `${simple.previewId}:start` } });

    ids.stamp = randomUUID();
    await createStamp({ mode: "project", projectId: ids.project, projectLabel: `${projectNumber} | QA JARVIS Stunden-Wechsel`, trade: "QA Gewerk", billingCatalogItemId: ids.catalog, billingCatalogItemLabel: `${catalogNumber} | QA Facharbeiterstunde`, comment: "QA Stundenleistung" });
    const hourly = await createDraft("Wechsle meine Stempelung zur Folgetätigkeit unproduktiv. Bisherige Arbeit fertig. Bisherige Ergänzung: QA Stundenleistung abgeschlossen; Unproduktive Tätigkeit: QA Nachbereitung; Neue Tätigkeit: QA Dokumentation");
    assert(hourly?.operation === "switch" && hourly.fields?.some((field) => field.label === "Bisherige Abrechnung"), "Stunden-Abrechnungsfolge fehlt in der Wechselvorschau.");
    const hourlyResult = await confirm(hourly, hourly.confirmation.requiredText);
    assert(hourlyResult.response.ok, `Stunden-Wechsel fehlgeschlagen: ${JSON.stringify(hourlyResult.payload)}`);
    timeIds.add(`${hourly.previewId}:stop`);
    const hourlyEntry = await prisma.projectTimeEntry.findUniqueOrThrow({ where: { id: `${hourly.previewId}:stop` } });
    assert(hourlyEntry.invoiceId && hourlyEntry.invoiceNumber, "Stunden-Ausgangszeit wurde nicht einem Rechnungsentwurf zugeordnet.");
    invoiceIds.add(hourlyEntry.invoiceId);
    assert(await prisma.invoiceLineLabor.count({ where: { invoiceId: hourlyEntry.invoiceId, userId: actor.id } }) === 1, "Stunden-Wechsel hat keine eindeutige Rechnungszeit erzeugt.");
    await confirm(hourly, hourly.confirmation.requiredText);
    assert(await prisma.invoiceLineLabor.count({ where: { invoiceId: hourlyEntry.invoiceId, userId: actor.id } }) === 1, "Stunden-Wechsel-Replay hat die Rechnungszeit dupliziert.");
    await prisma.activeStampSession.delete({ where: { id: `${hourly.previewId}:start` } });

    ids.stamp = randomUUID();
    await createStamp({ mode: "project", projectId: ids.immocareProject, projectLabel: `${immocareNumber} | QA JARVIS Immocare-Wechsel`, trade: "QA Gewerk", comment: "QA Immocare-Leistung" });
    const immocare = await createDraft("Wechsle meine Stempelung zur Folgetätigkeit unproduktiv. Bisherige Arbeit fertig. Endkontrolle selbst durchgeführt. Alle Checks erledigt. Bisherige Ergänzung: QA Endkontrolle abgeschlossen; Unproduktive Tätigkeit: QA Nachbereitung; Neue Tätigkeit: QA Dokumentation");
    assert(immocare?.operation === "switch" && immocare.confirmation?.enabled, `Immocare-Wechselvorschau ist blockiert: ${JSON.stringify(immocare)}`);
    const immocareResult = await confirm(immocare, immocare.confirmation.requiredText);
    assert(immocareResult.response.ok, `Immocare-Wechsel fehlgeschlagen: ${JSON.stringify(immocareResult.payload)}`);
    timeIds.add(`${immocare.previewId}:stop`);
    const inspectionRequestId = `${immocare.previewId}:final-inspection`;
    assert(await prisma.projectLogbookEntry.count({ where: { projectId: ids.immocareProject, source: "stamp-session-final-inspection", callReference: inspectionRequestId } }) === 1, "Immocare-Endkontrolle des Wechsels fehlt.");
    await confirm(immocare, immocare.confirmation.requiredText);
    assert(await prisma.projectLogbookEntry.count({ where: { projectId: ids.immocareProject, source: "stamp-session-final-inspection", callReference: inspectionRequestId } }) === 1, "Immocare-Wechsel-Replay hat die Endkontrolle dupliziert.");
    const audits = await prisma.jarvisActionDraftAuditEvent.count({ where: { draftId: { in: [...draftIds] }, eventType: "draft_confirmed_and_executed" } });
    assert(audits === 3, "Wechsel-Audit ist nicht exactly-once.");
    result = { baseUrl, actorRole: actor.role, wrongPhraseRejected: true, sessionBinding: true, atomicSwitchExactlyOnce: true, hourlyInvoiceAttachedExactlyOnce: true, immocareInspectionExactlyOnce: true, auditExecutions: audits };
  } finally {
    await prisma.activeStampSession.deleteMany({ where: { organizationId: actor.organizationId, userId: actor.id, OR: [{ id: ids.stamp }, { id: { in: [...draftIds].map((id) => `${id}:start`) } }] } });
    await prisma.notification.deleteMany({ where: { organizationId: actor.organizationId, linkTargetId: { in: [ids.project, ids.immocareProject] } } });
    await prisma.invoiceLineLabor.deleteMany({ where: { invoiceId: { in: [...invoiceIds] } } });
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: [...invoiceIds] } } });
    await prisma.invoiceHistory.deleteMany({ where: { invoiceId: { in: [...invoiceIds] } } });
    await prisma.invoice.deleteMany({ where: { id: { in: [...invoiceIds] } } });
    await prisma.projectTimeEntry.deleteMany({ where: { id: { in: [...timeIds] } } });
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    const storedFiles = await prisma.storedFile.findMany({ where: { organizationId: actor.organizationId, ownerId: ids.immocareProject, sourceType: "final-inspection-pdf" } });
    if (process.env.WORKPILOT_STORAGE_PROVIDER === "s3" && storedFiles.some((file) => file.status === "available")) {
      const client = new S3Client({
        endpoint: process.env.WORKPILOT_S3_ENDPOINT,
        region: process.env.WORKPILOT_S3_REGION,
        forcePathStyle: process.env.WORKPILOT_S3_FORCE_PATH_STYLE !== "false",
        credentials: { accessKeyId: process.env.WORKPILOT_S3_ACCESS_KEY_ID, secretAccessKey: process.env.WORKPILOT_S3_SECRET_ACCESS_KEY },
      });
      for (const file of storedFiles.filter((item) => item.status === "available")) {
        await client.send(new DeleteObjectCommand({ Bucket: file.storageBucket, Key: file.objectKey }));
      }
      client.destroy();
    }
    await prisma.storedFile.deleteMany({ where: { id: { in: storedFiles.map((file) => file.id) } } });
    await prisma.projectLogbookEntry.deleteMany({ where: { projectId: ids.immocareProject, source: "stamp-session-final-inspection" } });
    await prisma.statusTimelineEntry.deleteMany({ where: { organizationId: actor.organizationId, entityType: "project", entityId: ids.immocareProject } });
    await prisma.auditLog.deleteMany({ where: { organizationId: actor.organizationId, entityType: "project", entityId: ids.immocareProject } });
    await prisma.catalogItem.deleteMany({ where: { id: ids.catalog } });
    await prisma.workPilotProject.deleteMany({ where: { id: { in: [ids.project, ids.immocareProject] } } });
    await prisma.authSession.deleteMany({ where: { id: { in: [ids.session, ids.secondSession] } } });
  }
  const residue = {
    drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }),
    sessions: await prisma.authSession.count({ where: { id: { in: [ids.session, ids.secondSession] } } }),
    times: await prisma.projectTimeEntry.count({ where: { id: { in: [...timeIds] } } }),
    invoices: await prisma.invoice.count({ where: { id: { in: [...invoiceIds] } } }),
    projects: await prisma.workPilotProject.count({ where: { id: { in: [ids.project, ids.immocareProject] } } }),
  };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
