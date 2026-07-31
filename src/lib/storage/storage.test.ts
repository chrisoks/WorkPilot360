import { describe, expect, it } from "vitest";

import {
  StorageProviderError,
  buildStorageObjectKey,
  calculateStorageChecksum,
  isStorageChecksum,
  isStorageObjectKey,
  loadStorageConfig,
  storageChecksumsMatch,
} from ".";

describe("storage foundation", () => {
  it("builds private technical keys without customer data", () => {
    expect(
      buildStorageObjectKey({
        organizationId: "org_123",
        ownerType: "online-request",
        ownerId: "request_456",
        category: "Original Photos",
        extension: ".JPG",
        objectId: "70c59d39-682b-4a11-8661-248803a7a372",
        now: new Date("2026-08-01T10:15:00.000Z"),
      })
    ).toBe(
      "organizations/org_123/online-request/request_456/original-photos/2026/08/70c59d39-682b-4a11-8661-248803a7a372.jpg"
    );
  });

  it("rejects path traversal and personal names as path identifiers", () => {
    expect(() =>
      buildStorageObjectKey({
        organizationId: "../foreign-org",
        ownerType: "project",
        ownerId: "project-1",
        category: "images",
      })
    ).toThrow(TypeError);
    expect(isStorageObjectKey("organizations/org-1/../foreign/file.jpg")).toBe(false);
    expect(isStorageObjectKey("/organizations/org-1/file.jpg")).toBe(false);
    expect(isStorageObjectKey("organizations/org-1/file.jpg")).toBe(true);
    expect(() =>
      buildStorageObjectKey({
        organizationId: "org-1",
        ownerType: "project",
        ownerId: "Klaus Testmann",
        category: "images",
      })
    ).toThrow(TypeError);
  });

  it("calculates and compares SHA-256 checksums", () => {
    const first = calculateStorageChecksum(new TextEncoder().encode("workpilot"));
    const second = calculateStorageChecksum(new TextEncoder().encode("workpilot"));
    const other = calculateStorageChecksum(new TextEncoder().encode("other"));

    expect(first).toBe(
      "sha256:d92a7dee079a702208fd03751de58476a63fa1a4e38bb2d9ca3d3b7339ebe67b"
    );
    expect(isStorageChecksum(first)).toBe(true);
    expect(storageChecksumsMatch(first, second)).toBe(true);
    expect(storageChecksumsMatch(first, other)).toBe(false);
  });

  it("keeps storage disabled until it is explicitly configured", () => {
    expect(loadStorageConfig({})).toEqual({ provider: "disabled" });
  });

  it("loads the STRATO-compatible S3 configuration fail-closed", () => {
    expect(
      loadStorageConfig({
        WORKPILOT_STORAGE_PROVIDER: "s3",
        WORKPILOT_S3_ENDPOINT: "https://s3.hidrive.strato.com",
        WORKPILOT_S3_REGION: "eu-central-1",
        WORKPILOT_S3_BUCKET: "workpilot360-prod-assets",
        WORKPILOT_S3_ACCESS_KEY_ID: "access-key",
        WORKPILOT_S3_SECRET_ACCESS_KEY: "secret-key",
        WORKPILOT_S3_FORCE_PATH_STYLE: "true",
      })
    ).toEqual({
      provider: "s3",
      endpoint: "https://s3.hidrive.strato.com",
      region: "eu-central-1",
      bucket: "workpilot360-prod-assets",
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
      forcePathStyle: true,
    });

    expect(() =>
      loadStorageConfig({
        WORKPILOT_STORAGE_PROVIDER: "s3",
        WORKPILOT_S3_ENDPOINT: "http://s3.hidrive.strato.com",
        WORKPILOT_S3_REGION: "eu-central-1",
        WORKPILOT_S3_BUCKET: "workpilot360-prod-assets",
        WORKPILOT_S3_ACCESS_KEY_ID: "access-key",
        WORKPILOT_S3_SECRET_ACCESS_KEY: "secret-key",
      })
    ).toThrow(StorageProviderError);
  });

  it("does not silently accept incomplete production credentials", () => {
    expect(() =>
      loadStorageConfig({
        WORKPILOT_STORAGE_PROVIDER: "s3",
        WORKPILOT_S3_ENDPOINT: "https://s3.hidrive.strato.com",
        WORKPILOT_S3_REGION: "eu-central-1",
        WORKPILOT_S3_BUCKET: "workpilot360-prod-assets",
        WORKPILOT_S3_ACCESS_KEY_ID: "access-key",
      })
    ).toThrowError(/WORKPILOT_S3_SECRET_ACCESS_KEY/);
  });
});
