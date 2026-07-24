import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  organization: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
  absence: { findMany: vi.fn() },
}));
const authMock = vi.hoisted(() => ({ authenticate: vi.fn(), audit: vi.fn() }));

vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/oks-phone/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations/oks-phone/auth")>();
  return {
    ...actual,
    authenticateOksPhoneRequest: authMock.authenticate,
    auditOksPhoneRequest: authMock.audit,
  };
});

import { GET } from "./route";

const actor = {
  credentialId: "credential-1",
  credentialName: "OKS Phone",
  organizationId: "organization-a",
  keyId: "key-a",
  scopes: ["team-availability:read"],
};

const employee = {
  id: "user-1",
  email: "CHRISTIAN.EID@OK-SOLUTIONS.COM",
  firstName: "Christian",
  lastName: "Eid",
  planningStartTime: "08:00",
  planningEndTime: "17:00",
  weeklyCapacity: { monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 0, sunday: 0 },
};

describe("OKS Phone team availability endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.authenticate.mockResolvedValue(actor);
    authMock.audit.mockResolvedValue(undefined);
    prismaMock.organization.findUnique.mockResolvedValue({ timezone: "Europe/Berlin" });
    prismaMock.user.findMany
      .mockResolvedValueOnce([employee])
      .mockResolvedValueOnce([]);
    prismaMock.absence.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
  });

  it("rejects an invalid evaluation timestamp", async () => {
    const response = await GET(new Request("http://localhost/api/integrations/oks-phone/team-availability?at=invalid"));
    expect(response.status).toBe(400);
    expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
  });

  it("returns active organization users as available without an approved absence", async () => {
    const response = await GET(new Request("http://localhost/api/integrations/oks-phone/team-availability?at=2026-07-24T08:00:00.000Z"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.timeZone).toBe("Europe/Berlin");
    expect(payload.members).toEqual([expect.objectContaining({
      userId: "user-1",
      email: "christian.eid@ok-solutions.com",
      unavailable: false,
    })]);
  });

  it("returns an approved full-day vacation and its active representative", async () => {
    prismaMock.user.findMany
      .mockReset()
      .mockResolvedValueOnce([employee])
      .mockResolvedValueOnce([{
        id: "user-2",
        email: "vertretung@ok-solutions.com",
        firstName: "Ramona",
        lastName: "Eid",
      }]);
    prismaMock.absence.findMany
      .mockReset()
      .mockResolvedValueOnce([{
        userId: "user-1",
        requestGroupId: "absence-group-1",
        type: "urlaub",
        dayPart: "full",
        representativeUserId: "user-2",
      }])
      .mockResolvedValueOnce([{
        requestGroupId: "absence-group-1",
        date: new Date("2026-07-24T00:00:00.000Z"),
      }]);

    const response = await GET(new Request("http://localhost/api/integrations/oks-phone/team-availability?at=2026-07-24T08:00:00.000Z"));
    const payload = await response.json();
    expect(payload.members[0]).toEqual(expect.objectContaining({
      unavailable: true,
      reason: "Urlaub",
      representativeUserId: "user-2",
      representativeName: "Ramona Eid",
      representativeEmail: "vertretung@ok-solutions.com",
    }));
    expect(payload.members[0].availableAt).toBe("2026-07-27T06:00:00.000Z");
  });

  it("respects configured half-day work windows", async () => {
    prismaMock.absence.findMany
      .mockReset()
      .mockResolvedValueOnce([{
        userId: "user-1",
        requestGroupId: null,
        type: "ueberstundenabbau",
        dayPart: "second-half",
        representativeUserId: null,
      }]);

    const beforeMidpoint = await GET(new Request("http://localhost/api/integrations/oks-phone/team-availability?at=2026-07-24T08:00:00.000Z"));
    expect((await beforeMidpoint.json()).members[0].unavailable).toBe(false);

    prismaMock.user.findMany.mockReset().mockResolvedValueOnce([employee]).mockResolvedValueOnce([]);
    prismaMock.absence.findMany.mockReset().mockResolvedValueOnce([{
      userId: "user-1",
      requestGroupId: null,
      type: "ueberstundenabbau",
      dayPart: "second-half",
      representativeUserId: null,
    }]);
    const afterMidpoint = await GET(new Request("http://localhost/api/integrations/oks-phone/team-availability?at=2026-07-24T13:00:00.000Z"));
    expect((await afterMidpoint.json()).members[0].unavailable).toBe(true);
  });
});
