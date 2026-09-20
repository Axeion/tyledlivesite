"use server";

import { revalidatePath } from "next/cache";
import { fail, fromForm } from "@/lib/actions/shared";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { canUseTemplate } from "@/lib/entitlements";
import { applyLodgeInfo, LODGE_INFO_KEYS } from "@/lib/lodge-info";
import { sendMail } from "@/lib/mailer";
import { cleanText, formString } from "@/lib/sanitize-helpers";
import { deleteObject, newObjectKey, putObject, validateImageUpload } from "@/lib/storage";
import { lodgeSubdomainUrl } from "@/lib/urls";
import { lodgeInfoSchema } from "@/lib/validation";
import { getTemplate, isTemplateId } from "@/templates/registry";
import type { ActionResult } from "@/components/ActionForm";
import type { Lodge, Prisma, User } from "@/generated/prisma/client";

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

// ---------------------------------------------------------------------------
// Editing a lodge's site on its behalf
// ---------------------------------------------------------------------------

type AdminEdit = { admin: User; lodge: Lodge } | { error: string };

/** Resolves the lodge a platform admin is acting on; the id comes from the form. */
async function beginEdit(fd: FormData): Promise<AdminEdit> {
  const admin = await requirePlatformAdmin();
  const lodgeId = formString(fd, "lodgeId");
  if (!lodgeId) return { error: "Missing lodge" };
  const lodge = await db.lodge.findUnique({ where: { id: lodgeId } });
  if (!lodge) return { error: "Lodge not found" };
  return { admin, lodge };
}

/** Audit entries for admin edits carry `by: "platform-admin"` so a lodge can tell them from its own. */
async function auditEdit(admin: User, lodge: Lodge, action: string, meta: Record<string, unknown> = {}): Promise<void> {
  await db.auditLog.create({
    data: { actorId: admin.id, lodgeId: lodge.id, action, meta: { ...meta, by: "platform-admin" } as Prisma.InputJsonValue },
  });
}

function editPaths(lodge: Lodge): void {
  revalidatePath(`/admin/lodges/${lodge.id}`);
  revalidatePath(`/admin/lodges/${lodge.id}/edit`);
  revalidatePath("/admin/lodges");
}

export async function adminUpdateLodgeInfo(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const edit = await beginEdit(fd);
    if ("error" in edit) return edit;
    const { admin, lodge } = edit;
    const { data, addressChanged } = applyLodgeInfo(lodge, lodgeInfoSchema.parse(fromForm(fd, LODGE_INFO_KEYS)));
    await db.lodge.update({ where: { id: lodge.id }, data });
    await auditEdit(admin, lodge, "lodge.info_updated");
    editPaths(lodge);
    return { ok: addressChanged ? "Saved. The map will update once the new address is located." : "Saved." };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Platform admins may pick any template, including one above the lodge's
 * plan; the audit entry records when that happens.
 */
export async function adminSetTemplate(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const edit = await beginEdit(fd);
    if ("error" in edit) return edit;
    const { admin, lodge } = edit;
    const templateId = formString(fd, "templateId") ?? "";
    if (!isTemplateId(templateId)) return { error: "Unknown template" };
    const template = getTemplate(templateId);
    await db.lodge.update({ where: { id: lodge.id }, data: { templateId } });
    await auditEdit(admin, lodge, "lodge.template_changed", { templateId, aboveLodgePlan: !canUseTemplate(lodge, template) });
    editPaths(lodge);
    return { ok: `Switched ${lodge.name} to ${template.name}. All content is intact.` };
  } catch (err) {
    return fail(err);
  }
}

export async function adminUploadLodgeImage(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const edit = await beginEdit(fd);
    if ("error" in edit) return edit;
    const { admin, lodge } = edit;
    const kind = formString(fd, "kind") === "seal" ? "seal" : "logo";
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose an image file" };
    const img = await validateImageUpload(await file.arrayBuffer());
    const key = newObjectKey(lodge.id, kind, img.ext);
    await putObject(key, img.buffer, img.mime);
    const previous = kind === "logo" ? lodge.logoKey : lodge.sealKey;
    await db.lodge.update({ where: { id: lodge.id }, data: kind === "logo" ? { logoKey: key } : { sealKey: key } });
    if (previous) await deleteObject(previous).catch(() => undefined);
    await auditEdit(admin, lodge, `lodge.${kind}_uploaded`, { key });
    editPaths(lodge);
    return { ok: `${kind === "logo" ? "Logo" : "Seal"} updated.` };
  } catch (err) {
    return fail(err);
  }
}

export async function adminRemoveLodgeImage(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const edit = await beginEdit(fd);
    if ("error" in edit) return edit;
    const { admin, lodge } = edit;
    const kind = formString(fd, "kind") === "seal" ? "seal" : "logo";
    const previous = kind === "logo" ? lodge.logoKey : lodge.sealKey;
    await db.lodge.update({ where: { id: lodge.id }, data: kind === "logo" ? { logoKey: null } : { sealKey: null } });
    if (previous) await deleteObject(previous).catch(() => undefined);
    await auditEdit(admin, lodge, `lodge.${kind}_removed`);
    editPaths(lodge);
    return { ok: "Removed." };
  } catch (err) {
    return fail(err);
  }
}
