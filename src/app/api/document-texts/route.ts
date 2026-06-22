import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getDemoContext } from "@/lib/demo/context";
import { prisma } from "@/lib/db/client";
import { getSessionUserActor } from "@/lib/auth/actor";
import { canManageDocumentTexts } from "@/lib/permissions";

type DocumentTextRow = {
  id: string;
  source: string;
  kind: string;
  title: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

const seedTexts = [
  {
    source: "Eigene",
    kind: "text",
    title: "Angebot - Einleitung WorkPilot360",
    body:
      "{{customer.titleFullName}},\n\nwir danken Ihnen fuer Ihre Anfrage und unterbreiten Ihnen auf den folgenden Seiten unser Angebot.",
  },
  {
    source: "Eigene",
    kind: "text",
    title: "Angebot - Abschluss WorkPilot360",
    body:
      "Die angegebenen Preise behalten bis zu 4 Wochen ab Angebotsdatum ihre Gueltigkeit.\n\nIch hoffe sehr, dass Ihnen unser Angebot zusagt, und wuerde mich freuen, den Auftrag mit groesster Sorgfalt und Engagement fuer Sie auszufuehren.\n\nBei Fragen oder besonderen Wuenschen stehe ich Ihnen jederzeit gerne persoenlich zur Verfuegung.\n\nMit freundlichen Gruessen\n\n{{partner.fullName}}",
  },
  {
    source: "Eigene",
    kind: "text",
    title: "Angebot - Abschluss OK solutions",
    body:
      "Die angegebenen Preise behalten bis zu 4 Wochen ab Angebotsdatum ihre Gueltigkeit.\n\nIch hoffe sehr, dass Ihnen unser Angebot zusagt, und wuerde mich freuen, den Auftrag mit groesster Sorgfalt und Engagement fuer Sie auszufuehren.\n\nBei Fragen oder besonderen Wuenschen stehe ich Ihnen jederzeit gerne persoenlich zur Verfuegung.\n\nIch freue mich auf Ihre Rueckmeldung.\n\n{{partner.fullName}}\n\nDatenschutzhinweis: Mit Annahme dieses Angebots erklaert sich der Kunde damit einverstanden, dass die fuer die Auftragsabwicklung notwendigen Kontaktdaten verarbeitet werden.",
  },
  {
    source: "Eigene",
    kind: "text",
    title: "Angebot - Abschluss OK immocare",
    body:
      "Die angegebenen Preise behalten bis zu 4 Wochen ab Angebotsdatum ihre Gueltigkeit.\n\nIch hoffe sehr, dass Ihnen unser Angebot zusagt, und wuerde mich freuen, den Auftrag mit groesster Sorgfalt und Engagement fuer Sie auszufuehren.\n\nBitte beachten Sie unsere Hinweise zum Angebot. Wir moechten Ihnen eine verlaessliche erste Kosteneinschaetzung geben. Die Abrechnung erfolgt auf Basis des tatsaechlich anfallenden Materialkosten- und Arbeitsaufwands.\n\nMit dieser Vorgehensweise moechten wir sicherstellen, dass Ihr Projekt effizient, transparent und hochwertig umgesetzt wird.\n\nMit freundlichen Gruessen\n\nIhr Team OK immocare\n\nDatenschutzhinweis: Mit Annahme dieses Angebots erklaert sich der Kunde damit einverstanden, dass die fuer die Auftragsabwicklung notwendigen Kontaktdaten verarbeitet werden.",
  },
  {
    source: "Eigene",
    kind: "text",
    title: "Abschluss Gutschrift",
    body:
      "Wir hoffen, dass mit dieser Gutschrift alles zu Ihrer Zufriedenheit geregelt ist.\n\nBei Fragen oder Anliegen stehen wir Ihnen selbstverstaendlich gerne zur Verfuegung.\n\nMit den besten Gruessen\n\n{{partner.fullName}}",
  },
  {
    source: "Eigene",
    kind: "text",
    title: "Google-Bewertung (schlicht)",
    body:
      "Sind Sie zufrieden mit unserem Service?\n\nWir freuen uns ueber Ihre Google-Bewertung.\n\nEinfach den QR-Code scannen - vielen Dank.",
  },
  {
    source: "System",
    kind: "text",
    title: "Mahnung - Einleitung",
    body:
      "{{customer.titleFullName}},\n\nunsere Rechnung Nr. {{referenceDocument.number}} vom {{referenceDocument.date}} ueber {{referenceDocument.amount}} war am {{referenceDocument.dueDate}} zur Zahlung faellig. Leider haben wir bislang keinen Zahlungseingang verzeichnen koennen.\n\nDas urspruengliche Zahlungsziel ist bereits ueberschritten. Wir moechten Sie daran erinnern, den offenen Betrag bis zum {{customerDocument.currentReminderIntervalEnd}} auf unser unten genanntes Konto zu ueberweisen.",
  },
  {
    source: "System",
    kind: "text",
    title: "Mahnung - Abschluss",
    body:
      "Sollte sich Ihre Zahlung mit diesem Schreiben ueberschneiden, betrachten Sie diese Mahnung bitte als gegenstandslos.\n\nMit freundlichen Gruessen\n\n{{partner.fullName}}",
  },
  {
    source: "Eigene",
    kind: "text",
    title: "Arbeitsbericht - Einleitung WorkPilot360",
    body:
      "{{customer.titleFullName}},\n\nanbei erhalten Sie unseren Arbeitsbericht mit den entsprechenden Vorher- und Nachher-Bildern, damit Sie sich einen detaillierten Eindruck von den durchgefuehrten Massnahmen verschaffen koennen.\n\nWir moechten Ihnen damit die Moeglichkeit geben, die Qualitaet und den Umfang unserer Arbeit transparent nachzuvollziehen.\n\nProjektdaten:\n\nProjektname: {{project.name}}\nProjekt-ID: {{project.displayId}}",
  },
  {
    source: "Eigene",
    kind: "text",
    title: "Rechnung - Abschluss WorkPilot360",
    body:
      "Wir bitten Sie, den offenen Rechnungsbetrag unter Angabe der Rechnungsnummer innerhalb von {{customerDocument.dueDays}} Tagen auf das unten aufgefuehrte Konto zu ueberweisen.\n\nVielen Dank fuer Ihr Vertrauen und die angenehme Zusammenarbeit.\n\nMit den besten Gruessen\n\n{{projectPartner.fullName}}",
  },
  {
    source: "System",
    kind: "title",
    title: "Projektname",
    body: "{{project.name}}",
  },
  {
    source: "System",
    kind: "title",
    title: "Dokumentnummer",
    body: "{{document.number}}",
  },
];

const syntaxCatalog = [
  ["{{customer.titleFullName}}", "Anrede und Name des Kunden"],
  ["{{customer.name}}", "Kunden- oder Firmenname"],
  ["{{partner.fullName}}", "Name des verantwortlichen Mitarbeiters"],
  ["{{projectPartner.fullName}}", "Projektansprechpartner"],
  ["{{project.name}}", "Projektname"],
  ["{{project.displayId}}", "Projekt-ID wie ASS-388"],
  ["{{document.number}}", "Dokumentnummer"],
  ["{{referenceDocument.number}}", "Referenzdokumentnummer"],
  ["{{referenceDocument.date}}", "Datum des Referenzdokuments"],
  ["{{referenceDocument.amount}}", "Betrag des Referenzdokuments"],
  ["{{referenceDocument.dueDate}}", "Faelligkeitsdatum des Referenzdokuments"],
  ["{{customerDocument.dueDays}}", "Zahlungsziel in Tagen"],
  ["{{customerDocument.currentReminderIntervalEnd}}", "Fristende der Mahnung"],
];

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatRow(row: DocumentTextRow) {
  return {
    id: row.id,
    source: row.source,
    kind: row.kind === "title" ? "title" : "text",
    title: row.title,
    body: row.body,
    createdAtLabel: formatDate(row.createdAt),
    updatedAtLabel: formatDate(row.updatedAt),
  };
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getRequestActor(users: User[], actorId: unknown) {
  const requestedActorId = cleanString(actorId);
  if (!requestedActorId) {
    return null;
  }

  return users.find((candidate) => candidate.id === requestedActorId && candidate.isActive) ?? null;
}

function unauthorizedActorResponse() {
  return NextResponse.json(
    { error: "Aktiver Benutzer konnte nicht eindeutig bestimmt werden." },
    { status: 401 }
  );
}

function forbiddenDocumentTextManagementResponse() {
  return NextResponse.json(
    { error: "Nur Admins und Geschaeftsfuehrung duerfen Dokumenttexte verwalten." },
    { status: 403 }
  );
}

async function ensureTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "DocumentTextTemplate" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "source" TEXT NOT NULL DEFAULT 'Eigene',
      "kind" TEXT NOT NULL DEFAULT 'text',
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DocumentTextTemplate_pkey" PRIMARY KEY ("id")
    )
  `;
  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "DocumentTextTemplate_org_title_key"
    ON "DocumentTextTemplate" ("organizationId", "title")
  `;
}

