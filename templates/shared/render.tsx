import { buildMonthGrid } from "@/lib/events/calendar";
import type { ThemeKit } from "@/templates/shared/kit";
import { ContactBlock, EventList, Gallery, MonthCalendar, OfficerList, RichText } from "@/templates/shared/sections";
import type { LodgeSiteData, SitePage } from "@/templates/types";

/**
 * Renders the body of a site page using the shared sections and a theme kit.
 * Themes wrap this in their own layout; the home page is theme-specific.
 */
export function renderInnerPage(page: SitePage, data: LodgeSiteData, kit: ThemeKit) {
  switch (page.kind) {
    case "events":
      return (
        <section className={kit.section}>
          <h1 className={kit.h1}>Upcoming Events</h1>
          <p className={`${kit.muted} mb-6`}>
            <a className={kit.link} href={data.links.calendar}>
              Calendar view
            </a>{" "}
            ·{" "}
            <a className={kit.link} href={data.links.ical}>
              Subscribe (iCal)
            </a>
          </p>
          <EventList data={data} kit={kit} occurrences={data.upcomingEvents} />
        </section>
      );
    case "calendar": {
      const grid = buildMonthGrid(page.year, page.month, page.occurrences, data.lodge.timezone);
      return (
        <section className={kit.section}>
          <h1 className={kit.h1}>Calendar</h1>
          <MonthCalendar data={data} kit={kit} grid={grid} />
        </section>
      );
    }
    case "officers":
      return (
        <section className={kit.section}>
          <h1 className={kit.h1}>Lodge Officers</h1>
          <OfficerList data={data} kit={kit} />
        </section>
      );
    case "gallery":
      return (
        <section className={kit.section}>
          <h1 className={kit.h1}>Gallery</h1>
          <Gallery data={data} kit={kit} />
        </section>
      );
    case "contact":
      return (
        <section className={kit.section}>
          <h1 className={kit.h1}>Visit Us</h1>
          <ContactBlock data={data} kit={kit} />
        </section>
      );
    case "page": {
      const p = data.pages.find((x) => x.slug === page.slug);
      if (!p) return null;
      return (
        <section className={kit.section}>
          <h1 className={kit.h1}>{p.title}</h1>
          <RichText html={p.bodyHtml} kit={kit} />
        </section>
      );
    }
    case "home":
    default:
      return null;
  }
}

export function navItems(data: LodgeSiteData): { href: string; label: string }[] {
  return [
    { href: data.links.home, label: "Home" },
    { href: data.links.events, label: "Events" },
    { href: data.links.officers, label: "Officers" },
    ...(data.gallery.length > 0 ? [{ href: data.links.gallery, label: "Gallery" }] : []),
    ...data.pages.map((p) => ({ href: data.links.page(p.slug), label: p.title })),
    { href: data.links.contact, label: "Contact" },
  ];
}
