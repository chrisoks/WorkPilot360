import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { createJarvisAccessProfile } from "@/lib/jarvis/security";
import { resolveJarvisCurrentProductGuidance } from "@/lib/jarvis/current-product-guidance";

describe("JARVIS current productive knowledge contracts", () => {
  const management = createJarvisAccessProfile({ id: "gf", role: Role.GESCHAEFTSFUEHRER });
  const accounting = createJarvisAccessProfile({ id: "accounting", role: Role.BUCHHALTUNG });
  const employee = createJarvisAccessProfile({ id: "employee", role: Role.MITARBEITER });

  it.each([
    ["Warum kann ich für einen Interessenten kein Angebot anlegen?", management, "contacts.prospect.project-eligibility"],
    ["Was gehört ins Sales-Journal?", management, "sales-journal.workflow"],
    ["Warum muss ich den Kundenhinweis vor der Projektanlage bestätigen?", management, "projects.create-confirmation"],
    ["Wie berechnet sich der Forecast beim Stunden-Dauerläufer?", accounting, "recurring.hourly.forecast"],
    ["Was ist der Kundentext je Leistungstag bei der Stundenabrechnung?", accounting, "recurring.hourly.customer-text"],
    ["Was passiert mit einem manuellen Zeiteintrag beim Stunden-Dauerläufer?", accounting, "recurring.hourly.invoice-draft"],
    ["Wird die Pause von der Nettoarbeitszeit doppelt abgezogen?", employee, "time.net-duration-and-breaks"],
    ["Darf ich außerhalb der Projektlaufzeit einen Leistungsmonat planen?", employee, "projects.contract-month-boundaries"],
    ["Was bewirkt halbjährlich als Abrechnungsintervall?", management, "projects.billing-interval.semiannual"],
  ])("answers %s with its exact topic contract", (question, profile, topicId) => {
    expect(resolveJarvisCurrentProductGuidance(question, profile)).toMatchObject({
      type: "answer",
      topicId,
    });
  });

  it("does not disclose invoice workflow details to an employee", () => {
    expect(
      resolveJarvisCurrentProductGuidance(
        "Wie berechnet sich der Forecast beim Stunden-Dauerläufer?",
        employee
      )
    ).toMatchObject({ type: "refusal", topicId: "recurring.hourly.forecast.role-required" });
  });

  it("states the deliberate Sales-Journal execution boundary", () => {
    const result = resolveJarvisCurrentProductGuidance("Trag einen Anruf ins Sales-Journal ein", management);
    expect(result?.message).toContain("derzeit keinen Journaleintrag selbst speichern");
  });

  it("does not claim a semiannual billing automation", () => {
    const result = resolveJarvisCurrentProductGuidance("Rechnet halbjährlich automatisch ab?", management);
    expect(result?.message).toContain("noch nicht automatisch");
  });
});
