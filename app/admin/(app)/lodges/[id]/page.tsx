import { notFound } from "next/navigation";
import { ActionButton, ActionForm } from "@/components/ActionForm";
import { approveLodge, rejectLodge, setLodgePublished } from "@/lib/actions/admin";
import { db } from "@/lib/db";
import { effectivePlan } from "@/lib/entitlements";
import { formatAddress } from "@/lib/geocode";
import { lodgeSubdomainUrl } from "@/lib/urls";

export default async function AdminLodgeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lodge = await db.lodge.findUnique({
    where: { id },
    include: {
      memberships: { include: { user: true } },
      domains: true,
      auditLogs: { orderBy: { createdAt: "desc" }, take: 20, include: { actor: true } },
      _count: { select: { events: true, officers: true, pages: true, gallery: true } },
    },
  });
  if (!lodge) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {lodge.name} No. {lodge.number}
          </h1>
          <p className="text-neutral-600">{lodge.jurisdiction}</p>
          <p className="mt-1 text-sm">
            <a className="text-indigo-600 underline" href={lodgeSubdomainUrl(lodge.slug)} target="_blank" rel="noreferrer">
              {lodgeSubdomainUrl(lodge.slug)}
            </a>
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          {lodge.status !== "APPROVED" ? (
            <ActionButton action={approveLodge} label="Approve & publish" className="btn-primary" hidden={{ lodgeId: lodge.id }} />
          ) : (
            <ActionButton
              action={setLodgePublished}
              label={lodge.published ? "Unpublish site" : "Publish site"}
              hidden={{ lodgeId: lodge.id, published: lodge.published ? "false" : "true" }}
            />
          )}
          {lodge.status !== "REJECTED" ? (
            <ActionForm action={rejectLodge} submitLabel="Reject" submitClassName="btn-danger" className="w-64">
              <input type="hidden" name="lodgeId" value={lodge.id} />
              <input name="reason" className="field" placeholder="Reason for rejection" required />
            </ActionForm>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="font-semibold">Status</h2>
          <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
            <dt className="text-neutral-500">Review</dt>
            <dd data-testid="lodge-status">{lodge.status}</dd>
            <dt className="text-neutral-500">Published</dt>
            <dd>{lodge.published ? "yes" : "no"}</dd>
            {lodge.rejectionReason ? (
              <>
                <dt className="text-neutral-500">Rejection reason</dt>
                <dd>{lodge.rejectionReason}</dd>
              </>
            ) : null}
            <dt className="text-neutral-500">Plan</dt>
            <dd>
              {lodge.plan} (effective {effectivePlan(lodge)}) {lodge.subscriptionStatus ? `· ${lodge.subscriptionStatus}` : ""}
            </dd>
            <dt className="text-neutral-500">Stripe</dt>
            <dd className="break-all">{lodge.stripeCustomerId ?? "—"} / {lodge.stripeSubscriptionId ?? "—"}</dd>
            <dt className="text-neutral-500">Template</dt>
            <dd>{lodge.templateId}</dd>
            <dt className="text-neutral-500">Content</dt>
            <dd>
              {lodge._count.officers} officers · {lodge._count.events} events · {lodge._count.pages} pages · {lodge._count.gallery} photos
            </dd>
          </dl>
        </section>
        <section className="card">
          <h2 className="font-semibold">Contact & location</h2>
          <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
            <dt className="text-neutral-500">Email</dt>
            <dd>{lodge.contactEmail ?? "—"}</dd>
            <dt className="text-neutral-500">Phone</dt>
            <dd>{lodge.contactPhone ?? "—"}</dd>
            <dt className="text-neutral-500">Website</dt>
            <dd>{lodge.website ?? "—"}</dd>
            <dt className="text-neutral-500">Address</dt>
            <dd>{formatAddress(lodge) || "—"}</dd>
            <dt className="text-neutral-500">Geocoded</dt>
            <dd>{lodge.lat !== null && lodge.lng !== null ? `${lodge.lat.toFixed(4)}, ${lodge.lng.toFixed(4)}` : "pending"}</dd>
          </dl>
        </section>
        <section className="card">
          <h2 className="font-semibold">Members</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {lodge.memberships.map((m) => (
              <li key={m.id}>
                {m.user.name} &lt;{m.user.email}&gt; · {m.role}
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2 className="font-semibold">Custom domains</h2>
          {lodge.domains.length === 0 ? <p className="mt-2 text-sm text-neutral-500">None</p> : null}
          <ul className="mt-2 space-y-1 text-sm">
            {lodge.domains.map((d) => (
              <li key={d.id}>
                {d.hostname} · {d.status} {d.lastError ? <span className="text-red-700">({d.lastError})</span> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card">
        <h2 className="font-semibold">Recent activity</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {lodge.auditLogs.map((a) => (
            <li key={a.id}>
              <span className="text-neutral-500">{a.createdAt.toLocaleString()}</span> · {a.action}
              {a.actor ? ` · ${a.actor.email}` : ""}
              {a.meta ? <span className="text-neutral-500"> {JSON.stringify(a.meta)}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
