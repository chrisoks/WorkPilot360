import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const { authenticateSession, getAuthenticatedSessionUser } = vi.hoisted(() => ({
  authenticateSession: vi.fn(),
  getAuthenticatedSessionUser: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  authenticateSession,
  getAuthenticatedSessionUser,
}));

import { getSessionBoundActor } from "../src/lib/auth/actor";

const users = [
  { id: "user-1", role: Role.MITARBEITER, isActive: true },
  { id: "user-2", role: Role.MITARBEITER, isActive: true },
];
const request = new Request("https://workpilot360.example/api/tasks");

describe("401 und 403 bei sitzungsgebundenen Fachrouten", () => {
  beforeEach(() => vi.clearAllMocks());

  it("liefert 401 ohne gueltige Sitzung", async () => {
    authenticateSession.mockResolvedValue(null);
    await expect(getSessionBoundActor(request, users, "user-1")).resolves.toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("liefert 403 bei unerlaubtem Handeln als anderer Benutzer", async () => {
    authenticateSession.mockResolvedValue({
      user: { id: "user-1", role: Role.MITARBEITER },
      session: { id: "session-1" },
    });
    await expect(getSessionBoundActor(request, users, "user-2")).resolves.toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("liefert die serverseitige Session-ID nur bei gültiger Sitzung", async () => {
    authenticateSession.mockResolvedValue({
      user: { id: "user-1", role: Role.MITARBEITER },
      session: { id: "session-1" },
    });
    await expect(
      getSessionBoundActor(request, users, "user-1")
    ).resolves.toMatchObject({
      ok: true,
      sessionId: "session-1",
      sessionUserId: "user-1",
    });
  });
});
