import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  OFFER_ACCEPTANCE_CONSENT,
  createAcceptanceCertificate,
  createAcceptanceToken,
  createWithdrawalNotice,
  createWithdrawalReceipt,
  hashAcceptanceValue,
} from "./core";

describe("offer acceptance evidence", () => {
  it("creates unpredictable tokens and stable SHA-256 hashes", () => {
    const first = createAcceptanceToken();
    const second = createAcceptanceToken();
    expect(first).toHaveLength(64);
    expect(second).toHaveLength(64);
    expect(first).not.toBe(second);
    expect(hashAcceptanceValue(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashAcceptanceValue(first)).toBe(hashAcceptanceValue(first));
  });

  it("creates a readable one-page acceptance certificate", async () => {
    const result = await createAcceptanceCertificate({
      offerNumber: "ANG-1001",
      customerName: "Musterkunde GmbH",
      projectNumber: "PR-42",
      projectTitle: "Testprojekt",
      grossTotal: 1190,
      acceptedByName: "Erika Muster",
      acceptedByRole: "Geschäftsführung",
      acceptedByEmail: "erika@example.com",
      acceptedAt: new Date("2026-07-22T12:00:00.000Z"),
      offerVersionHash: "a".repeat(64),
      acceptanceId: "acceptance-test",
      consentText: OFFER_ACCEPTANCE_CONSENT,
    });
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    const pdf = await PDFDocument.load(Buffer.from(result.base64, "base64"));
    expect(pdf.getPageCount()).toBe(1);
  });

  it("creates immutable consumer withdrawal documents", async () => {
    const notice = await createWithdrawalNotice({
      seller: {
        name: "OK solutions GmbH",
        street: "Im Krötenteich 3/4",
        postalCode: "74722",
        city: "Buchen",
        country: "Deutschland",
        phone: "+49 6281 3263110",
        email: "angebot@example.com",
      },
      offerNumber: "ANG-1001",
      withdrawalUrl: "https://example.com/angebot/token",
    });
    const receipt = await createWithdrawalReceipt({
      offerNumber: "ANG-1001",
      customerName: "Erika Muster",
      projectNumber: "PR-42",
      withdrawnByName: "Erika Muster",
      withdrawnByEmail: "erika@example.com",
      withdrawnAt: new Date("2026-07-24T12:00:00.000Z"),
      acceptanceId: "acceptance-test",
      offerVersionHash: "a".repeat(64),
    });
    expect(notice.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.hash).toMatch(/^[a-f0-9]{64}$/);
    expect((await PDFDocument.load(Buffer.from(notice.base64, "base64"))).getPageCount()).toBe(2);
    expect((await PDFDocument.load(Buffer.from(receipt.base64, "base64"))).getPageCount()).toBe(1);
  });
});
