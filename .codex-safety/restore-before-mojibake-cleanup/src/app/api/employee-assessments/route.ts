import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

type DisgDimension = "D" | "I" | "S" | "G";

type DisgAssessmentData = {
  answers?: Record<string, number>;
  order?: string[];
  status?: "not_started" | "draft" | "completed";
  locked?: boolean;
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
};

type EmployeeAssessmentData = {
  self?: unknown;
  manager?: unknown;
  measures?: unknown;
  conversation?: unknown;
  selfLocked?: boolean;
  currentCaseId?: string;
  history?: unknown[];
  disg?: DisgAssessmentData;
  updatedAt?: string;
};

const disgQuestionDimensions: Record<string, DisgDimension> = {
  q01: "D", q02: "S", q03: "I", q04: "G", q05: "D", q06: "I", q07: "S", q08: "G",
  q09: "D", q10: "S", q11: "I", q12: "G", q13: "D", q14: "I", q15: "S", q16: "G",
  q17: "D", q18: "S", q19: "I", q20: "G", q21: "D", q22: "I", q23: "S", q24: "G",
  q25: "D", q26: "S", q27: "I", q28: "G", q29: "D", q30: "I", q31: "S", q32: "G",
  q33: "D", q34: "S", q35: "I", q36: "G", q37: "D", q38: "I", q39: "S", q40: "G",
};
const defaultDisgOrder = Object.keys(disgQuestionDimensions);

function canManageAssessments(role?: Role) {
  return role === Role.ADMIN || role === Role.GESCHAEFTSFUEHRER;
}

async function ensureAssessmentColumn() {
  await prisma.$executeRaw`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "employeeAssessment" JSONB NOT NULL DEFAULT '{}'::jsonb
  `;
}

function normalizeAssessment(value: Prisma.JsonValue | null | undefined): EmployeeAssessmentData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as EmployeeAssessmentData;
}

function normalizeDisg(value: unknown): DisgAssessmentData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { answers: {}, order: defaultDisgOrder, status: "not_started", locked: false };
  }
  const data = value as DisgAssessmentData;
  return {
    answers: data.answers ?? {},
    order: Array.isArray(data.order) && data.order.length > 0 ? data.order : defaultDisgOrder,
    status: data.status ?? "not_started",
    locked: Boolean(data.locked),
    startedAt: data.startedAt,
    completedAt: data.completedAt,
    result: data.result,
  };
}

function sanitizeEmployeeHistory(history: unknown[] | undefined) {
  if (!Array.isArray(history)) return [];
  return history.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const entry = item as Record<string, unknown>;
    return {
      id: entry.id,
      completedAt: entry.completedAt,
      selfAverage: entry.selfAverage,
      measuresCount: Array.isArray(entry.measures) ? entry.measures.length : 0,
    };
  });
}

