import { randomUUID } from "crypto";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  loadHeroActiveCutoverSnapshot,
  type HeroActiveContact,
} from "@/lib/hero/active-cutover-source";
import { normalizePhoneNumber } from "@/lib/phone/normalize";
import {
  buildHeroActiveCutoverPlan,
  hashImportPayload,
  HERO_ACTIVE_TARGET_STATUS,
  normalizeHeroProjectNumber,
  planRollback,
  type CanonicalJsonValue,
  type HeroActiveContactPlan,
} from "./hero-active-cutover";

const SOURCE_SYSTEM = "HERO";
const IMPORT_TYPE = "active_project_cutover";

type ImportActor = {
  id: string;
  role: Role;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: unknown) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function actorName(actor: ImportActor) {
  return (
    [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim() ||
    clean(actor.email) ||
    "WorkPilot360"
  );
}

function contactName(contact: {
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
}) {
  return (
    clean(contact.companyName) ||
    [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() ||
    "Unbekannter Kunde"
  );
}

function sourceDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function toCanonicalJson(value: unknown): CanonicalJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_key, entry) =>
      entry instanceof Date ? entry.toISOString() : entry
    )
  ) as CanonicalJsonValue;
}

function projectSnapshot(project: unknown, objectAddress: unknown) {
  return {
    project: toCanonicalJson(project),
    objectAddress: objectAddress ? toCanonicalJson(objectAddress) : null,
  } as CanonicalJsonValue;
}

function contactSnapshot(contact: unknown) {
  return toCanonicalJson(contact);
}

function referenceSnapshot(reference: unknown) {
  return toCanonicalJson(reference);
}

function addressMatchesContact(
  address: { street: string; postalCode: string; city: string },
  contact: {
    street: string | null;
    postalCode: string | null;
    city: string | null;
  }
) {
  return (
    Boolean(address.street && address.postalCode && address.city) &&
    normalize(address.street) === normalize(contact.street) &&
    normalize(address.postalCode) === normalize(contact.postalCode) &&
    normalize(address.city) === normalize(contact.city)
  );
}

