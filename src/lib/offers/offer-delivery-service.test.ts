import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  offerFindFirst: vi.fn(),
  userFindFirst: vi.fn(),
  contactFindMany: vi.fn(),
  queryRaw: vi.fn(),
  dispatchFindFirst: vi.fn(),
  getTemplates: vi.fn(),
  sendDocumentMailRequest: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    offer: { findFirst: mocks.offerFindFirst },
    user: { findFirst: mocks.userFindFirst },
    contact: { findMany: mocks.contactFindMany },
    documentMailDispatch: { findFirst: mocks.dispatchFindFirst },
    $queryRaw: mocks.queryRaw,
  },
}));
vi.mock("@/lib/company-settings/mail-templates", () => ({
  getDocumentMailTemplates: mocks.getTemplates,
}));
vi.mock("@/app/api/document-mail/route", () => ({
  POST: mocks.sendDocumentMailRequest,
}));

import {
  evaluateOfferDelivery,
  getOfferDeliveryConfirmationText,
  matchesOfferDeliveryConfirmation,
  normalizeOfferDeliveryPayload,
  OfferDeliveryServiceError,
  sendOfferDelivery,
} from "@/lib/offers/offer-delivery-service";

const offer = {
  id: "offer-1",
  organizationId: "org-1",
  projectId: "project-1",
  projectNumber: "GLR-449",
  projectTitle: "Glasreinigung",
  company: "OK solutions",
  offerNumber: "ANG-10124",
  status: "Erstellt",
  customerName: "Musterkunde GmbH",
  netTotal: 100,
  grossTotal: 119,
  pdfData: Buffer.from("final pdf").toString("base64"),
  updatedAt: new Date("2026-07-31T12:00:00.000Z"),
};

