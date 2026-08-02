import { describe, expect, it } from "vitest";
import {
  extractStampSessionTransition,
  looksLikeStampSessionTransitionRequest,
} from "@/lib/jarvis/stamp-session-intake";

describe("stamp-session-intake", () => {
  it.each([
    ["Pausiere meine Stempelung.", "pause"],
    ["Bitte den Stempeltimer pausieren", "pause"],
    ["Setze meine Stempelung fort", "resume"],
    ["Beende meine Stempelpause", "resume"],
  ] as const)("recognizes %s", (question, expected) => {
    expect(extractStampSessionTransition(question)).toBe(expected);
    expect(looksLikeStampSessionTransitionRequest(question)).toBe(true);
  });

  it.each([
    "Zeig meine aktive Stempelung",
    "Läuft meine Stempelung?",
    "Trage meine Stempelung von gestern nach",
    "Stoppe meine Stempelung",
    "Starte eine Stempelung auf HAS-1",
  ])("does not capture other stamp intents: %s", (question) => {
    expect(extractStampSessionTransition(question)).toBeNull();
  });
});
