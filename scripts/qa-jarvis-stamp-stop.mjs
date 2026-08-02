import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

process.loadEnvFile?.(".env");

const prisma = new PrismaClient();
const baseUrl = (process.argv.find((item) => item.startsWith("--base-url="))?.split("=")[1] || "http://localhost:3001").replace(/\/$/, "");
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
  if (!actor) throw new Error("Kein geeigneter aktiver Benutzer ohne laufende Stempelung für die Stopp-QA verfügbar.");
  const now = new Date();
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const ids = {
    session: randomUUID(), secondSession: randomUUID(), project: randomUUID(), immocareProject: randomUUID(),
    catalog: randomUUID(), unproductiveStamp: randomUUID(), hourlyStamp: randomUUID(), immocareStamp: randomUUID(),
  };
  const projectNumber = `QAS-${Date.now().toString().slice(-8)}`;
  const immocareProjectNumber = `OKI-QAS-${Date.now().toString().slice(-8)}`;
  const catalogNumber = `QA-${suffix}`;
  const draftIds = new Set();
  const timeEntryIds = new Set();
  const invoiceIds = new Set();
  const cookie = `workpilot_session=${token(ids.session)}`;
  const secondCookie = `workpilot_session=${token(ids.secondSession)}`;
  const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
  let result;

  await prisma.authSession.createMany({ data: [sessionData(ids.session, actor.id, now), sessionData(ids.secondSession, actor.id, now)] });
  await prisma.workPilotProject.create({ data: {
    id: ids.project, organizationId: actor.organizationId, projectNumber, title: "QA JARVIS Stunden-Stopp",
    customer: "QA intern", status: "Umsetzung", projectType: "Projekt OK solutions", projectKind: "Dauerläufer",
    recurringBillingMode: "hourly", trade: "QA Gewerk", branch: "OK solutions", responsibleName: actorName,
  } });
  await prisma.workPilotProject.create({ data: {
    id: ids.immocareProject, organizationId: actor.organizationId, projectNumber: immocareProjectNumber,
    title: "QA JARVIS Immocare-Endkontrolle", customer: "QA intern", status: "Umsetzung",
    projectType: "Projekt OK immocare", projectKind: "Einmalprojekt", trade: "QA Gewerk",
    branch: "OK immocare", responsibleName: actorName,
  } });
  await prisma.catalogItem.create({ data: {
    id: ids.catalog, organizationId: actor.organizationId, type: "service", number: catalogNumber,
    name: "QA Facharbeiterstunde", trade: "QA Gewerk", unit: "Std", salesPrice: 100,
    vatRate: 19, isLaborPosition: true, isPlanningRelevant: true, reviewStatus: "reviewed",
  } });

  const createDraft = async (message) => {
    const response = await requestJson("/api/jarvis/chat", cookie, { method: "POST", body: JSON.stringify({ actorId: actor.id, message, context: { activeTab: "dashboard", activeMainView: "dashboard" } }) });
    if (response.payload?.actionDraft?.previewId) draftIds.add(response.payload.actionDraft.previewId);
    return response;
  };
  const command = async (draft, phrase, requestCookie = cookie) => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, requestCookie, {
    method: "POST", headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
    body: JSON.stringify({ actorId: actor.id, actionId: "time.session.manage", command: "confirm", revision: draft.revision, confirmationText: phrase }),
  });

  try {
    await prisma.activeStampSession.create({ data: {
      id: ids.unproductiveStamp, organizationId: actor.organizationId, userId: actor.id, employee: actorName,
      mode: "unproductive", projectId: "__unproductive__", projectLabel: "QA Büroorganisation", comment: "QA Ablage",
      startedAt: new Date(now.getTime() - 1_800_000), accumulatedMs: 0n, pauseMs: 0n,
    } });
    const unproductive = (await createDraft("Beende meine laufende Stempelung.")).payload?.actionDraft;
    assert(unproductive?.operation === "stop" && unproductive.confirmation?.requiredText === "STEMPELUNG STOPPEN", "Unproduktive Stoppvorschau ist nicht eindeutig.");
    const wrong = await command(unproductive, "Stempelung stoppen");
    assert(wrong.response.status === 400 && await prisma.activeStampSession.count({ where: { id: ids.unproductiveStamp } }) === 1, "Ungenaue Stopp-Phrase wurde nicht fail-closed abgewiesen.");
    const crossSession = await command(unproductive, unproductive.confirmation.requiredText, secondCookie);
    assert(crossSession.response.status === 403 && await prisma.activeStampSession.count({ where: { id: ids.unproductiveStamp } }) === 1, "Stoppentwurf war nicht an die Sitzung gebunden.");
    const stoppedUnproductive = await command(unproductive, unproductive.confirmation.requiredText);
    assert(stoppedUnproductive.response.ok && stoppedUnproductive.payload?.actionDraft?.state === "executed", "Unproduktive Stempelung wurde nicht beendet.");
    timeEntryIds.add(unproductive.previewId);
    assert(await prisma.activeStampSession.count({ where: { id: ids.unproductiveStamp } }) === 0, "Unproduktive aktive Stempelung blieb bestehen.");
    assert(await prisma.projectTimeEntry.count({ where: { id: unproductive.previewId, entrySource: "stamped" } }) === 1, "Unproduktive Zeitbuchung fehlt.");
    const unproductiveReplay = await command(unproductive, unproductive.confirmation.requiredText);
    assert(unproductiveReplay.response.ok && await prisma.projectTimeEntry.count({ where: { id: unproductive.previewId } }) === 1, "Unproduktiver Stopp-Replay war nicht exactly-once.");

    await prisma.activeStampSession.create({ data: {
      id: ids.hourlyStamp, organizationId: actor.organizationId, userId: actor.id, employee: actorName,
      mode: "project", projectId: ids.project, projectLabel: `${projectNumber} | QA JARVIS Stunden-Stopp`, trade: "QA Gewerk",
      billingCatalogItemId: ids.catalog, billingCatalogItemLabel: `${catalogNumber} | QA Facharbeiterstunde`, comment: "QA Stundenleistung",
      startedAt: new Date(now.getTime() - 3_600_000), accumulatedMs: 0n, pauseMs: 0n,
    } });
    const hourly = (await createDraft("Beende meine laufende Stempelung. Arbeit fertig. Ergänzung: QA Leistung abgeschlossen.")).payload?.actionDraft;
    assert(hourly?.operation === "stop" && hourly.confirmation?.requiredText === `STEMPELUNG BEENDEN FERTIG ${projectNumber}`, "Stunden-Stoppvorschau oder Bestätigungsphrase ist falsch.");
    assert(hourly.fields?.some((field) => field.label === "Abrechnung"), "Rechnungsfolge fehlt in der Stunden-Stoppvorschau.");
    const stoppedHourly = await command(hourly, hourly.confirmation.requiredText);
    assert(stoppedHourly.response.ok && stoppedHourly.payload?.actionDraft?.state === "executed", `Stundenstempelung wurde nicht vollständig beendet: ${JSON.stringify(stoppedHourly.payload)}`);
    timeEntryIds.add(hourly.previewId);
    const entry = await prisma.projectTimeEntry.findUniqueOrThrow({ where: { id: hourly.previewId } });
    assert(entry.completionStatus === "finished" && entry.invoiceId && entry.invoiceNumber, "Stundenzeit wurde nicht fertig und rechnungsgebunden gespeichert.");
    invoiceIds.add(entry.invoiceId);
    assert(await prisma.invoiceLineLabor.count({ where: { invoiceId: entry.invoiceId, userId: actor.id } }) === 1, "Stunden-Rechnungsentwurf enthält nicht genau einen Mitarbeitereintrag.");
    const hourlyReplay = await command(hourly, hourly.confirmation.requiredText);
    assert(hourlyReplay.response.ok, "Stunden-Stopp-Replay ist fehlgeschlagen.");
    assert(await prisma.projectTimeEntry.count({ where: { id: hourly.previewId } }) === 1, "Stunden-Stopp-Replay hat die Zeit dupliziert.");
    assert(await prisma.invoiceLineLabor.count({ where: { invoiceId: entry.invoiceId, userId: actor.id } }) === 1, "Stunden-Stopp-Replay hat die Rechnungszeit dupliziert.");

    await prisma.activeStampSession.create({ data: {
      id: ids.immocareStamp, organizationId: actor.organizationId, userId: actor.id, employee: actorName,
      mode: "project", projectId: ids.immocareProject,
      projectLabel: `${immocareProjectNumber} | QA JARVIS Immocare-Endkontrolle`, trade: "QA Gewerk",
      comment: "QA Immocare-Leistung", startedAt: new Date(now.getTime() - 2_700_000), accumulatedMs: 0n, pauseMs: 0n,
    } });
    const immocare = (await createDraft("Beende meine laufende Stempelung. Arbeit fertig. Endkontrolle selbst durchgeführt. Alle Checks erledigt. Ergänzung: QA Endkontrolle abgeschlossen.")).payload?.actionDraft;
    assert(immocare?.operation === "stop" && immocare.confirmation?.requiredText === `STEMPELUNG BEENDEN FERTIG ${immocareProjectNumber}`, "Immocare-Stoppvorschau oder Bestätigungsphrase ist falsch.");
    assert(immocare.confirmation?.enabled && immocare.checks?.some((check) => check.key === "final-inspection"), `Verpflichtende Immocare-Endkontrolle fehlt in der Vorschau: ${JSON.stringify(immocare)}`);
    const stoppedImmocare = await command(immocare, immocare.confirmation.requiredText);
    assert(stoppedImmocare.response.ok && stoppedImmocare.payload?.actionDraft?.state === "executed", `Immocare-Stempelung wurde nicht vollständig beendet: ${JSON.stringify(stoppedImmocare.payload)}`);
    timeEntryIds.add(immocare.previewId);
    const inspectionRequestId = `${immocare.previewId}:final-inspection`;
    const inspection = await prisma.projectLogbookEntry.findFirst({ where: { organizationId: actor.organizationId, projectId: ids.immocareProject, source: "stamp-session-final-inspection", callReference: inspectionRequestId } });
    assert(inspection?.title === "Dokumente: Endkontrolle", "Immocare-Endkontrolle wurde nicht im Projektlogbuch gespeichert.");
    const storedInspection = await prisma.storedFile.findFirst({ where: { organizationId: actor.organizationId, ownerType: "project", ownerId: ids.immocareProject, sourceType: "final-inspection-pdf" } });
    const inspectionAttachments = Array.isArray(inspection.attachments) ? inspection.attachments : [];
    if (process.env.WORKPILOT_STORAGE_PROVIDER === "s3") {
      assert(storedInspection?.status === "available" && storedInspection.contentType === "application/pdf" && storedInspection.sizeBytes > 0, "Endkontroll-PDF wurde nicht verfügbar im privaten Dateispeicher registriert.");
    } else {
      assert(inspectionAttachments.some((attachment) => typeof attachment?.dataUrl === "string" && attachment.dataUrl.startsWith("data:application/pdf;base64,")), "Endkontroll-PDF fehlt im lokalen Datenbank-Fallback.");
    }
    const immocareReplay = await command(immocare, immocare.confirmation.requiredText);
    assert(immocareReplay.response.ok, "Immocare-Stopp-Replay ist fehlgeschlagen.");
    assert(await prisma.projectLogbookEntry.count({ where: { projectId: ids.immocareProject, source: "stamp-session-final-inspection", callReference: inspectionRequestId } }) === 1, "Immocare-Stopp-Replay hat die Endkontrolle dupliziert.");
    const audits = await prisma.jarvisActionDraftAuditEvent.count({ where: { draftId: { in: [...draftIds] }, eventType: "draft_confirmed_and_executed" } });
    assert(audits === 3, "Stopp-Audit ist nicht exactly-once.");
    result = { baseUrl, actorRole: actor.role, wrongPhraseRejected: true, sessionBinding: true, unproductiveStopExactlyOnce: true, hourlyStopExactlyOnce: true, hourlyInvoiceAttached: true, immocareFinalInspectionExactlyOnce: true, auditExecutions: audits };
  } finally {
    await prisma.notification.deleteMany({ where: { organizationId: actor.organizationId, linkTargetId: { in: [ids.project, ids.immocareProject] } } });
    await prisma.invoiceLineLabor.deleteMany({ where: { invoiceId: { in: [...invoiceIds] } } });
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: [...invoiceIds] } } });
    await prisma.invoiceHistory.deleteMany({ where: { invoiceId: { in: [...invoiceIds] } } });
    await prisma.invoice.deleteMany({ where: { id: { in: [...invoiceIds] } } });
    await prisma.projectTimeEntry.deleteMany({ where: { id: { in: [...timeEntryIds] } } });
    await prisma.activeStampSession.deleteMany({ where: { id: { in: [ids.unproductiveStamp, ids.hourlyStamp, ids.immocareStamp] } } });
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    const storedFiles = await prisma.storedFile.findMany({ where: { organizationId: actor.organizationId, ownerType: "project", ownerId: ids.immocareProject, sourceType: "final-inspection-pdf" } });
    if (process.env.WORKPILOT_STORAGE_PROVIDER === "s3" && storedFiles.some((file) => file.status === "available")) {
      const client = new S3Client({
        endpoint: process.env.WORKPILOT_S3_ENDPOINT, region: process.env.WORKPILOT_S3_REGION,
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
    stamps: await prisma.activeStampSession.count({ where: { id: { in: [ids.unproductiveStamp, ids.hourlyStamp, ids.immocareStamp] } } }),
    times: await prisma.projectTimeEntry.count({ where: { id: { in: [...timeEntryIds] } } }),
    invoices: await prisma.invoice.count({ where: { id: { in: [...invoiceIds] } } }),
    project: await prisma.workPilotProject.count({ where: { id: { in: [ids.project, ids.immocareProject] } } }),
    catalog: await prisma.catalogItem.count({ where: { id: ids.catalog } }),
    inspections: await prisma.projectLogbookEntry.count({ where: { projectId: ids.immocareProject, source: "stamp-session-final-inspection" } }),
    storedFiles: await prisma.storedFile.count({ where: { ownerId: ids.immocareProject, sourceType: "final-inspection-pdf" } }),
  };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
