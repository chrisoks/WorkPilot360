import { randomUUID } from "crypto";
import {
  Prisma,
  TaskPriority,
  TaskStatus,
  type User,
} from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  buildOnlineRequestConversionTasks,
  buildOnlineRequestLogbookBody,
  createOnlineRequestProjectNumber,
  createOnlineRequestProjectTitle,
  getOnlineRequestCustomerName,
} from "@/lib/online-requests/conversion";
import { normalizePhoneNumber } from "@/lib/phone/normalize";
import { canConvertOnlineRequests } from "@/lib/permissions";
import {
  cleanupPreparedStorageUploads,
  persistPreparedStoredFiles,
  prepareStorageAttachments,
  type PreparedStorageAttachments,
} from "@/lib/storage/file-pilot";

const PROJECT_STATUS = "Lead / Klärung";
const PROJECT_TYPE = "Projekt OK immocare";
const PROJECT_KIND = "einmaliges Projekt";
const PROJECT_BRANCH = "OK immocare GmbH";
const MAX_TRANSACTION_ATTEMPTS = 3;

export class OnlineRequestConversionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = "OnlineRequestConversionError";
  }
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function actorName(actor: User) {
  return (
    [actor.firstName, actor.lastName].filter(Boolean).join(" ") ||
    actor.email ||
    "WorkPilot"
  );
}

function contactDisplayName(contact: {
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  customerNumber?: string | null;
}) {
  return (
    cleanString(contact.companyName) ||
    [contact.firstName, contact.lastName]
      .map(cleanString)
      .filter(Boolean)
      .join(" ") ||
    cleanString(contact.customerNumber) ||
    "Kunde"
  );
}

