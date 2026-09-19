"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { cleanText, formString } from "@/lib/sanitize-helpers";
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
