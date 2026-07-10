import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { ensureOrganizationSettingsTable } from "@/lib/company-settings/deadlines";
import { prisma } from "@/lib/db/client";
import { getDemoContext } from "@/lib/demo/context";
import { canManageMasterData } from "@/lib/permissions";

const SETTING_KEY = "holiday-state";
const germanStateCodes = new Set([
  "BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV",
  "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH",
]);

function cleanState(value: unknown) {
  const state = typeof value === "string" ? value.trim().toUpperCase() : "";
  return germanStateCodes.has(state) ? state : "BW";
}

async function readHolidayState(organizationId: string) {
  await ensureOrganizationSettingsTable();
  const setting = await prisma.organizationSetting.findUnique({
    where: {
      organizationId_key: {
        organizationId,
        key: SETTING_KEY,
      },
    },
    select: { value: true },
  });
  const value = setting?.value;
  const state = value && typeof value === "object" && !Array.isArray(value) && "state" in value
    ? cleanState(value.state)
    : "BW";
  return { state };
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const { searchParams } = new URL(req.url);
  const actorResult = await getSessionBoundActor(req, users, searchParams.get("actorId"));
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);

  return NextResponse.json(await readHolidayState(organization.id));
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canManageMasterData(actorResult.actor)) {
    return NextResponse.json(
      { error: "Nur Admins und Geschäftsführung dürfen das Feiertags-Bundesland ändern." },
      { status: 403 }
    );
  }

  const state = cleanState(body.state);
  await ensureOrganizationSettingsTable();
  await prisma.organizationSetting.upsert({
    where: {
      organizationId_key: {
        organizationId: organization.id,
        key: SETTING_KEY,
      },
    },
    create: {
      organizationId: organization.id,
      key: SETTING_KEY,
      value: { state },
    },
    update: {
      value: { state },
    },
  });

  return NextResponse.json({ state });
}
