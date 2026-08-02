import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

type GuidedSearchDb = Prisma.TransactionClient | typeof prisma;

export type JarvisGuidedSearchKind = "customer" | "project" | "catalog";

export type JarvisGuidedSearchResult =
  | { kind: "customer"; id: string; label: string; detail: string; projectCount: number }
  | {
      kind: "project";
      id: string;
      label: string;
      detail: string;
      customerLabel: string;
      projectKind: string;
      defaultCompany: "OK solutions" | "OK immocare";
      defaultExecutionMonth: string;
      defaultExecutionEndMonth: string;
    }
  | {
      kind: "catalog";
      id: string;
      label: string;
      detail: string;
      catalogType: string;
      unit: string;
      description: string;
      salesPrice: number;
      vatRate: number;
    };

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function tokenizedContains(fields: string[], query: string) {
  const tokens = query.split(/[\s,;|/\\-]+/).map((token) => token.trim()).filter(Boolean).slice(0, 6);
  return tokens.length
    ? {
        AND: tokens.map((token) => ({
          OR: fields.map((field) => ({
            [field]: { contains: token, mode: "insensitive" as const },
          })),
        })),
      }
    : {};
}

function archived(status: string | null) {
  const value = (status ?? "").toLocaleLowerCase("de-DE");
  return value.includes("archiv") || value.includes("gelöscht") || value.includes("geloescht");
}

function defaultCompany(projectType: string | null, projectNumber: string) {
  return (projectType ?? "").toLocaleLowerCase("de-DE").includes("immocare") ||
    projectNumber.toLocaleLowerCase("de-DE").startsWith("oki")
    ? ("OK immocare" as const)
    : ("OK solutions" as const);
}

function isRecurring(projectKind: string | null) {
  return (projectKind ?? "").toLocaleLowerCase("de-DE").startsWith("dauer");
}

export async function searchJarvisGuidedOptions(input: {
  organizationId: string;
  kind: JarvisGuidedSearchKind;
  query?: string;
  customer?: string;
  limit?: number;
  db?: GuidedSearchDb;
}): Promise<JarvisGuidedSearchResult[]> {
  const db = input.db ?? prisma;
  const query = clean(input.query, 120);
  const customer = clean(input.customer, 300);
  const limit = Math.min(20, Math.max(1, input.limit ?? 12));

  if (input.kind === "catalog") {
    const items = await db.catalogItem.findMany({
      where: {
        organizationId: input.organizationId,
        isActive: true,
        ...tokenizedContains(["number", "name", "description", "type"], query),
      },
      orderBy: [{ type: "asc" }, { number: "asc" }],
      take: limit,
      select: {
        id: true,
        number: true,
        name: true,
        description: true,
        type: true,
        unit: true,
        salesPrice: true,
        vatRate: true,
      },
    });
    return items.map((item) => ({
      kind: "catalog" as const,
      id: item.id,
      label: `${item.number} · ${item.name}`,
      detail: [item.type, item.unit].filter(Boolean).join(" · "),
      catalogType: item.type,
      unit: item.unit,
      description: item.description ?? "",
      salesPrice: item.salesPrice,
      vatRate: item.vatRate,
    }));
  }

  const projects = await db.workPilotProject.findMany({
    where: {
      organizationId: input.organizationId,
      ...(customer ? { customer } : {}),
      ...tokenizedContains(["projectNumber", "title", "customer", "trade", "projectType"], query),
    },
    orderBy: [{ updatedAt: "desc" }, { projectNumber: "asc" }],
    take: input.kind === "customer" ? 100 : limit * 2,
    select: {
      id: true,
      projectNumber: true,
      title: true,
      customer: true,
      status: true,
      trade: true,
      projectType: true,
      projectKind: true,
      projectRuntimeFrom: true,
      projectRuntimeUntil: true,
    },
  });
  const openProjects = projects.filter((project) => !archived(project.status));

  if (input.kind === "customer") {
    const grouped = new Map<string, number>();
    for (const project of openProjects) {
      const label = clean(project.customer, 300);
      if (label) grouped.set(label, (grouped.get(label) ?? 0) + 1);
    }
    return [...grouped.entries()].slice(0, limit).map(([label, projectCount]) => ({
      kind: "customer" as const,
      id: label,
      label,
      detail: `${projectCount} offene${projectCount === 1 ? "s Projekt" : " Projekte"}`,
      projectCount,
    }));
  }

  return openProjects.slice(0, limit).map((project) => ({
    kind: "project" as const,
    id: project.id,
    label: `${project.projectNumber || project.id} · ${project.title}`,
    detail: [project.customer, project.trade || project.projectType].filter(Boolean).join(" · "),
    customerLabel: project.customer ?? "",
    projectKind: project.projectKind ?? "",
    defaultCompany: defaultCompany(project.projectType, project.projectNumber),
    defaultExecutionMonth: isRecurring(project.projectKind)
      ? clean(project.projectRuntimeFrom, 10).slice(0, 7)
      : "",
    defaultExecutionEndMonth: isRecurring(project.projectKind)
      ? clean(project.projectRuntimeUntil, 10).slice(0, 7)
      : "",
  }));
}
