import { prisma } from "@/lib/db/client";

export const checklistAreas = ["Arbeitsschutz", "Brandschutz", "Gefahrstoffe"] as const;
export const checklistScopes = ["OK solutions", "OK immocare", "Alle Bereiche"] as const;
export const checklistStatuses = ["active", "planned", "inactive"] as const;

export type ChecklistArea = (typeof checklistAreas)[number];
export type ChecklistScope = (typeof checklistScopes)[number];
export type ChecklistTemplateStatus = (typeof checklistStatuses)[number];
export type ChecklistTemplateDefinition = {
  id: string;
  area: ChecklistArea;
  name: string;
  description: string;
  status: ChecklistTemplateStatus;
  scope: ChecklistScope;
  sortOrder: number;
  handlerKey: string | null;
};

type SeedTemplate = ChecklistTemplateDefinition;

export const defaultChecklistTemplateCatalog: SeedTemplate[] = [
  ...[
    "Arbeitsplatz-/Objektbegehung",
    "PSA-Prüfung",
    "Leiterprüfung",
    "Tritt-/Arbeitsmittelprüfung",
    "Maschinen-/Geräteprüfung",
    "Einsatzstellenkontrolle",
    "Erste-Hilfe-Ausstattung",
    "Unfall-/Beinaheunfall-Dokumentation",
    "Sicherheitsunterweisung",
    "Fremdfirmen-Einweisung",
  ].map((name, index) => ({
    id: `arbeitsschutz-${index + 1}`,
    area: "Arbeitsschutz" as const,
    name,
    description: "Vorlage fachlich vorbereitet.",
    status: "planned" as const,
    scope: "Alle Bereiche" as const,
    sortOrder: index + 1,
    handlerKey: null,
  })),
  {
    id: "brandschutz-rauchmelder-installation",
    area: "Brandschutz",
    name: "Rauchmelder-Installationsnachweis",
    description: "Gerätedaten, Montageorte, Prüfpunkte und Bildnachweise erfassen.",
    status: "active",
    scope: "OK immocare",
    sortOrder: 101,
    handlerKey: "smoke-detector-installation-v1",
  },
  ...[
    ["Rauchmelderprüfung", "Prüf- und Wartungsnachweis für bestehende Melder."],
    ["Rauchmelderliste", "Gemeinsame Melderliste für Installation und Prüfung."],
    ["Feuerlöscher-Sichtprüfung", "Vorlage fachlich vorbereitet."],
    ["Flucht- und Rettungswege", "Vorlage fachlich vorbereitet."],
    ["Notbeleuchtung", "Vorlage fachlich vorbereitet."],
    ["Brandschutztüren", "Vorlage fachlich vorbereitet."],
    ["Brandabschottungen", "Vorlage fachlich vorbereitet."],
    ["Feuerwehrzufahrt", "Vorlage fachlich vorbereitet."],
    ["Brandschutzordnung / Aushänge", "Vorlage fachlich vorbereitet."],
    ["Evakuierungsübung", "Vorlage fachlich vorbereitet."],
  ].map(([name, description], index) => ({
    id: `brandschutz-${index + 2}`,
    area: "Brandschutz" as const,
    name,
    description,
    status: "planned" as const,
    scope: "OK immocare" as const,
    sortOrder: 102 + index,
    handlerKey: null,
  })),
  ...[
    "Gefahrstofflager-Prüfung",
    "Sicherheitsdatenblatt vorhanden",
    "Kennzeichnung / Etikettierung",
    "Betriebsanweisung vorhanden",
    "Unterweisung Gefahrstoffe",
    "Zusammenlagerung geprüft",
    "Auffangwannen / Leckageschutz",
    "PSA für Gefahrstoffe",
    "Entsorgung / Reststoffe",
    "Gefahrstoffverzeichnis-Abgleich",
  ].map((name, index) => ({
    id: `gefahrstoffe-${index + 1}`,
    area: "Gefahrstoffe" as const,
    name,
    description: "Vorlage fachlich vorbereitet.",
    status: "planned" as const,
    scope: "OK immocare" as const,
    sortOrder: 201 + index,
    handlerKey: null,
  })),
];

function isMember<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function cleanText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

export function normalizeChecklistTemplateUpdate(value: unknown, current: ChecklistTemplateDefinition) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const status = isMember(checklistStatuses, source.status) ? source.status : current.status;
  if (status === "active" && !current.handlerKey) {
    throw new Error("Die Vorlage kann erst aktiviert werden, wenn Formular und PDF-Ausgabe technisch bereitstehen.");
  }
  return {
    name: cleanText(source.name, current.name, 160),
    description: cleanText(source.description, current.description, 600),
    area: isMember(checklistAreas, source.area) ? source.area : current.area,
    scope: isMember(checklistScopes, source.scope) ? source.scope : current.scope,
    status,
    sortOrder: Number.isInteger(source.sortOrder) ? Math.max(0, Math.min(10_000, Number(source.sortOrder))) : current.sortOrder,
  };
}

export async function ensureChecklistTemplates(organizationId: string) {
  await prisma.$transaction(
    defaultChecklistTemplateCatalog.map((template) => prisma.checklistTemplate.upsert({
      where: { organizationId_stableKey: { organizationId, stableKey: template.id } },
      create: {
        organizationId,
        stableKey: template.id,
        name: template.name,
        description: template.description,
        area: template.area,
        scope: template.scope,
        status: template.status,
        sortOrder: template.sortOrder,
        handlerKey: template.handlerKey,
      },
      update: template.handlerKey ? { handlerKey: template.handlerKey } : {},
    }))
  );
}

export async function getChecklistTemplates(organizationId: string): Promise<ChecklistTemplateDefinition[]> {
  await ensureChecklistTemplates(organizationId);
  const rows = await prisma.checklistTemplate.findMany({
    where: { organizationId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map((row) => ({
    id: row.stableKey,
    area: row.area as ChecklistArea,
    name: row.name,
    description: row.description,
    status: row.status as ChecklistTemplateStatus,
    scope: row.scope as ChecklistScope,
    sortOrder: row.sortOrder,
    handlerKey: row.handlerKey,
  }));
}

export async function updateChecklistTemplate(
  organizationId: string,
  stableKey: string,
  value: unknown,
  actorId: string
) {
  await ensureChecklistTemplates(organizationId);
  const row = await prisma.checklistTemplate.findUnique({
    where: { organizationId_stableKey: { organizationId, stableKey } },
  });
  if (!row) throw new Error("Checklisten-Vorlage wurde nicht gefunden.");
  const current: ChecklistTemplateDefinition = {
    id: row.stableKey,
    area: row.area as ChecklistArea,
    name: row.name,
    description: row.description,
    status: row.status as ChecklistTemplateStatus,
    scope: row.scope as ChecklistScope,
    sortOrder: row.sortOrder,
    handlerKey: row.handlerKey,
  };
  const update = normalizeChecklistTemplateUpdate(value, current);
  await prisma.checklistTemplate.update({
    where: { id: row.id },
    data: { ...update, updatedById: actorId },
  });
  return (await getChecklistTemplates(organizationId)).find((template) => template.id === stableKey)!;
}
