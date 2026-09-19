import Link from "next/link";
import { ActionButton, ActionForm } from "@/components/ActionForm";
import { addDomain, recheckDomain, removeDomain } from "@/lib/actions/lodge";
import { requireDashboard } from "@/lib/dashboard";
import { dnsInstructions } from "@/lib/domains/instructions";
import { canUseCustomDomain } from "@/lib/entitlements";
import { lodgeSubdomainUrl } from "@/lib/urls";

export default async function DomainPage() {
  const { lodge, db } = await requireDashboard("ADMIN", { redirect: true });
  const entitled = canUseCustomDomain(lodge);
  const domains = await db.domain.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Custom domain</h2>
      <p className="text-sm text-neutral-600">
        Your site is always available at{" "}
        <a className="text-indigo-600 underline" href={lodgeSubdomainUrl(lodge.slug)}>
          {lodgeSubdomainUrl(lodge.slug)}
        </a>
        . With the paid plan you can also serve it from your own domain with automatic HTTPS.
      </p>

      {!entitled ? (
        <div className="alert-info" data-testid="domain-upgrade-notice">
          Custom domains require the paid plan.{" "}
          <Link href="/dashboard/billing" className="font-medium underline">
            Upgrade
          </Link>
          {domains.length > 0 ? " Your existing domains are kept but not served until the subscription is active." : ""}
        </div>
      ) : (
        <ActionForm action={addDomain} submitLabel="Add domain" className="card">
          <label className="label" htmlFor="hostname">Domain name</label>
          <input id="hostname" name="hostname" className="field" placeholder="www.yourlodge.org" required data-testid="domain-input" />
        </ActionForm>
      )}

      {domains.map((d) => (
        <section key={d.id} className="card" data-testid={`domain-${d.hostname}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{d.hostname}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.status === "VERIFIED" ? "bg-green-100 text-green-800" : d.status === "FAILED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}
              data-testid="domain-status"
            >
              {d.status === "VERIFIED" ? (entitled ? "Verified · serving" : "Verified · inactive (plan)") : d.status === "FAILED" ? "Records missing" : "Pending verification"}
            </span>
          </div>
          {d.lastError ? <p className="mt-1 text-sm text-red-700">{d.lastError}</p> : null}
          <p className="mt-1 text-xs text-neutral-500">
            Last checked: {d.lastCheckedAt ? d.lastCheckedAt.toLocaleString() : "not yet"}
            {d.verifiedAt ? ` · verified ${d.verifiedAt.toLocaleString()}` : ""}
          </p>
          <h4 className="mt-4 text-sm font-medium">DNS records to create at your registrar</h4>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="pb-1">Type</th>
                <th className="pb-1">Name</th>
                <th className="pb-1">Value</th>
              </tr>
            </thead>
            <tbody>
              {dnsInstructions(d.hostname, lodge.slug, d.verificationToken).map((r) => (
                <tr key={`${r.type}-${r.name}`} className="border-t border-neutral-100 align-top">
                  <td className="py-1 font-mono">{r.type}</td>
                  <td className="py-1 font-mono break-all">{r.name}</td>
                  <td className="py-1 font-mono break-all">
                    {r.value}
                    {r.note ? <div className="font-sans text-xs text-neutral-500">{r.note}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex gap-3">
            <ActionButton action={recheckDomain} label="Check now" hidden={{ hostname: d.hostname }} />
            <ActionButton action={removeDomain} label="Remove" className="btn-danger" hidden={{ hostname: d.hostname }} confirm={`Remove ${d.hostname}?`} />
          </div>
        </section>
      ))}
    </div>
  );
}
