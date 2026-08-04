import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canDeleteContacts, canMarkContactsForDeletion } from "@/lib/permissions";

describe("contact deletion permissions", () => {
  it("allows deletion marking for management and sales", () => {
    expect(canMarkContactsForDeletion({ role: Role.GESCHAEFTSFUEHRER })).toBe(true);
    expect(canMarkContactsForDeletion({ role: Role.FUEHRUNGSKRAFT })).toBe(true);
    expect(canMarkContactsForDeletion({ role: Role.VERTRIEB })).toBe(true);
    expect(canMarkContactsForDeletion({ role: Role.MITARBEITER, salesRoleEnabled: true })).toBe(true);
  });

  it("reserves final deletion for managing directors", () => {
    expect(canDeleteContacts({ role: Role.GESCHAEFTSFUEHRER })).toBe(true);
    expect(canDeleteContacts({ role: Role.ADMIN })).toBe(false);
    expect(canDeleteContacts({ role: Role.FUEHRUNGSKRAFT })).toBe(false);
    expect(canDeleteContacts({ role: Role.VERTRIEB })).toBe(false);
  });
});
