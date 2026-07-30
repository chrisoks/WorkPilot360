import { describe, expect, it } from "vitest";
import {
  filterOnlineRequests,
  resolveVisibleOnlineRequest,
  type OnlineRequestViewItem,
} from "./online-requests-workspace";

function request(
  overrides: Partial<OnlineRequestViewItem> = {}
): OnlineRequestViewItem {
  return {
    id: "request-1",
    referenceNumber: "ONL-2026-0001",
    status: "new",
    requestType: "offer",
    tradeId: "trade-1",
    tradeName: "Glas- und Fensterreinigung",
    recommendationTradeIds: [],
    recommendationNames: [],
    desiredDate: null,
    desiredTimeWindow: null,
    callbackTimeWindow: null,
    urgency: null,
    street: "Musterstraße 1",
    postalCode: "30159",
    city: "Hannover",
    objectHint: null,
    description: "Fenster und Rahmen reinigen",
    customerKind: "private",
    company: null,
    firstName: "Jörg",
    lastName: "Müller",
    email: "joerg@example.test",
    phone: null,
    preferredContact: "email",
    assignedUserId: null,
    matchedContactId: null,
    customerDecision: "unreviewed",
    convertedProjectId: null,
    handledAt: "",
    convertedAt: "",
    createdAt: "2026-07-30T10:00:00.000Z",
    updatedAt: "2026-07-30T10:00:00.000Z",
    photos: [],
    auditEvents: [],
    ...overrides,
  };
}

describe("filterOnlineRequests", () => {
  const requests = [
    request(),
    request({
      id: "request-2",
      referenceNumber: "ONL-2026-0002",
      status: "converted",
      tradeName: "Winterdienst",
      firstName: "Anna",
      lastName: "Schmidt",
    }),
  ];

  it("keeps the default active view focused on actionable requests", () => {
    expect(filterOnlineRequests(requests, "active", "")).toHaveLength(1);
    expect(filterOnlineRequests(requests, "all", "")).toHaveLength(2);
  });

  it("searches references, contacts, services and descriptions accent-insensitively", () => {
    expect(filterOnlineRequests(requests, "all", "muller")[0]?.id).toBe(
      "request-1"
    );
    expect(filterOnlineRequests(requests, "all", "winterdienst")[0]?.id).toBe(
      "request-2"
    );
    expect(filterOnlineRequests(requests, "all", "rahmen")[0]?.id).toBe(
      "request-1"
    );
  });

  it("does not keep a hidden converted request selected in the active inbox", () => {
    const activeRequests = filterOnlineRequests(requests, "active", "");

    expect(resolveVisibleOnlineRequest(activeRequests, "request-2")?.id).toBe(
      "request-1"
    );
    expect(
      resolveVisibleOnlineRequest(
        filterOnlineRequests([requests[1]], "active", ""),
        "request-2"
      )
    ).toBeUndefined();
  });
});
