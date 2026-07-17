import { Role } from "@prisma/client";

export const selfUploadEmployeeDocumentCategories = new Set(["sick_note", "vacation_proof", "training"]);

export function isEmployeeDocumentExecutive(role: Role) {
  return role === Role.ADMIN || role === Role.GESCHAEFTSFUEHRER;
}

export function canViewEmployeeDocuments(actor: { id: string; role: Role }, employeeId: string) {
  return actor.id === employeeId || isEmployeeDocumentExecutive(actor.role);
}

export function canUploadEmployeeDocument(actor: { id: string; role: Role }, employeeId: string, category: string) {
  if (isEmployeeDocumentExecutive(actor.role)) return true;
  return actor.id === employeeId && selfUploadEmployeeDocumentCategories.has(category);
}

export function canDeleteEmployeeDocument(
  actor: { id: string; role: Role },
  document: { employeeId: string; uploadedById: string; category: string }
) {
  if (isEmployeeDocumentExecutive(actor.role)) return true;
  return (
    actor.id === document.employeeId &&
    actor.id === document.uploadedById &&
    selfUploadEmployeeDocumentCategories.has(document.category)
  );
}
