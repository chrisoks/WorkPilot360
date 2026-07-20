import { describe, expect, it } from "vitest";
import { decodeDeltaCursor, encodeDeltaCursor } from "./delta";

describe("OKS Phone delta cursor", () => {
  it("round-trips an opaque cursor", () => {
    const cursor = { occurredAt: "2026-07-20T12:34:56.000Z", id: "event-1" };
    expect(decodeDeltaCursor(encodeDeltaCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed cursors", () => {
    expect(decodeDeltaCursor("not-a-cursor")).toBeNull();
    expect(decodeDeltaCursor(Buffer.from(JSON.stringify({ id: "x" })).toString("base64url"))).toBeNull();
  });
});
