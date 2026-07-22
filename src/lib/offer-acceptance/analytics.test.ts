import { describe, expect, it } from "vitest";
import { getOfferAcceptanceFunnel, getLatestOfferAcceptances } from "./analytics";

const inJuly = (value: string) => value.startsWith("2026-07-");

describe("offer acceptance analytics", () => {
  it("uses only the newest request per offer", () => {
    const rows = [
      { id: "old", offerId: "offer-1", status: "revoked", createdAt: "2026-07-01T10:00:00Z", sentAt: "2026-07-01T10:00:00Z", firstViewedAt: "2026-07-01T11:00:00Z" },
      { id: "new", offerId: "offer-1", status: "sent", createdAt: "2026-07-02T10:00:00Z", sentAt: "2026-07-02T10:00:00Z" },
      { id: "other", offerId: "offer-2", status: "viewed", createdAt: "2026-07-03T10:00:00Z", sentAt: "2026-07-03T10:00:00Z", firstViewedAt: "2026-07-03T11:00:00Z" },
    ];

    expect(getLatestOfferAcceptances(rows).map((row) => row.id)).toEqual(["other", "new"]);
  });

  it("calculates opening, acceptance and open-viewed offers without double counting views", () => {
    const rows = [
      { id: "viewed", offerId: "offer-1", status: "viewed", sentAt: "2026-07-03T10:00:00Z", firstViewedAt: "2026-07-03T11:00:00Z", expiresAt: "2026-08-03T10:00:00Z" },
      { id: "accepted", offerId: "offer-2", status: "accepted", sentAt: "2026-07-04T10:00:00Z", firstViewedAt: "2026-07-04T11:00:00Z", acceptedAt: "2026-07-04T12:00:00Z" },
      { id: "unopened", offerId: "offer-3", status: "sent", sentAt: "2026-07-05T10:00:00Z" },
      { id: "withdrawn", offerId: "offer-4", status: "withdrawn", sentAt: "2026-07-06T10:00:00Z", firstViewedAt: "2026-07-06T11:00:00Z", acceptedAt: "2026-07-06T12:00:00Z", withdrawnAt: "2026-07-07T12:00:00Z" },
    ];

    const result = getOfferAcceptanceFunnel(rows, { isInPeriod: inJuly, now: new Date("2026-07-22T10:00:00Z") });
    expect(result.sent).toHaveLength(4);
    expect(result.viewed).toHaveLength(3);
    expect(result.accepted).toHaveLength(1);
    expect(result.viewedOpen.map((row) => row.id)).toEqual(["viewed"]);
    expect(result.openingRate).toBe(75);
    expect(result.acceptanceRate).toBe(25);
  });
});
