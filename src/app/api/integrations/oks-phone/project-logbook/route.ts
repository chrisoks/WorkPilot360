import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import {
  auditOksPhoneRequest,
  authenticateOksPhoneRequest,
  OKS_PHONE_SCOPES,
} from "@/lib/integrations/oks-phone/auth";
import { oksPhoneErrorResponse } from "@/lib/integrations/oks-phone/responses";
import {
  isOpenOksPhoneProject,
  mergeLinkedProjectIds,
} from "@/lib/integrations/oks-phone/project-logbook";

export const dynamic = "force-dynamic";

const projectLogbookSchema = z
  .object({
    callReference: z.string().trim().min(1).max(200),
    customerLogbookEntryId: z.string().trim().min(1).max(200),
    customerId: z.string().trim().min(1).max(200),
    projectId: z.string().trim().min(1).max(200),
    occurredAt: z.string().datetime({ offset: true }),
    summary: z.string().trim().min(1).max(5000),
    source: z.literal("oks-phone"),
    confirmedByUserId: z.string().trim().min(1).max(200),
    confirmedByName: z.string().trim().min(1).max(200),
    confirmationTimestamp: z.string().datetime({ offset: true }),
    agentConfirmed: z.literal(true),
  })
  .strict();

type ProjectReference = {
  id: string;
  contactId: string | null;
  status: string;
  statusCode: string | null;
};

async function getProjectReference(organizationId: string, projectId: string) {
  const rows = await prisma.$queryRaw<ProjectReference[]>`
    SELECT "id", "contactId", "status", "statusCode"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${projectId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function POST(request: Request) {
  try {
    const actor = await authenticateOksPhoneRequest(request, OKS_PHONE_SCOPES.projectLogbookWrite);
    const body = await request.json().catch(() => null);
    const parsed = projectLogbookSchema.safeParse(body);
    if (!parsed.success) {
      await auditOksPhoneRequest({
        actor,
        action: "oks_phone_project_logbook_write",
        entityType: "project-logbook",
        outcome: "rejected",
      });
      return NextResponse.json(
        { error: "Die uebergebenen Projektlogbuchdaten oder die Bestaetigung sind ungueltig." },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const customerEntry = await prisma.customerLogbookEntry.findFirst({
      where: {
        id: input.customerLogbookEntryId,
        organizationId: actor.organizationId,
        customerId: input.customerId,
        source: input.source,
        callReference: input.callReference,
      },
    });
    if (!customerEntry) {
      await auditOksPhoneRequest({
        actor,
        action: "oks_phone_project_logbook_write",
        entityType: "project-logbook",
        entityId: input.projectId,
        outcome: "rejected",
      });
      return NextResponse.json(
        { error: "Zugehoeriger Kundenlogbucheintrag wurde nicht gefunden." },
        { status: 400 }
      );
    }

    const project = await getProjectReference(actor.organizationId, input.projectId);
    if (!project) {
      return NextResponse.json({ error: "Projekt wurde nicht gefunden." }, { status: 404 });
    }
    if (project.contactId !== input.customerId) {
      await auditOksPhoneRequest({
        actor,
        action: "oks_phone_project_logbook_write",
        entityType: "project-logbook",
        entityId: input.projectId,
        outcome: "rejected",
      });
      return NextResponse.json(
        { error: "Projekt ist dem gewaehlten Kunden nicht zugeordnet." },
        { status: 400 }
      );
    }
    if (!isOpenOksPhoneProject(project.status, project.statusCode)) {
      await auditOksPhoneRequest({
        actor,
        action: "oks_phone_project_logbook_write",
        entityType: "project-logbook",
        entityId: input.projectId,
        outcome: "rejected",
      });
      return NextResponse.json(
        { error: "Projekt ist nicht mehr offen. Es wurde kein Logbucheintrag angelegt." },
        { status: 409 }
      );
    }

    const existing = await prisma.projectLogbookEntry.findUnique({
      where: {
        organizationId_source_callReference_projectId: {
          organizationId: actor.organizationId,
          source: input.source,
          callReference: input.callReference,
          projectId: input.projectId,
        },
      },
    });
    if (existing) {
      await auditOksPhoneRequest({
        actor,
        action: "oks_phone_project_logbook_write",
        entityType: "project-logbook",
        entityId: existing.id,
        outcome: "duplicate",
      });
      return NextResponse.json({ id: existing.id, duplicate: true });
    }

    let entry;
    try {
      entry = await prisma.$transaction(async (transaction) => {
        const created = await transaction.projectLogbookEntry.create({
          data: {
            id: randomUUID(),
            organizationId: actor.organizationId,
            projectId: input.projectId,
            title: "Telefonat aus OKS Phone",
            body: input.summary,
            author: input.confirmedByName,
            authorUserId: input.confirmedByUserId,
            visibleFor: [],
            attachments: [],
            source: input.source,
            callReference: input.callReference,
            customerLogbookEntryId: customerEntry.id,
            confirmedByUserId: input.confirmedByUserId,
            confirmedByName: input.confirmedByName,
            confirmationTimestamp: new Date(input.confirmationTimestamp),
            createdAt: new Date(input.occurredAt),
          },
        });
        const existingLinkedProjectIds = Array.isArray(customerEntry.linkedProjectIds)
          ? customerEntry.linkedProjectIds.filter(
              (item): item is string => typeof item === "string"
            )
          : [];
        if (!existingLinkedProjectIds.includes(input.projectId)) {
          await transaction.customerLogbookEntry.update({
            where: { id: customerEntry.id },
            data: {
              linkedProjectIds: mergeLinkedProjectIds(
                existingLinkedProjectIds,
                input.projectId
              ),
            },
          });
        }
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await prisma.projectLogbookEntry.findUnique({
          where: {
            organizationId_source_callReference_projectId: {
              organizationId: actor.organizationId,
              source: input.source,
              callReference: input.callReference,
              projectId: input.projectId,
            },
          },
        });
        if (duplicate) {
          await auditOksPhoneRequest({
            actor,
            action: "oks_phone_project_logbook_write",
            entityType: "project-logbook",
            entityId: duplicate.id,
            outcome: "duplicate",
          });
          return NextResponse.json({ id: duplicate.id, duplicate: true });
        }
      }
      throw error;
    }

    await auditOksPhoneRequest({
      actor,
      action: "oks_phone_project_logbook_write",
      entityType: "project-logbook",
      entityId: entry.id,
      outcome: "success",
    });
    return NextResponse.json({ id: entry.id, duplicate: false }, { status: 201 });
  } catch (error) {
    return oksPhoneErrorResponse(error);
  }
}
