import { describe, expect, it } from "vitest";
import {
  buildOnlineRequestConversionTasks,
  buildOnlineRequestLogbookBody,
  createOnlineRequestProjectNumber,
  createOnlineRequestProjectTitle,
} from "./conversion";

const request = {
  referenceNumber: "OKI-20260730-AB12CD",
  requestType: "execution",
  tradeName: "Glasreinigung",
  recommendationNames: ["Fassadenreinigung"],
  desiredDate: "2026-08-14",
  desiredTimeWindow: "vormittags",
  callbackTimeWindow: null,
  urgency: null,
  street: "Musterstraße 1",
  postalCode: "74722",
  city: "Buchen",
  objectHint: "Hinterhaus",
  description: "Bitte alle Fenster außen reinigen.",
  company: "Muster GmbH",
  firstName: "Max",
  lastName: "Mustermann",
  email: "max@example.test",
  phone: "06281 123456",
  preferredContact: "either",
};

describe("online request conversion helpers", () => {
  it("creates a standard project identity and title", () => {
    expect(createOnlineRequestProjectNumber("GLR", 449)).toBe("GLR-449");
    expect(createOnlineRequestProjectTitle("GLR-449", request.tradeName)).toBe(
      "Projekt GLR-449 - Glasreinigung"
    );
  });

  it("normalizes the project prefix and has a safe fallback", () => {
    expect(createOnlineRequestProjectNumber(" gpfl ", 450)).toBe("GPFL-450");
    expect(createOnlineRequestProjectNumber("", 0)).toBe("SON-1");
  });

  it("preserves the submitted request in a structured logbook body", () => {
    const body = buildOnlineRequestLogbookBody(request);
    expect(body).toContain("Referenz: OKI-20260730-AB12CD");
    expect(body).toContain("Zusatzinteressen: Fassadenreinigung");
    expect(body).toContain("Beschreibung:");
    expect(body).toContain("Bitte alle Fenster außen reinigen.");
  });

  it("creates a desired-date task and clearly marks it as unconfirmed", () => {
    const tasks = buildOnlineRequestConversionTasks(
      request,
      new Date("2026-07-30T12:00:00.000Z")
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      kind: "desired_date",
      title: "Wunschdatum prüfen · OKI-20260730-AB12CD",
      priority: "NORMAL",
    });
    expect(tasks[0].description).toContain(
      "noch kein bestätigter Termin"
    );
    expect(tasks[0].deadline.toISOString()).toBe("2026-07-31T12:00:00.000Z");
  });

  it("creates both callback and date tasks when both signals exist", () => {
    const tasks = buildOnlineRequestConversionTasks({
      ...request,
      requestType: "callback",
      callbackTimeWindow: "nachmittags",
    });
    expect(tasks.map((task) => task.kind)).toEqual([
      "callback",
      "desired_date",
    ]);
  });

  it("gives an urgent defect a critical follow-up task", () => {
    const tasks = buildOnlineRequestConversionTasks({
      ...request,
      requestType: "issue",
      desiredDate: null,
      desiredTimeWindow: null,
      urgency: "dringend",
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      kind: "follow_up",
      priority: "KRITISCH",
    });
  });
});
