import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/client";
import { ensureOrganizationSettingsTable } from "@/lib/company-settings/deadlines";

export const documentMailKinds = [
  "offer",
  "invoice",
  "cancellation",
  "reminder",
  "activityReport",
  "document",
] as const;

export type DocumentMailTemplateKind = (typeof documentMailKinds)[number];
export type DocumentMailTemplate = { subject: string; body: string };
export type DocumentMailTemplates = Record<DocumentMailTemplateKind, DocumentMailTemplate>;

const MAIL_TEMPLATE_SETTINGS_KEY = "document-mail-templates";

export const defaultDocumentMailTemplates: DocumentMailTemplates = {
  offer: {
    subject: "Angebot {{number}}",
    body: "Hallo,\n\nanbei senden wir Ihnen unser Angebot {{number}} als PDF.\n\nBei Fragen melden Sie sich gern.",
  },
  invoice: {
    subject: "Rechnung {{number}}",
    body: "Hallo,\n\nanbei senden wir Ihnen unsere Rechnung {{number}} als PDF.\n\nBitte prüfen Sie die Unterlagen. Bei Rückfragen stehen wir gern zur Verfügung.",
  },
  cancellation: {
    subject: "Stornorechnung {{number}}",
    body: "Hallo,\n\nanbei senden wir Ihnen die Stornorechnung {{number}} als PDF.\n\nBei Rückfragen stehen wir gern zur Verfügung.",
  },
  reminder: {
    subject: "Mahnung {{number}}",
    body: "Hallo,\n\nanbei senden wir Ihnen unsere Mahnung {{number}} als PDF.\n\nBitte prüfen Sie den offenen Betrag und die Zahlungsfrist. Bei Rückfragen stehen wir gern zur Verfügung.",
  },
  activityReport: {
    subject: "Tätigkeitsbericht {{number}}",
    body: "Hallo,\n\nanbei senden wir Ihnen den Tätigkeitsbericht {{number}}.\n\nBei Fragen melden Sie sich gern.",
  },
  document: {
    subject: "Dokument {{number}}",
    body: "Hallo,\n\nanbei senden wir Ihnen das Dokument {{number}}.\n\nBei Fragen melden Sie sich gern.",
  },
};

function cleanTemplateText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/\r\n/g, "\n").trim();
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

export function normalizeDocumentMailTemplates(value: unknown): DocumentMailTemplates {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return Object.fromEntries(documentMailKinds.map((kind) => {
    const candidate = source[kind] && typeof source[kind] === "object" && !Array.isArray(source[kind])
      ? source[kind] as Record<string, unknown>
      : {};
    const fallback = defaultDocumentMailTemplates[kind];
    return [kind, {
      subject: cleanTemplateText(candidate.subject, fallback.subject, 240),
      body: cleanTemplateText(candidate.body, fallback.body, 12_000),
    }];
  })) as DocumentMailTemplates;
}

export async function getDocumentMailTemplates(organizationId: string) {
  await ensureOrganizationSettingsTable();
  const setting = await prisma.organizationSetting.findUnique({
    where: { organizationId_key: { organizationId, key: MAIL_TEMPLATE_SETTINGS_KEY } },
    select: { value: true },
  });
  return normalizeDocumentMailTemplates(setting?.value);
}

export async function saveDocumentMailTemplates(organizationId: string, value: unknown) {
  const templates = normalizeDocumentMailTemplates(value);
  await ensureOrganizationSettingsTable();
  await prisma.organizationSetting.upsert({
    where: { organizationId_key: { organizationId, key: MAIL_TEMPLATE_SETTINGS_KEY } },
    create: {
      id: randomUUID(),
      organizationId,
      key: MAIL_TEMPLATE_SETTINGS_KEY,
      value: templates,
    },
    update: { value: templates },
  });
  return templates;
}