describe("offer delivery service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.offerFindFirst.mockResolvedValue(offer);
    mocks.userFindFirst.mockResolvedValue({
      id: "user-1",
      firstName: "Anna",
      lastName: "Leitung",
      email: "anna@example.test",
      mailAccount: {
        status: "connected",
        email: "anna@example.test",
        bcc: "archiv@example.test",
      },
    });
    mocks.queryRaw.mockResolvedValue([
      { contactId: "contact-1", contactPersonId: null, addressContactId: null },
    ]);
    mocks.contactFindMany.mockResolvedValue([
      {
        id: "contact-1",
        companyName: "Musterkunde GmbH",
        firstName: null,
        lastName: null,
        email: "kunde@example.test",
        invoiceEmail: null,
        isInvoiceRecipient: true,
        isMainContact: true,
      },
    ]);
    mocks.getTemplates.mockResolvedValue({
      offer: {
        subject: "Angebot {{number}}",
        body: "Hallo, anbei {{number}}.",
      },
    });
  });

  it("requires the exact offer, recipient and casing", () => {
    expect(
      getOfferDeliveryConfirmationText("ANG-10124", "kunde@example.test")
    ).toBe("SENDEN ANG-10124 AN kunde@example.test");
    expect(
      matchesOfferDeliveryConfirmation(
        "ANG-10124",
        "kunde@example.test",
        "SENDEN ANG-10124 AN kunde@example.test"
      )
    ).toBe(true);
    expect(
      matchesOfferDeliveryConfirmation(
        "ANG-10124",
        "kunde@example.test",
        "Senden ANG-10124 an kunde@example.test"
      )
    ).toBe(false);
  });

  it("normalizes unique recipients and validates mail fields", () => {
    expect(
      normalizeOfferDeliveryPayload({
        offerId: "offer-1",
        to: "kunde@example.test; kunde@example.test",
        cc: "leitung@example.test",
        subject: "Angebot",
        body: "Bitte prüfen.",
        includeAcceptanceLink: false,
      })
    ).toMatchObject({
      to: ["kunde@example.test"],
      cc: ["leitung@example.test"],
      includeAcceptanceLink: false,
    });
  });

  it("binds final PDF, recipient, sender and side-effect boundaries", async () => {
    const result = await evaluateOfferDelivery({
      organizationId: "org-1",
      actorUserId: "user-1",
      offerId: "offer-1",
    });
    expect(result.blockingIssues).toEqual([]);
    expect(result.payload).toMatchObject({
      to: ["kunde@example.test"],
      bcc: ["archiv@example.test"],
      subject: "Angebot ANG-10124",
      includeAcceptanceLink: true,
    });
    expect(result.attachments[0]).toMatchObject({
      name: "ANG-10124.pdf",
      contentType: "application/pdf",
    });
    expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.checks.find((check) => check.key === "side-effects")?.detail)
      .toContain("Projektstatus bleiben unverändert");
  });

  it("blocks drafts, missing PDFs and disconnected senders", async () => {
    mocks.offerFindFirst.mockResolvedValue({
      ...offer,
      status: "Entwurf",
      pdfData: null,
    });
    mocks.userFindFirst.mockResolvedValue({
      id: "user-1",
      firstName: "Anna",
      lastName: "Leitung",
      email: "anna@example.test",
      mailAccount: {},
    });
    const result = await evaluateOfferDelivery({
      organizationId: "org-1",
      actorUserId: "user-1",
      offerId: "offer-1",
    });
    expect(result.blockingIssues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("nicht versandbereit"),
        "Das finale Angebots-PDF fehlt.",
        expect.stringContaining("Microsoft-365-Konto"),
      ])
    );
  });

  it("uses the existing document-mail workflow and verifies the dispatch", async () => {
    const evaluation = await evaluateOfferDelivery({
      organizationId: "org-1",
      actorUserId: "user-1",
      offerId: "offer-1",
    });
    mocks.sendDocumentMailRequest.mockResolvedValue(
      Response.json({ id: "dispatch-1", status: "sent" })
    );
    mocks.dispatchFindFirst.mockResolvedValue({
      id: "dispatch-1",
      status: "sent",
    });
    const result = await sendOfferDelivery({
      organizationId: "org-1",
      actorUserId: "user-1",
      dispatchId: "dispatch-1",
      offerId: "offer-1",
      payload: evaluation.payload,
      expectedFingerprint: evaluation.fingerprint,
      request: new Request("https://workpilot.example/api/jarvis/action-drafts/draft-1", {
        headers: { cookie: "workpilot_session=test" },
      }),
    });
    expect(result.dispatch.id).toBe("dispatch-1");
    const forwarded = mocks.sendDocumentMailRequest.mock.calls[0][0] as Request;
    expect(await forwarded.json()).toMatchObject({
      kind: "offer",
      documentId: "offer-1",
      dispatchKey: "dispatch-1",
      attachPdf: true,
      includeAcceptanceLink: true,
    });
  });

  it("refuses stale fingerprints before reaching Microsoft 365", async () => {
    const evaluation = await evaluateOfferDelivery({
      organizationId: "org-1",
      actorUserId: "user-1",
      offerId: "offer-1",
    });
    await expect(
      sendOfferDelivery({
        organizationId: "org-1",
        actorUserId: "user-1",
        dispatchId: "dispatch-1",
        offerId: "offer-1",
        payload: evaluation.payload,
        expectedFingerprint: "changed",
        request: new Request("https://workpilot.example/api/jarvis/action-drafts/draft-1"),
      })
    ).rejects.toBeInstanceOf(OfferDeliveryServiceError);
    expect(mocks.sendDocumentMailRequest).not.toHaveBeenCalled();
  });

  it("fails closed as uncertain when Microsoft 365 delivery was recorded but follow-up processing failed", async () => {
    const evaluation = await evaluateOfferDelivery({
      organizationId: "org-1",
      actorUserId: "user-1",
      offerId: "offer-1",
    });
    mocks.sendDocumentMailRequest.mockResolvedValue(
      Response.json({ error: "Historie konnte nicht geschrieben werden." }, { status: 502 })
    );
    mocks.dispatchFindFirst.mockResolvedValue({ status: "sent" });
    await expect(
      sendOfferDelivery({
        organizationId: "org-1",
        actorUserId: "user-1",
        dispatchId: "dispatch-1",
        offerId: "offer-1",
        payload: evaluation.payload,
        expectedFingerprint: evaluation.fingerprint,
        request: new Request("https://workpilot.example/api/jarvis/action-drafts/draft-1"),
      })
    ).rejects.toMatchObject({ code: "delivery_uncertain" });
  });
});
