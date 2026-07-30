import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const production = process.argv.includes("--production");
const organizationSlug =
  process.env.ONLINE_REQUEST_ORGANIZATION_SLUG?.trim() || "demo";
const portalSlug =
  process.env.ONLINE_REQUEST_PORTAL_SLUG?.trim() || "ok-immocare";
const displayName =
  process.env.ONLINE_REQUEST_PORTAL_NAME?.trim() || "OK immocare";

const serviceCandidates = [
  ["Objektbetreuung"],
  ["Hausmeisterservice"],
  [
    "Grünflächen- und Gartenpflege",
    "Gruenflaechen- und Gartenpflege",
  ],
  ["Winterdienst"],
  ["Photovoltaikanlagenreinigung", "PV-Reinigung"],
  ["Glasreinigung"],
  ["Unterhaltsreinigung"],
  ["Fassadenreinigung"],
  ["Dachreinigung"],
  ["Reinigung"],
  ["Trockeneisstrahlen"],
  ["Umzug Service", "Umzugsservice"],
  ["Reparaturarbeiten", "Reparatur"],
  ["Malerarbeiten"],
  ["Wartung"],
];

function splitList(value) {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeHostname(value) {
  const candidate = value.trim().toLowerCase();
  try {
    const url = candidate.includes("://")
      ? new URL(candidate)
      : new URL(`https://${candidate}`);
    if (url.username || url.password || !url.hostname) return "";
    return url.hostname.toLowerCase();
  } catch {
    return "";
  }
}

async function main() {
  const organization = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
    select: { id: true, name: true, slug: true },
  });
  if (!organization) {
    throw new Error(
      `Organisation mit Slug "${organizationSlug}" wurde nicht gefunden.`
    );
  }

  const categories = await prisma.category.findMany({
    where: { organizationId: organization.id },
    select: { id: true, name: true },
  });
  const byName = new Map(
    categories.map((category) => [category.name.toLocaleLowerCase("de-DE"), category])
  );
  const selectedCategories = [];
  const missingGroups = [];
  for (const candidates of serviceCandidates) {
    const category = candidates
      .map((name) => byName.get(name.toLocaleLowerCase("de-DE")))
      .find(Boolean);
    if (category) selectedCategories.push(category);
    else missingGroups.push(candidates[0]);
  }

  const requiredNames = [
    "Objektbetreuung",
    "Hausmeisterservice",
    "Grünflächen- und Gartenpflege",
    "Winterdienst",
    "Photovoltaikanlagenreinigung",
  ];
  const missingRequired = requiredNames.filter(
    (name) =>
      !serviceCandidates
        .find((group) => group[0] === name)
        ?.some((candidate) =>
          byName.has(candidate.toLocaleLowerCase("de-DE"))
        )
  );
  if (missingRequired.length) {
    throw new Error(
      `Verbindliche Portal-Gewerke fehlen: ${missingRequired.join(", ")}`
    );
  }

  const configuredHosts = splitList(
    process.env.ONLINE_REQUEST_TRUSTED_HOSTNAMES
  );
  const hostCandidates = configuredHosts.length
    ? configuredHosts
    : [
        "workpilot360.oks-cloudservices.com",
        ...(production ? [] : ["localhost", "127.0.0.1"]),
      ];
  const trustedHostnames = [
    ...new Set(hostCandidates.map(normalizeHostname).filter(Boolean)),
  ];
  if (!trustedHostnames.length) {
    throw new Error("Mindestens ein vertrauenswürdiger Hostname ist erforderlich.");
  }

  const requestedNotificationIds = splitList(
    process.env.ONLINE_REQUEST_NOTIFICATION_USER_IDS
  );
  const notificationUsers = requestedNotificationIds.length
    ? await prisma.user.findMany({
        where: {
          id: { in: requestedNotificationIds },
          organizationId: organization.id,
          isActive: true,
        },
        select: { id: true },
      })
    : [];
  if (notificationUsers.length !== requestedNotificationIds.length) {
    throw new Error(
      "Mindestens eine konfigurierte Benachrichtigungsperson ist ungültig oder gehört zu einer anderen Organisation."
    );
  }

  const current = await prisma.onlineRequestPortal.findUnique({
    where: { slug: portalSlug },
    select: {
      id: true,
      organizationId: true,
      turnstileSiteKey: true,
    },
  });
  if (current && current.organizationId !== organization.id) {
    throw new Error(
      `Portal-Slug "${portalSlug}" gehört bereits zu einer anderen Organisation.`
    );
  }
  const configuredTurnstileSiteKey =
    process.env.ONLINE_REQUEST_TURNSTILE_SITE_KEY;
  const turnstileSiteKey =
    configuredTurnstileSiteKey === undefined
      ? current?.turnstileSiteKey ?? null
      : configuredTurnstileSiteKey.trim() || null;

  const summary = {
    mode: apply ? "apply" : "dry-run",
    organization: `${organization.name} (${organization.slug})`,
    portalSlug,
    displayName,
    trades: selectedCategories.map((category) => category.name),
    optionalTradesNotFound: missingGroups,
    trustedHostnames,
    notificationMode: notificationUsers.length
      ? `${notificationUsers.length} explizite Person(en)`
      : "berechtigte Vertriebs- und Leitungsrollen",
    turnstile: turnstileSiteKey ? "configured" : "proof-of-work only",
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) {
    console.log(
      "Dry-run abgeschlossen. Mit --apply wird ausschließlich die Portal-Konfiguration gespeichert."
    );
    return;
  }

  await prisma.onlineRequestPortal.upsert({
    where: { slug: portalSlug },
    create: {
      organizationId: organization.id,
      slug: portalSlug,
      displayName,
      allowedTradeIds: selectedCategories.map((category) => category.id),
      notificationUserIds: notificationUsers.map((user) => user.id),
      trustedHostnames,
      turnstileSiteKey,
      isActive: true,
    },
    update: {
      displayName,
      allowedTradeIds: selectedCategories.map((category) => category.id),
      notificationUserIds: notificationUsers.map((user) => user.id),
      trustedHostnames,
      turnstileSiteKey,
      isActive: true,
    },
  });
  console.log("Portal-Konfiguration wurde erfolgreich gespeichert.");
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Portal-Konfiguration fehlgeschlagen."
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
