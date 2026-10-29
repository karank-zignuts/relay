export type WorkingHours = {
  start: string; // "09:00"
  end: string; // "18:00"
  timeZone: string; // IANA, e.g. "Asia/Kolkata"
};

export type ReplyState = {
  last_client_message_at: string | null;
  last_team_reply_at: string | null;
  reply_dismissed_at: string | null;
};

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** A thread awaits a reply when the client spoke last and nobody on the team has dismissed it since. */
export function isAwaitingReply(task: ReplyState): boolean {
  if (!task.last_client_message_at) return false;
  const client = Date.parse(task.last_client_message_at);
  if (task.last_team_reply_at && Date.parse(task.last_team_reply_at) >= client) return false;
  if (task.reply_dismissed_at && Date.parse(task.reply_dismissed_at) >= client) return false;
  return true;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Offset of the zone from UTC at an instant, in ms. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Minutes between two instants that fall inside Mon–Fri working hours in the given zone. */
export function workingMinutesBetween(from: Date, to: Date, hours: WorkingHours): number {
  if (to <= from) return 0;
  const offset = zoneOffsetMs(to.getTime(), hours.timeZone);
  // Shift into "local clock as UTC" so plain UTC date math gives local days.
  const start = from.getTime() + offset;
  const end = to.getTime() + offset;
  const open = toMinutes(hours.start) * MINUTE_MS;
  const close = toMinutes(hours.end) * MINUTE_MS;

  let total = 0;
  for (let day = Math.floor(start / DAY_MS) * DAY_MS; day < end; day += DAY_MS) {
    const weekday = new Date(day).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const overlapStart = Math.max(start, day + open);
    const overlapEnd = Math.min(end, day + close);
    if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
  }
  return Math.round(total / MINUTE_MS);
}

export function isForgotten(task: ReplyState, now: Date, thresholdHours: number, hours: WorkingHours): boolean {
  if (!isAwaitingReply(task) || !task.last_client_message_at) return false;
  return workingMinutesBetween(new Date(task.last_client_message_at), now, hours) >= thresholdHours * 60;
}