function sanitizeAssessment(data: EmployeeAssessmentData, isManager: boolean) {
  if (isManager) return data;
  return {
    self: data.self ?? null,
    selfLocked: Boolean(data.selfLocked),
    measures: data.measures ?? [],
    history: sanitizeEmployeeHistory(data.history),
    disg: data.disg ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

function hasAssessmentAnswers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const answers = (value as { answers?: unknown }).answers;
  return Boolean(answers && typeof answers === "object" && !Array.isArray(answers) && Object.keys(answers).length > 0);
}

function getAverageFromAssessment(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const answers = (value as { answers?: unknown }).answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return null;
  const scores = Object.values(answers).filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
}

function upsertHistoryCase(data: EmployeeAssessmentData) {
  if (!hasAssessmentAnswers(data.self) || !hasAssessmentAnswers(data.manager)) return data;
  const caseId = data.currentCaseId || crypto.randomUUID();
  const history = Array.isArray(data.history) ? data.history : [];
  const caseEntry = {
    id: caseId,
    completedAt: new Date().toISOString(),
    self: data.self,
    manager: data.manager,
    measures: data.measures ?? [],
    conversation: data.conversation ?? {},
    selfAverage: getAverageFromAssessment(data.self),
    managerAverage: getAverageFromAssessment(data.manager),
  };
  const existingIndex = history.findIndex((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    return (item as { id?: unknown }).id === caseId;
  });
  return {
    ...data,
    currentCaseId: caseId,
    history: existingIndex >= 0
      ? history.map((item, index) => (index === existingIndex ? caseEntry : item))
      : [caseEntry, ...history].slice(0, 20),
  };
}

function calculateDisgResult(answers: Record<string, number>) {
  const dimensions: DisgDimension[] = ["D", "I", "S", "G"];
  const totals = dimensions.reduce<Record<DisgDimension, { points: number; count: number }>>(
    (acc, dimension) => ({ ...acc, [dimension]: { points: 0, count: 0 } }),
    {} as Record<DisgDimension, { points: number; count: number }>
  );
  for (const [questionId, dimension] of Object.entries(disgQuestionDimensions)) {
    const value = Number(answers[questionId]);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      throw new Error("Bitte alle DISG-Fragen beantworten.");
    }
    totals[dimension].points += value;
    totals[dimension].count += 1;
  }
  const scores = dimensions.reduce<Record<DisgDimension, { points: number; average: number; percent: number }>>(
    (acc, dimension) => {
      const average = Math.round((totals[dimension].points / totals[dimension].count) * 10) / 10;
      acc[dimension] = { points: totals[dimension].points, average, percent: Math.round((average / 5) * 100) };
      return acc;
    },
    {} as Record<DisgDimension, { points: number; average: number; percent: number }>
  );
  const sorted = [...dimensions].sort((first, second) => scores[second].average - scores[first].average);
  const primaryType = sorted[0];
  const secondaryType = sorted[1];
  const averages = dimensions.map((dimension) => scores[dimension].average);
  return {
    scores,
    primaryType,
    secondaryType,
    profile: `${primaryType}/${secondaryType}`,
    isBalanced: Math.max(...averages) - Math.min(...averages) <= 0.5,
    closeProfile: Math.abs(scores[primaryType].average - scores[secondaryType].average) <= 0.3,
    completedAt: new Date().toISOString(),
  };
}

