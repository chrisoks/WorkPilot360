import { randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";

process.loadEnvFile?.(".env");
const prisma = new PrismaClient();
const cleanupToken = process.argv.find((item) => item.startsWith("--cleanup="))?.slice("--cleanup=".length);
const mode = process.argv.includes("--mode=cancel-series") ? "cancel-series" : process.argv.includes("--mode=cancel") ? "cancel" : "request";

async function cleanup(token) {
  const source = `qa-jarvis-planning-request-browser:${token}`;
  const projects = await prisma.workPilotProject.findMany({ where: { source }, select: { id: true } });
  const projectIds = projects.map((item) => item.id);
  const entries = await prisma.planningEntry.findMany({ where: { projectId: { in: projectIds } }, select: { id: true } });
  const entryIds = entries.map((item) => item.id);
  const drafts = entryIds.length ? await prisma.$queryRaw`SELECT "id" FROM "JarvisActionDraft" WHERE "actionId"='planning.request.manage' AND "payload"->>'entryId'=ANY(${entryIds})` : [];
  const draftIds = drafts.map((item) => item.id);
  await prisma.notification.deleteMany({ where: { linkTarget: "planning-entry", linkTargetId: { in: entryIds } } });
  await prisma.projectLogbookEntry.deleteMany({ where: { projectId: { in: projectIds }, source: "planning-request-decision" } });
  await prisma.planningEntryHistory.deleteMany({ where: { planningEntryId: { in: entryIds } } });
  await prisma.jarvisActionDraftAuditEvent.deleteMany({ where: { draftId: { in: draftIds } } });
  await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: draftIds } } });
  await prisma.planningEntry.deleteMany({ where: { id: { in: entryIds } } });
  await prisma.workPilotProject.deleteMany({ where: { id: { in: projectIds } } });
  console.log(JSON.stringify({ cleaned: true, token, draftIds, entryIds, projectIds }));
}

async function seed() {
  const actor = await prisma.user.findFirst({ where: { firstName: "Christian", isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, organizationId: true, firstName: true, lastName: true, email: true } });
  if (!actor) throw new Error("Der angemeldete Browser-Testnutzer Christian wurde nicht gefunden.");
  const employee = await prisma.user.findFirst({ where: { organizationId: actor.organizationId, role: Role.MITARBEITER, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, firstName: true, lastName: true } });
  if (!employee) throw new Error("Keine aktive Testperson gefunden.");
  const token = Date.now().toString(36); const projectId = randomUUID(); const entryId = randomUUID(); const secondEntryId = mode === "cancel-series" ? randomUUID() : null;
  const projectNumber = `QWR-${Date.now().toString().slice(-7)}`; const source = `qa-jarvis-planning-request-browser:${token}`;
  await prisma.workPilotProject.create({ data: {
    id: projectId, organizationId: actor.organizationId, projectNumber, title: mode === "cancel-series" ? "QA JARVIS Klicktest Terminserie" : mode === "cancel" ? "QA JARVIS Klicktest Terminabsage" : "QA JARVIS Klicktest Terminwunsch", customer: "QA intern",
    status: "Umsetzung", projectType: "Hausmeisterservice", projectKind: "Dauerprojekt", recurringBillingMode: "hourly",
    trade: "Hausmeisterservice", branch: "OK immocare", responsibleName: `${actor.firstName} ${actor.lastName}`.trim(), source,
  } });
  const recurring = mode === "cancel" || mode === "cancel-series";
  const baseEntry = {
    organizationId: actor.organizationId, source: "manual", board: "OK immocare", groupName: "QA",
    userId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}`.trim(), startTime: "08:00", endTime: "09:00", durationMinutes: 60,
    description: "Wird nach dem Klicktest bereinigt", projectId, projectLabel: `${projectNumber} | QA JARVIS Klicktest`,
    planningTrade: "Hausmeisterservice", approvalStatus: recurring ? "confirmed" : "requested", recurrenceId: recurring ? `qa-series-${token}` : null, recurrenceRule: recurring ? "weekly" : null, requestedByUserId: employee.id, requestedByName: `${employee.firstName} ${employee.lastName}`.trim(),
  };
  await prisma.planningEntry.createMany({ data: [
    { ...baseEntry, id: entryId, date: "2026-08-26", title: mode === "cancel-series" ? "QA JARVIS Serienklick 1" : mode === "cancel" ? "QA JARVIS Absageklick" : "QA JARVIS Freigabeklick" },
    ...(secondEntryId ? [{ ...baseEntry, id: secondEntryId, date: "2026-09-02", title: "QA JARVIS Serienklick 2" }] : []),
  ] });
  console.log(JSON.stringify({ token, mode, entryId, entryIds: [entryId, ...(secondEntryId ? [secondEntryId] : [])], projectId, projectNumber }));
}

(cleanupToken ? cleanup(cleanupToken) : seed()).catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
