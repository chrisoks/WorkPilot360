import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";
import { getDemoContext } from "@/lib/demo/context";
import { canViewCustomerRevenueAnalytics } from "@/lib/permissions";
import {
  buildWinterServiceFrequencyAnalytics,
  type WinterServiceDeploymentSignal,
} from "@/lib/winter-service/analytics";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, url.searchParams.get("actorId"));
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  if (!canViewCustomerRevenueAnalytics(actorResult.actor)) {
    return NextResponse.json(
      { error: "Du darfst Winterdienst-Kennzahlen nicht einsehen." },
      { status: 403 }
    );
  }

  const projects = await prisma.workPilotProject.findMany({
    where: {
      organizationId: organization.id,
      trade: {
        contains: "winterdienst",
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      customer: true,
      contactId: true,
      winterGritPackageItemId: true,
      winterGritPushPackageItemId: true,
    },
  });

  if (projects.length === 0) {
    return NextResponse.json(buildWinterServiceFrequencyAnalytics([]));
  }

  const projectIds = projects.map((project) => project.id);
  const [timeEntries, documentedRuns] = await Promise.all([
    prisma.projectTimeEntry.findMany({
      where: {
        organizationId: organization.id,
        projectId: { in: projectIds },
        mode: "project",
        deletedAt: null,
      },
      select: {
        projectId: true,
        date: true,
        billingCatalogItemId: true,
        billingCatalogItemLabel: true,
      },
    }),
    prisma.winterServiceRun.findMany({
      where: {
        organizationId: organization.id,
        projectId: { in: projectIds },
      },
      select: {
        projectId: true,
        serviceDate: true,
        serviceType: true,
      },
    }),
  ]);

  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const signals: WinterServiceDeploymentSignal[] = [];

  for (const entry of timeEntries) {
    const project = projectMap.get(entry.projectId);
    const customerId = cleanString(project?.contactId);
    if (!project || !customerId) continue;
    const typeHints = [
      cleanString(entry.billingCatalogItemLabel),
      entry.billingCatalogItemId === project.winterGritPushPackageItemId
        ? "OKI0401 Streuen und Schieben"
        : "",
      entry.billingCatalogItemId === project.winterGritPackageItemId
        ? "OKI0402 Streuservice"
        : "",
    ].filter(Boolean);
    signals.push({
      projectId: project.id,
      customerId,
      customerName: cleanString(project.customer),
      date: cleanString(entry.date),
      typeHints,
    });
  }

  for (const run of documentedRuns) {
    const project = projectMap.get(run.projectId);
    const customerId = cleanString(project?.contactId);
    if (!project || !customerId) continue;
    signals.push({
      projectId: project.id,
      customerId,
      customerName: cleanString(project.customer),
      date: cleanString(run.serviceDate),
      typeHints: [cleanString(run.serviceType)].filter(Boolean),
    });
  }

  return NextResponse.json(buildWinterServiceFrequencyAnalytics(signals));
}
