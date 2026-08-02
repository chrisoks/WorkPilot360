import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

type CostDb = Prisma.TransactionClient | typeof prisma;
export const employeeCostDefaults = { monthlySalary: 0, fullCostFactor: 1.35, annualHours: 2080, vacationDays: 30, trainingDays: 0, sickDays: 10, hoursPerDay: 8 } as const;
export type EmployeeCostField = keyof typeof employeeCostDefaults;
export type EmployeeCostValues = Partial<Record<EmployeeCostField, number>>;
export type EmployeeCostEvaluation = {
  employee: { id: string; label: string; email: string; isActive: boolean };
  cost: { id: string; updatedAt: string; exists: boolean };
  values: Record<EmployeeCostField, number>;
  changes: Array<{ field: EmployeeCostField; label: string; before: number; after: number }>;
  metrics: { annualFullCost: number; monthlyFullCost: number; deductionDays: number; deductionHours: number; sellableAnnualHours: number; sellableMonthlyHours: number; hourlyCost: number };
  impacts: Array<{ key: string; label: string; count: number }>;
  checks: Array<{ key: string; label: string; status: "ok" | "warning" | "blocked"; detail: string }>;
  warnings: string[]; blockingIssues: string[]; fingerprint: string;
};

export class EmployeeCostManagementServiceError extends Error {
  constructor(public readonly code: "not_found" | "invalid_input" | "stale_context" | "conflict", message: string) { super(message); this.name = "EmployeeCostManagementServiceError"; }
}

const labels: Record<EmployeeCostField, string> = { monthlySalary: "Monatsgehalt brutto", fullCostFactor: "Vollkostenfaktor", annualHours: "Jahresstunden gesamt", vacationDays: "Urlaubstage", trainingDays: "Schulungstage", sickDays: "Krankheitstage angenommen", hoursPerDay: "Stunden pro Arbeitstag" };
const round = (value: number) => Math.round(value * 100) / 100;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const finite = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : Number.NaN; };
export const getEmployeeCostConfirmationText = (email: string) => `LOHNKOSTEN ÄNDERN ${String(email ?? "").trim().toLowerCase()}`;
export function calculateEmployeeCostMetrics(values: Record<EmployeeCostField, number>) {
  const deductionDays = values.vacationDays + values.trainingDays + values.sickDays;
  const deductionHours = deductionDays * values.hoursPerDay;
  const sellableAnnualHours = Math.max(0, values.annualHours - deductionHours);
  const annualFullCost = values.monthlySalary * 12 * values.fullCostFactor;
  return { annualFullCost: round(annualFullCost), monthlyFullCost: round(values.monthlySalary * values.fullCostFactor), deductionDays: round(deductionDays), deductionHours: round(deductionHours), sellableAnnualHours: round(sellableAnnualHours), sellableMonthlyHours: round(sellableAnnualHours / 12), hourlyCost: sellableAnnualHours > 0 ? round(annualFullCost / sellableAnnualHours) : 0 };
}

