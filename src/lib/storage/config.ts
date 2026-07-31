import { StorageProviderError } from "./provider";

export type DisabledStorageConfig = {
  provider: "disabled";
};

export type S3StorageConfig = {
  provider: "s3";
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export type StorageConfig = DisabledStorageConfig | S3StorageConfig;

type StorageEnvironment = Readonly<Record<string, string | undefined>>;

const BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

function required(env: StorageEnvironment, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new StorageProviderError(
      "configuration",
      `Die Storage-Konfiguration ist unvollstaendig: ${name} fehlt.`
    );
  }
  return value;
}

function parseHttpsEndpoint(value: string): string {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new StorageProviderError("configuration", "Der Storage-Endpunkt ist ungueltig.");
  }

  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
    throw new StorageProviderError(
      "configuration",
      "Der Storage-Endpunkt muss eine HTTPS-Adresse ohne Zugangsdaten sein."
    );
  }

  return endpoint.toString().replace(/\/$/, "");
}

export function loadStorageConfig(env: StorageEnvironment = process.env): StorageConfig {
  const provider = env.WORKPILOT_STORAGE_PROVIDER?.trim().toLowerCase() || "disabled";
  if (provider === "disabled") {
    return { provider: "disabled" };
  }
  if (provider !== "s3") {
    throw new StorageProviderError(
      "configuration",
      `Unbekannter Storage-Provider: ${provider}.`
    );
  }

  const bucket = required(env, "WORKPILOT_S3_BUCKET");
  if (!BUCKET_PATTERN.test(bucket) || bucket.includes("..") || /^\d+\.\d+\.\d+\.\d+$/.test(bucket)) {
    throw new StorageProviderError("configuration", "Der S3-Bucket-Name ist ungueltig.");
  }

  const forcePathStyleValue = env.WORKPILOT_S3_FORCE_PATH_STYLE?.trim().toLowerCase();
  if (forcePathStyleValue && !["true", "false"].includes(forcePathStyleValue)) {
    throw new StorageProviderError(
      "configuration",
      "WORKPILOT_S3_FORCE_PATH_STYLE muss true oder false sein."
    );
  }

  return {
    provider: "s3",
    endpoint: parseHttpsEndpoint(required(env, "WORKPILOT_S3_ENDPOINT")),
    region: required(env, "WORKPILOT_S3_REGION"),
    bucket,
    accessKeyId: required(env, "WORKPILOT_S3_ACCESS_KEY_ID"),
    secretAccessKey: required(env, "WORKPILOT_S3_SECRET_ACCESS_KEY"),
    forcePathStyle: forcePathStyleValue !== "false",
  };
}
