import { createHash, timingSafeEqual } from "node:crypto";

import type { StorageChecksum } from "./types";

const SHA256_CHECKSUM_PATTERN = /^sha256:[a-f0-9]{64}$/;

export function calculateStorageChecksum(data: Uint8Array): StorageChecksum {
  return `sha256:${createHash("sha256").update(data).digest("hex")}`;
}

export function isStorageChecksum(value: string): value is StorageChecksum {
  return SHA256_CHECKSUM_PATTERN.test(value);
}

export function storageChecksumsMatch(
  expected: StorageChecksum,
  actual: StorageChecksum
): boolean {
  if (!isStorageChecksum(expected) || !isStorageChecksum(actual)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}
