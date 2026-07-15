export const PROJECT_BUSINESS_AREA_SOLUTIONS = "OK_SOLUTIONS" as const;
export const PROJECT_BUSINESS_AREA_IMMOCARE = "OK_IMMOCARE" as const;

export type ProjectBusinessAreaCode =
  | typeof PROJECT_BUSINESS_AREA_SOLUTIONS
  | typeof PROJECT_BUSINESS_AREA_IMMOCARE;

type ProjectBusinessAreaInput = {
  projectType?: string | null;
  branch?: string | null;
  projectNumber?: string | null;
};

function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

/** Mirrors the established pipeline classification without display text. */
export function getProjectBusinessAreaCode(
  project: ProjectBusinessAreaInput
): ProjectBusinessAreaCode {
  const projectType = normalize(project.projectType);
  const branch = normalize(project.branch);
  const projectNumber = normalize(project.projectNumber);

  if (
    projectType === "projekt ok immocare" ||
    branch === "ok immocare gmbh" ||
    projectNumber.startsWith("oki-")
  ) {
    return PROJECT_BUSINESS_AREA_IMMOCARE;
  }

  return PROJECT_BUSINESS_AREA_SOLUTIONS;
}
