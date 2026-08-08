type PdfPreviewWindow = {
  opener: unknown;
  location: { href: string };
  close: () => void;
};

type PdfPreviewDependencies = {
  openWindow: () => PdfPreviewWindow | null;
  fetchPdf: typeof fetch;
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
  schedule: (callback: () => void, delayMs: number) => unknown;
  alert: (message: string) => void;
};

function browserDependencies(): PdfPreviewDependencies {
  return {
    openWindow: () => window.open("", "_blank"),
    fetchPdf: fetch,
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
    alert: (message) => window.alert(message),
  };
}

export async function openPdfPreviewInNewTab(
  pdfUrl: string,
  documentLabel: string,
  dependencies: PdfPreviewDependencies = browserDependencies(),
) {
  if (!pdfUrl) return false;
  const previewWindow = dependencies.openWindow();
  if (!previewWindow) {
    dependencies.alert(`Die ${documentLabel} konnte nicht geöffnet werden. Bitte Pop-ups für WorkPilot erlauben.`);
    return false;
  }
  previewWindow.opener = null;

  try {
    if (!pdfUrl.startsWith("data:")) {
      previewWindow.location.href = pdfUrl;
      return true;
    }
    const response = await dependencies.fetchPdf(pdfUrl);
    if (!response.ok) throw new Error(`pdf_preview_${response.status}`);
    const fetchedBlob = await response.blob();
    const pdfBlob = fetchedBlob.type === "application/pdf"
      ? fetchedBlob
      : fetchedBlob.slice(0, fetchedBlob.size, "application/pdf");
    const objectUrl = dependencies.createObjectUrl(pdfBlob);
    previewWindow.location.href = objectUrl;
    dependencies.schedule(() => dependencies.revokeObjectUrl(objectUrl), 5 * 60 * 1000);
    return true;
  } catch {
    previewWindow.close();
    dependencies.alert(`Die ${documentLabel} konnte nicht geöffnet werden. Bitte die Vorschau erneut aktualisieren.`);
    return false;
  }
}
