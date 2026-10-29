import { describe, expect, it } from "vitest";
import { isAwaitingReply, isForgotten, workingMinutesBetween, type WorkingHours } from "./attention";

const IST: WorkingHours = { start: "09:00", end: "18:00", timeZone: "Asia/Kolkata" };
// IST is UTC+5:30, so 09:00 IST = 03:30Z.
const at = (iso: string) => new Date(iso);

describe("workingMinutesBetween", () => {
  it("counts minutes inside a single working day", () => {
    // Mon 2026-10-26, 10:00 to 12:00 IST
    expect(workingMinutesBetween(at("2026-10-26T04:30:00Z"), at("2026-10-26T06:30:00Z"), IST)).toBe(120);
  });

  it("ignores time outside working hours", () => {
    // Mon 17:00 IST to Tue 10:00 IST = 1h Monday + 1h Tuesday
    expect(workingMinutesBetween(at("2026-10-26T11:30:00Z"), at("2026-10-27T04:30:00Z"), IST)).toBe(120);
  });

  it("skips weekends", () => {
    // Fri 17:00 IST to Mon 10:00 IST = 1h Friday + 1h Monday
    expect(workingMinutesBetween(at("2026-10-30T11:30:00Z"), at("2026-11-02T04:30:00Z"), IST)).toBe(120);
  });

  it("returns 0 for a reversed or empty range", () => {
    expect(workingMinutesBetween(at("2026-10-26T06:00:00Z"), at("2026-10-26T05:00:00Z"), IST)).toBe(0);
  });

  it("returns 0 for a message sent on a Sunday and checked the same day", () => {
    expect(workingMinutesBetween(at("2026-11-01T05:00:00Z"), at("2026-11-01T09:00:00Z"), IST)).toBe(0);
  });
});

describe("isAwaitingReply", () => {
  const base = { last_client_message_at: "2026-10-26T05:00:00Z", last_team_reply_at: null, reply_dismissed_at: null };

  it("is true when the client spoke and the team never replied", () => {
    expect(isAwaitingReply(base)).toBe(true);
  });

  it("is false when the team replied after the client", () => {
    expect(isAwaitingReply({ ...base, last_team_reply_at: "2026-10-26T06:00:00Z" })).toBe(false);
  });

  it("is true when the client followed up after the team reply", () => {
    expect(isAwaitingReply({ ...base, last_team_reply_at: "2026-10-26T04:00:00Z" })).toBe(true);
  });

  it("is false when dismissed after the last client message, true again after a newer one", () => {
    expect(isAwaitingReply({ ...base, reply_dismissed_at: "2026-10-26T06:00:00Z" })).toBe(false);
    expect(isAwaitingReply({ ...base, reply_dismissed_at: "2026-10-26T04:00:00Z" })).toBe(true);
  });

  it("is false with no client message", () => {
    expect(isAwaitingReply({ ...base, last_client_message_at: null })).toBe(false);
  });
});

describe("isForgotten", () => {
  const task = { last_client_message_at: "2026-10-26T04:30:00Z", last_team_reply_at: null, reply_dismissed_at: null }; // Mon 10:00 IST

  it("is false before the threshold", () => {
    expect(isForgotten(task, at("2026-10-26T07:00:00Z"), 4, IST)).toBe(false); // 2.5h
  });

  it("is true once the threshold of working hours has passed", () => {
    expect(isForgotten(task, at("2026-10-26T09:00:00Z"), 4, IST)).toBe(true); // 4.5h
  });

  it("does not count overnight hours", () => {
    // Sent Mon 17:00 IST, checked Tue 09:30 IST: only 1h + 0.5h of working time.
    const late = { ...task, last_client_message_at: "2026-10-26T11:30:00Z" };
    expect(isForgotten(late, at("2026-10-27T04:00:00Z"), 4, IST)).toBe(false);
  });

  it("is false when not awaiting a reply", () => {
    expect(isForgotten({ ...task, last_team_reply_at: "2026-10-26T05:00:00Z" }, at("2026-10-27T09:00:00Z"), 4, IST)).toBe(false);
  });
});
