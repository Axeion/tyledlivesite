import type { ThemeKit } from "@/templates/shared/kit";
import { navItems, renderInnerPage } from "@/templates/shared/render";
import { ContactBlock, EventList, OfficerList, PreviewBanner, RichText } from "@/templates/shared/sections";
import type { TemplateProps } from "@/templates/types";

/** Minimal: single column, generous whitespace, monochrome. */
export const minimalKit: ThemeKit = {
  main: "mx-auto max-w-2xl px-6 py-12",
  section: "mb-14",
  h1: "text-2xl font-medium tracking-tight mb-6",
  h2: "text-xl font-medium tracking-tight",
  h3: "text-base font-medium",
  card: "border-t border-neutral-200 py-4",
  button: "inline-block border-b border-neutral-900 text-sm hover:opacity-60",
  link: "underline underline-offset-4 hover:opacity-60",
  muted: "text-neutral-500",
  prose: "rich-text max-w-none",
  badge: "text-xs uppercase tracking-wider text-neutral-500",
  calendarCell: "min-h-20 bg-white p-1 align-top",
  calendarCellMuted: "min-h-20 bg-neutral-50 p-1 text-neutral-300",
  calendarEvent: "mb-0.5 truncate border-l-2 border-neutral-900 pl-1 text-[10px]",
};

export default function MinimalTemplate({ data, page }: TemplateProps) {
  const l = data.lodge;
  const kit = minimalKit;
  return (
    <div className="min-h-screen bg-white text-neutral-900" data-template="minimal">
      <PreviewBanner data={data} />
      <header className="mx-auto max-w-2xl px-6 pt-12">
        <a href={data.links.home} className="block">
          {l.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.logoUrl} alt="" className="mb-4 h-12 w-12 object-contain" />
          ) : null}
          <span className="block text-sm uppercase tracking-[0.2em] text-neutral-500">
            {l.jurisdiction} · No. {l.number}
          </span>
          <span className="block text-3xl font-medium tracking-tight">{l.name}</span>
        </a>
        <nav aria-label="Main" className="mt-6 border-b border-neutral-200 pb-4">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {navItems(data).map((n) => (
              <li key={n.href}>
                <a href={n.href} className="hover:opacity-60">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className={kit.main}>
        {page.kind === "home" ? (
          <>
            {l.tagline ? <p className="mb-10 text-xl leading-relaxed">{l.tagline}</p> : null}
            {l.meetingSchedule ? <p className={`${kit.muted} mb-10 whitespace-pre-line`}>{l.meetingSchedule}</p> : null}
            {l.aboutHtml ? (
              <section className={kit.section}>
                <RichText html={l.aboutHtml} kit={kit} />
              </section>
            ) : null}
            <section className={kit.section}>
              <h2 className={`${kit.h2} mb-2`}>Events</h2>
              <EventList data={data} kit={kit} occurrences={data.upcomingEvents.slice(0, 3)} />
              <p className="mt-4 text-sm">
                <a href={data.links.events} className={kit.link}>
                  All events
                </a>
              </p>
            </section>
            <section className={kit.section}>
              <h2 className={`${kit.h2} mb-2`}>Officers</h2>
              <OfficerList data={data} kit={kit} />
            </section>
            <section className={kit.section}>
              <h2 className={`${kit.h2} mb-4`}>Visit</h2>
              <ContactBlock data={data} kit={kit} />
            </section>
          </>
        ) : (
          renderInnerPage(page, data, kit)
        )}
      </main>

      <footer className="mx-auto max-w-2xl px-6 pb-12 text-xs text-neutral-500">
        © {new Date().getFullYear()} {l.name} No. {l.number} · tyled.live
      </footer>
    </div>
  );
}
