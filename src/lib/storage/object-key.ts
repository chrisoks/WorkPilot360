import { randomUUID } from "node:crypto";

import type { StorageOwnerType } from "./types";

const SAFE_IDENTIFIER = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const SAFE_CATEGORY = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SAFE_EXTENSION = /^[a-z0-9]{1,10}$/;
const SAFE_KEY_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

type BuildStorageObjectKeyInput = {
  organizationId: string;
  ownerType: StorageOwnerType;
  ownerId: string;
  category: string;
  extension?: string;
  objectId?: string;
  now?: Date;
};

function requireIdentifier(value: string, label: string): string {
  const normalized = value.trim();
  if (!SAFE_IDENTIFIER.test(normalized)) {
    throw new TypeError(`${label} ist kein sicherer technischer Bezeichner.`);
  }
  return normalized;
}

function requireCategory(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "-");
  if (!SAFE_CATEGORY.test(normalized)) {
    throw new TypeError("Die Dateikategorie ist ungueltig.");
  }
  return normalized;
}

function normalizeExtension(value: string | undefined): string {
  if (!value) return "";
  const normalized = value.trim().toLowerCase().replace(/^\./, "");
  if (!SAFE_EXTENSION.test(normalized)) {
    throw new TypeError("Die Dateiendung ist ungueltig.");
  }
  return `.${normalized}`;
}

export function buildStorageObjectKey(input: BuildStorageObjectKeyInput): string {
  const organizationId = requireIdentifier(input.organizationId, "organizationId");
  const ownerId = requireIdentifier(input.ownerId, "ownerId");
  const category = requireCategory(input.category);
  const objectId = requireIdentifier(input.objectId ?? randomUUID(), "objectId");
  const extension = normalizeExtension(input.extension);
  const now = input.now ?? new Date();

  if (Number.isNaN(now.getTime())) {
    throw new TypeError("Der Speicherzeitpunkt ist ungueltig.");
  }

  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return [
    "organizations",
    organizationId,
    input.ownerType,
    ownerId,
    category,
    year,
    month,
    `${objectId}${extension}`,
  ].join("/");
}

export function isStorageObjectKey(value: string): boolean {
  if (!value || value.length > 1024 || value.startsWith("/") || value.endsWith("/")) {
    return false;
  }
  return value.split("/").every((segment) => {
    return segment !== "." && segment !== ".." && SAFE_KEY_SEGMENT.test(segment);
  });
}
