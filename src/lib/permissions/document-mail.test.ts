import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canManageInvoices, canSendInvoiceDocuments } from "@/lib/permissions";

describe("invoice document mail permissions", () => {
  it("allows the sales base role and sales add-on role to send invoice documents", () => {
    expect(canSendInvoiceDocuments({ role: Role.VERTRIEB })).toBe(true);
    expect(
      canSendInvoiceDocuments({ role: Role.MITARBEITER, salesRoleEnabled: true })
    ).toBe(true);
  });

  it("does not grant invoice editing rights through the sales add-on role", () => {
    expect(canManageInvoices({ role: Role.VERTRIEB })).toBe(false);
    expect(canManageInvoices({ role: Role.MITARBEITER, salesRoleEnabled: true })).toBe(false);
  });

  it("keeps invoice document sending blocked for regular employees", () => {
    expect(canSendInvoiceDocuments({ role: Role.MITARBEITER })).toBe(false);
  });
});
