import { NextResponse } from "next/server";
import {
  getSessionBoundActor,
  sessionBoundActorResponse,
} from "@/lib/auth/actor";
import { getDemoContext } from "@/lib/demo/context";
import { canViewCustomerRevenueAnalytics } from "@/lib/permissions";
import { loadVehicleFuelPrices } from "@/lib/vehicle-fuel-prices";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(
    req,
    users,
    url.searchParams.get("actorId")
  );
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canViewCustomerRevenueAnalytics(actorResult.actor)) {
    return NextResponse.json(
      { error: "Du darfst Kraftstoffpreise nicht einsehen." },
      { status: 403 }
    );
  }

  return NextResponse.json(await loadVehicleFuelPrices());
}
