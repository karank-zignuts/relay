import { describe, expect, it } from "vitest";
import { monthGrid, parseIsoDate, toIsoDate } from "./calendar";

describe("toIsoDate / parseIsoDate", () => {
  it("round-trips a local date", () => {
    expect(toIsoDate(new Date(2026, 9, 5))).toBe("2026-10-05");
    expect(toIsoDate(parseIsoDate("2026-02-28")!)).toBe("2026-02-28");
  });

  it("rejects malformed values", () => {
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate("29/10/2026")).toBeNull();
  });
});

describe("monthGrid", () => {
  it("starts weeks on Monday and pads with nulls", () => {
    const weeks = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(weeks[0].slice(0, 3)).toEqual([null, null, null]);
    expect(toIsoDate(weeks[0][3]!)).toBe("2026-10-01");
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it("contains every day of the month exactly once", () => {
    const days = monthGrid(2028, 1).flat().filter(Boolean); // February 2028 is a leap month
    expect(days).toHaveLength(29);
    expect(toIsoDate(days[28]!)).toBe("2028-02-29");
  });
});
