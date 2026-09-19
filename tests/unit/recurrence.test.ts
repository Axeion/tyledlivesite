import { describe, expect, it } from "vitest";
import { buildLodgeCalendar } from "@/lib/events/ical";
import {
  RecurrenceError,
  buildRRule,
  describeRRule,
  expandEvent,
  expandEvents,
  nextOccurrence,
  parseRRule,
} from "@/lib/events/recurrence";
import { fromFloating, toFloating, wallClock } from "@/lib/events/timezone";

const NY = "America/New_York";

function ny(y: number, m: number, d: number, h: number, min = 0): Date {
  return fromFloating(new Date(Date.UTC(y, m - 1, d, h, min)), NY);
}

describe("timezone helpers", () => {
  it("round-trips wall-clock time across DST", () => {
    const winter = ny(2026, 1, 13, 19, 30);
    const summer = ny(2026, 7, 14, 19, 30);
    expect(wallClock(winter, NY)).toMatchObject({ hour: 19, minute: 30, day: 13 });
    expect(wallClock(summer, NY)).toMatchObject({ hour: 19, minute: 30, day: 14 });
    // EST is UTC-5, EDT is UTC-4
    expect(winter.toISOString()).toBe("2026-01-14T00:30:00.000Z");
    expect(summer.toISOString()).toBe("2026-07-14T23:30:00.000Z");
    expect(toFloating(winter, NY).toISOString()).toBe("2026-01-13T19:30:00.000Z");
  });
});

describe("buildRRule presets", () => {
  it("builds 2nd Tuesday monthly", () => {
    expect(buildRRule({ kind: "monthlyNthWeekday", nth: 2, weekday: "TU" })).toBe("FREQ=MONTHLY;BYDAY=2TU");
  });
  it("builds weekly and last-Friday rules", () => {
    expect(buildRRule({ kind: "weekly", weekdays: ["MO", "WE"] })).toBe("FREQ=WEEKLY;BYDAY=MO,WE");
    expect(buildRRule({ kind: "monthlyNthWeekday", nth: -1, weekday: "FR" })).toBe("FREQ=MONTHLY;BYDAY=-1FR");
    expect(buildRRule({ kind: "monthlyDate", day: 15, interval: 2 })).toBe("FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15");
    expect(buildRRule({ kind: "none" })).toBeNull();
  });
  it("describes rules in plain English", () => {
    expect(describeRRule("FREQ=MONTHLY;BYDAY=2TU")).toBe("every month on the 2nd Tuesday");
    expect(describeRRule(null)).toBe("Does not repeat");
  });
});

describe("parseRRule validation", () => {
  it("rejects unsupported and dangerous rules", () => {
    expect(() => parseRRule("FREQ=SECONDLY")).toThrow(RecurrenceError);
    expect(() => parseRRule("FREQ=MINUTELY")).toThrow(RecurrenceError);
    expect(() => parseRRule("FREQ=DAILY;UNTIL=20300101T000000Z")).toThrow(RecurrenceError);
    expect(() => parseRRule("DTSTART:20260101T000000Z\nRRULE:FREQ=DAILY")).toThrow(RecurrenceError);
    expect(() => parseRRule("FREQ=DAILY;INTERVAL=0")).toThrow(RecurrenceError);
    expect(() => parseRRule("")).toThrow(RecurrenceError);
    expect(() => parseRRule("garbage")).toThrow(RecurrenceError);
  });
  it("accepts an RRULE: prefix", () => {
    expect(parseRRule("RRULE:FREQ=WEEKLY;BYDAY=TH").freq).toBeDefined();
  });
});

