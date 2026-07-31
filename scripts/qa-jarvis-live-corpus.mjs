import { createHmac, randomUUID } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { PrismaClient, Role } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const baseUrl = (
  process.argv.find((argument) => argument.startsWith("--base-url="))?.split(
    "="
  )[1] || "http://localhost:3001"
).replace(/\/$/, "");
const sessionSecret =
  process.env.WORKPILOT_SESSION_SECRET || process.env.NEXTAUTH_SECRET;

if (!sessionSecret) {
  throw new Error("WORKPILOT_SESSION_SECRET oder NEXTAUTH_SECRET fehlt.");
}

async function loadCorpus() {
  const sourcePath = path.resolve(
    process.cwd(),
    "src/lib/jarvis/live-question-corpus.ts"
  );
  const source = await fs.readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
  });
  return module.exports.JARVIS_LIVE_QUESTION_CORPUS;
}

function createSessionToken(sessionId, version) {
  const value = `v2.${sessionId}.${version}`;
  const signature = createHmac("sha256", sessionSecret)
    .update(value)
    .digest("base64url");
  return `${value}.${signature}`;
}

async function main() {
  const corpus = await loadCorpus();
  if (!Array.isArray(corpus) || corpus.length !== 110) {
    throw new Error(`Der permanente Korpus enthält ${corpus?.length ?? 0} statt 110 Fragen.`);
  }
  const actor = await prisma.user.findFirst({
    where: {
      role: Role.GESCHAEFTSFUEHRER,
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, organizationId: true },
  });
  if (!actor) throw new Error("Kein aktiver Geschäftsführungs-Testakteur gefunden.");

  const now = new Date();
  const sessionId = randomUUID();
  await prisma.authSession.create({
    data: {
      id: sessionId,
      userId: actor.id,
      tokenVersion: 1,
      createdAt: now,
      lastSeenAt: now,
      lastRotatedAt: now,
      idleExpiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      absoluteExpiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    },
  });
  const cookie = `workpilot_session=${createSessionToken(sessionId, 1)}`;
  const createdDraftIds = new Set();
  const failures = [];
  let actionDraftCount = 0;

  try {
    for (const item of corpus) {
      try {
        const response = await fetch(`${baseUrl}/api/jarvis/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookie,
          },
          body: JSON.stringify({
            actorId: actor.id,
            message: item.question,
            context: {
              activeTab: "dashboard",
              activeMainView: "dashboard",
            },
          }),
        });
        const payload = await response.json().catch(() => null);
        if (
          !response.ok ||
          !payload ||
          typeof payload.type !== "string" ||
          typeof payload.message !== "string" ||
          !payload.message.trim()
        ) {
          failures.push({
            id: item.id,
            status: response.status,
            error: payload?.error || "unvollständige Antwort",
          });
          continue;
        }
        if (payload.actionDraft?.previewId) {
          actionDraftCount += 1;
          createdDraftIds.add(payload.actionDraft.previewId);
          if (payload.actionDraft.state === "executed") {
            failures.push({
              id: item.id,
              status: response.status,
              error: "Eine Korpusfrage hat unerwartet eine Aktion ausgeführt.",
            });
          }
        }
      } catch (error) {
        failures.push({
          id: item.id,
          status: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const dispatchCount = await prisma.documentMailDispatch.count({
      where: {
        organizationId: actor.organizationId,
        createdAt: { gte: now },
      },
    });
    if (dispatchCount !== 0) {
      failures.push({
        id: "side-effect-dispatch",
        status: 0,
        error: `${dispatchCount} unerwartete Versanddatensätze seit Testbeginn.`,
      });
    }
  } finally {
    if (createdDraftIds.size) {
      await prisma.jarvisActionDraft.deleteMany({
        where: {
          id: { in: [...createdDraftIds] },
          organizationId: actor.organizationId,
          executedAt: null,
        },
      });
    }
    await prisma.authSession.deleteMany({ where: { id: sessionId } });
  }

  const remainingDrafts = createdDraftIds.size
    ? await prisma.jarvisActionDraft.count({
        where: { id: { in: [...createdDraftIds] } },
      })
    : 0;
  const result = {
    baseUrl,
    passed: corpus.length - failures.length,
    total: corpus.length,
    actionDraftsPrepared: actionDraftCount,
    executedActions: 0,
    failures,
    qaDraftsRemaining: remainingDrafts,
    qaSessionsRemaining: await prisma.authSession.count({
      where: { id: sessionId },
    }),
  };
  console.log(JSON.stringify(result, null, 2));
  if (failures.length || remainingDrafts) process.exitCode = 1;
}

await main().finally(() => prisma.$disconnect());
