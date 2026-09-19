import { monthRange, parseMonthParam } from "@/lib/events/calendar";
import { expandEvents } from "@/lib/events/recurrence";
import { renderSitePage, requireSiteLodge, siteMetadata } from "@/lib/site-render";
import { tenantDb } from "@/lib/tenant-db";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return siteMetadata("Calendar");
}

export default async function SiteCalendar({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const lodge = await requireSiteLodge();
  const { month } = await searchParams;
  const { year, month: m } = parseMonthParam(month, new Date(), lodge.timezone);
  const range = monthRange(year, m);
  const events = await tenantDb(lodge.id).event.findMany();
  const occurrences = expandEvents(events, range.start, range.end, lodge.timezone);
  return renderSitePage({ kind: "calendar", year, month: m, occurrences });
}
