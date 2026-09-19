/**
 * Minimal IANA timezone helpers built on Intl, so recurring events keep their
 * local wall-clock time across DST changes without pulling in a tz library.
 *
 * "Floating" dates represent local wall-clock time encoded as UTC fields:
 * 2026-03-10 19:30 in America/New_York becomes Date.UTC(2026, 2, 10, 19, 30).
 */

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

export interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function wallClock(instant: Date, tz: string): WallClock {
  const parts = formatter(tz).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") === 24 ? 0 : get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Instant -> floating date carrying the local wall-clock fields in UTC slots. */
export function toFloating(instant: Date, tz: string): Date {
  const w = wallClock(instant, tz);
  return new Date(Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second));
}

/** Offset (ms) of `tz` from UTC at a given instant. Positive east of UTC. */
export function offsetAt(instant: Date, tz: string): number {
  return toFloating(instant, tz).getTime() - instant.getTime();
}

/** Floating (wall-clock) date -> real instant in `tz`. Handles DST by iterating. */
export function fromFloating(floating: Date, tz: string): Date {
  const t = floating.getTime();
  let guess = t - offsetAt(new Date(t), tz);
  guess = t - offsetAt(new Date(guess), tz);
  // In a DST gap the wall-clock time does not exist; the second pass lands on
  // the post-transition instant, which is the conventional choice.
  return new Date(guess);
}

/** Format an instant in a timezone for display. */
export function formatInTz(
  instant: Date,
  tz: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...options }).format(instant);
}
