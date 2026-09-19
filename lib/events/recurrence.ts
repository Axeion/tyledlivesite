import { RRule, type Options } from "rrule";
import { fromFloating, toFloating } from "@/lib/events/timezone";

/**
 * Recurrence is stored as an RFC 5545 RRULE body (no "RRULE:" prefix), e.g.
 *   FREQ=MONTHLY;BYDAY=2TU   -> 2nd Tuesday of every month
 *   FREQ=WEEKLY;BYDAY=TH     -> every Thursday
 * Expansion happens in the lodge's timezone so a 7:30 PM meeting stays at
 * 7:30 PM local time across daylight-saving changes.
 */

export const WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

export const WEEKDAY_LABELS: Record<WeekdayCode, string> = {
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
  SU: "Sunday",
};

export type RecurrencePreset =
  | { kind: "none" }
  | { kind: "daily"; interval?: number }
  | { kind: "weekly"; weekdays: WeekdayCode[]; interval?: number }
  | { kind: "monthlyNthWeekday"; nth: 1 | 2 | 3 | 4 | -1; weekday: WeekdayCode; interval?: number }
  | { kind: "monthlyDate"; day: number; interval?: number }
  | { kind: "yearly" };

const MAX_OCCURRENCES_PER_EVENT = 500;
const ALLOWED_FREQ = new Set([RRule.DAILY, RRule.WEEKLY, RRule.MONTHLY, RRule.YEARLY]);

export class RecurrenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecurrenceError";
  }
}

function withInterval(parts: string[], interval: number | undefined): string {
  const i = interval ?? 1;
  if (!Number.isInteger(i) || i < 1 || i > 52) throw new RecurrenceError("Interval must be between 1 and 52");
  if (i > 1) parts.splice(1, 0, `INTERVAL=${i}`);
  return parts.join(";");
}

/** Build an RRULE body from a UI preset. Returns null for one-off events. */
export function buildRRule(preset: RecurrencePreset): string | null {
  switch (preset.kind) {
    case "none":
      return null;
    case "daily":
      return withInterval(["FREQ=DAILY"], preset.interval);
    case "weekly": {
      const days = preset.weekdays.filter((w) => (WEEKDAY_CODES as readonly string[]).includes(w));
      if (days.length === 0) throw new RecurrenceError("Pick at least one weekday");
      return withInterval(["FREQ=WEEKLY", `BYDAY=${days.join(",")}`], preset.interval);
    }
    case "monthlyNthWeekday": {
      if (![1, 2, 3, 4, -1].includes(preset.nth)) throw new RecurrenceError("Week must be 1st-4th or last");
      if (!(WEEKDAY_CODES as readonly string[]).includes(preset.weekday)) throw new RecurrenceError("Invalid weekday");
      return withInterval(["FREQ=MONTHLY", `BYDAY=${preset.nth}${preset.weekday}`], preset.interval);
    }
    case "monthlyDate":
      if (!Number.isInteger(preset.day) || preset.day < 1 || preset.day > 31) {
        throw new RecurrenceError("Day of month must be 1-31");
      }
      return withInterval(["FREQ=MONTHLY", `BYMONTHDAY=${preset.day}`], preset.interval);
    case "yearly":
      return "FREQ=YEARLY";
  }
}

/** Parse and validate an RRULE body. Throws RecurrenceError on anything unsupported. */
export function parseRRule(rrule: string): Partial<Options> {
  const body = rrule.trim().replace(/^RRULE:/i, "");
  if (!body) throw new RecurrenceError("Empty recurrence rule");
  if (/DTSTART|UNTIL|EXDATE|RDATE|TZID/i.test(body)) {
    throw new RecurrenceError("Rule must not contain DTSTART, UNTIL, TZID, RDATE or EXDATE; use the event fields");
  }
  let opts: Partial<Options>;
  try {
    opts = RRule.parseString(body);
  } catch (err) {
    throw new RecurrenceError(`Invalid recurrence rule: ${(err as Error).message}`);
  }
  if (opts.freq === undefined || !ALLOWED_FREQ.has(opts.freq)) {
    throw new RecurrenceError("Recurrence must be daily, weekly, monthly or yearly");
  }
  if (opts.interval !== undefined && (opts.interval < 1 || opts.interval > 52)) {
    throw new RecurrenceError("Interval must be between 1 and 52");
  }
  if (opts.count !== undefined && opts.count !== null && (opts.count < 1 || opts.count > 1000)) {
    throw new RecurrenceError("Count must be between 1 and 1000");
  }
  return opts;
}

