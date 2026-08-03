import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readStoredFileBytes: vi.fn() }));
vi.mock("@/lib/storage/document-file", () => ({ readStoredFileBytes: mocks.readStoredFileBytes }));

import {
  assertAdditionalAttachmentSize,
  findReminderAttachment,
  resolveDocumentMailAttachment,
  resolveDocumentMailAttachments,
} from "./attachments";

describe("document mail attachments", () => {
  beforeEach(() => mocks.readStoredFileBytes.mockReset());

  it("selects only the exact reminder PDF", () => {
    const invoicePdf = { name: "RE-100.pdf", mimeType: "application/pdf", dataUrl: "data:application/pdf;base64,UkU=" };
    const reminderPdf = { name: "MA-RE-100-1.pdf", mimeType: "application/pdf", storageFileId: "file-reminder" };
    expect(findReminderAttachment([{ attachments: [invoicePdf, reminderPdf] }], "MA-RE-100-1")).toBe(reminderPdf);
    expect(findReminderAttachment([{ attachments: [invoicePdf] }], "MA-RE-100-1")).toBeUndefined();
  });

  it("resolves a private api/files attachment with organization and project binding", async () => {
    mocks.readStoredFileBytes.mockResolvedValue({
      bytes: Buffer.from("private-pdf"),
      file: { originalName: "Bericht.pdf", contentType: "application/pdf" },
    });
    const result = await resolveDocumentMailAttachment({
      organizationId: "org-1",
      projectId: "project-1",
      attachment: { name: "Tätigkeitsbericht.pdf", dataUrl: "/api/files/file-1" },
    });
    expect(mocks.readStoredFileBytes).toHaveBeenCalledWith({
      organizationId: "org-1",
      fileId: "file-1",
      expectedOwnerType: "project",
      expectedOwnerId: "project-1",
    });
    expect(result).toMatchObject({ name: "Tätigkeitsbericht.pdf", contentType: "application/pdf" });
    expect(result?.contentBytes).toBe(Buffer.from("private-pdf").toString("base64"));
  });

  it("resolves an encoded private file id", async () => {
    mocks.readStoredFileBytes.mockResolvedValue({
      bytes: Buffer.from("document"),
      file: { originalName: "Akte.pdf", contentType: "application/pdf" },
    });
    await resolveDocumentMailAttachment({
      organizationId: "org-1",
      projectId: "project-1",
      attachment: { dataUrl: "/api/files/file%3A1" },
    });
    expect(mocks.readStoredFileBytes).toHaveBeenCalledWith(expect.objectContaining({ fileId: "file:1" }));
  });

  it("fails closed when a private attachment is not owned by the project", async () => {
    mocks.readStoredFileBytes.mockResolvedValue(null);
    await expect(resolveDocumentMailAttachments({
      organizationId: "org-1",
      projectId: "project-1",
      value: [{ name: "fremd.pdf", dataUrl: "/api/files/file-other" }],
    })).rejects.toThrow("gehört nicht zu diesem Projekt");
  });

  it("keeps the 15 MB additional attachment limit on the server", () => {
    expect(() => assertAdditionalAttachmentSize([{
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: "large.pdf",
      contentType: "application/pdf",
      contentBytes: Buffer.alloc(15 * 1024 * 1024 + 1).toString("base64"),
    }])).toThrow("größer als 15 MB");
  });
});
