import { ActionForm } from "@/components/ActionForm";
import { adminLogin } from "@/lib/actions/auth";

export default function AdminLoginPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Platform admin</h1>
      <ActionForm action={adminLogin} submitLabel="Sign in" className="card mt-6">
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
