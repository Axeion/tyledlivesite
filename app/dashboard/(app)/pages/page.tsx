import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { savePage } from "@/lib/actions/lodge";
import { requireDashboard } from "@/lib/dashboard";

export default async function PagesPage() {
  const { db } = await requireDashboard("EDITOR", { redirect: true });
  const pages = await db.page.findMany({ orderBy: { order: "asc" } });
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Custom pages</h2>
      <ul className="card divide-y divide-neutral-100" data-testid="page-list">
        {pages.length === 0 ? <li className="py-2 text-sm text-neutral-500">No pages yet.</li> : null}
        {pages.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-2">
            <div>
              <Link href={`/dashboard/pages/${p.id}`} className="font-medium text-indigo-600 underline">
                {p.title}
              </Link>
              <span className="ml-2 text-sm text-neutral-500">/p/{p.slug}</span>
              {!p.published ? <span className="ml-2 rounded bg-neutral-100 px-1.5 text-xs">draft</span> : null}
            </div>
          </li>
        ))}
      </ul>
      <ActionForm action={savePage} submitLabel="Create page" className="card grid gap-3">
        <h3 className="font-semibold">New page</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" name="title" className="field" required />
          </div>
          <div>
            <label className="label" htmlFor="slug">URL slug</label>
            <input id="slug" name="slug" className="field" placeholder="history" required />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="bodyHtml">Content (basic HTML allowed)</label>
          <textarea id="bodyHtml" name="bodyHtml" rows={10} className="field font-mono text-xs" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="published" defaultChecked /> Published
        </label>
      </ActionForm>
    </div>
  );
}
