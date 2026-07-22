import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { normalizePhoneNumber } from "@/lib/phone/normalize";
import {
  auditOksPhoneRequest,
  authenticateOksPhoneRequest,
  OKS_PHONE_SCOPES,
} from "@/lib/integrations/oks-phone/auth";
import { oksPhoneErrorResponse } from "@/lib/integrations/oks-phone/responses";
import {
  buildCustomerDirectLinks,
  buildInvoiceDirectLink,
  buildOfferDirectLink,
  buildProjectDirectLinks,
  getMatchedPhoneFields,
  isActiveContextNote,
  preferLinkedPersonPhoneMatches,
} from "@/lib/integrations/oks-phone/context";
import { isOpenOksPhoneProject } from "@/lib/integrations/oks-phone/project-logbook";

export const dynamic = "force-dynamic";

const contactSelect = {
  id: true,
  category: true,
  type: true,
  customerNumber: true,
  companyName: true,
  firstName: true,
  lastName: true,
  position: true,
  email: true,
  phone: true,
  phoneNormalized: true,
  mobile: true,
  mobileNormalized: true,
  fax: true,
  faxNormalized: true,
  street: true,
  postalCode: true,
  city: true,
  country: true,
  parentCompanyId: true,
  parentCompanyName: true,
  isMainContact: true,
  updatedAt: true,
} as const;

type SuppressedContactPhoneField = "phone" | "mobile" | "fax";

function contactDto(
  contact: Awaited<ReturnType<typeof findContactById>>,
  suppressedPhoneFields: SuppressedContactPhoneField[] = []
) {
  if (!contact) return null;
  return {
    id: contact.id,
    category: contact.category,
    type: contact.type,
    customerNumber: contact.customerNumber,
    companyName: contact.companyName,
    firstName: contact.firstName,
    lastName: contact.lastName,
    position: contact.position,
    email: contact.email,
    phone: suppressedPhoneFields.includes("phone") ? null : contact.phone,
    phoneNormalized: suppressedPhoneFields.includes("phone") ? null : contact.phoneNormalized,
    mobile: suppressedPhoneFields.includes("mobile") ? null : contact.mobile,
    mobileNormalized: suppressedPhoneFields.includes("mobile") ? null : contact.mobileNormalized,
    fax: suppressedPhoneFields.includes("fax") ? null : contact.fax,
    faxNormalized: suppressedPhoneFields.includes("fax") ? null : contact.faxNormalized,
    address: {
      street: contact.street,
      postalCode: contact.postalCode,
      city: contact.city,
      country: contact.country,
    },
    isMainContact: contact.isMainContact,
    updatedAt: contact.updatedAt,
  };
}

async function findContactById(organizationId: string, id: string) {
  return prisma.contact.findFirst({ where: { organizationId, id }, select: contactSelect });
}

