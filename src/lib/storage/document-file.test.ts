import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  prepareStorageAttachments: vi.fn(),
  persistPreparedStoredFiles: vi.fn(),
  cleanupPreparedStorageUploads: vi.fn(),
  loadStorageConfig: vi.fn(),
  createStorageProvider: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    storedFile: { findFirst: mocks.findFirst },
    $transaction: mocks.transaction,
  },
}));
vi.mock("./file-pilot", () => ({
  prepareStorageAttachments: mocks.prepareStorageAttachments,
  persistPreparedStoredFiles: mocks.persistPreparedStoredFiles,
  cleanupPreparedStorageUploads: mocks.cleanupPreparedStorageUploads,
}));
vi.mock("./config", () => ({ loadStorageConfig: mocks.loadStorageConfig }));
vi.mock("./factory", () => ({ createStorageProvider: mocks.createStorageProvider }));

import {
  externalizePdfPayload,
  prepareStorageBackedPayload,
  resolveStorageBackedBytes,
  storedFileIdFromReference,
  storedFileReference,
} from "./document-file";

describe("storage-backed document payloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback) => callback({}));
  });

  it("uses a compact stable database reference after a verified preparation", async () => {
    mocks.prepareStorageAttachments.mockResolvedValue({
      attachments: [{ storageFileId: "file-1", dataUrl: "/api/files/file-1" }],
      files: [],
      provider: null,
      fallbackCount: 0,
    });
    const result = await prepareStorageBackedPayload({
      organizationId: "org-1",
      ownerType: "offer",
      ownerId: "offer-1",
      sourceType: "offer-pdf",
      category: "offers",
      originalName: "ANG-1.pdf",
      contentType: "application/pdf",
      bytes: Buffer.from("%PDF-test"),
    });
    expect(result.reference).toBe("stored-file:file-1");
    expect(mocks.prepareStorageAttachments).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "offer-1",
        attachments: [expect.objectContaining({ sourceEntityId: expect.stringMatching(/^offer-1:/) })],
      })
    );
  });

  it("continues to read legacy base64 payloads without storage access", async () => {
    const bytes = await resolveStorageBackedBytes({
      organizationId: "org-1",
      payload: Buffer.from("legacy").toString("base64"),
    });
    expect(bytes?.toString()).toBe("legacy");
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("recognizes only explicit storage references", () => {
    expect(storedFileReference("abc")).toBe("stored-file:abc");
    expect(storedFileIdFromReference("stored-file:abc")).toBe("abc");
    expect(storedFileIdFromReference("cGRm")).toBeNull();
  });

  it("switches the database payload only inside the StoredFile transaction", async () => {
    mocks.prepareStorageAttachments.mockResolvedValue({
      attachments: [{ storageFileId: "file-1", dataUrl: "/api/files/file-1" }],
      files: [{ record: { id: "file-1" }, uploadedInThisAttempt: true }],
      provider: { delete: vi.fn() },
      fallbackCount: 0,
    });
    const writeReference = vi.fn().mockResolvedValue(undefined);
    const switched = await externalizePdfPayload({
      organizationId: "org-1",
      ownerType: "invoice",
      ownerId: "invoice-1",
      sourceType: "invoice-pdf",
      category: "invoices",
      originalName: "RE-1.pdf",
      pdfBase64: Buffer.from("%PDF-test").toString("base64"),
      writeReference,
    });
    expect(switched).toBe(true);
    expect(mocks.persistPreparedStoredFiles).toHaveBeenCalledTimes(1);
    expect(writeReference).toHaveBeenCalledWith({}, "stored-file:file-1");
  });

  it("keeps the legacy database payload when the reference transaction fails", async () => {
    mocks.prepareStorageAttachments.mockResolvedValue({
      attachments: [{ storageFileId: "file-1", dataUrl: "/api/files/file-1" }],
      files: [{ record: { id: "file-1" }, uploadedInThisAttempt: true }],
      provider: { delete: vi.fn() },
      fallbackCount: 0,
    });
    mocks.transaction.mockRejectedValueOnce(new Error("database unavailable"));
    const writeReference = vi.fn();
    const switched = await externalizePdfPayload({
      organizationId: "org-1",
      ownerType: "offer",
      ownerId: "offer-1",
      sourceType: "offer-pdf",
      category: "offers",
      originalName: "ANG-1.pdf",
      pdfBase64: Buffer.from("%PDF-test").toString("base64"),
      writeReference,
    });
    expect(switched).toBe(false);
    expect(writeReference).not.toHaveBeenCalled();
    expect(mocks.cleanupPreparedStorageUploads).toHaveBeenCalledTimes(1);
  });
});
