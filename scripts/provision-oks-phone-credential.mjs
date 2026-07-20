import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rotate = process.argv.includes("--rotate");

const ALLOWED_SCOPES = new Set([
  "customer-context:read",
  "customer-logbook:write",
  "project-logbook:write",
  "contacts-delta:read",
]);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} muss gesetzt sein.`);
  return value;
}

async function main() {
  const organizationSlug = required("OKS_PHONE_PROVISION_ORGANIZATION_SLUG");
  const keyId = required("OKS_PHONE_PROVISION_KEY_ID");
  const secret = required("OKS_PHONE_PROVISION_SECRET");
  const name = process.env.OKS_PHONE_PROVISION_NAME?.trim() || "OKS Phone";
  const scopes = required("OKS_PHONE_PROVISION_SCOPES")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  const rateLimitPerMinute = Number(process.env.OKS_PHONE_PROVISION_RATE_LIMIT || "120");

  if (secret.length < 32) throw new Error("OKS_PHONE_PROVISION_SECRET muss mindestens 32 Zeichen lang sein.");
  if (scopes.length === 0 || scopes.some((scope) => !ALLOWED_SCOPES.has(scope))) {
    throw new Error("OKS_PHONE_PROVISION_SCOPES enthaelt einen unbekannten oder keinen Scope.");
  }
  if (!Number.isInteger(rateLimitPerMinute) || rateLimitPerMinute < 10 || rateLimitPerMinute > 1000) {
    throw new Error("OKS_PHONE_PROVISION_RATE_LIMIT muss zwischen 10 und 1000 liegen.");
  }

  const organization = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
    select: { id: true },
  });
  if (!organization) throw new Error("Organisation wurde nicht gefunden.");

  const existing = await prisma.oksPhoneIntegrationCredential.findUnique({ where: { keyId } });
  if (existing && !rotate) {
    throw new Error("Credential existiert bereits. Fuer eine bewusste Rotation --rotate verwenden.");
  }

  const secretHash = createHash("sha256").update(secret, "utf8").digest("hex");
  await prisma.oksPhoneIntegrationCredential.upsert({
    where: { keyId },
    create: {
      organizationId: organization.id,
      keyId,
      name,
      secretHash,
      scopes,
      rateLimitPerMinute,
    },
    update: {
      organizationId: organization.id,
      name,
      secretHash,
      scopes,
      rateLimitPerMinute,
      isActive: true,
    },
  });

  console.log(JSON.stringify({
    provisioned: true,
    rotated: Boolean(existing),
    keyId,
    organizationSlug,
    scopes,
    rateLimitPerMinute,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Credential provisioning failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
