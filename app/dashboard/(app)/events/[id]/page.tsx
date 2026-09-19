import { notFound } from "next/navigation";
import { ActionButton } from "@/components/ActionForm";
import { EventForm } from "@/components/EventForm";
import { deleteEvent, saveEvent } from "@/lib/actions/lodge";
import { requireDashboard } from "@/lib/dashboard";
import { toFloating } from "@/lib/events/timezone";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { lodge, db } = await requireDashboard("EDITOR", { redirect: true });
  const { id } = await params;
  const event = await db.event.findUnique({ where: { id } });
  if (!event) notFound();
  const tz = lodge.timezone;
  const local = (d: Date | null) => (d ? toFloating(d, tz).toISOString().slice(0, 16) : "");
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Edit event</h2>
      <EventForm
        action={saveEvent}
        submitLabel="Save event"
        timezone={tz}
        initial={{
          id: event.id,
          title: event.title,
          description: event.description ?? "",
          location: event.location ?? "",
          allDay: event.allDay,
          startsAt: local(event.startsAt),
          endsAt: local(event.endsAt),
          rrule: event.rrule ?? "",
          until: event.until ? local(event.until).slice(0, 10) : "",
        }}
      />
      <ActionButton action={deleteEvent} label="Delete event" className="btn-danger" hidden={{ id: event.id }} confirm="Delete this event and all its occurrences?" />
    </div>
  );
}
