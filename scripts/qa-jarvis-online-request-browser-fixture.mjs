import { createHmac } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const secret = process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
if (!secret) throw new Error("WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET fehlt.");

const FIXTURE = {
  requestId: "qa-jarvis-online-browser-request",
  contactId: "qa-jarvis-online-browser-contact",
  sessionId: "qa-jarvis-online-browser-session",
};

function sessionToken(sessionId) {
  const value = `v2.${sessionId}.1`;
  return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`;
}

async function cleanup() {
  const request = await prisma.onlineRequest.findUnique({ where: { id: FIXTURE.requestId }, select: { convertedProjectId: true } });
  const projectIds = request?.convertedProjectId ? [request.convertedProjectId] : [];
  const tasks = projectIds.length ? await prisma.task.findMany({ where: { projectId: { in: projectIds } }, select: { id: true } }) : [];
  const taskIds = tasks.map((task) => task.id);
  const projects = projectIds.length ? await prisma.workPilotProject.findMany({ where: { id: { in: projectIds } }, select: { objectAddressId: true } }) : [];
  const objectAddressIds = projects.flatMap((project) => project.objectAddressId ? [project.objectAddressId] : []);
  const draftCandidates = await prisma.jarvisActionDraft.findMany({ where: { actionId: "online-request.convert" }, select: { id: true, payload: true } });
  const draftIds = draftCandidates.filter((draft) => draft.payload && typeof draft.payload === "object" && !Array.isArray(draft.payload) && draft.payload.requestId === FIXTURE.requestId).map((draft) => draft.id);
  await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: draftIds } } });
  await prisma.notification.deleteMany({ where: { OR: [{ taskId: { in: taskIds } }, { linkTarget: "online-requests", linkTargetId: FIXTURE.requestId }] } });
  await prisma.statusTimelineEntry.deleteMany({ where: { OR: [{ entityType: "task", entityId: { in: taskIds } }, { entityType: "project", entityId: { in: projectIds } }] } });
  await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
  await prisma.projectLogbookEntry.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.storedFile.deleteMany({ where: { ownerType: "project", ownerId: { in: projectIds } } });
  await prisma.workPilotProject.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.objectAddress.deleteMany({ where: { id: { in: objectAddressIds } } });
  await prisma.onlineRequest.deleteMany({ where: { id: FIXTURE.requestId } });
  await prisma.contact.deleteMany({ where: { id: FIXTURE.contactId } });
  await prisma.authSession.deleteMany({ where: { id: FIXTURE.sessionId } });
  return { drafts: draftIds.length, projects: projectIds.length, tasks: taskIds.length, addresses: objectAddressIds.length };
}

async function seed() {
  await cleanup();
  const actor = await prisma.user.findFirst({ where: { role: Role.GESCHAEFTSFUEHRER, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, organizationId: true } });
  if (!actor) throw new Error("Kein aktiver Geschäftsführungs-Testakteur gefunden.");
  const portal = await prisma.onlineRequestPortal.findFirst({ where: { organizationId: actor.organizationId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, allowedTradeIds: true } });
  if (!portal) throw new Error("Kein aktives Online-Anfragen-Portal gefunden.");
  const allowedTradeIds = Array.isArray(portal.allowedTradeIds) ? portal.allowedTradeIds.filter((id) => typeof id === "string") : [];
  const trade = await prisma.category.findFirst({ where: { organizationId: actor.organizationId, ...(allowedTradeIds.length ? { id: { in: allowedTradeIds } } : {}) }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  if (!trade) throw new Error("Kein geeignetes Gewerk gefunden.");
  const now = new Date();
  const referenceNumber = `OKI-${now.toISOString().slice(0, 10).replaceAll("-", "")}-B0A5E1`;
  await prisma.contact.create({ data: { id: FIXTURE.contactId, organizationId: actor.organizationId, customerNumber: "QA-JOBROWSER", category: "Kunde", type: "company", companyName: "QA JARVIS Browser", firstName: "Klick", lastName: "Test", email: "qa-jarvis-browser@example.test", street: "QA Klickweg 360", postalCode: "74722", city: "Buchen", source: "qa-jarvis-browser-fixture" } });
  await prisma.onlineRequest.create({ data: { id: FIXTURE.requestId, organizationId: actor.organizationId, portalId: portal.id, referenceNumber, clientSubmissionId: "qa-jarvis-online-browser-submission", payloadHash: "e".repeat(64), status: "in_review", requestType: "execution", tradeId: trade.id, tradeName: trade.name, desiredDate: new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10), desiredTimeWindow: "morning", street: "QA Klickweg 360", postalCode: "74722", city: "Buchen", description: "QA JARVIS Browser Fixture – kontrollierte Klickprüfung", customerKind: "business", company: "QA JARVIS Browser", firstName: "Klick", lastName: "Test", email: "qa-jarvis-browser@example.test", phone: "+49 6281 000000", preferredContact: "either", consentAt: now, submissionIpHash: "f".repeat(64), securitySignals: [], securityScore: 100, assignedUserId: actor.id, matchedContactId: FIXTURE.contactId, customerDecision: "existing" } });
  await prisma.authSession.create({ data: { id: FIXTURE.sessionId, userId: actor.id, tokenVersion: 1, createdAt: now, lastSeenAt: now, lastRotatedAt: now, idleExpiresAt: new Date(now.getTime() + 3_600_000), absoluteExpiresAt: new Date(now.getTime() + 3_600_000) } });
  return { actorId: actor.id, referenceNumber, cookie: `workpilot_session=${sessionToken(FIXTURE.sessionId)}`, requestId: FIXTURE.requestId };
}

const mode = process.argv.includes("--cleanup") ? "cleanup" : process.argv.includes("--seed") ? "seed" : "help";
try {
  if (mode === "seed") console.log(JSON.stringify(await seed(), null, 2));
  else if (mode === "cleanup") console.log(JSON.stringify({ cleaned: await cleanup() }, null, 2));
  else console.log("Mit --seed wird eine isolierte Browser-Fixture angelegt; --cleanup entfernt sie und alle Umwandlungsfolgen.");
} finally {
  await prisma.$disconnect();
}
