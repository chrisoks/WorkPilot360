import { describe, expect, it, vi } from "vitest";
import { evaluateContactDeletion, executeContactDeletion, getContactDeletionConfirmationText } from "@/lib/contacts/contact-deletion-service";

function database(referenceOverrides: Record<string, number> = {}) {
  const countModel = (key: string) => ({ count: vi.fn().mockResolvedValue(referenceOverrides[key] ?? 0) });
  return {
    contact: {
      findFirst: vi.fn().mockResolvedValue({ id: "contact-1", organizationId: "org-1", customerNumber: "7000049", companyName: "Muster GmbH", firstName: null, lastName: null, type: "company", category: "Kunde", updatedAt: new Date("2026-08-02T02:00:00.000Z") }),
      count: countModel("childContacts").count,
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    workPilotProject: countModel("projects"), objectAddress: countModel("objectAddresses"), onlineRequest: countModel("onlineRequests"),
    customerLogbookEntry: countModel("customerLogbook"), customerProjectNote: countModel("customerNotes"),
    customerProjectNoteAcknowledgement: countModel("customerNoteAcknowledgements"), projectPotential: countModel("potentials"),
    salesOpportunity: countModel("salesOpportunities"), salesTarget: countModel("salesTargets"),
    customerFeedbackRequest: countModel("feedbackRequests"), customerFeedback: countModel("feedbacks"),
    offerAcceptanceRequest: countModel("offerAcceptances"), catalogInventoryMovement: countModel("inventoryMovements"),
    winterServiceCalculation: countModel("winterCalculations"), vehicleCalculation: countModel("vehicleCalculations"),
    winterServiceRun: countModel("winterServiceRuns"), contactIntegrationEvent: { create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) }, $executeRaw: vi.fn().mockResolvedValue(1),
  };
}

describe("contact deletion service", () => {
  it("uses an explicit irreversible confirmation phrase", () => {
    expect(getContactDeletionConfirmationText("7000049")).toBe("KONTAKT ENDGÜLTIG LÖSCHEN 7000049");
  });

  it("rejects a missing reason", async () => {
    await expect(evaluateContactDeletion({ organizationId: "org-1", contactId: "contact-1", reason: "x", db: database() as never }))
      .rejects.toMatchObject({ code: "invalid_input" });
  });

  it("shows all reference families and blocks any remaining link", async () => {
    const evaluation = await evaluateContactDeletion({ organizationId: "org-1", contactId: "contact-1", reason: "Doppelanlage", db: database({ objectAddresses: 1, onlineRequests: 2, customerLogbook: 3 }) as never });
    expect(evaluation.references).toHaveLength(17);
    expect(evaluation.blockingIssues.join(" ")).toContain("Objektadressen: 1");
    expect(evaluation.blockingIssues.join(" ")).toContain("zugeordnete Online-Anfragen: 2");
    expect(evaluation.blockingIssues.join(" ")).toContain("Kundenlogbuch-Einträge: 3");
  });

  it("deletes an unreferenced contact atomically and writes retained evidence", async () => {
    const db = database();
    const evaluation = await evaluateContactDeletion({ organizationId: "org-1", contactId: "contact-1", reason: "Doppelanlage", db: db as never });
    const result = await executeContactDeletion({ tx: db as never, organizationId: "org-1", contactId: "contact-1", reason: "Doppelanlage", actorId: "user-1", requestId: "draft-1", expectedFingerprint: evaluation.fingerprint });
    expect(result.customerNumber).toBe("7000049");
    expect(db.contact.deleteMany).toHaveBeenCalledWith({ where: { id: "contact-1", organizationId: "org-1", updatedAt: new Date("2026-08-02T02:00:00.000Z") } });
    expect(db.contactIntegrationEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "deleted" }) }));
    expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "contact.deleted" }) }));
  });
});
