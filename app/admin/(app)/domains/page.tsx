import { db } from "@/lib/db";
import { canUseCustomDomain } from "@/lib/entitlements";

export default async function AdminDomainsPage() {
  const domains = await db.domain.findMany({ orderBy: { createdAt: "desc" }, include: { lodge: true } });
  return (
    <div>
      <h1 className="text-2xl font-bold">Custom domains</h1>
      <table className="card mt-6 w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="pb-2">Hostname</th>
            <th className="pb-2">Lodge</th>
            <th className="pb-2">Status</th>
            <th className="pb-2">Serving</th>
            <th className="pb-2">Last check</th>
            <th className="pb-2">Error</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((d) => (
            <tr key={d.id} className="border-t border-neutral-100">
              <td className="py-2 font-medium">{d.hostname}</td>
              <td className="py-2">{d.lodge.name} ({d.lodge.slug})</td>
              <td className="py-2">{d.status}</td>
              <td className="py-2">{d.status === "VERIFIED" && canUseCustomDomain(d.lodge) ? "yes" : "no (falls back to subdomain)"}</td>
              <td className="py-2">{d.lastCheckedAt?.toLocaleString() ?? "—"}</td>
              <td className="py-2 text-red-700">{d.lastError ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
