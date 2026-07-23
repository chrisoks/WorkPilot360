import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";
import { getDemoContext } from "@/lib/demo/context";
import { syncInvoiceInventoryMovements } from "@/lib/inventory/catalog-inventory";
import { canManageCatalogItems } from "@/lib/permissions";

function getName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "System";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { organization, users } = await getDemoContext();
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canManageCatalogItems(actorResult.actor)) {
    return NextResponse.json({ error: "Du darfst Lagerbewegungen nicht abgleichen." }, { status: 403 });
  }
  const salt = await prisma.catalogItem.findFirst({
    where: { organizationId: organization.id, number: "OKI0448", type: "article" },
    select: { id: true },
  });
  if (!salt) return NextResponse.json({ error: "Streugutartikel OKI0448 fehlt." }, { status: 404 });
  const invoices = await prisma.invoice.findMany({
    where: { organizationId: organization.id },
    select: { id: true },
  });
  for (const invoice of invoices) {
    await syncInvoiceInventoryMovements({
      db: prisma,
      organizationId: organization.id,
      invoiceId: invoice.id,
      actorUserId: actorResult.actor.id,
      actorName: getName(actorResult.actor),
      catalogItemIds: [salt.id],
    });
  }
  return NextResponse.json({ synchronizedInvoices: invoices.length });
}
