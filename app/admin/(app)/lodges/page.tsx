import Link from "next/link";
import { db } from "@/lib/db";
import { effectivePlan } from "@/lib/entitlements";
import { lodgeSubdomainUrl } from "@/lib/urls";

export default async function AdminLodgesPage() {
  const lodges = await db.lodge.findMany({ orderBy: { createdAt: "desc" }, include: { domains: true } });
  return (
    <div>
      <h1 className="text-2xl font-bold">All lodges</h1>
      <table className="card mt-6 w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="pb-2">Lodge</th>
            <th className="pb-2">Status</th>
            <th className="pb-2">Plan</th>
            <th className="pb-2">Template</th>
            <th className="pb-2">Domains</th>
            <th className="pb-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {lodges.map((l) => (
            <tr key={l.id} className="border-t border-neutral-100" data-testid={`lodge-row-${l.slug}`}>
              <td className="py-2">
                <Link href={`/admin/lodges/${l.id}`} className="font-medium text-indigo-600 underline">
                  {l.name} No. {l.number}
                </Link>
                <div className="text-xs text-neutral-500">
                  <a href={lodgeSubdomainUrl(l.slug)} target="_blank" rel="noreferrer">
                    {l.slug}
                  </a>
                </div>
              </td>
              <td className="py-2">
                {l.status}
                {l.status === "APPROVED" ? (l.published ? " · live" : " · unpublished") : ""}
              </td>
              <td className="py-2">
                {l.plan}
                {effectivePlan(l) !== l.plan ? ` (effective ${effectivePlan(l)})` : ""}
                {l.subscriptionStatus ? <span className="text-xs text-neutral-500"> {l.subscriptionStatus}</span> : null}
              </td>
              <td className="py-2">{l.templateId}</td>
              <td className="py-2">{l.domains.map((d) => `${d.hostname} (${d.status.toLowerCase()})`).join(", ") || "—"}</td>
              <td className="py-2">{l.createdAt.toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
