import Link from "next/link";
import { EventForm } from "@/components/EventForm";
import { saveEvent } from "@/lib/actions/lodge";
import { requireDashboard } from "@/lib/dashboard";
import { describeRRule, nextOccurrence } from "@/lib/events/recurrence";
import { formatInTz, toFloating } from "@/lib/events/timezone";
import { lodgeSubdomainUrl } from "@/lib/urls";

export function toLocalInput(d: Date | null | undefined, tz: string): string {
  if (!d) return "";
  return toFloating(d, tz).toISOString().slice(0, 16);
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { lodge, db } = await requireDashboard("EDITOR", { redirect: true });
  const { saved } = await searchParams;
  const events = await db.event.findMany({ orderBy: { startsAt: "asc" } });
  const now = new Date();
  const tz = lodge.timezone;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Events</h2>
        <a className="text-sm text-indigo-600 underline" href={lodgeSubdomainUrl(lodge.slug, "/calendar.ics")}>
          iCal feed
        </a>
      </div>
      {saved ? <p className="alert-success">Event saved.</p> : null}
      <ul className="card divide-y divide-neutral-100" data-testid="event-list">
        {events.length === 0 ? <li className="py-2 text-sm text-neutral-500">No events yet.</li> : null}
        {events.map((e) => {
          const next = nextOccurrence(e, now, tz);
          return (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <Link href={`/dashboard/events/${e.id}`} className="font-medium text-indigo-600 underline">
                  {e.title}
                </Link>
                <div className="text-sm text-neutral-600">
                  {describeRRule(e.rrule)} · starts {formatInTz(e.startsAt, tz)}
                  {next ? ` · next: ${formatInTz(next.start, tz)}` : e.rrule ? " · no upcoming occurrences" : ""}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <h3 className="font-semibold">Add an event</h3>
      <EventForm
        action={saveEvent}
        submitLabel="Create event"
        timezone={tz}
        initial={{ title: "", description: "", location: "", allDay: false, startsAt: toLocalInput(new Date(now.getTime() + 7 * 24 * 3600 * 1000), tz).slice(0, 11) + "19:30", endsAt: "", rrule: "", until: "" }}
      />
    </div>
  );
}
