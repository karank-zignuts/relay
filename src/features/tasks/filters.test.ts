import { describe, expect, it } from "vitest";
import { activeFilterCount, EMPTY_FILTERS, nextSort, toRpcArgs, UNASSIGNED } from "./filters";

describe("activeFilterCount", () => {
  it("is zero for empty filters", () => expect(activeFilterCount(EMPTY_FILTERS)).toBe(0));

  it("counts each active filter once", () => {
    expect(activeFilterCount({ ...EMPTY_FILTERS, status: ["blocked", "done"], search: "login", hideDone: true, assignee: [UNASSIGNED] })).toBe(4);
  });
});

describe("nextSort", () => {
  it("cycles ascending, descending, then back to normal", () => {
    const asc = nextSort(null, "title");
    expect(asc).toEqual({ key: "title", direction: "asc" });
    const desc = nextSort(asc, "title");
    expect(desc).toEqual({ key: "title", direction: "desc" });
    expect(nextSort(desc, "title")).toBeNull();
  });

  it("starts a new column ascending", () => {
    expect(nextSort({ key: "title", direction: "desc" }, "priority")).toEqual({ key: "priority", direction: "asc" });
  });
});

describe("toRpcArgs", () => {
  it("uses newest first when no sort is chosen", () => {
    const args = toRpcArgs(EMPTY_FILTERS, null, { limit: 50, offset: 100 });
    expect(args).toMatchObject({ p_sort: "task_date", p_dir: "desc", p_limit: 50, p_offset: 100 });
  });

  it("uses the manual board order when no sort is chosen on the board", () => {
    const args = toRpcArgs({ ...EMPTY_FILTERS, hideDone: true }, null, { limit: 20, offset: 0 }, { manualOrder: true, status: ["to_do"] });
    expect(args).toMatchObject({ p_sort: "board_rank", p_dir: "asc", p_status: ["to_do"], p_hide_done: false });
  });

  it("passes the chosen sort and a day-wide date range", () => {
    const args = toRpcArgs({ ...EMPTY_FILTERS, from: "2026-10-01", to: "2026-10-02" }, { key: "priority", direction: "asc" }, { limit: 10, offset: 0 });
    expect(args.p_sort).toBe("priority");
    expect(Date.parse(args.p_to!) - Date.parse(args.p_from!)).toBeGreaterThan(24 * 3600 * 1000);
  });
});
