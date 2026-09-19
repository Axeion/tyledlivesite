import Link from "next/link";
import type { Occurrence } from "@/lib/events/recurrence";
import { formatInTz } from "@/lib/events/timezone";
import type { MonthGrid } from "@/lib/events/calendar";
import LodgeMap from "@/templates/shared/LodgeMap";
import type { ThemeKit } from "@/templates/shared/kit";
import type { LodgeSiteData } from "@/templates/types";

export function formatOccurrence(o: Occurrence, tz: string): string {
  if (o.allDay) return formatInTz(o.start, tz, { dateStyle: "full" });
  const date = formatInTz(o.start, tz, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const start = formatInTz(o.start, tz, { hour: "numeric", minute: "2-digit" });
  if (!o.end) return `${date} · ${start}`;
  const end = formatInTz(o.end, tz, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${start}–${end}`;
}

export function PreviewBanner({ data }: { data: LodgeSiteData }) {
  if (!data.preview) return null;
  return (
    <div data-testid="preview-banner" className="bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950">
      Preview mode. This is how your site will look to visitors.
    </div>
  );
}

export function EventList({ data, kit, occurrences, emptyText = "No upcoming events." }: {
  data: LodgeSiteData;
  kit: ThemeKit;
  occurrences: Occurrence[];
  emptyText?: string;
}) {
  const tz = data.lodge.timezone;
  if (occurrences.length === 0) return <p className={kit.muted}>{emptyText}</p>;
  return (
    <ul data-testid="event-list" className="space-y-4">
      {occurrences.map((o) => (
        <li key={`${o.eventId}-${o.start.toISOString()}`} className={kit.card}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className={kit.h3}>{o.title}</h3>
            {o.recurring ? <span className={kit.badge}>Recurring</span> : null}
          </div>
          <p className="mt-1 text-sm font-medium">{formatOccurrence(o, tz)}</p>
          {o.location ? <p className={`${kit.muted} text-sm`}>{o.location}</p> : null}
          {o.description ? <p className="mt-2 text-sm whitespace-pre-line">{o.description}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export function MonthCalendar({ data, kit, grid }: { data: LodgeSiteData; kit: ThemeKit; grid: MonthGrid }) {
  const tz = data.lodge.timezone;
  const monthParam = (m: { year: number; month: number }) => `${m.year}-${String(m.month).padStart(2, "0")}`;
  return (
    <div data-testid="month-calendar">
      <div className="mb-4 flex items-center justify-between">
        <Link className={kit.button} href={`${data.links.calendar}?month=${monthParam(grid.prev)}`}>
          ← Prev
        </Link>
        <h2 className={kit.h2}>{grid.label}</h2>
        <Link className={kit.button} href={`${data.links.calendar}?month=${monthParam(grid.next)}`}>
          Next →
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-current/10 bg-current/10 text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-white/80 px-2 py-1 text-center font-semibold uppercase tracking-wide">
            {d}
          </div>
        ))}
        {grid.weeks.flat().map((day) => (
          <div key={day.date} className={day.inMonth ? kit.calendarCell : kit.calendarCellMuted} data-date={day.date}>
            <div className="mb-1 text-right font-medium">{day.day}</div>
            {day.occurrences.map((o) => (
              <div key={`${o.eventId}-${o.start.toISOString()}`} className={kit.calendarEvent} title={o.title}>
                {o.allDay ? "" : formatInTz(o.start, tz, { hour: "numeric", minute: "2-digit" }) + " "}
                {o.title}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className={`${kit.muted} mt-3 text-sm`}>
        Subscribe:{" "}
        <a className={kit.link} href={data.links.ical}>
          iCal feed
        </a>
      </p>
    </div>
  );
}

export function OfficerList({ data, kit }: { data: LodgeSiteData; kit: ThemeKit }) {
  if (data.officers.length === 0) return <p className={kit.muted}>Officers have not been listed yet.</p>;
  return (
    <ul data-testid="officer-list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.officers.map((o) => (
        <li key={o.id} className={kit.card}>
          <div className={`${kit.muted} text-xs font-semibold uppercase tracking-wider`}>{o.title}</div>
          <div className="mt-1 text-lg font-medium">{o.name}</div>
        </li>
      ))}
    </ul>
  );
}

export function Gallery({ data, kit }: { data: LodgeSiteData; kit: ThemeKit }) {
  if (data.gallery.length === 0) return <p className={kit.muted}>No photos yet.</p>;
  return (
    <ul data-testid="gallery" className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {data.gallery.map((g) => (
        <li key={g.id} className="overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={g.url} alt={g.caption ?? ""} className="aspect-[4/3] w-full object-cover" loading="lazy" />
          {g.caption ? <p className={`${kit.muted} mt-1 text-sm`}>{g.caption}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export function ContactBlock({ data, kit, showMap = true }: { data: LodgeSiteData; kit: ThemeKit; showMap?: boolean }) {
  const l = data.lodge;
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-4">
        {l.meetingSchedule ? (
          <div>
            <h3 className={kit.h3}>Meetings</h3>
            <p className="whitespace-pre-line">{l.meetingSchedule}</p>
          </div>
        ) : null}
        {l.address.formatted ? (
          <div>
            <h3 className={kit.h3}>Address</h3>
            <address className="not-italic whitespace-pre-line" data-testid="address">
              {[l.address.line1, l.address.line2, [l.address.city, l.address.region, l.address.postalCode].filter(Boolean).join(", ")]
                .filter(Boolean)
                .join("\n")}
            </address>
          </div>
        ) : null}
        {l.contactEmail || l.contactPhone || l.website ? (
          <div>
            <h3 className={kit.h3}>Contact</h3>
            <ul className="space-y-1">
              {l.contactEmail ? (
                <li>
                  <a className={kit.link} href={`mailto:${l.contactEmail}`}>
                    {l.contactEmail}
                  </a>
                </li>
              ) : null}
              {l.contactPhone ? (
                <li>
                  <a className={kit.link} href={`tel:${l.contactPhone}`}>
                    {l.contactPhone}
                  </a>
                </li>
              ) : null}
              {l.website ? (
                <li>
                  <a className={kit.link} href={l.website} rel="noopener noreferrer">
                    {l.website}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
      {showMap && l.lat !== null && l.lng !== null ? (
        <LodgeMap lat={l.lat} lng={l.lng} label={`${l.name} No. ${l.number}`} address={l.address.formatted} />
      ) : showMap ? (
        <div className={`${kit.muted} rounded-lg border border-dashed border-current/30 p-6 text-sm`} data-testid="map-pending">
          Map will appear once the lodge address has been located.
        </div>
      ) : null}
    </div>
  );
}

export function RichText({ html, kit }: { html: string; kit: ThemeKit }) {
  // html is sanitized by lib/sanitize.ts before it is stored.
  return <div className={kit.prose} dangerouslySetInnerHTML={{ __html: html }} />;
}
