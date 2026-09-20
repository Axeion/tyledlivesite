import { ActionForm } from "@/components/ActionForm";
import { changePassword } from "@/lib/actions/auth";

/** Used on both the lodge dashboard and /admin; the action works off the session, not the host. */
export function ChangePasswordForm() {
  return (
    <ActionForm action={changePassword} className="card max-w-md" submitLabel="Change password" data-testid="change-password">
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="currentPassword">Current password</label>
          <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" className="field" required />
        </div>
        <div>
          <label className="label" htmlFor="newPassword">New password</label>
          <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={10} className="field" required />
          <p className="mt-1 text-xs text-neutral-500">At least 10 characters.</p>
        </div>
        <div>
          <label className="label" htmlFor="confirmPassword">Confirm new password</label>
          <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={10} className="field" required />
        </div>
        <p className="text-sm text-neutral-600">Changing your password signs you out everywhere else. This device stays signed in.</p>
      </div>
    </ActionForm>
  );
}
