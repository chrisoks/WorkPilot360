import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ prisma: {} }));
vi.mock("@/lib/storage/document-file", () => ({
  cleanupStorageBackedPayload: vi.fn(),
  persistStorageBackedPayload: vi.fn(),
  prepareStorageBackedPayload: vi.fn(),
  readStoredFileBytes: vi.fn(),
}));

import { getReportImages } from "./route";

describe("activity-report route image selection", () => {
  it("keeps protected file metadata for server-side PDF resolution", () => {
    const createdAt = new Date("2026-08-03T10:00:00Z");
    const images = getReportImages(
      [
        {
          id: "entry-1",
          projectId: "project-1",
          title: "Bilder: Vorherbilder",
          body: "",
          author: null,
          colleague: null,
          visibleFor: [],
          attachments: [
            {
              name: "PWA-Vorher.jpg",
              type: "Bild",
              mimeType: "image/jpeg",
              size: 1234,
              storageFileId: "file-1",
              dataUrl: "/api/files/file-1",
            },
          ],
          projectMonth: "2026-08",
          createdAt,
        },
      ],
      "Vorherbilder",
      "2026-08",
      true
    );

    expect(images).toEqual([
      expect.objectContaining({
        name: "PWA-Vorher.jpg",
        storageFileId: "file-1",
        dataUrl: "/api/files/file-1",
        entryDate: createdAt,
      }),
    ]);
  });

  it("also accepts a storage id when an older entry has no public file path", () => {
    const images = getReportImages(
      [
        {
          id: "entry-1",
          projectId: "project-1",
          title: "Bilder: Nachherbilder",
          body: "",
          author: null,
          colleague: null,
          visibleFor: [],
          attachments: [
            { name: "Nachher.png", type: "Bild", storageFileId: "file-2" },
          ],
          projectMonth: null,
          createdAt: new Date("2026-08-03T10:00:00Z"),
        },
      ],
      "Nachherbilder",
      "",
      false
    );

    expect(images).toHaveLength(1);
    expect(images[0].storageFileId).toBe("file-2");
  });
});