function readAuditPayload(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function buildCandidate(organizationId: string, matchedContact: NonNullable<Awaited<ReturnType<typeof findContactById>>>, phone?: string) {
  const customer = matchedContact.parentCompanyId
    ? await findContactById(organizationId, matchedContact.parentCompanyId)
    : matchedContact;
  if (!customer) return null;

  const relatedContacts = await prisma.contact.findMany({
    where: { organizationId, OR: [{ id: customer.id }, { parentCompanyId: customer.id }] },
    select: contactSelect,
    orderBy: [{ isMainContact: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
  });
  const relatedPeople = relatedContacts.filter(
    (contact) => contact.type === "person" && contact.parentCompanyId === customer.id
  );
  const suppressedCustomerPhoneFields = ([
    ["phone", "phoneNormalized"],
    ["mobile", "mobileNormalized"],
    ["fax", "faxNormalized"],
  ] as const)
    .filter(([, normalizedField]) => {
      const normalizedValue = customer[normalizedField];
      return Boolean(
        normalizedValue && relatedPeople.some((person) => person[normalizedField] === normalizedValue)
      );
    })
    .map(([rawField]) => rawField);
  const projects = (await prisma.workPilotProject.findMany({
    where: {
      organizationId,
      OR: [
        { contactId: customer.id },
        { contactPersonId: matchedContact.id },
        { addressContactId: customer.id },
      ],
    },
    select: {
      id: true,
      projectNumber: true,
      title: true,
      status: true,
      statusCode: true,
      projectType: true,
      projectKind: true,
      branch: true,
      address: true,
      contactId: true,
      contactPersonId: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  })).filter((project) => isOpenOksPhoneProject(project.status, project.statusCode));
  const projectIds = projects.map((project) => project.id);
  const today = new Date().toISOString().slice(0, 10);

  const [notes, offers, invoices, customerEntries, legacyEntries, projectEntries] = await Promise.all([
    prisma.customerProjectNote.findMany({
      where: {
        organizationId,
        OR: [
          { scope: "customer", customerId: customer.id },
          ...(projectIds.length ? [{ scope: "project", projectId: { in: projectIds } }] : []),
        ],
      },
      select: {
        id: true,
        scope: true,
        customerId: true,
        projectId: true,
        title: true,
        body: true,
        category: true,
        priority: true,
        effectLevel: true,
        isActive: true,
        validFrom: true,
        validUntil: true,
        archivedAt: true,
        updatedAt: true,
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    }),
    projectIds.length ? prisma.offer.findMany({
      where: { organizationId, projectId: { in: projectIds } },
      select: { id: true, projectId: true, projectNumber: true, projectTitle: true, offerType: true, parentOfferId: true, offerNumber: true, status: true, customerName: true, netTotal: true, grossTotal: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }) : [],
    projectIds.length ? prisma.invoice.findMany({
      where: { organizationId, projectId: { in: projectIds } },
      select: { id: true, projectId: true, projectNumber: true, projectTitle: true, invoiceNumber: true, status: true, customerName: true, netTotal: true, grossTotal: true, dueDate: true, isPaid: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }) : [],
    prisma.customerLogbookEntry.findMany({
      where: { organizationId, customerId: customer.id },
      select: { id: true, contactId: true, eventType: true, title: true, body: true, occurredAt: true, createdByName: true, source: true, direction: true, linkedProjectIds: true },
      orderBy: { occurredAt: "desc" },
      take: 20,
    }),
    prisma.auditLog.findMany({
      where: { organizationId, entityType: "contact-logbook", entityId: customer.id },
      select: { id: true, payload: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    projectIds.length ? prisma.projectLogbookEntry.findMany({
      where: { organizationId, projectId: { in: projectIds } },
      select: { id: true, projectId: true, title: true, body: true, author: true, source: true, callReference: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }) : [],
  ]);

  const activeNotes = notes.filter((note) => isActiveContextNote(note, today));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const customerLogbook = [
    ...customerEntries.map((entry) => ({ ...entry, legacy: false })),
    ...legacyEntries.map((entry) => {
      const payload = readAuditPayload(entry.payload);
      return {
        id: entry.id,
        contactId: null,
        eventType: "manual",
        title: typeof payload.taskTitle === "string" ? payload.taskTitle : "Kundenlogbuch",
        body: typeof payload.text === "string" ? payload.text : "",
        occurredAt: entry.createdAt,
        createdByName: typeof payload.author === "string" ? payload.author : "System",
        source: "workpilot",
        direction: null,
        linkedProjectIds: [],
        legacy: true,
      };
    }),
  ].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime()).slice(0, 20);

  return {
    match: {
      matchedContactId: matchedContact.id,
      quality: phone ? "exact-e164" : "contact-id",
      matchedFields: phone ? getMatchedPhoneFields(matchedContact, phone) : [],
    },
    customer: contactDto(customer, suppressedCustomerPhoneFields),
    matchedContact: contactDto(matchedContact),
    contacts: relatedPeople.map((contact) => contactDto(contact)),
    activeCustomerNotes: activeNotes.filter((note) => note.scope === "customer"),
    activeProjectNotes: activeNotes.filter((note) => note.scope === "project"),
    projects: projects.map((project) => ({ ...project, directLinks: buildProjectDirectLinks(project) })),
    offers: offers.map((offer) => ({
      ...offer,
      documentKind: offer.offerType === "addendum" ? "addendum-offer" : "offer",
      directLink: projectById.get(offer.projectId)
        ? buildOfferDirectLink(projectById.get(offer.projectId)!, offer)
        : null,
    })),
    invoices: invoices.map((invoice) => ({
      ...invoice,
      directLink: projectById.get(invoice.projectId)
        ? buildInvoiceDirectLink(projectById.get(invoice.projectId)!, invoice.id)
        : null,
    })),
    customerLogbook,
    projectLogbook: projectEntries,
    directLinks: buildCustomerDirectLinks(customer.id),
  };
}

export async function GET(request: Request) {
  try {
    const actor = await authenticateOksPhoneRequest(request, OKS_PHONE_SCOPES.customerContextRead);
    const { searchParams } = new URL(request.url);
    const rawPhone = searchParams.get("phone")?.trim() || "";
    const contactId = searchParams.get("contactId")?.trim() || "";
    if ((!rawPhone && !contactId) || (rawPhone && contactId)) {
      return NextResponse.json({ error: "Genau phone oder contactId muss angegeben werden." }, { status: 400 });
    }

    let normalizedPhone = "";
    let matchedContacts: NonNullable<Awaited<ReturnType<typeof findContactById>>>[] = [];
    if (rawPhone) {
      const normalized = normalizePhoneNumber(rawPhone);
      if (normalized.kind !== "valid") {
        await auditOksPhoneRequest({ actor, action: "oks_phone_customer_context_read", entityType: "contact", outcome: "rejected" });
        return NextResponse.json(
          { error: normalized.kind === "invalid" ? normalized.reason : "Rufnummer fehlt." },
          { status: 400 }
        );
      }
      normalizedPhone = normalized.normalized;
      matchedContacts = await prisma.contact.findMany({
        where: {
          organizationId: actor.organizationId,
          OR: [
            { phoneNormalized: normalizedPhone },
            { mobileNormalized: normalizedPhone },
            { faxNormalized: normalizedPhone },
          ],
        },
        select: contactSelect,
        orderBy: { updatedAt: "desc" },
      });
      matchedContacts = preferLinkedPersonPhoneMatches(matchedContacts, normalizedPhone);
    } else {
      const contact = await findContactById(actor.organizationId, contactId);
      if (contact) matchedContacts = [contact];
    }

    const candidates = (await Promise.all(
      matchedContacts.map((contact) => buildCandidate(actor.organizationId, contact, normalizedPhone || undefined))
    )).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
    await auditOksPhoneRequest({
      actor,
      action: "oks_phone_customer_context_read",
      entityType: "contact",
      entityId: candidates.length === 1 ? candidates[0].match.matchedContactId : undefined,
      outcome: "success",
    });

    return NextResponse.json({
      matchCount: candidates.length,
      multipleMatches: candidates.length > 1,
      candidates,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return oksPhoneErrorResponse(error);
  }
}
