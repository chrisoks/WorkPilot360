import { describe, expect, it } from "vitest";
import { extractContactBulkCategoryRequest, looksLikeContactBulkCategoryRequest, looksLikeContactBulkRollbackRequest } from "./bulk-update-intake";

describe("bulk update intake", () => {
  it("extracts explicit customer numbers and target category", () => {
    const question = "Archiviere die Kontakte 7001001, 7001002 und 7001003 als Gruppenaktion";
    expect(looksLikeContactBulkCategoryRequest(question)).toBe(true);
    expect(extractContactBulkCategoryRequest(question)).toEqual({ mode: "apply", customerNumbers: ["7001001", "7001002", "7001003"], targetCategory: "Archiv" });
  });

  it("recognizes an explicit rollback", () => {
    const question = "Massenänderung 123e4567-e89b-12d3-a456-426614174000 zurückrollen";
    expect(looksLikeContactBulkRollbackRequest(question)).toBe(true);
    expect(extractContactBulkCategoryRequest(question)).toEqual({ mode: "rollback", sourceRequestId: "123e4567-e89b-12d3-a456-426614174000" });
  });
});
