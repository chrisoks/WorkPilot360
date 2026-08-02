import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDemoContext: vi.fn(),
  getSessionBoundActor: vi.fn(),
  sessionBoundActorResponse: vi.fn(),
  createJarvisAccessProfile: vi.fn(),
  searchJarvisGuidedOptions: vi.fn(),
}));

vi.mock("@/lib/demo/context", () => ({ getDemoContext: mocks.getDemoContext }));
vi.mock("@/lib/auth/actor", () => ({
  getSessionBoundActor: mocks.getSessionBoundActor,
  sessionBoundActorResponse: mocks.sessionBoundActorResponse,
}));
vi.mock("@/lib/jarvis/security", () => ({ createJarvisAccessProfile: mocks.createJarvisAccessProfile }));
vi.mock("@/lib/jarvis/guided-search", () => ({ searchJarvisGuidedOptions: mocks.searchJarvisGuidedOptions }));

import { GET } from "@/app/api/jarvis/guided-search/route";

describe("GET /api/jarvis/guided-search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const actor = { id: "user-1", role: "GESCHAEFTSFUEHRER", isActive: true };
    mocks.getDemoContext.mockResolvedValue({ organization: { id: "org-1" }, users: [actor] });
    mocks.getSessionBoundActor.mockResolvedValue({ ok: true, sessionUserId: "user-1", actor });
    mocks.createJarvisAccessProfile.mockReturnValue({ sessionActor: actor, effectiveActor: actor, isImpersonating: false });
    mocks.searchJarvisGuidedOptions.mockResolvedValue([{ kind: "customer", id: "OKW", label: "OKW", detail: "1 offenes Projekt", projectCount: 1 }]);
  });

  it("binds the search to organization and effective actor", async () => {
    const response = await GET(new Request("http://localhost/api/jarvis/guided-search?actorId=user-1&kind=customer&query=OKW"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ results: [{ id: "OKW" }] });
    expect(mocks.searchJarvisGuidedOptions).toHaveBeenCalledWith({
      organizationId: "org-1",
      kind: "customer",
      query: "OKW",
      customer: "",
    });
  });

  it("rejects unknown search kinds before touching business data", async () => {
    const response = await GET(new Request("http://localhost/api/jarvis/guided-search?kind=secret"));
    expect(response.status).toBe(400);
    expect(mocks.searchJarvisGuidedOptions).not.toHaveBeenCalled();
  });

  it("keeps employees outside offer data search", async () => {
    const employee = { id: "user-1", role: "MITARBEITER", isActive: true };
    mocks.getDemoContext.mockResolvedValue({ organization: { id: "org-1" }, users: [employee] });
    mocks.getSessionBoundActor.mockResolvedValue({ ok: true, sessionUserId: "user-1", actor: employee });
    mocks.createJarvisAccessProfile.mockReturnValue({ sessionActor: employee, effectiveActor: employee, isImpersonating: false });
    const response = await GET(new Request("http://localhost/api/jarvis/guided-search?kind=customer"));
    expect(response.status).toBe(403);
    expect(mocks.searchJarvisGuidedOptions).not.toHaveBeenCalled();
  });
});
