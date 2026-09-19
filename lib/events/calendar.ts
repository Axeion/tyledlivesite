import { wallClock } from "@/lib/events/timezone";
import type { Occurrence } from "@/lib/events/recurrence";

export interface CalendarDay {
  date: string; // YYYY-MM-DD in the lodge timezone
  day: number;
  inMonth: boolean;
  occurrences: Occurrence[];
}

export interface MonthGrid {
  year: number;
  month: number; // 1-12
  label: string;
  weeks: CalendarDay[][];
  prev: { year: number; month: number };
  next: { year: number; month: number };
}

export function parseMonthParam(value: string | undefined, now = new Date(), tz = "UTC"): { year: number; month: number } {
  const m = value?.match(/^(\d{4})-(\d{1,2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (year >= 1970 && year <= 2100 && month >= 1 && month <= 12) return { year, month };
  }
  const w = wallClock(now, tz);
  return { year: w.year, month: w.month };
}

/** UTC instants bounding a calendar month (with a week of padding) in the lodge timezone. */
export function monthRange(year: number, month: number): { start: Date; end: Date } {
  // Pad generously; occurrences are bucketed by local date afterwards.
  const start = new Date(Date.UTC(year, month - 1, 1) - 8 * 24 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(year, month, 1) + 8 * 24 * 60 * 60 * 1000);
  return { start, end };
}

export function localDateKey(instant: Date, tz: string): string {
  const w = wallClock(instant, tz);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/** Builds a Sunday-first month grid with occurrences bucketed by local date. */
export function buildMonthGrid(year: number, month: number, occurrences: Occurrence[], tz: string): MonthGrid {
  const byDate = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    const key = localDateKey(o.start, tz);
    const list = byDate.get(key) ?? [];
    list.push(o);
    byDate.set(key, list);
  }

  const first = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = first.getUTCDay(); // 0 = Sunday
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: CalendarDay[] = [];
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(Date.UTC(year, month - 1, 1 + (i - startOffset)));
    const key = d.toISOString().slice(0, 10);
    cells.push({
      date: key,
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month - 1,
      occurrences: byDate.get(key) ?? [],
    });
  }
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  return {
    year,
    month,
    label,
    weeks,
    prev: month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 },
    next: month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 },
  };
}
