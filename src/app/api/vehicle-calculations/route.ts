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
  calculateVehicleTrip,
  VehicleTripCalculationValidationError,
  type VehicleTripCalculationInput,
} from "@/lib/vehicle-calculation";

const inputSchema = z.object({
  distanceKm: z.number(),
  consumptionLitersPer100Km: z.number(),
  fuelPricePerLiter: z.number(),
  selfCostPerKm: z.number(),
  salesPricePerKm: z.number(),
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

function calculationError(error: unknown) {
  if (error instanceof VehicleTripCalculationValidationError) {
    return NextResponse.json({ error: error.message, fields: error.fields }, { status: 400 });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Die Fahrtenkalkulation ist unvollständig.", fields: error.flatten().fieldErrors },
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
    return NextResponse.json(
      { error: "Du darfst Fahrtenkalkulationen nicht einsehen." },
      { status: 403 }
    );
  }

  const calculations = await prisma.vehicleCalculation.findMany({
    where: {
      organizationId: organization.id,
      ...(url.searchParams.get("vehicleId")
        ? { vehicleId: cleanString(url.searchParams.get("vehicleId")) }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(calculations);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canViewCustomerRevenueAnalytics(actorResult.actor)) {
    return NextResponse.json(
      { error: "Du darfst Fahrtenkalkulationen nicht berechnen." },
      { status: 403 }
    );
  }

  try {
    const requestedInput = inputSchema.parse(
      body.input
    ) as VehicleTripCalculationInput;
    const requestedResult = calculateVehicleTrip(requestedInput);
    const action = cleanString(body.action) || "calculate";
    if (action === "calculate") {
      return NextResponse.json({
        input: requestedInput,
        result: requestedResult,
      });
    }
    if (action !== "save") {
      return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
    }
    if (!canManageProjects(actorResult.actor)) {
      return NextResponse.json(
        {
          error:
            "Du darfst Fahrtenkalkulationen berechnen, aber nicht dauerhaft speichern.",
        },
        { status: 403 }
      );
    }

    const vehicleId = cleanString(body.vehicleId);
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, organizationId: organization.id, isActive: true },
    });
    if (!vehicle) {
      return NextResponse.json({ error: "Das ausgewählte Fahrzeug wurde nicht gefunden." }, { status: 404 });
    }
    const input: VehicleTripCalculationInput = {
      ...requestedInput,
      consumptionLitersPer100Km:
        vehicle.consumptionLitersPer100Km,
      selfCostPerKm: vehicle.selfCostPerKm,
      salesPricePerKm: vehicle.salesPricePerKm,
    };
    const result = calculateVehicleTrip(input);

    const fuelPriceFetchedAt = cleanString(body.fuelPriceFetchedAt);
    const calculation = await prisma.vehicleCalculation.create({
      data: {
        organizationId: organization.id,
        vehicleId: vehicle.id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleName: vehicle.name,
        customerId: cleanString(body.customerId),
        projectId: cleanString(body.projectId),
        createdById: actorResult.actor.id,
        createdByName: getUserName(actorResult.actor),
        inputSnapshot: {
          ...input,
          vehicle: {
            id: vehicle.id,
            vehicleNumber: vehicle.vehicleNumber,
            name: vehicle.name,
            licensePlate: vehicle.licensePlate,
            fuelType: vehicle.fuelType,
            updatedAt: vehicle.updatedAt.toISOString(),
          },
        },
        resultSnapshot: result,
        fuelPriceSource: cleanString(body.fuelPriceSource),
        fuelPriceFetchedAt: fuelPriceFetchedAt ? new Date(fuelPriceFetchedAt) : null,
        note: cleanString(body.note),
      },
    });

    return NextResponse.json(calculation, { status: 201 });
  } catch (error) {
    return calculationError(error);
  }
}
