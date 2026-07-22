import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { canViewCustomerRevenueAnalytics } from "@/lib/permissions";
import {
  normalizeProjectMapAddress,
  parseOpenCageProjectGeocodeResponse,
} from "@/lib/project-map/geocoding";

export const dynamic = "force-dynamic";

const MAX_PROJECTS_PER_RUN = 50;
const MAX_NEW_ADDRESSES_PER_RUN = 10;
const MIN_CONFIDENCE = 7;

function cleanProjectIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)))
    .slice(0, MAX_PROJECTS_PER_RUN);
}

function getRequestIntervalMs() {
  const configured = Number(process.env.OPENCAGE_REQUEST_INTERVAL_MS);
  return Number.isFinite(configured) && configured >= 0 ? Math.round(configured) : 1100;
}

async function wait(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const { searchParams } = new URL(req.url);
  const actorResult = await getSessionBoundActor(req, users, searchParams.get("actorId"));
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canViewCustomerRevenueAnalytics(actorResult.actor)) {
    return NextResponse.json({ error: "Keine Berechtigung für die Projektkarte." }, { status: 403 });
  }

  const counts = await prisma.workPilotProject.groupBy({
    by: ["mapGeocodeStatus"],
    where: { organizationId: organization.id },
    _count: { _all: true },
  });
  return NextResponse.json({
    configured: Boolean(process.env.OPENCAGE_API_KEY?.trim()),
    provider: process.env.OPENCAGE_API_KEY?.trim() ? "OpenCage" : "Nicht konfiguriert",
    counts: Object.fromEntries(counts.map((row) => [row.mapGeocodeStatus || "pending", row._count._all])),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canViewCustomerRevenueAnalytics(actorResult.actor)) {
    return NextResponse.json({ error: "Keine Berechtigung für die Projektkarte." }, { status: 403 });
  }

  const projectIds = cleanProjectIds(body.projectIds);
  if (projectIds.length === 0) {
    return NextResponse.json({ error: "Es wurden keine Projekte zur Adressprüfung übergeben." }, { status: 400 });
  }

  const projects = await prisma.workPilotProject.findMany({
    where: { organizationId: organization.id, id: { in: projectIds } },
    select: {
      id: true,
      address: true,
      mapLatitude: true,
      mapLongitude: true,
      mapGeocodeStatus: true,
    },
  });
  const targets = projects.filter((project) => project.address?.trim());
  if (targets.length === 0) {
    return NextResponse.json({ configured: Boolean(process.env.OPENCAGE_API_KEY?.trim()), updated: 0, projects: [] });
  }

  const existingLocations = await prisma.workPilotProject.findMany({
    where: {
      organizationId: organization.id,
      mapGeocodeStatus: "located",
      mapLatitude: { not: null },
      mapLongitude: { not: null },
      address: { not: null },
    },
    select: { address: true, mapLatitude: true, mapLongitude: true, mapGeocodeConfidence: true, mapGeocodedAddress: true },
  });
  const knownByAddress = new Map(
    existingLocations.map((project) => [normalizeProjectMapAddress(project.address), project] as const)
  );

  let updated = 0;
  for (const project of targets) {
    if (project.mapGeocodeStatus === "located" && project.mapLatitude != null && project.mapLongitude != null) continue;
    const known = knownByAddress.get(normalizeProjectMapAddress(project.address));
    if (!known || known.mapLatitude == null || known.mapLongitude == null) continue;
    await prisma.workPilotProject.update({
      where: { id: project.id },
      data: {
        mapLatitude: known.mapLatitude,
        mapLongitude: known.mapLongitude,
        mapGeocodeStatus: "located",
        mapGeocodeProvider: "cache",
        mapGeocodeConfidence: known.mapGeocodeConfidence,
        mapGeocodedAddress: known.mapGeocodedAddress,
        mapGeocodedAt: new Date(),
      },
    });
    updated += 1;
  }

  const apiKey = process.env.OPENCAGE_API_KEY?.trim() ?? "";
  if (!apiKey) {
    const currentProjects = await prisma.workPilotProject.findMany({
      where: { organizationId: organization.id, id: { in: projectIds } },
      select: { id: true, mapLatitude: true, mapLongitude: true, mapGeocodeStatus: true },
    });
    return NextResponse.json({
      configured: false,
      provider: "Nicht konfiguriert",
      updated,
      projects: currentProjects,
      message: "Geocoding ist noch nicht konfiguriert. Bestehende gespeicherte Koordinaten wurden weiterverwendet.",
    });
  }

  const refreshedTargets = await prisma.workPilotProject.findMany({
    where: { organizationId: organization.id, id: { in: projectIds }, address: { not: null } },
    select: { id: true, address: true, mapGeocodeStatus: true, mapLatitude: true, mapLongitude: true },
  });
  const pendingByAddress = new Map<string, typeof refreshedTargets>();
  refreshedTargets.forEach((project) => {
    if (!project.address?.trim()) return;
    if (project.mapGeocodeStatus === "located" && project.mapLatitude != null && project.mapLongitude != null) return;
    const key = normalizeProjectMapAddress(project.address);
    pendingByAddress.set(key, [...(pendingByAddress.get(key) ?? []), project]);
  });

  const distinctPending = Array.from(pendingByAddress.entries()).slice(0, MAX_NEW_ADDRESSES_PER_RUN);
  for (let index = 0; index < distinctPending.length; index += 1) {
    const [, addressProjects] = distinctPending[index];
    const address = addressProjects[0]?.address?.trim();
    if (!address) continue;
    if (index > 0) await wait(getRequestIntervalMs());

    try {
      const url = new URL("https://api.opencagedata.com/geocode/v1/json");
      url.searchParams.set("q", address);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("countrycode", "de");
      url.searchParams.set("language", "de");
      url.searchParams.set("limit", "3");
      url.searchParams.set("no_annotations", "1");
      const response = await fetch(url, { signal: AbortSignal.timeout(10000), cache: "no-store" });
      if (!response.ok) throw new Error(`OpenCage HTTP ${response.status}`);
      const result = parseOpenCageProjectGeocodeResponse(await response.json());
      const isReliable = Boolean(result && result.confidence >= MIN_CONFIDENCE);
      await prisma.workPilotProject.updateMany({
        where: { organizationId: organization.id, id: { in: addressProjects.map((project) => project.id) } },
        data: {
          mapLatitude: isReliable ? result?.latitude : null,
          mapLongitude: isReliable ? result?.longitude : null,
          mapGeocodedAddress: result?.formattedAddress || address,
          mapGeocodeProvider: "opencage",
          mapGeocodeStatus: isReliable ? "located" : result ? "review" : "failed",
          mapGeocodeConfidence: result?.confidence ?? null,
          mapGeocodedAt: new Date(),
        },
      });
      updated += addressProjects.length;
    } catch (error) {
      console.error("Projektkarten-Geocoding fehlgeschlagen", error);
      await prisma.workPilotProject.updateMany({
        where: { organizationId: organization.id, id: { in: addressProjects.map((project) => project.id) } },
        data: { mapGeocodeStatus: "failed", mapGeocodeProvider: "opencage", mapGeocodedAt: new Date() },
      });
    }
  }

  const currentProjects = await prisma.workPilotProject.findMany({
    where: { organizationId: organization.id, id: { in: projectIds } },
    select: {
      id: true,
      mapLatitude: true,
      mapLongitude: true,
      mapGeocodeStatus: true,
      mapGeocodeConfidence: true,
      mapGeocodedAddress: true,
    },
  });
  return NextResponse.json({ configured: true, provider: "OpenCage", updated, projects: currentProjects });
}
