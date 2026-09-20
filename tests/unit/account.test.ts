import { beforeEach, describe, expect, it } from "vitest";
import { changeUserPassword } from "@/lib/auth/account";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { resetDatabase } from "./helpers";

const CURRENT = "correct-horse-battery";
const NEXT = "staple-battery-horse-2";

async function userWithSessions(sessions = 3) {
  const user = await db.user.create({
    data: { email: "member@lodge.example", name: "Member", passwordHash: await hashPassword(CURRENT) },
  });
  const expiresAt = new Date(Date.now() + 60_000);
  const ids: string[] = [];
  for (let i = 0; i < sessions; i += 1) {
    const s = await db.session.create({ data: { id: `session-${i}`, userId: user.id, expiresAt } });
    ids.push(s.id);
  }
  return { user, sessionIds: ids };
}

describe("changeUserPassword", () => {
  beforeEach(resetDatabase);

  it("rehashes the password, keeps the current session and revokes the rest", async () => {
    const { user, sessionIds } = await userWithSessions(3);
    const [keep, ...others] = sessionIds;

    const result = await changeUserPassword(
      user,
      { currentPassword: CURRENT, newPassword: NEXT, confirmPassword: NEXT },
      { keepSessionId: keep },
    );
    expect(result).toEqual({ ok: true, revokedSessions: 2 });

    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword(NEXT, updated.passwordHash)).toBe(true);
    expect(await verifyPassword(CURRENT, updated.passwordHash)).toBe(false);

    const remaining = await db.session.findMany({ where: { userId: user.id }, select: { id: true } });
    expect(remaining.map((s) => s.id)).toEqual([keep]);
    for (const id of others) expect(await db.session.findUnique({ where: { id } })).toBeNull();

    expect(await db.auditLog.count({ where: { actorId: user.id, action: "user.password_changed" } })).toBe(1);
  });

  it("revokes every session when no session is being kept", async () => {
    const { user } = await userWithSessions(2);
    const result = await changeUserPassword(user, { currentPassword: CURRENT, newPassword: NEXT, confirmPassword: NEXT });
    expect(result).toEqual({ ok: true, revokedSessions: 2 });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("refuses a wrong current password and flags it for the lockout counter", async () => {
    const { user, sessionIds } = await userWithSessions(2);
    const result = await changeUserPassword(user, { currentPassword: "not-it-at-all", newPassword: NEXT, confirmPassword: NEXT });
    expect(result).toMatchObject({ ok: false, badCurrent: true });

    // Nothing changed: hash intact, sessions intact, nothing audited.
    const unchanged = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword(CURRENT, unchanged.passwordHash)).toBe(true);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(sessionIds.length);
    expect(await db.auditLog.count({ where: { actorId: user.id } })).toBe(0);
  });

  it("validates the new password before touching the current one", async () => {
    const { user } = await userWithSessions(1);
    const cases: [Parameters<typeof changeUserPassword>[1], RegExp][] = [
      [{ currentPassword: "", newPassword: NEXT, confirmPassword: NEXT }, /current password/i],
      [{ currentPassword: CURRENT, newPassword: "short", confirmPassword: "short" }, /at least 10/],
      [{ currentPassword: CURRENT, newPassword: NEXT, confirmPassword: `${NEXT}x` }, /do not match/],
      [{ currentPassword: CURRENT, newPassword: CURRENT, confirmPassword: CURRENT }, /not used here before/],
    ];
    for (const [input, message] of cases) {
      const result = await changeUserPassword(user, input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(message);
        expect(result.badCurrent).toBeUndefined();
      }
    }
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
  });
});