export async function evaluateEmployeeCostChange(input: { organizationId: string; userId: string; changes: EmployeeCostValues; db?: CostDb }): Promise<EmployeeCostEvaluation> {
  const db = input.db ?? prisma;
  const employee = await db.user.findFirst({ where: { id: input.userId, organizationId: input.organizationId }, select: { id: true, firstName: true, lastName: true, email: true, isActive: true } });
  if (!employee) throw new EmployeeCostManagementServiceError("not_found", "Der Mitarbeiter wurde in der aktuellen Organisation nicht gefunden.");
  const currentRow = await db.employeeCostCalculation.findUnique({ where: { organizationId_userId: { organizationId: input.organizationId, userId: employee.id } } });
  const current = Object.fromEntries((Object.keys(employeeCostDefaults) as EmployeeCostField[]).map((field) => [field, Number(currentRow?.[field] ?? employeeCostDefaults[field])])) as Record<EmployeeCostField, number>;
  const values = { ...current };
  const blockingIssues: string[] = [];
  for (const field of Object.keys(input.changes) as EmployeeCostField[]) {
    const value = finite(input.changes[field]);
    if (!Number.isFinite(value) || value < 0) blockingIssues.push(`${labels[field]} muss eine nicht negative Zahl sein.`); else values[field] = round(value);
  }
  if (!employee.isActive) blockingIssues.push("Lohnkostendaten inaktiver Mitarbeiter werden in diesem Schritt nicht geändert.");
  if (values.fullCostFactor <= 0 || values.fullCostFactor > 5) blockingIssues.push("Der Vollkostenfaktor muss größer als 0 und höchstens 5 sein.");
  if (values.annualHours <= 0 || values.annualHours > 8_760) blockingIssues.push("Die Jahresstunden müssen größer als 0 und höchstens 8.760 sein.");
  if (values.hoursPerDay <= 0 || values.hoursPerDay > 24) blockingIssues.push("Die Stunden pro Arbeitstag müssen größer als 0 und höchstens 24 sein.");
  for (const field of ["vacationDays", "trainingDays", "sickDays"] as EmployeeCostField[]) if (values[field] > 366) blockingIssues.push(`${labels[field]} dürfen höchstens 366 betragen.`);
  const metrics = calculateEmployeeCostMetrics(values);
  if (metrics.sellableAnnualHours <= 0) blockingIssues.push("Die Abzugstage verbrauchen alle Jahresstunden; ein interner Kostensatz ist nicht berechenbar.");
  const changes = (Object.keys(labels) as EmployeeCostField[]).filter((field) => current[field] !== values[field]).map((field) => ({ field, label: labels[field], before: current[field], after: values[field] }));
  if (!changes.length) blockingIssues.push("Es wurde keine wirksame Lohnkostenänderung erkannt.");
  const [historicalSnapshots, unratedTimes, activeStamps] = await Promise.all([
    db.projectTimeEntry.count({ where: { organizationId: input.organizationId, userId: employee.id, laborCostRateSnapshot: { gt: 0 }, deletedAt: null } }),
    db.projectTimeEntry.count({ where: { organizationId: input.organizationId, userId: employee.id, laborCostRateSnapshot: { lte: 0 }, deletedAt: null } }),
    db.activeStampSession.count({ where: { organizationId: input.organizationId, userId: employee.id } }),
  ]);
  const impacts = [{ key: "historicalSnapshots", label: "historische Zeiten mit Kostensnapshot", count: historicalSnapshots }, { key: "unratedTimes", label: "historische Zeiten ohne Kostensnapshot", count: unratedTimes }, { key: "activeStamps", label: "laufende Stempelungen", count: activeStamps }];
  const warnings = ["Bestehende Projektzeiten und ihre historischen Kostensnapshots werden nicht rückwirkend verändert.", "Der neue interne Kostensatz wirkt erst auf künftig abgeschlossene Stempelungen und neue Kalkulationen.", ...(unratedTimes ? ["Historische Zeiten ohne Kostensnapshot werden nicht automatisch mit dem neuen Satz nachbewertet."] : []), ...(activeStamps ? ["Eine bereits laufende Stempelung übernimmt den neuen Satz erst bei ihrem späteren Abschluss."] : [])];
  const checks: EmployeeCostEvaluation["checks"] = [
    { key: "calculation", label: "Interner Kostensatz", status: metrics.hourlyCost > 0 ? "ok" : "warning", detail: `${metrics.hourlyCost.toFixed(2).replace(".", ",")} € je verkaufbarer Stunde` },
    { key: "capacity", label: "Verkaufbare Jahresstunden", status: metrics.sellableAnnualHours > 0 ? "ok" : "blocked", detail: `${metrics.sellableAnnualHours.toFixed(2).replace(".", ",")} von ${values.annualHours.toFixed(2).replace(".", ",")} Stunden` },
    { key: "history", label: "Historische Kostenstände", status: unratedTimes || activeStamps ? "warning" : "ok", detail: `${historicalSnapshots} geschützt, ${unratedTimes} ohne Snapshot, ${activeStamps} laufend` },
  ];
  const target = { id: employee.id, label: `${employee.firstName} ${employee.lastName}`.trim(), email: employee.email, isActive: employee.isActive };
  const cost = { id: currentRow?.id ?? "", updatedAt: currentRow?.updatedAt.toISOString() ?? "", exists: Boolean(currentRow) };
  return { employee: target, cost, values, changes, metrics, impacts, checks, warnings, blockingIssues, fingerprint: hash({ organizationId: input.organizationId, employee: target, cost, values, changes, impacts }) };
}

export async function executeEmployeeCostChange(input: { tx: Prisma.TransactionClient; organizationId: string; userId: string; changes: EmployeeCostValues; actorId: string; actorName: string; requestId: string; expectedFingerprint: string; source?: "jarvis" | "employee-cost-ui" }) {
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workpilot:employee-cost:${input.organizationId}:${input.userId}`}))`;
  const evaluation = await evaluateEmployeeCostChange({ organizationId: input.organizationId, userId: input.userId, changes: input.changes, db: input.tx });
  if (evaluation.fingerprint !== input.expectedFingerprint) throw new EmployeeCostManagementServiceError("stale_context", "Lohnkostenstand, Mitarbeiter oder historische Zeitwirkung haben sich geändert. Bitte öffne eine neue Vorschau.");
  if (evaluation.blockingIssues.length) throw new EmployeeCostManagementServiceError("conflict", evaluation.blockingIssues.join(" · "));
  const row = await input.tx.employeeCostCalculation.upsert({ where: { organizationId_userId: { organizationId: input.organizationId, userId: input.userId } }, create: { organizationId: input.organizationId, userId: input.userId, ...evaluation.values, updatedByUserId: input.actorId, updatedByName: input.actorName }, update: { ...evaluation.values, updatedByUserId: input.actorId, updatedByName: input.actorName } });
  await input.tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: input.actorId, action: "employee-cost.changed", entityType: "employeeCostCalculation", entityId: row.id, payload: { source: input.source ?? "jarvis", requestId: input.requestId, employeeId: input.userId, changes: evaluation.changes, metrics: evaluation.metrics } } });
  return row;
}