async function ensureSeed(organizationId: string) {
  for (const text of seedTexts) {
    await prisma.$executeRaw`
      INSERT INTO "DocumentTextTemplate" ("id", "organizationId", "source", "kind", "title", "body")
      VALUES (${randomUUID()}, ${organizationId}, ${text.source}, ${text.kind}, ${text.title}, ${text.body})
      ON CONFLICT ("organizationId", "title") DO NOTHING
    `;
  }
}

async function getDocumentTextsResponse(organizationId: string) {
  await ensureTable();
  await ensureSeed(organizationId);

  const rows = await prisma.$queryRaw<DocumentTextRow[]>`
    SELECT "id", "source", "kind", "title", "body", "createdAt", "updatedAt"
    FROM "DocumentTextTemplate"
    WHERE "organizationId" = ${organizationId}
    ORDER BY "title" ASC
  `;

  return NextResponse.json({
    texts: rows.map(formatRow),
    syntax: syntaxCatalog.map(([placeholder, description]) => ({ placeholder, description })),
  });
}

export async function GET(req: Request) {
  const { organization, users } = await getDemoContext();
  const { searchParams } = new URL(req.url);
  const requestedActorId = searchParams.get("actorId");
  const actor =
    getRequestActor(users, requestedActorId) ??
    (!cleanString(requestedActorId) ? await getSessionUserActor(req, users) : null);
  if (!actor) {
    return cleanString(requestedActorId) ? unauthorizedActorResponse() : NextResponse.json({ texts: [], syntax: [] });
  }

  return getDocumentTextsResponse(organization.id);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }
  if (!canManageDocumentTexts(actor)) {
    return forbiddenDocumentTextManagementResponse();
  }
  await ensureTable();

  const title = cleanString(body.title);
  const textBody = cleanString(body.body);
  const kind = cleanString(body.kind) === "title" ? "title" : "text";
  const source = cleanString(body.source) || "Eigene";

  if (!title || !textBody) {
    return NextResponse.json({ error: "Bitte Titel und Text angeben." }, { status: 400 });
  }

  try {
    await prisma.$executeRaw`
      INSERT INTO "DocumentTextTemplate" ("id", "organizationId", "source", "kind", "title", "body", "updatedAt")
      VALUES (${randomUUID()}, ${organization.id}, ${source}, ${kind}, ${title}, ${textBody}, CURRENT_TIMESTAMP)
    `;
  } catch {
    return NextResponse.json(
      { error: "Ein Textbaustein mit diesem Titel ist bereits vorhanden." },
      { status: 409 }
    );
  }

  return getDocumentTextsResponse(organization.id);
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }
  if (!canManageDocumentTexts(actor)) {
    return forbiddenDocumentTextManagementResponse();
  }
  await ensureTable();

  const id = cleanString(body.id);
  const title = cleanString(body.title);
  const textBody = cleanString(body.body);
  const kind = cleanString(body.kind) === "title" ? "title" : "text";
  const source = cleanString(body.source) || "Eigene";

  if (!id || !title || !textBody) {
    return NextResponse.json({ error: "Bitte Titel und Text angeben." }, { status: 400 });
  }

  try {
    await prisma.$executeRaw`
      UPDATE "DocumentTextTemplate"
      SET
        "source" = ${source},
        "kind" = ${kind},
        "title" = ${title},
        "body" = ${textBody},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
        AND "organizationId" = ${organization.id}
    `;
  } catch {
    return NextResponse.json(
      { error: "Ein Textbaustein mit diesem Titel ist bereits vorhanden." },
      { status: 409 }
    );
  }

  return getDocumentTextsResponse(organization.id);
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const { organization, users } = await getDemoContext();
  const actor = getRequestActor(users, body.actorId);
  if (!actor) {
    return unauthorizedActorResponse();
  }
  if (!canManageDocumentTexts(actor)) {
    return forbiddenDocumentTextManagementResponse();
  }
  await ensureTable();

  await prisma.$executeRaw`
    DELETE FROM "DocumentTextTemplate"
    WHERE "id" = ${cleanString(body.id)}
      AND "organizationId" = ${organization.id}
  `;

  return getDocumentTextsResponse(organization.id);
}
