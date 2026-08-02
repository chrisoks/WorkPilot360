import { createHash } from "node:crypto";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { normalizePhoneNumber } from "@/lib/phone/normalize";
import { roleHierarchy } from "@/lib/permissions";

type PersonnelDb = Prisma.TransactionClient | typeof prisma;
export type PersonnelManagementField = "firstName" | "lastName" | "email" | "role" | "personalNumber" | "phone" | "mobile" | "street" | "postalCode" | "city" | "planningBoard" | "planningGroup";
export type PersonnelManagementValues = Partial<Record<PersonnelManagementField, string>>;
export type PersonnelManagementEvaluation = {
  employee: { id: string; label: string; email: string; role: Role; isActive: boolean; updatedAt: string };
  values: Record<PersonnelManagementField, string>;
  changes: Array<{ field: PersonnelManagementField; label: string; before: string; after: string }>;
  impacts: Array<{ key: string; label: string; count: number }>;
  roleSessionsWillBeRevoked: boolean;
  checks: Array<{ key: string; label: string; status: "ok" | "warning" | "blocked"; detail: string }>;
  warnings: string[];
  blockingIssues: string[];
  fingerprint: string;
};

export class PersonnelManagementServiceError extends Error {
  constructor(public readonly code: "not_found" | "invalid_input" | "stale_context" | "conflict", message: string) { super(message); this.name = "PersonnelManagementServiceError"; }
}

const labels: Record<PersonnelManagementField, string> = { firstName: "Vorname", lastName: "Nachname", email: "Dienstliche E-Mail", role: "Rolle", personalNumber: "Personalnummer", phone: "Telefon", mobile: "Mobiltelefon", street: "Straße", postalCode: "Postleitzahl", city: "Ort", planningBoard: "Planungsboard", planningGroup: "Planungsgruppe" };
const clean = (value: unknown, max = 500) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const validRoles = new Set(Object.values(Role));
const roleLabel = (role: Role) => ({ ADMIN: "Admin", GESCHAEFTSFUEHRER: "Geschäftsführung", FUEHRUNGSKRAFT: "Führungskraft", VERTRIEB: "Vertrieb", BUCHHALTUNG: "Buchhaltung", MITARBEITER: "Mitarbeiter", GAST: "Gast" }[role]);
export const getPersonnelManagementConfirmationText = (email: string) => `MITARBEITER ÄNDERN ${clean(email, 320).toLowerCase()}`;

function phone(value: unknown, field: "Telefon" | "Mobiltelefon", blockingIssues: string[]) {
  const result = normalizePhoneNumber(value);
  if (result.kind === "invalid") blockingIssues.push(`${field}: ${result.reason}`);
  return result.kind === "valid" ? result.normalized : "";
}

