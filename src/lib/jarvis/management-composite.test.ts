import { describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";
import { resolveJarvisManagementCompositeRequest, resolveJarvisManagementCompositeTopics } from "@/lib/jarvis/management-composite";

const accessProfile = createJarvisAccessProfile({ id: "gf", role: Role.GESCHAEFTSFUEHRER });

describe("JARVIS combined management analysis", () => {
  it.each([
    ["Analysiere Umsatz, Marge und Auslastung", ["revenue", "margin", "utilization"]],
    ["Wie siehts bei Umsatz und Vertrieb aus?", ["revenue", "sales_pipeline"]],
    ["Vergleiche Kundenkonzentration und Umsatzziel", ["revenue", "customer_concentration", "target_gap"]],
  ])("detects multiple perspectives in %s", (question, expected) => {
    expect(resolveJarvisManagementCompositeTopics(question)).toEqual(expected);
  });

  it("does not hijack a focused single-topic question", () => {
    expect(resolveJarvisManagementCompositeTopics("Zeige den Umsatztrend")).toEqual([]);
  });

  it("combines deterministic adapter answers and reuses one enterprise snapshot", async () => {
    const enterprise = vi.fn(async ({ question }: { question: string }) => ({
      type: "answer" as const,
      topicId: question.includes("Margentrend") ? "enterprise.margin-trend" : "enterprise.revenue-trend",
      message: question.includes("Margentrend") ? "Die Marge ist belegt." : "Der Umsatz wurde ausgewertet.",
      structured: { title: question.includes("Margentrend") ? "Marge" : "Umsatz", facts: [{ label: "Wert", value: "belegt" }] },
      deterministic: true as const,
    }));
    const operations = vi.fn(async () => ({ type: "answer" as const, topicId: "management.operations.utilization", message: "Die Auslastung wurde ausgewertet.", structured: { title: "Auslastung", facts: [{ label: "Team", value: "80 %" }] }, deterministic: true as const }));
    const enterpriseSource = { load: vi.fn(async () => ({ invoices: [], offers: [], opportunities: [], targets: [] })) };
    const result = await resolveJarvisManagementCompositeRequest({
      question: "Analysiere Umsatz, Marge und Auslastung",
      organizationId: "org",
      accessProfile,
      dependencies: { enterprise, operations, enterpriseSource },
    });
    expect(result).toMatchObject({ type: "answer", topicId: "management.composite-analysis" });
    expect(result?.structured?.sections).toHaveLength(3);
    expect(enterprise).toHaveBeenCalledTimes(2);
    expect(operations).toHaveBeenCalledTimes(1);
  });
});