function isSerializableRetry(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

async function getNextCustomerNumber(tx: Prisma.TransactionClient, organizationId: string) {
  const rows = await tx.$queryRaw<Array<{ nextNumber: bigint | number | string }>>`
    SELECT (
      COALESCE(
        MAX(
          CASE
            WHEN "customerNumber" ~ '^[0-9]{1,18}$'
              THEN "customerNumber"::BIGINT
            ELSE NULL
          END
        ),
        7000048
      ) + 1
    ) AS "nextNumber"
    FROM "Contact"
    WHERE "organizationId" = ${organizationId}
  `;
  return String(rows[0]?.nextNumber ?? 7000049);
}

async function createStandardProjectIdentity(
  tx: Prisma.TransactionClient,
  organizationId: string,
  projectPrefix: string,
  tradeName: string
) {
  await tx.$queryRaw<Array<{ locked: number }>>`
    SELECT 1::INTEGER AS "locked"
    FROM (
      SELECT pg_advisory_xact_lock(
        hashtext(${"workpilot-project-number:" + organizationId})
      )
    ) AS "projectNumberLock"
  `;
  const rows = await tx.$queryRaw<
    Array<{ nextNumber: bigint | number | string }>
  >`
    SELECT (
      COALESCE(
        MAX(
          CASE
            WHEN "projectNumber" ~ '[0-9]+$'
              THEN substring("projectNumber" FROM '([0-9]+)$')::BIGINT
            ELSE NULL
          END
        ),
        0
      ) + 1
    ) AS "nextNumber"
    FROM "WorkPilotProject"
    WHERE "organizationId" = ${organizationId}
  `;
  const nextNumber = Number(rows[0]?.nextNumber ?? 1);
  if (!Number.isSafeInteger(nextNumber) || nextNumber < 1) {
    throw new OnlineRequestConversionError(
      "Die nächste Projektnummer konnte nicht sicher ermittelt werden.",
      500,
      "project_number_invalid"
    );
  }
  const projectNumber = createOnlineRequestProjectNumber(
    projectPrefix,
    nextNumber
  );
  return {
    projectNumber,
    projectTitle: createOnlineRequestProjectTitle(projectNumber, tradeName),
  };
}

function buildImageAttachments(
  photos: Array<{
    fileName: string;
    mimeType: string;
    byteSize: number;
    data: Uint8Array | Buffer;
  }>
) {
  return photos.map((photo) => ({
    name: photo.fileName,
    type: "Bild",
    mimeType: photo.mimeType,
    size: photo.byteSize,
    dataUrl: `data:${photo.mimeType};base64,${Buffer.from(photo.data).toString(
      "base64"
    )}`,
  }));
}

async function prepareOnlineRequestPhotoStorage(
  organizationId: string,
  requestId: string,
  actorUserId: string
) {
  const photos = await prisma.onlineRequestPhoto.findMany({
    where: { organizationId, onlineRequestId: requestId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      byteSize: true,
      data: true,
    },
  });
  return prepareStorageAttachments({
    organizationId,
    ownerType: "online-request",
    ownerId: requestId,
    sourceType: "online-request-photo",
    category: "request-images",
    createdByUserId: actorUserId,
    attachments: photos.map((photo) => ({
      name: photo.fileName,
      type: "Bild" as const,
      mimeType: photo.mimeType,
      size: photo.byteSize,
      dataUrl: `data:${photo.mimeType};base64,${Buffer.from(photo.data).toString("base64")}`,
      sourceEntityId: photo.id,
    })),
  });
}

async function performConversion({
  organizationId,
  requestId,
  actor,
  users,
  preparedPhotoStorage,
}: {
  organizationId: string;
  requestId: string;
  actor: User;
  users: User[];
  preparedPhotoStorage: PreparedStorageAttachments;
}) {
  const now = new Date();
  return prisma.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "OnlineRequest"
        WHERE "id" = ${requestId}
          AND "organizationId" = ${organizationId}
        FOR UPDATE
      `;
      if (!locked.length) {
        throw new OnlineRequestConversionError(
          "Online-Anfrage wurde nicht gefunden.",
          404,
          "request_not_found"
        );
      }

      const onlineRequest = await tx.onlineRequest.findFirst({
        where: { id: requestId, organizationId },
        include: {
          photos: { orderBy: { sortOrder: "asc" } },
        },
      });
      if (!onlineRequest) {
        throw new OnlineRequestConversionError(
          "Online-Anfrage wurde nicht gefunden.",
          404,
          "request_not_found"
        );
      }

      if (onlineRequest.convertedProjectId) {
        const existingProject = await tx.workPilotProject.findFirst({
          where: {
            id: onlineRequest.convertedProjectId,
            organizationId,
          },
          select: { id: true, contactId: true },
        });
        if (!existingProject) {
          throw new OnlineRequestConversionError(
            "Der gespeicherte Umwandlungsnachweis verweist nicht mehr auf ein gültiges Projekt. Bitte den Datenstand prüfen.",
            409,
            "converted_project_missing"
          );
        }
        return {
          projectId: existingProject.id,
          contactId: existingProject.contactId ?? "",
          taskIds: [] as string[],
          createdContact: false,
          duplicate: true,
        };
      }

      if (onlineRequest.status === "closed") {
        throw new OnlineRequestConversionError(
          "Eine abgeschlossene Anfrage muss vor der Übernahme wieder geöffnet werden.",
          409,
          "request_closed"
        );
      }

      if (
        onlineRequest.customerDecision !== "new" &&
        onlineRequest.customerDecision !== "existing"
      ) {
        throw new OnlineRequestConversionError(
          "Bitte zuerst eindeutig entscheiden, ob ein vorhandener oder ein neuer Kunde verwendet wird.",
          409,
          "customer_decision_required"
        );
      }

      let createdContact = false;
      let contact:
        | {
            id: string;
            companyName: string | null;
            firstName: string | null;
            lastName: string | null;
            customerNumber: string;
          }
        | null = null;

      if (onlineRequest.customerDecision === "existing") {
        if (!onlineRequest.matchedContactId) {
          throw new OnlineRequestConversionError(
            "Bitte einen vorhandenen Kunden eindeutig auswählen.",
            409,
            "matched_contact_required"
          );
        }
        contact = await tx.contact.findFirst({
          where: {
            id: onlineRequest.matchedContactId,
            organizationId,
          },
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            customerNumber: true,
          },
        });
        if (!contact) {
          throw new OnlineRequestConversionError(
            "Der ausgewählte Kunde existiert nicht mehr oder gehört nicht zu dieser Organisation.",
            409,
            "matched_contact_invalid"
          );
        }
      } else {
        const contactId = randomUUID();
        const phone = normalizePhoneNumber(onlineRequest.phone);
        const customerNumber = await getNextCustomerNumber(tx, organizationId);
        contact = await tx.contact.create({
          data: {
            id: contactId,
            organizationId,
            category:
              onlineRequest.customerKind === "private"
                ? "Privatkunde"
                : "Kunde",
            type:
              onlineRequest.customerKind === "private" ? "private" : "company",
            customerNumber,
            companyName: onlineRequest.company,
            firstName: onlineRequest.firstName,
            lastName: onlineRequest.lastName,
            email: onlineRequest.email,
            phone: onlineRequest.phone,
            phoneNormalized:
              phone.kind === "valid" ? phone.normalized : null,
            source: `Online-Anfrage ${onlineRequest.referenceNumber}`,
            reachability:
              onlineRequest.preferredContact === "email"
                ? "E-Mail bevorzugt"
                : onlineRequest.preferredContact === "phone"
                  ? "Telefon bevorzugt"
                  : "E-Mail oder Telefon",
            street: onlineRequest.street,
            postalCode: onlineRequest.postalCode,
            city: onlineRequest.city,
            country: "Deutschland",
            mainContactName: [
              onlineRequest.firstName,
              onlineRequest.lastName,
            ]
              .filter(Boolean)
              .join(" "),
            isMainContact: true,
          },
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            customerNumber: true,
          },
        });
        await tx.contactIntegrationEvent.create({
          data: {
            organizationId,
            contactId,
            eventType: "created_from_online_request",
            changedFields: [
              "source",
              "category",
              "type",
              "customerNumber",
              "address",
            ],
          },
        });
        createdContact = true;
      }

      const objectAddress =
        (await tx.objectAddress.findFirst({
          where: {
            organizationId,
            customerId: contact.id,
            street: onlineRequest.street,
            postalCode: onlineRequest.postalCode,
            city: onlineRequest.city,
            isActive: true,
          },
          select: { id: true },
        })) ??
        (await tx.objectAddress.create({
          data: {
            id: randomUUID(),
            organizationId,
            customerId: contact.id,
            name:
              cleanString(onlineRequest.objectHint) ||
              `Online-Anfrage ${onlineRequest.referenceNumber}`,
            street: onlineRequest.street,
            postalCode: onlineRequest.postalCode,
            city: onlineRequest.city,
            country: "Deutschland",
          },
          select: { id: true },
        }));

      const validTrade = onlineRequest.tradeId
        ? await tx.category.findFirst({
            where: {
              id: onlineRequest.tradeId,
              organizationId,
            },
            select: { id: true, projectPrefix: true },
          })
        : null;
      const taskOwner =
        users.find(
          (user) =>
            user.id === onlineRequest.assignedUserId &&
            user.isActive &&
            canConvertOnlineRequests(user)
        ) ?? actor;
      const taskOwnerName = actorName(taskOwner);
      const projectId = randomUUID();
      const { projectNumber, projectTitle } =
        await createStandardProjectIdentity(
          tx,
          organizationId,
          validTrade?.projectPrefix || "SON",
          onlineRequest.tradeName
        );
      const conversionSource = {
        ...onlineRequest,
        recommendationNames: stringList(onlineRequest.recommendationNames),
      };
      const customerName =
        contactDisplayName(contact) ||
        getOnlineRequestCustomerName(conversionSource);
      const projectAddress = [
        onlineRequest.street,
        onlineRequest.postalCode,
        onlineRequest.city,
      ]
        .filter(Boolean)
        .join(", ");

      await tx.workPilotProject.create({
        data: {
          id: projectId,
          organizationId,
          projectNumber,
          title: projectTitle,
          customer: customerName,
          status: PROJECT_STATUS,
          description: `Aus Online-Anfrage ${onlineRequest.referenceNumber}`,
          contactId: contact.id,
          objectAddressId: objectAddress.id,
          projectType: PROJECT_TYPE,
          projectKind: PROJECT_KIND,
          trade: onlineRequest.tradeName,
          branch: PROJECT_BRANCH,
          source: `Online-Anfrage ${onlineRequest.referenceNumber}`,
          address: projectAddress,
          responsibleName: taskOwnerName,
          reviewStatus: "unreviewed",
        },
      });

      const visibleFor = [
        "Geschaeftsfuehrer",
        "Vertriebler",
        "Niederlassungsleiter",
        "Monteur",
        "Buchhaltung",
      ];
      await tx.projectLogbookEntry.create({
        data: {
          id: randomUUID(),
          organizationId,
          projectId,
          title: "Online-Anfrage",
          body: buildOnlineRequestLogbookBody(conversionSource),
          author: actorName(actor),
          authorUserId: actor.id,
          visibleFor,
          projectMonth: onlineRequest.createdAt
            .toISOString()
            .slice(0, 7),
          source: "online_request",
          callReference: onlineRequest.id,
          createdAt: onlineRequest.createdAt,
        },
      });

      if (onlineRequest.photos.length) {
        await persistPreparedStoredFiles(tx, preparedPhotoStorage);
        await tx.projectLogbookEntry.create({
          data: {
            id: randomUUID(),
            organizationId,
            projectId,
            title: "Bilder: Anfragebilder",
            body: `Originalbilder aus Online-Anfrage ${onlineRequest.referenceNumber}.`,
            author: actorName(actor),
            authorUserId: actor.id,
            visibleFor,
            attachments:
              preparedPhotoStorage.attachments.length === onlineRequest.photos.length
                ? preparedPhotoStorage.attachments
                : buildImageAttachments(onlineRequest.photos),
            projectMonth: onlineRequest.createdAt
              .toISOString()
              .slice(0, 7),
            source: "online_request_images",
            callReference: onlineRequest.id,
            createdAt: onlineRequest.createdAt,
          },
        });
      }

      const taskSpecifications = buildOnlineRequestConversionTasks(
        conversionSource,
        now
      );
      const createdTasks = [];
      for (const specification of taskSpecifications) {
        const task = await tx.task.create({
          data: {
            organizationId,
            title: specification.title,
            description: specification.description,
            status: TaskStatus.OFFEN,
            priority: TaskPriority[specification.priority],
            deadline: specification.deadline,
            customer: customerName,
            projectId,
            categoryId: validTrade?.id ?? null,
            ownerId: taskOwner.id,
            teamId: taskOwner.teamId,
            createdById: actor.id,
            acceptanceStatus:
              taskOwner.id === actor.id ? "accepted" : "pending",
            history: [
              {
                id: randomUUID(),
                event: "Aus Online-Anfrage angelegt",
                actorName: actorName(actor),
                note: onlineRequest.referenceNumber,
                createdAt: now.toISOString(),
              },
            ],
          },
          select: { id: true, title: true, createdAt: true },
        });
        createdTasks.push(task);
        await tx.statusTimelineEntry.create({
          data: {
            id: randomUUID(),
            organizationId,
            entityType: "task",
            entityId: task.id,
            entityLabel: task.title,
            toStatus: "offen",
            startedAt: task.createdAt,
            actorUserId: actor.id,
            actorName: actorName(actor),
            note: "Aus Online-Anfrage angelegt.",
          },
        });
        if (taskOwner.id !== actor.id) {
          await tx.notification.create({
            data: {
              organizationId,
              userId: taskOwner.id,
              taskId: task.id,
              channel: "app",
              subject: "Aufgabe aus Online-Anfrage",
              body: `${onlineRequest.referenceNumber} wurde als Projekt übernommen. Bitte prüfe die Aufgabe „${task.title}“.`,
              linkTarget: "task",
              linkTargetId: task.id,
              linkLabel: "Aufgabe öffnen",
            },
          });
        }
      }

      await tx.statusTimelineEntry.create({
        data: {
          id: randomUUID(),
          organizationId,
          entityType: "project",
          entityId: projectId,
          entityLabel: `${projectNumber} | ${projectTitle}`,
          toStatus: PROJECT_STATUS,
          startedAt: now,
          actorUserId: actor.id,
          actorName: actorName(actor),
          note: `Aus Online-Anfrage ${onlineRequest.referenceNumber} angelegt.`,
        },
      });

      await tx.onlineRequest.update({
        where: { id: onlineRequest.id },
        data: {
          status: "converted",
          matchedContactId: contact.id,
          assignedUserId: taskOwner.id,
          convertedProjectId: projectId,
          handledAt: onlineRequest.handledAt ?? now,
          convertedAt: now,
        },
      });
      await tx.onlineRequestAuditEvent.create({
        data: {
          organizationId,
          onlineRequestId: onlineRequest.id,
          eventType: "converted",
          actorUserId: actor.id,
          actorName: actorName(actor),
          payload: {
            projectId,
            projectNumber,
            contactId: contact.id,
            createdContact,
            taskIds: createdTasks.map((task) => task.id),
            photoCount: onlineRequest.photos.length,
          },
        },
      });
      await tx.notification.updateMany({
        where: {
          organizationId,
          linkTarget: "online-requests",
          linkTargetId: onlineRequest.id,
          resolvedAt: null,
        },
        data: {
          readAt: now,
          resolvedAt: now,
        },
      });

      return {
        projectId,
        contactId: contact.id,
        taskIds: createdTasks.map((task) => task.id),
        createdContact,
        duplicate: false,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30_000,
    }
  );
}

export async function convertOnlineRequest(input: {
  organizationId: string;
  requestId: string;
  actor: User;
  users: User[];
}) {
  const requestId = cleanString(input.requestId);
  if (!requestId) {
    throw new OnlineRequestConversionError(
      "Online-Anfrage fehlt.",
      400,
      "request_missing"
    );
  }
  try {
    const preparedPhotoStorage = await prepareOnlineRequestPhotoStorage(
      input.organizationId,
      requestId,
      input.actor.id
    );
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        const result = await performConversion({
          organizationId: input.organizationId,
          requestId,
          actor: input.actor,
          users: input.users,
          preparedPhotoStorage,
        });
        if (result.duplicate) {
          await cleanupPreparedStorageUploads(preparedPhotoStorage);
        }
        return result;
      } catch (error) {
        if (
          isSerializableRetry(error) &&
          attempt < MAX_TRANSACTION_ATTEMPTS
        ) {
          continue;
        }
        await cleanupPreparedStorageUploads(preparedPhotoStorage);
        throw error;
      }
    }
    await cleanupPreparedStorageUploads(preparedPhotoStorage);
    throw new Error("Conversion retry loop ended unexpectedly.");
  } catch (error) {
    throw error;
  }
}