describe("expandEvent", () => {
  const stated = {
    id: "e1",
    title: "Stated Communication",
    startsAt: ny(2026, 1, 13, 19, 30), // 2nd Tuesday of Jan 2026
    endsAt: ny(2026, 1, 13, 21, 30),
    rrule: "FREQ=MONTHLY;BYDAY=2TU",
  };

  it("expands '2nd Tuesday monthly' at a constant local time across DST", () => {
    const occ = expandEvent(stated, new Date("2026-01-01T00:00:00Z"), new Date("2026-12-31T23:59:59Z"), NY);
    expect(occ).toHaveLength(12);
    const days = occ.map((o) => wallClock(o.start, NY));
    expect(days.map((d) => d.day)).toEqual([13, 10, 10, 14, 12, 9, 14, 11, 8, 13, 10, 8]);
    for (const d of days) {
      expect(d.hour).toBe(19);
      expect(d.minute).toBe(30);
    }
    // March occurrence is still EST (DST begins Mar 8 2026 -> Mar 10 is EDT actually), check July is UTC-4
    const july = occ[6];
    expect(july.start.toISOString()).toBe("2026-07-14T23:30:00.000Z");
    // Duration preserved
    expect(july.end!.getTime() - july.start.getTime()).toBe(2 * 60 * 60 * 1000);
    expect(july.recurring).toBe(true);
  });

  it("honours the range boundaries", () => {
    const occ = expandEvent(stated, new Date("2026-03-01T00:00:00Z"), new Date("2026-05-31T23:59:59Z"), NY);
    expect(occ.map((o) => wallClock(o.start, NY).month)).toEqual([3, 4, 5]);
  });

  it("stops at until and skips exdates", () => {
    const occ = expandEvent(
      { ...stated, until: ny(2026, 6, 30, 23, 59), exdates: [ny(2026, 3, 10, 19, 30)] },
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-12-31T23:59:59Z"),
      NY,
    );
    expect(occ.map((o) => wallClock(o.start, NY).month)).toEqual([1, 2, 4, 5, 6]);
  });

  it("handles a 5th weekday that does not exist every month", () => {
    const occ = expandEvent(
      { id: "e2", title: "Fifth Friday", startsAt: ny(2026, 1, 30, 18), rrule: "FREQ=MONTHLY;BYDAY=5FR" },
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-12-31T23:59:59Z"),
      NY,
    );
    expect(occ.map((o) => wallClock(o.start, NY).month)).toEqual([1, 5, 7, 10]);
  });

  it("expands weekly rules and one-off events", () => {
    const weekly = expandEvent(
      { id: "w", title: "Practice", startsAt: ny(2026, 1, 5, 19), rrule: "FREQ=WEEKLY;BYDAY=MO" },
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-01-31T23:59:59Z"),
      NY,
    );
    expect(weekly.map((o) => wallClock(o.start, NY).day)).toEqual([5, 12, 19, 26]);
    const single = { id: "s", title: "Installation", startsAt: ny(2026, 12, 12, 18), endsAt: ny(2026, 12, 12, 20) };
    expect(expandEvent(single, new Date("2026-12-01T00:00:00Z"), new Date("2026-12-31T00:00:00Z"), NY)).toHaveLength(1);
    expect(expandEvent(single, new Date("2026-01-01T00:00:00Z"), new Date("2026-01-31T00:00:00Z"), NY)).toHaveLength(0);
  });

  it("caps runaway rules", () => {
    const occ = expandEvent(
      { id: "d", title: "Daily", startsAt: ny(2020, 1, 1, 9), rrule: "FREQ=DAILY" },
      new Date("2020-01-01T00:00:00Z"),
      new Date("2030-01-01T00:00:00Z"),
      NY,
    );
    expect(occ.length).toBeLessThanOrEqual(500);
  });

  it("sorts merged occurrences and finds the next one", () => {
    const events = [stated, { id: "w", title: "Practice", startsAt: ny(2026, 1, 5, 19), rrule: "FREQ=WEEKLY;BYDAY=MO" }];
    const all = expandEvents(events, new Date("2026-01-01T00:00:00Z"), new Date("2026-01-31T23:59:59Z"), NY);
    expect(all.map((o) => o.title)).toEqual(["Practice", "Practice", "Stated Communication", "Practice", "Practice"]);
    const next = nextOccurrence(stated, new Date("2026-06-15T00:00:00Z"), NY);
    expect(wallClock(next!.start, NY)).toMatchObject({ month: 7, day: 14 });
  });
});

describe("iCal export", () => {
  it("emits RRULE and timezone information", () => {
    const ics = buildLodgeCalendar(
      { name: "Demo Lodge", number: "1", slug: "demo-lodge", timezone: NY },
      [
        { id: "e1", title: "Stated Communication", startsAt: ny(2026, 1, 13, 19, 30), endsAt: ny(2026, 1, 13, 21, 30), rrule: "FREQ=MONTHLY;BYDAY=2TU" },
        { id: "e2", title: "Installation", startsAt: ny(2026, 12, 12, 18), until: null },
      ],
      "http://demo-lodge.tyled.test:3000/",
    );
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("RRULE:FREQ=MONTHLY;BYDAY=2TU");
    expect(ics).toContain("SUMMARY:Stated Communication");
    expect(ics).toContain("TZID=America/New_York");
    expect(ics).toContain("DTSTART;TZID=America/New_York:20260113T193000");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});
