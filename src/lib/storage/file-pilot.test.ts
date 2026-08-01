import { beforeEach, describe, expect, it, vi } from "vitest";

import { calculateStorageChecksum } from "./checksum";
import { StorageAttachmentValidationError } from "./file-pilot";

const { findUnique, put, stat } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  put: vi.fn(),
  stat: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: { storedFile: { findUnique } },
}));

vi.mock("./config", () => ({
  loadStorageConfig: () => ({
    provider: "s3",
    endpoint: "https://s3.example.test",
    region: "eu-central-1",
    bucket: "workpilot360-prod-assets",
    accessKeyId: "test",
    secretAccessKey: "test",
    forcePathStyle: true,
  }),
}));

vi.mock("./factory", () => ({
  createStorageProvider: () => ({ put, stat, get: vi.fn(), delete: vi.fn() }),
}));

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01]);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF", "ascii");
const XML = Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Invoice><ID>RE-1</ID></Invoice>', "utf8");

describe("storage file pilot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue(null);
    const checksum = calculateStorageChecksum(JPEG);
    put.mockResolvedValue({
      key: "organizations/org/project/project/image/2026/08/file.jpg",
      contentType: "image/jpeg",
      sizeBytes: JPEG.length,
      checksum,
      etag: "etag",
    });
    stat.mockResolvedValue({
      key: "organizations/org/project/project/image/2026/08/file.jpg",
      contentType: "image/jpeg",
      sizeBytes: JPEG.length,
      checksum,
      etag: "etag",
    });
  });

  it("replaces a verified image data URL with a protected WorkPilot file route", async () => {
    const { prepareStorageAttachments } = await import("./file-pilot");
    const prepared = await prepareStorageAttachments({
      organizationId: "org",
      ownerType: "project",
      ownerId: "project",
      sourceType: "project-logbook-attachment",
      category: "logbook-images",
      attachments: [
        {
          name: "test.jpg",
          type: "Bild",
          mimeType: "image/jpeg",
          dataUrl: `data:image/jpeg;base64,${JPEG.toString("base64")}`,
        },
      ],
    });

    expect(prepared.fallbackCount).toBe(0);
    expect(prepared.attachments[0].dataUrl).toMatch(/^\/api\/files\//);
    expect(prepared.attachments[0].storageFileId).toBeTruthy();
    expect(prepared.files[0].record.status).toBe("available");
    expect(put).toHaveBeenCalledOnce();
    expect(stat).toHaveBeenCalledOnce();
  });

  it("keeps the database data URL when the provider is unavailable", async () => {
    put.mockRejectedValueOnce(new Error("offline"));
    const { prepareStorageAttachments } = await import("./file-pilot");
    const dataUrl = `data:image/jpeg;base64,${JPEG.toString("base64")}`;
    const prepared = await prepareStorageAttachments({
      organizationId: "org",
      ownerType: "project",
      ownerId: "project",
      sourceType: "project-logbook-attachment",
      category: "logbook-images",
      attachments: [{ name: "test.jpg", type: "Bild", dataUrl }],
    });

    expect(prepared.fallbackCount).toBe(1);
    expect(prepared.attachments[0].dataUrl).toBe(dataUrl);
    expect(prepared.files[0].record.status).toBe("failed");
  });

  it("replaces a verified PDF data URL with a protected WorkPilot file route", async () => {
    const checksum = calculateStorageChecksum(PDF);
    put.mockResolvedValueOnce({
      key: "organizations/org/project/project/logbook-documents/2026/08/file.pdf",
      contentType: "application/pdf",
      sizeBytes: PDF.length,
      checksum,
      etag: "pdf-etag",
    });
    stat.mockResolvedValueOnce({
      key: "organizations/org/project/project/logbook-documents/2026/08/file.pdf",
      contentType: "application/pdf",
      sizeBytes: PDF.length,
      checksum,
      etag: "pdf-etag",
    });

    const { prepareStorageAttachments } = await import("./file-pilot");
    const prepared = await prepareStorageAttachments({
      organizationId: "org",
      ownerType: "project",
      ownerId: "project",
      sourceType: "project-logbook-attachment",
      category: "logbook-images",
      documentCategory: "logbook-documents",
      attachments: [
        {
          name: "Testangebot.pdf",
          type: "Dokument",
          mimeType: "application/pdf",
          dataUrl: `data:application/pdf;base64,${PDF.toString("base64")}`,
        },
      ],
    });

    expect(prepared.fallbackCount).toBe(0);
    expect(prepared.attachments[0]).toMatchObject({
      dataUrl: expect.stringMatching(/^\/api\/files\//),
      mimeType: "application/pdf",
    });
    expect(prepared.files[0].record).toMatchObject({
      category: "logbook-documents",
      contentType: "application/pdf",
      status: "available",
    });
  });

  it("rejects a PDF whose magic bytes do not match its declared type", async () => {
    const { prepareStorageAttachments } = await import("./file-pilot");
    await expect(
      prepareStorageAttachments({
        organizationId: "org",
        ownerType: "project",
        ownerId: "project",
        sourceType: "project-logbook-attachment",
        category: "logbook-images",
        documentCategory: "logbook-documents",
        attachments: [
          {
            name: "fake.pdf",
            type: "Dokument",
            mimeType: "application/pdf",
            dataUrl: `data:application/pdf;base64,${Buffer.from("not-a-pdf").toString("base64")}`,
          },
        ],
      })
    ).rejects.toBeInstanceOf(StorageAttachmentValidationError);
  });

  it("stores a verified XRechnung XML as an immutable document", async () => {
    const checksum = calculateStorageChecksum(XML);
    put.mockResolvedValueOnce({
      key: "organizations/org/invoice/invoice/e-invoices/2026/08/file.xml",
      contentType: "application/xml",
      sizeBytes: XML.length,
      checksum,
      etag: "xml-etag",
    });
    stat.mockResolvedValueOnce({
      key: "organizations/org/invoice/invoice/e-invoices/2026/08/file.xml",
      contentType: "application/xml",
      sizeBytes: XML.length,
      checksum,
      etag: "xml-etag",
    });

    const { prepareStorageAttachments } = await import("./file-pilot");
    const prepared = await prepareStorageAttachments({
      organizationId: "org",
      ownerType: "invoice",
      ownerId: "invoice",
      sourceType: "invoice-xrechnung-xml",
      category: "e-invoices",
      attachments: [
        {
          name: "RE-1-xrechnung.xml",
          type: "Dokument",
          mimeType: "application/xml",
          dataUrl: `data:application/xml;base64,${XML.toString("base64")}`,
        },
      ],
    });

    expect(prepared.fallbackCount).toBe(0);
    expect(prepared.attachments[0]).toMatchObject({
      dataUrl: expect.stringMatching(/^\/api\/files\//),
      mimeType: "application/xml",
    });
    expect(prepared.files[0].record).toMatchObject({
      category: "e-invoices",
      contentType: "application/xml",
      status: "available",
    });
  });

  it("rejects malformed content declared as XRechnung XML", async () => {
    const { prepareStorageAttachments } = await import("./file-pilot");
    await expect(
      prepareStorageAttachments({
        organizationId: "org",
        ownerType: "invoice",
        ownerId: "invoice",
        sourceType: "invoice-xrechnung-xml",
        category: "e-invoices",
        attachments: [
          {
            name: "fake.xml",
            type: "Dokument",
            mimeType: "application/xml",
            dataUrl: `data:application/xml;base64,${Buffer.from("not-xml").toString("base64")}`,
          },
        ],
      })
    ).rejects.toBeInstanceOf(StorageAttachmentValidationError);
  });

  it("rejects content whose magic bytes do not match its declared MIME type", async () => {
    const { prepareStorageAttachments } = await import("./file-pilot");
    await expect(
      prepareStorageAttachments({
        organizationId: "org",
        ownerType: "project",
        ownerId: "project",
        sourceType: "project-logbook-attachment",
        category: "logbook-images",
        attachments: [
          {
            name: "fake.jpg",
            type: "Bild",
            dataUrl: `data:image/jpeg;base64,${Buffer.from("not-an-image").toString("base64")}`,
          },
        ],
      })
    ).rejects.toBeInstanceOf(StorageAttachmentValidationError);
  });
});
