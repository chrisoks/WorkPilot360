import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  getSessionBoundActor,
  sessionBoundActorResponse,
} from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import {
  executeHeroActiveImport,
  prepareHeroActiveImport,
  rollbackHeroActiveImport,
} from "@/lib/imports/hero-active-import";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function forbiddenResponse() {
  return NextResponse.json(
    {
      error:
        "Nur Geschäftsführung oder Administration dürfen den aktiven HERO-Import ausführen.",
    },
    { status: 403 }
  );
}

function errorResponse(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Der aktive HERO-Import konnte nicht sicher ausgeführt werden.",
    },
    { status: 409 }
  );
}

async function getAuthorizedContext(request: Request) {
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(request, users, null);
  if (!actorResult.ok) {
    return { response: sessionBoundActorResponse(actorResult) };
  }
  if (
    actorResult.actor.role !== Role.ADMIN &&
    actorResult.actor.role !== Role.GESCHAEFTSFUEHRER
  ) {
    return { response: forbiddenResponse() };
  }
  return { organization, actor: actorResult.actor };
}

export async function GET(request: Request) {
  const context = await getAuthorizedContext(request);
  if ("response" in context) return context.response;

  try {
    const plan = await prepareHeroActiveImport(context.organization.id);
    return NextResponse.json({
      dryRun: true,
      writesPerformed: false,
      ready: plan.ready,
      sourceSnapshotHash: plan.sourceSnapshotHash,
      capturedAt: plan.capturedAt,
      activeSourceProjects: plan.activeSourceCount,
      alreadyPresentByProjectNumber: plan.existing.length,
      projectsToCreate: plan.projects.length,
      contactsToCreate: plan.contacts.filter(
        (contact) => contact.resolution.action === "create"
      ).length,
      contactsToLink: plan.contacts.filter(
        (contact) => contact.resolution.action === "link"
      ).length,
      blockers: plan.blockers,
      projects: plan.projects.map((project) => ({
        externalId: project.externalId,
        projectNumber: project.projectNumber,
        title: project.title,
        customer: project.customerResolution?.displayName ?? "",
        targetStatus: "Lead / Klärung",
        targetProjectType: project.targetProjectType,
        targetBranch: project.targetBranch,
        manualClassificationRequired: true,
        documentsImported: false,
        warnings: project.warnings,
      })),
      contacts: plan.contacts.map((contact) => ({
        externalId: contact.resolution.externalId,
        displayName: contact.resolution.displayName,
        customerNumber: contact.resolution.customerNumber,
        action: contact.resolution.action,
        usedAsCustomerBy: contact.usedAsCustomerBy,
        usedAsContactPersonBy: contact.usedAsContactPersonBy,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const context = await getAuthorizedContext(request);
  if ("response" in context) return context.response;

  try {
    const run = await executeHeroActiveImport({
      organizationId: context.organization.id,
      actor: context.actor,
    });
    return NextResponse.json(
      {
        runId: run.id,
        status: run.status,
        summary: run.summary,
        records: run.records.length,
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const context = await getAuthorizedContext(request);
  if ("response" in context) return context.response;
  const body = (await request.json().catch(() => ({}))) as {
    runId?: unknown;
  };
  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  if (!runId) {
    return NextResponse.json({ error: "Importlauf-ID fehlt." }, { status: 400 });
  }

  try {
    const run = await rollbackHeroActiveImport({
      organizationId: context.organization.id,
      runId,
    });
    return NextResponse.json({
      runId: run.id,
      status: run.status,
      rollbackStatus: run.rollbackStatus,
      rolledBackRecords: run.records.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
