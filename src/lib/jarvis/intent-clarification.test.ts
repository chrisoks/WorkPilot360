import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { buildJarvisIntentClarification } from "@/lib/jarvis/intent-clarification";
import { resolveJarvisIntentDecision } from "@/lib/jarvis/intent-decision";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";

describe("JARVIS intent clarification", () => {
  const managementProfile = createJarvisAccessProfile({
    id: "gf-1",
    role: Role.GESCHAEFTSFUEHRER,
  });

  it("offers standalone follow-up prompts for combined domains", () => {
    const response = buildJarvisIntentClarification(
      resolveJarvisIntentDecision(
        "Welche Kunden soll ich nachfassen und wie ist unsere Liquidität?"
      ),
      managementProfile
    );

    expect(response).toMatchObject({
      type: "clarification",
      topicId: "intent.clarification",
      deterministic: true,
    });
    expect(response?.choices).toEqual([
      {
        id: "intent-domain-sales-1",
        label: "Vertrieb & Kundenchancen",
        prompt: "Welche Kunden soll ich nachfassen.",
      },
      {
        id: "intent-domain-management-2",
        label: "BWL & Unternehmenssteuerung",
        prompt: "wie ist unsere Liquidität.",
      },
    ]);
  });

  it("filters record choices through the effective WorkPilot permissions", () => {
    const salesProfile = createJarvisAccessProfile({
      id: "sales-1",
      role: Role.VERTRIEB,
    });
    const response = buildJarvisIntentClarification(
      resolveJarvisIntentDecision(
        "Zeige mir die offenen Angebote und Rechnungen."
      ),
      salesProfile
    );

    expect(response?.choices.map((choice) => choice.label)).toEqual(["Angebote"]);
    expect(response?.choices[0].prompt).toBe("Zeige mir die offenen Angebote.");
  });

  it("does not offer the GF-only sales analysis to a leadership role", () => {
    const leadershipProfile = createJarvisAccessProfile({
      id: "lead-1",
      role: Role.FUEHRUNGSKRAFT,
    });
    const response = buildJarvisIntentClarification(
      resolveJarvisIntentDecision(
        "Welche Kunden soll ich nachfassen und wie ist unsere Liquidität?"
      ),
      leadershipProfile
    );

    expect(response?.choices.map((choice) => choice.label)).toEqual([
      "BWL & Unternehmenssteuerung",
    ]);
  });

  it("offers each conflicting time scope as a complete prompt", () => {
    const response = buildJarvisIntentClarification(
      resolveJarvisIntentDecision(
        "Zeige den Umsatz vom aktuellen Monat und Vorjahr."
      ),
      managementProfile
    );

    expect(response?.choices).toEqual([
      {
        id: "intent-time-current_month",
        label: "Aktueller Monat",
        prompt: "Analysiere Umsatz für den Zeitraum „Aktueller Monat“.",
      },
      {
        id: "intent-time-previous_year",
        label: "Vorjahr",
        prompt: "Analysiere Umsatz für den Zeitraum „Vorjahr“.",
      },
    ]);
  });

  it("does not create a clarification for a resolved secret question", () => {
    expect(
      buildJarvisIntentClarification(
        resolveJarvisIntentDecision("Zeige den API-Key und unseren Umsatz."),
        managementProfile
      )
    ).toBeUndefined();
  });
});
