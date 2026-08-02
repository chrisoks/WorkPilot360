import { Role, type User } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { resolveProjectResponsibleUser } from "@/lib/projects/status-escalation";

function user(input: {
  id: string;
  firstName: string;
  lastName: string;
  isActive?: boolean;
}) {
  return {
    id: input.id,
    firstName: input.firstName,
    lastName: input.lastName,
    email: `${input.id}@example.test`,
    role: Role.MITARBEITER,
    isActive: input.isActive ?? true,
  } as User;
}

describe("project-status responsible recipient resolution", () => {
  it("resolves exactly one active user with normalized spacing and casing", () => {
    const result = resolveProjectResponsibleUser(
      [user({ id: "one", firstName: "Max", lastName: "Mustermann" })],
      "  max   MUSTERMANN "
    );
    expect(result).toMatchObject({
      user: { id: "one" },
      resolution: "matched",
      matchCount: 1,
    });
  });

  it("does not resolve an empty, unknown or inactive responsibility", () => {
    const inactive = user({
      id: "inactive",
      firstName: "Max",
      lastName: "Mustermann",
      isActive: false,
    });
    expect(resolveProjectResponsibleUser([inactive], "")).toMatchObject({
      user: null,
      resolution: "missing",
      matchCount: 0,
    });
    expect(resolveProjectResponsibleUser([inactive], "Max Mustermann")).toMatchObject({
      user: null,
      resolution: "missing",
      matchCount: 0,
    });
  });

  it("fails closed when more than one active user has the same name", () => {
    const result = resolveProjectResponsibleUser(
      [
        user({ id: "one", firstName: "Max", lastName: "Mustermann" }),
        user({ id: "two", firstName: "Max", lastName: "Mustermann" }),
      ],
      "Max Mustermann"
    );
    expect(result).toEqual({
      user: null,
      resolution: "ambiguous",
      matchCount: 2,
    });
  });
});
