import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PublicRequestSecurityError,
  createPublicRequestSessionToken,
  hasValidProofOfWork,
  hashPublicRequestSessionNonce,
  verifyPublicRequestSessionToken,
} from "./security";

const ORIGINAL_SECRET = process.env.ONLINE_REQUEST_SIGNING_SECRET;

describe("online request public security", () => {
  beforeEach(() => {
    process.env.ONLINE_REQUEST_SIGNING_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.ONLINE_REQUEST_SIGNING_SECRET;
    } else {
      process.env.ONLINE_REQUEST_SIGNING_SECRET = ORIGINAL_SECRET;
    }
  });

  it("binds a signed session to its portal and time window", () => {
    const now = new Date("2026-07-30T15:00:00.000Z");
    const session = createPublicRequestSessionToken({
      portalId: "portal-1",
      now,
      minimumFillTimeMs: 2_000,
      ttlMs: 60_000,
      difficulty: 10,
    });

    expect(() =>
      verifyPublicRequestSessionToken(session.token, {
        now: new Date(now.getTime() + 1_000),
        expectedPortalId: "portal-1",
      })
    ).toThrowError(PublicRequestSecurityError);

    expect(
      verifyPublicRequestSessionToken(session.token, {
        now: new Date(now.getTime() + 2_001),
        expectedPortalId: "portal-1",
      }).sessionNonce
    ).toBe(session.payload.sessionNonce);
    expect(session.idHash).toBe(hashPublicRequestSessionNonce(session.payload.sessionNonce));
  });

  it("rejects tampering, the wrong portal and expired sessions", () => {
    const now = new Date("2026-07-30T15:00:00.000Z");
    const session = createPublicRequestSessionToken({
      portalId: "portal-1",
      now,
      minimumFillTimeMs: 0,
      ttlMs: 1_000,
      difficulty: 10,
    });

    expect(() =>
      verifyPublicRequestSessionToken(`${session.token}x`, { now })
    ).toThrowError(PublicRequestSecurityError);
    expect(() =>
      verifyPublicRequestSessionToken(session.token, {
        now,
        expectedPortalId: "portal-2",
      })
    ).toThrowError(PublicRequestSecurityError);
    expect(() =>
      verifyPublicRequestSessionToken(session.token, {
        now: new Date(now.getTime() + 1_001),
      })
    ).toThrowError(PublicRequestSecurityError);
  });

  it("verifies a bounded SHA-256 proof", () => {
    let proof = 0;
    while (
      !hasValidProofOfWork({
        challenge: "fixed-challenge",
        proof: String(proof),
        difficulty: 10,
      })
    ) {
      proof += 1;
    }

    expect(
      hasValidProofOfWork({
        challenge: "fixed-challenge",
        proof: String(proof),
        difficulty: 10,
      })
    ).toBe(true);
    expect(
      hasValidProofOfWork({
        challenge: "fixed-challenge",
        proof: "not-a-number",
        difficulty: 10,
      })
    ).toBe(false);
  });
});