async function getUserById(userId: string) {
  const [user] = await prisma.$queryRaw<Array<{ id: string; organizationId: string; role: Role }>>`
    SELECT "id", "organizationId", "role"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;
  return user;
}

async function readAssessment(userId: string) {
  const [row] = await prisma.$queryRaw<Array<{ employeeAssessment: Prisma.JsonValue | null }>>`
    SELECT "employeeAssessment"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;
  return normalizeAssessment(row?.employeeAssessment);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const actorId = searchParams.get("actorId") ?? "";
  const userId = searchParams.get("userId") ?? actorId;
  const { organization } = await getDemoContext();
  await ensureAssessmentColumn();
  const [actor, target] = await Promise.all([getUserById(actorId), getUserById(userId)]);
  if (!actor || !target || actor.organizationId !== organization.id || target.organizationId !== organization.id) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }
  const isManager = canManageAssessments(actor.role);
  if (!isManager && actor.id !== target.id) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }
  const data = await readAssessment(target.id);
  return NextResponse.json({ assessment: sanitizeAssessment(data, isManager) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const actorId = typeof body?.actorId === "string" ? body.actorId : "";
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const section = typeof body?.section === "string" ? body.section : "";
  const payload = body?.data ?? null;
  const { organization } = await getDemoContext();
  await ensureAssessmentColumn();
  const [actor, target] = await Promise.all([getUserById(actorId), getUserById(userId)]);
  if (!actor || !target || actor.organizationId !== organization.id || target.organizationId !== organization.id) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }
  const isManager = canManageAssessments(actor.role);
  const existing = await readAssessment(target.id);
  const existingDisg = normalizeDisg(existing.disg);

  if (section === "self" && actor.id !== target.id) {
    return NextResponse.json({ error: "Nur der Mitarbeiter kann die eigene Selbsteinschätzung speichern." }, { status: 403 });
  }
  if (section === "self" && existing.selfLocked && !isManager) {
    return NextResponse.json({ error: "Die Selbsteinschätzung ist gesperrt und kann nur durch die Geschäftsführung wieder freigegeben werden." }, { status: 403 });
  }
  if (["manager", "measures", "conversation", "unlock-self", "disg-unlock"].includes(section) && !isManager) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }
  if (["disg-save", "disg-complete"].includes(section) && actor.id !== target.id) {
    return NextResponse.json({ error: "DISG kann nur vom jeweiligen Mitarbeiter selbst bearbeitet werden." }, { status: 403 });
  }
  if (section === "disg-reset" && actor.id !== target.id && !isManager) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }
  if (!["self", "manager", "measures", "conversation", "unlock-self", "disg-save", "disg-complete", "disg-unlock", "disg-reset"].includes(section)) {
    return NextResponse.json({ error: "Ungültiger Bereich." }, { status: 400 });
  }
  if (["disg-save", "disg-complete"].includes(section) && existingDisg.locked) {
    return NextResponse.json({ error: "Der DISG-Fragebogen ist abgeschlossen und kann nur durch die Geschäftsführung wieder geöffnet werden." }, { status: 403 });
  }
  if (section === "disg-reset" && existingDisg.locked && !isManager) {
    return NextResponse.json({ error: "Der DISG-Fragebogen ist abgeschlossen und kann nur durch die Geschäftsführung wieder geöffnet werden." }, { status: 403 });
  }

  let nextData: EmployeeAssessmentData;
  if (section === "unlock-self") {
    nextData = { ...existing, selfLocked: false, updatedAt: new Date().toISOString() };
  } else if (section === "disg-unlock") {
    nextData = { ...existing, disg: { ...existingDisg, locked: false, status: "draft" }, updatedAt: new Date().toISOString() };
  } else if (section === "disg-save") {
    const incoming = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as DisgAssessmentData) : {};
    nextData = {
      ...existing,
      disg: {
        ...existingDisg,
        ...incoming,
        status: "draft",
        locked: false,
        order: existingDisg.order?.length ? existingDisg.order : defaultDisgOrder,
        startedAt: existingDisg.startedAt || new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };
  } else if (section === "disg-reset") {
    nextData = {
      ...existing,
      disg: {
        answers: {},
        order: existingDisg.order?.length ? existingDisg.order : defaultDisgOrder,
        status: "not_started",
        locked: false,
        startedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };
  } else if (section === "disg-complete") {
    const incoming = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as DisgAssessmentData) : {};
    const answers = incoming.answers ?? existingDisg.answers ?? {};
    const result = calculateDisgResult(answers);
    nextData = {
      ...existing,
      disg: {
        ...existingDisg,
        ...incoming,
        answers,
        order: existingDisg.order?.length ? existingDisg.order : defaultDisgOrder,
        status: "completed",
        locked: true,
        completedAt: result.completedAt,
        result,
      },
      updatedAt: new Date().toISOString(),
    };
  } else {
    nextData = {
      ...existing,
      [section]: payload,
      selfLocked: section === "self" ? true : existing.selfLocked,
      currentCaseId: existing.currentCaseId || (section === "self" ? crypto.randomUUID() : existing.currentCaseId),
      updatedAt: new Date().toISOString(),
    };
  }
  if (["manager", "measures", "conversation"].includes(section)) {
    nextData = upsertHistoryCase(nextData);
  }

  await prisma.$executeRaw`
    UPDATE "User"
    SET "employeeAssessment" = ${nextData}::jsonb
    WHERE "id" = ${target.id}
  `;
  return NextResponse.json({ assessment: sanitizeAssessment(nextData, isManager) });
}
