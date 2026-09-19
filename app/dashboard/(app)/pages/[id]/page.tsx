import { notFound } from "next/navigation";
import { ActionButton, ActionForm } from "@/components/ActionForm";
import { deletePage, savePage } from "@/lib/actions/lodge";
import { requireDashboard } from "@/lib/dashboard";

export default async function EditPagePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { db } = await requireDashboard("EDITOR", { redirect: true });
  const { id } = await params;
  const { saved } = await searchParams;
  const page = await db.page.findUnique({ where: { id } });
  if (!page) notFound();
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Edit page</h2>
      {saved ? <p className="alert-success">Page created.</p> : null}
      <ActionForm action={savePage} submitLabel="Save page" className="card grid gap-3">
        <input type="hidden" name="id" value={page.id} />
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" name="title" className="field" defaultValue={page.title} required />
          </div>
          <div>
            <label className="label" htmlFor="slug">URL slug</label>
            <input id="slug" name="slug" className="field" defaultValue={page.slug} required />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="bodyHtml">Content (basic HTML allowed)</label>
          <textarea id="bodyHtml" name="bodyHtml" rows={14} className="field font-mono text-xs" defaultValue={page.bodyHtml} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="published" defaultChecked={page.published} /> Published
        </label>
      </ActionForm>
      <ActionButton action={deletePage} label="Delete page" className="btn-danger" hidden={{ id: page.id }} confirm="Delete this page?" />
    </div>
  );
}
