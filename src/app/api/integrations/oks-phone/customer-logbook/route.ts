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

export const dynamic = "force-dynamic";

const normalizedPhoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, "Rufnummer muss im E.164-Format uebergeben werden.")
  .optional();

const metadataSchema = z
  .object({
    queueName: z.string().trim().min(1).max(120).optional(),
    disposition: z.string().trim().min(1).max(120).optional(),
    agentExtension: z.string().trim().min(1).max(40).optional(),
  })
  .strict()
  .optional();

const customerLogbookSchema = z
  .object({
    callReference: z.string().trim().min(1).max(200),
    customerId: z.string().trim().min(1).max(200),
    contactId: z.string().trim().min(1).max(200).optional(),
    occurredAt: z.string().datetime({ offset: true }),
    direction: z.enum(["inbound", "outbound", "internal", "unknown"]),
    callerNumberNormalized: normalizedPhoneSchema,
    calledNumberNormalized: normalizedPhoneSchema,
    summary: z.string().trim().min(1).max(5000),
    source: z.literal("oks-phone"),
    handledByUserId: z.string().trim().min(1).max(200).optional(),
    handledByName: z.string().trim().min(1).max(200).optional(),
    transcriptReference: z.string().trim().min(1).max(500).optional(),
    metadata: metadataSchema,
  })
  .strict();

type ContactReference = {
  id: string;
  parentCompanyId: string | null;
};

async function getContactReference(organizationId: string, contactId: string) {
  const rows = await prisma.$queryRaw<ContactReference[]>`
    SELECT "id", "parentCompanyId"
    FROM "Contact"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${contactId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await authenticateOksPhoneRequest(request, OKS_PHONE_SCOPES.customerLogbookWrite);
    const body = await request.json().catch(() => null);
    const parsed = customerLogbookSchema.safeParse(body);
    if (!parsed.success) {
      await auditOksPhoneRequest({
        actor,
        action: "oks_phone_customer_logbook_write",
        entityType: "customer-logbook",
        outcome: "rejected",
      });
      return NextResponse.json(
        { error: "Die uebergebenen Kundenlogbuchdaten sind ungueltig." },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const customer = await getContactReference(actor.organizationId, input.customerId);
    if (!customer) {
      await auditOksPhoneRequest({
        actor,
        action: "oks_phone_customer_logbook_write",
        entityType: "customer-logbook",
        entityId: input.customerId,
        outcome: "rejected",
      });
      return NextResponse.json({ error: "Kunde wurde nicht gefunden." }, { status: 404 });
    }

    if (input.contactId) {
      const contact = await getContactReference(actor.organizationId, input.contactId);
      const contactBelongsToCustomer =
        contact && (contact.id === customer.id || contact.parentCompanyId === customer.id);
      if (!contactBelongsToCustomer) {
        await auditOksPhoneRequest({
          actor,
          action: "oks_phone_customer_logbook_write",
          entityType: "customer-logbook",
          entityId: input.customerId,
          outcome: "rejected",
        });
        return NextResponse.json(
          { error: "Ansprechpartner ist diesem Kunden nicht zugeordnet." },
          { status: 400 }
        );
      }
    }

    const existing = await prisma.customerLogbookEntry.findUnique({
      where: {
        organizationId_source_callReference: {
          organizationId: actor.organizationId,
          source: input.source,
          callReference: input.callReference,
        },
      },
    });
    if (existing) {
      await auditOksPhoneRequest({
        actor,
        action: "oks_phone_customer_logbook_write",
        entityType: "customer-logbook",
        entityId: existing.id,
        outcome: "duplicate",
      });
      return NextResponse.json({ id: existing.id, duplicate: true });
    }

    let entry;
    try {
      entry = await prisma.customerLogbookEntry.create({
        data: {
          organizationId: actor.organizationId,
          customerId: input.customerId,
          contactId: input.contactId,
          eventType: "phone-call-summary",
          title: input.direction === "outbound" ? "Ausgehendes Telefonat" : "Eingehendes Telefonat",
          body: input.summary,
          occurredAt: new Date(input.occurredAt),
          createdByUserId: input.handledByUserId,
          createdByName: input.handledByName || actor.credentialName,
          source: input.source,
          externalReference: input.callReference,
          callReference: input.callReference,
          direction: input.direction,
          callerNumberNormalized: input.callerNumberNormalized,
          calledNumberNormalized: input.calledNumberNormalized,
          transcriptReference: input.transcriptReference,
          linkedProjectIds: [],
          metadata: input.metadata ?? {},
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await prisma.customerLogbookEntry.findUnique({
          where: {
            organizationId_source_callReference: {
              organizationId: actor.organizationId,
              source: input.source,
              callReference: input.callReference,
            },
          },
        });
        if (duplicate) {
          await auditOksPhoneRequest({
            actor,
            action: "oks_phone_customer_logbook_write",
            entityType: "customer-logbook",
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
      action: "oks_phone_customer_logbook_write",
      entityType: "customer-logbook",
      entityId: entry.id,
      outcome: "success",
    });

    return NextResponse.json({ id: entry.id, duplicate: false }, { status: 201 });
  } catch (error) {
    return oksPhoneErrorResponse(error);
  }
}
