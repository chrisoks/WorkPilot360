import { describe, expect, it, vi } from "vitest";
import { openPdfPreviewInNewTab } from "@/lib/documents/pdf-preview";

function dependencies(input: { popup?: boolean; response?: Response } = {}) {
  const popup = input.popup === false ? null : {
    opener: {} as unknown,
    location: { href: "" },
    close: vi.fn(),
  };
  const scheduled: Array<() => void> = [];
  return {
    popup,
    scheduled,
    value: {
      openWindow: vi.fn(() => popup),
      fetchPdf: vi.fn(async () => input.response ?? new Response(new Blob(["pdf"], { type: "application/pdf" }))),
      createObjectUrl: vi.fn(() => "blob:workpilot-preview"),
      revokeObjectUrl: vi.fn(),
      schedule: vi.fn((callback: () => void) => scheduled.push(callback)),
      alert: vi.fn(),
    },
  };
}

describe("PDF preview large view", () => {
  it("opens protected WorkPilot PDF routes directly", async () => {
    const test = dependencies();
    await expect(openPdfPreviewInNewTab("/api/invoices?id=invoice-1&pdf=1", "Rechnungsvorschau", test.value)).resolves.toBe(true);
    expect(test.popup?.location.href).toBe("/api/invoices?id=invoice-1&pdf=1");
    expect(test.value.fetchPdf).not.toHaveBeenCalled();
  });

  it("converts temporary data URLs into a revocable PDF blob URL", async () => {
    const test = dependencies();
    await expect(openPdfPreviewInNewTab("data:application/pdf;base64,cGRm", "Rechnungsvorschau", test.value)).resolves.toBe(true);
    expect(test.popup?.location.href).toBe("blob:workpilot-preview");
    expect(test.value.createObjectUrl).toHaveBeenCalledWith(expect.objectContaining({ type: "application/pdf" }));
    expect(test.value.schedule).toHaveBeenCalledWith(expect.any(Function), 300_000);
    test.scheduled[0]();
    expect(test.value.revokeObjectUrl).toHaveBeenCalledWith("blob:workpilot-preview");
  });

  it("reports a blocked popup without fetching the PDF", async () => {
    const test = dependencies({ popup: false });
    await expect(openPdfPreviewInNewTab("data:application/pdf;base64,cGRm", "Angebotsvorschau", test.value)).resolves.toBe(false);
    expect(test.value.fetchPdf).not.toHaveBeenCalled();
    expect(test.value.alert).toHaveBeenCalledWith(expect.stringContaining("Pop-ups"));
  });

  it("closes the blank tab when conversion fails", async () => {
    const test = dependencies({ response: new Response("error", { status: 500 }) });
    await expect(openPdfPreviewInNewTab("data:application/pdf;base64,cGRm", "Angebotsvorschau", test.value)).resolves.toBe(false);
    expect(test.popup?.close).toHaveBeenCalledOnce();
    expect(test.value.alert).toHaveBeenCalledWith(expect.stringContaining("erneut aktualisieren"));
  });
});
