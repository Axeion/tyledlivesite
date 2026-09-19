import type { RecurringEventInput } from "@/lib/events/recurrence";
import { wallClock } from "@/lib/events/timezone";

export interface CalendarLodge {
  name: string;
  number: string;
  slug: string;
  timezone: string;
}

/** RFC 5545 text escaping. */
function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold lines longer than 75 octets (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let start = 0;
  let first = true;
  while (start < bytes.length) {
    const limit = first ? 75 : 74;
    let end = Math.min(start + limit, bytes.length);
    // Do not split a multi-byte UTF-8 sequence.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    out.push((first ? "" : " ") + bytes.subarray(start, end).toString("utf8"));
    start = end;
    first = false;
  }
  return out.join("\r\n");
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

/** Local wall-clock timestamp in `tz` (used with TZID=). */
function localStamp(d: Date, tz: string): string {
  const w = wallClock(d, tz);
  return `${pad(w.year, 4)}${pad(w.month)}${pad(w.day)}T${pad(w.hour)}${pad(w.minute)}${pad(w.second)}`;
}

function localDate(d: Date, tz: string): string {
  const w = wallClock(d, tz);
  return `${pad(w.year, 4)}${pad(w.month)}${pad(w.day)}`;
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/**
 * Builds an iCalendar document for a lodge. Recurring events keep their RRULE
 * so subscribing clients expand them; times are expressed in the lodge's
 * timezone via TZID so they stay correct across daylight-saving changes.
 */
export function buildLodgeCalendar(
  lodge: CalendarLodge,
  events: RecurringEventInput[],
  siteUrl: string,
  now: Date = new Date(),
): string {
  const tz = lodge.timezone;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//tyled.live//lodge-calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(`${lodge.name} No. ${lodge.number}`)}`,
    `X-WR-TIMEZONE:${tz}`,
    `URL:${siteUrl}`,
  ];

  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.id}@${lodge.slug}.tyled.live`);
    lines.push(`DTSTAMP:${utcStamp(now)}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${localDate(e.startsAt, tz)}`);
      if (e.endsAt) lines.push(`DTEND;VALUE=DATE:${localDate(e.endsAt, tz)}`);
    } else {
      lines.push(`DTSTART;TZID=${tz}:${localStamp(e.startsAt, tz)}`);
      if (e.endsAt) lines.push(`DTEND;TZID=${tz}:${localStamp(e.endsAt, tz)}`);
    }
    if (e.rrule) {
      let rule = e.rrule.replace(/^RRULE:/i, "");
      if (e.until) rule += `;UNTIL=${utcStamp(e.until)}`;
      lines.push(`RRULE:${rule}`);
      for (const ex of e.exdates ?? []) {
        lines.push(`EXDATE;TZID=${tz}:${localStamp(ex, tz)}`);
      }
    }
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