function formatAddress(address: {
  street: string;
  postalCode: string;
  city: string;
}) {
  return [
    clean(address.street),
    [clean(address.postalCode), clean(address.city)].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

function phoneValues(value: unknown) {
  const raw = clean(value);
  const normalized = normalizePhoneNumber(raw);
  return {
    raw: raw || null,
    normalized:
      normalized.kind === "valid" ? normalized.normalized : null,
  };
}

function contactCreateOrder(contacts: HeroActiveContactPlan[]) {
  return [...contacts].sort((first, second) => {
    const firstHasParent = first.resolution.parentExternalId ? 1 : 0;
    const secondHasParent = second.resolution.parentExternalId ? 1 : 0;
    return (
      firstHasParent - secondHasParent ||
      first.resolution.displayName.localeCompare(
        second.resolution.displayName,
        "de"
      )
    );
  });
}

export async function prepareHeroActiveImport(organizationId: string) {
  const [hero, workPilotContacts, workPilotProjects, existingReferences] =
    await Promise.all([
      loadHeroActiveCutoverSnapshot(),
      prisma.contact.findMany({
        where: { organizationId },
        select: {
          id: true,
          customerNumber: true,
          companyName: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          mobile: true,
          postalCode: true,
          city: true,
        },
      }),
      prisma.workPilotProject.findMany({
        where: { organizationId },
        select: {
          id: true,
          projectNumber: true,
          title: true,
          status: true,
          contactId: true,
          projectType: true,
          projectKind: true,
          recurringBillingMode: true,
          branch: true,
        },
      }),
      prisma.externalSourceReference.findMany({
        where: { organizationId, sourceSystem: SOURCE_SYSTEM },
      }),
    ]);

  const plan = buildHeroActiveCutoverPlan({
    heroProjects: hero.projects,
    heroContacts: hero.contacts,
    workPilotProjects,
    workPilotContacts,
  });
  const blockers = [...plan.blockers];
  const referenceByKey = new Map(
    existingReferences.map((reference) => [
      `${reference.entityType}:${reference.externalId}`,
      reference,
    ])
  );

  for (const contact of plan.contacts) {
    const reference = referenceByKey.get(
      `contact:${contact.resolution.externalId}`
    );
    if (
      reference &&
      contact.resolution.localEntityId &&
      reference.localEntityId !== contact.resolution.localEntityId
    ) {
      blockers.push({
        entityType: "contact" as const,
        externalId: contact.resolution.externalId,
        label: contact.resolution.displayName,
        message:
          "Die vorhandene HERO-Referenz zeigt auf einen anderen WorkPilot-Kontakt.",
      });
    }
    if (reference && contact.resolution.action === "create") {
      blockers.push({
        entityType: "contact" as const,
        externalId: contact.resolution.externalId,
        label: contact.resolution.displayName,
        message:
          "Für den neuen Kontakt existiert bereits eine widersprüchliche HERO-Referenz.",
      });
    }
  }

  for (const project of plan.projects) {
    const reference = referenceByKey.get(`project:${project.externalId}`);
    if (reference) {
      blockers.push({
        entityType: "project" as const,
        externalId: project.externalId,
        label: project.projectNumber,
        message:
          "Für das fehlende Projekt existiert bereits eine HERO-Referenz. Der Zustand muss geprüft werden.",
      });
    }
  }

  return {
    ...plan,
    capturedAt: hero.capturedAt,
    blockers,
    ready: blockers.length === 0,
  };
}

function importContactData(
  source: HeroActiveContact,
  plan: HeroActiveContactPlan,
  organizationId: string,
  id: string,
  parentCompanyId: string | null,
  parentCompanyName: string | null
) {
  const phone = phoneValues(source.phone_home);
  const mobile = phoneValues(source.phone_mobile);
  return {
    id,
    organizationId,
    category: plan.resolution.targetCategory,
    type: plan.resolution.targetType,
    customerNumber: clean(source.nr),
    companyName: clean(source.company_name) || null,
    firstName: clean(source.first_name) || null,
    lastName: clean(source.last_name) || null,
    email: clean(source.email) || null,
    phone: phone.raw,
    phoneNormalized: phone.normalized,
    mobile: mobile.raw,
    mobileNormalized: mobile.normalized,
    source: "HERO · aktiver Stammdatenimport",
    street: clean(source.address?.street) || null,
    postalCode: clean(source.address?.zipcode) || null,
    city: clean(source.address?.city) || null,
    country: "Deutschland",
    parentCompanyId,
    parentCompanyName,
    createdAt: sourceDate(source.created) ?? new Date(),
    updatedAt: new Date(),
  };
}

export async function executeHeroActiveImport(input: {
  organizationId: string;
  actor: ImportActor;
}) {
  const prepared = await prepareHeroActiveImport(input.organizationId);
  if (!prepared.ready) {
    throw new Error(
      `Der aktive HERO-Import hat ${prepared.blockers.length} Blocker. Es wurde nichts importiert.`
    );
  }
  if (prepared.projects.length === 0) {
    throw new Error("Es gibt keine fehlenden aktiven HERO-Projekte.");
  }
  const requestedByName = actorName(input.actor);

  return prisma.$transaction(
    async (transaction) => {
      const currentProjects = await transaction.workPilotProject.findMany({
        where: { organizationId: input.organizationId },
        select: { id: true, projectNumber: true },
      });
      const currentProjectNumbers = new Set(
        currentProjects.map((project) =>
          normalizeHeroProjectNumber(project.projectNumber)
        )
      );
      const collision = prepared.projects.find((project) =>
        currentProjectNumbers.has(
          normalizeHeroProjectNumber(project.projectNumber)
        )
      );
      if (collision) {
        throw new Error(
          `${collision.projectNumber} wurde zwischenzeitlich angelegt. Es wurde nichts importiert.`
        );
      }

      const run = await transaction.dataImportRun.create({
        data: {
          organizationId: input.organizationId,
          sourceSystem: SOURCE_SYSTEM,
          importType: IMPORT_TYPE,
          status: "running",
          dryRun: false,
          sourceSnapshotHash: prepared.sourceSnapshotHash,
          sourceSnapshotAt: sourceDate(prepared.capturedAt),
          requestedById: input.actor.id,
          requestedByName,
          summary: {
            activeSourceProjects: prepared.activeSourceCount,
            alreadyPresentByProjectNumber: prepared.existing.length,
            requestedProjects: prepared.projects.length,
            requestedContacts: prepared.contacts.length,
            createdProjects: 0,
            createdContacts: 0,
            linkedContacts: 0,
          },
          rollbackStatus: "not_requested",
        },
      });

      const localContactByExternalId = new Map<string, string>();
      let createdContacts = 0;
      let linkedContacts = 0;
      let createdObjectAddresses = 0;

      for (const item of contactCreateOrder(prepared.contacts)) {
        const { resolution, source } = item;
        if (resolution.action === "link") {
          if (!resolution.localEntityId) {
            throw new Error(
              `${resolution.displayName}: Die eindeutige WorkPilot-Kontakt-ID fehlt.`
            );
          }
          const contact = await transaction.contact.findFirst({
            where: {
              id: resolution.localEntityId,
              organizationId: input.organizationId,
            },
          });
          if (!contact) {
            throw new Error(
              `${resolution.displayName}: Der verknüpfte WorkPilot-Kontakt existiert nicht mehr.`
            );
          }
          localContactByExternalId.set(
            resolution.externalId,
            resolution.localEntityId
          );
          const existingReference =
            await transaction.externalSourceReference.findUnique({
              where: {
                organizationId_sourceSystem_entityType_externalId: {
                  organizationId: input.organizationId,
                  sourceSystem: SOURCE_SYSTEM,
                  entityType: "contact",
                  externalId: resolution.externalId,
                },
              },
            });
          if (existingReference) {
            if (existingReference.localEntityId !== resolution.localEntityId) {
              throw new Error(
                `${resolution.displayName}: Die HERO-Kontaktreferenz ist widersprüchlich.`
              );
            }
            continue;
          }
          const reference = await transaction.externalSourceReference.create({
            data: {
              organizationId: input.organizationId,
              sourceSystem: SOURCE_SYSTEM,
              entityType: "contact",
              externalId: resolution.externalId,
              localEntityId: resolution.localEntityId,
              sourceHash: item.sourceHash,
              sourceModifiedAt: sourceDate(source.modified),
              lastImportRunId: run.id,
              metadata: {
                customerNumber: resolution.customerNumber,
                matchMethod: resolution.matchMethod,
              },
            },
          });
          const afterSnapshot = referenceSnapshot(reference);
          await transaction.dataImportRecord.create({
            data: {
              importRunId: run.id,
              organizationId: input.organizationId,
              sourceSystem: SOURCE_SYSTEM,
              entityType: "contact",
              externalId: resolution.externalId,
              localEntityId: resolution.localEntityId,
              action: "link",
              status: "completed",
              sourceHash: item.sourceHash,
              afterHash: hashImportPayload(afterSnapshot),
              sourceSnapshot: toCanonicalJson(source) as Prisma.InputJsonValue,
              beforeSnapshot: Prisma.JsonNull,
              afterSnapshot: afterSnapshot as Prisma.InputJsonValue,
              conflictDetails: {
                matchMethod: resolution.matchMethod,
              },
            },
          });
          linkedContacts += 1;
          continue;
        }

        if (resolution.action !== "create") {
          throw new Error(
            `${resolution.displayName}: Der Kontakt ist nicht sicher importierbar.`
          );
        }
        const existingNumber = await transaction.contact.findFirst({
          where: {
            organizationId: input.organizationId,
            customerNumber: resolution.customerNumber,
          },
          select: { id: true },
        });
        if (existingNumber) {
          throw new Error(
            `${resolution.displayName}: Die HERO-Kundennummer wurde zwischenzeitlich angelegt.`
          );
        }

        const parentCompanyId = resolution.parentExternalId
          ? localContactByExternalId.get(resolution.parentExternalId) ?? null
          : null;
        if (resolution.parentExternalId && !parentCompanyId) {
          throw new Error(
            `${resolution.displayName}: Die übergeordnete Firma konnte nicht zuerst verknüpft werden.`
          );
        }
        const parentCompany = parentCompanyId
          ? await transaction.contact.findUnique({
              where: { id: parentCompanyId },
              select: {
                companyName: true,
                firstName: true,
                lastName: true,
              },
            })
          : null;
        const id = randomUUID();
        const contact = await transaction.contact.create({
          data: importContactData(
            source,
            item,
            input.organizationId,
            id,
            parentCompanyId,
            parentCompany ? contactName(parentCompany) : null
          ),
        });
        await transaction.contactIntegrationEvent.create({
          data: {
            organizationId: input.organizationId,
            contactId: contact.id,
            eventType: "created",
            changedFields: [],
          },
        });
        localContactByExternalId.set(resolution.externalId, contact.id);
        await transaction.externalSourceReference.create({
          data: {
            organizationId: input.organizationId,
            sourceSystem: SOURCE_SYSTEM,
            entityType: "contact",
            externalId: resolution.externalId,
            localEntityId: contact.id,
            sourceHash: item.sourceHash,
            sourceModifiedAt: sourceDate(source.modified),
            lastImportRunId: run.id,
            metadata: {
              customerNumber: resolution.customerNumber,
              matchMethod: "created",
            },
          },
        });
        const afterSnapshot = contactSnapshot(contact);
        await transaction.dataImportRecord.create({
          data: {
            importRunId: run.id,
            organizationId: input.organizationId,
            sourceSystem: SOURCE_SYSTEM,
            entityType: "contact",
            externalId: resolution.externalId,
            localEntityId: contact.id,
            action: "create",
            status: "completed",
            sourceHash: item.sourceHash,
            afterHash: hashImportPayload(afterSnapshot),
            sourceSnapshot: toCanonicalJson(source) as Prisma.InputJsonValue,
            beforeSnapshot: Prisma.JsonNull,
            afterSnapshot: afterSnapshot as Prisma.InputJsonValue,
            conflictDetails: {
              customerNumber: resolution.customerNumber,
            },
          },
        });
        createdContacts += 1;
      }

      for (const item of prepared.projects) {
        const customerId = localContactByExternalId.get(
          item.customerExternalId
        );
        if (!customerId) {
          throw new Error(
            `${item.projectNumber}: Der Projektkunde konnte nicht aufgelöst werden.`
          );
        }
        const customer = await transaction.contact.findUnique({
          where: { id: customerId },
        });
        if (!customer || customer.organizationId !== input.organizationId) {
          throw new Error(
            `${item.projectNumber}: Der Projektkunde existiert nicht mehr.`
          );
        }
        const contactPersonId = item.contactPersonExternalId
          ? localContactByExternalId.get(item.contactPersonExternalId) ?? null
          : null;
        const completeObjectAddress = Boolean(
          item.sourceAddress.street &&
            item.sourceAddress.postalCode &&
            item.sourceAddress.city
        );
        const createObjectAddress =
          completeObjectAddress &&
          !addressMatchesContact(item.sourceAddress, customer);
        const objectAddress = createObjectAddress
          ? await transaction.objectAddress.create({
              data: {
                id: randomUUID(),
                organizationId: input.organizationId,
                customerId,
                name: `Projektadresse ${item.projectNumber}`,
                street: item.sourceAddress.street,
                postalCode: item.sourceAddress.postalCode,
                city: item.sourceAddress.city,
                country: "Deutschland",
                isActive: true,
              },
            })
          : null;
        if (objectAddress) createdObjectAddresses += 1;

        const description = [
          "Aktives HERO-Projekt als Stammdatensatz übernommen.",
          "WorkPilot-Status, Projektart und Abrechnungsmodell müssen fachlich geprüft werden.",
          item.sourceStatusName
            ? `HERO-Ausgangsstatus: ${item.sourceStatusName}${
                item.sourceStatusCode ? ` (${item.sourceStatusCode})` : ""
              }.`
            : "",
          item.sourceModifiedAt
            ? `HERO-Datenstand: ${
                sourceDate(item.sourceModifiedAt)?.toISOString() ??
                item.sourceModifiedAt
              }.`
            : "",
        ]
          .filter(Boolean)
          .join(" ");
        const project = await transaction.workPilotProject.create({
          data: {
            id: randomUUID(),
            organizationId: input.organizationId,
            projectNumber: item.projectNumber,
            title: item.title,
            customer: contactName(customer),
            status: HERO_ACTIVE_TARGET_STATUS,
            statusCode: null,
            description,
            contactId: customerId,
            contactPersonId,
            addressContactId: objectAddress ? null : customerId,
            objectAddressId: objectAddress?.id ?? null,
            projectType: item.targetProjectType,
            projectKind: null,
            recurringBillingMode: null,
            branch: item.targetBranch,
            volume:
              item.sourceVolume !== null && item.sourceVolume > 0
                ? String(item.sourceVolume)
                : null,
            source: "HERO · aktiver Stammdatenimport",
            address: formatAddress(item.sourceAddress),
            createdAt: sourceDate(item.sourceCreatedAt) ?? new Date(),
            updatedAt: new Date(),
          },
        });
        await transaction.statusTimelineEntry.create({
          data: {
            id: randomUUID(),
            organizationId: input.organizationId,
            entityType: "project",
            entityId: project.id,
            entityLabel: `${project.projectNumber} | ${project.title}`,
            fromStatus: null,
            toStatus: HERO_ACTIVE_TARGET_STATUS,
            startedAt: new Date(),
            actorUserId: input.actor.id,
            actorName: requestedByName,
            note:
              "Neutraler WorkPilot-Eingangsstatus nach HERO-Stammdatenimport; Projektart, Abrechnung und Zielstatus werden manuell geprüft.",
          },
        });
        const afterSnapshot = projectSnapshot(project, objectAddress);
        await transaction.externalSourceReference.create({
          data: {
            organizationId: input.organizationId,
            sourceSystem: SOURCE_SYSTEM,
            entityType: "project",
            externalId: item.externalId,
            localEntityId: project.id,
            sourceHash: item.sourceHash,
            sourceModifiedAt: sourceDate(item.sourceModifiedAt),
            lastImportRunId: run.id,
            metadata: {
              projectNumber: item.projectNumber,
              customerExternalId: item.customerExternalId,
              sourceStatusCode: item.sourceStatusCode,
              sourceStatusName: item.sourceStatusName,
              targetStatus: HERO_ACTIVE_TARGET_STATUS,
              manualClassificationRequired: true,
            },
          },
        });
        await transaction.dataImportRecord.create({
          data: {
            importRunId: run.id,
            organizationId: input.organizationId,
            sourceSystem: SOURCE_SYSTEM,
            entityType: "project",
            externalId: item.externalId,
            localEntityId: project.id,
            action: "create",
            status: "completed",
            sourceHash: item.sourceHash,
            afterHash: hashImportPayload(afterSnapshot),
            sourceSnapshot: toCanonicalJson(item) as Prisma.InputJsonValue,
            beforeSnapshot: Prisma.JsonNull,
            afterSnapshot: afterSnapshot as Prisma.InputJsonValue,
            conflictDetails: {
              createdObjectAddressId: objectAddress?.id ?? "",
              customerExternalId: item.customerExternalId,
              contactPersonExternalId: item.contactPersonExternalId,
              projectMatching: "project-number-only",
              documentsImported: false,
            },
          },
        });
      }

      return transaction.dataImportRun.update({
        where: { id: run.id },
        data: {
          status: "completed",
          completedAt: new Date(),
          summary: {
            activeSourceProjects: prepared.activeSourceCount,
            alreadyPresentByProjectNumber: prepared.existing.length,
            requestedProjects: prepared.projects.length,
            createdProjects: prepared.projects.length,
            createdContacts,
            linkedContacts,
            createdObjectAddresses,
            targetStatus: HERO_ACTIVE_TARGET_STATUS,
            projectKind: "manual-review-required",
            documentsImported: 0,
          },
        },
        include: {
          records: {
            orderBy: [{ entityType: "asc" }, { externalId: "asc" }],
          },
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 120_000,
      maxWait: 20_000,
    }
  );
}

async function countProjectDependencies(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  projectId: string
) {
  const rows = await transaction.$queryRaw<Array<{ count: bigint }>>`
    SELECT SUM(dependency_count)::bigint AS count
    FROM (
      SELECT COUNT(*) AS dependency_count FROM "Task" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "UnbilledTimeAlert" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "ProjectEndPhaseReminder" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "SalesOpportunity" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "SalesTarget" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "CustomerFeedbackRequest" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "CustomerFeedback" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "CatalogInventoryMovement" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "Offer" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "OfferHistory" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "OfferAcceptanceRequest" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "Invoice" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "InvoiceHistory" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "DocumentMailDispatch" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "ProjectLogbookEntry" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "ProjectMarketingQuotaItem" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "ProjectMarketingQuotaCompletion" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "CustomerProjectNote" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "CustomerProjectNoteAcknowledgement" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "ProjectTimeEntry" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "ActiveStampSession" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "PlanningEntry" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "PlanningEntryHistory" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "MarketingContentQuota" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "MarketingContentItem" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "MarketingContentSchedule" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "ProjectPotential" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "RecurringProjectReview" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "WinterServiceCalculation" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "VehicleCalculation" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "WinterServiceRun" WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      UNION ALL SELECT COUNT(*) FROM "StatusEscalationEvent" WHERE "organizationId" = ${organizationId} AND "entityType" = 'project' AND "entityId" = ${projectId}
    ) dependencies
  `;
  return Number(rows[0]?.count ?? 0n);
}

async function countContactDependencies(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  contactId: string,
  rollingBackProjectIds: string[]
) {
  const rows = await transaction.$queryRaw<Array<{ count: bigint }>>`
    SELECT SUM(dependency_count)::bigint AS count
    FROM (
      SELECT COUNT(*) AS dependency_count
      FROM "WorkPilotProject"
      WHERE "organizationId" = ${organizationId}
        AND ("contactId" = ${contactId} OR "contactPersonId" = ${contactId} OR "addressContactId" = ${contactId})
        AND NOT ("id" = ANY(${rollingBackProjectIds}::text[]))
      UNION ALL SELECT COUNT(*) FROM "Contact" WHERE "organizationId" = ${organizationId} AND "parentCompanyId" = ${contactId}
      UNION ALL SELECT COUNT(*) FROM "CustomerProjectNote" WHERE "organizationId" = ${organizationId} AND "customerId" = ${contactId}
      UNION ALL SELECT COUNT(*) FROM "ProjectPotential" WHERE "organizationId" = ${organizationId} AND "contactId" = ${contactId}
      UNION ALL SELECT COUNT(*) FROM "SalesOpportunity" WHERE "organizationId" = ${organizationId} AND "contactId" = ${contactId}
      UNION ALL SELECT COUNT(*) FROM "SalesTarget" WHERE "organizationId" = ${organizationId} AND "contactId" = ${contactId}
      UNION ALL SELECT COUNT(*) FROM "CustomerFeedbackRequest" WHERE "organizationId" = ${organizationId} AND "contactId" = ${contactId}
      UNION ALL SELECT COUNT(*) FROM "CustomerFeedback" WHERE "organizationId" = ${organizationId} AND "contactId" = ${contactId}
      UNION ALL SELECT COUNT(*) FROM "WinterServiceRun" WHERE "organizationId" = ${organizationId} AND ("contactId" = ${contactId} OR "contactPersonId" = ${contactId})
    ) dependencies
  `;
  return Number(rows[0]?.count ?? 0n);
}

export async function rollbackHeroActiveImport(input: {
  organizationId: string;
  runId: string;
}) {
  return prisma.$transaction(
    async (transaction) => {
      const run = await transaction.dataImportRun.findFirst({
        where: {
          id: input.runId,
          organizationId: input.organizationId,
          sourceSystem: SOURCE_SYSTEM,
          importType: IMPORT_TYPE,
        },
        include: { records: true },
      });
      if (!run) {
        throw new Error("Der aktive HERO-Importlauf wurde nicht gefunden.");
      }
      if (run.status !== "completed" || run.rollbackStatus === "completed") {
        throw new Error("Der Importlauf ist nicht in einem rücknehmbaren Zustand.");
      }

      const projectRecords = run.records.filter(
        (record) =>
          record.entityType === "project" && record.action === "create"
      );
      const contactRecords = run.records.filter(
        (record) => record.entityType === "contact"
      );
      const rollingBackProjectIds = projectRecords
        .map((record) => record.localEntityId)
        .filter((id): id is string => Boolean(id));
      const projectItems: Array<{
        recordId: string;
        projectId: string;
        objectAddressId: string;
      }> = [];

      for (const record of projectRecords) {
        if (!record.localEntityId) {
          throw new Error(`${record.externalId}: WorkPilot-Projekt-ID fehlt.`);
        }
        const project = await transaction.workPilotProject.findFirst({
          where: {
            id: record.localEntityId,
            organizationId: input.organizationId,
          },
        });
        const afterSnapshot =
          record.afterSnapshot && typeof record.afterSnapshot === "object"
            ? (record.afterSnapshot as {
                objectAddress?: { id?: unknown } | null;
              })
            : null;
        const objectAddressId = clean(afterSnapshot?.objectAddress?.id);
        const objectAddress = objectAddressId
          ? await transaction.objectAddress.findFirst({
              where: {
                id: objectAddressId,
                organizationId: input.organizationId,
              },
            })
          : null;
        const currentSnapshot = project
          ? projectSnapshot(project, objectAddress)
          : null;
        const decision = planRollback({
          action: "create",
          status: record.status,
          rolledBackAt: record.rolledBackAt,
          affectedStateExists: Boolean(project),
          currentAppliedHash: currentSnapshot
            ? hashImportPayload(currentSnapshot)
            : "",
          afterHash: record.afterHash,
        });
        if (decision.action !== "delete_created") {
          throw new Error(
            `${record.externalId}: ${decision.reason} Der gesamte Import bleibt unverändert.`
          );
        }
        const dependencies = await countProjectDependencies(
          transaction,
          input.organizationId,
          record.localEntityId
        );
        const timelineCount = await transaction.statusTimelineEntry.count({
          where: {
            organizationId: input.organizationId,
            entityType: "project",
            entityId: record.localEntityId,
          },
        });
        if (dependencies > 0 || timelineCount !== 1) {
          throw new Error(
            `${record.externalId}: Das Projekt wird bereits verwendet oder wurde verändert.`
          );
        }
        if (objectAddressId) {
          const otherUsage = await transaction.workPilotProject.count({
            where: {
              organizationId: input.organizationId,
              objectAddressId,
              id: { not: record.localEntityId },
            },
          });
          if (otherUsage > 0) {
            throw new Error(
              `${record.externalId}: Die Objektadresse wird bereits anderweitig verwendet.`
            );
          }
        }
        projectItems.push({
          recordId: record.id,
          projectId: record.localEntityId,
          objectAddressId,
        });
      }

      for (const record of contactRecords) {
        if (!record.localEntityId) {
          throw new Error(`${record.externalId}: WorkPilot-Kontakt-ID fehlt.`);
        }
        if (record.action === "link") {
          const reference =
            await transaction.externalSourceReference.findUnique({
              where: {
                organizationId_sourceSystem_entityType_externalId: {
                  organizationId: input.organizationId,
                  sourceSystem: SOURCE_SYSTEM,
                  entityType: "contact",
                  externalId: record.externalId,
                },
              },
            });
          if (
            !reference ||
            reference.localEntityId !== record.localEntityId ||
            reference.lastImportRunId !== run.id ||
            hashImportPayload(referenceSnapshot(reference)) !== record.afterHash
          ) {
            throw new Error(
              `${record.externalId}: Die Kontaktverknüpfung wurde verändert.`
            );
          }
          continue;
        }
        if (record.action !== "create") continue;
        const contact = await transaction.contact.findFirst({
          where: {
            id: record.localEntityId,
            organizationId: input.organizationId,
          },
        });
        const decision = planRollback({
          action: "create",
          status: record.status,
          rolledBackAt: record.rolledBackAt,
          affectedStateExists: Boolean(contact),
          currentAppliedHash: contact
            ? hashImportPayload(contactSnapshot(contact))
            : "",
          afterHash: record.afterHash,
        });
        if (decision.action !== "delete_created") {
          throw new Error(
            `${record.externalId}: ${decision.reason} Der gesamte Import bleibt unverändert.`
          );
        }
        const dependencies = await countContactDependencies(
          transaction,
          input.organizationId,
          record.localEntityId,
          rollingBackProjectIds
        );
        const integrationEvents =
          await transaction.contactIntegrationEvent.findMany({
            where: {
              organizationId: input.organizationId,
              contactId: record.localEntityId,
            },
            select: { eventType: true },
          });
        if (
          dependencies > 0 ||
          integrationEvents.length !== 1 ||
          integrationEvents[0].eventType !== "created"
        ) {
          throw new Error(
            `${record.externalId}: Der neu angelegte Kontakt wird bereits verwendet oder wurde verändert.`
          );
        }
      }

      for (const item of projectItems) {
        await transaction.statusTimelineEntry.deleteMany({
          where: {
            organizationId: input.organizationId,
            entityType: "project",
            entityId: item.projectId,
          },
        });
        await transaction.externalSourceReference.deleteMany({
          where: {
            organizationId: input.organizationId,
            sourceSystem: SOURCE_SYSTEM,
            entityType: "project",
            localEntityId: item.projectId,
            lastImportRunId: run.id,
          },
        });
        await transaction.workPilotProject.delete({
          where: { id: item.projectId },
        });
        if (item.objectAddressId) {
          await transaction.objectAddress.delete({
            where: { id: item.objectAddressId },
          });
        }
        await transaction.dataImportRecord.update({
          where: { id: item.recordId },
          data: { status: "rolled_back", rolledBackAt: new Date() },
        });
      }

      for (const record of contactRecords) {
        if (!record.localEntityId) continue;
        await transaction.externalSourceReference.deleteMany({
          where: {
            organizationId: input.organizationId,
            sourceSystem: SOURCE_SYSTEM,
            entityType: "contact",
            externalId: record.externalId,
            localEntityId: record.localEntityId,
            lastImportRunId: run.id,
          },
        });
        if (record.action === "create") {
          await transaction.contactIntegrationEvent.deleteMany({
            where: {
              organizationId: input.organizationId,
              contactId: record.localEntityId,
            },
          });
          await transaction.contact.delete({
            where: { id: record.localEntityId },
          });
        }
        await transaction.dataImportRecord.update({
          where: { id: record.id },
          data: { status: "rolled_back", rolledBackAt: new Date() },
        });
      }

      return transaction.dataImportRun.update({
        where: { id: run.id },
        data: {
          status: "rolled_back",
          rollbackStatus: "completed",
          rolledBackAt: new Date(),
        },
        include: { records: true },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 120_000,
      maxWait: 20_000,
    }
  );
}
