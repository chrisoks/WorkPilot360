import { NextResponse } from "next/server";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import {
  getSessionBoundActor,
  sessionBoundActorResponse,
} from "@/lib/auth/actor";
import { ensureOnlineRequestStorage } from "@/lib/online-requests/ensure";
import {
  canAssignSalesItemsToOthers,
  canManageOnlineRequests,
  canReadOnlineRequests,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

const ONLINE_REQUEST_STATUSES = new Set([
  "new",
  "in_review",
  "waiting_customer",
  "converted",
  "closed",
]);
const CUSTOMER_DECISIONS = new Set([
  "unreviewed",
  "existing",
  "new",
  "unresolved",
]);

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function actorName(actor: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  return (
    [actor.firstName, actor.lastName].filter(Boolean).join(" ") ||
    actor.email ||
    "WorkPilot"
  );
}

function formatOnlineRequest<
  T extends {
    recommendationTradeIds: unknown;
    recommendationNames: unknown;
    securitySignals: unknown;
    submissionIpHash: string;
    userAgentHash: string | null;
    createdAt: Date;
    updatedAt: Date;
    consentAt: Date;
    handledAt: Date | null;
    convertedAt: Date | null;
    photos?: Array<{
      id: string;
      fileName: string;
      mimeType: string;
      byteSize: number;
      width: number;
      height: number;
      sortOrder: number;
    }>;
    auditEvents?: Array<{
      id: string;
      eventType: string;
      actorUserId: string | null;
      actorName: string;
      payload: unknown;
      createdAt: Date;
    }>;
  },
>(request: T) {
  const {
    securitySignals: _securitySignals,
    submissionIpHash: _submissionIpHash,
    userAgentHash: _userAgentHash,
    ...safeRequest
  } = request;
  return {
    ...safeRequest,
    recommendationTradeIds: stringList(request.recommendationTradeIds),
    recommendationNames: stringList(request.recommendationNames),
    consentAt: request.consentAt.toISOString(),
    handledAt: request.handledAt?.toISOString() ?? "",
    convertedAt: request.convertedAt?.toISOString() ?? "",
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    photos: request.photos?.map((photo) => ({
      ...photo,
      url: `/api/online-requests/photos/${photo.id}`,
    })),
    auditEvents: request.auditEvents?.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export async function GET(request: Request) {
  await ensureOnlineRequestStorage();
  const url = new URL(request.url);
  const { organization, users } = await getDemoContext();
  const requestedActorId = url.searchParams.get("actorId");
  const actorResult = await getSessionBoundActor(
    request,
    users,
    requestedActorId
  );
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canReadOnlineRequests(actorResult.actor)) {
    return NextResponse.json(
      { error: "Du darfst Online-Anfragen nicht einsehen." },
      { status: 403 }
    );
  }

  const summaryOnly = url.searchParams.get("summary") === "1";
  if (summaryOnly) {
    const [newCount, activeCount, oldestNew] = await Promise.all([
      prisma.onlineRequest.count({
        where: { organizationId: organization.id, status: "new" },
      }),
      prisma.onlineRequest.count({
        where: {
          organizationId: organization.id,
          status: { in: ["new", "in_review", "waiting_customer"] },
        },
      }),
      prisma.onlineRequest.findFirst({
        where: { organizationId: organization.id, status: "new" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);
    return NextResponse.json({
      newCount,
      activeCount,
      oldestNewAt: oldestNew?.createdAt.toISOString() ?? "",
    });
  }

  const requestedStatus = cleanString(url.searchParams.get("status"));
  const status = ONLINE_REQUEST_STATUSES.has(requestedStatus)
    ? requestedStatus
    : "";
  const requestedId = cleanString(url.searchParams.get("id"));
  const requests = await prisma.onlineRequest.findMany({
    where: {
      organizationId: organization.id,
      ...(requestedId ? { id: requestedId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: requestedId ? 1 : 200,
    include: {
      photos: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          byteSize: true,
          width: true,
          height: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      auditEvents: {
        select: {
          id: true,
          eventType: true,
          actorUserId: true,
          actorName: true,
          payload: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return NextResponse.json(requests.map(formatOnlineRequest));
}

export async function PATCH(request: Request) {
  await ensureOnlineRequestStorage();
  const body = await request.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(request, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  const actor = actorResult.actor;
  if (!canManageOnlineRequests(actor)) {
    return NextResponse.json(
      { error: "Du darfst Online-Anfragen nicht bearbeiten." },
      { status: 403 }
    );
  }

  const id = cleanString(body.id);
  const current = await prisma.onlineRequest.findFirst({
    where: { id, organizationId: organization.id },
  });
  if (!current) {
    return NextResponse.json(
      { error: "Online-Anfrage wurde nicht gefunden." },
      { status: 404 }
    );
  }
  if (current.status === "converted") {
    return NextResponse.json(
      { error: "Eine umgewandelte Online-Anfrage kann hier nicht mehr geändert werden." },
      { status: 409 }
    );
  }

  const nextStatus = cleanString(body.status) || current.status;
  if (!ONLINE_REQUEST_STATUSES.has(nextStatus) || nextStatus === "converted") {
    return NextResponse.json({ error: "Status ist ungültig." }, { status: 400 });
  }
  const customerDecision =
    cleanString(body.customerDecision) || current.customerDecision;
  if (!CUSTOMER_DECISIONS.has(customerDecision)) {
    return NextResponse.json(
      { error: "Kundenentscheidung ist ungültig." },
      { status: 400 }
    );
  }

  let assignedUserId = current.assignedUserId;
  if (Object.prototype.hasOwnProperty.call(body, "assignedUserId")) {
    const requestedAssigneeId = cleanString(body.assignedUserId);
    if (!requestedAssigneeId) {
      assignedUserId = null;
    } else {
      const assignee = users.find(
        (user) =>
          user.id === requestedAssigneeId &&
          user.isActive &&
          canReadOnlineRequests(user)
      );
      if (!assignee) {
        return NextResponse.json(
          { error: "Verantwortliche Person ist ungültig." },
          { status: 400 }
        );
      }
      if (
        assignee.id !== actor.id &&
        !canAssignSalesItemsToOthers(actor)
      ) {
        return NextResponse.json(
          { error: "Du darfst die Anfrage nicht einer anderen Person zuweisen." },
          { status: 403 }
        );
      }
      assignedUserId = assignee.id;
    }
  }

  let matchedContactId = current.matchedContactId;
  if (customerDecision === "existing") {
    matchedContactId = cleanString(body.matchedContactId);
    const contact = matchedContactId
      ? await prisma.contact.findFirst({
          where: {
            id: matchedContactId,
            organizationId: organization.id,
          },
          select: { id: true },
        })
      : null;
    if (!contact) {
      return NextResponse.json(
        { error: "Bitte einen vorhandenen Kunden eindeutig auswählen." },
        { status: 400 }
      );
    }
  } else {
    matchedContactId = null;
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.onlineRequest.update({
      where: { id: current.id },
      data: {
        status: nextStatus,
        assignedUserId,
        customerDecision,
        matchedContactId,
        handledAt: nextStatus === "new" ? null : current.handledAt ?? now,
      },
    });
    await tx.onlineRequestAuditEvent.create({
      data: {
        organizationId: organization.id,
        onlineRequestId: current.id,
        eventType: "review_updated",
        actorUserId: actor.id,
        actorName: actorName(actor),
        payload: {
          previousStatus: current.status,
          status: nextStatus,
          assignedUserId,
          customerDecision,
          matchedContactId,
        },
      },
    });
    return tx.onlineRequest.findUniqueOrThrow({
      where: { id: current.id },
      include: {
        photos: {
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            byteSize: true,
            width: true,
            height: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: "asc" },
        },
        auditEvents: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  });
  return NextResponse.json(formatOnlineRequest(updated));
}
