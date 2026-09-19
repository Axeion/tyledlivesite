import Link from "next/link";
import { ActionButton } from "@/components/ActionForm";
import { resubmitForReview, setPublished } from "@/lib/actions/lodge";
import { requireDashboard } from "@/lib/dashboard";
import { effectivePlan } from "@/lib/entitlements";
import { lodgeSubdomainUrl } from "@/lib/urls";

export default async function DashboardOverview({ searchParams }: { searchParams: Promise<{ welcome?: string; error?: string }> }) {
  const { lodge, membership, db } = await requireDashboard("EDITOR", { redirect: true });
  const { welcome, error } = await searchParams;
  const [officers, events, pages, gallery, domains] = await Promise.all([
    db.officer.count(),
    db.event.count(),
    db.page.count(),
    db.galleryImage.count(),
    db.domain.findMany(),
  ]);
  const isAdmin = membership.role === "ADMIN";
  const live = lodge.status === "APPROVED" && lodge.published;

  return (
    <div className="space-y-6">
      {welcome ? <p className="alert-success">Welcome! Your lodge has been submitted for review.</p> : null}
      {error === "admin-only" ? <p className="alert-error">That section is only available to lodge admins.</p> : null}

      <section className="card" data-testid="status-card">
        <h2 className="font-semibold">Site status</h2>
        {lodge.status === "PENDING_REVIEW" ? (
          <p className="alert-info mt-2">
            <strong>Awaiting approval.</strong> The platform team is verifying your lodge. Visitors see a coming-soon page
            until then, but you can keep editing.
          </p>
        ) : null}
        {lodge.status === "REJECTED" ? (
          <div className="alert-error mt-2">
            <strong>Submission rejected.</strong> {lodge.rejectionReason}
            {isAdmin ? (
              <form action={resubmitForReview} className="mt-2">
                <button className="btn-secondary" type="submit">
                  Resubmit for review
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
        {lodge.status === "APPROVED" ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className={live ? "alert-success" : "alert-info"} data-testid="publish-state">
              {live ? "Your site is live." : "Approved, but currently unpublished."}
            </p>
            {isAdmin ? (
              <ActionButton
                action={setPublished}
                label={live ? "Unpublish" : "Publish"}
                className={live ? "btn-secondary" : "btn-primary"}
                hidden={{ published: live ? "false" : "true" }}
              />
            ) : null}
          </div>
        ) : null}
        <dl className="mt-4 grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
          <dt className="text-neutral-500">Address</dt>
          <dd>
            <a className="text-indigo-600 underline" href={lodgeSubdomainUrl(lodge.slug)} target="_blank" rel="noreferrer">
              {lodgeSubdomainUrl(lodge.slug)}
            </a>
            {domains
              .filter((d) => d.status === "VERIFIED")
              .map((d) => (
                <span key={d.id} className="ml-2 text-neutral-600">
                  · https://{d.hostname}
                  {effectivePlan(lodge) !== "PAID" ? " (inactive: paid plan required)" : ""}
                </span>
              ))}
          </dd>
          <dt className="text-neutral-500">Plan</dt>
          <dd>
            {effectivePlan(lodge) === "PAID" ? "Paid (custom domain)" : "Free"}
            {isAdmin && effectivePlan(lodge) !== "PAID" ? (
              <>
                {" "}
                ·{" "}
                <Link className="text-indigo-600 underline" href="/dashboard/billing">
                  Upgrade
                </Link>
              </>
            ) : null}
          </dd>
          <dt className="text-neutral-500">Template</dt>
          <dd>{lodge.templateId}</dd>
        </dl>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Officers", officers, "/dashboard/officers"],
          ["Events", events, "/dashboard/events"],
          ["Pages", pages, "/dashboard/pages"],
          ["Photos", gallery, "/dashboard/gallery"],
        ].map(([label, count, href]) => (
          <Link key={String(label)} href={String(href)} className="card hover:border-indigo-300">
            <div className="text-3xl font-bold">{count}</div>
            <div className="text-sm text-neutral-600">{label}</div>
          </Link>
        ))}
      </section>
    </div>
  );
}