export async function evaluatePersonnelChange(input: { organizationId: string; employeeId: string; actorId: string; actorRole: Role; changes: PersonnelManagementValues; db?: PersonnelDb }): Promise<PersonnelManagementEvaluation> {
  const db = input.db ?? prisma;
  const employee = await db.user.findFirst({ where: { id: clean(input.employeeId), organizationId: input.organizationId } });
  if (!employee) throw new PersonnelManagementServiceError("not_found", "Der Mitarbeiter wurde in der aktuellen Organisation nicht gefunden.");
  const blockingIssues: string[] = [];
  if (!employee.isActive) blockingIssues.push("Inaktive Mitarbeiter werden in diesem Schritt nicht bearbeitet. Nutze die normale Mitarbeiterverwaltung.");
  const current = {
    firstName: clean(employee.firstName), lastName: clean(employee.lastName), email: clean(employee.email).toLowerCase(), role: employee.role,
    personalNumber: clean(employee.personalNumber), phone: clean(employee.phone), mobile: clean(employee.mobile), street: clean(employee.street), postalCode: clean(employee.postalCode), city: clean(employee.city), planningBoard: clean(employee.planningBoard), planningGroup: clean(employee.planningGroup),
  };
  const requestedRole = Object.prototype.hasOwnProperty.call(input.changes, "role") ? clean(input.changes.role).toUpperCase() : current.role;
  if (!validRoles.has(requestedRole as Role) || requestedRole === Role.GAST) blockingIssues.push("Die Rolle ist ungültig oder als JARVIS-Personaländerung nicht freigegeben.");
  const nextRole = validRoles.has(requestedRole as Role) ? requestedRole as Role : current.role;
  if (nextRole !== current.role && employee.id === input.actorId) blockingIssues.push("Die eigene Rolle darf nicht über JARVIS geändert werden.");
  if (nextRole !== current.role && roleHierarchy[nextRole] > roleHierarchy[input.actorRole]) blockingIssues.push("Eine höhere Rolle als die des handelnden Akteurs darf nicht vergeben werden.");
  const values: Record<PersonnelManagementField, string> = {
    ...current,
    ...Object.fromEntries(Object.entries(input.changes).map(([field, value]) => [field, clean(value, field === "email" ? 320 : 500)])),
    email: Object.prototype.hasOwnProperty.call(input.changes, "email") ? clean(input.changes.email, 320).toLowerCase() : current.email,
    role: nextRole,
    phone: Object.prototype.hasOwnProperty.call(input.changes, "phone") ? phone(input.changes.phone, "Telefon", blockingIssues) : current.phone,
    mobile: Object.prototype.hasOwnProperty.call(input.changes, "mobile") ? phone(input.changes.mobile, "Mobiltelefon", blockingIssues) : current.mobile,
  } as Record<PersonnelManagementField, string>;
  if (!values.firstName || !values.lastName) blockingIssues.push("Vor- und Nachname müssen vollständig bleiben.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) blockingIssues.push("Eine gültige dienstliche E-Mail-Adresse ist erforderlich.");
  if (values.planningGroup && !values.planningBoard) blockingIssues.push("Eine Planungsgruppe benötigt ein Planungsboard.");
  const duplicates = await db.user.findMany({ where: { organizationId: input.organizationId, id: { not: employee.id }, OR: [{ email: { equals: values.email, mode: "insensitive" } }, ...(values.personalNumber ? [{ personalNumber: { equals: values.personalNumber, mode: "insensitive" as const } }] : [])] }, select: { id: true, email: true, personalNumber: true }, take: 5 });
  if (duplicates.length) blockingIssues.push("Dienstliche E-Mail oder Personalnummer ist bereits einem anderen Mitarbeiter zugeordnet.");
  const activeExecutiveCount = await db.user.count({ where: { organizationId: input.organizationId, isActive: true, role: Role.GESCHAEFTSFUEHRER } });
  if (employee.role === Role.GESCHAEFTSFUEHRER && nextRole !== Role.GESCHAEFTSFUEHRER && activeExecutiveCount <= 1) blockingIssues.push("Die letzte aktive Geschäftsführung darf nicht auf eine andere Rolle gesetzt werden.");
  const [sessions, ownedTasks, planningEntries, timeEntries] = await Promise.all([
    db.authSession.count({ where: { userId: employee.id } }), db.task.count({ where: { organizationId: input.organizationId, ownerId: employee.id, status: { notIn: ["ERLEDIGT", "ARCHIVIERT"] } } }),
    db.planningEntry.count({ where: { organizationId: input.organizationId, userId: employee.id } }), db.projectTimeEntry.count({ where: { organizationId: input.organizationId, userId: employee.id } }),
  ]);
  const fields = Object.keys(labels) as PersonnelManagementField[];
  const changes = fields.filter((field) => clean(current[field]) !== clean(values[field])).map((field) => ({ field, label: labels[field], before: field === "role" ? roleLabel(current.role) : current[field], after: field === "role" ? roleLabel(nextRole) : values[field] }));
  if (!changes.length) blockingIssues.push("Es wurde keine wirksame Personalstammdatenänderung erkannt.");
  const roleSessionsWillBeRevoked = nextRole !== current.role && sessions > 0;
  const impacts = [{ key: "sessions", label: "aktive Anmeldesitzungen", count: sessions }, { key: "tasks", label: "offene eigene Aufgaben", count: ownedTasks }, { key: "planning", label: "Planungseinträge", count: planningEntries }, { key: "times", label: "Projektzeiteinträge", count: timeEntries }];
  const warnings = ["Aufgaben, Planungen, Zeiten, Projekte und Dokumente werden nicht umverteilt oder geändert.", ...(roleSessionsWillBeRevoked ? ["Wegen des Rollenwechsels werden alle Anmeldesitzungen des Mitarbeiters beendet; eine neue Anmeldung ist erforderlich."] : [])];
  const checks: PersonnelManagementEvaluation["checks"] = [
    { key: "identity", label: "Eindeutiger Mitarbeiter", status: duplicates.length ? "blocked" : "ok", detail: `${values.firstName} ${values.lastName} · ${values.email}` },
    { key: "role", label: "Rollenänderung", status: blockingIssues.some((issue) => /Rolle|Geschäftsführung/.test(issue)) ? "blocked" : roleSessionsWillBeRevoked ? "warning" : "ok", detail: `${roleLabel(current.role)} → ${roleLabel(nextRole)}` },
    { key: "relations", label: "Bestehende Zuordnungen", status: impacts.some((impact) => impact.count > 0) ? "warning" : "ok", detail: impacts.filter((impact) => impact.count > 0).map((impact) => `${impact.label}: ${impact.count}`).join(", ") || "Keine operativen Zuordnungen." },
  ];
  const item = { id: employee.id, label: `${current.firstName} ${current.lastName}`.trim(), email: current.email, role: current.role, isActive: employee.isActive, updatedAt: employee.updatedAt.toISOString() };
  return { employee: item, values, changes, impacts, roleSessionsWillBeRevoked, checks, warnings, blockingIssues, fingerprint: hash({ organizationId: input.organizationId, employee: item, values, changes, impacts, activeExecutiveCount }) };
}

export async function executePersonnelChange(input: { tx: Prisma.TransactionClient; organizationId: string; employeeId: string; actorId: string; actorRole: Role; changes: PersonnelManagementValues; requestId: string; expectedFingerprint: string }) {
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workpilot:personnel:${input.organizationId}:${input.employeeId}`}))`;
  const evaluation = await evaluatePersonnelChange({ ...input, db: input.tx });
  if (evaluation.fingerprint !== input.expectedFingerprint) throw new PersonnelManagementServiceError("stale_context", "Mitarbeiterstand, Rolle oder Zuordnungen haben sich geändert. Bitte öffne eine neue Vorschau.");
  if (evaluation.blockingIssues.length) throw new PersonnelManagementServiceError("conflict", evaluation.blockingIssues.join(" · "));
  const values = evaluation.values;
  const updated = await input.tx.user.updateMany({ where: { id: input.employeeId, organizationId: input.organizationId, updatedAt: new Date(evaluation.employee.updatedAt) }, data: { firstName: values.firstName, lastName: values.lastName, email: values.email, role: values.role as Role, personalNumber: values.personalNumber || null, phone: values.phone || null, mobile: values.mobile || null, street: values.street || null, postalCode: values.postalCode || null, city: values.city || null, planningBoard: values.planningBoard || null, planningGroup: values.planningGroup || null } });
  if (updated.count !== 1) throw new PersonnelManagementServiceError("conflict", "Der Mitarbeiter wurde zwischenzeitlich geändert.");
  if (evaluation.roleSessionsWillBeRevoked) await input.tx.authSession.deleteMany({ where: { userId: input.employeeId } });
  await input.tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: input.actorId, action: "personnel.changed", entityType: "user", entityId: input.employeeId, payload: { source: "jarvis", requestId: clean(input.requestId, 120), changes: evaluation.changes, sessionsRevoked: evaluation.roleSessionsWillBeRevoked } } });
  return input.tx.user.findUniqueOrThrow({ where: { id: input.employeeId } });
}
