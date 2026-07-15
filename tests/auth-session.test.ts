import { beforeEach, describe, expect, it, vi } from "vitest";

const { authSession, queryRaw } = vi.hoisted(() => ({
  authSession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    authSession,
    $queryRaw: queryRaw,
  },
}));

import {
  authenticateSession,
  createServerSessionToken,
  parseServerSessionToken,
  revokeSessionFromRequest,
  SESSION_ABSOLUTE_MAX_AGE_SECONDS,
  SESSION_IDLE_MAX_AGE_SECONDS,
} from "../src/lib/auth/session";

const NOW = new Date("2026-07-15T12:00:00.000Z");
const user = {
  id: "user-1",
  firstName: "Test",
  lastName: "Person",
  email: "test@example.com",
  role: "MITARBEITER",
  teamId: null,
  dailyWorkHours: 8,
  profileImageDataUrl: null,
  personalNumber: null,
};

function requestWithToken(token: string) {
  return new Request("https://workpilot360.example/api/auth/session", {
    headers: { cookie: `workpilot_session=${encodeURIComponent(token)}` },
  });
}

function activeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    userId: user.id,
    tokenVersion: 1,
    previousTokenVersion: null,
    previousValidUntil: null,
    createdAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
    lastSeenAt: NOW,
    lastRotatedAt: NOW,
    idleExpiresAt: new Date(NOW.getTime() + SESSION_IDLE_MAX_AGE_SECONDS * 1000),
    absoluteExpiresAt: new Date(NOW.getTime() + SESSION_ABSOLUTE_MAX_AGE_SECONDS * 1000),
    revokedAt: null,
    ...overrides,
  };
}

describe("serverseitige WorkPilot-Sitzungen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    queryRaw.mockResolvedValue([user]);
  });

  it("akzeptiert eine aktive Sitzung am Folgetag", async () => {
    authSession.findUnique.mockResolvedValue(activeSession());
    const token = createServerSessionToken("session-1", 1);

    const result = await authenticateSession(requestWithToken(token));

    expect(result?.user.id).toBe(user.id);
    expect(result?.legacy).toBe(false);
  });

  it("rotiert eine fällige Sitzung und akzeptiert den Vorgänger kurz parallel", async () => {
    authSession.findUnique.mockResolvedValue(
      activeSession({ lastRotatedAt: new Date(NOW.getTime() - 13 * 60 * 60 * 1000) })
    );
    authSession.updateMany.mockResolvedValue({ count: 1 });
    const oldToken = createServerSessionToken("session-1", 1);

    const rotated = await authenticateSession(requestWithToken(oldToken), { rotate: true });

    expect(parseServerSessionToken(rotated?.replacementToken || "")?.version).toBe(2);

    authSession.findUnique.mockResolvedValue(
      activeSession({
        tokenVersion: 2,
        previousTokenVersion: 1,
        previousValidUntil: new Date(NOW.getTime() + 30_000),
      })
    );
    const parallel = await authenticateSession(requestWithToken(oldToken), { rotate: true });

    expect(parallel?.user.id).toBe(user.id);
    expect(parseServerSessionToken(parallel?.replacementToken || "")?.version).toBe(2);
  });

  it("lehnt abgelaufene und widerrufene Sitzungen ab", async () => {
    const token = createServerSessionToken("session-1", 1);
    authSession.findUnique.mockResolvedValueOnce(
      activeSession({ idleExpiresAt: new Date(NOW.getTime() - 1) })
    );
    await expect(authenticateSession(requestWithToken(token))).resolves.toBeNull();

    authSession.findUnique.mockResolvedValueOnce(activeSession({ revokedAt: NOW }));
    await expect(authenticateSession(requestWithToken(token))).resolves.toBeNull();
  });

  it("widerruft beim Logout den serverseitigen Sitzungsdatensatz", async () => {
    authSession.updateMany.mockResolvedValue({ count: 1 });
    const token = createServerSessionToken("session-1", 1);

    await expect(revokeSessionFromRequest(requestWithToken(token))).resolves.toBe(true);
    expect(authSession.updateMany).toHaveBeenCalledWith({
      where: { id: "session-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
