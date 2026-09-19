import Link from "next/link";
import { env } from "@/lib/env";
import { TEMPLATES } from "@/templates/registry";

export default function LandingPage() {
  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">For Masonic lodges</p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight">A website for your lodge in an afternoon.</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
          Meeting schedule, officers, events with a public calendar and iCal feed, a map to your temple, photo gallery
          and custom pages. Free on <code>your-lodge.{env.platformDomain}</code>, or bring your own domain.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">
            Get started free
          </Link>
          <Link href="/pricing" className="btn-secondary px-6 py-3 text-base">
            See pricing
          </Link>
        </div>
      </section>

      <section className="bg-neutral-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold">Three designs, one set of content</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-neutral-600">
            Switch templates any time. Your officers, events and pages stay exactly as they are.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {TEMPLATES.map((t) => (
              <div key={t.id} className="card">
                <div className="mb-4 flex gap-1">
                  {t.swatch.map((c) => (
                    <span key={c} className="h-8 flex-1 rounded" style={{ background: c }} />
                  ))}
                </div>
                <h3 className="font-semibold">{t.name}</h3>
                <p className="mt-1 text-sm text-neutral-600">{t.description}</p>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-green-700">{t.tier}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            ["Events that repeat", "Set “2nd Tuesday monthly” once. Visitors get a calendar and an iCal feed that stays current."],
            ["Map without API keys", "Your address is placed on an OpenStreetMap map automatically."],
            ["Verified lodges only", "Every site is reviewed by the platform team before it goes live."],
          ].map(([title, body]) => (
            <div key={title}>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-neutral-600">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
