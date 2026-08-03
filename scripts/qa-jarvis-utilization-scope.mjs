import { createHmac, randomUUID } from "node:crypto";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = (process.argv.find((entry) => entry.startsWith("--base-url="))?.split("=")[1] || "http://localhost:3001").replace(/\/$/, "");
const sessionSecret = process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
if (!sessionSecret) throw new Error("WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET fehlt.");

function sessionToken(sessionId) {
  const value = `v2.${sessionId}.1`;
  return `${value}.${createHmac("sha256", sessionSecret).update(value).digest("base64url")}`;
}

async function createSession(userId, now) {
  const id = randomUUID();
  await prisma.authSession.create({ data: { id, userId, tokenVersion: 1, createdAt: now, lastSeenAt: now, lastRotatedAt: now, idleExpiresAt: new Date(now.getTime() + 3_600_000), absoluteExpiresAt: new Date(now.getTime() + 3_600_000) } });
  return { id, cookie: `workpilot_session=${sessionToken(id)}` };
}

async function ask(user, session, question) {
  const response = await fetch(`${baseUrl}/api/jarvis/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: session.cookie },
    body: JSON.stringify({ actorId: user.id, message: question, context: { activeTab: "dashboard", activeMainView: "dashboard" } }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.topicId !== "management.operations.utilization") {
    throw new Error(`Auslastungsantwort fehlgeschlagen (${response.status}): ${JSON.stringify(payload)}`);
  }
  return JSON.stringify(payload);
}

async function main() {
  const now = new Date();
  const primary = await prisma.user.findFirst({ where: { role: Role.GESCHAEFTSFUEHRER, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, organizationId: true, role: true } });
  if (!primary) throw new Error("Keine aktive Geschäftsführung für die isolierte Rollen-QA gefunden.");
  const marker = `QA-SCOPE-${Date.now()}`;
  const ids = { leader: randomUUID(), direct: randomUUID(), deputy: randomUUID(), foreign: randomUUID() };
  const sessionIds = [];
  try {
    const common = { organizationId: primary.organizationId, passwordHash: "qa-not-used", isActive: true, sellableCapacityEnabled: true, planningBoard: "OK solutions", planningGroup: marker, weeklyCapacity: { monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0 } };
    await prisma.user.createMany({ data: [
      { ...common, id: ids.leader, email: `${marker}-lead@example.test`, firstName: marker, lastName: "Leitung", role: Role.FUEHRUNGSKRAFT },
      { ...common, id: ids.direct, email: `${marker}-direct@example.test`, firstName: marker, lastName: "Direkt", role: Role.MITARBEITER, leadershipManagerId: ids.leader },
      { ...common, id: ids.deputy, email: `${marker}-deputy@example.test`, firstName: marker, lastName: "Vertretung", role: Role.MITARBEITER, leadershipDeputyId: ids.leader },
      { ...common, id: ids.foreign, email: `${marker}-foreign@example.test`, firstName: marker, lastName: "Fremd", role: Role.MITARBEITER, leadershipManagerId: primary.id },
    ] });
    const leader = { id: ids.leader };
    const employee = { id: ids.direct };
    const [gfSession, leaderSession, employeeSession] = await Promise.all([createSession(primary.id, now), createSession(leader.id, now), createSession(employee.id, now)]);
    sessionIds.push(gfSession.id, leaderSession.id, employeeSession.id);

    const question = "Welche Mitarbeiter haben in der aktuellen Woche zu wenig Arbeit?";
    const [gfAnswer, leaderAnswer, employeeAnswer] = await Promise.all([
      ask(primary, gfSession, question),
      ask(leader, leaderSession, question),
      ask(employee, employeeSession, question),
    ]);

    for (const name of [`${marker} Leitung`, `${marker} Direkt`, `${marker} Vertretung`, `${marker} Fremd`]) {
      if (!gfAnswer.includes(name)) throw new Error(`GF-Sicht enthält ${name} nicht.`);
    }
    for (const name of [`${marker} Leitung`, `${marker} Direkt`, `${marker} Vertretung`]) {
      if (!leaderAnswer.includes(name)) throw new Error(`Führungssicht enthält ${name} nicht.`);
    }
    if (leaderAnswer.includes(`${marker} Fremd`)) throw new Error("Führungssicht enthält eine fremd zugeordnete Person.");
    if (!employeeAnswer.includes(`${marker} Direkt`) || employeeAnswer.includes(`${marker} Vertretung`) || employeeAnswer.includes(`${marker} Fremd`) || employeeAnswer.includes(`${marker} Leitung`)) {
      throw new Error("Mitarbeitersicht ist nicht strikt auf die eigene Auslastung begrenzt.");
    }
    console.log(JSON.stringify({ baseUrl, managementScope: "organization", leaderScope: "direct-and-deputy", employeeScope: "self", passed: true }, null, 2));
  } finally {
    await prisma.authSession.deleteMany({ where: { id: { in: sessionIds } } });
    await prisma.user.deleteMany({ where: { organizationId: primary.organizationId, id: { in: Object.values(ids) } } });
  }

  const leftovers = await prisma.user.count({ where: { organizationId: primary.organizationId, id: { in: Object.values(ids) } } });
  const sessionLeftovers = await prisma.authSession.count({ where: { id: { in: sessionIds } } });
  if (leftovers || sessionLeftovers) throw new Error(`QA-Rückstände: Benutzer ${leftovers}, Sitzungen ${sessionLeftovers}.`);
}

main().finally(() => prisma.$disconnect());
