import type {
  StorageChecksum,
  StorageObjectMetadata,
  StoredObjectInfo,
} from "./types";

export type PutStorageObjectInput = {
  key: string;
  body: Uint8Array;
  contentType: string;
  checksum: StorageChecksum;
  metadata: StorageObjectMetadata;
};

export type GetStorageObjectResult = StoredObjectInfo & {
  body: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array> | Uint8Array;
};

export interface StorageProvider {
  put(input: PutStorageObjectInput): Promise<StoredObjectInfo>;
  get(key: string): Promise<GetStorageObjectResult | null>;
  stat(key: string): Promise<StoredObjectInfo | null>;
  delete(key: string): Promise<void>;
}

export class StorageProviderError extends Error {
  readonly code:
    | "configuration"
    | "invalid-object"
    | "not-found"
    | "provider-unavailable"
    | "checksum-mismatch";
  readonly retryable: boolean;

  constructor(
    code: StorageProviderError["code"],
    message: string,
    options: { cause?: unknown; retryable?: boolean } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "StorageProviderError";
    this.code = code;
    this.retryable = options.retryable ?? false;
  }
}
