import type { StorageConfig } from "./config";
import type { StorageProvider } from "./provider";
import { S3StorageProvider } from "./s3-provider";

export function createStorageProvider(config: StorageConfig): StorageProvider | null {
  if (config.provider === "disabled") return null;
  return new S3StorageProvider(config);
}
