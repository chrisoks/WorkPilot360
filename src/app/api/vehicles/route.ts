import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";
import { getDemoContext } from "@/lib/demo/context";
import {
  canManageCatalogItems,
  canViewCustomerRevenueAnalytics,
} from "@/lib/permissions";

const fuelTypes = ["DIESEL", "E5", "E10", "ELECTRIC", "HYBRID"] as const;

const vehicleInputSchema = z.object({
  vehicleNumber: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  licensePlate: z.string().trim().max(40).default(""),
  fuelType: z.enum(fuelTypes),
  consumptionLitersPer100Km: z.number().min(0).max(100),
  selfCostPerKm: z.number().min(0).max(1000),
  salesPricePerKm: z.number().min(0).max(1000),
  hourlyRentalRate: z.number().min(0).max(100000).nullable().optional(),
  dailyRentalRate: z.number().min(0).max(100000).nullable().optional(),
  includedKilometersPerDay: z.number().min(0).max(100000).nullable().optional(),
  extraKilometerPrice: z.number().min(0).max(1000).nullable().optional(),
  depositAmount: z.number().min(0).max(1000000).nullable().optional(),
  fuelPolicy: z.string().trim().max(80).default("Voll/Voll"),
  note: z.string().trim().max(3000).default(""),
  isActive: z.boolean().default(true),
});

function getUserName(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: "Die Fahrzeugdaten sind unvollständig oder ungültig.",
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
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canViewCustomerRevenueAnalytics(actorResult.actor)) {
    return NextResponse.json({ error: "Du darfst Fahrzeuge nicht einsehen." }, { status: 403 });
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId: organization.id },
    orderBy: [{ isActive: "desc" }, { name: "asc" }, { vehicleNumber: "asc" }],
  });

  return NextResponse.json(vehicles);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canManageCatalogItems(actorResult.actor)) {
    return NextResponse.json({ error: "Du darfst Fahrzeuge nicht anlegen." }, { status: 403 });
  }

  try {
    const input = vehicleInputSchema.parse(body);
    const duplicate = await prisma.vehicle.findFirst({
      where: {
        organizationId: organization.id,
        vehicleNumber: { equals: input.vehicleNumber, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Diese interne Fahrzeugnummer ist bereits vergeben." },
        { status: 409 }
      );
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        organizationId: organization.id,
        ...input,
        createdById: actorResult.actor.id,
        createdByName: getUserName(actorResult.actor),
      },
    });
    return NextResponse.json(vehicle, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canManageCatalogItems(actorResult.actor)) {
    return NextResponse.json({ error: "Du darfst Fahrzeuge nicht bearbeiten." }, { status: 403 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "Fahrzeug-ID fehlt." }, { status: 400 });

  try {
    const input = vehicleInputSchema.parse(body);
    const existing = await prisma.vehicle.findFirst({
      where: { id, organizationId: organization.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Das Fahrzeug wurde nicht gefunden." }, { status: 404 });
    }

    const duplicate = await prisma.vehicle.findFirst({
      where: {
        organizationId: organization.id,
        vehicleNumber: { equals: input.vehicleNumber, mode: "insensitive" },
        id: { not: id },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Diese interne Fahrzeugnummer ist bereits vergeben." },
        { status: 409 }
      );
    }

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: input,
    });
    return NextResponse.json(vehicle);
  } catch (error) {
    return errorResponse(error);
  }
}
