import { createHash } from "crypto";
import type {
  HeroActiveContact,
  HeroActiveProject,
} from "@/lib/hero/active-cutover-source";

type JsonPrimitive = string | number | boolean | null;
export type CanonicalJsonValue =
  | JsonPrimitive
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue | undefined };

export type WorkPilotContactPreview = {
  id: string;
  customerNumber: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  postalCode: string | null;
  city: string | null;
};

export type WorkPilotProjectPreview = {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
  contactId: string | null;
  projectType: string | null;
  projectKind: string | null;
  recurringBillingMode: string | null;
  branch: string | null;
};

export type ContactResolution = {
  externalId: string;
  action: "link" | "create" | "skip_deleted" | "conflict";
  localEntityId: string | null;
  matchMethod: string;
  customerNumber: string;
  displayName: string;
  targetType: "company" | "private" | "person";
  targetCategory:
    | "Kunde"
    | "Privatkunde"
    | "Ansprechpartner"
    | "Lieferant"
    | "Partner";
  parentExternalId: string;
  parentLocalEntityId: string | null;
  issues: string[];
};

export const HERO_ACTIVE_TARGET_STATUS = "Lead / Klärung";

export type HeroActiveProjectPlan = {
  externalId: string;
  projectNumber: string;
  title: string;
  customerExternalId: string;
  contactPersonExternalId: string;
  customerResolution: ContactResolution | null;
  contactPersonResolution: ContactResolution | null;
  targetProjectType: string;
  targetBranch: string;
  sourceStatusCode: string;
  sourceStatusName: string;
  sourceCreatedAt: string;
  sourceModifiedAt: string;
  sourceAddress: {
    street: string;
    postalCode: string;
    city: string;
  };
  sourceVolume: number | null;
  sourceHash: string;
  blockers: string[];
  warnings: string[];
};

export type HeroActiveContactPlan = {
  source: HeroActiveContact;
  resolution: ContactResolution;
  sourceHash: string;
  usedAsCustomerBy: string[];
  usedAsContactPersonBy: string[];
  blockers: string[];
  warnings: string[];
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalize(
  value: CanonicalJsonValue | undefined
): CanonicalJsonValue {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

export function hashImportPayload(payload: CanonicalJsonValue) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(payload)), "utf8")
    .digest("hex");
}

export function planRollback(input: {
  action: "create" | "link";
  status: string;
  rolledBackAt?: Date | string | null;
  affectedStateExists: boolean;
  currentAppliedHash?: string;
  afterHash?: string;
}) {
  if (input.rolledBackAt || input.status !== "completed") {
    return { action: "noop" as const };
  }
  if (!input.affectedStateExists) {
    return { action: "noop" as const };
  }
  if (
    !input.afterHash ||
    !input.currentAppliedHash ||
    input.afterHash !== input.currentAppliedHash
  ) {
    return {
      action: "blocked" as const,
      reason:
        "Der angewendete Stand wurde nach dem Import verändert. Eine automatische Rücknahme würde neuere Änderungen gefährden.",
    };
  }
  return input.action === "link"
    ? {
        action: "remove_link" as const,
        reason: "Die unveränderte Herkunftsverknüpfung kann entfernt werden.",
      }
    : {
        action: "delete_created" as const,
        reason: "Der unveränderte Importdatensatz kann entfernt werden.",
      };
}

function compact(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeEmail(value: unknown) {
  return clean(value).toLowerCase();
}

function normalizePhone(value: unknown) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .replace(/^0049/, "49")
    .replace(/^0(?=\d{8,})/, "49");
}

