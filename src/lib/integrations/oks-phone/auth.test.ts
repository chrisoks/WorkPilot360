import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  oksPhoneIntegrationCredential: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  oksPhoneRateLimitBucket: {
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  authenticateOksPhoneRequest,
  hashOksPhoneCredentialSecret,
  OksPhoneAuthError,
  OKS_PHONE_SCOPES,
} from "./auth";

describe("OKS Phone service authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.oksPhoneRateLimitBucket.upsert.mockResolvedValue({ requestCount: 1 });
    prismaMock.oksPhoneIntegrationCredential.update.mockResolvedValue({});
  });

  it("rejects missing or malformed bearer credentials before a database lookup", async () => {
    await expect(
      authenticateOksPhoneRequest(new Request("http://localhost/test"), OKS_PHONE_SCOPES.customerContextRead)
    ).rejects.toMatchObject({ status: 401 } satisfies Partial<OksPhoneAuthError>);
    expect(prismaMock.oksPhoneIntegrationCredential.findUnique).not.toHaveBeenCalled();
  });

  it("binds the actor to the credential organization and required scope", async () => {
    prismaMock.oksPhoneIntegrationCredential.findUnique.mockResolvedValue({
      id: "credential-1",
      organizationId: "organization-a",
      keyId: "key-a",
      name: "OKS Phone",
      secretHash: hashOksPhoneCredentialSecret("secret-a"),
      scopes: [OKS_PHONE_SCOPES.customerContextRead],
      isActive: true,
      rateLimitPerMinute: 60,
    });

    const actor = await authenticateOksPhoneRequest(
      new Request("http://localhost/test", { headers: { authorization: "Bearer key-a.secret-a" } }),
      OKS_PHONE_SCOPES.customerContextRead
    );

    expect(actor.organizationId).toBe("organization-a");
    expect(prismaMock.oksPhoneRateLimitBucket.upsert).toHaveBeenCalledOnce();
  });

  it("rejects a valid credential without the endpoint scope", async () => {
    prismaMock.oksPhoneIntegrationCredential.findUnique.mockResolvedValue({
      id: "credential-1",
      organizationId: "organization-a",
      keyId: "key-a",
      name: "OKS Phone",
      secretHash: hashOksPhoneCredentialSecret("secret-a"),
      scopes: [OKS_PHONE_SCOPES.contactsDeltaRead],
      isActive: true,
      rateLimitPerMinute: 60,
    });

    await expect(
      authenticateOksPhoneRequest(
        new Request("http://localhost/test", { headers: { authorization: "Bearer key-a.secret-a" } }),
        OKS_PHONE_SCOPES.customerContextRead
      )
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<OksPhoneAuthError>);
  });

  it("enforces the persistent per-credential rate limit", async () => {
    prismaMock.oksPhoneIntegrationCredential.findUnique.mockResolvedValue({
      id: "credential-1",
      organizationId: "organization-a",
      keyId: "key-a",
      name: "OKS Phone",
      secretHash: hashOksPhoneCredentialSecret("secret-a"),
      scopes: [OKS_PHONE_SCOPES.customerContextRead],
      isActive: true,
      rateLimitPerMinute: 1,
    });
    prismaMock.oksPhoneRateLimitBucket.upsert.mockResolvedValue({ requestCount: 2 });

    await expect(
      authenticateOksPhoneRequest(
        new Request("http://localhost/test", { headers: { authorization: "Bearer key-a.secret-a" } }),
        OKS_PHONE_SCOPES.customerContextRead
      )
    ).rejects.toMatchObject({ status: 429 } satisfies Partial<OksPhoneAuthError>);
  });
});
