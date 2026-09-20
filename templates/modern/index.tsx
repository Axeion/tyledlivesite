import { ThemeToggle } from "@/components/ThemeToggle";
import type { ThemeKit } from "@/templates/shared/kit";
import { navItems, renderInnerPage } from "@/templates/shared/render";
import { ContactBlock, EventList, OfficerList, PreviewBanner, RichText } from "@/templates/shared/sections";
import type { TemplateProps } from "@/templates/types";

/**
 * Modern: dark hero, bold sans-serif type, card grid.
 * Colours come from the `[data-template="modern"]` tokens in globals.css, which
 * have a second set of values under `.dark`.
 */
export const modernKit: ThemeKit = {
  main: "mx-auto max-w-6xl px-4 py-12",
  section: "mb-16",
  h1: "text-4xl font-bold tracking-tight text-[var(--t-heading)] mb-6",
  h2: "text-2xl font-bold tracking-tight text-[var(--t-heading)]",
  h3: "text-lg font-semibold text-[var(--t-heading)]",
  card: "rounded-2xl bg-[var(--t-surface)] p-5 shadow-md ring-1 ring-[var(--t-border)]",
  button: "inline-block rounded-full bg-[var(--t-primary)] px-4 py-1.5 text-sm font-medium text-[var(--t-on-primary)] hover:opacity-90",
  link: "font-medium text-[var(--t-link)] hover:opacity-80",
  muted: "text-[var(--t-muted)]",
  prose: "rich-text max-w-none",
  badge: "rounded-full bg-[var(--t-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--t-accent-fg)]",
  calendarCell: "min-h-20 bg-[var(--t-surface)] p-1 align-top",
  calendarCellMuted: "min-h-20 bg-[var(--t-bg)] p-1 text-[var(--t-muted)]",
  calendarEvent: "mb-0.5 truncate rounded-md bg-[var(--t-accent)] px-1 py-0.5 text-[10px] text-white",
};

export default function ModernTemplate({ data, page }: TemplateProps) {
  const l = data.lodge;
  const kit = modernKit;
  return (
    <div className="min-h-screen bg-[var(--t-bg)] text-[var(--t-fg)]" data-template="modern">
      <PreviewBanner data={data} />
      <header className="sticky top-0 z-10 border-b border-[var(--t-border)] bg-[var(--t-surface)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <a href={data.links.home} className="flex items-center gap-3">
            {l.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.logoUrl} alt="" className="h-10 w-10 rounded-lg object-contain" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--t-accent)] text-sm font-bold text-white">
                {l.number}
              </span>
            )}
            <span className="text-lg font-bold tracking-tight">{l.name}</span>
          </a>
          <div className="flex items-center gap-2">
            <nav aria-label="Main">
              <ul className="flex flex-wrap gap-1 text-sm font-medium">
                {navItems(data).map((n) => (
                  <li key={n.href}>
                    <a href={n.href} className="rounded-full px-3 py-1.5 hover:bg-[var(--t-accent-soft)]">
                      {n.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {page.kind === "home" ? (
        <section className="bg-[var(--t-hero)] text-[var(--t-hero-fg)]">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-20 md:grid-cols-[1fr_auto]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-[var(--t-hero-accent)]">
                {l.jurisdiction} · Lodge No. {l.number}
              </p>
              <h1 className="mt-3 text-5xl font-bold tracking-tight">{l.name}</h1>
              {l.tagline ? <p className="mt-4 max-w-xl text-lg text-[var(--t-hero-muted)]">{l.tagline}</p> : null}
              {l.meetingSchedule ? <p className="mt-6 text-sm text-[var(--t-hero-muted)]">{l.meetingSchedule}</p> : null}
              <a href={data.links.contact} className="mt-8 inline-block rounded-full bg-[var(--t-accent)] px-5 py-2 font-medium text-white hover:opacity-90">
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

      <footer className="border-t border-[var(--t-border)] py-8 text-center text-sm text-[var(--t-muted)]">
        © {new Date().getFullYear()} {l.name} No. {l.number} · Powered by tyled.live
      </footer>
    </div>
  );
}
