import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";
import { parseJarvisTeamSlotPreparationRequest, parseJarvisTeamSlotQuery, resolveJarvisTeamSlotRequest, type JarvisTeamSlotSnapshot, type JarvisTeamSlotSource } from "@/lib/jarvis/team-slot-finder";

const now = new Date("2026-08-03T07:00:00.000Z");
const window = {
  monday: { start: "08:00", end: "17:00" },
  tuesday: { start: "08:00", end: "17:00" },
  wednesday: { start: "08:00", end: "17:00" },
  thursday: { start: "08:00", end: "17:00" },
  friday: { start: "08:00", end: "17:00" },
};
const breaks = {
  monday: { start: "12:00", end: "12:30" },
  tuesday: { start: "12:00", end: "12:30" },
  wednesday: { start: "12:00", end: "12:30" },
  thursday: { start: "12:00", end: "12:30" },
  friday: { start: "12:00", end: "12:30" },
};
const snapshot: JarvisTeamSlotSnapshot = {
  users: [
    { id: "u1", firstName: "Max", lastName: "Muster", teamId: "team-a", planningBoard: "Immocare", planningGroup: "Grünpflege", planningStartTime: "08:00", planningEndTime: "17:00", weeklyCapacity: { monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8 }, planningTimeWindows: window, planningBreakWindows: breaks, leadershipManagerId: "lead", leadershipDeputyId: null },
    { id: "u2", firstName: "Mia", lastName: "Beispiel", teamId: "team-a", planningBoard: "Immocare", planningGroup: "Grünpflege", planningStartTime: "08:00", planningEndTime: "17:00", weeklyCapacity: { monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8 }, planningTimeWindows: window, planningBreakWindows: breaks, leadershipManagerId: "lead", leadershipDeputyId: null },
    { id: "u3", firstName: "Tom", lastName: "Test", teamId: "team-a", planningBoard: "Immocare", planningGroup: "Objektbetreuung", planningStartTime: "08:00", planningEndTime: "17:00", weeklyCapacity: { monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8 }, planningTimeWindows: window, planningBreakWindows: breaks, leadershipManagerId: "lead", leadershipDeputyId: null },
    { id: "u4", firstName: "Fremd", lastName: "Team", teamId: "team-b", planningBoard: "Solutions", planningGroup: "IT", planningStartTime: "08:00", planningEndTime: "17:00", weeklyCapacity: { monday: 8 }, planningTimeWindows: window, planningBreakWindows: breaks, leadershipManagerId: "other", leadershipDeputyId: null },
  ],
  absences: [{ userId: "u2", date: new Date("2026-08-03T00:00:00.000Z"), dayPart: "full", status: "genehmigt", deletedAt: null }],
  planningEntries: [{ userId: "u1", employeeName: "Max Muster", date: "2026-08-03", startTime: "08:00", endTime: "10:00", approvalStatus: "confirmed", deletedAt: null }],
};
const source: JarvisTeamSlotSource = { async load() { return snapshot; } };
const manager = createJarvisAccessProfile({ id: "lead", role: Role.FUEHRUNGSKRAFT, teamId: "team-a" });
const employee = createJarvisAccessProfile({ id: "u1", role: Role.MITARBEITER, teamId: "team-a" });

describe("JARVIS team slot finder", () => {
  it("turns a selected slot suggestion into a safe multi-employee planning handoff", () => {
    expect(
      parseJarvisTeamSlotPreparationRequest(
        "Bereite für Do., 27.08.2026 von 08:00 bis 12:00 einen Rasenmähen-Termin mit Max Mustermann und Erika Musterfrau vor. Frage mich zuerst nach Kunde und Projekt."
      )
    ).toEqual({
      date: "2026-08-27",
      startTime: "08:00",
      endTime: "12:00",
      title: "Rasenmähen",
      employeeNames: ["Max Mustermann", "Erika Musterfrau"],
    });
    expect(
      parseJarvisTeamSlotPreparationRequest(
        "Bereite für 31.02.2026 von 12:00 bis 08:00 einen Einsatz-Termin mit Max Mustermann vor."
      )
    ).toBeUndefined();
  });

  it.each([
    "Wann haben 2 von unsere Jungs Zeit bei einem Kunden 4h Rasen zu mähen?",
    "Wann ist der nächstmögliche Termin wo zwei von den Jungs bei einem Kunden vier Stunden Rasen mähen können?",
    "Wann ist der nächstmögiche Termin wo 2 von den Jungs bei einem Kunden 4h Rasen mähen können?",
    "Wie siehts aus, wann sind 2 Mitarbeiter für 4 Std Grünpflege frei?",
  ])("recognizes natural shared-capacity wording: %s", (question) => {
    expect(parseJarvisTeamSlotQuery(question)).toMatchObject({ recognized: true, employeeCount: 2, durationMinutes: 240 });
  });

  it("finds the earliest uninterrupted common slot and respects breaks, absences and bookings", async () => {
    const result = await resolveJarvisTeamSlotRequest({ question: "Wann ist der nächstmögliche Termin wo 2 von den Jungs bei einem Kunden 4h Rasen mähen können?", organizationId: "org", accessProfile: manager, now, source });
    expect(result).toMatchObject({ type: "answer", topicId: "planning.team-slot" });
    expect(result?.message).toContain("12:30–16:30");
    expect(result?.message).toContain("Max Muster und Tom Test");
    expect(result?.message).toContain("nichts gebucht");
    expect(result?.structured?.sections?.[1]?.items).toContain("genehmigte Ganz- und Halbtagsabwesenheiten");
    expect(result?.choices).toHaveLength(3);
  });

  it("allows an employee to see common availability only inside the employee's own team", async () => {
    const result = await resolveJarvisTeamSlotRequest({ question: "Wann sind 2 Mitarbeiter für 4h frei?", organizationId: "org", accessProfile: employee, now, source });
    expect(result).toMatchObject({ type: "answer", topicId: "planning.team-slot" });
    expect(result?.message).not.toContain("Fremd Team");
  });

  it("treats missing break-window configuration as no configured break instead of no availability", async () => {
    const withoutBreaks: JarvisTeamSlotSource = {
      async load() {
        return {
          ...snapshot,
          users: snapshot.users.map((user) => ({ ...user, planningBreakWindows: null })),
          absences: [],
          planningEntries: [],
        };
      },
    };
    const result = await resolveJarvisTeamSlotRequest({ question: "Wann können 2 von den Jungs 4h Rasen mähen?", organizationId: "org", accessProfile: manager, now, source: withoutBreaks });
    expect(result).toMatchObject({ type: "answer", topicId: "planning.team-slot" });
    expect(result?.message).toContain("09:15–13:15");
  });

  it("asks for the missing duration instead of guessing", async () => {
    const result = await resolveJarvisTeamSlotRequest({ question: "Wann sind 2 von den Jungs für Rasenmähen frei?", organizationId: "org", accessProfile: manager, now, source });
    expect(result).toMatchObject({ type: "clarification", topicId: "planning.team-slot.requirements" });
    expect(result?.choices).toHaveLength(3);
  });
});
