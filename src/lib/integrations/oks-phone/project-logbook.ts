export function isOpenOksPhoneProject(status: string, statusCode?: string | null) {
  const normalizedStatus = status.trim().toLocaleLowerCase("de-DE");
  const normalizedCode = statusCode?.trim() ?? "";
  return (
    normalizedCode !== "10" &&
    normalizedCode !== "11" &&
    normalizedStatus !== "abgeschlossen" &&
    normalizedStatus !== "archiviert"
  );
}

export function mergeLinkedProjectIds(value: unknown, projectId: string) {
  const current = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
  return current.includes(projectId) ? current : [...current, projectId];
}
