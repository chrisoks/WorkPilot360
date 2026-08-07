import { describe, expect, it } from "vitest";
import { layoutPdfValue } from "@/lib/activity-reports/pdf-value-layout";

const measureText = (text: string, fontSize: number) => text.length * fontSize * 0.52;

describe("activity report PDF value layout", () => {
  it("keeps short metadata values on one line", () => {
    const layout = layoutPdfValue("GPFL-450", measureText, { maxWidth: 139 });

    expect(layout).toEqual({ lines: ["GPFL-450"], fontSize: 8.5 });
  });

  it("wraps a long document title inside the reserved value column", () => {
    const layout = layoutPdfValue(
      "TB Klaus Testmann GPFL-450 07.08.2026",
      measureText,
      { maxWidth: 139 }
    );

    expect(layout.lines).toHaveLength(2);
    expect(layout.lines.join(" ")).toBe("TB Klaus Testmann GPFL-450 07.08.2026");
    expect(layout.lines.every((line) => measureText(line, layout.fontSize) <= 139)).toBe(true);
    expect(layout.fontSize).toBeGreaterThanOrEqual(7.25);
  });

  it("keeps an unusually long unbroken value complete and inside the column", () => {
    const value = "extraordinary-long-address-without-natural-spaces@example.invalid";
    const layout = layoutPdfValue(value, measureText, { maxWidth: 139 });

    expect(layout.lines.join("")).toBe(value);
    expect(layout.lines.length).toBeLessThanOrEqual(2);
    expect(layout.lines.every((line) => measureText(line, layout.fontSize) <= 139)).toBe(true);
  });
});
