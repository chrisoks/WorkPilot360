import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const { getAuthenticatedSessionUser } = vi.hoisted(() => ({
  getAuthenticatedSessionUser: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthenticatedSessionUser }));

import { getSessionBoundActor } from "../src/lib/auth/actor";

const users = [
  { id: "user-1", role: Role.MITARBEITER, isActive: true },
  { id: "user-2", role: Role.MITARBEITER, isActive: true },
];
const request = new Request("https://workpilot360.example/api/tasks");

describe("401 und 403 bei sitzungsgebundenen Fachrouten", () => {
  beforeEach(() => vi.clearAllMocks());

  it("liefert 401 ohne gueltige Sitzung", async () => {
    getAuthenticatedSessionUser.mockResolvedValue(null);
    await expect(getSessionBoundActor(request, users, "user-1")).resolves.toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("liefert 403 bei unerlaubtem Handeln als anderer Benutzer", async () => {
    getAuthenticatedSessionUser.mockResolvedValue({ id: "user-1", role: Role.MITARBEITER });
    await expect(getSessionBoundActor(request, users, "user-2")).resolves.toMatchObject({
      ok: false,
      status: 403,
    });
  });
});
