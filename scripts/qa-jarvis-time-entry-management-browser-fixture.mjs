import { PrismaClient, Role } from "@prisma/client";

process.loadEnvFile?.(".env");

const prisma = new PrismaClient();
const FIXTURE = {
  projectId: "qa-jarvis-time-browser-project",
  entryId: "qa-jarvis-time-browser-entry",
  projectNumber: "QTM-BROWSER",
};

async function cleanup() {
  const candidates = await prisma.jarvisActionDraft.findMany({
    where: { actionId: "time.manage" },
    select: { id: true, payload: true },
  });
  const draftIds = candidates
    .filter((draft) => draft.payload && typeof draft.payload === "object" && !Array.isArray(draft.payload) && draft.payload.entryId === FIXTURE.entryId)
    .map((draft) => draft.id);
  await prisma.jarvisActionDraft.deleteMany({ where: { id: { in: draftIds } } });
  await prisma.projectTimeEntry.deleteMany({ where: { id: FIXTURE.entryId } });
  await prisma.workPilotProject.deleteMany({ where: { id: FIXTURE.projectId } });
  return { drafts: draftIds.length };
}

async function seed() {
  await cleanup();
  const actor = await prisma.user.findFirst({
    where: { role: { in: [Role.GESCHAEFTSFUEHRER, Role.ADMIN, Role.FUEHRUNGSKRAFT] }, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, organizationId: true, firstName: true, lastName: true, email: true },
  });
  if (!actor) throw new Error("Kein aktiver Zeitverwaltungs-Testakteur gefunden.");
  const employee = await prisma.user.findFirst({
    where: { organizationId: actor.organizationId, role: Role.MITARBEITER, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  const target = employee || actor;
  const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
  const targetName = [target.firstName, target.lastName].filter(Boolean).join(" ") || target.email;
  const now = new Date();
  await prisma.workPilotProject.create({ data: {
    id: FIXTURE.projectId,
    organizationId: actor.organizationId,
    projectNumber: FIXTURE.projectNumber,
    title: "QA JARVIS Zeit-Klicktest",
    customer: "QA intern",
    status: "Umsetzung",
    projectType: "Glasreinigung",
    projectKind: "Einmalprojekt",
    trade: "Glasreinigung",
    branch: "OK immocare",
    responsibleName: actorName,
    source: "qa-jarvis-time-browser-fixture",
  } });
  await prisma.projectTimeEntry.create({ data: {
    id: FIXTURE.entryId,
    organizationId: actor.organizationId,
    projectId: FIXTURE.projectId,
    projectLabel: `${FIXTURE.projectNumber} | QA JARVIS Zeit-Klicktest`,
    trade: "Glasreinigung",
    userId: target.id,
    employee: targetName,
    entrySource: "stamped",
    date: "2026-08-01",
    startTime: "08:00",
    endTime: "10:00",
    durationMs: 6_300_000n,
    pauseMs: 900_000n,
    laborCostRateSnapshot: 28,
    laborCostSnapshot: 49,
    costSnapshotAt: now,
    comment: "QA Browser Ausgangszeit",
    editHistory: [],
  } });
  return { actorId: actor.id, ...FIXTURE };
}

const mode = process.argv.includes("--cleanup") ? "cleanup" : process.argv.includes("--seed") ? "seed" : "help";
try {
  if (mode === "seed") console.log(JSON.stringify(await seed(), null, 2));
  else if (mode === "cleanup") console.log(JSON.stringify({ cleaned: await cleanup() }, null, 2));
  else console.log("Mit --seed wird die isolierte Zeit-Klicktest-Fixture angelegt; --cleanup entfernt sie vollständig.");
} finally {
  await prisma.$disconnect();
}
