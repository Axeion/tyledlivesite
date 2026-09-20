import { ThemeToggle } from "@/components/ThemeToggle";
import type { ThemeKit } from "@/templates/shared/kit";
import { navItems, renderInnerPage } from "@/templates/shared/render";
import { ContactBlock, EventList, OfficerList, PreviewBanner, RichText } from "@/templates/shared/sections";
import type { TemplateProps } from "@/templates/types";

/**
 * Classic: navy and gold, serif headings, traditional lodge feel.
 * Colours come from the `[data-template="classic"]` tokens in globals.css, which
 * have a second set of values under `.dark`.
 */
export const classicKit: ThemeKit = {
  main: "mx-auto max-w-5xl px-4 py-10",
  section: "mb-12",
  h1: "font-serif text-3xl font-semibold text-[var(--t-heading)] mb-4",
  h2: "font-serif text-2xl font-semibold text-[var(--t-heading)]",
  h3: "font-serif text-lg font-semibold text-[var(--t-heading)]",
  card: "rounded border border-[var(--t-border)] bg-[var(--t-surface)] p-4 shadow-sm",
  button: "inline-block rounded border border-[var(--t-link)] px-3 py-1 text-sm text-[var(--t-link)] hover:bg-[var(--t-link)] hover:text-[var(--t-on-primary)]",
  link: "text-[var(--t-link)] underline decoration-[var(--t-accent)] underline-offset-2 hover:text-[var(--t-accent)]",
  muted: "text-[var(--t-muted)]",
  prose: "rich-text rich-text-serif max-w-none",
  badge: "rounded-full bg-[var(--t-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--t-accent-fg)]",
  calendarCell: "min-h-20 bg-[var(--t-surface)] p-1 align-top",
  calendarCellMuted: "min-h-20 bg-[var(--t-accent-soft)] p-1 text-[var(--t-muted)]",
  calendarEvent: "mb-0.5 truncate rounded bg-[var(--t-primary)] px-1 py-0.5 text-[10px] text-[var(--t-on-primary)]",
};

export default function ClassicTemplate({ data, page }: TemplateProps) {
  const l = data.lodge;
  const kit = classicKit;
  return (
    <div className="min-h-screen bg-[var(--t-bg)] text-[var(--t-fg)]" data-template="classic">
      <PreviewBanner data={data} />
      <header className="border-b-4 border-[var(--t-accent)] bg-[var(--t-primary)] text-[var(--t-on-primary)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-6">
          <a href={data.links.home} className="flex items-center gap-4">
            {l.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.logoUrl} alt="" className="h-14 w-14 rounded-full bg-white object-contain p-1" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--t-accent)] font-serif text-xl">
                {l.number}
              </span>
            )}
            <span>
              <span className="block font-serif text-2xl font-semibold">{l.name}</span>
              <span className="block text-sm text-[var(--t-accent)]">
                No. {l.number} · {l.jurisdiction}
              </span>
            </span>
          </a>
          <div className="flex items-center gap-4">
            <nav aria-label="Main">
              <ul className="flex flex-wrap gap-4 text-sm uppercase tracking-wide">
                {navItems(data).map((n) => (
                  <li key={n.href}>
                    <a href={n.href} className="hover:text-[var(--t-accent)]">
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

      <main className={kit.main}>
        {page.kind === "home" ? (
          <>
            <section className="mb-12 text-center">
              {l.sealUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.sealUrl} alt={`${l.name} seal`} className="mx-auto mb-6 h-32 w-32 object-contain" />
              ) : null}
              <h1 className="font-serif text-4xl font-semibold text-[var(--t-heading)]">
                {l.name} No. {l.number}
              </h1>
              {l.tagline ? <p className="mt-3 text-lg">{l.tagline}</p> : null}
              {l.meetingSchedule ? (
                <p className="mt-4 inline-block whitespace-pre-line rounded border border-[var(--t-accent)] bg-[var(--t-surface)] px-4 py-2 text-left text-sm">{l.meetingSchedule}</p>
              ) : null}
            </section>
            {l.aboutHtml ? (
              <section className={kit.section}>
                <h2 className={`${kit.h2} mb-4`}>About Our Lodge</h2>
                <RichText html={l.aboutHtml} kit={kit} />
              </section>
            ) : null}
            <section className={kit.section}>
              <h2 className={`${kit.h2} mb-4`}>Upcoming Events</h2>
              <EventList data={data} kit={kit} occurrences={data.upcomingEvents.slice(0, 4)} />
              <p className="mt-4">
                <a href={data.links.events} className={kit.link}>
                  All events →
                </a>
              </p>
            </section>
            <section className={kit.section}>
              <h2 className={`${kit.h2} mb-4`}>Officers</h2>
              <OfficerList data={data} kit={kit} />
            </section>
            <section className={kit.section}>
              <h2 className={`${kit.h2} mb-4`}>Visit Us</h2>
              <ContactBlock data={data} kit={kit} />
            </section>
          </>
        ) : (
          renderInnerPage(page, data, kit)
        )}
      </main>

      <footer className="border-t border-[var(--t-border)] bg-[var(--t-primary)] py-6 text-center text-sm text-[var(--t-on-primary)]/80">
        © {new Date().getFullYear()} {l.name} No. {l.number}, {l.jurisdiction}. Site by tyled.live
      </footer>
    </div>
  );
}
