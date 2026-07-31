import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { calculateStorageChecksum } from "./checksum";
import { S3StorageProvider, type S3CommandSender } from "./s3-provider";

const CONFIG = {
  provider: "s3" as const,
  endpoint: "https://s3.hidrive.strato.com",
  region: "eu-central-1",
  bucket: "workpilot360-prod-assets",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret-key",
  forcePathStyle: true,
};

function createProvider(send: S3CommandSender["send"]) {
  return new S3StorageProvider(CONFIG, { send });
}

describe("S3StorageProvider", () => {
  it("uploads private bytes with checksum and technical metadata", async () => {
    const commands: unknown[] = [];
    const send: S3CommandSender["send"] = vi.fn(async (command) => {
      commands.push(command);
      return { ETag: '"etag-1"' };
    });
    const provider = createProvider(send);
    const body = new TextEncoder().encode("photo");
    const checksum = calculateStorageChecksum(body);

    await expect(
      provider.put({
        key: "organizations/org-1/online-request/request-1/photos/2026/08/file.jpg",
        body,
        contentType: "image/jpeg",
        checksum,
        metadata: {
          organizationId: "org-1",
          ownerType: "online-request",
          ownerId: "request-1",
          category: "photos",
          originalName: "customer-photo.jpg",
          contentType: "image/jpeg",
          sizeBytes: body.byteLength,
          checksum,
        },
      })
    ).resolves.toMatchObject({ etag: "etag-1", checksum, sizeBytes: body.byteLength });

    const command = commands[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toMatchObject({
      Bucket: CONFIG.bucket,
      ContentType: "image/jpeg",
      ContentLength: body.byteLength,
      Metadata: {
        organization: "org-1",
        owner: "online-request",
        ownerid: "request-1",
        category: "photos",
      },
    });
    expect((command as PutObjectCommand).input.Metadata).not.toHaveProperty("originalName");
  });

  it("reads object metadata and keeps the body streamable", async () => {
    async function* body() {
      yield new Uint8Array([1, 2, 3]);
    }
    const commands: unknown[] = [];
    const send: S3CommandSender["send"] = vi.fn(async (command) => {
      commands.push(command);
      return {
        Body: body(),
        ContentType: "application/pdf",
        ContentLength: 3,
        Metadata: { sha256: "a".repeat(64) },
        ETag: '"etag-2"',
      };
    });
    const provider = createProvider(send);

    await expect(provider.get("documents/file.pdf")).resolves.toMatchObject({
      key: "documents/file.pdf",
      contentType: "application/pdf",
      sizeBytes: 3,
      checksum: `sha256:${"a".repeat(64)}`,
      etag: "etag-2",
    });
    expect(commands[0]).toBeInstanceOf(GetObjectCommand);
  });

  it("maps missing objects to null without hiding provider outages", async () => {
    const missing = createProvider(async () => {
      throw { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } };
    });
    await expect(missing.get("missing")).resolves.toBeNull();
    await expect(missing.stat("missing")).resolves.toBeNull();

    const unavailable = createProvider(async () => {
      throw new Error("network down");
    });
    await expect(unavailable.get("file")).rejects.toMatchObject({
      code: "provider-unavailable",
      retryable: true,
    });
  });

  it("rejects unsafe keys and checksum mismatches before contacting S3", async () => {
    const send: S3CommandSender["send"] = vi.fn(async () => ({}));
    const provider = createProvider(send);
    const body = new TextEncoder().encode("photo");

    await expect(provider.get("../foreign-object")).rejects.toMatchObject({
      code: "invalid-object",
      retryable: false,
    });
    await expect(
      provider.put({
        key: "organizations/org-1/project/project-1/photos/2026/08/file.jpg",
        body,
        contentType: "image/jpeg",
        checksum: calculateStorageChecksum(new TextEncoder().encode("different")),
        metadata: {
          organizationId: "org-1",
          ownerType: "project",
          ownerId: "project-1",
          category: "photos",
          originalName: "photo.jpg",
          contentType: "image/jpeg",
          sizeBytes: body.byteLength,
          checksum: calculateStorageChecksum(new TextEncoder().encode("different")),
        },
      })
    ).rejects.toMatchObject({ code: "checksum-mismatch", retryable: false });
    expect(send).not.toHaveBeenCalled();
  });

  it("uses explicit head and delete commands", async () => {
    const commands: unknown[] = [];
    const send: S3CommandSender["send"] = vi.fn(async (command) => {
      commands.push(command);
      if (command instanceof HeadObjectCommand) {
        return { ContentType: "image/webp", ContentLength: 42 };
      }
      return {};
    });
    const provider = createProvider(send);

    await expect(provider.stat("images/file.webp")).resolves.toMatchObject({
      contentType: "image/webp",
      sizeBytes: 42,
    });
    await expect(provider.delete("images/file.webp")).resolves.toBeUndefined();
    expect(commands[0]).toBeInstanceOf(HeadObjectCommand);
    expect(commands[1]).toBeInstanceOf(DeleteObjectCommand);
  });
});
