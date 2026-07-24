import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  auditOksPhoneRequest,
  authenticateOksPhoneRequest,
  OKS_PHONE_SCOPES,
} from "@/lib/integrations/oks-phone/auth";
import { oksPhoneErrorResponse } from "@/lib/integrations/oks-phone/responses";
import {
  getAvailableAt,
  getZonedParts,
  isAbsenceActiveAt,
  type AbsenceDayPart,
} from "@/lib/integrations/oks-phone/team-availability";

export const dynamic = "force-dynamic";

const SUPPORTED_ABSENCE_TYPES = new Set(["urlaub", "krank", "ueberstundenabbau"]);
const SUPPORTED_DAY_PARTS = new Set<AbsenceDayPart>(["full", "first-half", "second-half"]);

function absenceLabel(value: string) {
  if (value === "urlaub") return "Urlaub";
  if (value === "krank") return "Krank";
  if (value === "ueberstundenabbau") return "Überstundenabbau";
  return "Abwesend";
}

function readAt(request: Request) {
  const raw = new URL(request.url).searchParams.get("at")?.trim();
  if (!raw) return new Date();
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) return null;
  return value;
}

export async function GET(request: Request) {
  try {
    const actor = await authenticateOksPhoneRequest(request, OKS_PHONE_SCOPES.teamAvailabilityRead);
    const at = readAt(request);
    if (!at) {
      await auditOksPhoneRequest({
        actor,
        action: "oks_phone_team_availability_read",
        entityType: "team-availability",
        outcome: "rejected",
      });
      return NextResponse.json({ error: "at muss ein gültiger ISO-Zeitstempel sein." }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: actor.organizationId },
      select: { timezone: true },
    });
    const timeZone = organization?.timezone || "Europe/Berlin";
    const local = getZonedParts(at, timeZone);
    const date = new Date(`${local.dateKey}T00:00:00.000Z`);
    const [users, absences] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId: actor.organizationId, isActive: true },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          planningStartTime: true,
          planningEndTime: true,
          weeklyCapacity: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.absence.findMany({
        where: {
          organizationId: actor.organizationId,
          date,
          status: "genehmigt",
          deletedAt: null,
          type: { in: [...SUPPORTED_ABSENCE_TYPES] },
        },
        select: {
          userId: true,
          requestGroupId: true,
          type: true,
          dayPart: true,
          representativeUserId: true,
        },
      }),
    ]);
    const absenceByUser = new Map(absences.map((absence) => [absence.userId, absence]));
    const representativeIds = [...new Set(absences.map((absence) => absence.representativeUserId).filter((id): id is string => Boolean(id)))];
    const representatives = representativeIds.length
      ? await prisma.user.findMany({
          where: { organizationId: actor.organizationId, isActive: true, id: { in: representativeIds } },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : [];
    const representativeById = new Map(representatives.map((user) => [user.id, user]));
    const groupIds = [...new Set(absences.map((absence) => absence.requestGroupId).filter((id): id is string => Boolean(id)))];
    const groupedRows = groupIds.length
      ? await prisma.absence.findMany({
          where: {
            organizationId: actor.organizationId,
            requestGroupId: { in: groupIds },
            status: "genehmigt",
            deletedAt: null,
          },
          select: { requestGroupId: true, date: true },
          orderBy: { date: "desc" },
        })
      : [];
    const finalDateByGroup = new Map<string, string>();
    for (const row of groupedRows) {
      if (row.requestGroupId && !finalDateByGroup.has(row.requestGroupId)) {
        finalDateByGroup.set(row.requestGroupId, row.date.toISOString().slice(0, 10));
      }
    }

    const members = users.map((user) => {
      const absence = absenceByUser.get(user.id);
      const dayPart = SUPPORTED_DAY_PARTS.has(absence?.dayPart as AbsenceDayPart)
        ? absence?.dayPart as AbsenceDayPart
        : "full";
      const unavailable = Boolean(
        absence && isAbsenceActiveAt(user, dayPart, local.minutes)
      );
      const representative = absence?.representativeUserId
        ? representativeById.get(absence.representativeUserId)
        : undefined;
      const finalAbsenceDateKey = absence?.requestGroupId
        ? finalDateByGroup.get(absence.requestGroupId) || local.dateKey
        : local.dateKey;
      return {
        userId: user.id,
        email: user.email.trim().toLowerCase(),
        unavailable,
        reason: unavailable && absence ? absenceLabel(absence.type) : "",
        availableAt: unavailable
          ? getAvailableAt({
              schedule: user,
              dayPart,
              currentDateKey: local.dateKey,
              finalAbsenceDateKey,
              timeZone,
            }).toISOString()
          : "",
        representativeUserId: unavailable ? representative?.id || "" : "",
        representativeName: unavailable
          ? [representative?.firstName, representative?.lastName].filter(Boolean).join(" ")
          : "",
        representativeEmail: unavailable ? representative?.email.trim().toLowerCase() || "" : "",
      };
    });

    await auditOksPhoneRequest({
      actor,
      action: "oks_phone_team_availability_read",
      entityType: "team-availability",
      outcome: "success",
    });
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      evaluatedAt: at.toISOString(),
      timeZone,
      members,
    });
  } catch (error) {
    return oksPhoneErrorResponse(error);
  }
}
