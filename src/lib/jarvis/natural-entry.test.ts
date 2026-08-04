import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";
import { isJarvisBroadNaturalEntry, resolveJarvisNaturalEntryRequest } from "@/lib/jarvis/natural-entry";

describe("JARVIS broad natural entries", () => {
  it.each([
    "Wie siehts aus?",
    "Wie schaut's aus?",
    "Wie läufts?",
    "Was gibts Neues?",
    "Wo klemmts?",
    "Was muss ich wissen?",
    "Was steht an?",
    "Hey Jarvis, wie siehts aus?",
    "Was steht an, bitte?",
  ])("recognizes the human entry %s", (question) => {
    expect(isJarvisBroadNaturalEntry(question)).toBe(true);
  });

  it("asks management for the intended scope with executable follow-ups", () => {
    const result = resolveJarvisNaturalEntryRequest({
      question: "Wie siehts aus?",
      accessProfile: createJarvisAccessProfile({ id: "gf", role: Role.GESCHAEFTSFUEHRER }),
    });
    expect(result).toMatchObject({ type: "clarification", topicId: "intent.natural-entry.scope-required" });
    expect(result?.choices?.map((choice) => choice.label)).toEqual(["Mein heutiger Tag", "Projekte", "Vertrieb", "Unternehmen"]);
  });

  it("does not expose enterprise finance choices to a normal employee", () => {
    const result = resolveJarvisNaturalEntryRequest({
      question: "Was steht an?",
      accessProfile: createJarvisAccessProfile({ id: "employee", role: Role.MITARBEITER, teamId: "team" }),
    });
    expect(result?.choices?.map((choice) => choice.label)).not.toContain("Unternehmen");
    expect(result?.choices?.map((choice) => choice.label)).not.toContain("Vertrieb");
  });

  it("leaves a short follow-up in an open project to the project-context resolver", () => {
    expect(resolveJarvisNaturalEntryRequest({
      question: "Wie siehts aus?",
      accessProfile: createJarvisAccessProfile({ id: "gf", role: Role.GESCHAEFTSFUEHRER }),
      context: { recordType: "project", recordId: "project-1" },
    })).toBeUndefined();
  });
});
