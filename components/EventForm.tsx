"use client";

import { useMemo, useState } from "react";
import { ActionForm, type FormAction } from "@/components/ActionForm";
import { WEEKDAY_CODES, WEEKDAY_LABELS, buildRRule, describeRRule, type RecurrencePreset, type WeekdayCode } from "@/lib/events/recurrence";

export interface EventFormValues {
  id?: string;
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  /** Wall-clock values in the lodge timezone, "YYYY-MM-DDTHH:mm" */
  startsAt: string;
  endsAt: string;
  rrule: string;
  /** "YYYY-MM-DD" */
  until: string;
}

type Kind = "none" | "weekly" | "monthlyNthWeekday" | "monthlyDate" | "yearly" | "custom";

function inferPreset(rrule: string): { kind: Kind; nth: number; weekday: WeekdayCode; weekdays: WeekdayCode[]; day: number; interval: number } {
  const base = { kind: "none" as Kind, nth: 2, weekday: "TU" as WeekdayCode, weekdays: ["TU"] as WeekdayCode[], day: 1, interval: 1 };
  if (!rrule) return base;
  const parts = Object.fromEntries(rrule.split(";").map((p) => p.split("=") as [string, string]));
  const interval = Number(parts.INTERVAL ?? 1) || 1;
  if (parts.FREQ === "YEARLY" && Object.keys(parts).length <= 2) return { ...base, kind: "yearly", interval };
  if (parts.FREQ === "WEEKLY" && parts.BYDAY && !parts.BYMONTHDAY) {
    const days = parts.BYDAY.split(",").filter((d) => (WEEKDAY_CODES as readonly string[]).includes(d)) as WeekdayCode[];
    if (days.length) return { ...base, kind: "weekly", weekdays: days, interval };
  }
  if (parts.FREQ === "MONTHLY" && parts.BYDAY) {
    const m = parts.BYDAY.match(/^([+-]?\d)(MO|TU|WE|TH|FR|SA|SU)$/);
    if (m) return { ...base, kind: "monthlyNthWeekday", nth: Number(m[1]), weekday: m[2] as WeekdayCode, interval };
  }
  if (parts.FREQ === "MONTHLY" && parts.BYMONTHDAY) {
    return { ...base, kind: "monthlyDate", day: Number(parts.BYMONTHDAY.split(",")[0]) || 1, interval };
  }
  return { ...base, kind: "custom" };
}

