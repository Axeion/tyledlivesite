import { ActionButton, ActionForm } from "@/components/ActionForm";
import { addMember, removeMember } from "@/lib/actions/lodge";
import { requireDashboard } from "@/lib/dashboard";
import { db as platformDb } from "@/lib/db";

export default async function MembersPage() {
  const { lodge, user, db } = await requireDashboard("ADMIN", { redirect: true });
  const memberships = await db.lodgeMembership.findMany({ orderBy: { createdAt: "asc" } });
  const users = await platformDb.user.findMany({ where: { id: { in: memberships.map((m) => m.userId) } } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Members</h2>
      <ul className="card divide-y divide-neutral-100" data-testid="member-list">
        {memberships.map((m) => {
          const u = byId.get(m.userId);
          return (
            <li key={m.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className="font-medium">{u?.name}</span> <span className="text-neutral-500">{u?.email}</span>
                <span className="ml-2 rounded bg-neutral-100 px-1.5 text-xs">{m.role.toLowerCase()}</span>
              </div>
              {m.userId !== user.id ? (
                <ActionButton action={removeMember} label="Remove" className="text-red-700 underline" hidden={{ id: m.id }} confirm="Remove this member?" />
              ) : (
                <span className="text-xs text-neutral-400">you</span>
              )}
            </li>
          );
        })}
      </ul>
      <ActionForm action={addMember} submitLabel="Add member" className="card grid gap-3 md:grid-cols-2">
        <h3 className="font-semibold md:col-span-2">Add a member to {lodge.name}</h3>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="field" required />
        </div>
        <div>
          <label className="label" htmlFor="role">Role</label>
          <select id="role" name="role" className="field" defaultValue="EDITOR">
            <option value="EDITOR">Editor (content, events, pages, photos)</option>
            <option value="ADMIN">Admin (everything, including billing and domains)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="name">Name (new accounts only)</label>
          <input id="name" name="name" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="password">Initial password (new accounts only)</label>
          <input id="password" name="password" type="password" className="field" autoComplete="new-password" />
        </div>
      </ActionForm>
    </div>
  );
}
