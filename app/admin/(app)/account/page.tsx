import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export default async function AdminAccountPage() {
  const admin = await requirePlatformAdmin({ redirectTo: "/admin/login" });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Signed in as <span className="font-medium">{admin.email}</span> · platform admin
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
