import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFile, findProject, getObject, getActor } = vi.hoisted(() => ({
  findFile: vi.fn(),
  findProject: vi.fn(),
  getObject: vi.fn(),
  getActor: vi.fn(),
}));

vi.mock("@/lib/auth/actor", () => ({
  getSessionBoundActor: getActor,
  sessionBoundActorResponse: vi.fn(() => new Response(null, { status: 401 })),
}));

vi.mock("@/lib/demo/context", () => ({
  getDemoContext: vi.fn(async () => ({ organization: { id: "org-1" }, users: [] })),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    storedFile: { findFirst: findFile },
    workPilotProject: { findFirst: findProject },
    onlineRequest: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/permissions", () => ({
  canReadOnlineRequests: vi.fn(() => true),
}));

vi.mock("@/lib/storage", () => ({
  loadStorageConfig: vi.fn(() => ({ provider: "s3", bucket: "bucket" })),
  createStorageProvider: vi.fn(() => ({ get: getObject })),
  storageChecksumsMatch: vi.fn(() => true),
}));

const FILE = {
  id: "file-1",
  organizationId: "org-1",
  storageBucket: "bucket",
  objectKey: "organizations/org-1/project/project-1/images/file.jpg",
  ownerType: "project",
  ownerId: "project-1",
  originalName: "Testbild.jpg",
  contentType: "image/jpeg",
  sizeBytes: 4,
  sha256: "a".repeat(64),
  etag: "etag-1",
  status: "available",
  deletedAt: null,
};

describe("protected stored file route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActor.mockResolvedValue({ ok: true, actor: { id: "user-1", role: "Administrator" } });
    findFile.mockResolvedValue(FILE);
    findProject.mockResolvedValue({ id: "project-1" });
    getObject.mockResolvedValue({
      key: FILE.objectKey,
      contentType: FILE.contentType,
      sizeBytes: 4,
      checksum: `sha256:${FILE.sha256}`,
      body: new Uint8Array([1, 2, 3, 4]),
    });
  });

  it("streams an organization-bound file with private caching", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("https://app.test/api/files/file-1"), {
      params: Promise.resolve({ fileId: "file-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("etag")).toBe('"etag-1"');
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([1, 2, 3, 4]);
  });

  it("returns 304 without loading S3 when the private ETag matches", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("https://app.test/api/files/file-1", {
        headers: { "If-None-Match": '"etag-1"' },
      }),
      { params: Promise.resolve({ fileId: "file-1" }) }
    );

    expect(response.status).toBe(304);
    expect(getObject).not.toHaveBeenCalled();
  });

  it("does not reveal a file outside the active organization", async () => {
    findFile.mockResolvedValueOnce(null);
    const { GET } = await import("./route");
    const response = await GET(new Request("https://app.test/api/files/file-1"), {
      params: Promise.resolve({ fileId: "file-1" }),
    });

    expect(response.status).toBe(404);
    expect(getObject).not.toHaveBeenCalled();
  });
});
