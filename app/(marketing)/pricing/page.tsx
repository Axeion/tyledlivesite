import Link from "next/link";
import { env } from "@/lib/env";

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-center text-4xl font-bold">Simple pricing</h1>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="text-xl font-semibold">Free</h2>
          <p className="mt-1 text-3xl font-bold">$0</p>
          <ul className="mt-4 space-y-2 text-sm text-neutral-700">
            <li>✓ your-lodge.{env.platformDomain}</li>
            <li>✓ All three templates</li>
            <li>✓ Events, calendar, iCal feed</li>
            <li>✓ Map, gallery, officers, custom pages</li>
          </ul>
          <Link href="/signup" className="btn-secondary mt-6 w-full">
            Start free
          </Link>
        </div>
        <div className="card border-indigo-300">
          <h2 className="text-xl font-semibold">Custom domain</h2>
          <p className="mt-1 text-3xl font-bold">
            Subscription <span className="text-base font-normal text-neutral-500">via Stripe</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-neutral-700">
            <li>✓ Everything in Free</li>
            <li>✓ Serve your site at www.yourlodge.org</li>
            <li>✓ Automatic HTTPS certificates</li>
            <li>✓ Premium templates as they launch</li>
          </ul>
          <p className="mt-6 text-sm text-neutral-600">Upgrade from your lodge dashboard after approval.</p>
        </div>
      </div>
      <p className="mt-8 text-center text-sm text-neutral-500">
        If a subscription lapses, your site keeps running on its free subdomain. Nothing is deleted.
      </p>
    </main>
  );
}
