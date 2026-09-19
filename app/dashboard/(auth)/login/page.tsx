import { ActionForm } from "@/components/ActionForm";
import { loginToLodge } from "@/lib/actions/auth";
import { getDashboardLodge } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const lodge = await getDashboardLodge();
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-sm uppercase tracking-widest text-neutral-500">Lodge dashboard</p>
      <h1 className="text-2xl font-bold">
        {lodge.name} No. {lodge.number}
      </h1>
      {error === "not-a-member" ? <p className="alert-error mt-4">Your account is not a member of this lodge.</p> : null}
      <ActionForm action={loginToLodge} submitLabel="Sign in" className="card mt-6">
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" required className="field" autoComplete="email" />
        <label className="label mt-4" htmlFor="password">
          Password
        </label>
        <input id="password" name="password" type="password" required className="field" autoComplete="current-password" />
      </ActionForm>
    </main>
  );
}
