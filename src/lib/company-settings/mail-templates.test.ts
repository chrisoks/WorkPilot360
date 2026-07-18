import { describe, expect, it } from "vitest";
import {
  defaultDocumentMailTemplates,
  normalizeDocumentMailTemplates,
} from "./mail-templates";

describe("normalizeDocumentMailTemplates", () => {
  it("ergänzt fehlende Vorlagen mit sicheren Standardwerten", () => {
    const templates = normalizeDocumentMailTemplates({
      offer: { subject: "Individuelles Angebot {{number}}", body: "Guten Tag" },
    });
    expect(templates.offer.subject).toBe("Individuelles Angebot {{number}}");
    expect(templates.invoice).toEqual(defaultDocumentMailTemplates.invoice);
  });

  it("ersetzt leere Inhalte und begrenzt überlange Texte", () => {
    const templates = normalizeDocumentMailTemplates({
      invoice: { subject: "   ", body: "x".repeat(13_000) },
    });
    expect(templates.invoice.subject).toBe(defaultDocumentMailTemplates.invoice.subject);
    expect(templates.invoice.body).toHaveLength(12_000);
  });
});
