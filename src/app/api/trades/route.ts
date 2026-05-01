import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

function canManageTrades(role: Role) {
  return role === Role.ADMIN || role === Role.GESCHAEFTSFUEHRER;
}

function formatTrade(trade: { id: string; name: string }) {
  return {
    id: trade.id,
    name: trade.name,
  };
}

export async function GET() {
  const { organization } = await getDemoContext();

  const trades = await prisma.category.findMany({
    where: {
      organizationId: organization.id,
    },
    orderBy: {
      name: "asc",
    },
  });

  return NextResponse.json(trades.map(formatTrade));
}

export async function POST(req: Request) {
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;

  if (!canManageTrades(actor.role)) {
    return NextResponse.json(
      { error: "Nur Admins und Gesch\u00e4ftsf\u00fchrung d\u00fcrfen Gewerke verwalten." },
      { status: 403 }
    );
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Bitte einen Gewerknamen angeben." }, { status: 400 });
  }

  const trade = await prisma.category.create({
    data: {
      organizationId: organization.id,
      name: body.name.trim(),
    },
  });

  return NextResponse.json(formatTrade(trade), { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;

  if (!canManageTrades(actor.role)) {
    return NextResponse.json(
      { error: "Nur Admins und Gesch\u00e4ftsf\u00fchrung d\u00fcrfen Gewerke verwalten." },
      { status: 403 }
    );
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Bitte einen Gewerknamen angeben." }, { status: 400 });
  }

  const trade = await prisma.category.findFirst({
    where: {
      id: body.tradeId,
      organizationId: organization.id,
    },
  });

  if (!trade) {
    return NextResponse.json({ error: "Gewerk wurde nicht gefunden." }, { status: 404 });
  }

  const updated = await prisma.category.update({
    where: {
      id: trade.id,
    },
    data: {
      name: body.name.trim(),
    },
  });

  return NextResponse.json(formatTrade(updated));
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const { organization, user, users } = await getDemoContext();
  const actor = users.find((demoUser) => demoUser.id === body.actorId) ?? user;

  if (!canManageTrades(actor.role)) {
    return NextResponse.json(
      { error: "Nur Admins und Gesch\u00e4ftsf\u00fchrung d\u00fcrfen Gewerke verwalten." },
      { status: 403 }
    );
  }

  const trade = await prisma.category.findFirst({
    where: {
      id: body.tradeId,
      organizationId: organization.id,
    },
  });

  if (!trade) {
    return NextResponse.json({ error: "Gewerk wurde nicht gefunden." }, { status: 404 });
  }

  await prisma.task.updateMany({
    where: {
      categoryId: trade.id,
    },
    data: {
      categoryId: null,
    },
  });

  await prisma.category.delete({
    where: {
      id: trade.id,
    },
  });

  return NextResponse.json({ success: true });
}
