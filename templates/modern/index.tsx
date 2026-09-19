import type { ThemeKit } from "@/templates/shared/kit";
import { navItems, renderInnerPage } from "@/templates/shared/render";
import { ContactBlock, EventList, OfficerList, PreviewBanner, RichText } from "@/templates/shared/sections";
import type { TemplateProps } from "@/templates/types";

/** Modern: dark hero, bold sans-serif type, card grid. */
export const modernKit: ThemeKit = {
  main: "mx-auto max-w-6xl px-4 py-12",
  section: "mb-16",
  h1: "text-4xl font-bold tracking-tight text-slate-900 mb-6",
  h2: "text-2xl font-bold tracking-tight text-slate-900",
  h3: "text-lg font-semibold text-slate-900",
  card: "rounded-2xl bg-white p-5 shadow-md ring-1 ring-slate-900/5",
  button: "inline-block rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700",
  link: "font-medium text-indigo-600 hover:text-indigo-800",
  muted: "text-slate-500",
  prose: "rich-text max-w-none",
  badge: "rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700",
  calendarCell: "min-h-20 bg-white p-1 align-top",
  calendarCellMuted: "min-h-20 bg-slate-50 p-1 text-slate-300",
  calendarEvent: "mb-0.5 truncate rounded-md bg-indigo-600 px-1 py-0.5 text-[10px] text-white",
};

export default function ModernTemplate({ data, page }: TemplateProps) {
  const l = data.lodge;
  const kit = modernKit;
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" data-template="modern">
      <PreviewBanner data={data} />
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <a href={data.links.home} className="flex items-center gap-3">
            {l.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.logoUrl} alt="" className="h-10 w-10 rounded-lg object-contain" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
                {l.number}
              </span>
            )}
            <span className="text-lg font-bold tracking-tight">{l.name}</span>
          </a>
          <nav aria-label="Main">
            <ul className="flex flex-wrap gap-1 text-sm font-medium">
              {navItems(data).map((n) => (
                <li key={n.href}>
                  <a href={n.href} className="rounded-full px-3 py-1.5 hover:bg-slate-100">
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      {page.kind === "home" ? (
        <section className="bg-slate-900 text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-20 md:grid-cols-[1fr_auto]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-indigo-300">
                {l.jurisdiction} · Lodge No. {l.number}
              </p>
              <h1 className="mt-3 text-5xl font-bold tracking-tight">{l.name}</h1>
              {l.tagline ? <p className="mt-4 max-w-xl text-lg text-slate-300">{l.tagline}</p> : null}
              {l.meetingSchedule ? <p className="mt-6 text-sm text-slate-300">{l.meetingSchedule}</p> : null}
              <a href={data.links.contact} className="mt-8 inline-block rounded-full bg-indigo-500 px-5 py-2 font-medium hover:bg-indigo-400">
                Plan a visit
              </a>
            </div>
            {l.sealUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.sealUrl} alt={`${l.name} seal`} className="h-40 w-40 object-contain" />
            ) : null}
          </div>
        </section>
      ) : null}

      <main className={kit.main}>
        {page.kind === "home" ? (
          <>
            {l.aboutHtml ? (
              <section className={kit.section}>
                <h2 className={`${kit.h2} mb-4`}>About</h2>
                <RichText html={l.aboutHtml} kit={kit} />
              </section>
            ) : null}
            <div className="grid gap-12 lg:grid-cols-2">
              <section>
                <h2 className={`${kit.h2} mb-4`}>Upcoming</h2>
                <EventList data={data} kit={kit} occurrences={data.upcomingEvents.slice(0, 3)} />
                <p className="mt-4">
                  <a href={data.links.events} className={kit.link}>
                    See all events →
                  </a>
                </p>
              </section>
              <section>
                <h2 className={`${kit.h2} mb-4`}>Officers</h2>
                <OfficerList data={data} kit={kit} />
              </section>
            </div>
            <section className={`${kit.section} mt-16`}>
              <h2 className={`${kit.h2} mb-4`}>Find us</h2>
              <ContactBlock data={data} kit={kit} />
            </section>
          </>
        ) : (
          renderInnerPage(page, data, kit)
        )}
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} {l.name} No. {l.number} · Powered by tyled.live
      </footer>
    </div>
  );
}
