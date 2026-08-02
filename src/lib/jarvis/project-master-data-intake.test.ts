import { describe, expect, it } from "vitest";
import {
  extractProjectMasterDataChangeRequest,
  looksLikeProjectMasterDataChangeRequest,
} from "@/lib/jarvis/project-master-data-intake";

describe("project master data intake", () => {
  it("recognizes an explicit project master-data change", () => {
    const question = "Ändere Projekt GLR-449: Titel: Glasreinigung West; Gewerk: Glasreinigung; Laufzeit bis: 2026-11";
    expect(looksLikeProjectMasterDataChangeRequest(question)).toBe(true);
    expect(extractProjectMasterDataChangeRequest(question)).toEqual({
      projectNumber: "GLR-449",
      changes: {
        title: "Glasreinigung West",
        projectRuntimeUntil: "2026-11",
        trade: "Glasreinigung",
      },
    });
  });

  it("does not steal status or archive requests", () => {
    expect(looksLikeProjectMasterDataChangeRequest("Setze Projekt GLR-449 auf Status Geplant. Titel: Test")).toBe(false);
    expect(looksLikeProjectMasterDataChangeRequest("Archiviere Projekt GLR-449. Beschreibung: erledigt")).toBe(false);
  });
});
