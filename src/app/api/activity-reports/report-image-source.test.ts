import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readStoredFileBytes: vi.fn(),
}));

vi.mock("@/lib/storage/document-file", () => ({
  readStoredFileBytes: mocks.readStoredFileBytes,
}));

import {
  fileIdFromProtectedImagePath,
  resolveActivityReportImage,
} from "./report-image-source";

describe("activity-report image sources", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads a protected project image with organization and project ownership checks", async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    mocks.readStoredFileBytes.mockResolvedValue({
      bytes,
      file: { contentType: "image/jpeg" },
    });

    await expect(
      resolveActivityReportImage({
        organizationId: "org-1",
        projectId: "project-1",
        image: {
          name: "Vorher.jpg",
          dataUrl: "/api/files/file%201",
          storageFileId: "file 1",
        },
      })
    ).resolves.toEqual({ bytes, mimeType: "image/jpeg" });

    expect(mocks.readStoredFileBytes).toHaveBeenCalledWith({
      organizationId: "org-1",
      fileId: "file 1",
      expectedOwnerType: "project",
      expectedOwnerId: "project-1",
    });
  });

  it("continues to decode legacy JPG and PNG data URLs without storage access", async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await expect(
      resolveActivityReportImage({
        organizationId: "org-1",
        projectId: "project-1",
        image: {
          name: "Nachher.png",
          dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
        },
      })
    ).resolves.toEqual({ bytes, mimeType: "image/png" });
    expect(mocks.readStoredFileBytes).not.toHaveBeenCalled();
  });

  it("fails closed when the protected file is outside the organization or project", async () => {
    mocks.readStoredFileBytes.mockResolvedValue(null);
    await expect(
      resolveActivityReportImage({
        organizationId: "org-1",
        projectId: "project-1",
        image: { name: "Vorher.jpg", dataUrl: "/api/files/file-2" },
      })
    ).rejects.toThrow("für dieses Projekt nicht verfügbar");
  });

  it("returns a clear error when protected storage is unavailable", async () => {
    mocks.readStoredFileBytes.mockRejectedValue(new Error("storage_not_active"));
    await expect(
      resolveActivityReportImage({
        organizationId: "org-1",
        projectId: "project-1",
        image: { name: "Vorher.jpg", storageFileId: "file-2" },
      })
    ).rejects.toThrow("geschützten Dateispeicher");
  });

  it("rejects conflicting file identifiers and arbitrary image URLs", async () => {
    await expect(
      resolveActivityReportImage({
        organizationId: "org-1",
        projectId: "project-1",
        image: {
          name: "Vorher.jpg",
          storageFileId: "file-1",
          dataUrl: "/api/files/file-2",
        },
      })
    ).rejects.toThrow("widersprüchliche");

    await expect(
      resolveActivityReportImage({
        organizationId: "org-1",
        projectId: "project-1",
        image: { name: "Vorher.jpg", dataUrl: "https://example.test/image.jpg" },
      })
    ).rejects.toThrow("nicht sicher geladen");
  });

  it("parses only the protected file route", () => {
    expect(fileIdFromProtectedImagePath("/api/files/file%2F1?download=1")).toBe("file/1");
    expect(fileIdFromProtectedImagePath("/api/files/")).toBeNull();
    expect(fileIdFromProtectedImagePath("/api/other/file-1")).toBeNull();
  });
});
