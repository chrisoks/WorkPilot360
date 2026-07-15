import { describe, expect, it } from "vitest";
import { formatBerlinDateTime, getBerlinMonthKey } from "../src/lib/date-time";

describe("WorkPilot-Zeitdarstellung", () => {
  it("zeigt einen UTC-Zeitpunkt im Juli mit Berliner Sommerzeit", () => {
    const instant = new Date("2026-07-15T13:03:00.000Z");

    expect(formatBerlinDateTime(instant)).toBe("15.07.2026, 15:03");
    expect(getBerlinMonthKey(instant)).toBe("2026-07");
  });

  it("zeigt einen UTC-Zeitpunkt im Januar mit Berliner Winterzeit", () => {
    const instant = new Date("2026-01-15T14:03:00.000Z");

    expect(formatBerlinDateTime(instant)).toBe("15.01.2026, 15:03");
    expect(getBerlinMonthKey(instant)).toBe("2026-01");
  });

  it("leitet den Projektmonat an einer Berliner Monatsgrenze korrekt ab", () => {
    const instant = new Date("2026-06-30T22:30:00.000Z");

    expect(formatBerlinDateTime(instant)).toBe("01.07.2026, 00:30");
    expect(getBerlinMonthKey(instant)).toBe("2026-07");
  });
});
