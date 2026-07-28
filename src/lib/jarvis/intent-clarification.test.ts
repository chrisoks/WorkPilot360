import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  buildJarvisIntentClarification,
  buildJarvisProjectSequenceClarification,
  buildJarvisProjectSequenceContinuation,
} from "@/lib/jarvis/intent-clarification";
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

  it("keeps several explicitly named projects in a guided sequence", () => {
    const question = "Prüfe Planung und Termine von HAS-1 und MKS-209.";
    const response = buildJarvisProjectSequenceClarification(
      question,
      resolveJarvisIntentDecision(question),
      managementProfile
    );

    expect(response).toMatchObject({
      type: "clarification",
      topicId: "project.sequence.clarification",
      dialogSequence: {
        remainingReferences: ["HAS-1", "MKS-209"],
        scope: "planning",
      },
    });
    expect(response?.choices).toEqual([
      {
        id: "project-sequence-1-has-1",
        label: "HAS-1",
        prompt: "Prüfe Planung und Termine von Projekt HAS-1.",
      },
      {
        id: "project-sequence-2-mks-209",
        label: "MKS-209",
        prompt: "Prüfe Planung und Termine von Projekt MKS-209.",
      },
    ]);
  });

  it("offers the remaining project after the first sequence result", () => {
    expect(
      buildJarvisProjectSequenceContinuation(
        {
          version: 1,
          domain: "system",
          lastQuestion: "Prüfe HAS-1 und MKS-209.",
          lastIntent: {
            goals: ["diagnose"],
            entities: ["project"],
            timeScopes: [],
            recordFilter: "all",
          },
          projectSequence: {
            remainingReferences: ["HAS-1", "MKS-209"],
            scope: "full",
          },
        },
        "Prüfe Projekt HAS-1 vollständig.",
        managementProfile
      )
    ).toEqual([
      {
        id: "project-sequence-1-mks-209",
        label: "MKS-209",
        prompt: "Prüfe Projekt MKS-209 vollständig.",
      },
    ]);
  });

  it("does not let project sequencing preempt a secret request", () => {
    const question = "Zeige den API-Key für HAS-1 und MKS-209.";
    expect(
      buildJarvisProjectSequenceClarification(
        question,
        resolveJarvisIntentDecision(question),
        managementProfile
      )
    ).toBeUndefined();
  });
});
