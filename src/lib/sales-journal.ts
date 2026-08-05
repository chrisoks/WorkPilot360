import { Role } from "@prisma/client";

export const salesJournalActivityTypes = [
  "call",
  "email",
  "customer_meeting",
  "offer",
  "offer_follow_up",
  "other",
] as const;

export type SalesJournalActivityType = (typeof salesJournalActivityTypes)[number];

export const salesJournalActivityLabels: Record<SalesJournalActivityType, string> = {
  call: "Telefonat",
  email: "E-Mail",
  customer_meeting: "Kundentermin",
  offer: "Angebot",
  offer_follow_up: "Angebot nachgefasst",
  other: "Sonstige Vertriebsaktivität",
};

export function isSalesJournalActivityType(value: unknown): value is SalesJournalActivityType {
  return typeof value === "string" && salesJournalActivityTypes.includes(value as SalesJournalActivityType);
}

export function canReadAllSalesJournalEntries(role: Role | string | undefined) {
  return role === Role.GESCHAEFTSFUEHRER;
}

export function resolveSalesJournalOwnerScope(input: {
  actorId: string;
  actorRole: Role | string;
  requestedOwnerId?: string | null;
}) {
  const requestedOwnerId = input.requestedOwnerId?.trim() || "";
  if (canReadAllSalesJournalEntries(input.actorRole)) return requestedOwnerId;
  return input.actorId;
}

export function normalizeSalesJournalDays(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(365, Math.max(1, Math.round(parsed)));
}
