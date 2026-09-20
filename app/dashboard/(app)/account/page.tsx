import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { requireDashboard } from "@/lib/dashboard";

export default async function AccountPage() {
  const { user, membership } = await requireDashboard("EDITOR", { redirect: true });
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Account</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Signed in as <span className="font-medium">{user.email}</span> · {membership.role.toLowerCase()}
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
