import {
  ChecksumMode,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
  type HeadObjectCommandOutput,
  type PutObjectCommandOutput,
} from "@aws-sdk/client-s3";

import type { S3StorageConfig } from "./config";
import {
  calculateStorageChecksum,
  isStorageChecksum,
  storageChecksumsMatch,
} from "./checksum";
import { isStorageObjectKey } from "./object-key";
import {
  StorageProviderError,
  type GetStorageObjectResult,
  type PutStorageObjectInput,
  type StorageProvider,
} from "./provider";
import type { StorageChecksum, StoredObjectInfo } from "./types";

type S3StorageCommand =
  | PutObjectCommand
  | GetObjectCommand
  | HeadObjectCommand
  | DeleteObjectCommand;

export type S3CommandSender = {
  send(command: S3StorageCommand): Promise<unknown>;
};

function checksumHex(checksum: StorageChecksum): string {
  return checksum.slice("sha256:".length);
}

function checksumBase64(checksum: StorageChecksum): string {
  return Buffer.from(checksumHex(checksum), "hex").toString("base64");
}

function checksumFromMetadata(metadata: Record<string, string> | undefined) {
  const value = metadata?.sha256;
  if (!value) return undefined;
  const checksum = `sha256:${value}`;
  return isStorageChecksum(checksum) ? checksum : undefined;
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.$metadata?.httpStatusCode === 404 ||
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey"
  );
}

function providerFailure(action: string, error: unknown): StorageProviderError {
  if (error instanceof StorageProviderError) return error;
  return new StorageProviderError(
    "provider-unavailable",
    `Der externe Dateispeicher ist beim ${action} derzeit nicht erreichbar.`,
    { cause: error, retryable: true }
  );
}

function assertObjectKey(key: string): void {
  if (!isStorageObjectKey(key)) {
    throw new StorageProviderError(
      "invalid-object",
      "Der technische Dateischluessel ist ungueltig."
    );
  }
}

function objectInfo(
  key: string,
  output: Pick<
    GetObjectCommandOutput | HeadObjectCommandOutput,
    "ContentType" | "ContentLength" | "ChecksumSHA256" | "ETag" | "LastModified" | "Metadata"
  >
): StoredObjectInfo {
  return {
    key,
    contentType: output.ContentType || "application/octet-stream",
    sizeBytes: output.ContentLength ?? 0,
    checksum: checksumFromMetadata(output.Metadata),
    etag: output.ETag?.replace(/^\"|\"$/g, ""),
    lastModified: output.LastModified,
  };
}

export class S3StorageProvider implements StorageProvider {
  private readonly bucket: string;
  private readonly client: S3CommandSender;

  constructor(config: S3StorageConfig, client?: S3CommandSender) {
    this.bucket = config.bucket;
    this.client =
      client ??
      (new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: config.forcePathStyle,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        maxAttempts: 3,
      }) as unknown as S3CommandSender);
  }

  async put(input: PutStorageObjectInput): Promise<StoredObjectInfo> {
    try {
      assertObjectKey(input.key);
      const actualChecksum = calculateStorageChecksum(input.body);
      if (!storageChecksumsMatch(input.checksum, actualChecksum)) {
        throw new StorageProviderError(
          "checksum-mismatch",
          "Die Datei-Pruefsumme stimmt vor dem Upload nicht mit dem Inhalt ueberein."
        );
      }
      const output = (await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          ContentLength: input.body.byteLength,
          ChecksumSHA256: checksumBase64(input.checksum),
          Metadata: {
            sha256: checksumHex(input.checksum),
            organization: input.metadata.organizationId,
            owner: input.metadata.ownerType,
            ownerid: input.metadata.ownerId,
            category: input.metadata.category,
          },
        })
      )) as PutObjectCommandOutput;

      return {
        key: input.key,
        contentType: input.contentType,
        sizeBytes: input.body.byteLength,
        checksum: input.checksum,
        etag: output.ETag?.replace(/^\"|\"$/g, ""),
      };
    } catch (error) {
      throw providerFailure("Speichern", error);
    }
  }

  async get(key: string): Promise<GetStorageObjectResult | null> {
    try {
      assertObjectKey(key);
      const output = (await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ChecksumMode: ChecksumMode.ENABLED,
        })
      )) as GetObjectCommandOutput;

      if (!output.Body) {
        throw new StorageProviderError(
          "invalid-object",
          "Der externe Dateispeicher hat einen leeren Dateiinhalt geliefert."
        );
      }

      return {
        ...objectInfo(key, output),
        body: output.Body as AsyncIterable<Uint8Array>,
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw providerFailure("Laden", error);
    }
  }

  async stat(key: string): Promise<StoredObjectInfo | null> {
    try {
      assertObjectKey(key);
      const output = (await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key, ChecksumMode: ChecksumMode.ENABLED })
      )) as HeadObjectCommandOutput;
      return objectInfo(key, output);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw providerFailure("Pruefen", error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      assertObjectKey(key);
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      throw providerFailure("Loeschen", error);
    }
  }
}
