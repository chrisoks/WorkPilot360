export type ActivityReportDispatch = {
  documentKind: string;
  documentNumber: string;
  projectId: string;
  body: string;
  status: string;
  createdAt: string;
};

export type ActivityReportDeliveryStatus = {
  createdAt: string;
  mode: "invoice" | "separate";
  invoiceNumber: string;
};

export function normalizeActivityReportDocumentName(value: string) {
  return value.replace(/\.pdf$/i, "").trim().toLocaleLowerCase("de-DE");
}

export function getActivityReportDeliveryStatus(
  documentName: string,
  projectId: string,
  dispatches: ActivityReportDispatch[]
): ActivityReportDeliveryStatus | null {
  const normalizedDocumentName = normalizeActivityReportDocumentName(documentName);
  const latestDispatch = dispatches
    .filter((dispatch) =>
      dispatch.projectId === projectId &&
      dispatch.documentKind === "activityReport" &&
      dispatch.status === "sent" &&
      normalizeActivityReportDocumentName(dispatch.documentNumber) === normalizedDocumentName
    )
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))[0];

  if (!latestDispatch) return null;

  const invoiceMatch = latestDispatch.body.match(/Als Anhang mit Rechnung\s+(.+?)\s+versendet\./i);
  return {
    createdAt: latestDispatch.createdAt,
    mode: invoiceMatch ? "invoice" : "separate",
    invoiceNumber: invoiceMatch?.[1]?.trim() || "",
  };
}
