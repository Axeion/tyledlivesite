"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { cleanText, formString } from "@/lib/sanitize-helpers";
import { lodgeSubdomainUrl } from "@/lib/urls";
import type { ActionResult } from "@/components/ActionForm";

export async function approveLodge(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requirePlatformAdmin();
  const lodgeId = formString(formData, "lodgeId");
  if (!lodgeId) return { error: "Missing lodge" };
  const lodge = await db.lodge.findUnique({ where: { id: lodgeId } });
  if (!lodge) return { error: "Lodge not found" };
  await db.lodge.update({
    where: { id: lodgeId },
    data: { status: "APPROVED", published: true, approvedAt: new Date(), rejectionReason: null, geocodedAt: lodge.lat ? lodge.geocodedAt : null },
  });
  await db.auditLog.create({ data: { actorId: admin.id, lodgeId, action: "lodge.approved" } });
  await notifyLodgeAdmins(lodgeId, `${lodge.name} No. ${lodge.number} is live`, [
    `Good news: your lodge website has been approved and is now published at ${lodgeSubdomainUrl(lodge.slug)}.`,
    `Sign in to your dashboard at ${lodgeSubdomainUrl(lodge.slug, "/dashboard")} to keep it up to date.`,
  ].join("\n\n"));
  revalidatePath("/admin");
  return { ok: `${lodge.name} approved and published.` };
}

export async function rejectLodge(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requirePlatformAdmin();
  const lodgeId = formString(formData, "lodgeId");
  const reason = cleanText(formString(formData, "reason") ?? "", 500);
  if (!lodgeId) return { error: "Missing lodge" };
  if (!reason) return { error: "Give the lodge a reason so they can fix their submission" };
  const lodge = await db.lodge.findUnique({ where: { id: lodgeId } });
  if (!lodge) return { error: "Lodge not found" };
  await db.lodge.update({ where: { id: lodgeId }, data: { status: "REJECTED", published: false, rejectionReason: reason } });
  await db.auditLog.create({ data: { actorId: admin.id, lodgeId, action: "lodge.rejected", meta: { reason } } });
  await notifyLodgeAdmins(lodgeId, `Your submission for ${lodge.name} No. ${lodge.number} needs changes`, [
    `The platform team could not approve your lodge website yet. Reason:`,
    reason,
    `Update your details at ${lodgeSubdomainUrl(lodge.slug, "/dashboard")} and resubmit for review.`,
  ].join("\n\n"));
  revalidatePath("/admin");
  return { ok: `${lodge.name} rejected.` };
}

export async function setLodgePublished(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requirePlatformAdmin();
  const lodgeId = formString(formData, "lodgeId");
  const published = formString(formData, "published") === "true";
  if (!lodgeId) return { error: "Missing lodge" };
  await db.lodge.update({ where: { id: lodgeId }, data: { published } });
  await db.auditLog.create({ data: { actorId: admin.id, lodgeId, action: published ? "lodge.published" : "lodge.unpublished", meta: { by: "platform-admin" } } });
  revalidatePath("/admin");
  return { ok: published ? "Site published." : "Site unpublished." };
}

async function notifyLodgeAdmins(lodgeId: string, subject: string, text: string): Promise<void> {
  const admins = await db.lodgeMembership.findMany({ where: { lodgeId, role: "ADMIN" }, include: { user: true } });
  await Promise.all(admins.map((m) => sendMail({ to: m.user.email, subject, text })));
}
