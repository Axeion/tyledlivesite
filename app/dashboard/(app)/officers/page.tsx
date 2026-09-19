import { ActionButton, ActionForm } from "@/components/ActionForm";
import { deleteOfficer, saveOfficer } from "@/lib/actions/lodge";
import { requireDashboard } from "@/lib/dashboard";

const COMMON_TITLES = [
  "Worshipful Master", "Senior Warden", "Junior Warden", "Treasurer", "Secretary", "Chaplain", "Senior Deacon",
  "Junior Deacon", "Senior Steward", "Junior Steward", "Marshal", "Tyler",
];

export default async function OfficersPage() {
  const { db } = await requireDashboard("EDITOR", { redirect: true });
  const officers = await db.officer.findMany({ orderBy: { order: "asc" } });
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Officers</h2>
      <ul className="space-y-3" data-testid="officer-rows">
        {officers.map((o) => (
          <li key={o.id} className="card">
            <ActionForm action={saveOfficer} submitLabel="Update" submitClassName="btn-secondary" className="grid gap-3 md:grid-cols-[1fr_1fr_5rem]">
              <input type="hidden" name="id" value={o.id} />
              <div>
                <label className="label">Title</label>
                <input name="title" defaultValue={o.title} className="field" list="titles" required />
              </div>
              <div>
                <label className="label">Name</label>
                <input name="name" defaultValue={o.name} className="field" required />
              </div>
              <div>
                <label className="label">Order</label>
                <input name="order" type="number" defaultValue={o.order} className="field" />
              </div>
            </ActionForm>
            <div className="mt-2">
              <ActionButton action={deleteOfficer} label="Remove" className="text-sm text-red-700 underline" hidden={{ id: o.id }} confirm={`Remove ${o.name}?`} />
            </div>
          </li>
        ))}
      </ul>
      <ActionForm action={saveOfficer} submitLabel="Add officer" className="card grid gap-3 md:grid-cols-2" data-testid="officer-new">
        <h3 className="font-semibold md:col-span-2">Add an officer</h3>
        <div>
          <label className="label" htmlFor="new-title">Title</label>
          <input id="new-title" name="title" className="field" list="titles" required />
        </div>
        <div>
          <label className="label" htmlFor="new-name">Name</label>
          <input id="new-name" name="name" className="field" required />
        </div>
      </ActionForm>
      <datalist id="titles">
        {COMMON_TITLES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
}
