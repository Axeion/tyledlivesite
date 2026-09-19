import Link from "next/link";
import { ActionButton, ActionForm } from "@/components/ActionForm";
import { approveLodge, rejectLodge } from "@/lib/actions/admin";
import { db } from "@/lib/db";
import { formatAddress } from "@/lib/geocode";
import { lodgeSubdomainUrl } from "@/lib/urls";

export default async function ApprovalQueuePage() {
  const pending = await db.lodge.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: { submittedAt: "asc" },
    include: { memberships: { include: { user: true } } },
  });
  const counts = await db.lodge.groupBy({ by: ["status"], _count: { _all: true } });

  return (
    <div>
      <h1 className="text-2xl font-bold">Approval queue</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {counts.map((c) => `${c._count._all} ${c.status.toLowerCase().replace("_", " ")}`).join(" · ") || "No lodges yet"}
      </p>

      {pending.length === 0 ? (
        <p className="card mt-6 text-neutral-600" data-testid="queue-empty">
          Nothing waiting for review.
        </p>
      ) : null}

      <ul className="mt-6 space-y-4">
        {pending.map((lodge) => {
          const admin = lodge.memberships.find((m) => m.role === "ADMIN")?.user;
          return (
            <li key={lodge.id} className="card" data-testid={`queue-${lodge.slug}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    {lodge.name} No. {lodge.number}
                  </h2>
                  <p className="text-sm text-neutral-600">{lodge.jurisdiction}</p>
                  <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
                    <dt className="text-neutral-500">Site</dt>
                    <dd>
                      <a className="text-indigo-600 underline" href={lodgeSubdomainUrl(lodge.slug)} target="_blank" rel="noreferrer">
                        {lodge.slug}
                      </a>{" "}
                      · template {lodge.templateId}
                    </dd>
                    <dt className="text-neutral-500">Submitted by</dt>
                    <dd>{admin ? `${admin.name} <${admin.email}>` : "—"}</dd>
                    <dt className="text-neutral-500">Contact</dt>
                    <dd>{[lodge.contactEmail, lodge.contactPhone, lodge.website].filter(Boolean).join(" · ") || "—"}</dd>
                    <dt className="text-neutral-500">Address</dt>
                    <dd>{formatAddress(lodge) || "—"}</dd>
                    <dt className="text-neutral-500">Submitted</dt>
                    <dd>{lodge.submittedAt?.toLocaleString() ?? "—"}</dd>
                  </dl>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <ActionButton action={approveLodge} label="Approve & publish" className="btn-primary" hidden={{ lodgeId: lodge.id }} />
                  <ActionForm action={rejectLodge} submitLabel="Reject" submitClassName="btn-danger" className="w-64">
                    <input type="hidden" name="lodgeId" value={lodge.id} />
                    <input name="reason" className="field" placeholder="Reason for rejection" required />
                  </ActionForm>
                  <Link href={`/admin/lodges/${lodge.id}`} className="text-sm text-indigo-600 underline">
                    Details
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
