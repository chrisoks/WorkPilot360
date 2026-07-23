import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";
import { getDemoContext } from "@/lib/demo/context";
import {
  canManageProjects,
  canViewCustomerRevenueAnalytics,
} from "@/lib/permissions";
import {
  calculateWinterService,
  WinterServiceCalculationValidationError,
  type WinterServiceCalculationInput,
} from "@/lib/winter-service/calculation";

const calculationInputSchema = z.object({
  areaSqm: z.number(),
  readinessPricePerSqmPerMonth: z.number(),
  seasonMonths: z.number(),
  expectedDeployments: z.number(),
  baseServiceMinutes: z.number(),
  laborSalesRatePerHour: z.number(),
  saltGramsPerSqm: z.number(),
  saltSalesPricePerKg: z.number(),
  plowTimeIncreasePercent: z.number(),
  plowSaltIncreasePercent: z.number(),
  mixedSpreadingPercent: z.number(),
  mixedPlowingPercent: z.number(),
});

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getUserName(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

function getCustomerName(contact: {
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  customerNumber: string;
}) {
  return (
    contact.companyName?.trim() ||
    [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() ||
    contact.customerNumber
  );
}

function serializeCalculation(calculation: {
  id: string;
  seriesId: string;
  version: number;
  customerId: string;
  projectId: string;
  customerName: string;
  projectNumber: string;
  projectTitle: string;
  createdById: string | null;
  createdByName: string;
  inputSnapshot: unknown;
  resultSnapshot: unknown;
  generatedPackageIds: unknown;
  note: string;
  createdAt: Date;
}) {
  return {
    ...calculation,
    createdById: calculation.createdById ?? "",
    generatedPackageIds: Array.isArray(calculation.generatedPackageIds)
      ? calculation.generatedPackageIds
      : [],
    createdAt: calculation.createdAt.toISOString(),
  };
}

function calculationErrorResponse(error: unknown) {
  if (error instanceof WinterServiceCalculationValidationError) {
    return NextResponse.json(
      {
        error: error.message,
        fields: error.fields,
      },
      { status: 400 }
    );
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: "Die Eingaben der Winterdienst-Kalkulation sind unvollständig.",
        fields: error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  throw error;
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
      { error: "Du darfst Winterdienst-Kalkulationen nicht einsehen." },
      { status: 403 }
    );
  }

  const customerId = cleanString(url.searchParams.get("customerId"));
  const projectId = cleanString(url.searchParams.get("projectId"));
  const seriesId = cleanString(url.searchParams.get("seriesId"));

  if (!customerId && !projectId && !seriesId) {
    return NextResponse.json(
      { error: "Kunde, Projekt oder Kalkulationsserie fehlt." },
      { status: 400 }
    );
  }

  const calculations = await prisma.winterServiceCalculation.findMany({
    where: {
      organizationId: organization.id,
      ...(customerId ? { customerId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(seriesId ? { seriesId } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { version: "desc" }],
  });

  return NextResponse.json(calculations.map(serializeCalculation));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) {
    return sessionBoundActorResponse(actorResult);
  }
  const actor = actorResult.actor;

  if (!canManageProjects(actor)) {
    return NextResponse.json(
      { error: "Du darfst Winterdienst-Kalkulationen nicht bearbeiten." },
      { status: 403 }
    );
  }

  let input: WinterServiceCalculationInput;
  let result;
  try {
    input = calculationInputSchema.parse(body.input) as WinterServiceCalculationInput;
    result = calculateWinterService(input);
  } catch (error) {
    return calculationErrorResponse(error);
  }

  const action = cleanString(body.action) || "calculate";
  if (action === "calculate") {
    return NextResponse.json({ input, result });
  }
  if (action !== "save") {
    return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
  }

  const customerId = cleanString(body.customerId);
  const projectId = cleanString(body.projectId);
  if (!customerId || !projectId) {
    return NextResponse.json(
      {
        error: "Zum Speichern müssen ein Kunde und ein Projekt ausgewählt sein.",
        fields: {
          ...(!customerId ? { customerId: "Kunde ist erforderlich." } : {}),
          ...(!projectId ? { projectId: "Projekt ist erforderlich." } : {}),
        },
      },
      { status: 400 }
    );
  }

  const [customer, project] = await Promise.all([
    prisma.contact.findFirst({
      where: {
        id: customerId,
        organizationId: organization.id,
      },
      select: {
        id: true,
        companyName: true,
        firstName: true,
        lastName: true,
        customerNumber: true,
      },
    }),
    prisma.workPilotProject.findFirst({
      where: {
        id: projectId,
        organizationId: organization.id,
      },
      select: {
        id: true,
        projectNumber: true,
        title: true,
        contactId: true,
      },
    }),
  ]);

  if (!customer) {
    return NextResponse.json({ error: "Der ausgewählte Kunde wurde nicht gefunden." }, { status: 404 });
  }
  if (!project) {
    return NextResponse.json({ error: "Das ausgewählte Projekt wurde nicht gefunden." }, { status: 404 });
  }
  if (project.contactId !== customer.id) {
    return NextResponse.json(
      { error: "Das ausgewählte Projekt ist diesem Kunden nicht zugeordnet." },
      { status: 400 }
    );
  }

  const requestedSeriesId = cleanString(body.seriesId);
  const latestVersion = requestedSeriesId
    ? await prisma.winterServiceCalculation.findFirst({
        where: {
          organizationId: organization.id,
          seriesId: requestedSeriesId,
        },
        orderBy: {
          version: "desc",
        },
        select: {
          version: true,
          customerId: true,
          projectId: true,
        },
      })
    : null;

  if (requestedSeriesId && !latestVersion) {
    return NextResponse.json(
      { error: "Die zu versionierende Winterdienst-Kalkulation wurde nicht gefunden." },
      { status: 404 }
    );
  }
  if (
    latestVersion &&
    (latestVersion.customerId !== customer.id || latestVersion.projectId !== project.id)
  ) {
    return NextResponse.json(
      { error: "Eine Kalkulationsserie kann nicht nachträglich einem anderen Kunden oder Projekt zugeordnet werden." },
      { status: 400 }
    );
  }

  const calculation = await prisma.winterServiceCalculation.create({
    data: {
      organizationId: organization.id,
      seriesId: requestedSeriesId || randomUUID(),
      version: (latestVersion?.version ?? 0) + 1,
      customerId: customer.id,
      projectId: project.id,
      customerName: getCustomerName(customer),
      projectNumber: project.projectNumber,
      projectTitle: project.title,
      createdById: actor.id,
      createdByName: getUserName(actor),
      inputSnapshot: {
        schemaVersion: 2,
        ...input,
      },
      resultSnapshot: {
        schemaVersion: 2,
        ...result,
      },
      generatedPackageIds: [],
      note: cleanString(body.note).slice(0, 2_000),
    },
  });

  return NextResponse.json(serializeCalculation(calculation), { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canManageProjects(actorResult.actor)) {
    return NextResponse.json({ error: "Du darfst Winterdienst-Kalkulationen nicht bearbeiten." }, { status: 403 });
  }
  const calculationId = cleanString(body.calculationId);
  const packageId = cleanString(body.packageId);
  if (!calculationId || !packageId) {
    return NextResponse.json({ error: "Kalkulation oder Paket fehlt." }, { status: 400 });
  }
  const current = await prisma.winterServiceCalculation.findFirst({
    where: { id: calculationId, organizationId: organization.id },
  });
  if (!current) return NextResponse.json({ error: "Kalkulation wurde nicht gefunden." }, { status: 404 });
  const ids = Array.isArray(current.generatedPackageIds)
    ? current.generatedPackageIds.filter((value): value is string => typeof value === "string")
    : [];
  if (!ids.includes(packageId)) ids.push(packageId);
  const updated = await prisma.winterServiceCalculation.update({
    where: { id: current.id },
    data: { generatedPackageIds: ids },
  });
  return NextResponse.json(serializeCalculation(updated));
}