function heroContactName(contact: HeroActiveContact) {
  return (
    clean(contact.company_name) ||
    [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() ||
    clean(contact.email) ||
    "Unbekannter Kontakt"
  );
}

function mapHeroContactType(contact: HeroActiveContact) {
  if (contact.category === "contact" || contact.parent_customer_id) {
    return {
      targetType: "person" as const,
      targetCategory: "Ansprechpartner" as const,
    };
  }
  if (contact.category === "supplier") {
    return {
      targetType: "company" as const,
      targetCategory: "Lieferant" as const,
    };
  }
  if (contact.category === "partner") {
    return {
      targetType: "company" as const,
      targetCategory: "Partner" as const,
    };
  }
  if (contact.type === "private") {
    return {
      targetType: "private" as const,
      targetCategory: "Privatkunde" as const,
    };
  }
  return {
    targetType: "company" as const,
    targetCategory: "Kunde" as const,
  };
}

function createIndex<T>(rows: T[], keys: (row: T) => string[]) {
  const index = new Map<string, T[]>();
  for (const row of rows) {
    for (const key of keys(row).filter(Boolean)) {
      index.set(key, [...(index.get(key) ?? []), row]);
    }
  }
  return index;
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

export function resolveHeroContacts(
  heroContacts: HeroActiveContact[],
  workPilotContacts: WorkPilotContactPreview[]
) {
  const byNumber = createIndex(workPilotContacts, (row) => [
    compact(row.customerNumber),
  ]);
  const byEmail = createIndex(workPilotContacts, (row) => [
    normalizeEmail(row.email),
  ]);
  const byPhone = createIndex(workPilotContacts, (row) => [
    normalizePhone(row.phone),
    normalizePhone(row.mobile),
  ]);
  const byIdentity = createIndex(workPilotContacts, (row) => [
    compact(
      [
        row.companyName,
        row.firstName,
        row.lastName,
        row.postalCode,
        row.city,
      ].join("|")
    ),
  ]);

  const base = heroContacts.map<ContactResolution>((hero) => {
    const target = mapHeroContactType(hero);
    const rawParentExternalId = String(hero.parent_customer_id ?? "").trim();
    const parentExternalId =
      rawParentExternalId === "0" ? "" : rawParentExternalId;
    const numberMatches = uniqueById(
      byNumber.get(compact(hero.nr)) ?? []
    );
    const identityMatches = uniqueById(
      byIdentity.get(
        compact(
          [
            hero.company_name,
            hero.first_name,
            hero.last_name,
            hero.address?.zipcode,
            hero.address?.city,
          ].join("|")
        )
      ) ?? []
    );
    const emailMatches = uniqueById(
      byEmail.get(normalizeEmail(hero.email)) ?? []
    );
    const phoneMatches = uniqueById([
      ...(byPhone.get(normalizePhone(hero.phone_home)) ?? []),
      ...(byPhone.get(normalizePhone(hero.phone_mobile)) ?? []),
    ]);
    const common = {
      externalId: String(hero.id),
      customerNumber: clean(hero.nr),
      displayName: heroContactName(hero),
      ...target,
      parentExternalId,
      parentLocalEntityId: null,
      issues: [] as string[],
    };

    if (numberMatches.length === 1) {
      return {
        ...common,
        action: "link",
        localEntityId: numberMatches[0].id,
        matchMethod: "Kundennummer",
      };
    }
    if (numberMatches.length > 1) {
      return {
        ...common,
        action: "conflict",
        localEntityId: null,
        matchMethod: "Mehrdeutig",
        issues: [
          "Die HERO-Kundennummer passt zu mehreren WorkPilot-Kontakten.",
        ],
      };
    }

    const corroboratedMatches = uniqueById(
      [...emailMatches, ...phoneMatches].filter((candidate) =>
        identityMatches.some((identity) => identity.id === candidate.id)
      )
    );
    if (corroboratedMatches.length === 1) {
      return {
        ...common,
        action: "link",
        localEntityId: corroboratedMatches[0].id,
        matchMethod: "Identität und E-Mail/Telefon",
      };
    }

    const candidates = uniqueById([
      ...identityMatches,
      ...emailMatches,
      ...phoneMatches,
    ]);
    if (candidates.length > 0) {
      return {
        ...common,
        action: "conflict",
        localEntityId: null,
        matchMethod: "Mehrdeutig",
        issues: [
          "Die Kontaktzuordnung ist nicht eindeutig und muss geprüft werden.",
        ],
      };
    }
    if (hero.is_deleted) {
      return {
        ...common,
        action: "skip_deleted",
        localEntityId: null,
        matchMethod: "In HERO gelöscht",
      };
    }
    return {
      ...common,
      action: "create",
      localEntityId: null,
      matchMethod: clean(hero.nr)
        ? "Kein vorhandener WorkPilot-Kontakt"
        : "Neuanlage ohne stabile HERO-Kundennummer",
    };
  });

  const byExternalId = new Map(
    base.map((resolution) => [resolution.externalId, resolution])
  );
  return base.map((resolution) => {
    if (!resolution.parentExternalId) return resolution;
    const parent = byExternalId.get(resolution.parentExternalId);
    if (
      !parent ||
      parent.action === "conflict" ||
      parent.action === "skip_deleted"
    ) {
      return {
        ...resolution,
        action:
          resolution.action === "create"
            ? ("conflict" as const)
            : resolution.action,
        issues: [
          ...resolution.issues,
          "Die übergeordnete Firma ist nicht eindeutig importierbar oder verknüpft.",
        ],
      };
    }
    return {
      ...resolution,
      parentLocalEntityId: parent.localEntityId,
    };
  });
}

export function normalizeHeroProjectNumber(value: unknown) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function normalizeText(value: unknown) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isHeroProjectActive(project: HeroActiveProject) {
  if (project.is_deleted) return false;
  const code = Number(project.current_project_match_status?.status_code);
  const name = normalizeText(project.current_project_match_status?.name);
  return (
    code !== 2000 &&
    code !== 2100 &&
    !name.includes("abgeschlossen") &&
    !name.includes("archiviert")
  );
}

function projectNumber(project: HeroActiveProject) {
  return clean(project.project_nr) || clean(project.display_id);
}

function projectTitle(project: HeroActiveProject) {
  const number = projectNumber(project);
  const sourceTitle =
    clean(project.name) ||
    clean(project.project_title) ||
    clean(project.measure?.name) ||
    `HERO ${project.id}`;
  return number && !normalizeText(sourceTitle).includes(normalizeText(number))
    ? `Projekt ${number} - ${sourceTitle}`
    : sourceTitle;
}

function mapBranch(project: HeroActiveProject) {
  const source = normalizeText(
    `${project.company_branch?.name ?? ""} ${project.type?.name ?? ""}`
  );
  if (source.includes("immocare")) {
    return {
      projectType: "Projekt OK immocare",
      branch: "OK immocare GmbH",
    };
  }
  if (source.includes("solutions")) {
    return {
      projectType: "Projekt OK solutions",
      branch: "OK solutions GmbH",
    };
  }
  return { projectType: "", branch: "" };
}

function contactSourceHash(contact: HeroActiveContact) {
  return hashImportPayload({
    id: String(contact.id),
    number: clean(contact.nr),
    category: clean(contact.category),
    type: clean(contact.type),
    deleted: Boolean(contact.is_deleted),
    parentCustomerId: String(contact.parent_customer_id ?? ""),
    companyName: clean(contact.company_name),
    firstName: clean(contact.first_name),
    lastName: clean(contact.last_name),
    email: clean(contact.email),
    phone: clean(contact.phone_home),
    mobile: clean(contact.phone_mobile),
    created: clean(contact.created),
    modified: clean(contact.modified),
    address: {
      street: clean(contact.address?.street),
      postalCode: clean(contact.address?.zipcode),
      city: clean(contact.address?.city),
    },
  } as CanonicalJsonValue);
}

function projectSourceHash(project: HeroActiveProject) {
  return hashImportPayload({
    id: String(project.id),
    projectNumber: projectNumber(project),
    name: clean(project.name),
    title: clean(project.project_title),
    customerId: String(project.customer_id ?? project.customer?.id ?? ""),
    contactId: String(project.contact_id ?? project.contact?.id ?? ""),
    deleted: Boolean(project.is_deleted),
    created: clean(project.created),
    modified: clean(project.modified),
    volume: project.volume ?? null,
    companyBranchId: String(project.company_branch?.id ?? ""),
    companyBranchName: clean(project.company_branch?.name),
    typeId: String(project.type?.id ?? ""),
    typeName: clean(project.type?.name),
    measureShort: clean(project.measure?.short),
    measureName: clean(project.measure?.name),
    statusCode: String(project.current_project_match_status?.status_code ?? ""),
    statusName: clean(project.current_project_match_status?.name),
    address: {
      street: clean(project.address?.street),
      postalCode: clean(project.address?.zipcode),
      city: clean(project.address?.city),
    },
  } as CanonicalJsonValue);
}

export function buildHeroActiveCutoverPlan(input: {
  heroProjects: HeroActiveProject[];
  heroContacts: HeroActiveContact[];
  workPilotProjects: WorkPilotProjectPreview[];
  workPilotContacts: WorkPilotContactPreview[];
}) {
  const activeProjects = input.heroProjects.filter(isHeroProjectActive);
  const workPilotProjectsByNumber = new Map<string, WorkPilotProjectPreview[]>();
  for (const project of input.workPilotProjects) {
    const key = normalizeHeroProjectNumber(project.projectNumber);
    if (!key) continue;
    workPilotProjectsByNumber.set(key, [
      ...(workPilotProjectsByNumber.get(key) ?? []),
      project,
    ]);
  }

  const sourceProjectCounts = new Map<string, number>();
  for (const project of activeProjects) {
    const key = normalizeHeroProjectNumber(projectNumber(project));
    if (key) sourceProjectCounts.set(key, (sourceProjectCounts.get(key) ?? 0) + 1);
  }

  const contactResolutions = resolveHeroContacts(
    input.heroContacts,
    input.workPilotContacts
  );
  const contactsByExternalId = new Map(
    input.heroContacts.map((contact) => [String(contact.id), contact])
  );
  const resolutionsByExternalId = new Map(
    contactResolutions.map((resolution) => [
      resolution.externalId,
      resolution,
    ])
  );

  const projects: HeroActiveProjectPlan[] = [];
  const existing: Array<{
    externalId: string;
    projectNumber: string;
    localEntityId: string;
  }> = [];

  for (const source of activeProjects) {
    const externalId = String(source.id);
    const number = projectNumber(source);
    const normalizedNumber = normalizeHeroProjectNumber(number);
    const matches = uniqueById(
      workPilotProjectsByNumber.get(normalizedNumber) ?? []
    );

    if (matches.length === 1) {
      existing.push({
        externalId,
        projectNumber: number,
        localEntityId: matches[0].id,
      });
      continue;
    }

    const blockers: string[] = [];
    const warnings: string[] = [];
    if (!normalizedNumber) blockers.push("Eine eindeutige Projektnummer fehlt.");
    if ((sourceProjectCounts.get(normalizedNumber) ?? 0) > 1) {
      blockers.push("Die Projektnummer kommt in den aktiven HERO-Projekten mehrfach vor.");
    }
    if (matches.length > 1) {
      blockers.push("Die Projektnummer passt zu mehreren WorkPilot-Projekten.");
    }

    const customerExternalId = String(
      source.customer_id ?? source.customer?.id ?? ""
    ).trim();
    const rawContactPersonExternalId = String(
      source.contact_id ?? source.contact?.id ?? ""
    ).trim();
    const customerResolution =
      resolutionsByExternalId.get(customerExternalId) ?? null;
    const rawContactPersonResolution =
      rawContactPersonExternalId &&
      rawContactPersonExternalId !== "0" &&
      rawContactPersonExternalId !== customerExternalId
        ? resolutionsByExternalId.get(rawContactPersonExternalId) ?? null
        : null;
    const contactPersonResolution =
      rawContactPersonResolution?.targetCategory === "Ansprechpartner"
        ? rawContactPersonResolution
        : null;
    const contactPersonExternalId = contactPersonResolution
      ? rawContactPersonExternalId
      : "";

    if (
      !customerResolution ||
      customerResolution.action === "conflict" ||
      customerResolution.action === "skip_deleted"
    ) {
      blockers.push("Der Projektkunde ist nicht eindeutig verknüpfbar oder anlegbar.");
    }
    if (
      rawContactPersonExternalId &&
      rawContactPersonExternalId !== "0" &&
      rawContactPersonExternalId !== customerExternalId &&
      rawContactPersonResolution?.targetCategory === "Ansprechpartner" &&
      (!contactPersonResolution ||
        contactPersonResolution.action === "conflict" ||
        contactPersonResolution.action === "skip_deleted")
    ) {
      warnings.push(
        "Der HERO-Ansprechpartner wird nicht automatisch verknüpft und muss nachgepflegt werden."
      );
    }

    const target = mapBranch(source);
    if (!target.projectType || !target.branch) {
      blockers.push("Die HERO-Niederlassung ist nicht eindeutig zugeordnet.");
    }

    projects.push({
      externalId,
      projectNumber: number,
      title: projectTitle(source),
      customerExternalId,
      contactPersonExternalId,
      customerResolution,
      contactPersonResolution,
      targetProjectType: target.projectType,
      targetBranch: target.branch,
      sourceStatusCode: String(
        source.current_project_match_status?.status_code ?? ""
      ),
      sourceStatusName: clean(source.current_project_match_status?.name),
      sourceCreatedAt: clean(source.created),
      sourceModifiedAt: clean(source.modified),
      sourceAddress: {
        street: clean(source.address?.street),
        postalCode: clean(source.address?.zipcode),
        city: clean(source.address?.city),
      },
      sourceVolume:
        typeof source.volume === "number" && Number.isFinite(source.volume)
          ? source.volume
          : null,
      sourceHash: projectSourceHash(source),
      blockers,
      warnings,
    });
  }

  const usedContactIds = new Set(
    projects.flatMap((project) =>
      [
        project.customerExternalId,
        project.contactPersonExternalId,
      ].filter(Boolean)
    )
  );
  const contacts: HeroActiveContactPlan[] = [];
  for (const externalId of usedContactIds) {
    const source = contactsByExternalId.get(externalId);
    const resolution = resolutionsByExternalId.get(externalId);
    if (!source || !resolution) continue;
    const blockers = [...resolution.issues];
    const warnings: string[] = [];
    if (
      resolution.action === "create" &&
      !clean(source.nr)
    ) {
      blockers.push("Für die Neuanlage fehlt eine stabile HERO-Kundennummer.");
    }
    if (
      resolution.action === "create" &&
      !clean(source.company_name) &&
      !clean(source.first_name) &&
      !clean(source.last_name)
    ) {
      blockers.push("Für die Neuanlage fehlt ein verwendbarer Name.");
    }
    contacts.push({
      source,
      resolution,
      sourceHash: contactSourceHash(source),
      usedAsCustomerBy: projects
        .filter((project) => project.customerExternalId === externalId)
        .map((project) => project.projectNumber),
      usedAsContactPersonBy: projects
        .filter((project) => project.contactPersonExternalId === externalId)
        .map((project) => project.projectNumber),
      blockers,
      warnings,
    });
  }

  const createdCustomerNumbers = new Map<string, number>();
  for (const contact of contacts) {
    if (contact.resolution.action !== "create") continue;
    const number = normalizeHeroProjectNumber(contact.resolution.customerNumber);
    if (!number) continue;
    createdCustomerNumbers.set(number, (createdCustomerNumbers.get(number) ?? 0) + 1);
  }
  for (const contact of contacts) {
    const number = normalizeHeroProjectNumber(contact.resolution.customerNumber);
    if (
      contact.resolution.action === "create" &&
      number &&
      (createdCustomerNumbers.get(number) ?? 0) > 1
    ) {
      contact.blockers.push(
        "Die HERO-Kundennummer kommt bei mehreren neu anzulegenden Kontakten vor."
      );
    }
  }

  const blockers = [
    ...projects.flatMap((project) =>
      project.blockers.map((message) => ({
        entityType: "project" as const,
        externalId: project.externalId,
        label: project.projectNumber,
        message,
      }))
    ),
    ...contacts.flatMap((contact) =>
      contact.blockers.map((message) => ({
        entityType: "contact" as const,
        externalId: contact.resolution.externalId,
        label: contact.resolution.displayName,
        message,
      }))
    ),
  ];

  return {
    activeSourceCount: activeProjects.length,
    existing,
    projects: projects.sort((a, b) =>
      a.projectNumber.localeCompare(b.projectNumber, "de")
    ),
    contacts: contacts.sort((a, b) =>
      a.resolution.displayName.localeCompare(b.resolution.displayName, "de")
    ),
    blockers,
    sourceSnapshotHash: hashImportPayload({
      projects: projects
        .map((project) => ({
          externalId: project.externalId,
          sourceHash: project.sourceHash,
        }))
        .sort((a, b) => a.externalId.localeCompare(b.externalId)),
      contacts: contacts
        .map((contact) => ({
          externalId: contact.resolution.externalId,
          sourceHash: contact.sourceHash,
        }))
        .sort((a, b) => a.externalId.localeCompare(b.externalId)),
    } as CanonicalJsonValue),
    ready: blockers.length === 0,
  };
}
