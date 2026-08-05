import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  canReadAllSalesJournalEntries,
  isSalesJournalActivityType,
  normalizeSalesJournalDays,
  resolveSalesJournalOwnerScope,
} from "./sales-journal";

describe("sales journal access scope", () => {
  it("allows only the Geschäftsführung to read all employees", () => {
    expect(canReadAllSalesJournalEntries(Role.GESCHAEFTSFUEHRER)).toBe(true);
    expect(canReadAllSalesJournalEntries(Role.ADMIN)).toBe(false);
    expect(canReadAllSalesJournalEntries(Role.FUEHRUNGSKRAFT)).toBe(false);
    expect(canReadAllSalesJournalEntries(Role.VERTRIEB)).toBe(false);
    expect(canReadAllSalesJournalEntries(Role.MITARBEITER)).toBe(false);
  });

  it("forces non-executives onto their own entries", () => {
    expect(resolveSalesJournalOwnerScope({
      actorId: "employee-1",
      actorRole: Role.FUEHRUNGSKRAFT,
      requestedOwnerId: "employee-2",
    })).toBe("employee-1");
    expect(resolveSalesJournalOwnerScope({
      actorId: "executive-1",
      actorRole: Role.GESCHAEFTSFUEHRER,
      requestedOwnerId: "employee-2",
    })).toBe("employee-2");
  });
});

describe("sales journal input", () => {
  it("accepts only the deliberately small activity catalog", () => {
    expect(isSalesJournalActivityType("call")).toBe(true);
    expect(isSalesJournalActivityType("time_tracking")).toBe(false);
    expect(isSalesJournalActivityType("follow_up_task")).toBe(false);
  });

  it("keeps the query period bounded", () => {
    expect(normalizeSalesJournalDays(undefined)).toBe(30);
    expect(normalizeSalesJournalDays(0)).toBe(1);
    expect(normalizeSalesJournalDays(999)).toBe(365);
  });
});
