import { describe, expect, it, vi } from "vitest";
import { allocateNextOfferNumber } from "./offer-number-allocation";

describe("allocateNextOfferNumber", () => {
  it("increments the highest number inside the caller's transaction", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        { offerNumber: "ANG-10104" },
        { offerNumber: "ANG-10117" },
        { offerNumber: "ANG-10099" },
      ]);

    const result = await allocateNextOfferNumber({ $queryRaw: queryRaw } as never, "org-1");

    expect(result).toBe("ANG-10118");
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(queryRaw.mock.calls[0][1]).toBe("org-1");
  });

  it("starts at ANG-10100 for an organization without offers", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([]);

    await expect(
      allocateNextOfferNumber({ $queryRaw: queryRaw } as never, "new-org")
    ).resolves.toBe("ANG-10100");
  });

});
