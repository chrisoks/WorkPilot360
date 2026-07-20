import { describe, expect, it } from "vitest";
import { isOpenOksPhoneProject, mergeLinkedProjectIds } from "./project-logbook";

describe("OKS Phone project logbook rules", () => {
  it.each([
    ["Lead & Klaerung", "1"],
    ["In Umsetzung", "6"],
    ["Arbeit unterbrochen", "7"],
    ["Abrechnungsbereit", "9"],
  ])("accepts an open project status: %s", (status, statusCode) => {
    expect(isOpenOksPhoneProject(status, statusCode)).toBe(true);
  });

  it.each([
    ["Abgeschlossen", "10"],
    ["Archiviert", "11"],
    ["Abgeschlossen", null],
    ["Archiviert", null],
  ])("rejects a closed project status: %s", (status, statusCode) => {
    expect(isOpenOksPhoneProject(status, statusCode)).toBe(false);
  });

  it("adds a project link only once", () => {
    expect(mergeLinkedProjectIds(["project-1"], "project-2")).toEqual(["project-1", "project-2"]);
    expect(mergeLinkedProjectIds(["project-1"], "project-1")).toEqual(["project-1"]);
  });
});
