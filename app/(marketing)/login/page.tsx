import { ActionForm } from "@/components/ActionForm";
import { loginFromApex } from "@/lib/actions/auth";

export default function ApexLoginPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-1 text-sm text-neutral-600">We&apos;ll send you to your lodge&apos;s dashboard.</p>
      <ActionForm action={loginFromApex} submitLabel="Sign in" className="card mt-6">
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field" />
        <label className="label mt-4" htmlFor="password">
          Password
        </label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="field" />
      </ActionForm>
    </main>
  );
}