export function EventForm({ action, initial, timezone, submitLabel }: { action: FormAction; initial: EventFormValues; timezone: string; submitLabel: string }) {
  const inferred = useMemo(() => inferPreset(initial.rrule), [initial.rrule]);
  const [kind, setKind] = useState<Kind>(inferred.kind);
  const [nth, setNth] = useState(inferred.nth);
  const [weekday, setWeekday] = useState<WeekdayCode>(inferred.weekday);
  const [weekdays, setWeekdays] = useState<WeekdayCode[]>(inferred.weekdays);
  const [day, setDay] = useState(inferred.day);
  const [interval, setInterval] = useState(inferred.interval);
  const [custom, setCustom] = useState(inferred.kind === "custom" ? initial.rrule : "");
  const [allDay, setAllDay] = useState(initial.allDay);

  const rrule = useMemo(() => {
    try {
      let preset: RecurrencePreset;
      switch (kind) {
        case "none":
          return "";
        case "custom":
          return custom.trim();
        case "weekly":
          preset = { kind, weekdays, interval };
          break;
        case "monthlyNthWeekday":
          preset = { kind, nth: nth as 1 | 2 | 3 | 4 | -1, weekday, interval };
          break;
        case "monthlyDate":
          preset = { kind, day, interval };
          break;
        case "yearly":
          preset = { kind };
          break;
      }
      return buildRRule(preset) ?? "";
    } catch {
      return "";
    }
  }, [kind, nth, weekday, weekdays, day, interval, custom]);

  return (
    <ActionForm action={action} submitLabel={submitLabel} className="card grid gap-4">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="rrule" value={rrule} data-testid="rrule-value" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" className="field" defaultValue={initial.title} required />
        </div>
        <div>
          <label className="label" htmlFor="startsAt">Starts ({timezone})</label>
          <input id="startsAt" name="startsAt" type={allDay ? "date" : "datetime-local"} className="field" defaultValue={allDay ? initial.startsAt.slice(0, 10) : initial.startsAt} required />
        </div>
        <div>
          <label className="label" htmlFor="endsAt">Ends</label>
          <input id="endsAt" name="endsAt" type={allDay ? "date" : "datetime-local"} className="field" defaultValue={allDay ? initial.endsAt.slice(0, 10) : initial.endsAt} />
        </div>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All-day event
        </label>
        <div className="md:col-span-2">
          <label className="label" htmlFor="location">Location</label>
          <input id="location" name="location" className="field" defaultValue={initial.location} />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={3} className="field" defaultValue={initial.description} />
        </div>
      </div>

      <fieldset className="rounded-md border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-medium">Repeats</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="repeat-kind">Frequency</label>
            <select id="repeat-kind" className="field" value={kind} onChange={(e) => setKind(e.target.value as Kind)} data-testid="repeat-kind">
              <option value="none">Does not repeat</option>
              <option value="weekly">Weekly on chosen days</option>
              <option value="monthlyNthWeekday">Monthly on the Nth weekday (e.g. 2nd Tuesday)</option>
              <option value="monthlyDate">Monthly on a date</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom RRULE</option>
            </select>
          </div>
          {kind !== "none" && kind !== "custom" && kind !== "yearly" ? (
            <div>
              <label className="label" htmlFor="interval">Every</label>
              <div className="flex items-center gap-2">
                <input id="interval" type="number" min={1} max={52} className="field w-24" value={interval} onChange={(e) => setInterval(Number(e.target.value) || 1)} />
                <span className="text-sm text-neutral-600">{kind === "weekly" ? "week(s)" : "month(s)"}</span>
              </div>
            </div>
          ) : null}
          {kind === "weekly" ? (
            <div className="md:col-span-2 flex flex-wrap gap-3">
              {WEEKDAY_CODES.map((d) => (
                <label key={d} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={weekdays.includes(d)}
                    onChange={(e) => setWeekdays((w) => (e.target.checked ? [...w, d] : w.filter((x) => x !== d)))}
                  />
                  {WEEKDAY_LABELS[d]}
                </label>
              ))}
            </div>
          ) : null}
          {kind === "monthlyNthWeekday" ? (
            <>
              <div>
                <label className="label" htmlFor="nth">Week</label>
                <select id="nth" className="field" value={nth} onChange={(e) => setNth(Number(e.target.value))} data-testid="repeat-nth">
                  <option value={1}>1st</option>
                  <option value={2}>2nd</option>
                  <option value={3}>3rd</option>
                  <option value={4}>4th</option>
                  <option value={-1}>Last</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="weekday">Weekday</label>
                <select id="weekday" className="field" value={weekday} onChange={(e) => setWeekday(e.target.value as WeekdayCode)} data-testid="repeat-weekday">
                  {WEEKDAY_CODES.map((d) => (
                    <option key={d} value={d}>{WEEKDAY_LABELS[d]}</option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
          {kind === "monthlyDate" ? (
            <div>
              <label className="label" htmlFor="day">Day of month</label>
              <input id="day" type="number" min={1} max={31} className="field w-24" value={day} onChange={(e) => setDay(Number(e.target.value) || 1)} />
            </div>
          ) : null}
          {kind === "custom" ? (
            <div className="md:col-span-2">
              <label className="label" htmlFor="custom">RRULE (RFC 5545, without DTSTART/UNTIL)</label>
              <input id="custom" className="field font-mono" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="FREQ=MONTHLY;BYDAY=2TU" />
            </div>
          ) : null}
          {kind !== "none" ? (
            <div>
              <label className="label" htmlFor="until">Repeat until (optional)</label>
              <input id="until" name="until" type="date" className="field" defaultValue={initial.until} />
            </div>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-neutral-600" data-testid="repeat-summary">
          {rrule ? `Repeats ${describeRRule(rrule)}` : "One-time event"} {rrule ? <code className="ml-2 text-xs text-neutral-400">{rrule}</code> : null}
        </p>
      </fieldset>
    </ActionForm>
  );
}
