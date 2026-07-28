export const projectReviewStatuses = [
  "unreviewed",
  "needs_review",
  "approved",
] as const;

export type ProjectReviewStatus = (typeof projectReviewStatuses)[number];

export type ProjectReviewApprovalInput = {
  projectType?: unknown;
  projectKind?: unknown;
  projectRuntimeFrom?: unknown;
  projectRuntimeUntil?: unknown;
  billingInterval?: unknown;
  recurringBillingMode?: unknown;
  contactId?: unknown;
  trade?: unknown;
  branch?: unknown;
  responsibleName?: unknown;
  status?: unknown;
  objectAddressId?: unknown;
  addressContactId?: unknown;
  offerStatuses?: unknown[];
};

export const projectReviewRelevantFields = [
  "projectNumber",
  "title",
  "contactId",
  "contactPersonId",
  "addressContactId",
  "objectAddressId",
  "projectType",
  "projectKind",
  "projectRuntimeFrom",
  "projectRuntimeUntil",
  "billingInterval",
  "recurringBillingMode",
  "forecastBillingType",
  "forecastNetAmount",
  "trade",
  "branch",
  "address",
  "responsibleName",
  "timeBudgetEnabled",
  "timeBudgetHours",
  "autoBillingEnabled",
  "autoBillingNetAmount",
  "autoBillingVatRate",
  "autoBillingStartMonth",
  "autoBillingEndMonth",
  "autoBillingTemplateMode",
] as const;

export function normalizeProjectReviewStatus(
  value: unknown
): ProjectReviewStatus {
  return projectReviewStatuses.includes(value as ProjectReviewStatus)
    ? (value as ProjectReviewStatus)
    : "unreviewed";
}

function comparableProjectReviewValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 10000) / 10000 : "";
  }
  return String(value).trim();
}

export function hasProjectReviewRelevantChange(
  before: Record<string, unknown>,
  after: Record<string, unknown>
) {
  return projectReviewRelevantFields.some(
    (field) =>
      comparableProjectReviewValue(before[field]) !==
      comparableProjectReviewValue(after[field])
  );
}

export function getProjectReviewStatusAfterEdit(input: {
  previousStatus: unknown;
  hasRelevantChange: boolean;
}): ProjectReviewStatus {
  const previousStatus = normalizeProjectReviewStatus(input.previousStatus);
  return previousStatus === "approved" && input.hasRelevantChange
    ? "needs_review"
    : previousStatus;
}

function cleanReviewText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeReviewText(value: unknown) {
  return cleanReviewText(value)
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isValidProjectReviewOfferStatus(value: unknown) {
  const normalized = normalizeReviewText(value);
  if (!normalized) return false;
  return ![
    "entwurf",
    "verloren",
    "abgelehnt",
    "storniert",
    "stornorechnung",
    "geloscht",
    "deleted",
  ].some((status) => normalized.includes(status));
}

export function validateProjectReviewApprovalInput(
  input: ProjectReviewApprovalInput
) {
  const problems: string[] = [];
  const projectType = cleanReviewText(input.projectType);
  const projectKind = normalizeReviewText(input.projectKind);
  const isRecurring =
    projectKind.includes("dauerl") && projectKind.includes("projekt");
  const isOneTime = projectKind.includes("einmalig");
  const recurringBillingMode = cleanReviewText(input.recurringBillingMode);

  if (!projectType) {
    problems.push("Unternehmensbereich beziehungsweise Projekttyp fehlt");
  }
  if (!projectKind || (!isRecurring && !isOneTime)) {
    problems.push(
      "Projektart ist nicht eindeutig als einmalig oder Dauerläufer gepflegt"
    );
  }
  if (isRecurring && !["monthlyFlat", "hourly"].includes(recurringBillingMode)) {
    problems.push("Abrechnungsmodell des Dauerläufers fehlt");
  }
  if (isRecurring && !cleanReviewText(input.billingInterval)) {
    problems.push("Fakturierungsintervall des Dauerläufers fehlt");
  }
  if (
    isRecurring &&
    (!cleanReviewText(input.projectRuntimeFrom) ||
      !cleanReviewText(input.projectRuntimeUntil))
  ) {
    problems.push("Projektlaufzeit des Dauerläufers ist nicht vollständig gepflegt");
  }
  if (!cleanReviewText(input.contactId)) {
    problems.push("eindeutige Verknüpfung zur Kundenakte fehlt");
  }
  if (!cleanReviewText(input.trade)) {
    problems.push("Gewerk fehlt");
  }
  if (!cleanReviewText(input.branch)) {
    problems.push("Niederlassung fehlt");
  }
  if (!cleanReviewText(input.responsibleName)) {
    problems.push("Projektverantwortlicher fehlt");
  }
  if (!cleanReviewText(input.status)) {
    problems.push("Projektstatus fehlt");
  }
  if (
    `${projectType} ${cleanReviewText(input.branch)}`
      .toLocaleLowerCase("de-DE")
      .includes("immocare") &&
    !cleanReviewText(input.objectAddressId) &&
    !cleanReviewText(input.addressContactId)
  ) {
    problems.push("Objektadresse des Immocare-Projekts fehlt");
  }
  if (
    !(input.offerStatuses ?? []).some((status) =>
      isValidProjectReviewOfferStatus(status)
    )
  ) {
    problems.push(
      "kein gültiges Angebot im Projekt hinterlegt; ein reiner Angebotsentwurf reicht nicht aus"
    );
  }

  return problems;
}
