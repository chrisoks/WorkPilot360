export const STORAGE_OBJECT_STATUSES = [
  "pending",
  "available",
  "quarantined",
  "deleting",
  "deleted",
  "failed",
] as const;

export type StorageObjectStatus = (typeof STORAGE_OBJECT_STATUSES)[number];

export const STORAGE_OWNER_TYPES = [
  "online-request",
  "project",
  "offer",
  "invoice",
  "activity-report",
  "employee",
] as const;

export type StorageOwnerType = (typeof STORAGE_OWNER_TYPES)[number];

export type StorageChecksum = `sha256:${string}`;

export type StorageObjectMetadata = {
  organizationId: string;
  ownerType: StorageOwnerType;
  ownerId: string;
  category: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  checksum: StorageChecksum;
};

export type StoredObjectInfo = {
  key: string;
  contentType: string;
  sizeBytes: number;
  checksum?: StorageChecksum;
  etag?: string;
  lastModified?: Date;
};
