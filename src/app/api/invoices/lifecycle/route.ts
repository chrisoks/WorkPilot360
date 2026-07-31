import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSessionBoundActor, sessionBoundActorResponse } from "@/lib/auth/actor";
import { prisma } from "@/lib/db/client";
import { getDemoContext } from "@/lib/demo/context";
import {
  executeInvoiceLifecycle,
  InvoiceLifecycleServiceError,
  type InvoiceLifecycleAction,
} from "@/lib/invoices/invoice-lifecycle-service";
import { canDeleteInvoices } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof InvoiceLifecycleServiceError) {
    const status = error.code === "not_found" ? 404 : error.code === "blocked" || error.code === "invalid_input" ? 400 : 409;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  return NextResponse.json({ error: "Die Rechnungsänderung konnte nicht sicher ausgeführt werden." }, { status: 500 });
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const url = new URL(req.url);
  const actorResult = await getSessionBoundActor(req, users, url.searchParams.get("actorId"));
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canDeleteInvoices(actorResult.actor)) return NextResponse.json({ error: "Keine Berechtigung für gelöschte Rechnungsentwürfe." }, { status: 403 });
  const projectId = (url.searchParams.get("projectId") || "").trim();
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: organization.id,
      status: { in: ["Gelöscht", "Gel\u00c3\u00b6scht"] },
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(invoices.map(({ pdfData, ...invoice }) => ({
    ...invoice,
    pdfAvailable: Boolean(pdfData),
    paidAt: invoice.paidAt?.toISOString() || "",
    lastReminderAt: invoice.lastReminderAt?.toISOString() || "",
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    lines: [],
  })));
}

export async function POST(req: Request) {
  const { organization, users } = await getDemoContext();
  const body = await req.json().catch(() => ({}));
  const actorResult = await getSessionBoundActor(req, users, body.actorId);
  if (!actorResult.ok) return sessionBoundActorResponse(actorResult);
  if (!canDeleteInvoices(actorResult.actor)) return NextResponse.json({ error: "Keine Berechtigung für diese Rechnungsänderung." }, { status: 403 });
  const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const action: InvoiceLifecycleAction | undefined = body.action === "delete" || body.action === "restore" ? body.action : undefined;
  if (!invoiceId || !action) return NextResponse.json({ error: "Rechnung oder Aktion fehlt." }, { status: 400 });
  const actor = actorResult.actor;
  const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email;
  try {
    const invoice = await prisma.$transaction(
      (tx) => executeInvoiceLifecycle({
        tx,
        organizationId: organization.id,
        invoiceId,
        action,
        reason,
        actorId: actor.id,
        actorName,
        source: "ui",
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return NextResponse.json({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, status: invoice.status });
  } catch (error) {
    return errorResponse(error);
  }
}
