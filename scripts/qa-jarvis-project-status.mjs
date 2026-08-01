import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = (process.argv.find((item) => item.startsWith("--base-url="))?.split("=")[1] || "http://localhost:3001").replace(/\/$/, "");
const secret = process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
if (!secret) throw new Error("WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET fehlt.");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const token = (sessionId) => {
  const value = `v2.${sessionId}.1`;
  return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`;
};
const sessionData = (id, userId, at) => ({
  id, userId, tokenVersion: 1, createdAt: at, lastSeenAt: at, lastRotatedAt: at,
  idleExpiresAt: new Date(at.getTime() + 3_600_000), absoluteExpiresAt: new Date(at.getTime() + 3_600_000),
});
const requestJson = async (path, cookie, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Origin: baseUrl, Cookie: cookie, ...(init.headers || {}) },
  });
  return { response, payload: await response.json().catch(() => null) };
};

async function main() {
  const actor = await prisma.user.findFirst({
    where: { role: Role.GESCHAEFTSFUEHRER, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, organizationId: true },
  });
  if (!actor) throw new Error("Kein aktiver Geschäftsführungs-Testakteur gefunden.");
  const employee = await prisma.user.findFirst({
    where: {
      organizationId: actor.organizationId,
      role: Role.MITARBEITER,
      isActive: true,
      OR: [{ salesRoleEnabled: false }, { salesRoleEnabled: null }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const foreignOrganization = await prisma.organization.findFirst({
    where: { id: { not: actor.organizationId } },
    select: { id: true },
  });

  const now = new Date();
  const suffix = Date.now().toString().slice(-9);
  const ids = {
    project: randomUUID(),
    foreignProject: randomUUID(),
    session: randomUUID(),
    employeeSession: randomUUID(),
  };
  const projectNumber = `QPS-${suffix}`;
  const foreignProjectNumber = `QPF-${suffix}`;
  const draftIds = new Set();
  let result;

  await prisma.workPilotProject.create({ data: {
    id: ids.project, organizationId: actor.organizationId, projectNumber,
    title: "QA JARVIS Projektstatus", customer: "QA Kunde", status: "Lead / Klärung",
    description: "Unveränderlicher QA-Fachinhalt", projectType: "Glasreinigung",
    projectKind: "Einmalprojekt", responsibleName: "QA Verantwortung",
    source: "qa-jarvis-project-status", address: "QA Straße 1, 74722 Buchen",
  } });
  if (foreignOrganization) {
    await prisma.workPilotProject.create({ data: {
      id: ids.foreignProject, organizationId: foreignOrganization.id, projectNumber: foreignProjectNumber,
      title: "QA Fremdmandant Projektstatus", customer: "Fremdkunde", status: "Lead / Klärung",
      projectType: "Glasreinigung", projectKind: "Einmalprojekt", source: "qa-jarvis-project-status",
    } });
  }
  await prisma.authSession.create({ data: sessionData(ids.session, actor.id, now) });
  if (employee) await prisma.authSession.create({ data: sessionData(ids.employeeSession, employee.id, now) });
  const cookie = `workpilot_session=${token(ids.session)}`;

  try {
    const createDraft = async (message, requestCookie = cookie, actorId = actor.id) => {
      const response = await requestJson("/api/jarvis/chat", requestCookie, {
        method: "POST",
        body: JSON.stringify({ actorId, message, context: { activeTab: "dashboard", activeMainView: "dashboard" } }),
      });
      if (response.payload?.actionDraft?.previewId) draftIds.add(response.payload.actionDraft.previewId);
      return response;
    };
    const command = async (draft, commandName, phrase = "") => requestJson(`/api/jarvis/action-drafts/${draft.previewId}`, cookie, {
      method: "POST",
      headers: { "x-jarvis-action": "jarvis-action-draft-v2" },
      body: JSON.stringify({
        actorId: actor.id,
        actionId: "project.status.change",
        command: commandName,
        revision: draft.revision,
        confirmationText: phrase,
      }),
    });

    if (employee) {
      const denied = await createDraft(
        `Setze Projekt ${projectNumber} auf Angebot. Grund: QA Rollenprüfung.`,
        `workpilot_session=${token(ids.employeeSession)}`,
        employee.id
      );
      assert(
        denied.response.ok && !denied.payload?.actionDraft,
        `Mitarbeiterrolle erhielt eine kritische Projektstatusaktion: ${JSON.stringify(denied.payload)}`
      );
    }
    if (foreignOrganization) {
      const isolated = await createDraft(`Setze Projekt ${foreignProjectNumber} auf Angebot. Grund: QA Mandantenprüfung.`);
      assert(isolated.response.ok && isolated.payload?.type === "refusal" && !isolated.payload?.actionDraft, "Fremdmandanten-Projekt war sichtbar.");
    }

    const cancelResponse = await createDraft(`Setze Projekt ${projectNumber} auf Angebot. Grund: QA Abbruchprüfung.`);
    const cancelDraft = cancelResponse.payload?.actionDraft;
    assert(cancelDraft?.actionId === "project.status.change", "Keine Projektstatus-Abbruchvorschau erzeugt.");
    const cancelled = await command(cancelDraft, "cancel");
    assert(cancelled.response.ok && cancelled.payload?.actionDraft?.state === "cancelled", "Projektstatus-Abbruch fehlgeschlagen.");
    assert((await prisma.workPilotProject.findUniqueOrThrow({ where: { id: ids.project } })).status === "Lead / Klärung", "Abbruch hat den Projektstatus verändert.");

    const prepared = await createDraft(`Setze Projekt ${projectNumber} auf Angebot. Grund: Der Angebotsprozess wurde fachlich eröffnet.`);
    assert(prepared.response.ok, `Projektstatusvorschau fehlgeschlagen: ${prepared.payload?.error || prepared.payload?.message || ""}`);
    const draft = prepared.payload?.actionDraft;
    assert(draft?.actionId === "project.status.change" && draft.targetStatus === "Angebot", "Keine eindeutige project.status.change-Vorschau.");
    assert(draft.state === "awaiting_confirmation" && draft.confirmation?.enabled === true && !draft.blockingIssues?.length, "Projektstatusvorschau ist nicht ausführbar.");
    assert(draft.confirmation.requiredText === `PROJEKTSTATUS ${projectNumber} AUF Angebot`, "Kritische Projektstatusphrase ist falsch.");
    for (const label of ["Projekt", "Kunde", "Verantwortlich", "Aktueller Status", "Neuer Status", "Grund", "Aktive Angebote", "Bestätigte Planungen", "Projektzeiten", "Endkontrollen", "Abschlussrechnungen", "Offene Aufgaben"]) {
      assert(draft.fields?.some((field) => field.label === label), `Vorschaufeld „${label}“ fehlt.`);
    }
    assert(draft.warnings?.some((warning) => warning.includes("Angebote, Rechnungen, Aufgaben, Termine, Zeiten, Dateien und Kundenbezüge bleiben unverändert")), "Ausgeschlossene Nebenwirkungen fehlen in der Vorschau.");

    const wrong = await command(draft, "confirm", draft.confirmation.requiredText.toLowerCase());
    assert(wrong.response.status === 400, "Eine ungenaue Projektstatusphrase wurde nicht abgewiesen.");
    assert((await prisma.workPilotProject.findUniqueOrThrow({ where: { id: ids.project } })).status === "Lead / Klärung", "Falsche Phrase hat den Projektstatus verändert.");

    const executed = await command(draft, "confirm", draft.confirmation.requiredText);
    assert(executed.response.ok && executed.payload?.actionDraft?.state === "executed", "Projektstatus wurde nicht ausgeführt.");
    const replay = await command(draft, "confirm", draft.confirmation.requiredText);
    assert(replay.response.ok && replay.payload?.actionDraft?.result?.entityId === ids.project, "Projektstatus-Replay ist nicht idempotent.");

    const [project, timelines, logbook, audits] = await Promise.all([
      prisma.workPilotProject.findUniqueOrThrow({ where: { id: ids.project } }),
      prisma.statusTimelineEntry.findMany({ where: { organizationId: actor.organizationId, entityType: "project", entityId: ids.project, startedAt: { gte: now } } }),
      prisma.projectLogbookEntry.findMany({ where: { organizationId: actor.organizationId, projectId: ids.project, source: "project-status", createdAt: { gte: now } } }),
      prisma.auditLog.findMany({ where: { organizationId: actor.organizationId, entityType: "project", entityId: ids.project, action: "project.status.changed", createdAt: { gte: now } } }),
    ]);
    assert(project.status === "Angebot", "Zielstatus wurde nicht gespeichert.");
    assert(project.description === "Unveränderlicher QA-Fachinhalt" && project.customer === "QA Kunde" && project.address === "QA Straße 1, 74722 Buchen", "Nicht freigegebene Projektfelder wurden verändert.");
    assert(timelines.length === 1 && timelines[0].fromStatus === "Lead / Klärung" && timelines[0].toStatus === "Angebot", "Status-Timeline ist nicht exactly-once.");
    assert(logbook.length === 1 && logbook[0].callReference === draft.previewId && logbook[0].body.includes("Der Angebotsprozess wurde fachlich eröffnet"), "Projektlogbuch ist nicht exactly-once oder unvollständig.");
    assert(audits.length === 1 && audits[0].actorId === actor.id, "Status-Audit ist nicht exactly-once oder nicht akteursgebunden.");

    result = {
      baseUrl,
      roleBoundary: employee ? "verified" : "no-active-employee",
      tenantBoundary: foreignOrganization ? "verified" : "single-tenant",
      fullPreview: true,
      wrongPhraseRejected: true,
      cancelSafe: true,
      replayExactlyOnce: true,
      status: project.status,
      timelineEntries: timelines.length,
      logbookEntries: logbook.length,
      auditEntries: audits.length,
      unrelatedProjectFieldsUnchanged: true,
    };
  } finally {
    await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    await prisma.statusTimelineEntry.deleteMany({ where: { entityType: "project", entityId: { in: [ids.project, ids.foreignProject] } } });
    await prisma.statusEscalationEvent.deleteMany({ where: { entityType: "project", entityId: { in: [ids.project, ids.foreignProject] } } });
    await prisma.projectLogbookEntry.deleteMany({ where: { projectId: { in: [ids.project, ids.foreignProject] } } });
    await prisma.auditLog.deleteMany({ where: { entityType: "project", entityId: { in: [ids.project, ids.foreignProject] } } });
    await prisma.workPilotProject.deleteMany({ where: { id: { in: [ids.project, ids.foreignProject] } } });
    await prisma.authSession.deleteMany({ where: { id: { in: [ids.session, ids.employeeSession] } } });
  }

  const residue = {
    projects: await prisma.workPilotProject.count({ where: { id: { in: [ids.project, ids.foreignProject] } } }),
    drafts: await prisma.jarvisActionDraft.count({ where: { id: { in: [...draftIds] } } }),
    sessions: await prisma.authSession.count({ where: { id: { in: [ids.session, ids.employeeSession] } } }),
    timelines: await prisma.statusTimelineEntry.count({ where: { entityType: "project", entityId: { in: [ids.project, ids.foreignProject] } } }),
    logbook: await prisma.projectLogbookEntry.count({ where: { projectId: { in: [ids.project, ids.foreignProject] } } }),
    audits: await prisma.auditLog.count({ where: { entityType: "project", entityId: { in: [ids.project, ids.foreignProject] } } }),
  };
  assert(Object.values(residue).every((value) => value === 0), `QA-Rückstände: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ ...result, qaResidue: residue }, null, 2));
}

await main().finally(() => prisma.$disconnect());
