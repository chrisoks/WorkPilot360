import { describe, expect, it } from "vitest";
import { parseCustomerFeedbackRating } from "./rating";

describe("parseCustomerFeedbackRating", () => {
  it.each([1, 2, 3, 4, 5])("accepts the valid star rating %s", (rating) => {
    expect(parseCustomerFeedbackRating(rating)).toBe(rating);
  });

  it.each([undefined, null, true, "", 0, 6, 3.5, "not-a-rating"])(
    "rejects the invalid rating %s",
    (rating) => {
      expect(parseCustomerFeedbackRating(rating)).toBeNull();
    }
  );

  it("accepts integer form values", () => {
    expect(parseCustomerFeedbackRating("4")).toBe(4);
  });
});
