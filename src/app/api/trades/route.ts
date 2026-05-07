import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";

const defaultTrades = [
  { name: "Wartung", projectPrefix: "WAR" },
  { name: "Malerarbeiten", projectPrefix: "MAR" },
  { name: "Glasreinigung", projectPrefix: "GLR" },
  { name: "Unterhaltsreinigung", projectPrefix: "UHR" },
  { name: "Grünflächen- und Gartenpflege", projectPrefix: "GPFL" },
  { name: "Hausmeisterservice", projectPrefix: "HAS" },
  { name: "Hausverwaltung", projectPrefix: "HVW" },
  { name: "Fassadenreinigung", projectPrefix: "FAR" },
  { name: "Dachreinigung", projectPrefix: "DAR" },
  { name: "Umzug Service", projectPrefix: "UMZ" },
  { name: "Intern", projectPrefix: "INT" },
  { name: "Trockeneisstrahlen", projectPrefix: "TREI" },
  { name: "Reparaturarbeiten", projectPrefix: "REP" },
  { name: "Reinigung", projectPrefix: "REI" },
  { name: "Objektbetreuung", projectPrefix: "OBJ" },
  { name: "Photovoltaikanlagenreinigung", projectPrefix: "PAR" },
  { name: "Materialverkauf", projectPrefix: "MAT" },
  { name: "Arbeitssicherheit", projectPrefix: "ASS" },
  { name: "HR", projectPrefix: "HR" },
  { name: "Marketing", projectPrefix: "MKG" },
  { name: "Winterdienst", projectPrefix: "WID" },
];

function canManageTrades(role: Role) {
  return role === Role.ADMIN || role === Role.GESCHAEFTSFUEHRER;
}

function normalizeProjectPrefix(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
}

function formatTrade(trade: { id: string; name: string; projectPrefix: string | null }) {
  return {
    id: trade.id,
    name: trade.name,
    projectPrefix: trade.projectPrefix ?? "",
  };
}

async function ensureDefaultTrades(organizationId: string) {
  const existingTrades = await prisma.category.findMany({
    where: { organizationId },
    select: { id: true, name: true, projectPrefix: true },
  });
  const existingNames = new Set(existingTrades.map((trade) => trade.name.toLowerCase()));
  const missingTrades = defaultTrades.filter(
    (trade) => !existingNames.has(trade.name.toLowerCase())
  );

  if (missingTrades.length > 0) {
    await prisma.category.createMany({
      data: missingTrades.map((trade) => ({
        organizationId,
        name: trade.name,
        projectPrefix: trade.projectPrefix,
      })),
    });
  }

  await Promise.all(
    existingTrades
      .map((trade) => {
        if (trade.projectPrefix) return null;
        const defaultTrade = defaultTrades.find(
          (item) => item.name.toLowerCase() === trade.name.toLowerCase()
        );
        if (!defaultTrade) return null;

        return prisma.category.update({
          where: { id: trade.id },
          data: { projectPrefix: defaultTrade.projectPrefix },
        });
      })
      .filter((update): update is NonNullable<typeof update> => Boolean(update))
  );
}

export async function GET() {
  const { organization } = await getDemoContext();
  await ensureDefaultTrades(organization.id);

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
      { error: "Nur Admins und Geschäftsführung dürfen Gewerke verwalten." },
      { status: 403 }
    );
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Bitte einen Gewerknamen angeben." }, { status: 400 });
  }

  const name = body.name.trim();
  const projectPrefix = normalizeProjectPrefix(body.projectPrefix);
  if (body.projectPrefix && !projectPrefix) {
    return NextResponse.json({ error: "Bitte ein gültiges Projektkürzel angeben." }, { status: 400 });
  }

  const existingTrade = await prisma.category.findFirst({
    where: {
      organizationId: organization.id,
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
  });

  if (existingTrade) {
    return NextResponse.json(
      { error: "Dieses Gewerk ist bereits vorhanden." },
      { status: 409 }
    );
  }

  const trade = await prisma.category.create({
    data: {
      organizationId: organization.id,
      name,
      projectPrefix: projectPrefix || null,
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
      { error: "Nur Admins und Geschäftsführung dürfen Gewerke verwalten." },
      { status: 403 }
    );
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Bitte einen Gewerknamen angeben." }, { status: 400 });
  }
  const projectPrefix = normalizeProjectPrefix(body.projectPrefix);
  if (body.projectPrefix && !projectPrefix) {
    return NextResponse.json({ error: "Bitte ein gültiges Projektkürzel angeben." }, { status: 400 });
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
      projectPrefix: projectPrefix || null,
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
      { error: "Nur Admins und Geschäftsführung dürfen Gewerke verwalten." },
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