/** Human-readable description, e.g. "every month on the 2nd Tuesday". */
export function describeRRule(rrule: string | null | undefined): string {
  if (!rrule) return "Does not repeat";
  try {
    const opts = parseRRule(rrule);
    return new RRule({ ...opts, dtstart: new Date(Date.UTC(2020, 0, 1)) }).toText();
  } catch {
    return "Custom recurrence";
  }
}

export interface RecurringEventInput {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  allDay?: boolean;
  rrule?: string | null;
  until?: Date | null;
  exdates?: Date[];
}

export interface Occurrence {
  eventId: string;
  title: string;
  description: string | null;
  location: string | null;
  allDay: boolean;
  start: Date;
  end: Date | null;
  recurring: boolean;
}

/**
 * Expand one event into concrete occurrences within [rangeStart, rangeEnd].
 * `tz` is the lodge's IANA timezone.
 */
export function expandEvent(event: RecurringEventInput, rangeStart: Date, rangeEnd: Date, tz: string): Occurrence[] {
  const durationMs = event.endsAt ? Math.max(0, event.endsAt.getTime() - event.startsAt.getTime()) : null;
  const base = {
    eventId: event.id,
    title: event.title,
    description: event.description ?? null,
    location: event.location ?? null,
    allDay: event.allDay ?? false,
  };
  const make = (start: Date): Occurrence => ({
    ...base,
    start,
    end: durationMs === null ? null : new Date(start.getTime() + durationMs),
    recurring: Boolean(event.rrule),
  });

  if (!event.rrule) {
    const s = event.startsAt.getTime();
    const e = durationMs === null ? s : s + durationMs;
    if (e < rangeStart.getTime() || s > rangeEnd.getTime()) return [];
    return [make(event.startsAt)];
  }

  const opts = parseRRule(event.rrule);
  const dtstart = toFloating(event.startsAt, tz);
  const until = event.until ? toFloating(event.until, tz) : undefined;
  const rule = new RRule({ ...opts, dtstart, until: until ?? opts.until ?? null });

  // Widen the floating range by a day on each side to absorb offset differences.
  const DAY = 24 * 60 * 60 * 1000;
  const floatStart = new Date(toFloating(rangeStart, tz).getTime() - DAY - (durationMs ?? 0));
  const floatEnd = new Date(toFloating(rangeEnd, tz).getTime() + DAY);

  const excluded = new Set((event.exdates ?? []).map((d) => d.getTime()));
  const out: Occurrence[] = [];
  const floatingDates = rule.between(floatStart, floatEnd, true, (_, i) => i < MAX_OCCURRENCES_PER_EVENT);
  for (const f of floatingDates) {
    const start = fromFloating(f, tz);
    if (excluded.has(start.getTime())) continue;
    const s = start.getTime();
    const e = durationMs === null ? s : s + durationMs;
    if (e < rangeStart.getTime() || s > rangeEnd.getTime()) continue;
    out.push(make(start));
  }
  return out;
}

export function expandEvents(
  events: RecurringEventInput[],
  rangeStart: Date,
  rangeEnd: Date,
  tz: string,
): Occurrence[] {
  const all = events.flatMap((e) => expandEvent(e, rangeStart, rangeEnd, tz));
  all.sort((a, b) => a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title));
  return all;
}

/** Next occurrence of an event on/after `from`, or null. */
export function nextOccurrence(event: RecurringEventInput, from: Date, tz: string): Occurrence | null {
  const horizon = new Date(from.getTime() + 2 * 366 * 24 * 60 * 60 * 1000);
  return expandEvent(event, from, horizon, tz)[0] ?? null;
}
