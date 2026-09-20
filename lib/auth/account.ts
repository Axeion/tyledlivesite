import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { passwordSchema, zodMessage } from "@/lib/validation";
import type { User } from "@/generated/prisma/client";

export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export type PasswordChangeResult =
  | { ok: true; revokedSessions: number }
  /** `badCurrent` marks a wrong current password so the caller can count it as a failed attempt. */
  | { ok: false; error: string; badCurrent?: boolean };

/**
 * Changes a signed-in user's password. Every other session for the user is
 * revoked so a device that should no longer have access loses it; the
 * session making the change (`keepSessionId`, the hashed cookie value) is
 * kept so the user is not signed out of the screen they are on.
 */
export async function changeUserPassword(
  user: User,
  input: PasswordChangeInput,
  opts: { keepSessionId?: string } = {},
): Promise<PasswordChangeResult> {
  if (!input.currentPassword) return { ok: false, error: "Enter your current password" };
  const parsed = passwordSchema.safeParse(input.newPassword);
  if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
  if (input.newPassword !== input.confirmPassword) return { ok: false, error: "New passwords do not match" };
  if (input.newPassword === input.currentPassword) return { ok: false, error: "Choose a password you have not used here before" };
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    return { ok: false, error: "Current password is incorrect", badCurrent: true };
  }

  const passwordHash = await hashPassword(parsed.data);
  const [, revoked] = await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash } }),
    db.session.deleteMany({ where: { userId: user.id, ...(opts.keepSessionId ? { id: { not: opts.keepSessionId } } : {}) } }),
    db.auditLog.create({ data: { actorId: user.id, action: "user.password_changed" } }),
  ]);
  return { ok: true, revokedSessions: revoked.count };
}
