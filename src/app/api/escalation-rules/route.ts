import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { canManageEscalationRules } from "@/lib/permissions";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function readJsonBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function roleLabel(role: Role) {
  if (role === Role.GESCHAEFTSFUEHRER) return "Geschäftsführung";
  if (role === Role.FUEHRUNGSKRAFT) return "Führungskraft";
  if (String(role) === "BUCHHALTUNG") return "Buchhaltung";
  if (role === Role.MITARBEITER) return "Mitarbeiter";
  if (role === Role.GAST) return "Gast";
  return "Admin";
}

async function ensureEscalationEmailColumns() {
  await prisma.$executeRaw`
    ALTER TABLE "EscalationRule"
    ADD COLUMN IF NOT EXISTS "emailEnabled" BOOLEAN NOT NULL DEFAULT false
  `;
  await prisma.$executeRaw`
    ALTER TABLE "EscalationRule"
    ADD COLUMN IF NOT EXISTS "emailRecipients" TEXT NOT NULL DEFAULT ''
  `;
}

function formatRule(rule: {
  id: string;
  name: string;
  hoursAfterDue: number;
  targetRole: Role;
  isActive: boolean;
  emailEnabled?: boolean;
  emailRecipients?: string;
}) {
  return {
    id: rule.id,
    name: rule.name,
    hoursAfterDue: rule.hoursAfterDue,
    targetRole: rule.targetRole,
    targetRoleLabel: roleLabel(rule.targetRole),
    isActive: rule.isActive,
    emailEnabled: Boolean(rule.emailEnabled),
    emailRecipients: rule.emailRecipients ?? "",
  };
}

function parseHours(value: unknown) {
  const hours = Number(value);
  return Number.isFinite(hours) && hours >= 0 ? Math.round(hours) : null;
}

export async function GET() {
  const { organization } = await getDemoContext();
  await ensureEscalationEmailColumns();

  const rules = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      hoursAfterDue: number;
      targetRole: Role;
      isActive: boolean;
      emailEnabled: boolean;
      emailRecipients: string;
    }>
  >`
    SELECT id, name, "hoursAfterDue", "targetRole", "isActive", "emailEnabled", "emailRecipients"
    FROM "EscalationRule"
    WHERE "organizationId" = ${organization.id}
    ORDER BY "hoursAfterDue" ASC
  `;

  return NextResponse.json(rules.map(formatRule));
}

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  const { organization, users } = await getDemoContext();
  await ensureEscalationEmailColumns();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  const hoursAfterDue = parseHours(body.hoursAfterDue);

  if (!canManageEscalationRules(actor)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen Eskalationen verwalten." },
      { status: 403 }
    );
  }

  if (!body.name?.trim() || hoursAfterDue === null || !Object.values(Role).includes(body.targetRole)) {
    return NextResponse.json(
      { error: "Bitte Name, Zeit und Empfängerrolle vollständig ausfüllen." },
      { status: 400 }
    );
  }

  const rule = await prisma.escalationRule.create({
    data: {
      organizationId: organization.id,
      name: body.name.trim(),
      hoursAfterDue,
      targetRole: body.targetRole,
      isActive: body.isActive ?? true,
    },
  });

  await prisma.$executeRaw`
    UPDATE "EscalationRule"
    SET "emailEnabled" = ${Boolean(body.emailEnabled)},
        "emailRecipients" = ${body.emailRecipients ?? ""}
    WHERE id = ${rule.id}
  `;

  return NextResponse.json(
    formatRule({
      ...rule,
      emailEnabled: Boolean(body.emailEnabled),
      emailRecipients: body.emailRecipients ?? "",
    }),
    { status: 201 }
  );
}

export async function PATCH(req: Request) {
  const body = await readJsonBody(req);
  const { organization, users } = await getDemoContext();
  await ensureEscalationEmailColumns();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  const hoursAfterDue = parseHours(body.hoursAfterDue);

  if (!canManageEscalationRules(actor)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen Eskalationen verwalten." },
      { status: 403 }
    );
  }

  if (!body.name?.trim() || hoursAfterDue === null || !Object.values(Role).includes(body.targetRole)) {
    return NextResponse.json(
      { error: "Bitte Name, Zeit und Empfängerrolle vollständig ausfüllen." },
      { status: 400 }
    );
  }

  const existingRule = await prisma.escalationRule.findFirst({
    where: {
      id: cleanString(body.ruleId),
      organizationId: organization.id,
    },
  });

  if (!existingRule) {
    return NextResponse.json(
      { error: "Regel wurde nicht gefunden." },
      { status: 404 }
    );
  }

  const rule = await prisma.escalationRule.update({
    where: {
      id: existingRule.id,
    },
    data: {
      name: body.name.trim(),
      hoursAfterDue,
      targetRole: body.targetRole,
      isActive: Boolean(body.isActive),
    },
  });

  if (rule.organizationId !== organization.id) {
    return NextResponse.json(
      { error: "Regel gehört nicht zur Demo-Organisation." },
      { status: 403 }
    );
  }

  await prisma.$executeRaw`
    UPDATE "EscalationRule"
    SET "emailEnabled" = ${Boolean(body.emailEnabled)},
        "emailRecipients" = ${body.emailRecipients ?? ""}
    WHERE id = ${rule.id}
  `;

  return NextResponse.json(
    formatRule({
      ...rule,
      emailEnabled: Boolean(body.emailEnabled),
      emailRecipients: body.emailRecipients ?? "",
    })
  );
}

export async function DELETE(req: Request) {
  const body = await readJsonBody(req);
  const { organization, users } = await getDemoContext();
  await ensureEscalationEmailColumns();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  if (!canManageEscalationRules(actor)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen Eskalationen verwalten." },
      { status: 403 }
    );
  }

  const rule = await prisma.escalationRule.findFirst({
    where: {
      id: cleanString(body.ruleId),
      organizationId: organization.id,
    },
  });

  if (!rule) {
    return NextResponse.json(
      { error: "Regel wurde nicht gefunden." },
      { status: 404 }
    );
  }

  await prisma.escalationRule.delete({
    where: {
      id: rule.id,
    },
  });

  return NextResponse.json({ success: true });
}
