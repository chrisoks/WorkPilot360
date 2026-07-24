function normalizeStatus(value: unknown) {
  const status = String(value ?? "").trim();
  const normalized = status.toLowerCase();

  if (normalized === "in umsetzung" || normalized === "umsetzung") return "Umsetzung";
  if (normalized.includes("arbeit unterbrochen") || normalized === "unterbrochen") {
    return "Arbeit unterbrochen";
  }
  if (normalized.includes("abrechnungspr") || normalized === "endkontrolle") {
    return "Abrechnungsprüfung";
  }
  if (normalized.includes("zur abrechnung") || normalized.includes("kundenrechnung")) {
    return "Zur Abrechnung bereit";
  }
  if (normalized.includes("abgeschlossen")) return "Abgeschlossen";
  if (normalized.includes("archiviert")) return "Archiviert";

  return status;
}

const implementationTransitionLockedStatuses = new Set([
  "Arbeit unterbrochen",
  "Abrechnungsprüfung",
  "Zur Abrechnung bereit",
  "Abgeschlossen",
  "Archiviert",
]);

export function shouldOfferStampImplementationTransition(status: unknown) {
  const normalizedStatus = normalizeStatus(status);
  return (
    Boolean(normalizedStatus) &&
    normalizedStatus !== "Umsetzung" &&
    !implementationTransitionLockedStatuses.has(normalizedStatus)
  );
}

export function shouldApplyStampInterruptionTransition(status: unknown) {
  const normalizedStatus = normalizeStatus(status);
  return Boolean(normalizedStatus) && !["Abgeschlossen", "Archiviert"].includes(normalizedStatus);
}
