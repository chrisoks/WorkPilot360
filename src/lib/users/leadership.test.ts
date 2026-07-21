import { describe, expect, it } from "vitest";
import {
  getLeadershipRecipientId,
  getLeadershipRecipientIds,
  getLeadershipStructureError,
} from "./leadership";

describe("Führungszuordnung", () => {
  it("verlangt bei neuen Nicht-Geschäftsführern eine Führungskraft", () => {
    expect(
      getLeadershipStructureError({
        managerId: null,
        deputyId: null,
        requireManager: true,
      })
    ).toBe("Bitte eine zuständige Führungskraft auswählen.");
  });

  it("erlaubt Geschäftsführern eine leere Zuordnung", () => {
    expect(
      getLeadershipStructureError({
        managerId: null,
        deputyId: null,
        requireManager: false,
      })
    ).toBeNull();
  });

  it("verhindert dieselbe Person als Führungskraft und Vertretung", () => {
    expect(
      getLeadershipStructureError({
        managerId: "lead-1",
        deputyId: "lead-1",
        requireManager: true,
      })
    ).toBe("Führungskraft und Vertretung müssen unterschiedliche Personen sein.");
  });

  it("verhindert die Selbstzuordnung", () => {
    expect(
      getLeadershipStructureError({
        employeeId: "employee-1",
        managerId: "employee-1",
        deputyId: null,
        requireManager: true,
      })
    ).toBe("Ein Mitarbeiter kann nicht die eigene Führungskraft oder Vertretung sein.");
  });

  it("verhindert einen Führungskreis über mehrere Ebenen", () => {
    const managerByUserId = new Map<string, string | null>([
      ["lead-1", "lead-2"],
      ["lead-2", "employee-1"],
    ]);

    expect(
      getLeadershipStructureError({
        employeeId: "employee-1",
        managerId: "lead-1",
        deputyId: null,
        requireManager: true,
        managerByUserId,
      })
    ).toBe("Diese Zuordnung würde einen Führungskreis erzeugen.");
  });
});

describe("Führungsempfänger", () => {
  const users = [
    {
      id: "employee-1",
      role: "MITARBEITER",
      isActive: true,
      leadershipManagerId: "lead-1",
      leadershipDeputyId: "deputy-1",
    },
    { id: "lead-1", role: "FUEHRUNGSKRAFT", isActive: true },
    { id: "deputy-1", role: "MITARBEITER", isActive: true },
  ];

  it("adressiert die aktive persönliche Führungskraft", () => {
    expect(getLeadershipRecipientId("employee-1", users)).toBe("lead-1");
  });

  it("nimmt die Vertretung nicht parallel zur Führungskraft auf", () => {
    expect(getLeadershipRecipientIds(["employee-1"], users)).toEqual(["lead-1"]);
  });

  it("verwendet die aktive Vertretung, wenn die Führungskraft ausfällt", () => {
    const usersWithInactiveManager = users.map((user) =>
      user.id === "lead-1" ? { ...user, isActive: false } : user
    );
    expect(getLeadershipRecipientId("employee-1", usersWithInactiveManager)).toBe(
      "deputy-1"
    );
  });

  it("ignoriert eine Person ohne Führungsrolle als Führungskraft", () => {
    const usersWithInvalidManager = users.map((user) =>
      user.id === "lead-1" ? { ...user, role: "MITARBEITER" } : user
    );
    expect(getLeadershipRecipientId("employee-1", usersWithInvalidManager)).toBe(
      "deputy-1"
    );
  });
});
